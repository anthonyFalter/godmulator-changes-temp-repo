# Godmulator Performance & Optimization Guide

This document summarizes the performance architecture implemented across Godmulator's rendering, simulation, god powers, and startup pipeline, and serves as a **developer playbook** for keeping all future models, biomes, and god powers locked at **60+ FPS** (including mobile Safari).

---

## 1. Performance Targets

| Metric | Target | Notes |
|---|---|---|
| **Frame Rate** | **60 FPS minimum** | Desktop & mobile (with Low Power Mode off) |
| **Draw Calls** | **< 150** | Mobile WebGL degrades sharply above ~200 draw calls |
| **Scene Triangles** | **< 150k** (overview), **< 300k** (close-up) | Preserves crisp voxel/pixel-art look at all zoom levels |
| **Startup Frame 0** | **< 500 ms** | No synchronous shader-compile or atlas-bake stalls |
| **Simulation Tick** | **< 4 ms** | Bounded spatial queries only; zero full-map scans per power |

---

## 2. Summary of Implemented Optimizations

### A. Geometry & Triangle Count Reductions (`-85%` to `-91%` at overview)
- **Underside (`-Y`) Face Stripping**: Because the isometric camera never views below ground, strictly downward-facing triangles (`ny < -0.92`) are automatically stripped in:
  - `src/game/voxelTrees.ts` (`toGreedyBufferGeometry`, `toDownsampledGreedyBufferGeometry`)
  - `src/game/batchedBuildings.ts` (`normalizeGeometryForBatch`)
  - `src/game/meshBuilders.ts` (`stripDownwardTriangles` inside `finalizeMergedParts`)
- **Pixel-Scale Curved Primitives (`src/game/meshBuilders.ts`)**: Replaced over-tessellated Three.js primitives with `pxTorus`, `pxSphere`, `pxCylinder`, and `pxCone` that cap sub-pixel segment counts while preserving exact silhouettes.
- **4-Tier Voxel Tree LODs + 2-Triangle Baked Impostors (`src/game/treeImpostors.ts`)**:
  - `TreeImpostorSystem` renders all 44 live + 44 burnt LOD0 voxel tree species (across 11 biomes including Volcanic Wasteland, Land of Blight, and Floral Plains) from 8 yaw angles at the exact isometric camera pitch into a `2048×2048` `NearestFilter` atlas.
  - At far/overview zoom, trees render as 2-triangle camera-facing quads in **1 draw call** with `scene.environment` + noon-calibrated lighting so far trees match 3D tree brightness identically.

### B. Draw-Call Batching (`370 → ~100–150` draw calls)
- **`BatchedStaticPool` (`src/game/batchedStaticProps.ts`)**: Wraps `THREE.BatchedMesh` with normalized vertex attributes (`position`, `normal`, `color`), automatic indexed/non-indexed handling, pre-sized buffers, and dynamic `1.6×` growth.
  - **Trees**: `352+ InstancedMesh`es → **2 `BatchedMesh`es** (`treeBatchShadow`, `treeBatchNoShadow`) + 1 impostor draw call.
  - **Resource Props**: `~70 InstancedMesh`es → **5 `BatchedMesh`es** grouped by material (`standardMat`, `crystalMat`, `coralReefMat`) and shadow flag.
  - **Ambient Ground Details**: `44 InstancedMesh`es across 17 biomes → **1 `BatchedMesh`** (`ambBatch`).
