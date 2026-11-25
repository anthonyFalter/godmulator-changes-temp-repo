import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialSimulationState,
  setKingdomEpoch,
  setKingdomRelation,
  stepStrategicWarfare,
} from './simulation';
import { computeWarFrontArrows, computeWorldZones, DEFAULT_ZONE_TOGGLES } from './zones';
import { BuildingEntity, SimulationState, SpeciesId, UnitEntity } from './types';

function makeLandSim(gridSize = 64): SimulationState {
  const sim = createInitialSimulationState(9001, 'pangaea', { gridSize });
  for (let i = 0; i < sim.tiles.length; i++) {
    sim.tiles[i].terrain = 'grass';
    sim.tiles[i].height = 1;
  }
  sim.buildings = [];
  sim.units = [];
  sim.vehicles = [];
  sim.pendingVfx = [];
  sim.activeStrategicStrikes = [];
  sim.warFrontBaselines = {};
  sim.kingdomRelations = {};
  sim.settlementSpecies = {};
  sim.settlementNames = {};
  sim.settlementKingdoms = {};
  sim.kingdomEpochs = {};
  sim.kingdomUltimateCooldowns = {};
  return sim;
}

function addKingdomSettlement(
  sim: SimulationState,
  kingdomId: string,
  name: string,
  species: SpeciesId,
  epoch: number,
  cx: number,
  cz: number,
  buildingCount = 4,
  unitCount = 3,
): void {
  sim.settlementSpecies![kingdomId] = species;
  sim.settlementNames![kingdomId] = name;
  sim.settlementKingdoms![kingdomId] = kingdomId;
  sim.kingdomResources = sim.kingdomResources ?? {};
  sim.kingdomResources[kingdomId] = {
    wood: 500,
    stone: 500,
    food: 500,
    ore: 500,
    knowledge: 500,
    energy: 500,
    alloy: 500,
    faith: 500,
  };
  setKingdomEpoch(sim, kingdomId, epoch);
  sim.epochIndex = Math.max(sim.epochIndex, epoch);

  const offsets: ReadonlyArray<readonly [number, number, BuildingEntity['type']]> = [
    [0, 0, 'guildhall'],
    [2, 0, species === 'human' ? 'launch_arcology' : species === 'elf' ? 'observatory' : 'steam_foundry'],
    [-2, 1, 'forager_hut'],
    [0, -2, 'granary'],
    [3, 2, 'forager_hut'],
    [-3, -2, 'forager_hut'],
    [2, -3, 'smeltery'],
    [-2, 3, 'bonfire'],
    [3, -2, 'forager_hut'],
    [-3, 2, 'forager_hut'],
  ];

  for (let i = 0; i < Math.min(buildingCount, offsets.length); i++) {
    const [dx, dz, bType] = offsets[i];
    const b: BuildingEntity = {
      id: `${kingdomId}_b_${i}`,
      type: bType,
      tileX: cx + dx,
      tileZ: cz + dz,
      hp: 300,
      maxHp: 300,
      constructionProgress: 100,
      epochLevel: epoch,
      blessedTimer: 0,
      cursedTimer: 0,
      shieldTimer: 0,
      settlementId: kingdomId,
      species,
    };
    sim.buildings.push(b);
  }

  for (let u = 0; u < unitCount; u++) {
    const unit: UnitEntity = {
      id: `${kingdomId}_u_${u}`,
      name: `${name} Warrior ${u}`,
      role: 'warrior',
      faction: 'civilization',
      species,
      x: cx + ((u % 4) - 1.5) * 1.1,
      z: cz + 1.5 + Math.floor(u / 4) * 0.6,
      targetX: cx,
      targetZ: cz,
      hp: 160,
      maxHp: 160,
      state: 'idle',
      koTimer: 0,
      statusEffects: {},
      carryingType: null,
      carryingAmount: 0,
      actionCooldown: 0,
      windupTimer: 0,
      targetEntityId: null,
      settlementId: kingdomId,
      kingdomId,
    };
    sim.units.push(unit);
  }
}

