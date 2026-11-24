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

const EPOCH_ART_IDS: readonly EpochId[] = [
  'prehistoric',
  'bronze',
  'medieval',
  'industrial',
  'atomic',
  'information',
  'orbital',
  'interstellar',
];

let epochArtPreloaded = false;
let cachedPixelArchFrameUrl: string | null = null;

/**
 * Returns the asset URL for the crisp 72x36 hand-pixelled epoch landscape
 * (stored in public/assets/epochs/<epochId>.png, rendered at exact 2x = 144x72).
 */
export function getEpochSceneryDataUrl(epochId: EpochId): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}assets/epochs/${epochId}.png`;
}

function preloadEpochArt() {
  if (epochArtPreloaded || typeof Image === 'undefined') return;
  epochArtPreloaded = true;
  for (const id of EPOCH_ART_IDS) {
    const img = new Image();
    img.src = getEpochSceneryDataUrl(id);
  }
}

/**
 * Generates a 100% stair-stepped pixelated golden semicircle arch bezel (78x42 grid, scaled 2x -> 156x84)
 * matching .px-panel-hero's exact burnished gold & dark espresso palette — zero smooth vector curves.
 */
function getPixelArchFrameDataUrl(): string {
  if (cachedPixelArchFrameUrl !== null) return cachedPixelArchFrameUrl;
  if (typeof document === 'undefined') return '';

  const W = 78;
  const H = 42;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;
  const px = (x: number, y: number, color: string) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };

  const cx = 38.5;
  const cy = 38.5;
  const rInnerOutline = 34.4;
  const rGoldInner = 35.4;
  const rGoldOuter = 37.6;
  const rOuterOutline = 38.7;

  // 1. Stair-stepped pixelated semicircular golden bezel arch
  for (let y = 0; y <= 38; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      if (r <= rInnerOutline || r > rOuterOutline) continue;

      if (r <= rGoldInner || r > rGoldOuter) {
        px(x, y, '#0c0705');
      } else {
        // Directional pixel bevel: bright ivory-gold on top-left rim, warm gold mid, bronze shadow right
        const angle = Math.atan2(dy, dx); // -PI (left) to 0 (right)
        const isOuterBand = r > (rGoldInner + rGoldOuter) * 0.5;
        if (isOuterBand) {
          if (angle > -Math.PI * 0.85 && angle < -Math.PI * 0.25) {
            px(x, y, angle > -Math.PI * 0.65 && angle < -Math.PI * 0.35 ? '#fff9ee' : '#f7d2a6');
          } else {
            px(x, y, '#d99968');
          }
        } else {
          px(x, y, angle < -Math.PI * 0.2 ? '#d99968' : '#a66b44');
        }
      }
    }
  }

  // 2. Crisp pixelated degree notch ticks along inner arch (±60°, ±30°)
  for (const deg of [-60, -30, 30, 60]) {
    const rad = ((deg - 90) * Math.PI) / 180;
    for (let step = 0; step < 3; step++) {
      const r = 34.0 - step;
      const tx = Math.round(cx + Math.cos(rad) * r);
      const ty = Math.round(cy + Math.sin(rad) * r);
      px(tx, ty, step === 0 ? '#fff9ee' : '#f7d2a6');
    }
  }

  // 3. Crisp pixelated static vertical golden meridian line down exact center (x = 38..39)
  for (let y = 5; y <= 37; y++) {
    px(37, y, '#0c0705');
    px(38, y, y % 2 === 0 ? '#fff4cc' : '#f7d2a6');
    px(39, y, '#d99968');
    px(40, y, '#0c0705');
  }

  // 4. Crisp pixelated bottom horizon golden bar (y = 38..41)
  for (let x = 0; x < W; x++) {
    px(x, 38, '#0c0705');
    px(x, 39, x > 4 && x < W - 5 ? '#f7d2a6' : '#d99968');
    px(x, 40, x > 6 && x < W - 7 ? '#d99968' : '#8f5b38');
    px(x, 41, '#0c0705');
  }
  px(0, 39, '#0c0705');
  px(0, 40, '#0c0705');
  px(W - 1, 39, '#0c0705');
  px(W - 1, 40, '#0c0705');

  // 5. Pixelated golden horizon corner studs (left & right) + center pivot jewel
  const drawStud = (sx: number, sy: number) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        px(sx + dx, sy + dy, '#0c0705');
      }
    }
    px(sx, sy, '#fff9ee');
    px(sx + 1, sy, '#f7d2a6');
  };
  drawStud(2, 39);
  drawStud(W - 3, 39);
  // Center bottom pivot stud
  for (let dy = -2; dy <= 1; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= 2) px(38 + dx, 39 + dy, '#0c0705');
    }
  }
  px(38, 38, '#fff9ee');
  px(39, 38, '#f7d2a6');
  px(38, 39, '#f7d2a6');
  px(39, 39, '#d99968');

  cachedPixelArchFrameUrl = canvas.toDataURL('image/png');
  return cachedPixelArchFrameUrl;
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

  useEffect(() => {
    preloadEpochArt();
  }, []);

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
      const dialOriginX = cw * 0.5 - 108;
      const dialOriginY = 96;
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
      for (let i = 0; i < 48; i++) {
        const angle = (i / 48) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const speed = 130 + Math.random() * 235;
        burst.push({
          x: dialOriginX + (Math.random() - 0.5) * 34,
          y: dialOriginY + (Math.random() - 0.5) * 24,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 22,
          size: Math.random() < 0.32 ? 8 : Math.random() < 0.72 ? 6 : 4,
          color: palette[Math.floor(Math.random() * palette.length)],
          age: 0,
          life: 0.5 + Math.random() * 0.48,
          gravity: 320 + Math.random() * 140,
          drag: 0.94,
          sparkle: Math.random() < 0.45,
        });
      }

      // 2. Horizontal pixel spark shimmer along the newly revealed age title on the right
      for (let i = 0; i < 24; i++) {
        const tx = cw * 0.5 + 42 + (Math.random() - 0.5) * 180;
        const ty = dialOriginY + 6 + (Math.random() - 0.5) * 22;
        burst.push({
          x: tx,
          y: ty,
          vx: (tx - dialOriginX) * 0.65 + (Math.random() - 0.5) * 80,
          vy: -(50 + Math.random() * 140),
          size: Math.random() < 0.5 ? 6 : 4,
          color: i % 3 === 0 ? '#ffffff' : i % 2 === 0 ? '#fde047' : toEpoch.accentColor,
          age: 0,
          life: 0.55 + Math.random() * 0.45,
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
            ctx.fillStyle = '#0c0705';
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
  const archFrameUrl = getPixelArchFrameDataUrl();
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
      {/* Unified Horizontal Pixel HUD Plaque: Pixelated Golden Semicircle Dial (Left) + Divider + Title (Right) */}
      <div className="relative flex items-center justify-center">
        {/* Crisp pixelated explosion particle canvas aligned to dial + title */}
        <canvas
          ref={canvasRef}
          width={580}
          height={260}
          className="pixelated-canvas pointer-events-none absolute left-1/2 -top-[52px] -translate-x-1/2 w-[580px] h-[260px] max-w-[100vw]"
        />

        <div
          className={`px-panel-hero pt-4 pb-3 pl-3.5 pr-4 sm:pt-4 sm:pb-3.5 sm:pl-4 sm:pr-7 flex flex-row items-center gap-3.5 sm:gap-4 min-w-[304px] sm:min-w-[396px] ${
            showNewText ? 'age-text-slam' : ''
          }`}
        >
          {/* LEFT: True Pixelated Golden Semicircle Dial (78x42 frame scaled 2x -> 156x84, inner art 72x36 scaled 2x -> 144x72) */}
          <div className="relative shrink-0 w-[130px] h-[70px] sm:w-[156px] sm:h-[84px]">
            {/* Inner Semicircular Clipped Viewport (tucked strictly inside the pixelated golden bezel!) */}
            <div className="absolute left-[5px] top-[5px] w-[120px] h-[60px] sm:left-[6px] sm:top-[6px] sm:w-[144px] sm:h-[72px] rounded-t-full overflow-hidden bg-[#140c08]">
              {/* Full Circular Two-Half Diorama Disk (Top Half = Previous Age, Bottom Half = Next Age) */}
              <div
                className={`absolute left-0 top-0 w-[120px] h-[120px] sm:w-[144px] sm:h-[144px] rounded-full overflow-hidden ${wheelPhaseClass}`}
                style={{ willChange: 'transform' }}
              >
                {/* TOP HALF (0°): Previous Age Crisp 72x36 Pixel-Art Scene */}
                <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden">
                  <img
                    src={fromUrl}
                    alt={fromEpoch.name}
                    className="pixelated-canvas w-full h-full block object-cover"
                  />
                </div>

                {/* BOTTOM HALF (180°): Next Age Crisp 72x36 Pixel-Art Scene (pre-rotated 180° to land upright) */}
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

                {/* Pixelated Golden Seam Divider Separating the Two Ages Across the Diameter */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-[4px] bg-[#0c0705] flex items-center"
                >
                  <div className="w-full h-[2px] bg-[#f7d2a6]" />
                </div>
              </div>

              {/* Crisp white-gold zenith lock-in flash across the full semicircle */}
              {phase === 'impact' && (
                <div className="age-impact-flash pointer-events-none absolute inset-0 bg-[#fff9db]" />
              )}
            </div>

            {/* 100% Stair-Stepped Pixelated Golden Semicircle Bezel + Meridian Line + Horizon Bar Overlay */}
            <img
              src={archFrameUrl}
              alt=""
              aria-hidden="true"
              className="pixelated-canvas pointer-events-none absolute inset-0 w-full h-full block"
            />

            {/* Crisp Pixelated 12 o'clock Zenith Diamond Crest */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute left-1/2 -top-[4px] -translate-x-1/2 w-[10px] h-[10px] rotate-45 bg-[#fff9ee] border-[2px] border-[#0c0705] ${
                phase === 'impact' ? 'age-zenith-pulse' : ''
              }`}
              style={{
                boxShadow: 'inset 0 0 0 1px #f7d2a6',
              }}
            />
          </div>

          {/* CENTER: Crisp Pixelated Vertical Golden Divider Bar */}
          <div
            aria-hidden="true"
            className="relative shrink-0 flex items-center justify-center h-[54px] sm:h-[64px] w-[8px]"
          >
            <div className="h-full w-[4px] bg-[#0c0705] px-[1px] py-[2px] flex flex-col">
              <div className="w-full h-[6px] bg-[#8f5b38]" />
              <div className="w-full flex-1 bg-[#f7d2a6]" />
              <div className="w-full h-[6px] bg-[#8f5b38]" />
            </div>
            <div className="absolute w-[8px] h-[8px] rotate-45 bg-[#fff9ee] border-[2px] border-[#0c0705]" />
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
            {/* Crisp pixelated stepped golden underline bar */}
            <div
              aria-hidden="true"
              className="mt-1.5 flex items-center gap-[2px] h-[4px] w-full max-w-[164px]"
            >
              <div className="h-[4px] w-[4px] bg-[#fff9ee] border border-[#0c0705]" />
              <div className="h-[2px] flex-1 bg-[#d99968] shadow-[0_1px_0_#0c0705]" />
              <div className="h-[2px] w-[14px] bg-[#8f5b38]" />
              <div className="h-[2px] w-[6px] bg-[#6e4229]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
