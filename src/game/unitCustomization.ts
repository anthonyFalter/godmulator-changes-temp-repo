import { UNITS, getUnitMaxLifespan } from './catalog';
import type {
  SpeciesId,
  UnitDefinition,
  UnitEntity,
  UnitRole,
  UnitStatBonuses,
  UnitStatKey,
} from './types';

const UNIT_BY_ROLE = new Map<UnitRole, UnitDefinition>(UNITS.map((u) => [u.role, u]));

export type InspectorIconKey =
  | 'heart'
  | 'sword'
  | 'shield'
  | 'boot'
  | 'crit'
  | 'range'
  | 'regen'
  | 'pickaxe'
  | 'skull'
  | 'dna'
  | 'lungs'
  | 'eye'
  | 'fang'
  | 'claw'
  | 'scale'
  | 'horn'
  | 'feather'
  | 'flame'
  | 'frost'
  | 'venom'
  | 'spike'
  | 'blood'
  | 'clover'
  | 'crown'
  | 'hourglass'
  | 'infinity'
  | 'muscle'
  | 'giant'
  | 'tiny'
  | 'snail'
  | 'crack'
  | 'axe'
  | 'spear'
  | 'bow'
  | 'rifle'
  | 'laser'
  | 'hammer'
  | 'sickle'
  | 'tunic'
  | 'armor'
  | 'cloak'
  | 'ring'
  | 'compass'
  | 'pouch'
  | 'lamp'
  | 'scroll'
  | 'wrench'
  | 'stone'
  | 'leaf'
  | 'star';

export interface UnitModifierSet {
  maxHp?: number;
  attackDamage?: number;
  armor?: number; // percentage damage reduction (clamped 0..75)
  speed?: number; // tiles/sec delta
  critChance?: number; // percentage 0..85
  attackRange?: number; // tiles delta
  attackSpeedPct?: number; // positive = faster swings (e.g. +20 => 1.2x)
  regenPerSec?: number; // HP/sec passive healing
  harvestPct?: number; // positive = faster gathering
  lifespanBonus?: number; // extra years
  immortal?: boolean;
  fireproof?: boolean;
  thorns?: boolean;
  venomous?: boolean;
  vampiric?: boolean;
}

export type TraitCategory = 'combat' | 'body' | 'mind' | 'special';

export interface TraitDefinition {
  id: string;
  name: string;
  category: TraitCategory;
  icon: InspectorIconKey;
  description: string;
  mods: UnitModifierSet;
  negative?: boolean;
  opposites?: string[];
}

export interface GeneDefinition {
  name: string;
  kind: 'intrinsic' | 'mutation';
  icon: InspectorIconKey;
  description: string;
  mods: UnitModifierSet;
}

export type ItemSlot = 'weapon' | 'armor' | 'tool' | 'trinket' | 'natural';

export interface ItemDefinition {
  name: string;
  slot: ItemSlot;
  icon: InspectorIconKey;
  description: string;
  mods: UnitModifierSet;
}

export interface EffectiveUnitStats {
  maxHp: number;
  attackDamage: number;
  armor: number;
  speed: number;
  critChance: number;
  attackRange: number;
  attackSpeedMult: number;
  regenPerSec: number;
  harvestMult: number;
  lifespanBonus: number;
  immortal: boolean;
  fireproof: boolean;
  thorns: boolean;
  venomous: boolean;
  vampiric: boolean;
}

// ============================================================================
// TRAITS CATALOG (Grounded, plain language)
// ============================================================================
export const UNIT_TRAITS: TraitDefinition[] = [
  {
    id: 'tough',
    name: 'Tough',
    category: 'body',
    icon: 'heart',
    description: 'Hard to knock down. Can take extra hits before going down.',
    mods: { maxHp: 40, armor: 5 },
    opposites: ['fragile'],
  },
  {
    id: 'strong',
    name: 'Strong',
    category: 'combat',
    icon: 'muscle',
    description: 'Swings hard in a fight and puts weight behind every hit.',
    mods: { attackDamage: 7, maxHp: 15 },
    opposites: ['weak'],
  },
  {
    id: 'fast',
    name: 'Fast',
    category: 'body',
    icon: 'boot',
    description: 'Light on their feet. Covers ground quicker than most.',
    mods: { speed: 0.7, attackSpeedPct: 10 },
    opposites: ['slow'],
  },
  {
    id: 'thick_skinned',
    name: 'Thick Skinned',
    category: 'body',
    icon: 'shield',
    description: 'Shrugs off scrapes and glancing blows.',
    mods: { armor: 14, maxHp: 20 },
  },
  {
    id: 'sharp_eyed',
    name: 'Sharp Eyed',
    category: 'combat',
    icon: 'eye',
    description: 'Spots openings easily and lands cleaner hits from farther away.',
    mods: { critChance: 14, attackRange: 0.6 },
  },
  {
    id: 'fast_healer',
    name: 'Fast Healer',
    category: 'body',
    icon: 'regen',
    description: 'Cuts and bruises close up on their own over time.',
    mods: { regenPerSec: 3.5, maxHp: 15 },
  },
  {
    id: 'hard_worker',
    name: 'Hard Worker',
    category: 'mind',
    icon: 'pickaxe',
    description: 'Chops, mines, and hauls faster without slowing down.',
    mods: { harvestPct: 35, speed: 0.2 },
    opposites: ['lazy'],
  },
  {
    id: 'iron_will',
    name: 'Iron Will',
    category: 'mind',
    icon: 'crown',
    description: 'Keeps steady in a brawl with extra grit and staying power.',
    mods: { maxHp: 25, armor: 8, attackDamage: 3 },
  },
  {
    id: 'berserker',
    name: 'Berserker',
    category: 'combat',
    icon: 'axe',
    description: 'Throws everything into attacks and ignores personal safety.',
    mods: { attackDamage: 12, attackSpeedPct: 22, armor: -8 },
  },
  {
    id: 'lucky',
    name: 'Lucky',
    category: 'mind',
    icon: 'clover',
    description: 'Finds openings in fights more often than they probably should.',
    mods: { critChance: 18, armor: 4 },
  },
  {
    id: 'giant',
    name: 'Giant',
    category: 'body',
    icon: 'giant',
    description: 'Big build with plenty of health and heavy hits, though slower.',
    mods: { maxHp: 90, attackDamage: 10, armor: 8, speed: -0.35 },
    opposites: ['tiny'],
  },
  {
    id: 'tiny',
    name: 'Tiny',
    category: 'body',
    icon: 'tiny',
    description: 'Small and nimble, quick to move but light on health.',
    mods: { maxHp: -25, speed: 0.65, critChance: 8 },
    opposites: ['giant'],
  },
  {
    id: 'long_lived',
    name: 'Long Lived',
    category: 'body',
    icon: 'hourglass',
    description: 'Stays healthy well past normal old age.',
    mods: { lifespanBonus: 55, regenPerSec: 0.8 },
    opposites: ['short_lived'],
  },
  {
    id: 'immortal',
    name: 'Immortal',
    category: 'special',
    icon: 'infinity',
    description: 'Never dies of old age. Can still be killed in battle.',
    mods: { immortal: true, regenPerSec: 1.2 },
    opposites: ['short_lived'],
  },
  {
    id: 'fireproof',
    name: 'Fireproof',
    category: 'special',
    icon: 'flame',
    description: 'Walks over lava and burning ground without getting burned.',
    mods: { fireproof: true, armor: 6 },
  },
  {
    id: 'venomous',
    name: 'Venomous',
    category: 'special',
    icon: 'venom',
    description: 'Attacks leave poison that keeps wearing targets down.',
    mods: { venomous: true, attackDamage: 4 },
  },
  {
    id: 'spiky',
    name: 'Spiky',
    category: 'special',
    icon: 'spike',
    description: 'Hurts close-range attackers right back when struck.',
    mods: { thorns: true, armor: 8 },
  },
  {
    id: 'blood_drinker',
    name: 'Blood Drinker',
    category: 'special',
    icon: 'blood',
    description: 'Recovers a share of health each time a hit lands.',
    mods: { vampiric: true, attackDamage: 4 },
  },
  {
    id: 'weak',
    name: 'Weak',
    category: 'combat',
    icon: 'crack',
    description: 'Struggles to put real force behind swings.',
    mods: { attackDamage: -4, maxHp: -10 },
    negative: true,
    opposites: ['strong'],
  },
  {
    id: 'fragile',
    name: 'Fragile',
    category: 'body',
    icon: 'crack',
    description: 'Takes rough damage from hits others brush off.',
    mods: { maxHp: -30, armor: -6 },
    negative: true,
    opposites: ['tough'],
  },
  {
    id: 'slow',
    name: 'Slow',
    category: 'body',
    icon: 'snail',
    description: 'Takes their time getting anywhere.',
    mods: { speed: -0.55 },
    negative: true,
    opposites: ['fast'],
  },
  {
    id: 'lazy',
    name: 'Lazy',
    category: 'mind',
    icon: 'snail',
    description: 'Drags their feet when gathering or hauling supplies.',
    mods: { harvestPct: -25, speed: -0.15 },
    negative: true,
    opposites: ['hard_worker'],
  },
  {
    id: 'short_lived',
    name: 'Short Lived',
    category: 'body',
    icon: 'skull',
    description: 'Burns through their years faster than others.',
    mods: { lifespanBonus: -22 },
    negative: true,
    opposites: ['long_lived', 'immortal'],
  },
];

