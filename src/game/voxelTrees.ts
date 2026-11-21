import * as THREE from 'three';

export type TreeBiomeKey =
  | 'forest'
  | 'meadow'
  | 'jungle'
  | 'taiga'
  | 'blossom'
  | 'savanna'
  | 'swamp'
  | 'highland';

export interface VoxelTreeSpeciesSpec {
  id: string;
  biome: TreeBiomeKey;
  name: string;
  /** World-space micro-voxel size matching the game's 3D pixel-voxel scale */
  voxelSize: number;
  /** Relative natural height tier for silhouette variety */
  heightBias: number;
  /** Relative natural width tier */
  widthBias: number;
}

export interface VoxelTreeLibrary {
  byBiome: Record<TreeBiomeKey, THREE.BufferGeometry[]>;
  byBiomeLod1: Record<TreeBiomeKey, THREE.BufferGeometry[]>;
  byBiomeLod2: Record<TreeBiomeKey, THREE.BufferGeometry[]>;
  byBiomeLod3: Record<TreeBiomeKey, THREE.BufferGeometry[]>;
  burntByBiome: Record<TreeBiomeKey, THREE.BufferGeometry[]>;
  burntByBiomeLod1: Record<TreeBiomeKey, THREE.BufferGeometry[]>;
  burntByBiomeLod2: Record<TreeBiomeKey, THREE.BufferGeometry[]>;
  burntByBiomeLod3: Record<TreeBiomeKey, THREE.BufferGeometry[]>;
  specsByBiome: Record<TreeBiomeKey, VoxelTreeSpeciesSpec[]>;
  allSpecs: VoxelTreeSpeciesSpec[];
  allGeometries: THREE.BufferGeometry[];
  burntTrees: THREE.BufferGeometry[];
  burntTreesLod1: THREE.BufferGeometry[];
  burntTreesLod2: THREE.BufferGeometry[];
  burntTreesLod3: THREE.BufferGeometry[];
  material: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function mapTerrainToTreeBiome(terrain: string): TreeBiomeKey {
  if (terrain === 'jungle') return 'jungle';
  if (terrain === 'taiga' || terrain === 'tundra' || terrain === 'snow') return 'taiga';
  if (terrain === 'blossom') return 'blossom';
  if (terrain === 'savanna' || terrain === 'badlands' || terrain === 'sand') return 'savanna';
  if (terrain === 'swamp') return 'swamp';
  if (terrain === 'highland' || terrain === 'mountain' || terrain === 'rock') return 'highland';
  if (terrain === 'grass' || terrain === 'fertile') return 'meadow';
  return 'forest';
}

// ============================================================================
// Painterly Woodland Pixel-Art Palettes (Modeled on Reference Image)
// [deepCreviceShadow, darkShadow, midTone, sunlitTone, goldenHighlight]
// ============================================================================

type Pal5 = readonly [number, number, number, number, number];

const PAL_OAK: Pal5 = [0x15251e, 0x223c29, 0x395d34, 0x67893d, 0xadb848];
const PAL_PINE: Pal5 = [0x12221e, 0x1e3a2e, 0x375c3e, 0x608248, 0x99ac54];
const PAL_BIRCH_LEAF: Pal5 = [0x1d3421, 0x32572c, 0x548035, 0x89ab3d, 0xc6cf54];
const PAL_REDWOOD: Pal5 = [0x11251d, 0x1d3f2c, 0x315f39, 0x518042, 0x88a84e];
const PAL_MAPLE: Pal5 = [0x3d1412, 0x702418, 0xac3d1f, 0xdc6f25, 0xf2b940];
const PAL_WILLOW: Pal5 = [0x162b1f, 0x294d30, 0x48733d, 0x779e4a, 0xb0c65c];
const PAL_ORCHARD: Pal5 = [0x162b1c, 0x264c2b, 0x437736, 0x71a442, 0xb0cc56];
const PAL_JUNGLE: Pal5 = [0x0d231a, 0x184228, 0x286936, 0x499240, 0x85bc4e];
const PAL_PALM: Pal5 = [0x132b1b, 0x254e2a, 0x407635, 0x6aa040, 0xa6c752];
const PAL_TAIGA: Pal5 = [0x102123, 0x1c3838, 0x2f5750, 0x4d7967, 0x7fa48a];
const PAL_FROST_FIR: Pal5 = [0x142730, 0x24434f, 0x3c6572, 0x66909a, 0xa8ccd3];
const PAL_LARCH: Pal5 = [0x362412, 0x60431b, 0x986f28, 0xca9f3c, 0xeed46d];
const PAL_SNOW: Pal5 = [0x58718d, 0x839fb9, 0xb4cbe0, 0xdfedf8, 0xf8fcff];
const PAL_SAKURA: Pal5 = [0x5b2139, 0x913d5e, 0xcc678c, 0xf2a1bc, 0xffe8f1];
const PAL_PLUM_WHITE: Pal5 = [0x5e4b59, 0x8c7787, 0xc0adb9, 0xebe0e9, 0xfff9fc];
const PAL_ACACIA: Pal5 = [0x242a15, 0x3e4821, 0x616e2f, 0x8d983e, 0xc2c254];
const PAL_OASIS: Pal5 = [0x1d2e18, 0x365127, 0x587936, 0x85a345, 0xbcc75d];
const PAL_SWAMP: Pal5 = [0x10211d, 0x1e3a30, 0x335644, 0x527657, 0x809d69];
const PAL_SPANISH_MOSS: Pal5 = [0x2d3f37, 0x4c6458, 0x718978, 0x98ad9a, 0xc1d0bc];
const PAL_SCOTS_LEAF: Pal5 = [0x13241f, 0x223e32, 0x385e46, 0x587f55, 0x8aa765];
const PAL_ROWAN: Pal5 = [0x421416, 0x762321, 0xb23829, 0xdd6032, 0xf5a04c];
const PAL_ASPEN: Pal5 = [0x42310c, 0x765a16, 0xb48e21, 0xe0bd34, 0xf9e570];

const BARK_OAK: Pal5 = [0x221510, 0x3a261a, 0x583b28, 0x78563c, 0x977352];
const BARK_DARK: Pal5 = [0x1a1210, 0x2e201b, 0x463228, 0x614839, 0x7d614e];
const BARK_REDWOOD: Pal5 = [0x2e130e, 0x4f2218, 0x763626, 0x9d4e36, 0xbe6b4d];
const BARK_BIRCH: Pal5 = [0x1c1e1f, 0x80847e, 0xb8bab2, 0xe2e3d9, 0xf6f7ef];
const BARK_SAKURA: Pal5 = [0x1e1219, 0x36212d, 0x513544, 0x6e4d5d, 0x8c6b7a];
const BARK_BAOBAB: Pal5 = [0x33241f, 0x563e36, 0x7d5e52, 0xa27f70, 0xc1a090];
const BARK_PALM: Pal5 = [0x291d14, 0x493524, 0x6e533a, 0x927254, 0xb3926e];
const BARK_SCOTS: Pal5 = [0x361910, 0x5f2e1d, 0x90482a, 0xbe683b, 0xde8c57];
const BARK_SWAMP: Pal5 = [0x181d1a, 0x2c342e, 0x434d43, 0x5c695b, 0x778574];

const BARK_CHARRED: Pal5 = [0x0f0c0b, 0x1a1514, 0x28211f, 0x3b312e, 0x524642];
const BARK_ASH: Pal5 = [0x141110, 0x221d1b, 0x362f2c, 0x4f4642, 0x6e635f];
const PAL_CHARRED_TWIGS: Pal5 = [0x151110, 0x241a16, 0x382319, 0x522e1d, 0x733e22];

let activeCharredBuild = false;

function hash3i(x: number, y: number, z: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1442695041) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// ============================================================================
// Crisp Micro-Voxel Volume Sculptor + Ultra-Fast Greedy Quad Mesher
// ============================================================================

class VoxelVolume {
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly halfX: number;
  readonly halfZ: number;
  readonly charred: boolean;
  readonly grid: Uint16Array;
  private readonly colorToIdx = new Map<number, number>();
  readonly paletteColors: number[] = [0];

  constructor(sx: number, sy: number, sz: number, charred = activeCharredBuild) {
    this.sx = sx;
    this.sy = sy;
    this.sz = sz;
    this.halfX = Math.floor(sx / 2);
    this.halfZ = Math.floor(sz / 2);
    this.charred = charred;
    this.grid = new Uint16Array(sx * sy * sz);
  }

  private internColor(hexColor: number): number {
    let idx = this.colorToIdx.get(hexColor);
    if (idx === undefined) {
      idx = this.paletteColors.length;
      this.paletteColors.push(hexColor);
      this.colorToIdx.set(hexColor, idx);
    }
    return idx;
  }

  private setRaw(x: number, y: number, z: number, hexColor: number): void {
    const gx = Math.round(x) + this.halfX;
    const gy = Math.round(y);
    const gz = Math.round(z) + this.halfZ;
    if (gx < 0 || gx >= this.sx || gy < 0 || gy >= this.sy || gz < 0 || gz >= this.sz) return;
    this.grid[(gy * this.sz + gz) * this.sx + gx] = this.internColor(hexColor);
  }

  set(x: number, y: number, z: number, hexColor: number): void {
    if (this.charred) return;
    this.setRaw(x, y, z, hexColor);
  }

  atRaw(gx: number, gy: number, gz: number): number {
    if (gx < 0 || gx >= this.sx || gy < 0 || gy >= this.sy || gz < 0 || gz >= this.sz) return 0;
    return this.grid[(gy * this.sz + gz) * this.sx + gx];
  }

  /**
   * Coherent 2-voxel-grouped shading so adjacent coplanar faces share color bands
   * for aggressive greedy quad merging (~5x fewer tris!) while keeping rich multi-tone pixel depth.
   */
  pickShade(pal: Pal5, t: number, x: number, y: number, z: number, seed: number): number {
    const patchNoise = (hash3i(x >> 1, y >> 1, z >> 1, seed) - 0.5) * 0.14;
    const clamped = Math.max(0, Math.min(0.999, t + patchNoise));
    const idx = Math.min(4, Math.max(0, Math.floor(clamped * 5)));
    return pal[idx];
  }

  /** Sculpt a curved, tapered 3D wood trunk, root, or branch */
  drawWoodLimb(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    r0: number,
    r1: number,
    bark: Pal5,
    curveX = 0,
    curveZ = 0,
    seed = 1,
    isBirch = false,
  ): void {
    const effectiveBark = this.charred ? (isBirch ? BARK_ASH : BARK_CHARRED) : bark;
    const dist = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    const steps = Math.max(3, Math.ceil(dist * 2.2));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const arc = Math.sin(t * Math.PI);
      const cx = x0 + (x1 - x0) * t + curveX * arc;
      const cy = y0 + (y1 - y0) * t;
      const cz = z0 + (z1 - z0) * t + curveZ * arc;
      const rad = r0 + (r1 - r0) * t;
      const ri = Math.ceil(rad + 0.4);
      for (let dy = -Math.min(1, ri); dy <= Math.min(1, ri); dy++) {
        for (let dz = -ri; dz <= ri; dz++) {
          for (let dx = -ri; dx <= ri; dx++) {
            const vx = Math.round(cx + dx);
            const vy = Math.round(cy + dy);
            const vz = Math.round(cz + dz);
            const d = Math.hypot(vx - cx, (vy - cy) * 1.15, vz - cz);
            if (d > rad + 0.18) continue;
            const nx = rad > 0.2 ? (vx - cx) / Math.max(0.55, rad) : 0;
            const nz = rad > 0.2 ? (vz - cz) / Math.max(0.55, rad) : 0;
            let shadeT = 0.52 + nx * 0.24 + nz * 0.16;
            if (this.charred) {
              // Smoldering ember cracks along charred bark surfaces
              if (d > rad * 0.6 && vy >= 2 && hash3i(vx, vy, vz, seed + 613) > 0.968) {
                this.setRaw(vx, vy, vz, (vx + vy) % 2 === 0 ? 0xf97316 : 0xea580c);
                continue;
              }
              shadeT = 0.42 + nx * 0.22 + nz * 0.16;
            } else if (isBirch) {
              // Stark charcoal lenticel flecks on chalk-white birch bark
              if (hash3i(vx, vy, vz, seed + 91) > 0.80 && (vy % 2 === 0)) {
                this.setRaw(vx, vy, vz, bark[0]);
                continue;
              }
              shadeT = 0.66 + nx * 0.18 + nz * 0.14;
            }
            this.setRaw(vx, vy, vz, this.pickShade(effectiveBark, shadeT, vx, vy, vz, seed + 7));
          }
        }
      }
    }
  }

