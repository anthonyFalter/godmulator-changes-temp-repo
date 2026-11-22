import {
  FoliageDetailOption,
  GraphicsQualityPreset,
  GraphicsSettings,
  ParticleDetailOption,
  ShadowQualityOption,
  SkyCloudsQualityOption,
} from './types';

export const GRAPHICS_STORAGE_KEY = 'godmulator_graphics_settings_v1';

export const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettings = {
  preset: 'high',
  shadows: 'on',
  cloudsAndSky: 'full',
  foliageDensity: 'full',
  particles: 'full',
  autoOptimizeFps: true,
  strictLossless: true,
  showPerformanceHud: false,
  cameraShake: true,
};

export const GRAPHICS_PRESET_CONFIGS: Record<
  Exclude<GraphicsQualityPreset, 'custom'>,
  Omit<GraphicsSettings, 'preset' | 'strictLossless' | 'showPerformanceHud' | 'cameraShake'>
> = {
  high: {
    shadows: 'on',
    cloudsAndSky: 'full',
    foliageDensity: 'full',
    particles: 'full',
    autoOptimizeFps: true,
  },
  balanced: {
    shadows: 'fast',
    cloudsAndSky: 'reduced',
    foliageDensity: 'medium',
    particles: 'reduced',
    autoOptimizeFps: true,
  },
  fast: {
    shadows: 'off',
    cloudsAndSky: 'off',
    foliageDensity: 'low',
    particles: 'low',
    autoOptimizeFps: true,
  },
};

export function inferGraphicsPreset(
  settings: Omit<GraphicsSettings, 'preset'>,
): GraphicsQualityPreset {
  for (const key of ['high', 'balanced', 'fast'] as const) {
    const p = GRAPHICS_PRESET_CONFIGS[key];
    if (
      settings.shadows === p.shadows &&
      settings.cloudsAndSky === p.cloudsAndSky &&
      settings.foliageDensity === p.foliageDensity &&
      settings.particles === p.particles
    ) {
      return key;
    }
  }
  return 'custom';
}

export function applyGraphicsPreset(
  preset: Exclude<GraphicsQualityPreset, 'custom'>,
  autoOptimizeFps: boolean,
  strictLossless = true,
  showPerformanceHud = false,
  cameraShake = true,
): GraphicsSettings {
  return {
    preset,
    ...GRAPHICS_PRESET_CONFIGS[preset],
    autoOptimizeFps,
    strictLossless,
    showPerformanceHud,
    cameraShake,
  };
}

export interface ResolvedGraphicsProfile {
  shadowsEnabled: boolean;
  shadowMapSize: 512 | 1024;
  shadowUpdateStride: 1 | 3;
  cloudsAndSky: SkyCloudsQualityOption;
  foliageFactor: number;
  particleScale: number;
}

export function resolveGraphicsProfile(
  settings: GraphicsSettings,
  autoTrimLevel: 0 | 1 | 2 = 0,
): ResolvedGraphicsProfile {
  const shadows: ShadowQualityOption = settings.shadows;
  let cloudsAndSky: SkyCloudsQualityOption = settings.cloudsAndSky;
  let foliageDensity: FoliageDetailOption = settings.foliageDensity;
  let particles: ParticleDetailOption = settings.particles;
  let shadowUpdateStride: 1 | 3 = 1;

  // Quality mode (strictLossless=true): keep full user-selected detail at all times
  // Dynamic FPS mode (!strictLossless && autoOptimizeFps): adaptively trim when FPS dips
  // Performance mode (!strictLossless && !autoOptimizeFps): always prioritize smoother frame rates
  const isStrictLossless = settings.strictLossless !== false;
  if (!isStrictLossless && !settings.autoOptimizeFps) {
    if (cloudsAndSky === 'full') cloudsAndSky = 'reduced';
    if (foliageDensity === 'full') foliageDensity = 'medium';
    if (particles === 'full') particles = 'reduced';
    shadowUpdateStride = 3;
  } else if (!isStrictLossless && settings.autoOptimizeFps && autoTrimLevel > 0) {
    if (autoTrimLevel >= 1) {
      if (cloudsAndSky === 'full') cloudsAndSky = 'reduced';
      if (particles === 'full') particles = 'reduced';
    }
    if (autoTrimLevel >= 2) {
      if (cloudsAndSky === 'reduced') cloudsAndSky = 'off';
      if (foliageDensity === 'full') foliageDensity = 'medium';
      if (particles !== 'low') particles = 'low';
      shadowUpdateStride = 3;
    }
  }

  return {
    shadowsEnabled: shadows !== 'off',
    shadowMapSize: shadows === 'fast' ? 512 : 1024,
    shadowUpdateStride,
    cloudsAndSky,
    foliageFactor: foliageDensity === 'low' ? 0.22 : foliageDensity === 'medium' ? 0.55 : 1.0,
    particleScale: particles === 'low' ? 0.25 : particles === 'reduced' ? 0.55 : 1.0,
  };
}

