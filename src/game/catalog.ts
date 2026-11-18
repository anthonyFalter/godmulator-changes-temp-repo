import {
  BuildingDefinition,
  EpochDefinition,
  GodPowerDefinition,
  SpeciesId,
  TerrainToolDefinition,
  UnitDefinition,
  UnitRole,
} from './types';

export const EPOCHS: EpochDefinition[] = [
  {
    id: 'prehistoric',
    index: 0,
    name: 'Stone Age',
    yearLabel: '10,000 BCE',
    description: 'Tribes gather around hearths and flint.',
    unlockCost: { food: 0, wood: 0, stone: 0, ore: 0, knowledge: 0, energy: 0, alloy: 0, faith: 0 },
    skyColor: '#1d2729',
    accentColor: '#d97736',
    populationBonus: 15,
  },
  {
    id: 'bronze',
    index: 1,
    name: 'Bronze Age',
    yearLabel: '3,000 BCE',
    description: 'Stone towns, kilns, and stepped temples.',
    unlockCost: { food: 140, wood: 130, stone: 95, ore: 25, knowledge: 65, energy: 0, alloy: 0, faith: 25 },
    skyColor: '#232f33',
    accentColor: '#e09f3e',
    populationBonus: 25,
  },
  {
    id: 'medieval',
    index: 2,
    name: 'Medieval',
    yearLabel: '1,150 CE',
    description: 'Guildhalls, stone roads, and star towers.',
    unlockCost: { food: 340, wood: 300, stone: 280, ore: 160, knowledge: 210, energy: 0, alloy: 0, faith: 65 },
    skyColor: '#242b35',
    accentColor: '#c85a32',
    populationBonus: 40,
  },
  {
    id: 'industrial',
    index: 3,
    name: 'Industrial',
    yearLabel: '1860 CE',
    description: 'Railways, steam trains, foundries, and brick cities.',
    unlockCost: { food: 720, wood: 580, stone: 640, ore: 480, knowledge: 540, energy: 80, alloy: 70, faith: 130 },
    skyColor: '#26252b',
    accentColor: '#d48c46',
    populationBonus: 60,
  },
  {
    id: 'atomic',
    index: 4,
    name: 'Atomic Age',
    yearLabel: '1965 CE',
    description: 'Automobiles, airports, reactors, and concrete towers.',
    unlockCost: { food: 1350, wood: 980, stone: 1150, ore: 1050, knowledge: 1250, energy: 480, alloy: 360, faith: 220 },
    skyColor: '#1b2632',
    accentColor: '#4ea8de',
    populationBonus: 85,
  },
  {
    id: 'information',
    index: 5,
    name: 'Info Age',
    yearLabel: '2015 CE',
    description: 'Metro rapid transit, glass skyscrapers, and jetliners.',
    unlockCost: { food: 2350, wood: 1650, stone: 1950, ore: 1850, knowledge: 2600, energy: 1350, alloy: 1050, faith: 380 },
    skyColor: '#172334',
    accentColor: '#3a86ff',
    populationBonus: 110,
  },
  {
    id: 'orbital',
    index: 6,
    name: 'Orbital Age',
    yearLabel: '2130 CE',
    description: 'Spaceports, mag-lev transit, and arcologies.',
    unlockCost: { food: 5600, wood: 3800, stone: 5100, ore: 5200, knowledge: 7800, energy: 5200, alloy: 4400, faith: 920 },
    skyColor: '#131b26',
    accentColor: '#56cfe1',
    populationBonus: 150,
  },
  {
    id: 'interstellar',
    index: 7,
    name: 'Star Age',
    yearLabel: '2480 CE',
    description: 'Star relays and cosmic ascension.',
    unlockCost: { food: 11500, wood: 7800, stone: 10800, ore: 11200, knowledge: 18500, energy: 14000, alloy: 12000, faith: 2200 },
    skyColor: '#0e131d',
    accentColor: '#f4a261',
    populationBonus: 220,
  },
];

export function getMaxCityPopulation(gridSize: number): number {
  const s = Math.max(32, Math.round(gridSize || 128));
  if (s <= 64) return 28;
  if (s <= 96) return 40;
  if (s <= 128) return 56;
  if (s <= 160) return 72;
  if (s <= 192) return 90;
  if (s <= 224) return 110;
  return 135;
}

