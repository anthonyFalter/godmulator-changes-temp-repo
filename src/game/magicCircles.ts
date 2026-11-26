import * as THREE from 'three';

export type MagicCircleTheme =
  | 'arcane'
  | 'insight'
  | 'blessing'
  | 'golden'
  | 'shield'
  | 'wrath'
  | 'nature'
  | 'frost';

interface ThemePalette {
  core: string;
  primary: string;
  secondary: string;
  accentA: string;
  accentB: string;
  accentC: string;
  glow: string;
  aura: string;
}

const THEME_PALETTES: Record<MagicCircleTheme, ThemePalette> = {
  arcane: {
    core: '#f0f9ff',
    primary: '#38bdf8',
    secondary: '#c084fc',
    accentA: '#fde047',
    accentB: '#4ade80',
    accentC: '#fb923c',
    glow: '#a855f7',
    aura: '#2e1065',
  },
  insight: {
    core: '#f0fdfa',
    primary: '#38bdf8',
    secondary: '#22d3ee',
    accentA: '#fef08a',
    accentB: '#c084fc',
    accentC: '#5eead4',
    glow: '#06b6d4',
    aura: '#0c4a6e',
  },
  blessing: {
    core: '#fefce8',
    primary: '#fde047',
    secondary: '#80ed99',
    accentA: '#fff3b0',
    accentB: '#38bdf8',
    accentC: '#4ade80',
    glow: '#f59e0b',
    aura: '#713f12',
  },
  golden: {
    core: '#fffbeb',
    primary: '#ffd166',
    secondary: '#fb923c',
    accentA: '#fef08a',
    accentB: '#38bdf8',
    accentC: '#fb7185',
    glow: '#f59e0b',
    aura: '#78350f',
  },
  shield: {
    core: '#f0fdfa',
    primary: '#72efdd',
    secondary: '#38bdf8',
    accentA: '#e0fbfc',
    accentB: '#c084fc',
    accentC: '#fde047',
    glow: '#2dd4bf',
    aura: '#115e59',
  },
  wrath: {
    core: '#fff7ed',
    primary: '#ff4d4f',
    secondary: '#fb923c',
    accentA: '#fde047',
    accentB: '#fb7185',
    accentC: '#38bdf8',
    glow: '#ef4444',
    aura: '#7f1d1d',
  },
  nature: {
    core: '#ecfdf5',
    primary: '#34d399',
    secondary: '#80ed99',
    accentA: '#5eead4',
    accentB: '#fde047',
    accentC: '#a3e635',
    glow: '#10b981',
    aura: '#064e3b',
  },
  frost: {
    core: '#f0f9ff',
    primary: '#67e8f9',
    secondary: '#38bdf8',
    accentA: '#e0f2fe',
    accentB: '#818cf8',
    accentC: '#a5f3fc',
    glow: '#0ea5e9',
    aura: '#1e3a8a',
  },
};

export const MAGIC_CIRCLE_VARIANTS = 2;

