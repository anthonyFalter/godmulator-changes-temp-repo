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

const TILE_PX = 32;
const cachedSceneryUrls = new Map<EpochId, string>();

/**
 * Renders a crisp 32x32 handcrafted pixel-art square scenery + foreground age icon
 * for each of the 8 civilization epochs (100% procedural, zero external assets).
 */
export function getEpochSceneryDataUrl(epochId: EpochId): string {
  const existing = cachedSceneryUrls.get(epochId);
  if (existing) return existing;
  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  // --- 1. Epoch-Specific Miniature Pixel Landscape Scenery Background ---
  switch (epochId) {
    case 'prehistoric': {
      // Warm volcanic twilight sky + smoking peak + pine ridge + savanna earth
      px(0, 0, 32, 8, '#5a2822');
      px(0, 8, 32, 7, '#9e472b');
      px(0, 15, 32, 6, '#dc7b3c');
      // Setting sun disc
      px(22, 11, 5, 5, '#ffd470');
      px(23, 10, 3, 7, '#ffd470');
      px(23, 12, 3, 3, '#fff5cc');
      // Volcano silhouette & faint smoke
      px(6, 5, 2, 2, '#9c8679');
      px(8, 3, 3, 2, '#b8a395');
      px(3, 14, 10, 7, '#4d2b24');
      px(5, 11, 6, 4, '#4d2b24');
      px(6, 9, 4, 2, '#3a1f1a');
      px(7, 9, 2, 1, '#ff7b29'); // glowing caldera rim
      // Distant dark ridge & ground
      px(0, 20, 32, 4, '#4b5d2a');
      px(0, 24, 32, 8, '#38461f');
      px(0, 22, 32, 1, '#6a7f37');
      // Little savanna trees on edges
      px(2, 17, 3, 3, '#2d451e');
      px(3, 20, 1, 2, '#5c3a21');
      px(27, 18, 3, 3, '#2d451e');
      px(28, 21, 1, 2, '#5c3a21');
      break;
    }
    case 'bronze': {
      // Sun-drenched desert sky + sun + stepped Ziggurat + sandstone dunes
      px(0, 0, 32, 7, '#2f6a94');
      px(0, 7, 32, 7, '#589cc0');
      px(0, 14, 32, 7, '#e2b96f');
      // Blazing desert sun
      px(4, 4, 5, 5, '#ffe066');
      px(5, 3, 3, 7, '#ffe066');
      px(5, 5, 3, 3, '#fff9db');
      // Distant stepped Ziggurat
      px(17, 17, 13, 5, '#b87d3b');
      px(19, 14, 9, 3, '#c98e47');
      px(21, 11, 5, 3, '#db9f56');
      px(22, 12, 3, 1, '#f4c77b');
      // Golden dunes & palm
      px(0, 21, 32, 11, '#c98a3b');
      px(0, 21, 18, 2, '#e3a854');
      px(12, 24, 20, 8, '#a66d29');
      px(2, 18, 4, 2, '#3b7a38');
      px(3, 20, 1, 4, '#6e4726');
      break;
    }
    case 'medieval': {
      // Clear kingdom sky + pixel clouds + emerald hills + castle keep
      px(0, 0, 32, 8, '#3b78b8');
      px(0, 8, 32, 8, '#6ca9dc');
      px(0, 16, 32, 5, '#a8d4f0');
      // Fluffy clouds
      px(3, 4, 7, 2, '#f4f9ff');
      px(5, 3, 4, 1, '#ffffff');
      px(22, 5, 6, 2, '#f4f9ff');
      // Distant stone castle battlements
      px(20, 13, 9, 8, '#7b8794');
      px(20, 11, 2, 2, '#9aa5b1');
      px(24, 11, 2, 2, '#9aa5b1');
      px(27, 11, 2, 2, '#9aa5b1');
      px(24, 8, 1, 3, '#3b2416');
      px(25, 8, 3, 2, '#dc2626'); // red royal pennant
      // Rolling green meadows
      px(0, 20, 32, 5, '#4d9a42');
      px(0, 19, 14, 2, '#65b852');
      px(0, 25, 32, 7, '#347330');
      break;
    }
    case 'industrial': {
      // Warm smoky factory sunset + brick mill skyline + billowing steam
      px(0, 0, 32, 7, '#453b47');
      px(0, 7, 32, 7, '#7c5c52');
      px(0, 14, 32, 7, '#c7854b');
      // Smoke plumes from stacks
      px(5, 3, 4, 3, '#c4beb8');
      px(8, 2, 4, 2, '#dcd7d2');
      px(24, 4, 4, 2, '#b8b2ac');
      // Factory roofs & smokestacks
      px(4, 7, 3, 14, '#5e3528');
      px(23, 8, 3, 13, '#5e3528');
      px(1, 15, 11, 7, '#753f2c');
      px(20, 14, 11, 8, '#683625');
      // Lit factory windows
      px(3, 17, 2, 2, '#ffd166');
      px(7, 17, 2, 2, '#ffd166');
      px(22, 16, 2, 2, '#ffd166');
      px(27, 16, 2, 2, '#ffd166');
      // Cobblestone / rail yard ground
      px(0, 22, 32, 10, '#3a3438');
      px(0, 22, 32, 2, '#574e52');
      break;
    }
    case 'atomic': {
      // Crisp cyan-teal mid-century sky + concrete towers & cooling tower
      px(0, 0, 32, 8, '#1a4b6e');
      px(0, 8, 32, 8, '#2f7ca3');
      px(0, 16, 32, 6, '#76bcd4');
      // Steam puff & cooling tower
      px(4, 5, 5, 2, '#e2f1f8');
      px(3, 11, 7, 11, '#8fa3b0');
      px(4, 9, 5, 3, '#a9bcc7');
      // Modernist skyline on right
      px(22, 10, 5, 12, '#5e7382');
      px(27, 13, 4, 9, '#485c6b');
      px(23, 12, 1, 8, '#a5f3fc');
      px(25, 12, 1, 8, '#a5f3fc');
      // Concrete highway horizon
      px(0, 22, 32, 10, '#2e3e4a');
      px(0, 22, 32, 2, '#536878');
      px(2, 26, 5, 1, '#facc15');
      px(12, 26, 5, 1, '#facc15');
      px(22, 26, 5, 1, '#facc15');
      break;
    }
    case 'information': {
      // Electric dusk skyline + neon-lit glass skyscrapers
      px(0, 0, 32, 9, '#111d38');
      px(0, 9, 32, 8, '#1e3a6e');
      px(0, 17, 32, 5, '#2b5ca3');
      // Skyscrapers with cyan/amber grid windows
      px(1, 9, 6, 14, '#1c2b47');
      px(7, 13, 5, 10, '#25395e');
      px(21, 8, 6, 15, '#1b2c4a');
      px(27, 12, 4, 11, '#243a61');
      for (let wy = 11; wy <= 20; wy += 3) {
        px(2, wy, 2, 1, '#38bdf8');
        px(5, wy, 1, 1, '#facc15');
        px(22, wy, 2, 1, '#38bdf8');
        px(25, wy, 1, 1, '#7dd3fc');
      }
      // Illuminated transit boulevard
      px(0, 23, 32, 9, '#131d30');
      px(0, 23, 32, 1, '#38bdf8');
      break;
    }
    case 'orbital': {
      // Deep space indigo + stars + curved bright cyan planet horizon
      px(0, 0, 32, 14, '#091024');
      px(0, 14, 32, 9, '#112247');
      // Crisp pixel stars
      px(3, 3, 1, 1, '#ffffff');
      px(10, 5, 1, 1, '#bae6fd');
      px(26, 4, 1, 1, '#ffffff');
      px(22, 9, 1, 1, '#fef08a');
      px(5, 11, 1, 1, '#e0f2fe');
      px(28, 12, 1, 1, '#ffffff');
      // Curved planet limb + atmosphere glow
      px(0, 23, 32, 9, '#1c5d8a');
      px(4, 21, 24, 3, '#2b86b8');
      px(9, 20, 14, 2, '#38bdf8');
      px(8, 19, 16, 1, '#a5f3fc'); // atmospheric halo
      px(6, 25, 8, 3, '#34a853'); // orbital continent patch
      px(20, 26, 7, 3, '#34a853');
      break;
    }
    case 'interstellar': {
      // Deep cosmic starfield + golden/violet nebula band + twin stars
      px(0, 0, 32, 32, '#090b1a');
      // Diagonal nebula glow bands
      px(0, 16, 32, 9, '#1d1438');
      px(2, 12, 28, 7, '#311a4f');
      px(6, 9, 20, 5, '#4c2459');
      // Starfield
      px(3, 4, 1, 1, '#ffffff');
      px(9, 2, 1, 1, '#fde047');
      px(26, 3, 2, 2, '#f9a8d4');
      px(28, 10, 1, 1, '#ffffff');
      px(4, 19, 1, 1, '#7dd3fc');
      px(27, 23, 1, 1, '#fde047');
      px(7, 27, 1, 1, '#ffffff');
      px(21, 28, 1, 1, '#c4b5fd');
      // Distant ringed golden planet
      px(22, 20, 6, 6, '#d97706');
      px(23, 21, 3, 2, '#fcd34d');
      px(20, 23, 10, 1, '#fef08a');
      break;
    }
  }

  // --- 2. Foreground Crisp Outlined Pixel Age Icon (Centered over Scenery) ---
  // Helper to paint an outlined pixel emblem cleanly
  const paintEmblem = (pixels: Array<[number, number, number, number, string]>) => {
    // 1px dark silhouette halo behind emblem so icon pops sharply against scenery
    for (const [x, y, w, h] of pixels) {
      px(x - 1, y, w + 2, h, '#140c08');
      px(x, y - 1, w, h + 2, '#140c08');
    }
    for (const [x, y, w, h, c] of pixels) {
      px(x, y, w, h, c);
    }
  };

  switch (epochId) {
    case 'prehistoric': {
      // Crackling Bonfire logs + bright layered flame
      paintEmblem([
        [10, 21, 12, 3, '#7c4324'],
        [11, 20, 10, 2, '#a35d34'],
        [12, 13, 8, 8, '#ea580c'],
        [13, 10, 6, 9, '#f97316'],
        [15, 8, 2, 4, '#f97316'],
        [14, 13, 4, 6, '#facc15'],
        [15, 15, 2, 4, '#fff9db'],
      ]);
      break;
    }
    case 'bronze': {
      // Gleaming Bronze Anvil & Hammer
      paintEmblem([
        [11, 21, 10, 3, '#9a5a20'],
        [13, 18, 6, 3, '#b86f28'],
        [8, 14, 16, 4, '#e59f3e'],
        [7, 14, 3, 2, '#f8cb70'],
        [10, 15, 12, 1, '#fde68a'],
        // Hammer resting above
        [14, 7, 7, 4, '#f3b754'],
        [15, 8, 4, 1, '#fff3c4'],
        [15, 11, 2, 3, '#7c4324'],
      ]);
      break;
    }
    case 'medieval': {
      // Heraldic Shield + Vertical Silver Broadsword
      paintEmblem([
        [10, 10, 12, 9, '#b91c1c'],
        [11, 19, 10, 3, '#b91c1c'],
        [13, 22, 6, 2, '#991b1b'],
        [11, 11, 10, 7, '#dc2626'],
        [15, 7, 2, 16, '#e2e8f0'], // sword blade
        [15, 7, 1, 14, '#ffffff'],
        [12, 14, 8, 2, '#facc15'], // gold crossguard
        [15, 23, 2, 2, '#f59e0b'], // pommel
      ]);
      break;
    }
    case 'industrial': {
      // Heavy Burnished Brass Steam Gear
      paintEmblem([
        [14, 7, 4, 18, '#d48c46'],
        [7, 14, 18, 4, '#d48c46'],
        [10, 10, 12, 12, '#e29e53'],
        [9, 9, 3, 3, '#d48c46'],
        [20, 9, 3, 3, '#d48c46'],
        [9, 20, 3, 3, '#d48c46'],
        [20, 20, 3, 3, '#d48c46'],
        [12, 12, 8, 8, '#f7d2a6'],
        [14, 14, 4, 4, '#33241b'], // center axle hole
      ]);
      break;
    }
    case 'atomic': {
      // Radiant Cyan-Gold Atom Emblem
      paintEmblem([
        [15, 7, 2, 18, '#38bdf8'],
        [7, 15, 18, 2, '#38bdf8'],
        [10, 10, 12, 12, '#0ea5e9'],
        [12, 12, 8, 8, '#1b3b52'],
        [14, 14, 4, 4, '#facc15'], // glowing nucleus
        [15, 15, 2, 2, '#ffffff'],
        [9, 9, 2, 2, '#bae6fd'], // electrons
        [21, 9, 2, 2, '#bae6fd'],
        [9, 21, 2, 2, '#bae6fd'],
        [21, 21, 2, 2, '#bae6fd'],
      ]);
      break;
    }
    case 'information': {
      // Electric Pixel Microchip Processor
      paintEmblem([
        [10, 10, 12, 12, '#2563eb'],
        [11, 11, 10, 10, '#1e293b'],
        [13, 13, 6, 6, '#38bdf8'],
        [14, 14, 4, 4, '#e0f2fe'],
        // Gold pins around all 4 sides
        [12, 7, 2, 3, '#facc15'],
        [18, 7, 2, 3, '#facc15'],
        [12, 22, 2, 3, '#facc15'],
        [18, 22, 2, 3, '#facc15'],
        [7, 12, 3, 2, '#facc15'],
        [7, 18, 3, 2, '#facc15'],
        [22, 12, 3, 2, '#facc15'],
        [22, 18, 3, 2, '#facc15'],
      ]);
      break;
    }
    case 'orbital': {
      // Sleek Pixel Rocket Launching Skyward
      paintEmblem([
        [15, 6, 2, 3, '#ef4444'], // nose tip
        [14, 9, 4, 3, '#f8fafc'],
        [13, 12, 6, 8, '#e2e8f0'],
        [14, 12, 2, 8, '#ffffff'],
        [15, 13, 2, 2, '#38bdf8'], // cockpit viewport
        [10, 17, 3, 4, '#dc2626'], // left fin
        [19, 17, 3, 4, '#dc2626'], // right fin
        [14, 20, 4, 2, '#f97316'], // thruster flame
        [15, 22, 2, 3, '#fde047'],
      ]);
      break;
    }
    case 'interstellar': {
      // Radiant Golden Dyson Starburst
      paintEmblem([
        [15, 6, 2, 20, '#f59e0b'],
        [6, 15, 20, 2, '#f59e0b'],
        [10, 10, 12, 12, '#fbbf24'],
        [11, 11, 10, 10, '#fde047'],
        [13, 13, 6, 6, '#ffffff'],
        [9, 9, 2, 2, '#fef08a'],
        [21, 9, 2, 2, '#fef08a'],
        [9, 21, 2, 2, '#fef08a'],
        [21, 21, 2, 2, '#fef08a'],
      ]);
      break;
    }
  }

  // --- 3. Crisp Inner Pixel Vignette Border (Keeps Square Scenery Razor-Sharp) ---
  px(0, 0, 32, 1, 'rgba(12,7,5,0.7)');
  px(0, 31, 32, 1, 'rgba(12,7,5,0.75)');
  px(0, 0, 1, 32, 'rgba(12,7,5,0.7)');
  px(31, 0, 1, 32, 'rgba(12,7,5,0.75)');
  px(1, 1, 30, 1, 'rgba(255,244,218,0.22)');

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

  // Trigger timeline phases & particle burst synchronized to the exact coin-flip slam
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

      // Explode crisp pixel-art particles outward from the top square medallion & text banner!
      const canvas = canvasRef.current;
      const cw = canvas ? canvas.width : 560;
      const originX = cw * 0.5;
      const originY = 74;
      const palette = [
        '#fff9db',
        '#fde047',
        '#f59e0b',
        '#f7d2a6',
        toEpoch.accentColor,
        '#ffffff',
      ];
      const burst: PixelBurstParticle[] = [];

      // 1. High-energy radial pixel chunk explosion around the square scenery icon
      for (let i = 0; i < 64; i++) {
        const angle = (i / 64) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const speed = 150 + Math.random() * 290;
        burst.push({
          x: originX + (Math.random() - 0.5) * 32,
          y: originY + (Math.random() - 0.5) * 32,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 20,
          size: Math.random() < 0.35 ? 8 : Math.random() < 0.72 ? 6 : 4,
          color: palette[Math.floor(Math.random() * palette.length)],
          age: 0,
          life: 0.55 + Math.random() * 0.55,
          gravity: 340 + Math.random() * 140,
          drag: 0.94,
          sparkle: Math.random() < 0.4,
        });
      }

      // 2. Wide horizontal pixel spark burst along the newly revealed HUD text bar
      for (let i = 0; i < 30; i++) {
        const tx = originX + (Math.random() - 0.5) * 230;
        const ty = originY + 58 + (Math.random() - 0.5) * 16;
        burst.push({
          x: tx,
          y: ty,
          vx: (tx - originX) * 1.4 + (Math.random() - 0.5) * 90,
          vy: -(60 + Math.random() * 165),
          size: Math.random() < 0.5 ? 6 : 4,
          color: i % 3 === 0 ? '#ffffff' : i % 2 === 0 ? '#fde047' : toEpoch.accentColor,
          age: 0,
          life: 0.65 + Math.random() * 0.55,
          gravity: 260,
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

          // Snap to 2px integer grid for razor-sharp pixelated confetti chunks
          const sz = Math.max(2, Math.round((p.size * (1 - t * 0.35)) / 2) * 2);
          const rx = Math.round(p.x / 2) * 2 - (sz >> 1);
          const ry = Math.round(p.y / 2) * 2 - (sz >> 1);

          ctx.globalAlpha = alpha;
          // Crisp dark 2px drop-outline on bigger chunks so they pop over bright terrain
          if (sz >= 6) {
            ctx.fillStyle = '#120a07';
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

  return (
    <div
      key={event.id}
      data-testid="age-progress-banner"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[48] flex items-start justify-center pt-[68px] sm:pt-[64px] select-none ${
        phase === 'exit' ? 'age-banner-exit' : 'age-banner-enter'
      }`}
    >
      {/* Top-center HUD centerpiece right beneath the top bar */}
      <div className="relative flex flex-col items-center">
        {/* Crisp pixelated explosion particle canvas aligned to top medallion + text */}
        <canvas
          ref={canvasRef}
          width={560}
          height={320}
          className="pixelated-canvas pointer-events-none absolute left-1/2 -top-[36px] -translate-x-1/2 w-[560px] h-[320px] max-w-[100vw]"
        />

        {/* Rotating 3D Square Scenery Medallion (Fortnite Pirate-Token style flip) */}
        <div
          className="relative mb-2"
          style={{ perspective: '900px' }}
        >
          <div
            className={`relative w-[68px] h-[68px] sm:w-[78px] sm:h-[78px] ${
              phase === 'spinning'
                ? 'age-token-flip'
                : phase === 'impact'
                  ? 'age-token-slam'
                  : phase === 'enter'
                    ? 'age-token-ready'
                    : 'age-token-settled'
            }`}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Golden Metallic Thickness Edge Core (gleams when edge-on mid-spin) */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[#f5b95b] border-4 border-[#0c0705]"
              style={{ transform: 'translateZ(0px)' }}
            />

            {/* FRONT FACE: Previous Age Square Scenery + Icon */}
            <div
              className="absolute inset-0 bg-[#33241b] p-[5px] border-[4px] border-[#0c0705]"
              style={{
                transform: 'translateZ(3px)',
                backfaceVisibility: 'hidden',
                boxShadow:
                  'inset 0 0 0 3px #d99968, inset 0 0 0 5px #5e3824, 0 6px 0 rgba(10,6,4,0.75)',
              }}
            >
              <img
                src={fromUrl}
                alt={fromEpoch.name}
                className="pixelated-canvas w-full h-full block object-cover"
              />
            </div>

            {/* BACK FACE: Next Age Square Scenery + Icon (revealed on flip slam!) */}
            <div
              className="absolute inset-0 bg-[#33241b] p-[5px] border-[4px] border-[#0c0705]"
              style={{
                transform: 'rotateY(180deg) translateZ(3px)',
                backfaceVisibility: 'hidden',
                boxShadow:
                  'inset 0 0 0 3px #f7d2a6, inset 0 0 0 5px #a66b44, 0 6px 0 rgba(10,6,4,0.8)',
              }}
            >
              <img
                src={toUrl}
                alt={toEpoch.name}
                className="pixelated-canvas w-full h-full block object-cover"
              />
              {/* Crisp white-gold impact flash frame right on the slam */}
              {phase === 'impact' && (
                <div className="age-impact-flash pointer-events-none absolute inset-0 bg-[#fff9db]" />
              )}
            </div>
          </div>
        </div>

        {/* Top Banner HUD Plaque (Warm Espresso & Burnished Gold Pixel Frame) */}
        <div
          className={`px-panel-hero px-4 py-1.5 sm:px-6 sm:py-2 flex flex-col items-center text-center min-w-[200px] sm:min-w-[244px] ${
            showNewText ? 'age-text-slam' : ''
          }`}
        >
          <span className="font-pixel-num text-[10px] sm:text-xs font-bold tracking-[0.14em] uppercase text-[#d9a977] leading-none mb-0.5">
            {displayedEpoch.yearLabel}
          </span>
          <span
            data-testid="age-progress-banner-title"
            className="font-bold text-base sm:text-xl leading-tight tracking-wide whitespace-nowrap"
            style={{
              color: showNewText ? '#ffe49e' : '#eadbc6',
              textShadow: '0 2px 0 #140c08, 2px 0 0 #140c08, -2px 0 0 #140c08, 0 -2px 0 #140c08',
            }}
          >
            {displayedEpoch.name}
          </span>
        </div>
      </div>
    </div>
  );
};