  /** Sculpt sprawling 3D gnarled roots gripping the ground around the trunk */
  drawRoots3D(
    cx: number,
    cz: number,
    trunkR: number,
    bark: Pal5,
    count = 5,
    spread = 3.8,
    rootH = 2.8,
    seed = 11,
    mossy = false,
  ): void {
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + hash3i(i, seed, 1, 3) * 0.5;
      const len = spread * (0.76 + hash3i(i, seed, 2, 5) * 0.40);
      const ex = cx + Math.cos(ang) * len;
      const ez = cz + Math.sin(ang) * len;
      const sx = cx + Math.cos(ang) * (trunkR * 0.5);
      const sz = cz + Math.sin(ang) * (trunkR * 0.5);
      this.drawWoodLimb(
        sx,
        rootH,
        sz,
        ex,
        0,
        ez,
        Math.max(0.75, trunkR * 0.56),
        0.48,
        bark,
        Math.cos(ang) * 0.55,
        Math.sin(ang) * 0.55,
        seed + i * 17,
      );
      if (mossy && !this.charred && i % 2 === 0) {
        const mx = Math.round(cx + Math.cos(ang) * len * 0.52);
        const mz = Math.round(cz + Math.sin(ang) * len * 0.52);
        this.setRaw(mx, 1, mz, PAL_OAK[3]);
      }
    }
  }

  /** Sculpt an organic 3D scalloped leaf puff with crisp sunlit upper-left highlights & deep undersides */
  drawLeafCluster3D(
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    pal: Pal5,
    lightBoost = 0,
    seed = 1,
    accentHex?: number,
    accentChance = 0,
  ): void {
    if (this.charred) {
      // Strip lush foliage down to charred inner twigs & sparse singed ember tufts preserving the exact canopy silhouette
      const twigCount = rx >= 4.2 ? 3 : 2;
      for (let i = 0; i < twigCount; i++) {
        const ang = (i / twigCount) * Math.PI * 2 + (seed % 13) * 0.49;
        const tx = cx + Math.cos(ang) * rx * 0.58;
        const tz = cz + Math.sin(ang) * rz * 0.58;
        const ty = cy + (i % 2 === 0 ? ry * 0.25 : -ry * 0.05);
        this.drawWoodLimb(
          cx * 0.85,
          cy - ry * 0.3,
          cz * 0.85,
          tx,
          ty,
          tz,
          0.44,
          0.22,
          i % 2 === 0 ? BARK_CHARRED : BARK_ASH,
          0,
          0,
          seed + 710 + i,
        );
      }
      const cRx = Math.max(1.0, rx * 0.42);
      const cRy = Math.max(0.9, ry * 0.4);
      const cRz = Math.max(1.0, rz * 0.42);
      const minX = Math.floor(cx - cRx);
      const maxX = Math.ceil(cx + cRx);
      const minY = Math.floor(cy - cRy);
      const maxY = Math.ceil(cy + cRy);
      const minZ = Math.floor(cz - cRz);
      const maxZ = Math.ceil(cz + cRz);
      for (let y = minY; y <= maxY; y++) {
        const dy = (y - cy) / Math.max(0.7, cRy);
        for (let z = minZ; z <= maxZ; z++) {
          const dz = (z - cz) / Math.max(0.7, cRz);
          for (let x = minX; x <= maxX; x++) {
            const dx = (x - cx) / Math.max(0.7, cRx);
            const r2 = dx * dx + dy * dy + dz * dz;
            if (r2 > 0.95) continue;
            const n = hash3i(x, y, z, seed + 733);
            if (n > 0.42) continue;
            if (r2 > 0.45 && n < 0.05) {
              this.setRaw(x, y, z, (x + z) % 2 === 0 ? 0xf97316 : 0xea580c);
            } else {
              const shadeT = 0.28 + dy * 0.35 + lightBoost * 0.4;
              this.setRaw(x, y, z, this.pickShade(PAL_CHARRED_TWIGS, shadeT, x, y, z, seed + 741));
            }
          }
        }
      }
      return;
    }

    const minX = Math.floor(cx - rx - 1);
    const maxX = Math.ceil(cx + rx + 1);
    const minY = Math.floor(cy - ry - 1);
    const maxY = Math.ceil(cy + ry + 1);
    const minZ = Math.floor(cz - rz - 1);
    const maxZ = Math.ceil(cz + rz + 1);

    for (let y = minY; y <= maxY; y++) {
      const dy = (y - cy) / Math.max(0.7, ry);
      for (let z = minZ; z <= maxZ; z++) {
        const dz = (z - cz) / Math.max(0.7, rz);
        for (let x = minX; x <= maxX; x++) {
          const dx = (x - cx) / Math.max(0.7, rx);
          const r2 = dx * dx + dy * dy + dz * dz;
          const ang = Math.atan2(dz, dx);
          const scallop =
            0.15 * Math.sin(ang * 4.0 + y * 0.65 + seed) +
            0.09 * Math.cos(ang * 6.0 - seed * 1.3);
          const limit = 1.0 + scallop;
          if (r2 > limit * limit) continue;

          if (
            accentHex !== undefined &&
            r2 > 0.52 &&
            dy > -0.35 &&
            hash3i(x, y, z, seed + 503) < accentChance
          ) {
            this.setRaw(x, y, z, accentHex);
            continue;
          }

          const shadeT =
            0.46 +
            dy * 0.44 +
            dx * 0.15 +
            dz * 0.13 +
            lightBoost +
            (r2 > 0.70 && dy > 0.25 ? 0.12 : 0);
          this.setRaw(x, y, z, this.pickShade(pal, shadeT, x, y, z, seed + 37));
        }
      }
    }
  }

  /** Sculpt a radiating 3D conifer needle-bough whorl (6–8 jagged drooping arms per tier!) */
  drawConiferWhorl3D(
    cx: number,
    yBase: number,
    cz: number,
    radius: number,
    thickness: number,
    arms: number,
    pal: Pal5,
    seed: number,
    snowPal?: Pal5,
    droop = 1.5,
    lightBoost = 0,
  ): void {
    if (this.charred) {
      // Needleless blackened branch ribs along the exact conifer whorl tiers
      for (let a = 0; a < arms; a++) {
        const ang = (a / arms) * Math.PI * 2 + (seed % 11) * 0.37;
        const armLen = radius * (0.72 + hash3i(a, seed, 3, 17) * 0.18);
        const ex = cx + Math.cos(ang) * armLen;
        const ez = cz + Math.sin(ang) * armLen;
        const ey = yBase + thickness * 0.2 - droop * 0.85;
        this.drawWoodLimb(
          cx,
          yBase + thickness * 0.4,
          cz,
          ex,
          ey,
          ez,
          0.44,
          0.2,
          a % 2 === 0 ? BARK_CHARRED : BARK_ASH,
          0,
          0,
          seed + a * 19,
        );
        if ((a + seed) % 3 === 0) {
          this.setRaw(Math.round(ex * 0.88), Math.round(ey + 0.3), Math.round(ez * 0.88), 0xea580c);
        }
      }
      return;
    }

    const coreR = Math.max(1.0, radius * 0.46);
    this.drawLeafCluster3D(cx, yBase + thickness * 0.45, cz, coreR, thickness * 0.65, coreR, pal, lightBoost - 0.08, seed);

    for (let a = 0; a < arms; a++) {
      const ang = (a / arms) * Math.PI * 2 + (seed % 11) * 0.37;
      const armLen = radius * (0.86 + hash3i(a, seed, 3, 17) * 0.24);
      const steps = Math.max(2, Math.ceil(armLen * 1.7));
      const perpX = -Math.sin(ang);
      const perpZ = Math.cos(ang);

      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const dist = armLen * t;
        const px = cx + Math.cos(ang) * dist;
        const pz = cz + Math.sin(ang) * dist;
        const py = yBase + (1 - t) * thickness * 0.68 - Math.pow(t, 1.35) * droop;
        const spreadW = Math.max(0.45, (1 - t * 0.72) * (radius * 0.34));
        const rW = Math.ceil(spreadW);

        for (let w = -rW; w <= rW; w++) {
          if (Math.abs(w) > spreadW + 0.15) continue;
          const vx = Math.round(px + perpX * w);
          const vz = Math.round(pz + perpZ * w);
          const vy = Math.round(py);
          if (t < 0.80 && Math.abs(w) <= Math.max(0, rW - 1)) {
            this.setRaw(vx, vy - 1, vz, pal[0]);
          }
          const needleLight = 0.40 + t * 0.36 + Math.cos(ang - 0.7) * 0.14 + lightBoost;
          this.setRaw(vx, vy, vz, this.pickShade(pal, needleLight, vx, vy, vz, seed + a * 13));
          if (snowPal && (t > 0.24 || hash3i(vx, vy, vz, seed + 89) > 0.4)) {
            const snowLight = 0.62 + t * 0.28 + lightBoost * 0.4;
            this.setRaw(vx, vy + 1, vz, this.pickShade(snowPal, snowLight, vx, vy + 1, vz, seed + 101));
          }
        }
      }
    }
  }

  /** Sculpt a sweeping 3D arched feathered palm frond */
  drawPalmFrond3D(
    ox: number,
    oy: number,
    oz: number,
    ang: number,
    len: number,
    rise: number,
    droop: number,
    pal: Pal5,
    seed: number,
  ): void {
    const dirX = Math.cos(ang);
    const dirZ = Math.sin(ang);
    const perpX = -dirZ;
    const perpZ = dirX;
    const steps = Math.max(5, Math.ceil(len * 1.8));
    const maxStep = this.charred ? Math.max(3, Math.floor(steps * 0.78)) : steps;
    for (let s = 1; s <= maxStep; s++) {
      const t = s / steps;
      const cx = ox + dirX * len * t;
      const cz = oz + dirZ * len * t;
      const cy = oy + Math.sin(t * Math.PI * 0.72) * rise - t * t * droop;
      const vx = Math.round(cx);
      const vy = Math.round(cy);
      const vz = Math.round(cz);
      if (this.charred) {
        const color =
          s === maxStep && seed % 2 === 0
            ? 0xea580c
            : this.pickShade(BARK_CHARRED, 0.55 - t * 0.25, vx, vy, vz, seed);
        this.setRaw(vx, vy, vz, color);
        continue;
      }
      this.setRaw(vx, vy, vz, this.pickShade(pal, 0.70 - t * 0.24, vx, vy, vz, seed));
      const wingSpan = Math.sin(t * Math.PI) * 1.5;
      if (wingSpan >= 0.6) {
        const wMax = Math.round(wingSpan);
        for (let side = -1; side <= 1; side += 2) {
          for (let w = 1; w <= wMax; w++) {
            const lx = Math.round(cx + perpX * side * w);
            const lz = Math.round(cz + perpZ * side * w);
            const ly = Math.round(cy - (w > 1 ? 1 : 0));
            this.setRaw(lx, ly, lz, this.pickShade(pal, 0.56 - w * 0.15 - t * 0.15, lx, ly, lz, seed + 19));
          }
        }
      }
    }
  }

  /** Sculpt a 1-voxel-thick vertical hanging strand (willow fronds, Spanish moss, sakura garlands, lianas) */
  drawHangingStrand3D(
    x: number,
    yTop: number,
    z: number,
    len: number,
    pal: Pal5,
    seed: number,
  ): void {
    const effectiveLen = this.charred ? Math.min(2, len) : len;
    const effectivePal = this.charred ? BARK_ASH : pal;
    for (let i = 0; i < effectiveLen; i++) {
      const t = i / Math.max(1, effectiveLen - 1);
      const vy = Math.round(yTop - i);
      if (vy < 1) break;
      this.setRaw(x, vy, z, this.pickShade(effectivePal, 0.62 - t * 0.34, x, vy, z, seed));
    }
  }

  /**
   * Hidden-face-culled + 2D greedy-merged BufferGeometry with baked 3D voxel crevice AO.
   * Keeps every tree ultra-lightweight (~400–950 tris) for silky-smooth instanced rendering!
   */
  toGreedyBufferGeometry(voxelSize: number): THREE.BufferGeometry {
    const { sx, sy, sz, halfX, halfZ } = this;
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const tmpColor = new THREE.Color();

    // 2-level crevice AO (0 = open, 1 = recessed nook) maximizes greedy quad runs while preserving crisp dark creases!
    const computeCreviceAO = (
      gx: number,
      gy: number,
      gz: number,
      nx: number,
      ny: number,
      nz: number,
    ): number => {
      const ax = gx + nx;
      const ay = gy + ny;
      const az = gz + nz;
      let occ = 0;
      if (nx !== 0) {
        if (this.atRaw(ax, ay + 1, az)) occ++;
        if (this.atRaw(ax, ay - 1, az)) occ++;
        if (this.atRaw(ax, ay, az + 1)) occ++;
        if (this.atRaw(ax, ay, az - 1)) occ++;
      } else if (ny !== 0) {
        if (this.atRaw(ax + 1, ay, az)) occ++;
        if (this.atRaw(ax - 1, ay, az)) occ++;
        if (this.atRaw(ax, ay, az + 1)) occ++;
        if (this.atRaw(ax, ay, az - 1)) occ++;
      } else {
        if (this.atRaw(ax + 1, ay, az)) occ++;
        if (this.atRaw(ax - 1, ay, az)) occ++;
        if (this.atRaw(ax, ay + 1, az)) occ++;
        if (this.atRaw(ax, ay - 1, az)) occ++;
      }
      return occ >= 2 ? 1 : 0;
    };

    const AO_MULT = [1.0, 0.74];
    const FACE_SHADE: Record<string, number> = {
      '+y': 1.08,
      '-y': 0.54,
      '+x': 0.96,
      '-x': 0.78,
      '+z': 0.92,
      '-z': 0.74,
    };

    const dims = [sx, sy, sz];
    // Isometric top-down camera never views trees from below ground, so -y underside faces are 100% invisible.
    const dirs: [number, number, string][] = [
      [0, 1, '+x'],
      [0, -1, '-x'],
      [1, 1, '+y'],
      [2, 1, '+z'],
      [2, -1, '-z'],
    ];

    for (const [d, sign, key] of dirs) {
      const u = (d + 1) % 3;
      const v = (d + 2) % 3;
      const dimD = dims[d];
      const dimU = dims[u];
      const dimV = dims[v];
      const mask = new Int32Array(dimU * dimV);
      const nVec = [0, 0, 0];
      nVec[d] = sign;
      const faceMult = FACE_SHADE[key];

      for (let slice = 0; slice < dimD; slice++) {
        let anyFace = false;
        const coord = [0, 0, 0];
        coord[d] = slice;
        const nCoord = [0, 0, 0];
        nCoord[d] = slice + sign;

        for (let iv = 0; iv < dimV; iv++) {
          coord[v] = iv;
          nCoord[v] = iv;
          for (let iu = 0; iu < dimU; iu++) {
            coord[u] = iu;
            nCoord[u] = iu;
            const cIdx = this.atRaw(coord[0], coord[1], coord[2]);
            if (cIdx === 0 || this.atRaw(nCoord[0], nCoord[1], nCoord[2]) !== 0) {
              mask[iv * dimU + iu] = 0;
            } else if (d === 1 && sign === -1 && slice === 0) {
              mask[iv * dimU + iu] = 0;
            } else {
              const ao = computeCreviceAO(coord[0], coord[1], coord[2], nVec[0], nVec[1], nVec[2]);
              mask[iv * dimU + iu] = (cIdx << 2) | ao;
              anyFace = true;
            }
          }
        }
        if (!anyFace) continue;

        for (let iv = 0; iv < dimV; iv++) {
          for (let iu = 0; iu < dimU; ) {
            const mKey = mask[iv * dimU + iu];
            if (mKey === 0) {
              iu++;
              continue;
            }
            let w = 1;
            while (iu + w < dimU && mask[iv * dimU + iu + w] === mKey) w++;
            let h = 1;
            outer: while (iv + h < dimV) {
              for (let k = 0; k < w; k++) {
                if (mask[(iv + h) * dimU + iu + k] !== mKey) break outer;
              }
              h++;
            }

            for (let dh = 0; dh < h; dh++) {
              for (let dw = 0; dw < w; dw++) {
                mask[(iv + dh) * dimU + iu + dw] = 0;
              }
            }

            const cIdx = mKey >> 2;
            const aoLevel = mKey & 3;
            tmpColor.setHex(this.paletteColors[cIdx]);
            const shade = faceMult * AO_MULT[aoLevel];
            const cr = Math.min(1, tmpColor.r * shade);
            const cg = Math.min(1, tmpColor.g * shade);
            const cb = Math.min(1, tmpColor.b * shade);

            const planeD = slice + (sign > 0 ? 1 : 0);
            const p0 = [0, 0, 0];
            const p1 = [0, 0, 0];
            const p2 = [0, 0, 0];
            const p3 = [0, 0, 0];

            p0[d] = planeD; p0[u] = iu;     p0[v] = iv;
            p1[d] = planeD; p1[u] = iu + w; p1[v] = iv;
            p2[d] = planeD; p2[u] = iu + w; p2[v] = iv + h;
            p3[d] = planeD; p3[u] = iu;     p3[v] = iv + h;

            const vBase = positions.length / 3;
            const quadVerts = sign > 0 ? [p0, p1, p2, p3] : [p0, p3, p2, p1];
            for (let q = 0; q < 4; q++) {
              const pt = quadVerts[q];
              positions.push(
                (pt[0] - halfX - 0.5) * voxelSize,
                pt[1] * voxelSize,
                (pt[2] - halfZ - 0.5) * voxelSize,
              );
              normals.push(nVec[0], nVec[1], nVec[2]);
              colors.push(cr, cg, cb);
            }
            indices.push(vBase, vBase + 1, vBase + 2, vBase, vBase + 2, vBase + 3);
            iu += w;
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }

  /**
   * Generates a geometrically simplified LOD (step=2 mid-zoom, step=3 far-zoom) anchored to the exact
   * tree trunk origin with preserved silhouettes, trunk continuity, and palette tones.
   */
  toDownsampledGreedyBufferGeometry(
    origVoxelSize: number,
    step: 2 | 3 | 4,
    simplifyShading = false,
  ): THREE.BufferGeometry {
    const { sx, sy, sz, halfX, halfZ } = this;
    const halfStep = Math.floor(step / 2);
    const mHalfX = Math.ceil((halfX + halfStep) / step);
    const mHalfZ = Math.ceil((halfZ + halfStep) / step);
    const baseGx = halfX - halfStep - mHalfX * step;
    const baseGz = halfZ - halfStep - mHalfZ * step;
    const msx = mHalfX + 1 + Math.ceil((sx - (halfX - halfStep + step)) / step);
    const msy = Math.ceil(sy / step);
    const msz = mHalfZ + 1 + Math.ceil((sz - (halfZ - halfStep + step)) / step);

    const macroGrid = new Uint16Array(msx * msy * msz);
    const minOcc = step === 2 ? 2 : step === 3 ? 5 : 11;
    const counts = new Uint16Array(this.paletteColors.length);
    const touched: number[] = [];
    const stemStemLimitY = Math.ceil(msy * 0.72);
    const rawColorFreq = new Uint32Array(this.paletteColors.length);

    for (let my = 0; my < msy; my++) {
      const gy0 = my * step;
      for (let mz = 0; mz < msz; mz++) {
        const gz0 = baseGz + mz * step;
        for (let mx = 0; mx < msx; mx++) {
          const gx0 = baseGx + mx * step;
          let filled = 0;
          let yLayerMask = 0;
          let bestC = 0;
          let bestCount = 0;
          touched.length = 0;

          for (let dy = 0; dy < step; dy++) {
            const gy = gy0 + dy;
            if (gy < 0 || gy >= sy) continue;
            let rowHit = false;
            for (let dz = 0; dz < step; dz++) {
              const gz = gz0 + dz;
              if (gz < 0 || gz >= sz) continue;
              for (let dx = 0; dx < step; dx++) {
                const gx = gx0 + dx;
                if (gx < 0 || gx >= sx) continue;
                const c = this.grid[(gy * sz + gz) * sx + gx];
                if (c !== 0) {
                  filled++;
                  rowHit = true;
                  if (counts[c] === 0) touched.push(c);
                  counts[c]++;
                  if (counts[c] > bestCount) {
                    bestCount = counts[c];
                    bestC = c;
                  }
                }
              }
            }
            if (rowHit) yLayerMask |= 1 << dy;
          }

          for (let ti = 0; ti < touched.length; ti++) counts[touched[ti]] = 0;

          if (filled === 0) continue;
          let yHits = 0;
          for (let b = 0; b < step; b++) {
            if (yLayerMask & (1 << b)) yHits++;
          }
          const nearBase = my === 0 && Math.abs(mx - mHalfX) <= 1 && Math.abs(mz - mHalfZ) <= 1;
          const verticalStem =
            yHits >= (step >= 4 ? 3 : 2) &&
            my <= stemStemLimitY &&
            Math.abs(mx - mHalfX) <= 1 &&
            Math.abs(mz - mHalfZ) <= 1;
          if (filled >= minOcc || nearBase || verticalStem) {
            macroGrid[(my * msz + mz) * msx + mx] = bestC;
            rawColorFreq[bestC]++;
          }
        }
      }
    }

    const macroPalette: number[] = this.paletteColors.slice();
    if (simplifyShading) {
      // Cluster raw palette entries to their nearest frequent representative in exact RGB space
      // so zero bitwise hue distortion occurs while maximizing greedy quad merges on far zoom.
      const colorOrder: number[] = [];
      for (let c = 1; c < macroPalette.length; c++) {
        if (rawColorFreq[c] > 0) colorOrder.push(c);
      }
      colorOrder.sort((a, b) => rawColorFreq[b] - rawColorFreq[a]);

      const distSqLimit = step >= 4 ? 62 * 62 : 34 * 34;
      const reps: number[] = [];
      const remap = new Uint16Array(macroPalette.length);
      for (const c of colorOrder) {
        const hex = macroPalette[c];
        const r = (hex >> 16) & 0xff;
        const g = (hex >> 8) & 0xff;
        const b = hex & 0xff;
        let mapped = 0;
        let bestDist = distSqLimit;
        for (const rep of reps) {
          const rHex = macroPalette[rep];
          const dr = r - ((rHex >> 16) & 0xff);
          const dg = g - ((rHex >> 8) & 0xff);
          const db = b - (rHex & 0xff);
          const d2 = dr * dr + dg * dg + db * db;
          if (d2 <= bestDist) {
            bestDist = d2;
            mapped = rep;
          }
        }
        if (mapped === 0) {
          reps.push(c);
          remap[c] = c;
        } else {
          remap[c] = mapped;
        }
      }
      for (let i = 0; i < macroGrid.length; i++) {
        const c = macroGrid[i];
        if (c !== 0) macroGrid[i] = remap[c];
      }
    }

    const atMacro = (gx: number, gy: number, gz: number): number => {
      if (gx < 0 || gx >= msx || gy < 0 || gy >= msy || gz < 0 || gz >= msz) return 0;
      return macroGrid[(gy * msz + gz) * msx + gx];
    };

    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const tmpColor = new THREE.Color();
    const AO_MULT = [1.0, 0.78];
    const FACE_SHADE: Record<string, number> = {
      '+y': 1.08,
      '-y': 0.54,
      '+x': 0.96,
      '-x': 0.78,
      '+z': 0.92,
      '-z': 0.74,
    };
    const dims = [msx, msy, msz];
    // Isometric top-down camera never views trees from below ground, so -y underside faces are 100% invisible.
    const dirs: [number, number, string][] = [
      [0, 1, '+x'],
      [0, -1, '-x'],
      [1, 1, '+y'],
      [2, 1, '+z'],
      [2, -1, '-z'],
    ];

    for (const [d, sign, key] of dirs) {
      const u = (d + 1) % 3;
      const v = (d + 2) % 3;
      const dimD = dims[d];
      const dimU = dims[u];
      const dimV = dims[v];
      const mask = new Int32Array(dimU * dimV);
      const nVec = [0, 0, 0];
      nVec[d] = sign;
      const faceMult = FACE_SHADE[key];

      for (let slice = 0; slice < dimD; slice++) {
        let anyFace = false;
        const coord = [0, 0, 0];
        coord[d] = slice;
        const nCoord = [0, 0, 0];
        nCoord[d] = slice + sign;

        for (let iv = 0; iv < dimV; iv++) {
          coord[v] = iv;
          nCoord[v] = iv;
          for (let iu = 0; iu < dimU; iu++) {
            coord[u] = iu;
            nCoord[u] = iu;
            const cIdx = atMacro(coord[0], coord[1], coord[2]);
            if (cIdx === 0 || atMacro(nCoord[0], nCoord[1], nCoord[2]) !== 0) {
              mask[iv * dimU + iu] = 0;
            } else if (d === 1 && sign === -1 && slice === 0) {
              mask[iv * dimU + iu] = 0;
            } else {
              let ao = 0;
              if (!simplifyShading) {
                const ax = coord[0] + nVec[0];
                const ay = coord[1] + nVec[1];
                const az = coord[2] + nVec[2];
                let occ = 0;
                if (nVec[0] !== 0) {
                  if (atMacro(ax, ay + 1, az)) occ++;
                  if (atMacro(ax, ay - 1, az)) occ++;
                  if (atMacro(ax, ay, az + 1)) occ++;
                  if (atMacro(ax, ay, az - 1)) occ++;
                } else if (nVec[1] !== 0) {
                  if (atMacro(ax + 1, ay, az)) occ++;
                  if (atMacro(ax - 1, ay, az)) occ++;
                  if (atMacro(ax, ay, az + 1)) occ++;
                  if (atMacro(ax, ay, az - 1)) occ++;
                } else {
                  if (atMacro(ax + 1, ay, az)) occ++;
                  if (atMacro(ax - 1, ay, az)) occ++;
                  if (atMacro(ax, ay + 1, az)) occ++;
                  if (atMacro(ax, ay - 1, az)) occ++;
                }
                if (occ >= 2) ao = 1;
              }
              mask[iv * dimU + iu] = (cIdx << 2) | ao;
              anyFace = true;
            }
          }
        }
        if (!anyFace) continue;

        for (let iv = 0; iv < dimV; iv++) {
          for (let iu = 0; iu < dimU; ) {
            const mKey = mask[iv * dimU + iu];
            if (mKey === 0) {
              iu++;
              continue;
            }
            let w = 1;
            while (iu + w < dimU && mask[iv * dimU + iu + w] === mKey) w++;
            let h = 1;
            outer: while (iv + h < dimV) {
              for (let k = 0; k < w; k++) {
                if (mask[(iv + h) * dimU + iu + k] !== mKey) break outer;
              }
              h++;
            }

            for (let dh = 0; dh < h; dh++) {
              for (let dw = 0; dw < w; dw++) {
                mask[(iv + dh) * dimU + iu + dw] = 0;
              }
            }

            const cIdx = mKey >> 2;
            const aoLevel = mKey & 3;
            tmpColor.setHex(macroPalette[cIdx]);
            const shade = faceMult * AO_MULT[aoLevel];
            const cr = Math.min(1, tmpColor.r * shade);
            const cg = Math.min(1, tmpColor.g * shade);
            const cb = Math.min(1, tmpColor.b * shade);

            const planeD = slice + (sign > 0 ? 1 : 0);
            const p0 = [0, 0, 0];
            const p1 = [0, 0, 0];
            const p2 = [0, 0, 0];
            const p3 = [0, 0, 0];

            p0[d] = planeD; p0[u] = iu;     p0[v] = iv;
            p1[d] = planeD; p1[u] = iu + w; p1[v] = iv;
            p2[d] = planeD; p2[u] = iu + w; p2[v] = iv + h;
            p3[d] = planeD; p3[u] = iu;     p3[v] = iv + h;

            const vBase = positions.length / 3;
            const quadVerts = sign > 0 ? [p0, p1, p2, p3] : [p0, p3, p2, p1];
            for (let q = 0; q < 4; q++) {
              const pt = quadVerts[q];
              positions.push(
                (baseGx + pt[0] * step - halfX - 0.5) * origVoxelSize,
                pt[1] * step * origVoxelSize,
                (baseGz + pt[2] * step - halfZ - 0.5) * origVoxelSize,
              );
              normals.push(nVec[0], nVec[1], nVec[2]);
              colors.push(cr, cg, cb);
            }
            indices.push(vBase, vBase + 1, vBase + 2, vBase, vBase + 2, vBase + 3);
            iu += w;
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }
}

// ============================================================================
// 32 Sculpted 3D Micro-Voxel Tree Species Across All 8 Biomes
// ============================================================================

const SPECIES_SPECS: VoxelTreeSpeciesSpec[] = [
  // Woodland Forest (5 distinct silhouettes matching reference woodland)
  { id: 'forest_oak', biome: 'forest', name: 'Ancient Gnarled Oak', voxelSize: 0.057, heightBias: 1.0, widthBias: 1.08 },
  { id: 'forest_pine', biome: 'forest', name: 'Feathered Woodland Pine', voxelSize: 0.055, heightBias: 1.24, widthBias: 0.92 },
  { id: 'forest_birch', biome: 'forest', name: 'Silver Forest Birch', voxelSize: 0.054, heightBias: 1.12, widthBias: 0.88 },
  { id: 'forest_redwood', biome: 'forest', name: 'Giant Woodland Redwood', voxelSize: 0.059, heightBias: 1.44, widthBias: 1.02 },
  { id: 'forest_maple', biome: 'forest', name: 'Autumn Woodland Maple', voxelSize: 0.055, heightBias: 0.96, widthBias: 1.04 },

  // Meadow (grass / fertile)
  { id: 'meadow_willow', biome: 'meadow', name: 'Weeping Meadow Willow', voxelSize: 0.056, heightBias: 0.96, widthBias: 1.12 },
  { id: 'meadow_orchard', biome: 'meadow', name: 'Orchard Apple Tree', voxelSize: 0.052, heightBias: 0.84, widthBias: 0.98 },
  { id: 'meadow_poplar', biome: 'meadow', name: 'Lombardy Poplar Spire', voxelSize: 0.055, heightBias: 1.28, widthBias: 0.78 },

  // Jungle
  { id: 'jungle_kapok', biome: 'jungle', name: 'Emergent Kapok Giant', voxelSize: 0.059, heightBias: 1.38, widthBias: 1.18 },
  { id: 'jungle_palm', biome: 'jungle', name: 'Arched Coconut Palm', voxelSize: 0.056, heightBias: 1.16, widthBias: 1.02 },
  { id: 'jungle_banyan', biome: 'jungle', name: 'Strangler Banyan Fig', voxelSize: 0.057, heightBias: 1.04, widthBias: 1.16 },
  { id: 'jungle_fanpalm', biome: 'jungle', name: 'Twin Jungle Fan Palms', voxelSize: 0.054, heightBias: 0.98, widthBias: 1.00 },

  // Taiga / Tundra / Snow
  { id: 'taiga_spruce', biome: 'taiga', name: 'Snow-Laden Boreal Spruce', voxelSize: 0.056, heightBias: 1.26, widthBias: 0.94 },
  { id: 'taiga_fir', biome: 'taiga', name: 'Frosty Subalpine Fir', voxelSize: 0.057, heightBias: 1.44, widthBias: 0.78 },
  { id: 'taiga_larch', biome: 'taiga', name: 'Golden Siberian Larch', voxelSize: 0.055, heightBias: 1.12, widthBias: 0.90 },
  { id: 'taiga_snowpine', biome: 'taiga', name: 'Ancient Snow-Capped Pine', voxelSize: 0.055, heightBias: 0.92, widthBias: 1.10 },

  // Sakura Blossom
  { id: 'blossom_sakura', biome: 'blossom', name: 'Imperial Weeping Sakura', voxelSize: 0.057, heightBias: 1.02, widthBias: 1.14 },
  { id: 'blossom_bonsai', biome: 'blossom', name: 'Windswept Bonsai Cherry', voxelSize: 0.054, heightBias: 0.86, widthBias: 1.10 },
  { id: 'blossom_pagoda', biome: 'blossom', name: 'Pagoda Blossom Cherry', voxelSize: 0.056, heightBias: 1.20, widthBias: 0.96 },
  { id: 'blossom_plum', biome: 'blossom', name: 'White-Petal Plum Tree', voxelSize: 0.052, heightBias: 0.90, widthBias: 0.96 },

  // Savanna / Badlands / Sand
  { id: 'savanna_acacia', biome: 'savanna', name: 'Flat-Topped Umbrella Acacia', voxelSize: 0.057, heightBias: 0.98, widthBias: 1.24 },
  { id: 'savanna_baobab', biome: 'savanna', name: 'Colossal African Baobab', voxelSize: 0.060, heightBias: 1.16, widthBias: 1.14 },
  { id: 'savanna_thorn', biome: 'savanna', name: 'Twin Steppe Thorn Acacia', voxelSize: 0.054, heightBias: 0.84, widthBias: 1.08 },
  { id: 'savanna_datepalm', biome: 'savanna', name: 'Desert Oasis Date Palm', voxelSize: 0.056, heightBias: 1.14, widthBias: 0.96 },

  // Swamp
  { id: 'swamp_cypress', biome: 'swamp', name: 'Bayou Bald Cypress', voxelSize: 0.057, heightBias: 1.24, widthBias: 1.10 },
  { id: 'swamp_mangrove', biome: 'swamp', name: 'Stilt-Root Marsh Mangrove', voxelSize: 0.055, heightBias: 0.92, widthBias: 1.08 },
  { id: 'swamp_bogwillow', biome: 'swamp', name: 'Twisted Bog Willow', voxelSize: 0.055, heightBias: 0.88, widthBias: 1.08 },
  { id: 'swamp_ancient', biome: 'swamp', name: 'Moss-Draped Swamp Cypress', voxelSize: 0.056, heightBias: 1.10, widthBias: 1.00 },

  // Highland / Mountain / Rock
  { id: 'highland_scotspine', biome: 'highland', name: 'Caledonian Scots Pine', voxelSize: 0.057, heightBias: 1.08, widthBias: 1.06 },
  { id: 'highland_rowan', biome: 'highland', name: 'Highland Crimson Rowan', voxelSize: 0.053, heightBias: 0.92, widthBias: 0.96 },
  { id: 'highland_aspen', biome: 'highland', name: 'Golden Quaking Aspen', voxelSize: 0.055, heightBias: 1.22, widthBias: 0.88 },
  { id: 'highland_krummholz', biome: 'highland', name: 'Alpine Crag Krummholz', voxelSize: 0.053, heightBias: 0.74, widthBias: 1.08 },
];

function buildVoxelTreeLods(
  spec: VoxelTreeSpeciesSpec,
  charred = false,
): [THREE.BufferGeometry, THREE.BufferGeometry, THREE.BufferGeometry, THREE.BufferGeometry] {
  const prevCharred = activeCharredBuild;
  activeCharredBuild = charred;
  try {
    const vol = buildVoxelTreeVolumeInner(spec);
    return [
      vol.toGreedyBufferGeometry(spec.voxelSize),
      vol.toDownsampledGreedyBufferGeometry(spec.voxelSize, 2, false),
      vol.toDownsampledGreedyBufferGeometry(spec.voxelSize, 3, true),
      vol.toDownsampledGreedyBufferGeometry(spec.voxelSize, 4, true),
    ];
  } finally {
    activeCharredBuild = prevCharred;
  }
}

function buildVoxelTreeVolumeInner(spec: VoxelTreeSpeciesSpec): VoxelVolume {
  switch (spec.id) {
    // ------------------------------------------------------------------------
    // WOODLAND FOREST
    // ------------------------------------------------------------------------
    case 'forest_oak': {
      // Ancient Gnarled Oak — wide sprawling 3D roots, forked structural limbs, layered dithered leaf puffs
      const v = new VoxelVolume(19, 22, 19);
      v.drawRoots3D(0, 0, 1.7, BARK_OAK, 6, 4.6, 3.0, 10, true);
      v.drawWoodLimb(0, 0, 0, -0.3, 8.8, 0.2, 1.65, 1.15, BARK_OAK, -0.5, 0.3, 11);
      v.drawWoodLimb(0, 7.2, 0, -4.5, 11.8, -1.6, 0.95, 0.55, BARK_OAK, -0.8, -0.3, 12);
      v.drawWoodLimb(0, 7.2, 0, 4.5, 11.8, 1.6, 0.95, 0.55, BARK_OAK, 0.8, 0.3, 13);
      v.drawWoodLimb(0, 8.0, 0, -1.0, 12.2, 4.4, 0.9, 0.55, BARK_OAK, -0.2, 0.8, 14);
      v.drawWoodLimb(0, 8.0, 0, 1.4, 12.2, -4.4, 0.9, 0.55, BARK_OAK, 0.3, -0.8, 15);
      // Shaded under-canopy core + 7 distinct sculpted overlapping leaf clouds
      v.drawLeafCluster3D(0, 13.0, 0, 5.4, 3.4, 5.4, PAL_OAK, -0.18, 20);
      v.drawLeafCluster3D(-4.6, 12.2, -1.8, 3.4, 2.7, 3.4, PAL_OAK, 0.04, 21);
      v.drawLeafCluster3D(4.6, 12.2, 1.6, 3.3, 2.6, 3.3, PAL_OAK, -0.06, 22);
      v.drawLeafCluster3D(-1.2, 12.8, 4.4, 3.4, 2.6, 3.2, PAL_OAK, 0.02, 23);
      v.drawLeafCluster3D(1.5, 12.8, -4.2, 3.2, 2.5, 3.2, PAL_OAK, -0.08, 24);
      v.drawLeafCluster3D(-2.6, 15.8, 1.6, 3.6, 2.8, 3.6, PAL_OAK, 0.18, 25);
      v.drawLeafCluster3D(3.0, 15.5, -1.6, 3.4, 2.7, 3.4, PAL_OAK, 0.12, 26);
      v.drawLeafCluster3D(0.2, 17.8, 0.3, 3.8, 2.8, 3.8, PAL_OAK, 0.26, 27);
      return v;
    }

    case 'forest_pine': {
      // Tall Feathered Woodland Pine — 7 radiating drooping serrated needle whorls + exposed dark lower trunk
      const v = new VoxelVolume(17, 29, 17);
      v.drawRoots3D(0, 0, 1.1, BARK_DARK, 4, 2.8, 2.2, 30, true);
      v.drawWoodLimb(0, 0, 0, 0, 25, 0, 1.1, 0.45, BARK_DARK, 0.15, -0.1, 31);
      v.drawWoodLimb(0, 3.2, 0, 2.4, 2.8, 0.8, 0.45, 0.3, BARK_DARK, 0, 0, 32);
      v.drawWoodLimb(0, 4.8, 0, -2.2, 4.2, -1.0, 0.45, 0.3, BARK_DARK, 0, 0, 33);
      const whorls = [
        { y: 6.5, r: 6.8, th: 2.0, arms: 7, d: 1.6, lb: -0.08 },
        { y: 10.0, r: 6.2, th: 1.9, arms: 7, d: 1.5, lb: -0.03 },
        { y: 13.5, r: 5.4, th: 1.8, arms: 6, d: 1.3, lb: 0.03 },
        { y: 16.8, r: 4.5, th: 1.7, arms: 6, d: 1.1, lb: 0.09 },
        { y: 20.0, r: 3.5, th: 1.6, arms: 5, d: 0.9, lb: 0.15 },
        { y: 23.0, r: 2.5, th: 1.5, arms: 5, d: 0.6, lb: 0.22 },
      ];
      for (let i = 0; i < whorls.length; i++) {
        const w = whorls[i];
        v.drawConiferWhorl3D(0, w.y, 0, w.r, w.th, w.arms, PAL_PINE, 40 + i * 7, undefined, w.d, w.lb);
      }
      v.set(0, 26, 0, PAL_PINE[3]);
      v.set(0, 27, 0, PAL_PINE[4]);
      return v;
    }

    case 'forest_birch': {
      // Silver Forest Birch — chalk-white bark with black horizontal lenticels + airy golden-lime foliage
      const v = new VoxelVolume(15, 27, 15);
      v.drawRoots3D(0, 0, 1.0, BARK_BIRCH, 4, 2.8, 2.2, 50, true);
      v.drawWoodLimb(0, 0, 0, 0.4, 17, -0.3, 1.05, 0.6, BARK_BIRCH, -0.7, 0.4, 51, true);
      v.drawWoodLimb(0, 11, 0, -3.4, 16.5, 1.8, 0.6, 0.4, BARK_BIRCH, -0.4, 0.3, 52, true);
      v.drawWoodLimb(0, 12.5, 0, 3.4, 18.2, -1.8, 0.6, 0.4, BARK_BIRCH, 0.4, -0.3, 53, true);
      v.drawLeafCluster3D(-3.2, 16.5, 1.8, 3.1, 2.8, 3.1, PAL_BIRCH_LEAF, 0.04, 54);
      v.drawLeafCluster3D(3.2, 17.8, -1.6, 3.1, 2.8, 3.1, PAL_BIRCH_LEAF, 0.08, 55);
      v.drawLeafCluster3D(0.4, 19.0, 2.2, 3.3, 3.0, 3.0, PAL_BIRCH_LEAF, 0.14, 56);
      v.drawLeafCluster3D(-0.8, 21.2, -1.2, 3.4, 3.1, 3.3, PAL_BIRCH_LEAF, 0.20, 57);
      v.drawLeafCluster3D(0.2, 23.5, 0.2, 2.8, 2.5, 2.8, PAL_BIRCH_LEAF, 0.26, 58);
      return v;
    }

    case 'forest_redwood': {
      // Giant Woodland Redwood — massive fluted cinnamon trunk soaring into high emerald spire tiers
      const v = new VoxelVolume(19, 34, 19);
      v.drawRoots3D(0, 0, 2.3, BARK_REDWOOD, 6, 4.8, 4.5, 60, true);
      v.drawWoodLimb(0, 0, 0, 0, 30, 0, 2.2, 0.65, BARK_REDWOOD, 0.15, 0.1, 61);
      const whorls = [
        { y: 13.0, r: 7.2, th: 2.2, arms: 8, d: 1.5, lb: -0.08 },
        { y: 17.2, r: 6.5, th: 2.1, arms: 7, d: 1.4, lb: -0.02 },
        { y: 21.0, r: 5.6, th: 2.0, arms: 7, d: 1.3, lb: 0.06 },
        { y: 24.5, r: 4.5, th: 1.8, arms: 6, d: 1.0, lb: 0.12 },
        { y: 27.6, r: 3.3, th: 1.6, arms: 5, d: 0.8, lb: 0.18 },
        { y: 30.2, r: 2.0, th: 1.4, arms: 4, d: 0.5, lb: 0.24 },
      ];
      for (let i = 0; i < whorls.length; i++) {
        const w = whorls[i];
        v.drawConiferWhorl3D(0, w.y, 0, w.r, w.th, w.arms, PAL_REDWOOD, 65 + i * 7, undefined, w.d, w.lb);
      }
      v.set(0, 32, 0, PAL_REDWOOD[4]);
      return v;
    }

    case 'forest_maple': {
      // Autumn Woodland Maple — fiery crimson, burnt-amber & golden-ochre voxel leaf clouds
      const v = new VoxelVolume(17, 22, 17);
      v.drawRoots3D(0, 0, 1.5, BARK_OAK, 5, 4.0, 2.8, 70, false);
      v.drawWoodLimb(0, 0, 0, 0.2, 9.0, -0.2, 1.45, 0.95, BARK_OAK, 0.5, -0.3, 71);
      v.drawWoodLimb(0, 7.5, 0, -3.8, 12.0, 1.5, 0.85, 0.5, BARK_OAK, -0.6, 0.3, 72);
      v.drawWoodLimb(0, 7.5, 0, 3.8, 12.0, -1.5, 0.85, 0.5, BARK_OAK, 0.6, -0.3, 73);
      v.drawLeafCluster3D(0, 13.5, 0, 5.0, 3.2, 5.0, PAL_MAPLE, -0.14, 75);
      v.drawLeafCluster3D(-3.8, 12.8, 1.6, 3.3, 2.6, 3.3, PAL_MAPLE, 0.08, 76);
      v.drawLeafCluster3D(3.8, 12.8, -1.5, 3.3, 2.6, 3.3, PAL_MAPLE, -0.04, 77);
      v.drawLeafCluster3D(0.8, 13.5, 3.8, 3.1, 2.5, 3.1, PAL_MAPLE, 0.04, 78);
      v.drawLeafCluster3D(-1.0, 13.5, -3.8, 3.1, 2.5, 3.1, PAL_MAPLE, 0.02, 79);
      v.drawLeafCluster3D(-1.8, 16.5, 0.8, 3.4, 2.7, 3.4, PAL_MAPLE, 0.20, 80);
      v.drawLeafCluster3D(2.0, 16.5, -0.8, 3.3, 2.7, 3.3, PAL_MAPLE, 0.16, 81);
      v.drawLeafCluster3D(0, 18.5, 0, 3.1, 2.3, 3.1, PAL_MAPLE, 0.26, 82);
      return v;
    }

    // ------------------------------------------------------------------------
    // MEADOW (GRASS / FERTILE)
    // ------------------------------------------------------------------------
    case 'meadow_willow': {
      // Weeping Meadow Willow — curved trunk, broad lush dome & 360° cascading willow curtains
      const v = new VoxelVolume(19, 22, 19);
      v.drawRoots3D(0, 0, 1.6, BARK_OAK, 5, 4.2, 3.0, 85, true);
      v.drawWoodLimb(0, 0, 0, -0.9, 10.5, 0.4, 1.55, 1.0, BARK_OAK, -0.9, 0.4, 86);
      v.drawWoodLimb(-0.8, 9.0, 0, -4.6, 13.0, -1.5, 0.85, 0.5, BARK_OAK, -0.6, 0, 87);
      v.drawWoodLimb(-0.8, 9.0, 0, 4.2, 13.0, 1.8, 0.85, 0.5, BARK_OAK, 0.6, 0.2, 88);
      v.drawLeafCluster3D(-0.4, 14.8, 0.4, 6.2, 3.6, 6.2, PAL_WILLOW, -0.06, 89);
      v.drawLeafCluster3D(-3.4, 16.2, 1.5, 3.8, 2.8, 3.8, PAL_WILLOW, 0.14, 90);
      v.drawLeafCluster3D(3.2, 15.8, -1.5, 3.8, 2.8, 3.8, PAL_WILLOW, 0.08, 91);
      v.drawLeafCluster3D(0, 18.2, 0, 4.4, 2.8, 4.4, PAL_WILLOW, 0.22, 92);
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2 + 0.15;
        const rad = 4.6 + (i % 3) * 0.9;
        v.drawHangingStrand3D(Math.round(Math.cos(ang) * rad), 13.5, Math.round(Math.sin(ang) * rad), 7 + (i % 4) * 2, PAL_WILLOW, 93 + i);
      }
      return v;
    }

    case 'meadow_orchard': {
      // Fruit-Laden Orchard Apple Tree — rounded spring foliage dotted with crisp ruby apples
      const v = new VoxelVolume(15, 19, 15);
      v.drawRoots3D(0, 0, 1.25, BARK_OAK, 4, 3.2, 2.2, 100, true);
      v.drawWoodLimb(0, 0, 0, 0, 7.6, 0, 1.25, 0.85, BARK_OAK, 0.3, -0.2, 101);
      v.drawWoodLimb(0, 6.5, 0, -3.0, 10.0, 1.2, 0.7, 0.45, BARK_OAK, -0.4, 0.2, 102);
      v.drawWoodLimb(0, 6.5, 0, 3.0, 10.0, -1.2, 0.7, 0.45, BARK_OAK, 0.4, -0.2, 103);
      v.drawLeafCluster3D(0, 11.8, 0, 5.0, 3.6, 5.0, PAL_ORCHARD, -0.06, 104, 0xe53935, 0.10);
      v.drawLeafCluster3D(-2.8, 12.5, 1.6, 3.3, 2.8, 3.3, PAL_ORCHARD, 0.12, 105, 0xe53935, 0.11);
      v.drawLeafCluster3D(2.8, 12.2, -1.5, 3.3, 2.7, 3.3, PAL_ORCHARD, 0.04, 106, 0xfbbf24, 0.09);
      v.drawLeafCluster3D(0, 15.0, 0, 3.6, 2.6, 3.6, PAL_ORCHARD, 0.22, 107, 0xe53935, 0.09);
      return v;
    }

    case 'meadow_poplar': {
      // Lombardy Poplar Spire — tall narrow flame-shaped column of sunlit meadow foliage
      const v = new VoxelVolume(13, 29, 13);
      v.drawRoots3D(0, 0, 1.1, BARK_OAK, 4, 2.6, 2.2, 110, true);
      v.drawWoodLimb(0, 0, 0, 0, 23, 0, 1.1, 0.35, BARK_OAK, 0, 0, 111);
      const layers: [number, number, number, number][] = [
        [7.5, 3.5, 2.9, -0.10],
        [11.5, 3.8, 3.1, -0.02],
        [15.5, 3.6, 3.0, 0.06],
        [19.2, 3.1, 2.8, 0.14],
        [22.6, 2.5, 2.5, 0.20],
        [25.5, 1.8, 2.2, 0.26],
      ];
      for (let i = 0; i < layers.length; i++) {
        const [y, r, ry, lb] = layers[i];
        v.drawLeafCluster3D(0, y, 0, r, ry, r, PAL_ORCHARD, lb, 112 + i);
      }
      return v;
    }

    // ------------------------------------------------------------------------
    // JUNGLE
    // ------------------------------------------------------------------------
    case 'jungle_kapok': {
      // Colossal Emergent Kapok — huge plank buttress roots, broad umbrella crown, hanging lianas & scarlet blooms
      const v = new VoxelVolume(23, 31, 23);
      v.drawRoots3D(0, 0, 2.3, BARK_OAK, 6, 6.2, 5.5, 120, true);
      v.drawWoodLimb(0, 0, 0, 0, 20.5, 0, 2.1, 1.15, BARK_OAK, -0.5, 0.4, 121);
      v.drawWoodLimb(0, 18.0, 0, -7.0, 22.5, -2.2, 1.0, 0.55, BARK_OAK, -0.8, 0, 122);
      v.drawWoodLimb(0, 18.0, 0, 7.0, 22.5, 2.2, 1.0, 0.55, BARK_OAK, 0.8, 0, 123);
      v.drawWoodLimb(0, 18.5, 0, -1.5, 22.5, 7.0, 0.95, 0.55, BARK_OAK, 0, 0.8, 124);
      v.drawWoodLimb(0, 18.5, 0, 1.5, 22.5, -7.0, 0.95, 0.55, BARK_OAK, 0, -0.8, 125);
      v.drawLeafCluster3D(0, 23.5, 0, 8.8, 3.2, 8.8, PAL_JUNGLE, -0.10, 126, 0xf43f5e, 0.03);
      v.drawLeafCluster3D(-5.8, 24.0, -2.0, 4.4, 2.5, 4.4, PAL_JUNGLE, 0.10, 127, 0xf43f5e, 0.035);
      v.drawLeafCluster3D(5.8, 23.6, 2.0, 4.3, 2.5, 4.3, PAL_JUNGLE, -0.02, 128);
      v.drawLeafCluster3D(-1.5, 26.2, 2.0, 5.4, 2.7, 5.2, PAL_JUNGLE, 0.20, 129);
      v.drawLeafCluster3D(2.6, 25.8, -2.2, 4.8, 2.5, 4.8, PAL_JUNGLE, 0.14, 130);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + 0.3;
        const rad = 5.0 + (i % 3) * 1.2;
        v.drawHangingStrand3D(Math.round(Math.cos(ang) * rad), 21.5, Math.round(Math.sin(ang) * rad), 7 + (i % 3) * 3, PAL_JUNGLE, 131 + i);
      }
      return v;
    }

    case 'jungle_palm': {
      // Arched Tropical Coconut Palm — curved ringed trunk, coconut cluster & 8 sweeping 3D palm fronds
      const v = new VoxelVolume(19, 26, 19);
      v.drawRoots3D(-2.2, -0.8, 1.2, BARK_PALM, 4, 2.8, 2.2, 135, false);
      v.drawWoodLimb(-2.2, 0, -0.8, 2.0, 18.5, 1.2, 1.2, 0.68, BARK_PALM, -2.4, -0.9, 136);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        v.set(2.0 + Math.cos(a) * 1.1, 17.5, 1.2 + Math.sin(a) * 1.1, 0x6b3f22);
      }
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + 0.2;
        const upper = i % 2 === 0;
        v.drawPalmFrond3D(2.0, 19.0, 1.2, ang, upper ? 6.6 : 7.4, upper ? 3.8 : 2.5, upper ? 3.2 : 5.0, PAL_PALM, 140 + i);
      }
      return v;
    }

    case 'jungle_banyan': {
      // Strangler Banyan Fig — braided central trunk + 5 arched curving aerial prop roots reaching the soil
      const v = new VoxelVolume(19, 24, 19);
      v.drawRoots3D(0, 0, 1.8, BARK_OAK, 5, 4.2, 3.0, 150, true);
      v.drawWoodLimb(0, 0, 0, 0, 13.0, 0, 1.75, 1.2, BARK_OAK, -0.4, 0.3, 151);
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + 0.25;
        const bx = Math.cos(ang) * 5.0;
        const bz = Math.sin(ang) * 5.0;
        v.drawWoodLimb(0, 10.5, 0, bx, 13.0, bz, 0.85, 0.55, BARK_OAK, 0, 0, 152 + i);
        v.drawWoodLimb(bx, 13.0, bz, bx * 1.12, 0, bz * 1.12, 0.52, 0.68, BARK_OAK, Math.cos(ang) * 0.9, Math.sin(ang) * 0.9, 160 + i);
      }
      v.drawLeafCluster3D(0, 15.8, 0, 7.0, 3.5, 7.0, PAL_JUNGLE, -0.10, 166);
      v.drawLeafCluster3D(-4.2, 15.4, 2.2, 3.8, 2.8, 3.8, PAL_JUNGLE, 0.12, 167);
      v.drawLeafCluster3D(4.2, 15.4, -2.2, 3.8, 2.8, 3.8, PAL_JUNGLE, -0.02, 168);
      v.drawLeafCluster3D(0, 18.8, 0, 4.8, 3.0, 4.8, PAL_JUNGLE, 0.22, 169);
      return v;
    }

    case 'jungle_fanpalm': {
      // Twin Leaning Jungle Palms + lush rainforest ground fern clump
      const v = new VoxelVolume(19, 25, 19);
      v.drawWoodLimb(-0.8, 0, -0.8, -4.2, 14.8, -1.8, 1.0, 0.55, BARK_PALM, -1.4, -0.5, 170);
      v.drawWoodLimb(0.8, 0, 0.8, 3.8, 18.5, 1.8, 1.05, 0.6, BARK_PALM, 1.4, 0.6, 171);
      for (let i = 0; i < 6; i++) {
        const a1 = (i / 6) * Math.PI * 2;
        v.drawPalmFrond3D(-4.2, 15.2, -1.8, a1, 5.2, 2.5, 3.2, PAL_PALM, 172 + i);
        v.drawPalmFrond3D(3.8, 19.0, 1.8, a1 + 0.4, 5.8, 3.0, 3.8, PAL_JUNGLE, 178 + i);
      }
      v.drawLeafCluster3D(0, 1.8, 0, 3.2, 1.8, 3.2, PAL_JUNGLE, 0.08, 185);
      return v;
    }

    // ------------------------------------------------------------------------
    // TAIGA / TUNDRA / SNOW
    // ------------------------------------------------------------------------
    case 'taiga_spruce': {
      // Snow-Laden Boreal Spruce — 6 radiating spruce whorls capped with sculpted snowdrifts!
      const v = new VoxelVolume(17, 29, 17);
      v.drawRoots3D(0, 0, 1.1, BARK_DARK, 4, 2.8, 2.2, 190, false);
      v.drawWoodLimb(0, 0, 0, 0, 25, 0, 1.15, 0.45, BARK_DARK, 0, 0, 191);
      const whorls = [
        { y: 6.5, r: 6.8, th: 2.0, arms: 7, d: 1.6 },
        { y: 10.2, r: 6.0, th: 1.9, arms: 7, d: 1.5 },
        { y: 13.8, r: 5.2, th: 1.8, arms: 6, d: 1.3 },
        { y: 17.2, r: 4.3, th: 1.7, arms: 6, d: 1.1 },
        { y: 20.4, r: 3.3, th: 1.6, arms: 5, d: 0.8 },
        { y: 23.4, r: 2.2, th: 1.4, arms: 4, d: 0.5 },
      ];
      for (let i = 0; i < whorls.length; i++) {
        const w = whorls[i];
        v.drawConiferWhorl3D(0, w.y, 0, w.r, w.th, w.arms, PAL_TAIGA, 195 + i * 7, PAL_SNOW, w.d, i * 0.04);
      }
      v.set(0, 26.5, 0, PAL_SNOW[4]);
      return v;
    }

    case 'taiga_fir': {
      // Frosty Silver-Blue Subalpine Fir — narrow towering alpine spire soaring high above snow pines
      const v = new VoxelVolume(15, 36, 15);
      v.drawRoots3D(0, 0, 1.0, BARK_DARK, 3, 2.4, 2.0, 205, false);
      v.drawWoodLimb(0, 0, 0, 0, 32, 0, 1.05, 0.42, BARK_DARK, 0, 0, 206);
      const whorls = [
        { y: 6.5, r: 5.2, th: 1.9, arms: 6 },
        { y: 10.5, r: 4.8, th: 1.8, arms: 6 },
        { y: 14.5, r: 4.3, th: 1.8, arms: 6 },
        { y: 18.5, r: 3.8, th: 1.7, arms: 5 },
        { y: 22.5, r: 3.2, th: 1.6, arms: 5 },
        { y: 26.2, r: 2.5, th: 1.5, arms: 4 },
        { y: 29.8, r: 1.7, th: 1.3, arms: 4 },
      ];
      for (let i = 0; i < whorls.length; i++) {
        const w = whorls[i];
        v.drawConiferWhorl3D(0, w.y, 0, w.r, w.th, w.arms, PAL_FROST_FIR, 210 + i * 7, i % 2 === 0 ? PAL_SNOW : undefined, 1.1, i * 0.04);
      }
      v.set(0, 32.5, 0, PAL_SNOW[4]);
      v.set(0, 33.5, 0, PAL_SNOW[3]);
      return v;
    }

    case 'taiga_larch': {
      // Golden Siberian Larch — warm golden-amber boreal conifer tiers
      const v = new VoxelVolume(17, 27, 17);
      v.drawRoots3D(0, 0, 1.1, BARK_DARK, 4, 2.8, 2.2, 220, false);
      v.drawWoodLimb(0, 0, 0, 0, 23, 0, 1.1, 0.45, BARK_DARK, 0.2, -0.15, 221);
      const whorls = [
        { y: 6.5, r: 6.0, th: 1.9, arms: 7 },
        { y: 10.2, r: 5.2, th: 1.8, arms: 6 },
        { y: 13.8, r: 4.4, th: 1.7, arms: 6 },
        { y: 17.2, r: 3.5, th: 1.6, arms: 5 },
        { y: 20.4, r: 2.6, th: 1.5, arms: 5 },
        { y: 23.2, r: 1.7, th: 1.3, arms: 4 },
      ];
      for (let i = 0; i < whorls.length; i++) {
        const w = whorls[i];
        v.drawConiferWhorl3D(0, w.y, 0, w.r, w.th, w.arms, PAL_LARCH, 225 + i * 7, undefined, 1.3, i * 0.05);
      }
      v.set(0, 25.5, 0, PAL_LARCH[4]);
      return v;
    }

    case 'taiga_snowpine': {
      // Ancient Snow-Capped Taiga Pine — broad wind-battered gnarled northern pine with heavy snow pillows
      const v = new VoxelVolume(19, 22, 19);
      v.drawRoots3D(0, 0, 1.7, BARK_DARK, 5, 4.2, 2.8, 235, false);
      v.drawWoodLimb(0, 0, 0, -0.5, 16.5, 0.3, 1.7, 0.65, BARK_DARK, -0.6, 0.4, 236);
      const whorls = [
        { y: 7.0, r: 7.6, th: 2.1, arms: 7 },
        { y: 11.2, r: 6.4, th: 2.0, arms: 7 },
        { y: 15.0, r: 4.8, th: 1.8, arms: 6 },
        { y: 18.2, r: 3.0, th: 1.6, arms: 5 },
      ];
      for (let i = 0; i < whorls.length; i++) {
        const w = whorls[i];
        v.drawConiferWhorl3D(0, w.y, 0, w.r, w.th, w.arms, PAL_TAIGA, 240 + i * 9, PAL_SNOW, 1.6, i * 0.05);
      }
      return v;
    }

    // ------------------------------------------------------------------------
    // SAKURA BLOSSOM
    // ------------------------------------------------------------------------
    case 'blossom_sakura': {
      // Imperial Weeping Sakura — dark plum trunk, billowing rose-pink blossom clouds & petal garlands
      const v = new VoxelVolume(19, 23, 19);
      v.drawRoots3D(0, 0, 1.6, BARK_SAKURA, 5, 4.2, 3.0, 250, false);
      v.drawWoodLimb(0, 0, 0, -0.6, 10.0, 0.4, 1.6, 1.0, BARK_SAKURA, -0.9, 0.4, 251);
      v.drawWoodLimb(-0.4, 8.5, 0, -4.8, 13.0, -1.6, 0.9, 0.5, BARK_SAKURA, -0.8, 0, 252);
      v.drawWoodLimb(-0.4, 8.5, 0, 4.8, 13.0, 1.8, 0.9, 0.5, BARK_SAKURA, 0.8, 0.2, 253);
      v.drawWoodLimb(-0.4, 9.2, 0, 1.0, 13.0, -4.6, 0.85, 0.5, BARK_SAKURA, 0.2, -0.6, 254);
      v.drawLeafCluster3D(0, 14.5, 0, 5.8, 3.5, 5.8, PAL_SAKURA, -0.10, 255);
      v.drawLeafCluster3D(-4.6, 14.2, -1.6, 3.6, 2.7, 3.6, PAL_SAKURA, 0.12, 256);
      v.drawLeafCluster3D(4.6, 14.2, 1.6, 3.6, 2.7, 3.6, PAL_SAKURA, -0.02, 257);
      v.drawLeafCluster3D(0.8, 14.6, -4.4, 3.4, 2.6, 3.4, PAL_SAKURA, 0.04, 258);
      v.drawLeafCluster3D(-1.8, 17.2, 2.2, 3.8, 2.8, 3.8, PAL_SAKURA, 0.20, 259);
      v.drawLeafCluster3D(1.8, 18.0, -1.2, 3.9, 2.8, 3.9, PAL_SAKURA, 0.24, 260);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + 0.2;
        const rad = 4.8 + (i % 3) * 0.9;
        v.drawHangingStrand3D(Math.round(Math.cos(ang) * rad), 12.2, Math.round(Math.sin(ang) * rad), 4 + (i % 3) * 2, PAL_SAKURA, 261 + i);
      }
      return v;
    }

    case 'blossom_bonsai': {
      // Windswept Bonsai Cherry — sculptural curved leaning trunk with 3 asymmetric blossom cloud pads
      const v = new VoxelVolume(19, 21, 19);
      v.drawRoots3D(1.5, 0, 1.5, BARK_SAKURA, 5, 3.8, 2.8, 270, false);
      v.drawWoodLimb(1.5, 0, 0, -3.0, 10.0, 0.8, 1.5, 0.85, BARK_SAKURA, -2.0, 0.6, 271);
      v.drawWoodLimb(-0.8, 7.0, 0.4, 5.0, 10.8, -1.5, 0.9, 0.5, BARK_SAKURA, 0.9, -0.4, 272);
      v.drawWoodLimb(-2.6, 9.6, 0.8, -5.8, 13.0, 1.8, 0.8, 0.45, BARK_SAKURA, -0.8, 0.3, 273);
      v.drawWoodLimb(-2.2, 10.0, 0.8, 1.2, 15.0, 0, 0.8, 0.45, BARK_SAKURA, 0.5, 0, 274);
      v.drawLeafCluster3D(5.2, 11.4, -1.5, 4.0, 2.2, 3.6, PAL_SAKURA, 0.04, 275);
      v.drawLeafCluster3D(-5.5, 13.6, 1.6, 4.2, 2.3, 4.0, PAL_SAKURA, 0.14, 276);
      v.drawLeafCluster3D(0.8, 16.0, 0, 5.0, 2.6, 4.8, PAL_SAKURA, 0.24, 277);
      return v;
    }

    case 'blossom_pagoda': {
      // Pagoda Blossom Cherry — tall dark trunk with 4 tiered pink floral boughs
      const v = new VoxelVolume(17, 27, 17);
      v.drawRoots3D(0, 0, 1.3, BARK_SAKURA, 4, 3.4, 2.6, 280, false);
      v.drawWoodLimb(0, 0, 0, 0, 22, 0, 1.3, 0.6, BARK_SAKURA, 0.4, -0.3, 281);
      v.drawLeafCluster3D(0, 10.5, 0, 6.5, 2.2, 6.5, PAL_SAKURA, -0.06, 282);
      v.drawLeafCluster3D(0, 15.0, 0, 5.7, 2.2, 5.7, PAL_SAKURA, 0.06, 283);
      v.drawLeafCluster3D(0, 19.2, 0, 4.5, 2.0, 4.5, PAL_SAKURA, 0.16, 284);
      v.drawLeafCluster3D(0, 23.0, 0, 3.2, 1.8, 3.2, PAL_SAKURA, 0.26, 285);
      return v;
    }

    case 'blossom_plum': {
      // White-Petal Plum Tree — knotted dark trunk with snow-white & blush blossom clusters
      const v = new VoxelVolume(15, 21, 15);
      v.drawRoots3D(0, 0, 1.25, BARK_SAKURA, 4, 3.2, 2.2, 290, false);
      v.drawWoodLimb(0, 0, 0, 0.3, 9.2, -0.2, 1.25, 0.8, BARK_SAKURA, 0.6, -0.4, 291);
      v.drawWoodLimb(0, 7.6, 0, -3.4, 11.5, 1.5, 0.7, 0.45, BARK_SAKURA, -0.5, 0.3, 292);
      v.drawWoodLimb(0, 7.6, 0, 3.4, 11.5, -1.5, 0.7, 0.45, BARK_SAKURA, 0.5, -0.3, 293);
      v.drawLeafCluster3D(0, 13.0, 0, 5.0, 3.3, 5.0, PAL_PLUM_WHITE, -0.04, 294, 0xef9eb9, 0.11);
      v.drawLeafCluster3D(-3.2, 13.4, 1.5, 3.3, 2.6, 3.3, PAL_PLUM_WHITE, 0.12, 295, 0xef9eb9, 0.11);
      v.drawLeafCluster3D(3.2, 13.4, -1.5, 3.3, 2.6, 3.3, PAL_PLUM_WHITE, 0.06, 296, 0xef9eb9, 0.10);
      v.drawLeafCluster3D(0, 16.0, 0, 3.6, 2.6, 3.6, PAL_PLUM_WHITE, 0.22, 297, 0xef9eb9, 0.09);
      return v;
    }

    // ------------------------------------------------------------------------
    // SAVANNA / BADLANDS / SAND
    // ------------------------------------------------------------------------
    case 'savanna_acacia': {
      // Iconic Flat-Topped Umbrella Acacia — slender forked dark limbs + wafer-thin olive-gold parasol plates!
      const v = new VoxelVolume(23, 22, 23);
      v.drawRoots3D(0, 0, 1.25, BARK_DARK, 4, 3.6, 2.2, 300, false);
      v.drawWoodLimb(0, 0, 0, 0, 10.0, 0, 1.25, 0.85, BARK_DARK, 0.45, -0.3, 301);
      v.drawWoodLimb(0, 8.5, 0, -6.5, 14.5, -2.0, 0.8, 0.45, BARK_DARK, -0.8, 0, 302);
      v.drawWoodLimb(0, 8.5, 0, 6.5, 15.2, 2.0, 0.8, 0.45, BARK_DARK, 0.8, 0, 303);
      v.drawWoodLimb(0, 9.2, 0, -1.2, 16.0, 5.8, 0.75, 0.45, BARK_DARK, 0, 0.6, 304);
      v.drawWoodLimb(0, 9.2, 0, 1.5, 16.8, -5.8, 0.75, 0.45, BARK_DARK, 0, -0.6, 305);
      v.drawLeafCluster3D(-5.8, 15.2, -1.6, 5.0, 1.7, 4.8, PAL_ACACIA, 0.06, 306);
      v.drawLeafCluster3D(5.8, 16.0, 1.6, 4.9, 1.7, 4.6, PAL_ACACIA, 0.04, 307);
      v.drawLeafCluster3D(-0.8, 16.8, 5.0, 4.9, 1.7, 4.4, PAL_ACACIA, 0.12, 308);
      v.drawLeafCluster3D(1.2, 17.5, -5.0, 4.8, 1.6, 4.4, PAL_ACACIA, 0.10, 309);
      v.drawLeafCluster3D(0, 18.6, 0, 7.0, 1.9, 6.8, PAL_ACACIA, 0.22, 310);
      return v;
    }

    case 'savanna_baobab': {
      // Colossal African Baobab — massive swollen bottle-shaped trunk + stubby root-like crown branches
      const v = new VoxelVolume(21, 25, 21);
      v.drawRoots3D(0, 0, 3.3, BARK_BAOBAB, 6, 5.8, 4.5, 315, false);
      v.drawWoodLimb(0, 0, 0, 0, 11.0, 0, 3.4, 2.9, BARK_BAOBAB, 0, 0, 316);
      v.drawWoodLimb(0, 10.0, 0, 0, 16.2, 0, 3.0, 2.1, BARK_BAOBAB, 0.2, -0.15, 317);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + 0.3;
        const bx = Math.cos(ang) * 6.2;
        const bz = Math.sin(ang) * 6.2;
        v.drawWoodLimb(Math.cos(ang) * 1.6, 15.2, Math.sin(ang) * 1.6, bx, 19.8 + (i % 2) * 1.5, bz, 1.05, 0.52, BARK_BAOBAB, Math.cos(ang) * 0.8, Math.sin(ang) * 0.8, 320 + i);
        v.drawLeafCluster3D(bx, 21.0 + (i % 2) * 1.5, bz, 3.2, 1.7, 3.2, PAL_ACACIA, 0.08 + (i % 2) * 0.1, 330 + i);
      }
      v.drawLeafCluster3D(0, 22.4, 0, 4.0, 1.8, 4.0, PAL_ACACIA, 0.22, 338);
      return v;
    }

    case 'savanna_thorn': {
      // Twin Steppe Thorn Acacia — dual gnarled leaning stems with staggered dusty-gold flat crowns
      const v = new VoxelVolume(19, 19, 19);
      v.drawRoots3D(0, 0, 1.4, BARK_DARK, 4, 3.6, 2.2, 340, false);
      v.drawWoodLimb(-0.4, 0, 0, -5.0, 10.8, 1.5, 1.0, 0.55, BARK_DARK, -1.2, 0.4, 341);
      v.drawWoodLimb(0.4, 0, 0, 4.6, 13.8, -1.5, 1.05, 0.55, BARK_DARK, 1.2, -0.4, 342);
      v.drawLeafCluster3D(-5.0, 11.8, 1.5, 4.8, 1.8, 4.4, PAL_ACACIA, 0.10, 343);
      v.drawLeafCluster3D(4.6, 14.8, -1.5, 5.2, 1.9, 4.8, PAL_ACACIA, 0.18, 344);
      v.drawLeafCluster3D(0.4, 15.8, 1.2, 4.0, 1.6, 3.8, PAL_ACACIA, 0.22, 345);
      return v;
    }

    case 'savanna_datepalm': {
      // Desert Oasis Date Palm — curving sun-baked palm trunk with golden date clusters & sage fronds
      const v = new VoxelVolume(19, 25, 19);
      v.drawRoots3D(2.0, 0.4, 1.2, BARK_PALM, 4, 2.8, 2.2, 350, false);
      v.drawWoodLimb(2.0, 0, 0.4, -1.5, 17.8, -0.8, 1.2, 0.7, BARK_PALM, 2.1, 0.8, 351);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        v.set(-1.5 + Math.cos(a) * 1.1, 16.8, -0.8 + Math.sin(a) * 1.1, 0xfbbf24);
      }
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + 0.1;
        const upper = i % 2 === 0;
        v.drawPalmFrond3D(-1.5, 18.2, -0.8, ang, upper ? 6.2 : 7.0, upper ? 3.5 : 2.2, upper ? 3.0 : 4.5, PAL_OASIS, 355 + i);
      }
      return v;
    }

    // ------------------------------------------------------------------------
    // SWAMP
    // ------------------------------------------------------------------------
    case 'swamp_cypress': {
      // Bayou Bald Cypress — fluted pyramidal buttress base, protruding cypress knees & hanging Spanish moss!
      const v = new VoxelVolume(19, 28, 19);
      v.drawRoots3D(0, 0, 2.5, BARK_SWAMP, 6, 4.8, 4.5, 365, true);
      v.drawWoodLimb(-5.6, 0, 1.5, -5.6, 3.4, 1.5, 0.65, 0.4, BARK_SWAMP, 0, 0, 366);
      v.drawWoodLimb(5.2, 0, -2.6, 5.2, 2.8, -2.6, 0.65, 0.4, BARK_SWAMP, 0, 0, 367);
      v.drawWoodLimb(0, 0, 0, 0, 8.5, 0, 2.5, 1.5, BARK_SWAMP, 0, 0, 369);
      v.drawWoodLimb(0, 7.5, 0, 0, 20.0, 0, 1.5, 0.7, BARK_SWAMP, -0.4, 0.3, 370);
      v.drawWoodLimb(0, 14.5, 0, -5.2, 17.8, -1.5, 0.85, 0.5, BARK_SWAMP, -0.6, 0, 371);
      v.drawWoodLimb(0, 15.2, 0, 5.2, 18.4, 1.5, 0.85, 0.5, BARK_SWAMP, 0.6, 0, 372);
      v.drawLeafCluster3D(0, 19.2, 0, 6.8, 3.0, 6.8, PAL_SWAMP, -0.08, 373);
      v.drawLeafCluster3D(-4.8, 18.5, -1.5, 4.0, 2.4, 4.0, PAL_SWAMP, 0.08, 374);
      v.drawLeafCluster3D(4.8, 18.8, 1.5, 4.0, 2.4, 4.0, PAL_SWAMP, -0.02, 375);
      v.drawLeafCluster3D(0, 22.5, 0, 4.8, 2.5, 4.8, PAL_SWAMP, 0.18, 376);
      v.drawLeafCluster3D(0, 25.0, 0, 3.2, 2.0, 3.2, PAL_SWAMP, 0.24, 377);
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + 0.1;
        const rad = 4.8 + (i % 3) * 1.0;
        v.drawHangingStrand3D(Math.round(Math.cos(ang) * rad), 17.8, Math.round(Math.sin(ang) * rad), 6 + (i % 3) * 2, PAL_SPANISH_MOSS, 378 + i);
      }
      return v;
    }

    case 'swamp_mangrove': {
      // Stilt-Root Marsh Mangrove — elevated trunk perched on 6 arched 3D aerial prop roots + glowing cyan mushrooms!
      const v = new VoxelVolume(19, 22, 19);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + 0.2;
        const ex = Math.cos(ang) * 5.4;
        const ez = Math.sin(ang) * 5.4;
        v.drawWoodLimb(Math.cos(ang) * 1.0, 7.2, Math.sin(ang) * 1.0, ex, 0, ez, 0.78, 0.58, BARK_SWAMP, Math.cos(ang) * 1.6, Math.sin(ang) * 1.6, 395 + i);
        if (i % 2 === 0) {
          v.set(Math.cos(ang) * 3.4, 4.0, Math.sin(ang) * 3.4, 0x5eead4);
          v.set(Math.cos(ang) * 3.4, 4.8, Math.sin(ang) * 3.4, 0xccfbf1);
        }
      }
      v.drawWoodLimb(0, 6.5, 0, 0, 13.0, 0, 1.45, 0.9, BARK_SWAMP, 0.4, -0.2, 402);
      v.drawLeafCluster3D(0, 15.0, 0, 6.0, 3.2, 6.0, PAL_SWAMP, -0.06, 403);
      v.drawLeafCluster3D(-3.8, 14.6, 1.8, 3.6, 2.6, 3.6, PAL_SWAMP, 0.10, 404);
      v.drawLeafCluster3D(3.8, 14.6, -1.8, 3.6, 2.6, 3.6, PAL_SWAMP, 0.02, 405);
      v.drawLeafCluster3D(0, 17.8, 0, 4.2, 2.6, 4.2, PAL_SWAMP, 0.20, 406);
      return v;
    }

    case 'swamp_bogwillow': {
      // Twisted Bog Willow — stooped gnarled bog tree with dripping murky-moss fronds
      const v = new VoxelVolume(19, 21, 19);
      v.drawRoots3D(-1.5, 0, 1.5, BARK_SWAMP, 5, 4.0, 3.0, 410, true);
      v.drawWoodLimb(-1.5, 0, 0, 2.0, 12.2, 0.4, 1.5, 0.85, BARK_SWAMP, -1.9, 0.8, 411);
      v.drawLeafCluster3D(1.2, 15.0, 0.4, 6.0, 3.4, 6.0, PAL_SWAMP, -0.02, 412);
      v.drawLeafCluster3D(-2.6, 15.8, 1.5, 3.6, 2.6, 3.6, PAL_SWAMP, 0.14, 413);
      v.drawLeafCluster3D(4.2, 14.6, -1.5, 3.6, 2.6, 3.6, PAL_SWAMP, 0.04, 414);
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const rad = 4.3 + (i % 3) * 0.9;
        v.drawHangingStrand3D(Math.round(1.2 + Math.cos(ang) * rad), 13.0, Math.round(0.4 + Math.sin(ang) * rad), 5 + (i % 3) * 2, i % 2 === 0 ? PAL_SPANISH_MOSS : PAL_SWAMP, 415 + i);
      }
      return v;
    }

    case 'swamp_ancient': {
      // Moss-Draped Ancient Swamp Cypress — asymmetric tiered cypress with trailing moss
      const v = new VoxelVolume(17, 26, 17);
      v.drawRoots3D(0, 0, 2.0, BARK_SWAMP, 5, 4.2, 3.8, 430, true);
      v.drawWoodLimb(0, 0, 0, -0.4, 20.0, 0.2, 1.9, 0.7, BARK_SWAMP, 0.7, -0.4, 431);
      v.drawLeafCluster3D(3.8, 14.0, -1.5, 4.0, 2.2, 3.8, PAL_SWAMP, 0.0, 432);
      v.drawLeafCluster3D(-3.8, 17.0, 1.5, 4.2, 2.4, 4.0, PAL_SWAMP, 0.10, 433);
      v.drawLeafCluster3D(0, 20.0, 0, 5.0, 2.5, 4.8, PAL_SWAMP, 0.16, 434);
      v.drawLeafCluster3D(-0.4, 23.0, 0.4, 3.4, 2.1, 3.4, PAL_SWAMP, 0.24, 435);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        v.drawHangingStrand3D(Math.round(Math.cos(ang) * 4.0), 18.5, Math.round(Math.sin(ang) * 4.0), 6 + (i % 3) * 2, PAL_SPANISH_MOSS, 436 + i);
      }
      return v;
    }

    // ------------------------------------------------------------------------
    // HIGHLAND / MOUNTAIN / ROCK
    // ------------------------------------------------------------------------
    case 'highland_scotspine': {
      // Windswept Caledonian Scots Pine — dark lower bark transitioning to warm flaky terracotta upper bark!
      const v = new VoxelVolume(19, 25, 19);
      v.drawRoots3D(-1.2, 0, 1.45, BARK_DARK, 5, 4.0, 3.0, 445, false);
      v.drawWoodLimb(-1.2, 0, 0, 0.4, 10.0, 0.15, 1.45, 1.05, BARK_DARK, -0.9, 0.3, 446);
      v.drawWoodLimb(0.4, 9.6, 0.15, 1.2, 17.8, -0.4, 1.05, 0.65, BARK_SCOTS, 0.9, -0.3, 447);
      v.drawWoodLimb(0.8, 13.8, 0, -5.0, 16.6, 1.8, 0.75, 0.45, BARK_SCOTS, -0.6, 0.2, 448);
      v.drawWoodLimb(1.0, 15.0, -0.15, 5.8, 18.0, -1.8, 0.75, 0.45, BARK_SCOTS, 0.6, -0.2, 449);
      v.drawLeafCluster3D(-4.8, 17.0, 1.8, 4.2, 2.2, 3.8, PAL_SCOTS_LEAF, 0.08, 450);
      v.drawLeafCluster3D(5.5, 18.5, -1.6, 4.4, 2.2, 4.0, PAL_SCOTS_LEAF, 0.02, 451);
      v.drawLeafCluster3D(0.4, 19.6, 0, 5.6, 2.5, 5.2, PAL_SCOTS_LEAF, 0.16, 452);
      v.drawLeafCluster3D(1.8, 22.0, -0.8, 4.0, 2.1, 3.8, PAL_SCOTS_LEAF, 0.24, 453);
      return v;
    }

    case 'highland_rowan': {
      // Highland Crimson Rowan — rugged mountain trunk with vivid crimson & scarlet autumn clusters
      const v = new VoxelVolume(15, 22, 15);
      v.drawRoots3D(0, 0, 1.25, BARK_OAK, 4, 3.4, 2.2, 460, false);
      v.drawWoodLimb(0, 0, 0, 0, 10.0, 0, 1.25, 0.8, BARK_OAK, -0.5, 0.3, 461);
      v.drawWoodLimb(0, 8.5, 0, -3.4, 12.2, 1.5, 0.7, 0.45, BARK_OAK, -0.5, 0.3, 462);
      v.drawWoodLimb(0, 8.5, 0, 3.4, 12.2, -1.5, 0.7, 0.45, BARK_OAK, 0.5, -0.3, 463);
      v.drawLeafCluster3D(0, 13.8, 0, 5.0, 3.4, 5.0, PAL_ROWAN, -0.06, 464);
      v.drawLeafCluster3D(-3.2, 13.8, 1.5, 3.4, 2.6, 3.4, PAL_ROWAN, 0.12, 465);
      v.drawLeafCluster3D(3.2, 13.8, -1.5, 3.4, 2.6, 3.4, PAL_ROWAN, 0.04, 466);
      v.drawLeafCluster3D(0, 17.0, 0, 3.6, 2.6, 3.6, PAL_ROWAN, 0.22, 467);
      return v;
    }

    case 'highland_aspen': {
      // Golden Quaking Aspen — twin slender white birch-like trunks + shimmering sunlit golden crowns
      const v = new VoxelVolume(15, 27, 15);
      v.drawRoots3D(-0.8, 0, 1.0, BARK_BIRCH, 4, 2.8, 2.2, 470, false);
      v.drawWoodLimb(-1.4, 0, -0.4, -2.2, 16.0, -0.8, 0.9, 0.5, BARK_BIRCH, -0.6, -0.3, 471, true);
      v.drawWoodLimb(1.4, 0, 0.4, 2.2, 19.2, 0.8, 0.95, 0.52, BARK_BIRCH, 0.6, 0.3, 472, true);
      v.drawLeafCluster3D(-2.4, 17.0, -1.0, 3.5, 3.2, 3.5, PAL_ASPEN, 0.08, 473);
      v.drawLeafCluster3D(2.4, 19.2, 1.0, 3.8, 3.5, 3.8, PAL_ASPEN, 0.14, 474);
      v.drawLeafCluster3D(0, 21.6, 0, 3.6, 3.2, 3.6, PAL_ASPEN, 0.22, 475);
      v.drawLeafCluster3D(1.2, 24.0, 0.4, 2.8, 2.4, 2.8, PAL_ASPEN, 0.28, 476);
      return v;
    }

    case 'highland_krummholz':
    default: {
      // Alpine Crag Krummholz Cedar — fiercely wind-bent gnarled mountain pine gripping rocky roots
      const v = new VoxelVolume(19, 18, 19);
      v.drawRoots3D(-2.6, 0, 1.5, BARK_DARK, 5, 4.2, 2.8, 480, false);
      v.drawWoodLimb(-2.6, 0, 0, 2.6, 9.6, 0.4, 1.5, 0.85, BARK_DARK, -1.6, 0.5, 481);
      v.drawWoodLimb(1.2, 7.6, 0, 5.8, 11.2, -1.2, 0.85, 0.48, BARK_DARK, 0.8, -0.2, 482);
      v.drawWoodLimb(-0.8, 6.2, 0, -5.0, 9.6, 1.5, 0.8, 0.45, BARK_DARK, -0.6, 0.3, 483);
      v.drawLeafCluster3D(-4.8, 10.4, 1.5, 3.8, 2.2, 3.6, PAL_SCOTS_LEAF, 0.06, 484);
      v.drawLeafCluster3D(5.5, 12.0, -1.2, 4.2, 2.3, 4.0, PAL_SCOTS_LEAF, 0.02, 485);
      v.drawLeafCluster3D(1.5, 12.8, 0.4, 4.8, 2.5, 4.6, PAL_SCOTS_LEAF, 0.16, 486);
      v.drawLeafCluster3D(-0.4, 15.0, 0.4, 3.6, 2.0, 3.5, PAL_SCOTS_LEAF, 0.24, 487);
      return v;
    }
  }
}