export const BUILDINGS: BuildingDefinition[] = [
  {
    type: 'bonfire',
    name: 'Bonfire',
    epoch: 'prehistoric',
    roleSummary: '+8 Pop, +2 Food/s, +2 Faith/s',
    keyHint: '1',
    cost: { wood: 45, stone: 25 },
    maxHp: 350,
    popCapBonus: 8,
    productionPerSec: { food: 2, faith: 2, knowledge: 1 },
    footprint: 1,
  },
  {
    type: 'forager_hut',
    name: 'Forager Hut',
    epoch: 'prehistoric',
    roleSummary: '+4 Food/s, +4 Wood/s',
    keyHint: '2',
    cost: { wood: 65, stone: 30 },
    maxHp: 220,
    popCapBonus: 3,
    productionPerSec: { food: 4, wood: 4 },
    footprint: 1,
  },
  {
    type: 'shaman_totem',
    name: 'Totem',
    epoch: 'prehistoric',
    roleSummary: '+4 Faith/s, +2 Research/s',
    keyHint: '3',
    cost: { wood: 45, stone: 70 },
    maxHp: 260,
    popCapBonus: 2,
    productionPerSec: { faith: 4, knowledge: 2 },
    footprint: 1,
  },
  {
    type: 'granary',
    name: 'Granary',
    epoch: 'bronze',
    roleSummary: '+8 Food/s, +5 Pop Cap',
    keyHint: '4',
    cost: { wood: 110, stone: 95 },
    maxHp: 380,
    popCapBonus: 5,
    productionPerSec: { food: 8, wood: 2 },
    footprint: 1,
  },
  {
    type: 'smeltery',
    name: 'Smeltery',
    epoch: 'bronze',
    roleSummary: '+5 Stone/s, +4 Ore/s',
    keyHint: '5',
    cost: { wood: 95, stone: 130 },
    maxHp: 420,
    popCapBonus: 2,
    productionPerSec: { stone: 5, ore: 4, alloy: 1 },
    footprint: 1,
  },
  {
    type: 'ziggurat',
    name: 'Ziggurat',
    epoch: 'bronze',
    roleSummary: '+9 Faith/s, +5 Research/s',
    keyHint: '6',
    cost: { stone: 220, wood: 125, ore: 55 },
    maxHp: 650,
    popCapBonus: 6,
    productionPerSec: { faith: 9, knowledge: 5 },
    footprint: 2,
  },
  {
    type: 'guildhall',
    name: 'Guildhall',
    epoch: 'medieval',
    roleSummary: '+12 Pop Cap, +6 Food/s',
    keyHint: '7',
    cost: { wood: 185, stone: 210, ore: 85 },
    maxHp: 750,
    popCapBonus: 12,
    productionPerSec: { food: 6, wood: 5, stone: 5, faith: 3 },
    footprint: 1,
  },
  {
    type: 'observatory',
    name: 'Observatory',
    epoch: 'medieval',
    roleSummary: '+10 Research/s, +4 Faith/s',
    keyHint: '8',
    cost: { stone: 225, ore: 135, wood: 140 },
    maxHp: 480,
    popCapBonus: 4,
    productionPerSec: { knowledge: 10, faith: 4 },
    footprint: 1,
  },
  {
    type: 'steam_foundry',
    name: 'Foundry',
    epoch: 'industrial',
    roleSummary: '+10 Ore/s, +6 Alloy/s',
    keyHint: '9',
    cost: { stone: 310, ore: 250, wood: 165 },
    maxHp: 850,
    popCapBonus: 6,
    productionPerSec: { ore: 10, alloy: 6, energy: 4 },
    footprint: 1,
  },
  {
    type: 'dynamo_plant',
    name: 'Power Plant',
    epoch: 'industrial',
    roleSummary: '+14 Energy/s, +6 Research/s',
    keyHint: '0',
    cost: { stone: 290, ore: 290, alloy: 65 },
    maxHp: 800,
    popCapBonus: 4,
    productionPerSec: { energy: 14, knowledge: 6 },
    footprint: 1,
  },
  {
    type: 'rail_station',
    name: 'Metro Rail',
    epoch: 'industrial',
    roleSummary: 'Links cities by rail, +12 Pop Cap',
    keyHint: ';',
    cost: { stone: 290, ore: 230, alloy: 55 },
    maxHp: 900,
    popCapBonus: 12,
    productionPerSec: { ore: 6, knowledge: 8, energy: 4 },
    footprint: 1,
  },
  {
    type: 'fission_reactor',
    name: 'Reactor',
    epoch: 'atomic',
    roleSummary: '+28 Energy/s, +10 Alloy/s',
    keyHint: '-',
    cost: { stone: 440, ore: 400, alloy: 185, knowledge: 240 },
    maxHp: 1100,
    popCapBonus: 8,
    productionPerSec: { energy: 28, alloy: 10, knowledge: 8 },
    footprint: 2,
  },
  {
    type: 'cyber_institute',
    name: 'Cyber Lab',
    epoch: 'atomic',
    roleSummary: '+24 Research/s, +10 Energy/s',
    keyHint: '=',
    cost: { stone: 360, alloy: 225, energy: 185 },
    maxHp: 950,
    popCapBonus: 10,
    productionPerSec: { knowledge: 24, energy: 10, faith: 5 },
    footprint: 1,
  },
  {
    type: 'airport',
    name: 'Airport',
    epoch: 'atomic',
    roleSummary: 'Airliners & global transit, +15 Pop',
    keyHint: "'",
    cost: { stone: 410, alloy: 265, energy: 225, knowledge: 205 },
    maxHp: 1250,
    popCapBonus: 15,
    productionPerSec: { knowledge: 14, energy: 8, food: 6 },
    footprint: 2,
  },
  {
    type: 'launch_arcology',
    name: 'Launchpad',
    epoch: 'orbital',
    roleSummary: '+22 Alloy/s, +30 Research/s',
    keyHint: '[',
    cost: { alloy: 480, energy: 440, ore: 500, knowledge: 500 },
    maxHp: 1500,
    popCapBonus: 16,
    productionPerSec: { alloy: 22, knowledge: 30, energy: 20, food: 15 },
    footprint: 2,
  },
  {
    type: 'dyson_spire',
    name: 'Dyson Spire',
    epoch: 'interstellar',
    roleSummary: 'Unlocks Star Ascension',
    keyHint: ']',
    cost: { alloy: 900, energy: 1000, knowledge: 1000, faith: 500 },
    maxHp: 2500,
    popCapBonus: 30,
    productionPerSec: {
      food: 40,
      wood: 30,
      stone: 40,
      ore: 50,
      knowledge: 60,
      energy: 80,
      alloy: 50,
      faith: 45,
    },
    footprint: 2,
  },
];

