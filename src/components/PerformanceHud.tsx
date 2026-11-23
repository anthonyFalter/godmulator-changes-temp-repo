import React from 'react';
import { soundEngine } from '../game/sound';
import { PerfTelemetrySnapshot } from '../game/types';
import { HudPixelIcon } from './GameIcons';

interface PerformanceHudProps {
  stats: PerfTelemetrySnapshot;
  strictLossless: boolean;
  onClose: () => void;
}

const METER_SEGMENTS = 12;

export const PerformanceHud: React.FC<PerformanceHudProps> = ({
  stats,
  strictLossless,
  onClose,
}) => {
  const fpsTextClass =
    stats.fps >= 55
      ? 'text-[#6ee7b7]'
      : stats.fps >= 35
        ? 'text-[#f2c478]'
        : 'text-[#ff6b6b]';
  const fpsBarClass =
    stats.fps >= 55
      ? 'bg-[#48a832] px-bar-fill'
      : stats.fps >= 35
        ? 'bg-[#d9a441] px-bar-fill'
        : 'bg-[#c92a2a] px-bar-fill';
  const filledSegments = Math.max(
    0,
    Math.min(METER_SEGMENTS, Math.round((stats.fps / 60) * METER_SEGMENTS)),
  );

  return (
    <aside
      className="pointer-events-auto fixed left-2 top-[62px] sm:left-4 sm:top-[68px] z-40 w-[min(232px,calc(100vw-16px))] px-panel p-2.5 sm:p-3 text-xs text-[#eadbc6] select-none"
      aria-label="Performance Monitor"
      data-testid="performance-hud"
    >
      {/* Header: Native pixel-panel title, unboxed inline mode metadata, square pixel close button */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#47362c]">
        <div className="min-w-0">
          <h2 className="text-xs sm:text-sm font-bold text-[#f2c478] leading-tight">
            Performance
          </h2>
          <div className="mt-0.5 text-[10px] text-[#9e866f] leading-none">
            {strictLossless ? 'Quality' : 'Dynamic'} (F3)
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onClose();
          }}
          aria-label="Hide Performance Monitor"
          title="Hide Performance (F3)"
          className="px-btn w-6 h-6 flex items-center justify-center cursor-pointer shrink-0 text-[#bfa88f] hover:text-[#f4e7d4]"
        >
          <HudPixelIcon kind="close" className="w-3.5 h-3.5 pixelated-canvas" />
        </button>
      </div>

      {/* Primary Frame Pacing Anchor: Tabular readout + crisp 12-cell pixel meter */}
      <div className="pt-2 pb-2 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-[#b09880]">Frame Rate</span>
          <span className="font-pixel-num text-xs font-bold tabular-nums whitespace-nowrap">
            <span className={fpsTextClass}>{stats.fps} fps</span>
            <span className="text-[#9e866f] font-normal"> ({stats.frameMs.toFixed(1)} ms)</span>
          </span>
        </div>
        <div
          className="px-bar-track grid grid-cols-12 gap-[2px] h-3.5"
          aria-hidden="true"
        >
          {Array.from({ length: METER_SEGMENTS }, (_, i) => (
            <span
              key={i}
              className={i < filledSegments ? fpsBarClass : 'bg-[#241c19]'}
            />
          ))}
        </div>
      </div>

      {/* Render Pipeline Stats */}
      <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 pt-2 pb-2 border-t border-[#47362c] text-[11px] leading-snug">
        <span className="text-[#b09880]">Draw Calls</span>
        <span className="font-pixel-num tabular-nums text-right text-[#f4e7d4]">
          {stats.drawCalls.toLocaleString()}
        </span>

        <span className="text-[#b09880]">Triangles</span>
        <span className="font-pixel-num tabular-nums text-right text-[#f4e7d4]">
          {stats.triangles.toLocaleString()}
        </span>

        <span className="text-[#b09880]">Visible Chunks</span>
        <span className="font-pixel-num tabular-nums text-right text-[#f4e7d4]">
          {stats.visibleChunks} / {stats.totalChunks}
        </span>
      </div>

      {/* World & Simulation Stats */}
      <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 pt-2 border-t border-[#47362c] text-[11px] leading-snug">
        <span className="text-[#b09880]">Map Size</span>
        <span className="font-pixel-num tabular-nums text-right text-[#f4e7d4]">
          {stats.gridSize}×{stats.gridSize}
        </span>

        <span className="text-[#b09880]">Units / Bldgs</span>
        <span className="font-pixel-num tabular-nums text-right text-[#f4e7d4]">
          {stats.activeUnits.toLocaleString()} / {stats.activeBuildings.toLocaleString()}
        </span>

        <span className="text-[#b09880]">Sim Tick</span>
        <span className="font-pixel-num tabular-nums text-right text-[#f4e7d4]">
          {stats.simTickMs.toFixed(2)} ms
        </span>

        <span className="text-[#b09880]">Worker Queue</span>
        <span
          className={`font-pixel-num tabular-nums text-right ${
            stats.workerQueue > 0 ? 'text-[#f2c478]' : 'text-[#9e866f]'
          }`}
        >
          {stats.workerQueue > 0 ? `${stats.workerQueue} active` : 'Idle'}
        </span>
      </div>
    </aside>
  );
};
