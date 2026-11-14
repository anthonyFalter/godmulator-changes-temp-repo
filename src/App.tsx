import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BUILDINGS,
  EPOCHS,
  GOD_POWERS,
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
  BuildingType,
  GameLifecycleState,
  GodPowerType,
  LightingPreset,
  Resources,
  ToolCategory,
  UnitRole,
} from './game/types';
import { ResourceIconSvg, TitleEmblemSvg } from './components/GameIcons';
import { IsometricWorldCanvas } from './components/IsometricWorldCanvas';

const RESOURCE_KEYS: { key: keyof Resources; label: string }[] = [
  { key: 'food', label: 'Food' },
  { key: 'wood', label: 'Wood' },
  { key: 'stone', label: 'Stone' },
  { key: 'ore', label: 'Ore' },
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'energy', label: 'Energy' },
  { key: 'alloy', label: 'Alloy' },
  { key: 'faith', label: 'Faith' },
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
    unit: 'villager',
  });
  const [brushRadius, setBrushRadius] = useState<number>(1);
  const [pixelScale, setPixelScale] = useState<number>(2);
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('noon');
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [chronicleOpen, setChronicleOpen] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [hoverTile, setHoverTile] = useState<{ x: number; z: number } | null>({ x: 64, z: 64 });
  const [statusFeedback, setStatusFeedback] = useState<string>(
    'Wilderness awaits · Click dry land to spawn Settler Citizens and spark civilization',
  );

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

  // Sync document.body.dataset.state
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
    setActiveTool({ kind: 'spawn', unit: 'villager' });
    soundEngine.playBuild();
    setStatusFeedback(`Untouched world · Seed ${nextSim.seed} · Click land to spawn Settler Citizens`);
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

  // Global keyboard shortcuts
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

  const handleTileInteract = useCallback((tileX: number, tileZ: number) => {
    const sim = simRef.current;
    sim.selectedTile = { x: tileX, z: tileZ };

    if (activeTool.kind === 'inspect') {
      const tile = getTile(sim, tileX, tileZ);
      const bld = sim.buildings.find((b) => b.tileX === tileX && b.tileZ === tileZ);
      if (bld) {
        const def = BUILDINGS.find((d) => d.type === bld.type);
        setStatusFeedback(
          `Inspecting ${def?.name ?? bld.type} · Integrity ${Math.round(bld.hp)}/${bld.maxHp}`,
        );
      } else if (tile) {
        setStatusFeedback(
          `Terrace (${tileX}, ${tileZ}) · Elevation ${tile.height} · Surface ${tile.terrain.replace('_', ' ')}`,
        );
      }
      soundEngine.playClick();
      setHudTick((t) => t + 1);
      return;
    }

    if (activeTool.kind === 'power') {
      const res = castGodPower(sim, activeTool.power, tileX, tileZ);
      if (res.ok) {
        const def = GOD_POWERS.find((p) => p.type === activeTool.power);
        if (res.isHeavy) soundEngine.playHeavyImpact();
        else if (def?.category === 'Wrathful') soundEngine.playCurse();
        else soundEngine.playBlessing();
        setStatusFeedback(`${def?.name} unleashed at (${tileX}, ${tileZ})`);
      } else {
        setStatusFeedback(res.reason || 'Cannot cast power');
      }
      setHudTick((t) => t + 1);
      return;
    }

    if (activeTool.kind === 'terrain') {
      const res = applyTerrainTool(sim, activeTool.tool, tileX, tileZ, brushRadius);
      if (res.ok) {
        const def = TERRAIN_TOOLS.find((t) => t.type === activeTool.tool);
        soundEngine.playSculpt();
        setStatusFeedback(`${def?.name} sculpted at (${tileX}, ${tileZ})`);
      } else {
        setStatusFeedback(res.reason || 'Cannot sculpt terrain');
      }
      setHudTick((t) => t + 1);
      return;
    }

    if (activeTool.kind === 'build') {
      const res = placeBuilding(sim, activeTool.building, tileX, tileZ);
      if (res.ok) {
        const def = BUILDINGS.find((b) => b.type === activeTool.building);
        soundEngine.playBuild();
        setStatusFeedback(`Built ${def?.name} at (${tileX}, ${tileZ})`);
      } else {
        setStatusFeedback(res.reason || 'Cannot place structure here');
      }
      setHudTick((t) => t + 1);
      return;
    }

    if (activeTool.kind === 'spawn') {
      const res = spawnUnit(sim, activeTool.unit, tileX, tileZ);
      if (res.ok) {
        const def = UNITS.find((u) => u.role === activeTool.unit);
        soundEngine.playSpawn();
        setStatusFeedback(`Spawned ${def?.name} at (${tileX}, ${tileZ})`);
      } else {
        setStatusFeedback(res.reason || 'Cannot spawn unit here');
      }
      setHudTick((t) => t + 1);
    }
  }, [activeTool, brushRadius]);

  const handleAdvanceEpoch = (divineLeap: boolean) => {
    const res = advanceEpoch(simRef.current, divineLeap);
    if (res.ok && res.newEpoch) {
      soundEngine.playEpochAscend();
      setStatusFeedback(`Civilization ascended to the ${res.newEpoch.name}`);
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

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#141210] text-[#ede8df]">
      {/* 3D Pixelated Isometric World Canvas (100% Full Viewport) */}
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
        <div className="fixed inset-0 z-30 flex items-center justify-start px-8 md:px-16 pointer-events-auto bg-gradient-to-r from-[#141210]/92 via-[#141210]/65 to-transparent">
          <div className="max-w-lg py-10 px-8 bg-[#181512] shadow-2xl">
            <TitleEmblemSvg />
            <p className="text-base text-[#cfc6b8] leading-relaxed mb-6">
              Sculpt terraced stone worlds, guide mortal settlements from prehistoric bonfires to interstellar Dyson relays, and wield benevolent miracles or cataclysmic wrath in a pixelated 3D isometric sandbox.
            </p>

            <div className="flex flex-wrap items-center gap-4 mb-5">
              <button
                type="button"
                data-start="true"
                onClick={handleStartGame}
                className="px-6 py-3 bg-[#d97736] hover:bg-[#e88846] text-[#141210] font-semibold text-base rounded-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Start Simulation
              </button>
              <button
                type="button"
                onClick={() => {
                  simRef.current.sandboxFreeMode = true;
                  handleStartGame();
                }}
                className="px-5 py-3 bg-[#26211c] hover:bg-[#332c25] text-[#ede8df] font-medium text-sm rounded-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Enter Free God Sandbox
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-5 text-xs">
              <label htmlFor="title-seed-input" className="text-[#9e9486]">
                World Seed
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
                className="w-32 px-2.5 py-1.5 bg-[#24201b] text-[#ede8df] tabular-nums rounded-sm outline-none focus:ring-1 focus:ring-[#f5b742]"
                placeholder="Random seed"
              />
              <button
                type="button"
                onClick={() => handleGenerateSeededWorld(seedInput || undefined)}
                className="px-2.5 py-1.5 bg-[#26211c] hover:bg-[#332c25] text-[#f5b742] font-medium rounded-sm cursor-pointer"
              >
                Apply Seed
              </button>
              <button
                type="button"
                onClick={() => handleGenerateSeededWorld(undefined)}
                className="px-2.5 py-1.5 bg-[#26211c] hover:bg-[#332c25] text-[#cfc6b8] font-medium rounded-sm cursor-pointer"
              >
                Randomize
              </button>
            </div>

            <div className="text-xs text-[#9e9486] tabular-nums">
              WASD or Arrow Keys Pan · Scroll Zoom · Click Tile to Cast or Build · Space Pause · H Hide Dock
            </div>
          </div>
        </div>
      )}

      {/* PLAYING HUD OVERLAY (Pointer Pass-Through so >= 85% center viewport is unobstructed) */}
      {gameState !== 'title' && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 md:p-4">
          {/* TOP PERIMETER BAR: Left Resource & Epoch Cluster + Right Utility Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Top-Left Cluster: Epoch + 8 Live Resources */}
            <div className="pointer-events-auto bg-[#181512]/95 px-3 py-2 shadow-xl flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
              {/* Current Epoch & Year */}
              <div className="pr-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display font-bold text-sm text-[#f5b742] whitespace-nowrap">
                    {currentEpoch.name}
                  </span>
                  <span aria-hidden="true" className="text-[#6e655a]">·</span>
                  <span className="text-xs text-[#cfc6b8] tabular-nums whitespace-nowrap">
                    {formatYearLabel(sim.year)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#a89f91] tabular-nums mt-0.5">
                  <span>Pop {sim.population}/{sim.populationCap}</span>
                  <span aria-hidden="true">·</span>
                  <span>Morale {Math.round(sim.happiness)}%</span>
                  {nextEpoch && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Next Age {sim.epochProgress}%</span>
                    </>
                  )}
                  {sim.goldenAgeTimer > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#ffd166] font-medium">
                        Golden Age {Math.ceil(sim.goldenAgeTimer)}s
                      </span>
                    </>
                  )}
                  {hostileCount > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#e63946] font-semibold">
                        Raiders {hostileCount}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* 8 Resources with Hero-to-Kicker hierarchy & Tabular Numerals */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {RESOURCE_KEYS.map(({ key, label }) => {
                  const amount = Math.floor(sim.resources[key]);
                  const rate = Math.round(sim.rates[key]);
                  return (
                    <div
                      key={key}
                      data-testid={`resource-${key}`}
                      className="flex items-center gap-1"
                    >
                      <ResourceIconSvg resource={key} className="w-3.5 h-3.5 shrink-0" />
                      <div>
                        <div className="flex items-baseline gap-0.5 tabular-nums">
                          <span className="text-xs font-bold text-[#ede8df]">
                            {amount}
                          </span>
                          <span
                            className={`text-[10px] ${
                              rate < 0 ? 'text-[#e76f51]' : 'text-[#7ec88b]'
                            }`}
                          >
                            {rate >= 0 ? `+${rate}/s` : `${rate}/s`}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#9e9486] leading-none">
                          {label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Advance Age Action when available */}
              {nextEpoch && (
                <button
                  type="button"
                  onClick={() => handleAdvanceEpoch(true)}
                  className="px-2.5 py-1.5 bg-[#d97736] hover:bg-[#e88846] text-[#141210] font-semibold text-xs rounded-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title={`Advance to ${nextEpoch.name}`}
                >
                  Advance Age
                </button>
              )}
            </div>

            {/* Top-Right Cluster: Time Multipliers, Camera Controls & Utility Buttons */}
            <div className="pointer-events-auto flex items-center gap-1.5 bg-[#181512]/95 px-2.5 py-2 shadow-xl">
              {/* Speed Selector */}
              <div className="flex items-center gap-1" role="group" aria-label="Simulation Speed">
                {[
                  { scale: 0, label: '0x' },
                  { scale: 1, label: '1x' },
                  { scale: 2, label: '2x' },
                  { scale: 5, label: '5x' },
                  { scale: 10, label: '10x' },
                ].map((s) => (
                  <button
                    key={s.scale}
                    type="button"
                    onClick={() => {
                      setTimeScale(s.scale);
                      soundEngine.playClick();
                    }}
                    className={`px-2 py-1 text-xs font-semibold tabular-nums rounded-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      timeScale === s.scale
                        ? 'bg-[#d97736] text-[#141210]'
                        : 'bg-[#24201b] text-[#cfc6b8] hover:bg-[#302a23]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Camera Rotate & Center */}
              <button
                type="button"
                onClick={() => {
                  cameraActionRef.current.rotateDelta -= Math.PI / 4;
                  soundEngine.playClick();
                }}
                className="px-2 py-1 bg-[#24201b] hover:bg-[#302a23] text-xs text-[#cfc6b8] rounded-sm cursor-pointer whitespace-nowrap shrink-0"
                aria-label="Rotate Camera Left"
                title="Rotate Camera Left ([)"
              >
                ↺
              </button>
              <button
                type="button"
                onClick={() => {
                  cameraActionRef.current.centerHome = true;
                  soundEngine.playClick();
                }}
                className="px-2 py-1 bg-[#24201b] hover:bg-[#302a23] text-xs text-[#cfc6b8] rounded-sm cursor-pointer whitespace-nowrap shrink-0"
                aria-label="Center Settlement"
                title="Center on Hearth"
              >
                Center
              </button>
              <button
                type="button"
                onClick={() => {
                  cameraActionRef.current.rotateDelta += Math.PI / 4;
                  soundEngine.playClick();
                }}
                className="px-2 py-1 bg-[#24201b] hover:bg-[#302a23] text-xs text-[#cfc6b8] rounded-sm cursor-pointer whitespace-nowrap shrink-0"
                aria-label="Rotate Camera Right"
                title="Rotate Camera Right (])"
              >
                ↻
              </button>

              {/* Chronicle Toggle */}
              <button
                type="button"
                onClick={() => {
                  setChronicleOpen((prev) => !prev);
                  soundEngine.playClick();
                }}
                className={`px-2 py-1 text-xs font-medium rounded-sm cursor-pointer whitespace-nowrap shrink-0 ${
                  chronicleOpen
                    ? 'bg-[#f5b742] text-[#141210]'
                    : 'bg-[#24201b] text-[#cfc6b8] hover:bg-[#302a23]'
                }`}
              >
                Chronicle
              </button>

              {/* Mute [M], Pause [P], Restart [R] */}
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleToggleMute();
                }}
                aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                className="px-2 py-1 bg-[#24201b] hover:bg-[#302a23] text-xs text-[#cfc6b8] rounded-sm cursor-pointer whitespace-nowrap shrink-0"
              >
                {muted ? 'Muted' : 'Audio'}
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setGameState((prev) => (prev === 'paused' ? 'playing' : 'paused'));
                }}
                aria-label="Pause Simulation"
                className="px-2 py-1 bg-[#24201b] hover:bg-[#302a23] text-xs text-[#cfc6b8] rounded-sm cursor-pointer whitespace-nowrap shrink-0"
              >
                Pause
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleRestartGame();
                }}
                aria-label="Reset World"
                className="px-2 py-1 bg-[#24201b] hover:bg-[#302a23] text-xs text-[#cfc6b8] rounded-sm cursor-pointer whitespace-nowrap shrink-0"
              >
                Reset
              </button>
            </div>
          </div>

          {/* OPTIONAL CHRONICLE DRAWER (Top-Right Drop Panel when opened) */}
          {chronicleOpen && (
            <div className="pointer-events-auto self-end w-full max-w-md bg-[#181512]/95 p-4 shadow-2xl max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display font-semibold text-sm text-[#f5b742]">
                  Sacred Annals of Civilization
                </h2>
                <button
                  type="button"
                  onClick={() => setChronicleOpen(false)}
                  className="text-xs text-[#9e9486] hover:text-[#ede8df] cursor-pointer"
                >
                  Close
                </button>
              </div>
              <div className="space-y-1.5 text-xs">
                {sim.chronicle.map((entry) => (
                  <div key={entry.id} className="text-[#cfc6b8] leading-snug">
                    <span className="text-[#9e9486] tabular-nums">{entry.yearLabel}</span>
                    <span aria-hidden="true" className="mx-1.5 text-[#6e655a]">·</span>
                    <span
                      className={
                        entry.tone === 'epoch'
                          ? 'text-[#ffd166] font-medium'
                          : entry.tone === 'warning'
                            ? 'text-[#f4a261]'
                            : 'text-[#ede8df]'
                      }
                    >
                      {entry.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UNIFIED COLLAPSIBLE BOTTOM CONTROL DOCK */}
          <div className="pointer-events-auto self-center w-full max-w-[960px] flex flex-col items-center">
            {/* Collapse / Expand Zen Mode Toggle Tab */}
            <div className="flex items-center gap-3 bg-[#181512]/95 px-4 py-1 shadow-lg">
              <span className="text-xs text-[#cfc6b8] truncate max-w-[440px]">
                {statusFeedback}
              </span>
              {inspectedTile && (
                <span className="hidden sm:inline text-xs text-[#9e9486] tabular-nums whitespace-nowrap">
                  · Tile ({inspectedTile.x}, {inspectedTile.z}) Elev {inspectedTile.height} ·{' '}
                  {inspectedBuilding
                    ? `${inspectedBuilding.type.replace('_', ' ')}${inspectedBuilding.constructionProgress < 100 ? ` (${Math.floor(inspectedBuilding.constructionProgress)}%)` : ''}`
                    : inspectedTile.resourceNode !== 'none'
                      ? `${inspectedTile.terrain.replace('_', ' ')} (${inspectedTile.resourceNode.replace('_', ' ')} ${inspectedTile.resourceAmount})`
                      : inspectedTile.terrain.replace('_', ' ')}
                </span>
              )}
              <button
                type="button"
                onClick={() => setDockCollapsed((prev) => !prev)}
                className="text-xs font-semibold text-[#f5b742] hover:text-[#ffd166] cursor-pointer whitespace-nowrap shrink-0 ml-2"
              >
                {dockCollapsed ? '▴ Show Controls [H]' : '▾ Hide Controls [H]'}
              </button>
            </div>

            {!dockCollapsed && (
              <div className="w-full bg-[#181512]/96 px-4 py-3 shadow-2xl">
                {/* Dock Category Navigation Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="God Toolkit Categories">
                    {(
                      [
                        { id: 'powers', label: 'Divine Powers' },
                        { id: 'terrain', label: 'Terrain Sculpt' },
                        { id: 'build', label: 'Build Structures' },
                        { id: 'spawn', label: 'Spawn Beings' },
                        { id: 'epochs', label: 'Epochs & Visuals' },
                        { id: 'inspect', label: 'Inspect' },
                      ] as { id: ToolCategory; label: string }[]
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={activeCategory === tab.id}
                        onClick={() => {
                          setActiveCategory(tab.id);
                          if (tab.id === 'inspect') {
                            setActiveTool({ kind: 'inspect' });
                          } else if (tab.id === 'powers' && activeTool.kind !== 'power') {
                            setActiveTool({ kind: 'power', power: 'blessing' });
                          } else if (tab.id === 'terrain' && activeTool.kind !== 'terrain') {
                            setActiveTool({ kind: 'terrain', tool: 'raise' });
                          } else if (tab.id === 'build' && activeTool.kind !== 'build') {
                            const epochBld =
                              BUILDINGS.find((b) => b.epoch === currentEpoch.id)?.type || 'ziggurat';
                            setActiveTool({ kind: 'build', building: epochBld });
                          } else if (tab.id === 'spawn' && activeTool.kind !== 'spawn') {
                            setActiveTool({ kind: 'spawn', unit: 'villager' });
                          }
                          soundEngine.playClick();
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          activeCategory === tab.id
                            ? 'bg-[#d97736] text-[#141210]'
                            : 'bg-[#24201b] text-[#cfc6b8] hover:bg-[#302a23]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Quick Sandbox Free Toggle & Raider Wave Trigger */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        simRef.current.sandboxFreeMode = !simRef.current.sandboxFreeMode;
                        soundEngine.playClick();
                        setHudTick((t) => t + 1);
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-sm cursor-pointer whitespace-nowrap shrink-0 ${
                        sim.sandboxFreeMode
                          ? 'bg-[#6a994e] text-[#141210] font-semibold'
                          : 'bg-[#24201b] text-[#a89f91] hover:text-[#ede8df]'
                      }`}
                    >
                      {sim.sandboxFreeMode ? 'Free God Mode: On' : 'Free God Mode: Off'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        spawnRaiderWave(simRef.current);
                        soundEngine.playCurse();
                        setStatusFeedback('Spawned hostile raider party on the frontier!');
                        setHudTick((t) => t + 1);
                      }}
                      className="px-2.5 py-1 bg-[#2c1d1b] hover:bg-[#3d2623] text-[#f4a261] text-xs font-medium rounded-sm cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Spawn Raider Wave
                    </button>
                  </div>
                </div>

                {/* TAB 1: DIVINE POWERS (Miracles, Blessings, Curses, Cataclysms) */}
                {activeCategory === 'powers' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {GOD_POWERS.map((power) => {
                      const isSelected =
                        activeTool.kind === 'power' && activeTool.power === power.type;
                      const affordable = sim.sandboxFreeMode || sim.resources.faith >= power.faithCost;
                      return (
                        <button
                          key={power.type}
                          type="button"
                          onClick={() => {
                            setActiveTool({ kind: 'power', power: power.type });
                            soundEngine.playClick();
                            setStatusFeedback(`${power.name} ready · ${power.summary}`);
                          }}
                          className={`p-2 text-left rounded-sm transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#33291e] ring-2 ring-[#f5b742]'
                              : 'bg-[#221e1a] hover:bg-[#2b2620]'
                          } ${!affordable ? 'opacity-60' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-[#ede8df] truncate">
                              {power.name}
                            </span>
                            <span className="text-[11px] font-semibold text-[#ffd166] tabular-nums shrink-0">
                              {sim.sandboxFreeMode ? 'Free' : `${power.faithCost} Faith`}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#9e9486] truncate mt-0.5">
                            {power.category} · [{power.keyHint}]
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* TAB 2: TERRAIN SCULPTING */}
                {activeCategory === 'terrain' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#cfc6b8]">
                      <span>Select a terrain brush and click any map tile to sculpt elevation and ecosystems</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#9e9486]">Brush Radius:</span>
                        {[1, 2, 3].map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setBrushRadius(r)}
                            className={`px-2 py-0.5 text-xs font-semibold tabular-nums rounded-sm cursor-pointer ${
                              brushRadius === r
                                ? 'bg-[#d97736] text-[#141210]'
                                : 'bg-[#24201b] text-[#cfc6b8]'
                            }`}
                          >
                            {r}x
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
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
                              setStatusFeedback(`${tool.name} brush active · ${tool.summary}`);
                            }}
                            className={`p-2 text-left rounded-sm transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#33291e] ring-2 ring-[#56cfe1]'
                                : 'bg-[#221e1a] hover:bg-[#2b2620]'
                            }`}
                          >
                            <div className="text-xs font-semibold text-[#ede8df] truncate">
                              {tool.name}
                            </div>
                            <div className="text-[11px] text-[#9e9486] tabular-nums mt-0.5">
                              {sim.sandboxFreeMode ? 'Free' : `${tool.faithCost} Faith`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 3: BASE BUILDING (14 Structures across 7 Ages) */}
                {activeCategory === 'build' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 max-h-36 overflow-y-auto pr-1">
                    {BUILDINGS.map((bld) => {
                      const isSelected =
                        activeTool.kind === 'build' && activeTool.building === bld.type;
                      const affordable = canAfford(sim.resources, bld.cost, sim.sandboxFreeMode);
                      const costSummary = Object.entries(bld.cost)
                        .map(([k, v]) => `${v} ${k.slice(0, 3)}`)
                        .join(' · ');

                      return (
                        <button
                          key={bld.type}
                          type="button"
                          onClick={() => {
                            setActiveTool({ kind: 'build', building: bld.type });
                            soundEngine.playClick();
                            setStatusFeedback(`${bld.name} selected · ${bld.roleSummary}`);
                          }}
                          className={`p-2 text-left rounded-sm transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#33291e] ring-2 ring-[#80ed99]'
                              : 'bg-[#221e1a] hover:bg-[#2b2620]'
                          } ${!affordable ? 'opacity-65' : ''}`}
                        >
                          <div className="text-xs font-semibold text-[#ede8df] truncate">
                            {bld.name}
                          </div>
                          <div className="text-[11px] text-[#f5b742] truncate tabular-nums">
                            {sim.sandboxFreeMode ? 'Free' : costSummary}
                          </div>
                          <div className="text-[10px] text-[#9e9486] truncate">
                            {bld.roleSummary}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* TAB 4: SPAWN UNITS & BEINGS */}
                {activeCategory === 'spawn' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {UNITS.map((u) => {
                      const isSelected =
                        activeTool.kind === 'spawn' && activeTool.unit === u.role;
                      const costSummary =
                        u.faction === 'hostile' || sim.sandboxFreeMode
                          ? 'Free Spawn'
                          : Object.entries(u.cost)
                              .map(([k, v]) => `${v} ${k}`)
                              .join(' · ');
                      return (
                        <button
                          key={u.role}
                          type="button"
                          onClick={() => {
                            setActiveTool({ kind: 'spawn', unit: u.role });
                            soundEngine.playClick();
                            setStatusFeedback(`${u.name} spawner active · ${u.roleSummary}`);
                          }}
                          className={`p-2 text-left rounded-sm transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#33291e] ring-2 ring-[#f5b742]'
                              : 'bg-[#221e1a] hover:bg-[#2b2620]'
                          }`}
                        >
                          <div className="text-xs font-semibold text-[#ede8df] truncate">
                            {u.name}
                          </div>
                          <div className="text-[11px] text-[#f4a261] truncate tabular-nums">
                            {costSummary}
                          </div>
                          <div className="text-[10px] text-[#9e9486] truncate">
                            {u.roleSummary}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* TAB 5: EPOCHS,PIXELATION & ATMOSPHERE */}
                {activeCategory === 'epochs' && (
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    {/* 7 Epochs Stepper */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {EPOCHS.map((ep) => {
                        const isCurrent = sim.epochIndex === ep.index;
                        const isReached = sim.epochIndex >= ep.index;
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
                              setStatusFeedback(`Shifted civilization to ${ep.name} (${ep.yearLabel})`);
                              setHudTick((t) => t + 1);
                            }}
                            className={`px-2.5 py-1.5 text-left rounded-sm transition-colors cursor-pointer ${
                              isCurrent
                                ? 'bg-[#d97736] text-[#141210] font-semibold'
                                : isReached
                                  ? 'bg-[#2b251f] text-[#ede8df]'
                                  : 'bg-[#201c18] text-[#9e9486] hover:text-[#ede8df]'
                            }`}
                          >
                            <div className="text-xs whitespace-nowrap">{ep.name}</div>
                            <div className="text-[10px] opacity-80 tabular-nums">{ep.yearLabel}</div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Pixel Crunch, Lighting & World Seed Controls */}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-[#9e9486]">Pixel Scale:</span>
                        {[
                          { val: 1, label: '1x Crisp' },
                          { val: 2, label: '2x Pixel' },
                          { val: 3, label: '3x Voxel' },
                        ].map((px) => (
                          <button
                            key={px.val}
                            type="button"
                            onClick={() => setPixelScale(px.val)}
                            className={`px-2 py-1 rounded-sm cursor-pointer whitespace-nowrap ${
                              pixelScale === px.val
                                ? 'bg-[#f5b742] text-[#141210] font-semibold'
                                : 'bg-[#24201b] text-[#cfc6b8]'
                            }`}
                          >
                            {px.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[#9e9486]">Lighting:</span>
                        {(['noon', 'dusk', 'night', 'dawn'] as LightingPreset[]).map((lp) => (
                          <button
                            key={lp}
                            type="button"
                            onClick={() => setLightingPreset(lp)}
                            className={`px-2 py-1 capitalize rounded-sm cursor-pointer ${
                              lightingPreset === lp
                                ? 'bg-[#56cfe1] text-[#141210] font-semibold'
                                : 'bg-[#24201b] text-[#cfc6b8]'
                            }`}
                          >
                            {lp}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[#9e9486]">Seed:</span>
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
                          className="w-24 px-2 py-1 bg-[#24201b] text-[#ede8df] tabular-nums rounded-sm outline-none focus:ring-1 focus:ring-[#f5b742]"
                        />
                        <button
                          type="button"
                          onClick={() => handleGenerateSeededWorld(seedInput || undefined)}
                          className="px-2 py-1 bg-[#24201b] hover:bg-[#302a23] text-[#f5b742] rounded-sm cursor-pointer whitespace-nowrap"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenerateSeededWorld(undefined)}
                          className="px-2 py-1 bg-[#24201b] hover:bg-[#302a23] text-[#cfc6b8] rounded-sm cursor-pointer whitespace-nowrap"
                        >
                          New Random
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 6: INSPECT MODE */}
                {activeCategory === 'inspect' && (
                  <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-[#cfc6b8]">
                    <div>
                      Click any structure, unit, or terrain terrace to inspect its status, elevation, and biome.
                    </div>
                    <div className="tabular-nums text-[#9e9486]">
                      World Seed: {sim.seed} · Structures Built: {sim.totalStructuresBuilt} · Miracles Cast: {sim.totalMiraclesCast} · Raiders Defeated: {sim.totalRaidersDefeated}
                    </div>
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
          aria-label="Simulation Paused"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#141210]/80 p-4"
        >
          <div className="w-full max-w-md bg-[#181512] p-6 shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-[#ede8df] mb-2">
              Simulation Paused
            </h2>
            <p className="text-sm text-[#a89f91] mb-6">
              Your civilization rests in the {currentEpoch.name} ({formatYearLabel(sim.year)}).
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6 bg-[#221e1a] p-3 tabular-nums">
              <div>
                <div className="text-lg font-bold text-[#f5b742]">{sim.population}</div>
                <div className="text-xs text-[#9e9486]">Citizens</div>
              </div>
              <div>
                <div className="text-lg font-bold text-[#ede8df]">{sim.buildings.length}</div>
                <div className="text-xs text-[#9e9486]">Structures</div>
              </div>
              <div>
                <div className="text-lg font-bold text-[#56cfe1]">{sim.totalMiraclesCast}</div>
                <div className="text-xs text-[#9e9486]">Miracles</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setGameState('playing')}
                className="px-5 py-2.5 bg-[#d97736] hover:bg-[#e88846] text-[#141210] font-semibold text-sm rounded-sm cursor-pointer"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={handleRestartGame}
                className="px-4 py-2.5 bg-[#26211c] hover:bg-[#332c25] text-[#ede8df] text-sm rounded-sm cursor-pointer"
              >
                Restart
              </button>
              <button
                type="button"
                onClick={() => setGameState('title')}
                className="px-4 py-2.5 bg-[#26211c] hover:bg-[#332c25] text-[#a89f91] hover:text-[#ede8df] text-sm rounded-sm cursor-pointer"
              >
                Title
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY / INTERSTELLAR ASCENSION MODAL */}
      {gameState === 'gameover' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cosmic Ascension Complete"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#141210]/85 p-4"
        >
          <div className="w-full max-w-md bg-[#181512] p-6 shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-[#ffd166] mb-2">
              Interstellar Ascension Achieved
            </h2>
            <p className="text-sm text-[#cfc6b8] mb-6">
              From prehistoric flint and hearth fire, your mortal charges have harnessed stellar singularities and joined the cosmic eternals.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6 bg-[#221e1a] p-3 tabular-nums">
              <div>
                <div className="text-lg font-bold text-[#ffd166]">{sim.totalStructuresBuilt}</div>
                <div className="text-xs text-[#9e9486]">Wonders Built</div>
              </div>
              <div>
                <div className="text-lg font-bold text-[#56cfe1]">{sim.totalMiraclesCast}</div>
                <div className="text-xs text-[#9e9486]">Miracles Cast</div>
              </div>
              <div>
                <div className="text-lg font-bold text-[#80ed99]">{sim.population}</div>
                <div className="text-xs text-[#9e9486]">Ascended Souls</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  simRef.current.outcome = 'none';
                  setGameState('playing');
                }}
                className="px-5 py-2.5 bg-[#d97736] hover:bg-[#e88846] text-[#141210] font-semibold text-sm rounded-sm cursor-pointer"
              >
                Continue Eternal Sandbox
              </button>
              <button
                type="button"
                onClick={handleRestartGame}
                className="px-4 py-2.5 bg-[#26211c] hover:bg-[#332c25] text-[#ede8df] text-sm rounded-sm cursor-pointer"
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
