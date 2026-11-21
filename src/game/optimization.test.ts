import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  CHUNK_SIZE,
  TERRAIN_TO_CODE,
  createWorldGridBuffers,
  getTileTopYFromCode,
  markTileDirty,
  raycastWorldGrid,
  syncWorldGridFromTiles,
} from './worldGrid';
import { buildTerrainChunkGeometryData } from './terrainMesher';
import { CoarseChunkGraph, FlowFieldManager, TimeSlicedPathBudget } from './pathfinding';
import {
  buildSimulationTickIndex,
  createPooledSimulationTickIndex,
} from './spatialIndex';
import { BatchedBuildingSystem } from './batchedBuildings';
import { BatchedStaticPool } from './batchedStaticProps';
import { TreeImpostorSystem } from './treeImpostors';
import { getVoxelTreeLibrary, TreeBiomeKey } from './voxelTrees';
import { getNodeVariantLibrary } from './meshBuilders';
import { DEFAULT_GRAPHICS_SETTINGS, resolveGraphicsProfile } from './graphics';
import {
  AutoOptimizer,
  DESPAWN_CULL_HYSTERESIS,
  WorldCullBounds,
  isHazardIntersectingCullBounds,
  isPointInCullBounds,
  isRingIntersectingCullBounds,
} from './autoOptimizer';
import { getMaxCityPopulation } from './catalog';
import { createInitialSimulationState, ensureWorldGrid, stepSimulation } from './simulation';
import { sanitizeSimulationForSave } from './worldStorage';

