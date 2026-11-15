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
  { id: 'balanced', label: 'Balanced' },
  { id: 'fast', label: 'Fast' },
];

const SHADOW_OPTIONS: { id: ShadowQualityOption; label: string }[] = [
  { id: 'on', label: 'On' },
  { id: 'fast', label: 'Fast' },
  { id: 'off', label: 'Off' },
];

const SKY_OPTIONS: { id: SkyCloudsQualityOption; label: string }[] = [
  { id: 'full', label: 'Full' },
  { id: 'reduced', label: 'Reduced' },
  { id: 'off', label: 'Off' },
];

const FOLIAGE_OPTIONS: { id: FoliageDetailOption; label: string }[] = [
  { id: 'full', label: 'Full' },
  { id: 'medium', label: 'Med' },
  { id: 'low', label: 'Low' },
];

const PARTICLE_OPTIONS: { id: ParticleDetailOption; label: string }[] = [
  { id: 'full', label: 'Full' },
  { id: 'reduced', label: 'Reduced' },
  { id: 'low', label: 'Low' },
];

export const GraphicsSettingsPanel: React.FC<GraphicsSettingsPanelProps> = ({
  settings,
  onChange,
}) => {
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
      [key]: value,
    };
    onChange({
      ...partial,
      preset: inferGraphicsPreset(partial),
    });
  };

  return (
    <div className="space-y-3 pt-2 border-t border-[#3a332b]" data-testid="graphics-settings-section">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#f5b742]">Graphics</span>
        {settings.preset === 'custom' && (
          <span className="text-[11px] font-semibold text-[#56cfe1]">Custom</span>
        )}
      </div>

      {/* Overall Preset */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[#e8e0d2]">Preset</span>
        <div className="grid grid-cols-3 gap-1 w-48">
          {PRESET_OPTIONS.map((opt) => {
            const active = settings.preset === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                data-testid={`gfx-preset-${opt.id}`}
                onClick={() => {
                  soundEngine.playClick();
                  onChange(applyGraphicsPreset(opt.id, settings.autoOptimizeFps));
                }}
                className={`py-1 text-[11px] cursor-pointer ${
                  active ? 'px-btn-active font-bold' : 'px-btn'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Shadows */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[#e8e0d2]">Shadows</span>
        <div className="grid grid-cols-3 gap-1 w-48">
          {SHADOW_OPTIONS.map((opt) => {
            const active = settings.shadows === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                data-testid={`gfx-shadows-${opt.id}`}
                onClick={() => updateField('shadows', opt.id)}
                className={`py-1 text-[11px] cursor-pointer ${
                  active ? 'px-btn-active font-bold' : 'px-btn'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sky & Clouds */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[#e8e0d2]">Sky &amp; Clouds</span>
        <div className="grid grid-cols-3 gap-1 w-48">
          {SKY_OPTIONS.map((opt) => {
            const active = settings.cloudsAndSky === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                data-testid={`gfx-sky-${opt.id}`}
                onClick={() => updateField('cloudsAndSky', opt.id)}
                className={`py-1 text-[11px] cursor-pointer ${
                  active ? 'px-btn-active font-bold' : 'px-btn'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Foliage Detail */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[#e8e0d2]">Foliage Detail</span>
        <div className="grid grid-cols-3 gap-1 w-48">
          {FOLIAGE_OPTIONS.map((opt) => {
            const active = settings.foliageDensity === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                data-testid={`gfx-foliage-${opt.id}`}
                onClick={() => updateField('foliageDensity', opt.id)}
                className={`py-1 text-[11px] cursor-pointer ${
                  active ? 'px-btn-active font-bold' : 'px-btn'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Particles */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[#e8e0d2]">Particles</span>
        <div className="grid grid-cols-3 gap-1 w-48">
          {PARTICLE_OPTIONS.map((opt) => {
            const active = settings.particles === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                data-testid={`gfx-particles-${opt.id}`}
                onClick={() => updateField('particles', opt.id)}
                className={`py-1 text-[11px] cursor-pointer ${
                  active ? 'px-btn-active font-bold' : 'px-btn'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Auto-Optimize FPS */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div>
          <div className="text-[#e8e0d2]">Auto-Optimize FPS</div>
          <div className="text-[10px] text-[#9e9486]">
            Automatically trims FX if frame rate dips
          </div>
        </div>
        <button
          type="button"
          data-testid="gfx-auto-fps-toggle"
          aria-pressed={settings.autoOptimizeFps}
          onClick={() => updateField('autoOptimizeFps', !settings.autoOptimizeFps)}
          className={`px-3 py-1.5 font-semibold cursor-pointer shrink-0 ${
            settings.autoOptimizeFps ? 'px-btn-active font-bold' : 'px-btn'
          }`}
        >
          {settings.autoOptimizeFps ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
};
