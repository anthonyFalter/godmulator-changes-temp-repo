# Godmulator Optimization & Scaling Plan

**Goal:** Eliminate lag across **all map sizes** (from small islands to massive $512 \times 512+$ worlds) while supporting hundreds of active villagers, evolving civilizations, and large-scale wars at a locked 60 FPS—**with zero visual compromises**.

## Core Principles

1. **100% Visual Parity (Lossless Optimization):** No hiding units or trees on zoom-out, no downgrading art or pixel density, and no altering the isometric aesthetic. Every optimization below produces a pixel-for-pixel identical frame—just computed far more efficiently.
2. **Map-Size Agnostic Architecture:** Remove hardcoded size bottlenecks by using dynamic chunk grids, flat memory buffers, and $O(1)$ spatial lookups so performance depends primarily on what is *visible* and *active*, not the total map dimensions.

---

## Performance Targets (All Map Sizes)

| Metric | Current Baseline (Fill In) | Target (Zoomed In) | Target (Full Map View) |
| :--- | :--- | :--- | :--- |
| **Frame Rate (FPS)** | *TBD* | 60 FPS | 60 FPS |
| **Draw Calls** | *TBD* | $< 100$ | $< 150$ |
| **Main-Thread JS Time** | *TBD* | $< 4\text{ ms}$ | $< 4\text{ ms}$ |
| **Simulation Tick Time** | *TBD* | $< 5\text{ ms}$ (at 10–15 Hz) | $< 5\text{ ms}$ (at 10–15 Hz) |
| **GC Pause Spikes** | *TBD* | $0\text{ ms}$ (zero per-frame allocs) | $0\text{ ms}$ (zero per-frame allocs) |

---

## Phase 0: Profiling & Baseline Diagnostics

*Before refactoring, measure where the frame budget is actually being spent across different map sizes so every optimization is verified with hard numbers.*

- [ ] **Add a lightweight Debug HUD** displaying:
  - FPS and frame time ($\text{ms}$)
  - Active draw calls and triangle count (e.g., `renderer.info.render.calls` and `.triangles`)
  - Visible chunks vs. total chunks
  - Active unit count and last simulation tick duration ($\text{ms}$)
- [ ] **Record 5-second Chrome DevTools Performance traces** across:
  1. Small vs. Large map at full zoom-out.
  2. Zoomed-in view over a dense forest and active village.
  3. Mid/late-game scenario with active building, gathering, and warfare.
- [ ] **Pinpoint the dominant bottleneck:**
  - *Draw calls $> 300$:* Prioritize **Phase 1 & Phase 2**.
  - *High GPU fragment/pixel time:* Prioritize **Phase 2 (Overdraw & Alpha Cutout)**.
  - *High JS scripting or GC spikes:* Prioritize **Phase 3 & Phase 4**.

---

## Phase 1: Map-Size-Agnostic Terrain Chunking & Lossless Meshing

*Replace individual tile meshes with chunked, culled geometry. This keeps the exact same voxel/blocky appearance while slashing draw calls and triangle counts by 70–95%.*

- [ ] **Dynamic Chunk Grid:**
  - Partition any map of size $W \times H$ into fixed chunks of $16 \times 16$ or $32 \times 32$ tiles (calculating `chunksX = Math.ceil(W / CHUNK_SIZE)` dynamically).
  - Merge all terrain tiles in each chunk into a **single `BufferGeometry`**.
- [ ] **Hidden Face Culling (Lossless):**
  - Never generate geometry for the bottom of terrain blocks.
  - Skip generating any side face where the adjacent tile is solid and has height $\ge$ the current tile's height.
  - *Visual impact:* None—these faces are completely occluded by neighboring blocks.
- [ ] **Greedy Meshing (Lossless):**
  - Within each chunk, merge adjacent coplanar faces that share the same biome/material/elevation into larger quads (using tiled UVs or vertex colors/texture arrays).
  - Flat water bodies, snow plateaus, and cliff walls collapse from hundreds of tiny quads into a handful of triangles without changing a single rendered pixel.
- [ ] **Dirty-Flag Chunk Rebuilding:**
  - Only rebuild a chunk's geometry when a tile inside it (or on its 1-tile border) actually changes (e.g., terraforming, melting snow, building foundations).
  - Offload chunk geometry generation to a **Web Worker** using transferable `ArrayBuffer`s so rebuilding chunks never causes a frame hitch.
- [ ] **Camera Frustum Culling:**
  - Compute exact bounding boxes for each chunk and skip rendering chunks outside the camera's orthographic/isometric frustum when zoomed in.

---

## Phase 2: Lossless Entity, Foliage & Prop Batching

*Dense forests, crystals, rocks, huts, and villagers are usually the biggest draw-call multiplier. Batching them preserves every single asset on screen while collapsing thousands of draw calls into a few.*

- [ ] **`InstancedMesh` for All Repeated Assets:**
  - Batch trees, rocks, crystals, clouds, buildings, and units into `InstancedMesh` groups instead of individual scene objects.
  - Rendering 10,000 trees drops from 10,000 draw calls to **1–5 draw calls**.
- [ ] **Texture Atlases + Per-Instance UV Offsets:**
  - Pack similar assets (e.g., all tree variants, all rock/crystal variants, all villager/soldier sprites) into shared Texture Atlases.
  - Pass per-instance UV rect offsets via an `InstancedBufferAttribute` so all variants render in a **single draw call** with identical pixel art.