// Vector stroke definitions on normalized [-1, 1] x [-1, 1] rune cell
// Inspired by Elder Futhark + arcane geometric sigils
type GlyphStroke = Array<[number, number]>;
const RUNIC_GLYPHS: GlyphStroke[][] = [
  // 0: Ansuz-like spear rune
  [[[0, -0.85], [0, 0.85]], [[0, -0.75], [0.55, -0.25]], [[0, -0.2], [0.55, 0.25]]],
  // 1: Algiz forked trident
  [[[0, -0.85], [0, 0.85]], [[-0.58, -0.65], [0, -0.05], [0.58, -0.65]], [[-0.3, 0.5], [0.3, 0.5]]],
  // 2: Othala diamond-loop
  [[[0, -0.85], [-0.55, -0.15], [0.55, 0.75]], [[0, -0.85], [0.55, -0.15], [-0.55, 0.75]]],
  // 3: Sowilo lightning rune
  [[[0.45, -0.8], [-0.4, -0.05], [0.4, 0.05], [-0.45, 0.8]], [[-0.2, -0.35], [0.25, -0.35]]],
  // 4: Tiwaz winged spear
  [[[0, -0.88], [0, 0.88]], [[-0.6, -0.25], [0, -0.88], [0.6, -0.25]], [[-0.35, 0.45], [0.35, 0.45]]],
  // 5: Dagaz hourglass
  [[[-0.55, -0.75], [-0.55, 0.75], [0.55, -0.75], [0.55, 0.75], [-0.55, -0.75]]],
  // 6: Berkano twin-crescent
  [[[-0.35, -0.85], [-0.35, 0.85]], [[-0.35, -0.85], [0.45, -0.45], [-0.35, 0], [0.45, 0.45], [-0.35, 0.85]]],
  // 7: Hagalaz star stave
  [[[-0.5, -0.85], [-0.5, 0.85]], [[0.5, -0.85], [0.5, 0.85]], [[-0.5, -0.35], [0.5, 0.35]], [[-0.5, 0.35], [0.5, -0.35]]],
  // 8: Raido arcane hook
  [[[-0.35, -0.85], [-0.35, 0.85]], [[-0.35, -0.8], [0.5, -0.35], [-0.35, 0.1], [0.55, 0.85]]],
  // 9: Eihwaz Y-cross
  [[[0, -0.85], [0, 0.85]], [[-0.55, -0.55], [0, 0], [0.55, -0.55]], [[-0.5, 0.5], [0.5, 0.5]]],
  // 10: Fehu dual-horn
  [[[-0.4, -0.85], [-0.4, 0.85]], [[-0.4, -0.35], [0.55, -0.85]], [[-0.4, 0.2], [0.55, -0.3]]],
  // 11: Thurisaz thorn-diamond
  [[[-0.35, -0.88], [-0.35, 0.88]], [[-0.35, -0.4], [0.55, 0], [-0.35, 0.4]], [[-0.6, 0], [0.6, 0]]],
  // 12: Ingwaz double-crest
  [[[-0.45, -0.4], [0, -0.88], [0.45, -0.4], [0, 0.08], [-0.45, -0.4]], [[-0.45, 0.4], [0, -0.08], [0.45, 0.4], [0, 0.88], [-0.45, 0.4]]],
  // 13: Solar spiral-cross
  [[[-0.65, 0], [0.65, 0]], [[0, -0.85], [0, 0.85]], [[-0.4, -0.55], [0.4, -0.55]], [[-0.4, 0.55], [0.4, 0.55]]],
  // 14: Celestial eye-triangle
  [[[0, -0.85], [-0.68, 0.65], [0.68, 0.65], [0, -0.85]], [[0, -0.3], [0, 0.85]]],
  // 15: Chrono crescent-hook
  [[[0.45, -0.8], [-0.45, -0.5], [-0.55, 0.15], [0.45, 0.45], [-0.25, 0.85]], [[-0.65, -0.05], [0.65, -0.05]]],
  // 16: Star-compass sigil
  [[[0, -0.88], [0.22, -0.22], [0.85, 0], [0.22, 0.22], [0, 0.88], [-0.22, 0.22], [-0.85, 0], [-0.22, -0.22], [0, -0.88]]],
  // 17: Crown-shield crest
  [[[-0.6, -0.65], [0, -0.88], [0.6, -0.65], [0.4, 0.45], [0, 0.88], [-0.4, 0.45], [-0.6, -0.65]], [[0, -0.55], [0, 0.55]]],
  // 18: Twin-chevron bindrune
  [[[-0.55, -0.2], [0, -0.85], [0.55, -0.2]], [[-0.55, 0.45], [0, -0.2], [0.55, 0.45]], [[0, -0.85], [0, 0.85]]],
  // 19: Hammer-T sigil (like bottom-left glyph in ref)
  [[[-0.65, -0.65], [0.65, -0.35]], [[0, -0.5], [0, 0.85]], [[-0.32, 0.85], [0.32, 0.85]]],
  // 20: Triple-bar ward
  [[[0, -0.88], [0, 0.88]], [[-0.58, -0.52], [0.58, -0.22]], [[-0.52, -0.05], [0.52, 0.22]], [[-0.4, 0.48], [0.4, 0.68]]],
  // 21: Serpent S-rune
  [[[0.45, -0.8], [-0.35, -0.45], [0.4, 0], [-0.4, 0.45], [0.35, 0.82]], [[0, -0.85], [0, 0.85]]],
  // 22: Orb-bindrune
  [[[-0.45, -0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, 0.45], [-0.45, -0.45]], [[0, -0.88], [0, 0.88]]],
  // 23: Arcane arrow-hook
  [[[-0.45, 0.7], [0, -0.88], [0.45, 0.7]], [[-0.62, 0.1], [0.62, -0.18]]],
];

