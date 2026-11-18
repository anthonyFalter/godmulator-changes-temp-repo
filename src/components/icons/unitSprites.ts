import type { UnitRole } from '../../game/types';
import { type CompiledSprite, Icon16, MAT, type MatLegend, MatRamp, cluster16, icon16 } from './pixelEngine';

const UNIT_MATS: MatLegend = {
  // Gold
  Y: { ramp: MAT.gold, tone: 4 },
  y: { ramp: MAT.gold, tone: 3 },
  g: { ramp: MAT.gold, tone: 2 },
  G: { ramp: MAT.gold, tone: 1 },
  // Wood / Leather
  B: { ramp: MAT.wood, tone: 4 },
  b: { ramp: MAT.wood, tone: 3 },
  k: { ramp: MAT.wood, tone: 2 },
  K: { ramp: MAT.wood, tone: 1 },
  // Leaf / Emerald
  E: { ramp: MAT.leaf, tone: 4 },
  e: { ramp: MAT.leaf, tone: 3 },
  l: { ramp: MAT.leaf, tone: 2 },
  L: { ramp: MAT.leaf, tone: 1 },
  // Azure / Cyan
  C: { ramp: MAT.azure, tone: 4 },
  c: { ramp: MAT.azure, tone: 3 },
  u: { ramp: MAT.azure, tone: 2 },
  U: { ramp: MAT.azure, tone: 1 },
  // Steel / Silver
  S: { ramp: MAT.steel, tone: 4 },
  s: { ramp: MAT.steel, tone: 3 },
  m: { ramp: MAT.steel, tone: 2 },
  M: { ramp: MAT.steel, tone: 1 },
  // Ruby / Crimson
  R: { ramp: MAT.ruby, tone: 4 },
  r: { ramp: MAT.ruby, tone: 3 },
  q: { ramp: MAT.ruby, tone: 2 },
  Q: { ramp: MAT.ruby, tone: 1 },
  // Parchment / Ivory
  I: { ramp: MAT.parchment, tone: 4 },
  i: { ramp: MAT.parchment, tone: 3 },
  j: { ramp: MAT.parchment, tone: 2 },
  J: { ramp: MAT.parchment, tone: 1 },
  // Flame
  F: { ramp: MAT.flame, tone: 4 },
  f: { ramp: MAT.flame, tone: 3 },
  a: { ramp: MAT.flame, tone: 2 },
  A: { ramp: MAT.flame, tone: 1 },
  // Arcane
  P: { ramp: MAT.arcane, tone: 4 },
  p: { ramp: MAT.arcane, tone: 3 },
  z: { ramp: MAT.arcane, tone: 2 },
  Z: { ramp: MAT.arcane, tone: 1 },
  // Pink
  W: { ramp: MAT.pink, tone: 4 },
  w: { ramp: MAT.pink, tone: 3 },
  x: { ramp: MAT.pink, tone: 2 },
  X: { ramp: MAT.pink, tone: 1 },
  // Dark Iron (for eyes/spots/noses)
  D: { ramp: MAT.darkIron, tone: 1 },
  d: { ramp: MAT.darkIron, tone: 0 },
};

