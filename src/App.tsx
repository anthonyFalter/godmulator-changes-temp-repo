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
} from './game/catalog';
import {
  DEFAULT_WORLD_RULES,
  WORLD_TEMPLATES,
  advanceEpoch,
  applyTerrainTool,
  canAfford,
  castGodPower,
  createInitialSimulationState,
  createWorldConfigFromTemplate,
  formatYearLabel,
  getTile,
  placeBuilding,
  spawnUnit,
} from './game/simulation';
import { normalizeSeed } from './game/worldGen';
import { soundEngine } from './game/sound';
import { toggleUnitFavorite } from './game/entityInspector';
import {
  ActiveTool,
  BrushInputMode,
  GameLifecycleState,
  GraphicsSettings,
  LightingPreset,
  Resources,
  ToolCategory,
  UnitEntity,
  WorldGenConfig,
  WorldRulesConfig,
  WorldTemplateId,
  ZoneOverlayType,
  ZoneToggleState,
} from './game/types';
import { loadGraphicsSettings, saveGraphicsSettings } from './game/graphics';
import {
  DEFAULT_ZONE_TOGGLES,
  buildZoneOverlayTextures,
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
  { key: 'energy', label: 'Energy' },
  { key: 'alloy', label: 'Alloy' },
  { key: 'faith', label: 'Faith' },
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
    key: 'sandboxFreeMode',
    label: 'Sandbox Free Mode',
    summary: 'Grants limitless Faith and removes construction/power costs',
  },
];

