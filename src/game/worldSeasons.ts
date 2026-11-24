import * as THREE from 'three';
import type { SeasonId, SeasonPreset } from './types';

export interface SeasonPresetOption {
  id: SeasonPreset;
  label: string;
  shortLabel: string;
}

export const WORLD_SEASON_PRESETS: SeasonPresetOption[] = [
  { id: 'auto', label: 'Auto Cycle', shortLabel: 'Auto' },
  { id: 'spring', label: 'Spring', shortLabel: 'Spr' },
  { id: 'summer', label: 'Summer', shortLabel: 'Sum' },
  { id: 'autumn', label: 'Autumn', shortLabel: 'Aut' },
  { id: 'winter', label: 'Winter', shortLabel: 'Win' },
];

export const YEARS_PER_SEASON = 4;
export const FULL_SEASON_CYCLE_YEARS = YEARS_PER_SEASON * 4;

export interface SeasonProfile {
  id: SeasonId;
  /** RGB multipliers blended smoothly onto directional key light */
  keyTint: [number, number, number];
  /** RGB multipliers blended onto hemisphere sky fill */
  hemiTint: [number, number, number];
  /** RGB multipliers blended onto rim light */
  rimTint: [number, number, number];
  /** RGB multipliers blended onto aerial fog */
  fogTint: [number, number, number];
  fogDensityMult: number;
  windX: number;
  windZ: number;
}

export const SEASON_PROFILES: Record<SeasonId, SeasonProfile> = {
  spring: {
    id: 'spring',
    keyTint: [1.02, 1.03, 0.99],
    hemiTint: [1.02, 1.05, 1.04],
    rimTint: [0.98, 1.04, 1.05],
    fogTint: [1.04, 1.06, 1.05],
    fogDensityMult: 0.96,
    windX: 0.42,
    windZ: 0.16,
  },
  summer: {
    id: 'summer',
    keyTint: [1.07, 1.01, 0.91],
    hemiTint: [1.02, 1.01, 0.96],
    rimTint: [1.06, 0.99, 0.90],
    fogTint: [1.06, 1.03, 0.96],
    fogDensityMult: 0.92,
    windX: 0.24,
    windZ: -0.10,
  },
  autumn: {
    id: 'autumn',
    keyTint: [1.12, 0.89, 0.72],
    hemiTint: [1.05, 0.92, 0.84],
    rimTint: [1.14, 0.84, 0.68],
    fogTint: [1.09, 0.92, 0.82],
    fogDensityMult: 1.09,
    windX: 0.68,
    windZ: 0.26,
  },
  winter: {
    id: 'winter',
    keyTint: [0.91, 0.97, 1.11],
    hemiTint: [0.93, 0.99, 1.12],
    rimTint: [0.88, 0.99, 1.16],
    fogTint: [0.95, 1.02, 1.12],
    fogDensityMult: 1.18,
    windX: 0.82,
    windZ: 0.44,
  },
};

const SEASON_ORDER: readonly SeasonId[] = ['spring', 'summer', 'autumn', 'winter'];

export interface SeasonalVisualState {
  dominantSeason: SeasonId;
  weights: Record<SeasonId, number>;
  keyTint: [number, number, number];
  hemiTint: [number, number, number];
  rimTint: [number, number, number];
  fogTint: [number, number, number];
  fogDensityMult: number;
  windX: number;
  windZ: number;
}

function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Resolves smooth seasonal blend weights, lighting tints, and wind vector
 * from either a locked SeasonPreset or continuously from the current world year.
 */
