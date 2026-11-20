import type { UnitRole } from '../../game/types';
import { CompiledSprite } from './pixelEngine';
import {
  MaterialRamp,
  PixelCanvas,
  RAMPS,
  hash2d,
  paintSprite,
  quantRamp,
} from './pixelPainter';

/** Helper to draw a charming 32x32 RPG humanoid bust/chibi adventurer */
function drawHumanoid(
  c: PixelCanvas,
  opts: {
    tunic: MaterialRamp;
    skin?: MaterialRamp;
    hair?: MaterialRamp;
    trim?: MaterialRamp;
    hat?: 'hair' | 'hood' | 'straw' | 'hardhat' | 'helm' | 'crown' | 'cap' | 'visor' | 'horns' | 'none';
    hatRamp?: MaterialRamp;
    pointedEars?: boolean;
    beard?: MaterialRamp;
    plume?: MaterialRamp;
    item?: 'staff' | 'bow' | 'axe' | 'basket' | 'pick' | 'hammer' | 'sword' | 'ankh' | 'book' | 'wrench' | 'dagger';
  },
) {
  const skin = opts.skin ?? RAMPS.skin;
  const hair = opts.hair ?? RAMPS.wood;
  const trim = opts.trim ?? RAMPS.gold;

  // Boots / stance base
  c.fillCapsule(12, 26, 12, 29, 2.2, 2.4, (x, y, _nx, _ny, _nz, light) =>
    quantRamp(RAMPS.darkWood, light, x, y, 0.02),
  );
  c.fillCapsule(19, 26, 19, 29, 2.2, 2.4, (x, y, _nx, _ny, _nz, light) =>
    quantRamp(RAMPS.darkWood, light * 0.92, x, y, 0.02),
  );

  // Tunic torso + leather belt
  c.fillEllipse(15.5, 21.5, 6.2, 5.8, 0, (x, y, _nx, _ny, _nz, light, _u, v) => {
    if (v > 0.64 && v < 0.8) return quantRamp(RAMPS.darkWood, light, x, y, 0.02);
    if (Math.abs(x - 15.5) < 1.2 && v > 0.62 && v < 0.82) return trim.light;
    return quantRamp(opts.tunic, light * 1.02, x, y, 0.025);
  });

  // Left & right arms
  c.fillCapsule(10, 19, 7.5, 24, 1.8, 1.6, (x, y, _nx, _ny, _nz, light) =>
    quantRamp(skin, light, x, y, 0.02),
  );
  c.fillCapsule(21, 19, 23.5, 23, 1.8, 1.6, (x, y, _nx, _ny, _nz, light) =>
    quantRamp(skin, light * 0.94, x, y, 0.02),
  );

  // Pointed elf ears if requested
  if (opts.pointedEars) {
    c.fillPoly(
      [
        [9, 12],
        [5, 10],
        [9, 14],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(skin, light, x, y, 0.02),
    );
    c.fillPoly(
      [
        [22, 12],
        [26, 10],
        [22, 14],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(skin, light * 0.9, x, y, 0.02),
    );
  }

  // Head sphere
  c.fillEllipse(15.5, 11.5, 5.8, 5.8, 0, (x, y, _nx, _ny, _nz, light) =>
    quantRamp(skin, light * 1.02, x, y, 0.02),
  );

  // Eyes & cheek tint
  c.put(13, 12, [20, 14, 14]);
  c.put(13, 11, [255, 255, 255]);
  c.put(18, 12, [20, 14, 14]);
  c.put(18, 11, [255, 255, 255]);

  if (opts.beard) {
    c.fillEllipse(15.5, 15.5, 4.4, 2.8, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(opts.beard!, light, x, y, 0.03),
    );
  }

  // Headgear / Hair variants
  const hatMode = opts.hat ?? 'hair';
  const hatR = opts.hatRamp ?? hair;
  if (hatMode === 'hair') {
    c.fillPoly(
      [
        [9, 11],
        [10, 5],
        [16, 4],
        [21.5, 7],
        [21.5, 11],
        [17, 9],
        [12, 9],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(hair, light, x, y, 0.025),
    );
  } else if (hatMode === 'hood') {
    c.fillEllipse(15.5, 9, 6.6, 5.2, 0, (x, y, _nx, _ny, _nz, light, _u, v) =>
      v > 0.65 ? null : quantRamp(hatR, light, x, y, 0.025),
    );
  } else if (hatMode === 'straw') {
    c.fillEllipse(15.5, 7.5, 9.0, 2.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light, x, y, 0.02),
    );
    c.fillEllipse(15.5, 5.5, 4.8, 2.8, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 1.05, x, y, 0.02),
    );
  } else if (hatMode === 'hardhat') {
    c.fillEllipse(15.5, 7.5, 6.6, 4.0, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 1.06, x, y, 0.02),
    );
    c.fillEllipse(15.5, 7.2, 1.8, 1.5, 0, () => RAMPS.azure.hi);
  } else if (hatMode === 'helm') {
    c.fillEllipse(15.5, 9.5, 6.5, 5.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(hatR, light, x, y, 0.02),
    );
    if (opts.plume) {
      c.fillBezier(15.5, 5, 13, 1, 9, 3, 2.0, 1.0, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(opts.plume!, light * 1.05, x, y, 0.02),
      );
    }
    // Helmet visor slit
    c.fillCapsule(12, 12, 19, 12, 0.8, 0.8, () => [26, 22, 24]);
  } else if (hatMode === 'cap') {
    c.fillPoly(
      [
        [8, 7],
        [15.5, 4],
        [23, 7],
        [15.5, 9.5],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(hatR, light, x, y, 0.02),
    );
  } else if (hatMode === 'visor') {
    c.fillEllipse(15.5, 11.2, 6.8, 6.6, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.cloud, light * 1.04, x, y, 0.02),
    );
    c.fillEllipse(15.5, 11.2, 4.8, 3.4, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.azure, light * 1.1, x, y, 0.02),
    );
    c.put(13, 10, [255, 255, 255]);
  } else if (hatMode === 'horns') {
    c.fillBezier(11, 8, 8, 5, 7, 2, 1.7, 0.6, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.bone, light, x, y, 0.02),
    );
    c.fillBezier(20, 8, 23, 5, 24, 2, 1.7, 0.6, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.bone, light * 0.9, x, y, 0.02),
    );
    c.fillEllipse(15.5, 7.5, 5.2, 3.0, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(hatR, light, x, y, 0.02),
    );
  }

  // Handheld equipment on right side
  switch (opts.item) {
    case 'staff':
      c.fillCapsule(25, 28, 25, 7, 1.1, 1.1, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.wood, light, x, y, 0.02),
      );
      c.fillEllipse(25, 6, 2.2, 2.2, 0, () => RAMPS.azure.hi);
      break;
    case 'bow':
      c.fillBezier(24, 7, 30, 16, 24, 25, 1.3, 1.3, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.wood, light, x, y, 0.02),
      );
      c.fillCapsule(24, 8, 24, 24, 0.4, 0.4, () => RAMPS.parchment.hi);
      break;
    case 'axe':
      c.fillCapsule(25, 27, 25, 6, 1.2, 1.2, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.darkWood, light, x, y, 0.02),
      );
      c.fillPoly(
        [
          [24, 6],
          [30, 4],
          [30, 12],
          [24, 11],
        ],
        (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.steel, light * 1.05, x, y, 0.02),
      );
      break;
    case 'basket':
      c.fillEllipse(24, 23, 4.0, 3.2, 0, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.wood, light, x, y, 0.03),
      );
      c.put(23, 21, RAMPS.crimson.light);
      c.put(25, 21, RAMPS.crimson.mid);
      c.put(24, 20, RAMPS.leaf.light);
      break;
    case 'pick':
      c.fillCapsule(25, 27, 25, 8, 1.1, 1.1, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.wood, light, x, y, 0.02),
      );
      c.fillBezier(20, 10, 25, 6, 30, 10, 1.3, 0.7, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.steel, light * 1.08, x, y, 0.02),
      );
      break;
    case 'hammer':
      c.fillCapsule(25, 27, 25, 10, 1.2, 1.2, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.wood, light, x, y, 0.02),
      );
      c.fillCapsule(21, 9, 29, 9, 2.1, 2.1, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.steel, light, x, y, 0.02),
      );
      break;
    case 'sword':
      c.fillCapsule(25, 21, 25, 5, 1.4, 0.6, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.steel, light * 1.1, x, y, 0.01),
      );
      c.fillCapsule(22, 21, 28, 21, 1.1, 1.1, () => RAMPS.gold.light);
      break;
    case 'ankh':
      c.fillCapsule(25, 27, 25, 10, 1.1, 1.1, () => RAMPS.gold.mid);
      c.fillEllipse(25, 7, 2.6, 2.8, 0, () => RAMPS.azure.hi);
      c.sparkle(25, 7, [255, 255, 255], false);
      break;
    case 'book':
      c.fillPoly(
        [
          [20, 19],
          [28, 17],
          [28, 25],
          [20, 27],
        ],
        (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.parchment, light, x, y, 0.02),
      );
      break;
    case 'wrench':
      c.fillCapsule(25, 24, 25, 9, 1.3, 1.3, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.gold, light, x, y, 0.02),
      );
      c.fillEllipse(25, 8, 2.5, 2.2, 0, () => RAMPS.azure.hi);
      break;
    case 'dagger':
      c.fillCapsule(24, 22, 28, 12, 1.4, 0.5, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.steel, light * 1.05, x, y, 0.02),
      );
      break;
  }
}