function draw16Unit(
  c: Icon16,
  opts: {
    tunic: MatRamp;
    skin?: MatRamp;
    hair?: MatRamp;
    hat?: 'hair' | 'hood' | 'straw' | 'hardhat' | 'helm' | 'wizard' | 'visor' | 'horns' | 'miter' | 'beret' | 'cap' | 'warhelm';
    hatRamp?: MatRamp;
    ears?: boolean;
    tusks?: boolean;
    beard?: MatRamp;
    bandana?: boolean;
    shield?: boolean;
    stole?: boolean;
    pauldrons?: boolean;
    tool?: 'staff' | 'bow' | 'axe' | 'basket' | 'pick' | 'hammer' | 'sword' | 'ankh' | 'book' | 'wrench' | 'dagger' | 'herb';
  },
) {
  const skin = opts.skin ?? MAT.skin;
  const hair = opts.hair ?? MAT.wood;
  const hatR = opts.hatRamp ?? hair;

  // 1. RPG Tunic & Boots (y=9..14)
  c.stamp(
    2,
    9,
    [
      '.3333333.',
      '222222222',
      '.22Yg222.',
      '.1111111.',
      '.kK...kK.',
      '.KK...KK.',
    ],
    opts.tunic,
    UNIT_MATS,
  );

  if (opts.stole) {
    c.stamp(5, 9, ['Yy', 'Yg', 'gG'], MAT.gold, UNIT_MATS);
  }

  if (opts.pauldrons) {
    c.stamp(1, 9, ['SS.', '.m.'], MAT.steel, UNIT_MATS);
    c.stamp(9, 9, ['.SS', '.m.'], MAT.steel, UNIT_MATS);
  }

  // Hands
  c.set(1, 10, skin, 3);
  c.set(10, 10, skin, 3);

  if (opts.shield) {
    c.stamp(
      0,
      9,
      [
        'SSS',
        'SuS',
        'sYs',
        '.m.',
      ],
      MAT.steel,
      UNIT_MATS,
    );
  }

  // 2. Expressive Chibi Head (y=4..8)
  c.stamp(
    2,
    4,
    [
      '.2222222.',
      '233333332',
      '33o333o33',
      '33o333o33',
      '.2222222.',
    ],
    skin,
    UNIT_MATS,
  );

  if (opts.bandana) {
    c.stamp(
      2,
      7,
      [
        'RrrrrrR',
        '.qqqqq.',
      ],
      MAT.ruby,
      UNIT_MATS,
    );
  }

  if (opts.ears) {
    c.stamp(0, 6, ['33'], skin, UNIT_MATS);
    c.stamp(11, 6, ['33'], skin, UNIT_MATS);
  }

  if (opts.tusks) {
    c.set(4, 8, MAT.parchment, 4);
    c.set(8, 8, MAT.parchment, 4);
  }

  if (opts.beard) {
    c.stamp(
      3,
      8,
      [
        '2222222',
        '.11111.',
      ],
      opts.beard,
      UNIT_MATS,
    );
  }

  // 3. Iconic Role Headgear (distinct silhouettes!)
  const hat = opts.hat ?? 'hair';
  if (hat === 'hair') {
    c.stamp(
      2,
      2,
      [
        '..33333..',
        '.2222222.',
        '12.....21',
      ],
      hair,
      UNIT_MATS,
    );
  } else if (hat === 'straw') {
    c.stamp(
      1,
      2,
      [
        '...33333...',
        '.322222223.',
        '22222222222',
      ],
      MAT.gold,
      UNIT_MATS,
    );
  } else if (hat === 'beret') {
    c.stamp(
      1,
      2,
      [
        '..EE.....',
        '.3333333.',
        '222222222',
      ],
      hatR,
      UNIT_MATS,
    );
  } else if (hat === 'cap') {
    c.stamp(
      2,
      2,
      [
        '..33333..',
        '.2222222.',
        '1111111111',
      ],
      hatR,
      UNIT_MATS,
    );
  } else if (hat === 'hood') {
    c.stamp(
      2,
      2,
      [
        '..33333..',
        '.2222222.',
        '21.....12',
        '11.....11',
      ],
      hatR,
      UNIT_MATS,
    );
  } else if (hat === 'hardhat') {
    c.stamp(
      2,
      2,
      [
        '..33333..',
        '.22CCc22.',
        '222222222',
      ],
      MAT.gold,
      UNIT_MATS,
    );
  } else if (hat === 'helm') {
    c.stamp(
      2,
      1,
      [
        '...Rrr...',
        '...rqq...',
        '..33333..',
        '.2222222.',
        '1111o1111',
      ],
      MAT.steel,
      UNIT_MATS,
    );
  } else if (hat === 'warhelm') {
    c.stamp(
      1,
      1,
      [
        'I.........I',
        'Ii.33333.iI',
        '.i22RRR22i.',
        '..1111111..',
      ],
      hatR,
      UNIT_MATS,
    );
  } else if (hat === 'wizard') {
    c.stamp(
      1,
      1,
      [
        '.....33....',
        '....322....',
        '...22222...',
        '..YYYYYYY..',
        '22222222222',
      ],
      hatR,
      UNIT_MATS,
    );
  } else if (hat === 'miter') {
    c.stamp(
      2,
      1,
      [
        '...444...',
        '..4YYy4..',
        '.33Yg333.',
        '.YYYYYYY.',
      ],
      MAT.steel,
      UNIT_MATS,
    );
  } else if (hat === 'visor') {
    c.stamp(
      2,
      3,
      [
        '.3333333.',
        '2CCCCCCc2',
        '2CCuuuuU2',
        '.1111111.',
      ],
      MAT.steel,
      UNIT_MATS,
    );
  } else if (hat === 'horns') {
    c.stamp(
      1,
      2,
      [
        'I.........I',
        'Ii.33333.iI',
        '.i1111111i.',
      ],
      hatR,
      UNIT_MATS,
    );
  }

  // 4. Held Weapon / Prop (bold, readable shapes at x=10..14!)
  switch (opts.tool) {
    case 'staff':
      c.stamp(11, 2, ['Cc', 'uU', 'bK', 'bK', 'bK', 'bK', 'bK', 'bK', 'bK', 'bK'], MAT.wood, UNIT_MATS);
      break;
    case 'bow':
      c.stamp(
        11,
        3,
        [
          'Bb.',
          'I.b',
          'I.b',
          'I.b',
          'I.b',
          'I.b',
          'Bb.',
        ],
        MAT.wood,
        UNIT_MATS,
      );
      break;
    case 'axe':
      c.stamp(
        10,
        2,
        [
          '.SSs',
          'SSsm',
          '.SmM',
          '.bK.',
          '.bK.',
          '.bK.',
          '.bK.',
          '.bK.',
        ],
        MAT.wood,
        UNIT_MATS,
      );
      break;
    case 'basket':
      c.stamp(
        10,
        7,
        [
          '.Bb.',
          'RrEe',
          'BbbK',
          'bkkK',
        ],
        MAT.wood,
        UNIT_MATS,
      );
      break;
    case 'herb':
      c.stamp(
        10,
        6,
        [
          '.Rrr.',
          'RRIRr',
          '.IIi.',
          '.bKk.',
          '.bK..',
        ],
        MAT.wood,
        UNIT_MATS,
      );
      break;
    case 'pick':
      c.stamp(
        10,
        2,
        [
          'SSsm',
          's.bK',
          '..bK',
          '..bK',
          '..bK',
          '..bK',
          '..bK',
        ],
        MAT.wood,
        UNIT_MATS,
      );
      break;
    case 'hammer':
      c.stamp(
        10,
        2,
        [
          'SSss',
          'mmMM',
          '.bK.',
          '.bK.',
          '.bK.',
          '.bK.',
          '.bK.',
        ],
        MAT.wood,
        UNIT_MATS,
      );
      break;
    case 'sword':
      c.stamp(
        11,
        2,
        [
          'SS',
          'Ss',
          'sm',
          'sm',
          'mM',
          'Yg',
          'bK',
        ],
        MAT.steel,
        UNIT_MATS,
      );
      break;
    case 'ankh':
      c.stamp(
        11,
        2,
        [
          '.Yy.',
          'YYyg',
          '.gG.',
          'YggG',
          '.gG.',
          '.gG.',
          '.gG.',
        ],
        MAT.gold,
        UNIT_MATS,
      );
      break;
    case 'book':
      c.stamp(
        10,
        7,
        [
          'IIoII',
          'IioIi',
          'ijojJ',
          '.bKb.',
        ],
        MAT.parchment,
        UNIT_MATS,
      );
      break;
    case 'wrench':
      c.stamp(
        11,
        2,
        [
          'S.S',
          'SsS',
          '.m.',
          '.m.',
          '.m.',
          '.m.',
        ],
        MAT.steel,
        UNIT_MATS,
      );
      break;
    case 'dagger':
      c.stamp(
        11,
        4,
        [
          '.R',
          'SR',
          'sr',
          'mM',
          'Yg',
          'bK',
        ],
        MAT.steel,
        UNIT_MATS,
      );
      break;
  }
}