export const TRAIT_BY_ID = new Map<string, TraitDefinition>(
  UNIT_TRAITS.map((t) => [t.id, t]),
);

// ============================================================================
// GENES CATALOG (Covers all rare mutations + intrinsic species genes)
// ============================================================================
export const UNIT_GENES: GeneDefinition[] = [
  // Rare mutations (matching RARE_GENE_POOLS in entityInspector.ts)
  {
    name: 'Deep Lungs',
    kind: 'mutation',
    icon: 'lungs',
    description: 'Holds breath longer and keeps moving without tiring fast.',
    mods: { maxHp: 18, speed: 0.25, regenPerSec: 0.6 },
  },
  {
    name: 'Eagle Eye',
    kind: 'mutation',
    icon: 'eye',
    description: 'Clear distance sight. Better aim and longer reach.',
    mods: { attackRange: 0.7, critChance: 10 },
  },
  {
    name: 'Fast Runner',
    kind: 'mutation',
    icon: 'boot',
    description: 'Long stride built for sprinting across open ground.',
    mods: { speed: 0.6 },
  },
  {
    name: 'Tough',
    kind: 'mutation',
    icon: 'shield',
    description: 'Dense bone and muscle that absorb heavier hits.',
    mods: { maxHp: 30, armor: 8 },
  },
  {
    name: 'Quick Hands',
    kind: 'mutation',
    icon: 'pickaxe',
    description: 'Nimble fingers for faster gathering and quicker swings.',
    mods: { harvestPct: 25, attackSpeedPct: 12 },
  },
  {
    name: 'Sharp Memory',
    kind: 'mutation',
    icon: 'scroll',
    description: 'Learns tasks fast and rarely wastes effort.',
    mods: { harvestPct: 20, critChance: 6 },
  },
  {
    name: 'Brave Heart',
    kind: 'mutation',
    icon: 'heart',
    description: 'Holds the line in rough fights and hits with resolve.',
    mods: { maxHp: 22, attackDamage: 4 },
  },
  {
    name: 'Old Bloodline',
    kind: 'mutation',
    icon: 'hourglass',
    description: 'Comes from long-lived stock with steady vitality.',
    mods: { lifespanBonus: 35, maxHp: 15, regenPerSec: 0.5 },
  },
  {
    name: 'Forest Sight',
    kind: 'mutation',
    icon: 'eye',
    description: 'Tracks movement cleanly through thick trees and brush.',
    mods: { attackRange: 0.8, critChance: 8 },
  },
  {
    name: 'Light Step',
    kind: 'mutation',
    icon: 'feather',
    description: 'Barely leaves prints and glides over rough ground.',
    mods: { speed: 0.5, armor: 4 },
  },
  {
    name: 'Forest Bond',
    kind: 'mutation',
    icon: 'leaf',
    description: 'Mends faster and gathers cleanly in the wild.',
    mods: { regenPerSec: 1.5, harvestPct: 20 },
  },
  {
    name: 'Night Grace',
    kind: 'mutation',
    icon: 'star',
    description: 'Quick reflexes and sharper strikes after dusk.',
    mods: { critChance: 12, attackSpeedPct: 10 },
  },
  {
    name: 'Fierce Heart',
    kind: 'mutation',
    icon: 'flame',
    description: 'Runs hot in battle and hits noticeably harder.',
    mods: { attackDamage: 8, attackSpeedPct: 8 },
  },
  {
    name: 'Thick Skull',
    kind: 'mutation',
    icon: 'skull',
    description: 'Takes head-on blows that would drop someone else.',
    mods: { maxHp: 35, armor: 10 },
  },
  {
    name: 'Strong Grip',
    kind: 'mutation',
    icon: 'muscle',
    description: 'Handles heavy axes and tools without losing momentum.',
    mods: { attackDamage: 6, harvestPct: 18 },
  },
  {
    name: 'Tough Hide',
    kind: 'mutation',
    icon: 'armor',
    description: 'Calloused skin that dulls blades and claws.',
    mods: { armor: 12, maxHp: 20 },
  },
  {
    name: 'White Coat',
    kind: 'mutation',
    icon: 'frost',
    description: 'Pale winter coat that shrugs off bitter cold.',
    mods: { armor: 6, speed: 0.25 },
  },
  {
    name: 'Alert',
    kind: 'mutation',
    icon: 'eye',
    description: 'Quick to react when danger closes in.',
    mods: { speed: 0.4, critChance: 6 },
  },
  {
    name: 'Thick Fur',
    kind: 'mutation',
    icon: 'tunic',
    description: 'Heavy coat cushions bites and rough weather.',
    mods: { maxHp: 22, armor: 9 },
  },
  {
    name: 'Large Frame',
    kind: 'mutation',
    icon: 'giant',
    description: 'Bigger than normal for its kind.',
    mods: { maxHp: 45, attackDamage: 5 },
  },
  {
    name: 'Strong Bones',
    kind: 'mutation',
    icon: 'shield',
    description: 'Handles falls and heavy collisions with less harm.',
    mods: { maxHp: 25, armor: 7 },
  },
  {
    name: 'Strong Jaw',
    kind: 'mutation',
    icon: 'fang',
    description: 'Crushing bite that punches past light defense.',
    mods: { attackDamage: 7, critChance: 6 },
  },
  {
    name: 'Sharp Teeth',
    kind: 'mutation',
    icon: 'fang',
    description: 'Clean, deep bites that tear right through.',
    mods: { attackDamage: 5, critChance: 10 },
  },
  {
    name: 'Keen Scent',
    kind: 'mutation',
    icon: 'compass',
    description: 'Picks up tracks from far off and chases well.',
    mods: { speed: 0.35, attackRange: 0.3 },
  },
  {
    name: 'Night Vision',
    kind: 'mutation',
    icon: 'eye',
    description: 'Sees clearly in dim light and rarely misses.',
    mods: { critChance: 10, attackSpeedPct: 8 },
  },
  {
    name: 'Tireless Hunter',
    kind: 'mutation',
    icon: 'boot',
    description: 'Can run down prey over long distances.',
    mods: { speed: 0.45, regenPerSec: 1.0 },
  },
  {
    name: 'Thick Pelt',
    kind: 'mutation',
    icon: 'armor',
    description: 'Coarse pelt softens bites and scrapes.',
    mods: { armor: 10, maxHp: 20 },
  },
  {
    name: 'Fire Breath',
    kind: 'mutation',
    icon: 'flame',
    description: 'Hotter inner bellows for stronger fire attacks.',
    mods: { attackDamage: 12, fireproof: true },
  },
  {
    name: 'Dragon Blood',
    kind: 'mutation',
    icon: 'blood',
    description: 'Rich, hot blood that heals wounds and resists flames.',
    mods: { maxHp: 60, regenPerSec: 2.5, fireproof: true },
  },
  {
    name: 'Hot Core',
    kind: 'mutation',
    icon: 'flame',
    description: 'Radiates heat and ignores lava burns.',
    mods: { fireproof: true, attackDamage: 6, armor: 6 },
  },
  {
    name: 'Strong Wings',
    kind: 'mutation',
    icon: 'feather',
    description: 'Broad wings built for fast glides and sudden dives.',
    mods: { speed: 0.75, attackRange: 0.5 },
  },
  {
    name: 'Sharp Eyes',
    kind: 'mutation',
    icon: 'eye',
    description: 'Locks onto targets cleanly from high up.',
    mods: { critChance: 12, attackRange: 0.5 },
  },
  {
    name: 'Glowing Mane',
    kind: 'mutation',
    icon: 'star',
    description: 'Bright mane that steadily restores stamina.',
    mods: { regenPerSec: 2.0, armor: 5 },
  },
  {
    name: 'Healing Aura',
    kind: 'mutation',
    icon: 'regen',
    description: 'Steadily knits wounds back together.',
    mods: { regenPerSec: 3.0, maxHp: 25 },
  },
  {
    name: 'Flower Bond',
    kind: 'mutation',
    icon: 'leaf',
    description: 'Thrives around meadows and recovers quickly.',
    mods: { regenPerSec: 1.8, speed: 0.3 },
  },
  {
    name: 'Battle Tested',
    kind: 'mutation',
    icon: 'sword',
    description: 'Veteran instincts from surviving past scraps.',
    mods: { attackDamage: 6, armor: 8 },
  },
  {
    name: 'Fearless',
    kind: 'mutation',
    icon: 'crown',
    description: 'Steps into melee without flinching.',
    mods: { attackDamage: 5, attackSpeedPct: 12 },
  },
  {
    name: 'Veteran',
    kind: 'mutation',
    icon: 'shield',
    description: 'Knows how to block and counter cleanly.',
    mods: { maxHp: 30, armor: 10, critChance: 6 },
  },
  {
    name: 'Heavy Hitter',
    kind: 'mutation',
    icon: 'hammer',
    description: 'Slower windup, much heavier impact.',
    mods: { attackDamage: 10, critChance: 8 },
  },
  {
    name: 'Iron Stomach',
    kind: 'mutation',
    icon: 'heart',
    description: 'Shrugs off bad food and keeps going.',
    mods: { maxHp: 28, regenPerSec: 1.2 },
  },

  // Intrinsic species & creature genes
  {
    name: 'Adaptable',
    kind: 'intrinsic',
    icon: 'dna',
    description: 'Humans adjust quickly to tools, weather, and work.',
    mods: { harvestPct: 10, maxHp: 10 },
  },
  {
    name: 'Long Lived',
    kind: 'intrinsic',
    icon: 'hourglass',
    description: 'Elves age slowly and keep sharp eyes for decades.',
    mods: { attackRange: 0.4, speed: 0.2, lifespanBonus: 30 },
  },
  {
    name: 'Battle Ready',
    kind: 'intrinsic',
    icon: 'axe',
    description: 'Orcs are built wide and sturdy for close combat.',
    mods: { attackDamage: 4, maxHp: 20, armor: 4 },
  },
  {
    name: 'Apex Predator',
    kind: 'intrinsic',
    icon: 'fang',
    description: 'Heavy jaws and predator speed at the top of the food chain.',
    mods: { attackDamage: 10, critChance: 10 },
  },
  {
    name: 'Horned Crest',
    kind: 'intrinsic',
    icon: 'horn',
    description: 'Broad bony frill and horns that blunt frontal attacks.',
    mods: { armor: 14, maxHp: 30 },
  },
  {
    name: 'Back Plates',
    kind: 'intrinsic',
    icon: 'scale',
    description: 'Row of hard plates down the spine for natural armor.',
    mods: { armor: 16, thorns: true },
  },
  {
    name: 'Magic Horn',
    kind: 'intrinsic',
    icon: 'horn',
    description: 'Bright spiral horn that mends cuts and wards off sickness.',
    mods: { regenPerSec: 2.5, speed: 0.3 },
  },
  {
    name: 'Deep Sea Giant',
    kind: 'intrinsic',
    icon: 'scale',
    description: 'Massive ocean hide built to crush hulls and shrug off arrows.',
    mods: { maxHp: 80, armor: 18 },
  },
  {
    name: 'Solar Rebirth',
    kind: 'intrinsic',
    icon: 'flame',
    description: 'Burns hot and ignores fire hazards completely.',
    mods: { fireproof: true, regenPerSec: 2.0 },
  },
  {
    name: 'Runestone Core',
    kind: 'intrinsic',
    icon: 'stone',
    description: 'Solid carved rock that resists blades and lava.',
    mods: { armor: 22, fireproof: true },
  },
  {
    name: 'Hard Shell',
    kind: 'intrinsic',
    icon: 'shield',
    description: 'Thick dome shell that blocks most light hits.',
    mods: { armor: 24 },
  },
  {
    name: 'Armored Scales',
    kind: 'intrinsic',
    icon: 'scale',
    description: 'Overlapping scales tough enough to turn aside spears.',
    mods: { armor: 14, attackDamage: 4 },
  },
  {
    name: 'Venom Gland',
    kind: 'intrinsic',
    icon: 'venom',
    description: 'Produces biting venom naturally.',
    mods: { venomous: true, attackDamage: 4 },
  },
  {
    name: 'Pack Hunter',
    kind: 'intrinsic',
    icon: 'claw',
    description: 'Quick runner with sharp teeth suited for chases.',
    mods: { speed: 0.35, attackDamage: 3 },
  },
  // Dwarf intrinsic & rare genes
  {
    name: 'Stoneblood',
    kind: 'intrinsic',
    icon: 'shield',
    description: 'Dense mountain-born constitution that shrugs off heavy blows.',
    mods: { maxHp: 20, armor: 8 },
  },
  {
    name: 'Forge Born',
    kind: 'intrinsic',
    icon: 'flame',
    description: 'Hardened by furnace heat and skilled in stonework and smithing.',
    mods: { armor: 6, harvestPct: 20 },
  },
  {
    name: 'Iron Grip',
    kind: 'intrinsic',
    icon: 'sword',
    description: 'Unshakable grip that drives axes and hammers deeper.',
    mods: { attackDamage: 5, critChance: 6 },
  },
  {
    name: 'Rune Sense',
    kind: 'intrinsic',
    icon: 'eye',
    description: 'Attuned to ancient stonecraft and hidden veins of ore.',
    mods: { harvestPct: 25, attackRange: 0.2 },
  },
  {
    name: 'Runic Resilience',
    kind: 'mutation',
    icon: 'shield',
    description: 'Ancestral runic ward that fortifies body and vitality.',
    mods: { maxHp: 35, armor: 12, regenPerSec: 1.0 },
  },
  // Lizardfolk intrinsic & rare genes
  {
    name: 'Sun Scales',
    kind: 'intrinsic',
    icon: 'scale',
    description: 'Warm reptilian scales that deflect glancing strikes in the sun.',
    mods: { armor: 7, maxHp: 14 },
  },
  {
    name: 'Cold Blood',
    kind: 'intrinsic',
    icon: 'frost',
    description: 'Calm reptilian metabolism with steady endurance.',
    mods: { maxHp: 15, regenPerSec: 0.8 },
  },
  {
    name: 'Jungle Step',
    kind: 'intrinsic',
    icon: 'boot',
    description: 'Nimble footing through dense jungle vines and marsh.',
    mods: { speed: 0.35, attackSpeedPct: 10 },
  },
  {
    name: 'Solar Focus',
    kind: 'intrinsic',
    icon: 'eye',
    description: 'Sun-sharpened reflexes that heighten critical precision.',
    mods: { critChance: 10, attackDamage: 4 },
  },
  {
    name: 'Sun-Blessed Scales',
    kind: 'mutation',
    icon: 'scale',
    description: 'Radiant golden-green scales infused with solar vitality.',
    mods: { armor: 11, maxHp: 28, regenPerSec: 1.4 },
  },
];

