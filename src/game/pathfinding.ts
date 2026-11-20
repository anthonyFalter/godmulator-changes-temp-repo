import FlatQueue from 'flatqueue';
import { CHUNK_SIZE, WorldGridBuffers } from './worldGrid';

export interface FlowField {
  key: string;
  targetX: number;
  targetZ: number;
  originX: number;
  originZ: number;
  width: number;
  height: number;
  /** Direction delta X in {-1, 0, 1} toward target */
  dirX: Int8Array;
  /** Direction delta Z in {-1, 0, 1} toward target */
  dirZ: Int8Array;
  /** Integration distance field (65535 = unreachable) */
  dist: Uint16Array;
  terrainVersion: number;
  lastUsedTime: number;
}

const DIRS_8: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 10],
  [-1, 0, 10],
  [0, 1, 10],
  [0, -1, 10],
  [1, 1, 14],
  [-1, 1, 14],
  [1, -1, 14],
  [-1, -1, 14],
];

const DIRS_4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Tile walkability cost (0 = impassable, > 0 = base traversal weight).
 * Roads/bridges are preferred; mountains/void_goo/deep water are penalized or blocked.
 */
export function getTileWalkCost(
  height: number,
  terrainCode: number,
  allowWater = false,
): number {
  // Void goo is hazardous
  if (terrainCode === 22) return 0;
  // Bridges / water walkways & sea ice are walkable
  if (height === 0) {
    if (terrainCode === 9 || terrainCode === 14 || terrainCode === 21) return 8;
    if (terrainCode === 23) return 12;
    return allowWater ? 26 : 0;
  }
  // Roads & rails give speed bonus
  if (terrainCode === 9 || terrainCode === 14 || terrainCode === 21) return 7;
  // Steep mountain peaks (height >= 7) are costly
  if (height >= 8) return 0;
  if (height >= 6 || terrainCode === 16) return 22;
  if (terrainCode === 7 || terrainCode === 10) return 15;
  return 10;
}

/**
 * Shared War & Settlement Flow Field Manager backed by `flatqueue`.
 * Instead of 500 soldiers running 500 individual A* searches toward the same enemy city,
 * one bounded Dijkstra flow field is computed per target and sampled by all units in O(1).
 */
export class FlowFieldManager {
  private fields = new Map<string, FlowField>();
  private queue = new FlatQueue<number>();
  private maxCachedFields: number;

  constructor(maxCachedFields = 24) {
    this.maxCachedFields = maxCachedFields;
  }

  clear(): void {
    this.fields.clear();
  }

  getCachedCount(): number {
    return this.fields.size;
  }

