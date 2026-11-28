import type { Resources, TerrainToolType, ToolCategory, ZoneOverlayType } from '../../game/types';
import {
  type CompiledSprite,
  type Icon24,
  MAT,
  type MatLegend,
  PMAT,
  cluster16,
  cluster24,
  icon16,
  icon24,
} from './pixelEngine';

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

const PMATS: MatLegend = {
  // Gold
  Y: { ramp: PMAT.gold, tone: 4 },
  y: { ramp: PMAT.gold, tone: 3 },
  g: { ramp: PMAT.gold, tone: 2 },
  G: { ramp: PMAT.gold, tone: 1 },
  // Wood
  B: { ramp: PMAT.wood, tone: 4 },
  b: { ramp: PMAT.wood, tone: 3 },
  k: { ramp: PMAT.wood, tone: 2 },
  K: { ramp: PMAT.wood, tone: 1 },
  // Dark Wood
  W: { ramp: PMAT.darkWood, tone: 3 },
  w: { ramp: PMAT.darkWood, tone: 2 },
  T: { ramp: PMAT.darkWood, tone: 1 },
  t: { ramp: PMAT.darkWood, tone: 0 },
  // Moss / Leaf
  E: { ramp: PMAT.moss, tone: 4 },
  e: { ramp: PMAT.moss, tone: 3 },
  l: { ramp: PMAT.moss, tone: 2 },
  L: { ramp: PMAT.moss, tone: 1 },
  // Water / Azure
  C: { ramp: PMAT.water, tone: 4 },
  c: { ramp: PMAT.water, tone: 3 },
  u: { ramp: PMAT.water, tone: 2 },
  U: { ramp: PMAT.water, tone: 1 },
  // Steel / Silver
  S: { ramp: PMAT.steel, tone: 4 },
  s: { ramp: PMAT.steel, tone: 3 },
  m: { ramp: PMAT.steel, tone: 2 },
  M: { ramp: PMAT.steel, tone: 1 },
  // Crimson
  R: { ramp: PMAT.crimson, tone: 4 },
  r: { ramp: PMAT.crimson, tone: 3 },
  q: { ramp: PMAT.crimson, tone: 2 },
  Q: { ramp: PMAT.crimson, tone: 1 },
  // Parchment / Ivory
  I: { ramp: PMAT.parchment, tone: 4 },
  i: { ramp: PMAT.parchment, tone: 3 },
  j: { ramp: PMAT.parchment, tone: 2 },
  J: { ramp: PMAT.parchment, tone: 1 },
  // Amber / Flame
  F: { ramp: PMAT.amber, tone: 4 },
  f: { ramp: PMAT.amber, tone: 3 },
  a: { ramp: PMAT.amber, tone: 2 },
  A: { ramp: PMAT.amber, tone: 1 },
  // Arcane
  P: { ramp: PMAT.arcane, tone: 4 },
  p: { ramp: PMAT.arcane, tone: 3 },
  z: { ramp: PMAT.arcane, tone: 2 },
  Z: { ramp: PMAT.arcane, tone: 1 },
  // Stone
  N: { ramp: PMAT.stone, tone: 4 },
  n: { ramp: PMAT.stone, tone: 3 },
  h: { ramp: PMAT.stone, tone: 2 },
  H: { ramp: PMAT.stone, tone: 1 },
  // Bronze / Terracotta
  X: { ramp: PMAT.bronze, tone: 4 },
  x: { ramp: PMAT.bronze, tone: 3 },
  v: { ramp: PMAT.bronze, tone: 2 },
  V: { ramp: PMAT.bronze, tone: 1 },
  // Iron (dark shadows / fissures / rivets)
  D: { ramp: PMAT.iron, tone: 2 },
  d: { ramp: PMAT.iron, tone: 1 },
  // Ice
  '^': { ramp: PMAT.ice, tone: 4 },
  '~': { ramp: PMAT.ice, tone: 3 },
  '=': { ramp: PMAT.ice, tone: 2 },
  '-': { ramp: PMAT.ice, tone: 1 },
  // Toxic
  '+': { ramp: PMAT.toxic, tone: 4 },
  '*': { ramp: PMAT.toxic, tone: 3 },
  '%': { ramp: PMAT.toxic, tone: 2 },
  '&': { ramp: PMAT.toxic, tone: 1 },
  // Rose / Blossom
  '@': { ramp: PMAT.rose, tone: 4 },
  '#': { ramp: PMAT.rose, tone: 3 },
  '!': { ramp: PMAT.rose, tone: 2 },
  '?': { ramp: PMAT.rose, tone: 1 },
  // Sand
  ':': { ramp: PMAT.sand, tone: 4 },
  ';': { ramp: PMAT.sand, tone: 3 },
  ',': { ramp: PMAT.sand, tone: 2 },
  _: { ramp: PMAT.sand, tone: 1 },
};

function drawIsoRiver24(
  c: Icon24,
  topRamp: typeof PMAT.moss,
  leftRamp: typeof PMAT.wood,
  rightRamp: typeof PMAT.darkWood,
  liquidRamp: typeof PMAT.water,
  highlightRamp?: typeof PMAT.ice,
): void {
  c.isoBlock(topRamp, leftRamp, rightRamp, 17, 4, (x, y) => {
    const wave = Math.sin((y - 10) * 0.65) * 1.1;
    const band = Math.abs(x - 11.5 + (y - 13) * 1.35 + wave);
    if (band <= 1.2) return { ramp: highlightRamp ?? liquidRamp, tone: 4 };
    if (band <= 2.3) return { ramp: liquidRamp, tone: 3 };
    if (band <= 3.1) return { ramp: liquidRamp, tone: 2 };
    return null;
  });
}