const GENE_BY_NAME = new Map<string, GeneDefinition>();
for (const g of UNIT_GENES) {
  if (!GENE_BY_NAME.has(g.name)) {
    GENE_BY_NAME.set(g.name, g);
  }
}

const GENE_INFO_CACHE = new Map<string, GeneDefinition>();
const GENE_INFO_CACHE_MAX = 512;

export function resolveGeneInfo(geneName: string, isIntrinsic = false): GeneDefinition {
  const exact = GENE_BY_NAME.get(geneName);
  if (exact && !isIntrinsic) {
    return exact;
  }
  const cacheKey = `${isIntrinsic ? '1' : '0'}|${geneName}`;
  const cached = GENE_INFO_CACHE.get(cacheKey);
  if (cached) return cached;

  let resolved: GeneDefinition;
  if (exact) {
    resolved = { ...exact, kind: 'intrinsic' };
  } else {
    const lower = geneName.toLowerCase();
    if (lower.endsWith('scales')) {
      resolved = {
        name: geneName,
        kind: 'intrinsic',
        icon: 'scale',
        description: 'Hard dragon scales that block heat and heavy blows.',
        mods: { armor: 16, fireproof: true, maxHp: 35 },
      };
    } else if (lower.includes('venom') || lower.includes('toxin') || lower.includes('blight')) {
      resolved = {
        name: geneName,
        kind: 'intrinsic',
        icon: 'venom',
        description: 'Natural venom that sickens foes on contact.',
        mods: { venomous: true, attackDamage: 4 },
      };
    } else if (lower.includes('fire') || lower.includes('flame') || lower.includes('hell') || lower.includes('ember')) {
      resolved = {
        name: geneName,
        kind: 'intrinsic',
        icon: 'flame',
        description: 'Built for heat and completely comfortable near lava.',
        mods: { fireproof: true, attackDamage: 5 },
      };
    } else if (lower.includes('frost') || lower.includes('ice') || lower.includes('glacial') || lower.includes('polar')) {
      resolved = {
        name: geneName,
        kind: 'intrinsic',
        icon: 'frost',
        description: 'Thick winter build made for snow and ice.',
        mods: { armor: 10, maxHp: 20 },
      };
    } else if (lower.includes('wing') || lower.includes('sky') || lower.includes('feather') || lower.includes('soar') || lower.includes('gallop') || lower.includes('swift') || lower.includes('leap') || lower.includes('sprint')) {
      resolved = {
        name: geneName,
        kind: 'intrinsic',
        icon: 'feather',
        description: 'Natural build for fast movement across open ground.',
        mods: { speed: 0.45 },
      };
    } else if (lower.includes('horn') || lower.includes('tusk') || lower.includes('antler') || lower.includes('charger')) {
      resolved = {
        name: geneName,
        kind: 'intrinsic',
        icon: 'horn',
        description: 'Heavy horns built for head-on charges.',
        mods: { attackDamage: 5, armor: 6 },
      };
    } else if (lower.includes('shell') || lower.includes('armor') || lower.includes('stone') || lower.includes('granite') || lower.includes('bark') || lower.includes('fleece') || lower.includes('fur') || lower.includes('blubber') || lower.includes('bulk') || lower.includes('heavy')) {
      resolved = {
        name: geneName,
        kind: 'intrinsic',
        icon: 'shield',
        description: 'Natural padding and tough outer hide.',
        mods: { armor: 10, maxHp: 18 },
      };
    } else if (lower.includes('claw') || lower.includes('fang') || lower.includes('apex') || lower.includes('stalker') || lower.includes('hunter') || lower.includes('raider') || lower.includes('warrior')) {
      resolved = {
        name: geneName,
        kind: 'intrinsic',
        icon: 'claw',
        description: 'Natural weapons tuned for close fights.',
        mods: { attackDamage: 5, critChance: 6 },
      };
    } else if (lower.includes('regen') || lower.includes('hydra') || lower.includes('moss') || lower.includes('living')) {
      resolved = {
        name: geneName,
        kind: 'intrinsic',
        icon: 'regen',
        description: 'Steadily mends injuries without resting.',
        mods: { regenPerSec: 2.2, maxHp: 20 },
      };
    } else {
      resolved = {
        name: geneName,
        kind: isIntrinsic ? 'intrinsic' : 'mutation',
        icon: 'dna',
        description: 'Inherited species trait passed down from its lineage.',
        mods: { maxHp: 10 },
      };
    }
  }

  if (GENE_INFO_CACHE.size < GENE_INFO_CACHE_MAX) {
    GENE_INFO_CACHE.set(cacheKey, resolved);
  }
  return resolved;
}