  /**
   * Computes or retrieves a cached flow field centered on `(targetX, targetZ)` with bounding radius `radius`.
   */
  getOrBuildFlowField(
    grid: WorldGridBuffers,
    targetX: number,
    targetZ: number,
    nowSec: number,
    radius = 64,
    allowWater = false,
  ): FlowField {
    const tx = Math.max(0, Math.min(grid.gridSize - 1, Math.round(targetX)));
    const tz = Math.max(0, Math.min(grid.gridSize - 1, Math.round(targetZ)));
    // Snap key to 2-tile bucket so nearby units targeting the same city share one field
    const key = `${tx >> 1},${tz >> 1},${radius},${allowWater ? 1 : 0}`;
    const existing = this.fields.get(key);
    if (
      existing &&
      existing.terrainVersion === grid.terrainVersion &&
      nowSec - existing.lastUsedTime < 15
    ) {
      existing.lastUsedTime = nowSec;
      return existing;
    }

    const originX = Math.max(0, tx - radius);
    const originZ = Math.max(0, tz - radius);
    const maxX = Math.min(grid.gridSize - 1, tx + radius);
    const maxZ = Math.min(grid.gridSize - 1, tz + radius);
    const width = maxX - originX + 1;
    const height = maxZ - originZ + 1;
    const count = width * height;

    const dist = new Uint16Array(count);
    dist.fill(65535);
    const dirX = new Int8Array(count);
    const dirZ = new Int8Array(count);

    const startLx = tx - originX;
    const startLz = tz - originZ;
    const startLi = startLz * width + startLx;

    const q = this.queue;
    q.clear();
    dist[startLi] = 0;
    q.push(startLi, 0);

    const gs = grid.gridSize;
    const { heightMap, terrainCodeMap } = grid;

    while (q.length > 0) {
      const curD = q.peekValue()!;
      const curLi = q.pop()!;
      if (curD > dist[curLi]) continue;

      const lx = curLi % width;
      const lz = (curLi - lx) / width;
      const wx = originX + lx;
      const wz = originZ + lz;
      const curH = heightMap[wz * gs + wx];

      for (let d = 0; d < 8; d++) {
        const [dx, dz, stepWeight] = DIRS_8[d];
        const nlx = lx + dx;
        const nlz = lz + dz;
        if (nlx < 0 || nlz < 0 || nlx >= width || nlz >= height) continue;

        const nwx = originX + nlx;
        const nwz = originZ + nlz;
        const wIdx = nwz * gs + nwx;
        const tileCost = getTileWalkCost(heightMap[wIdx], terrainCodeMap[wIdx], allowWater);
        if (tileCost === 0) continue;

        // Prevent climbing vertical cliffs (> 2 elevation steps)
        const hDiff = Math.abs(heightMap[wIdx] - curH);
        if (hDiff > 2 && !allowWater) continue;

        // Avoid cutting corners diagonally across water/cliffs
        if (dx !== 0 && dz !== 0) {
          const c1 = wz * gs + nwx;
          const c2 = nwz * gs + wx;
          if (
            getTileWalkCost(heightMap[c1], terrainCodeMap[c1], allowWater) === 0 ||
            getTileWalkCost(heightMap[c2], terrainCodeMap[c2], allowWater) === 0
          ) {
            continue;
          }
        }

        const nextD = curD + ((stepWeight * tileCost) >> 3) + hDiff * 4;
        const nli = nlz * width + nlx;
        if (nextD < dist[nli] && nextD < 65500) {
          dist[nli] = nextD;
          // Flow vector points from neighbor back toward current (closer to target)
          dirX[nli] = -dx;
          dirZ[nli] = -dz;
          q.push(nli, nextD);
        }
      }
    }

    const field: FlowField = {
      key,
      targetX: tx,
      targetZ: tz,
      originX,
      originZ,
      width,
      height,
      dirX,
      dirZ,
      dist,
      terrainVersion: grid.terrainVersion,
      lastUsedTime: nowSec,
    };

    // LRU eviction if over cache cap
    if (this.fields.size >= this.maxCachedFields) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [k, f] of this.fields.entries()) {
        if (f.lastUsedTime < oldestTime) {
          oldestTime = f.lastUsedTime;
          oldestKey = k;
        }
      }
      if (oldestKey) this.fields.delete(oldestKey);
    }

    this.fields.set(key, field);
    return field;
  }

  /**
   * Samples O(1) steering direction `(dx, dz)` from a flow field for a unit at `(x, z)`.
   * Returns `null` if unit is outside field bounds or tile is unreachable.
   */
  sampleDirection(
    field: FlowField,
    x: number,
    z: number,
  ): { dx: number; dz: number } | null {
    const lx = Math.round(x) - field.originX;
    const lz = Math.round(z) - field.originZ;
    if (lx < 0 || lz < 0 || lx >= field.width || lz >= field.height) return null;
    const li = lz * field.width + lx;
    if (field.dist[li] >= 65535) return null;
    const dx = field.dirX[li];
    const dz = field.dirZ[li];
    if (dx === 0 && dz === 0) return null;
    return { dx, dz };
  }
}

export interface CoarseChunkStep {
  chunkX: number;
  chunkZ: number;
  centerX: number;
  centerZ: number;
}

/**
 * Coarse 32x32 Chunk-Level HPA* (Hierarchical Pathfinding) Graph.
 * Enables instant cross-continent pathfinding across 384x384 and 512x512 worlds
 * by routing through passable chunk portals using `flatqueue` A*.
 */
