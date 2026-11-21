import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ANIMAL_UNITS,
  BUILDINGS,
  EPOCHS,
  GOD_POWERS,
  MYTHICAL_BEAST_UNITS,
  SPECIES_UNITS,
  TERRAIN_TOOLS,
  UNITS,
  getMaxCityPopulation,
} from './game/catalog';
import {
  DEFAULT_WORLD_RULES,
  WORLD_TEMPLATES,
  applyTerrainTool,
  canAfford,
  castGodPower,
  computeAverageCivilizationEpoch,
  createInitialSimulationState,
  createWorldConfigFromTemplate,
  dismissWorldEventCinematic,
  formatYearLabel,
  getKingdomId,
  getKingdomRelation,
  getTile,
  placeBuilding,
  spawnUnit,
  syncAverageEpochFromKingdoms,
} from './game/simulation';
import { normalizeSeed } from './game/worldGen';
import { soundEngine } from './game/sound';
import { toggleUnitFavorite } from './game/entityInspector';
import {
  DEFAULT_BRUSH_SIZE,
  getPowerClusterCount,
  getTerrainTileRadius,
} from './game/brushSizes';
import { PixelBrushSelector } from './components/PixelBrushSelector';
import { PerformanceHud } from './components/PerformanceHud';
import { getSharedWorldGenPool } from './game/workerPool';
import {
  ActiveTool,
  BrushInputMode,
  GameLifecycleState,
  GraphicsSettings,
  LightingPreset,
  PerfTelemetrySnapshot,
  Resources,
  SimulationState,
  ToolCategory,
  UnitEntity,
  WorldGenConfig,
  WorldRulesConfig,
  WorldTemplateId,
  ZoneOverlayType,
  ZoneToggleState,
} from './game/types';
import { loadGraphicsSettings, saveGraphicsSettings } from './game/graphics';
import { SIMULATION_SPEED_OPTIONS, clampSimulationSpeed } from './game/dayNightLighting';
import {
  SavedWorldRecord,
  deleteSavedWorld,
  listSavedWorlds,
  loadSavedWorldById,
  renameSavedWorld,
  restoreSimulationFromSave,
  saveWorldToLocalCache,
  updateSavedWorldRules,
} from './game/worldStorage';
import {
  DEFAULT_ZONE_TOGGLES,
  buildZoneOverlayTextures,
  computeKingdomLabelsOnly,
  computeWorldZones,
  extractKingdomColorsMap,
  inspectTileZones,
} from './game/zones';
import { EntityInspectorCard } from './components/EntityInspectorCard';
import { GraphicsSettingsPanel } from './components/GraphicsSettingsPanel';
import {
  BuildingPixelIcon,
  HudPixelIcon,
  PowerPixelIcon,
  ResourceIconSvg,
  TabPixelIcon,
  TerrainPixelIcon,
  TitleEmblemSvg,
  UnitPixelIcon,
  ZonePixelIcon,
} from './components/GameIcons';
import { IsometricWorldCanvas } from './components/IsometricWorldCanvas';

const RESOURCE_KEYS: { key: keyof Resources; label: string }[] = [
  { key: 'food', label: 'Food' },
  { key: 'wood', label: 'Wood' },
  { key: 'stone', label: 'Stone' },
  { key: 'ore', label: 'Ore' },
  { key: 'knowledge', label: 'Research' },
  { key: 'alloy', label: 'Alloy' },
  { key: 'faith', label: 'God Energy' },
];

interface HoveredHint {
  title: string;
  cost: string;
  detail: string;
}

type BooleanWorldRuleKey = {
  [K in keyof WorldRulesConfig]: WorldRulesConfig[K] extends boolean ? K : never;
}[keyof WorldRulesConfig];

const GOD_RULE_SWITCHES: ReadonlyArray<{
  key: BooleanWorldRuleKey;
  label: string;
  summary: string;
}> = [
  {
    key: 'immortalEntities',
    label: 'Immortal Entities',
    summary: 'Prevents old-age death (off: Humans ~80y, Elves 200+y, Dragons 500+y)',
  },
  {
    key: 'wildfireSpread',
    label: 'Fire Spread',
    summary: 'Wildfires and dragon flames spread across dry timber and grass',
  },
  {
    key: 'dayNightCycle',
    label: 'Day / Night Cycle',
    summary: 'Sky cycles continuously between dawn, noon, dusk & night',
  },
  {
    key: 'allowReproduction',
    label: 'Reproduction',
    summary: 'Settlements birth children and wild wildlife herds repopulate',
  },
  {
    key: 'animalAttacks',
    label: 'Animal Attacks',
    summary: 'Predators, dinosaurs, and dragons actively hunt & raid villages',
  },
  {
    key: 'autoBuildEnabled',
    label: 'Auto-Build Cities',
    summary: 'Towns autonomously expand with huts, shrines & landmarks',
  },
  {
    key: 'raiderWaves',
    label: 'Raider Waves',
    summary: 'Periodic hostile raider warbands assault settled kingdoms',
  },
  {
    key: 'warsEnabled',
    label: 'Wars',
    summary: 'Allows kingdoms to declare war, build battle vehicles, and engage in combat between intelligent creatures',
  },
  {
    key: 'allowRebellion',
    label: 'Citizens Can Rebel',
    summary: 'Unhappy or crowded citizens can break away into rebel city-states and rival kingdoms',
  },
  {
    key: 'allowFantasy',
    label: 'Fantasy Creatures',
    summary: 'Enables Elves, Orcs, Dragons & Unicorns in spawns and wilds',
  },
  {
    key: 'allowDinosaurs',
    label: 'Dinosaurs',
    summary: 'Allows prehistoric dinosaurs in wild ecosystems & spawns',
  },
  {
    key: 'randomEvents',
    label: 'Random Events',
    summary: 'Rare world events: huge asteroids, super tornadoes, volcanoes & starfalls',
  },
  {
    key: 'sandboxFreeMode',
    label: 'Sandbox Free Mode',
    summary: 'Grants limitless God Energy and removes construction/power costs',
  },
];

function formatCompactCost(cost: Partial<Resources>, isFree: boolean): string {
  if (isFree) return 'Free';
  const entries = Object.entries(cost).filter(([k, v]) => k !== 'energy' && (v ?? 0) > 0);
  if (entries.length === 0) return 'Free';
  return entries
    .map(([k, v]) => {
      const label =
        k === 'knowledge'
          ? 'Res'
          : k === 'faith'
            ? 'God Energy'
            : k[0].toUpperCase() + k.slice(1);
      return `${v} ${label}`;
    })
    .join(', ');
}

function primaryCostNumber(cost: Partial<Resources>, isFree: boolean): string {
  if (isFree) return '';
  const entries = Object.entries(cost).filter(([, v]) => (v ?? 0) > 0);
  if (entries.length === 0) return '';
  return String(entries[0][1]);
}

type TitleMenuStep =
  | 'main'
  | 'continue_worlds'
  | 'settings'
  | 'credits'
  | 'create_world'
  | 'world_rules'
  | 'loading_world';

const GAME_VERSION = 'v1.2.0';

export interface UpdateLogEntry {
  version: string;
  isMajor?: boolean;
  items: string[];
}

const UPDATE_LOG_ENTRIES: UpdateLogEntry[] = [
  {
    version: 'v1.2.0 - We are getting invaded!',
    isMajor: true,
    items: [
      'Alien Invasion, Dark Ooze & Skeleton Portals + new powers (Time Acceleration, Peace Treaty, Solar Beam & Anti-Gravity)',
      '14 new Land tools with falling sky drops for ores, boulders, crystals & salvage',
      'New magic circle effects with runic symbols & updated crystal biome with colorful crystals',
      'Improved fire visuals, fire spread & burnt trees',
      'Cleaner names across powers, units & events + descriptions on random world events',
    ],
  },
  {
    version: 'v1.1.5 - World Saves & UI',
    items: [
      'Local world saves (save, load, rename, overwrite & delete slots with thumbnails)',
      'Default world name set to "My World" with overwrite prompt',
      'Menu & tool filter state cleanup + new pixel-art title emblem',
    ],
  },
  {
    version: 'v1.1.4 - Fog & Timeline',
    items: [
      'Dynamic fog colors tied to time of day',
      'Fixed shader timer drift on lights & clouds in long sessions',
      'Changed calendar to chronological "Year X" and Age I–V labels',
    ],
  },
  {
    version: 'v1.1.3 - Cities, 32×32 Textures & Pop Caps',
    items: [
      'Organic road networks, curved railways & skyway tracks',
      'Bumped pixel textures up to 32×32 resolution',
      'Added per-city population limits scaled by map size',
    ],
  },
  {
    version: 'v1.1.2 - Leviathan & Abyssal Tweaks',
    items: [
      'New Leviathan rig with stationary Water Beam & Breach Jump tsunamis',
      'Coral reefs bleach gray when broken and regenerate over time',
      'Updated whirlpool damage, coastal shelves & Sunken Atlantis ruins',
      'Simulation and rendering performance cleanup',
    ],
  },
  {
    version: 'v1.1.1 - Pixel Scaling & Creature Labels',
    items: [
      'Smooth pixel scaling by zoom level (3× close-up down to 1× zoomed out)',
      'Renamed racial labels to intelligent creatures across menus & Inspect',
    ],
  },
  {
    version: 'v1.1.0 - Sea Update',
    isMajor: true,
    items: [
      'Ocean wildlife & colossal mythical Leviathan roaming as deep silhouettes & breaching with gaping jaws',
      'Floating sea towns, oceanic platforms, and water walkways/piers across coastal channels',
      'Swimming mechanics with fatigue & drowning if stranded far from shore',
      'Randomized warm coral reef generation below tropical ocean waters',
      'Ocean hazards: swirling whirlpools, rogue waves, and rare sunken Atlantis ruins',
      'Freshwater inland lakes and lively shallow river systems',
      'New World Creator template: "Scrap Sea" with flotsam and salvageable scraps',
    ],
  },
  {
    version: 'v1.0.3 - Day-Night Cycle & Lighting',
    items: [
      'Realistic day-night cycle with directional sunlight, dusk/dawn golden hours & midnight moonlit shading',
      'Epoch-dependent city lights: campfires in Prehistoric, street lanterns in Medieval, gas lamposts in Industrial, neon skyline in Modern',
      'Capped simulation speed to 5× max for smoother pacing and visual fidelity',
    ],
  },
  {
    version: 'v1.0.2 - Mobile & Touch Support',
    items: [
      'Multi-touch gestures: pinch-to-zoom, two-finger twist map rotation, and smooth single-finger drag panning',
      'Full support for portrait and landscape orientations on phones and tablets',
      'Responsive, zero-overflow top HUD for small mobile screens',
      'Dedicated mobile pan mode toggle and touch-optimized controls',
    ],
  },
  {
    version: 'v1.0.1 - War Vehicle Evolution & Timeline',
    items: [
      'Unique 3D vehicles per creature (Human tanks/warships, Elf Sylvan Swan-Skiffs/skyships, Orc choppers)',
      'Separated fixed-wing planes (strafing passes, no hovering) from helicopters & VTOL gunships',
      'Timeline fixes: no airships in Medieval era, no helicopters or jets in Industrial Age',
      'Vehicles perish naturally when crew population or home kingdom falls',
    ],
  },
  {
    version: 'v1.0.0 - War Update',
    isMajor: true,
    items: [
      'Wars, peace treaties & Alliances map overlay (Blue Allies, Red Enemies)',
      'City rebellions are more common and can split off provinces (toggle in World Rules)',
      'Per-kingdom resource stockpiles shown in Inspect; towns gather before building',
      'Separate vehicle models for each intelligent creature (gliders, warships, airships, tanks, bombers)',
      'Cooldown on intelligent creature nukes/ultimates + Elf rune beam circles & Orc mountain-cleaving slashes',
    ],
  },
  {
    version: 'v0.6.0',
    items: [
      'World templates & map sizes up to 256×256',
      'World rules settings menu',
    ],
  },
  {
    version: 'v0.5.0',
    items: [
      'Kingdom, wildlife territory & biome map layers',
      'Coastline & sea border shading',
      'Zone hover stats in Inspect',
    ],
  },
  {
    version: 'v0.4.0',
    items: [
      'Seeded pixel Milky Way skybox',
      'Camera intro pan from orbit',
    ],
  },
];

