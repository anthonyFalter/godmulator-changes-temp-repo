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
      ? 'text-[#80ed99]'
      : stats.fps >= 35
        ? 'text-[#f5b742]'
        : 'text-[#ff6b6b]';
  const fpsBarClass =
    stats.fps >= 55
      ? 'bg-[#80ed99]'
      : stats.fps >= 35
        ? 'bg-[#f5b742]'
        : 'bg-[#ff6b6b]';
  const filledSegments = Math.max(
    0,
    Math.min(METER_SEGMENTS, Math.round((stats.fps / 60) * METER_SEGMENTS)),
  );

  return (
    <aside
      className="pointer-events-auto fixed left-2 top-[62px] sm:left-4 sm:top-[68px] z-40 w-[min(232px,calc(100vw-16px))] px-panel p-2.5 sm:p-3 text-xs text-[#e8e0d2] select-none"
      aria-label="Performance Monitor"
      data-testid="performance-hud"
    >
      {/* Header: Native pixel-panel title, unboxed inline mode metadata, square pixel close button */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#3a332b]">
        <div className="min-w-0">
          <h2 className="text-xs sm:text-sm font-bold text-[#f5b742] leading-tight">
            Performance
          </h2>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#9e9486] leading-none">
            <span>{strictLossless ? 'Quality' : 'Dynamic'}</span>
            <span aria-hidden="true">·</span>
            <span>F3</span>
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
          className="px-btn w-6 h-6 flex items-center justify-center cursor-pointer shrink-0 text-[#b8afa2] hover:text-[#f2ece1]"
        >
          <HudPixelIcon kind="close" className="w-3.5 h-3.5 pixelated-canvas" />
        </button>
      </div>

      {/* Primary Frame Pacing Anchor: Tabular readout + crisp 12-cell pixel meter */}
      <div className="pt-2 pb-2 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-[#a89f91]">Frame Rate</span>
          <span className="font-pixel-num text-xs font-bold tabular-nums whitespace-nowrap">
            <span className={fpsTextClass}>{stats.fps} fps</span>
            <span className="text-[#9e9486] font-normal"> · {stats.frameMs.toFixed(1)} ms</span>
          </span>
        </div>
        <div
          className="grid grid-cols-12 gap-[2px] h-2 bg-[#161513] p-[2px] border border-[#0b0a09]"
          aria-hidden="true"
        >
          {Array.from({ length: METER_SEGMENTS }, (_, i) => (
            <span
              key={i}
              className={i < filledSegments ? fpsBarClass : 'bg-[#26231f]'}
            />
          ))}
        </div>
      </div>

      {/* Render Pipeline Stats */}
      <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 pt-2 pb-2 border-t border-[#3a332b] text-[11px] leading-snug">
        <span className="text-[#a89f91]">Draw Calls</span>
        <span className="font-pixel-num tabular-nums text-right text-[#f2ece1]">
          {stats.drawCalls.toLocaleString()}
        </span>

        <span className="text-[#a89f91]">Triangles</span>
        <span className="font-pixel-num tabular-nums text-right text-[#f2ece1]">
          {stats.triangles.toLocaleString()}
        </span>

        <span className="text-[#a89f91]">Visible Chunks</span>
        <span className="font-pixel-num tabular-nums text-right text-[#f2ece1]">
          {stats.visibleChunks} / {stats.totalChunks}
        </span>
      </div>

      {/* World & Simulation Stats */}
      <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 pt-2 border-t border-[#3a332b] text-[11px] leading-snug">
        <span className="text-[#a89f91]">Map Size</span>
        <span className="font-pixel-num tabular-nums text-right text-[#f2ece1]">
          {stats.gridSize}×{stats.gridSize}
        </span>

        <span className="text-[#a89f91]">Units / Bldgs</span>
        <span className="font-pixel-num tabular-nums text-right text-[#f2ece1]">
          {stats.activeUnits.toLocaleString()} / {stats.activeBuildings.toLocaleString()}
        </span>

        <span className="text-[#a89f91]">Sim Tick</span>
        <span className="font-pixel-num tabular-nums text-right text-[#f2ece1]">
          {stats.simTickMs.toFixed(2)} ms
        </span>

        <span className="text-[#a89f91]">Worker Queue</span>
        <span
          className={`font-pixel-num tabular-nums text-right ${
            stats.workerQueue > 0 ? 'text-[#f5b742]' : 'text-[#9e9486]'
          }`}
        >
          {stats.workerQueue > 0 ? `${stats.workerQueue} active` : 'Idle'}
        </span>
      </div>
    </aside>
  );
};