export class CoarseChunkGraph {
  private chunksPerSide = 0;
  private chunkSize = CHUNK_SIZE;
  private terrainVersion = -1;
  /** Bitmask per chunk: bit0=+X, bit1=-X, bit2=+Z, bit3=-Z, bit4=hasWalkableLand */
  private passability = new Uint8Array(0);
  /** Representative walkable anchor X/Z per chunk for smooth waypoint guidance */
  private anchorX = new Uint16Array(0);
  private anchorZ = new Uint16Array(0);
  private queue = new FlatQueue<number>();

  ensureBuilt(grid: WorldGridBuffers): void {
    if (
      this.terrainVersion === grid.terrainVersion &&
      this.chunksPerSide === grid.chunksPerSide &&
      this.chunkSize === grid.chunkSize
    ) {
      return;
    }

    const cps = grid.chunksPerSide;
    const cs = grid.chunkSize;
    const gs = grid.gridSize;
    const total = cps * cps;

    if (this.passability.length !== total) {
      this.passability = new Uint8Array(total);
      this.anchorX = new Uint16Array(total);
      this.anchorZ = new Uint16Array(total);
    } else {
      this.passability.fill(0);
    }

    const { heightMap, terrainCodeMap } = grid;

    for (let cz = 0; cz < cps; cz++) {
      const z0 = cz * cs;
      const z1 = Math.min(gs, z0 + cs);
      for (let cx = 0; cx < cps; cx++) {
        const x0 = cx * cs;
        const x1 = Math.min(gs, x0 + cs);
        const ci = cz * cps + cx;

        let mask = 0;
        let sumX = 0;
        let sumZ = 0;
        let walkCount = 0;

        // Sample interior for walkable anchor
        for (let z = z0; z < z1; z += 2) {
          for (let x = x0; x < x1; x += 2) {
            const idx = z * gs + x;
            if (getTileWalkCost(heightMap[idx], terrainCodeMap[idx], false) > 0) {
              sumX += x;
              sumZ += z;
              walkCount++;
            }
          }
        }

        if (walkCount > 0) {
          mask |= 16;
          this.anchorX[ci] = Math.round(sumX / walkCount);
          this.anchorZ[ci] = Math.round(sumZ / walkCount);
        } else {
          this.anchorX[ci] = Math.min(gs - 1, x0 + (cs >> 1));
          this.anchorZ[ci] = Math.min(gs - 1, z0 + (cs >> 1));
        }

        // Check +X border portal
        if (cx + 1 < cps) {
          const bx = x1 - 1;
          for (let z = z0; z < z1; z++) {
            const a = z * gs + bx;
            const b = z * gs + (bx + 1);
            if (
              getTileWalkCost(heightMap[a], terrainCodeMap[a], false) > 0 &&
              getTileWalkCost(heightMap[b], terrainCodeMap[b], false) > 0 &&
              Math.abs(heightMap[a] - heightMap[b]) <= 2
            ) {
              mask |= 1;
              break;
            }
          }
        }
        // Check -X border portal
        if (cx > 0) {
          const bx = x0;
          for (let z = z0; z < z1; z++) {
            const a = z * gs + bx;
            const b = z * gs + (bx - 1);
            if (
              getTileWalkCost(heightMap[a], terrainCodeMap[a], false) > 0 &&
              getTileWalkCost(heightMap[b], terrainCodeMap[b], false) > 0 &&
              Math.abs(heightMap[a] - heightMap[b]) <= 2
            ) {
              mask |= 2;
              break;
            }
          }
        }
        // Check +Z border portal
        if (cz + 1 < cps) {
          const bz = z1 - 1;
          for (let x = x0; x < x1; x++) {
            const a = bz * gs + x;
            const b = (bz + 1) * gs + x;
            if (
              getTileWalkCost(heightMap[a], terrainCodeMap[a], false) > 0 &&
              getTileWalkCost(heightMap[b], terrainCodeMap[b], false) > 0 &&
              Math.abs(heightMap[a] - heightMap[b]) <= 2
            ) {
              mask |= 4;
              break;
            }
          }
        }
        // Check -Z border portal
        if (cz > 0) {
          const bz = z0;
          for (let x = x0; x < x1; x++) {
            const a = bz * gs + x;
            const b = (bz - 1) * gs + x;
            if (
              getTileWalkCost(heightMap[a], terrainCodeMap[a], false) > 0 &&
              getTileWalkCost(heightMap[b], terrainCodeMap[b], false) > 0 &&
              Math.abs(heightMap[a] - heightMap[b]) <= 2
            ) {
              mask |= 8;
              break;
            }
          }
        }

        this.passability[ci] = mask;
      }
    }

    this.chunksPerSide = cps;
    this.chunkSize = cs;
    this.terrainVersion = grid.terrainVersion;
  }

