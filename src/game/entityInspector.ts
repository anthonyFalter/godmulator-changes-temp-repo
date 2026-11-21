import {
  EPOCHS,
  UNITS,
  getDinosaurVariant,
  getDragonVariant,
  getUnitMaxLifespan,
} from './catalog';
import {
  SimulationState,
  SpeciesId,
  UnitAgeStage,
  UnitEntity,
  UnitRole,
  UnitStatusEffect,
} from './types';

export type DietCategory =
  | 'Herbivore'
  | 'Carnivore'
  | 'Fire Carnivore'
  | 'Forest Herbivore'
  | 'Sea Predator'
  | 'Omnivore'
  | 'Forager';

export interface EntityDietInfo {
  category: DietCategory;
  detail: string;
}

export interface EntityInspectProfile {
  id: string;
  name: string;
  subtitle: string;
  factionLabel: 'Civilization' | 'Hostile' | 'Wildlife' | 'Mythical';
  diet: EntityDietInfo;
  informations: {
    hp: number;
    maxHp: number;
    hpPercent: number;
    ageStageLabel: string;
    ageYears: number;
    maxLifespan: number | null;
    immortal: boolean;
    settlementName: string | null;
    activity: string;
    attackDamage: number;
    attackRange: number;
    speed: number;
    statusEffects: UnitStatusEffect[];
    breathCooldown: number | null;
    tileX: number;
    tileZ: number;
  };
  items: string[];
  genes: string[];
  favorite: boolean;
}

export const RARE_GENE_POOLS: Record<
  'civilization' | 'elf' | 'orc' | 'herbivore' | 'carnivore' | 'dragon' | 'unicorn' | 'hostile',
  string[]
> = {
  civilization: [
    'Deep Lungs',
    'Eagle Eye',
    'Fast Runner',
    'Tough',
    'Quick Hands',
    'Sharp Memory',
    'Brave Heart',
    'Old Bloodline',
  ],
  elf: [
    'Forest Sight',
    'Light Step',
    'Forest Bond',
    'Night Grace',
  ],
  orc: [
    'Fierce Heart',
    'Thick Skull',
    'Strong Grip',
    'Tough Hide',
  ],
  herbivore: [
    'White Coat',
    'Alert',
    'Thick Fur',
    'Fast Runner',
    'Large Frame',
    'Strong Bones',
  ],
  carnivore: [
    'Strong Jaw',
    'Sharp Teeth',
    'Keen Scent',
    'Night Vision',
    'Tireless Hunter',
    'Thick Pelt',
  ],
  dragon: [
    'Fire Breath',
    'Dragon Blood',
    'Hot Core',
    'Strong Wings',
    'Sharp Eyes',
  ],
  unicorn: [
    'Glowing Mane',
    'Healing Aura',
    'Light Step',
    'Flower Bond',
  ],
  hostile: [
    'Battle Tested',
    'Fearless',
    'Veteran',
    'Heavy Hitter',
    'Iron Stomach',
  ],
};

