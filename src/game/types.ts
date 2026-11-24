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
  | 'crystal_field'
  | 'void_goo'
  | 'ice'
  | 'volcanic_wasteland'
  | 'blighted_mire'
  | 'floral_plains';

export type ResourceNodeType =
  | 'none'
  | 'timber_grove'
  | 'berry_bush'
  | 'stone_outcrop'
  | 'ore_vein'
  | 'crystal_monolith'
  | 'coral_reef'
  | 'scrap_flotsam'
  | 'atlantis_ruin'
  | 'ancient_ruin';

export type CropType =
  | 'wheat'
  | 'corn'
  | 'pumpkin'
  | 'sunflower'
  | 'root_crop'
  | 'berry_vine';

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
  farmPlotKind?: 'wheat' | 'timber_plantation' | 'quarry';
  cropType?: CropType;
  cropStage?: 0 | 1 | 2 | 3;
  cropGrowth?: number;
  claimedSettlementId?: string;
  isRiver?: boolean;
  isLake?: boolean;
  waterKind?: 'lava' | 'poison' | 'floral';
  liquidLevel?: number; // Elevated stackable liquid surface height (1..10) when pooling in mountain holes/basins
  liquidKind?: 'water' | 'lava' | 'poison'; // Liquid type for elevated stacked pools
  coralBleachTimer?: number;
  tempOffset?: number;
  frozenWaterBase?: 'deep_water' | 'shallow_water';
  crushedTimer?: number;
  burntTree?: boolean;
  burntTreeBiome?:
    | 'forest'
    | 'meadow'
    | 'jungle'
    | 'taiga'
    | 'blossom'
    | 'savanna'
    | 'swamp'
    | 'highland'
    | 'volcanic'
    | 'blight'
    | 'floral';
  treeBiomeOverride?:
    | 'forest'
    | 'meadow'
    | 'jungle'
    | 'taiga'
    | 'blossom'
    | 'savanna'
    | 'swamp'
    | 'highland'
    | 'volcanic'
    | 'blight'
    | 'floral';
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

export type SpeciesId = 'human' | 'elf' | 'orc' | 'dwarf' | 'lizardfolk';

export type UnitAgeStage = 'child' | 'adult';

export type AnimalRole =
  | 'cow'
  | 'bear'
  | 'wolf'
  | 'chicken'
  | 'pig'
  | 'capybara'
  | 'deer'
  | 'sheep'
  | 'rabbit'
  | 'fox'
  | 'boar'
  | 'lion'
  | 'elephant'
  | 'camel'
  | 'penguin'
  | 'crocodile'
  | 'horse'
  | 'goat'
  | 'monkey'
  | 'panda'
  | 'polar_bear'
  | 'hippo'
  | 'rhino'
  | 'turtle'
  | 'frog'
  | 'crab'
  | 'dinosaur'
  | 'dragon'
  | 'unicorn'
  | 'leviathan'
  | 'phoenix'
  | 'griffin'
  | 'yeti'
  | 'golem'
  | 'kitsune'
  | 'hydra'
  | 'minotaur'
  | 'pegasus'
  | 'cerberus'
  | 'ent'
  | 'giraffe'
  | 'zebra'
  | 'tiger'
  | 'gorilla'
  | 'kangaroo'
  | 'moose'
  | 'bison'
  | 'flamingo'
  | 'ostrich'
  | 'seal'
  | 'basilisk'
  | 'thunderbird'
  | 'kraken'
  | 'manticore'
  | 'gargoyle'
  | 'giant_spider'
  | 'firefly'
  | 'glow_moth'
  | 'lantern_jelly'
  | 'fairy'
  | 'fae'
  | 'will_o_wisp';

export type UnitRole =
  | 'human'
  | 'elf'
  | 'orc'
  | 'dwarf'
  | 'lizardfolk'
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
  | 'skeleton'
  | 'alien_trooper'
  | 'alien_ufo'
  | 'alien_walker'
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

export type UnitStatKey =
  | 'maxHp'
  | 'attackDamage'
  | 'armor'
  | 'speed'
  | 'critChance'
  | 'attackRange'
  | 'regenPerSec';

