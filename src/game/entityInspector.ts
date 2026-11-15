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
  | 'Pyro-Carnivore'
  | 'Fey Herbivore'
  | 'Omnivore'
  | 'Botanical Omnivore';

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
    'Iron Lung',
    'Keen Horizon Sight',
    'Nimble Stride',
    'Hardy Constitution',
    'Swift Hands',
    'Photographic Recall',
    'Resilient Spirit',
    'Storied Ancestry',
  ],
  elf: [
    'Fey Sight',
    'Whispering Stride',
    'Starleaf Resonance',
    'Moonlit Grace',
  ],
  orc: [
    'Berserker Heart',
    'Iron Skull',
    'Unyielding Sinew',
    'Crag-Hide',
  ],
  herbivore: [
    'Albino Coat',
    'Hyper-Vigilance',
    'Thick Winter Pelt',
    'Fleet-Footed',
    'Alpha Stature',
    'Dense Bone Density',
  ],
  carnivore: [
    'Bone-Crusher Jaw',
    'Serrated Dentition',
    'Hyper-Predatory Scent',
    'Nightstalker Vision',
    'Relentless Pursuit',
    'Armored Pelt',
  ],
  dragon: [
    'Pyroclast Gland',
    'Ancient Wyrmblood',
    'Volcanic Heart',
    'Thermic Wingbeat',
    'Sky-Sovereign Gaze',
  ],
  unicorn: [
    'Starlight Mane',
    'Aether Resonance',
    'Moonbound Stride',
    'Blossom Affinity',
  ],
  hostile: [
    'Battle-Hardened',
    'Frenzied Nerve',
    'Scarred Veteran',
    'Brutal Might',
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
    return 'Celestial Fey Horn';
  }
  if (role === 'dinosaur') {
    const variant = getDinosaurVariant(seed);
    const diet = dinoDiet ?? variant.diet;
    if (diet === 'carnivore' || variant.morph === 0) {
      return 'Apex Theropod Physiology';
    }
    if (variant.morph === 1) {
      return 'Ceratopsian Crest';
    }
    return 'Dorsal Bone Plates';
  }
  if (role === 'wolf') {
    return 'Canine Pack Instinct';
  }
  if (role === 'bear') {
    return 'Ursine Heavy Frame';
  }
  if (role === 'cow') {
    return 'Ruminant Digestion';
  }
  if (role === 'pig') {
    return 'Keen Foraging Snout';
  }
  if (role === 'chicken') {
    return 'Avian Plumage';
  }
  if (role === 'capybara') {
    return 'Semi-Aquatic Fur';
  }
  if (
    role === 'raider_swarmer' ||
    role === 'raider_ranged' ||
    role === 'raider_behemoth'
  ) {
    return 'Pillager Grit';
  }
  if (species === 'elf') {
    return 'Elven Longevity';
  }
  if (species === 'orc') {
    return 'Orcish Brawn';
  }
  return 'Human Adaptability';
}

