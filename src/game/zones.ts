import { EPOCHS, getDinosaurVariant } from './catalog';
import {
  AnimalRole,
  SimulationState,
  SpeciesId,
  TerrainType,
  ZoneOverlayType,
  ZoneToggleState,
} from './types';

export type { ZoneOverlayType, ZoneToggleState };

export const DEFAULT_ZONE_TOGGLES: ZoneToggleState = {
  kingdoms: false,
  territories: false,
  biomes: false,
  temperature: false,
};

export interface KingdomZoneInfo {
  zoneId: number; // 1..255
  settlementId: string;
  name: string;
  species: SpeciesId;
  speciesLabel: string;
  color: [number, number, number];
  hexColor: string;
  population: number;
  adultCount: number;
  childCount: number;
  buildingCount: number;
  farmTileCount: number;
  landTileCount: number;
  seaTileCount: number;
  totalTileCount: number;
  epochLevel: number;
  epochName: string;
  centerX: number;
  centerZ: number;
}

export interface TerritoryZoneInfo {
  zoneId: number; // 1..255
  id: string;
  name: string;
  species: AnimalRole | 'aquatic' | 'raider';
  speciesLabel: string;
  diet: 'Carnivore' | 'Herbivore' | 'Omnivore' | 'Apex' | 'Marine';
  domainType: 'Terrestrial' | 'Amphibious (Land & Sea)' | 'Aerial & Coastal' | 'Marine Waters';
  color: [number, number, number];
  hexColor: string;
  animalCount: number;
  leaderName: string;
  landTileCount: number;
  seaTileCount: number;
  totalTileCount: number;
  preferredBiomes: string[];
  centerX: number;
  centerZ: number;
}

export interface BiomeZoneInfo {
  zoneId: number; // 1..255
  biome: TerrainType;
  name: string;
  regionName: string;
  category: 'Marine' | 'Terrestrial' | 'Civilized' | 'Cataclysmic';
  color: [number, number, number];
  hexColor: string;
  tileCount: number;
  worldPercent: number;
  avgElevation: number;
  resourceCount: number;
  wildlifeCount: number;
  isAquatic: boolean;
  centerX: number;
  centerZ: number;
}

export type ThermalBandId = 'freezing' | 'cold' | 'temperate' | 'warm' | 'scorching';

export interface TemperatureZoneInfo {
  bandId: ThermalBandId;
  zoneId: number; // 1..5
  name: string;
  rangeLabel: string;
  color: [number, number, number];
  hexColor: string;
  tileCount: number;
  worldPercent: number;
  minTempC: number;
  maxTempC: number;
  avgTempC: number;
  effectSummary: string;
  centerX: number;
  centerZ: number;
}

export interface ZoneMapLabel {
  id: string;
  name: string;
  population: number | null;
  hexColor: string;
  tileX: number;
  tileZ: number;
  isHovered: boolean;
}

export interface WorldZonesData {
  gridSize: number;
  computedAtYear: number;
  kingdomMap: Uint8Array;
  kingdomIsSea: Uint8Array;
  kingdomsById: Map<number, KingdomZoneInfo>;
  territoryMap: Uint8Array;
  territoryIsSea: Uint8Array;
  territoriesById: Map<number, TerritoryZoneInfo>;
  biomeMap: Uint8Array;
  biomesById: Map<number, BiomeZoneInfo>;
  tempBandMap: Uint8Array;
  tempCelsiusMap: Int8Array;
  tempBandsById: Map<number, TemperatureZoneInfo>;
}

export interface TileZoneInspection {
  tileX: number;
  tileZ: number;
  elevation: number;
  isWater: boolean;
  biomeType: TerrainType;
  kingdom: KingdomZoneInfo | null;
  isKingdomMaritime: boolean;
  territory: TerritoryZoneInfo | null;
  isTerritoryAquatic: boolean;
  biomeZone: BiomeZoneInfo | null;
  temperatureZone: TemperatureZoneInfo | null;
  tileTempC: number;
  tileTempF: number;
}

const KINGDOM_PALETTES: Record<SpeciesId, Array<[number, number, number]>> = {
  human: [
    [59, 130, 246],  // Royal Azure
    [14, 165, 233],  // Cerulean
    [99, 102, 241],  // Indigo Banner
    [6, 182, 212],   // Cyan Maritime
  ],
  elf: [
    [16, 185, 129],  // Sylvan Emerald
    [52, 211, 153],  // Mint Canopy
    [132, 204, 22],  // Moss Gold
    [20, 184, 166],  // Jade Glade
  ],
  orc: [
    [239, 68, 68],   // Warband Crimson
    [249, 115, 22],  // Blood Orange
    [217, 70, 239],  // Warlock Magenta
    [234, 88, 12],   // Rust Iron
  ],
};

const BIOME_META: Record<
  TerrainType,
  {
    name: string;
    category: 'Marine' | 'Terrestrial' | 'Civilized' | 'Cataclysmic';
    color: [number, number, number];
    baseTempC: number;
  }
> = {
  deep_water: {
    name: 'Abyssal Trench',
    category: 'Marine',
    color: [30, 64, 175],
    baseTempC: 9,
  },
  shallow_water: {
    name: 'Coastal Shoals',
    category: 'Marine',
    color: [56, 189, 248],
    baseTempC: 16,
  },
  sand: {
    name: 'Sunlit Dunes',
    category: 'Terrestrial',
    color: [250, 204, 21],
    baseTempC: 27,
  },
  grass: {
    name: 'Verdant Meadows',
    category: 'Terrestrial',
    color: [74, 222, 128],
    baseTempC: 18,
  },
  fertile: {
    name: 'Lush Riverland',
    category: 'Terrestrial',
    color: [132, 204, 22],
    baseTempC: 20,
  },
  forest: {
    name: 'Ancient Woods',
    category: 'Terrestrial',
    color: [22, 163, 74],
    baseTempC: 15,
  },
  jungle: {
    name: 'Tropical Jungle',
    category: 'Terrestrial',
    color: [13, 148, 136],
    baseTempC: 28,
  },
  savanna: {
    name: 'Golden Savanna',
    category: 'Terrestrial',
    color: [234, 179, 8],
    baseTempC: 30,
  },
  swamp: {
    name: 'Mire Marsh',
    category: 'Terrestrial',
    color: [101, 163, 13],
    baseTempC: 23,
  },
  highland: {
    name: 'Windy Hills',
    category: 'Terrestrial',
    color: [168, 162, 158],
    baseTempC: 11,
  },
  mountain: {
    name: 'Granite Peaks',
    category: 'Terrestrial',
    color: [148, 163, 184],
    baseTempC: 4,
  },
  taiga: {
    name: 'Boreal Taiga',
    category: 'Terrestrial',
    color: [20, 184, 166],
    baseTempC: 5,
  },
  tundra: {
    name: 'Frozen Tundra',
    category: 'Terrestrial',
    color: [125, 211, 252],
    baseTempC: -3,
  },
  badlands: {
    name: 'Red Badlands',
    category: 'Terrestrial',
    color: [234, 88, 12],
    baseTempC: 34,
  },
  blossom: {
    name: 'Blossom Grove',
    category: 'Terrestrial',
    color: [244, 114, 182],
    baseTempC: 19,
  },
  stone_road: {
    name: 'Stone Road',
    category: 'Civilized',
    color: [214, 211, 209],
    baseTempC: 20,
  },
  rail_track: {
    name: 'Rail Track',
    category: 'Civilized',
    color: [161, 161, 170],
    baseTempC: 21,
  },
  runway: {
    name: 'Airfield Runway',
    category: 'Civilized',
    color: [113, 113, 122],
    baseTempC: 22,
  },
  rock: {
    name: 'Rocky Crags',
    category: 'Terrestrial',
    color: [120, 113, 108],
    baseTempC: 10,
  },
  snow: {
    name: 'Glacial Snow',
    category: 'Terrestrial',
    color: [226, 232, 240],
    baseTempC: -11,
  },
  scorched: {
    name: 'Ashen Waste',
    category: 'Cataclysmic',
    color: [220, 38, 38],
    baseTempC: 42,
  },
  crystal_field: {
    name: 'Crystal Fields',
    category: 'Cataclysmic',
    color: [232, 121, 249],
    baseTempC: 7,
  },
};

