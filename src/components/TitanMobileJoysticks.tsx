import React, { useCallback, useRef, useState } from 'react';

interface TitanMobileJoysticksProps {
  onMoveStick: (right: number, forward: number) => void;
  onCannonStick: (
    active: boolean,
    right: number,
    forward: number,
    magnitude: number,
    outsideBounds: boolean,
  ) => void;
}

interface StickProps {
  variant: 'cannon' | 'move';
  onUpdate: (
    active: boolean,
    nx: number,
    ny: number,
    magnitude: number,
    outsideBounds: boolean,
  ) => void;
}

const STICK_SIZE = 112;
const KNOB_SIZE = 44;
const MAX_RADIUS = 44;

interface PixelCell {
  x: number;
  y: number;
  kind: 'outline' | 'rimLight' | 'rimDark' | 'fill' | 'dash';
}

function buildPixelCircleCells(
  grid: number,
  outerMax: number,
  outerMin: number,
  rimMin: number,
  dashMin?: number,
  dashMax?: number,
): PixelCell[] {
  const cells: PixelCell[] = [];
  const c = (grid - 1) * 0.5;
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > outerMax) continue;
      if (d >= outerMin) {
        cells.push({ x, y, kind: 'outline' });
      } else if (d >= rimMin) {
        cells.push({ x, y, kind: x + y <= grid - 1 ? 'rimLight' : 'rimDark' });
      } else if (dashMin !== undefined && dashMax !== undefined && d >= dashMin && d <= dashMax && (x + y) % 2 === 0) {
        cells.push({ x, y, kind: 'dash' });
      } else {
        cells.push({ x, y, kind: 'fill' });
      }
    }
  }
  return cells;
}

const BASE_GRID = 28;
const BASE_CELLS_MOVE = buildPixelCircleCells(BASE_GRID, 13.75, 12.65, 11.45);
const BASE_CELLS_CANNON = buildPixelCircleCells(BASE_GRID, 13.75, 12.65, 11.45, 8.8, 9.75);

const KNOB_GRID = 11;
const KNOB_CELLS = buildPixelCircleCells(KNOB_GRID, 5.25, 4.35, 3.25);