export const UNIT_SPRITES: Record<UnitRole, CompiledSprite> = {
  human: icon16((c) => draw16Unit(c, { tunic: MAT.azure, hair: MAT.wood, hat: 'hair', tool: 'staff' })),
  elf: icon16((c) => draw16Unit(c, { tunic: MAT.leaf, hair: MAT.gold, hat: 'hood', hatRamp: MAT.leaf, ears: true, tool: 'bow' })),
  orc: icon16((c) => draw16Unit(c, { tunic: MAT.ruby, skin: MAT.orcSkin, hair: MAT.darkIron, hat: 'hair', tusks: true, tool: 'axe' })),
  villager: icon16((c) => draw16Unit(c, { tunic: MAT.azure, hat: 'straw', tool: 'basket' })),
  forager: icon16((c) => draw16Unit(c, { tunic: MAT.wood, hat: 'beret', hatRamp: MAT.leaf, tool: 'herb' })),
  miner: icon16((c) => draw16Unit(c, { tunic: MAT.stone, beard: MAT.darkWood, hat: 'hardhat', tool: 'pick' })),
  builder: icon16((c) => draw16Unit(c, { tunic: MAT.copper, hat: 'cap', hatRamp: MAT.azure, tool: 'hammer' })),
  warrior: icon16((c) => draw16Unit(c, { tunic: MAT.ruby, hat: 'helm', shield: true, tool: 'sword' })),
  priest: icon16((c) => draw16Unit(c, { tunic: MAT.steel, hat: 'miter', stole: true, tool: 'ankh' })),
  scholar: icon16((c) => draw16Unit(c, { tunic: MAT.arcane, beard: MAT.steel, hat: 'wizard', hatRamp: MAT.arcane, tool: 'book' })),
  astro_engineer: icon16((c) => draw16Unit(c, { tunic: MAT.steel, hat: 'visor', tool: 'wrench' })),
  raider_swarmer: icon16((c) => draw16Unit(c, { tunic: MAT.ruby, skin: MAT.orcSkin, hat: 'warhelm', hatRamp: MAT.darkIron, bandana: true, tool: 'dagger' })),
  raider_ranged: icon16((c) => draw16Unit(c, { tunic: MAT.darkWood, skin: MAT.parchment, hat: 'hood', hatRamp: MAT.darkIron, bandana: true, tool: 'bow' })),
  raider_behemoth: icon16((c) => draw16Unit(c, { tunic: MAT.darkIron, skin: MAT.wood, hat: 'horns', hatRamp: MAT.darkIron, pauldrons: true, tool: 'hammer' })),

  // 16x16 Cute chubby pink piglet (distinct darker pink oval snout, floppy ear, curly tail)
  pig: cluster16(
    [
      '................',
      '................',
      '.....333333.....',
      '...3313333333...',
      '..33o33333333.3.',
      '.Www3333333332.3',
      '.wox33333333223.',
      '..ww222222221...',
      '...1222222211...',
      '...111111111....',
      '....22...22.....',
      '....11...11.....',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.pink,
    UNIT_MATS,
  ),

  // 16x16 Gleaming white dairy cow (black spots, curved ivory horns, bright pink muzzle, gold bell)
  cow: cluster16(
    [
      '................',
      '................',
      '.I............I.',
      '..I.4444DD44....',
      '..44444DDD443...',
      '..4o4444444334..',
      '.Www333DD3333.3.',
      '.Wox3Y3DD3332...',
      '..2233333322....',
      '...22222222.....',
      '...33....33.....',
      '...DD....DD.....',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Stocky grizzly bear with arched shoulders, round ears, separated eye & tan muzzle
  bear: cluster16(
    [
      '................',
      '................',
      '..33...33.......',
      '..223333222.....',
      '..23222222222...',
      '.23o3222222222..',
      '.dIiI222222221..',
      '.dIi2222222211..',
      '..11222222211...',
      '...111111111....',
      '...22....22.....',
      '...11....11.....',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.wood,
    UNIT_MATS,
  ),

  // 16x16 Sharp-eared silver-and-white wolf with bright chest ruff, dark nose & bushy tail
  wolf: cluster16(
    [
      '................',
      '................',
      '..3..33.........',
      '..223322........',
      '.do3222222...44.',
      '.3333222222.432.',
      '..4443222222221.',
      '....4432222111..',
      '....22111111....',
      '....22....22....',
      '....11....11....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Bright white hen with red comb, red wattle, yellow beak & feet
  chicken: cluster16(
    [
      '................',
      '................',
      '....Rrr.........',
      '.....rq.........',
      '...44443........',
      '..4o444Yyg......',
      '...Rr44333333...',
      '....4433333334..',
      '....333333332...',
      '.....2333322....',
      '......g..G......',
      '.....Yy..yg.....',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 UNMISTAKABLE Capybara: blocky rectangular snout, chill squinty eye, ear, plump body & round tangerine on head
  capybara: cluster16(
    [
      '................',
      '.....Ee.........',
      '...FFff.........',
      '...ffaa.........',
      '..3333333k......',
      '.333oo33322.....',
      '.d333333222222..',
      '..222222222222..',
      '...22222222221..',
      '...1122222211...',
      '....11111111....',
      '....22....22....',
      '....DD....DD....',
      '................',
      '................',
      '................',
    ],
    MAT.wood,
    UNIT_MATS,
  ),

  // 16x16 Emerald T-Rex dinosaur with open toothy jaw, tiny arms, cream belly & tail
  dinosaur: cluster16(
    [
      '................',
      '................',
      '.....333332.....',
      '....33o33322....',
      '....222IIII.....',
      '....222111......',
      '..3.222244......',
      '..2222IIi.......',
      '...222Iij.......',
      '....221j1.......',
      '.....1111.......',
      '.....22.22......',
      '.....11.11......',
      '................',
      '................',
      '................',
    ],
    MAT.leaf,
    UNIT_MATS,
  ),

  // 16x16 Unmistakable horned crimson dragon breathing horizontal fire jet with high spread wing, gold belly & tail
  dragon: cluster16(
    [
      '................',
      '.........333....',
      '.....I..33222...',
      '....332.222221..',
      '.FFf3Y2.22221...',
      '.ffaa.222222..2.',
      '......2Y2222.21.',
      '......2Yg22221..',
      '......2222221...',
      '.......22..22...',
      '.......11..11...',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.ruby,
    UNIT_MATS,
  ),

  // 16x16 Gleaming snow-white unicorn with golden spiral horn, pink/purple mane & gold hooves
  unicorn: cluster16(
    [
      '................',
      '..Y.............',
      '...y..44P.......',
      '..44443PPp......',
      '.4o4433Ppp......',
      '.3333333333p....',
      '...333333333pp..',
      '....33333332.P..',
      '.....33..33.....',
      '.....33..33.....',
      '.....Yy..Yy.....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Arching cobalt Leviathan sea serpent rising from bright white ocean waves
  leviathan: cluster16(
    [
      '................',
      '.....Cc.3332....',
      '....Ccu33Y222...',
      '....cu.222222...',
      '....Cc222III1...',
      '...Ccu221111....',
      '....222211......',
      '...222111.C.....',
      '..SS22111SSs....',
      '.SSss3222SssS...',
      '.222221111111...',
      '.111111111111...',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.azure,
    UNIT_MATS,
  ),
};