// ============================================================================
// ITEMS / GEAR CATALOG (Grounded, concrete, zero AI fluff)
// ============================================================================
export const UNIT_ITEMS: ItemDefinition[] = [
  // Weapons
  {
    name: 'Stone Club',
    slot: 'weapon',
    icon: 'hammer',
    description: 'Heavy chipped rock lashed to a thick branch.',
    mods: { attackDamage: 4 },
  },
  {
    name: 'Stone Spear',
    slot: 'weapon',
    icon: 'spear',
    description: 'Flint point tied tight onto a straight ash pole.',
    mods: { attackDamage: 5, attackRange: 0.4 },
  },
  {
    name: 'Bronze Spear',
    slot: 'weapon',
    icon: 'spear',
    description: 'Cast bronze tip that holds an edge through long fights.',
    mods: { attackDamage: 8, attackRange: 0.5 },
  },
  {
    name: 'Bronze Axe',
    slot: 'weapon',
    icon: 'axe',
    description: 'Broad chopping blade that splits shields and timber alike.',
    mods: { attackDamage: 10, critChance: 5 },
  },
  {
    name: 'Iron Sword',
    slot: 'weapon',
    icon: 'sword',
    description: 'Plain forged iron blade with a wrapped leather hilt.',
    mods: { attackDamage: 12, attackSpeedPct: 8 },
  },
  {
    name: 'Steel Spear',
    slot: 'weapon',
    icon: 'spear',
    description: 'Tempered steel lance with good reach and clean balance.',
    mods: { attackDamage: 14, attackRange: 0.6 },
  },
  {
    name: 'Iron Cleaver',
    slot: 'weapon',
    icon: 'axe',
    description: 'Thick notched chopper favored by raiders.',
    mods: { attackDamage: 11, critChance: 6 },
  },
  {
    name: 'War Hammer',
    slot: 'weapon',
    icon: 'hammer',
    description: 'Heavy iron head made for denting plate armor.',
    mods: { attackDamage: 16, critChance: 10, speed: -0.15 },
  },
  {
    name: 'Hunting Bow',
    slot: 'weapon',
    icon: 'bow',
    description: 'Bent yew bow with feathered arrows for mid-range shots.',
    mods: { attackDamage: 9, attackRange: 1.8, critChance: 8 },
  },
  {
    name: 'Musket',
    slot: 'weapon',
    icon: 'rifle',
    description: 'Smoothbore blackpowder gun. Loud kick, heavy lead ball.',
    mods: { attackDamage: 15, attackRange: 2.2 },
  },
  {
    name: 'Assault Rifle',
    slot: 'weapon',
    icon: 'rifle',
    description: 'Magazine-fed rifle built for rapid bursts at range.',
    mods: { attackDamage: 20, attackRange: 2.6, attackSpeedPct: 18 },
  },
  {
    name: 'Laser Rifle',
    slot: 'weapon',
    icon: 'laser',
    description: 'Focused beam rifle with clean optics and no recoil.',
    mods: { attackDamage: 26, attackRange: 3.0, critChance: 12 },
  },
  {
    name: 'Plasma Rifle',
    slot: 'weapon',
    icon: 'laser',
    description: 'Compact alien blaster firing superheated bolts.',
    mods: { attackDamage: 24, attackRange: 2.8, attackSpeedPct: 12 },
  },
  {
    name: 'Wooden Staff',
    slot: 'weapon',
    icon: 'spear',
    description: 'Smooth hardwood staff carried by elders and priests.',
    mods: { attackDamage: 4, regenPerSec: 1.0 },
  },

  // Armor & Shields
  {
    name: 'Hide Tunic',
    slot: 'armor',
    icon: 'tunic',
    description: 'Stitched animal hide that blocks scrapes and cold wind.',
    mods: { armor: 6, maxHp: 15 },
  },
  {
    name: 'Leather Vest',
    slot: 'armor',
    icon: 'tunic',
    description: 'Boiled leather jerkin that stays light while moving.',
    mods: { armor: 10, maxHp: 22, speed: 0.1 },
  },
  {
    name: 'Stone Shield',
    slot: 'armor',
    icon: 'shield',
    description: 'Rough slab shield strapped to the forearm.',
    mods: { armor: 8, maxHp: 15 },
  },
  {
    name: 'Bronze Shield',
    slot: 'armor',
    icon: 'shield',
    description: 'Round bronze buckler with a hammered center boss.',
    mods: { armor: 12, maxHp: 25 },
  },
  {
    name: 'Steel Shield',
    slot: 'armor',
    icon: 'shield',
    description: 'Riveted steel kite shield built to stop heavy hits.',
    mods: { armor: 16, maxHp: 35 },
  },
  {
    name: 'Iron Plate',
    slot: 'armor',
    icon: 'armor',
    description: 'Full chestplate and greaves. Heavy, but turns blades away.',
    mods: { armor: 22, maxHp: 55, speed: -0.2 },
  },
  {
    name: 'Spiked Armor',
    slot: 'armor',
    icon: 'spike',
    description: 'Iron bands studded with nails that punish melee hits.',
    mods: { armor: 15, maxHp: 30, thorns: true },
  },
  {
    name: 'Alloy Suit',
    slot: 'armor',
    icon: 'armor',
    description: 'Sealed composite armor plating built for modern warfare.',
    mods: { armor: 26, maxHp: 70, fireproof: true },
  },

  // Tools
  {
    name: 'Stone Tools',
    slot: 'tool',
    icon: 'pickaxe',
    description: 'Basic flint knife and hand axe for camp chores.',
    mods: { harvestPct: 12 },
  },
  {
    name: 'Bronze Pickaxe',
    slot: 'tool',
    icon: 'pickaxe',
    description: 'Weighted bronze pick for breaking ore and rock.',
    mods: { harvestPct: 22, attackDamage: 4 },
  },
  {
    name: 'Iron Hammer',
    slot: 'tool',
    icon: 'hammer',
    description: 'Solid framing hammer for faster timber and stone work.',
    mods: { harvestPct: 24, attackDamage: 5 },
  },
  {
    name: 'Steel Sickle',
    slot: 'tool',
    icon: 'sickle',
    description: 'Curved harvesting blade for quick grain and berry gathering.',
    mods: { harvestPct: 28, attackSpeedPct: 8 },
  },
  {
    name: 'Mining Lamp',
    slot: 'tool',
    icon: 'lamp',
    description: 'Brass oil lantern hung on the belt for dark tunnels.',
    mods: { harvestPct: 15, critChance: 4 },
  },
  {
    name: 'Power Welder',
    slot: 'tool',
    icon: 'wrench',
    description: 'Electric arc torch that cuts build time down.',
    mods: { harvestPct: 35, attackDamage: 6 },
  },
  {
    name: 'Laser Drill',
    slot: 'tool',
    icon: 'laser',
    description: 'Industrial beam cutter that bores straight through rock.',
    mods: { harvestPct: 45, attackDamage: 9 },
  },
  {
    name: 'Alloy Wrench',
    slot: 'tool',
    icon: 'wrench',
    description: 'Machined multi-wrench kept handy by engineers.',
    mods: { harvestPct: 28, armor: 4 },
  },

  // Trinkets
  {
    name: 'Travel Boots',
    slot: 'trinket',
    icon: 'boot',
    description: 'Well-soled leather boots built for long marches.',
    mods: { speed: 0.55 },
  },
  {
    name: 'Forest Cloak',
    slot: 'trinket',
    icon: 'cloak',
    description: 'Dyed wool cloak that keeps rain off and helps blend in.',
    mods: { speed: 0.25, armor: 6 },
  },
  {
    name: 'Four-Leaf Clover',
    slot: 'trinket',
    icon: 'clover',
    description: 'Pressed lucky leaf tucked inside a pocket.',
    mods: { critChance: 12 },
  },
  {
    name: 'Iron Ring',
    slot: 'trinket',
    icon: 'ring',
    description: 'Plain forged band worn as a good-luck keepsake.',
    mods: { maxHp: 20, armor: 5 },
  },
  {
    name: 'Herbal Pouch',
    slot: 'trinket',
    icon: 'pouch',
    description: 'Dried comfrey, moss, and bandages for patching cuts.',
    mods: { regenPerSec: 2.0, maxHp: 12 },
  },
  {
    name: 'Whetstone',
    slot: 'trinket',
    icon: 'stone',
    description: 'Pocket sharpening stone to keep any edge keen.',
    mods: { attackDamage: 5, critChance: 6 },
  },
  {
    name: 'Fire Stone',
    slot: 'trinket',
    icon: 'flame',
    description: 'Warm volcanic pebble that protects the wearer from burns.',
    mods: { fireproof: true, armor: 4 },
  },
  {
    name: 'Venom Vial',
    slot: 'trinket',
    icon: 'venom',
    description: 'Stoppered glass vial of dark sap used to coat blades.',
    mods: { venomous: true, attackDamage: 3 },
  },
  {
    name: 'Blood Fang',
    slot: 'trinket',
    icon: 'blood',
    description: 'Carved predator fang worn on a cord. Steals life on hit.',
    mods: { vampiric: true, attackDamage: 4 },
  },
  {
    name: 'Pocket Compass',
    slot: 'trinket',
    icon: 'compass',
    description: 'Small brass needle box for finding the quickest path.',
    mods: { speed: 0.3, harvestPct: 10 },
  },
  {
    name: 'Bone Charm',
    slot: 'trinket',
    icon: 'skull',
    description: 'Carved bone pendant carried by raiders and hunters.',
    mods: { attackDamage: 4, critChance: 5 },
  },
  {
    name: 'Brass Crown',
    slot: 'trinket',
    icon: 'crown',
    description: 'Beaten brass circlet worn by village chiefs and rulers.',
    mods: { maxHp: 45, attackDamage: 6, armor: 8 },
  },
  {
    name: 'Travel Bag',
    slot: 'trinket',
    icon: 'pouch',
    description: 'Sturdy canvas pack for extra rations and supplies.',
    mods: { harvestPct: 16, maxHp: 10 },
  },
  {
    name: 'Sun Charm',
    slot: 'trinket',
    icon: 'star',
    description: 'Warm bronze disk polished bright.',
    mods: { regenPerSec: 1.2, critChance: 5 },
  },
  {
    name: 'War Horn',
    slot: 'trinket',
    icon: 'horn',
    description: 'Hollowed horn blown before a charge.',
    mods: { attackDamage: 5, attackSpeedPct: 10 },
  },
  {
    name: 'Iron Flask',
    slot: 'trinket',
    icon: 'pouch',
    description: 'Dented metal canteen filled with strong camp brew.',
    mods: { maxHp: 22, regenPerSec: 0.8 },
  },
];

