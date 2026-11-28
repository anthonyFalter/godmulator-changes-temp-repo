import React from 'react';

export interface PixelRun {
  x: number;
  y: number;
  w: number;
  fill: string;
}

export interface ColorPath {
  fill: string;
  d: string;
}

export interface CompiledSprite {
  size: number;
  runs: PixelRun[];
  paths: ColorPath[];
  hasCurrentColor: boolean;
}

export interface SpriteSpec {
  size?: number;
  palette: Record<string, string>;
  grid: readonly string[];
}

export function buildPathsFromRuns(runs: PixelRun[]): {
  paths: ColorPath[];
  hasCurrentColor: boolean;
} {
  const byFill = new Map<string, string[]>();
  let hasCurrentColor = false;

  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    if (r.fill === 'currentColor') hasCurrentColor = true;
    let parts = byFill.get(r.fill);
    if (!parts) {
      parts = [];
      byFill.set(r.fill, parts);
    }
    parts.push(`M${r.x} ${r.y}h${r.w}v1H${r.x}z`);
  }

  const paths: ColorPath[] = [];
  for (const [fill, parts] of byFill.entries()) {
    paths.push({ fill, d: parts.join('') });
  }
  return { paths, hasCurrentColor };
}

export function compileSprite(spec: SpriteSpec): CompiledSprite {
  const size = spec.size ?? 16;
  const runs: PixelRun[] = [];
  const { grid, palette } = spec;

  for (let y = 0; y < Math.min(size, grid.length); y++) {
    const row = grid[y];
    const limit = Math.min(size, row.length);
    let x = 0;
    while (x < limit) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < limit && row[x + w] === ch) {
        w++;
      }
      const fill = palette[ch];
      if (fill) {
        runs.push({ x, y, w, fill });
      }
      x += w;
    }
  }

  const { paths, hasCurrentColor } = buildPathsFromRuns(runs);
  return { size, runs, paths, hasCurrentColor };
}

const pngUrlCache = new WeakMap<CompiledSprite, string>();
let sharedCanvas: HTMLCanvasElement | null = null;

function getSpritePngUrl(sprite: CompiledSprite): string | null {
  if (sprite.hasCurrentColor || typeof document === 'undefined') return null;
  const cached = pngUrlCache.get(sprite);
  if (cached) return cached;

  try {
    if (!sharedCanvas) {
      sharedCanvas = document.createElement('canvas');
    }
    if (sharedCanvas.width !== sprite.size || sharedCanvas.height !== sprite.size) {
      sharedCanvas.width = sprite.size;
      sharedCanvas.height = sprite.size;
    }
    const ctx = sharedCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, sprite.size, sprite.size);
    let lastFill = '';
    for (let j = 0; j < sprite.runs.length; j++) {
      const r = sprite.runs[j];
      if (r.fill !== lastFill) {
        ctx.fillStyle = r.fill;
        lastFill = r.fill;
      }
      ctx.fillRect(r.x, r.y, r.w, 1);
    }

    const url = sharedCanvas.toDataURL('image/png');
    pngUrlCache.set(sprite, url);
    return url;
  } catch {
    return null;
  }
}

export const PixelArtSvg: React.FC<{
  sprite: CompiledSprite;
  className?: string;
}> = React.memo(({ sprite, className }) => {
  const pngUrl = getSpritePngUrl(sprite);
  if (pngUrl) {
    const imgClass = className
      ? className.includes('pixelated-canvas')
        ? `${className} select-none`
        : `${className} pixelated-canvas select-none`
      : 'pixelated-canvas select-none';
    return (
      <img
        src={pngUrl}
        width={sprite.size}
        height={sprite.size}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={imgClass}
      />
    );
  }

  return (
    <svg
      viewBox={`0 0 ${sprite.size} ${sprite.size}`}
      className={className}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      {sprite.paths.map((p, idx) => (
        <path key={idx} d={p.d} fill={p.fill} />
      ))}
    </svg>
  );
});

