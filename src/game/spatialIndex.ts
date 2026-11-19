import { BuildingEntity, SimulationState, UnitEntity, UnitStatusEffect } from './types';

const CELL_SIZE = 8;
const STATUS_KEYS: readonly UnitStatusEffect[] = [
  'blessed',
  'cursed',
  'plagued',
  'frenzied',
  'shielded',
  'frozen',
];

export interface SettlementTickInfo {
  allBuildings: BuildingEntity[];
  completedBuildings: BuildingEntity[];
  homeAnchorX: number;
  homeAnchorZ: number;
  hasHumanTechSupport: boolean;
  hasElfArcaneTech: boolean;
  maxOwnedEpoch: number;
  population: number;
}

export interface SimulationTickIndex {
  gridSize: number;
  cellSize: number;
  cols: number;
  cells: (UnitEntity[] | undefined)[];
  unitsById: Map<string, UnitEntity>;
  buildingsById: Map<string, BuildingEntity>;
  settlements: Map<string, SettlementTickInfo>;
  livingCivCount: number;
  livingWildlifeCount: number;
  livingHostileCount: number;
  hostileUnits: UnitEntity[];
  dangerousWildlife: UnitEntity[];
  livingCivByKingdom: Map<string, UnitEntity[]>;
  /** Number of non-KO adult units currently targeting/building each buildingId */
  buildersByBuildingId: Map<string, number>;
  /** Number of non-KO adult units currently targeting/upgrading each buildingId */
  upgradersByBuildingId: Map<string, number>;
  /** Number of living civilization units currently gathering at or targeting tileKey (tz * gridSize + tx) */
  gatherersByTileKey: Map<number, number>;
  /** Number of living civilization units currently in 'gathering' state at tileKey */
  activeGatheringByTileKey: Map<number, number>;
  /** Living gathering units per settlement (for fast cooperative chopping lookup) */
  gatheringBySettlement: Map<string, UnitEntity[]>;
  /** Unit IDs currently attacking at least one unit in a given settlement */
  attackersOfSettlement: Map<string, Set<string>>;
  /** Unit IDs currently attacking at least one unit in a given kingdom */
  attackersOfKingdom: Map<string, Set<string>>;
  /** Cached kingdomId per unit id */
  unitKingdomId: Map<string, string | undefined>;
  /** Cached war adjacency: kingdomId -> Set of enemy kingdomIds */
  warEnemiesByKingdom: Map<string, Set<string>>;
  /** Cached set of settlementIds that have at least one completed building */
  hasCompletedBuilding: boolean;
}

const HUMAN_TECH_BUILDINGS = new Set([
  'smeltery',
  'observatory',
  'steam_foundry',
  'dynamo_plant',
  'fission_reactor',
  'cyber_institute',
  'launch_arcology',
  'dyson_spire',
]);

const ELF_ARCANE_BUILDINGS = new Set([
  'shaman_totem',
  'ziggurat',
  'observatory',
  'cyber_institute',
  'dyson_spire',
]);

/**
 * Zero-allocation status-effect decay helper (avoids Object.keys() per unit per tick).
 */
export function decayUnitStatusEffects(u: UnitEntity, dt: number): void {
  const fx = u.statusEffects;
  for (let i = 0; i < STATUS_KEYS.length; i++) {
    const key = STATUS_KEYS[i];
    const val = fx[key];
    if (val !== undefined && val > 0) {
      const next = val - dt;
      if (next <= 0) {
        delete fx[key];
      } else {
        fx[key] = next;
      }
    }
  }
}

export function isDangerousWildlifeRole(
  role: UnitEntity['role'],
  appearanceSeed: number | undefined,
  isCarnivoreFn: (role: UnitEntity['role'], seed?: number) => boolean,
): boolean {
  return (
    role === 'leviathan' ||
    role === 'dragon' ||
    role === 'wolf' ||
    role === 'bear' ||
    (role === 'dinosaur' && isCarnivoreFn(role, appearanceSeed))
  );
}