export const SPECIES_UNITS: UnitDefinition[] = [
  {
    role: 'human',
    species: 'human',
    name: 'Human',
    faction: 'civilization',
    roleSummary: 'Fast tech progress, relies on tech',
    cost: { faith: 10 },
    maxHp: 135,
    speed: 2.55,
    attackDamage: 14,
    attackRange: 1.35,
    harvestRate: 9,
  },
  {
    role: 'elf',
    species: 'elf',
    name: 'Elf',
    faction: 'civilization',
    roleSummary: 'Peaceful mages & arcane tech',
    cost: { faith: 12 },
    maxHp: 145,
    speed: 3.05,
    attackDamage: 18,
    attackRange: 3.4,
    harvestRate: 9,
  },
  {
    role: 'orc',
    species: 'orc',
    name: 'Orc',
    faction: 'civilization',
    roleSummary: 'Fierce barbarians, slow progress',
    cost: { faith: 12 },
    maxHp: 225,
    speed: 2.4,
    attackDamage: 28,
    attackRange: 1.45,
    harvestRate: 10,
  },
];

export const ANIMAL_UNITS: UnitDefinition[] = [
  {
    role: 'cow',
    category: 'animal',
    name: 'Cow',
    faction: 'wildlife',
    roleSummary: 'Gentle pasture grazer of meadows',
    cost: { faith: 6 },
    maxHp: 90,
    speed: 1.45,
    attackDamage: 3,
    attackRange: 1.0,
    harvestRate: 0,
  },
  {
    role: 'pig',
    category: 'animal',
    name: 'Pig',
    faction: 'wildlife',
    roleSummary: 'Plump mud-loving woodland forager',
    cost: { faith: 5 },
    maxHp: 70,
    speed: 1.75,
    attackDamage: 3,
    attackRange: 1.0,
    harvestRate: 0,
  },
  {
    role: 'chicken',
    category: 'animal',
    name: 'Chicken',
    faction: 'wildlife',
    roleSummary: 'Fluttering barnyard meadow bird',
    cost: { faith: 4 },
    maxHp: 35,
    speed: 2.15,
    attackDamage: 1,
    attackRange: 0.9,
    harvestRate: 0,
  },
  {
    role: 'capybara',
    category: 'animal',
    name: 'Capybara',
    faction: 'wildlife',
    roleSummary: 'Chill riverbank & marshland grazer',
    cost: { faith: 6 },
    maxHp: 85,
    speed: 1.5,
    attackDamage: 2,
    attackRange: 1.0,
    harvestRate: 0,
  },
  {
    role: 'wolf',
    category: 'animal',
    name: 'Wolf',
    faction: 'wildlife',
    roleSummary: 'Swift forest & tundra pack hunter',
    cost: { faith: 10 },
    maxHp: 110,
    speed: 3.15,
    attackDamage: 15,
    attackRange: 1.35,
    harvestRate: 0,
  },
  {
    role: 'bear',
    category: 'animal',
    name: 'Bear',
    faction: 'wildlife',
    roleSummary: 'Heavy highland & forest guardian',
    cost: { faith: 14 },
    maxHp: 210,
    speed: 2.2,
    attackDamage: 24,
    attackRange: 1.5,
    harvestRate: 0,
  },
  {
    role: 'dinosaur',
    category: 'animal',
    name: 'Dinosaur',
    faction: 'wildlife',
    roleSummary: 'Prehistoric herbivores & apex carnivores',
    cost: { faith: 22 },
    maxHp: 360,
    speed: 2.45,
    attackDamage: 38,
    attackRange: 1.9,
    harvestRate: 0,
  },
];

