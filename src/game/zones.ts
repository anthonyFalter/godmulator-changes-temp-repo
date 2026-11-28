import { BUILDINGS, EPOCHS, getDinosaurVariant, getMaxCityPopulation } from './catalog';
import { createSeededNomadName, getKingdomEpoch } from './simulation';
import {
  AnimalRole,
  DiplomaticRelation,
  Resources,
  SeasonPreset,
  SimulationState,
  SpeciesId,
  TerrainType,
  WarFrontArrowData,
  ZoneOverlayType,
  ZoneToggleState,
} from './types';
import { computeSeasonState } from './worldSeasons';

export type { ZoneOverlayType, ZoneToggleState };

export const DEFAULT_ZONE_TOGGLES: ZoneToggleState = {
  kingdomLabels: true,
  kingdoms: false,
  kings: false,
  territories: false,
  biomes: false,
  temperature: false,
  alliances: false,
};

export interface KingdomZoneInfo {
  zoneId: number; // 1..255
  settlementId: string;
  kingdomId: string;
  name: string;
  species: SpeciesId;
  speciesLabel: string;
  color: [number, number, number];
  hexColor: string;
  population: number;
  maxPopulation: number;
  adultCount: number;
  childCount: number;
  buildingCount: number;
  farmTileCount: number;
  landTileCount: number;
  seaTileCount: number;
  totalTileCount: number;
  epochLevel: number;
  epochName: string;
  resources: Resources;
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
  labelAnchors?: Array<{ x: number; z: number; tileCount: number }>;
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
  labelAnchors?: Array<{ x: number; z: number; tileCount: number }>;
}

