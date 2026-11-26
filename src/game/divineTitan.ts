import {
  DivineTitanState,
  SimulationState,
  TileData,
  TitanMissile,
  TitanMushroomCloud,
  TitanOrbitalStrike,
  TitanShockwaveEffect,
  TitanSlashEffect,
} from './types';
import { syncTileToWorldGrid, WorldGridBuffers } from './worldGrid';

export const TITAN_HEIGHT_STEP = 0.45;
export const TITAN_WALK_SPEED = 3.5;
export const TITAN_SLASH_COOLDOWN = 0.38;
export const TITAN_SKILL1_COOLDOWN = 5.0;
export const TITAN_SKILL2_COOLDOWN = 5.5;
export const TITAN_SKILL3_COOLDOWN = 16.0;
export const TITAN_SKILL4_COOLDOWN = 8.5;
export const TITAN_DEATH_BEAM_COMBINE = 1.45;
export const TITAN_DEATH_BEAM_FIRE = 4.0;
export const TITAN_DEATH_BEAM_DETONATE = 2.0;
export const TITAN_LEAP_MAX_RANGE = 24.0;
export const TITAN_SUMMON_DURATION = 0.78;
export const TITAN_EXIT_DURATION = 1.15;

export interface TitanControlInput {
  moveForward: number; // -1..1 (W/S)
  moveRight: number;   // -1..1 (D/A)
  camYaw: number;
  aimX: number | null;
  aimZ: number | null;
}

