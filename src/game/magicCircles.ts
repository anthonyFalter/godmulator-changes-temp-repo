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
}

const THEME_PALETTES: Record<MagicCircleTheme, ThemePalette> = {
  arcane: {
    core: '#e0f2fe',
    primary: '#38bdf8',
    secondary: '#c084fc',
    accentA: '#facc15',
    accentB: '#4ade80',
    accentC: '#fb923c',
    glow: '#a855f7',
  },
  insight: {
    core: '#ecfeff',
    primary: '#38bdf8',
    secondary: '#22d3ee',
    accentA: '#fef08a',
    accentB: '#c084fc',
    accentC: '#5eead4',
    glow: '#06b6d4',
  },
  blessing: {
    core: '#fefce8',
    primary: '#facc15',
    secondary: '#80ed99',
    accentA: '#fff3b0',
    accentB: '#38bdf8',
    accentC: '#4ade80',
    glow: '#f59e0b',
  },
  golden: {
    core: '#fffbeb',
    primary: '#ffd166',
    secondary: '#f59e0b',
    accentA: '#fef08a',
    accentB: '#38bdf8',
    accentC: '#fb7185',
    glow: '#f59e0b',
  },
  shield: {
    core: '#f0fdfa',
    primary: '#72efdd',
    secondary: '#38bdf8',
    accentA: '#e0fbfc',
    accentB: '#c084fc',
    accentC: '#fde047',
    glow: '#2dd4bf',
  },
  wrath: {
    core: '#fff7ed',
    primary: '#ef4444',
    secondary: '#f97316',
    accentA: '#facc15',
    accentB: '#fb7185',
    accentC: '#38bdf8',
    glow: '#dc2626',
  },
  nature: {
    core: '#ecfdf5',
    primary: '#10b981',
    secondary: '#80ed99',
    accentA: '#38bdf8',
    accentB: '#facc15',
    accentC: '#a3e635',
    glow: '#059669',
  },
  frost: {
    core: '#f0f9ff',
    primary: '#67e8f9',
    secondary: '#38bdf8',
    accentA: '#e0f2fe',
    accentB: '#818cf8',
    accentC: '#a5f3fc',
    glow: '#0ea5e9',
  },
};

export const MAGIC_CIRCLE_VARIANTS = 4;

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

