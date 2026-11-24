import * as THREE from 'three';
import type { BuildingType, ChronicleEvent, SimulationState } from './types';

// ============================================================================
// Pure Tactile Game-Feel Math Helpers (Zero-GC, Deterministic, Unit-Testable)
// ============================================================================

export interface SquashScaleOut {
  xz: number;
  y: number;
}

/**
 * Elastic squash-and-stretch pop-in curve for newly placed/upgraded buildings & spawned units.
 * Overshoots Y to ~1.22 while compressing XZ to ~0.86, then settles cleanly to (1, 1).
 */
export function computeElasticPopScale(
  age: number,
  duration: number,
  out: SquashScaleOut,
): SquashScaleOut {
  if (duration <= 0 || age >= duration) {
    out.xz = 1;
    out.y = 1;
    return out;
  }
  const t = Math.max(0, Math.min(1, age / duration));
  // Rise smoothly from 0.28 -> overshoot ~1.22 -> damped settle to 1.0
  const env = Math.exp(-5.4 * t);
  const wave = Math.cos(t * Math.PI * 2.35);
  const ramp = Math.min(1, t / 0.16);
  const smoothRamp = ramp * ramp * (3 - 2 * ramp);
  const stretch = 1.0 + env * Math.sin(t * Math.PI * 2.1) * 0.34 - (1 - smoothRamp) * 0.62;
  const squash = 1.0 - env * wave * 0.18 * smoothRamp;

  out.y = Math.max(0.24, Math.min(1.32, stretch));
  // Preserve approximate volume so squash feels toy-like and physical
  out.xz = Math.max(0.68, Math.min(1.26, squash + (1 - out.y) * 0.22));
  return out;
}

/**
 * Quick damped shudder tilt (radians) when a building takes damage.
 */
export function computeBuildingHitWobble(hitAge: number, duration = 0.24): number {
  if (duration <= 0 || hitAge < 0 || hitAge >= duration) return 0;
  const t = hitAge / duration;
  const decay = (1 - t) * (1 - t);
  return Math.sin(t * Math.PI * 5.0) * 0.11 * decay;
}

export interface HitRecoilOut {
  /** 0..1 crisp white-gold flash intensity (peaks frame-0, fades over ~115ms) */
  flash: number;
  /** Vertical knockback hop offset in world units */
  hopY: number;
  /** Squash/stretch XZ multiplier */
  squashXZ: number;
  /** Squash/stretch Y multiplier */
  squashY: number;
}

/**
 * Crisp combat hit feedback: ~115ms white-gold flash + ~180ms knockback hop + landing squash.
 */
export function computeHitRecoil(
  hitAge: number,
  recoilDuration = 0.20,
  out: HitRecoilOut,
): HitRecoilOut {
  if (hitAge < 0 || hitAge >= recoilDuration) {
    out.flash = 0;
    out.hopY = 0;
    out.squashXZ = 1;
    out.squashY = 1;
    return out;
  }
  const flashDur = 0.115;
  out.flash = hitAge < flashDur ? Math.pow(1 - hitAge / flashDur, 1.35) : 0;

  const t = hitAge / recoilDuration;
  // Snappy knockback hop arc
  out.hopY = Math.sin(t * Math.PI) * 0.22;
  // Brief stretch at apex, squash on landing
  if (t < 0.45) {
    const a = Math.sin((t / 0.45) * Math.PI);
    out.squashY = 1 + a * 0.16;
    out.squashXZ = 1 - a * 0.11;
  } else {
    const b = Math.sin(((t - 0.45) / 0.55) * Math.PI);
    out.squashY = 1 - b * 0.14;
    out.squashXZ = 1 + b * 0.13;
  }
  return out;
}

// ============================================================================
// Living Settlement Chimney Smoke & Hearth Embers (1-Draw-Call Instanced Pool)
// ============================================================================

const SMOKE_EMITTING_BUILDINGS: ReadonlySet<BuildingType> = new Set<BuildingType>([
  'bonfire',
  'forager_hut',
  'smeltery',
  'guildhall',
  'steam_foundry',
  'dynamo_plant',
  'rail_station',
  'fission_reactor',
]);

interface ChimneySmokePuff {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  baseScale: number;
  colorHex: number;
  isEmber: boolean;
}

