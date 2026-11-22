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

  // 16x16 Graceful woodland stag deer with branching antlers, spotted fawn coat & white tail
  deer: cluster16(
    [
      '................',
      '.I.I..I.I.......',
      '..Ii..iI........',
      '...i33i.........',
      '..33o33.........',
      '.d3333..........',
      '...333333333I...',
      '....33I33I33II..',
      '....222222221...',
      '.....22...22....',
      '.....2....2.....',
      '.....D....D.....',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.wood,
    UNIT_MATS,
  ),

  // 16x16 Fluffy ivory sheep with cloud-like wool fleece, dark face & legs
  sheep: cluster16(
    [
      '................',
      '................',
      '.....44444......',
      '...444444443....',
      '..DD344444433...',
      '.DoD4444444333..',
      '.DDD3444444332..',
      '..33333333322...',
      '...222222222....',
      '....DD...DD.....',
      '....dd...dd.....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.parchment,
    UNIT_MATS,
  ),

  // 16x16 Cute hopping rabbit with tall pink-lined ears, bright eye & fluffy cotton tail
  rabbit: cluster16(
    [
      '................',
      '....3W..3W......',
      '....3w..3w......',
      '....33..33......',
      '...333333.......',
      '..33o3333.......',
      '.W333333333.....',
      '..22333333344...',
      '...2222222244...',
      '....22...22.....',
      '...111..111.....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.parchment,
    UNIT_MATS,
  ),

  // 16x16 Sly russet woodland fox with black-tipped ears, white chest & huge white-tipped tail
  fox: cluster16(
    [
      '................',
      '................',
      '..D...D.........',
      '..33.33.........',
      '..333333.....II.',
      '.d3o33333...33I.',
      '..II333333.3332.',
      '...II222222221..',
      '....222222211...',
      '....D2...D2.....',
      '....dd...dd.....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.flame,
    UNIT_MATS,
  ),

  // 16x16 Bristled wild boar with dark mohawk ridge, curved ivory tusks & sturdy hooves
  boar: cluster16(
    [
      '................',
      '................',
      '....DDDDDD......',
      '...333333332....',
      '..33o33333332...',
      '.I233333333221..',
      '.Ii2222222221.1.',
      '..22222222211...',
      '...111111111....',
      '....22...22.....',
      '....DD...DD.....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.wood,
    UNIT_MATS,
  ),

  // 16x16 Regal savanna lion with shaggy dark-amber mane, golden coat & tufted tail
  lion: cluster16(
    [
      '................',
      '................',
      '..kBBk..........',
      '.kB33Bk.........',
      '.k3o33Bk.....k..',
      '.kB333B3333..Bk.',
      '..kBBk333332..B.',
      '...kB333333222..',
      '....222222221...',
      '....22....22....',
      '....11....11....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.gold,
    UNIT_MATS,
  ),

  // 16x16 Colossal slate-gray elephant with broad ears, curved ivory tusk & long trunk
  elephant: cluster16(
    [
      '................',
      '................',
      '...333333332....',
      '..33332233332...',
      '.33o3212333332..',
      '.33332123333221.',
      '.32II222222221..',
      '.3.I2222222211..',
      '.2..222222221...',
      '.2..22....22....',
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

  // 16x16 Twin-humped desert camel with curved neck & warm sandy gold coat
  camel: cluster16(
    [
      '................',
      '................',
      '.333............',
      '.3o3....33..33..',
      '..33...3332333..',
      '..33..33333332..',
      '...33333333322..',
      '....222222221...',
      '.....22...22....',
      '.....2....2.....',
      '.....11...11....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.gold,
    UNIT_MATS,
  ),

  // 16x16 Tuxedo polar penguin with glossy black back, snow-white belly, golden beak & webbed feet
  penguin: cluster16(
    [
      '................',
      '................',
      '......DDDD......',
      '.....DD4oDD.....',
      '....YyD44DD.....',
      '.....D4444DD....',
      '....DD4444DDD...',
      '....DD4444DDD...',
      '.....D4444DD....',
      '.....DD33DD.....',
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

  // 16x16 Low-slung armored emerald crocodile with toothy jaws, dorsal ridge & sweeping tail
  crocodile: cluster16(
    [
      '................',
      '................',
      '................',
      '................',
      '......e.e.e.....',
      '..3333333332....',
      '.33o333333322...',
      '.2I2I2222222221.',
      '..11111111111221',
      '...22....22.....',
      '..111...111.....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.leaf,
    UNIT_MATS,
  ),

  // 16x16 Blazing Mythical Phoenix with golden crown, sweeping crimson-flame wings & radiant tail
  phoenix: cluster16(
    [
      '................',
      '..Y..Y....FF....',
      '...Yy....FFfF...',
      '...333..FFf33f..',
      '..Y3o33FFf3322..',
      '...3333333322...',
      '....33YY3322fF..',
      '.....2YY22FFfY..',
      '......22.ffYY...',
      '.....Y..Y.fY....',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.ruby,
    UNIT_MATS,
  ),

  // 16x16 Regal Mythical Griffin with snowy eagle head, golden beak, spread wings & lion body
  griffin: cluster16(
    [
      '................',
      '........444.....',
      '..444..44333....',
      '.Y4o44.433322...',
      '.g4444333322....',
      '...4433YY332..B.',
      '....33YYYY32.bB.',
      '.....YYYYY222...',
      '.....YY..YY.....',
      '.....gG..gG.....',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Hulking Frost Yeti with snow-white shoulders, ice-blue face, cyan eyes & curling horns
  yeti: cluster16(
    [
      '................',
      '..C........C....',
      '..Cc.4444.cC....',
      '...44444444.....',
      '..44uCuCu444....',
      '.444uuuuu4443...',
      '.443333333343...',
      '.333333333332...',
      '..3333333332....',
      '..333....333....',
      '..CC......CC....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Towering Ancient Stone Golem with mossy boulder shoulders & glowing amber rune core
  golem: cluster16(
    [
      '................',
      '.....EE333......',
      '....3333332.....',
      '..EE3YYoYY2EE...',
      '.3332222222332..',
      '.32222FFf22221..',
      '.22222FfY22221..',
      '.221.22222.121..',
      '..1..22.22..1...',
      '.....22.22......',
      '....111.111.....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Radiant Mythical Kitsune spirit fox with crimson-tipped ears, shrine bell & fanned spirit tails
  kitsune: cluster16(
    [
      '................',
      '...........R.P..',
      '..R..R....44R4..',
      '..44.44..44444P.',
      '..4o444..444444.',
      '.444444R444433R.',
      '...444RY444333..',
      '....444444332...',
      '....33...33.....',
      '....RR...RR.....',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Galloping chestnut horse with dark mane, white blaze & hooves
  horse: cluster16(
    [
      '................',
      '................',
      '...3D...........',
      '..I33D..........',
      '.I3o33D.........',
      '..3333D33333....',
      '....333333332D..',
      '....222222221D..',
      '.....22...22.d..',
      '.....2....2.....',
      '.....D....D.....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.wood,
    UNIT_MATS,
  ),

  // 16x16 Mountain goat with curved horns, white shaggy coat & chin beard
  goat: cluster16(
    [
      '................',
      '................',
      '....mm..........',
      '...m33m.........',
      '..33o33.........',
      '.3333333333.....',
      '..3.33333334....',
      '....33333322....',
      '....22222221....',
      '.....22..22.....',
      '.....DD..DD.....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Playful jungle monkey with tan face, big ears & curled tail
  monkey: cluster16(
    [
      '................',
      '................',
      '....3333........',
      '...i3II3i.......',
      '...iIoIoI....3..',
      '....3III3....3..',
      '....33I33...32..',
      '...333II33.22...',
      '...2.2222222....',
      '.....22.22......',
      '.....11.11......',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.wood,
    UNIT_MATS,
  ),

  // 16x16 Round black-and-white panda with dark ears, eye patches & bamboo paws
  panda: cluster16(
    [
      '................',
      '................',
      '..DD..DD........',
      '..444444........',
      '.4D444D4444.....',
      '.4o444o4DD444...',
      '..44D44DD4444...',
      '...4444DD4443...',
      '....DDDD3333D...',
      '....DDD..DDD....',
      '....dd....dd....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Heavy snow-white polar bear with black muzzle & broad paws
  polar_bear: cluster16(
    [
      '................',
      '................',
      '...44.44........',
      '..444444444.....',
      '.D4o444444443...',
      '.4444444444433..',
      '..444444444432..',
      '...3333333332...',
      '...333...333....',
      '...222...222....',
      '...111...111....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Barrel-bodied river hippo with wide square snout & tusks
  hippo: cluster16(
    [
      '................',
      '................',
      '................',
      '...3.3.33333....',
      '..33333333332...',
      '.33o3333333332..',
      '.2222222222221..',
      '.2I2I222222211..',
      '...222222221....',
      '...22....22.....',
      '...11....11.....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.arcane,
    UNIT_MATS,
  ),

  // 16x16 Armored gray rhino with prominent curved ivory nose horn
  rhino: cluster16(
    [
      '................',
      '................',
      '.I..............',
      '.II..3.3333.....',
      '.33I333333332...',
      '.33o3223333332..',
      '..222222222221..',
      '...22222222211..',
      '...22....22.....',
      '...11....11.....',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Green-shelled coastal turtle with domed carapace & short legs
  turtle: cluster16(
    [
      '................',
      '................',
      '................',
      '................',
      '......3333......',
      '....33233233....',
      '..EE333223332...',
      '.EoE222222221...',
      '..E.bbbbbbbb1...',
      '....EE...EE.....',
      '....ll...ll.....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.leaf,
    UNIT_MATS,
  ),

  // 16x16 Bright green swamp frog with big golden eyes & springy hind legs
  frog: cluster16(
    [
      '................',
      '................',
      '................',
      '.....Yo..Yo.....',
      '....3333333.....',
      '...333333333....',
      '...334444433....',
      '..32222222223...',
      '..22.22222.22...',
      '.111.1...1.111..',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.leaf,
    UNIT_MATS,
  ),

  // 16x16 Red beach crab with raised orange pincers & stalked eyes
  crab: cluster16(
    [
      '................',
      '................',
      '..FF........FF..',
      '.FFf..o..o..fFF.',
      '..FF..3..3..FF..',
      '...f.333333.f...',
      '....33333333....',
      '...3222222223...',
      '..2..222222..2..',
      '.1..1.1..1.1..1.',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.ruby,
    UNIT_MATS,
  ),

  // 16x16 Five-headed coiled Hydra sea-serpent with glowing green bio-laser throats
  hydra: cluster16(
    [
      '................',
      '..E...33...E....',
      '.3o3.3Yo3.3o3...',
      '..3E..3E..E3....',
      '3o3.333E333.3o3.',
      '.3E..33333..E3..',
      '..33333333333...',
      '....22333322....',
      '...2333333332...',
      '..233222222332..',
      '..122222222221..',
      '...1112222111...',
      '.....111111.....',
      '................',
      '................',
      '................',
    ],
    MAT.leaf,
    UNIT_MATS,
  ),

  // 16x16 Hulking bull-headed Minotaur warrior with ivory horns & steel battle-axe
  minotaur: cluster16(
    [
      '................',
      '.I......I.......',
      '.II.33.II....SS.',
      '..I3YoY3I...SSs.',
      '...33333....Smm.',
      '..Y33333Y..bB...',
      '.Y2233322Y.b....',
      '.22.222.22b.....',
      '....YYY.........',
      '....22.22.......',
      '....DD.DD.......',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.wood,
    UNIT_MATS,
  ),

  // 16x16 Winged snow-white Pegasus with sky-blue mane, golden hooves & feathered wings
  pegasus: cluster16(
    [
      '................',
      '.......4444.....',
      '..44..444CC3....',
      '.4o4C.44CCC2....',
      '..44C4444442....',
      '...444444443CC..',
      '....44444433C...',
      '....33333332....',
      '.....33..33.....',
      '.....YY..YY.....',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Three-headed obsidian Cerberus hellhound with fiery eyes & glowing magma collar
  cerberus: cluster16(
    [
      '................',
      '.DD..DD..DD.....',
      'DRoD.DRoDDRoD...',
      '.DD..DD..DD.....',
      '..FFFFFFFF......',
      '...DDDDDDDD2....',
      '...DD2222222F...',
      '....22222221....',
      '....DD...DD.....',
      '....FF...FF.....',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.darkIron,
    UNIT_MATS,
  ),

  // 16x16 Ancient walking Treant with lush leaf crown, glowing green eyes & bark limbs
  ent: cluster16(
    [
      '................',
      '....EEEEEE......',
      '...EEEEeeEE.....',
      '..EEe3333eEE....',
      '...e3E33E3e.....',
      '..3.333333.3....',
      '.33.332233.33...',
      '.E..322223..E...',
      '....222222......',
      '....22..22......',
      '...111..111.....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.wood,
    UNIT_MATS,
  ),

  // 16x16 Tall spotted savanna Giraffe with ossicones & long graceful neck
  giraffe: cluster16(
    [
      '................',
      '....b.b.........',
      '...3333.........',
      '..3o333.........',
      '....3b3.........',
      '....33b.........',
      '....b33.........',
      '....33b3333.....',
      '....3b33b33b....',
      '....333b3332....',
      '....22....22....',
      '....22....22....',
      '....22....22....',
      '....KK....KK....',
      '................',
      '................',
    ],
    MAT.gold,
    UNIT_MATS,
  ),

  // 16x16 Striped black-and-white savanna Zebra with upright striped mane
  zebra: cluster16(
    [
      '................',
      '................',
      '...D4D..........',
      '..4o4D4.........',
      '...D4D4.........',
      '....4D44D4D4....',
      '....D4D4D4D4D...',
      '....4D44D4D4.D..',
      '....3D33D3D3....',
      '....4D....4D....',
      '....D4....D4....',
      '....DD....DD....',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Striped orange jungle Tiger with white chin & bold black stripes
  tiger: cluster16(
    [
      '................',
      '................',
      '................',
      '..3..3..........',
      '.3o33o3.........',
      '.3I33I33D3D3D...',
      '..3333D33D33D3..',
      '...3333D33D33.D.',
      '...2222222222.3.',
      '...22......22...',
      '...II......II...',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.flame,
    UNIT_MATS,
  ),

  // 16x16 Broad-shouldered silverback Gorilla on strong knuckles
  gorilla: cluster16(
    [
      '................',
      '................',
      '.....2222.......',
      '....233332......',
      '....2o22o2......',
      '...22SSSS22.....',
      '..22SSSSSS22....',
      '.2222SSSS2222...',
      '.222.2222.222...',
      '.22..2222..22...',
      '.11..22.22.11...',
      '.....11.11......',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.darkIron,
    UNIT_MATS,
  ),

  // 16x16 Spring-loaded sandy Kangaroo with tall ears, pouch & balancing tail
  kangaroo: cluster16(
    [
      '................',
      '....3.3.........',
      '....333.........',
      '...3o33.........',
      '.....33.........',
      '....3333........',
      '...33II33.......',
      '....33II33......',
      '.....333333.....',
      '.....222..222...',
      '....22......22..',
      '...1111.........',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.wood,
    UNIT_MATS,
  ),

  // 16x16 Towering northern Moose with broad palmate antlers
  moose: cluster16(
    [
      '................',
      '.I.I...I.I......',
      'IIIII.IIIII.....',
      '..II333II.......',
      '..3o3333........',
      '...33333333.....',
      '....333333332...',
      '....222222222...',
      '.....22...22....',
      '.....22...22....',
      '.....11...11....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.wood,
    UNIT_MATS,
  ),

  // 16x16 Shaggy dark-brown plains Bison with massive hunched shoulders & curved horns
  bison: cluster16(
    [
      '................',
      '................',
      '..I..2222.......',
      '.I22222222......',
      '.2o222222233....',
      '..222222223332..',
      '..222222222222..',
      '...1111111111...',
      '....22....22....',
      '....11....11....',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.wood,
    UNIT_MATS,
  ),

  // 16x16 Tall pink wading Flamingo with curved neck & black-tipped beak
  flamingo: cluster16(
    [
      '................',
      '....333.........',
      '...Do33.........',
      '.....33.........',
      '.....33.........',
      '....333333......',
      '...333443332....',
      '....2222222.....',
      '......3.........',
      '......33........',
      '......3.3.......',
      '......3.........',
      '.....222........',
      '................',
      '................',
      '................',
    ],
    MAT.pink,
    UNIT_MATS,
  ),

  // 16x16 Fast-sprinting Ostrich with long pale neck, black body & white tail plumes
  ostrich: cluster16(
    [
      '................',
      '....II..........',
      '...YoI..........',
      '.....I..........',
      '.....I..........',
      '....222222......',
      '...2222222SS....',
      '....2222222S....',
      '.....11111......',
      '......I..I......',
      '......I..I......',
      '.....II..II.....',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.darkIron,
    UNIT_MATS,
  ),

  // 16x16 Sleek silver-grey Arctic Seal with dark whiskers & flippers
  seal: cluster16(
    [
      '................',
      '................',
      '................',
      '................',
      '...333..........',
      '..3o333.........',
      '..3D333333......',
      '...333333333....',
      '....2222222222..',
      '...222.2222.221.',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Crowned desert Basilisk serpent with glowing lime petrifying eyes
  basilisk: cluster16(
    [
      '................',
      '....Y.Y.Y.......',
      '...333333.......',
      '..3Eo33Eo3......',
      '...333333.......',
      '....233322......',
      '.....233332.....',
      '...22333332.....',
      '..2333222232....',
      '..2332....232...',
      '...1222222211...',
      '.....11111......',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.leaf,
    UNIT_MATS,
  ),

  // 16x16 Electric sky Thunderbird eagle crackling with cyan lightning arcs
  thunderbird: cluster16(
    [
      '................',
      '..C....YY....C..',
      '.CC3..3Yo3..3CC.',
      'C3333.3333.3333C',
      '.33333333333333.',
      '..2233CCCC3322..',
      '...2233333322...',
      '.....233332.....',
      '....C.2222.C....',
      '.....YY..YY.....',
      '.....C....C.....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.azure,
    UNIT_MATS,
  ),

  // 16x16 Deep-sea violet Kraken squid with glowing golden eyes & writhing tentacles
  kraken: cluster16(
    [
      '................',
      '.....3333.......',
      '....334433......',
      '...33333333.....',
      '...33333333.....',
      '...3Yo33Yo3.....',
      '....222222......',
      '..3.223322.3....',
      '.32.2.22.2.23...',
      '.2..2.22.2..2...',
      '..2.1.11.1.2....',
      '...1..11..1.....',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.arcane,
    UNIT_MATS,
  ),

  // 16x16 Winged crimson Manticore lion with arched green-tipped scorpion tail
  manticore: cluster16(
    [
      '................',
      '...........EE...',
      '....DD....E33...',
      '..33DD33....3...',
      '.3o33333D...3...',
      '..333333DD..3...',
      '...3333333333...',
      '....22222222....',
      '....22....22....',
      '....11....11....',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.ruby,
    UNIT_MATS,
  ),

  // 16x16 Horned stone Gargoyle sentinel with bat wings & glowing amber eyes
  gargoyle: cluster16(
    [
      '................',
      '..2........2....',
      '.222.2..2.222...',
      '2233.3333.3322..',
      '2333.3Yo3.3332..',
      '.223333333322...',
      '..2.233332.2....',
      '....223322......',
      '....22..22......',
      '...111..111.....',
      '..1111111111....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Necrotic Skeleton Warrior with glowing purple eyes, ribcage & rusty sword
  skeleton: cluster16(
    [
      '................',
      '.....33332......',
      '....3333322.....',
      '....3P33P21.....',
      '....332o221..S..',
      '.....23231...S..',
      '....333321..Ss..',
      '...2.3221..sm...',
      '.....2321.Yg....',
      '.....2.2.bK.....',
      '.....2.2........',
      '.....1.1........',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.parchment,
    UNIT_MATS,
  ),

  // 16x16 Xeno Shock Trooper with sleek dark visor helmet & glowing plasma rifle
  alien_trooper: cluster16(
    [
      '................',
      '.....33332......',
      '....3333322.....',
      '....3CCCC21.....',
      '....2Cuuu11.....',
      '....222221......',
      '...3332221.RRr..',
      '...2222211MmmMM.',
      '....22.22..mM...',
      '....22.22.......',
      '....11.11.......',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.arcane,
    UNIT_MATS,
  ),

  // 16x16 Metallic Xeno Flying Saucer UFO with translucent cyan dome & underside thruster lights
  alien_ufo: cluster16(
    [
      '................',
      '................',
      '......CCcc......',
      '.....CcuuuC.....',
      '....CCuuuuUC....',
      '..33333333332...',
      '.3332222222211..',
      '.2R2C2R2C2R2C1..',
      '..11111111111...',
      '.....DDDDD......',
      '......cUc.......',
      '.......u........',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Towering 4-legged Star-Wars-style armored AT-AT Assault Walker mech
  alien_walker: cluster16(
    [
      '................',
      '..33333332......',
      '..32222221.3332.',
      '..2222222122RR1.',
      '..111111111111..',
      '...22..22...mm..',
      '...22..22.......',
      '...mm..mm.......',
      '...22..22.......',
      '...22..22.......',
      '..mMM..mMM......',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    UNIT_MATS,
  ),

  // 16x16 Dark-purple Blight Giant Spider with glowing toxic green eyes, markings & 8 legs
  giant_spider: cluster16(
    [
      '................',
      '..3....33....3..',
      '.32...3EE3...23.',
      '.2...333333...2.',
      '..23.33EE33.32..',
      '...2332222332...',
      '..32.233332.23..',
      '.32..3EoEE3..23.',
      '.2..32333323..2.',
      '..23..E..E..32..',
      '.32..........23.',
      '.1............1.',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.arcane,
    UNIT_MATS,
  ),

  // 16x16 Golden-lime glowing Firefly
  firefly: cluster16(
    [
      '................',
      '................',
      '....ee....ee....',
      '...e44e..e44e...',
      '...e44e..e44e...',
      '....ee2222ee....',
      '.....233332.....',
      '.....2GGGG2.....',
      '....GGGGGGGG....',
      '....GG4444GG....',
      '.....GGGGGG.....',
      '......GGGG......',
      '.......GG.......',
      '................',
      '................',
      '................',
    ],
    MAT.gold,
    UNIT_MATS,
  ),

  // 16x16 Cyan-mint luminescent Luna Moth
  glow_moth: cluster16(
    [
      '................',
      '.....4....4.....',
      '..CC..4..4..CC..',
      '.C44C.2332.C44C.',
      '.C44CC3333CC44C.',
      '.CC4443333444CC.',
      '..CCC433334CCC..',
      '...CC333333CC...',
      '...C4C2332C4C...',
      '..C44C.22.C44C..',
      '..CC4C....C4CC..',
      '...CC......CC...',
      '....C......C....',
      '................',
      '................',
      '................',
    ],
    MAT.azure,
    UNIT_MATS,
  ),

  // 16x16 Bioluminescent Lantern Jelly
  lantern_jelly: cluster16(
    [
      '................',
      '......CCCC......',
      '....CC4444CC....',
      '...C44GGGG44C...',
      '...C4GGGGGG4C...',
      '..CC44444444CC..',
      '..CCCCCCCCCCCC..',
      '...C..C..C..C...',
      '...4..C..4..C...',
      '..C...4..C...4..',
      '..4...C..4...C..',
      '...C..4...C..4..',
      '...4..C...4..C..',
      '......4......4..',
      '................',
      '................',
    ],
    MAT.azure,
    UNIT_MATS,
  ),

  // 16x16 Radiant Pink-Gold Fairy
  fairy: cluster16(
    [
      '................',
      '.......GG.......',
      '..PP..G44G..PP..',
      '.P44P.4444.P44P.',
      '.P44PP2332PP44P.',
      '..PPP244442PPP..',
      '...PP.4GG4.PP...',
      '..P4P.GGGG.P4P..',
      '..PP..4GG4..PP..',
      '......4444......',
      '.....4P..P4.....',
      '.....4....4.....',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.pink,
    UNIT_MATS,
  ),

  // 16x16 Emerald-Violet Fae Spirit
  fae: cluster16(
    [
      '................',
      '......EEEE......',
      '..EE..E44E..EE..',
      '.E44E.3443.E44E.',
      '.E44EE3333EE44E.',
      '..EEEE3EE3EEEE..',
      '...EE.EEEE.EE...',
      '..E4E.3EE3.E4E..',
      '..EE..3333..EE..',
      '.....3E..E3.....',
      '.....E....E.....',
      '....4......4....',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.leaf,
    UNIT_MATS,
  ),

  // 16x16 Floating Ethereal Blue-Cyan Will-o'-Wisp
  will_o_wisp: cluster16(
    [
      '................',
      '.......C........',
      '......CCC.......',
      '.....C444C......',
      '....CC444CC.....',
      '...C4444444C....',
      '...C4444444C....',
      '...C4444444C....',
      '....CC444CC.....',
      '.....CCCCC......',
      '....C..C..C.....',
      '.......C........',
      '......C.........',
      '................',
      '................',
      '................',
    ],
    MAT.azure,
    UNIT_MATS,
  ),
};

