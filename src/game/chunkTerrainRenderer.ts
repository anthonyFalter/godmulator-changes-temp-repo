import * as THREE from 'three';
import {
  CHUNK_SIZE,
  WorldGridBuffers,
  markChunkDirty,
} from './worldGrid';
import {
  TerrainChunkMeshData,
  buildTerrainChunkGeometryData,
} from './terrainMesher';
import { EngineWorkerPool } from './workerPool';
import { WorldCullBounds, isAabbIntersectingCullBounds } from './autoOptimizer';

interface TerrainChunkNode {
  chunkX: number;
  chunkZ: number;
  /** Land top + exposed cliff mesh (single unified pass or group 0/1; castsShadow dynamically culled) */
  solidMesh: THREE.Mesh;
  /** Submerged seabed / sea-ice top mesh (castsShadow = false) */
  waterMesh: THREE.Mesh;
  boundingBox: THREE.Box3;
  hasSolidGeo: boolean;
  hasWaterGeo: boolean;
  triangleCount: number;
  revision: number;
  inFlightRevision: number;
}

export interface ChunkTerrainStats {
  visibleChunks: number;
  totalChunks: number;
  totalTriangles: number;
  pendingWorkerChunks: number;
}

/**
 * Frustum- & OBB-Culled 32×32 Greedy-Meshed Terrain Chunk Renderer.
 *
 * Replaces the 24 full-map unculled BoxGeometry InstancedMeshes with `chunksPerSide²`
 * watertight greedy-meshed chunks using the exact `styledTerrain` top & cliff shaders.
 * When unified solid material is provided, each chunk draws land tops & cliffs in 1 draw call.
 * Only chunks intersecting the camera frustum + OBB are rendered, and off-frustum chunks
 * automatically disable `castShadow` to skip off-screen shadow draw calls.
 */
export class ChunkTerrainSystem {
  readonly group = new THREE.Group();
  readonly gridSize: number;
  readonly chunkSize: number;
  readonly chunksPerSide: number;
  readonly isUnifiedSolid: boolean;

  private chunks: TerrainChunkNode[] = [];
  private solidMaterial: THREE.Material | THREE.Material[];
  private waterMaterial: THREE.MeshStandardMaterial;
  private workerPool: EngineWorkerPool | null;
  private disposed = false;

  private visibleChunkCount = 0;
  private totalTriangleCount = 0;
  private pendingAsyncCount = 0;
  private scratchFrustum = new THREE.Frustum();
  private scratchProjScreenMat = new THREE.Matrix4();

  constructor(
    gridSize: number,
    chunkTopMat: THREE.MeshStandardMaterial,
    cliffMat: THREE.MeshStandardMaterial,
    workerPool: EngineWorkerPool | null = null,
    chunkSize = CHUNK_SIZE,
    unifiedSolidMat?: THREE.MeshStandardMaterial,
  ) {
    this.gridSize = gridSize;
    this.chunkSize = chunkSize;
    this.chunksPerSide = Math.ceil(gridSize / chunkSize);
    this.isUnifiedSolid = Boolean(unifiedSolidMat) || chunkTopMat === cliffMat;
    this.solidMaterial = unifiedSolidMat
      ? unifiedSolidMat
      : chunkTopMat === cliffMat
        ? chunkTopMat
        : [chunkTopMat, cliffMat];
    this.waterMaterial = chunkTopMat;
    this.workerPool = workerPool;
    this.group.name = 'chunked_terrain_root';

    const total = this.chunksPerSide * this.chunksPerSide;
    for (let cz = 0; cz < this.chunksPerSide; cz++) {
      for (let cx = 0; cx < this.chunksPerSide; cx++) {
        const solidGeo = new THREE.BufferGeometry();
        const solidMesh = new THREE.Mesh(solidGeo, this.solidMaterial);
        solidMesh.castShadow = true;
        solidMesh.receiveShadow = true;
        solidMesh.frustumCulled = true;
        solidMesh.visible = false;
        this.group.add(solidMesh);

        const waterGeo = new THREE.BufferGeometry();
        const waterMesh = new THREE.Mesh(waterGeo, this.waterMaterial);
        waterMesh.castShadow = false;
        waterMesh.receiveShadow = true;
        waterMesh.frustumCulled = true;
        waterMesh.visible = false;
        this.group.add(waterMesh);

        this.chunks.push({
          chunkX: cx,
          chunkZ: cz,
          solidMesh,
          waterMesh,
          boundingBox: new THREE.Box3(
            new THREE.Vector3(cx * chunkSize - 0.5, -0.6, cz * chunkSize - 0.5),
            new THREE.Vector3(
              Math.min(gridSize, (cx + 1) * chunkSize) - 0.5,
              8.0,
              Math.min(gridSize, (cz + 1) * chunkSize) - 0.5,
            ),
          ),
          hasSolidGeo: false,
          hasWaterGeo: false,
          triangleCount: 0,
          revision: 0,
          inFlightRevision: 0,
        });
      }
    }

    if (this.chunks.length !== total) {
      throw new Error('ChunkTerrainSystem initialization mismatch');
    }
  }