export const MYTHICAL_BEAST_UNITS: UnitDefinition[] = [
  {
    role: 'dragon',
    category: 'mythical',
    name: 'Dragon',
    faction: 'wildlife',
    roleSummary: 'Soaring drake with cooldown fire breath',
    cost: { faith: 45 },
    maxHp: 560,
    speed: 4.1,
    attackDamage: 52,
    attackRange: 4.2,
    harvestRate: 0,
  },
  {
    role: 'unicorn',
    category: 'mythical',
    name: 'Unicorn',
    faction: 'wildlife',
    roleSummary: 'Radiant steed that heals & blooms land',
    cost: { faith: 35 },
    maxHp: 260,
    speed: 3.3,
    attackDamage: 18,
    attackRange: 1.5,
    harvestRate: 0,
  },
  {
    role: 'leviathan',
    category: 'mythical',
    name: 'Leviathan',
    faction: 'wildlife',
    roleSummary: 'Colossal mythical Leviathan: lurks as a deep silhouette & breaches to devour prey',
    cost: { faith: 45 },
    maxHp: 680,
    speed: 3.4,
    attackDamage: 58,
    attackRange: 4.8,
    harvestRate: 0,
  },
];

export const UNITS: UnitDefinition[] = [
  ...SPECIES_UNITS,
  ...ANIMAL_UNITS,
  ...MYTHICAL_BEAST_UNITS,
  {
    role: 'villager',
    species: 'human',
    name: 'Villager',
    faction: 'civilization',
    roleSummary: 'Builds towns and gathers resources',
    cost: { faith: 10 },
    maxHp: 130,
    speed: 2.4,
    attackDamage: 12,
    attackRange: 1.2,
    harvestRate: 8,
  },
  {
    role: 'forager',
    species: 'human',
    name: 'Forager',
    faction: 'civilization',
    roleSummary: 'Gathers food and wood fast',
    cost: { food: 25, wood: 10 },
    maxHp: 100,
    speed: 2.7,
    attackDamage: 9,
    attackRange: 1.2,
    harvestRate: 10,
  },
  {
    role: 'miner',
    species: 'human',
    name: 'Miner',
    faction: 'civilization',
    roleSummary: 'Extracts stone, ore, and crystal',
    cost: { food: 25, stone: 15 },
    maxHp: 120,
    speed: 2.1,
    attackDamage: 12,
    attackRange: 1.2,
    harvestRate: 11,
  },
  {
    role: 'builder',
    species: 'human',
    name: 'Builder',
    faction: 'civilization',
    roleSummary: 'Constructs and repairs buildings',
    cost: { food: 30, wood: 20 },
    maxHp: 110,
    speed: 2.4,
    attackDamage: 10,
    attackRange: 1.3,
    harvestRate: 7,
  },
  {
    role: 'warrior',
    species: 'human',
    name: 'Guard',
    faction: 'civilization',
    roleSummary: 'Defends towns from raiders',
    cost: { food: 35, ore: 20 },
    maxHp: 190,
    speed: 2.6,
    attackDamage: 24,
    attackRange: 1.5,
    harvestRate: 2,
  },
  {
    role: 'priest',
    species: 'human',
    name: 'Priest',
    faction: 'civilization',
    roleSummary: 'Heals citizens and generates Faith',
    cost: { food: 30, faith: 20 },
    maxHp: 105,
    speed: 2.3,
    attackDamage: 14,
    attackRange: 3.2,
    harvestRate: 6,
  },
  {
    role: 'scholar',
    species: 'human',
    name: 'Scholar',
    faction: 'civilization',
    roleSummary: 'Researches Knowledge for new ages',
    cost: { food: 35, knowledge: 15 },
    maxHp: 95,
    speed: 2.4,
    attackDamage: 10,
    attackRange: 2.5,
    harvestRate: 9,
  },
  {
    role: 'astro_engineer',
    species: 'human',
    name: 'Engineer',
    faction: 'civilization',
    roleSummary: 'Gathers Energy, Alloy, and Crystal',
    cost: { food: 40, alloy: 25, energy: 20 },
    maxHp: 160,
    speed: 3.1,
    attackDamage: 28,
    attackRange: 3.5,
    harvestRate: 16,
  },
  {
    role: 'raider_swarmer',
    species: 'orc',
    name: 'Raider',
    faction: 'hostile',
    roleSummary: 'Fast melee attacker',
    cost: {},
    maxHp: 95,
    speed: 2.9,
    attackDamage: 14,
    attackRange: 1.3,
    harvestRate: 0,
  },
  {
    role: 'raider_ranged',
    species: 'orc',
    name: 'Archer Raider',
    faction: 'hostile',
    roleSummary: 'Ranged hostile bowman',
    cost: {},
    maxHp: 75,
    speed: 2.5,
    attackDamage: 16,
    attackRange: 4.2,
    harvestRate: 0,
  },
  {
    role: 'raider_behemoth',
    species: 'orc',
    name: 'Brute',
    faction: 'hostile',
    roleSummary: 'Heavy siege raider',
    cost: {},
    maxHp: 280,
    speed: 1.7,
    attackDamage: 36,
    attackRange: 1.7,
    harvestRate: 0,
  },
];