const ITEM_BY_NAME = new Map<string, ItemDefinition>(
  UNIT_ITEMS.map((item) => [item.name, item]),
);

const ITEM_INFO_CACHE = new Map<string, ItemDefinition>();
const ITEM_INFO_CACHE_MAX = 512;

export function resolveItemInfo(itemName: string): ItemDefinition {
  const exact = ITEM_BY_NAME.get(itemName);
  if (exact) return exact;

  // Dynamic carrying label (avoid polluting memo cache with resource variant strings)
  if (itemName.startsWith('Carrying ')) {
    return {
      name: itemName,
      slot: 'tool',
      icon: 'pouch',
      description: 'Supplies currently being carried back to camp.',
      mods: {},
    };
  }

  const cached = ITEM_INFO_CACHE.get(itemName);
  if (cached) return cached;

  const lower = itemName.toLowerCase();

  // Material-prefixed generated weapons/shields/tools
  const tierBonus = lower.includes('laser') || lower.includes('plasma')
    ? 4
    : lower.includes('alloy')
      ? 3
      : lower.includes('steel') || lower.includes('iron')
        ? 2
        : lower.includes('bronze')
          ? 1
          : 0;

  let resolved: ItemDefinition;
  if (lower.includes('rifle') || lower.includes('laser') || lower.includes('beam')) {
    resolved = {
      name: itemName,
      slot: 'weapon',
      icon: lower.includes('laser') || lower.includes('plasma') || lower.includes('beam') ? 'laser' : 'rifle',
      description: 'Ranged weapon built for long shots.',
      mods: { attackDamage: 12 + tierBonus * 3, attackRange: 2.0 + tierBonus * 0.25 },
    };
  } else if (lower.includes('spear') || lower.includes('sword') || lower.includes('axe') || lower.includes('club') || lower.includes('cleaver') || lower.includes('bow')) {
    resolved = {
      name: itemName,
      slot: 'weapon',
      icon: lower.includes('axe') || lower.includes('cleaver')
        ? 'axe'
        : lower.includes('bow')
          ? 'bow'
          : lower.includes('spear')
            ? 'spear'
            : lower.includes('club')
              ? 'hammer'
              : 'sword',
      description: 'Hand-held weapon carried for self-defense and war.',
      mods: {
        attackDamage: 5 + tierBonus * 2.5,
        attackRange: lower.includes('bow') ? 1.6 : lower.includes('spear') ? 0.5 : 0,
      },
    };
  } else if (lower.includes('shield') || lower.includes('armor') || lower.includes('plate') || lower.includes('shell') || lower.includes('scale') || lower.includes('hide') || lower.includes('granite') || lower.includes('pelt') || lower.includes('fur') || lower.includes('wool') || lower.includes('blubber')) {
    resolved = {
      name: itemName,
      slot: lower.includes('shield') || lower.includes('armor') ? 'armor' : 'natural',
      icon: lower.includes('scale') ? 'scale' : lower.includes('shield') ? 'shield' : 'armor',
      description: 'Thick protection that softens incoming hits.',
      mods: { armor: 7 + tierBonus * 3, maxHp: 14 + tierBonus * 8 },
    };
  } else if (lower.includes('pickaxe') || lower.includes('hammer') || lower.includes('sickle') || lower.includes('drill') || lower.includes('tool') || lower.includes('welder') || lower.includes('wrench')) {
    resolved = {
      name: itemName,
      slot: 'tool',
      icon: lower.includes('hammer') ? 'hammer' : lower.includes('sickle') ? 'sickle' : lower.includes('wrench') || lower.includes('welder') ? 'wrench' : 'pickaxe',
      description: 'Everyday work gear for building and gathering.',
      mods: { harvestPct: 14 + tierBonus * 6, attackDamage: 2 + tierBonus },
    };
  } else if (lower.includes('fang') || lower.includes('claw') || lower.includes('talon') || lower.includes('jaw') || lower.includes('tusk') || lower.includes('horn') || lower.includes('antler') || lower.includes('beak') || lower.includes('stinger')) {
    resolved = {
      name: itemName,
      slot: 'natural',
      icon: lower.includes('venom') || lower.includes('stinger')
        ? 'venom'
        : lower.includes('horn') || lower.includes('antler') || lower.includes('tusk')
          ? 'horn'
          : lower.includes('claw') || lower.includes('talon')
            ? 'claw'
            : 'fang',
      description: 'Natural weapon used for hunting or defending territory.',
      mods: {
        attackDamage: 5,
        critChance: 5,
        venomous: lower.includes('venom') || lower.includes('stinger') ? true : undefined,
      },
    };
  } else if (lower.includes('flame') || lower.includes('ember') || lower.includes('lava') || lower.includes('solar') || lower.includes('ash') || lower.includes('foxfire')) {
    resolved = {
      name: itemName,
      slot: 'natural',
      icon: 'flame',
      description: 'Hot natural organ or keepsake untouched by fire.',
      mods: { fireproof: true, attackDamage: 5 },
    };
  } else if (lower.includes('venom') || lower.includes('ink')) {
    resolved = {
      name: itemName,
      slot: 'natural',
      icon: 'venom',
      description: 'Biting toxin used to wear down targets.',
      mods: { venomous: true, attackDamage: 3 },
    };
  } else if (lower.includes('feather') || lower.includes('wing') || lower.includes('pinion') || lower.includes('hoof') || lower.includes('hooves') || lower.includes('fin') || lower.includes('tendon')) {
    resolved = {
      name: itemName,
      slot: 'natural',
      icon: 'feather',
      description: 'Built for quick movement and balance.',
      mods: { speed: 0.3 },
    };
  } else if (lower.includes('scroll') || lower.includes('book') || lower.includes('plan') || lower.includes('tablet') || lower.includes('pad') || lower.includes('compass')) {
    resolved = {
      name: itemName,
      slot: 'trinket',
      icon: 'scroll',
      description: 'Notes and charts kept on hand during work.',
      mods: { harvestPct: 12 },
    };
  } else if (lower.includes('clover') || lower.includes('lucky') || lower.includes('bell') || lower.includes('flute') || lower.includes('wreath') || lower.includes('token') || lower.includes('charm')) {
    resolved = {
      name: itemName,
      slot: 'trinket',
      icon: 'clover',
      description: 'Small personal keepsake carried everywhere.',
      mods: { critChance: 6, speed: 0.15 },
    };
  } else {
    resolved = {
      name: itemName,
      slot: 'trinket',
      icon: 'pouch',
      description: 'Carried gear or personal belonging.',
      mods: { maxHp: 8 },
    };
  }

  if (ITEM_INFO_CACHE.size < ITEM_INFO_CACHE_MAX) {
    ITEM_INFO_CACHE.set(itemName, resolved);
  }
  return resolved;
}