function formatCompactCost(cost: Partial<Resources>, isFree: boolean): string {
  if (isFree) return 'Free';
  const entries = Object.entries(cost).filter(([, v]) => (v ?? 0) > 0);
  if (entries.length === 0) return 'Free';
  return entries
    .map(([k, v]) => {
      const label = k === 'knowledge' ? 'Res' : k[0].toUpperCase() + k.slice(1);
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
  | 'settings'
  | 'credits'
  | 'create_world'
  | 'world_rules'
  | 'loading_world';

const GAME_VERSION = 'v0.6.0';

const UPDATE_LOG_ENTRIES = [
  {
    version: 'v0.6.0',
    items: [
      'World creator & templates',
      'Map sizes up to 256×256',
      'Customizable world rules',
    ],
  },
  {
    version: 'v0.5.0',
    items: [
      'Kingdom, territory & biome zones',
      'Shoreline & sea border overlays',
      'Zone hover inspection',
    ],
  },
  {
    version: 'v0.4.0',
    items: [
      'Seeded pixel Milky Way skybox',
      'Smooth 45° camera intro zoom',
    ],
  },
];

export default function App() {
  const simRef = useRef(
    createInitialSimulationState(
      128,
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('seed') ?? undefined
        : undefined,
    ),
  );
  const [seedInput, setSeedInput] = useState<string>(() => String(simRef.current.seed));

  const [gameState, setGameState] = useState<GameLifecycleState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'playing';
    }
    return 'title';
  });

  const [timeScale, setTimeScale] = useState<number>(1);
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('spawn');
  const [activeTool, setActiveTool] = useState<ActiveTool>({
    kind: 'spawn',
    unit: 'human',
  });
  const [brushRadius, setBrushRadius] = useState<number>(0);
  const [brushInputMode, setBrushInputMode] = useState<BrushInputMode>('hold');
  const pixelScale = 3;
  const [graphicsSettings, setGraphicsSettings] = useState<GraphicsSettings>(() =>
    loadGraphicsSettings(),
  );
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

  // Start UI navigation & World Creation Wizard state
  const [titleMenuStep, setTitleMenuStep] = useState<TitleMenuStep>('main');
  const [updateLogCollapsed, setUpdateLogCollapsed] = useState<boolean>(false);
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
    setLoadingProgress(10);
    setLoadingStageText('Generating terrain...');
    setTitleMenuStep('loading_world');
  }, []);

  useEffect(() => {
    if (gameState !== 'title' || titleMenuStep !== 'loading_world') return;

    const stages = [
      { pct: 35, text: 'Generating terrain...' },
      { pct: 65, text: 'Seeding biomes...' },
      { pct: 90, text: 'Spawning life...' },
      { pct: 100, text: 'Ready' },
    ];

    const timers: number[] = [];

    // Generate the actual configured world state on the second step
    timers.push(
      window.setTimeout(() => {
        setLoadingProgress(stages[0].pct);
        setLoadingStageText(stages[0].text);
      }, 120),
    );

    timers.push(
      window.setTimeout(() => {
        setLoadingProgress(stages[1].pct);
        setLoadingStageText(stages[1].text);
        const builtSim = createInitialSimulationState(
          worldConfig.gridSize,
          worldConfig.seed,
          worldConfig,
        );
        simRef.current = builtSim;
        setSeedInput(String(builtSim.seed));
        setHoverTile(null);
        setHoveredEntityId(null);
        setSelectedEntityId(null);
        selectedEntityIdRef.current = null;
        setFollowingEntityId(null);
        setLightingPreset(builtSim.worldRules?.dayNightCycle ? 'auto' : 'noon');
        setActiveCategory('spawn');
        setActiveTool({ kind: 'spawn', unit: 'human' });
        setHudTick((t) => t + 1);
      }, 320),
    );

    timers.push(
      window.setTimeout(() => {
        setLoadingProgress(stages[2].pct);
        setLoadingStageText(stages[2].text);
      }, 560),
    );

    timers.push(
      window.setTimeout(() => {
        setLoadingProgress(stages[3].pct);
        setLoadingStageText(stages[3].text);
      }, 760),
    );

    timers.push(
      window.setTimeout(() => {
        setTitleMenuStep('main');
        handleStartGame();
      }, 940),
    );

    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [gameState, titleMenuStep, worldConfig, handleStartGame]);

  const handleRestartGame = useCallback(() => {
    handleGenerateSeededWorld(undefined);
    cameraActionRef.current.playTransition = true;
    document.body.dataset.state = 'playing';
    setGameState('playing');
  }, [handleGenerateSeededWorld]);

  const handleToggleMute = useCallback(() => {
    soundEngine.muted = !soundEngine.muted;
    setMuted(soundEngine.muted);
  }, []);

  const handleUpdateGraphicsSettings = useCallback((next: GraphicsSettings) => {
    setGraphicsSettings(next);
    saveGraphicsSettings(next);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (gameState === 'title') {
        if (e.code === 'Escape') {
          e.preventDefault();
          setTitleMenuStep((prev) => {
            if (prev === 'world_rules') return 'create_world';
            if (prev === 'create_world' || prev === 'settings' || prev === 'credits') return 'main';
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
  }, [gameState]);

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

  const handleTileInteract = useCallback(
    (tileX: number, tileZ: number) => {
      const sim = simRef.current;
      sim.selectedTile = { x: tileX, z: tileZ };

      if (activeTool.kind === 'inspect') {
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
              ? `${def?.category === 'mythical' ? 'Mythical Beast' : 'Animal'} • ${def?.name ?? nearbyUnit.role}`
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
        const res = castGodPower(sim, activeTool.power, tileX, tileZ, { deferImpact: true });
        const def = GOD_POWERS.find((p) => p.type === activeTool.power);
        if (res.ok) {
          if (activeTool.power === 'meteor_strike') {
            soundEngine.playMeteorIncoming();
          } else if (activeTool.power === 'earthquake') {
            soundEngine.playEarthquake();
          } else if (activeTool.power === 'tornado') {
            soundEngine.playTornado();
          } else if (activeTool.power === 'tsunami') {
            soundEngine.playTsunami();
          } else if (activeTool.power === 'freeze_snap') {
            soundEngine.playFreeze();
          } else if (activeTool.power === 'heat_wave') {
            soundEngine.playHeatWave();
          } else {
            soundEngine.playClick();
          }
          setStatusFeedback(`${def?.name} cast`);
        } else {
          setStatusFeedback(res.reason || 'Need more Faith');
        }
        setHudTick((t) => t + 1);
        return;
      }

      if (activeTool.kind === 'terrain') {
        const res = applyTerrainTool(sim, activeTool.tool, tileX, tileZ, brushRadius);
        const def = TERRAIN_TOOLS.find((t) => t.type === activeTool.tool);
        if (res.ok) {
          soundEngine.playSculpt();
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
    [activeTool, brushRadius],
  );

  const handleAdvanceEpoch = (divineLeap: boolean) => {
    const res = advanceEpoch(simRef.current, divineLeap);
    if (res.ok && res.newEpoch) {
      soundEngine.playEpochAscend();
      setStatusFeedback(`Entered ${res.newEpoch.name}`);
      setHudTick((t) => t + 1);
    } else if (res.reason) {
      setStatusFeedback(res.reason);
      setHudTick((t) => t + 1);
    }
  };

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
    activeZones.temperature;
  const shouldComputeZones =
    anyZoneActive || isInspectTabActive || activeCategory === 'zones';

  // Compute dynamic land & sea zones & gather HUD unit lists in a single pass
  const sim = simRef.current;
  const livingKings: UnitEntity[] = [];
  const favoriteUnits: UnitEntity[] = [];
  let hoveredUnit: UnitEntity | null = null;
  let selectedUnit: UnitEntity | null = null;
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

  const zoneCacheKey = shouldComputeZones
    ? `${sim.seed}:${Math.floor(sim.year)}:${sim.buildings.length}:${sim.units.length}:${Math.floor(hudTick / 3)}`
    : 'idle';

  const worldZones = useMemo(() => {
    if (!shouldComputeZones) return null;
    return computeWorldZones(simRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldComputeZones, zoneCacheKey]);

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
      const len = simRef.current.gridSize * simRef.current.gridSize * 4;
      if (!zoneColorBufRef.current || zoneColorBufRef.current.length !== len) {
        zoneColorBufRef.current = new Uint8Array(len);
        zoneIdBufRef.current = new Uint8Array(len);
      } else {
        zoneColorBufRef.current.fill(0);
        zoneIdBufRef.current!.fill(0);
      }
      return {
        colorData: zoneColorBufRef.current,
        idData: zoneIdBufRef.current!,
        anyActive: false,
        kingdomsActive: false,
        kingsActive: false,
        version: zoneOverlayVersionRef.current,
        labels: [],
        kingdomColors: {} as Record<string, string>,
      };
    }

    const packed = buildZoneOverlayTextures(
      worldZones,
      activeZones,
      zoneHighlightHoverTile,
      zoneColorBufRef.current,
      zoneIdBufRef.current,
    );
    zoneColorBufRef.current = packed.colorData;
    zoneIdBufRef.current = packed.idData;
    const kingdomColors = extractKingdomColorsMap(worldZones, simRef.current);
    return {
      colorData: packed.colorData,
      idData: packed.idData,
      anyActive: packed.anyActive,
      kingdomsActive: Boolean(activeZones.kingdoms),
      kingsActive: Boolean(activeZones.kings),
      version: zoneOverlayVersionRef.current,
      labels: packed.labels,
      kingdomColors,
    };
  }, [worldZones, activeZones, anyZoneActive, zoneHighlightHoverTile]);

  const handleToggleZone = useCallback((zoneType: ZoneOverlayType, label: string) => {
    setActiveZones((prev) => {
      const nextVal = !prev[zoneType];
      setStatusFeedback(`${label}: ${nextVal ? 'ON' : 'OFF'}`);
      if (zoneType === 'kingdoms') {
        return { ...prev, kingdoms: nextVal, kings: nextVal };
      }
      return { ...prev, [zoneType]: nextVal };
    });
    soundEngine.playClick();
  }, []);

  const currentEpoch = EPOCHS[sim.epochIndex] || EPOCHS[0];
  const nextEpoch = sim.epochIndex < EPOCHS.length - 1 ? EPOCHS[sim.epochIndex + 1] : null;
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
    <main className="relative w-screen h-screen overflow-hidden bg-[#141210] text-[#f2ece1]">
      {/* 3D Pixelated Isometric World Canvas */}
      <IsometricWorldCanvas
        key={sim.gridSize}
        simRef={simRef}
        gameState={gameState}
        timeScale={timeScale}
        activeTool={activeTool}
        brushRadius={brushRadius}
        brushInputMode={brushInputMode}
        pixelScale={pixelScale}
        lightingPreset={lightingPreset}
        graphicsSettings={graphicsSettings}
        cameraActionRef={cameraActionRef}
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
      />

      {/* TITLE SCREEN OVERLAY */}
      {gameState === 'title' && (
        <div className="fixed inset-0 z-30 pointer-events-none flex items-center justify-center p-4">
          {/* LEFT COLLAPSIBLE UPDATE LOG */}
          <aside
            aria-label="Update Log"
            data-testid="start-update-log"
            className="pointer-events-auto fixed left-4 top-4 z-30"
          >
            {updateLogCollapsed ? (
              <button
                type="button"
                data-testid="toggle-update-log"
                onClick={() => {
                  setUpdateLogCollapsed(false);
                  soundEngine.playClick();
                }}
                className="px-panel px-3 py-2 flex items-center gap-2 text-xs font-semibold text-[#e8e0d2] cursor-pointer hover:text-[#f5b742]"
              >
                <HudPixelIcon kind="log" className="w-4 h-4 text-[#f5b742]" />
                <span>Updates</span>
              </button>
            ) : (
              <div className="px-panel w-60 p-4">
                <div className="flex items-center justify-between mb-3">
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

                <div className="space-y-3.5 text-xs">
                  {UPDATE_LOG_ENTRIES.map((entry) => (
                    <div key={entry.version}>
                      <div className="font-bold text-[#e8e0d2] tabular-nums mb-1">
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
            className="pointer-events-auto fixed left-4 bottom-4 z-30 text-xs text-[#cfc6b8] tabular-nums select-none drop-shadow-[0_2px_0_#0b0a09]"
          >
            Godmulator {GAME_VERSION}
          </div>

          {/* MAIN START MENU (Optically Centered) */}
          {titleMenuStep === 'main' && (
            <div
              data-testid="start-menu-main"
              className="pointer-events-auto w-full max-w-[280px] px-panel p-6 -translate-y-3 flex flex-col items-center gap-6"
            >
              <TitleEmblemSvg centered />

              <div className="w-full flex flex-col gap-2.5">
                <button
                  type="button"
                  data-start="true"
                  data-testid="start-play-btn"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('create_world');
                  }}
                  className="px-btn-primary w-full min-h-[44px] py-2.5 text-base font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd166]"
                >
                  Play
                </button>

                <button
                  type="button"
                  data-testid="start-settings-btn"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('settings');
                  }}
                  className="px-btn w-full min-h-[44px] py-2.5 text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd166]"
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
                  className="px-btn w-full min-h-[44px] py-2.5 text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd166]"
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
              className="pointer-events-auto w-full max-w-md px-panel p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#f5b742]">Create World</h2>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('main');
                  }}
                  className="text-xs text-[#b8afa2] hover:text-[#f2ece1] cursor-pointer"
                >
                  Back
                </button>
              </div>

              {/* Name & Seed */}
              <div className="grid grid-cols-2 gap-3 text-xs">
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
                          'Aethelgard',
                          'Terra',
                          'Helios',
                          'Solaria',
                          'Eldoria',
                          'Pangaea',
                          'Hyperion',
                          'Valkyria',
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

              {/* Templates */}
              <div>
                <div className="text-xs text-[#b8afa2] mb-1.5">Template</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
              </div>

              {/* Map Size Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <label htmlFor="map-size-slider" className="text-[#b8afa2]">
                    Map Size
                  </label>
                  <span className="font-bold text-[#f2ece1] tabular-nums">
                    {worldConfig.gridSize}×{worldConfig.gridSize}
                  </span>
                </div>
                <input
                  id="map-size-slider"
                  data-testid="map-size-slider"
                  type="range"
                  min={64}
                  max={256}
                  step={32}
                  value={worldConfig.gridSize}
                  onChange={(e) => {
                    const nextSize = Number(e.target.value);
                    setWorldConfig((prev) => ({ ...prev, gridSize: nextSize }));
                    soundEngine.playClick();
                  }}
                  className="px-range w-full"
                />
                <div className="flex justify-between text-[11px] text-[#8f8478] tabular-nums mt-1">
                  <span>64</span>
                  <span>128</span>
                  <span>192</span>
                  <span>256</span>
                </div>
                {worldConfig.gridSize === 256 && (
                  <div
                    data-testid="beefy-computer-warning"
                    className="text-xs text-[#ff8f6b] font-semibold mt-1.5"
                  >
                    Only for beefy computers!
                  </div>
                )}
              </div>

              {/* Custom Geography (Progressive Disclosure when Custom is active) */}
              {worldConfig.template === 'custom' && (
                <div className="grid grid-cols-3 gap-2.5 text-xs pt-1">
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
                  World Rules →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: INITIAL WORLD RULES */}
          {titleMenuStep === 'world_rules' && (
            <div
              data-testid="world-rules-modal"
              className="pointer-events-auto w-full max-w-md px-panel p-6 space-y-5"
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
                <div className="grid grid-cols-2 gap-1.5 max-h-[210px] overflow-y-auto pr-0.5">
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
                  Create World →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: LOADING WORLD */}
          {titleMenuStep === 'loading_world' && (
            <div
              data-testid="loading-world-modal"
              className="pointer-events-auto w-full max-w-xs px-panel p-6 text-center space-y-3"
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
              className="pointer-events-auto w-full max-w-md px-panel p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#f5b742]">Settings</h2>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('main');
                  }}
                  className="text-xs text-[#b8afa2] hover:text-[#f2ece1] cursor-pointer"
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
              className="pointer-events-auto w-full max-w-sm px-panel p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#f5b742]">Credits</h2>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTitleMenuStep('main');
                  }}
                  className="text-xs text-[#b8afa2] hover:text-[#f2ece1] cursor-pointer"
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
                  <div>WASD / Arrows / Right-Drag — Pan</div>
                  <div>Scroll — Zoom</div>
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
        </div>
      )}

      {/* PLAYING HUD OVERLAY */}
      {gameState !== 'title' && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-2.5 md:p-3">
          {/* TOP BAR: Compact Age + Clean Resource Row + Speed & Controls */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            {/* Top-Left: Age, Year, Pop */}
            <div className="pointer-events-auto px-panel px-3 py-1.5 flex items-center gap-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-sm text-[#f5b742] whitespace-nowrap">
                    {currentEpoch.name}
                  </span>
                  <span className="font-pixel-num text-[11px] text-[#e8e0d2] whitespace-nowrap">
                    {formatYearLabel(sim.year)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-[#b8afa2] tabular-nums mt-0.5">
                  <span>
                    Pop <span className="font-pixel-num text-[10px]">{sim.population}/{sim.populationCap}</span>
                  </span>
                  <span className="font-pixel-num text-[10px]">{Math.round(sim.happiness)}%</span>
                  {sim.goldenAgeTimer > 0 && (
                    <span className="text-[#ffd166]">{Math.ceil(sim.goldenAgeTimer)}s</span>
                  )}
                </div>
              </div>

              {nextEpoch && (
                <button
                  type="button"
                  onClick={() => handleAdvanceEpoch(true)}
                  className="px-btn-primary px-2.5 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                  title={`Advance to ${nextEpoch.name}`}
                >
                  Next Age
                </button>
              )}
            </div>

            {/* Top-Center: Clean Pixel Icon + Count Resource Strip */}
            <div className="pointer-events-auto px-panel px-2.5 py-1.5 flex items-center gap-2.5 md:gap-3.5">
              {RESOURCE_KEYS.map(({ key, label }) => {
                const amount = Math.floor(sim.resources[key]);
                const rate = Math.round(sim.rates[key]);
                const rateText = rate >= 0 ? `+${rate}/s` : `${rate}/s`;
                return (
                  <div
                    key={key}
                    data-testid={`resource-${key}`}
                    title={`${label}: ${amount} (${rateText})`}
                    className="flex flex-col items-center min-w-[34px]"
                  >
                    <ResourceIconSvg resource={key} className="w-4 h-4 pixelated-canvas" />
                    <span className="font-pixel-num text-[10px] text-[#f2ece1] leading-tight mt-0.5">
                      {amount}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Top-Right: Time Speed + Pixel Icon Utilities */}
            <div className="pointer-events-auto px-panel px-2 py-1.5 flex items-center gap-1">
              {[0, 0.5, 1, 2, 5, 10].map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => {
                    setTimeScale(scale);
                    soundEngine.playClick();
                  }}
                  title={
                    scale === 0
                      ? 'Pause time'
                      : scale === 0.5
                        ? '0.5x (1 year / 2s)'
                        : `${scale}x (${scale} ${scale === 1 ? 'year' : 'years'} / sec)`
                  }
                  className={`px-2 py-1 font-pixel-num text-[11px] cursor-pointer whitespace-nowrap shrink-0 ${
                    timeScale === scale ? 'px-btn-active font-bold' : 'px-btn'
                  }`}
                >
                  {scale}x
                </button>
              ))}

              <span className="w-1" aria-hidden="true" />

              <button
                type="button"
                onClick={() => {
                  cameraActionRef.current.rotateDelta -= Math.PI / 4;
                  soundEngine.playClick();
                }}
                className="px-btn w-7 h-7 flex items-center justify-center cursor-pointer"
                aria-label="Rotate Left"
                title="Rotate Left"
              >
                <HudPixelIcon kind="rotateLeft" />
              </button>
              <button
                type="button"
                onClick={() => {
                  cameraActionRef.current.centerHome = true;
                  soundEngine.playClick();
                }}
                className="px-btn w-7 h-7 flex items-center justify-center cursor-pointer"
                aria-label="Center Camera"
                title="Center on Town"
              >
                <HudPixelIcon kind="center" />
              </button>
              <button
                type="button"
                onClick={() => {
                  cameraActionRef.current.rotateDelta += Math.PI / 4;
                  soundEngine.playClick();
                }}
                className="px-btn w-7 h-7 flex items-center justify-center cursor-pointer"
                aria-label="Rotate Right"
                title="Rotate Right"
              >
                <HudPixelIcon kind="rotateRight" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setChronicleOpen((prev) => !prev);
                  soundEngine.playClick();
                }}
                className={`w-7 h-7 flex items-center justify-center cursor-pointer ${
                  chronicleOpen ? 'px-btn-active' : 'px-btn'
                }`}
                aria-label="World Log"
                title="World Log"
              >
                <HudPixelIcon kind="log" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleToggleMute();
                }}
                className="px-btn w-7 h-7 flex items-center justify-center cursor-pointer"
                aria-label={muted ? 'Unmute' : 'Mute'}
                title={muted ? 'Unmute' : 'Mute'}
              >
                <HudPixelIcon kind={muted ? 'audioOff' : 'audioOn'} />
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleRestartGame();
                }}
                className="px-btn w-7 h-7 flex items-center justify-center cursor-pointer"
                aria-label="Reset World"
                title="New World"
              >
                <HudPixelIcon kind="reset" />
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
                className={`w-7 h-7 flex items-center justify-center cursor-pointer ${
                  gameState === 'paused' ? 'px-btn-active' : 'px-btn'
                }`}
                aria-label="Settings"
                title="Settings"
              >
                <HudPixelIcon kind="settings" />
              </button>
            </div>
          </div>

          {/* WORLD LOG DRAWER */}
          {chronicleOpen && (
            <div className="pointer-events-auto self-end w-full max-w-sm px-panel p-3 max-h-56 overflow-y-auto">
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

          {/* ENTITY & ZONE INSPECTOR PANEL (visible on Inspect tab during play) */}
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

          {/* BOTTOM PIXEL TOOLBAR DOCK */}
          <div className="pointer-events-auto self-center relative flex flex-col items-center max-w-full">
            {/* Hover Tooltip */}
            {!dockCollapsed && hoveredHint && (
              <div className="px-panel px-3 py-1.5 mb-2 flex items-center gap-3 text-xs whitespace-nowrap pointer-events-none">
                <span className="font-bold text-[#f5b742]">{hoveredHint.title}</span>
                <span className="text-[#80ed99] font-semibold tabular-nums">{hoveredHint.cost}</span>
                <span className="text-[#cfc6b8]">{hoveredHint.detail}</span>
              </div>
            )}

            {/* Folder Tabs Row */}
            <div className="flex items-end justify-between w-full gap-2 px-1">
              <div className="flex items-end gap-1" role="tablist" aria-label="Tools">
                {(
                  [
                    { id: 'powers', label: 'Powers' },
                    { id: 'terrain', label: 'Land' },
                    { id: 'build', label: 'Build' },
                    { id: 'spawn', label: 'Units' },
                    { id: 'zones', label: 'Zones' },
                    { id: 'rules', label: 'God Rules' },
                    { id: 'epochs', label: 'World' },
                    { id: 'inspect', label: 'Inspect' },
                  ] as { id: ToolCategory; label: string }[]
                ).map((tab) => {
                  const isActive = !dockCollapsed && activeCategory === tab.id;
                  const activeZoneCount =
                    tab.id === 'zones'
                      ? Number(activeZones.kingdoms) +
                        Number(activeZones.kings) +
                        Number(activeZones.territories) +
                        Number(activeZones.biomes) +
                        Number(activeZones.temperature)
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
                        setActiveCategory(tab.id);
                        if (tab.id === 'inspect') {
                          setActiveTool({ kind: 'inspect' });
                        } else if (tab.id === 'zones' || tab.id === 'rules') {
                          // Switch to non-destructive inspect cursor while browsing zones or God Rules
                          setActiveTool({ kind: 'inspect' });
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
                      className={`px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                        isActive ? 'px-tab-active' : 'px-tab'
                      }`}
                    >
                      <TabPixelIcon category={tab.id} className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                      {activeZoneCount > 0 && (
                        <span className="font-pixel-num text-[9px] text-[#80ed99] tabular-nums">
                          {activeZoneCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-end gap-1.5 pb-1">
                {(activeCategory === 'powers' ||
                  activeCategory === 'terrain' ||
                  activeCategory === 'build' ||
                  activeCategory === 'spawn') && (
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
                    className={`px-2 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                      brushInputMode === 'hold' ? 'px-btn-active text-[#80ed99]' : 'px-btn text-[#e8e0d2]'
                    }`}
                    title="Switch between Hold-to-Paint/Cast and Single Tap"
                  >
                    {brushInputMode === 'hold' ? 'Hold' : 'Tap'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDockCollapsed((prev) => !prev)}
                  className="px-btn px-2.5 py-1 text-xs font-semibold text-[#f5b742] cursor-pointer whitespace-nowrap shrink-0"
                  title="Toggle Dock (H)"
                >
                  {dockCollapsed ? 'Show [H]' : 'Hide [H]'}
                </button>
              </div>
            </div>

            {/* Active Pixel Dock Panel */}
            {!dockCollapsed && (
              <div
                className="px-panel px-3 py-2.5 max-w-[740px] w-full max-h-[148px] min-h-[72px] overflow-y-auto overflow-x-hidden pr-1"
                onMouseLeave={() => setHoveredHint(null)}
              >
                {/* TAB 1: POWERS (Icon Slots) */}
                {activeCategory === 'powers' && (
                  <div className="flex flex-wrap items-center justify-start gap-1.5">
                    {GOD_POWERS.map((power) => {
                      const isSelected =
                        activeTool.kind === 'power' && activeTool.power === power.type;
                      const affordable =
                        sim.sandboxFreeMode || sim.resources.faith >= power.faithCost;
                      return (
                        <button
                          key={power.type}
                          type="button"
                          onClick={() => {
                            setActiveTool({ kind: 'power', power: power.type });
                            soundEngine.playClick();
                            setStatusFeedback(power.name);
                          }}
                          onMouseEnter={() =>
                            setHoveredHint({
                              title: power.name,
                              cost: sim.sandboxFreeMode ? 'Free' : `${power.faithCost} Faith`,
                              detail: power.summary,
                            })
                          }
                          aria-label={power.name}
                          className={`relative w-11 h-11 flex items-center justify-center cursor-pointer ${
                            isSelected ? 'px-slot-active' : 'px-slot'
                          } ${!affordable ? 'opacity-55' : ''}`}
                        >
                          <PowerPixelIcon power={power.type} className="w-7 h-7" />
                          {!sim.sandboxFreeMode && (
                            <span className="absolute bottom-0.5 right-1 font-pixel-num text-[8px] text-[#ffd166] leading-none">
                              {power.faithCost}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* TAB 2: LAND SCULPTING (Icon Slots + Brush Size) */}
                {activeCategory === 'terrain' && (
                  <div className="flex flex-wrap items-center justify-start gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {TERRAIN_TOOLS.map((tool) => {
                        const isSelected =
                          activeTool.kind === 'terrain' && activeTool.tool === tool.type;
                        return (
                          <button
                            key={tool.type}
                            type="button"
                            onClick={() => {
                              setActiveTool({ kind: 'terrain', tool: tool.type });
                              soundEngine.playClick();
                              setStatusFeedback(tool.name);
                            }}
                            onMouseEnter={() =>
                              setHoveredHint({
                                title: tool.name,
                                cost: sim.sandboxFreeMode ? 'Free' : `${tool.faithCost} Faith`,
                                detail: tool.summary,
                              })
                            }
                            aria-label={tool.name}
                            className={`relative w-11 h-11 flex items-center justify-center cursor-pointer ${
                              isSelected ? 'px-slot-active' : 'px-slot'
                            }`}
                          >
                            <TerrainPixelIcon tool={tool.type} className="w-7 h-7" />
                            {!sim.sandboxFreeMode && (
                              <span className="absolute bottom-0.5 right-1 font-pixel-num text-[8px] text-[#ffd166] leading-none">
                                {tool.faithCost}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1 pl-2">
                      <span className="text-xs text-[#a89f91] mr-1">Size</span>
                      {[1, 2, 3].map((size) => {
                        const radiusVal = size - 1;
                        return (
                          <button
                            key={size}
                            type="button"
                            data-testid={`land-size-${size}x`}
                            onClick={() => {
                              setBrushRadius(radiusVal);
                              soundEngine.playClick();
                            }}
                            className={`px-2 py-1 font-pixel-num text-[11px] cursor-pointer ${
                              brushRadius === radiusVal ? 'px-btn-active font-bold' : 'px-btn'
                            }`}
                          >
                            {size}x
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 3: BUILD STRUCTURES (Icon Slots) */}
                {activeCategory === 'build' && (
                  <div className="flex flex-wrap items-center justify-start gap-1.5">
                    {BUILDINGS.map((bld) => {
                      const isSelected =
                        activeTool.kind === 'build' && activeTool.building === bld.type;
                      const affordable = canAfford(sim.resources, bld.cost, sim.sandboxFreeMode);
                      const badge = primaryCostNumber(bld.cost, sim.sandboxFreeMode);

                      return (
                        <button
                          key={bld.type}
                          type="button"
                          onClick={() => {
                            setActiveTool({ kind: 'build', building: bld.type });
                            soundEngine.playClick();
                            setStatusFeedback(bld.name);
                          }}
                          onMouseEnter={() =>
                            setHoveredHint({
                              title: bld.name,
                              cost: formatCompactCost(bld.cost, sim.sandboxFreeMode),
                              detail: bld.roleSummary,
                            })
                          }
                          aria-label={bld.name}
                          className={`relative w-11 h-11 flex items-center justify-center cursor-pointer ${
                            isSelected ? 'px-slot-active' : 'px-slot'
                          } ${!affordable ? 'opacity-55' : ''}`}
                        >
                          <BuildingPixelIcon building={bld.type} className="w-7 h-7" />
                          {badge && (
                            <span className="absolute bottom-0.5 right-1 font-pixel-num text-[8px] text-[#f5b742] leading-none">
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
                  <div className="flex flex-wrap items-center justify-start gap-2">
                    <div className="flex flex-wrap items-center justify-start gap-1.5">
                      {SPECIES_UNITS.filter(
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
                              setActiveTool({ kind: 'spawn', unit: u.role });
                              soundEngine.playClick();
                              setStatusFeedback(u.name);
                            }}
                            onMouseEnter={() =>
                              setHoveredHint({
                                title: u.name,
                                cost: formatCompactCost(u.cost, isFree),
                                detail: u.roleSummary,
                              })
                            }
                            aria-label={u.name}
                            className={`relative px-2.5 h-11 flex items-center gap-2 cursor-pointer ${
                              isSelected ? 'px-slot-active' : 'px-slot'
                            }`}
                          >
                            <UnitPixelIcon role={u.role} className="w-7 h-7" />
                            <span className="text-xs font-bold text-[#f2ece1] whitespace-nowrap">
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

                      <span className="w-px h-7 bg-[#3a332b] mx-0.5 hidden sm:inline-block" aria-hidden="true" />

                      {[
                        ...ANIMAL_UNITS.filter(
                          (u) => sim.worldRules?.allowDinosaurs !== false || u.role !== 'dinosaur',
                        ),
                        ...(sim.worldRules?.allowFantasy !== false ? MYTHICAL_BEAST_UNITS : []),
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
                              setActiveTool({ kind: 'spawn', unit: u.role });
                              soundEngine.playClick();
                              setStatusFeedback(u.name);
                            }}
                            onMouseEnter={() =>
                              setHoveredHint({
                                title: isMythic ? `${u.name} (Mythical Beast)` : u.name,
                                cost: formatCompactCost(u.cost, isFree),
                                detail: u.roleSummary,
                              })
                            }
                            aria-label={u.name}
                            className={`relative w-11 h-11 flex items-center justify-center cursor-pointer ${
                              isSelected ? 'px-slot-active' : 'px-slot'
                            }`}
                          >
                            <UnitPixelIcon role={u.role} className="w-7 h-7" />
                            {badge && (
                              <span className="absolute bottom-0.5 right-1 font-pixel-num text-[8px] text-[#ffd166] leading-none">
                                {badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 5: ZONES (Toggle Buttons for Kingdoms, Kings, Animal Territories, Biomes, Temperatures) */}
                {activeCategory === 'zones' && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Zone Overlays">
                      {(
                        [
                          {
                            id: 'kingdoms' as ZoneOverlayType,
                            label: 'Kingdoms & Cities',
                            shortLabel: 'Kingdoms',
                            count: worldZones ? worldZones.kingdomsById.size : 0,
                            summary:
                              'Toggle dynamic land & maritime sea borders and population counts for all Cities & Kingdoms',
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
                            shortLabel: 'Temperatures',
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
                            className={`relative px-2.5 h-11 flex items-center gap-2 cursor-pointer transition-colors ${
                              isOn ? 'px-slot-active' : 'px-slot'
                            }`}
                          >
                            <ZonePixelIcon zone={zItem.id} className="w-7 h-7 shrink-0" />
                            <div className="flex flex-col items-start leading-tight">
                              <span className="text-xs font-bold text-[#f2ece1] whitespace-nowrap">
                                {zItem.shortLabel}
                              </span>
                              <span
                                className={`font-pixel-num text-[9px] tabular-nums ${
                                  isOn ? 'text-[#80ed99]' : 'text-[#9e9486]'
                                }`}
                              >
                                {isOn ? `ON · ${zItem.count}` : 'OFF'}
                              </span>
                            </div>
                          </button>
                        );
                      })}

                      {anyZoneActive && (
                        <button
                          type="button"
                          data-testid="zone-clear-all"
                          onClick={() => {
                            setActiveZones({ ...DEFAULT_ZONE_TOGGLES });
                            setStatusFeedback('All zone overlays hidden');
                            soundEngine.playClick();
                          }}
                          className="px-btn px-2.5 h-9 text-xs text-[#ff8f6b] cursor-pointer whitespace-nowrap"
                          title="Turn off all zone overlays"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 5B: GOD RULES (Live World Laws) */}
                {activeCategory === 'rules' && (
                  <div
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5"
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
                          className={`px-2.5 h-9 flex items-center justify-between gap-2 text-[11px] cursor-pointer ${
                            isOn
                              ? 'px-slot-active font-bold text-[#f2ece1]'
                              : 'px-slot text-[#9d9486]'
                          }`}
                        >
                          <span className="truncate">{rule.label}</span>
                          <span
                            className={`w-2.5 h-2.5 border border-[#0b0a09] shrink-0 ${
                              isOn ? 'bg-[#80ed99]' : 'bg-[#34302a]'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* TAB 6: WORLD (Ages, Sky, Seed) */}
                {activeCategory === 'epochs' && (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {EPOCHS.map((ep) => {
                        const isCurrent = sim.epochIndex === ep.index;
                        return (
                          <button
                            key={ep.id}
                            type="button"
                            onClick={() => {
                              simRef.current.epochIndex = ep.index;
                              for (const b of simRef.current.buildings) {
                                b.epochLevel = ep.index;
                              }
                              soundEngine.playEpochAscend();
                              setStatusFeedback(ep.name);
                              setHudTick((t) => t + 1);
                            }}
                            className={`px-2.5 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                              isCurrent ? 'px-btn-active' : 'px-btn'
                            }`}
                          >
                            {ep.name}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-[#a89f91]">Sky</span>
                        {(['auto', 'noon', 'dusk', 'night', 'dawn'] as LightingPreset[]).map((lp) => {
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
                                setHudTick((t) => t + 1);
                              }}
                              className={`px-2 py-0.5 capitalize text-xs cursor-pointer ${
                                isSkyActive ? 'px-btn-active font-bold' : 'px-btn'
                              }`}
                            >
                              {lp === 'auto' ? 'Cycle' : lp}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[#a89f91]">Seed</span>
                        <input
                          type="text"
                          aria-label="World Seed"
                          value={seedInput}
                          onChange={(e) => setSeedInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleGenerateSeededWorld(seedInput || undefined);
                            }
                          }}
                          className="px-panel-inset w-24 px-2 py-0.5 font-pixel-num text-[11px] text-[#f2ece1] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleGenerateSeededWorld(seedInput || undefined)}
                          className="px-btn px-2 py-0.5 text-xs text-[#f5b742] cursor-pointer"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenerateSeededWorld(undefined)}
                          className="px-btn px-2 py-0.5 text-xs cursor-pointer"
                        >
                          Random
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 7: INSPECT */}
                {activeCategory === 'inspect' && (
                  <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-[#e8e0d2]">
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
                          <span className="text-[#80ed99] font-semibold">
                            Kingdom: {hoveredZoneInfo.kingdom.name} (Pop {hoveredZoneInfo.kingdom.population}
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
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#0d0c0b]/75 p-4"
        >
          <div className="w-full max-w-md px-panel p-6 space-y-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold text-[#f5b742]">Settings</h2>
              <span className="text-xs text-[#b8afa2] tabular-nums">
                {currentEpoch.name} ({formatYearLabel(sim.year)})
              </span>
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
                onClick={() => {
                  soundEngine.playClick();
                  handleRestartGame();
                }}
                className="px-btn w-full py-2 text-xs font-semibold cursor-pointer"
              >
                Restart World
              </button>
              <button
                type="button"
                data-testid="ingame-main-menu-btn"
                onClick={() => {
                  soundEngine.playClick();
                  setTitleMenuStep('main');
                  setGameState('title');
                }}
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
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#0d0c0b]/80 p-4"
        >
          <div className="w-full max-w-sm px-panel p-6">
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
                onClick={handleRestartGame}
                className="px-btn px-4 py-2 text-sm cursor-pointer"
              >
                New World
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
