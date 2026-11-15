import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LightingPreset, TerrainType, TileData } from './types';
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
  mesh: THREE.Mesh;
  shadowMesh: THREE.Mesh;
}

export interface SkyCloudSystem {
  group: THREE.Group;
  shadowGroup: THREE.Group;
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

  let rng = 133791;
  const nextRand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 4294967296;
  };

  for (let i = 0; i < cloudCount; i++) {
    const variant = i % variants.length;
    const geo = variants[variant];
    const mesh = new THREE.Mesh(geo, cloudMat);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 4;

    const shadowMesh = new THREE.Mesh(geo, shadowMat);
    shadowMesh.renderOrder = 2;

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

    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.scale.set(scaleX, scaleY, scaleZ);

    shadowMesh.position.set(x - 2.4, 0.32, z - 1.8);
    shadowMesh.rotation.y = rotY;
    shadowMesh.scale.set(scaleX * 0.88, 0.02, scaleZ * 0.88);

    group.add(mesh);
    shadowGroup.add(shadowMesh);

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
      mesh,
      shadowMesh,
    });
  }

  const _targetTint = new THREE.Color('#f7fbff');
  const _curTint = new THREE.Color('#f7fbff');

  const update = (dt: number, elapsed: number, preset: LightingPreset) => {
    if (preset === 'night') {
      _targetTint.set('#637ea1');
      cloudMat.opacity = 0.72;
      shadowMat.opacity = 0.05;
    } else if (preset === 'dusk') {
      _targetTint.set('#ffae85');
      cloudMat.opacity = 0.86;
      shadowMat.opacity = 0.08;
    } else if (preset === 'dawn') {
      _targetTint.set('#ffdad4');
      cloudMat.opacity = 0.85;
      shadowMat.opacity = 0.08;
    } else {
      _targetTint.set('#f7fbff');
      cloudMat.opacity = 0.86;
      shadowMat.opacity = 0.09;
    }

    _curTint.lerp(_targetTint, Math.min(1, dt * 4));
    cloudMat.color.copy(_curTint);

    for (const c of clouds) {
      const breeze = 1.0 + Math.sin(elapsed * 0.35 + c.phase) * 0.14;
      c.x += c.vx * breeze * dt;
      c.z += (c.vz + Math.cos(elapsed * 0.25 + c.phase) * 0.1) * dt;

      if (c.x > gridSize + pad) c.x -= span;
      if (c.x < -pad) c.x += span;
      if (c.z > gridSize + pad) c.z -= span;
      if (c.z < -pad) c.z += span;

      const bobY = Math.sin(elapsed * 0.9 + c.phase) * c.bobAmp;
      const puffPulse = 1.0 + Math.sin(elapsed * 0.75 + c.phase) * 0.025;

      c.mesh.position.set(c.x, c.y + bobY, c.z);
      c.mesh.scale.set(c.scaleX * puffPulse, c.scaleY, c.scaleZ * puffPulse);

      c.shadowMesh.position.set(c.x - 2.4, 0.32, c.z - 1.8);
      c.shadowMesh.scale.set(c.scaleX * 0.88 * puffPulse, 0.02, c.scaleZ * 0.88 * puffPulse);
    }
  };

  const dispose = () => {
    for (const geo of variants) geo.dispose();
    cloudMat.dispose();
    shadowMat.dispose();
  };

  return { group, shadowGroup, update, dispose };
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

  const geo = new THREE.PlaneGeometry(gridSize, gridSize, gridSize, gridSize);
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
      uShallowColor: { value: new THREE.Color('#2f788e') },
      uDeepColor: { value: new THREE.Color('#193f54') },
      uCrestColor: { value: new THREE.Color('#53b3ca') },
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
    depthWrite: true,
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

        bool isDeep = self.r > 0.75;

        // 8-neighbor sampling for exact coastline (hits land) and other-water (shallow <-> deep) distances
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

        // 2. Exact pixel distance to other-water boundaries (shallow_water <-> deep_water)
        float diffDist = 2.0;
        if (nN.r  >= 0.15 && abs(nN.r  - self.r) > 0.25) diffDist = min(diffDist, subUv.y);
        if (nS.r  >= 0.15 && abs(nS.r  - self.r) > 0.25) diffDist = min(diffDist, 1.0 - subUv.y);
        if (nW.r  >= 0.15 && abs(nW.r  - self.r) > 0.25) diffDist = min(diffDist, subUv.x);
        if (nE.r  >= 0.15 && abs(nE.r  - self.r) > 0.25) diffDist = min(diffDist, 1.0 - subUv.x);
        if (nNW.r >= 0.15 && abs(nNW.r - self.r) > 0.25) diffDist = min(diffDist, length(vec2(subUv.x, subUv.y)));
        if (nNE.r >= 0.15 && abs(nNE.r - self.r) > 0.25) diffDist = min(diffDist, length(vec2(1.0 - subUv.x, subUv.y)));
        if (nSW.r >= 0.15 && abs(nSW.r - self.r) > 0.25) diffDist = min(diffDist, length(vec2(subUv.x, 1.0 - subUv.y)));
        if (nSE.r >= 0.15 && abs(nSE.r - self.r) > 0.25) diffDist = min(diffDist, length(vec2(1.0 - subUv.x, 1.0 - subUv.y)));

        // Coarser chunky pixel coordinates (8 texels per tile) for readable wave crests & whitecaps
        vec2 chunkPos = floor(pixPos * 8.0) / 8.0;
        float swellA = valueNoise(chunkPos * 0.45 + vec2(uTime * 0.34, uTime * 0.22));
        float swellB = valueNoise(chunkPos * 0.9 - vec2(uTime * 0.24, -uTime * 0.3));
        float waveField = swellA * 0.65 + swellB * 0.35;

        vec3 baseWater = isDeep ? uDeepColor : uShallowColor;
        // Brighter turquoise shoal water right along coastlines
        if (landDist < 1.1) {
          baseWater = mix(baseWater, mix(uShallowColor, uCrestColor, 0.45), smoothstep(1.1, 0.08, landDist));
        }

        // Pixelated rolling wave bands
        float ridge = step(0.6, waveField);
        float glint = step(0.77, waveField + 0.06 * sin(chunkPos.x * 1.1 + uTime * 2.1));
        vec3 color = mix(baseWater, mix(baseWater, uCrestColor, 0.4), ridge * 0.55);
        color = mix(color, uCrestColor, glint * 0.38);

        // --- FOAM 1: Coast hitting dry land (rhythmic crashing shoreline surge + rolling breaker ring) ---
        float coastWobble = (swellB - 0.5) * 0.26 + sin((pixPos.x - pixPos.y) * 1.1 + uTime * 2.0) * 0.06;
        float surgeLap = 0.28 + 0.11 * sin(uTime * 2.8 + (pixPos.x + pixPos.y) * 0.42);
        float shoreCrest = step(landDist + coastWobble * 0.42, surgeLap);

        float breakerWave = fract(landDist * 1.35 + uTime * 0.62 + coastWobble * 0.45);
        float breakerBand = nearCoastInfluence * step(0.7, breakerWave) * smoothstep(1.2, 0.06, landDist);
        float breakerBreakup = step(0.32, valueNoise(chunkPos * 1.45 + vec2(uTime * 0.38, -uTime * 0.28)));

        float coastFoamCore = step(landDist + coastWobble * 0.3, surgeLap * 0.76);
        float coastFoamMint = max(shoreCrest, breakerBand * breakerBreakup);

        // --- FOAM 2: Other waters meeting (shallow_water <-> deep_water dropoff shoal foam) ---
        float reefWobble = (swellA - 0.5) * 0.2;
        float reefWave = sin(diffDist * 9.0 - uTime * 2.4 + (pixPos.x + pixPos.y) * 0.75);
        float reefNoise = valueNoise(chunkPos * 1.25 + vec2(-uTime * 0.34, uTime * 0.42));
        float reefBand = step(diffDist + reefWobble, 0.48) * step(0.38, reefNoise + reefWave * 0.26);
        float reefCore = step(diffDist + reefWobble, 0.26) * step(0.54, reefNoise + reefWave * 0.22);

        // --- FOAM 3: Random open-sea whitecaps & ephemeral bubble trails ---
        float capA = valueNoise(chunkPos * 0.55 + vec2(uTime * 0.26, uTime * 0.16));
        float capB = valueNoise(chunkPos * 1.35 - vec2(uTime * 0.38, -uTime * 0.2));
        float capPulse = 0.5 + 0.5 * sin(uTime * 1.4 + self.a * 6.2831 + chunkPos.x * 0.3);
        float combinedCap = capA * 0.54 + capB * 0.32 + capPulse * 0.14;

        float capThresh = isDeep ? 0.77 : 0.815;
        float openFoamMint = step(capThresh, combinedCap);
        float openFoamCore = step(capThresh + 0.042, combinedCap);

        float mintMask = max(coastFoamMint, max(reefBand, openFoamMint));
        float whiteMask = max(coastFoamCore, max(reefCore, openFoamCore));

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

            bool diffN = abs(zN.r - zId.r) > 0.002 || abs(zN.g - zId.g) > 0.002;
            bool diffS = abs(zS.r - zId.r) > 0.002 || abs(zS.g - zId.g) > 0.002;
            bool diffW = abs(zW.r - zId.r) > 0.002 || abs(zW.g - zId.g) > 0.002;
            bool diffE = abs(zE.r - zId.r) > 0.002 || abs(zE.g - zId.g) > 0.002;

            bool diffNW = abs(zNW.r - zId.r) > 0.002 || abs(zNW.g - zId.g) > 0.002;
            bool diffNE = abs(zNE.r - zId.r) > 0.002 || abs(zNE.g - zId.g) > 0.002;
            bool diffSW = abs(zSW.r - zId.r) > 0.002 || abs(zSW.g - zId.g) > 0.002;
            bool diffSE = abs(zSE.r - zId.r) > 0.002 || abs(zSE.g - zId.g) > 0.002;

            float bw = 2.0 / 16.0;
            bool onBorder =
              (diffN && subUv.y < bw) ||
              (diffS && subUv.y > 1.0 - bw) ||
              (diffW && subUv.x < bw) ||
              (diffE && subUv.x > 1.0 - bw) ||
              (diffNW && subUv.x < bw && subUv.y < bw) ||
              (diffNE && subUv.x > 1.0 - bw && subUv.y < bw) ||
              (diffSW && subUv.x < bw && subUv.y > 1.0 - bw) ||
              (diffSE && subUv.x > 1.0 - bw && subUv.y > 1.0 - bw);

            vec2 subPix = floor(subUv * 16.0);
            float checker = mod(subPix.x + subPix.y, 2.0);
            bool isHovered = zId.b > 0.5;
            float hoverPulse = isHovered ? (0.14 + 0.08 * sin(uTime * 5.0)) : 0.0;

            if (onBorder) {
              // Nautical dashed/beaded border on water, solid bright when hovered
              float dash = mod(floor((pixPos.x + pixPos.y) * 8.0), 2.0);
              float borderMix = isHovered ? 0.96 : (dash > 0.5 ? 0.92 : 0.62);
              vec3 borderCol = isHovered ? mix(zCol.rgb, vec3(1.0), 0.42) : mix(zCol.rgb, vec3(1.0), 0.18);
              color = mix(color, borderCol, borderMix);
            } else {
              float baseAlpha = zCol.a * (0.34 + 0.14 * checker) + hoverPulse;
              color = mix(color, zCol.rgb, clamp(baseAlpha, 0.0, 0.72));
            }
          }
        }

        gl_FragColor = vec4(color, 1.0);
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
  mesh.renderOrder = 1;

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

      const depthVal = t.terrain === 'deep_water' ? 255 : 132;
      data[idx] = depthVal;

      let touchesLand = 0;
      let touchesOtherWater = 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const nx = t.x + dx;
          const nz = t.z + dz;
          if (nx < 0 || nx >= gridSize || nz < 0 || nz >= gridSize) continue;
          const nb = tiles[nz * gridSize + nx];
          if (nb.height > 0) {
            touchesLand = 255;
          } else if (nb.terrain !== t.terrain) {
            touchesOtherWater = 255;
          }
        }
      }

      data[idx + 1] = touchesLand;
      data[idx + 2] = touchesOtherWater;

      const phaseByte = Math.abs(((t.x * 73856093) ^ (t.z * 19349663)) | 0) & 255;
      data[idx + 3] = phaseByte;
    }
    waterMapTex.needsUpdate = true;
  };

  const _shallowTarget = new THREE.Color('#2f788e');
  const _deepTarget = new THREE.Color('#193f54');
  const _crestTarget = new THREE.Color('#53b3ca');
  const _foamTarget = new THREE.Color('#f4fbff');
  const _mintTarget = new THREE.Color('#9ee6f5');

  const updateFrame = (elapsed: number, preset: LightingPreset) => {
    const mu = material.uniforms;
    mu.uTime.value = elapsed;

    if (preset === 'night') {
      _shallowTarget.set('#1a4357');
      _deepTarget.set('#0c212e');
      _crestTarget.set('#2c6680');
      _foamTarget.set('#b8d6ea');
      _mintTarget.set('#5c8fa8');
    } else if (preset === 'dusk') {
      _shallowTarget.set('#376478');
      _deepTarget.set('#1f384d');
      _crestTarget.set('#d9886c');
      _foamTarget.set('#ffe9dc');
      _mintTarget.set('#b3c4d4');
    } else if (preset === 'dawn') {
      _shallowTarget.set('#387487');
      _deepTarget.set('#1d4459');
      _crestTarget.set('#e8a3a0');
      _foamTarget.set('#fff3f0');
      _mintTarget.set('#b5dfe8');
    } else {
      _shallowTarget.set('#2f788e');
      _deepTarget.set('#193f54');
      _crestTarget.set('#53b3ca');
      _foamTarget.set('#f4fbff');
      _mintTarget.set('#9ee6f5');
    }

    mu.uShallowColor.value.lerp(_shallowTarget, 0.08);
    mu.uDeepColor.value.lerp(_deepTarget, 0.08);
    mu.uCrestColor.value.lerp(_crestTarget, 0.08);
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
  updateMap: (tiles: TileData[]) => void;
  updateZones: (colorData: Uint8Array, idData: Uint8Array, anyActive: boolean) => void;
  updateFrame: (elapsed: number, epochIndex?: number) => void;
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

  const sharedTime = { value: 0 };
  const sharedEpoch = { value: 0 };
  const sharedGridSize = { value: gridSize };
  const sharedLandMap = { value: landMapTex };
  const sharedZoneColorMap = { value: zoneColorTex };
  const sharedZoneIdMap = { value: zoneIdTex };
  const sharedZoneActive = { value: 0 };

  const glslHelpers = `
    uniform float uTime;
    uniform float uEpoch;
    uniform float uGridSize;
    uniform sampler2D uLandMap;
    uniform sampler2D uZoneColorMap;
    uniform sampler2D uZoneIdMap;
    uniform float uZoneActive;
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

    float decodeHeight(vec4 t) {
      return floor(t.g * 255.0 / 20.0 + 0.5);
    }

    float decodeTerrain(vec4 t) {
      return floor(t.r * 255.0 / 8.0 + 0.5);
    }

    vec3 computeBiomeColor(float code, vec2 pixPos, vec2 chunkPos, vec2 subUv, float tTime, bool isCultivatedFarm) {
      float waveA = landNoise(chunkPos * 0.42);
      float waveB = landNoise(chunkPos * 0.92 + vec2(11.3, 7.1));
      float detail = landHash12(pixPos * 16.0);
      float patchVal = waveA * 0.62 + waveB * 0.38;

      if (code < 2.5) {
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
      } else {
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
      }
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

      // Distance field to connected 4-way centerline arms (seamlessly shapes straights, turns, T-junctions & crossroads)
      float dRoad = length(rp - vec2(0.5));
      if (rN) dRoad = min(dRoad, length(vec2(rp.x - 0.5, max(0.0, rp.y - 0.5))));
      if (rS) dRoad = min(dRoad, length(vec2(rp.x - 0.5, max(0.0, 0.5 - rp.y))));
      if (rW) dRoad = min(dRoad, length(vec2(max(0.0, rp.x - 0.5), rp.y - 0.5)));
      if (rE) dRoad = min(dRoad, length(vec2(max(0.0, 0.5 - rp.x), rp.y - 0.5)));

      // If user painted a 2x2 plaza/multi-lane highway, suppress interior grass/curb corners where all 4 tiles are roads
      if ((rp.x < 0.5 && rp.y < 0.5 && rN && rW && rNW) ||
          (rp.x >= 0.5 && rp.y < 0.5 && rN && rE && rNE) ||
          (rp.x < 0.5 && rp.y >= 0.5 && rS && rW && rSW) ||
          (rp.x >= 0.5 && rp.y >= 0.5 && rS && rE && rSE)) {
        dRoad = 0.0;
      }

      if (dRoad > 0.36) {
        return marginCol;
      }

      float connCount = (rN ? 1.0 : 0.0) + (rS ? 1.0 : 0.0) + (rW ? 1.0 : 0.0) + (rE ? 1.0 : 0.0);
      bool isStraightNS = (rN || rS) && !rW && !rE;
      bool isStraightWE = (rW || rE) && !rN && !rS;
      bool turnNE = rN && rE && !rS && !rW;
      bool turnNW = rN && rW && !rS && !rE;
      bool turnSE = rS && rE && !rN && !rW;
      bool turnSW = rS && rW && !rN && !rE;
      bool isTurn = turnNE || turnNW || turnSE || turnSW;
      bool isJunction = connCount >= 3.0;
      bool onCenterHub = max(abs(rp.x - 0.5), abs(rp.y - 0.5)) < 0.25;

      vec2 ic = vec2(0.5);
      if (turnNE) ic = vec2(1.0, 0.0);
      else if (turnNW) ic = vec2(0.0, 0.0);
      else if (turnSE) ic = vec2(1.0, 1.0);
      else if (turnSW) ic = vec2(0.0, 1.0);

      // Local dominant arm axis for planks / stone courses when in junctions or corners
      bool armVertical = isStraightNS ||
        (rN && rp.y < 0.5 && abs(rp.x - 0.5) <= abs(rp.y - 0.5)) ||
        (rS && rp.y >= 0.5 && abs(rp.x - 0.5) <= abs(rp.y - 0.5));
      if (isStraightWE) armVertical = false;

      float noiseVal = landHash12(pixPos * 16.0);

      if (uEpoch < 1.5) {
        // Prehistoric & Bronze Ages: Trodden earth & wooden boardwalk planks oriented perpendicular to road direction
        vec3 dirtBase  = landSrgb(138.0, 106.0, 72.0);
        vec3 woodPlank = landSrgb(162.0, 124.0, 84.0);
        vec3 darkMud   = landSrgb(98.0, 72.0, 46.0);

        if (dRoad > 0.27) {
          return mix(dirtBase, darkMud, step(0.55, noiseVal) * 0.65);
        }

        float plankSeam = 0.0;
        if (isJunction || connCount < 0.5) {
          if (onCenterHub) {
            plankSeam = max(step(3.0, mod(roadPix.x, 4.0)), step(3.0, mod(roadPix.y, 4.0))) * 0.75;
          } else {
            plankSeam = armVertical ? step(3.0, mod(roadPix.y, 4.0)) : step(3.0, mod(roadPix.x, 4.0));
          }
        } else if (isTurn) {
          float arcR = length(rp - ic);
          float arcAng = atan(abs(rp.y - ic.y), abs(rp.x - ic.x) + 0.0001);
          float stepPhase = fract(arcAng / 1.5707963 * 4.0);
          plankSeam = step(0.75, stepPhase);
          if (abs(arcR - 0.5) > 0.20) return dirtBase;
        } else {
          plankSeam = armVertical ? step(3.0, mod(roadPix.y, 4.0)) : step(3.0, mod(roadPix.x, 4.0));
        }

        vec3 c = mix(woodPlank, dirtBase, step(0.78, noiseVal) * 0.45);
        return mix(c, darkMud, plankSeam * 0.72);

      } else if (uEpoch < 3.5) {
        // Classical & Industrial Ages: Oriented cobblestone courses, stone curb edges & plaza setts
        vec3 base = landSrgb(168.0, 148.0, 130.0);
        vec3 hi   = landSrgb(202.0, 182.0, 158.0);
        vec3 sh   = landSrgb(110.0, 95.0, 82.0);
        vec3 curb = landSrgb(134.0, 120.0, 106.0);

        if (dRoad > 0.28) {
          float curbJoint = step(0.78, fract((rp.x + rp.y) * 4.0));
          return mix(curb, sh, curbJoint * 0.7);
        }

        float mortar = 0.0;
        float toneSeed = 0.5;
        if (isJunction || connCount < 0.5 || (isTurn && onCenterHub)) {
          float sqX = step(3.0, mod(roadPix.x, 4.0));
          float sqY = step(3.0, mod(roadPix.y, 4.0));
          mortar = max(sqX, sqY);
          toneSeed = landHash12(tileCoordFallback(pixPos) + floor(roadPix / 4.0));
        } else if (isTurn) {
          float arcR = length(rp - ic);
          float arcAng = atan(abs(rp.y - ic.y), abs(rp.x - ic.x) + 0.0001);
          float ringIdx = floor(arcR * 8.0);
          float angIdx = floor(arcAng / 1.5707963 * 6.0 + mod(ringIdx, 2.0) * 0.5);
          mortar = max(step(0.78, fract(arcR * 8.0)), step(0.80, fract(arcAng / 1.5707963 * 6.0 + mod(ringIdx, 2.0) * 0.5)));
          toneSeed = landHash12(tileCoordFallback(pixPos) + vec2(ringIdx, angIdx));
        } else if (armVertical) {
          float rowIdx = floor(roadPix.y / 4.0);
          float colShift = mod(rowIdx, 2.0) * 4.0;
          float mortarY = step(3.0, mod(roadPix.y, 4.0));
          float mortarX = step(7.0, mod(roadPix.x + colShift, 8.0));
          mortar = max(mortarX, mortarY);
          toneSeed = landHash12(tileCoordFallback(pixPos) + vec2(rowIdx, floor((roadPix.x + colShift) / 8.0)));
        } else {
          float colIdx = floor(roadPix.x / 4.0);
          float rowShift = mod(colIdx, 2.0) * 4.0;
          float mortarX = step(3.0, mod(roadPix.x, 4.0));
          float mortarY = step(7.0, mod(roadPix.y + rowShift, 8.0));
          mortar = max(mortarX, mortarY);
          toneSeed = landHash12(tileCoordFallback(pixPos) + vec2(colIdx, floor((roadPix.y + rowShift) / 8.0)));
        }

        vec3 c = mix(base, hi, step(0.55, toneSeed));
        return mix(c, sh, mortar * 0.82);

      } else if (uEpoch < 5.5) {
        // Atomic & Information Ages: Asphalt roadway with directional centerlines, 90-degree curved lane lines & urban crosswalks
        bool isInfoAge = uEpoch >= 4.5;
        vec3 asphalt = isInfoAge ? landSrgb(44.0, 50.0, 58.0) : landSrgb(54.0, 60.0, 68.0);
        vec3 curbCol = isInfoAge ? landSrgb(164.0, 174.0, 184.0) : landSrgb(142.0, 150.0, 158.0);
        vec3 laneYellow = landSrgb(245.0, 206.0, 72.0);
        vec3 markWhite  = landSrgb(236.0, 242.0, 248.0);

        if (dRoad > 0.29) {
          return mix(curbCol, asphalt, 0.10);
        }

        vec3 c = mix(asphalt, landSrgb(62.0, 68.0, 76.0), step(0.86, noiseVal) * 0.55);

        if (connCount < 0.5) {
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
        } else if (isTurn) {
          float arcDist = abs(length(rp - ic) - 0.5);
          float arcAng = atan(abs(rp.y - ic.y), abs(rp.x - ic.x) + 0.0001);
          float arcDash = step(fract(arcAng / 1.5707963 * 3.0), 0.55);
          float curveLine = step(arcDist, 0.042) * arcDash;
          return mix(c, laneYellow, curveLine * 0.92);
        } else if (isStraightNS) {
          float dash = step(mod(roadPix.y, 4.0), 1.5);
          float endCap = step(dRoad, 0.22);
          float line = step(abs(rp.x - 0.5), 0.04) * dash * endCap;
          // Edge white lane stripes in Info Age
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
        // Orbital & Interstellar Ages (uEpoch >= 5.5): Directional titanium mag-lev transit deck & curved cyan guide rails
        vec3 alloyDeck = landSrgb(38.0, 50.0, 64.0);
        vec3 alloySeam = landSrgb(24.0, 32.0, 42.0);
        vec3 cyanNeon  = landSrgb(86.0, 207.0, 225.0);

        if (dRoad > 0.30) {
          return alloySeam;
        }

        float segJoint = armVertical ? step(7.0, mod(roadPix.y, 8.0)) : step(7.0, mod(roadPix.x, 8.0));
        if (isJunction && onCenterHub) segJoint = 0.0;
        vec3 c = mix(alloyDeck, alloySeam, segJoint * 0.75);

        float rail = step(abs(dRoad - 0.235), 0.038);
        float pulse = 0.0;
        float flowOffset = floor(tTime * 8.0);

        if (connCount < 0.5) {
          pulse = step(abs(length(rp - vec2(0.5)) - 0.11), 0.04);
        } else if (isJunction) {
          float hubRing = step(abs(length(rp - vec2(0.5)) - 0.13), 0.04);
          float armPulse = 0.0;
          if (rN && rp.y < 0.34 && abs(rp.x - 0.5) < 0.04) armPulse = step(1.0, mod(roadPix.y + flowOffset, 4.0));
          if (rS && rp.y > 0.66 && abs(rp.x - 0.5) < 0.04) armPulse = step(1.0, mod(roadPix.y - flowOffset, 4.0));
          if (rW && rp.x < 0.34 && abs(rp.y - 0.5) < 0.04) armPulse = step(1.0, mod(roadPix.x + flowOffset, 4.0));
          if (rE && rp.x > 0.66 && abs(rp.y - 0.5) < 0.04) armPulse = step(1.0, mod(roadPix.x - flowOffset, 4.0));
          pulse = max(hubRing, armPulse);
        } else if (isTurn) {
          float arcDist = abs(length(rp - ic) - 0.5);
          float arcAng = atan(abs(rp.y - ic.y), abs(rp.x - ic.x) + 0.0001);
          float arcFlow = step(0.45, fract(arcAng / 1.5707963 * 4.0 + tTime * 2.0));
          pulse = step(arcDist, 0.042) * arcFlow;
        } else if (isStraightNS) {
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
      vec3 marginCol
    ) {
      vec2 rPix = floor(subUv * 16.0);
      vec2 rp = (rPix + 0.5) / 16.0;

      bool turnNE = tN && tE && !tS && !tW;
      bool turnNW = tN && tW && !tS && !tE;
      bool turnSE = tS && tE && !tN && !tW;
      bool turnSW = tS && tW && !tN && !tE;
      bool isTurn = turnNE || turnNW || turnSE || turnSW;
      bool isStraightNS = (tN || tS) && !tW && !tE;
      bool isStraightWE = (tW || tE) && !tN && !tS;
      float connCount = (tN ? 1.0 : 0.0) + (tS ? 1.0 : 0.0) + (tW ? 1.0 : 0.0) + (tE ? 1.0 : 0.0);

      vec2 ic = vec2(0.5);
      if (turnNE) ic = vec2(1.0, 0.0);
      else if (turnNW) ic = vec2(0.0, 0.0);
      else if (turnSE) ic = vec2(1.0, 1.0);
      else if (turnSW) ic = vec2(0.0, 1.0);

      float dTrack = length(rp - vec2(0.5));
      if (isTurn) {
        dTrack = abs(length(rp - ic) - 0.5);
      } else {
        if (tN) dTrack = min(dTrack, length(vec2(rp.x - 0.5, max(0.0, rp.y - 0.5))));
        if (tS) dTrack = min(dTrack, length(vec2(rp.x - 0.5, max(0.0, 0.5 - rp.y))));
        if (tW) dTrack = min(dTrack, length(vec2(max(0.0, rp.x - 0.5), rp.y - 0.5)));
        if (tE) dTrack = min(dTrack, length(vec2(max(0.0, 0.5 - rp.x), rp.y - 0.5)));
        if (connCount < 0.5) {
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
      if (isTurn) {
        float arcAng = atan(abs(rp.y - ic.y), abs(rp.x - ic.x) + 0.0001);
        tieMask = step(0.55, fract(arcAng / 1.5707963 * 6.0));
      } else if (connCount >= 3.0 && max(abs(rp.x - 0.5), abs(rp.y - 0.5)) < 0.25) {
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
  cliffMat.customProgramCacheKey = () => 'aeon_cliff_pixel_v5';
  cliffMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedTime;
    shader.uniforms.uEpoch = sharedEpoch;
    shader.uniforms.uGridSize = sharedGridSize;
    shader.uniforms.uLandMap = sharedLandMap;
    shader.uniforms.uZoneColorMap = sharedZoneColorMap;
    shader.uniforms.uZoneIdMap = sharedZoneIdMap;
    shader.uniforms.uZoneActive = sharedZoneActive;
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
        bool isCraterWall = abs(ownerCode - 12.0) < 0.5 || abs(neighborCode - 12.0) < 0.5;
        bool isBadlandsWall = abs(ownerCode - 19.0) < 0.5 || abs(neighborCode - 19.0) < 0.5;
        bool isMountainWall = abs(ownerCode - 16.0) < 0.5 || abs(ownerCode - 11.0) < 0.5;

        float strata = landNoise(vec2(wallChunk.x * 0.65, wallChunk.y * 2.2));
        float brickRow = floor(wallPix.y * 4.0);
        float brickCol = floor((wallPix.x + mod(brickRow, 2.0) * 0.25) * 2.0);
        float seam = step(0.86, fract(wallPix.y * 4.0)) + step(0.91, fract((wallPix.x + mod(brickRow, 2.0) * 0.25) * 2.0));
        float brickTone = landHash12(vec2(brickCol, brickRow));

        vec3 stoneBase = isCraterWall
          ? landSrgb(48.0, 36.0, 34.0)
          : isBadlandsWall
            ? landSrgb(162.0, 82.0, 48.0)
            : isMountainWall
              ? landSrgb(88.0, 96.0, 106.0)
              : landSrgb(74.0, 89.0, 95.0);
        vec3 stoneHi = isCraterWall
          ? landSrgb(78.0, 52.0, 42.0)
          : isBadlandsWall
            ? landSrgb(206.0, 122.0, 72.0)
            : isMountainWall
              ? landSrgb(126.0, 136.0, 146.0)
              : landSrgb(104.0, 122.0, 129.0);
        vec3 stoneSh = isCraterWall
          ? landSrgb(24.0, 17.0, 18.0)
          : isBadlandsWall
            ? landSrgb(106.0, 52.0, 32.0)
            : isMountainWall
              ? landSrgb(54.0, 60.0, 68.0)
              : landSrgb(45.0, 56.0, 61.0);

        vec3 cliffCol = mix(stoneSh, stoneBase, step(0.32, strata * 0.7 + brickTone * 0.3));
        cliffCol = mix(cliffCol, stoneHi, step(0.68, strata * 0.65 + brickTone * 0.35));
        cliffCol = mix(cliffCol, stoneSh, clamp(seam, 0.0, 1.0) * 0.65);

        if (isCraterWall) {
          float emberVein = step(0.82, strata * 0.6 + brickTone * 0.4);
          cliffCol = mix(cliffCol, landSrgb(245.0, 98.0, 28.0), emberVein * 0.75);
        }

        // Directional side shade: cooler on west/north-facing walls, slightly brighter sun-kissed east/south cliffs
        float sunSide = clamp(dot(vLandWorldNormal, normalize(vec3(0.7, 0.2, 0.5))) * 0.5 + 0.5, 0.0, 1.0);
        cliffCol *= mix(0.82, 1.12, sunSide);

        // Darken submerged base slightly like damp shoreline rock
        if (vLandWorldPos.y < 0.48) {
          cliffCol *= mix(0.68, 1.0, smoothstep(0.26, 0.48, vLandWorldPos.y));
        }

        if (uZoneActive > 0.5) {
          vec4 zCol = sampleLandZoneColor(cliffOwnerCoord);
          vec4 zId = sampleLandZoneId(cliffOwnerCoord);
          if (zCol.a > 0.01) {
            vec3 zLin = pow(zCol.rgb, vec3(2.2));
            float hBoost = zId.b > 0.5 ? 0.16 : 0.0;
            cliffCol = mix(cliffCol, zLin, clamp(zCol.a * 0.42 + hBoost, 0.0, 0.68));
          }
        }

        diffuseColor.rgb = cliffCol;`,
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
    topMat.customProgramCacheKey = () => 'aeon_land_top_pixel_v8';
    topMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = sharedTime;
      shader.uniforms.uEpoch = sharedEpoch;
      shader.uniforms.uGridSize = sharedGridSize;
      shader.uniforms.uLandMap = sharedLandMap;
      shader.uniforms.uZoneColorMap = sharedZoneColorMap;
      shader.uniforms.uZoneIdMap = sharedZoneIdMap;
      shader.uniforms.uZoneActive = sharedZoneActive;
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
            bool rN = abs(cN - 9.0) < 0.5;
            bool rS = abs(cS - 9.0) < 0.5;
            bool rW = abs(cW - 9.0) < 0.5;
            bool rE = abs(cE - 9.0) < 0.5;
            bool rNW = abs(decodeTerrain(sampleLandTile(tileCoord + vec2(-1.0, -1.0))) - 9.0) < 0.5;
            bool rNE = abs(decodeTerrain(sampleLandTile(tileCoord + vec2( 1.0, -1.0))) - 9.0) < 0.5;
            bool rSW = abs(decodeTerrain(sampleLandTile(tileCoord + vec2(-1.0,  1.0))) - 9.0) < 0.5;
            bool rSE = abs(decodeTerrain(sampleLandTile(tileCoord + vec2( 1.0,  1.0))) - 9.0) < 0.5;

            float marginBiome = 3.0;
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
            }
            vec3 marginCol = computeBiomeColor(marginBiome, pixPos, chunkPos, subUv, uTime, false);
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
            // 0c. Connected Metro / Railway Track (rail_track = 14.0)
            bool tN = abs(cN - 14.0) < 0.5 || (abs(cN - 9.0) < 0.5 && abs(cS - 14.0) < 0.5);
            bool tS = abs(cS - 14.0) < 0.5 || (abs(cS - 9.0) < 0.5 && abs(cN - 14.0) < 0.5);
            bool tW = abs(cW - 14.0) < 0.5 || (abs(cW - 9.0) < 0.5 && abs(cE - 14.0) < 0.5);
            bool tE = abs(cE - 14.0) < 0.5 || (abs(cE - 9.0) < 0.5 && abs(cW - 14.0) < 0.5);

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
            col = computeRailColor(pixPos, subUv, uTime, tN, tS, tW, tE, marginCol);
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
          }

          // 1. Cross-biome organic pixel dithering along shared terrace seams (except crisp roads, rails & runways)
          if (myCode != 9.0 && myCode != 14.0 && myCode != 21.0) {
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

          // 3. Isometric Pixel-Art Cliff Edge Rim Highlight (facing lower step, with circular corner rounding)
          float lowerEdge = 2.0;
          if (hS < myHeight) lowerEdge = min(lowerEdge, 1.0 - subUv.y);
          if (hE < myHeight) lowerEdge = min(lowerEdge, 1.0 - subUv.x);
          if (hN < myHeight) lowerEdge = min(lowerEdge, subUv.y);
          if (hW < myHeight) lowerEdge = min(lowerEdge, subUv.x);
          if (lowerEdge < 0.12) {
            col *= (abs(myCode - 10.0) < 0.5 || abs(myCode - 12.0) < 0.5 || abs(myCode - 16.0) < 0.5) ? 1.26 : 1.18;
          }

          // 4. Crisp Terrace / Crater Bowl Base Ambient Occlusion Shadow (adjacent to taller step)
          float higherEdge = 2.0;
          if (hN > myHeight) higherEdge = min(higherEdge, subUv.y);
          if (hW > myHeight) higherEdge = min(higherEdge, subUv.x);
          if (hS > myHeight) higherEdge = min(higherEdge, 1.0 - subUv.y);
          if (hE > myHeight) higherEdge = min(higherEdge, 1.0 - subUv.x);
          if (higherEdge < 0.22) {
            col *= mix(0.62, 1.0, smoothstep(0.0, 0.22, higherEdge));
          }

          // 5. Dynamic Contoured Zone Overlay (Kingdoms, Animal Territories, Biomes, Temperatures)
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

              bool diffN = abs(zN.r - zId.r) > 0.002 || abs(zN.g - zId.g) > 0.002;
              bool diffS = abs(zS.r - zId.r) > 0.002 || abs(zS.g - zId.g) > 0.002;
              bool diffW = abs(zW.r - zId.r) > 0.002 || abs(zW.g - zId.g) > 0.002;
              bool diffE = abs(zE.r - zId.r) > 0.002 || abs(zE.g - zId.g) > 0.002;

              bool diffNW = abs(zNW.r - zId.r) > 0.002 || abs(zNW.g - zId.g) > 0.002;
              bool diffNE = abs(zNE.r - zId.r) > 0.002 || abs(zNE.g - zId.g) > 0.002;
              bool diffSW = abs(zSW.r - zId.r) > 0.002 || abs(zSW.g - zId.g) > 0.002;
              bool diffSE = abs(zSE.r - zId.r) > 0.002 || abs(zSE.g - zId.g) > 0.002;

              float bw = 2.0 / 16.0;
              bool onBorder =
                (diffN && subUv.y < bw) ||
                (diffS && subUv.y > 1.0 - bw) ||
                (diffW && subUv.x < bw) ||
                (diffE && subUv.x > 1.0 - bw) ||
                (diffNW && subUv.x < bw && subUv.y < bw) ||
                (diffNE && subUv.x > 1.0 - bw && subUv.y < bw) ||
                (diffSW && subUv.x < bw && subUv.y > 1.0 - bw) ||
                (diffSE && subUv.x > 1.0 - bw && subUv.y > 1.0 - bw);

              vec3 zLinear = pow(zCol.rgb, vec3(2.2));
              vec2 subPix = floor(subUv * 16.0);
              float checker = mod(subPix.x + subPix.y, 2.0);
              bool isHovered = zId.b > 0.5;
              float hoverPulse = isHovered ? (0.16 + 0.09 * sin(uTime * 5.0)) : 0.0;

              if (onBorder) {
                vec3 rimCol = isHovered ? mix(zLinear, vec3(1.0), 0.45) : mix(zLinear, vec3(1.0), 0.16);
                col = mix(col, rimCol, isHovered ? 0.96 : 0.88);
              } else {
                float fillAlpha = zCol.a * (0.42 + 0.16 * checker) + hoverPulse;
                col = mix(col, zLinear, clamp(fillAlpha, 0.0, 0.78));
              }
            }
          }

          diffuseColor.rgb = col;`,
        );
    };

    createdMaterials.push(topMat);
    terrainMaterialMap.set(tType, [cliffMat, cliffMat, topMat, cliffMat, cliffMat, cliffMat]);
  }

  const updateMap = (tiles: TileData[]) => {
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const idx = i * 4;
      const code = STYLED_TERRAIN_CODE[t.terrain] ?? 3;
      data[idx] = Math.min(255, code * 8);
      data[idx + 1] = Math.min(255, t.height * 20);
      data[idx + 2] = Math.abs(((t.x * 73856093) ^ (t.z * 19349663)) | 0) & 255;
      data[idx + 3] = t.farmSettlementId ? 255 : 0;
    }
    landMapTex.needsUpdate = true;
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

  const updateFrame = (elapsed: number, epochIndex = 0) => {
    sharedTime.value = elapsed;
    sharedEpoch.value = epochIndex;
  };

  const getMaterials = (terrain: TerrainType) =>
    terrainMaterialMap.get(terrain) ?? terrainMaterialMap.get('grass')!;

  const dispose = () => {
    for (const m of createdMaterials) m.dispose();
    landMapTex.dispose();
    zoneColorTex.dispose();
    zoneIdTex.dispose();
  };

  return { getMaterials, updateMap, updateZones, updateFrame, dispose };
}

export interface PixelSpaceSystem {
  mesh: THREE.Mesh;
  setSeed: (seed: number) => void;
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
];

export function createPixelSpaceSystem(initialSeed: number): PixelSpaceSystem {
  const geo = new THREE.PlaneGeometry(2, 2);

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(320, 180) },
    uPixelStep: { value: 1.0 },
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
    uVoidColor: { value: new THREE.Color('#050711') },
    uBandColorA: { value: new THREE.Color('#17234a') },
    uBandColorB: { value: new THREE.Color('#50468f') },
    uCoreColor: { value: new THREE.Color('#ffdca8') },
    uPresetTint: { value: new THREE.Color('#0a0d18') },
    uPresetStrength: { value: 1.0 },
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
      uniform vec3 uVoidColor;
      uniform vec3 uBandColorA;
      uniform vec3 uBandColorB;
      uniform vec3 uCoreColor;
      uniform vec3 uPresetTint;
      uniform float uPresetStrength;

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
        if (t < 0.24) return vec3(0.62, 0.82, 1.0);       // Blue-white giant
        if (t < 0.58) return vec3(0.95, 0.97, 1.0);       // Crisp white star
        if (t < 0.82) return vec3(1.0, 0.91, 0.68);       // Warm golden star
        return vec3(1.0, 0.72, 0.54);                     // Ember orange dwarf
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

        float localDensity = clamp(density + bandMask * density * 1.55, 0.0, 0.92);
        if (prob > localDensity) {
          return vec3(0.0);
        }

        vec2 starSky = (cell + padFrac + (1.0 - 2.0 * padFrac) * rnd) * cellSize;
        vec2 starScreen = floor(rot2(starSky - skyOrigin, -uCamYaw) / zoomScale + halfRes + 0.5);
        vec2 sd = abs(pix - starScreen);

        float shapeRoll = hash12(cell + vec2(41.3, 19.7) + uSeedVec);
        float bright = 0.42 + 0.58 * hash12(cell + vec2(7.9, 63.1) + uSeedVec);
        float twinklePhase = hash12(cell + vec2(88.2, 13.4)) * 6.2831;
        float twinkleSpeed = 1.6 + hash12(cell + vec2(3.1, 51.9)) * 2.8;
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

        // Subtle zoom response keeps stars razor-sharp while revealing wider Milky Way vistas when zoomed out
        float zoomScale = mix(0.88, 1.28, clamp((uFrustumSize - 7.5) / 85.0, 0.0, 1.0));
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
          float tilt = hash12(galCell + vec2(9.1, 4.7)) * 3.14159;
          vec2 gr = rot2(gd, tilt);
          float ellip = length(vec2(gr.x * 0.58, gr.y * 1.35));
          float galSize = 4.5 + hash12(galCell + vec2(33.1, 12.8)) * 5.5;
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
        vec3 starsDust = evalStarLayer(pix, halfRes, skyP, skyOrigin, zoomScale, 7.0, 0.22, 0.09, 11.0, starBoost, 0.0);
        // Medium field stars across space
        vec3 starsMid = evalStarLayer(pix, halfRes, skyP, skyOrigin, zoomScale, 13.0, 0.20, 0.14, 37.0, starBoost * 0.7, 0.05);
        // Sparse bright twinkling diamond/cross hero stars
        vec3 starsHero = evalStarLayer(pix, halfRes, skyP, skyOrigin, zoomScale, 28.0, 0.22, 0.18, 79.0, starBoost * 0.4, 0.26);

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
          if (perp < 0.7 && along >= 0.0 && along < 12.0) {
            float fade = (1.0 - along / 12.0) * sin(tM * 3.14159);
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

  const setSeed = (rawSeed: number) => {
    const seed = normalizeSeed(rawSeed);
    const rng = createRng(seed ^ 0x517cc1b7);

    uniforms.uSeedVec.value.set(rng() * 500 + 13.7, rng() * 500 + 29.3);
    uniforms.uBandAngle.value = (rng() - 0.5) * Math.PI;
    uniforms.uBandOffset.value = (rng() - 0.5) * 48;
    uniforms.uBandWidth.value = 82 + rng() * 68;
    uniforms.uBandCurve.value = 12 + rng() * 26;
    uniforms.uCoreShift.value = (rng() - 0.5) * 140;
    uniforms.uSecondStrength.value = 0.2 + rng() * 0.45;
    uniforms.uSecondAngle.value = uniforms.uBandAngle.value + (rng() > 0.5 ? 1 : -1) * (0.45 + rng() * 0.6);

    const palette = SPACE_PALETTES[Math.floor(rng() * SPACE_PALETTES.length)];
    uniforms.uVoidColor.value.set(palette.voidHex);
    uniforms.uBandColorA.value.set(palette.bandAHex);
    uniforms.uBandColorB.value.set(palette.bandBHex);
    uniforms.uCoreColor.value.set(palette.coreHex);
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
    uniforms.uTime.value = elapsed;
    uniforms.uResolution.value.set(Math.max(1, width), Math.max(1, height));
    uniforms.uPixelStep.value = pixelScale <= 1 ? 2.0 : 1.0;
    uniforms.uCamYaw.value = camYaw;
    uniforms.uCamPan.value.set(camX, camZ);
    uniforms.uFrustumSize.value = frustumSize;

    let targetStrength = 0.92;
    if (preset === 'night') {
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
      targetStrength = 0.94;
    }

    uniforms.uPresetTint.value.lerp(_targetTint, 0.08);
    uniforms.uPresetStrength.value += (targetStrength - uniforms.uPresetStrength.value) * 0.08;
  };

  const dispose = () => {
    geo.dispose();
    material.dispose();
  };

  return { mesh, setSeed, update, dispose };
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
    uniforms.uTime.value = elapsed;
    uniforms.uPixelStep.value = pixelScale <= 1 ? 2.0 : 1.0;

    let targetIntensity = 0.42;
    if (preset === 'night') {
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