- **Unit, Wildlife & Ambient Systems Batching (`src/game/batchedUnits.ts`, `src/game/monumentsSystem.ts`, `src/game/ambientFauna.ts`, `src/game/spectacleEffects.ts`, `src/game/citizenBubbles.ts`, `src/components/IsometricWorldCanvas.tsx`, `src/game/meshBuilders.ts`)**:
  - **`BatchedUnitSystem` (`src/game/batchedUnits.ts`)**: Collapses zoomed-out and dense-crowd units/wildlife into at most **2 `THREE.BatchedMesh`es** (`batched_units_std` vertex-colored PBR + `batched_units_glow` unlit emissive) with lazy template baking, mirrored-submesh triangle winding correction, and pose variants (`default`, `submerged`, `disguised`, `petrified`).
  - Collapsed per-unit `contact_shadow` discs into **1 `InstancedMesh`** (`unitContactShadowsInst`).
  - Merged static sub-meshes inside wildlife animal rigs (e.g., cow `16 → 7` draw calls), hid `status_ring` by default, quantized PBR sheen buckets, and hid tiny `held_tool` meshes when `frustumSize >= 38`.
  - **`MonumentsSystem` (`src/game/monumentsSystem.ts`)**: Shares 6 neutral pixel-art PBR materials (`stone`, `wood`, `foliage`, `metal`, `cloth`, `glow`) across all World Wonders with vertex-colored merged meshes and `-Y` underside face stripping, plus 2 `InstancedMesh`es for battle memorials.
  - **`AmbientFaunaSystem`, `SpectacleEffectsSystem` & `CitizenBubbleSystem`**: Pooled `InstancedMesh`es (7 instanced meshes for birds, butterflies, leaping/swimming fish, splash rings, and water insects; instanced ruins, lanterns, waterfall mist, and speech bubbles) with 0-count hiding.
  - **Era-Evolving 3D Bridge Kit & Seamless Basin Water**: 4 instanced bridge meshes (`bridgeWoodSideInst`, `bridgeWoodDeckInst`, `bridgeStoneSideInst`, `bridgeIronSideInst`) built via `finalizeMergedParts` (`-Y` stripping, 0 draw calls when unused) and a face-culled seamless poured-basin water mesh.

### C. Terrain Chunking, Web Workers, Culling & Auto-Optimization
- **32×32 Lossless Greedy Terrain Chunk Mesher (`src/game/terrainMesher.ts`, `src/game/chunkTerrainRenderer.ts`)**:
  - Millimeter-quantized (`quantizeY`) 2D greedy quad merging for coplanar land/water top faces, hidden-face culling of buried internal/bottom faces, greedy horizontal/vertical cliff strip merging, and reusable module-level scratch TypedArrays.
  - Unified solid chunk pass (`isUnifiedSolid`: 1 draw call per chunk for land tops + cliffs), shadow-split water mesh (`castShadow = false`), per-chunk `THREE.Frustum` + 2D ground OBB culling, per-chunk shadow-footprint `castShadow` toggling, and zero-allocation `cachedStats`.
- **Comlink Web Worker Pool (`src/game/workerPool.ts`, `src/game/terrainWorker.ts`)**:
  - `EngineWorkerPool` lazily instantiates workers on first job with least-busy dispatch and automatic sync fallback.
  - Hybrid dirty-chunk flushing: 1–3 dirty chunks rebuild synchronously within a per-frame budget; `> 3` dirty chunks offload to workers with stale-revision rejection and zero-copy `Transferable` `ArrayBuffer` returns (`getTerrainChunkTransferables`). Large new-world generation (`384×384` / `512×512`) also runs off-thread.
- **Flat TypedArray `WorldGridBuffers` & Analytical 3D DDA Raymarching (`src/game/worldGrid.ts`)**:
  - Flat `Uint8Array`/`Uint16Array` tile mirrors, `activeFireTiles` `Set<number>`, 1-tile seam-neighbor dirtying, monotonic `terrainVersion`/`propVersion` counters, and analytical 3D Amanatides–Woo DDA voxel raymarching (`raycastWorldGrid`, `< 0.05 ms` on 512×512, replacing Three.js triangle raycasting).
- **`AutoOptimizer` & Exact 2D Camera-Oriented OBB Culling (`src/game/autoOptimizer.ts`, `src/components/IsometricWorldCanvas.tsx`)**:
  - Replaced axis-aligned AABB culling with exact camera-basis (`rx, rz, fx, fz`) OBB culling (`computeOrthoGroundCullBounds`, `isPointInCullBounds`, `isAabbIntersectingCullBounds`, `isHazardIntersectingCullBounds`, + 6-tile pad), eliminating ~75% of off-screen trees in the 4 empty diagonal corners of the 45° isometric view.
  - Dynamic FPS hysteresis controller (`AutoOptimizer`), zoom-aware shadow toggling, and snapped shadow camera bounds (`computeSnappedShadowBounds`).
