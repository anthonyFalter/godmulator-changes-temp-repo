import React, { useEffect, useRef, useState } from 'react';
import { EPOCHS } from '../game/catalog';
import type { EpochDefinition, EpochId } from '../game/types';

export interface AgeProgressEvent {
  id: number;
  fromIndex: number;
  toIndex: number;
}

interface AgeProgressBannerProps {
  event: AgeProgressEvent | null;
  onImpact: () => void;
  onComplete: () => void;
}

// 2:1 panoramic pixel-art diorama resolution tailored to fill each half of the circular time-wheel
const TILE_W = 80;
const TILE_H = 40;
const cachedSceneryUrls = new Map<EpochId, string>();

const EPOCH_COSMOS_PALETTE: Record<
  EpochId,
  { deep: string; mid: string; nebula: string; glow: string; spark: string }
> = {
  prehistoric: {
    deep: '#0b0916',
    mid: '#1c1228',
    nebula: '#4a1f2c',
    glow: '#d97736',
    spark: '#fde68a',
  },
  bronze: {
    deep: '#0a0e1d',
    mid: '#172038',
    nebula: '#453121',
    glow: '#e5a94c',
    spark: '#fef08a',
  },
  medieval: {
    deep: '#080e21',
    mid: '#122247',
    nebula: '#223e73',
    glow: '#d9a44e',
    spark: '#e0f2fe',
  },
  industrial: {
    deep: '#0c0b17',
    mid: '#1f1829',
    nebula: '#472c2a',
    glow: '#e09a4d',
    spark: '#fde68a',
  },
  atomic: {
    deep: '#071121',
    mid: '#0e2640',
    nebula: '#164d6b',
    glow: '#67e8f9',
    spark: '#fff7d6',
  },
  information: {
    deep: '#070c1f',
    mid: '#111e47',
    nebula: '#1e3a7a',
    glow: '#38bdf8',
    spark: '#e0f2fe',
  },
  orbital: {
    deep: '#060a1c',
    mid: '#101d42',
    nebula: '#1c3e75',
    glow: '#7dd3fc',
    spark: '#ffffff',
  },
  interstellar: {
    deep: '#07081a',
    mid: '#19133d',
    nebula: '#42206b',
    glow: '#fbbf24',
    spark: '#fef08a',
  },
};

/**
 * Renders a richly detailed 80x40 celestial astrolabe pixel-art illustration
 * (starry midnight cosmos, golden clockwork filigree arcs, and luminous ivory-gold age glyph)
 * tailored to fill each half of the rotating semicircular age dial.
 */
