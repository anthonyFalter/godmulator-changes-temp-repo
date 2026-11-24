import * as Comlink from 'comlink';
import {
  TerrainChunkMeshData,
  buildTerrainChunkGeometryData,
  getTerrainChunkTransferables,
} from './terrainMesher';
import type { SimulationState, WorldGenConfig } from './types';

export interface TerrainWorkerApi {
  meshChunk(
    heightMap: Uint8Array,
    terrainCodeMap: Uint8Array,
    crushedMask: Uint8Array,
    gridSize: number,
    chunkX: number,
    chunkZ: number,
    chunkSize: number,
    yOverrides?: Float32Array | null,
  ): TerrainChunkMeshData;

  generateWorld(
    gridSize: number,
    seed: number,
    config?: Partial<WorldGenConfig>,
    onProgress?: (pct: number, stage: string) => void,
  ): Promise<SimulationState>;
}

const workerApi: TerrainWorkerApi = {
  meshChunk(
    heightMap,
    terrainCodeMap,
    crushedMask,
    gridSize,
    chunkX,
    chunkZ,
    chunkSize,
    yOverrides,
  ) {
    const data = buildTerrainChunkGeometryData(
      heightMap,
      terrainCodeMap,
      crushedMask,
      gridSize,
      chunkX,
      chunkZ,
      chunkSize,
      yOverrides,
    );
    return Comlink.transfer(data, getTerrainChunkTransferables(data));
  },

  async generateWorld(gridSize, seed, config, onProgress) {
    onProgress?.(10, `Sculpting ${gridSize}×${gridSize} continents & mountain ridges...`);
    const { createInitialSimulationState } = await import('./simulation');
    const state = createInitialSimulationState(gridSize, seed, config);
    onProgress?.(92, 'Finalizing biome climate & settlements...');
    // Strip transient non-serializable caches before transferring to main thread
    if ('worldGrid' in state) {
      delete (state as { worldGrid?: unknown }).worldGrid;
    }
    onProgress?.(100, 'World ready!');
    return state;
  },
};

Comlink.expose(workerApi);
