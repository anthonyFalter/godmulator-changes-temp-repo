import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  BuildingEntity,
  LightingPreset,
  SkyCloudsQualityOption,
  SpeciesId,
  TerrainType,
  TileData,
} from './types';
import { getTimeOfDayLightingState, wrapShaderTime } from './dayNightLighting';
import { createRng, normalizeSeed } from './worldGen';
import { WorldCullBounds, isPointInCullBounds } from './autoOptimizer';
import { SEASON_WATER_PROFILES } from './worldSeasons';

function addSteppedPuff(
  parts: THREE.BufferGeometry[],
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
  topHex: number,
  midHex: number,
  botHex: number,
): void {
  // Build a stepped rounded 3-tier voxel puff (wide base, taller core, crisp crown cap)
  // so every puff looks organically billowy rather than a single flat box.
  const tiers = [
    { sx: 1.0, sy: 0.46, sz: 1.0, oy: 0.0, cTop: midHex, cBot: botHex },
    { sx: 0.78, sy: 0.54, sz: 0.78, oy: ry * 0.28, cTop: topHex, cBot: midHex },
    { sx: 0.5, sy: 0.38, sz: 0.5, oy: ry * 0.58, cTop: topHex, cBot: topHex },
  ];

  for (const tier of tiers) {
    const w = rx * 2 * tier.sx;
    const h = ry * 2 * tier.sy;
    const d = rz * 2 * tier.sz;
    const y = cy + tier.oy;

    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(cx, y, cz);

    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const col = new Float32Array(pos.count * 3);
    const cTop = new THREE.Color(tier.cTop);
    const cBot = new THREE.Color(tier.cBot);
    const cSide = new THREE.Color(midHex).lerp(new THREE.Color(botHex), 0.35);

    for (let i = 0; i < pos.count; i++) {
      const ny = nor.getY(i);
      const nx = nor.getX(i);
      const nz = nor.getZ(i);
      let c = cSide;
      if (ny > 0.5) {
        c = cTop;
      } else if (ny < -0.5) {
        c = cBot;
      } else if (nx > 0.5 || nz > 0.5) {
        // Sunward side faces stay crisply brighter than shaded flanks
        c = tier.oy > 0 ? cTop : cSide;
      } else {
        c = cBot;
      }
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(geo);
  }
}

function createCloudVariants(): THREE.BufferGeometry[] {
  const top = 0xffffff;
  const mid = 0xd2e3f3;
  const bot = 0x86a3c3;

  // Variant 0: Classic Billowing Fluffy Cumulus (clover-leaf silhouette of 5 stepped puffs)
  const v0: THREE.BufferGeometry[] = [];
  addSteppedPuff(v0, 0.0, 0.15, 0.0, 1.05, 0.62, 0.95, top, mid, bot);
  addSteppedPuff(v0, -1.05, 0.02, 0.25, 0.72, 0.44, 0.68, top, mid, bot);
  addSteppedPuff(v0, 1.02, 0.06, -0.22, 0.76, 0.48, 0.7, top, mid, bot);
  addSteppedPuff(v0, 0.22, 0.04, 0.92, 0.62, 0.38, 0.58, top, mid, bot);
  addSteppedPuff(v0, -0.45, -0.02, -0.82, 0.58, 0.36, 0.54, top, mid, bot);
  // Small trailing wisp
  addSteppedPuff(v0, -1.95, 0.1, -0.45, 0.38, 0.24, 0.36, top, mid, bot);

  // Variant 1: Drifting Puff Archipelago (main puffy cluster + 3 scattered satellite puffs)
  const v1: THREE.BufferGeometry[] = [];
  addSteppedPuff(v1, 0.1, 0.1, 0.0, 0.92, 0.52, 0.85, top, mid, bot);
  addSteppedPuff(v1, -0.85, 0.02, 0.42, 0.65, 0.38, 0.62, top, mid, bot);
  addSteppedPuff(v1, 0.88, -0.04, 0.38, 0.54, 0.32, 0.52, top, mid, bot);
  addSteppedPuff(v1, -1.65, 0.06, -0.65, 0.48, 0.28, 0.44, top, mid, bot);
  addSteppedPuff(v1, 1.65, 0.14, -0.75, 0.42, 0.26, 0.4, top, mid, bot);
  addSteppedPuff(v1, -0.35, -0.02, 1.38, 0.36, 0.22, 0.34, top, mid, bot);

  // Variant 2: Tall Anvil Cumulonimbus Dome (dramatic high-relief cloud tower)
  const v2: THREE.BufferGeometry[] = [];
  addSteppedPuff(v2, 0.0, 0.24, 0.0, 1.15, 0.82, 1.08, top, mid, bot);
  addSteppedPuff(v2, -0.95, 0.12, -0.35, 0.82, 0.52, 0.78, top, mid, bot);
  addSteppedPuff(v2, 0.95, 0.08, 0.42, 0.8, 0.5, 0.76, top, mid, bot);
  addSteppedPuff(v2, -0.42, 0.0, 0.95, 0.68, 0.4, 0.65, top, mid, bot);
  addSteppedPuff(v2, 0.55, 0.02, -0.92, 0.64, 0.38, 0.6, top, mid, bot);
  addSteppedPuff(v2, 1.88, 0.06, -0.15, 0.42, 0.25, 0.38, top, mid, bot);

  // Variant 3: Twin Fluffy Puffs with Curved Wind Tail
  const v3: THREE.BufferGeometry[] = [];
  addSteppedPuff(v3, -0.55, 0.1, -0.15, 0.82, 0.48, 0.76, top, mid, bot);
  addSteppedPuff(v3, 0.65, 0.05, 0.35, 0.72, 0.44, 0.68, top, mid, bot);
  addSteppedPuff(v3, 0.12, 0.02, -0.68, 0.55, 0.34, 0.52, top, mid, bot);
  addSteppedPuff(v3, -1.48, 0.0, 0.55, 0.45, 0.28, 0.44, top, mid, bot);
  addSteppedPuff(v3, 1.55, 0.08, 0.85, 0.38, 0.24, 0.36, top, mid, bot);

  return [
    mergeGeometries(v0),
    mergeGeometries(v1),
    mergeGeometries(v2),
    mergeGeometries(v3),
  ];
}

interface CloudInstanceData {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotY: number;
  phase: number;
  bobAmp: number;
  variant: number;
  slot: number;
  reducedActive: boolean;
  cloudInstId: number;
  shadowInstId: number;
}

export interface SkyCloudSystem {
  group: THREE.Group;
  shadowGroup: THREE.Group;
  setQuality: (quality: SkyCloudsQualityOption) => void;
  update: (
    dt: number,
    elapsed: number,
    preset: LightingPreset,
    cullBounds?: WorldCullBounds,
  ) => void;
  dispose: () => void;
}

export function createSkyCloudSystem(gridSize: number): SkyCloudSystem {
  const variants = createCloudVariants();
  const group = new THREE.Group();
  const shadowGroup = new THREE.Group();

  // Crisp matte pixel cloud shading with clear top/side/underbelly contrast
  const cloudMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
    transparent: true,
    opacity: 0.88,
    depthWrite: true,
  });

  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x09131c,
    transparent: true,
    opacity: 0.09,
    depthWrite: false,
  });

  const clouds: CloudInstanceData[] = [];
  const cloudCount = 42;
  const pad = 18;
  const span = gridSize + pad * 2;

  const variantFullCounts = variants.map(() => 0);
  for (let i = 0; i < cloudCount; i++) {
    variantFullCounts[i % variants.length]++;
  }
  const variantReducedLimits = variantFullCounts.map((cap) => Math.ceil(cap * 0.5));

  let totalVerts = 0;
  let totalIndices = 0;
  for (let v = 0; v < variants.length; v++) {
    totalVerts += variants[v].attributes.position.count;
    const idxAttr = variants[v].index;
    totalIndices += idxAttr ? idxAttr.count : variants[v].attributes.position.count;
  }

  // Collapse 4+4 cloud InstancedMeshes into 2 BatchedMesh draw calls total
  const cloudBatch = new THREE.BatchedMesh(cloudCount, totalVerts, totalIndices, cloudMat);
  cloudBatch.castShadow = false;
  cloudBatch.receiveShadow = false;
  cloudBatch.frustumCulled = false;
  cloudBatch.perObjectFrustumCulled = false;
  cloudBatch.sortObjects = false;
  cloudBatch.renderOrder = 12;
  group.add(cloudBatch);

  const shadowBatch = new THREE.BatchedMesh(cloudCount, totalVerts, totalIndices, shadowMat);
  shadowBatch.castShadow = false;
  shadowBatch.receiveShadow = false;
  shadowBatch.frustumCulled = false;
  shadowBatch.perObjectFrustumCulled = false;
  shadowBatch.sortObjects = false;
  shadowBatch.renderOrder = -1;
  shadowGroup.add(shadowBatch);

  const cloudGeoIds = variants.map((geo) => cloudBatch.addGeometry(geo));
  const shadowGeoIds = variants.map((geo) => shadowBatch.addGeometry(geo));

  let rng = 133791;
  const nextRand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 4294967296;
  };

  const _yAxis = new THREE.Vector3(0, 1, 0);
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _scale = new THREE.Vector3();
  const _mat = new THREE.Matrix4();
  const variantQuats: THREE.Quaternion[] = [];
  const variantSlotCursor = variants.map(() => 0);
  const cloudVisState = new Uint8Array(cloudCount).fill(1);
  const shadowVisState = new Uint8Array(cloudCount).fill(1);

  for (let i = 0; i < cloudCount; i++) {
    const variant = i % variants.length;
    const slot = variantSlotCursor[variant]++;

    const scaleBase = 1.0 + nextRand() * 1.1;
    const scaleX = scaleBase * (0.92 + nextRand() * 0.25);
    const scaleY = scaleBase * (0.82 + nextRand() * 0.28);
    const scaleZ = scaleBase * (0.92 + nextRand() * 0.25);

    const altitudeBand = i % 3;
    const y = 8.4 + altitudeBand * 1.65 + nextRand() * 0.9;
    const speedBase = 0.8 + (2 - altitudeBand) * 0.28 + nextRand() * 0.35;

    const gridCols = 7;
    const cellX = (i % gridCols) / gridCols;
    const cellZ = Math.floor(i / gridCols) / Math.ceil(cloudCount / gridCols);
    const x = -pad + (cellX + (nextRand() - 0.5) * 0.13) * span;
    const z = -pad + (cellZ + (nextRand() - 0.5) * 0.14) * span;
    const rotY = Math.floor(nextRand() * 8) * (Math.PI / 4);
    const phase = nextRand() * Math.PI * 2;

    const q = new THREE.Quaternion().setFromAxisAngle(_yAxis, rotY);
    variantQuats.push(q);

    const cloudInstId = cloudBatch.addInstance(cloudGeoIds[variant]);
    _pos.set(x, y, z);
    _scale.set(scaleX, scaleY, scaleZ);
    _mat.compose(_pos, q, _scale);
    cloudBatch.setMatrixAt(cloudInstId, _mat);

    const shadowInstId = shadowBatch.addInstance(shadowGeoIds[variant]);
    _pos.set(x - 2.4, 0.32, z - 1.8);
    _scale.set(scaleX * 0.88, 0.02, scaleZ * 0.88);
    _mat.compose(_pos, q, _scale);
    shadowBatch.setMatrixAt(shadowInstId, _mat);

    clouds.push({
      x,
      y,
      z,
      vx: speedBase * 0.88,
      vz: speedBase * 0.36,
      scaleX,
      scaleY,
      scaleZ,
      rotY,
      phase,
      bobAmp: 0.08 + nextRand() * 0.07,
      variant,
      slot,
      reducedActive: slot < variantReducedLimits[variant],
      cloudInstId,
      shadowInstId,
    });
  }

  let currentQuality: SkyCloudsQualityOption = 'full';
  let qualityDirty = false;

  const setQuality = (quality: SkyCloudsQualityOption) => {
    if (currentQuality === quality) return;
    currentQuality = quality;
    const isOff = quality === 'off';
    group.visible = !isOff;
    shadowGroup.visible = !isOff;
    qualityDirty = true;
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const vis = !isOff && (quality === 'full' || c.reducedActive);
      const visFlag = vis ? 1 : 0;
      if (cloudVisState[i] !== visFlag) {
        cloudVisState[i] = visFlag;
        cloudBatch.setVisibleAt(c.cloudInstId, vis);
      }
      if (shadowVisState[i] !== visFlag) {
        shadowVisState[i] = visFlag;
        shadowBatch.setVisibleAt(c.shadowInstId, vis);
      }
    }
  };

  const _targetTint = new THREE.Color('#f7fbff');
  const _curTint = new THREE.Color('#f7fbff');

  const update = (
    dt: number,
    elapsed: number,
    preset: LightingPreset,
    cullBounds?: WorldCullBounds,
  ) => {
    if (currentQuality === 'off') return;

    if (preset === 'midnight') {
      _targetTint.set('#3b5175');
      cloudMat.opacity = 0.62;
      shadowMat.opacity = 0.03;
    } else if (preset === 'night') {
      _targetTint.set('#587499');
      cloudMat.opacity = 0.70;
      shadowMat.opacity = 0.04;
    } else if (preset === 'dusk') {
      _targetTint.set('#ff9b73');
      cloudMat.opacity = 0.86;
      shadowMat.opacity = 0.08;
    } else if (preset === 'dawn') {
      _targetTint.set('#ffc8bf');
      cloudMat.opacity = 0.85;
      shadowMat.opacity = 0.08;
    } else {
      _targetTint.set('#f7fbff');
      cloudMat.opacity = 0.86;
      shadowMat.opacity = 0.09;
    }

    const tintBlend = dt > 0 ? Math.min(1, dt * 4) : 0.08;
    _curTint.lerp(_targetTint, tintBlend);
    cloudMat.color.copy(_curTint);
    const safeElapsed = wrapShaderTime(elapsed);
    const isMoving = dt > 0;
    const isFullQuality = currentQuality === 'full';

    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const allowedByQuality = isFullQuality || c.reducedActive;
      if (!allowedByQuality) {
        if (cloudVisState[i] !== 0) {
          cloudVisState[i] = 0;
          cloudBatch.setVisibleAt(c.cloudInstId, false);
        }
        if (shadowVisState[i] !== 0) {
          shadowVisState[i] = 0;
          shadowBatch.setVisibleAt(c.shadowInstId, false);
        }
        continue;
      }

      if (isMoving) {
        const breeze = 1.0 + Math.sin(safeElapsed * 0.35 + c.phase) * 0.14;
        c.x += c.vx * breeze * dt;
        c.z += (c.vz + Math.cos(safeElapsed * 0.25 + c.phase) * 0.1) * dt;

        if (c.x > gridSize + pad) c.x -= span;
        if (c.x < -pad) c.x += span;
        if (c.z > gridSize + pad) c.z -= span;
        if (c.z < -pad) c.z += span;
      }

      const cloudVis = !cullBounds || isPointInCullBounds(c.x, c.z, cullBounds, 7.5);
      const shadowVis = !cullBounds || isPointInCullBounds(c.x - 2.4, c.z - 1.8, cullBounds, 7.5);
      const cVisFlag = cloudVis ? 1 : 0;
      const sVisFlag = shadowVis ? 1 : 0;
      const cBecameVis = cloudVis && cloudVisState[i] === 0;
      const sBecameVis = shadowVis && shadowVisState[i] === 0;

      if (cloudVisState[i] !== cVisFlag) {
        cloudVisState[i] = cVisFlag;
        cloudBatch.setVisibleAt(c.cloudInstId, cloudVis);
      }
      if (shadowVisState[i] !== sVisFlag) {
        shadowVisState[i] = sVisFlag;
        shadowBatch.setVisibleAt(c.shadowInstId, shadowVis);
      }

      const needCloudMatrix = cloudVis && (isMoving || cBecameVis || qualityDirty);
      const needShadowMatrix = shadowVis && (isMoving || sBecameVis || qualityDirty);
      if (!needCloudMatrix && !needShadowMatrix) continue;

      const puffPulse = 1.0 + Math.sin(safeElapsed * 0.75 + c.phase) * 0.025;
      _quat.copy(variantQuats[i]);

      if (needCloudMatrix) {
        const bobY = Math.sin(safeElapsed * 0.9 + c.phase) * c.bobAmp;
        _pos.set(c.x, c.y + bobY, c.z);
        _scale.set(c.scaleX * puffPulse, c.scaleY, c.scaleZ * puffPulse);
        _mat.compose(_pos, _quat, _scale);
        cloudBatch.setMatrixAt(c.cloudInstId, _mat);
      }

      if (needShadowMatrix) {
        _pos.set(c.x - 2.4, 0.32, c.z - 1.8);
        _scale.set(c.scaleX * 0.88 * puffPulse, 0.02, c.scaleZ * 0.88 * puffPulse);
        _mat.compose(_pos, _quat, _scale);
        shadowBatch.setMatrixAt(c.shadowInstId, _mat);
      }
    }
    qualityDirty = false;
  };

  const dispose = () => {
    cloudBatch.dispose();
    shadowBatch.dispose();
    for (const geo of variants) geo.dispose();
    cloudMat.dispose();
    shadowMat.dispose();
  };

  return { group, shadowGroup, setQuality, update, dispose };
}

export interface OceanFoamSystem {
  mesh: THREE.Mesh;
  updateMap: (tiles: TileData[]) => void;
  updateZones: (colorData: Uint8Array, idData: Uint8Array, anyActive: boolean) => void;
  updateFrame: (elapsed: number, preset: LightingPreset, seasonWeights?: THREE.Vector4) => void;
  dispose: () => void;
}