let titanEffectSeq = 1;
function nextTitanFxId(prefix: string): string {
  titanEffectSeq += 1;
  return `${prefix}_${titanEffectSeq}`;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function wrapAngleDiff(target: number, current: number): number {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function getTileAt(state: SimulationState, tx: number, tz: number): TileData | undefined {
  const gx = Math.round(tx);
  const gz = Math.round(tz);
  if (gx < 0 || gz < 0 || gx >= state.gridSize || gz >= state.gridSize) return undefined;
  return state.tiles[gz * state.gridSize + gx];
}

export function getTitanGroundY(state: SimulationState, x: number, z: number): number {
  const t = getTileAt(state, x, z);
  if (!t) return 0.25;
  if (t.height === 0) {
    if (t.terrain === 'stone_road' || t.terrain === 'rail_track' || t.terrain === 'runway') return 0.3;
    if (t.terrain === 'ice') return 0.21;
    return 0.12;
  }
  return t.height * TITAN_HEIGHT_STEP + 0.25;
}

function isWaterTile(t: TileData | undefined): boolean {
  if (!t) return true;
  return t.height === 0 || t.terrain === 'deep_water' || t.terrain === 'shallow_water';
}

function pushChronicle(state: SimulationState, text: string, tone: 'divine' | 'warning' = 'divine'): void {
  if (!state.chronicle) state.chronicle = [];
  const yr = Math.max(1, Math.floor(state.year || 1));
  state.chronicle.unshift({
    id: nextTitanFxId('chr'),
    yearLabel: `Year ${yr}`,
    text,
    tone,
    timestamp: Date.now(),
  });
  if (state.chronicle.length > 48) {
    state.chronicle.length = 48;
  }
}

function damageWorldWonders(state: SimulationState, cx: number, cz: number, radius: number, dmg: number): void {
  if (!state.worldWonders || state.worldWonders.length === 0) return;
  const rSq = radius * radius;
  for (let i = state.worldWonders.length - 1; i >= 0; i--) {
    const w = state.worldWonders[i];
    const dx = w.tileX - cx;
    const dz = w.tileZ - cz;
    if (dx * dx + dz * dz <= rSq) {
      if ((w.shieldTimer ?? 0) > 0) {
        w.shieldTimer = 0;
        w.hp = Math.max(1, (w.hp ?? 2200) - dmg * 0.35);
      } else {
        w.hp = Math.max(0, (w.hp ?? 2200) - dmg);
        if (w.hp <= 0) {
          state.worldWonders.splice(i, 1);
        }
      }
    }
  }
}

function igniteAndDevastateTile(
  state: SimulationState,
  t: TileData,
  opts: {
    terrain?: TileData['terrain'];
    fireDuration?: number;
    fireColor?: string;
    devastateDuration?: number;
    cursedDuration?: number;
    lowerHeightBy?: number;
    clearAllResources?: boolean;
  },
): void {
  if (t.height === 0) return;
  const allowFire = state.worldRules?.wildfireSpread !== false;
  const grid = state.worldGrid as WorldGridBuffers | undefined;

  t.blessedTimer = 0;
  if (t.farmSettlementId) {
    t.farmSettlementId = undefined;
  }

  if (t.resourceNode === 'timber_grove') {
    t.resourceNode = 'none';
    t.resourceAmount = 0;
    t.burntTree = true;
  } else if (t.resourceNode === 'berry_bush' || (opts.clearAllResources && t.resourceNode !== 'none')) {
    t.resourceNode = 'none';
    t.resourceAmount = 0;
  }

  if (opts.lowerHeightBy && opts.lowerHeightBy > 0 && !t.buildingId) {
    t.height = Math.max(1, t.height - opts.lowerHeightBy);
  }
  if (opts.terrain && !t.buildingId) {
    t.terrain = opts.terrain;
  }
  if (allowFire && opts.fireDuration && opts.fireDuration > 0) {
    t.onFireTimer = Math.max(t.onFireTimer, opts.fireDuration);
    if (opts.fireColor) {
      t.fireColor = opts.fireColor;
    }
  }
  if (opts.devastateDuration && opts.devastateDuration > 0) {
    t.devastatedTimer = Math.max(t.devastatedTimer ?? 0, opts.devastateDuration);
  }
  if (opts.cursedDuration && opts.cursedDuration > 0) {
    t.cursedTimer = Math.max(t.cursedTimer, opts.cursedDuration);
  }
  if (grid) {
    syncTileToWorldGrid(grid, t);
  }
}

function irradiateUnitsInRadius(
  state: SimulationState,
  cx: number,
  cz: number,
  radius: number,
  duration: number,
): void {
  const rSq = radius * radius;
  for (let i = 0; i < state.units.length; i++) {
    const u = state.units[i];
    if (u.state === 'ko' || u.statusEffects.shielded) continue;
    const dx = u.x - cx;
    const dz = u.z - cz;
    if (dx * dx + dz * dz <= rSq) {
      u.statusEffects.cursed = Math.max(u.statusEffects.cursed ?? 0, duration);
      u.statusEffects.plagued = Math.max(u.statusEffects.plagued ?? 0, duration);
    }
  }
}

function damageUnitsAndStructuresInRadius(
  state: SimulationState,
  cx: number,
  cz: number,
  radius: number,
  unitDamage: number,
  buildingDamage: number,
  knockbackStrength: number,
): void {
  const rSq = radius * radius;
  const immortal = Boolean(state.worldRules?.immortalEntities);

  for (let i = 0; i < state.units.length; i++) {
    const u = state.units[i];
    if (u.state === 'ko') continue;
    const dx = u.x - cx;
    const dz = u.z - cz;
    const dSq = dx * dx + dz * dz;
    if (dSq > rSq) continue;
    const dist = Math.sqrt(dSq) || 0.001;
    const falloff = 1 - Math.min(0.65, (dist / radius) * 0.65);

    if (knockbackStrength > 0) {
      const push = knockbackStrength * falloff;
      u.x = clamp(u.x + (dx / dist) * push, 1, state.gridSize - 2);
      u.z = clamp(u.z + (dz / dist) * push, 1, state.gridSize - 2);
    }

    if (!immortal && !u.statusEffects.shielded) {
      u.hp -= unitDamage * falloff;
      if (u.hp <= 0) {
        u.hp = 0;
        u.state = 'ko';
        u.koTimer = 0.5;
        if (u.faction === 'hostile') {
          state.totalRaidersDefeated += 1;
        }
      }
    }
  }

  for (let i = 0; i < state.buildings.length; i++) {
    const b = state.buildings[i];
    const dx = b.tileX - cx;
    const dz = b.tileZ - cz;
    const dSq = dx * dx + dz * dz;
    if (dSq > rSq) continue;
    const dist = Math.sqrt(dSq);
    const falloff = 1 - Math.min(0.55, (dist / radius) * 0.55);
    if (b.shieldTimer > 0) {
      b.shieldTimer = 0;
      b.hp = Math.max(0, b.hp - buildingDamage * 0.35 * falloff);
    } else {
      b.hp = Math.max(0, b.hp - buildingDamage * falloff);
    }
  }

  for (const v of state.vehicles ?? []) {
    const dx = v.x - cx;
    const dz = v.z - cz;
    const dSq = dx * dx + dz * dz;
    if (dSq <= rSq) {
      v.hp = Math.max(0, (v.hp ?? 140) - buildingDamage * 0.85);
    }
  }

  damageWorldWonders(state, cx, cz, radius, buildingDamage * 0.9);
}

export function summonDivineTitan(
  state: SimulationState,
  targetX: number,
  targetZ: number,
): { ok: boolean; reason?: string } {
  if (state.divineTitan && state.divineTitan.phase !== 'exiting') {
    return { ok: false, reason: 'God Titan is already active' };
  }

  const gx = clamp(targetX, 2, state.gridSize - 3);
  const gz = clamp(targetZ, 2, state.gridSize - 3);
  const gy = getTitanGroundY(state, gx, gz);

  const summonShockwave: TitanShockwaveEffect = {
    id: nextTitanFxId('tsw'),
    x: gx,
    y: gy,
    z: gz,
    maxRadius: 9.5,
    elapsed: 0,
    duration: 0.9,
    kind: 'summon',
    color: '#fbbf24',
  };

  state.divineTitan = {
    id: nextTitanFxId('titan'),
    phase: 'summoning',
    x: gx,
    y: gy,
    z: gz,
    bodyYaw: 0,
    turretYaw: 0,
    turretPitch: 0,
    aimX: gx + 6,
    aimZ: gz,
    moveSpeed: 0,
    walkCycle: 0,
    lastStepIndex: 0,
    recoilLeft: 0,
    recoilRight: 0,
    nextSlashHand: 0,
    slashCooldown: 0,
    skill1Cooldown: 0,
    skill2Cooldown: 0,
    skill3Cooldown: 0,
    skill4Cooldown: 0,
    skill1Targeting: false,
    phaseTimer: 0,
    jumpStartX: gx,
    jumpStartY: gy,
    jumpStartZ: gz,
    jumpTargetX: gx,
    jumpTargetZ: gz,
    jumpElapsed: 0,
    jumpDuration: 1.05,
    jumpWindup: 0.24,
    jumpPeakHeight: 17.5,
    deathBeam: null,
    mushroomClouds: [],
    missiles: [],
    missileSalvoRemaining: 0,
    missileSalvoTimer: 0,
    missileTargetX: gx,
    missileTargetZ: gz,
    slashes: [],
    orbitalStrikes: [],
    shockwaves: [summonShockwave],
    pendingTrauma: 0.65,
  };

  damageUnitsAndStructuresInRadius(state, gx, gz, 5.5, 220, 180, 2.2);
  pushChronicle(state, 'A colossal God Titan descended from the heavens!', 'divine');
  return { ok: true };
}

export function beginExitDivineTitan(state: SimulationState): boolean {
  const titan = state.divineTitan;
  if (!titan || titan.phase === 'exiting') return false;
  titan.phase = 'exiting';
  titan.phaseTimer = 0;
  titan.skill1Targeting = false;
  titan.moveSpeed = 0;
  titan.y = getTitanGroundY(state, titan.x, titan.z);
  titan.shockwaves.push({
    id: nextTitanFxId('tsw'),
    x: titan.x,
    y: titan.y,
    z: titan.z,
    maxRadius: 10.5,
    elapsed: 0,
    duration: 1.05,
    kind: 'exit',
    color: '#38bdf8',
  });
  titan.pendingTrauma = Math.max(titan.pendingTrauma, 0.55);
  pushChronicle(state, 'A skyward beam reclaimed the God Titan back into the heavens.', 'divine');
  return true;
}

export function executeTitanWalkShockwave(state: SimulationState, x: number, z: number): void {
  const titan = state.divineTitan;
  if (!titan) return;
  const y = getTitanGroundY(state, x, z);

  titan.shockwaves.push({
    id: nextTitanFxId('tsw'),
    x,
    y,
    z,
    maxRadius: 6.8,
    elapsed: 0,
    duration: 0.68,
    kind: 'step',
    color: '#ef4444',
  });
  titan.pendingTrauma = Math.max(titan.pendingTrauma, 0.34);

  // Heavy conqueror stomp shockwave knocks back & crushes units/structures underfoot
  damageUnitsAndStructuresInRadius(state, x, z, 5.4, 95, 65, 1.85);

  const minX = Math.max(0, Math.floor(x - 3));
  const maxX = Math.min(state.gridSize - 1, Math.ceil(x + 3));
  const minZ = Math.max(0, Math.floor(z - 3));
  const maxZ = Math.min(state.gridSize - 1, Math.ceil(z + 3));
  for (let tz = minZ; tz <= maxZ; tz++) {
    for (let tx = minX; tx <= maxX; tx++) {
      const dx = tx - x;
      const dz = tz - z;
      if (dx * dx + dz * dz <= 7.5) {
        const t = state.tiles[tz * state.gridSize + tx];
        if (t && t.height > 0) {
          t.crushedTimer = Math.max(t.crushedTimer ?? 0, 10);
        }
      }
    }
  }
}

export function triggerTitanSlash(state: SimulationState, aimX?: number, aimZ?: number): boolean {
  const titan = state.divineTitan;
  if (!titan || titan.phase !== 'active' || titan.slashCooldown > 0) return false;

  if (aimX !== undefined && aimZ !== undefined) {
    titan.aimX = clamp(aimX, 0, state.gridSize - 1);
    titan.aimZ = clamp(aimZ, 0, state.gridSize - 1);
  }

  let dx = titan.aimX - titan.x;
  let dz = titan.aimZ - titan.z;
  let distToAim = Math.hypot(dx, dz);
  const maxLaserRange = 32.0;

  let yaw = titan.turretYaw;
  if (distToAim > 0.25) {
    yaw = Math.atan2(dx, dz);
    titan.turretYaw = yaw;
  } else {
    dx = Math.sin(yaw) * 14;
    dz = Math.cos(yaw) * 14;
    distToAim = 14;
  }

  const clampedDist = Math.min(maxLaserRange, Math.max(4.0, distToAim));
  const fwdX = Math.sin(yaw);
  const fwdZ = Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);

  const targetX = clamp(titan.x + fwdX * clampedDist, 1, state.gridSize - 2);
  const targetZ = clamp(titan.z + fwdZ * clampedDist, 1, state.gridSize - 2);
  const targetY = getTitanGroundY(state, targetX, targetZ) + 0.25;

  const cannonSide: -1 | 1 = titan.nextSlashHand === 0 ? -1 : 1;
  if (titan.nextSlashHand === 0) {
    titan.recoilLeft = 1.0;
    titan.nextSlashHand = 1;
  } else {
    titan.recoilRight = 1.0;
    titan.nextSlashHand = 0;
  }
  titan.slashCooldown = TITAN_SLASH_COOLDOWN;
  titan.pendingTrauma = Math.max(titan.pendingTrauma, 0.32);

  // Exact world-space muzzle tip of the firing top rail-cannon (scaled by 1.26x)
  const muzzleForward = 6.8;
  const muzzleSide = cannonSide * 1.04;
  const muzzleX = titan.x + fwdX * muzzleForward + rightX * muzzleSide;
  const muzzleY = titan.y + 5.72;
  const muzzleZ = titan.z + fwdZ * muzzleForward + rightZ * muzzleSide;

  const laserBeam: TitanSlashEffect = {
    id: nextTitanFxId('tls'),
    x: muzzleX,
    y: muzzleY,
    z: muzzleZ,
    targetX,
    targetY,
    targetZ,
    cannonSide,
    yaw,
    tilt: 0,
    range: clampedDist,
    elapsed: 0,
    duration: 0.28,
  };
  titan.slashes.push(laserBeam);

  // Impact blast shockwave at laser hit point
  titan.shockwaves.push({
    id: nextTitanFxId('tsw'),
    x: targetX,
    y: targetY - 0.1,
    z: targetZ,
    maxRadius: 4.4,
    elapsed: 0,
    duration: 0.42,
    kind: 'step',
    color: '#ff3b1f',
  });

  // 1. Explosive impact damage at the laser strike point
  damageUnitsAndStructuresInRadius(state, targetX, targetZ, 3.8, 360, 290, 2.2);

  // 2. Piercing beam-line damage along the laser trajectory from Titan to target
  const beamWidth = 2.0;
  const beamWidthSq = beamWidth * beamWidth;
  const immortal = Boolean(state.worldRules?.immortalEntities);
  const segX = targetX - titan.x;
  const segZ = targetZ - titan.z;
  const segLenSq = Math.max(0.01, segX * segX + segZ * segZ);

  const distSqToBeam = (px: number, pz: number): number => {
    const tProj = clamp(((px - titan.x) * segX + (pz - titan.z) * segZ) / segLenSq, 0, 1);
    const cx = titan.x + segX * tProj;
    const cz = titan.z + segZ * tProj;
    const ex = px - cx;
    const ez = pz - cz;
    return ex * ex + ez * ez;
  };

  for (let i = 0; i < state.units.length; i++) {
    const u = state.units[i];
    if (u.state === 'ko') continue;
    if (distSqToBeam(u.x, u.z) <= beamWidthSq) {
      if (!immortal && !u.statusEffects.shielded) {
        u.hp -= 280;
        if (u.hp <= 0) {
          u.hp = 0;
          u.state = 'ko';
          u.koTimer = 0.5;
          if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
        }
      }
    }
  }

  for (let i = 0; i < state.buildings.length; i++) {
    const b = state.buildings[i];
    if (distSqToBeam(b.tileX, b.tileZ) <= beamWidthSq) {
      if (b.shieldTimer > 0) {
        b.shieldTimer = 0;
        b.hp = Math.max(0, b.hp - 100);
      } else {
        b.hp = Math.max(0, b.hp - 220);
      }
    }
  }

  for (const v of state.vehicles ?? []) {
    if (distSqToBeam(v.x, v.z) <= beamWidthSq) {
      v.hp = Math.max(0, (v.hp ?? 140) - 280);
    }
  }

  // Scorch & ignite wildfires along the laser beam path + blast a fiery mini-crater at impact
  const pathSteps = Math.max(4, Math.ceil(clampedDist * 0.85));
  for (let s = 2; s < pathSteps; s++) {
    const frac = s / pathSteps;
    const px = titan.x + segX * frac;
    const pz = titan.z + segZ * frac;
    const pt = getTileAt(state, px, pz);
    if (pt && pt.height > 0 && s % 2 === 0) {
      igniteAndDevastateTile(state, pt, {
        terrain: 'scorched',
        fireDuration: 8.5,
        fireColor: '#ff3b1f',
        devastateDuration: 20,
      });
    }
  }

  const impactR = 3.1;
  const minX = Math.max(0, Math.floor(targetX - impactR));
  const maxX = Math.min(state.gridSize - 1, Math.ceil(targetX + impactR));
  const minZ = Math.max(0, Math.floor(targetZ - impactR));
  const maxZ = Math.min(state.gridSize - 1, Math.ceil(targetZ + impactR));
  for (let tz = minZ; tz <= maxZ; tz++) {
    for (let tx = minX; tx <= maxX; tx++) {
      const rx = tx - targetX;
      const rz = tz - targetZ;
      const dSq = rx * rx + rz * rz;
      if (dSq > impactR * impactR) continue;
      const t = state.tiles[tz * state.gridSize + tx];
      if (!t || t.height === 0) continue;
      igniteAndDevastateTile(state, t, {
        terrain: dSq <= 2.4 ? 'volcanic_wasteland' : 'scorched',
        fireDuration: dSq <= 4.5 ? 11.5 : 7.5,
        fireColor: '#ff3b1f',
        devastateDuration: 28,
        lowerHeightBy: dSq <= 1.6 && t.height > 1 ? 1 : 0,
        clearAllResources: dSq <= 2.4,
      });
    }
  }

  return true;
}

export function triggerTitanOrbitalStrike(
  state: SimulationState,
  targetX: number,
  targetZ: number,
): boolean {
  const titan = state.divineTitan;
  if (!titan || (titan.phase !== 'active' && titan.phase !== 'jumping') || titan.skill1Cooldown > 0) {
    return false;
  }

  const tx = clamp(targetX, 1, state.gridSize - 2);
  const tz = clamp(targetZ, 1, state.gridSize - 2);
  titan.aimX = tx;
  titan.aimZ = tz;
  titan.skill1Targeting = false;
  titan.skill1Cooldown = TITAN_SKILL1_COOLDOWN;

  const strike: TitanOrbitalStrike = {
    id: nextTitanFxId('torb'),
    targetX: tx,
    targetZ: tz,
    radius: 5.8,
    phase: 'lockon',
    elapsed: 0,
    lockonDuration: 0.75,
    fireDuration: 2.1,
    fadeDuration: 0.65,
    damageTickTimer: 0,
    impactBurstDone: false,
  };
  titan.orbitalStrikes.push(strike);
  titan.pendingTrauma = Math.max(titan.pendingTrauma, 0.25);
  return true;
}

export function triggerTitanLeap(
  state: SimulationState,
  targetX: number,
  targetZ: number,
): boolean {
  const titan = state.divineTitan;
  if (!titan || titan.phase !== 'active' || titan.skill2Cooldown > 0) return false;

  let dx = targetX - titan.x;
  let dz = targetZ - titan.z;
  const dist = Math.hypot(dx, dz);
  if (dist > TITAN_LEAP_MAX_RANGE) {
    dx = (dx / dist) * TITAN_LEAP_MAX_RANGE;
    dz = (dz / dist) * TITAN_LEAP_MAX_RANGE;
  }

  const destX = clamp(titan.x + dx, 2, state.gridSize - 3);
  const destZ = clamp(titan.z + dz, 2, state.gridSize - 3);

  if (dist > 0.25) {
    titan.bodyYaw = Math.atan2(dx, dz);
  }

  titan.phase = 'jumping';
  titan.skill1Targeting = false;
  titan.skill2Cooldown = TITAN_SKILL2_COOLDOWN;
  titan.jumpStartX = titan.x;
  titan.jumpStartY = titan.y;
  titan.jumpStartZ = titan.z;
  titan.jumpTargetX = destX;
  titan.jumpTargetZ = destZ;
  titan.jumpElapsed = 0;
  titan.jumpWindup = 0.24;
  titan.jumpDuration = 1.05;
  titan.jumpPeakHeight = 17.5 + Math.min(5.0, dist * 0.2);
  titan.moveSpeed = 0;

  // Takeoff shockwave
  titan.shockwaves.push({
    id: nextTitanFxId('tsw'),
    x: titan.x,
    y: titan.y,
    z: titan.z,
    maxRadius: 7.0,
    elapsed: 0,
    duration: 0.6,
    kind: 'step',
    color: '#fb923c',
  });
  titan.pendingTrauma = Math.max(titan.pendingTrauma, 0.35);
  return true;
}

export function executeTitanLandingImpact(state: SimulationState, targetX: number, targetZ: number): void {
  const titan = state.divineTitan;
  const gx = clamp(Math.round(targetX), 1, state.gridSize - 2);
  const gz = clamp(Math.round(targetZ), 1, state.gridSize - 2);
  const centerTile = getTileAt(state, gx, gz);
  const landedOnWater = isWaterTile(centerTile);
  const r = 6.2;
  const rSq = r * r;
  const grid = state.worldGrid as WorldGridBuffers | undefined;
  const syncGrid = (t: TileData) => {
    if (grid) syncTileToWorldGrid(grid, t);
  };

  if (landedOnWater) {
    // WATER / SEA LANDING: Trigger a massive Tsunami wave + ocean splash trench
    if (!state.activeHazards) state.activeHazards = [];
    state.activeHazards.push({
      id: nextTitanFxId('haz'),
      kind: 'tsunami_wave',
      x: gx,
      z: gz,
      currentRadius: 1.5,
      maxRadius: 28.0,
      radius: 7.0,
      remaining: 5.5,
      duration: 5.5,
      tickTimer: 0,
    });

    const minX = Math.max(0, Math.floor(gx - r * 1.4));
    const maxX = Math.min(state.gridSize - 1, Math.ceil(gx + r * 1.4));
    const minZ = Math.max(0, Math.floor(gz - r * 1.4));
    const maxZ = Math.min(state.gridSize - 1, Math.ceil(gz + r * 1.4));
    for (let tz = minZ; tz <= maxZ; tz++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const dx = tx - gx;
        const dz = tz - gz;
        const dSq = dx * dx + dz * dz;
        if (dSq > (r * 1.4) ** 2) continue;
        const t = state.tiles[tz * state.gridSize + tx];
        if (!t) continue;
        t.onFireTimer = 0;
        if (t.height === 0) {
          if (dSq <= rSq * 0.85) {
            t.terrain = 'deep_water';
            delete t.isBridge;
          }
        } else if (t.height === 1 && !t.buildingId && dSq <= rSq * 0.95) {
          t.height = 0;
          t.terrain = 'shallow_water';
          delete t.isBridge;
          t.resourceNode = 'none';
          t.resourceAmount = 0;
          syncGrid(t);
        }
      }
    }

    damageUnitsAndStructuresInRadius(state, gx, gz, r * 1.65, 620, 560, 4.8);
    if (titan) {
      titan.shockwaves.push({
        id: nextTitanFxId('tsw'),
        x: gx,
        y: getTitanGroundY(state, gx, gz),
        z: gz,
        maxRadius: 16.5,
        elapsed: 0,
        duration: 1.15,
        kind: 'tsunami_slam',
        color: '#38bdf8',
      });
      titan.pendingTrauma = Math.max(titan.pendingTrauma, 0.95);
    }
    pushChronicle(state, 'The God Titan slammed into the sea, unleashing a colossal Tsunami!', 'warning');
  } else {
    // LAND LANDING: Carve a deep stepped crater + raised rocky rim + massive shockwave
    const baseH = Math.max(2, centerTile?.height ?? 2);
    const allowFire = state.worldRules?.wildfireSpread !== false;
    let waterTilesHit = 0;
    let waterSumX = 0;
    let waterSumZ = 0;

    const minX = Math.max(0, Math.floor(gx - (r + 1.5)));
    const maxX = Math.min(state.gridSize - 1, Math.ceil(gx + (r + 1.5)));
    const minZ = Math.max(0, Math.floor(gz - (r + 1.5)));
    const maxZ = Math.min(state.gridSize - 1, Math.ceil(gz + (r + 1.5)));

    for (let tz = minZ; tz <= maxZ; tz++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const dx = tx - gx;
        const dz = tz - gz;
        const dSq = dx * dx + dz * dz;
        if (dSq > rSq) continue;
        const t = state.tiles[tz * state.gridSize + tx];
        if (!t) continue;

        if (t.height === 0) {
          waterTilesHit += 1;
          waterSumX += tx;
          waterSumZ += tz;
          t.terrain = dSq <= 12.0 ? 'deep_water' : 'shallow_water';
          delete t.isBridge;
          t.onFireTimer = 0;
          continue;
        }

        const tileH = Math.max(1, t.height);
        const angleNoise = ((((tx * 73856093) ^ (tz * 19349663)) & 255) / 255 - 0.5) * 0.8;
        const effDSq = dSq + angleNoise;

        if (dSq <= 4.5) {
          // Deep central impact pit + blazing firestorm
          t.height = Math.max(1, Math.min(baseH, tileH) - 2);
          igniteAndDevastateTile(state, t, {
            terrain: 'scorched',
            fireDuration: 12.5,
            fireColor: '#ff6b00',
            devastateDuration: 42,
            clearAllResources: true,
          });
        } else if (effDSq <= 14.0) {
          // Stepped inner crater bowl + scattered fires
          t.height = Math.max(1, Math.min(baseH, tileH) - 1);
          igniteAndDevastateTile(state, t, {
            terrain: 'scorched',
            fireDuration: (tx + tz) % 2 === 0 ? 9.5 : 0,
            fireColor: '#ff6b00',
            devastateDuration: 36,
            clearAllResources: true,
          });
        } else if (effDSq <= 24.5 && !t.buildingId) {
          // Raised rocky crater rim
          t.height = Math.min(10, tileH + 1);
          igniteAndDevastateTile(state, t, {
            terrain: effDSq <= 19.5 ? 'rock' : 'scorched',
            fireDuration: (tx * 3 + tz) % 3 === 0 ? 7.0 : 0,
            fireColor: '#ff5400',
            devastateDuration: 28,
          });
        } else if (!t.buildingId) {
          // Outer scorched shockwave ring
          igniteAndDevastateTile(state, t, {
            terrain: 'scorched',
            devastateDuration: 22,
          });
          t.crushedTimer = Math.max(t.crushedTimer ?? 0, 12);
        }
      }
    }

    // If coastal water was caught in the slam, also launch a tsunami wave!
    if (waterTilesHit >= 4) {
      if (!state.activeHazards) state.activeHazards = [];
      state.activeHazards.push({
        id: nextTitanFxId('haz'),
        kind: 'tsunami_wave',
        x: Math.round(waterSumX / waterTilesHit),
        z: Math.round(waterSumZ / waterTilesHit),
        currentRadius: 1.5,
        maxRadius: 22.0,
        radius: 6.0,
        remaining: 4.5,
        duration: 4.5,
        tickTimer: 0,
      });
    }

    damageUnitsAndStructuresInRadius(state, gx, gz, r * 1.75, 680, 620, 5.2);

    if (titan) {
      titan.shockwaves.push({
        id: nextTitanFxId('tsw'),
        x: gx,
        y: getTitanGroundY(state, gx, gz),
        z: gz,
        maxRadius: 15.5,
        elapsed: 0,
        duration: 1.1,
        kind: 'slam',
        color: '#f97316',
      });
      titan.pendingTrauma = Math.max(titan.pendingTrauma, 0.95);
    }
    pushChronicle(state, 'The God Titan shattered the earth with a cataclysmic crater slam!', 'warning');
  }
}