export function computeSeasonState(
  preset: SeasonPreset,
  worldYear: number,
): SeasonalVisualState {
  const weights: Record<SeasonId, number> = {
    spring: 0,
    summer: 0,
    autumn: 0,
    winter: 0,
  };

  if (preset !== 'auto' && SEASON_PROFILES[preset]) {
    weights[preset] = 1;
    const p = SEASON_PROFILES[preset];
    return {
      dominantSeason: preset,
      weights,
      keyTint: [p.keyTint[0], p.keyTint[1], p.keyTint[2]],
      hemiTint: [p.hemiTint[0], p.hemiTint[1], p.hemiTint[2]],
      rimTint: [p.rimTint[0], p.rimTint[1], p.rimTint[2]],
      fogTint: [p.fogTint[0], p.fogTint[1], p.fogTint[2]],
      fogDensityMult: p.fogDensityMult,
      windX: p.windX,
      windZ: p.windZ,
    };
  }

  const safeYear = Number.isFinite(worldYear) ? Math.max(0, worldYear) : 0;
  // Continuous 0..4 season cursor across the 16-year cycle
  const cyclePos = ((safeYear % FULL_SEASON_CYCLE_YEARS) + FULL_SEASON_CYCLE_YEARS) % FULL_SEASON_CYCLE_YEARS;
  const seasonFloat = cyclePos / YEARS_PER_SEASON; // 0..4
  const curIdx = Math.floor(seasonFloat) % 4;
  const nextIdx = (curIdx + 1) % 4;
  const localFrac = seasonFloat - Math.floor(seasonFloat); // 0..1 inside current season

  // Stay mostly pure in the middle of each season, then crossfade cleanly over the last 30%
  const blendStart = 0.70;
  const nextW = localFrac > blendStart ? smoothstep01((localFrac - blendStart) / (1 - blendStart)) : 0;
  const curW = 1 - nextW;

  const curId = SEASON_ORDER[curIdx];
  const nextId = SEASON_ORDER[nextIdx];
  weights[curId] = curW;
  weights[nextId] = nextW;

  const dominantSeason = nextW > curW ? nextId : curId;
  const pA = SEASON_PROFILES[curId];
  const pB = SEASON_PROFILES[nextId];

  const mix3 = (
    a: [number, number, number],
    b: [number, number, number],
  ): [number, number, number] => [
    a[0] * curW + b[0] * nextW,
    a[1] * curW + b[1] * nextW,
    a[2] * curW + b[2] * nextW,
  ];

  return {
    dominantSeason,
    weights,
    keyTint: mix3(pA.keyTint, pB.keyTint),
    hemiTint: mix3(pA.hemiTint, pB.hemiTint),
    rimTint: mix3(pA.rimTint, pB.rimTint),
    fogTint: mix3(pA.fogTint, pB.fogTint),
    fogDensityMult: pA.fogDensityMult * curW + pB.fogDensityMult * nextW,
    windX: pA.windX * curW + pB.windX * nextW,
    windZ: pA.windZ * curW + pB.windZ * nextW,
  };
}

/**
 * Multiplies a THREE.Color in-place by an RGB tint triple (clamped safely for ACES tone mapping).
 */
export function multiplyColorByTint(
  color: THREE.Color,
  tint: [number, number, number],
  strength = 1.0,
): void {
  const s = Math.max(0, Math.min(1, strength));
  const tr = 1 + (tint[0] - 1) * s;
  const tg = 1 + (tint[1] - 1) * s;
  const tb = 1 + (tint[2] - 1) * s;
  color.setRGB(
    Math.min(1.35, color.r * tr),
    Math.min(1.35, color.g * tg),
    Math.min(1.35, color.b * tb),
  );
}

type SeasonParticleKind = 'petal' | 'pollen' | 'firefly' | 'leaf' | 'snow';

interface SeasonParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  phase: number;
  spin: number;
  scale: number;
  kind: SeasonParticleKind;
  colorHex: number;
  active: boolean;
}

export interface SeasonalAtmosphereSystem {
  group: THREE.Group;
  update: (
    dt: number,
    elapsed: number,
    season: SeasonalVisualState,
    darkness: number,
    focusX: number,
    focusZ: number,
    frustumSize: number,
    particleScale: number,
    simSpeedFactor: number,
  ) => void;
  dispose: () => void;
}

const MAX_SEASON_PARTICLES = 156;