export const RUNIC_GLYPH_COUNT = RUNIC_GLYPHS.length;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawRuneGlyph(
  ctx: CanvasRenderingContext2D,
  glyphIdx: number,
  cx: number,
  cy: number,
  radius: number,
  angle: number,
  color: string,
  auraColor: string,
  coreColor: string,
  lineWidth: number,
) {
  const strokes = RUNIC_GLYPHS[((glyphIdx % RUNIC_GLYPHS.length) + RUNIC_GLYPHS.length) % RUNIC_GLYPHS.length];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const tracePath = () => {
    ctx.beginPath();
    for (const poly of strokes) {
      for (let i = 0; i < poly.length; i++) {
        const px = poly[i][0] * radius;
        const py = poly[i][1] * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    }
  };

  // Pass 1: Soft deep theme-colored halo for clear separation over sunlit grass, sand, and water
  ctx.shadowColor = auraColor;
  ctx.shadowBlur = Math.max(1.5, radius * 0.22);
  ctx.strokeStyle = hexToRgba(auraColor, 0.58);
  ctx.lineWidth = lineWidth + 2.0;
  tracePath();
  ctx.stroke();

  // Pass 2: Luminous colored neon-energy glow
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.max(3.5, radius * 0.45);
  ctx.lineWidth = lineWidth + 0.35;
  tracePath();
  ctx.stroke();

  // Pass 3: Hot incandescent inner filament (magical light core without blurring away glyph shape)
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = coreColor;
  ctx.shadowBlur = 1.5;
  ctx.strokeStyle = coreColor;
  ctx.globalAlpha *= 0.64;
  ctx.lineWidth = Math.max(0.95, lineWidth * 0.44);
  tracePath();
  ctx.stroke();
  ctx.restore();
}

function renderMagicCircleTexture(theme: MagicCircleTheme, variant: number): THREE.CanvasTexture {
  const logicalSize = 512;
  const half = logicalSize / 2;
  const pixelSize = 256;
  const pal = THEME_PALETTES[theme];
  const themeHash = theme.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7);
  const rng = mulberry32(themeHash * 101 + variant * 7919 + 1337);

  const canvas = document.createElement('canvas');
  canvas.width = pixelSize;
  canvas.height = pixelSize;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, pixelSize, pixelSize);
  // Render in 512x512 logical coordinates onto a 256x256 canvas (~8x faster CPU shadowBlur with identical layout)
  ctx.scale(0.5, 0.5);

  // 1. Ethereal colored mana aura (gentle tinted luminosity — radiant without whiteout fog)
  const bgGrad = ctx.createRadialGradient(half, half, 12, half, half, half * 0.94);
  bgGrad.addColorStop(0, hexToRgba(pal.glow, 0.24));
  bgGrad.addColorStop(0.42, hexToRgba(pal.aura, 0.18));
  bgGrad.addColorStop(0.66, hexToRgba(pal.glow, 0.22));
  bgGrad.addColorStop(0.84, hexToRgba(pal.primary, 0.12));
  bgGrad.addColorStop(1, hexToRgba(pal.glow, 0));
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.arc(half, half, half * 0.94, 0, Math.PI * 2);
  ctx.fill();

  // Soft translucent colored mana track behind the orbiting rune band (keeps runes glowing & readable)
  ctx.save();
  ctx.translate(half, half);
  ctx.strokeStyle = hexToRgba(pal.aura, 0.34);
  ctx.shadowColor = pal.glow;
  ctx.shadowBlur = 7;
  ctx.lineWidth = 34;
  ctx.beginPath();
  ctx.arc(0, 0, 151, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Polar grid spokes + inner rings with luminous neon-tube glow
  ctx.save();
  ctx.translate(half, half);
  const spokeCount = 16;
  for (let i = 0; i < spokeCount; i++) {
    const a = (i / spokeCount) * Math.PI * 2;
    const isMajor = i % 2 === 0;
    const endR = isMajor ? 222 : 148;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
    ctx.lineTo(Math.cos(a) * endR, Math.sin(a) * endR);

    ctx.strokeStyle = hexToRgba(pal.aura, 0.42);
    ctx.globalAlpha = isMajor ? 0.65 : 0.35;
    ctx.lineWidth = isMajor ? 3.0 : 1.8;
    ctx.shadowBlur = 0;
    ctx.stroke();

    ctx.strokeStyle = isMajor ? pal.primary : pal.secondary;
    ctx.shadowColor = isMajor ? pal.glow : pal.secondary;
    ctx.shadowBlur = isMajor ? 3.5 : 1.5;
    ctx.globalAlpha = isMajor ? 0.85 : 0.48;
    ctx.lineWidth = isMajor ? 1.55 : 1.0;
    ctx.stroke();
  }

  // Inner polar grid circles
  for (const rr of [26, 46, 70, 108, 134, 168, 198]) {
    const isMain = rr === 168 || rr === 134 || rr === 198;
    const ringCol = rr === 168 ? pal.secondary : rr === 198 ? pal.accentA : pal.primary;
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);

    ctx.strokeStyle = hexToRgba(pal.aura, 0.56);
    ctx.globalAlpha = isMain ? 0.72 : 0.42;
    ctx.lineWidth = isMain ? 5.2 : 2.8;
    ctx.shadowColor = pal.aura;
    ctx.shadowBlur = isMain ? 2 : 0;
    ctx.stroke();

    ctx.strokeStyle = ringCol;
    ctx.shadowColor = ringCol;
    ctx.shadowBlur = isMain ? 5.5 : 2.5;
    ctx.globalAlpha = isMain ? 0.96 : 0.72;
    ctx.lineWidth = isMain ? 2.8 : 1.5;
    ctx.stroke();

    if (isMain) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = pal.core;
      ctx.shadowColor = pal.core;
      ctx.shadowBlur = 2;
      ctx.globalAlpha = 0.62;
      ctx.lineWidth = 1.15;
      ctx.stroke();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // 2. Luminous sacred geometric octagram / hexagram star polygons
  const drawPolygon = (sides: number, r: number, rotOffset: number, col: string, alpha: number, lw: number) => {
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(rotOffset);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.strokeStyle = hexToRgba(pal.aura, 0.55);
    ctx.globalAlpha = alpha * 0.75;
    ctx.lineWidth = lw + 2.2;
    ctx.shadowBlur = 0;
    ctx.stroke();

    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 5;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lw;
    ctx.stroke();

    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = pal.core;
    ctx.shadowColor = pal.core;
    ctx.shadowBlur = 1.5;
    ctx.globalAlpha = alpha * 0.55;
    ctx.lineWidth = Math.max(0.95, lw * 0.42);
    ctx.stroke();
    ctx.restore();
  };

  drawPolygon(4, 134, 0, pal.primary, 0.96, 2.45);
  drawPolygon(4, 134, Math.PI / 4, pal.secondary, 0.96, 2.45);
  drawPolygon(6, 108, Math.PI / 6, pal.accentA, 0.88, 1.95);

  // 3. Outer precision tick-gauge ring & glowing segmented arc brackets
  ctx.save();
  ctx.translate(half, half);
  const tickCount = 72;
  for (let i = 0; i < tickCount; i++) {
    const a = (i / tickCount) * Math.PI * 2;
    const major = i % 9 === 0;
    const mid = i % 3 === 0;
    const r0 = major ? 173 : mid ? 178 : 181;
    const r1 = major ? 196 : mid ? 190 : 187;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);

    ctx.strokeStyle = hexToRgba(pal.aura, 0.48);
    ctx.globalAlpha = major ? 0.7 : 0.36;
    ctx.lineWidth = major ? 4.0 : 2.2;
    ctx.shadowBlur = 0;
    ctx.stroke();

    const tickCol = major ? pal.accentA : pal.primary;
    ctx.strokeStyle = tickCol;
    ctx.shadowColor = tickCol;
    ctx.shadowBlur = major ? 4 : 1.5;
    ctx.globalAlpha = major ? 0.98 : mid ? 0.82 : 0.58;
    ctx.lineWidth = major ? 2.4 : 1.25;
    ctx.stroke();
  }
  // Segmented outer arc plates
  for (let i = 0; i < 8; i++) {
    const aStart = (i / 8) * Math.PI * 2 + 0.08;
    const aEnd = ((i + 1) / 8) * Math.PI * 2 - 0.08;
    const arcCol = i % 2 === 0 ? pal.primary : pal.secondary;
    ctx.beginPath();
    ctx.arc(0, 0, 198, aStart, aEnd);

    ctx.strokeStyle = hexToRgba(pal.aura, 0.58);
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 6.2;
    ctx.shadowBlur = 0;
    ctx.stroke();

    ctx.strokeStyle = arcCol;
    ctx.shadowColor = arcCol;
    ctx.shadowBlur = 6;
    ctx.globalAlpha = 0.98;
    ctx.lineWidth = 3.6;
    ctx.stroke();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = pal.core;
    ctx.shadowColor = pal.core;
    ctx.shadowBlur = 2;
    ctx.globalAlpha = 0.58;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // 4. Inscribed Mystic/Runic Letter Band (24 glowing runes orbiting between r=138..164)
  const bandRuneCount = 24;
  for (let i = 0; i < bandRuneCount; i++) {
    const a = (i / bandRuneCount) * Math.PI * 2;
    const r = 151;
    const gx = half + Math.cos(a) * r;
    const gy = half + Math.sin(a) * r;
    const gIdx = Math.floor(rng() * RUNIC_GLYPHS.length);
    const glyphCol = i % 3 === 0 ? pal.accentA : i % 3 === 1 ? pal.secondary : pal.primary;
    ctx.save();
    ctx.globalAlpha = 0.98;
    drawRuneGlyph(ctx, gIdx, gx, gy, 9.2, a + Math.PI / 2, glyphCol, pal.aura, pal.core, 2.2);
    ctx.restore();
  }

  // 5. 8 Luminous Circular Rune Medallions seated on the main perimeter (r=168)
  const accentOrder = [pal.primary, pal.accentA, pal.accentC, pal.accentB];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const mx = half + Math.cos(a) * 168;
    const my = half + Math.sin(a) * 168;
    const nodeCol = accentOrder[(i + variant) % accentOrder.length];

    ctx.save();
    // Glowing mana orb fill inside medallion (translucent deep theme tint + inner radiance)
    const medGrad = ctx.createRadialGradient(mx, my, 2, mx, my, 19);
    medGrad.addColorStop(0, hexToRgba(nodeCol, 0.34));
    medGrad.addColorStop(0.65, hexToRgba(pal.aura, 0.62));
    medGrad.addColorStop(1, hexToRgba(pal.aura, 0.72));
    ctx.beginPath();
    ctx.arc(mx, my, 18, 0, Math.PI * 2);
    ctx.fillStyle = medGrad;
    ctx.fill();

    ctx.lineWidth = 3.0;
    ctx.strokeStyle = nodeCol;
    ctx.shadowColor = nodeCol;
    ctx.shadowBlur = 6;
    ctx.stroke();

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = pal.core;
    ctx.shadowColor = pal.core;
    ctx.shadowBlur = 2;
    ctx.globalAlpha = 0.65;
    ctx.stroke();
    ctx.restore();

    const gIdx = Math.floor(rng() * RUNIC_GLYPHS.length);
    drawRuneGlyph(ctx, gIdx, mx, my, 10.2, a + Math.PI / 2, nodeCol, pal.aura, pal.core, 2.35);
  }

  // 6. 8 Outer Cardinal/Ordinal Floating Runic Sigils & Energy Rays (r=226)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2 + Math.PI / 8;
    const sx = half + Math.cos(a) * 226;
    const sy = half + Math.sin(a) * 226;
    const sigilCol = accentOrder[(i + 1 + variant) % accentOrder.length];

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(half + Math.cos(a) * 198, half + Math.sin(a) * 198);
    ctx.lineTo(half + Math.cos(a) * 212, half + Math.sin(a) * 212);
    ctx.strokeStyle = hexToRgba(pal.aura, 0.55);
    ctx.lineWidth = 4.0;
    ctx.stroke();

    ctx.strokeStyle = sigilCol;
    ctx.shadowColor = sigilCol;
    ctx.shadowBlur = 5;
    ctx.globalAlpha = 0.96;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();

    const gIdx = Math.floor(rng() * RUNIC_GLYPHS.length);
    drawRuneGlyph(ctx, gIdx, sx, sy, 13.8, a + Math.PI / 2, sigilCol, pal.aura, pal.core, 2.85);
  }

  // 7. Delicate Arcane Starlight Sparkles at Octagram Vertices (r=134)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const px = half + Math.cos(a) * 134;
    const py = half + Math.sin(a) * 134;
    const spCol = i % 2 === 0 ? pal.primary : pal.accentA;
    const spGrad = ctx.createRadialGradient(px, py, 0.5, px, py, 10);
    spGrad.addColorStop(0, pal.core);
    spGrad.addColorStop(0.4, hexToRgba(spCol, 0.72));
    spGrad.addColorStop(1, hexToRgba(spCol, 0));
    ctx.fillStyle = spGrad;
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 8. Radiant Glowing Star-Core Emblem at Center (magical luminous heart without blowing out the runes)
  ctx.save();
  ctx.translate(half, half);
  const coreHalo = ctx.createRadialGradient(0, 0, 2, 0, 0, 38);
  coreHalo.addColorStop(0, hexToRgba(pal.core, 0.72));
  coreHalo.addColorStop(0.32, hexToRgba(pal.primary, 0.52));
  coreHalo.addColorStop(0.68, hexToRgba(pal.glow, 0.24));
  coreHalo.addColorStop(1, hexToRgba(pal.glow, 0));
  ctx.fillStyle = coreHalo;
  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 20 : 6.5;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = pal.primary;
  ctx.shadowColor = pal.glow;
  ctx.shadowBlur = 7;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = pal.core;
  ctx.stroke();

  // Crisp 4-point starlight cross glint at the very center
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = pal.core;
  ctx.shadowColor = pal.core;
  ctx.shadowBlur = 4;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-26, 0);
  ctx.lineTo(26, 0);
  ctx.moveTo(0, -26);
  ctx.lineTo(0, 26);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = pal.core;
  ctx.fill();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.anisotropy = 4;
  return texture;
}

