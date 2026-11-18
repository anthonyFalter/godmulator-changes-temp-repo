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

/**
 * Compiles a character-grid pixel sprite into minimal horizontal runs and grouped SVG paths.
 */
export function compileSprite(spec: SpriteSpec): CompiledSprite {
  const size = spec.size ?? 24;
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
 * Shared fantasy RPG pixel-art base ink & material tokens.
 */
export const RPG_PAL = {
  O: '#130c0b',
  W: '#fffdf5',
  w: '#f4ead5',
  p: '#d7c5a3',
  P: '#9f8a68',
  Y: '#fff4a3',
  G: '#ffd166',
  g: '#e69b28',
  D: '#9c5b14',
  S: '#f1f5f9',
  s: '#cbd5e1',
  m: '#7f8ea3',
  M: '#475569',
  B: '#e09f67',
  b: '#b86f3e',
  k: '#7d4423',
  K: '#4e2713',
  R: '#ff6b6b',
  r: '#e03131',
  v: '#9c1922',
  V: '#5c0c15',
  A: '#ffa94d',
  a: '#f76707',
  E: '#b2f2bb',
  e: '#51cf66',
  l: '#2b8a3e',
  L: '#155724',
  C: '#d0f4ff',
  c: '#56cfe1',
  u: '#228be6',
  U: '#184e87',
  Q: '#f3d9fa',
  q: '#be4bdb',
  z: '#7928ca',
  Z: '#3c096c',
  T: '#d6d0c4',
  t: '#9c9487',
  h: '#665f56',
  H: '#3a3530',
} as const;