- **Balanced High-Detail LOD Bands (`22 / 40 / 64`)**:
  - **Band 0 (`frustumSize < 22`)**: Close-up — LOD0 hero / LOD1 companion.
  - **Band 1 (`22–40`)**: Mid-close — 100% 3D (LOD1 inner / LOD2 outer).
  - **Band 2 (`40–64`)**: Region — LOD2 inner 3D / 2-tri baked impostors outer.
  - **Band 3 (`>= 64`)**: Overview — 2-tri baked impostors in 1 draw call.
- **Hysteresis Guards**: Added resize hysteresis (`>= 8%` or `>= 36px` or settled zoom) on `renderer.setSize()` and guard-band hysteresis (`DESPAWN_CULL_HYSTERESIS`) on prop culling & shadow frustum to prevent WebGL framebuffer reallocation spikes during pinch-zoom.

### D. GPU, Shaders, Lighting & Non-Blocking Progressive Startup
- **Early-Z Sky Backdrop & 2-BatchedMesh Clouds (`src/game/skyAndSea.ts`)**: `pixelSpace` renders at `renderOrder = 100` with `depthTest: true` and `z = 0.99999` + 3-octave FBM so GPU Early-Z skips 100% of pixels covered by the island/ocean; sky clouds collapse into **2 `BatchedMesh` draw calls** and the ocean uses a lightweight vertex grid.
- **O(N) Chamfer Foam Transform (`src/game/skyAndSea.ts`)**: Replaced 9×9 nested shoreline distance loop in `oceanFoam.updateMap` with a 2-pass Chamfer transform (`256×256`: `47.6 ms → 5.4 ms`, **8.8× faster**).
- **Lighting & Shader Precision (`src/game/dayNightLighting.ts`, `src/components/IsometricWorldCanvas.tsx`)**:
  - `wrapShaderTime` (`SHADER_TIME_WRAP_PERIOD = 1800`) prevents FP32 trig/shader drift in long sessions, and static pre-allocated `TIME_OF_DAY_PRESETS` avoid per-frame lighting allocations.
  - `streetPoleMat` updates are cached per epoch, and the pooled 3rd `PointLight` luminous-creature scan is throttled to **10 Hz** (`0.1s`) with unit-ID caching.
- **Eliminated Startup Browser Freeze (`IsometricWorldCanvas.tsx`, `treeImpostors.ts`, `chunkTerrainRenderer.ts`)**:
  - `renderer.debug.checkShaderErrors = false` prevents synchronous `gl.getProgramInfoLog()` CPU↔GPU pipeline stalls on every shader link.
  - Cut PBR `PointLight` count from `6 → 3` to shrink PBR shader compile time and per-pixel fragment cost.
  - Hid 0-count `InstancedMesh`es (`fireSpriteInst`, `fireSmokeInst`, `particleInstanced`, `favoriteStarsInst`, `kingCrownsInst`, `unitContactShadowsInst`) so Three.js doesn't compile their shaders on Frame 0.
  - **4-frame staged startup reveal** (`space+ocean → terrain+clouds → props+trees → buildings+units`) paired with **center-outward progressive terrain chunk streaming** (`4 chunks/frame`), **lazy frame-sliced impostor baking** (deferred until `frustumSize >= 36`, baking 1 species every 2nd frame with full viewport/scissor save & restore), and **per-frame hydration budgets** (`12 buildings/frame`, `12 units/frame`).
- **30 Hz Shadow Refresh & Throttled Map Syncs**: Shadow maps refresh at 30 Hz (plus immediate refresh on camera movement), full-map prop scans debounce at `~5.5 Hz`, and `oceanFoam`/`styledTerrain`/`zoneOverlay` texture rebuilds throttle to `~8 Hz` during continuous terraforming or disasters.

