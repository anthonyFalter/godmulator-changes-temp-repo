import {
  CHUNK_SIZE,
  TERRAIN_BOTTOM_Y,
  getTileTopYFromCode,
  isNonShadowTerrainCode,
} from './worldGrid';

export interface TerrainChunkMeshData {
  chunkX: number;
  chunkZ: number;
  /** Land + walkway top faces (casts shadows, uses chunkTopMat) */
  landTopPositions: Float32Array;
  landTopNormals: Float32Array;
  landTopIndices: Uint32Array;
  /** Exposed cliff side faces (casts shadows, uses cliffMat) */
  cliffPositions: Float32Array;
  cliffNormals: Float32Array;
  cliffIndices: Uint32Array;
  /** Submerged ocean/shallow/sea-ice seabed top faces (no shadow casting, uses chunkTopMat) */
  waterTopPositions: Float32Array;
  waterTopNormals: Float32Array;
  waterTopIndices: Uint32Array;
  /** Exact chunk AABB for Three.js frustum culling */
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
  triangleCount: number;
}

/**
 * Pure, Worker-safe Hidden-Face-Culled + Lossless Greedy Terrain Chunk Mesher.
 *
 * Why it is 100% pixel-for-pixel identical to individual 1x1 BoxGeometry tiles:
 * - `styledTerrain` top & cliff shaders compute ALL biome textures, borders, micro-pixels,
 *   roughness/metalness, city night glow, and zone overlays solely from interpolated world
 *   position (`vLandWorldPos`) and face normal (`vLandWorldNormal`) + `uLandMap` DataTexture!
 * - Merging adjacent coplanar top faces of identical elevation (`topY`) and shadow group
 *   interpolates `vLandWorldPos.xz` linearly across the merged quad with zero visual deviation.
 * - Merging adjacent coplanar cliff wall strips of identical `(topY, bottomY)` along X or Z
 *   interpolates `vLandWorldPos` identically while eliminating buried internal & bottom faces!
 */