export const RESOURCE_SPRITES: Record<keyof Resources, CompiledSprite> = {
  // 24x24 Plump crimson orchard apple with emerald leaf & golden wheat stalk
  food: cluster24(
    [
      '........................',
      '.................Yy.....',
      '................Yyg.....',
      '.........bK....YygG.....',
      '........bk.EeE.ygG......',
      '........kK.EelEgG.......',
      '......333kKellLg........',
      '....3443322llL2233......',
      '...3443322222222223.....',
      '..343322222222222222....',
      '..333222222222222221....',
      '..322222222222222221....',
      '..222222222222222211....',
      '..222222222222222211....',
      '..222222222222222111....',
      '...2222222222222111.....',
      '...1222222222221111.....',
      '....11222222221111......',
      '.....111222221111.......',
      '......1111o11111........',
      '.......111.1111.........',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.crimson,
    PMATS,
  ),

  // 24x24 Stacked timber logs (2 bottom, 1 top) with pale spiral cut-ends & rough bark
  wood: cluster24(
    [
      '........................',
      '........................',
      '..........333333........',
      '........333222221.......',
      '.......3Ii22212221......',
      '......3IijI22222111.....',
      '......2iJjI21222111.....',
      '......2iJji2222111......',
      '.......1iii111111.......',
      '.....3331113333333......',
      '...3332223332222221.....',
      '..3Ii22223Ii22212221....',
      '.3IijI212IijI22222111...',
      '.2iJjI222iJjI21222111...',
      '.2iJji212iJji22221111...',
      '.1iIii111iIii2211111....',
      '..1JJJ1111JJJ111111.....',
      '...111111111111111......',
      '....0000000000000.......',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.wood,
    PMATS,
  ),

  // 24x24 Faceted grey granite boulder cluster with chiseled bevel planes
  stone: cluster24(
    [
      '........................',
      '........................',
      '........................',
      '........444444..........',
      '......4433333332........',
      '.....433333333222.......',
      '....33333333222221......',
      '...3333322222222211.....',
      '..33222222222222211.....',
      '..22222222222222111.....',
      '..22222222222244432.....',
      '..222222222244333321....',
      '..1222222223333332211...',
      '..1122222223322222211...',
      '...111222222222222111...',
      '...111111122222222111...',
      '....1111111122222111....',
      '.....11111111111111.....',
      '......000000000000......',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.stone,
    PMATS,
  ),

  // 24x24 Dark basalt ore boulder studded with gleaming gold & amber ore chunks
  ore: cluster24(
    [
      '........................',
      '........................',
      '........................',
      '........333333..........',
      '......3332222221........',
      '.....322Yyy222221.......',
      '....322YyygG222211......',
      '...32222ggG22222111.....',
      '..32222222222Ff2211.....',
      '..222Ff22222FfaA211.....',
      '..22FfaA22222aaA332.....',
      '..222aaA22Yyy223Yyg1....',
      '..1222222YyygG22ygg11...',
      '..11222222ggG22222111...',
      '...11122222222Ff22111...',
      '...1111111222FfaA111....',
      '....1111111111aa111.....',
      '.....1111111111111......',
      '......00000000000.......',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.iron,
    PMATS,
  ),

  // 24x24 Leather-bound grimoire tome with gold corner clasps, parchment pages & cyan rune
  knowledge: cluster24(
    [
      '........................',
      '........................',
      '...........Yy33333......',
      '.........33Yyg33332.....',
      '.......33332gg222222....',
      '......332222222222221...',
      '.....322222CCc2222221...',
      '....322222Cccu2222221...',
      '...Yyg2222ccuu2222Yyg...',
      '..Yyyg22222uuU2222ygg...',
      '..yggG111111111111gGIi..',
      '..Iiii111111111111IIij..',
      '..IIiiij11111111IIiiij..',
      '...IIiiijjj111IIiiijjJ..',
      '....IIiiijjjjIIiijjjJ...',
      '.....IIiijjjjjjjrRjjJ...',
      '......JJiijjjjjrRqJJ....',
      '.......JJJjjjjjRrqJ.....',
      '........JJJJjjjrqJ......',
      '.........JJJJJJqJ.......',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.crimson,
    PMATS,
  ),

  // 24x24 Brass-capped cyan energy coil cell with glowing lightning core
  energy: cluster24(
    [
      '........................',
      '........................',
      '........YYYYYYYY........',
      '.......YyyyyyggGY.......',
      '.......XxxxxxxxxV.......',
      '......XXvvvvvvvvVV......',
      '......S^CccccccuMS......',
      '......S^Cc^~ccuuMS......',
      '......S^C^~^ccuuMS......',
      '......S^c^~^cuuuMS......',
      '......S^cc^~^uuuMS......',
      '......S^ccc^~uuUMS......',
      '......S^cc^~^uuUMS......',
      '......S^c^~^uuuUMS......',
      '......S^cc^~uuuUMS......',
      '......S^cuuuuuUUMS......',
      '......SmuuuuUUUUMS......',
      '......XXvvvvvvvvVV......',
      '.......XxxxxxxxxV.......',
      '.......YyyyyyggGY.......',
      '........GGGGGGGG........',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.water,
    PMATS,
  ),

  // 24x24 Beveled 3-plane isometric steel ingot bar with bright specular chamfer
  alloy: cluster24(
    [
      '........................',
      '........................',
      '........................',
      '........................',
      '...........4444.........',
      '.........44333344.......',
      '.......443333333311.....',
      '.....443333333333111....',
      '...443333333333331111...',
      '..43333333333333311111..',
      '..24444433333333111111..',
      '..22222244444431111111..',
      '..22222222222221111111..',
      '..2222222222222111111...',
      '...22222222222111111....',
      '....222222222111111.....',
      '.....2222222111111......',
      '......11111111111.......',
      '.......000000000........',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.steel,
    PMATS,
  ),

  // 24x24 Radiant antique gold sunburst chalice reliquary with luminous pearl core
  faith: cluster24(
    [
      '........................',
      '...........44...........',
      '..........4334..........',
      '....44....3223....44....',
      '....332...3223...233....',
      '.....222.332233.222.....',
      '......2233^~~^3322......',
      '.......33^~~~~^33.......',
      '..443332^~~==~~^233344..',
      '.4332222^~====~^2222334.',
      '..222112^~====~^211222..',
      '.......22~====~22.......',
      '......2212~--~2122......',
      '.....221.221122.122.....',
      '....211...2221...112....',
      '....11....2221....11....',
      '..........2221..........',
      '.........322221.........',
      '.......3322222211.......',
      '......222111111111......',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.gold,
    PMATS,
  ),
};

export const TAB_SPRITES: Record<ToolCategory, CompiledSprite> = {
  // 24x24 Divine golden-amber lightning crest (god powers)
  powers: cluster24(
    [
      '........................',
      '........................',
      '............4444........',
      '...........44333........',
      '..........433322........',
      '.........433222.........',
      '........433222..........',
      '.......433222...........',
      '......43322224444.......',
      '.....433222223333.......',
      '.....332222222221.......',
      '......1111332221........',
      '.........332221.........',
      '........332221..........',
      '.......332221...........',
      '......332221............',
      '.....332221.............',
      '....332211..............',
      '....2211................',
      '....11..................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.amber,
    PMATS,
  ),

  // 24x24 Sculpted isometric moss-earth block topped with a snow-capped mountain & pine
  terrain: icon24((c) => {
    c.isoBlock(PMAT.moss, PMAT.wood, PMAT.darkWood, 17, 4);
    c.stamp(
      4,
      2,
      [
        '......^^........',
        '.....^~~^.......',
        '....^~==~^......',
        '...NNnnhhH......',
        '..NNnnnhhhH..e..',
        '.NNnnnnhhhhHeel.',
        '.NnnnnhhhhhHell.',
        'NnnnnhhhhhhhHll.',
        'nnnnnhhhhhhhH.k.',
      ],
      PMAT.stone,
      PMATS,
    );
  }),

  // 24x24 Grounded RPG villager/monarch bust with crown, hair, tunic & leather belt
  spawn: cluster24(
    [
      '........................',
      '........................',
      '........Yy..Yy..Yy......',
      '........YyyyyyggGg......',
      '.......BBBBBBBBbK.......',
      '......BbbbbbbbbbbK......',
      '......bb444333332k......',
      '......b4333333332k......',
      '......b33o3333o32k......',
      '......b3333333322k......',
      '.......3333223322.......',
      '........22222221........',
      '.......Yyy3333gG........',
      '.....YyCccccccuuGg......',
      '....YyCcccuuuuuuUGg.....',
      '....2CcccuuuuuuuUU1.....',
      '....2CcccuYyyguuUU1.....',
      '....2cccuuYggGuuUU1.....',
      '.....BbbbbbbbbbbbK......',
      '.....KkkkkkkkkkkkK......',
      '......Kkkk...kkkK.......',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.skin,
    PMATS,
  ),

  // 24x24 Unrolled parchment world map with miniature continents & crimson territory flag
  zones: cluster24(
    [
      '........................',
      '........................',
      '..............Y.........',
      '..............BRRRR.....',
      '..............Brrrrq....',
      '..333333333333BqqqQ.....',
      '.3444444444443B33333....',
      '.34CCccEeE3333B333322...',
      '.34CccEeeel333B333322...',
      '.33ccEeeelll33B3CCc22...',
      '.33ccceellL333BCccu22...',
      '.33Cccceel33333ccuu22...',
      '.33Ccc333333EeE3uuU22...',
      '.3333333333Eeeel33322...',
      '.333EeE3333eellL33321...',
      '.23Eeeel3333llL333221...',
      '.222ell33333333333211...',
      '..222222222222222211....',
      '...1111111111111111.....',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.parchment,
    PMATS,
  ),

  // 24x24 Parchment decree scroll with turned oak rollers, gold finials & crimson wax seal
  rules: cluster24(
    [
      '........................',
      '........................',
      '.YyBBBBBBBBBBBBBBBBBBgG.',
      '.YgbbbbbbbbbbbbbbbbbbGG.',
      '.GGKKKKKKKKKKKKKKKKKKGG.',
      '....4444444444444443....',
      '....3333333333333332....',
      '....33JJJJJJJJJ33332....',
      '....3333333333333332....',
      '....33JJJJJJJ3333332....',
      '....3333333333333332....',
      '....33JJJJJJ333Rr332....',
      '....3333333333Rrrq32....',
      '....33JJJJJ333RrqQ32....',
      '....33333333333qq332....',
      '....3333333333333321....',
      '....2222222222222211....',
      '.YyBBBBBBBBBBBBBBBBBBgG.',
      '.YgbbbbbbbbbbbbbbbbbbGG.',
      '.GGKKKKKKKKKKKKKKKKKKGG.',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.parchment,
    PMATS,
  ),

  // 24x24 Ornate antique brass hourglass with clear ice glass & trickling golden sand
  epochs: cluster24(
    [
      '........................',
      '........................',
      '....4444444444444444....',
      '....3333333333333332....',
      '.....22222222222221.....',
      '......B^~~~~~~~~=K......',
      '......B^~YYYYYY~=K......',
      '......B^~~Yyyy~~=K......',
      '.......B^~~yy~~=K.......',
      '........B^~yg~=K........',
      '.........B^~y=K.........',
      '..........B^yK..........',
      '..........B^yK..........',
      '.........B^~y=K.........',
      '........B^~Yy~=K........',
      '.......B^~Yyyg~=K.......',
      '......B^~Yyyygg~=K......',
      '......B^YYYYgggg=K......',
      '.....33333333333332.....',
      '....4444444444444444....',
      '....1111111111111111....',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.gold,
    PMATS,
  ),

  // 24x24 Antique brass magnifying glass with ice-blue glass lens & turned oak handle
  inspect: cluster24(
    [
      '........................',
      '........................',
      '......4444444...........',
      '....44333333322.........',
      '...433^~~~===322........',
      '..433^^~~~====221.......',
      '..33^^~~~=====221.......',
      '..33^~~~======211.......',
      '..33~~~=======111.......',
      '..32~~========111.......',
      '..22=========111........',
      '...221======111.........',
      '....2111111111Bb........',
      '......1111111Bbbk.......',
      '.............BbbkK......',
      '..............BbkK......',
      '...............BbkK.....',
      '................BbkK....',
      '.................BbkK...',
      '..................ygg...',
      '...................gG...',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.gold,
    PMATS,
  ),
};

export const ZONE_SPRITES: Record<ZoneOverlayType, CompiledSprite> = {
  // 24x24 Gold-framed heraldic kingdom nameplate banner with crimson crest & title bars
  kingdomLabels: cluster24(
    [
      '........................',
      '........................',
      '.........YYYYYY.........',
      '........YyggggGY........',
      '..YYYYYYYYYYYYYYYYYYYY..',
      '.Yy111111111111111111gG.',
      '.Yg1RRRR1144444444411gG.',
      '.Yg1Rrrq1111111111111gG.',
      '.Yg1rrqQ1133333331111gG.',
      '.Yg11qq11111111111111gG.',
      '.Yg111111122222222111gG.',
      '.Yg111111111111111111gG.',
      '..gggggggggggggggggggg..',
      '..........BbkK..........',
      '..........BbkK..........',
      '..........BbkK..........',
      '..........BbkK..........',
      '........BBbkkKbb........',
      '.......KkkkkkkkkK.......',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.stone,
    PMATS,
  ),

  // 24x24 Fortified stone castle keep with twin crenellated towers, pennants & oak gate
  kingdoms: cluster24(
    [
      '........................',
      '........................',
      '....Rr............Rr....',
      '....Rrq...........Rrq...',
      '....B.............B.....',
      '...44.44.......44.44....',
      '...33333..44.4.33333....',
      '...32221.33333.32221....',
      '...32D21.32221.32D21....',
      '...32221332221332221....',
      '...32222222222222221....',
      '...32222222222222221....',
      '...322222Bbbbb222221....',
      '...32222BbbkbbK22221....',
      '...22222BbkBkbK22221....',
      '...22221BbkBkbK12221....',
      '...22221BbkBkbK12221....',
      '...11111KkkkkkK11111....',
      '...00000000000000000....',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.stone,
    PMATS,
  ),

  // 24x24 Royal 3-pointed antique gold crown with velvet crimson cap & inset jewels
  kings: cluster24(
    [
      '........................',
      '........................',
      '...........44...........',
      '..........4334..........',
      '...44.....3322.....44...',
      '...332....3221....233...',
      '...322...33221...2221...',
      '...322R..32221..q2221...',
      '...222Rr3322211rq2211...',
      '...222rrq22221rqQ2211...',
      '...2222qq22221qQ22211...',
      '...444444444444444443...',
      '...333333333333333322...',
      '...222Cc22RRr22Ee2221...',
      '...222cu22rrq22el2211...',
      '...222uU22qqQ22lL2211...',
      '...222222222222222111...',
      '...111111111111111111...',
      '....0000000000000000....',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.gold,
    PMATS,
  ),

  // 24x24 Gold-trimmed heraldic heater shield quartered in moss & crimson
  territories: cluster24(
    [
      '........................',
      '........................',
      '....YYYYYYYYyyyygggg....',
      '...Yy3333333YYrrrrrqG...',
      '...Yg3333333YYrrrrqqG...',
      '...Yg3333333YYrrrqqQG...',
      '...Yg3333333YYrrqqQQG...',
      '...Yg2222222YYrqqQQQG...',
      '...YgYYYYYYYYYYYYYYYG...',
      '...YgYYYYYYYYYYYYYYYG...',
      '....YgRRRRrrYY22222G....',
      '....YgRrrrqqYY22221G....',
      '.....YgqqqQQYY2221G.....',
      '.....YgqqQQQYY2211G.....',
      '......YgQQQQYY111G......',
      '.......YgQQQYY11G.......',
      '........YgQQYY1G........',
      '.........YggggG.........',
      '..........YggG..........',
      '...........GG...........',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.moss,
    PMATS,
  ),

  // 24x24 Four-quadrant isometric world biome block (ice, desert, moss, ocean)
  biomes: icon24((c) => {
    c.isoBlock(PMAT.moss, PMAT.wood, PMAT.darkWood, 17, 4, (x, y, cx, cy) => {
      if (x <= cx && y < cy) return { ramp: PMAT.ice, tone: (x + y) % 5 === 0 ? 4 : 3 };
      if (x > cx && y < cy) return { ramp: PMAT.sand, tone: (x + y) % 5 === 0 ? 4 : 3 };
      if (x <= cx && y >= cy) return { ramp: PMAT.moss, tone: (x + y) % 5 === 0 ? 4 : 3 };
      return { ramp: PMAT.water, tone: (x + y) % 5 === 0 ? 4 : 3 };
    });
  }),

  // 24x24 Crossed azure & crimson faction banners bound by a gleaming golden pact ring
  alliances: cluster24(
    [
      '........................',
      '........................',
      '..Y..................Y..',
      '..BCCCCCC......RRRRRRB..',
      '..BCccccu......RrrrrqK..',
      '..Bcccuuu......rrrqqqK..',
      '..BuuuuUU......qqqQQQK..',
      '...Bbk............bkK...',
      '....Bbk..........bkK....',
      '.....Bbk........bkK.....',
      '......Bbk..YY..bkK......',
      '.......BbYyyyygbK.......',
      '........YyyggGgK........',
      '........Yyg44gGK........',
      '........YggGGgGK........',
      '.......bkKggggBbk.......',
      '......bkK......Bbk......',
      '.....bkK........Bbk.....',
      '....bkK..........Bbk....',
      '...kKK............KKk...',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.gold,
    PMATS,
  ),

  // 24x24 Graduated steel & glass thermometer with ice upper tube & crimson mercury bulb
  temperature: cluster24(
    [
      '........................',
      '........................',
      '.........444444.........',
      '........43^~~=32........',
      '........3^~~==22.33.....',
      '........3^~===21........',
      '........3^====21.22.....',
      '........3====-21........',
      '........3RRRRr21.33.....',
      '........3Rrrrq21........',
      '........3Rrrrq21.22.....',
      '........2Rrrrq11........',
      '.......32Rrrrrq21.......',
      '......32RRrrrrqq21......',
      '.....32RRrrrrrqqq21.....',
      '.....22Rrrrrrqqqq11.....',
      '.....22rrrrrqqqqQ11.....',
      '.....12rrrrqqqqQQ11.....',
      '......11qqqqqQQQ11......',
      '.......1111111111.......',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.steel,
    PMATS,
  ),
};

export const TERRAIN_SPRITES: Record<TerrainToolType, CompiledSprite> = {
  // 24x24 Isometric grass block with raised hillock & bold upward gold-amber arrow
  // 24x24 Flat earthy brown dirt tile block with warm soil clods & pebble highlights
  base_dirt: icon24((c) => {
    c.isoBlock(PMAT.wood, PMAT.darkWood, PMAT.darkWood, 17, 4, (x, y) => {
      const h = (x * 13 + y * 29) & 7;
      if (h === 0) return { ramp: PMAT.wood, tone: 4 };
      if (h === 3) return { ramp: PMAT.darkWood, tone: 2 };
      return null;
    });
  }),

  raise: icon24((c) => {
    c.isoBlock(PMAT.moss, PMAT.wood, PMAT.darkWood, 17, 4);
    c.stamp(
      4,
      1,
      [
        '.......YY.......',
        '......YyyY......',
        '.....YyyggY.....',
        '....YyygggGY....',
        '...YyyggggGGY...',
        '......yggG......',
        '......yggG......',
        '.....EEeeEE.....',
        '...EEeeelleeE...',
        '..EeellllllleE..',
        '.EllbbkkkkbbllE.',
      ],
      PMAT.gold,
      PMATS,
    );
  }),

  // 24x24 Isometric grass block with sunken water basin & bold downward crimson-amber arrow
  lower: icon24((c) => {
    c.isoBlock(PMAT.moss, PMAT.wood, PMAT.darkWood, 17, 4, (x, y, cx, cy) => {
      const dx = (x - cx) / 5.2;
      const dy = (y - cy) / 2.6;
      const d = dx * dx + dy * dy;
      if (d <= 0.45) return { ramp: PMAT.water, tone: 1 };
      if (d <= 0.85) return { ramp: PMAT.water, tone: 2 };
      if (d <= 1.15) return { ramp: PMAT.darkWood, tone: 2 };
      return null;
    });
    c.stamp(
      4,
      1,
      [
        '......FffF......',
        '......FfaA......',
        '......faaA......',
        '...FffaaaaAAF...',
        '....FfaaaAAA....',
        '.....faaAAA.....',
        '......aAAA......',
        '.......AA.......',
      ],
      PMAT.amber,
      PMATS,
    );
  }),

  // 24x24 Flat isometric stone terrace with brass spirit-level bar & cyan bubble
  flatten: icon24((c) => {
    c.isoBlock(PMAT.stone, PMAT.stone, PMAT.iron, 17, 4);
    c.stamp(
      3,
      2,
      [
        '........YY........',
        '.......YggY.......',
        '.YYYYYYYYYYYYYYYY.',
        'YyggIICCccIIggGGyY',
        'YgggGGccccGGggggGY',
        '.GGGGGGGGGGGGGGGG.',
      ],
      PMAT.gold,
      PMATS,
    );
  }),

  // 24x24 Lush isometric meadow dotted with crimson, gold & rose wildflowers
  fertile_meadow: icon24((c) => {
    c.isoBlock(PMAT.moss, PMAT.wood, PMAT.darkWood, 17, 4);
    c.stamp(
      4,
      4,
      [
        '..Yy......Rr....',
        '.YygG....Rrq....',
        '..el......el....',
        '..lL..@#..lL.Yy.',
        '.....@#Y#...Yyg.',
        '......el.....el.',
        '......lL.....lL.',
      ],
      PMAT.moss,
      PMATS,
    );
  }),

  // 24x24 Isometric moss block topped with layered oak & pine trees
  plant_forest: icon24((c) => {
    c.isoBlock(PMAT.moss, PMAT.wood, PMAT.darkWood, 17, 4);
    c.stamp(
      3,
      2,
      [
        '....EEe...........',
        '...Eeeel....Ee....',
        '..EeeellL..Eeel...',
        '..eelllLL.EeellL..',
        '...llLL..EeellllL.',
        '....bk...eelllLL..',
        '....bk..Eee.bk....',
        '....kK.Eeel.bk....',
        '.......ellL.kK....',
        '........bk........',
      ],
      PMAT.moss,
      PMATS,
    );
  }),

  // 24x24 Isometric dark-iron & stone block studded with chunky gold & amber ore veins
  seed_ore: icon24((c) => {
    c.isoBlock(PMAT.iron, PMAT.stone, PMAT.iron, 17, 4);
    c.stamp(
      4,
      4,
      [
        '..Yyy.....Ff....',
        '.YyygG...FfaA...',
        '.yggGG...faaA...',
        '....GG..Yyy.....',
        '..Ff...YyygG....',
        '.FfaA..yggGG....',
        '..aaA...........',
      ],
      PMAT.gold,
      PMATS,
    );
  }),

  // 24x24 Isometric moss block with winding blue river channel
  carve_river: icon24((c) => {
    drawIsoRiver24(c, PMAT.moss, PMAT.wood, PMAT.darkWood, PMAT.water, PMAT.ice);
  }),

  // 24x24 Isometric moss block with winding chiseled cobblestone road across the top
  stone_road: icon24((c) => {
    c.isoBlock(PMAT.moss, PMAT.wood, PMAT.darkWood, 17, 4, (x, y) => {
      const band = Math.abs(x - 11.5 + (y - 13) * 1.15);
      if (band <= 2.7) {
        const paver = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0;
        const seam = x % 3 === 0 && y % 2 === 0;
        return { ramp: PMAT.stone, tone: seam ? 1 : paver ? 3 : 2 };
      }
      if (band <= 3.3) return { ramp: PMAT.stone, tone: 1 };
      return null;
    });
  }),

  // 24x24 Isometric gravel/earth block with wooden sleepers & twin steel rails
  rail_track: icon24((c) => {
    c.isoBlock(PMAT.stone, PMAT.wood, PMAT.darkWood, 17, 4, (x, y) => {
      const d = x - 11.5 + (y - 13) * 1.15;
      const ad = Math.abs(d);
      if (Math.abs(ad - 1.7) <= 0.65) {
        return { ramp: PMAT.steel, tone: y % 2 === 0 ? 4 : 3 };
      }
      if (ad <= 3.0 && (y + Math.floor(x * 0.5)) % 2 === 0) {
        return { ramp: PMAT.darkWood, tone: 2 };
      }
      return null;
    });
  }),

  // 24x24 Isometric arcane/stone block with violet & ice-blue crystals raining down
  crystal_shower: icon24((c) => {
    c.isoBlock(PMAT.arcane, PMAT.stone, PMAT.iron, 17, 4);
    c.stamp(
      4,
      1,
      [
        '...P........^...',
        '..PpP......^~^..',
        '..Pzp.....^~=^..',
        '...z.......=-...',
        '.......P........',
        '......PpP....P..',
        '.....Ppzp...PpP.',
        '..^..PzzZ...Pzp.',
        '.^~^..zZ.....Z..',
        '.^~=^...........',
      ],
      PMAT.arcane,
      PMATS,
    );
  }),

  // 24x24 Isometric earth/stone block with faceted granite boulders raining down
  boulder_rain: icon24((c) => {
    c.isoBlock(PMAT.stone, PMAT.wood, PMAT.iron, 17, 4);
    c.stamp(
      3,
      1,
      [
        '..Nnn.......Nnn...',
        '.Nnnnh.....Nnnnh..',
        '.nnhHH.....nnhHH..',
        '..HHH...Nnn.HHH...',
        '.......Nnnnh......',
        '..Nnn..nnhHH..Nn..',
        '.Nnnnh..HHH..Nnnh.',
        '.nnhHH.......nhHH.',
      ],
      PMAT.stone,
      PMATS,
    );
  }),

  // 24x24 Isometric moss block with rose cherry-blossom petals drifting from above
  blossom_rain: icon24((c) => {
    c.isoBlock(PMAT.moss, PMAT.wood, PMAT.darkWood, 17, 4);
    c.stamp(
      3,
      1,
      [
        '..@#........@#....',
        '.@#Y#......@#Y#...',
        '..#?!.......#?!...',
        '.......@#.........',
        '......@#Y#....@#..',
        '..@#...#?!...@#Y#.',
        '.@#Y#.........#?!.',
        '..?!....@#........',
        '.......@#Y#.......',
      ],
      PMAT.rose,
      PMATS,
    );
  }),

  // 24x24 Isometric lush moss block with dense tropical palm & exotic blooms
  jungle_bloom: icon24((c) => {
    c.isoBlock(PMAT.moss, PMAT.wood, PMAT.darkWood, 17, 4);
    c.stamp(
      3,
      1,
      [
        '....EEe..EEe......',
        '..EEeeelEeeelEE...',
        '.EeeellLllleeeel..',
        '..ellLLbkLLllle...',
        '...LL.Bbbk.LL.....',
        '......Bbk...Rr....',
        '..Ee..Bbk..Rrq....',
        '.Eeel.bkK...el....',
        '..llL.kK....lL....',
      ],
      PMAT.moss,
      PMATS,
    );
  }),

  // 24x24 Isometric fertile soil block with water droplets, gold motes & fresh sprouts
  soil_enrich: icon24((c) => {
    c.isoBlock(PMAT.darkWood, PMAT.wood, PMAT.darkWood, 17, 4);
    c.stamp(
      4,
      1,
      [
        '..C.....Y....C..',
        '.Ccu...Yyg..Ccu.',
        '..u.....g....u..',
        '................',
        '...Ee......Ee...',
        '..Eeel....Eeel..',
        '...llL.Ee..llL..',
        '....l.Eeel..l...',
        '.......llL......',
      ],
      PMAT.water,
      PMATS,
    );
  }),

  // 24x24 Isometric golden sand block with sweeping sunlit dune ridges & desert cactus
  desert_dunes: icon24((c) => {
    c.isoBlock(PMAT.sand, PMAT.wood, PMAT.darkWood, 17, 4);
    c.stamp(
      3,
      4,
      [
        '......::::........',
        '....:::;;;::......',
        '...::;;;;,,;;..e..',
        '..:;;;;,,,,__e.e..',
        '.::;,,,,,,,,_ele..',
        '.;;,,,,_____..l...',
        '..............L...',
      ],
      PMAT.sand,
      PMATS,
    );
  }),

  // 24x24 Isometric ocean block with branching crimson coral & amber sea-fans
  coral_reef_rain: icon24((c) => {
    c.isoBlock(PMAT.water, PMAT.water, PMAT.iron, 17, 4);
    c.stamp(
      4,
      1,
      [
        '..R...R....F..F.',
        '..Rr.Rr...Ff.Ff.',
        '...Rrq.....Ffa..',
        '...rqQ..^...aA..',
        '....q..^~...aA..',
        '..Rrq......Ffa..',
        '..rqQ..R...faA..',
        '...Q..Rrq...A...',
      ],
      PMAT.crimson,
      PMATS,
    );
  }),

  // 24x24 Isometric steel/stone block with riveted scrap plates & brass gear dropping
  salvage_drop: icon24((c) => {
    c.isoBlock(PMAT.steel, PMAT.stone, PMAT.iron, 17, 4);
    c.stamp(
      4,
      1,
      [
        '..SSss......Yy..',
        '.SsmmMM....YygG.',
        '.smDmmM....gYGG.',
        '..mMMM...SSss...',
        '........SsmmMM..',
        '...Bbk..smDmmM..',
        '..BbbkK..MMMM...',
        '..kkKK..........',
      ],
      PMAT.steel,
      PMATS,
    );
  }),

  // 24x24 Isometric basalt block with jagged obsidian spires & thin glowing magma cracks
  volcanic_obsidian: icon24((c) => {
    c.isoBlock(PMAT.iron, PMAT.amber, PMAT.iron, 17, 4);
    c.stamp(
      4,
      2,
      [
        '....D.......D...',
        '...DSD.....DSD..',
        '...DdD..D..DdD..',
        '..DdFD.DSD.DdD..',
        '..dFFd.DdD.dFd..',
        '..dFad.dFd.dad..',
        '...dd..dad..d...',
        '....D..dDd..D...',
      ],
      PMAT.iron,
      PMATS,
    );
  }),

  // 24x24 Isometric ocean block with rising marble & gold sunken temple colonnade
  atlantis_rise: icon24((c) => {
    c.isoBlock(PMAT.water, PMAT.water, PMAT.iron, 17, 4);
    c.stamp(
      4,
      2,
      [
        '......YYYY......',
        '....YYyyyyGG....',
        '..YYYYggggGGGG..',
        '...II..II..II...',
        '...ij..ij..ij...',
        '...ij..ij..ij...',
        '...ij..ij..ij...',
        '..^~~^~~^~~^~~..',
        '.^~===~===~===~.',
      ],
      PMAT.gold,
      PMATS,
    );
  }),

  // 24x24 Towering jagged snow-and-ice alpine glacier peak with stone base
  alpine_glacier: cluster24(
    [
      '........................',
      '...........^^...........',
      '..........^~~^..........',
      '.........^~~~==.........',
      '........^~~~====........',
      '.......^~~^~====-.......',
      '......^~~^~~=====-......',
      '.....^~~^~~~===Nnn-.....',
      '....^~~^~~~===NnnhH-....',
      '...^~~^~~~===NnnnhHH....',
      '..^~~^~~~===NnnnhHH==...',
      '..^~^~~~===NnnnhHHH==...',
      '.^~~===NnnNnnnhHHHH==-..',
      '.^~===NnnhHnnnhHHHHH=-..',
      '.~===NnnnhHnnnhHHHHHH-..',
      '.===NnnnhHHnnnhHHHHHH-..',
      '.==NnnnhHHHnnnhHHHHHH-..',
      '..=NnnnhHHHnnnhHHHHH-...',
      '..NnnnnhHHHnnnhHHHHHH...',
      '...HHHHHHHHHHHHHHHHHH...',
      '....0000000000000000....',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.ice,
    PMATS,
  ),

  // 24x24 Isometric deep ocean block split by a yawning pitch-dark abyssal trench
  abyssal_trench: icon24((c) => {
    c.isoBlock(PMAT.water, PMAT.iron, PMAT.iron, 17, 4, (x, y) => {
      const band = Math.abs(x - 11.5 + (y - 13) * 0.9);
      if (band <= 1.5) return { ramp: PMAT.iron, tone: 0 };
      if (band <= 2.6) return { ramp: PMAT.iron, tone: 1 };
      if (band <= 3.3) return { ramp: PMAT.water, tone: 1 };
      return null;
    });
  }),

  // 24x24 Isometric murky moss & dark-wood bog with stagnant pools & cattail reeds
  swamp_mire: icon24((c) => {
    c.isoBlock(PMAT.moss, PMAT.darkWood, PMAT.iron, 17, 4, (x, y, cx, cy) => {
      const d1 = (x - (cx - 2.5)) ** 2 / 7 + (y - (cy + 0.5)) ** 2 / 2.5;
      const d2 = (x - (cx + 3)) ** 2 / 5 + (y - (cy - 1)) ** 2 / 2;
      if (d1 <= 1 || d2 <= 1) return { ramp: PMAT.darkWood, tone: 1 };
      return null;
    });
    c.stamp(
      4,
      3,
      [
        '..K..........K..',
        '..k...Ee.....k..',
        '..l..Eeel....l..',
        '..l...llL.K..l..',
        '..L.......k..L..',
        '..........l.....',
      ],
      PMAT.moss,
      PMATS,
    );
  }),

  // 24x24 Isometric basalt block with smoking fissures & glowing molten ember pools
  volcanic_wasteland: icon24((c) => {
    c.isoBlock(PMAT.iron, PMAT.amber, PMAT.iron, 17, 4);
    c.stamp(
      4,
      2,
      [
        '.....Nn.........',
        '....NnhH........',
        '.....FFf........',
        '...DFYYfD.......',
        '..DdFffadD..D...',
        '..dDFaadDd.DFd..',
        '...dF..ad..dad..',
        '..Ff....aF..d...',
      ],
      PMAT.amber,
      PMATS,
    );
  }),

  // 24x24 Isometric blighted arcane/iron block with eerie toxic pools & dead thorns
  blighted_mire: icon24((c) => {
    c.isoBlock(PMAT.arcane, PMAT.iron, PMAT.iron, 17, 4);
    c.stamp(
      4,
      2,
      [
        '..D.........D...',
        '.DpD.......DpD..',
        '..D.p....p..D...',
        '...Dp+*+*pD.....',
        '...p+*%*%+p.....',
        '....+%&&%+......',
        '..p..&&&&..p....',
      ],
      PMAT.arcane,
      PMATS,
    );
  }),

  // 24x24 Isometric lush meadow carpeted with crimson, gold, arcane & sky wildflowers
  floral_plains: icon24((c) => {
    c.isoBlock(PMAT.moss, PMAT.wood, PMAT.darkWood, 17, 4);
    c.stamp(
      4,
      3,
      [
        '.Rr...Yy...Pp...',
        'RrY..Yyg..PpY...',
        '.el...el...el...',
        '.lL.Cc.Rr..lL...',
        '...Ccu.RrY..Yy..',
        '....el..el.Yyg..',
        '....lL..lL..el..',
      ],
      PMAT.moss,
      PMATS,
    );
  }),

  // 24x24 Isometric golden savanna block topped with an iconic flat-topped acacia tree
  savanna_biome: icon24((c) => {
    c.isoBlock(PMAT.sand, PMAT.wood, PMAT.darkWood, 17, 4);
    c.stamp(
      3,
      2,
      [
        '...EEeeeeEE.......',
        '.EEeeellleeeE.....',
        '..eellLLLLllE.....',
        '......B..bk.......',
        '.......Bbk........',
        '.......Bbk........',
        '.......bkK........',
        '......bbkK........',
      ],
      PMAT.moss,
      PMATS,
    );
  }),

  // 24x24 Isometric moss block topped with a dense cluster of rounded oak trees
  forest_biome: icon24((c) => {
    c.isoBlock(PMAT.moss, PMAT.wood, PMAT.darkWood, 17, 4);
    c.stamp(
      3,
      2,
      [
        '..EEe....EEe......',
        '.Eeeel..Eeeel.....',
        'EeeellLEeeellL....',
        '.eellLL.eellLL....',
        '..llbk...llbk.....',
        '....bk.EEe.bk.....',
        '....kKEeel.kK.....',
        '......ellL........',
        '.......bk.........',
      ],
      PMAT.moss,
      PMATS,
    );
  }),

  // 24x24 Isometric cool moss/stone block topped with snow-dusted spruce pines
  taiga_biome: icon24((c) => {
    c.isoBlock(PMAT.moss, PMAT.stone, PMAT.iron, 17, 4);
    c.stamp(
      3,
      1,
      [
        '......^...........',
        '.....^e^..........',
        '....^eel^....^....',
        '...EeeellL..^e^...',
        '..EeeellllL^eel^..',
        '.EeeellllLLeeellL.',
        '..lllLLLLL.lllLL..',
        '......bk.....bk...',
        '......kK.....kK...',
      ],
      PMAT.moss,
      PMATS,
    );
  }),

  // 24x24 Isometric permafrost stone block with snow patches & exposed grey boulders
  tundra_biome: icon24((c) => {
    c.isoBlock(PMAT.stone, PMAT.darkWood, PMAT.iron, 17, 4, (x, y) => {
      if ((x * 3 + y * 5) % 7 <= 1) return { ramp: PMAT.ice, tone: 3 };
      return null;
    });
    c.stamp(
      4,
      4,
      [
        '..^^......Nnn...',
        '.^~~^....Nnnnh..',
        '..==..Nn.nnhHH..',
        '.....Nnnh..HH...',
        '.....nhHH.......',
      ],
      PMAT.ice,
      PMATS,
    );
  }),

  // 24x24 Isometric snow/ice block with soft snowdrifts & crisp crystalline snowflakes
  snow_biome: icon24((c) => {
    c.isoBlock(PMAT.ice, PMAT.stone, PMAT.iron, 17, 4);
    c.stamp(
      3,
      1,
      [
        '...^.........^....',
        '..^~^.......^~^...',
        '...^.........^....',
        '........^.........',
        '.......^~^........',
        '........^.........',
        '..^^^^.....^^^^...',
        '.^~~~~^...^~~~~^..',
      ],
      PMAT.ice,
      PMATS,
    );
  }),

  // 24x24 Isometric terracotta/bronze red-rock block with stratified desert ridges
  badlands_biome: icon24((c) => {
    c.isoBlock(PMAT.bronze, PMAT.wood, PMAT.darkWood, 17, 4);
    c.stamp(
      4,
      3,
      [
        '....XXXXXX......',
        '...XxxxxxxV.....',
        '..XxxvvvvvvV....',
        '.::;;;,,,,;;:...',
        '.XxxvvVVVVvvx...',
        '.xxvvVVVVVVvv...',
      ],
      PMAT.bronze,
      PMATS,
    );
  }),

  // 24x24 Isometric moss block topped with a gnarled wooden sakura tree in full pink bloom
  blossom_biome: icon24((c) => {
    c.isoBlock(PMAT.moss, PMAT.wood, PMAT.darkWood, 17, 4);
    c.stamp(
      3,
      1,
      [
        '....@@##..........',
        '..@@####!@@.......',
        '.@###@####!#......',
        '.@##!!###!!?......',
        '..#!!?Bbk!!?......',
        '......Bbk.........',
        '.....Bbbk...@#....',
        '.....bkK...#?!....',
        '....bbkK..........',
      ],
      PMAT.rose,
      PMATS,
    );
  }),

  // 24x24 Isometric highland stone block topped with craggy twin peaks & heather
  highland_biome: icon24((c) => {
    c.isoBlock(PMAT.stone, PMAT.darkWood, PMAT.iron, 17, 4);
    c.stamp(
      3,
      2,
      [
        '.....NN...........',
        '....NNnh....NN....',
        '...NNnnhH..NNnh...',
        '..NNnnnhHHNNnnhH..',
        '.NNnnnnhHHnnnnhHH.',
        '.NnnnnhHHHnnnhHHH.',
        '.eelnhHHHHnnhHeel.',
      ],
      PMAT.stone,
      PMATS,
    );
  }),

  // 24x24 Isometric ice/arcane block topped with towering faceted crystal spires
  crystal_biome: icon24((c) => {
    c.isoBlock(PMAT.ice, PMAT.arcane, PMAT.iron, 17, 4);
    c.stamp(
      4,
      1,
      [
        '......^.........',
        '.....^~^........',
        '....^~~=^...P...',
        '..P.^~==^..PpP..',
        '.PpP^~==-..Pzp..',
        '.Pzp^===-..PzZ..',
        '.PzZ~===-..zZZ..',
        '..zZ====-...Z...',
      ],
      PMAT.ice,
      PMATS,
    );
  }),

  // 24x24 Isometric blackened ash/iron block with charred stump & smoldering embers
  scorched_biome: icon24((c) => {
    c.isoBlock(PMAT.iron, PMAT.iron, PMAT.iron, 17, 4);
    c.stamp(
      4,
      3,
      [
        '......F.........',
        '.....FfF........',
        '..D..faa...D....',
        '.DdD..a...DdD...',
        '.dDd..F...dDd...',
        '.dDd.FfF..dDd...',
        '..dd..a....dd...',
      ],
      PMAT.amber,
      PMATS,
    );
  }),

  // 24x24 Isometric basalt block with glowing molten amber-gold lava river
  lava_river: icon24((c) => {
    drawIsoRiver24(c, PMAT.iron, PMAT.amber, PMAT.iron, PMAT.amber, PMAT.gold);
  }),

  // 24x24 Isometric dark arcane block with bubbling toxic-green acid river
  poison_river: icon24((c) => {
    drawIsoRiver24(c, PMAT.arcane, PMAT.iron, PMAT.iron, PMAT.toxic, PMAT.toxic);
  }),

  // 24x24 Isometric moss block with colorful flower buds showering from above
  floral_rain: icon24((c) => {
    c.isoBlock(PMAT.moss, PMAT.wood, PMAT.darkWood, 17, 4);
    c.stamp(
      3,
      1,
      [
        '.Rr.....Yy....Pp..',
        'RrY....Yyg...PpY..',
        '.q......g.....z...',
        '....Cc......Rr....',
        '...Ccu.....RrY....',
        '....u..@#...q.....',
        '......@#Y#........',
      ],
      PMAT.crimson,
      PMATS,
    );
  }),

  // 24x24 Beveled steel bucket brimming with shimmering blue water & falling droplet
  water_drop: cluster24(
    [
      '........................',
      '........................',
      '.......sSSSSSSs.........',
      '.....sSM......MSs.......',
      '....sM...^CC^...Ms......',
      '...sSS^CCccccCC^SSs.....',
      '...sMCcccuuuucccCMs.....',
      '...sMMcuuuuuuuucMMs.....',
      '....sSSmmmmmmmMMMd......',
      '....sSsmmm^CmmMMMd......',
      '....sSsmm^CcuMMMd.......',
      '.....sSsmCcuuMMMd.......',
      '.....sSsmcuuUMMMd.......',
      '.....sSsmmuuUMMMd.......',
      '......sSsmmmmMMd........',
      '......sSsmmmmMMd........',
      '.......sMMMMMMd.........',
      '........dddddd..........',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.water,
    PMATS,
  ),

  // 24x24 Dark-iron bucket brimming with glowing molten amber-gold lava & falling ember drop
  lava_drop: cluster24(
    [
      '........................',
      '........................',
      '.......sSSSSSSs.........',
      '.....sSM......MSs.......',
      '....sM...YFFY...Ms......',
      '...sSSYFFffffFFYSSs.....',
      '...sMFfffaaaafffFMs.....',
      '...sMMfaaaaaaaafMMs.....',
      '....sSSmmmmmmmMMMd......',
      '....sSsmmmYFmmMMMd......',
      '....sSsmmYFfaMMMd.......',
      '.....sSsmFfaaMMMd.......',
      '.....sSsmfaaAMMMd.......',
      '.....sSsmmaaAMMMd.......',
      '......sSsmmmmMMd........',
      '......sSsmmmmMMd........',
      '.......sMMMMMMd.........',
      '........dddddd..........',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.amber,
    PMATS,
  ),

  // 24x24 Dark-iron bucket brimming with bubbling toxic green ooze & falling acid drop
  poison_drop: cluster24(
    [
      '........................',
      '........................',
      '.......sSSSSSSs.........',
      '.....sSM......MSs.......',
      '....sM...++++...Ms......',
      '...sSS++******++SSs.....',
      '...sM+**%%%%%%**+Ms.....',
      '...sMM*%%%%%%%%*MMs.....',
      '....sSSmmmmmmmMMMd......',
      '....sSsmmm+*mmMMMd......',
      '....sSsmm+*%*MMMd.......',
      '.....sSsm*%&%MMMd.......',
      '.....sSsm%&&&MMMd.......',
      '.....sSsmm&&&MMMd.......',
      '......sSsmmmmMMd........',
      '......sSsmmmmMMd........',
      '.......sMMMMMMd.........',
      '........dddddd..........',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.toxic,
    PMATS,
  ),

  // 24x24 Deep stratified red-ochre canyon walls dropping into a shadowed gorge & river
  canyon_carve: cluster24(
    [
      '........................',
      '........................',
      '..XXXXxx........xxXXXX..',
      '..Xxxxvv........vvxxxX..',
      '..xxvvvV........Vvvvxx..',
      '..vvvVVk........kVVvvv..',
      '..::;;,k........k,;;::..',
      '..XXxxxK...dd...KxxxXX..',
      '..XxxvvK...dd...KvvxxX..',
      '..xvvvVK..dddd..KVvvvx..',
      '..vvVVVK..dddd..KVVVvv..',
      '..::;;,K..dddd..K,;;::..',
      '..xxvvvK..dCcd..Kvvvxx..',
      '..vvVVVK..dCcd..KVVVvv..',
      '..vVVVKk..dCud..kKVVVv..',
      '..VVVKKk..duUd..kKKVVV..',
      '..VKKKKk..dUUd..kKKKKV..',
      '...KKKKKddUUUUddKKKKK...',
      '....KKKKKKKKKKKKKKKK....',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.bronze,
    PMATS,
  ),

  // 24x24 Dramatic flat-topped red-bronze desert mesa with sedimentary strata bands
  mesa_plateau: cluster24(
    [
      '........................',
      '........................',
      '........................',
      '.....XXXXXXXXXXXXXX.....',
      '....XxxxxxxxxxxxxxxX....',
      '....XxxxvvvvvvvvxxxX....',
      '....vvvvVVVVVVVVvvvv....',
      '....::;;;,,VV,,;;;::....',
      '....vvvvVVVVVVVVvvvv....',
      '...XxxxvvVVVVVVvvxxxX...',
      '...xxxvvVVVVVVVVvvxxx...',
      '...vvVVVKKVVVVKKVVVvv...',
      '..::;;;,,,VVVV,,,;;;::..',
      '..XxxvvvVVVVVVVVvvvxxX..',
      '..xvvVVVVVVVVVVVVVVvvx..',
      '..vVVVKKVVVVVVVVKKVVVv..',
      '..::;;,,,,VVVV,,,,;;::..',
      '..;;,,,,________,,,,;;..',
      '...__________________...',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.bronze,
    PMATS,
  ),

  // 24x24 Dark basalt volcanic caldera rim with glowing molten amber-gold lava bowl
  volcanic_crater: cluster24(
    [
      '........................',
      '........................',
      '........................',
      '......NNNNNNNNNNNN......',
      '....NNnnnhhhhhhnnnNN....',
      '...NNnnhHHddddHHhnNN....',
      '..NNnhHHddFFFFddHHhnN...',
      '..NnhHddFFYYYYFFddHhnN..',
      '..nhHddFFYffffYFFddHhn..',
      '..nhHddFFfaaaafFFddHhn..',
      '..nhHHddFfaaaafFddHHhn..',
      '..nnhHHdddaaaadddHHhnn..',
      '..nnhhHHddddddddHHhhnn..',
      '..nnhhhHHHHHHHHHHhhhnn..',
      '..hhhHHHHHHHHHHHHHHhhh..',
      '...hhHHHHHHHHHHHHHHhh...',
      '...DDHHHHHHHHHHHHHHDD...',
      '....DDDDHHHHHHHHDDDD....',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.stone,
    PMATS,
  ),

  // 24x24 Smoothly terraced rolling green hill with gentle ice-blue smoothing arcs above
  smooth_terrain: cluster24(
    [
      '........................',
      '........................',
      '........................',
      '......^^^^^^^^^^........',
      '....^^~~~....~~~^^......',
      '...^~~..........~~^.....',
      '........................',
      '........EEeeeeEE........',
      '......EEeeellleeeE......',
      '....EEeeellllllleeeE....',
      '...EeellllllllllllleE...',
      '..EelllllllllllllLLLLE..',
      '..elllllllLLLLLLLLLLle..',
      '..BbbbLLLLLLLLLLLLbbbB..',
      '..bbkkkbBBBBBBBBbkkkbb..',
      '..bkkkkkKbbbbbbKkkkkkb..',
      '...kkkkkKKKKKKKKkkkkk...',
      '....KKKKKKKKKKKKKKKK....',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.moss,
    PMATS,
  ),

  // 24x24 Arched cobblestone & timber bridge spanning rippling blue water between mossy banks
  island_bridge: cluster24(
    [
      '........................',
      '........................',
      '........................',
      '........................',
      '........NNNNNNNN........',
      '.....NNNnnNNNNnnNNN.....',
      '....NnnnBbbbbbbBnnnN....',
      '..EEeeBbbbkkkkbbbBeeEE..',
      '..EellBbkH....HkbBllEE..',
      '..llkkKH..^CC^..HKkkll..',
      '..kKKH^CCccuuccCC^HKKk..',
      '..KKH^CccuuuuuuccC^HKK..',
      '..^CCccuuuuuuuuuuccCC^..',
      '..CccuuuUUuuuuUUuuuccC..',
      '..ccuuUUUUuuuuUUUUuucc..',
      '..uuUUUUUUUUUUUUUUUUuu..',
      '...UUUUUUUUUUUUUUUUUU...',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.water,
    PMATS,
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
  | 'loreBook'
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
  | 'document'
  | 'titanOrbital'
  | 'titanLeap'
  | 'titanDeathBeam'
  | 'titanMissiles'
  | 'titanExit',
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
  loreBook: icon16((c) => {
    // 16x16 Pixel-art leather-bound Lore Tome with brass clasp, parchment pages, and crimson ribbon
    c.stamp(
      0,
      0,
      [
        '................',
        '...kBBBBBBBBk...',
        '..kBbbbbbbbbBk..',
        '..kBbYYYYYYbBk..',
        '..kBbbYbbYbbBk..',
        '..kBbbYYYYbbBk..',
        '..kBbbbbbbbbBk..',
        '..kBbbYYYYbbBk..',
        '..kBbbbbbbbbBk..',
        '..kBBBBBBBBBBk..',
        '..kWWWWWWWWWWk..',
        '..kWwwwwwwwwWk..',
        '..kBBBBBBBBBBk..',
        '...kk..RR..kk...',
        '.......Rr.......',
        '................',
      ],
      MAT.wood,
      MATS,
    );
  }),

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

  titanOrbital: cluster16(
    [
      '.......R........',
      '......mSm.......',
      '.CCc..SYs..cCC..',
      '.ccuSsmYmsSucc..',
      '.uuU..mRm..Uuu..',
      '......qRq.......',
      '......rIr.......',
      '......rIr.......',
      '......rIr.......',
      '.....rrIrr......',
      '.....rrIrr......',
      '....fFrIrFf.....',
      '...fFYrIrYFf....',
      '..aFFFYIYFFFa...',
      '...aaFFFFFaa....',
      '................',
    ],
    MAT.steel,
    MATS,
  ),

  titanLeap: cluster16(
    [
      '.......S........',
      '......sSs.......',
      '......mSm.......',
      '......mSm.......',
      '....s.mSm.s.....',
      '.....smSms......',
      '......mSm.......',
      '.......m........',
      '....F..Y..F.....',
      '..fF..FYF..Ff...',
      '.aFF.fFYFf.FFa..',
      '.FFaFFYIYFFaFF..',
      '..aaFFYYYFFaa...',
      '...mmmAAAmmm....',
      '....MmmmmMM.....',
      '................',
    ],
    MAT.steel,
    MATS,
  ),

  titanDeathBeam: cluster16(
    [
      '.....mmssmm.....',
      '...mmssssssmm...',
      '..msssmmmmsssm..',
      '.msmmmsmmmsmmms.',
      '.mMmmsmmmmmsMmM.',
      '..mFFYYYYYYFFm..',
      '...EFFYIIYFFE...',
      '.....rFIFr......',
      '......rIr.......',
      '....iirIrii.....',
      '......rIr.......',
      '.....rrIrr......',
      '....mFrIrFm.....',
      '...mmFYIYFFm....',
      '..mMMaFFFaMMm...',
      '................',
    ],
    MAT.steel,
    MATS,
  ),

  titanMissiles: cluster16(
    [
      '...........RR...',
      '..........RRSs..',
      '....RR...SSsm...',
      '...RRSs.Fssm....',
      '..SSsm.FYf......',
      '.Fssm.ff....RR..',
      'FYf........RRSs.',
      'ff....RR..SSsm..',
      '.....RRSsFssm...',
      '....SSsmFYf.....',
      '...Fssm.ff......',
      '..FYf...........',
      '.ffa............',
      '..a.............',
      '................',
      '................',
    ],
    MAT.steel,
    MATS,
  ),

  titanExit: cluster16(
    [
      '......cIc.......',
      '.....cCICc......',
      '....cCIYICc.....',
      '...cCIcIcICc....',
      '......cIc.......',
      '.....cCICc......',
      '....cCI.ICc.....',
      '......cIc.......',
      '......cIc.......',
      '......cIc.......',
      '.....ccIcc......',
      '.....ccIcc......',
      '....uucIcuu.....',
      '...uuccIccuu....',
      '....UUUUUUU.....',
      '................',
    ],
    MAT.azure,
    MATS,
  ),
};
