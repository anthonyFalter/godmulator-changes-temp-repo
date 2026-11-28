import type { UnitRole } from '../../game/types';
import {
  type CompiledSprite,
  Icon24,
  type MatLegend,
  type MatRamp,
  PMAT,
  cluster24,
  icon24,
} from './pixelEngine';

// Grounded 24x24 PMAT legend for crisp multi-material pixel clusters
const BMAT: MatLegend = {
  // Gold
  Y: { ramp: PMAT.gold, tone: 4 },
  y: { ramp: PMAT.gold, tone: 3 },
  g: { ramp: PMAT.gold, tone: 2 },
  G: { ramp: PMAT.gold, tone: 1 },
  // Wood / Leather
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
  v: { ramp: PMAT.toxic, tone: 2 },
  V: { ramp: PMAT.toxic, tone: 1 },
  // Water / Ice
  C: { ramp: PMAT.ice, tone: 4 },
  c: { ramp: PMAT.ice, tone: 3 },
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
  // Bone / White
  W: { ramp: PMAT.bone, tone: 4 },
  w: { ramp: PMAT.bone, tone: 3 },
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
  // Iron / Dark Ink
  D: { ramp: PMAT.iron, tone: 2 },
  d: { ramp: PMAT.iron, tone: 1 },
  x: { ramp: PMAT.iron, tone: 0 },
  // Rose
  N: { ramp: PMAT.rose, tone: 3 },
  n: { ramp: PMAT.rose, tone: 2 },
};

// ---------------------------------------------------------------------------
// Shared 24x24 Half-Body Bust Helpers
// ---------------------------------------------------------------------------

/** Draws a top-left-lit 3D shaded oval with grounded pixel-art tone planes. */
function shadedOval(
  c: Icon24,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ramp: MatRamp,
  hiSpot = true,
): void {
  const x0 = Math.max(1, Math.floor(cx - rx));
  const x1 = Math.min(22, Math.ceil(cx + rx));
  const y0 = Math.max(1, Math.floor(cy - ry));
  const y1 = Math.min(22, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1.0) continue;
      let tone = 2;
      if (nx + ny < -0.45) tone = 3;
      if (nx + ny > 0.55 || ny > 0.7) tone = 1;
      if (hiSpot && nx < -0.25 && ny < -0.35 && d > 0.25 && d < 0.85) tone = 4;
      c.set(x, y, ramp, tone);
    }
  }
}

/** Draws broad half-body bust shoulders & upper chest down to y=21. */
function drawShoulders(
  c: Icon24,
  cx: number,
  topY: number,
  rx: number,
  ramp: MatRamp,
  chestRamp?: MatRamp,
): void {
  for (let y = topY; y <= 21; y++) {
    const t = Math.min(1, (y - topY) / Math.max(1, 21 - topY));
    const span = Math.round(rx * (0.55 + 0.45 * Math.sin((t * 0.75 + 0.25) * (Math.PI / 2))));
    for (let x = cx - span; x <= cx + span; x++) {
      if (x < 2 || x > 21) continue;
      const relX = (x - cx) / Math.max(1, span);
      let tone = 2;
      if (y <= topY + 1 && relX < 0.35) tone = 3;
      else if (relX < -0.45 && y <= topY + 3) tone = 3;
      else if (relX > 0.45 || y === 21) tone = 1;
      c.set(x, y, ramp, tone);
    }
  }
  if (chestRamp) {
    for (let y = topY + 1; y <= 21; y++) {
      const half = Math.max(1, Math.round(rx * 0.36 - (y - topY) * 0.08));
      for (let x = cx - half; x <= cx + half; x++) {
        c.set(x, y, chestRamp, x <= cx ? 3 : 2);
      }
    }
  }
}

/** Crisp expressive eye with optional colored iris & specular glint. */
function drawEye(
  c: Icon24,
  x: number,
  y: number,
  irisRamp?: MatRamp,
  glint = true,
): void {
  if (irisRamp) {
    c.set(x, y, irisRamp, 4);
    c.set(x, y + 1, irisRamp, 3);
  } else {
    c.set(x, y, PMAT.iron, 0);
    c.set(x, y + 1, PMAT.iron, 0);
    if (glint) c.set(x, y, PMAT.bone, 4);
  }
}

/** Draws a curved horn or tusk from (x0,y0) through (xm,ym) to (x1,y1). */
function drawHorn(
  c: Icon24,
  x0: number,
  y0: number,
  xm: number,
  ym: number,
  x1: number,
  y1: number,
  ramp: MatRamp,
): void {
  c.line(x0, y0, xm, ym, ramp, 2);
  c.line(xm, ym, x1, y1, ramp, 3);
  c.set(x1, y1, ramp, 4);
  c.set(x0, y0, ramp, 1);
}

// ---------------------------------------------------------------------------
// 16 Humanoid & Race Half-Body Bust Portrait Builder (24x24)
// ---------------------------------------------------------------------------

interface BustOpts {
  tunic: MatRamp;
  trim?: MatRamp;
  skin?: MatRamp;
  hair?: MatRamp;
  hat?:
    | 'hair'
    | 'hood'
    | 'straw'
    | 'beret'
    | 'hardhat'
    | 'cap'
    | 'helm'
    | 'miter'
    | 'wizard'
    | 'visor'
    | 'horns'
    | 'warhelm'
    | 'crest';
  hatRamp?: MatRamp;
  ears?: boolean;
  tusks?: boolean;
  lizard?: boolean;
  beard?: MatRamp;
  bandana?: boolean;
  shield?: boolean;
  stole?: boolean;
  pauldrons?: MatRamp;
  eyeRamp?: MatRamp;
  tool?:
    | 'staff'
    | 'bow'
    | 'axe'
    | 'basket'
    | 'herb'
    | 'pick'
    | 'hammer'
    | 'sword'
    | 'ankh'
    | 'book'
    | 'wrench'
    | 'dagger'
    | 'spear';
}

