import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ActiveHazardZone } from './types';

/**
 * Dramatic, VFX-ready 3D God Power hazard visuals strictly conforming to PERFORMANCE_README.md:
 * - Zero full-map scans; zero per-frame allocations (module-level scratch math objects).
 * - Multi-part swarms/debris/precipitation use 1 THREE.InstancedMesh per sub-part group.
 * - Rigid composite silhouettes (clouds, cracks, fissures, eye frame, clockwork) use mergeGeometries.
 * - Continuous ambient particle emissions are throttled to ~16–18 Hz via particleTimer.
 * - Every custom geometry, material, and InstancedMesh is cleanly disposed on hazard exit & unmount.
 */

export type EnhancedHazardKind =
  | 'locust_swarm'
  | 'sentinel_eye'
  | 'purify_wave'
  | 'sinkhole_collapse'
  | 'acid_cloud'
  | 'blizzard_gale'
  | 'magma_geyser'
  | 'biome_bloom_wave'
  | 'chrono_field'
  | 'gravity_anomaly'
  | 'orbital_beam';

export const ENHANCED_HAZARD_KINDS = new Set<string>([
  'locust_swarm',
  'sentinel_eye',
  'purify_wave',
  'sinkhole_collapse',
  'acid_cloud',
  'blizzard_gale',
  'magma_geyser',
  'biome_bloom_wave',
  'chrono_field',
  'gravity_anomaly',
  'orbital_beam',
]);

export interface EnhancedHazardVfxState {
  kind: EnhancedHazardKind;
  group: THREE.Group;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
  instancedMeshes: THREE.InstancedMesh[];
  particleTimer: number;
  // Kind-specific references for zero-allocation per-frame updates
  refs: Record<string, THREE.Object3D | THREE.Material | number | Float32Array | boolean | string>;
}

export interface GodPowerParticleCallbacks {
  spawnBurst: (
    x: number,
    y: number,
    z: number,
    count: number,
    color: string,
    spread: number,
    speed: number,
    scale?: number,
  ) => void;
  spawnRising: (
    x: number,
    y: number,
    z: number,
    count: number,
    color: string,
    radius: number,
    riseSpeed: number,
    life?: number,
    scale?: number,
  ) => void;
  getGroundY: (x: number, z: number) => number;
  spawnImpactFlash?: (x: number, y: number, z: number, color: string, intensity: number, shake?: number) => void;
}

// Module-level scratch math objects — ZERO per-frame heap allocations!
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _pos2 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

function applyUniformColor(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const count = g.attributes.position.count;
  const arr = new Float32Array(count * 3);
  _color.setHex(hex);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = _color.r;
    arr[i * 3 + 1] = _color.g;
    arr[i * 3 + 2] = _color.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  // Strip uv if inconsistent across primitives before merging
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}

function makeColoredBox(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  hex: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  const b = new THREE.BoxGeometry(w, h, d);
  if (rx !== 0) b.rotateX(rx);
  if (ry !== 0) b.rotateY(ry);
  if (rz !== 0) b.rotateZ(rz);
  b.translate(x, y, z);
  return applyUniformColor(b, hex);
}

export interface SharedGodPowerGeos {
  locustGeo: THREE.BufferGeometry;
  rockChunkGeo: THREE.BufferGeometry;
  rainDropGeo: THREE.BufferGeometry;
  iceShardGeo: THREE.BufferGeometry;
  lightPillarGeo: THREE.BufferGeometry;
  motePillarGeo: THREE.BufferGeometry;
  petalShardGeo: THREE.BufferGeometry;
  eyeScleraGeo: THREE.BufferGeometry;
  eyeCrownGeo: THREE.BufferGeometry;
  eyeLidGeo: THREE.BufferGeometry;
  eyeShardGeo: THREE.BufferGeometry;
  cloudDeckGeo: THREE.BufferGeometry;
  crackStarGeo: THREE.BufferGeometry;
  fissureTrenchGeo: THREE.BufferGeometry;
  clockHandsGeo: THREE.BufferGeometry;
  domeShellGeo: THREE.BufferGeometry;
  torusRingGeo: THREE.BufferGeometry;
  discGeo: THREE.BufferGeometry;
  puddleGeo: THREE.BufferGeometry;
  beamCylGeo: THREE.BufferGeometry;
  flareSphereGeo: THREE.BufferGeometry;
  sunCoreGeo: THREE.BufferGeometry;
  sunCoronaGeo: THREE.BufferGeometry;
  solarLensGeo: THREE.BufferGeometry;
  solarProjGeo: THREE.BufferGeometry;
  dispose: () => void;
}

/**
 * Creates the shared low-poly voxel geometry pool once per canvas mount.
 * Disposed cleanly when IsometricWorldCanvas unmounts.
 */
export function createSharedGodPowerGeos(): SharedGodPowerGeos {
  // 1. True Blocky Voxel Locust Silhouette (segmented abdomen, thorax, head, glowing amber eyes, hind legs, wide swept V-wings)
  const locustParts: THREE.BufferGeometry[] = [
    // Segmented tapered abdomen (extending -Z)
    makeColoredBox(0.14, 0.12, 0.34, 0, 0.0, -0.22, 0x5c4018),
    makeColoredBox(0.11, 0.09, 0.22, 0, -0.02, -0.44, 0x714e1a),
    // Thorax carapace
    makeColoredBox(0.18, 0.16, 0.22, 0, 0.03, 0.04, 0x3f2e12),
    // Head + compound eyes (+Z forward)
    makeColoredBox(0.15, 0.15, 0.15, 0, 0.02, 0.2, 0x4d3816),
    makeColoredBox(0.05, 0.06, 0.06, 0.08, 0.05, 0.23, 0xf59e0b),
    makeColoredBox(0.05, 0.06, 0.06, -0.08, 0.05, 0.23, 0xf59e0b),
    // Bent jumping hind legs
    makeColoredBox(0.04, 0.18, 0.05, 0.11, -0.06, -0.08, 0x3b2a10, 0.45, 0, -0.2),
    makeColoredBox(0.04, 0.18, 0.05, -0.11, -0.06, -0.08, 0x3b2a10, 0.45, 0, 0.2),
    // Wide swept V-wings (bright parchment/amber chitin so silhouettes pop clearly against dark terrain)
    makeColoredBox(0.56, 0.03, 0.2, 0.3, 0.13, -0.04, 0xe7d28a, 0.08, -0.25, 0.34),
    makeColoredBox(0.56, 0.03, 0.2, -0.3, 0.13, -0.04, 0xe7d28a, 0.08, 0.25, -0.34),
    // Secondary narrower lower hind wings
    makeColoredBox(0.42, 0.025, 0.14, 0.24, 0.09, -0.18, 0xcab060, 0.05, -0.42, 0.16),
    makeColoredBox(0.42, 0.025, 0.14, -0.24, 0.09, -0.18, 0xcab060, 0.05, 0.42, -0.16),
  ];
  const locustGeo = mergeGeometries(locustParts, false)!;
  locustParts.forEach((g) => g.dispose());
  locustGeo.computeBoundingSphere();

  // 2. Sculpted Multi-Puff Blocky Storm Cloud Deck (unit radius ~1.0, scaled per hazard)
  const cloudParts: THREE.BufferGeometry[] = [
    makeColoredBox(1.15, 0.46, 1.05, 0, 0.26, 0, 0xffffff),
    makeColoredBox(0.86, 0.36, 0.86, 0.56, 0.08, 0.28, 0xd8dee9),
    makeColoredBox(0.82, 0.34, 0.84, -0.58, 0.1, -0.22, 0xd8dee9),
    makeColoredBox(0.76, 0.32, 0.78, -0.28, 0.06, 0.54, 0xcbd5e1),
    makeColoredBox(0.78, 0.34, 0.74, 0.34, 0.12, -0.52, 0xe2e8f0),
    makeColoredBox(0.66, 0.28, 0.66, 0.05, 0.52, -0.05, 0xffffff),
  ];
  const cloudDeckGeo = mergeGeometries(cloudParts, false)!;
  cloudParts.forEach((g) => g.dispose());

  // 3. 8-Arm Jagged Radial Ground Fracture Star (Sinkhole cracks)
  const crackParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + (i % 2) * 0.12;
    const len = 0.85 + (i % 3) * 0.22;
    // Inner crack segment
    const seg1 = makeColoredBox(0.11, 0.05, len * 0.55, 0, 0.03, len * 0.35, 0x0f172a);
    seg1.rotateY(ang);
    crackParts.push(seg1);
    // Jagged outer branch
    const seg2 = makeColoredBox(0.075, 0.04, len * 0.52, 0.06 * (i % 2 === 0 ? 1 : -1), 0.025, len * 0.82, 0x334155);
    seg2.rotateY(ang + (i % 2 === 0 ? 0.16 : -0.16));
    crackParts.push(seg2);
  }
  const crackStarGeo = mergeGeometries(crackParts, false)!;
  crackParts.forEach((g) => g.dispose());

  // 4. Merged Molten Lava Fissure Trench (extends along X from -1 to +1, scaled by currentRadius)
  const fissureParts: THREE.BufferGeometry[] = [
    // Glowing molten magma center vein
    makeColoredBox(2.0, 0.14, 0.42, 0, 0.08, 0, 0xfff066),
    makeColoredBox(1.85, 0.11, 0.68, 0.04, 0.05, 0.05, 0xff5400),
    // Jagged scorched basalt rim ridges flanking both banks
    makeColoredBox(0.75, 0.26, 0.28, -0.45, 0.13, 0.46, 0x292524, 0, 0.12, 0),
    makeColoredBox(0.72, 0.28, 0.28, 0.38, 0.14, 0.48, 0x1c1917, 0, -0.14, 0),
    makeColoredBox(0.74, 0.26, 0.28, -0.32, 0.13, -0.48, 0x1c1917, 0, -0.1, 0),
    makeColoredBox(0.76, 0.28, 0.28, 0.44, 0.14, -0.44, 0x292524, 0, 0.13, 0),
  ];
  const fissureTrenchGeo = mergeGeometries(fissureParts, false)!;
  fissureParts.forEach((g) => g.dispose());

  // 5. Giant Hovering Eye Ornate Crown & Spiked Obsidian-Gold Frame (faces +Z, surrounds eyeball radius ~1.35)
  const eyeCrownParts: THREE.BufferGeometry[] = [];
  // 12 radial gilded corona spikes + obsidian collar ring segments
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const isMajor = i % 3 === 0;
    const rad = isMajor ? 2.15 : 1.88;
    const spH = isMajor ? 0.92 : 0.56;
    const spW = isMajor ? 0.26 : 0.18;
    const spike = makeColoredBox(spW, spH, 0.22, 0, rad, -0.12, isMajor ? 0xfbbf24 : 0xd97706);
    spike.rotateZ(a);
    eyeCrownParts.push(spike);

    // Dark obsidian inner bezel block
    const bezel = makeColoredBox(0.55, 0.26, 0.48, 0, 1.56, -0.05, 0x1e1b2e);
    bezel.rotateZ(a);
    eyeCrownParts.push(bezel);
  }
  // Ornate top crest diamond & bottom pendulum barb
  eyeCrownParts.push(
    makeColoredBox(0.45, 0.65, 0.32, 0, 2.55, 0.05, 0xfef08a, 0, 0, Math.PI * 0.25),
    makeColoredBox(0.35, 0.55, 0.28, 0, -2.45, 0.05, 0xf59e0b, 0, 0, Math.PI * 0.25),
  );
  const eyeCrownGeo = mergeGeometries(eyeCrownParts, false)!;
  eyeCrownParts.forEach((g) => g.dispose());

  // 6. Articulated Eyelid Shutter (curved half-shell cap pivoting around X)
  const eyeLidGeo = new THREE.SphereGeometry(1.48, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.48);

  // 7. Giant Celestial Clockwork Astrolabe Dial & Hands (Time Bubble)
  const clockParts: THREE.BufferGeometry[] = [
    // Hour hand (thick gold)
    makeColoredBox(0.11, 0.05, 0.55, 0, 0.04, 0.27, 0xfef08a),
    // Minute hand (longer cyan-gold)
    makeColoredBox(0.075, 0.06, 0.88, 0, 0.06, 0.42, 0x7dd3fc),
    // Center spindle
    makeColoredBox(0.16, 0.14, 0.16, 0, 0.06, 0, 0xfacc15),
  ];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const isCardinal = i % 3 === 0;
    const tick = makeColoredBox(
      isCardinal ? 0.09 : 0.05,
      0.05,
      isCardinal ? 0.22 : 0.13,
      Math.sin(a) * 0.9,
      0.04,
      Math.cos(a) * 0.9,
      isCardinal ? 0xfacc15 : 0x38bdf8,
      0,
      a,
      0,
    );
    clockParts.push(tick);
  }
  const clockHandsGeo = mergeGeometries(clockParts, false)!;
  clockParts.forEach((g) => g.dispose());

  // Primitive shared geometries
  const rockChunkGeo = new THREE.DodecahedronGeometry(0.32, 0);
  const rainDropGeo = new THREE.BoxGeometry(0.08, 0.95, 0.08);
  const iceShardGeo = new THREE.OctahedronGeometry(0.24, 0);
  const lightPillarGeo = new THREE.CylinderGeometry(1, 1, 1, 22, 1, true);
  const motePillarGeo = new THREE.BoxGeometry(0.14, 1.35, 0.14);
  const petalShardGeo = new THREE.BoxGeometry(0.26, 0.08, 0.34);
  const eyeScleraGeo = new THREE.IcosahedronGeometry(1.32, 2);
  const eyeShardGeo = new THREE.OctahedronGeometry(0.24, 0);
  eyeShardGeo.scale(0.65, 1.85, 0.65);
  const domeShellGeo = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const torusRingGeo = new THREE.TorusGeometry(1, 0.06, 6, 28);
  const discGeo = new THREE.CircleGeometry(1, 24);
  discGeo.rotateX(-Math.PI / 2);
  const puddleGeo = new THREE.CircleGeometry(0.55, 8);
  puddleGeo.rotateX(-Math.PI / 2);
  const beamCylGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  const flareSphereGeo = new THREE.IcosahedronGeometry(1, 1);

  // 8. Sculpted Multi-Layered Voxel Sun Core (white-hot heart, golden photosphere cubes, orange-crimson solar convection plates)
  const sunCoreParts: THREE.BufferGeometry[] = [
    // Inner incandescent cube + chamfered axial layers forming a chunky stylized voxel star
    makeColoredBox(3.1, 3.1, 3.1, 0, 0, 0, 0xfff7cc),
    makeColoredBox(3.75, 2.55, 2.55, 0, 0, 0, 0xfde047),
    makeColoredBox(2.55, 3.75, 2.55, 0, 0, 0, 0xfde047),
    makeColoredBox(2.55, 2.55, 3.75, 0, 0, 0, 0xfde047),
    // Equatorial & polar fiery orange convection plates
    makeColoredBox(4.15, 1.45, 1.45, 0, 0, 0, 0xfb923c),
    makeColoredBox(1.45, 4.15, 1.45, 0, 0, 0, 0xfb923c),
    makeColoredBox(1.45, 1.45, 4.15, 0, 0, 0, 0xfb923c),
    // Diagonal hot plasma knots & sunspot ridges
    makeColoredBox(2.9, 2.9, 2.9, 0, 0, 0, 0xf97316, Math.PI * 0.25, Math.PI * 0.25, 0),
    makeColoredBox(2.9, 2.9, 2.9, 0, 0, 0, 0xfacc15, 0, Math.PI * 0.25, Math.PI * 0.25),
    makeColoredBox(2.9, 2.9, 2.9, 0, 0, 0, 0xef4444, Math.PI * 0.25, 0, Math.PI * 0.25),
  ];
  const sunCoreGeo = mergeGeometries(sunCoreParts, false)!;
  sunCoreParts.forEach((g) => g.dispose());

  // 9. 18 Jagged 3D Volumetric Solar Corona Spikes & Prominence Flares erupting around the Sun
  const sunCoronaParts: THREE.BufferGeometry[] = [];
  const coronaDirs: Array<[number, number, number, boolean]> = [
    [1, 0, 0, true], [-1, 0, 0, true], [0, 1, 0, true], [0, -1, 0, true], [0, 0, 1, true], [0, 0, -1, true],
    [0.7, 0.7, 0, false], [-0.7, 0.7, 0, false], [0.7, -0.7, 0, false], [-0.7, -0.7, 0, false],
    [0, 0.7, 0.7, false], [0, 0.7, -0.7, false], [0, -0.7, 0.7, false], [0, -0.7, -0.7, false],
    [0.7, 0, 0.7, false], [-0.7, 0, 0.7, false], [0.7, 0, -0.7, false], [-0.7, 0, -0.7, false],
  ];
  for (let i = 0; i < coronaDirs.length; i++) {
    const [dx, dy, dz, isMajor] = coronaDirs[i];
    const len = isMajor ? 2.15 : 1.55;
    const thick = isMajor ? 0.56 : 0.4;
    const dist = 2.45 + len * 0.35;
    const spike = new THREE.BoxGeometry(thick, len, thick);
    _dir.set(dx, dy, dz).normalize();
    _quat.setFromUnitVectors(_up, _dir);
    _mat4.compose(_pos.copy(_dir).multiplyScalar(dist), _quat, _scale.set(1, 1, 1));
    spike.applyMatrix4(_mat4);
    sunCoronaParts.push(applyUniformColor(spike, isMajor ? 0xff7b00 : 0xfacc15));
  }
  const sunCoronaGeo = mergeGeometries(sunCoronaParts, false)!;
  sunCoronaParts.forEach((g) => g.dispose());

  // 10. Focusing Plasma Aperture Cone (channels energy out of the bottom of the Sun into the Solar Beam)
  const solarLensGeo = new THREE.CylinderGeometry(2.15, 0.55, 2.8, 12, 1, true);

  // 11. Blocky Voxel Solar Magma Projectile Meteor (bright yellow-white core + jagged orange crust)
  const solarProjParts: THREE.BufferGeometry[] = [
    makeColoredBox(0.88, 0.88, 0.88, 0, 0, 0, 0xfff3a3),
    makeColoredBox(1.12, 0.58, 0.58, 0, 0, 0, 0xff6b00),
    makeColoredBox(0.58, 1.12, 0.58, 0, 0, 0, 0xf97316),
    makeColoredBox(0.58, 0.58, 1.12, 0, 0, 0, 0xef4444),
  ];
  const solarProjGeo = mergeGeometries(solarProjParts, false)!;
  solarProjParts.forEach((g) => g.dispose());

  const allGeos = [
    locustGeo,
    rockChunkGeo,
    rainDropGeo,
    iceShardGeo,
    lightPillarGeo,
    motePillarGeo,
    petalShardGeo,
    eyeScleraGeo,
    eyeCrownGeo,
    eyeLidGeo,
    eyeShardGeo,
    cloudDeckGeo,
    crackStarGeo,
    fissureTrenchGeo,
    clockHandsGeo,
    domeShellGeo,
    torusRingGeo,
    discGeo,
    puddleGeo,
    beamCylGeo,
    flareSphereGeo,
    sunCoreGeo,
    sunCoronaGeo,
    solarLensGeo,
    solarProjGeo,
  ];

  return {
    locustGeo,
    rockChunkGeo,
    rainDropGeo,
    iceShardGeo,
    lightPillarGeo,
    motePillarGeo,
    petalShardGeo,
    eyeScleraGeo,
    eyeCrownGeo,
    eyeLidGeo,
    eyeShardGeo,
    cloudDeckGeo,
    crackStarGeo,
    fissureTrenchGeo,
    clockHandsGeo,
    domeShellGeo,
    torusRingGeo,
    discGeo,
    puddleGeo,
    beamCylGeo,
    flareSphereGeo,
    sunCoreGeo,
    sunCoronaGeo,
    solarLensGeo,
    solarProjGeo,
    dispose: () => {
      for (const g of allGeos) g.dispose();
    },
  };
}