function applyOrbitalLaserDamage(state: SimulationState, strike: TitanOrbitalStrike): void {
  const { targetX, targetZ, radius } = strike;
  damageUnitsAndStructuresInRadius(state, targetX, targetZ, radius, 290, 240, 1.0);

  const rSq = radius * radius;
  const minX = Math.max(0, Math.floor(targetX - radius));
  const maxX = Math.min(state.gridSize - 1, Math.ceil(targetX + radius));
  const minZ = Math.max(0, Math.floor(targetZ - radius));
  const maxZ = Math.min(state.gridSize - 1, Math.ceil(targetZ + radius));
  for (let tz = minZ; tz <= maxZ; tz++) {
    for (let tx = minX; tx <= maxX; tx++) {
      const dx = tx - targetX;
      const dz = tz - targetZ;
      const dSq = dx * dx + dz * dz;
      if (dSq > rSq) continue;
      const t = state.tiles[tz * state.gridSize + tx];
      if (!t || t.height === 0) continue;

      if (dSq <= rSq * 0.28) {
        // Glassed molten core pit + raging firestorm
        igniteAndDevastateTile(state, t, {
          terrain: 'scorched',
          fireDuration: 15.0,
          fireColor: '#ff3b1f',
          devastateDuration: 46,
          lowerHeightBy: t.height > 1 && strike.elapsed < 0.25 ? 1 : 0,
          clearAllResources: true,
        });
      } else if (dSq <= rSq * 0.68) {
        igniteAndDevastateTile(state, t, {
          terrain: (tx + tz) % 3 === 0 ? 'volcanic_wasteland' : 'scorched',
          fireDuration: 11.5,
          fireColor: '#ff5400',
          devastateDuration: 38,
          clearAllResources: true,
        });
      } else {
        igniteAndDevastateTile(state, t, {
          terrain: 'scorched',
          fireDuration: (tx + tz) % 2 === 0 ? 8.5 : 0,
          fireColor: '#ff6b00',
          devastateDuration: 28,
        });
      }
    }
  }
}

