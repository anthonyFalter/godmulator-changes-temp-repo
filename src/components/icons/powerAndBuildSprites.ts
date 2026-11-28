import type { BuildingType, GodPowerType } from '../../game/types';
import {
  type CompiledSprite,
  Icon24,
  type MatLegend,
  PMAT,
  cluster24,
  icon24,
} from './pixelEngine';

const PB_MATS: MatLegend = {
  // Gold
  Y: { ramp: PMAT.gold, tone: 4 },
  y: { ramp: PMAT.gold, tone: 3 },
  g: { ramp: PMAT.gold, tone: 2 },
  G: { ramp: PMAT.gold, tone: 1 },
  // Amber / Flame
  F: { ramp: PMAT.amber, tone: 4 },
  f: { ramp: PMAT.amber, tone: 3 },
  a: { ramp: PMAT.amber, tone: 2 },
  A: { ramp: PMAT.amber, tone: 1 },
  // Crimson
  R: { ramp: PMAT.crimson, tone: 4 },
  r: { ramp: PMAT.crimson, tone: 3 },
  q: { ramp: PMAT.crimson, tone: 2 },
  Q: { ramp: PMAT.crimson, tone: 1 },
  // Wood
  B: { ramp: PMAT.wood, tone: 4 },
  b: { ramp: PMAT.wood, tone: 3 },
  k: { ramp: PMAT.wood, tone: 2 },
  K: { ramp: PMAT.wood, tone: 1 },
  // Moss / Leaf
  E: { ramp: PMAT.moss, tone: 4 },
  e: { ramp: PMAT.moss, tone: 3 },
  l: { ramp: PMAT.moss, tone: 2 },
  L: { ramp: PMAT.moss, tone: 1 },
  // Toxic
  T: { ramp: PMAT.toxic, tone: 4 },
  t: { ramp: PMAT.toxic, tone: 3 },
  w: { ramp: PMAT.toxic, tone: 2 },
  W: { ramp: PMAT.toxic, tone: 1 },
  // Water / Azure
  C: { ramp: PMAT.water, tone: 4 },
  c: { ramp: PMAT.water, tone: 3 },
  u: { ramp: PMAT.water, tone: 2 },
  U: { ramp: PMAT.water, tone: 1 },
  // Ice / Glacial Highlight
  X: { ramp: PMAT.ice, tone: 4 },
  x: { ramp: PMAT.ice, tone: 3 },
  // Steel / Slate
  S: { ramp: PMAT.steel, tone: 4 },
  s: { ramp: PMAT.steel, tone: 3 },
  m: { ramp: PMAT.steel, tone: 2 },
  M: { ramp: PMAT.steel, tone: 1 },
  // Parchment / Ivory
  I: { ramp: PMAT.parchment, tone: 4 },
  i: { ramp: PMAT.parchment, tone: 3 },
  j: { ramp: PMAT.parchment, tone: 2 },
  J: { ramp: PMAT.parchment, tone: 1 },
  // Arcane Violet
  P: { ramp: PMAT.arcane, tone: 4 },
  p: { ramp: PMAT.arcane, tone: 3 },
  z: { ramp: PMAT.arcane, tone: 2 },
  Z: { ramp: PMAT.arcane, tone: 1 },
  // Stone
  N: { ramp: PMAT.stone, tone: 4 },
  n: { ramp: PMAT.stone, tone: 3 },
  h: { ramp: PMAT.stone, tone: 2 },
  H: { ramp: PMAT.stone, tone: 1 },
  // Bronze
  V: { ramp: PMAT.bronze, tone: 3 },
  v: { ramp: PMAT.bronze, tone: 2 },
  // Iron / Dark Crease & Pitch Core
  D: { ramp: PMAT.iron, tone: 1 },
  d: { ramp: PMAT.iron, tone: 0 },
  '@': PMAT.iron.out,
  // Rose
  '%': { ramp: PMAT.rose, tone: 3 },
  '&': { ramp: PMAT.rose, tone: 2 },
};

/** Helper to draw a small isometric stone/wood building basepad on Icon24. */
function drawBasePad(
  c: Icon24,
  topRamp = PMAT.moss,
  leftRamp = PMAT.wood,
  rightRamp = PMAT.darkWood,
  baseY = 21,
  wallH = 3,
): void {
  c.isoBlock(topRamp, leftRamp, rightRamp, baseY, wallH);
}

/** Helper to draw an isometric box (house/tower body) centered at cx, bottom apex at botY. */
function drawIsoBox(
  c: Icon24,
  cx: number,
  botY: number,
  halfW: number,
  height: number,
  topRamp: typeof PMAT.stone,
  leftRamp: typeof PMAT.stone,
  rightRamp: typeof PMAT.stone,
): void {
  // Left & right vertical walls
  for (let dx = -halfW; dx <= halfW; dx++) {
    const x = cx + dx;
    const rise = Math.floor(Math.abs(dx) / 2);
    const yBot = botY - rise;
    const yTop = yBot - height;
    for (let y = yTop; y <= yBot; y++) {
      if (dx <= 0) {
        const tone = y === yBot ? 1 : dx === 0 ? 1 : y === yTop ? 3 : 2;
        c.set(x, y, leftRamp, tone);
      } else {
        const tone = y === yBot ? 0 : y === yTop ? 2 : 1;
        c.set(x, y, rightRamp, tone);
      }
    }
  }
  // Flat diamond roof
  const roofCenterY = botY - height - Math.floor(halfW / 2);
  const halfH = Math.max(1, Math.floor(halfW / 2));
  for (let dy = -halfH; dy <= halfH; dy++) {
    const span = Math.max(0, halfW - Math.abs(dy) * 2);
    for (let dx = -span; dx <= span; dx++) {
      const isRim = dy >= 0 && (Math.abs(dx) >= span - 1);
      c.set(cx + dx, roofCenterY + dy, topRamp, isRim ? 4 : 3);
    }
  }
}

