import React from 'react';
import { PerfTelemetrySnapshot } from '../game/types';

interface PerformanceHudProps {
  stats: PerfTelemetrySnapshot;
  strictLossless: boolean;
  onClose: () => void;
}

export const PerformanceHud: React.FC<PerformanceHudProps> = ({
  stats,
  strictLossless,
  onClose,
}) => {
  const fpsColor =
    stats.fps >= 55 ? 'text-emerald-300' : stats.fps >= 35 ? 'text-amber-300' : 'text-rose-400';

  return (
    <div
      className="pointer-events-auto fixed top-16 left-3 z-40 w-56 rounded-lg border border-slate-600/70 bg-slate-950/85 px-3 py-2 font-mono text-[11px] text-slate-200 shadow-xl backdrop-blur-md select-none"
      role="region"
      aria-label="Performance Debug HUD"
    >
      <div className="mb-1.5 flex items-center justify-between border-b border-slate-700/70 pb-1">
        <span className="font-semibold tracking-wide text-cyan-300">PERF HUD (F3)</span>
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded px-1 py-0.5 text-[9px] font-semibold ${
              strictLossless
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            {strictLossless ? 'LOSSLESS' : 'LOW-END'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
            title="Hide Performance HUD (F3)"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 leading-tight">
        <span className="text-slate-400">FPS / Frame</span>
        <span className={`text-right font-semibold ${fpsColor}`}>
          {stats.fps} ({stats.frameMs.toFixed(1)}ms)
        </span>

        <span className="text-slate-400">Draw Calls</span>
        <span className="text-right text-slate-100">{stats.drawCalls.toLocaleString()}</span>

        <span className="text-slate-400">Triangles</span>
        <span className="text-right text-slate-100">{stats.triangles.toLocaleString()}</span>

        <span className="text-slate-400">Chunks Vis</span>
        <span className="text-right text-cyan-200">
          {stats.visibleChunks} / {stats.totalChunks}
        </span>

        <span className="text-slate-400">Map Size</span>
        <span className="text-right text-slate-100">
          {stats.gridSize}×{stats.gridSize}
        </span>

        <span className="text-slate-400">Units / Bldgs</span>
        <span className="text-right text-slate-100">
          {stats.activeUnits} / {stats.activeBuildings}
        </span>

        <span className="text-slate-400">Sim Tick</span>
        <span className="text-right text-slate-100">{stats.simTickMs.toFixed(2)}ms</span>

        <span className="text-slate-400">Worker Queue</span>
        <span className="text-right text-slate-100">{stats.workerQueue}</span>
      </div>
    </div>
  );
};