export const GOD_POWERS: GodPowerDefinition[] = [
  {
    type: 'drag_entity',
    name: 'Grab',
    category: 'Benevolent',
    summary: 'Hold & drag any entity in 3D air and fling them',
    faithCost: 0,
    radius: 1.6,
    keyHint: '',
    color: '#38bdf8',
  },
  {
    type: 'blessing',
    name: 'Bless',
    category: 'Benevolent',
    summary: 'Heals units, repairs & blooms land',
    faithCost: 15,
    radius: 5.5,
    keyHint: 'Q',
    color: '#f5b742',
  },
  {
    type: 'rain_of_plenty',
    name: 'Rain',
    category: 'Benevolent',
    summary: 'Storm cloud douses fires & greens land',
    faithCost: 20,
    radius: 6.0,
    keyHint: 'E',
    color: '#4ea8de',
  },
  {
    type: 'eureka',
    name: 'Insight',
    category: 'Benevolent',
    summary: '+140 Research, roads & instant build',
    faithCost: 25,
    radius: 5.5,
    keyHint: 'R',
    color: '#56cfe1',
  },
  {
    type: 'golden_age',
    name: 'Golden Age',
    category: 'Benevolent',
    summary: '2x output, roads, full heal & growth',
    faithCost: 40,
    radius: 7.5,
    keyHint: 'T',
    color: '#ffd166',
  },
  {
    type: 'divine_shield',
    name: 'Shield',
    category: 'Benevolent',
    summary: 'Giant energy dome & repels foes',
    faithCost: 25,
    radius: 5.5,
    keyHint: 'Y',
    color: '#72efdd',
  },
  {
    type: 'heat_wave',
    name: 'Heat Wave',
    category: 'Wrathful',
    summary: 'Scorches temperature, dries land & ignites wildfires',
    faithCost: 15,
    radius: 5.5,
    keyHint: '',
    color: '#ff7b00',
  },
  {
    type: 'freeze_snap',
    name: 'Freeze',
    category: 'Benevolent',
    summary: 'Drops temp, douses fires, snows land & freezes units',
    faithCost: 15,
    radius: 5.5,
    keyHint: '',
    color: '#7dd3fc',
  },
  {
    type: 'bloodlust_frenzy',
    name: 'Fury',
    category: 'Wrathful',
    summary: 'Blood-storm enrages units (+150% dmg)',
    faithCost: 20,
    radius: 5.5,
    keyHint: 'U',
    color: '#e63946',
  },
  {
    type: 'curse',
    name: 'Curse',
    category: 'Wrathful',
    summary: 'Blights land to swamp & weakens',
    faithCost: 15,
    radius: 5.5,
    keyHint: 'I',
    color: '#9d4edd',
  },
  {
    type: 'plague_miasma',
    name: 'Plague',
    category: 'Wrathful',
    summary: 'Toxic mire & lingering spore cloud',
    faithCost: 25,
    radius: 5.5,
    keyHint: 'O',
    color: '#80ed99',
  },
  {
    type: 'lightning_smite',
    name: 'Lightning',
    category: 'Wrathful',
    summary: 'Devastating bolts destroy buildings & electrify foes',
    faithCost: 20,
    radius: 4.8,
    keyHint: 'F',
    color: '#90e0ef',
  },
  {
    type: 'tornado',
    name: 'Tornado',
    category: 'Wrathful',
    summary: 'Roaming cyclone vortex lifts, spins & flings entities',
    faithCost: 35,
    radius: 5.2,
    keyHint: '',
    color: '#94a3b8',
  },
  {
    type: 'tsunami',
    name: 'Tsunami',
    category: 'Wrathful',
    summary: 'Colossal surging wave drowns NPCs & smashes coasts',
    faithCost: 40,
    radius: 6.5,
    keyHint: '',
    color: '#00b4d8',
  },
  {
    type: 'meteor_strike',
    name: 'Meteor',
    category: 'Wrathful',
    summary: 'One-shots buildings, carves deep craters & sparks tsunamis',
    faithCost: 45,
    radius: 6.2,
    keyHint: 'G',
    color: '#ff5400',
  },
  {
    type: 'earthquake',
    name: 'Quake',
    category: 'Wrathful',
    summary: 'Tectonic rift fractures earth & shakes screen',
    faithCost: 30,
    radius: 7.0,
    keyHint: 'V',
    color: '#e07a2b',
  },
  {
    type: 'terraform_beam',
    name: 'Terraform',
    category: 'Cosmic',
    summary: 'Orbital beam sculpts terraced plateau',
    faithCost: 35,
    radius: 6.0,
    keyHint: 'Z',
    color: '#06d6a0',
  },
  {
    type: 'wormhole_ascension',
    name: 'Black Hole',
    category: 'Cosmic',
    summary: 'Orbits terrain & entities before supernova fling',
    faithCost: 50,
    radius: 6.0,
    keyHint: 'X',
    color: '#c77dff',
  },
];

