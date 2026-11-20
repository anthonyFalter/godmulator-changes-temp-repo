import * as Comlink from 'comlink';
import type { TerrainWorkerApi } from './terrainWorker';
import {
  TerrainChunkMeshData,
  buildTerrainChunkGeometryData,
} from './terrainMesher';
import { createInitialSimulationState } from './simulation';
import { SimulationState, WorldGenConfig } from './types';

interface WorkerSlot {
  worker: Worker;
  api: Comlink.Remote<TerrainWorkerApi>;
  inFlight: number;
}

/**
 * Comlink-powered Web Worker pool for background terrain chunk meshing and non-blocking
 * 384x384 / 512x512 world generation. Gracefully falls back to synchronous execution in
 * non-Worker environments (such as Node.js unit tests).
 */
export class EngineWorkerPool {
  private slots: WorkerSlot[] = [];
  private disposed = false;
  private totalPending = 0;

  constructor(poolSize?: number) {
    if (typeof Worker === 'undefined') return;
    const hw = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 2;
    const count = Math.max(1, Math.min(poolSize ?? Math.min(3, Math.max(1, hw - 1)), 4));

    for (let i = 0; i < count; i++) {
      try {
        const worker = new Worker(new URL('./terrainWorker.ts', import.meta.url), {
          type: 'module',
        });
        const api = Comlink.wrap<TerrainWorkerApi>(worker);
        this.slots.push({ worker, api, inFlight: 0 });
      } catch {
        // Fallback silently if Worker instantiation fails in restricted contexts
        break;
      }
    }
  }

  getPendingCount(): number {
    return this.totalPending;
  }

  hasWorkers(): boolean {
    return this.slots.length > 0 && !this.disposed;
  }

  private pickLeastBusySlot(): WorkerSlot | null {
    if (this.slots.length === 0 || this.disposed) return null;
    let best = this.slots[0];
    for (let i = 1; i < this.slots.length; i++) {
      if (this.slots[i].inFlight < best.inFlight) {
        best = this.slots[i];
      }
    }
    return best;
  }

  /**
   * Meshes a single terrain chunk asynchronously in a worker with zero-copy buffer return.
   */
  async meshChunkAsync(
    heightMap: Uint8Array,
    terrainCodeMap: Uint8Array,
    crushedMask: Uint8Array,
    gridSize: number,
    chunkX: number,
    chunkZ: number,
    chunkSize: number,
    yOverrides?: Float32Array | null,
  ): Promise<TerrainChunkMeshData> {
    const slot = this.pickLeastBusySlot();
    if (!slot) {
      return buildTerrainChunkGeometryData(
        heightMap,
        terrainCodeMap,
        crushedMask,
        gridSize,
        chunkX,
        chunkZ,
        chunkSize,
        yOverrides,
      );
    }

    slot.inFlight++;
    this.totalPending++;
    try {
      return await slot.api.meshChunk(
        heightMap,
        terrainCodeMap,
        crushedMask,
        gridSize,
        chunkX,
        chunkZ,
        chunkSize,
        yOverrides ?? null,
      );
    } finally {
      slot.inFlight = Math.max(0, slot.inFlight - 1);
      this.totalPending = Math.max(0, this.totalPending - 1);
    }
  }

  /**
   * Generates a complete `SimulationState` off the main thread so 384x384 and 512x512
   * worlds never freeze the browser UI.
   */
  async generateWorldAsync(
    gridSize: number,
    seed: number,
    config?: Partial<WorldGenConfig>,
    onProgress?: (pct: number, stage: string) => void,
  ): Promise<SimulationState> {
    const slot = this.pickLeastBusySlot();
    if (!slot) {
      onProgress?.(20, `Generating ${gridSize}×${gridSize} world...`);
      const st = createInitialSimulationState(gridSize, seed, config);
      onProgress?.(100, 'World ready!');
      return st;
    }

    slot.inFlight++;
    this.totalPending++;
    try {
      const proxyCb = onProgress ? Comlink.proxy(onProgress) : undefined;
      return await slot.api.generateWorld(gridSize, seed, config, proxyCb);
    } catch {
      // Safe fallback to main thread if worker fails for any reason
      onProgress?.(50, 'Finalizing world...');
      const st = createInitialSimulationState(gridSize, seed, config);
      onProgress?.(100, 'World ready!');
      return st;
    } finally {
      slot.inFlight = Math.max(0, slot.inFlight - 1);
      this.totalPending = Math.max(0, this.totalPending - 1);
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const slot of this.slots) {
      try {
        slot.api[Comlink.releaseProxy]();
      } catch {
        // Ignore release errors
      }
      slot.worker.terminate();
    }
    this.slots.length = 0;
    this.totalPending = 0;
  }
}

let sharedWorldGenPool: EngineWorkerPool | null = null;

export function getSharedWorldGenPool(): EngineWorkerPool {
  if (!sharedWorldGenPool) {
    sharedWorldGenPool = new EngineWorkerPool(1);
  }
  return sharedWorldGenPool;
}