const textureCache = new Map<string, THREE.CanvasTexture>();

export function getMagicCircleTexture(theme: MagicCircleTheme, seed = 0): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const variant = ((Math.floor(seed) % MAGIC_CIRCLE_VARIANTS) + MAGIC_CIRCLE_VARIANTS) % MAGIC_CIRCLE_VARIANTS;
  const key = `${theme}:${variant}`;
  let tex = textureCache.get(key);
  if (!tex) {
    tex = renderMagicCircleTexture(theme, variant);
    textureCache.set(key, tex);
  }
  return tex;
}

export function createMagicCirclePlaneGeometry(): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(2.35, 2.35);
  // Orient geometry in XZ plane so normal always points strictly UP (+Y)
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export function getMagicCircleThemeForPower(powerOrTool: string): MagicCircleTheme {
  switch (powerOrTool) {
    case 'eureka':
      return 'insight';
    case 'blessing':
    case 'harmony_dove':
    case 'floral_paradise':
    case 'floral_plains':
    case 'floral_rain':
    case 'cleanse_land':
      return 'blessing';
    case 'golden_age':
    case 'chrono_surge':
    case 'seed_ore':
    case 'bountiful_harvest':
    case 'locust_swarm':
    case 'boulder_rain':
    case 'desert_dunes':
      return 'golden';
    case 'divine_shield':
    case 'rain_of_plenty':
    case 'water_drop':
    case 'tsunami':
    case 'coral_reef_rain':
    case 'summon_fleet':
    case 'salvage_drop':
    case 'atlantis_rise':
    case 'tornado':
    case 'super_tornado':
      return 'shield';
    case 'freeze_snap':
    case 'alpine_glacier':
    case 'blizzard':
      return 'frost';
    case 'bloodlust_frenzy':
    case 'start_war':
    case 'volcano_eruption':
    case 'lava_deluge':
    case 'volcanic_wasteland':
    case 'lava_river':
    case 'lava_drop':
    case 'meteor_strike':
    case 'huge_asteroid_strike':
    case 'solar_orbital_laser':
    case 'heat_wave':
    case 'volcanic_obsidian':
    case 'lightning_smite':
    case 'fortify_walls':
    case 'recruit_legion':
    case 'wildfire_ring':
    case 'earthquake':
    case 'divine_titan':
      return 'wrath';
    case 'terraform_beam':
    case 'plague_miasma':
    case 'blight_plague':
    case 'blighted_mire':
    case 'poison_river':
    case 'poison_drop':
    case 'fertile_meadow':
    case 'plant_forest':
    case 'jungle_bloom':
    case 'soil_enrich':
    case 'acid_rain':
    case 'swamp_mire':
      return 'nature';
    case 'curse':
    case 'wormhole_ascension':
    case 'void_goo':
    case 'gravity_flip':
    case 'undead_portal':
    case 'crystal_shower':
    case 'blossom_rain':
    case 'sinkhole':
    default:
      return 'arcane';
  }
}

export function disposeMagicCircleTextureCache(): void {
  for (const tex of textureCache.values()) {
    tex.dispose();
  }
  textureCache.clear();
}