/**
 * Hand-Pixelled 16-Bit RPG Material Ramp (Calibrated directly to reference sheets):
 * - Clean flat midtone fills (`mid`) with purposeful top/edge highlights (`lit` / `hi`),
 * - Cast shadows & underside creases (`shd`), never synthetic diagonal gradients,
 * - Dark hue-tinted inner crease (`lin`) and crisp 1px dark perimeter (`out`).
 */
export interface MatRamp {
  hi: string;  // 4: Crisp rim / cutting edge / specular dot
  lit: string; // 3: Top-lit surface / bright plane
  mid: string; // 2: Clean vibrant local base color
  shd: string; // 1: Under-edge / cast-shadow plane
  lin: string; // o: Inner dark crease / socket / eye
  out: string; // 0: Crisp dark outer silhouette outline
}

export const MAT = {
  ruby: {
    hi: '#ff8a66',
    lit: '#ff3b47',
    mid: '#de1b38',
    shd: '#99123a',
    lin: '#5e0b29',
    out: '#29091a',
  } as MatRamp,
  pink: {
    hi: '#ffe6dc',
    lit: '#ffadab',
    mid: '#eb7184',
    shd: '#b54162',
    lin: '#701f3d',
    out: '#330c21',
  } as MatRamp,
  flame: {
    hi: '#fffcd6',
    lit: '#ffd43b',
    mid: '#ff6f24',
    shd: '#cc262e',
    lin: '#781124',
    out: '#2e0817',
  } as MatRamp,
  gold: {
    hi: '#fff9cc',
    lit: '#ffde3b',
    mid: '#eda11c',
    shd: '#ad531c',
    lin: '#6b2a17',
    out: '#290f13',
  } as MatRamp,
  copper: {
    hi: '#ffdec2',
    lit: '#f09156',
    mid: '#c95736',
    shd: '#852a2c',
    lin: '#4d141d',
    out: '#240a13',
  } as MatRamp,
  wood: {
    hi: '#ffd599',
    lit: '#d48246',
    mid: '#994b29',
    shd: '#63281f',
    lin: '#3b1517',
    out: '#210b12',
  } as MatRamp,
  darkWood: {
    hi: '#c98a59',
    lit: '#945434',
    mid: '#663125',
    shd: '#401b1d',
    lin: '#290f15',
    out: '#17080d',
  } as MatRamp,
  parchment: {
    hi: '#ffffff',
    lit: '#fff2cc',
    mid: '#e6c287',
    shd: '#ab8157',
    lin: '#6b4a38',
    out: '#261717',
  } as MatRamp,
  bone: {
    hi: '#ffffff',
    lit: '#dcf7ff',
    mid: '#9ecde3',
    shd: '#5c82ad',
    lin: '#33426b',
    out: '#16152b',
  } as MatRamp,
  steel: {
    hi: '#ffffff',
    lit: '#d6e7f7',
    mid: '#8ea5c4',
    shd: '#516285',
    lin: '#2f3654',
    out: '#151526',
  } as MatRamp,
  darkIron: {
    hi: '#bfd0e6',
    lit: '#7889ab',
    mid: '#495473',
    shd: '#2c304a',
    lin: '#1c1d30',
    out: '#100f1c',
  } as MatRamp,
  stone: {
    hi: '#f2efe9',
    lit: '#c9c1b7',
    mid: '#8c817d',
    shd: '#574e54',
    lin: '#362e36',
    out: '#1a141f',
  } as MatRamp,
  leaf: {
    hi: '#d7ff70',
    lit: '#69de43',
    mid: '#2aa346',
    shd: '#186643',
    lin: '#0f3d30',
    out: '#0b1f1e',
  } as MatRamp,
  toxic: {
    hi: '#f5ff9e',
    lit: '#a3f536',
    mid: '#42bf2e',
    shd: '#1b7837',
    lin: '#114729',
    out: '#0a211a',
  } as MatRamp,
  azure: {
    hi: '#e0fcff',
    lit: '#5ed4ff',
    mid: '#2187ed',
    shd: '#1a47ab',
    lin: '#142869',
    out: '#0d1236',
  } as MatRamp,
  ice: {
    hi: '#ffffff',
    lit: '#b0f5ff',
    mid: '#4fb6f0',
    shd: '#2867bf',
    lin: '#1a3873',
    out: '#0f1b3d',
  } as MatRamp,
  arcane: {
    hi: '#ffd9ff',
    lit: '#de7dff',
    mid: '#983ae3',
    shd: '#591da3',
    lin: '#351063',
    out: '#190733',
  } as MatRamp,
  skin: {
    hi: '#fff0e0',
    lit: '#ffcfa8',
    mid: '#e69870',
    shd: '#b05a46',
    lin: '#6e2e2b',
    out: '#2c1015',
  } as MatRamp,
  orcSkin: {
    hi: '#dcff8a',
    lit: '#96d94a',
    mid: '#56a137',
    shd: '#2f662f',
    lin: '#1b3d22',
    out: '#0e1f16',
  } as MatRamp,
  hud: {
    hi: '#ffffff',
    lit: '#f5ecde',
    mid: '#d6c8b4',
    shd: '#948476',
    lin: '#544842',
    out: '#17111c',
  } as MatRamp,
} as const;

