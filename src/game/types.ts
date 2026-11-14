export type EpochId =
  | 'prehistoric'
  | 'bronze'
  | 'medieval'
  | 'industrial'
  | 'atomic'
  | 'orbital'
  | 'interstellar';

export interface EpochDefinition {
  id: EpochId;
  index: number;
  name: string;
  yearLabel: string;
  description: string;
  unlockCost: {
    food: number;
    wood: number;
    stone: number;
    ore: number;
    knowledge: number;
    energy: number;
    alloy: number;
    faith: number;
  };
  skyColor: string;
  accentColor: string;
  populationBonus: number;
}

export interface Resources {
  food: number;
  wood: number;
  stone: number;
  ore: number;
  knowledge: number;
  energy: number;
  alloy: number;
  faith: number;
}

export type TerrainType =
  | 'deep_water'
  | 'shallow_water'
  | 'sand'
  | 'grass'
  | 'fertile'
  | 'forest'
  | 'savanna'
  | 'swamp'
  | 'highland'
  | 'stone_road'
  | 'rock'
  | 'snow'
  | 'scorched'
  | 'crystal_field';

export type ResourceNodeType =
  | 'none'
  | 'timber_grove'
  | 'berry_bush'
  | 'stone_outcrop'
  | 'ore_vein'
  | 'crystal_monolith';

export interface TileData {
  x: number;
  z: number;
  height: number; // 0 = water, 1..8 = stepped elevation levels
  terrain: TerrainType;
  resourceNode: ResourceNodeType;
  resourceAmount: number;
  blessedTimer: number;
  cursedTimer: number;
  onFireTimer: number;
  buildingId: string | null;
}

export type BuildingType =
  | 'bonfire'
  | 'forager_hut'
  | 'shaman_totem'
  | 'granary'
  | 'smeltery'
  | 'ziggurat'
  | 'guildhall'
  | 'observatory'
  | 'steam_foundry'
  | 'dynamo_plant'
  | 'fission_reactor'
  | 'cyber_institute'
  | 'launch_arcology'
  | 'dyson_spire';

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  epoch: EpochId;
  roleSummary: string;
  keyHint: string;
  cost: Partial<Resources>;
  maxHp: number;
  popCapBonus: number;
  productionPerSec: Partial<Resources>;
  footprint: number; // 1 or 2
}

export interface BuildingEntity {
  id: string;
  type: BuildingType;
  tileX: number;
  tileZ: number;
  hp: number;
  maxHp: number;
  constructionProgress: number; // 0..100
  epochLevel: number;
  blessedTimer: number;
  cursedTimer: number;
  shieldTimer: number;
  settlementId?: string;
}

export type UnitRole =
  | 'villager'
  | 'forager'
  | 'miner'
  | 'builder'
  | 'warrior'
  | 'priest'
  | 'scholar'
  | 'astro_engineer'
  | 'raider_swarmer'
  | 'raider_ranged'
  | 'raider_behemoth';

export type UnitStatusEffect = 'blessed' | 'cursed' | 'plagued' | 'frenzied' | 'shielded';

export interface UnitDefinition {
  role: UnitRole;
  name: string;
  faction: 'civilization' | 'hostile';
  roleSummary: string;
  cost: Partial<Resources>;
  maxHp: number;
  speed: number;
  attackDamage: number;
  attackRange: number;
  harvestRate: number;
}

export interface UnitEntity {
  id: string;
  name: string;
  role: UnitRole;
  faction: 'civilization' | 'hostile';
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  hp: number;
  maxHp: number;
  state: 'idle' | 'moving' | 'gathering' | 'building' | 'fighting' | 'praying' | 'researching' | 'ko';
  koTimer: number;
  statusEffects: Partial<Record<UnitStatusEffect, number>>;
  carryingType: keyof Resources | null;
  carryingAmount: number;
  actionCooldown: number;
  windupTimer: number;
  targetEntityId: string | null;
  harvestTimer?: number;
  settlementId?: string;
}

export type GodPowerType =
  | 'blessing'
  | 'curse'
  | 'rain_of_plenty'
  | 'eureka'
  | 'golden_age'
  | 'divine_shield'
  | 'lightning_smite'
  | 'meteor_strike'
  | 'plague_miasma'
  | 'bloodlust_frenzy'
  | 'terraform_beam'
  | 'wormhole_ascension';

export interface GodPowerDefinition {
  type: GodPowerType;
  name: string;
  category: 'Benevolent' | 'Wrathful' | 'Cosmic';
  summary: string;
  faithCost: number;
  radius: number;
  keyHint: string;
  color: string;
}

export type TerrainToolType =
  | 'raise'
  | 'lower'
  | 'flatten'
  | 'fertile_meadow'
  | 'plant_forest'
  | 'seed_ore'
  | 'carve_river'
  | 'stone_road';

export interface TerrainToolDefinition {
  type: TerrainToolType;
  name: string;
  summary: string;
  faithCost: number;
  color: string;
}

export type ToolCategory = 'powers' | 'terrain' | 'build' | 'spawn' | 'epochs' | 'inspect';

export type ActiveTool =
  | { kind: 'inspect' }
  | { kind: 'power'; power: GodPowerType }
  | { kind: 'terrain'; tool: TerrainToolType }
  | { kind: 'build'; building: BuildingType }
  | { kind: 'spawn'; unit: UnitRole };

export interface ChronicleEvent {
  id: string;
  yearLabel: string;
  text: string;
  tone: 'divine' | 'epoch' | 'warning' | 'build';
  timestamp: number;
}

export interface VisualEffectEvent {
  id: string;
  type: GodPowerType | 'terrain_sculpt' | 'build_complete' | 'hit_spark' | 'epoch_up';
  x: number;
  y: number;
  z: number;
  radius: number;
  color: string;
  createdAt: number;
}

export type GameLifecycleState = 'title' | 'playing' | 'paused' | 'gameover';

export type LightingPreset = 'noon' | 'dusk' | 'night' | 'dawn' | 'auto';

export interface SimulationState {
  seed: number;
  gridSize: number;
  tiles: TileData[];
  epochIndex: number;
  epochProgress: number; // 0..100 toward next epoch
  year: number;
  resources: Resources;
  rates: Resources;
  buildings: BuildingEntity[];
  units: UnitEntity[];
  population: number;
  populationCap: number;
  happiness: number; // 0..100
  goldenAgeTimer: number;
  autoBuildEnabled: boolean;
  sandboxFreeMode: boolean;
  chronicle: ChronicleEvent[];
  pendingVfx: VisualEffectEvent[];
  totalMiraclesCast: number;
  totalStructuresBuilt: number;
  totalRaidersDefeated: number;
  selectedEntityId: string | null;
  selectedTile: { x: number; z: number } | null;
  outcome: 'none' | 'ascension_victory' | 'collapse_defeat';
  civPlanTimer?: number;
  harvestAccumulator?: Resources;
  harvestRates?: Resources;
  harvestWindowTimer?: number;
  settlementNames?: Record<string, string>;
}