function seededHash(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function pickFromPool(pool: string[], seed: number, count: number, offset = 0): string[] {
  const picked: string[] = [];
  const used = new Set<number>();
  for (let i = 0; i < count && used.size < pool.length; i++) {
    let idx = seededHash(seed, i + offset * 17) % pool.length;
    while (used.has(idx)) {
      idx = (idx + 1) % pool.length;
    }
    used.add(idx);
    picked.push(pool[idx]);
  }
  return picked;
}

export function getUnitIntrinsicGene(
  role: UnitRole,
  species: SpeciesId,
  appearanceSeed = 1,
  dinoDiet?: 'carnivore' | 'herbivore',
): string {
  const seed = Math.abs(Math.floor(appearanceSeed) || 1);
  if (role === 'dragon') {
    const variant = getDragonVariant(seed);
    return `${variant.name} Scales`;
  }
  if (role === 'unicorn') {
    return 'Magic Horn';
  }
  if (role === 'leviathan') {
    return 'Deep Sea Giant';
  }
  if (role === 'dinosaur') {
    const variant = getDinosaurVariant(seed);
    const diet = dinoDiet ?? variant.diet;
    if (diet === 'carnivore' || variant.morph === 0) {
      return 'Apex Predator';
    }
    if (variant.morph === 1) {
      return 'Horned Crest';
    }
    return 'Back Plates';
  }
  if (role === 'phoenix') {
    return 'Solar Rebirth';
  }
  if (role === 'griffin') {
    return 'Sky Sovereign';
  }
  if (role === 'yeti') {
    return 'Glacial Titan';
  }
  if (role === 'golem') {
    return 'Runestone Core';
  }
  if (role === 'kitsune') {
    return 'Nine-Tail Spirit';
  }
  if (role === 'wolf') {
    return 'Pack Hunter';
  }
  if (role === 'bear') {
    return 'Heavy Frame';
  }
  if (role === 'cow') {
    return 'Pasture Grazer';
  }
  if (role === 'pig') {
    return 'Foraging Snout';
  }
  if (role === 'chicken') {
    return 'Light Feathers';
  }
  if (role === 'capybara') {
    return 'Water Fur';
  }
  if (role === 'deer') {
    return 'Swift Antlers';
  }
  if (role === 'sheep') {
    return 'Thick Fleece';
  }
  if (role === 'rabbit') {
    return 'Spring Leap';
  }
  if (role === 'fox') {
    return 'Sly Stalker';
  }
  if (role === 'boar') {
    return 'Tusked Charger';
  }
  if (role === 'lion') {
    return 'Savanna Apex';
  }
  if (role === 'elephant') {
    return 'Ivory Giant';
  }
  if (role === 'camel') {
    return 'Desert Nomad';
  }
  if (role === 'penguin') {
    return 'Polar Swimmer';
  }
  if (role === 'crocodile') {
    return 'Armored Scales';
  }
  if (role === 'horse') {
    return 'Fast Gallop';
  }
  if (role === 'goat') {
    return 'Cliff Climber';
  }
  if (role === 'monkey') {
    return 'Tree Swinger';
  }
  if (role === 'panda') {
    return 'Bamboo Chewer';
  }
  if (role === 'polar_bear') {
    return 'Frost Coat';
  }
  if (role === 'hippo') {
    return 'River Bulk';
  }
  if (role === 'rhino') {
    return 'Armored Horn';
  }
  if (role === 'turtle') {
    return 'Hard Shell';
  }
  if (role === 'frog') {
    return 'Pond Hopper';
  }
  if (role === 'crab') {
    return 'Iron Pincers';
  }
  if (role === 'giraffe') {
    return 'Tall Neck';
  }
  if (role === 'zebra') {
    return 'Dazzle Stripes';
  }
  if (role === 'tiger') {
    return 'Jungle Stalker';
  }
  if (role === 'gorilla') {
    return 'Silverback Might';
  }
  if (role === 'kangaroo') {
    return 'Power Leap';
  }
  if (role === 'moose') {
    return 'Broad Antlers';
  }
  if (role === 'bison') {
    return 'Stampede Bulk';
  }
  if (role === 'flamingo') {
    return 'Wading Plumes';
  }
  if (role === 'ostrich') {
    return 'Sprint Stride';
  }
  if (role === 'seal') {
    return 'Arctic Blubber';
  }
  if (role === 'hydra') {
    return 'Five-Head Laser';
  }
  if (role === 'minotaur') {
    return 'Labyrinth Fury';
  }
  if (role === 'pegasus') {
    return 'Sky Wings';
  }
  if (role === 'cerberus') {
    return 'Hellhound Jaws';
  }
  if (role === 'ent') {
    return 'Living Bark';
  }
  if (role === 'basilisk') {
    return 'Petrifying Gaze';
  }
  if (role === 'thunderbird') {
    return 'Storm Caller';
  }
  if (role === 'kraken') {
    return 'Abyssal Tentacles';
  }
  if (role === 'manticore') {
    return 'Venom Tail';
  }
  if (role === 'gargoyle') {
    return 'Living Stone';
  }
  if (role === 'skeleton') {
    return 'Undead Bones';
  }
  if (role === 'alien_trooper' || role === 'alien_ufo' || role === 'alien_walker') {
    return 'Alien Armor';
  }
  if (
    role === 'raider_swarmer' ||
    role === 'raider_ranged' ||
    role === 'raider_behemoth'
  ) {
    return 'Raider Grit';
  }
  if (species === 'elf') {
    return 'Long Lived';
  }
  if (species === 'orc') {
    return 'Orc Strength';
  }
  return 'Adaptable';
}

export function isIntrinsicGene(gene: string): boolean {
  if (gene.endsWith('Scales') || gene.endsWith('Lineage')) return true;
  const INTRINSIC_SET = new Set([
    // Clean sandbox intrinsic traits
    'Adaptable',
    'Long Lived',
    'Orc Strength',
    'Magic Horn',
    'Apex Predator',
    'Horned Crest',
    'Back Plates',
    'Pack Hunter',
    'Heavy Frame',
    'Pasture Grazer',
    'Foraging Snout',
    'Light Feathers',
    'Water Fur',
    'Swift Antlers',
    'Thick Fleece',
    'Spring Leap',
    'Sly Stalker',
    'Tusked Charger',
    'Savanna Apex',
    'Ivory Giant',
    'Desert Nomad',
    'Polar Swimmer',
    'Armored Scales',
    'Solar Rebirth',
    'Sky Sovereign',
    'Glacial Titan',
    'Runestone Core',
    'Nine-Tail Spirit',
    'Fast Gallop',
    'Cliff Climber',
    'Tree Swinger',
    'Bamboo Chewer',
    'Frost Coat',
    'River Bulk',
    'Armored Horn',
    'Hard Shell',
    'Pond Hopper',
    'Iron Pincers',
    'Tall Neck',
    'Dazzle Stripes',
    'Jungle Stalker',
    'Silverback Might',
    'Power Leap',
    'Broad Antlers',
    'Stampede Bulk',
    'Wading Plumes',
    'Sprint Stride',
    'Arctic Blubber',
    'Three Heads',
    'Five-Head Laser',
    'Labyrinth Fury',
    'Sky Wings',
    'Hellhound Jaws',
    'Living Bark',
    'Petrifying Gaze',
    'Storm Caller',
    'Abyssal Tentacles',
    'Venom Tail',
    'Living Stone',
    'Raider Grit',
    'Undead Bones',
    'Alien Armor',
    'Deep Sea Giant',
    // Legacy save compatibility
    'Human Adaptability',
    'Elven Longevity',
    'Orcish Brawn',
    'Celestial Fey Horn',
    'Apex Theropod Physiology',
    'Ceratopsian Crest',
    'Dorsal Bone Plates',
    'Canine Pack Instinct',
    'Ursine Heavy Frame',
    'Ruminant Digestion',
    'Keen Foraging Snout',
    'Avian Plumage',
    'Semi-Aquatic Fur',
    'Pillager Grit',
    'Necrotic Bone Frame',
    'Xeno-Alloy Bio-Shell',
    'Adaptable Spark',
    'Armored Herbivore',
    'Prehistoric Apex',
    'Abyssal Megafauna Physiology',
  ]);
  return INTRINSIC_SET.has(gene);
}

export function generateUnitGenes(
  role: UnitRole,
  species: SpeciesId,
  appearanceSeed = 1,
  dinoDiet?: 'carnivore' | 'herbivore',
): string[] {
  const seed = Math.abs(Math.floor(appearanceSeed) || 1);
  const intrinsic = getUnitIntrinsicGene(role, species, seed, dinoDiet);
  const genes: string[] = [intrinsic];

  // Most units express only their intrinsic lineage trait.
  // ~18% chance of expressing an extra rare mutation if RNG chosen.
  const roll = seededHash(seed, 77) % 100;
  if (roll < 18) {
    let pool: string[];
    if (
      role === 'dragon' ||
      role === 'phoenix' ||
      role === 'griffin' ||
      role === 'pegasus' ||
      role === 'thunderbird' ||
      role === 'manticore' ||
      role === 'gargoyle'
    ) {
      pool = RARE_GENE_POOLS.dragon;
    } else if (role === 'unicorn' || role === 'kitsune' || role === 'ent') {
      pool = RARE_GENE_POOLS.unicorn;
    } else if (role === 'dinosaur') {
      const diet = dinoDiet ?? getDinosaurVariant(seed).diet;
      pool = diet === 'carnivore' ? RARE_GENE_POOLS.carnivore : RARE_GENE_POOLS.herbivore;
    } else if (
      role === 'wolf' ||
      role === 'bear' ||
      role === 'fox' ||
      role === 'boar' ||
      role === 'lion' ||
      role === 'tiger' ||
      role === 'gorilla' ||
      role === 'moose' ||
      role === 'bison' ||
      role === 'crocodile' ||
      role === 'polar_bear' ||
      role === 'hippo' ||
      role === 'rhino' ||
      role === 'crab' ||
      role === 'yeti' ||
      role === 'golem' ||
      role === 'hydra' ||
      role === 'minotaur' ||
      role === 'cerberus' ||
      role === 'basilisk' ||
      role === 'kraken' ||
      role === 'leviathan'
    ) {
      pool = RARE_GENE_POOLS.carnivore;
    } else if (
      role === 'cow' ||
      role === 'pig' ||
      role === 'chicken' ||
      role === 'capybara' ||
      role === 'deer' ||
      role === 'sheep' ||
      role === 'rabbit' ||
      role === 'elephant' ||
      role === 'camel' ||
      role === 'penguin' ||
      role === 'horse' ||
      role === 'goat' ||
      role === 'monkey' ||
      role === 'panda' ||
      role === 'turtle' ||
      role === 'frog' ||
      role === 'giraffe' ||
      role === 'zebra' ||
      role === 'kangaroo' ||
      role === 'flamingo' ||
      role === 'ostrich' ||
      role === 'seal'
    ) {
      pool = RARE_GENE_POOLS.herbivore;
    } else if (
      role === 'raider_swarmer' ||
      role === 'raider_ranged' ||
      role === 'raider_behemoth' ||
      role === 'skeleton' ||
      role === 'alien_trooper' ||
      role === 'alien_ufo' ||
      role === 'alien_walker'
    ) {
      pool = RARE_GENE_POOLS.hostile;
    } else if (species === 'elf') {
      pool = RARE_GENE_POOLS.elf;
    } else if (species === 'orc') {
      pool = RARE_GENE_POOLS.orc;
    } else {
      pool = RARE_GENE_POOLS.civilization;
    }

    // Ultra-rare individuals (~2% chance) express a second mutation, otherwise 1
    const count = roll < 2 ? 2 : 1;
    const rareGenes = pickFromPool(pool, seed, count, 7);
    genes.push(...rareGenes);
  }

  return genes;
}

export function generateUnitItems(
  role: UnitRole,
  species: SpeciesId,
  epochIndex: number,
  appearanceSeed = 1,
  dinoDiet?: 'carnivore' | 'herbivore',
): string[] {
  const seed = Math.abs(Math.floor(appearanceSeed) || 1);
  const tier = Math.max(0, Math.min(5, epochIndex));

  if (role === 'dragon') {
    const variant = getDragonVariant(seed);
    return [`${variant.name} Scales`, 'Horn Crest', 'Flame Gland'];
  }
  if (role === 'unicorn') {
    return ['Ivory Horn', 'Flower Wreath', 'Silver Hooves'];
  }
  if (role === 'leviathan') {
    return ['Giant Jaws', 'Thick Sea Hide', 'Deep Sea Fins'];
  }
  if (role === 'dinosaur') {
    const info = getDinosaurVariant(seed);
    const diet = dinoDiet ?? info.diet;
    if (diet === 'carnivore') {
      return ['Sharp Fangs', 'Tough Hide'];
    }
    return info.morph === 1
      ? ['Three-Horned Shield', 'Plant Pouch']
      : ['Back Plates', 'Spiked Tail'];
  }
  if (role === 'phoenix') return ['Ember Plumes', 'Solar Heart', 'Rebirth Ash'];
  if (role === 'griffin') return ['Golden Talons', 'Sky Pinions', 'Royal Crest'];
  if (role === 'yeti') return ['Frost Hide', 'Glacier Horns', 'Frozen Claws'];
  if (role === 'golem') return ['Rune Core', 'Ancient Granite', 'Mossy Plate'];
  if (role === 'kitsune') return ['Spirit Bell', 'Foxfire Orb', 'Mystic Silk'];
  if (role === 'wolf') return ['Sharp Fangs', 'Winter Fur'];
  if (role === 'bear') return ['Heavy Claws', 'Wild Honeycomb'];
  if (role === 'cow') return ['Pasture Bell', 'Clover Bundle'];
  if (role === 'pig') return ['Truffle Snout', 'Muddy Coat'];
  if (role === 'chicken') return ['Feathers', 'Wild Seeds'];
  if (role === 'capybara') return ['River Reed', 'Sweet Fruit'];
  if (role === 'deer') return ['Velvet Antlers', 'Forest Moss'];
  if (role === 'sheep') return ['Soft Wool', 'Meadow Bell'];
  if (role === 'rabbit') return ['Lucky Paw', 'Wild Carrot'];
  if (role === 'fox') return ['Russet Brush', 'Forest Berries'];
  if (role === 'boar') return ['Curved Tusks', 'Bristled Hide'];
  if (role === 'lion') return ['Golden Mane', 'Savanna Fang'];
  if (role === 'elephant') return ['Ivory Tusks', 'Acacia Branch'];
  if (role === 'camel') return ['Desert Saddle', 'Water Flask'];
  if (role === 'penguin') return ['Ice Pebble', 'Silver Fish'];
  if (role === 'crocodile') return ['Armored Scale', 'River Fang'];
  if (role === 'horse') return ['Iron Horseshoe', 'Oat Bundle'];
  if (role === 'goat') return ['Mountain Horn', 'Alpine Grass'];
  if (role === 'monkey') return ['Ripe Banana', 'Jungle Vine'];
  if (role === 'panda') return ['Bamboo Stalk', 'Soft Fur'];
  if (role === 'polar_bear') return ['Arctic Pelt', 'Frost Claw'];
  if (role === 'hippo') return ['River Tusk', 'Thick Hide'];
  if (role === 'rhino') return ['Heavy Horn', 'Plated Hide'];
  if (role === 'turtle') return ['Green Shell', 'Sea Kelp'];
  if (role === 'frog') return ['Lily Pad', 'Swamp Moss'];
  if (role === 'crab') return ['Red Claw', 'Sea Shell'];
  if (role === 'giraffe') return ['Acacia Leaf', 'Spotted Pelt'];
  if (role === 'zebra') return ['Striped Hide', 'Plains Grass'];
  if (role === 'tiger') return ['Striped Pelt', 'Razor Fang'];
  if (role === 'gorilla') return ['Jungle Fruit', 'Silver Fur'];
  if (role === 'kangaroo') return ['Spring Tendon', 'Red Fur'];
  if (role === 'moose') return ['Broad Antler', 'Pine Bark'];
  if (role === 'bison') return ['Shaggy Wool', 'Heavy Horn'];
  if (role === 'flamingo') return ['Pink Feather', 'Brine Shrimp'];
  if (role === 'ostrich') return ['Plume Feather', 'Large Egg'];
  if (role === 'seal') return ['Silver Fish', 'Thick Blubber'];
  if (role === 'hydra') return ['Laser Gland', 'Regen Scale', 'Serpent Fang'];
  if (role === 'minotaur') return ['Bronze Axe', 'Bull Horn', 'War Belt'];
  if (role === 'pegasus') return ['Sky Feather', 'Golden Hoof', 'Cloud Mane'];
  if (role === 'cerberus') return ['Ember Fang', 'Lava Collar', 'Ash Pelt'];
  if (role === 'ent') return ['Heartwood', 'Ancient Acorn', 'Living Moss'];
  if (role === 'basilisk') return ['Stone Eye', 'Venom Fang', 'Golden Crest'];
  if (role === 'thunderbird') return ['Storm Feather', 'Arc Talon', 'Cloud Crest'];
  if (role === 'kraken') return ['Sucker Tentacle', 'Ink Sac', 'Abyssal Beak'];
  if (role === 'manticore') return ['Venom Stinger', 'Crimson Mane', 'Bat Wing'];
  if (role === 'gargoyle') return ['Carved Granite', 'Stone Wing', 'Mossy Horn'];

  if (role === 'raider_swarmer') return ['Iron Cleaver', 'Loot Bag'];
  if (role === 'raider_ranged') return ['Hunting Bow', 'Arrow Quiver'];
  if (role === 'raider_behemoth') return ['Heavy Club', 'Spiked Armor'];
  if (role === 'skeleton') return ['Rusty Sword', 'Dark Bone Shard'];
  if (role === 'alien_trooper') return ['Plasma Rifle', 'Radio Beacon'];
  if (role === 'alien_ufo') return ['UFO Reactor', 'Tractor Beam'];
  if (role === 'alien_walker') return ['Twin Lasers', 'Heavy Leg Armor'];

  const materialPrefix = [
    'Stone',
    'Bronze',
    'Steel',
    'Iron',
    'Alloy',
    'Laser',
  ][tier];
  const trinketPool =
    species === 'elf'
      ? ['Forest Cloak', 'Sun Charm', 'Silver Flute']
      : species === 'orc'
        ? ['Bone Charm', 'War Horn', 'Iron Flask']
        : ['Travel Bag', 'Wood Token', 'Pocket Compass'];
  const trinket = trinketPool[seededHash(seed, 9) % trinketPool.length];

  if (role === 'warrior') {
    const weapon =
      tier >= 5
        ? 'Laser Rifle'
        : tier >= 4
          ? 'Assault Rifle'
          : tier >= 3
            ? 'Musket'
            : `${materialPrefix} Spear`;
    return [weapon, `${materialPrefix} Shield`, trinket];
  }
  if (role === 'builder') {
    const tool = tier >= 4 ? 'Power Welder' : `${materialPrefix} Hammer`;
    return [tool, 'Build Plans', trinket];
  }
  if (role === 'forager') {
    return [`${materialPrefix} Sickle`, 'Berry Basket', trinket];
  }
  if (role === 'miner') {
    const pick = tier >= 4 ? 'Laser Drill' : `${materialPrefix} Pickaxe`;
    return [pick, 'Mining Lamp', trinket];
  }
  if (role === 'astro_engineer') {
    return ['Alloy Wrench', 'Data Pad', trinket];
  }
  if (role === 'scholar') {
    const focus = tier >= 4 ? 'Data Tablet' : 'Compass';
    return [focus, 'Note Book', trinket];
  }
  if (role === 'priest') {
    return ['Wooden Staff', 'Prayer Scroll', trinket];
  }

  const civicTool = tier >= 4 ? 'Tool Kit' : `${materialPrefix} Tools`;
  return [civicTool, trinket];
}

function getDietInfo(unit: UnitEntity): EntityDietInfo {
  switch (unit.role) {
    case 'dragon':
      return {
        category: 'Fire Carnivore',
        detail: 'Flying predator that hunts livestock, units, and towns',
      };
    case 'unicorn':
      return {
        category: 'Forest Herbivore',
        detail: 'Grazer of flowers, meadow grass, and berries',
      };
    case 'leviathan':
      return {
        category: 'Sea Predator',
        detail: 'Swims through deep water and surfaces to hunt ships and swimmers',
      };
    case 'dinosaur': {
      const dino = getDinosaurVariant(unit.appearanceSeed);
      if (dino.diet === 'carnivore') {
        return {
          category: 'Carnivore',
          detail: 'Hunts herbivores, wildlife, and nearby units',
        };
      }
      return {
        category: 'Herbivore',
        detail: 'Eats ferns, berries, and leaves; runs from predators',
      };
    }
    case 'wolf':
      return {
        category: 'Carnivore',
        detail: 'Pack hunter that chases livestock and small animals',
      };
    case 'bear':
      return {
        category: 'Carnivore',
        detail: 'Strong predator that hunts wildlife and guards its territory',
      };
    case 'cow':
      return {
        category: 'Herbivore',
        detail: 'Grazes on meadow grass, wheat, and clover',
      };
    case 'pig':
      return {
        category: 'Herbivore',
        detail: 'Forages for roots, berries, and acorns',
      };
    case 'chicken':
      return {
        category: 'Herbivore',
        detail: 'Pecks grain, seeds, and berries',
      };
    case 'capybara':
      return {
        category: 'Herbivore',
        detail: 'Peaceful river grazer that eats reeds and berries',
      };
    case 'deer':
      return {
        category: 'Forest Herbivore',
        detail: 'Eats forest grass, shoots, and berries',
      };
    case 'sheep':
      return {
        category: 'Herbivore',
        detail: 'Grazes on meadow grass and clover',
      };
    case 'rabbit':
      return {
        category: 'Herbivore',
        detail: 'Eats clover, flowers, and wild herbs',
      };
    case 'fox':
      return {
        category: 'Carnivore',
        detail: 'Hunts rabbits and chickens, and snacks on berries',
      };
    case 'boar':
      return {
        category: 'Omnivore',
        detail: 'Roots up mushrooms and acorns; charges when provoked',
      };
    case 'lion':
      return {
        category: 'Carnivore',
        detail: 'Hunts large prey across open plains and savannas',
      };
    case 'elephant':
      return {
        category: 'Herbivore',
        detail: 'Eats tree leaves and grass; fights back hard if threatened',
      };
    case 'camel':
      return {
        category: 'Herbivore',
        detail: 'Eats desert scrub and oasis plants',
      };
    case 'penguin':
      return {
        category: 'Sea Predator',
        detail: 'Catches fish along snowy coasts and ice sheets',
      };
    case 'crocodile':
      return {
        category: 'Sea Predator',
        detail: 'Waits in swamps and shallows to ambush anything that walks by',
      };
    case 'horse':
      return {
        category: 'Herbivore',
        detail: 'Grazes on open grass and gallops away from predators',
      };
    case 'goat':
      return {
        category: 'Herbivore',
        detail: 'Eats mountain grass and shrubs on steep hills',
      };
    case 'monkey':
      return {
        category: 'Forager',
        detail: 'Eats jungle fruit, nuts, and berries',
      };
    case 'panda':
      return {
        category: 'Forest Herbivore',
        detail: 'Chews on bamboo shoots and forest leaves all day',
      };
    case 'polar_bear':
      return {
        category: 'Carnivore',
        detail: 'Hunts penguins and anything else on snow and sea ice',
      };
    case 'hippo':
      return {
        category: 'Herbivore',
        detail: 'Eats river grass but attacks anyone who gets too close',
      };
    case 'rhino':
      return {
        category: 'Herbivore',
        detail: 'Eats savanna grass and charges threats head-on',
      };
    case 'turtle':
      return {
        category: 'Herbivore',
        detail: 'Eats beach grass, reeds, and shallow sea plants',
      };
    case 'frog':
      return {
        category: 'Forager',
        detail: 'Catches bugs around swamps and shallow ponds',
      };
    case 'crab':
      return {
        category: 'Omnivore',
        detail: 'Scavenges along sandy beaches and shallow tides',
      };
    case 'giraffe':
      return {
        category: 'Herbivore',
        detail: 'Nibbles tall treetop leaves across sunny plains and savannas',
      };
    case 'zebra':
      return {
        category: 'Herbivore',
        detail: 'Grazes in open herds and sprints away when predators get close',
      };
    case 'tiger':
      return {
        category: 'Carnivore',
        detail: 'Striped jungle hunter that stalks prey through thick woods',
      };
    case 'gorilla':
      return {
        category: 'Forager',
        detail: 'Eats jungle fruit and shoots, then slams anyone who picks a fight',
      };
    case 'kangaroo':
      return {
        category: 'Herbivore',
        detail: 'Bounds over dry scrubland and kicks back if cornered',
      };
    case 'moose':
      return {
        category: 'Forest Herbivore',
        detail: 'Browses cold pine woods and charges wolves with wide antlers',
      };
    case 'bison':
      return {
        category: 'Herbivore',
        detail: 'Grazes on open grass and bowls over attackers in heavy charges',
      };
    case 'flamingo':
      return {
        category: 'Sea Predator',
        detail: 'Wades through shallow coastal water sifting for tiny shrimp',
      };
    case 'ostrich':
      return {
        category: 'Herbivore',
        detail: 'Pecks seeds and desert plants, then outruns nearly every hunter',
      };
    case 'seal':
      return {
        category: 'Sea Predator',
        detail: 'Catches fish around icy shores and naps on floating sea ice',
      };
    case 'phoenix':
      return {
        category: 'Fire Carnivore',
        detail: 'Flies overhead, shoots flame balls, heals allies, and rises once from ashes',
      };
    case 'griffin':
      return {
        category: 'Carnivore',
        detail: 'Dives from the sky and blasts enemies back with heavy wing gusts',
      };
    case 'yeti':
      return {
        category: 'Carnivore',
        detail: 'Lives on snowy peaks and hurls blocky ice balls that freeze foes',
      };
    case 'golem':
      return {
        category: 'Omnivore',
        detail: 'Shrugs off half of incoming hits and slams the ground with seismic shockwaves',
      };
    case 'kitsune':
      return {
        category: 'Forager',
        detail: 'Blesses friendly units, blinks out of melee range, and fires flame balls back',
      };
    case 'hydra':
      return {
        category: 'Sea Predator',
        detail: 'Five-headed sea serpent that fires green bio-laser beams and regenerates wounds',
      };
    case 'minotaur':
      return {
        category: 'Carnivore',
        detail: 'Charges in with a bull rush and swings a heavy bronze axe through crowds',
      };
    case 'pegasus':
      return {
        category: 'Forest Herbivore',
        detail: 'Soars over meadows, heals friendly creatures, and knocks foes away with gale gusts',
      };
    case 'cerberus':
      return {
        category: 'Fire Carnivore',
        detail: 'Ignores fire completely and fires triple hellfire balls that scorch the ground',
      };
    case 'ent':
      return {
        category: 'Forest Herbivore',
        detail: 'Disguises itself as a normal oak tree until enemies get close, then ambushes them',
      };
    case 'basilisk':
      return {
        category: 'Carnivore',
        detail: 'Crowned desert serpent whose glowing laser gaze turns targets to solid stone',
      };
    case 'thunderbird':
      return {
        category: 'Carnivore',
        detail: 'Giant storm eagle that calls lightning bolts down and chains shocks across foes',
      };
    case 'kraken':
      return {
        category: 'Sea Predator',
        detail: 'Swims deep ocean waters, slams enemies with wide tentacles, and blinds them in ink',
      };
    case 'manticore':
      return {
        category: 'Carnivore',
        detail: 'Bat-winged crimson beast that fires twin poisoned tail spikes from the air',
      };
    case 'gargoyle':
      return {
        category: 'Omnivore',
        detail: 'Perches as a hard stone statue to heal fast, then wakes up to dive-slam intruders',
      };
    case 'raider_swarmer':
    case 'raider_ranged':
    case 'raider_behemoth':
      return {
        category: 'Carnivore',
        detail: 'Lives on stolen rations and roasted meat',
      };
    case 'skeleton':
      return {
        category: 'Sea Predator',
        detail: 'Kept alive by dark portal magic',
      };
    case 'alien_trooper':
    case 'alien_ufo':
    case 'alien_walker':
      return {
        category: 'Sea Predator',
        detail: 'Powered by alien energy cells',
      };
    default: {
      if (unit.species === 'elf') {
        return {
          category: 'Forager',
          detail: 'Orchard fruit, bread, and forest berries',
        };
      }
      if (unit.species === 'orc') {
        return {
          category: 'Carnivore',
          detail: 'Roasted meat and camp rations',
        };
      }
      return {
        category: 'Omnivore',
        detail: 'Bread, fruit, and cooked meat',
      };
    }
  }
}

function getSubtitleAndFaction(
  unit: UnitEntity,
): { subtitle: string; factionLabel: EntityInspectProfile['factionLabel'] } {
  const def = UNITS.find((d) => d.role === unit.role);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  if (unit.role === 'dragon') {
    const variant = getDragonVariant(unit.appearanceSeed);
    return { subtitle: `${variant.name} Dragon`, factionLabel: 'Mythical' };
  }
  if (unit.role === 'unicorn') {
    return { subtitle: 'Unicorn', factionLabel: 'Mythical' };
  }
  if (unit.role === 'leviathan') {
    return { subtitle: 'Leviathan', factionLabel: 'Mythical' };
  }
  if (
    unit.role === 'phoenix' ||
    unit.role === 'griffin' ||
    unit.role === 'yeti' ||
    unit.role === 'golem' ||
    unit.role === 'kitsune' ||
    unit.role === 'hydra' ||
    unit.role === 'minotaur' ||
    unit.role === 'pegasus' ||
    unit.role === 'cerberus' ||
    unit.role === 'ent' ||
    unit.role === 'basilisk' ||
    unit.role === 'thunderbird' ||
    unit.role === 'kraken' ||
    unit.role === 'manticore' ||
    unit.role === 'gargoyle'
  ) {
    return { subtitle: def?.name ?? cap(unit.role), factionLabel: 'Mythical' };
  }
  if (unit.role === 'dinosaur') {
    const dino = getDinosaurVariant(unit.appearanceSeed);
    return { subtitle: dino.speciesName, factionLabel: 'Wildlife' };
  }
  if (unit.faction === 'wildlife') {
    return { subtitle: def?.name ?? cap(unit.role), factionLabel: 'Wildlife' };
  }
  if (unit.faction === 'hostile') {
    return { subtitle: def?.name ?? cap(unit.role), factionLabel: 'Hostile' };
  }
  const speciesLabel = cap(unit.species);
  if (unit.isKing) {
    return {
      subtitle: `${speciesLabel} King`,
      factionLabel: 'Civilization',
    };
  }
  const roleLabel =
    unit.ageStage === 'child'
      ? 'Child'
      : def?.name && def.name.toLowerCase() !== unit.species
        ? def.name
        : 'Citizen';
  return { subtitle: `${speciesLabel} ${roleLabel}`, factionLabel: 'Civilization' };
}

function formatActivity(unit: UnitEntity): string {
  if (unit.state === 'ko') return 'Defeated';
  if (unit.role === 'ent' && unit.treantDisguised) return 'Disguised as Tree';
  if (unit.role === 'gargoyle' && unit.gargoylePetrified) return 'Stone Statue';

  const isFlyer =
    unit.role === 'dragon' ||
    unit.role === 'phoenix' ||
    unit.role === 'griffin' ||
    unit.role === 'pegasus' ||
    unit.role === 'thunderbird' ||
    unit.role === 'manticore' ||
    unit.role === 'gargoyle';
  switch (unit.state) {
    case 'fighting':
      if (unit.role === 'dragon') return 'Breathing Fire';
      if (unit.role === 'phoenix' || unit.role === 'kitsune' || unit.role === 'cerberus') {
        return 'Shooting Flame Balls';
      }
      if (unit.role === 'yeti') return 'Throwing Ice';
      if (unit.role === 'hydra') return 'Firing Bio-Laser';
      if (unit.role === 'basilisk') return 'Petrifying Gaze';
      if (unit.role === 'thunderbird') return 'Calling Lightning';
      if (unit.role === 'kraken') return 'Whipping Tentacles';
      if (unit.role === 'manticore') return 'Firing Tail Spikes';
      if (unit.role === 'golem' || unit.role === 'ent') return 'Smashing';
      if (unit.role === 'minotaur') return 'Bull Rush';
      if (unit.role === 'griffin' || unit.role === 'gargoyle') return 'Diving';
      if (unit.role === 'pegasus') return 'Wing Gust';
      return 'Fighting';
    case 'gathering':
      return unit.faction === 'wildlife' ? 'Grazing' : 'Gathering';
    case 'building':
      return 'Building';
    case 'praying':
      return 'Praying';
    case 'researching':
      return 'Researching';
    case 'moving':
      if (isFlyer) return 'Flying';
      if (unit.role === 'kraken' || unit.role === 'seal' || unit.role === 'leviathan') return 'Swimming';
      if (unit.role === 'penguin') return 'Waddling';
      if (unit.role === 'frog' || unit.role === 'rabbit' || unit.role === 'kangaroo') return 'Hopping';
      if (unit.role === 'crab') return 'Scuttling';
      return 'Walking';
    default:
      return isFlyer ? 'Soaring' : 'Idle';
  }
}

function getAgeStageLabel(unit: UnitEntity): string {
  if (
    unit.role === 'dragon' ||
    unit.role === 'phoenix' ||
    unit.role === 'kitsune' ||
    unit.role === 'thunderbird' ||
    unit.role === 'manticore'
  ) {
    return 'Elder';
  }
  if (unit.role === 'golem' || unit.role === 'ent' || unit.role === 'gargoyle') return 'Ancient';
  if (
    unit.role === 'unicorn' ||
    unit.role === 'griffin' ||
    unit.role === 'pegasus' ||
    unit.role === 'cerberus'
  ) {
    return 'Adult';
  }
  if (
    unit.role === 'leviathan' ||
    unit.role === 'yeti' ||
    unit.role === 'hydra' ||
    unit.role === 'minotaur' ||
    unit.role === 'basilisk' ||
    unit.role === 'kraken'
  ) {
    return 'Giant';
  }
  if (unit.ageStage === 'child') return 'Child';
  if (unit.faction === 'wildlife') return 'Adult';
  return 'Adult';
}

export function getEntityInspectProfile(
  state: SimulationState,
  unit: UnitEntity,
): EntityInspectProfile {
  const def = UNITS.find((d) => d.role === unit.role);
  const dinoDiet =
    unit.role === 'dinosaur' ? getDinosaurVariant(unit.appearanceSeed).diet : undefined;
  const { subtitle, factionLabel } = getSubtitleAndFaction(unit);

  const baseItems =
    unit.items && unit.items.length > 0
      ? unit.items
      : generateUnitItems(
          unit.role,
          unit.species,
          state.epochIndex,
          unit.appearanceSeed,
          dinoDiet,
        );
  const cargoLabel =
    unit.carryingAmount > 0 && unit.carryingType
      ? `Carrying ${Math.max(1, Math.round(unit.carryingAmount))} ${unit.carryingType.charAt(0).toUpperCase() + unit.carryingType.slice(1)}`
      : null;
  const items = cargoLabel ? [cargoLabel, ...baseItems] : [...baseItems];

  const genes =
    unit.genes && unit.genes.length > 0
      ? [...unit.genes]
      : generateUnitGenes(unit.role, unit.species, unit.appearanceSeed, dinoDiet);

  const activeEffects = (Object.keys(unit.statusEffects) as UnitStatusEffect[]).filter(
    (k) => (unit.statusEffects[k] ?? 0) > 0,
  );

  const attackMult = unit.statusEffects.frenzied ? 1.45 : unit.statusEffects.blessed ? 1.2 : 1;
  const speedMult = unit.statusEffects.frozen
    ? 0.08
    : unit.statusEffects.frenzied
      ? 1.35
      : unit.statusEffects.cursed || unit.statusEffects.plagued
        ? 0.78
        : 1;

  const baseAtk = def?.attackDamage ?? 8;
  const baseRng = def?.attackRange ?? 1.2;
  const baseSpd = def?.speed ?? 2.2;
  const ageMult = unit.ageStage === 'child' ? 0.75 : 1;

  const settlementName =
    unit.settlementId && state.settlementNames?.[unit.settlementId]
      ? state.settlementNames[unit.settlementId]
      : null;

  const ageYears = Math.max(
    0,
    Math.floor(unit.ageYears ?? (state.year - (unit.bornYear ?? state.year))),
  );
  const immortal = state.worldRules?.immortalEntities === true;
  const maxLifespan = immortal ? null : getUnitMaxLifespan({
    role: unit.role,
    species: unit.species,
    appearanceSeed: unit.appearanceSeed,
    genes,
    maxLifespan: unit.maxLifespan,
  });
  const maxHp = Math.max(1, Math.round(unit.maxHp));
  const hp = Math.max(0, Math.round(unit.hp));

  return {
    id: unit.id,
    name: unit.name,
    subtitle,
    factionLabel,
    diet: getDietInfo(unit),
    informations: {
      hp,
      maxHp,
      hpPercent: Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100))),
      ageStageLabel: getAgeStageLabel(unit),
      ageYears,
      maxLifespan,
      immortal,
      settlementName,
      activity: formatActivity(unit),
      attackDamage: Math.round(baseAtk * attackMult * ageMult),
      attackRange: Number(baseRng.toFixed(1)),
      speed: Number((baseSpd * speedMult).toFixed(1)),
      statusEffects: activeEffects,
      breathCooldown:
        unit.role === 'dragon'
          ? Number(Math.max(0, unit.dragonBreathCooldown ?? 0).toFixed(1))
          : null,
      tileX: Math.round(unit.x),
      tileZ: Math.round(unit.z),
    },
    items,
    genes,
    favorite: Boolean(unit.favorite),
  };
}

export function toggleUnitFavorite(state: SimulationState, unitId: string): boolean {
  const target = state.units.find((u) => u.id === unitId && u.state !== 'ko');
  if (!target) return false;
  target.favorite = !target.favorite;
  return Boolean(target.favorite);
}

export function getEpochMaterialLabel(epochIndex: number): string {
  return EPOCHS[epochIndex]?.name ?? 'Stone Age';
}