const THERMAL_BAND_META: Array<{
  zoneId: number;
  bandId: ThermalBandId;
  name: string;
  rangeLabel: string;
  color: [number, number, number];
  maxThreshold: number;
  effectSummary: string;
}> = [
  {
    zoneId: 1,
    bandId: 'freezing',
    name: 'Glacial Freeze',
    rangeLabel: '≤ 0°C (≤ 32°F)',
    color: [96, 165, 250],
    maxThreshold: 0,
    effectSummary: 'Frostbound tundra & peaks; suppresses wildfires and slows crop growth.',
  },
  {
    zoneId: 2,
    bandId: 'cold',
    name: 'Boreal Chill',
    rangeLabel: '1°C – 11°C (34°F – 52°F)',
    color: [56, 189, 248],
    maxThreshold: 11,
    effectSummary: 'Crisp highland & deep ocean currents; hardy timber and pine habitats.',
  },
  {
    zoneId: 3,
    bandId: 'temperate',
    name: 'Temperate Belt',
    rangeLabel: '12°C – 22°C (54°F – 72°F)',
    color: [74, 222, 128],
    maxThreshold: 22,
    effectSummary: 'Ideal agricultural & settlement climate; balanced moisture and fauna.',
  },
  {
    zoneId: 4,
    bandId: 'warm',
    name: 'Tropical Warmth',
    rangeLabel: '23°C – 31°C (73°F – 88°F)',
    color: [251, 191, 36],
    maxThreshold: 31,
    effectSummary: 'Lush jungles, savannas & warm lagoons; high biodiversity and dry brush.',
  },
  {
    zoneId: 5,
    bandId: 'scorching',
    name: 'Scorching Heat',
    rangeLabel: '≥ 32°C (≥ 90°F)',
    color: [239, 68, 68],
    maxThreshold: 999,
    effectSummary: 'Extreme thermal zone from badlands, wildfires, or industrial foundries.',
  },
];

