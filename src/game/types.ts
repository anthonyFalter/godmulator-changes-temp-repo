export type EpochId =
  | 'prehistoric'
  | 'bronze'
  | 'medieval'
  | 'industrial'
  | 'atomic'
  | 'information'
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
  | 'jungle'
  | 'savanna'
  | 'swamp'
  | 'highland'
  | 'mountain'
  | 'taiga'
  | 'tundra'
  | 'badlands'
  | 'blossom'
  | 'stone_road'
  | 'rail_track'
  | 'runway'
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
  height: number; // 0 = water, 1..10 = stepped elevation levels (mountains rise 5..10)
  terrain: TerrainType;
  resourceNode: ResourceNodeType;
  resourceAmount: number;
  blessedTimer: number;
  cursedTimer: number;
  onFireTimer: number;
  fireColor?: string;
  buildingId: string | null;
  farmSettlementId?: string;
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
  | 'rail_station'
  | 'fission_reactor'
  | 'cyber_institute'
  | 'airport'
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
  upgradeProgress?: number; // 0..100 progress toward next epochLevel
  blessedTimer: number;
  cursedTimer: number;
  shieldTimer: number;
  settlementId?: string;
  species?: SpeciesId;
}

export type SpeciesId = 'human' | 'elf' | 'orc';

export type UnitAgeStage = 'child' | 'adult';

export type AnimalRole =
  | 'cow'
  | 'bear'
  | 'wolf'
  | 'chicken'
  | 'pig'
  | 'capybara'
  | 'dinosaur'
  | 'dragon'
  | 'unicorn';

export type UnitRole =
  | 'human'
  | 'elf'
  | 'orc'
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
  | 'raider_behemoth'
  | AnimalRole;

export type UnitStatusEffect = 'blessed' | 'cursed' | 'plagued' | 'frenzied' | 'shielded' | 'frozen';

export interface UnitDefinition {
  role: UnitRole;
  species?: SpeciesId;
  category?: 'civilization' | 'hostile' | 'animal' | 'mythical';
  name: string;
  faction: 'civilization' | 'hostile' | 'wildlife';
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
  species: SpeciesId;
  faction: 'civilization' | 'hostile' | 'wildlife';
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
  kingdomId?: string;
  ageStage?: UnitAgeStage;
  growthTimer?: number;
  appearanceSeed?: number;
  attackAnimTimer?: number;
  attackTargetX?: number;
  attackTargetZ?: number;
  dragonRunPhase?: 'approach' | 'strafe' | 'turn';
  dragonRunTimer?: number;
  dragonRunDirX?: number;
  dragonRunDirZ?: number;
  dragonAnchorX?: number;
  dragonAnchorZ?: number;
  dragonTurnSign?: number;
  dragonBreathCooldown?: number;
  expeditionTargetX?: number;
  expeditionTargetZ?: number;
  expeditionTimer?: number;
  favorite?: boolean;
  isKing?: boolean;
  genes?: string[];
  items?: string[];
  bornYear?: number;
  ageYears?: number;
  maxLifespan?: number;
  kills?: number;
  altitude?: number;
  vzVertical?: number;
  vxAir?: number;
  vzAir?: number;
  fallDamageArmed?: boolean;
  draggedByPlayer?: boolean;
  dragTargetX?: number;
  dragTargetZ?: number;
  dragTargetAltitude?: number;
  lastAttackerId?: string;
  underAttackTimer?: number;
  weaponCooldown?: number;
  isRebel?: boolean;
  battlewillActive?: number;
  battlewillCooldown?: number;
  battlewillSlashTimer?: number;
  battlewillHeading?: number;
}

export type GodPowerType =
  | 'drag_entity'
  | 'blessing'
  | 'rain_of_plenty'
  | 'eureka'
  | 'golden_age'
  | 'divine_shield'
  | 'heat_wave'
  | 'freeze_snap'
  | 'bloodlust_frenzy'
  | 'curse'
  | 'plague_miasma'
  | 'lightning_smite'
  | 'tornado'
  | 'tsunami'
  | 'meteor_strike'
  | 'earthquake'
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
  | 'stone_road'
  | 'rail_track';

