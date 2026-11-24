import { ResourceNodeType, TerrainType, TileData, WorldTemplateId } from './types';

/**
 * Normalizes an optional numeric or string seed into a deterministic 32-bit unsigned integer.
 * When omitted or blank, produces a fresh random 6-digit seed.
 */
export function normalizeSeed(input?: number | string): number {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return (Math.abs(Math.floor(input)) >>> 0) || 1;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.length > 0) {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed) && /^\d+$/.test(trimmed)) {
        return (Math.abs(Math.floor(parsed)) >>> 0) || 1;
      }
      let hash = 2166136261;
      for (let i = 0; i < trimmed.length; i++) {
        hash ^= trimmed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0) || 1;
    }
  }
  return Math.floor(100000 + Math.random() * 900000);
}

/**
 * Deterministic Mulberry32 PRNG returning floats in [0, 1).
 */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded 2D gradient/value noise with FBM and ridged-multifractal octaves
 * for organic continents, sweeping mountain ranges, and distinct climate zones.
 */
export function createNoise2D(seed: number) {
  const rng = createRng(seed);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    p[i] = i;
    vals[i] = rng();
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
  }

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const sample = (x: number, y: number): number => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = vals[perm[perm[xi] + yi]];
    const ab = vals[perm[perm[xi] + yi + 1]];
    const ba = vals[perm[perm[xi + 1] + yi]];
    const bb = vals[perm[perm[xi + 1] + yi + 1]];

    return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v);
  };

  const fbm = (x: number, y: number, octaves = 4, lacunarity = 2.0, gain = 0.5): number => {
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
      total += sample(x * frequency, y * frequency) * amplitude;
      maxAmp += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return total / maxAmp;
  };

  const ridged = (x: number, y: number, octaves = 4, lacunarity = 2.1, gain = 0.5): number => {
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
      const n = sample(x * frequency, y * frequency);
      const ridge = 1.0 - Math.abs(n * 2.0 - 1.0);
      total += ridge * ridge * amplitude;
      maxAmp += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return total / maxAmp;
  };

  return { sample, fbm, ridged };
}

export interface WorldGenOptions {
  template?: WorldTemplateId;
  singleBiome?: TerrainType;
  seaLevelBias?: 'low' | 'normal' | 'high';
  mountainBias?: 'low' | 'normal' | 'high';
  climateBias?: 'cold' | 'balanced' | 'warm';
  allowFantasyBiomes?: boolean;
}

function pickSingleBiomeResource(
  biome: TerrainType,
  roll: number,
  allowFantasyBiomes: boolean,
): { node: ResourceNodeType; amount: number } {
  switch (biome) {
    case 'forest':
    case 'jungle':
    case 'taiga':
    case 'blossom':
      if (roll < 0.72) return { node: 'timber_grove', amount: 250 };
      if (roll < 0.84) return { node: 'berry_bush', amount: 210 };
      return { node: 'none', amount: 0 };
    case 'floral_plains':
      if (roll < 0.46) return { node: 'timber_grove', amount: 260 };
      if (roll < 0.72) return { node: 'berry_bush', amount: 230 };
      if (roll < 0.80) return { node: 'stone_outcrop', amount: 240 };
      return { node: 'none', amount: 0 };
    case 'fertile':
      if (roll < 0.38) return { node: 'berry_bush', amount: 220 };
      if (roll < 0.56) return { node: 'timber_grove', amount: 230 };
      return { node: 'none', amount: 0 };
    case 'grass':
      if (roll < 0.16) return { node: 'timber_grove', amount: 220 };
      if (roll < 0.26) return { node: 'berry_bush', amount: 190 };
      if (roll < 0.31) return { node: 'stone_outcrop', amount: 240 };
      return { node: 'none', amount: 0 };
    case 'savanna':
      if (roll < 0.24) return { node: 'timber_grove', amount: 210 };
      if (roll < 0.34) return { node: 'stone_outcrop', amount: 220 };
      if (roll < 0.42) return { node: 'berry_bush', amount: 180 };
      return { node: 'none', amount: 0 };
    case 'swamp':
      if (roll < 0.54) return { node: 'timber_grove', amount: 220 };
      if (roll < 0.66) return { node: 'berry_bush', amount: 190 };
      return { node: 'none', amount: 0 };
    case 'highland':
      if (roll < 0.22) return { node: 'stone_outcrop', amount: 240 };
      if (roll < 0.36) return { node: 'timber_grove', amount: 220 };
      if (roll < 0.44) return { node: 'ore_vein', amount: 280 };
      return { node: 'none', amount: 0 };
    case 'mountain':
    case 'rock':
    case 'badlands':
      if (roll < 0.22) return { node: 'ore_vein', amount: 320 };
      if (roll < 0.44) return { node: 'stone_outcrop', amount: 270 };
      return { node: 'none', amount: 0 };
    case 'snow':
      if (roll < 0.14) {
        return { node: allowFantasyBiomes ? 'crystal_monolith' : 'ore_vein', amount: 360 };
      }
      if (roll < 0.32) return { node: 'stone_outcrop', amount: 280 };
      if (roll < 0.42) return { node: 'timber_grove', amount: 210 };
      return { node: 'none', amount: 0 };
    case 'tundra':
      if (roll < 0.16) return { node: 'stone_outcrop', amount: 240 };
      if (roll < 0.24) return { node: 'ore_vein', amount: 270 };
      if (roll < 0.34) return { node: 'timber_grove', amount: 210 };
      return { node: 'none', amount: 0 };
    case 'crystal_field':
      if (roll < 0.36) return { node: 'crystal_monolith', amount: 360 };
      if (roll < 0.48) return { node: 'stone_outcrop', amount: 260 };
      return { node: 'none', amount: 0 };
    case 'volcanic_wasteland':
      if (roll < 0.24) return { node: 'timber_grove', amount: 230 };
      if (roll < 0.44) return { node: 'ore_vein', amount: 340 };
      if (roll < 0.60) return { node: 'stone_outcrop', amount: 280 };
      return { node: 'none', amount: 0 };
    case 'blighted_mire':
      if (roll < 0.48) return { node: 'timber_grove', amount: 220 };
      if (roll < 0.64) return { node: 'stone_outcrop', amount: 250 };
      if (roll < 0.72) return { node: 'ore_vein', amount: 290 };
      return { node: 'none', amount: 0 };
    case 'sand':
    case 'scorched':
    case 'void_goo':
      if (roll < 0.16) return { node: 'stone_outcrop', amount: 240 };
      if (roll < 0.24) return { node: 'ore_vein', amount: 280 };
      return { node: 'none', amount: 0 };
    default:
      if (roll < 0.20) return { node: 'timber_grove', amount: 220 };
      if (roll < 0.30) return { node: 'stone_outcrop', amount: 240 };
      return { node: 'none', amount: 0 };
  }
}

