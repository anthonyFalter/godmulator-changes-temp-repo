import { buildPathsFromRuns, type CompiledSprite, type PixelRun } from './pixelEngine';

export type RGB = readonly [number, number, number];
export type RGBA = readonly [number, number, number, number];

export type PixelShader = (
  x: number,
  y: number,
  nx: number,
  ny: number,
  nz: number,
  light: number,
  u: number,
  v: number,
) => RGB | RGBA | null;

export interface MaterialRamp {
  hi: RGB;     // Crisp specular / lit highlight
  light: RGB;  // Bright lit plane
  mid: RGB;    // Base local color
  dark: RGB;   // Cool/rich shadow
  deep: RGB;   // Deepest crease / bounce base
}

export function hexRgb(hex: string): RGB {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbHex(r: number, g: number, b: number): string {
  const cr = Math.max(0, Math.min(255, Math.round(r)));
  const cg = Math.max(0, Math.min(255, Math.round(g)));
  const cb = Math.max(0, Math.min(255, Math.round(b)));
  return (
    '#' +
    cr.toString(16).padStart(2, '0') +
    cg.toString(16).padStart(2, '0') +
    cb.toString(16).padStart(2, '0')
  );
}

export function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  const k = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

export function rampColor(ramp: MaterialRamp, t: number, dither = 0): RGB {
  const v = Math.max(0, Math.min(1, t + dither));
  if (v < 0.22) return lerpRgb(ramp.deep, ramp.dark, v / 0.22);
  if (v < 0.5) return lerpRgb(ramp.dark, ramp.mid, (v - 0.22) / 0.28);
  if (v < 0.8) return lerpRgb(ramp.mid, ramp.light, (v - 0.5) / 0.3);
  return lerpRgb(ramp.light, ramp.hi, (v - 0.8) / 0.2);
}

/** Quantize to clean crisp pixel-art step tones (5-6 distinct tones per ramp feel) */
export function quantRamp(ramp: MaterialRamp, t: number, x = 0, y = 0, grain = 0.045): RGB {
  const bayer = (((x & 1) ^ (y & 1)) * 2 + (y & 1) - 1.5) * grain;
  const v = Math.max(0, Math.min(1, t + bayer));
  if (v < 0.18) return ramp.deep;
  if (v < 0.42) return ramp.dark;
  if (v < 0.72) return ramp.mid;
  if (v < 0.91) return ramp.light;
  return ramp.hi;
}

export function hash2d(x: number, y: number, seed = 17): number {
  let n = Math.imul(x + 13, 374761393) ^ Math.imul(y + 29, 668265263) ^ Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

/** Curated RPG pixel-art material ramps inspired by 16-bit/32-bit fantasy sprites */
export const RAMPS = {
  gold: {
    hi: [255, 251, 196],
    light: [255, 213, 86],
    mid: [230, 154, 40],
    dark: [168, 92, 24],
    deep: [98, 46, 14],
  } as MaterialRamp,
  steel: {
    hi: [248, 252, 255],
    light: [204, 218, 232],
    mid: [134, 152, 174],
    dark: [78, 92, 114],
    deep: [42, 48, 66],
  } as MaterialRamp,
  darkIron: {
    hi: [184, 194, 208],
    light: [122, 132, 146],
    mid: [76, 82, 96],
    dark: [48, 50, 62],
    deep: [28, 28, 36],
  } as MaterialRamp,
  wood: {
    hi: [236, 184, 126],
    light: [198, 134, 78],
    mid: [152, 92, 52],
    dark: [104, 58, 34],
    deep: [64, 34, 20],
  } as MaterialRamp,
  darkWood: {
    hi: [186, 128, 84],
    light: [142, 88, 54],
    mid: [102, 58, 34],
    dark: [72, 38, 22],
    deep: [44, 22, 14],
  } as MaterialRamp,
  leather: {
    hi: [224, 156, 102],
    light: [184, 112, 64],
    mid: [138, 76, 42],
    dark: [94, 48, 28],
    deep: [58, 28, 18],
  } as MaterialRamp,
  stone: {
    hi: [234, 230, 220],
    light: [188, 182, 170],
    mid: [136, 130, 122],
    dark: [92, 86, 82],
    deep: [56, 52, 52],
  } as MaterialRamp,
  sandstone: {
    hi: [255, 240, 204],
    light: [234, 202, 148],
    mid: [196, 154, 98],
    dark: [144, 102, 62],
    deep: [92, 60, 36],
  } as MaterialRamp,
  crimson: {
    hi: [255, 196, 184],
    light: [250, 96, 84],
    mid: [212, 42, 46],
    dark: [146, 20, 34],
    deep: [86, 12, 24],
  } as MaterialRamp,
  terracotta: {
    hi: [250, 166, 126],
    light: [218, 108, 74],
    mid: [176, 68, 48],
    dark: [124, 42, 34],
    deep: [76, 24, 22],
  } as MaterialRamp,
  flame: {
    hi: [255, 253, 214],
    light: [255, 214, 78],
    mid: [248, 126, 26],
    dark: [204, 52, 24],
    deep: [122, 22, 18],
  } as MaterialRamp,
  leaf: {
    hi: [216, 248, 144],
    light: [132, 214, 88],
    mid: [68, 164, 64],
    dark: [36, 112, 52],
    deep: [20, 66, 36],
  } as MaterialRamp,
  toxic: {
    hi: [242, 255, 168],
    light: [178, 246, 68],
    mid: [104, 204, 48],
    dark: [54, 144, 42],
    deep: [26, 82, 30],
  } as MaterialRamp,
  azure: {
    hi: [224, 250, 255],
    light: [110, 214, 246],
    mid: [42, 146, 220],
    dark: [26, 88, 162],
    deep: [18, 48, 104],
  } as MaterialRamp,
  ice: {
    hi: [252, 255, 255],
    light: [194, 242, 255],
    mid: [114, 202, 242],
    dark: [58, 134, 198],
    deep: [32, 74, 138],
  } as MaterialRamp,
  arcane: {
    hi: [248, 220, 255],
    light: [208, 118, 248],
    mid: [148, 56, 214],
    dark: [92, 28, 152],
    deep: [48, 14, 92],
  } as MaterialRamp,
  parchment: {
    hi: [255, 252, 236],
    light: [244, 228, 192],
    mid: [214, 188, 144],
    dark: [168, 136, 94],
    deep: [112, 82, 54],
  } as MaterialRamp,
  bone: {
    hi: [255, 252, 244],
    light: [238, 228, 206],
    mid: [202, 186, 158],
    dark: [146, 130, 108],
    deep: [94, 80, 68],
  } as MaterialRamp,
  skin: {
    hi: [255, 236, 212],
    light: [248, 208, 168],
    mid: [224, 168, 122],
    dark: [176, 116, 78],
    deep: [118, 72, 48],
  } as MaterialRamp,
  orcSkin: {
    hi: [194, 236, 128],
    light: [144, 204, 84],
    mid: [94, 154, 58],
    dark: [56, 104, 40],
    deep: [32, 62, 26],
  } as MaterialRamp,
  pink: {
    hi: [255, 230, 238],
    light: [252, 184, 202],
    mid: [236, 134, 164],
    dark: [186, 86, 118],
    deep: [122, 48, 76],
  } as MaterialRamp,
  cloud: {
    hi: [252, 254, 255],
    light: [226, 238, 248],
    mid: [178, 200, 222],
    dark: [120, 144, 174],
    deep: [74, 92, 122],
  } as MaterialRamp,
  glass: {
    hi: [250, 255, 255],
    light: [198, 240, 252],
    mid: [124, 198, 226],
    dark: [68, 136, 176],
    deep: [38, 78, 118],
  } as MaterialRamp,
} as const;

const LIGHT_X = -0.6;
const LIGHT_Y = -0.7;
const LIGHT_Z = 0.39;

export class PixelCanvas {
  readonly size: number;
  readonly r: Uint8Array;
  readonly g: Uint8Array;
  readonly b: Uint8Array;
  readonly a: Uint8Array;
  readonly tag: Uint8Array; // 0 = empty, 1 = painted, 2 = outline, 3 = currentColor

  constructor(size = 32) {
    this.size = size;
    const len = size * size;
    this.r = new Uint8Array(len);
    this.g = new Uint8Array(len);
    this.b = new Uint8Array(len);
    this.a = new Uint8Array(len);
    this.tag = new Uint8Array(len);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  put(x: number, y: number, col: RGB | RGBA, pixelTag = 1): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (!this.inBounds(ix, iy)) return;
    const idx = iy * this.size + ix;
    const alpha = col.length === 4 ? col[3] : 255;
    if (alpha < 128) return;
    this.r[idx] = Math.max(0, Math.min(255, Math.round(col[0])));
    this.g[idx] = Math.max(0, Math.min(255, Math.round(col[1])));
    this.b[idx] = Math.max(0, Math.min(255, Math.round(col[2])));
    this.a[idx] = 255;
    this.tag[idx] = pixelTag;
  }

  putRamp(x: number, y: number, ramp: MaterialRamp, t: number): void {
    this.put(x, y, quantRamp(ramp, t, Math.round(x), Math.round(y)));
  }

  hasPixel(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    return this.a[y * this.size + x] > 0;
  }

  /**
   * Draws a filled tilted ellipsoid with spherical 3D surface normals & directional light dot.
   */
  fillEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    angleRad: number,
    shader: PixelShader,
  ): void {
    const cosA = Math.cos(-angleRad);
    const sinA = Math.sin(-angleRad);
    const bound = Math.ceil(Math.max(rx, ry)) + 2;
    const x0 = Math.max(0, Math.floor(cx - bound));
    const x1 = Math.min(this.size - 1, Math.ceil(cx + bound));
    const y0 = Math.max(0, Math.floor(cy - bound));
    const y1 = Math.min(this.size - 1, Math.ceil(cy + bound));

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dx = px - cx;
        const dy = py - cy;
        const lx = dx * cosA - dy * sinA;
        const ly = dx * sinA + dy * cosA;
        const nxLocal = lx / rx;
        const nyLocal = ly / ry;
        const r2 = nxLocal * nxLocal + nyLocal * nyLocal;
        if (r2 <= 1.0) {
          const nz = Math.sqrt(Math.max(0, 1 - r2));
          // Rotate local normal back to screen space for true directional lighting
          const wnx = nxLocal * cosA + nyLocal * sinA;
          const wny = -nxLocal * sinA + nyLocal * cosA;
          const light = Math.max(
            0,
            Math.min(1, 0.45 + 0.58 * (wnx * LIGHT_X + wny * LIGHT_Y + nz * LIGHT_Z)),
          );
          const col = shader(px, py, wnx, wny, nz, light, (nxLocal + 1) * 0.5, (nyLocal + 1) * 0.5);
          if (col) this.put(px, py, col);
        }
      }
    }
  }

  /**
   * Draws a tapered capsule segment with cylindrical normal lighting (ideal for angled tools,
   * horns, handles, necks, beams, branches, and arms).
   */
  fillCapsule(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    r1: number,
    r2: number,
    shader: PixelShader,
  ): void {
    const vx = x2 - x1;
    const vy = y2 - y1;
    const lenSq = vx * vx + vy * vy || 1;
    const len = Math.sqrt(lenSq);
    const maxR = Math.max(r1, r2) + 1;
    const minX = Math.max(0, Math.floor(Math.min(x1, x2) - maxR));
    const maxX = Math.min(this.size - 1, Math.ceil(Math.max(x1, x2) + maxR));
    const minY = Math.max(0, Math.floor(Math.min(y1, y2) - maxR));
    const maxY = Math.min(this.size - 1, Math.ceil(Math.max(y1, y2) + maxR));
    const ux = vx / len;
    const uy = vy / len;
    const pxN = -uy;
    const pyN = ux;

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const wx = px - x1;
        const wy = py - y1;
        const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq));
        const projX = x1 + vx * t;
        const projY = y1 + vy * t;
        const rx = px - projX;
        const ry = py - projY;
        const dist = Math.sqrt(rx * rx + ry * ry);
        const rad = r1 + (r2 - r1) * t;
        if (dist <= rad + 0.15) {
          const across = (rx * pxN + ry * pyN) / (rad || 1);
          const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, across * across)));
          const wnx = across * pxN;
          const wny = across * pyN;
          const light = Math.max(
            0,
            Math.min(1, 0.45 + 0.58 * (wnx * LIGHT_X + wny * LIGHT_Y + nz * LIGHT_Z)),
          );
          const col = shader(px, py, wnx, wny, nz, light, t, (across + 1) * 0.5);
          if (col) this.put(px, py, col);
        }
      }
    }
  }

  /**
   * Draws a smooth quadratic Bezier tapered ribbon (great for waves, horns, tails, flames, rivers).
   */
  fillBezier(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    rStart: number,
    rEnd: number,
    shader: PixelShader,
    steps = 28,
  ): void {
    let prevX = x0;
    let prevY = y0;
    let prevR = rStart;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const it = 1 - t;
      const nx = it * it * x0 + 2 * it * t * x1 + t * t * x2;
      const ny = it * it * y0 + 2 * it * t * y1 + t * t * y2;
      const nr = rStart + (rEnd - rStart) * t;
      this.fillCapsule(prevX, prevY, nx, ny, prevR, nr, (px, py, wnx, wny, nz, light, _u, v) =>
        shader(px, py, wnx, wny, nz, light, t, v),
      );
      prevX = nx;
      prevY = ny;
      prevR = nr;
    }
  }

  /**
   * Fills a convex or concave polygon with custom shader.
   */
  fillPoly(pts: ReadonlyArray<readonly [number, number]>, shader: PixelShader): void {
    if (pts.length < 3) return;
    let minX = this.size - 1;
    let maxX = 0;
    let minY = this.size - 1;
    let maxY = 0;
    for (const [x, y] of pts) {
      if (x < minX) minX = Math.floor(x);
      if (x > maxX) maxX = Math.ceil(x);
      if (y < minY) minY = Math.floor(y);
      if (y > maxY) maxY = Math.ceil(y);
    }
    minX = Math.max(0, minX);
    maxX = Math.min(this.size - 1, maxX);
    minY = Math.max(0, minY);
    maxY = Math.min(this.size - 1, maxY);
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);

    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.01;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.01;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i];
          const [xj, yj] = pts[j];
          const intersect =
            yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi || 1e-6) + xi;
          if (intersect) inside = !inside;
        }
        if (inside) {
          const u = (x - minX) / w;
          const v = (y - minY) / h;
          const light = Math.max(0, Math.min(1, 0.85 - 0.35 * u - 0.35 * v));
          const col = shader(x, y, -0.3, -0.5, 0.8, light, u, v);
          if (col) this.put(x, y, col);
        }
      }
    }
  }

  /**
   * Renders a crisp 3/4 isometric prism/block centered horizontally at cx with bottom apex at botY.
   * Left side is lit, right side is shadowed, top diamond is brightest with front-edge highlight!
   */
  fillIsoBox(
    cx: number,
    botY: number,
    rx: number,
    ry: number,
    height: number,
    topRamp: MaterialRamp,
    leftRamp: MaterialRamp,
    rightRamp: MaterialRamp,
    topPattern?: (x: number, y: number, u: number, v: number) => RGB | null,
  ): void {
    const topY = botY - height;
    const pTop: readonly [number, number] = [cx, topY - ry * 2];
    const pRight: readonly [number, number] = [cx + rx, topY - ry];
    const pMidTop: readonly [number, number] = [cx, topY];
    const pLeft: readonly [number, number] = [cx - rx, topY - ry];
    const pBotLeft: readonly [number, number] = [cx - rx, botY - ry];
    const pBotMid: readonly [number, number] = [cx, botY];
    const pBotRight: readonly [number, number] = [cx + rx, botY - ry];

    // Left sunlit wall
    this.fillPoly([pLeft, pMidTop, pBotMid, pBotLeft], (x, y, _nx, _ny, _nz, _l, u, v) =>
      quantRamp(leftRamp, 0.72 - v * 0.22 - u * 0.08, x, y, 0.03),
    );
    // Right shadowed wall
    this.fillPoly([pMidTop, pRight, pBotRight, pBotMid], (x, y, _nx, _ny, _nz, _l, u, v) =>
      quantRamp(rightRamp, 0.44 - v * 0.22 - u * 0.08, x, y, 0.03),
    );
    // Top sunlit diamond
    this.fillPoly([pTop, pRight, pMidTop, pLeft], (x, y, _nx, _ny, _nz, _l, u, v) => {
      if (topPattern) {
        const custom = topPattern(x, y, u, v);
        if (custom) return custom;
      }
      const edgeHighlight = v > 0.78 ? 0.12 : 0;
      return quantRamp(topRamp, 0.78 + edgeHighlight - u * 0.14 - v * 0.06, x, y, 0.03);
    });
  }

  /**
   * Places a crisp 1px Selective Hue-Shifted Outline ("sel-out") around the painted silhouette.
   * Shadow side (bottom-right) gets deep espresso/indigo ink; top-left lit rim gets richer colored ink
   * — matching the authentic painterly look of 32-bit RPG inventory icons.
   */
  applySelOut(darkness = 0.28): void {
    const toOutline: Array<{ x: number; y: number; r: number; g: number; b: number }> = [];
    const dirs: ReadonlyArray<readonly [number, number]> = [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
    ];

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.hasPixel(x, y)) continue;
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let count = 0;
        let litBias = 0;

        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (!this.inBounds(nx, ny)) continue;
          const nIdx = ny * this.size + nx;
          if (this.tag[nIdx] === 1 || this.tag[nIdx] === 3) {
            sumR += this.r[nIdx];
            sumG += this.g[nIdx];
            sumB += this.b[nIdx];
            count++;
            // If silhouette pixel is below/right of us, this outline pixel is on the top-left lit rim!
            if (dx > 0 || dy > 0) litBias++;
          }
        }

        if (count > 0) {
          const avgR = sumR / count;
          const avgG = sumG / count;
          const avgB = sumB / count;
          // Hue-shifted shadow dark ink (crisp separation on dark slots while keeping sel-out warmth)
          const k = litBias > 0 ? Math.min(0.38, darkness + 0.12) : darkness * 0.78;
          const outR = Math.max(14, Math.round(avgR * k * 0.9 + 6));
          const outG = Math.max(10, Math.round(avgG * k * 0.84 + 4));
          const outB = Math.max(13, Math.round(avgB * k * 0.94 + 6));
          toOutline.push({ x, y, r: outR, g: outG, b: outB });
        }
      }
    }

    for (const p of toOutline) {
      this.put(p.x, p.y, [p.r, p.g, p.b], 2);
    }
  }

  /** Helper: stamp tiny 1px or 4-point star sparkle */
  sparkle(cx: number, cy: number, col: RGB = [255, 252, 204], cross = false): void {
    this.put(cx, cy, col);
    if (cross) {
      const dim = lerpRgb(col, [245, 183, 66], 0.55);
      this.put(cx - 1, cy, dim);
      this.put(cx + 1, cy, dim);
      this.put(cx, cy - 1, dim);
      this.put(cx, cy + 1, dim);
    }
  }

  /** Compiles the 32x32 RGBA canvas into minimal horizontal SVG pixel runs */
  toCompiledSprite(): CompiledSprite {
    const runs: PixelRun[] = [];
    for (let y = 0; y < this.size; y++) {
      let x = 0;
      while (x < this.size) {
        const idx = y * this.size + x;
        if (this.a[idx] === 0) {
          x++;
          continue;
        }
        const tag = this.tag[idx];
        const fill =
          tag === 3 ? 'currentColor' : rgbHex(this.r[idx], this.g[idx], this.b[idx]);
        let w = 1;
        while (x + w < this.size) {
          const nIdx = y * this.size + x + w;
          if (this.a[nIdx] === 0) break;
          const nTag = this.tag[nIdx];
          const nFill =
            nTag === 3 ? 'currentColor' : rgbHex(this.r[nIdx], this.g[nIdx], this.b[nIdx]);
          if (nFill !== fill) break;
          w++;
        }
        runs.push({ x, y, w, fill });
        x += w;
      }
    }
    const { paths, hasCurrentColor } = buildPathsFromRuns(runs);
    return { size: this.size, runs, paths, hasCurrentColor };
  }
}

/** Convenient builder helper that initializes a 32x32 PixelCanvas, runs painter, applies sel-out & compiles */
export function paintSprite(
  draw: (c: PixelCanvas) => void,
  options?: { selOut?: boolean; selOutDarkness?: number; size?: number },
): CompiledSprite {
  const c = new PixelCanvas(options?.size ?? 32);
  draw(c);
  if (options?.selOut !== false) {
    c.applySelOut(options?.selOutDarkness ?? 0.28);
  }
  return c.toCompiledSprite();
}