export interface TerrainToolDefinition {
  type: TerrainToolType;
  name: string;
  summary: string;
  faithCost: number;
  color: string;
}

export type VehicleType =
  | 'train'
  | 'car'
  | 'plane'
  | 'roadster'
  | 'glider'
  | 'tank'
  | 'warship'
  | 'airship'
  | 'helicopter'
  | 'bomber_plane'
  | 'orc_flyer'
  | 'orbital_gunship';

export interface VehicleEntity {
  id: string;
  type: VehicleType;
  species: SpeciesId;
  settlementId: string;
  kingdomId?: string;
  isMilitary?: boolean;
  hp?: number;
  maxHp?: number;
  attackCooldown?: number;
  epochLevel: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  bank: number;
  speed: number;
  path: Array<{ x: number; z: number }>;
  pathIndex: number;
  variantSeed: number;
  flightPhase?: 'parked' | 'takeoff' | 'cruise' | 'landing';
  phaseTimer?: number;
  strafeExtendTimer?: number;
  stuntPhase?: 'cruise' | 'charge' | 'launch_flip' | 'hover_spin' | 'barrel_roll';
  stuntTimer?: number;
  stuntDuration?: number;
  thrusterActive?: boolean;
}

export type DiplomaticRelation = 'allied' | 'neutral' | 'war';

export type ZoneOverlayType =
  | 'kingdoms'
  | 'kings'
  | 'territories'
  | 'biomes'
  | 'temperature'
  | 'alliances';

export type ZoneToggleState = Record<ZoneOverlayType, boolean>;

export type ToolCategory = 'powers' | 'terrain' | 'build' | 'spawn' | 'zones' | 'rules' | 'epochs' | 'inspect';

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

export type EarthquakeShapeKind = 'short_rupture' | 'long_rift' | 'branching_fault' | 'orogenic_uplift';

export interface EarthquakeFaultSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  upliftBias: number;
  isBranch?: boolean;
}

export type BrushInputMode = 'tap' | 'hold';

export interface VisualEffectEvent {
  id: string;
  type:
    | GodPowerType
    | 'terrain_sculpt'
    | 'build_complete'
    | 'hit_spark'
    | 'epoch_up'
    | 'dragon_fire_breath'
    | 'animal_attack'
    | 'blackhole_explosion'
    | 'nuke_blast'
    | 'arcane_cataclysm'
    | 'battlewill_slash'
    | 'projectile_tracer';
  x: number;
  y: number;
  z: number;
  originX?: number;
  originY?: number;
  originZ?: number;
  sourceUnitId?: string;
  variant?: 'bite' | 'slam' | 'crunch' | 'peck' | 'horn_blast' | 'fire_breath';
  vfxSubtype?: 'bullet' | 'cannon_shell' | 'bomb' | 'missile' | 'arcane_bolt' | 'plasma_beam';
  radius: number;
  color: string;
  createdAt: number;
  deferImpact?: boolean;
  faultSegments?: EarthquakeFaultSegment[];
  quakeShapeKind?: EarthquakeShapeKind;
  quakeExtent?: number;
}

export interface ActiveHazardZone {
  id: string;
  kind:
    | 'rain_cloud'
    | 'plague_cloud'
    | 'shield_dome'
    | 'wormhole_rift'
    | 'tsunami_wave'
    | 'earthquake_zone'
    | 'tornado_vortex'
    | 'heat_wave_zone'
    | 'freeze_wave_zone'
    | 'blessing_wave'
    | 'curse_wave'
    | 'frenzy_wave'
    | 'terraform_wave';
  x: number;
  z: number;
  targetX?: number;
  targetZ?: number;
  windX?: number;
  windZ?: number;
  heading?: number;
  exploded?: boolean;
  arrivalRemaining?: number;
  arrivalDuration?: number;
  impactPending?: boolean;
  currentSpeed?: number;
  currentRadius?: number;
  maxRadius?: number;
  waveWaterTarget?: boolean;
  waveTargetHeight?: number;
  waveEpochIdx?: number;
  radius: number;
  remaining: number;
  duration: number;
  tickTimer: number;
  faultSegments?: EarthquakeFaultSegment[];
  quakeShapeKind?: EarthquakeShapeKind;
  quakeExtent?: number;
}

