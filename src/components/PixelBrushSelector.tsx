import React, { useEffect, useRef, useState } from 'react';
import { getPixelCircleCells } from '../game/brushSizes';
import { soundEngine } from '../game/sound';
import { HudPixelIcon } from './GameIcons';

interface PixelBrushSelectorProps {
  brushSize: number;
  onChange: (size: number) => void;
  mode?: 'powers' | 'terrain';
}

const GRID_DIM = 15;

function getIconCellsForSize(size: number) {
  const clamped = Math.max(1, Math.min(10, Math.round(size)));
  // Map 1..10 cleanly to odd pixel circle diameters 3..13
  const diameter = Math.min(13, Math.max(3, Math.floor((clamped - 1) * (10 / 9)) + 3));
  const oddDiam = diameter % 2 === 0 ? diameter - 1 : diameter;
  const offset = Math.floor((GRID_DIM - oddDiam) / 2);
  return getPixelCircleCells(oddDiam).map((c) => ({
    x: c.x + offset,
    y: c.y + offset,
  }));
}

export const PixelBrushSelector: React.FC<PixelBrushSelectorProps> = ({
  brushSize,
  onChange,
  mode = 'terrain',
}) => {
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ left: number; bottom: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const clampedSize = Math.max(1, Math.min(10, Math.round(brushSize)));
  const iconCells = getIconCellsForSize(clampedSize);

  const updatePopoverPosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const popWidth = 192;
    const left = Math.max(8, Math.min(window.innerWidth - popWidth - 8, rect.left));
    const bottom = Math.max(8, window.innerHeight - rect.top + 6);
    setPopoverPos({ left, bottom });
  };

  useEffect(() => {
    if (!open) return;
    updatePopoverPosition();
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (
        target &&
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onResize = () => updatePopoverPosition();
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const valueHint =
    mode === 'powers'
      ? clampedSize === 1
        ? '1× power'
        : `${clampedSize}× cluster`
      : `${clampedSize * 2 + 1}×${clampedSize * 2 + 1} tiles`;

  return (
    <div className="relative shrink-0" role="group" aria-label="Brush size">
      <button
        ref={triggerRef}
        type="button"
        data-testid="brush-size-dropdown-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`Brush Size ${clampedSize} (${valueHint})`}
        onClick={() => {
          soundEngine.playClick();
          setOpen((prev) => !prev);
        }}
        className={`h-6 sm:h-7 px-1.5 sm:px-2 flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
          open ? 'px-btn-active font-bold' : 'px-btn font-semibold'
        }`}
      >
        <svg
          width={13}
          height={13}
          viewBox={`0 0 ${GRID_DIM} ${GRID_DIM}`}
          shapeRendering="crispEdges"
          className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 block"
          aria-hidden="true"
        >
          {iconCells.map((c, idx) => (
            <rect
              key={idx}
              x={c.x}
              y={c.y}
              width={1}
              height={1}
              fill={open ? '#1b1610' : '#f2ece1'}
            />
          ))}
        </svg>
        <span className="font-pixel-num text-[10px] sm:text-[11px] leading-none">
          {mode === 'powers' ? `${clampedSize}×` : clampedSize}
        </span>
        <HudPixelIcon
          kind="chevronDown"
          className={`w-2.5 h-2.5 sm:w-3 sm:h-3 pixelated-canvas shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && popoverPos && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Brush Size Slider"
          data-testid="brush-size-popover"
          style={{ left: popoverPos.left, bottom: popoverPos.bottom }}
          className="px-panel fixed z-50 w-48 p-2.5 space-y-2"
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#b8afa2]">Brush Size</span>
            <span className="font-pixel-num font-bold text-[#f5b742] tabular-nums">
              {valueHint}
            </span>
          </div>
          <input
            type="range"
            data-testid="brush-size-slider"
            min={1}
            max={10}
            step={1}
            value={clampedSize}
            onChange={(e) => {
              const nextSize = Number(e.target.value);
              onChange(nextSize);
            }}
            className="px-range w-full cursor-pointer"
          />
          <div className="flex items-center justify-between text-[10px] text-[#9e9486] font-pixel-num">
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>
      )}
    </div>
  );
};
