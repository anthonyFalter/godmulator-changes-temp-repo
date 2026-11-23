import { LightingPreset, SpeciesId } from './types';

export const MAX_SIMULATION_SPEED = 5;
export const SIMULATION_SPEED_OPTIONS = [0, 0.5, 1, 2, 5] as const;
/**
 * Re-baselines simulation time pacing so 1x runs at the previous 0.5x speed,
 * 0.5x runs twice as slow as the new 1x (0.25x legacy pace), and 2x / 5x scale proportionally.
 */
export const SIMULATION_BASE_PACE_SCALE = 0.5;

export const SHADER_TIME_WRAP_PERIOD = 1800;

export function wrapShaderTime(elapsed: number): number {
  if (!Number.isFinite(elapsed)) return 0;
  return ((elapsed % SHADER_TIME_WRAP_PERIOD) + SHADER_TIME_WRAP_PERIOD) % SHADER_TIME_WRAP_PERIOD;
}

export function clampSimulationSpeed(speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) return 0;
  return Math.min(MAX_SIMULATION_SPEED, Math.max(0, speed));
}

export function getEffectiveSimulationSpeed(speed: number): number {
  return clampSimulationSpeed(speed) * SIMULATION_BASE_PACE_SCALE;
}

export type ConcreteLightingPreset = Exclude<LightingPreset, 'auto'>;

export interface TimeOfDayLightingState {
  preset: ConcreteLightingPreset;
  /** 0.0 = bright noon, 0.30 = dawn, 0.68 = dusk, 0.92 = night, 1.0 = midnight */
  darkness: number;
  keyColorHex: number;
  keyIntensity: number;
  /** Directional light offset relative to gridCenter: [dx, y, dz] */
  keyOffset: [number, number, number];
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  rimColorHex: number;
  rimIntensity: number;
  rimOffset: [number, number, number];
  /** Controls RoomEnvironment IBL contribution so night/midnight aren't washed out */
  environmentIntensity: number;
  toneMappingExposure: number;
  /** Atmospheric aerial-perspective fog color & density independent of deep-space backdrop */
  fogColorHex: number;
  fogDensity: number;
  /** Normalized-scale RGB multiplier for sunlit terrain & cliff faces */
  terrainSunTint: [number, number, number];
  /** RGB multiplier for shaded terrain slopes, cliff faces & ambient occlusion */
  terrainShadowTint: [number, number, number];
}

export const TIME_OF_DAY_PRESETS: Record<ConcreteLightingPreset, TimeOfDayLightingState> = {
  dawn: {
    preset: 'dawn',
    darkness: 0.30,
    keyColorHex: 0xff9e6d, // Warm golden-rose sunrise
    keyIntensity: 1.38,
    keyOffset: [25, 13.5, -14], // Low eastern sun angle -> long morning shadows
    hemiSkyHex: 0xf4a28c,
    hemiGroundHex: 0x223247,
    hemiIntensity: 0.52,
    rimColorHex: 0x72ccf2,
    rimIntensity: 0.42,
    rimOffset: [-18, 14, 16],
    environmentIntensity: 0.38,
    toneMappingExposure: 0.96,
    fogColorHex: 0x7d6575,
    fogDensity: 0.0038,
    terrainSunTint: [1.08, 0.82, 0.68],
    terrainShadowTint: [0.46, 0.58, 0.78],
  },
  noon: {
    preset: 'noon',
    darkness: 0.0,
    keyColorHex: 0xffdfb0, // Crisp warm zenith daylight
    keyIntensity: 1.92,
    keyOffset: [12, 29, 8],
    hemiSkyHex: 0x8ecae6,
    hemiGroundHex: 0x2b3a3e,
    hemiIntensity: 0.86,
    rimColorHex: 0x56cfe1,
    rimIntensity: 0.55,
    rimOffset: [-16, 15, -16],
    environmentIntensity: 0.92,
    toneMappingExposure: 1.12,
    fogColorHex: 0x8cc3d8,
    fogDensity: 0.0024,
    terrainSunTint: [1.02, 1.0, 0.98],
    terrainShadowTint: [0.82, 0.88, 0.95],
  },
  dusk: {
    preset: 'dusk',
    darkness: 0.68,
    keyColorHex: 0xff6b3d, // Rich crimson-amber sunset
    keyIntensity: 1.28,
    keyOffset: [-25, 12.0, 15], // Low western sunset angle -> long evening shadows
    hemiSkyHex: 0xd96b7e,
    hemiGroundHex: 0x1c1430,
    hemiIntensity: 0.42,
    rimColorHex: 0xb565f2,
    rimIntensity: 0.38,
    rimOffset: [18, 13, -16],
    environmentIntensity: 0.28,
    toneMappingExposure: 0.92,
    fogColorHex: 0x4c354c,
    fogDensity: 0.0044,
    terrainSunTint: [1.14, 0.68, 0.48],
    terrainShadowTint: [0.40, 0.31, 0.62],
  },
  night: {
    preset: 'night',
    darkness: 0.90,
    keyColorHex: 0x6ea8ff, // Cool silver-blue moonlight
    keyIntensity: 0.46,
    keyOffset: [-15, 22, -12],
    hemiSkyHex: 0x1d3566,
    hemiGroundHex: 0x080d1a,
    hemiIntensity: 0.22,
    rimColorHex: 0x3b6fd4,
    rimIntensity: 0.25,
    rimOffset: [15, 14, 15],
    environmentIntensity: 0.12,
    toneMappingExposure: 0.82,
    fogColorHex: 0x111d30,
    fogDensity: 0.0056,
    terrainSunTint: [0.42, 0.55, 0.84],
    terrainShadowTint: [0.16, 0.22, 0.38],
  },
  midnight: {
    preset: 'midnight',
    darkness: 1.0,
    keyColorHex: 0x4368b8, // Deep starlit abyssal zenith blue
    keyIntensity: 0.24,
    keyOffset: [-6, 25, -8],
    hemiSkyHex: 0x0e1b38,
    hemiGroundHex: 0x04060e,
    hemiIntensity: 0.12,
    rimColorHex: 0x254285,
    rimIntensity: 0.16,
    rimOffset: [12, 16, 12],
    environmentIntensity: 0.06,
    toneMappingExposure: 0.73,
    fogColorHex: 0x080f1f,
    fogDensity: 0.0068,
    terrainSunTint: [0.25, 0.34, 0.58],
    terrainShadowTint: [0.08, 0.11, 0.22],
  },
};