export function createOceanFoamSystem(gridSize: number): OceanFoamSystem {
  // RGBA DataTexture storing per-tile bathymetry:
  // R = water depth category (0 = dry land, 132 = shallow_water, 255 = deep_water)
  // G = land-contact proximity (255 = touches land, 0 = open)
  // B = other-water transition flag (255 = touches different water depth)
  // A = deterministic tile wave phase
  const data = new Uint8Array(gridSize * gridSize * 4);
  const waterMapTex = new THREE.DataTexture(data, gridSize, gridSize, THREE.RGBAFormat);
  waterMapTex.magFilter = THREE.NearestFilter;
  waterMapTex.minFilter = THREE.NearestFilter;
  waterMapTex.wrapS = THREE.ClampToEdgeWrapping;
  waterMapTex.wrapT = THREE.ClampToEdgeWrapping;
  waterMapTex.flipY = false;

  const zoneColorBytes = new Uint8Array(gridSize * gridSize * 4);
  const zoneColorTex = new THREE.DataTexture(zoneColorBytes, gridSize, gridSize, THREE.RGBAFormat);
  zoneColorTex.magFilter = THREE.NearestFilter;
  zoneColorTex.minFilter = THREE.NearestFilter;
  zoneColorTex.wrapS = THREE.ClampToEdgeWrapping;
  zoneColorTex.wrapT = THREE.ClampToEdgeWrapping;
  zoneColorTex.flipY = false;

  const zoneIdBytes = new Uint8Array(gridSize * gridSize * 4);
  const zoneIdTex = new THREE.DataTexture(zoneIdBytes, gridSize, gridSize, THREE.RGBAFormat);
  zoneIdTex.magFilter = THREE.NearestFilter;
  zoneIdTex.minFilter = THREE.NearestFilter;
  zoneIdTex.wrapS = THREE.ClampToEdgeWrapping;
  zoneIdTex.wrapT = THREE.ClampToEdgeWrapping;
  zoneIdTex.flipY = false;

  const oceanSegs = Math.min(48, Math.max(16, Math.ceil(gridSize / 2)));
  const geo = new THREE.PlaneGeometry(gridSize, gridSize, oceanSegs, oceanSegs);
  geo.rotateX(-Math.PI / 2);

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uGridSize: { value: gridSize },
      uWaterMap: { value: null as THREE.DataTexture | null },
      uZoneColorMap: { value: null as THREE.DataTexture | null },
      uZoneIdMap: { value: null as THREE.DataTexture | null },
      uZoneActive: { value: 0 },
      uHasPoison: { value: 0 },
      uHasLava: { value: 0 },
      uShallowColor: { value: new THREE.Color('#2896ab') },
      uDeepColor: { value: new THREE.Color('#193f54') },
      uCrestColor: { value: new THREE.Color('#5ce1e6') },
      uReefWaterColor: { value: new THREE.Color('#12d6df') },
      uFoamColor: { value: new THREE.Color('#f4fbff') },
      uFoamMint: { value: new THREE.Color('#9ee6f5') },
      uSeasonFrost: { value: 0.0 },
    },
  ]);
  // Assign mutable DataTexture AFTER merge so UniformsUtils.merge does not clone a stale copy
  uniforms.uWaterMap.value = waterMapTex;
  uniforms.uZoneColorMap.value = zoneColorTex;
  uniforms.uZoneIdMap.value = zoneIdTex;

  const material = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      #include <fog_pars_vertex>
      uniform float uTime;
      varying vec3 vWorldPos;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        // Gentle pixel-friendly ocean swell displacement
        float swell =
          sin(worldPos.x * 0.42 + uTime * 1.85) * 0.016 +
          cos(worldPos.z * 0.48 - uTime * 1.45) * 0.014;
        worldPos.y += swell;
        vWorldPos = worldPos.xyz;

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uGridSize;
      uniform sampler2D uWaterMap;
      uniform sampler2D uZoneColorMap;
      uniform sampler2D uZoneIdMap;
      uniform float uZoneActive;
      uniform float uHasPoison;
      uniform float uHasLava;
      uniform vec3 uShallowColor;
      uniform vec3 uDeepColor;
      uniform vec3 uCrestColor;
      uniform vec3 uReefWaterColor;
      uniform vec3 uFoamColor;
      uniform vec3 uFoamMint;
      uniform float uSeasonFrost;

      varying vec3 vWorldPos;

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      float valueNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash12(i);
        float b = hash12(i + vec2(1.0, 0.0));
        float c = hash12(i + vec2(0.0, 1.0));
        float d = hash12(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      vec4 sampleTile(vec2 coord) {
        vec2 clamped = clamp(coord, vec2(0.0), vec2(uGridSize - 1.0));
        return texture2D(uWaterMap, (clamped + 0.5) / uGridSize);
      }

      vec4 sampleZoneColor(vec2 coord) {
        vec2 clamped = clamp(coord, vec2(0.0), vec2(uGridSize - 1.0));
        return texture2D(uZoneColorMap, (clamped + 0.5) / uGridSize);
      }

      vec4 sampleZoneId(vec2 coord) {
        vec2 clamped = clamp(coord, vec2(0.0), vec2(uGridSize - 1.0));
        return texture2D(uZoneIdMap, (clamped + 0.5) / uGridSize);
      }

      float decodePoison(float b) {
        return (b > 0.002 && b <= 0.32) ? clamp(b / 0.298, 0.0, 1.0) : 0.0;
      }

      void main() {
        // Snap ocean & foam texture shading to 16x16 sub-tile pixel grid
        vec2 gridPos = vWorldPos.xz + 0.5;
        vec2 pixPos = floor(gridPos * 16.0) / 16.0;
        vec2 tileCoord = floor(pixPos);
        vec2 subUv = fract(pixPos);

        vec4 self = sampleTile(tileCoord);
        if (self.r < 0.15) {
          discard;
        }

        bool isDeep = self.r > 0.78;

        // 8-neighbor sampling for exact coastline (hits land) and smooth bathymetric depth interpolation
        vec4 nN  = sampleTile(tileCoord + vec2( 0.0, -1.0));
        vec4 nS  = sampleTile(tileCoord + vec2( 0.0,  1.0));
        vec4 nW  = sampleTile(tileCoord + vec2(-1.0,  0.0));
        vec4 nE  = sampleTile(tileCoord + vec2( 1.0,  0.0));
        vec4 nNW = sampleTile(tileCoord + vec2(-1.0, -1.0));
        vec4 nNE = sampleTile(tileCoord + vec2( 1.0, -1.0));
        vec4 nSW = sampleTile(tileCoord + vec2(-1.0,  1.0));
        vec4 nSE = sampleTile(tileCoord + vec2( 1.0,  1.0));

        // 1. Exact pixel distance to dry land coast (0.0 .. 1.5 tiles)
        float landDist = 2.0;
        if (nN.r  < 0.15) landDist = min(landDist, subUv.y);
        if (nS.r  < 0.15) landDist = min(landDist, 1.0 - subUv.y);
        if (nW.r  < 0.15) landDist = min(landDist, subUv.x);
        if (nE.r  < 0.15) landDist = min(landDist, 1.0 - subUv.x);
        if (nNW.r < 0.15) landDist = min(landDist, length(vec2(subUv.x, subUv.y)));
        if (nNE.r < 0.15) landDist = min(landDist, length(vec2(1.0 - subUv.x, subUv.y)));
        if (nSW.r < 0.15) landDist = min(landDist, length(vec2(subUv.x, 1.0 - subUv.y)));
        if (nSE.r < 0.15) landDist = min(landDist, length(vec2(1.0 - subUv.x, 1.0 - subUv.y)));

        // Second-ring proximity hint from precomputed G channel for incoming rolling breakers
        float midLandHint = max(max(nN.g, nS.g), max(nW.g, nE.g));
        float nearCoastInfluence = self.g > 0.05 ? 1.0 : (midLandHint > 0.05 ? 0.55 : 0.0);

        // Coarser chunky pixel coordinates (8 texels per tile) for readable wave crests & whitecaps
        vec2 chunkPos = floor(pixPos * 8.0) / 8.0;
        float swellA = valueNoise(chunkPos * 0.45 + vec2(uTime * 0.34, uTime * 0.22));
        float swellB = valueNoise(chunkPos * 0.9 - vec2(uTime * 0.24, -uTime * 0.3));
        float waveField = swellA * 0.65 + swellB * 0.35;

        // 2. Sub-tile bilinearly interpolated bathymetric depth (0.18 at shore .. 1.0 in deep ocean)
        // Clamping land neighbors (r < 0.15) to 0.18 ensures shoreline edges smoothly shallow out
        float dSelf = max(0.18, self.r);
        float dN  = nN.r  < 0.15 ? 0.18 : nN.r;
        float dS  = nS.r  < 0.15 ? 0.18 : nS.r;
        float dW  = nW.r  < 0.15 ? 0.18 : nW.r;
        float dE  = nE.r  < 0.15 ? 0.18 : nE.r;
        float dNW = nNW.r < 0.15 ? 0.18 : nNW.r;
        float dNE = nNE.r < 0.15 ? 0.18 : nNE.r;
        float dSW = nSW.r < 0.15 ? 0.18 : nSW.r;
        float dSE = nSE.r < 0.15 ? 0.18 : nSE.r;

        float interpW = mix(dW, dSelf, clamp(subUv.x + 0.5, 0.0, 1.0));
        float interpE = mix(dSelf, dE, clamp(subUv.x - 0.5, 0.0, 1.0));
        float depthX = subUv.x < 0.5 ? interpW : interpE;
        float interpN = mix(dN, dSelf, clamp(subUv.y + 0.5, 0.0, 1.0));
        float interpS = mix(dSelf, dS, clamp(subUv.y - 0.5, 0.0, 1.0));
        float depthY = subUv.y < 0.5 ? interpN : interpS;
        float cornerAvg = (dNW + dNE + dSW + dSE) * 0.25;
        float smoothDepth = clamp(
          (depthX * 0.42 + depthY * 0.42 + cornerAvg * 0.16) + (swellA - 0.5) * 0.045,
          0.18,
          1.0
        );

        // Feathered localized Coral Reef & Atlantis Sanctuary lagoon hue
        float selfReef = smoothstep(0.81, 0.98, self.b);
        float nbReef = max(
          max(smoothstep(0.81, 0.98, nN.b) * (1.0 - subUv.y), smoothstep(0.81, 0.98, nS.b) * subUv.y),
          max(smoothstep(0.81, 0.98, nW.b) * (1.0 - subUv.x), smoothstep(0.81, 0.98, nE.b) * subUv.x)
        );
        float reefMask = clamp(max(selfReef, nbReef * 0.78), 0.0, 1.0);
        bool isFloralWater = self.b > 0.72 && self.b <= 0.81;
        bool isRiver = self.b > 0.60 && self.b <= 0.72;
        bool isLavaWater = self.b > 0.48 && self.b <= 0.60;
        bool isLake = self.b > 0.33 && self.b <= 0.48;
        float poisonMask = 0.0;
        if (uHasPoison > 0.5 && !isLavaWater) {
          float pSelf = decodePoison(self.b);
          float pN  = nN.r  < 0.15 ? pSelf : decodePoison(nN.b);
          float pS  = nS.r  < 0.15 ? pSelf : decodePoison(nS.b);
          float pW  = nW.r  < 0.15 ? pSelf : decodePoison(nW.b);
          float pE  = nE.r  < 0.15 ? pSelf : decodePoison(nE.b);
          float pNW = nNW.r < 0.15 ? pSelf : decodePoison(nNW.b);
          float pNE = nNE.r < 0.15 ? pSelf : decodePoison(nNE.b);
          float pSW = nSW.r < 0.15 ? pSelf : decodePoison(nSW.b);
          float pSE = nSE.r < 0.15 ? pSelf : decodePoison(nSE.b);
          float pX = subUv.x < 0.5 ? mix(pW, pSelf, clamp(subUv.x + 0.5, 0.0, 1.0)) : mix(pSelf, pE, clamp(subUv.x - 0.5, 0.0, 1.0));
          float pY = subUv.y < 0.5 ? mix(pN, pSelf, clamp(subUv.y + 0.5, 0.0, 1.0)) : mix(pSelf, pS, clamp(subUv.y - 0.5, 0.0, 1.0));
          float pCorner = (pNW + pNE + pSW + pSE) * 0.25;
          float rawPoison = clamp(pX * 0.42 + pY * 0.42 + pCorner * 0.16, 0.0, 1.0);
          float plumeSwirl = (valueNoise(chunkPos * 1.1 + vec2(uTime * 0.22, -uTime * 0.18)) - 0.5) * 0.16 * sin(rawPoison * 3.14159);
          poisonMask = clamp(rawPoison + plumeSwirl, 0.0, 1.0);
        }

        // Multi-stop continuous ocean color gradient from sunlit turquoise shore -> aquamarine shelf -> azure slope -> deep navy sea
        vec3 shoreTurquoise = mix(uShallowColor, uCrestColor, 0.54);
        vec3 midSlopeAzure  = mix(uShallowColor, uDeepColor, 0.50);
        vec3 baseWater;
        if (smoothDepth < 0.42) {
          baseWater = mix(shoreTurquoise, uShallowColor, smoothstep(0.18, 0.42, smoothDepth));
        } else if (smoothDepth < 0.72) {
          baseWater = mix(uShallowColor, midSlopeAzure, smoothstep(0.42, 0.72, smoothDepth));
        } else {
          baseWater = mix(midSlopeAzure, uDeepColor, smoothstep(0.72, 0.96, smoothDepth));
        }

        if (landDist < 1.35) {
          baseWater = mix(baseWater, shoreTurquoise, smoothstep(1.35, 0.06, landDist) * 0.75);
        }

        // Continuous transparency curve: crystal-clear in shallow water & coastlines (0.14..0.32), smoothly deepening into deep sea (0.85)
        float waterAlpha = mix(
          0.14,
          0.85,
          smoothstep(0.20, 0.94, smoothDepth)
        );
        if (landDist < 1.2) {
          waterAlpha = min(waterAlpha, mix(0.12, 0.26, smoothstep(0.05, 1.2, landDist)));
        }

        float riverRapidMint = 0.0;
        float riverRapidCore = 0.0;
        float lakeRippleGlow = 0.0;
        float lakeSparkleBoost = 0.0;

        if (uHasLava > 0.5 && isLavaWater) {
          // Flowing Lava Rivers & Lakes (Volcanic Wasteland): bright molten magma current, cooled basalt crust islands & white-hot embers
          vec2 lavaDrift = chunkPos * 0.95 + vec2(-uTime * 0.48, uTime * 0.36);
          float lavaFlowA = valueNoise(lavaDrift);
          float lavaFlowB = valueNoise(chunkPos * 1.85 - vec2(uTime * 0.62, uTime * 0.44));
          float magmaField = lavaFlowA * 0.6 + lavaFlowB * 0.4;
          vec3 basaltCrust = vec3(0.14, 0.06, 0.05);
          vec3 magmaCrimson = vec3(0.84, 0.18, 0.04);
          vec3 magmaOrange = vec3(1.0, 0.44, 0.06);
          vec3 magmaGold = vec3(1.0, 0.85, 0.24);
          baseWater = mix(basaltCrust, magmaCrimson, smoothstep(0.20, 0.44, magmaField));
          baseWater = mix(baseWater, magmaOrange, smoothstep(0.44, 0.70, magmaField));
          baseWater = mix(baseWater, magmaGold, step(0.76, magmaField));
          waterAlpha = 0.94;
        } else if (isFloralWater) {
          // Majestic Floral Plains Spring Water: crystal-clear celeste-emerald water with floating golden & rose blossom petals
          vec3 floralSpring = vec3(0.20, 0.82, 0.86);
          vec3 floralJade = vec3(0.32, 0.94, 0.78);
          float streamShimmer = step(0.66, fract(chunkPos.x * 0.8 + chunkPos.y * 0.8 - uTime * 1.15 + swellA * 0.5));
          baseWater = mix(baseWater, floralSpring, 0.68);
          baseWater = mix(baseWater, floralJade, streamShimmer * 0.46);
          float petalSpot = hash12(floor(pixPos * 8.0 + vec2(uTime * 0.4, -uTime * 0.3)));
          if (petalSpot > 0.965) {
            baseWater = petalSpot > 0.982 ? vec3(1.0, 0.86, 0.38) : vec3(0.98, 0.58, 0.82);
          }
          waterAlpha = 0.24;
        } else if (reefMask > 0.01) {
          // Warm Coral Reef & Atlantis Sanctuary Lagoon: ultra-transparent turquoise glass window so 3D corals & sunken city ruins shine through!
          float caustic = step(0.76, valueNoise(chunkPos * 1.35 + vec2(uTime * 0.35, -uTime * 0.28)));
          vec3 reefAqua = mix(uReefWaterColor, uCrestColor, 0.24 + caustic * 0.28);
          baseWater = mix(baseWater, reefAqua, reefMask * 0.84);
          waterAlpha = mix(waterAlpha, 0.05, reefMask);
        } else if (isRiver) {
          // Living Flowing River: channel-following braided currents, sunlit glints, pool depth & lively whitewater riffles
          float wN  = nN.r  >= 0.15 ? 1.0 : 0.0;
          float wS  = nS.r  >= 0.15 ? 1.0 : 0.0;
          float wW  = nW.r  >= 0.15 ? 1.0 : 0.0;
          float wE  = nE.r  >= 0.15 ? 1.0 : 0.0;
          float wNW = nNW.r >= 0.15 ? 1.0 : 0.0;
          float wNE = nNE.r >= 0.15 ? 1.0 : 0.0;
          float wSW = nSW.r >= 0.15 ? 1.0 : 0.0;
          float wSE = nSE.r >= 0.15 ? 1.0 : 0.0;

          vec2 rawFlow =
            vec2(1.0, 0.0) * (wW + wE) +
            vec2(0.0, 1.0) * (wN + wS) +
            vec2(0.707, 0.707) * (wNW + wSE) * 0.65 +
            vec2(0.707, -0.707) * (wNE + wSW) * 0.65 +
            vec2(wE - wW, wS - wN) * 0.45;
          vec2 flowDir = length(rawFlow) > 0.05 ? normalize(rawFlow) : vec2(0.707, 0.707);
          vec2 flowPerp = vec2(-flowDir.y, flowDir.x);

          float along = dot(pixPos, flowDir);
          float across = dot(pixPos, flowPerp);
          float centerSpeed = mix(0.72, 1.18, smoothstep(0.08, 0.55, landDist));
          float braidWobble = (valueNoise(vec2(along * 0.55 - uTime * 0.75, across * 1.35)) - 0.5) * 0.80;

          float ribbonA = valueNoise(vec2(along * 0.85 - uTime * 2.05 * centerSpeed, across * 3.1 + braidWobble));
          float ribbonB = valueNoise(vec2(along * 1.65 - uTime * 2.95 * centerSpeed, across * 5.0 - braidWobble * 0.55));
          float currentField = ribbonA * 0.60 + ribbonB * 0.40;
          float currentStreak = step(0.61, currentField);
          float brightCurrent = step(0.77, ribbonA * 0.48 + ribbonB * 0.52);
          float sunFlecks = step(0.87, valueNoise(vec2(along * 3.4 - uTime * 3.6, across * 4.2)) * 0.55 + ribbonB * 0.45);

          float riverDepthFrac = smoothstep(0.20, 0.44, smoothDepth);
          vec3 riverBankCol = mix(uShallowColor, uReefWaterColor, 0.34);
          vec3 riverPoolCol = mix(uShallowColor, uDeepColor, 0.46);
          vec3 riverTint = mix(riverBankCol, riverPoolCol, riverDepthFrac);

          baseWater = mix(baseWater, riverTint, 0.74);
          baseWater = mix(baseWater, mix(uCrestColor, uFoamMint, 0.45), currentStreak * 0.36);
          baseWater = mix(baseWater, uFoamColor, max(brightCurrent * 0.30, sunFlecks * 0.52));
          waterAlpha = mix(0.32, 0.58, riverDepthFrac) + currentStreak * 0.07 + sunFlecks * 0.08;

          // Lively bank eddies & mid-channel whitewater riffles
          float riffleNoise = valueNoise(vec2(along * 1.4 - uTime * 2.4, across * 2.9));
          float bankEddy = smoothstep(0.24, 0.03, landDist) * step(0.45, riffleNoise + 0.16 * sin(uTime * 3.2 + along * 2.6));
          float midRapid = step(0.77, riffleNoise * 0.62 + ribbonB * 0.38) * smoothstep(0.06, 0.28, landDist);
          riverRapidMint = max(bankEddy * 0.85, midRapid * 0.72);
          riverRapidCore = max(
            smoothstep(0.14, 0.02, landDist) * step(0.58, riffleNoise),
            step(0.84, riffleNoise * 0.58 + ribbonB * 0.42) * smoothstep(0.08, 0.30, landDist)
          );
        } else if (isLake) {
          // Living Inland Lake: depth-layered emerald-to-sapphire basin, breeze wavelets, dancing sun sparkles & expanding ripple rings
          float lakeDepthFrac = smoothstep(0.20, 0.78, smoothDepth);
          vec3 lakeShoreCol = mix(uShallowColor, uReefWaterColor, 0.44);
          vec3 lakeMidCol   = mix(uShallowColor, uDeepColor, 0.44);
          vec3 lakeDeepCol  = mix(uDeepColor, uShallowColor * 0.55, 0.18);
          vec3 lakeTint = lakeDepthFrac < 0.48
            ? mix(lakeShoreCol, lakeMidCol, smoothstep(0.0, 0.48, lakeDepthFrac))
            : mix(lakeMidCol, lakeDeepCol, smoothstep(0.48, 1.0, lakeDepthFrac));

          float breezeA = valueNoise(chunkPos * 1.15 + vec2(uTime * 0.42, uTime * 0.16));
          float breezeB = valueNoise(chunkPos * 2.15 - vec2(uTime * 0.26, -uTime * 0.34));
          float lakeWavelet = step(0.64, breezeA * 0.58 + breezeB * 0.42);
          float lakeSparkle = step(0.86, valueNoise(pixPos * 4.4 + vec2(uTime * 0.85, -uTime * 0.60)) * 0.55 + breezeB * 0.45);
          lakeSparkleBoost = lakeSparkle;

          // Periodic organic concentric ripple rings (fish rises / water striders)
          vec2 ripCell = floor(pixPos * 0.42);
          vec2 ripLocal = fract(pixPos * 0.42);
          vec2 ripCenter = vec2(
            0.22 + 0.56 * hash12(ripCell + vec2(3.1, 7.7)),
            0.22 + 0.56 * hash12(ripCell + vec2(19.4, 2.9))
          );
          float ripSeed = hash12(ripCell + vec2(11.2, 41.6));
          float ripCycle = fract(uTime * 0.24 + ripSeed);
          float ripActive = step(0.52, ripSeed) * step(ripCycle, 0.56);
          float ripAge = ripCycle / 0.56;
          float ripDist = length(ripLocal - ripCenter);
          float ripRadius = 0.04 + ripAge * 0.31;
          float ripRing = (1.0 - smoothstep(0.0, 0.032, abs(ripDist - ripRadius))) * (1.0 - ripAge) * ripActive * smoothstep(0.10, 0.34, landDist);
          lakeRippleGlow = step(0.24, ripRing) * (1.0 - ripAge * 0.60);

          baseWater = mix(baseWater, lakeTint, 0.78);
          baseWater = mix(baseWater, mix(lakeTint, uCrestColor, 0.44), lakeWavelet * 0.36);
          baseWater = mix(baseWater, uFoamColor, max(lakeSparkle * 0.55, lakeRippleGlow * 0.58));
          waterAlpha = mix(0.30, 0.74, lakeDepthFrac) + lakeWavelet * 0.05 + lakeSparkle * 0.10 + lakeRippleGlow * 0.14;
        }

        if (uHasPoison > 0.5 && !isLavaWater && poisonMask > 0.005) {
          // Multi-stage smooth dilution gradient: clean water -> translucent emerald-teal plume -> murky green -> bubbling toxic sludge
          vec2 poisonDrift = chunkPos * 1.15 + vec2(uTime * 0.32, -uTime * 0.26);
          float toxA = valueNoise(poisonDrift);
          float toxB = valueNoise(chunkPos * 2.1 - vec2(uTime * 0.45, -uTime * 0.38));
          float toxField = toxA * 0.58 + toxB * 0.42;
          vec3 dilutedTeal = vec3(0.08, 0.62, 0.46);
          vec3 mirePurple = vec3(0.16, 0.10, 0.22);
          vec3 acidDeep = vec3(0.08, 0.48, 0.18);
          vec3 poisonGreen = vec3(0.24, 0.82, 0.28);
          vec3 toxicLime = vec3(0.74, 0.96, 0.32);
          float coreStrength = smoothstep(0.32, 0.92, poisonMask);
          vec3 sludgeColor = mix(mirePurple, acidDeep, smoothstep(0.18, 0.40, toxField));
          sludgeColor = mix(sludgeColor, poisonGreen, smoothstep(0.40, 0.68, toxField));
          sludgeColor = mix(sludgeColor, toxicLime, step(0.75, toxField) * coreStrength);
          vec3 plumeColor = mix(dilutedTeal, sludgeColor, coreStrength);
          float colorMix = smoothstep(0.0, 0.85, poisonMask);
          baseWater = mix(baseWater, plumeColor, colorMix);
          waterAlpha = mix(waterAlpha, 0.84, smoothstep(0.10, 0.95, poisonMask));
        }

        // Pixelated rolling wave bands (suppressed over crystal-clear reef/Atlantis lagoons; tailored for inland lakes & rivers)
        float shallowCalm = smoothstep(0.22, 0.65, smoothDepth);
        float calmFactor = (isRiver || isLake)
          ? (isLake ? 0.52 : 0.38)
          : (1.0 - reefMask * 0.94) * (0.35 + 0.65 * shallowCalm);
        float ridge = step(0.63, waveField) * calmFactor;
        float glint = step(0.80, waveField + 0.06 * sin(chunkPos.x * 1.1 + uTime * 2.1)) * calmFactor;
        float poisonTintAmt = smoothstep(0.15, 0.85, poisonMask);
        vec3 crestTint = isLavaWater ? vec3(1.0, 0.92, 0.35) : mix(uCrestColor, vec3(0.78, 0.98, 0.38), poisonTintAmt);
        vec3 color = mix(baseWater, mix(baseWater, crestTint, 0.36), ridge * 0.44);
        color = mix(color, crestTint, max(glint * 0.30, lakeSparkleBoost * 0.22));

        // --- FOAM 1: Coast hitting dry land (ocean crashing surf vs gentle lake wavelets vs lively river riffles) ---
        float coastWobble = (swellB - 0.5) * 0.26 + sin((pixPos.x - pixPos.y) * 1.1 + uTime * 2.0) * 0.06;
        float coastFoamMint = 0.0;
        float coastFoamCore = 0.0;
        if (isRiver && !isLavaWater) {
          coastFoamMint = riverRapidMint;
          coastFoamCore = riverRapidCore;
        } else if (isLake && !isLavaWater) {
          // Gentle lapping lakeshore edge shimmer (no heavy ocean breakers)
          float lakeLap = 0.13 + 0.045 * sin(uTime * 1.85 + (pixPos.x - pixPos.y) * 0.85);
          float lapBreak = step(0.36, valueNoise(chunkPos * 1.9 + vec2(uTime * 0.24, -uTime * 0.20)));
          coastFoamMint = step(landDist + coastWobble * 0.22, lakeLap) * (0.55 + 0.45 * lapBreak);
          coastFoamCore = step(landDist + coastWobble * 0.15, lakeLap * 0.58) * lapBreak;
        } else {
          float surgeLap = 0.28 + 0.11 * sin(uTime * 2.8 + (pixPos.x + pixPos.y) * 0.42);
          float shoreCrest = step(landDist + coastWobble * 0.42, surgeLap);

          float breakerWave = fract(landDist * 1.35 + uTime * 0.62 + coastWobble * 0.45);
          float breakerBand = nearCoastInfluence * step(0.7, breakerWave) * smoothstep(1.2, 0.06, landDist);
          float breakerBreakup = step(0.32, valueNoise(chunkPos * 1.45 + vec2(uTime * 0.38, -uTime * 0.28)));

          coastFoamCore = step(landDist + coastWobble * 0.3, surgeLap * 0.76);
          coastFoamMint = max(shoreCrest, breakerBand * breakerBreakup);
        }

        // --- FOAM 2: Random open-sea whitecaps & ephemeral bubble trails (suppressed on calm inland lakes/rivers & reefs) ---
        float capA = valueNoise(chunkPos * 0.55 + vec2(uTime * 0.26, uTime * 0.16));
        float capB = valueNoise(chunkPos * 1.35 - vec2(uTime * 0.38, -uTime * 0.2));
        float capPulse = 0.5 + 0.5 * sin(uTime * 1.4 + self.a * 6.2831 + chunkPos.x * 0.3);
        float combinedCap = capA * 0.54 + capB * 0.32 + capPulse * 0.14;

        float capThresh = isDeep ? 0.78 : 0.88;
        float openFoamAllow = (isRiver || isLake) ? 0.0 : step(reefMask, 0.10) * smoothstep(0.32, 0.65, smoothDepth);
        float openFoamMint = step(capThresh, combinedCap) * openFoamAllow;
        float openFoamCore = step(capThresh + 0.045, combinedCap) * openFoamAllow;

        float reefFoamSuppress = 1.0 - reefMask * 0.90;
        float mintMask = max(coastFoamMint * reefFoamSuppress, openFoamMint);
        float whiteMask = max(coastFoamCore * reefFoamSuppress, openFoamCore);

        vec3 foamMintCol = isLavaWater ? vec3(1.0, 0.54, 0.08) : mix(uFoamMint, vec3(0.45, 0.92, 0.26), poisonTintAmt);
        vec3 foamCoreCol = isLavaWater ? vec3(1.0, 0.94, 0.42) : mix(uFoamColor, vec3(0.82, 1.0, 0.48), poisonTintAmt);
        color = mix(color, foamMintCol, mintMask * 0.82);
        color = mix(color, foamCoreCol, whiteMask * 0.98);

        // Winter shoreline ice-crust & frosted river/lake bank sheen (skips lava & poisoned waters)
        if (uSeasonFrost > 0.01 && !isLavaWater && poisonTintAmt < 0.25) {
          float frostNoise = valueNoise(pixPos * 1.45 + vec2(3.7, 9.1));
          float shoreIceBand = smoothstep(0.32, 0.03, landDist) * step(0.42 - uSeasonFrost * 0.22, frostNoise);
          float inlandIce = (isRiver || isLake)
            ? smoothstep(0.65, 0.05, landDist) * step(0.50 - uSeasonFrost * 0.26, frostNoise)
            : 0.0;
          float iceMask = clamp(max(shoreIceBand * 0.88, inlandIce * 0.92), 0.0, 1.0) * uSeasonFrost;
          vec3 iceCol = mix(uFoamMint * 0.95, uFoamColor, step(0.62, frostNoise));
          color = mix(color, iceCol, iceMask * 0.78);
          waterAlpha = max(waterAlpha, iceMask * 0.84);
        }

        float zoneAlpha = 0.0;
        if (uZoneActive > 0.5) {
          vec4 zCol = sampleZoneColor(tileCoord);
          vec4 zId = sampleZoneId(tileCoord);
          zoneAlpha = zCol.a;
          if (zoneAlpha > 0.01) {
            vec4 zN = sampleZoneId(tileCoord + vec2(0.0, -1.0));
            vec4 zS = sampleZoneId(tileCoord + vec2(0.0, 1.0));
            vec4 zW = sampleZoneId(tileCoord + vec2(-1.0, 0.0));
            vec4 zE = sampleZoneId(tileCoord + vec2(1.0, 0.0));
            vec4 zNW = sampleZoneId(tileCoord + vec2(-1.0, -1.0));
            vec4 zNE = sampleZoneId(tileCoord + vec2(1.0, -1.0));
            vec4 zSW = sampleZoneId(tileCoord + vec2(-1.0, 1.0));
            vec4 zSE = sampleZoneId(tileCoord + vec2(1.0, 1.0));

            vec4 zN2 = sampleZoneId(tileCoord + vec2(0.0, -2.0));
            vec4 zS2 = sampleZoneId(tileCoord + vec2(0.0, 2.0));
            vec4 zW2 = sampleZoneId(tileCoord + vec2(-2.0, 0.0));
            vec4 zE2 = sampleZoneId(tileCoord + vec2(2.0, 0.0));

            bool diffN = abs(zN.r - zId.r) > 0.002 || abs(zN.g - zId.g) > 0.002;
            bool diffS = abs(zS.r - zId.r) > 0.002 || abs(zS.g - zId.g) > 0.002;
            bool diffW = abs(zW.r - zId.r) > 0.002 || abs(zW.g - zId.g) > 0.002;
            bool diffE = abs(zE.r - zId.r) > 0.002 || abs(zE.g - zId.g) > 0.002;

            bool diffNW = abs(zNW.r - zId.r) > 0.002 || abs(zNW.g - zId.g) > 0.002;
            bool diffNE = abs(zNE.r - zId.r) > 0.002 || abs(zNE.g - zId.g) > 0.002;
            bool diffSW = abs(zSW.r - zId.r) > 0.002 || abs(zSW.g - zId.g) > 0.002;
            bool diffSE = abs(zSE.r - zId.r) > 0.002 || abs(zSE.g - zId.g) > 0.002;

            bool diffN2 = abs(zN2.r - zId.r) > 0.002 || abs(zN2.g - zId.g) > 0.002;
            bool diffS2 = abs(zS2.r - zId.r) > 0.002 || abs(zS2.g - zId.g) > 0.002;
            bool diffW2 = abs(zW2.r - zId.r) > 0.002 || abs(zW2.g - zId.g) > 0.002;
            bool diffE2 = abs(zE2.r - zId.r) > 0.002 || abs(zE2.g - zId.g) > 0.002;

            bool isOuterBorderTile = diffN || diffS || diffW || diffE || diffNW || diffNE || diffSW || diffSE;
            bool isInnerBorderTile = !isOuterBorderTile && (diffN2 || diffS2 || diffW2 || diffE2);

            float outerDarkW = 0.44;
            bool onDarkOuterStroke =
              (diffN && subUv.y < outerDarkW) ||
              (diffS && subUv.y > 1.0 - outerDarkW) ||
              (diffW && subUv.x < outerDarkW) ||
              (diffE && subUv.x > 1.0 - outerDarkW) ||
              (diffNW && subUv.x < outerDarkW && subUv.y < outerDarkW) ||
              (diffNE && subUv.x > 1.0 - outerDarkW && subUv.y < outerDarkW) ||
              (diffSW && subUv.x < outerDarkW && subUv.y > 1.0 - outerDarkW) ||
              (diffSE && subUv.x > 1.0 - outerDarkW && subUv.y > 1.0 - outerDarkW);

            bool isHovered = zId.b > 0.5;
            float hoverPulse = isHovered ? (0.16 + 0.08 * sin(uTime * 5.0)) : 0.0;

            if (onDarkOuterStroke) {
              vec3 darkBorderCol = zCol.rgb * (isHovered ? 0.52 : 0.36);
              color = mix(color, darkBorderCol, 0.96);
            } else if (isOuterBorderTile || isInnerBorderTile) {
              vec3 borderCol = zCol.rgb * (isHovered ? 0.64 : 0.46);
              color = mix(color, borderCol, isOuterBorderTile ? 0.95 : 0.90);
            } else {
              float baseAlpha = zCol.a * 0.52 + hoverPulse;
              color = mix(color, zCol.rgb, clamp(baseAlpha, 0.0, 0.78));
            }
          }
        }

        waterAlpha = clamp(waterAlpha + mintMask * 0.32 + whiteMask * 0.56, 0.0, 0.98);
        if (zoneAlpha > 0.01) {
          waterAlpha = max(waterAlpha, 0.88);
        }

        gl_FragColor = vec4(color, waterAlpha);
        #include <fog_fragment>
      }
    `,
  });
  material.uniforms.uWaterMap.value = waterMapTex;
  material.uniforms.uZoneColorMap.value = zoneColorTex;
  material.uniforms.uZoneIdMap.value = zoneIdTex;

  const mesh = new THREE.Mesh(geo, material);
  const center = (gridSize - 1) / 2;
  mesh.position.set(center, 0.295, center);
  mesh.renderOrder = -5;

  // Preallocated O(N) Chamfer distance-field buffers (3=orthogonal step, 4=diagonal step -> dist = val / 3.0)
  const totalCells = gridSize * gridSize;
  const distLand = new Uint8Array(totalCells);
  const distShallow = new Uint8Array(totalCells);
  const distDeep = new Uint8Array(totalCells);
  const distPoison = new Uint8Array(totalCells);
  const poisonPassable = new Uint8Array(totalCells);
  const poisonQueue = new Int32Array(totalCells);
  const coralFlag = new Uint8Array(totalCells); // 0=none, 1=coral_reef, 2=atlantis_ruin
  const isLandFlag = new Uint8Array(totalCells);

  const chamferPass = (buf: Uint8Array) => {
    const gs = gridSize;
    // Forward pass (top-left to bottom-right)
    for (let z = 0; z < gs; z++) {
      const row = z * gs;
      const prevRow = row - gs;
      for (let x = 0; x < gs; x++) {
        const idx = row + x;
        let v = buf[idx];
        if (v === 0) continue;
        if (x > 0) {
          const c = buf[idx - 1] + 3;
          if (c < v) v = c;
        }
        if (z > 0) {
          const c = buf[prevRow + x] + 3;
          if (c < v) v = c;
          if (x > 0) {
            const d = buf[prevRow + x - 1] + 4;
            if (d < v) v = d;
          }
          if (x + 1 < gs) {
            const d = buf[prevRow + x + 1] + 4;
            if (d < v) v = d;
          }
        }
        buf[idx] = v;
      }
    }
    // Backward pass (bottom-right to top-left)
    for (let z = gs - 1; z >= 0; z--) {
      const row = z * gs;
      const nextRow = row + gs;
      for (let x = gs - 1; x >= 0; x--) {
        const idx = row + x;
        let v = buf[idx];
        if (v === 0) continue;
        if (x + 1 < gs) {
          const c = buf[idx + 1] + 3;
          if (c < v) v = c;
        }
        if (z + 1 < gs) {
          const c = buf[nextRow + x] + 3;
          if (c < v) v = c;
          if (x + 1 < gs) {
            const d = buf[nextRow + x + 1] + 4;
            if (d < v) v = d;
          }
          if (x > 0) {
            const d = buf[nextRow + x - 1] + 4;
            if (d < v) v = d;
          }
        }
        buf[idx] = v;
      }
    }
  };

  const updateMap = (tiles: TileData[]) => {
    const gs = gridSize;
    const INF = 18; // >= 6 tiles in 3x fixed-point
    const POISON_MAX_DIST = 15; // 5 tiles in 3x fixed-point
    let pqHead = 0;
    let pqTail = 0;
    let hasAnyPoison = false;
    let hasAnyLava = false;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const land = t.height > 0 || t.terrain === 'ice';
      isLandFlag[i] = land ? 1 : 0;
      if (land) {
        distLand[i] = 0;
        distShallow[i] = 0;
        distDeep[i] = INF;
        distPoison[i] = 255;
        poisonPassable[i] = 0;
        coralFlag[i] = 0;
      } else {
        const isDeep = t.terrain === 'deep_water' && !t.isRiver && !t.isLake;
        distLand[i] = INF;
        distShallow[i] = isDeep ? INF : 0;
        distDeep[i] = isDeep ? 0 : INF;
        const isLava = t.waterKind === 'lava';
        if (isLava) hasAnyLava = true;
        poisonPassable[i] = isLava ? 0 : 1;
        if (t.waterKind === 'poison') {
          hasAnyPoison = true;
          distPoison[i] = 0;
          poisonQueue[pqTail++] = i;
        } else {
          distPoison[i] = 255;
        }
        if (t.resourceNode === 'atlantis_ruin') {
          coralFlag[i] = 2;
        } else if (
          t.resourceNode === 'coral_reef' &&
          (t.coralBleachTimer ?? 0) <= 0 &&
          t.resourceAmount > 0
        ) {
          coralFlag[i] = 1;
        } else {
          coralFlag[i] = 0;
        }
      }
    }

    chamferPass(distLand);
    chamferPass(distShallow);
    chamferPass(distDeep);

    // Bounded water-only BFS so poison smoothly gradients through connected water channels (never across land barriers)
    if (pqTail > 0) {
      const nDx = [1, -1, 0, 0, 1, -1, 1, -1];
      const nDz = [0, 0, 1, -1, 1, 1, -1, -1];
      const nCost = [3, 3, 3, 3, 4, 4, 4, 4];
      while (pqHead !== pqTail) {
        const cur = poisonQueue[pqHead++];
        if (pqHead === totalCells) pqHead = 0;
        const curD = distPoison[cur];
        if (curD >= POISON_MAX_DIST) continue;
        const cx = cur % gs;
        const cz = (cur - cx) / gs;
        for (let k = 0; k < 8; k++) {
          const dx = nDx[k];
          const dz = nDz[k];
          const nx = cx + dx;
          const nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= gs || nz >= gs) continue;
          const ni = nz * gs + nx;
          if (!poisonPassable[ni]) continue;
          // Prevent diagonal bleed across touching land corners
          if (k >= 4 && !poisonPassable[cz * gs + nx] && !poisonPassable[nz * gs + cx]) {
            continue;
          }
          const nd = curD + nCost[k];
          if (nd <= POISON_MAX_DIST && nd < distPoison[ni]) {
            distPoison[ni] = nd;
            poisonQueue[pqTail++] = ni;
            if (pqTail === totalCells) pqTail = 0;
          }
        }
      }
    }

    for (let i = 0; i < tiles.length; i++) {
      const idx = i * 4;
      if (isLandFlag[i]) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
        continue;
      }

      const t = tiles[i];
      const isHealthyCoralOrAtlantis = coralFlag[i] > 0;
      const touchesLand = distLand[i] <= 4 ? 255 : 0;

      // 1-ring 8-neighbor coral check using flat Uint8Array (no TileData derefs)
      let adjCoralCount = isHealthyCoralOrAtlantis ? 2 : 0;
      if (adjCoralCount < 2) {
        const tx = t.x;
        const tz = t.z;
        const z0 = tz > 0 ? tz - 1 : 0;
        const z1 = tz + 1 < gs ? tz + 1 : gs - 1;
        const x0 = tx > 0 ? tx - 1 : 0;
        const x1 = tx + 1 < gs ? tx + 1 : gs - 1;
        for (let nz = z0; nz <= z1; nz++) {
          const nRow = nz * gs;
          for (let nx = x0; nx <= x1; nx++) {
            const ni = nRow + nx;
            if (ni !== i) adjCoralCount += coralFlag[ni];
          }
        }
      }

      let depthVal = 255;
      if (isHealthyCoralOrAtlantis) {
        depthVal = 54;
      } else if (t.isLake) {
        // Inland lake bathymetry: shallow sunlit pebble shelf -> deepening jade slope -> deep alpine lake heart
        const landD = Math.min(4.2, distLand[i] / 3.0);
        const basinFrac = Math.max(0, Math.min(1, (landD - 0.85) / 2.65));
        depthVal = Math.round(56 + Math.pow(basinFrac, 0.85) * 148);
      } else if (t.isRiver) {
        // River channel bathymetry: shallow gravelly banks -> deeper mid-channel thalweg pools
        const landD = Math.min(2.6, distLand[i] / 3.0);
        const channelFrac = Math.max(0, Math.min(1, (landD - 0.8) / 1.5));
        const poolVar = (((t.x * 37 + t.z * 73) ^ (t.x * 13)) & 15);
        depthVal = Math.round(54 + channelFrac * 36 + poolVar * 0.7);
      } else if (t.terrain !== 'deep_water') {
        // Shallow shelf: smoothly deepens from 52 along beach/lagoon interior to 146 near the deep_water dropoff
        const landD = Math.min(4.0, distLand[i] / 3.0);
        const deepD = Math.min(4.0, distDeep[i] / 3.0);
        const shoreFactor = Math.max(0, Math.min(1, (landD - 1.0) / 3.0));
        const dropoffPull = Math.max(0, Math.min(1, (3.2 - deepD) / 2.2));
        depthVal = Math.round(52 + shoreFactor * 44 + dropoffPull * 50);
      } else {
        // Deep water: smoothly transitions from 166 at the shallow_water border across a 4-tile slope to 255 in open abyss
        const shallowD = Math.min(4.5, distShallow[i] / 3.0);
        const slopeFactor = Math.max(0, Math.min(1, (shallowD - 1.0) / 3.2));
        depthVal = Math.round(166 + slopeFactor * 89);
      }
      data[idx] = Math.max(48, Math.min(255, depthVal));

      data[idx + 1] = touchesLand;
      // Encode water special feature in B channel:
      // 255 = coral_reef / atlantis_ruin or dense reef lagoon interior, 220 = reef lagoon fringe,
      // 195 = enchanted floral spring water, 170 = shallow river, 135 = flowing lava river/lake,
      // 100 = inland lake, 1..76 = continuous poison concentration & water-connected dilution gradient,
      // 0 = standard sea
      const reefByte =
        isHealthyCoralOrAtlantis || adjCoralCount >= 2
          ? 255
          : adjCoralCount === 1
            ? 220
            : 0;
      let waterFeatureByte = 0;
      if (t.waterKind === 'lava') {
        waterFeatureByte = 135;
      } else if (t.waterKind === 'poison') {
        waterFeatureByte = 76;
      } else if (distPoison[i] <= POISON_MAX_DIST) {
        // Connected active water within ~5 tiles of poison: encode smooth continuous dilution concentration (1..70)
        const frac = Math.max(0, 1 - distPoison[i] / (POISON_MAX_DIST + 1.2));
        waterFeatureByte = Math.max(1, Math.min(72, Math.round(74 * Math.pow(frac, 1.35))));
      } else if (t.waterKind === 'floral') {
        waterFeatureByte = 195;
      } else if (reefByte > 0) {
        waterFeatureByte = reefByte;
      } else if (t.isRiver || t.isLake) {
        // Auto-detect floral springs bordering Floral Plains (never fake lava/poison on quenched water)
        let adjFloral = false;
        const tx = t.x;
        const tz = t.z;
        if (tx > 0 && tiles[i - 1].terrain === 'floral_plains') adjFloral = true;
        else if (tx + 1 < gs && tiles[i + 1].terrain === 'floral_plains') adjFloral = true;
        else if (tz > 0 && tiles[i - gs].terrain === 'floral_plains') adjFloral = true;
        else if (tz + 1 < gs && tiles[i + gs].terrain === 'floral_plains') adjFloral = true;
        waterFeatureByte = adjFloral ? 195 : t.isRiver ? 170 : 100;
      }
      data[idx + 2] = waterFeatureByte;

      const phaseByte = Math.abs(((t.x * 73856093) ^ (t.z * 19349663)) | 0) & 255;
      data[idx + 3] = phaseByte;
    }
    material.uniforms.uHasPoison.value = hasAnyPoison ? 1 : 0;
    material.uniforms.uHasLava.value = hasAnyLava ? 1 : 0;
    waterMapTex.needsUpdate = true;
  };

  const _shallowTarget = new THREE.Color('#2896ab');
  const _deepTarget = new THREE.Color('#193f54');
  const _crestTarget = new THREE.Color('#5ce1e6');
  const _reefTarget = new THREE.Color('#12d6df');
  const _foamTarget = new THREE.Color('#f4fbff');
  const _mintTarget = new THREE.Color('#9ee6f5');

  const updateFrame = (
    elapsed: number,
    preset: LightingPreset,
    seasonWeights?: THREE.Vector4,
  ) => {
    const mu = material.uniforms;
    mu.uTime.value = wrapShaderTime(elapsed);

    if (preset === 'midnight') {
      _shallowTarget.set('#102b3a');
      _deepTarget.set('#06131d');
      _crestTarget.set('#1d4b63');
      _reefTarget.set('#135d6e');
      _foamTarget.set('#8db2cc');
      _mintTarget.set('#3f6b85');
    } else if (preset === 'night') {
      _shallowTarget.set('#1a4357');
      _deepTarget.set('#0c212e');
      _crestTarget.set('#2c6680');
      _reefTarget.set('#187b8a');
      _foamTarget.set('#b8d6ea');
      _mintTarget.set('#5c8fa8');
    } else if (preset === 'dusk') {
      _shallowTarget.set('#376478');
      _deepTarget.set('#1f384d');
      _crestTarget.set('#d9886c');
      _reefTarget.set('#29b3b8');
      _foamTarget.set('#ffe9dc');
      _mintTarget.set('#b3c4d4');
    } else if (preset === 'dawn') {
      _shallowTarget.set('#387487');
      _deepTarget.set('#1d4459');
      _crestTarget.set('#e8a3a0');
      _reefTarget.set('#2ccbd0');
      _foamTarget.set('#fff3f0');
      _mintTarget.set('#b5dfe8');
    } else {
      _shallowTarget.set('#2896ab');
      _deepTarget.set('#193f54');
      _crestTarget.set('#5ce1e6');
      _reefTarget.set('#12d6df');
      _foamTarget.set('#f4fbff');
      _mintTarget.set('#9ee6f5');
    }

    let targetFrost = 0.0;
    if (seasonWeights) {
      const wSpr = seasonWeights.x;
      const wSum = seasonWeights.y;
      const wAut = seasonWeights.z;
      const wWin = seasonWeights.w;
      const pSpr = SEASON_WATER_PROFILES.spring;
      const pSum = SEASON_WATER_PROFILES.summer;
      const pAut = SEASON_WATER_PROFILES.autumn;
      const pWin = SEASON_WATER_PROFILES.winter;

      const applyTint = (
        c: THREE.Color,
        a: [number, number, number],
        b: [number, number, number],
        d: [number, number, number],
        e: [number, number, number],
      ) => {
        const r = a[0] * wSpr + b[0] * wSum + d[0] * wAut + e[0] * wWin;
        const g = a[1] * wSpr + b[1] * wSum + d[1] * wAut + e[1] * wWin;
        const bl = a[2] * wSpr + b[2] * wSum + d[2] * wAut + e[2] * wWin;
        c.setRGB(Math.min(1.0, c.r * r), Math.min(1.0, c.g * g), Math.min(1.0, c.b * bl));
      };

      applyTint(_shallowTarget, pSpr.shallowTint, pSum.shallowTint, pAut.shallowTint, pWin.shallowTint);
      applyTint(_deepTarget, pSpr.deepTint, pSum.deepTint, pAut.deepTint, pWin.deepTint);
      applyTint(_crestTarget, pSpr.crestTint, pSum.crestTint, pAut.crestTint, pWin.crestTint);
      applyTint(_foamTarget, pSpr.foamTint, pSum.foamTint, pAut.foamTint, pWin.foamTint);
      targetFrost =
        pSpr.frostStrength * wSpr +
        pSum.frostStrength * wSum +
        pAut.frostStrength * wAut +
        pWin.frostStrength * wWin;
    }

    mu.uShallowColor.value.lerp(_shallowTarget, 0.08);
    mu.uDeepColor.value.lerp(_deepTarget, 0.08);
    mu.uCrestColor.value.lerp(_crestTarget, 0.08);
    mu.uReefWaterColor.value.lerp(_reefTarget, 0.08);
    mu.uFoamColor.value.lerp(_foamTarget, 0.08);
    mu.uFoamMint.value.lerp(_mintTarget, 0.08);
    mu.uSeasonFrost.value += (targetFrost - mu.uSeasonFrost.value) * 0.12;
  };

  const updateZones = (colorData: Uint8Array, idData: Uint8Array, anyActive: boolean) => {
    material.uniforms.uZoneActive.value = anyActive ? 1 : 0;
    if (anyActive) {
      zoneColorBytes.set(colorData);
      zoneIdBytes.set(idData);
      zoneColorTex.needsUpdate = true;
      zoneIdTex.needsUpdate = true;
    }
  };

  const dispose = () => {
    geo.dispose();
    material.dispose();
    waterMapTex.dispose();
    zoneColorTex.dispose();
    zoneIdTex.dispose();
  };

  return { mesh, updateMap, updateZones, updateFrame, dispose };
}

export interface DynamicWaterMaterialHandle {
  material: THREE.ShaderMaterial;
  updateFrame: (elapsed: number, preset: LightingPreset, seasonWeights?: THREE.Vector4) => void;
  dispose: () => void;
}

/**
 * Living pixel-art dynamic water shader matching `createOceanFoamSystem`:
 * - Top surfaces: depth-layered turquoise-to-sapphire pools, directional downhill current streaks,
 *   calm lake breeze wavelets, dancing sun sparkles, animated shoreline/basin-rim foam, and winter frost.
 * - Vertical walls: animated downward-rushing waterfall curtains, whitewater ribbons, and splash mist.
 */
export function createDynamicWaterMaterial(): DynamicWaterMaterialHandle {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uShallowColor: { value: new THREE.Color('#2896ab') },
      uDeepColor: { value: new THREE.Color('#193f54') },
      uCrestColor: { value: new THREE.Color('#5ce1e6') },
      uReefWaterColor: { value: new THREE.Color('#12d6df') },
      uFoamColor: { value: new THREE.Color('#f4fbff') },
      uFoamMint: { value: new THREE.Color('#9ee6f5') },
      uSeasonFrost: { value: 0.0 },
    },
  ]);

  const material = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aDepth;
      attribute float aEdgeMask;
      attribute vec2 aFlowDir;

      uniform float uTime;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vDepth;
      varying float vEdgeMask;
      varying vec2 vFlowDir;
      varying vec2 vUv;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vec3 worldNormal = normalize(mat3(modelMatrix) * normal);

        // Gentle pixel-art surface swell on horizontal water tops (keeps waterfall walls anchored cleanly)
        if (worldNormal.y > 0.5) {
          float flowMag = length(aFlowDir);
          float phase = dot(worldPos.xz, flowMag > 0.05 ? aFlowDir * 1.4 : vec2(0.55, 0.42));
          float swell = sin(phase - uTime * (2.2 + flowMag * 2.4)) * 0.015
                      + cos(worldPos.x * 0.65 - worldPos.z * 0.58 + uTime * 1.65) * 0.011;
          worldPos.y += swell;
        }

        vWorldPos = worldPos.xyz;
        vWorldNormal = worldNormal;
        vDepth = aDepth;
        vEdgeMask = aEdgeMask;
        vFlowDir = aFlowDir;
        vUv = uv;

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uShallowColor;
      uniform vec3 uDeepColor;
      uniform vec3 uCrestColor;
      uniform vec3 uReefWaterColor;
      uniform vec3 uFoamColor;
      uniform vec3 uFoamMint;
      uniform float uSeasonFrost;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vDepth;
      varying float vEdgeMask;
      varying vec2 vFlowDir;
      varying vec2 vUv;

      float dwHash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      float dwNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = dwHash12(i);
        float b = dwHash12(i + vec2(1.0, 0.0));
        float c = dwHash12(i + vec2(0.0, 1.0));
        float d = dwHash12(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      void main() {
        vec3 color;
        float alpha;

        if (vWorldNormal.y > 0.5) {
          // ---- TOP SURFACE: Living depth-layered lake / flowing stream ----
          vec2 pixPos = floor(vWorldPos.xz * 12.0) / 12.0;
          vec2 chunkPos = floor(vWorldPos.xz * 4.0) / 4.0;
          float depthFrac = clamp((vDepth - 0.12) / 1.45, 0.0, 1.0);

          vec3 shallowTint = mix(uShallowColor, uReefWaterColor, 0.42);
          vec3 midTint = mix(uShallowColor, uDeepColor, 0.42);
          vec3 deepTint = mix(uDeepColor, uShallowColor * 0.62, 0.18);
          color = depthFrac < 0.45
            ? mix(shallowTint, midTint, smoothstep(0.0, 0.45, depthFrac))
            : mix(midTint, deepTint, smoothstep(0.45, 1.0, depthFrac));

          float flowMag = clamp(length(vFlowDir), 0.0, 1.0);
          if (flowMag > 0.08) {
            // Directional flowing stream / spillway current ribbons
            vec2 fDir = normalize(vFlowDir);
            vec2 fPerp = vec2(-fDir.y, fDir.x);
            float along = dot(pixPos, fDir);
            float across = dot(pixPos, fPerp);
            float wobble = (dwNoise(vec2(along * 0.6 - uTime * 0.9, across * 1.4)) - 0.5) * 0.72;
            float ribA = dwNoise(vec2(along * 0.95 - uTime * 2.55, across * 3.0 + wobble));
            float ribB = dwNoise(vec2(along * 1.75 - uTime * 3.40, across * 4.8 - wobble * 0.5));
            float currentField = ribA * 0.58 + ribB * 0.42;
            float streak = step(0.58, currentField);
            float brightStreak = step(0.75, currentField);
            float sparkle = step(0.86, dwNoise(vec2(along * 3.2 - uTime * 3.8, across * 4.0)) * 0.55 + ribB * 0.45);

            color = mix(color, mix(uCrestColor, uFoamMint, 0.5), streak * 0.44 * flowMag);
            color = mix(color, uFoamColor, max(brightStreak * 0.38, sparkle * 0.58) * flowMag);
            alpha = mix(0.56, 0.84, depthFrac) + streak * 0.08 + brightStreak * 0.08;
          } else {
            // Calm enclosed pool / mountain lake: breeze wavelets, caustics & dancing sun sparkles
            float waveA = dwNoise(chunkPos * 1.15 + vec2(uTime * 0.45, uTime * 0.22));
            float waveB = dwNoise(chunkPos * 2.10 - vec2(uTime * 0.30, -uTime * 0.38));
            float caustic = step(0.62, waveA * 0.55 + waveB * 0.45);
            float ripple = step(0.76, dwNoise(pixPos * 1.85 + vec2(uTime * 0.75, -uTime * 0.52)));
            float glint = step(0.92, dwNoise(pixPos * 3.6 + vec2(uTime * 1.4, uTime * 0.9)));

            color = mix(color, uCrestColor, caustic * 0.28);
            color = mix(color, uFoamMint, ripple * 0.32);
            color = mix(color, uFoamColor, glint * 0.65);
            alpha = mix(0.54, 0.86, depthFrac) + ripple * 0.06;
          }

          // Animated pixel-art shoreline / basin-rim foam lapping against surrounding terrain walls
          if (vEdgeMask > 0.02) {
            float lapWave = sin(uTime * 2.8 + (pixPos.x + pixPos.y) * 2.4) * 0.14;
            float rimNoise = dwNoise(pixPos * 2.6 + vec2(uTime * 0.4, -uTime * 0.3));
            float mintRim = smoothstep(0.18, 0.65, vEdgeMask + lapWave * 0.5) * step(0.34, rimNoise + vEdgeMask * 0.45);
            float coreRim = smoothstep(0.52, 0.90, vEdgeMask + lapWave * 0.6) * step(0.46, rimNoise + vEdgeMask * 0.5);
            color = mix(color, uFoamMint, mintRim * 0.72);
            color = mix(color, uFoamColor, coreRim * 0.92);
            alpha = max(alpha, max(mintRim * 0.78, coreRim * 0.92));
          }

          // Winter frost/ice crust along basin rims & shallow pools
          if (uSeasonFrost > 0.01) {
            float frostN = dwNoise(pixPos * 1.5 + vec2(4.1, 8.3));
            float iceMask = clamp(max(vEdgeMask * 0.95, 0.45) * step(0.46 - uSeasonFrost * 0.25, frostN), 0.0, 1.0) * uSeasonFrost;
            vec3 iceCol = mix(uFoamMint * 0.96, uFoamColor, step(0.60, frostN));
            color = mix(color, iceCol, iceMask * 0.74);
            alpha = max(alpha, iceMask * 0.86);
          }
        } else {
          // ---- VERTICAL WALLS: Cascading whitewater waterfall curtains & splash froth ----
          float wallU = abs(vWorldNormal.x) > 0.5 ? vWorldPos.z : vWorldPos.x;
          vec2 wfPix = floor(vec2(wallU, vWorldPos.y) * 12.0) / 12.0;

          float fallA = dwNoise(vec2(wfPix.x * 3.4, wfPix.y * 2.4 + uTime * 5.2));
          float fallB = dwNoise(vec2(wfPix.x * 6.2 + 2.7, wfPix.y * 3.8 + uTime * 7.4));
          float curtain = fallA * 0.56 + fallB * 0.44;
          float foamRibbon = step(0.54, curtain);
          float brightSpray = step(0.72, curtain);

          // Frothy mist at waterfall crest (vUv.y near 1) and splash plunge base (vUv.y near 0)
          float topLip = smoothstep(0.72, 0.98, vUv.y);
          float baseSplash = smoothstep(0.28, 0.0, vUv.y) * (0.72 + 0.28 * sin(uTime * 8.0 + wfPix.x * 6.0));

          color = mix(uShallowColor, uCrestColor, 0.52);
          color = mix(color, uFoamMint, foamRibbon * 0.76);
          color = mix(color, uFoamColor, clamp(brightSpray * 0.88 + topLip * 0.65 + baseSplash * 0.92, 0.0, 1.0));
          if (uSeasonFrost > 0.01) {
            color = mix(color, uFoamColor, uSeasonFrost * 0.35);
          }
          alpha = clamp(0.74 + foamRibbon * 0.14 + baseSplash * 0.12 + topLip * 0.10, 0.0, 0.96);
        }

        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.96));
        #include <fog_fragment>
      }
    `,
  });

  const _shallowTarget = new THREE.Color('#2896ab');
  const _deepTarget = new THREE.Color('#193f54');
  const _crestTarget = new THREE.Color('#5ce1e6');
  const _reefTarget = new THREE.Color('#12d6df');
  const _foamTarget = new THREE.Color('#f4fbff');
  const _mintTarget = new THREE.Color('#9ee6f5');

  const updateFrame = (
    elapsed: number,
    preset: LightingPreset,
    seasonWeights?: THREE.Vector4,
  ) => {
    const mu = material.uniforms;
    mu.uTime.value = wrapShaderTime(elapsed);

    if (preset === 'midnight') {
      _shallowTarget.set('#102b3a');
      _deepTarget.set('#06131d');
      _crestTarget.set('#1d4b63');
      _reefTarget.set('#135d6e');
      _foamTarget.set('#8db2cc');
      _mintTarget.set('#3f6b85');
    } else if (preset === 'night') {
      _shallowTarget.set('#1a4357');
      _deepTarget.set('#0c212e');
      _crestTarget.set('#2c6680');
      _reefTarget.set('#187b8a');
      _foamTarget.set('#b8d6ea');
      _mintTarget.set('#5c8fa8');
    } else if (preset === 'dusk') {
      _shallowTarget.set('#376478');
      _deepTarget.set('#1f384d');
      _crestTarget.set('#d9886c');
      _reefTarget.set('#29b3b8');
      _foamTarget.set('#ffe9dc');
      _mintTarget.set('#b3c4d4');
    } else if (preset === 'dawn') {
      _shallowTarget.set('#387487');
      _deepTarget.set('#1d4459');
      _crestTarget.set('#e8a3a0');
      _reefTarget.set('#2ccbd0');
      _foamTarget.set('#fff3f0');
      _mintTarget.set('#b5dfe8');
    } else {
      _shallowTarget.set('#2896ab');
      _deepTarget.set('#193f54');
      _crestTarget.set('#5ce1e6');
      _reefTarget.set('#12d6df');
      _foamTarget.set('#f4fbff');
      _mintTarget.set('#9ee6f5');
    }

    let targetFrost = 0.0;
    if (seasonWeights) {
      const wSpr = seasonWeights.x;
      const wSum = seasonWeights.y;
      const wAut = seasonWeights.z;
      const wWin = seasonWeights.w;
      const pSpr = SEASON_WATER_PROFILES.spring;
      const pSum = SEASON_WATER_PROFILES.summer;
      const pAut = SEASON_WATER_PROFILES.autumn;
      const pWin = SEASON_WATER_PROFILES.winter;

      const applyTint = (
        c: THREE.Color,
        a: [number, number, number],
        b: [number, number, number],
        d: [number, number, number],
        e: [number, number, number],
      ) => {
        const r = a[0] * wSpr + b[0] * wSum + d[0] * wAut + e[0] * wWin;
        const g = a[1] * wSpr + b[1] * wSum + d[1] * wAut + e[1] * wWin;
        const bl = a[2] * wSpr + b[2] * wSum + d[2] * wAut + e[2] * wWin;
        c.setRGB(Math.min(1.0, c.r * r), Math.min(1.0, c.g * g), Math.min(1.0, c.b * bl));
      };

      applyTint(_shallowTarget, pSpr.shallowTint, pSum.shallowTint, pAut.shallowTint, pWin.shallowTint);
      applyTint(_deepTarget, pSpr.deepTint, pSum.deepTint, pAut.deepTint, pWin.deepTint);
      applyTint(_crestTarget, pSpr.crestTint, pSum.crestTint, pAut.crestTint, pWin.crestTint);
      applyTint(_foamTarget, pSpr.foamTint, pSum.foamTint, pAut.foamTint, pWin.foamTint);
      targetFrost =
        pSpr.frostStrength * wSpr +
        pSum.frostStrength * wSum +
        pAut.frostStrength * wAut +
        pWin.frostStrength * wWin;
    }

    mu.uShallowColor.value.lerp(_shallowTarget, 0.08);
    mu.uDeepColor.value.lerp(_deepTarget, 0.08);
    mu.uCrestColor.value.lerp(_crestTarget, 0.08);
    mu.uReefWaterColor.value.lerp(_reefTarget, 0.08);
    mu.uFoamColor.value.lerp(_foamTarget, 0.08);
    mu.uFoamMint.value.lerp(_mintTarget, 0.08);
    mu.uSeasonFrost.value += (targetFrost - mu.uSeasonFrost.value) * 0.12;
  };

  const dispose = () => {
    material.dispose();
  };

  return { material, updateFrame, dispose };
}