export function triggerTitanDeathBeam(
  state: SimulationState,
  targetX: number,
  targetZ: number,
): boolean {
  const titan = state.divineTitan;
  if (!titan || titan.phase !== 'active' || titan.skill3Cooldown > 0) return false;

  let dx = targetX - titan.x;
  let dz = targetZ - titan.z;
  let dist = Math.hypot(dx, dz);
  let lockedYaw = titan.turretYaw;
  if (dist > 0.25) {
    lockedYaw = Math.atan2(dx, dz);
  } else {
    dx = Math.sin(lockedYaw) * 18;
    dz = Math.cos(lockedYaw) * 18;
    dist = 18;
  }

  const clampedDist = clamp(dist, 8.0, 38.0);
  const fwdX = Math.sin(lockedYaw);
  const fwdZ = Math.cos(lockedYaw);
  const tx = clamp(titan.x + fwdX * clampedDist, 2, state.gridSize - 3);
  const tz = clamp(titan.z + fwdZ * clampedDist, 2, state.gridSize - 3);
  const ty = getTitanGroundY(state, tx, tz) + 0.3;

  titan.phase = 'death_beam';
  titan.skill1Targeting = false;
  titan.skill3Cooldown = TITAN_SKILL3_COOLDOWN;
  titan.moveSpeed = 0;
  titan.turretYaw = lockedYaw;
  titan.aimX = tx;
  titan.aimZ = tz;
  const dy = ty - (titan.y + 5.7);
  titan.turretPitch = clamp(Math.atan2(dy, Math.max(4, clampedDist)), -0.35, 0.35);

  const originX = titan.x + fwdX * 6.9;
  const originY = titan.y + 5.75;
  const originZ = titan.z + fwdZ * 6.9;

  titan.deathBeam = {
    subPhase: 'combining',
    elapsed: 0,
    combineDuration: TITAN_DEATH_BEAM_COMBINE,
    fireDuration: TITAN_DEATH_BEAM_FIRE,
    detonateDuration: TITAN_DEATH_BEAM_DETONATE,
    originX,
    originY,
    originZ,
    targetX: tx,
    targetY: ty,
    targetZ: tz,
    lockedYaw,
    damageTickTimer: 0,
    detonated: false,
  };

  titan.pendingTrauma = Math.max(titan.pendingTrauma, 0.45);
  pushChronicle(state, 'The God Titan fused its twin cannons, charging an apocalyptic Death Beam!', 'warning');
  return true;
}