export const UNIT_SPRITES: Record<UnitRole, CompiledSprite> = {
  human: paintSprite((c) =>
    drawHumanoid(c, { tunic: RAMPS.azure, hair: RAMPS.wood, hat: 'hair', item: 'staff' }),
  ),

  elf: paintSprite((c) =>
    drawHumanoid(c, {
      tunic: RAMPS.leaf,
      hair: RAMPS.gold,
      hat: 'hair',
      pointedEars: true,
      item: 'bow',
    }),
  ),

  orc: paintSprite((c) => {
    drawHumanoid(c, {
      tunic: RAMPS.crimson,
      skin: RAMPS.orcSkin,
      hair: RAMPS.darkIron,
      hat: 'hair',
      item: 'axe',
    });
    // Prominent ivory bottom tusks
    c.put(12, 15, RAMPS.bone.hi);
    c.put(12, 14, RAMPS.bone.light);
    c.put(19, 15, RAMPS.bone.hi);
    c.put(19, 14, RAMPS.bone.light);
  }),

  villager: paintSprite((c) =>
    drawHumanoid(c, { tunic: RAMPS.azure, hat: 'straw', item: 'basket' }),
  ),

  forager: paintSprite((c) =>
    drawHumanoid(c, {
      tunic: RAMPS.leaf,
      hat: 'hood',
      hatRamp: RAMPS.leaf,
      item: 'basket',
    }),
  ),

  miner: paintSprite((c) =>
    drawHumanoid(c, {
      tunic: RAMPS.stone,
      beard: RAMPS.darkWood,
      hat: 'hardhat',
      item: 'pick',
    }),
  ),

  builder: paintSprite((c) =>
    drawHumanoid(c, {
      tunic: RAMPS.terracotta,
      hat: 'hair',
      hair: RAMPS.darkWood,
      item: 'hammer',
    }),
  ),

  warrior: paintSprite((c) =>
    drawHumanoid(c, {
      tunic: RAMPS.crimson,
      hat: 'helm',
      hatRamp: RAMPS.steel,
      plume: RAMPS.crimson,
      item: 'sword',
    }),
  ),

  priest: paintSprite((c) =>
    drawHumanoid(c, {
      tunic: RAMPS.parchment,
      hat: 'hood',
      hatRamp: RAMPS.parchment,
      item: 'ankh',
    }),
  ),

  scholar: paintSprite((c) => {
    drawHumanoid(c, {
      tunic: RAMPS.arcane,
      beard: RAMPS.cloud,
      hat: 'cap',
      hatRamp: RAMPS.arcane,
      item: 'book',
    });
    // Golden scholar spectacles glint above beard
    c.put(13, 12, RAMPS.gold.hi);
    c.put(18, 12, RAMPS.gold.hi);
  }),

  astro_engineer: paintSprite((c) =>
    drawHumanoid(c, {
      tunic: RAMPS.cloud,
      trim: RAMPS.azure,
      hat: 'visor',
      item: 'wrench',
    }),
  ),

  raider_swarmer: paintSprite((c) =>
    drawHumanoid(c, {
      tunic: RAMPS.crimson,
      skin: RAMPS.sandstone,
      hat: 'horns',
      hatRamp: RAMPS.darkIron,
      item: 'dagger',
    }),
  ),

  raider_ranged: paintSprite((c) =>
    drawHumanoid(c, {
      tunic: RAMPS.darkWood,
      skin: RAMPS.sandstone,
      hat: 'hood',
      hatRamp: RAMPS.crimson,
      item: 'bow',
    }),
  ),

  raider_behemoth: paintSprite((c) =>
    drawHumanoid(c, {
      tunic: RAMPS.darkIron,
      skin: RAMPS.wood,
      hat: 'horns',
      hatRamp: RAMPS.darkIron,
      item: 'hammer',
    }),
  ),

  // Grinning bone skeleton warrior wielding a notched steel sword
  skeleton: paintSprite((c) => {
    drawHumanoid(c, {
      tunic: RAMPS.darkIron,
      skin: RAMPS.bone,
      hat: 'none',
      item: 'sword',
    });
    // Hollow dark eye sockets & bony teeth grin
    c.fillEllipse(13.5, 11.5, 1.5, 1.6, 0, () => [24, 18, 20]);
    c.fillEllipse(18.5, 11.5, 1.5, 1.6, 0, () => [24, 18, 20]);
    c.put(13.5, 11.5, RAMPS.toxic.hi);
    c.put(18.5, 11.5, RAMPS.toxic.hi);
    c.put(14, 15, [28, 22, 22]);
    c.put(16, 15, [28, 22, 22]);
    c.put(18, 15, [28, 22, 22]);
  }),

  // Bulbous-cranium alien martian trooper with glossy dark eyes & plasma blaster
  alien_trooper: paintSprite((c) => {
    // Sleek cybernetic space armor torso
    c.fillEllipse(16, 23, 6.2, 5.5, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.darkIron, light, x, y, 0.02),
    );
    c.fillEllipse(16, 22, 2.2, 2.2, 0, () => RAMPS.toxic.hi);
    // Bulbous emerald alien cranium
    c.fillEllipse(16, 11.5, 7.2, 6.5, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.toxic, light * 1.02, x, y, 0.02),
    );
    // Large almond obsidian alien eyes with bright catchlights
    c.fillEllipse(13, 12, 2.2, 2.6, -0.25, () => [16, 14, 22]);
    c.fillEllipse(19, 12, 2.2, 2.6, 0.25, () => [16, 14, 22]);
    c.put(12, 11, [255, 255, 255]);
    c.put(18, 11, [255, 255, 255]);
    // Plasma blaster held right
    c.fillCapsule(21, 21, 28, 19, 1.6, 1.1, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.steel, light, x, y, 0.02),
    );
    c.put(28, 19, RAMPS.toxic.hi);
  }),

  // Hovering chrome UFO flying saucer with glowing toxic canopy & rim thrusters
  alien_ufo: paintSprite((c) => {
    // Bottom tractor glow
    c.fillEllipse(16, 22, 5.5, 2.4, 0, () => RAMPS.toxic.light);
    // Sleek wide metallic saucer hull
    c.fillEllipse(16, 17, 12.8, 4.6, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.steel, light * 1.08, x, y, 0.02),
    );
    // Translucent emerald glass cockpit dome
    c.fillEllipse(16, 12.5, 6.2, 4.4, 0, (x, y, nx, ny, nz, light) => {
      if (nx < -0.2 && ny < -0.2 && nz > 0.6) return RAMPS.toxic.hi;
      return quantRamp(RAMPS.toxic, light * 1.05, x, y, 0.02);
    });
    for (const lx of [7, 12, 16, 20, 25]) {
      c.put(lx, 17.5, lx === 16 ? RAMPS.azure.hi : RAMPS.flame.hi);
    }
  }),

  // Towering 3-legged dark-iron alien tripod war strider with crimson cyclops laser
  alien_walker: paintSprite((c) => {
    // 3 articulated tripod legs descending from armored pod
    c.fillCapsule(12, 15, 6, 29, 1.4, 1.0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.darkIron, light, x, y, 0.02),
    );
    c.fillCapsule(16, 16, 16, 29, 1.4, 1.0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.steel, light * 0.85, x, y, 0.02),
    );
    c.fillCapsule(20, 15, 26, 29, 1.4, 1.0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.darkIron, light * 0.85, x, y, 0.02),
    );
    // Armored alien tripod carapace head
    c.fillEllipse(16, 10.5, 8.0, 6.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.arcane, light * 0.92, x, y, 0.025),
    );
    // Glowing crimson heat-ray cyclops eye
    c.fillEllipse(16, 11.5, 2.8, 2.5, 0, () => RAMPS.crimson.light);
    c.put(15.5, 10.8, [255, 255, 240]);
    c.sparkle(16, 3, RAMPS.toxic.hi, false);
  }),

  // Plump spotted dairy cow with curved cream horns, bell & rosy muzzle
  cow: paintSprite((c) => {
    // Ears & curved cream horns
    c.fillBezier(9, 8, 5, 6, 6, 3, 1.6, 0.6, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.bone, light, x, y, 0.02),
    );
    c.fillBezier(23, 8, 27, 6, 26, 3, 1.6, 0.6, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.bone, light * 0.9, x, y, 0.02),
    );
    // Legs + plump spotted torso
    c.fillCapsule(10, 22, 10, 28, 2.0, 1.8, () => RAMPS.cloud.mid);
    c.fillCapsule(22, 22, 22, 28, 2.0, 1.8, () => RAMPS.cloud.mid);
    c.fillEllipse(16, 21, 9.5, 6.5, 0, (x, y, _nx, _ny, _nz, light) => {
      const spot = hash2d(Math.floor(x / 3), Math.floor(y / 3), 12) > 0.68;
      return quantRamp(spot ? RAMPS.darkIron : RAMPS.cloud, light * 1.02, x, y, 0.02);
    });
    // Head + big rosy snout + golden bell
    c.fillEllipse(16, 12, 7.2, 6.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.cloud, light * 1.05, x, y, 0.02),
    );
    c.fillEllipse(16, 15.5, 5.4, 3.0, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.pink, light * 1.05, x, y, 0.02),
    );
    c.fillEllipse(16, 20, 1.8, 1.8, 0, () => RAMPS.gold.light);
    c.put(12, 11, [20, 14, 14]);
    c.put(20, 11, [20, 14, 14]);
    c.put(14, 15, RAMPS.pink.deep);
    c.put(18, 15, RAMPS.pink.deep);
  }),

  // Burly chestnut grizzly bear with round ears, broad snout & fur tufts
  bear: paintSprite((c) => {
    c.fillEllipse(8.5, 7, 3.0, 3.0, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.wood, light, x, y, 0.02),
    );
    c.fillEllipse(23.5, 7, 3.0, 3.0, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.wood, light * 0.9, x, y, 0.02),
    );
    c.fillEllipse(16, 22, 10.2, 7.5, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.darkWood, light * 1.04, x, y, 0.03),
    );
    c.fillEllipse(16, 13, 8.2, 7.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.wood, light * 1.02, x, y, 0.03),
    );
    c.fillEllipse(16, 15.5, 4.2, 3.0, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.parchment, light, x, y, 0.02),
    );
    c.put(12, 11, [18, 12, 12]);
    c.put(20, 11, [18, 12, 12]);
    c.fillEllipse(16, 14.5, 1.6, 1.2, 0, () => [22, 16, 16]);
  }),

  // Fierce silver-grey timber wolf in dynamic 3/4 prowling stance
  wolf: paintSprite((c) => {
    // Bushy silver tail curving left
    c.fillBezier(10, 21, 5, 18, 5, 12, 2.5, 1.4, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.steel, light * 0.92, x, y, 0.03),
    );
    // Legs + chest fur
    c.fillCapsule(11, 22, 11, 28, 1.8, 1.5, () => RAMPS.steel.dark);
    c.fillCapsule(21, 22, 21, 28, 1.8, 1.5, () => RAMPS.steel.mid);
    c.fillEllipse(15, 20, 7.2, 5.2, 0.1, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.steel, light * 0.95, x, y, 0.03),
    );
    // Pointed ears
    c.fillPoly(
      [
        [15, 10],
        [15, 3],
        [19, 8],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.steel, light, x, y, 0.02),
    );
    c.fillPoly(
      [
        [21, 10],
        [24, 4],
        [25, 10],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.steel, light * 0.9, x, y, 0.02),
    );
    // Wolf head & protruding long snout pointing right
    c.fillEllipse(19.5, 12.5, 5.2, 4.8, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.steel, light * 1.05, x, y, 0.02),
    );
    c.fillCapsule(22, 13.5, 28, 14.5, 2.5, 1.4, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.cloud, light, x, y, 0.02),
    );
    c.put(28, 13.5, [20, 16, 18]); // dark nose tip
    c.put(21, 11, RAMPS.gold.hi);  // piercing amber eye
    c.put(20, 11, [20, 16, 18]);
  }),

  // Proud white hen with bright scarlet comb, golden beak & wing shading
  chicken: paintSprite((c) => {
    // Scarlet comb crest
    c.fillEllipse(15, 5.5, 3.2, 2.4, -0.2, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.crimson, light * 1.05, x, y, 0.02),
    );
    // Tail & plump feathered body
    c.fillEllipse(15, 19, 8.2, 6.5, -0.15, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.cloud, light * 1.06, x, y, 0.02),
    );
    c.fillEllipse(17, 11.5, 5.2, 4.8, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.cloud, light * 1.08, x, y, 0.02),
    );
    // Wing feather curve
    c.fillEllipse(13, 19.5, 4.4, 3.0, 0.25, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.steel, light * 0.95, x, y, 0.02),
    );
    // Golden beak + scarlet wattle + legs
    c.fillPoly(
      [
        [21, 10],
        [27, 12],
        [21, 14],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.gold, light * 1.08, x, y, 0.01),
    );
    c.put(20, 14, RAMPS.crimson.mid);
    c.put(19, 10, [20, 14, 14]);
    c.fillCapsule(13, 25, 13, 28, 0.9, 0.9, () => RAMPS.gold.mid);
    c.fillCapsule(18, 25, 18, 28, 0.9, 0.9, () => RAMPS.gold.mid);
  }),

  // Cheerful plump pink piglet with snout, floppy ears & trotters
  pig: paintSprite((c) => {
    c.fillPoly(
      [
        [8, 10],
        [6, 4],
        [12, 7],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.pink, light, x, y, 0.02),
    );
    c.fillPoly(
      [
        [24, 10],
        [26, 4],
        [20, 7],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.pink, light * 0.92, x, y, 0.02),
    );
    c.fillCapsule(11, 24, 11, 28, 1.8, 1.6, () => RAMPS.pink.dark);
    c.fillCapsule(21, 24, 21, 28, 1.8, 1.6, () => RAMPS.pink.dark);
    c.fillEllipse(16, 20, 8.8, 6.8, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.pink, light * 1.05, x, y, 0.02),
    );
    c.fillEllipse(16, 13, 7.5, 6.4, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.pink, light * 1.06, x, y, 0.02),
    );
    c.fillEllipse(16, 15.5, 4.0, 2.6, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.pink, light * 1.15, x, y, 0.01),
    );
    c.put(12, 11, [20, 14, 14]);
    c.put(20, 11, [20, 14, 14]);
    c.put(14, 15, RAMPS.pink.deep);
    c.put(18, 15, RAMPS.pink.deep);
  }),

  // Chill capybara balancing a tiny yuzu orange on its head!
  capybara: paintSprite((c) => {
    // Round brown body & sturdy legs facing right
    c.fillCapsule(10, 23, 10, 27, 1.8, 1.8, () => RAMPS.darkWood.dark);
    c.fillCapsule(21, 23, 21, 27, 1.8, 1.8, () => RAMPS.darkWood.dark);
    c.fillEllipse(14, 20, 9.2, 6.2, 0.1, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.wood, light, x, y, 0.03),
    );
    // Blocky capybara head & tiny ear
    c.fillEllipse(21.5, 13.5, 6.0, 4.8, 0.15, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.wood, light * 1.04, x, y, 0.025),
    );
    c.fillEllipse(17, 9, 1.8, 2.0, 0, () => RAMPS.darkWood.mid);
    // Tiny glossy yuzu orange perched cleanly on top!
    c.fillEllipse(21, 7, 2.8, 2.6, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.flame, light * 1.1, x, y, 0.01),
    );
    c.put(21, 4, RAMPS.leaf.light);
    c.put(22, 12, [20, 14, 14]);
    c.put(26, 15, RAMPS.darkWood.deep);
  }),

  // Fierce emerald T-Rex dinosaur with toothy jaw & amber eye
  dinosaur: paintSprite((c) => {
    // Tail sweeping left + legs + body
    c.fillBezier(14, 22, 6, 22, 3, 17, 4.0, 1.2, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.leaf, light * 0.92, x, y, 0.025),
    );
    c.fillCapsule(13, 22, 13, 28, 2.2, 2.0, () => RAMPS.leaf.dark);
    c.fillCapsule(19, 22, 19, 28, 2.2, 2.0, () => RAMPS.leaf.dark);
    c.fillEllipse(15, 19, 6.2, 6.5, 0.3, (x, y, _nx, _ny, _nz, light, u) =>
      quantRamp(u > 0.65 ? RAMPS.parchment : RAMPS.leaf, light * 1.02, x, y, 0.025),
    );
    // Big T-Rex skull + toothy jaws
    c.fillEllipse(19.5, 9.5, 7.0, 4.4, 0.05, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.leaf, light * 1.05, x, y, 0.025),
    );
    c.fillCapsule(18, 13.5, 25, 13.5, 1.8, 1.4, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.leaf, light * 0.9, x, y, 0.02),
    );
    c.put(20, 8, RAMPS.gold.hi);
    c.put(21, 12, RAMPS.bone.hi);
    c.put(23, 12, RAMPS.bone.hi);
    c.put(25, 12, RAMPS.bone.hi);
  }),

  // Majestic crimson dragon in 3/4 wyvern pose with ribbed wings, horns & fire wisp
  dragon: paintSprite((c) => {
    // Swept leathery crimson wings with dark bone ribs
    c.fillPoly(
      [
        [13, 15],
        [4, 5],
        [3, 17],
        [11, 20],
      ],
      (x, y, _nx, _ny, _nz, light, u) =>
        quantRamp(u < 0.2 ? RAMPS.crimson : RAMPS.terracotta, light * 0.88, x, y, 0.03),
    );
    c.fillPoly(
      [
        [19, 14],
        [28, 4],
        [29, 16],
        [21, 19],
      ],
      (x, y, _nx, _ny, _nz, light, u) =>
        quantRamp(u > 0.8 ? RAMPS.crimson : RAMPS.terracotta, light * 0.82, x, y, 0.03),
    );
    // Tail sweeping down-left + scaly belly
    c.fillBezier(14, 23, 8, 26, 5, 22, 2.5, 0.8, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.crimson, light * 0.9, x, y, 0.02),
    );
    c.fillEllipse(15.5, 20.5, 5.2, 6.2, 0.15, (x, y, _nx, _ny, _nz, light, u) =>
      quantRamp(u > 0.45 && u < 0.82 ? RAMPS.gold : RAMPS.crimson, light * 1.02, x, y, 0.025),
    );
    // Arched neck, horned skull & open fiery snout facing right
    c.fillCapsule(16, 16, 18.5, 10, 2.8, 2.6, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.crimson, light, x, y, 0.02),
    );
    c.fillBezier(16, 8, 13, 5, 11, 3, 1.4, 0.5, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.bone, light, x, y, 0.02),
    );
    c.fillCapsule(18, 9.5, 25, 10.5, 2.6, 1.8, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.crimson, light * 1.06, x, y, 0.02),
    );
    c.put(20, 9, RAMPS.flame.hi);
    // Flame breath puff
    c.fillEllipse(27.5, 12, 2.5, 1.8, 0.3, () => RAMPS.flame.hi);
    c.sparkle(29, 10, RAMPS.flame.light, false);
  }),

  // Noble snow-white unicorn with spiral golden horn & pastel rainbow mane
  unicorn: paintSprite((c) => {
    // Rainbow flowing mane + tail
    c.fillBezier(14, 10, 8, 12, 8, 18, 2.8, 2.2, (x, y, _nx, _ny, _nz, light, t) =>
      quantRamp(t < 0.5 ? RAMPS.pink : RAMPS.arcane, light * 1.05, x, y, 0.02),
    );
    c.fillBezier(7, 20, 3, 22, 5, 27, 2.2, 1.4, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.azure, light * 1.05, x, y, 0.02),
    );
    // White steed legs & body
    c.fillCapsule(10, 22, 10, 28, 1.8, 1.5, () => RAMPS.cloud.light);
    c.fillCapsule(20, 22, 20, 28, 1.8, 1.5, () => RAMPS.cloud.light);
    c.put(10, 28, RAMPS.gold.mid);
    c.put(20, 28, RAMPS.gold.mid);
    c.fillEllipse(14, 20, 7.6, 5.0, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.cloud, light * 1.06, x, y, 0.02),
    );
    // Arched neck, head & spiral golden horn
    c.fillCapsule(17, 19, 19, 11, 3.6, 3.2, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.cloud, light * 1.08, x, y, 0.02),
    );
    c.fillEllipse(21.5, 11.5, 4.8, 3.4, 0.2, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.cloud, light * 1.08, x, y, 0.02),
    );
    c.fillCapsule(19.5, 8.5, 22.5, 2.5, 1.5, 0.4, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 1.15, x, y, 0.01),
    );
    c.put(21, 11, RAMPS.azure.mid);
  }),

  // S-curved abyssal sea-serpent Leviathan erupting from foamy ocean waves
  leviathan: paintSprite((c) => {
    // S-curved dorsal serpent neck & dorsal fin spikes
    c.fillBezier(9, 24, 4, 15, 13, 10, 4.2, 3.6, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.ice, light * 0.72, x, y, 0.03),
    );
    for (const [sx, sy] of [
      [5, 14],
      [7, 9],
      [11, 6],
    ]) {
      c.fillPoly(
        [
          [sx, sy + 2],
          [sx - 2, sy - 3],
          [sx + 2, sy],
        ],
        () => RAMPS.azure.hi,
      );
    }
    // Fierce horned sea-serpent jaw & fangs lunging right
    c.fillEllipse(16.5, 9.5, 5.2, 3.6, -0.1, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.ice, light * 0.78, x, y, 0.02),
    );
    c.fillCapsule(18, 8.5, 26, 9.5, 2.4, 1.4, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.ice, light * 0.8, x, y, 0.02),
    );
    c.fillCapsule(18, 13.5, 25, 14.2, 1.6, 1.1, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.ice, light * 0.65, x, y, 0.02),
    );
    c.put(20, 8, RAMPS.azure.hi);
    for (const fx of [20, 22, 24]) {
      c.put(fx, 11, RAMPS.bone.hi);
      c.put(fx, 12, RAMPS.bone.light);
    }
    // Crashing ocean surf & foam crest around lower coils
    c.fillEllipse(16, 25, 12, 4.2, 0, (x, y, _nx, _ny, _nz, light, _u, v) =>
      quantRamp(v < 0.38 ? RAMPS.cloud : RAMPS.azure, light * 1.05, x, y, 0.03),
    );
    c.sparkle(26, 22, RAMPS.ice.hi, false);
  }),
};