export interface StyledTerrainSystem {
  getMaterials: (terrain: TerrainType) => THREE.MeshStandardMaterial[];
  /** Unified lossless materials for greedy-meshed 32x32 terrain chunks (1 top + 1 cliff + single-draw unifiedMat) */
  getChunkMaterials: () => {
    topMat: THREE.MeshStandardMaterial;
    cliffMat: THREE.MeshStandardMaterial;
    unifiedMat: THREE.MeshStandardMaterial;
  };
  updateMap: (
    tiles: TileData[],
    buildings?: BuildingEntity[],
    settlementSpecies?: Record<string, SpeciesId>,
    waterChanged?: boolean,
  ) => void;
  updateZones: (colorData: Uint8Array, idData: Uint8Array, anyActive: boolean) => void;
  updateFrame: (
    elapsed: number,
    epochIndex?: number,
    preset?: LightingPreset,
    cyclePhase01?: number,
    seasonWeights?: THREE.Vector4,
  ) => void;
  dispose: () => void;
}

const STYLED_TERRAIN_CODE: Record<TerrainType, number> = {
  deep_water: 0,
  shallow_water: 1,
  sand: 2,
  grass: 3,
  fertile: 4,
  forest: 5,
  savanna: 6,
  swamp: 7,
  highland: 8,
  stone_road: 9,
  rock: 10,
  snow: 11,
  scorched: 12,
  crystal_field: 13,
  rail_track: 14,
  jungle: 15,
  mountain: 16,
  taiga: 17,
  tundra: 18,
  badlands: 19,
  blossom: 20,
  runway: 21,
  void_goo: 22,
  ice: 23,
  volcanic_wasteland: 24,
  blighted_mire: 25,
  floral_plains: 26,
};