export function triggerTitanMissileBarrage(
  state: SimulationState,
  targetX: number,
  targetZ: number,
): boolean {
  const titan = state.divineTitan;
  if (!titan || titan.phase !== 'active' || titan.skill4Cooldown > 0) return false;

  const tx = clamp(targetX, 2, state.gridSize - 3);
  const tz = clamp(targetZ, 2, state.gridSize - 3);
  titan.skill4Cooldown = TITAN_SKILL4_COOLDOWN;
  titan.missileSalvoRemaining = 18;
  titan.missileSalvoTimer = 0;
  titan.missileTargetX = tx;
  titan.missileTargetZ = tz;
  titan.pendingTrauma = Math.max(titan.pendingTrauma, 0.3);
  return true;
}

function applyDeathBeamTickDamage(state: SimulationState, titan: DivineTitanState): void {
  const db = titan.deathBeam;
  if (!db) return;

  // Heavy endpoint plasma burn + piercing beam-line annihilation
  damageUnitsAndStructuresInRadius(state, db.targetX, db.targetZ, 6.2, 320, 260, 1.4);

  const beamWidthSq = 3.2 * 3.2;
  const segX = db.targetX - titan.x;
  const segZ = db.targetZ - titan.z;
  const segLenSq = Math.max(0.01, segX * segX + segZ * segZ);
  const immortal = Boolean(state.worldRules?.immortalEntities);

  const distSqToBeam = (px: number, pz: number): number => {
    const tProj = clamp(((px - titan.x) * segX + (pz - titan.z) * segZ) / segLenSq, 0, 1);
    const cx = titan.x + segX * tProj;
    const cz = titan.z + segZ * tProj;
    const ex = px - cx;
    const ez = pz - cz;
    return ex * ex + ez * ez;
  };

  for (let i = 0; i < state.units.length; i++) {
    const u = state.units[i];
    if (u.state === 'ko') continue;
    if (distSqToBeam(u.x, u.z) <= beamWidthSq && !immortal && !u.statusEffects.shielded) {
      u.hp -= 240;
      if (u.hp <= 0) {
        u.hp = 0;
        u.state = 'ko';
        u.koTimer = 0.5;
        if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
      }
    }
  }

  for (let i = 0; i < state.buildings.length; i++) {
    const b = state.buildings[i];
    if (distSqToBeam(b.tileX, b.tileZ) <= beamWidthSq) {
      if (b.shieldTimer > 0) {
        b.shieldTimer = 0;
        b.hp = Math.max(0, b.hp - 120);
      } else {
        b.hp = Math.max(0, b.hp - 220);
      }
    }
  }

  // Scorch & ignite wildfires along the burning beam path + melt endpoint area
  const beamSteps = Math.max(5, Math.ceil(Math.hypot(segX, segZ) * 0.6));
  for (let s = 2; s < beamSteps; s++) {
    const frac = s / beamSteps;
    const pt = getTileAt(state, titan.x + segX * frac, titan.z + segZ * frac);
    if (pt && pt.height > 0 && s % 2 === 0) {
      igniteAndDevastateTile(state, pt, {
        terrain: 'scorched',
        fireDuration: 10.5,
        fireColor: '#ff3b1f',
        devastateDuration: 32,
      });
    }
  }

  const r = 5.4;
  const minX = Math.max(0, Math.floor(db.targetX - r));
  const maxX = Math.min(state.gridSize - 1, Math.ceil(db.targetX + r));
  const minZ = Math.max(0, Math.floor(db.targetZ - r));
  const maxZ = Math.min(state.gridSize - 1, Math.ceil(db.targetZ + r));
  for (let tz = minZ; tz <= maxZ; tz++) {
    for (let tx = minX; tx <= maxX; tx++) {
      const dx = tx - db.targetX;
      const dz = tz - db.targetZ;
      const dSq = dx * dx + dz * dz;
      if (dSq > r * r) continue;
      const t = state.tiles[tz * state.gridSize + tx];
      if (!t || t.height === 0) continue;
      igniteAndDevastateTile(state, t, {
        terrain: dSq <= 9.0 ? 'volcanic_wasteland' : 'scorched',
        fireDuration: dSq <= 16.0 ? 14.0 : 9.0,
        fireColor: '#ff3b1f',
        devastateDuration: 42,
        cursedDuration: 18,
        clearAllResources: dSq <= 12.0,
      });
    }
  }
}