function drawBust24(c: Icon24, opts: BustOpts): void {
  const skin = opts.skin ?? PMAT.skin;
  const hair = opts.hair ?? PMAT.wood;
  const hatR = opts.hatRamp ?? hair;
  const trim = opts.trim ?? PMAT.gold;
  const cx = 10;

  // 1. Broad Shoulders & Upper Torso (y=15..21, x=3..17)
  drawShoulders(c, cx, 15, 7, opts.tunic);

  // Tunic collar / chest detail
  c.line(cx - 2, 15, cx, 17, trim, 3);
  c.line(cx + 2, 15, cx, 17, trim, 2);
  c.line(cx, 17, cx, 21, opts.tunic, 1);

  if (opts.stole) {
    for (let y = 15; y <= 21; y++) {
      c.set(cx - 2, y, PMAT.gold, 3);
      c.set(cx - 1, y, PMAT.gold, 2);
      c.set(cx + 1, y, PMAT.gold, 3);
      c.set(cx + 2, y, PMAT.gold, 2);
    }
    c.set(cx, 18, PMAT.gold, 4);
  }

  // Armor pauldrons
  if (opts.pauldrons) {
    const p = opts.pauldrons;
    c.stamp(
      2,
      14,
      [
        '.343.',
        '33221',
        '22110',
        '.110.',
      ],
      p,
    );
    c.stamp(
      14,
      14,
      [
        '.343.',
        '22331',
        '11220',
        '.110.',
      ],
      p,
    );
  }

  // Neck (y=13..15)
  c.rect(cx - 1, 13, 3, 3, skin, 1);
  c.set(cx - 1, 14, skin, 2);
  c.set(cx, 14, skin, 2);

  // 2. Large Expressive Head (10px wide: x=6..14, y=6..14)
  if (opts.lizard) {
    // Reptilian snout & scaled cranium
    shadedOval(c, cx, 10, 4.4, 4.2, skin, false);
    c.rect(cx - 2, 11, 5, 3, skin, 3);
    c.set(cx - 1, 12, skin, 1);
    c.set(cx + 1, 12, skin, 1);
    c.line(cx - 2, 13, cx + 2, 13, skin, 0);
    // Golden slit eyes
    c.set(cx - 2, 9, PMAT.amber, 4);
    c.set(cx - 2, 10, PMAT.iron, 0);
    c.set(cx + 2, 9, PMAT.amber, 4);
    c.set(cx + 2, 10, PMAT.iron, 0);
  } else {
    shadedOval(c, cx, 10, 4.4, 4.3, skin, false);
    // Jaw & cheek highlight
    c.set(cx - 3, 10, skin, 3);
    c.set(cx - 2, 7, skin, 3);
    c.set(cx - 1, 7, skin, 3);
    // Nose bridge & mouth
    c.set(cx, 11, skin, 1);
    c.line(cx - 1, 12, cx + 1, 12, skin, 0);

    // Expressive 2px eyes at y=9..10
    if (opts.eyeRamp) {
      c.set(cx - 2, 9, opts.eyeRamp, 4);
      c.set(cx - 2, 10, opts.eyeRamp, 3);
      c.set(cx + 2, 9, opts.eyeRamp, 4);
      c.set(cx + 2, 10, opts.eyeRamp, 3);
    } else {
      c.set(cx - 2, 9, PMAT.iron, 0);
      c.set(cx - 2, 10, PMAT.iron, 0);
      c.set(cx - 3, 9, PMAT.bone, 4);
      c.set(cx + 2, 9, PMAT.iron, 0);
      c.set(cx + 2, 10, PMAT.iron, 0);
      c.set(cx + 1, 9, PMAT.bone, 4);
    }
    // Brows
    c.line(cx - 3, 8, cx - 2, 8, hair, 1);
    c.line(cx + 1, 8, cx + 2, 8, hair, 1);
  }

  // Pointed elf ears
  if (opts.ears) {
    c.stamp(2, 8, ['432', '.21'], skin);
    c.stamp(15, 8, ['234', '12.'], skin);
  }

  // Orc tusks
  if (opts.tusks) {
    c.set(cx - 2, 12, PMAT.parchment, 4);
    c.set(cx - 2, 13, PMAT.parchment, 3);
    c.set(cx + 2, 12, PMAT.parchment, 4);
    c.set(cx + 2, 13, PMAT.parchment, 3);
  }

  // Raider bandana over lower face
  if (opts.bandana) {
    c.stamp(
      6,
      11,
      [
        '333222211',
        '.2222211.',
        '..11111..',
      ],
      PMAT.crimson,
    );
  }

  // Sculpted beard
  if (opts.beard) {
    c.stamp(
      6,
      12,
      [
        '322222211',
        '232322121',
        '.2222211.',
        '..22121..',
        '...111...',
      ],
      opts.beard,
    );
  }

  // 3. Detailed Role Headgear (y=1..9)
  const hat = opts.hat ?? 'hair';
  if (hat === 'hair') {
    c.stamp(
      5,
      4,
      [
        '..334332...',
        '.33322221..',
        '2222222111.',
        '21......11.',
        '1........1.',
      ],
      hair,
    );
  } else if (hat === 'hood') {
    c.stamp(
      4,
      3,
      [
        '....3332....',
        '..33322211..',
        '.3222221111.',
        '221......110',
        '21........10',
        '21........10',
        '11........10',
        '.11......10.',
      ],
      hatR,
    );
  } else if (hat === 'straw') {
    c.stamp(
      2,
      3,
      [
        '.....34332......',
        '....3322221.....',
        '...rrqqqqqqr....',
        '.3332222222211..',
        '222222222222111.',
      ],
      PMAT.sand,
      BMAT,
    );
  } else if (hat === 'beret') {
    c.stamp(
      4,
      3,
      [
        '..3343322....',
        '.332222211E..',
        '2222222111e..',
        '.111111111...',
      ],
      hatR,
      BMAT,
    );
  } else if (hat === 'hardhat') {
    c.stamp(
      5,
      3,
      [
        '...34332...',
        '..33YY221..',
        '.322YY2111.',
        '22222221111',
      ],
      PMAT.amber,
      BMAT,
    );
  } else if (hat === 'cap') {
    c.stamp(
      5,
      3,
      [
        '..334332...',
        '.32222211..',
        '22cC22cC11.',
        '11111111111',
      ],
      hatR,
      BMAT,
    );
  } else if (hat === 'helm') {
    // Knight great-helm with crimson plume crest
    c.stamp(
      5,
      1,
      [
        '....rRRr...',
        '...rRrqQ...',
        '..334332...',
        '.33222211..',
        '2222222111.',
        '22xxxxxx11.',
        '2211221110.',
        '.21.11.10..',
      ],
      PMAT.steel,
      BMAT,
    );
  } else if (hat === 'miter') {
    c.stamp(
      5,
      1,
      [
        '....343....',
        '...33Y32...',
        '..32YYY21..',
        '..322Y211..',
        '.3222Y2111.',
        '.YYYYYYYYY.',
      ],
      PMAT.parchment,
      BMAT,
    );
  } else if (hat === 'wizard') {
    c.stamp(
      2,
      1,
      [
        '.......343......',
        '......3322......',
        '.....32221......',
        '....322211......',
        '...YYYYYYYY.....',
        '.332222222111...',
        '22222222221111..',
      ],
      hatR,
      BMAT,
    );
  } else if (hat === 'visor') {
    // Sleek astro helmet + glowing cyan panoramic visor + antenna
    c.line(5, 2, 5, 6, PMAT.steel, 3);
    c.set(5, 2, PMAT.amber, 4);
    c.stamp(
      5,
      4,
      [
        '..334332...',
        '.33222211..',
        '3222222111.',
        '22CCCCCC11.',
        '22CcCCcc11.',
        '21cccccc10.',
        '.21111110..',
      ],
      PMAT.steel,
      BMAT,
    );
  } else if (hat === 'horns') {
    // Curved ivory horns + armored war-helm
    drawHorn(c, 5, 6, 3, 4, 3, 2, PMAT.parchment);
    drawHorn(c, 15, 6, 17, 4, 17, 2, PMAT.parchment);
    c.stamp(
      5,
      4,
      [
        '..334332...',
        '.33222211..',
        '2222Y22111.',
        '21..Y...10.',
      ],
      hatR,
      BMAT,
    );
  } else if (hat === 'warhelm') {
    c.set(10, 2, PMAT.steel, 4);
    c.set(10, 3, PMAT.steel, 3);
    c.stamp(
      5,
      4,
      [
        '..334332...',
        '.33222211..',
        '2222222111.',
        '21.1111.10.',
      ],
      hatR,
    );
  } else if (hat === 'crest') {
    // Lizardfolk feathered sun-crest
    c.stamp(
      4,
      2,
      [
        '....R.Y.R....',
        '...RrYFYrR...',
        '..333YFY222..',
        '.322YYYYY211.',
      ],
      PMAT.gold,
      BMAT,
    );
  }

  // 4. Optional Left-Side Shield (x=1..6, y=13..21)
  if (opts.shield) {
    c.stamp(
      1,
      13,
      [
        'SSSSSS',
        'SrrYrS',
        'SrYYrM',
        'SrrYrM',
        'SqqYqM',
        '.SqqM.',
        '..SM..',
      ],
      PMAT.steel,
      BMAT,
    );
  }

  // 5. Iconic Tool / Weapon rising beside right shoulder (x=17..22, y=2..21)
  switch (opts.tool) {
    case 'staff':
      c.line(19, 6, 19, 21, PMAT.wood, 2);
      c.line(18, 6, 18, 21, PMAT.wood, 3);
      c.stamp(17, 2, ['.FF.', 'FYYF', 'FafF', '.kk.'], PMAT.amber, BMAT);
      break;
    case 'bow':
      c.line(18, 3, 21, 7, PMAT.wood, 3);
      c.line(21, 7, 21, 14, PMAT.wood, 2);
      c.line(21, 14, 18, 19, PMAT.wood, 1);
      c.line(18, 4, 18, 18, PMAT.parchment, 3);
      c.line(16, 11, 22, 11, PMAT.wood, 3);
      c.set(22, 11, PMAT.steel, 4);
      break;
    case 'axe':
      c.line(19, 4, 19, 21, PMAT.wood, 2);
      c.line(18, 4, 18, 21, PMAT.wood, 3);
      c.stamp(
        16,
        3,
        [
          '.SSss.',
          'SSsmmM',
          'SSsmM.',
          '.SsM..',
        ],
        PMAT.steel,
        BMAT,
      );
      break;
    case 'hammer':
      c.line(19, 8, 19, 21, PMAT.wood, 2);
      c.line(18, 8, 18, 21, PMAT.wood, 3);
      c.stamp(
        16,
        4,
        [
          'SSSSss',
          'ssmmmM',
          'mmMMM.',
        ],
        PMAT.steel,
        BMAT,
      );
      break;
    case 'pick':
      c.line(19, 6, 19, 21, PMAT.wood, 2);
      c.line(18, 6, 18, 21, PMAT.wood, 3);
      c.stamp(
        15,
        3,
        [
          '..SSss.',
          'SSsbbmM',
          's....mM',
        ],
        PMAT.steel,
        BMAT,
      );
      break;
    case 'sword':
      c.stamp(
        18,
        2,
        [
          '.S.',
          'SSs',
          'SSs',
          'Ssm',
          'Ssm',
          'Ssm',
          'smM',
          'smM',
          'smM',
          'smM',
          'YYg',
          'bKk',
          'bKk',
          '.Y.',
        ],
        PMAT.steel,
        BMAT,
      );
      break;
    case 'ankh':
      c.stamp(
        17,
        2,
        [
          '.YYY.',
          'YY.Yg',
          'Yy.gG',
          '.YgG.',
          'YYYYg',
          '.YgG.',
          '.YgG.',
          '.YgG.',
          '.YgG.',
          '.YgG.',
          '.gG..',
        ],
        PMAT.gold,
        BMAT,
      );
      break;
    case 'book':
      c.stamp(
        15,
        13,
        [
          'IIiIIiI',
          'IiPiIiI',
          'ijPijjJ',
          'jjjjjjJ',
          'bbbbbbK',
          '.kkkkK.',
        ],
        PMAT.parchment,
        BMAT,
      );
      break;
    case 'wrench':
      c.stamp(
        17,
        3,
        [
          'S..S',
          'SSsS',
          'SsmM',
          '.Sm.',
          '.Sm.',
          '.Sm.',
          '.Sm.',
          '.Sm.',
          '.Sm.',
          '.mM.',
        ],
        PMAT.steel,
        BMAT,
      );
      break;
    case 'dagger':
      c.stamp(
        18,
        6,
        [
          '..R',
          '.SR',
          'SSr',
          'Ssm',
          'smM',
          'YYg',
          'bKk',
          'bK.',
        ],
        PMAT.steel,
        BMAT,
      );
      break;
    case 'basket':
      c.stamp(
        15,
        13,
        [
          '..BBb..',
          '.RrEeY.',
          'BBbbbbK',
          'bbkkkkK',
          'bkkkkK.',
          '.KKKK..',
        ],
        PMAT.wood,
        BMAT,
      );
      break;
    case 'herb':
      c.stamp(
        16,
        11,
        [
          '..RRr..',
          '.RIRrQ.',
          'RRIrrQQ',
          '..IIi..',
          '.EeiiE.',
          '..ebk..',
          '..bkK..',
        ],
        PMAT.wood,
        BMAT,
      );
      break;
    case 'spear':
      c.line(19, 7, 19, 21, PMAT.wood, 2);
      c.line(18, 7, 18, 21, PMAT.wood, 3);
      c.stamp(17, 2, ['.Y.', 'YYg', 'Yyg', 'rYq', '.g.'], PMAT.gold, BMAT);
      break;
  }
}

// ---------------------------------------------------------------------------
// ALL 82 UNIT_SPRITES (24x24 Grounded Half-Body Bust Portraits)
// ---------------------------------------------------------------------------