export function createStyledTerrainSystem(gridSize: number): StyledTerrainSystem {
  // RGBA DataTexture storing per-tile terrain info:
  // R = terrain code * 8 (supports up to 31 biomes)
  // G = height * 20 (supports elevation 0..12)
  // B = deterministic spatial hash (0..255)
  // A = 255 if cultivated farm plot
  const data = new Uint8Array(gridSize * gridSize * 4);
  const landMapTex = new THREE.DataTexture(data, gridSize, gridSize, THREE.RGBAFormat);
  landMapTex.magFilter = THREE.NearestFilter;
  landMapTex.minFilter = THREE.NearestFilter;
  landMapTex.wrapS = THREE.ClampToEdgeWrapping;
  landMapTex.wrapT = THREE.ClampToEdgeWrapping;
  landMapTex.flipY = false;

  const zoneColorBytes = new Uint8Array(gridSize * gridSize * 4);
  const zoneColorTex = new THREE.DataTexture(zoneColorBytes, gridSize, gridSize, THREE.RGBAFormat);
  zoneColorTex.magFilter = THREE.NearestFilter;
  zoneColorTex.minFilter = THREE.NearestFilter;
  zoneColorTex.wrapS = THREE.ClampToEdgeWrapping;
  zoneColorTex.wrapT = THREE.ClampToEdgeWrapping;
  zoneColorTex.flipY = false;

  const zoneIdBytes = new Uint8Array(gridSize * gridSize * 4);
  const zoneIdTex = new THREE.DataTexture(zoneIdBytes, gridSize, gridSize, THREE.RGBAFormat);
  zoneIdTex.magFilter = THREE.NearestFilter;
  zoneIdTex.minFilter = THREE.NearestFilter;
  zoneIdTex.wrapS = THREE.ClampToEdgeWrapping;
  zoneIdTex.wrapT = THREE.ClampToEdgeWrapping;
  zoneIdTex.flipY = false;

  const cityLightBytes = new Uint8Array(gridSize * gridSize * 4);
  const cityLightTex = new THREE.DataTexture(
    cityLightBytes,
    gridSize,
    gridSize,
    THREE.RGBAFormat,
  );
  cityLightTex.magFilter = THREE.LinearFilter;
  cityLightTex.minFilter = THREE.LinearFilter;
  cityLightTex.wrapS = THREE.ClampToEdgeWrapping;
  cityLightTex.wrapT = THREE.ClampToEdgeWrapping;
  cityLightTex.flipY = false;

  const sharedTime = { value: 0 };
  const sharedEpoch = { value: 0 };
  const sharedGridSize = { value: gridSize };
  const sharedLandMap = { value: landMapTex };
  const sharedZoneColorMap = { value: zoneColorTex };
  const sharedZoneIdMap = { value: zoneIdTex };
  const sharedZoneActive = { value: 0 };
  const sharedCityLightMap = { value: cityLightTex };
  const sharedDarkness = { value: 0.0 };
  const sharedSunDir = { value: new THREE.Vector3(0.38, 0.88, 0.26).normalize() };
  const sharedSunTint = { value: new THREE.Vector3(1.02, 1.0, 0.98) };
  const sharedShadowTint = { value: new THREE.Vector3(0.82, 0.88, 0.95) };
  const sharedSeasonWeights = { value: new THREE.Vector4(0.0, 1.0, 0.0, 0.0) };

  const glslHelpers = `
    uniform float uTime;
    uniform float uEpoch;
    uniform float uGridSize;
    uniform sampler2D uLandMap;
    uniform sampler2D uZoneColorMap;
    uniform sampler2D uZoneIdMap;
    uniform float uZoneActive;
    uniform sampler2D uCityLightMap;
    uniform float uDarkness;
    uniform vec3 uSunDir;
    uniform vec3 uSunTint;
    uniform vec3 uShadowTint;
    uniform vec4 uSeasonWeights;
    varying vec3 vLandWorldPos;
    varying vec3 vLandWorldNormal;

    vec2 tileCoordFallback(vec2 pixPos) {
      return floor(pixPos);
    }

    float landHash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float landNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float a = landHash12(i);
      float b = landHash12(i + vec2(1.0, 0.0));
      float c = landHash12(i + vec2(0.0, 1.0));
      float d = landHash12(i + vec2(1.0, 1.0));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    vec3 landSrgb(float r, float g, float b) {
      return pow(vec3(r, g, b) / 255.0, vec3(2.2));
    }

    vec4 sampleLandTile(vec2 coord) {
      vec2 clamped = clamp(coord, vec2(0.0), vec2(uGridSize - 1.0));
      return texture2D(uLandMap, (clamped + 0.5) / uGridSize);
    }

    vec4 sampleLandZoneColor(vec2 coord) {
      vec2 clamped = clamp(coord, vec2(0.0), vec2(uGridSize - 1.0));
      return texture2D(uZoneColorMap, (clamped + 0.5) / uGridSize);
    }

    vec4 sampleLandZoneId(vec2 coord) {
      vec2 clamped = clamp(coord, vec2(0.0), vec2(uGridSize - 1.0));
      return texture2D(uZoneIdMap, (clamped + 0.5) / uGridSize);
    }

    vec4 sampleCityLightSmooth(vec2 gridPos) {
      vec2 clamped = clamp(gridPos, vec2(0.5), vec2(uGridSize - 0.5));
      return texture2D(uCityLightMap, clamped / uGridSize);
    }

    float decodeHeight(vec4 t) {
      return floor(t.g * 255.0 / 20.0 + 0.5);
    }

    float decodeTerrain(vec4 t) {
      return floor(t.r * 255.0 / 8.0 + 0.5);
    }

    vec3 applySeasonalCliffColor(
      vec3 cliffCol,
      bool isEarthBank,
      bool isSwampWall,
      bool isMountainWall,
      bool isVoidWall,
      bool isCraterWall,
      bool isBlightWall,
      bool isSandWall,
      bool isBadlandsWall,
      bool isUrbanRetainingWall,
      float distFromTop,
      float lipJitter,
      float pixGrain
    ) {
      float wAut = uSeasonWeights.z;
      float wWin = uSeasonWeights.w;
      if (isVoidWall || isCraterWall || isBlightWall || isUrbanRetainingWall) {
        return cliffCol;
      }
      // Autumn warms turf overhang on earth/swamp banks
      if (wAut > 0.01 && (isEarthBank || isSwampWall) && distFromTop < 0.11 + lipJitter) {
        vec3 autTurf = mix(landSrgb(148.0, 96.0, 42.0), landSrgb(184.0, 126.0, 54.0), step(0.45, pixGrain));
        cliffCol = mix(cliffCol, autTurf, wAut * 0.78);
      }
      // Winter adds crisp pixel snow-lip overhang along top of earth banks, swamp banks, and mountain ledges
      if (wWin > 0.01 && !isSandWall && !isBadlandsWall) {
        float lipDepth = (isEarthBank || isMountainWall ? 0.14 : 0.10) + lipJitter * 1.25;
        if (distFromTop < lipDepth) {
          vec3 snowLip = mix(landSrgb(188.0, 210.0, 228.0), landSrgb(242.0, 249.0, 255.0), step(0.42, pixGrain));
          float lipMix = smoothstep(lipDepth, lipDepth * 0.25, distFromTop) * wWin * 0.92;
          cliffCol = mix(cliffCol, snowLip, lipMix);
        } else if (isMountainWall) {
          cliffCol = mix(cliffCol, cliffCol * vec3(0.92, 0.97, 1.06), wWin * 0.55);
        }
      }
      return cliffCol;
    }

    vec3 computeCityNightGlow(
      vec2 pixPos,
      vec2 tileCoord,
      vec2 subUv,
      float myCode,
      float tTime,
      float epochVal,
      float darknessVal
    ) {
      if (darknessVal <= 0.03) return vec3(0.0);
      vec4 cl = sampleCityLightSmooth(pixPos);
      float bldHeat = cl.r;
      float roadHeat = cl.g;
      float specCode = cl.b;
      float centerFlag = cl.a;

      if (bldHeat < 0.02 && roadHeat < 0.02 && abs(myCode - 9.0) > 0.5 && abs(myCode - 14.0) > 0.5 && abs(myCode - 21.0) > 0.5) {
        return vec3(0.0);
      }

      float nightStrength = pow(clamp(darknessVal, 0.0, 1.0), 0.78);
      float tileHash = landHash12(tileCoord);
      bool isElfSpec = specCode > 0.45 && specCode < 0.78;
      bool isOrcSpec = specCode >= 0.78;

      // Pixel-stepped radial falloff for crisp pixel-art light pools
      float steppedBld = floor(bldHeat * 5.0 + 0.35) / 5.0;
      float steppedRoad = floor(roadHeat * 4.0 + 0.3) / 4.0;

      if (epochVal < 0.5) {
        // PREHISTORIC / STONE AGE: Flickering warm campfires, hearth bonfires & wooden fire-torches
        float flicker = 0.82 + 0.18 * sin(tTime * 13.0 + tileHash * 6.2831) * cos(tTime * 19.0 + tileCoord.x);
        vec3 fireCore = isElfSpec
          ? landSrgb(82.0, 242.0, 200.0)
          : isOrcSpec
            ? landSrgb(255.0, 72.0, 20.0)
            : landSrgb(255.0, 183.0, 3.0);
        vec3 fireOuter = isElfSpec
          ? landSrgb(32.0, 168.0, 140.0)
          : isOrcSpec
            ? landSrgb(198.0, 38.0, 12.0)
            : landSrgb(245.0, 110.0, 22.0);
        // Sub-tile flickering ember hearth spot near hut/bonfire center
        float distCenter = length(subUv - vec2(0.5));
        float hearthSpot = centerFlag > 0.4 ? smoothstep(0.46, 0.08, distCenter) : 0.0;
        float pool = clamp(steppedBld * 0.95 + steppedRoad * 0.45 + hearthSpot * 0.65, 0.0, 1.35) * flicker;
        vec3 fireCol = mix(fireOuter, fireCore, clamp(bldHeat * 0.75 + hearthSpot * 0.6, 0.0, 1.0));
        return fireCol * pool * nightStrength * 0.88;
      } else if (epochVal < 2.5) {
        // BRONZE & MEDIEVAL AGES: Flaming iron braziers, wall torches, lantern posts & candlelit windows
        float torchFlicker = 0.88 + 0.12 * sin(tTime * 9.5 + tileHash * 6.2831);
        vec3 lanternCore = isElfSpec
          ? landSrgb(100.0, 245.0, 214.0)
          : isOrcSpec
            ? landSrgb(255.0, 94.0, 36.0)
            : landSrgb(255.0, 204.0, 84.0);
        vec3 lanternWarm = isElfSpec
          ? landSrgb(46.0, 196.0, 182.0)
          : isOrcSpec
            ? landSrgb(214.0, 52.0, 18.0)
            : landSrgb(242.0, 138.0, 36.0);
        float streetSpot = 0.0;
        if (abs(myCode - 9.0) < 0.5) {
          float dCornerA = length(subUv - vec2(0.22, 0.22));
          float dCornerB = length(subUv - vec2(0.78, 0.78));
          streetSpot = max(smoothstep(0.42, 0.06, dCornerA), smoothstep(0.42, 0.06, dCornerB)) * 0.85;
        }
        float pool = clamp(steppedBld * 0.92 + steppedRoad * 0.55 + streetSpot, 0.0, 1.4) * torchFlicker;
        vec3 col = mix(lanternWarm, lanternCore, clamp(bldHeat * 0.6 + streetSpot * 0.7, 0.0, 1.0));
        return col * pool * nightStrength * 0.90;
      } else if (epochVal < 3.5) {
        // INDUSTRIAL AGE: Cast-iron Victorian gaslight lampposts along streets, railway lamps & foundry furnace glow
        float gasHum = 0.95 + 0.05 * sin(tTime * 7.0 + tileHash * 6.2831);
        vec3 gasGold = isElfSpec
          ? landSrgb(114.0, 239.0, 221.0)
          : isOrcSpec
            ? landSrgb(255.0, 118.0, 44.0)
            : landSrgb(255.0, 214.0, 102.0);
        vec3 gasAmber = isElfSpec
          ? landSrgb(64.0, 192.0, 178.0)
          : isOrcSpec
            ? landSrgb(218.0, 62.0, 24.0)
            : landSrgb(245.0, 158.0, 42.0);
        float lampPool = 0.0;
        if (abs(myCode - 9.0) < 0.5 || abs(myCode - 14.0) < 0.5) {
          float dLamp1 = length(subUv - vec2(0.18, 0.25));
          float dLamp2 = length(subUv - vec2(0.82, 0.75));
          lampPool = max(smoothstep(0.45, 0.05, dLamp1), smoothstep(0.45, 0.05, dLamp2)) * 0.95;
        }
        float pool = clamp(steppedBld * 0.95 + steppedRoad * 0.62 + lampPool, 0.0, 1.45) * gasHum;
        vec3 col = mix(gasAmber, gasGold, clamp(lampPool * 0.8 + bldHeat * 0.5, 0.0, 1.0));
        return col * pool * nightStrength * 0.94;
      } else if (epochVal < 5.5) {
        // MODERN / ATOMIC & INFORMATION AGES: Bright sodium/LED streetlamps, lit highway lanes, skyscraper block glow & neon
        bool isInfo = epochVal >= 4.5;
        vec3 streetCol = isElfSpec
          ? landSrgb(128.0, 255.0, 230.0)
          : isOrcSpec
            ? landSrgb(255.0, 136.0, 56.0)
            : isInfo
              ? landSrgb(224.0, 242.0, 254.0)
              : landSrgb(255.0, 232.0, 156.0);
        vec3 cityBlockCol = isElfSpec
          ? landSrgb(72.0, 202.0, 228.0)
          : isOrcSpec
            ? landSrgb(255.0, 84.0, 33.0)
            : isInfo
              ? mix(landSrgb(255.0, 214.0, 120.0), landSrgb(86.0, 207.0, 225.0), step(0.5, tileHash))
              : landSrgb(255.0, 198.0, 92.0);
        float streetCone = 0.0;
        vec3 neonPlazaCol = streetCol;
        if (abs(myCode - 9.0) < 0.5) {
          float dL1 = length(subUv - vec2(0.20, 0.22));
          float dL2 = length(subUv - vec2(0.80, 0.78));
          streetCone = max(smoothstep(0.48, 0.04, dL1), smoothstep(0.48, 0.04, dL2));
          if (isInfo) {
            // Vibrant Times Square / Shibuya Scramble Broadway-Tokyo corner neon spill
            float cycle = fract(tileHash * 3.7 + floor(tTime * 1.4) * 0.25);
            vec3 tsNeon = isElfSpec
              ? mix(landSrgb(82.0, 242.0, 200.0), landSrgb(160.0, 232.0, 255.0), step(0.5, cycle))
              : isOrcSpec
                ? mix(landSrgb(255.0, 72.0, 32.0), landSrgb(255.0, 196.0, 48.0), step(0.5, cycle))
                : cycle < 0.34
                  ? landSrgb(56.0, 214.0, 245.0)
                  : cycle < 0.68
                    ? landSrgb(245.0, 76.0, 178.0)
                    : landSrgb(255.0, 214.0, 76.0);
            float cornerMask = step(0.58, max(abs(subUv.x - 0.5), abs(subUv.y - 0.5)) * 2.0);
            neonPlazaCol = mix(streetCol, tsNeon, 0.55 + cornerMask * 0.35);
            streetCone = max(streetCone, cornerMask * 0.65);
          }
        } else if (abs(myCode - 21.0) < 0.5) {
          // Runway centerline & edge night lighting
          float across = min(abs(subUv.x - 0.5), abs(subUv.y - 0.5));
          streetCone = step(across, 0.05) * 0.85 + step(abs(across - 0.36), 0.04) * 0.95;
        }
        float pool = clamp(steppedBld * 1.05 + steppedRoad * 0.68 + streetCone * 0.95, 0.0, 1.55);
        vec3 col = mix(cityBlockCol, neonPlazaCol, clamp(streetCone * 0.78 + steppedRoad * 0.35, 0.0, 1.0));
        return col * pool * nightStrength * 0.98;
      } else {
        // ORBITAL & INTERSTELLAR AGES: Bioluminescent arcology grids, cyan/gold plasma conduits & star-city halos
        float pulse = 0.92 + 0.08 * sin(tTime * 3.4 + (tileCoord.x + tileCoord.y) * 0.5);
        vec3 neonPrimary = isElfSpec
          ? landSrgb(82.0, 242.0, 200.0)
          : isOrcSpec
            ? landSrgb(255.0, 84.0, 33.0)
            : landSrgb(86.0, 207.0, 225.0);
        vec3 neonAccent = isElfSpec
          ? landSrgb(255.0, 218.0, 118.0)
          : isOrcSpec
            ? landSrgb(255.0, 183.0, 3.0)
            : landSrgb(255.0, 214.0, 102.0);
        float gridLine = 0.0;
        if (abs(myCode - 9.0) < 0.5 || abs(myCode - 14.0) < 0.5) {
          gridLine = 0.85;
        } else if (bldHeat > 0.25) {
          float borderRim = max(step(0.88, abs(subUv.x - 0.5) * 2.0), step(0.88, abs(subUv.y - 0.5) * 2.0));
          gridLine = borderRim * 0.45;
        }
        float pool = clamp(steppedBld * 1.08 + steppedRoad * 0.75 + gridLine * 0.65, 0.0, 1.6) * pulse;
        vec3 col = mix(neonPrimary, neonAccent, clamp(centerFlag * 0.55 + gridLine * 0.4, 0.0, 1.0));
        return col * pool * nightStrength;
      }
    }

  `;

  const topOnlyGlslHelpers = `
    vec3 computeBaseBiomeColor(float code, vec2 pixPos, vec2 chunkPos, vec2 subUv, float tTime, bool isCultivatedFarm) {
      float waveA = landNoise(chunkPos * 0.42);
      float waveB = landNoise(chunkPos * 0.92 + vec2(11.3, 7.1));
      float detail = landHash12(pixPos * 16.0);
      float patchVal = waveA * 0.62 + waveB * 0.38;

      if (code < 0.5) {
        // Deep Sea floor: abyssal marine slate & navy trench sediment
        vec3 base = landSrgb(16.0, 38.0, 58.0);
        vec3 hi   = landSrgb(26.0, 56.0, 82.0);
        vec3 sh   = landSrgb(10.0, 26.0, 42.0);
        vec3 c = mix(sh, base, step(0.34, patchVal));
        return mix(c, hi, step(0.68, patchVal));
      } else if (code < 1.5) {
        // Shallow Water seabed: warm sunlit tropical coral sand & shell ripples shining through translucent lagoon water
        float ripple = sin((pixPos.x + pixPos.y * 0.7) * 3.8 + waveA * 3.0) * 0.5 + 0.5;
        vec3 base = landSrgb(222.0, 208.0, 166.0);
        vec3 hi   = landSrgb(242.0, 228.0, 188.0);
        vec3 sh   = landSrgb(192.0, 178.0, 138.0);
        vec3 c = mix(sh, base, step(0.32, patchVal + ripple * 0.14));
        c = mix(c, hi, step(0.68, patchVal + ripple * 0.16));
        if (detail > 0.92) c = mix(c, hi, 0.65);
        return c;
      } else if (code < 2.5) {
        // Sand: wind-rippled desert/beach dunes
        float ripple = sin((pixPos.x + pixPos.y * 0.65) * 4.2 + waveA * 3.5) * 0.5 + 0.5;
        vec3 base = landSrgb(203.0, 180.0, 141.0);
        vec3 hi   = landSrgb(228.0, 211.0, 178.0);
        vec3 sh   = landSrgb(169.0, 145.0, 110.0);
        vec3 c = mix(sh, base, step(0.32, patchVal + ripple * 0.16));
        return mix(c, hi, step(0.68, patchVal + ripple * 0.18));
      } else if (code < 3.5) {
        // Grass: lush undulating wind-swept pixel meadow bands
        float wind = sin(pixPos.x * 0.75 + pixPos.y * 0.45 - tTime * 1.45) * 0.08;
        vec3 base = landSrgb(104.0, 142.0, 84.0);
        vec3 hi   = landSrgb(138.0, 178.0, 108.0);
        vec3 sh   = landSrgb(77.0, 109.0, 62.0);
        vec3 c = mix(sh, base, step(0.34, patchVal));
        c = mix(c, hi, step(0.62, patchVal + wind));
        if (detail > 0.91) c = mix(c, hi, 0.75);
        return c;
      } else if (code < 4.5) {
        // Cultivated city farm plots evolve across ages; untouched river valleys remain lush wildflower meadows
        if (isCultivatedFarm && uEpoch >= 5.5) {
          // Orbital & Interstellar Ages: Techno-modern hydroponic bio-agri deck with glowing cyan/emerald nutrient channels
          vec2 fPix = floor(subUv * 16.0);
          float border = step(fPix.x, 1.0) + step(14.0, fPix.x) + step(fPix.y, 1.0) + step(14.0, fPix.y);
          float channel = step(abs(fPix.y - 7.5), 1.0);
          float pulse = 0.65 + 0.35 * sin(tTime * 2.8 + (pixPos.x + pixPos.y) * 1.2);
          vec3 deckCol = landSrgb(36.0, 50.0, 60.0);
          vec3 bioGreen = landSrgb(68.0, 186.0, 134.0);
          vec3 cyanGlow = landSrgb(86.0, 207.0, 225.0);
          vec3 c = mix(bioGreen, deckCol, clamp(border, 0.0, 1.0) * 0.85);
          return mix(c, cyanGlow, channel * (0.65 + 0.35 * pulse));
        } else if (isCultivatedFarm && uEpoch >= 1.0) {
          // Bronze -> Atomic Ages: Plowed agricultural crop furrows with golden wheat/grain rows
          vec2 fPix = floor(subUv * 16.0);
          float furrow = mod(fPix.y, 4.0);
          vec3 soilDark = landSrgb(92.0, 68.0, 44.0);
          vec3 cropGreen = landSrgb(112.0, 158.0, 74.0);
          vec3 wheatGold = landSrgb(224.0, 178.0, 76.0);
          vec3 c = mix(soilDark, cropGreen, step(1.5, furrow));
          return mix(c, wheatGold, step(2.8, furrow));
        } else {
          // Natural River Valley & Prehistoric Plot: Lush emerald meadow swells & wildflower speckles
          float wind = sin(pixPos.x * 0.7 + pixPos.y * 0.5 - tTime * 1.5) * 0.08;
          vec3 deep  = landSrgb(68.0, 108.0, 56.0);
          vec3 base  = landSrgb(98.0, 146.0, 74.0);
          vec3 hi    = landSrgb(138.0, 184.0, 96.0);
          vec3 c = mix(deep, base, step(0.32, patchVal));
          c = mix(c, hi, step(0.62, patchVal + wind));
          if (detail > 0.945) {
            c = landSrgb(236.0, 198.0, 92.0); // Wildflower blossom fleck
          } else if (detail < 0.035) {
            c = landSrgb(214.0, 104.0, 98.0); // Poppy/berry blossom fleck
          }
          return c;
        }
      } else if (code < 5.5) {
        // Forest: deep mossy canopy floor patches & dappled light specks
        vec3 base = landSrgb(62.0, 96.0, 68.0);
        vec3 hi   = landSrgb(88.0, 130.0, 89.0);
        vec3 sh   = landSrgb(42.0, 69.0, 48.0);
        vec3 c = mix(sh, base, step(0.38, patchVal));
        c = mix(c, hi, step(0.68, patchVal));
        if (detail > 0.89) c = mix(c, landSrgb(122.0, 106.0, 74.0), 0.5);
        return c;
      } else if (code < 6.5) {
        // Savanna: warm golden grass plains with subtle wind waves
        float wind = sin(pixPos.x * 0.65 - pixPos.y * 0.35 - tTime * 1.65) * 0.09;
        vec3 base = landSrgb(174.0, 150.0, 78.0);
        vec3 hi   = landSrgb(209.0, 184.0, 102.0);
        vec3 sh   = landSrgb(133.0, 114.0, 56.0);
        vec3 c = mix(sh, base, step(0.35, patchVal));
        return mix(c, hi, step(0.63, patchVal + wind));
      } else if (code < 7.5) {
        // Swamp: dark peat mud, algal pools & moss ripples
        float pool = step(0.64, waveA + sin(tTime * 1.1 + pixPos.x) * 0.03);
        vec3 mud  = landSrgb(56.0, 79.0, 63.0);
        vec3 moss = landSrgb(82.0, 118.0, 82.0);
        vec3 mire = landSrgb(37.0, 66.0, 64.0);
        vec3 c = mix(mud, moss, step(0.55, waveB));
        return mix(c, mire, pool * 0.82);
      } else if (code < 8.5) {
        // Highland: heather-moss stone plateaus
        vec3 base = landSrgb(95.0, 113.0, 88.0);
        vec3 hi   = landSrgb(128.0, 143.0, 108.0);
        vec3 sh   = landSrgb(66.0, 81.0, 64.0);
        vec3 c = mix(sh, base, step(0.34, patchVal));
        return mix(c, hi, step(0.65, patchVal));
      } else if (code < 9.5) {
        // Fallback road color if invoked outside neighbor-aware road path
        return landSrgb(138.0, 106.0, 72.0);
      } else if (code < 10.5) {
        // Rock: slate & granite fracture strata
        float strata = landNoise(vec2(chunkPos.x * 0.85 + chunkPos.y * 0.35, chunkPos.y * 0.85));
        vec3 base = landSrgb(89.0, 103.0, 109.0);
        vec3 hi   = landSrgb(120.0, 137.0, 143.0);
        vec3 sh   = landSrgb(58.0, 69.0, 74.0);
        vec3 c = mix(sh, base, step(0.34, strata));
        return mix(c, hi, step(0.67, strata));
      } else if (code < 11.5) {
        // Snow: glacial cyan shadows, crisp snowdrifts & ice sparkles
        float glint = step(0.955, landHash12(pixPos * 16.0 + floor(tTime * 1.5)));
        vec3 base = landSrgb(218.0, 231.0, 238.0);
        vec3 hi   = landSrgb(244.0, 250.0, 255.0);
        vec3 sh   = landSrgb(167.0, 192.0, 207.0);
        vec3 c = mix(sh, base, step(0.32, patchVal));
        c = mix(c, hi, step(0.62, patchVal));
        return mix(c, hi, glint);
      } else if (code < 12.5) {
        // Scorched: realistic pixelated volcanic crater ash, obsidian charcoal, burnt soot & glowing magma fissures
        float crackField = landNoise(chunkPos * 1.35 + vec2(3.7, 9.2));
        float fineCrack = step(0.74, waveB * 0.55 + crackField * 0.45);
        float hotCore = step(0.84, waveB * 0.55 + crackField * 0.45);
        float pulse = 0.65 + 0.35 * sin(tTime * 3.2 + pixPos.x * 2.2 + pixPos.y * 1.8);
        vec3 obsidian = landSrgb(22.0, 16.0, 18.0);
        vec3 darkAsh  = landSrgb(46.0, 35.0, 33.0);
        vec3 burntUmber = landSrgb(78.0, 48.0, 38.0);
        vec3 lavaGlow = landSrgb(255.0, 102.0, 24.0);
        vec3 lavaHot  = landSrgb(255.0, 208.0, 68.0);
        vec3 c = mix(obsidian, darkAsh, step(0.34, patchVal));
        c = mix(c, burntUmber, step(0.66, patchVal));
        if (detail > 0.88) c = mix(c, obsidian, 0.7);
        c = mix(c, lavaGlow, fineCrack * (0.75 + 0.25 * pulse));
        return mix(c, lavaHot, hotCore * pulse);
      } else if (code < 13.5) {
        // Crystal Field: fantasy luminous light-blue crystalline land with organic crystal facets & multi-colored prism sparkles (no gridlines)
        float facetA = sin(pixPos.x * 1.35 + sin(pixPos.y * 1.15) * 1.4) * 0.5 + 0.5;
        float facetB = cos((pixPos.x - pixPos.y) * 1.05 + sin(pixPos.x * 0.7) * 1.2) * 0.5 + 0.5;
        float shimmer = 0.5 + 0.5 * sin(tTime * 1.8 + facetA * 4.2 + facetB * 3.1);
        vec3 deepAzure   = landSrgb(102.0, 184.0, 235.0);
        vec3 lightBlue   = landSrgb(142.0, 216.0, 250.0);
        vec3 celesteGlow = landSrgb(190.0, 238.0, 255.0);
        vec3 icePrism    = landSrgb(224.0, 248.0, 255.0);
        vec3 c = mix(deepAzure, lightBlue, smoothstep(0.22, 0.68, waveA * 0.55 + facetA * 0.45));
        c = mix(c, celesteGlow, smoothstep(0.54, 0.82, facetB * 0.6 + waveB * 0.4));
        // Soft crystalline facet ridge highlights
        float ridge = smoothstep(0.76, 0.92, abs(facetA - facetB) + detail * 0.35);
        c = mix(c, icePrism, ridge * (0.45 + 0.35 * shimmer));
        // Multi-colored fantasy crystal flecks embedded in the light-blue ground
        if (detail > 0.87) {
          vec3 fleckCol = detail > 0.96
            ? landSrgb(244.0, 138.0, 226.0) // rose-magenta crystal fleck
            : detail > 0.93
              ? landSrgb(178.0, 142.0, 255.0) // amethyst crystal fleck
              : detail > 0.90
                ? landSrgb(255.0, 220.0, 122.0) // golden topaz crystal fleck
                : landSrgb(122.0, 245.0, 202.0); // emerald-mint crystal fleck
          c = mix(c, fleckCol, 0.62 + 0.28 * shimmer);
        }
        return c;
      } else if (code < 14.5) {
        return landSrgb(96.0, 90.0, 84.0);
      } else if (code < 15.5) {
        // Jungle (15): deep humid emerald canopy floor, fern moss & exotic tropical blossom flecks
        float wind = sin(pixPos.x * 0.8 + pixPos.y * 0.6 - tTime * 1.2) * 0.06;
        vec3 sh   = landSrgb(22.0, 58.0, 36.0);
        vec3 base = landSrgb(34.0, 88.0, 50.0);
        vec3 hi   = landSrgb(54.0, 122.0, 68.0);
        vec3 c = mix(sh, base, step(0.32, patchVal));
        c = mix(c, hi, step(0.64, patchVal + wind));
        if (detail > 0.962) c = landSrgb(242.0, 108.0, 84.0); // tropical orchid fleck
        else if (detail < 0.025) c = landSrgb(245.0, 198.0, 72.0);
        return c;
      } else if (code < 16.5) {
        // Mountain (16): sharp alpine granite ridges, basalt shadows & pale quartz veins
        float ridgeStrata = landNoise(vec2(chunkPos.x * 1.15 - chunkPos.y * 0.55, chunkPos.y * 1.15));
        vec3 sh   = landSrgb(68.0, 74.0, 84.0);
        vec3 base = landSrgb(108.0, 116.0, 126.0);
        vec3 hi   = landSrgb(154.0, 162.0, 172.0);
        vec3 c = mix(sh, base, step(0.32, ridgeStrata));
        c = mix(c, hi, step(0.66, ridgeStrata));
        if (detail > 0.93) c = landSrgb(198.0, 210.0, 220.0);
        return c;
      } else if (code < 17.5) {
        // Taiga (17): cool spruce-needle floor, damp peat & light winter frost flecks
        vec3 sh   = landSrgb(34.0, 56.0, 48.0);
        vec3 base = landSrgb(50.0, 82.0, 70.0);
        vec3 hi   = landSrgb(72.0, 108.0, 92.0);
        vec3 c = mix(sh, base, step(0.35, patchVal));
        c = mix(c, hi, step(0.67, patchVal));
        if (detail > 0.925) c = landSrgb(206.0, 224.0, 228.0);
        return c;
      } else if (code < 18.5) {
        // Tundra (18): frozen permafrost lichen, cold grey-teal gravel & frost patches
        float frost = landNoise(chunkPos * 1.1 + vec2(4.2, 8.7));
        vec3 sh   = landSrgb(92.0, 106.0, 108.0);
        vec3 base = landSrgb(134.0, 148.0, 144.0);
        vec3 hi   = landSrgb(184.0, 198.0, 196.0);
        vec3 c = mix(sh, base, step(0.34, patchVal));
        c = mix(c, hi, step(0.65, frost));
        if (detail > 0.89) c = landSrgb(224.0, 236.0, 240.0);
        return c;
      } else if (code < 19.5) {
        // Badlands (19): striated terracotta sandstone canyon, burnt sienna & golden ochre strata
        float band = landNoise(vec2(chunkPos.x * 0.55 + chunkPos.y * 0.85, chunkPos.y * 1.4));
        vec3 sh   = landSrgb(134.0, 64.0, 40.0);
        vec3 base = landSrgb(184.0, 96.0, 56.0);
        vec3 hi   = landSrgb(218.0, 138.0, 82.0);
        vec3 c = mix(sh, base, step(0.32, band));
        c = mix(c, hi, step(0.68, band));
        if (detail > 0.92) c = mix(c, landSrgb(235.0, 178.0, 118.0), 0.7);
        return c;
      } else if (code < 20.5) {
        // Blossom (20): vibrant spring green sakura grove meadow dusted with pink petals
        float petalNoise = landNoise(chunkPos * 1.25 + vec2(7.1, 2.3));
        vec3 sh   = landSrgb(72.0, 118.0, 68.0);
        vec3 base = landSrgb(102.0, 156.0, 88.0);
        vec3 hi   = landSrgb(136.0, 184.0, 106.0);
        vec3 c = mix(sh, base, step(0.34, patchVal));
        c = mix(c, hi, step(0.66, patchVal));
        if (petalNoise > 0.64 || detail > 0.88) {
          c = detail > 0.94 ? landSrgb(255.0, 226.0, 238.0) : landSrgb(246.0, 172.0, 200.0);
        }
        return c;
      } else if (code < 21.5) {
        // Runway fallback (21): dark charcoal tarmac with crisp edge sheen
        vec3 tarmac = landSrgb(43.0, 48.0, 58.0);
        vec3 tarmacSh = landSrgb(30.0, 35.0, 43.0);
        return mix(tarmacSh, tarmac, step(0.45, patchVal));
      } else if (code < 22.5) {
        // Void Goo (22): Abyssal pitch-black cosmic ooze revealing a drifting multi-layer starry sky
        vec2 spaceDriftA = floor((pixPos * 16.0 + vec2(tTime * 3.8, -tTime * 2.4)));
        vec2 spaceDriftB = floor((pixPos * 16.0 + vec2(-tTime * 2.1, tTime * 3.1)));
        float starCellA = landHash12(spaceDriftA);
        float starCellB = landHash12(spaceDriftB + vec2(37.0, 91.0));
        float nebulaWave = landNoise(pixPos * 0.48 + vec2(tTime * 0.14, -tTime * 0.11));
        float nebulaDust = landNoise(pixPos * 1.05 + vec2(-tTime * 0.22, tTime * 0.17));

        vec3 voidBlack = vec3(0.004, 0.002, 0.012);
        vec3 deepIndigo = landSrgb(16.0, 6.0, 34.0);
        vec3 cosmicViolet = landSrgb(42.0, 14.0, 74.0);
        vec3 c = mix(voidBlack, deepIndigo, smoothstep(0.38, 0.72, nebulaWave) * 0.72);
        c = mix(c, cosmicViolet, smoothstep(0.56, 0.86, nebulaDust) * 0.45);

        float twinkleA = 0.55 + 0.45 * sin(tTime * 4.2 + starCellA * 31.4);
        float twinkleB = 0.5 + 0.5 * sin(tTime * 5.6 + starCellB * 27.1);
        if (starCellA > 0.968) {
          vec3 starHue = starCellA > 0.992
            ? vec3(1.0, 0.92, 0.55)
            : starCellA > 0.980
              ? vec3(0.58, 0.90, 1.0)
              : vec3(0.92, 0.78, 1.0);
          c = mix(c, starHue, twinkleA);
        } else if (starCellB > 0.978) {
          vec3 dimStar = starCellB > 0.990 ? vec3(0.45, 0.86, 0.98) : vec3(0.76, 0.58, 0.98);
          c = mix(c, dimStar, twinkleB * 0.88);
        }
        return c;
      } else if (code < 23.5) {
        // Sea Ice (23): Frozen oceanic floes with glacial cyan facets, frost fracture seams & crisp ice glints
        float fracNoise = landNoise(vec2(chunkPos.x * 1.4 + chunkPos.y * 0.6, chunkPos.y * 1.4));
        float seam = step(0.84, abs(sin(pixPos.x * 2.4 + fracNoise * 3.1)) * abs(cos(pixPos.y * 2.4 - fracNoise * 2.5)));
        float glint = step(0.962, landHash12(pixPos * 16.0 + floor(tTime * 1.2)));
        vec3 iceDeep = landSrgb(126.0, 198.0, 224.0);
        vec3 iceBase = landSrgb(184.0, 232.0, 248.0);
        vec3 iceHi   = landSrgb(236.0, 250.0, 255.0);
        vec3 c = mix(iceDeep, iceBase, step(0.30, patchVal));
        c = mix(c, iceHi, step(0.66, fracNoise));
        c = mix(c, iceDeep, seam * 0.65);
        return mix(c, vec3(1.0), glint);
      } else if (code < 24.5) {
        // Volcanic Wasteland (24): Jagged dark basalt & pyroclastic ash plains traversed by flowing molten lava rivers & glowing magma veins
        vec2 lavaDrift = chunkPos * 0.92 + vec2(-tTime * 0.38, tTime * 0.28);
        float lavaStream = landNoise(lavaDrift);
        float fissure = landNoise(chunkPos * 1.55 + vec2(4.7, 9.1));
        float flowChannel = step(0.66, lavaStream * 0.58 + fissure * 0.42);
        float hotCore = step(0.76, lavaStream * 0.58 + fissure * 0.42);
        float whiteCore = step(0.84, lavaStream * 0.62 + fissure * 0.38);
        float pulse = 0.72 + 0.28 * sin(tTime * 3.6 + pixPos.x * 2.4 - pixPos.y * 1.9);
        vec3 basaltBlack = landSrgb(20.0, 15.0, 17.0);
        vec3 pyroSlate   = landSrgb(42.0, 31.0, 30.0);
        vec3 cinderUmber = landSrgb(72.0, 42.0, 34.0);
        vec3 magmaRed    = landSrgb(228.0, 58.0, 16.0);
        vec3 magmaOrange = landSrgb(255.0, 128.0, 24.0);
        vec3 magmaGold   = landSrgb(255.0, 224.0, 82.0);
        vec3 c = mix(basaltBlack, pyroSlate, step(0.32, patchVal));
        c = mix(c, cinderUmber, step(0.66, patchVal));
        if (detail > 0.90) c = mix(c, magmaOrange, 0.78 * pulse);
        c = mix(c, magmaRed, flowChannel * 0.92);
        c = mix(c, magmaOrange, hotCore * (0.82 + 0.18 * pulse));
        return mix(c, magmaGold, whiteCore * pulse);
      } else if (code < 25.5) {
        // Land of Blight (25): Deep dark-purple poisoned necrotic soil with glowing toxic green veins, acid pools & spore speckles
        vec2 mireDrift = chunkPos * 1.1 + vec2(tTime * 0.22, -tTime * 0.18);
        float toxNoise = landNoise(mireDrift);
        float veinNoise = landNoise(chunkPos * 1.65 + vec2(8.3, 2.9));
        float toxPool = step(0.70, toxNoise * 0.55 + veinNoise * 0.45);
        float acidCore = step(0.80, toxNoise * 0.55 + veinNoise * 0.45);
        float pulse = 0.70 + 0.30 * sin(tTime * 2.8 + (pixPos.x + pixPos.y) * 2.1);
        vec3 deepBlight  = landSrgb(28.0, 11.0, 42.0);
        vec3 purpleSoil  = landSrgb(52.0, 22.0, 74.0);
        vec3 violetCrust = landSrgb(78.0, 36.0, 106.0);
        vec3 poisonGreen = landSrgb(34.0, 197.0, 94.0);
        vec3 acidLime    = landSrgb(163.0, 230.0, 53.0);
        vec3 c = mix(deepBlight, purpleSoil, step(0.32, patchVal));
        c = mix(c, violetCrust, step(0.66, patchVal));
        if (detail > 0.91) {
          c = detail > 0.96 ? acidLime : landSrgb(147.0, 51.0, 234.0);
        }
        c = mix(c, poisonGreen, toxPool * (0.80 + 0.20 * pulse));
        return mix(c, acidLime, acidCore * pulse);
      } else {
        // Floral Plains (26): Majestic fantasy emerald-jade steppes, rich dark healthy soil & dense multi-colored blossom carpets waving in the wind
        float wind = sin(pixPos.x * 0.78 + pixPos.y * 0.52 - tTime * 1.55) * 0.09;
        float bloomWave = landNoise(chunkPos * 1.15 + vec2(5.4, 9.8));
        float bloomPatch = landNoise(chunkPos * 0.68 - vec2(3.2, 6.1));
        vec3 richLoam    = landSrgb(52.0, 108.0, 62.0);
        vec3 jadeSteppe  = landSrgb(76.0, 158.0, 88.0);
        vec3 sunlitGrass = landSrgb(124.0, 202.0, 112.0);
        vec3 goldenMeadow = landSrgb(166.0, 224.0, 118.0);
        vec3 c = mix(richLoam, jadeSteppe, step(0.28, patchVal));
        c = mix(c, sunlitGrass, step(0.54, patchVal + wind));
        c = mix(c, goldenMeadow, step(0.76, patchVal + wind));
        // Dense majestic fantasy flower carpets across the steppes
        if (bloomWave > 0.56 || detail > 0.72) {
          float flowerSeed = fract(detail * 7.13 + bloomPatch * 1.37);
          vec3 blossomCol = flowerSeed < 0.22
            ? landSrgb(255.0, 214.0, 74.0)  // Sunburst Marigold Gold
            : flowerSeed < 0.44
              ? landSrgb(244.0, 114.0, 182.0) // Royal Rose-Sakura Pink
              : flowerSeed < 0.66
                ? landSrgb(192.0, 132.0, 252.0) // Enchanted Lavender-Orchid
                : flowerSeed < 0.84
                  ? landSrgb(96.0, 218.0, 250.0) // Celestial Azure-Starflower
                  : landSrgb(255.0, 248.0, 238.0); // Ivory-Pearl Lily
          float petalMix = detail > 0.76 ? 0.92 : 0.68;
          c = mix(c, blossomCol, petalMix);
        }
        return c;
      }
    }

    vec3 applySeasonalBiomeColor(
      vec3 baseCol,
      float code,
      vec2 pixPos,
      vec2 chunkPos,
      vec2 subUv,
      float tTime,
      bool isCultivatedFarm
    ) {
      float wSpr = uSeasonWeights.x;
      float wSum = uSeasonWeights.y;
      float wAut = uSeasonWeights.z;
      float wWin = uSeasonWeights.w;

      // Skip extreme/aquatic/fantasy biomes that should keep their signature look
      if (
        code < 1.5 ||
        abs(code - 11.0) < 0.5 ||
        abs(code - 12.0) < 0.5 ||
        abs(code - 13.0) < 0.5 ||
        abs(code - 21.0) < 0.5 ||
        abs(code - 22.0) < 0.5 ||
        abs(code - 23.0) < 0.5 ||
        abs(code - 24.0) < 0.5 ||
        abs(code - 25.0) < 0.5
      ) {
        return baseCol;
      }

      float detail = landHash12(pixPos * 16.0);
      float driftNoise = landNoise(chunkPos * 0.68 + vec2(5.1, 2.9));
      float leafNoise = landNoise(chunkPos * 1.35 + vec2(17.3, 4.7));
      vec3 col = baseCol;

      bool isGrass = abs(code - 3.0) < 0.5;
      bool isFertile = abs(code - 4.0) < 0.5;
      bool isForest = abs(code - 5.0) < 0.5;
      bool isSavanna = abs(code - 6.0) < 0.5;
      bool isSwamp = abs(code - 7.0) < 0.5;
      bool isHighland = abs(code - 8.0) < 0.5;
      bool isRock = abs(code - 10.0) < 0.5;
      bool isJungle = abs(code - 15.0) < 0.5;
      bool isMountain = abs(code - 16.0) < 0.5;
      bool isTaiga = abs(code - 17.0) < 0.5;
      bool isTundra = abs(code - 18.0) < 0.5;
      bool isBlossom = abs(code - 20.0) < 0.5;
      bool isFloral = code >= 25.5;
      bool isArid = abs(code - 2.0) < 0.5 || abs(code - 19.0) < 0.5;

      // ---- SPRING: Fresh sprout-green vibrancy & blooming wildflower/petal flecks ----
      if (wSpr > 0.01) {
        vec3 sprCol = col;
        if (isGrass || (isFertile && !isCultivatedFarm) || isForest || isHighland || isBlossom || isFloral) {
          sprCol = mix(sprCol, sprCol * vec3(0.95, 1.14, 0.88) + landSrgb(12.0, 26.0, 6.0) * 0.35, 0.72);
          if (isGrass || (isFertile && !isCultivatedFarm)) {
            if (detail > 0.942) {
              sprCol = mix(sprCol, landSrgb(252.0, 224.0, 108.0), 0.90);
            } else if (detail < 0.042) {
              sprCol = mix(sprCol, landSrgb(250.0, 168.0, 206.0), 0.88);
            } else if (detail > 0.485 && detail < 0.502) {
              sprCol = mix(sprCol, landSrgb(252.0, 250.0, 240.0), 0.85);
            }
          } else if (isBlossom && (leafNoise > 0.52 || detail > 0.80)) {
            sprCol = mix(sprCol, detail > 0.90 ? landSrgb(255.0, 234.0, 244.0) : landSrgb(250.0, 164.0, 204.0), 0.88);
          }
        } else if (isFertile && isCultivatedFarm && uEpoch < 5.5) {
          // Spring cultivated farms: fresh dark loam & bright young green shoots
          vec2 fPix = floor(subUv * 16.0);
          float furrow = mod(fPix.y, 4.0);
          vec3 wetSoil = landSrgb(78.0, 56.0, 38.0);
          vec3 youngShoot = landSrgb(112.0, 192.0, 72.0);
          sprCol = mix(wetSoil, youngShoot, step(1.6, furrow));
        } else if (isSavanna) {
          sprCol = mix(sprCol, sprCol * vec3(0.92, 1.10, 0.84), 0.65);
        } else if (isTaiga || isTundra) {
          sprCol = mix(sprCol, sprCol * vec3(0.94, 1.09, 0.95), 0.55);
        }
        col = mix(col, sprCol, wSpr);
      }

      // ---- SUMMER: Warm sun-drenched saturation boost ----
      if (wSum > 0.01 && (isGrass || isFertile || isForest || isSavanna || isJungle)) {
        vec3 sumCol = col * vec3(1.04, 1.02, 0.92);
        col = mix(col, sumCol, wSum * 0.45);
      }

      // ---- AUTUMN: Warm golden-olive/russet grass, fallen crimson/amber leaf litter & harvest farms ----
      if (wAut > 0.01) {
        vec3 autCol = col;
        if (isGrass || (isFertile && !isCultivatedFarm) || isBlossom || isFloral) {
          float lum = dot(col, vec3(0.299, 0.587, 0.114));
          vec3 autSh   = landSrgb(106.0, 74.0, 34.0);
          vec3 autBase = landSrgb(164.0, 118.0, 48.0);
          vec3 autHi   = landSrgb(212.0, 162.0, 66.0);
          vec3 palette = mix(autSh, autBase, smoothstep(0.05, 0.22, lum));
          palette = mix(palette, autHi, smoothstep(0.22, 0.48, lum));
          autCol = mix(col, palette, isFloral ? 0.58 : 0.84);
          // Scattered crisp autumn leaf-litter pixels
          if (detail > 0.91 || (leafNoise > 0.66 && detail > 0.72)) {
            vec3 leafCol = detail > 0.96
              ? landSrgb(220.0, 68.0, 32.0)
              : detail > 0.93
                ? landSrgb(242.0, 152.0, 38.0)
                : landSrgb(198.0, 96.0, 30.0);
            autCol = mix(autCol, leafCol, 0.84);
          }
        } else if (isFertile && isCultivatedFarm && uEpoch < 5.5) {
          // Harvested autumn wheat & amber stubble furrows
          vec2 fPix = floor(subUv * 16.0);
          float furrow = mod(fPix.y, 4.0);
          vec3 soilDry = landSrgb(98.0, 64.0, 36.0);
          vec3 stubble = landSrgb(196.0, 134.0, 48.0);
          vec3 goldRow = landSrgb(236.0, 178.0, 64.0);
          autCol = mix(soilDry, stubble, step(1.4, furrow));
          autCol = mix(autCol, goldRow, step(2.7, furrow));
        } else if (isForest || isHighland) {
          vec3 mossRust = isForest ? landSrgb(128.0, 76.0, 34.0) : landSrgb(146.0, 102.0, 52.0);
          autCol = mix(col, mossRust, 0.72);
          if (leafNoise > 0.54 || detail > 0.82) {
            vec3 leafCol = detail > 0.93
              ? landSrgb(218.0, 62.0, 28.0)
              : detail > 0.86
                ? landSrgb(238.0, 144.0, 36.0)
                : landSrgb(176.0, 82.0, 26.0);
            autCol = mix(autCol, leafCol, 0.82);
          }
        } else if (isSavanna) {
          autCol = mix(col, landSrgb(186.0, 128.0, 52.0), 0.58);
        } else if (isSwamp) {
          autCol = mix(col, landSrgb(96.0, 76.0, 44.0), 0.56);
        } else if (isTaiga || isTundra) {
          autCol = mix(col, col * vec3(1.16, 0.96, 0.76), 0.62);
          if (detail > 0.90) autCol = mix(autCol, landSrgb(212.0, 152.0, 48.0), 0.72);
        } else if (isJungle) {
          autCol = mix(col, col * vec3(1.08, 0.96, 0.86), 0.30);
        } else if (isArid) {
          autCol = mix(col, col * vec3(1.06, 0.96, 0.88), 0.32);
        }
        col = mix(col, autCol, wAut);
      }

      // ---- WINTER: Crisp pixel-dithered snowdrifts, glacial shadows & frost glints ----
      if (wWin > 0.01) {
        float snowThreshold = 1.0;
        float maxSnowCover = 0.0;
        if (isGrass || isForest || isHighland || isBlossom || isTaiga || isTundra) {
          snowThreshold = 0.22;
          maxSnowCover = 0.95;
        } else if (isFertile) {
          snowThreshold = isCultivatedFarm ? 0.34 : 0.22;
          maxSnowCover = isCultivatedFarm ? 0.78 : 0.95;
        } else if (isFloral) {
          snowThreshold = 0.30;
          maxSnowCover = 0.82;
        } else if (isMountain || isRock) {
          snowThreshold = 0.36;
          maxSnowCover = 0.86;
        } else if (isSwamp) {
          snowThreshold = 0.48;
          maxSnowCover = 0.58;
        } else if (isSavanna) {
          snowThreshold = 0.66;
          maxSnowCover = 0.32;
        } else if (isJungle) {
          // Humid jungle resists snow; only cools slightly
          col = mix(col, col * vec3(0.88, 0.94, 1.02), wWin * 0.40);
        } else if (isArid) {
          // Desert/badlands stay dry with cool winter light
          col = mix(col, col * vec3(0.92, 0.95, 1.04), wWin * 0.35);
        }

        if (maxSnowCover > 0.01) {
          // Organic pixel-stepped snowdrift coverage that spreads cleanly as winter deepens
          float snowField = driftNoise * 0.74 + detail * 0.26;
          float coverEdge = mix(1.05, snowThreshold, smoothstep(0.05, 0.92, wWin));
          float snowMask = step(coverEdge, snowField) * smoothstep(0.06, 0.35, wWin) * maxSnowCover;
          // Frost base underneath even before full snowdrift blankets it
          vec3 frostedBase = mix(col, col * vec3(0.78, 0.86, 0.96) + landSrgb(42.0, 56.0, 72.0) * 0.35, wWin * 0.62);
          float glint = step(0.962, landHash12(pixPos * 16.0 + floor(tTime * 1.4)));
          vec3 snowSh   = landSrgb(166.0, 192.0, 212.0);
          vec3 snowBase = landSrgb(220.0, 234.0, 244.0);
          vec3 snowHi   = landSrgb(246.0, 251.0, 255.0);
          vec3 snowCol = mix(snowSh, snowBase, step(0.32, driftNoise));
          snowCol = mix(snowCol, snowHi, step(0.64, driftNoise));
          snowCol = mix(snowCol, snowHi, glint * 0.85);
          if (isFertile && isCultivatedFarm && uEpoch < 5.5) {
            // Keep faint plowed furrow lines visible beneath winter frost
            vec2 fPix = floor(subUv * 16.0);
            float furrowLine = step(mod(fPix.y, 4.0), 1.1);
            snowCol = mix(snowCol, landSrgb(138.0, 154.0, 170.0), furrowLine * 0.38);
          }
          col = mix(frostedBase, snowCol, snowMask);
        }
      }

      return col;
    }

    vec3 computeBiomeColor(float code, vec2 pixPos, vec2 chunkPos, vec2 subUv, float tTime, bool isCultivatedFarm) {
      vec3 baseCol = computeBaseBiomeColor(code, pixPos, chunkPos, subUv, tTime, isCultivatedFarm);
      return applySeasonalBiomeColor(baseCol, code, pixPos, chunkPos, subUv, tTime, isCultivatedFarm);
    }

    float sdSeg(vec2 p, vec2 a, vec2 b, out float projT) {
      vec2 pa = p - a;
      vec2 ba = b - a;
      float denom = max(dot(ba, ba), 0.0001);
      projT = clamp(dot(pa, ba) / denom, 0.0, 1.0);
      return length(pa - ba * projT);
    }

    // Evaluates minimum distance & normalized progression t along a smooth quadratic Bezier A -> M -> B
    float sdBezierCurve(vec2 p, vec2 a, vec2 m, vec2 b, out float outT, out vec2 outTang) {
      float bestD = 99.0;
      float bestT = 0.0;
      vec2 bestDir = normalize(b - a + vec2(0.0001));
      vec2 prevPt = a;
      for (int i = 1; i <= 5; i++) {
        float t = float(i) / 5.0;
        float u = 1.0 - t;
        vec2 curPt = u * u * a + 2.0 * u * t * m + t * t * b;
        float segT = 0.0;
        float d = sdSeg(p, prevPt, curPt, segT);
        if (d < bestD) {
          bestD = d;
          bestT = (float(i - 1) + segT) / 5.0;
          vec2 delta = curPt - prevPt;
          if (length(delta) > 0.0001) bestDir = normalize(delta);
        }
        prevPt = curPt;
      }
      outT = bestT;
      outTang = bestDir;
      return bestD;
    }

    vec3 computeRoadColor(
      vec2 pixPos,
      vec2 subUv,
      float tTime,
      bool rN,
      bool rS,
      bool rW,
      bool rE,
      bool rNW,
      bool rNE,
      bool rSW,
      bool rSE,
      vec3 marginCol
    ) {
      vec2 roadPix = floor(subUv * 16.0);
      vec2 rp = (roadPix + 0.5) / 16.0;

      // Clean diagonal arm flags: connect diagonals only where orthogonal corners don't already flood a boulevard
      bool diagNW = rNW && !rN && !rW;
      bool diagNE = rNE && !rN && !rE;
      bool diagSW = rSW && !rS && !rW;
      bool diagSE = rSE && !rS && !rE;

      // Detect wide 2-tile-wide Boulevards & Expressways (parallel neighboring road slabs)
      bool blvdSouth = rS && ((rW && rSW) || (rE && rSE));
      bool blvdNorth = rN && ((rW && rNW) || (rE && rNE));
      bool blvdEast  = rE && ((rN && rNE) || (rS && rSE));
      bool blvdWest  = rW && ((rN && rNW) || (rS && rSW));
      bool isWideBlvd = blvdSouth || blvdNorth || blvdEast || blvdWest;

      float cardCount = (rN ? 1.0 : 0.0) + (rS ? 1.0 : 0.0) + (rW ? 1.0 : 0.0) + (rE ? 1.0 : 0.0);
      float diagCount = (diagNW ? 1.0 : 0.0) + (diagNE ? 1.0 : 0.0) + (diagSW ? 1.0 : 0.0) + (diagSE ? 1.0 : 0.0);
      float totalConn = cardCount + diagCount;

      bool turnNE = rN && rE && !rS && !rW && !diagSW;
      bool turnNW = rN && rW && !rS && !rE && !diagSE;
      bool turnSE = rS && rE && !rN && !rW && !diagNW;
      bool turnSW = rS && rW && !rN && !rE && !diagNE;
      bool isCardTurn = turnNE || turnNW || turnSE || turnSW;

      vec2 ic = vec2(0.5);
      if (turnNE) ic = vec2(1.0, 0.0);
      else if (turnNW) ic = vec2(0.0, 0.0);
      else if (turnSE) ic = vec2(1.0, 1.0);
      else if (turnSW) ic = vec2(0.0, 1.0);

      // Smooth 2-endpoint curve fit whenever a road enters and exits cleanly via cardinals/diagonals (e.g. W -> NE, SW -> NE, N -> SE)
      bool isSmoothSpline = (abs(totalConn - 2.0) < 0.1) && !isWideBlvd && !isCardTurn && diagCount > 0.5;
      vec2 splineP0 = vec2(0.5);
      vec2 splineP2 = vec2(0.5);
      if (isSmoothSpline) {
        int foundPts = 0;
        if (rN) { if (foundPts == 0) splineP0 = vec2(0.5, 0.0); else if (foundPts == 1) splineP2 = vec2(0.5, 0.0); foundPts++; }
        if (rS) { if (foundPts == 0) splineP0 = vec2(0.5, 1.0); else if (foundPts == 1) splineP2 = vec2(0.5, 1.0); foundPts++; }
        if (rW) { if (foundPts == 0) splineP0 = vec2(0.0, 0.5); else if (foundPts == 1) splineP2 = vec2(0.0, 0.5); foundPts++; }
        if (rE) { if (foundPts == 0) splineP0 = vec2(1.0, 0.5); else if (foundPts == 1) splineP2 = vec2(1.0, 0.5); foundPts++; }
        if (diagNW) { if (foundPts == 0) splineP0 = vec2(0.0, 0.0); else if (foundPts == 1) splineP2 = vec2(0.0, 0.0); foundPts++; }
        if (diagNE) { if (foundPts == 0) splineP0 = vec2(1.0, 0.0); else if (foundPts == 1) splineP2 = vec2(1.0, 0.0); foundPts++; }
        if (diagSW) { if (foundPts == 0) splineP0 = vec2(0.0, 1.0); else if (foundPts == 1) splineP2 = vec2(0.0, 1.0); foundPts++; }
        if (diagSE) { if (foundPts == 0) splineP0 = vec2(1.0, 1.0); else if (foundPts == 1) splineP2 = vec2(1.0, 1.0); foundPts++; }
        if (foundPts < 2) {
          isSmoothSpline = false;
        }
      }

      float splineT = 0.0;
      vec2 splineTang = vec2(1.0, 0.0);
      float dRoad = 99.0;

      if (isCardTurn) {
        // True smooth circular quarter-turn instead of boxy square elbow
        dRoad = abs(length(rp - ic) - 0.5);
      } else if (isSmoothSpline) {
        dRoad = sdBezierCurve(rp, splineP0, vec2(0.5, 0.5), splineP2, splineT, splineTang);
      } else {
        float tmpT = 0.0;
        dRoad = length(rp - vec2(0.5));
        if (rN) dRoad = min(dRoad, sdSeg(rp, vec2(0.5), vec2(0.5, 0.0), tmpT));
        if (rS) dRoad = min(dRoad, sdSeg(rp, vec2(0.5), vec2(0.5, 1.0), tmpT));
        if (rW) dRoad = min(dRoad, sdSeg(rp, vec2(0.5), vec2(0.0, 0.5), tmpT));
        if (rE) dRoad = min(dRoad, sdSeg(rp, vec2(0.5), vec2(1.0, 0.5), tmpT));
        if (diagNW) dRoad = min(dRoad, sdSeg(rp, vec2(0.5), vec2(0.0, 0.0), tmpT));
        if (diagNE) dRoad = min(dRoad, sdSeg(rp, vec2(0.5), vec2(1.0, 0.0), tmpT));
        if (diagSW) dRoad = min(dRoad, sdSeg(rp, vec2(0.5), vec2(0.0, 1.0), tmpT));
        if (diagSE) dRoad = min(dRoad, sdSeg(rp, vec2(0.5), vec2(1.0, 1.0), tmpT));
      }

      // Smooth corner union for adjacent cardinal road tiles (prevents inner grass wedges at L/T junctions)
      if ((rp.x < 0.5 && rp.y < 0.5 && rN && rW) ||
          (rp.x >= 0.5 && rp.y < 0.5 && rN && rE) ||
          (rp.x < 0.5 && rp.y >= 0.5 && rS && rW) ||
          (rp.x >= 0.5 && rp.y >= 0.5 && rS && rE)) {
        dRoad = min(dRoad, 0.28);
      }

      // Interior quadrant continuity for multi-lane boulevards & plazas (all 4 corners flush)
      if ((rp.x < 0.5 && rp.y < 0.5 && rN && rW && rNW) ||
          (rp.x >= 0.5 && rp.y < 0.5 && rN && rE && rNE) ||
          (rp.x < 0.5 && rp.y >= 0.5 && rS && rW && rSW) ||
          (rp.x >= 0.5 && rp.y >= 0.5 && rS && rE && rSE)) {
        dRoad = 0.0;
      }

      // Extend paved pedestrian sidewalk apron cleanly out to 0.48 so streets never show green gaps
      if (dRoad > 0.475) {
        return marginCol;
      }

      bool isSidewalkApron = dRoad > 0.34;
      bool isStraightNS = (rN || rS) && !rW && !rE && diagCount < 0.5;
      bool isStraightWE = (rW || rE) && !rN && !rS && diagCount < 0.5;
      bool isJunction = cardCount >= 3.0 || (totalConn >= 3.0 && !isWideBlvd);
      bool isPlazaHub = (rN && rS && rW && rE) || (isWideBlvd && (cardCount >= 3.0 || totalConn >= 4.0));
      bool onCenterHub = max(abs(rp.x - 0.5), abs(rp.y - 0.5)) < 0.25;

      bool armVertical = isStraightNS ||
        (rN && rp.y < 0.5 && abs(rp.x - 0.5) <= abs(rp.y - 0.5)) ||
        (rS && rp.y >= 0.5 && abs(rp.x - 0.5) <= abs(rp.y - 0.5));
      if (isStraightWE || blvdNorth || blvdSouth) armVertical = false;
      if (blvdEast || blvdWest) armVertical = true;

      // Subtle continuous shared-median divider only along straight 2-wide expressway axis (zero checkerboard boxes!)
      float blvdMedian = 0.0;
      if (isWideBlvd && !isPlazaHub) {
        if (blvdSouth && !rN && rp.y > 0.935) blvdMedian = 1.0;
        if (blvdNorth && !rS && rp.y < 0.065) blvdMedian = 1.0;
        if (blvdEast && !rW && rp.x > 0.935) blvdMedian = 1.0;
        if (blvdWest && !rE && rp.x < 0.065) blvdMedian = 1.0;
      }

      float noiseVal = landHash12(pixPos * 16.0);

      if (uEpoch < 1.5) {
        // Prehistoric & Bronze Ages: Trodden earth & wooden boardwalk planks oriented perpendicular to road curve/axis
        vec3 dirtBase  = landSrgb(138.0, 106.0, 72.0);
        vec3 woodPlank = landSrgb(162.0, 124.0, 84.0);
        vec3 darkMud   = landSrgb(98.0, 72.0, 46.0);

        if (isSidewalkApron) {
          return mix(dirtBase, darkMud, step(0.48, noiseVal) * 0.55);
        }
        if (dRoad > 0.27) {
          return mix(dirtBase, darkMud, step(0.55, noiseVal) * 0.65);
        }

        float plankSeam = 0.0;
        if (isCardTurn) {
          float arcAng = atan(abs(rp.y - ic.y), abs(rp.x - ic.x) + 0.0001);
          plankSeam = step(0.75, fract(arcAng / 1.5707963 * 4.0));
        } else if (isSmoothSpline) {
          plankSeam = step(0.74, fract(splineT * 5.0));
        } else if (isJunction || totalConn < 0.5) {
          if (onCenterHub) {
            plankSeam = max(step(3.0, mod(roadPix.x, 4.0)), step(3.0, mod(roadPix.y, 4.0))) * 0.75;
          } else {
            plankSeam = armVertical ? step(3.0, mod(roadPix.y, 4.0)) : step(3.0, mod(roadPix.x, 4.0));
          }
        } else {
          plankSeam = armVertical ? step(3.0, mod(roadPix.y, 4.0)) : step(3.0, mod(roadPix.x, 4.0));
        }

        vec3 c = mix(woodPlank, dirtBase, step(0.78, noiseVal) * 0.45);
        return mix(c, darkMud, plankSeam * 0.72);

      } else if (uEpoch < 3.5) {
        // Classical & Industrial Ages: Dressed stone sidewalks, seamless granite curbs & oriented cobblestones
        vec3 base = landSrgb(168.0, 148.0, 130.0);
        vec3 hi   = landSrgb(202.0, 182.0, 158.0);
        vec3 sh   = landSrgb(110.0, 95.0, 82.0);
        vec3 curb = landSrgb(142.0, 128.0, 114.0);
        vec3 flagstone = landSrgb(188.0, 174.0, 154.0);

        if (isSidewalkApron) {
          float slabSeam = max(step(0.84, fract(rp.x * 4.0)), step(0.84, fract(rp.y * 4.0)));
          return mix(flagstone, sh, slabSeam * 0.45);
        }

        if (blvdMedian > 0.5) {
          return mix(curb, hi, 0.35);
        }

        if (dRoad > 0.28) {
          float curbJoint = step(0.78, fract((rp.x + rp.y) * 4.0));
          return mix(curb, sh, curbJoint * 0.55);
        }

        float mortar = 0.0;
        float toneSeed = 0.5;
        if (isCardTurn) {
          float arcR = length(rp - ic);
          float arcAng = atan(abs(rp.y - ic.y), abs(rp.x - ic.x) + 0.0001);
          float ringIdx = floor(arcR * 8.0);
          float angIdx = floor(arcAng / 1.5707963 * 6.0 + mod(ringIdx, 2.0) * 0.5);
          mortar = max(step(0.78, fract(arcR * 8.0)), step(0.80, fract(arcAng / 1.5707963 * 6.0 + mod(ringIdx, 2.0) * 0.5)));
          toneSeed = landHash12(tileCoordFallback(pixPos) + vec2(ringIdx, angIdx));
        } else if (isSmoothSpline) {
          float sIdx = floor(splineT * 6.0);
          float wIdx = floor(dRoad * 14.0);
          mortar = max(step(0.78, fract(splineT * 6.0 + mod(wIdx, 2.0) * 0.5)), step(0.80, fract(dRoad * 14.0)));
          toneSeed = landHash12(tileCoordFallback(pixPos) + vec2(sIdx, wIdx));
        } else if (isJunction || totalConn < 0.5) {
          float sqX = step(3.0, mod(roadPix.x, 4.0));
          float sqY = step(3.0, mod(roadPix.y, 4.0));
          mortar = max(sqX, sqY);
          toneSeed = landHash12(tileCoordFallback(pixPos) + floor(roadPix / 4.0));
        } else if (armVertical) {
          float rowIdx = floor(roadPix.y / 4.0);
          float colShift = mod(rowIdx, 2.0) * 4.0;
          mortar = max(step(7.0, mod(roadPix.x + colShift, 8.0)), step(3.0, mod(roadPix.y, 4.0)));
          toneSeed = landHash12(tileCoordFallback(pixPos) + vec2(rowIdx, floor((roadPix.x + colShift) / 8.0)));
        } else {
          float colIdx = floor(roadPix.x / 4.0);
          float rowShift = mod(colIdx, 2.0) * 4.0;
          mortar = max(step(3.0, mod(roadPix.x, 4.0)), step(7.0, mod(roadPix.y + rowShift, 8.0)));
          toneSeed = landHash12(tileCoordFallback(pixPos) + vec2(colIdx, floor((roadPix.y + rowShift) / 8.0)));
        }

        vec3 c = mix(base, hi, step(0.55, toneSeed));
        return mix(c, sh, mortar * 0.78);

      } else if (uEpoch < 5.5) {
        // Atomic & Information Ages: Continuous connected asphalt streets, stone/concrete sidewalks & Times Square Scramble Plazas
        bool isInfoAge = uEpoch >= 4.5;
        vec3 asphalt = isInfoAge ? landSrgb(42.0, 48.0, 56.0) : landSrgb(54.0, 60.0, 68.0);
        vec3 sidewalk = isInfoAge ? landSrgb(138.0, 146.0, 158.0) : landSrgb(126.0, 134.0, 144.0);
        vec3 curbCol = isInfoAge ? landSrgb(172.0, 182.0, 192.0) : landSrgb(150.0, 158.0, 168.0);
        vec3 laneYellow = landSrgb(245.0, 206.0, 72.0);
        vec3 markWhite  = landSrgb(236.0, 242.0, 248.0);

        if (isSidewalkApron) {
          float paverJoint = max(step(0.86, fract(rp.x * 4.0)), step(0.86, fract(rp.y * 4.0)));
          vec3 sw = mix(sidewalk, curbCol, paverJoint * 0.45);
          // Times Square / Shibuya bright illuminated neon curb accent near corners in Info Age
          if (isInfoAge && isJunction) {
            float cornerBand = step(0.62, max(abs(rp.x - 0.5), abs(rp.y - 0.5)) * 2.0);
            vec3 neonCurb = mod(floor(tTime * 1.2 + pixPos.x + pixPos.y), 2.0) < 1.0
              ? landSrgb(86.0, 207.0, 225.0)
              : landSrgb(245.0, 82.0, 178.0);
            sw = mix(sw, neonCurb, cornerBand * 0.38);
          }
          return sw;
        }

        if (blvdMedian > 0.5) {
          return laneYellow;
        }

        if (dRoad > 0.295) {
          return mix(curbCol, asphalt, 0.14);
        }

        vec3 c = mix(asphalt, landSrgb(58.0, 64.0, 74.0), step(0.86, noiseVal) * 0.45);

        if (isPlazaHub || (isInfoAge && isJunction)) {
          // Times Square / Shibuya Scramble Crossing: cardinal zebra crosswalks + diagonal scramble stripes + neon hub rim
          bool inLaneX = abs(rp.x - 0.5) < 0.28;
          bool inLaneY = abs(rp.y - 0.5) < 0.28;
          float xwalk = 0.0;
          if (rN && abs(roadPix.y - 1.5) < 0.85 && inLaneX && mod(roadPix.x, 2.0) < 1.0) xwalk = 1.0;
          if (rS && abs(roadPix.y - 13.5) < 0.85 && inLaneX && mod(roadPix.x, 2.0) < 1.0) xwalk = 1.0;
          if (rW && abs(roadPix.x - 1.5) < 0.85 && inLaneY && mod(roadPix.y, 2.0) < 1.0) xwalk = 1.0;
          if (rE && abs(roadPix.x - 13.5) < 0.85 && inLaneY && mod(roadPix.y, 2.0) < 1.0) xwalk = 1.0;

          if (isInfoAge) {
            // Shibuya diagonal X-scramble crosswalk lines across central square
            float diagD1 = abs(rp.x - rp.y);
            float diagD2 = abs(rp.x + rp.y - 1.0);
            float diagStripe = step(min(diagD1, diagD2), 0.12) * step(0.45, fract((rp.x + rp.y) * 8.0)) * step(length(rp - vec2(0.5)), 0.36);
            xwalk = max(xwalk, diagStripe * 0.88);
            // Warm gold / cyan Times Square plaza beacon medallion at intersection center
            float hubRing = step(abs(length(rp - vec2(0.5)) - 0.11), 0.032);
            c = mix(c, laneYellow, hubRing * 0.72);
          }
          return mix(c, markWhite, xwalk * 0.94);
        } else if (isWideBlvd) {
          // Smooth multi-lane expressway dashed white lane dividers inside each half of the boulevard
          bool horizBlvd = blvdSouth || blvdNorth;
          float lanePos = horizBlvd ? rp.y : rp.x;
          float alongPix = horizBlvd ? roadPix.x : roadPix.y;
          float dash = step(mod(alongPix, 4.0), 1.5);
          float whiteLane = step(abs(lanePos - 0.50), 0.036) * dash;
          return mix(c, markWhite, whiteLane * 0.90);
        } else if (totalConn < 0.5) {
          return c;
        } else if (isJunction) {
          bool inLaneX = abs(rp.x - 0.5) < 0.24;
          bool inLaneY = abs(rp.y - 0.5) < 0.24;
          float xwalk = 0.0;
          if (rN && abs(roadPix.y - 1.5) < 0.75 && inLaneX && mod(roadPix.x, 2.0) < 1.0) xwalk = 1.0;
          if (rS && abs(roadPix.y - 13.5) < 0.75 && inLaneX && mod(roadPix.x, 2.0) < 1.0) xwalk = 1.0;
          if (rW && abs(roadPix.x - 1.5) < 0.75 && inLaneY && mod(roadPix.y, 2.0) < 1.0) xwalk = 1.0;
          if (rE && abs(roadPix.x - 13.5) < 0.75 && inLaneY && mod(roadPix.y, 2.0) < 1.0) xwalk = 1.0;

          return mix(c, markWhite, xwalk * (isInfoAge ? 0.94 : 0.88));
        } else if (isCardTurn) {
          float arcDist = abs(length(rp - ic) - 0.5);
          float arcAng = atan(abs(rp.y - ic.y), abs(rp.x - ic.x) + 0.0001);
          float arcDash = step(fract(arcAng / 1.5707963 * 3.0), 0.55);
          float curveLine = step(arcDist, 0.042) * arcDash;
          float edgeLine = isInfoAge ? step(abs(arcDist - 0.22), 0.025) : 0.0;
          c = mix(c, markWhite, edgeLine * 0.42);
          return mix(c, laneYellow, curveLine * 0.92);
        } else if (isSmoothSpline) {
          float splineDash = step(fract(splineT * 4.0), 0.55);
          float curveLine = step(dRoad, 0.042) * splineDash;
          float edgeLine = isInfoAge ? step(abs(dRoad - 0.22), 0.025) : 0.0;
          c = mix(c, markWhite, edgeLine * 0.45);
          return mix(c, laneYellow, curveLine * 0.92);
        } else if (isStraightNS) {
          float dash = step(mod(roadPix.y, 4.0), 1.5);
          float endCap = step(dRoad, 0.22);
          float line = step(abs(rp.x - 0.5), 0.04) * dash * endCap;
          float edgeLine = isInfoAge ? step(abs(abs(rp.x - 0.5) - 0.23), 0.025) : 0.0;
          c = mix(c, markWhite, edgeLine * 0.45);
          return mix(c, laneYellow, line * 0.92);
        } else {
          float dash = step(mod(roadPix.x, 4.0), 1.5);
          float endCap = step(dRoad, 0.22);
          float line = step(abs(rp.y - 0.5), 0.04) * dash * endCap;
          float edgeLine = isInfoAge ? step(abs(abs(rp.y - 0.5) - 0.23), 0.025) : 0.0;
          c = mix(c, markWhite, edgeLine * 0.45);
          return mix(c, laneYellow, line * 0.92);
        }

      } else {
        // Orbital & Interstellar Ages (uEpoch >= 5.5): Continuous titanium promenade sidewalks & mag-lev transit plazas
        vec3 alloyDeck = landSrgb(38.0, 50.0, 64.0);
        vec3 alloySeam = landSrgb(24.0, 32.0, 42.0);
        vec3 alloyWalk = landSrgb(96.0, 114.0, 134.0);
        vec3 cyanNeon  = landSrgb(86.0, 207.0, 225.0);

        if (isSidewalkApron) {
          float gridBorder = max(step(0.88, fract(rp.x * 4.0)), step(0.88, fract(rp.y * 4.0)));
          return mix(alloyWalk, cyanNeon * 0.55, gridBorder * 0.45);
        }
        if (blvdMedian > 0.5) {
          return mix(cyanNeon, landSrgb(250.0, 210.0, 96.0), 0.45);
        }
        if (dRoad > 0.30) {
          return alloySeam;
        }

        float segJoint = armVertical ? step(7.0, mod(roadPix.y, 8.0)) : step(7.0, mod(roadPix.x, 8.0));
        if (isJunction && onCenterHub) segJoint = 0.0;
        vec3 c = mix(alloyDeck, alloySeam, segJoint * 0.75);

        float rail = step(abs(dRoad - 0.235), 0.038);
        float pulse = 0.0;
        float flowOffset = floor(tTime * 8.0);

        if (totalConn < 0.5) {
          pulse = step(abs(length(rp - vec2(0.5)) - 0.11), 0.04);
        } else if (isCardTurn) {
          float arcDist = abs(length(rp - ic) - 0.5);
          float arcAng = atan(abs(rp.y - ic.y), abs(rp.x - ic.x) + 0.0001);
          float arcFlow = step(0.45, fract(arcAng / 1.5707963 * 4.0 + tTime * 2.0));
          pulse = step(arcDist, 0.042) * arcFlow;
        } else if (isSmoothSpline) {
          float splineFlow = step(0.45, fract(splineT * 4.0 + tTime * 2.0));
          pulse = step(dRoad, 0.042) * splineFlow;
        } else if (isJunction || isPlazaHub) {
          float hubRing = step(abs(length(rp - vec2(0.5)) - 0.14), 0.045);
          float armPulse = 0.0;
          if (rN && rp.y < 0.34 && abs(rp.x - 0.5) < 0.04) armPulse = step(1.0, mod(roadPix.y + flowOffset, 4.0));
          if (rS && rp.y > 0.66 && abs(rp.x - 0.5) < 0.04) armPulse = step(1.0, mod(roadPix.y - flowOffset, 4.0));
          if (rW && rp.x < 0.34 && abs(rp.y - 0.5) < 0.04) armPulse = step(1.0, mod(roadPix.x + flowOffset, 4.0));
          if (rE && rp.x > 0.66 && abs(rp.y - 0.5) < 0.04) armPulse = step(1.0, mod(roadPix.x - flowOffset, 4.0));
          pulse = max(hubRing, armPulse);
        } else if (isStraightNS || armVertical) {
          pulse = step(abs(rp.x - 0.5), 0.04) * step(1.0, mod(roadPix.y + flowOffset, 4.0)) * step(dRoad, 0.21);
        } else {
          pulse = step(abs(rp.y - 0.5), 0.04) * step(1.0, mod(roadPix.x + flowOffset, 4.0)) * step(dRoad, 0.21);
        }

        return mix(c, cyanNeon, clamp(rail * 0.78 + pulse, 0.0, 1.0));
      }
    }

    vec3 computeRailColor(
      vec2 pixPos,
      vec2 subUv,
      float tTime,
      bool tN,
      bool tS,
      bool tW,
      bool tE,
      bool tNW,
      bool tNE,
      bool tSW,
      bool tSE,
      vec3 marginCol
    ) {
      vec2 rPix = floor(subUv * 16.0);
      vec2 rp = (rPix + 0.5) / 16.0;

      // Diagonal rail connections exclude redundant L-corner elbows
      bool diagNW = tNW && !tN && !tW;
      bool diagNE = tNE && !tN && !tE;
      bool diagSW = tSW && !tS && !tW;
      bool diagSE = tSE && !tS && !tE;

      float cardCount = (tN ? 1.0 : 0.0) + (tS ? 1.0 : 0.0) + (tW ? 1.0 : 0.0) + (tE ? 1.0 : 0.0);
      float diagCount = (diagNW ? 1.0 : 0.0) + (diagNE ? 1.0 : 0.0) + (diagSW ? 1.0 : 0.0) + (diagSE ? 1.0 : 0.0);
      float totalConn = cardCount + diagCount;

      bool turnNE = tN && tE && !tS && !tW && diagCount < 0.5;
      bool turnNW = tN && tW && !tS && !tE && diagCount < 0.5;
      bool turnSE = tS && tE && !tN && !tW && diagCount < 0.5;
      bool turnSW = tS && tW && !tN && !tE && diagCount < 0.5;
      bool isCardTurn = turnNE || turnNW || turnSE || turnSW;
      bool isStraightNS = (tN || tS) && !tW && !tE && diagCount < 0.5;
      bool isStraightWE = (tW || tE) && !tN && !tS && diagCount < 0.5;

      vec2 ic = vec2(0.5);
      if (turnNE) ic = vec2(1.0, 0.0);
      else if (turnNW) ic = vec2(0.0, 0.0);
      else if (turnSE) ic = vec2(1.0, 1.0);
      else if (turnSW) ic = vec2(0.0, 1.0);

      // Fit smooth continuous Bezier curve across any 2-arm diagonal or curve-transition rail tile (e.g. W->NE, NW->SE, N->SE)
      bool isSplineRail = (abs(totalConn - 2.0) < 0.1) && !isCardTurn && diagCount > 0.5;
      vec2 sp0 = vec2(0.5);
      vec2 sp2 = vec2(0.5);
      if (isSplineRail) {
        int found = 0;
        if (tN) { if (found == 0) sp0 = vec2(0.5, 0.0); else if (found == 1) sp2 = vec2(0.5, 0.0); found++; }
        if (tS) { if (found == 0) sp0 = vec2(0.5, 1.0); else if (found == 1) sp2 = vec2(0.5, 1.0); found++; }
        if (tW) { if (found == 0) sp0 = vec2(0.0, 0.5); else if (found == 1) sp2 = vec2(0.0, 0.5); found++; }
        if (tE) { if (found == 0) sp0 = vec2(1.0, 0.5); else if (found == 1) sp2 = vec2(1.0, 0.5); found++; }
        if (diagNW) { if (found == 0) sp0 = vec2(0.0, 0.0); else if (found == 1) sp2 = vec2(0.0, 0.0); found++; }
        if (diagNE) { if (found == 0) sp0 = vec2(1.0, 0.0); else if (found == 1) sp2 = vec2(1.0, 0.0); found++; }
        if (diagSW) { if (found == 0) sp0 = vec2(0.0, 1.0); else if (found == 1) sp2 = vec2(0.0, 1.0); found++; }
        if (diagSE) { if (found == 0) sp0 = vec2(1.0, 1.0); else if (found == 1) sp2 = vec2(1.0, 1.0); found++; }
        if (found < 2) {
          isSplineRail = false;
        }
      }

      float splineT = 0.0;
      vec2 splineTang = vec2(1.0, 0.0);
      float dTrack = length(rp - vec2(0.5));
      if (isCardTurn) {
        dTrack = abs(length(rp - ic) - 0.5);
      } else if (isSplineRail) {
        dTrack = sdBezierCurve(rp, sp0, vec2(0.5, 0.5), sp2, splineT, splineTang);
      } else {
        float tmpT = 0.0;
        if (tN) dTrack = min(dTrack, sdSeg(rp, vec2(0.5), vec2(0.5, 0.0), tmpT));
        if (tS) dTrack = min(dTrack, sdSeg(rp, vec2(0.5), vec2(0.5, 1.0), tmpT));
        if (tW) dTrack = min(dTrack, sdSeg(rp, vec2(0.5), vec2(0.0, 0.5), tmpT));
        if (tE) dTrack = min(dTrack, sdSeg(rp, vec2(0.5), vec2(1.0, 0.5), tmpT));
        if (diagNW) dTrack = min(dTrack, sdSeg(rp, vec2(0.5), vec2(0.0, 0.0), tmpT));
        if (diagNE) dTrack = min(dTrack, sdSeg(rp, vec2(0.5), vec2(1.0, 0.0), tmpT));
        if (diagSW) dTrack = min(dTrack, sdSeg(rp, vec2(0.5), vec2(0.0, 1.0), tmpT));
        if (diagSE) dTrack = min(dTrack, sdSeg(rp, vec2(0.5), vec2(1.0, 1.0), tmpT));
        if (totalConn < 0.5) {
          dTrack = abs(rp.x - 0.5);
        }
      }

      if (dTrack > 0.34) {
        return marginCol;
      }

      float noiseVal = landHash12(pixPos * 16.0);
      bool armVertical = isStraightNS ||
        (tN && rp.y < 0.5 && abs(rp.x - 0.5) <= abs(rp.y - 0.5)) ||
        (tS && rp.y >= 0.5 && abs(rp.x - 0.5) <= abs(rp.y - 0.5));
      if (isStraightWE) armVertical = false;

      float tieMask = 0.0;
      if (isCardTurn) {
        float arcAng = atan(abs(rp.y - ic.y), abs(rp.x - ic.x) + 0.0001);
        tieMask = step(0.55, fract(arcAng / 1.5707963 * 6.0));
      } else if (isSplineRail) {
        // Radial sleepers cleanly perpendicular to the smooth Bezier railway tangent
        tieMask = step(0.56, fract(splineT * 5.0));
      } else if (totalConn >= 3.0 && max(abs(rp.x - 0.5), abs(rp.y - 0.5)) < 0.25) {
        tieMask = max(step(mod(rPix.x, 3.0), 0.9), step(mod(rPix.y, 3.0), 0.9));
      } else {
        tieMask = armVertical ? step(mod(rPix.y, 3.0), 0.9) : step(mod(rPix.x, 3.0), 0.9);
      }

      if (uEpoch < 4.5) {
        // Industrial & Atomic Age: Ground-level crushed stone ballast + oak sleepers + gleaming twin steel rails
        vec3 ballast = mix(landSrgb(104.0, 96.0, 88.0), landSrgb(126.0, 118.0, 108.0), step(0.55, noiseVal));
        vec3 sleeper = landSrgb(88.0, 56.0, 34.0);
        vec3 steel = landSrgb(208.0, 218.0, 230.0);
        vec3 rustEdge = landSrgb(112.0, 84.0, 68.0);
        vec3 c = mix(ballast, sleeper, tieMask * step(dTrack, 0.23));
        float railLine = step(abs(dTrack - 0.125), 0.036);
        float railRim = step(abs(dTrack - 0.145), 0.02);
        c = mix(c, rustEdge, railRim * 0.55);
        return mix(c, steel, railLine * 0.95);
      } else {
        // Information & Space Age: Clean urban transit median / plinth shadow under the 3D suspended metro pillars & viaduct
        vec3 curb = landSrgb(72.0, 78.0, 88.0);
        vec3 gravel = mix(landSrgb(56.0, 62.0, 70.0), landSrgb(68.0, 74.0, 84.0), step(0.55, noiseVal));
        vec3 plazaStripe = uEpoch >= 5.5 ? landSrgb(52.0, 148.0, 168.0) : landSrgb(98.0, 128.0, 76.0);
        vec3 c = mix(curb, gravel, step(dTrack, 0.28));
        return mix(c, plazaStripe, step(dTrack, 0.14) * 0.65);
      }
    }

    vec3 computeRunwayColor(
      vec2 pixPos,
      vec2 subUv,
      float tTime,
      bool wN,
      bool wS,
      bool wW,
      bool wE,
      vec3 marginCol
    ) {
      bool verticalAxis = (wN || wS) && !(wW || wE);
      float along = verticalAxis ? subUv.y : subUv.x;
      float across = verticalAxis ? abs(subUv.x - 0.5) : abs(subUv.y - 0.5);
      bool hasPrev = verticalAxis ? wN : wW;
      bool hasNext = verticalAxis ? wS : wE;

      if (across > 0.44) {
        return marginCol;
      }

      float noiseVal = landHash12(pixPos * 16.0);
      vec3 asphalt = mix(landSrgb(42.0, 46.0, 54.0), landSrgb(52.0, 56.0, 66.0), step(0.62, noiseVal));
      vec3 shoulder = landSrgb(30.0, 34.0, 40.0);
      vec3 paintWhite = landSrgb(236.0, 240.0, 246.0);
      vec3 edgeAmber = landSrgb(235.0, 186.0, 64.0);

      vec3 c = mix(asphalt, shoulder, step(0.36, across));

      // Yellow edge lines
      if (abs(across - 0.34) < 0.028) {
        c = edgeAmber;
      }

      // Threshold piano-key stripes at runway ends
      bool atStartThreshold = !hasPrev && along > 0.10 && along < 0.34;
      bool atEndThreshold = !hasNext && along > 0.66 && along < 0.90;
      if ((atStartThreshold || atEndThreshold) && across < 0.29) {
        float barWave = fract(across * 16.0);
        if (barWave > 0.35) {
          c = paintWhite;
        }
      } else if (across < 0.036) {
        // Dashed white centerline
        float dash = fract(along * 2.0 + 0.12);
        if (dash > 0.22 && dash < 0.78) {
          c = paintWhite;
        }
      }

      // Animated runway edge beacons
      float beaconAlong = abs(along - 0.5);
      if (abs(across - 0.40) < 0.035 && beaconAlong < 0.07) {
        float pulse = 0.65 + 0.35 * sin(tTime * 4.5 - (pixPos.x + pixPos.y));
        vec3 beaconCol = uEpoch >= 5.5 ? landSrgb(86.0, 224.0, 245.0) : landSrgb(255.0, 214.0, 102.0);
        c = mix(c, beaconCol, 0.78 * pulse);
      }
      return c;
    }
  `;

  const orderedHelpers = glslHelpers + topOnlyGlslHelpers;

  const patchVertexShader = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.vertexShader =
      `varying vec3 vLandWorldPos;\nvarying vec3 vLandWorldNormal;\n` +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 aeonWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          aeonWp = instanceMatrix * aeonWp;
        #endif
        aeonWp = modelMatrix * aeonWp;
        vLandWorldPos = aeonWp.xyz;

        vec3 aeonWn = objectNormal;
        #ifdef USE_INSTANCING
          aeonWn = mat3(instanceMatrix) * aeonWn;
        #endif
        vLandWorldNormal = normalize(mat3(modelMatrix) * aeonWn);`,
      );
  };

  const createdMaterials: THREE.MeshStandardMaterial[] = [];

  // Shared styled cliff side material
  const cliffMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0.08,
  });
  cliffMat.customProgramCacheKey = () => 'aeon_cliff_pixel_v11';
  cliffMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedTime;
    shader.uniforms.uEpoch = sharedEpoch;
    shader.uniforms.uGridSize = sharedGridSize;
    shader.uniforms.uLandMap = sharedLandMap;
    shader.uniforms.uZoneColorMap = sharedZoneColorMap;
    shader.uniforms.uZoneIdMap = sharedZoneIdMap;
    shader.uniforms.uZoneActive = sharedZoneActive;
    shader.uniforms.uCityLightMap = sharedCityLightMap;
    shader.uniforms.uDarkness = sharedDarkness;
    shader.uniforms.uSunDir = sharedSunDir;
    shader.uniforms.uSunTint = sharedSunTint;
    shader.uniforms.uShadowTint = sharedShadowTint;
    shader.uniforms.uSeasonWeights = sharedSeasonWeights;
    patchVertexShader(shader);

    shader.fragmentShader =
      glslHelpers +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float wallU = abs(vLandWorldNormal.x) > 0.5 ? vLandWorldPos.z : vLandWorldPos.x;
        vec2 wallPix = floor(vec2(wallU, vLandWorldPos.y) * 16.0) / 16.0;
        vec2 wallChunk = floor(wallPix * 8.0) / 8.0;

        vec2 cliffOwnerCoord = floor(vLandWorldPos.xz + 0.5 - vLandWorldNormal.xz * 0.25);
        vec2 cliffNeighborCoord = floor(vLandWorldPos.xz + 0.5 + vLandWorldNormal.xz * 0.25);
        vec4 ownerSample = sampleLandTile(cliffOwnerCoord);
        float ownerCode = decodeTerrain(ownerSample);
        float ownerH = floor(ownerSample.g * 255.0 / 20.0 + 0.5);
        float distFromTop = max(0.0, ownerH * 0.45 - vLandWorldPos.y);
        float neighborCode = decodeTerrain(sampleLandTile(cliffNeighborCoord));
        bool isVoidWall = abs(ownerCode - 22.0) < 0.5 || abs(neighborCode - 22.0) < 0.5;
        bool isCraterWall = abs(ownerCode - 12.0) < 0.5 || abs(neighborCode - 12.0) < 0.5 || abs(ownerCode - 24.0) < 0.5 || abs(neighborCode - 24.0) < 0.5;
        bool isBlightWall = abs(ownerCode - 25.0) < 0.5 || abs(neighborCode - 25.0) < 0.5;
        bool isFloralWall = abs(ownerCode - 26.0) < 0.5;
        bool isBadlandsWall = abs(ownerCode - 19.0) < 0.5 || abs(neighborCode - 19.0) < 0.5;
        bool isMountainWall = abs(ownerCode - 16.0) < 0.5 || abs(ownerCode - 11.0) < 0.5 || abs(ownerCode - 8.0) < 0.5 || abs(ownerCode - 10.0) < 0.5 || abs(ownerCode - 18.0) < 0.5;
        bool isSandWall = abs(ownerCode - 2.0) < 0.5;
        bool isSwampWall = abs(ownerCode - 7.0) < 0.5;
        bool isSavannaWall = abs(ownerCode - 6.0) < 0.5;
        bool isTaigaWall = abs(ownerCode - 17.0) < 0.5;
        bool isBlossomWall = abs(ownerCode - 20.0) < 0.5;
        bool isEarthBank =
          !isVoidWall && !isCraterWall && !isBlightWall && !isBadlandsWall && !isMountainWall &&
          (abs(ownerCode - 3.0) < 0.5 || abs(ownerCode - 4.0) < 0.5 || abs(ownerCode - 5.0) < 0.5 ||
           abs(ownerCode - 6.0) < 0.5 || abs(ownerCode - 15.0) < 0.5 || abs(ownerCode - 17.0) < 0.5 ||
           abs(ownerCode - 20.0) < 0.5) &&
          (ownerH <= 3.5 || distFromTop < 0.52);
        bool isUrbanRetainingWall =
          !isVoidWall && !isCraterWall && !isBlightWall &&
          (abs(ownerCode - 9.0) < 0.5 || abs(ownerCode - 14.0) < 0.5 || abs(ownerCode - 21.0) < 0.5);

        float strata = landNoise(vec2(wallChunk.x * 0.65, wallChunk.y * 2.2));
        float brickRow = floor(wallPix.y * 4.0);
        float brickCol = floor((wallPix.x + mod(brickRow, 2.0) * 0.25) * 2.0);
        float seam = step(0.86, fract(wallPix.y * 4.0)) + step(0.91, fract((wallPix.x + mod(brickRow, 2.0) * 0.25) * 2.0));
        float brickTone = landHash12(vec2(brickCol, brickRow));
        float pixGrain = landHash12(floor(wallPix * 16.0));
        float lipJitter = (landHash12(vec2(floor(wallU * 8.0), 3.7)) - 0.5) * 0.07;

        vec3 cliffCol;
        if (isUrbanRetainingWall) {
          if (uEpoch >= 3.5) {
            // Dressed architectural concrete seawall / retaining caisson with horizontal joints & subtle safety stripe
            vec3 concBase = uEpoch >= 5.5 ? landSrgb(112.0, 126.0, 144.0) : landSrgb(122.0, 130.0, 138.0);
            vec3 concHi   = uEpoch >= 5.5 ? landSrgb(148.0, 164.0, 184.0) : landSrgb(154.0, 162.0, 170.0);
            vec3 concSh   = uEpoch >= 5.5 ? landSrgb(68.0, 78.0, 92.0)    : landSrgb(74.0, 82.0, 90.0);
            float panelSeam = max(step(0.88, fract(wallPix.y * 2.5)), step(0.90, fract(wallPix.x * 1.5)));
            float panelTone = landHash12(floor(vec2(wallPix.x * 1.5, wallPix.y * 2.5)));
            cliffCol = mix(concBase, concHi, step(0.62, panelTone));
            cliffCol = mix(cliffCol, concSh, panelSeam * 0.72);
            if (uEpoch >= 5.5 && abs(fract(wallPix.y * 1.2) - 0.5) < 0.08) {
              cliffCol = mix(cliffCol, landSrgb(86.0, 207.0, 225.0), 0.52);
            }
          } else {
            // Dressed ashlar stone retaining wall (Classical / Medieval / Industrial)
            vec3 ashlarBase = landSrgb(126.0, 120.0, 114.0);
            vec3 ashlarHi   = landSrgb(158.0, 152.0, 142.0);
            vec3 ashlarSh   = landSrgb(78.0, 74.0, 70.0);
            cliffCol = mix(ashlarSh, ashlarBase, step(0.28, brickTone));
            cliffCol = mix(cliffCol, ashlarHi, step(0.68, brickTone));
            cliffCol = mix(cliffCol, ashlarSh, clamp(seam, 0.0, 1.0) * 0.78);
          }
        } else if (isSandWall) {
          // Layered warm beach / shoal sand bank (dry pale sand lip -> warm golden sand -> damp ochre base)
          vec3 sandHi   = landSrgb(226.0, 208.0, 166.0);
          vec3 sandBase = landSrgb(196.0, 172.0, 126.0);
          vec3 sandSh   = landSrgb(156.0, 134.0, 96.0);
          cliffCol = mix(sandSh, sandBase, step(0.28, strata * 0.65 + pixGrain * 0.35));
          cliffCol = mix(cliffCol, sandHi, step(0.72, strata * 0.55 + pixGrain * 0.45));
          if (distFromTop < 0.09 + lipJitter) {
            cliffCol = mix(cliffCol, sandHi, 0.75);
          }
        } else if (isSwampWall) {
          // Wet muddy peat & tangled mangrove-root bank with mossy overhang lip
          vec3 mudSh   = landSrgb(46.0, 38.0, 28.0);
          vec3 mudBase = landSrgb(72.0, 58.0, 42.0);
          vec3 mudHi   = landSrgb(98.0, 82.0, 58.0);
          cliffCol = mix(mudSh, mudBase, step(0.30, strata * 0.65 + pixGrain * 0.35));
          cliffCol = mix(cliffCol, mudHi, step(0.72, strata * 0.6 + pixGrain * 0.4));
          if (distFromTop < 0.09 + lipJitter) {
            cliffCol = mix(landSrgb(58.0, 92.0, 52.0), landSrgb(78.0, 114.0, 62.0), step(0.5, pixGrain));
          }
        } else if (isEarthBank) {
          // Natural earthy loam riverbank with overhanging biome turf lip
          vec3 dirtSh   = landSrgb(78.0, 56.0, 38.0);
          vec3 dirtBase = landSrgb(116.0, 86.0, 58.0);
          vec3 dirtHi   = landSrgb(142.0, 108.0, 76.0);
          cliffCol = mix(dirtSh, dirtBase, step(0.30, strata * 0.65 + pixGrain * 0.35));
          cliffCol = mix(cliffCol, dirtHi, step(0.74, strata * 0.6 + pixGrain * 0.4));
          if (distFromTop < 0.10 + lipJitter) {
            vec3 turfCol = isSavannaWall
              ? landSrgb(164.0, 142.0, 72.0)
              : isTaigaWall
                ? landSrgb(68.0, 108.0, 76.0)
                : isBlossomWall
                  ? landSrgb(116.0, 160.0, 92.0)
                  : landSrgb(86.0, 142.0, 70.0);
            cliffCol = mix(turfCol * 0.84, turfCol, step(0.45, pixGrain));
          }
        } else {
          vec3 stoneBase = isVoidWall
            ? vec3(0.015, 0.008, 0.035)
            : isBlightWall
              ? landSrgb(48.0, 22.0, 68.0)
              : isCraterWall
              ? landSrgb(44.0, 32.0, 30.0)
              : isFloralWall
                ? landSrgb(92.0, 118.0, 88.0)
                : isBadlandsWall
                  ? landSrgb(162.0, 82.0, 48.0)
                  : isMountainWall
                    ? landSrgb(88.0, 96.0, 106.0)
                    : landSrgb(74.0, 89.0, 95.0);
          vec3 stoneHi = isVoidWall
            ? landSrgb(58.0, 24.0, 96.0)
            : isBlightWall
              ? landSrgb(76.0, 38.0, 104.0)
              : isCraterWall
              ? landSrgb(78.0, 52.0, 42.0)
              : isFloralWall
                ? landSrgb(132.0, 168.0, 116.0)
                : isBadlandsWall
                  ? landSrgb(206.0, 122.0, 72.0)
                  : isMountainWall
                    ? landSrgb(126.0, 136.0, 146.0)
                    : landSrgb(104.0, 122.0, 129.0);
          vec3 stoneSh = isVoidWall
            ? vec3(0.004, 0.002, 0.012)
            : isBlightWall
              ? landSrgb(24.0, 10.0, 36.0)
              : isCraterWall
              ? landSrgb(22.0, 15.0, 16.0)
              : isFloralWall
                ? landSrgb(56.0, 78.0, 54.0)
                : isBadlandsWall
                  ? landSrgb(106.0, 52.0, 32.0)
                  : isMountainWall
                    ? landSrgb(54.0, 60.0, 68.0)
                    : landSrgb(45.0, 56.0, 61.0);

          cliffCol = mix(stoneSh, stoneBase, step(0.32, strata * 0.7 + brickTone * 0.3));
          cliffCol = mix(cliffCol, stoneHi, step(0.68, strata * 0.65 + brickTone * 0.35));
          cliffCol = mix(cliffCol, stoneSh, clamp(seam, 0.0, 1.0) * 0.65);

          if (isVoidWall) {
            float wallStar = landHash12(floor(wallPix * 16.0 + vec2(uTime * 2.2, -uTime * 1.4)));
            if (wallStar > 0.962) cliffCol = mix(cliffCol, vec3(0.75, 0.62, 1.0), 0.92);
          } else if (isBlightWall) {
            float toxVein = step(0.80, strata * 0.6 + brickTone * 0.4);
            cliffCol = mix(cliffCol, landSrgb(74.0, 222.0, 128.0), toxVein * 0.78);
          } else if (isCraterWall) {
            float emberVein = step(0.76, strata * 0.6 + brickTone * 0.4);
            cliffCol = mix(cliffCol, landSrgb(255.0, 112.0, 24.0), emberVein * 0.85);
          }
        }

        cliffCol = applySeasonalCliffColor(
          cliffCol,
          isEarthBank,
          isSwampWall,
          isMountainWall,
          isVoidWall,
          isCraterWall,
          isBlightWall,
          isSandWall,
          isBadlandsWall,
          isUrbanRetainingWall,
          distFromTop,
          lipJitter,
          pixGrain
        );

        // Dynamic time-of-day directional cliff face shading (east sunrise vs west sunset vs indigo midnight)
        float sunSide = clamp(dot(vLandWorldNormal, normalize(uSunDir)) * 0.5 + 0.5, 0.0, 1.0);
        vec3 todCliffGrade = mix(uShadowTint * 0.78, uSunTint * 1.14, sunSide);
        cliffCol *= todCliffGrade;

        // Darken submerged base slightly like damp shoreline rock
        if (vLandWorldPos.y < 0.48) {
          cliffCol *= mix(0.68, 1.0, smoothstep(0.26, 0.48, vLandWorldPos.y));
        }

        diffuseColor.rgb = cliffCol;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        if (uDarkness > 0.03) {
          vec3 cliffNightGlow = computeCityNightGlow(
            cliffOwnerCoord + vec2(0.5),
            cliffOwnerCoord,
            vec2(0.5),
            ownerCode,
            uTime,
            uEpoch,
            uDarkness
          );
          gl_FragColor.rgb += cliffNightGlow * 0.45;
        }
        if (uZoneActive > 0.5) {
          vec4 zCol = sampleLandZoneColor(cliffOwnerCoord);
          vec4 zId = sampleLandZoneId(cliffOwnerCoord);
          vec4 zNbId = sampleLandZoneId(cliffNeighborCoord);
          if (zCol.a > 0.01) {
            bool diffCliff = abs(zNbId.r - zId.r) > 0.002 || abs(zNbId.g - zId.g) > 0.002;
            bool isHovered = zId.b > 0.5;
            if (diffCliff) {
              vec3 rimCol = zCol.rgb * (isHovered ? 0.56 : 0.40);
              gl_FragColor.rgb = mix(gl_FragColor.rgb, rimCol, 0.95);
            } else {
              float hBoost = isHovered ? 0.16 : 0.0;
              gl_FragColor.rgb = mix(gl_FragColor.rgb, zCol.rgb, clamp(zCol.a * 0.52 + hBoost, 0.0, 0.76));
            }
          }
        }`,
      );
  };
  createdMaterials.push(cliffMat);

  // Shared single-call top-surface GLSL color body: resolves roads/rails/runways/seabed/dithering
  // BEFORE invoking computeBiomeColor() ONCE so ANGLE/FXC never inlines 10x copies of the 27-biome switch!
  const sharedTopSurfaceColorGlsl = `
          vec2 gridPos = vLandWorldPos.xz + 0.5;
          pixPos = floor(gridPos * 16.0) / 16.0;
          vec2 chunkPos = floor(pixPos * 8.0) / 8.0;
          tileCoord = floor(pixPos);
          subUv = fract(pixPos);

          vec4 self = sampleLandTile(tileCoord);
          float myHeight = decodeHeight(self);
          myCode = decodeTerrain(self);
          if (myHeight < 0.5 && uDefaultCode >= 0.0) myCode = uDefaultCode;

          vec4 nN = sampleLandTile(tileCoord + vec2( 0.0, -1.0));
          vec4 nS = sampleLandTile(tileCoord + vec2( 0.0,  1.0));
          vec4 nW = sampleLandTile(tileCoord + vec2(-1.0,  0.0));
          vec4 nE = sampleLandTile(tileCoord + vec2( 1.0,  0.0));

          float hN = decodeHeight(nN);
          float hS = decodeHeight(nS);
          float hW = decodeHeight(nW);
          float hE = decodeHeight(nE);

          float cN = decodeTerrain(nN);
          float cS = decodeTerrain(nS);
          float cW = decodeTerrain(nW);
          float cE = decodeTerrain(nE);

          // 0. Sub-tile 16x16 pixelated circular corner rounding (skip crisp roads & rails)
          float cornerR = 0.46;
          if (myCode != 9.0 && myCode != 14.0) {
            if (subUv.x < cornerR && subUv.y < cornerR && cN != myCode && cW != myCode && (cN == cW || cN == 12.0 || cW == 12.0)) {
              if (length(vec2(cornerR, cornerR) - subUv) > cornerR * 0.92) {
                myCode = (cN == 12.0) ? cN : cW;
              }
            } else if ((1.0 - subUv.x) < cornerR && subUv.y < cornerR && cN != myCode && cE != myCode && (cN == cE || cN == 12.0 || cE == 12.0)) {
              if (length(vec2(1.0 - cornerR, cornerR) - subUv) > cornerR * 0.92) {
                myCode = (cN == 12.0) ? cN : cE;
              }
            } else if (subUv.x < cornerR && (1.0 - subUv.y) < cornerR && cS != myCode && cW != myCode && (cS == cW || cS == 12.0 || cW == 12.0)) {
              if (length(vec2(cornerR, 1.0 - cornerR) - subUv) > cornerR * 0.92) {
                myCode = (cS == 12.0) ? cS : cW;
              }
            } else if ((1.0 - subUv.x) < cornerR && (1.0 - subUv.y) < cornerR && cS != myCode && cE != myCode && (cS == cE || cS == 12.0 || cE == 12.0)) {
              if (length(vec2(1.0 - cornerR, 1.0 - cornerR) - subUv) > cornerR * 0.92) {
                myCode = (cS == 12.0) ? cS : cE;
              }
            }
          }

          bool isRoadTile = abs(myCode - 9.0) < 0.5;
          bool isRailTile = abs(myCode - 14.0) < 0.5;
          bool isRunwayTile = abs(myCode - 21.0) < 0.5;
          bool isSeabedTile = !isRoadTile && !isRailTile && !isRunwayTile && myHeight < 0.5 && myCode < 1.5;

          bool rN = false; bool rS = false; bool rW = false; bool rE = false;
          bool rNW = false; bool rNE = false; bool rSW = false; bool rSE = false;
          bool isBridgeRoad = false;

          float evalBiomeCode = myCode;
          bool evalBiomeFarm = self.a > 0.72;
          bool needBiomeEval = !isSeabedTile;

          if (isRoadTile) {
            float cNW = decodeTerrain(sampleLandTile(tileCoord + vec2(-1.0, -1.0)));
            float cNE = decodeTerrain(sampleLandTile(tileCoord + vec2( 1.0, -1.0)));
            float cSW = decodeTerrain(sampleLandTile(tileCoord + vec2(-1.0,  1.0)));
            float cSE = decodeTerrain(sampleLandTile(tileCoord + vec2( 1.0,  1.0)));
            rN = abs(cN - 9.0) < 0.5 || abs(cN - 21.0) < 0.5;
            rS = abs(cS - 9.0) < 0.5 || abs(cS - 21.0) < 0.5;
            rW = abs(cW - 9.0) < 0.5 || abs(cW - 21.0) < 0.5;
            rE = abs(cE - 9.0) < 0.5 || abs(cE - 21.0) < 0.5;
            rNW = abs(cNW - 9.0) < 0.5 || abs(cNW - 21.0) < 0.5;
            rNE = abs(cNE - 9.0) < 0.5 || abs(cNE - 21.0) < 0.5;
            rSW = abs(cSW - 9.0) < 0.5 || abs(cSW - 21.0) < 0.5;
            rSE = abs(cSE - 9.0) < 0.5 || abs(cSE - 21.0) < 0.5;

            isBridgeRoad = myHeight < 0.5 || cN < 1.5 || cS < 1.5 || cW < 1.5 || cE < 1.5;
            float marginBiome = -1.0;
            if (!rN && subUv.y < 0.35 && cN >= 2.0 && abs(cN - 9.0) > 0.5 && abs(cN - 14.0) > 0.5) marginBiome = cN;
            else if (!rS && subUv.y > 0.65 && cS >= 2.0 && abs(cS - 9.0) > 0.5 && abs(cS - 14.0) > 0.5) marginBiome = cS;
            else if (!rW && subUv.x < 0.35 && cW >= 2.0 && abs(cW - 9.0) > 0.5 && abs(cW - 14.0) > 0.5) marginBiome = cW;
            else if (!rE && subUv.x > 0.65 && cE >= 2.0 && abs(cE - 9.0) > 0.5 && abs(cE - 14.0) > 0.5) marginBiome = cE;
            else if (!rN && cN >= 2.0 && abs(cN - 9.0) > 0.5 && abs(cN - 14.0) > 0.5) marginBiome = cN;
            else if (!rS && cS >= 2.0 && abs(cS - 9.0) > 0.5 && abs(cS - 14.0) > 0.5) marginBiome = cS;
            else if (!rW && cW >= 2.0 && abs(cW - 9.0) > 0.5 && abs(cW - 14.0) > 0.5) marginBiome = cW;
            else if (!rE && cE >= 2.0 && abs(cE - 9.0) > 0.5 && abs(cE - 14.0) > 0.5) marginBiome = cE;
            else if (cNW >= 2.0 && abs(cNW - 9.0) > 0.5 && abs(cNW - 14.0) > 0.5) marginBiome = cNW;
            else if (cNE >= 2.0 && abs(cNE - 9.0) > 0.5 && abs(cNE - 14.0) > 0.5) marginBiome = cNE;
            else if (cSW >= 2.0 && abs(cSW - 9.0) > 0.5 && abs(cSW - 14.0) > 0.5) marginBiome = cSW;
            else if (cSE >= 2.0 && abs(cSE - 9.0) > 0.5 && abs(cSE - 14.0) > 0.5) marginBiome = cSE;

            if (isBridgeRoad || marginBiome < 0.0) {
              isBridgeRoad = true;
              needBiomeEval = false;
            } else {
              evalBiomeCode = marginBiome;
              evalBiomeFarm = false;
            }
          } else if (isRailTile) {
            float cNW = decodeTerrain(sampleLandTile(tileCoord + vec2(-1.0, -1.0)));
            float cNE = decodeTerrain(sampleLandTile(tileCoord + vec2( 1.0, -1.0)));
            float cSW = decodeTerrain(sampleLandTile(tileCoord + vec2(-1.0,  1.0)));
            float cSE = decodeTerrain(sampleLandTile(tileCoord + vec2( 1.0,  1.0)));
            rN = abs(cN - 14.0) < 0.5 || (abs(cN - 9.0) < 0.5 && abs(cS - 14.0) < 0.5);
            rS = abs(cS - 14.0) < 0.5 || (abs(cS - 9.0) < 0.5 && abs(cN - 14.0) < 0.5);
            rW = abs(cW - 14.0) < 0.5 || (abs(cW - 9.0) < 0.5 && abs(cE - 14.0) < 0.5);
            rE = abs(cE - 14.0) < 0.5 || (abs(cE - 9.0) < 0.5 && abs(cW - 14.0) < 0.5);
            rNW = abs(cNW - 14.0) < 0.5 || (abs(cNW - 9.0) < 0.5 && abs(cSE - 14.0) < 0.5);
            rNE = abs(cNE - 14.0) < 0.5 || (abs(cNE - 9.0) < 0.5 && abs(cSW - 14.0) < 0.5);
            rSW = abs(cSW - 14.0) < 0.5 || (abs(cSW - 9.0) < 0.5 && abs(cNE - 14.0) < 0.5);
            rSE = abs(cSE - 14.0) < 0.5 || (abs(cSE - 9.0) < 0.5 && abs(cNW - 14.0) < 0.5);

            float marginBiome = 3.0;
            if (!rN && subUv.y < 0.35 && cN >= 2.0 && abs(cN - 14.0) > 0.5 && abs(cN - 9.0) > 0.5 && abs(cN - 21.0) > 0.5) marginBiome = cN;
            else if (!rS && subUv.y > 0.65 && cS >= 2.0 && abs(cS - 14.0) > 0.5 && abs(cS - 9.0) > 0.5 && abs(cS - 21.0) > 0.5) marginBiome = cS;
            else if (!rW && subUv.x < 0.35 && cW >= 2.0 && abs(cW - 14.0) > 0.5 && abs(cW - 9.0) > 0.5 && abs(cW - 21.0) > 0.5) marginBiome = cW;
            else if (!rE && subUv.x > 0.65 && cE >= 2.0 && abs(cE - 14.0) > 0.5 && abs(cE - 9.0) > 0.5 && abs(cE - 21.0) > 0.5) marginBiome = cE;
            else if (!rN && cN >= 2.0 && abs(cN - 14.0) > 0.5 && abs(cN - 9.0) > 0.5 && abs(cN - 21.0) > 0.5) marginBiome = cN;
            else if (!rS && cS >= 2.0 && abs(cS - 14.0) > 0.5 && abs(cS - 9.0) > 0.5 && abs(cS - 21.0) > 0.5) marginBiome = cS;
            else if (!rW && cW >= 2.0 && abs(cW - 14.0) > 0.5 && abs(cW - 9.0) > 0.5 && abs(cW - 21.0) > 0.5) marginBiome = cW;
            else if (!rE && cE >= 2.0 && abs(cE - 14.0) > 0.5 && abs(cE - 9.0) > 0.5 && abs(cE - 21.0) > 0.5) marginBiome = cE;
            evalBiomeCode = marginBiome;
            evalBiomeFarm = false;
          } else if (isRunwayTile) {
            rN = abs(cN - 21.0) < 0.5;
            rS = abs(cS - 21.0) < 0.5;
            rW = abs(cW - 21.0) < 0.5;
            rE = abs(cE - 21.0) < 0.5;
            float marginBiome = 3.0;
            if (!rN && cN >= 2.0 && abs(cN - 21.0) > 0.5 && abs(cN - 9.0) > 0.5) marginBiome = cN;
            else if (!rS && cS >= 2.0 && abs(cS - 21.0) > 0.5 && abs(cS - 9.0) > 0.5) marginBiome = cS;
            else if (!rW && cW >= 2.0 && abs(cW - 21.0) > 0.5 && abs(cW - 9.0) > 0.5) marginBiome = cW;
            else if (!rE && cE >= 2.0 && abs(cE - 21.0) > 0.5 && abs(cE - 9.0) > 0.5) marginBiome = cE;
            evalBiomeCode = marginBiome;
            evalBiomeFarm = false;
          } else if (!isSeabedTile && myHeight > 0.5) {
            // 1. Cross-biome organic pixel dithering resolved BEFORE single computeBiomeColor call
            float ditherRng = landHash12(pixPos * 16.0);
            if (hN == myHeight && cN != myCode && cN != 9.0 && cN != 14.0 && cN != 21.0 && subUv.y < 0.24 && ditherRng > subUv.y * 3.8) {
              evalBiomeCode = cN; evalBiomeFarm = nN.a > 0.72;
            } else if (hS == myHeight && cS != myCode && cS != 9.0 && cS != 14.0 && cS != 21.0 && (1.0 - subUv.y) < 0.24 && ditherRng > (1.0 - subUv.y) * 3.8) {
              evalBiomeCode = cS; evalBiomeFarm = nS.a > 0.72;
            } else if (hW == myHeight && cW != myCode && cW != 9.0 && cW != 14.0 && cW != 21.0 && subUv.x < 0.24 && ditherRng > subUv.x * 3.8) {
              evalBiomeCode = cW; evalBiomeFarm = nW.a > 0.72;
            } else if (hE == myHeight && cE != myCode && cE != 9.0 && cE != 14.0 && cE != 21.0 && (1.0 - subUv.x) < 0.24 && ditherRng > (1.0 - subUv.x) * 3.8) {
              evalBiomeCode = cE; evalBiomeFarm = nE.a > 0.72;
            }
          }

          // SINGLE computeBiomeColor call site (prevents 10x FXC/ANGLE shader inlining freeze!)
          vec3 sampledBiomeCol = needBiomeEval
            ? computeBiomeColor(evalBiomeCode, pixPos, chunkPos, subUv, uTime, evalBiomeFarm)
            : vec3(0.0);

          if (isRoadTile) {
            vec3 marginCol = isBridgeRoad
              ? (uEpoch < 1.5
                  ? landSrgb(120.0, 88.0, 58.0)
                  : uEpoch < 3.5
                    ? landSrgb(156.0, 146.0, 134.0)
                    : uEpoch < 5.5
                      ? landSrgb(132.0, 142.0, 156.0)
                      : landSrgb(68.0, 84.0, 102.0))
              : sampledBiomeCol;
            col = computeRoadColor(pixPos, subUv, uTime, rN, rS, rW, rE, rNW, rNE, rSW, rSE, marginCol);

            if (uEpoch < 4.5) {
              bool crossWE = abs(cW - 14.0) < 0.5 && abs(cE - 14.0) < 0.5;
              bool crossNS = abs(cN - 14.0) < 0.5 && abs(cS - 14.0) < 0.5;
              if (crossWE) {
                float railStrip = step(abs(abs(subUv.y - 0.5) - 0.125), 0.036);
                col = mix(col, landSrgb(218.0, 228.0, 240.0), railStrip * 0.92);
              }
              if (crossNS) {
                float railStrip = step(abs(abs(subUv.x - 0.5) - 0.125), 0.036);
                col = mix(col, landSrgb(218.0, 228.0, 240.0), railStrip * 0.92);
              }
            }
          } else if (isRailTile) {
            col = computeRailColor(pixPos, subUv, uTime, rN, rS, rW, rE, rNW, rNE, rSW, rSE, sampledBiomeCol);
          } else if (isRunwayTile) {
            col = computeRunwayColor(pixPos, subUv, uTime, rN, rS, rW, rE, sampledBiomeCol);
          } else if (isSeabedTile) {
            // Smooth bathymetric seabed / freshwater riverbed & lakebed rendering
            float bSelf = self.b;
            float bN = hN < 0.5 ? nN.b : 0.0;
            float bS = hS < 0.5 ? nS.b : 0.0;
            float bW = hW < 0.5 ? nW.b : 0.0;
            float bE = hE < 0.5 ? nE.b : 0.0;
            float bX = subUv.x < 0.5 ? mix(bW, bSelf, subUv.x + 0.5) : mix(bSelf, bE, subUv.x - 0.5);
            float bY = subUv.y < 0.5 ? mix(bN, bSelf, subUv.y + 0.5) : mix(bSelf, bS, subUv.y - 0.5);
            float bDepth = clamp((bX + bY) * 0.5, 0.0, 1.0);

            if (self.a > 0.72) {
              // Natural Inland Lakebed: shallow pebble gravel & mossy olive stones -> rich silt -> deep alpine teal sediment + refracted sunlight caustics
              float cobble = landHash12(floor(pixPos * 8.0));
              float siltPatch = landNoise(chunkPos * 0.72 + vec2(4.3, 9.1));
              float mossPatch = landNoise(chunkPos * 1.15 - vec2(7.2, 3.8));
              vec3 shoreGravel = mix(landSrgb(154.0, 146.0, 118.0), landSrgb(184.0, 174.0, 140.0), step(0.50, cobble));
              vec3 mossyStone  = landSrgb(88.0, 114.0, 84.0);
              vec3 lakeSilt    = landSrgb(56.0, 86.0, 82.0);
              vec3 deepBasin   = landSrgb(22.0, 52.0, 68.0);
              vec3 bed = mix(shoreGravel, mossyStone, step(0.56, mossPatch) * 0.65);
              if (cobble < 0.16) bed *= 0.80;
              bed = mix(bed, lakeSilt, smoothstep(0.08, 0.42, bDepth));
              bed = mix(bed, deepBasin, smoothstep(0.38, 0.78, bDepth));
              if (siltPatch > 0.68 && bDepth < 0.45) bed = mix(bed, mossyStone * 0.88, 0.35);
              float caustA = landNoise(chunkPos * 1.45 + vec2(uTime * 0.36, -uTime * 0.24));
              float caustB = landNoise(chunkPos * 2.10 - vec2(uTime * 0.28, uTime * 0.34));
              float caustic = step(0.72, caustA * 0.54 + caustB * 0.46) * (1.0 - smoothstep(0.12, 0.58, bDepth));
              col = mix(bed, landSrgb(182.0, 232.0, 218.0), caustic * 0.38);
            } else if (self.a > 0.25) {
              // Natural Riverbed: wet river-worn cobbles, ochre sandbars, olive river-moss & flowing sunlight caustics
              float pebbleA = landHash12(floor(pixPos * 8.0));
              float pebbleB = landHash12(floor(pixPos * 16.0));
              float gravelWave = landNoise(chunkPos * 0.95 + vec2(3.1, 6.4));
              float mossStreak = landNoise(chunkPos * 1.35 - vec2(5.4, 2.7));
              vec3 wetSand    = landSrgb(166.0, 152.0, 118.0);
              vec3 warmCobble = landSrgb(138.0, 128.0, 108.0);
              vec3 slateStone = landSrgb(92.0, 100.0, 96.0);
              vec3 riverMoss  = landSrgb(72.0, 104.0, 72.0);
              vec3 bed = mix(wetSand, warmCobble, step(0.36, gravelWave));
              if (pebbleA > 0.66) bed = mix(bed, slateStone, 0.72);
              else if (pebbleA < 0.20) bed = mix(bed, landSrgb(186.0, 174.0, 140.0), 0.55);
              if (mossStreak > 0.62) bed = mix(bed, riverMoss, 0.55);
              if (pebbleB < 0.14) bed *= 0.74;
              bed = mix(bed, landSrgb(48.0, 78.0, 82.0), smoothstep(0.14, 0.52, bDepth) * 0.65);
              float caustA = landNoise(chunkPos * 1.65 + vec2(-uTime * 0.65, -uTime * 0.45));
              float caustB = landNoise(chunkPos * 2.40 + vec2(-uTime * 0.42, uTime * 0.52));
              float caustic = step(0.70, caustA * 0.55 + caustB * 0.45);
              col = mix(bed, landSrgb(198.0, 240.0, 234.0), caustic * 0.42);
            } else {
              float waveA = landNoise(chunkPos * 0.42);
              float waveB = landNoise(chunkPos * 0.92 + vec2(11.3, 7.1));
              float detail = landHash12(pixPos * 16.0);
              float patchVal = waveA * 0.62 + waveB * 0.38;
              float ripple = sin((pixPos.x + pixPos.y * 0.7) * 3.8 + waveA * 3.0) * 0.5 + 0.5;
              vec3 shHi = landSrgb(242.0, 228.0, 188.0);
              vec3 shallowSandCol = mix(landSrgb(192.0, 178.0, 138.0), landSrgb(222.0, 208.0, 166.0), step(0.32, patchVal + ripple * 0.14));
              shallowSandCol = mix(shallowSandCol, shHi, step(0.68, patchVal + ripple * 0.16));
              if (detail > 0.92) shallowSandCol = mix(shallowSandCol, shHi, 0.65);
              vec3 midShoalCol  = landSrgb(82.0, 146.0, 156.0);
              vec3 slopeTealCol = landSrgb(34.0, 82.0, 108.0);
              vec3 deepFloorCol = mix(landSrgb(10.0, 26.0, 42.0), landSrgb(16.0, 38.0, 58.0), step(0.34, patchVal));
              deepFloorCol = mix(deepFloorCol, landSrgb(26.0, 56.0, 82.0), step(0.68, patchVal));
              if (bDepth < 0.42) col = mix(shallowSandCol, midShoalCol, smoothstep(0.15, 0.42, bDepth));
              else if (bDepth < 0.74) col = mix(midShoalCol, slopeTealCol, smoothstep(0.42, 0.74, bDepth));
              else col = mix(slopeTealCol, deepFloorCol, smoothstep(0.74, 0.98, bDepth));
            }
          } else {
            col = sampledBiomeCol;
          }

          // 1b. Crushed AT-Walker Footprint Impressions (deep brown churned mud & tread bars)
          if (myHeight > 0.5 && self.a > 0.18 && self.a < 0.72) {
            vec2 fPix = floor(subUv * 16.0);
            float mudNoise = landHash12(pixPos * 16.0);
            bool uN = nN.a > 0.18 && nN.a < 0.72;
            bool uS = nS.a > 0.18 && nS.a < 0.72;
            bool uW = nW.a > 0.18 && nW.a < 0.72;
            bool uE = nE.a > 0.18 && nE.a < 0.72;
            float rimDist = 2.0;
            if (!uN) rimDist = min(rimDist, subUv.y);
            if (!uS) rimDist = min(rimDist, 1.0 - subUv.y);
            if (!uW) rimDist = min(rimDist, subUv.x);
            if (!uE) rimDist = min(rimDist, 1.0 - subUv.x);

            float treadBar = step(mod(fPix.y + floor(mod(fPix.x, 4.0) * 0.5), 4.0), 1.5);
            vec3 mudDeep  = landSrgb(52.0, 31.0, 18.0);
            vec3 mudBase  = landSrgb(86.0, 52.0, 29.0);
            vec3 mudRim   = landSrgb(116.0, 76.0, 44.0);
            vec3 treadCol = mix(mudBase, mudDeep, clamp(treadBar * 0.68 + (mudNoise > 0.65 ? 0.32 : 0.0), 0.0, 1.0));
            if (rimDist < 0.16) treadCol = mix(mudDeep, mudRim, smoothstep(0.0, 0.16, rimDist));
            else if (mudNoise < 0.14) treadCol = mudDeep;
            float crushMix = (myCode == 9.0 || myCode == 14.0 || myCode == 21.0) ? 0.65 : 0.94;
            col = mix(col, treadCol, crushMix);
          }

          // 2. Crisp shoreline dampness & wet-sand darkening right where land meets sea
          float waterDist = 2.0;
          if (hN < 0.5) waterDist = min(waterDist, subUv.y);
          if (hS < 0.5) waterDist = min(waterDist, 1.0 - subUv.y);
          if (hW < 0.5) waterDist = min(waterDist, subUv.x);
          if (hE < 0.5) waterDist = min(waterDist, 1.0 - subUv.x);
          if (waterDist < 0.36) {
            float wetWave = 0.24 + 0.08 * sin(uTime * 2.6 + (pixPos.x + pixPos.y) * 0.45);
            if (waterDist < wetWave) col *= 0.78;
          }

          // 3. Isometric Pixel-Art Cliff Edge Rim Highlight (directional sun-kissed rim)
          float lowerEdge = 2.0;
          vec2 rimNormal = vec2(0.0);
          if (hS < myHeight && (1.0 - subUv.y) < lowerEdge) { lowerEdge = 1.0 - subUv.y; rimNormal = vec2(0.0, 1.0); }
          if (hE < myHeight && (1.0 - subUv.x) < lowerEdge) { lowerEdge = 1.0 - subUv.x; rimNormal = vec2(1.0, 0.0); }
          if (hN < myHeight && subUv.y < lowerEdge) { lowerEdge = subUv.y; rimNormal = vec2(0.0, -1.0); }
          if (hW < myHeight && subUv.x < lowerEdge) { lowerEdge = subUv.x; rimNormal = vec2(-1.0, 0.0); }
          if (lowerEdge < 0.12) {
            float sunRimAlign = clamp(dot(rimNormal, normalize(uSunDir.xz + vec2(0.0001))) * 0.5 + 0.5, 0.0, 1.0);
            float rimBoost = (abs(myCode - 10.0) < 0.5 || abs(myCode - 12.0) < 0.5 || abs(myCode - 16.0) < 0.5) ? 1.26 : 1.18;
            col *= mix(vec3(1.02), uSunTint * rimBoost, 0.45 + 0.55 * sunRimAlign);
          }

          // 4. Directional Terrace Cast Shadow & Base Ambient Occlusion
          float lowAngleReach = mix(0.24, 0.48, clamp(1.0 - uSunDir.y, 0.0, 1.0));
          float shadowMask = 0.0;
          if (hE > myHeight && uSunDir.x > 0.1 && (1.0 - subUv.x) < lowAngleReach) shadowMask = max(shadowMask, 1.0 - (1.0 - subUv.x) / lowAngleReach);
          if (hW > myHeight && uSunDir.x < -0.1 && subUv.x < lowAngleReach) shadowMask = max(shadowMask, 1.0 - subUv.x / lowAngleReach);
          if (hS > myHeight && uSunDir.z > 0.1 && (1.0 - subUv.y) < lowAngleReach) shadowMask = max(shadowMask, 1.0 - (1.0 - subUv.y) / lowAngleReach);
          if (hN > myHeight && uSunDir.z < -0.1 && subUv.y < lowAngleReach) shadowMask = max(shadowMask, 1.0 - subUv.y / lowAngleReach);

          float higherEdge = 2.0;
          if (hN > myHeight) higherEdge = min(higherEdge, subUv.y);
          if (hW > myHeight) higherEdge = min(higherEdge, subUv.x);
          if (hS > myHeight) higherEdge = min(higherEdge, 1.0 - subUv.y);
          if (hE > myHeight) higherEdge = min(higherEdge, 1.0 - subUv.x);
          if (higherEdge < 0.22) shadowMask = max(shadowMask, (1.0 - smoothstep(0.0, 0.22, higherEdge)) * 0.75);
          if (shadowMask > 0.01) col *= mix(vec3(1.0), uShadowTint * 0.62, clamp(shadowMask, 0.0, 1.0));

          if (abs(myCode - 22.0) > 0.5) {
            float slopeSun = clamp(((hW - hE) * uSunDir.x + (hN - hS) * uSunDir.z) * 0.35 + 0.5, 0.0, 1.0);
            vec3 todBiomeGrade = mix(uShadowTint, uSunTint, mix(0.68, 0.34, uDarkness) * (0.65 + 0.35 * slopeSun));
            col *= todBiomeGrade;
          } else {
            float voidRim = 0.0;
            if (abs(cN - 22.0) > 0.5 && subUv.y < 0.16) voidRim = max(voidRim, 1.0 - subUv.y / 0.16);
            if (abs(cS - 22.0) > 0.5 && (1.0 - subUv.y) < 0.16) voidRim = max(voidRim, 1.0 - (1.0 - subUv.y) / 0.16);
            if (abs(cW - 22.0) > 0.5 && subUv.x < 0.16) voidRim = max(voidRim, 1.0 - subUv.x / 0.16);
            if (abs(cE - 22.0) > 0.5 && (1.0 - subUv.x) < 0.16) voidRim = max(voidRim, 1.0 - (1.0 - subUv.x) / 0.16);
            if (voidRim > 0.05) {
              float oozePulse = 0.7 + 0.3 * sin(uTime * 4.5 + pixPos.x * 2.0 + pixPos.y * 2.0);
              col = mix(col, landSrgb(124.0, 58.0, 237.0), voidRim * 0.55 * oozePulse);
            }
          }
  `;

  const terrainMaterialMap = new Map<TerrainType, THREE.MeshStandardMaterial[]>();
  const buildLegacyTopMaterial = (
    tCode: number,
    roughness: number,
    metalness: number,
  ): THREE.MeshStandardMaterial => {
    const topMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness,
      metalness,
    });
    topMat.customProgramCacheKey = () => 'aeon_land_top_pixel_v17';
    topMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = sharedTime;
      shader.uniforms.uEpoch = sharedEpoch;
      shader.uniforms.uGridSize = sharedGridSize;
      shader.uniforms.uLandMap = sharedLandMap;
      shader.uniforms.uZoneColorMap = sharedZoneColorMap;
      shader.uniforms.uZoneIdMap = sharedZoneIdMap;
      shader.uniforms.uZoneActive = sharedZoneActive;
      shader.uniforms.uCityLightMap = sharedCityLightMap;
      shader.uniforms.uDarkness = sharedDarkness;
      shader.uniforms.uSunDir = sharedSunDir;
      shader.uniforms.uSunTint = sharedSunTint;
      shader.uniforms.uShadowTint = sharedShadowTint;
      shader.uniforms.uSeasonWeights = sharedSeasonWeights;
      shader.uniforms.uDefaultCode = { value: tCode };
      patchVertexShader(shader);

      shader.fragmentShader =
        `uniform float uDefaultCode;\n` +
        orderedHelpers +
        shader.fragmentShader
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            vec2 pixPos = vec2(0.0);
            vec2 tileCoord = vec2(0.0);
            vec2 subUv = vec2(0.5);
            float myCode = 0.0;
            vec3 col = vec3(0.0);
            ${sharedTopSurfaceColorGlsl}
            diffuseColor.rgb = col;`,
          )
          .replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
            if (abs(myCode - 22.0) < 0.5) {
              gl_FragColor.rgb = col;
            }
            if (uDarkness > 0.03) {
              vec3 nightCityGlow = computeCityNightGlow(pixPos, tileCoord, subUv, myCode, uTime, uEpoch, uDarkness);
              gl_FragColor.rgb += nightCityGlow * 0.62;
            }
            if (uZoneActive > 0.5) {
              vec4 zCol = sampleLandZoneColor(tileCoord);
              vec4 zId = sampleLandZoneId(tileCoord);
              if (zCol.a > 0.01) {
                vec4 zN = sampleLandZoneId(tileCoord + vec2(0.0, -1.0));
                vec4 zS = sampleLandZoneId(tileCoord + vec2(0.0, 1.0));
                vec4 zW = sampleLandZoneId(tileCoord + vec2(-1.0, 0.0));
                vec4 zE = sampleLandZoneId(tileCoord + vec2(1.0, 0.0));
                vec4 zNW = sampleLandZoneId(tileCoord + vec2(-1.0, -1.0));
                vec4 zNE = sampleLandZoneId(tileCoord + vec2(1.0, -1.0));
                vec4 zSW = sampleLandZoneId(tileCoord + vec2(-1.0, 1.0));
                vec4 zSE = sampleLandZoneId(tileCoord + vec2(1.0, 1.0));
                vec4 zN2 = sampleLandZoneId(tileCoord + vec2(0.0, -2.0));
                vec4 zS2 = sampleLandZoneId(tileCoord + vec2(0.0, 2.0));
                vec4 zW2 = sampleLandZoneId(tileCoord + vec2(-2.0, 0.0));
                vec4 zE2 = sampleLandZoneId(tileCoord + vec2(2.0, 0.0));

                bool diffN = abs(zN.r - zId.r) > 0.002 || abs(zN.g - zId.g) > 0.002;
                bool diffS = abs(zS.r - zId.r) > 0.002 || abs(zS.g - zId.g) > 0.002;
                bool diffW = abs(zW.r - zId.r) > 0.002 || abs(zW.g - zId.g) > 0.002;
                bool diffE = abs(zE.r - zId.r) > 0.002 || abs(zE.g - zId.g) > 0.002;
                bool diffNW = abs(zNW.r - zId.r) > 0.002 || abs(zNW.g - zId.g) > 0.002;
                bool diffNE = abs(zNE.r - zId.r) > 0.002 || abs(zNE.g - zId.g) > 0.002;
                bool diffSW = abs(zSW.r - zId.r) > 0.002 || abs(zSW.g - zId.g) > 0.002;
                bool diffSE = abs(zSE.r - zId.r) > 0.002 || abs(zSE.g - zId.g) > 0.002;
                bool diffN2 = abs(zN2.r - zId.r) > 0.002 || abs(zN2.g - zId.g) > 0.002;
                bool diffS2 = abs(zS2.r - zId.r) > 0.002 || abs(zS2.g - zId.g) > 0.002;
                bool diffW2 = abs(zW2.r - zId.r) > 0.002 || abs(zW2.g - zId.g) > 0.002;
                bool diffE2 = abs(zE2.r - zId.r) > 0.002 || abs(zE2.g - zId.g) > 0.002;

                bool isOuterBorderTile = diffN || diffS || diffW || diffE || diffNW || diffNE || diffSW || diffSE;
                bool isInnerBorderTile = !isOuterBorderTile && (diffN2 || diffS2 || diffW2 || diffE2);
                float outerDarkW = 0.44;
                bool onDarkOuterStroke =
                  (diffN && subUv.y < outerDarkW) ||
                  (diffS && subUv.y > 1.0 - outerDarkW) ||
                  (diffW && subUv.x < outerDarkW) ||
                  (diffE && subUv.x > 1.0 - outerDarkW) ||
                  (diffNW && subUv.x < outerDarkW && subUv.y < outerDarkW) ||
                  (diffNE && subUv.x > 1.0 - outerDarkW && subUv.y < outerDarkW) ||
                  (diffSW && subUv.x < outerDarkW && subUv.y > 1.0 - outerDarkW) ||
                  (diffSE && subUv.x > 1.0 - outerDarkW && subUv.y > 1.0 - outerDarkW);
                bool isHovered = zId.b > 0.5;
                float hoverPulse = isHovered ? (0.16 + 0.09 * sin(uTime * 5.0)) : 0.0;
                if (onDarkOuterStroke) {
                  vec3 outerCol = zCol.rgb * (isHovered ? 0.52 : 0.36);
                  gl_FragColor.rgb = mix(gl_FragColor.rgb, outerCol, 0.96);
                } else if (isOuterBorderTile || isInnerBorderTile) {
                  vec3 rimCol = zCol.rgb * (isHovered ? 0.64 : 0.46);
                  gl_FragColor.rgb = mix(gl_FragColor.rgb, rimCol, isOuterBorderTile ? 0.95 : 0.90);
                } else {
                  float fillAlpha = zCol.a * 0.54 + hoverPulse;
                  gl_FragColor.rgb = mix(gl_FragColor.rgb, zCol.rgb, clamp(fillAlpha, 0.0, 0.78));
                }
              }
            }`,
          );
    };
    createdMaterials.push(topMat);
    return topMat;
  };

  // Unified single-draw-call chunk material combining exact topMat & cliffMat shaders by normal.y.
  // Shared by BOTH solidMesh AND waterMesh so WebGL compiles only ONE terrain shader program!
  const unifiedMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.05,
  });
  unifiedMat.customProgramCacheKey = () => 'aeon_land_unified_chunk_v4';
  unifiedMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedTime;
    shader.uniforms.uEpoch = sharedEpoch;
    shader.uniforms.uGridSize = sharedGridSize;
    shader.uniforms.uLandMap = sharedLandMap;
    shader.uniforms.uZoneColorMap = sharedZoneColorMap;
    shader.uniforms.uZoneIdMap = sharedZoneIdMap;
    shader.uniforms.uZoneActive = sharedZoneActive;
    shader.uniforms.uCityLightMap = sharedCityLightMap;
    shader.uniforms.uDarkness = sharedDarkness;
    shader.uniforms.uSunDir = sharedSunDir;
    shader.uniforms.uSunTint = sharedSunTint;
    shader.uniforms.uShadowTint = sharedShadowTint;
    shader.uniforms.uSeasonWeights = sharedSeasonWeights;
    shader.uniforms.uDefaultCode = { value: -1.0 };
    patchVertexShader(shader);

    shader.fragmentShader =
      `uniform float uDefaultCode;\n` +
      orderedHelpers +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
        bool aeonIsTop = abs(vLandWorldNormal.y) > 0.5;
        vec2 pixPos = vec2(0.0);
        vec2 tileCoord = vec2(0.0);
        vec2 subUv = vec2(0.5);
        float myCode = 0.0;
        vec3 col = vec3(0.0);
        vec2 cliffOwnerCoord = vec2(0.0);
        vec2 cliffNeighborCoord = vec2(0.0);
        float ownerCode = 0.0;
        if (aeonIsTop) {
          ${sharedTopSurfaceColorGlsl}
          diffuseColor.rgb = col;
        } else {
          float wallU = abs(vLandWorldNormal.x) > 0.5 ? vLandWorldPos.z : vLandWorldPos.x;
          vec2 wallPix = floor(vec2(wallU, vLandWorldPos.y) * 16.0) / 16.0;
          vec2 wallChunk = floor(wallPix * 8.0) / 8.0;

          cliffOwnerCoord = floor(vLandWorldPos.xz + 0.5 - vLandWorldNormal.xz * 0.25);
          cliffNeighborCoord = floor(vLandWorldPos.xz + 0.5 + vLandWorldNormal.xz * 0.25);
          vec4 ownerSample = sampleLandTile(cliffOwnerCoord);
          ownerCode = decodeTerrain(ownerSample);
          float ownerH = floor(ownerSample.g * 255.0 / 20.0 + 0.5);
          float distFromTop = max(0.0, ownerH * 0.45 - vLandWorldPos.y);
          float neighborCode = decodeTerrain(sampleLandTile(cliffNeighborCoord));
          bool isVoidWall = abs(ownerCode - 22.0) < 0.5 || abs(neighborCode - 22.0) < 0.5;
          bool isCraterWall = abs(ownerCode - 12.0) < 0.5 || abs(neighborCode - 12.0) < 0.5 || abs(ownerCode - 24.0) < 0.5 || abs(neighborCode - 24.0) < 0.5;
          bool isBlightWall = abs(ownerCode - 25.0) < 0.5 || abs(neighborCode - 25.0) < 0.5;
          bool isFloralWall = abs(ownerCode - 26.0) < 0.5;
          bool isBadlandsWall = abs(ownerCode - 19.0) < 0.5 || abs(neighborCode - 19.0) < 0.5;
          bool isMountainWall = abs(ownerCode - 16.0) < 0.5 || abs(ownerCode - 11.0) < 0.5 || abs(ownerCode - 8.0) < 0.5 || abs(ownerCode - 10.0) < 0.5 || abs(ownerCode - 18.0) < 0.5;
          bool isSandWall = abs(ownerCode - 2.0) < 0.5;
          bool isSwampWall = abs(ownerCode - 7.0) < 0.5;
          bool isSavannaWall = abs(ownerCode - 6.0) < 0.5;
          bool isTaigaWall = abs(ownerCode - 17.0) < 0.5;
          bool isBlossomWall = abs(ownerCode - 20.0) < 0.5;
          bool isEarthBank =
            !isVoidWall && !isCraterWall && !isBlightWall && !isBadlandsWall && !isMountainWall &&
            (abs(ownerCode - 3.0) < 0.5 || abs(ownerCode - 4.0) < 0.5 || abs(ownerCode - 5.0) < 0.5 ||
             abs(ownerCode - 6.0) < 0.5 || abs(ownerCode - 15.0) < 0.5 || abs(ownerCode - 17.0) < 0.5 ||
             abs(ownerCode - 20.0) < 0.5) &&
            (ownerH <= 3.5 || distFromTop < 0.52);
          bool isUrbanRetainingWall =
            !isVoidWall && !isCraterWall && !isBlightWall &&
            (abs(ownerCode - 9.0) < 0.5 || abs(ownerCode - 14.0) < 0.5 || abs(ownerCode - 21.0) < 0.5);

          float strata = landNoise(vec2(wallChunk.x * 0.65, wallChunk.y * 2.2));
          float brickRow = floor(wallPix.y * 4.0);
          float brickCol = floor((wallPix.x + mod(brickRow, 2.0) * 0.25) * 2.0);
          float seam = step(0.86, fract(wallPix.y * 4.0)) + step(0.91, fract((wallPix.x + mod(brickRow, 2.0) * 0.25) * 2.0));
          float brickTone = landHash12(vec2(brickCol, brickRow));
          float pixGrain = landHash12(floor(wallPix * 16.0));
          float lipJitter = (landHash12(vec2(floor(wallU * 8.0), 3.7)) - 0.5) * 0.07;

          vec3 cliffCol;
          if (isUrbanRetainingWall) {
            if (uEpoch >= 3.5) {
              vec3 concBase = uEpoch >= 5.5 ? landSrgb(112.0, 126.0, 144.0) : landSrgb(122.0, 130.0, 138.0);
              vec3 concHi   = uEpoch >= 5.5 ? landSrgb(148.0, 164.0, 184.0) : landSrgb(154.0, 162.0, 170.0);
              vec3 concSh   = uEpoch >= 5.5 ? landSrgb(68.0, 78.0, 92.0)    : landSrgb(74.0, 82.0, 90.0);
              float panelSeam = max(step(0.88, fract(wallPix.y * 2.5)), step(0.90, fract(wallPix.x * 1.5)));
              float panelTone = landHash12(floor(vec2(wallPix.x * 1.5, wallPix.y * 2.5)));
              cliffCol = mix(concBase, concHi, step(0.62, panelTone));
              cliffCol = mix(cliffCol, concSh, panelSeam * 0.72);
              if (uEpoch >= 5.5 && abs(fract(wallPix.y * 1.2) - 0.5) < 0.08) {
                cliffCol = mix(cliffCol, landSrgb(86.0, 207.0, 225.0), 0.52);
              }
            } else {
              vec3 ashlarBase = landSrgb(126.0, 120.0, 114.0);
              vec3 ashlarHi   = landSrgb(158.0, 152.0, 142.0);
              vec3 ashlarSh   = landSrgb(78.0, 74.0, 70.0);
              cliffCol = mix(ashlarSh, ashlarBase, step(0.28, brickTone));
              cliffCol = mix(cliffCol, ashlarHi, step(0.68, brickTone));
              cliffCol = mix(cliffCol, ashlarSh, clamp(seam, 0.0, 1.0) * 0.78);
            }
          } else if (isSandWall) {
            // Layered warm beach / shoal sand bank (dry pale sand lip -> warm golden sand -> damp ochre base)
            vec3 sandHi   = landSrgb(226.0, 208.0, 166.0);
            vec3 sandBase = landSrgb(196.0, 172.0, 126.0);
            vec3 sandSh   = landSrgb(156.0, 134.0, 96.0);
            cliffCol = mix(sandSh, sandBase, step(0.28, strata * 0.65 + pixGrain * 0.35));
            cliffCol = mix(cliffCol, sandHi, step(0.72, strata * 0.55 + pixGrain * 0.45));
            if (distFromTop < 0.09 + lipJitter) {
              cliffCol = mix(cliffCol, sandHi, 0.75);
            }
          } else if (isSwampWall) {
            // Wet muddy peat & tangled mangrove-root bank with mossy overhang lip
            vec3 mudSh   = landSrgb(46.0, 38.0, 28.0);
            vec3 mudBase = landSrgb(72.0, 58.0, 42.0);
            vec3 mudHi   = landSrgb(98.0, 82.0, 58.0);
            cliffCol = mix(mudSh, mudBase, step(0.30, strata * 0.65 + pixGrain * 0.35));
            cliffCol = mix(cliffCol, mudHi, step(0.72, strata * 0.6 + pixGrain * 0.4));
            if (distFromTop < 0.09 + lipJitter) {
              cliffCol = mix(landSrgb(58.0, 92.0, 52.0), landSrgb(78.0, 114.0, 62.0), step(0.5, pixGrain));
            }
          } else if (isEarthBank) {
            // Natural earthy loam riverbank with overhanging biome turf lip
            vec3 dirtSh   = landSrgb(78.0, 56.0, 38.0);
            vec3 dirtBase = landSrgb(116.0, 86.0, 58.0);
            vec3 dirtHi   = landSrgb(142.0, 108.0, 76.0);
            cliffCol = mix(dirtSh, dirtBase, step(0.30, strata * 0.65 + pixGrain * 0.35));
            cliffCol = mix(cliffCol, dirtHi, step(0.74, strata * 0.6 + pixGrain * 0.4));
            if (distFromTop < 0.10 + lipJitter) {
              vec3 turfCol = isSavannaWall
                ? landSrgb(164.0, 142.0, 72.0)
                : isTaigaWall
                  ? landSrgb(68.0, 108.0, 76.0)
                  : isBlossomWall
                    ? landSrgb(116.0, 160.0, 92.0)
                    : landSrgb(86.0, 142.0, 70.0);
              cliffCol = mix(turfCol * 0.84, turfCol, step(0.45, pixGrain));
            }
          } else {
            vec3 stoneBase = isVoidWall
              ? vec3(0.015, 0.008, 0.035)
              : isBlightWall
                ? landSrgb(48.0, 22.0, 68.0)
                : isCraterWall
                  ? landSrgb(44.0, 32.0, 30.0)
                  : isFloralWall
                    ? landSrgb(92.0, 118.0, 88.0)
                    : isBadlandsWall
                      ? landSrgb(162.0, 82.0, 48.0)
                      : isMountainWall
                        ? landSrgb(88.0, 96.0, 106.0)
                        : landSrgb(74.0, 89.0, 95.0);
            vec3 stoneHi = isVoidWall
              ? landSrgb(58.0, 24.0, 96.0)
              : isBlightWall
                ? landSrgb(76.0, 38.0, 104.0)
                : isCraterWall
                  ? landSrgb(78.0, 52.0, 42.0)
                  : isFloralWall
                    ? landSrgb(132.0, 168.0, 116.0)
                    : isBadlandsWall
                      ? landSrgb(206.0, 122.0, 72.0)
                      : isMountainWall
                        ? landSrgb(126.0, 136.0, 146.0)
                        : landSrgb(104.0, 122.0, 129.0);
            vec3 stoneSh = isVoidWall
              ? vec3(0.004, 0.002, 0.012)
              : isBlightWall
                ? landSrgb(24.0, 10.0, 36.0)
                : isCraterWall
                  ? landSrgb(22.0, 15.0, 16.0)
                  : isFloralWall
                    ? landSrgb(56.0, 78.0, 54.0)
                    : isBadlandsWall
                      ? landSrgb(106.0, 52.0, 32.0)
                      : isMountainWall
                        ? landSrgb(54.0, 60.0, 68.0)
                        : landSrgb(45.0, 56.0, 61.0);

            cliffCol = mix(stoneSh, stoneBase, step(0.32, strata * 0.7 + brickTone * 0.3));
            cliffCol = mix(cliffCol, stoneHi, step(0.68, strata * 0.65 + brickTone * 0.35));
            cliffCol = mix(cliffCol, stoneSh, clamp(seam, 0.0, 1.0) * 0.65);

            if (isVoidWall) {
              float wallStar = landHash12(floor(wallPix * 16.0 + vec2(uTime * 2.2, -uTime * 1.4)));
              if (wallStar > 0.962) cliffCol = mix(cliffCol, vec3(0.75, 0.62, 1.0), 0.92);
            } else if (isBlightWall) {
              float toxVein = step(0.80, strata * 0.6 + brickTone * 0.4);
              cliffCol = mix(cliffCol, landSrgb(74.0, 222.0, 128.0), toxVein * 0.78);
            } else if (isCraterWall) {
              float emberVein = step(0.76, strata * 0.6 + brickTone * 0.4);
              cliffCol = mix(cliffCol, landSrgb(255.0, 112.0, 24.0), emberVein * 0.85);
            }
          }

          cliffCol = applySeasonalCliffColor(
            cliffCol,
            isEarthBank,
            isSwampWall,
            isMountainWall,
            isVoidWall,
            isCraterWall,
            isBlightWall,
            isSandWall,
            isBadlandsWall,
            isUrbanRetainingWall,
            distFromTop,
            lipJitter,
            pixGrain
          );

          float sunSide = clamp(dot(vLandWorldNormal, normalize(uSunDir)) * 0.5 + 0.5, 0.0, 1.0);
          vec3 todCliffGrade = mix(uShadowTint * 0.78, uSunTint * 1.14, sunSide);
          cliffCol *= todCliffGrade;
          if (vLandWorldPos.y < 0.48) {
            cliffCol *= mix(0.68, 1.0, smoothstep(0.26, 0.48, vLandWorldPos.y));
          }
          diffuseColor.rgb = cliffCol;
        }`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
        if (aeonIsTop) {
          if (abs(myCode - 13.0) < 0.5) roughnessFactor = 0.34;
          else if (abs(myCode - 9.0) < 0.5) roughnessFactor = 0.65;
          else if (abs(myCode - 11.0) < 0.5 || abs(myCode - 18.0) < 0.5) roughnessFactor = 0.68;
          else roughnessFactor = 0.82;
        } else {
          roughnessFactor = 0.84;
        }`,
        )
        .replace(
          '#include <metalnessmap_fragment>',
          `#include <metalnessmap_fragment>
        if (aeonIsTop) {
          if (abs(myCode - 13.0) < 0.5) metalnessFactor = 0.28;
          else if (abs(myCode - 10.0) < 0.5 || abs(myCode - 16.0) < 0.5) metalnessFactor = 0.12;
          else metalnessFactor = 0.05;
        } else {
          metalnessFactor = 0.08;
        }`,
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
        if (aeonIsTop && abs(myCode - 22.0) < 0.5) {
          gl_FragColor.rgb = col;
        }
        // SINGLE computeCityNightGlow call site for both tops and cliffs (halves inlined IR!)
        if (uDarkness > 0.03) {
          vec2 glowPix = aeonIsTop ? pixPos : (cliffOwnerCoord + vec2(0.5));
          vec2 glowTile = aeonIsTop ? tileCoord : cliffOwnerCoord;
          vec2 glowSubUv = aeonIsTop ? subUv : vec2(0.5);
          float glowCode = aeonIsTop ? myCode : ownerCode;
          float glowWeight = aeonIsTop ? 0.62 : 0.45;
          gl_FragColor.rgb += computeCityNightGlow(glowPix, glowTile, glowSubUv, glowCode, uTime, uEpoch, uDarkness) * glowWeight;
        }
        if (uZoneActive > 0.5) {
          if (aeonIsTop) {
            vec4 zCol = sampleLandZoneColor(tileCoord);
            vec4 zId = sampleLandZoneId(tileCoord);
            if (zCol.a > 0.01) {
              vec4 zN = sampleLandZoneId(tileCoord + vec2(0.0, -1.0));
              vec4 zS = sampleLandZoneId(tileCoord + vec2(0.0, 1.0));
              vec4 zW = sampleLandZoneId(tileCoord + vec2(-1.0, 0.0));
              vec4 zE = sampleLandZoneId(tileCoord + vec2(1.0, 0.0));
              vec4 zNW = sampleLandZoneId(tileCoord + vec2(-1.0, -1.0));
              vec4 zNE = sampleLandZoneId(tileCoord + vec2(1.0, -1.0));
              vec4 zSW = sampleLandZoneId(tileCoord + vec2(-1.0, 1.0));
              vec4 zSE = sampleLandZoneId(tileCoord + vec2(1.0, 1.0));
              vec4 zN2 = sampleLandZoneId(tileCoord + vec2(0.0, -2.0));
              vec4 zS2 = sampleLandZoneId(tileCoord + vec2(0.0, 2.0));
              vec4 zW2 = sampleLandZoneId(tileCoord + vec2(-2.0, 0.0));
              vec4 zE2 = sampleLandZoneId(tileCoord + vec2(2.0, 0.0));

              bool diffN = abs(zN.r - zId.r) > 0.002 || abs(zN.g - zId.g) > 0.002;
              bool diffS = abs(zS.r - zId.r) > 0.002 || abs(zS.g - zId.g) > 0.002;
              bool diffW = abs(zW.r - zId.r) > 0.002 || abs(zW.g - zId.g) > 0.002;
              bool diffE = abs(zE.r - zId.r) > 0.002 || abs(zE.g - zId.g) > 0.002;
              bool diffNW = abs(zNW.r - zId.r) > 0.002 || abs(zNW.g - zId.g) > 0.002;
              bool diffNE = abs(zNE.r - zId.r) > 0.002 || abs(zNE.g - zId.g) > 0.002;
              bool diffSW = abs(zSW.r - zId.r) > 0.002 || abs(zSW.g - zId.g) > 0.002;
              bool diffSE = abs(zSE.r - zId.r) > 0.002 || abs(zSE.g - zId.g) > 0.002;
              bool diffN2 = abs(zN2.r - zId.r) > 0.002 || abs(zN2.g - zId.g) > 0.002;
              bool diffS2 = abs(zS2.r - zId.r) > 0.002 || abs(zS2.g - zId.g) > 0.002;
              bool diffW2 = abs(zW2.r - zId.r) > 0.002 || abs(zW2.g - zId.g) > 0.002;
              bool diffE2 = abs(zE2.r - zId.r) > 0.002 || abs(zE2.g - zId.g) > 0.002;

              bool isOuterBorderTile = diffN || diffS || diffW || diffE || diffNW || diffNE || diffSW || diffSE;
              bool isInnerBorderTile = !isOuterBorderTile && (diffN2 || diffS2 || diffW2 || diffE2);
              float outerDarkW = 0.44;
              bool onDarkOuterStroke =
                (diffN && subUv.y < outerDarkW) ||
                (diffS && subUv.y > 1.0 - outerDarkW) ||
                (diffW && subUv.x < outerDarkW) ||
                (diffE && subUv.x > 1.0 - outerDarkW) ||
                (diffNW && subUv.x < outerDarkW && subUv.y < outerDarkW) ||
                (diffNE && subUv.x > 1.0 - outerDarkW && subUv.y < outerDarkW) ||
                (diffSW && subUv.x < outerDarkW && subUv.y > 1.0 - outerDarkW) ||
                (diffSE && subUv.x > 1.0 - outerDarkW && subUv.y > 1.0 - outerDarkW);
              bool isHovered = zId.b > 0.5;
              float hoverPulse = isHovered ? (0.16 + 0.09 * sin(uTime * 5.0)) : 0.0;
              if (onDarkOuterStroke) {
                vec3 outerCol = zCol.rgb * (isHovered ? 0.52 : 0.36);
                gl_FragColor.rgb = mix(gl_FragColor.rgb, outerCol, 0.96);
              } else if (isOuterBorderTile || isInnerBorderTile) {
                vec3 rimCol = zCol.rgb * (isHovered ? 0.64 : 0.46);
                gl_FragColor.rgb = mix(gl_FragColor.rgb, rimCol, isOuterBorderTile ? 0.95 : 0.90);
              } else {
                float fillAlpha = zCol.a * 0.54 + hoverPulse;
                gl_FragColor.rgb = mix(gl_FragColor.rgb, zCol.rgb, clamp(fillAlpha, 0.0, 0.78));
              }
            }
          } else {
            vec4 zCol = sampleLandZoneColor(cliffOwnerCoord);
            vec4 zId = sampleLandZoneId(cliffOwnerCoord);
            vec4 zNbId = sampleLandZoneId(cliffNeighborCoord);
            if (zCol.a > 0.01) {
              bool diffCliff = abs(zNbId.r - zId.r) > 0.002 || abs(zNbId.g - zId.g) > 0.002;
              bool isHovered = zId.b > 0.5;
              if (diffCliff) {
                vec3 rimCol = zCol.rgb * (isHovered ? 0.56 : 0.40);
                gl_FragColor.rgb = mix(gl_FragColor.rgb, rimCol, 0.95);
              } else {
                float hBoost = isHovered ? 0.16 : 0.0;
                gl_FragColor.rgb = mix(gl_FragColor.rgb, zCol.rgb, clamp(zCol.a * 0.52 + hBoost, 0.0, 0.76));
              }
            }
          }
        }`,
        );
  };
  createdMaterials.push(unifiedMat);

  // Chunk top material aliases unifiedMat so waterMesh & solidMesh share a SINGLE compiled WebGL program!
  const chunkTopMat = unifiedMat;

  // Reusable O(N) Chamfer distance-transform buffers for fast 512x512 bathymetry (replaces 81x nested scan)
  const totalMapCells = gridSize * gridSize;
  const distToLand = new Uint8Array(totalMapCells);
  const distToShallow = new Uint8Array(totalMapCells);
  const distToDeep = new Uint8Array(totalMapCells);

  const runChamferPass = (buf: Uint8Array) => {
    // Forward pass (top-left -> bottom-right), scaled by 10 (orthogonal=10, diagonal=14)
    for (let z = 0; z < gridSize; z++) {
      const row = z * gridSize;
      for (let x = 0; x < gridSize; x++) {
        const i = row + x;
        let d = buf[i];
        if (d === 0) continue;
        if (x > 0) {
          const cand = buf[i - 1] + 10;
          if (cand < d) d = cand;
        }
        if (z > 0) {
          const up = i - gridSize;
          const candU = buf[up] + 10;
          if (candU < d) d = candU;
          if (x > 0) {
            const candUL = buf[up - 1] + 14;
            if (candUL < d) d = candUL;
          }
          if (x + 1 < gridSize) {
            const candUR = buf[up + 1] + 14;
            if (candUR < d) d = candUR;
          }
        }
        buf[i] = d;
      }
    }
    // Backward pass (bottom-right -> top-left)
    for (let z = gridSize - 1; z >= 0; z--) {
      const row = z * gridSize;
      for (let x = gridSize - 1; x >= 0; x--) {
        const i = row + x;
        let d = buf[i];
        if (d === 0) continue;
        if (x + 1 < gridSize) {
          const cand = buf[i + 1] + 10;
          if (cand < d) d = cand;
        }
        if (z + 1 < gridSize) {
          const dn = i + gridSize;
          const candD = buf[dn] + 10;
          if (candD < d) d = candD;
          if (x + 1 < gridSize) {
            const candDR = buf[dn + 1] + 14;
            if (candDR < d) d = candDR;
          }
          if (x > 0) {
            const candDL = buf[dn - 1] + 14;
            if (candDL < d) d = candDL;
          }
        }
        buf[i] = d;
      }
    }
  };

  let bathymetryReady = false;

  const updateMap = (
    tiles: TileData[],
    buildings?: BuildingEntity[],
    settlementSpecies?: Record<string, SpeciesId>,
    waterChanged = true,
  ) => {
    cityLightBytes.fill(0);
    if (!bathymetryReady || waterChanged) {
      distToLand.fill(60);
      distToShallow.fill(60);
      distToDeep.fill(60);

      // Seed distance transform in one O(N) pass
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        if (t.height > 0) {
          distToLand[i] = 0;
          distToShallow[i] = 0;
        } else if (t.terrain === 'deep_water' && !t.isRiver && !t.isLake) {
          distToDeep[i] = 0;
        } else {
          distToShallow[i] = 0;
        }
      }
      runChamferPass(distToLand);
      runChamferPass(distToShallow);
      runChamferPass(distToDeep);
      bathymetryReady = true;
    }

    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const idx = i * 4;
      let code = STYLED_TERRAIN_CODE[t.terrain] ?? 3;
      if (t.height === 0) {
        if (t.waterKind === 'lava') code = 24;
        else if (t.waterKind === 'poison') code = 25;
      }
      data[idx] = Math.min(255, code * 8);
      data[idx + 1] = Math.min(255, t.height * 20);
      if (t.height === 0) {
        // Encode smooth bathymetric seabed depth (0 = sunlit coastal/reef sand .. 255 = deep abyssal floor)
        // Alpha channel on height===0 tiles marks freshwater bed type: 0 = sea, 128 = riverbed, 255 = lakebed
        const isReefOrSanctuary =
          (t.resourceNode === 'coral_reef' && (t.coralBleachTimer ?? 0) <= 0 && t.resourceAmount > 0) ||
          t.resourceNode === 'atlantis_ruin';
        if (isReefOrSanctuary) {
          data[idx + 2] = 0;
          data[idx + 3] = 0;
        } else if (t.isLake && !t.waterKind) {
          const landD = Math.min(3.5, distToLand[i] * 0.1);
          const lakeFrac = Math.max(0, Math.min(1, (landD - 0.5) / 2.8));
          data[idx + 2] = Math.round(lakeFrac * 195);
          data[idx + 3] = 255;
        } else if (t.isRiver && !t.waterKind) {
          const landD = Math.min(2.2, distToLand[i] * 0.1);
          const riverFrac = Math.max(0, Math.min(1, (landD - 0.5) / 1.5));
          data[idx + 2] = Math.round(riverFrac * 110);
          data[idx + 3] = 128;
        } else if (t.terrain !== 'deep_water') {
          const landD = Math.min(4.0, distToLand[i] * 0.1);
          const deepD = Math.min(4.0, distToDeep[i] * 0.1);
          const shoreFrac = Math.max(0, Math.min(1, (landD - 1.0) / 3.0));
          const dropFrac = Math.max(0, Math.min(1, (3.2 - deepD) / 2.2));
          data[idx + 2] = Math.round(shoreFrac * 42 + dropFrac * 68);
          data[idx + 3] = 0;
        } else {
          const shallowD = Math.min(4.5, distToShallow[i] * 0.1);
          const slopeFrac = Math.max(0, Math.min(1, (shallowD - 1.0) / 3.2));
          data[idx + 2] = Math.round(135 + slopeFrac * 120);
          data[idx + 3] = 0;
        }
      } else {
        data[idx + 2] = Math.abs(((t.x * 73856093) ^ (t.z * 19349663)) | 0) & 255;
        data[idx + 3] = (t.crushedTimer ?? 0) > 0 ? 110 : t.farmSettlementId ? 255 : 0;
      }

      if (t.height > 0 && (t.terrain === 'stone_road' || t.terrain === 'rail_track' || t.terrain === 'runway')) {
        cityLightBytes[idx + 1] = Math.max(cityLightBytes[idx + 1], 240);
        cityLightBytes[idx + 2] = 64;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            const nx = t.x + dx;
            const nz = t.z + dz;
            if (nx < 0 || nz < 0 || nx >= gridSize || nz >= gridSize) continue;
            const nIdx = (nz * gridSize + nx) * 4;
            const spill = Math.abs(dx) + Math.abs(dz) === 1 ? 135 : 75;
            if (spill > cityLightBytes[nIdx + 1]) {
              cityLightBytes[nIdx + 1] = spill;
            }
            if (cityLightBytes[nIdx + 2] === 0) cityLightBytes[nIdx + 2] = 64;
          }
        }
      }
    }

    if (buildings && buildings.length > 0) {
      for (let bi = 0; bi < buildings.length; bi++) {
        const b = buildings[bi];
        const bSpec =
          b.species ??
          (b.settlementId && settlementSpecies ? settlementSpecies[b.settlementId] : undefined) ??
          'human';
        const specByte =
          bSpec === 'elf'
            ? 160
            : bSpec === 'orc'
              ? 235
              : bSpec === 'dwarf'
                ? 112
                : bSpec === 'lizardfolk'
                  ? 196
                  : 64;
        const isMajor =
          b.type === 'bonfire' ||
          b.type === 'ziggurat' ||
          b.type === 'guildhall' ||
          b.type === 'airport' ||
          b.type === 'launch_arcology' ||
          b.type === 'dyson_spire' ||
          b.type === 'fission_reactor';
        const radius = isMajor ? 4 : 3;

        for (let dz = -radius; dz <= radius; dz++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = b.tileX + dx;
            const nz = b.tileZ + dz;
            if (nx < 0 || nz < 0 || nx >= gridSize || nz >= gridSize) continue;
            const dist = Math.hypot(dx, dz);
            if (dist > radius + 0.25) continue;
            const falloff = Math.max(0, 1 - dist / (radius + 0.35));
            const heatByte = Math.min(255, Math.round(Math.pow(falloff, 0.85) * 255));
            const cIdx = (nz * gridSize + nx) * 4;
            if (heatByte > cityLightBytes[cIdx]) {
              cityLightBytes[cIdx] = heatByte;
              cityLightBytes[cIdx + 2] = specByte;
            }
            if (dx === 0 && dz === 0) {
              cityLightBytes[cIdx + 3] = 255;
              cityLightBytes[cIdx + 2] = specByte;
            }
          }
        }
      }
    }

    landMapTex.needsUpdate = true;
    cityLightTex.needsUpdate = true;
  };

  const updateZones = (colorData: Uint8Array, idData: Uint8Array, anyActive: boolean) => {
    sharedZoneActive.value = anyActive ? 1 : 0;
    if (anyActive) {
      zoneColorBytes.set(colorData);
      zoneIdBytes.set(idData);
      zoneColorTex.needsUpdate = true;
      zoneIdTex.needsUpdate = true;
    }
  };

  const _targetSunDir = new THREE.Vector3();
  const _targetSunTint = new THREE.Vector3();
  const _targetShadowTint = new THREE.Vector3();

  const updateFrame = (
    elapsed: number,
    epochIndex = 0,
    preset: LightingPreset = 'noon',
    cyclePhase01 = 0,
    seasonWeights?: THREE.Vector4,
  ) => {
    sharedTime.value = wrapShaderTime(elapsed);
    sharedEpoch.value = epochIndex;
    if (seasonWeights) {
      sharedSeasonWeights.value.copy(seasonWeights);
    }

    const tod = getTimeOfDayLightingState(preset, cyclePhase01);
    sharedDarkness.value += (tod.darkness - sharedDarkness.value) * 0.08;

    _targetSunDir.set(tod.keyOffset[0], tod.keyOffset[1], tod.keyOffset[2]).normalize();
    sharedSunDir.value.lerp(_targetSunDir, 0.08).normalize();

    _targetSunTint.set(tod.terrainSunTint[0], tod.terrainSunTint[1], tod.terrainSunTint[2]);
    sharedSunTint.value.lerp(_targetSunTint, 0.08);

    _targetShadowTint.set(
      tod.terrainShadowTint[0],
      tod.terrainShadowTint[1],
      tod.terrainShadowTint[2],
    );
    sharedShadowTint.value.lerp(_targetShadowTint, 0.08);
  };

  const getMaterials = (terrain: TerrainType) => {
    const target = terrain in STYLED_TERRAIN_CODE ? terrain : 'grass';
    let mats = terrainMaterialMap.get(target);
    if (!mats) {
      const tCode = STYLED_TERRAIN_CODE[target];
      const roughness =
        target === 'crystal_field' ? 0.34 : target === 'stone_road' ? 0.65 : target === 'snow' || target === 'tundra' ? 0.68 : 0.82;
      const metalness = target === 'crystal_field' ? 0.28 : target === 'rock' || target === 'mountain' ? 0.12 : 0.05;
      const topMat = buildLegacyTopMaterial(tCode, roughness, metalness);
      mats = [cliffMat, cliffMat, topMat, cliffMat, cliffMat, cliffMat];
      terrainMaterialMap.set(target, mats);
    }
    return mats;
  };

  const getChunkMaterials = () => ({ topMat: chunkTopMat, cliffMat, unifiedMat });

  const dispose = () => {
    for (const m of createdMaterials) m.dispose();
    landMapTex.dispose();
    zoneColorTex.dispose();
    zoneIdTex.dispose();
    cityLightTex.dispose();
  };

  return { getMaterials, getChunkMaterials, updateMap, updateZones, updateFrame, dispose };
}

export interface PixelSpaceDebugState {
  seed: number;
  spaceQuality: number;
  bandAngle: number;
  bandWidth: number;
  starDensityBias: number;
  voidHex: string;
  bandAHex: string;
  bandBHex: string;
  coreHex: string;
}

export interface PixelSpaceSystem {
  mesh: THREE.Mesh;
  setSeed: (seed: number) => void;
  getSeed: () => number;
  getDebugState: () => PixelSpaceDebugState;
  setQuality: (quality: SkyCloudsQualityOption) => void;
  update: (params: {
    elapsed: number;
    width: number;
    height: number;
    viewportAspect?: number;
    pixelScale: number;
    camYaw: number;
    camX: number;
    camZ: number;
    frustumSize: number;
    preset: LightingPreset;
  }) => void;
  dispose: () => void;
}

interface SpacePalette {
  voidHex: string;
  bandAHex: string;
  bandBHex: string;
  coreHex: string;
}

const SPACE_PALETTES: SpacePalette[] = [
  {
    voidHex: '#050711',
    bandAHex: '#17234a',
    bandBHex: '#50468f',
    coreHex: '#ffdca8',
  },
  {
    voidHex: '#040910',
    bandAHex: '#112c3e',
    bandBHex: '#2f7b82',
    coreHex: '#ffe7ba',
  },
  {
    voidHex: '#080510',
    bandAHex: '#24163b',
    bandBHex: '#7d346b',
    coreHex: '#ffe0cf',
  },
  {
    voidHex: '#05070e',
    bandAHex: '#172440',
    bandBHex: '#3762a3',
    coreHex: '#ffcf91',
  },
  {
    voidHex: '#05080d',
    bandAHex: '#14223d',
    bandBHex: '#46549c',
    coreHex: '#fff0d1',
  },
  {
    voidHex: '#070512',
    bandAHex: '#1f1844',
    bandBHex: '#63419c',
    coreHex: '#f5d0ff',
  },
  {
    voidHex: '#040a0e',
    bandAHex: '#0f2b38',
    bandBHex: '#28706e',
    coreHex: '#d9fff5',
  },
  {
    voidHex: '#09060e',
    bandAHex: '#2d1a38',
    bandBHex: '#94435c',
    coreHex: '#ffd7b8',
  },
];

function tintPaletteColor(hexA: string, hexB: string, mixFrac: number, hueDelta: number): THREE.Color {
  const c = new THREE.Color(hexA).lerp(new THREE.Color(hexB), mixFrac);
  c.offsetHSL(hueDelta, 0, 0);
  return c;
}

export function createPixelSpaceSystem(initialSeed: number): PixelSpaceSystem {
  const geo = new THREE.PlaneGeometry(2, 2);

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(320, 180) },
    uViewportAspect: { value: 16 / 9 },
    uPixelStep: { value: 1.0 },
    uPixelScale: { value: 3.0 },
    uCamYaw: { value: Math.PI / 4 },
    uCamPan: { value: new THREE.Vector2(63.5, 63.5) },
    uFrustumSize: { value: 14.5 },
    uSeedVec: { value: new THREE.Vector2(0, 0) },
    uBandAngle: { value: 0.65 },
    uBandOffset: { value: 0.0 },
    uBandWidth: { value: 120.0 },
    uBandCurve: { value: 26.0 },
    uCoreShift: { value: 0.0 },
    uSecondStrength: { value: 0.45 },
    uSecondAngle: { value: -0.45 },
    uStarDensityBias: { value: 1.0 },
    uTempShift: { value: 0.0 },
    uVoidColor: { value: new THREE.Color('#050711') },
    uBandColorA: { value: new THREE.Color('#17234a') },
    uBandColorB: { value: new THREE.Color('#50468f') },
    uCoreColor: { value: new THREE.Color('#ffdca8') },
    uPresetTint: { value: new THREE.Color('#0a0d18') },
    uPresetStrength: { value: 1.0 },
    uSpaceQuality: { value: 2.0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    fog: false,
    transparent: false,
    depthTest: true,
    depthFunc: THREE.LessEqualDepth,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4(position.xy, 0.9998, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform float uViewportAspect;
      uniform float uPixelStep;
      uniform float uPixelScale;
      uniform float uCamYaw;
      uniform vec2 uCamPan;
      uniform float uFrustumSize;
      uniform vec2 uSeedVec;
      uniform float uBandAngle;
      uniform float uBandOffset;
      uniform float uBandWidth;
      uniform float uBandCurve;
      uniform float uCoreShift;
      uniform float uSecondStrength;
      uniform float uSecondAngle;
      uniform float uStarDensityBias;
      uniform float uTempShift;
      uniform vec3 uVoidColor;
      uniform vec3 uBandColorA;
      uniform vec3 uBandColorB;
      uniform vec3 uCoreColor;
      uniform vec3 uPresetTint;
      uniform float uPresetStrength;
      uniform float uSpaceQuality;

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      vec2 hash22(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.xx + p3.yz) * p3.zy);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash12(i);
        float b = hash12(i + vec2(1.0, 0.0));
        float c = hash12(i + vec2(0.0, 1.0));
        float d = hash12(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.56;
        mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
        for (int i = 0; i < 3; i++) {
          v += a * vnoise(p);
          p = rot * p * 2.02 + vec2(17.1, 31.7);
          a *= 0.5;
        }
        return v;
      }

      vec2 rot2(vec2 v, float a) {
        float s = sin(a);
        float c = cos(a);
        return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
      }

      // Branchless 4x4 ordered Bayer matrix in [0.03125 .. 0.96875]
      float bayer4x4(vec2 pix) {
        vec2 p = mod(floor(pix), 4.0);
        float hx = step(2.0, p.x);
        float hy = step(2.0, p.y);
        float lx = mod(p.x, 2.0);
        float ly = mod(p.y, 2.0);
        float mLow = 2.0 * abs(lx - ly) + ly;
        float mHigh = 2.0 * abs(hx - hy) + hy;
        return (4.0 * mLow + mHigh + 0.5) / 16.0;
      }

      vec3 starColorFromTemp(float t) {
        float shifted = clamp(t + uTempShift, 0.0, 1.0);
        if (shifted < 0.24) return vec3(0.62, 0.82, 1.0);       // Blue-white giant
        if (shifted < 0.58) return vec3(0.95, 0.97, 1.0);       // Crisp white star
        if (shifted < 0.82) return vec3(1.0, 0.91, 0.68);       // Warm golden star
        return vec3(1.0, 0.72, 0.54);                           // Ember orange dwarf
      }

      // Evaluates one pixel-snapped star layer across the 2x2 nearest sky cells so 3px/5px star arms
      // never clip or blink across cell boundaries during smooth camera zoom or rotation.
      vec3 evalStarLayer(
        vec2 pix,
        vec2 halfRes,
        vec2 skyP,
        vec2 skyOrigin,
        float zoomScale,
        float cellSize,
        float padFrac,
        float density,
        float seedBias,
        float bandWeight,
        float heroChance
      ) {
        vec2 baseCell = floor(skyP / cellSize - 0.5);
        vec3 acc = vec3(0.0);
        float scaledDensity = density * uStarDensityBias;
        float invBandW2 = 1.0 / max(2304.0, uBandWidth * uBandWidth);

        for (int oy = 0; oy <= 1; oy++) {
          for (int ox = 0; ox <= 1; ox++) {
            vec2 cell = baseCell + vec2(float(ox), float(oy));
            vec2 rnd = hash22(cell + uSeedVec + vec2(seedBias, seedBias * 1.7));
            vec2 starSky = (cell + padFrac + (1.0 - 2.0 * padFrac) * rnd) * cellSize;

            // Cell-invariant Milky Way proximity so all pixels of a 3px/5px star always agree
            vec2 starMw = rot2(starSky, uBandAngle);
            float starCurve = sin(starMw.x * 0.011 + uSeedVec.x * 0.1) * uBandCurve
                            + cos(starMw.x * 0.023 - uSeedVec.y * 0.1) * (uBandCurve * 0.45);
            float starDist = starMw.y - uBandOffset - starCurve;
            float cellBandMask = exp(-(starDist * starDist) * invBandW2) * bandWeight;
            float localDensity = clamp(scaledDensity + cellBandMask * scaledDensity * 1.55, 0.0, 0.92);

            float prob = hash12(cell * 1.37 + uSeedVec + vec2(seedBias * 2.3, 9.1));
            if (prob > localDensity) continue;

            vec2 starScreen = floor(rot2(starSky - skyOrigin, -uCamYaw) / zoomScale + halfRes + 0.5);
            vec2 sd = abs(pix - starScreen);
            if (sd.x > 2.2 || sd.y > 2.2) continue;

            float shapeRoll = hash12(cell + vec2(41.3, 19.7) + uSeedVec);
            float bright = 0.42 + 0.58 * hash12(cell + vec2(7.9, 63.1) + uSeedVec);
            float twinklePhase = hash12(cell + vec2(88.2, 13.4) + uSeedVec) * 6.2831;
            float twinkleSpeed = 1.6 + hash12(cell + vec2(3.1, 51.9) + uSeedVec) * 2.8;
            float twinkle = 0.72 + 0.28 * floor(0.5 + 0.5 * sin(uTime * twinkleSpeed + twinklePhase) * 2.0 + 0.5) * 0.5;

            float mask = 0.0;
            if (shapeRoll < heroChance) {
              float arm = step(sd.x, 0.5) * step(sd.y, 2.1) + step(sd.y, 0.5) * step(sd.x, 2.1);
              float core = step(sd.x, 0.5) * step(sd.y, 0.5);
              if (arm > 0.5) {
                mask = core > 0.5 ? 1.0 : 0.48 * twinkle;
              }
            } else if (shapeRoll < heroChance * 3.0) {
              if (sd.x + sd.y < 1.2) {
                mask = (sd.x < 0.5 && sd.y < 0.5) ? 1.0 : 0.45 * twinkle;
              }
            } else if (sd.x < 0.5 && sd.y < 0.5) {
              mask = 1.0;
            }

            if (mask > 0.001) {
              float tempRoll = hash12(cell + vec2(93.7, 27.3) + uSeedVec);
              vec3 col = starColorFromTemp(tempRoll);
              acc = max(acc, col * bright * twinkle * mask);
            }
          }
        }
        return acc;
      }

      void main() {
        // Hardware-interpolated quad UV + stable CSS viewport aspect so dynamic render resolution
        // changes during zoom NEVER stretch, crop, shift, or pop the starry backdrop
        vec2 uv = clamp(vUv, 0.0, 1.0);
        float aspect = max(0.25, uViewportAspect);
        float virtualH = 240.0;
        vec2 res = vec2(max(32.0, floor(virtualH * aspect + 0.5)), virtualH);
        vec2 halfRes = 0.5 * res;
        vec2 pix = floor(uv * res);
        vec2 pCentered = pix - halfRes;

        float zoomScale = mix(0.95, 1.07, clamp((uFrustumSize - 7.5) / 95.0, 0.0, 1.0));
        vec2 skyOrigin = uCamPan * 0.55;
        vec2 skyP = rot2(pCentered * zoomScale, uCamYaw) + skyOrigin;

        // Snap cosmic nebula coordinates to integer sky pixels for crisp pixel-art cohesion
        vec2 skyPix = floor(skyP);

        // 1. Primary Milky Way Galaxy Strip (tilted, gently curved, with bright core & dark dust rift)
        vec2 mwCoord = rot2(skyPix, uBandAngle);
        float curve = sin(mwCoord.x * 0.011 + uSeedVec.x * 0.1) * uBandCurve
                    + cos(mwCoord.x * 0.023 - uSeedVec.y * 0.1) * (uBandCurve * 0.45);
        float warp = (fbm(mwCoord * 0.012 + uSeedVec * 0.05) - 0.5) * 44.0;
        float distFromAxis = mwCoord.y - uBandOffset - curve - warp;

        float bandWidth = max(48.0, uBandWidth);
        float mwProfile = exp(-(distFromAxis * distFromAxis) / (bandWidth * bandWidth));

        // Bright Galactic Core bulge along the Milky Way strip
        float coreDist = length(vec2((mwCoord.x - uCoreShift) * 0.42, distFromAxis * 1.15));
        float coreBulge = exp(-(coreDist * coreDist) / (bandWidth * bandWidth * 0.85));

        // Secondary intersecting galactic filament / spiral spur
        vec2 secCoord = rot2(skyPix - vec2(uCoreShift * 0.3, uBandOffset * 0.4), uSecondAngle);
        float secWarp = (fbm(secCoord * 0.016 + uSeedVec * 0.09 + vec2(42.0, 19.0)) - 0.5) * 30.0;
        float secDist = secCoord.y + secWarp;
        float secProfile = uSecondStrength * exp(-(secDist * secDist) / (bandWidth * bandWidth * 0.42));

        // Wispy nebula cloud density & dark interstellar dust lane cutting through the Milky Way
        float nebNoiseA = fbm(mwCoord * 0.018 + uSeedVec * 0.07);
        float nebNoiseB = fbm(mwCoord * 0.042 - uSeedVec * 0.11 + vec2(13.0, 7.0));
        float cloudDetail = clamp(nebNoiseA * 0.65 + nebNoiseB * 0.45, 0.0, 1.0);

        float dustRidge = 1.0 - abs(fbm(vec2(mwCoord.x * 0.022, distFromAxis * 0.045) + uSeedVec * 0.04) * 2.0 - 1.0);
        float dustCenterMask = exp(-(distFromAxis * distFromAxis) / (bandWidth * bandWidth * 0.14));
        float darkRift = smoothstep(0.45, 0.88, dustRidge) * dustCenterMask * 0.78;

        float rawGalaxy = clamp((mwProfile * (0.42 + 0.85 * cloudDetail) + secProfile * (0.45 + 0.7 * nebNoiseB)) * (1.0 - darkRift), 0.0, 1.0);
        float coreGlow = clamp(coreBulge * (1.0 - darkRift * 0.68) * (0.65 + 0.45 * nebNoiseA), 0.0, 1.0);

        // 4x4 Bayer ordered dithering -> transforms continuous galaxy glow into crisp pixel-art bands
        float dither = bayer4x4(pix);
        float ditheredBand = floor(rawGalaxy * 5.0 + dither) / 5.0;
        float ditheredCore = floor(coreGlow * 4.0 + dither) / 4.0;

        vec3 spaceCol = mix(uVoidColor, uPresetTint, 0.16);
        spaceCol = mix(spaceCol, uBandColorA, smoothstep(0.0, 0.45, ditheredBand));
        spaceCol = mix(spaceCol, uBandColorB, smoothstep(0.35, 0.95, ditheredBand) * 0.88);
        spaceCol = mix(spaceCol, uCoreColor, ditheredCore * 0.56);
        spaceCol *= uPresetStrength;

        // 2. Distant Seeded Pixel Spiral / Elliptical Galaxies in the deep field
        float galCellSize = 116.0;
        vec2 galCell = floor(skyP / galCellSize);
        float galChance = hash12(galCell + uSeedVec + vec2(101.3, 213.7));
        if (galChance < 0.30) {
          vec2 galOff = hash22(galCell + uSeedVec + vec2(17.2, 83.4));
          vec2 galCenter = (galCell + 0.28 + 0.44 * galOff) * galCellSize;
          vec2 gd = floor(skyP - galCenter);
          float tilt = hash12(galCell + uSeedVec + vec2(9.1, 4.7)) * 3.14159;
          vec2 gr = rot2(gd, tilt);
          float ellip = length(vec2(gr.x * 0.58, gr.y * 1.35));
          float galSize = 4.5 + hash12(galCell + uSeedVec + vec2(33.1, 12.8)) * 5.5;
          if (ellip < galSize) {
            float angle = atan(gr.y * 1.35, gr.x * 0.58 + 0.0001);
            float arms = 0.5 + 0.5 * sin(angle * 2.0 - ellip * 0.9);
            float gGlow = exp(-(ellip * ellip) / (galSize * galSize * 0.34)) * (0.55 + 0.45 * arms);
            float gDith = floor(gGlow * 3.0 + dither) / 3.0;
            vec3 galHue = mix(uBandColorB, uCoreColor, exp(-ellip * 0.45));
            spaceCol += galHue * gDith * 0.42 * uPresetStrength;
          }
        }

        // 3. Multi-layer Pixel-Snapped Starfields
        // Micro star dust densely packed along the Milky Way strips
        vec3 starsDust = evalStarLayer(pix, halfRes, skyP, skyOrigin, zoomScale, 7.0, 0.22, 0.09, 11.0, 1.0, 0.0);
        // Medium field stars across space
        vec3 starsMid = evalStarLayer(pix, halfRes, skyP, skyOrigin, zoomScale, 13.0, 0.20, 0.14, 37.0, 0.7, 0.05);
        // Sparse bright twinkling diamond/cross hero stars
        vec3 starsHero = evalStarLayer(pix, halfRes, skyP, skyOrigin, zoomScale, 28.0, 0.22, 0.18, 79.0, 0.4, 0.26);

        spaceCol += starsDust * 0.58 + starsMid * 0.9 + starsHero * 1.25;

        // 4. Subtle Periodic Pixel Shooting Star
        float meteorEpoch = floor(uTime / 9.5);
        float meteorPhase = fract(uTime / 9.5);
        if (meteorPhase < 0.09) {
          float tM = meteorPhase / 0.09;
          vec2 mSeed = hash22(vec2(meteorEpoch, 17.0) + uSeedVec);
          vec2 mStart = (mSeed - 0.5) * res * 0.82;
          vec2 mDir = normalize(vec2(0.75 + mSeed.x * 0.35, -0.45 - mSeed.y * 0.35));
          vec2 mHead = floor(mStart + mDir * tM * 95.0);
          vec2 rel = pix - (mHead + halfRes);
          float along = dot(rel, -mDir);
          float perp = abs(dot(rel, vec2(-mDir.y, mDir.x)));
          float trailLen = 12.0;
          if (perp < 0.7 && along >= 0.0 && along < trailLen) {
            float fade = (1.0 - along / trailLen) * sin(tM * 3.14159);
            spaceCol += vec3(0.85, 0.95, 1.0) * fade * 0.85;
          }
        }

        gl_FragColor = vec4(spaceCol, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 100;

  let currentSeed = -1;
  let initializedSeed = false;

  const setSeed = (rawSeed: number) => {
    const seed = normalizeSeed(rawSeed);
    if (initializedSeed && seed === currentSeed) return;
    currentSeed = seed;
    initializedSeed = true;

    const rng = createRng(seed ^ 0x517cc1b7);

    uniforms.uSeedVec.value.set(rng() * 500 + 13.7, rng() * 500 + 29.3);
    uniforms.uBandAngle.value = (rng() - 0.5) * Math.PI;
    uniforms.uBandOffset.value = (rng() - 0.5) * 48;
    uniforms.uBandWidth.value = 80 + rng() * 74;
    uniforms.uBandCurve.value = 12 + rng() * 28;
    uniforms.uCoreShift.value = (rng() - 0.5) * 150;
    uniforms.uSecondStrength.value = 0.22 + rng() * 0.48;
    uniforms.uSecondAngle.value =
      uniforms.uBandAngle.value + (rng() > 0.5 ? 1 : -1) * (0.45 + rng() * 0.65);
    uniforms.uStarDensityBias.value = 0.84 + rng() * 0.46;
    uniforms.uTempShift.value = (rng() - 0.5) * 0.34;

    const palIdxA = Math.floor(rng() * SPACE_PALETTES.length);
    let palIdxB = Math.floor(rng() * SPACE_PALETTES.length);
    if (palIdxB === palIdxA) palIdxB = (palIdxA + 1) % SPACE_PALETTES.length;
    const palA = SPACE_PALETTES[palIdxA];
    const palB = SPACE_PALETTES[palIdxB];
    const mixFrac = rng() * 0.65;
    const hueJitter = (rng() - 0.5) * 0.14;

    uniforms.uVoidColor.value.copy(tintPaletteColor(palA.voidHex, palB.voidHex, mixFrac, hueJitter * 0.5));
    uniforms.uBandColorA.value.copy(tintPaletteColor(palA.bandAHex, palB.bandAHex, mixFrac, hueJitter));
    uniforms.uBandColorB.value.copy(tintPaletteColor(palA.bandBHex, palB.bandBHex, mixFrac, hueJitter));
    uniforms.uCoreColor.value.copy(tintPaletteColor(palA.coreHex, palB.coreHex, mixFrac, hueJitter * 0.35));
  };

  setSeed(initialSeed);

  const _targetTint = new THREE.Color('#0a0d18');

  const update = ({
    elapsed,
    width,
    height,
    viewportAspect,
    pixelScale,
    camYaw,
    camX,
    camZ,
    frustumSize,
    preset,
  }: {
    elapsed: number;
    width: number;
    height: number;
    viewportAspect?: number;
    pixelScale: number;
    camYaw: number;
    camX: number;
    camZ: number;
    frustumSize: number;
    preset: LightingPreset;
  }) => {
    // Keep periodic meteor period (9.5s * 200 = 1900s) exact across wraps so shooting stars never jump
    const safeElapsed = Number.isFinite(elapsed) ? ((elapsed % 1900) + 1900) % 1900 : 0;
    const safeW = Math.max(1, width);
    const safeH = Math.max(1, height);
    uniforms.uTime.value = safeElapsed;
    uniforms.uResolution.value.set(safeW, safeH);
    uniforms.uViewportAspect.value =
      viewportAspect && Number.isFinite(viewportAspect) && viewportAspect > 0
        ? viewportAspect
        : safeW / safeH;
    uniforms.uPixelStep.value = 1.0;
    uniforms.uPixelScale.value = Math.max(1.0, pixelScale);
    uniforms.uCamYaw.value = camYaw;
    uniforms.uCamPan.value.set(camX, camZ);
    uniforms.uFrustumSize.value = frustumSize;

    let targetStrength = 0.94;
    if (preset === 'midnight') {
      _targetTint.set('#02040a');
      targetStrength = 1.16;
    } else if (preset === 'night') {
      _targetTint.set('#050712');
      targetStrength = 1.08;
    } else if (preset === 'dusk') {
      _targetTint.set('#261529');
      targetStrength = 0.96;
    } else if (preset === 'dawn') {
      _targetTint.set('#142236');
      targetStrength = 0.92;
    } else {
      _targetTint.set('#0a101d');
      targetStrength = 0.96;
    }

    uniforms.uPresetTint.value.lerp(_targetTint, 0.08);
    uniforms.uPresetStrength.value += (targetStrength - uniforms.uPresetStrength.value) * 0.08;
  };

  // Preserve the seeded cosmos permanently throughout a world's lifetime regardless of FPS auto-trim or cloud quality
  const setQuality = (_quality: SkyCloudsQualityOption) => {
    uniforms.uSpaceQuality.value = 2.0;
  };

  const getSeed = () => currentSeed;

  const getDebugState = (): PixelSpaceDebugState => ({
    seed: currentSeed,
    spaceQuality: uniforms.uSpaceQuality.value,
    bandAngle: uniforms.uBandAngle.value,
    bandWidth: uniforms.uBandWidth.value,
    starDensityBias: uniforms.uStarDensityBias.value,
    voidHex: `#${uniforms.uVoidColor.value.getHexString()}`,
    bandAHex: `#${uniforms.uBandColorA.value.getHexString()}`,
    bandBHex: `#${uniforms.uBandColorB.value.getHexString()}`,
    coreHex: `#${uniforms.uCoreColor.value.getHexString()}`,
  });

  const dispose = () => {
    geo.dispose();
    material.dispose();
  };

  return { mesh, setSeed, getSeed, getDebugState, setQuality, update, dispose };
}