// ============================================================================
// DETERMINISTIC TRAIT ROLLS FOR NEWLY SPAWNED UNITS
// ============================================================================
function hashSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

const CIV_TRAIT_POOL = [
  'tough',
  'strong',
  'fast',
  'thick_skinned',
  'sharp_eyed',
  'fast_healer',
  'hard_worker',
  'iron_will',
  'lucky',
  'long_lived',
  'tiny',
  'giant',
  'berserker',
  'slow',
  'lazy',
  'weak',
];

const WILDLIFE_TRAIT_POOL = [
  'tough',
  'strong',
  'fast',
  'thick_skinned',
  'sharp_eyed',
  'fast_healer',
  'giant',
  'tiny',
  'long_lived',
  'slow',
];

const HOSTILE_TRAIT_POOL = [
  'strong',
  'tough',
  'berserker',
  'thick_skinned',
  'fast',
  'sharp_eyed',
  'spiky',
  'blood_drinker',
  'iron_will',
];

export function generateUnitTraits(
  role: UnitRole,
  _species: SpeciesId,
  appearanceSeed = 1,
): string[] {
  const seed = Math.abs(Math.floor(appearanceSeed) || 1);
  const picked: string[] = [];

  // Iconic creature defaults
  if (role === 'dragon' || role === 'phoenix' || role === 'cerberus') {
    picked.push('fireproof');
  } else if (role === 'golem' || role === 'gargoyle') {
    picked.push('thick_skinned');
  } else if (role === 'giant_spider' || role === 'manticore' || role === 'basilisk') {
    picked.push('venomous');
  } else if (role === 'hydra') {
    picked.push('fast_healer');
  } else if (role === 'leviathan' || role === 'yeti' || role === 'minotaur' || role === 'kraken') {
    picked.push('giant');
  }

  const def = UNIT_BY_ROLE.get(role);
  const pool =
    def?.faction === 'hostile'
      ? HOSTILE_TRAIT_POOL
      : def?.faction === 'wildlife'
        ? WILDLIFE_TRAIT_POOL
        : CIV_TRAIT_POOL;

  // Give 1 trait to most units, 2 traits to ~38% of units
  const targetCount = hashSeed(seed, 41) % 100 < 38 ? 2 : 1;
  let attempts = 0;
  while (picked.length < targetCount && attempts < 10) {
    const candidate = pool[hashSeed(seed, 53 + attempts * 13) % pool.length];
    attempts++;
    if (picked.includes(candidate)) continue;
    const cDef = TRAIT_BY_ID.get(candidate);
    if (cDef?.opposites?.some((opp) => picked.includes(opp))) continue;
    picked.push(candidate);
  }

  return picked;
}

// ============================================================================
// EFFECTIVE STATS COMPUTATION (Fast, zero-allocation inner accumulation)
// ============================================================================
function applyMod(acc: EffectiveUnitStats, m: UnitModifierSet | undefined): void {
  if (!m) return;
  if (m.maxHp) acc.maxHp += m.maxHp;
  if (m.attackDamage) acc.attackDamage += m.attackDamage;
  if (m.armor) acc.armor += m.armor;
  if (m.speed) acc.speed += m.speed;
  if (m.critChance) acc.critChance += m.critChance;
  if (m.attackRange) acc.attackRange += m.attackRange;
  if (m.attackSpeedPct) acc.attackSpeedMult += m.attackSpeedPct / 100;
  if (m.regenPerSec) acc.regenPerSec += m.regenPerSec;
  if (m.harvestPct) acc.harvestMult += m.harvestPct / 100;
  if (m.lifespanBonus) acc.lifespanBonus += m.lifespanBonus;
  if (m.immortal) acc.immortal = true;
  if (m.fireproof) acc.fireproof = true;
  if (m.thorns) acc.thorns = true;
  if (m.venomous) acc.venomous = true;
  if (m.vampiric) acc.vampiric = true;
}

interface CachedEffectiveStatsEntry {
  def: UnitDefinition | undefined;
  role: UnitRole;
  ageStage: string | undefined;
  isKing: boolean;
  traitsSnap: string[] | undefined;
  genesSnap: string[] | undefined;
  itemsSnap: string[] | undefined;
  bMaxHp: number;
  bAtk: number;
  bArmor: number;
  bSpd: number;
  bCrit: number;
  bRange: number;
  bRegen: number;
  stats: EffectiveUnitStats;
}

const UNIT_STATS_CACHE = new WeakMap<object, CachedEffectiveStatsEntry>();

function stringArraysEqual(
  snap: string[] | undefined,
  live: readonly string[] | undefined,
): boolean {
  const nLive = live ? live.length : 0;
  const nSnap = snap ? snap.length : 0;
  if (nLive !== nSnap) return false;
  if (nLive === 0) return true;
  for (let i = 0; i < nLive; i++) {
    if (snap![i] !== live![i]) return false;
  }
  return true;
}

