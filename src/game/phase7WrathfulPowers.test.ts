import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialSimulationState,
  executeGodPowerImpact,
  getTile,
  placeBuilding,
  spawnUnit,
  stepSimulation,
} from './simulation';
import type { SimulationState, WorldWonder } from './types';

function makeFlatState(seed = 'PHASE7-TEST', gridSize = 48): SimulationState {
  const state = createInitialSimulationState(gridSize, seed);
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  state.units = [];
  state.buildings = [];
  state.vehicles = [];
  state.activeHazards = [];
  state.worldWonders = [];
  for (const t of state.tiles) {
    t.height = 2;
    t.terrain = 'grass';
    t.resourceNode = 'none';
    t.resourceAmount = 0;
    t.buildingId = null;
    t.onFireTimer = 0;
    t.cursedTimer = 0;
    t.blessedTimer = 0;
    t.devastatedTimer = 0;
    delete t.liquidLevel;
    delete t.liquidKind;
    delete t.waterKind;
    delete t.isBridge;
    delete t.farmPlotKind;
    t.farmSettlementId = undefined;
  }
  return state;
}

function makeWonder(id: string, tileX: number, tileZ: number, shieldTimer = 0): WorldWonder {
  return {
    id,
    kingdomId: 's1',
    settlementId: 's1',
    species: 'human',
    name: 'Great Pyramid',
    tileX,
    tileZ,
    builtYear: 1,
    bonusSummary: '+Knowledge',
    hp: 2600,
    maxHp: 2600,
    constructionProgress: 100,
    shieldTimer,
  };
}

function makeVehicle(id: string, x: number, z: number, hp = 200) {
  return {
    id,
    type: 'car',
    species: 'human',
    settlementId: 's1',
    epochLevel: 2,
    x,
    y: 0.2,
    z,
    heading: 0,
    pitch: 0,
    bank: 0,
    speed: 0.01,
    path: [
      { x, z },
      { x: x + 0.1, z },
    ],
    pathIndex: 0,
    variantSeed: 1,
    hp,
    maxHp: hp,
    passengerIds: [],
  } as unknown as NonNullable<SimulationState['vehicles']>[number];
}

test('Phase 7 [P-C2, H3]: saturated void_goo island keeps killing units and damaging buildings & World Wonders', () => {
  const state = makeFlatState('PHASE7-VOIDGOO', 48);
  for (const t of state.tiles) {
    t.height = 0;
    t.terrain = 'deep_water';
  }
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const t = getTile(state, 24 + dx, 24 + dz)!;
      t.height = 2;
      t.terrain = 'void_goo';
    }
  }

  placeBuilding(state, 'bonfire', 24, 24);
  const b = state.buildings[0];
  assert.ok(b);
  const bHpStart = b.hp;

  const wonder = makeWonder('w1', 25, 24);
  state.worldWonders = [wonder];

  // Step several ticks so the frontier empties completely (no uninfected land neighbors)
  for (let i = 0; i < 6; i++) {
    stepSimulation(state, 0.25);
  }
  const bHpAfterFirstPass = b.hp;
  const wHpAfterFirstPass = wonder.hp!;
  assert.ok(bHpAfterFirstPass < bHpStart, 'building on saturated void_goo should take damage');
  assert.ok(wHpAfterFirstPass < 2600, 'World Wonder on saturated void_goo should take damage');

  // Spawn a new unit on the saturated void_goo island and step again
  const walker = spawnUnit(state, 'villager', 23, 24, true).unit!;
  assert.ok(walker);
  for (let i = 0; i < 4; i++) {
    stepSimulation(state, 0.25);
  }
  assert.equal(walker.state, 'ko', 'unit walking onto saturated void_goo must still be killed into a wisp');
  assert.ok(b.hp < bHpAfterFirstPass, 'building must continue taking damage after frontier empties');
  assert.ok(wonder.hp! < wHpAfterFirstPass, 'World Wonder must continue taking damage after frontier empties');
});

