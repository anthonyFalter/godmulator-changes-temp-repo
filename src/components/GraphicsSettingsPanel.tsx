import React, { useEffect, useRef, useState } from 'react';
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
import { HudPixelIcon } from './GameIcons';

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

interface PixelDropdownProps<T extends string> {
  id: string;
  testId: string;
  value: T;
  displayLabel: string;
  options: { id: T; label: string }[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  onSelect: (val: T) => void;
  openUpward?: boolean;
}

function PixelDropdown<T extends string>({
  id,
  testId,
  value,
  displayLabel,
  options,
  openId,
  setOpenId,
  onSelect,
  openUpward = false,
}: PixelDropdownProps<T>) {
  const isOpen = openId === id;
  return (
    <div className="relative w-32 sm:w-40 shrink-0">
      <button
        type="button"
        data-testid={testId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => {
          soundEngine.playClick();
          setOpenId(isOpen ? null : id);
        }}
        className={`w-full px-2.5 py-1.5 sm:py-1 text-[11px] flex items-center justify-between gap-1.5 cursor-pointer whitespace-nowrap ${
          isOpen ? 'px-btn-active font-bold' : 'px-btn font-semibold'
        }`}
      >
        <span className="truncate">{displayLabel}</span>
        <HudPixelIcon
          kind="chevronDown"
          className={`w-2.5 h-2.5 sm:w-3 sm:h-3 pixelated-canvas shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className={`px-panel absolute right-0 z-50 w-full p-1 flex flex-col gap-1 ${
            openUpward ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]'
          }`}
        >
          {options.map((opt) => {
            const active = value === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={active}
                data-testid={`${testId}-${opt.id}`}
                onClick={() => {
                  onSelect(opt.id);
                  setOpenId(null);
                }}
                className={`w-full px-2 py-1 text-left text-[11px] cursor-pointer whitespace-nowrap ${
                  active ? 'px-btn-active font-bold' : 'px-btn'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const GraphicsSettingsPanel: React.FC<GraphicsSettingsPanelProps> = ({
  settings,
  onChange,
}) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openId) return;
    const onPointerDown = (e: PointerEvent) => {
      if (panelRef.current && e.target instanceof Node && !panelRef.current.contains(e.target)) {
        setOpenId(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openId]);

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

  const presetLabel =
    settings.preset === 'custom'
      ? 'Custom'
      : (PRESET_OPTIONS.find((o) => o.id === settings.preset)?.label ?? 'High');
  const shadowLabel = SHADOW_OPTIONS.find((o) => o.id === settings.shadows)?.label ?? 'High';
  const skyLabel = SKY_OPTIONS.find((o) => o.id === settings.cloudsAndSky)?.label ?? 'High';
  const foliageLabel = FOLIAGE_OPTIONS.find((o) => o.id === settings.foliageDensity)?.label ?? 'High';
  const particleLabel = PARTICLE_OPTIONS.find((o) => o.id === settings.particles)?.label ?? 'High';
  const activeMode =
    FRAME_RATE_MODE_OPTIONS.find((m) => m.id === frameRateMode) ?? FRAME_RATE_MODE_OPTIONS[0];

  return (
    <div
      ref={panelRef}
      className="space-y-2.5 pt-2 border-t border-[#3a332b]"
      data-testid="graphics-settings-section"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#f5b742]">Graphics</span>
      </div>

      {/* Quality Preset */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <span className="text-[#e8e0d2] min-w-0 truncate">Quality</span>
        <PixelDropdown
          id="preset"
          testId="gfx-preset"
          value={settings.preset === 'custom' ? 'high' : settings.preset}
          displayLabel={presetLabel}
          options={PRESET_OPTIONS}
          openId={openId}
          setOpenId={setOpenId}
          onSelect={(val) => {
            soundEngine.playClick();
            onChange(
              applyGraphicsPreset(val, settings.autoOptimizeFps, isQualityMode, showPerfHud),
            );
          }}
        />
      </div>

      {/* Shadows */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <span className="text-[#e8e0d2] min-w-0 truncate">Shadows</span>
        <PixelDropdown
          id="shadows"
          testId="gfx-shadows"
          value={settings.shadows}
          displayLabel={shadowLabel}
          options={SHADOW_OPTIONS}
          openId={openId}
          setOpenId={setOpenId}
          onSelect={(val) => updateField('shadows', val)}
        />
      </div>

      {/* Clouds & Sky */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <span className="text-[#e8e0d2] min-w-0 truncate">Clouds &amp; Sky</span>
        <PixelDropdown
          id="sky"
          testId="gfx-sky"
          value={settings.cloudsAndSky}
          displayLabel={skyLabel}
          options={SKY_OPTIONS}
          openId={openId}
          setOpenId={setOpenId}
          onSelect={(val) => updateField('cloudsAndSky', val)}
        />
      </div>

      {/* Foliage */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <span className="text-[#e8e0d2] min-w-0 truncate">Foliage</span>
        <PixelDropdown
          id="foliage"
          testId="gfx-foliage"
          value={settings.foliageDensity}
          displayLabel={foliageLabel}
          options={FOLIAGE_OPTIONS}
          openId={openId}
          setOpenId={setOpenId}
          onSelect={(val) => updateField('foliageDensity', val)}
        />
      </div>

      {/* Effects */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <span className="text-[#e8e0d2] min-w-0 truncate">Effects</span>
        <PixelDropdown
          id="particles"
          testId="gfx-particles"
          value={settings.particles}
          displayLabel={particleLabel}
          options={PARTICLE_OPTIONS}
          openId={openId}
          setOpenId={setOpenId}
          onSelect={(val) => updateField('particles', val)}
          openUpward
        />
      </div>

      {/* Performance Mode */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 pt-0.5">
        <div className="min-w-0">
          <div className="text-[#e8e0d2]">Performance Mode</div>
          <div className="text-[10px] text-[#9e9486]">{activeMode.hint}</div>
        </div>
        <PixelDropdown
          id="mode"
          testId="gfx-mode"
          value={frameRateMode}
          displayLabel={activeMode.label}
          options={FRAME_RATE_MODE_OPTIONS}
          openId={openId}
          setOpenId={setOpenId}
          onSelect={handleFrameRateModeChange}
          openUpward
        />
      </div>

      {/* Performance Stats */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 pt-0.5">
        <span className="text-[#e8e0d2] min-w-0 truncate">Performance Stats</span>
        <button
          type="button"
          data-testid="gfx-perf-stats"
          aria-pressed={showPerfHud}
          onClick={() => updateField('showPerformanceHud', !showPerfHud)}
          className={`px-3 py-1 text-[11px] font-semibold cursor-pointer ${
            showPerfHud ? 'px-btn-active font-bold' : 'px-btn'
          }`}
        >
          {showPerfHud ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
};
