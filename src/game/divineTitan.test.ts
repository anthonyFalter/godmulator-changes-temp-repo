import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialSimulationState, castGodPower } from './simulation';
import {
  beginExitDivineTitan,
  stepDivineTitan,
  TITAN_EXIT_DURATION,
  TITAN_SUMMON_DURATION,
  triggerTitanLeap,
  triggerTitanOrbitalStrike,
  triggerTitanSlash,
} from './divineTitan';

function createFlatTestSim(gridSize = 64) {
  const sim = createInitialSimulationState(gridSize, 12345);
  sim.sandboxFreeMode = true;
  // Left half = elevated land (height 3), Right half = deep ocean (height 0)
  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = sim.tiles[z * gridSize + x];
      if (x < gridSize / 2) {
        tile.height = 3;
        tile.terrain = 'grass';
      } else {
        tile.height = 0;
        tile.terrain = 'deep_water';
      }
      tile.buildingId = null;
      tile.resourceNode = 'none';
      tile.resourceAmount = 0;
    }
  }
  sim.units = [];
  sim.buildings = [];
  sim.activeHazards = [];
  return sim;
}

describe('Divine Titan controllable god power', () => {
  it('summons a single controllable entity and prevents duplicate summons while active', () => {
    const sim = createFlatTestSim();
    const res1 = castGodPower(sim, 'divine_titan', 16, 16);
    assert.equal(res1.ok, true);
    assert.ok(sim.divineTitan);
    assert.equal(sim.divineTitan.phase, 'summoning');

    const res2 = castGodPower(sim, 'divine_titan', 20, 20);
    assert.equal(res2.ok, false);

    // Finish summoning phase
    for (let i = 0; i < 20; i++) {
      stepDivineTitan(sim, 0.05, {
        moveForward: 0,
        moveRight: 0,
        camYaw: 0,
        aimX: 24,
        aimZ: 16,
      });
    }
    assert.equal(sim.divineTitan.phase, 'active');
  });

  it('moves with WASD, rotates turret toward cursor, and creates walking shockwaves', () => {
    const sim = createFlatTestSim();
    castGodPower(sim, 'divine_titan', 16, 16);
    // Skip summon
    sim.divineTitan!.phase = 'active';

    const startX = sim.divineTitan!.x;
    const startZ = sim.divineTitan!.z;
    sim.divineTitan!.shockwaves = [];

    let sawStepShockwave = false;
    for (let i = 0; i < 30; i++) {
      stepDivineTitan(sim, 0.05, {
        moveForward: 1,
        moveRight: 0,
        camYaw: 0,
        aimX: 28,
        aimZ: 16,
      });
      if (sim.divineTitan!.shockwaves.some((sw) => sw.kind === 'step')) {
        sawStepShockwave = true;
      }
    }

    assert.ok(Math.hypot(sim.divineTitan!.x - startX, sim.divineTitan!.z - startZ) > 3);
    assert.equal(sawStepShockwave, true, 'Walking should generate footstep shockwaves');
    // Turret should track cursor (28, 16) independently of body moving along -Z
    const expectedTurretYaw = Math.atan2(28 - sim.divineTitan!.x, 16 - sim.divineTitan!.z);
    assert.ok(Math.abs(sim.divineTitan!.turretYaw - expectedTurretYaw) < 0.2);
    assert.ok(Math.abs(sim.divineTitan!.turretYaw - sim.divineTitan!.bodyYaw) > 0.5);
  });

  it('M1 triggers slash waves and damages targets in front', () => {
    const sim = createFlatTestSim();
    castGodPower(sim, 'divine_titan', 16, 16);
    sim.divineTitan!.phase = 'active';

    sim.units.push({
      id: 'foe_1',
      role: 'raider',
      species: 'orc',
      faction: 'hostile',
      x: 21,
      z: 16,
      hp: 200,
      maxHp: 200,
      state: 'idle',
      targetX: 21,
      targetZ: 16,
      attackCooldown: 0,
      statusEffects: { blessed: 0, cursed: 0, shielded: 0, frenzied: 0, poisoned: 0, frozen: 0, burning: 0 },
    } as any);

    const ok = triggerTitanSlash(sim, 22, 16);
    assert.equal(ok, true);
    assert.equal(sim.divineTitan!.slashes.length, 1);
    assert.equal(sim.units[0].state, 'ko');
  });

  it('Skill 1 summons orbital satellite strike, scorches ground, and damages foes', () => {
    const sim = createFlatTestSim();
    castGodPower(sim, 'divine_titan', 14, 16);
    sim.divineTitan!.phase = 'active';

    sim.units.push({
      id: 'foe_orb',
      role: 'raider',
      species: 'orc',
      faction: 'hostile',
      x: 22,
      z: 22,
      hp: 200,
      maxHp: 200,
      state: 'idle',
      targetX: 22,
      targetZ: 22,
      attackCooldown: 0,
      statusEffects: { blessed: 0, cursed: 0, shielded: 0, frenzied: 0, poisoned: 0, frozen: 0, burning: 0 },
    } as any);

    const fired = triggerTitanOrbitalStrike(sim, 22, 22);
    assert.equal(fired, true);
    assert.equal(sim.divineTitan!.orbitalStrikes.length, 1);
    assert.equal(sim.divineTitan!.orbitalStrikes[0].phase, 'lockon');

    // Step past lockonDuration (0.75s) into firing
    for (let i = 0; i < 25; i++) {
      stepDivineTitan(sim, 0.05, {
        moveForward: 0,
        moveRight: 0,
        camYaw: 0,
        aimX: 22,
        aimZ: 22,
      });
    }

    assert.equal(sim.divineTitan!.orbitalStrikes[0].phase, 'firing');
    assert.equal(sim.units[0].state, 'ko');
    assert.equal(sim.tiles[22 * sim.gridSize + 22].terrain, 'scorched');
  });

  it('Skill 2 jumps and carves a crater with massive shockwave when landing on land', () => {
    const sim = createFlatTestSim();
    castGodPower(sim, 'divine_titan', 12, 16);
    sim.divineTitan!.phase = 'active';

    const targetX = 18;
    const targetZ = 18;
    const heightBefore = sim.tiles[targetZ * sim.gridSize + targetX].height;
    assert.equal(heightBefore, 3);

    const jumped = triggerTitanLeap(sim, targetX, targetZ);
    assert.equal(jumped, true);
    assert.equal(sim.divineTitan!.phase, 'jumping');

    let peakY = 0;
    let landed = false;
    for (let i = 0; i < 40; i++) {
      const res = stepDivineTitan(sim, 0.05, {
        moveForward: 0,
        moveRight: 0,
        camYaw: 0,
        aimX: targetX,
        aimZ: targetZ,
      });
      if (sim.divineTitan && sim.divineTitan.y > peakY) peakY = sim.divineTitan.y;
      if (res.landed) landed = true;
    }

    assert.ok(peakY > 12, 'Titan should leap high into the air');
    assert.equal(landed, true);
    assert.equal(sim.divineTitan!.phase, 'active');
    const centerAfter = sim.tiles[targetZ * sim.gridSize + targetX];
    assert.ok(centerAfter.height < heightBefore, 'Landing on land should carve a deep crater');
    assert.equal(centerAfter.terrain, 'scorched');
    assert.ok(sim.divineTitan!.shockwaves.some((sw) => sw.kind === 'slam'));
  });

  it('Skill 2 triggers a massive tsunami when landing on water/sea', () => {
    const sim = createFlatTestSim();
    castGodPower(sim, 'divine_titan', 28, 24);
    sim.divineTitan!.phase = 'active';

    // Leap onto the deep_water right half (x=44, z=24)
    const jumped = triggerTitanLeap(sim, 44, 24);
    assert.equal(jumped, true);

    for (let i = 0; i < 40; i++) {
      stepDivineTitan(sim, 0.05, {
        moveForward: 0,
        moveRight: 0,
        camYaw: 0,
        aimX: 44,
        aimZ: 24,
      });
    }

    assert.ok(
      sim.activeHazards.some((h) => h.kind === 'tsunami_wave'),
      'Landing on water/sea must trigger a tsunami_wave hazard',
    );
    assert.ok(sim.divineTitan!.shockwaves.some((sw) => sw.kind === 'tsunami_slam'));
  });

  it('Exit button sequence plays sky beam extraction and vanishes the entity cleanly', () => {
    const sim = createFlatTestSim();
    castGodPower(sim, 'divine_titan', 16, 16);
    sim.divineTitan!.phase = 'active';

    const startedExit = beginExitDivineTitan(sim);
    assert.equal(startedExit, true);
    assert.equal(sim.divineTitan!.phase, 'exiting');
    assert.ok(sim.divineTitan!.shockwaves.some((sw) => sw.kind === 'exit'));

    let exited = false;
    const steps = Math.ceil((TITAN_EXIT_DURATION + 0.2) / 0.05);
    for (let i = 0; i < steps; i++) {
      const res = stepDivineTitan(sim, 0.05, {
        moveForward: 0,
        moveRight: 0,
        camYaw: 0,
        aimX: null,
        aimZ: null,
      });
      if (res.exited) {
        exited = true;
        break;
      }
    }

    assert.equal(exited, true);
    assert.equal(sim.divineTitan, null);
    assert.ok(TITAN_SUMMON_DURATION > 0);
  });
});
