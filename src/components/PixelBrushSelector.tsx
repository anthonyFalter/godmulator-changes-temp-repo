import React from 'react';
import { BRUSH_SIZE_PRESETS, getPixelCircleCells } from '../game/brushSizes';

interface PixelBrushSelectorProps {
  brushSize: number;
  onChange: (size: number) => void;
}

const GRID_DIM = 15;

const PRESET_ICON_CELLS = BRUSH_SIZE_PRESETS.map((preset) => {
  const offset = Math.floor((GRID_DIM - preset.iconDiameter) / 2);
  const cells = getPixelCircleCells(preset.iconDiameter).map((c) => ({
    x: c.x + offset,
    y: c.y + offset,
  }));
  return { preset, cells };
});

export const PixelBrushSelector: React.FC<PixelBrushSelectorProps> = ({
  brushSize,
  onChange,
}) => {
  return (
    <div className="flex items-center gap-0.5 sm:gap-1 shrink-0" role="group" aria-label="Brush size">
      <span className="hidden sm:inline text-[10px] sm:text-[11px] text-[#a89f91] mr-0.5">
        Size
      </span>
      {PRESET_ICON_CELLS.map(({ preset, cells }) => {
        const isActive = brushSize === preset.size;
        const tileSpan = preset.terrainRadius === 0 ? '1 tile' : `${preset.terrainRadius * 2 + 1}x${preset.terrainRadius * 2 + 1} circle`;
        return (
          <button
            key={preset.id}
            type="button"
            data-testid={`land-size-${preset.id}`}
            aria-pressed={isActive}
            title={`Brush ${preset.label}x (${tileSpan})`}
            onClick={() => onChange(preset.size)}
            className={`h-6 sm:h-7 px-1 sm:px-1.5 flex items-center gap-0.5 sm:gap-1 cursor-pointer shrink-0 ${
              isActive ? 'px-btn-active font-bold' : 'px-btn'
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
              {cells.map((c, idx) => (
                <rect
                  key={idx}
                  x={c.x}
                  y={c.y}
                  width={1}
                  height={1}
                  fill={isActive ? '#1b1610' : '#f2ece1'}
                />
              ))}
            </svg>
            <span className="font-pixel-num text-[9px] sm:text-[10px] leading-none">
              {preset.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
