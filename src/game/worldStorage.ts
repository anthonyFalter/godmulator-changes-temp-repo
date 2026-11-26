import {
  LightingPreset,
  SeasonPreset,
  SimulationState,
  WorldRulesConfig,
  ZoneToggleState,
} from './types';
import {
  DEFAULT_WORLD_RULES,
  flushPendingBasinWaves,
  recalculateRatesAndCaps,
  reseedEntityIdCounterFromState,
} from './simulation';
import { DEFAULT_ZONE_TOGGLES } from './zones';

export interface SavedWorldRecord {
  id: string;
  name: string;
  description?: string;
  savedAt: number;
  thumbnailDataUrl: string | null;
  gridSize: number;
  seed: number;
  epochIndex: number;
  year: number;
  population: number;
  lightingPreset: LightingPreset;
  seasonPreset?: SeasonPreset;
  activeZones: ZoneToggleState;
  simulation: SimulationState;
}

export interface SaveWorldParams {
  saveId?: string | null;
  name?: string;
  description?: string;
  thumbnailDataUrl: string | null;
  lightingPreset: LightingPreset;
  seasonPreset?: SeasonPreset;
  activeZones: ZoneToggleState;
  sim: SimulationState;
}

export interface SavedWorldRulesUpdate {
  rules: WorldRulesConfig;
  epochIndex?: number;
  lightingPreset?: LightingPreset;
  seasonPreset?: SeasonPreset;
}

export interface WorldStorageAdapter {
  getAll(): Promise<SavedWorldRecord[]>;
  getById(id: string): Promise<SavedWorldRecord | null>;
  put(record: SavedWorldRecord): Promise<void>;
  delete(id: string): Promise<void>;
}

const DB_NAME = 'godmulator_local_saves';
const STORE_NAME = 'worlds';
const DB_VERSION = 1;
const LOCAL_STORAGE_FALLBACK_KEY = 'godmulator_saved_worlds_v1';

function cloneData<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fall back to JSON clone for objects with undefined/non-clonable quirks
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function sanitizeSimulationForSave(sim: SimulationState): SimulationState {
  const { worldGrid: _transientGrid, divineTitan: _transientTitan, ...serializable } = sim;
  const cloned = cloneData(serializable as SimulationState);
  cloned.pendingVfx = [];
  cloned.selectedEntityId = null;
  cloned.activeWorldEvent = null;
  cloned.divineTitan = null;
  if (!Array.isArray(cloned.voidWisps)) cloned.voidWisps = [];
  if (!cloned.worldRules) {
    cloned.worldRules = {
      ...DEFAULT_WORLD_RULES,
      autoBuildEnabled: Boolean(cloned.autoBuildEnabled),
      sandboxFreeMode: Boolean(cloned.sandboxFreeMode),
      startingEpochIndex: cloned.epochIndex,
    };
  }
  return cloned;
}

export function restoreSimulationFromSave(record: SavedWorldRecord): SimulationState {
  const restored = cloneData(record.simulation);
  restored.pendingVfx = [];
  restored.selectedEntityId = null;
  restored.activeWorldEvent = null;
  restored.divineTitan = null;
  const rules: WorldRulesConfig = {
    ...DEFAULT_WORLD_RULES,
    ...(restored.worldRules ?? {}),
  };
  restored.worldRules = rules;
  restored.autoBuildEnabled = rules.autoBuildEnabled;
  restored.sandboxFreeMode = rules.sandboxFreeMode;
  restored.worldName = record.name;
  restored.worldDescription = record.description ?? restored.worldDescription ?? '';
  restored.epochIndex =
    typeof restored.epochIndex === 'number' ? restored.epochIndex : record.epochIndex;
  restored.seasonPreset = record.seasonPreset ?? restored.seasonPreset ?? 'auto';
  if (!Array.isArray(restored.chronicle)) restored.chronicle = [];
  if (!Array.isArray(restored.activeHazards)) restored.activeHazards = [];
  if (!Array.isArray(restored.vehicles)) restored.vehicles = [];
  if (!Array.isArray(restored.voidWisps)) restored.voidWisps = [];
  reseedEntityIdCounterFromState(restored);
  recalculateRatesAndCaps(restored);
  return restored;
}