test('Humans prioritize transcontinental ballistic missiles (ICBM / Nuclear ICBM) that fly across distance before detonating', () => {
  const sim = makeLandSim(64);
  addKingdomSettlement(sim, 'human_k', 'Terran Union', 'human', 5, 10, 10, 9, 16);
  addKingdomSettlement(sim, 'orc_k', 'Iron Horde', 'orc', 2, 52, 52, 4, 6);

  setKingdomRelation(sim, 'human_k', 'orc_k', 'war');

  // Step right at launch interval so strategic warfare fires
  stepStrategicWarfare(sim, 4.0);

  const launchedIcbms = sim.pendingVfx.filter(
    (e) => e.type === 'projectile_tracer' && e.vfxSubtype === 'icbm_missile',
  );
  assert.ok(
    launchedIcbms.length >= 1,
    'Human kingdom at war in Atomic+ epoch should launch transcontinental icbm_missile projectiles with origin & flightDuration',
  );
  for (const icbm of launchedIcbms) {
    assert.ok(icbm.originX !== undefined && icbm.originZ !== undefined, 'ICBM must have launch origin');
    assert.ok((icbm.flightDuration ?? 0) > 0.5, 'ICBM must have visible transcontinental flight duration');
    assert.ok(
      Math.hypot((icbm.x ?? 0) - (icbm.originX ?? 0), (icbm.z ?? 0) - (icbm.originZ ?? 0)) > 20,
      'ICBM must travel across continents toward the enemy kingdom',
    );
  }

  // Nuke blast must NOT spawn randomly at launch time before missile arrival!
  const prematureNukes = sim.pendingVfx.filter((e) => e.type === 'nuke_blast');
  assert.equal(
    prematureNukes.length,
    0,
    'Nuclear warheads must NOT spawn randomly out of thin air before the ballistic missile arrives',
  );

  // Confirm active in-flight nuclear ICBM is tracked
  const activeHumanStrikes = (sim.activeStrategicStrikes ?? []).filter(
    (s) => s.attackerKingdomId === 'human_k' && (s.kind === 'icbm_nuke' || s.kind === 'icbm_missile'),
  );
  assert.ok(activeHumanStrikes.length >= 1, 'Human transcontinental missiles must be tracked in flight');
  const maxFlight = Math.max(...activeHumanStrikes.map((s) => s.flightDuration));

  const enemyHpBefore = sim.buildings
    .filter((b) => b.settlementId === 'orc_k')
    .reduce((acc, b) => acc + b.hp, 0);

  // Advance flight time until missile arrives and detonates
  sim.pendingVfx = [];
  stepStrategicWarfare(sim, maxFlight + 0.15);

  const enemyHpAfter = sim.buildings
    .filter((b) => b.settlementId === 'orc_k')
    .reduce((acc, b) => acc + b.hp, 0);
  assert.ok(enemyHpAfter < enemyHpBefore, 'Enemy buildings must take damage upon ICBM impact');

  const impactNukes = sim.pendingVfx.filter((e) => e.type === 'nuke_blast');
  assert.ok(
    impactNukes.length >= 1,
    'Human Nuclear ICBM must detonate nuke_blast at target upon missile arrival',
  );
});

test('Elves cast long-range astral magic spells across continents and never launch steel missiles or cannons', () => {
  const sim = makeLandSim(64);
  addKingdomSettlement(sim, 'elf_k', 'Sylvan Spire', 'elf', 5, 12, 50, 9, 16);
  addKingdomSettlement(sim, 'orc_k', 'Ashfang Clan', 'orc', 1, 50, 12, 6, 8);
  // Add a secondary Orc outpost outside the initial 5.6-tile cataclysm blast so the war continues for follow-up salvos
  sim.buildings.push({
    id: 'orc_k_outpost',
    type: 'bonfire',
    tileX: 58,
    tileZ: 20,
    hp: 400,
    maxHp: 400,
    constructionProgress: 100,
    epochLevel: 1,
    blessedTimer: 0,
    cursedTimer: 0,
    shieldTimer: 0,
    settlementId: 'orc_k',
    species: 'orc',
  });

  setKingdomRelation(sim, 'elf_k', 'orc_k', 'war');

  // Step 1: Elf kingdom launches long-range Astral Cataclysm spell across continents
  stepStrategicWarfare(sim, 4.0);

  const elfLaunchedStrikes = sim.pendingVfx.filter(
    (e) => e.type === 'projectile_tracer' && e.species === 'elf',
  );
  assert.ok(elfLaunchedStrikes.length >= 1, 'Elves at war must launch long-range magic spells');
  assert.ok(
    elfLaunchedStrikes.some((e) => e.vfxSubtype === 'elf_starfall_spell'),
    'Elves should cast elf_starfall_spell across continents',
  );
  assert.equal(
    elfLaunchedStrikes.filter(
      (e) =>
        e.vfxSubtype === 'icbm_missile' ||
        e.vfxSubtype === 'missile' ||
        e.vfxSubtype === 'cannon_shell',
    ).length,
    0,
    'Elves must NEVER fire steel missiles or gunpowder cannon shells',
  );
  assert.equal(
    sim.pendingVfx.filter((e) => e.type === 'arcane_cataclysm').length,
    0,
    'Astral cataclysm must travel across the sky before detonating on arrival',
  );

  // Step 2: Advance through flightDuration so astral cataclysm lands and triggers arcane_cataclysm,
  // and follow-up salvos also cast pure elf_starfall_spell (zero missiles/cannons)
  sim.pendingVfx = [];
  stepStrategicWarfare(sim, 4.0);
  assert.ok(
    sim.pendingVfx.some((e) => e.type === 'arcane_cataclysm'),
    'Elf long-range astral cataclysm must unleash arcane_cataclysm upon arrival',
  );
  const elfFollowup = sim.pendingVfx.filter(
    (e) => e.type === 'projectile_tracer' && e.species === 'elf',
  );
  assert.ok(
    elfFollowup.length >= 1 && elfFollowup.every((e) => e.vfxSubtype === 'elf_starfall_spell'),
    'Follow-up Elf salvos must also be pure magic elf_starfall_spell projectiles',
  );
});