  /**
   * Finds a high-level chunk path from `(startX, startZ)` to `(goalX, goalZ)`.
   * Returns `null` if no land connection exists between the chunks.
   */
  findCoarsePath(
    grid: WorldGridBuffers,
    startX: number,
    startZ: number,
    goalX: number,
    goalZ: number,
  ): CoarseChunkStep[] | null {
    this.ensureBuilt(grid);
    const cps = this.chunksPerSide;
    const cs = this.chunkSize;
    const sx = Math.max(0, Math.min(cps - 1, Math.floor(startX / cs)));
    const sz = Math.max(0, Math.min(cps - 1, Math.floor(startZ / cs)));
    const gx = Math.max(0, Math.min(cps - 1, Math.floor(goalX / cs)));
    const gz = Math.max(0, Math.min(cps - 1, Math.floor(goalZ / cs)));

    const startCi = sz * cps + sx;
    const goalCi = gz * cps + gx;
    if (startCi === goalCi) {
      return [{ chunkX: gx, chunkZ: gz, centerX: goalX, centerZ: goalZ }];
    }

    const total = cps * cps;
    const gScore = new Uint16Array(total);
    gScore.fill(65535);
    const cameFrom = new Int32Array(total);
    cameFrom.fill(-1);

    const q = this.queue;
    q.clear();
    gScore[startCi] = 0;
    q.push(startCi, Math.abs(gx - sx) + Math.abs(gz - sz));

    const dirBits = [1, 2, 4, 8];

    while (q.length > 0) {
      const cur = q.pop()!;
      if (cur === goalCi) {
        const path: CoarseChunkStep[] = [];
        let node = goalCi;
        while (node !== -1 && node !== startCi) {
          const cx = node % cps;
          const cz = (node - cx) / cps;
          path.push({
            chunkX: cx,
            chunkZ: cz,
            centerX: this.anchorX[node],
            centerZ: this.anchorZ[node],
          });
          node = cameFrom[node];
        }
        path.reverse();
        return path;
      }

      const cx = cur % cps;
      const cz = (cur - cx) / cps;
      const mask = this.passability[cur];
      const nextG = gScore[cur] + 1;

      for (let d = 0; d < 4; d++) {
        if ((mask & dirBits[d]) === 0) continue;
        const [dx, dz] = DIRS_4[d];
        const ncx = cx + dx;
        const ncz = cz + dz;
        if (ncx < 0 || ncz < 0 || ncx >= cps || ncz >= cps) continue;
        const nci = ncz * cps + ncx;
        if ((this.passability[nci] & 16) === 0) continue;
        if (nextG < gScore[nci]) {
          gScore[nci] = nextG;
          cameFrom[nci] = cur;
          const h = Math.abs(gx - ncx) + Math.abs(gz - ncz);
          q.push(nci, nextG + h);
        }
      }
    }

    return null;
  }
}

/**
 * Bounded per-tick pathfinding budget so pathfinding never causes frame spikes even with 1,000+ units.
 */
export class TimeSlicedPathBudget {
  private usedThisTick = 0;
  readonly maxPerTick: number;

  constructor(maxPerTick = 20) {
    this.maxPerTick = maxPerTick;
  }

  resetTick(): void {
    this.usedThisTick = 0;
  }

  tryConsume(): boolean {
    if (this.usedThisTick >= this.maxPerTick) return false;
    this.usedThisTick++;
    return true;
  }

  getUsed(): number {
    return this.usedThisTick;
  }
}