- [ ] **Eliminate Alpha Overdraw (Crisp Pixel-Art Cutout):**
  - For opaque pixel-art sprites and foliage billboards, replace `transparent: true` (alpha blending) with `alphaTest: 0.5` (hard cutout) and `depthWrite: true`.
  - *Why this is lossless:* Crisp pixel art doesn't need semi-transparent edge blending; `alphaTest` enables hardware Early-Z rejection, preventing the GPU from shading overlapping trees behind front trees—massive GPU speedup in dense forests and zoomed-out views.
- [ ] **Separate Static vs. Dynamic Instance Buffers:**
  - **Static Props (trees, rocks, huts):** Only update the GPU instance matrix buffer when an object is placed, chopped, or destroyed. Never rewrite static matrices every frame.
  - **Dynamic Entities (villagers, soldiers, animals):** Update only active, moving instances in a pre-allocated buffer each frame.
- [ ] **Move Ambient Animations to Shaders:**
  - Handle water ripples, shoreline foam, cloud drift, and subtle foliage sway inside vertex/fragment shaders using a single `uTime` uniform instead of updating transforms on the CPU.

---

## Phase 3: Simulation, AI & Large-Scale War Optimization

*Civilization logic, gathering, and multi-faction wars run entirely on the CPU. Optimizing these systems has zero impact on visuals and prevents frame drops as populations grow.*

- [ ] **Decouple Simulation Tick from Render Frame Rate:**
  - Render at 60 FPS (or monitor refresh rate), but run AI decisions, economy, and combat ticks at a fixed lower rate (e.g., 10–15 Hz).
  - Store `prevX, prevY` and `currX, currY` for units and linearly interpolate (`lerp`) their rendered positions each frame for butter-smooth 60 FPS movement.
- [ ] **Spatial Hashing (Uniform 2D Grid):**
  - Replace all $O(N^2)$ unit-to-unit loops ("find nearest enemy", "find nearest tree") with a flat 2D spatial hash grid (e.g., $4 \times 4$ tile buckets).
  - Entities only inspect their current bucket and the 8 neighboring buckets ($O(1)$ average lookup), scaling effortlessly to thousands of fighting units.
- [ ] **Scalable Pathfinding for Wars (Flow Fields & HPA\*):**
  - **Individual tasks (villagers):** Use time-sliced A\* with a per-frame pathfinding budget (e.g., max 20 path requests per tick) so pathfinding never spikes frame time.
  - **Armies & Wars:** Use **Flow Fields** (Dijkstra maps) per war target or city. One flow field calculation lets 500 soldiers march around mountains and water simultaneously at nearly zero per-unit CPU cost.
  - **Large Maps:** Add a coarse **Hierarchical (HPA\*)** region graph (e.g., 1 node per chunk) so cross-map pathing on huge maps doesn't search thousands of individual tiles.
- [ ] **Data-Oriented Storage (Structure of Arrays) & Object Pooling:**
  - Store unit and tile states in flat `TypedArray`s (`Float32Array` for positions/HP, `Uint16Array` for states/targets, `Uint8Array` for faction/age) instead of arrays of nested JS objects.
  - Pre-allocate pools for projectiles, damage numbers, and units to eliminate Garbage Collection (GC) stutters during battles.
- [ ] **Offload Simulation & Pathfinding to Web Workers:**
  - Run heavy simulation ticks, diplomacy, and pathfinding inside a dedicated Web Worker.
  - Sync compact `TypedArray` transform buffers back to the main thread for `InstancedMesh` rendering (using double-buffering or `SharedArrayBuffer` where supported).

---

## Phase 4: Memory & Architecture for Any Map Size

*Ensure small maps use minimal memory and massive maps ($256 \times 256$, $512 \times 512$, and beyond) load quickly and stay within browser memory limits.*

- [ ] **Flat 1D TypedArray World Grid:**
  - Store map data in flat 1D buffers indexed by `idx = y * mapWidth + x`:
    - `heightMap`: `Uint8Array` or `Int16Array`
    - `biomeMap`: `Uint8Array`
    - `resourceMap`: `Uint16Array`
    - `ownershipMap`: `Uint16Array` (civilization ID)
  - *Memory impact:* A $512 \times 512$ map (262,144 tiles) takes only ~1.5 MB total in flat arrays versus 50–100+ MB as JS tile objects.
- [ ] **Async / Progressive Map Generation:**
  - Generate terrain noise, biomes, and initial chunk meshes asynchronously (in a Web Worker or sliced across frames) so large maps never freeze the browser tab on startup.
- [ ] **Dynamic Instance Buffer Capacity:**
  - Size `InstancedMesh` capacities dynamically based on map area and population, resizing cleanly in chunks (e.g., growing by $1.5\times$) rather than allocating massive fixed buffers on small maps.

---

## Recommended Execution Order

1. **Profile First (Phase 0):** Capture your exact draw call count and frame breakdown.
2. **Terrain Chunking + Hidden Face Culling (Phase 1):** Biggest immediate drop in terrain draw calls and triangles across all map sizes.
3. **`InstancedMesh` + `alphaTest` for Trees & Props (Phase 2):** Eliminates forest draw-call and overdraw bottlenecks with identical visuals.
4. **Decoupled Sim Tick + Spatial Hashing (Phase 3):** Unlocks high populations and smooth warfare.
5. **Greedy Meshing, Flow Fields & Web Workers (Phases 1 & 3):** Pushes the engine to handle massive maps and huge armies effortlessly.