test('Phase 7 [P-C3, H3]: sinkhole_collapse spares ground under shielded buildings & Wonders, clears isBridge, and damages vehicles', () => {
  const state = makeFlatState('PHASE7-SINKHOLE', 48);
  placeBuilding(state, 'bonfire', 24, 24);
  const shieldedBld = state.buildings[0];
  shieldedBld.shieldTimer = 20;

  const shieldedWonder = makeWonder('w-shield', 25, 24, 20);
  const openWonder = makeWonder('w-open', 23, 24, 0);
  state.worldWonders = [shieldedWonder, openWonder];

  const bridgeTile = getTile(state, 24, 25)!;
  bridgeTile.height = 0;
  bridgeTile.terrain = 'stone_road';
  bridgeTile.isBridge = true;

  const veh = makeVehicle('v1', 24, 23, 200);
  state.vehicles = [veh];

  state.activeHazards.push({
    id: 'haz-sink',
    kind: 'sinkhole_collapse',
    x: 24,
    z: 24,
    radius: 4,
    remaining: 1.0,
    duration: 2.0,
    tickTimer: 0,
    exploded: false,
  });

  stepSimulation(state, 0.25);

  const sbTile = getTile(state, 24, 24)!;
  assert.ok(sbTile.height > 0, 'ground under shielded building must NOT collapse into deep water');
  const swTile = getTile(state, 25, 24)!;
  assert.ok(swTile.height > 0, 'ground under shielded World Wonder must NOT collapse into deep water');
  assert.equal(bridgeTile.isBridge, undefined, 'sinkhole must clear stale isBridge flag');
  assert.ok(openWonder.hp! < 2600, 'unshielded World Wonder should take sinkhole damage');
  assert.ok((veh.hp ?? 200) < 200, 'vehicle in sinkhole should take damage');
});

test('Phase 7 [P-C5, H4, H7]: magma_geyser damages buildings/Wonders/vehicles, respects fireproof, and solidifies poison+lava', () => {
  const state = makeFlatState('PHASE7-MAGMA', 48);
  placeBuilding(state, 'bonfire', 24, 24);
  const b = state.buildings[0];
  const bHpStart = b.hp;

  const wonder = makeWonder('w-magma', 25, 24);
  state.worldWonders = [wonder];
  const veh = makeVehicle('v-magma', 24, 25, 300);
  state.vehicles = [veh];

  const fireproofUnit = spawnUnit(state, 'villager', 24, 24, true).unit!;
  fireproofUnit.genes = ['fireproof'];
  const fireproofHpStart = fireproofUnit.hp;

  const poisonTile = getTile(state, 26, 24)!;
  poisonTile.height = 0;
  poisonTile.terrain = 'shallow_water';
  poisonTile.waterKind = 'poison';

  state.activeHazards.push({
    id: 'haz-magma',
    kind: 'magma_geyser',
    x: 24,
    z: 24,
    radius: 5,
    maxRadius: 5,
    heading: 0,
    remaining: 2.0,
    duration: 4.0, // progress = 0.5 -> triggers Stage 2 burst immediately
    tickTimer: 0,
    exploded: false,
  });

  stepSimulation(state, 0.25);

  assert.ok(b.hp < bHpStart, 'magma_geyser should damage buildings');
  assert.ok(wonder.hp! < 2600, 'magma_geyser should damage World Wonders');
  assert.ok((veh.hp ?? 300) < 300, 'magma_geyser should damage vehicles');
  assert.equal(fireproofUnit.hp, fireproofHpStart, 'fireproof unit should be immune to magma_geyser');
  const afterPoisonTile = getTile(state, 26, 24)!;
  assert.ok(
    !(afterPoisonTile.height === 0 && afterPoisonTile.terrain === 'scorched'),
    'poison + lava must not leave height-0 scorched tile',
  );
});

test('Phase 7 [H5, H3, M9]: lightning_smite respects shielded hostiles, damages Wonders, and respects wildfireSpread=false', () => {
  const state = makeFlatState('PHASE7-LIGHTNING', 48);
  state.worldRules = { ...(state.worldRules ?? {}), wildfireSpread: false } as typeof state.worldRules;

  const hostile = spawnUnit(state, 'warrior', 24, 24, true).unit!;
  hostile.faction = 'hostile';
  hostile.statusEffects.shielded = 15;
  const hostileHpStart = hostile.hp;

  const wonder = makeWonder('w-bolt', 24, 25);
  state.worldWonders = [wonder];

  executeGodPowerImpact(state, 'lightning_smite', 24, 24);

  assert.equal(hostile.hp, hostileHpStart, 'shielded hostile unit must not be damaged by lightning_smite');
  assert.notEqual(hostile.state, 'ko', 'shielded hostile unit must not be KOed by lightning_smite');
  assert.ok(wonder.hp! < 2600, 'lightning_smite should damage World Wonders');
  const centerTile = getTile(state, 24, 24)!;
  assert.equal(centerTile.onFireTimer, 0, 'lightning_smite must not ignite tiles when wildfireSpread is false');
});