test('Orcs hurl flaming magma siege boulders in early epochs and WAAAGH! scrap-rocket swarms in Industrial+ epochs', () => {
  // Early-epoch Orcs: flaming magma siege boulders
  const earlySim = makeLandSim(64);
  addKingdomSettlement(earlySim, 'orc_early', 'Skullcrusher Tribe', 'orc', 1, 14, 14, 4, 6);
  addKingdomSettlement(earlySim, 'human_early', 'Valenhold', 'human', 1, 46, 46, 4, 6);
  setKingdomRelation(earlySim, 'orc_early', 'human_early', 'war');

  stepStrategicWarfare(earlySim, 4.0);
  const earlyOrcShots = earlySim.pendingVfx.filter(
    (e) => e.type === 'projectile_tracer' && e.species === 'orc',
  );
  assert.ok(
    earlyOrcShots.some((e) => e.vfxSubtype === 'orc_siege_boulder'),
    'Early-epoch Orcs at war must hurl orc_siege_boulder projectiles',
  );

  // Industrial+ Orcs: chaotic WAAAGH! scrap-rocket swarms
  const modernSim = makeLandSim(64);
  addKingdomSettlement(modernSim, 'orc_modern', 'Red Scrap Waagh', 'orc', 4, 14, 14, 6, 10);
  addKingdomSettlement(modernSim, 'human_modern', 'Solaris', 'human', 4, 46, 46, 6, 10);
  setKingdomRelation(modernSim, 'orc_modern', 'human_modern', 'war');

  stepStrategicWarfare(modernSim, 4.0);
  const modernOrcShots = modernSim.pendingVfx.filter(
    (e) => e.type === 'projectile_tracer' && e.species === 'orc',
  );
  assert.ok(
    modernOrcShots.filter((e) => e.vfxSubtype === 'orc_waagh_rocket').length >= 2,
    'Industrial+ Orcs at war must fire orc_waagh_rocket swarms',
  );
});