/**
 * Builds a single-pass per-tick spatial hash & relational index for O(1) unit/building queries.
 * Eliminates all O(N^3) and O(N^2) nested loops in stepSimulation while preserving exact AI semantics.
 */
export function buildSimulationTickIndex(
  state: SimulationState,
  getKingdomIdFn: (state: SimulationState, settlementId?: string) => string | undefined,
  isCarnivoreFn: (role: UnitEntity['role'], seed?: number) => boolean,
): SimulationTickIndex {
  const gs = state.gridSize;
  const cols = Math.max(1, Math.ceil(gs / CELL_SIZE));
  const cells: (UnitEntity[] | undefined)[] = new Array(cols * cols);
  const unitsById = new Map<string, UnitEntity>();
  const buildingsById = new Map<string, BuildingEntity>();
  const settlements = new Map<string, SettlementTickInfo>();
  const hostileUnits: UnitEntity[] = [];
  const dangerousWildlife: UnitEntity[] = [];
  const livingCivByKingdom = new Map<string, UnitEntity[]>();
  const buildersByBuildingId = new Map<string, number>();
  const upgradersByBuildingId = new Map<string, number>();
  const gatherersByTileKey = new Map<number, number>();
  const activeGatheringByTileKey = new Map<number, number>();
  const gatheringBySettlement = new Map<string, UnitEntity[]>();
  const attackersOfSettlement = new Map<string, Set<string>>();
  const attackersOfKingdom = new Map<string, Set<string>>();
  const unitKingdomId = new Map<string, string | undefined>();
  const warEnemiesByKingdom = new Map<string, Set<string>>();

  // Precompute war diplomacy adjacency once per tick
  if (state.kingdomRelations) {
    for (const [pairKey, status] of Object.entries(state.kingdomRelations)) {
      if (status !== 'war') continue;
      const sep = pairKey.indexOf('::');
      if (sep <= 0) continue;
      const a = pairKey.slice(0, sep);
      const b = pairKey.slice(sep + 2);
      let setA = warEnemiesByKingdom.get(a);
      if (!setA) {
        setA = new Set<string>();
        warEnemiesByKingdom.set(a, setA);
      }
      setA.add(b);
      let setB = warEnemiesByKingdom.get(b);
      if (!setB) {
        setB = new Set<string>();
        warEnemiesByKingdom.set(b, setB);
      }
      setB.add(a);
    }
  }

  // Pass 1: Index all buildings once
  let hasCompletedBuilding = false;
  const unfinishedByTileKey = new Map<number, BuildingEntity>();
  const upgradeableByTileKey = new Map<number, BuildingEntity>();

  for (let i = 0; i < state.buildings.length; i++) {
    const b = state.buildings[i];
    buildingsById.set(b.id, b);
    const sid = b.settlementId ?? 'city_default';
    let info = settlements.get(sid);
    if (!info) {
      info = {
        allBuildings: [],
        completedBuildings: [],
        homeAnchorX: b.tileX,
        homeAnchorZ: b.tileZ,
        hasHumanTechSupport: state.epochIndex === 0,
        hasElfArcaneTech: false,
        maxOwnedEpoch: state.epochIndex,
        population: 0,
      };
      settlements.set(sid, info);
    }
    info.allBuildings.push(b);
    const bTileKey = b.tileZ * gs + b.tileX;
    if (b.constructionProgress >= 100) {
      hasCompletedBuilding = true;
      info.completedBuildings.push(b);
      if (b.epochLevel > info.maxOwnedEpoch) info.maxOwnedEpoch = b.epochLevel;
      if (!info.hasHumanTechSupport && HUMAN_TECH_BUILDINGS.has(b.type)) {
        info.hasHumanTechSupport = true;
      }
      if (!info.hasElfArcaneTech && ELF_ARCANE_BUILDINGS.has(b.type)) {
        info.hasElfArcaneTech = true;
      }
      if (b.epochLevel < state.epochIndex) {
        upgradeableByTileKey.set(bTileKey, b);
      }
    } else {
      unfinishedByTileKey.set(bTileKey, b);
    }
  }

  // Pass 2: Index all units once into spatial hash & relational buckets
  let livingCivCount = 0;
  let livingWildlifeCount = 0;
  let livingHostileCount = 0;

  for (let i = 0; i < state.units.length; i++) {
    const u = state.units[i];
    unitsById.set(u.id, u);

    if (u.state === 'ko' || u.hp <= 0) continue;

    // Spatial cell insertion (flat array index — zero Map hashing overhead)
    const cx = Math.max(0, Math.min(cols - 1, (u.x / CELL_SIZE) | 0));
    const cz = Math.max(0, Math.min(cols - 1, (u.z / CELL_SIZE) | 0));
    const cellKey = cz * cols + cx;
    let cellBucket = cells[cellKey];
    if (!cellBucket) {
      cellBucket = [];
      cells[cellKey] = cellBucket;
    }
    cellBucket.push(u);

    if (u.faction === 'hostile') {
      livingHostileCount++;
      hostileUnits.push(u);
    } else if (u.faction === 'wildlife') {
      livingWildlifeCount++;
      if (isDangerousWildlifeRole(u.role, u.appearanceSeed, isCarnivoreFn)) {
        dangerousWildlife.push(u);
      }
    } else if (u.faction === 'civilization') {
      livingCivCount++;
      const kid = u.settlementId ? getKingdomIdFn(state, u.settlementId) : u.kingdomId;
      unitKingdomId.set(u.id, kid);

      if (kid) {
        let kUnits = livingCivByKingdom.get(kid);
        if (!kUnits) {
          kUnits = [];
          livingCivByKingdom.set(kid, kUnits);
        }
        kUnits.push(u);
      }

      if (u.settlementId) {
        const sInfo = settlements.get(u.settlementId);
        if (sInfo) sInfo.population++;
      }

      // Track attackers targeting our kin (replaces O(N^3) isAttackingKin check)
      if (u.lastAttackerId) {
        if (u.settlementId) {
          let attSet = attackersOfSettlement.get(u.settlementId);
          if (!attSet) {
            attSet = new Set<string>();
            attackersOfSettlement.set(u.settlementId, attSet);
          }
          attSet.add(u.lastAttackerId);
        }
        if (kid) {
          let kAttSet = attackersOfKingdom.get(kid);
          if (!kAttSet) {
            kAttSet = new Set<string>();
            attackersOfKingdom.set(kid, kAttSet);
          }
          kAttSet.add(u.lastAttackerId);
        }
      }

      // Track active builders/upgraders targeting buildings (replaces O(N^2 * B) filter)
      const rtx = Math.max(0, Math.min(gs - 1, Math.round(u.targetX)));
      const rtz = Math.max(0, Math.min(gs - 1, Math.round(u.targetZ)));
      const targetTileKey = rtz * gs + rtx;

      if (
        u.ageStage !== 'child' &&
        u.carryingAmount === 0 &&
        (u.state === 'building' || u.state === 'moving')
      ) {
        // Check 3x3 neighborhood around targetTileKey for building within 1.2 tiles
        for (let dz = -1; dz <= 1; dz++) {
          const nz = rtz + dz;
          if (nz < 0 || nz >= gs) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = rtx + dx;
            if (nx < 0 || nx >= gs) continue;
            const nKey = nz * gs + nx;
            const unfin = unfinishedByTileKey.get(nKey);
            if (
              unfin &&
              unfin.settlementId === u.settlementId &&
              (u.targetX - unfin.tileX) ** 2 + (u.targetZ - unfin.tileZ) ** 2 <= 1.44
            ) {
              buildersByBuildingId.set(unfin.id, (buildersByBuildingId.get(unfin.id) ?? 0) + 1);
            }
            const upg = upgradeableByTileKey.get(nKey);
            if (
              upg &&
              upg.settlementId === u.settlementId &&
              (u.targetX - upg.tileX) ** 2 + (u.targetZ - upg.tileZ) ** 2 <= 1.44
            ) {
              upgradersByBuildingId.set(upg.id, (upgradersByBuildingId.get(upg.id) ?? 0) + 1);
            }
          }
        }
      }

      // Track gathering helper counts (replaces O(N^3) allyChopping & O(N^2) hasHelperHere)
      gatherersByTileKey.set(targetTileKey, (gatherersByTileKey.get(targetTileKey) ?? 0) + 1);
      if (u.state === 'gathering') {
        const ux = Math.max(0, Math.min(gs - 1, Math.round(u.x)));
        const uz = Math.max(0, Math.min(gs - 1, Math.round(u.z)));
        const uTileKey = uz * gs + ux;
        activeGatheringByTileKey.set(uTileKey, (activeGatheringByTileKey.get(uTileKey) ?? 0) + 1);
        if (u.settlementId) {
          let gList = gatheringBySettlement.get(u.settlementId);
          if (!gList) {
            gList = [];
            gatheringBySettlement.set(u.settlementId, gList);
          }
          gList.push(u);
        }
      }
    }
  }

  return {
    gridSize: gs,
    cellSize: CELL_SIZE,
    cols,
    cells,
    unitsById,
    buildingsById,
    settlements,
    livingCivCount,
    livingWildlifeCount,
    livingHostileCount,
    hostileUnits,
    dangerousWildlife,
    livingCivByKingdom,
    buildersByBuildingId,
    upgradersByBuildingId,
    gatherersByTileKey,
    activeGatheringByTileKey,
    gatheringBySettlement,
    attackersOfSettlement,
    attackersOfKingdom,
    unitKingdomId,
    warEnemiesByKingdom,
    hasCompletedBuilding,
  };
}