function executeDeathBeamDetonation(state: SimulationState, titan: DivineTitanState): void {
  const db = titan.deathBeam;
  if (!db) return;

  const gx = clamp(Math.round(db.targetX), 1, state.gridSize - 2);
  const gz = clamp(Math.round(db.targetZ), 1, state.gridSize - 2);
  const centerTile = getTileAt(state, gx, gz);
  const isWater = isWaterTile(centerTile);
  const grid = state.worldGrid as WorldGridBuffers | undefined;
  const syncGrid = (t: TileData) => {
    if (grid) syncTileToWorldGrid(grid, t);
  };

  // Colossal thermonuclear-scale blast radius + radiation sickness across outer fallout zone
  const blastR = 14.0;
  const falloutR = 16.5;
  damageUnitsAndStructuresInRadius(state, gx, gz, blastR, 1500, 1300, 8.0);
  irradiateUnitsInRadius(state, gx, gz, falloutR + 2.0, 42);

  if (!state.activeHazards) state.activeHazards = [];

  if (isWater) {
    state.activeHazards.push({
      id: nextTitanFxId('haz'),
      kind: 'tsunami_wave',
      x: gx,
      z: gz,
      currentRadius: 2.0,
      maxRadius: 38.0,
      radius: 9.0,
      remaining: 6.5,
      duration: 6.5,
      tickTimer: 0,
    });
  }

  // Carve a colossal multi-ring nuclear crater + irradiate & ignite the entire surrounding fallout zone!
  const falloutRSq = falloutR * falloutR;
  const baseH = Math.max(2, centerTile?.height ?? 2);

  const minX = Math.max(0, Math.floor(gx - falloutR - 1));
  const maxX = Math.min(state.gridSize - 1, Math.ceil(gx + falloutR + 1));
  const minZ = Math.max(0, Math.floor(gz - falloutR - 1));
  const maxZ = Math.min(state.gridSize - 1, Math.ceil(gz + falloutR + 1));

  for (let tz = minZ; tz <= maxZ; tz++) {
    for (let tx = minX; tx <= maxX; tx++) {
      const dx = tx - gx;
      const dz = tz - gz;
      const dSq = dx * dx + dz * dz;
      if (dSq > falloutRSq) continue;
      const t = state.tiles[tz * state.gridSize + tx];
      if (!t) continue;

      if (t.height === 0) {
        // Irradiate & poison nearby water into glowing toxic fallout pools
        if (dSq <= 105.0) {
          t.waterKind = 'poison';
          t.cursedTimer = Math.max(t.cursedTimer, 45);
          delete t.isBridge;
          syncGrid(t);
        }
        continue;
      }

      const tileH = Math.max(1, t.height);
      if (!isWater && dSq <= 14.0) {
        // Ground zero: deep molten thermonuclear pit + raging firestorm + heavy radiation
        t.height = Math.max(1, Math.min(baseH, tileH) - 3);
        igniteAndDevastateTile(state, t, {
          terrain: 'volcanic_wasteland',
          fireDuration: 18.0,
          fireColor: '#ff6b00',
          devastateDuration: 68,
          cursedDuration: 62,
          clearAllResources: true,
        });
      } else if (!isWater && dSq <= 38.0) {
        // Inner blast bowl: charred & irradiated wasteland + firestorm
        t.height = Math.max(1, Math.min(baseH, tileH) - 2);
        igniteAndDevastateTile(state, t, {
          terrain: (tx + tz) % 4 === 0 ? 'blighted_mire' : 'scorched',
          fireDuration: 14.5,
          fireColor: (tx + tz) % 5 === 0 ? '#84cc16' : '#ff6b00',
          devastateDuration: 60,
          cursedDuration: 55,
          clearAllResources: true,
        });
      } else if (!isWater && dSq <= 64.0 && !t.buildingId) {
        // Raised shattered crater rim + burning radioactive embers
        t.height = Math.min(10, tileH + 1);
        igniteAndDevastateTile(state, t, {
          terrain: dSq <= 50.0 ? 'rock' : (tx + tz) % 3 === 0 ? 'blighted_mire' : 'scorched',
          fireDuration: (tx + tz) % 2 === 0 ? 11.5 : 0,
          fireColor: (tx * 3 + tz) % 4 === 0 ? '#84cc16' : '#ff5400',
          devastateDuration: 50,
          cursedDuration: 46,
        });
      } else if (dSq <= 135.0) {
        // Mid irradiation ring: blighted radioactive fallout + blazing wildfires
        igniteAndDevastateTile(state, t, {
          terrain: (tx * 7 + tz * 13) % 3 === 0 ? 'blighted_mire' : 'scorched',
          fireDuration: (tx + tz) % 2 === 0 ? 10.0 : 0,
          fireColor: (tx + tz) % 4 === 0 ? '#84cc16' : '#ff6b00',
          devastateDuration: 42,
          cursedDuration: 40,
        });
      } else {
        // Outer fallout fringe: lingering radiation + scorched grass/trees
        igniteAndDevastateTile(state, t, {
          terrain: (tx + tz) % 3 === 0 ? 'blighted_mire' : undefined,
          fireDuration: (tx * 5 + tz * 3) % 4 === 0 ? 7.5 : 0,
          fireColor: '#84cc16',
          devastateDuration: 28,
          cursedDuration: 32,
        });
      }
    }
  }

  // Spawn 2 lingering radioactive fallout clouds drifting over ground zero
  for (let c = 0; c < 2; c++) {
    const ang = c * Math.PI + 0.6;
    state.activeHazards.push({
      id: nextTitanFxId('haz'),
      kind: 'acid_cloud',
      x: clamp(gx + Math.cos(ang) * 3.5, 2, state.gridSize - 3),
      z: clamp(gz + Math.sin(ang) * 3.5, 2, state.gridSize - 3),
      windX: Math.cos(ang + 0.7) * 0.55,
      windZ: Math.sin(ang + 0.7) * 0.55,
      radius: 7.5,
      remaining: 18.0,
      duration: 18.0,
      tickTimer: 0,
    });
  }

  const gy = getTitanGroundY(state, gx, gz);

  // Double colossal shockwave rings
  titan.shockwaves.push(
    {
      id: nextTitanFxId('tsw'),
      x: gx,
      y: gy,
      z: gz,
      maxRadius: 26.0,
      elapsed: 0,
      duration: 1.55,
      kind: isWater ? 'tsunami_slam' : 'slam',
      color: '#ff4500',
    },
    {
      id: nextTitanFxId('tsw'),
      x: gx,
      y: gy + 0.3,
      z: gz,
      maxRadius: 18.0,
      elapsed: 0,
      duration: 1.15,
      kind: 'slam',
      color: '#a3e635',
    },
  );

  // Spawn towering pixelated 3D Mushroom Cloud!
  const cloud: TitanMushroomCloud = {
    id: nextTitanFxId('tmc'),
    x: gx,
    y: gy,
    z: gz,
    elapsed: 0,
    duration: 7.5,
    maxHeight: 26.0,
    maxRadius: 12.5,
  };
  titan.mushroomClouds.push(cloud);

  titan.pendingTrauma = 1.0;
  pushChronicle(
    state,
    'The God Titan Death Beam detonated in a nuclear mushroom cloud, igniting firestorms and irradiating the land!',
    'warning',
  );
}