export interface ChimneySmokeSystem {
  group: THREE.Group;
  update: (
    dt: number,
    elapsed: number,
    state: SimulationState,
    windX: number,
    windZ: number,
    darkness: number,
    focusX: number,
    focusZ: number,
    frustumSize: number,
    particleScale: number,
    simSpeedFactor: number,
  ) => void;
  dispose: () => void;
}

const MAX_SMOKE_PUFFS = 128;

export function createChimneySmokeSystem(): ChimneySmokeSystem {
  const group = new THREE.Group();
  group.name = 'chimney_smoke_group';

  const geo = new THREE.BoxGeometry(0.19, 0.19, 0.19);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, MAX_SMOKE_PUFFS);
  mesh.count = 0;
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  group.add(mesh);

  const puffs: ChimneySmokePuff[] = [];
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  let emitAcc = 0;
  let bldCursor = 0;

  const update = (
    dt: number,
    elapsed: number,
    state: SimulationState,
    windX: number,
    windZ: number,
    darkness: number,
    focusX: number,
    focusZ: number,
    frustumSize: number,
    particleScale: number,
    simSpeedFactor: number,
  ) => {
    const safeScale = Math.max(0, Math.min(1.2, particleScale));
    if (safeScale <= 0.05 || frustumSize > 78) {
      if (puffs.length > 0) puffs.length = 0;
      mesh.count = 0;
      mesh.visible = false;
      return;
    }

    const paused = simSpeedFactor <= 0;
    const stepDt = paused ? 0 : Math.min(0.05, dt) * Math.min(2.0, 0.8 + simSpeedFactor * 0.35);

    // Emit new chimney/hearth smoke puffs lazily from visible completed buildings
    const blds = state.buildings;
    const maxBudget = Math.max(16, Math.floor(MAX_SMOKE_PUFFS * safeScale));
    if (!paused && blds.length > 0 && puffs.length < maxBudget) {
      const rate = Math.min(22, 6 + blds.length * 0.25) * safeScale;
      emitAcc += stepDt * rate;
      const halfSpan = Math.min(48, frustumSize * 0.85);
      const gs = state.gridSize;
      let attempts = 0;
      while (emitAcc >= 1 && puffs.length < maxBudget && attempts < 14) {
        emitAcc -= 1;
        attempts++;
        const b = blds[bldCursor % blds.length];
        bldCursor = (bldCursor + 1) % blds.length;
        if (!b || b.constructionProgress < 100 || b.hp <= 0) continue;
        if (!SMOKE_EMITTING_BUILDINGS.has(b.type)) continue;
        if (Math.abs(b.tileX - focusX) > halfSpan || Math.abs(b.tileZ - focusZ) > halfSpan) {
          continue;
        }
        const tile = state.tiles[b.tileZ * gs + b.tileX];
        if (!tile || tile.height <= 0) continue;

        const groundY = Math.max(0.18, tile.height * 0.45 + 0.25);
        const roofOffset =
          b.type === 'fission_reactor'
            ? 1.9
            : b.type === 'steam_foundry' || b.type === 'dynamo_plant'
              ? 1.62
              : b.type === 'guildhall' || b.type === 'rail_station'
                ? 1.4
                : b.type === 'smeltery'
                  ? 1.24
                  : b.type === 'bonfire'
                    ? 0.65
                    : 1.02;

        const isBonfire = b.type === 'bonfire';
        const isIndustrial =
          b.type === 'steam_foundry' ||
          b.type === 'dynamo_plant' ||
          b.type === 'smeltery' ||
          b.type === 'rail_station';
        const isSteamTower = b.type === 'fission_reactor';
        const emberChance = isBonfire
          ? 0.45 + darkness * 0.3
          : b.type === 'smeltery'
            ? 0.24 + darkness * 0.22
            : darkness > 0.42
              ? 0.22
              : 0;
        const spawnEmber = !isSteamTower && Math.random() < emberChance;

        const smokeHex = spawnEmber
          ? Math.random() < 0.5
            ? 0xfb923c
            : 0xfde047
          : isSteamTower
            ? 0xf1f5f9
            : isIndustrial
              ? 0x9ca3af
              : 0xd6d3d1;

        puffs.push({
          x: b.tileX + (Math.random() - 0.5) * 0.26,
          y: groundY + roofOffset,
          z: b.tileZ + (Math.random() - 0.5) * 0.26,
          vx: windX * (0.42 + Math.random() * 0.25) + (Math.random() - 0.5) * 0.12,
          vy: spawnEmber
            ? 0.88 + Math.random() * 0.45
            : isSteamTower
              ? 0.7 + Math.random() * 0.28
              : 0.52 + Math.random() * 0.26,
          vz: windZ * (0.42 + Math.random() * 0.25) + (Math.random() - 0.5) * 0.12,
          age: 0,
          life: spawnEmber ? 1.4 + Math.random() * 0.9 : 2.5 + Math.random() * 1.4,
          baseScale: spawnEmber
            ? 0.36 + Math.random() * 0.18
            : isSteamTower
              ? 0.96 + Math.random() * 0.36
              : isIndustrial
                ? 0.82 + Math.random() * 0.35
                : 0.58 + Math.random() * 0.28,
          colorHex: smokeHex,
          isEmber: spawnEmber,
        });
      }
      if (emitAcc > 4) emitAcc = 0;
    }

    // Advance & write instance matrices
    let outCount = 0;
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.age += stepDt;
      if (p.age >= p.life) {
        puffs[i] = puffs[puffs.length - 1];
        puffs.pop();
        continue;
      }
      const t = p.age / p.life;
      p.x += (p.vx + Math.sin(elapsed * 2.2 + i) * 0.08) * stepDt;
      p.y += p.vy * (1 - t * 0.35) * stepDt;
      p.z += (p.vz + Math.cos(elapsed * 1.9 + i) * 0.08) * stepDt;

      // Smooth fade-in, expand, then shrink away cleanly at end of life
      const fadeIn = Math.min(1, t * 5.5);
      const fadeOut = Math.max(0, 1 - Math.max(0, (t - 0.55) / 0.45));
      const grow = p.isEmber ? 1 - t * 0.65 : 0.65 + t * 1.15;
      const sc = p.baseScale * grow * fadeIn * (0.25 + fadeOut * 0.75);

      if (sc <= 0.02) continue;

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(t * 0.8, elapsed * 0.4 + i, t * 0.6);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      mesh.setMatrixAt(outCount, dummy.matrix);

      tmpColor.setHex(p.colorHex);
      if (p.isEmber) {
        tmpColor.multiplyScalar(1.45);
      } else {
        // Gently darken smoke at night so it blends naturally with moonlight
        const nightShade = 1 - darkness * 0.48;
        tmpColor.multiplyScalar(nightShade);
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

// ============================================================================
// Crisp 1-Draw-Call Combat Hit-Flash Star Overlay (Readable at Every Zoom)
// ============================================================================

interface HitFlashStar {
  x: number;
  y: number;
  z: number;
  age: number;
  life: number;
  scale: number;
  colorHex: number;
  rot: number;
}

export interface HitFlashOverlaySystem {
  group: THREE.Group;
  spawnFlash: (x: number, y: number, z: number, colorHex?: number, scale?: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

const MAX_HIT_FLASHES = 48;

export function createHitFlashOverlaySystem(): HitFlashOverlaySystem {
  const group = new THREE.Group();
  group.name = 'hit_flash_overlay_group';

  const geo = new THREE.OctahedronGeometry(0.28, 0);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, MAX_HIT_FLASHES);
  mesh.count = 0;
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 14;
  group.add(mesh);

  const active: HitFlashStar[] = [];
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  const spawnFlash = (x: number, y: number, z: number, colorHex = 0xfff7cc, scale = 1.0) => {
    if (active.length >= MAX_HIT_FLASHES) {
      active.shift();
    }
    active.push({
      x,
      y,
      z,
      age: 0,
      life: 0.14,
      scale,
      colorHex,
      rot: Math.random() * Math.PI,
    });
  };

  const update = (dt: number) => {
    if (active.length === 0) {
      if (mesh.visible) {
        mesh.count = 0;
        mesh.visible = false;
      }
      return;
    }

    const stepDt = Math.min(0.05, dt);
    let outCount = 0;
    for (let i = active.length - 1; i >= 0; i--) {
      const f = active[i];
      f.age += stepDt;
      if (f.age >= f.life) {
        active[i] = active[active.length - 1];
        active.pop();
        continue;
      }
      const t = f.age / f.life;
      // Snappy expand on impact, quick crisp pinch-out
      const pulse = t < 0.35 ? 0.55 + (t / 0.35) * 0.85 : 1.4 * (1 - (t - 0.35) / 0.65);
      const sc = Math.max(0.04, f.scale * pulse);
      dummy.position.set(f.x, f.y, f.z);
      dummy.rotation.set(f.rot, f.rot + t * 4.5, f.rot * 0.5);
      dummy.scale.set(sc * 1.15, sc * 0.72, sc * 1.15);
      dummy.updateMatrix();
      mesh.setMatrixAt(outCount, dummy.matrix);

      tmpColor.setHex(f.colorHex);
      tmpColor.multiplyScalar(1.3);
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

  return { group, spawnFlash, update, dispose };
}

// ============================================================================
// In-World Milestone Effects + Rising 24x24 Pixel-Art Icon Bursts
// ============================================================================

export type MilestoneBurstKind =
  | 'epoch_up'
  | 'war'
  | 'peace'
  | 'city_founded'
  | 'city_captured'
  | 'wonder';

/**
 * Pure deterministic classifier mapping newly logged chronicle entries to
 * zero-clutter in-world pixel icon bursts (never reads stale history on load).
 */
export function classifyChronicleMilestone(
  event: Pick<ChronicleEvent, 'text' | 'tone'>,
): MilestoneBurstKind | null {
  const lower = (event.text || '').toLowerCase();
  if (!lower) return null;

  if (
    event.tone === 'epoch' ||
    lower.includes('entered the ') ||
    lower.includes('ascended') ||
    lower.includes('reached the ') ||
    lower.includes('new age') ||
    lower.includes('epoch')
  ) {
    return 'epoch_up';
  }
  if (
    lower.includes('wonder') ||
    lower.includes('monument') ||
    lower.includes('golden age') ||
    lower.includes('victory')
  ) {
    return 'wonder';
  }
  if (
    lower.includes('captured') ||
    lower.includes('conquered') ||
    lower.includes('seized') ||
    lower.includes('annexed') ||
    lower.includes('fell to')
  ) {
    return 'city_captured';
  }
  if (
    lower.includes('declared war') ||
    lower.includes('rebellion') ||
    lower.includes('uprising') ||
    lower.includes('war broke out') ||
    lower.includes('went to war')
  ) {
    return 'war';
  }
  if (
    lower.includes('peace treaty') ||
    lower.includes('signed peace') ||
    lower.includes('truce') ||
    lower.includes('alliance') ||
    lower.includes('trade pact')
  ) {
    return 'peace';
  }
  if (
    lower.includes('founded') ||
    lower.includes('new settlement') ||
    lower.includes('established')
  ) {
    return 'city_founded';
  }
  return null;
}

const MILESTONE_RING_COLORS: Record<MilestoneBurstKind, number> = {
  epoch_up: 0xfacc15,
  war: 0xef4444,
  peace: 0x34d399,
  city_founded: 0xfbbf24,
  city_captured: 0xf97316,
  wonder: 0x38bdf8,
};

function createMilestoneIconTexture(kind: MilestoneBurstKind): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 24;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 24, 24);

    // Subtle crisp pixel badge frame (dark wooden-ink outline + warm ivory core, no text)
    ctx.fillStyle = '#1b1410';
    ctx.fillRect(4, 2, 16, 20);
    ctx.fillRect(2, 4, 20, 16);
    ctx.fillRect(3, 3, 18, 18);

    const rimColor =
      kind === 'epoch_up' || kind === 'wonder'
        ? '#f59e0b'
        : kind === 'war'
          ? '#dc2626'
          : kind === 'peace'
            ? '#10b981'
            : kind === 'city_captured'
              ? '#ea580c'
              : '#d97706';

    ctx.fillStyle = rimColor;
    ctx.fillRect(4, 3, 16, 18);
    ctx.fillRect(3, 4, 18, 16);

    ctx.fillStyle = '#fbf3e2';
    ctx.fillRect(5, 4, 14, 16);
    ctx.fillRect(4, 5, 16, 14);

    ctx.fillStyle = '#e7d8bc';
    ctx.fillRect(5, 18, 14, 2);

    switch (kind) {
      case 'epoch_up': {
        // Golden pixel crown + shining star pip
        ctx.fillStyle = '#92400e';
        ctx.fillRect(6, 15, 12, 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(6, 10, 12, 5);
        ctx.fillRect(6, 8, 2, 3);
        ctx.fillRect(11, 7, 2, 4);
        ctx.fillRect(16, 8, 2, 3);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(7, 11, 10, 2);
        ctx.fillRect(11, 6, 2, 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(11, 12, 2, 2);
        break;
      }
      case 'war': {
        // Crossed crimson & steel pixel swords
        ctx.fillStyle = '#991b1b';
        for (let i = 0; i < 10; i++) {
          ctx.fillRect(7 + i, 6 + i, 2, 2);
          ctx.fillRect(15 - i, 6 + i, 2, 2);
        }
        ctx.fillStyle = '#e2e8f0';
        for (let i = 0; i < 8; i++) {
          ctx.fillRect(7 + i, 6 + i, 1, 2);
          ctx.fillRect(16 - i, 6 + i, 1, 2);
        }
        ctx.fillStyle = '#facc15';
        ctx.fillRect(6, 14, 4, 2);
        ctx.fillRect(14, 14, 4, 2);
        break;
      }
      case 'peace': {
        // Crisp emerald olive branch & golden heart/gem
        ctx.fillStyle = '#15803d';
        ctx.fillRect(11, 7, 2, 10);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(7, 8, 4, 3);
        ctx.fillRect(13, 8, 4, 3);
        ctx.fillRect(8, 12, 3, 3);
        ctx.fillRect(13, 12, 3, 3);
        ctx.fillStyle = '#bbf7d0';
        ctx.fillRect(8, 9, 2, 1);
        ctx.fillRect(14, 9, 2, 1);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(11, 5, 2, 2);
        break;
      }
      case 'city_founded': {
        // Golden pixel flag & settlement roof
        ctx.fillStyle = '#78350f';
        ctx.fillRect(8, 6, 2, 11);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(10, 6, 7, 5);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(10, 7, 5, 2);
        ctx.fillStyle = '#b45309';
        ctx.fillRect(6, 15, 12, 2);
        break;
      }
      case 'city_captured': {
        // Conquest pennant shield
        ctx.fillStyle = '#9a3412';
        ctx.fillRect(7, 6, 10, 8);
        ctx.fillRect(8, 14, 8, 2);
        ctx.fillRect(10, 16, 4, 2);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(8, 7, 8, 6);
        ctx.fillRect(9, 13, 6, 2);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(11, 8, 2, 5);
        ctx.fillRect(9, 10, 6, 2);
        break;
      }
      case 'wonder': {
        // Radiant 8-point pixel starburst trophy
        ctx.fillStyle = '#d97706';
        ctx.fillRect(11, 5, 2, 14);
        ctx.fillRect(5, 11, 14, 2);
        ctx.fillRect(7, 7, 10, 10);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(11, 6, 2, 12);
        ctx.fillRect(6, 11, 12, 2);
        ctx.fillRect(9, 9, 6, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(11, 11, 2, 2);
        break;
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

interface ActiveMilestoneBurst {
  kind: MilestoneBurstKind;
  x: number;
  baseY: number;
  z: number;
  age: number;
  life: number;
  sprite: THREE.Sprite;
  spriteMat: THREE.SpriteMaterial;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  active: boolean;
}

export interface WorldMilestoneSystem {
  group: THREE.Group;
  spawnMilestone: (kind: MilestoneBurstKind, x: number, y: number, z: number) => void;
  update: (dt: number, frustumSize: number) => void;
  dispose: () => void;
}

const MAX_MILESTONE_BURSTS = 12;

export function createWorldMilestoneSystem(): WorldMilestoneSystem {
  const group = new THREE.Group();
  group.name = 'world_milestone_bursts_group';

  const allKinds: MilestoneBurstKind[] = [
    'epoch_up',
    'war',
    'peace',
    'city_founded',
    'city_captured',
    'wonder',
  ];
  const textures = {} as Record<MilestoneBurstKind, THREE.CanvasTexture>;
  for (const k of allKinds) {
    textures[k] = createMilestoneIconTexture(k);
  }

  const ringGeo = new THREE.RingGeometry(0.55, 0.85, 20);
  ringGeo.rotateX(-Math.PI / 2);

  const slots: ActiveMilestoneBurst[] = [];
  for (let i = 0; i < MAX_MILESTONE_BURSTS; i++) {
    const spriteMat = new THREE.SpriteMaterial({
      map: textures.epoch_up,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.visible = false;
    sprite.renderOrder = 22;
    group.add(sprite);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.visible = false;
    ring.renderOrder = 10;
    group.add(ring);

    slots.push({
      kind: 'epoch_up',
      x: 0,
      baseY: 0,
      z: 0,
      age: 0,
      life: 2.4,
      sprite,
      spriteMat,
      ring,
      ringMat,
      active: false,
    });
  }

  let nextSlotCursor = 0;

  const spawnMilestone = (kind: MilestoneBurstKind, x: number, y: number, z: number) => {
    // Deduplicate nearby identical milestone bursts spawned in the same instant
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (
        s.active &&
        s.kind === kind &&
        s.age < 0.8 &&
        Math.abs(s.x - x) < 3.5 &&
        Math.abs(s.z - z) < 3.5
      ) {
        return;
      }
    }

    let chosen: ActiveMilestoneBurst | null = null;
    for (let i = 0; i < slots.length; i++) {
      if (!slots[i].active) {
        chosen = slots[i];
        break;
      }
    }
    if (!chosen) {
      chosen = slots[nextSlotCursor % slots.length];
      nextSlotCursor++;
    }

    chosen.active = true;
    chosen.kind = kind;
    chosen.x = x;
    chosen.baseY = y;
    chosen.z = z;
    chosen.age = 0;
    chosen.life = kind === 'epoch_up' || kind === 'wonder' ? 2.7 : 2.25;

    chosen.spriteMat.map = textures[kind];
    chosen.spriteMat.opacity = 1;
    chosen.sprite.position.set(x, y + 1.35, z);
    chosen.sprite.visible = true;

    chosen.ringMat.color.setHex(MILESTONE_RING_COLORS[kind]);
    chosen.ringMat.opacity = 0.85;
    chosen.ring.position.set(x, y + 0.16, z);
    chosen.ring.scale.setScalar(0.5);
    chosen.ring.visible = true;
  };

  const update = (dt: number, frustumSize: number) => {
    const stepDt = Math.min(0.05, dt);
    const zoomScale = THREE.MathUtils.clamp(frustumSize / 20, 0.95, 2.5);

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s.active) continue;

      s.age += stepDt;
      if (s.age >= s.life) {
        s.active = false;
        s.sprite.visible = false;
        s.ring.visible = false;
        continue;
      }

      const t = s.age / s.life;
      // Elastic pop-in scale in the first 18%, steady float, clean fade-out in final 28%
      const pop =
        t < 0.18
          ? 0.35 + Math.sin((t / 0.18) * Math.PI * 0.72) * 0.95
          : 1.0 + Math.sin(s.age * 4.5) * 0.04;
      const fadeOut = t > 0.72 ? Math.max(0, 1 - (t - 0.72) / 0.28) : 1.0;

      const riseY = 1.45 + Math.pow(t, 0.65) * 2.35;
      s.sprite.position.set(s.x, s.baseY + riseY, s.z);
      const iconSize = 1.12 * zoomScale * pop;
      s.sprite.scale.set(iconSize, iconSize, 1);
      s.spriteMat.opacity = fadeOut;

      // Ground shockwave ring expands over first 50% of burst then vanishes cleanly
      if (t < 0.52) {
        const rt = t / 0.52;
        const rScale = 0.5 + (1 - Math.pow(1 - rt, 2.2)) * 3.1;
        s.ring.scale.setScalar(rScale);
        s.ringMat.opacity = (1 - rt) * 0.75;
        s.ring.visible = true;
      } else {
        s.ring.visible = false;
      }
    }
  };

  const dispose = () => {
    for (const s of slots) {
      group.remove(s.sprite);
      group.remove(s.ring);
      s.spriteMat.dispose();
      s.ringMat.dispose();
    }
    ringGeo.dispose();
    for (const k of allKinds) {
      textures[k].dispose();
    }
  };

  return { group, spawnMilestone, update, dispose };
}