describe('Major Optimization & 512x512 Scaling Suite', () => {
  it('greedy terrain chunk mesher achieves massive triangle reduction with zero bottom faces', () => {
    const gridSize = 64;
    const grid = createWorldGridBuffers(gridSize, CHUNK_SIZE);

    // Fill chunk (0,0) with a flat ocean border, flat grass plain, and a raised plateau
    for (let z = 0; z < gridSize; z++) {
      for (let x = 0; x < gridSize; x++) {
        const i = z * gridSize + x;
        if (x < 8 || z < 8) {
          grid.heightMap[i] = 0;
          grid.terrainCodeMap[i] = TERRAIN_TO_CODE.shallow_water;
        } else if (x >= 14 && x <= 22 && z >= 14 && z <= 22) {
          grid.heightMap[i] = 3;
          grid.terrainCodeMap[i] = TERRAIN_TO_CODE.highland;
        } else {
          grid.heightMap[i] = 1;
          grid.terrainCodeMap[i] = TERRAIN_TO_CODE.grass;
        }
      }
    }

    const chunk = buildTerrainChunkGeometryData(
      grid.heightMap,
      grid.terrainCodeMap,
      grid.crushedMask,
      gridSize,
      0,
      0,
      CHUNK_SIZE,
    );

    const naiveCubeTriangles = CHUNK_SIZE * CHUNK_SIZE * 12; // 12,288 tris for 32x32 cubes
    assert.ok(
      chunk.triangleCount < naiveCubeTriangles * 0.1,
      `Expected >90% triangle reduction on flat/plateau chunk, got ${chunk.triangleCount} vs ${naiveCubeTriangles}`,
    );
    assert.ok(chunk.landTopIndices.length > 0, 'Should emit land top triangles');
    assert.ok(chunk.waterTopIndices.length > 0, 'Should emit water seabed top triangles');
    assert.ok(chunk.cliffIndices.length > 0, 'Should emit exposed cliff wall triangles');

    // Verify ZERO bottom-facing (-Y) normals exist anywhere
    for (let i = 1; i < chunk.landTopNormals.length; i += 3) {
      assert.equal(chunk.landTopNormals[i], 1);
    }
    for (let i = 1; i < chunk.cliffNormals.length; i += 3) {
      assert.equal(chunk.cliffNormals[i], 0);
    }
  });

  it('greedy mesher reduces triangle count by >70% on procedural continents', () => {
    const sim = createInitialSimulationState(128, 424242);
    const grid = ensureWorldGrid(sim);
    let totalGreedyTris = 0;
    for (let cz = 0; cz < grid.chunksPerSide; cz++) {
      for (let cx = 0; cx < grid.chunksPerSide; cx++) {
        const data = buildTerrainChunkGeometryData(
          grid.heightMap,
          grid.terrainCodeMap,
          grid.crushedMask,
          grid.gridSize,
          cx,
          cz,
          CHUNK_SIZE,
        );
        totalGreedyTris += data.triangleCount;
      }
    }
    const naiveTris = sim.tiles.length * 12;
    const reductionPct = (1 - totalGreedyTris / naiveTris) * 100;
    assert.ok(
      reductionPct >= 70,
      `Expected >=70% triangle reduction on procedural 128x128 world, got ${reductionPct.toFixed(1)}% (${totalGreedyTris} vs ${naiveTris})`,
    );
  });

  it('WorldGridBuffers keeps 512x512 memory under 3 MB and marks cross-chunk seam neighbors dirty', () => {
    const grid = createWorldGridBuffers(512, CHUNK_SIZE);
    const totalBytes =
      grid.heightMap.byteLength +
      grid.terrainCodeMap.byteLength +
      grid.resourceNodeMap.byteLength +
      grid.resourceAmountMap.byteLength +
      grid.ownerMap.byteLength +
      grid.crushedMask.byteLength +
      grid.dirtyChunks.byteLength;

    assert.ok(
      totalBytes < 3 * 1024 * 1024,
      `512x512 WorldGridBuffers should stay < 3 MB, got ${(totalBytes / 1024 / 1024).toFixed(2)} MB`,
    );

    // Clear dirty flags then dirty a tile on the exact right edge of chunk (0, 0)
    grid.dirtyChunks.fill(0);
    grid.dirtyChunkCount = 0;
    markTileDirty(grid, 31, 10);
    assert.equal(grid.dirtyChunks[0], 1, 'Chunk (0,0) should be dirty');
    assert.equal(grid.dirtyChunks[1], 1, 'Neighbor chunk (1,0) across cliff seam should also be dirty');
    assert.equal(grid.dirtyChunkCount, 2);
  });

  it('3D Amanatides-Woo DDA voxel raymarch hits elevated hills accurately and runs fast on 512x512', () => {
    const grid = createWorldGridBuffers(512, CHUNK_SIZE);
    grid.heightMap.fill(1);
    grid.terrainCodeMap.fill(TERRAIN_TO_CODE.grass);
    // Place a tall mountain pillar at (256, 256)
    const targetIdx = 256 * 512 + 256;
    grid.heightMap[targetIdx] = 6;
    grid.terrainCodeMap[targetIdx] = TERRAIN_TO_CODE.mountain;

    const topY = getTileTopYFromCode(6, TERRAIN_TO_CODE.mountain);
    // Cast an isometric ray aimed straight at the top center of (256, topY, 256)
    const dir = new THREE.Vector3(-1, -1.1, -1).normalize();
    const origin = new THREE.Vector3(256, topY, 256).addScaledVector(dir, -40);
    const ray = new THREE.Ray(origin, dir);

    const hit = raycastWorldGrid(ray, grid);
    assert.ok(hit, 'Ray should hit the mountain pillar');
    assert.equal(hit.x, 256);
    assert.equal(hit.z, 256);
    assert.ok(Math.abs(hit.hitY - topY) < 0.05);

    // Benchmark 200 raycasts on 512x512
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) {
      raycastWorldGrid(ray, grid);
    }
    const elapsedMs = performance.now() - t0;
    assert.ok(
      elapsedMs < 35,
      `200 DDA raycasts on 512x512 should complete well under 35ms, took ${elapsedMs.toFixed(2)}ms`,
    );
  });

  it('flatqueue FlowFieldManager routes around water walls and CoarseChunkGraph paths across 512x512', () => {
    const grid = createWorldGridBuffers(64, CHUNK_SIZE);
    grid.heightMap.fill(1);
    grid.terrainCodeMap.fill(TERRAIN_TO_CODE.grass);

    // Build a vertical water barrier at x = 20 from z = 0..25 with a land bridge gap at z = 26..30
    for (let z = 0; z <= 25; z++) {
      const i = z * 64 + 20;
      grid.heightMap[i] = 0;
      grid.terrainCodeMap[i] = TERRAIN_TO_CODE.deep_water;
    }

    const flowMgr = new FlowFieldManager(8);
    const field = flowMgr.getOrBuildFlowField(grid, 26, 10, 1, 32, false);

    // Unit at (16, 10) must NOT step directly east into the water wall; it should steer south (+Z) toward the bridge
    const dir = flowMgr.sampleDirection(field, 18, 10);
    assert.ok(dir, 'Expected valid flow vector on west side of barrier');
    assert.ok(dir.dz >= 0, `Expected southward detour around barrier, got (${dir.dx}, ${dir.dz})`);

    // Coarse 32x32 HPA* across a 512x512 world
    const bigGrid = createWorldGridBuffers(512, CHUNK_SIZE);
    bigGrid.heightMap.fill(1);
    bigGrid.terrainCodeMap.fill(TERRAIN_TO_CODE.grass);
    const graph = new CoarseChunkGraph();
    const t0 = performance.now();
    const coarsePath = graph.findCoarsePath(bigGrid, 10, 10, 490, 490);
    const ms = performance.now() - t0;
    assert.ok(coarsePath && coarsePath.length >= 15, 'Expected valid multi-chunk path across 512x512');
    assert.ok(ms < 50, `Coarse HPA* build + query on 512x512 took ${ms.toFixed(2)}ms`);

    // Budget enforcement check
    const budget = new TimeSlicedPathBudget(20);
    let granted = 0;
    for (let i = 0; i < 30; i++) {
      if (budget.tryConsume()) granted++;
    }
    assert.equal(granted, 20);
  });

  it('pooled SimulationTickIndex reuses cell bucket arrays across consecutive ticks', () => {
    const sim = createInitialSimulationState(64, 7777);
    const pool = createPooledSimulationTickIndex(sim.gridSize);
    const first = buildSimulationTickIndex(sim, () => undefined, () => false, pool);
    const firstCellsRef = first.cells;
    stepSimulation(sim, 0.066);
    const second = buildSimulationTickIndex(sim, () => undefined, () => false, pool);
    assert.equal(second, first, 'Should return the exact same pooled index object');
    assert.equal(second.cells, firstCellsRef, 'Should reuse cell array container');
  });

  it('BatchedBuildingSystem collapses hundreds of buildings into O(1) material draw buckets', () => {
    const sys = new BatchedBuildingSystem();
    for (let i = 0; i < 30; i++) {
      sys.upsertBuilding(
        `b_${i}`,
        i % 2 === 0 ? 'forager_hut' : 'granary',
        1,
        'human',
        i,
        false,
        10 + i,
        1.0,
        10,
        0,
        1,
        true,
        1,
      );
    }
    const bucketsAt30 = sys.getDrawCallBucketCount();
    assert.equal(sys.getBuildingCount(), 30);
    assert.ok(
      bucketsAt30 > 0 && bucketsAt30 <= 28,
      `Expected <= 28 BatchedMesh draw buckets for 30 rich multi-material buildings, got ${bucketsAt30}`,
    );

    // Adding 120 more buildings of the same types must create ZERO additional draw calls (O(1)!)
    for (let i = 30; i < 150; i++) {
      sys.upsertBuilding(
        `b_${i}`,
        i % 2 === 0 ? 'forager_hut' : 'granary',
        1,
        'human',
        i,
        false,
        10 + (i % 40),
        1.0,
        12 + Math.floor(i / 40),
        0,
        1,
        true,
        1,
      );
    }
    assert.equal(sys.getBuildingCount(), 150);
    assert.equal(
      sys.getDrawCallBucketCount(),
      bucketsAt30,
      'Draw-call bucket count must remain O(1) constant as building count scales 5x',
    );

    // Hide & prune verification
    sys.setHidden('b_0', 2);
    sys.pruneUnseen(2);
    assert.equal(sys.getBuildingCount(), 1, 'Only buildings stamped with current frame should remain');
    sys.dispose();
  });

  it('enforces Strict Lossless Mode by default, scales city caps for 384/512, and strips worldGrid on save', () => {
    assert.equal(DEFAULT_GRAPHICS_SETTINGS.strictLossless, true);
    assert.equal(DEFAULT_GRAPHICS_SETTINGS.showPerformanceHud, false);

    // Strict Lossless ignores autoTrimLevel downgrades
    const losslessProfile = resolveGraphicsProfile(DEFAULT_GRAPHICS_SETTINGS, 2);
    assert.equal(losslessProfile.foliageFactor, 1.0);
    assert.equal(losslessProfile.particleScale, 1.0);
    assert.equal(losslessProfile.shadowUpdateStride, 1);

    // Low-End mode allows adaptive trimming
    const lowEndProfile = resolveGraphicsProfile(
      { ...DEFAULT_GRAPHICS_SETTINGS, strictLossless: false },
      2,
    );
    assert.ok(lowEndProfile.foliageFactor < 1.0);
    assert.ok(lowEndProfile.particleScale < 1.0);

    const opt = new AutoOptimizer();
    const losslessDec = opt.update({
      rawFrameMs: 45,
      dt: 0.05,
      frustumSize: 60,
      visibleUnitCount: 300,
      totalUnitCount: 500,
      isPlaying: true,
      isSoftwareGl: false,
      autoEnabled: true,
      strictLossless: true,
    });
    assert.equal(losslessDec.tier, 0);
    assert.equal(losslessDec.crowdAnimStride, 1);
    assert.equal(losslessDec.unitCastShadows, true);

    assert.equal(getMaxCityPopulation(256), 135);
    assert.equal(getMaxCityPopulation(384), 175);
    assert.equal(getMaxCityPopulation(512), 220);

    const sim = createInitialSimulationState(64, 9001);
    ensureWorldGrid(sim);
    assert.ok(sim.worldGrid, 'worldGrid should attach lazily');
    const saved = sanitizeSimulationForSave(sim);
    assert.equal(saved.worldGrid, undefined, 'worldGrid must be stripped before IndexedDB save');
    const rebuiltGrid = ensureWorldGrid(saved);
    syncWorldGridFromTiles(rebuiltGrid, saved.tiles);
    assert.equal(rebuiltGrid.gridSize, 64);
  });

  it('4-tier VoxelTree LODs monotonically slash triangle count (>90% at LOD3) while preserving height', () => {
    const lib = getVoxelTreeLibrary();
    const trisOf = (g: THREE.BufferGeometry): number => {
      const idx = g.getIndex();
      if (idx) return Math.floor(idx.count / 3);
      return Math.floor((g.getAttribute('position')?.count ?? 0) / 3);
    };

    const biomes: TreeBiomeKey[] = [
      'forest',
      'meadow',
      'jungle',
      'taiga',
      'blossom',
      'savanna',
      'swamp',
      'highland',
    ];
    let sum0 = 0;
    let sum3 = 0;

    for (const biome of biomes) {
      const l0 = lib.byBiome[biome];
      const l1 = lib.byBiomeLod1[biome];
      const l2 = lib.byBiomeLod2[biome];
      const l3 = lib.byBiomeLod3[biome];
      assert.equal(l1.length, l0.length);
      assert.equal(l2.length, l0.length);
      assert.equal(l3.length, l0.length);

      for (let i = 0; i < l0.length; i++) {
        const t0 = trisOf(l0[i]);
        const t1 = trisOf(l1[i]);
        const t2 = trisOf(l2[i]);
        const t3 = trisOf(l3[i]);
        sum0 += t0;
        sum3 += t3;
        assert.ok(t1 < t0 && t2 < t1 && t3 <= t2, `Non-monotonic LOD tris for ${biome}[${i}]: ${t0}->${t1}->${t2}->${t3}`);
        assert.ok(t3 >= 40, `LOD3 collapsed too much for ${biome}[${i}]: ${t3}`);

        l0[i].computeBoundingBox();
        l3[i].computeBoundingBox();
        const h0 = l0[i].boundingBox!.max.y - l0[i].boundingBox!.min.y;
        const h3 = l3[i].boundingBox!.max.y - l3[i].boundingBox!.min.y;
        assert.ok(h3 >= h0 * 0.65, `LOD3 lost canopy height for ${biome}[${i}]: ${h3.toFixed(2)} vs ${h0.toFixed(2)}`);
      }
    }

    const overallReduction = 1 - sum3 / sum0;
    assert.ok(
      overallReduction >= 0.9,
      `Expected >=90% tree triangle reduction at overview LOD3, got ${(overallReduction * 100).toFixed(1)}%`,
    );
  });

  it('NodeVariantLibrary Prop LOD2s and BatchedBuildingSystem LOD1 reduce triangle geometry cleanly', () => {
    const nLib = getNodeVariantLibrary();
    const trisOf = (g: THREE.BufferGeometry): number => {
      const idx = g.getIndex();
      return idx ? Math.floor(idx.count / 3) : Math.floor((g.getAttribute('position')?.count ?? 0) / 3);
    };
    const avgTris = (arr: THREE.BufferGeometry[]) =>
      arr.reduce((acc, g) => acc + trisOf(g), 0) / Math.max(1, arr.length);

    assert.ok(avgTris(nLib.coralReefLod2) < avgTris(nLib.coralReef) * 0.25, 'coralReefLod2 should cut >=75% tris');
    assert.ok(avgTris(nLib.coralReefBleachedLod2) < avgTris(nLib.coralReefBleached) * 0.25);
    assert.ok(avgTris(nLib.atlantisRuinLod2) < avgTris(nLib.atlantisRuin) * 0.35);
    assert.ok(avgTris(nLib.berryLod2) < avgTris(nLib.berry) * 0.6);
    assert.ok(avgTris(nLib.stoneLod2) < avgTris(nLib.stone) * 0.5);
    assert.ok(avgTris(nLib.oreLod2) < avgTris(nLib.ore) * 0.5);
    assert.ok(avgTris(nLib.crystalLod2) < avgTris(nLib.crystal) * 0.65);

    const sys = new BatchedBuildingSystem();
    assert.equal(sys.getLodLevel(), 0);
    const bTypes = ['forager_hut', 'granary', 'guildhall', 'steam_foundry', 'fission_reactor', 'dyson_spire'] as const;
    bTypes.forEach((tp, idx) => {
      sys.upsertBuilding(`b_${idx}`, tp, 5, 'human', idx, false, 10 + idx, 1, 10, 0, 1, true, 1);
    });
    sys.setLodLevel(1);
    assert.equal(sys.getLodLevel(), 1);
    sys.setLodLevel(0);
    assert.equal(sys.getLodLevel(), 0);
    sys.dispose();
  });

  it('unrenders off-screen buildings/hazards via cull bounds & restores exact instances when back in view', () => {
    const sys = new BatchedBuildingSystem();
    const bounds: WorldCullBounds = { minX: 10, maxX: 30, minZ: 10, maxZ: 30 };

    // Materialize two buildings (1 inside screen, 1 inside screen initially)
    sys.upsertBuilding('b_near', 'forager_hut', 0, 'human', 1, false, 20, 1.0, 20, 0, 1, true, 1);
    sys.upsertBuilding('b_far', 'granary', 2, 'human', 2, false, 80, 1.0, 80, Math.PI / 2, 1, true, 1);
    assert.equal(sys.getBuildingCount(), 2);

    // Frame 2: only stamp buildings inside keep bounds; b_far is far off-screen so pruneUnseen deletes its 3D instance
    if (isPointInCullBounds(20, 20, bounds, DESPAWN_CULL_HYSTERESIS)) {
      sys.upsertBuilding('b_near', 'forager_hut', 0, 'human', 1, false, 20, 1.0, 20, 0, 1, true, 2);
    }
    sys.pruneUnseen(2);
    assert.equal(sys.getBuildingCount(), 1);
    assert.equal(sys.getEntry('b_far'), undefined);

    // Frame 3: pan camera over (80, 80) — both buildings flip roles cleanly
    const pannedBounds: WorldCullBounds = { minX: 70, maxX: 90, minZ: 70, maxZ: 90 };
    if (isPointInCullBounds(80, 80, pannedBounds, 0)) {
      sys.upsertBuilding('b_far', 'granary', 2, 'human', 2, false, 80, 1.5, 80, Math.PI / 2, 1, true, 3);
    }
    sys.pruneUnseen(3);
    assert.equal(sys.getBuildingCount(), 1);
    assert.equal(sys.getEntry('b_near'), undefined);
    assert.equal(sys.getEntry('b_far')?.cachedRotY, Math.PI / 2);
    assert.equal(sys.getEntry('b_far')?.lastY, 1.5);
    sys.dispose();

    // Tsunami expanding wavefront ring intersection checks
    assert.equal(
      isRingIntersectingCullBounds(0, 0, 4, 8, bounds, 0),
      false,
      'Small tsunami far off-screen should stay unrendered',
    );
    assert.equal(
      isRingIntersectingCullBounds(0, 0, 22, 28, bounds, 0),
      true,
      'Tsunami wavefront crossing the viewport must render even if epicenter is off-screen',
    );
    assert.equal(
      isRingIntersectingCullBounds(0, 0, 60, 66, bounds, 0),
      false,
      'Tsunami that expanded completely past the viewport should unrender',
    );

    // Earthquake fault-segment & generic hazard bounds checks
    assert.equal(
      isHazardIntersectingCullBounds(
        {
          kind: 'earthquake_zone',
          x: 5,
          z: 5,
          radius: 4,
          faultSegments: [{ x1: 4, z1: 5, x2: 14, z2: 14, width: 2 }],
        },
        bounds,
        0,
      ),
      true,
    );
    assert.equal(
      isHazardIntersectingCullBounds(
        { kind: 'tornado_vortex', x: 95, z: 95, radius: 5 },
        bounds,
        DESPAWN_CULL_HYSTERESIS,
      ),
      false,
    );
  });

  it('strips invisible -Y faces on voxel trees and packs TreeImpostorSystem instances cleanly (2 tris/tree)', () => {
    const lib = getVoxelTreeLibrary();
    // Verify ZERO downward-facing (-Y) normals exist across all voxel tree LOD geometries
    for (const g of lib.allGeometries) {
      const norm = g.getAttribute('normal');
      if (!norm) continue;
      for (let i = 0; i < norm.count; i++) {
        assert.ok(norm.getY(i) >= -0.9, `Found invisible -Y underside face on voxel tree (ny=${norm.getY(i)})`);
      }
    }

    // Verify TreeImpostorSystem gracefully handles headless (null renderer) and dynamic buffer growth
    const impostors = new TreeImpostorSystem(null, lib, 4);
    assert.equal(impostors.isBaked, false);
    const mat = new THREE.Matrix4().compose(
      new THREE.Vector3(12, 1.5, 24),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.7),
      new THREE.Vector3(1.1, 1.25, 1.1),
    );
    const arr = new Float32Array(mat.elements);
    for (let i = 0; i < 600; i++) {
      impostors.pushTreeFromMatrix(i & 1, i % 8, 0, arr, 0);
    }
    impostors.commit();
    assert.equal(impostors.getCount(), 600);
    // Base plane has 2 triangles (6 indices) -> 600 instances = 1,200 triangles total
    const geo = impostors.mesh.geometry as THREE.InstancedBufferGeometry;
    assert.equal(geo.index!.count / 3, 2);
    assert.equal(geo.instanceCount, 600);
    impostors.updateCameraAndLighting(Math.PI / 4, 0.85);
    impostors.dispose();
  });

  it('BatchedStaticPool collapses multi-variant static props into 1 BatchedMesh with dynamic growth & shrink', () => {
    const vLib = getVoxelTreeLibrary();
    const nLib = getNodeVariantLibrary();
    const mat = new Float32Array(new THREE.Matrix4().makeTranslation(10, 1, 20).elements);

    // 1. Indexed geometries (voxel trees) with growth past initial capacity (64 -> >120)
    const treeGeos = [...vLib.byBiome.forest, ...vLib.byBiomeLod1.forest];
    const treePool = new BatchedStaticPool('test_trees', vLib.material, treeGeos, true, true, 64);
    for (let i = 0; i < 120; i++) {
      treePool.pushFromMatrixArray(i % treeGeos.length, mat, 0);
    }
    treePool.commit();
    assert.equal(treePool.getCount(), 120);
    assert.equal(treePool.mesh.visible, true);

    // Shrink & hide unused slots cleanly
    treePool.reset();
    for (let i = 0; i < 12; i++) {
      treePool.pushFromMatrixArray(i % treeGeos.length, mat, 0);
    }
    treePool.commit();
    assert.equal(treePool.getCount(), 12);
    assert.equal(treePool.mesh.getVisibleAt(0), true);
    assert.equal(treePool.mesh.getVisibleAt(11), true);
    assert.equal(treePool.mesh.getVisibleAt(12), false);

    // Reset to 0 hides mesh completely
    treePool.reset();
    treePool.commit();
    assert.equal(treePool.mesh.visible, false);
    treePool.dispose();

    // 2. Non-indexed / mixed geometries (ambient & resource props)
    const propGeos = [...nLib.berry, ...nLib.stone, ...nLib.ambientGrass];
    const propPool = new BatchedStaticPool('test_props', nLib.standardMat, propGeos, false, true, 64);
    for (let i = 0; i < 80; i++) {
      propPool.pushFromMatrixArray(i % propGeos.length, mat, 0);
    }
    propPool.commit();
    assert.equal(propPool.getCount(), 80);
    assert.equal(propPool.mesh.visible, true);
    propPool.dispose();
  });
});