function rgbToHex(rgb: [number, number, number]): string {
  return (
    '#' +
    rgb
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Computes all 4 dynamic zone layers (Kingdoms/Cities, Animal Territories, Biome Regions, Temperature Bands)
 * shaped organically by land elevation, coastlines, shallow/deep seas, roads, and habitats.
 */
export function computeWorldZones(sim: SimulationState): WorldZonesData {
  const size = sim.gridSize;
  const totalTiles = size * size;
  const tiles = sim.tiles;

  // ---------------------------------------------------------------------------
  // 1. KINGDOM / CITY ZONES (Land + Maritime Sea Waters for Intelligent Races)
  // ---------------------------------------------------------------------------
  const kingdomMap = new Uint8Array(totalTiles);
  const kingdomIsSea = new Uint8Array(totalTiles);
  const kingdomsById = new Map<number, KingdomZoneInfo>();

  interface DiscoveredSettlement {
    id: string;
    name: string;
    species: SpeciesId;
    buildingCount: number;
    completedCount: number;
    sumHp: number;
    sumMaxHp: number;
    sumX: number;
    sumZ: number;
    anchorCount: number;
    maxEpoch: number;
    adults: number;
    children: number;
  }

  const settlementTable = new Map<string, DiscoveredSettlement>();

  const ensureSettlement = (sid: string, fallbackSpecies: SpeciesId, x: number, z: number): DiscoveredSettlement => {
    let rec = settlementTable.get(sid);
    if (!rec) {
      const sp = sim.settlementSpecies?.[sid] ?? fallbackSpecies;
      const defaultLabel =
        sp === 'elf' ? 'Sylvan Glade' : sp === 'orc' ? 'Iron Crag' : 'Haven Hold';
      rec = {
        id: sid,
        name: sim.settlementNames?.[sid] || defaultLabel,
        species: sp,
        buildingCount: 0,
        completedCount: 0,
        sumHp: 0,
        sumMaxHp: 0,
        sumX: x,
        sumZ: z,
        anchorCount: 1,
        maxEpoch: sim.epochIndex,
        adults: 0,
        children: 0,
      };
      settlementTable.set(sid, rec);
    }
    return rec;
  };

  for (const b of sim.buildings) {
    if (b.hp <= 0) continue;
    const sid = b.settlementId || 'city_default';
    const rec = ensureSettlement(sid, b.species || 'human', b.tileX, b.tileZ);
    rec.buildingCount++;
    if (b.constructionProgress >= 100) rec.completedCount++;
    rec.sumHp += Math.max(0, b.hp);
    rec.sumMaxHp += Math.max(1, b.maxHp);
    rec.sumX += b.tileX;
    rec.sumZ += b.tileZ;
    rec.anchorCount++;
    if (b.epochLevel > rec.maxEpoch) rec.maxEpoch = b.epochLevel;
  }

  // Group living civilization units into their settlement (or nearest matching settlement / camp)
  for (const u of sim.units) {
    if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0) continue;
    let sid = u.settlementId;
    if (!sid || !settlementTable.has(sid)) {
      let bestDistSq = 28 * 28;
      let bestSid: string | null = null;
      settlementTable.forEach((cand) => {
        if (cand.species !== u.species) return;
        const cx = cand.sumX / cand.anchorCount;
        const cz = cand.sumZ / cand.anchorCount;
        const d2 = (u.x - cx) * (u.x - cx) + (u.z - cz) * (u.z - cz);
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestSid = cand.id;
        }
      });
      sid = bestSid || u.settlementId || `nomad_${u.species}`;
    }
    const rec = ensureSettlement(sid, u.species, u.x, u.z);
    if (u.ageStage === 'child') rec.children++;
    else rec.adults++;
    if (rec.buildingCount === 0) {
      rec.sumX += u.x;
      rec.sumZ += u.z;
      rec.anchorCount++;
    }
  }

  const settlementIdToZoneId = new Map<string, number>();
  const settlementStartCost = new Float32Array(256);
  const maxCostByZone = new Float32Array(256);
  const kCost = new Float32Array(totalTiles);
  kCost.fill(1e9);
  const queueIdx: number[] = [];

  let kIdxCounter = 0;
  settlementTable.forEach((s) => {
    const pop = s.adults + s.children;
    // If a lone foreign unit was killed while planting an unfinished structure (0 pop, 0 completed buildings), remove its zone immediately!
    if (pop === 0 && s.completedCount === 0) {
      return;
    }

    const zoneId = Math.min(254, ++kIdxCounter);
    settlementIdToZoneId.set(s.id, zoneId);
    const palette = KINGDOM_PALETTES[s.species] || KINGDOM_PALETTES.human;
    const color = palette[(zoneId - 1) % palette.length];
    const cx = Math.max(0, Math.min(size - 1, Math.round(s.sumX / s.anchorCount)));
    const cz = Math.max(0, Math.min(size - 1, Math.round(s.sumZ / s.anchorCount)));
    const epochDef = EPOCHS[Math.max(0, Math.min(EPOCHS.length - 1, s.maxEpoch))];

    kingdomsById.set(zoneId, {
      zoneId,
      settlementId: s.id,
      name: s.name,
      species: s.species,
      speciesLabel: s.species === 'human' ? 'Human Kingdom' : s.species === 'elf' ? 'Elven Realm' : 'Orcish Dominion',
      color,
      hexColor: rgbToHex(color),
      population: pop,
      adultCount: s.adults,
      childCount: s.children,
      buildingCount: s.buildingCount,
      farmTileCount: 0,
      landTileCount: 0,
      seaTileCount: 0,
      totalTileCount: 0,
      epochLevel: s.maxEpoch,
      epochName: epochDef ? epochDef.name : 'Prehistoric Age',
      centerX: cx,
      centerZ: cz,
    });

    const hpRatio = s.sumMaxHp > 0 ? Math.max(0.05, Math.min(1, s.sumHp / s.sumMaxHp)) : 1;
    if (pop === 0) {
      // Unpopulated ghost structures shrink as their HP decays/takes damage so enemy territory slowly creeps in!
      settlementStartCost[zoneId] = (1 - hpRatio) * 5.2;
      maxCostByZone[zoneId] = Math.max(1.2, 5.8 * hpRatio);
    } else {
      settlementStartCost[zoneId] = 0;
      const bonus = Math.min(7.5, s.buildingCount * 0.4 + pop * 0.16);
      maxCostByZone[zoneId] = 8.5 + bonus;
    }

    const cIdx = cz * size + cx;
    kCost[cIdx] = settlementStartCost[zoneId];
    kingdomMap[cIdx] = zoneId;
    queueIdx.push(cIdx);
  });

  // Seed from buildings
  for (const b of sim.buildings) {
    if (b.hp <= 0) continue;
    const sid = b.settlementId || 'city_default';
    const zoneId = settlementIdToZoneId.get(sid);
    if (!zoneId) continue;
    const bx = Math.max(0, Math.min(size - 1, Math.round(b.tileX)));
    const bz = Math.max(0, Math.min(size - 1, Math.round(b.tileZ)));
    const bIdx = bz * size + bx;
    const seedCost = settlementStartCost[zoneId];
    if (kCost[bIdx] > seedCost) {
      kCost[bIdx] = seedCost;
      kingdomMap[bIdx] = zoneId;
      queueIdx.push(bIdx);
    }
  }

  // Seed from cultivated farm tiles
  for (let i = 0; i < totalTiles; i++) {
    const tile = tiles[i];
    if (tile.farmSettlementId) {
      const zoneId = settlementIdToZoneId.get(tile.farmSettlementId);
      if (zoneId) {
        const info = kingdomsById.get(zoneId);
        if (info && info.population > 0) {
          info.farmTileCount++;
          if (kCost[i] > 0.4) {
            kCost[i] = 0.4;
            kingdomMap[i] = zoneId;
            queueIdx.push(i);
          }
        }
      }
    }
  }

  // Seed lightly from living citizen positions
  for (const u of sim.units) {
    if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0) continue;
    const sid = u.settlementId || `nomad_${u.species}`;
    const zoneId = settlementIdToZoneId.get(sid) || settlementIdToZoneId.get('city_default');
    if (!zoneId) continue;
    const ux = Math.max(0, Math.min(size - 1, Math.round(u.x)));
    const uz = Math.max(0, Math.min(size - 1, Math.round(u.z)));
    const uIdx = uz * size + ux;
    if (kCost[uIdx] > 2.2) {
      kCost[uIdx] = 2.2;
      kingdomMap[uIdx] = zoneId;
      queueIdx.push(uIdx);
    }
  }

  const dirs8 = [
    [-1, 0, 1.0],
    [1, 0, 1.0],
    [0, -1, 1.0],
    [0, 1, 1.0],
    [-1, -1, 1.414],
    [1, -1, 1.414],
    [-1, 1, 1.414],
    [1, 1, 1.414],
  ];

  // Terrain-weighted wavefront so kingdom borders contour along coastlines, bays, roads & mountains,
  // and extend into adjacent sea waters (intelligent creatures claim coastal/maritime waters!)
  let head = 0;
  while (head < queueIdx.length) {
    const curr = queueIdx[head++];
    const zid = kingdomMap[curr];
    if (!zid) continue;
    const currCost = kCost[curr];
    const maxBudget = maxCostByZone[zid];
    if (currCost >= maxBudget) continue;

    const cx = curr % size;
    const cz = (curr - cx) / size;
    const currTile = tiles[curr];

    for (let d = 0; d < dirs8.length; d++) {
      const nx = cx + dirs8[d][0];
      const nz = cz + dirs8[d][1];
      if (nx < 0 || nx >= size || nz < 0 || nz >= size) continue;

      const nIdx = nz * size + nx;
      const nTile = tiles[nIdx];
      let stepCost = dirs8[d][2];

      if (nTile.height === 0 || nTile.terrain === 'deep_water' || nTile.terrain === 'shallow_water') {
        // Intelligent creatures claim coastal waters, bays, harbors, and sea lanes!
        if (nTile.terrain === 'shallow_water') {
          stepCost *= 1.5; // Shallow coastal shelf / harbor waters
        } else {
          stepCost *= 2.75; // Deep maritime territorial limit
        }
      } else {
        // Land terrain shaping
        const elevDiff = Math.abs(nTile.height - currTile.height);
        if (
          nTile.terrain === 'stone_road' ||
          nTile.terrain === 'rail_track' ||
          nTile.terrain === 'runway' ||
          nTile.farmSettlementId
        ) {
          stepCost *= 0.65; // Roads, rails, and farmlands extend kingdom reach naturally
        } else if (nTile.terrain === 'mountain' || nTile.height >= 7) {
          stepCost *= 2.55; // Mountain ridges act as natural topographic borders
        } else if (nTile.terrain === 'swamp' || nTile.terrain === 'jungle') {
          stepCost *= 1.3;
        }
        stepCost += elevDiff * 0.45;
      }

      const nextCost = currCost + stepCost;
      if (nextCost <= maxBudget && nextCost + 0.01 < kCost[nIdx]) {
        kCost[nIdx] = nextCost;
        kingdomMap[nIdx] = zid;
        queueIdx.push(nIdx);
      }
    }
  }

  for (let i = 0; i < totalTiles; i++) {
    const zid = kingdomMap[i];
    if (!zid) continue;
    const tile = tiles[i];
    const isSea = tile.height === 0 || tile.terrain === 'deep_water' || tile.terrain === 'shallow_water';
    if (isSea) kingdomIsSea[i] = 1;
    const info = kingdomsById.get(zid);
    if (info) {
      info.totalTileCount++;
      if (isSea) info.seaTileCount++;
      else info.landTileCount++;
    }
  }

  // ---------------------------------------------------------------------------
  // 2. ANIMAL TERRITORY ZONES (Land Habitats, Amphibious Capybaras, Aerial Dragons, Marine Shoals)
  // ---------------------------------------------------------------------------
  const territoryMap = new Uint8Array(totalTiles);
  const territoryIsSea = new Uint8Array(totalTiles);
  const territoriesById = new Map<number, TerritoryZoneInfo>();

  interface WildlifeCluster {
    zoneId: number;
    species: AnimalRole | 'aquatic' | 'raider';
    isDinosaurHerbivore: boolean;
    members: Array<{ x: number; z: number; name: string }>;
    sumX: number;
    sumZ: number;
  }

  const clusters: WildlifeCluster[] = [];
  let nextTerritoryZoneId = 1;

  for (const u of sim.units) {
    if (u.faction === 'civilization') continue;
    const speciesKey: AnimalRole | 'raider' =
      u.faction === 'hostile' ? 'raider' : (u.role as AnimalRole);
    const isDinoHerb =
      u.role === 'dinosaur' && getDinosaurVariant(u.appearanceSeed).diet === 'herbivore';
    const clusterRadiusSq = u.role === 'dragon' ? 28 * 28 : 19 * 19;

    let matched: WildlifeCluster | null = null;
    for (const c of clusters) {
      if (c.species !== speciesKey || c.isDinosaurHerbivore !== isDinoHerb) continue;
      const cx = c.sumX / c.members.length;
      const cz = c.sumZ / c.members.length;
      const dx = u.x - cx;
      const dz = u.z - cz;
      if (dx * dx + dz * dz <= clusterRadiusSq) {
        matched = c;
        break;
      }
    }

    if (matched) {
      matched.members.push({ x: u.x, z: u.z, name: u.name || u.role });
      matched.sumX += u.x;
      matched.sumZ += u.z;
    } else if (nextTerritoryZoneId < 240) {
      clusters.push({
        zoneId: nextTerritoryZoneId++,
        species: speciesKey,
        isDinosaurHerbivore: isDinoHerb,
        members: [{ x: u.x, z: u.z, name: u.name || u.role }],
        sumX: u.x,
        sumZ: u.z,
      });
    }
  }

  const tCost = new Float32Array(totalTiles);
  tCost.fill(1e9);
  const tQueue: number[] = [];
  const tMaxCost = new Float32Array(256);

  const getSpeciesMeta = (
    species: AnimalRole | 'aquatic' | 'raider',
    isDinoHerb: boolean,
    idx: number
  ): {
    titlePrefix: string;
    speciesLabel: string;
    diet: TerritoryZoneInfo['diet'];
    domainType: TerritoryZoneInfo['domainType'];
    color: [number, number, number];
    preferredBiomes: string[];
    canEnterShallowWater: boolean;
    canEnterDeepWater: boolean;
    canEnterLand: boolean;
  } => {
    switch (species) {
      case 'wolf':
        return {
          titlePrefix: 'Wolf Pack',
          speciesLabel: 'Dire Wolf Pack',
          diet: 'Carnivore',
          domainType: 'Terrestrial',
          color: [248, 113, 113],
          preferredBiomes: ['Forest', 'Taiga', 'Snow', 'Meadows'],
          canEnterShallowWater: false,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      case 'bear':
        return {
          titlePrefix: 'Bear Den',
          speciesLabel: 'Grizzly Bear',
          diet: 'Carnivore',
          domainType: 'Terrestrial',
          color: [217, 119, 6],
          preferredBiomes: ['Forest', 'Highlands', 'Taiga'],
          canEnterShallowWater: false,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      case 'dragon':
        return {
          titlePrefix: 'Dragon Roost',
          speciesLabel: 'Elder Dragon',
          diet: 'Apex',
          domainType: 'Aerial & Coastal',
          color: [220, 38, 38],
          preferredBiomes: ['Granite Peaks', 'Badlands', 'Caldera', 'Coastal Skies'],
          canEnterShallowWater: true,
          canEnterDeepWater: true,
          canEnterLand: true,
        };
      case 'dinosaur':
        return isDinoHerb
          ? {
              titlePrefix: 'Dino Herd',
              speciesLabel: 'Herbivore Dinosaur',
              diet: 'Herbivore',
              domainType: 'Terrestrial',
              color: [52, 211, 153],
              preferredBiomes: ['Jungle', 'Swamp', 'Savanna'],
              canEnterShallowWater: false,
              canEnterDeepWater: false,
              canEnterLand: true,
            }
          : {
              titlePrefix: 'Raptor Pack',
              speciesLabel: 'Carnivore Dinosaur',
              diet: 'Carnivore',
              domainType: 'Terrestrial',
              color: [244, 63, 94],
              preferredBiomes: ['Jungle', 'Savanna', 'Badlands'],
              canEnterShallowWater: false,
              canEnterDeepWater: false,
              canEnterLand: true,
            };
      case 'capybara':
        return {
          titlePrefix: 'Capybara Lagoon',
          speciesLabel: 'Giant Capybara',
          diet: 'Herbivore',
          domainType: 'Amphibious (Land & Sea)',
          color: [45, 212, 191],
          preferredBiomes: ['Coastal Shoals', 'Swamp', 'Jungle', 'Riverland'],
          canEnterShallowWater: true,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      case 'unicorn':
        return {
          titlePrefix: 'Unicorn Glade',
          speciesLabel: 'Starlight Unicorn',
          diet: 'Herbivore',
          domainType: 'Terrestrial',
          color: [232, 121, 249],
          preferredBiomes: ['Crystal Fields', 'Sakura Grove', 'Ancient Woodlands'],
          canEnterShallowWater: false,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      case 'cow':
        return {
          titlePrefix: 'Cattle Pasture',
          speciesLabel: 'Highland Cattle',
          diet: 'Herbivore',
          domainType: 'Terrestrial',
          color: [163, 230, 53],
          preferredBiomes: ['Meadows', 'Riverland', 'Savanna'],
          canEnterShallowWater: false,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      case 'pig':
        return {
          titlePrefix: 'Boar Thicket',
          speciesLabel: 'Rooting Boar',
          diet: 'Omnivore',
          domainType: 'Terrestrial',
          color: [251, 146, 60],
          preferredBiomes: ['Meadows', 'Forest', 'Swamp'],
          canEnterShallowWater: false,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      case 'chicken':
        return {
          titlePrefix: 'Fowl Roost',
          speciesLabel: 'Wild Fowl',
          diet: 'Herbivore',
          domainType: 'Terrestrial',
          color: [250, 204, 21],
          preferredBiomes: ['Meadows', 'Shores'],
          canEnterShallowWater: false,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      case 'raider':
        return {
          titlePrefix: 'Raider Camp',
          speciesLabel: 'Hostile Raiders',
          diet: 'Carnivore',
          domainType: 'Terrestrial',
          color: [185, 28, 28],
          preferredBiomes: ['Badlands', 'Highlands', 'Steppe'],
          canEnterShallowWater: true,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      default:
        return {
          titlePrefix: idx % 2 === 0 ? 'Reef Shoal' : 'Deep Pod',
          speciesLabel: idx % 2 === 0 ? 'Reef Shoals' : 'Pelagic Fauna',
          diet: 'Marine',
          domainType: 'Marine Waters',
          color: idx % 2 === 0 ? [34, 211, 238] : [59, 130, 246],
          preferredBiomes: ['Coastal Shoals', 'Abyssal Trench'],
          canEnterShallowWater: true,
          canEnterDeepWater: true,
          canEnterLand: false,
        };
    }
  };

  for (const c of clusters) {
    const cx = Math.max(0, Math.min(size - 1, Math.round(c.sumX / c.members.length)));
    const cz = Math.max(0, Math.min(size - 1, Math.round(c.sumZ / c.members.length)));
    const meta = getSpeciesMeta(c.species, c.isDinosaurHerbivore, c.zoneId);

    territoriesById.set(c.zoneId, {
      zoneId: c.zoneId,
      id: `territory-${c.zoneId}`,
      name: meta.titlePrefix,
      species: c.species,
      speciesLabel: meta.speciesLabel,
      diet: meta.diet,
      domainType: meta.domainType,
      color: meta.color,
      hexColor: rgbToHex(meta.color),
      animalCount: c.members.length,
      leaderName: c.members[0]?.name || meta.speciesLabel,
      landTileCount: 0,
      seaTileCount: 0,
      totalTileCount: 0,
      preferredBiomes: meta.preferredBiomes,
      centerX: cx,
      centerZ: cz,
    });

    const baseBudget =
      c.species === 'dragon'
        ? 10.5
        : c.species === 'dinosaur' || c.species === 'wolf' || c.species === 'bear'
        ? 7.8
        : 6.4;
    tMaxCost[c.zoneId] = baseBudget + Math.min(4.5, c.members.length * 0.75);

    for (const m of c.members) {
      const mx = Math.max(0, Math.min(size - 1, Math.round(m.x)));
      const mz = Math.max(0, Math.min(size - 1, Math.round(m.z)));
      const mIdx = mz * size + mx;
      const mTile = tiles[mIdx];
      const isWater =
        mTile.height === 0 || mTile.terrain === 'deep_water' || mTile.terrain === 'shallow_water';
      if (isWater && !meta.canEnterShallowWater && !meta.canEnterDeepWater) continue;
      tCost[mIdx] = 0;
      territoryMap[mIdx] = c.zoneId;
      tQueue.push(mIdx);
    }
  }

  // Also seed major marine/aquatic ecological territories in substantial shallow reefs / ocean basins
  // so sea fauna territories are visible and shaped by underwater topography
  const visitedMarine = new Uint8Array(totalTiles);
  let marineBasinIdx = 0;
  for (let z = 6; z < size - 6; z += 14) {
    for (let x = 6; x < size - 6; x += 14) {
      if (nextTerritoryZoneId >= 250) break;
      const idx = z * size + x;
      const tile = tiles[idx];
      if (tile.terrain !== 'shallow_water' || visitedMarine[idx]) continue;

      let reefCount = 0;
      for (let dz = -4; dz <= 4; dz++) {
        for (let dx = -4; dx <= 4; dx++) {
          const nx = x + dx;
          const nz = z + dz;
          if (nx >= 0 && nx < size && nz >= 0 && nz < size) {
            const nIdx = nz * size + nx;
            if (tiles[nIdx].terrain === 'shallow_water') reefCount++;
            visitedMarine[nIdx] = 1;
          }
        }
      }
      if (reefCount >= 18 && marineBasinIdx < 5) {
        marineBasinIdx++;
        const zid = nextTerritoryZoneId++;
        const meta = getSpeciesMeta('aquatic', false, zid);
        territoriesById.set(zid, {
          zoneId: zid,
          id: `marine-territory-${zid}`,
          name: meta.titlePrefix,
          species: 'aquatic',
          speciesLabel: meta.speciesLabel,
          diet: meta.diet,
          domainType: 'Marine Waters',
          color: meta.color,
          hexColor: rgbToHex(meta.color),
          animalCount: Math.max(4, Math.round(reefCount / 4)),
          leaderName: 'Elder Leviathan Shoal',
          landTileCount: 0,
          seaTileCount: 0,
          totalTileCount: 0,
          preferredBiomes: meta.preferredBiomes,
          centerX: x,
          centerZ: z,
        });
        tMaxCost[zid] = 8.2;
        tCost[idx] = 0;
        territoryMap[idx] = zid;
        tQueue.push(idx);
      }
    }
  }

  // Expand animal territories dynamically respecting land/sea boundaries & habitat biomes
  let tHead = 0;
  while (tHead < tQueue.length) {
    const curr = tQueue[tHead++];
    const zid = territoryMap[curr];
    if (!zid) continue;
    const info = territoriesById.get(zid);
    if (!info) continue;
    const currCost = tCost[curr];
    const maxBudget = tMaxCost[zid];
    if (currCost >= maxBudget) continue;

    const cx = curr % size;
    const cz = (curr - cx) / size;
    const currTile = tiles[curr];

    const isAquaticOnly = info.species === 'aquatic';
    const isAmphibious = info.species === 'capybara' || info.species === 'raider';
    const isAerial = info.species === 'dragon';

    for (let d = 0; d < dirs8.length; d++) {
      const nx = cx + dirs8[d][0];
      const nz = cz + dirs8[d][1];
      if (nx < 0 || nx >= size || nz < 0 || nz >= size) continue;

      const nIdx = nz * size + nx;
      const nTile = tiles[nIdx];
      const isShallow = nTile.terrain === 'shallow_water';
      const isDeep = nTile.terrain === 'deep_water';
      const isWater = nTile.height === 0 || isShallow || isDeep;

      // Strict land/sea enforcement based on creature biology!
      if (isAquaticOnly && !isWater) continue; // Marine shoals never climb onto dry land
      if (!isAquaticOnly && !isAmphibious && !isAerial && isWater) continue; // Land wildlife strictly stop at the shoreline
      if (isAmphibious && isDeep) continue; // Capybaras swim in coastal lagoons/shallows, not abyssal trenches

      let stepCost = dirs8[d][2];

      if (isAquaticOnly) {
        stepCost *= isShallow ? 0.9 : 1.45;
      } else if (isAmphibious) {
        if (isShallow || nTile.terrain === 'swamp' || nTile.terrain === 'jungle' || nTile.terrain === 'fertile') {
          stepCost *= 0.85;
        } else {
          stepCost *= 1.35;
        }
      } else if (isAerial) {
        if (nTile.terrain === 'mountain' || nTile.terrain === 'badlands' || nTile.terrain === 'scorched') {
          stepCost *= 0.82;
        } else if (isWater) {
          stepCost *= 1.45;
        }
      } else {
        // Terrestrial animals prefer their natural biome and avoid steep cliffs or paved cities
        const elevDiff = Math.abs(nTile.height - currTile.height);
        stepCost += elevDiff * 0.42;
        if (nTile.terrain === 'stone_road' || nTile.terrain === 'rail_track' || nTile.farmSettlementId) {
          stepCost *= 1.65; // Wildlife shy away from heavy civilization
        } else if (
          (info.species === 'wolf' || info.species === 'bear') &&
          (nTile.terrain === 'forest' || nTile.terrain === 'taiga' || nTile.terrain === 'snow' || nTile.terrain === 'mountain')
        ) {
          stepCost *= 0.85;
        } else if (
          info.species === 'dinosaur' &&
          (nTile.terrain === 'jungle' || nTile.terrain === 'savanna' || nTile.terrain === 'swamp')
        ) {
          stepCost *= 0.85;
        }
      }

      const nextCost = currCost + stepCost;
      if (nextCost <= maxBudget && nextCost + 0.01 < tCost[nIdx]) {
        tCost[nIdx] = nextCost;
        territoryMap[nIdx] = zid;
        tQueue.push(nIdx);
      }
    }
  }

  for (let i = 0; i < totalTiles; i++) {
    const zid = territoryMap[i];
    if (!zid) continue;
    const tile = tiles[i];
    const isSea = tile.height === 0 || tile.terrain === 'deep_water' || tile.terrain === 'shallow_water';
    if (isSea) territoryIsSea[i] = 1;
    const info = territoriesById.get(zid);
    if (info) {
      info.totalTileCount++;
      if (isSea) info.seaTileCount++;
      else info.landTileCount++;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. BIOME ZONES (Contiguous Land & Sea Ecological Regions)
  // ---------------------------------------------------------------------------
  const biomeMap = new Uint8Array(totalTiles);
  const biomesById = new Map<number, BiomeZoneInfo>();

  const BIOME_ORDER: TerrainType[] = [
    'deep_water',
    'shallow_water',
    'sand',
    'grass',
    'fertile',
    'forest',
    'jungle',
    'savanna',
    'swamp',
    'highland',
    'mountain',
    'taiga',
    'tundra',
    'badlands',
    'blossom',
    'stone_road',
    'rail_track',
    'runway',
    'rock',
    'snow',
    'scorched',
    'crystal_field',
  ];

  const biomeToZoneId = new Map<TerrainType, number>();
  BIOME_ORDER.forEach((b, idx) => {
    const zid = idx + 1;
    biomeToZoneId.set(b, zid);
    const meta = BIOME_META[b];
    biomesById.set(zid, {
      zoneId: zid,
      biome: b,
      name: meta.name,
      regionName: `${meta.name} Zone`,
      category: meta.category,
      color: meta.color,
      hexColor: rgbToHex(meta.color),
      tileCount: 0,
      worldPercent: 0,
      avgElevation: 0,
      resourceCount: 0,
      wildlifeCount: 0,
      isAquatic: b === 'deep_water' || b === 'shallow_water',
      centerX: Math.floor(size / 2),
      centerZ: Math.floor(size / 2),
    });
  });

  const elevSumByBiome = new Float64Array(32);
  const sumXByBiome = new Float64Array(32);
  const sumZByBiome = new Float64Array(32);
  for (let i = 0; i < totalTiles; i++) {
    const tile = tiles[i];
    const zid = biomeToZoneId.get(tile.terrain) || 1;
    biomeMap[i] = zid;
    const info = biomesById.get(zid);
    if (info) {
      info.tileCount++;
      elevSumByBiome[zid] += tile.height;
      sumXByBiome[zid] += tile.x;
      sumZByBiome[zid] += tile.z;
      if (tile.resourceNode && tile.resourceNode !== 'none') {
        info.resourceCount++;
      }
    }
  }

  for (const u of sim.units) {
    if (u.faction === 'civilization') continue;
    const ux = Math.max(0, Math.min(size - 1, Math.round(u.x)));
    const uz = Math.max(0, Math.min(size - 1, Math.round(u.z)));
    const zid = biomeMap[uz * size + ux];
    const info = biomesById.get(zid);
    if (info) info.wildlifeCount++;
  }

  biomesById.forEach((info, zid) => {
    if (info.tileCount > 0) {
      info.worldPercent = Math.round((info.tileCount / totalTiles) * 1000) / 10;
      info.avgElevation = Math.round((elevSumByBiome[zid] / info.tileCount) * 10) / 10;
      const cx = Math.round(sumXByBiome[zid] / info.tileCount);
      const cz = Math.round(sumZByBiome[zid] / info.tileCount);
      info.centerX = Math.max(2, Math.min(size - 3, cx));
      info.centerZ = Math.max(2, Math.min(size - 3, cz));
    }
  });

  // ---------------------------------------------------------------------------
  // 4. TEMPERATURE ZONES (Contoured Thermal Bands shaped by Land/Sea, Elevation & Heat Sources)
  // ---------------------------------------------------------------------------
  const tempBandMap = new Uint8Array(totalTiles);
  const tempCelsiusMap = new Int8Array(totalTiles);
  const tempBandsById = new Map<number, TemperatureZoneInfo>();

  const tempSumByBand = new Float64Array(8);
  const sumXByTemp = new Float64Array(8);
  const sumZByTemp = new Float64Array(8);
  for (const bMeta of THERMAL_BAND_META) {
    tempBandsById.set(bMeta.zoneId, {
      bandId: bMeta.bandId,
      zoneId: bMeta.zoneId,
      name: bMeta.name,
      rangeLabel: bMeta.rangeLabel,
      color: bMeta.color,
      hexColor: rgbToHex(bMeta.color),
      tileCount: 0,
      worldPercent: 0,
      minTempC: 99,
      maxTempC: -99,
      avgTempC: 0,
      effectSummary: bMeta.effectSummary,
      centerX: Math.floor(size / 2),
      centerZ: Math.floor(size / 2),
    });
  }

  // Collect thermal point sources (bonfires, smelteries, steam foundries, reactors)
  const heatSources: Array<{ x: number; z: number; bonusC: number; radius: number }> = [];
  for (const b of sim.buildings) {
    if (b.type === 'bonfire') {
      heatSources.push({ x: b.tileX, z: b.tileZ, bonusC: 8, radius: 5 });
    } else if (b.type === 'smeltery' || b.type === 'steam_foundry') {
      heatSources.push({ x: b.tileX, z: b.tileZ, bonusC: 11, radius: 6 });
    } else if (b.type === 'fission_reactor') {
      heatSources.push({ x: b.tileX, z: b.tileZ, bonusC: 15, radius: 7 });
    }
  }

  const rawTemp = new Float32Array(totalTiles);
  const halfSize = size * 0.5;
  for (let z = 0; z < size; z++) {
    const latNorm = Math.abs(z - halfSize) / halfSize;
    const latOffset = (0.35 - latNorm) * 6.0;

    for (let x = 0; x < size; x++) {
      const idx = z * size + x;
      const tile = tiles[idx];
      const bMeta = BIOME_META[tile.terrain] || BIOME_META.grass;
      let temp = bMeta.baseTempC + latOffset;

      // Altitude lapse rate on land: higher peaks get progressively colder
      if (tile.height > 2) {
        temp -= (tile.height - 2) * 2.15;
      }

      // Active fire dramatically heats the tile
      if (tile.onFireTimer > 0) {
        temp += 26;
      }

      rawTemp[idx] = temp;
    }
  }

  // Apply building heat sources
  for (const hs of heatSources) {
    const r = hs.radius;
    const minX = Math.max(0, Math.floor(hs.x - r));
    const maxX = Math.min(size - 1, Math.ceil(hs.x + r));
    const minZ = Math.max(0, Math.floor(hs.z - r));
    const maxZ = Math.min(size - 1, Math.ceil(hs.z + r));
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x - hs.x, z - hs.z);
        if (d <= r) {
          rawTemp[z * size + x] += hs.bonusC * (1 - d / (r + 0.5));
        }
      }
    }
  }

  // Smooth temperature field (3x3 weighted kernel) so thermal bands form organic, natural isotherms
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      let weight = 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const nz = z + dz;
          if (nx >= 0 && nx < size && nz >= 0 && nz < size) {
            const w = dx === 0 && dz === 0 ? 4 : 1;
            sum += rawTemp[nz * size + nx] * w;
            weight += w;
          }
        }
      }
      const smoothedC = Math.round(sum / weight);
      const clampedC = Math.max(-40, Math.min(80, smoothedC));
      const idx = z * size + x;
      tempCelsiusMap[idx] = clampedC;

      let bandId = 5;
      for (const bMeta of THERMAL_BAND_META) {
        if (clampedC <= bMeta.maxThreshold) {
          bandId = bMeta.zoneId;
          break;
        }
      }
      tempBandMap[idx] = bandId;

      const info = tempBandsById.get(bandId);
      if (info) {
        info.tileCount++;
        tempSumByBand[bandId] += clampedC;
        sumXByTemp[bandId] += x;
        sumZByTemp[bandId] += z;
        if (clampedC < info.minTempC) info.minTempC = clampedC;
        if (clampedC > info.maxTempC) info.maxTempC = clampedC;
      }
    }
  }

  tempBandsById.forEach((info, bid) => {
    if (info.tileCount > 0) {
      info.worldPercent = Math.round((info.tileCount / totalTiles) * 1000) / 10;
      info.avgTempC = Math.round((tempSumByBand[bid] / info.tileCount) * 10) / 10;
      const cx = Math.round(sumXByTemp[bid] / info.tileCount);
      const cz = Math.round(sumZByTemp[bid] / info.tileCount);
      info.centerX = Math.max(2, Math.min(size - 3, cx));
      info.centerZ = Math.max(2, Math.min(size - 3, cz));
    } else {
      info.minTempC = 0;
      info.maxTempC = 0;
    }
  });

  return {
    gridSize: size,
    computedAtYear: sim.year,
    kingdomMap,
    kingdomIsSea,
    kingdomsById,
    territoryMap,
    territoryIsSea,
    territoriesById,
    biomeMap,
    biomesById,
    tempBandMap,
    tempCelsiusMap,
    tempBandsById,
  };
}

/**
 * Inspects all zone data at a given (tileX, tileZ) coordinate for the Inspect Tool and hover UI.
 */
export function inspectTileZones(
  zones: WorldZonesData,
  sim: SimulationState,
  tileX: number,
  tileZ: number
): TileZoneInspection | null {
  const size = zones.gridSize;
  if (tileX < 0 || tileX >= size || tileZ < 0 || tileZ >= size) return null;

  const idx = tileZ * size + tileX;
  const tile = sim.tiles[idx];
  if (!tile) return null;

  const isWater =
    tile.height === 0 || tile.terrain === 'deep_water' || tile.terrain === 'shallow_water';
  const kId = zones.kingdomMap[idx];
  const tId = zones.territoryMap[idx];
  const bId = zones.biomeMap[idx];
  const tempId = zones.tempBandMap[idx];
  const tempC = zones.tempCelsiusMap[idx];

  return {
    tileX,
    tileZ,
    elevation: tile.height,
    isWater,
    biomeType: tile.terrain,
    kingdom: kId ? zones.kingdomsById.get(kId) || null : null,
    isKingdomMaritime: zones.kingdomIsSea[idx] === 1,
    territory: tId ? zones.territoriesById.get(tId) || null : null,
    isTerritoryAquatic: zones.territoryIsSea[idx] === 1,
    biomeZone: bId ? zones.biomesById.get(bId) || null : null,
    temperatureZone: tempId ? zones.tempBandsById.get(tempId) || null : null,
    tileTempC: tempC,
    tileTempF: Math.round((tempC * 9) / 5 + 32),
  };
}

/**
 * Packs active zone overlays into two 128x128 RGBA DataTexture buffers for the Land & Sea shaders:
 * - colorData (RGBA): RGB blended zone color, A = fill opacity (0..255)
 * - idData (RGBA):
 *     R = primary border Zone ID (kingdoms > territories > biomes > temperature)
 *     G = secondary border Zone ID (when multiple overlays are toggled simultaneously)
 *     B = hover highlight flag (255 if this tile belongs to the currently hovered zone)
 *     A = style flags (1: maritime/sea stipple, 2: thermal gradient)
 */
export function buildZoneOverlayTextures(
  zones: WorldZonesData,
  toggles: ZoneToggleState,
  hoveredTile: { x: number; z: number } | null,
  colorDataOut?: Uint8Array,
  idDataOut?: Uint8Array
): { colorData: Uint8Array; idData: Uint8Array; anyActive: boolean; labels: ZoneMapLabel[] } {
  const size = zones.gridSize;
  const totalTiles = size * size;
  const colorData =
    colorDataOut && colorDataOut.length === totalTiles * 4
      ? colorDataOut
      : new Uint8Array(totalTiles * 4);
  const idData =
    idDataOut && idDataOut.length === totalTiles * 4
      ? idDataOut
      : new Uint8Array(totalTiles * 4);

  const anyActive =
    toggles.kingdoms || toggles.territories || toggles.biomes || toggles.temperature;
  if (!anyActive) {
    colorData.fill(0);
    idData.fill(0);
    return { colorData, idData, anyActive: false, labels: [] };
  }

  let hoveredKingdomId = 0;
  let hoveredTerritoryId = 0;
  let hoveredBiomeId = 0;
  let hoveredTempId = 0;

  if (
    hoveredTile &&
    hoveredTile.x >= 0 &&
    hoveredTile.x < size &&
    hoveredTile.z >= 0 &&
    hoveredTile.z < size
  ) {
    const hIdx = hoveredTile.z * size + hoveredTile.x;
    if (toggles.kingdoms) hoveredKingdomId = zones.kingdomMap[hIdx];
    if (toggles.territories) hoveredTerritoryId = zones.territoryMap[hIdx];
    if (toggles.biomes) hoveredBiomeId = zones.biomeMap[hIdx];
    if (toggles.temperature) hoveredTempId = zones.tempBandMap[hIdx];
  }

  for (let i = 0; i < totalTiles; i++) {
    let rAcc = 0;
    let gAcc = 0;
    let bAcc = 0;
    let wAcc = 0;
    let alphaMax = 0;

    let primaryId = 0;
    let secondaryId = 0;
    let isHovered = 0;
    let styleFlag = 0;

    if (toggles.temperature) {
      const tid = zones.tempBandMap[i];
      const info = zones.tempBandsById.get(tid);
      if (info) {
        const w = 0.85;
        rAcc += info.color[0] * w;
        gAcc += info.color[1] * w;
        bAcc += info.color[2] * w;
        wAcc += w;
        alphaMax = Math.max(alphaMax, 148);
        primaryId = tid + 200;
        styleFlag = 2;
        if (hoveredTempId > 0 && tid === hoveredTempId) isHovered = 255;
      }
    }

    if (toggles.biomes) {
      const bid = zones.biomeMap[i];
      const info = zones.biomesById.get(bid);
      if (info) {
        const w = 1.0;
        rAcc += info.color[0] * w;
        gAcc += info.color[1] * w;
        bAcc += info.color[2] * w;
        wAcc += w;
        alphaMax = Math.max(alphaMax, 156);
        if (primaryId !== 0) secondaryId = primaryId;
        primaryId = bid + 150;
        if (hoveredBiomeId > 0 && bid === hoveredBiomeId) isHovered = 255;
      }
    }

    if (toggles.territories) {
      const trId = zones.territoryMap[i];
      if (trId > 0) {
        const info = zones.territoriesById.get(trId);
        if (info) {
          const w = 1.35;
          rAcc += info.color[0] * w;
          gAcc += info.color[1] * w;
          bAcc += info.color[2] * w;
          wAcc += w;
          alphaMax = Math.max(alphaMax, zones.territoryIsSea[i] ? 168 : 185);
          if (primaryId !== 0) secondaryId = primaryId;
          primaryId = trId + 80;
          if (zones.territoryIsSea[i]) styleFlag = 1;
          if (hoveredTerritoryId > 0 && trId === hoveredTerritoryId) isHovered = 255;
        }
      }
    }

    if (toggles.kingdoms) {
      const kid = zones.kingdomMap[i];
      if (kid > 0) {
        const info = zones.kingdomsById.get(kid);
        if (info) {
          const w = 1.65;
          rAcc += info.color[0] * w;
          gAcc += info.color[1] * w;
          bAcc += info.color[2] * w;
          wAcc += w;
          alphaMax = Math.max(alphaMax, zones.kingdomIsSea[i] ? 176 : 196);
          if (primaryId !== 0) secondaryId = primaryId;
          primaryId = kid;
          if (zones.kingdomIsSea[i]) styleFlag = 1;
          if (hoveredKingdomId > 0 && kid === hoveredKingdomId) isHovered = 255;
        }
      }
    }

    const p = i * 4;
    if (wAcc > 0) {
      colorData[p] = Math.min(255, Math.round(rAcc / wAcc));
      colorData[p + 1] = Math.min(255, Math.round(gAcc / wAcc));
      colorData[p + 2] = Math.min(255, Math.round(bAcc / wAcc));
      colorData[p + 3] = alphaMax;
      idData[p] = primaryId;
      idData[p + 1] = secondaryId;
      idData[p + 2] = isHovered;
      idData[p + 3] = styleFlag;
    } else {
      colorData[p] = 0;
      colorData[p + 1] = 0;
      colorData[p + 2] = 0;
      colorData[p + 3] = 0;
      idData[p] = 0;
      idData[p + 1] = 0;
      idData[p + 2] = 0;
      idData[p + 3] = 0;
    }
  }

  const labels: ZoneMapLabel[] = [];
  if (toggles.kingdoms) {
    zones.kingdomsById.forEach((k) => {
      labels.push({
        id: `kingdom-${k.zoneId}`,
        name: k.name,
        population: k.population,
        hexColor: k.hexColor,
        tileX: k.centerX,
        tileZ: k.centerZ,
        isHovered: k.zoneId === hoveredKingdomId,
      });
    });
  }
  if (toggles.territories) {
    zones.territoriesById.forEach((t) => {
      labels.push({
        id: `territory-${t.zoneId}`,
        name: t.name,
        population: t.animalCount,
        hexColor: t.hexColor,
        tileX: t.centerX,
        tileZ: t.centerZ,
        isHovered: t.zoneId === hoveredTerritoryId,
      });
    });
  }
  if (toggles.biomes) {
    zones.biomesById.forEach((b) => {
      if (b.tileCount >= 24) {
        labels.push({
          id: `biome-${b.zoneId}`,
          name: b.name,
          population: null,
          hexColor: b.hexColor,
          tileX: b.centerX,
          tileZ: b.centerZ,
          isHovered: b.zoneId === hoveredBiomeId,
        });
      }
    });
  }
  if (toggles.temperature) {
    zones.tempBandsById.forEach((tm) => {
      if (tm.tileCount >= 24) {
        labels.push({
          id: `temp-${tm.zoneId}`,
          name: tm.name,
          population: null,
          hexColor: tm.hexColor,
          tileX: tm.centerX,
          tileZ: tm.centerZ,
          isHovered: tm.zoneId === hoveredTempId,
        });
      }
    });
  }

  return { colorData, idData, anyActive: true, labels };
}