const CYCLE_ORDER: ConcreteLightingPreset[] = ['noon', 'dusk', 'night', 'midnight', 'dawn'];

export function resolveCyclePresetFromPhase(phase01: number): ConcreteLightingPreset {
  const p = ((phase01 % 1) + 1) % 1;
  if (p < 0.26) return 'noon';
  if (p < 0.44) return 'dusk';
  if (p < 0.64) return 'night';
  if (p < 0.82) return 'midnight';
  return 'dawn';
}

export function getTimeOfDayLightingState(
  preset: LightingPreset,
  cyclePhase01 = 0,
): TimeOfDayLightingState {
  if (preset !== 'auto') {
    return TIME_OF_DAY_PRESETS[preset] ?? TIME_OF_DAY_PRESETS.noon;
  }
  const resolved = resolveCyclePresetFromPhase(cyclePhase01);
  return TIME_OF_DAY_PRESETS[resolved];
}

export type CityLightFixtureKind =
  | 'campfire'
  | 'brazier_lantern'
  | 'gas_lamppost'
  | 'city_streetlight'
  | 'arcology_neon';

export interface EpochCityLightProfile {
  fixtureKind: CityLightFixtureKind;
  primaryHex: number;
  secondaryHex: number;
  pointLightIntensity: number;
  pointLightDistance: number;
  windowEmissiveIntensity: number;
  streetFixtureEmissiveIntensity: number;
  groundPoolStrength: number;
  flickerMod: number;
}