export function getEpochSceneryDataUrl(epochId: EpochId): string {
  const existing = cachedSceneryUrls.get(epochId);
  if (existing) return existing;
  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  canvas.width = TILE_W;
  canvas.height = TILE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;

  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  };

  // Pixel-crisp 1px circular arc centered at (cx, cy)
  const arcRing = (
    cx: number,
    cy: number,
    r: number,
    color: string,
    dashed = false
  ) => {
    ctx.fillStyle = color;
    const steps = Math.max(48, Math.round(r * 6));
    for (let i = 0; i <= steps; i++) {
      if (dashed && Math.floor(i / 2) % 2 === 1) continue;
      const a = Math.PI + (i / steps) * Math.PI; // upper semicircle
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r);
      if (x >= 0 && x < TILE_W && y >= 0 && y < TILE_H) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  };

  // Crisp 4-point celestial star glint
  const starGlint = (x: number, y: number, r: number, core: string, ray: string) => {
    px(x - r, y, r * 2 + 1, 1, ray);
    px(x, y - r, 1, r * 2 + 1, ray);
    px(x, y, 1, 1, core);
  };

  const pal = EPOCH_COSMOS_PALETTE[epochId];

  // --- 1. Starry Midnight Cosmos & Pixel-Dithered Nebula Glow ---
  for (let y = 0; y < TILE_H; y++) {
    for (let x = 0; x < TILE_W; x++) {
      // Distance from celestial dial center (40, 38) + subtle diagonal nebula tilt
      const dx = (x - 40) * 0.85;
      const dy = (y - 34) * 1.15;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dither = (x + y) % 2 === 0;
      const diagBand = Math.abs((y - 24) + (x - 40) * 0.28);

      let color = pal.deep;
      if (dist < 15 || (diagBand < 5 && dist < 34)) {
        color = dist < 11 ? pal.nebula : dither ? pal.nebula : pal.mid;
      } else if (dist < 27 || (diagBand < 10 && dist < 40)) {
        color = dist < 21 ? pal.mid : dither ? pal.mid : pal.deep;
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Subtle warm celestial aura right behind the central emblem
  for (let dy = -11; dy <= 11; dy++) {
    for (let dx = -13; dx <= 13; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= 11 && (dx + dy) % 2 === 0) {
        ctx.fillStyle = d < 6 ? pal.glow : pal.nebula;
        ctx.globalAlpha = d < 6 ? 0.22 : 0.35;
        ctx.fillRect(40 + dx, 20 + dy, 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;

  // --- 2. Intricate Golden Astrolabe Filigree Rings & Clockwork Gears ---
  // Concentric golden orbital arcs centered at the dial pivot (40, 40)
  arcRing(40, 40, 35, '#8f6a36', false);
  arcRing(40, 40, 32, '#d4af68', true);
  arcRing(40, 40, 23, '#735329', false);
  arcRing(40, 40, 14, '#b88f4a', true);

  // Interlocking pixel clockwork gear peeking from lower-left (echoing reference astrolabe)
  arcRing(22, 39, 13, '#c79b52', false);
  arcRing(22, 39, 10, '#f0d08a', true);
  arcRing(22, 39, 6, '#8f6a36', false);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI + (i / 7) * Math.PI;
    const gx = Math.round(22 + Math.cos(a) * 14);
    const gy = Math.round(39 + Math.sin(a) * 14);
    px(gx, gy, 2, 2, '#e6bf78');
  }

  // Secondary smaller celestial gear ring peeking from lower-right
  arcRing(59, 39, 11, '#9e763b', false);
  arcRing(59, 39, 8, '#d4af68', true);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + (i / 5) * Math.PI;
    const gx = Math.round(59 + Math.cos(a) * 12);
    const gy = Math.round(39 + Math.sin(a) * 12);
    px(gx, gy, 1, 2, '#d4af68');
  }

  // Fine radial astrolabe meridian crosshair lines
  for (let y = 3; y < 38; y += 2) {
    px(40, y, 1, 1, 'rgba(240,208,138,0.28)');
  }
  for (let i = -28; i <= 28; i += 2) {
    const y = 39 - Math.round(Math.abs(i) * 0.52);
    if (y >= 4 && y < 39) {
      px(40 + i, y, 1, 1, 'rgba(212,175,104,0.22)');
    }
  }

  // --- 3. Starlight Dust & 4-Point Celestial Sparkles ---
  const stars: Array<[number, number, string]> = [
    [12, 18, '#ffffff'],
    [16, 11, pal.spark],
    [25, 7, '#f7d2a6'],
    [32, 5, '#ffffff'],
    [49, 6, pal.spark],
    [57, 9, '#ffffff'],
    [65, 14, '#f7d2a6'],
    [69, 22, '#ffffff'],
    [10, 29, '#bae6fd'],
    [19, 24, pal.spark],
    [62, 26, '#bae6fd'],
    [71, 31, pal.spark],
    [29, 31, '#ffffff'],
    [52, 32, '#f7d2a6'],
  ];
  for (const [sx, sy, sc] of stars) px(sx, sy, 1, 1, sc);

  // Bright 4-point celestial star glints flanking the emblem
  starGlint(20, 14, 2, '#ffffff', pal.spark);
  starGlint(60, 15, 2, '#ffffff', '#fde68a');
  starGlint(15, 28, 1, '#ffffff', '#bae6fd');
  starGlint(66, 28, 1, '#ffffff', pal.spark);

  // --- 4. Luminous Celestial Ivory-Gold Age Emblem (Centered at x=40, y=20) ---
  // Styled after the crisp white-gold illuminated celestial icons in the reference astrolabe
  const ox = 16;
  const oy = -3;
  const paintCelestialEmblem = (
    pixels: Array<[number, number, number, number, string]>
  ) => {
    // Soft outer golden-starlight aura (2px corners) + crisp dark-cosmos separation outline
    for (const [x, y, w, h] of pixels) {
      px(x + ox - 1, y + oy - 1, w + 2, h + 2, '#070a17');
    }
    for (const [x, y, w, h] of pixels) {
      px(x + ox - 1, y + oy, w + 2, h, '#090e1f');
      px(x + ox, y + oy - 1, w, h + 2, '#090e1f');
    }
    for (const [x, y, w, h, c] of pixels) {
      px(x + ox, y + oy, w, h, c);
    }
  };

  switch (epochId) {
    case 'prehistoric': {
      // Celestial Hearth Flame & Golden Crescent Cradle
      paintCelestialEmblem([
        // Golden crescent hearth base
        [15, 32, 18, 2, '#d4a24e'],
        [17, 34, 14, 2, '#a67632'],
        [14, 30, 3, 2, '#f5d284'],
        [31, 30, 3, 2, '#f5d284'],
        // Outer golden flame silhouette
        [17, 22, 14, 9, '#e5a33e'],
        [18, 18, 12, 12, '#f5c258'],
        [20, 14, 8, 14, '#fde088'],
        [22, 10, 4, 7, '#fde088'],
        [23, 8, 2, 3, '#fff9db'],
        // Luminous ivory-white inner flame tongue
        [20, 21, 8, 9, '#fff9db'],
        [21, 16, 6, 12, '#ffffff'],
        [23, 12, 2, 6, '#ffffff'],
        // Flanking floating spark stars
        [15, 14, 2, 2, '#fef08a'],
        [31, 15, 2, 2, '#fef08a'],
      ]);
      break;
    }

    case 'bronze': {
      // Gilded Solar Anvil & Celestial Hammer
      paintCelestialEmblem([
        // Anvil base & column
        [16, 32, 16, 3, '#c99342'],
        [17, 32, 14, 1, '#f7d688'],
        [19, 27, 10, 5, '#e0ad55'],
        // Horned anvil body in luminous ivory-gold
        [12, 21, 24, 6, '#f5ca6e'],
        [9, 21, 5, 3, '#fef0b8'],
        [7, 21, 3, 2, '#ffffff'],
        [13, 21, 22, 2, '#ffffff'],
        [14, 23, 20, 1, '#fff6d1'],
        // Forging hammer poised above with starlight glint
        [20, 10, 10, 5, '#f5ca6e'],
        [21, 10, 8, 2, '#ffffff'],
        [23, 15, 3, 6, '#d4a24e'],
        [24, 15, 1, 6, '#fef0b8'],
        // Forge star sparks
        [15, 14, 2, 2, '#ffffff'],
        [33, 15, 2, 2, '#fef08a'],
      ]);
      break;
    }

    case 'medieval': {
      // Celestial Gold-Filigree Shield & Starlight Broadsword
      paintCelestialEmblem([
        // Ornate golden shield rim
        [14, 13, 20, 13, '#d9a448'],
        [15, 26, 18, 4, '#b88332'],
        [17, 30, 14, 3, '#b88332'],
        [20, 33, 8, 3, '#946522'],
        [15, 13, 18, 1, '#fff3c4'],
        // Midnight-indigo celestial field inside shield
        [16, 15, 16, 11, '#162854'],
        [17, 26, 14, 4, '#101d3d'],
        [19, 30, 10, 3, '#101d3d'],
        // Luminous white-gold broadsword bisecting shield
        [22, 7, 4, 24, '#e2e8f0'],
        [22, 7, 2, 23, '#ffffff'],
        [23, 6, 2, 2, '#ffffff'],
        // Radiant golden crossguard & pommel
        [17, 19, 14, 3, '#f5c258'],
        [18, 19, 12, 1, '#ffffff'],
        [23, 31, 2, 4, '#d9a448'],
        [22, 35, 4, 3, '#fde088'],
        [23, 36, 2, 1, '#ffffff'],
      ]);
      break;
    }

    case 'industrial': {
      // Grand Astrolabe Brass & Ivory Clockwork Gear
      paintCelestialEmblem([
        // 8 cardinal & diagonal gear teeth
        [21, 8, 6, 30, '#d9a448'],
        [9, 20, 30, 6, '#d9a448'],
        [12, 11, 6, 6, '#c7913a'],
        [30, 11, 6, 6, '#c7913a'],
        [12, 29, 6, 6, '#c7913a'],
        [30, 29, 6, 6, '#c7913a'],
        // Gleaming ivory-gold outer ring
        [14, 13, 20, 20, '#f5ca6e'],
        [15, 12, 18, 22, '#f5ca6e'],
        [13, 14, 22, 18, '#f5ca6e'],
        [15, 13, 14, 2, '#ffffff'],
        [22, 9, 4, 2, '#fff9db'],
        // Deep cosmic inner wheel well
        [17, 16, 14, 14, '#141a33'],
        // Delicate luminous ivory spokes
        [23, 16, 2, 14, '#fff6d1'],
        [17, 22, 14, 2, '#fff6d1'],
        // Radiant central jewel hub
        [20, 19, 8, 8, '#fde088'],
        [22, 21, 4, 4, '#ffffff'],
      ]);
      break;
    }

    case 'atomic': {
      // Celestial Orbital Atom with Glowing White-Gold Nucleus
      paintCelestialEmblem([
        // Outer luminous orbital rings
        [22, 8, 4, 30, '#7dd3fc'],
        [9, 21, 30, 4, '#7dd3fc'],
        [14, 13, 20, 20, '#bae6fd'],
        [16, 15, 16, 16, '#0d1d38'],
        [23, 9, 2, 28, '#ffffff'],
        [10, 22, 28, 2, '#ffffff'],
        [18, 17, 12, 12, '#0a162b'],
        // Radiant golden-white nucleus
        [20, 19, 8, 8, '#f5c258'],
        [21, 20, 6, 6, '#fef08a'],
        [22, 21, 4, 4, '#ffffff'],
        // Sparkling orbital electron stars
        [12, 11, 3, 3, '#ffffff'],
        [33, 11, 3, 3, '#ffffff'],
        [12, 32, 3, 3, '#ffffff'],
        [33, 32, 3, 3, '#ffffff'],
      ]);
      break;
    }

    case 'information': {
      // Constellation Circuit Star-Chip (Gold Pins & Luminous Ivory-Cyan Core)
      paintCelestialEmblem([
        // Gold filigree pins
        [17, 8, 2, 5, '#f5c258'],
        [23, 8, 2, 5, '#fff3c4'],
        [29, 8, 2, 5, '#f5c258'],
        [17, 34, 2, 5, '#f5c258'],
        [23, 34, 2, 5, '#fff3c4'],
        [29, 34, 2, 5, '#f5c258'],
        [8, 16, 5, 2, '#f5c258'],
        [8, 22, 5, 2, '#fff3c4'],
        [8, 28, 5, 2, '#f5c258'],
        [35, 16, 5, 2, '#f5c258'],
        [35, 22, 5, 2, '#fff3c4'],
        [35, 28, 5, 2, '#f5c258'],
        // Gold-framed cosmic chassis
        [13, 12, 22, 22, '#d9a448'],
        [14, 13, 20, 20, '#0c1630'],
        [14, 13, 20, 1, '#fff3c4'],
        // Luminous constellation die core
        [18, 17, 12, 12, '#38bdf8'],
        [19, 18, 10, 10, '#bae6fd'],
        [21, 20, 6, 6, '#ffffff'],
        [23, 16, 2, 14, '#ffffff'],
        [17, 22, 14, 2, '#ffffff'],
      ]);
      break;
    }

    case 'orbital': {
      // Ascendant Ivory-Gold Star-Vessel
      paintCelestialEmblem([
        // Golden nose tip
        [23, 7, 2, 3, '#fde088'],
        [22, 10, 4, 3, '#f5c258'],
        // Luminous ivory fuselage
        [20, 13, 8, 15, '#e2e8f0'],
        [21, 13, 5, 15, '#ffffff'],
        // Celestial sapphire viewport
        [22, 16, 4, 4, '#38bdf8'],
        [23, 17, 2, 2, '#ffffff'],
        // Gold swept celestial fins
        [20, 25, 8, 2, '#d9a448'],
        [15, 23, 5, 6, '#d9a448'],
        [16, 24, 3, 4, '#fef08a'],
        [28, 23, 5, 6, '#d9a448'],
        [29, 24, 3, 4, '#fef08a'],
        // Starlight plasma tail
        [21, 29, 6, 3, '#f5c258'],
        [22, 31, 4, 5, '#fef08a'],
        [23, 32, 2, 6, '#ffffff'],
      ]);
      break;
    }

    case 'interstellar': {
      // Transcendent 8-Point Celestial Compass Star (pure Genshin astrolabe aesthetic)
      paintCelestialEmblem([
        // Long razor-sharp cardinal compass spikes
        [23, 6, 2, 34, '#f5c258'],
        [7, 22, 34, 2, '#f5c258'],
        [22, 10, 4, 26, '#fde088'],
        [11, 21, 26, 4, '#fde088'],
        // Diagonal star rays
        [13, 12, 5, 5, '#fef08a'],
        [30, 12, 5, 5, '#fef08a'],
        [13, 29, 5, 5, '#fef08a'],
        [30, 29, 5, 5, '#fef08a'],
        // Concentric celestial ring & blazing white core
        [17, 16, 14, 14, '#fef08a'],
        [19, 18, 10, 10, '#ffffff'],
        [23, 8, 2, 30, '#ffffff'],
        [9, 22, 30, 2, '#ffffff'],
      ]);
      break;
    }
  }

  const url = canvas.toDataURL('image/png');
  cachedSceneryUrls.set(epochId, url);
  return url;
}

interface PixelBurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  age: number;
  life: number;
  gravity: number;
  drag: number;
  sparkle: boolean;
}

const IMPACT_DELAY_MS = 960;
const EXIT_START_MS = 2850;
const TOTAL_DURATION_MS = 3300;

export const AgeProgressBanner: React.FC<AgeProgressBannerProps> = ({
  event,
  onImpact,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'enter' | 'spinning' | 'impact' | 'exit'>('enter');
  const [showNewText, setShowNewText] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<PixelBurstParticle[]>([]);
  const onImpactRef = useRef(onImpact);
  const onCompleteRef = useRef(onComplete);
  onImpactRef.current = onImpact;
  onCompleteRef.current = onComplete;

  const fromEpoch: EpochDefinition =
    EPOCHS[Math.max(0, Math.min(EPOCHS.length - 1, event?.fromIndex ?? 0))] ?? EPOCHS[0];
  const toEpoch: EpochDefinition =
    EPOCHS[Math.max(0, Math.min(EPOCHS.length - 1, event?.toIndex ?? 0))] ?? EPOCHS[0];

  // Trigger timeline phases & particle burst synchronized to the full-dial 180° lock-in
  useEffect(() => {
    if (!event) return;

    setPhase('enter');
    setShowNewText(false);
    particlesRef.current = [];

    const spinTimer = window.setTimeout(() => {
      setPhase('spinning');
    }, 340);

    const impactTimer = window.setTimeout(() => {
      setPhase('impact');
      setShowNewText(true);
      onImpactRef.current();

      const canvas = canvasRef.current;
      const cw = canvas ? canvas.width : 580;
      const dialOriginX = cw * 0.5 - 102;
      const dialOriginY = 92;
      const palette = [
        '#fff9db',
        '#fde047',
        '#f5c258',
        '#f7d2a6',
        toEpoch.accentColor,
        '#ffffff',
      ];
      const burst: PixelBurstParticle[] = [];

      // 1. High-energy radial pixel starlight burst around the half-circle dial
      for (let i = 0; i < 56; i++) {
        const angle = (i / 56) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const speed = 135 + Math.random() * 255;
        burst.push({
          x: dialOriginX + (Math.random() - 0.5) * 32,
          y: dialOriginY + (Math.random() - 0.5) * 24,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 25,
          size: Math.random() < 0.32 ? 8 : Math.random() < 0.72 ? 6 : 4,
          color: palette[Math.floor(Math.random() * palette.length)],
          age: 0,
          life: 0.52 + Math.random() * 0.52,
          gravity: 320 + Math.random() * 140,
          drag: 0.94,
          sparkle: Math.random() < 0.45,
        });
      }

      // 2. Horizontal pixel spark shimmer along the newly revealed age title on the right
      for (let i = 0; i < 28; i++) {
        const tx = cw * 0.5 + 36 + (Math.random() - 0.5) * 190;
        const ty = dialOriginY + 6 + (Math.random() - 0.5) * 24;
        burst.push({
          x: tx,
          y: ty,
          vx: (tx - dialOriginX) * 0.65 + (Math.random() - 0.5) * 85,
          vy: -(55 + Math.random() * 150),
          size: Math.random() < 0.5 ? 6 : 4,
          color: i % 3 === 0 ? '#ffffff' : i % 2 === 0 ? '#fde047' : toEpoch.accentColor,
          age: 0,
          life: 0.6 + Math.random() * 0.5,
          gravity: 250,
          drag: 0.95,
          sparkle: true,
        });
      }

      particlesRef.current = burst;
    }, IMPACT_DELAY_MS);

    const exitTimer = window.setTimeout(() => {
      setPhase('exit');
    }, EXIT_START_MS);

    const doneTimer = window.setTimeout(() => {
      onCompleteRef.current();
    }, TOTAL_DURATION_MS);

    return () => {
      window.clearTimeout(spinTimer);
      window.clearTimeout(impactTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, [event, toEpoch.accentColor]);

  // Dedicated crisp pixel-particle canvas animation loop (zero React re-renders per frame)
  useEffect(() => {
    if (!event) return;
    let rafId = 0;
    let lastTs = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const list = particlesRef.current;
        for (let i = list.length - 1; i >= 0; i--) {
          const p = list[i];
          p.age += dt;
          if (p.age >= p.life) {
            list.splice(i, 1);
            continue;
          }
          const damp = Math.pow(p.drag, dt * 60);
          p.vx *= damp;
          p.vy = p.vy * damp + p.gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          const t = p.age / p.life;
          const alpha = t > 0.65 ? Math.max(0, 1 - (t - 0.65) / 0.35) : 1;
          if (p.sparkle && Math.floor(p.age * 24) % 3 === 0) continue;

          const sz = Math.max(2, Math.round((p.size * (1 - t * 0.35)) / 2) * 2);
          const rx = Math.round(p.x / 2) * 2 - (sz >> 1);
          const ry = Math.round(p.y / 2) * 2 - (sz >> 1);

          ctx.globalAlpha = alpha;
          if (sz >= 6) {
            ctx.fillStyle = '#090e1f';
            ctx.fillRect(rx - 2, ry - 2, sz + 4, sz + 4);
          }
          ctx.fillStyle = p.color;
          ctx.fillRect(rx, ry, sz, sz);
        }
        ctx.globalAlpha = 1;
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [event]);

  if (!event) return null;

  const fromUrl = getEpochSceneryDataUrl(fromEpoch.id);
  const toUrl = getEpochSceneryDataUrl(toEpoch.id);
  const displayedEpoch = showNewText ? toEpoch : fromEpoch;

  const wheelPhaseClass =
    phase === 'spinning'
      ? 'age-dial-wheel-rotate'
      : phase === 'impact'
        ? 'age-dial-wheel-impact'
        : phase === 'enter'
          ? 'age-dial-wheel-ready'
          : 'age-dial-wheel-settled';

  return (
    <div
      key={event.id}
      data-testid="age-progress-banner"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[48] flex items-start justify-center pt-[76px] sm:pt-[72px] select-none ${
        phase === 'exit' ? 'age-banner-exit' : 'age-banner-enter'
      }`}
    >
      {/* Unified Horizontal HUD Plaque: Full-Bleed Celestial Astrolabe Dial (Left) + Age Title (Right) */}
      <div className="relative flex items-center justify-center">
        {/* Crisp pixelated explosion particle canvas aligned to dial + title */}
        <canvas
          ref={canvasRef}
          width={580}
          height={260}
          className="pixelated-canvas pointer-events-none absolute left-1/2 -top-[52px] -translate-x-1/2 w-[580px] h-[260px] max-w-[100vw]"
        />

        <div
          className={`px-panel-hero pt-3.5 pb-2.5 pl-3 pr-4 sm:pt-4 sm:pb-3 sm:pl-4 sm:pr-7 flex flex-row items-center gap-3.5 sm:gap-4 min-w-[280px] sm:min-w-[356px] ${
            showNewText ? 'age-text-slam' : ''
          }`}
        >
          {/* LEFT: Full-Bleed Half-Circle Celestial Astrolabe Wheel (Exact 2:1 Semicircle) */}
          <div className="relative shrink-0 w-[108px] h-[57px] sm:w-[128px] sm:h-[67px]">
            {/* Semicircular Clipped Celestial Viewport */}
            <div
              className="relative w-full h-full rounded-t-full overflow-hidden border-t-[3px] border-x-[3px] border-b-[3px] border-[#0c0705] bg-[#080d1e]"
              style={{
                boxShadow:
                  '0 0 0 1.5px #e6bf78, 0 0 10px rgba(230,191,120,0.22), 0 4px 0 rgba(10,6,4,0.82)',
              }}
            >
              {/* Full Circular Two-Half Celestial Disk (Top Half = Previous Age, Bottom Half = Next Age) */}
              <div
                className={`absolute left-0 top-0 w-[102px] h-[102px] sm:w-[122px] sm:h-[122px] rounded-full overflow-hidden ${wheelPhaseClass}`}
                style={{ willChange: 'transform' }}
              >
                {/* TOP HALF (0°): Full-Bleed Previous Age Celestial Scene */}
                <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden">
                  <img
                    src={fromUrl}
                    alt={fromEpoch.name}
                    className="pixelated-canvas w-full h-full block object-cover"
                  />
                </div>

                {/* BOTTOM HALF (180°): Full-Bleed Next Age Celestial Scene (pre-rotated 180° to land upright) */}
                <div
                  className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden"
                  style={{ transform: 'rotate(180deg)' }}
                >
                  <img
                    src={toUrl}
                    alt={toEpoch.name}
                    className="pixelated-canvas w-full h-full block object-cover"
                  />
                </div>

                {/* Golden Astrolabe Seam Divider Separating the Two Ages Across the Diameter */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-[4px] bg-[#070a17] flex items-center"
                >
                  <div className="w-full h-[2px] bg-gradient-to-r from-[#b88f4a] via-[#fff6d1] to-[#b88f4a]" />
                </div>

                {/* Center Astrolabe Pivot Jewel */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full bg-[#fff6d1] border-[2px] border-[#070a17]"
                  style={{ boxShadow: '0 0 8px rgba(255,246,209,0.9)' }}
                />
              </div>

              {/* Ornate Celestial Astrolabe Golden Filigree Rim & Degree Ticks Overlay */}
              <svg
                viewBox="0 0 128 64"
                className="pointer-events-none absolute inset-0 w-full h-full"
                aria-hidden="true"
              >
                {/* Outer & inner double golden astrolabe arcs */}
                <path
                  d="M 2 63 A 62 62 0 0 1 126 63"
                  fill="none"
                  stroke="#f5d284"
                  strokeWidth="1.8"
                  opacity="0.92"
                />
                <path
                  d="M 7 63 A 57 57 0 0 1 121 63"
                  fill="none"
                  stroke="#fff6d1"
                  strokeWidth="0.9"
                  strokeDasharray="2 3"
                  opacity="0.72"
                />
                {/* Fine radial astrolabe degree ticks along the rim */}
                {[-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75].map((deg) => {
                  const rad = ((deg - 90) * Math.PI) / 180;
                  const isMajor = deg % 30 === 0;
                  const rOuter = 61;
                  const rInner = isMajor ? 54 : 57;
                  const x1 = 64 + Math.cos(rad) * rInner;
                  const y1 = 63 + Math.sin(rad) * rInner;
                  const x2 = 64 + Math.cos(rad) * rOuter;
                  const y2 = 63 + Math.sin(rad) * rOuter;
                  return (
                    <line
                      key={deg}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isMajor ? '#ffffff' : '#f5d284'}
                      strokeWidth={isMajor ? 1.5 : 0.9}
                      opacity={isMajor ? 0.95 : 0.7}
                    />
                  );
                })}
              </svg>

              {/* Crisp white-gold zenith lock-in flash across the full semicircle */}
              {phase === 'impact' && (
                <div className="age-impact-flash pointer-events-none absolute inset-0 bg-[#fff9db]" />
              )}

              {/* Bottom Horizon Golden Rim Trim */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-[#8f6a36] via-[#fff6d1] to-[#8f6a36]"
              />
            </div>

            {/* Ornate Zenith Compass Diamond Pointer at 12 o'clock */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute left-1/2 -top-[5px] -translate-x-1/2 w-[11px] h-[11px] rotate-45 bg-[#fff6d1] border-[2px] border-[#0c0705] ${
                phase === 'impact' ? 'age-zenith-pulse' : ''
              }`}
              style={{
                boxShadow: '0 0 8px rgba(255,246,209,0.9)',
              }}
            />

            {/* Left & Right Horizon Celestial Nodes */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-[3px] bottom-[-2px] w-[7px] h-[7px] rounded-full bg-[#fff6d1] border-[1.5px] border-[#0c0705]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-[3px] bottom-[-2px] w-[7px] h-[7px] rounded-full bg-[#e6bf78] border-[1.5px] border-[#0c0705]"
            />
          </div>

          {/* RIGHT: Eyebrow Copy & Age Title Text */}
          <div className="flex flex-col items-start text-left justify-center min-w-0">
            <span className="font-pixel-num text-[10px] sm:text-[11px] font-bold tracking-[0.08em] text-[#e6c38d] leading-tight mb-0.5 whitespace-nowrap">
              Your world has reached the
            </span>
            <span
              data-testid="age-progress-banner-title"
              className="font-bold text-base sm:text-xl leading-tight tracking-wide whitespace-nowrap"
              style={{
                color: showNewText ? '#ffe49e' : '#eadbc6',
                textShadow:
                  '0 2px 0 #140c08, 2px 0 0 #140c08, -2px 0 0 #140c08, 0 -2px 0 #140c08',
              }}
            >
              {displayedEpoch.name}
            </span>
            {/* Subtle decorative golden underline accent */}
            <div
              aria-hidden="true"
              className="mt-1.5 h-[2px] w-full max-w-[160px] bg-gradient-to-r from-[#f7d2a6] via-[#d99968]/70 to-transparent"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