export type GameLifecycleState = 'title' | 'playing' | 'paused' | 'gameover';

export type LightingPreset = 'noon' | 'dusk' | 'night' | 'midnight' | 'dawn' | 'auto';

export type GraphicsQualityPreset = 'high' | 'balanced' | 'fast' | 'custom';
export type ShadowQualityOption = 'on' | 'fast' | 'off';
export type SkyCloudsQualityOption = 'full' | 'reduced' | 'off';
export type FoliageDetailOption = 'full' | 'medium' | 'low';
export type ParticleDetailOption = 'full' | 'reduced' | 'low';

export interface GraphicsSettings {
  preset: GraphicsQualityPreset;
  shadows: ShadowQualityOption;
  cloudsAndSky: SkyCloudsQualityOption;
  foliageDensity: FoliageDetailOption;
  particles: ParticleDetailOption;
  autoOptimizeFps: boolean;
}

export type WorldTemplateId =
  | 'realistic'
  | 'fantastic'
  | 'scifi'
  | 'prehistoric'
  | 'archipelago'
  | 'custom';

export interface WorldRulesConfig {
  allowFantasy: boolean;
  allowDinosaurs: boolean;
  raiderWaves: boolean;
  wildfireSpread: boolean;
  autoBuildEnabled: boolean;
  sandboxFreeMode: boolean;
  immortalEntities: boolean;
  dayNightCycle: boolean;
  allowReproduction: boolean;
  animalAttacks: boolean;
  allowRebellion: boolean;
  warsEnabled: boolean;
  startingEpochIndex: number;
  startingSettlers: 'none' | 'pioneers' | 'colony';
}

export interface WorldGenConfig {
  worldName: string;
  template: WorldTemplateId;
  gridSize: number;
  seed: number;
  seaLevel: 'low' | 'normal' | 'high';
  mountainDensity: 'low' | 'normal' | 'high';
  climate: 'cold' | 'temperate' | 'warm';
  rules: WorldRulesConfig;
}

export interface SimulationState {
  seed: number;
  gridSize: number;
  worldName?: string;
  worldTemplate?: WorldTemplateId;
  worldRules?: WorldRulesConfig;
  tiles: TileData[];
  epochIndex: number;
  epochProgress: number; // 0..100 toward next epoch
  year: number;
  resources: Resources;
  rates: Resources;
  buildings: BuildingEntity[];
  units: UnitEntity[];
  vehicles?: VehicleEntity[];
  population: number;
  populationCap: number;
  happiness: number; // 0..100
  goldenAgeTimer: number;
  autoBuildEnabled: boolean;
  sandboxFreeMode: boolean;
  chronicle: ChronicleEvent[];
  pendingVfx: VisualEffectEvent[];
  activeHazards: ActiveHazardZone[];
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
  settlementSpecies?: Record<string, SpeciesId>;
  settlementKingdoms?: Record<string, string>;
  kingdomResources?: Record<string, Resources>;
  unallocatedResources?: Resources;
  kingdomUltimateCooldowns?: Record<string, number>;
  kingdomRelations?: Record<string, DiplomaticRelation>;
  kingdomPeacefulTraits?: Record<string, boolean>;
  diplomacyTimer?: number;
  rebellionTimer?: number;
  wildlifeSeeded?: boolean;
  wildlifeRespawnTimer?: number;
  raiderWaveTimer?: number;
}