export function disposeEnhancedHazardVfx(vfx: EnhancedHazardVfxState): void {
  for (const inst of vfx.instancedMeshes) inst.dispose();
  for (const g of vfx.geometries) g.dispose();
  for (const m of vfx.materials) m.dispose();
}

export function createEnhancedHazardVfx(
  kind: EnhancedHazardKind,
  radius: number,
  geos: SharedGodPowerGeos,
  sharedMagicCircleGeo: THREE.BufferGeometry,
  createMagicCircleMat: (key: string, opacity?: number, seed?: number) => THREE.Material,
): EnhancedHazardVfxState {
  const group = new THREE.Group();
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const instancedMeshes: THREE.InstancedMesh[] = [];
  const refs: EnhancedHazardVfxState['refs'] = {};

  // -------------------------------------------------------------------------
  // 1. LOCUST SWARM — 76 articulated blocky voxel flying locusts in 1 InstancedMesh!
  // -------------------------------------------------------------------------
  if (kind === 'locust_swarm') {
    const COUNT = 76;
    const locustMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
    });
    const hazeMat = new THREE.MeshBasicMaterial({
      color: 0x3b2c10,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });
    const chaffRingMat = createMagicCircleMat('locust_swarm', 0.52, 41);
    materials.push(locustMat, hazeMat, chaffRingMat);

    const inst = new THREE.InstancedMesh(geos.locustGeo, locustMat, COUNT);
    inst.frustumCulled = false;
    const seeds = new Float32Array(COUNT * 5); // [phase, orbitR, altLayer, speed, diveFreq]
    const palette = [0xd4a359, 0xb88b3a, 0x9c7430, 0xe2bc6b, 0x856328];
    for (let i = 0; i < COUNT; i++) {
      const s = i * 5;
      seeds[s] = ((i * 2.39996) % (Math.PI * 2));
      seeds[s + 1] = 0.16 + Math.sqrt((i + 0.5) / COUNT) * 0.96;
      seeds[s + 2] = 0.65 + (i % 7) * 0.42;
      seeds[s + 3] = 2.1 + (i % 5) * 0.48;
      seeds[s + 4] = 1.6 + (i % 4) * 0.72;
      _color.setHex(palette[i % palette.length]);
      inst.setColorAt(i, _color);
    }
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
    instancedMeshes.push(inst);

    // Subtle darkening swarm haze canopy overhead
    const hazeCanopy = new THREE.Mesh(geos.cloudDeckGeo, hazeMat);
    hazeCanopy.position.y = 2.35;
    hazeCanopy.scale.set(radius * 0.85, 0.95, radius * 0.85);
    group.add(hazeCanopy);

    // Swirling chaff/dust ground ring
    const groundRing = new THREE.Mesh(sharedMagicCircleGeo, chaffRingMat);
    groundRing.position.y = 0.16;
    groundRing.scale.setScalar(radius * 0.92);
    group.add(groundRing);

    refs.inst = inst;
    refs.seeds = seeds;
    refs.hazeCanopy = hazeCanopy;
    refs.groundRing = groundRing;
    refs.hazeMat = hazeMat;
    refs.chaffRingMat = chaffRingMat;
    return { kind, group, materials, geometries, instancedMeshes, particleTimer: 0, refs };
  }

  // -------------------------------------------------------------------------
  // 2. EYE OF JUDGMENT (`sentinel_eye`) — Colossal Hovering Laser-Firing Eye!
  // -------------------------------------------------------------------------
  if (kind === 'sentinel_eye') {
    const eyeAssembly = new THREE.Group();
    eyeAssembly.position.y = 5.2;
    group.add(eyeAssembly);

    // Outer ornate gilded-obsidian spiky crown & frame
    const crownMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.35,
      flatShading: true,
    });
    const crownMesh = new THREE.Mesh(geos.eyeCrownGeo, crownMat);
    eyeAssembly.add(crownMesh);

    // Swiveling eyeball pivot (rotates to lock onto laser target!)
    const eyePivot = new THREE.Group();
    eyeAssembly.add(eyePivot);

    const scleraMat = new THREE.MeshLambertMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.28,
      flatShading: true,
    });
    const scleraMesh = new THREE.Mesh(geos.eyeScleraGeo, scleraMat);
    eyePivot.add(scleraMesh);

    // Blazing molten fiery iris ring + inner crimson iris + glowing vertical slit pupil on +Z face
    const irisOuterMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      side: THREE.DoubleSide,
    });
    const irisInnerMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
    });
    const pupilMat = new THREE.MeshBasicMaterial({
      color: 0x180404,
      side: THREE.DoubleSide,
    });
    const glintMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });

    const irisOuter = new THREE.Mesh(geos.discGeo, irisOuterMat);
    irisOuter.rotation.x = Math.PI / 2;
    irisOuter.position.set(0, 0, 1.3);
    irisOuter.scale.setScalar(0.76);
    eyePivot.add(irisOuter);

    const irisInner = new THREE.Mesh(geos.discGeo, irisInnerMat);
    irisInner.rotation.x = Math.PI / 2;
    irisInner.position.set(0, 0, 1.33);
    irisInner.scale.setScalar(0.54);
    eyePivot.add(irisInner);

    const pupilSlit = new THREE.Mesh(geos.discGeo, pupilMat);
    pupilSlit.rotation.x = Math.PI / 2;
    pupilSlit.position.set(0, 0, 1.36);
    pupilSlit.scale.set(0.16, 1, 0.48);
    eyePivot.add(pupilSlit);

    const pupilCore = new THREE.Mesh(geos.discGeo, glintMat);
    pupilCore.rotation.x = Math.PI / 2;
    pupilCore.position.set(0, 0, 1.38);
    pupilCore.scale.set(0.08, 1, 0.28);
    eyePivot.add(pupilCore);

    // Articulated upper & lower obsidian-gold eyelids (pry open on summon, squint when firing!)
    const lidMat = new THREE.MeshLambertMaterial({
      color: 0x1e1b2e,
      emissive: 0x92400e,
      emissiveIntensity: 0.32,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    const upperLid = new THREE.Mesh(geos.eyeLidGeo, lidMat);
    eyePivot.add(upperLid);
    const lowerLid = new THREE.Mesh(geos.eyeLidGeo, lidMat);
    lowerLid.rotation.z = Math.PI;
    eyePivot.add(lowerLid);

    // Two counter-rotating ornate golden arcane halo rings around the eye
    const haloMat1 = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
    });
    const haloMat2 = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const halo1 = new THREE.Mesh(geos.torusRingGeo, haloMat1);
    halo1.scale.setScalar(2.45);
    eyeAssembly.add(halo1);
    const halo2 = new THREE.Mesh(geos.torusRingGeo, haloMat2);
    halo2.scale.setScalar(3.05);
    halo2.rotation.x = Math.PI * 0.38;
    eyeAssembly.add(halo2);

    // 14 orbiting floating obsidian-gold rune obelisk shards (1 InstancedMesh!)
    const SHARD_COUNT = 14;
    const shardMat = new THREE.MeshLambertMaterial({
      color: 0xf59e0b,
      emissive: 0xef4444,
      emissiveIntensity: 0.65,
      flatShading: true,
    });
    const shardInst = new THREE.InstancedMesh(geos.eyeShardGeo, shardMat, SHARD_COUNT);
    shardInst.frustumCulled = false;
    eyeAssembly.add(shardInst);
    instancedMeshes.push(shardInst);

    // Ground arcane targeting sigil beneath the hovering Eye
    const sigilMat = createMagicCircleMat('solar_orbital_laser', 0.78, 17);
    const groundSigil = new THREE.Mesh(sharedMagicCircleGeo, sigilMat);
    groundSigil.position.y = 0.16;
    groundSigil.scale.setScalar(Math.min(5.2, radius * 0.45));
    group.add(groundSigil);

    // Live Sweeping 3D Laser Beam (dual-layer core + plasma sheath + muzzle orb + impact scorch flare)
    const beamGroup = new THREE.Group();
    beamGroup.visible = false;
    group.add(beamGroup);

    const beamCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const beamOuterMat = new THREE.MeshBasicMaterial({
      color: 0xff3b00,
      transparent: true,
      opacity: 0.68,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const beamCore = new THREE.Mesh(geos.beamCylGeo, beamCoreMat);
    const beamOuter = new THREE.Mesh(geos.beamCylGeo, beamOuterMat);
    beamGroup.add(beamCore, beamOuter);

    const muzzleOrb = new THREE.Mesh(geos.flareSphereGeo, beamCoreMat);
    muzzleOrb.scale.setScalar(0.55);
    const impactOrb = new THREE.Mesh(geos.flareSphereGeo, beamOuterMat);
    impactOrb.scale.setScalar(0.95);
    const impactRing = new THREE.Mesh(geos.discGeo, beamOuterMat);
    impactRing.scale.setScalar(1.65);
    group.add(muzzleOrb, impactOrb, impactRing);
    muzzleOrb.visible = false;
    impactOrb.visible = false;
    impactRing.visible = false;

    materials.push(
      crownMat,
      scleraMat,
      irisOuterMat,
      irisInnerMat,
      pupilMat,
      glintMat,
      lidMat,
      haloMat1,
      haloMat2,
      shardMat,
      sigilMat,
      beamCoreMat,
      beamOuterMat,
    );

    refs.eyeAssembly = eyeAssembly;
    refs.crownMesh = crownMesh;
    refs.eyePivot = eyePivot;
    refs.upperLid = upperLid;
    refs.lowerLid = lowerLid;
    refs.pupilCore = pupilCore;
    refs.halo1 = halo1;
    refs.halo2 = halo2;
    refs.shardInst = shardInst;
    refs.groundSigil = groundSigil;
    refs.beamGroup = beamGroup;
    refs.beamCore = beamCore;
    refs.beamOuter = beamOuter;
    refs.muzzleOrb = muzzleOrb;
    refs.impactOrb = impactOrb;
    refs.impactRing = impactRing;
    refs.beamCoreMat = beamCoreMat;
    refs.beamOuterMat = beamOuterMat;
    refs.shardCount = SHARD_COUNT;

    return { kind, group, materials, geometries, instancedMeshes, particleTimer: 0, refs };
  }

  // -------------------------------------------------------------------------
  // 3. PURIFY SKY BEAM (`purify_wave`) — 3-Phase Descent → Expanding Beam → Sky Ascension!
  // -------------------------------------------------------------------------
  if (kind === 'purify_wave') {
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const curtainMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.46,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const goldSheathMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const skyPortalMat = createMagicCircleMat('blessing', 0.92, 9);
    const groundWaveMat = createMagicCircleMat('cleanse_land', 0.94, 21);
    const innerGroundMat = createMagicCircleMat('blessing', 0.84, 53);
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const moteMat = new THREE.MeshBasicMaterial({
      color: 0xfef9c3,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    materials.push(
      coreMat,
      curtainMat,
      goldSheathMat,
      skyPortalMat,
      groundWaveMat,
      innerGroundMat,
      domeMat,
      moteMat,
    );

    const beamCore = new THREE.Mesh(geos.lightPillarGeo, coreMat);
    const beamCurtain = new THREE.Mesh(geos.lightPillarGeo, curtainMat);
    const beamGold = new THREE.Mesh(geos.lightPillarGeo, goldSheathMat);
    group.add(beamCore, beamCurtain, beamGold);

    const skyPortal = new THREE.Mesh(sharedMagicCircleGeo, skyPortalMat);
    skyPortal.position.y = 26.0;
    group.add(skyPortal);

    const groundWave = new THREE.Mesh(sharedMagicCircleGeo, groundWaveMat);
    groundWave.position.y = 0.2;
    group.add(groundWave);

    const innerGround = new THREE.Mesh(sharedMagicCircleGeo, innerGroundMat);
    innerGround.position.y = 0.32;
    group.add(innerGround);

    const purifyDome = new THREE.Mesh(geos.domeShellGeo, domeMat);
    purifyDome.position.y = 0.1;
    group.add(purifyDome);

    // 40 Ascending Sacred Light Pillars in 1 InstancedMesh!
    const MOTE_COUNT = 40;
    const moteInst = new THREE.InstancedMesh(geos.motePillarGeo, moteMat, MOTE_COUNT);
    moteInst.frustumCulled = false;
    const seeds = new Float32Array(MOTE_COUNT * 3); // [angle, radiusFrac, phase]
    for (let i = 0; i < MOTE_COUNT; i++) {
      seeds[i * 3] = (i / MOTE_COUNT) * Math.PI * 2 + (i % 3) * 0.25;
      seeds[i * 3 + 1] = 0.22 + ((i * 7) % 10) / 11;
      seeds[i * 3 + 2] = (i * 0.37) % 1;
      _color.setHex(i % 2 === 0 ? 0xfef08a : 0x7dd3fc);
      moteInst.setColorAt(i, _color);
    }
    if (moteInst.instanceColor) moteInst.instanceColor.needsUpdate = true;
    group.add(moteInst);
    instancedMeshes.push(moteInst);

    refs.beamCore = beamCore;
    refs.beamCurtain = beamCurtain;
    refs.beamGold = beamGold;
    refs.skyPortal = skyPortal;
    refs.groundWave = groundWave;
    refs.innerGround = innerGround;
    refs.purifyDome = purifyDome;
    refs.moteInst = moteInst;
    refs.seeds = seeds;
    refs.coreMat = coreMat;
    refs.curtainMat = curtainMat;
    refs.goldSheathMat = goldSheathMat;
    refs.domeMat = domeMat;
    refs.moteMat = moteMat;
    refs.moteCount = MOTE_COUNT;

    return { kind, group, materials, geometries, instancedMeshes, particleTimer: 0, refs };
  }

  // -------------------------------------------------------------------------
  // 4. SINKHOLE COLLAPSE (`sinkhole_collapse`) — Fracturing Abyss + Vortex + 44 Falling Rocks!
  // -------------------------------------------------------------------------
  if (kind === 'sinkhole_collapse') {
    const abyssMat = new THREE.MeshBasicMaterial({
      color: 0x050811,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const vortexMat1 = createMagicCircleMat('sinkhole', 0.85, 11);
    const vortexMat2 = new THREE.MeshBasicMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const crackMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
    });
    const rockMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      flatShading: true,
    });
    const funnelMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    materials.push(abyssMat, vortexMat1, vortexMat2, crackMat, rockMat, funnelMat);

    const abyssDisc = new THREE.Mesh(geos.discGeo, abyssMat);
    abyssDisc.position.y = 0.13;
    group.add(abyssDisc);

    // Downward recessed dark vortex cone
    const funnelGeo = new THREE.CylinderGeometry(1.0, 0.22, 1.8, 18, 1, true);
    geometries.push(funnelGeo);
    const funnelMesh = new THREE.Mesh(funnelGeo, funnelMat);
    funnelMesh.position.y = -0.65;
    group.add(funnelMesh);

    const outerVortex = new THREE.Mesh(sharedMagicCircleGeo, vortexMat1);
    outerVortex.position.y = 0.19;
    group.add(outerVortex);

    const innerRim = new THREE.Mesh(geos.torusRingGeo, vortexMat2);
    innerRim.rotation.x = Math.PI / 2;
    innerRim.position.y = 0.18;
    group.add(innerRim);

    const crackMesh = new THREE.Mesh(geos.crackStarGeo, crackMat);
    crackMesh.position.y = 0.14;
    group.add(crackMesh);

    // 44 Crumbling Voxel Earth & Rock Chunks tumbling into the abyss (1 InstancedMesh!)
    const ROCK_COUNT = 44;
    const rockInst = new THREE.InstancedMesh(geos.rockChunkGeo, rockMat, ROCK_COUNT);
    rockInst.frustumCulled = false;
    const seeds = new Float32Array(ROCK_COUNT * 4); // [angle, cycleOffset, sizeScale, spinSpeed]
    const rockPalette = [0x475569, 0x64748b, 0x57534e, 0x78716c, 0x334155, 0x7c5b3e];
    for (let i = 0; i < ROCK_COUNT; i++) {
      seeds[i * 4] = (i / ROCK_COUNT) * Math.PI * 2 + (i % 5) * 0.19;
      seeds[i * 4 + 1] = (i * 0.23) % 1;
      seeds[i * 4 + 2] = 0.65 + (i % 4) * 0.34;
      seeds[i * 4 + 3] = 2.5 + (i % 5) * 1.1;
      _color.setHex(rockPalette[i % rockPalette.length]);
      rockInst.setColorAt(i, _color);
    }
    if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
    group.add(rockInst);
    instancedMeshes.push(rockInst);

    refs.abyssDisc = abyssDisc;
    refs.funnelMesh = funnelMesh;
    refs.outerVortex = outerVortex;
    refs.innerRim = innerRim;
    refs.crackMesh = crackMesh;
    refs.rockInst = rockInst;
    refs.seeds = seeds;
    refs.abyssMat = abyssMat;
    refs.funnelMat = funnelMat;
    refs.rockCount = ROCK_COUNT;

    return { kind, group, materials, geometries, instancedMeshes, particleTimer: 0, refs };
  }

  // -------------------------------------------------------------------------
  // 5. ACID CLOUD (`acid_cloud`) — Merged Toxic Storm Deck + 52 Acid Rain Streaks + 18 Bubbling Puddles!
  // -------------------------------------------------------------------------
  if (kind === 'acid_cloud') {
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0x365314,
      emissive: 0x84cc16,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.92,
      flatShading: true,
    });
    const dropMat = new THREE.MeshBasicMaterial({
      color: 0xbef264,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const puddleMat = new THREE.MeshBasicMaterial({
      color: 0x84cc16,
      transparent: true,
      opacity: 0.66,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ringMat = createMagicCircleMat('acid_rain', 0.68, 29);
    materials.push(cloudMat, dropMat, puddleMat, ringMat);

    const cloudDeck = new THREE.Mesh(geos.cloudDeckGeo, cloudMat);
    cloudDeck.position.y = 5.1;
    cloudDeck.scale.set(radius * 0.88, 1.35, radius * 0.88);
    group.add(cloudDeck);

    const groundRing = new THREE.Mesh(sharedMagicCircleGeo, ringMat);
    groundRing.position.y = 0.15;
    groundRing.scale.setScalar(radius * 0.95);
    group.add(groundRing);

    const DROP_COUNT = 52;
    const dropInst = new THREE.InstancedMesh(geos.rainDropGeo, dropMat, DROP_COUNT);
    dropInst.frustumCulled = false;
    const dropSeeds = new Float32Array(DROP_COUNT * 4); // [bx, bz, phase, speed]
    for (let i = 0; i < DROP_COUNT; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt((i + 0.5) / DROP_COUNT) * 0.92;
      dropSeeds[i * 4] = Math.cos(a) * r;
      dropSeeds[i * 4 + 1] = Math.sin(a) * r;
      dropSeeds[i * 4 + 2] = (i * 0.19) % 1;
      dropSeeds[i * 4 + 3] = 1.65 + (i % 4) * 0.32;
    }
    group.add(dropInst);
    instancedMeshes.push(dropInst);

    const PUDDLE_COUNT = 18;
    const puddleInst = new THREE.InstancedMesh(geos.puddleGeo, puddleMat, PUDDLE_COUNT);
    puddleInst.frustumCulled = false;
    const puddleSeeds = new Float32Array(PUDDLE_COUNT * 3); // [bx, bz, phase]
    for (let i = 0; i < PUDDLE_COUNT; i++) {
      const a = i * 2.39996 + 0.5;
      const r = Math.sqrt((i + 0.5) / PUDDLE_COUNT) * 0.85;
      puddleSeeds[i * 3] = Math.cos(a) * r;
      puddleSeeds[i * 3 + 1] = Math.sin(a) * r;
      puddleSeeds[i * 3 + 2] = (i * 0.31) % 1;
    }
    group.add(puddleInst);
    instancedMeshes.push(puddleInst);

    refs.cloudDeck = cloudDeck;
    refs.groundRing = groundRing;
    refs.dropInst = dropInst;
    refs.dropSeeds = dropSeeds;
    refs.dropCount = DROP_COUNT;
    refs.puddleInst = puddleInst;
    refs.puddleSeeds = puddleSeeds;
    refs.puddleCount = PUDDLE_COUNT;
    refs.cloudMat = cloudMat;
    refs.dropMat = dropMat;

    return { kind, group, materials, geometries, instancedMeshes, particleTimer: 0, refs };
  }

  // -------------------------------------------------------------------------
  // 6. BLIZZARD GALE (`blizzard_gale`) — Glacial Storm Canopy + Swirling Funnel + 64 Whipping Ice Shards!
  // -------------------------------------------------------------------------
  if (kind === 'blizzard_gale') {
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xdbeafe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.42,
      transparent: true,
      opacity: 0.9,
      flatShading: true,
    });
    const galeMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const shardMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const frostRingMat = createMagicCircleMat('freeze_snap', 0.78, 37);
    materials.push(cloudMat, galeMat, shardMat, frostRingMat);

    const cloudDeck = new THREE.Mesh(geos.cloudDeckGeo, cloudMat);
    cloudDeck.position.y = 5.0;
    cloudDeck.scale.set(radius * 0.9, 1.25, radius * 0.9);
    group.add(cloudDeck);

    const galeWall = new THREE.Mesh(geos.lightPillarGeo, galeMat);
    galeWall.position.y = 2.4;
    galeWall.scale.set(radius * 0.82, 4.6, radius * 0.82);
    group.add(galeWall);

    const groundRing = new THREE.Mesh(sharedMagicCircleGeo, frostRingMat);
    groundRing.position.y = 0.16;
    groundRing.scale.setScalar(radius * 0.96);
    group.add(groundRing);

    const SHARD_COUNT = 64;
    const shardInst = new THREE.InstancedMesh(geos.iceShardGeo, shardMat, SHARD_COUNT);
    shardInst.frustumCulled = false;
    const seeds = new Float32Array(SHARD_COUNT * 4); // [angle, radiusFrac, phase, speed]
    for (let i = 0; i < SHARD_COUNT; i++) {
      seeds[i * 4] = (i / SHARD_COUNT) * Math.PI * 2;
      seeds[i * 4 + 1] = 0.15 + Math.sqrt((i + 0.5) / SHARD_COUNT) * 0.92;
      seeds[i * 4 + 2] = (i * 0.17) % 1;
      seeds[i * 4 + 3] = 2.4 + (i % 5) * 0.55;
      _color.setHex(i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0xbae6fd : 0x7dd3fc);
      shardInst.setColorAt(i, _color);
    }
    if (shardInst.instanceColor) shardInst.instanceColor.needsUpdate = true;
    group.add(shardInst);
    instancedMeshes.push(shardInst);

    refs.cloudDeck = cloudDeck;
    refs.galeWall = galeWall;
    refs.groundRing = groundRing;
    refs.shardInst = shardInst;
    refs.seeds = seeds;
    refs.shardCount = SHARD_COUNT;
    refs.galeMat = galeMat;

    return { kind, group, materials, geometries, instancedMeshes, particleTimer: 0, refs };
  }

  // -------------------------------------------------------------------------
  // 7. LAVA FISSURE (`magma_geyser`) — Tectonic Molten Crack + Roaring Lava Column + 36 Erupting Bombs!
  // -------------------------------------------------------------------------
  if (kind === 'magma_geyser') {
    const trenchMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      emissive: 0xff4500,
      emissiveIntensity: 0.65,
      flatShading: true,
    });
    const outerJetMat = new THREE.MeshBasicMaterial({
      color: 0xff5400,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const coreJetMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const bombMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    const scorchRingMat = createMagicCircleMat('volcano_eruption', 0.8, 19);
    materials.push(trenchMat, outerJetMat, coreJetMat, bombMat, scorchRingMat);

    const fissureMesh = new THREE.Mesh(geos.fissureTrenchGeo, trenchMat);
    fissureMesh.position.y = 0.08;
    group.add(fissureMesh);

    const groundRing = new THREE.Mesh(sharedMagicCircleGeo, scorchRingMat);
    groundRing.position.y = 0.16;
    group.add(groundRing);

    const outerPillar = new THREE.Mesh(geos.lightPillarGeo, outerJetMat);
    outerPillar.position.y = 2.6;
    group.add(outerPillar);

    const corePillar = new THREE.Mesh(geos.lightPillarGeo, coreJetMat);
    corePillar.position.y = 2.4;
    group.add(corePillar);

    const BOMB_COUNT = 36;
    const bombInst = new THREE.InstancedMesh(geos.rockChunkGeo, bombMat, BOMB_COUNT);
    bombInst.frustumCulled = false;
    const seeds = new Float32Array(BOMB_COUNT * 4); // [alongFrac (-1..1), perpSign, phase, arcHeight]
    for (let i = 0; i < BOMB_COUNT; i++) {
      seeds[i * 4] = ((i / (BOMB_COUNT - 1)) * 2 - 1) * 0.92;
      seeds[i * 4 + 1] = (i % 2 === 0 ? 1 : -1) * (0.45 + (i % 4) * 0.35);
      seeds[i * 4 + 2] = (i * 0.29) % 1;
      seeds[i * 4 + 3] = 2.8 + (i % 5) * 1.15;
      _color.setHex(i % 3 === 0 ? 0xfef08a : i % 3 === 1 ? 0xff6b1a : 0xff2a00);
      bombInst.setColorAt(i, _color);
    }
    if (bombInst.instanceColor) bombInst.instanceColor.needsUpdate = true;
    group.add(bombInst);
    instancedMeshes.push(bombInst);

    refs.fissureMesh = fissureMesh;
    refs.groundRing = groundRing;
    refs.outerPillar = outerPillar;
    refs.corePillar = corePillar;
    refs.bombInst = bombInst;
    refs.seeds = seeds;
    refs.bombCount = BOMB_COUNT;

    return { kind, group, materials, geometries, instancedMeshes, particleTimer: 0, refs };
  }

  // -------------------------------------------------------------------------
  // 8. BIOME BLOOM WAVE (`biome_bloom_wave`) — 3D Luminous Expanding Wave Curtain + 44 Rising Theme Motes!
  // -------------------------------------------------------------------------
  if (kind === 'biome_bloom_wave') {
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0xf472b6,
      transparent: true,
      opacity: 0.44,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ringMat1 = createMagicCircleMat('floral_paradise', 0.88, 13);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.64,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const moteMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    materials.push(wallMat, ringMat1, ringMat2, moteMat);

    const waveWall = new THREE.Mesh(geos.lightPillarGeo, wallMat);
    waveWall.position.y = 1.65;
    group.add(waveWall);

    const outerRing = new THREE.Mesh(sharedMagicCircleGeo, ringMat1);
    outerRing.position.y = 0.2;
    group.add(outerRing);

    const innerRing = new THREE.Mesh(geos.torusRingGeo, ringMat2);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.35;
    group.add(innerRing);

    const MOTE_COUNT = 44;
    const moteInst = new THREE.InstancedMesh(geos.petalShardGeo, moteMat, MOTE_COUNT);
    moteInst.frustumCulled = false;
    const seeds = new Float32Array(MOTE_COUNT * 3); // [angle, phase, speed]
    for (let i = 0; i < MOTE_COUNT; i++) {
      seeds[i * 3] = (i / MOTE_COUNT) * Math.PI * 2;
      seeds[i * 3 + 1] = (i * 0.21) % 1;
      seeds[i * 3 + 2] = 0.8 + (i % 4) * 0.3;
    }
    group.add(moteInst);
    instancedMeshes.push(moteInst);

    refs.waveWall = waveWall;
    refs.outerRing = outerRing;
    refs.innerRing = innerRing;
    refs.moteInst = moteInst;
    refs.seeds = seeds;
    refs.moteCount = MOTE_COUNT;
    refs.wallMat = wallMat;
    refs.ringMat2 = ringMat2;
    refs.moteMat = moteMat;
    refs.lastBiomeKind = '';

    return { kind, group, materials, geometries, instancedMeshes, particleTimer: 0, refs };
  }

  // -------------------------------------------------------------------------
  // 9. TIME BUBBLE (`chrono_field`) — Celestial Clockwork Dome + Spinning Hands + 28 Time Crystals!
  // -------------------------------------------------------------------------
  if (kind === 'chrono_field') {
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const clockMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const cyanRingMat = createMagicCircleMat('chrono_surge', 0.9, 0);
    const goldRingMat = createMagicCircleMat('chrono_surge', 0.86, 2);
    const crystalMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    materials.push(domeMat, clockMat, cyanRingMat, goldRingMat, crystalMat);

    const domeMesh = new THREE.Mesh(geos.domeShellGeo, domeMat);
    domeMesh.position.y = 0.1;
    domeMesh.scale.set(radius * 0.92, radius * 0.62, radius * 0.92);
    group.add(domeMesh);

    const clockDial = new THREE.Mesh(geos.clockHandsGeo, clockMat);
    clockDial.position.y = 0.42;
    clockDial.scale.setScalar(radius * 0.72);
    group.add(clockDial);

    const outerRing = new THREE.Mesh(sharedMagicCircleGeo, cyanRingMat);
    outerRing.position.y = 0.15;
    outerRing.scale.setScalar(radius);
    group.add(outerRing);

    const innerRing = new THREE.Mesh(sharedMagicCircleGeo, goldRingMat);
    innerRing.position.y = 0.28;
    innerRing.scale.setScalar(radius * 0.68);
    group.add(innerRing);

    const CRYSTAL_COUNT = 28;
    const crystalInst = new THREE.InstancedMesh(geos.iceShardGeo, crystalMat, CRYSTAL_COUNT);
    crystalInst.frustumCulled = false;
    const seeds = new Float32Array(CRYSTAL_COUNT * 3); // [angle, radFrac, phase]
    for (let i = 0; i < CRYSTAL_COUNT; i++) {
      seeds[i * 3] = (i / CRYSTAL_COUNT) * Math.PI * 2;
      seeds[i * 3 + 1] = 0.35 + (i % 4) * 0.18;
      seeds[i * 3 + 2] = i / CRYSTAL_COUNT;
      _color.setHex(i % 2 === 0 ? 0xfacc15 : 0x38bdf8);
      crystalInst.setColorAt(i, _color);
    }
    if (crystalInst.instanceColor) crystalInst.instanceColor.needsUpdate = true;
    group.add(crystalInst);
    instancedMeshes.push(crystalInst);

    refs.domeMesh = domeMesh;
    refs.clockDial = clockDial;
    refs.outerRing = outerRing;
    refs.innerRing = innerRing;
    refs.crystalInst = crystalInst;
    refs.seeds = seeds;
    refs.crystalCount = CRYSTAL_COUNT;
    refs.domeMat = domeMat;

    return { kind, group, materials, geometries, instancedMeshes, particleTimer: 0, refs };
  }

  // -------------------------------------------------------------------------
  // 10. SOLAR BEAM (`orbital_beam`) — Blazing Voxel Sun + Multi-Layer Cascading Beam + Map-Wide Solar Projectiles!
  // -------------------------------------------------------------------------
  if (kind === 'orbital_beam') {
    const SUN_Y = 17.5;
    const sunAssembly = new THREE.Group();
    sunAssembly.position.y = SUN_Y;
    group.add(sunAssembly);

    // 1. Churning Voxel Sun Core
    const sunCoreMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      emissive: 0xffb703,
      emissiveIntensity: 0.92,
      flatShading: true,
    });
    const sunCoreMesh = new THREE.Mesh(geos.sunCoreGeo, sunCoreMat);
    sunAssembly.add(sunCoreMesh);

    // 2. Jagged 3D Solar Corona Prominences
    const sunCoronaMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.94,
    });
    const sunCoronaMesh = new THREE.Mesh(geos.sunCoronaGeo, sunCoronaMat);
    sunAssembly.add(sunCoronaMesh);

    // 3. Additive Golden Solar Halo Aura Sphere
    const sunAuraMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sunAuraSphere = new THREE.Mesh(geos.flareSphereGeo, sunAuraMat);
    sunAuraSphere.scale.setScalar(4.15);
    sunAssembly.add(sunAuraSphere);

    // 4 & 5. Counter-Rotating Tilted Solar Orbital Astrolabe Plasma Rings
    const sunRingMat1 = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sunRingMat2 = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sunRingOuter = new THREE.Mesh(geos.torusRingGeo, sunRingMat1);
    sunRingOuter.scale.setScalar(3.55);
    sunRingOuter.rotation.x = Math.PI * 0.36;
    sunAssembly.add(sunRingOuter);

    const sunRingInner = new THREE.Mesh(geos.torusRingGeo, sunRingMat2);
    sunRingInner.scale.setScalar(4.35);
    sunRingInner.rotation.x = -Math.PI * 0.42;
    sunRingInner.rotation.z = Math.PI * 0.22;
    sunAssembly.add(sunRingInner);

    // 6. Focusing Plasma Funnel Lens beneath the Sun channeling energy into the beam
    const lensMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const lensFunnelMesh = new THREE.Mesh(geos.solarLensGeo, lensMat);
    lensFunnelMesh.position.y = -2.45;
    sunAssembly.add(lensFunnelMesh);

    // 7, 8, 9. Triple-Layer High-Energy Solar Beam (White-Gold Core + Golden Plasma Sheath + Fiery Red-Orange Curtain)
    const beamCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const beamSheathMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const beamOuterMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const beamCore = new THREE.Mesh(geos.lightPillarGeo, beamCoreMat);
    const beamSheath = new THREE.Mesh(geos.lightPillarGeo, beamSheathMat);
    const beamOuter = new THREE.Mesh(geos.lightPillarGeo, beamOuterMat);
    group.add(beamCore, beamSheath, beamOuter);

    // 10. 16 Cascading Downward Solar Plasma Energy Rings surging from Sun to Ground (1 InstancedMesh!)
    const RING_COUNT = 16;
    const beamRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const beamRingsInst = new THREE.InstancedMesh(geos.torusRingGeo, beamRingMat, RING_COUNT);
    beamRingsInst.frustumCulled = false;
    for (let i = 0; i < RING_COUNT; i++) {
      _color.setHex(i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0xfde047 : 0xf97316);
      beamRingsInst.setColorAt(i, _color);
    }
    if (beamRingsInst.instanceColor) beamRingsInst.instanceColor.needsUpdate = true;
    group.add(beamRingsInst);
    instancedMeshes.push(beamRingsInst);

    // 11 & 12. Ground Solar Scorch Magic Circle & Molten Meltdown Flare
    const groundSigilMat = createMagicCircleMat('solar_orbital_laser', 0.94, 5);
    const groundSigil = new THREE.Mesh(sharedMagicCircleGeo, groundSigilMat);
    groundSigil.position.y = 0.16;
    groundSigil.scale.setScalar(Math.max(2.6, radius * 0.92));
    group.add(groundSigil);

    const impactFlareMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const impactFlare = new THREE.Mesh(geos.flareSphereGeo, impactFlareMat);
    impactFlare.position.y = 0.55;
    group.add(impactFlare);

    // 13 & 14. Map-Wide Flaming Solar Projectiles (1 InstancedMesh for cores + 1 InstancedMesh for comet trails!)
    const MAX_PROJ = 24;
    const TRAIL_SEGS = 4;
    const projCoreMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
    });
    const projCoreInst = new THREE.InstancedMesh(geos.solarProjGeo, projCoreMat, MAX_PROJ);
    projCoreInst.frustumCulled = false;
    projCoreInst.count = 0;
    group.add(projCoreInst);
    instancedMeshes.push(projCoreInst);

    const projTrailMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const projTrailInst = new THREE.InstancedMesh(geos.flareSphereGeo, projTrailMat, MAX_PROJ * TRAIL_SEGS);
    projTrailInst.frustumCulled = false;
    projTrailInst.count = 0;
    for (let i = 0; i < MAX_PROJ * TRAIL_SEGS; i++) {
      const seg = i % TRAIL_SEGS;
      _color.setHex(seg === 0 ? 0xfef08a : seg === 1 ? 0xfb923c : seg === 2 ? 0xf97316 : 0xdc2626);
      projTrailInst.setColorAt(i, _color);
    }
    if (projTrailInst.instanceColor) projTrailInst.instanceColor.needsUpdate = true;
    group.add(projTrailInst);
    instancedMeshes.push(projTrailInst);

    materials.push(
      sunCoreMat,
      sunCoronaMat,
      sunAuraMat,
      sunRingMat1,
      sunRingMat2,
      lensMat,
      beamCoreMat,
      beamSheathMat,
      beamOuterMat,
      beamRingMat,
      groundSigilMat,
      impactFlareMat,
      projCoreMat,
      projTrailMat,
    );

    refs.sunAssembly = sunAssembly;
    refs.sunCoreMesh = sunCoreMesh;
    refs.sunCoronaMesh = sunCoronaMesh;
    refs.sunAuraSphere = sunAuraSphere;
    refs.sunRingOuter = sunRingOuter;
    refs.sunRingInner = sunRingInner;
    refs.lensFunnelMesh = lensFunnelMesh;
    refs.beamCore = beamCore;
    refs.beamSheath = beamSheath;
    refs.beamOuter = beamOuter;
    refs.beamRingsInst = beamRingsInst;
    refs.groundSigil = groundSigil;
    refs.impactFlare = impactFlare;
    refs.projCoreInst = projCoreInst;
    refs.projTrailInst = projTrailInst;
    refs.sunAuraMat = sunAuraMat;
    refs.beamCoreMat = beamCoreMat;
    refs.beamSheathMat = beamSheathMat;
    refs.beamOuterMat = beamOuterMat;
    refs.impactFlareMat = impactFlareMat;
    refs.ringCount = RING_COUNT;
    refs.maxProj = MAX_PROJ;
    refs.trailSegs = TRAIL_SEGS;
    refs.sunY = SUN_Y;
    refs.lastFlareCount = 0;

    return { kind, group, materials, geometries, instancedMeshes, particleTimer: 0, refs };
  }

  // -------------------------------------------------------------------------
  // 11. ANTI-GRAVITY (`gravity_anomaly`) — Violet Distortion Field + Rising Rings + 36 Levitating Rocks!
  // -------------------------------------------------------------------------
  const domeMat = new THREE.MeshBasicMaterial({
    color: 0x818cf8,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const violetMat = createMagicCircleMat('gravity_flip', 0.9, 0);
  const deepMat = createMagicCircleMat('gravity_flip', 0.78, 2);
  const rubbleMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0x6366f1,
    emissiveIntensity: 0.38,
    flatShading: true,
  });
  materials.push(domeMat, violetMat, deepMat, rubbleMat);

  const domeMesh = new THREE.Mesh(geos.domeShellGeo, domeMat);
  domeMesh.position.y = 0.1;
  domeMesh.scale.set(radius * 0.92, radius * 0.65, radius * 0.92);
  group.add(domeMesh);

  const groundRing = new THREE.Mesh(sharedMagicCircleGeo, violetMat);
  groundRing.position.y = 0.14;
  groundRing.scale.setScalar(radius);
  group.add(groundRing);

  const gRing0 = new THREE.Mesh(sharedMagicCircleGeo, violetMat);
  const gRing1 = new THREE.Mesh(sharedMagicCircleGeo, deepMat);
  const gRing2 = new THREE.Mesh(sharedMagicCircleGeo, violetMat);
  group.add(gRing0, gRing1, gRing2);

  const RUBBLE_COUNT = 36;
  const rubbleInst = new THREE.InstancedMesh(geos.rockChunkGeo, rubbleMat, RUBBLE_COUNT);
  rubbleInst.frustumCulled = false;
  const seeds = new Float32Array(RUBBLE_COUNT * 4); // [angle, radFrac, phase, sizeScale]
  const rubblePalette = [0x94a3b8, 0x64748b, 0xa78bfa, 0x818cf8, 0x78716c];
  for (let i = 0; i < RUBBLE_COUNT; i++) {
    seeds[i * 4] = (i / RUBBLE_COUNT) * Math.PI * 2 + (i % 3) * 0.25;
    seeds[i * 4 + 1] = 0.18 + Math.sqrt((i + 0.5) / RUBBLE_COUNT) * 0.76;
    seeds[i * 4 + 2] = (i * 0.19) % 1;
    seeds[i * 4 + 3] = 0.55 + (i % 4) * 0.28;
    _color.setHex(rubblePalette[i % rubblePalette.length]);
    rubbleInst.setColorAt(i, _color);
  }
  if (rubbleInst.instanceColor) rubbleInst.instanceColor.needsUpdate = true;
  group.add(rubbleInst);
  instancedMeshes.push(rubbleInst);

  refs.domeMesh = domeMesh;
  refs.groundRing = groundRing;
  refs.gRing0 = gRing0;
  refs.gRing1 = gRing1;
  refs.gRing2 = gRing2;
  refs.rubbleInst = rubbleInst;
  refs.seeds = seeds;
  refs.rubbleCount = RUBBLE_COUNT;
  refs.domeMat = domeMat;

  return { kind: 'gravity_anomaly', group, materials, geometries, instancedMeshes, particleTimer: 0, refs };
}

