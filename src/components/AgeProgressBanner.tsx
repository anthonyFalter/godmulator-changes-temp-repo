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

/**
 * Returns the asset URL for the crisp 72x36 indexed-palette pixel-art panoramic landscape
 * of each civilization epoch (stored in public/assets/epochs/<epochId>.png).
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
      for (let i = 0; i < 56; i++) {
        const angle = (i / 56) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const speed = 135 + Math.random() * 255;
        burst.push({
          x: dialOriginX + (Math.random() - 0.5) * 36,
          y: dialOriginY + (Math.random() - 0.5) * 26,
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
        const tx = cw * 0.5 + 42 + (Math.random() - 0.5) * 190;
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
      {/* Unified Horizontal HUD Plaque: Full-Bleed Half-Circle Age Dial (Left) + Age Title (Right) */}
      <div className="relative flex items-center justify-center">
        {/* Crisp pixelated explosion particle canvas aligned to dial + title */}
        <canvas
          ref={canvasRef}
          width={580}
          height={260}
          className="pixelated-canvas pointer-events-none absolute left-1/2 -top-[52px] -translate-x-1/2 w-[580px] h-[260px] max-w-[100vw]"
        />

        <div
          className={`px-panel-hero pt-3.5 pb-2.5 pl-3 pr-4 sm:pt-4 sm:pb-3 sm:pl-4 sm:pr-7 flex flex-row items-center gap-3.5 sm:gap-4 min-w-[300px] sm:min-w-[384px] ${
            showNewText ? 'age-text-slam' : ''
          }`}
        >
          {/* LEFT: Full-Bleed Half-Circle Rotating Age Wheel (Exact 2:1 Semicircle: inner 120x60 / 144x72 = exact 2x of 72x36) */}
          <div className="relative shrink-0 w-[126px] h-[66px] sm:w-[150px] sm:h-[78px]">
            {/* Semicircular Clipped Viewport */}
            <div
              className="relative w-full h-full rounded-t-full overflow-hidden border-t-[3px] border-x-[3px] border-b-[3px] border-[#0c0705] bg-[#140c08]"
              style={{
                boxShadow:
                  '0 0 0 1.5px #e6bf78, 0 0 10px rgba(230,191,120,0.22), 0 4px 0 rgba(10,6,4,0.82)',
              }}
            >
              {/* Full Circular Two-Half Diorama Disk (Top Half = Previous Age, Bottom Half = Next Age) */}
              <div
                className={`absolute left-0 top-0 w-[120px] h-[120px] sm:w-[144px] sm:h-[144px] rounded-full overflow-hidden ${wheelPhaseClass}`}
                style={{ willChange: 'transform' }}
              >
                {/* TOP HALF (0°): Full-Bleed Previous Age Painterly Pixel-Art Scene */}
                <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden">
                  <img
                    src={fromUrl}
                    alt={fromEpoch.name}
                    className="pixelated-canvas w-full h-full block object-cover"
                  />
                </div>

                {/* BOTTOM HALF (180°): Full-Bleed Next Age Painterly Pixel-Art Scene (pre-rotated 180° to land upright) */}
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
                  className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-[4px] bg-[#0c0705] flex items-center"
                >
                  <div className="w-full h-[2px] bg-gradient-to-r from-[#b88f4a] via-[#fff6d1] to-[#b88f4a]" />
                </div>

                {/* Center Astrolabe Pivot Jewel */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full bg-[#fff6d1] border-[2px] border-[#0c0705]"
                  style={{ boxShadow: '0 0 8px rgba(255,246,209,0.9)' }}
                />
              </div>

              {/* Ornate Celestial Astrolabe Golden Filigree Rim & Degree Ticks Overlay */}
              <svg
                viewBox="0 0 146 73"
                className="pointer-events-none absolute inset-0 w-full h-full"
                aria-hidden="true"
              >
                {/* Outer & inner double golden astrolabe arcs */}
                <path
                  d="M 2 72 A 71 71 0 0 1 144 72"
                  fill="none"
                  stroke="#f5d284"
                  strokeWidth="1.8"
                  opacity="0.92"
                />
                <path
                  d="M 7 72 A 66 66 0 0 1 139 72"
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
                  const rOuter = 70;
                  const rInner = isMajor ? 63 : 66;
                  const x1 = 73 + Math.cos(rad) * rInner;
                  const y1 = 72 + Math.sin(rad) * rInner;
                  const x2 = 73 + Math.cos(rad) * rOuter;
                  const y2 = 72 + Math.sin(rad) * rOuter;
                  return (
                    <line
                      key={deg}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isMajor ? '#ffffff' : '#f5d284'}
                      strokeWidth={isMajor ? 1.5 : 0.9}
                      opacity={isMajor ? 0.95 : 0.72}
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