### E. God Powers, Simulation, Pathfinding & Spatial Indexing
- **`SpatialTickIndex` (`src/game/spatialIndex.ts`)**: Uniform spatial hash grid with pooled cell bucket arrays rebuilt per simulation tick for `O(1)` radius queries across units and buildings during combat, AI, and aura updates.
- **Hierarchical Pathfinding (`src/game/pathfinding.ts`)**: `flatqueue`-backed `FlowFieldManager` and `CoarseChunkGraph` route armies across `512×512` maps around water walls without per-unit A* spikes.
- **Cached Unit Stat Calculation (`src/game/unitCustomization.ts`)**: `computeUnitEffectiveStats` uses a structural `WeakMap` cache that invalidates automatically on trait, gene, item, or `statBonuses` mutations.
- **Batched Sky Drops & Eliminated Full-Map Tile Scans (`src/game/simulation.ts`)**:
  - `executeTerrainDropBatchImpact` applies 300+ tile sky drops in a single sync pass.
  - Replaced all `for (const t of state.tiles)` loops in `executeGodPowerImpact`, `executeHugeAsteroidImpact`, `starfall_aurora`, and per-tick `activeHazards` (`rain_cloud`, `tornado_vortex`, `wormhole_rift`, `tsunami_wave`, `nuke_blast`, `whirlpool`, `alien_mothership`, `orbital_beam`) with zero-allocation `forEachTileInRadius` / `forEachTileInBounds` (`50×–2,000×` faster).
  - Replaced `stepVoidGooAndWisps`'s `0.48s` full-map scan with an `O(frontier)` `WeakMap<SimulationState, Set<number>>` (`voidGooFrontierByState`) that prunes cured and interior tiles.
- **Disaster & Warfare VFX Draw-Call, Triangle & Particle Fixes (`src/components/IsometricWorldCanvas.tsx`)**:
  - **Tsunami Wave**: `340 draw calls → 4 draw calls` (4 pre-baked `InstancedMesh`es for all 68 wave segments).
  - **Asteroid / Huge Asteroid**: `~50,000 tris & 61 draw calls → ~1,600 tris & ~20 draw calls` (1 merged `sharedAsteroidPlumeGeo`, 1 `InstancedMesh` for 24 ejecta boulders using 24-tri `sharedEjectaBoulderGeo`, and 20 Hz throttled comet-trail particle bursts).
  - **Volcano Eruption**: `90 draw calls → ~30 draw calls` (20 cone blocks → 2 merged meshes; 48 lava stream blocks → 6 merged step rings).
  - **Rain Cloud**: `47 draw calls → 8 draw calls` (40 raindrops collapsed into 1 `InstancedMesh`).
  - **Continental & Race-Unique Projectiles**: Continuous in-flight trail particle emissions (`icbm_missile`, `elf_starfall_spell`, `orc_siege_boulder`, `orc_waagh_rocket`, `dwarf_quake_mortar`, `lizard_solar_lance`, `missile`, `bomb`, `cannon_shell`, `arcane_bolt`, `ice_ball`, `foxfire_ball`, `venom_ball`) are gated at **~20 Hz** (`0.05s`) via `trailParticleAccum` so large wars never thrash the 650-particle pool.

### F. React UI, Inspector & HUD Throttling (`src/App.tsx`, `src/components/*.tsx`)
- Wrapped `IsometricWorldCanvas`, `CityInspectorCard`, `EntityInspectorCard`, `AgeProgressBanner`, and `PerformanceHud` in `React.memo`.
- **Gated `hoverTile` Updates (`src/App.tsx`)**: `handleHoverTileChange` only writes `hoverTile` state when Inspect or Zones UI is active, eliminating 60 Hz full-`App` re-renders while moving the cursor during normal gameplay.
- **Throttled HUD & Zone Syncs**: `onSyncHud` runs at `<= 5.5 Hz` (`0.18s`), `onPerfTelemetry` at `4 Hz` (`0.25s`, idle when hidden), `zoneCacheKey`/`kingdomLabelsKey` at `Math.floor(hudTick / 10)`, `warFrontRefreshTick` at `Math.floor(hudTick / 3)`, reusable `Uint8Array` zone overlay buffers (`zoneColorBufRef`/`zoneIdBufRef`), and gated key-string generation so unused zone/war keys allocate nothing.
- **Bounded Inspector & Modal Scans**:
  - `CityInspectorCard` uses a single `sim.buildings` pass, `O(1)` `BUILDING_DEF_BY_TYPE` lookup, and a bounded settlement-footprint tile scan (+20-tile farm margin) instead of scanning all 262k map tiles inside React render.
  - World Info modal uses an `O(1)` `UNIT_DEF_BY_ROLE` map instead of `UNITS.find(...)` inside the `sim.units` loop.