function drawRuneGlyph(
  ctx: CanvasRenderingContext2D,
  glyphIdx: number,
  cx: number,
  cy: number,
  radius: number,
  angle: number,
  color: string,
  lineWidth: number,
) {
  const strokes = RUNIC_GLYPHS[((glyphIdx % RUNIC_GLYPHS.length) + RUNIC_GLYPHS.length) % RUNIC_GLYPHS.length];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.max(4, radius * 0.65);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Crisp bright core + neon aura pass
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (const poly of strokes) {
    for (let i = 0; i < poly.length; i++) {
      const px = poly[i][0] * radius;
      const py = poly[i][1] * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha *= 0.62;
  ctx.lineWidth = Math.max(1, lineWidth * 0.45);
  ctx.stroke();
  ctx.restore();
}

function renderMagicCircleTexture(theme: MagicCircleTheme, variant: number): THREE.CanvasTexture {
  const size = 512;
  const half = size / 2;
  const pal = THEME_PALETTES[theme];
  const themeHash = theme.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7);
  const rng = mulberry32(themeHash * 101 + variant * 7919 + 1337);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  // 1. Subtle radial energy aura & center polar grid lattice (matching ref image core)
  const bgGrad = ctx.createRadialGradient(half, half, 4, half, half, half * 0.94);
  bgGrad.addColorStop(0, `${pal.core}88`);
  bgGrad.addColorStop(0.22, `${pal.primary}44`);
  bgGrad.addColorStop(0.55, `${pal.secondary}22`);
  bgGrad.addColorStop(0.84, `${pal.glow}14`);
  bgGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // Polar grid spokes + inner rings
  ctx.save();
  ctx.translate(half, half);
  const spokeCount = 16;
  ctx.strokeStyle = pal.primary;
  ctx.lineWidth = 1.1;
  for (let i = 0; i < spokeCount; i++) {
    const a = (i / spokeCount) * Math.PI * 2;
    const isMajor = i % 2 === 0;
    ctx.globalAlpha = isMajor ? 0.55 : 0.25;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
    ctx.lineTo(Math.cos(a) * (isMajor ? 228 : 148), Math.sin(a) * (isMajor ? 228 : 148));
    ctx.stroke();
  }
  // Inner polar grid circles
  for (const rr of [24, 42, 62, 82, 108, 134, 168, 198]) {
    ctx.globalAlpha = rr <= 82 ? 0.45 : 0.72;
    ctx.lineWidth = rr === 168 || rr === 134 ? 2.2 : 1.1;
    ctx.strokeStyle = rr === 168 ? pal.secondary : pal.primary;
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 2. Glowing sacred geometric octagram / hexagram star polygons
  const drawPolygon = (sides: number, r: number, rotOffset: number, col: string, alpha: number, lw: number) => {
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(rotOffset);
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 7;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  };

  drawPolygon(4, 134, 0, pal.primary, 0.85, 1.8);
  drawPolygon(4, 134, Math.PI / 4, pal.secondary, 0.85, 1.8);
  drawPolygon(6, 108, Math.PI / 6, pal.accentA, 0.6, 1.4);

  // 3. Outer precision tick-gauge ring & broken arc brackets
  ctx.save();
  ctx.translate(half, half);
  const tickCount = 72;
  for (let i = 0; i < tickCount; i++) {
    const a = (i / tickCount) * Math.PI * 2;
    const major = i % 9 === 0;
    const mid = i % 3 === 0;
    const r0 = major ? 174 : mid ? 178 : 181;
    const r1 = major ? 196 : mid ? 190 : 187;
    ctx.strokeStyle = major ? pal.accentA : pal.primary;
    ctx.globalAlpha = major ? 0.92 : mid ? 0.65 : 0.4;
    ctx.lineWidth = major ? 2.2 : 1.1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();
  }
  // Segmented outer arc plates
  for (let i = 0; i < 8; i++) {
    const aStart = (i / 8) * Math.PI * 2 + 0.08;
    const aEnd = ((i + 1) / 8) * Math.PI * 2 - 0.08;
    ctx.strokeStyle = i % 2 === 0 ? pal.primary : pal.secondary;
    ctx.shadowColor = pal.primary;
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.88;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(0, 0, 198, aStart, aEnd);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Inscribed Mystic/Runic Letter Band (24 random runes orbiting between r=138..164)
  const bandRuneCount = 24;
  for (let i = 0; i < bandRuneCount; i++) {
    const a = (i / bandRuneCount) * Math.PI * 2;
    const r = 151;
    const gx = half + Math.cos(a) * r;
    const gy = half + Math.sin(a) * r;
    const gIdx = Math.floor(rng() * RUNIC_GLYPHS.length);
    const glyphCol = i % 3 === 0 ? pal.accentA : i % 3 === 1 ? pal.core : pal.primary;
    ctx.save();
    ctx.globalAlpha = 0.88;
    drawRuneGlyph(ctx, gIdx, gx, gy, 8.5, a + Math.PI / 2, glyphCol, 1.85);
    ctx.restore();
  }

  // 5. 8 Glowing Circular Rune Medallions seated on the main perimeter (r=168)
  const accentOrder = [pal.primary, pal.accentA, pal.accentC, pal.accentB];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const mx = half + Math.cos(a) * 168;
    const my = half + Math.sin(a) * 168;
    const nodeCol = accentOrder[(i + variant) % accentOrder.length];

    // Dark translucent medallion backing so runes stay crisp even over bright terrain
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, 17, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6, 10, 24, 0.72)';
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = nodeCol;
    ctx.shadowColor = nodeCol;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();

    const gIdx = Math.floor(rng() * RUNIC_GLYPHS.length);
    drawRuneGlyph(ctx, gIdx, mx, my, 9.5, a + Math.PI / 2, nodeCol, 2.2);
  }

  // 6. 8 Outer Cardinal/Ordinal Floating Runic Sigils & Energy Rays (r=228, just like attached ref image)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2 + Math.PI / 8;
    const sx = half + Math.cos(a) * 226;
    const sy = half + Math.sin(a) * 226;
    const sigilCol = accentOrder[(i + 1 + variant) % accentOrder.length];

    // Energy ray from ring out to floating rune
    ctx.save();
    ctx.strokeStyle = sigilCol;
    ctx.shadowColor = sigilCol;
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(half + Math.cos(a) * 198, half + Math.sin(a) * 198);
    ctx.lineTo(half + Math.cos(a) * 212, half + Math.sin(a) * 212);
    ctx.stroke();
    ctx.restore();

    const gIdx = Math.floor(rng() * RUNIC_GLYPHS.length);
    drawRuneGlyph(ctx, gIdx, sx, sy, 13.5, a + Math.PI / 2, sigilCol, 2.7);
  }

  // 7. Radiant White-Core Jewel at Center
  ctx.save();
  const centerGlow = ctx.createRadialGradient(half, half, 0, half, half, 26);
  centerGlow.addColorStop(0, '#ffffff');
  centerGlow.addColorStop(0.35, pal.core);
  centerGlow.addColorStop(0.7, `${pal.primary}88`);
  centerGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = centerGlow;
  ctx.beginPath();
  ctx.arc(half, half, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
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
      return 'blessing';
    case 'golden_age':
    case 'chrono_surge':
    case 'seed_ore':
      return 'golden';
    case 'divine_shield':
    case 'rain_of_plenty':
    case 'tsunami':
    case 'coral_reef_rain':
      return 'shield';
    case 'freeze_snap':
    case 'alpine_glacier':
      return 'frost';
    case 'bloodlust_frenzy':
    case 'volcano_eruption':
    case 'meteor_strike':
    case 'huge_asteroid_strike':
    case 'solar_orbital_laser':
    case 'heat_wave':
    case 'volcanic_obsidian':
    case 'lightning_smite':
      return 'wrath';
    case 'terraform_beam':
    case 'plague_miasma':
    case 'fertile_meadow':
    case 'plant_forest':
    case 'jungle_bloom':
    case 'soil_enrich':
      return 'nature';
    case 'curse':
    case 'wormhole_ascension':
    case 'void_goo':
    case 'gravity_flip':
    case 'undead_portal':
    case 'crystal_shower':
    case 'blossom_rain':
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