function buildBurntVoxelTreeLodSets(): {
  lod0: THREE.BufferGeometry[];
  lod1: THREE.BufferGeometry[];
  lod2: THREE.BufferGeometry[];
  lod3: THREE.BufferGeometry[];
} {
  const BARK_CHARRED: Pal5 = [0x0f0c0b, 0x1a1514, 0x28211f, 0x3b312e, 0x524642];
  const BARK_ASH: Pal5 = [0x141110, 0x221d1b, 0x362f2c, 0x4f4642, 0x6e635f];
  const PAL_SCORCHED_TWIGS: Pal5 = [0x1c120e, 0x2d1b13, 0x452719, 0x63361f, 0x8a4b29];

  // Variant 0: Charred Gnarled Oak — blackened trunk, broken skeletal limbs, glowing ember cracks & sparse singed twig clusters
  const v0 = new VoxelVolume(19, 24, 19);
  v0.drawRoots3D(0, 0, 1.8, BARK_CHARRED, 5, 4.2, 2.8, 601, false);
  v0.drawWoodLimb(0, 0, 0, -0.4, 11.5, 0.2, 1.8, 1.05, BARK_CHARRED, -0.5, 0.3, 602);
  v0.drawWoodLimb(-0.4, 9.5, 0.2, -5.2, 15.5, -2.0, 0.95, 0.35, BARK_CHARRED, -0.8, -0.3, 603);
  v0.drawWoodLimb(-0.2, 10.2, 0.2, 4.8, 16.2, 1.8, 0.9, 0.35, BARK_CHARRED, 0.7, 0.3, 604);
  v0.drawWoodLimb(-0.3, 10.8, 0.2, 0.6, 17.8, -4.4, 0.82, 0.32, BARK_CHARRED, 0.2, -0.7, 605);
  v0.drawWoodLimb(-3.4, 13.5, -1.2, -6.2, 17.5, 1.4, 0.52, 0.25, BARK_ASH, -0.4, 0.3, 606);
  v0.drawWoodLimb(3.2, 14.0, 1.2, 5.8, 18.0, -1.5, 0.52, 0.25, BARK_ASH, 0.4, -0.3, 607);
  v0.drawLeafCluster3D(-5.0, 15.8, -1.8, 2.1, 1.2, 2.1, PAL_SCORCHED_TWIGS, -0.1, 608, 0xf97316, 0.08);
  v0.drawLeafCluster3D(4.6, 16.5, 1.6, 2.0, 1.2, 2.0, PAL_SCORCHED_TWIGS, -0.05, 609, 0xea580c, 0.08);
  // Glowing ember cracks on trunk
  v0.set(1, 4, 0, 0xea580c);
  v0.set(1, 5, 0, 0xf97316);
  v0.set(-1, 7, 1, 0xd97706);
  v0.set(0, 9, -1, 0xf59e0b);

  // Variant 1: Burnt Conifer Spire — tall blackened pine trunk with charred needleless horizontal branch ribs & ember core
  const v1 = new VoxelVolume(15, 28, 15);
  v1.drawRoots3D(0, 0, 1.2, BARK_CHARRED, 4, 2.8, 2.2, 620, false);
  v1.drawWoodLimb(0, 0, 0, 0, 23.5, 0, 1.2, 0.38, BARK_CHARRED, 0.2, -0.15, 621);
  const ribHeights = [6.5, 10.0, 13.5, 16.8, 19.8];
  for (let i = 0; i < ribHeights.length; i++) {
    const ry = ribHeights[i];
    const span = 4.6 - i * 0.72;
    const arms = 5 - (i > 2 ? 1 : 0);
    for (let a = 0; a < arms; a++) {
      const ang = (a / arms) * Math.PI * 2 + i * 0.55;
      const ex = Math.cos(ang) * span;
      const ez = Math.sin(ang) * span;
      v1.drawWoodLimb(0, ry, 0, ex, ry - 0.8, ez, 0.55, 0.25, i % 2 === 0 ? BARK_CHARRED : BARK_ASH, 0, 0, 625 + i * 5 + a);
      if ((i + a) % 3 === 0) {
        v1.set(Math.round(ex * 0.85), Math.round(ry - 0.6), Math.round(ez * 0.85), 0xea580c);
      }
    }
  }
  v1.set(0, 8, 1, 0xf97316);
  v1.set(1, 12, 0, 0xea580c);

  // Variant 2: Split Hollow Fire Snag — thick burnt stump split into jagged forks with glowing inner coal heart
  const v2 = new VoxelVolume(17, 21, 17);
  v2.drawRoots3D(0, 0, 2.0, BARK_CHARRED, 5, 4.4, 3.0, 640, false);
  v2.drawWoodLimb(0, 0, 0, 0, 8.5, 0, 1.95, 1.35, BARK_CHARRED, -0.3, 0.2, 641);
  v2.drawWoodLimb(-0.4, 7.8, 0, -4.2, 16.5, 1.4, 1.05, 0.35, BARK_ASH, -0.9, 0.3, 642);
  v2.drawWoodLimb(0.5, 7.8, 0, 3.8, 14.8, -1.6, 0.98, 0.35, BARK_CHARRED, 0.8, -0.4, 643);
  v2.drawWoodLimb(0, 8.2, 0.4, 0.8, 13.2, 4.2, 0.78, 0.3, BARK_ASH, 0.2, 0.7, 644);
  // Smoldering coal heart inside the split fork
  v2.set(0, 8, 0, 0xfbbf24);
  v2.set(0, 9, 0, 0xf97316);
  v2.set(-1, 8, 0, 0xea580c);
  v2.set(1, 8, 0, 0xdc2626);

  // Variant 3: Scorched Multi-Limb Deadwood — twisted blackened woodland tree with singed brown/ash remnant tufts
  const v3 = new VoxelVolume(17, 23, 17);
  v3.drawRoots3D(0, 0, 1.5, BARK_ASH, 4, 3.6, 2.5, 660, false);
  v3.drawWoodLimb(0, 0, 0, 0.5, 11.0, -0.3, 1.5, 0.95, BARK_CHARRED, 0.6, -0.3, 661);
  v3.drawWoodLimb(0.5, 9.5, -0.3, -4.0, 15.2, 2.2, 0.82, 0.32, BARK_ASH, -0.7, 0.4, 662);
  v3.drawWoodLimb(0.5, 10.2, -0.3, 4.4, 16.8, -1.8, 0.85, 0.32, BARK_CHARRED, 0.7, -0.3, 663);
  v3.drawWoodLimb(0.5, 10.5, -0.3, -1.2, 18.2, -3.6, 0.75, 0.28, BARK_ASH, -0.3, -0.6, 664);
  v3.drawLeafCluster3D(-3.8, 15.5, 2.0, 2.2, 1.3, 2.2, PAL_SCORCHED_TWIGS, 0.0, 665, 0xf97316, 0.06);
  v3.drawLeafCluster3D(4.2, 17.0, -1.6, 2.3, 1.4, 2.2, PAL_SCORCHED_TWIGS, 0.05, 666, 0xea580c, 0.06);
  v3.drawLeafCluster3D(-1.0, 18.5, -3.4, 1.9, 1.2, 1.9, PAL_SCORCHED_TWIGS, 0.1, 667);

  const vols: [VoxelVolume, number][] = [
    [v0, 0.056],
    [v1, 0.054],
    [v2, 0.056],
    [v3, 0.055],
  ];
  return {
    lod0: vols.map(([v, s]) => v.toGreedyBufferGeometry(s)),
    lod1: vols.map(([v, s]) => v.toDownsampledGreedyBufferGeometry(s, 2, false)),
    lod2: vols.map(([v, s]) => v.toDownsampledGreedyBufferGeometry(s, 3, true)),
    lod3: vols.map(([v, s]) => v.toDownsampledGreedyBufferGeometry(s, 4, true)),
  };
}