  private applyChunkData(node: TerrainChunkNode, data: TerrainChunkMeshData): void {
    const landVertCount = data.landTopPositions.length / 3;
    const cliffVertCount = data.cliffPositions.length / 3;
    const totalSolidVerts = landVertCount + cliffVertCount;

    const oldSolidGeo = node.solidMesh.geometry;
    if (totalSolidVerts > 0) {
      const solidGeo = new THREE.BufferGeometry();
      const mergedPos = new Float32Array(totalSolidVerts * 3);
      mergedPos.set(data.landTopPositions, 0);
      mergedPos.set(data.cliffPositions, landVertCount * 3);

      const mergedNorm = new Float32Array(totalSolidVerts * 3);
      mergedNorm.set(data.landTopNormals, 0);
      mergedNorm.set(data.cliffNormals, landVertCount * 3);

      const landIdxLen = data.landTopIndices.length;
      const cliffIdxLen = data.cliffIndices.length;
      const mergedIdx = new Uint32Array(landIdxLen + cliffIdxLen);
      mergedIdx.set(data.landTopIndices, 0);
      for (let i = 0; i < cliffIdxLen; i++) {
        mergedIdx[landIdxLen + i] = data.cliffIndices[i] + landVertCount;
      }

      solidGeo.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
      solidGeo.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
      solidGeo.setIndex(new THREE.BufferAttribute(mergedIdx, 1));
      solidGeo.clearGroups();
      if (!this.isUnifiedSolid) {
        if (landIdxLen > 0) solidGeo.addGroup(0, landIdxLen, 0);
        if (cliffIdxLen > 0) solidGeo.addGroup(landIdxLen, cliffIdxLen, 1);
      }

      const box = new THREE.Box3(
        new THREE.Vector3(data.boundsMin[0], data.boundsMin[1], data.boundsMin[2]),
        new THREE.Vector3(data.boundsMax[0], data.boundsMax[1], data.boundsMax[2]),
      );
      solidGeo.boundingBox = box;
      solidGeo.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
      node.solidMesh.geometry = solidGeo;
      node.hasSolidGeo = true;
      node.solidMesh.visible = true;
      node.boundingBox.copy(box);
    } else {
      node.hasSolidGeo = false;
      node.solidMesh.visible = false;
    }
    oldSolidGeo.dispose();

    const waterVertCount = data.waterTopPositions.length / 3;
    const oldWaterGeo = node.waterMesh.geometry;
    if (waterVertCount > 0) {
      const waterGeo = new THREE.BufferGeometry();
      waterGeo.setAttribute('position', new THREE.BufferAttribute(data.waterTopPositions, 3));
      waterGeo.setAttribute('normal', new THREE.BufferAttribute(data.waterTopNormals, 3));
      waterGeo.setIndex(new THREE.BufferAttribute(data.waterTopIndices, 1));
      const box = new THREE.Box3(
        new THREE.Vector3(data.boundsMin[0], data.boundsMin[1], data.boundsMin[2]),
        new THREE.Vector3(data.boundsMax[0], data.boundsMax[1], data.boundsMax[2]),
      );
      waterGeo.boundingBox = box;
      waterGeo.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
      node.waterMesh.geometry = waterGeo;
      node.hasWaterGeo = true;
      node.waterMesh.visible = true;
      if (totalSolidVerts === 0) {
        node.boundingBox.copy(box);
      }
    } else {
      node.hasWaterGeo = false;
      node.waterMesh.visible = false;
    }
    oldWaterGeo.dispose();

    this.totalTriangleCount -= node.triangleCount;
    node.triangleCount = data.triangleCount;
    this.totalTriangleCount += node.triangleCount;
  }

