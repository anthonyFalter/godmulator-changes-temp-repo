import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialSimulationState, castGodPower } from './simulation';
import {
  beginExitDivineTitan,
  stepDivineTitan,
  TITAN_DEATH_BEAM_COMBINE,
  TITAN_DEATH_BEAM_DETONATE,
  TITAN_DEATH_BEAM_FIRE,
  TITAN_EXIT_DURATION,
  TITAN_SUMMON_DURATION,
  triggerTitanDeathBeam,
  triggerTitanLeap,
  triggerTitanMissileBarrage,
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
    for (let i = 0; i < 45; i++) {
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
    const centerTile = sim.tiles[22 * sim.gridSize + 22];
    assert.equal(centerTile.height, 0, 'Orbital laser core should melt land down to lava');
    assert.equal(centerTile.waterKind, 'lava', 'Orbital laser core should melt land into lava');
    const rimTile = sim.tiles[22 * sim.gridSize + 26];
    assert.ok(rimTile.onFireTimer > 0, 'Orbital laser rim should ignite surrounding land');
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

  it('Skill 3 Death Beam locks controls, combines cannons, fires 4s beam, and detonates with pixelated mushroom cloud, firestorm, and irradiation', () => {
    const sim = createFlatTestSim();
    castGodPower(sim, 'divine_titan', 10, 16);
    sim.divineTitan!.phase = 'active';

    const startX = sim.divineTitan!.x;
    const startZ = sim.divineTitan!.z;
    const targetX = 24;
    const targetZ = 16;
    const heightBefore = sim.tiles[targetZ * sim.gridSize + targetX].height;

    const ok = triggerTitanDeathBeam(sim, targetX, targetZ);
    assert.equal(ok, true);
    assert.equal(sim.divineTitan!.phase, 'death_beam');
    assert.equal(sim.divineTitan!.deathBeam!.subPhase, 'combining');
    assert.equal(sim.divineTitan!.deathBeam!.fireDuration, 4.0);

    const lockedYaw = sim.divineTitan!.turretYaw;

    // Step through combining phase while passing WASD + different cursor aim — verify controls stay locked!
    const combineSteps = Math.ceil((TITAN_DEATH_BEAM_COMBINE + 0.1) / 0.05);
    for (let i = 0; i < combineSteps; i++) {
      stepDivineTitan(sim, 0.05, {
        moveForward: 1,
        moveRight: 1,
        camYaw: 0,
        aimX: 2,
        aimZ: 2,
      });
    }

    assert.equal(sim.divineTitan!.x, startX, 'WASD must be locked during Death Beam cutscene');
    assert.equal(sim.divineTitan!.z, startZ, 'WASD must be locked during Death Beam cutscene');
    assert.equal(sim.divineTitan!.turretYaw, lockedYaw, 'Cannon aim must be locked during Death Beam cutscene');
    assert.equal(sim.divineTitan!.deathBeam!.subPhase, 'firing');

    // Step through the 4-second firing phase into detonation
    const fireSteps = Math.ceil((TITAN_DEATH_BEAM_FIRE + 0.15) / 0.05);
    for (let i = 0; i < fireSteps; i++) {
      stepDivineTitan(sim, 0.05, {
        moveForward: 1,
        moveRight: 0,
        camYaw: 0,
        aimX: 2,
        aimZ: 2,
      });
    }

    assert.equal(sim.divineTitan!.deathBeam!.subPhase, 'detonating');
    assert.equal(sim.divineTitan!.mushroomClouds.length, 1, 'Must spawn towering mushroom cloud on detonation');
    assert.ok(sim.divineTitan!.mushroomClouds[0].maxHeight >= 24);
    const blastTile = sim.tiles[targetZ * sim.gridSize + targetX];
    assert.ok(blastTile.height < heightBefore, 'Death Beam detonation must carve a massive crater');
    assert.ok(blastTile.onFireTimer > 0, 'Death Beam detonation must ignite raging fires');
    assert.ok(blastTile.cursedTimer > 0, 'Death Beam detonation must irradiate the surrounding blast zone');
    assert.ok(
      sim.activeHazards.some((h) => h.kind === 'acid_cloud'),
      'Death Beam detonation must spawn lingering radioactive fallout clouds',
    );

    // Step through detonation climax back to active control
    const detSteps = Math.ceil((TITAN_DEATH_BEAM_DETONATE + 0.1) / 0.05);
    for (let i = 0; i < detSteps; i++) {
      stepDivineTitan(sim, 0.05, {
        moveForward: 0,
        moveRight: 0,
        camYaw: 0,
        aimX: null,
        aimZ: null,
      });
    }
    assert.equal(sim.divineTitan!.phase, 'active');
    assert.equal(sim.divineTitan!.deathBeam, null);
  });

  it('Skill 4 Missile Barrage launches 18 arching missiles that detonate around target', () => {
    const sim = createFlatTestSim();
    castGodPower(sim, 'divine_titan', 12, 16);
    sim.divineTitan!.phase = 'active';

    const ok = triggerTitanMissileBarrage(sim, 22, 18);
    assert.equal(ok, true);
    assert.equal(sim.divineTitan!.missileSalvoRemaining, 18);

    let peakMissilesInFlight = 0;
    for (let i = 0; i < 65; i++) {
      stepDivineTitan(sim, 0.05, {
        moveForward: 0,
        moveRight: 0,
        camYaw: 0,
        aimX: 22,
        aimZ: 18,
      });
      if (sim.divineTitan!.missiles.length > peakMissilesInFlight) {
        peakMissilesInFlight = sim.divineTitan!.missiles.length;
      }
    }

    assert.ok(peakMissilesInFlight >= 10, 'Multiple barrage missiles should be airborne simultaneously');
    assert.equal(sim.divineTitan!.missileSalvoRemaining, 0);
    assert.equal(sim.divineTitan!.missiles.length, 0, 'All missiles should have landed and detonated');
  });

  it('Death Beam mushroom cloud detonation and Orbital Strike impact emit pendingImpactFrame events', () => {
    const sim = createFlatTestSim();
    castGodPower(sim, 'divine_titan', 14, 14);
    sim.divineTitan!.phase = 'active';
    sim.divineTitan!.pendingImpactFrame = null;

    const readImpactFrame = () => sim.divineTitan?.pendingImpactFrame ?? null;

    // 1. Orbital Strike impact
    assert.equal(triggerTitanOrbitalStrike(sim, 22, 18), true);
    let orbitalImpact = readImpactFrame();
    for (let i = 0; i < 40; i++) {
      stepDivineTitan(sim, 0.05, { moveForward: 0, moveRight: 0, camYaw: 0, aimX: 22, aimZ: 18 });
      orbitalImpact = readImpactFrame();
      if (orbitalImpact) break;
    }
    assert.ok(orbitalImpact, 'Orbital Strike must emit pendingImpactFrame on beam impact');
    assert.equal(orbitalImpact.kind, 'orbital_strike');
    assert.ok(orbitalImpact.duration >= 0.14 && orbitalImpact.hitstop >= 0.05);

    // 2. Death Beam mushroom cloud detonation
    sim.divineTitan!.pendingImpactFrame = null;
    let mushroomImpact = readImpactFrame();
    assert.equal(triggerTitanDeathBeam(sim, 24, 20), true);
    for (let i = 0; i < 200; i++) {
      stepDivineTitan(sim, 0.05, { moveForward: 0, moveRight: 0, camYaw: 0, aimX: null, aimZ: null });
      mushroomImpact = readImpactFrame();
      if (mushroomImpact) break;
    }
    assert.ok(mushroomImpact, 'Death Beam mushroom cloud detonation must emit pendingImpactFrame');
    assert.equal(mushroomImpact.kind, 'death_beam_mushroom');
    assert.ok(mushroomImpact.duration >= 0.18 && mushroomImpact.hitstop >= 0.07);
  });

  it('Death Beam launch range scales to near-world coverage beyond 38 tiles', () => {
    const sim = createFlatTestSim(72);
    castGodPower(sim, 'divine_titan', 6, 6);
    sim.divineTitan!.phase = 'active';
    assert.equal(triggerTitanDeathBeam(sim, 66, 66), true);
    const db = sim.divineTitan!.deathBeam!;
    assert.ok(db, 'Death Beam state should be created');
    const dist = Math.hypot(db.targetX - sim.divineTitan!.x, db.targetZ - sim.divineTitan!.z);
    assert.ok(dist > 80, `Expected near-world coverage (> 80 tiles), got ${dist.toFixed(1)}`);
    assert.ok(Math.abs(db.targetX - 66) < 0.5 && Math.abs(db.targetZ - 66) < 0.5);
  });
});
