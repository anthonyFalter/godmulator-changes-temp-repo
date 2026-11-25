import type { Resources, TerrainToolType, ToolCategory, ZoneOverlayType } from '../../game/types';
import { type CompiledSprite, MAT, type MatLegend, cluster16, icon16 } from './pixelEngine';

const MATS: MatLegend = {
  // Gold
  Y: { ramp: MAT.gold, tone: 4 },
  y: { ramp: MAT.gold, tone: 3 },
  g: { ramp: MAT.gold, tone: 2 },
  G: { ramp: MAT.gold, tone: 1 },
  // Wood
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
  // Stone
  N: { ramp: MAT.stone, tone: 4 },
  n: { ramp: MAT.stone, tone: 3 },
  h: { ramp: MAT.stone, tone: 2 },
  H: { ramp: MAT.stone, tone: 1 },
  // Copper / Terracotta
  X: { ramp: MAT.copper, tone: 4 },
  x: { ramp: MAT.copper, tone: 3 },
  v: { ramp: MAT.copper, tone: 2 },
  V: { ramp: MAT.copper, tone: 1 },
  // Dark Iron (shadow creases / rivets)
  D: { ramp: MAT.darkIron, tone: 1 },
  d: { ramp: MAT.darkIron, tone: 0 },
};

export const TITLE_EMBLEM_SPRITE: CompiledSprite = cluster16(
  [
    '................',
    '.......yY.......',
    '....y..CC..y....',
    '....g.CuuC.g....',
    '..3...gGGg...3..',
    '..33..3333..33..',
    '..232322223232..',
    '..2222bkkb2222..',
    '..222kbBBbk222..',
    '...22kbCCbk22...',
    '...12kbccbk21...',
    '....1kbkkbk1....',
    '.....111111.....',
    '................',
    '................',
    '................',
  ],
  MAT.gold,
  MATS,
);