export function toneColor(ramp: MatRamp, level: number): string {
  if (level >= 4) return ramp.hi;
  if (level === 3) return ramp.lit;
  if (level === 2) return ramp.mid;
  if (level === 1) return ramp.shd;
  return ramp.lin;
}

export type MatLegend = Record<string, { ramp: MatRamp; tone: number } | string>;

/**
 * 16x16 Crisp Pixel Art Sprite Canvas.
 * Preserves hand-crafted pixel clusters without procedural gradients and wraps
 * outer silhouettes in a cohesive dark 1px RPG outline.
 */
export class Icon16 {
  readonly size = 16;
  readonly color: (string | null)[];
  readonly rampRef: (MatRamp | null)[];

  constructor() {
    const n = 16 * 16;
    this.color = new Array(n).fill(null);
    this.rampRef = new Array(n).fill(null);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < 16 && y < 16;
  }

  set(x: number, y: number, ramp: MatRamp, tone: number): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (!this.inBounds(ix, iy)) return;
    const idx = iy * 16 + ix;
    this.color[idx] = toneColor(ramp, tone);
    this.rampRef[idx] = ramp;
  }

  setOut(x: number, y: number, ramp: MatRamp): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (!this.inBounds(ix, iy)) return;
    const idx = iy * 16 + ix;
    this.color[idx] = ramp.out;
    this.rampRef[idx] = ramp;
  }

  setRaw(x: number, y: number, hex: string, ramp: MatRamp = MAT.hud): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (!this.inBounds(ix, iy)) return;
    const idx = iy * 16 + ix;
    this.color[idx] = hex;
    this.rampRef[idx] = ramp;
  }

  setCC(x: number, y: number): void {
    this.setRaw(x, y, 'currentColor', MAT.hud);
  }

  has(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    return this.color[y * 16 + x] !== null;
  }

  stamp(
    ox: number,
    oy: number,
    rows: readonly string[],
    primary: MatRamp,
    materials?: MatLegend,
  ): void {
    for (let ry = 0; ry < rows.length; ry++) {
      const row = rows[ry];
      for (let rx = 0; rx < row.length; rx++) {
        const ch = row[rx];
        if (ch === '.' || ch === ' ') continue;
        const x = ox + rx;
        const y = oy + ry;
        if (!this.inBounds(x, y)) continue;
        if (ch >= '1' && ch <= '4') {
          this.set(x, y, primary, ch.charCodeAt(0) - 48);
        } else if (ch === '0' || ch === 'o') {
          this.set(x, y, primary, 0);
        } else if (ch === 'O') {
          this.setOut(x, y, primary);
        } else if (ch === '$') {
          this.setCC(x, y);
        } else if (materials && ch in materials) {
          const m = materials[ch];
          if (typeof m === 'string') {
            this.setRaw(x, y, m, primary);
          } else {
            this.set(x, y, m.ramp, m.tone);
          }
        }
      }
    }
  }

  /**
   * Draws a clean flat-planed 2:1 isometric tile (14px wide, x=1..14)
   * matching the planar isometric discipline of classic RPG ingots & blocks:
   * - Top diamond = solid flat lit plane (3) with 1px ridge on front rim
   * - Left wall = solid mid plane (2) with dark crease at base
   * - Right wall = solid shd plane (1)
   */
  isoTile(
    topRamp: MatRamp,
    leftRamp: MatRamp,
    rightRamp: MatRamp,
    baseY = 12,
    wallH = 4,
    topOverlay?: (x: number, y: number, cx: number, cy: number) => { ramp: MatRamp; tone: number } | null,
  ): void {
    const midY = baseY - wallH;
    const apexY = midY + 3;
    const topY = midY - 3;

    // Clean flat-planed left & right walls
    for (let x = 1; x <= 14; x++) {
      const distCenter = x <= 7 ? 7 - x : x - 8;
      const drop = Math.floor(distCenter / 2);
      const yTop = apexY - drop;
      const yBot = yTop + wallH;
      for (let y = yTop; y <= yBot; y++) {
        if (x <= 7) {
          const tone = y === yBot ? 1 : 2;
          this.set(x, y, leftRamp, tone);
        } else {
          const tone = y === yBot ? 0 : 1;
          this.set(x, y, rightRamp, tone);
        }
      }
    }

    // Clean flat top diamond
    for (let y = topY; y <= apexY; y++) {
      const dy = Math.abs(y - midY);
      const halfSpan = 7 - dy * 2;
      const xStart = 8 - halfSpan;
      const xEnd = 7 + halfSpan;
      for (let x = xStart; x <= xEnd; x++) {
        if (topOverlay) {
          const ov = topOverlay(x, y, 7.5, midY);
          if (ov) {
            this.set(x, y, ov.ramp, ov.tone);
            continue;
          }
        }
        const isFrontRim = y >= midY && (x <= xStart + 1 || x >= xEnd - 1);
        this.set(x, y, topRamp, isFrontRim ? 4 : 3);
      }
    }
  }

  finalize(outline = true): CompiledSprite {
    if (outline) {
      const queue: Array<{ x: number; y: number; hex: string }> = [];
      const dirs = [
        [0, -1],
        [-1, 0],
        [1, 0],
        [0, 1],
      ] as const;

      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (this.has(x, y)) continue;
          let picked: MatRamp | null = null;
          for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (!this.inBounds(nx, ny)) continue;
            const idx = ny * 16 + nx;
            if (this.color[idx] !== null) {
              picked = this.rampRef[idx] ?? MAT.hud;
              break;
            }
          }
          if (picked) {
            queue.push({ x, y, hex: picked.out });
          }
        }
      }

      for (const o of queue) {
        this.color[o.y * 16 + o.x] = o.hex;
      }
    }

    const runs: PixelRun[] = [];
    for (let y = 0; y < 16; y++) {
      let x = 0;
      while (x < 16) {
        const fill = this.color[y * 16 + x];
        if (!fill) {
          x++;
          continue;
        }
        let w = 1;
        while (x + w < 16 && this.color[y * 16 + x + w] === fill) {
          w++;
        }
        runs.push({ x, y, w, fill });
        x += w;
      }
    }

    const { paths, hasCurrentColor } = buildPathsFromRuns(runs);
    return { size: 16, runs, paths, hasCurrentColor };
  }
}