export interface ZoneMapLabel {
  id: string;
  kind?: 'city' | 'territory' | 'biome' | 'temperature';
  settlementId?: string;
  kingdomId?: string;
  name: string;
  species?: SpeciesId;
  epochName?: string;
  subtitle?: string;
  population: number | null;
  hexColor: string;
  tileX: number;
  tileZ: number;
  isHovered: boolean;
  flatGround?: boolean;
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
  dwarf: [
    [217, 119, 6],   // Forged Amber
    [245, 158, 11],  // Mithril Gold
    [180, 83, 9],    // Copper Anvil
    [234, 179, 8],   // Runic Brass
  ],
  lizardfolk: [
    [234, 179, 8],   // Sunscale Gold
    [101, 163, 13],  // Jungle Jade
    [202, 138, 4],   // Temple Ochre
    [13, 148, 136],  // Lagoon Teal
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
    name: 'Deepseas',
    category: 'Marine',
    color: [30, 64, 175],
    baseTempC: 9,
  },
  shallow_water: {
    name: 'Shore',
    category: 'Marine',
    color: [56, 189, 248],
    baseTempC: 16,
  },
  ice: {
    name: 'Sea Ice',
    category: 'Marine',
    color: [165, 243, 252],
    baseTempC: -6,
  },
  sand: {
    name: 'Dunes',
    category: 'Terrestrial',
    color: [250, 204, 21],
    baseTempC: 27,
  },
  grass: {
    name: 'Meadows',
    category: 'Terrestrial',
    color: [74, 222, 128],
    baseTempC: 18,
  },
  fertile: {
    name: 'Riverlands',
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
    name: 'Wildwood',
    category: 'Terrestrial',
    color: [13, 148, 136],
    baseTempC: 28,
  },
  savanna: {
    name: 'Savanna',
    category: 'Terrestrial',
    color: [234, 179, 8],
    baseTempC: 30,
  },
  swamp: {
    name: 'Marshlands',
    category: 'Terrestrial',
    color: [101, 163, 13],
    baseTempC: 23,
  },
  highland: {
    name: 'Highlands',
    category: 'Terrestrial',
    color: [168, 162, 158],
    baseTempC: 11,
  },
  mountain: {
    name: 'Mountains',
    category: 'Terrestrial',
    color: [148, 163, 184],
    baseTempC: 4,
  },
  taiga: {
    name: 'Taiga',
    category: 'Terrestrial',
    color: [20, 184, 166],
    baseTempC: 5,
  },
  tundra: {
    name: 'Tundra',
    category: 'Terrestrial',
    color: [125, 211, 252],
    baseTempC: -3,
  },
  badlands: {
    name: 'Badlands',
    category: 'Terrestrial',
    color: [234, 88, 12],
    baseTempC: 34,
  },
  blossom: {
    name: 'Feywild Grove',
    category: 'Terrestrial',
    color: [244, 114, 182],
    baseTempC: 19,
  },
  stone_road: {
    name: 'Roads',
    category: 'Civilized',
    color: [214, 211, 209],
    baseTempC: 20,
  },
  rail_track: {
    name: 'Railways',
    category: 'Civilized',
    color: [161, 161, 170],
    baseTempC: 21,
  },
  runway: {
    name: 'Runway',
    category: 'Civilized',
    color: [113, 113, 122],
    baseTempC: 22,
  },
  rock: {
    name: 'Crags',
    category: 'Terrestrial',
    color: [120, 113, 108],
    baseTempC: 10,
  },
  snow: {
    name: 'Snowfields',
    category: 'Terrestrial',
    color: [226, 232, 240],
    baseTempC: -11,
  },
  scorched: {
    name: 'Scorched Lands',
    category: 'Cataclysmic',
    color: [220, 38, 38],
    baseTempC: 42,
  },
  crystal_field: {
    name: 'Crystal Glade',
    category: 'Cataclysmic',
    color: [232, 121, 249],
    baseTempC: 7,
  },
  void_goo: {
    name: 'Abyssal Void',
    category: 'Cataclysmic',
    color: [124, 58, 237],
    baseTempC: -18,
  },
  volcanic_wasteland: {
    name: 'Volcanic Wasteland',
    category: 'Cataclysmic',
    color: [249, 115, 22],
    baseTempC: 44,
  },
  blighted_mire: {
    name: 'Land of Blight',
    category: 'Cataclysmic',
    color: [147, 51, 234],
    baseTempC: 21,
  },
  floral_plains: {
    name: 'Floral Plains',
    category: 'Terrestrial',
    color: [244, 114, 182],
    baseTempC: 19,
  },
  dirt: {
    name: 'Base Dirt',
    category: 'Terrestrial',
    color: [143, 98, 62],
    baseTempC: 18,
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
    name: 'Freezing',
    rangeLabel: '≤ 0°C (≤ 32°F)',
    color: [86, 110, 252],
    maxThreshold: 0,
    effectSummary: 'Sub-zero tundra and snowfields; stops wildfires and slows crop growth.',
  },
  {
    zoneId: 2,
    bandId: 'cold',
    name: 'Cold',
    rangeLabel: '1°C – 11°C (34°F – 52°F)',
    color: [14, 185, 238],
    maxThreshold: 11,
    effectSummary: 'Cool highlands, taiga, and deepseas.',
  },
  {
    zoneId: 3,
    bandId: 'temperate',
    name: 'Temperate',
    rangeLabel: '12°C – 22°C (54°F – 72°F)',
    color: [34, 197, 94],
    maxThreshold: 22,
    effectSummary: 'Balanced climate suited for settlements, farming, and forests.',
  },
  {
    zoneId: 4,
    bandId: 'warm',
    name: 'Warm',
    rangeLabel: '23°C – 31°C (73°F – 88°F)',
    color: [249, 115, 22],
    maxThreshold: 31,
    effectSummary: 'Sunlit shores, wildwood, and savanna regions.',
  },
  {
    zoneId: 5,
    bandId: 'scorching',
    name: 'Hot',
    rangeLabel: '≥ 32°C (≥ 90°F)',
    color: [239, 52, 52],
    maxThreshold: 999,
    effectSummary: 'High heat across badlands, scorched lands, and active fires.',
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
interface ZoneInteriorAnchor {
  x: number;
  z: number;
  tileCount: number;
}

/**
 * Finds accurate interior label anchor(s) for each zone ID using connected components +
 * exact 4-neighbor distance-to-boundary BFS (Pole of Inaccessibility).
 * Guarantees every anchor (x, z) lies strictly INSIDE zoneMap[z * size + x] === zid,
 * centered inside the widest contiguous body of that zone rather than an out-of-zone average.
 */
function findZoneInteriorAnchors(
  zoneMap: Uint8Array,
  size: number,
  allowedZone: (zid: number) => boolean,
  minPatchTiles: number,
  maxPatchesPerZone: number,
  minAnchorSeparation: number,
  preferTile?: (idx: number) => boolean,
): Map<number, ZoneInteriorAnchor[]> {
  const total = size * size;
  const visited = new Uint8Array(total);
  const compQueue = new Int32Array(total);
  const distToEdge = new Int16Array(total);
  const bfsQueue = new Int32Array(total);
  const patchesByZone = new Map<number, ZoneInteriorAnchor[]>();

  for (let start = 0; start < total; start++) {
    if (visited[start]) continue;
    const zid = zoneMap[start];
    if (zid === 0 || !allowedZone(zid)) {
      visited[start] = 1;
      continue;
    }

    let head = 0;
    let tail = 0;
    visited[start] = 1;
    compQueue[tail++] = start;
    let sumX = 0;
    let sumZ = 0;

    while (head < tail) {
      const idx = compQueue[head++];
      const cx = idx % size;
      const cz = (idx / size) | 0;
      sumX += cx;
      sumZ += cz;

      if (cx > 0) {
        const nb = idx - 1;
        if (!visited[nb] && zoneMap[nb] === zid) {
          visited[nb] = 1;
          compQueue[tail++] = nb;
        }
      }
      if (cx < size - 1) {
        const nb = idx + 1;
        if (!visited[nb] && zoneMap[nb] === zid) {
          visited[nb] = 1;
          compQueue[tail++] = nb;
        }
      }
      if (cz > 0) {
        const nb = idx - size;
        if (!visited[nb] && zoneMap[nb] === zid) {
          visited[nb] = 1;
          compQueue[tail++] = nb;
        }
      }
      if (cz < size - 1) {
        const nb = idx + size;
        if (!visited[nb] && zoneMap[nb] === zid) {
          visited[nb] = 1;
          compQueue[tail++] = nb;
        }
      }
    }

    const count = tail;
    if (count < minPatchTiles) continue;

    let bHead = 0;
    let bTail = 0;
    for (let i = 0; i < count; i++) {
      const idx = compQueue[i];
      const cx = idx % size;
      const cz = (idx / size) | 0;
      const isEdge =
        cx === 0 ||
        cx === size - 1 ||
        cz === 0 ||
        cz === size - 1 ||
        zoneMap[idx - 1] !== zid ||
        zoneMap[idx + 1] !== zid ||
        zoneMap[idx - size] !== zid ||
        zoneMap[idx + size] !== zid;
      if (isEdge) {
        distToEdge[idx] = 1;
        bfsQueue[bTail++] = idx;
      } else {
        distToEdge[idx] = 0;
      }
    }

    while (bHead < bTail) {
      const idx = bfsQueue[bHead++];
      const nextD = distToEdge[idx] + 1;
      const cx = idx % size;
      const cz = (idx / size) | 0;
      if (cx > 0) {
        const nb = idx - 1;
        if (zoneMap[nb] === zid && distToEdge[nb] === 0) {
          distToEdge[nb] = nextD;
          bfsQueue[bTail++] = nb;
        }
      }
      if (cx < size - 1) {
        const nb = idx + 1;
        if (zoneMap[nb] === zid && distToEdge[nb] === 0) {
          distToEdge[nb] = nextD;
          bfsQueue[bTail++] = nb;
        }
      }
      if (cz > 0) {
        const nb = idx - size;
        if (zoneMap[nb] === zid && distToEdge[nb] === 0) {
          distToEdge[nb] = nextD;
          bfsQueue[bTail++] = nb;
        }
      }
      if (cz < size - 1) {
        const nb = idx + size;
        if (zoneMap[nb] === zid && distToEdge[nb] === 0) {
          distToEdge[nb] = nextD;
          bfsQueue[bTail++] = nb;
        }
      }
    }

    const meanX = sumX / count;
    const meanZ = sumZ / count;
    let bestIdx = compQueue[0];
    let bestScore = -1e18;
    for (let i = 0; i < count; i++) {
      const idx = compQueue[i];
      const cx = idx % size;
      const cz = (idx / size) | 0;
      const dEdge = distToEdge[idx];
      const dCenter = Math.hypot(cx - meanX, cz - meanZ);
      // Prefer land/interior tiles only when they are genuinely inside the patch (never drag labels onto 1-tile border edges)
      const prefBonus = preferTile && preferTile(idx) ? (dEdge >= 2 ? 28 + Math.min(dEdge, 6) * 8 : 2) : 0;
      const score = prefBonus + dEdge * 14 - dCenter * 0.35;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    }

    const anchor: ZoneInteriorAnchor = {
      x: bestIdx % size,
      z: (bestIdx / size) | 0,
      tileCount: count,
    };
    let arr = patchesByZone.get(zid);
    if (!arr) {
      arr = [];
      patchesByZone.set(zid, arr);
    }
    arr.push(anchor);
  }

  const minSepSq = minAnchorSeparation * minAnchorSeparation;
  patchesByZone.forEach((arr, zid) => {
    arr.sort((a, b) => b.tileCount - a.tileCount);
    const picked: ZoneInteriorAnchor[] = [];
    for (let i = 0; i < arr.length && picked.length < maxPatchesPerZone; i++) {
      const cand = arr[i];
      let tooClose = false;
      for (let j = 0; j < picked.length; j++) {
        const dx = cand.x - picked[j].x;
        const dz = cand.z - picked[j].z;
        if (dx * dx + dz * dz < minSepSq) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) picked.push(cand);
    }
    patchesByZone.set(zid, picked);
  });

  return patchesByZone;
}

export function computeWorldZones(
  sim: SimulationState,
  seasonPreset?: SeasonPreset,
): WorldZonesData {
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
    popCapBonus: number;
    sumHp: number;
    sumMaxHp: number;
    sumX: number;
    sumZ: number;
    anchorCount: number;
    maxEpoch: number;
    adults: number;
    children: number;
  }

  const buildingByType = new Map(BUILDINGS.map((d) => [d.type, d]));
  const cityMaxPopLimit = getMaxCityPopulation(sim.gridSize);
  const settlementTable = new Map<string, DiscoveredSettlement>();

  const ensureSettlement = (sid: string, fallbackSpecies: SpeciesId, x: number, z: number): DiscoveredSettlement => {
    let rec = settlementTable.get(sid);
    if (!rec) {
      const sp = sim.settlementSpecies?.[sid] ?? fallbackSpecies;
      const defaultLabel = createSeededNomadName(sid, sim.seed, sp);
      rec = {
        id: sid,
        name: sim.settlementNames?.[sid] || defaultLabel,
        species: sp,
        buildingCount: 0,
        completedCount: 0,
        popCapBonus: 0,
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
    if (b.constructionProgress >= 100) {
      rec.completedCount++;
      rec.popCapBonus += buildingByType.get(b.type)?.popCapBonus ?? 0;
    }
    rec.sumHp += Math.max(0, b.hp);
    rec.sumMaxHp += Math.max(1, b.maxHp);
    rec.sumX += b.tileX;
    rec.sumZ += b.tileZ;
    rec.anchorCount++;
    if (b.epochLevel > rec.maxEpoch) rec.maxEpoch = b.epochLevel;
  }

  // Group living civilization units into their settlement (or nearest matching settlement / camp)
  const resolvedUnitSid = new Map<string, string>();
  const nomadCamps: Array<{ id: string; species: SpeciesId; x: number; z: number }> = [];
  for (const u of sim.units) {
    if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0) continue;
    let sid = u.settlementId;
    if (!sid || !settlementTable.has(sid)) {
      let bestDistSq = 12 * 12;
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
      if (!bestSid && u.kingdomId) {
        let bestKingdomDistSq = Infinity;
        settlementTable.forEach((cand) => {
          if ((sim.settlementKingdoms?.[cand.id] ?? cand.id) !== u.kingdomId) return;
          const cx = cand.sumX / cand.anchorCount;
          const cz = cand.sumZ / cand.anchorCount;
          const d2 = (u.x - cx) * (u.x - cx) + (u.z - cz) * (u.z - cz);
          if (d2 < bestKingdomDistSq) {
            bestKingdomDistSq = d2;
            bestSid = cand.id;
          }
        });
      }
      if (!bestSid && !u.settlementId) {
        if (u.kingdomId) {
          bestSid = `nomad_${u.kingdomId}`;
        } else {
          const existingCamp = nomadCamps.find(
            (c) => c.species === u.species && (c.x - u.x) ** 2 + (c.z - u.z) ** 2 <= 16 * 16,
          );
          if (existingCamp) {
            bestSid = existingCamp.id;
          } else {
            const newCampId = `nomad_${u.species}_${nomadCamps.length + 1}`;
            nomadCamps.push({ id: newCampId, species: u.species, x: u.x, z: u.z });
            bestSid = newCampId;
          }
        }
      }
      sid = bestSid || u.settlementId || `nomad_${u.kingdomId || u.species}`;
    }
    resolvedUnitSid.set(u.id, sid);
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

  const kingdomColorIndex = new Map<string, number>();
  let kIdxCounter = 0;
  settlementTable.forEach((s) => {
    const pop = s.adults + s.children;
    // If a lone foreign unit was killed while planting an unfinished structure (0 pop, 0 completed buildings), remove its zone immediately!
    if (pop === 0 && s.completedCount === 0) {
      return;
    }

    const zoneId = Math.min(254, ++kIdxCounter);
    settlementIdToZoneId.set(s.id, zoneId);
    const rootKingdomId = sim.settlementKingdoms?.[s.id] ?? s.id;
    let colorSlot = kingdomColorIndex.get(rootKingdomId);
    if (colorSlot === undefined) {
      colorSlot = kingdomColorIndex.size;
      kingdomColorIndex.set(rootKingdomId, colorSlot);
    }
    const palette = KINGDOM_PALETTES[s.species] || KINGDOM_PALETTES.human;
    const color = palette[colorSlot % palette.length];
    const cx = Math.max(0, Math.min(size - 1, Math.round(s.sumX / s.anchorCount)));
    const cz = Math.max(0, Math.min(size - 1, Math.round(s.sumZ / s.anchorCount)));
    const kEpoch = getKingdomEpoch(sim, rootKingdomId);
    const epochDef = EPOCHS[Math.max(0, Math.min(EPOCHS.length - 1, kEpoch))] || EPOCHS[0];
    const rawCityCap = (s.completedCount > 0 ? epochDef.populationBonus : 0) + s.popCapBonus;
    const maxPopulation = s.completedCount > 0 ? Math.min(cityMaxPopLimit, rawCityCap) : 0;

    const stock = sim.kingdomResources?.[rootKingdomId];
    kingdomsById.set(zoneId, {
      zoneId,
      settlementId: s.id,
      kingdomId: rootKingdomId,
      name: s.name,
      species: s.species,
      speciesLabel: s.species === 'human' ? 'Human Kingdom' : s.species === 'elf' ? 'Elven Realm' : 'Orcish Dominion',
      color,
      hexColor: rgbToHex(color),
      population: pop,
      maxPopulation,
      adultCount: s.adults,
      childCount: s.children,
      buildingCount: s.buildingCount,
      farmTileCount: 0,
      landTileCount: 0,
      seaTileCount: 0,
      totalTileCount: 0,
      epochLevel: kEpoch,
      epochName: epochDef ? epochDef.name : 'Stone Age',
      resources: {
        food: Math.floor(stock?.food ?? 0),
        wood: Math.floor(stock?.wood ?? 0),
        stone: Math.floor(stock?.stone ?? 0),
        ore: Math.floor(stock?.ore ?? 0),
        knowledge: Math.floor(stock?.knowledge ?? 0),
        energy: Math.floor(stock?.energy ?? 0),
        alloy: Math.floor(stock?.alloy ?? 0),
        faith: Math.floor(stock?.faith ?? 0),
      },
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
      const bonus = Math.min(24.0, s.buildingCount * 0.85 + pop * 0.35 + kEpoch * 1.4);
      maxCostByZone[zoneId] = 10.5 + bonus;
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

  // Seed from cultivated farm tiles and explicitly claimed/annexed territory tiles
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
    if (tile.claimedSettlementId) {
      const zoneId = settlementIdToZoneId.get(tile.claimedSettlementId);
      if (zoneId) {
        const info = kingdomsById.get(zoneId);
        if (info && (info.population > 0 || info.buildingCount > 0)) {
          if (kCost[i] > 0.25) {
            kCost[i] = 0.25;
            kingdomMap[i] = zoneId;
            queueIdx.push(i);
          }
        }
      }
    }
  }

  // Seed from living citizen positions (excluding colonists currently trekking far afield)
  for (const u of sim.units) {
    if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0) continue;
    if (u.expeditionTargetX !== undefined) continue;
    const sid = resolvedUnitSid.get(u.id) || u.settlementId || `nomad_${u.kingdomId || u.species}`;
    const zoneId = settlementIdToZoneId.get(sid) || settlementIdToZoneId.get('city_default');
    if (!zoneId) continue;
    const ux = Math.max(0, Math.min(size - 1, Math.round(u.x)));
    const uz = Math.max(0, Math.min(size - 1, Math.round(u.z)));
    const uIdx = uz * size + ux;
    if (kCost[uIdx] > 1.4) {
      kCost[uIdx] = 1.4;
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
          stepCost *= 1.45; // Shallow coastal shelf / harbor waters
        } else {
          stepCost *= 2.6; // Deep maritime territorial limit
        }
      } else {
        // Land terrain shaping
        const elevDiff = Math.abs(nTile.height - currTile.height);
        if (
          nTile.terrain === 'stone_road' ||
          nTile.terrain === 'rail_track' ||
          nTile.terrain === 'runway' ||
          nTile.farmSettlementId ||
          nTile.claimedSettlementId
        ) {
          stepCost *= 0.62; // Roads, rails, farmlands, and claimed border lands extend kingdom reach naturally
        } else if (nTile.terrain === 'mountain' || nTile.height >= 7) {
          stepCost *= 2.65; // Mountain ridges act as natural topographic borders
        } else if (nTile.terrain === 'swamp' || nTile.terrain === 'jungle') {
          stepCost *= 1.25;
        }
        stepCost += elevDiff * 0.42;
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
          titlePrefix: 'Wolf Territory',
          speciesLabel: 'Wolves',
          diet: 'Carnivore',
          domainType: 'Terrestrial',
          color: [248, 113, 113],
          preferredBiomes: ['Ancient Woods', 'Taiga', 'Snowfields', 'Meadows'],
          canEnterShallowWater: false,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      case 'bear':
        return {
          titlePrefix: 'Bear Territory',
          speciesLabel: 'Bears',
          diet: 'Carnivore',
          domainType: 'Terrestrial',
          color: [217, 119, 6],
          preferredBiomes: ['Ancient Woods', 'Highlands', 'Taiga'],
          canEnterShallowWater: false,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      case 'dragon':
        return {
          titlePrefix: 'Dragon Lair',
          speciesLabel: 'Dragons',
          diet: 'Apex',
          domainType: 'Aerial & Coastal',
          color: [220, 38, 38],
          preferredBiomes: ['Mountains', 'Badlands', 'Scorched Lands', 'Shore'],
          canEnterShallowWater: true,
          canEnterDeepWater: true,
          canEnterLand: true,
        };
      case 'dinosaur':
        return isDinoHerb
          ? {
              titlePrefix: 'Dino Territory',
              speciesLabel: 'Herbivore Dinosaurs',
              diet: 'Herbivore',
              domainType: 'Terrestrial',
              color: [52, 211, 153],
              preferredBiomes: ['Wildwood', 'Marshlands', 'Savanna'],
              canEnterShallowWater: false,
              canEnterDeepWater: false,
              canEnterLand: true,
            }
          : {
              titlePrefix: 'Raptor Territory',
              speciesLabel: 'Carnivore Dinosaurs',
              diet: 'Carnivore',
              domainType: 'Terrestrial',
              color: [244, 63, 94],
              preferredBiomes: ['Wildwood', 'Savanna', 'Badlands'],
              canEnterShallowWater: false,
              canEnterDeepWater: false,
              canEnterLand: true,
            };
      case 'capybara':
        return {
          titlePrefix: 'Capybara Territory',
          speciesLabel: 'Capybaras',
          diet: 'Herbivore',
          domainType: 'Amphibious (Land & Sea)',
          color: [45, 212, 191],
          preferredBiomes: ['Shore', 'Lake', 'Marshlands', 'Riverlands'],
          canEnterShallowWater: true,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      case 'unicorn':
        return {
          titlePrefix: 'Unicorn Glade',
          speciesLabel: 'Unicorns',
          diet: 'Herbivore',
          domainType: 'Terrestrial',
          color: [232, 121, 249],
          preferredBiomes: ['Crystal Glade', 'Feywild Grove', 'Ancient Woods'],
          canEnterShallowWater: false,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      case 'cow':
        return {
          titlePrefix: 'Cattle Grazing',
          speciesLabel: 'Cattle',
          diet: 'Herbivore',
          domainType: 'Terrestrial',
          color: [163, 230, 53],
          preferredBiomes: ['Meadows', 'Riverlands', 'Savanna'],
          canEnterShallowWater: false,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      case 'pig':
        return {
          titlePrefix: 'Boar Territory',
          speciesLabel: 'Boars',
          diet: 'Omnivore',
          domainType: 'Terrestrial',
          color: [251, 146, 60],
          preferredBiomes: ['Meadows', 'Ancient Woods', 'Marshlands'],
          canEnterShallowWater: false,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      case 'chicken':
        return {
          titlePrefix: 'Fowl Territory',
          speciesLabel: 'Chickens',
          diet: 'Herbivore',
          domainType: 'Terrestrial',
          color: [250, 204, 21],
          preferredBiomes: ['Meadows', 'Shore'],
          canEnterShallowWater: false,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      case 'raider':
        return {
          titlePrefix: 'Raider Camp',
          speciesLabel: 'Raiders',
          diet: 'Carnivore',
          domainType: 'Terrestrial',
          color: [185, 28, 28],
          preferredBiomes: ['Badlands', 'Highlands'],
          canEnterShallowWater: true,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      case 'leviathan':
        return {
          titlePrefix: 'Leviathan Abyss',
          speciesLabel: 'Leviathans',
          diet: 'Apex',
          domainType: 'Marine Waters',
          color: [14, 165, 233],
          preferredBiomes: ['Deepseas', 'Shore'],
          canEnterShallowWater: true,
          canEnterDeepWater: true,
          canEnterLand: false,
        };
      case 'giant_spider':
        return {
          titlePrefix: 'Blight Spider Nest',
          speciesLabel: 'Giant Spiders',
          diet: 'Carnivore',
          domainType: 'Terrestrial',
          color: [168, 85, 247],
          preferredBiomes: ['Land of Blight', 'Marshlands', 'Ancient Woods'],
          canEnterShallowWater: true,
          canEnterDeepWater: false,
          canEnterLand: true,
        };
      default:
        return {
          titlePrefix: 'Marine Shoal',
          speciesLabel: 'Sea Life',
          diet: 'Marine',
          domainType: 'Marine Waters',
          color: idx % 2 === 0 ? [34, 211, 238] : [59, 130, 246],
          preferredBiomes: ['Shore', 'Deepseas'],
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
      c.species === 'dragon' || c.species === 'leviathan'
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

    const isAquaticOnly = info.species === 'aquatic' || info.species === 'leviathan';
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
    'void_goo',
    'ice',
    'volcanic_wasteland',
    'blighted_mire',
    'floral_plains',
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
      regionName: meta.name,
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

  // Dedicated enclosed water zone: Lake (for enclosed inland water spaces that do not connect to the open ocean/border)
  const LAKE_ZONE_ID = BIOME_ORDER.length + 1;
  biomesById.set(LAKE_ZONE_ID, {
    zoneId: LAKE_ZONE_ID,
    biome: 'shallow_water',
    name: 'Lake',
    regionName: 'Lake',
    category: 'Marine',
    color: [14, 165, 233],
    hexColor: rgbToHex([14, 165, 233]),
    tileCount: 0,
    worldPercent: 0,
    avgElevation: 0,
    resourceCount: 0,
    wildlifeCount: 0,
    isAquatic: true,
    centerX: Math.floor(size / 2),
    centerZ: Math.floor(size / 2),
  });

  // Identify enclosed inland water bodies (Lakes) vs open coastal Shore / Deepseas
  const isEnclosedLakeTile = new Uint8Array(totalTiles);
  for (let i = 0; i < totalTiles; i++) {
    if (tiles[i].isLake && tiles[i].height === 0) {
      isEnclosedLakeTile[i] = 1;
    }
  }
  const waterVisited = new Uint8Array(totalTiles);
  const waterComponent: number[] = [];
  for (let i = 0; i < totalTiles; i++) {
    if (waterVisited[i]) continue;
    const t0 = tiles[i];
    if (t0.terrain !== 'shallow_water' && t0.terrain !== 'deep_water' && t0.height > 0) continue;
    waterVisited[i] = 1;
    waterComponent.length = 0;
    waterComponent.push(i);
    let touchesMapEdge = false;
    let headW = 0;
    while (headW < waterComponent.length) {
      const cur = waterComponent[headW++];
      const cx = cur % size;
      const cz = (cur - cx) / size;
      if (cx === 0 || cx === size - 1 || cz === 0 || cz === size - 1) {
        touchesMapEdge = true;
      }
      const nbs = [
        cx > 0 ? cur - 1 : -1,
        cx < size - 1 ? cur + 1 : -1,
        cz > 0 ? cur - size : -1,
        cz < size - 1 ? cur + size : -1,
      ];
      for (let k = 0; k < 4; k++) {
        const nb = nbs[k];
        if (nb < 0 || waterVisited[nb]) continue;
        const nt = tiles[nb];
        if (nt.terrain === 'shallow_water' || nt.terrain === 'deep_water' || nt.height === 0) {
          waterVisited[nb] = 1;
          waterComponent.push(nb);
        }
      }
    }
    if (!touchesMapEdge && waterComponent.length <= Math.max(220, Math.round(totalTiles * 0.045))) {
      for (let k = 0; k < waterComponent.length; k++) {
        isEnclosedLakeTile[waterComponent[k]] = 1;
      }
    }
  }

  const elevSumByBiome = new Float64Array(32);
  const sumXByBiome = new Float64Array(32);
  const sumZByBiome = new Float64Array(32);
  for (let i = 0; i < totalTiles; i++) {
    const tile = tiles[i];
    const zid = isEnclosedLakeTile[i]
      ? LAKE_ZONE_ID
      : biomeToZoneId.get(tile.terrain) || 1;
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

  const biomeAnchors = findZoneInteriorAnchors(
    biomeMap,
    size,
    (zid) => {
      const info = biomesById.get(zid);
      return Boolean(info && info.name !== 'Deepseas' && info.name !== 'Shore');
    },
    24,
    2,
    24,
  );

  biomesById.forEach((info, zid) => {
    if (info.tileCount > 0) {
      info.worldPercent = Math.round((info.tileCount / totalTiles) * 1000) / 10;
      info.avgElevation = Math.round((elevSumByBiome[zid] / info.tileCount) * 10) / 10;
      const anchors = biomeAnchors.get(zid);
      if (anchors && anchors.length > 0) {
        info.centerX = anchors[0].x;
        info.centerZ = anchors[0].z;
        // Keep primary anchor plus secondary anchor only if the second patch is substantial (>= 55 tiles)
        info.labelAnchors = anchors.filter((a, idx) => idx === 0 || a.tileCount >= 55);
      } else {
        const cx = Math.round(sumXByBiome[zid] / info.tileCount);
        const cz = Math.round(sumZByBiome[zid] / info.tileCount);
        info.centerX = Math.max(2, Math.min(size - 3, cx));
        info.centerZ = Math.max(2, Math.min(size - 3, cz));
        info.labelAnchors = [];
      }
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
  let baseSeasonalOffsetC = 0;
  if (seasonPreset) {
    const sState = computeSeasonState(seasonPreset, sim.year);
    baseSeasonalOffsetC =
      sState.weights.spring * -1.0 +
      sState.weights.summer * 4.5 +
      sState.weights.autumn * -4.0 +
      sState.weights.winter * -15.0;
  }

  for (let z = 0; z < size; z++) {
    const latNorm = Math.abs(z - halfSize) / halfSize;
    const latOffset = (0.35 - latNorm) * 6.0;

    for (let x = 0; x < size; x++) {
      const idx = z * size + x;
      const tile = tiles[idx];
      const bMeta = BIOME_META[tile.terrain] || BIOME_META.grass;
      let temp = bMeta.baseTempC + latOffset;

      if (baseSeasonalOffsetC !== 0) {
        // Oceans, deserts, jungles, and volcanic zones have different thermal inertia than temperate land
        const terrain = tile.terrain;
        const seasonScale =
          terrain === 'volcanic_wasteland' || terrain === 'scorched' || terrain === 'void_goo'
            ? 0.15
            : terrain === 'deep_water' || terrain === 'shallow_water' || terrain === 'ice'
              ? 0.45
              : terrain === 'sand' || terrain === 'badlands' || terrain === 'jungle' || terrain === 'savanna'
                ? 0.55
                : 1.0;
        temp += baseSeasonalOffsetC * seasonScale;
      }

      // Altitude lapse rate on land: higher peaks get progressively colder
      if (tile.height > 2) {
        temp -= (tile.height - 2) * 2.15;
      }

      // Active fire dramatically heats the tile
      if (tile.onFireTimer > 0) {
        temp += 26;
      }

      // Dynamic thermal offset accumulated from Freeze / Heat Wave / Helios Beam
      if (tile.tempOffset) {
        temp += tile.tempOffset;
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

  const tempAnchors = findZoneInteriorAnchors(
    tempBandMap,
    size,
    () => true,
    24,
    3,
    24,
    (idx) => tiles[idx].height > 0,
  );

  tempBandsById.forEach((info, bid) => {
    if (info.tileCount > 0) {
      info.worldPercent = Math.round((info.tileCount / totalTiles) * 1000) / 10;
      info.avgTempC = Math.round((tempSumByBand[bid] / info.tileCount) * 10) / 10;
      const anchors = tempAnchors.get(bid);
      if (anchors && anchors.length > 0) {
        info.centerX = anchors[0].x;
        info.centerZ = anchors[0].z;
        info.labelAnchors = anchors.filter((a, idx) => idx === 0 || a.tileCount >= 65);
      } else {
        // Scattered micro-patches (< 24 contiguous tiles): keep centerX/centerZ on an actual in-band tile
        // and leave labelAnchors empty so we never place a stray label on top of a different thermal zone.
        const cx = Math.max(0, Math.min(size - 1, Math.round(sumXByTemp[bid] / info.tileCount)));
        const cz = Math.max(0, Math.min(size - 1, Math.round(sumZByTemp[bid] / info.tileCount)));
        if (tempBandMap[cz * size + cx] === bid) {
          info.centerX = cx;
          info.centerZ = cz;
        } else {
          let bestDist = Infinity;
          let bestX = cx;
          let bestZ = cz;
          for (let ti = 0; ti < totalTiles; ti++) {
            if (tempBandMap[ti] !== bid) continue;
            const tx = ti % size;
            const tz = (ti / size) | 0;
            const dSq = (tx - cx) * (tx - cx) + (tz - cz) * (tz - cz);
            if (dSq < bestDist) {
              bestDist = dSq;
              bestX = tx;
              bestZ = tz;
            }
          }
          info.centerX = bestX;
          info.centerZ = bestZ;
        }
        info.labelAnchors = [];
      }
    } else {
      info.minTempC = 0;
      info.maxTempC = 0;
      info.labelAnchors = [];
    }
  });

  // Snap any kingdom or animal territory whose centroid fell outside its actual zone (e.g. concave/coastal split)
  let needsTerritorySnap = false;
  territoriesById.forEach((t, tid) => {
    const idx = t.centerZ * size + t.centerX;
    if (territoryMap[idx] !== tid) needsTerritorySnap = true;
  });
  if (needsTerritorySnap) {
    const terrAnchors = findZoneInteriorAnchors(
      territoryMap,
      size,
      (tid) => territoriesById.has(tid),
      1,
      1,
      10,
      (idx) => territoryIsSea[idx] === 0,
    );
    territoriesById.forEach((t, tid) => {
      const idx = t.centerZ * size + t.centerX;
      if (territoryMap[idx] !== tid) {
        const anchor = terrAnchors.get(tid)?.[0];
        if (anchor) {
          t.centerX = anchor.x;
          t.centerZ = anchor.z;
        }
      }
    });
  }

  let needsKingdomSnap = false;
  kingdomsById.forEach((k, kid) => {
    const idx = k.centerZ * size + k.centerX;
    if (kingdomMap[idx] !== kid || (k.landTileCount > 0 && kingdomIsSea[idx] !== 0)) {
      needsKingdomSnap = true;
    }
  });
  if (needsKingdomSnap) {
    const kAnchors = findZoneInteriorAnchors(
      kingdomMap,
      size,
      (kid) => kingdomsById.has(kid),
      1,
      1,
      10,
      (idx) => kingdomIsSea[idx] === 0,
    );
    kingdomsById.forEach((k, kid) => {
      const idx = k.centerZ * size + k.centerX;
      if (kingdomMap[idx] !== kid || (k.landTileCount > 0 && kingdomIsSea[idx] !== 0)) {
        const anchor = kAnchors.get(kid)?.[0];
        if (anchor) {
          k.centerX = anchor.x;
          k.centerZ = anchor.z;
        }
      }
    });
  }

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
    (tile.height === 0 && tile.terrain !== 'ice') ||
    tile.terrain === 'deep_water' ||
    tile.terrain === 'shallow_water';
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
export interface AllianceOverlayOptions {
  selectedAllianceKingdomId?: string | null;
  kingdomRelations?: Record<string, DiplomaticRelation>;
  settlementKingdoms?: Record<string, string>;
}

function resolveKingdomRelationPair(
  relations: Record<string, DiplomaticRelation> | undefined,
  kA: string,
  kB: string,
): DiplomaticRelation {
  if (!relations || kA === kB) return kA === kB ? 'allied' : 'neutral';
  const key = kA < kB ? `${kA}::${kB}` : `${kB}::${kA}`;
  return relations[key] ?? 'neutral';
}

export function buildZoneOverlayTextures(
  zones: WorldZonesData,
  toggles: ZoneToggleState,
  hoveredTile: { x: number; z: number } | null,
  colorDataOut?: Uint8Array,
  idDataOut?: Uint8Array,
  allianceOptions?: AllianceOverlayOptions,
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
    toggles.kingdoms ||
    toggles.territories ||
    toggles.biomes ||
    toggles.temperature ||
    toggles.alliances;
  if (!anyActive) {
    colorData.fill(0);
    idData.fill(0);
    const labelOnlyList: ZoneMapLabel[] = [];
    if (toggles.kingdomLabels) {
      zones.kingdomsById.forEach((k) => {
        if (k.buildingCount <= 0) return;
        labelOnlyList.push({
          id: `kingdom-${k.zoneId}`,
          kind: 'city',
          settlementId: k.settlementId,
          kingdomId: k.kingdomId,
          name: k.name,
          species: k.species,
          epochName: k.epochName,
          population: k.population,
          hexColor: k.hexColor,
          tileX: k.centerX,
          tileZ: k.centerZ,
          isHovered: false,
        });
      });
    }
    return { colorData, idData, anyActive: false, labels: labelOnlyList };
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
    if (toggles.kingdoms || toggles.alliances) hoveredKingdomId = zones.kingdomMap[hIdx];
    if (toggles.territories) hoveredTerritoryId = zones.territoryMap[hIdx];
    if (toggles.biomes) hoveredBiomeId = zones.biomeMap[hIdx];
    if (toggles.temperature) hoveredTempId = zones.tempBandMap[hIdx];
  }

  const selectedRootKingdomId = allianceOptions?.selectedAllianceKingdomId ?? null;
  const relations = allianceOptions?.kingdomRelations;
  const settlementKingdoms = allianceOptions?.settlementKingdoms;

  const getAllianceRgb = (
    settlementId: string,
  ): { rgb: [number, number, number]; hex: string } => {
    const rootId = settlementKingdoms?.[settlementId] ?? settlementId;
    if (!selectedRootKingdomId) {
      return { rgb: [110, 128, 152], hex: '#94a3b8' };
    }
    if (rootId === selectedRootKingdomId) {
      return { rgb: [37, 99, 235], hex: '#3b82f6' };
    }
    const rel = resolveKingdomRelationPair(relations, selectedRootKingdomId, rootId);
    if (rel === 'allied') {
      return { rgb: [59, 130, 246], hex: '#60a5fa' };
    }
    if (rel === 'war') {
      return { rgb: [239, 68, 68], hex: '#ef4444' };
    }
    return { rgb: [108, 117, 125], hex: '#94a3b8' };
  };

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
        const w = 1.05;
        rAcc += info.color[0] * w;
        gAcc += info.color[1] * w;
        bAcc += info.color[2] * w;
        wAcc += w;
        alphaMax = Math.max(alphaMax, 184);
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

    if (toggles.kingdoms && !toggles.alliances) {
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

    if (toggles.alliances) {
      const kid = zones.kingdomMap[i];
      if (kid > 0) {
        const info = zones.kingdomsById.get(kid);
        if (info) {
          const aCol = getAllianceRgb(info.settlementId);
          const w = 2.4;
          rAcc += aCol.rgb[0] * w;
          gAcc += aCol.rgb[1] * w;
          bAcc += aCol.rgb[2] * w;
          wAcc += w;
          alphaMax = Math.max(alphaMax, zones.kingdomIsSea[i] ? 182 : 210);
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
  if (toggles.alliances) {
    zones.kingdomsById.forEach((k) => {
      const aCol = getAllianceRgb(k.settlementId);
      labels.push({
        id: `alliance-${k.zoneId}`,
        kind: 'city',
        settlementId: k.settlementId,
        kingdomId: k.kingdomId,
        name: k.name,
        species: k.species,
        epochName: k.epochName,
        population: k.population,
        hexColor: aCol.hex,
        tileX: k.centerX,
        tileZ: k.centerZ,
        isHovered: k.zoneId === hoveredKingdomId,
      });
    });
  } else if (toggles.kingdomLabels) {
    zones.kingdomsById.forEach((k) => {
      if (!toggles.kingdoms && k.buildingCount <= 0) return;
      labels.push({
        id: `kingdom-${k.zoneId}`,
        kind: 'city',
        settlementId: k.settlementId,
        kingdomId: k.kingdomId,
        name: k.name,
        species: k.species,
        epochName: k.epochName,
        population: k.population,
        hexColor: k.hexColor,
        tileX: k.centerX,
        tileZ: k.centerZ,
        isHovered: toggles.kingdoms && k.zoneId === hoveredKingdomId,
      });
    });
  }
  if (toggles.territories) {
    zones.territoriesById.forEach((t) => {
      labels.push({
        id: `territory-${t.zoneId}`,
        kind: 'territory',
        name: t.name,
        population: t.animalCount,
        hexColor: t.hexColor,
        tileX: t.centerX,
        tileZ: t.centerZ,
        isHovered: t.zoneId === hoveredTerritoryId,
        flatGround: true,
      });
    });
  }
  if (toggles.biomes) {
    zones.biomesById.forEach((b) => {
      if (b.tileCount >= 24 && b.name !== 'Deepseas' && b.name !== 'Shore') {
        const anchors =
          b.labelAnchors && b.labelAnchors.length > 0
            ? b.labelAnchors
            : [{ x: b.centerX, z: b.centerZ, tileCount: b.tileCount }];
        for (let ai = 0; ai < anchors.length; ai++) {
          labels.push({
            id: ai === 0 ? `biome-${b.zoneId}` : `biome-${b.zoneId}-${ai}`,
            kind: 'biome',
            name: b.name,
            population: null,
            hexColor: b.hexColor,
            tileX: anchors[ai].x,
            tileZ: anchors[ai].z,
            isHovered: b.zoneId === hoveredBiomeId,
            flatGround: true,
          });
        }
      }
    });
  }
  if (toggles.temperature) {
    zones.tempBandsById.forEach((tm) => {
      if (tm.tileCount >= 24) {
        const anchors =
          tm.labelAnchors && tm.labelAnchors.length > 0
            ? tm.labelAnchors
            : zones.tempBandMap[tm.centerZ * size + tm.centerX] === tm.zoneId
              ? [{ x: tm.centerX, z: tm.centerZ, tileCount: tm.tileCount }]
              : [];
        for (let ai = 0; ai < anchors.length; ai++) {
          const ax = anchors[ai].x;
          const az = anchors[ai].z;
          const aIdx = az * size + ax;
          if (zones.tempBandMap[aIdx] !== tm.zoneId) continue;
          const localTempC = zones.tempCelsiusMap[aIdx];
          labels.push({
            id: ai === 0 ? `temp-${tm.zoneId}` : `temp-${tm.zoneId}-${ai}`,
            kind: 'temperature',
            name: tm.name,
            subtitle: `${localTempC}°C`,
            population: null,
            hexColor: tm.hexColor,
            tileX: ax,
            tileZ: az,
            isHovered: tm.zoneId === hoveredTempId,
            flatGround: true,
          });
        }
      }
    });
  }

  return { colorData, idData, anyActive: true, labels };
}

/**
 * Returns a lookup map from settlementId / rootKingdomId to the kingdom's hex color
 * so King map markers always match their kingdom's exact zone color.
 */
export function extractKingdomColorsMap(
  zones: WorldZonesData,
  sim: SimulationState,
): Record<string, string> {
  const map: Record<string, string> = {};
  zones.kingdomsById.forEach((k) => {
    map[k.settlementId] = k.hexColor;
    const rootId = sim.settlementKingdoms?.[k.settlementId] ?? k.settlementId;
    if (!map[rootId]) {
      map[rootId] = k.hexColor;
    }
  });
  return map;
}

/**
 * Lightweight O(B + U) kingdom label generator used when ONLY Kingdom Labels are enabled
 * (default gameplay state) without running full map Voronoi zone flood-fills.
 * Emits labels exclusively for races that have founded a civilization (at least 1 standing building).
 */
export function computeKingdomLabelsOnly(sim: SimulationState): ZoneMapLabel[] {
  if (sim.buildings.length === 0) return [];
  const size = sim.gridSize;

  interface FoundedSettlement {
    id: string;
    name: string;
    species: SpeciesId;
    buildingCount: number;
    completedCount: number;
    sumX: number;
    sumZ: number;
    anchorCount: number;
    pop: number;
  }

  const settlements = new Map<string, FoundedSettlement>();
  for (let i = 0; i < sim.buildings.length; i++) {
    const b = sim.buildings[i];
    if (b.hp <= 0) continue;
    const sid = b.settlementId || 'city_default';
    let rec = settlements.get(sid);
    if (!rec) {
      const sp: SpeciesId = sim.settlementSpecies?.[sid] ?? b.species ?? 'human';
      rec = {
        id: sid,
        name: sim.settlementNames?.[sid] || createSeededNomadName(sid, sim.seed, sp),
        species: sp,
        buildingCount: 0,
        completedCount: 0,
        sumX: 0,
        sumZ: 0,
        anchorCount: 0,
        pop: 0,
      };
      settlements.set(sid, rec);
    }
    rec.buildingCount++;
    if (b.constructionProgress >= 100) rec.completedCount++;
    rec.sumX += b.tileX;
    rec.sumZ += b.tileZ;
    rec.anchorCount++;
  }

  if (settlements.size === 0) return [];

  for (let i = 0; i < sim.units.length; i++) {
    const u = sim.units[i];
    if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0) continue;
    let rec = u.settlementId ? settlements.get(u.settlementId) : undefined;
    if (!rec && u.kingdomId) {
      let bestDistSq = Infinity;
      settlements.forEach((cand) => {
        if ((sim.settlementKingdoms?.[cand.id] ?? cand.id) !== u.kingdomId) return;
        const cx = cand.sumX / Math.max(1, cand.anchorCount);
        const cz = cand.sumZ / Math.max(1, cand.anchorCount);
        const d2 = (u.x - cx) * (u.x - cx) + (u.z - cz) * (u.z - cz);
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          rec = cand;
        }
      });
    }
    if (rec) {
      rec.pop++;
    }
  }

  const labels: ZoneMapLabel[] = [];
  const kingdomColorIndex = new Map<string, number>();
  let kIdxCounter = 0;
  settlements.forEach((s) => {
    if (s.pop === 0 && s.completedCount === 0) return;
    const zoneId = Math.min(254, ++kIdxCounter);
    const rootKingdomId = sim.settlementKingdoms?.[s.id] ?? s.id;
    let colorSlot = kingdomColorIndex.get(rootKingdomId);
    if (colorSlot === undefined) {
      colorSlot = kingdomColorIndex.size;
      kingdomColorIndex.set(rootKingdomId, colorSlot);
    }
    const palette = KINGDOM_PALETTES[s.species] || KINGDOM_PALETTES.human;
    const color = palette[colorSlot % palette.length];
    const cx = Math.max(0, Math.min(size - 1, Math.round(s.sumX / Math.max(1, s.anchorCount))));
    const cz = Math.max(0, Math.min(size - 1, Math.round(s.sumZ / Math.max(1, s.anchorCount))));
    const kEpoch = getKingdomEpoch(sim, rootKingdomId);
    const epochDef = EPOCHS[Math.max(0, Math.min(EPOCHS.length - 1, kEpoch))] || EPOCHS[0];
    labels.push({
      id: `kingdom-${zoneId}`,
      kind: 'city',
      settlementId: s.id,
      kingdomId: rootKingdomId,
      name: s.name,
      species: s.species,
      epochName: epochDef ? epochDef.name : 'Stone Age',
      population: s.pop,
      hexColor: rgbToHex(color),
      tileX: cx,
      tileZ: cz,
      isHovered: false,
    });
  });

  return labels;
}

/**
 * Computes active war-front conquest arrows between warring kingdoms ONLY when
 * Kingdoms or Alliances zone overlays are enabled and wars are active.
 * Each arrow's `progress` (0.10..0.94) dynamically expands toward the target
 * capital as territory is claimed, enemy structures fall, or armies push across
 * the border — and decreases/retracts when pushed back.
 */
export function computeWarFrontArrows(
  zones: WorldZonesData,
  sim: SimulationState,
  toggles: ZoneToggleState,
  allianceContext?: {
    selectedAllianceKingdomId?: string | null;
  },
): WarFrontArrowData[] {
  if (sim.worldRules?.warsEnabled === false) return [];
  if (!toggles.kingdoms && !toggles.alliances) return [];

  const relations = sim.kingdomRelations;
  if (!relations) return [];

  interface AggKingdom {
    kingdomId: string;
    name: string;
    species: SpeciesId;
    hexColor: string;
    totalTiles: number;
    landTiles: number;
    buildingCount: number;
    centerX: number;
    centerZ: number;
    weightSum: number;
  }

  const byRoot = new Map<string, AggKingdom>();
  zones.kingdomsById.forEach((k) => {
    const rootId = sim.settlementKingdoms?.[k.settlementId] ?? k.kingdomId;
    let agg = byRoot.get(rootId);
    const w = Math.max(1, k.totalTileCount + k.buildingCount * 10);
    if (!agg) {
      agg = {
        kingdomId: rootId,
        name: sim.settlementNames?.[rootId] || k.name,
        species: k.species,
        hexColor: k.hexColor,
        totalTiles: 0,
        landTiles: 0,
        buildingCount: 0,
        centerX: 0,
        centerZ: 0,
        weightSum: 0,
      };
      byRoot.set(rootId, agg);
    }
    agg.totalTiles += k.totalTileCount;
    agg.landTiles += k.landTileCount;
    agg.buildingCount += k.buildingCount;
    agg.centerX += k.centerX * w;
    agg.centerZ += k.centerZ * w;
    agg.weightSum += w;
  });

  // Ignore transient 0-building nomad camps so only real established kingdoms emit war-front arrows
  byRoot.forEach((agg, rootId) => {
    if (agg.buildingCount <= 0) {
      byRoot.delete(rootId);
    }
  });

  if (byRoot.size < 2) return [];
  byRoot.forEach((agg) => {
    agg.centerX /= Math.max(1, agg.weightSum);
    agg.centerZ /= Math.max(1, agg.weightSum);
  });

  // Collect military units & war vehicles per root kingdom for live frontline push sampling
  const armyPointsByRoot = new Map<string, Array<{ x: number; z: number }>>();
  for (let i = 0; i < sim.units.length; i++) {
    const u = sim.units[i];
    if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0 || u.ageStage === 'child') continue;
    const rootId = u.settlementId ? (sim.settlementKingdoms?.[u.settlementId] ?? u.settlementId) : u.kingdomId;
    if (!rootId || !byRoot.has(rootId)) continue;
    let pts = armyPointsByRoot.get(rootId);
    if (!pts) {
      pts = [];
      armyPointsByRoot.set(rootId, pts);
    }
    pts.push({ x: u.x, z: u.z });
  }
  for (let vi = 0; vi < (sim.vehicles?.length ?? 0); vi++) {
    const v = sim.vehicles![vi];
    if (!v.isMilitary || (v.hp ?? 0) <= 0) continue;
    const rootId = v.kingdomId ?? (sim.settlementKingdoms?.[v.settlementId] ?? v.settlementId);
    if (!rootId || !byRoot.has(rootId)) continue;
    let pts = armyPointsByRoot.get(rootId);
    if (!pts) {
      pts = [];
      armyPointsByRoot.set(rootId, pts);
    }
    pts.push({ x: v.x, z: v.z });
  }

  const rootList = Array.from(byRoot.values());
  const selectedAllianceRoot = allianceContext?.selectedAllianceKingdomId
    ? (sim.settlementKingdoms?.[allianceContext.selectedAllianceKingdomId] ?? allianceContext.selectedAllianceKingdomId)
    : null;

  interface CandidateArrow {
    arrow: WarFrontArrowData;
    priorityScore: number;
  }
  const bestArrowByAttacker = new Map<string, CandidateArrow>();

  for (let i = 0; i < rootList.length; i++) {
    for (let j = i + 1; j < rootList.length; j++) {
      const kA = rootList[i];
      const kB = rootList[j];
      const [firstId, secondId] = kA.kingdomId < kB.kingdomId ? [kA.kingdomId, kB.kingdomId] : [kB.kingdomId, kA.kingdomId];
      const pairKey = `${firstId}::${secondId}`;
      if (resolveKingdomRelationPair(relations, firstId, secondId) !== 'war') continue;

      const dist = Math.hypot(kB.centerX - kA.centerX, kB.centerZ - kA.centerZ);
      if (dist < 2.5) continue;

      // Lazily capture accurate tile baseline the first time a war is measured with zones computed
      if (!sim.warFrontBaselines) sim.warFrontBaselines = {};
      let baseline = sim.warFrontBaselines[pairKey];
      const tilesFirst = kA.kingdomId === firstId ? kA.totalTiles : kB.totalTiles;
      const tilesSecond = kA.kingdomId === firstId ? kB.totalTiles : kA.totalTiles;
      const bldFirst = kA.kingdomId === firstId ? kA.buildingCount : kB.buildingCount;
      const bldSecond = kA.kingdomId === firstId ? kB.buildingCount : kA.buildingCount;
      if (!baseline) {
        baseline = {
          startYear: sim.year ?? 0,
          initialTilesA: Math.max(1, tilesFirst),
          initialTilesB: Math.max(1, tilesSecond),
          initialBuildingsA: Math.max(1, bldFirst),
          initialBuildingsB: Math.max(1, bldSecond),
        };
        sim.warFrontBaselines[pairKey] = baseline;
      } else if (baseline.initialTilesA <= 0 || baseline.initialTilesB <= 0) {
        baseline.initialTilesA = Math.max(1, tilesFirst);
        baseline.initialTilesB = Math.max(1, tilesSecond);
      }

      const initTilesA = kA.kingdomId === firstId ? baseline.initialTilesA : baseline.initialTilesB;
      const initTilesB = kA.kingdomId === firstId ? baseline.initialTilesB : baseline.initialTilesA;
      const initBldA = kA.kingdomId === firstId ? baseline.initialBuildingsA : baseline.initialBuildingsB;
      const initBldB = kA.kingdomId === firstId ? baseline.initialBuildingsB : baseline.initialBuildingsA;

      const emitDirectionalArrow = (
        atk: AggKingdom,
        def: AggKingdom,
        atkInitTiles: number,
        defInitTiles: number,
        defInitBld: number,
      ) => {
        if (toggles.alliances && selectedAllianceRoot) {
          const involvesSelected =
            atk.kingdomId === selectedAllianceRoot ||
            def.kingdomId === selectedAllianceRoot ||
            resolveKingdomRelationPair(relations, atk.kingdomId, selectedAllianceRoot) === 'allied' ||
            resolveKingdomRelationPair(relations, def.kingdomId, selectedAllianceRoot) === 'allied';
          if (!involvesSelected) return;
        }

        const dx = def.centerX - atk.centerX;
        const dz = def.centerZ - atk.centerZ;
        const len = Math.max(1, Math.hypot(dx, dz));
        const ux = dx / len;
        const uz = dz / len;

        // 1. Measure troop vanguard advancement along atk -> def axis
        const armyPts = armyPointsByRoot.get(atk.kingdomId) ?? [];
        let vanguardMax = 0;
        let vanguardTopSum = 0;
        let vanguardTopCount = 0;
        const projections: number[] = [];
        for (let p = 0; p < armyPts.length; p++) {
          const proj = ((armyPts[p].x - atk.centerX) * ux + (armyPts[p].z - atk.centerZ) * uz) / len;
          if (proj > 0.05) {
            projections.push(Math.min(1.0, proj));
            if (proj > vanguardMax) vanguardMax = proj;
          }
        }
        if (projections.length > 0) {
          projections.sort((a, b) => b - a);
          const take = Math.min(4, projections.length);
          for (let ti = 0; ti < take; ti++) {
            vanguardTopSum += projections[ti];
            vanguardTopCount++;
          }
        }
        const troopAdvance = vanguardTopCount > 0 ? (vanguardTopSum / vanguardTopCount) * 0.7 + vanguardMax * 0.3 : 0;

        // 2. Measure territorial claim shift & enemy building attrition
        const totalNow = Math.max(1, atk.totalTiles + def.totalTiles);
        const totalInit = Math.max(1, atkInitTiles + defInitTiles);
        const curShare = atk.totalTiles / totalNow;
        const baseShare = atkInitTiles / totalInit;
        const shareShift = curShare - baseShare; // positive when expanding, negative when losing ground
        const tileDelta = Math.round(atk.totalTiles - atkInitTiles);
        const enemyBldLossFrac =
          defInitBld > 0 ? Math.max(0, Math.min(1, (defInitBld - def.buildingCount) / defInitBld)) : 0;

        // 3. Combine into smooth expanding/decreasing war-front progress (0.12..0.94)
        const territoryScore = 0.28 + shareShift * 1.35 + enemyBldLossFrac * 0.42;
        const combinedProgress = Math.max(
          0.12,
          Math.min(0.94, territoryScore * 0.65 + Math.max(0.18, troopAdvance) * 0.35),
        );
        const claimPercent = Math.max(0, Math.min(100, Math.round(combinedProgress * 100)));

        const momentum: WarFrontArrowData['momentum'] =
          shareShift >= 0.04 || enemyBldLossFrac >= 0.15 || combinedProgress >= 0.52
            ? 'advancing'
            : shareShift <= -0.04 || combinedProgress <= 0.24
              ? 'retreating'
              : 'contested';

        // Alliance mode colors: Blue for selected kingdom / allies, Crimson Red for enemies
        let arrowColor = atk.hexColor;
        if (toggles.alliances) {
          if (selectedAllianceRoot) {
            const isAllySide =
              atk.kingdomId === selectedAllianceRoot ||
              resolveKingdomRelationPair(relations, atk.kingdomId, selectedAllianceRoot) === 'allied';
            arrowColor = isAllySide ? '#3b82f6' : '#ef4444';
          } else {
            arrowColor = '#ef4444';
          }
        }

        // Offset opposing arrows slightly to the right-hand side of their marching vector so both fronts stay crisp & separated
        const rightX = -uz;
        const rightZ = ux;
        const latOff = Math.min(1.6, Math.max(0.75, len * 0.045));

        const candidate: WarFrontArrowData = {
          id: `warfront-${atk.kingdomId}-to-${def.kingdomId}`,
          attackerKingdomId: atk.kingdomId,
          defenderKingdomId: def.kingdomId,
          attackerName: atk.name,
          defenderName: def.name,
          attackerSpecies: atk.species,
          fromX: atk.centerX + rightX * latOff,
          fromZ: atk.centerZ + rightZ * latOff,
          toX: def.centerX + rightX * latOff,
          toZ: def.centerZ + rightZ * latOff,
          progress: combinedProgress,
          tileDelta,
          claimPercent,
          hexColor: arrowColor,
          momentum,
        };

        // Each warring kingdom emits strictly 1 primary war-front arrow toward its biggest/most active war target
        // so the screen never floods with N*(N-1) arrows when empires have multiple enemies or splinter states
        const selectedBonus =
          selectedAllianceRoot && (atk.kingdomId === selectedAllianceRoot || def.kingdomId === selectedAllianceRoot)
            ? 100000
            : 0;
        const priorityScore =
          selectedBonus + def.totalTiles + def.buildingCount * 15 - len * 0.25;
        const prevBest = bestArrowByAttacker.get(atk.kingdomId);
        if (!prevBest || priorityScore > prevBest.priorityScore) {
          bestArrowByAttacker.set(atk.kingdomId, { arrow: candidate, priorityScore });
        }
      };

      emitDirectionalArrow(kA, kB, initTilesA, initTilesB, initBldB);
      emitDirectionalArrow(kB, kA, initTilesB, initTilesA, initBldA);
    }
  }

  return Array.from(bestArrowByAttacker.values()).map((c) => c.arrow);
}



