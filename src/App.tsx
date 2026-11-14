import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BUILDINGS,
  EPOCHS,
  GOD_POWERS,
  SPECIES_UNITS,
  TERRAIN_TOOLS,
  UNITS,
} from './game/catalog';
import {
  advanceEpoch,
  applyTerrainTool,
  canAfford,
  castGodPower,
  createInitialSimulationState,
  formatYearLabel,
  getTile,
  placeBuilding,
  spawnRaiderWave,
  spawnUnit,
} from './game/simulation';
import { soundEngine } from './game/sound';
import {
  ActiveTool,
  GameLifecycleState,
  LightingPreset,
  Resources,
  ToolCategory,
} from './game/types';
import {
  BuildingPixelIcon,
  HudPixelIcon,
  PowerPixelIcon,
  ResourceIconSvg,
  TabPixelIcon,
  TerrainPixelIcon,
  TitleEmblemSvg,
  UnitPixelIcon,
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
  const [brushRadius, setBrushRadius] = useState<number>(1);
  const pixelScale = 3;
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('noon');
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [chronicleOpen, setChronicleOpen] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [hoverTile, setHoverTile] = useState<{ x: number; z: number } | null>({ x: 64, z: 64 });
  const [hoveredHint, setHoveredHint] = useState<HoveredHint | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string>('Click land to spawn a Human');

  // Snapshot counter triggered at <= 6 Hz from canvas loop or user actions
  const [, setHudTick] = useState(0);
  const syncHud = useCallback(() => {
    const s = simRef.current;
    if (s.outcome === 'ascension_victory' && gameState === 'playing') {
      setGameState('gameover');
    }
    setHudTick((t) => t + 1);
  }, [gameState]);

  const cameraActionRef = useRef({
    rotateDelta: 0,
    zoomDelta: 0,
    centerHome: false,
  });

  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  const handleStartGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    soundEngine.playEpochAscend();
    document.body.dataset.state = 'playing';
    setGameState('playing');
  }, []);

  const handleGenerateSeededWorld = useCallback((explicitSeed?: string | number) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const nextSim = createInitialSimulationState(128, explicitSeed);
    simRef.current = nextSim;
    setSeedInput(String(nextSim.seed));
    setHoverTile({ x: 64, z: 64 });
    setActiveCategory('spawn');
    setActiveTool({ kind: 'spawn', unit: 'human' });
    soundEngine.playBuild();
    setStatusFeedback(`Seed ${nextSim.seed} ready`);
    setHudTick((t) => t + 1);
  }, []);

  const handleRestartGame = useCallback(() => {
    handleGenerateSeededWorld(undefined);
    document.body.dataset.state = 'playing';
    setGameState('playing');
  }, [handleGenerateSeededWorld]);

  const handleToggleMute = useCallback(() => {
    soundEngine.muted = !soundEngine.muted;
    setMuted(soundEngine.muted);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (gameState === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartGame();
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        setGameState((prev) => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev));
        return;
      }

      if (gameState !== 'playing') return;

      if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      } else if (e.code === 'KeyM') {
        handleToggleMute();
      } else if (e.code === 'Space') {
        e.preventDefault();
        setTimeScale((prev) => (prev === 0 ? 1 : 0));
      } else if (e.code === 'BracketLeft') {
        cameraActionRef.current.rotateDelta -= Math.PI / 4;
      } else if (e.code === 'BracketRight') {
        cameraActionRef.current.rotateDelta += Math.PI / 4;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, handleStartGame, handleToggleMute]);

  const handleTileInteract = useCallback(
    (tileX: number, tileZ: number) => {
      const sim = simRef.current;
      sim.selectedTile = { x: tileX, z: tileZ };

      if (activeTool.kind === 'inspect') {
        const tile = getTile(sim, tileX, tileZ);
        const nearbyRoadster = (sim.vehicles ?? []).find(
          (v) => v.type === 'roadster' && Math.hypot(v.x - tileX, v.z - tileZ) <= 1.15,
        );
        const nearbyUnit = sim.units.find(
          (u) => u.state !== 'ko' && Math.hypot(u.x - tileX, u.z - tileZ) <= 0.85,
        );
        const bld = sim.buildings.find((b) => b.tileX === tileX && b.tileZ === tileZ);
        if (nearbyRoadster) {
          const modeLabel =
            nearbyRoadster.stuntPhase && nearbyRoadster.stuntPhase !== 'cruise'
              ? `Propulsion Stunt: ${nearbyRoadster.stuntPhase.replace('_', ' ')}`
              : 'Cruising with SpaceX Thrusters Armed';
          setStatusFeedback(`Tesla Roadster Easter Egg (${modeLabel})`);
        } else if (nearbyUnit) {
          const label =
            nearbyUnit.ageStage === 'child'
              ? `${nearbyUnit.species} child`
              : `${nearbyUnit.species} ${nearbyUnit.role}`;
          setStatusFeedback(`${nearbyUnit.name} (${label}, ${Math.round(nearbyUnit.hp)}/${nearbyUnit.maxHp} HP)`);
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
          if (activeTool.power === 'meteor_strike') soundEngine.playMeteorIncoming();
          else if (activeTool.power === 'earthquake') soundEngine.playEarthquake();
          else soundEngine.playClick();
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

  const sim = simRef.current;
  const currentEpoch = EPOCHS[sim.epochIndex] || EPOCHS[0];
  const nextEpoch = sim.epochIndex < EPOCHS.length - 1 ? EPOCHS[sim.epochIndex + 1] : null;
  const inspectedTile = hoverTile ? getTile(sim, hoverTile.x, hoverTile.z) : null;
  const inspectedBuilding = hoverTile
    ? sim.buildings.find((b) => b.tileX === hoverTile.x && b.tileZ === hoverTile.z)
    : undefined;
  const hostileCount = sim.units.filter((u) => u.faction === 'hostile' && u.state !== 'ko').length;

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
        simRef={simRef}
        gameState={gameState}
        timeScale={timeScale}
        activeTool={activeTool}
        brushRadius={brushRadius}
        pixelScale={pixelScale}
        lightingPreset={lightingPreset}
        cameraActionRef={cameraActionRef}
        onTileInteract={handleTileInteract}
        onHoverTileChange={setHoverTile}
        onSyncHud={syncHud}
      />

      {/* TITLE SCREEN OVERLAY */}
      {gameState === 'title' && (
        <div className="fixed inset-0 z-30 flex items-center justify-start px-6 md:px-14 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm px-panel p-6">
            <TitleEmblemSvg />
            <p className="text-sm text-[#cfc6b8] mb-5 leading-snug">
              Shape the land, spawn Humans, Elves, or Orcs, and guide towns to the stars.
            </p>

            <div className="flex items-center gap-3 mb-5">
              <button
                type="button"
                data-start="true"
                onClick={handleStartGame}
                className="px-btn-primary px-6 py-2.5 text-sm font-bold cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#ffd166]"
              >
                Play
              </button>
              <button
                type="button"
                onClick={() => {
                  simRef.current.sandboxFreeMode = true;
                  handleStartGame();
                }}
                className="px-btn px-5 py-2.5 text-sm font-semibold cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#ffd166]"
              >
                Sandbox
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4 text-xs">
              <label htmlFor="title-seed-input" className="text-[#a89f91] shrink-0">
                Seed
              </label>
              <input
                id="title-seed-input"
                type="text"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleGenerateSeededWorld(seedInput || undefined);
                  }
                }}
                className="px-panel-inset w-28 px-2 py-1.5 text-xs text-[#f2ece1] font-pixel-num outline-none focus:ring-2 focus:ring-[#f5b742]"
                placeholder="Seed"
              />
              <button
                type="button"
                onClick={() => handleGenerateSeededWorld(seedInput || undefined)}
                className="px-btn px-2.5 py-1.5 text-xs font-semibold text-[#f5b742] cursor-pointer whitespace-nowrap shrink-0"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => handleGenerateSeededWorld(undefined)}
                className="px-btn px-2.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                Random
              </button>
            </div>

            <div className="text-xs text-[#9e9486]">
              WASD Pan / Scroll Zoom / Space Pause / H Hide UI
            </div>
          </div>
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
                  {hostileCount > 0 && (
                    <span className="text-[#ff6b6b]">Foes {hostileCount}</span>
                  )}
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
              {[0, 1, 2, 5, 10].map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => {
                    setTimeScale(scale);
                    soundEngine.playClick();
                  }}
                  title={scale === 1 ? '1x (1 year / 10s)' : `${scale}x speed`}
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
                title="Rotate Left ([)"
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
                title="Rotate Right (])"
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
                title={muted ? 'Unmute (M)' : 'Mute (M)'}
              >
                <HudPixelIcon kind={muted ? 'audioOff' : 'audioOn'} />
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setGameState((prev) => (prev === 'paused' ? 'playing' : 'paused'));
                }}
                className="px-btn w-7 h-7 flex items-center justify-center cursor-pointer"
                aria-label="Pause"
                title="Pause (P)"
              >
                <HudPixelIcon kind={gameState === 'paused' ? 'play' : 'pause'} />
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
                    { id: 'epochs', label: 'World' },
                    { id: 'inspect', label: 'Inspect' },
                  ] as { id: ToolCategory; label: string }[]
                ).map((tab) => {
                  const isActive = !dockCollapsed && activeCategory === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => {
                        setDockCollapsed(false);
                        setActiveCategory(tab.id);
                        if (tab.id === 'inspect') {
                          setActiveTool({ kind: 'inspect' });
                        } else if (tab.id === 'powers' && activeTool.kind !== 'power') {
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
                        soundEngine.playClick();
                      }}
                      className={`px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                        isActive ? 'px-tab-active' : 'px-tab'
                      }`}
                    >
                      <TabPixelIcon category={tab.id} className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-end gap-1.5 pb-1">
                <span className="hidden md:inline px-panel px-2.5 py-1 text-xs text-[#cfc6b8] tabular-nums whitespace-nowrap">
                  {activeToolLabel}
                  {inspectedTile ? ` (${inspectedTile.x}, ${inspectedTile.z})` : ''}
                </span>
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
                className="px-panel px-3 py-2.5 max-w-[95vw]"
                onMouseLeave={() => setHoveredHint(null)}
              >
                {/* TAB 1: POWERS (Icon Slots) */}
                {activeCategory === 'powers' && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
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
                              title: `${power.name} [${power.keyHint}]`,
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
                          <span className="absolute top-0.5 left-1 font-pixel-num text-[8px] text-[#9e9486] leading-none">
                            {power.keyHint}
                          </span>
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
                  <div className="flex flex-wrap items-center justify-center gap-2">
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
                      {[1, 2, 3].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setBrushRadius(r)}
                          className={`px-2 py-1 font-pixel-num text-[11px] cursor-pointer ${
                            brushRadius === r ? 'px-btn-active font-bold' : 'px-btn'
                          }`}
                        >
                          {r}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: BUILD STRUCTURES (Icon Slots) */}
                {activeCategory === 'build' && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
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

                {/* TAB 4: SPECIES UNITS (Strictly 3 Species: Human, Elf, Orc + Free Mode & Raiders) */}
                {activeCategory === 'spawn' && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {SPECIES_UNITS.map((u) => {
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
                    </div>

                    <div className="flex items-center gap-1.5 pl-2">
                      <button
                        type="button"
                        onClick={() => {
                          simRef.current.sandboxFreeMode = !simRef.current.sandboxFreeMode;
                          soundEngine.playClick();
                          setHudTick((t) => t + 1);
                        }}
                        className={`px-2.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                          sim.sandboxFreeMode ? 'px-btn-active' : 'px-btn'
                        }`}
                      >
                        {sim.sandboxFreeMode ? 'Free: On' : 'Free: Off'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          spawnRaiderWave(simRef.current);
                          soundEngine.playCurse();
                          setStatusFeedback('Raiders spawned');
                          setHudTick((t) => t + 1);
                        }}
                        className="px-btn px-2.5 py-1.5 text-xs font-semibold text-[#ff8f6b] cursor-pointer whitespace-nowrap"
                      >
                        Raiders
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 5: WORLD (Ages, Pixel Scale, Sky, Seed) */}
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
                        {(['noon', 'dusk', 'night', 'dawn'] as LightingPreset[]).map((lp) => (
                          <button
                            key={lp}
                            type="button"
                            onClick={() => setLightingPreset(lp)}
                            className={`px-2 py-0.5 capitalize text-xs cursor-pointer ${
                              lightingPreset === lp ? 'px-btn-active font-bold' : 'px-btn'
                            }`}
                          >
                            {lp}
                          </button>
                        ))}
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

                {/* TAB 6: INSPECT */}
                {activeCategory === 'inspect' && (
                  <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[#e8e0d2]">
                    <span>{statusFeedback}</span>
                    {inspectedTile && (
                      <span className="text-[#f5b742] tabular-nums">
                        ({inspectedTile.x}, {inspectedTile.z}) Height {inspectedTile.height}{' '}
                        {inspectedBuilding
                          ? `${inspectedBuilding.settlementId && sim.settlementNames?.[inspectedBuilding.settlementId] ? `${sim.settlementNames[inspectedBuilding.settlementId]} ` : ''}${inspectedBuilding.type.replace('_', ' ')}`
                          : inspectedTile.terrain.replace('_', ' ')}
                      </span>
                    )}
                    <span className="text-[#a89f91] tabular-nums">
                      Seed {sim.seed} / Built {sim.totalStructuresBuilt} / Defeated {sim.totalRaidersDefeated}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {gameState === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Paused"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#0d0c0b]/75 p-4"
        >
          <div className="w-full max-w-sm px-panel p-6">
            <h2 className="text-2xl font-bold text-[#f5b742] mb-1">Paused</h2>
            <p className="text-xs text-[#b8afa2] mb-5 tabular-nums">
              {currentEpoch.name} ({formatYearLabel(sim.year)})
            </p>

            <div className="grid grid-cols-3 gap-2 mb-6 px-panel-inset p-3 text-center">
              <div>
                <div className="font-pixel-num text-base font-bold text-[#f5b742]">{sim.population}</div>
                <div className="text-[11px] text-[#a89f91]">Pop</div>
              </div>
              <div>
                <div className="font-pixel-num text-base font-bold text-[#f2ece1]">{sim.buildings.length}</div>
                <div className="text-[11px] text-[#a89f91]">Built</div>
              </div>
              <div>
                <div className="font-pixel-num text-base font-bold text-[#56cfe1]">{sim.totalMiraclesCast}</div>
                <div className="text-[11px] text-[#a89f91]">Powers</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setGameState('playing')}
                className="px-btn-primary px-5 py-2 text-sm font-bold cursor-pointer"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={handleRestartGame}
                className="px-btn px-4 py-2 text-sm cursor-pointer"
              >
                Restart
              </button>
              <button
                type="button"
                onClick={() => setGameState('title')}
                className="px-btn px-4 py-2 text-sm cursor-pointer"
              >
                Title
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