export function computeUnitEffectiveStats(
  unit: Pick<
    UnitEntity,
    | 'role'
    | 'species'
    | 'ageStage'
    | 'traits'
    | 'genes'
    | 'items'
    | 'statBonuses'
    | 'statusEffects'
    | 'isKing'
  >,
  defOverride?: UnitDefinition,
  options?: { includeStatusEffects?: boolean; worldImmortal?: boolean },
): EffectiveUnitStats {
  const def = defOverride ?? UNIT_BY_ROLE.get(unit.role);
  const canUseCache = !options?.includeStatusEffects;
  const b = unit.statBonuses;
  const bMaxHp = b?.maxHp ?? 0;
  const bAtk = b?.attackDamage ?? 0;
  const bArmor = b?.armor ?? 0;
  const bSpd = b?.speed ?? 0;
  const bCrit = b?.critChance ?? 0;
  const bRange = b?.attackRange ?? 0;
  const bRegen = b?.regenPerSec ?? 0;
  const isKing = Boolean(unit.isKing);

  if (canUseCache) {
    const cached = UNIT_STATS_CACHE.get(unit);
    if (
      cached &&
      cached.def === def &&
      cached.role === unit.role &&
      cached.ageStage === unit.ageStage &&
      cached.isKing === isKing &&
      cached.bMaxHp === bMaxHp &&
      cached.bAtk === bAtk &&
      cached.bArmor === bArmor &&
      cached.bSpd === bSpd &&
      cached.bCrit === bCrit &&
      cached.bRange === bRange &&
      cached.bRegen === bRegen &&
      stringArraysEqual(cached.traitsSnap, unit.traits) &&
      stringArraysEqual(cached.genesSnap, unit.genes) &&
      stringArraysEqual(cached.itemsSnap, unit.items)
    ) {
      const s = cached.stats;
      return {
        maxHp: s.maxHp,
        attackDamage: s.attackDamage,
        armor: s.armor,
        speed: s.speed,
        critChance: s.critChance,
        attackRange: s.attackRange,
        attackSpeedMult: s.attackSpeedMult,
        regenPerSec: s.regenPerSec,
        harvestMult: s.harvestMult,
        lifespanBonus: s.lifespanBonus,
        immortal: s.immortal || Boolean(options?.worldImmortal),
        fireproof: s.fireproof,
        thorns: s.thorns,
        venomous: s.venomous,
        vampiric: s.vampiric,
      };
    }
  }

  const isChild = unit.ageStage === 'child';

  const baseMaxHp = def
    ? isChild
      ? Math.max(45, Math.round(def.maxHp * 0.68))
      : def.maxHp
    : 100;
  const baseAtk = (def?.attackDamage ?? 8) * (isChild ? 0.72 : 1);
  const baseSpd = (def?.speed ?? 2.2) * (isChild ? 1.12 : 1);
  const baseRange = def?.attackRange ?? 1.2;

  const stats: EffectiveUnitStats = {
    maxHp: baseMaxHp,
    attackDamage: baseAtk,
    armor: unit.role === 'golem' ? 35 : unit.role === 'turtle' ? 20 : 0,
    speed: baseSpd,
    critChance: 5,
    attackRange: baseRange,
    attackSpeedMult: 1,
    regenPerSec: 0,
    harvestMult: 1,
    lifespanBonus: 0,
    immortal: false,
    fireproof:
      unit.role === 'dragon' ||
      unit.role === 'phoenix' ||
      unit.role === 'cerberus' ||
      unit.role === 'golem' ||
      unit.role === 'gargoyle',
    thorns: false,
    venomous: unit.role === 'giant_spider',
    vampiric: false,
  };

  if (isKing) {
    stats.maxHp += 35;
    stats.attackDamage += 4;
    stats.armor += 6;
  }

  // Traits
  if (unit.traits) {
    for (let i = 0; i < unit.traits.length; i++) {
      const t = TRAIT_BY_ID.get(unit.traits[i]);
      if (t) applyMod(stats, t.mods);
    }
  }

  // Genes
  if (unit.genes) {
    for (let i = 0; i < unit.genes.length; i++) {
      const g = GENE_BY_NAME.get(unit.genes[i]) ?? resolveGeneInfo(unit.genes[i], i === 0);
      applyMod(stats, g.mods);
    }
  }

  // Items
  if (unit.items) {
    for (let i = 0; i < unit.items.length; i++) {
      const itemName = unit.items[i];
      if (!itemName || itemName.startsWith('Carrying ')) continue;
      const item = ITEM_BY_NAME.get(itemName) ?? resolveItemInfo(itemName);
      applyMod(stats, item.mods);
    }
  }

  // User-edited manual stat bonuses
  if (b) {
    if (bMaxHp) stats.maxHp += bMaxHp;
    if (bAtk) stats.attackDamage += bAtk;
    if (bArmor) stats.armor += bArmor;
    if (bSpd) stats.speed += bSpd;
    if (bCrit) stats.critChance += bCrit;
    if (bRange) stats.attackRange += bRange;
    if (bRegen) stats.regenPerSec += bRegen;
  }

  // Optional live status effects (for inspector display; simulation applies status multipliers explicitly)
  if (options?.includeStatusEffects && unit.statusEffects) {
    if (unit.statusEffects.frenzied) {
      stats.attackDamage *= 2.0;
      stats.speed *= 1.5;
      stats.attackSpeedMult *= 1.3;
    } else if (unit.statusEffects.blessed) {
      stats.attackDamage *= 1.2;
      stats.speed *= 1.25;
    }
    if (unit.statusEffects.cursed) {
      stats.speed *= 0.65;
    }
    if (unit.statusEffects.frozen) {
      stats.speed *= 0.08;
    }
  }

  // Safe numeric rounding & clamps (avoids .toFixed() string allocations)
  stats.maxHp = Math.max(10, Math.round(stats.maxHp));
  stats.attackDamage = Math.max(1, Math.round(stats.attackDamage));
  stats.armor = Math.max(0, Math.min(75, Math.round(stats.armor)));
  stats.speed = Math.round(Math.max(0.4, Math.min(12, stats.speed)) * 100) / 100;
  stats.critChance = Math.max(0, Math.min(85, Math.round(stats.critChance)));
  stats.attackRange = Math.round(Math.max(0.8, Math.min(14, stats.attackRange)) * 10) / 10;
  stats.attackSpeedMult = Math.round(Math.max(0.4, Math.min(3.0, stats.attackSpeedMult)) * 100) / 100;
  stats.regenPerSec = Math.round(Math.max(0, Math.min(50, stats.regenPerSec)) * 10) / 10;
  stats.harvestMult = Math.round(Math.max(0.3, Math.min(4.0, stats.harvestMult)) * 100) / 100;

  if (canUseCache) {
    UNIT_STATS_CACHE.set(unit, {
      def,
      role: unit.role,
      ageStage: unit.ageStage,
      isKing,
      traitsSnap: unit.traits && unit.traits.length > 0 ? unit.traits.slice() : undefined,
      genesSnap: unit.genes && unit.genes.length > 0 ? unit.genes.slice() : undefined,
      itemsSnap: unit.items && unit.items.length > 0 ? unit.items.slice() : undefined,
      bMaxHp,
      bAtk,
      bArmor,
      bSpd,
      bCrit,
      bRange,
      bRegen,
      stats: { ...stats },
    });
  }

  if (options?.worldImmortal) {
    stats.immortal = true;
  }

  return stats;
}

export function formatModifierList(mods: UnitModifierSet): string[] {
  const out: string[] = [];
  if (mods.maxHp) out.push(`${mods.maxHp > 0 ? '+' : ''}${mods.maxHp} HP`);
  if (mods.attackDamage) out.push(`${mods.attackDamage > 0 ? '+' : ''}${mods.attackDamage} DMG`);
  if (mods.armor) out.push(`${mods.armor > 0 ? '+' : ''}${mods.armor}% Armor`);
  if (mods.speed) out.push(`${mods.speed > 0 ? '+' : ''}${mods.speed.toFixed(1)} Speed`);
  if (mods.critChance) out.push(`${mods.critChance > 0 ? '+' : ''}${mods.critChance}% Crit`);
  if (mods.attackRange) out.push(`${mods.attackRange > 0 ? '+' : ''}${mods.attackRange.toFixed(1)} Range`);
  if (mods.attackSpeedPct) out.push(`${mods.attackSpeedPct > 0 ? '+' : ''}${mods.attackSpeedPct}% Atk Spd`);
  if (mods.regenPerSec) out.push(`+${mods.regenPerSec.toFixed(1)}/s Regen`);
  if (mods.harvestPct) out.push(`${mods.harvestPct > 0 ? '+' : ''}${mods.harvestPct}% Gather`);
  if (mods.lifespanBonus) out.push(`${mods.lifespanBonus > 0 ? '+' : ''}${mods.lifespanBonus}y Life`);
  if (mods.immortal) out.push('Ageless');
  if (mods.fireproof) out.push('Fireproof');
  if (mods.thorns) out.push('Thorns');
  if (mods.venomous) out.push('Poison Hit');
  if (mods.vampiric) out.push('Lifesteal');
  return out;
}