export function getEpochCityLightProfile(
  epochIndex: number,
  species: SpeciesId = 'human',
  darkness: number,
  elapsed = 0,
): EpochCityLightProfile {
  const darkClamp = Math.max(0, Math.min(1, darkness));
  const safeElapsed = wrapShaderTime(elapsed);
  // Smooth activation curve: off at noon (0), warm glow at dusk (0.68), full blaze at night/midnight (0.90-1.0)
  const nightFactor = Math.pow(darkClamp, 0.78);
  const organicFlicker =
    1 +
    (Math.sin(safeElapsed * 13.7) * 0.11 +
      Math.cos(safeElapsed * 21.3) * 0.07 +
      Math.sin(safeElapsed * 31.1) * 0.04);

  if (epochIndex <= 0) {
    // Prehistoric / Stone Age: Flickering campfires, bonfires & wooden fire-torches
    const primaryHex =
      species === 'elf'
        ? 0x48f5c8
        : species === 'orc'
          ? 0xff4814
          : species === 'dwarf'
            ? 0xffa62b
            : species === 'lizardfolk'
              ? 0xfacc15
              : 0xff7b1c;
    const secondaryHex =
      species === 'elf'
        ? 0xa8ffdb
        : species === 'orc'
          ? 0xff922b
          : species === 'dwarf'
            ? 0xffd166
            : species === 'lizardfolk'
              ? 0x34d399
              : 0xffb703;
    return {
      fixtureKind: 'campfire',
      primaryHex,
      secondaryHex,
      pointLightIntensity: (0.45 + nightFactor * 2.85) * organicFlicker,
      pointLightDistance: 10.5 + nightFactor * 5.0,
      windowEmissiveIntensity: (0.25 + nightFactor * 1.65) * organicFlicker,
      streetFixtureEmissiveIntensity: (0.2 + nightFactor * 2.15) * organicFlicker,
      groundPoolStrength: nightFactor * 0.92 * organicFlicker,
      flickerMod: organicFlicker,
    };
  }

  if (epochIndex <= 2) {
    // Bronze & Classical / Medieval Ages: Wrought-iron braziers, wall torches & candlelit windows
    const torchFlicker =
      1 + (Math.sin(safeElapsed * 10.5) * 0.065 + Math.cos(safeElapsed * 16.8) * 0.045);
    const primaryHex =
      species === 'elf'
        ? 0x52f2c8
        : species === 'orc'
          ? 0xff5421
          : species === 'dwarf'
            ? 0xf59e0b
            : species === 'lizardfolk'
              ? 0xfde047
              : 0xff9e2c;
    const secondaryHex =
      species === 'elf'
        ? 0xffd166
        : species === 'orc'
          ? 0xff9f1c
          : species === 'dwarf'
            ? 0xfbbf24
            : species === 'lizardfolk'
              ? 0x2dd4bf
              : 0xffd166;
    return {
      fixtureKind: 'brazier_lantern',
      primaryHex,
      secondaryHex,
      pointLightIntensity: (0.35 + nightFactor * 2.95) * torchFlicker,
      pointLightDistance: 12.0 + nightFactor * 6.0,
      windowEmissiveIntensity: 0.08 + nightFactor * 1.85 * torchFlicker,
      streetFixtureEmissiveIntensity: 0.1 + nightFactor * 2.2 * torchFlicker,
      groundPoolStrength: nightFactor * 0.95 * torchFlicker,
      flickerMod: torchFlicker,
    };
  }

  if (epochIndex === 3) {
    // Industrial Age: Cast-iron Victorian gaslight lampposts, factory skylights & warm tenement windows
    const gasHum = 1 + Math.sin(safeElapsed * 7.2) * 0.025;
    const primaryHex =
      species === 'elf'
        ? 0x64dfdf
        : species === 'orc'
          ? 0xff6b2b
          : species === 'dwarf'
            ? 0xf59e0b
            : species === 'lizardfolk'
              ? 0xfacc15
              : 0xffc44d;
    const secondaryHex =
      species === 'elf'
        ? 0xffe699
        : species === 'orc'
          ? 0xff3b1f
          : species === 'dwarf'
            ? 0xff7b1c
            : species === 'lizardfolk'
              ? 0x10b981
              : 0xff922b;
    return {
      fixtureKind: 'gas_lamppost',
      primaryHex,
      secondaryHex,
      pointLightIntensity: (0.25 + nightFactor * 3.15) * gasHum,
      pointLightDistance: 14.0 + nightFactor * 7.0,
      windowEmissiveIntensity: 0.06 + nightFactor * 2.0 * gasHum,
      streetFixtureEmissiveIntensity: 0.08 + nightFactor * 2.4 * gasHum,
      groundPoolStrength: nightFactor * 1.0 * gasHum,
      flickerMod: gasHum,
    };
  }

  if (epochIndex <= 5) {
    // Modern / Atomic & Information Ages: High-rise city lights, sodium/LED streetlamps, neon & airport beacons
    const primaryHex =
      species === 'elf'
        ? 0x72efdd
        : species === 'orc'
          ? 0xff5e36
          : species === 'dwarf'
            ? 0xfbbf24
            : species === 'lizardfolk'
              ? 0xfde047
              : epochIndex === 5
                ? 0xfff0b3
                : 0xffe082;
    const secondaryHex =
      species === 'elf'
        ? 0x48bfe3
        : species === 'orc'
          ? 0xffbe0b
          : species === 'dwarf'
            ? 0xf97316
            : species === 'lizardfolk'
              ? 0x14b8a6
              : 0x38bdf8;
    return {
      fixtureKind: 'city_streetlight',
      primaryHex,
      secondaryHex,
      pointLightIntensity: 0.2 + nightFactor * 3.45,
      pointLightDistance: 16.0 + nightFactor * 8.5,
      windowEmissiveIntensity: 0.1 + nightFactor * 2.35,
      streetFixtureEmissiveIntensity: 0.08 + nightFactor * 2.65,
      groundPoolStrength: nightFactor * 1.08,
      flickerMod: 1.0,
    };
  }

  // Orbital & Interstellar Ages (epochIndex >= 6): Bioluminescent arcologies, plasma street luminaires & cyan/gold transit grids
  const pulse = 1 + Math.sin(safeElapsed * 3.2) * 0.05;
  const primaryHex =
    species === 'elf'
      ? 0x52f2c8
      : species === 'orc'
        ? 0xff5421
        : species === 'dwarf'
          ? 0xfbbf24
          : species === 'lizardfolk'
            ? 0xfde047
            : 0x56cfe1;
  const secondaryHex =
    species === 'elf'
      ? 0xffd166
      : species === 'orc'
        ? 0xffbe0b
        : species === 'dwarf'
          ? 0xf97316
          : species === 'lizardfolk'
            ? 0x10b981
            : 0xffd166;
  return {
    fixtureKind: 'arcology_neon',
    primaryHex,
    secondaryHex,
    pointLightIntensity: (0.35 + nightFactor * 3.6) * pulse,
    pointLightDistance: 17.5 + nightFactor * 9.5,
    windowEmissiveIntensity: (0.35 + nightFactor * 2.45) * pulse,
    streetFixtureEmissiveIntensity: (0.3 + nightFactor * 2.75) * pulse,
    groundPoolStrength: (0.18 + nightFactor * 0.98) * pulse,
    flickerMod: pulse,
  };
}