/**
 * Per-frame zero-allocation animator for all 10 reworked God Power hazards.
 */
export function updateEnhancedHazardVfx(
  vfx: EnhancedHazardVfxState,
  haz: ActiveHazardZone,
  hy: number,
  elapsed: number,
  dt: number,
  fade: number,
  particles: GodPowerParticleCallbacks,
): void {
  const refs = vfx.refs;
  const progress = Math.min(1, Math.max(0, 1 - haz.remaining / Math.max(0.1, haz.duration)));

  // Throttle continuous ambient particles strictly to ~18 Hz (Rule 4 of PERFORMANCE_README.md)
  vfx.particleTimer += dt;
  const emitParticles = vfx.particleTimer >= 0.056;
  if (emitParticles) {
    vfx.particleTimer = 0;
  }

  // -------------------------------------------------------------------------
  // 1. LOCUST SWARM — True 3D buzzing, diving, banking locust cloud!
  // -------------------------------------------------------------------------
  if (vfx.kind === 'locust_swarm') {
    const inst = refs.inst as THREE.InstancedMesh;
    const seeds = refs.seeds as Float32Array;
    const hazeCanopy = refs.hazeCanopy as THREE.Mesh;
    const groundRing = refs.groundRing as THREE.Mesh;
    const hazeMat = refs.hazeMat as THREE.MeshBasicMaterial;
    const count = inst.count;
    const r = haz.radius;
    const spawnScale = Math.min(1, progress * 6) * fade;

    for (let i = 0; i < count; i++) {
      const s = i * 5;
      const phase = seeds[s];
      const orbitR = seeds[s + 1] * r * 0.92;
      const baseAlt = seeds[s + 2];
      const spd = seeds[s + 3];
      const diveFreq = seeds[s + 4];

      const ang = phase + elapsed * spd * (i % 2 === 0 ? 1 : -0.82);
      const radWobble = orbitR * (0.76 + Math.sin(elapsed * 2.4 + phase * 2) * 0.24);
      const px = Math.cos(ang) * radWobble + Math.sin(elapsed * 3.1 + phase) * 0.45;
      const pz = Math.sin(ang) * radWobble + Math.cos(elapsed * 2.7 + phase) * 0.45;
      // Swooping dive down to crop level and soaring back up
      const diveWave = Math.sin(elapsed * diveFreq + phase * 3.1);
      const py = Math.max(0.32, baseAlt + diveWave * 0.85);

      // Compute flight tangent for natural heading & banking
      const nextAng = ang + 0.06 * (i % 2 === 0 ? 1 : -0.82);
      const vx = Math.cos(nextAng) * radWobble - Math.cos(ang) * radWobble;
      const vz = Math.sin(nextAng) * radWobble - Math.sin(ang) * radWobble;
      const yaw = Math.atan2(vx, vz);
      const pitch = -Math.cos(elapsed * diveFreq + phase * 3.1) * 0.35;
      // Rapid high-frequency roll flutter simulates frenetic buzzing wings!
      const wingBuzzRoll = Math.sin(elapsed * 52 + i * 1.7) * 0.55;

      _pos.set(px, py, pz);
      _euler.set(pitch, yaw, wingBuzzRoll, 'YXZ');
      _quat.setFromEuler(_euler);
      const sc = (0.78 + (i % 4) * 0.18) * spawnScale;
      _scale.set(sc, sc, sc);
      _mat4.compose(_pos, _quat, _scale);
      inst.setMatrixAt(i, _mat4);
    }
    inst.instanceMatrix.needsUpdate = true;

    hazeCanopy.rotation.y = elapsed * 0.55;
    hazeCanopy.scale.set(r * 0.82 * spawnScale, 0.9 * spawnScale, r * 0.82 * spawnScale);
    hazeMat.opacity = 0.24 * spawnScale;

    groundRing.rotation.set(0, elapsed * 1.8, 0);
    groundRing.scale.setScalar(r * 0.92 * spawnScale);

    if (emitParticles) {
      const pAng = Math.random() * Math.PI * 2;
      const pRad = Math.random() * r * 0.75;
      particles.spawnRising(
        haz.x + Math.cos(pAng) * pRad,
        hy + 0.35,
        haz.z + Math.sin(pAng) * pRad,
        2,
        Math.random() < 0.6 ? '#a16207' : '#ca8a04',
        1.1,
        1.8,
        0.55,
        0.55,
      );
    }
    return;
  }

  // -------------------------------------------------------------------------
  // 2. EYE OF JUDGMENT (`sentinel_eye`) — Colossal Hovering Laser-Tracking Eye!
  // -------------------------------------------------------------------------
  if (vfx.kind === 'sentinel_eye') {
    const eyeAssembly = refs.eyeAssembly as THREE.Group;
    const crownMesh = refs.crownMesh as THREE.Mesh;
    const eyePivot = refs.eyePivot as THREE.Group;
    const upperLid = refs.upperLid as THREE.Mesh;
    const lowerLid = refs.lowerLid as THREE.Mesh;
    const pupilCore = refs.pupilCore as THREE.Mesh;
    const halo1 = refs.halo1 as THREE.Mesh;
    const halo2 = refs.halo2 as THREE.Mesh;
    const shardInst = refs.shardInst as THREE.InstancedMesh;
    const groundSigil = refs.groundSigil as THREE.Mesh;
    const beamGroup = refs.beamGroup as THREE.Group;
    const beamCore = refs.beamCore as THREE.Mesh;
    const beamOuter = refs.beamOuter as THREE.Mesh;
    const muzzleOrb = refs.muzzleOrb as THREE.Mesh;
    const impactOrb = refs.impactOrb as THREE.Mesh;
    const impactRing = refs.impactRing as THREE.Mesh;
    const beamCoreMat = refs.beamCoreMat as THREE.MeshBasicMaterial;
    const beamOuterMat = refs.beamOuterMat as THREE.MeshBasicMaterial;
    const shardCount = refs.shardCount as number;

    const age = haz.duration - haz.remaining;
    const openT = Math.min(1, age / 0.65);
    const scaleEnv = Math.sin(openT * Math.PI * 0.5) * fade;
    const hoverY = 5.2 + Math.sin(elapsed * 2.4) * 0.34;
    eyeAssembly.position.y = hoverY;
    eyeAssembly.scale.setScalar(Math.max(0.01, scaleEnv));

    const isFiring = (haz.beamFireTimer ?? 0) > 0 && haz.beamTargetX !== undefined && haz.beamTargetZ !== undefined;

    // Eyelids dramatically pry open on summon, narrow fiercely while blasting, and shut on expire
    const lidOpenAngle = (isFiring ? 0.82 : 1.08) * openT * fade;
    upperLid.rotation.set(-lidOpenAngle, 0, 0);
    lowerLid.rotation.set(lidOpenAngle, 0, Math.PI);

    // Crown pulses gently & rings counter-rotate
    crownMesh.rotation.z = Math.sin(elapsed * 1.4) * 0.14;
    halo1.rotation.set(elapsed * 1.1, elapsed * 1.6, 0);
    halo2.rotation.set(-elapsed * 0.9, elapsed * 1.3, Math.PI * 0.35);

    // 14 orbiting rune shards circling the eye
    for (let i = 0; i < shardCount; i++) {
      const a = (i / shardCount) * Math.PI * 2 + elapsed * 1.35;
      const orbitR = 3.15 + Math.sin(elapsed * 3.0 + i) * 0.25;
      _pos.set(Math.cos(a) * orbitR, Math.sin(elapsed * 2.6 + i * 1.3) * 0.55, Math.sin(a) * orbitR);
      _euler.set(elapsed * 1.8 + i, a, elapsed * 1.2);
      _quat.setFromEuler(_euler);
      const sc = isFiring ? 1.18 : 0.95;
      _scale.set(sc, sc, sc);
      _mat4.compose(_pos, _quat, _scale);
      shardInst.setMatrixAt(i, _mat4);
    }
    shardInst.instanceMatrix.needsUpdate = true;

    groundSigil.rotation.set(0, -elapsed * 1.4, 0);
    groundSigil.scale.setScalar(Math.min(5.4, haz.radius * 0.45) * scaleEnv);

    // Swivel the eyeball smoothly to stare directly at its laser target!
    if (isFiring && haz.beamTargetX !== undefined && haz.beamTargetZ !== undefined) {
      const targetGroundY = particles.getGroundY(haz.beamTargetX, haz.beamTargetZ);
      const localTx = haz.beamTargetX - haz.x;
      const localTy = targetGroundY + 0.35 - hy;
      const localTz = haz.beamTargetZ - haz.z;

      const dx = localTx;
      const dy = localTy - hoverY;
      const dz = localTz;
      const horiz = Math.max(0.05, Math.hypot(dx, dz));
      const targetYaw = Math.atan2(dx, dz);
      const targetPitch = -Math.atan2(dy, horiz);
      eyePivot.rotation.set(targetPitch, targetYaw, 0, 'YXZ');
      crownMesh.rotation.y = targetYaw;

      // Blazing pupil core pulse
      const pulse = 0.85 + Math.sin(elapsed * 55) * 0.25;
      pupilCore.scale.set(0.14 * pulse, 1, 0.42 * pulse);

      // Stretch live 3D Laser Beam from eye pupil directly to ground impact!
      const beamAlpha = Math.min(1, (haz.beamFireTimer ?? 0) / 0.14);
      _pos.set(0, hoverY, 0);
      // Offset muzzle forward along look direction (~1.38 units)
      _dir.set(dx, dy, dz).normalize();
      _pos.addScaledVector(_dir, 1.38);
      _pos2.set(localTx, localTy, localTz);

      const beamLen = _pos.distanceTo(_pos2);
      if (beamLen > 0.2) {
        beamGroup.visible = true;
        beamGroup.position.copy(_pos).add(_pos2).multiplyScalar(0.5);
        _dir.copy(_pos2).sub(_pos).normalize();
        _quat.setFromUnitVectors(_up, _dir);
        beamGroup.quaternion.copy(_quat);

        const wCore = 0.24 * pulse * beamAlpha;
        const wOuter = 0.62 * pulse * beamAlpha;
        beamCore.scale.set(wCore, beamLen, wCore);
        beamOuter.scale.set(wOuter, beamLen, wOuter);
        beamCoreMat.opacity = 0.96 * beamAlpha;
        beamOuterMat.opacity = 0.66 * beamAlpha;

        muzzleOrb.visible = true;
        muzzleOrb.position.copy(_pos);
        muzzleOrb.scale.setScalar(0.58 * pulse * beamAlpha);

        impactOrb.visible = true;
        impactOrb.position.copy(_pos2);
        impactOrb.scale.setScalar(1.05 * pulse * beamAlpha);

        impactRing.visible = true;
        impactRing.position.set(localTx, localTy + 0.08, localTz);
        impactRing.scale.setScalar(1.75 * pulse * beamAlpha);
      }

      if (emitParticles) {
        particles.spawnBurst(
          haz.beamTargetX,
          targetGroundY + 0.4,
          haz.beamTargetZ,
          3,
          Math.random() < 0.5 ? '#ff4500' : '#fef08a',
          0.95,
          5.2,
          0.9,
        );
      }
    } else {
      // Menacing idle scanning sweep
      const scanYaw = (haz.eyeYaw ?? elapsed * 0.9) + Math.sin(elapsed * 1.6) * 0.45;
      eyePivot.rotation.set(0.32 + Math.sin(elapsed * 2.1) * 0.14, scanYaw, 0, 'YXZ');
      crownMesh.rotation.y = scanYaw;
      pupilCore.scale.set(0.08, 1, 0.28);
      beamGroup.visible = false;
      muzzleOrb.visible = false;
      impactOrb.visible = false;
      impactRing.visible = false;
    }
    return;
  }

  // -------------------------------------------------------------------------
  // 3. PURIFY SKY BEAM (`purify_wave`) — 3-Phase Descent → Expanding Beam → Sky Ascension!
  // -------------------------------------------------------------------------
  if (vfx.kind === 'purify_wave') {
    const beamCore = refs.beamCore as THREE.Mesh;
    const beamCurtain = refs.beamCurtain as THREE.Mesh;
    const beamGold = refs.beamGold as THREE.Mesh;
    const skyPortal = refs.skyPortal as THREE.Mesh;
    const groundWave = refs.groundWave as THREE.Mesh;
    const innerGround = refs.innerGround as THREE.Mesh;
    const purifyDome = refs.purifyDome as THREE.Mesh;
    const moteInst = refs.moteInst as THREE.InstancedMesh;
    const seeds = refs.seeds as Float32Array;
    const coreMat = refs.coreMat as THREE.MeshBasicMaterial;
    const curtainMat = refs.curtainMat as THREE.MeshBasicMaterial;
    const goldSheathMat = refs.goldSheathMat as THREE.MeshBasicMaterial;
    const domeMat = refs.domeMat as THREE.MeshBasicMaterial;
    const moteMat = refs.moteMat as THREE.MeshBasicMaterial;
    const moteCount = refs.moteCount as number;

    const SKY_TOP = 26.0;
    const maxR = haz.maxRadius ?? haz.radius;
    const pulse = 0.94 + Math.sin(elapsed * 18) * 0.06;

    let beamBottomY = 0;
    let beamRadius = 0.65;
    let beamAlpha = 1.0;
    let skyPortalScale = 2.6;
    let groundWaveR = 0.01;
    let domeOpacity = 0;

    if (progress < 0.18) {
      // PHASE 1: Descent from high in the sky down to the earth
      const t = progress / 0.18;
      const eased = t * t; // Accelerating plunge!
      beamBottomY = SKY_TOP * (1 - eased);
      beamRadius = 0.55 + eased * 0.45;
      beamAlpha = Math.min(1, t * 2.2);
      skyPortalScale = 1.4 + eased * 3.0;
      groundWaveR = eased > 0.82 ? (eased - 0.82) * 8.0 : 0.01;
      domeOpacity = 0;
    } else if (progress <= 0.78) {
      // PHASE 2: Dramatic Expanding Light Pillar + Purifying Wave
      const t = (progress - 0.18) / 0.6;
      const expandEase = 1 - Math.pow(1 - t, 1.85);
      beamBottomY = 0;
      beamRadius = 0.95 + (maxR * 0.9 - 0.95) * expandEase;
      beamAlpha = 1.0 - Math.max(0, t - 0.78) * 0.8;
      skyPortalScale = Math.max(3.6, beamRadius * 1.15);
      groundWaveR = Math.max(0.8, haz.currentRadius ?? maxR * expandEase);
      domeOpacity = Math.sin(t * Math.PI) * 0.26;
    } else {
      // PHASE 3: Contracts inward and retracts cleanly back up into the sky!
      const t = (progress - 0.78) / 0.22;
      const ascendEase = t * t;
      beamBottomY = SKY_TOP * ascendEase;
      beamRadius = Math.max(0.28, maxR * 0.9 * (1 - t * 0.85));
      beamAlpha = Math.max(0, 1 - t * 0.95);
      skyPortalScale = Math.max(0.1, (maxR * 0.95) * (1 - t));
      groundWaveR = Math.max(0.01, maxR * (1 - t * 0.9));
      domeOpacity = 0;
    }

    const beamHeight = Math.max(0.2, SKY_TOP - beamBottomY);
    const beamCenterY = beamBottomY + beamHeight * 0.5;

    beamCore.position.y = beamCenterY;
    beamCore.scale.set(beamRadius * 0.46 * pulse, beamHeight, beamRadius * 0.46 * pulse);
    coreMat.opacity = 0.88 * beamAlpha;

    beamCurtain.position.y = beamCenterY;
    beamCurtain.scale.set(beamRadius * pulse, beamHeight, beamRadius * pulse);
    beamCurtain.rotation.y = elapsed * 1.4;
    curtainMat.opacity = 0.44 * beamAlpha;

    beamGold.position.y = beamCenterY;
    beamGold.scale.set(beamRadius * 1.16 * pulse, beamHeight, beamRadius * 1.16 * pulse);
    beamGold.rotation.y = -elapsed * 1.0;
    goldSheathMat.opacity = 0.3 * beamAlpha;

    skyPortal.position.y = SKY_TOP;
    skyPortal.rotation.set(0, elapsed * 2.2, 0);
    skyPortal.scale.setScalar(skyPortalScale);

    groundWave.visible = groundWaveR > 0.1;
    groundWave.rotation.set(0, elapsed * 2.0, 0);
    groundWave.scale.setScalar(Math.max(0.1, groundWaveR));

    innerGround.visible = groundWaveR > 0.1;
    innerGround.rotation.set(0, -elapsed * 1.5, 0);
    innerGround.scale.setScalar(Math.max(0.1, groundWaveR * 0.74));

    purifyDome.visible = domeOpacity > 0.01;
    purifyDome.scale.set(groundWaveR * 0.96, Math.min(5.2, groundWaveR * 0.55), groundWaveR * 0.96);
    domeMat.opacity = domeOpacity;

    // 40 Ascending Sacred Light Motes rising inside & along the expanding beam!
    const motesActive = progress >= 0.16 && progress <= 0.96;
    moteInst.visible = motesActive;
    if (motesActive) {
      moteMat.opacity = 0.86 * beamAlpha;
      for (let i = 0; i < moteCount; i++) {
        const ang = seeds[i * 3] + elapsed * 1.35;
        const radFrac = seeds[i * 3 + 1];
        const phase = seeds[i * 3 + 2];
        const cycle = (elapsed * 0.95 + phase) % 1;
        const mr = beamRadius * (0.35 + radFrac * 0.72);
        const my = beamBottomY + cycle * Math.min(18, beamHeight);
        _pos.set(Math.cos(ang) * mr, my, Math.sin(ang) * mr);
        _euler.set(0, ang, 0);
        _quat.setFromEuler(_euler);
        const env = Math.sin(cycle * Math.PI);
        _scale.set(0.85 * env, (0.9 + env * 1.5), 0.85 * env);
        _mat4.compose(_pos, _quat, _scale);
        moteInst.setMatrixAt(i, _mat4);
      }
      moteInst.instanceMatrix.needsUpdate = true;
    }

    if (emitParticles && progress >= 0.17 && progress <= 0.84) {
      particles.spawnRising(
        haz.x,
        hy + 0.35,
        haz.z,
        3,
        Math.random() < 0.5 ? '#fef08a' : '#38bdf8',
        Math.max(1.0, groundWaveR * 0.92),
        5.2,
        0.85,
        1.0,
      );
    }
    return;
  }

  // -------------------------------------------------------------------------
  // 4. SINKHOLE COLLAPSE (`sinkhole_collapse`) — Fracturing Abyss + 44 Tumbling Rock Chunks!
  // -------------------------------------------------------------------------
  if (vfx.kind === 'sinkhole_collapse') {
    const abyssDisc = refs.abyssDisc as THREE.Mesh;
    const funnelMesh = refs.funnelMesh as THREE.Mesh;
    const outerVortex = refs.outerVortex as THREE.Mesh;
    const innerRim = refs.innerRim as THREE.Mesh;
    const crackMesh = refs.crackMesh as THREE.Mesh;
    const rockInst = refs.rockInst as THREE.InstancedMesh;
    const seeds = refs.seeds as Float32Array;
    const abyssMat = refs.abyssMat as THREE.MeshBasicMaterial;
    const funnelMat = refs.funnelMat as THREE.MeshBasicMaterial;
    const rockCount = refs.rockCount as number;

    const curR = Math.max(0.6, haz.currentRadius ?? haz.radius);

    abyssDisc.scale.setScalar(curR * 0.94 * fade);
    abyssMat.opacity = 0.92 * fade;

    funnelMesh.rotation.y = -elapsed * 3.4;
    funnelMesh.scale.set(curR * 0.9 * fade, 1.0 + progress * 0.7, curR * 0.9 * fade);
    funnelMat.opacity = 0.72 * fade;

    outerVortex.rotation.set(0, -elapsed * 2.6, 0);
    outerVortex.scale.setScalar((curR + 1.35) * fade);

    innerRim.rotation.z = elapsed * 2.2;
    innerRim.scale.setScalar(curR * 1.02 * fade);

    crackMesh.scale.set((curR + 1.7) * fade, 1, (curR + 1.7) * fade);

    // 44 Blocky Rock Chunks breaking off the rim and spiraling/plummeting into the abyss!
    for (let i = 0; i < rockCount; i++) {
      const s = i * 4;
      const baseAng = seeds[s];
      const offset = seeds[s + 1];
      const size = seeds[s + 2];
      const spin = seeds[s + 3];

      const cycle = (elapsed * 0.95 + offset) % 1; // 0 = rim edge, 1 = swallowed deep inside
      const spiralAng = baseAng - cycle * 2.6;
      const rad = (curR * 1.18) * (1 - cycle * 0.88);
      // Slight hop as it shears off the lip, then accelerates downward into the dark chasm
      const y = 0.35 + Math.sin(Math.min(1, cycle * 2.5) * Math.PI) * 0.42 - cycle * cycle * 2.4;
      const sc = size * (1 - cycle * 0.55) * fade;

      _pos.set(Math.cos(spiralAng) * rad, y, Math.sin(spiralAng) * rad);
      _euler.set(elapsed * spin, spiralAng, elapsed * spin * 0.7);
      _quat.setFromEuler(_euler);
      _scale.set(sc, sc * 0.85, sc);
      _mat4.compose(_pos, _quat, _scale);
      rockInst.setMatrixAt(i, _mat4);
    }
    rockInst.instanceMatrix.needsUpdate = true;

    if (emitParticles) {
      const ang = Math.random() * Math.PI * 2;
      particles.spawnBurst(
        haz.x + Math.cos(ang) * curR * 1.05,
        hy + 0.3,
        haz.z + Math.sin(ang) * curR * 1.05,
        3,
        progress > 0.55 && Math.random() < 0.4 ? '#38bdf8' : '#78716c',
        0.95,
        3.1,
        0.85,
      );
    }
    return;
  }

  // -------------------------------------------------------------------------
  // 5. ACID CLOUD (`acid_cloud`) — Toxic Cloud Deck + 52 Slanted Acid Streaks + 18 Bubbling Puddles!
  // -------------------------------------------------------------------------
  if (vfx.kind === 'acid_cloud') {
    const cloudDeck = refs.cloudDeck as THREE.Mesh;
    const groundRing = refs.groundRing as THREE.Mesh;
    const dropInst = refs.dropInst as THREE.InstancedMesh;
    const dropSeeds = refs.dropSeeds as Float32Array;
    const dropCount = refs.dropCount as number;
    const puddleInst = refs.puddleInst as THREE.InstancedMesh;
    const puddleSeeds = refs.puddleSeeds as Float32Array;
    const puddleCount = refs.puddleCount as number;
    const cloudMat = refs.cloudMat as THREE.MeshStandardMaterial;
    const dropMat = refs.dropMat as THREE.MeshBasicMaterial;
    const r = haz.radius;

    cloudDeck.rotation.y = elapsed * 0.4;
    cloudDeck.position.y = 5.0 + Math.sin(elapsed * 2.4) * 0.25;
    cloudDeck.scale.set(r * 0.88 * fade, 1.32 * fade, r * 0.88 * fade);
    cloudMat.opacity = 0.9 * fade;
    dropMat.opacity = 0.88 * fade;

    groundRing.rotation.set(0, -elapsed * 1.2, 0);
    groundRing.scale.setScalar(r * (0.94 + Math.sin(elapsed * 4) * 0.04) * fade);

    const windX = (haz.windX ?? 1.4) * 0.22;
    const windZ = (haz.windZ ?? 0.6) * 0.22;
    _euler.set(windZ * 0.35, 0, -windX * 0.35);
    _quat.setFromEuler(_euler);

    for (let i = 0; i < dropCount; i++) {
      const s = i * 4;
      const bx = dropSeeds[s] * r;
      const bz = dropSeeds[s + 1] * r;
      const phase = dropSeeds[s + 2];
      const spd = dropSeeds[s + 3];
      const cycle = (elapsed * spd + phase) % 1;
      const py = 5.1 * (1 - cycle);
      _pos.set(bx + windX * cycle * 2.2, py, bz + windZ * cycle * 2.2);
      _scale.set(1, 0.85 + (i % 3) * 0.25, 1).multiplyScalar(fade);
      _mat4.compose(_pos, _quat, _scale);
      dropInst.setMatrixAt(i, _mat4);
    }
    dropInst.instanceMatrix.needsUpdate = true;

    _quat.identity();
    for (let i = 0; i < puddleCount; i++) {
      const s = i * 3;
      const bx = puddleSeeds[s] * r;
      const bz = puddleSeeds[s + 1] * r;
      const cycle = (elapsed * 1.35 + puddleSeeds[s + 2]) % 1;
      const sc = Math.sin(cycle * Math.PI) * (0.75 + (i % 3) * 0.35) * fade;
      _pos.set(bx, 0.14, bz);
      _scale.set(sc, 1, sc);
      _mat4.compose(_pos, _quat, _scale);
      puddleInst.setMatrixAt(i, _mat4);
    }
    puddleInst.instanceMatrix.needsUpdate = true;

    if (emitParticles) {
      const a = Math.random() * Math.PI * 2;
      const dist = Math.random() * r * 0.85;
      particles.spawnRising(
        haz.x + Math.cos(a) * dist,
        hy + 0.25,
        haz.z + Math.sin(a) * dist,
        2,
        '#a3e635',
        0.8,
        2.1,
        0.55,
        0.75,
      );
    }
    return;
  }

  // -------------------------------------------------------------------------
  // 6. BLIZZARD GALE (`blizzard_gale`) — Swirling Frost Cyclone + 64 Whipping Ice Shards!
  // -------------------------------------------------------------------------
  if (vfx.kind === 'blizzard_gale') {
    const cloudDeck = refs.cloudDeck as THREE.Mesh;
    const galeWall = refs.galeWall as THREE.Mesh;
    const groundRing = refs.groundRing as THREE.Mesh;
    const shardInst = refs.shardInst as THREE.InstancedMesh;
    const seeds = refs.seeds as Float32Array;
    const shardCount = refs.shardCount as number;
    const galeMat = refs.galeMat as THREE.MeshBasicMaterial;
    const r = haz.radius;

    cloudDeck.rotation.y = elapsed * 1.15;
    cloudDeck.position.y = 5.0 + Math.sin(elapsed * 3.1) * 0.24;
    cloudDeck.scale.set(r * 0.9 * fade, 1.25 * fade, r * 0.9 * fade);

    galeWall.rotation.y = elapsed * 4.5;
    galeWall.scale.set(r * 0.82 * fade, 4.6 * fade, r * 0.82 * fade);
    galeMat.opacity = 0.22 * fade;

    groundRing.rotation.set(0, elapsed * 3.4, 0);
    groundRing.scale.setScalar(r * 0.96 * fade);

    for (let i = 0; i < shardCount; i++) {
      const s = i * 4;
      const ang = seeds[s] + elapsed * seeds[s + 3];
      const rad = seeds[s + 1] * r * 0.94;
      const cycle = (elapsed * 1.65 + seeds[s + 2]) % 1;
      const py = 5.0 * (1 - cycle) + 0.15;
      _pos.set(Math.cos(ang) * rad, py, Math.sin(ang) * rad);
      _euler.set(elapsed * 5 + i, ang, elapsed * 6);
      _quat.setFromEuler(_euler);
      const sc = (0.72 + (i % 4) * 0.24) * fade;
      _scale.set(sc, sc * 1.4, sc);
      _mat4.compose(_pos, _quat, _scale);
      shardInst.setMatrixAt(i, _mat4);
    }
    shardInst.instanceMatrix.needsUpdate = true;

    if (emitParticles) {
      const a = Math.random() * Math.PI * 2;
      const dist = Math.random() * r * 0.85;
      particles.spawnBurst(
        haz.x + Math.cos(a) * dist,
        hy + 2.8,
        haz.z + Math.sin(a) * dist,
        3,
        Math.random() < 0.5 ? '#e0f2fe' : '#7dd3fc',
        1.1,
        3.2,
        0.78,
      );
    }
    return;
  }

  // -------------------------------------------------------------------------
  // 7. LAVA FISSURE (`magma_geyser`) — Tectonic Crack + Lava Pillar + 36 Erupting Magma Bombs!
  // -------------------------------------------------------------------------
  if (vfx.kind === 'magma_geyser') {
    const fissureMesh = refs.fissureMesh as THREE.Mesh;
    const groundRing = refs.groundRing as THREE.Mesh;
    const outerPillar = refs.outerPillar as THREE.Mesh;
    const corePillar = refs.corePillar as THREE.Mesh;
    const bombInst = refs.bombInst as THREE.InstancedMesh;
    const seeds = refs.seeds as Float32Array;
    const bombCount = refs.bombCount as number;

    const heading = haz.heading ?? 0;
    const curHalfLen = Math.max(1.4, haz.currentRadius ?? haz.radius * 0.65);
    const pulse = 0.86 + Math.sin(elapsed * 14) * 0.18;

    fissureMesh.rotation.y = -heading;
    fissureMesh.scale.set(curHalfLen * fade, 1.0 * fade, 1.25 * fade);

    groundRing.rotation.set(0, elapsed * 1.8, 0);
    groundRing.scale.setScalar(Math.max(1.8, curHalfLen * 0.55) * pulse * fade);

    const geyserH = (3.4 + Math.abs(Math.sin(elapsed * 5.8)) * 2.4) * fade;
    outerPillar.position.y = geyserH * 0.5;
    outerPillar.scale.set(1.15 * pulse * fade, geyserH, 1.15 * pulse * fade);
    outerPillar.rotation.y = elapsed * 2.5;

    corePillar.position.y = geyserH * 0.48;
    corePillar.scale.set(0.55 * pulse * fade, geyserH * 0.96, 0.55 * pulse * fade);

    const dirX = Math.cos(heading);
    const dirZ = Math.sin(heading);
    const perpX = -dirZ;
    const perpZ = dirX;

    for (let i = 0; i < bombCount; i++) {
      const s = i * 4;
      const along = seeds[s] * curHalfLen;
      const perp = seeds[s + 1];
      const cycle = (elapsed * 1.15 + seeds[s + 2]) % 1;
      const arcH = seeds[s + 3];

      const px = dirX * along + perpX * perp * cycle * 2.4;
      const pz = dirZ * along + perpZ * perp * cycle * 2.4;
      const py = 0.25 + 4 * cycle * (1 - cycle) * arcH;
      const sc = (0.55 + (1 - cycle) * 0.65) * fade;

      _pos.set(px, py, pz);
      _euler.set(elapsed * 6 + i, elapsed * 4, i);
      _quat.setFromEuler(_euler);
      _scale.set(sc, sc, sc);
      _mat4.compose(_pos, _quat, _scale);
      bombInst.setMatrixAt(i, _mat4);
    }
    bombInst.instanceMatrix.needsUpdate = true;

    if (emitParticles) {
      const along = (Math.random() * 2 - 1) * curHalfLen;
      particles.spawnRising(
        haz.x + dirX * along,
        hy + 0.35,
        haz.z + dirZ * along,
        3,
        Math.random() < 0.5 ? '#ff5400' : '#facc15',
        1.2,
        6.0,
        0.85,
        1.05,
      );
    }
    return;
  }

  // -------------------------------------------------------------------------
  // 8. BIOME BLOOM WAVE (`biome_bloom_wave`) — 3D Luminous Wave Wall + 44 Themed Motes!
  // -------------------------------------------------------------------------
  if (vfx.kind === 'biome_bloom_wave') {
    const waveWall = refs.waveWall as THREE.Mesh;
    const outerRing = refs.outerRing as THREE.Mesh;
    const innerRing = refs.innerRing as THREE.Mesh;
    const moteInst = refs.moteInst as THREE.InstancedMesh;
    const seeds = refs.seeds as Float32Array;
    const moteCount = refs.moteCount as number;
    const wallMat = refs.wallMat as THREE.MeshBasicMaterial;
    const ringMat2 = refs.ringMat2 as THREE.MeshBasicMaterial;

    const bKind = haz.biomeWaveKind ?? 'floral';
    const curR = Math.max(0.7, haz.currentRadius ?? haz.radius);

    if (refs.lastBiomeKind !== bKind) {
      refs.lastBiomeKind = bKind;
      const wallHex = bKind === 'floral' ? 0xf472b6 : bKind === 'blight' ? 0x9333ea : 0xff5400;
      const ringHex = bKind === 'floral' ? 0xfacc15 : bKind === 'blight' ? 0x4ade80 : 0xfef08a;
      wallMat.color.setHex(wallHex);
      ringMat2.color.setHex(ringHex);
      for (let i = 0; i < moteCount; i++) {
        _color.setHex(i % 2 === 0 ? wallHex : ringHex);
        moteInst.setColorAt(i, _color);
      }
      if (moteInst.instanceColor) moteInst.instanceColor.needsUpdate = true;
    }

    const wallH = (2.4 + Math.sin(progress * Math.PI) * 1.4) * fade;
    waveWall.position.y = wallH * 0.5;
    waveWall.scale.set(curR * fade, wallH, curR * fade);
    waveWall.rotation.y = elapsed * 1.2;
    wallMat.opacity = 0.42 * fade;

    outerRing.rotation.set(0, elapsed * 1.6, 0);
    outerRing.scale.setScalar(curR * fade);

    innerRing.scale.setScalar(curR * 0.88 * fade);
    innerRing.position.y = 0.28 + Math.sin(elapsed * 4.5) * 0.12;

    for (let i = 0; i < moteCount; i++) {
      const s = i * 3;
      const ang = seeds[s] + elapsed * 1.2;
      const cycle = (elapsed * seeds[s + 2] + seeds[s + 1]) % 1;
      const rad = curR * (0.76 + (i % 3) * 0.12);
      const py = 0.2 + cycle * 4.2;
      const env = Math.sin(cycle * Math.PI) * fade;
      _pos.set(Math.cos(ang) * rad, py, Math.sin(ang) * rad);
      _euler.set(elapsed * 4 + i, ang, elapsed * 3.5);
      _quat.setFromEuler(_euler);
      _scale.set(1.1 * env, 1.1 * env, 1.1 * env);
      _mat4.compose(_pos, _quat, _scale);
      moteInst.setMatrixAt(i, _mat4);
    }
    moteInst.instanceMatrix.needsUpdate = true;

    if (emitParticles) {
      const pCol =
        bKind === 'floral'
          ? Math.random() < 0.5 ? '#f472b6' : '#facc15'
          : bKind === 'blight'
            ? Math.random() < 0.5 ? '#a855f7' : '#4ade80'
            : Math.random() < 0.5 ? '#ff5400' : '#facc15';
      particles.spawnRising(haz.x, hy + 0.3, haz.z, 3, pCol, curR * 0.95, 3.6, 0.8, 0.95);
    }
    return;
  }

  // -------------------------------------------------------------------------
  // 9. TIME BUBBLE (`chrono_field`) — Celestial Clockwork Dome + 28 Time Crystals!
  // -------------------------------------------------------------------------
  if (vfx.kind === 'chrono_field') {
    const domeMesh = refs.domeMesh as THREE.Mesh;
    const clockDial = refs.clockDial as THREE.Mesh;
    const outerRing = refs.outerRing as THREE.Mesh;
    const innerRing = refs.innerRing as THREE.Mesh;
    const crystalInst = refs.crystalInst as THREE.InstancedMesh;
    const seeds = refs.seeds as Float32Array;
    const crystalCount = refs.crystalCount as number;
    const domeMat = refs.domeMat as THREE.MeshBasicMaterial;
    const r = haz.radius;

    const pulse = 0.97 + Math.sin(elapsed * 4.5) * 0.04;
    domeMesh.scale.set(r * 0.92 * pulse * fade, r * 0.58 * pulse * fade, r * 0.92 * pulse * fade);
    domeMat.opacity = 0.16 * fade;

    // Fast-forward spinning clock hands!
    clockDial.rotation.y = -elapsed * 3.8;
    clockDial.scale.setScalar(r * 0.72 * fade);

    outerRing.rotation.set(0, elapsed * 1.8, 0);
    outerRing.scale.setScalar(r * pulse * fade);

    innerRing.rotation.set(0, -elapsed * 2.4, 0);
    innerRing.scale.setScalar(r * 0.68 * fade);

    for (let i = 0; i < crystalCount; i++) {
      const s = i * 3;
      const ang = seeds[s] + elapsed * 2.4;
      const rad = r * seeds[s + 1];
      const cycle = (elapsed * 0.8 + seeds[s + 2]) % 1;
      const py = 0.4 + cycle * 4.6;
      const env = Math.sin(cycle * Math.PI) * fade;
      _pos.set(Math.cos(ang) * rad, py, Math.sin(ang) * rad);
      _euler.set(elapsed * 2.2, elapsed * 4.0 + i, 0);
      _quat.setFromEuler(_euler);
      _scale.set(0.8 * env, 1.5 * env, 0.8 * env);
      _mat4.compose(_pos, _quat, _scale);
      crystalInst.setMatrixAt(i, _mat4);
    }
    crystalInst.instanceMatrix.needsUpdate = true;

    if (emitParticles) {
      particles.spawnRising(haz.x, hy + 0.3, haz.z, 2, '#38bdf8', r * 0.75, 4.0, 0.75, 0.85);
    }
    return;
  }

  // -------------------------------------------------------------------------
  // 10. SOLAR BEAM (`orbital_beam`) — Blazing Voxel Sun + Cascading Beam + Map-Wide Lava Projectiles!
  // -------------------------------------------------------------------------
  if (vfx.kind === 'orbital_beam') {
    const sunAssembly = refs.sunAssembly as THREE.Group;
    const sunCoreMesh = refs.sunCoreMesh as THREE.Mesh;
    const sunCoronaMesh = refs.sunCoronaMesh as THREE.Mesh;
    const sunAuraSphere = refs.sunAuraSphere as THREE.Mesh;
    const sunRingOuter = refs.sunRingOuter as THREE.Mesh;
    const sunRingInner = refs.sunRingInner as THREE.Mesh;
    const lensFunnelMesh = refs.lensFunnelMesh as THREE.Mesh;
    const beamCore = refs.beamCore as THREE.Mesh;
    const beamSheath = refs.beamSheath as THREE.Mesh;
    const beamOuter = refs.beamOuter as THREE.Mesh;
    const beamRingsInst = refs.beamRingsInst as THREE.InstancedMesh;
    const groundSigil = refs.groundSigil as THREE.Mesh;
    const impactFlare = refs.impactFlare as THREE.Mesh;
    const projCoreInst = refs.projCoreInst as THREE.InstancedMesh;
    const projTrailInst = refs.projTrailInst as THREE.InstancedMesh;
    const sunAuraMat = refs.sunAuraMat as THREE.MeshBasicMaterial;
    const beamCoreMat = refs.beamCoreMat as THREE.MeshBasicMaterial;
    const beamSheathMat = refs.beamSheathMat as THREE.MeshBasicMaterial;
    const beamOuterMat = refs.beamOuterMat as THREE.MeshBasicMaterial;
    const impactFlareMat = refs.impactFlareMat as THREE.MeshBasicMaterial;
    const ringCount = refs.ringCount as number;
    const maxProj = refs.maxProj as number;
    const trailSegs = refs.trailSegs as number;
    const sunY = refs.sunY as number;

    const r = haz.radius;
    // Smooth 3-stage Sun ignition -> full blazing radiance -> solar collapse
    const igniteT = Math.min(1, progress / 0.08);
    const igniteEase = 1 - (1 - igniteT) * (1 - igniteT);
    const collapseFade = Math.min(1, haz.remaining / 0.95);
    const sunEnv = igniteEase * collapseFade;
    const beamDescend = Math.min(1, progress / 0.06);

    // Flare burst pulse when the Sun launches a new salvo of solar projectiles!
    const curFlareCount = haz.solarFlareCount ?? 0;
    const prevFlareCount = refs.lastFlareCount as number;
    if (curFlareCount > prevFlareCount) {
      refs.lastFlareCount = curFlareCount;
      particles.spawnBurst(haz.x, hy + sunY, haz.z, 12, '#fde047', 2.4, 7.5, 1.15);
      particles.spawnImpactFlash?.(haz.x, hy + sunY, haz.z, '#ffaa00', 22, 0.025);
    }

    const pulse = 0.92 + Math.sin(elapsed * 24) * 0.09 + Math.sin(elapsed * 11) * 0.05;
    const sunScale = (0.95 + Math.sin(elapsed * 5.2) * 0.06) * sunEnv;

    // Animate Overhead Voxel Sun
    sunAssembly.position.y = sunY + Math.sin(elapsed * 2.4) * 0.35;
    sunAssembly.scale.setScalar(Math.max(0.001, sunScale));
    sunCoreMesh.rotation.set(elapsed * 0.55, elapsed * 0.92, elapsed * 0.31);
    sunCoronaMesh.rotation.set(-elapsed * 0.42, -elapsed * 1.15, elapsed * 0.68);
    sunCoronaMesh.scale.setScalar(0.96 + Math.sin(elapsed * 9.5) * 0.1);
    sunAuraSphere.scale.setScalar(4.15 + Math.sin(elapsed * 7.2) * 0.38);
    sunAuraMat.opacity = 0.34 * sunEnv;
    sunRingOuter.rotation.z = elapsed * 1.9;
    sunRingOuter.rotation.y = elapsed * 0.7;
    sunRingInner.rotation.z = -elapsed * 2.4;
    sunRingInner.rotation.y = -elapsed * 1.1;
    lensFunnelMesh.rotation.y = elapsed * 3.8;

    // Animate Multi-Layer Solar Beam connecting the Sun's Aperture Lens down to the Ground
    const beamTop = sunAssembly.position.y - 1.6;
    const beamBot = beamTop * (1 - beamDescend);
    const beamH = Math.max(0.1, beamTop - beamBot);
    const beamMid = (beamTop + beamBot) * 0.5;
    const beamWidthEnv = Math.min(1, beamDescend * 1.2) * collapseFade;

    beamCore.position.y = beamMid;
    beamCore.scale.set(0.68 * pulse * beamWidthEnv, beamH, 0.68 * pulse * beamWidthEnv);
    beamCore.rotation.y = elapsed * 4.2;
    beamCoreMat.opacity = 0.95 * beamWidthEnv;

    beamSheath.position.y = beamMid;
    beamSheath.scale.set(1.42 * pulse * beamWidthEnv, beamH, 1.42 * pulse * beamWidthEnv);
    beamSheath.rotation.y = -elapsed * 3.4;
    beamSheathMat.opacity = 0.56 * beamWidthEnv;

    beamOuter.position.y = beamMid;
    beamOuter.scale.set(Math.max(2.1, r * 0.54) * pulse * beamWidthEnv, beamH, Math.max(2.1, r * 0.54) * pulse * beamWidthEnv);
    beamOuter.rotation.y = elapsed * 2.1;
    beamOuterMat.opacity = 0.32 * beamWidthEnv;

    // 16 Cascading Plasma Rings rushing down the Solar Beam from Sun -> Ground
    for (let i = 0; i < ringCount; i++) {
      const cycle = ((elapsed * 2.35 + i / ringCount) % 1 + 1) % 1;
      const py = beamTop - cycle * beamH;
      const ringR = (0.95 + Math.sin(cycle * Math.PI) * 0.95 + (i % 2) * 0.35) * pulse * beamWidthEnv;
      _pos.set(0, py, 0);
      _euler.set(Math.PI * 0.5 + Math.sin(elapsed * 5 + i) * 0.14, elapsed * 3.5 + i * 0.6, 0);
      _quat.setFromEuler(_euler);
      _scale.set(ringR, ringR, Math.max(0.01, beamWidthEnv * 1.35));
      _mat4.compose(_pos, _quat, _scale);
      beamRingsInst.setMatrixAt(i, _mat4);
    }
    beamRingsInst.instanceMatrix.needsUpdate = true;

    // Ground Meltdown Impact Zone
    groundSigil.rotation.set(0, elapsed * 2.6, 0);
    groundSigil.scale.setScalar(Math.max(2.5, r * 0.94) * (0.94 + Math.sin(elapsed * 12) * 0.07) * beamWidthEnv);
    impactFlare.scale.set(1.65 * pulse * beamWidthEnv, 0.95 * pulse * beamWidthEnv, 1.65 * pulse * beamWidthEnv);
    impactFlareMat.opacity = 0.86 * beamWidthEnv;

    // Render ALL In-Flight Map-Wide Solar Projectiles + 4-Segment Blazing Comet Trails!
    const projs = haz.solarProjectiles;
    const activeCount = projs ? Math.min(maxProj, projs.length) : 0;
    projCoreInst.count = activeCount;
    projTrailInst.count = activeCount * trailSegs;
    for (let i = 0; i < activeCount; i++) {
      const p = projs![i];
      const t = Math.min(1, Math.max(0, p.progress));
      const targetGroundY = particles.getGroundY(p.targetX, p.targetZ);
      const startWorldY = hy + p.startY;
      // Parabolic arc from the Sun's corona high across the sky to any tile on the map
      const wx = p.startX + (p.targetX - p.startX) * t;
      const wz = p.startZ + (p.targetZ - p.startZ) * t;
      const linearY = startWorldY + (targetGroundY - startWorldY) * t;
      const arcLift = 4 * t * (1 - t) * Math.max(2.5, p.peakY - Math.max(startWorldY, targetGroundY));
      const wy = linearY + arcLift;

      // Local coordinates relative to hv.group (which sits at haz.x, hy, haz.z)
      _pos.set(wx - haz.x, wy - hy, wz - haz.z);
      _euler.set(elapsed * 6.5 + i * 1.1, elapsed * 8.2 + i, elapsed * 5.0);
      _quat.setFromEuler(_euler);
      const projScale = 0.95 + Math.sin(elapsed * 18 + i) * 0.14;
      _scale.setScalar(projScale);
      _mat4.compose(_pos, _quat, _scale);
      projCoreInst.setMatrixAt(i, _mat4);

      // 4 glowing fiery comet tail spheres trailing smoothly back along the parabola
      for (let s = 0; s < trailSegs; s++) {
        const ts = Math.max(0, t - (s + 1) * 0.036);
        const twx = p.startX + (p.targetX - p.startX) * ts;
        const twz = p.startZ + (p.targetZ - p.startZ) * ts;
        const tLinY = startWorldY + (targetGroundY - startWorldY) * ts;
        const tLift = 4 * ts * (1 - ts) * Math.max(2.5, p.peakY - Math.max(startWorldY, targetGroundY));
        const twy = tLinY + tLift;
        const segScale = Math.max(0.18, (0.78 - s * 0.15) * (t > 0.02 ? 1 : 0.2));
        _pos2.set(twx - haz.x, twy - hy, twz - haz.z);
        _quat.identity();
        _scale.setScalar(segScale);
        _mat4.compose(_pos2, _quat, _scale);
        projTrailInst.setMatrixAt(i * trailSegs + s, _mat4);
      }
    }
    if (activeCount > 0) {
      projCoreInst.instanceMatrix.needsUpdate = true;
      projTrailInst.instanceMatrix.needsUpdate = true;
    }

    // Drain recent solar projectile impacts -> explosive lava splash bursts + light flashes across the map!
    if (haz.recentSolarImpacts && haz.recentSolarImpacts.length > 0) {
      for (let ii = 0; ii < haz.recentSolarImpacts.length; ii++) {
        const imp = haz.recentSolarImpacts[ii];
        const igy = particles.getGroundY(imp.x, imp.z);
        particles.spawnBurst(imp.x, igy + 0.45, imp.z, 18, '#ff5400', imp.radius * 0.95, 7.2, 1.15);
        particles.spawnBurst(imp.x, igy + 0.65, imp.z, 10, '#fef08a', imp.radius * 0.6, 5.4, 0.95);
        particles.spawnRising(imp.x, igy + 0.3, imp.z, 6, '#fb923c', imp.radius * 0.85, 5.2, 0.85, 1.0);
        particles.spawnImpactFlash?.(imp.x, igy + 1.4, imp.z, '#ff6b00', 22, 0.035);
      }
      haz.recentSolarImpacts.length = 0;
    }

    if (emitParticles) {
      particles.spawnBurst(haz.x, hy + 0.35, haz.z, 3, '#fb923c', 1.4, 6.2, 0.95);
      particles.spawnRising(haz.x, hy + 0.3, haz.z, 2, '#fde047', r * 0.55, 5.8, 0.72, 0.85);
    }
    return;
  }

  // -------------------------------------------------------------------------
  // 10. ANTI-GRAVITY (`gravity_anomaly`) — Violet Singularity Dome + 36 Levitating Rocks!
  // -------------------------------------------------------------------------
  const domeMesh = refs.domeMesh as THREE.Mesh;
  const groundRing = refs.groundRing as THREE.Mesh;
  const gRing0 = refs.gRing0 as THREE.Mesh;
  const gRing1 = refs.gRing1 as THREE.Mesh;
  const gRing2 = refs.gRing2 as THREE.Mesh;
  const rubbleInst = refs.rubbleInst as THREE.InstancedMesh;
  const seeds = refs.seeds as Float32Array;
  const rubbleCount = refs.rubbleCount as number;
  const domeMat = refs.domeMat as THREE.MeshBasicMaterial;
  const r = haz.radius;

  const pulse = 0.96 + Math.sin(elapsed * 6.0) * 0.06;
  domeMesh.scale.set(r * 0.92 * pulse * fade, r * 0.62 * pulse * fade, r * 0.92 * pulse * fade);
  domeMat.opacity = 0.18 * fade;

  groundRing.rotation.set(0, elapsed * 2.0, 0);
  groundRing.scale.setScalar(r * pulse * fade);

  const gRings = [gRing0, gRing1, gRing2];
  for (let gi = 0; gi < 3; gi++) {
    const gr = gRings[gi];
    const riseCycle = (elapsed * 0.85 + gi / 3) % 1;
    gr.position.y = 0.25 + riseCycle * 5.6;
    gr.scale.setScalar(r * (0.94 - riseCycle * 0.45) * fade);
    gr.rotation.set(0, elapsed * (1.8 + gi * 0.6), 0);
  }

  // 36 Levitating Earth/Rock Chunks drifting weightlessly upward in zero-G!
  for (let i = 0; i < rubbleCount; i++) {
    const s = i * 4;
    const ang = seeds[s] + elapsed * 0.65;
    const rad = seeds[s + 1] * r * 0.9;
    const cycle = (elapsed * 0.45 + seeds[s + 2]) % 1;
    const size = seeds[s + 3];
    const py = 0.35 + cycle * 6.2;
    const env = Math.sin(cycle * Math.PI) * fade;
    _pos.set(Math.cos(ang) * rad, py, Math.sin(ang) * rad);
    _euler.set(elapsed * 1.4 + i, elapsed * 1.1, elapsed * 0.9);
    _quat.setFromEuler(_euler);
    _scale.setScalar(size * env);
    _mat4.compose(_pos, _quat, _scale);
    rubbleInst.setMatrixAt(i, _mat4);
  }
  rubbleInst.instanceMatrix.needsUpdate = true;

  if (emitParticles) {
    particles.spawnRising(haz.x, hy + 0.25, haz.z, 2, '#c084fc', r * 0.78, 4.6, 0.85, 0.95);
  }
}
