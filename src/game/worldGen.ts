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
  seaLevelBias?: 'low' | 'normal' | 'high';
  mountainBias?: 'low' | 'normal' | 'high';
  climateBias?: 'cold' | 'balanced' | 'warm';
  allowFantasyBiomes?: boolean;
}

export function generateWorldTiles(
  gridSize: number,
  rawSeed: number,
  options?: WorldGenOptions,
): TileData[] {
  const seed = normalizeSeed(rawSeed);
  const rng = createRng(seed ^ 0x9e3779b9);
  const isScrapSea = options?.template === 'scrap_sea';

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

  // Seeded world-flavor parameters so each seed shifts continent style, mountain vigor, & climate
  const worldStyle = rng(); // archipelago / twin-bay / grand-continent
  const warpAmp = 6.5 + rng() * 5.0;
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

    const desiredLakes = Math.min(4, Math.max(2, Math.floor(gridSize / 34)));
    for (let l = 0; l < desiredLakes && lakeCandidates.length > 0; l++) {
      const pick = Math.floor(rng() * lakeCandidates.length);
      const cand = lakeCandidates.splice(pick, 1)[0];
      if (lakeCenters.some((other) => Math.hypot(other.x - cand.x, other.z - cand.z) < 16)) {
        continue;
      }
      const radius = 3.2 + rng() * 2.3;
      lakeCenters.push({ x: cand.x, z: cand.z, radius });

      const rCeil = Math.ceil(radius + 2);
      for (let oz = -rCeil; oz <= rCeil; oz++) {
        for (let ox = -rCeil; ox <= rCeil; ox++) {
          const nx = cand.x + ox;
          const nz = cand.z + oz;
          if (nx <= 2 || nx >= gridSize - 3 || nz <= 2 || nz >= gridSize - 3) continue;
          if (Math.hypot(nx - center, nz - center) < 7.0) continue;
          const nIdx = nz * gridSize + nx;
          const wobble = (warpNoise.sample(nx * 0.18 + l * 13, nz * 0.18) - 0.5) * 1.35;
          const d = Math.hypot(ox, oz) + wobble;
          if (d <= radius) {
            heightGrid[nIdx] = 0;
            lakeMask[nIdx] = 1;
          } else if (d <= radius + 1.8) {
            if (heightGrid[nIdx] > 2) heightGrid[nIdx] = 1;
            moistGrid[nIdx] = Math.min(1, moistGrid[nIdx] + 0.32);
          }
        }
      }
    }

    // Stage 3: Seeded Hydrology — trace lively, meandering shallow rivers from mountain springs to lakes & coast
    const springCandidates: number[] = [];
    for (let z = 6; z < gridSize - 6; z += 4) {
      for (let x = 6; x < gridSize - 6; x += 4) {
        const idx = z * gridSize + x;
        const distCenter = Math.hypot(x - center, z - center);
        if (heightGrid[idx] >= 4 && distCenter > 10.5) {
          springCandidates.push(idx);
        }
      }
    }

    const riverCount = Math.min(6, Math.max(3, Math.floor(gridSize / 24)));
    for (let r = 0; r < riverCount && springCandidates.length > 0; r++) {
      const pick = Math.floor(rng() * springCandidates.length);
      const currIdx = springCandidates.splice(pick, 1)[0];
      let cx = currIdx % gridSize;
      let cz = Math.floor(currIdx / gridSize);

      // Bias initial direction toward nearest lake or sea edge
      let targetX = cx + (cx - center) * 0.8;
      let targetZ = cz + (cz - center) * 0.8;
      if (lakeCenters.length > 0 && r % 2 === 0) {
        const lk = lakeCenters[r % lakeCenters.length];
        targetX = lk.x;
        targetZ = lk.z;
      }
      const initLen = Math.max(1, Math.hypot(targetX - cx, targetZ - cz));
      let dirX = (targetX - cx) / initLen;
      let dirZ = (targetZ - cz) / initLen;

      const maxSteps = gridSize * 2;
      for (let step = 0; step < maxSteps; step++) {
        if (cx <= 1 || cx >= gridSize - 2 || cz <= 1 || cz >= gridSize - 2) break;
        const distFromHome = Math.hypot(cx - center, cz - center);
        if (distFromHome < 6.5) break; // Never flood the starter acropolis

        const idx = cz * gridSize + cx;
        if (step > 3 && heightGrid[idx] === 0 && riverMask[idx] === 0) {
          break; // Reached ocean or inland lake!
        }

        // Carve shallow river bed with natural meandering bends and occasional wider pools
        heightGrid[idx] = 0;
        riverMask[idx] = 1;
        const widenPool = step > 8 && ((step + r * 5) % 6 === 0 || step > 22);
        if (widenPool) {
          const perpX = Math.abs(dirX) > Math.abs(dirZ) ? 0 : 1;
          const perpZ = perpX === 0 ? 1 : 0;
          const wx = cx + perpX;
          const wz = cz + perpZ;
          if (
            wx > 1 &&
            wx < gridSize - 2 &&
            wz > 1 &&
            wz < gridSize - 2 &&
            Math.hypot(wx - center, wz - center) > 6.5
          ) {
            const wIdx = wz * gridSize + wx;
            heightGrid[wIdx] = 0;
            riverMask[wIdx] = 1;
          }
        }

        // Gently terrace and hydrate riverbanks so rivers sit in lush, lively valleys instead of harsh trenches
        for (let oz = -3; oz <= 3; oz++) {
          for (let ox = -3; ox <= 3; ox++) {
            const nx = cx + ox;
            const nz = cz + oz;
            if (nx <= 0 || nx >= gridSize - 1 || nz <= 0 || nz >= gridSize - 1) continue;
            const nIdx = nz * gridSize + nx;
            const d = Math.hypot(ox, oz);
            if (d <= 1.5 && heightGrid[nIdx] > 2) {
              heightGrid[nIdx] = Math.min(heightGrid[nIdx], 2);
            }
            moistGrid[nIdx] = Math.min(1, moistGrid[nIdx] + Math.max(0, 0.34 - d * 0.08));
          }
        }

        // Sinusoidal meander sway + downhill gradient so rivers curve gracefully
        const swayAngle = Math.sin(step * 0.38 + r * 2.1) * 0.55;
        const cosS = Math.cos(swayAngle);
        const sinS = Math.sin(swayAngle);
        const swayDirX = dirX * cosS - dirZ * sinS;
        const swayDirZ = dirX * sinS + dirZ * cosS;

        let bestX = cx;
        let bestZ = cz;
        let bestScore = Infinity;
        const dirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        for (const [ox, oz] of dirs) {
          const nx = cx + ox;
          const nz = cz + oz;
          if (nx <= 0 || nx >= gridSize - 1 || nz <= 0 || nz >= gridSize - 1) continue;
          const nIdx = nz * gridSize + nx;
          if (riverMask[nIdx] === 1) continue;
          const dotMomentum = ox * swayDirX + oz * swayDirZ;
          const score = heightGrid[nIdx] * 1.25 - dotMomentum * 0.95 + rng() * 0.55;
          if (score < bestScore) {
            bestScore = score;
            bestX = nx;
            bestZ = nz;
          }
        }

        if (bestX === cx && bestZ === cz) break;
        dirX = dirX * 0.58 + (bestX - cx) * 0.42;
        dirZ = dirZ * 0.58 + (bestZ - cz) * 0.42;
        cx = bestX;
        cz = bestZ;
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
          const onContinentalShelf = minLandDist + shelfWave <= 3.8;
          terrain = nearLand || onContinentalShelf || isWarmReefZone ? 'shallow_water' : 'deep_water';

          if (isContiguousCoralBank && minLandDist > 1.2 && roll < 0.90) {
            resourceNode = 'coral_reef';
            resourceAmount = 260;
          } else if (terrain === 'deep_water' && roll < 0.015) {
            resourceNode = 'scrap_flotsam';
            resourceAmount = 260;
          }
        }
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
          // Lush riverbanks and lakeshores with wildflowers, reeds, and berry groves
          terrain = temp > 0.56 && bVar > 0.55 ? 'blossom' : 'fertile';
          if (roll < 0.42) {
            resourceNode = 'berry_bush';
            resourceAmount = 230;
          } else if (roll < 0.62) {
            resourceNode = 'timber_grove';
            resourceAmount = 240;
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
        } else if (isCoast && moist < 0.62 && dist > 6.0) {
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
      };
    }
  }

  // Stage 5.5: Seed Distinct Volcanic Wasteland, Land of Blight, and Floral Plains Signature Regions
  // complete with flowing lava rivers/lakes, poison green lakes/rivers, and crystal floral springs
  if (!isScrapSea && allowFantasyBiomes) {
    const signatureLandCandidates: Array<{ x: number; z: number }> = [];
    for (let z = 10; z < gridSize - 10; z += 4) {
      for (let x = 10; x < gridSize - 10; x += 4) {
        const distCenter = Math.hypot(x - center, z - center);
        if (distCenter < 10.5 || distCenter > maxRadius * 0.78) continue;
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
          if (Math.hypot(nx - center, nz - center) < 7.5) continue;
          const nIdx = nz * gridSize + nx;
          const t = tiles[nIdx];
          if (!t) continue;
          const wobble = (warpNoise.sample(nx * 0.2 + bc.x, nz * 0.2 + bc.z) - 0.5) * 1.45;
          const d = Math.hypot(ox, oz) + wobble;
          if (d > radius) continue;

          // Local coordinate along & perpendicular to the biome's signature river channel
          const along = ox * rCos + oz * rSin;
          const perp = -ox * rSin + oz * rCos + Math.sin(along * 0.65) * 0.85;
          const tileRoll = ((Math.abs(((nx * 73856093) ^ (nz * 19349663) ^ seed) | 0)) % 1000) / 1000;

          if (bc.kind === 'volcanic_wasteland') {
            // Central volcano caldera lava lake + flowing lava river channel
            const isCalderaPool = Math.hypot(ox, oz) <= 1.45;
            const isLavaChannel = along >= -0.5 && along <= radius * 0.92 && Math.abs(perp) <= 0.68;
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
            const isPoisonLake = Math.hypot(ox - 0.5, oz + 0.5) <= 1.75;
            const isPoisonChannel = along >= -radius * 0.75 && along <= radius * 0.85 && Math.abs(perp) <= 0.72;
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
            const isFloralSpring = Math.hypot(ox, oz) <= 1.35;
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
          t.terrain = ox === 0 && oz === 0 ? 'mountain' : 'sand';
          t.resourceNode = ox === 0 && oz === 0 ? 'stone_outcrop' : 'none';
          t.resourceAmount = ox === 0 && oz === 0 ? 220 : 0;
        }
      }
    }
  }

  return tiles;
}