export interface WorldUnderglowSystem {
  mesh: THREE.Mesh;
  update: (elapsed: number, preset: LightingPreset, epochIndex: number, pixelScale: number) => void;
  dispose: () => void;
}

export function createWorldUnderglowSystem(gridSize: number): WorldUnderglowSystem {
  const margin = 18;
  const totalSize = gridSize + margin * 2;
  const geo = new THREE.PlaneGeometry(totalSize, totalSize, 1, 1);
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime: { value: 0 },
    uHalfExtent: { value: gridSize * 0.5 + 0.55 },
    uMargin: { value: margin - 1.5 },
    uPixelStep: { value: 1.0 },
    uInnerColor: { value: new THREE.Color('#48bfe3') },
    uOuterColor: { value: new THREE.Color('#273e7a') },
    uIntensity: { value: 0.44 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    fog: false,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vLocalXZ;
      void main() {
        vLocalXZ = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uHalfExtent;
      uniform float uMargin;
      uniform float uPixelStep;
      uniform vec3 uInnerColor;
      uniform vec3 uOuterColor;
      uniform float uIntensity;

      varying vec2 vLocalXZ;

      float bayer4x4(vec2 pix) {
        vec2 p = mod(floor(pix), 4.0);
        float hx = step(2.0, p.x);
        float hy = step(2.0, p.y);
        float lx = mod(p.x, 2.0);
        float ly = mod(p.y, 2.0);
        float mLow = 2.0 * abs(lx - ly) + ly;
        float mHigh = 2.0 * abs(hx - hy) + hy;
        return (4.0 * mLow + mHigh + 0.5) / 16.0;
      }

      void main() {
        // Snap world-space glow footprint to 4x4 pixel-art texels per tile
        vec2 pixXZ = floor(vLocalXZ * 4.0) / 4.0;
        vec2 q = abs(pixXZ) - vec2(uHalfExtent);
        float boxDist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);

        if (boxDist > uMargin) {
          discard;
        }

        float d = max(0.0, boxDist);
        float pulse = 0.92 + 0.08 * sin(uTime * 1.15);

        // Soft outer halo falloff + subtle crisp rim right beneath the slab border
        float halo = exp(-d * 0.21) * smoothstep(uMargin, 0.0, d);
        float rim = exp(-d * 1.45) * 0.28;
        float raw = clamp((halo * 0.82 + rim) * pulse, 0.0, 1.0);

        // 4x4 Bayer dithering on screen pixels so the glow has crisp retro pixel-art bands
        vec2 screenPix = floor(gl_FragCoord.xy / uPixelStep);
        float dither = bayer4x4(screenPix);
        float stepped = floor(raw * 6.0 + dither) / 6.0;

        if (stepped <= 0.01) {
          discard;
        }

        vec3 col = mix(uOuterColor, uInnerColor, clamp(stepped * 1.15, 0.0, 1.0));
        gl_FragColor = vec4(col, stepped * uIntensity);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, material);
  const center = (gridSize - 1) / 2;
  mesh.position.set(center, -1.88, center);
  mesh.renderOrder = -2;

  const _innerTarget = new THREE.Color('#48bfe3');
  const _outerTarget = new THREE.Color('#273e7a');

  const update = (
    elapsed: number,
    preset: LightingPreset,
    epochIndex: number,
    pixelScale: number,
  ) => {
    uniforms.uTime.value = wrapShaderTime(elapsed);
    uniforms.uPixelStep.value = pixelScale <= 1 ? 2.0 : 1.0;

    let targetIntensity = 0.42;
    if (preset === 'midnight') {
      _innerTarget.set('#4368b8');
      _outerTarget.set('#1a1647');
      targetIntensity = 0.56;
    } else if (preset === 'night') {
      _innerTarget.set('#56cfe1');
      _outerTarget.set('#3a358c');
      targetIntensity = 0.52;
    } else if (preset === 'dusk') {
      _innerTarget.set('#e08a7e');
      _outerTarget.set('#3d346b');
      targetIntensity = 0.46;
    } else if (preset === 'dawn') {
      _innerTarget.set('#7fd4e6');
      _outerTarget.set('#354f82');
      targetIntensity = 0.44;
    } else {
      _innerTarget.set('#4eb8d4');
      _outerTarget.set('#223b6e');
      targetIntensity = 0.42;
    }

    if (epochIndex >= 6) {
      targetIntensity += 0.06;
    }

    uniforms.uInnerColor.value.lerp(_innerTarget, 0.08);
    uniforms.uOuterColor.value.lerp(_outerTarget, 0.08);
    uniforms.uIntensity.value += (targetIntensity - uniforms.uIntensity.value) * 0.08;
  };

  const dispose = () => {
    geo.dispose();
    material.dispose();
  };

  return { mesh, update, dispose };
}

export interface ZoneOverlaySystem {
  mesh: THREE.Mesh;
  updateMap: (tiles: TileData[]) => void;
  updateZones: (colorData: Uint8Array, idData: Uint8Array, anyActive: boolean) => void;
  updateFrame: (elapsed: number) => void;
  dispose: () => void;
}

/**
 * Occluded-surface X-ray zone overlay pass using THREE.GreaterDepth.
 *
 * Each tile gets a flat horizontal quad sitting +0.03 above its terrain/water top
 * (t.height === 0 -> y = 0.28; land -> t.height * 0.45 + 0.28).
 * - On unobstructed open land or ocean: the quad is closer than the ground/seabed, so
 *   GreaterDepth FAILS (zero double-tinting; styledTerrain & oceanFoam draw it cleanly).
 * - Wherever a 3D tree canopy, building, castle, rock, unit, bridge, or ship covers a
 *   tile: the covering object writes a closer depth value, so GreaterDepth PASSES and
 *   projects the crisp territory fill & bold contour border directly over the occluders
 *   with zero parallax shift and 100% tile-exact alignment.
 */
export function createZoneOverlaySystem(gridSize: number): ZoneOverlaySystem {
  const tileCount = gridSize * gridSize;
  const positions = new Float32Array(tileCount * 4 * 3);
  const indices = new Uint32Array(tileCount * 6);

  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      const i = z * gridSize + x;
      const vBase = i * 4;
      const pBase = vBase * 3;
      const iBase = i * 6;

      const x0 = x - 0.5;
      const x1 = x + 0.5;
      const z0 = z - 0.5;
      const z1 = z + 0.5;
      const y = 0.28;

      // CCW winding when viewed from +Y so FrontSide faces upward
      positions[pBase] = x0;
      positions[pBase + 1] = y;
      positions[pBase + 2] = z0;

      positions[pBase + 3] = x0;
      positions[pBase + 4] = y;
      positions[pBase + 5] = z1;

      positions[pBase + 6] = x1;
      positions[pBase + 7] = y;
      positions[pBase + 8] = z1;

      positions[pBase + 9] = x1;
      positions[pBase + 10] = y;
      positions[pBase + 11] = z0;

      indices[iBase] = vBase;
      indices[iBase + 1] = vBase + 1;
      indices[iBase + 2] = vBase + 2;
      indices[iBase + 3] = vBase;
      indices[iBase + 4] = vBase + 2;
      indices[iBase + 5] = vBase + 3;
    }
  }

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  const zoneColorBytes = new Uint8Array(tileCount * 4);
  const zoneColorTex = new THREE.DataTexture(
    zoneColorBytes,
    gridSize,
    gridSize,
    THREE.RGBAFormat,
  );
  zoneColorTex.magFilter = THREE.NearestFilter;
  zoneColorTex.minFilter = THREE.NearestFilter;
  zoneColorTex.generateMipmaps = false;
  zoneColorTex.flipY = false;

  const zoneIdBytes = new Uint8Array(tileCount * 4);
  const zoneIdTex = new THREE.DataTexture(
    zoneIdBytes,
    gridSize,
    gridSize,
    THREE.RGBAFormat,
  );
  zoneIdTex.magFilter = THREE.NearestFilter;
  zoneIdTex.minFilter = THREE.NearestFilter;
  zoneIdTex.generateMipmaps = false;
  zoneIdTex.flipY = false;

  const uniforms = {
    uTime: { value: 0 },
    uGridSize: { value: gridSize },
    uZoneColorMap: { value: zoneColorTex },
    uZoneIdMap: { value: zoneIdTex },
    uZoneActive: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: true,
    depthFunc: THREE.GreaterDepth,
    depthWrite: false,
    toneMapped: false,
    side: THREE.FrontSide,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uGridSize;
      uniform sampler2D uZoneColorMap;
      uniform sampler2D uZoneIdMap;
      uniform float uZoneActive;
      varying vec3 vWorldPos;

      vec4 sampleOverlayZoneColor(vec2 coord) {
        vec2 clamped = clamp(coord, vec2(0.0), vec2(uGridSize - 1.0));
        return texture2D(uZoneColorMap, (clamped + 0.5) / uGridSize);
      }

      vec4 sampleOverlayZoneId(vec2 coord) {
        vec2 clamped = clamp(coord, vec2(0.0), vec2(uGridSize - 1.0));
        return texture2D(uZoneIdMap, (clamped + 0.5) / uGridSize);
      }

      void main() {
        if (uZoneActive < 0.5) {
          discard;
        }
        vec2 tileCoord = floor(vWorldPos.xz + 0.5);
        vec2 subUv = fract(vWorldPos.xz + 0.5);
        vec4 zCol = sampleOverlayZoneColor(tileCoord);
        if (zCol.a <= 0.01) {
          discard;
        }
        vec4 zId = sampleOverlayZoneId(tileCoord);

        vec4 zN = sampleOverlayZoneId(tileCoord + vec2(0.0, -1.0));
        vec4 zS = sampleOverlayZoneId(tileCoord + vec2(0.0, 1.0));
        vec4 zW = sampleOverlayZoneId(tileCoord + vec2(-1.0, 0.0));
        vec4 zE = sampleOverlayZoneId(tileCoord + vec2(1.0, 0.0));
        vec4 zNW = sampleOverlayZoneId(tileCoord + vec2(-1.0, -1.0));
        vec4 zNE = sampleOverlayZoneId(tileCoord + vec2(1.0, -1.0));
        vec4 zSW = sampleOverlayZoneId(tileCoord + vec2(-1.0, 1.0));
        vec4 zSE = sampleOverlayZoneId(tileCoord + vec2(1.0, 1.0));

        vec4 zN2 = sampleOverlayZoneId(tileCoord + vec2(0.0, -2.0));
        vec4 zS2 = sampleOverlayZoneId(tileCoord + vec2(0.0, 2.0));
        vec4 zW2 = sampleOverlayZoneId(tileCoord + vec2(-2.0, 0.0));
        vec4 zE2 = sampleOverlayZoneId(tileCoord + vec2(2.0, 0.0));

        bool diffN = abs(zN.r - zId.r) > 0.002 || abs(zN.g - zId.g) > 0.002;
        bool diffS = abs(zS.r - zId.r) > 0.002 || abs(zS.g - zId.g) > 0.002;
        bool diffW = abs(zW.r - zId.r) > 0.002 || abs(zW.g - zId.g) > 0.002;
        bool diffE = abs(zE.r - zId.r) > 0.002 || abs(zE.g - zId.g) > 0.002;

        bool diffNW = abs(zNW.r - zId.r) > 0.002 || abs(zNW.g - zId.g) > 0.002;
        bool diffNE = abs(zNE.r - zId.r) > 0.002 || abs(zNE.g - zId.g) > 0.002;
        bool diffSW = abs(zSW.r - zId.r) > 0.002 || abs(zSW.g - zId.g) > 0.002;
        bool diffSE = abs(zSE.r - zId.r) > 0.002 || abs(zSE.g - zId.g) > 0.002;

        bool diffN2 = abs(zN2.r - zId.r) > 0.002 || abs(zN2.g - zId.g) > 0.002;
        bool diffS2 = abs(zS2.r - zId.r) > 0.002 || abs(zS2.g - zId.g) > 0.002;
        bool diffW2 = abs(zW2.r - zId.r) > 0.002 || abs(zW2.g - zId.g) > 0.002;
        bool diffE2 = abs(zE2.r - zId.r) > 0.002 || abs(zE2.g - zId.g) > 0.002;

        bool isOuterBorderTile = diffN || diffS || diffW || diffE || diffNW || diffNE || diffSW || diffSE;
        bool isInnerBorderTile = !isOuterBorderTile && (diffN2 || diffS2 || diffW2 || diffE2);

        float outerDarkW = 0.44;
        bool onDarkOuterStroke =
          (diffN && subUv.y < outerDarkW) ||
          (diffS && subUv.y > 1.0 - outerDarkW) ||
          (diffW && subUv.x < outerDarkW) ||
          (diffE && subUv.x > 1.0 - outerDarkW) ||
          (diffNW && subUv.x < outerDarkW && subUv.y < outerDarkW) ||
          (diffNE && subUv.x > 1.0 - outerDarkW && subUv.y < outerDarkW) ||
          (diffSW && subUv.x < outerDarkW && subUv.y > 1.0 - outerDarkW) ||
          (diffSE && subUv.x > 1.0 - outerDarkW && subUv.y > 1.0 - outerDarkW);

        bool isHovered = zId.b > 0.5;
        float hoverPulse = isHovered ? (0.14 + 0.08 * sin(uTime * 5.0)) : 0.0;

        if (onDarkOuterStroke) {
          vec3 outerCol = zCol.rgb * (isHovered ? 0.56 : 0.38);
          gl_FragColor = vec4(outerCol, 0.90);
        } else if (isOuterBorderTile || isInnerBorderTile) {
          vec3 rimCol = zCol.rgb * (isHovered ? 0.80 : 0.62);
          gl_FragColor = vec4(rimCol, isOuterBorderTile ? 0.84 : 0.76);
        } else {
          float fillAlpha = clamp(zCol.a * 0.46 + hoverPulse, 0.0, 0.66);
          gl_FragColor = vec4(zCol.rgb, fillAlpha);
        }
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 11;
  mesh.visible = false;

  const updateMap = (tiles: TileData[]) => {
    const count = Math.min(tileCount, tiles.length);
    for (let i = 0; i < count; i++) {
      const t = tiles[i];
      const y = t.height <= 0 ? 0.28 : t.height * 0.45 + 0.28;
      const pBase = i * 12;
      positions[pBase + 1] = y;
      positions[pBase + 4] = y;
      positions[pBase + 7] = y;
      positions[pBase + 10] = y;
    }
    posAttr.needsUpdate = true;
  };

  const updateZones = (colorData: Uint8Array, idData: Uint8Array, anyActive: boolean) => {
    uniforms.uZoneActive.value = anyActive ? 1 : 0;
    mesh.visible = anyActive;
    if (anyActive) {
      zoneColorBytes.set(colorData);
      zoneIdBytes.set(idData);
      zoneColorTex.needsUpdate = true;
      zoneIdTex.needsUpdate = true;
    }
  };

  const updateFrame = (elapsed: number) => {
    uniforms.uTime.value = wrapShaderTime(elapsed);
  };

  const dispose = () => {
    geo.dispose();
    material.dispose();
    zoneColorTex.dispose();
    zoneIdTex.dispose();
  };

  return { mesh, updateMap, updateZones, updateFrame, dispose };
}



