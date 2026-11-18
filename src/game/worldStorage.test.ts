import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialSimulationState, DEFAULT_WORLD_RULES, spawnUnit } from './simulation';
import { DEFAULT_ZONE_TOGGLES } from './zones';
import {
  createMemoryWorldStorageAdapter,
  deleteSavedWorld,
  listSavedWorlds,
  loadSavedWorldById,
  renameSavedWorld,
  restoreSimulationFromSave,
  saveWorldToLocalCache,
  updateSavedWorldRules,
} from './worldStorage';

test('saveWorldToLocalCache stores, lists newest-first, and updates existing slot by saveId', async () => {
  const adapter = createMemoryWorldStorageAdapter();

  const simA = createInitialSimulationState(64, 101);
  simA.year = 42;
  const thumbA = 'data:image/jpeg;base64,thumbA';
  const savedA = await saveWorldToLocalCache(
    {
      name: 'Alpha Isles',
      thumbnailDataUrl: thumbA,
      lightingPreset: 'noon',
      activeZones: { ...DEFAULT_ZONE_TOGGLES, kingdoms: true },
      sim: simA,
    },
    adapter,
  );

  // Ensure distinct savedAt timestamps
  await new Promise((r) => setTimeout(r, 5));

  const simB = createInitialSimulationState(64, 202);
  simB.year = 150;
  const savedB = await saveWorldToLocalCache(
    {
      name: 'Beta Continent',
      thumbnailDataUrl: 'data:image/jpeg;base64,thumbB',
      lightingPreset: 'dusk',
      activeZones: DEFAULT_ZONE_TOGGLES,
      sim: simB,
    },
    adapter,
  );

  const list = await listSavedWorlds(adapter);
  assert.equal(list.length, 2);
  assert.equal(list[0].id, savedB.id);
  assert.equal(list[1].id, savedA.id);
  assert.equal(list[1].thumbnailDataUrl, thumbA);
  assert.equal(list[1].activeZones.kingdoms, true);

  // Re-saving world A with saveId updates in place instead of creating a third entry
  await new Promise((r) => setTimeout(r, 5));
  simA.year = 77;
  const updatedA = await saveWorldToLocalCache(
    {
      saveId: savedA.id,
      name: 'Alpha Isles',
      thumbnailDataUrl: 'data:image/jpeg;base64,thumbA2',
      lightingPreset: 'auto',
      activeZones: DEFAULT_ZONE_TOGGLES,
      sim: simA,
    },
    adapter,
  );

  const listAfterUpdate = await listSavedWorlds(adapter);
  assert.equal(listAfterUpdate.length, 2);
  assert.equal(listAfterUpdate[0].id, updatedA.id);
  assert.equal(listAfterUpdate[0].year, 77);
  assert.equal(listAfterUpdate[0].thumbnailDataUrl, 'data:image/jpeg;base64,thumbA2');
});

test('restoreSimulationFromSave reconstructs entities, year, tiles, and clears transient VFX/selection', async () => {
  const adapter = createMemoryWorldStorageAdapter();
  const sim = createInitialSimulationState(64, 303);
  const landTile = sim.tiles.find((t) => t.height > 0);
  assert.ok(landTile, 'expected a land tile');
  spawnUnit(sim, 'human', landTile.x, landTile.z);
  sim.year = 240;
  sim.epochIndex = 2;
  sim.selectedEntityId = sim.units[0]?.id ?? null;
  sim.pendingVfx.push({
    id: 'vfx-1',
    type: 'hit_spark',
    x: landTile.x,
    y: 1,
    z: landTile.z,
    color: '#ffffff',
    radius: 1,
    createdAt: Date.now(),
  });

  const saved = await saveWorldToLocalCache(
    {
      name: 'Chronicle Realm',
      description: 'First empire on the eastern cliffs.',
      thumbnailDataUrl: null,
      lightingPreset: 'night',
      activeZones: DEFAULT_ZONE_TOGGLES,
      sim,
    },
    adapter,
  );

  const loaded = await loadSavedWorldById(saved.id, adapter);
  assert.ok(loaded);
  assert.equal(loaded.description, 'First empire on the eastern cliffs.');
  const restored = restoreSimulationFromSave(loaded);

  assert.equal(restored.seed, 303);
  assert.equal(restored.year, 240);
  assert.equal(restored.epochIndex, 2);
  assert.equal(restored.tiles.length, 64 * 64);
  assert.equal(restored.units.length, sim.units.length);
  assert.equal(restored.pendingVfx.length, 0);
  assert.equal(restored.selectedEntityId, null);
  assert.equal(restored.worldName, 'Chronicle Realm');
  assert.equal(restored.worldDescription, 'First empire on the eastern cliffs.');
});

test('renameSavedWorld, updateSavedWorldRules, and deleteSavedWorld persist updates cleanly', async () => {
  const adapter = createMemoryWorldStorageAdapter();
  const sim = createInitialSimulationState(64, 404);
  const saved = await saveWorldToLocalCache(
    {
      name: 'Old Name',
      thumbnailDataUrl: null,
      lightingPreset: 'noon',
      activeZones: DEFAULT_ZONE_TOGGLES,
      sim,
    },
    adapter,
  );

  // Reject whitespace-only rename
  const blankRename = await renameSavedWorld(saved.id, '   ', adapter);
  assert.equal(blankRename, null);

  // Rename cleanly
  const renamed = await renameSavedWorld(saved.id, 'New Empire', adapter);
  assert.ok(renamed);
  assert.equal(renamed.name, 'New Empire');
  assert.equal(renamed.simulation.worldName, 'New Empire');

  // Edit rules
  const updatedRules = await updateSavedWorldRules(
    saved.id,
    {
      rules: {
        ...DEFAULT_WORLD_RULES,
        warsEnabled: false,
        autoBuildEnabled: false,
        sandboxFreeMode: true,
        dayNightCycle: true,
      },
      epochIndex: 3,
      lightingPreset: 'auto',
    },
    adapter,
  );
  assert.ok(updatedRules);
  assert.equal(updatedRules.epochIndex, 3);
  assert.equal(updatedRules.lightingPreset, 'auto');
  assert.equal(updatedRules.simulation.worldRules?.warsEnabled, false);
  assert.equal(updatedRules.simulation.autoBuildEnabled, false);
  assert.equal(updatedRules.simulation.sandboxFreeMode, true);

  const restored = restoreSimulationFromSave(updatedRules);
  assert.equal(restored.autoBuildEnabled, false);
  assert.equal(restored.sandboxFreeMode, true);
  assert.equal(restored.epochIndex, 3);

  // Delete cleanly
  await deleteSavedWorld(saved.id, adapter);
  const afterDelete = await listSavedWorlds(adapter);
  assert.equal(afterDelete.length, 0);
  const missing = await loadSavedWorldById(saved.id, adapter);
  assert.equal(missing, null);
});