export const TERRAIN_TOOLS: TerrainToolDefinition[] = [
  {
    type: 'raise',
    name: 'Raise',
    summary: 'Lift ground higher',
    faithCost: 2,
    color: '#c4a484',
  },
  {
    type: 'lower',
    name: 'Lower',
    summary: 'Dig basin lower',
    faithCost: 2,
    color: '#6b8e9b',
  },
  {
    type: 'flatten',
    name: 'Flatten',
    summary: 'Level ground height',
    faithCost: 3,
    color: '#d4b89c',
  },
  {
    type: 'stone_road',
    name: 'Road',
    summary: 'Pave stone path (+50% speed)',
    faithCost: 2,
    color: '#a69282',
  },
  {
    type: 'rail_track',
    name: 'Rail',
    summary: 'Lay railway & metro track',
    faithCost: 3,
    color: '#8d99ae',
  },
  {
    type: 'fertile_meadow',
    name: 'Meadow',
    summary: 'Grow fertile berries',
    faithCost: 4,
    color: '#6a994e',
  },
  {
    type: 'plant_forest',
    name: 'Woods',
    summary: 'Plant forest trees',
    faithCost: 4,
    color: '#386641',
  },
  {
    type: 'seed_ore',
    name: 'Ore Vein',
    summary: 'Add stone & ore nodes',
    faithCost: 6,
    color: '#e09f3e',
  },
  {
    type: 'carve_river',
    name: 'Water',
    summary: 'Carve river or lake',
    faithCost: 3,
    color: '#3a86ff',
  },
];