const VirtualStick: React.FC<StickProps> = ({ variant, onUpdate }) => {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [thumb, setThumb] = useState<{ x: number; y: number; active: boolean; firing: boolean }>({
    x: 0,
    y: 0,
    active: false,
    firing: false,
  });

  const computeAndEmit = useCallback(
    (clientX: number, clientY: number) => {
      const el = baseRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const rawX = clientX - cx;
      const rawY = clientY - cy;
      const rawDist = Math.hypot(rawX, rawY);
      const outsideBounds = rawDist > MAX_RADIUS;

      const visualDist = outsideBounds ? MAX_RADIUS + Math.min(8, (rawDist - MAX_RADIUS) * 0.22) : rawDist;
      const clampedDist = Math.min(MAX_RADIUS, rawDist);
      const dirX = rawDist > 0.001 ? rawX / rawDist : 0;
      const dirY = rawDist > 0.001 ? rawY / rawDist : 0;

      const nx = (dirX * clampedDist) / MAX_RADIUS;
      const ny = (dirY * clampedDist) / MAX_RADIUS;
      const magnitude = clampedDist / MAX_RADIUS;

      setThumb({
        x: dirX * visualDist,
        y: dirY * visualDist,
        active: true,
        firing: variant === 'cannon' && outsideBounds,
      });
      onUpdate(true, nx, ny, magnitude, outsideBounds);
    },
    [onUpdate, variant],
  );

  const resetStick = useCallback(() => {
    pointerIdRef.current = null;
    setThumb({ x: 0, y: 0, active: false, firing: false });
    onUpdate(false, 0, 0, 0, false);
  }, [onUpdate]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (pointerIdRef.current !== null) return;
    pointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    computeAndEmit(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (pointerIdRef.current !== e.pointerId) return;
    computeAndEmit(e.clientX, e.clientY);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (pointerIdRef.current !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    resetStick();
  };

  const isCannon = variant === 'cannon';
  const baseCells = isCannon ? BASE_CELLS_CANNON : BASE_CELLS_MOVE;

  const baseColors = thumb.firing
    ? {
        outline: '#0b0807',
        rimLight: '#fde047',
        rimDark: '#ef4444',
        fill: 'rgba(58, 18, 18, 0.72)',
        dash: '#fde047',
        pip: '#fde047',
      }
    : isCannon
      ? {
          outline: '#0b0807',
          rimLight: '#f97316',
          rimDark: '#991b1b',
          fill: 'rgba(24, 17, 14, 0.68)',
          dash: 'rgba(239, 68, 68, 0.55)',
          pip: '#fca5a5',
        }
      : {
          outline: '#0b0807',
          rimLight: '#e7cfa0',
          rimDark: '#8c622c',
          fill: 'rgba(24, 17, 14, 0.68)',
          dash: 'transparent',
          pip: '#e7cfa0',
        };

  const knobColors = thumb.firing
    ? {
        outline: '#0b0807',
        rimLight: '#fde047',
        rimDark: '#991b1b',
        fill: '#dc2626',
        dot: '#fffbeb',
      }
    : isCannon
      ? {
          outline: '#0b0807',
          rimLight: '#fca5a5',
          rimDark: '#5c1111',
          fill: '#b91c1c',
          dot: '#ffe4e6',
        }
      : {
          outline: '#0b0807',
          rimLight: '#e7cfa0',
          rimDark: '#2b342d',
          fill: '#5c6b60',
          dot: '#f5efe2',
        };

  return (
    <div
      ref={baseRef}
      data-testid={isCannon ? 'titan-cannon-joystick' : 'titan-move-joystick'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      style={{
        width: STICK_SIZE,
        height: STICK_SIZE,
        filter: thumb.firing ? 'drop-shadow(0 0 10px rgba(239,68,68,0.8))' : undefined,
      }}
      className="pointer-events-auto relative touch-none select-none flex items-center justify-center"
    >
      {/* Crisp stepped pixelated circular base */}
      <svg
        viewBox={`0 0 ${BASE_GRID} ${BASE_GRID}`}
        width={STICK_SIZE}
        height={STICK_SIZE}
        shapeRendering="crispEdges"
        className="pointer-events-none absolute inset-0 pixelated-canvas"
      >
        {baseCells.map((cell, idx) => (
          <rect
            key={idx}
            x={cell.x}
            y={cell.y}
            width={1}
            height={1}
            fill={baseColors[cell.kind]}
          />
        ))}
        {/* Pixelated N/S/E/W directional pips */}
        <rect x={13} y={3} width={2} height={1} fill={baseColors.pip} fillOpacity={0.85} />
        <rect x={13} y={24} width={2} height={1} fill={baseColors.pip} fillOpacity={0.85} />
        <rect x={3} y={13} width={1} height={2} fill={baseColors.pip} fillOpacity={0.85} />
        <rect x={24} y={13} width={1} height={2} fill={baseColors.pip} fillOpacity={0.85} />
        {/* Subtle pixel center crosshair */}
        <rect x={12} y={13} width={4} height={2} fill="#ffffff" fillOpacity={0.14} />
        <rect x={13} y={12} width={2} height={4} fill="#ffffff" fillOpacity={0.14} />
      </svg>

      {/* Crisp stepped pixelated circular knob */}
      <div
        style={{
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          transform: `translate3d(${Math.round(thumb.x)}px, ${Math.round(thumb.y)}px, 0)`,
        }}
        className="pointer-events-none relative flex items-center justify-center"
      >
        <svg
          viewBox={`0 0 ${KNOB_GRID} ${KNOB_GRID}`}
          width={KNOB_SIZE}
          height={KNOB_SIZE}
          shapeRendering="crispEdges"
          className="pixelated-canvas"
        >
          {KNOB_CELLS.map((cell, idx) => (
            <rect
              key={idx}
              x={cell.x}
              y={cell.y}
              width={1}
              height={1}
              fill={cell.kind === 'dash' ? knobColors.fill : knobColors[cell.kind]}
            />
          ))}
          <rect x={5} y={5} width={1} height={1} fill={knobColors.dot} />
        </svg>
      </div>
    </div>
  );
};

export const TitanMobileJoysticks: React.FC<TitanMobileJoysticksProps> = React.memo(
  ({ onMoveStick, onCannonStick }) => {
    React.useEffect(() => {
      return () => {
        onMoveStick(0, 0);
        onCannonStick(false, 0, 0, 0, false);
      };
    }, [onMoveStick, onCannonStick]);

    const handleCannon = useCallback(
      (active: boolean, nx: number, ny: number, magnitude: number, outsideBounds: boolean) => {
        onCannonStick(active, nx, -ny, magnitude, outsideBounds);
      },
      [onCannonStick],
    );

    const handleMove = useCallback(
      (active: boolean, nx: number, ny: number) => {
        if (!active) {
          onMoveStick(0, 0);
        } else {
          onMoveStick(nx, -ny);
        }
      },
      [onMoveStick],
    );

    return (
      <>
        {/* LEFT joystick: Titan Movement */}
        <div className="fixed left-3 sm:left-5 bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4.25rem))] sm:bottom-5 z-20 pointer-events-none">
          <VirtualStick variant="move" onUpdate={handleMove} />
        </div>

        {/* RIGHT joystick: Cannon Aim + Auto-Fire when dragged outside bounds */}
        <div className="fixed right-3 sm:right-5 bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4.25rem))] sm:bottom-5 z-20 pointer-events-none">
          <VirtualStick variant="cannon" onUpdate={handleCannon} />
        </div>
      </>
    );
  },
);

interface TitanSkillSlotButtonProps {
  testId: string;
  keyLabel: string;
  ariaLabel: string;
  disabled: boolean;
  activeHighlight?: boolean;
  borderClass?: string;
  keyColorClass?: string;
  cooldown: number;
  cooldownColorClass: string;
  icon: React.ReactNode;
  onTap: () => void;
  onFireAtAim: () => void;
  onSkillAim: (active: boolean, right: number, forward: number, magnitude: number) => void;
}

const SKILL_AIM_RADIUS = 56;
const SKILL_DRAG_THRESHOLD = 10;

export const TitanSkillSlotButton: React.FC<TitanSkillSlotButtonProps> = React.memo(
  ({
    testId,
    keyLabel,
    ariaLabel,
    disabled,
    activeHighlight = false,
    borderClass = '',
    keyColorClass = 'text-[#f4e7d4]/85',
    cooldown,
    cooldownColorClass,
    icon,
    onTap,
    onFireAtAim,
    onSkillAim,
  }) => {
    const btnRef = useRef<HTMLButtonElement | null>(null);
    const pointerIdRef = useRef<number | null>(null);
    const draggedRef = useRef(false);
    const [aimUi, setAimUi] = useState<{ active: boolean; x: number; y: number }>({
      active: false,
      x: 0,
      y: 0,
    });

    React.useEffect(() => {
      return () => {
        if (pointerIdRef.current !== null) {
          pointerIdRef.current = null;
          onSkillAim(false, 0, 0, 0);
        }
      };
    }, [onSkillAim]);

    const updateAimFromPointer = (clientX: number, clientY: number) => {
      const el = btnRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const rawX = clientX - cx;
      const rawY = clientY - cy;
      const rawDist = Math.hypot(rawX, rawY);
      if (rawDist >= SKILL_DRAG_THRESHOLD) {
        draggedRef.current = true;
      }
      if (!draggedRef.current) return;

      const clamped = Math.min(SKILL_AIM_RADIUS, rawDist);
      const dirX = rawDist > 0.001 ? rawX / rawDist : 0;
      const dirY = rawDist > 0.001 ? rawY / rawDist : 0;
      const nx = (dirX * clamped) / SKILL_AIM_RADIUS;
      const ny = (dirY * clamped) / SKILL_AIM_RADIUS;
      const mag = clamped / SKILL_AIM_RADIUS;
      setAimUi({ active: true, x: Math.round(dirX * clamped * 0.55), y: Math.round(dirY * clamped * 0.55) });
      onSkillAim(true, nx, -ny, mag);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || e.pointerType !== 'touch') return;
      e.stopPropagation();
      e.preventDefault();
      pointerIdRef.current = e.pointerId;
      draggedRef.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (pointerIdRef.current !== e.pointerId) return;
      e.stopPropagation();
      updateAimFromPointer(e.clientX, e.clientY);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (pointerIdRef.current !== e.pointerId) return;
      e.stopPropagation();
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      const wasDragged = draggedRef.current;
      pointerIdRef.current = null;
      draggedRef.current = false;
      setAimUi({ active: false, x: 0, y: 0 });
      onSkillAim(false, 0, 0, 0);
      if (!disabled) {
        if (wasDragged) {
          onFireAtAim();
        } else {
          onTap();
        }
      }
    };

    const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (pointerIdRef.current !== e.pointerId) return;
      e.stopPropagation();
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      pointerIdRef.current = null;
      draggedRef.current = false;
      setAimUi({ active: false, x: 0, y: 0 });
      onSkillAim(false, 0, 0, 0);
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.blur();
      // Touch interactions are handled in handlePointerUp to distinguish tap vs press-drag-release
      if (e.detail === 0 || window.matchMedia('(pointer: fine)').matches) {
        onTap();
      }
    };

    return (
      <button
        ref={btnRef}
        type="button"
        tabIndex={-1}
        data-testid={testId}
        disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
        className={`relative w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center touch-none select-none cursor-pointer disabled:opacity-60 ${
          activeHighlight || aimUi.active ? 'px-btn-active ring-2 ring-[#ef4444]' : 'px-btn'
        } ${borderClass}`}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        {icon}
        <span className={`absolute top-0.5 left-1 text-[9px] font-bold leading-none ${keyColorClass}`}>
          {keyLabel}
        </span>

        {/* Pixelated aim indicator shown while press-dragging on mobile */}
        {aimUi.active && (
          <div className="pointer-events-none absolute -inset-4 border-2 border-[#ef4444] bg-[#ef4444]/15 shadow-[0_0_12px_rgba(239,68,68,0.6)] flex items-center justify-center z-30">
            <div
              style={{ transform: `translate3d(${aimUi.x}px, ${aimUi.y}px, 0)` }}
              className="w-3.5 h-3.5 bg-[#ef4444] border border-[#fde047]"
            />
          </div>
        )}

        {cooldown > 0 && (
          <span
            className={`absolute inset-0 bg-black/65 flex items-center justify-center text-xs font-bold ${cooldownColorClass}`}
          >
            {cooldown.toFixed(1)}
          </span>
        )}
      </button>
    );
  },
);
