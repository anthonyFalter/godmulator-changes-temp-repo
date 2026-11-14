import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LightingPreset, TerrainType, TileData } from './types';

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

  const geo = new THREE.PlaneGeometry(gridSize, gridSize, gridSize, gridSize);
  geo.rotateX(-Math.PI / 2);

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uGridSize: { value: gridSize },
      uWaterMap: { value: null as THREE.DataTexture | null },
      uShallowColor: { value: new THREE.Color('#2f788e') },
      uDeepColor: { value: new THREE.Color('#193f54') },
      uCrestColor: { value: new THREE.Color('#53b3ca') },
      uFoamColor: { value: new THREE.Color('#f4fbff') },
      uFoamMint: { value: new THREE.Color('#9ee6f5') },
    },
  ]);
  // Assign mutable DataTexture AFTER merge so UniformsUtils.merge does not clone a stale copy
  uniforms.uWaterMap.value = waterMapTex;

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

        gl_FragColor = vec4(color, 1.0);
        #include <fog_fragment>
      }
    `,
  });
  material.uniforms.uWaterMap.value = waterMapTex;

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

  const dispose = () => {
    geo.dispose();
    material.dispose();
    waterMapTex.dispose();
  };

  return { mesh, updateMap, updateFrame, dispose };
}

export interface StyledTerrainSystem {
  getMaterials: (terrain: TerrainType) => THREE.MeshStandardMaterial[];
  updateMap: (tiles: TileData[]) => void;
  updateFrame: (elapsed: number) => void;
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
};

export function createStyledTerrainSystem(gridSize: number): StyledTerrainSystem {
  // RGBA DataTexture storing per-tile terrain info:
  // R = terrain code * 16
  // G = height * 28 (0..224)
  // B = deterministic spatial hash (0..255)
  // A = 255
  const data = new Uint8Array(gridSize * gridSize * 4);
  const landMapTex = new THREE.DataTexture(data, gridSize, gridSize, THREE.RGBAFormat);
  landMapTex.magFilter = THREE.NearestFilter;
  landMapTex.minFilter = THREE.NearestFilter;
  landMapTex.wrapS = THREE.ClampToEdgeWrapping;
  landMapTex.wrapT = THREE.ClampToEdgeWrapping;
  landMapTex.flipY = false;

  const sharedTime = { value: 0 };
  const sharedGridSize = { value: gridSize };
  const sharedLandMap = { value: landMapTex };

  const glslHelpers = `
    uniform float uTime;
    uniform float uGridSize;
    uniform sampler2D uLandMap;
    varying vec3 vLandWorldPos;
    varying vec3 vLandWorldNormal;

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

    float decodeHeight(vec4 t) {
      return floor(t.g * 255.0 / 28.0 + 0.5);
    }

    float decodeTerrain(vec4 t) {
      return floor(t.r * 255.0 / 16.0 + 0.5);
    }

    vec3 computeBiomeColor(float code, vec2 pixPos, vec2 chunkPos, vec2 subUv, float tTime) {
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
        // Fertile: lush river-valley emerald meadow swells & wildflower speckles
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
        // Stone Road: stepped artisanal cobblestone slabs
        vec2 roadPix = floor(subUv * 16.0);
        float rowIdx = floor(roadPix.y / 4.0);
        float colShift = mod(rowIdx, 2.0) * 4.0;
        float mortarY = step(3.0, mod(roadPix.y, 4.0));
        float mortarX = step(7.0, mod(roadPix.x + colShift, 8.0));
        float mortar = max(mortarX, mortarY);
        float toneSeed = landHash12(tileCoordFallback(pixPos) + vec2(rowIdx, floor((roadPix.x + colShift) / 8.0)));
        vec3 base = landSrgb(168.0, 148.0, 130.0);
        vec3 hi   = landSrgb(202.0, 182.0, 158.0);
        vec3 sh   = landSrgb(110.0, 95.0, 82.0);
        vec3 c = mix(base, hi, step(0.55, toneSeed));
        return mix(c, sh, mortar * 0.85);
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
      } else {
        // Crystal Field: luminous geometric arcane/sci-fi circuit plating
        vec2 cGrid = abs(fract(pixPos * 2.0) - 0.5);
        float trace = step(0.41, max(cGrid.x, cGrid.y));
        float pulse = 0.55 + 0.45 * sin(tTime * 2.4 - (pixPos.x + pixPos.y) * 0.7);
        vec3 base = landSrgb(56.0, 79.0, 94.0);
        vec3 hi   = landSrgb(92.0, 219.0, 224.0);
        vec3 sh   = landSrgb(34.0, 50.0, 62.0);
        vec3 c = mix(sh, base, step(0.45, waveA));
        return mix(c, hi, trace * (0.55 + 0.45 * pulse));
      }
    }

    vec2 tileCoordFallback(vec2 pixPos) {
      return floor(pixPos);
    }
  `;

  // Note: move tileCoordFallback above computeBiomeColor so GLSL 1.0 compiles cleanly in all drivers
  const orderedHelpers = glslHelpers.replace(
    '    float landHash12',
    '    vec2 tileCoordFallback(vec2 pixPos) { return floor(pixPos); }\n    float landHash12',
  ).replace(
    '    vec2 tileCoordFallback(vec2 pixPos) {\n      return floor(pixPos);\n    }',
    '',
  );

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
  cliffMat.customProgramCacheKey = () => 'aeon_cliff_pixel_v2';
  cliffMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedTime;
    shader.uniforms.uGridSize = sharedGridSize;
    shader.uniforms.uLandMap = sharedLandMap;
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

        float strata = landNoise(vec2(wallChunk.x * 0.65, wallChunk.y * 2.2));
        float brickRow = floor(wallPix.y * 4.0);
        float brickCol = floor((wallPix.x + mod(brickRow, 2.0) * 0.25) * 2.0);
        float seam = step(0.86, fract(wallPix.y * 4.0)) + step(0.91, fract((wallPix.x + mod(brickRow, 2.0) * 0.25) * 2.0));
        float brickTone = landHash12(vec2(brickCol, brickRow));

        vec3 stoneBase = isCraterWall ? landSrgb(48.0, 36.0, 34.0) : landSrgb(74.0, 89.0, 95.0);
        vec3 stoneHi   = isCraterWall ? landSrgb(78.0, 52.0, 42.0) : landSrgb(104.0, 122.0, 129.0);
        vec3 stoneSh   = isCraterWall ? landSrgb(24.0, 17.0, 18.0) : landSrgb(45.0, 56.0, 61.0);

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

        diffuseColor.rgb = cliffCol;`,
      );
  };
  createdMaterials.push(cliffMat);

  const terrainMaterialMap = new Map<TerrainType, THREE.MeshStandardMaterial[]>();
  const terrainTypes = Object.keys(STYLED_TERRAIN_CODE) as TerrainType[];

  for (const tType of terrainTypes) {
    const tCode = STYLED_TERRAIN_CODE[tType];
    const roughness =
      tType === 'crystal_field' ? 0.34 : tType === 'stone_road' ? 0.65 : tType === 'snow' ? 0.68 : 0.82;
    const metalness = tType === 'crystal_field' ? 0.28 : tType === 'rock' ? 0.12 : 0.05;

    const topMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness,
      metalness,
    });
    topMat.customProgramCacheKey = () => 'aeon_land_top_pixel_v2';
    topMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = sharedTime;
      shader.uniforms.uGridSize = sharedGridSize;
      shader.uniforms.uLandMap = sharedLandMap;
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

          // 0. Sub-tile 16x16 pixelated circular corner rounding so craters, rims & biomes form smooth pixel circles
          float cornerR = 0.46;
          if (myCode != 9.0) {
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

          vec3 col = computeBiomeColor(myCode, pixPos, chunkPos, subUv, uTime);

          // 1. Cross-biome organic pixel dithering along shared terrace seams (except crisp stone roads)
          if (myCode != 9.0) {
            float ditherRng = landHash12(pixPos * 16.0);
            if (hN == myHeight && cN != myCode && cN != 9.0 && subUv.y < 0.24 && ditherRng > subUv.y * 3.8) {
              col = computeBiomeColor(cN, pixPos, chunkPos, subUv, uTime);
            } else if (hS == myHeight && cS != myCode && cS != 9.0 && (1.0 - subUv.y) < 0.24 && ditherRng > (1.0 - subUv.y) * 3.8) {
              col = computeBiomeColor(cS, pixPos, chunkPos, subUv, uTime);
            } else if (hW == myHeight && cW != myCode && cW != 9.0 && subUv.x < 0.24 && ditherRng > subUv.x * 3.8) {
              col = computeBiomeColor(cW, pixPos, chunkPos, subUv, uTime);
            } else if (hE == myHeight && cE != myCode && cE != 9.0 && (1.0 - subUv.x) < 0.24 && ditherRng > (1.0 - subUv.x) * 3.8) {
              col = computeBiomeColor(cE, pixPos, chunkPos, subUv, uTime);
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
            col *= (abs(myCode - 10.0) < 0.5 || abs(myCode - 12.0) < 0.5) ? 1.26 : 1.18;
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
      data[idx] = Math.min(255, code * 16);
      data[idx + 1] = Math.min(255, t.height * 28);
      data[idx + 2] = Math.abs(((t.x * 73856093) ^ (t.z * 19349663)) | 0) & 255;
      data[idx + 3] = 255;
    }
    landMapTex.needsUpdate = true;
  };

  const updateFrame = (elapsed: number) => {
    sharedTime.value = elapsed;
  };

  const getMaterials = (terrain: TerrainType) =>
    terrainMaterialMap.get(terrain) ?? terrainMaterialMap.get('grass')!;

  const dispose = () => {
    for (const m of createdMaterials) m.dispose();
    landMapTex.dispose();
  };

  return { getMaterials, updateMap, updateFrame, dispose };
}

