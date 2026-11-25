import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ANIMAL_UNITS,
  BUILDINGS,
  EPOCHS,
  GOD_POWERS,
  MYTHICAL_BEAST_UNITS,
  MYTHICAL_ROLE_SET,
  SPECIES_UNITS,
  TERRAIN_TOOLS,
  UNITS,
  getMaxCityPopulation,
} from './game/catalog';
import {
  DEFAULT_WORLD_RULES,
  SINGLE_BIOME_OPTIONS,
  WORLD_TEMPLATES,
  applyTerrainTool,
  canAfford,
  castGodPower,
  computeAverageCivilizationEpoch,
  createEmptyWorldStats,
  createInitialSimulationState,
  createWorldConfigFromTemplate,
  dismissWorldEventCinematic,
  formatYearLabel,
  getKingdomEpoch,
  getKingdomId,
  getKingdomRelation,
  getTile,
  placeBuilding,
  setKingdomEpoch,
  spawnUnit,
  syncAverageEpochFromKingdoms,
  syncStateResourcesFromKingdoms,
} from './game/simulation';
import { normalizeSeed } from './game/worldGen';
import { soundEngine } from './game/sound';
import {
  generateUnitGenes,
  generateUnitItems,
  toggleUnitFavorite,
} from './game/entityInspector';
import {
  addUnitItem,
  generateUnitTraits,
  healUnitFull,
  removeUnitItem,
  resetUnitStatBonuses,
  setUnitAgeYears,
  setUnitSizeScale,
  setUnitStatValue,
  toggleUnitGene,
  toggleUnitTrait,
} from './game/unitCustomization';
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
  SeasonPreset,
  SimulationState,
  TerrainType,
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
import { WORLD_SEASON_PRESETS, computeSeasonState } from './game/worldSeasons';
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
  computeWarFrontArrows,
  computeWorldZones,
  extractKingdomColorsMap,
  inspectTileZones,
} from './game/zones';
import { EntityInspectorCard } from './components/EntityInspectorCard';
import { CityInspectorCard, InspectedCityRef } from './components/CityInspectorCard';
import { GraphicsSettingsPanel } from './components/GraphicsSettingsPanel';
import { AgeProgressBanner, AgeProgressEvent } from './components/AgeProgressBanner';
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

const UNIT_DEF_BY_ROLE = new Map(UNITS.map((d) => [d.role, d]));

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