- **`AgeProgressBanner` Zero-Idle Canvas Burst**: Caches the procedural pixel bezel data URL at module scope and runs its celebratory particle `<canvas>` `requestAnimationFrame` loop only during active impact bursts (halting automatically once particles expire).

### G. Graphics Settings (`src/components/GraphicsSettingsPanel.tsx`, `src/game/graphics.ts`)
- Custom pixel-themed dropdowns (`PixelDropdown` using `px-btn`, `px-btn-active`, `px-panel`) for **Quality**, **Shadows**, **Clouds & Sky**, **Foliage**, **Effects**, and **Performance Mode** (`Quality` / `Dynamic FPS` / `Performance`).
- Debug Performance HUD remains accessible via the hidden `F3` shortcut.

---

## 3. Developer Playbook: Applying Optimizations to Future Updates

Follow these patterns whenever adding new 3D assets, biomes, units, god powers, or UI panels so automated LOD, batching, and spatial culling work out of the box.

### Rule 1: Adding New Static Props, Resource Nodes, or Buildings (Automated LOD & Batching)
1. **Use pixel-scale primitives** in `src/game/meshBuilders.ts`:
   - Always use `pxBox`, `pxCylinder`, `pxCone`, `pxSphere`, `pxTorus` instead of raw `new THREE.SphereGeometry(r, 32, 24)`.
   - Finish every static geometry with `finalizeMergedParts(parts)` — this automatically merges parts, computes normals, and **strips invisible `-Y` underside faces**.
2. **Provide a LOD2 variant** in `NodeVariantLibrary` (`src/game/meshBuilders.ts`):
   - Pair every detailed prop array (e.g. `myNewNode`) with a simplified `myNewNodeLod2` (targeting `>= 50%` fewer triangles by dropping small sub-details while keeping the silhouette).
3. **Register in `propKindSpecs` (`src/components/IsometricWorldCanvas.tsx`)**:
   - Do **not** create new `new THREE.InstancedMesh(...)` arrays per variant.
   - Add an entry to `propKindSpecs` specifying `{ lod0, lod2, b0, b2 }` mapped to one of the 5 existing `BatchedStaticPool` buckets (`0=std+shadow, 1=std+noShadow, 2=crystal+shadow, 3=crystal+noShadow, 4=coral+noShadow`).
   - This automatically gives the new prop **0 extra draw calls**, **exact OBB culling**, and **automatic zoom LOD switching**.
4. **Buildings & Monuments**:
   - Register new building types in `src/game/batchedBuildings.ts` (`BatchedBuildingSystem`). It automatically normalizes geometries, strips `-Y` faces, assigns O(1) material buckets, and switches between LOD0 and LOD1 at `frustumSize >= 46`.
   - For World Wonders or landmarks, share neutral pixel-art PBR materials with vertex-colored merged geometries and `-Y` stripping (see `src/game/monumentsSystem.ts`).

### Rule 2: Adding New Voxel Trees or Biomes (Automated 4-Tier LOD + Impostors)
1. Add the new tree generator to `src/game/voxelTrees.ts` inside `buildVoxelTreeLods(...)`.
   - `toGreedyBufferGeometry` and `toDownsampledGreedyBufferGeometry` automatically generate **LOD0, LOD1, LOD2, LOD3** and strip `-Y` faces.
2. Add the biome key to `TREE_BIOME_KEYS` (`IsometricWorldCanvas.tsx`) and `IMPOSTOR_BIOME_ORDER` (`src/game/treeImpostors.ts`).
   - Verify the total species count stays within the `2048×2048` atlas budget (`(ATLAS_COLS * ATLAS_ROWS) / 8 = 128` live+burnt species).
3. Both `treeBatchShadow`/`treeBatchNoShadow` and `TreeImpostorSystem.stepBake()` will automatically pick up the new species with **0 extra draw calls** and **noon-calibrated lighting**.