export function icon16(draw: (c: Icon16) => void, outline = true): CompiledSprite {
  const c = new Icon16();
  draw(c);
  return c.finalize(outline);
}

export function cluster16(
  rows: readonly string[],
  primary: MatRamp,
  materials?: MatLegend,
  outline = true,
): CompiledSprite {
  return icon16((c) => {
    c.stamp(0, 0, rows, primary, materials);
  }, outline);
}

/**
 * Grounded 24x24 Pixel-Art Material Ramps (rich earthy midtones, cool-shifted shadows,
 * selective warm highlights, and crisp dark ink outlines).
 */
export const PMAT = {
  crimson: { hi: '#e8a287', lit: '#c74642', mid: '#962933', shd: '#5e1928', lin: '#330f1c', out: '#120912' } as MatRamp,
  amber: { hi: '#fae6a8', lit: '#e69c3e', mid: '#bd5628', shd: '#7d2922', lin: '#451418', out: '#14090e' } as MatRamp,
  gold: { hi: '#f7ecc1', lit: '#d9b04c', mid: '#a8762d', shd: '#6e441e', lin: '#3d2214', out: '#140c0c' } as MatRamp,
  bronze: { hi: '#e8c4a0', lit: '#bd7c4d', mid: '#8c4d2e', shd: '#592c21', lin: '#331715', out: '#120a0d' } as MatRamp,
  wood: { hi: '#d9b386', lit: '#a3744c', mid: '#734b32', shd: '#4a2d22', lin: '#2b1916', out: '#120a0d' } as MatRamp,
  darkWood: { hi: '#a68265', lit: '#75513d', mid: '#4f332a', shd: '#331e1d', lin: '#1f1114', out: '#0f090d' } as MatRamp,
  parchment: { hi: '#f5efe2', lit: '#d9cbb4', mid: '#ad9a80', shd: '#786655', lin: '#473b35', out: '#141014' } as MatRamp,
  bone: { hi: '#eef2f5', lit: '#c5cfd9', mid: '#8e9cab', shd: '#5b6778', lin: '#363d4d', out: '#12131c' } as MatRamp,
  steel: { hi: '#dce6f2', lit: '#9eb0c7', mid: '#687991', shd: '#414d63', lin: '#262c3d', out: '#0f111a' } as MatRamp,
  iron: { hi: '#99a6bd', lit: '#636e85', mid: '#3e4559', shd: '#252938', lin: '#171924', out: '#0c0c14' } as MatRamp,
  stone: { hi: '#d1cbc2', lit: '#9e968e', mid: '#6e6763', shd: '#474242', lin: '#2b272a', out: '#121014' } as MatRamp,
  sand: { hi: '#f0dfc0', lit: '#ccae7a', mid: '#9c7d50', shd: '#695036', lin: '#3d2d22', out: '#140f0d' } as MatRamp,
  moss: { hi: '#c4d982', lit: '#7ca84c', mid: '#497a3b', shd: '#2c5231', lin: '#193022', out: '#0c1714' } as MatRamp,
  toxic: { hi: '#d6ed8a', lit: '#8ac443', mid: '#508f34', shd: '#2d5c2b', lin: '#183620', out: '#0c1712' } as MatRamp,
  water: { hi: '#c4e6f2', lit: '#64a8cc', mid: '#36729e', shd: '#224870', lin: '#162b47', out: '#0c1324' } as MatRamp,
  ice: { hi: '#edf7fa', lit: '#a6d4e6', mid: '#639ec2', shd: '#396991', lin: '#223e5e', out: '#0e1829' } as MatRamp,
  arcane: { hi: '#e3c7ed', lit: '#a870c7', mid: '#734299', shd: '#472569', lin: '#291442', out: '#110a1f' } as MatRamp,
  rose: { hi: '#f0d1ce', lit: '#cc878c', mid: '#995360', shd: '#663141', lin: '#3b1b29', out: '#140b12' } as MatRamp,
  skin: { hi: '#f2d8c2', lit: '#d6a686', mid: '#a87559', shd: '#75493a', lin: '#472924', out: '#170d0f' } as MatRamp,
  orc: { hi: '#c7d989', lit: '#8aa852', mid: '#58783a', shd: '#36502b', lin: '#1f301d', out: '#0e1711' } as MatRamp,
  fur: { hi: '#edd1a6', lit: '#c49056', mid: '#8f5e35', shd: '#5c3923', lin: '#361f17', out: '#140c0d' } as MatRamp,
} as const;