export interface DragonVariantPalette {
  name: string;
  body: number;
  belly: number;
  wing: number;
  glow: number;
  glowHex: string;
}

export const DRAGON_VARIANTS: DragonVariantPalette[] = [
  { name: 'Crimson Ember', body: 0xb91c1c, belly: 0xf59e0b, wing: 0x7f1d1d, glow: 0xff5420, glowHex: '#ff5420' },
  { name: 'Jade Wyrm', body: 0x15803d, belly: 0xd9f99d, wing: 0x14532d, glow: 0x22c55e, glowHex: '#22c55e' },
  { name: 'Solar Aureate', body: 0xd97706, belly: 0xfef3c7, wing: 0x92400e, glow: 0xfacc15, glowHex: '#facc15' },
  { name: 'Void Astral', body: 0x312e81, belly: 0x7dd3fc, wing: 0x1e1b4b, glow: 0x38bdf8, glowHex: '#38bdf8' },
];

export function getDragonVariant(appearanceSeed?: number): DragonVariantPalette {
  const seed = Math.abs(Math.floor(appearanceSeed ?? 1) || 1);
  const s0 = Math.abs(Math.imul(seed ^ 0x9e3779b9, 2654435761)) >>> 0;
  return DRAGON_VARIANTS[s0 % DRAGON_VARIANTS.length];
}

export interface DinosaurVariantInfo {
  morph: 0 | 1 | 2;
  speciesName: 'Tyrannosaur' | 'Triceratops' | 'Stegosaurus';
  diet: 'carnivore' | 'herbivore';
}

export function getDinosaurVariant(appearanceSeed?: number): DinosaurVariantInfo {
  const seed = Math.abs(Math.floor(appearanceSeed ?? 1) || 1);
  const s0 = Math.abs(Math.imul(seed ^ 0x9e3779b9, 2654435761)) >>> 0;
  const morph = (s0 % 3) as 0 | 1 | 2;
  if (morph === 0) {
    return { morph: 0, speciesName: 'Tyrannosaur', diet: 'carnivore' };
  }
  if (morph === 1) {
    return { morph: 1, speciesName: 'Triceratops', diet: 'herbivore' };
  }
  return { morph: 2, speciesName: 'Stegosaurus', diet: 'herbivore' };
}

export function getUnitMaxLifespan(unit: {
  role: UnitRole;
  species: SpeciesId;
  appearanceSeed?: number;
  genes?: string[];
  maxLifespan?: number;
}): number {
  if (typeof unit.maxLifespan === 'number' && Number.isFinite(unit.maxLifespan) && unit.maxLifespan > 0) {
    return Math.round(unit.maxLifespan);
  }
  const seed = Math.abs(Math.floor(unit.appearanceSeed ?? 1));
  let base: number;
  switch (unit.role) {
    case 'dragon':
    case 'leviathan':
      base = 500 + (seed % 65);
      break;
    case 'unicorn':
      base = 350 + (seed % 70);
      break;
    case 'dinosaur':
      base = 65 + (seed % 26);
      break;
    case 'bear':
      base = 28 + (seed % 8);
      break;
    case 'cow':
      base = 18 + (seed % 7);
      break;
    case 'wolf':
      base = 16 + (seed % 7);
      break;
    case 'pig':
      base = 15 + (seed % 6);
      break;
    case 'capybara':
      base = 12 + (seed % 5);
      break;
    case 'chicken':
      base = 8 + (seed % 5);
      break;
    case 'raider_swarmer':
    case 'raider_ranged':
    case 'raider_behemoth':
      base = 50 + (seed % 16);
      break;
    default:
      if (unit.species === 'elf') {
        base = 215 + (seed % 50);
      } else if (unit.species === 'orc') {
        base = 68 + (seed % 16);
      } else {
        base = 88 + (seed % 20);
      }
      break;
  }

  let geneBonus = 0;
  if (unit.genes) {
    for (const g of unit.genes) {
      if (g === 'Hardy Constitution') {
        geneBonus += unit.role === 'chicken' ? 3 : unit.role === 'capybara' ? 4 : 12;
      } else if (g === 'Ancient Wyrmblood') geneBonus += 60;
      else if (g === 'Alpha Stature') geneBonus += 5;
      else if (g === 'Starleaf Resonance') geneBonus += 18;
    }
  }

  return base + geneBonus;
}


