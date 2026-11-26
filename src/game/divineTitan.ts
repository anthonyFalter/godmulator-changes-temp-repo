import {
  DivineTitanState,
  SimulationState,
  TileData,
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
    titan.aimX = aimX;
    titan.aimZ = aimZ;
  }

  const dx = titan.aimX - titan.x;
  const dz = titan.aimZ - titan.z;
  const yaw = dx * dx + dz * dz > 0.04 ? Math.atan2(dx, dz) : titan.turretYaw;
  titan.turretYaw = yaw;

  const range = 10.8;
  const tilt = titan.nextSlashHand === 0 ? 0.34 : -0.34;
  if (titan.nextSlashHand === 0) {
    titan.recoilLeft = 1.0;
    titan.nextSlashHand = 1;
  } else {
    titan.recoilRight = 1.0;
    titan.nextSlashHand = 0;
  }
  titan.slashCooldown = TITAN_SLASH_COOLDOWN;
  titan.pendingTrauma = Math.max(titan.pendingTrauma, 0.28);

  const slash: TitanSlashEffect = {
    id: nextTitanFxId('tsl'),
    x: titan.x + Math.sin(yaw) * 2.2,
    y: titan.y + 3.0,
    z: titan.z + Math.cos(yaw) * 2.2,
    yaw,
    tilt,
    range,
    elapsed: 0,
    duration: 0.36,
  };
  titan.slashes.push(slash);

  // Cone / arc slash damage in front of the Titan
  const fwdX = Math.sin(yaw);
  const fwdZ = Math.cos(yaw);
  const cosHalfArc = Math.cos((62 * Math.PI) / 180);
  const immortal = Boolean(state.worldRules?.immortalEntities);

  for (let i = 0; i < state.units.length; i++) {
    const u = state.units[i];
    if (u.state === 'ko') continue;
    const ux = u.x - titan.x;
    const uz = u.z - titan.z;
    const dSq = ux * ux + uz * uz;
    if (dSq > range * range) continue;
    const dist = Math.sqrt(dSq) || 0.001;
    const dot = (ux * fwdX + uz * fwdZ) / dist;
    if (dist < 2.8 || dot >= cosHalfArc) {
      u.x = clamp(u.x + (ux / dist) * 2.4, 1, state.gridSize - 2);
      u.z = clamp(u.z + (uz / dist) * 2.4, 1, state.gridSize - 2);
      if (!immortal && !u.statusEffects.shielded) {
        u.hp -= 340;
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
    const bx = b.tileX - titan.x;
    const bz = b.tileZ - titan.z;
    const dSq = bx * bx + bz * bz;
    if (dSq > range * range) continue;
    const dist = Math.sqrt(dSq) || 0.001;
    const dot = (bx * fwdX + bz * fwdZ) / dist;
    if (dist < 2.8 || dot >= cosHalfArc) {
      if (b.shieldTimer > 0) {
        b.shieldTimer = 0;
        b.hp = Math.max(0, b.hp - 120);
      } else {
        b.hp = Math.max(0, b.hp - 260);
      }
    }
  }

  for (const v of state.vehicles ?? []) {
    const vx = v.x - titan.x;
    const vz = v.z - titan.z;
    const dSq = vx * vx + vz * vz;
    if (dSq > range * range) continue;
    const dist = Math.sqrt(dSq) || 0.001;
    const dot = (vx * fwdX + vz * fwdZ) / dist;
    if (dist < 2.8 || dot >= cosHalfArc) {
      v.hp = Math.max(0, (v.hp ?? 140) - 300);
    }
  }

  // Cleave trees & shrubs along the slash arc
  const minX = Math.max(0, Math.floor(titan.x - range));
  const maxX = Math.min(state.gridSize - 1, Math.ceil(titan.x + range));
  const minZ = Math.max(0, Math.floor(titan.z - range));
  const maxZ = Math.min(state.gridSize - 1, Math.ceil(titan.z + range));
  for (let tz = minZ; tz <= maxZ; tz++) {
    for (let tx = minX; tx <= maxX; tx++) {
      const rx = tx - titan.x;
      const rz = tz - titan.z;
      const dSq = rx * rx + rz * rz;
      if (dSq > range * range || dSq < 2.0) continue;
      const dist = Math.sqrt(dSq);
      const dot = (rx * fwdX + rz * fwdZ) / dist;
      if (dot >= cosHalfArc) {
        const t = state.tiles[tz * state.gridSize + tx];
        if (t && (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush')) {
          t.resourceNode = 'none';
          t.resourceAmount = 0;
        }
      }
    }
  }

  damageWorldWonders(state, titan.x + fwdX * 5.0, titan.z + fwdZ * 5.0, 6.2, 260);
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
          // Deep central impact pit
          t.height = Math.max(1, Math.min(baseH, tileH) - 2);
          t.terrain = 'scorched';
          t.onFireTimer = allowFire && dSq <= 1.5 ? 5 : 0;
          if (!t.buildingId) {
            t.resourceNode = 'none';
            t.resourceAmount = 0;
          }
          syncGrid(t);
        } else if (effDSq <= 14.0) {
          // Stepped inner crater bowl
          t.height = Math.max(1, Math.min(baseH, tileH) - 1);
          t.terrain = 'scorched';
          t.onFireTimer = 0;
          if (!t.buildingId) {
            t.resourceNode = 'none';
            t.resourceAmount = 0;
          }
          syncGrid(t);
        } else if (effDSq <= 24.5 && !t.buildingId) {
          // Raised rocky crater rim
          t.height = Math.min(10, tileH + 1);
          t.terrain = effDSq <= 19.5 ? 'rock' : 'scorched';
          t.onFireTimer = 0;
          if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
            t.resourceNode = 'none';
            t.resourceAmount = 0;
          }
          syncGrid(t);
        } else if (!t.buildingId) {
          // Outer scorched shockwave ring
          t.terrain = 'scorched';
          if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
            t.resourceNode = 'none';
            t.resourceAmount = 0;
          }
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
  damageUnitsAndStructuresInRadius(state, targetX, targetZ, radius, 260, 210, 0.8);

  const allowFire = state.worldRules?.wildfireSpread !== false;
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
      if (dSq <= rSq * 0.62) {
        t.terrain = 'scorched';
        if (allowFire && dSq <= rSq * 0.35) {
          t.onFireTimer = Math.max(t.onFireTimer, 6);
        }
        if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
          t.resourceNode = 'none';
          t.resourceAmount = 0;
        }
      }
    }
  }
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
  titan.recoilLeft = Math.max(0, titan.recoilLeft - clampedDt * 4.5);
  titan.recoilRight = Math.max(0, titan.recoilRight - clampedDt * 4.5);

  // Update cursor aim & turret yaw tracking (during active / jumping / summoning)
  if (titan.phase !== 'exiting' && input.aimX !== null && input.aimZ !== null) {
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
      // Weighted acceleration up to inexorable conqueror march speed
      titan.moveSpeed = Math.min(TITAN_WALK_SPEED, titan.moveSpeed + clampedDt * 7.5);
      const moveAmt = titan.moveSpeed * clampedDt;
      titan.x = clamp(titan.x + mx * moveAmt, 2, state.gridSize - 3);
      titan.z = clamp(titan.z + mz * moveAmt, 2, state.gridSize - 3);

      // Ponderous hull rotation toward movement direction
      const desiredBodyYaw = Math.atan2(mx, mz);
      const bodyDiff = wrapAngleDiff(desiredBodyYaw, titan.bodyYaw);
      titan.bodyYaw += bodyDiff * Math.min(1, clampedDt * 3.4);

      // Slow, deliberate heavy walker stomp cadence
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
      // Crouching windup on the ground
      titan.y = getTitanGroundY(state, titan.x, titan.z);
    } else {
      const flightT = clamp((titan.jumpElapsed - titan.jumpWindup) / titan.jumpDuration, 0, 1);
      // Smooth horizontal interpolation
      titan.x = titan.jumpStartX + (titan.jumpTargetX - titan.jumpStartX) * flightT;
      titan.z = titan.jumpStartZ + (titan.jumpTargetZ - titan.jumpStartZ) * flightT;

      const endGroundY = getTitanGroundY(state, titan.jumpTargetX, titan.jumpTargetZ);
      const baseLineY = titan.jumpStartY + (endGroundY - titan.jumpStartY) * flightT;
      // Parabolic arc: 4 * t * (1 - t) peaks at 1.0 at t=0.5
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
  } else if (titan.phase === 'exiting') {
    titan.phaseTimer += clampedDt;
    titan.y = getTitanGroundY(state, titan.x, titan.z);
    if (titan.phaseTimer >= TITAN_EXIT_DURATION) {
      state.divineTitan = null;
      exited = true;
      return { exited: true, landed };
    }
  }

  // Advance slashes
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