export type UnitStatBonuses = Partial<Record<UnitStatKey, number>>;

export interface UnitEntity {
  id: string;
  name: string;
  role: UnitRole;
  species: SpeciesId;
  faction: 'civilization' | 'hostile' | 'wildlife';
  x: number;
  z: number;
  prevX?: number;
  prevZ?: number;
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
  wildlifeSkillCooldown?: number;
  dinoRushTimer?: number;
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
  traits?: string[];
  genes?: string[];
  items?: string[];
  statBonuses?: UnitStatBonuses;
  /** Custom visual size multiplier edited in Entity Inspector (0.35..4.0, default 1.0) */
  sizeScale?: number;
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
  dragFlingNonLethal?: boolean;
  dragTargetX?: number;
  dragTargetZ?: number;
  walkerPrevStepX?: number;
  walkerPrevStepZ?: number;
  walkerStepParity?: number;
  dragTargetAltitude?: number;
  lastAttackerId?: string;
  underAttackTimer?: number;
  weaponCooldown?: number;
  isRebel?: boolean;
  battlewillActive?: number;
  battlewillCooldown?: number;
  battlewillSlashTimer?: number;
  battlewillHeading?: number;
  swimStamina?: number;
  isSwimming?: boolean;
  embarkedVehicleId?: string | null;
  leviathanSubmerged?: boolean;
  leviathanSurfaceTimer?: number;
  leviathanBeamTimer?: number;
  leviathanBeamCooldown?: number;
  leviathanBeamTargetX?: number;
  leviathanBeamTargetZ?: number;
  leviathanBeamOriginX?: number;
  leviathanBeamOriginZ?: number;
  leviathanLeapTimer?: number;
  leviathanLeapCooldown?: number;
  leviathanLeapStartX?: number;
  leviathanLeapStartZ?: number;
  leviathanLeapTargetX?: number;
  leviathanLeapTargetZ?: number;
  leviathanEatIslandCooldown?: number;
  treantDisguised?: boolean;
  treantIdleTimer?: number;
  gargoylePetrified?: boolean;
  phoenixReborn?: boolean;
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
  | 'start_war'
  | 'curse'
  | 'plague_miasma'
  | 'lightning_smite'
  | 'tornado'
  | 'tsunami'
  | 'meteor_strike'
  | 'earthquake'
  | 'volcano_eruption'
  | 'super_tornado'
  | 'void_goo'
  | 'terraform_beam'
  | 'wormhole_ascension'
  | 'undead_portal'
  | 'alien_invasion'
  | 'chrono_surge'
  | 'harmony_dove'
  | 'solar_orbital_laser'
  | 'gravity_flip'
  | 'lava_deluge'
  | 'blight_plague'
  | 'floral_paradise'
  | 'fortify_walls'
  | 'bountiful_harvest'
  | 'recruit_legion'
  | 'cleanse_land'
  | 'summon_fleet'
  | 'acid_rain'
  | 'blizzard'
  | 'sinkhole'
  | 'locust_swarm'
  | 'wildfire_ring';

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
  | 'rail_track'
  | 'crystal_shower'
  | 'boulder_rain'
  | 'blossom_rain'
  | 'jungle_bloom'
  | 'soil_enrich'
  | 'desert_dunes'
  | 'coral_reef_rain'
  | 'salvage_drop'
  | 'volcanic_obsidian'
  | 'atlantis_rise'
  | 'alpine_glacier'
  | 'abyssal_trench'
  | 'swamp_mire'
  | 'volcanic_wasteland'
  | 'blighted_mire'
  | 'floral_plains'
  | 'lava_river'
  | 'poison_river'
  | 'floral_rain'
  | 'canyon_carve'
  | 'mesa_plateau'
  | 'volcanic_crater'
  | 'smooth_terrain'
  | 'island_bridge'
  | 'water_drop';

export interface TerrainToolDefinition {
  type: TerrainToolType;
  name: string;
  category: 'Sculpt' | 'Sky Rain' | 'Biomes' | 'Water';
  isSkyRain?: boolean;
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
  | 'passenger_ship'
  | 'airship'
  | 'helicopter'
  | 'bomber_plane'
  | 'orc_flyer'
  | 'orbital_gunship'
  | 'farm_tractor'
  | 'quarry_truck';

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
  passengerIds?: string[];
  targetIslandX?: number;
  targetIslandZ?: number;
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
  | 'kingdomLabels'
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
  x?: number;
  z?: number;
}

export interface WorldWonder {
  id: string;
  kingdomId: string;
  settlementId: string;
  species: SpeciesId;
  name: string;
  tileX: number;
  tileZ: number;
  builtYear: number;
  bonusSummary: string;
}

export interface BattleMemorial {
  id: string;
  tileX: number;
  tileZ: number;
  yearLabel: string;
  fallenCount: number;
  species?: SpeciesId;
  label: string;
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
    | 'sky_rain_drop'
    | 'build_complete'
    | 'hit_spark'
    | 'epoch_up'
    | 'dragon_fire_breath'
    | 'animal_attack'
    | 'blackhole_explosion'
    | 'nuke_blast'
    | 'arcane_cataclysm'
    | 'battlewill_slash'
    | 'projectile_tracer'
    | 'huge_asteroid_strike'
    | 'volcanic_lava_bomb'
    | 'void_goo_splash'
    | 'fire_spread'
    | 'festival_lanterns';
  x: number;
  y: number;
  z: number;
  originX?: number;
  originY?: number;
  originZ?: number;
  sourceUnitId?: string;
  variant?: 'bite' | 'slam' | 'crunch' | 'peck' | 'horn_blast' | 'fire_breath';
  vfxSubtype?:
    | 'bullet'
    | 'cannon_shell'
    | 'bomb'
    | 'missile'
    | 'icbm_missile'
    | 'arcane_bolt'
    | 'elf_starfall_spell'
    | 'orc_siege_boulder'
    | 'orc_waagh_rocket'
    | 'dwarf_quake_mortar'
    | 'lizard_solar_lance'
    | 'plasma_beam'
    | 'laser_beam'
    | 'ice_ball'
    | 'foxfire_ball'
    | 'venom_ball';
  flightDuration?: number;
  species?: SpeciesId;
  dropKind?: TerrainToolType;
  dropTargets?: Array<{ x: number; y: number; z: number }>;
  radius: number;
  color: string;
  createdAt: number;
  deferImpact?: boolean;
  faultSegments?: EarthquakeFaultSegment[];
  quakeShapeKind?: EarthquakeShapeKind;
  quakeExtent?: number;
}

export type StrategicStrikeKind =
  | 'icbm_missile'
  | 'icbm_nuke'
  | 'elf_starfall_spell'
  | 'elf_astral_cataclysm'
  | 'orc_siege_boulder'
  | 'orc_waagh_rocket'
  | 'dwarf_quake_mortar'
  | 'dwarf_seismic_hammer'
  | 'lizard_solar_lance'
  | 'lizard_solar_cataclysm';

export interface StrategicWarStrike {
  id: string;
  attackerKingdomId: string;
  targetKingdomId: string;
  species: SpeciesId;
  kind: StrategicStrikeKind;
  originX: number;
  originZ: number;
  targetX: number;
  targetZ: number;
  elapsed: number;
  flightDuration: number;
  damage: number;
  radius: number;
  isSuperweapon?: boolean;
}

export interface WarFrontBaseline {
  startYear: number;
  initialTilesA: number;
  initialTilesB: number;
  initialBuildingsA: number;
  initialBuildingsB: number;
}

export interface WarFrontArrowData {
  id: string;
  attackerKingdomId: string;
  defenderKingdomId: string;
  attackerName: string;
  defenderName: string;
  attackerSpecies: SpeciesId;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  progress: number; // 0.08..0.96
  tileDelta: number;
  claimPercent: number; // 0..100
  hexColor: string;
  momentum: 'advancing' | 'contested' | 'retreating';
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
    | 'volcano_eruption'
    | 'heat_wave_zone'
    | 'freeze_wave_zone'
    | 'blessing_wave'
    | 'curse_wave'
    | 'frenzy_wave'
    | 'terraform_wave'
    | 'whirlpool'
    | 'rogue_wave'
    | 'asteroid_shockwave'
    | 'undead_portal'
    | 'alien_mothership'
    | 'chrono_field'
    | 'orbital_beam'
    | 'gravity_anomaly'
    | 'acid_cloud'
    | 'sinkhole_collapse'
    | 'locust_swarm'
    | 'magma_geyser'
    | 'purify_wave'
    | 'biome_bloom_wave'
    | 'blizzard_gale'
    | 'sentinel_eye';
  elementAffinity?: 'none' | 'fire' | 'water' | 'ice' | 'poison' | 'sand';
  biomeWaveKind?: 'floral' | 'blight' | 'lava';
  x: number;
  z: number;
  targetX?: number;
  targetZ?: number;
  windX?: number;
  windZ?: number;
  heading?: number;
  exploded?: boolean;
  isSuper?: boolean;
  ownerKingdomId?: string;
  arrivalRemaining?: number;
  arrivalDuration?: number;
  impactPending?: boolean;
  currentSpeed?: number;
  currentRadius?: number;
  maxRadius?: number;
  waveWaterTarget?: boolean;
  waveTargetHeight?: number;
  waveEpochIdx?: number;
  portalSpawnCount?: number;
  beamDirX?: number;
  beamDirZ?: number;
  beamTargetX?: number;
  beamTargetZ?: number;
  beamFireTimer?: number;
  eyeYaw?: number;
  beaconTimer?: number;
  laserSubTimer?: number;
  radius: number;
  remaining: number;
  duration: number;
  tickTimer: number;
  sourceUnitId?: string;
  faultSegments?: EarthquakeFaultSegment[];
  quakeShapeKind?: EarthquakeShapeKind;
  quakeExtent?: number;
  solarProjectiles?: SolarProjectile[];
  solarFlareTimer?: number;
  solarFlareCount?: number;
  recentSolarImpacts?: SolarImpactEvent[];
}

export interface SolarProjectile {
  id: string;
  startX: number;
  startY: number;
  startZ: number;
  targetX: number;
  targetZ: number;
  progress: number;
  duration: number;
  peakY: number;
  impactRadius: number;
}

export interface SolarImpactEvent {
  x: number;
  z: number;
  radius: number;
}

export interface VoidWispEntity {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  size: number;
  color: string;
  phase: number;
  bobSpeed: number;
  sourceRole?: string;
}

export type RandomEventKind =
  | 'huge_asteroid'
  | 'volcano_eruption'
  | 'super_tornado'
  | 'mega_earthquake'
  | 'heatwave_drought'
  | 'deep_freeze'
  | 'starfall_aurora';

export interface WorldEventState {
  id: string;
  kind: RandomEventKind;
  title: string;
  subtitle: string;
  accentColor: string;
  targetX: number;
  targetZ: number;
  trackX: number;
  trackY: number;
  trackZ: number;
  startX?: number;
  startY?: number;
  startZ?: number;
  elapsed: number;
  impactDelay?: number;
  cinematicActive: boolean;
  dismissedByUser?: boolean;
  impactTriggered?: boolean;
  destructive: boolean;
  linkedHazardId?: string;
  remaining: number;
  duration: number;
  startedAtYear?: number;
  phase?: 'falling' | 'active';
}

export type GameLifecycleState = 'title' | 'playing' | 'paused' | 'gameover';

export type LightingPreset = 'noon' | 'dusk' | 'night' | 'midnight' | 'dawn' | 'auto';
export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';
export type SeasonPreset = 'auto' | SeasonId;

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
  /** Strict 100% lossless visual parity (default true); disable for Low-End / Performance Mode */
  strictLossless?: boolean;
  /** Toggle optional Phase 0 Performance Debug HUD (F3 hotkey or Settings) */
  showPerformanceHud?: boolean;
  /** Toggle screen/camera shake effects during impacts & god powers (default true) */
  cameraShake?: boolean;
}