export function buildTerrainChunkGeometryData(
  heightMap: Uint8Array,
  terrainCodeMap: Uint8Array,
  crushedMask: Uint8Array,
  gridSize: number,
  chunkX: number,
  chunkZ: number,
  chunkSize = CHUNK_SIZE,
  yOverrides?: Float32Array | null,
): TerrainChunkMeshData {
  const startX = chunkX * chunkSize;
  const startZ = chunkZ * chunkSize;
  const endX = Math.min(gridSize, startX + chunkSize);
  const endZ = Math.min(gridSize, startZ + chunkSize);
  const w = Math.max(0, endX - startX);
  const h = Math.max(0, endZ - startZ);

  const getTopY = (x: number, z: number): number => {
    if (x < 0 || z < 0 || x >= gridSize || z >= gridSize) return TERRAIN_BOTTOM_Y;
    const idx = z * gridSize + x;
    if (yOverrides && idx < yOverrides.length) {
      return yOverrides[idx];
    }
    return getTileTopYFromCode(
      heightMap[idx],
      terrainCodeMap[idx],
      crushedMask[idx] !== 0,
    );
  };

  // Quantize Y to millimeter integer keys so floating point jitter never prevents clean merges
  const quantizeY = (y: number): number => Math.round(y * 1000);

  // Precompute local topY + shadow group for this chunk
  const localTopY = new Float32Array(w * h);
  const localTopQ = new Int32Array(w * h);
  const localIsWater = new Uint8Array(w * h);
  const visited = new Uint8Array(w * h);

  let maxY = TERRAIN_BOTTOM_Y;
  let minY = 1e9;

  for (let lz = 0; lz < h; lz++) {
    const wz = startZ + lz;
    for (let lx = 0; lx < w; lx++) {
      const wx = startX + lx;
      const idx = wz * gridSize + wx;
      const li = lz * w + lx;
      const ty = getTopY(wx, wz);
      localTopY[li] = ty;
      localTopQ[li] = quantizeY(ty);
      localIsWater[li] = isNonShadowTerrainCode(heightMap[idx], terrainCodeMap[idx]) ? 1 : 0;
      if (ty > maxY) maxY = ty;
      if (ty < minY) minY = ty;
    }
  }

  const landTopPos: number[] = [];
  const landTopNorm: number[] = [];
  const landTopIdx: number[] = [];

  const waterTopPos: number[] = [];
  const waterTopNorm: number[] = [];
  const waterTopIdx: number[] = [];

  const cliffPos: number[] = [];
  const cliffNorm: number[] = [];
  const cliffIdx: number[] = [];

  const pushQuad = (
    posArr: number[],
    normArr: number[],
    idxArr: number[],
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    x3: number,
    y3: number,
    z3: number,
    nx: number,
    ny: number,
    nz: number,
  ) => {
    const base = posArr.length / 3;
    posArr.push(x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3);
    normArr.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
    idxArr.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  // 1. Greedy 2D meshing of top faces (+Y normal, CCW from above: (x0,z0)->(x0,z1)->(x1,z1)->(x1,z0))
  for (let lz = 0; lz < h; lz++) {
    for (let lx = 0; lx < w; lx++) {
      const li = lz * w + lx;
      if (visited[li]) continue;

      const keyQ = localTopQ[li];
      const isWater = localIsWater[li];
      const ty = localTopY[li];

      // Expand width along +X
      let quadW = 1;
      while (lx + quadW < w) {
        const nli = lz * w + (lx + quadW);
        if (visited[nli] || localTopQ[nli] !== keyQ || localIsWater[nli] !== isWater) break;
        quadW++;
      }

      // Expand height along +Z
      let quadH = 1;
      outerH: while (lz + quadH < h) {
        const rowOff = (lz + quadH) * w;
        for (let kx = 0; kx < quadW; kx++) {
          const nli = rowOff + lx + kx;
          if (visited[nli] || localTopQ[nli] !== keyQ || localIsWater[nli] !== isWater) {
            break outerH;
          }
        }
        quadH++;
      }

      // Mark visited
      for (let kz = 0; kz < quadH; kz++) {
        const rowOff = (lz + kz) * w;
        for (let kx = 0; kx < quadW; kx++) {
          visited[rowOff + lx + kx] = 1;
        }
      }

      const x0 = startX + lx - 0.5;
      const x1 = startX + lx + quadW - 0.5;
      const z0 = startZ + lz - 0.5;
      const z1 = startZ + lz + quadH - 0.5;

      if (isWater) {
        pushQuad(
          waterTopPos,
          waterTopNorm,
          waterTopIdx,
          x0,
          ty,
          z0,
          x0,
          ty,
          z1,
          x1,
          ty,
          z1,
          x1,
          ty,
          z0,
          0,
          1,
          0,
        );
      } else {
        pushQuad(
          landTopPos,
          landTopNorm,
          landTopIdx,
          x0,
          ty,
          z0,
          x0,
          ty,
          z1,
          x1,
          ty,
          z1,
          x1,
          ty,
          z0,
          0,
          1,
          0,
        );
      }
    }
  }

  // 2. Hidden-face-culled + greedy horizontal strip merging for exposed cliff walls
  // North (-Z) and South (+Z) walls run along X for each row lz
  for (let lz = 0; lz < h; lz++) {
    const wz = startZ + lz;
    const zNorth = wz - 0.5;
    const zSouth = wz + 0.5;

    // -Z wall (normal: 0, 0, -1), outward facing -Z
    let lx = 0;
    while (lx < w) {
      const wx = startX + lx;
      const myTop = localTopY[lz * w + lx];
      const nbTop = getTopY(wx, wz - 1);
      if (myTop <= nbTop + 1e-4) {
        lx++;
        continue;
      }
      const myTopQ = localTopQ[lz * w + lx];
      const nbTopQ = quantizeY(nbTop);
      let run = 1;
      while (lx + run < w) {
        const nwx = startX + lx + run;
        const nMyTopQ = localTopQ[lz * w + lx + run];
        const nNbTop = getTopY(nwx, wz - 1);
        if (nMyTopQ !== myTopQ || quantizeY(nNbTop) !== nbTopQ) break;
        run++;
      }
      const x0 = wx - 0.5;
      const x1 = wx + run - 0.5;
      // CCW viewed from -Z: (x1, top)->(x0, top)->(x0, bot)->(x1, bot)
      pushQuad(
        cliffPos,
        cliffNorm,
        cliffIdx,
        x1,
        myTop,
        zNorth,
        x0,
        myTop,
        zNorth,
        x0,
        nbTop,
        zNorth,
        x1,
        nbTop,
        zNorth,
        0,
        0,
        -1,
      );
      if (nbTop < minY) minY = nbTop;
      lx += run;
    }

    // +Z wall (normal: 0, 0, +1), outward facing +Z
    lx = 0;
    while (lx < w) {
      const wx = startX + lx;
      const myTop = localTopY[lz * w + lx];
      const nbTop = getTopY(wx, wz + 1);
      if (myTop <= nbTop + 1e-4) {
        lx++;
        continue;
      }
      const myTopQ = localTopQ[lz * w + lx];
      const nbTopQ = quantizeY(nbTop);
      let run = 1;
      while (lx + run < w) {
        const nwx = startX + lx + run;
        const nMyTopQ = localTopQ[lz * w + lx + run];
        const nNbTop = getTopY(nwx, wz + 1);
        if (nMyTopQ !== myTopQ || quantizeY(nNbTop) !== nbTopQ) break;
        run++;
      }
      const x0 = wx - 0.5;
      const x1 = wx + run - 0.5;
      // CCW viewed from +Z: (x0, top)->(x0, bot)->(x1, bot)->(x1, top)
      pushQuad(
        cliffPos,
        cliffNorm,
        cliffIdx,
        x0,
        myTop,
        zSouth,
        x0,
        nbTop,
        zSouth,
        x1,
        nbTop,
        zSouth,
        x1,
        myTop,
        zSouth,
        0,
        0,
        1,
      );
      if (nbTop < minY) minY = nbTop;
      lx += run;
    }
  }

  // West (-X) and East (+X) walls run along Z for each column lx
  for (let lx = 0; lx < w; lx++) {
    const wx = startX + lx;
    const xWest = wx - 0.5;
    const xEast = wx + 0.5;

    // -X wall (normal: -1, 0, 0), outward facing -X
    let lz = 0;
    while (lz < h) {
      const wz = startZ + lz;
      const myTop = localTopY[lz * w + lx];
      const nbTop = getTopY(wx - 1, wz);
      if (myTop <= nbTop + 1e-4) {
        lz++;
        continue;
      }
      const myTopQ = localTopQ[lz * w + lx];
      const nbTopQ = quantizeY(nbTop);
      let run = 1;
      while (lz + run < h) {
        const nwz = startZ + lz + run;
        const nMyTopQ = localTopQ[(lz + run) * w + lx];
        const nNbTop = getTopY(wx - 1, nwz);
        if (nMyTopQ !== myTopQ || quantizeY(nNbTop) !== nbTopQ) break;
        run++;
      }
      const z0 = wz - 0.5;
      const z1 = wz + run - 0.5;
      // CCW viewed from -X: (z0, top)->(z0, bot)->(z1, bot)->(z1, top)
      pushQuad(
        cliffPos,
        cliffNorm,
        cliffIdx,
        xWest,
        myTop,
        z0,
        xWest,
        nbTop,
        z0,
        xWest,
        nbTop,
        z1,
        xWest,
        myTop,
        z1,
        -1,
        0,
        0,
      );
      if (nbTop < minY) minY = nbTop;
      lz += run;
    }

    // +X wall (normal: +1, 0, 0), outward facing +X
    lz = 0;
    while (lz < h) {
      const wz = startZ + lz;
      const myTop = localTopY[lz * w + lx];
      const nbTop = getTopY(wx + 1, wz);
      if (myTop <= nbTop + 1e-4) {
        lz++;
        continue;
      }
      const myTopQ = localTopQ[lz * w + lx];
      const nbTopQ = quantizeY(nbTop);
      let run = 1;
      while (lz + run < h) {
        const nwz = startZ + lz + run;
        const nMyTopQ = localTopQ[(lz + run) * w + lx];
        const nNbTop = getTopY(wx + 1, nwz);
        if (nMyTopQ !== myTopQ || quantizeY(nNbTop) !== nbTopQ) break;
        run++;
      }
      const z0 = wz - 0.5;
      const z1 = wz + run - 0.5;
      // CCW viewed from +X: (z1, top)->(z1, bot)->(z0, bot)->(z0, top)
      pushQuad(
        cliffPos,
        cliffNorm,
        cliffIdx,
        xEast,
        myTop,
        z1,
        xEast,
        nbTop,
        z1,
        xEast,
        nbTop,
        z0,
        xEast,
        myTop,
        z0,
        1,
        0,
        0,
      );
      if (nbTop < minY) minY = nbTop;
      lz += run;
    }
  }

  const triangleCount = (landTopIdx.length + cliffIdx.length + waterTopIdx.length) / 3;
  const safeMinY = minY < 1e8 ? Math.min(minY, TERRAIN_BOTTOM_Y) : TERRAIN_BOTTOM_Y;
  const safeMaxY = Math.max(maxY, safeMinY + 0.2);

  return {
    chunkX,
    chunkZ,
    landTopPositions: new Float32Array(landTopPos),
    landTopNormals: new Float32Array(landTopNorm),
    landTopIndices: new Uint32Array(landTopIdx),
    cliffPositions: new Float32Array(cliffPos),
    cliffNormals: new Float32Array(cliffNorm),
    cliffIndices: new Uint32Array(cliffIdx),
    waterTopPositions: new Float32Array(waterTopPos),
    waterTopNormals: new Float32Array(waterTopNorm),
    waterTopIndices: new Uint32Array(waterTopIdx),
    boundsMin: [startX - 0.5, safeMinY, startZ - 0.5],
    boundsMax: [endX - 0.5, safeMaxY, endZ - 0.5],
    triangleCount,
  };
}

export function getTerrainChunkTransferables(data: TerrainChunkMeshData): ArrayBuffer[] {
  return [
    data.landTopPositions.buffer as ArrayBuffer,
    data.landTopNormals.buffer as ArrayBuffer,
    data.landTopIndices.buffer as ArrayBuffer,
    data.cliffPositions.buffer as ArrayBuffer,
    data.cliffNormals.buffer as ArrayBuffer,
    data.cliffIndices.buffer as ArrayBuffer,
    data.waterTopPositions.buffer as ArrayBuffer,
    data.waterTopNormals.buffer as ArrayBuffer,
    data.waterTopIndices.buffer as ArrayBuffer,
  ];
}