function launchNextBarrageMissile(state: SimulationState, titan: DivineTitanState): void {
  const idx = 18 - titan.missileSalvoRemaining;
  const side: -1 | 1 = idx % 2 === 0 ? -1 : 1;

  // Launch from left/right armored shoulder pauldrons
  const cosB = Math.cos(titan.bodyYaw);
  const sinB = Math.sin(titan.bodyYaw);
  const localX = side * 2.1;
  const localZ = -0.3;
  const startX = titan.x + localX * cosB + localZ * sinB;
  const startY = titan.y + 4.9;
  const startZ = titan.z - localX * sinB + localZ * cosB;

  // Deterministic pseudo-random carpet-bombing scatter around target (radius up to 9.5)
  const angle = (idx * 2.399963) + (titan.x * 0.13);
  const rad = 1.2 + Math.sqrt((idx + 0.5) / 18) * 8.6;
  const tx = clamp(titan.missileTargetX + Math.cos(angle) * rad, 1, state.gridSize - 2);
  const tz = clamp(titan.missileTargetZ + Math.sin(angle) * rad, 1, state.gridSize - 2);
  const ty = getTitanGroundY(state, tx, tz) + 0.2;

  // High outward arching control point for dramatic missile swarm silhouette
  const midX = (startX + tx) * 0.5 + side * 4.5 * cosB;
  const midZ = (startZ + tz) * 0.5 - side * 4.5 * sinB;
  const peakY = Math.max(startY, ty) + 14.0 + (idx % 4) * 2.2;

  const missile: TitanMissile = {
    id: nextTitanFxId('tms'),
    startX,
    startY,
    startZ,
    ctrlX: midX,
    ctrlY: peakY,
    ctrlZ: midZ,
    targetX: tx,
    targetY: ty,
    targetZ: tz,
    x: startX,
    y: startY,
    z: startZ,
    prevX: startX,
    prevY: startY,
    prevZ: startZ,
    elapsed: 0,
    duration: 0.92 + (idx % 3) * 0.14,
  };
  titan.missiles.push(missile);
}

