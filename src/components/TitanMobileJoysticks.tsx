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

const STICK_SIZE = 108;
const MAX_RADIUS = 44;

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
  const frameStyle = thumb.firing
    ? 'border-[#ef4444] bg-[#3a1212]/75 shadow-[inset_2px_2px_0_rgba(253,224,71,0.35),inset_-2px_-2px_0_rgba(0,0,0,0.7),0_0_0_2px_#0b0807,0_0_16px_rgba(239,68,68,0.7)]'
    : isCannon
      ? 'border-[#c2410c] bg-[#18110e]/75 shadow-[inset_2px_2px_0_rgba(255,255,255,0.12),inset_-2px_-2px_0_rgba(0,0,0,0.7),0_0_0_2px_#0b0807]'
      : 'border-[#b4833e] bg-[#18110e]/75 shadow-[inset_2px_2px_0_rgba(255,255,255,0.12),inset_-2px_-2px_0_rgba(0,0,0,0.7),0_0_0_2px_#0b0807]';

  const thumbStyle = thumb.firing
    ? 'bg-[#dc2626] border-[#fde047] shadow-[inset_2px_2px_0_rgba(255,255,255,0.4),inset_-2px_-2px_0_rgba(127,29,29,0.9),0_0_0_2px_#0b0807,0_0_10px_rgba(239,68,68,0.85)]'
    : isCannon
      ? 'bg-[#991b1b] border-[#fca5a5] shadow-[inset_2px_2px_0_rgba(255,255,255,0.28),inset_-2px_-2px_0_rgba(69,10,10,0.85),0_0_0_2px_#0b0807]'
      : 'bg-[#5c6b60] border-[#e7cfa0] shadow-[inset_2px_2px_0_rgba(255,255,255,0.28),inset_-2px_-2px_0_rgba(30,38,32,0.85),0_0_0_2px_#0b0807]';

  const pipColor = thumb.firing ? 'bg-[#fde047]' : isCannon ? 'bg-[#fca5a5]/70' : 'bg-[#e7cfa0]/70';

  return (
    <div
      ref={baseRef}
      data-testid={isCannon ? 'titan-cannon-joystick' : 'titan-move-joystick'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      style={{ width: STICK_SIZE, height: STICK_SIZE }}
      className={`pointer-events-auto relative border-2 touch-none select-none flex items-center justify-center transition-colors duration-75 ${frameStyle}`}
    >
      {/* Crisp 4px corner pixel rivets */}
      <span className={`pointer-events-none absolute top-1 left-1 w-1 h-1 ${pipColor}`} />
      <span className={`pointer-events-none absolute top-1 right-1 w-1 h-1 ${pipColor}`} />
      <span className={`pointer-events-none absolute bottom-1 left-1 w-1 h-1 ${pipColor}`} />
      <span className={`pointer-events-none absolute bottom-1 right-1 w-1 h-1 ${pipColor}`} />

      {/* Inner firing-bound pixel box on Cannon stick */}
      {isCannon && (
        <div
          className={`pointer-events-none absolute inset-2.5 border border-dashed ${
            thumb.firing ? 'border-[#fde047]/85' : 'border-[#ef4444]/40'
          }`}
        />
      )}

      {/* Pixel directional ticks */}
      <span className={`pointer-events-none absolute top-1.5 w-1.5 h-1.5 ${pipColor}`} />
      <span className={`pointer-events-none absolute bottom-1.5 w-1.5 h-1.5 ${pipColor}`} />
      <span className={`pointer-events-none absolute left-1.5 w-1.5 h-1.5 ${pipColor}`} />
      <span className={`pointer-events-none absolute right-1.5 w-1.5 h-1.5 ${pipColor}`} />

      {/* Pixelated center crosshairs */}
      <span className="pointer-events-none absolute w-4 h-0.5 bg-white/15" />
      <span className="pointer-events-none absolute h-4 w-0.5 bg-white/15" />

      {/* Blocky pixelated joystick knob */}
      <div
        style={{
          transform: `translate3d(${Math.round(thumb.x)}px, ${Math.round(thumb.y)}px, 0)`,
        }}
        className={`pointer-events-none w-10 h-10 border-2 flex items-center justify-center ${thumbStyle}`}
      >
        <div className="w-2 h-2 bg-white/80" />
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