/**
 * 24x24 Detailed Pixel Art Sprite Canvas.
 * Supports rich multi-tone clusters, isometric blocks, half-body busts, and crisp 1px dark ink outlines.
 */
export class Icon24 {
  readonly size = 24;
  readonly color: (string | null)[];
  readonly rampRef: (MatRamp | null)[];

  constructor() {
    const n = 24 * 24;
    this.color = new Array(n).fill(null);
    this.rampRef = new Array(n).fill(null);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < 24 && y < 24;
  }

  set(x: number, y: number, ramp: MatRamp, tone: number): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (!this.inBounds(ix, iy)) return;
    const idx = iy * 24 + ix;
    this.color[idx] = toneColor(ramp, tone);
    this.rampRef[idx] = ramp;
  }

  setOut(x: number, y: number, ramp: MatRamp): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (!this.inBounds(ix, iy)) return;
    const idx = iy * 24 + ix;
    this.color[idx] = ramp.out;
    this.rampRef[idx] = ramp;
  }

  setRaw(x: number, y: number, hex: string, ramp: MatRamp = PMAT.iron): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (!this.inBounds(ix, iy)) return;
    const idx = iy * 24 + ix;
    this.color[idx] = hex;
    this.rampRef[idx] = ramp;
  }

  clear(x: number, y: number): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (!this.inBounds(ix, iy)) return;
    const idx = iy * 24 + ix;
    this.color[idx] = null;
    this.rampRef[idx] = null;
  }

  has(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    return this.color[y * 24 + x] !== null;
  }

  rect(x: number, y: number, w: number, h: number, ramp: MatRamp, tone: number): void {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.set(x + dx, y + dy, ramp, tone);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, ramp: MatRamp, tone: number): void {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.0) {
          this.set(x, y, ramp, tone);
        }
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, ramp: MatRamp, tone: number): void {
    let ix0 = Math.round(x0);
    let iy0 = Math.round(y0);
    const ix1 = Math.round(x1);
    const iy1 = Math.round(y1);
    const dx = Math.abs(ix1 - ix0);
    const dy = Math.abs(iy1 - iy0);
    const sx = ix0 < ix1 ? 1 : -1;
    const sy = iy0 < iy1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      this.set(ix0, iy0, ramp, tone);
      if (ix0 === ix1 && iy0 === iy1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        ix0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        iy0 += sy;
      }
    }
  }

  stamp(
    ox: number,
    oy: number,
    rows: readonly string[],
    primary: MatRamp,
    materials?: MatLegend,
  ): void {
    for (let ry = 0; ry < rows.length; ry++) {
      const row = rows[ry];
      for (let rx = 0; rx < row.length; rx++) {
        const ch = row[rx];
        if (ch === '.' || ch === ' ') continue;
        const x = ox + rx;
        const y = oy + ry;
        if (!this.inBounds(x, y)) continue;
        if (ch >= '1' && ch <= '4') {
          this.set(x, y, primary, ch.charCodeAt(0) - 48);
        } else if (ch === '0' || ch === 'o') {
          this.set(x, y, primary, 0);
        } else if (ch === 'O') {
          this.setOut(x, y, primary);
        } else if (materials && ch in materials) {
          const m = materials[ch];
          if (typeof m === 'string') {
            this.setRaw(x, y, m, primary);
          } else {
            this.set(x, y, m.ramp, m.tone);
          }
        }
      }
    }
  }

  /**
   * 24x24 crisp 2:1 isometric terrain/material block (20px wide, x=2..21)
   * with textured top face, subtle bevel highlight, and stratified left/right walls.
   */
  isoBlock(
    topRamp: MatRamp,
    leftRamp: MatRamp,
    rightRamp: MatRamp,
    baseY = 20,
    wallH = 6,
    topOverlay?: (x: number, y: number, cx: number, cy: number) => { ramp: MatRamp; tone: number } | null,
  ): void {
    const midY = baseY - wallH;
    const apexY = midY + 5;
    const topY = midY - 5;

    // Left & right walls with subtle strata & shadow crease
    for (let x = 2; x <= 21; x++) {
      const distCenter = x <= 11 ? 11 - x : x - 12;
      const drop = Math.floor(distCenter / 2);
      const yTop = apexY - drop;
      const yBot = yTop + wallH;
      for (let y = yTop; y <= yBot; y++) {
        const isEdge = x === 11 || x === 12;
        if (x <= 11) {
          let tone = y === yBot ? 1 : (y - yTop === 0 ? 3 : 2);
          if ((x + y * 3) % 7 === 0 && y > yTop && y < yBot) tone = 1;
          if (isEdge && y > yTop) tone = Math.max(1, tone - 1);
          this.set(x, y, leftRamp, tone);
        } else {
          let tone = y === yBot ? 0 : (y - yTop === 0 ? 2 : 1);
          if ((x * 2 + y * 3) % 7 === 0 && y > yTop && y < yBot) tone = 0;
          this.set(x, y, rightRamp, tone);
        }
      }
    }

    // Top diamond with beveled front edge and optional procedural detail
    for (let y = topY; y <= apexY; y++) {
      const dy = Math.abs(y - midY);
      const halfSpan = 10 - dy * 2;
      const xStart = 12 - halfSpan;
      const xEnd = 11 + halfSpan;
      for (let x = xStart; x <= xEnd; x++) {
        if (topOverlay) {
          const ov = topOverlay(x, y, 11.5, midY);
          if (ov) {
            this.set(x, y, ov.ramp, ov.tone);
            continue;
          }
        }
        const isFrontRim = y >= midY && (x <= xStart + 1 || x >= xEnd - 1);
        const isBackEdge = y <= midY && (x <= xStart + 1);
        let tone = isFrontRim ? 4 : isBackEdge ? 3 : ((x * 5 + y * 3) % 9 === 0 ? 2 : 3);
        if (y === apexY) tone = 4;
        this.set(x, y, topRamp, tone);
      }
    }
  }

  finalize(outline = true): CompiledSprite {
    if (outline) {
      const queue: Array<{ x: number; y: number; hex: string }> = [];
      const dirs = [
        [0, -1],
        [-1, 0],
        [1, 0],
        [0, 1],
      ] as const;

      for (let y = 0; y < 24; y++) {
        for (let x = 0; x < 24; x++) {
          if (this.has(x, y)) continue;
          let picked: MatRamp | null = null;
          for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (!this.inBounds(nx, ny)) continue;
            const idx = ny * 24 + nx;
            if (this.color[idx] !== null) {
              picked = this.rampRef[idx] ?? PMAT.iron;
              break;
            }
          }
          if (picked) {
            queue.push({ x, y, hex: picked.out });
          }
        }
      }

      for (const o of queue) {
        this.color[o.y * 24 + o.x] = o.hex;
      }
    }

    const runs: PixelRun[] = [];
    for (let y = 0; y < 24; y++) {
      let x = 0;
      while (x < 24) {
        const fill = this.color[y * 24 + x];
        if (!fill) {
          x++;
          continue;
        }
        let w = 1;
        while (x + w < 24 && this.color[y * 24 + x + w] === fill) {
          w++;
        }
        runs.push({ x, y, w, fill });
        x += w;
      }
    }

    const { paths, hasCurrentColor } = buildPathsFromRuns(runs);
    return { size: 24, runs, paths, hasCurrentColor };
  }
}

export function icon24(draw: (c: Icon24) => void, outline = true): CompiledSprite {
  const c = new Icon24();
  draw(c);
  return c.finalize(outline);
}

export function cluster24(
  rows: readonly string[],
  primary: MatRamp,
  materials?: MatLegend,
  outline = true,
): CompiledSprite {
  return icon24((c) => {
    c.stamp(0, 0, rows, primary, materials);
  }, outline);
}