// ============================================================================
// LIVE UNIT SYNC & EDIT MUTATORS
// ============================================================================
export function syncUnitDerivedStats(unit: UnitEntity, healDelta = true): EffectiveUnitStats {
  const prevMax = Math.max(1, unit.maxHp);
  const eff = computeUnitEffectiveStats(unit);
  unit.maxHp = eff.maxHp;
  if (healDelta && eff.maxHp > prevMax) {
    unit.hp = Math.min(unit.maxHp, unit.hp + (eff.maxHp - prevMax));
  } else {
    unit.hp = Math.min(unit.maxHp, unit.hp);
  }
  const baseLifespan = getUnitMaxLifespan({
    role: unit.role,
    species: unit.species,
    appearanceSeed: unit.appearanceSeed,
    genes: unit.genes,
  });
  unit.maxLifespan = Math.max(10, Math.round(baseLifespan + eff.lifespanBonus));
  return eff;
}

export function setUnitStatValue(
  unit: UnitEntity,
  statKey: UnitStatKey,
  desiredValue: number,
): EffectiveUnitStats {
  if (!Number.isFinite(desiredValue)) {
    return computeUnitEffectiveStats(unit);
  }
  const currentBonuses: UnitStatBonuses = { ...(unit.statBonuses ?? {}) };
  // Measure value without this specific bonus so we compute exact offset
  const prevBonus = currentBonuses[statKey] ?? 0;
  currentBonuses[statKey] = 0;
  const baseline = computeUnitEffectiveStats({ ...unit, statBonuses: currentBonuses });
  const baseVal = baseline[statKey];

  let clampedTarget = desiredValue;
  if (statKey === 'maxHp') clampedTarget = Math.max(10, Math.min(9999, Math.round(desiredValue)));
  else if (statKey === 'attackDamage') clampedTarget = Math.max(1, Math.min(999, Math.round(desiredValue)));
  else if (statKey === 'armor') clampedTarget = Math.max(0, Math.min(75, Math.round(desiredValue)));
  else if (statKey === 'speed') clampedTarget = Number(Math.max(0.4, Math.min(12, desiredValue)).toFixed(2));
  else if (statKey === 'critChance') clampedTarget = Math.max(0, Math.min(85, Math.round(desiredValue)));
  else if (statKey === 'attackRange') clampedTarget = Number(Math.max(0.8, Math.min(14, desiredValue)).toFixed(1));
  else if (statKey === 'regenPerSec') clampedTarget = Number(Math.max(0, Math.min(50, desiredValue)).toFixed(1));

  const nextBonus = Number((clampedTarget - baseVal).toFixed(2));
  if (!unit.statBonuses) unit.statBonuses = {};
  if (Math.abs(nextBonus) < 0.001) {
    delete unit.statBonuses[statKey];
  } else {
    unit.statBonuses[statKey] = nextBonus;
  }

  // If maxHp increased, syncUnitDerivedStats(unit, true) adds the delta to unit.hp once; if reduced, clamps hp
  const eff = syncUnitDerivedStats(unit, statKey === 'maxHp' && nextBonus > prevBonus);
  return eff;
}

export const MIN_UNIT_SIZE_SCALE = 0.35;
export const MAX_UNIT_SIZE_SCALE = 4.0;

/** Returns the raw user-edited size multiplier for a unit (default 1.0). */
export function getUnitSizeScale(unit: Pick<UnitEntity, 'sizeScale'>): number {
  const raw = unit.sizeScale;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1.0;
  return Number(Math.max(MIN_UNIT_SIZE_SCALE, Math.min(MAX_UNIT_SIZE_SCALE, raw)).toFixed(2));
}

/**
 * Returns the effective 3D visual scale multiplier for a unit, combining custom inspector
 * `sizeScale` with `giant` (1.28×) / `tiny` (0.76×) traits.
 */
export function getEffectiveUnitSizeScale(
  unit: Pick<UnitEntity, 'sizeScale' | 'traits'>,
): number {
  let scale = getUnitSizeScale(unit);
  const traits = unit.traits;
  if (traits && traits.length > 0) {
    if (traits.includes('giant')) scale *= 1.28;
    else if (traits.includes('tiny')) scale *= 0.76;
  }
  return Math.max(0.25, Math.min(5.0, scale));
}

export function setUnitSizeScale(unit: UnitEntity, desiredScale: number): number {
  if (!Number.isFinite(desiredScale)) return getUnitSizeScale(unit);
  const clamped = Number(
    Math.max(MIN_UNIT_SIZE_SCALE, Math.min(MAX_UNIT_SIZE_SCALE, desiredScale)).toFixed(2),
  );
  if (Math.abs(clamped - 1.0) < 0.005) {
    unit.sizeScale = undefined;
    return 1.0;
  }
  unit.sizeScale = clamped;
  return clamped;
}

export function resetUnitStatBonuses(unit: UnitEntity): EffectiveUnitStats {
  unit.statBonuses = undefined;
  unit.sizeScale = undefined;
  return syncUnitDerivedStats(unit, false);
}

export function healUnitFull(unit: UnitEntity): void {
  const eff = syncUnitDerivedStats(unit, false);
  unit.hp = eff.maxHp;
  delete unit.statusEffects.plagued;
  delete unit.statusEffects.cursed;
  delete unit.statusEffects.frozen;
}

export function setUnitAgeYears(unit: UnitEntity, years: number): void {
  const clamped = Math.max(0, Math.min(9999, Math.floor(years)));
  unit.ageYears = clamped;
  if (clamped < 12 && unit.faction === 'civilization') {
    unit.ageStage = 'child';
    if (unit.growthTimer === undefined || unit.growthTimer <= 0) {
      unit.growthTimer = Math.max(4, (12 - clamped) * 2.5);
    }
    syncUnitDerivedStats(unit, false);
  } else if (clamped >= 12 && unit.ageStage === 'child') {
    unit.ageStage = 'adult';
    unit.growthTimer = undefined;
    syncUnitDerivedStats(unit, true);
  }
}

export function toggleUnitTrait(unit: UnitEntity, traitId: string): boolean {
  const def = TRAIT_BY_ID.get(traitId);
  if (!def) return false;
  const list = unit.traits ? [...unit.traits] : [];
  const existingIdx = list.indexOf(traitId);
  if (existingIdx >= 0) {
    list.splice(existingIdx, 1);
    unit.traits = list;
    syncUnitDerivedStats(unit, false);
    return false;
  }
  // Remove conflicting opposite traits if present
  const filtered = def.opposites
    ? list.filter((id) => !def.opposites!.includes(id))
    : list;
  filtered.push(traitId);
  unit.traits = filtered;
  syncUnitDerivedStats(unit, true);
  return true;
}

export function toggleUnitGene(unit: UnitEntity, geneName: string): boolean {
  const list = unit.genes ? [...unit.genes] : [];
  const existingIdx = list.indexOf(geneName);
  if (existingIdx >= 0) {
    list.splice(existingIdx, 1);
    unit.genes = list;
    syncUnitDerivedStats(unit, false);
    return false;
  }
  list.push(geneName);
  unit.genes = list;
  syncUnitDerivedStats(unit, true);
  return true;
}

export function addUnitItem(unit: UnitEntity, itemName: string): boolean {
  const trimmed = itemName.trim();
  if (!trimmed) return false;
  const list = unit.items ? [...unit.items] : [];
  if (list.length >= 12) return false;
  list.push(trimmed);
  unit.items = list;
  syncUnitDerivedStats(unit, true);
  return true;
}

export function removeUnitItem(unit: UnitEntity, indexOrName: number | string): boolean {
  if (!unit.items || unit.items.length === 0) return false;
  const list = [...unit.items];
  const idx = typeof indexOrName === 'number' ? indexOrName : list.indexOf(indexOrName);
  if (idx < 0 || idx >= list.length) return false;
  list.splice(idx, 1);
  unit.items = list;
  syncUnitDerivedStats(unit, false);
  return true;
}