let cachedVoxelTreeLib: VoxelTreeLibrary | null = null;

function makeEmptyBiomeRecord<T>(): Record<TreeBiomeKey, T[]> {
  return {
    forest: [],
    meadow: [],
    jungle: [],
    taiga: [],
    blossom: [],
    savanna: [],
    swamp: [],
    highland: [],
  };
}

export function getVoxelTreeLibrary(): VoxelTreeLibrary {
  if (cachedVoxelTreeLib) return cachedVoxelTreeLib;

  const byBiome = makeEmptyBiomeRecord<THREE.BufferGeometry>();
  const byBiomeLod1 = makeEmptyBiomeRecord<THREE.BufferGeometry>();
  const byBiomeLod2 = makeEmptyBiomeRecord<THREE.BufferGeometry>();
  const byBiomeLod3 = makeEmptyBiomeRecord<THREE.BufferGeometry>();
  const burntByBiome = makeEmptyBiomeRecord<THREE.BufferGeometry>();
  const burntByBiomeLod1 = makeEmptyBiomeRecord<THREE.BufferGeometry>();
  const burntByBiomeLod2 = makeEmptyBiomeRecord<THREE.BufferGeometry>();
  const burntByBiomeLod3 = makeEmptyBiomeRecord<THREE.BufferGeometry>();
  const specsByBiome = makeEmptyBiomeRecord<VoxelTreeSpeciesSpec>();
  const allGeometries: THREE.BufferGeometry[] = [];
  const allExtraLodGeometries: THREE.BufferGeometry[] = [];

  for (const spec of SPECIES_SPECS) {
    const [g0, g1, g2, g3] = buildVoxelTreeLods(spec, false);
    const [b0, b1, b2, b3] = buildVoxelTreeLods(spec, true);
    byBiome[spec.biome].push(g0);
    byBiomeLod1[spec.biome].push(g1);
    byBiomeLod2[spec.biome].push(g2);
    byBiomeLod3[spec.biome].push(g3);
    burntByBiome[spec.biome].push(b0);
    burntByBiomeLod1[spec.biome].push(b1);
    burntByBiomeLod2[spec.biome].push(b2);
    burntByBiomeLod3[spec.biome].push(b3);
    specsByBiome[spec.biome].push(spec);
    allGeometries.push(g0);
    allExtraLodGeometries.push(g1, g2, g3, b0, b1, b2, b3);
  }

  const burntSets = buildBurntVoxelTreeLodSets();
  const burntTrees = burntSets.lod0;
  const burntTreesLod1 = burntSets.lod1;
  const burntTreesLod2 = burntSets.lod2;
  const burntTreesLod3 = burntSets.lod3;

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.04,
  });

  cachedVoxelTreeLib = {
    byBiome,
    byBiomeLod1,
    byBiomeLod2,
    byBiomeLod3,
    burntByBiome,
    burntByBiomeLod1,
    burntByBiomeLod2,
    burntByBiomeLod3,
    specsByBiome,
    allSpecs: SPECIES_SPECS,
    allGeometries,
    burntTrees,
    burntTreesLod1,
    burntTreesLod2,
    burntTreesLod3,
    material,
    dispose: () => {
      for (const g of allGeometries) g.dispose();
      for (const g of allExtraLodGeometries) g.dispose();
      for (const g of burntTrees) g.dispose();
      for (const g of burntTreesLod1) g.dispose();
      for (const g of burntTreesLod2) g.dispose();
      for (const g of burntTreesLod3) g.dispose();
      material.dispose();
      cachedVoxelTreeLib = null;
    },
  };

  return cachedVoxelTreeLib;
}