export interface PerfTelemetrySnapshot {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  visibleChunks: number;
  totalChunks: number;
  activeUnits: number;
  activeBuildings: number;
  simTickMs: number;
  workerQueue: number;
  gridSize: number;
}

export type WorldTemplateId =
  | 'realistic'
  | 'fantastic'
  | 'scifi'
  | 'prehistoric'
  | 'archipelago'
  | 'scrap_sea'
  | 'single_biome'
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
  randomEvents: boolean;
  startingEpochIndex: number;
  startingSettlers: 'none' | 'pioneers' | 'colony';
}

export interface WorldGenConfig {
  worldName: string;
  template: WorldTemplateId;
  singleBiome?: TerrainType;
  gridSize: number;
  seed: number;
  seaLevel: 'low' | 'normal' | 'high';
  mountainDensity: 'low' | 'normal' | 'high';
  climate: 'cold' | 'temperate' | 'warm';
  rules: WorldRulesConfig;
}

export interface WorldStats {
  totalDeaths: number;
  civilianDeaths: number;
  totalBirths: number;
  citiesCreated: number;
  citiesDestroyed: number;
  wildlifeSpawned: number;
  wildlifeDeaths: number;
  mythicalSpawned: number;
  mythicalDeaths: number;
  hostilesSpawned: number;
  hostilesKilled: number;
  buildingsDestroyed: number;
  warsStarted: number;
  rebellionsTriggered: number;
}