export const UNIT_SPRITES: Record<UnitRole, CompiledSprite> = {
  // =========================================================================
  // 16 HUMANOIDS & RACES
  // =========================================================================
  human: icon24((c) =>
    drawBust24(c, {
      tunic: PMAT.water,
      trim: PMAT.wood,
      hair: PMAT.wood,
      hat: 'hair',
      tool: 'staff',
    }),
  ),
  elf: icon24((c) =>
    drawBust24(c, {
      tunic: PMAT.moss,
      trim: PMAT.gold,
      hair: PMAT.gold,
      hat: 'hood',
      hatRamp: PMAT.moss,
      ears: true,
      tool: 'bow',
    }),
  ),
  orc: icon24((c) =>
    drawBust24(c, {
      tunic: PMAT.crimson,
      trim: PMAT.bone,
      skin: PMAT.orc,
      hair: PMAT.iron,
      hat: 'hair',
      tusks: true,
      eyeRamp: PMAT.amber,
      tool: 'axe',
    }),
  ),
  dwarf: icon24((c) =>
    drawBust24(c, {
      tunic: PMAT.bronze,
      trim: PMAT.gold,
      skin: PMAT.skin,
      beard: PMAT.amber,
      hat: 'horns',
      hatRamp: PMAT.bronze,
      pauldrons: PMAT.steel,
      tool: 'hammer',
    }),
  ),
  lizardfolk: icon24((c) =>
    drawBust24(c, {
      tunic: PMAT.bronze,
      trim: PMAT.gold,
      skin: PMAT.moss,
      lizard: true,
      hat: 'crest',
      tool: 'spear',
    }),
  ),
  villager: icon24((c) =>
    drawBust24(c, {
      tunic: PMAT.water,
      trim: PMAT.parchment,
      hat: 'straw',
      tool: 'basket',
    }),
  ),
  forager: icon24((c) =>
    drawBust24(c, {
      tunic: PMAT.wood,
      trim: PMAT.moss,
      hat: 'beret',
      hatRamp: PMAT.moss,
      tool: 'herb',
    }),
  ),
  miner: icon24((c) =>
    drawBust24(c, {
      tunic: PMAT.stone,
      trim: PMAT.wood,
      beard: PMAT.darkWood,
      hat: 'hardhat',
      tool: 'pick',
    }),
  ),
  builder: icon24((c) =>
    drawBust24(c, {
      tunic: PMAT.bronze,
      trim: PMAT.sand,
      hat: 'cap',
      hatRamp: PMAT.water,
      tool: 'hammer',
    }),
  ),
  warrior: icon24((c) =>
    drawBust24(c, {
      tunic: PMAT.crimson,
      trim: PMAT.gold,
      hat: 'helm',
      pauldrons: PMAT.steel,
      shield: true,
      tool: 'sword',
    }),
  ),
  priest: icon24((c) =>
    drawBust24(c, {
      tunic: PMAT.parchment,
      trim: PMAT.gold,
      hat: 'miter',
      stole: true,
      tool: 'ankh',
    }),
  ),
  scholar: icon24((c) =>
    drawBust24(c, {
      tunic: PMAT.arcane,
      trim: PMAT.gold,
      beard: PMAT.bone,
      hat: 'wizard',
      hatRamp: PMAT.arcane,
      tool: 'book',
    }),
  ),
  astro_engineer: icon24((c) =>
    drawBust24(c, {
      tunic: PMAT.bone,
      trim: PMAT.amber,
      hat: 'visor',
      pauldrons: PMAT.steel,
      tool: 'wrench',
    }),
  ),
  raider_swarmer: icon24((c) =>
    drawBust24(c, {
      tunic: PMAT.crimson,
      trim: PMAT.iron,
      skin: PMAT.orc,
      hat: 'warhelm',
      hatRamp: PMAT.iron,
      bandana: true,
      eyeRamp: PMAT.amber,
      tool: 'dagger',
    }),
  ),
  raider_ranged: icon24((c) =>
    drawBust24(c, {
      tunic: PMAT.darkWood,
      trim: PMAT.iron,
      skin: PMAT.parchment,
      hat: 'hood',
      hatRamp: PMAT.iron,
      bandana: true,
      tool: 'bow',
    }),
  ),
  raider_behemoth: icon24((c) =>
    drawBust24(c, {
      tunic: PMAT.iron,
      trim: PMAT.crimson,
      skin: PMAT.wood,
      hat: 'horns',
      hatRamp: PMAT.iron,
      pauldrons: PMAT.iron,
      eyeRamp: PMAT.crimson,
      tool: 'hammer',
    }),
  ),

  // =========================================================================
  // 38 ANIMALS (24x24 Grounded Half-Body Bust Portraits)
  // =========================================================================
  pig: icon24((c) => {
    drawShoulders(c, 12, 15, 7, PMAT.rose);
    // Floppy ears
    c.stamp(4, 4, ['.332', '3221', '211.'], PMAT.rose);
    c.stamp(16, 4, ['233.', '1223', '.112'], PMAT.rose);
    // Round head
    shadedOval(c, 12, 10, 5.5, 5, PMAT.rose);
    // Eyes
    drawEye(c, 9, 8);
    drawEye(c, 15, 8);
    // Big prominent oval snout
    shadedOval(c, 12, 12.5, 3.2, 2.2, PMAT.rose);
    c.set(10, 12, PMAT.rose, 0);
    c.set(11, 12, PMAT.rose, 0);
    c.set(13, 12, PMAT.rose, 0);
    c.set(14, 12, PMAT.rose, 0);
  }),

  cow: icon24((c) => {
    drawShoulders(c, 12, 15, 7, PMAT.parchment);
    // Black/brown dairy patches on shoulders & brow
    c.ellipse(7, 18, 2.5, 2.2, PMAT.darkWood, 1);
    c.ellipse(17, 19, 2.2, 1.8, PMAT.darkWood, 1);
    // Curved horns & side ears
    drawHorn(c, 7, 5, 5, 3, 6, 2, PMAT.sand);
    drawHorn(c, 17, 5, 19, 3, 18, 2, PMAT.sand);
    c.stamp(3, 6, ['221', '110'], PMAT.darkWood);
    c.stamp(18, 6, ['122', '011'], PMAT.darkWood);
    // Head
    shadedOval(c, 12, 10, 5.2, 5, PMAT.parchment);
    c.ellipse(14.5, 8, 2.2, 2, PMAT.darkWood, 1);
    drawEye(c, 9, 8);
    drawEye(c, 15, 8);
    // Broad pink muzzle
    shadedOval(c, 12, 13.5, 4.2, 2.5, PMAT.rose);
    c.set(10, 13, PMAT.rose, 0);
    c.set(14, 13, PMAT.rose, 0);
  }),

  bear: icon24((c) => {
    drawShoulders(c, 12, 14, 8.5, PMAT.wood);
    // Round fuzzy ears
    shadedOval(c, 6, 5, 2.2, 2.2, PMAT.wood);
    shadedOval(c, 18, 5, 2.2, 2.2, PMAT.wood);
    c.set(6, 5, PMAT.darkWood, 1);
    c.set(18, 5, PMAT.darkWood, 1);
    // Broad grizzly head
    shadedOval(c, 12, 10, 6, 5.2, PMAT.wood);
    drawEye(c, 9, 8);
    drawEye(c, 15, 8);
    // Tan muzzle & dark nose
    shadedOval(c, 12, 12.5, 3.2, 2.5, PMAT.sand);
    c.rect(11, 11, 3, 2, PMAT.iron, 1);
    c.set(11, 11, PMAT.iron, 3);
    c.line(11, 14, 13, 14, PMAT.darkWood, 0);
  }),

  wolf: icon24((c) => {
    drawShoulders(c, 12, 15, 7.5, PMAT.stone, PMAT.bone);
    // Tall pointed ears
    c.stamp(5, 2, ['..3.', '.32.', '321.', '2110'], PMAT.stone);
    c.stamp(15, 2, ['.3..', '.23.', '.123', '0112'], PMAT.stone);
    // Cheek ruffs & head
    shadedOval(c, 12, 10, 5.4, 4.6, PMAT.stone);
    c.stamp(5, 10, ['32', '21', '.1'], PMAT.bone);
    c.stamp(17, 10, ['23', '12', '1.'], PMAT.bone);
    // Fierce amber eyes
    drawEye(c, 9, 8, PMAT.amber);
    drawEye(c, 15, 8, PMAT.amber);
    // Tapering snout
    shadedOval(c, 12, 13, 2.8, 2.6, PMAT.bone);
    c.rect(11, 12, 3, 2, PMAT.iron, 0);
    c.set(11, 12, PMAT.steel, 3);
    c.line(10, 15, 14, 15, PMAT.iron, 0);
  }),

  chicken: icon24((c) => {
    drawShoulders(c, 12, 14, 7, PMAT.parchment);
    // Tall crimson comb on crown
    c.stamp(
      8,
      2,
      [
        '.34.34..',
        '3323323.',
        '2222221.',
      ],
      PMAT.crimson,
    );
    // Round head & neck
    shadedOval(c, 12, 9.5, 4.6, 4.4, PMAT.parchment);
    drawEye(c, 9, 8);
    drawEye(c, 15, 8);
    // Sharp golden beak
    c.stamp(
      10,
      10,
      [
        '.343.',
        '32221',
        '.111.',
      ],
      PMAT.gold,
    );
    // Red wattle under beak
    c.stamp(10, 13, ['32.32', '21.21'], PMAT.crimson);
  }),

  capybara: icon24((c) => {
    drawShoulders(c, 12, 15, 7.5, PMAT.fur);
    // Small high rounded ears
    c.ellipse(6, 6, 1.5, 1.6, PMAT.darkWood, 2);
    c.ellipse(18, 6, 1.5, 1.6, PMAT.darkWood, 2);
    // Boxy chill head
    shadedOval(c, 12, 10.5, 5.8, 4.8, PMAT.fur);
    c.rect(7, 6, 10, 3, PMAT.fur, 3);
    // Sleepy serene eyes
    c.line(8, 9, 10, 9, PMAT.darkWood, 0);
    c.line(14, 9, 16, 9, PMAT.darkWood, 0);
    c.set(9, 10, PMAT.darkWood, 1);
    c.set(15, 10, PMAT.darkWood, 1);
    // Broad dark blunt nose
    shadedOval(c, 12, 13, 3.2, 2.2, PMAT.darkWood);
    c.set(10, 12, PMAT.iron, 0);
    c.set(14, 12, PMAT.iron, 0);
  }),

  dinosaur: icon24((c) => {
    // Muscular scaly T-Rex neck & chest
    drawShoulders(c, 9, 14, 6.5, PMAT.moss, PMAT.sand);
    // Dorsal ridge spikes
    c.set(4, 8, PMAT.amber, 3);
    c.set(4, 11, PMAT.amber, 3);
    c.set(5, 14, PMAT.amber, 2);
    // Massive blocky theropod head facing right
    shadedOval(c, 11, 8.5, 5.5, 4.2, PMAT.moss);
    c.rect(11, 6, 9, 4, PMAT.moss, 2);
    c.line(11, 6, 19, 6, PMAT.moss, 3);
    // Lower jaw
    c.rect(11, 12, 8, 2, PMAT.moss, 1);
    // Snarling mouth & white teeth
    c.rect(13, 10, 7, 2, PMAT.crimson, 1);
    c.set(14, 10, PMAT.bone, 4);
    c.set(16, 10, PMAT.bone, 4);
    c.set(18, 10, PMAT.bone, 4);
    c.set(15, 11, PMAT.bone, 3);
    c.set(17, 11, PMAT.bone, 3);
    // Fierce eye & nostril
    drawEye(c, 11, 7, PMAT.amber);
    c.set(18, 7, PMAT.moss, 0);
  }),

  deer: icon24((c) => {
    drawShoulders(c, 12, 16, 6.5, PMAT.fur, PMAT.parchment);
    // Branching noble antlers (y=1..7)
    c.line(9, 7, 5, 2, PMAT.wood, 2);
    c.line(7, 5, 3, 4, PMAT.wood, 3);
    c.line(6, 3, 7, 1, PMAT.wood, 4);
    c.line(15, 7, 19, 2, PMAT.wood, 2);
    c.line(17, 5, 21, 4, PMAT.wood, 3);
    c.line(18, 3, 17, 1, PMAT.wood, 4);
    // Large alert ears
    c.stamp(4, 7, ['332', '210'], PMAT.fur);
    c.stamp(17, 7, ['233', '012'], PMAT.fur);
    // Slender stag head & neck
    c.rect(10, 12, 4, 5, PMAT.fur, 2);
    shadedOval(c, 12, 10.5, 4.2, 4.2, PMAT.fur);
    drawEye(c, 10, 9);
    drawEye(c, 14, 9);
    // Dark nose & white chin
    shadedOval(c, 12, 13.5, 2, 1.4, PMAT.parchment);
    c.rect(11, 12, 3, 2, PMAT.iron, 0);
  }),

  sheep: icon24((c) => {
    // Fluffy scalloped wool shoulders
    drawShoulders(c, 12, 14, 8, PMAT.parchment);
    shadedOval(c, 6, 16, 2.5, 2.5, PMAT.parchment);
    shadedOval(c, 18, 16, 2.5, 2.5, PMAT.parchment);
    // Floppy dark ears
    c.stamp(4, 9, ['221', '10.'], PMAT.iron);
    c.stamp(17, 9, ['122', '.01'], PMAT.iron);
    // Dark face
    shadedOval(c, 12, 11.5, 4.2, 4.2, PMAT.iron);
    // Fluffy wool crown on top of head
    shadedOval(c, 12, 6, 4.5, 2.8, PMAT.parchment);
    shadedOval(c, 9, 7, 2.4, 2, PMAT.parchment);
    shadedOval(c, 15, 7, 2.4, 2, PMAT.parchment);
    // Expressive eyes & nose
    drawEye(c, 10, 10, PMAT.gold);
    drawEye(c, 14, 10, PMAT.gold);
    c.set(12, 13, PMAT.rose, 2);
  }),

  rabbit: icon24((c) => {
    drawShoulders(c, 12, 16, 6.5, PMAT.parchment, PMAT.bone);
    // Tall upright bunny ears with pink interior
    c.ellipse(8.5, 5, 1.8, 4.2, PMAT.parchment, 3);
    c.ellipse(15.5, 5, 1.8, 4.2, PMAT.parchment, 2);
    c.line(8, 3, 8, 7, PMAT.rose, 3);
    c.line(15, 3, 15, 7, PMAT.rose, 2);
    // Chubby cheeks & head
    shadedOval(c, 12, 12, 5, 4.2, PMAT.parchment);
    drawEye(c, 9, 10);
    drawEye(c, 15, 10);
    // Pink twitchy nose & buck teeth
    c.rect(11, 12, 2, 1, PMAT.rose, 3);
    c.set(11, 14, PMAT.bone, 4);
    c.set(12, 14, PMAT.bone, 4);
  }),

  fox: icon24((c) => {
    drawShoulders(c, 12, 15, 7, PMAT.amber, PMAT.parchment);
    // Tall pointed ears with dark tips
    c.stamp(5, 2, ['..x.', '.xx.', '322.', '2210'], PMAT.amber, BMAT);
    c.stamp(15, 2, ['.x..', '.xx.', '.223', '0122'], PMAT.amber, BMAT);
    // Fox head + white cheek ruffs
    shadedOval(c, 12, 10, 5.2, 4.2, PMAT.amber);
    c.stamp(5, 10, ['332', '221'], PMAT.parchment);
    c.stamp(16, 10, ['233', '122'], PMAT.parchment);
    // Pointed snout
    shadedOval(c, 12, 13, 2.5, 2.3, PMAT.parchment);
    c.rect(11, 13, 2, 2, PMAT.iron, 0);
    // Clever eyes
    drawEye(c, 9, 9, PMAT.gold);
    drawEye(c, 15, 9, PMAT.gold);
  }),

  boar: icon24((c) => {
    // Hunched bristly shoulders & dorsal crest
    drawShoulders(c, 12, 14, 8, PMAT.darkWood);
    c.stamp(8, 3, ['.23232.', '2212121'], PMAT.wood);
    // Ears
    c.stamp(5, 5, ['22', '10'], PMAT.darkWood);
    c.stamp(17, 5, ['22', '01'], PMAT.darkWood);
    // Coarse head
    shadedOval(c, 12, 10.5, 5.8, 5, PMAT.darkWood);
    drawEye(c, 9, 8, PMAT.amber);
    drawEye(c, 15, 8, PMAT.amber);
    // Wide snout & curved ivory tusks
    shadedOval(c, 12, 13.5, 3.4, 2.2, PMAT.wood);
    c.set(11, 13, PMAT.iron, 0);
    c.set(13, 13, PMAT.iron, 0);
    drawHorn(c, 8, 14, 6, 13, 6, 10, PMAT.parchment);
    drawHorn(c, 16, 14, 18, 13, 18, 10, PMAT.parchment);
  }),

  lion: icon24((c) => {
    drawShoulders(c, 12, 16, 7, PMAT.gold);
    // Massive thick layered mane
    shadedOval(c, 12, 10.5, 8.5, 8, PMAT.wood);
    shadedOval(c, 12, 10, 7.6, 7, PMAT.amber, false);
    // Round ears peeking through mane
    c.ellipse(6, 5, 1.6, 1.6, PMAT.gold, 3);
    c.ellipse(18, 5, 1.6, 1.6, PMAT.gold, 2);
    // Regal lion face
    shadedOval(c, 12, 10.5, 4.8, 4.6, PMAT.gold);
    drawEye(c, 9, 9, PMAT.amber);
    drawEye(c, 15, 9, PMAT.amber);
    // Strong squared muzzle & dark nose
    shadedOval(c, 12, 13, 2.8, 2, PMAT.parchment);
    c.rect(11, 11, 3, 2, PMAT.darkWood, 0);
    c.set(12, 13, PMAT.darkWood, 0);
  }),

  elephant: icon24((c) => {
    drawShoulders(c, 12, 15, 6.5, PMAT.stone);
    // Huge flapping ears
    shadedOval(c, 4.5, 10.5, 3.2, 5.2, PMAT.stone);
    shadedOval(c, 19.5, 10.5, 3.2, 5.2, PMAT.stone);
    c.ellipse(5, 11, 1.6, 3.2, PMAT.rose, 1);
    c.ellipse(19, 11, 1.6, 3.2, PMAT.rose, 1);
    // Domed head
    shadedOval(c, 12, 9.5, 5, 5.2, PMAT.stone);
    drawEye(c, 9, 9);
    drawEye(c, 15, 9);
    // Gleaming ivory tusks
    drawHorn(c, 8, 13, 6, 15, 5, 14, PMAT.parchment);
    drawHorn(c, 16, 13, 18, 15, 19, 14, PMAT.parchment);
    // Long curled trunk
    c.rect(10, 12, 4, 5, PMAT.stone, 2);
    c.line(10, 12, 10, 16, PMAT.stone, 3);
    c.line(11, 17, 13, 19, PMAT.stone, 2);
    c.line(13, 19, 15, 18, PMAT.stone, 3);
    c.set(15, 17, PMAT.stone, 4);
  }),

  camel: icon24((c) => {
    // Hump silhouette behind & shoulders
    shadedOval(c, 6, 17, 4, 4, PMAT.sand);
    drawShoulders(c, 12, 16, 7, PMAT.sand);
    // Curved neck
    c.rect(8, 10, 5, 8, PMAT.sand, 2);
    c.line(8, 10, 8, 17, PMAT.sand, 3);
    // Small ears
    c.set(9, 4, PMAT.sand, 3);
    c.set(12, 4, PMAT.sand, 2);
    // Regal desert head & long muzzle facing right
    shadedOval(c, 12, 7.5, 4, 3, PMAT.sand);
    shadedOval(c, 16.5, 8.5, 3.2, 2.2, PMAT.sand);
    // Heavy-lidded eye & smile
    c.line(11, 6, 13, 6, PMAT.wood, 1);
    drawEye(c, 12, 7);
    c.set(18, 8, PMAT.wood, 0);
    c.line(15, 10, 18, 10, PMAT.wood, 0);
  }),

  penguin: icon24((c) => {
    // Tuxedo black shoulders & flippers
    drawShoulders(c, 12, 14, 7.5, PMAT.iron, PMAT.bone);
    // Sleek black head
    shadedOval(c, 12, 8.5, 4.8, 4.8, PMAT.iron);
    // Warm amber/gold emperor cheek patches
    c.ellipse(8.5, 10.5, 1.5, 1.8, PMAT.amber, 3);
    c.ellipse(15.5, 10.5, 1.5, 1.8, PMAT.amber, 3);
    // Crisp white eyes & sharp amber beak
    c.set(9, 8, PMAT.bone, 4);
    c.set(10, 8, PMAT.iron, 0);
    c.set(14, 8, PMAT.iron, 0);
    c.set(15, 8, PMAT.bone, 4);
    c.stamp(
      10,
      9,
      [
        '.343.',
        '32221',
        '.111.',
      ],
      PMAT.amber,
    );
  }),

  crocodile: icon24((c) => {
    // Thick armored neck & shoulders
    drawShoulders(c, 8, 15, 6.5, PMAT.moss, PMAT.sand);
    // Raised brow & eyes on top of head
    shadedOval(c, 9, 8, 3.5, 2.8, PMAT.moss);
    drawEye(c, 8, 7, PMAT.amber);
    drawEye(c, 11, 7, PMAT.amber);
    // Long armored snout extending right
    c.rect(7, 9, 14, 3, PMAT.moss, 2);
    c.line(8, 9, 20, 9, PMAT.moss, 3);
    c.rect(7, 13, 13, 2, PMAT.moss, 1);
    // Interlocking white teeth
    c.line(9, 12, 20, 12, PMAT.moss, 0);
    for (let x = 10; x <= 19; x += 2) {
      c.set(x, 12, PMAT.bone, 4);
    }
    // Nostril ridge at snout tip
    c.set(19, 8, PMAT.moss, 3);
    c.set(20, 9, PMAT.moss, 0);
  }),

  horse: icon24((c) => {
    // Arched muscular neck & shoulders
    drawShoulders(c, 10, 15, 7, PMAT.wood);
    // Flowing dark mane along left crest
    c.stamp(
      4,
      4,
      [
        '..21.',
        '.2110',
        '2110.',
        '210..',
        '110..',
        '10...',
        '10...',
        '0....',
      ],
      PMAT.darkWood,
    );
    // Pointed ears
    c.line(8, 5, 9, 2, PMAT.wood, 3);
    c.line(11, 5, 12, 2, PMAT.wood, 2);
    // Sculpted horse head & muzzle facing right
    shadedOval(c, 11, 8.5, 4.2, 3.8, PMAT.wood);
    c.line(12, 7, 18, 12, PMAT.wood, 3);
    c.line(11, 8, 17, 13, PMAT.wood, 2);
    c.line(10, 9, 16, 14, PMAT.wood, 2);
    c.line(10, 10, 15, 14, PMAT.wood, 1);
    shadedOval(c, 17, 13, 2.2, 2, PMAT.darkWood);
    // White forehead blaze & dark eye
    c.line(13, 7, 16, 10, PMAT.parchment, 3);
    drawEye(c, 11, 8);
  }),

  goat: icon24((c) => {
    drawShoulders(c, 12, 16, 6.5, PMAT.bone);
    // Sweeping ridged horns
    drawHorn(c, 9, 6, 6, 3, 4, 4, PMAT.darkWood);
    drawHorn(c, 15, 6, 18, 3, 20, 4, PMAT.darkWood);
    // Side ears
    c.line(5, 8, 7, 8, PMAT.bone, 2);
    c.line(17, 8, 19, 8, PMAT.bone, 2);
    // Narrow goat head
    shadedOval(c, 12, 10, 4, 4.4, PMAT.bone);
    drawEye(c, 10, 9, PMAT.gold);
    drawEye(c, 14, 9, PMAT.gold);
    c.set(11, 13, PMAT.iron, 0);
    c.set(13, 13, PMAT.iron, 0);
    // Distinct billy-goat beard!
    c.stamp(10, 14, ['32221', '.221.', '..1..'], PMAT.parchment);
  }),

  monkey: icon24((c) => {
    drawShoulders(c, 12, 15, 7, PMAT.wood);
    // Big round side ears
    shadedOval(c, 4.5, 9.5, 2.2, 2.4, PMAT.skin);
    shadedOval(c, 19.5, 9.5, 2.2, 2.4, PMAT.skin);
    // Furry head
    shadedOval(c, 12, 9.5, 5.4, 5, PMAT.wood);
    // Heart-shaped skin face & muzzle
    shadedOval(c, 10, 9, 2.3, 2.2, PMAT.skin);
    shadedOval(c, 14, 9, 2.3, 2.2, PMAT.skin);
    shadedOval(c, 12, 12.5, 3.6, 2.5, PMAT.skin);
    drawEye(c, 10, 9);
    drawEye(c, 14, 9);
    c.set(11, 12, PMAT.darkWood, 0);
    c.set(13, 12, PMAT.darkWood, 0);
    c.line(10, 14, 14, 14, PMAT.darkWood, 0);
  }),

  panda: icon24((c) => {
    // Iconic black shoulders & white chest
    drawShoulders(c, 12, 15, 8, PMAT.iron, PMAT.bone);
    // Round black ears
    shadedOval(c, 6, 5, 2.2, 2.2, PMAT.iron);
    shadedOval(c, 18, 5, 2.2, 2.2, PMAT.iron);
    // Round white panda head
    shadedOval(c, 12, 10.5, 5.8, 5.2, PMAT.bone);
    // Iconic bold black eye patches
    c.ellipse(9, 10, 2, 1.8, PMAT.iron, 0);
    c.ellipse(15, 10, 2, 1.8, PMAT.iron, 0);
    c.set(9, 9, PMAT.bone, 4);
    c.set(15, 9, PMAT.bone, 4);
    // Black nose & cute mouth
    c.rect(11, 12, 3, 2, PMAT.iron, 0);
    c.line(10, 14, 14, 14, PMAT.iron, 1);
  }),

  polar_bear: icon24((c) => {
    drawShoulders(c, 12, 14, 8.5, PMAT.bone);
    // Cool arctic ice shadow accents
    c.line(17, 16, 19, 20, PMAT.ice, 2);
    // Round ears
    shadedOval(c, 6.5, 5.5, 2, 2, PMAT.bone);
    shadedOval(c, 17.5, 5.5, 2, 2, PMAT.bone);
    // Massive pale head
    shadedOval(c, 12, 10, 5.8, 5.2, PMAT.bone);
    drawEye(c, 9, 8);
    drawEye(c, 15, 8);
    // Prominent black nose & muzzle
    shadedOval(c, 12, 12.8, 3, 2.2, PMAT.ice, false);
    c.rect(11, 11, 3, 2, PMAT.iron, 0);
    c.set(11, 11, PMAT.steel, 3);
  }),

  hippo: icon24((c) => {
    drawShoulders(c, 12, 15, 8.5, PMAT.arcane);
    // Tiny perched ears
    c.ellipse(7, 5, 1.4, 1.5, PMAT.arcane, 3);
    c.ellipse(17, 5, 1.4, 1.5, PMAT.arcane, 2);
    // Heavy upper head
    shadedOval(c, 12, 9.5, 5.5, 4.4, PMAT.arcane);
    drawEye(c, 9, 8);
    drawEye(c, 15, 8);
    // Huge bulbous wide snout
    shadedOval(c, 12, 13.5, 5.4, 3.2, PMAT.rose);
    c.set(9, 12, PMAT.iron, 0);
    c.set(15, 12, PMAT.iron, 0);
    // Twin tusks peeking up
    c.set(9, 15, PMAT.parchment, 4);
    c.set(15, 15, PMAT.parchment, 4);
  }),

  rhino: icon24((c) => {
    // Armored stone-grey shoulders
    drawShoulders(c, 10, 14, 7.5, PMAT.stone);
    c.line(7, 15, 7, 21, PMAT.stone, 1);
    // Small ears
    c.set(7, 6, PMAT.stone, 3);
    c.set(10, 6, PMAT.stone, 2);
    // Heavy lowered head facing right
    shadedOval(c, 11, 10.5, 5.5, 4.4, PMAT.stone);
    shadedOval(c, 16, 12, 3.5, 3, PMAT.stone);
    drawEye(c, 11, 10);
    // Iconic large front horn & smaller rear horn
    drawHorn(c, 18, 10, 20, 7, 20, 4, PMAT.parchment);
    drawHorn(c, 15, 9, 16, 7, 16, 6, PMAT.parchment);
  }),

  turtle: icon24((c) => {
    // Domed patterned shell rising behind shoulders
    shadedOval(c, 10, 15, 8, 6.5, PMAT.wood);
    c.ellipse(10, 15, 6, 4.5, PMAT.moss, 2);
    c.line(6, 14, 14, 14, PMAT.wood, 1);
    c.line(10, 11, 10, 19, PMAT.wood, 1);
    c.line(4, 19, 16, 19, PMAT.sand, 3);
    // Scaly green neck & wise head poking right
    c.rect(13, 10, 4, 6, PMAT.moss, 2);
    shadedOval(c, 17, 9, 3.8, 3.2, PMAT.moss);
    drawEye(c, 17, 8);
    c.line(16, 11, 20, 11, PMAT.moss, 0);
  }),

  frog: icon24((c) => {
    // Plump crouched shoulders & pale throat sac
    drawShoulders(c, 12, 14, 7.5, PMAT.toxic, PMAT.parchment);
    // Broad flat head
    shadedOval(c, 12, 11, 6.2, 3.8, PMAT.toxic);
    // Huge bulging top-mounted gold eyes
    shadedOval(c, 8, 6.5, 2.6, 2.6, PMAT.toxic);
    shadedOval(c, 16, 6.5, 2.6, 2.6, PMAT.toxic);
    c.ellipse(8, 6.5, 1.5, 1.5, PMAT.gold, 4);
    c.ellipse(16, 6.5, 1.5, 1.5, PMAT.gold, 4);
    c.line(7, 6, 9, 6, PMAT.iron, 0);
    c.line(15, 6, 17, 6, PMAT.iron, 0);
    // Wide happy frog smile
    c.line(7, 12, 17, 12, PMAT.moss, 0);
    c.set(8, 13, PMAT.moss, 0);
    c.set(16, 13, PMAT.moss, 0);
  }),

  crab: cluster24(
    [
      '........................',
      '........................',
      '..343..............343..',
      '.33223............32233.',
      '.322.2............2.223.',
      '.22..1............1..22.',
      '.21122............22112.',
      '..1221...x....x...1221..',
      '...21....3....3....12...',
      '....21..34333343..12....',
      '.....1.3332222233.1.....',
      '.....33322222222113.....',
      '....3322222222221111....',
      '....2222222222211111....',
      '...221222222221111211...',
      '..21..111111111111..12..',
      '.21...122222222221...12.',
      '.1...21..111111..12...1.',
      '....21...1....1...12....',
      '...11..............11...',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.crimson,
    BMAT,
  ),

  giraffe: icon24((c) => {
    // Tall spotted neck & shoulders
    drawShoulders(c, 11, 16, 6, PMAT.gold);
    c.rect(8, 9, 6, 10, PMAT.gold, 2);
    c.line(8, 9, 8, 18, PMAT.gold, 3);
    // Iconic brown giraffe spots
    c.rect(9, 12, 2, 2, PMAT.wood, 2);
    c.rect(12, 15, 2, 2, PMAT.wood, 2);
    c.rect(8, 17, 2, 2, PMAT.wood, 1);
    c.rect(13, 19, 2, 2, PMAT.wood, 1);
    // Ossicones (horns) & flared ears
    c.line(9, 5, 9, 2, PMAT.gold, 3);
    c.set(9, 2, PMAT.darkWood, 1);
    c.line(13, 5, 13, 2, PMAT.gold, 2);
    c.set(13, 2, PMAT.darkWood, 1);
    c.line(5, 6, 8, 7, PMAT.gold, 3);
    // Head & gentle muzzle facing right
    shadedOval(c, 12, 7.5, 3.8, 3, PMAT.gold);
    shadedOval(c, 16.5, 8.5, 2.8, 2, PMAT.sand);
    drawEye(c, 12, 7);
    c.set(18, 8, PMAT.darkWood, 0);
  }),

  zebra: icon24((c) => {
    drawShoulders(c, 10, 15, 7, PMAT.bone);
    // Upright spiky black-and-white mane
    for (let y = 4; y <= 14; y++) {
      c.set(5, y, y % 2 === 0 ? PMAT.iron : PMAT.bone, y % 2 === 0 ? 0 : 3);
      c.set(6, y, y % 2 === 0 ? PMAT.iron : PMAT.bone, y % 2 === 0 ? 1 : 2);
    }
    // Pointed ears
    c.line(8, 5, 9, 2, PMAT.bone, 3);
    c.line(11, 5, 12, 2, PMAT.bone, 2);
    // Head & muzzle
    shadedOval(c, 11, 8.5, 4.2, 3.8, PMAT.bone);
    c.line(12, 7, 18, 12, PMAT.bone, 3);
    c.line(11, 8, 17, 13, PMAT.bone, 2);
    c.line(10, 9, 16, 14, PMAT.bone, 2);
    shadedOval(c, 17, 13, 2.3, 2, PMAT.iron);
    // Bold crisp black zebra stripes!
    c.line(7, 16, 12, 16, PMAT.iron, 0);
    c.line(6, 19, 13, 19, PMAT.iron, 0);
    c.line(8, 11, 12, 12, PMAT.iron, 0);
    c.line(9, 7, 12, 6, PMAT.iron, 0);
    c.line(13, 8, 15, 10, PMAT.iron, 0);
    drawEye(c, 11, 8);
  }),

  tiger: icon24((c) => {
    drawShoulders(c, 12, 15, 8, PMAT.amber, PMAT.parchment);
    // Round ears
    shadedOval(c, 6, 5, 2, 2, PMAT.amber);
    shadedOval(c, 18, 5, 2, 2, PMAT.amber);
    // Broad fierce tiger head + white cheek ruffs
    shadedOval(c, 12, 10.5, 6, 5.2, PMAT.amber);
    c.stamp(5, 10, ['33', '22', '.1'], PMAT.parchment);
    c.stamp(17, 10, ['33', '22', '1.'], PMAT.parchment);
    // Bold black tiger stripes
    c.line(12, 5, 12, 8, PMAT.iron, 0);
    c.line(10, 6, 14, 6, PMAT.iron, 0);
    c.line(6, 9, 8, 9, PMAT.iron, 0);
    c.line(16, 9, 18, 9, PMAT.iron, 0);
    c.line(6, 17, 9, 17, PMAT.iron, 0);
    c.line(15, 17, 18, 17, PMAT.iron, 0);
    // Piercing gold eyes & muzzle
    drawEye(c, 9, 9, PMAT.gold);
    drawEye(c, 15, 9, PMAT.gold);
    shadedOval(c, 12, 13, 2.8, 2, PMAT.parchment);
    c.rect(11, 11, 3, 2, PMAT.rose, 2);
  }),

  gorilla: icon24((c) => {
    // Colossal silverback shoulders
    drawShoulders(c, 12, 13, 9, PMAT.iron);
    c.line(5, 14, 19, 14, PMAT.steel, 3);
    c.line(6, 15, 18, 15, PMAT.steel, 2);
    // Muscular chest
    c.ellipse(9.5, 18, 2.2, 2, PMAT.stone, 1);
    c.ellipse(14.5, 18, 2.2, 2, PMAT.stone, 1);
    // Heavy sagittal-crest head
    shadedOval(c, 12, 9, 5.2, 5.4, PMAT.iron);
    // Heavy brow ridge & deep-set eyes
    c.rect(8, 8, 9, 2, PMAT.stone, 2);
    c.set(9, 10, PMAT.amber, 3);
    c.set(15, 10, PMAT.amber, 3);
    // Wide flat nostrils & jaw
    shadedOval(c, 12, 12.5, 3.4, 2.4, PMAT.stone);
    c.set(11, 12, PMAT.iron, 0);
    c.set(13, 12, PMAT.iron, 0);
    c.line(10, 14, 14, 14, PMAT.iron, 0);
  }),

  kangaroo: icon24((c) => {
    drawShoulders(c, 11, 15, 6.5, PMAT.bronze, PMAT.sand);
    // Tall upright kangaroo ears
    c.line(8, 7, 6, 2, PMAT.bronze, 3);
    c.line(9, 7, 7, 2, PMAT.bronze, 2);
    c.line(11, 7, 13, 2, PMAT.bronze, 2);
    c.line(12, 7, 14, 2, PMAT.bronze, 1);
    // Slender neck & head facing right
    c.rect(9, 10, 4, 6, PMAT.bronze, 2);
    shadedOval(c, 11.5, 8.5, 3.8, 3, PMAT.bronze);
    shadedOval(c, 16, 9.5, 2.8, 2, PMAT.bronze);
    drawEye(c, 12, 8);
    c.set(18, 9, PMAT.iron, 0);
    // Folded forepaws tucked in front
    c.stamp(13, 16, ['322', '211', '.10'], PMAT.bronze);
  }),

  moose: icon24((c) => {
    // Shaggy dark bull-moose shoulders & throat dewlap
    drawShoulders(c, 12, 15, 7.5, PMAT.darkWood);
    c.rect(11, 16, 2, 4, PMAT.darkWood, 1);
    // Huge broad palmate antlers spanning x=2..21, y=2..9
    c.stamp(
      2,
      2,
      [
        '4.4.4...',
        '33332...',
        '.22222..',
        '..12222.',
        '.....122',
      ],
      PMAT.sand,
    );
    c.stamp(
      14,
      2,
      [
        '...4.4.4',
        '...23333',
        '..22222.',
        '.22221..',
        '221.....',
      ],
      PMAT.sand,
    );
    // Heavy long bulbous muzzle
    shadedOval(c, 12, 11, 4.2, 5.2, PMAT.darkWood);
    shadedOval(c, 12, 14.5, 3.4, 2.5, PMAT.wood);
    drawEye(c, 9, 9);
    drawEye(c, 15, 9);
    c.set(10, 14, PMAT.iron, 0);
    c.set(14, 14, PMAT.iron, 0);
  }),

  bison: icon24((c) => {
    // Colossal humped shaggy shoulders
    shadedOval(c, 12, 14, 9, 7, PMAT.darkWood);
    drawShoulders(c, 12, 15, 8.5, PMAT.darkWood);
    // Curved side horns
    drawHorn(c, 6, 8, 4, 6, 5, 4, PMAT.parchment);
    drawHorn(c, 18, 8, 20, 6, 19, 4, PMAT.parchment);
    // Huge shaggy wool-crowned head & beard
    shadedOval(c, 12, 11, 6, 5.5, PMAT.wood);
    shadedOval(c, 12, 8, 5.6, 3.2, PMAT.darkWood);
    drawEye(c, 9, 10, PMAT.amber);
    drawEye(c, 15, 10, PMAT.amber);
    // Broad dark muzzle
    shadedOval(c, 12, 14, 3.2, 2.2, PMAT.iron);
    c.set(11, 14, PMAT.iron, 0);
    c.set(13, 14, PMAT.iron, 0);
  }),

  flamingo: icon24((c) => {
    // Feathered pink shoulder base
    drawShoulders(c, 10, 16, 7, PMAT.rose);
    // Graceful S-curved slender neck
    c.line(10, 16, 8, 12, PMAT.rose, 3);
    c.line(11, 16, 9, 12, PMAT.rose, 2);
    c.line(8, 12, 11, 7, PMAT.rose, 3);
    c.line(9, 12, 12, 7, PMAT.rose, 2);
    // Small elegant head
    shadedOval(c, 12.5, 6.5, 3, 2.5, PMAT.rose);
    drawEye(c, 13, 6, PMAT.gold);
    // Iconic downward-curved black-tipped beak
    c.line(15, 6, 18, 7, PMAT.parchment, 3);
    c.line(18, 7, 19, 10, PMAT.iron, 0);
    c.line(17, 8, 18, 10, PMAT.iron, 1);
  }),

  ostrich: icon24((c) => {
    // Fluffy black-feathered shoulders with white plume tips
    drawShoulders(c, 11, 16, 7.5, PMAT.iron);
    c.set(5, 18, PMAT.bone, 4);
    c.set(17, 18, PMAT.bone, 4);
    c.set(6, 20, PMAT.bone, 3);
    c.set(16, 20, PMAT.bone, 3);
    // Long pale slender neck
    c.rect(10, 8, 3, 9, PMAT.skin, 2);
    c.line(10, 8, 10, 16, PMAT.skin, 3);
    // Small flat head with huge expressive eyes & flat beak
    shadedOval(c, 12, 6.5, 3.2, 2.5, PMAT.skin);
    c.set(11, 5, PMAT.bone, 4);
    c.set(12, 6, PMAT.iron, 0);
    c.rect(15, 6, 5, 2, PMAT.amber, 3);
    c.line(15, 7, 19, 7, PMAT.amber, 1);
  }),

  seal: icon24((c) => {
    // Sleek glossy blubbery shoulders & flipper
    drawShoulders(c, 12, 14, 7.5, PMAT.steel, PMAT.bone);
    // Rounded seal head
    shadedOval(c, 12, 9.5, 5, 4.6, PMAT.steel);
    // Big glossy dark eyes
    c.rect(8, 8, 2, 2, PMAT.iron, 0);
    c.set(8, 8, PMAT.bone, 4);
    c.rect(14, 8, 2, 2, PMAT.iron, 0);
    c.set(14, 8, PMAT.bone, 4);
    // Plump whiskered muzzle & button nose
    shadedOval(c, 10.5, 12.5, 2.2, 1.6, PMAT.bone);
    shadedOval(c, 13.5, 12.5, 2.2, 1.6, PMAT.bone);
    c.rect(11, 11, 2, 1, PMAT.iron, 0);
    // Whiskers
    c.line(6, 12, 8, 12, PMAT.bone, 3);
    c.line(16, 12, 18, 12, PMAT.bone, 3);
  }),

  giant_spider: cluster24(
    [
      '........................',
      '........................',
      '....21............12....',
      '...21..............12...',
      '..21....22333322....12..',
      '.21....2332222211....12.',
      '.1....232222222111....1.',
      '..21..222222221111..12..',
      '.21..22222222211111..12.',
      '.1...222R2R22R2R111...1.',
      '..21.2222R2222R2111.12..',
      '.21..12222222221110..12.',
      '.1....122222221110....1.',
      '......11122221110.......',
      '....21..11111110..12....',
      '...21...1T1..1T1...12...',
      '..21....TT....TT....12..',
      '..1.....t......t.....1..',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.iron,
    BMAT,
  ),

  // =========================================================================
  // 28 MYTHICAL / MONSTERS / UNDEAD / ALIENS / AMBIENT
  // =========================================================================
  dragon: icon24((c) => {
    // Wing shoulders peeking behind
    c.stamp(2, 10, ['.21', '321', '210', '10.'], PMAT.crimson);
    c.stamp(19, 10, ['12.', '123', '012', '.01'], PMAT.crimson);
    // Scaled neck & golden plated chest
    drawShoulders(c, 11, 15, 7, PMAT.crimson, PMAT.gold);
    // Sweeping curved ivory horns
    drawHorn(c, 9, 6, 5, 4, 3, 2, PMAT.parchment);
    drawHorn(c, 13, 6, 16, 3, 18, 2, PMAT.parchment);
    // Fierce horned dragon head & snout
    shadedOval(c, 11.5, 9.5, 4.8, 4, PMAT.crimson);
    c.rect(12, 8, 8, 4, PMAT.crimson, 2);
    c.line(12, 8, 19, 8, PMAT.crimson, 3);
    // Jaw & fangs
    c.rect(12, 13, 7, 2, PMAT.crimson, 1);
    c.set(14, 12, PMAT.bone, 4);
    c.set(17, 12, PMAT.bone, 4);
    // Glowing amber eye & smoke nostril
    drawEye(c, 11, 8, PMAT.amber);
    c.set(19, 8, PMAT.amber, 4);
  }),

  unicorn: icon24((c) => {
    drawShoulders(c, 10, 15, 7, PMAT.bone);
    // Flowing silvery-arcane mane
    c.stamp(
      4,
      5,
      [
        '..43.',
        '.432.',
        '3321.',
        '3221.',
        '221..',
        '21...',
      ],
      PMAT.arcane,
    );
    // Spiraled golden horn jutting diagonally upward
    c.line(13, 6, 20, 1, PMAT.gold, 3);
    c.line(14, 6, 20, 2, PMAT.gold, 4);
    c.set(16, 4, PMAT.gold, 2);
    c.set(18, 2, PMAT.gold, 2);
    // Noble white horse head
    shadedOval(c, 11, 9, 4.2, 3.8, PMAT.bone);
    c.line(12, 8, 18, 12, PMAT.bone, 3);
    c.line(11, 9, 17, 13, PMAT.bone, 2);
    c.line(10, 10, 16, 14, PMAT.bone, 2);
    shadedOval(c, 17, 13, 2, 1.8, PMAT.parchment);
    drawEye(c, 11, 8, PMAT.ice);
  }),

  leviathan: icon24((c) => {
    // Abyssal sea-serpent neck & glowing ice frill collar
    drawShoulders(c, 11, 15, 7.5, PMAT.water, PMAT.ice);
    c.stamp(3, 7, ['43.', '321', '210', '321'], PMAT.ice);
    c.stamp(18, 7, ['.34', '123', '012', '123'], PMAT.ice);
    // Armored sea-serpent head
    shadedOval(c, 12, 9.5, 5.2, 4.4, PMAT.water);
    // Dorsal crest
    c.line(12, 2, 12, 6, PMAT.ice, 4);
    c.line(11, 4, 13, 4, PMAT.ice, 3);
    // Glowing abyssal eyes & fanged maw
    drawEye(c, 9, 8, PMAT.ice);
    drawEye(c, 15, 8, PMAT.ice);
    c.line(9, 13, 15, 13, PMAT.water, 0);
    c.set(10, 13, PMAT.bone, 4);
    c.set(12, 13, PMAT.bone, 4);
    c.set(14, 13, PMAT.bone, 4);
  }),

  phoenix: icon24((c) => {
    // Blazing wings & feathered chest
    drawShoulders(c, 12, 14, 8, PMAT.crimson, PMAT.amber);
    c.stamp(2, 9, ['43.', '322', '221', '110'], PMAT.amber);
    c.stamp(19, 9, ['.34', '223', '122', '011'], PMAT.amber);
    // Trailing golden fire-plume crest
    c.line(11, 6, 8, 2, PMAT.gold, 4);
    c.line(12, 6, 12, 1, PMAT.gold, 4);
    c.line(13, 6, 16, 2, PMAT.amber, 3);
    // Regal firebird head
    shadedOval(c, 12, 9.5, 4.2, 4, PMAT.amber);
    drawEye(c, 10, 8, PMAT.gold);
    drawEye(c, 14, 8, PMAT.gold);
    // Hooked golden beak
    c.stamp(10, 10, ['.44.', '3321', '.12.'], PMAT.gold);
  }),

  griffin: icon24((c) => {
    // Lion shoulders + folded feathered wing tips
    drawShoulders(c, 12, 15, 8, PMAT.fur);
    c.stamp(2, 11, ['332', '221', '110'], PMAT.wood);
    c.stamp(19, 11, ['233', '122', '011'], PMAT.wood);
    // Tufted eagle ears
    c.line(8, 6, 5, 3, PMAT.parchment, 3);
    c.line(16, 6, 19, 3, PMAT.parchment, 2);
    // Majestic white eagle head & feathered neck ruff
    shadedOval(c, 12, 9.5, 4.6, 4.5, PMAT.parchment);
    c.stamp(8, 13, ['32323232', '.212121.'], PMAT.parchment);
    drawEye(c, 9, 8, PMAT.amber);
    drawEye(c, 15, 8, PMAT.amber);
    // Sharp hooked golden beak
    c.stamp(10, 10, ['.44.', '3321', '.21.'], PMAT.gold);
  }),

  yeti: icon24((c) => {
    // Massive shaggy arctic shoulders
    drawShoulders(c, 12, 13, 9, PMAT.bone);
    c.line(5, 15, 7, 20, PMAT.ice, 2);
    c.line(19, 15, 17, 20, PMAT.ice, 2);
    // Curved ice-tinted horns
    drawHorn(c, 7, 6, 4, 4, 4, 2, PMAT.steel);
    drawHorn(c, 17, 6, 20, 4, 20, 2, PMAT.steel);
    // Shaggy snow-beast head
    shadedOval(c, 12, 9.5, 5.6, 5.2, PMAT.bone);
    // Shadowed steel face with glowing ice eyes & fangs
    shadedOval(c, 12, 10.5, 3.8, 3.2, PMAT.steel);
    drawEye(c, 10, 9, PMAT.ice);
    drawEye(c, 14, 9, PMAT.ice);
    c.line(10, 12, 14, 12, PMAT.iron, 0);
    c.set(10, 12, PMAT.bone, 4);
    c.set(14, 12, PMAT.bone, 4);
  }),

  golem: icon24((c) => {
    // Blocky chiseled boulder shoulders
    c.rect(3, 14, 18, 8, PMAT.stone, 2);
    c.rect(3, 14, 18, 2, PMAT.stone, 3);
    c.rect(17, 14, 4, 8, PMAT.stone, 1);
    c.line(6, 15, 6, 21, PMAT.stone, 0);
    c.line(17, 15, 17, 21, PMAT.stone, 0);
    // Mossy cracks
    c.stamp(4, 14, ['32.', '21.'], PMAT.moss);
    // Chiseled monolith head
    c.rect(7, 4, 10, 10, PMAT.stone, 2);
    c.rect(7, 4, 10, 2, PMAT.stone, 3);
    c.rect(15, 4, 2, 10, PMAT.stone, 1);
    // Glowing carved forehead rune & twin eyes
    c.stamp(11, 5, ['4', '3', '4'], PMAT.amber);
    c.rect(8, 9, 2, 2, PMAT.amber, 4);
    c.rect(14, 9, 2, 2, PMAT.amber, 4);
    c.line(9, 12, 15, 12, PMAT.stone, 0);
  }),

  kitsune: icon24((c) => {
    // Fan of mystic white-and-crimson fox tails rising behind shoulders!
    c.stamp(2, 6, ['..R.', '.RW.', 'RWW.', 'WWWw', 'WWw.'], PMAT.bone, BMAT);
    c.stamp(18, 6, ['.R..', '.WR.', '.WWR', 'wWWW', '.wWW'], PMAT.bone, BMAT);
    drawShoulders(c, 12, 15, 6.5, PMAT.parchment);
    // Tall pointed fox ears with crimson tips
    c.stamp(6, 2, ['..R.', '.rR.', '332.', '2210'], PMAT.parchment, BMAT);
    c.stamp(14, 2, ['.R..', '.Rr.', '.233', '0122'], PMAT.parchment, BMAT);
    // Sleek white fox face with mystic crimson markings
    shadedOval(c, 12, 10, 4.8, 4.2, PMAT.parchment);
    c.set(8, 10, PMAT.crimson, 3);
    c.set(16, 10, PMAT.crimson, 3);
    c.set(12, 7, PMAT.crimson, 3);
    drawEye(c, 10, 9, PMAT.amber);
    drawEye(c, 14, 9, PMAT.amber);
    c.set(12, 12, PMAT.iron, 0);
  }),

  hydra: icon24((c) => {
    // Thick scaly base
    drawShoulders(c, 12, 16, 7.5, PMAT.moss, PMAT.toxic);
    // Three necks rising to 3 snarling serpent heads
    c.line(8, 16, 5, 10, PMAT.moss, 2);
    c.line(9, 16, 6, 10, PMAT.moss, 3);
    c.line(12, 16, 12, 7, PMAT.moss, 3);
    c.line(13, 16, 13, 7, PMAT.moss, 2);
    c.line(16, 16, 19, 10, PMAT.moss, 2);
    c.line(15, 16, 18, 10, PMAT.moss, 1);
    // Left head
    shadedOval(c, 5.5, 9, 2.8, 2.4, PMAT.moss);
    c.set(5, 8, PMAT.amber, 4);
    c.line(2, 10, 4, 10, PMAT.crimson, 3);
    // Center high head
    shadedOval(c, 12, 5.5, 3.2, 2.6, PMAT.moss);
    c.set(11, 5, PMAT.amber, 4);
    c.set(13, 5, PMAT.amber, 4);
    c.set(12, 8, PMAT.crimson, 3);
    // Right head
    shadedOval(c, 18.5, 9, 2.8, 2.4, PMAT.moss);
    c.set(19, 8, PMAT.amber, 4);
    c.line(20, 10, 22, 10, PMAT.crimson, 3);
  }),

  minotaur: icon24((c) => {
    // Massive muscular bull-warrior shoulders + bronze strap
    drawShoulders(c, 12, 14, 8.5, PMAT.darkWood);
    c.line(6, 15, 16, 21, PMAT.bronze, 3);
    c.line(7, 15, 17, 21, PMAT.bronze, 2);
    // Huge sweeping ivory bull horns
    drawHorn(c, 7, 7, 3, 6, 2, 2, PMAT.parchment);
    drawHorn(c, 17, 7, 21, 6, 22, 2, PMAT.parchment);
    // Fierce bovine head
    shadedOval(c, 12, 10, 5, 5, PMAT.darkWood);
    drawEye(c, 9, 8, PMAT.crimson);
    drawEye(c, 15, 8, PMAT.crimson);
    // Broad snout + golden nose ring!
    shadedOval(c, 12, 13, 3.4, 2.2, PMAT.wood);
    c.stamp(10, 13, ['Y.Y', 'YgY'], PMAT.gold, BMAT);
  }),

  pegasus: icon24((c) => {
    // Twin angelic feathered wings unfurling behind shoulders
    c.stamp(1, 5, ['443.', '3322', '2211', '.211', '..10'], PMAT.bone);
    c.stamp(19, 5, ['.344', '2233', '1122', '112.', '01..'], PMAT.bone);
    drawShoulders(c, 12, 15, 6.5, PMAT.bone);
    // Ice-tinted flowing mane & ears
    c.line(9, 6, 9, 3, PMAT.bone, 3);
    c.line(14, 6, 14, 3, PMAT.bone, 2);
    c.line(8, 7, 7, 14, PMAT.ice, 3);
    // Graceful white steed head
    shadedOval(c, 12, 9.5, 4, 4.2, PMAT.bone);
    drawEye(c, 10, 8, PMAT.ice);
    drawEye(c, 14, 8, PMAT.ice);
    c.set(11, 12, PMAT.steel, 2);
    c.set(13, 12, PMAT.steel, 2);
  }),

  cerberus: icon24((c) => {
    // Spiked dark hellhound shoulders
    drawShoulders(c, 12, 15, 8, PMAT.iron);
    c.line(6, 15, 18, 15, PMAT.crimson, 2);
    c.set(8, 15, PMAT.steel, 4);
    c.set(12, 15, PMAT.steel, 4);
    c.set(16, 15, PMAT.steel, 4);
    // Left snarling hound head
    shadedOval(c, 5.5, 10, 3, 3, PMAT.iron);
    c.set(4, 6, PMAT.iron, 2);
    c.set(5, 9, PMAT.crimson, 4);
    c.set(4, 12, PMAT.bone, 4);
    // Right snarling hound head
    shadedOval(c, 18.5, 10, 3, 3, PMAT.iron);
    c.set(20, 6, PMAT.iron, 2);
    c.set(19, 9, PMAT.crimson, 4);
    c.set(20, 12, PMAT.bone, 4);
    // Center alpha hound head
    shadedOval(c, 12, 8, 3.8, 3.6, PMAT.iron);
    c.line(9, 5, 9, 3, PMAT.iron, 2);
    c.line(15, 5, 15, 3, PMAT.iron, 2);
    drawEye(c, 10, 7, PMAT.amber);
    drawEye(c, 14, 7, PMAT.amber);
    c.set(11, 10, PMAT.bone, 4);
    c.set(13, 10, PMAT.bone, 4);
  }),

  ent: icon24((c) => {
    // Gnarled bark torso & mossy beard
    drawShoulders(c, 12, 15, 7.5, PMAT.wood);
    c.line(9, 15, 9, 21, PMAT.darkWood, 1);
    c.line(15, 15, 15, 21, PMAT.darkWood, 1);
    // Branch antlers & lush leafy canopy crown
    c.line(9, 7, 5, 3, PMAT.wood, 2);
    c.line(15, 7, 19, 3, PMAT.wood, 2);
    shadedOval(c, 7, 4.5, 3.2, 2.4, PMAT.moss);
    shadedOval(c, 12, 3.5, 3.6, 2.4, PMAT.moss);
    shadedOval(c, 17, 4.5, 3.2, 2.4, PMAT.moss);
    // Hollow bark face with glowing amber eyes & mossy beard
    shadedOval(c, 12, 10.5, 4.5, 4.6, PMAT.wood);
    drawEye(c, 10, 9, PMAT.amber);
    drawEye(c, 14, 9, PMAT.amber);
    c.stamp(9, 13, ['3232323', '.21212.', '..121..'], PMAT.moss);
  }),

  basilisk: icon24((c) => {
    // Hooded cobra-like frilled neck
    drawShoulders(c, 12, 14, 8, PMAT.moss, PMAT.toxic);
    c.line(6, 15, 6, 20, PMAT.gold, 2);
    c.line(18, 15, 18, 20, PMAT.gold, 2);
    // Golden jagged crown-crest
    c.stamp(8, 2, ['4.4.4', '33433', '.222.'], PMAT.gold);
    // Venomous reptilian head
    shadedOval(c, 12, 9.5, 4.8, 4.2, PMAT.toxic);
    // Piercing glowing gold petrifying eyes
    drawEye(c, 9, 8, PMAT.gold);
    drawEye(c, 15, 8, PMAT.gold);
    // Dripping fangs & forked tongue
    c.line(9, 12, 15, 12, PMAT.moss, 0);
    c.set(10, 12, PMAT.bone, 4);
    c.set(14, 12, PMAT.bone, 4);
    c.line(12, 13, 12, 15, PMAT.crimson, 3);
  }),

  thunderbird: icon24((c) => {
    // Storm-blue spread shoulders with electric gold sparks
    drawShoulders(c, 12, 14, 8.5, PMAT.water);
    c.stamp(2, 11, ['43.', '321', '210'], PMAT.water);
    c.stamp(19, 11, ['.34', '123', '012'], PMAT.water);
    c.line(4, 15, 7, 18, PMAT.gold, 4);
    c.line(20, 15, 17, 18, PMAT.gold, 4);
    // Jagged golden lightning crest
    c.line(10, 6, 7, 2, PMAT.gold, 4);
    c.line(12, 5, 12, 1, PMAT.ice, 4);
    c.line(14, 6, 17, 2, PMAT.gold, 4);
    // Fierce storm-eagle head & hooked beak
    shadedOval(c, 12, 9.5, 4.4, 4, PMAT.water);
    drawEye(c, 10, 8, PMAT.ice);
    drawEye(c, 14, 8, PMAT.ice);
    c.stamp(10, 10, ['.44.', '3321', '.21.'], PMAT.gold);
  }),

  kraken: icon24((c) => {
    // Curling tentacles rising up on both sides
    c.line(5, 20, 3, 12, PMAT.crimson, 2);
    c.line(3, 12, 5, 7, PMAT.crimson, 3);
    c.set(4, 10, PMAT.rose, 3);
    c.set(4, 14, PMAT.rose, 3);
    c.line(19, 20, 21, 12, PMAT.crimson, 1);
    c.line(21, 12, 19, 7, PMAT.crimson, 2);
    c.set(20, 10, PMAT.rose, 2);
    c.set(20, 14, PMAT.rose, 2);
    // Lower tentacle crown
    drawShoulders(c, 12, 15, 6.5, PMAT.crimson);
    // Bulbous ribbed mantle head
    shadedOval(c, 12, 8.5, 5.4, 6, PMAT.crimson);
    c.line(12, 3, 12, 9, PMAT.crimson, 3);
    // Angry golden slit eyes
    c.rect(8, 10, 2, 2, PMAT.gold, 4);
    c.set(9, 11, PMAT.iron, 0);
    c.rect(14, 10, 2, 2, PMAT.gold, 4);
    c.set(14, 11, PMAT.iron, 0);
  }),

  manticore: icon24((c) => {
    // Barbed scorpion tail arching over right shoulder!
    c.line(18, 18, 21, 12, PMAT.crimson, 2);
    c.line(21, 12, 20, 6, PMAT.crimson, 3);
    c.line(20, 6, 17, 4, PMAT.crimson, 3);
    c.set(16, 4, PMAT.toxic, 4);
    // Shaggy mane & beast shoulders
    drawShoulders(c, 10, 15, 7, PMAT.bronze);
    shadedOval(c, 10, 10.5, 6.4, 6, PMAT.darkWood);
    // Curved devil horns
    drawHorn(c, 7, 6, 5, 4, 5, 2, PMAT.bone);
    drawHorn(c, 13, 6, 15, 4, 15, 2, PMAT.bone);
    // Fierce horned lion-monster face
    shadedOval(c, 10, 10.5, 4.4, 4.2, PMAT.bronze);
    drawEye(c, 8, 9, PMAT.amber);
    drawEye(c, 12, 9, PMAT.amber);
    c.line(8, 12, 12, 12, PMAT.iron, 0);
    c.set(8, 12, PMAT.bone, 4);
    c.set(10, 12, PMAT.bone, 4);
    c.set(12, 12, PMAT.bone, 4);
  }),

  gargoyle: icon24((c) => {
    // Jagged gothic stone bat-wings rising behind
    c.stamp(1, 3, ['32..', '321.', '2210', '210.', '110.', '.10.'], PMAT.stone);
    c.stamp(19, 3, ['..23', '.123', '0122', '.012', '.011', '.01.'], PMAT.stone);
    // Hunched granite shoulders
    drawShoulders(c, 12, 14, 7.5, PMAT.stone);
    // Sharp stone horns
    drawHorn(c, 9, 6, 7, 4, 6, 2, PMAT.stone);
    drawHorn(c, 15, 6, 17, 4, 18, 2, PMAT.stone);
    // Fierce carved granite head with glowing amber eyes
    shadedOval(c, 12, 10, 4.6, 4.4, PMAT.stone);
    drawEye(c, 10, 9, PMAT.amber);
    drawEye(c, 14, 9, PMAT.amber);
    c.line(10, 12, 14, 12, PMAT.stone, 0);
    c.set(10, 12, PMAT.bone, 3);
    c.set(14, 12, PMAT.bone, 3);
  }),

  skeleton: icon24((c) => {
    // Tattered iron pauldrons & exposed ribcage collar
    drawShoulders(c, 10, 15, 7, PMAT.iron);
    c.stamp(7, 16, ['333.333', '.22.22.', '333.333', '.11.11.'], PMAT.bone);
    // Iconic grinning skull
    shadedOval(c, 10, 9, 4.8, 4.4, PMAT.bone);
    c.rect(8, 12, 5, 3, PMAT.bone, 2);
    // Deep hollow eye sockets with ghostly glint
    c.rect(7, 8, 2, 2, PMAT.iron, 0);
    c.rect(11, 8, 2, 2, PMAT.iron, 0);
    c.set(8, 9, PMAT.ice, 4);
    c.set(12, 9, PMAT.ice, 4);
    // Nasal cavity & grinning teeth
    c.set(10, 11, PMAT.iron, 0);
    c.line(8, 13, 12, 13, PMAT.iron, 0);
    c.set(9, 13, PMAT.bone, 4);
    c.set(11, 13, PMAT.bone, 4);
    // Rusty blade beside right shoulder
    c.stamp(18, 4, ['.S.', 'Ssm', 'Ssm', 'smM', 'smM', 'smM', 'dDd', '.b.'], PMAT.steel, BMAT);
  }),

  alien_trooper: icon24((c) => {
    // Sleek dark sci-fi armor chest with glowing toxic core
    drawShoulders(c, 10, 15, 7, PMAT.iron, PMAT.arcane);
    c.rect(9, 17, 3, 2, PMAT.toxic, 4);
    // Oversized bulbous alien head
    shadedOval(c, 10, 8.5, 5.2, 4.6, PMAT.toxic);
    shadedOval(c, 10, 11.5, 3.2, 2.8, PMAT.toxic, false);
    // Huge slanted glossy black almond eyes
    c.stamp(6, 8, ['xx.', 'xWx', '.xx'], PMAT.iron, BMAT);
    c.stamp(11, 8, ['.xx', 'xWx', 'xx.'], PMAT.iron, BMAT);
    // Plasma rifle rising beside right shoulder
    c.stamp(18, 4, ['TT.', 'dSd', 'dTd', 'dSd', 'dmd', 'dmd', 'ddd'], PMAT.iron, BMAT);
  }),

  alien_ufo: cluster24(
    [
      '........................',
      '........................',
      '........................',
      '.........CCCC...........',
      '.......CCccccCC.........',
      '......CccTttccCC........',
      '.....CccTxtxTccC........',
      '.....CccTTTTtccC........',
      '....SSSSsssssSMMM.......',
      '..SSSSssssssssssMMM.....',
      '.SSssTssFssTssFssMMM....',
      '.SmmmmmmmmmmmmmmmmMM....',
      '..MMMMmmmmmmmmmmMMM.....',
      '....MMMMMMMMMMMMM.......',
      '.......ccCCcc...........',
      '......ccCCCCcc..........',
      '.....cc..CC..cc.........',
      '....c....cc....c........',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.steel,
    BMAT,
  ),

  alien_walker: icon24((c) => {
    // Articulated tripod mechanical legs descending from armored pod
    c.line(8, 13, 3, 21, PMAT.iron, 2);
    c.line(9, 13, 4, 21, PMAT.steel, 3);
    c.line(16, 13, 21, 21, PMAT.iron, 1);
    c.line(15, 13, 20, 21, PMAT.steel, 2);
    c.line(12, 14, 12, 21, PMAT.iron, 1);
    // Armored biomechanical war-pod head
    shadedOval(c, 12, 9, 6.2, 5.4, PMAT.iron);
    c.rect(7, 4, 10, 2, PMAT.steel, 3);
    // Glowing crimson cyclops optic lens
    shadedOval(c, 12, 9, 2.8, 2.4, PMAT.crimson);
    c.set(11, 8, PMAT.amber, 4);
    c.set(12, 9, PMAT.crimson, 4);
    // Twin side plasma barrels
    c.rect(4, 10, 2, 3, PMAT.arcane, 3);
    c.rect(18, 10, 2, 3, PMAT.arcane, 3);
  }),

  firefly: icon24((c) => {
    // Gossamer translucent wings spread behind shoulders
    shadedOval(c, 6, 11, 4.2, 2.6, PMAT.ice);
    shadedOval(c, 18, 11, 4.2, 2.6, PMAT.ice);
    // Glowing warm amber lantern thorax/belly
    shadedOval(c, 12, 16.5, 4.6, 4.6, PMAT.amber);
    shadedOval(c, 12, 16.5, 2.8, 2.8, PMAT.gold);
    c.set(11, 15, PMAT.gold, 4);
    // Cute dark beetle head + antennae
    shadedOval(c, 12, 9, 3.6, 3.2, PMAT.darkWood);
    c.line(10, 6, 7, 3, PMAT.amber, 3);
    c.set(7, 3, PMAT.gold, 4);
    c.line(14, 6, 17, 3, PMAT.amber, 3);
    c.set(17, 3, PMAT.gold, 4);
    drawEye(c, 10, 9, PMAT.gold);
    drawEye(c, 14, 9, PMAT.gold);
  }),

  glow_moth: icon24((c) => {
    // Huge ornate luminous wings with glowing gold eyespots
    shadedOval(c, 6, 11, 4.8, 6.2, PMAT.ice);
    shadedOval(c, 18, 11, 4.8, 6.2, PMAT.ice);
    c.ellipse(6, 10, 2.2, 2.2, PMAT.arcane, 3);
    c.set(6, 10, PMAT.gold, 4);
    c.ellipse(18, 10, 2.2, 2.2, PMAT.arcane, 3);
    c.set(18, 10, PMAT.gold, 4);
    // Fuzzy parchment moth thorax & head
    shadedOval(c, 12, 13, 3, 5.5, PMAT.parchment);
    shadedOval(c, 12, 7.5, 2.8, 2.6, PMAT.parchment);
    // Feathery gold antennae
    c.line(10, 5, 7, 2, PMAT.gold, 4);
    c.line(14, 5, 17, 2, PMAT.gold, 4);
    drawEye(c, 11, 7);
    drawEye(c, 13, 7);
  }),

  lantern_jelly: cluster24(
    [
      '........................',
      '........................',
      '........CCCCCC..........',
      '......CCccccccCC........',
      '.....CcPPccccPPcC.......',
      '....CcPccYYYYccPcC......',
      '...CcPccYFFFFYccPcC.....',
      '...CcccYFFYYFFYcccC.....',
      '...CcccYFFYYFFYcccC.....',
      '...CccPPYYYYYYPPccC.....',
      '....CCcPPPPPPPPcCC......',
      '.....cCcPccccPcCc.......',
      '......c.P.cc.P.c........',
      '.....c..p.cc.p..c.......',
      '.....c..p.cc.p..c.......',
      '......c.p..c.p.c........',
      '......c.z..c.z.c........',
      '.....c..z..c..z.c.......',
      '.....c..z.....z.........',
      '........z...............',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.ice,
    BMAT,
  ),

  fairy: icon24((c) => {
    // Shimmering translucent butterfly wings unfurling behind shoulders
    shadedOval(c, 5, 10, 3.8, 4.4, PMAT.ice);
    shadedOval(c, 19, 10, 3.8, 4.4, PMAT.ice);
    shadedOval(c, 6, 16, 2.6, 2.6, PMAT.rose);
    shadedOval(c, 18, 16, 2.6, 2.6, PMAT.rose);
    // Petal bodice shoulders
    drawShoulders(c, 12, 15, 5.5, PMAT.moss, PMAT.rose);
    // Expressive fairy face & golden hair with floral crown
    shadedOval(c, 12, 10, 4, 4, PMAT.skin);
    c.stamp(8, 5, ['.34332.', '3322211', '21...11'], PMAT.gold);
    c.set(10, 5, PMAT.rose, 4);
    c.set(12, 4, PMAT.moss, 4);
    c.set(14, 5, PMAT.rose, 4);
    drawEye(c, 10, 9);
    drawEye(c, 14, 9);
  }),

  fae: icon24((c) => {
    // Mystical leafy cloak shoulders
    drawShoulders(c, 12, 15, 6.5, PMAT.moss, PMAT.arcane);
    // Delicate golden stag-twig antlers
    c.line(9, 6, 6, 2, PMAT.gold, 3);
    c.line(7, 4, 5, 4, PMAT.gold, 4);
    c.line(15, 6, 18, 2, PMAT.gold, 3);
    c.line(17, 4, 19, 4, PMAT.gold, 4);
    // Ethereal pale face & flowing arcane hair
    shadedOval(c, 12, 10, 4.2, 4.2, PMAT.bone);
    c.stamp(7, 5, ['.3433322.', '332222111', '21.....11', '1.......1'], PMAT.arcane);
    // Glowing toxic forest-spirit eyes & floating wisps
    drawEye(c, 10, 9, PMAT.toxic);
    drawEye(c, 14, 9, PMAT.toxic);
    c.set(3, 9, PMAT.toxic, 4);
    c.set(20, 11, PMAT.toxic, 4);
  }),

  will_o_wisp: cluster24(
    [
      '........................',
      '...........C............',
      '..........CC............',
      '.........CccC...........',
      '........CcTTcC..........',
      '.......CcTTTTcC.........',
      '......CcTTCCCTcC........',
      '.....CcTTCCCCCTcC.......',
      '....CcTTCCWWCCCTcC......',
      '....CcTTCCWWCCCTcC......',
      '....CcTCxWWWWxCTcC......',
      '....CcTCxWWWWxCTcC......',
      '....CcTTCCWWCCCTcC......',
      '.....CcTTCCCCCTcC.......',
      '......CcTTCCCTcC........',
      '.......CcTTTTcC....C....',
      '...C....CcTTcC..........',
      '.........CccC...........',
      '..........cc............',
      '...........c............',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    PMAT.ice,
    BMAT,
  ),
};