  /**
   * Synchronously builds all chunks (used on initial mount for instant zero-pop-in first frame
   * on small/medium maps, or for immediate chunks). On 384/512 maps, builds all chunks fast
   * (~15–30 ms total because greedy meshing operates on flat TypedArrays!).
   */
  rebuildAllSync(grid: WorldGridBuffers, yOverrides?: Float32Array | null): void {
    const cps = this.chunksPerSide;
    for (let cz = 0; cz < cps; cz++) {
      for (let cx = 0; cx < cps; cx++) {
        const idx = cz * cps + cx;
        const node = this.chunks[idx];
        node.revision++;
        const data = buildTerrainChunkGeometryData(
          grid.heightMap,
          grid.terrainCodeMap,
          grid.crushedMask,
          grid.gridSize,
          cx,
          cz,
          this.chunkSize,
          yOverrides,
        );
        this.applyChunkData(node, data);
        grid.dirtyChunks[idx] = 0;
      }
    }
    grid.dirtyChunkCount = 0;
  }

  private progressiveQueue: number[] = [];

  /**
   * Queues all terrain chunks for progressive center-outward meshing across frames
   * (prevents multi-second main-thread freeze on initial site load or large-map switches).
   */
  queueProgressiveRebuild(grid: WorldGridBuffers): void {
    const cps = this.chunksPerSide;
    const center = (cps - 1) * 0.5;
    const indices: number[] = [];
    for (let cz = 0; cz < cps; cz++) {
      for (let cx = 0; cx < cps; cx++) {
        const idx = cz * cps + cx;
        indices.push(idx);
        grid.dirtyChunks[idx] = 0;
      }
    }
    grid.dirtyChunkCount = 0;
    indices.sort((a, b) => {
      const ax = (a % cps) - center;
      const az = Math.floor(a / cps) - center;
      const bx = (b % cps) - center;
      const bz = Math.floor(b / cps) - center;
      return ax * ax + az * az - (bx * bx + bz * bz);
    });
    this.progressiveQueue = indices;
  }

  hasPendingProgressiveRebuild(): boolean {
    return this.progressiveQueue.length > 0;
  }

  /**
   * Meshes up to `maxChunksPerFrame` queued chunks (center-outward).
   * Returns `true` if more chunks remain in the queue.
   */
  stepProgressiveRebuild(
    grid: WorldGridBuffers,
    yOverrides?: Float32Array | null,
    maxChunksPerFrame = 4,
  ): boolean {
    if (this.progressiveQueue.length === 0) return false;
    const budget = Math.min(this.progressiveQueue.length, Math.max(1, maxChunksPerFrame));
    const batch = this.progressiveQueue.splice(0, budget);
    for (let k = 0; k < batch.length; k++) {
      const idx = batch[k];
      const node = this.chunks[idx];
      if (!node) continue;
      node.revision++;
      const data = buildTerrainChunkGeometryData(
        grid.heightMap,
        grid.terrainCodeMap,
        grid.crushedMask,
        grid.gridSize,
        node.chunkX,
        node.chunkZ,
        this.chunkSize,
        yOverrides,
      );
      this.applyChunkData(node, data);
      grid.dirtyChunks[idx] = 0;
    }
    return this.progressiveQueue.length > 0;
  }