const VALID_SHADOWS: ReadonlySet<string> = new Set(['on', 'fast', 'off']);
const VALID_SKY: ReadonlySet<string> = new Set(['full', 'reduced', 'off']);
const VALID_FOLIAGE: ReadonlySet<string> = new Set(['full', 'medium', 'low']);
const VALID_PARTICLES: ReadonlySet<string> = new Set(['full', 'reduced', 'low']);

export function sanitizeGraphicsSettings(raw: unknown): GraphicsSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_GRAPHICS_SETTINGS };
  }
  const obj = raw as Record<string, unknown>;
  const shadows: ShadowQualityOption =
    typeof obj.shadows === 'string' && VALID_SHADOWS.has(obj.shadows)
      ? (obj.shadows as ShadowQualityOption)
      : DEFAULT_GRAPHICS_SETTINGS.shadows;
  const cloudsAndSky: SkyCloudsQualityOption =
    typeof obj.cloudsAndSky === 'string' && VALID_SKY.has(obj.cloudsAndSky)
      ? (obj.cloudsAndSky as SkyCloudsQualityOption)
      : DEFAULT_GRAPHICS_SETTINGS.cloudsAndSky;
  const foliageDensity: FoliageDetailOption =
    typeof obj.foliageDensity === 'string' && VALID_FOLIAGE.has(obj.foliageDensity)
      ? (obj.foliageDensity as FoliageDetailOption)
      : DEFAULT_GRAPHICS_SETTINGS.foliageDensity;
  const particles: ParticleDetailOption =
    typeof obj.particles === 'string' && VALID_PARTICLES.has(obj.particles)
      ? (obj.particles as ParticleDetailOption)
      : DEFAULT_GRAPHICS_SETTINGS.particles;
  const autoOptimizeFps =
    typeof obj.autoOptimizeFps === 'boolean'
      ? obj.autoOptimizeFps
      : DEFAULT_GRAPHICS_SETTINGS.autoOptimizeFps;
  const strictLossless =
    typeof obj.strictLossless === 'boolean'
      ? obj.strictLossless
      : DEFAULT_GRAPHICS_SETTINGS.strictLossless;
  const showPerformanceHud =
    typeof obj.showPerformanceHud === 'boolean'
      ? obj.showPerformanceHud
      : DEFAULT_GRAPHICS_SETTINGS.showPerformanceHud;
  const cameraShake =
    typeof obj.cameraShake === 'boolean'
      ? obj.cameraShake
      : DEFAULT_GRAPHICS_SETTINGS.cameraShake;

  return {
    preset: inferGraphicsPreset({
      shadows,
      cloudsAndSky,
      foliageDensity,
      particles,
      autoOptimizeFps,
    }),
    shadows,
    cloudsAndSky,
    foliageDensity,
    particles,
    autoOptimizeFps,
    strictLossless,
    showPerformanceHud,
    cameraShake,
  };
}

export function loadGraphicsSettings(): GraphicsSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_GRAPHICS_SETTINGS };
  }
  try {
    const raw = window.localStorage.getItem(GRAPHICS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GRAPHICS_SETTINGS };
    return sanitizeGraphicsSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_GRAPHICS_SETTINGS };
  }
}

export function saveGraphicsSettings(settings: GraphicsSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(GRAPHICS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota / privacy errors
  }
}