### Rule 3: Adding New Units, Wildlife, or Vehicles
- **Keep draw calls per entity low (`<= 6–8`)**: Merge all static/non-articulated sub-parts (eyes, ears, horns, saddle, armor plates) into a single `BufferGeometry` per pivot using `mergeGeometries` before attaching to the animated rig.
- **Reuse shared materials**: Never create `new THREE.MeshStandardMaterial()` inside a per-unit spawn loop if the color/roughness can be quantized or shared via a material cache.
- **Batched crowd compatibility**: Ensure new unit roles build cleanly via `createUnitGroup(...)` so `BatchedUnitSystem` can bake them into the 2-draw-call crowd pools at far zoom.
- **Contact shadows**: Units automatically share `unitContactShadowsInst` (1 draw call for all units) — do not add per-unit shadow disc meshes.
- **Hide empty overlays**: Keep optional indicators (`status_ring`, `held_tool`) `visible = false` when inactive or zoomed out.

### Rule 4: Adding New God Powers, Disasters & Projectiles (Zero-Lag Rules)
1. **Simulation (`src/game/simulation.ts`)**:
   - **NEVER** write `for (const t of state.tiles)` for a localized power, hazard, or spreading terrain effect.
   - Use `forEachTileInRadius(state, cx, cz, radius, (t, dSq) => { ... })` or `forEachTileInBounds(...)` for localized impacts, and a `WeakMap<SimulationState, Set<number>>` frontier set (like `voidGooFrontierByState` or `worldGrid.activeFireTiles`) for spreading effects.
2. **3D Visuals (`src/components/IsometricWorldCanvas.tsx`)**:
   - **Never spawn N separate `THREE.Mesh`es in a loop** for debris, raindrops, wave segments, embers, or lava blocks.
   - If sub-parts move independently (raindrops, wave segments, ejecta boulders): use **1 `THREE.InstancedMesh`** with a shared low-poly geometry (and call `.dispose()` when the hazard/FX ends).
   - If sub-parts move together (volcano cone, mushroom plume, static ring): merge them once with `mergeGeometries` into **1 mesh**.
   - **Never reuse high-poly hero meshes** (like `sharedMeteorGeo`) for small debris or smoke clouds.
3. **Particles**:
   - Gate continuous trail/ambient particle bursts with a `dt` timer (`~15–20 Hz`, `0.05s–0.08s`) rather than calling `spawnParticleBurst` / `spawnRisingParticles` every frame, so the 650-particle pool isn't thrashed.
4. **Custom Render Targets / Offscreen Passes**:
   - If any future feature renders to a `WebGLRenderTarget` inside the animation loop, **always** save and restore `prevTarget`, `prevViewport`, `prevScissor`, `prevScissorTest`, `prevClearColor`, `prevAutoClear`, `prevShadowEnabled`, and `prevToneMapping`.

### Rule 5: React UI, Inspector Cards & Modals (Zero-Lag Rules)
- **NEVER scan `sim.tiles` inside a React component render**: Always bound tile queries to the relevant settlement/area bbox or read precomputed counters from simulation state.
- **Use `O(1)` catalog lookup `Map`s**: Never call `UNITS.find(...)` or `BUILDINGS.find(...)` inside loops over `sim.units` or `sim.buildings`.
- **Gate high-frequency callbacks**: Never forward 60 Hz pointer/hover callbacks into top-level `App` `setState` when no visible panel consumes them.
- **Memoize overlay panels & stop idle rAF loops**: Wrap HUD/inspector/banner components in `React.memo`, and only run `<canvas>` `requestAnimationFrame` loops while particles/animations are actively alive.

---

## 4. Verification & Regression Checklist

Run these before merging any new model, biome, or god power:

```bash
# 1. Type check & production bundle
npx tsc --noEmit && npm run build

# 2. Optimization, rendering, and mobile camera regression suites
npx tsx --test src/game/optimization.test.ts src/game/skyAndSea.test.ts src/game/cameraTouch.test.ts

# 3. Simulation & god-power regression suite
npx tsx --test src/game/simulation.test.ts
```

Press **`F3`** in-game to inspect live **FPS**, **Frame Time (ms)**, **Draw Calls**, **Triangles**, **Visible Chunks**, and **Sim Tick (ms)** against the targets in Section 1.