  /**
   * Rebuilds any dirty chunks in `grid.dirtyChunks`.
   * Small edits (1–4 chunks, such as terraforming or active tsunami wave) rebuild synchronously
   * in the same frame (< 0.4 ms) for zero visual latency; large bulk dirty sets offload to
   * the Comlink worker pool!
   */
  flushDirtyChunks(
    grid: WorldGridBuffers,
    yOverrides?: Float32Array | null,
    preferSync = false,
    maxSyncChunksPerFrame = 0,
  ): number {
    if (grid.dirtyChunkCount <= 0) return 0;

    const dirtyIndices: number[] = [];
    const dirtyArr = grid.dirtyChunks;
    for (let i = 0; i < dirtyArr.length; i++) {
      if (dirtyArr[i] !== 0) {
        dirtyIndices.push(i);
        dirtyArr[i] = 0;
      }
    }
    grid.dirtyChunkCount = 0;
    if (dirtyIndices.length === 0) return 0;

    const useAsync =
      !preferSync &&
      dirtyIndices.length > 3 &&
      this.workerPool !== null &&
      this.workerPool.hasWorkers() &&
      !yOverrides;

    if (!useAsync) {
      const limit =
        maxSyncChunksPerFrame > 0 && dirtyIndices.length > maxSyncChunksPerFrame
          ? maxSyncChunksPerFrame
          : dirtyIndices.length;
      for (let k = 0; k < limit; k++) {
        const idx = dirtyIndices[k];
        const node = this.chunks[idx];
        node.revision++;
        const data = buildTerrainChunkGeometryData(
          grid.heightMap,
          grid.terrainCodeMap,
          grid.crushedMask,
          grid.gridSize,
          node.chunkX,
          node.chunkZ,
          this.chunkSize,
          yOverrides,
        );
        this.applyChunkData(node, data);
      }
      // Leave any remaining dirty chunks queued for the very next frame to prevent frame-time spikes
      for (let k = limit; k < dirtyIndices.length; k++) {
        const idx = dirtyIndices[k];
        dirtyArr[idx] = 1;
        grid.dirtyChunkCount++;
      }
      return limit;
    }

    // Snapshot buffers once for async worker batch so main thread mutations don't race
    const hCopy = grid.heightMap.slice();
    const tCopy = grid.terrainCodeMap.slice();
    const cCopy = grid.crushedMask.slice();

    for (let k = 0; k < dirtyIndices.length; k++) {
      const idx = dirtyIndices[k];
      const node = this.chunks[idx];
      node.revision++;
      const targetRev = node.revision;
      node.inFlightRevision = targetRev;
      this.pendingAsyncCount++;

      this.workerPool!
        .meshChunkAsync(
          hCopy,
          tCopy,
          cCopy,
          grid.gridSize,
          node.chunkX,
          node.chunkZ,
          this.chunkSize,
          null,
        )
        .then((data) => {
          this.pendingAsyncCount = Math.max(0, this.pendingAsyncCount - 1);
          if (this.disposed || node.revision !== targetRev) return;
          this.applyChunkData(node, data);
        })
        .catch(() => {
          this.pendingAsyncCount = Math.max(0, this.pendingAsyncCount - 1);
          if (!this.disposed) {
            markChunkDirty(grid, node.chunkX, node.chunkZ);
          }
        });
    }

    return dirtyIndices.length;
  }

