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
}

export interface SkyCloudSystem {
  group: THREE.Group;
  shadowGroup: THREE.Group;
  setQuality: (quality: SkyCloudsQualityOption) => void;
  update: (dt: number, elapsed: number, preset: LightingPreset) => void;
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

  const variantCapacities = variants.map(() => 0);
  for (let i = 0; i < cloudCount; i++) {
    variantCapacities[i % variants.length]++;
  }

  const cloudInsts: THREE.InstancedMesh[] = [];
  const shadowInsts: THREE.InstancedMesh[] = [];
  const variantFullCounts = variantCapacities.slice();

  for (let v = 0; v < variants.length; v++) {
    const cap = Math.max(1, variantCapacities[v]);
    const cInst = new THREE.InstancedMesh(variants[v], cloudMat, cap);
    cInst.castShadow = false;
    cInst.receiveShadow = false;
    cInst.frustumCulled = false;
    cInst.renderOrder = 4;
    cInst.count = cap;
    group.add(cInst);
    cloudInsts.push(cInst);

    const sInst = new THREE.InstancedMesh(variants[v], shadowMat, cap);
    sInst.castShadow = false;
    sInst.receiveShadow = false;
    sInst.frustumCulled = false;
    sInst.renderOrder = 2;
    sInst.count = cap;
    shadowGroup.add(sInst);
    shadowInsts.push(sInst);
  }

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

    _pos.set(x, y, z);
    _scale.set(scaleX, scaleY, scaleZ);
    _mat.compose(_pos, q, _scale);
    cloudInsts[variant].setMatrixAt(slot, _mat);