export function generateWorldTiles(
  gridSize: number,
  rawSeed: number,
  options?: WorldGenOptions,
): TileData[] {
  const seed = normalizeSeed(rawSeed);
  const rng = createRng(seed ^ 0x9e3779b9);
  const isScrapSea = options?.template === 'scrap_sea';
  const isArchipelago = options?.template === 'archipelago';
  const forcedSingleBiome: TerrainType | null =
    options?.template === 'single_biome' ? (options.singleBiome ?? 'forest') : null;

  // Separate uncorrelated noise channels derived from the master seed
  const elevNoise = createNoise2D(seed + 101);
  const ridgeNoise = createNoise2D(seed + 2029);
  const warpNoise = createNoise2D(seed + 4049);
  const tempNoise = createNoise2D(seed + 7079);
  const moistNoise = createNoise2D(seed + 9091);
  const biomeNoise = createNoise2D(seed + 5113);
  const reefNoise = createNoise2D(seed + 12347);

  const center = (gridSize - 1) / 2;
  const maxRadius = Math.max(8, gridSize * 0.47);
  const totalTiles = gridSize * gridSize;

  const heightGrid = new Int32Array(totalTiles);
  const tempGrid = new Float32Array(totalTiles);
  const moistGrid = new Float32Array(totalTiles);
  const biomeVarGrid = new Float32Array(totalTiles);
  const riverMask = new Uint8Array(totalTiles);
  const lakeMask = new Uint8Array(totalTiles);
  // 1 = inside-bend depositional shoal (sandy/silty point bar), 2 = outside-bend erosional cut-bank (rocky/cobble)
  const riverPointBarMask = new Uint8Array(totalTiles);

  // Seeded world-flavor parameters so each seed shifts continent style, mountain vigor, & climate
  const worldStyle = rng(); // archipelago / twin-bay / grand-continent
  const warpAmp = isArchipelago ? 4.8 + rng() * 3.0 : 6.5 + rng() * 5.0;
  const mountainMult =
    options?.mountainBias === 'high' ? 1.25 : options?.mountainBias === 'low' ? 0.68 : 1.0;
  const ridgeStrength = (7.4 + rng() * 2.8) * mountainMult;
  const seaOffset =
    options?.seaLevelBias === 'high' ? -0.58 : options?.seaLevelBias === 'low' ? 0.48 : 0.0;
  const userTempOffset =
    options?.climateBias === 'warm' ? 0.14 : options?.climateBias === 'cold' ? -0.14 : 0.0;
  const allowFantasyBiomes = options?.allowFantasyBiomes ?? true;

  const climateBiasTemp = (rng() - 0.5) * 0.16 + userTempOffset;
  const climateBiasMoist = (rng() - 0.5) * 0.14;
  const ridgeAngle = rng() * Math.PI;
  const cosR = Math.cos(ridgeAngle);
  const sinR = Math.sin(ridgeAngle);

  // Dedicated curved Island Chains & Scattered Atolls field for the 'archipelago' template
  let archElevGrid: Float32Array | null = null;
  let archShelfGrid: Float32Array | null = null;
  let starterHubX = center;
  let starterHubZ = center;

  if (isArchipelago) {
    archElevGrid = new Float32Array(totalTiles);
    archShelfGrid = new Float32Array(totalTiles);

    const sizeScale = gridSize / 128;
    const radScale = Math.pow(sizeScale, 0.72);
    const margin = Math.max(6.5, gridSize * 0.085);
    const minBound = margin;
    const maxBound = gridSize - 1 - margin;
    const clampCoord = (v: number) => Math.max(minBound, Math.min(maxBound, v));

    interface ArchIslandNode {
      x: number;
      z: number;
      rx: number;
      rz: number;
      cosA: number;
      sinA: number;
      peak: number;
      chainIdx: number;
    }

    const nodes: ArchIslandNode[] = [];
    const chainCount = Math.max(2, Math.min(6, Math.round(2.4 + sizeScale * 0.9)));
    const nodesPerChain = Math.max(4, Math.min(8, Math.round(4.6 + sizeScale * 1.1)));
    const minChannelGap = Math.max(3.0, 4.0 * radScale);
    const baseRingAngle = rng() * Math.PI * 2;

    const canPlaceNode = (x: number, z: number, rx: number, rz: number, allowClose = false) => {
      const rSelf = Math.max(rx, rz);
      for (let i = 0; i < nodes.length; i++) {
        const other = nodes[i];
        const rOther = Math.max(other.rx, other.rz);
        const minSep = (rSelf + rOther) * (allowClose ? 0.78 : 0.88) + minChannelGap;
        const d = Math.hypot(x - other.x, z - other.z);
        if (d < minSep) return false;
      }
      return true;
    };

    const stampChainShelfPoint = (px: number, pz: number, shelfR: number) => {
      const rCeil = Math.ceil(shelfR);
      const minX = Math.max(0, Math.floor(px - rCeil));
      const maxX = Math.min(gridSize - 1, Math.ceil(px + rCeil));
      const minZ = Math.max(0, Math.floor(pz - rCeil));
      const maxZ = Math.min(gridSize - 1, Math.ceil(pz + rCeil));
      for (let gz = minZ; gz <= maxZ; gz++) {
        const dz = gz - pz;
        for (let gx = minX; gx <= maxX; gx++) {
          const dx = gx - px;
          const s = Math.max(0, 1.0 - Math.hypot(dx, dz) / shelfR);
          if (s > 0) {
            const idx = gz * gridSize + gx;
            if (s > archShelfGrid![idx]) archShelfGrid![idx] = s;
          }
        }
      }
    };

    for (let c = 0; c < chainCount; c++) {
      let midX: number;
      let midZ: number;
      let dirAngle: number;
      if (c === 0) {
        // Primary chain sweeps across the central region so camera & starter pioneers see islands right away
        const jitterA = rng() * Math.PI * 2;
        const jitterR = rng() * gridSize * 0.08;
        midX = clampCoord(center + Math.cos(jitterA) * jitterR);
        midZ = clampCoord(center + Math.sin(jitterA) * jitterR);
        dirAngle = rng() * Math.PI * 2;
      } else {
        const sectorA =
          baseRingAngle +
          ((c - 1) * Math.PI * 2) / Math.max(1, chainCount - 1) +
          (rng() - 0.5) * 0.65;
        const sectorR = gridSize * (0.24 + rng() * 0.13);
        midX = clampCoord(center + Math.cos(sectorA) * sectorR);
        midZ = clampCoord(center + Math.sin(sectorA) * sectorR);
        // Orient chain tangentially or diagonally for sweeping outer archipelago arcs
        dirAngle = sectorA + Math.PI * 0.5 + (rng() - 0.5) * 0.9;
      }

      const halfChord = gridSize * (0.22 + rng() * 0.15);
      const p0x = clampCoord(midX - Math.cos(dirAngle) * halfChord);
      const p0z = clampCoord(midZ - Math.sin(dirAngle) * halfChord);
      const p2x = clampCoord(midX + Math.cos(dirAngle) * halfChord);
      const p2z = clampCoord(midZ + Math.sin(dirAngle) * halfChord);

      const chordAngle = Math.atan2(p2z - p0z, p2x - p0x);
      const perpX = -Math.sin(chordAngle);
      const perpZ = Math.cos(chordAngle);
      const bow = (rng() < 0.5 ? -1 : 1) * gridSize * (0.09 + rng() * 0.14);
      const p1x = clampCoord((p0x + p2x) * 0.5 + perpX * bow);
      const p1z = clampCoord((p0z + p2z) * 0.5 + perpZ * bow);

      // Stamp shallow reef shelf ridge along the tectonic arc spine
      const shelfSamples = 18;
      for (let s = 0; s <= shelfSamples; s++) {
        const t = s / shelfSamples;
        const omt = 1 - t;
        const sx = omt * omt * p0x + 2 * omt * t * p1x + t * t * p2x;
        const sz = omt * omt * p0z + 2 * omt * t * p1z + t * t * p2z;
        stampChainShelfPoint(sx, sz, 7.2 * radScale);
      }

      // On chain 0, place the middle starter island first so neighboring links space cleanly around it
      const nodeIndices: number[] = [];
      const midN = Math.floor(nodesPerChain / 2);
      if (c === 0) nodeIndices.push(midN);
      for (let n = 0; n < nodesPerChain; n++) {
        if (c === 0 && n === midN) continue;
        nodeIndices.push(n);
      }

      for (const n of nodeIndices) {
        const t = Math.max(0.03, Math.min(0.97, (n + 0.18 + rng() * 0.64) / nodesPerChain));
        const omt = 1 - t;
        const bx = omt * omt * p0x + 2 * omt * t * p1x + t * t * p2x;
        const bz = omt * omt * p0z + 2 * omt * t * p1z + t * t * p2z;
        const tx = 2 * omt * (p1x - p0x) + 2 * t * (p2x - p1x);
        const tz = 2 * omt * (p1z - p0z) + 2 * t * (p2z - p1z);
        const tanAngle = Math.atan2(tz, tx);

        const lateralOffset = (rng() - 0.5) * 6.5 * radScale;
        let ix = clampCoord(bx - Math.sin(tanAngle) * lateralOffset);
        let iz = clampCoord(bz + Math.cos(tanAngle) * lateralOffset);

        const tierRoll = rng();
        const isStarterCentral = c === 0 && n === midN;
        let rx: number;
        let rz: number;
        let peak: number;
        if (isStarterCentral || tierRoll < 0.36) {
          // Major anchor island capable of supporting settlements, valleys & volcanic/rocky peaks
          rx = (8.2 + rng() * 3.8) * radScale;
          rz = rx * (0.6 + rng() * 0.28);
          peak = (3.8 + rng() * 3.2) * (0.75 + mountainMult * 0.25);
        } else if (tierRoll < 0.8) {
          // Medium stepping-stone island along the chain
          rx = (5.0 + rng() * 2.5) * radScale;
          rz = rx * (0.58 + rng() * 0.3);
          peak = (2.6 + rng() * 2.3) * (0.78 + mountainMult * 0.22);
        } else {
          // Small rocky spire or sandy cay
          rx = (3.0 + rng() * 1.6) * radScale;
          rz = rx * (0.64 + rng() * 0.28);
          peak = 2.0 + rng() * 1.8;
        }

        let placed = isStarterCentral || canPlaceNode(ix, iz, rx, rz);
        if (!placed) {
          // Retry with a compact stepping-stone size or lateral nudge so chains keep clean links
          const shrRx = Math.max(2.6 * radScale, rx * 0.68);
          const shrRz = Math.max(2.0 * radScale, rz * 0.68);
          for (const nudge of [0, 4.5 * radScale, -4.5 * radScale]) {
            const nx = clampCoord(ix - Math.sin(tanAngle) * nudge);
            const nz = clampCoord(iz + Math.cos(tanAngle) * nudge);
            if (canPlaceNode(nx, nz, shrRx, shrRz)) {
              ix = nx;
              iz = nz;
              rx = shrRx;
              rz = shrRz;
              placed = true;
              break;
            }
          }
        }

        if (placed) {
          const islandAngle = tanAngle + (rng() - 0.5) * 0.85;
          nodes.push({
            x: ix,
            z: iz,
            rx,
            rz,
            cosA: Math.cos(islandAngle),
            sinA: Math.sin(islandAngle),
            peak,
            chainIdx: c,
          });
          if (isStarterCentral) {
            starterHubX = ix;
            starterHubZ = iz;
          }
        }
      }
    }

    // Add scattered satellite islets / coral atolls in open sea pockets between chains
    const outlierAttempts = Math.max(14, Math.round(22 * sizeScale));
    for (let a = 0; a < outlierAttempts; a++) {
      const ix = minBound + rng() * Math.max(4, maxBound - minBound);
      const iz = minBound + rng() * Math.max(4, maxBound - minBound);
      const rx = (2.8 + rng() * 2.5) * radScale;
      const rz = rx * (0.64 + rng() * 0.28);
      const angle = rng() * Math.PI * 2;
      if (canPlaceNode(ix, iz, rx, rz)) {
        nodes.push({
          x: ix,
          z: iz,
          rx,
          rz,
          cosA: Math.cos(angle),
          sinA: Math.sin(angle),
          peak: 1.9 + rng() * 2.1,
          chainIdx: 100 + a,
        });
      }
    }

    // Precompute domain-warped coordinates once & stamp each island node locally via Math.max
    // (Using Math.max prevents adjacent islands from summing tails into land bridges!)
    const wxGrid = new Float32Array(totalTiles);
    const wzGrid = new Float32Array(totalTiles);
    for (let z = 0; z < gridSize; z++) {
      for (let x = 0; x < gridSize; x++) {
        const idx = z * gridSize + x;
        wxGrid[idx] = x + (warpNoise.fbm(x * 0.042, z * 0.042, 3) - 0.5) * warpAmp;
        wzGrid[idx] = z + (warpNoise.fbm(x * 0.042 + 37.2, z * 0.042 + 19.7, 3) - 0.5) * warpAmp;
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const maxR = Math.max(n.rx, n.rz);
      const boxR = Math.ceil(maxR * 1.55 + warpAmp + 3);
      const minX = Math.max(1, Math.floor(n.x - boxR));
      const maxX = Math.min(gridSize - 2, Math.ceil(n.x + boxR));
      const minZ = Math.max(1, Math.floor(n.z - boxR));
      const maxZ = Math.min(gridSize - 2, Math.ceil(n.z + boxR));

      for (let gz = minZ; gz <= maxZ; gz++) {
        for (let gx = minX; gx <= maxX; gx++) {
          const idx = gz * gridSize + gx;
          const dx = wxGrid[idx] - n.x;
          const dz = wzGrid[idx] - n.z;
          const u = dx * n.cosA + dz * n.sinA;
          const v = -dx * n.sinA + dz * n.cosA;
          const eDist = Math.hypot(u / n.rx, v / n.rz);
          if (eDist > 1.65) continue;

          // Multi-harmonic coastline wobble creates natural coves, headlands, and bays
          const coastWobble =
            (elevNoise.fbm(
              wxGrid[idx] * 0.085 + n.chainIdx * 13.7,
              wzGrid[idx] * 0.085 - n.x * 0.11,
              3,
            ) -
              0.5) *
            0.38;
          const effDist = eDist + coastWobble;
          if (effDist < 1.32) {
            const shelf = Math.max(0, (1.32 - effDist) * 0.9);
            if (shelf > archShelfGrid[idx]) archShelfGrid[idx] = shelf;
          }
          if (effDist < 1.0) {
            const dome = Math.pow(Math.max(0, 1.0 - effDist), 0.54) * n.peak;
            if (dome > archElevGrid[idx]) {
              archElevGrid[idx] = dome;
            }
          }
        }
      }
    }
  }

  // Stage 1 & 2: Domain-warped tectonic elevation + temperature + moisture fields
  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      const idx = z * gridSize + x;
      const dx = x - center;
      const dz = z - center;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const normDist = dist / maxRadius;

      // Domain warp coordinates so coastlines & ridges bend organically
      const wx = x + (warpNoise.fbm(x * 0.032, z * 0.032, 3) - 0.5) * warpAmp;
      const wz = z + (warpNoise.fbm(x * 0.032 + 37.2, z * 0.032 + 19.7, 3) - 0.5) * warpAmp;

      if (isScrapSea) {
        heightGrid[idx] = 0;
      } else if (isArchipelago && archElevGrid) {
        const islandElev = archElevGrid[idx];
        if (islandElev <= 0.02) {
          heightGrid[idx] = 0;
        } else {
          const detailHills = elevNoise.fbm(wx * 0.085 + 11.4, wz * 0.085 - 5.2, 3);
          const rx = wx * cosR - wz * sinR;
          const rz = wx * sinR + wz * cosR;
          const volcanoRidge =
            Math.pow(Math.max(0, ridgeNoise.ridged(rx * 0.032, rz * 0.032, 3) - 0.44) * 1.85, 1.2) *
            (1.9 * mountainMult);
          const interiorWeight = Math.min(1, islandElev / 1.35);
          // Map border fade keeps a clean ocean margin around outer islands
          const edgeMargin = Math.min(x, z, gridSize - 1 - x, gridSize - 1 - z);
          const borderFade = edgeMargin < 3 ? (3 - edgeMargin) * 1.5 : 0;
          // Archipelago preset itself defaults to 'high' seaLevelBias, so calibrate around +0.44 baseline
          const rawElevation =
            islandElev +
            0.44 +
            (detailHills - 0.5) * 1.15 * interiorWeight +
            volcanoRidge * interiorWeight +
            seaOffset * 0.35 -
            borderFade;
          heightGrid[idx] = Math.max(0, Math.min(9, Math.round(rawElevation)));
        }
      } else {
        // Continent base mass
        const macroLand = elevNoise.fbm(wx * 0.026, wz * 0.026, 4);
        const detailHills = elevNoise.fbm(wx * 0.075 + 11.4, wz * 0.075 - 5.2, 3);

        // Oriented mountain tectonic ridges (capable of rising into towering alpine chains up to height 10)
        const rx = wx * cosR - wz * sinR;
        const rz = wx * sinR + wz * cosR;
        const mountainBelt = ridgeNoise.ridged(rx * 0.024, rz * 0.036, 4);
        const ridgeExcess = Math.max(0, mountainBelt - 0.42);
        const mountainBoost = Math.pow(ridgeExcess * 1.9, 1.25) * ridgeStrength;

        // Continent falloff profile (varies between broad mainland and fragmented archipelago)
        const falloffPower = 1.65 + worldStyle * 0.55;
        const edgeFalloff = Math.pow(normDist, falloffPower) * (3.6 + worldStyle * 1.1);

        const rawElevation =
          1.15 +
          seaOffset +
          (macroLand - 0.42) * 5.2 +
          (detailHills - 0.5) * 2.0 +
          mountainBoost -
          edgeFalloff;

        let h = Math.max(0, Math.min(10, Math.round(rawElevation)));

        // Ensure central starting view has natural dry landmass rather than deep sea or impassable spire
        if (dist < 6.5 && h === 0) {
          h = 2;
        } else if (dist < 4.5 && h > 4) {
          h = 3;
        }

        heightGrid[idx] = h;
      }

      const h = heightGrid[idx];
      // Temperature drops at higher altitudes and follows a contrast-stretched warped latitude gradient
      const latFactor = Math.sin((z / Math.max(1, gridSize)) * Math.PI) * 0.14;
      const tempBase = 0.5 + (tempNoise.fbm(wx * 0.024 + 5.1, wz * 0.024 + 8.3, 3) - 0.5) * 1.75;
      const rawTemp =
        tempBase +
        latFactor -
        Math.max(0, h - 3) * 0.065 +
        climateBiasTemp;
      tempGrid[idx] = Math.max(0, Math.min(1, rawTemp));

      // Moisture field (contrast-stretched for clear deserts, jungles, swamps, and temperate meadows)
      const moistBase = 0.5 + (moistNoise.fbm(wx * 0.027 + 21.7, wz * 0.027 - 14.3, 4) - 0.5) * 1.75;
      const rawMoist =
        moistBase +
        (h === 1 ? 0.06 : 0) +
        climateBiasMoist;
      moistGrid[idx] = Math.max(0, Math.min(1, rawMoist));

      const rawBiomeVar = 0.5 + (biomeNoise.fbm(wx * 0.036 - 12.4, wz * 0.036 + 29.1, 3) - 0.5) * 1.85;
      biomeVarGrid[idx] = Math.max(0, Math.min(1, rawBiomeVar));
    }
  }

  // Stage 2.5: Carve Scenic Inland Lakes (enclosed shallow-water basins surrounded by lush shores)
  const lakeCenters: Array<{ x: number; z: number; radius: number }> = [];
  if (!isScrapSea) {
    const lakeCandidates: Array<{ x: number; z: number }> = [];
    for (let z = 12; z < gridSize - 12; z += 5) {
      for (let x = 12; x < gridSize - 12; x += 5) {
        const idx = z * gridSize + x;
        const distCenter = Math.hypot(x - center, z - center);
        if (distCenter < 9.5 || distCenter > maxRadius * 0.72) continue;
        if (heightGrid[idx] >= 1 && heightGrid[idx] <= 3) {
          // Ensure surrounded by dry land within 6 tiles so lake is enclosed inland
          let touchesOpenSea = false;
          for (let oz = -6; oz <= 6 && !touchesOpenSea; oz += 2) {
            for (let ox = -6; ox <= 6; ox += 2) {
              const nx = x + ox;
              const nz = z + oz;
              if (nx < 2 || nx >= gridSize - 2 || nz < 2 || nz >= gridSize - 2) {
                touchesOpenSea = true;
                break;
              }
              if (heightGrid[nz * gridSize + nx] === 0) {
                touchesOpenSea = true;
                break;
              }
            }
          }
          if (!touchesOpenSea) {
            lakeCandidates.push({ x, z });
          }
        }
      }
    }

    const desiredLakes = isArchipelago
      ? Math.min(2, Math.max(1, Math.floor(gridSize / 64)))
      : Math.min(4, Math.max(2, Math.floor(gridSize / 34)));
    for (let l = 0; l < desiredLakes && lakeCandidates.length > 0; l++) {
      const pick = Math.floor(rng() * lakeCandidates.length);
      const cand = lakeCandidates.splice(pick, 1)[0];
      if (lakeCenters.some((other) => Math.hypot(other.x - cand.x, other.z - cand.z) < 16)) {
        continue;
      }
      const radius = isArchipelago ? 2.1 + rng() * 1.2 : 3.6 + rng() * 2.6;
      lakeCenters.push({ x: cand.x, z: cand.z, radius });

      // Build 2–3 overlapping organic lobes so lakes have coves, bays & natural irregular shorelines
      const lobeCount = isArchipelago ? 2 : 2 + (rng() < 0.65 ? 1 : 0);
      const lobes: Array<{ lx: number; lz: number; lr: number }> = [
        { lx: cand.x, lz: cand.z, lr: radius },
      ];
      for (let lb = 1; lb < lobeCount; lb++) {
        const ang = rng() * Math.PI * 2;
        const off = radius * (0.48 + rng() * 0.42);
        lobes.push({
          lx: cand.x + Math.cos(ang) * off,
          lz: cand.z + Math.sin(ang) * off,
          lr: radius * (0.58 + rng() * 0.34),
        });
      }

      const rCeil = Math.ceil(radius * 2.0 + 3);
      for (let oz = -rCeil; oz <= rCeil; oz++) {
        for (let ox = -rCeil; ox <= rCeil; ox++) {
          const nx = cand.x + ox;
          const nz = cand.z + oz;
          if (nx <= 2 || nx >= gridSize - 3 || nz <= 2 || nz >= gridSize - 3) continue;
          if (Math.hypot(nx - starterHubX, nz - starterHubZ) < (isArchipelago ? 4.5 : 7.0)) continue;
          const nIdx = nz * gridSize + nx;
          const wobble =
            (warpNoise.fbm(nx * 0.14 + l * 13.7, nz * 0.14 - l * 7.3, 2) - 0.5) * 2.1;
          let minSignedDist = Infinity;
          for (let lb = 0; lb < lobes.length; lb++) {
            const lobe = lobes[lb];
            const sd = Math.hypot(nx - lobe.lx, nz - lobe.lz) + wobble - lobe.lr;
            if (sd < minSignedDist) minSignedDist = sd;
          }
          if (minSignedDist <= 0) {
            heightGrid[nIdx] = 0;
            lakeMask[nIdx] = 1;
          } else if (minSignedDist <= 2.4) {
            if (heightGrid[nIdx] > 2) heightGrid[nIdx] = 1;
            moistGrid[nIdx] = Math.min(1, moistGrid[nIdx] + Math.max(0.14, 0.40 - minSignedDist * 0.11));
          }
        }
      }
    }

    // Stage 3: Seeded Hydrology — smooth curving, meandering rivers with natural width growth,
    // inside-bend sandy/silty point-bar shoals, outside-bend rocky cut-banks, and flared coastal mouths
    const springCandidates: number[] = [];
    for (let z = 6; z < gridSize - 6; z += 4) {
      for (let x = 6; x < gridSize - 6; x += 4) {
        const idx = z * gridSize + x;
        const distCenter = Math.hypot(x - starterHubX, z - starterHubZ);
        if (heightGrid[idx] >= 4 && distCenter > (isArchipelago ? 5.5 : 10.5)) {
          springCandidates.push(idx);
        }
      }
    }

    const riverCount = isArchipelago
      ? Math.min(3, Math.max(1, Math.floor(gridSize / 48)))
      : Math.min(6, Math.max(3, Math.floor(gridSize / 24)));
    for (let r = 0; r < riverCount && springCandidates.length > 0; r++) {
      const pick = Math.floor(rng() * springCandidates.length);
      const currIdx = springCandidates.splice(pick, 1)[0];
      let rx = currIdx % gridSize;
      let rz = Math.floor(currIdx / gridSize);

      // Bias target toward an inland lake or outer coast
      let targetX = rx + (rx - center) * 1.15;
      let targetZ = rz + (rz - center) * 1.15;
      if (lakeCenters.length > 0 && r % 2 === 0) {
        const lk = lakeCenters[r % lakeCenters.length];
        targetX = lk.x;
        targetZ = lk.z;
      }
      let heading = Math.atan2(targetZ - rz, targetX - rx);
      const meanderPhase = rng() * Math.PI * 2;
      const meanderFreq = 0.085 + rng() * 0.045;
      const meanderAmp = 0.72 + rng() * 0.42;
      const stepDist = 0.58;
      const maxSteps = Math.round(gridSize * 2.8);
      const ownRiverTiles = new Uint8Array(totalTiles);
      let reachedWater = false;

      for (let step = 0; step < maxSteps; step++) {
        if (rx <= 1.5 || rx >= gridSize - 2.5 || rz <= 1.5 || rz >= gridSize - 2.5) break;
        const distFromHome = Math.hypot(rx - starterHubX, rz - starterHubZ);
        if (distFromHome < (isArchipelago ? 4.2 : 6.8)) {
          // Gently steer around the starter acropolis instead of abruptly terminating
          const awayAngle = Math.atan2(rz - starterHubZ, rx - starterHubX);
          heading = awayAngle;
          rx += Math.cos(heading) * stepDist;
          rz += Math.sin(heading) * stepDist;
          continue;
        }

        const ix = Math.round(rx);
        const iz = Math.round(rz);
        const cIdx = iz * gridSize + ix;
        if (step > 6 && heightGrid[cIdx] === 0 && ownRiverTiles[cIdx] === 0) {
          reachedWater = true;
        }

        // Smooth natural river width progression:
        // headwaters (0.8..1.05) -> mid-valley meandering river (1.15..1.65) -> wide estuary mouth (1.85..2.35)
        const progress = Math.min(1, step / Math.max(26, gridSize * 0.45));
        const poolPulse =
          Math.sin(step * 0.17 + r * 3.1) * 0.24 +
          (warpNoise.sample(rx * 0.12 + r * 5.3, rz * 0.12) - 0.5) * 0.34;
        const estuaryFlare = reachedWater ? 0.65 : 0;
        const baseRadius = isArchipelago
          ? 0.78 + progress * 0.65 + poolPulse * 0.55 + estuaryFlare * 0.55
          : 0.88 + progress * 0.92 + poolPulse + estuaryFlare;
        const riverRadius = Math.max(0.72, Math.min(2.45, baseRadius));

        // Signed meander curvature determines inside bend (point-bar shoal) vs outside bend (cut-bank)
        const swayRate = Math.cos(step * meanderFreq + meanderPhase);
        const perpX = -Math.sin(heading);
        const perpZ = Math.cos(heading);

        // Carve smooth circular river cross-section & softly terrace surrounding valley banks
        const bankReach = Math.ceil(riverRadius + 2.6);
        for (let oz = -bankReach; oz <= bankReach; oz++) {
          for (let ox = -bankReach; ox <= bankReach; ox++) {
            const nx = ix + ox;
            const nz = iz + oz;
            if (nx <= 1 || nx >= gridSize - 2 || nz <= 1 || nz >= gridSize - 2) continue;
            if (Math.hypot(nx - starterHubX, nz - starterHubZ) < (isArchipelago ? 4.0 : 6.5)) continue;
            const d = Math.hypot(nx - rx, nz - rz);
            const nIdx = nz * gridSize + nx;
            if (d <= riverRadius) {
              heightGrid[nIdx] = 0;
              riverMask[nIdx] = 1;
              ownRiverTiles[nIdx] = 1;
            } else if (d <= riverRadius + 2.2) {
              const bankDist = d - riverRadius;
              if (bankDist <= 1.25 && heightGrid[nIdx] > 2) {
                heightGrid[nIdx] = Math.min(heightGrid[nIdx], 2);
              } else if (bankDist <= 2.0 && heightGrid[nIdx] > 3) {
                heightGrid[nIdx] = Math.min(heightGrid[nIdx], 3);
              }
              moistGrid[nIdx] = Math.min(1, moistGrid[nIdx] + Math.max(0, 0.38 - bankDist * 0.13));

              // Mark inside of strong curves as depositional point-bar shoal (1), outside as cut-bank (2)
              if (bankDist <= 1.65 && Math.abs(swayRate) > 0.22 && riverPointBarMask[nIdx] === 0) {
                const sideDot = (nx - rx) * perpX + (nz - rz) * perpZ;
                const isInsideBend = sideDot * swayRate > 0;
                riverPointBarMask[nIdx] = isInsideBend ? 1 : 2;
              }
            }
          }
        }

        if (reachedWater) {
          // Carve 2 extra estuary tiles into the lake/sea mouth for a natural funnel blend, then stop
          break;
        }

        // Compute smooth continuous heading: downhill pull + target drift + sweeping sinusoidal meander + noise
        const toTargetAngle = Math.atan2(targetZ - rz, targetX - rx);
        let gradX = 0;
        let gradZ = 0;
        const sampleR = 3;
        const hL = heightGrid[iz * gridSize + Math.max(1, ix - sampleR)];
        const hR = heightGrid[iz * gridSize + Math.min(gridSize - 2, ix + sampleR)];
        const hU = heightGrid[Math.max(1, iz - sampleR) * gridSize + ix];
        const hD = heightGrid[Math.min(gridSize - 2, iz + sampleR) * gridSize + ix];
        gradX = hL - hR;
        gradZ = hU - hD;

        const targetPullX = Math.cos(toTargetAngle) * 0.85 + gradX * 0.22;
        const targetPullZ = Math.sin(toTargetAngle) * 0.85 + gradZ * 0.22;
        const baseAngle = Math.atan2(targetPullZ, targetPullX);

        const meanderOffset =
          Math.sin(step * meanderFreq + meanderPhase) * meanderAmp +
          (warpNoise.sample(rx * 0.07 + r * 9.1, rz * 0.07 - r * 4.3) - 0.5) * 0.65;
        const desiredHeading = baseAngle + meanderOffset;

        // Shortest angular interpolation so curves sweep smoothly without kinks
        let angleDiff = desiredHeading - heading;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        heading += angleDiff * 0.24;

        rx += Math.cos(heading) * stepDist;
        rz += Math.sin(heading) * stepDist;
      }
    }
  }

  // Stage 3.5: Uncommon Localized Warm Coral Reef Atolls & Coastal Sanctuary Lagoons (do not wrap 360° around islands)
  const reefZoneMask = new Uint8Array(totalTiles);
  const coastalReefCandidates: number[] = [];
  const offshoreReefCandidates: number[] = [];
  for (let z = 6; z < gridSize - 6; z += 2) {
    for (let x = 6; x < gridSize - 6; x += 2) {
      const idx = z * gridSize + x;
      if (heightGrid[idx] !== 0 || riverMask[idx] === 1 || lakeMask[idx] === 1) continue;
      if (tempGrid[idx] < 0.36) continue;
      if (isScrapSea) {
        if (Math.hypot(x - center, z - center) > 7) coastalReefCandidates.push(idx);
      } else {
        let touchesImmediateBeach = false;
        let nearbyLandCount = 0;
        for (let oz = -5; oz <= 5; oz++) {
          for (let ox = -5; ox <= 5; ox++) {
            const nx = x + ox;
            const nz = z + oz;
            if (nx >= 0 && nx < gridSize && nz >= 0 && nz < gridSize) {
              if (heightGrid[nz * gridSize + nx] > 0) {
                nearbyLandCount++;
                if (Math.abs(ox) <= 1 && Math.abs(oz) <= 1) {
                  touchesImmediateBeach = true;
                }
              }
            }
          }
        }
        // Prefer warm coastal lagoons 2-5 tiles off island shores so corals are clearly visible near islands without wrapping coastlines
        if (!touchesImmediateBeach && nearbyLandCount >= 2 && nearbyLandCount <= 34) {
          coastalReefCandidates.push(idx);
        } else if (!touchesImmediateBeach && nearbyLandCount === 0 && Math.hypot(x - center, z - center) < maxRadius * 0.82) {
          offshoreReefCandidates.push(idx);
        }
      }
    }
  }
  const reefCandidates =
    coastalReefCandidates.length >= 4
      ? coastalReefCandidates
      : [...coastalReefCandidates, ...offshoreReefCandidates];
  const desiredReefZones = isScrapSea
    ? Math.max(4, Math.min(8, Math.round(gridSize / 18)))
    : isArchipelago
      ? Math.max(6, Math.min(14, Math.round(gridSize / 12)))
      : Math.max(4, Math.min(7, Math.round(gridSize / 20)));
  const chosenReefCenters: Array<{ x: number; z: number; radius: number }> = [];
  for (let attempt = 0; attempt < 120 && chosenReefCenters.length < desiredReefZones && reefCandidates.length > 0; attempt++) {
    const pick = Math.floor(rng() * reefCandidates.length);
    const rIdx = reefCandidates.splice(pick, 1)[0];
    const rx = rIdx % gridSize;
    const rz = Math.floor(rIdx / gridSize);
    if (chosenReefCenters.some((c) => Math.hypot(c.x - rx, c.z - rz) < 16)) continue;
    const radius = isScrapSea ? 3.8 + rng() * 1.5 : 3.4 + rng() * 1.3;
    chosenReefCenters.push({ x: rx, z: rz, radius });
    const rCeil = Math.ceil(radius + 2);
    for (let oz = -rCeil; oz <= rCeil; oz++) {
      for (let ox = -rCeil; ox <= rCeil; ox++) {
        const nx = rx + ox;
        const nz = rz + oz;
        if (nx <= 1 || nx >= gridSize - 2 || nz <= 1 || nz >= gridSize - 2) continue;
        const nIdx = nz * gridSize + nx;
        if (heightGrid[nIdx] !== 0 || riverMask[nIdx] === 1 || lakeMask[nIdx] === 1) continue;
        const organicWave = (reefNoise.fbm(nx * 0.22 + attempt * 5.3, nz * 0.22 - 3.1, 2) - 0.5) * 1.5;
        const effDist = Math.hypot(ox, oz) + organicWave;
        if (effDist <= radius * 0.84) {
          reefZoneMask[nIdx] = 2; // Contiguous living coral reef bank
        } else if (effDist <= radius + 1.0) {
          if (reefZoneMask[nIdx] === 0) reefZoneMask[nIdx] = 1; // Surrounding turquoise lagoon shoal
        }
      }
    }
  }

  // Stage 4 & 5: Biome Classification & Contextual 1-4 Object Resource Node Seeding
  const tiles: TileData[] = new Array(totalTiles);

  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      const idx = z * gridSize + x;
      const h = heightGrid[idx];
      const temp = tempGrid[idx];
      const moist = moistGrid[idx];
      const bVar = biomeVarGrid[idx];
      const dx = x - center;
      const dz = z - center;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const normDist = dist / maxRadius;

      // Local deterministic tile hash for crisp non-grid resource placement
      const tileHash = Math.abs(((x * 73856093) ^ (z * 19349663) ^ (seed * 83492791)) | 0);
      const roll = (tileHash % 1000) / 1000;
      const isRiverTile = riverMask[idx] === 1;
      const isLakeTile = lakeMask[idx] === 1;
      const isWarmReefZone = reefZoneMask[idx] >= 1;
      const isContiguousCoralBank = reefZoneMask[idx] === 2;

      let terrain: TerrainType = 'grass';
      let resourceNode: ResourceNodeType = 'none';
      let resourceAmount = 0;

      if (h === 0) {
        if (isRiverTile || isLakeTile) {
          // Rivers and inland lakes ALWAYS use lively shallow water
          terrain = 'shallow_water';
          if (isRiverTile && roll < 0.14) {
            resourceNode = 'berry_bush';
            resourceAmount = 190;
          }
        } else if (isScrapSea) {
          // Scrap Sea template: shoals of warm coral reefs + deep ocean trenches + floating scrap piles
          const shoalVal = reefNoise.fbm(x * 0.055 + 3.7, z * 0.055 - 9.1, 3);
          const starterWarp = (reefNoise.fbm(x * 0.09 - 4.2, z * 0.09 + 6.8, 2) - 0.5) * 5.5;
          const isStarterShoal = dist + starterWarp < 8.5;
          terrain = isStarterShoal || isWarmReefZone || shoalVal > 0.48 ? 'shallow_water' : 'deep_water';
          if (dist > 2.2) {
            if (isContiguousCoralBank && roll < 0.88) {
              resourceNode = 'coral_reef';
              resourceAmount = 260;
            } else if (roll < 0.14 || (isStarterShoal && roll < 0.28)) {
              resourceNode = 'scrap_flotsam';
              resourceAmount = 340;
            }
          }
        } else {
          // Organic continental shelf hugging actual island/continent coastlines (never a map-centered circle!)
          let minLandDistSq = 999;
          for (let oz = -5; oz <= 5; oz++) {
            for (let ox = -5; ox <= 5; ox++) {
              const dSq = ox * ox + oz * oz;
              if (dSq >= minLandDistSq) continue;
              const nx = x + ox;
              const nz = z + oz;
              if (nx >= 0 && nx < gridSize && nz >= 0 && nz < gridSize) {
                if (heightGrid[nz * gridSize + nx] > 0) {
                  minLandDistSq = dSq;
                }
              }
            }
          }
          const minLandDist = Math.sqrt(minLandDistSq);
          const nearLand = minLandDist <= 2.5;
          const shelfWave =
            (reefNoise.fbm(x * 0.052 + 7.4, z * 0.052 - 4.8, 3) - 0.5) * 2.8 +
            (warpNoise.fbm(x * 0.11 - 2.1, z * 0.11 + 5.7, 2) - 0.5) * 1.4;
          const onChainRidge = isArchipelago && archShelfGrid ? archShelfGrid[idx] > 0.36 : false;
          const onContinentalShelf = minLandDist + shelfWave <= (isArchipelago ? 4.3 : 3.8);
          terrain = nearLand || onContinentalShelf || onChainRidge || isWarmReefZone ? 'shallow_water' : 'deep_water';

          if (isContiguousCoralBank && minLandDist > 1.2 && roll < 0.90) {
            resourceNode = 'coral_reef';
            resourceAmount = 260;
          } else if (terrain === 'deep_water' && roll < 0.015) {
            resourceNode = 'scrap_flotsam';
            resourceAmount = 260;
          }
        }
      } else if (forcedSingleBiome) {
        terrain = forcedSingleBiome;
        const picked = pickSingleBiomeResource(forcedSingleBiome, roll, allowFantasyBiomes);
        resourceNode = picked.node;
        resourceAmount = picked.amount;
      } else if (h >= 8 || (h >= 7 && temp < 0.45)) {
        // High alpine snow summits crowning towering mountain ranges
        terrain = 'snow';
        if (roll < 0.14) {
          resourceNode = allowFantasyBiomes ? 'crystal_monolith' : 'ore_vein';
          resourceAmount = 380;
        } else if (roll < 0.36) {
          resourceNode = 'stone_outcrop';
          resourceAmount = 290;
        }
      } else if (h >= 5) {
        // Jagged tectonic Mountain crags & mineral-rich alpine peaks
        const mysticPocket = allowFantasyBiomes && moist > 0.65 && temp < 0.46;
        if (mysticPocket) {
          terrain = 'crystal_field';
          if (roll < 0.38) {
            resourceNode = 'crystal_monolith';
            resourceAmount = 360;
          }
        } else {
          terrain = h >= 6 || roll > 0.28 ? 'mountain' : 'rock';
          if (roll < 0.24) {
            resourceNode = 'ore_vein';
            resourceAmount = 340;
          } else if (roll < 0.48) {
            resourceNode = 'stone_outcrop';
            resourceAmount = 280;
          }
        }
      } else if (h === 4) {
        // Foothills, canyon mesas, boreal taiga ridges & tropical cloud-forest slopes
        if (temp > 0.56 && moist < 0.38 && bVar > 0.46) {
          terrain = 'badlands';
          if (roll < 0.2) {
            resourceNode = 'ore_vein';
            resourceAmount = 300;
          } else if (roll < 0.38) {
            resourceNode = 'stone_outcrop';
            resourceAmount = 250;
          }
        } else if (temp > 0.54 && moist > 0.58) {
          terrain = 'jungle';
          if (roll < 0.76) {
            resourceNode = 'timber_grove';
            resourceAmount = 260;
          } else if (roll < 0.86) {
            resourceNode = 'berry_bush';
            resourceAmount = 210;
          }
        } else if (temp < 0.34) {
          terrain = moist > 0.48 ? 'taiga' : 'tundra';
          if (terrain === 'taiga' && roll < 0.70) {
            resourceNode = 'timber_grove';
            resourceAmount = 240;
          } else if (roll < 0.24) {
            resourceNode = 'stone_outcrop';
            resourceAmount = 250;
          }
        } else if (moist > 0.58 && temp >= 0.34) {
          terrain = bVar > 0.62 ? 'blossom' : 'forest';
          if (roll < 0.74) {
            resourceNode = 'timber_grove';
            resourceAmount = 240;
          }
        } else if (temp > 0.64 && moist < 0.34) {
          terrain = 'mountain';
          if (roll < 0.3) {
            resourceNode = roll < 0.15 ? 'ore_vein' : 'stone_outcrop';
            resourceAmount = 260;
          }
        } else {
          terrain = 'highland';
          if (roll < 0.2) {
            resourceNode = 'stone_outcrop';
            resourceAmount = 240;
          } else if (roll < 0.3) {
            resourceNode = 'timber_grove';
            resourceAmount = 220;
          }
        }
      } else {
        // Lowlands & Mid-elevation terraces (h = 1..3)
        let touchesRiverOrLake = false;
        for (let oz = -1; oz <= 1 && !touchesRiverOrLake; oz++) {
          for (let ox = -1; ox <= 1; ox++) {
            const nx = x + ox;
            const nz = z + oz;
            if (nx >= 0 && nx < gridSize && nz >= 0 && nz < gridSize) {
              const nIdx = nz * gridSize + nx;
              if (riverMask[nIdx] === 1 || lakeMask[nIdx] === 1) {
                touchesRiverOrLake = true;
                break;
              }
            }
          }
        }

        const isCoast =
          h === 1 &&
          !touchesRiverOrLake &&
          ((x > 0 && heightGrid[idx - 1] === 0) ||
            (x < gridSize - 1 && heightGrid[idx + 1] === 0) ||
            (z > 0 && heightGrid[idx - gridSize] === 0) ||
            (z < gridSize - 1 && heightGrid[idx + gridSize] === 0));

        if (touchesRiverOrLake) {
          // Coherent natural riverbanks & lakeshores:
          // - Sandy shoals & inside-bend point bars
          // - Rocky cobble/gravel banks on outside cut-banks & cool/elevated stretches
          // - Earthy/muddy silt banks
          // - Vegetated aquatic edges (no beach!) with stilt-root mangroves OR tall grasses & reeds
          const shoreStyleNoise = warpNoise.fbm(x * 0.085 + 19.3, z * 0.085 - 11.7, 2);
          const bendType = riverPointBarMask[idx]; // 1 = inside point bar, 2 = outside cut-bank

          if (temp < 0.34) {
            // Cold/sub-arctic riverbanks: rocky gravel or snowy/taiga edges
            if (shoreStyleNoise < 0.48 || bendType === 2 || h >= 2) {
              terrain = 'highland';
              if (roll < 0.36) {
                resourceNode = 'stone_outcrop';
                resourceAmount = 220;
              }
            } else {
              terrain = 'taiga';
              if (roll < 0.45) {
                resourceNode = 'timber_grove';
                resourceAmount = 230;
              }
            }
          } else if (bendType === 1 && h === 1 && shoreStyleNoise < 0.68) {
            // Inside river bend: natural deposited sandy shoal / point bar
            terrain = 'sand';
            if (roll < 0.14) {
              resourceNode = 'stone_outcrop';
              resourceAmount = 180;
            }
          } else if (
            (bendType === 2 && shoreStyleNoise < 0.58) ||
            (h >= 2 && shoreStyleNoise < 0.42) ||
            shoreStyleNoise < 0.21
          ) {
            // Rocky / gravelly cobble shoreline
            terrain = 'highland';
            if (roll < 0.42) {
              resourceNode = 'stone_outcrop';
              resourceAmount = 220;
            } else if (roll < 0.56) {
              resourceNode = 'berry_bush';
              resourceAmount = 190;
            }
          } else if (h === 1 && shoreStyleNoise < 0.40) {
            // Warm sandy shoal / beach cove
            terrain = 'sand';
            if (roll < 0.12) {
              resourceNode = 'stone_outcrop';
              resourceAmount = 170;
            }
          } else if (h === 1 && shoreStyleNoise < 0.54) {
            // Muddy / earthy silt riverbank (damp dirt shoreline)
            terrain = 'savanna';
            if (roll < 0.22) {
              resourceNode = 'stone_outcrop';
              resourceAmount = 180;
            } else if (roll < 0.38) {
              resourceNode = 'berry_bush';
              resourceAmount = 200;
            }
          } else if (h === 1 && temp > 0.45 && shoreStyleNoise < 0.74) {
            // Vegetated aquatic mangrove shoreline (no sand/rock beach — stilt-root mangroves & marsh reeds!)
            terrain = 'swamp';
            if (roll < 0.58) {
              resourceNode = 'timber_grove';
              resourceAmount = 240;
            } else if (roll < 0.72) {
              resourceNode = 'berry_bush';
              resourceAmount = 200;
            }
          } else {
            // Vegetated tall-grass, reed & wildflower bank (no sand/rock beach!)
            terrain = temp > 0.56 && bVar > 0.55 ? 'blossom' : 'fertile';
            if (roll < 0.36) {
              resourceNode = 'berry_bush';
              resourceAmount = 230;
            } else if (roll < 0.54) {
              resourceNode = 'timber_grove';
              resourceAmount = 240;
            }
          }
        } else if (temp > 0.58 && moist < 0.36 && h >= 2 && bVar > 0.49 && dist > 7.0) {
          // Terracotta Red-Rock Badlands Canyon
          terrain = 'badlands';
          if (roll < 0.16) {
            resourceNode = 'stone_outcrop';
            resourceAmount = 250;
          } else if (roll < 0.26) {
            resourceNode = 'ore_vein';
            resourceAmount = 300;
          }
        } else if (temp > 0.64 && moist < 0.35 && dist > 6.5) {
          // Arid Desert Dunes
          terrain = 'sand';
          if (roll < 0.14) {
            resourceNode = 'stone_outcrop';
            resourceAmount = 240;
          } else if (roll < 0.19) {
            resourceNode = 'ore_vein';
            resourceAmount = 280;
          }
        } else if (isCoast && moist < (isArchipelago ? 0.72 : 0.62) && (isArchipelago || dist > 6.0)) {
          // Coastal sandy beach
          terrain = 'sand';
        } else if (temp < 0.32 && dist > 7.0) {
          // Frigid Sub-Arctic Tundra & Frost-Tipped Boreal Taiga
          if (moist > 0.47) {
            terrain = 'taiga';
            if (roll < 0.72) {
              resourceNode = 'timber_grove';
              resourceAmount = 240;
            }
          } else {
            terrain = 'tundra';
            if (roll < 0.15) {
              resourceNode = 'stone_outcrop';
              resourceAmount = 240;
            } else if (roll < 0.21) {
              resourceNode = 'ore_vein';
              resourceAmount = 270;
            }
          }
        } else if (temp < 0.41 && moist > 0.48 && dist > 6.5) {
          // Cool Evergreen Boreal Taiga
          terrain = 'taiga';
          if (roll < 0.74) {
            resourceNode = 'timber_grove';
            resourceAmount = 250;
          } else if (roll < 0.82) {
            resourceNode = 'berry_bush';
            resourceAmount = 190;
          }
        } else if (temp > 0.55 && moist > 0.56 && dist > 5.5) {
          // Lush Tropical Rainforest Jungle
          terrain = 'jungle';
          if (roll < 0.8) {
            resourceNode = 'timber_grove';
            resourceAmount = 280;
          } else if (roll < 0.9) {
            resourceNode = 'berry_bush';
            resourceAmount = 220;
          }
        } else if (h <= 2 && moist > 0.68 && temp > 0.38 && dist > 6.0) {
          // Misty Wetland Swamp
          terrain = 'swamp';
          if (roll < 0.58) {
            resourceNode = 'timber_grove';
            resourceAmount = 220;
          } else if (roll < 0.68) {
            resourceNode = 'berry_bush';
            resourceAmount = 190;
          }
        } else if (
          allowFantasyBiomes &&
          temp >= 0.42 &&
          temp <= 0.64 &&
          moist >= 0.46 &&
          moist <= 0.66 &&
          bVar > 0.66 &&
          dist > 6.0
        ) {
          // Majestic Fantasy Floral Plains & Steppes
          terrain = 'floral_plains';
          if (roll < 0.48) {
            resourceNode = 'timber_grove';
            resourceAmount = 260;
          } else if (roll < 0.72) {
            resourceNode = 'berry_bush';
            resourceAmount = 230;
          } else if (roll < 0.80) {
            resourceNode = 'stone_outcrop';
            resourceAmount = 250;
          }
        } else if (
          temp >= 0.39 &&
          temp <= 0.62 &&
          moist > 0.47 &&
          bVar > 0.54 &&
          dist > 6.0
        ) {
          // Blooming Cherry Blossom Sakura Grove
          terrain = 'blossom';
          if (roll < 0.68) {
            resourceNode = 'timber_grove';
            resourceAmount = 240;
          } else if (roll < 0.78) {
            resourceNode = 'berry_bush';
            resourceAmount = 200;
          }
        } else if (allowFantasyBiomes && temp > 0.64 && moist < 0.34 && bVar < 0.34 && dist > 8.0) {
          // Volcanic Wasteland
          terrain = 'volcanic_wasteland';
          if (roll < 0.28) {
            resourceNode = 'timber_grove';
            resourceAmount = 220;
          } else if (roll < 0.46) {
            resourceNode = 'ore_vein';
            resourceAmount = 320;
          } else if (roll < 0.62) {
            resourceNode = 'stone_outcrop';
            resourceAmount = 270;
          }
        } else if (allowFantasyBiomes && h <= 3 && moist > 0.62 && temp > 0.44 && bVar < 0.32 && dist > 8.0) {
          // Land of Blight (Poisoned Purple Mire)
          terrain = 'blighted_mire';
          if (roll < 0.54) {
            resourceNode = 'timber_grove';
            resourceAmount = 210;
          } else if (roll < 0.68) {
            resourceNode = 'stone_outcrop';
            resourceAmount = 240;
          } else if (roll < 0.76) {
            resourceNode = 'ore_vein';
            resourceAmount = 280;
          }
        } else if (temp > 0.56 && moist < 0.48 && dist > 5.5) {
          // Golden Savanna Steppe
          terrain = 'savanna';
          if (roll < 0.22) {
            resourceNode = 'timber_grove';
            resourceAmount = 210;
          } else if (roll < 0.32) {
            resourceNode = 'stone_outcrop';
            resourceAmount = 220;
          } else if (roll < 0.39) {
            resourceNode = 'berry_bush';
            resourceAmount = 180;
          }
        } else if (moist > 0.54) {
          // Lush Woodland Forest
          terrain = 'forest';
          if (roll < 0.78) {
            resourceNode = 'timber_grove';
            resourceAmount = 250;
          }
        } else if (moist > 0.44 || h === 1) {
          // Fertile River Valley & Meadow
          terrain = 'fertile';
          if (roll < 0.36) {
            resourceNode = 'berry_bush';
            resourceAmount = 210;
          } else if (roll < 0.45) {
            resourceNode = 'timber_grove';
            resourceAmount = 220;
          }
        } else {
          // Temperate Grassland Plains
          terrain = 'grass';
          if (roll < 0.14) {
            resourceNode = 'timber_grove';
            resourceAmount = 220;
          } else if (roll < 0.22) {
            resourceNode = 'berry_bush';
            resourceAmount = 190;
          } else if (roll < 0.26 && dist > 5.0) {
            resourceNode = 'stone_outcrop';
            resourceAmount = 240;
          }
        }
      }

      const singleBiomeWaterKind =
        h === 0 && (isRiverTile || isLakeTile)
          ? forcedSingleBiome === 'volcanic_wasteland'
            ? ('lava' as const)
            : forcedSingleBiome === 'blighted_mire'
              ? ('poison' as const)
              : forcedSingleBiome === 'floral_plains'
                ? ('floral' as const)
                : undefined
          : undefined;

      tiles[idx] = {
        x,
        z,
        height: h,
        terrain,
        resourceNode,
        resourceAmount,
        blessedTimer: 0,
        cursedTimer: 0,
        onFireTimer: 0,
        buildingId: null,
        isRiver: isRiverTile || undefined,
        isLake: isLakeTile || undefined,
        waterKind: singleBiomeWaterKind,
      };
    }
  }

  // Stage 5.5: Seed Distinct Volcanic Wasteland, Land of Blight, and Floral Plains Signature Regions
  // complete with flowing lava rivers/lakes, poison green lakes/rivers, and crystal floral springs
  if (!isScrapSea && allowFantasyBiomes && !forcedSingleBiome) {
    const signatureLandCandidates: Array<{ x: number; z: number }> = [];
    for (let z = 10; z < gridSize - 10; z += 4) {
      for (let x = 10; x < gridSize - 10; x += 4) {
        const distHome = Math.hypot(x - starterHubX, z - starterHubZ);
        if (distHome < (isArchipelago ? 7.5 : 10.5)) continue;
        if (!isArchipelago && Math.hypot(x - center, z - center) > maxRadius * 0.78) continue;
        const t = tiles[z * gridSize + x];
        if (t && t.height >= 1 && t.height <= 4) {
          signatureLandCandidates.push({ x, z });
        }
      }
    }

    const pickedBiomeCenters: Array<{ x: number; z: number; kind: 'volcanic_wasteland' | 'blighted_mire' | 'floral_plains' }> = [];
    const biomeTargets: Array<'volcanic_wasteland' | 'blighted_mire' | 'floral_plains'> = [
      'floral_plains',
      'volcanic_wasteland',
      'blighted_mire',
    ];
    for (const kind of biomeTargets) {
      for (let attempt = 0; attempt < 40 && signatureLandCandidates.length > 0; attempt++) {
        const pick = Math.floor(rng() * signatureLandCandidates.length);
        const cand = signatureLandCandidates[pick];
        if (pickedBiomeCenters.some((p) => Math.hypot(p.x - cand.x, p.z - cand.z) < 15)) continue;
        signatureLandCandidates.splice(pick, 1);
        pickedBiomeCenters.push({ x: cand.x, z: cand.z, kind });
        break;
      }
    }

    for (const bc of pickedBiomeCenters) {
      const radius = bc.kind === 'floral_plains' ? 6.4 + rng() * 1.8 : 5.4 + rng() * 1.6;
      const rCeil = Math.ceil(radius + 2);
      const riverAngle = rng() * Math.PI * 2;
      const rCos = Math.cos(riverAngle);
      const rSin = Math.sin(riverAngle);

      for (let oz = -rCeil; oz <= rCeil; oz++) {
        for (let ox = -rCeil; ox <= rCeil; ox++) {
          const nx = bc.x + ox;
          const nz = bc.z + oz;
          if (nx <= 2 || nx >= gridSize - 3 || nz <= 2 || nz >= gridSize - 3) continue;
          if (Math.hypot(nx - starterHubX, nz - starterHubZ) < (isArchipelago ? 5.5 : 7.5)) continue;
          const nIdx = nz * gridSize + nx;
          const t = tiles[nIdx];
          if (!t) continue;
          // In archipelago worlds, preserve ocean straits and coastlines strictly (never fill sea into land bridges)
          if (isArchipelago && heightGrid[nIdx] === 0) continue;
          const wobble = (warpNoise.sample(nx * 0.2 + bc.x, nz * 0.2 + bc.z) - 0.5) * 1.45;
          const d = Math.hypot(ox, oz) + wobble;
          if (d > radius) continue;

          // Local coordinate along & perpendicular to the biome's signature river channel
          const along = ox * rCos + oz * rSin;
          const perp = -ox * rSin + oz * rCos + Math.sin(along * 0.65) * 0.85;
          const tileRoll = ((Math.abs(((nx * 73856093) ^ (nz * 19349663) ^ seed) | 0)) % 1000) / 1000;
          const enclosedInterior =
            !isArchipelago ||
            (heightGrid[nIdx - 1] > 0 &&
              heightGrid[nIdx + 1] > 0 &&
              heightGrid[nIdx - gridSize] > 0 &&
              heightGrid[nIdx + gridSize] > 0);

          if (bc.kind === 'volcanic_wasteland') {
            // Central volcano caldera lava lake + flowing lava river channel
            const isCalderaPool = Math.hypot(ox, oz) <= 1.45 && enclosedInterior;
            const isLavaChannel =
              enclosedInterior && along >= -0.5 && along <= radius * 0.92 && Math.abs(perp) <= 0.68;
            if (isCalderaPool || isLavaChannel) {
              t.height = 0;
              t.terrain = 'shallow_water';
              t.waterKind = 'lava';
              t.isLake = isCalderaPool || undefined;
              t.isRiver = !isCalderaPool || undefined;
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            } else {
              // Stepped volcanic rim around caldera
              if (Math.hypot(ox, oz) <= 2.6) {
                t.height = Math.max(t.height, 3);
              } else if (t.height === 0) {
                t.height = 1;
              }
              t.terrain = 'volcanic_wasteland';
              t.waterKind = undefined;
              if (tileRoll < 0.28) {
                t.resourceNode = 'timber_grove';
                t.resourceAmount = 230;
              } else if (tileRoll < 0.48) {
                t.resourceNode = 'ore_vein';
                t.resourceAmount = 340;
              } else if (tileRoll < 0.64) {
                t.resourceNode = 'stone_outcrop';
                t.resourceAmount = 280;
              } else {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              }
            }
          } else if (bc.kind === 'blighted_mire') {
            // Poison-filled green lake & winding toxic river through dark purple soil
            const isPoisonLake = Math.hypot(ox - 0.5, oz + 0.5) <= 1.75 && enclosedInterior;
            const isPoisonChannel =
              enclosedInterior &&
              along >= -radius * 0.75 &&
              along <= radius * 0.85 &&
              Math.abs(perp) <= 0.72;
            if (isPoisonLake || isPoisonChannel) {
              t.height = 0;
              t.terrain = 'shallow_water';
              t.waterKind = 'poison';
              t.isLake = isPoisonLake || undefined;
              t.isRiver = !isPoisonLake || undefined;
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            } else {
              if (t.height === 0) t.height = 1;
              t.terrain = 'blighted_mire';
              t.waterKind = undefined;
              if (tileRoll < 0.52) {
                t.resourceNode = 'timber_grove';
                t.resourceAmount = 220;
              } else if (tileRoll < 0.68) {
                t.resourceNode = 'stone_outcrop';
                t.resourceAmount = 250;
              } else if (tileRoll < 0.76) {
                t.resourceNode = 'ore_vein';
                t.resourceAmount = 290;
              } else {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              }
            }
          } else if (bc.kind === 'floral_plains') {
            // Majestic fantasy floral steppes with a crystal-clear floral spring pond
            const isFloralSpring = Math.hypot(ox, oz) <= 1.35 && enclosedInterior;
            if (isFloralSpring) {
              t.height = 0;
              t.terrain = 'shallow_water';
              t.waterKind = 'floral';
              t.isLake = true;
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            } else {
              if (t.height === 0) t.height = 1;
              // Gentle fantasy steppe terraces (heights 1..3)
              t.height = Math.min(3, Math.max(1, t.height));
              t.terrain = 'floral_plains';
              t.waterKind = undefined;
              if (tileRoll < 0.52) {
                t.resourceNode = 'timber_grove';
                t.resourceAmount = 270;
              } else if (tileRoll < 0.76) {
                t.resourceNode = 'berry_bush';
                t.resourceAmount = 240;
              } else if (tileRoll < 0.84) {
                t.resourceNode = 'stone_outcrop';
                t.resourceAmount = 250;
              } else {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              }
            }
          }
        }
      }
    }
  }

  // Stage 6: Rare Sunken City of Atlantis generation (~24% chance on normal worlds, 65% on scrap_sea/archipelago)
  const atlantisChance = isScrapSea || options?.seaLevelBias === 'high' ? 0.65 : 0.24;
  if (rng() < atlantisChance) {
    const seaCandidates: number[] = [];
    for (let z = 6; z < gridSize - 6; z += 3) {
      for (let x = 6; x < gridSize - 6; x += 3) {
        const idx = z * gridSize + x;
        const distCenter = Math.hypot(x - center, z - center);
        if (tiles[idx].height === 0 && !tiles[idx].isRiver && !tiles[idx].isLake && distCenter > 14) {
          seaCandidates.push(idx);
        }
      }
    }
    if (seaCandidates.length > 0) {
      const pickIdx = seaCandidates[Math.floor(rng() * seaCandidates.length)];
      const ax = pickIdx % gridSize;
      const az = Math.floor(pickIdx / gridSize);
      tiles[pickIdx].terrain = 'shallow_water';
      tiles[pickIdx].resourceNode = 'atlantis_ruin';
      tiles[pickIdx].resourceAmount = 1200;
      // Surround Atlantis with a crystal-clear shallow sanctuary lagoon so its underwater temple complex is fully visible
      for (let oz = -2; oz <= 2; oz++) {
        for (let ox = -2; ox <= 2; ox++) {
          if (ox === 0 && oz === 0) continue;
          const nx = ax + ox;
          const nz = az + oz;
          if (nx <= 1 || nx >= gridSize - 2 || nz <= 1 || nz >= gridSize - 2) continue;
          const nIdx = nz * gridSize + nx;
          if (tiles[nIdx].height === 0 && Math.hypot(ox, oz) <= 2.4) {
            tiles[nIdx].terrain = 'shallow_water';
            if (Math.hypot(ox, oz) <= 1.6) {
              tiles[nIdx].resourceNode = 'none';
              tiles[nIdx].resourceAmount = 0;
            }
          }
        }
      }
    }
  }

  // Seed explorable overland Ancient Ruins across continents (discoverable by citizens for relics or tomb guardians)
  const desiredRuins = Math.min(12, Math.max(4, Math.round(gridSize / 18)));
  const landRuinCandidates: number[] = [];
  for (let z = 5; z < gridSize - 5; z += 3) {
    for (let x = 5; x < gridSize - 5; x += 3) {
      const idx = z * gridSize + x;
      const t = tiles[idx];
      if (
        t &&
        t.height >= 1 &&
        t.height <= 5 &&
        !t.buildingId &&
        t.resourceNode === 'none' &&
        Math.hypot(x - center, z - center) > 10
      ) {
        landRuinCandidates.push(idx);
      }
    }
  }
  const placedRuins: Array<{ x: number; z: number }> = [];
  let ruinAttempts = 0;
  while (placedRuins.length < desiredRuins && landRuinCandidates.length > 0 && ruinAttempts < 120) {
    ruinAttempts++;
    const pick = Math.floor(rng() * landRuinCandidates.length);
    const idx = landRuinCandidates.splice(pick, 1)[0];
    const rx = idx % gridSize;
    const rz = Math.floor(idx / gridSize);
    if (placedRuins.some((p) => Math.hypot(p.x - rx, p.z - rz) < 12)) continue;
    tiles[idx].resourceNode = 'ancient_ruin';
    tiles[idx].resourceAmount = 1;
    placedRuins.push({ x: rx, z: rz });
  }

  // Stage 7: Seed 2-3 small isolated deep-sea rocky islets surrounded directly by deep_water
  if (!isScrapSea && options?.seaLevelBias !== 'low') {
    const deepIsletCandidates: number[] = [];
    for (let z = 8; z < gridSize - 8; z += 4) {
      for (let x = 8; x < gridSize - 8; x += 4) {
        let allDeep = true;
        for (let oz = -4; oz <= 4 && allDeep; oz++) {
          for (let ox = -4; ox <= 4; ox++) {
            const t = tiles[(z + oz) * gridSize + (x + ox)];
            if (!t || t.height > 0 || t.terrain !== 'deep_water' || t.resourceNode === 'atlantis_ruin') {
              allDeep = false;
              break;
            }
          }
        }
        if (allDeep) {
          deepIsletCandidates.push(z * gridSize + x);
        }
      }
    }
    const isletCount = Math.min(3, deepIsletCandidates.length);
    for (let k = 0; k < isletCount; k++) {
      const cIdx = deepIsletCandidates[Math.floor(rng() * deepIsletCandidates.length)];
      const ix = cIdx % gridSize;
      const iz = Math.floor(cIdx / gridSize);
      for (const [ox, oz] of [
        [0, 0],
        [1, 0],
        [0, 1],
      ] as const) {
        const t = tiles[(iz + oz) * gridSize + (ix + ox)];
        if (t && t.height === 0 && t.terrain === 'deep_water') {
          t.height = ox === 0 && oz === 0 ? 2 : 1;
          t.terrain = forcedSingleBiome ?? (ox === 0 && oz === 0 ? 'mountain' : 'sand');
          t.resourceNode = ox === 0 && oz === 0 ? 'stone_outcrop' : 'none';
          t.resourceAmount = ox === 0 && oz === 0 ? 220 : 0;
        }
      }
    }
  }

  return tiles;
}