export function isIntrinsicGene(gene: string): boolean {
  if (gene.endsWith('Scales') || gene.endsWith('Lineage')) return true;
  const INTRINSIC_SET = new Set([
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
    'Adaptable Spark',
    'Armored Herbivore',
    'Prehistoric Apex',
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
      role === 'raider_behemoth'
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
    return [`${variant.name} Scales`, 'Ember Crown Crest', 'Molten Flame Sac'];
  }
  if (role === 'unicorn') {
    return ['Spiraled Ivory Horn', 'Aether Garland', 'Dewdrop Hooves'];
  }
  if (role === 'dinosaur') {
    const info = getDinosaurVariant(seed);
    const diet = dinoDiet ?? info.diet;
    if (diet === 'carnivore') {
      return ['Tyrant Fangs', 'Thick Osteoderms'];
    }
    return info.morph === 1
      ? ['Tri-Horned Frill', 'Herbaceous Pouches']
      : ['Dorsal Bone Plates', 'Thagomizer Tail'];
  }
  if (role === 'wolf') return ['Razor Fangs', 'Dense Winter Coat'];
  if (role === 'bear') return ['Heavy Claws', 'Wild Honeycomb'];
  if (role === 'cow') return ['Brass Pasture Bell', 'Clover Tuft'];
  if (role === 'pig') return ['Truffle Snout', 'Mud Coat'];
  if (role === 'chicken') return ['Speckled Plume', 'Foraged Seeds'];
  if (role === 'capybara') return ['Yuzu Citrus', 'River Reed Crown'];

  if (role === 'raider_swarmer') return ['Jagged Cleaver', 'Plundered Pouch'];
  if (role === 'raider_ranged') return ['Recurve Warbow', 'Barbed Quiver'];
  if (role === 'raider_behemoth') return ['Siege Maul', 'Spiked Pauldrons'];

  const materialPrefix = [
    'Flint',
    'Bronze',
    'Tempered Steel',
    'Brasswork',
    'Carbon-Alloy',
    'Quantum',
  ][tier];
  const trinketPool =
    species === 'elf'
      ? ['Starleaf Cloak', 'Sunstone Charm', 'Silver Whistle']
      : species === 'orc'
        ? ['Bone Talisman', 'War-Horn', 'Iron Flask']
        : ['Traveler’s Satchel', 'Hearth Token', 'Compass Locket'];
  const trinket = trinketPool[seededHash(seed, 9) % trinketPool.length];

  if (role === 'warrior') {
    const weapon =
      tier >= 5
        ? 'Plasma Lance'
        : tier >= 4
          ? 'Pulse Carbine'
          : tier >= 3
            ? 'Rifled Musket'
            : `${materialPrefix} Halberd`;
    return [weapon, `${materialPrefix} Buckler`, trinket];
  }
  if (role === 'builder') {
    const tool = tier >= 4 ? 'Servo Welder' : `${materialPrefix} Hammer`;
    return [tool, 'Surveyor’s Blueprint', trinket];
  }
  if (role === 'forager') {
    return [`${materialPrefix} Sickle`, 'Woven Herb Basket', trinket];
  }
  if (role === 'miner') {
    const pick = tier >= 4 ? 'Plasma Drill' : `${materialPrefix} Pickaxe`;
    return [pick, 'Lantern Helmet', trinket];
  }
  if (role === 'astro_engineer') {
    return ['Orbital Plasma Wrench', 'Star-Nav Pad', trinket];
  }
  if (role === 'scholar') {
    const focus = tier >= 4 ? 'Holo-Slate' : 'Star Astrolabe';
    return [focus, 'Field Codex', trinket];
  }
  if (role === 'priest') {
    return ['Sacred Censer', 'Sun-Script Scroll', trinket];
  }

  const civicTool = tier >= 4 ? 'Multi-Tool Kit' : `${materialPrefix} Pick & Sickle`;
  return [civicTool, trinket];
}

function getDietInfo(unit: UnitEntity): EntityDietInfo {
  switch (unit.role) {
    case 'dragon':
      return {
        category: 'Pyro-Carnivore',
        detail: 'Apex aerial predator — hunts livestock, warriors & structures',
      };
    case 'unicorn':
      return {
        category: 'Fey Herbivore',
        detail: 'Starlight blossoms, pure meadows & crystal springs',
      };
    case 'dinosaur': {
      const dino = getDinosaurVariant(unit.appearanceSeed);
      if (dino.diet === 'carnivore') {
        return {
          category: 'Carnivore',
          detail: 'Hunts herbivore beasts, wildlife & wandering units',
        };
      }
      return {
        category: 'Herbivore',
        detail: 'Grazes ferns, berries & wild forest foliage; flees predators',
      };
    }
    case 'wolf':
      return {
        category: 'Carnivore',
        detail: 'Pack hunter — stalks small livestock, deer & raiders',
      };
    case 'bear':
      return {
        category: 'Carnivore',
        detail: 'Territorial predator — hunts wildlife & defends dens',
      };
    case 'cow':
      return {
        category: 'Herbivore',
        detail: 'Grazes lush grass, wheat & meadow clover',
      };
    case 'pig':
      return {
        category: 'Herbivore',
        detail: 'Forages roots, forest berries & fallen acorns',
      };
    case 'chicken':
      return {
        category: 'Herbivore',
        detail: 'Pecks wild grain, seeds & meadow berries',
      };
    case 'capybara':
      return {
        category: 'Herbivore',
        detail: 'Calm riverside grazer — aquatic reeds & sweet berries',
      };
    case 'raider_swarmer':
    case 'raider_ranged':
    case 'raider_behemoth':
      return {
        category: 'Carnivore',
        detail: 'Plundered rations, smoked meats & pillaged stores',
      };
    default: {
      if (unit.species === 'elf') {
        return {
          category: 'Botanical Omnivore',
          detail: 'Orchard fruit, herb loaves & forest berries',
        };
      }
      if (unit.species === 'orc') {
        return {
          category: 'Carnivore',
          detail: 'Smoked boar, charred haunches & hearth rations',
        };
      }
      return {
        category: 'Omnivore',
        detail: 'Hearth bread, orchard fruit & roasted game',
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
    return { subtitle: 'Celestial Unicorn', factionLabel: 'Mythical' };
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
      return unit.role === 'dragon' ? 'Aerial Assault' : 'In Combat';
    case 'gathering':
      return unit.faction === 'wildlife' ? 'Grazing & Foraging' : 'Harvesting Resources';
    case 'building':
      return 'Constructing';
    case 'praying':
      return 'Praying at Temple';
    case 'researching':
      return 'Conducting Research';
    case 'moving':
      return unit.role === 'dragon'
        ? unit.dragonRunPhase === 'strafe'
          ? 'Strafing Pass'
          : 'Soaring'
        : 'Traveling';
    case 'ko':
      return 'Defeated';
    default:
      return unit.role === 'dragon' ? 'Circling Skies' : 'Idle / Resting';
  }
}

function getAgeStageLabel(unit: UnitEntity): string {
  if (unit.role === 'dragon') return 'Ancient Wyrm';
  if (unit.role === 'unicorn') return 'Timeless Fey';
  if (unit.ageStage === 'child') return 'Child';
  if (unit.faction === 'wildlife') return 'Mature';
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