export const POWER_SPRITES: Record<GodPowerType, CompiledSprite> = {
  // Grab: Leather-gloved hand reaching down with thumb & fingers pinching a tiny glowing orb/creature
  drag_entity: cluster24(
    [
      '........................',
      '............VVvv........',
      '...........VVvvvG.......',
      '..........4333221.......',
      '.........433222211......',
      '........4322222111......',
      '.......43221012211......',
      '......4321o..12211......',
      '.....4321....12210......',
      '.....321.....22110......',
      '....432.....32210.......',
      '....321.....2211........',
      '....21......211.........',
      '......XCCc..............',
      '.....XCcCuu.............',
      '.....CcuuuuU............',
      '.....cuuU1UU............',
      '......uUUUU.............',
      '.......YYY..............',
      '......Y...Y.............',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.wood,
    PB_MATS,
  ),

  // Bless: Golden divine beam descending onto a glowing heart with halo & warm sparkles
  blessing: cluster24(
    [
      '........................',
      '........YyyYyyY.........',
      '.........YyyyY..........',
      '.....Y...YyyyY...Y......',
      '.........YyyyY..........',
      '.......YYYYYYYYY........',
      '......YygggggggGY.......',
      '....Y..Yg.....gG..Y.....',
      '........YyyyyyY.........',
      '......RRr....rRR........',
      '.....RRr33..33rqq.......',
      '....RR332233222qq.......',
      '....R3222222222qQ.......',
      '....R3222222221qQ.......',
      '.....3222222211Q........',
      '......22222211Q.........',
      '.......222211Q..........',
      '........2211Q...........',
      '....Y....21Q.....Y......',
      '..........Q.............',
      '......Y.......Y.........',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.crimson,
    PB_MATS,
  ),

  // Rain: Layered slate-blue storm cloud with crisp diagonal falling rain droplets
  rain_of_plenty: cluster24(
    [
      '........................',
      '........................',
      '........44444...........',
      '......443333332.........',
      '.....433333333322.......',
      '....33333333333321......',
      '...3322222222222211.....',
      '..322222222222222111....',
      '..221111111111111110....',
      '...1111000000000110.....',
      '........................',
      '.....Xc....Xc....Xc.....',
      '....Xcu...Xcu...Xcu.....',
      '....cuU...cuU...cuU.....',
      '....uU....uU....uU......',
      '........................',
      '...Xc....Xc....Xc.......',
      '..Xcu...Xcu...Xcu.......',
      '..cuU...cuU...cuU.......',
      '..uU....uU....uU........',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.steel,
    PB_MATS,
  ),

  // Purify: Pure radiant beam turning cracked dark earth into fresh green grass
  cleanse_land: cluster24(
    [
      '........................',
      '...........XY...........',
      '..........XyyX..........',
      '......Y...XyyX...Y......',
      '..........XyyX..........',
      '.........XXyyXX.........',
      '........X..yy..X........',
      '...........yy...........',
      '......Y...XyyX...Y......',
      '..........XyyX..........',
      '...........yy.....E.....',
      '..........XyyX...EeE....',
      '.......NnhXyyXEeEeE.....',
      '.....NnhhhDyyEeelEeE....',
      '...NnhhhdDDyyEeelllEe...',
      '..NnhhdDDdhyyeellllleE..',
      '..nhhhdDhhdhllellllleL..',
      '..hhhHDhhHHDllllllllLL..',
      '...hhHHDHHHDllllllLLL...',
      '....hHHHHDHHDllllLLL....',
      '......HHHHDHHlllLL......',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.moss,
    PB_MATS,
  ),

  // Harvest Feast: Rich wooden basket overflowing with golden wheat sheaf, pumpkin & leaves
  bountiful_harvest: cluster24(
    [
      '........................',
      '.......Y....Y...........',
      '......YyY..YyY..........',
      '.....YygyYYygyY.........',
      '......YgygggyY..E.......',
      '.....YgyyggyY..EeE......',
      '....E.ygggyY..FFfEE.....',
      '...EeEygggy.FFffafEE....',
      '...eElgggggFffaaafalE...',
      '...lLLggggFFfaaaaafLL...',
      '..BBBBBBBBBBBBBBBBBB....',
      '..BbbbkbkbkbkbkbkbkK....',
      '...bkbkBkbkBkbkBkbKK....',
      '...kbkbkbkbkbkbkbkK.....',
      '...kBkbkBkbkBkbkBKK.....',
      '....bkbkbkbkbkbkbK......',
      '....kbkBkbkBkbkBKK......',
      '.....kbkbkbkbkbKK.......',
      '......KKKKKKKKKK........',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.wood,
    PB_MATS,
  ),

  // Shield: Heavy steel-rimmed kite shield with azure/gold runic dome barrier glow
  divine_shield: cluster24(
    [
      '........................',
      '.......XXXXXXXXX........',
      '.....XXxcccccccxXX......',
      '....Xx...........xX.....',
      '...X..44444444444..X....',
      '...x.4333333333321.x....',
      '.....43cccuYYucc21......',
      '.....43cccuYYucc21......',
      '.....32cuuuYYuuu21......',
      '.....32uYYYyyYYu21......',
      '.....32ggggGGGGg21......',
      '.....32uuuuYYuuu11......',
      '.....22uUUuYYuUU11......',
      '......21UUuYYuU11.......',
      '......21UUuYYuU11.......',
      '.......11UuYYu11........',
      '........11uYY11.........',
      '.........11gg11.........',
      '..........1111..........',
      '...........11...........',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.steel,
    PB_MATS,
  ),

  // Peace Treaty: Crisp white dove in flight holding a green olive branch in its beak
  harmony_dove: cluster24(
    [
      '........................',
      '........................',
      '..........444...........',
      '.........44333..........',
      '........4433322.........',
      '.......443333222........',
      '......44333332221.......',
      '.....443333332211.......',
      '......33333332211.......',
      '.......2233333333.......',
      '........2233333344......',
      '...444...23333333o3y....',
      '..443333..333333333yyE..',
      '...333222233333222..eEe.',
      '....2222222222221..Eel..',
      '.....11222222111....L...',
      '......11111111..........',
      '.......11111............',
      '........11..............',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.bone,
    PB_MATS,
  ),

  // Rally Militia: Crossed iron sword & spear behind a crimson/gold war banner
  recruit_legion: cluster24(
    [
      '........................',
      '...44..............44...',
      '...432............234...',
      '....432..........234....',
      '.....321.YYYYYY.123.....',
      '......21YyyyyyyY12......',
      '......B1rrrrrrrr1B......',
      '.......BrrYYYYrrB.......',
      '.......BrrYggYrrB.......',
      '.......BrrYYYYrrB.......',
      '.......BrrqggqrrB.......',
      '.......BqqqggqqqB.......',
      '.......BqqqqqqqqB.......',
      '......B1qqqYYqqq1B......',
      '.....B21qqq..qqq12B.....',
      '....B32.qq....qq.23B....',
      '...Yy2..q......q..2yY...',
      '....gG............Gg....',
      '...bk..............kb...',
      '..RR................QQ..',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.steel,
    PB_MATS,
  ),

  // Launch Fleet: Wooden medieval warship with billowing cream sail riding dark blue ocean waves
  summon_fleet: cluster24(
    [
      '........................',
      '..........brrR..........',
      '..........bqq...........',
      '..........bII...........',
      '.........IIiii..........',
      '........IIiiiiI.........',
      '.......IIiiiiiiI........',
      '......IIiiiijjjjI.......',
      '......IiiiijjjjjI.......',
      '......IiiijjjjjJ........',
      '.......iijjjjjJ.........',
      '........bJJJJ...........',
      '........b...............',
      '...BB...b..........BB...',
      '...BbbBBBBBBBBBBBBbbB...',
      '....bbkkkkkbbkkkkkbb....',
      '.....kKKKkYkkYkkKKk.....',
      '..Xc..KKKKKKKKKKKK..Xc..',
      '.XcuuXcuuXcuuXcuuXcuuXc.',
      '.cuUUcuUUcuUUcuUUcuUUcu.',
      '..UUUUUUUUUUUUUUUUUUUU..',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.wood,
    PB_MATS,
  ),

  // Heat Wave: Blazing brass sun radiating wavy heat lines over cracked sun-baked ground
  heat_wave: cluster24(
    [
      '........................',
      '...........Y............',
      '......Y....y....Y.......',
      '.......y..yyy..y........',
      '........FFyyyFF.........',
      '....Y..FffYYYffF..Y.....',
      '.....y.FffYYYffF.y......',
      '......FFfYYYYYfFF.......',
      '.....y.FffYYYffF.y......',
      '....Y..FffaaffaF..Y.....',
      '........aafffaa.........',
      '.......a..aaa..a........',
      '....F.....F.....F.......',
      '...f.....f.....f........',
      '....a.....a.....a.......',
      '...f.....f.....f........',
      '..VVVVVVVVVVVVVVVVVV....',
      '..VvvvvdvvvVVvvvdvvv....',
      '..vvvddvvvvvvvddvvvv....',
      '..vvvdvvvvvvvvdvvvvv....',
      '...ddddvvvvvvddvvvvd....',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.amber,
    PB_MATS,
  ),

  // Freeze: Detailed 6-point crystalline snowflake with glacial blue facets
  freeze_snap: cluster24(
    [
      '........................',
      '...........44...........',
      '..........4334..........',
      '....4.....2332.....4....',
      '....34...423324...43....',
      '.....32...2cc2...23.....',
      '..43..23..2cc2..32..34..',
      '...3222322c44c2232223...',
      '.....22c324XX423c22.....',
      '......2cc3X44X3cc2......',
      '..43222cc34XX43cc22234..',
      '....322cc34XX43cc223....',
      '......2uu234432uu2......',
      '.....22u212cc212u22.....',
      '...2221211u22u1121222...',
      '..21..12..1uu1..21..12..',
      '.....12...1uu1...21.....',
      '....12...212212...21....',
      '....1.....1221.....1....',
      '..........1221..........',
      '...........11...........',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.ice,
    PB_MATS,
  ),

  // Blizzard: Swirling dark-slate storm cloud blowing diagonal icy wind gusts & snow crystals
  blizzard: cluster24(
    [
      '........................',
      '......44444.............',
      '....443333332...........',
      '...433333333322.........',
      '..333222222222211.......',
      '..2222222222222111......',
      '...11111111111110.......',
      '.......0000000..........',
      '....XXxx.....X..........',
      '...Xxccu....X4X.........',
      '......XXxxx..X..........',
      '.....Xxccuu.....XXx.....',
      '...X.....XXxxx.Xccu.....',
      '..X4X...Xxccuu..........',
      '...X.......XXxxx..X.....',
      '......XXx.Xxccuu.X4X....',
      '.....Xccu.........X.....',
      '.........X...XXxx.......',
      '........X4X.Xccuu.......',
      '.........X..............',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.steel,
    PB_MATS,
  ),

  // Acid Cloud: Bubbling dark-green toxic cloud dripping corrosive lime droplets onto sizzling rock
  acid_rain: cluster24(
    [
      '........................',
      '.......44444............',
      '.....443333332..........',
      '....433333333322........',
      '...33322432222221.......',
      '..3222223222243211......',
      '..2221111111122110......',
      '...11110000001110.......',
      '........................',
      '.....43....43....43.....',
      '....432...432...432.....',
      '....21....21....21......',
      '........................',
      '.......43....43.........',
      '......432...432.........',
      '......21....21..........',
      '....4....4.....4........',
      '..NNn43NNn432NNn43NN....',
      '.Nnhh21nhh211nhh21hhN...',
      '.nhhhHHhhhHHHhhhHHhhH...',
      '..HHHHHHHHHHHHHHHHHH....',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.toxic,
    PB_MATS,
  ),

  // Lightning: Jagged forked golden-white lightning bolt striking down from dark thundercloud
  lightning_smite: cluster24(
    [
      '........................',
      '......sssss.............',
      '....ssmmmmmms...........',
      '...smmmmmmmmmM..........',
      '..mmMMMMMMMMMMD.........',
      '..MMMMMMMMMMMMd.........',
      '...DDDDDDDDDDd..........',
      '.........YYYY...........',
      '........YYyyY...........',
      '.......YYyyY............',
      '......YYyyyYYYY.........',
      '.....YYyyyyyYYy.........',
      '......ggYYYYyy..........',
      '..........YYy...........',
      '.........YYy.Yy.........',
      '........YYy...y.........',
      '.......YYy..............',
      '......YYy...............',
      '.....YYy................',
      '....FfFFf...............',
      '...NnhffhN..............',
      '....HHHHH...............',
      '........................',
      '........................',
    ],
    PMAT.gold,
    PB_MATS,
  ),

  // Meteor: Cracked charred rock meteor hurtling diagonally down-left with blazing fiery tail
  meteor_strike: cluster24(
    [
      '........................',
      '...................R....',
      '.................rRF....',
      '...............rrRFf....',
      '..............rqFFff....',
      '............rrqFFffF....',
      '...........rqFFffFFa....',
      '.........rrqFFffFFaa....',
      '........rqFFffFFaaa.....',
      '.......rqFFffFFaaa......',
      '......rqFFf433aaa.......',
      '.....rqFF433221a........',
      '....rqF4332d2211........',
      '....rF4322d22211........',
      '...rF432222d2110........',
      '...F4322d2221110........',
      '...4322222d1110.........',
      '...32222211110..........',
      '....221111100...........',
      '.....1111000............',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.stone,
    PB_MATS,
  ),

  // Tornado: Spiraling funnel cloud of slate-grey wind bands kicking up earth debris at base
  tornado: cluster24(
    [
      '........................',
      '....444444444444444.....',
      '...43333333333333321....',
      '...22222222222222210....',
      '.....1111111111110......',
      '.....443333333322.......',
      '......22222222110.......',
      '.......111111100........',
      '.......43333322.........',
      '........2222210.........',
      '.........11110..........',
      '........433322..........',
      '.........22210..........',
      '..........110...........',
      '.........4322...........',
      '..........210...........',
      '.........321............',
      '.....n....21....b.......',
      '....nh...321...bk.......',
      '...hh..nn211bb..KK......',
      '......nhhbbkkhH.........',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.steel,
    PB_MATS,
  ),

  // Earthquake: Isometric earth block split cleanly down the middle by a jagged deep chasm with falling rocks
  earthquake: icon24((c) => {
    // Left half of split isometric block (shifted slightly left-up)
    for (let x = 2; x <= 10; x++) {
      const distCenter = 11 - x;
      const drop = Math.floor(distCenter / 2);
      const yTop = 14 - drop;
      const yBot = yTop + 6;
      for (let y = yTop; y <= yBot; y++) {
        c.set(x, y, PMAT.wood, y === yBot ? 1 : y === yTop ? 3 : 2);
      }
    }
    // Right half of split isometric block (shifted slightly right-down)
    for (let x = 13; x <= 21; x++) {
      const distCenter = x - 12;
      const drop = Math.floor(distCenter / 2);
      const yTop = 15 - drop;
      const yBot = yTop + 6;
      for (let y = yTop; y <= yBot; y++) {
        c.set(x, y, PMAT.darkWood, y === yBot ? 0 : y === yTop ? 2 : 1);
      }
    }
    // Top grass surfaces split by jagged fissure
    for (let y = 5; y <= 14; y++) {
      const dy = Math.abs(y - 9);
      const halfSpan = Math.max(0, 9 - dy * 2);
      const xStart = 11 - halfSpan;
      const xEnd = 12 + halfSpan;
      const crackX = 11 + ((y % 3) === 0 ? 0 : (y % 3) === 1 ? 1 : -1);
      for (let x = xStart; x <= xEnd; x++) {
        if (x === crackX || x === crackX + 1) {
          c.setOut(x, y, PMAT.iron);
          continue;
        }
        const shiftY = x > crackX + 1 ? 1 : 0;
        const tone = y >= 9 ? 4 : 3;
        c.set(x, y + shiftY, PMAT.moss, tone);
      }
    }
    // Deep dark chasm interior & falling rock chunks
    for (let y = 11; y <= 20; y++) {
      const cx = 11 + ((y % 2) === 0 ? 0 : 1);
      c.setOut(cx, y, PMAT.iron);
      c.set(cx + 1, y, PMAT.iron, 0);
    }
    // Flying rock chunks & shock lines
    c.rect(5, 4, 2, 2, PMAT.stone, 3);
    c.rect(16, 4, 2, 2, PMAT.stone, 2);
    c.set(11, 16, PMAT.stone, 3);
    c.set(12, 18, PMAT.stone, 2);
  }),

  // Tsunami: Towering curling ocean wave with foaming white crest crashing forward
  tsunami: cluster24(
    [
      '........................',
      '........................',
      '........XXXXXXX.........',
      '......XXxxxx33333.......',
      '.....XXx3333333322......',
      '....XXx332222222221.....',
      '....Xx32222111222211....',
      '.....X32211...1222211...',
      '....X..21.....1222211...',
      '...X4X.......12222211...',
      '....X.......122222211...',
      '...........1222222211...',
      '........XXx2222222211...',
      '.......Xxx33222222211...',
      '.....XXxx332222222211...',
      '....Xxx33322222222211...',
      '...Xx3332222222222110...',
      '..X332222222222221110...',
      '..3222221111111111100...',
      '...11111000000000000....',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.water,
    PB_MATS,
  ),

  // Volcano: Dark rocky volcanic cone erupting glowing amber magma fountain & ash plume from crater
  volcano_eruption: cluster24(
    [
      '........................',
      '.......sssss............',
      '.....ssmmmmmmM..........',
      '....smmmFFmmMMD.........',
      '.....MMFFffMMd..........',
      '......FFfFfFF...........',
      '.....FffYYYffF..........',
      '......ffYYYff...........',
      '.......fYYYf............',
      '......3FFfFF2...........',
      '.....332Fff211..........',
      '.....322Ffa211..........',
      '....3221Fa22111.........',
      '....3221a221111.........',
      '...32211a2111110........',
      '...32211a2111110........',
      '..32221Fa22111110.......',
      '..32211a221111110.......',
      '..22111a111111110.......',
      '..111111111111100.......',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.stone,
    PB_MATS,
  ),

  // Lava Fissure: Cracked dark basalt ground split by glowing molten lava fissure & ember sparks
  wildfire_ring: cluster24(
    [
      '........................',
      '...........F............',
      '......F........f........',
      '...........f............',
      '........F....a..........',
      '.....n3333333333n.......',
      '....3322222F222221......',
      '...322222FFf2222211.....',
      '..322222FffY22222111....',
      '..32222FffYYf2222111....',
      '..2222FffYYff2221110....',
      '..222FffYYffa2221110....',
      '..222afYYffa22211110....',
      '..2222afYYfa22211110....',
      '..22222afYYfa2211110....',
      '...22222afYYfa11110.....',
      '....12222afYfa1110......',
      '.....11222afaa110.......',
      '......11111aa100........',
      '........111100..........',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.iron,
    PB_MATS,
  ),

  // Sinkhole: Deep concentric collapsing earth pit with crumbled stone rim plunging into pitch darkness
  sinkhole: cluster24(
    [
      '........................',
      '........................',
      '........................',
      '.......EEEEEEEE.........',
      '.....EEeeeeeeeeEE.......',
      '....EeeNNnnnnNNeeE......',
      '...EeNNnhhhhhhNNeEl.....',
      '..EeNnhhHDDDDHhhNneL....',
      '..eNnhHDddddddDHhnNL....',
      '..eNhHDdd@@@@ddDHhNL....',
      '..eNhHDd@@@@@@dDHhNL....',
      '..eNhHDd@@@@@@dDHhNL....',
      '..eNhHDdd@@@@ddDHhNL....',
      '..lNnhHDddddddDHhnNL....',
      '...lNnhhHDDDDHhhNnL.....',
      '....lLNNnhhhhNNnLL......',
      '.....LLlNNNNNNlLL.......',
      '.......LLLLLLLL.........',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.stone,
    PB_MATS,
  ),

  // Start War: Two crossed steel broadswords clashing with sparks over a crimson war crest
  start_war: cluster24(
    [
      '........................',
      '..44.......FF.......44..',
      '..432.....FffF.....234..',
      '...432....fYYf....234...',
      '....432...RRRR...234....',
      '.....432.RrrrrR.234.....',
      '......432rrqqrr234......',
      '.......433qqqq334.......',
      '........43322334........',
      '.........332233.........',
      '........33222233........',
      '.......332qqqq233.......',
      '......332qqqqqq233......',
      '.....3321.qQQq.1233.....',
      '....Yy21..qQQq..12yY....',
      '...YYgG....QQ....GgYY...',
      '....bk............kb....',
      '...bk..............kb...',
      '..RR................QQ..',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.steel,
    PB_MATS,
  ),

  // Rage: Cracked crimson battle-helm/skull with blazing amber eyes & jagged fury aura
  bloodlust_frenzy: cluster24(
    [
      '........................',
      '....R..............R....',
      '....rR....R..R....Rr....',
      '.....rq..r3333r..qr.....',
      '......q.33322333.q......',
      '...R...3322222233...R...',
      '....r.332222222233.r....',
      '......322222222223......',
      '.....32211222211223.....',
      '.....321FF1221FF123.....',
      '.....321fY1221Yf123.....',
      '.....22211200211222.....',
      '......222220022222......',
      '......122222222221......',
      '.......1120202021.......',
      '........12020202........',
      '........11111111........',
      '......R..111111..R......',
      '.....r....1111....r.....',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.crimson,
    PB_MATS,
  ),

  // Curse: Dark violet hex sigil & cracked cursed skull with eerie purple miasma wisps
  curse: cluster24(
    [
      '........................',
      '.....P............P.....',
      '......pP...PP...Pp......',
      '.......zpP3333Ppz.......',
      '.......3333333333.......',
      '......332222222233......',
      '.....322222d2222223.....',
      '.....322dd222dd2223.....',
      '.....32dRRd2dRRd223.....',
      '.....22dqqd2dqqd222.....',
      '......22222dd22222......',
      '.......2222222222.......',
      '.....P..12020201..P.....',
      '....pP..11010101..Pp....',
      '...pz....111111....zp...',
      '....zZ............Zz....',
      '.....zP...pppp...Pz.....',
      '......zPPppzzppPPz......',
      '.........zzzzzz.........',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.arcane,
    PB_MATS,
  ),

  // Plague: Greenish-yellow bubbling alchemical pestilence cloud with skull silhouette inside
  plague_miasma: cluster24(
    [
      '........................',
      '.......44.......4.......',
      '......4334.....43.......',
      '........4444444.........',
      '......4433333332........',
      '....44333333333322......',
      '...4333222222222221.....',
      '..433222100000122211....',
      '..3322210dd0dd012221....',
      '..3222210d404d012221....',
      '..322221000d00012211....',
      '..222222100000122210....',
      '...2222221010122210.....',
      '...1222222111222110.....',
      '....11122222222110......',
      '......11111111100.......',
      '....43...........43.....',
      '...432....43....432.....',
      '....21...432.....21.....',
      '..........21............',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.toxic,
    PB_MATS,
  ),

  // Zombie Virus: Glass bio-flask filled with bubbling toxic green mutagen & biohazard cap
  zombie_virus: cluster24(
    [
      '........................',
      '..........43....4.......',
      '.........432...43.......',
      '.........BBbbBB.........',
      '.........bkkkkK.........',
      '........XssmmssM........',
      '.........XsmmsM.........',
      '.........XsmmsM.........',
      '........XXsmmsMM........',
      '.......XXssmmssMM.......',
      '......XXs443332sMM......',
      '.....XXs44334322sMM.....',
      '.....Xs4333222221sM.....',
      '....XXs3322243221sMM....',
      '....Xs332222322111sM....',
      '....Xs222222222111sM....',
      '....Xs222432221111sM....',
      '.....Xs1122111111sM.....',
      '......Xss111111ssM......',
      '.......XXssssssMM.......',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.toxic,
    PB_MATS,
  ),

  // Locust Swarm: Winged amber/brown locust insect in diagonal profile with buzzing swarm dots behind
  locust_swarm: cluster24(
    [
      '........................',
      '...................k....',
      '.........IIii.....K.....',
      '........IIiiiiI.........',
      '.......IIiiiiijI..k.....',
      '....k...IiiiijjjI.......',
      '.........IijjjjJ...k....',
      '......44..jjjjJ.........',
      '.....4333223322.........',
      '....43o322332221........',
      '....3322233222111.......',
      '...2..222222211110......',
      '..2....22111111100......',
      '.......1.11.11100.......',
      '......1..1...110........',
      '.....1..1.....1.1.......',
      '....1............1......',
      '..............k.........',
      '..........k.......k.....',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.amber,
    PB_MATS,
  ),

  // Skeleton Portal: Stone archway with swirling arcane violet vortex & pale skull emerging
  undead_portal: cluster24(
    [
      '........................',
      '........NNNNNN..........',
      '......NNnnnnnnNH........',
      '.....NnhhPPPPnhhH.......',
      '....NnhPPppppPPhhH......',
      '...NnhPpzzzzzzpPhhH.....',
      '...NhPpzzIIIIzzpPhH.....',
      '...NhPzzIIiiIIzzPhH.....',
      '...NhPzIIi@@iIIzPhH.....',
      '...NhPzIIi@@iIIzPhH.....',
      '...NhPzIIii@iIIzPhH.....',
      '...NhPzzIiiiiIzzPhH.....',
      '...NhPpzzI0I0zzpPhH.....',
      '...NhPPpzzzzzzpPPhH.....',
      '...NhhPPppzzppPPhhH.....',
      '...NhhhPPPppPPPhhhH.....',
      '...nhhhhPPPPPPnhhhH.....',
      '...hhhhhHZZZZHhhhhH.....',
      '..HHHHHHHHHHHHHHHHHH....',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.stone,
    PB_MATS,
  ),

  // Solar Beam: Focused golden-white orbital beam firing straight down onto scorching impact ring
  solar_orbital_laser: cluster24(
    [
      '........................',
      '.........FYYYYF.........',
      '.........fYXXYf.........',
      '.........fYXXYf.........',
      '.........fYXXYf.........',
      '.........fYXXYf.........',
      '.........fYXXYf.........',
      '.........fYXXYf.........',
      '.........fYXXYf.........',
      '.........fYXXYf.........',
      '.........fYXXYf.........',
      '........FfYXXYfF........',
      '........ffYXXYff........',
      '.......FffYXXYffF.......',
      '.....RRFFfYYYYfFFRR.....',
      '....RrrFFffYYffFFrrR....',
      '...rqqqFFFFffFFFFqqqr...',
      '...NnhqqqFFFFFFqqqhnN...',
      '..NnhhhHqqqqqqqqHhhhNN..',
      '...HHHHHHHHHHHHHHHHHH...',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.gold,
    PB_MATS,
  ),

  // Eye of Judgment: Hovering ornate golden/obsidian All-Seeing Eye firing a focused crimson/gold beam downward
  fortify_walls: cluster24(
    [
      '........................',
      '.........YYYYYY.........',
      '......YYYyyyyyyYYY......',
      '....YYyDDIIIIIIIDDyY....',
      '...YyDDIIiiRRiiIIDDyY...',
      '..YyDDIIiRrrrrRiIIDDyY..',
      '..YyDDIIiRr@@rRiIIDDyY..',
      '..YyDDIIiRrrrrRiIIDDyY..',
      '...YyDDIIiiRRiiIIDDyY...',
      '....YYyDDIIIIIIIDDyY....',
      '......YYYyyRRyyYYY......',
      '.........YrYYrY.........',
      '.........RrYYrR.........',
      '.........RrYYrR.........',
      '.........RrYYrR.........',
      '.........RrYYrR.........',
      '........qRrYYrRq........',
      '.......qqRrYYrRqq.......',
      '......qqqRYYYYRqqq......',
      '.....RrrrYYYYYYrrrR.....',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.gold,
    PB_MATS,
  ),

  // Time Bubble: Brass hourglass encased in a translucent cyan-blue time dome
  chrono_surge: cluster24(
    [
      '........................',
      '........XXXXXXXX........',
      '......XXxxccccxxXX......',
      '.....Xxcc......ccxX.....',
      '....Xxc..YYYYYY..cxX....',
      '...Xxc...gYYYYg...cxX...',
      '...Xc....gIyyIg....cX...',
      '...Xc....gIyyIg....cX...',
      '...Xc.....gIIg.....cX...',
      '...Xc......gy......cX...',
      '...Xc......gy......cX...',
      '...Xc.....gIyg.....cX...',
      '...Xc....gIyyIg....cX...',
      '...Xc....gYYYYg....cX...',
      '...Xxc...gYYYYg...cxX...',
      '....Xxc..GGGGGG..cxX....',
      '.....Xxc........cxX.....',
      '......XXxxccccxxXX......',
      '........XXXXXXXX........',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.ice,
    PB_MATS,
  ),

  // Anti-Gravity: Cracked boulders & earth chunks floating upward with violet/blue upward chevron trails
  gravity_flip: cluster24(
    [
      '........................',
      '.........EEee...........',
      '........EeNNneE.........',
      '.......Nnhhhhnn.........',
      '.......nhhhhhHH.........',
      '....Nn..HHHHHH...Nn.....',
      '...Nnhh.........Nnhh....',
      '...hhHH....PP....hHH....',
      '..........PppP..........',
      '.........Pp..pP.........',
      '.....PP..p....p..PP.....',
      '....PppP...cc...PppP....',
      '...Pp..p..CccC..p..pP...',
      '.........Cc..cC.........',
      '..........PP............',
      '.........PppP...........',
      '....cc..Pp..pP..cc......',
      '...CccC........CccC.....',
      '..Cc..cC......Cc..cC....',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.arcane,
    PB_MATS,
  ),

  // Mutagen Beam: Diagonal emerald-cyan beam mutating a silhouette/crystal with glowing DNA/sparkle aura
  terraform_beam: cluster24(
    [
      '........................',
      '.................TT.....',
      '................TttT....',
      '...............TttXT....',
      '..............TttXtt....',
      '.............TttXtt.....',
      '............TttXtt......',
      '...........TttXtt...P...',
      '..........TttXtt...PpP..',
      '.........TttXtt.....P...',
      '........TttXtt..........',
      '....P..TttXtt...........',
      '...PpPTttXtt..T.........',
      '....P.TttXtt.Ttt........',
      '.....TTttXXttTTt........',
      '.....TttXXXXttTT........',
      '....TttXXPPXXttT........',
      '....TtXXPppPXXtT........',
      '.....TXXppppXXT.........',
      '......TTzzzzTT..........',
      '.......WWZZWW...........',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.toxic,
    PB_MATS,
  ),

  // Black Hole: Pitch-black singularity core ringed by warped amber/violet accretion disk & bent light
  wormhole_ascension: cluster24(
    [
      '........................',
      '........................',
      '........PPppppP.........',
      '......PPppzzzzppP.......',
      '.....PpzzFFffFFzzP......',
      '....PpzFFf@@@@fFFzP.....',
      '...PpzFf@@@@@@@@fFzP....',
      '...PzFf@@@@@@@@@@fZP....',
      '..FFff@@@@@@@@@@@@ffFF..',
      '.FffYY@@@@@@@@@@@@YYffF.',
      '.fYYYY@@@@@@@@@@@@YYYYf.',
      '.FffYY@@@@@@@@@@@@YYffF.',
      '..FFff@@@@@@@@@@@@ffFF..',
      '...PzFf@@@@@@@@@@fZP....',
      '...PpzFf@@@@@@@@fFzP....',
      '....PpzFFf@@@@fFFzP.....',
      '.....PpzzFFffFFzzP......',
      '......PPppzzzzppP.......',
      '........PPppppP.........',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.arcane,
    PB_MATS,
  ),

  // Dark Ooze: Bubbling dark obsidian/violet viscous sludge puddle with rising eerie eye-wisps
  void_goo: cluster24(
    [
      '........................',
      '...........P............',
      '..........PpP...........',
      '......P....p.....P......',
      '.....PpP........PpP.....',
      '......z....p.....z......',
      '..........pzp...........',
      '.........pzPzp..........',
      '........zdddddZ.........',
      '.......zddPddPdz........',
      '......zdddPddPddz.......',
      '.....zdddddddddddZ......',
      '....zdddppddddddddZ.....',
      '...zddddppddddddppdZ....',
      '..zddddddddddddppppdZ...',
      '..ddddddddddddddddddD...',
      '.zddddpddddddddddddpdZ..',
      '.dddddppddddddddddppdD..',
      '..ddddddddddddddddddd...',
      '...DDDDDDDDDDDDDDDDD....',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.arcane,
    PB_MATS,
  ),

  // Alien Invasion: Metallic saucer UFO hovering with glowing green/cyan abduction tractor beam below
  alien_invasion: cluster24(
    [
      '........................',
      '........................',
      '.........XXXX...........',
      '.......XXxxxxXX.........',
      '......XxxccccxxX........',
      '....44433333333444......',
      '...4333333333333332.....',
      '..43222TT22TT22TT221....',
      '..32222tt22tt22tt221....',
      '...2111111111111110.....',
      '.....111111111110.......',
      '........TTXXTT..........',
      '.......TTtXXtTT.........',
      '.......TtXXXXtT.........',
      '......TTtXXXXtTT........',
      '......TttXXXXttT........',
      '.....TTttXXXXttTT.......',
      '.....TtttXXXXtttT.......',
      '....TTtttXXXXtttTT......',
      '....TttttXXXXttttT......',
      '.....tttttttttttt.......',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.steel,
    PB_MATS,
  ),

  // God Titan: Armored bronze/steel quadrupedal mech titan head & cannon shoulders with glowing golden visor
  divine_titan: cluster24(
    [
      '........................',
      '...444............444...',
      '...432...VVVVVV...234...',
      '...432..VvvvvvvV..234...',
      '...321.Vvv4444vvV.123...',
      '..3321.Vv433334vV.1233..',
      '..3211.Vv3YYYY3vV.1123..',
      '..3211.Vv3YXXY3vV.1123..',
      '..2110.Vvv3333vvV.0112..',
      '...110..VvvvvvvV..011...',
      '....VVVVVVvvvvVVVVVV....',
      '...Vvvvvvv3333vvvvvvV...',
      '...Vvv222233332222vvV...',
      '...Vv22111222211122vV...',
      '...Vv21..112211..12vV...',
      '..3321...11..11...1233..',
      '..321....11..11....123..',
      '..211...211..112...112..',
      '..110...110..011...011..',
      '..110...110..011...011..',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.steel,
    PB_MATS,
  ),

  // Internal Event: Super Tornado — massive violent cyclone wrapped in crackling golden lightning
  super_tornado: cluster24(
    [
      '........................',
      '...44444444444444444....',
      '..4333333333333333321...',
      '..2222222222222222210...',
      '....111111111111110.....',
      '...Y44333333333322Y.....',
      '....Y222222222211Y......',
      '.....YY11111111YY.......',
      '......4333333322........',
      '.....Y2222222110........',
      '......Y11111100.........',
      '.......4333322Y.........',
      '........22221Y..........',
      '........Y1110...........',
      '.......Y43322...........',
      '........2210Y...........',
      '........321Y............',
      '....n...321...n.........',
      '...nh..4321..nh.........',
      '..hh..nh211hn..HH.......',
      '.....nhhHHHhhn..........',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.iron,
    PB_MATS,
  ),

  // Internal Event: Lava Deluge — dark volcanic ash cloud raining blazing molten magma blobs
  lava_deluge: cluster24(
    [
      '........................',
      '.......33333............',
      '.....332222221..........',
      '....322222222211........',
      '...22211111111110.......',
      '..2111111111111100......',
      '...11000000000000.......',
      '........................',
      '.....Ff....Ff....Ff.....',
      '....FfY...FfY...FfY.....',
      '....aR....aR....aR......',
      '........................',
      '.......Ff....Ff.........',
      '......FfY...FfY.........',
      '......aR....aR..........',
      '........................',
      '...FFffFFffFFffFFffFF...',
      '..FffYYYYffYYYYffYYYYF..',
      '..ffaaRRaaffaaRRaaffaa..',
      '...RRRRRRRRRRRRRRRRRR...',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.iron,
    PB_MATS,
  ),

  // Internal Event: Blight Plague — withered gnarled dead tree engulfed in toxic violet-green miasma
  blight_plague: cluster24(
    [
      '........................',
      '......T..........P......',
      '.....TtT...b....PpP.....',
      '......t...bk...b.p......',
      '.....b....bk..bk........',
      '......b...bk.bk...T.....',
      '.......b..bkbk...TtT....',
      '....P...b.bkk.....t.....',
      '...PpP...bbkk...........',
      '....p....bkkK...P.......',
      '.........bkkK..PpP......',
      '....T....bkkK...p.......',
      '...TtT...bkkK...........',
      '....t...bbkkKK..........',
      '.......bbbkkKKK.........',
      '....PPppbbkkKKppPP......',
      '...PppzzbkkkkKzzppP.....',
      '..TTttzzzzZZZZzzttTT....',
      '..twwwWWWWWWWWWWwwwt....',
      '...WWWWWWWWWWWWWWWW.....',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.darkWood,
    PB_MATS,
  ),

  // Internal Event: Floral Paradise — blooming rose-pink & golden flower cluster sprouting from lush moss
  floral_paradise: cluster24(
    [
      '........................',
      '..........%%............',
      '.........%YY%...........',
      '........%%YY%%....Y.....',
      '....%....%&&%...........',
      '...%Y%....&&.....%%.....',
      '..%%Y%%...el....%YY%....',
      '...%&&%...el...%%YY%%...',
      '....&&...EelE...%&&%....',
      '....el...eElE....&&.....',
      '....el..EeelE....el.....',
      '...EelE..eelE...EelE....',
      '...eelE..eell...eelE....',
      '....ellE.elll..Eell.....',
      '...EElllEllllEElllEE....',
      '..EEeeellllllllleeeEE...',
      '..EeeeellllllllleeeeE...',
      '...eeellllllllllleee....',
      '....LLLLLLLLLLLLLLL.....',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.moss,
    PB_MATS,
  ),
};

export const BUILDING_SPRITES: Record<BuildingType, CompiledSprite> = {
  // Bonfire: Isometric stone hearth ring with crossed timber logs & blazing campfire flame
  bonfire: icon24((c) => {
    drawBasePad(c, PMAT.moss, PMAT.wood, PMAT.darkWood, 21, 3);
    // Stone hearth ring
    c.ellipse(11.5, 14.5, 6.5, 3.2, PMAT.stone, 2);
    c.ellipse(11.5, 14.0, 5.5, 2.4, PMAT.stone, 3);
    c.ellipse(11.5, 14.2, 4.2, 1.8, PMAT.iron, 0);
    // Crossed logs
    c.line(8, 15, 15, 13, PMAT.wood, 3);
    c.line(8, 13, 15, 15, PMAT.darkWood, 2);
    c.line(9, 15, 14, 15, PMAT.wood, 2);
    // Layered campfire flame
    c.stamp(
      7,
      4,
      [
        '....f....',
        '...fFf...',
        '..fFFfF..',
        '..FFYYF..',
        '.fFYYYFf.',
        '.fFYYYYf.',
        '.aFFYYFa.',
        '..aFFFa..',
        '...aaa...',
      ],
      PMAT.amber,
      PB_MATS,
    );
    // Floating embers
    c.set(8, 4, PMAT.gold, 4);
    c.set(15, 5, PMAT.amber, 3);
  }),

  // Forager Hut: Isometric timber-frame hut with sloped thatched roof & warm doorway
  forager_hut: icon24((c) => {
    drawBasePad(c, PMAT.moss, PMAT.wood, PMAT.darkWood, 21, 3);
    // Hut timber walls
    drawIsoBox(c, 11, 17, 5, 5, PMAT.wood, PMAT.wood, PMAT.darkWood);
    // Doorway on left face
    c.rect(8, 13, 2, 3, PMAT.iron, 0);
    c.set(8, 13, PMAT.amber, 2);
    // Sloped thatched roof
    for (let dy = 0; dy <= 5; dy++) {
      const span = dy + 1;
      for (let dx = -span; dx <= span; dx++) {
        const tone = dx < 0 ? (dy % 2 === 0 ? 4 : 3) : (dy % 2 === 0 ? 2 : 1);
        c.set(11 + dx, 5 + dy, PMAT.sand, tone);
      }
    }
    // Roof ridge beam
    c.rect(10, 4, 3, 1, PMAT.wood, 3);
  }),

  // Totem: Carved stone/wood tribal totem pillar with painted mask, feathers & arcane eye
  shaman_totem: icon24((c) => {
    drawBasePad(c, PMAT.moss, PMAT.stone, PMAT.iron, 21, 3);
    // Stone pedestal
    drawIsoBox(c, 11, 17, 4, 2, PMAT.stone, PMAT.stone, PMAT.iron);
    // Tall carved wooden totem column
    c.rect(9, 4, 5, 11, PMAT.wood, 2);
    c.rect(9, 4, 2, 11, PMAT.wood, 3);
    c.rect(13, 4, 1, 11, PMAT.darkWood, 1);
    // Side tribal wing plumes
    c.line(5, 7, 8, 9, PMAT.crimson, 3);
    c.line(5, 9, 8, 10, PMAT.parchment, 3);
    c.line(17, 7, 14, 9, PMAT.crimson, 2);
    c.line(17, 9, 14, 10, PMAT.parchment, 2);
    // Glowing arcane mask eyes & crest
    c.rect(10, 6, 1, 2, PMAT.arcane, 4);
    c.rect(12, 6, 1, 2, PMAT.arcane, 4);
    c.rect(10, 9, 3, 1, PMAT.gold, 3);
    c.rect(10, 11, 3, 1, PMAT.crimson, 3);
    c.rect(10, 3, 3, 1, PMAT.gold, 4);
  }),

  // Granary: Stone-foundation cylindrical grain silo with conical bronze roof & wheat crest
  granary: icon24((c) => {
    drawBasePad(c, PMAT.moss, PMAT.wood, PMAT.darkWood, 21, 3);
    // Cylindrical stone & plaster silo body
    c.rect(6, 9, 11, 8, PMAT.parchment, 2);
    c.rect(6, 9, 4, 8, PMAT.parchment, 3);
    c.rect(14, 9, 3, 8, PMAT.parchment, 1);
    // Stone base band
    c.rect(6, 15, 11, 2, PMAT.stone, 2);
    c.rect(14, 15, 3, 2, PMAT.stone, 1);
    // Conical terracotta/bronze roof
    for (let dy = 0; dy <= 5; dy++) {
      const span = dy + 1;
      for (let dx = -span; dx <= span; dx++) {
        const tone = dx <= 0 ? 3 : 2;
        c.set(11 + dx, 3 + dy, PMAT.bronze, tone);
      }
    }
    c.set(11, 2, PMAT.gold, 4);
    // Grain door & wheat trim
    c.rect(9, 12, 3, 4, PMAT.wood, 2);
    c.rect(10, 13, 1, 2, PMAT.gold, 4);
  }),

  // Smeltery: Dark stone furnace/kiln with glowing molten amber mouth, chimney & smoke
  smeltery: icon24((c) => {
    drawBasePad(c, PMAT.stone, PMAT.stone, PMAT.iron, 21, 3);
    // Main stone furnace block
    drawIsoBox(c, 11, 17, 6, 6, PMAT.stone, PMAT.stone, PMAT.iron);
    // Chimney stack on back-right
    c.rect(12, 4, 4, 6, PMAT.iron, 2);
    c.rect(12, 4, 2, 6, PMAT.stone, 2);
    // Smoke puffs
    c.rect(13, 2, 3, 2, PMAT.steel, 3);
    c.set(16, 2, PMAT.steel, 4);
    // Glowing molten furnace mouth on left face
    c.rect(7, 12, 3, 3, PMAT.amber, 3);
    c.set(8, 13, PMAT.gold, 4);
    c.set(8, 14, PMAT.crimson, 3);
  }),

  // Ziggurat: 3-tiered stepped sandstone temple with central staircase & golden altar
  ziggurat: icon24((c) => {
    drawBasePad(c, PMAT.sand, PMAT.bronze, PMAT.darkWood, 21, 2);
    // Tier 1 (wide base)
    drawIsoBox(c, 11, 18, 7, 3, PMAT.sand, PMAT.sand, PMAT.bronze);
    // Tier 2 (mid)
    drawIsoBox(c, 11, 14, 5, 3, PMAT.sand, PMAT.sand, PMAT.bronze);
    // Tier 3 (sanctuary)
    drawIsoBox(c, 11, 10, 3, 3, PMAT.gold, PMAT.sand, PMAT.bronze);
    // Golden shrine capstone
    c.rect(10, 4, 3, 2, PMAT.gold, 4);
    // Central grand staircase
    c.line(11, 10, 11, 18, PMAT.gold, 3);
    c.line(12, 10, 12, 18, PMAT.bronze, 2);
  }),

  // Guildhall: Medieval half-timbered hall with steep crimson slate roof & lit windows
  guildhall: icon24((c) => {
    drawBasePad(c, PMAT.moss, PMAT.stone, PMAT.iron, 21, 2);
    // Lower stone + upper parchment timber body
    drawIsoBox(c, 11, 18, 6, 7, PMAT.parchment, PMAT.parchment, PMAT.stone);
    // Timber beams
    c.rect(6, 13, 6, 1, PMAT.wood, 2);
    c.rect(8, 11, 1, 6, PMAT.wood, 2);
    c.rect(14, 11, 1, 6, PMAT.darkWood, 1);
    // Steep crimson roof
    for (let dy = 0; dy <= 5; dy++) {
      const span = dy + 2;
      for (let dx = -span; dx <= span; dx++) {
        c.set(11 + dx, 4 + dy, PMAT.crimson, dx <= 0 ? 3 : 2);
      }
    }
    c.rect(10, 3, 3, 1, PMAT.gold, 3);
    // Warm lit windows & door
    c.rect(6, 14, 2, 2, PMAT.gold, 4);
    c.rect(10, 15, 2, 3, PMAT.wood, 2);
    c.rect(15, 13, 2, 2, PMAT.gold, 3);
  }),

  // Observatory: Stone astronomical tower topped with riveted bronze dome & brass telescope
  observatory: icon24((c) => {
    drawBasePad(c, PMAT.moss, PMAT.stone, PMAT.iron, 21, 2);
    // Stone tower cylinder
    drawIsoBox(c, 11, 18, 5, 7, PMAT.stone, PMAT.stone, PMAT.iron);
    // Riveted bronze dome
    c.ellipse(11, 8, 5, 4, PMAT.bronze, 2);
    c.ellipse(10, 7, 3.5, 2.5, PMAT.bronze, 3);
    // Slit opening
    c.line(11, 4, 14, 8, PMAT.iron, 0);
    // Projecting brass telescope barrel
    c.line(12, 7, 19, 3, PMAT.gold, 3);
    c.line(12, 8, 19, 4, PMAT.gold, 2);
    c.set(19, 3, PMAT.ice, 4);
    // Tower window
    c.rect(8, 13, 2, 3, PMAT.water, 3);
  }),

  // Foundry: Red-brick & iron industrial factory with twin smokestacks & glowing forge
  steam_foundry: icon24((c) => {
    drawBasePad(c, PMAT.stone, PMAT.iron, PMAT.iron, 21, 2);
    // Red-brick factory hull
    drawIsoBox(c, 11, 18, 7, 6, PMAT.iron, PMAT.crimson, PMAT.crimson);
    // Twin tall smokestacks
    c.rect(7, 4, 2, 7, PMAT.iron, 2);
    c.rect(13, 3, 2, 8, PMAT.iron, 2);
    // Steam/smoke puffs
    c.rect(8, 2, 3, 2, PMAT.bone, 3);
    c.rect(14, 1, 3, 2, PMAT.bone, 4);
    // Glowing forge arches
    c.rect(6, 13, 2, 3, PMAT.amber, 4);
    c.rect(9, 14, 2, 3, PMAT.amber, 3);
    c.rect(14, 14, 3, 2, PMAT.gold, 3);
  }),

  // Power Plant: Industrial steel powerhouse with copper turbine coils & cyan electric arcs
  dynamo_plant: icon24((c) => {
    drawBasePad(c, PMAT.stone, PMAT.steel, PMAT.iron, 21, 2);
    drawIsoBox(c, 11, 18, 6, 6, PMAT.steel, PMAT.steel, PMAT.iron);
    // Copper dynamo coils on roof
    c.rect(7, 6, 3, 5, PMAT.bronze, 3);
    c.rect(13, 6, 3, 5, PMAT.bronze, 2);
    c.rect(7, 7, 3, 1, PMAT.gold, 4);
    c.rect(13, 7, 3, 1, PMAT.gold, 3);
    // Crackling cyan electric arc between coils
    c.line(9, 5, 11, 3, PMAT.ice, 4);
    c.line(11, 3, 12, 6, PMAT.ice, 4);
    c.line(12, 6, 14, 4, PMAT.ice, 4);
    // Glowing power gauge window
    c.rect(8, 13, 3, 2, PMAT.water, 4);
  }),

  // Metro Rail: Arched iron-and-glass train depot with brick facade & steel rails emerging
  rail_station: icon24((c) => {
    drawBasePad(c, PMAT.stone, PMAT.iron, PMAT.iron, 21, 2);
    // Brick & steel station hall
    drawIsoBox(c, 11, 17, 7, 5, PMAT.steel, PMAT.crimson, PMAT.iron);
    // Arched glass-and-iron roof vault
    c.ellipse(11, 9, 6, 3, PMAT.steel, 3);
    c.ellipse(11, 9, 4.5, 2, PMAT.water, 3);
    // Clock gable
    c.rect(10, 6, 3, 3, PMAT.gold, 3);
    c.set(11, 7, PMAT.iron, 0);
    // Tunnel arch & emerging steel rails
    c.rect(7, 13, 3, 4, PMAT.iron, 0);
    c.line(7, 17, 4, 20, PMAT.steel, 4);
    c.line(9, 17, 6, 20, PMAT.steel, 4);
  }),

  // Reactor: Concrete nuclear facility with twin hyperbolic cooling towers & glowing containment dome
  fission_reactor: icon24((c) => {
    drawBasePad(c, PMAT.stone, PMAT.iron, PMAT.iron, 21, 2);
    // Left cooling tower (hyperbolic profile)
    for (let y = 5; y <= 16; y++) {
      const w = y < 9 ? 2 : y > 13 ? 3 : 2;
      c.rect(5 - Math.floor(w / 2), y, w + 2, 1, PMAT.bone, y < 7 ? 4 : 3);
      c.set(5 + Math.ceil(w / 2), y, PMAT.steel, 2);
    }
    // Right cooling tower
    for (let y = 4; y <= 15; y++) {
      const w = y < 8 ? 2 : y > 12 ? 3 : 2;
      c.rect(14 - Math.floor(w / 2), y, w + 2, 1, PMAT.bone, y < 6 ? 4 : 2);
      c.set(14 + Math.ceil(w / 2), y, PMAT.steel, 1);
    }
    // Glowing cyan/toxic containment dome in front
    c.ellipse(11, 14, 4, 3.2, PMAT.steel, 3);
    c.ellipse(11, 13.5, 2.8, 2, PMAT.toxic, 4);
    // Steam wisps above towers
    c.rect(5, 3, 3, 1, PMAT.ice, 4);
    c.rect(14, 2, 3, 1, PMAT.ice, 4);
  }),

  // Cyber Lab: Sleek steel-and-glass research tower with glowing cyan holo-rings & dish
  cyber_institute: icon24((c) => {
    drawBasePad(c, PMAT.iron, PMAT.steel, PMAT.iron, 21, 2);
    // Sleek central glass-steel tower
    drawIsoBox(c, 11, 18, 5, 9, PMAT.steel, PMAT.water, PMAT.steel);
    // Glowing cyan data bands
    c.rect(7, 10, 4, 1, PMAT.ice, 4);
    c.rect(7, 13, 4, 1, PMAT.ice, 4);
    c.rect(12, 11, 4, 1, PMAT.water, 4);
    c.rect(12, 14, 4, 1, PMAT.water, 4);
    // Holographic antenna spire & floating data ring
    c.line(11, 2, 11, 7, PMAT.steel, 4);
    c.set(11, 2, PMAT.ice, 4);
    c.ellipse(11, 5, 4, 1.2, PMAT.ice, 4);
    c.set(11, 5, PMAT.steel, 3);
  }),

  // Airport: Control tower with glass radar deck beside angled tarmac runway & silver jet
  airport: icon24((c) => {
    drawBasePad(c, PMAT.iron, PMAT.stone, PMAT.iron, 21, 2);
    // Runway centerline dashes
    c.line(5, 16, 17, 12, PMAT.parchment, 4);
    // Miniature silver jetliner on tarmac
    c.line(11, 14, 17, 11, PMAT.bone, 4);
    c.line(12, 11, 16, 15, PMAT.steel, 3);
    // Tall control tower on left
    c.rect(5, 7, 3, 10, PMAT.bone, 3);
    c.rect(7, 7, 1, 10, PMAT.steel, 2);
    // Glass observation cab
    c.rect(4, 4, 5, 3, PMAT.water, 4);
    c.rect(4, 3, 5, 1, PMAT.steel, 3);
    c.set(6, 2, PMAT.crimson, 4);
  }),

  // Launchpad: Armored orbital gantry with sleek white-and-crimson rocket & ignition glow
  launch_arcology: icon24((c) => {
    drawBasePad(c, PMAT.iron, PMAT.steel, PMAT.iron, 21, 2);
    // Steel launch gantry tower on right
    c.rect(14, 5, 3, 12, PMAT.steel, 2);
    c.line(12, 7, 15, 7, PMAT.steel, 3);
    c.line(12, 11, 15, 11, PMAT.steel, 3);
    // Sleek orbital rocket
    c.rect(8, 5, 3, 10, PMAT.bone, 4);
    c.rect(10, 5, 1, 10, PMAT.steel, 2);
    // Nosecone & crimson fins
    c.set(9, 3, PMAT.crimson, 4);
    c.rect(8, 4, 3, 1, PMAT.crimson, 3);
    c.rect(6, 13, 2, 3, PMAT.crimson, 3);
    c.rect(11, 13, 2, 3, PMAT.crimson, 2);
    // Ignition thruster glow
    c.rect(8, 15, 3, 2, PMAT.amber, 4);
    c.set(9, 17, PMAT.gold, 4);
  }),

  // Dyson Spire: Towering obsidian-and-gold interstellar spire crowned by levitating star-core
  dyson_spire: icon24((c) => {
    drawBasePad(c, PMAT.iron, PMAT.gold, PMAT.iron, 21, 2);
    // Tapered obsidian & gold spire legs
    c.line(6, 18, 10, 9, PMAT.iron, 2);
    c.line(16, 18, 12, 9, PMAT.iron, 1);
    c.rect(9, 10, 5, 8, PMAT.iron, 2);
    c.rect(11, 10, 1, 8, PMAT.gold, 4);
    // Orbital containment rings
    c.ellipse(11, 6, 6, 2.2, PMAT.gold, 3);
    c.ellipse(11, 6, 4, 1.3, PMAT.ice, 4);
    // Levitating golden star-core
    c.ellipse(11, 6, 2, 2, PMAT.amber, 3);
    c.set(11, 6, PMAT.gold, 4);
    c.set(11, 2, PMAT.ice, 4);
  }),

  // Windmill: Tapered stone-and-plaster mill tower with 4 diagonal lattice sails
  windmill: icon24((c) => {
    drawBasePad(c, PMAT.moss, PMAT.wood, PMAT.darkWood, 21, 2);
    // Tapered mill tower
    for (let y = 7; y <= 17; y++) {
      const half = y < 11 ? 2 : 3;
      c.rect(11 - half, y, half * 2 + 1, 1, PMAT.parchment, 3);
      c.rect(12, y, half, 1, PMAT.stone, 2);
    }
    // Wooden roof cap & door
    c.ellipse(11, 7, 3, 2, PMAT.wood, 2);
    c.rect(10, 14, 2, 3, PMAT.darkWood, 1);
    // 4 diagonal windmill lattice sails
    c.line(4, 3, 18, 17, PMAT.wood, 3);
    c.line(18, 3, 4, 17, PMAT.wood, 3);
    // Cloth sail blades
    c.line(5, 3, 9, 7, PMAT.sand, 4);
    c.line(17, 3, 13, 7, PMAT.sand, 4);
    c.line(5, 16, 9, 12, PMAT.sand, 3);
    c.line(17, 16, 13, 12, PMAT.sand, 3);
    // Central hub
    c.rect(10, 9, 2, 2, PMAT.bronze, 3);
  }),

  // Quarry Crane: Timber & stone quarry derrick crane with angled boom & suspended stone block
  quarry_crane: icon24((c) => {
    drawBasePad(c, PMAT.stone, PMAT.stone, PMAT.iron, 21, 2);
    // Stone counterweight base
    drawIsoBox(c, 8, 18, 4, 3, PMAT.stone, PMAT.stone, PMAT.iron);
    // Tall timber derrick mast
    c.rect(7, 4, 2, 11, PMAT.wood, 3);
    // Angled wooden crane boom
    c.line(8, 6, 18, 4, PMAT.wood, 3);
    c.line(8, 10, 15, 5, PMAT.darkWood, 2);
    // Pulley rope & suspended cut stone block
    c.line(17, 5, 17, 11, PMAT.parchment, 3);
    c.rect(15, 11, 4, 4, PMAT.stone, 3);
    c.rect(15, 11, 4, 1, PMAT.stone, 4);
    c.rect(18, 11, 1, 4, PMAT.stone, 1);
  }),

  // Ore Crusher: Heavy timber-and-iron stamp mill with gear wheel & ore hopper
  ore_crusher: icon24((c) => {
    drawBasePad(c, PMAT.stone, PMAT.darkWood, PMAT.iron, 21, 2);
    // Timber & iron crusher frame
    drawIsoBox(c, 11, 18, 6, 6, PMAT.iron, PMAT.darkWood, PMAT.iron);
    // Overhead iron stamp beam & crushing pistons
    c.rect(6, 5, 11, 2, PMAT.iron, 3);
    c.rect(8, 7, 2, 6, PMAT.steel, 4);
    c.rect(12, 7, 2, 5, PMAT.steel, 3);
    // Side iron gear wheel
    c.ellipse(17, 13, 3, 3, PMAT.bronze, 2);
    c.set(17, 13, PMAT.gold, 4);
    // Raw ore pile at base
    c.rect(7, 14, 4, 3, PMAT.bronze, 3);
    c.set(8, 14, PMAT.gold, 4);
  }),

  // Quarry Excavator: Heavy industrial tracked excavator rig with yellow-ochre cab & steel shovel arm
  quarry_excavator: icon24((c) => {
    drawBasePad(c, PMAT.stone, PMAT.stone, PMAT.iron, 21, 2);
    // Heavy steel treads
    c.rect(4, 14, 10, 3, PMAT.iron, 1);
    c.rect(5, 15, 2, 1, PMAT.steel, 3);
    c.rect(8, 15, 2, 1, PMAT.steel, 3);
    c.rect(11, 15, 2, 1, PMAT.steel, 3);
    // Yellow-ochre industrial cab
    c.rect(5, 9, 8, 5, PMAT.gold, 3);
    c.rect(5, 9, 8, 1, PMAT.gold, 4);
    c.rect(9, 10, 3, 2, PMAT.water, 4);
    // Articulated steel boom & bucket arm
    c.line(12, 10, 16, 5, PMAT.gold, 3);
    c.line(16, 5, 19, 11, PMAT.steel, 3);
    // Heavy toothed scoop bucket
    c.rect(17, 11, 4, 3, PMAT.steel, 2);
    c.rect(17, 11, 4, 1, PMAT.steel, 4);
    c.set(17, 14, PMAT.bone, 4);
    c.set(19, 14, PMAT.bone, 4);
  }),
};