/**
 * Iterates all living units within `radius` world tiles of `(x, z)` using the spatial hash.
 * Returning `true` from `visitor` stops iteration early.
 */
export function forEachUnitInRadius(
  index: SimulationTickIndex,
  x: number,
  z: number,
  radius: number,
  visitor: (u: UnitEntity, distSq: number) => boolean | void,
): void {
  const cs = index.cellSize;
  const cols = index.cols;
  const cells = index.cells;
  const minCx = Math.max(0, Math.floor((x - radius) / cs));
  const maxCx = Math.min(cols - 1, Math.floor((x + radius) / cs));
  const minCz = Math.max(0, Math.floor((z - radius) / cs));
  const maxCz = Math.min(cols - 1, Math.floor((z + radius) / cs));
  const rSq = radius * radius;

  for (let cz = minCz; cz <= maxCz; cz++) {
    const rowOff = cz * cols;
    for (let cx = minCx; cx <= maxCx; cx++) {
      const bucket = cells[rowOff + cx];
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        const u = bucket[i];
        const dx = u.x - x;
        const dz = u.z - z;
        const dSq = dx * dx + dz * dz;
        if (dSq <= rSq) {
          if (visitor(u, dSq) === true) return;
        }
      }
    }
  }
}

/**
 * Fast check whether any other civilization unit is currently gathering within ~1.5 tiles of `(tx, tz)`.
 */
export function hasGatheringHelperNear(
  index: SimulationTickIndex,
  tx: number,
  tz: number,
  excludeUnitId: string,
): boolean {
  let found = false;
  forEachUnitInRadius(index, tx, tz, 1.55, (other) => {
    if (
      other.id !== excludeUnitId &&
      other.faction === 'civilization' &&
      other.state === 'gathering'
    ) {
      found = true;
      return true;
    }
  });
  return found;
}