export default function App() {
  const simRef = useRef<SimulationState>(null!);
  if (!simRef.current) {
    simRef.current = createInitialSimulationState(
      128,
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('seed') ?? undefined
        : undefined,
    );
  }
  const [seedInput, setSeedInput] = useState<string>(() => String(simRef.current.seed));

  const [gameState, setGameState] = useState<GameLifecycleState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'playing';
    }
    return 'title';
  });

  const [timeScale, setTimeScale] = useState<number>(1);
  const lastNonZeroSpeedRef = useRef<number>(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState<boolean>(false);
  const [cameraMenuOpen, setCameraMenuOpen] = useState<boolean>(false);
  const speedMenuWrapperRef = useRef<HTMLDivElement | null>(null);
  const cameraMenuWrapperRef = useRef<HTMLDivElement | null>(null);
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('spawn');
  const [activeTool, setActiveTool] = useState<ActiveTool>({
    kind: 'spawn',
    unit: 'human',
  });
  const [powerFilter, setPowerFilter] = useState<'all' | 'benevolent' | 'wrathful' | 'cosmic'>('all');
  const [buildFilter, setBuildFilter] = useState<'all' | 'current' | 'advanced'>('all');
  const [unitFilter, setUnitFilter] = useState<'all' | 'races' | 'wildlife' | 'mythic'>('all');
  const [landFilter, setLandFilter] = useState<'all' | 'Sculpt' | 'Sky Rain' | 'Biomes' | 'Water'>('all');
  const [worldSubTab, setWorldSubTab] = useState<'ages' | 'rules'>('ages');
  const [brushSize, setBrushSize] = useState<number>(DEFAULT_BRUSH_SIZE);
  const brushRadius = getTerrainTileRadius(brushSize);
  const [brushInputMode, setBrushInputMode] = useState<BrushInputMode>('hold');
  const [mobilePanMode, setMobilePanMode] = useState<boolean>(false);
  const pixelScale = 2.5;
  const [graphicsSettings, setGraphicsSettings] = useState<GraphicsSettings>(() =>
    loadGraphicsSettings(),
  );
  const [perfTelemetry, setPerfTelemetry] = useState<PerfTelemetrySnapshot | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        setGraphicsSettings((prev) => {
          const next = { ...prev, showPerformanceHud: !prev.showPerformanceHud };
          saveGraphicsSettings(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('noon');
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [chronicleOpen, setChronicleOpen] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [hoverTile, setHoverTile] = useState<{ x: number; z: number } | null>(null);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const selectedEntityIdRef = useRef<string | null>(null);
  const [followingEntityId, setFollowingEntityId] = useState<string | null>(null);
  const [hoveredHint, setHoveredHint] = useState<HoveredHint | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string>('Click land to spawn a Human');
  const [activeZones, setActiveZones] = useState<ZoneToggleState>(() => ({
    ...DEFAULT_ZONE_TOGGLES,
  }));
  const [selectedAllianceKingdomId, setSelectedAllianceKingdomId] = useState<string | null>(null);

  // Start UI navigation & World Creation Wizard state
  const [titleMenuStep, setTitleMenuStep] = useState<TitleMenuStep>('main');
  const [updateLogCollapsed, setUpdateLogCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 || window.innerHeight < 540 : false,
  );
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState<boolean>(false);
  const [showWorldAgeDropdown, setShowWorldAgeDropdown] = useState<boolean>(false);
  const [showWorldSkyDropdown, setShowWorldSkyDropdown] = useState<boolean>(false);
  const [worldConfig, setWorldConfig] = useState<WorldGenConfig>(() =>
    createWorldConfigFromTemplate('fantastic', {
      seed: simRef.current.seed,
      gridSize: 128,
    }),
  );
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingStageText, setLoadingStageText] = useState<string>(
    'Sculpting continental plates...',
  );

  // Local World Cache / Save / Continue & Quit Guard state
  const captureThumbnailRef = useRef<(() => string | null) | null>(null);
  const activeSaveIdRef = useRef<string | null>(null);
  const [hasSavedWorld, setHasSavedWorld] = useState<boolean>(false);
  const [isSavingWorld, setIsSavingWorld] = useState<boolean>(false);
  const [saveModalStep, setSaveModalStep] = useState<'confirm' | 'details' | 'overwrite' | null>(null);
  const [saveNameDraft, setSaveNameDraft] = useState<string>('');
  const [saveDescDraft, setSaveDescDraft] = useState<string>('');
  const [saveThenQuit, setSaveThenQuit] = useState<boolean>(false);
  const [quitConfirmOpen, setQuitConfirmOpen] = useState<boolean>(false);
  const [savedWorlds, setSavedWorlds] = useState<SavedWorldRecord[]>([]);
  const [savedWorldsLoading, setSavedWorldsLoading] = useState<boolean>(false);
  const [renamingWorldId, setRenamingWorldId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState<string>('');
  const [deletingWorldId, setDeletingWorldId] = useState<string | null>(null);
  const [editingRulesWorldId, setEditingRulesWorldId] = useState<string | null>(null);
  const [editingRulesDraft, setEditingRulesDraft] = useState<WorldRulesConfig | null>(null);
  const [editingEpochDraft, setEditingEpochDraft] = useState<number>(0);
  const [editingLightingDraft, setEditingLightingDraft] = useState<LightingPreset>('noon');

  // Snapshot counter triggered at <= 6 Hz from canvas loop or user actions
  const [hudTick, setHudTick] = useState(0);
  const syncHud = useCallback(() => {
    const s = simRef.current;
    if (s.outcome === 'ascension_victory' && gameState === 'playing') {
      setGameState('gameover');
    }
    setHudTick((t) => t + 1);
  }, [gameState]);

  const cameraActionRef = useRef<{
    rotateDelta: number;
    zoomDelta: number;
    centerHome: boolean;
    playTransition?: boolean;
    focusTarget?: { x: number; z: number; zoom?: number } | null;
  }>({
    rotateDelta: 0,
    zoomDelta: 0,
    centerHome: false,
    playTransition: false,
    focusTarget: null,
  });

  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  const handleStartGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    soundEngine.playEpochAscend();
    cameraActionRef.current.playTransition = true;
    document.body.dataset.state = 'playing';
    setGameState('playing');
  }, []);

  const handleSelectTemplate = useCallback((templateId: WorldTemplateId) => {
    soundEngine.playClick();
    setWorldConfig((prev) => {
      const next = createWorldConfigFromTemplate(templateId, {
        seed: prev.seed,
        gridSize: prev.gridSize,
      });
      // Update rotating background preview at 128x128 so the player sees the template's biome & sea level live
      const previewSim = createInitialSimulationState(128, next.seed, {
        ...next,
        gridSize: 128,
      });
      simRef.current = previewSim;
      setSeedInput(String(previewSim.seed));
      setHudTick((t) => t + 1);
      return next;
    });
  }, []);

  const handleGenerateSeededWorld = useCallback(
    (explicitSeed?: string | number, customConfig?: Partial<WorldGenConfig>) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const resolvedSeed = normalizeSeed(explicitSeed);
      const mergedConfig: WorldGenConfig = {
        ...worldConfig,
        ...(customConfig ?? {}),
        seed: resolvedSeed,
      };
      const nextSim = createInitialSimulationState(
        mergedConfig.gridSize,
        resolvedSeed,
        mergedConfig,
      );
      simRef.current = nextSim;
      setSeedInput(String(nextSim.seed));
      setWorldConfig((prev) => ({
        ...prev,
        ...(customConfig ?? {}),
        seed: nextSim.seed,
      }));
      setHoverTile(null);
      setHoveredEntityId(null);
      setSelectedEntityId(null);
      selectedEntityIdRef.current = null;
      setFollowingEntityId(null);
      setSelectedAllianceKingdomId(null);
      setLightingPreset(nextSim.worldRules?.dayNightCycle ? 'auto' : 'noon');
      setActiveCategory('spawn');
      setActiveTool({ kind: 'spawn', unit: 'human' });
      soundEngine.playBuild();
      setStatusFeedback(`${mergedConfig.worldName} (Seed ${nextSim.seed}) ready`);
      setHudTick((t) => t + 1);
    },
    [worldConfig],
  );

  // Begin step 3: Loading World -> build configured world & smoothly transition into playing state
  const handleBeginWorldLoading = useCallback(() => {
    soundEngine.playBuild();
    activeSaveIdRef.current = null;
    setHasSavedWorld(false);
    setQuitConfirmOpen(false);
    setLoadingProgress(10);
    setLoadingStageText('Generating terrain...');
    setTitleMenuStep('loading_world');
  }, []);

  useEffect(() => {
    if (gameState !== 'title' || titleMenuStep !== 'loading_world') return;

    let cancelled = false;
    let finishTimer = 0;

    setLoadingProgress(15);
    setLoadingStageText(`Sculpting ${worldConfig.gridSize}×${worldConfig.gridSize} terrain...`);

    // Generate world off the main thread in the Comlink Web Worker so 384x384 & 512x512 never freeze UI
    const pool = getSharedWorldGenPool();
    pool
      .generateWorldAsync(worldConfig.gridSize, worldConfig.seed, worldConfig, (pct, stage) => {
        if (cancelled) return;
        setLoadingProgress(Math.max(15, Math.min(98, pct)));
        setLoadingStageText(stage);
      })
      .then((builtSim) => {
        if (cancelled) return;
        simRef.current = builtSim;
        setSeedInput(String(builtSim.seed));
        setHoverTile(null);
        setHoveredEntityId(null);
        setSelectedEntityId(null);
        selectedEntityIdRef.current = null;
        setFollowingEntityId(null);
        setSelectedAllianceKingdomId(null);
        setLightingPreset(builtSim.worldRules?.dayNightCycle ? 'auto' : 'noon');
        setActiveCategory('spawn');
        setActiveTool({ kind: 'spawn', unit: 'human' });
        setLoadingProgress(100);
        setLoadingStageText('Ready');
        setHudTick((t) => t + 1);

        finishTimer = window.setTimeout(() => {
          if (cancelled) return;
          setTitleMenuStep('main');
          handleStartGame();
        }, 180);
      })
      .catch(() => {
        if (cancelled) return;
        const fallbackSim = createInitialSimulationState(
          worldConfig.gridSize,
          worldConfig.seed,
          worldConfig,
        );
        simRef.current = fallbackSim;
        setTitleMenuStep('main');
        handleStartGame();
      });

    return () => {
      cancelled = true;
      if (finishTimer) window.clearTimeout(finishTimer);
    };
  }, [gameState, titleMenuStep, worldConfig, handleStartGame]);

  const refreshSavedWorlds = useCallback(async () => {
    setSavedWorldsLoading(true);
    try {
      const list = await listSavedWorlds();
      setSavedWorlds(list);
    } finally {
      setSavedWorldsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSavedWorlds();
  }, [refreshSavedWorlds]);

  const handleOpenSaveFlow = useCallback(
    (thenQuit = false) => {
      soundEngine.playClick();
      const initialName =
        simRef.current.worldName?.trim() ||
        worldConfig.worldName.trim() ||
        'My World';
      setSaveNameDraft(initialName);
      setSaveDescDraft(simRef.current.worldDescription ?? '');
      setSaveThenQuit(thenQuit);
      setQuitConfirmOpen(false);
      setSaveModalStep('confirm');
      void refreshSavedWorlds();
    },
    [refreshSavedWorlds, worldConfig.worldName],
  );

  const handleCommitSaveWorld = useCallback(async (): Promise<boolean> => {
    if (isSavingWorld) return false;
    setIsSavingWorld(true);
    try {
      const thumbnailDataUrl = captureThumbnailRef.current ? captureThumbnailRef.current() : null;
      const worldName =
        saveNameDraft.trim() ||
        simRef.current.worldName?.trim() ||
        worldConfig.worldName.trim() ||
        'My World';
      const worldDescription = saveDescDraft.trim();
      const matchingExisting = savedWorlds.find(
        (w) => w.name.trim().toLowerCase() === worldName.toLowerCase(),
      );
      const targetSaveId = matchingExisting
        ? matchingExisting.id
        : activeSaveIdRef.current &&
            savedWorlds.some(
              (w) =>
                w.id === activeSaveIdRef.current &&
                w.name.trim().toLowerCase() === worldName.toLowerCase(),
            )
          ? activeSaveIdRef.current
          : undefined;
      const saved = await saveWorldToLocalCache({
        saveId: targetSaveId,
        name: worldName,
        description: worldDescription,
        thumbnailDataUrl,
        lightingPreset,
        activeZones,
        sim: simRef.current,
      });
      activeSaveIdRef.current = saved.id;
      simRef.current.worldName = saved.name;
      simRef.current.worldDescription = saved.description ?? '';
      setWorldConfig((prev) => ({ ...prev, worldName: saved.name }));
      setHasSavedWorld(true);
      setSaveModalStep(null);
      soundEngine.playBuild();
      setStatusFeedback(`Saved "${saved.name}"`);
      setHudTick((t) => t + 1);
      await refreshSavedWorlds();
      if (saveThenQuit) {
        setSaveThenQuit(false);
        setTitleMenuStep('main');
        setGameState('title');
      }
      return true;
    } catch {
      setStatusFeedback('Unable to save world');
      return false;
    } finally {
      setIsSavingWorld(false);
    }
  }, [
    activeZones,
    isSavingWorld,
    lightingPreset,
    refreshSavedWorlds,
    saveDescDraft,
    saveNameDraft,
    saveThenQuit,
    savedWorlds,
    worldConfig.worldName,
  ]);

  const handleConfirmQuitToMainMenu = useCallback(() => {
    soundEngine.playClick();
    setQuitConfirmOpen(false);
    setSaveModalStep(null);
    setSaveThenQuit(false);
    setTitleMenuStep('main');
    setGameState('title');
    void refreshSavedWorlds();
  }, [refreshSavedWorlds]);

  const handleRequestMainMenu = useCallback(() => {
    if (hasSavedWorld) {
      handleConfirmQuitToMainMenu();
      return;
    }
    soundEngine.playClick();
    setQuitConfirmOpen(true);
  }, [handleConfirmQuitToMainMenu, hasSavedWorld]);

  const handleLoadSavedWorld = useCallback(
    async (record: SavedWorldRecord) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const fresh = (await loadSavedWorldById(record.id)) ?? record;
      const restored = restoreSimulationFromSave(fresh);
      simRef.current = restored;
      activeSaveIdRef.current = fresh.id;
      setHasSavedWorld(true);
      setSeedInput(String(restored.seed));
      setWorldConfig((prev) => ({
        ...prev,
        worldName: fresh.name,
        gridSize: restored.gridSize,
        seed: restored.seed,
        template: restored.worldTemplate ?? prev.template,
        rules: restored.worldRules ?? prev.rules,
      }));
      setLightingPreset(
        fresh.lightingPreset ?? (restored.worldRules?.dayNightCycle ? 'auto' : 'noon'),
      );
      setActiveZones({ ...DEFAULT_ZONE_TOGGLES, ...(fresh.activeZones ?? {}) });
      setHoverTile(null);
      setHoveredEntityId(null);
      setSelectedEntityId(null);
      selectedEntityIdRef.current = null;
      setFollowingEntityId(null);
      setSelectedAllianceKingdomId(null);
      setActiveCategory('spawn');
      setActiveTool({ kind: 'spawn', unit: 'human' });
      setQuitConfirmOpen(false);
      setRenamingWorldId(null);
      setDeletingWorldId(null);
      setEditingRulesWorldId(null);
      setTitleMenuStep('main');
      cameraActionRef.current.playTransition = true;
      document.body.dataset.state = 'playing';
      setGameState('playing');
      soundEngine.playEpochAscend();
      setStatusFeedback(`Loaded "${fresh.name}" (${formatYearLabel(restored.year)})`);
      setHudTick((t) => t + 1);
    },
    [],
  );

  const handleConfirmRenameSavedWorld = useCallback(
    async (id: string) => {
      const updated = await renameSavedWorld(id, renameDraft);
      if (updated) {
        soundEngine.playBuild();
        await refreshSavedWorlds();
      }
      setRenamingWorldId(null);
      setRenameDraft('');
    },
    [refreshSavedWorlds, renameDraft],
  );

  const handleConfirmDeleteSavedWorld = useCallback(
    async (id: string) => {
      await deleteSavedWorld(id);
      if (activeSaveIdRef.current === id) {
        activeSaveIdRef.current = null;
        setHasSavedWorld(false);
      }
      setDeletingWorldId(null);
      soundEngine.playClick();
      await refreshSavedWorlds();
    },
    [refreshSavedWorlds],
  );

  const handleOpenSavedWorldRules = useCallback((record: SavedWorldRecord) => {
    soundEngine.playClick();
    setEditingRulesWorldId(record.id);
    setEditingRulesDraft({
      ...DEFAULT_WORLD_RULES,
      ...(record.simulation.worldRules ?? {}),
    });
    setEditingEpochDraft(record.epochIndex);
    setEditingLightingDraft(record.lightingPreset ?? 'noon');
  }, []);

  const handleSaveEditedWorldRules = useCallback(async () => {
    if (!editingRulesWorldId || !editingRulesDraft) return;
    await updateSavedWorldRules(editingRulesWorldId, {
      rules: editingRulesDraft,
      epochIndex: editingEpochDraft,
      lightingPreset: editingLightingDraft,
    });
    soundEngine.playBuild();
    setEditingRulesWorldId(null);
    setEditingRulesDraft(null);
    await refreshSavedWorlds();
  }, [
    editingEpochDraft,
    editingLightingDraft,
    editingRulesDraft,
    editingRulesWorldId,
    refreshSavedWorlds,
  ]);

  const handleToggleMute = useCallback(() => {
    soundEngine.muted = !soundEngine.muted;
    setMuted(soundEngine.muted);
  }, []);

  const handleUpdateGraphicsSettings = useCallback((next: GraphicsSettings) => {
    setGraphicsSettings(next);
    saveGraphicsSettings(next);
  }, []);

  useEffect(() => {
    if (!speedMenuOpen && !cameraMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (
        speedMenuOpen &&
        speedMenuWrapperRef.current &&
        target &&
        !speedMenuWrapperRef.current.contains(target)
      ) {
        setSpeedMenuOpen(false);
      }
      if (
        cameraMenuOpen &&
        cameraMenuWrapperRef.current &&
        target &&
        !cameraMenuWrapperRef.current.contains(target)
      ) {
        setCameraMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [cameraMenuOpen, speedMenuOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (saveModalStep && e.code === 'Escape') {
        e.preventDefault();
        setSaveModalStep(null);
        setSaveThenQuit(false);
        return;
      }

      if (quitConfirmOpen && e.code === 'Escape') {
        e.preventDefault();
        setQuitConfirmOpen(false);
        return;
      }

      if ((speedMenuOpen || cameraMenuOpen) && e.code === 'Escape') {
        e.preventDefault();
        setSpeedMenuOpen(false);
        setCameraMenuOpen(false);
        return;
      }

      if (gameState === 'title') {
        if (e.code === 'Escape') {
          e.preventDefault();
          if (editingRulesWorldId) {
            setEditingRulesWorldId(null);
            setEditingRulesDraft(null);
            return;
          }
          setTitleMenuStep((prev) => {
            if (prev === 'world_rules') return 'create_world';
            if (
              prev === 'create_world' ||
              prev === 'continue_worlds' ||
              prev === 'settings' ||
              prev === 'credits'
            ) {
              return 'main';
            }
            return prev;
          });
        }
        return;
      }

      if (gameState === 'paused' && e.code === 'Escape') {
        e.preventDefault();
        setGameState('playing');
        return;
      }

      if (gameState !== 'playing') return;

      // Only preserve the Hide dock keybind (H); all power & toolbar keybinds removed
      if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cameraMenuOpen, editingRulesWorldId, gameState, quitConfirmOpen, saveModalStep, speedMenuOpen]);

  const handleSelectEntity = useCallback((unitId: string | null) => {
    selectedEntityIdRef.current = unitId;
    setSelectedEntityId(unitId);
    if (!unitId) {
      setFollowingEntityId(null);
    } else {
      const unit = simRef.current.units.find((u) => u.id === unitId && u.state !== 'ko');
      if (unit) {
        setStatusFeedback(`Selected ${unit.name} (${Math.round(unit.hp)}/${unit.maxHp} HP)`);
      }
    }
    setHudTick((t) => t + 1);
  }, []);

  const handleToggleFavoriteEntity = useCallback((unitId: string) => {
    const unit = simRef.current.units.find((u) => u.id === unitId && u.state !== 'ko');
    if (!unit) return;
    const isFav = toggleUnitFavorite(simRef.current, unitId);
    soundEngine.playClick();
    setStatusFeedback(isFav ? `Favorited ${unit.name}` : `Unfavorited ${unit.name}`);
    setHudTick((t) => t + 1);
  }, []);

  const handleFocusEntity = useCallback((unit: UnitEntity) => {
    setFollowingEntityId((prev) => {
      if (prev === unit.id) {
        soundEngine.playClick();
        setStatusFeedback(`Stopped following ${unit.name}`);
        return null;
      }
      cameraActionRef.current.focusTarget = { x: unit.x, z: unit.z, zoom: 11.5 };
      soundEngine.playClick();
      setStatusFeedback(`Following ${unit.name} with camera`);
      return unit.id;
    });
  }, []);

  const handleBreakFollow = useCallback(() => {
    setFollowingEntityId(null);
  }, []);

  const worldZonesRef = useRef<ReturnType<typeof computeWorldZones> | null>(null);

  const handleTileInteract = useCallback(
    (tileX: number, tileZ: number) => {
      const sim = simRef.current;
      sim.selectedTile = { x: tileX, z: tileZ };

      if (activeTool.kind === 'inspect') {
        const currentZones = worldZonesRef.current;
        if (activeZones.alliances && currentZones) {
          const zInspect = inspectTileZones(currentZones, sim, tileX, tileZ);
          if (zInspect?.kingdom) {
            const rootId = getKingdomId(sim, zInspect.kingdom.settlementId);
            setSelectedAllianceKingdomId(rootId);
            const seenRoots = new Set<string>([rootId]);
            let allyCount = 0;
            let enemyCount = 0;
            currentZones.kingdomsById.forEach((kItem) => {
              const otherRoot = getKingdomId(sim, kItem.settlementId);
              if (seenRoots.has(otherRoot)) return;
              seenRoots.add(otherRoot);
              const rel = getKingdomRelation(sim, rootId, otherRoot);
              if (rel === 'allied') allyCount++;
              else if (rel === 'war') enemyCount++;
            });
            setStatusFeedback(
              `${zInspect.kingdom.name}: ${allyCount} Allies (Blue) · ${enemyCount} Enemies (Red)`,
            );
            soundEngine.playClick();
            setHudTick((t) => t + 1);
            return;
          }
        }
        const tile = getTile(sim, tileX, tileZ);
        const pickedUnit = selectedEntityIdRef.current
          ? sim.units.find((u) => u.id === selectedEntityIdRef.current && u.state !== 'ko')
          : undefined;
        const nearbyRoadster = (sim.vehicles ?? []).find(
          (v) => v.type === 'roadster' && Math.hypot(v.x - tileX, v.z - tileZ) <= 1.15,
        );
        const nearbyUnit =
          pickedUnit ??
          sim.units.find(
            (u) => u.state !== 'ko' && Math.hypot(u.x - tileX, u.z - tileZ) <= 0.85,
          );
        const bld = sim.buildings.find((b) => b.tileX === tileX && b.tileZ === tileZ);
        if (nearbyUnit) {
          if (!selectedEntityIdRef.current) {
            selectedEntityIdRef.current = nearbyUnit.id;
            setSelectedEntityId(nearbyUnit.id);
          }
          const def = UNITS.find((d) => d.role === nearbyUnit.role);
          const label =
            nearbyUnit.faction === 'wildlife'
              ? def?.name ?? nearbyUnit.role
              : nearbyUnit.ageStage === 'child'
                ? `${nearbyUnit.species} child`
                : `${nearbyUnit.species} ${nearbyUnit.role}`;
          setStatusFeedback(`${nearbyUnit.name} (${label}, ${Math.round(nearbyUnit.hp)}/${nearbyUnit.maxHp} HP)`);
        } else if (nearbyRoadster) {
          const modeLabel =
            nearbyRoadster.stuntPhase && nearbyRoadster.stuntPhase !== 'cruise'
              ? `Propulsion Stunt: ${nearbyRoadster.stuntPhase.replace('_', ' ')}`
              : 'Cruising with SpaceX Thrusters Armed';
          setStatusFeedback(`Tesla Roadster Easter Egg (${modeLabel})`);
        } else if (bld) {
          const def = BUILDINGS.find((d) => d.type === bld.type);
          setStatusFeedback(`${def?.name ?? bld.type} (${Math.round(bld.hp)}/${bld.maxHp} HP)`);
        } else if (tile) {
          setStatusFeedback(`${tile.terrain.replace('_', ' ')} (${tileX}, ${tileZ})`);
        }
        soundEngine.playClick();
        setHudTick((t) => t + 1);
        return;
      }

      if (activeTool.kind === 'power') {
        const res = castGodPower(sim, activeTool.power, tileX, tileZ, {
          deferImpact: true,
          brushSize,
        });
        const def = GOD_POWERS.find((p) => p.type === activeTool.power);
        if (res.ok) {
          if (activeTool.power === 'meteor_strike') {
            soundEngine.playMeteorIncoming();
          } else if (activeTool.power === 'volcano_eruption') {
            soundEngine.playVolcanoEruption();
          } else if (activeTool.power === 'earthquake') {
            soundEngine.playEarthquake();
          } else if (activeTool.power === 'tornado') {
            soundEngine.playTornado();
          } else if (activeTool.power === 'super_tornado') {
            soundEngine.playSuperTornado();
          } else if (activeTool.power === 'tsunami') {
            soundEngine.playTsunami();
          } else if (activeTool.power === 'freeze_snap') {
            soundEngine.playFreeze();
          } else if (activeTool.power === 'heat_wave') {
            soundEngine.playHeatWave();
          } else if (activeTool.power === 'void_goo') {
            soundEngine.playVoidGoo();
          } else if (activeTool.power === 'undead_portal') {
            soundEngine.playPortalSummon();
          } else if (activeTool.power === 'alien_invasion') {
            soundEngine.playAlienInvasion();
          } else if (activeTool.power === 'chrono_surge') {
            soundEngine.playChronoWarp();
          } else if (activeTool.power === 'harmony_dove') {
            soundEngine.playPeaceAccord();
          } else if (activeTool.power === 'solar_orbital_laser') {
            soundEngine.playOrbitalLaser();
          } else if (activeTool.power === 'gravity_flip') {
            soundEngine.playGravityFlux();
          } else {
            soundEngine.playClick();
          }
          setStatusFeedback(
            res.count && res.count > 1 ? `${def?.name} ×${res.count} cast` : `${def?.name} cast`,
          );
        } else {
          setStatusFeedback(res.reason || 'Need more God Energy');
        }
        setHudTick((t) => t + 1);
        return;
      }

      if (activeTool.kind === 'terrain') {
        const res = applyTerrainTool(sim, activeTool.tool, tileX, tileZ, brushRadius);
        const def = TERRAIN_TOOLS.find((t) => t.type === activeTool.tool);
        if (res.ok) {
          if (def?.isSkyRain) {
            soundEngine.playSkyRain(def.type);
          } else {
            soundEngine.playSculpt();
          }
          setStatusFeedback(`${def?.name} applied`);
        } else {
          setStatusFeedback(res.reason || 'Cannot edit tile');
        }
        setHudTick((t) => t + 1);
        return;
      }

      if (activeTool.kind === 'build') {
        const res = placeBuilding(sim, activeTool.building, tileX, tileZ);
        const def = BUILDINGS.find((b) => b.type === activeTool.building);
        if (res.ok) {
          soundEngine.playBuild();
          setStatusFeedback(`Placed ${def?.name}`);
        } else {
          setStatusFeedback(res.reason || 'Cannot build here');
        }
        setHudTick((t) => t + 1);
        return;
      }

      if (activeTool.kind === 'spawn') {
        const res = spawnUnit(sim, activeTool.unit, tileX, tileZ);
        const def = UNITS.find((u) => u.role === activeTool.unit);
        if (res.ok) {
          soundEngine.playSpawn();
          setStatusFeedback(`Spawned ${def?.name}`);
        } else {
          setStatusFeedback(res.reason || 'Cannot spawn here');
        }
        setHudTick((t) => t + 1);
      }
    },
    [activeTool, brushRadius, brushSize, activeZones.alliances],
  );

  const handleToggleGodRule = useCallback((key: BooleanWorldRuleKey) => {
    const s = simRef.current;
    const currentRules: WorldRulesConfig = s.worldRules ?? { ...DEFAULT_WORLD_RULES };
    const nextValue = !currentRules[key];
    const updatedRules: WorldRulesConfig = {
      ...currentRules,
      [key]: nextValue,
    };
    s.worldRules = updatedRules;
    if (key === 'autoBuildEnabled') {
      s.autoBuildEnabled = nextValue;
    } else if (key === 'sandboxFreeMode') {
      s.sandboxFreeMode = nextValue;
    } else if (key === 'dayNightCycle') {
      setLightingPreset(nextValue ? 'auto' : 'noon');
    } else if (key === 'randomEvents' && !nextValue && s.activeWorldEvent) {
      s.activeWorldEvent = null;
    }
    setWorldConfig((prev) => ({
      ...prev,
      rules: {
        ...prev.rules,
        [key]: nextValue,
      },
    }));
    const meta = GOD_RULE_SWITCHES.find((r) => r.key === key);
    setStatusFeedback(`${meta?.label ?? key}: ${nextValue ? 'ON' : 'OFF'}`);
    soundEngine.playClick();
    setHudTick((t) => t + 1);
  }, []);

  const isInspectTabActive = activeCategory === 'inspect' && activeTool.kind === 'inspect';
  const anyZoneActive =
    activeZones.kingdoms ||
    activeZones.kings ||
    activeZones.territories ||
    activeZones.biomes ||
    activeZones.temperature ||
    activeZones.alliances;
  const shouldComputeZones =
    anyZoneActive || isInspectTabActive || activeCategory === 'zones';

  // Compute dynamic land & sea zones & gather HUD unit lists in a single pass
  const sim = simRef.current;
  const livingKings: UnitEntity[] = [];
  const favoriteUnits: UnitEntity[] = [];
  let hoveredUnit: UnitEntity | null = null;
  let selectedUnit: UnitEntity | null = null;
  if (gameState !== 'title') {
    for (let ui = 0; ui < sim.units.length; ui++) {
      const u = sim.units[ui];
      if (u.state === 'ko') continue;
      if (u.isKing && u.faction === 'civilization') {
        livingKings.push(u);
      }
      if (u.favorite) {
        favoriteUnits.push(u);
      }
      if (isInspectTabActive) {
        if (hoveredEntityId && u.id === hoveredEntityId) hoveredUnit = u;
        if (selectedEntityId && u.id === selectedEntityId) selectedUnit = u;
      }
    }
  }

  const kingdomEpochsKey = sim.kingdomEpochs
    ? Object.entries(sim.kingdomEpochs)
        .map(([k, v]) => `${k}=${v}`)
        .join(',')
    : '';
  const zoneCacheKey = shouldComputeZones
    ? `${sim.seed}:${Math.floor(sim.year)}:${sim.buildings.length}:${sim.units.length}:${kingdomEpochsKey}:${Math.floor(hudTick / 10)}`
    : 'idle';
  const kingdomLabelsKey =
    !anyZoneActive && activeZones.kingdomLabels && gameState !== 'title'
      ? `${sim.seed}:${sim.buildings.length}:${sim.units.length}:${kingdomEpochsKey}:${Math.floor(hudTick / 10)}`
      : 'off';

  const worldZones = useMemo(() => {
    if (!shouldComputeZones) return null;
    return computeWorldZones(simRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldComputeZones, zoneCacheKey]);
  worldZonesRef.current = worldZones;

  const hoveredZoneInfo = useMemo(() => {
    if (!worldZones || !hoverTile) return null;
    return inspectTileZones(worldZones, simRef.current, hoverTile.x, hoverTile.z);
  }, [worldZones, hoverTile]);

  const zoneOverlayVersionRef = useRef(0);
  const zoneColorBufRef = useRef<Uint8Array | undefined>(undefined);
  const zoneIdBufRef = useRef<Uint8Array | undefined>(undefined);

  const zoneHighlightHoverTile =
    isInspectTabActive || activeCategory === 'zones' ? hoverTile : null;

  const zoneOverlayBuffers = useMemo(() => {
    zoneOverlayVersionRef.current += 1;
    if (!worldZones || !anyZoneActive) {
      const defaultLabels =
        activeZones.kingdomLabels && gameState !== 'title'
          ? computeKingdomLabelsOnly(simRef.current)
          : [];
      return {
        colorData: new Uint8Array(0),
        idData: new Uint8Array(0),
        anyActive: false,
        kingdomsActive: false,
        kingsActive: false,
        version: zoneOverlayVersionRef.current,
        labels: defaultLabels,
        kingdomColors: {} as Record<string, string>,
      };
    }

    const packed = buildZoneOverlayTextures(
      worldZones,
      activeZones,
      zoneHighlightHoverTile,
      zoneColorBufRef.current,
      zoneIdBufRef.current,
      activeZones.alliances
        ? {
            selectedAllianceKingdomId,
            kingdomRelations: simRef.current.kingdomRelations,
            settlementKingdoms: simRef.current.settlementKingdoms,
          }
        : undefined,
    );
    zoneColorBufRef.current = packed.colorData;
    zoneIdBufRef.current = packed.idData;
    const kingdomColors = extractKingdomColorsMap(worldZones, simRef.current);
    return {
      colorData: packed.colorData,
      idData: packed.idData,
      anyActive: packed.anyActive,
      kingdomsActive: Boolean(activeZones.kingdoms || activeZones.alliances),
      kingsActive: Boolean(activeZones.kings),
      version: zoneOverlayVersionRef.current,
      labels: packed.labels,
      kingdomColors,
    };
  }, [
    worldZones,
    activeZones,
    anyZoneActive,
    zoneHighlightHoverTile,
    selectedAllianceKingdomId,
    zoneCacheKey,
    kingdomLabelsKey,
    gameState,
  ]);

  const handleToggleZone = useCallback((zoneType: ZoneOverlayType, label: string) => {
    setActiveZones((prev) => {
      const nextVal = !prev[zoneType];
      if (zoneType === 'alliances') {
        if (!nextVal) {
          setSelectedAllianceKingdomId(null);
        }
        setStatusFeedback(
          nextVal
            ? 'Alliances ON · Click any kingdom zone to view Allies (Blue) & Enemies (Red)'
            : `${label}: OFF`,
        );
      } else {
        setStatusFeedback(`${label}: ${nextVal ? 'ON' : 'OFF'}`);
      }
      return { ...prev, [zoneType]: nextVal };
    });
    soundEngine.playClick();
  }, []);

  const avgEpochInfo = computeAverageCivilizationEpoch(sim);
  const currentEpoch = EPOCHS[avgEpochInfo.roundedIndex] || EPOCHS[0];
  const activeWorldEvent = sim.activeWorldEvent ?? null;
  const isEventCinematic =
    gameState === 'playing' &&
    Boolean(
      activeWorldEvent &&
        activeWorldEvent.cinematicActive &&
        !activeWorldEvent.dismissedByUser &&
        activeWorldEvent.remaining > 0,
    );
  const inspectedTile = hoverTile ? getTile(sim, hoverTile.x, hoverTile.z) : null;
  const inspectedBuilding = hoverTile
    ? sim.buildings.find((b) => b.tileX === hoverTile.x && b.tileZ === hoverTile.z)
    : undefined;

  const activeToolLabel = (() => {
    if (activeTool.kind === 'inspect') return 'Inspect';
    if (activeTool.kind === 'power') {
      return GOD_POWERS.find((p) => p.type === activeTool.power)?.name ?? 'Power';
    }
    if (activeTool.kind === 'terrain') {
      return TERRAIN_TOOLS.find((t) => t.type === activeTool.tool)?.name ?? 'Land';
    }
    if (activeTool.kind === 'build') {
      return BUILDINGS.find((b) => b.type === activeTool.building)?.name ?? 'Build';
    }
    return UNITS.find((u) => u.role === activeTool.unit)?.name ?? 'Unit';
  })();

  return (
    <main className="relative w-[100dvw] h-[100dvh] overflow-hidden bg-[#141210] text-[#f2ece1]">
      {/* 3D Pixelated Isometric World Canvas */}
      <IsometricWorldCanvas
        key={sim.gridSize}
        simRef={simRef}
        gameState={gameState}
        timeScale={timeScale}
        activeTool={activeTool}
        brushRadius={brushRadius}
        brushSize={brushSize}
        brushInputMode={brushInputMode}
        mobilePanMode={mobilePanMode}
        pixelScale={pixelScale}
        lightingPreset={lightingPreset}
        graphicsSettings={graphicsSettings}
        cameraActionRef={cameraActionRef}
        captureThumbnailRef={captureThumbnailRef}
        hoveredEntityId={isInspectTabActive ? hoveredEntityId : null}
        selectedEntityId={isInspectTabActive ? selectedEntityId : null}
        followingEntityId={isInspectTabActive ? followingEntityId : null}
        zoneOverlayBuffers={zoneOverlayBuffers}
        onTileInteract={handleTileInteract}
        onHoverTileChange={setHoverTile}
        onHoverEntityChange={setHoveredEntityId}
        onSelectEntity={handleSelectEntity}
        onBreakFollow={handleBreakFollow}
        onSyncHud={syncHud}
        onPerfTelemetry={setPerfTelemetry}
      />

      {/* Optional Phase 0 Performance Debug HUD (toggled via F3 or Settings) */}
      {graphicsSettings.showPerformanceHud && perfTelemetry && (
        <PerformanceHud
          stats={perfTelemetry}
          strictLossless={graphicsSettings.strictLossless !== false}
          onClose={() => {
            setGraphicsSettings((prev) => {
              const next = { ...prev, showPerformanceHud: false };
              saveGraphicsSettings(next);
              return next;
            });
          }}
        />
      )}

      {/* TITLE SCREEN OVERLAY */}
      {gameState === 'title' && (
        <div className="fixed inset-0 z-30 pointer-events-none flex items-center justify-center p-2 sm:p-4">
          {/* LEFT COLLAPSIBLE UPDATE LOG */}
          <aside
            aria-label="Update Log"
            data-testid="start-update-log"
            className="pointer-events-auto fixed left-2 top-2 sm:left-4 sm:top-4 z-40 max-w-[calc(100vw-16px)]"
          >
            {updateLogCollapsed ? (
              <button
                type="button"
                data-testid="toggle-update-log"
                onClick={() => {
                  setUpdateLogCollapsed(false);
                  soundEngine.playClick();
                }}
                className="px-panel px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center gap-2 text-xs font-semibold text-[#e8e0d2] cursor-pointer hover:text-[#f5b742]"
              >
                <HudPixelIcon kind="log" className="w-4 h-4 text-[#f5b742]" />
                <span>Updates</span>
              </button>
            ) : (
              <div className="px-panel w-[min(17.5rem,calc(100vw-16px))] sm:w-64 p-3 sm:p-4 max-h-[calc(100dvh-24px)] flex flex-col">
                <div className="flex items-center justify-between mb-2.5 sm:mb-3 shrink-0">
                  <span className="text-sm font-bold text-[#f5b742]">Updates</span>
                  <button
                    type="button"
                    data-testid="toggle-update-log"
                    onClick={() => {
                      setUpdateLogCollapsed(true);
                      soundEngine.playClick();
                    }}
                    className="text-xs text-[#a89f91] hover:text-[#f2ece1] cursor-pointer"
                  >
                    Hide
                  </button>
                </div>

                <div className="space-y-3 text-xs max-h-[55dvh] sm:max-h-60 overflow-y-auto pr-1" data-testid="update-log-scroll">
                  {UPDATE_LOG_ENTRIES.map((entry) => (
                    <div key={entry.version}>
                      <div
                        className={`font-bold tabular-nums mb-1 ${
                          entry.isMajor ? 'text-[#f5b742]' : 'text-[#e8e0d2]'
                        }`}
                      >
                        {entry.version}
                      </div>
                      <ul className="space-y-0.5 text-[#b8afa2] leading-snug">
                        {entry.items.map((item, idx) => (
                          <li key={idx}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* BOTTOM-LEFT VERSION */}
          <div
            data-testid="game-version-badge"
            className="pointer-events-auto fixed left-2.5 bottom-2 sm:left-4 sm:bottom-4 z-30 text-[11px] sm:text-xs text-[#cfc6b8] tabular-nums select-none drop-shadow-[0_2px_0_#0b0a09]"
          >
            Godmulator {GAME_VERSION}
          </div>

          {/* MAIN START MENU (Optically Centered) */}
          {titleMenuStep === 'main' && (
            <div
              data-testid="start-menu-main"
              className="pointer-events-auto w-[min(280px,calc(100vw-16px))] max-h-[calc(100dvh-20px)] overflow-y-auto px-panel p-4 sm:p-6 [@media(max-height:460px)]:p-3.5 sm:-translate-y-3 flex flex-col items-center gap-4 sm:gap-6 [@media(max-height:460px)]:gap-2.5"
            >
              <TitleEmblemSvg centered />

              <div className="w-full flex flex-col gap-2 sm:gap-2.5">
                <button
                  type="button"
                  data-start="true"
                  data-testid="start-play-btn"
                  onClick={() => {
                    soundEngine.playClick();
                    activeSaveIdRef.current = null;
                    setHasSavedWorld(false);
                    setWorldConfig((prev) => ({ ...prev, worldName: 'My World' }));
                    setTitleMenuStep('create_world');
                  }}
                  className="px-btn-primary w-full min-h-[42px] sm:min-h-[44px] py-2 sm:py-2.5 text-base font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd166]"
                >
                  New World
                </button>

                <button
                  type="button"
                  data-testid="start-continue-btn"
                  onClick={() => {
                    soundEngine.playClick();
                    setRenamingWorldId(null);
                    setDeletingWorldId(null);
                    setEditingRulesWorldId(null);
                    setTitleMenuStep('continue_worlds');
                    void refreshSavedWorlds();
                  }}
                  className="px-btn w-full min-h-[42px] sm:min-h-[44px] py-2 sm:py-2.5 text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd166]"
                >
                  Continue
                </button>

                <button
                  type="button"
                  data-testid="start-settings-btn"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('settings');
                  }}
                  className="px-btn w-full min-h-[42px] sm:min-h-[44px] py-2 sm:py-2.5 text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd166]"
                >
                  Settings
                </button>

                <button
                  type="button"
                  data-testid="start-credits-btn"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('credits');
                  }}
                  className="px-btn w-full min-h-[42px] sm:min-h-[44px] py-2 sm:py-2.5 text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd166]"
                >
                  Credits
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: CREATE WORLD */}
          {titleMenuStep === 'create_world' && (
            <div
              data-testid="create-world-modal"
              className="pointer-events-auto w-[min(28rem,calc(100vw-16px))] max-h-[calc(100dvh-16px)] overflow-y-auto px-panel p-4 sm:p-6 space-y-3.5 sm:space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#f5b742]">Create World</h2>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('main');
                  }}
                  className="text-xs text-[#b8afa2] hover:text-[#f2ece1] cursor-pointer px-1 py-1"
                >
                  Back
                </button>
              </div>

              {/* Name & Seed */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                <div>
                  <label htmlFor="create-world-name" className="block text-[#b8afa2] mb-1">
                    Name
                  </label>
                  <div className="flex gap-1">
                    <input
                      id="create-world-name"
                      type="text"
                      value={worldConfig.worldName}
                      onChange={(e) =>
                        setWorldConfig((prev) => ({ ...prev, worldName: e.target.value }))
                      }
                      className="px-panel-inset w-full px-2.5 py-2 text-xs text-[#f2ece1] outline-none focus:border-[#f5b742]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const names = [
                          'Terra',
                          'Eden',
                          'Avalon',
                          'Pangaea',
                          'Atlantis',
                          'Gaia',
                          'Midgard',
                          'Sol',
                        ];
                        const pick = names[Math.floor(Math.random() * names.length)];
                        setWorldConfig((prev) => ({ ...prev, worldName: pick }));
                        soundEngine.playClick();
                      }}
                      className="px-btn px-2.5 text-xs cursor-pointer shrink-0"
                      title="Random Name"
                    >
                      ↻
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="title-seed-input" className="block text-[#b8afa2] mb-1">
                    Seed
                  </label>
                  <div className="flex gap-1">
                    <input
                      id="title-seed-input"
                      type="text"
                      value={seedInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSeedInput(val);
                        setWorldConfig((prev) => ({
                          ...prev,
                          seed: normalizeSeed(val || undefined),
                        }));
                      }}
                      className="px-panel-inset w-full px-2.5 py-2 text-xs text-[#f2ece1] tabular-nums outline-none focus:border-[#f5b742]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newSeed = normalizeSeed(undefined);
                        setSeedInput(String(newSeed));
                        setWorldConfig((prev) => {
                          const updated = { ...prev, seed: newSeed };
                          const previewSim = createInitialSimulationState(128, newSeed, {
                            ...updated,
                            gridSize: 128,
                          });
                          simRef.current = previewSim;
                          setHudTick((t) => t + 1);
                          return updated;
                        });
                        soundEngine.playBuild();
                      }}
                      className="px-btn px-2.5 text-xs cursor-pointer shrink-0"
                      title="Random Seed"
                    >
                      ↻
                    </button>
                  </div>
                </div>
              </div>

              {/* Templates Dropdown (borderless button with title line and directional arrow) */}
              <div>
                <button
                  type="button"
                  data-testid="templates-dropdown-toggle"
                  aria-expanded={showTemplatesDropdown}
                  onClick={() => {
                    soundEngine.playClick();
                    setShowTemplatesDropdown((prev) => !prev);
                  }}
                  className="w-full flex items-center justify-between py-1 bg-transparent border-0 outline-none text-xs text-[#b8afa2] hover:text-[#f2ece1] cursor-pointer select-none"
                >
                  <span>
                    Templates{' '}
                    <span className="text-[#f5b742] font-semibold">
                      ({WORLD_TEMPLATES.find((t) => t.id === worldConfig.template)?.name ?? 'Fantasy'})
                    </span>
                  </span>
                  <span className="text-[11px] text-[#b8afa2] leading-none flex items-center">
                    {showTemplatesDropdown ? (
                      <HudPixelIcon kind="chevronDown" className="w-3 h-3 pixelated-canvas" />
                    ) : (
                      '>'
                    )}
                  </span>
                </button>
                {showTemplatesDropdown && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {WORLD_TEMPLATES.map((tpl) => {
                      const isSelected = worldConfig.template === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          data-testid={`template-${tpl.id}`}
                          onClick={() => handleSelectTemplate(tpl.id)}
                          className={`p-2.5 text-left cursor-pointer ${
                            isSelected ? 'px-slot-active' : 'px-slot'
                          }`}
                        >
                          <div className="text-xs font-bold text-[#f2ece1]">{tpl.name}</div>
                          <div className="text-[11px] text-[#9e9486] leading-tight mt-0.5">
                            {tpl.tagline}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Map Size Slider (64x64 up to 512x512 Titanic) */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <label htmlFor="map-size-slider" className="text-[#b8afa2]">
                    Map Size
                  </label>
                  <span className="font-bold text-[#f2ece1] tabular-nums">
                    {worldConfig.gridSize}×{worldConfig.gridSize}
                    {worldConfig.gridSize === 384
                      ? ' (Huge)'
                      : worldConfig.gridSize === 512
                        ? ' (Titanic)'
                        : ''}
                  </span>
                </div>
                <input
                  id="map-size-slider"
                  data-testid="map-size-slider"
                  type="range"
                  min={64}
                  max={512}
                  step={32}
                  value={worldConfig.gridSize}
                  onChange={(e) => {
                    const nextSize = Number(e.target.value);
                    setWorldConfig((prev) => ({ ...prev, gridSize: nextSize }));
                    soundEngine.playClick();
                  }}
                  className="px-range w-full"
                />
                <div className="text-[11px] text-[#b8afa2] mt-1.5 tabular-nums">
                  Max City Pop: <span className="font-semibold text-[#f2ece1]">{getMaxCityPopulation(worldConfig.gridSize)}</span> per city
                </div>
                {worldConfig.gridSize >= 384 && (
                  <div
                    data-testid="beefy-computer-warning"
                    className="text-xs text-[#56cfe1] font-semibold mt-1"
                  >
                    {worldConfig.gridSize === 512
                      ? 'Titanic 512×512 world — powered by chunk greedy meshing & Web Workers!'
                      : 'Huge 384×384 world — powered by chunk greedy meshing & Web Workers!'}
                  </div>
                )}
              </div>

              {/* Custom Geography (Progressive Disclosure when Custom is active) */}
              {worldConfig.template === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-1">
                  <div>
                    <span className="block text-[#b8afa2] mb-1">Sea Level</span>
                    <div className="grid grid-cols-3 gap-1">
                      {(['low', 'normal', 'high'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => {
                            soundEngine.playClick();
                            setWorldConfig((prev) => ({ ...prev, seaLevel: lvl }));
                          }}
                          className={`py-1 text-[11px] capitalize cursor-pointer ${
                            worldConfig.seaLevel === lvl ? 'px-btn-active font-bold' : 'px-btn'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[#b8afa2] mb-1">Relief</span>
                    <div className="grid grid-cols-3 gap-1">
                      {(['low', 'normal', 'high'] as const).map((mtn) => (
                        <button
                          key={mtn}
                          type="button"
                          onClick={() => {
                            soundEngine.playClick();
                            setWorldConfig((prev) => ({ ...prev, mountainDensity: mtn }));
                          }}
                          className={`py-1 text-[11px] capitalize cursor-pointer ${
                            worldConfig.mountainDensity === mtn ? 'px-btn-active font-bold' : 'px-btn'
                          }`}
                        >
                          {mtn}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[#b8afa2] mb-1">Climate</span>
                    <div className="grid grid-cols-3 gap-1">
                      {(['cold', 'temperate', 'warm'] as const).map((clim) => (
                        <button
                          key={clim}
                          type="button"
                          onClick={() => {
                            soundEngine.playClick();
                            setWorldConfig((prev) => ({ ...prev, climate: clim }));
                          }}
                          className={`py-1 text-[11px] capitalize cursor-pointer ${
                            worldConfig.climate === clim ? 'px-btn-active font-bold' : 'px-btn'
                          }`}
                        >
                          {clim === 'temperate' ? 'mild' : clim}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('main');
                  }}
                  className="px-btn px-4 py-2.5 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  data-testid="next-world-rules-btn"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('world_rules');
                  }}
                  className="px-btn-primary px-5 py-2.5 text-sm font-bold cursor-pointer"
                >
                  World Rules &gt;
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: INITIAL WORLD RULES */}
          {titleMenuStep === 'world_rules' && (
            <div
              data-testid="world-rules-modal"
              className="pointer-events-auto w-[min(28rem,calc(100vw-16px))] max-h-[calc(100dvh-16px)] overflow-y-auto px-panel p-4 sm:p-6 space-y-3.5 sm:space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#f5b742]">World Rules</h2>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('create_world');
                  }}
                  className="text-xs text-[#b8afa2] hover:text-[#f2ece1] cursor-pointer"
                >
                  Back
                </button>
              </div>

              {/* Starting Age Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <label htmlFor="starting-age-slider" className="text-[#b8afa2]">
                    Starting Age
                  </label>
                  <span className="font-bold text-[#f2ece1]">
                    {EPOCHS[worldConfig.rules.startingEpochIndex]?.name}
                  </span>
                </div>
                <input
                  id="starting-age-slider"
                  data-testid="starting-age-slider"
                  type="range"
                  min={0}
                  max={EPOCHS.length - 1}
                  step={1}
                  value={worldConfig.rules.startingEpochIndex}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setWorldConfig((prev) => ({
                      ...prev,
                      rules: { ...prev.rules, startingEpochIndex: idx },
                    }));
                    soundEngine.playClick();
                  }}
                  className="px-range w-full"
                />
              </div>

              {/* Starting Settlers */}
              <div>
                <div className="text-xs text-[#b8afa2] mb-1.5">Starting Settlers</div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'none', label: 'None' },
                      { id: 'pioneers', label: 'Pioneers' },
                      { id: 'colony', label: 'Colony' },
                    ] as const
                  ).map((opt) => {
                    const isSel = worldConfig.rules.startingSettlers === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid={`rule-settlers-${opt.id}`}
                        onClick={() => {
                          soundEngine.playClick();
                          setWorldConfig((prev) => ({
                            ...prev,
                            rules: { ...prev.rules, startingSettlers: opt.id },
                          }));
                        }}
                        className={`py-2 text-xs font-semibold cursor-pointer ${
                          isSel ? 'px-btn-active font-bold' : 'px-btn'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Concise Rule Switches */}
              <div>
                <div className="text-xs text-[#b8afa2] mb-1.5">God Rules</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[34dvh] sm:max-h-[210px] overflow-y-auto pr-0.5">
                  {GOD_RULE_SWITCHES.map((rule) => {
                    const isOn = worldConfig.rules[rule.key];
                    return (
                      <button
                        key={rule.key}
                        type="button"
                        aria-pressed={isOn}
                        title={rule.summary}
                        data-testid={`rule-toggle-${rule.key}`}
                        onClick={() => {
                          soundEngine.playClick();
                          setWorldConfig((prev) => ({
                            ...prev,
                            rules: {
                              ...prev.rules,
                              [rule.key]: !prev.rules[rule.key],
                            },
                          }));
                        }}
                        className={`px-3 py-2 flex items-center justify-between text-xs cursor-pointer ${
                          isOn ? 'px-slot-active font-bold text-[#f2ece1]' : 'px-slot text-[#b8afa2]'
                        }`}
                      >
                        <span className="truncate pr-2">{rule.label}</span>
                        <span
                          className={`w-2.5 h-2.5 border border-[#0b0a09] shrink-0 ${
                            isOn ? 'bg-[#80ed99]' : 'bg-[#34302a]'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('create_world');
                  }}
                  className="px-btn px-4 py-2.5 text-xs font-semibold cursor-pointer"
                >
                  Back
                </button>

                <button
                  type="button"
                  data-testid="launch-world-btn"
                  onClick={handleBeginWorldLoading}
                  className="px-btn-primary px-6 py-2.5 text-sm font-bold cursor-pointer"
                >
                  Create World &gt;
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: LOADING WORLD */}
          {titleMenuStep === 'loading_world' && (
            <div
              data-testid="loading-world-modal"
              className="pointer-events-auto w-[min(20rem,calc(100vw-16px))] px-panel p-5 sm:p-6 text-center space-y-3"
            >
              <div className="text-base font-bold text-[#f5b742]">
                {worldConfig.worldName}
              </div>

              <div className="px-panel-inset w-full h-4 p-0.5 overflow-hidden">
                <div
                  className="h-full bg-[#f5b742] transition-all duration-150"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-[#b8afa2] tabular-nums">
                <span className="truncate pr-2">{loadingStageText}</span>
                <span className="text-[#f2ece1] font-bold">{loadingProgress}%</span>
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {titleMenuStep === 'settings' && (
            <div
              data-testid="start-settings-modal"
              className="pointer-events-auto w-[min(28rem,calc(100vw-16px))] max-h-[calc(100dvh-16px)] overflow-y-auto px-panel p-4 sm:p-6 space-y-4 sm:space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#f5b742]">Settings</h2>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('main');
                  }}
                  className="text-xs text-[#b8afa2] hover:text-[#f2ece1] cursor-pointer px-1 py-1"
                >
                  Back
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#e8e0d2]">Sound Effects</span>
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className={`px-3 py-1.5 font-semibold cursor-pointer ${
                      !muted ? 'px-btn-active font-bold' : 'px-btn'
                    }`}
                  >
                    {muted ? 'Off' : 'On'}
                  </button>
                </div>

                <GraphicsSettingsPanel
                  settings={graphicsSettings}
                  onChange={handleUpdateGraphicsSettings}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setTitleMenuStep('main');
                }}
                className="px-btn-primary w-full py-2.5 text-sm font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {/* CREDITS */}
          {titleMenuStep === 'credits' && (
            <div
              data-testid="start-credits-modal"
              className="pointer-events-auto w-[min(24rem,calc(100vw-16px))] max-h-[calc(100dvh-16px)] overflow-y-auto px-panel p-4 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#f5b742]">Credits</h2>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('main');
                  }}
                  className="text-xs text-[#b8afa2] hover:text-[#f2ece1] cursor-pointer px-1 py-1"
                >
                  Back
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-[#cfc6b8] leading-relaxed">
                <div className="text-[#f2ece1] font-bold">
                  Godmulator {GAME_VERSION}
                </div>
                <p>
                  3D pixel god simulator with procedural continents, dynamic land &amp; sea zones, and multi-epoch civilizations.
                </p>
                <div className="pt-1 text-[#b8afa2] space-y-1">
                  <div>Drag / WASD / Right-Drag — Pan</div>
                  <div>Pinch / Scroll — Zoom</div>
                  <div>Two-Finger Twist / Buttons — Rotate</div>
                  <div>H — Hide / Show Toolbar</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setTitleMenuStep('main');
                }}
                className="px-btn-primary w-full py-2.5 text-sm font-bold cursor-pointer"
              >
                Back
              </button>
            </div>
          )}

          {/* CONTINUE: LOCALLY SAVED WORLDS */}
          {titleMenuStep === 'continue_worlds' && (
            <div
              data-testid="continue-worlds-modal"
              className="pointer-events-auto w-[min(46rem,calc(100vw-16px))] max-h-[calc(100dvh-20px)] flex flex-col px-panel p-4 sm:p-6 gap-3.5"
            >
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-lg font-bold text-[#f5b742]">Saved Worlds</h2>
                <button
                  type="button"
                  data-testid="continue-back-btn"
                  onClick={() => {
                    soundEngine.playClick();
                    setEditingRulesWorldId(null);
                    setEditingRulesDraft(null);
                    setTitleMenuStep('main');
                  }}
                  className="px-btn px-3 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  Back
                </button>
              </div>

              {savedWorldsLoading ? (
                <div className="px-panel-inset p-6 text-center text-xs text-[#b8afa2]">
                  Loading saved worlds...
                </div>
              ) : savedWorlds.length === 0 ? (
                <div
                  data-testid="saved-worlds-empty"
                  className="px-panel-inset p-6 text-center space-y-3"
                >
                  <div className="text-sm font-semibold text-[#e8e0d2]">
                    No saved worlds yet
                  </div>
                  <p className="text-xs text-[#a89f91]">
                    Create a new world and save your progress to continue later.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      activeSaveIdRef.current = null;
                      setHasSavedWorld(false);
                      setTitleMenuStep('create_world');
                    }}
                    className="px-btn-primary px-4 py-2 text-xs font-bold cursor-pointer"
                  >
                    New World
                  </button>
                </div>
              ) : (
                <div
                  data-testid="saved-worlds-list"
                  className="overflow-y-auto pr-1 space-y-3 max-h-[66dvh]"
                >
                  {savedWorlds.map((w) => {
                    const epochName = EPOCHS[w.epochIndex]?.name ?? 'Prehistoric Age';
                    const isRenaming = renamingWorldId === w.id;
                    const isConfirmingDelete = deletingWorldId === w.id;
                    const savedDateLabel = new Date(w.savedAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    return (
                      <div
                        key={w.id}
                        data-testid={`saved-world-card-${w.id}`}
                        className="px-panel-inset p-2.5 sm:p-3 flex flex-col sm:flex-row gap-3 items-stretch"
                      >
                        {/* Static Map Thumbnail */}
                        <div className="w-full sm:w-44 h-28 sm:h-[104px] shrink-0 bg-[#0d0b09] border border-[#3a3026] overflow-hidden flex items-center justify-center">
                          {w.thumbnailDataUrl ? (
                            <img
                              src={w.thumbnailDataUrl}
                              alt={`${w.name} map preview`}
                              className="w-full h-full object-cover pixelated-canvas"
                            />
                          ) : (
                            <div className="text-center px-2">
                              <div className="text-[11px] font-bold text-[#f5b742]">
                                {w.gridSize}×{w.gridSize}
                              </div>
                              <div className="text-[10px] text-[#8f8478]">No Thumbnail</div>
                            </div>
                          )}
                        </div>

                        {/* Metadata & Actions */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                          <div>
                            {isRenaming ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  data-testid={`rename-world-input-${w.id}`}
                                  value={renameDraft}
                                  maxLength={32}
                                  autoFocus
                                  onChange={(e) => setRenameDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      void handleConfirmRenameSavedWorld(w.id);
                                    } else if (e.key === 'Escape') {
                                      setRenamingWorldId(null);
                                    }
                                  }}
                                  className="px-input flex-1 min-w-0 text-sm py-1 px-2"
                                />
                                <button
                                  type="button"
                                  data-testid={`rename-world-save-${w.id}`}
                                  onClick={() => void handleConfirmRenameSavedWorld(w.id)}
                                  className="px-btn-primary px-2.5 py-1 text-xs font-bold cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRenamingWorldId(null)}
                                  className="px-btn px-2 py-1 text-xs cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-baseline justify-between gap-2">
                                <h3 className="text-sm sm:text-base font-bold text-[#f2ece1] truncate">
                                  {w.name}
                                </h3>
                                <span className="text-[11px] text-[#8f8478] shrink-0 tabular-nums">
                                  {savedDateLabel}
                                </span>
                              </div>
                            )}

                            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[#cfc6b8] tabular-nums">
                              <span className="text-[#f5b742] font-semibold">{epochName}</span>
                              <span>·</span>
                              <span>{formatYearLabel(w.year)}</span>
                              <span>·</span>
                              <span className="text-[#80ed99]">Pop: {w.population}</span>
                              <span>·</span>
                              <span>
                                {w.gridSize}×{w.gridSize}
                              </span>
                            </div>
                            {w.description && (
                              <p
                                data-testid={`saved-world-desc-${w.id}`}
                                className="mt-1 text-[11px] text-[#a89f91] leading-snug line-clamp-2"
                              >
                                {w.description}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              data-testid={`load-world-btn-${w.id}`}
                              onClick={() => void handleLoadSavedWorld(w)}
                              className="px-btn-primary px-3 py-1.5 text-xs font-bold cursor-pointer"
                            >
                              Play
                            </button>
                            <button
                              type="button"
                              data-testid={`rename-world-btn-${w.id}`}
                              onClick={() => {
                                soundEngine.playClick();
                                setDeletingWorldId(null);
                                setRenamingWorldId(w.id);
                                setRenameDraft(w.name);
                              }}
                              className="px-btn px-2.5 py-1.5 text-xs cursor-pointer"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              data-testid={`rules-world-btn-${w.id}`}
                              onClick={() => handleOpenSavedWorldRules(w)}
                              className="px-btn px-2.5 py-1.5 text-xs cursor-pointer"
                            >
                              World Rules
                            </button>
                            {isConfirmingDelete ? (
                              <>
                                <button
                                  type="button"
                                  data-testid={`confirm-delete-world-btn-${w.id}`}
                                  onClick={() => void handleConfirmDeleteSavedWorld(w.id)}
                                  className="px-btn px-2.5 py-1.5 text-xs font-bold text-[#ff8f8f] border-[#a83232] cursor-pointer"
                                >
                                  Confirm Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingWorldId(null)}
                                  className="px-btn px-2 py-1.5 text-xs cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                data-testid={`delete-world-btn-${w.id}`}
                                onClick={() => {
                                  soundEngine.playClick();
                                  setRenamingWorldId(null);
                                  setDeletingWorldId(w.id);
                                }}
                                className="px-btn px-2.5 py-1.5 text-xs text-[#e89f9f] cursor-pointer ml-auto"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Nested Saved World Rules Editor */}
              {editingRulesWorldId && editingRulesDraft && (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Edit Saved World Rules"
                  data-testid="saved-world-rules-modal"
                  className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0c0b]/80 p-2 sm:p-4"
                >
                  <div className="w-[min(30rem,calc(100vw-16px))] max-h-[calc(100dvh-20px)] overflow-y-auto px-panel p-4 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base sm:text-lg font-bold text-[#f5b742]">
                        Edit World Rules
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          setEditingRulesWorldId(null);
                          setEditingRulesDraft(null);
                        }}
                        className="text-xs text-[#b8afa2] hover:text-[#f2ece1] cursor-pointer"
                      >
                        Close
                      </button>
                    </div>

                    {/* Age Slider */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <label htmlFor="saved-world-age-slider" className="text-[#b8afa2]">
                          World Age
                        </label>
                        <span className="font-bold text-[#f2ece1]">
                          {EPOCHS[editingEpochDraft]?.name ?? 'Prehistoric Age'}
                        </span>
                      </div>
                      <input
                        id="saved-world-age-slider"
                        type="range"
                        min={0}
                        max={EPOCHS.length - 1}
                        step={1}
                        value={editingEpochDraft}
                        onChange={(e) => {
                          setEditingEpochDraft(Number(e.target.value));
                          soundEngine.playClick();
                        }}
                        className="px-range w-full"
                      />
                    </div>

                    {/* Sky Lighting Preset */}
                    <div>
                      <div className="text-xs text-[#b8afa2] mb-1.5">Sky Lighting</div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                        {(['auto', 'dawn', 'noon', 'dusk', 'night', 'midnight'] as LightingPreset[]).map(
                          (lp) => (
                            <button
                              key={lp}
                              type="button"
                              onClick={() => {
                                soundEngine.playClick();
                                setEditingLightingDraft(lp);
                                setEditingRulesDraft((prev) =>
                                  prev ? { ...prev, dayNightCycle: lp === 'auto' } : prev,
                                );
                              }}
                              className={`py-1 text-[11px] capitalize cursor-pointer ${
                                editingLightingDraft === lp ? 'px-btn-active font-bold' : 'px-btn'
                              }`}
                            >
                              {lp === 'midnight' ? 'dark' : lp}
                            </button>
                          ),
                        )}
                      </div>
                    </div>

                    {/* God Rule Switches */}
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {GOD_RULE_SWITCHES.map((sw) => {
                        const enabled = Boolean(editingRulesDraft[sw.key]);
                        return (
                          <div
                            key={sw.key}
                            className="px-panel-inset px-2.5 py-2 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#f2ece1]">{sw.label}</div>
                              <div className="text-[11px] text-[#a89f91] leading-snug">
                                {sw.summary}
                              </div>
                            </div>
                            <button
                              type="button"
                              data-testid={`saved-rule-toggle-${sw.key}`}
                              onClick={() => {
                                soundEngine.playClick();
                                setEditingRulesDraft((prev) => {
                                  if (!prev) return prev;
                                  const nextVal = !prev[sw.key];
                                  if (sw.key === 'dayNightCycle') {
                                    setEditingLightingDraft(nextVal ? 'auto' : 'noon');
                                  }
                                  return { ...prev, [sw.key]: nextVal };
                                });
                              }}
                              className={`shrink-0 px-2.5 py-1 text-xs font-bold cursor-pointer ${
                                enabled ? 'px-btn-active' : 'px-btn text-[#8f8478]'
                              }`}
                            >
                              {enabled ? 'ON' : 'OFF'}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          setEditingRulesWorldId(null);
                          setEditingRulesDraft(null);
                        }}
                        className="px-btn px-3.5 py-2 text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        data-testid="save-edited-world-rules-btn"
                        onClick={() => void handleSaveEditedWorldRules()}
                        className="px-btn-primary px-4 py-2 text-xs font-bold cursor-pointer"
                      >
                        Save Rules
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* WORLD EVENT CINEMATIC OVERLAY (hides HUD, displays pixelated radial speed lines & border-line title; click anywhere dismisses) */}
      {isEventCinematic && activeWorldEvent && (
        <div
          role="button"
          tabIndex={0}
          data-testid="world-event-cinematic-overlay"
          aria-label={`Dismiss ${activeWorldEvent.title} event camera`}
          onClick={() => {
            dismissWorldEventCinematic(simRef.current);
            cameraActionRef.current.zoomDelta += 14;
            soundEngine.playClick();
            setHudTick((t) => t + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
              dismissWorldEventCinematic(simRef.current);
              cameraActionRef.current.zoomDelta += 14;
              soundEngine.playClick();
              setHudTick((t) => t + 1);
            }
          }}
          className="fixed inset-0 z-30 cursor-pointer select-none flex flex-col justify-between items-center pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] px-4"
        >
          {/* Pixelated Radial Speed Lines Framing Overlay */}
          <svg
            viewBox="0 0 160 90"
            preserveAspectRatio="none"
            shapeRendering="crispEdges"
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 w-full h-full opacity-70 animate-pulse"
          >
            {Array.from({ length: 24 }).map((_, idx) => {
              const angle = (idx / 24) * Math.PI * 2 + 0.13;
              const cos = Math.cos(angle);
              const sin = Math.sin(angle);
              const innerR = 30 + (idx % 3) * 5;
              const steps = 8;
              const rayColor =
                activeWorldEvent.kind === 'deep_freeze'
                  ? idx % 2 === 0
                    ? '#bae6fd'
                    : '#38bdf8'
                  : activeWorldEvent.kind === 'starfall_aurora'
                    ? idx % 2 === 0
                      ? '#ffd166'
                      : '#56cfe1'
                    : activeWorldEvent.kind === 'super_tornado'
                      ? idx % 2 === 0
                        ? '#c084fc'
                        : '#818cf8'
                      : idx % 2 === 0
                        ? '#ffd166'
                        : '#ff6b35';
              return Array.from({ length: steps }).map((__, sIdx) => {
                const r = innerR + sIdx * 5.2;
                const px = Math.round(80 + cos * r * 1.45);
                const py = Math.round(45 + sin * r * 0.95);
                const sz = sIdx >= 4 ? 2 : 1;
                return (
                  <rect
                    key={`${idx}-${sIdx}`}
                    x={px}
                    y={py}
                    width={sz}
                    height={sz}
                    fill={rayColor}
                    fillOpacity={0.28 + (sIdx / steps) * 0.58}
                  />
                );
              });
            })}
          </svg>

          {/* Bare Event Title Header: No background fill or box borders, just text with horizontal border lines */}
          <div
            data-testid="world-event-title-header"
            className="pointer-events-none relative mt-2 sm:mt-4 px-8 py-2.5 text-center bg-transparent border-t-2 border-b-2 border-l-0 border-r-0"
            style={{
              borderColor: activeWorldEvent.accentColor,
            }}
          >
            <h2
              className="text-lg sm:text-3xl font-bold uppercase tracking-[0.22em] leading-tight"
              style={{
                color: activeWorldEvent.accentColor,
                textShadow: '2px 2px 0 #090807, -1px -1px 0 #090807, 1px -1px 0 #090807, -1px 1px 0 #090807',
              }}
            >
              {activeWorldEvent.title}
            </h2>
            {activeWorldEvent.subtitle && (
              <p
                data-testid="world-event-description"
                className="mt-1 text-xs sm:text-sm font-medium tracking-[0.06em] text-[#f2ece1] max-w-xl mx-auto"
                style={{
                  textShadow: '1px 1px 0 #090807, -1px -1px 0 #090807, 1px -1px 0 #090807, -1px 1px 0 #090807',
                }}
              >
                {activeWorldEvent.subtitle}
              </p>
            )}
          </div>

          <span
            className="pointer-events-none text-[10px] sm:text-xs uppercase tracking-[0.18em] text-[#f2ece1]/90 mb-2"
            style={{
              textShadow: '1px 1px 0 #090807, -1px -1px 0 #090807',
            }}
          >
            Click anywhere to return
          </span>
        </div>
      )}

      {/* PLAYING HUD OVERLAY */}
      {gameState !== 'title' && !isEventCinematic && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between gap-1 sm:gap-1.5 pt-[max(0.25rem,env(safe-area-inset-top))] pb-[max(0.25rem,env(safe-area-inset-bottom))] pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))] sm:p-2.5 md:p-3">
          {/* Active World Event compact banner when cinematic camera is dismissed */}
          {activeWorldEvent && activeWorldEvent.remaining > 0 && (
            <div
              data-testid="world-event-active-banner"
              className="pointer-events-none self-center px-4 py-1 text-center bg-[#12100e]/85 border-t-2 border-b-2"
              style={{ borderColor: activeWorldEvent.accentColor }}
            >
              <div
                className="text-xs sm:text-sm font-bold uppercase tracking-[0.18em]"
                style={{ color: activeWorldEvent.accentColor }}
              >
                {activeWorldEvent.title}
              </div>
              {activeWorldEvent.subtitle && (
                <div
                  data-testid="world-event-active-description"
                  className="text-[11px] sm:text-xs text-[#f2ece1]/90 tracking-[0.04em]"
                >
                  {activeWorldEvent.subtitle}
                </div>
              )}
            </div>
          )}
          {/* TOP BAR: Single compact non-wrapping top row + slim single-line resource strip on mobile */}
          <div className="flex flex-wrap lg:flex-nowrap items-stretch justify-between gap-1 sm:gap-2 w-full">
            {/* Left: Average Civilization Age, Year & Pop */}
            <div
              className="relative group pointer-events-auto px-panel min-h-[32px] sm:min-h-[46px] px-1.5 py-0.5 sm:px-3 sm:py-1.5 flex items-center justify-between gap-1 sm:gap-3 flex-1 sm:flex-initial min-w-0 order-1 shrink"
              title="The current average age of civilization in the world"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1 sm:gap-2 min-w-0">
                  <span
                    data-testid="hud-average-age"
                    className="font-bold text-[10px] sm:text-sm text-[#f5b742] whitespace-nowrap truncate leading-tight"
                  >
                    {currentEpoch.name}
                  </span>
                  <span className="font-pixel-num text-[9px] sm:text-[11px] text-[#e8e0d2] whitespace-nowrap leading-tight shrink-0">
                    {formatYearLabel(sim.year)}
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 text-[9px] sm:text-xs text-[#b8afa2] tabular-nums leading-tight">
                  <span className="whitespace-nowrap">
                    Pop <span className="font-pixel-num text-[9px] sm:text-[10px] text-[#f2ece1]">{sim.population}</span>
                  </span>
                  {sim.goldenAgeTimer > 0 && (
                    <span className="font-pixel-num text-[9px] sm:text-[10px] text-[#ffd166] whitespace-nowrap">
                      ★ {Math.ceil(sim.goldenAgeTimer)}s
                    </span>
                  )}
                </div>
              </div>
              <div
                role="tooltip"
                className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute left-0 top-full mt-1.5 z-40 px-panel px-2.5 py-1.5 text-[10px] sm:text-xs text-[#f2ece1] whitespace-nowrap shadow-lg"
              >
                The current average age of civilization in the world
              </div>
            </div>

            {/* Center: Resources Strip (ultra-slim inline on mobile, spacious two-line on sm+) */}
            <div
              data-testid="hud-resources-bar"
              className="pointer-events-auto px-panel min-h-[22px] sm:min-h-[46px] px-1.5 py-0.5 sm:px-3.5 sm:py-1 flex items-center justify-between sm:justify-center gap-1.5 sm:gap-3.5 w-full lg:w-auto max-w-full overflow-x-auto no-scrollbar order-3 lg:order-2 [@media(max-height:480px)]:w-auto"
            >
              {RESOURCE_KEYS.map(({ key, label }) => {
                const amount = Math.floor(sim.resources[key]);
                const rate = Math.round(sim.rates[key]);
                const rateText = rate >= 0 ? `+${rate}/s` : `${rate}/s`;
                return (
                  <div
                    key={key}
                    data-testid={`resource-${key}`}
                    title={`${label}: ${amount} (${rateText})`}
                    className="flex flex-row sm:flex-col items-center justify-center gap-0.5 sm:gap-0 sm:min-w-[34px] shrink-0 [@media(max-height:480px)]:flex-row [@media(max-height:480px)]:gap-1 [@media(max-height:480px)]:min-w-0"
                  >
                    <ResourceIconSvg resource={key} className="w-3 h-3 sm:w-4 sm:h-4 pixelated-canvas shrink-0" />
                    <span className="font-pixel-num text-[9px] sm:text-[10px] text-[#f2ece1] leading-none sm:mt-1 [@media(max-height:480px)]:mt-0">
                      {amount}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Right Cluster: Streamlined Time/Camera Controls + System Utilities */}
            <div className="flex items-stretch gap-1 sm:gap-2 shrink-0 order-2 lg:order-3">
              {/* Time & View Controls */}
              <div
                data-testid="hud-controls-bar"
                className="pointer-events-auto px-panel min-h-[32px] sm:min-h-[46px] px-1 sm:px-2 py-0.5 sm:py-1 flex items-center gap-0.5 sm:gap-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (timeScale === 0) {
                      setTimeScale(lastNonZeroSpeedRef.current || 1);
                    } else {
                      lastNonZeroSpeedRef.current = timeScale;
                      setTimeScale(0);
                    }
                    soundEngine.playClick();
                  }}
                  className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer shrink-0 ${
                    timeScale === 0 ? 'px-btn-active' : 'px-btn'
                  }`}
                  aria-label={timeScale === 0 ? 'Resume simulation' : 'Pause simulation'}
                  title={timeScale === 0 ? 'Resume time' : 'Pause time'}
                >
                  <HudPixelIcon
                    kind={timeScale === 0 ? 'play' : 'pause'}
                    className="w-4 h-4 pixelated-canvas"
                  />
                </button>

                {/* Speed Popover Trigger */}
                <div ref={speedMenuWrapperRef} className="relative">
                  <button
                    type="button"
                    data-testid="hud-speed-btn"
                    aria-expanded={speedMenuOpen}
                    onClick={() => {
                      setCameraMenuOpen(false);
                      setSpeedMenuOpen((prev) => !prev);
                      soundEngine.playClick();
                    }}
                    className={`h-6 sm:h-8 px-1 sm:px-2 flex items-center gap-0.5 sm:gap-1 font-pixel-num text-[10px] sm:text-[11px] cursor-pointer whitespace-nowrap shrink-0 ${
                      speedMenuOpen ? 'px-btn-active font-bold' : 'px-btn'
                    }`}
                    title="Simulation Speed"
                  >
                    <span>{timeScale}x</span>
                    <HudPixelIcon kind="chevronDown" className="w-2.5 h-2.5 sm:w-3 sm:h-3 pixelated-canvas" />
                  </button>

                  {speedMenuOpen && (
                    <div
                      role="dialog"
                      aria-label="Simulation Speed"
                      data-testid="hud-speed-popover"
                      className="px-panel absolute right-0 top-[calc(100%+6px)] z-30 w-44 sm:w-48 p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#b8afa2]">Speed</span>
                        <span className="font-pixel-num font-bold text-[#f5b742] tabular-nums">
                          {timeScale === 0 ? 'Paused (0x)' : `${timeScale}x`}
                        </span>
                      </div>
                      <input
                        type="range"
                        data-testid="hud-speed-slider"
                        min={0}
                        max={SIMULATION_SPEED_OPTIONS.length - 1}
                        step={1}
                        value={Math.max(
                          0,
                          SIMULATION_SPEED_OPTIONS.indexOf(
                            timeScale as (typeof SIMULATION_SPEED_OPTIONS)[number],
                          ),
                        )}
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          const scale = SIMULATION_SPEED_OPTIONS[idx] ?? 1;
                          const clamped = clampSimulationSpeed(scale);
                          if (clamped > 0) {
                            lastNonZeroSpeedRef.current = clamped;
                          }
                          setTimeScale(clamped);
                          soundEngine.playClick();
                        }}
                        className="px-range w-full cursor-pointer"
                      />
                      <div className="flex items-center justify-between text-[10px] text-[#9e9486] font-pixel-num">
                        <span>0x</span>
                        <span>1x</span>
                        <span>{SIMULATION_SPEED_OPTIONS[SIMULATION_SPEED_OPTIONS.length - 1]}x</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Camera & View Popover Trigger */}
                <div ref={cameraMenuWrapperRef} className="relative">
                  <button
                    type="button"
                    data-testid="hud-camera-btn"
                    aria-expanded={cameraMenuOpen}
                    onClick={() => {
                      setSpeedMenuOpen(false);
                      setCameraMenuOpen((prev) => !prev);
                      soundEngine.playClick();
                    }}
                    className={`h-6 w-6 sm:w-auto sm:h-8 sm:px-2 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                      cameraMenuOpen || mobilePanMode ? 'px-btn-active font-bold' : 'px-btn'
                    }`}
                    aria-label="Camera Controls"
                    title="Camera & View Controls"
                  >
                    <HudPixelIcon kind="camera" className="w-4 h-4 pixelated-canvas" />
                    <span className="hidden sm:inline">View</span>
                  </button>

                  {cameraMenuOpen && (
                    <div
                      role="dialog"
                      aria-label="Camera Controls"
                      className="px-panel absolute right-0 top-[calc(100%+6px)] z-30 p-2 w-48 max-w-[calc(100vw-16px)] space-y-2"
                    >
                      <div className="text-[11px] font-bold text-[#f5b742]">Camera Controls</div>
                      <div className="grid grid-cols-5 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            cameraActionRef.current.zoomDelta -= 14;
                            soundEngine.playClick();
                          }}
                          className="px-btn h-8 flex items-center justify-center cursor-pointer"
                          aria-label="Zoom In"
                          title="Zoom In"
                        >
                          <HudPixelIcon kind="zoomIn" className="w-4 h-4 pixelated-canvas" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            cameraActionRef.current.zoomDelta += 14;
                            soundEngine.playClick();
                          }}
                          className="px-btn h-8 flex items-center justify-center cursor-pointer"
                          aria-label="Zoom Out"
                          title="Zoom Out"
                        >
                          <HudPixelIcon kind="zoomOut" className="w-4 h-4 pixelated-canvas" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            cameraActionRef.current.rotateDelta -= Math.PI / 4;
                            soundEngine.playClick();
                          }}
                          className="px-btn h-8 flex items-center justify-center cursor-pointer"
                          aria-label="Rotate Left"
                          title="Rotate Left"
                        >
                          <HudPixelIcon kind="rotateLeft" className="w-4 h-4 pixelated-canvas" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            cameraActionRef.current.centerHome = true;
                            soundEngine.playClick();
                          }}
                          className="px-btn h-8 flex items-center justify-center cursor-pointer"
                          aria-label="Center Camera"
                          title="Center on Town"
                        >
                          <HudPixelIcon kind="center" className="w-4 h-4 pixelated-canvas" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            cameraActionRef.current.rotateDelta += Math.PI / 4;
                            soundEngine.playClick();
                          }}
                          className="px-btn h-8 flex items-center justify-center cursor-pointer"
                          aria-label="Rotate Right"
                          title="Rotate Right"
                        >
                          <HudPixelIcon kind="rotateRight" className="w-4 h-4 pixelated-canvas" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMobilePanMode((prev) => {
                            const next = !prev;
                            setStatusFeedback(
                              next
                                ? 'Pan mode ON: drag moves camera'
                                : 'Pan mode OFF: click/drag uses active tool',
                            );
                            return next;
                          });
                          soundEngine.playClick();
                        }}
                        className={`w-full h-8 px-2 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer ${
                          mobilePanMode ? 'px-btn-active font-bold' : 'px-btn text-[#e8e0d2]'
                        }`}
                      >
                        <HudPixelIcon kind="pan" className="w-4 h-4 pixelated-canvas" />
                        <span>{mobilePanMode ? '1-Drag Pan: ON' : '1-Drag Pan: OFF'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* System Utilities (Log, Audio, Settings) */}
              <div
                data-testid="hud-system-bar"
                className="pointer-events-auto px-panel min-h-[32px] sm:min-h-[46px] px-1 sm:px-2 py-0.5 sm:py-1 flex items-center gap-0.5 sm:gap-1 shrink-0"
              >
                <button
                  type="button"
                  onClick={() => {
                    setChronicleOpen((prev) => !prev);
                    soundEngine.playClick();
                  }}
                  className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer shrink-0 ${
                    chronicleOpen ? 'px-btn-active' : 'px-btn'
                  }`}
                  aria-label="World Log"
                  title="World Log"
                >
                  <HudPixelIcon kind="log" className="w-4 h-4 pixelated-canvas" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleToggleMute();
                  }}
                  className="px-btn w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer shrink-0"
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  title={muted ? 'Unmute' : 'Mute'}
                >
                  <HudPixelIcon
                    kind={muted ? 'audioOff' : 'audioOn'}
                    className="w-4 h-4 pixelated-canvas"
                  />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hud-settings-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    soundEngine.playClick();
                    setGameState((prev) => (prev === 'paused' ? 'playing' : 'paused'));
                  }}
                  className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer shrink-0 ${
                    gameState === 'paused' ? 'px-btn-active' : 'px-btn'
                  }`}
                  aria-label="Settings"
                  title="Settings"
                >
                  <HudPixelIcon kind="settings" className="w-4 h-4 pixelated-canvas" />
                </button>
              </div>
            </div>
          </div>

          {/* MIDDLE HUD LAYER: Entity/Zone Inspector & World Log (bounded cleanly between top bar & bottom dock) */}
          <div className="relative flex-1 min-h-0 w-full pointer-events-none">
            {gameState === 'playing' && isInspectTabActive && (
              <EntityInspectorCard
                sim={sim}
                hoveredUnit={hoveredUnit}
                selectedUnit={selectedUnit}
                favoriteUnits={favoriteUnits}
                followingEntityId={followingEntityId}
                hoveredZoneInfo={hoveredZoneInfo}
                activeZones={activeZones}
                onToggleFavorite={handleToggleFavoriteEntity}
                onSelectUnit={handleSelectEntity}
                onFocusUnit={handleFocusEntity}
              />
            )}

            {chronicleOpen && (
              <div className="pointer-events-auto absolute right-0 top-0 z-20 w-[min(24rem,100%)] max-h-[min(240px,100%)] sm:max-h-full px-panel p-2 sm:p-3 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-sm text-[#f5b742]">World Log</h2>
                  <button
                    type="button"
                    onClick={() => setChronicleOpen(false)}
                    className="px-btn px-2 py-0.5 text-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-1.5 text-xs">
                  {sim.chronicle.map((entry) => (
                    <div key={entry.id} className="leading-snug flex gap-2">
                      <span className="font-pixel-num text-[10px] text-[#9e9486] shrink-0 pt-0.5">
                        {entry.yearLabel}
                      </span>
                      <span
                        className={
                          entry.tone === 'epoch'
                            ? 'text-[#ffd166]'
                            : entry.tone === 'warning'
                              ? 'text-[#ff8f6b]'
                              : 'text-[#e8e0d2]'
                        }
                      >
                        {entry.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM PIXEL TOOLBAR DOCK: Compact horizontal-rail layout on mobile, full grid on desktop */}
          <div className="pointer-events-auto self-center relative flex flex-col items-center w-full max-w-[min(880px,calc(100vw-8px))] sm:max-w-[min(880px,calc(100vw-24px))]">
            {/* Hover Tooltip */}
            {!dockCollapsed && hoveredHint && (
              <div className="px-panel px-3 py-1.5 mb-2 max-w-[calc(100vw-24px)] hidden md:flex items-center gap-3 text-xs flex-wrap justify-center pointer-events-none">
                <span className="font-bold text-[#f5b742]">{hoveredHint.title}</span>
                <span className="text-[#80ed99] font-semibold tabular-nums">{hoveredHint.cost}</span>
                <span className="text-[#cfc6b8]">{hoveredHint.detail}</span>
              </div>
            )}

            {/* Folder Tabs Row */}
            <div className="flex items-end justify-between w-full gap-1.5 sm:gap-2 px-0.5 sm:px-1 min-w-0">
              <div
                className="flex items-end gap-0.5 sm:gap-1 min-w-0 overflow-x-auto sm:overflow-visible no-scrollbar"
                role="tablist"
                aria-label="Tools"
              >
                {(
                  [
                    { id: 'powers', label: 'Powers' },
                    { id: 'terrain', label: 'Land' },
                    { id: 'build', label: 'Build' },
                    { id: 'spawn', label: 'Units' },
                    { id: 'zones', label: 'Zones' },
                    { id: 'epochs', label: 'World' },
                    { id: 'inspect', label: 'Inspect' },
                  ] as { id: ToolCategory; label: string }[]
                ).map((tab) => {
                  const isActive =
                    !dockCollapsed &&
                    (activeCategory === tab.id ||
                      (tab.id === 'epochs' && activeCategory === 'rules'));
                  const activeZoneCount =
                    tab.id === 'zones'
                      ? Number(activeZones.kingdoms) +
                        Number(activeZones.kings) +
                        Number(activeZones.territories) +
                        Number(activeZones.biomes) +
                        Number(activeZones.temperature) +
                        Number(activeZones.alliances)
                      : 0;
                  return (
                    <button
                      key={tab.id}
                      data-testid={`tab-${tab.id}`}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => {
                        setDockCollapsed(false);
                        setMobilePanMode(false);
                        setActiveCategory(tab.id);
                        if (tab.id === 'inspect') {
                          setActiveTool({ kind: 'inspect' });
                        } else if (tab.id === 'zones') {
                          setActiveTool({ kind: 'inspect' });
                        } else if (tab.id === 'epochs') {
                          if (activeTool.kind !== 'inspect') {
                            setActiveTool({ kind: 'inspect' });
                          }
                        } else {
                          setHoveredEntityId(null);
                          setFollowingEntityId(null);
                          if (tab.id === 'powers' && activeTool.kind !== 'power') {
                            setActiveTool({ kind: 'power', power: 'blessing' });
                          } else if (tab.id === 'terrain' && activeTool.kind !== 'terrain') {
                            setActiveTool({ kind: 'terrain', tool: 'raise' });
                          } else if (tab.id === 'build' && activeTool.kind !== 'build') {
                            const epochBld =
                              BUILDINGS.find((b) => b.epoch === currentEpoch.id)?.type || 'bonfire';
                            setActiveTool({ kind: 'build', building: epochBld });
                          } else if (tab.id === 'spawn' && activeTool.kind !== 'spawn') {
                            setActiveTool({ kind: 'spawn', unit: 'human' });
                          }
                        }
                        soundEngine.playClick();
                      }}
                      className={`px-1.5 sm:px-3 py-0.5 sm:py-1.5 flex items-center justify-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                        isActive ? 'px-tab-active' : 'px-tab'
                      }`}
                    >
                      <TabPixelIcon category={tab.id} className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className={isActive ? 'inline' : 'hidden sm:inline'}>{tab.label}</span>
                      {activeZoneCount > 0 && (
                        <span className="font-pixel-num text-[9px] text-[#80ed99] tabular-nums">
                          {activeZoneCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-end pb-0.5 sm:pb-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setDockCollapsed((prev) => !prev)}
                  className="px-btn h-[22px] sm:h-7 px-1.5 sm:px-2.5 flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-[#f5b742] cursor-pointer whitespace-nowrap shrink-0"
                  title="Toggle Dock (H)"
                  aria-label={dockCollapsed ? 'Show Tools' : 'Hide Tools'}
                >
                  <HudPixelIcon
                    kind={dockCollapsed ? 'chevronUp' : 'chevronDown'}
                    className="w-3 h-3 sm:w-3.5 sm:h-3.5 pixelated-canvas"
                  />
                  <span className="hidden sm:inline">{dockCollapsed ? 'Show [H]' : 'Hide [H]'}</span>
                </button>
              </div>
            </div>

            {/* Active Pixel Dock Panel */}
            {!dockCollapsed && (
              <div
                className="px-panel w-full px-1.5 py-1 sm:px-4 sm:py-3 max-h-[116px] sm:max-h-[224px] [@media(max-height:500px)]:max-h-[92px] min-h-[46px] sm:min-h-[76px] overflow-y-auto overflow-x-hidden"
                onMouseLeave={() => setHoveredHint(null)}
              >
                {/* Contextual Sub-Bar: Single non-wrapping row on mobile */}
                {(activeCategory === 'powers' ||
                  activeCategory === 'terrain' ||
                  activeCategory === 'build' ||
                  activeCategory === 'spawn') && (
                  <div className="flex flex-nowrap sm:flex-wrap items-center justify-between gap-1 sm:gap-2 pb-1 mb-1 sm:pb-2 sm:mb-2.5 border-b border-[#2e2923] overflow-x-auto no-scrollbar">
                    {/* Left: Digestible Category Filters or Active Brush Context */}
                    <div className="flex flex-nowrap sm:flex-wrap items-center gap-1 shrink-0">
                      {activeCategory === 'powers' && (
                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                          <PixelBrushSelector
                            brushSize={brushSize}
                            mode="powers"
                            onChange={(nextSize) => {
                              setBrushSize(nextSize);
                              soundEngine.playClick();
                            }}
                          />
                          <div className="w-[1px] h-4 bg-[#3d3730] mx-0.5 shrink-0" />
                          {(
                            [
                              { id: 'all', label: 'All' },
                              { id: 'benevolent', label: 'Support' },
                              { id: 'wrathful', label: 'Disasters' },
                              { id: 'cosmic', label: 'Special' },
                            ] as const
                          ).map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                setPowerFilter(f.id);
                                soundEngine.playClick();
                              }}
                              className={`h-6 sm:h-7 px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                                powerFilter === f.id ? 'px-btn-active font-bold' : 'px-btn'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {activeCategory === 'build' &&
                        (
                          [
                            { id: 'all', label: 'All' },
                            { id: 'current', label: currentEpoch.name },
                            { id: 'advanced', label: 'Industrial+' },
                          ] as const
                        ).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              setBuildFilter(f.id);
                              soundEngine.playClick();
                            }}
                            className={`h-6 sm:h-7 px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                              buildFilter === f.id ? 'px-btn-active font-bold' : 'px-btn'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}

                      {activeCategory === 'spawn' &&
                        (
                          [
                            { id: 'all', label: 'All' },
                            { id: 'races', label: 'Races' },
                            { id: 'wildlife', label: 'Animals' },
                            { id: 'mythic', label: 'Mythic' },
                          ] as const
                        ).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              setUnitFilter(f.id);
                              soundEngine.playClick();
                            }}
                            className={`h-6 sm:h-7 px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                              unitFilter === f.id ? 'px-btn-active font-bold' : 'px-btn'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}

                      {activeCategory === 'terrain' && (
                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                          <PixelBrushSelector
                            brushSize={brushSize}
                            onChange={(nextSize) => {
                              setBrushSize(nextSize);
                              soundEngine.playClick();
                            }}
                          />
                          <div className="w-[1px] h-4 bg-[#3d3730] mx-0.5 shrink-0" />
                          {(
                            [
                              { id: 'all', label: 'All' },
                              { id: 'Sculpt', label: 'Terrain' },
                              { id: 'Sky Rain', label: 'Resource Drops' },
                              { id: 'Biomes', label: 'Biomes' },
                              { id: 'Water', label: 'Ocean' },
                            ] as const
                          ).map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                setLandFilter(f.id);
                                soundEngine.playClick();
                              }}
                              className={`h-6 sm:h-7 px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                                landFilter === f.id ? 'px-btn-active font-bold' : 'px-btn'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: Active Tool Label + Input Mode Controls */}
                    <div className="flex items-center gap-1 sm:gap-1.5 ml-auto shrink-0">
                      <span className="hidden md:inline text-[11px] text-[#cfc6b8] mr-1 truncate max-w-[200px]">
                        Selected: <strong className="text-[#f5b742]">{activeToolLabel}</strong>
                      </span>
                      <button
                        type="button"
                        data-testid="toggle-mobile-pan"
                        aria-pressed={mobilePanMode}
                        onClick={() => {
                          setMobilePanMode((prev) => {
                            const next = !prev;
                            setStatusFeedback(
                              next
                                ? 'Pan mode ON: 1-finger drag moves camera'
                                : 'Pan mode OFF: click/drag casts active tool',
                            );
                            return next;
                          });
                          soundEngine.playClick();
                        }}
                        className={`h-6 sm:h-7 px-1.5 sm:px-2 flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                          mobilePanMode ? 'px-btn-active font-bold' : 'px-btn text-[#e8e0d2]'
                        }`}
                        title="Toggle Pan Camera Mode"
                        aria-label="Pan Camera Mode"
                      >
                        <HudPixelIcon kind="pan" className="w-3 h-3 sm:w-3.5 sm:h-3.5 pixelated-canvas" />
                        <span>Pan</span>
                      </button>
                      <button
                        type="button"
                        data-testid="toggle-input-mode"
                        onClick={() => {
                          setBrushInputMode((prev) => {
                            const next = prev === 'hold' ? 'tap' : 'hold';
                            setStatusFeedback(
                              next === 'hold'
                                ? 'Hold & drag mode: paint or cast continuously'
                                : 'Tap mode: single click per cast',
                            );
                            return next;
                          });
                          soundEngine.playClick();
                        }}
                        className={`h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                          brushInputMode === 'hold'
                            ? 'px-btn-active font-bold'
                            : 'px-btn text-[#e8e0d2]'
                        }`}
                        title="Switch between Hold-to-Paint/Cast and Single Tap"
                      >
                        <span className="sm:hidden">{brushInputMode === 'hold' ? 'Hold' : 'Tap'}</span>
                        <span className="hidden sm:inline">{brushInputMode === 'hold' ? 'Mode: Hold' : 'Mode: Tap'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 1: POWERS (Single-row horizontal rail on mobile, wrap grid on sm+) */}
                {activeCategory === 'powers' && (
                  <div className="flex flex-nowrap sm:flex-wrap items-center justify-start gap-1 sm:gap-1.5 overflow-x-auto sm:overflow-visible no-scrollbar">
                    {GOD_POWERS.filter((power) => {
                      if (powerFilter === 'all') return true;
                      if (powerFilter === 'benevolent') return power.category === 'Benevolent';
                      if (powerFilter === 'wrathful') return power.category === 'Wrathful';
                      return power.category === 'Cosmic' || power.type === 'drag_entity';
                    }).map((power) => {
                      const isSelected =
                        activeTool.kind === 'power' && activeTool.power === power.type;
                      const clusterCount =
                        power.type === 'drag_entity' ? 1 : getPowerClusterCount(brushSize);
                      const totalFaithCost = power.faithCost * clusterCount;
                      const affordable =
                        sim.sandboxFreeMode || sim.resources.faith >= totalFaithCost;
                      return (
                        <button
                          key={power.type}
                          type="button"
                          onClick={() => {
                            setMobilePanMode(false);
                            setActiveTool({ kind: 'power', power: power.type });
                            soundEngine.playClick();
                            setStatusFeedback(`${power.name} — ${power.summary}`);
                          }}
                          onMouseEnter={() =>
                            setHoveredHint({
                              title: clusterCount > 1 ? `${power.name} (×${clusterCount})` : power.name,
                              cost: sim.sandboxFreeMode
                                ? 'Free'
                                : `${totalFaithCost} God Energy`,
                              detail: power.summary,
                            })
                          }
                          aria-label={power.name}
                          className={`relative w-[38px] h-[38px] sm:w-11 sm:h-11 shrink-0 flex items-center justify-center cursor-pointer ${
                            isSelected ? 'px-slot-active' : 'px-slot'
                          } ${!affordable ? 'opacity-55' : ''}`}
                        >
                          <PowerPixelIcon power={power.type} className="w-7 h-7 sm:w-8 sm:h-8 pixelated-canvas" />
                          {!sim.sandboxFreeMode && (
                            <span className="absolute bottom-0.5 right-0.5 sm:right-1 font-pixel-num text-[8px] text-[#ffd166] leading-none">
                              {totalFaithCost}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* TAB 2: LAND SCULPTING */}
                {activeCategory === 'terrain' && (
                  <div className="flex flex-nowrap sm:flex-wrap items-center justify-start gap-1 sm:gap-1.5 overflow-x-auto sm:overflow-visible no-scrollbar">
                    {TERRAIN_TOOLS.filter((tool) => landFilter === 'all' || tool.category === landFilter).map((tool) => {
                      const isSelected =
                        activeTool.kind === 'terrain' && activeTool.tool === tool.type;
                      return (
                        <button
                          key={tool.type}
                          type="button"
                          onClick={() => {
                            setMobilePanMode(false);
                            setActiveTool({ kind: 'terrain', tool: tool.type });
                            soundEngine.playClick();
                            setStatusFeedback(`${tool.name} — ${tool.summary}`);
                          }}
                          onMouseEnter={() =>
                            setHoveredHint({
                              title: tool.name,
                              cost: sim.sandboxFreeMode ? 'Free' : `${tool.faithCost} God Energy`,
                              detail: tool.summary,
                            })
                          }
                          aria-label={tool.name}
                          className={`relative w-[38px] h-[38px] sm:w-11 sm:h-11 shrink-0 flex items-center justify-center cursor-pointer ${
                            isSelected ? 'px-slot-active' : 'px-slot'
                          }`}
                        >
                          <TerrainPixelIcon tool={tool.type} className="w-7 h-7 sm:w-8 sm:h-8 pixelated-canvas" />
                          {!sim.sandboxFreeMode && (
                            <span className="absolute bottom-0.5 right-0.5 sm:right-1 font-pixel-num text-[8px] text-[#ffd166] leading-none">
                              {tool.faithCost}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* TAB 3: BUILD STRUCTURES */}
                {activeCategory === 'build' && (
                  <div className="flex flex-nowrap sm:flex-wrap items-center justify-start gap-1 sm:gap-1.5 overflow-x-auto sm:overflow-visible no-scrollbar">
                    {BUILDINGS.filter((bld) => {
                      if (buildFilter === 'all') return true;
                      if (buildFilter === 'current') return bld.epoch === currentEpoch.id;
                      return (
                        bld.epoch === 'industrial' ||
                        bld.epoch === 'atomic' ||
                        bld.epoch === 'information' ||
                        bld.epoch === 'orbital' ||
                        bld.epoch === 'interstellar'
                      );
                    }).map((bld) => {
                      const isSelected =
                        activeTool.kind === 'build' && activeTool.building === bld.type;
                      const affordable = canAfford(sim.resources, bld.cost, sim.sandboxFreeMode);
                      const badge = primaryCostNumber(bld.cost, sim.sandboxFreeMode);
                      const isCurrentEpochBld = bld.epoch === currentEpoch.id;

                      return (
                        <button
                          key={bld.type}
                          type="button"
                          onClick={() => {
                            setMobilePanMode(false);
                            setActiveTool({ kind: 'build', building: bld.type });
                            soundEngine.playClick();
                            setStatusFeedback(`${bld.name} — ${bld.roleSummary}`);
                          }}
                          onMouseEnter={() =>
                            setHoveredHint({
                              title: bld.name,
                              cost: formatCompactCost(bld.cost, sim.sandboxFreeMode),
                              detail: bld.roleSummary,
                            })
                          }
                          aria-label={bld.name}
                          className={`relative w-[38px] h-[38px] sm:w-11 sm:h-11 shrink-0 flex items-center justify-center cursor-pointer ${
                            isSelected ? 'px-slot-active' : 'px-slot'
                          } ${!affordable ? 'opacity-55' : ''}`}
                        >
                          <BuildingPixelIcon building={bld.type} className="w-7 h-7 sm:w-8 sm:h-8 pixelated-canvas" />
                          {isCurrentEpochBld && (
                            <span
                              className="absolute top-1 left-1 w-1.5 h-1.5 bg-[#80ed99]"
                              title={`Unlocked in ${currentEpoch.name}`}
                            />
                          )}
                          {badge && (
                            <span className="absolute bottom-0.5 right-0.5 sm:right-1 font-pixel-num text-[8px] text-[#f5b742] leading-none">
                              {badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* TAB 4: SPECIES UNITS + ANIMALS & MYTHICAL BEASTS */}
                {activeCategory === 'spawn' && (
                  <div className="flex flex-nowrap sm:flex-wrap items-center justify-start gap-1 sm:gap-1.5 overflow-x-auto sm:overflow-visible no-scrollbar">
                    {(unitFilter === 'all' || unitFilter === 'races') &&
                      SPECIES_UNITS.filter(
                        (u) =>
                          sim.worldRules?.allowFantasy !== false ||
                          (u.role !== 'elf' && u.role !== 'orc'),
                      ).map((u) => {
                        const isSelected =
                          activeTool.kind === 'spawn' && activeTool.unit === u.role;
                        const isFree = sim.sandboxFreeMode;
                        const badge = primaryCostNumber(u.cost, isFree);

                        return (
                          <button
                            key={u.role}
                            type="button"
                            onClick={() => {
                              setMobilePanMode(false);
                              setActiveTool({ kind: 'spawn', unit: u.role });
                              soundEngine.playClick();
                              setStatusFeedback(`${u.name} — ${u.roleSummary}`);
                            }}
                            onMouseEnter={() =>
                              setHoveredHint({
                                title: u.name,
                                cost: formatCompactCost(u.cost, isFree),
                                detail: u.roleSummary,
                              })
                            }
                            aria-label={u.name}
                            className={`relative px-1.5 sm:px-2.5 h-[38px] sm:h-11 shrink-0 flex items-center gap-1 sm:gap-2 cursor-pointer ${
                              isSelected ? 'px-slot-active' : 'px-slot'
                            }`}
                          >
                            <UnitPixelIcon role={u.role} className="w-7 h-7 sm:w-8 sm:h-8 pixelated-canvas shrink-0" />
                            <span className="text-[10px] sm:text-xs font-bold text-[#f2ece1] whitespace-nowrap">
                              {u.name}
                            </span>
                            {badge && (
                              <span className="font-pixel-num text-[9px] text-[#ffd166] leading-none">
                                {badge}
                              </span>
                            )}
                          </button>
                        );
                      })}

                    {unitFilter === 'all' && (
                      <span
                        className="w-px h-7 bg-[#3a332b] mx-0.5 hidden sm:inline-block"
                        aria-hidden="true"
                      />
                    )}

                    {[
                      ...(unitFilter === 'all' || unitFilter === 'wildlife'
                        ? ANIMAL_UNITS.filter(
                            (u) => sim.worldRules?.allowDinosaurs !== false || u.role !== 'dinosaur',
                          )
                        : []),
                      ...(unitFilter === 'all' || unitFilter === 'mythic'
                        ? sim.worldRules?.allowFantasy !== false
                          ? MYTHICAL_BEAST_UNITS
                          : []
                        : []),
                    ].map((u) => {
                      const isSelected =
                        activeTool.kind === 'spawn' && activeTool.unit === u.role;
                      const isFree = sim.sandboxFreeMode;
                      const badge = primaryCostNumber(u.cost, isFree);
                      const isMythic = u.category === 'mythical';

                      return (
                        <button
                          key={u.role}
                          type="button"
                          onClick={() => {
                            setMobilePanMode(false);
                            setActiveTool({ kind: 'spawn', unit: u.role });
                            soundEngine.playClick();
                            setStatusFeedback(`${u.name} — ${u.roleSummary}`);
                          }}
                          onMouseEnter={() =>
                            setHoveredHint({
                              title: u.name,
                              cost: formatCompactCost(u.cost, isFree),
                              detail: u.roleSummary,
                            })
                          }
                          aria-label={u.name}
                          className={`relative w-[38px] h-[38px] sm:w-11 sm:h-11 shrink-0 flex items-center justify-center cursor-pointer ${
                            isSelected ? 'px-slot-active' : 'px-slot'
                          }`}
                        >
                          <UnitPixelIcon role={u.role} className="w-7 h-7 sm:w-8 sm:h-8 pixelated-canvas" />
                          {badge && (
                            <span className="absolute bottom-0.5 right-0.5 sm:right-1 font-pixel-num text-[8px] text-[#ffd166] leading-none">
                              {badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* TAB 5: ZONES */}
                {activeCategory === 'zones' && (
                  <div className="flex items-center justify-between gap-2 overflow-x-auto sm:overflow-visible no-scrollbar">
                    <div className="flex flex-nowrap sm:flex-wrap items-center gap-1 sm:gap-1.5" role="group" aria-label="Zone Overlays">
                      {(
                        [
                          {
                            id: 'kingdomLabels' as ZoneOverlayType,
                            label: 'Kingdom Labels',
                            shortLabel: 'Labels',
                            count: worldZones
                              ? Array.from(worldZones.kingdomsById.values()).filter((k) => k.buildingCount > 0).length
                              : 0,
                            summary:
                              'Show floating name, age, and population labels whenever a race founds a civilization (without territory zone shading)',
                          },
                          {
                            id: 'kingdoms' as ZoneOverlayType,
                            label: 'Kingdoms & Cities',
                            shortLabel: 'Kingdoms',
                            count: worldZones ? worldZones.kingdomsById.size : 0,
                            summary:
                              'Toggle dynamic land & maritime sea borders and population counts for all Cities & Kingdoms',
                          },
                          {
                            id: 'alliances' as ZoneOverlayType,
                            label: 'Alliances & Wars',
                            shortLabel: 'Alliances',
                            count: worldZones ? worldZones.kingdomsById.size : 0,
                            summary:
                              'Click a kingdom zone to highlight itself & allies in Blue and war enemies in Red',
                          },
                          {
                            id: 'kings' as ZoneOverlayType,
                            label: 'Kingdom Kings',
                            shortLabel: 'Kings',
                            count: livingKings.length,
                            summary:
                              'Toggle floating royal crown icons and name labels for every Kingdom King',
                          },
                          {
                            id: 'territories' as ZoneOverlayType,
                            label: 'Animal Territories',
                            shortLabel: 'Territories',
                            count: worldZones ? worldZones.territoriesById.size : 0,
                            summary:
                              'Toggle habitat-contoured hunting & grazing territories across land, lagoons, and sea shoals',
                          },
                          {
                            id: 'biomes' as ZoneOverlayType,
                            label: 'Biome Zones',
                            shortLabel: 'Biomes',
                            count: worldZones
                              ? Array.from(worldZones.biomesById.values()).filter((b) => b.tileCount > 0).length
                              : 0,
                            summary:
                              'Toggle ecological land & marine biome regions, resource density, and world coverage',
                          },
                          {
                            id: 'temperature' as ZoneOverlayType,
                            label: 'Temperatures',
                            shortLabel: 'Temp',
                            count: worldZones
                              ? Array.from(worldZones.tempBandsById.values()).filter((t) => t.tileCount > 0).length
                              : 5,
                            summary:
                              'Toggle contoured thermal bands shaped by latitude, elevation peaks, wildfires, and foundries',
                          },
                        ]
                      ).map((zItem) => {
                        const isOn = activeZones[zItem.id];
                        return (
                          <button
                            key={zItem.id}
                            type="button"
                            aria-pressed={isOn}
                            aria-label={zItem.label}
                            data-testid={`zone-toggle-${zItem.id}`}
                            onClick={() => handleToggleZone(zItem.id, zItem.label)}
                            onMouseEnter={() =>
                              setHoveredHint({
                                title: zItem.label,
                                cost: isOn ? 'ON (Active)' : 'OFF',
                                detail: zItem.summary,
                              })
                            }
                            className={`relative px-1.5 sm:px-2.5 h-[38px] sm:h-11 shrink-0 flex items-center gap-1 sm:gap-2 cursor-pointer transition-colors ${
                              isOn ? 'px-slot-active' : 'px-slot'
                            }`}
                          >
                            <ZonePixelIcon zone={zItem.id} className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 pixelated-canvas" />
                            <div className="flex flex-col items-start leading-tight">
                              <span className="text-[10px] sm:text-xs font-bold text-[#f2ece1] whitespace-nowrap">
                                {zItem.shortLabel}
                              </span>
                              <span
                                className={`font-pixel-num text-[8px] sm:text-[9px] tabular-nums ${
                                  isOn ? 'text-[#80ed99]' : 'text-[#9e9486]'
                                }`}
                              >
                                {isOn ? `ON · ${zItem.count}` : 'OFF'}
                              </span>
                            </div>
                          </button>
                        );
                      })}

                      {(anyZoneActive || activeZones.kingdomLabels) && (
                        <button
                          type="button"
                          data-testid="zone-clear-all"
                          onClick={() => {
                            setActiveZones({
                              ...DEFAULT_ZONE_TOGGLES,
                              kingdomLabels: false,
                            });
                            setSelectedAllianceKingdomId(null);
                            setStatusFeedback('All zone overlays & labels hidden');
                            soundEngine.playClick();
                          }}
                          className="px-btn px-2 sm:px-2.5 h-[38px] sm:h-11 shrink-0 text-[10px] sm:text-xs font-semibold text-[#ff8f6b] cursor-pointer whitespace-nowrap"
                          title="Turn off all zone overlays and labels"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 6: WORLD (Ages, Sky, Seed + God Rules Sub-Tab) */}
                {(activeCategory === 'epochs' || activeCategory === 'rules') && (
                  <div className="flex flex-col gap-1.5 sm:gap-2.5">
                    <div className="flex items-center justify-between gap-2 pb-1 sm:pb-2 border-b border-[#2e2923]">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          data-testid="world-subtab-ages"
                          onClick={() => {
                            setActiveCategory('epochs');
                            setWorldSubTab('ages');
                            soundEngine.playClick();
                          }}
                          className={`h-6 sm:h-7 px-2 sm:px-2.5 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-semibold cursor-pointer ${
                            worldSubTab === 'ages' && activeCategory !== 'rules'
                              ? 'px-btn-active font-bold'
                              : 'px-btn'
                          }`}
                        >
                          <TabPixelIcon category="epochs" className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span>Ages &amp; Sky</span>
                        </button>
                        <button
                          type="button"
                          data-testid="world-subtab-rules"
                          onClick={() => {
                            setActiveCategory('epochs');
                            setWorldSubTab('rules');
                            soundEngine.playClick();
                          }}
                          className={`h-6 sm:h-7 px-2 sm:px-2.5 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-semibold cursor-pointer ${
                            worldSubTab === 'rules' || activeCategory === 'rules'
                              ? 'px-btn-active font-bold'
                              : 'px-btn'
                          }`}
                        >
                          <TabPixelIcon category="rules" className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span>God Rules</span>
                        </button>
                      </div>
                      {(worldSubTab === 'rules' || activeCategory === 'rules') && (
                        <span className="hidden sm:inline text-[11px] text-[#a89f91]">
                          Toggle live world laws &amp; creature rules
                        </span>
                      )}
                    </div>

                    {worldSubTab === 'rules' || activeCategory === 'rules' ? (
                      <div
                        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1 sm:gap-1.5"
                        data-testid="god-rules-panel"
                      >
                        {GOD_RULE_SWITCHES.map((rule) => {
                          const activeRules = sim.worldRules ?? DEFAULT_WORLD_RULES;
                          const isOn =
                            rule.key === 'autoBuildEnabled'
                              ? sim.autoBuildEnabled
                              : rule.key === 'sandboxFreeMode'
                                ? sim.sandboxFreeMode
                                : rule.key === 'dayNightCycle'
                                  ? Boolean(activeRules.dayNightCycle || lightingPreset === 'auto')
                                  : Boolean(activeRules[rule.key]);
                          return (
                            <button
                              key={rule.key}
                              type="button"
                              aria-pressed={isOn}
                              data-testid={`god-rule-${rule.key}`}
                              onClick={() => handleToggleGodRule(rule.key)}
                              onMouseEnter={() =>
                                setHoveredHint({
                                  title: rule.label,
                                  cost: isOn ? 'Active' : 'Disabled',
                                  detail: rule.summary,
                                })
                              }
                              className={`px-2 sm:px-2.5 h-7 sm:h-9 flex items-center justify-between gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] cursor-pointer ${
                                isOn
                                  ? 'px-slot-active font-bold text-[#f2ece1]'
                                  : 'px-slot text-[#9d9486]'
                              }`}
                            >
                              <span className="truncate">{rule.label}</span>
                              <span
                                className={`w-2 h-2 sm:w-2.5 sm:h-2.5 border border-[#0b0a09] shrink-0 ${
                                  isOn ? 'bg-[#80ed99]' : 'bg-[#34302a]'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 sm:gap-2">
                        {/* Age Dropdown (matches Create World dropdown style) */}
                        <div>
                          <button
                            type="button"
                            data-testid="world-age-dropdown-toggle"
                            aria-expanded={showWorldAgeDropdown}
                            onClick={() => {
                              soundEngine.playClick();
                              setShowWorldAgeDropdown((prev) => !prev);
                            }}
                            className="w-full flex items-center justify-between py-0.5 sm:py-1 bg-transparent border-0 outline-none text-[11px] sm:text-xs text-[#b8afa2] hover:text-[#f2ece1] cursor-pointer select-none"
                          >
                            <span>
                              Age{' '}
                              <span className="text-[#f5b742] font-semibold">
                                ({currentEpoch.name})
                              </span>
                            </span>
                            <span className="text-[11px] text-[#b8afa2] leading-none flex items-center">
                              {showWorldAgeDropdown ? (
                                <HudPixelIcon kind="chevronDown" className="w-3 h-3 pixelated-canvas" />
                              ) : (
                                '>'
                              )}
                            </span>
                          </button>
                          {showWorldAgeDropdown && (
                            <div className="flex flex-nowrap sm:flex-wrap items-center justify-start gap-1 mt-1.5 overflow-x-auto sm:overflow-visible no-scrollbar">
                              {EPOCHS.map((ep) => {
                                const isCurrent = sim.epochIndex === ep.index;
                                return (
                                  <button
                                    key={ep.id}
                                    type="button"
                                    onClick={() => {
                                      const s = simRef.current;
                                      s.epochIndex = ep.index;
                                      if (!s.kingdomEpochs) s.kingdomEpochs = {};
                                      if (!s.kingdomEpochProgress) s.kingdomEpochProgress = {};
                                      for (const b of s.buildings) {
                                        b.epochLevel = ep.index;
                                        if (b.settlementId) {
                                          const kid = getKingdomId(s, b.settlementId);
                                          s.kingdomEpochs[kid] = ep.index;
                                          s.kingdomEpochProgress[kid] = ep.index >= EPOCHS.length - 1 ? 100 : 0;
                                        }
                                      }
                                      syncAverageEpochFromKingdoms(s);
                                      soundEngine.playEpochAscend();
                                      setStatusFeedback(ep.name);
                                      setShowWorldAgeDropdown(false);
                                      setHudTick((t) => t + 1);
                                    }}
                                    className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                                      isCurrent ? 'px-btn-active' : 'px-btn'
                                    }`}
                                  >
                                    {ep.name}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Sky Dropdown (matches Create World dropdown style) */}
                        <div>
                          <button
                            type="button"
                            data-testid="world-sky-dropdown-toggle"
                            aria-expanded={showWorldSkyDropdown}
                            onClick={() => {
                              soundEngine.playClick();
                              setShowWorldSkyDropdown((prev) => !prev);
                            }}
                            className="w-full flex items-center justify-between py-0.5 sm:py-1 bg-transparent border-0 outline-none text-[11px] sm:text-xs text-[#b8afa2] hover:text-[#f2ece1] cursor-pointer select-none"
                          >
                            <span>
                              Sky{' '}
                              <span className="text-[#f5b742] font-semibold capitalize">
                                ({sim.worldRules?.dayNightCycle || lightingPreset === 'auto' ? 'Cycle' : lightingPreset})
                              </span>
                            </span>
                            <span className="text-[11px] text-[#b8afa2] leading-none flex items-center">
                              {showWorldSkyDropdown ? (
                                <HudPixelIcon kind="chevronDown" className="w-3 h-3 pixelated-canvas" />
                              ) : (
                                '>'
                              )}
                            </span>
                          </button>
                          {showWorldSkyDropdown && (
                            <div className="flex flex-nowrap sm:flex-wrap items-center justify-start gap-1 mt-1.5 overflow-x-auto sm:overflow-visible no-scrollbar">
                              {(['auto', 'dawn', 'noon', 'dusk', 'night', 'midnight'] as LightingPreset[]).map((lp) => {
                                const isSkyActive =
                                  lp === 'auto'
                                    ? lightingPreset === 'auto' || Boolean(sim.worldRules?.dayNightCycle)
                                    : lightingPreset === lp && !sim.worldRules?.dayNightCycle;
                                return (
                                  <button
                                    key={lp}
                                    type="button"
                                    onClick={() => {
                                      setLightingPreset(lp);
                                      if (!simRef.current.worldRules) {
                                        simRef.current.worldRules = { ...DEFAULT_WORLD_RULES };
                                      }
                                      simRef.current.worldRules.dayNightCycle = lp === 'auto';
                                      soundEngine.playClick();
                                      setShowWorldSkyDropdown(false);
                                      setHudTick((t) => t + 1);
                                    }}
                                    className={`px-1.5 sm:px-2 py-0.5 sm:py-1 capitalize text-[10px] sm:text-xs cursor-pointer shrink-0 ${
                                      isSkyActive ? 'px-btn-active font-bold' : 'px-btn'
                                    }`}
                                  >
                                    {lp === 'auto' ? 'Cycle' : lp}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 7: INSPECT */}
                {activeCategory === 'inspect' && (
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-[#e8e0d2] min-h-[36px] sm:min-h-[48px]">
                    <span>{statusFeedback}</span>
                    {inspectedTile && (
                      <span className="text-[#f5b742] tabular-nums">
                        ({inspectedTile.x}, {inspectedTile.z}) Height {inspectedTile.height}{' '}
                        {inspectedBuilding
                          ? `${inspectedBuilding.settlementId && sim.settlementNames?.[inspectedBuilding.settlementId] ? `${sim.settlementNames[inspectedBuilding.settlementId]} ` : ''}${inspectedBuilding.type.replace('_', ' ')}`
                          : inspectedTile.terrain.replace('_', ' ')}
                      </span>
                    )}
                    {hoveredZoneInfo && (
                      <>
                        {hoveredZoneInfo.kingdom && (
                          <span className="text-[#80ed99] font-semibold tabular-nums">
                            Kingdom: {hoveredZoneInfo.kingdom.name} (Pop {hoveredZoneInfo.kingdom.population}
                            {hoveredZoneInfo.kingdom.maxPopulation > 0
                              ? `/${hoveredZoneInfo.kingdom.maxPopulation}`
                              : ''}
                            {hoveredZoneInfo.isKingdomMaritime ? ' · Maritime Waters' : ''})
                          </span>
                        )}
                        {hoveredZoneInfo.territory && (
                          <span className="text-[#fb923c] font-semibold">
                            Territory: {hoveredZoneInfo.territory.name} ({hoveredZoneInfo.territory.animalCount}{' '}
                            {hoveredZoneInfo.territory.speciesLabel})
                          </span>
                        )}
                        {hoveredZoneInfo.biomeZone && (
                          <span className="text-[#56cfe1]">
                            Biome: {hoveredZoneInfo.biomeZone.name}
                          </span>
                        )}
                        <span className="font-pixel-num text-[#ffd166] tabular-nums">
                          Temp: {hoveredZoneInfo.tileTempC}°C ({hoveredZoneInfo.temperatureZone?.name})
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* IN-GAME SETTINGS / PAUSE MODAL */}
      {gameState === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
          data-testid="ingame-settings-modal"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#0d0c0b]/75 p-2 sm:p-4"
        >
          <div className="w-[min(28rem,calc(100vw-16px))] max-h-[calc(100dvh-16px)] overflow-y-auto px-panel p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold text-[#f5b742]">Settings</h2>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#e8e0d2]">Sound Effects</span>
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className={`px-3 py-1.5 font-semibold cursor-pointer ${
                    !muted ? 'px-btn-active font-bold' : 'px-btn'
                  }`}
                >
                  {muted ? 'Off' : 'On'}
                </button>
              </div>

              <GraphicsSettingsPanel
                settings={graphicsSettings}
                onChange={handleUpdateGraphicsSettings}
              />
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setGameState('playing');
                }}
                className="px-btn-primary w-full py-2.5 text-sm font-bold cursor-pointer"
              >
                Resume
              </button>
              <button
                type="button"
                data-testid="pause-save-btn"
                disabled={isSavingWorld}
                onClick={() => handleOpenSaveFlow(false)}
                className="px-btn w-full py-2 text-xs font-semibold cursor-pointer text-[#ffd166]"
              >
                {isSavingWorld ? 'Saving...' : 'Save World'}
              </button>
              <button
                type="button"
                data-testid="ingame-main-menu-btn"
                onClick={handleRequestMainMenu}
                className="px-btn w-full py-2 text-xs font-semibold cursor-pointer"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY MODAL */}
      {gameState === 'gameover' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Victory"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#0d0c0b]/80 p-2 sm:p-4"
        >
          <div className="w-[min(24rem,calc(100vw-16px))] max-h-[calc(100dvh-16px)] overflow-y-auto px-panel p-4 sm:p-6">
            <h2 className="text-2xl font-bold text-[#ffd166] mb-1">Star Ascension</h2>
            <p className="text-xs text-[#cfc6b8] mb-5">
              Your world reached the stars.
            </p>

            <div className="grid grid-cols-3 gap-2 mb-6 px-panel-inset p-3 text-center">
              <div>
                <div className="font-pixel-num text-base font-bold text-[#ffd166]">{sim.totalStructuresBuilt}</div>
                <div className="text-[11px] text-[#a89f91]">Built</div>
              </div>
              <div>
                <div className="font-pixel-num text-base font-bold text-[#56cfe1]">{sim.totalMiraclesCast}</div>
                <div className="text-[11px] text-[#a89f91]">Powers</div>
              </div>
              <div>
                <div className="font-pixel-num text-base font-bold text-[#80ed99]">{sim.population}</div>
                <div className="text-[11px] text-[#a89f91]">Pop</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  simRef.current.outcome = 'none';
                  setGameState('playing');
                }}
                className="px-btn-primary px-5 py-2 text-sm font-bold cursor-pointer"
              >
                Keep Playing
              </button>
              <button
                type="button"
                onClick={handleRequestMainMenu}
                className="px-btn px-4 py-2 text-sm cursor-pointer"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUIT TO MAIN MENU GUARD MODAL (unsaved worlds only) */}
      {quitConfirmOpen && !hasSavedWorld && gameState !== 'title' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quit to Main Menu"
          data-testid="quit-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0c0b]/85 p-2 sm:p-4"
        >
          <div className="w-[min(25rem,calc(100vw-16px))] px-panel p-4 sm:p-6 space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-[#f5b742]">Return to Main Menu</h2>
            <p
              data-testid="quit-confirm-message"
              className="text-xs sm:text-sm text-[#e8e0d2] leading-relaxed"
            >
              Your current world has not been saved yet, are you sure you want to quit?
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                data-testid="quit-cancel-btn"
                onClick={() => {
                  soundEngine.playClick();
                  setQuitConfirmOpen(false);
                }}
                className="px-btn px-3.5 py-2 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="quit-save-btn"
                disabled={isSavingWorld}
                onClick={() => handleOpenSaveFlow(true)}
                className="px-btn-primary px-3.5 py-2 text-xs font-bold cursor-pointer"
              >
                {isSavingWorld ? 'Saving...' : 'Save & Quit'}
              </button>
              <button
                type="button"
                data-testid="quit-confirm-btn"
                onClick={handleConfirmQuitToMainMenu}
                className="px-btn px-3.5 py-2 text-xs font-bold text-[#ff8f8f] border-[#a83232] cursor-pointer"
              >
                Quit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE WORLD SUCCESSION MODALS */}
      {saveModalStep && gameState !== 'title' && (() => {
        const trimmedRawName = saveNameDraft.trim();
        const trimmedLower = trimmedRawName.toLowerCase();
        const existingWorldWithName = trimmedLower
          ? savedWorlds.find((w) => w.name.trim().toLowerCase() === trimmedLower)
          : undefined;
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Save World"
            data-testid={
              saveModalStep === 'confirm'
                ? 'save-confirm-modal'
                : saveModalStep === 'overwrite'
                  ? 'save-overwrite-modal'
                  : 'save-details-modal'
            }
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0c0b]/85 p-2 sm:p-4"
          >
            {saveModalStep === 'confirm' ? (
              <div className="w-[min(25rem,calc(100vw-16px))] px-panel p-4 sm:p-6 space-y-4">
                <h2 className="text-base sm:text-lg font-bold text-[#f5b742]">Save World</h2>
                <p
                  data-testid="save-confirm-prompt"
                  className="text-xs sm:text-sm text-[#e8e0d2] leading-relaxed"
                >
                  Are you sure you want to save?
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    data-testid="save-confirm-cancel-btn"
                    onClick={() => {
                      soundEngine.playClick();
                      setSaveModalStep(null);
                      setSaveThenQuit(false);
                    }}
                    className="px-btn px-3.5 py-2 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-testid="save-confirm-next-btn"
                    onClick={() => {
                      soundEngine.playClick();
                      setSaveModalStep('details');
                    }}
                    className="px-btn-primary px-4 py-2 text-xs font-bold cursor-pointer"
                  >
                    Continue &gt;
                  </button>
                </div>
              </div>
            ) : saveModalStep === 'details' ? (
              <div className="w-[min(27rem,calc(100vw-16px))] px-panel p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-bold text-[#f5b742]">
                    World Name &amp; Description
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setSaveModalStep('confirm');
                    }}
                    className="text-xs text-[#b8afa2] hover:text-[#f2ece1] cursor-pointer"
                  >
                    Back
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="save-world-name-input"
                      className="block text-xs text-[#b8afa2] mb-1.5"
                    >
                      World Name
                    </label>
                    <input
                      id="save-world-name-input"
                      data-testid="save-world-name-input"
                      type="text"
                      maxLength={32}
                      value={saveNameDraft}
                      onChange={(e) => setSaveNameDraft(e.target.value)}
                      placeholder="My World"
                      className="px-input w-full px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="save-world-description-input"
                      className="block text-xs text-[#b8afa2] mb-1.5"
                    >
                      Description
                    </label>
                    <textarea
                      id="save-world-description-input"
                      data-testid="save-world-description-input"
                      rows={3}
                      maxLength={160}
                      value={saveDescDraft}
                      onChange={(e) => setSaveDescDraft(e.target.value)}
                      placeholder="Describe this world, its kingdoms, or milestones..."
                      className="px-input w-full px-3 py-2 text-xs resize-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    data-testid="save-details-cancel-btn"
                    onClick={() => {
                      soundEngine.playClick();
                      setSaveModalStep(null);
                      setSaveThenQuit(false);
                    }}
                    className="px-btn px-3.5 py-2 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-testid="save-details-submit-btn"
                    disabled={isSavingWorld || !trimmedRawName}
                    onClick={() => {
                      if (existingWorldWithName) {
                        soundEngine.playClick();
                        setSaveModalStep('overwrite');
                      } else {
                        void handleCommitSaveWorld();
                      }
                    }}
                    className="px-btn-primary px-4 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isSavingWorld
                      ? 'Saving...'
                      : saveThenQuit
                        ? 'Save & Quit'
                        : 'Save World'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-[min(26rem,calc(100vw-16px))] px-panel p-4 sm:p-6 space-y-4">
                <h2 className="text-base sm:text-lg font-bold text-[#ffd166]">
                  Overwrite Existing World?
                </h2>
                <p
                  data-testid="save-overwrite-prompt"
                  className="text-xs sm:text-sm text-[#e8e0d2] leading-relaxed"
                >
                  A world with the name &quot;{trimmedRawName || 'My World'}&quot; already exists, do you want to overwrite?
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    data-testid="save-overwrite-back-btn"
                    onClick={() => {
                      soundEngine.playClick();
                      setSaveModalStep('details');
                    }}
                    className="px-btn px-3.5 py-2 text-xs font-semibold cursor-pointer"
                  >
                    Change Name
                  </button>
                  <button
                    type="button"
                    data-testid="save-overwrite-cancel-btn"
                    onClick={() => {
                      soundEngine.playClick();
                      setSaveModalStep(null);
                      setSaveThenQuit(false);
                    }}
                    className="px-btn px-3.5 py-2 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-testid="save-overwrite-confirm-btn"
                    disabled={isSavingWorld}
                    onClick={() => void handleCommitSaveWorld()}
                    className="px-btn-primary px-4 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isSavingWorld
                      ? 'Saving...'
                      : saveThenQuit
                        ? 'Overwrite & Quit'
                        : 'Overwrite'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </main>
  );
}