export interface SimulationState {
  seed: number;
  gridSize: number;
  worldName?: string;
  worldDescription?: string;
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
  worldWonders?: WorldWonder[];
  battleMemorials?: BattleMemorial[];
  pendingVfx: VisualEffectEvent[];
  activeHazards: ActiveHazardZone[];
  totalMiraclesCast: number;
  totalStructuresBuilt: number;
  totalRaidersDefeated: number;
  worldStats?: WorldStats;
  selectedEntityId: string | null;
  selectedTile: { x: number; z: number } | null;
  outcome: 'none' | 'ascension_victory' | 'collapse_defeat';
  civPlanTimer?: number;
  harvestAccumulator?: Resources;
  harvestRates?: Resources;
  harvestWindowTimer?: number;
  settlementNames?: Record<string, string>;
  settlementSpecies?: Record<string, SpeciesId>;
  settlementDistricts?: Record<
    string,
    {
      farmX: number;
      farmZ: number;
      farmHalfSize: number;
      farmTargetHeight: number;
      quarryX: number;
      quarryZ: number;
      quarryHalfSize: number;
      quarryTargetHeight: number;
    }
  >;
  settlementKingdoms?: Record<string, string>;
  kingdomEpochs?: Record<string, number>;
  kingdomEpochProgress?: Record<string, number>;
  averageEpochIndex?: number;
  kingdomResources?: Record<string, Resources>;
  unallocatedResources?: Resources;
  kingdomUltimateCooldowns?: Record<string, number>;
  kingdomRelations?: Record<string, DiplomaticRelation>;
  kingdomPeacefulTraits?: Record<string, boolean>;
  /** Canonical pairKey -> game year until which a formal Peace Treaty / Truce blocks war */
  kingdomPeaceTreaties?: Record<string, number>;
  /** Canonical pairKey -> game year until which an active Trade Agreement boosts both kingdoms */
  kingdomTradePacts?: Record<string, number>;
  /** Canonical pairKey -> game year when the current war began (drives war exhaustion & peace talks) */
  kingdomWarStartYears?: Record<string, number>;
  warFrontBaselines?: Record<string, WarFrontBaseline>;
  activeStrategicStrikes?: StrategicWarStrike[];
  strategicWarTimer?: number;
  diplomacyTimer?: number;
  rebellionTimer?: number;
  wildlifeSeeded?: boolean;
  wildlifeRespawnTimer?: number;
  raiderWaveTimer?: number;
  oceanEventTimer?: number;
  worldEventTimer?: number;
  voidGooTimer?: number;
  voidWisps?: VoidWispEntity[];
  activeWorldEvent?: WorldEventState | null;
  /** Transient runtime flat TypedArray acceleration buffers (stripped on save, auto-rebuilt on load) */
  worldGrid?: unknown;
}
