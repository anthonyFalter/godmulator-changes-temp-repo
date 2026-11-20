import {
  LightingPreset,
  SimulationState,
  WorldRulesConfig,
  ZoneToggleState,
} from './types';
import { DEFAULT_WORLD_RULES } from './simulation';
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
  activeZones: ZoneToggleState;
  simulation: SimulationState;
}

export interface SaveWorldParams {
  saveId?: string | null;
  name?: string;
  description?: string;
  thumbnailDataUrl: string | null;
  lightingPreset: LightingPreset;
  activeZones: ZoneToggleState;
  sim: SimulationState;
}

export interface SavedWorldRulesUpdate {
  rules: WorldRulesConfig;
  epochIndex?: number;
  lightingPreset?: LightingPreset;
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
  const { worldGrid: _transientGrid, ...serializable } = sim;
  const cloned = cloneData(serializable as SimulationState);
  cloned.pendingVfx = [];
  cloned.selectedEntityId = null;
  cloned.activeWorldEvent = null;
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
  if (!Array.isArray(restored.chronicle)) restored.chronicle = [];
  if (!Array.isArray(restored.activeHazards)) restored.activeHazards = [];
  if (!Array.isArray(restored.vehicles)) restored.vehicles = [];
  if (!Array.isArray(restored.voidWisps)) restored.voidWisps = [];
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

function writeLocalStorageFallback(records: SavedWorldRecord[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    memoryFallbackMap.clear();
    for (const r of records) memoryFallbackMap.set(r.id, r);
    return;
  }
  try {
    window.localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(records));
  } catch {
    // Fallback to memory if localStorage quota exceeded
    memoryFallbackMap.clear();
    for (const r of records) memoryFallbackMap.set(r.id, r);
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
  const sanitizedSim = sanitizeSimulationForSave(params.sim);
  sanitizedSim.worldName = cleanName;
  sanitizedSim.worldDescription = cleanDescription;
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
    activeZones: { ...DEFAULT_ZONE_TOGGLES, ...params.activeZones },
    simulation: sanitizedSim,
  };

  try {
    await adapter.put(record);
  } catch {
    if (adapter !== fallbackAdapter) {
      await fallbackAdapter.put(record);
    } else {
      throw new Error('Failed to store saved world locally');
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
  const nextLightingPreset: LightingPreset =
    updates.lightingPreset ??
    (mergedRules.dayNightCycle
      ? existing.lightingPreset === 'noon'
        ? 'auto'
        : existing.lightingPreset
      : existing.lightingPreset === 'auto'
        ? 'noon'
        : existing.lightingPreset);

  const updated: SavedWorldRecord = {
    ...existing,
    epochIndex: nextEpochIndex,
    lightingPreset: nextLightingPreset,
    simulation: {
      ...existing.simulation,
      epochIndex: nextEpochIndex,
      worldRules: mergedRules,
      autoBuildEnabled: mergedRules.autoBuildEnabled,
      sandboxFreeMode: mergedRules.sandboxFreeMode,
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