function generateSaveId(seed: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `world_${crypto.randomUUID()}`;
  }
  return `world_${seed}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function sortSavedWorldsDesc(records: SavedWorldRecord[]): SavedWorldRecord[] {
  return [...records].sort((a, b) => b.savedAt - a.savedAt);
}

// In-memory fallback for non-browser environments (e.g., Node tests)
const memoryFallbackMap = new Map<string, SavedWorldRecord>();

function readLocalStorageFallback(): SavedWorldRecord[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return Array.from(memoryFallbackMap.values());
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedWorldRecord[]) : [];
  } catch {
    return [];
  }
}

function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number; message?: string };
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014 ||
    (typeof e.message === 'string' && /quota/i.test(e.message))
  );
}

function writeLocalStorageFallback(records: SavedWorldRecord[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    memoryFallbackMap.clear();
    for (const r of records) memoryFallbackMap.set(r.id, r);
    return;
  }
  try {
    window.localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(records));
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw new Error('Local storage quota exceeded — delete an older saved world to free space.');
    }
    throw err instanceof Error ? err : new Error('Failed to write saved world to local storage.');
  }
}

const fallbackAdapter: WorldStorageAdapter = {
  async getAll() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return sortSavedWorldsDesc(Array.from(memoryFallbackMap.values()).map((r) => cloneData(r)));
    }
    return sortSavedWorldsDesc(readLocalStorageFallback());
  },
  async getById(id: string) {
    const all = await this.getAll();
    return all.find((w) => w.id === id) ?? null;
  },
  async put(record: SavedWorldRecord) {
    const copy = cloneData(record);
    if (typeof window === 'undefined' || !window.localStorage) {
      memoryFallbackMap.set(copy.id, copy);
      return;
    }
    const existing = readLocalStorageFallback().filter((w) => w.id !== copy.id);
    existing.push(copy);
    writeLocalStorageFallback(existing);
  },
  async delete(id: string) {
    if (typeof window === 'undefined' || !window.localStorage) {
      memoryFallbackMap.delete(id);
      return;
    }
    const filtered = readLocalStorageFallback().filter((w) => w.id !== id);
    writeLocalStorageFallback(filtered);
  },
};

function openWorldsDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

const indexedDbAdapter: WorldStorageAdapter = {
  async getAll() {
    const db = await openWorldsDatabase();
    return new Promise<SavedWorldRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = Array.isArray(req.result) ? (req.result as SavedWorldRecord[]) : [];
        resolve(sortSavedWorldsDesc(items));
      };
      req.onerror = () => reject(req.error ?? new Error('Failed to list saved worlds'));
      tx.oncomplete = () => db.close();
      tx.onabort = () => db.close();
    });
  },
  async getById(id: string) {
    const db = await openWorldsDatabase();
    return new Promise<SavedWorldRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as SavedWorldRecord | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('Failed to load saved world'));
      tx.oncomplete = () => db.close();
      tx.onabort = () => db.close();
    });
  },
  async put(record: SavedWorldRecord) {
    const db = await openWorldsDatabase();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('Failed to save world'));
      tx.oncomplete = () => db.close();
      tx.onabort = () => db.close();
    });
  },
  async delete(id: string) {
    const db = await openWorldsDatabase();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('Failed to delete saved world'));
      tx.oncomplete = () => db.close();
      tx.onabort = () => db.close();
    });
  },
};

function getDefaultAdapter(): WorldStorageAdapter {
  if (typeof indexedDB !== 'undefined') {
    return indexedDbAdapter;
  }
  return fallbackAdapter;
}

export async function listSavedWorlds(
  adapter: WorldStorageAdapter = getDefaultAdapter(),
): Promise<SavedWorldRecord[]> {
  try {
    const items = await adapter.getAll();
    return sortSavedWorldsDesc(items);
  } catch {
    if (adapter !== fallbackAdapter) {
      return fallbackAdapter.getAll();
    }
    return [];
  }
}

export async function saveWorldToLocalCache(
  params: SaveWorldParams,
  adapter: WorldStorageAdapter = getDefaultAdapter(),
): Promise<SavedWorldRecord> {
  const cleanName = (params.name ?? params.sim.worldName ?? '').trim() || 'My World';
  const cleanDescription = (params.description ?? params.sim.worldDescription ?? '').trim();
  flushPendingBasinWaves(params.sim);
  const sanitizedSim = sanitizeSimulationForSave(params.sim);
  const effectiveSeasonPreset: SeasonPreset =
    params.seasonPreset ?? params.sim.seasonPreset ?? 'auto';
  sanitizedSim.worldName = cleanName;
  sanitizedSim.worldDescription = cleanDescription;
  sanitizedSim.seasonPreset = effectiveSeasonPreset;
  const record: SavedWorldRecord = {
    id: params.saveId || generateSaveId(sanitizedSim.seed),
    name: cleanName,
    description: cleanDescription,
    savedAt: Date.now(),
    thumbnailDataUrl: params.thumbnailDataUrl ?? null,
    gridSize: sanitizedSim.gridSize,
    seed: sanitizedSim.seed,
    epochIndex: sanitizedSim.epochIndex,
    year: Math.floor(sanitizedSim.year),
    population: sanitizedSim.population,
    lightingPreset: params.lightingPreset,
    seasonPreset: effectiveSeasonPreset,
    activeZones: { ...DEFAULT_ZONE_TOGGLES, ...params.activeZones },
    simulation: sanitizedSim,
  };

  try {
    await adapter.put(record);
  } catch (err) {
    if (adapter !== fallbackAdapter) {
      await fallbackAdapter.put(record);
    } else {
      throw err instanceof Error ? err : new Error('Failed to store saved world locally');
    }
  }
  return record;
}

export async function loadSavedWorldById(
  id: string,
  adapter: WorldStorageAdapter = getDefaultAdapter(),
): Promise<SavedWorldRecord | null> {
  try {
    return await adapter.getById(id);
  } catch {
    if (adapter !== fallbackAdapter) {
      return fallbackAdapter.getById(id);
    }
    return null;
  }
}

export async function renameSavedWorld(
  id: string,
  nextName: string,
  adapter: WorldStorageAdapter = getDefaultAdapter(),
): Promise<SavedWorldRecord | null> {
  const trimmed = nextName.trim();
  if (!trimmed) return null;
  const existing = await loadSavedWorldById(id, adapter);
  if (!existing) return null;
  const updated: SavedWorldRecord = {
    ...existing,
    name: trimmed,
    simulation: {
      ...existing.simulation,
      worldName: trimmed,
    },
  };
  try {
    await adapter.put(updated);
  } catch {
    if (adapter !== fallbackAdapter) {
      await fallbackAdapter.put(updated);
    }
  }
  return updated;
}

export async function updateSavedWorldRules(
  id: string,
  updates: SavedWorldRulesUpdate,
  adapter: WorldStorageAdapter = getDefaultAdapter(),
): Promise<SavedWorldRecord | null> {
  const existing = await loadSavedWorldById(id, adapter);
  if (!existing) return null;
  const mergedRules: WorldRulesConfig = {
    ...DEFAULT_WORLD_RULES,
    ...(existing.simulation.worldRules ?? {}),
    ...updates.rules,
  };
  const nextEpochIndex =
    typeof updates.epochIndex === 'number' ? updates.epochIndex : existing.epochIndex;
  if (typeof updates.epochIndex === 'number') {
    mergedRules.startingEpochIndex = nextEpochIndex;
  }
  const nextSeasonPreset: SeasonPreset | undefined =
    updates.seasonPreset ?? existing.seasonPreset ?? existing.simulation.seasonPreset;
  const nextLightingPreset: LightingPreset =
    updates.lightingPreset ??
    (mergedRules.dayNightCycle
      ? existing.lightingPreset === 'noon'
        ? 'auto'
        : existing.lightingPreset
      : existing.lightingPreset === 'auto'
        ? 'noon'
        : existing.lightingPreset);

  const updatedSim = {
    ...existing.simulation,
    epochIndex: nextEpochIndex,
    worldRules: mergedRules,
    autoBuildEnabled: mergedRules.autoBuildEnabled,
    sandboxFreeMode: mergedRules.sandboxFreeMode,
    ...(nextSeasonPreset ? { seasonPreset: nextSeasonPreset } : {}),
  };

  if (typeof updates.epochIndex === 'number') {
    const nextKingdomEpochs: Record<string, number> = {
      ...(existing.simulation.kingdomEpochs ?? {}),
    };
    const nextKingdomProgress: Record<string, number> = {
      ...(existing.simulation.kingdomEpochProgress ?? {}),
    };
    const settlementKingdoms = existing.simulation.settlementKingdoms ?? {};
    const resolveKid = (sid?: string, fallbackKid?: string): string | undefined =>
      sid ? (settlementKingdoms[sid] ?? sid) : fallbackKid;

    for (const kid of Object.keys(nextKingdomEpochs)) {
      nextKingdomEpochs[kid] = nextEpochIndex;
      nextKingdomProgress[kid] = nextEpochIndex >= 7 ? 100 : 0;
    }
    updatedSim.buildings = existing.simulation.buildings.map((b) => {
      const kid = resolveKid(b.settlementId);
      if (kid) {
        nextKingdomEpochs[kid] = nextEpochIndex;
        nextKingdomProgress[kid] = nextEpochIndex >= 7 ? 100 : 0;
      }
      const prevEp = typeof b.epochLevel === 'number' ? b.epochLevel : existing.epochIndex;
      const hpDelta = (nextEpochIndex - prevEp) * 40;
      const nextMaxHp = Math.max(50, b.maxHp + hpDelta);
      const nextHp = Math.max(1, Math.min(nextMaxHp, b.hp + hpDelta));
      return { ...b, epochLevel: nextEpochIndex, maxHp: nextMaxHp, hp: nextHp };
    });
    updatedSim.vehicles = (existing.simulation.vehicles ?? []).map((v) => ({
      ...v,
      epochLevel: nextEpochIndex,
    }));
    for (const u of existing.simulation.units) {
      if (u.faction === 'civilization' && u.state !== 'ko' && u.hp > 0) {
        const kid = resolveKid(u.settlementId, u.kingdomId);
        if (kid) {
          nextKingdomEpochs[kid] = nextEpochIndex;
          nextKingdomProgress[kid] = nextEpochIndex >= 7 ? 100 : 0;
        }
      }
    }
    updatedSim.kingdomEpochs = nextKingdomEpochs;
    updatedSim.kingdomEpochProgress = nextKingdomProgress;
    updatedSim.averageEpochIndex = nextEpochIndex;
    updatedSim.epochProgress = nextEpochIndex >= 7 ? 100 : 0;
  }

  const updated: SavedWorldRecord = {
    ...existing,
    epochIndex: nextEpochIndex,
    lightingPreset: nextLightingPreset,
    ...(nextSeasonPreset ? { seasonPreset: nextSeasonPreset } : {}),
    simulation: updatedSim,
  };
  try {
    await adapter.put(updated);
  } catch (err) {
    if (adapter !== fallbackAdapter) {
      await fallbackAdapter.put(updated);
    } else {
      throw err instanceof Error ? err : new Error('Failed to update saved world rules');
    }
  }
  return updated;
}

export async function deleteSavedWorld(
  id: string,
  adapter: WorldStorageAdapter = getDefaultAdapter(),
): Promise<void> {
  try {
    await adapter.delete(id);
  } catch {
    if (adapter !== fallbackAdapter) {
      await fallbackAdapter.delete(id);
    }
  }
}

export function createMemoryWorldStorageAdapter(): WorldStorageAdapter {
  const store = new Map<string, SavedWorldRecord>();
  return {
    async getAll() {
      return sortSavedWorldsDesc(Array.from(store.values()).map((r) => cloneData(r)));
    },
    async getById(id: string) {
      const found = store.get(id);
      return found ? cloneData(found) : null;
    },
    async put(record: SavedWorldRecord) {
      store.set(record.id, cloneData(record));
    },
    async delete(id: string) {
      store.delete(id);
    },
  };
}