export function stepDivineTitan(
  state: SimulationState,
  dt: number,
  input: TitanControlInput,
): { exited: boolean; landed: boolean } {
  const titan = state.divineTitan;
  if (!titan) return { exited: false, landed: false };

  const clampedDt = Math.min(0.08, Math.max(0, dt));
  let exited = false;
  let landed = false;

  // Cooldowns & recoil decay
  titan.slashCooldown = Math.max(0, titan.slashCooldown - clampedDt);
  titan.skill1Cooldown = Math.max(0, titan.skill1Cooldown - clampedDt);
  titan.skill2Cooldown = Math.max(0, titan.skill2Cooldown - clampedDt);
  titan.skill3Cooldown = Math.max(0, titan.skill3Cooldown - clampedDt);
  titan.skill4Cooldown = Math.max(0, titan.skill4Cooldown - clampedDt);
  titan.recoilLeft = Math.max(0, titan.recoilLeft - clampedDt * 4.5);
  titan.recoilRight = Math.max(0, titan.recoilRight - clampedDt * 4.5);

  // Update cursor aim & turret yaw tracking (LOCKED during death_beam cutscene & exiting!)
  if (titan.phase !== 'exiting' && titan.phase !== 'death_beam' && input.aimX !== null && input.aimZ !== null) {
    titan.aimX = clamp(input.aimX, 0, state.gridSize - 1);
    titan.aimZ = clamp(input.aimZ, 0, state.gridSize - 1);
    const adx = titan.aimX - titan.x;
    const adz = titan.aimZ - titan.z;
    const aimDist = Math.hypot(adx, adz);
    if (aimDist > 0.25) {
      const desiredTurretYaw = Math.atan2(adx, adz);
      const diff = wrapAngleDiff(desiredTurretYaw, titan.turretYaw);
      titan.turretYaw += diff * Math.min(1, clampedDt * 8.5);
      const targetY = getTitanGroundY(state, titan.aimX, titan.aimZ);
      const dy = targetY - (titan.y + 4.4);
      titan.turretPitch = clamp(Math.atan2(dy, Math.max(2.5, aimDist)), -0.35, 0.35);
    }
  }

  // Phase state machine
  if (titan.phase === 'summoning') {
    titan.phaseTimer += clampedDt;
    titan.y = getTitanGroundY(state, titan.x, titan.z);
    if (titan.phaseTimer >= TITAN_SUMMON_DURATION) {
      titan.phase = 'active';
      titan.phaseTimer = 0;
    }
  } else if (titan.phase === 'active') {
    // Camera-relative WASD movement with heavy mechanical inertia
    const fwdX = -Math.sin(input.camYaw);
    const fwdZ = -Math.cos(input.camYaw);
    const rightX = Math.cos(input.camYaw);
    const rightZ = -Math.sin(input.camYaw);

    let mx = fwdX * input.moveForward + rightX * input.moveRight;
    let mz = fwdZ * input.moveForward + rightZ * input.moveRight;
    const mag = Math.hypot(mx, mz);

    if (mag > 0.01) {
      mx /= mag;
      mz /= mag;
      titan.moveSpeed = Math.min(TITAN_WALK_SPEED, titan.moveSpeed + clampedDt * 7.5);
      const moveAmt = titan.moveSpeed * clampedDt;
      titan.x = clamp(titan.x + mx * moveAmt, 2, state.gridSize - 3);
      titan.z = clamp(titan.z + mz * moveAmt, 2, state.gridSize - 3);

      const desiredBodyYaw = Math.atan2(mx, mz);
      const bodyDiff = wrapAngleDiff(desiredBodyYaw, titan.bodyYaw);
      titan.bodyYaw += bodyDiff * Math.min(1, clampedDt * 3.4);

      const speedRatio = titan.moveSpeed / TITAN_WALK_SPEED;
      titan.walkCycle += clampedDt * (2.25 * Math.max(0.45, speedRatio));
      const stepIndex = Math.floor(titan.walkCycle / Math.PI);
      if (stepIndex > titan.lastStepIndex) {
        titan.lastStepIndex = stepIndex;
        executeTitanWalkShockwave(state, titan.x, titan.z);
      }
    } else {
      titan.moveSpeed = Math.max(0, titan.moveSpeed - clampedDt * 9.5);
    }

    const groundY = getTitanGroundY(state, titan.x, titan.z);
    titan.y += (groundY - titan.y) * Math.min(1, clampedDt * 9.5);
  } else if (titan.phase === 'jumping') {
    titan.jumpElapsed += clampedDt;
    if (titan.jumpElapsed < titan.jumpWindup) {
      titan.y = getTitanGroundY(state, titan.x, titan.z);
    } else {
      const flightT = clamp((titan.jumpElapsed - titan.jumpWindup) / titan.jumpDuration, 0, 1);
      titan.x = titan.jumpStartX + (titan.jumpTargetX - titan.jumpStartX) * flightT;
      titan.z = titan.jumpStartZ + (titan.jumpTargetZ - titan.jumpStartZ) * flightT;

      const endGroundY = getTitanGroundY(state, titan.jumpTargetX, titan.jumpTargetZ);
      const baseLineY = titan.jumpStartY + (endGroundY - titan.jumpStartY) * flightT;
      const arcY = 4 * flightT * (1 - flightT) * titan.jumpPeakHeight;
      titan.y = baseLineY + arcY;

      if (flightT >= 1) {
        titan.x = titan.jumpTargetX;
        titan.z = titan.jumpTargetZ;
        titan.y = getTitanGroundY(state, titan.x, titan.z);
        titan.phase = 'active';
        titan.phaseTimer = 0;
        executeTitanLandingImpact(state, titan.x, titan.z);
        landed = true;
      }
    }
  } else if (titan.phase === 'death_beam' && titan.deathBeam) {
    // Movie-like cutscene phase: all controls locked!
    const db = titan.deathBeam;
    db.elapsed += clampedDt;
    titan.moveSpeed = 0;
    titan.y = getTitanGroundY(state, titan.x, titan.z);
    titan.turretYaw = db.lockedYaw;

    if (db.subPhase === 'combining') {
      titan.pendingTrauma = Math.max(titan.pendingTrauma, 0.25);
      if (db.elapsed >= db.combineDuration) {
        db.subPhase = 'firing';
        db.elapsed = 0;
        db.damageTickTimer = 0;
        applyDeathBeamTickDamage(state, titan);
        titan.shockwaves.push({
          id: nextTitanFxId('tsw'),
          x: db.targetX,
          y: db.targetY - 0.2,
          z: db.targetZ,
          maxRadius: 10.5,
          elapsed: 0,
          duration: 0.75,
          kind: 'slam',
          color: '#ff2414',
        });
        titan.pendingTrauma = Math.max(titan.pendingTrauma, 0.78);
      }
    } else if (db.subPhase === 'firing') {
      db.damageTickTimer += clampedDt;
      titan.pendingTrauma = Math.max(titan.pendingTrauma, 0.48);
      if (db.damageTickTimer >= 0.16) {
        db.damageTickTimer -= 0.16;
        applyDeathBeamTickDamage(state, titan);
      }
      if (db.elapsed >= db.fireDuration) {
        db.subPhase = 'detonating';
        db.elapsed = 0;
        db.detonated = true;
        executeDeathBeamDetonation(state, titan);
      }
    } else if (db.subPhase === 'detonating') {
      if (db.elapsed >= db.detonateDuration) {
        titan.deathBeam = null;
        titan.phase = 'active';
        titan.phaseTimer = 0;
      }
    }
  } else if (titan.phase === 'exiting') {
    titan.phaseTimer += clampedDt;
    titan.y = getTitanGroundY(state, titan.x, titan.z);
    if (titan.phaseTimer >= TITAN_EXIT_DURATION) {
      state.divineTitan = null;
      exited = true;
      return { exited: true, landed };
    }
  }

  // Advance Skill 4 Missile Barrage staggered salvo launches
  if (titan.missileSalvoRemaining > 0 && titan.phase !== 'exiting') {
    titan.missileSalvoTimer -= clampedDt;
    while (titan.missileSalvoRemaining > 0 && titan.missileSalvoTimer <= 0) {
      launchNextBarrageMissile(state, titan);
      titan.missileSalvoRemaining -= 1;
      titan.missileSalvoTimer += 0.055;
    }
  }

  // Advance flying missiles (Quadratic Bezier arc -> explosive detonation)
  for (let i = titan.missiles.length - 1; i >= 0; i--) {
    const m = titan.missiles[i];
    m.prevX = m.x;
    m.prevY = m.y;
    m.prevZ = m.z;
    m.elapsed += clampedDt;
    const t = clamp(m.elapsed / m.duration, 0, 1);
    const inv = 1 - t;
    m.x = inv * inv * m.startX + 2 * inv * t * m.ctrlX + t * t * m.targetX;
    m.y = inv * inv * m.startY + 2 * inv * t * m.ctrlY + t * t * m.targetY;
    m.z = inv * inv * m.startZ + 2 * inv * t * m.ctrlZ + t * t * m.targetZ;

    if (t >= 1) {
      // Destructive incendiary missile detonation!
      damageUnitsAndStructuresInRadius(state, m.targetX, m.targetZ, 3.8, 280, 230, 2.4);
      const mr = 2.5;
      const minX = Math.max(0, Math.floor(m.targetX - mr));
      const maxX = Math.min(state.gridSize - 1, Math.ceil(m.targetX + mr));
      const minZ = Math.max(0, Math.floor(m.targetZ - mr));
      const maxZ = Math.min(state.gridSize - 1, Math.ceil(m.targetZ + mr));
      for (let tz = minZ; tz <= maxZ; tz++) {
        for (let tx = minX; tx <= maxX; tx++) {
          const rx = tx - m.targetX;
          const rz = tz - m.targetZ;
          const dSq = rx * rx + rz * rz;
          if (dSq > mr * mr) continue;
          const tile = state.tiles[tz * state.gridSize + tx];
          if (!tile || tile.height === 0) continue;
          igniteAndDevastateTile(state, tile, {
            terrain: dSq <= 1.8 ? 'volcanic_wasteland' : 'scorched',
            fireDuration: dSq <= 3.0 ? 12.0 : 8.0,
            fireColor: '#ff5400',
            devastateDuration: 32,
            lowerHeightBy: dSq <= 1.2 && tile.height > 1 ? 1 : 0,
            clearAllResources: dSq <= 2.2,
          });
        }
      }
      titan.shockwaves.push({
        id: nextTitanFxId('tsw'),
        x: m.targetX,
        y: m.targetY - 0.1,
        z: m.targetZ,
        maxRadius: 4.5,
        elapsed: 0,
        duration: 0.48,
        kind: 'step',
        color: '#f97316',
      });
      titan.pendingTrauma = Math.max(titan.pendingTrauma, 0.3);
      titan.missiles.splice(i, 1);
    }
  }

  // Advance towering mushroom clouds
  for (let i = titan.mushroomClouds.length - 1; i >= 0; i--) {
    const mc = titan.mushroomClouds[i];
    mc.elapsed += clampedDt;
    if (mc.elapsed >= mc.duration) {
      titan.mushroomClouds.splice(i, 1);
    }
  }

  // Advance M1 laser beams
  for (let i = titan.slashes.length - 1; i >= 0; i--) {
    const s = titan.slashes[i];
    s.elapsed += clampedDt;
    if (s.elapsed >= s.duration) {
      titan.slashes.splice(i, 1);
    }
  }

  // Advance shockwaves
  for (let i = titan.shockwaves.length - 1; i >= 0; i--) {
    const sw = titan.shockwaves[i];
    sw.elapsed += clampedDt;
    if (sw.elapsed >= sw.duration) {
      titan.shockwaves.splice(i, 1);
    }
  }

  // Advance Skill 1 Orbital Satellite Strikes
  for (let i = titan.orbitalStrikes.length - 1; i >= 0; i--) {
    const st = titan.orbitalStrikes[i];
    st.elapsed += clampedDt;
    if (st.phase === 'lockon') {
      if (st.elapsed >= st.lockonDuration) {
        st.phase = 'firing';
        st.elapsed = 0;
        st.damageTickTimer = 0;
        st.impactBurstDone = true;
        applyOrbitalLaserDamage(state, st);
        titan.shockwaves.push({
          id: nextTitanFxId('tsw'),
          x: st.targetX,
          y: getTitanGroundY(state, st.targetX, st.targetZ),
          z: st.targetZ,
          maxRadius: st.radius * 2.1,
          elapsed: 0,
          duration: 0.9,
          kind: 'slam',
          color: '#ef4444',
        });
        titan.pendingTrauma = Math.max(titan.pendingTrauma, 0.85);
      }
    } else if (st.phase === 'firing') {
      st.damageTickTimer += clampedDt;
      if (st.damageTickTimer >= 0.16) {
        st.damageTickTimer -= 0.16;
        applyOrbitalLaserDamage(state, st);
        titan.pendingTrauma = Math.max(titan.pendingTrauma, 0.42);
      }
      if (st.elapsed >= st.fireDuration) {
        st.phase = 'fadeout';
        st.elapsed = 0;
      }
    } else if (st.phase === 'fadeout') {
      if (st.elapsed >= st.fadeDuration) {
        titan.orbitalStrikes.splice(i, 1);
      }
    }
  }

  return { exited, landed };
}