const WORLD_SKY_PRESETS: ReadonlyArray<{ id: LightingPreset; label: string; shortLabel: string }> = [
  { id: 'auto', label: 'Cycle', shortLabel: 'Cycle' },
  { id: 'dawn', label: 'Dawn', shortLabel: 'Dawn' },
  { id: 'noon', label: 'Noon', shortLabel: 'Noon' },
  { id: 'dusk', label: 'Dusk', shortLabel: 'Dusk' },
  { id: 'night', label: 'Night', shortLabel: 'Night' },
  { id: 'midnight', label: 'Midnight', shortLabel: 'Mid' },
];

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
  const [unitFilter, setUnitFilter] = useState<'all' | 'races' | 'wildlife' | 'mythic'>('all');
  const [landFilter, setLandFilter] = useState<'all' | 'Sculpt' | 'Sky Rain' | 'Biomes' | 'Water'>('all');
  const [showGodRulesModal, setShowGodRulesModal] = useState<boolean>(false);
  const [showWorldInfoModal, setShowWorldInfoModal] = useState<boolean>(false);
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
  const [seasonPreset, setSeasonPreset] = useState<SeasonPreset>('auto');
  const [ageBannerEvent, setAgeBannerEvent] = useState<AgeProgressEvent | null>(null);
  const [isAgeScreenShaking, setIsAgeScreenShaking] = useState<boolean>(false);
  const prevEpochTrackRef = useRef<{ worldKey: string; epochIndex: number }>({
    worldKey: '',
    epochIndex: 0,
  });
  const ageBannerSeqRef = useRef<number>(1);
  const ageShakeTimerRef = useRef<number | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [chronicleOpen, setChronicleOpen] = useState<boolean>(false);
  const [chronicleFilter, setChronicleFilter] = useState<'major' | 'all'>('major');
  const [muted, setMuted] = useState<boolean>(false);
  const [hoverTile, setHoverTile] = useState<{ x: number; z: number } | null>(null);
  const [inspectedCity, setInspectedCity] = useState<
    (InspectedCityRef & { hexColor?: string }) | null
  >(null);
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
  const [showWarFrontArrows, setShowWarFrontArrows] = useState<boolean>(true);

  // Start UI navigation & World Creation Wizard state
  const [titleMenuStep, setTitleMenuStep] = useState<TitleMenuStep>('main');
  const [updateLogCollapsed, setUpdateLogCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 || window.innerHeight < 540 : false,
  );
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState<boolean>(false);
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
        singleBiome: prev.singleBiome,
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

  const handleSelectSingleBiome = useCallback((biome: TerrainType) => {
    soundEngine.playClick();
    setWorldConfig((prev) => {
      const next: WorldGenConfig = {
        ...prev,
        template: 'single_biome',
        singleBiome: biome,
      };
      const previewSim = createInitialSimulationState(128, next.seed, {
        ...next,
        gridSize: 128,
      });
      simRef.current = previewSim;
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
      setInspectedCity(null);
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
        setInspectedCity(null);
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
      setInspectedCity(null);
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

      if ((showGodRulesModal || showWorldInfoModal) && e.code === 'Escape') {
        e.preventDefault();
        setShowGodRulesModal(false);
        setShowWorldInfoModal(false);
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

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Preserve Hide dock (H) and desktop Camera Pan Mode toggle (V)
      if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      } else if (e.code === 'KeyV') {
        setMobilePanMode((prev) => {
          const next = !prev;
          setStatusFeedback(
            next
              ? 'Pan mode ON: drag moves camera'
              : 'Pan mode OFF: click/drag uses active tool',
          );
          return next;
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    cameraMenuOpen,
    editingRulesWorldId,
    gameState,
    quitConfirmOpen,
    saveModalStep,
    showGodRulesModal,
    showWorldInfoModal,
    speedMenuOpen,
  ]);

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

  const handleSelectCityLabel = useCallback(
    (city: {
      settlementId: string;
      kingdomId: string;
      name: string;
      hexColor: string;
      tileX: number;
      tileZ: number;
    }) => {
      setInspectedCity(city);
      soundEngine.playClick();
      setStatusFeedback(`Inspecting city ${city.name}`);
      setHudTick((t) => t + 1);
    },
    [],
  );

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
  const lastInteractHudTickRef = useRef(0);
  const lastInteractFeedbackRef = useRef<{ msg: string; ts: number }>({ msg: '', ts: 0 });
  const lastInteractSoundRef = useRef(0);

  const handleTileInteract = useCallback(
    (tileX: number, tileZ: number, interactOptions?: { flattenHeightOverride?: number }) => {
      const sim = simRef.current;
      sim.selectedTile = { x: tileX, z: tileZ };
      const notifyInteractHud = (msg: string) => {
        const now = performance.now();
        if (
          msg !== lastInteractFeedbackRef.current.msg ||
          now - lastInteractFeedbackRef.current.ts >= 400
        ) {
          lastInteractFeedbackRef.current = { msg, ts: now };
          setStatusFeedback(msg);
        }
        if (now - lastInteractHudTickRef.current >= 200) {
          lastInteractHudTickRef.current = now;
          setHudTick((t) => t + 1);
        }
      };

      if (activeTool.kind === 'inspect') {
        const rayPickedUnit = selectedEntityIdRef.current
          ? sim.units.find((u) => u.id === selectedEntityIdRef.current && u.state !== 'ko')
          : undefined;
        const nearbyUnit =
          rayPickedUnit ??
          sim.units.find(
            (u) => u.state !== 'ko' && Math.hypot(u.x - tileX, u.z - tileZ) <= 0.65,
          );
        if (nearbyUnit) {
          if (selectedEntityIdRef.current !== nearbyUnit.id) {
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
          soundEngine.playClick();
          setHudTick((t) => t + 1);
          return;
        }

        if (activeZones.alliances) {
          const currentZones = worldZonesRef.current ?? computeWorldZones(sim, seasonPreset);
          const zInspect = currentZones ? inspectTileZones(currentZones, sim, tileX, tileZ) : null;
          if (currentZones && zInspect?.kingdom) {
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
              `${zInspect.kingdom.name}: ${allyCount} Allies (Blue), ${enemyCount} Enemies (Red)`,
            );
            soundEngine.playClick();
            setHudTick((t) => t + 1);
            return;
          }
        }

        const tile = getTile(sim, tileX, tileZ);
        const bld = sim.buildings.find((b) => b.tileX === tileX && b.tileZ === tileZ);
        const nearbyRoadster = (sim.vehicles ?? []).find(
          (v) => v.type === 'roadster' && Math.hypot(v.x - tileX, v.z - tileZ) <= 1.15,
        );
        if (nearbyRoadster) {
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
          notifyInteractHud(
            res.count && res.count > 1 ? `${def?.name} ×${res.count} cast` : `${def?.name} cast`,
          );
        } else {
          notifyInteractHud(res.reason || 'Need more God Energy');
        }
        return;
      }

      if (activeTool.kind === 'terrain') {
        const res = applyTerrainTool(sim, activeTool.tool, tileX, tileZ, brushRadius, {
          flattenHeightOverride: interactOptions?.flattenHeightOverride,
        });
        const def = TERRAIN_TOOLS.find((t) => t.type === activeTool.tool);
        if (res.ok) {
          const nowSfx = performance.now();
          if (nowSfx - lastInteractSoundRef.current >= 75) {
            lastInteractSoundRef.current = nowSfx;
            if (def?.isSkyRain) {
              soundEngine.playSkyRain(def.type);
            } else {
              soundEngine.playSculpt();
            }
          }
          notifyInteractHud(`${def?.name} applied`);
        } else {
          notifyInteractHud(res.reason || 'Cannot edit tile');
        }
        return;
      }

      if (activeTool.kind === 'build') {
        const res = placeBuilding(sim, activeTool.building, tileX, tileZ);
        const def = BUILDINGS.find((b) => b.type === activeTool.building);
        if (res.ok) {
          soundEngine.playBuild();
          notifyInteractHud(`Placed ${def?.name}`);
        } else {
          notifyInteractHud(res.reason || 'Cannot build here');
        }
        return;
      }

      if (activeTool.kind === 'spawn') {
        const res = spawnUnit(sim, activeTool.unit, tileX, tileZ);
        const def = UNITS.find((u) => u.role === activeTool.unit);
        if (res.ok) {
          const nowSfx = performance.now();
          if (nowSfx - lastInteractSoundRef.current >= 65) {
            lastInteractSoundRef.current = nowSfx;
            soundEngine.playSpawn();
          }
          notifyInteractHud(`Spawned ${def?.name}`);
        } else {
          notifyInteractHud(res.reason || 'Cannot spawn here');
        }
      }
    },
    [
      activeTool,
      brushRadius,
      brushSize,
      activeZones.alliances,
    ],
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
  const shouldComputeZones = anyZoneActive || activeCategory === 'zones';

  // Only push hovered tile coords into React state when Inspect or Zones UI actually reads them,
  // eliminating 60 Hz full-App re-renders during normal cursor movement across the map.
  const hoverNeedsStateRef = useRef(false);
  hoverNeedsStateRef.current = isInspectTabActive || shouldComputeZones;
  const handleHoverTileChange = useCallback((tile: { x: number; z: number } | null) => {
    if (!hoverNeedsStateRef.current) return;
    setHoverTile(tile);
  }, []);

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

  const needsKingdomLabelKeys =
    shouldComputeZones || (!anyZoneActive && activeZones.kingdomLabels && gameState !== 'title');
  const kingdomEpochsKey =
    needsKingdomLabelKeys && sim.kingdomEpochs
      ? Object.entries(sim.kingdomEpochs)
          .map(([k, v]) => `${k}=${v}`)
          .join(',')
      : '';
  const settlementNamesKey =
    needsKingdomLabelKeys && sim.settlementNames
      ? Object.entries(sim.settlementNames)
          .map(([k, v]) => `${k}=${v}`)
          .join('|')
      : '';
  const zoneCacheKey = shouldComputeZones
    ? `${sim.seed}:${Math.floor(sim.year)}:${seasonPreset}:${sim.buildings.length}:${sim.units.length}:${kingdomEpochsKey}:${settlementNamesKey}:${Math.floor(hudTick / 10)}`
    : 'idle';
  const kingdomLabelsKey =
    !anyZoneActive && activeZones.kingdomLabels && gameState !== 'title'
      ? `${sim.seed}:${sim.buildings.length}:${sim.units.length}:${kingdomEpochsKey}:${settlementNamesKey}:${Math.floor(hudTick / 10)}`
      : 'off';

  const worldZones = useMemo(() => {
    if (!shouldComputeZones) return null;
    return computeWorldZones(simRef.current, seasonPreset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldComputeZones, zoneCacheKey]);
  worldZonesRef.current = worldZones;

  const hoveredZoneInfo = useMemo(() => {
    if (!worldZones || !hoverTile) return null;
    return inspectTileZones(worldZones, simRef.current, hoverTile.x, hoverTile.z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldZones, hoverTile, hudTick]);

  const zoneOverlayVersionRef = useRef(0);
  const zoneColorBufRef = useRef<Uint8Array | undefined>(undefined);
  const zoneIdBufRef = useRef<Uint8Array | undefined>(undefined);

  const zoneHighlightHoverTile =
    isInspectTabActive || activeCategory === 'zones' ? hoverTile : null;

  const needsWarRelationsKey =
    showWarFrontArrows && (activeZones.kingdoms || activeZones.alliances);
  const kingdomRelationsKey =
    needsWarRelationsKey && sim.kingdomRelations
      ? Object.entries(sim.kingdomRelations)
          .filter(([, rel]) => rel === 'war')
          .map(([k]) => k)
          .sort()
          .join(',')
      : '';
  const warFrontRefreshTick =
    showWarFrontArrows &&
    (activeZones.kingdoms || activeZones.alliances) &&
    kingdomRelationsKey.length > 0
      ? Math.floor(hudTick / 3)
      : 0;

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
        warFrontArrows: [],
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
    const warFrontArrows =
      showWarFrontArrows && (activeZones.kingdoms || activeZones.alliances)
        ? computeWarFrontArrows(worldZones, simRef.current, activeZones, {
            selectedAllianceKingdomId,
          })
        : [];
    return {
      colorData: packed.colorData,
      idData: packed.idData,
      anyActive: packed.anyActive,
      kingdomsActive: Boolean(activeZones.kingdoms || activeZones.alliances),
      kingsActive: Boolean(activeZones.kings),
      version: zoneOverlayVersionRef.current,
      labels: packed.labels,
      kingdomColors,
      warFrontArrows,
    };
  }, [
    worldZones,
    activeZones,
    anyZoneActive,
    zoneHighlightHoverTile,
    selectedAllianceKingdomId,
    showWarFrontArrows,
    zoneCacheKey,
    kingdomLabelsKey,
    kingdomRelationsKey,
    warFrontRefreshTick,
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
            ? 'Alliances ON - Click any kingdom zone to view Allies (Blue) & Enemies (Red)'
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

  // Detect upward age progression while playing and launch the middle Fortnite-style token flip banner
  useEffect(() => {
    const worldKey = `${sim.seed}:${sim.gridSize}`;
    if (gameState !== 'playing') {
      prevEpochTrackRef.current = { worldKey, epochIndex: currentEpoch.index };
      setAgeBannerEvent(null);
      setIsAgeScreenShaking(false);
      return;
    }
    if (prevEpochTrackRef.current.worldKey !== worldKey) {
      prevEpochTrackRef.current = { worldKey, epochIndex: currentEpoch.index };
      return;
    }
    const prevIdx = prevEpochTrackRef.current.epochIndex;
    if (currentEpoch.index > prevIdx) {
      prevEpochTrackRef.current.epochIndex = currentEpoch.index;
      setAgeBannerEvent({
        id: ageBannerSeqRef.current++,
        fromIndex: prevIdx,
        toIndex: currentEpoch.index,
      });
    } else if (currentEpoch.index < prevIdx) {
      prevEpochTrackRef.current.epochIndex = currentEpoch.index;
    }
  }, [currentEpoch.index, gameState, sim.seed, sim.gridSize]);

  useEffect(() => {
    return () => {
      if (ageShakeTimerRef.current !== null) {
        window.clearTimeout(ageShakeTimerRef.current);
      }
    };
  }, []);

  const handleAgeBannerImpact = useCallback(() => {
    if (ageShakeTimerRef.current !== null) {
      window.clearTimeout(ageShakeTimerRef.current);
    }
    setIsAgeScreenShaking(false);
    window.requestAnimationFrame(() => {
      setIsAgeScreenShaking(true);
      ageShakeTimerRef.current = window.setTimeout(() => {
        setIsAgeScreenShaking(false);
        ageShakeTimerRef.current = null;
      }, 440);
    });
  }, []);

  const handleAgeBannerComplete = useCallback(() => {
    setAgeBannerEvent(null);
  }, []);
  const activeWorldEvent = sim.activeWorldEvent ?? null;
  const isEventCinematic =
    gameState === 'playing' &&
    Boolean(
      activeWorldEvent &&
        activeWorldEvent.cinematicActive &&
        !activeWorldEvent.dismissedByUser &&
        activeWorldEvent.remaining > 0,
    );
  const inspectedTile =
    isInspectTabActive && hoverTile ? getTile(sim, hoverTile.x, hoverTile.z) : null;
  const inspectedBuilding =
    isInspectTabActive && hoverTile
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

  const activeToolInfo: HoveredHint | null = (() => {
    if (activeCategory === 'powers' && activeTool.kind === 'power') {
      const power = GOD_POWERS.find((p) => p.type === activeTool.power);
      if (!power) return null;
      const clusterCount =
        power.type === 'drag_entity' ? 1 : getPowerClusterCount(brushSize);
      const totalFaithCost = power.faithCost * clusterCount;
      return {
        title: clusterCount > 1 ? `${power.name} (×${clusterCount})` : power.name,
        cost: sim.sandboxFreeMode ? 'Free' : `${totalFaithCost} God Energy`,
        detail: power.summary,
      };
    }
    if (activeCategory === 'terrain' && activeTool.kind === 'terrain') {
      const tool = TERRAIN_TOOLS.find((t) => t.type === activeTool.tool);
      if (!tool) return null;
      return {
        title: tool.name,
        cost: sim.sandboxFreeMode ? 'Free' : `${tool.faithCost} God Energy`,
        detail: tool.summary,
      };
    }
    if (activeCategory === 'build' && activeTool.kind === 'build') {
      const bld = BUILDINGS.find((b) => b.type === activeTool.building);
      if (!bld) return null;
      return {
        title: bld.name,
        cost: formatCompactCost(bld.cost, sim.sandboxFreeMode),
        detail: bld.roleSummary,
      };
    }
    if (activeCategory === 'spawn' && activeTool.kind === 'spawn') {
      const unit = UNITS.find((u) => u.role === activeTool.unit);
      if (!unit) return null;
      return {
        title: unit.name,
        cost: formatCompactCost(unit.cost, sim.sandboxFreeMode),
        detail: unit.roleSummary,
      };
    }
    return null;
  })();

  // Overlay visibility flags so full-screen / centered popups hide underlying UI cleanly
  const hasBlockingSaveOrQuitModal =
    gameState !== 'title' && (Boolean(saveModalStep) || (quitConfirmOpen && !hasSavedWorld));
  const hasInGameOverlayModal =
    gameState === 'paused' ||
    gameState === 'gameover' ||
    (gameState === 'playing' && (showWorldInfoModal || showGodRulesModal)) ||
    hasBlockingSaveOrQuitModal;
  const hasSavedWorldRulesModal =
    gameState === 'title' && Boolean(editingRulesWorldId && editingRulesDraft);
  const hasAnyBlockingModal = hasInGameOverlayModal || hasSavedWorldRulesModal;

  return (
    <main
      className={`relative w-[100dvw] h-[100dvh] overflow-hidden bg-[#15100e] text-[#f4e7d4] ${
        isAgeScreenShaking ? 'age-screen-shake' : ''
      }`}
    >
      {/* Top-Center Age Progression Banner HUD (3D Square Scenery Flip + Pixel Explosion + Screen Shake) */}
      {gameState === 'playing' && !hasAnyBlockingModal && (
        <AgeProgressBanner
          event={ageBannerEvent}
          onImpact={handleAgeBannerImpact}
          onComplete={handleAgeBannerComplete}
        />
      )}

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
        seasonPreset={seasonPreset}
        graphicsSettings={graphicsSettings}
        cameraActionRef={cameraActionRef}
        captureThumbnailRef={captureThumbnailRef}
        hoveredEntityId={isInspectTabActive ? hoveredEntityId : null}
        selectedEntityId={isInspectTabActive ? selectedEntityId : null}
        followingEntityId={isInspectTabActive ? followingEntityId : null}
        selectedCityId={inspectedCity?.settlementId ?? null}
        zoneOverlayBuffers={zoneOverlayBuffers}
        onTileInteract={handleTileInteract}
        onHoverTileChange={handleHoverTileChange}
        onHoverEntityChange={setHoveredEntityId}
        onSelectEntity={handleSelectEntity}
        onSelectCityLabel={handleSelectCityLabel}
        onBreakFollow={handleBreakFollow}
        onSyncHud={syncHud}
        onPerfTelemetry={setPerfTelemetry}
      />

      {/* Optional Phase 0 Performance Debug HUD (toggled via F3 or Settings) */}
      {graphicsSettings.showPerformanceHud && perfTelemetry && !hasAnyBlockingModal && (
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
          {/* LEFT COLLAPSIBLE UPDATE LOG (hidden when Saved World Rules modal is open) */}
          {!hasSavedWorldRulesModal && (
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
                className="px-panel px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center gap-2 text-xs font-semibold text-[#eadbc6] cursor-pointer hover:text-[#f2c478]"
              >
                <HudPixelIcon kind="log" className="w-4 h-4 text-[#f2c478]" />
                <span>Updates</span>
              </button>
            ) : (
              <div className="px-panel w-[min(17.5rem,calc(100vw-16px))] sm:w-64 p-3 sm:p-4 max-h-[calc(100dvh-24px)] flex flex-col">
                <div className="flex items-center justify-between mb-2.5 sm:mb-3 shrink-0">
                  <span className="text-sm font-bold text-[#f2c478]">Updates</span>
                  <button
                    type="button"
                    data-testid="toggle-update-log"
                    onClick={() => {
                      setUpdateLogCollapsed(true);
                      soundEngine.playClick();
                    }}
                    className="text-xs text-[#b09880] hover:text-[#f4e7d4] cursor-pointer"
                  >
                    Hide
                  </button>
                </div>

                <div className="space-y-3 text-xs max-h-[55dvh] sm:max-h-60 overflow-y-auto pr-1" data-testid="update-log-scroll">
                  {UPDATE_LOG_ENTRIES.map((entry) => (
                    <div key={entry.version}>
                      <div
                        className={`font-bold tabular-nums mb-1 ${
                          entry.isMajor ? 'text-[#f2c478]' : 'text-[#eadbc6]'
                        }`}
                      >
                        {entry.version}
                      </div>
                      <ul className="space-y-0.5 text-[#bfa88f] leading-snug">
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
          )}

          {/* BOTTOM-LEFT VERSION */}
          {!hasSavedWorldRulesModal && (
          <div
            data-testid="game-version-badge"
            className="pointer-events-auto fixed left-2.5 bottom-2 sm:left-4 sm:bottom-4 z-30 text-[11px] sm:text-xs text-[#ccb69c] tabular-nums select-none drop-shadow-[0_2px_0_#110c0a]"
          >
            Godmulator {GAME_VERSION}
          </div>
          )}

          {/* MAIN START MENU (Optically Centered) */}
          {titleMenuStep === 'main' && (
            <div
              data-testid="start-menu-main"
              className="pointer-events-auto w-[min(280px,calc(100vw-16px))] max-h-[calc(100dvh-20px)] overflow-y-auto px-panel-hero p-5 sm:p-6 [@media(max-height:460px)]:p-3.5 sm:-translate-y-3 flex flex-col items-center gap-4 sm:gap-6 [@media(max-height:460px)]:gap-2.5"
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
                  className="px-btn-primary w-full min-h-[42px] sm:min-h-[44px] py-2 sm:py-2.5 text-base font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd36b]"
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
                  className="px-btn w-full min-h-[42px] sm:min-h-[44px] py-2 sm:py-2.5 text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd36b]"
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
                  className="px-btn w-full min-h-[42px] sm:min-h-[44px] py-2 sm:py-2.5 text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd36b]"
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
                  className="px-btn w-full min-h-[42px] sm:min-h-[44px] py-2 sm:py-2.5 text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd36b]"
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
              className="pointer-events-auto w-[min(28rem,calc(100vw-16px))] max-h-[calc(100dvh-16px)] overflow-y-auto px-panel-hero p-4 sm:p-6 space-y-3.5 sm:space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#f2c478]">Create World</h2>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('main');
                  }}
                  className="text-xs text-[#bfa88f] hover:text-[#f4e7d4] cursor-pointer px-1 py-1"
                >
                  Back
                </button>
              </div>

              {/* Name & Seed */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                <div>
                  <label htmlFor="create-world-name" className="block text-[#bfa88f] mb-1">
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
                      className="px-panel-inset w-full px-2.5 py-2 text-xs text-[#f4e7d4] outline-none focus:border-[#f2c478]"
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
                  <label htmlFor="title-seed-input" className="block text-[#bfa88f] mb-1">
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
                      className="px-panel-inset w-full px-2.5 py-2 text-xs text-[#f4e7d4] tabular-nums outline-none focus:border-[#f2c478]"
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
                  className="w-full flex items-center justify-between py-1 bg-transparent border-0 outline-none text-xs text-[#bfa88f] hover:text-[#f4e7d4] cursor-pointer select-none"
                >
                  <span>
                    Templates{' '}
                    <span className="text-[#f2c478] font-semibold">
                      ({WORLD_TEMPLATES.find((t) => t.id === worldConfig.template)?.name ?? 'Fantasy'})
                    </span>
                  </span>
                  <span className="text-[11px] text-[#bfa88f] leading-none flex items-center">
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
                          <div className="text-xs font-bold text-[#f4e7d4]">{tpl.name}</div>
                          <div className="text-[11px] text-[#9e866f] leading-tight mt-0.5">
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
                  <label htmlFor="map-size-slider" className="text-[#bfa88f]">
                    Map Size
                  </label>
                  <span className="font-bold text-[#f4e7d4] tabular-nums">
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
                <div className="text-[11px] text-[#bfa88f] mt-1.5 tabular-nums">
                  Max City Pop: <span className="font-semibold text-[#f4e7d4]">{getMaxCityPopulation(worldConfig.gridSize)}</span> per city
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
                    <span className="block text-[#bfa88f] mb-1">Sea Level</span>
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
                    <span className="block text-[#bfa88f] mb-1">Relief</span>
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
                    <span className="block text-[#bfa88f] mb-1">Climate</span>
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

              {/* Single Biome Picker (Progressive Disclosure when Single Biome is active) */}
              {worldConfig.template === 'single_biome' && (
                <div className="pt-1">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[#bfa88f]">Starting Biome</span>
                    <span className="text-[#f4e7d4] font-bold">
                      {SINGLE_BIOME_OPTIONS.find(
                        (b) => b.id === (worldConfig.singleBiome ?? 'forest'),
                      )?.label ?? 'Woodland Forest'}
                    </span>
                  </div>
                  <div
                    data-testid="single-biome-picker"
                    className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-0.5"
                  >
                    {SINGLE_BIOME_OPTIONS.map((biomeOpt) => {
                      const isSelected = (worldConfig.singleBiome ?? 'forest') === biomeOpt.id;
                      return (
                        <button
                          key={biomeOpt.id}
                          type="button"
                          data-testid={`single-biome-${biomeOpt.id}`}
                          aria-pressed={isSelected}
                          onClick={() => handleSelectSingleBiome(biomeOpt.id)}
                          className={`px-2 py-1.5 text-left text-[11px] flex items-center gap-1.5 cursor-pointer ${
                            isSelected ? 'px-btn-active font-bold' : 'px-btn'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 shrink-0 border border-black/40"
                            style={{ backgroundColor: biomeOpt.swatch }}
                          />
                          <span className="truncate">{biomeOpt.label}</span>
                        </button>
                      );
                    })}
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
              className="pointer-events-auto w-[min(28rem,calc(100vw-16px))] max-h-[calc(100dvh-16px)] overflow-y-auto px-panel-hero p-4 sm:p-6 space-y-3.5 sm:space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#f2c478]">World Rules</h2>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('create_world');
                  }}
                  className="text-xs text-[#bfa88f] hover:text-[#f4e7d4] cursor-pointer"
                >
                  Back
                </button>
              </div>

              {/* Starting Age Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <label htmlFor="starting-age-slider" className="text-[#bfa88f]">
                    Starting Age
                  </label>
                  <span className="font-bold text-[#f4e7d4]">
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
                <div className="text-xs text-[#bfa88f] mb-1.5">Starting Settlers</div>
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
                <div className="text-xs text-[#bfa88f] mb-1.5">God Rules</div>
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
                          isOn ? 'px-slot-active font-bold text-[#f4e7d4]' : 'px-slot text-[#bfa88f]'
                        }`}
                      >
                        <span className="truncate pr-2">{rule.label}</span>
                        <span
                          className={`w-2.5 h-2.5 border border-[#110c0a] shrink-0 ${
                            isOn ? 'bg-[#80ed99]' : 'bg-[#423229]'
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
              className="pointer-events-auto w-[min(20rem,calc(100vw-16px))] px-panel-hero p-5 sm:p-6 text-center space-y-3"
            >
              <div className="text-base font-bold text-[#f2c478]">
                {worldConfig.worldName}
              </div>

              <div className="px-bar-track w-full h-4 overflow-hidden">
                <div
                  className="px-bar-fill bg-[#d9a441] transition-all duration-150"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-[#bfa88f] tabular-nums">
                <span className="truncate pr-2">{loadingStageText}</span>
                <span className="text-[#f4e7d4] font-bold">{loadingProgress}%</span>
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {titleMenuStep === 'settings' && (
            <div
              data-testid="start-settings-modal"
              className="pointer-events-auto w-[min(28rem,calc(100vw-16px))] max-h-[calc(100dvh-16px)] overflow-y-auto px-panel-hero p-4 sm:p-6 space-y-4 sm:space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#f2c478]">Settings</h2>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('main');
                  }}
                  className="text-xs text-[#bfa88f] hover:text-[#f4e7d4] cursor-pointer px-1 py-1"
                >
                  Back
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#eadbc6]">Sound Effects</span>
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
              className="pointer-events-auto w-[min(24rem,calc(100vw-16px))] max-h-[calc(100dvh-16px)] overflow-y-auto px-panel-hero p-4 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#f2c478]">Credits</h2>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('main');
                  }}
                  className="text-xs text-[#bfa88f] hover:text-[#f4e7d4] cursor-pointer px-1 py-1"
                >
                  Back
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-[#ccb69c] leading-relaxed">
                <div className="text-[#f4e7d4] font-bold">
                  Godmulator {GAME_VERSION}
                </div>
                <p>
                  3D pixel god simulator with procedural continents, dynamic land &amp; sea zones, and multi-epoch civilizations.
                </p>
                <div className="pt-1 text-[#bfa88f] space-y-1">
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
              className={
                hasSavedWorldRulesModal
                  ? 'pointer-events-auto'
                  : 'pointer-events-auto w-[min(46rem,calc(100vw-16px))] max-h-[calc(100dvh-20px)] flex flex-col px-panel-hero p-4 sm:p-6 gap-3.5'
              }
            >
              {!hasSavedWorldRulesModal && (
                <>
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-lg font-bold text-[#f2c478]">Saved Worlds</h2>
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
                <div className="px-panel-inset p-6 text-center text-xs text-[#bfa88f]">
                  Loading saved worlds...
                </div>
              ) : savedWorlds.length === 0 ? (
                <div
                  data-testid="saved-worlds-empty"
                  className="px-panel-inset p-6 text-center space-y-3"
                >
                  <div className="text-sm font-semibold text-[#eadbc6]">
                    No saved worlds yet
                  </div>
                  <p className="text-xs text-[#b09880]">
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
                        <div className="w-full sm:w-44 h-28 sm:h-[104px] shrink-0 bg-[#14100e] border border-[#544034] overflow-hidden flex items-center justify-center">
                          {w.thumbnailDataUrl ? (
                            <img
                              src={w.thumbnailDataUrl}
                              alt={`${w.name} map preview`}
                              className="w-full h-full object-cover pixelated-canvas"
                            />
                          ) : (
                            <div className="text-center px-2">
                              <div className="text-[11px] font-bold text-[#f2c478]">
                                {w.gridSize}×{w.gridSize}
                              </div>
                              <div className="text-[10px] text-[#8f7862]">No Thumbnail</div>
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
                                <h3 className="text-sm sm:text-base font-bold text-[#f4e7d4] truncate">
                                  {w.name}
                                </h3>
                                <span className="text-[11px] text-[#8f7862] shrink-0 tabular-nums">
                                  {savedDateLabel}
                                </span>
                              </div>
                            )}

                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#ccb69c] tabular-nums">
                              <span className="text-[#f2c478] font-semibold">{epochName}</span>
                              <span>{formatYearLabel(w.year)}</span>
                              <span className="text-[#80ed99]">Pop: {w.population}</span>
                              <span>
                                {w.gridSize}×{w.gridSize}
                              </span>
                            </div>
                            {w.description && (
                              <p
                                data-testid={`saved-world-desc-${w.id}`}
                                className="mt-1 text-[11px] text-[#b09880] leading-snug line-clamp-2"
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
                </>
              )}

              {/* Nested Saved World Rules Editor */}
              {editingRulesWorldId && editingRulesDraft && (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Edit Saved World Rules"
                  data-testid="saved-world-rules-modal"
                  className="fixed inset-0 z-50 flex items-center justify-center px-backdrop p-2 sm:p-4"
                >
                  <div className="w-[min(30rem,calc(100vw-16px))] max-h-[calc(100dvh-20px)] overflow-y-auto px-panel-hero p-4 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base sm:text-lg font-bold text-[#f2c478]">
                        Edit World Rules
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          setEditingRulesWorldId(null);
                          setEditingRulesDraft(null);
                        }}
                        className="text-xs text-[#bfa88f] hover:text-[#f4e7d4] cursor-pointer"
                      >
                        Close
                      </button>
                    </div>

                    {/* Age Slider */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <label htmlFor="saved-world-age-slider" className="text-[#bfa88f]">
                          World Age
                        </label>
                        <span className="font-bold text-[#f4e7d4]">
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
                      <div className="text-xs text-[#bfa88f] mb-1.5">Sky Lighting</div>
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
                              <div className="text-xs font-bold text-[#f4e7d4]">{sw.label}</div>
                              <div className="text-[11px] text-[#b09880] leading-snug">
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
                                enabled ? 'px-btn-active' : 'px-btn text-[#8f7862]'
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
                      ? '#ffd36b'
                      : '#56cfe1'
                    : activeWorldEvent.kind === 'super_tornado'
                      ? idx % 2 === 0
                        ? '#c084fc'
                        : '#818cf8'
                      : idx % 2 === 0
                        ? '#ffd36b'
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
                textShadow: '2px 2px 0 #050812, -1px -1px 0 #050812, 1px -1px 0 #050812, -1px 1px 0 #050812',
              }}
            >
              {activeWorldEvent.title}
            </h2>
            {activeWorldEvent.subtitle && (
              <p
                data-testid="world-event-description"
                className="mt-1 text-xs sm:text-sm font-medium tracking-[0.06em] text-[#f4e7d4] max-w-xl mx-auto"
                style={{
                  textShadow: '1px 1px 0 #050812, -1px -1px 0 #050812, 1px -1px 0 #050812, -1px 1px 0 #050812',
                }}
              >
                {activeWorldEvent.subtitle}
              </p>
            )}
          </div>

          <span
            className="pointer-events-none text-[10px] sm:text-xs uppercase tracking-[0.18em] text-[#f4e7d4]/90 mb-2"
            style={{
              textShadow: '1px 1px 0 #050812, -1px -1px 0 #050812',
            }}
          >
            Click anywhere to return
          </span>
        </div>
      )}

      {/* PLAYING HUD OVERLAY (hidden while a blocking modal such as World Info, God Rules, Settings, Save, or Quit is active) */}
      {gameState !== 'title' && !isEventCinematic && !hasInGameOverlayModal && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between gap-1 sm:gap-1.5 pt-[max(0.25rem,env(safe-area-inset-top))] pb-[max(0.25rem,env(safe-area-inset-bottom))] pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))] sm:p-2.5 md:p-3">
          {/* Active World Event compact banner when cinematic camera is dismissed */}
          {activeWorldEvent && activeWorldEvent.remaining > 0 && (
            <div
              data-testid="world-event-active-banner"
              className="pointer-events-none self-center px-4 py-1 text-center bg-[#15100e]/85 border-t-2 border-b-2"
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
                  className="text-[11px] sm:text-xs text-[#f4e7d4]/90 tracking-[0.04em]"
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
                    className={`font-bold text-[10px] sm:text-sm text-[#f2c478] whitespace-nowrap truncate leading-tight inline-block ${
                      isAgeScreenShaking ? 'age-text-slam text-[#ffe49e]' : ''
                    }`}
                  >
                    {currentEpoch.name}
                  </span>
                  <span className="font-pixel-num text-[9px] sm:text-[11px] text-[#eadbc6] whitespace-nowrap leading-tight shrink-0">
                    {formatYearLabel(sim.year)}
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 text-[9px] sm:text-xs text-[#bfa88f] tabular-nums leading-tight">
                  <span className="whitespace-nowrap">
                    Pop <span className="font-pixel-num text-[9px] sm:text-[10px] text-[#f4e7d4]">{sim.population}</span>
                  </span>
                  {sim.goldenAgeTimer > 0 && (
                    <span className="font-pixel-num text-[9px] sm:text-[10px] text-[#ffd36b] whitespace-nowrap">
                      ★ {Math.ceil(sim.goldenAgeTimer)}s
                    </span>
                  )}
                </div>
              </div>
              <div
                role="tooltip"
                className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute left-0 top-full mt-1.5 z-40 px-panel px-2.5 py-1.5 text-[10px] sm:text-xs text-[#f4e7d4] whitespace-nowrap shadow-lg"
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
                    <span className="font-pixel-num text-[9px] sm:text-[10px] text-[#f4e7d4] leading-none sm:mt-1 [@media(max-height:480px)]:mt-0">
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
                        <span className="text-[#bfa88f]">Speed</span>
                        <span className="font-pixel-num font-bold text-[#f2c478] tabular-nums">
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
                      <div className="flex items-center justify-between text-[10px] text-[#9e866f] font-pixel-num">
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
                      className="px-panel absolute right-0 top-[calc(100%+6px)] z-30 p-2 w-52 max-w-[calc(100vw-16px)] space-y-2"
                    >
                      <div className="text-[11px] font-bold text-[#f2c478]">Camera Controls</div>
                      <div className="grid grid-cols-5 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            cameraActionRef.current.zoomDelta -= 14;
                            soundEngine.playClick();
                          }}
                          className="px-btn h-8 flex items-center justify-center cursor-pointer"
                          aria-label="Zoom In"
                          title="Zoom In (+ / =)"
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
                          title="Zoom Out (-)"
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
                          title="Rotate Left (Q / [)"
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
                          title="Center on Town (C / Home)"
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
                          title="Rotate Right (E / ])"
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
                        title="Toggle Drag Pan Mode (V)"
                        className={`w-full h-8 px-2 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer ${
                          mobilePanMode ? 'px-btn-active font-bold' : 'px-btn text-[#eadbc6]'
                        }`}
                      >
                        <HudPixelIcon kind="pan" className="w-4 h-4 pixelated-canvas" />
                        <span>{mobilePanMode ? '1-Drag Pan: ON' : '1-Drag Pan: OFF'}</span>
                      </button>
                      <div className="hidden sm:grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 pt-1.5 border-t border-[#423229] text-[10px] text-[#b09880]">
                        <span className="font-pixel-num text-[#eadbc6]">WASD / ↑↓←→</span>
                        <span className="text-right">Pan (+Shift fast)</span>
                        <span className="font-pixel-num text-[#eadbc6]">Q/E, [/]</span>
                        <span className="text-right">Rotate / Snap 45°</span>
                        <span className="font-pixel-num text-[#eadbc6]">+ / −</span>
                        <span className="text-right">Zoom In / Out</span>
                        <span className="font-pixel-num text-[#eadbc6]">C / Home</span>
                        <span className="text-right">Center Town</span>
                        <span className="font-pixel-num text-[#eadbc6]">R / 0</span>
                        <span className="text-right">Reset Overview</span>
                        <span className="font-pixel-num text-[#eadbc6]">V</span>
                        <span className="text-right">Toggle Pan Mode</span>
                      </div>
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
                    setSpeedMenuOpen(false);
                    setCameraMenuOpen(false);
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
                    setSpeedMenuOpen(false);
                    setCameraMenuOpen(false);
                    setShowWorldInfoModal(false);
                    setShowGodRulesModal(false);
                    setGameState((prev) => (prev === 'paused' ? 'playing' : 'paused'));
                  }}
                  className="px-btn w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer shrink-0"
                  aria-label="Settings"
                  title="Settings"
                >
                  <HudPixelIcon kind="settings" className="w-4 h-4 pixelated-canvas" />
                </button>
              </div>
            </div>
          </div>

          {/* MIDDLE HUD LAYER: Entity Inspector, City Inspector & World Log (bounded cleanly between top bar & bottom dock) */}
          <div className="relative flex-1 min-h-0 w-full pointer-events-none">
            {gameState === 'playing' && isInspectTabActive && (
              <div className={chronicleOpen && !speedMenuOpen && !cameraMenuOpen ? 'hidden lg:contents' : 'contents'}>
              <EntityInspectorCard
                sim={sim}
                hoveredUnit={hoveredUnit}
                selectedUnit={selectedUnit}
                favoriteUnits={favoriteUnits}
                followingEntityId={followingEntityId}
                onToggleFavorite={handleToggleFavoriteEntity}
                onSelectUnit={handleSelectEntity}
                onFocusUnit={handleFocusEntity}
                onRenameUnit={(unitId, newName) => {
                  const target = simRef.current.units.find((u) => u.id === unitId);
                  if (target) {
                    target.name = newName;
                    setStatusFeedback(`Renamed entity to ${newName}`);
                    setHudTick((v) => v + 1);
                  }
                }}
                onRenameSettlement={(settlementId, newName) => {
                  const s = simRef.current;
                  const oldName = s.settlementNames?.[settlementId];
                  if (!s.settlementNames) s.settlementNames = {};
                  s.settlementNames[settlementId] = newName;
                  // Keep capital kingdom name in sync if it matched the old city name
                  const kid = s.settlementKingdoms?.[settlementId];
                  if (kid && kid !== settlementId && (!s.settlementNames[kid] || s.settlementNames[kid] === oldName)) {
                    s.settlementNames[kid] = newName;
                  }
                  setStatusFeedback(`Renamed city to ${newName}`);
                  setHudTick((v) => v + 1);
                }}
                onSetUnitStat={(unitId, statKey, value) => {
                  const target = simRef.current.units.find((u) => u.id === unitId);
                  if (!target) return;
                  if (target.traits === undefined) {
                    target.traits = generateUnitTraits(target.role, target.species, target.appearanceSeed);
                  }
                  if (target.genes === undefined) {
                    target.genes = generateUnitGenes(target.role, target.species, target.appearanceSeed);
                  }
                  if (target.items === undefined) {
                    target.items = generateUnitItems(
                      target.role,
                      target.species,
                      simRef.current.epochIndex,
                      target.appearanceSeed,
                    );
                  }
                  setUnitStatValue(target, statKey, value);
                  setHudTick((v) => v + 1);
                }}
                onResetUnitStats={(unitId) => {
                  const target = simRef.current.units.find((u) => u.id === unitId);
                  if (!target) return;
                  resetUnitStatBonuses(target);
                  setStatusFeedback(`Reset ${target.name}'s stat edits`);
                  setHudTick((v) => v + 1);
                }}
                onHealUnit={(unitId) => {
                  const target = simRef.current.units.find((u) => u.id === unitId);
                  if (!target) return;
                  healUnitFull(target);
                  soundEngine.playClick();
                  setStatusFeedback(`Restored ${target.name} to full health`);
                  setHudTick((v) => v + 1);
                }}
                onSetUnitAge={(unitId, ageYears) => {
                  const target = simRef.current.units.find((u) => u.id === unitId);
                  if (!target) return;
                  setUnitAgeYears(target, ageYears);
                  setHudTick((v) => v + 1);
                }}
                onSetUnitSizeScale={(unitId, sizeScale) => {
                  const target = simRef.current.units.find((u) => u.id === unitId);
                  if (!target) return;
                  setUnitSizeScale(target, sizeScale);
                  setHudTick((v) => v + 1);
                }}
                onToggleUnitTrait={(unitId, traitId) => {
                  const target = simRef.current.units.find((u) => u.id === unitId);
                  if (!target) return;
                  if (target.traits === undefined) {
                    target.traits = generateUnitTraits(target.role, target.species, target.appearanceSeed);
                  }
                  toggleUnitTrait(target, traitId);
                  soundEngine.playClick();
                  setHudTick((v) => v + 1);
                }}
                onToggleUnitGene={(unitId, geneName) => {
                  const target = simRef.current.units.find((u) => u.id === unitId);
                  if (!target) return;
                  if (target.genes === undefined) {
                    target.genes = generateUnitGenes(target.role, target.species, target.appearanceSeed);
                  }
                  toggleUnitGene(target, geneName);
                  soundEngine.playClick();
                  setHudTick((v) => v + 1);
                }}
                onAddUnitItem={(unitId, itemName) => {
                  const target = simRef.current.units.find((u) => u.id === unitId);
                  if (!target) return;
                  if (target.items === undefined) {
                    target.items = generateUnitItems(
                      target.role,
                      target.species,
                      simRef.current.epochIndex,
                      target.appearanceSeed,
                    );
                  }
                  if (addUnitItem(target, itemName)) {
                    soundEngine.playClick();
                    setStatusFeedback(`Gave ${itemName} to ${target.name}`);
                    setHudTick((v) => v + 1);
                  }
                }}
                onRemoveUnitItem={(unitId, itemIndex) => {
                  const target = simRef.current.units.find((u) => u.id === unitId);
                  if (!target) return;
                  if (target.items === undefined) {
                    target.items = generateUnitItems(
                      target.role,
                      target.species,
                      simRef.current.epochIndex,
                      target.appearanceSeed,
                    );
                  }
                  if (removeUnitItem(target, itemIndex)) {
                    soundEngine.playClick();
                    setHudTick((v) => v + 1);
                  }
                }}
              />
              </div>
            )}

            {gameState === 'playing' && inspectedCity && (
              <div className={chronicleOpen && !speedMenuOpen && !cameraMenuOpen ? 'hidden lg:contents' : 'contents'}>
                <CityInspectorCard
                  sim={sim}
                  cityRef={inspectedCity}
                  accentHex={
                    inspectedCity.hexColor ||
                    zoneOverlayBuffers.kingdomColors?.[inspectedCity.settlementId] ||
                    zoneOverlayBuffers.kingdomColors?.[inspectedCity.kingdomId] ||
                    '#f2c478'
                  }
                  offsetForEntityInspector={isInspectTabActive}
                  onClose={() => {
                    setInspectedCity(null);
                    soundEngine.playClick();
                  }}
                  onFocusTile={(tx, tz) => {
                    cameraActionRef.current.focusTarget = { x: tx, z: tz, zoom: 11.5 };
                    soundEngine.playClick();
                    setStatusFeedback(`Focused camera on ${inspectedCity.name || 'city'}`);
                  }}
                  onRenameSettlement={(settlementId, newName) => {
                    const s = simRef.current;
                    const oldName = s.settlementNames?.[settlementId];
                    if (!s.settlementNames) s.settlementNames = {};
                    s.settlementNames[settlementId] = newName;
                    const kid = s.settlementKingdoms?.[settlementId];
                    if (kid && kid !== settlementId && (!s.settlementNames[kid] || s.settlementNames[kid] === oldName)) {
                      s.settlementNames[kid] = newName;
                    }
                    setInspectedCity((prev) =>
                      prev && prev.settlementId === settlementId ? { ...prev, name: newName } : prev,
                    );
                    setStatusFeedback(`Renamed city to ${newName}`);
                    setHudTick((v) => v + 1);
                  }}
                  onRenameKingdom={(kingdomId, newName) => {
                    const s = simRef.current;
                    const oldName = s.settlementNames?.[kingdomId];
                    if (!s.settlementNames) s.settlementNames = {};
                    s.settlementNames[kingdomId] = newName;
                    if (s.settlementKingdoms) {
                      for (const [sid, kid] of Object.entries(s.settlementKingdoms)) {
                        if (kid === kingdomId && (!s.settlementNames[sid] || s.settlementNames[sid] === oldName)) {
                          s.settlementNames[sid] = newName;
                          break;
                        }
                      }
                    }
                    setStatusFeedback(`Renamed kingdom to ${newName}`);
                    setHudTick((v) => v + 1);
                  }}
                  onSetKingdomResource={(kingdomId, resource, value) => {
                    const s = simRef.current;
                    if (!s.kingdomResources) s.kingdomResources = {};
                    if (!s.kingdomResources[kingdomId]) {
                      s.kingdomResources[kingdomId] = {
                        food: 0,
                        wood: 0,
                        stone: 0,
                        ore: 0,
                        knowledge: 0,
                        energy: 0,
                        alloy: 0,
                        faith: 0,
                      };
                    }
                    s.kingdomResources[kingdomId][resource] = Math.max(0, Math.min(999999, Math.round(value)));
                    syncStateResourcesFromKingdoms(s);
                    setHudTick((v) => v + 1);
                  }}
                  onBoostKingdomResources={(kingdomId, delta) => {
                    const s = simRef.current;
                    if (!s.kingdomResources) s.kingdomResources = {};
                    if (!s.kingdomResources[kingdomId]) {
                      s.kingdomResources[kingdomId] = {
                        food: 0,
                        wood: 0,
                        stone: 0,
                        ore: 0,
                        knowledge: 0,
                        energy: 0,
                        alloy: 0,
                        faith: 0,
                      };
                    }
                    const res = s.kingdomResources[kingdomId];
                    const keys: (keyof Resources)[] = ['food', 'wood', 'stone', 'ore', 'knowledge', 'alloy', 'faith'];
                    for (const key of keys) {
                      res[key] = delta === 0 ? 0 : Math.max(0, Math.min(999999, Math.floor((res[key] ?? 0) + delta)));
                    }
                    syncStateResourcesFromKingdoms(s);
                    setStatusFeedback(delta === 0 ? 'Cleared city stockpile' : `Granted +${delta} to all city resources`);
                    setHudTick((v) => v + 1);
                  }}
                  onSetKingdomEpoch={(kingdomId, epochIndex) => {
                    const s = simRef.current;
                    const clamped = Math.max(0, Math.min(EPOCHS.length - 1, Math.round(epochIndex)));
                    const prevEpoch = getKingdomEpoch(s, kingdomId);
                    setKingdomEpoch(s, kingdomId, clamped, true);
                    for (const b of s.buildings) {
                      if (b.hp > 0 && b.settlementId && getKingdomId(s, b.settlementId) === kingdomId) {
                        b.epochLevel = clamped;
                      }
                    }
                    if (clamped > prevEpoch) soundEngine.playEpochAscend();
                    else soundEngine.playClick();
                    setStatusFeedback(`Set kingdom era to ${EPOCHS[clamped]?.name ?? 'Era'}`);
                    setHudTick((v) => v + 1);
                  }}
                  onSetKingdomEpochProgress={(kingdomId, progress) => {
                    const s = simRef.current;
                    if (!s.kingdomEpochProgress) s.kingdomEpochProgress = {};
                    const clamped = Math.max(0, Math.min(100, Math.round(progress)));
                    const curEpoch = getKingdomEpoch(s, kingdomId);
                    if (clamped >= 100 && curEpoch < EPOCHS.length - 1) {
                      const nextEpoch = curEpoch + 1;
                      setKingdomEpoch(s, kingdomId, nextEpoch, true);
                      for (const b of s.buildings) {
                        if (b.hp > 0 && b.settlementId && getKingdomId(s, b.settlementId) === kingdomId) {
                          b.epochLevel = nextEpoch;
                        }
                      }
                      soundEngine.playEpochAscend();
                      setStatusFeedback(`Advanced kingdom to ${EPOCHS[nextEpoch]?.name ?? 'next era'}`);
                    } else {
                      s.kingdomEpochProgress[kingdomId] = clamped;
                      syncAverageEpochFromKingdoms(s);
                    }
                    setHudTick((v) => v + 1);
                  }}
                  onToggleKingdomPeaceful={(kingdomId) => {
                    const s = simRef.current;
                    if (!s.kingdomPeacefulTraits) s.kingdomPeacefulTraits = {};
                    const next = !s.kingdomPeacefulTraits[kingdomId];
                    s.kingdomPeacefulTraits[kingdomId] = next;
                    soundEngine.playClick();
                    setStatusFeedback(next ? 'Kingdom set to Peaceful' : 'Kingdom set to Expansionist');
                    setHudTick((v) => v + 1);
                  }}
                />
              </div>
            )}

            {chronicleOpen && !speedMenuOpen && !cameraMenuOpen && (
              <div className="pointer-events-auto absolute right-0 top-0 z-20 w-[min(24rem,100%)] max-h-[min(240px,100%)] sm:max-h-full px-panel p-2 sm:p-3 overflow-y-auto">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h2 className="font-bold text-sm text-[#f2c478]">World Log</h2>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setChronicleFilter('major')}
                      className={`px-1.5 py-0.5 text-[10px] font-semibold cursor-pointer ${
                        chronicleFilter === 'major' ? 'px-btn-active' : 'px-btn'
                      }`}
                    >
                      Major
                    </button>
                    <button
                      type="button"
                      onClick={() => setChronicleFilter('all')}
                      className={`px-1.5 py-0.5 text-[10px] font-semibold cursor-pointer ${
                        chronicleFilter === 'all' ? 'px-btn-active' : 'px-btn'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setChronicleOpen(false)}
                      className="px-btn px-2 py-0.5 text-xs cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  {sim.chronicle
                    .filter((entry) => chronicleFilter === 'all' || entry.tone !== 'build')
                    .map((entry) => {
                      const hasLoc = entry.x !== undefined && entry.z !== undefined;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          disabled={!hasLoc}
                          onClick={() => {
                            if (entry.x !== undefined && entry.z !== undefined) {
                              cameraActionRef.current.focusTarget = { x: entry.x, z: entry.z, zoom: 11.5 };
                            }
                          }}
                          title={hasLoc ? `Jump to (${entry.x}, ${entry.z})` : undefined}
                          className={`w-full text-left leading-snug flex items-start gap-2 rounded px-1 py-0.5 transition-colors ${
                            hasLoc
                              ? 'cursor-pointer hover:bg-[#213357]/70 active:bg-[#2c4270]'
                              : 'cursor-default'
                          }`}
                        >
                          <span className="font-pixel-num text-[10px] text-[#9e866f] shrink-0 pt-0.5">
                            {entry.yearLabel}
                          </span>
                          <span
                            className={`flex-1 ${
                              entry.tone === 'epoch'
                                ? 'text-[#ffd36b]'
                                : entry.tone === 'warning'
                                  ? 'text-[#ff8f6b]'
                                  : 'text-[#eadbc6]'
                            }`}
                          >
                            {entry.text}
                          </span>
                          {hasLoc && (
                            <span className="text-[10px] text-[#7dd3fc] shrink-0 pt-0.5 opacity-80">
                              ⌖
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

          </div>

          {/* BOTTOM PIXEL TOOLBAR DOCK: Compact horizontal-rail layout on mobile, full grid on desktop */}
          <div className="pointer-events-auto self-center relative flex flex-col items-center w-full max-w-[min(880px,calc(100vw-8px))] sm:max-w-[min(880px,calc(100vw-24px))]">
            {/* Hover Tooltip (Desktop) */}
            {!dockCollapsed && hoveredHint && (
              <div className="px-panel px-3 py-1.5 mb-2 max-w-[calc(100vw-24px)] hidden md:flex items-center gap-3 text-xs flex-wrap justify-center pointer-events-none">
                <span className="font-bold text-[#f2c478]">{hoveredHint.title}</span>
                <span className="text-[#80ed99] font-semibold tabular-nums">{hoveredHint.cost}</span>
                <span className="text-[#ccb69c]">{hoveredHint.detail}</span>
              </div>
            )}

            {/* Active Tool / Power Description Bar (Mobile) */}
            {!dockCollapsed && activeToolInfo && (
              <div
                data-testid="mobile-tool-description"
                className="px-panel px-2.5 py-1 mb-1 max-w-[calc(100vw-8px)] w-full flex md:hidden flex-col gap-0.5 pointer-events-none"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] leading-tight">
                  <span className="font-bold text-[#f2c478] truncate">{activeToolInfo.title}</span>
                  <span className="text-[#80ed99] font-semibold tabular-nums shrink-0">
                    {activeToolInfo.cost}
                  </span>
                </div>
                <p className="text-[10px] text-[#ccb69c] leading-snug line-clamp-2">
                  {activeToolInfo.detail}
                </p>
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
                  className="px-btn h-[22px] sm:h-7 px-1.5 sm:px-2.5 flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-[#f2c478] cursor-pointer whitespace-nowrap shrink-0"
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
                  activeCategory === 'spawn') && (
                  <div className="flex flex-nowrap sm:flex-wrap items-center justify-between gap-1 sm:gap-2 pb-1 mb-1 sm:pb-2 sm:mb-2.5 border-b border-[#423229] overflow-x-auto no-scrollbar">
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
                          <div className="w-[1px] h-4 bg-[#544034] mx-0.5 shrink-0" />
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
                          <div className="w-[1px] h-4 bg-[#544034] mx-0.5 shrink-0" />
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
                      <span className="hidden md:inline text-[11px] text-[#ccb69c] mr-1 truncate max-w-[200px]">
                        Selected: <strong className="text-[#f2c478]">{activeToolLabel}</strong>
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
                          mobilePanMode ? 'px-btn-active font-bold' : 'px-btn text-[#eadbc6]'
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
                            : 'px-btn text-[#eadbc6]'
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
                            <span className="absolute bottom-0.5 right-0.5 sm:right-1 font-pixel-num text-[8px] text-[#ffd36b] leading-none">
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
                            <span className="absolute bottom-0.5 right-0.5 sm:right-1 font-pixel-num text-[8px] text-[#ffd36b] leading-none">
                              {tool.faithCost}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* TAB 3: SPECIES UNITS + ANIMALS & MYTHICAL BEASTS */}
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
                            <span className="text-[10px] sm:text-xs font-bold text-[#f4e7d4] whitespace-nowrap">
                              {u.name}
                            </span>
                            {badge && (
                              <span className="font-pixel-num text-[9px] text-[#ffd36b] leading-none">
                                {badge}
                              </span>
                            )}
                          </button>
                        );
                      })}

                    {unitFilter === 'all' && (
                      <span
                        className="w-px h-7 bg-[#544034] mx-0.5 hidden sm:inline-block"
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
                            <span className="absolute bottom-0.5 right-0.5 sm:right-1 font-pixel-num text-[8px] text-[#ffd36b] leading-none">
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
                                cost: zItem.count > 0 ? `${zItem.count}` : '',
                                detail: zItem.summary,
                              })
                            }
                            className={`relative px-1.5 sm:px-2.5 h-[38px] sm:h-11 shrink-0 flex items-center gap-1 sm:gap-2 cursor-pointer transition-colors ${
                              isOn ? 'px-slot-active' : 'px-slot'
                            }`}
                          >
                            <ZonePixelIcon zone={zItem.id} className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 pixelated-canvas" />
                            <span className="text-[10px] sm:text-xs font-bold text-[#f4e7d4] whitespace-nowrap">
                              {zItem.shortLabel}
                            </span>
                          </button>
                        );
                      })}

                      {(activeZones.kingdoms || activeZones.alliances) && (
                        <button
                          type="button"
                          aria-pressed={showWarFrontArrows}
                          aria-label="War Arrows & Info"
                          data-testid="zone-toggle-war-arrows"
                          onClick={() => {
                            setShowWarFrontArrows((prev) => {
                              const next = !prev;
                              setStatusFeedback(`War Arrows & Info ${next ? 'enabled' : 'disabled'}`);
                              return next;
                            });
                            soundEngine.playClick();
                          }}
                          onMouseEnter={() =>
                            setHoveredHint({
                              title: 'War Arrows & Info',
                              cost: '',
                              detail:
                                'Show or hide animated war-front arrows and battle push labels while viewing Kingdoms or Alliances',
                            })
                          }
                          className={`relative px-2 sm:px-2.5 h-[38px] sm:h-11 shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors ${
                            showWarFrontArrows ? 'px-slot-active' : 'px-slot'
                          }`}
                        >
                          <span className="text-[10px] sm:text-xs font-bold text-[#f4e7d4] whitespace-nowrap">
                            War Info
                          </span>
                        </button>
                      )}

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

                {/* TAB 6: WORLD (Ages & Sky Sliders + God Rules & World Info Overlay Triggers) */}
                {(activeCategory === 'epochs' || activeCategory === 'rules') && (() => {
                  const isCycleSky =
                    Boolean(sim.worldRules?.dayNightCycle) || lightingPreset === 'auto';
                  const activeSkyIdx = isCycleSky
                    ? 0
                    : Math.max(
                        1,
                        WORLD_SKY_PRESETS.findIndex((p) => p.id === lightingPreset),
                      );
                  const activeSkyPreset = WORLD_SKY_PRESETS[activeSkyIdx] ?? WORLD_SKY_PRESETS[2];
                  return (
                    <div className="flex flex-col gap-2 sm:gap-2.5">
                      <div className="flex items-center justify-between gap-2 pb-1.5 sm:pb-2 border-b border-[#423229]">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            data-testid="world-open-god-rules"
                            onClick={() => {
                              setShowWorldInfoModal(false);
                              setShowGodRulesModal(true);
                              soundEngine.playClick();
                            }}
                            className={`h-7 px-2.5 flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer ${
                              showGodRulesModal ? 'px-btn-active font-bold' : 'px-btn'
                            }`}
                          >
                            <TabPixelIcon category="rules" className="w-3.5 h-3.5" />
                            <span>God Rules</span>
                          </button>
                          <button
                            type="button"
                            data-testid="world-open-world-info"
                            onClick={() => {
                              setShowGodRulesModal(false);
                              setShowWorldInfoModal(true);
                              soundEngine.playClick();
                            }}
                            className={`h-7 px-2.5 flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer ${
                              showWorldInfoModal ? 'px-btn-active font-bold' : 'px-btn'
                            }`}
                          >
                            <HudPixelIcon kind="log" className="w-3.5 h-3.5" />
                            <span>World Info</span>
                          </button>
                        </div>
                        <div className="hidden sm:flex items-center gap-3 text-[11px] text-[#b09880] tabular-nums">
                          <span>{sim.worldName || 'World'}</span>
                          <span>{sim.gridSize}×{sim.gridSize}</span>
                          <span>Seed #{sim.seed}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 px-0.5">
                        {/* Age Slider */}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[11px] sm:text-xs">
                            <label htmlFor="world-age-slider" className="text-[#bfa88f]">
                              Age
                            </label>
                            <span
                              data-testid="world-age-value"
                              className="text-[#f2c478] font-bold"
                            >
                              {currentEpoch.name}
                            </span>
                          </div>
                          <input
                            id="world-age-slider"
                            data-testid="world-age-slider"
                            type="range"
                            min={0}
                            max={EPOCHS.length - 1}
                            step={1}
                            value={Math.max(0, Math.min(EPOCHS.length - 1, currentEpoch.index))}
                            onChange={(e) => {
                              const idx = Number(e.target.value);
                              const ep = EPOCHS[idx];
                              if (!ep) return;
                              const s = simRef.current;
                              const targetProg = ep.index >= EPOCHS.length - 1 ? 100 : 0;
                              s.epochIndex = ep.index;
                              if (!s.kingdomEpochs) s.kingdomEpochs = {};
                              if (!s.kingdomEpochProgress) s.kingdomEpochProgress = {};
                              for (const kid of Object.keys(s.kingdomEpochs)) {
                                s.kingdomEpochs[kid] = ep.index;
                                s.kingdomEpochProgress[kid] = targetProg;
                              }
                              for (const b of s.buildings) {
                                b.epochLevel = ep.index;
                                if (b.settlementId) {
                                  const kid = getKingdomId(s, b.settlementId);
                                  s.kingdomEpochs[kid] = ep.index;
                                  s.kingdomEpochProgress[kid] = targetProg;
                                }
                              }
                              for (const u of s.units) {
                                if (u.faction === 'civilization' && u.state !== 'ko' && u.hp > 0) {
                                  const kid = u.settlementId
                                    ? getKingdomId(s, u.settlementId)
                                    : u.kingdomId;
                                  if (kid) {
                                    s.kingdomEpochs[kid] = ep.index;
                                    s.kingdomEpochProgress[kid] = targetProg;
                                  }
                                }
                              }
                              syncAverageEpochFromKingdoms(s);
                              soundEngine.playEpochAscend();
                              setStatusFeedback(ep.name);
                              setHudTick((t) => t + 1);
                            }}
                            className="px-range my-1 w-full cursor-pointer"
                          />
                          <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-[#8f7862]">
                            <span>{EPOCHS[0]?.name}</span>
                            <span>{EPOCHS[EPOCHS.length - 1]?.name}</span>
                          </div>
                        </div>

                        {/* Sky Slider */}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[11px] sm:text-xs">
                            <label htmlFor="world-sky-slider" className="text-[#bfa88f]">
                              Sky
                            </label>
                            <span
                              data-testid="world-sky-value"
                              className="text-[#f2c478] font-bold"
                            >
                              {activeSkyPreset.label}
                            </span>
                          </div>
                          <input
                            id="world-sky-slider"
                            data-testid="world-sky-slider"
                            type="range"
                            min={0}
                            max={WORLD_SKY_PRESETS.length - 1}
                            step={1}
                            value={activeSkyIdx}
                            onChange={(e) => {
                              const idx = Number(e.target.value);
                              const presetObj = WORLD_SKY_PRESETS[idx];
                              if (!presetObj) return;
                              setLightingPreset(presetObj.id);
                              if (!simRef.current.worldRules) {
                                simRef.current.worldRules = { ...DEFAULT_WORLD_RULES };
                              }
                              simRef.current.worldRules.dayNightCycle = presetObj.id === 'auto';
                              soundEngine.playClick();
                              setStatusFeedback(`Sky: ${presetObj.label}`);
                              setHudTick((t) => t + 1);
                            }}
                            className="px-range my-1 w-full cursor-pointer"
                          />
                          <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-[#8f7862]">
                            {WORLD_SKY_PRESETS.map((p) => (
                              <span
                                key={p.id}
                                className={
                                  p.id === activeSkyPreset.id
                                    ? 'text-[#f4e7d4] font-semibold'
                                    : undefined
                                }
                              >
                                {p.shortLabel}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Season Slider */}
                        {(() => {
                          const activeSeasonIdx = Math.max(
                            0,
                            WORLD_SEASON_PRESETS.findIndex((p) => p.id === seasonPreset),
                          );
                          const activeSeasonOpt =
                            WORLD_SEASON_PRESETS[activeSeasonIdx] ?? WORLD_SEASON_PRESETS[0];
                          const liveSeason = computeSeasonState(seasonPreset, sim.year);
                          const liveSeasonLabel =
                            seasonPreset === 'auto'
                              ? `Auto (${liveSeason.dominantSeason[0].toUpperCase()}${liveSeason.dominantSeason.slice(1)})`
                              : activeSeasonOpt.label;
                          return (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between text-[11px] sm:text-xs">
                                <label htmlFor="world-season-slider" className="text-[#bfa88f]">
                                  Season
                                </label>
                                <span
                                  data-testid="world-season-value"
                                  className="text-[#f2c478] font-bold"
                                >
                                  {liveSeasonLabel}
                                </span>
                              </div>
                              <input
                                id="world-season-slider"
                                data-testid="world-season-slider"
                                type="range"
                                min={0}
                                max={WORLD_SEASON_PRESETS.length - 1}
                                step={1}
                                value={activeSeasonIdx}
                                onChange={(e) => {
                                  const idx = Number(e.target.value);
                                  const opt = WORLD_SEASON_PRESETS[idx];
                                  if (!opt) return;
                                  setSeasonPreset(opt.id);
                                  soundEngine.playClick();
                                  setStatusFeedback(`Season: ${opt.label}`);
                                  setHudTick((t) => t + 1);
                                }}
                                className="px-range my-1 w-full cursor-pointer"
                              />
                              <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-[#8f7862]">
                                {WORLD_SEASON_PRESETS.map((p) => (
                                  <span
                                    key={p.id}
                                    className={
                                      p.id === activeSeasonOpt.id
                                        ? 'text-[#f4e7d4] font-semibold'
                                        : undefined
                                    }
                                  >
                                    {p.shortLabel}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}

                {/* TAB 7: INSPECT */}
                {activeCategory === 'inspect' && (
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-[#eadbc6] min-h-[36px] sm:min-h-[48px]">
                    <span>{statusFeedback}</span>
                    {inspectedTile && (
                      <span className="text-[#f2c478] tabular-nums">
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
                            {hoveredZoneInfo.isKingdomMaritime ? ', Maritime Waters' : ''})
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
                        <span className="font-pixel-num text-[#ffd36b] tabular-nums">
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
      {gameState === 'paused' && !hasBlockingSaveOrQuitModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
          data-testid="ingame-settings-modal"
          className="fixed inset-0 z-40 flex items-center justify-center px-backdrop p-2 sm:p-4"
        >
          <div className="w-[min(28rem,calc(100vw-16px))] max-h-[calc(100dvh-16px)] overflow-y-auto px-panel-hero p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold text-[#f2c478]">Settings</h2>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#eadbc6]">Sound Effects</span>
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
                className="px-btn w-full py-2 text-xs font-semibold cursor-pointer text-[#ffd36b]"
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
      {gameState === 'gameover' && !hasBlockingSaveOrQuitModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Victory"
          className="fixed inset-0 z-40 flex items-center justify-center px-backdrop p-2 sm:p-4"
        >
          <div className="w-[min(24rem,calc(100vw-16px))] max-h-[calc(100dvh-16px)] overflow-y-auto px-panel-hero p-4 sm:p-6">
            <h2 className="text-2xl font-bold text-[#ffd36b] mb-1">Star Ascension</h2>
            <p className="text-xs text-[#ccb69c] mb-5">
              Your world reached the stars.
            </p>

            <div className="grid grid-cols-3 gap-2 mb-6 px-panel-inset p-3 text-center">
              <div>
                <div className="font-pixel-num text-base font-bold text-[#ffd36b]">{sim.totalStructuresBuilt}</div>
                <div className="text-[11px] text-[#b09880]">Built</div>
              </div>
              <div>
                <div className="font-pixel-num text-base font-bold text-[#56cfe1]">{sim.totalMiraclesCast}</div>
                <div className="text-[11px] text-[#b09880]">Powers</div>
              </div>
              <div>
                <div className="font-pixel-num text-base font-bold text-[#80ed99]">{sim.population}</div>
                <div className="text-[11px] text-[#b09880]">Pop</div>
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

      {/* GOD RULES OVERLAY */}
      {showGodRulesModal && gameState === 'playing' && !hasBlockingSaveOrQuitModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="God Rules"
          data-testid="god-rules-modal"
          onClick={() => {
            soundEngine.playClick();
            setShowGodRulesModal(false);
          }}
          className="fixed inset-0 z-40 flex items-center justify-center px-backdrop p-2 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[min(36rem,calc(100vw-16px))] max-h-[82dvh] px-panel-hero p-4 sm:p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#423229] shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-[#f2c478] flex items-center gap-2">
                  <TabPixelIcon category="rules" className="w-4 h-4 shrink-0" />
                  <span>God Rules</span>
                </h2>
                <p className="text-[11px] text-[#b09880] mt-0.5">
                  Toggle live world laws and creature rules
                </p>
              </div>
              <button
                type="button"
                data-testid="close-god-rules-modal"
                onClick={() => {
                  soundEngine.playClick();
                  setShowGodRulesModal(false);
                }}
                className="px-btn px-2.5 py-1 text-xs font-semibold cursor-pointer shrink-0"
              >
                Close
              </button>
            </div>

            <div
              data-testid="god-rules-panel"
              className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 overflow-y-auto pr-1"
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
                    className={`px-3 py-2 text-left flex items-start justify-between gap-2.5 cursor-pointer ${
                      isOn
                        ? 'px-slot-active text-[#f4e7d4]'
                        : 'px-slot text-[#bfa88f]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold leading-tight">{rule.label}</div>
                      <p className="text-[10px] text-[#9e866f] leading-snug mt-0.5">
                        {rule.summary}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                      <span
                        className={`text-[10px] font-bold ${
                          isOn ? 'text-[#80ed99]' : 'text-[#8f7862]'
                        }`}
                      >
                        {isOn ? 'On' : 'Off'}
                      </span>
                      <span
                        className={`w-2.5 h-2.5 border border-[#110c0a] shrink-0 ${
                          isOn ? 'bg-[#80ed99]' : 'bg-[#423229]'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* WORLD INFO OVERLAY */}
      {showWorldInfoModal && gameState === 'playing' && !showGodRulesModal && !hasBlockingSaveOrQuitModal && (() => {
        const wStats = sim.worldStats ?? createEmptyWorldStats();
        let livingCivs = 0;
        let livingHumans = 0;
        let livingElves = 0;
        let livingOrcs = 0;
        let livingDwarves = 0;
        let livingLizardfolk = 0;
        let livingChildren = 0;
        let livingWildlife = 0;
        let livingMythical = 0;
        let livingHostiles = 0;

        for (const u of sim.units) {
          if (u.state === 'ko' || u.hp <= 0) continue;
          const uDef = UNIT_DEF_BY_ROLE.get(u.role);
          if (MYTHICAL_ROLE_SET.has(u.role) || uDef?.category === 'mythical') {
            livingMythical += 1;
          } else if (uDef?.category === 'animal') {
            livingWildlife += 1;
          }
          if (u.faction === 'civilization') {
            livingCivs += 1;
            if (u.ageStage === 'child') livingChildren += 1;
            if (u.species === 'elf') livingElves += 1;
            else if (u.species === 'orc') livingOrcs += 1;
            else if (u.species === 'dwarf') livingDwarves += 1;
            else if (u.species === 'lizardfolk') livingLizardfolk += 1;
            else livingHumans += 1;
          } else if (u.faction === 'hostile') {
            livingHostiles += 1;
          }
        }

        const activeCityIds = new Set<string>();
        const activeKingdomIds = new Set<string>();
        for (const b of sim.buildings) {
          if (b.settlementId) {
            activeCityIds.add(b.settlementId);
            activeKingdomIds.add(getKingdomId(sim, b.settlementId));
          }
        }
        const activeCities = activeCityIds.size;
        const activeKingdoms = activeKingdomIds.size;
        const citiesCreatedTotal = Math.max(wStats.citiesCreated, activeCities);
        const wildlifeSpawnedTotal = Math.max(wStats.wildlifeSpawned, livingWildlife + wStats.wildlifeDeaths);
        const mythicalSpawnedTotal = Math.max(wStats.mythicalSpawned, livingMythical + wStats.mythicalDeaths);
        const hostilesSpawnedTotal = Math.max(wStats.hostilesSpawned, livingHostiles + wStats.hostilesKilled);
        const hostilesKilledTotal = Math.max(wStats.hostilesKilled, sim.totalRaidersDefeated);

        let activeWars = 0;
        let activeAlliances = 0;
        const kingdomList = Array.from(activeKingdomIds);
        for (let i = 0; i < kingdomList.length; i++) {
          for (let j = i + 1; j < kingdomList.length; j++) {
            const rel = getKingdomRelation(sim, kingdomList[i], kingdomList[j]);
            if (rel === 'war') activeWars += 1;
            else if (rel === 'allied') activeAlliances += 1;
          }
        }

        const activeVehicles = sim.vehicles?.length ?? 0;

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="World Info"
            data-testid="world-info-modal"
            onClick={() => {
              soundEngine.playClick();
              setShowWorldInfoModal(false);
            }}
            className="fixed inset-0 z-40 flex items-center justify-center px-backdrop p-2 sm:p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-[min(27rem,calc(100vw-16px))] max-h-[82dvh] px-panel-hero p-4 sm:p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#423229] shrink-0">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-[#f2c478] truncate">
                    {sim.worldName || 'World Info'}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#b09880] mt-0.5 tabular-nums">
                    <span>{formatYearLabel(sim.year)}</span>
                    <span>{currentEpoch.name}</span>
                    <span>{sim.gridSize}×{sim.gridSize}</span>
                    <span>Seed #{sim.seed}</span>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="close-world-info-modal"
                  onClick={() => {
                    soundEngine.playClick();
                    setShowWorldInfoModal(false);
                  }}
                  className="px-btn px-2.5 py-1 text-xs font-semibold cursor-pointer shrink-0"
                >
                  Close
                </button>
              </div>

              <div className="overflow-y-auto pr-1 space-y-3 text-xs">
                {/* Life & Population */}
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-[#f2c478] mb-1">
                    Life &amp; Population
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Population</span>
                    <span className="text-[#f4e7d4] font-semibold">
                      {livingCivs.toLocaleString()} / {sim.populationCap.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Humans / Elves / Orcs</span>
                    <span className="text-[#f4e7d4]">
                      {livingHumans.toLocaleString()} / {livingElves.toLocaleString()} / {livingOrcs.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Dwarves / Lizardfolk</span>
                    <span className="text-[#f4e7d4]">
                      {livingDwarves.toLocaleString()} / {livingLizardfolk.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Newborns</span>
                    <span
                      data-testid="world-stat-total-births"
                      className="text-[#f4e7d4] font-semibold"
                    >
                      {wStats.totalBirths.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Children</span>
                    <span className="text-[#f4e7d4]">{livingChildren.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Total Deaths</span>
                    <span
                      data-testid="world-stat-total-deaths"
                      className="text-[#f4e7d4] font-semibold"
                    >
                      {wStats.totalDeaths.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Civilian Deaths</span>
                    <span className="text-[#f4e7d4]">{wStats.civilianDeaths.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">World Happiness</span>
                    <span className="text-[#f4e7d4]">{Math.round(sim.happiness)}%</span>
                  </div>
                </div>

                {/* Cities & Kingdoms */}
                <div className="space-y-1 pt-2.5 border-t border-[#423229]">
                  <div className="text-[11px] font-bold text-[#f2c478] mb-1">
                    Cities &amp; Kingdoms
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Active Cities</span>
                    <span className="text-[#f4e7d4] font-semibold">{activeCities.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Active Kingdoms</span>
                    <span className="text-[#f4e7d4]">{activeKingdoms.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Cities Created</span>
                    <span
                      data-testid="world-stat-cities-created"
                      className="text-[#f4e7d4] font-semibold"
                    >
                      {citiesCreatedTotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Cities Destroyed</span>
                    <span
                      data-testid="world-stat-cities-destroyed"
                      className="text-[#f4e7d4] font-semibold"
                    >
                      {wStats.citiesDestroyed.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Active Wars</span>
                    <span className="text-[#f4e7d4]">{activeWars}</span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Active Alliances</span>
                    <span className="text-[#f4e7d4]">{activeAlliances}</span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Total Wars</span>
                    <span className="text-[#f4e7d4]">{wStats.warsStarted.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Rebellions</span>
                    <span className="text-[#f4e7d4]">{wStats.rebellionsTriggered.toLocaleString()}</span>
                  </div>
                </div>

                {/* Wildlife & Mythical Creatures */}
                <div className="space-y-1 pt-2.5 border-t border-[#423229]">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-baseline mb-1">
                    <span className="text-[11px] font-bold text-[#f2c478]">Creatures</span>
                    <span className="text-[10px] text-[#8f7862] text-right w-12">Living</span>
                    <span className="text-[10px] text-[#8f7862] text-right w-14">Spawned</span>
                    <span className="text-[10px] text-[#8f7862] text-right w-12">Died</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-baseline tabular-nums">
                    <span className="text-[#b09880]">Wildlife</span>
                    <span className="text-[#f4e7d4] font-semibold text-right w-12">
                      {livingWildlife.toLocaleString()}
                    </span>
                    <span className="text-[#f4e7d4] text-right w-14">
                      {wildlifeSpawnedTotal.toLocaleString()}
                    </span>
                    <span className="text-[#f4e7d4] text-right w-12">
                      {wStats.wildlifeDeaths.toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-baseline tabular-nums">
                    <span className="text-[#b09880]">Mythical</span>
                    <span className="text-[#f4e7d4] font-semibold text-right w-12">
                      {livingMythical.toLocaleString()}
                    </span>
                    <span
                      data-testid="world-stat-mythical-spawned"
                      className="text-[#f4e7d4] text-right w-14"
                    >
                      {mythicalSpawnedTotal.toLocaleString()}
                    </span>
                    <span
                      data-testid="world-stat-mythical-deaths"
                      className="text-[#f4e7d4] text-right w-12"
                    >
                      {wStats.mythicalDeaths.toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-baseline tabular-nums">
                    <span className="text-[#b09880]">Hostiles</span>
                    <span className="text-[#f4e7d4] font-semibold text-right w-12">
                      {livingHostiles.toLocaleString()}
                    </span>
                    <span className="text-[#f4e7d4] text-right w-14">
                      {hostilesSpawnedTotal.toLocaleString()}
                    </span>
                    <span className="text-[#f4e7d4] text-right w-12">
                      {hostilesKilledTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Buildings & History */}
                <div className="space-y-1 pt-2.5 border-t border-[#423229]">
                  <div className="text-[11px] font-bold text-[#f2c478] mb-1">
                    Buildings &amp; History
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Active Buildings</span>
                    <span className="text-[#f4e7d4]">{sim.buildings.length.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Structures Built</span>
                    <span className="text-[#f4e7d4]">{sim.totalStructuresBuilt.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Buildings Destroyed</span>
                    <span className="text-[#f4e7d4]">{wStats.buildingsDestroyed.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">Vehicles &amp; Fleets</span>
                    <span className="text-[#f4e7d4]">{activeVehicles.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#b09880]">God Powers Cast</span>
                    <span className="text-[#f4e7d4]">{sim.totalMiraclesCast.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* QUIT TO MAIN MENU GUARD MODAL (unsaved worlds only) */}
      {quitConfirmOpen && !hasSavedWorld && gameState !== 'title' && !saveModalStep && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quit to Main Menu"
          data-testid="quit-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center px-backdrop p-2 sm:p-4"
        >
          <div className="w-[min(25rem,calc(100vw-16px))] px-panel-hero p-4 sm:p-6 space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-[#f2c478]">Return to Main Menu</h2>
            <p
              data-testid="quit-confirm-message"
              className="text-xs sm:text-sm text-[#eadbc6] leading-relaxed"
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
            className="fixed inset-0 z-50 flex items-center justify-center px-backdrop p-2 sm:p-4"
          >
            {saveModalStep === 'confirm' ? (
              <div className="w-[min(25rem,calc(100vw-16px))] px-panel-hero p-4 sm:p-6 space-y-4">
                <h2 className="text-base sm:text-lg font-bold text-[#f2c478]">Save World</h2>
                <p
                  data-testid="save-confirm-prompt"
                  className="text-xs sm:text-sm text-[#eadbc6] leading-relaxed"
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
              <div className="w-[min(27rem,calc(100vw-16px))] px-panel-hero p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-bold text-[#f2c478]">
                    World Name &amp; Description
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setSaveModalStep('confirm');
                    }}
                    className="text-xs text-[#bfa88f] hover:text-[#f4e7d4] cursor-pointer"
                  >
                    Back
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="save-world-name-input"
                      className="block text-xs text-[#bfa88f] mb-1.5"
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
                      className="block text-xs text-[#bfa88f] mb-1.5"
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
              <div className="w-[min(26rem,calc(100vw-16px))] px-panel-hero p-4 sm:p-6 space-y-4">
                <h2 className="text-base sm:text-lg font-bold text-[#ffd36b]">
                  Overwrite Existing World?
                </h2>
                <p
                  data-testid="save-overwrite-prompt"
                  className="text-xs sm:text-sm text-[#eadbc6] leading-relaxed"
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