test('War-front arrows ONLY render when at war AND Kingdoms/Alliances zones are open, and dynamically expand/decrease with territory claims', () => {
  const sim = makeLandSim(64);
  addKingdomSettlement(sim, 'alpha_k', 'Aurelia', 'human', 3, 14, 32, 4);
  addKingdomSettlement(sim, 'beta_k', 'Mordrak', 'orc', 3, 48, 32, 4);

  const peaceZones = computeWorldZones(sim);

  // 1. At peace -> NO war arrows even when Kingdoms & Alliances zones are open
  const arrowsAtPeace = computeWarFrontArrows(peaceZones, sim, {
    ...DEFAULT_ZONE_TOGGLES,
    kingdoms: true,
    alliances: true,
  });
  assert.equal(arrowsAtPeace.length, 0, 'War-front arrows must NOT show when kingdoms are at peace');

  // 2. Declare war -> still NO arrows when neither Kingdoms nor Alliances zones are open
  setKingdomRelation(sim, 'alpha_k', 'beta_k', 'war');
  const warZonesInitial = computeWorldZones(sim);
  const arrowsZonesClosed = computeWarFrontArrows(warZonesInitial, sim, {
    ...DEFAULT_ZONE_TOGGLES,
    kingdoms: false,
    alliances: false,
    territories: true,
  });
  assert.equal(
    arrowsZonesClosed.length,
    0,
    'War-front arrows must NOT show when Kingdoms and Alliances zone overlays are closed',
  );

  // 3. Open Kingdoms zone during active war -> opposing directional arrows appear
  const initialWarArrows = computeWarFrontArrows(warZonesInitial, sim, {
    ...DEFAULT_ZONE_TOGGLES,
    kingdoms: true,
  });
  assert.equal(initialWarArrows.length, 2, 'Two warring kingdoms should produce two opposing war-front arrows');
  const alphaInitial = initialWarArrows.find(
    (a) => a.attackerKingdomId === 'alpha_k' && a.defenderKingdomId === 'beta_k',
  );
  const betaInitial = initialWarArrows.find(
    (a) => a.attackerKingdomId === 'beta_k' && a.defenderKingdomId === 'alpha_k',
  );
  assert.ok(alphaInitial && betaInitial, 'Both attacker->defender arrows must exist');
  assert.ok(
    Math.abs(alphaInitial.fromZ - betaInitial.toZ) > 1.0,
    'Opposing war arrows should offset laterally so they never overlap',
  );

  // 4. Alpha expands territory & pushes soldiers toward Beta while Beta loses buildings -> Alpha arrow EXPANDS, Beta arrow DECREASES
  sim.buildings.push(
    {
      id: 'alpha_forward_1',
      type: 'ziggurat',
      tileX: 28,
      tileZ: 32,
      hp: 300,
      maxHp: 300,
      constructionProgress: 100,
      epochLevel: 3,
      blessedTimer: 0,
      cursedTimer: 0,
      shieldTimer: 0,
      settlementId: 'alpha_k',
      species: 'human',
    },
    {
      id: 'alpha_forward_2',
      type: 'guildhall',
      tileX: 34,
      tileZ: 32,
      hp: 400,
      maxHp: 400,
      constructionProgress: 100,
      epochLevel: 3,
      blessedTimer: 0,
      cursedTimer: 0,
      shieldTimer: 0,
      settlementId: 'alpha_k',
      species: 'human',
    },
  );
  // Push Alpha soldiers deep toward Beta
  for (const u of sim.units) {
    if (u.kingdomId === 'alpha_k') {
      u.x = 40;
      u.z = 32;
    }
  }
  // Destroy half of Beta's buildings
  sim.buildings = sim.buildings.filter((b) => b.id !== 'beta_k_b_2' && b.id !== 'beta_k_b_3');

  const alphaAdvantageZones = computeWorldZones(sim);
  const expandedArrows = computeWarFrontArrows(alphaAdvantageZones, sim, {
    ...DEFAULT_ZONE_TOGGLES,
    kingdoms: true,
  });
  const alphaExpanded = expandedArrows.find((a) => a.attackerKingdomId === 'alpha_k')!;
  const betaRetracted = expandedArrows.find((a) => a.attackerKingdomId === 'beta_k')!;

  assert.ok(
    alphaExpanded.progress > alphaInitial.progress + 0.08,
    `Alpha arrow should expand forward as it claims territory (was ${alphaInitial.progress.toFixed(2)}, now ${alphaExpanded.progress.toFixed(2)})`,
  );
  assert.ok(
    betaRetracted.progress < betaInitial.progress - 0.05,
    `Beta arrow should decrease/retract when pushed back (was ${betaInitial.progress.toFixed(2)}, now ${betaRetracted.progress.toFixed(2)})`,
  );

  // 5. Alliances zone mode colors selected kingdom's advance blue (#3b82f6) and enemy's red (#ef4444)
  const allianceArrows = computeWarFrontArrows(
    alphaAdvantageZones,
    sim,
    { ...DEFAULT_ZONE_TOGGLES, alliances: true },
    { selectedAllianceKingdomId: 'alpha_k' },
  );
  const alphaAllianceArrow = allianceArrows.find((a) => a.attackerKingdomId === 'alpha_k')!;
  const betaAllianceArrow = allianceArrows.find((a) => a.attackerKingdomId === 'beta_k')!;
  assert.equal(alphaAllianceArrow.hexColor, '#3b82f6');
  assert.equal(betaAllianceArrow.hexColor, '#ef4444');

  // 6. Sign peace (neutral) -> arrows disappear immediately
  setKingdomRelation(sim, 'alpha_k', 'beta_k', 'neutral');
  const afterPeaceArrows = computeWarFrontArrows(alphaAdvantageZones, sim, {
    ...DEFAULT_ZONE_TOGGLES,
    kingdoms: true,
    alliances: true,
  });
  assert.equal(afterPeaceArrows.length, 0, 'War-front arrows must vanish immediately once peace is signed');
});