export const RESOURCE_SPRITES: Record<keyof Resources, CompiledSprite> = {
  // 16x16 Crisp flat-shaded crimson apple with emerald leaf (inspired by ref sheet 1 strawberry)
  food: cluster16(
    [
      '................',
      '........b..eE...',
      '.......bk.eel...',
      '.....221kllL....',
      '...2332112222...',
      '..243222222222..',
      '..232222222222..',
      '..222222222222..',
      '..222222222221..',
      '..222222222211..',
      '...1222222211...',
      '...1122222111...',
      '....111o1111....',
      '.....11.111.....',
      '................',
      '................',
    ],
    MAT.ruby,
    MATS,
  ),

  // 16x16 Diagonal oak log with bright spiral cut-end & textured bark stripes (matching ref log)
  wood: cluster16(
    [
      '................',
      '.........Ee.....',
      '........el.222..',
      '.......el.23321.',
      '......222222221.',
      '....23322112211.',
      '...22211222221..',
      '..2Iii22221121..',
      '.2IijIi212221...',
      '.2iJjJi22111....',
      '.2iJjiI1111.....',
      '.1iIii2111......',
      '..1JJJ111.......',
      '...1111.........',
      '................',
      '................',
    ],
    MAT.wood,
    MATS,
  ),

  // 16x16 Crisp planar stone boulders (top plane lit, front flat, bottom shadowed)
  stone: cluster16(
    [
      '................',
      '................',
      '....33333.......',
      '...33333322.....',
      '..2222222222....',
      '..2222222222....',
      '..1222223332....',
      '..11111333332...',
      '...1111222222...',
      '....111122211...',
      '........1111....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.stone,
    MATS,
  ),

  // 16x16 Slate ore boulders studded with chunky golden nuggets
  ore: cluster16(
    [
      '................',
      '................',
      '....33333.......',
      '...3Yy3332..33..',
      '..2Yyg2222.3Yy2.',
      '..22gg2222.2yg1.',
      '..2222Yy21.111..',
      '..122YygG1......',
      '...111ggG1......',
      '....11111.......',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.darkIron,
    MATS,
  ),

  // 16x16 Flat-planed isometric spellbook grimoire (clean cover + cream pages + cyan rune)
  knowledge: cluster16(
    [
      '................',
      '.......Yy222....',
      '.....22yg2222...',
      '....2222CC222...',
      '...2222Ccc222...',
      '..Yyg222uu22y...',
      '.YygG1111111Ii..',
      '.Iii111111IIij..',
      '.IIiij11IIiijJ..',
      '..IIiijjIijjjJ..',
      '...IIiijjjrjJ...',
      '....JJjjjRrJ....',
      '.....JJJrqJ.....',
      '................',
      '................',
      '................',
    ],
    MAT.arcane,
    MATS,
  ),

  // 16x16 Classic RPG corked mana flask (glass streak on rim, solid vivid azure body, pool shadow)
  energy: cluster16(
    [
      '................',
      '..........Bb....',
      '.........Bbk....',
      '........Sskk....',
      '.......Ss2sM....',
      '......Ss22sM....',
      '.....SsS22uM....',
      '....SsS22222M...',
      '...SsS222222M...',
      '...sS222222UM...',
      '...s222222UUM...',
      '...s12222UUM....',
      '....s1111UM.....',
      '.....MMMMM......',
      '................',
      '................',
    ],
    MAT.azure,
    MATS,
  ),

  // 16x16 Clean 3-plane isometric steel bar (flat bright top, clean mid front, dark end)
  alloy: cluster16(
    [
      '................',
      '................',
      '.......333......',
      '.....3333311....',
      '...3333333111...',
      '..333333331111..',
      '..244433311111..',
      '..222244411111..',
      '..22222221111...',
      '...222221111....',
      '....2221111.....',
      '.....11111......',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    MATS,
  ),

  // 16x16 Symmetrical golden sunburst emblem with sapphire core
  faith: cluster16(
    [
      '................',
      '.......33.......',
      '..33...22...33..',
      '...22.2222.22...',
      '....22CCcc22....',
      '..322CCccuu221..',
      '..222ccuuuU111..',
      '....22uUUU21....',
      '...21.2221.12...',
      '..21...11...12..',
      '.......11.......',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.gold,
    MATS,
  ),
};

export const TAB_SPRITES: Record<ToolCategory, CompiledSprite> = {
  // 16x16 Diagonal oak staff holding glowing cyan star gem
  powers: cluster16(
    [
      '................',
      '.........333....',
      '........3CCc2...',
      '........Cccu2...',
      '........cuuu1...',
      '.......22uU11...',
      '......B22222....',
      '.....Bbk11......',
      '....BbkK........',
      '...BbkK.........',
      '..BbkK..........',
      '.3bkK...........',
      '.21.............',
      '................',
      '................',
      '................',
    ],
    MAT.gold,
    MATS,
  ),

  // 16x16 Flat-planed 2:1 isometric grass tile with snow-peaked mountain
  terrain: icon16((c) => {
    c.isoTile(MAT.leaf, MAT.wood, MAT.darkWood, 13, 4);
    c.stamp(
      4,
      2,
      [
        '...SS...',
        '..SSss..',
        '.222211.',
        '22222111',
      ],
      MAT.stone,
      MATS,
    );
  }),


  // 16x16 Symmetrical RPG adventurer bust (top hair crown, clean face, symmetrical tunic)
  spawn: cluster16(
    [
      '................',
      '.....BBBBb......',
      '....bbbbbbk.....',
      '....b22222k.....',
      '....b3o33o2.....',
      '.....33332......',
      '....yY222yg.....',
      '...yYcuuucgg....',
      '...2ccuuuuc21...',
      '...2cuYYuuc11...',
      '....bkkkkK......',
      '....KK..KK......',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.skin,
    MATS,
  ),

  // 16x16 Terrestrial globe in symmetric brass meridian cradle
  zones: cluster16(
    [
      '................',
      '.....SSSS.......',
      '...22Ee222y.....',
      '..22Eeel222g....',
      '..222eel2ee1g...',
      '..222222eel1g...',
      '...2ee22ll1g....',
      '....1ell22y.....',
      '.....yggggg.....',
      '.......gG.......',
      '....yyyyyyy.....',
      '....GGGGGGG.....',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.azure,
    MATS,
  ),

  // 16x16 Centered parchment scroll with symmetric wooden rollers & crimson wax seal (shared by rules tab & log HUD icon)
  rules: cluster16(
    [
      '................',
      '................',
      '.yBBBBBBBBBBBBy.',
      '.gKKKKKKKKKKKKg.',
      '...3333333333...',
      '...2JJJJJ2222...',
      '...2222222222...',
      '...2JJJJ22Rr2...',
      '...222222Rrq2...',
      '...2JJJ222rq2...',
      '...2222222222...',
      '...2222222221...',
      '.yBBBBBBBBBBBBy.',
      '.gKKKKKKKKKKKKg.',
      '................',
      '................',
    ],
    MAT.parchment,
    MATS,
  ),

  // 16x16 Symmetrical brass hourglass pouring gold sand
  epochs: cluster16(
    [
      '................',
      '..3333333333....',
      '..2222222221....',
      '...bScccCSk.....',
      '...bScYYcSk.....',
      '....bScySk......',
      '.....bSYk.......',
      '.....bSYk.......',
      '....bScYSk......',
      '...bScYYYcSk....',
      '..3333333333....',
      '..1111111111....',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.gold,
    MATS,
  ),

  // 16x16 Brass magnifying glass with clean sky-blue lens & diagonal glass streak
  inspect: cluster16(
    [
      '................',
      '...33333........',
      '..32CCcc22......',
      '.32CCccuu22.....',
      '.32Cccuuu22.....',
      '.22ccuuuu12.....',
      '.21uuuuuu1b.....',
      '..1111111Bbk....',
      '.........BbkK...',
      '..........bkK...',
      '...........kK...',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.gold,
    MATS,
  ),
};

export const ZONE_SPRITES: Record<ZoneOverlayType, CompiledSprite> = {
  // 16x16 Gold-trimmed heraldic kingdom nameplate banner with text lines
  kingdomLabels: cluster16(
    [
      '................',
      '................',
      '......YYYY......',
      '.YYYYYYYYYYYYYY.',
      '.Y111111111111y.',
      '.Y1RR133333311y.',
      '.Y1rq111111111y.',
      '.Y111122222111y.',
      '.Y111111111111y.',
      '.yyyyyyyyyyyyyy.',
      '......gG........',
      '......gG........',
      '.....ggGG.......',
      '................',
      '................',
      '................',
    ],
    MAT.stone,
    MATS,
  ),

  // 16x16 Symmetrical fortified castle keep with top battlements & recessed oak gate
  kingdoms: cluster16(
    [
      '................',
      '................',
      '..Rr.......Rr...',
      '..qq.......qq...',
      '..33..333..33...',
      '.2221222212221..',
      '.2221222212221..',
      '.2222222222221..',
      '.2222bkkb22221..',
      '.2221bBbk12221..',
      '.1111bBbk11111..',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.stone,
    MATS,
  ),

  // 16x16 Symmetrical royal 3-point golden crown with jewels & velvety shadow rim
  kings: cluster16(
    [
      '................',
      '................',
      '.......43.......',
      '..33...33...33..',
      '..32..3321..22..',
      '..22R.2221.q22..',
      '..22rq2221rq21..',
      '..333333333322..',
      '..22cc2RR2ee21..',
      '..22uU2rq2lL11..',
      '..111111111111..',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.gold,
    MATS,
  ),

  // 16x16 Gold-trimmed emerald heraldic shield (flat emerald center + golden trim)
  territories: cluster16(
    [
      '................',
      '................',
      '..YYYYyyyygggg..',
      '.Yy2222222221g..',
      '.Yg22Yy222221g..',
      '.Yg2Yyyg22211G..',
      '.Yg22ggG2b211G..',
      '..Yg22222b11G...',
      '..Yg12222b11G...',
      '...Yg111111G....',
      '....Yg1111G.....',
      '.....YgggG......',
      '......gGG.......',
      '................',
      '................',
      '................',
    ],
    MAT.leaf,
    MATS,
  ),

  // 16x16 Clean 4-quadrant isometric earth tile
  biomes: icon16((c) => {
    c.isoTile(MAT.leaf, MAT.wood, MAT.darkWood, 12, 4, (x, y, cx, cy) => {
      if (x <= cx && y < cy) return { ramp: MAT.steel, tone: 3 };
      if (x > cx && y < cy) return { ramp: MAT.gold, tone: 3 };
      if (x <= cx && y >= cy) return { ramp: MAT.leaf, tone: 3 };
      return { ramp: MAT.azure, tone: 3 };
    });
  }),

  // 16x16 Crossed azure & crimson faction banners bound by golden pact clasp
  alliances: cluster16(
    [
      '................',
      '.Y............Y.',
      '.BCCCC....RRRRb.',
      '.Bcccu....RrrrK.',
      '.BuuuU....qqqqK.',
      '..Bbk......Bbk..',
      '...Bbk....Bbk...',
      '....Bbk..Bbk....',
      '......YYYY......',
      '.....bggggk.....',
      '....bk....bk....',
      '...kK......Kk...',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.gold,
    MATS,
  ),

  // 16x16 Symmetrical glass thermometer (steel rim left & right, clear glass center, red bulb)
  temperature: cluster16(
    [
      '................',
      '......3333......',
      '.....3CCcc2.....',
      '.....3ccuu2.....',
      '.....2uuuu1.....',
      '.....2RRRR1.....',
      '.....2rrrr1.....',
      '....32Rrrr21....',
      '...32Rrrrrq21...',
      '...22rrrrqq11...',
      '...11qqqqQQ11...',
      '....11111111....',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    MATS,
  ),
};

export const TERRAIN_SPRITES: Record<TerrainToolType, CompiledSprite> = {
  raise: cluster16(
    [
      '.......YY.......',
      '......YyyY......',
      '.....YyyggY.....',
      '....YygggggY....',
      '......yggG......',
      '......yggG......',
      '.....EEeeEE.....',
      '....EeelleeE....',
      '...EeeelleeeE...',
      '..EllbBbbBblLE..',
      '..llbbkBkkbbll..',
      '.lbkkBkkkkBkkbl.',
      '.bkkKkkkkkkKkkb.',
      '.kkKKkKKKKkKKkk.',
      '..KKKKKKKKKKKK..',
      '................',
    ],
    MAT.leaf,
    MATS,
  ),

  lower: cluster16(
    [
      '......FffF......',
      '......FffA......',
      '......faaA......',
      '....FffaaaAF....',
      '.....faaaAA.....',
      '......aaAA......',
      '.EEee..AA..eeEE.',
      '.EelLE....ELleE.',
      '.bbkL......Lkbb.',
      '.bkkK.uUUu.Kkkb.',
      '.kkK.CuuuuC.Kkk.',
      '.kkK.uuuuUU.Kkk.',
      '.kKKKUUUUUUKKKk.',
      '..KKKKKKKKKKKK..',
      '................',
      '................',
    ],
    MAT.flame,
    MATS,
  ),

  flatten: cluster16(
    [
      '................',
      '......yYYy......',
      '.....YgGGgY.....',
      '..YYYYYYYYYYYY..',
      '.YyyIICCIIyygGY.',
      '.YggGGGGGGGGGGY.',
      '..GGGGGGGGGGGG..',
      '................',
      '.NNNNNNNNNNNNNN.',
      '.NnnnnhhhhnnnNN.',
      '.nhhHHhhhhHHhhn.',
      '.hhHHHhHHhHHHhh.',
      '.kHHkHHHHHHkHHk.',
      '..HHHHHHHHHHHH..',
      '................',
      '................',
    ],
    MAT.stone,
    MATS,
  ),

  fertile_meadow: icon16((c) => {
    c.isoTile(MAT.leaf, MAT.wood, MAT.darkWood, 14, 3);
    c.stamp(
      3,
      3,
      [
        '.Yy....Rr.',
        'YgG...Rrq.',
        '.l.....l..',
        '.l.....L..',
      ],
      MAT.leaf,
      MATS,
    );
  }),

  plant_forest: icon16((c) => {
    c.isoTile(MAT.leaf, MAT.wood, MAT.darkWood, 14, 3);
    c.stamp(
      2,
      2,
      [
        '..332.....',
        '.33221.32.',
        '.222212221',
        '..111.1111',
        '...k...k..',
      ],
      MAT.leaf,
      MATS,
    );
  }),

  seed_ore: icon16((c) => {
    c.isoTile(MAT.darkIron, MAT.stone, MAT.darkIron, 14, 3);
    c.stamp(
      3,
      3,
      [
        '.33...32.',
        '3322.3321',
        '2211.2211',
      ],
      MAT.gold,
      MATS,
    );
  }),

  carve_river: icon16((c) => {
    c.isoTile(MAT.leaf, MAT.wood, MAT.darkWood, 12, 4, (x, y) => {
      const band = Math.abs(x - 7.5 + (y - 6) * 1.4);
      if (band <= 1.5) return { ramp: MAT.azure, tone: 3 };
      if (band <= 2.4) return { ramp: MAT.azure, tone: 2 };
      return null;
    });
  }),

  stone_road: cluster16(
    [
      '................',
      '......EeNN......',
      '.....EelNnh.....',
      '....EelNnnH.....',
      '....elNnnHnE....',
      '...EelNnhNnle...',
      '...elNnnHnnle...',
      '..EelNnhNnhnle..',
      '..elNnnHnnnHle..',
      '..elNnhHnnnhle..',
      '.EelNnnHNnnHle..',
      '.elNnnHHnnnhHle.',
      '.elNnhHHnnnhHle.',
      '.LLNnnHHnnnhHLL.',
      '..LHHHHHHHHHHLL.',
      '................',
    ],
    MAT.stone,
    MATS,
  ),

  rail_track: cluster16(
    [
      '................',
      '.....S....S.....',
      '....SsbkkbsS....',
      '....SsmkkmsS....',
      '....Ss....sS....',
      '...SsbBkkBbsS...',
      '...SsmkkkkmsS...',
      '...Ss......sS...',
      '..SsbBkkkkBbsS..',
      '..SsmkKKKKkmsS..',
      '..Ss........sS..',
      '.SsbBkkkkkkBbsS.',
      '.SsmkKKKKKKkmsS.',
      '.Ssm........msS.',
      '.MM..........MM.',
      '................',
    ],
    MAT.steel,
    MATS,
  ),

  crystal_shower: icon16((c) => {
    c.isoTile(MAT.arcane, MAT.stone, MAT.darkIron, 14, 3);
    c.stamp(
      2,
      1,
      [
        '..P....C..',
        '.PpP..CcC.',
        '.Pzp..CuC.',
        '..z....u..',
        '....Pp....',
        '...Ppzp...',
      ],
      MAT.arcane,
      MATS,
    );
  }),

  boulder_rain: icon16((c) => {
    c.isoTile(MAT.stone, MAT.wood, MAT.darkIron, 14, 3);
    c.stamp(
      2,
      1,
      [
        '.Nnh......',
        'NnhH..Nnh.',
        'nHH..NnhH.',
        '.....nhHH.',
        '..Nnh.....',
        '.NnhHH....',
      ],
      MAT.stone,
      MATS,
    );
  }),

  blossom_rain: icon16((c) => {
    c.isoTile(MAT.leaf, MAT.wood, MAT.darkWood, 14, 3);
    c.stamp(
      2,
      1,
      [
        '.Rr...rR..',
        'RrY...RrY.',
        '..q....q..',
        '...Rrq....',
        '..RrYr..R.',
        '...qq..rY.',
      ],
      MAT.ruby,
      MATS,
    );
  }),

  jungle_bloom: icon16((c) => {
    c.isoTile(MAT.leaf, MAT.wood, MAT.darkWood, 14, 3);
    c.stamp(
      2,
      1,
      [
        '..EE.EE...',
        '.EeEeEeE..',
        '.elLkkLl..',
        '...kBbk...',
        '...kBk....',
        '...kK.....',
      ],
      MAT.leaf,
      MATS,
    );
  }),

  soil_enrich: icon16((c) => {
    c.isoTile(MAT.leaf, MAT.wood, MAT.darkWood, 14, 3);
    c.stamp(
      3,
      1,
      [
        '.C...Y..C.',
        '.c...y..c.',
        '..Ee..Ee..',
        '.EeLeEeLe.',
        '..ll..ll..',
      ],
      MAT.azure,
      MATS,
    );
  }),

  desert_dunes: icon16((c) => {
    c.isoTile(MAT.gold, MAT.wood, MAT.darkWood, 14, 3);
    c.stamp(
      2,
      2,
      [
        '....YYY...',
        '..YYyyyY..',
        '.YyygggY..',
        'YYYYggggGG',
      ],
      MAT.gold,
      MATS,
    );
  }),

  coral_reef_rain: icon16((c) => {
    c.isoTile(MAT.azure, MAT.azure, MAT.darkIron, 14, 3);
    c.stamp(
      2,
      1,
      [
        '.Rr...FF..',
        '.rq..FfF..',
        '..q..fFa..',
        '...C..a...',
        '..Rrq.Ff..',
      ],
      MAT.ruby,
      MATS,
    );
  }),

  salvage_drop: icon16((c) => {
    c.isoTile(MAT.steel, MAT.stone, MAT.darkIron, 14, 3);
    c.stamp(
      2,
      1,
      [
        '..SSss....',
        '..SYys.Yy.',
        '..smmM.yg.',
        '....SSss..',
        '....smmM..',
      ],
      MAT.steel,
      MATS,
    );
  }),

  volcanic_obsidian: icon16((c) => {
    c.isoTile(MAT.darkIron, MAT.flame, MAT.darkIron, 14, 3);
    c.stamp(
      2,
      1,
      [
        '..Dd...F..',
        '.DFd..DFd.',
        '.dFd..dfD.',
        '..d....D..',
        '...DdFd...',
      ],
      MAT.flame,
      MATS,
    );
  }),

  atlantis_rise: icon16((c) => {
    c.isoTile(MAT.azure, MAT.azure, MAT.darkIron, 14, 3);
    c.stamp(
      3,
      1,
      [
        '.YYYYYYYY.',
        '.CC.CC.CC.',
        '.cu.cu.cu.',
        '.cu.cu.cu.',
        'CccCccCccC',
      ],
      MAT.gold,
      MATS,
    );
  }),

  alpine_glacier: cluster16(
    [
      '.......II.......',
      '......IIiI......',
      '.....IIiiCC.....',
      '....IIiiCccC....',
      '...IIiICcucCI...',
      '..IIiCCcuuuCIi..',
      '..IiCCcuuuCCiI..',
      '.IiCCcuuNnhCCcC.',
      '.ICccuuNnnnhCcu.',
      '.CcuuuNnnnhHcuU.',
      '.cuuUNnnnhHHuUU.',
      '.uUUNnnnhHHHuUU.',
      '.UUNnnnhHHHHHUU.',
      '..NHHHHHHHHHHH..',
      '................',
      '................',
    ],
    MAT.azure,
    MATS,
  ),

  abyssal_trench: icon16((c) => {
    c.isoTile(MAT.azure, MAT.darkIron, MAT.darkIron, 14, 3);
    c.stamp(
      2,
      2,
      [
        'CcDDDDDDcC',
        '.uDDDDDDu.',
        '..UDddDU..',
        '...DDDD...',
      ],
      MAT.darkIron,
      MATS,
    );
  }),

  swamp_mire: icon16((c) => {
    c.isoTile(MAT.leaf, MAT.darkWood, MAT.darkIron, 14, 3);
    c.stamp(
      2,
      2,
      [
        '.ll..eE...',
        'Llk..ll.k.',
        '.k.EeL.lL.',
        '..eLll..k.',
      ],
      MAT.leaf,
      MATS,
    );
  }),

  volcanic_wasteland: icon16((c) => {
    c.isoTile(MAT.darkIron, MAT.flame, MAT.darkIron, 14, 3);
    c.stamp(
      2,
      1,
      [
        '...FYYf...',
        '..DFYYfD..',
        '.DdFffFdD.',
        '..dF..Fd..',
        '.Ff....fF.',
      ],
      MAT.flame,
      MATS,
    );
  }),

  blighted_mire: icon16((c) => {
    c.isoTile(MAT.arcane, MAT.darkIron, MAT.darkIron, 14, 3);
    c.stamp(
      2,
      1,
      [
        '..D....D..',
        '.DpD..DpD.',
        '..pE..Ep..',
        '...EeEe...',
        '..p.ll.p..',
      ],
      MAT.arcane,
      MATS,
    );
  }),

  floral_plains: icon16((c) => {
    c.isoTile(MAT.leaf, MAT.wood, MAT.darkWood, 14, 3);
    c.stamp(
      2,
      1,
      [
        '.Rr.YY.Pp.',
        'RrY.yg.PpY',
        '.l..E...l.',
        '..Ee.Cc...',
        '.el..cu...',
      ],
      MAT.ruby,
      MATS,
    );
  }),

  lava_river: icon16((c) => {
    c.isoTile(MAT.darkIron, MAT.flame, MAT.darkIron, 12, 4, (x, y) => {
      const band = Math.abs(x - 7.5 + (y - 6) * 1.4);
      if (band <= 1.2) return { ramp: MAT.gold, tone: 4 };
      if (band <= 2.4) return { ramp: MAT.flame, tone: 3 };
      return null;
    });
  }),

  poison_river: icon16((c) => {
    c.isoTile(MAT.arcane, MAT.darkIron, MAT.darkIron, 12, 4, (x, y) => {
      const band = Math.abs(x - 7.5 + (y - 6) * 1.4);
      if (band <= 1.4) return { ramp: MAT.leaf, tone: 4 };
      if (band <= 2.5) return { ramp: MAT.leaf, tone: 3 };
      return null;
    });
  }),

  floral_rain: icon16((c) => {
    c.isoTile(MAT.leaf, MAT.wood, MAT.darkWood, 14, 3);
    c.stamp(
      2,
      1,
      [
        '.Rr..Y..P.',
        'RrY.YyY.pY',
        '.q...y..z.',
        '..Cc..Rr..',
        '.cYu.RrY..',
      ],
      MAT.ruby,
      MATS,
    );
  }),

  water_drop: cluster16(
    [
      '................',
      '.....sSSSSs.....',
      '....sM....Ms....',
      '...sM..CC..Ms...',
      '..sSCcICccCcsM..',
      '..sMCcuuucCMsM..',
      '..sMMuuuuMMMsM..',
      '...sSmmmmMMMD...',
      '...sSsmmmMMMD...',
      '...sSsmmCCMMD...',
      '....sSsmcuMD....',
      '....sSsmmMMD....',
      '....sSsmmMMD....',
      '.....sMMMMD.....',
      '......DDDD......',
      '................',
    ],
    MAT.azure,
    MATS,
  ),

  lava_drop: cluster16(
    [
      '................',
      '.....sSSSSs.....',
      '....sM....Ms....',
      '...sM..FF..Ms...',
      '..sSFfYFffFfsM..',
      '..sMFfaaafFMsM..',
      '..sMMaaaaMMMsM..',
      '...sSmmmmMMMD...',
      '...sSsmmmMMMD...',
      '...sSsmmFFMMD...',
      '....sSsmfaMD....',
      '....sSsmmMMD....',
      '....sSsmmMMD....',
      '.....sMMMMD.....',
      '......DDDD......',
      '................',
    ],
    MAT.flame,
    MATS,
  ),

  poison_drop: cluster16(
    [
      '................',
      '.....sSSSSs.....',
      '....sM....Ms....',
      '...sM..EE..Ms...',
      '..sSEeYEeeEesM..',
      '..sMEellleEMsM..',
      '..sMMllllMMMsM..',
      '...sSmmmmMMMD...',
      '...sSsmmmMMMD...',
      '...sSsmmEEMMD...',
      '....sSsmelMD....',
      '....sSsmmMMD....',
      '....sSsmmMMD....',
      '.....sMMMMD.....',
      '......DDDD......',
      '................',
    ],
    MAT.leaf,
    MATS,
  ),

  canyon_carve: cluster16(
    [
      '................',
      '.XXXxx....xxXXX.',
      '.Xxxvv....vvxxX.',
      '.xvvvV....Vvvvx.',
      '.vvVVk....kVVvv.',
      '.XXxxk....kxxXX.',
      '.XxxvK.dd.KvxxX.',
      '.xvvVK.dd.KVvvx.',
      '.vvVVk.dd.kVVvv.',
      '.xxvvK.dd.Kvvxx.',
      '.vvVVk.dd.kVVvv.',
      '.vVVKk.dd.kKVVv.',
      '.VVKKk.DD.kKKVV.',
      '..KKKKDDDDKKKK..',
      '................',
      '................',
    ],
    MAT.copper,
    MATS,
  ),

  mesa_plateau: cluster16(
    [
      '................',
      '................',
      '...XXXXXXXXXX...',
      '..XxxxxxxxxxxX..',
      '..XxxvvvvvvxxX..',
      '..vvvvVVVVvvvv..',
      '..YyyggVVggyyY..',
      '..vvvVVVVVVvvv..',
      '.XxxvvVVVVvvxxX.',
      '.xvvVVVVVVVVvvx.',
      '.vVVKKVVVVKKVVv.',
      '.YyygggVVgggyyY.',
      '.yggggGGGGggggy.',
      '..GGGGGGGGGGGG..',
      '................',
      '................',
    ],
    MAT.copper,
    MATS,
  ),

  volcanic_crater: cluster16(
    [
      '................',
      '................',
      '....NNNNNNNN....',
      '..NNnnhhhhnNNN..',
      '.NNnhHddddHhnN..',
      '.NnhHddFFddHhnN.',
      '.nhHdDFYYFDdHhn.',
      '.nhHdDFfaFDdHhn.',
      '.nhHHddaaDdHHhn.',
      '.nnhHHddddHHhnn.',
      '.nnhhHHHHHHhhnn.',
      '.hhHHHHHHHHHHhh.',
      '..HHHHHHHHHHHH..',
      '..DDHHHHHHHHDD..',
      '................',
      '................',
    ],
    MAT.stone,
    MATS,
  ),

  smooth_terrain: cluster16(
    [
      '................',
      '................',
      '....CCCCCCCC....',
      '..CCcc....ccCC..',
      '.Cc..........cC.',
      '................',
      '.....EEeeEE.....',
      '...EEeeelleeE...',
      '..EeellllllleE..',
      '.EelllllllllLLE.',
      '.elllllLLLLLLle.',
      '.bBbbLLLLLLbbBb.',
      '.bbkkbBBBBbkkbb.',
      '..kkkkKKKKkkkk..',
      '................',
      '................',
    ],
    MAT.leaf,
    MATS,
  ),

  island_bridge: cluster16(
    [
      '................',
      '................',
      '................',
      '.....NNNNNN.....',
      '...NNnnNNnnNN...',
      '..NnnBbbbbBnnN..',
      '.EEeBbbkkbbBeEE.',
      '.EelBkH..HkBleE.',
      '.llkKH.CC.HKkll.',
      '.kKHCccuucCCHKk.',
      '.KHCcuuuuuucCHK.',
      '.CCcuuuuuuuucCC.',
      '.cuuUUuuuuUUuuc.',
      '..UUUUUUUUUUUU..',
      '................',
      '................',
    ],
    MAT.azure,
    MATS,
  ),
};

export const HUD_SPRITES: Record<
  | 'rotateLeft'
  | 'rotateRight'
  | 'center'
  | 'zoomIn'
  | 'zoomOut'
  | 'pan'
  | 'log'
  | 'audioOn'
  | 'audioOff'
  | 'pause'
  | 'play'
  | 'reset'
  | 'save'
  | 'camera'
  | 'speed'
  | 'chevronDown'
  | 'chevronUp'
  | 'sliders'
  | 'settings'
  | 'star'
  | 'starOn'
  | 'close'
  | 'unpin'
  | 'pencil'
  | 'document',
  CompiledSprite
> = {
  rotateLeft: cluster16(
    [
      '................',
      '.....Yy.........',
      '....Yyg$$$$$....',
      '...Yyg$$$$$$$...',
      '....g$$....$$$..',
      '............$$..',
      '............$$..',
      '............$$..',
      '.....$$....$$...',
      '......$$$$$$....',
      '.......$$$$.....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
  ),

  rotateRight: cluster16(
    [
      '................',
      '.........yY.....',
      '....$$$$$gyY....',
      '...$$$$$$$gyY...',
      '..$$$....$$g....',
      '..$$............',
      '..$$............',
      '..$$............',
      '...$$....$$.....',
      '....$$$$$$......',
      '.....$$$$.......',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
  ),

  center: cluster16(
    [
      '................',
      '.......$$.......',
      '....$$$$$$$$....',
      '...$$..$$..$$...',
      '..$$..Yyyg..$$..',
      '..$.$.YCCg.$.$..',
      '.$$$$.gGGd.$$$$.',
      '..$.$..$$..$.$..',
      '..$$...$$...$$..',
      '...$$..$$..$$...',
      '....$$$$$$$$....',
      '.......$$.......',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
  ),

  zoomIn: cluster16(
    [
      '................',
      '....$$$$$.......',
      '..$$ccEEc$$.....',
      '.$ccccEEccc$....',
      '.$ccEEEEEEc$....',
      '.$ccccEEccc$....',
      '..$$uuEEu$$b....',
      '...$$uuu$$Bbk...',
      '....$$$$$..bkK..',
      '............kK..',
      '.............K..',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
  ),

  zoomOut: cluster16(
    [
      '................',
      '....$$$$$.......',
      '..$$ccccc$$.....',
      '.$ccccccccc$....',
      '.$ccYYYYYYc$....',
      '.$ccccccccc$....',
      '..$$uuuuu$$b....',
      '...$$uuu$$Bbk...',
      '....$$$$$..bkK..',
      '............kK..',
      '.............K..',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
  ),

  pan: cluster16(
    [
      '................',
      '.......$$.......',
      '......$$$$......',
      '.......$$.......',
      '..$$...$$...$$..',
      '.$$$..Yyyg..$$$.',
      '$$$$$.YCCg.$$$$$',
      '.$$$..gGGd..$$$.',
      '..$$...$$...$$..',
      '.......$$.......',
      '......$$$$......',
      '.......$$.......',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
  ),

  log: TAB_SPRITES.rules,

  audioOn: cluster16(
    [
      '................',
      '................',
      '......$$........',
      '.....$$$..Ee....',
      '....$$$$...el...',
      '..$$$$$$.E..el..',
      '..$$$$$$..E.el..',
      '..$$$$$$..e.el..',
      '..$$$$$$..e.el..',
      '..$$$$$$..l.el..',
      '..$$$$$$.l..el..',
      '....$$$$...el...',
      '.....$$$..ll....',
      '......$$........',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
  ),

  audioOff: cluster16(
    [
      '................',
      '................',
      '......$$........',
      '.....$$$........',
      '....$$$$........',
      '..$$$$$$.R...R..',
      '..$$$$$$.Rr.qR..',
      '..$$$$$$..Rrq...',
      '..$$$$$$..rrq...',
      '..$$$$$$.rr.qq..',
      '..$$$$$$.q...Q..',
      '....$$$$........',
      '.....$$$........',
      '......$$........',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
  ),

  pause: cluster16(
    [
      '................',
      '................',
      '....$$$..$$$....',
      '....$$$..$$$....',
      '....$$$..$$$....',
      '....$$$..$$$....',
      '....$$$..$$$....',
      '....$$$..$$$....',
      '....$$$..$$$....',
      '....$$$..$$$....',
      '....$$$..$$$....',
      '....$$$..$$$....',
      '....$$$..$$$....',
      '....$$$..$$$....',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
    false,
  ),

  play: cluster16(
    [
      '................',
      '................',
      '....$$..........',
      '....$$$$........',
      '....$$$$$$......',
      '....$$$$$$$$....',
      '....$$$$$$$$$$..',
      '....$$$$$$$$$$..',
      '....$$$$$$$$$$..',
      '....$$$$$$$$$$..',
      '....$$$$$$$$....',
      '....$$$$$$......',
      '....$$$$........',
      '....$$..........',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
    false,
  ),

  reset: cluster16(
    [
      '................',
      '................',
      '....$$$$$$......',
      '...$$$...$$Yy...',
      '..$$......Yyy...',
      '..$$.....Yyy....',
      '..$$............',
      '..$$.......$$...',
      '...$$$...$$$....',
      '....$$$$$$......',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
    false,
  ),

  save: cluster16(
    [
      '................',
      '................',
      '..$$$$$$$$$$....',
      '..$$ssYYs$$$$...',
      '..$$sssss$$$$...',
      '..$$$$$$$$$$$...',
      '..$$IIIIIII$$...',
      '..$$IjjjjjI$$...',
      '..$$IIIIIII$$...',
      '..$$IjjjjjI$$...',
      '..$$$$$$$$$$$...',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
  ),

  camera: cluster16(
    [
      '................',
      '................',
      '................',
      '................',
      '.....mmmmmm.....',
      '...mmSSSSSSmm...',
      '..mSSSCCcuSSSm..',
      '.mSSSCCddccSSSm.',
      '.MSSSccddccSSSM.',
      '..MssSuuuuSSsM..',
      '...MMssssssMM...',
      '.....MMMMMM.....',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.steel,
    MATS,
  ),

  speed: cluster16(
    [
      '................',
      '................',
      '..$$......Yy....',
      '..$$$$....Yyy...',
      '..$$$$$$..Yyyg..',
      '..$$$$$$$.YyygG.',
      '..$$$$$$..Yyyg..',
      '..$$$$....Yyy...',
      '..$$......Yy....',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
  ),

  chevronDown: cluster16(
    [
      '................',
      '................',
      '................',
      '................',
      '................',
      '..$$$......$$$..',
      '...$$$....$$$...',
      '....$$$..$$$....',
      '.....$$$$$$.....',
      '......$$$$......',
      '.......$$.......',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
    false,
  ),

  chevronUp: cluster16(
    [
      '................',
      '................',
      '................',
      '................',
      '................',
      '.......$$.......',
      '......$$$$......',
      '.....$$$$$$.....',
      '....$$$..$$$....',
      '...$$$....$$$...',
      '..$$$......$$$..',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
    false,
  ),

  sliders: cluster16(
    [
      '................',
      '................',
      '....Yyy.........',
      '..$$Yyg$$$$$$$..',
      '................',
      '........Eee.....',
      '..$$$$$$eel$$$..',
      '................',
      '.....Ccc........',
      '..$$$cuu$$$$$$..',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
  ),

  settings: cluster16(
    [
      '................',
      '......3333......',
      '..33..3222..33..',
      '..323222222221..',
      '...2222112221...',
      '...221....121...',
      '.3322......2111.',
      '.3221......1211.',
      '.2221......1111.',
      '.2211......1111.',
      '...211....111...',
      '...2111111111...',
      '..211111111111..',
      '..11..1111..11..',
      '......1111......',
      '................',
    ],
    MAT.steel,
    MATS,
  ),

  star: cluster16(
    [
      '................',
      '.......$$.......',
      '......$$$$......',
      '......$$$$......',
      '..$$$$$$$$$$$$..',
      '...$$$$$$$$$$...',
      '....$$$$$$$$....',
      '....$$$$$$$$....',
      '...$$$$..$$$$...',
      '..$$$......$$$..',
      '..$$........$$..',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
    false,
  ),

  starOn: cluster16(
    [
      '................',
      '.......44.......',
      '......3333......',
      '......3333......',
      '..333322223333..',
      '...2222222222...',
      '....22222222....',
      '....22222222....',
      '...2221..1222...',
      '..111......111..',
      '..11........11..',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.gold,
    MATS,
  ),

  close: cluster16(
    [
      '................',
      '................',
      '................',
      '................',
      '..$$$......$$$..',
      '...$$$....$$$...',
      '....$$$..$$$....',
      '.....$$$$$$.....',
      '.....$$$$$$.....',
      '....$$$..$$$....',
      '...$$$....$$$...',
      '..$$$......$$$..',
      '................',
      '................',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
    false,
  ),

  unpin: cluster16(
    [
      '................',
      '.Rr.............',
      '..Rr.$$$$$$.....',
      '...Rr$$$$$$.....',
      '....Rr$$$$......',
      '.....Rr$$$......',
      '......Rr$$......',
      '....$$.Rr$$$....',
      '....$$$$Rr$$....',
      '.......$$Rr.....',
      '.......$$.Rr....',
      '.......$$..Rr...',
      '........$...Rr..',
      '........$....Rr.',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
  ),

  pencil: cluster16(
    [
      '................',
      '...........Rr...',
      '..........RrRr..',
      '.........$$Rr...',
      '........Yy$$....',
      '.......Yyg$.....',
      '......Yyg.......',
      '.....Yyg........',
      '....Yyg.........',
      '...Yyg..........',
      '..$$g...........',
      '..$$............',
      '.$$.............',
      '.$..............',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
  ),

  document: cluster16(
    [
      '................',
      '...$$$$$$$......',
      '...$$$$$$$Y.....',
      '...$$$$$$$Yy....',
      '...$$$$$$$Yyg...',
      '...$$......$$...',
      '...$$.Yyg..$$...',
      '...$$......$$...',
      '...$$.Yyg$.$$...',
      '...$$......$$...',
      '...$$.Yyg..$$...',
      '...$$......$$...',
      '...$$$$$$$$$$...',
      '...$$$$$$$$$$...',
      '................',
      '................',
    ],
    MAT.hud,
    MATS,
  ),
};