  /**
   * Dynamically culls terrain chunks against camera frustum + rotated ground OBB, and disables
   * `castShadow` on chunks outside the shadow camera's footprint (keeping 16-tile dawn/dusk margin).
   */
  updateCulling(
    camera: THREE.Camera,
    cullBounds?: WorldCullBounds,
    shadowCenterX?: number,
    shadowCenterZ?: number,
    shadowHalfExtent?: number,
  ): ChunkTerrainStats {
    this.scratchProjScreenMat.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.scratchFrustum.setFromProjectionMatrix(this.scratchProjScreenMat);

    const hasShadowBox =
      shadowCenterX !== undefined &&
      shadowCenterZ !== undefined &&
      shadowHalfExtent !== undefined;
    const sMargin = hasShadowBox ? shadowHalfExtent! + 16.0 : 0;
    const sMinX = hasShadowBox ? shadowCenterX! - sMargin : -Infinity;
    const sMaxX = hasShadowBox ? shadowCenterX! + sMargin : Infinity;
    const sMinZ = hasShadowBox ? shadowCenterZ! - sMargin : -Infinity;
    const sMaxZ = hasShadowBox ? shadowCenterZ! + sMargin : Infinity;

    let vis = 0;
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      if (!c.hasSolidGeo && !c.hasWaterGeo) {
        c.solidMesh.visible = false;
        c.waterMesh.visible = false;
        c.solidMesh.castShadow = false;
        continue;
      }

      const b = c.boundingBox;
      const inFrustum = this.scratchFrustum.intersectsBox(b);
      const inObb =
        !cullBounds ||
        isAabbIntersectingCullBounds(b.min.x, b.max.x, b.min.z, b.max.z, cullBounds, 1.5);
      const isVis = inFrustum && inObb;

      c.solidMesh.visible = c.hasSolidGeo && isVis;
      c.waterMesh.visible = c.hasWaterGeo && isVis;
      if (isVis) vis++;

      if (c.hasSolidGeo) {
        c.solidMesh.castShadow =
          !hasShadowBox ||
          (b.max.x >= sMinX && b.min.x <= sMaxX && b.max.z >= sMinZ && b.min.z <= sMaxZ);
      } else {
        c.solidMesh.castShadow = false;
      }
    }
    this.visibleChunkCount = vis;

    return {
      visibleChunks: this.visibleChunkCount,
      totalChunks: this.chunks.length,
      totalTriangles: this.totalTriangleCount,
      pendingWorkerChunks: this.pendingAsyncCount + (this.workerPool?.getPendingCount() ?? 0),
    };
  }

  /**
   * Computes exact visible chunk count against the active camera frustum for Performance HUD telemetry.
   */
  updateVisibilityStats(camera: THREE.Camera): ChunkTerrainStats {
    this.scratchProjScreenMat.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.scratchFrustum.setFromProjectionMatrix(this.scratchProjScreenMat);

    let vis = 0;
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      if ((c.solidMesh.visible || c.waterMesh.visible) && this.scratchFrustum.intersectsBox(c.boundingBox)) {
        vis++;
      }
    }
    this.visibleChunkCount = vis;

    return {
      visibleChunks: this.visibleChunkCount,
      totalChunks: this.chunks.length,
      totalTriangles: this.totalTriangleCount,
      pendingWorkerChunks: this.pendingAsyncCount + (this.workerPool?.getPendingCount() ?? 0),
    };
  }

  getStats(): ChunkTerrainStats {
    return {
      visibleChunks: this.visibleChunkCount,
      totalChunks: this.chunks.length,
      totalTriangles: this.totalTriangleCount,
      pendingWorkerChunks: this.pendingAsyncCount + (this.workerPool?.getPendingCount() ?? 0),
    };
  }

  dispose(): void {
    this.disposed = true;
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      c.solidMesh.geometry.dispose();
      c.waterMesh.geometry.dispose();
      this.group.remove(c.solidMesh);
      this.group.remove(c.waterMesh);
    }
    this.chunks.length = 0;
    this.totalTriangleCount = 0;
    this.visibleChunkCount = 0;
  }
}