const SPRING_PETAL_COLORS = [0xfbcfe8, 0xfdf2f8, 0xf9a8d4, 0xfef08a, 0xffffff];
const SUMMER_POLLEN_COLORS = [0xfef08a, 0xfde68a, 0xfef9c3];
const SUMMER_FIREFLY_COLORS = [0xbef264, 0xfde047, 0xd9f99d, 0xfef08a];
const AUTUMN_LEAF_COLORS = [0xea580c, 0xd97706, 0xdc2626, 0xf59e0b, 0xb45309];
const WINTER_SNOW_COLORS = [0xffffff, 0xe0f2fe, 0xdbeafe, 0xf8fafc];

/**
 * Camera-local 1-draw-call seasonal atmosphere particle system:
 * - Spring: fluttering pastel blossom petals
 * - Summer: warm daytime sunlit pollen motes & glowing evening/night fireflies
 * - Autumn: tumbling amber/crimson harvest leaves
 * - Winter: crisp diagonal pixel snowflakes
 *
 * Uses zero per-frame allocations and scales cleanly with particle quality budgets.
 */
export function createSeasonalAtmosphereSystem(): SeasonalAtmosphereSystem {
  const group = new THREE.Group();
  group.name = 'seasonal_atmosphere_group';

  const geo = new THREE.BoxGeometry(0.15, 0.055, 0.13);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, MAX_SEASON_PARTICLES);
  mesh.count = 0;
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 11;
  group.add(mesh);

  const pool: SeasonParticle[] = Array.from({ length: MAX_SEASON_PARTICLES }, (_, i) => ({
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: -0.5,
    vz: 0,
    phase: i * 1.618,
    spin: 1 + (i % 5) * 0.45,
    scale: 1,
    kind: 'petal',
    colorHex: 0xffffff,
    active: false,
  }));

  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  let initialized = false;

  const pickSeasonKind = (
    season: SeasonalVisualState,
    darkness: number,
  ): SeasonParticleKind => {
    const r = Math.random();
    const wSpr = season.weights.spring;
    const wSum = season.weights.summer;
    const wAut = season.weights.autumn;
    let chosen: SeasonId = 'winter';
    if (r < wSpr) chosen = 'spring';
    else if (r < wSpr + wSum) chosen = 'summer';
    else if (r < wSpr + wSum + wAut) chosen = 'autumn';

    if (chosen === 'spring') return darkness > 0.62 && Math.random() < 0.35 ? 'firefly' : 'petal';
    if (chosen === 'summer') return darkness >= 0.44 ? 'firefly' : 'pollen';
    if (chosen === 'autumn') return 'leaf';
    return 'snow';
  };

  const respawnParticle = (
    p: SeasonParticle,
    season: SeasonalVisualState,
    darkness: number,
    focusX: number,
    focusZ: number,
    span: number,
    randomHeight: boolean,
  ) => {
    const kind = pickSeasonKind(season, darkness);
    p.kind = kind;
    p.active = true;
    p.x = focusX + (Math.random() - 0.5) * span * 1.45;
    p.z = focusZ + (Math.random() - 0.5) * span * 1.45;
    p.phase = Math.random() * Math.PI * 2;
    p.spin = (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 2.4);

    if (kind === 'petal') {
      p.y = randomHeight ? 0.9 + Math.random() * 12.5 : 10.5 + Math.random() * 3.8;
      p.vx = season.windX * (1.1 + Math.random() * 0.6);
      p.vy = -(0.55 + Math.random() * 0.38);
      p.vz = season.windZ * (1.1 + Math.random() * 0.6);
      p.scale = 0.72 + Math.random() * 0.45;
      p.colorHex = SPRING_PETAL_COLORS[Math.floor(Math.random() * SPRING_PETAL_COLORS.length)];
    } else if (kind === 'pollen') {
      p.y = randomHeight ? 0.8 + Math.random() * 8.0 : 1.0 + Math.random() * 6.5;
      p.vx = season.windX * 0.75 + (Math.random() - 0.5) * 0.25;
      p.vy = (Math.random() - 0.42) * 0.22;
      p.vz = season.windZ * 0.75 + (Math.random() - 0.5) * 0.25;
      p.scale = 0.52 + Math.random() * 0.32;
      p.colorHex = SUMMER_POLLEN_COLORS[Math.floor(Math.random() * SUMMER_POLLEN_COLORS.length)];
    } else if (kind === 'firefly') {
      p.y = 0.85 + Math.random() * 4.4;
      p.vx = (Math.random() - 0.5) * 0.55;
      p.vy = (Math.random() - 0.5) * 0.28;
      p.vz = (Math.random() - 0.5) * 0.55;
      p.scale = 0.65 + Math.random() * 0.42;
      p.colorHex = SUMMER_FIREFLY_COLORS[Math.floor(Math.random() * SUMMER_FIREFLY_COLORS.length)];
    } else if (kind === 'leaf') {
      p.y = randomHeight ? 0.9 + Math.random() * 13.0 : 11.2 + Math.random() * 4.0;
      p.vx = season.windX * (1.35 + Math.random() * 0.65);
      p.vy = -(0.85 + Math.random() * 0.55);
      p.vz = season.windZ * (1.35 + Math.random() * 0.65);
      p.scale = 0.92 + Math.random() * 0.55;
      p.colorHex = AUTUMN_LEAF_COLORS[Math.floor(Math.random() * AUTUMN_LEAF_COLORS.length)];
    } else {
      // Winter snowflake
      p.y = randomHeight ? 0.8 + Math.random() * 14.5 : 12.2 + Math.random() * 4.2;
      p.vx = season.windX * (1.25 + Math.random() * 0.55);
      p.vy = -(1.35 + Math.random() * 0.75);
      p.vz = season.windZ * (1.25 + Math.random() * 0.55);
      p.scale = 0.68 + Math.random() * 0.48;
      p.colorHex = WINTER_SNOW_COLORS[Math.floor(Math.random() * WINTER_SNOW_COLORS.length)];
    }
  };

  const update = (
    dt: number,
    elapsed: number,
    season: SeasonalVisualState,
    darkness: number,
    focusX: number,
    focusZ: number,
    frustumSize: number,
    particleScale: number,
    simSpeedFactor: number,
  ) => {
    // Keep gentle ambient drift even when sim is paused, faster when active
    const motionDt = Math.min(0.05, dt) * (simSpeedFactor <= 0 ? 0.32 : Math.min(2.2, 0.75 + simSpeedFactor * 0.45));
    const safeScale = Math.max(0, Math.min(1.2, particleScale));

    // Reduce particle density smoothly when zoomed very far out to keep map silhouette crisp
    const zoomFactor = frustumSize > 72 ? Math.max(0.25, 1 - (frustumSize - 72) / 90) : 1.0;
    const seasonDensityBias =
      season.dominantSeason === 'winter'
        ? 1.0
        : season.dominantSeason === 'autumn'
          ? 0.78
          : season.dominantSeason === 'spring'
            ? 0.68
            : darkness >= 0.44
              ? 0.62 // Summer fireflies at dusk/night
              : 0.42; // Subtle summer daytime pollen

    const targetCount = Math.min(
      MAX_SEASON_PARTICLES,
      Math.floor(MAX_SEASON_PARTICLES * safeScale * zoomFactor * seasonDensityBias),
    );

    if (targetCount <= 0) {
      mesh.count = 0;
      mesh.visible = false;
      return;
    }

    const span = THREE.MathUtils.clamp(frustumSize * 1.18, 16, 72);
    const halfSpan = span * 0.85;
    const zoomScaleBoost = THREE.MathUtils.clamp(frustumSize / 26, 0.82, 1.85);

    if (!initialized) {
      initialized = true;
      for (let i = 0; i < MAX_SEASON_PARTICLES; i++) {
        respawnParticle(pool[i], season, darkness, focusX, focusZ, span, true);
      }
    }

    let outCount = 0;
    for (let i = 0; i < targetCount; i++) {
      const p = pool[i];
      if (!p.active) {
        respawnParticle(p, season, darkness, focusX, focusZ, span, true);
      }

      // Gently nudge particle kind if season/darkness shifted completely
      const mismatchSummerDay = p.kind === 'firefly' && darkness < 0.34;
      const mismatchSummerNight = p.kind === 'pollen' && darkness > 0.56;
      const mismatchSeason =
        (p.kind === 'snow' && season.weights.winter < 0.08) ||
        (p.kind === 'leaf' && season.weights.autumn < 0.08) ||
        (p.kind === 'petal' && season.weights.spring < 0.08);

      if (mismatchSummerDay || mismatchSummerNight || mismatchSeason) {
        if (Math.random() < Math.min(1, dt * 1.4)) {
          respawnParticle(p, season, darkness, focusX, focusZ, span, false);
        }
      }

      // Integrate motion
      const sway = Math.sin(elapsed * 2.1 + p.phase);
      const swayZ = Math.cos(elapsed * 1.7 + p.phase * 1.3);
      if (p.kind === 'firefly') {
        p.x += (p.vx + sway * 0.48) * motionDt;
        p.y += (p.vy + Math.sin(elapsed * 2.8 + p.phase) * 0.36) * motionDt;
        p.z += (p.vz + swayZ * 0.48) * motionDt;
        if (p.y < 0.75) p.vy = Math.abs(p.vy) + 0.15;
        if (p.y > 5.4) p.vy = -Math.abs(p.vy) - 0.12;
      } else if (p.kind === 'pollen') {
        p.x += (p.vx + sway * 0.25) * motionDt;
        p.y += (p.vy + Math.sin(elapsed * 1.4 + p.phase) * 0.14) * motionDt;
        p.z += (p.vz + swayZ * 0.25) * motionDt;
        if (p.y < 0.7 || p.y > 9.5) {
          respawnParticle(p, season, darkness, focusX, focusZ, span, false);
        }
      } else {
        const flutter = p.kind === 'snow' ? 0.32 : p.kind === 'leaf' ? 0.92 : 0.65;
        p.x += (p.vx + sway * flutter) * motionDt;
        p.y += p.vy * motionDt;
        p.z += (p.vz + swayZ * flutter * 0.7) * motionDt;
      }

      const dx = p.x - focusX;
      const dz = p.z - focusZ;
      if (p.y < 0.45 || Math.abs(dx) > halfSpan || Math.abs(dz) > halfSpan) {
        respawnParticle(p, season, darkness, focusX, focusZ, span, false);
      }

      let finalScale = p.scale * zoomScaleBoost;
      let scaleYMult = 1.0;
      if (p.kind === 'firefly') {
        // Warm organic firefly blink pulse
        const blink = 0.22 + 0.78 * Math.pow(0.5 + 0.5 * Math.sin(elapsed * 3.4 + p.phase * 2.1), 2.2);
        finalScale *= blink;
        scaleYMult = 2.1; // compact glowing cube
      } else if (p.kind === 'snow') {
        scaleYMult = 2.0; // crisp pixel snow cube
      } else if (p.kind === 'pollen') {
        finalScale *= 0.65 + 0.35 * Math.sin(elapsed * 2.4 + p.phase);
        scaleYMult = 1.8;
      }

      dummy.position.set(p.x, p.y, p.z);
      if (p.kind === 'leaf' || p.kind === 'petal') {
        dummy.rotation.set(
          Math.sin(elapsed * p.spin + p.phase) * 1.1,
          elapsed * p.spin * 0.8 + p.phase,
          Math.cos(elapsed * p.spin * 0.9 + p.phase) * 0.9,
        );
      } else {
        dummy.rotation.set(0, elapsed * 0.5 + p.phase, 0);
      }
      dummy.scale.set(finalScale, finalScale * scaleYMult, finalScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(outCount, dummy.matrix);

      tmpColor.setHex(p.colorHex);
      if (p.kind === 'firefly') {
        // Slight HDR boost so fireflies twinkle cleanly against dusk/night terrain
        tmpColor.multiplyScalar(1.35);
      }
      mesh.setColorAt(outCount, tmpColor);
      outCount++;
    }

    mesh.count = outCount;
    mesh.visible = outCount > 0;
    if (outCount > 0) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  };

  const dispose = () => {
    group.remove(mesh);
    geo.dispose();
    mat.dispose();
  };

  return { group, update, dispose };
}
