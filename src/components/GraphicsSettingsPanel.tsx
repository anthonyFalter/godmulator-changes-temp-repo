import React from 'react';
import { applyGraphicsPreset, inferGraphicsPreset } from '../game/graphics';
import { soundEngine } from '../game/sound';
import {
  FoliageDetailOption,
  GraphicsQualityPreset,
  GraphicsSettings,
  ParticleDetailOption,
  ShadowQualityOption,
  SkyCloudsQualityOption,
} from '../game/types';

interface GraphicsSettingsPanelProps {
  settings: GraphicsSettings;
  onChange: (next: GraphicsSettings) => void;
}

const PRESET_OPTIONS: { id: Exclude<GraphicsQualityPreset, 'custom'>; label: string }[] = [
  { id: 'high', label: 'High' },
  { id: 'balanced', label: 'Medium' },
  { id: 'fast', label: 'Low' },
];

const SHADOW_OPTIONS: { id: ShadowQualityOption; label: string }[] = [
  { id: 'on', label: 'High' },
  { id: 'fast', label: 'Low' },
  { id: 'off', label: 'Off' },
];

const SKY_OPTIONS: { id: SkyCloudsQualityOption; label: string }[] = [
  { id: 'full', label: 'High' },
  { id: 'reduced', label: 'Low' },
  { id: 'off', label: 'Off' },
];

const FOLIAGE_OPTIONS: { id: FoliageDetailOption; label: string }[] = [
  { id: 'full', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
];

const PARTICLE_OPTIONS: { id: ParticleDetailOption; label: string }[] = [
  { id: 'full', label: 'High' },
  { id: 'reduced', label: 'Medium' },
  { id: 'low', label: 'Low' },
];

type FrameRateMode = 'quality' | 'dynamic' | 'performance';

const FRAME_RATE_MODE_OPTIONS: { id: FrameRateMode; label: string; hint: string }[] = [
  { id: 'quality', label: 'Quality', hint: 'Keep full visual detail' },
  { id: 'dynamic', label: 'Dynamic FPS', hint: 'Lower effects automatically to hold 60 FPS' },
  { id: 'performance', label: 'Performance', hint: 'Prioritize smoother frame rates' },
];

const SELECT_CLASS =
  'w-36 sm:w-44 shrink-0 bg-[#1e1b17] text-[#f2ece1] text-xs font-semibold px-2.5 py-1.5 border border-[#4a4137] hover:border-[#706455] focus:border-[#f5b742] outline-none cursor-pointer';

export const GraphicsSettingsPanel: React.FC<GraphicsSettingsPanelProps> = ({
  settings,
  onChange,
}) => {
  const isQualityMode = settings.strictLossless !== false;
  const frameRateMode: FrameRateMode = isQualityMode
    ? 'quality'
    : settings.autoOptimizeFps
      ? 'dynamic'
      : 'performance';
  const showPerfHud = Boolean(settings.showPerformanceHud);

  const updateField = <K extends keyof Omit<GraphicsSettings, 'preset'>>(
    key: K,
    value: GraphicsSettings[K],
  ) => {
    soundEngine.playClick();
    const partial: Omit<GraphicsSettings, 'preset'> = {
      shadows: settings.shadows,
      cloudsAndSky: settings.cloudsAndSky,
      foliageDensity: settings.foliageDensity,
      particles: settings.particles,
      autoOptimizeFps: settings.autoOptimizeFps,
      strictLossless: settings.strictLossless ?? true,
      showPerformanceHud: showPerfHud,
      [key]: value,
    };
    onChange({
      ...partial,
      preset: inferGraphicsPreset(partial),
    });
  };

  const handleFrameRateModeChange = (mode: FrameRateMode) => {
    soundEngine.playClick();
    const strictLossless = mode === 'quality';
    const autoOptimizeFps = mode === 'dynamic';
    const partial: Omit<GraphicsSettings, 'preset'> = {
      shadows: settings.shadows,
      cloudsAndSky: settings.cloudsAndSky,
      foliageDensity: settings.foliageDensity,
      particles: settings.particles,
      autoOptimizeFps,
      strictLossless,
      showPerformanceHud: showPerfHud,
    };
    onChange({
      ...partial,
      preset: inferGraphicsPreset(partial),
    });
  };

  const activeModeHint =
    FRAME_RATE_MODE_OPTIONS.find((m) => m.id === frameRateMode)?.hint ?? '';

  return (
    <div className="space-y-3 pt-2 border-t border-[#3a332b]" data-testid="graphics-settings-section">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#f5b742]">Graphics</span>
      </div>

      {/* Quality Preset */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <label htmlFor="gfx-preset-select" className="text-[#e8e0d2] min-w-0 truncate">
          Quality
        </label>
        <select
          id="gfx-preset-select"
          data-testid="gfx-preset-select"
          value={settings.preset}
          onChange={(e) => {
            const val = e.target.value as GraphicsQualityPreset;
            if (val === 'custom') return;
            soundEngine.playClick();
            onChange(
              applyGraphicsPreset(val, settings.autoOptimizeFps, isQualityMode, showPerfHud),
            );
          }}
          className={SELECT_CLASS}
        >
          {PRESET_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
          {settings.preset === 'custom' && <option value="custom">Custom</option>}
        </select>
      </div>

      {/* Shadows */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <label htmlFor="gfx-shadows-select" className="text-[#e8e0d2] min-w-0 truncate">
          Shadows
        </label>
        <select
          id="gfx-shadows-select"
          data-testid="gfx-shadows-select"
          value={settings.shadows}
          onChange={(e) => updateField('shadows', e.target.value as ShadowQualityOption)}
          className={SELECT_CLASS}
        >
          {SHADOW_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Clouds & Sky */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <label htmlFor="gfx-sky-select" className="text-[#e8e0d2] min-w-0 truncate">
          Clouds &amp; Sky
        </label>
        <select
          id="gfx-sky-select"
          data-testid="gfx-sky-select"
          value={settings.cloudsAndSky}
          onChange={(e) => updateField('cloudsAndSky', e.target.value as SkyCloudsQualityOption)}
          className={SELECT_CLASS}
        >
          {SKY_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Foliage */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <label htmlFor="gfx-foliage-select" className="text-[#e8e0d2] min-w-0 truncate">
          Foliage
        </label>
        <select
          id="gfx-foliage-select"
          data-testid="gfx-foliage-select"
          value={settings.foliageDensity}
          onChange={(e) => updateField('foliageDensity', e.target.value as FoliageDetailOption)}
          className={SELECT_CLASS}
        >
          {FOLIAGE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Effects */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <label htmlFor="gfx-particles-select" className="text-[#e8e0d2] min-w-0 truncate">
          Effects
        </label>
        <select
          id="gfx-particles-select"
          data-testid="gfx-particles-select"
          value={settings.particles}
          onChange={(e) => updateField('particles', e.target.value as ParticleDetailOption)}
          className={SELECT_CLASS}
        >
          {PARTICLE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Frame Rate Mode */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 pt-1">
        <div className="min-w-0">
          <label htmlFor="gfx-mode-select" className="block text-[#e8e0d2]">
            Performance Mode
          </label>
          <div className="text-[10px] text-[#9e9486]">{activeModeHint}</div>
        </div>
        <select
          id="gfx-mode-select"
          data-testid="gfx-mode-select"
          value={frameRateMode}
          onChange={(e) => handleFrameRateModeChange(e.target.value as FrameRateMode)}
          className={SELECT_CLASS}
        >
          {FRAME_RATE_MODE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