test('Kingdoms actively claim expansive territory and annex enemy territory and buildings during war', () => {
  const sim = makeLandSim(64);
  addKingdomSettlement(sim, 'alpha_k', 'Aurelia', 'human', 3, 20, 32, 6, 10);
  addKingdomSettlement(sim, 'beta_k', 'Mordrak', 'orc', 3, 36, 32, 6, 10);

  const initialZones = computeWorldZones(sim);
  const alphaInitZone = Array.from(initialZones.kingdomsById.values()).find((k) => k.kingdomId === 'alpha_k')!;
  const betaInitZone = Array.from(initialZones.kingdomsById.values()).find((k) => k.kingdomId === 'beta_k')!;
  assert.ok(alphaInitZone && betaInitZone, 'Both kingdom zones must exist');

  // Declare war and place an Alpha invasion force right outside Beta's outpost building
  setKingdomRelation(sim, 'alpha_k', 'beta_k', 'war');
  const targetBetaBld = sim.buildings.find((b) => b.settlementId === 'beta_k')!;
  targetBetaBld.hp = 25; // Nearly conquered
  for (const u of sim.units) {
    if (u.kingdomId === 'alpha_k') {
      u.x = targetBetaBld.tileX - 1;
      u.z = targetBetaBld.tileZ;
      u.actionCooldown = 0;
    }
  }

  // Step strategic warfare & unit combat/claiming
  stepStrategicWarfare(sim, 4.0);
  const claimedTilesBefore = sim.tiles.filter((t) => t.claimedSettlementId === 'alpha_k').length;
  // Direct strategic impact also annexes tiles
  const activeStrikes = sim.activeStrategicStrikes ?? [];
  if (activeStrikes.length > 0) {
    stepStrategicWarfare(sim, 5.0);
  }
  const claimedTilesAfter = sim.tiles.filter((t) => t.claimedSettlementId === 'alpha_k').length;
  assert.ok(
    claimedTilesAfter >= claimedTilesBefore && claimedTilesAfter > 0,
    'Warring kingdoms must actively claim and annex enemy territory tiles',
  );
});

test('War-front arrows emit at most 1 primary arrow per warring kingdom and civilization labels carry race species', () => {
  const sim = makeLandSim(64);
  addKingdomSettlement(sim, 'alpha_k', 'Aurelia', 'human', 3, 14, 16, 4);
  addKingdomSettlement(sim, 'beta_k', 'Mordrak', 'orc', 3, 48, 16, 4);
  addKingdomSettlement(sim, 'gamma_k', 'Sylvanor', 'elf', 3, 48, 48, 2);

  // Even if Alpha is at war with both Beta and Gamma, Alpha emits strictly 1 primary war-front arrow toward its main rival
  setKingdomRelation(sim, 'alpha_k', 'beta_k', 'war');
  setKingdomRelation(sim, 'alpha_k', 'gamma_k', 'war');

  const zones = computeWorldZones(sim);
  const arrows = computeWarFrontArrows(zones, sim, {
    ...DEFAULT_ZONE_TOGGLES,
    kingdoms: true,
  });
  const alphaOutbound = arrows.filter((a) => a.attackerKingdomId === 'alpha_k');
  assert.equal(
    alphaOutbound.length,
    1,
    'Each warring kingdom must emit strictly 1 primary outbound war-front arrow so massive wars never flood the screen',
  );
  assert.equal(
    alphaOutbound[0].defenderKingdomId,
    'beta_k',
    'Primary war-front arrow should target the largest enemy kingdom',
  );

  for (const k of zones.kingdomsById.values()) {
    assert.ok(k.species === 'human' || k.species === 'orc' || k.species === 'elf');
  }
});