test('Phase 7 [H6, H7, H8]: plague_cloud & acid_cloud respect undead/alien immunity, solidify lava, and damage vehicles/Wonders', () => {
  const state = makeFlatState('PHASE7-PLAGUE-ACID', 48);
  const skel = spawnUnit(state, 'skeleton', 24, 24, true).unit!;
  const alien = spawnUnit(state, 'alien_trooper', 25, 24, true).unit!;

  const lavaTile = getTile(state, 24, 25)!;
  lavaTile.height = 0;
  lavaTile.terrain = 'shallow_water';
  lavaTile.waterKind = 'lava';

  const wonder = makeWonder('w-acid', 24, 23);
  state.worldWonders = [wonder];
  const veh = makeVehicle('v-acid', 23, 24, 200);
  state.vehicles = [veh];

  state.activeHazards.push(
    {
      id: 'haz-plague',
      kind: 'plague_cloud',
      x: 24,
      z: 24,
      radius: 4,
      remaining: 3.0,
      duration: 3.0,
      tickTimer: 0,
    },
    {
      id: 'haz-acid',
      kind: 'acid_cloud',
      x: 24,
      z: 24,
      radius: 4,
      remaining: 3.0,
      duration: 3.0,
      tickTimer: 0,
    },
  );

  stepSimulation(state, 0.4);

  assert.equal(skel.statusEffects.plagued, undefined, 'skeleton must remain immune to plague_cloud/acid_cloud');
  assert.equal(alien.statusEffects.plagued, undefined, 'alien must remain immune to plague_cloud/acid_cloud');
  assert.ok(wonder.hp! < 2600, 'acid_cloud should damage World Wonders');
  assert.ok((veh.hp ?? 200) < 200, 'acid_cloud should damage vehicles');
  const afterLavaTile = getTile(state, 24, 25)!;
  assert.ok(
    !(afterLavaTile.height === 0 && afterLavaTile.terrain === 'scorched'),
    'acid_cloud + sea-level lava must solidify to height-1 rock, not height-0 scorched',
  );
});

test('Phase 7 [M11, H8]: blizzard_gale exempts Arctic animals from freeze, preserves bridges, and damages buildings/Wonders/vehicles', () => {
  const state = makeFlatState('PHASE7-BLIZZARD', 48);
  const yeti = spawnUnit(state, 'yeti', 24, 24, true).unit!;
  const yetiHpStart = yeti.hp;

  placeBuilding(state, 'bonfire', 25, 24);
  const b = state.buildings[0];
  const bHpStart = b.hp;

  const bridgeTile = getTile(state, 24, 25)!;
  bridgeTile.height = 0;
  bridgeTile.terrain = 'stone_road';
  bridgeTile.isBridge = true;

  const wonder = makeWonder('w-bliz', 23, 24);
  state.worldWonders = [wonder];
  const veh = makeVehicle('v-bliz', 24, 23, 200);
  state.vehicles = [veh];

  state.activeHazards.push({
    id: 'haz-bliz',
    kind: 'blizzard_gale',
    x: 24,
    z: 24,
    windX: 0,
    windZ: 0,
    radius: 5,
    remaining: 4.0,
    duration: 4.0,
    tickTimer: 0,
  });

  for (let i = 0; i < 4; i++) {
    stepSimulation(state, 0.25);
  }

  assert.equal(yeti.hp, yetiHpStart, 'yeti must not take blizzard_gale damage');
  assert.equal(yeti.statusEffects.frozen, undefined, 'yeti must not be frozen by blizzard_gale');
  assert.equal(bridgeTile.terrain, 'stone_road', 'blizzard_gale must not overwrite bridges with ice');
  assert.ok(b.hp < bHpStart, 'blizzard_gale should damage buildings');
  assert.ok(wonder.hp! < 2600, 'blizzard_gale should damage World Wonders');
  assert.ok((veh.hp ?? 200) < 200, 'blizzard_gale should damage vehicles');
});

test('Phase 7 [H4, H8, M9]: volcano_eruption underwater damages buildings & Wonders, respects fireproof & wildfireSpread=false', () => {
  const state = makeFlatState('PHASE7-VOLCANO', 48);
  state.worldRules = { ...(state.worldRules ?? {}), wildfireSpread: false } as typeof state.worldRules;

  const center = getTile(state, 24, 24)!;
  center.height = 0;
  center.terrain = 'deep_water';

  placeBuilding(state, 'bonfire', 25, 24);
  const b = state.buildings[0];
  const bHpStart = b.hp;

  const wonder = makeWonder('w-volc', 23, 24);
  state.worldWonders = [wonder];
  const dragon = spawnUnit(state, 'dragon', 24, 25, true).unit!;
  const dragonHpStart = dragon.hp;

  executeGodPowerImpact(state, 'volcano_eruption', 24, 24);

  assert.ok(b.hp < bHpStart, 'underwater volcano_eruption should damage nearby buildings');
  assert.ok(wonder.hp! < 2600, 'underwater volcano_eruption should damage World Wonders');
  assert.equal(dragon.hp, dragonHpStart, 'dragon (fireproof) must not be damaged by volcano_eruption');

  executeGodPowerImpact(state, 'volcano_eruption', 12, 12);
  const caldera = getTile(state, 12, 12)!;
  assert.equal(caldera.onFireTimer, 0, 'land volcano_eruption must not ignite tiles when wildfireSpread is false');
});