    _pos.set(x - 2.4, 0.32, z - 1.8);
    _scale.set(scaleX * 0.88, 0.02, scaleZ * 0.88);
    _mat.compose(_pos, q, _scale);
    shadowInsts[variant].setMatrixAt(slot, _mat);

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
    });
  }

  for (let v = 0; v < variants.length; v++) {
    cloudInsts[v].instanceMatrix.needsUpdate = true;
    shadowInsts[v].instanceMatrix.needsUpdate = true;
  }

  let currentQuality: SkyCloudsQualityOption = 'full';

  const setQuality = (quality: SkyCloudsQualityOption) => {
    if (currentQuality === quality) return;
    currentQuality = quality;
    const isOff = quality === 'off';
    group.visible = !isOff;
    shadowGroup.visible = !isOff;
    for (let v = 0; v < variants.length; v++) {
      const fullCap = variantFullCounts[v];
      const count = isOff ? 0 : quality === 'reduced' ? Math.ceil(fullCap * 0.5) : fullCap;
      cloudInsts[v].count = count;
      shadowInsts[v].count = count;
    }
  };

  const _targetTint = new THREE.Color('#f7fbff');
  const _curTint = new THREE.Color('#f7fbff');

  const update = (dt: number, elapsed: number, preset: LightingPreset) => {
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

    _curTint.lerp(_targetTint, Math.min(1, dt * 4));
    cloudMat.color.copy(_curTint);
    const safeElapsed = wrapShaderTime(elapsed);

    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const activeLimit = cloudInsts[c.variant].count;
      if (c.slot >= activeLimit) continue;

      const breeze = 1.0 + Math.sin(safeElapsed * 0.35 + c.phase) * 0.14;
      c.x += c.vx * breeze * dt;
      c.z += (c.vz + Math.cos(safeElapsed * 0.25 + c.phase) * 0.1) * dt;

      if (c.x > gridSize + pad) c.x -= span;
      if (c.x < -pad) c.x += span;
      if (c.z > gridSize + pad) c.z -= span;
      if (c.z < -pad) c.z += span;

      const bobY = Math.sin(safeElapsed * 0.9 + c.phase) * c.bobAmp;
      const puffPulse = 1.0 + Math.sin(safeElapsed * 0.75 + c.phase) * 0.025;
      _quat.copy(variantQuats[i]);

      _pos.set(c.x, c.y + bobY, c.z);
      _scale.set(c.scaleX * puffPulse, c.scaleY, c.scaleZ * puffPulse);
      _mat.compose(_pos, _quat, _scale);
      cloudInsts[c.variant].setMatrixAt(c.slot, _mat);

      _pos.set(c.x - 2.4, 0.32, c.z - 1.8);
      _scale.set(c.scaleX * 0.88 * puffPulse, 0.02, c.scaleZ * 0.88 * puffPulse);
      _mat.compose(_pos, _quat, _scale);
      shadowInsts[c.variant].setMatrixAt(c.slot, _mat);
    }

    for (let v = 0; v < variants.length; v++) {
      if (cloudInsts[v].count > 0) {
        cloudInsts[v].instanceMatrix.needsUpdate = true;
        shadowInsts[v].instanceMatrix.needsUpdate = true;
      }
    }
  };

  const dispose = () => {
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
  updateFrame: (elapsed: number, preset: LightingPreset) => void;
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

  const oceanSegs = Math.min(64, gridSize);
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
      uShallowColor: { value: new THREE.Color('#2896ab') },
      uDeepColor: { value: new THREE.Color('#193f54') },
      uCrestColor: { value: new THREE.Color('#5ce1e6') },
      uReefWaterColor: { value: new THREE.Color('#12d6df') },
      uFoamColor: { value: new THREE.Color('#f4fbff') },
      uFoamMint: { value: new THREE.Color('#9ee6f5') },
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
      uniform vec3 uShallowColor;
      uniform vec3 uDeepColor;
      uniform vec3 uCrestColor;
      uniform vec3 uReefWaterColor;
      uniform vec3 uFoamColor;
      uniform vec3 uFoamMint;

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
        float selfReef = smoothstep(0.78, 0.98, self.b);
        float nbReef = max(
          max(smoothstep(0.78, 0.98, nN.b) * (1.0 - subUv.y), smoothstep(0.78, 0.98, nS.b) * subUv.y),
          max(smoothstep(0.78, 0.98, nW.b) * (1.0 - subUv.x), smoothstep(0.78, 0.98, nE.b) * subUv.x)
        );
        float reefMask = clamp(max(selfReef, nbReef * 0.78), 0.0, 1.0);
        bool isRiver = self.b > 0.54 && self.b <= 0.78;
        bool isLake = self.b > 0.25 && self.b <= 0.54;

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

        if (reefMask > 0.01) {
          // Warm Coral Reef & Atlantis Sanctuary Lagoon: ultra-transparent turquoise glass window so 3D corals & sunken city ruins shine through!
          float caustic = step(0.76, valueNoise(chunkPos * 1.35 + vec2(uTime * 0.35, -uTime * 0.28)));
          vec3 reefAqua = mix(uReefWaterColor, uCrestColor, 0.24 + caustic * 0.28);
          baseWater = mix(baseWater, reefAqua, reefMask * 0.84);
          waterAlpha = mix(waterAlpha, 0.05, reefMask);
        } else if (isRiver) {
          // Lively Shallow River: crystal-clear shallow aqua with animated current ripples showing sandy riverbed underneath
          vec3 livelyRiverAqua = mix(uShallowColor, uCrestColor, 0.56);
          float streamRipple = step(0.64, fract(chunkPos.x * 0.85 + chunkPos.y * 0.85 - uTime * 1.35 + swellA * 0.5));
          baseWater = mix(baseWater, livelyRiverAqua, 0.62);
          baseWater = mix(baseWater, uFoamMint, streamRipple * 0.44);
          waterAlpha = 0.22;
        } else if (isLake) {
          // Inland Lake: serene translucent emerald-turquoise shallow water over sandy lakebed
          baseWater = mix(baseWater, mix(uShallowColor, uReefWaterColor, 0.42), 0.56);
          waterAlpha = 0.25;
        }

        // Pixelated rolling wave bands (suppressed over crystal-clear reef/Atlantis lagoons & shallow shoals so underwater structures aren't obscured)
        float shallowCalm = smoothstep(0.22, 0.65, smoothDepth);
        float calmFactor = (1.0 - reefMask * 0.94) * (0.35 + 0.65 * shallowCalm);
        float ridge = step(0.63, waveField) * calmFactor;
        float glint = step(0.80, waveField + 0.06 * sin(chunkPos.x * 1.1 + uTime * 2.1)) * calmFactor;
        vec3 color = mix(baseWater, mix(baseWater, uCrestColor, 0.36), ridge * 0.44);
        color = mix(color, uCrestColor, glint * 0.30);

        // --- FOAM 1: Coast hitting dry land (rhythmic crashing shoreline surge + rolling breaker ring) ---
        float coastWobble = (swellB - 0.5) * 0.26 + sin((pixPos.x - pixPos.y) * 1.1 + uTime * 2.0) * 0.06;
        float surgeLap = 0.28 + 0.11 * sin(uTime * 2.8 + (pixPos.x + pixPos.y) * 0.42);
        float shoreCrest = step(landDist + coastWobble * 0.42, surgeLap);

        float breakerWave = fract(landDist * 1.35 + uTime * 0.62 + coastWobble * 0.45);
        float breakerBand = nearCoastInfluence * step(0.7, breakerWave) * smoothstep(1.2, 0.06, landDist);
        float breakerBreakup = step(0.32, valueNoise(chunkPos * 1.45 + vec2(uTime * 0.38, -uTime * 0.28)));

        float coastFoamCore = step(landDist + coastWobble * 0.3, surgeLap * 0.76);
        float coastFoamMint = max(shoreCrest, breakerBand * breakerBreakup);

        // --- FOAM 2: Random open-sea whitecaps & ephemeral bubble trails (suppressed over coral/Atlantis lagoons & shallow water for clarity) ---
        float capA = valueNoise(chunkPos * 0.55 + vec2(uTime * 0.26, uTime * 0.16));
        float capB = valueNoise(chunkPos * 1.35 - vec2(uTime * 0.38, -uTime * 0.2));
        float capPulse = 0.5 + 0.5 * sin(uTime * 1.4 + self.a * 6.2831 + chunkPos.x * 0.3);
        float combinedCap = capA * 0.54 + capB * 0.32 + capPulse * 0.14;

        float capThresh = isDeep ? 0.78 : 0.88;
        float openFoamAllow = step(reefMask, 0.10) * smoothstep(0.32, 0.65, smoothDepth);
        float openFoamMint = step(capThresh, combinedCap) * openFoamAllow;
        float openFoamCore = step(capThresh + 0.045, combinedCap) * openFoamAllow;

        float reefFoamSuppress = 1.0 - reefMask * 0.90;
        float mintMask = max(coastFoamMint * reefFoamSuppress, openFoamMint);
        float whiteMask = max(coastFoamCore * reefFoamSuppress, openFoamCore);

        color = mix(color, uFoamMint, mintMask * 0.82);
        color = mix(color, uFoamColor, whiteMask * 0.98);

        if (uZoneActive > 0.5) {
          vec4 zCol = sampleZoneColor(tileCoord);
          vec4 zId = sampleZoneId(tileCoord);
          if (zCol.a > 0.01) {
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
        if (uZoneActive > 0.5 && sampleZoneColor(tileCoord).a > 0.01) {
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
  mesh.renderOrder = 2;

  const updateMap = (tiles: TileData[]) => {
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const idx = i * 4;
      if (t.height > 0) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
        continue;
      }

      let touchesLand = 0;
      const isHealthyCoralOrAtlantis =
        (t.resourceNode === 'coral_reef' && (t.coralBleachTimer ?? 0) <= 0 && t.resourceAmount > 0) ||
        t.resourceNode === 'atlantis_ruin';
      let adjCoralCount = isHealthyCoralOrAtlantis ? 2 : 0;

      // Compute multi-ring distances to dry land, shallow_water, and deep_water for seamless bathymetric blending
      let minLandDistSq = 99;
      let minShallowDistSq = 99;
      let minDeepDistSq = 99;
      for (let dz = -4; dz <= 4; dz++) {
        for (let dx = -4; dx <= 4; dx++) {
          const nx = t.x + dx;
          const nz = t.z + dz;
          if (nx < 0 || nx >= gridSize || nz < 0 || nz >= gridSize) continue;
          const nb = tiles[nz * gridSize + nx];
          const dSq = dx * dx + dz * dz;
          if (nb.height > 0) {
            if (dSq < minLandDistSq) minLandDistSq = dSq;
            if (dSq < minShallowDistSq) minShallowDistSq = dSq;
            if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1 && dSq > 0) {
              touchesLand = 255;
            }
          } else {
            if (nb.terrain === 'deep_water' && !nb.isRiver && !nb.isLake) {
              if (dSq < minDeepDistSq) minDeepDistSq = dSq;
            } else {
              if (dSq < minShallowDistSq) minShallowDistSq = dSq;
            }
            if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1 && dSq > 0) {
              if (
                (nb.resourceNode === 'coral_reef' &&
                  (nb.coralBleachTimer ?? 0) <= 0 &&
                  nb.resourceAmount > 0) ||
                nb.resourceNode === 'atlantis_ruin'
              ) {
                adjCoralCount += nb.resourceNode === 'atlantis_ruin' ? 2 : 1;
              }
            }
          }
        }
      }

      let depthVal = 255;
      if (t.isRiver || t.isLake || isHealthyCoralOrAtlantis) {
        depthVal = 54;
      } else if (t.terrain !== 'deep_water') {
        // Shallow shelf: smoothly deepens from 52 along beach/lagoon interior to 146 near the deep_water dropoff
        const landD = Math.min(4.0, Math.sqrt(minLandDistSq));
        const deepD = Math.min(4.0, Math.sqrt(minDeepDistSq));
        const shoreFactor = Math.max(0, Math.min(1, (landD - 1.0) / 3.0));
        const dropoffPull = Math.max(0, Math.min(1, (3.2 - deepD) / 2.2));
        depthVal = Math.round(52 + shoreFactor * 44 + dropoffPull * 50);
      } else {
        // Deep water: smoothly transitions from 166 at the shallow_water border across a 4-tile slope to 255 in open abyss
        const shallowD = Math.min(4.5, Math.sqrt(minShallowDistSq));
        const slopeFactor = Math.max(0, Math.min(1, (shallowD - 1.0) / 3.2));
        depthVal = Math.round(166 + slopeFactor * 89);
      }
      data[idx] = Math.max(48, Math.min(255, depthVal));

      data[idx + 1] = touchesLand;
      // Encode water special feature in B channel:
      // 255 = coral_reef / atlantis_ruin or dense reef lagoon interior, 220 = reef lagoon fringe, 170 = shallow river, 100 = inland lake, 0 = standard sea
      const reefByte =
        isHealthyCoralOrAtlantis || adjCoralCount >= 2
          ? 255
          : adjCoralCount === 1
            ? 220
            : 0;
      data[idx + 2] = reefByte > 0 ? reefByte : t.isRiver ? 170 : t.isLake ? 100 : 0;

      const phaseByte = Math.abs(((t.x * 73856093) ^ (t.z * 19349663)) | 0) & 255;
      data[idx + 3] = phaseByte;
    }
    waterMapTex.needsUpdate = true;
  };

  const _shallowTarget = new THREE.Color('#2896ab');
  const _deepTarget = new THREE.Color('#193f54');
  const _crestTarget = new THREE.Color('#5ce1e6');
  const _reefTarget = new THREE.Color('#12d6df');
  const _foamTarget = new THREE.Color('#f4fbff');
  const _mintTarget = new THREE.Color('#9ee6f5');

  const updateFrame = (elapsed: number, preset: LightingPreset) => {
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

    mu.uShallowColor.value.lerp(_shallowTarget, 0.08);
    mu.uDeepColor.value.lerp(_deepTarget, 0.08);
    mu.uCrestColor.value.lerp(_crestTarget, 0.08);
    mu.uReefWaterColor.value.lerp(_reefTarget, 0.08);
    mu.uFoamColor.value.lerp(_foamTarget, 0.08);
    mu.uFoamMint.value.lerp(_mintTarget, 0.08);
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

export interface StyledTerrainSystem {
  getMaterials: (terrain: TerrainType) => THREE.MeshStandardMaterial[];
  updateMap: (
    tiles: TileData[],
    buildings?: BuildingEntity[],
    settlementSpecies?: Record<string, SpeciesId>,
  ) => void;
  updateZones: (colorData: Uint8Array, idData: Uint8Array, anyActive: boolean) => void;
  updateFrame: (
    elapsed: number,
    epochIndex?: number,
    preset?: LightingPreset,
    cyclePhase01?: number,
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

    vec3 computeBiomeColor(float code, vec2 pixPos, vec2 chunkPos, vec2 subUv, float tTime, bool isCultivatedFarm) {
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
        // Crystal Field: luminous geometric arcane/sci-fi circuit plating
        vec2 cGrid = abs(fract(pixPos * 2.0) - 0.5);
        float trace = step(0.41, max(cGrid.x, cGrid.y));
        float pulse = 0.55 + 0.45 * sin(tTime * 2.4 - (pixPos.x + pixPos.y) * 0.7);
        vec3 base = landSrgb(56.0, 79.0, 94.0);
        vec3 hi   = landSrgb(92.0, 219.0, 224.0);
        vec3 sh   = landSrgb(34.0, 50.0, 62.0);
        vec3 c = mix(sh, base, step(0.45, waveA));
        return mix(c, hi, trace * (0.55 + 0.45 * pulse));
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
      } else {
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
      }
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
        vec2 pts[8];
        if (rN) pts[foundPts++] = vec2(0.5, 0.0);
        if (rS) pts[foundPts++] = vec2(0.5, 1.0);
        if (rW) pts[foundPts++] = vec2(0.0, 0.5);
        if (rE) pts[foundPts++] = vec2(1.0, 0.5);
        if (diagNW) pts[foundPts++] = vec2(0.0, 0.0);
        if (diagNE) pts[foundPts++] = vec2(1.0, 0.0);
        if (diagSW) pts[foundPts++] = vec2(0.0, 1.0);
        if (diagSE) pts[foundPts++] = vec2(1.0, 1.0);
        if (foundPts >= 2) {
          splineP0 = pts[0];
          splineP2 = pts[1];
        } else {
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
        vec2 pts[8];
        if (tN) pts[found++] = vec2(0.5, 0.0);
        if (tS) pts[found++] = vec2(0.5, 1.0);
        if (tW) pts[found++] = vec2(0.0, 0.5);
        if (tE) pts[found++] = vec2(1.0, 0.5);
        if (diagNW) pts[found++] = vec2(0.0, 0.0);
        if (diagNE) pts[found++] = vec2(1.0, 0.0);
        if (diagSW) pts[found++] = vec2(0.0, 1.0);
        if (diagSE) pts[found++] = vec2(1.0, 1.0);
        if (found >= 2) {
          sp0 = pts[0];
          sp2 = pts[1];
        } else {
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

  const orderedHelpers = glslHelpers;

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
  cliffMat.customProgramCacheKey = () => 'aeon_cliff_pixel_v8';
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
    patchVertexShader(shader);

    shader.fragmentShader =
      orderedHelpers +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float wallU = abs(vLandWorldNormal.x) > 0.5 ? vLandWorldPos.z : vLandWorldPos.x;
        vec2 wallPix = floor(vec2(wallU, vLandWorldPos.y) * 16.0) / 16.0;
        vec2 wallChunk = floor(wallPix * 8.0) / 8.0;

        vec2 cliffOwnerCoord = floor(vLandWorldPos.xz + 0.5 - vLandWorldNormal.xz * 0.25);
        vec2 cliffNeighborCoord = floor(vLandWorldPos.xz + 0.5 + vLandWorldNormal.xz * 0.25);
        float ownerCode = decodeTerrain(sampleLandTile(cliffOwnerCoord));
        float neighborCode = decodeTerrain(sampleLandTile(cliffNeighborCoord));
        bool isVoidWall = abs(ownerCode - 22.0) < 0.5 || abs(neighborCode - 22.0) < 0.5;
        bool isCraterWall = abs(ownerCode - 12.0) < 0.5 || abs(neighborCode - 12.0) < 0.5;
        bool isBadlandsWall = abs(ownerCode - 19.0) < 0.5 || abs(neighborCode - 19.0) < 0.5;
        bool isMountainWall = abs(ownerCode - 16.0) < 0.5 || abs(ownerCode - 11.0) < 0.5;
        bool isUrbanRetainingWall =
          !isVoidWall && !isCraterWall &&
          (abs(ownerCode - 9.0) < 0.5 || abs(ownerCode - 14.0) < 0.5 || abs(ownerCode - 21.0) < 0.5 ||
           (uEpoch >= 3.5 && neighborCode < 1.5));

        float strata = landNoise(vec2(wallChunk.x * 0.65, wallChunk.y * 2.2));
        float brickRow = floor(wallPix.y * 4.0);
        float brickCol = floor((wallPix.x + mod(brickRow, 2.0) * 0.25) * 2.0);
        float seam = step(0.86, fract(wallPix.y * 4.0)) + step(0.91, fract((wallPix.x + mod(brickRow, 2.0) * 0.25) * 2.0));
        float brickTone = landHash12(vec2(brickCol, brickRow));

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
        } else {
          vec3 stoneBase = isVoidWall
            ? vec3(0.015, 0.008, 0.035)
            : isCraterWall
            ? landSrgb(48.0, 36.0, 34.0)
            : isBadlandsWall
              ? landSrgb(162.0, 82.0, 48.0)
              : isMountainWall
                ? landSrgb(88.0, 96.0, 106.0)
                : landSrgb(74.0, 89.0, 95.0);
          vec3 stoneHi = isVoidWall
            ? landSrgb(58.0, 24.0, 96.0)
            : isCraterWall
            ? landSrgb(78.0, 52.0, 42.0)
            : isBadlandsWall
              ? landSrgb(206.0, 122.0, 72.0)
              : isMountainWall
                ? landSrgb(126.0, 136.0, 146.0)
                : landSrgb(104.0, 122.0, 129.0);
          vec3 stoneSh = isVoidWall
            ? vec3(0.004, 0.002, 0.012)
            : isCraterWall
            ? landSrgb(24.0, 17.0, 18.0)
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
          } else if (isCraterWall) {
            float emberVein = step(0.82, strata * 0.6 + brickTone * 0.4);
            cliffCol = mix(cliffCol, landSrgb(245.0, 98.0, 28.0), emberVein * 0.75);
          }
        }

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

  const terrainMaterialMap = new Map<TerrainType, THREE.MeshStandardMaterial[]>();
  const terrainTypes = Object.keys(STYLED_TERRAIN_CODE) as TerrainType[];

  for (const tType of terrainTypes) {
    const tCode = STYLED_TERRAIN_CODE[tType];
    const roughness =
      tType === 'crystal_field' ? 0.34 : tType === 'stone_road' ? 0.65 : tType === 'snow' || tType === 'tundra' ? 0.68 : 0.82;
    const metalness = tType === 'crystal_field' ? 0.28 : tType === 'rock' || tType === 'mountain' ? 0.12 : 0.05;

    const topMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness,
      metalness,
    });
    topMat.customProgramCacheKey = () => 'aeon_land_top_pixel_v14';
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
      shader.uniforms.uDefaultCode = { value: tCode };
      patchVertexShader(shader);

      shader.fragmentShader =
        `uniform float uDefaultCode;\n` +
        orderedHelpers +
        shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec2 gridPos = vLandWorldPos.xz + 0.5;
          vec2 pixPos = floor(gridPos * 16.0) / 16.0;
          vec2 chunkPos = floor(pixPos * 8.0) / 8.0;
          vec2 tileCoord = floor(pixPos);
          vec2 subUv = fract(pixPos);

          vec4 self = sampleLandTile(tileCoord);
          float myHeight = decodeHeight(self);
          float myCode = decodeTerrain(self);
          if (myHeight < 0.5) myCode = uDefaultCode;

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

          vec3 col;

          // 0b. Connected Street Ribbon (stone_road = 9.0) & Grade Crossing Rails:
          if (abs(myCode - 9.0) < 0.5) {
            float cNW = decodeTerrain(sampleLandTile(tileCoord + vec2(-1.0, -1.0)));
            float cNE = decodeTerrain(sampleLandTile(tileCoord + vec2( 1.0, -1.0)));
            float cSW = decodeTerrain(sampleLandTile(tileCoord + vec2(-1.0,  1.0)));
            float cSE = decodeTerrain(sampleLandTile(tileCoord + vec2( 1.0,  1.0)));
            bool rN = abs(cN - 9.0) < 0.5 || abs(cN - 21.0) < 0.5;
            bool rS = abs(cS - 9.0) < 0.5 || abs(cS - 21.0) < 0.5;
            bool rW = abs(cW - 9.0) < 0.5 || abs(cW - 21.0) < 0.5;
            bool rE = abs(cE - 9.0) < 0.5 || abs(cE - 21.0) < 0.5;
            bool rNW = abs(cNW - 9.0) < 0.5 || abs(cNW - 21.0) < 0.5;
            bool rNE = abs(cNE - 9.0) < 0.5 || abs(cNE - 21.0) < 0.5;
            bool rSW = abs(cSW - 9.0) < 0.5 || abs(cSW - 21.0) < 0.5;
            bool rSE = abs(cSE - 9.0) < 0.5 || abs(cSE - 21.0) < 0.5;

            bool isBridgeTile = myHeight < 0.5 || cN < 1.5 || cS < 1.5 || cW < 1.5 || cE < 1.5;
            float marginBiome = -1.0;
            if (!rN && subUv.y < 0.35 && cN >= 2.0 && abs(cN - 9.0) > 0.5 && abs(cN - 14.0) > 0.5) {
              marginBiome = cN;
            } else if (!rS && subUv.y > 0.65 && cS >= 2.0 && abs(cS - 9.0) > 0.5 && abs(cS - 14.0) > 0.5) {
              marginBiome = cS;
            } else if (!rW && subUv.x < 0.35 && cW >= 2.0 && abs(cW - 9.0) > 0.5 && abs(cW - 14.0) > 0.5) {
              marginBiome = cW;
            } else if (!rE && subUv.x > 0.65 && cE >= 2.0 && abs(cE - 9.0) > 0.5 && abs(cE - 14.0) > 0.5) {
              marginBiome = cE;
            } else if (!rN && cN >= 2.0 && abs(cN - 9.0) > 0.5 && abs(cN - 14.0) > 0.5) {
              marginBiome = cN;
            } else if (!rS && cS >= 2.0 && abs(cS - 9.0) > 0.5 && abs(cS - 14.0) > 0.5) {
              marginBiome = cS;
            } else if (!rW && cW >= 2.0 && abs(cW - 9.0) > 0.5 && abs(cW - 14.0) > 0.5) {
              marginBiome = cW;
            } else if (!rE && cE >= 2.0 && abs(cE - 9.0) > 0.5 && abs(cE - 14.0) > 0.5) {
              marginBiome = cE;
            } else if (cNW >= 2.0 && abs(cNW - 9.0) > 0.5 && abs(cNW - 14.0) > 0.5) {
              marginBiome = cNW;
            } else if (cNE >= 2.0 && abs(cNE - 9.0) > 0.5 && abs(cNE - 14.0) > 0.5) {
              marginBiome = cNE;
            } else if (cSW >= 2.0 && abs(cSW - 9.0) > 0.5 && abs(cSW - 14.0) > 0.5) {
              marginBiome = cSW;
            } else if (cSE >= 2.0 && abs(cSE - 9.0) > 0.5 && abs(cSE - 14.0) > 0.5) {
              marginBiome = cSE;
            }

            vec3 marginCol;
            if (isBridgeTile || marginBiome < 0.0) {
              // Engineered bridge/causeway parapet shoulder instead of green grass on bridges & urban districts!
              marginCol = uEpoch < 1.5
                ? landSrgb(120.0, 88.0, 58.0)
                : uEpoch < 3.5
                  ? landSrgb(156.0, 146.0, 134.0)
                  : uEpoch < 5.5
                    ? landSrgb(132.0, 142.0, 156.0)
                    : landSrgb(68.0, 84.0, 102.0);
            } else {
              marginCol = computeBiomeColor(marginBiome, pixPos, chunkPos, subUv, uTime, false);
            }
            col = computeRoadColor(pixPos, subUv, uTime, rN, rS, rW, rE, rNW, rNE, rSW, rSE, marginCol);

            // Overlay gleaming steel crossing rails only for ground-level rail crossings (uEpoch < 4.5); elevated metro bridges overhead
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
          } else if (abs(myCode - 14.0) < 0.5) {
            // 0c. Connected Metro / Railway Track (rail_track = 14.0, full 8-way curve awareness)
            float cNW = decodeTerrain(sampleLandTile(tileCoord + vec2(-1.0, -1.0)));
            float cNE = decodeTerrain(sampleLandTile(tileCoord + vec2( 1.0, -1.0)));
            float cSW = decodeTerrain(sampleLandTile(tileCoord + vec2(-1.0,  1.0)));
            float cSE = decodeTerrain(sampleLandTile(tileCoord + vec2( 1.0,  1.0)));
            bool tN = abs(cN - 14.0) < 0.5 || (abs(cN - 9.0) < 0.5 && abs(cS - 14.0) < 0.5);
            bool tS = abs(cS - 14.0) < 0.5 || (abs(cS - 9.0) < 0.5 && abs(cN - 14.0) < 0.5);
            bool tW = abs(cW - 14.0) < 0.5 || (abs(cW - 9.0) < 0.5 && abs(cE - 14.0) < 0.5);
            bool tE = abs(cE - 14.0) < 0.5 || (abs(cE - 9.0) < 0.5 && abs(cW - 14.0) < 0.5);
            bool tNW = abs(cNW - 14.0) < 0.5 || (abs(cNW - 9.0) < 0.5 && abs(cSE - 14.0) < 0.5);
            bool tNE = abs(cNE - 14.0) < 0.5 || (abs(cNE - 9.0) < 0.5 && abs(cSW - 14.0) < 0.5);
            bool tSW = abs(cSW - 14.0) < 0.5 || (abs(cSW - 9.0) < 0.5 && abs(cNE - 14.0) < 0.5);
            bool tSE = abs(cSE - 14.0) < 0.5 || (abs(cSE - 9.0) < 0.5 && abs(cNW - 14.0) < 0.5);

            float marginBiome = 3.0;
            if (!tN && subUv.y < 0.35 && cN >= 2.0 && abs(cN - 14.0) > 0.5 && abs(cN - 9.0) > 0.5 && abs(cN - 21.0) > 0.5) {
              marginBiome = cN;
            } else if (!tS && subUv.y > 0.65 && cS >= 2.0 && abs(cS - 14.0) > 0.5 && abs(cS - 9.0) > 0.5 && abs(cS - 21.0) > 0.5) {
              marginBiome = cS;
            } else if (!tW && subUv.x < 0.35 && cW >= 2.0 && abs(cW - 14.0) > 0.5 && abs(cW - 9.0) > 0.5 && abs(cW - 21.0) > 0.5) {
              marginBiome = cW;
            } else if (!tE && subUv.x > 0.65 && cE >= 2.0 && abs(cE - 14.0) > 0.5 && abs(cE - 9.0) > 0.5 && abs(cE - 21.0) > 0.5) {
              marginBiome = cE;
            } else if (!tN && cN >= 2.0 && abs(cN - 14.0) > 0.5 && abs(cN - 9.0) > 0.5 && abs(cN - 21.0) > 0.5) {
              marginBiome = cN;
            } else if (!tS && cS >= 2.0 && abs(cS - 14.0) > 0.5 && abs(cS - 9.0) > 0.5 && abs(cS - 21.0) > 0.5) {
              marginBiome = cS;
            } else if (!tW && cW >= 2.0 && abs(cW - 14.0) > 0.5 && abs(cW - 9.0) > 0.5 && abs(cW - 21.0) > 0.5) {
              marginBiome = cW;
            } else if (!tE && cE >= 2.0 && abs(cE - 14.0) > 0.5 && abs(cE - 9.0) > 0.5 && abs(cE - 21.0) > 0.5) {
              marginBiome = cE;
            }
            vec3 marginCol = computeBiomeColor(marginBiome, pixPos, chunkPos, subUv, uTime, false);
            col = computeRailColor(pixPos, subUv, uTime, tN, tS, tW, tE, tNW, tNE, tSW, tSE, marginCol);
          } else if (abs(myCode - 21.0) < 0.5) {
            // 0d. Dedicated Airport Runway (runway = 21.0)
            bool wN = abs(cN - 21.0) < 0.5;
            bool wS = abs(cS - 21.0) < 0.5;
            bool wW = abs(cW - 21.0) < 0.5;
            bool wE = abs(cE - 21.0) < 0.5;
            float marginBiome = 3.0;
            if (!wN && cN >= 2.0 && abs(cN - 21.0) > 0.5 && abs(cN - 9.0) > 0.5) marginBiome = cN;
            else if (!wS && cS >= 2.0 && abs(cS - 21.0) > 0.5 && abs(cS - 9.0) > 0.5) marginBiome = cS;
            else if (!wW && cW >= 2.0 && abs(cW - 21.0) > 0.5 && abs(cW - 9.0) > 0.5) marginBiome = cW;
            else if (!wE && cE >= 2.0 && abs(cE - 21.0) > 0.5 && abs(cE - 9.0) > 0.5) marginBiome = cE;
            vec3 marginCol = computeBiomeColor(marginBiome, pixPos, chunkPos, subUv, uTime, false);
            col = computeRunwayColor(pixPos, subUv, uTime, wN, wS, wW, wE, marginCol);
          } else {
            col = computeBiomeColor(myCode, pixPos, chunkPos, subUv, uTime, self.a > 0.5);
            // Smooth bathymetric seabed color transition from sunlit shallow sand -> turquoise shoal -> marine slope -> deep abyssal floor
            if (myHeight < 0.5 && myCode < 1.5) {
              float bSelf = self.b;
              float bN = hN < 0.5 ? nN.b : 0.0;
              float bS = hS < 0.5 ? nS.b : 0.0;
              float bW = hW < 0.5 ? nW.b : 0.0;
              float bE = hE < 0.5 ? nE.b : 0.0;
              float bX = subUv.x < 0.5 ? mix(bW, bSelf, subUv.x + 0.5) : mix(bSelf, bE, subUv.x - 0.5);
              float bY = subUv.y < 0.5 ? mix(bN, bSelf, subUv.y + 0.5) : mix(bSelf, bS, subUv.y - 0.5);
              float bDepth = clamp((bX + bY) * 0.5, 0.0, 1.0);
              vec3 shallowSandCol = computeBiomeColor(1.0, pixPos, chunkPos, subUv, uTime, false);
              vec3 midShoalCol    = landSrgb(82.0, 146.0, 156.0);
              vec3 slopeTealCol   = landSrgb(34.0, 82.0, 108.0);
              vec3 deepFloorCol   = computeBiomeColor(0.0, pixPos, chunkPos, subUv, uTime, false);
              if (bDepth < 0.42) {
                col = mix(shallowSandCol, midShoalCol, smoothstep(0.15, 0.42, bDepth));
              } else if (bDepth < 0.74) {
                col = mix(midShoalCol, slopeTealCol, smoothstep(0.42, 0.74, bDepth));
              } else {
                col = mix(slopeTealCol, deepFloorCol, smoothstep(0.74, 0.98, bDepth));
              }
            }
          }

          // 1. Cross-biome organic pixel dithering along shared terrace seams (except crisp roads, rails, runways & smooth seabed)
          if (myCode != 9.0 && myCode != 14.0 && myCode != 21.0 && myHeight > 0.5) {
            float ditherRng = landHash12(pixPos * 16.0);
            if (hN == myHeight && cN != myCode && cN != 9.0 && cN != 14.0 && cN != 21.0 && subUv.y < 0.24 && ditherRng > subUv.y * 3.8) {
              col = computeBiomeColor(cN, pixPos, chunkPos, subUv, uTime, nN.a > 0.5);
            } else if (hS == myHeight && cS != myCode && cS != 9.0 && cS != 14.0 && cS != 21.0 && (1.0 - subUv.y) < 0.24 && ditherRng > (1.0 - subUv.y) * 3.8) {
              col = computeBiomeColor(cS, pixPos, chunkPos, subUv, uTime, nS.a > 0.5);
            } else if (hW == myHeight && cW != myCode && cW != 9.0 && cW != 14.0 && cW != 21.0 && subUv.x < 0.24 && ditherRng > subUv.x * 3.8) {
              col = computeBiomeColor(cW, pixPos, chunkPos, subUv, uTime, nW.a > 0.5);
            } else if (hE == myHeight && cE != myCode && cE != 9.0 && cE != 14.0 && cE != 21.0 && (1.0 - subUv.x) < 0.24 && ditherRng > (1.0 - subUv.x) * 3.8) {
              col = computeBiomeColor(cE, pixPos, chunkPos, subUv, uTime, nE.a > 0.5);
            }
          }

          // 2. Crisp shoreline dampness & wet-sand darkening right where land meets sea
          float waterDist = 2.0;
          if (hN < 0.5) waterDist = min(waterDist, subUv.y);
          if (hS < 0.5) waterDist = min(waterDist, 1.0 - subUv.y);
          if (hW < 0.5) waterDist = min(waterDist, subUv.x);
          if (hE < 0.5) waterDist = min(waterDist, 1.0 - subUv.x);
          if (waterDist < 0.36) {
            float wetWave = 0.24 + 0.08 * sin(uTime * 2.6 + (pixPos.x + pixPos.y) * 0.45);
            if (waterDist < wetWave) {
              col *= 0.78;
            }
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

          // 4. Directional Terrace Cast Shadow & Base Ambient Occlusion (longer at low-angle Dawn & Dusk!)
          float lowAngleReach = mix(0.24, 0.48, clamp(1.0 - uSunDir.y, 0.0, 1.0));
          float shadowMask = 0.0;
          if (hE > myHeight && uSunDir.x > 0.1 && (1.0 - subUv.x) < lowAngleReach) {
            shadowMask = max(shadowMask, 1.0 - (1.0 - subUv.x) / lowAngleReach);
          }
          if (hW > myHeight && uSunDir.x < -0.1 && subUv.x < lowAngleReach) {
            shadowMask = max(shadowMask, 1.0 - subUv.x / lowAngleReach);
          }
          if (hS > myHeight && uSunDir.z > 0.1 && (1.0 - subUv.y) < lowAngleReach) {
            shadowMask = max(shadowMask, 1.0 - (1.0 - subUv.y) / lowAngleReach);
          }
          if (hN > myHeight && uSunDir.z < -0.1 && subUv.y < lowAngleReach) {
            shadowMask = max(shadowMask, 1.0 - subUv.y / lowAngleReach);
          }

          float higherEdge = 2.0;
          if (hN > myHeight) higherEdge = min(higherEdge, subUv.y);
          if (hW > myHeight) higherEdge = min(higherEdge, subUv.x);
          if (hS > myHeight) higherEdge = min(higherEdge, 1.0 - subUv.y);
          if (hE > myHeight) higherEdge = min(higherEdge, 1.0 - subUv.x);
          if (higherEdge < 0.22) {
            shadowMask = max(shadowMask, (1.0 - smoothstep(0.0, 0.22, higherEdge)) * 0.75);
          }
          if (shadowMask > 0.01) {
            col *= mix(vec3(1.0), uShadowTint * 0.62, clamp(shadowMask, 0.0, 1.0));
          }

          if (abs(myCode - 22.0) > 0.5) {
            // 4b. Atmospheric Time-of-Day Color Grading across all terrain biomes (Dawn rose-gold, Dusk amber-violet, Night/Midnight deep indigo)
            float slopeSun = clamp(((hW - hE) * uSunDir.x + (hN - hS) * uSunDir.z) * 0.35 + 0.5, 0.0, 1.0);
            vec3 todBiomeGrade = mix(uShadowTint, uSunTint, mix(0.68, 0.34, uDarkness) * (0.65 + 0.35 * slopeSun));
            col *= todBiomeGrade;
          } else {
            // Luminous purple ooze edge shimmer where abyssal void goo creeps onto living terrain
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

          diffuseColor.rgb = col;`,
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
          // Keep Void Goo deep abyssal cosmos unlit & high-contrast regardless of sunlight phase
          if (abs(myCode - 22.0) < 0.5) {
            gl_FragColor.rgb = col;
          }
          // 4c. Post-Lighting Age-Dependent City & Road Nighttime Illumination Pools
          if (uDarkness > 0.03) {
            vec3 nightCityGlow = computeCityNightGlow(
              pixPos,
              tileCoord,
              subUv,
              myCode,
              uTime,
              uEpoch,
              uDarkness
            );
            gl_FragColor.rgb += nightCityGlow * 0.62;
          }
          // 5. Post-Lighting Bold Contoured Zone Overlay (Kingdoms, Animal Territories, Biomes, Temperatures)
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
    terrainMaterialMap.set(tType, [cliffMat, cliffMat, topMat, cliffMat, cliffMat, cliffMat]);
  }

  const updateMap = (
    tiles: TileData[],
    buildings?: BuildingEntity[],
    settlementSpecies?: Record<string, SpeciesId>,
  ) => {
    cityLightBytes.fill(0);

    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const idx = i * 4;
      const code = STYLED_TERRAIN_CODE[t.terrain] ?? 3;
      data[idx] = Math.min(255, code * 8);
      data[idx + 1] = Math.min(255, t.height * 20);
      if (t.height === 0) {
        // Encode smooth bathymetric seabed depth (0 = sunlit coastal/reef sand .. 255 = deep abyssal floor)
        const isReefOrSanctuary =
          (t.resourceNode === 'coral_reef' && (t.coralBleachTimer ?? 0) <= 0 && t.resourceAmount > 0) ||
          t.resourceNode === 'atlantis_ruin' ||
          t.isRiver ||
          t.isLake;
        if (isReefOrSanctuary) {
          data[idx + 2] = 0;
        } else {
          let minLandDistSq = 99;
          let minShallowDistSq = 99;
          let minDeepDistSq = 99;
          for (let dz = -4; dz <= 4; dz++) {
            for (let dx = -4; dx <= 4; dx++) {
              const nx = t.x + dx;
              const nz = t.z + dz;
              if (nx < 0 || nx >= gridSize || nz < 0 || nz >= gridSize) continue;
              const nb = tiles[nz * gridSize + nx];
              const dSq = dx * dx + dz * dz;
              if (nb.height > 0) {
                if (dSq < minLandDistSq) minLandDistSq = dSq;
                if (dSq < minShallowDistSq) minShallowDistSq = dSq;
              } else if (nb.terrain === 'deep_water' && !nb.isRiver && !nb.isLake) {
                if (dSq < minDeepDistSq) minDeepDistSq = dSq;
              } else {
                if (dSq < minShallowDistSq) minShallowDistSq = dSq;
              }
            }
          }
          if (t.terrain !== 'deep_water') {
            const landD = Math.min(4.0, Math.sqrt(minLandDistSq));
            const deepD = Math.min(4.0, Math.sqrt(minDeepDistSq));
            const shoreFrac = Math.max(0, Math.min(1, (landD - 1.0) / 3.0));
            const dropFrac = Math.max(0, Math.min(1, (3.2 - deepD) / 2.2));
            data[idx + 2] = Math.round(shoreFrac * 42 + dropFrac * 68);
          } else {
            const shallowD = Math.min(4.5, Math.sqrt(minShallowDistSq));
            const slopeFrac = Math.max(0, Math.min(1, (shallowD - 1.0) / 3.2));
            data[idx + 2] = Math.round(135 + slopeFrac * 120);
          }
        }
      } else {
        data[idx + 2] = Math.abs(((t.x * 73856093) ^ (t.z * 19349663)) | 0) & 255;
      }
      data[idx + 3] = t.farmSettlementId ? 255 : 0;

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
        const specByte = bSpec === 'elf' ? 160 : bSpec === 'orc' ? 235 : 64;
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
  ) => {
    sharedTime.value = wrapShaderTime(elapsed);
    sharedEpoch.value = epochIndex;

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

  const getMaterials = (terrain: TerrainType) =>
    terrainMaterialMap.get(terrain) ?? terrainMaterialMap.get('grass')!;

  const dispose = () => {
    for (const m of createdMaterials) m.dispose();
    landMapTex.dispose();
    zoneColorTex.dispose();
    zoneIdTex.dispose();
    cityLightTex.dispose();
  };

  return { getMaterials, updateMap, updateZones, updateFrame, dispose };
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
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      void main() {
        gl_Position = vec4(position.xy, 0.9999, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec2 uResolution;
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
        float a = 0.5;
        mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
        for (int i = 0; i < 4; i++) {
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

      // Evaluates one pixel-snapped star layer with crisp 1px dots, + crosses, or ✦ hero bursts
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
        float bandMask,
        float heroChance
      ) {
        vec2 cell = floor(skyP / cellSize);
        vec2 rnd = hash22(cell + uSeedVec + vec2(seedBias, seedBias * 1.7));
        float prob = hash12(cell * 1.37 + uSeedVec + vec2(seedBias * 2.3, 9.1));

        float scaledDensity = density * uStarDensityBias;
        float localDensity = clamp(scaledDensity + bandMask * scaledDensity * 1.55, 0.0, 0.92);
        if (prob > localDensity) {
          return vec3(0.0);
        }

        vec2 starSky = (cell + padFrac + (1.0 - 2.0 * padFrac) * rnd) * cellSize;
        vec2 starScreen = floor(rot2(starSky - skyOrigin, -uCamYaw) / zoomScale + halfRes + 0.5);
        vec2 sd = abs(pix - starScreen);

        float shapeRoll = hash12(cell + vec2(41.3, 19.7) + uSeedVec);
        float bright = 0.42 + 0.58 * hash12(cell + vec2(7.9, 63.1) + uSeedVec);
        float twinklePhase = hash12(cell + vec2(88.2, 13.4) + uSeedVec) * 6.2831;
        float twinkleSpeed = 1.6 + hash12(cell + vec2(3.1, 51.9) + uSeedVec) * 2.8;
        // Quantized retro twinkle step
        float twinkle = 0.72 + 0.28 * floor(0.5 + 0.5 * sin(uTime * twinkleSpeed + twinklePhase) * 2.0 + 0.5) * 0.5;

        float mask = 0.0;
        if (shapeRoll < heroChance) {
          // 5px crisp pixel-art starburst + cross
          float arm = step(sd.x, 0.5) * step(sd.y, 2.1) + step(sd.y, 0.5) * step(sd.x, 2.1);
          float core = step(sd.x, 0.5) * step(sd.y, 0.5);
          if (arm > 0.5) {
            mask = core > 0.5 ? 1.0 : 0.48 * twinkle;
          }
        } else if (shapeRoll < heroChance * 3.0) {
          // 3px crisp + diamond star
          if (sd.x + sd.y < 1.2) {
            mask = (sd.x < 0.5 && sd.y < 0.5) ? 1.0 : 0.45 * twinkle;
          }
        } else {
          // Crisp single-pixel star
          if (sd.x < 0.5 && sd.y < 0.5) {
            mask = 1.0;
          }
        }

        if (mask <= 0.001) return vec3(0.0);

        float tempRoll = hash12(cell + vec2(93.7, 27.3) + uSeedVec);
        vec3 col = starColorFromTemp(tempRoll);
        return col * bright * twinkle * mask;
      }

      void main() {
        vec2 pix = floor(gl_FragCoord.xy / uPixelStep);
        vec2 res = max(vec2(32.0), floor(uResolution / uPixelStep));
        vec2 halfRes = 0.5 * res;
        vec2 pCentered = pix - halfRes;

        // Compensate for dynamic render resolution scale so zooming never rescales/alters the starfield layout
        float pixelNorm = clamp(uPixelScale, 1.0, 4.0) / 3.0;
        float zoomScale = mix(0.88, 1.28, clamp((uFrustumSize - 7.5) / 85.0, 0.0, 1.0));
        float effectiveZoom = zoomScale * pixelNorm;
        vec2 skyOrigin = uCamPan * 0.55;
        vec2 skyP = rot2(pCentered * effectiveZoom, uCamYaw) + skyOrigin;

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
        float starBoost = clamp(rawGalaxy * 1.25 + coreGlow * 0.6, 0.0, 1.0);
        // Micro star dust densely packed along the Milky Way strips
        vec3 starsDust = evalStarLayer(pix, halfRes, skyP, skyOrigin, effectiveZoom, 7.0, 0.22, 0.09, 11.0, starBoost, 0.0);
        // Medium field stars across space
        vec3 starsMid = evalStarLayer(pix, halfRes, skyP, skyOrigin, effectiveZoom, 13.0, 0.20, 0.14, 37.0, starBoost * 0.7, 0.05);
        // Sparse bright twinkling diamond/cross hero stars
        vec3 starsHero = evalStarLayer(pix, halfRes, skyP, skyOrigin, effectiveZoom, 28.0, 0.22, 0.18, 79.0, starBoost * 0.4, 0.26);

        spaceCol += starsDust * 0.58 + starsMid * 0.9 + starsHero * 1.25;

        // 4. Subtle Periodic Pixel Shooting Star
        float meteorEpoch = floor(uTime / 9.5);
        float meteorPhase = fract(uTime / 9.5);
        if (meteorPhase < 0.09) {
          float tM = meteorPhase / 0.09;
          vec2 mSeed = hash22(vec2(meteorEpoch, 17.0) + uSeedVec);
          vec2 mStart = (mSeed - 0.5) * res * 0.82;
          vec2 mDir = normalize(vec2(0.75 + mSeed.x * 0.35, -0.45 - mSeed.y * 0.35));
          vec2 mHead = floor(mStart + mDir * tM * (95.0 / pixelNorm));
          vec2 rel = pix - (mHead + halfRes);
          float along = dot(rel, -mDir);
          float perp = abs(dot(rel, vec2(-mDir.y, mDir.x)));
          float trailLen = 12.0 / pixelNorm;
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
  mesh.renderOrder = -100;

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
    pixelScale: number;
    camYaw: number;
    camX: number;
    camZ: number;
    frustumSize: number;
    preset: LightingPreset;
  }) => {
    // Keep periodic meteor period (9.5s * 200 = 1900s) exact across wraps so shooting stars never jump
    const safeElapsed = Number.isFinite(elapsed) ? ((elapsed % 1900) + 1900) % 1900 : 0;
    uniforms.uTime.value = safeElapsed;
    uniforms.uResolution.value.set(Math.max(1, width), Math.max(1, height));
    uniforms.uPixelStep.value = pixelScale <= 1 ? 2.0 : 1.0;
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
  mesh.renderOrder = 0;

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


