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
    if (role === 'dragon') {
      pool = RARE_GENE_POOLS.dragon;
    } else if (role === 'unicorn') {
      pool = RARE_GENE_POOLS.unicorn;
    } else if (role === 'dinosaur') {
      const diet = dinoDiet ?? getDinosaurVariant(seed).diet;
      pool = diet === 'carnivore' ? RARE_GENE_POOLS.carnivore : RARE_GENE_POOLS.herbivore;
    } else if (role === 'wolf' || role === 'bear') {
      pool = RARE_GENE_POOLS.carnivore;
    } else if (role === 'cow' || role === 'pig' || role === 'chicken' || role === 'capybara') {
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
  if (role === 'wolf') return ['Sharp Fangs', 'Winter Fur'];
  if (role === 'bear') return ['Heavy Claws', 'Wild Honeycomb'];
  if (role === 'cow') return ['Pasture Bell', 'Clover Bundle'];
  if (role === 'pig') return ['Truffle Snout', 'Muddy Coat'];
  if (role === 'chicken') return ['Feathers', 'Wild Seeds'];
  if (role === 'capybara') return ['River Reed', 'Sweet Fruit'];

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
    return {
      subtitle: unit.leviathanSubmerged ? 'Leviathan (Underwater)' : 'Leviathan (Surfaced)',
      factionLabel: 'Mythical',
    };
  }
  if (unit.role === 'dinosaur') {
    const dino = getDinosaurVariant(unit.appearanceSeed);
    return {
      subtitle: `${dino.speciesName} • ${dino.diet === 'carnivore' ? 'Carnivore' : 'Herbivore'}`,
      factionLabel: 'Wildlife',
    };
  }
  if (unit.faction === 'wildlife') {
    return { subtitle: `${def?.name ?? cap(unit.role)} • Wildlife`, factionLabel: 'Wildlife' };
  }
  if (unit.faction === 'hostile') {
    return { subtitle: `${def?.name ?? cap(unit.role)} • Hostile`, factionLabel: 'Hostile' };
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
  switch (unit.state) {
    case 'fighting':
      return unit.role === 'dragon' ? 'Breathing Fire' : 'Fighting';
    case 'gathering':
      return unit.faction === 'wildlife' ? 'Grazing' : 'Gathering';
    case 'building':
      return 'Building';
    case 'praying':
      return 'Praying';
    case 'researching':
      return 'Researching';
    case 'moving':
      return unit.role === 'dragon' ? 'Flying' : 'Walking';
    case 'ko':
      return 'Defeated';
    default:
      return unit.role === 'dragon' ? 'Flying' : 'Idle';
  }
}

function getAgeStageLabel(unit: UnitEntity): string {
  if (unit.role === 'dragon') return 'Elder';
  if (unit.role === 'unicorn') return 'Adult';
  if (unit.role === 'leviathan') return 'Giant';
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
