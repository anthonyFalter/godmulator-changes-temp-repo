import React, { useMemo, useState } from 'react';
import { BUILDINGS, EPOCHS, getMaxCityPopulation } from '../game/catalog';
import { createSeededNomadName, getKingdomEpoch, getKingdomId, getKingdomRelation } from '../game/simulation';
import { Resources, SimulationState, SpeciesId } from '../game/types';
import { HudPixelIcon, ResourceIconSvg, UnitPixelIcon } from './GameIcons';

const CITY_RESOURCE_KEYS: { key: keyof Resources; label: string }[] = [
  { key: 'food', label: 'Food' },
  { key: 'wood', label: 'Wood' },
  { key: 'stone', label: 'Stone' },
  { key: 'ore', label: 'Ore' },
  { key: 'knowledge', label: 'Lore' },
  { key: 'alloy', label: 'Alloy' },
  { key: 'faith', label: 'God Energy' },
];

type CityInspectorPage = 'info' | 'era' | 'stockpile';

export interface InspectedCityRef {
  settlementId: string;
  kingdomId: string;
  name?: string;
  tileX: number;
  tileZ: number;
}

interface CityInspectorCardProps {
  sim: SimulationState;
  cityRef: InspectedCityRef;
  accentHex?: string;
  offsetForEntityInspector?: boolean;
  onClose: () => void;
  onFocusTile: (tileX: number, tileZ: number) => void;
  onRenameSettlement: (settlementId: string, newName: string) => void;
  onRenameKingdom: (kingdomId: string, newName: string) => void;
  onSetKingdomResource: (kingdomId: string, resource: keyof Resources, value: number) => void;
  onBoostKingdomResources: (kingdomId: string, delta: number) => void;
  onSetKingdomEpoch: (kingdomId: string, epochIndex: number) => void;
  onSetKingdomEpochProgress: (kingdomId: string, progress: number) => void;
  onToggleKingdomPeaceful: (kingdomId: string) => void;
}

function getSpeciesCityLabel(species: SpeciesId): string {
  switch (species) {
    case 'elf':
      return 'Elven City';
    case 'orc':
      return 'Orcish Hold';
    case 'dwarf':
      return 'Dwarven Hold';
    case 'lizardfolk':
      return 'Lizardfolk City';
    default:
      return 'Human City';
  }
}

export const CityInspectorCard: React.FC<CityInspectorCardProps> = ({
  sim,
  cityRef,
  offsetForEntityInspector = false,
  onClose,
  onFocusTile,
  onRenameSettlement,
  onRenameKingdom,
  onSetKingdomResource,
  onBoostKingdomResources,
  onSetKingdomEpoch,
  onSetKingdomEpochProgress,
  onToggleKingdomPeaceful,
}) => {
  const [activePage, setActivePage] = useState<CityInspectorPage>('info');
  const [minimized, setMinimized] = useState(false);
  const [renameTarget, setRenameTarget] = useState<'settlement' | 'kingdom' | null>(null);
  const [draftName, setDraftName] = useState('');

  const summary = useMemo(() => {
    const sid = cityRef.settlementId;
    const kid = sim.settlementKingdoms?.[sid] ?? cityRef.kingdomId ?? sid;

    let buildingCount = 0;
    let completedCount = 0;
    let farmCount = 0;
    let popCapBonus = 0;
    let sumX = 0;
    let sumZ = 0;
    const typeCounts = new Map<string, number>();

    for (let i = 0; i < sim.buildings.length; i++) {
      const b = sim.buildings[i];
      if (b.hp <= 0) continue;
      if ((b.settlementId || 'city_default') !== sid) continue;
      buildingCount++;
      sumX += b.tileX;
      sumZ += b.tileZ;
      if (b.constructionProgress >= 100) {
        completedCount++;
        const def = BUILDINGS.find((d) => d.type === b.type);
        if (def) {
          popCapBonus += def.popCapBonus ?? 0;
          typeCounts.set(def.name, (typeCounts.get(def.name) ?? 0) + 1);
        }
      }
    }
    for (let i = 0; i < sim.tiles.length; i++) {
      if (sim.tiles[i].farmSettlementId === sid) farmCount++;
    }

    let adults = 0;
    let children = 0;
    let leaderName: string | null = null;
    let firstSpecies: SpeciesId | undefined;

    for (let i = 0; i < sim.units.length; i++) {
      const u = sim.units[i];
      if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0) continue;
      const uSid = u.settlementId;
      const uKid = u.settlementId ? getKingdomId(sim, u.settlementId) : u.kingdomId;
      if (uSid === sid || (!uSid && uKid === kid)) {
        if (!firstSpecies) firstSpecies = u.species;
        if (u.ageStage === 'child') children++;
        else adults++;
      }
      if (u.isKing && (uSid === sid || uKid === kid)) {
        leaderName = u.name;
      }
    }

    const species: SpeciesId =
      sim.settlementSpecies?.[sid] ??
      sim.buildings.find((b) => b.hp > 0 && (b.settlementId || 'city_default') === sid)?.species ??
      firstSpecies ??
      'human';

    const cityName =
      sim.settlementNames?.[sid] ||
      cityRef.name ||
      createSeededNomadName(sid, sim.seed, species);
    const kingdomName = sim.settlementNames?.[kid] || cityName;

    const population = adults + children;
    const currentEpochIdx = getKingdomEpoch(sim, kid);
    const currentEpoch = EPOCHS[currentEpochIdx] ?? EPOCHS[0];
    const epochProgress = Math.max(0, Math.min(100, Math.round(sim.kingdomEpochProgress?.[kid] ?? 0)));
    const isPeaceful = Boolean(sim.kingdomPeacefulTraits?.[kid]);
    const maxCapLimit = getMaxCityPopulation(sim.gridSize);
    const rawCap = (completedCount > 0 ? currentEpoch.populationBonus : 0) + popCapBonus;
    const maxPopulation = completedCount > 0 ? Math.min(maxCapLimit, rawCap) : 0;

    const centerX = buildingCount > 0 ? Math.round(sumX / buildingCount) : cityRef.tileX;
    const centerZ = buildingCount > 0 ? Math.round(sumZ / buildingCount) : cityRef.tileZ;

    // Count diplomatic relations with other active kingdoms
    const otherKingdoms = new Set<string>();
    for (let i = 0; i < sim.buildings.length; i++) {
      const b = sim.buildings[i];
      if (b.hp <= 0 || !b.settlementId) continue;
      const otherKid = getKingdomId(sim, b.settlementId);
      if (otherKid !== kid) otherKingdoms.add(otherKid);
    }
    let alliesCount = 0;
    let warsCount = 0;
    otherKingdoms.forEach((otherKid) => {
      const rel = getKingdomRelation(sim, kid, otherKid);
      if (rel === 'allied') alliesCount++;
      else if (rel === 'war') warsCount++;
    });

    const resources = sim.kingdomResources?.[kid] ?? {
      food: 0,
      wood: 0,
      stone: 0,
      ore: 0,
      knowledge: 0,
      energy: 0,
      alloy: 0,
      faith: 0,
    };

    const topBuildings = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const exists = buildingCount > 0 || population > 0;

    return {
      sid,
      kid,
      species,
      cityName,
      kingdomName,
      population,
      maxPopulation,
      adults,
      children,
      leaderName,
      buildingCount,
      completedCount,
      farmCount,
      currentEpochIdx,
      currentEpoch,
      epochProgress,
      isPeaceful,
      centerX,
      centerZ,
      alliesCount,
      warsCount,
      resources,
      topBuildings,
      exists,
    };
  }, [sim, cityRef]);

  const positionClass = offsetForEntityInspector
    ? 'left-0 lg:left-[372px] top-0 z-20'
    : 'left-0 top-0 z-20';

  if (minimized) {
    return (
      <button
        type="button"
        data-testid="city-inspector-expand"
        onClick={() => setMinimized(false)}
        className={`pointer-events-auto absolute ${positionClass} px-panel px-2.5 py-1.5 text-xs font-bold text-[#f2c478] cursor-pointer flex items-center gap-1.5`}
      >
        <span>City: {summary.cityName}</span>
      </button>
    );
  }

  const commitRename = () => {
    const trimmed = draftName.trim();
    if (trimmed.length > 0) {
      if (renameTarget === 'settlement') {
        onRenameSettlement(summary.sid, trimmed);
      } else if (renameTarget === 'kingdom') {
        onRenameKingdom(summary.kid, trimmed);
      }
    }
    setRenameTarget(null);
  };

  return (
    <aside
      aria-label="City Information"
      data-testid="city-inspector-panel"
      className={`pointer-events-auto absolute ${positionClass} w-[min(330px,100%)] sm:w-[360px] max-h-[min(360px,100%)] sm:max-h-full px-panel p-2.5 sm:p-3.5 flex flex-col gap-2.5 overflow-y-auto`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center bg-[#181310] border border-[#544034]"
            aria-hidden="true"
          >
            <UnitPixelIcon role={summary.species} className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <div className="min-w-0 flex-1">
            {renameTarget === 'settlement' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  commitRename();
                }}
                className="flex items-center gap-1"
              >
                <input
                  type="text"
                  value={draftName}
                  maxLength={32}
                  autoFocus
                  data-testid="city-inspector-rename-input"
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Escape') setRenameTarget(null);
                  }}
                  className="w-full min-w-0 bg-[#15100e] border border-[#f2c478] px-1.5 py-0.5 text-xs text-[#f4e7d4] outline-none"
                />
                <button
                  type="submit"
                  className="px-btn-active px-1.5 py-0.5 text-[10px] font-bold text-[#fff6e6] cursor-pointer shrink-0"
                >
                  Save
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-1 min-w-0">
                <h2
                  className="text-xs sm:text-sm font-bold text-[#f4e7d4] truncate leading-tight"
                  data-testid="city-inspector-name"
                >
                  {summary.cityName}
                </h2>
                <button
                  type="button"
                  data-testid="city-inspector-rename-btn"
                  aria-label="Rename city"
                  title="Rename city"
                  onClick={() => {
                    setRenameTarget('settlement');
                    setDraftName(summary.cityName);
                  }}
                  className="text-[11px] text-[#9e866f] hover:text-[#f2c478] cursor-pointer shrink-0 px-0.5"
                >
                  ✎
                </button>
              </div>
            )}
            <div className="text-[11px] text-[#ccb69c] leading-tight mt-0.5 truncate">
              {getSpeciesCityLabel(summary.species)}
              {summary.kid !== summary.sid ? ` of ${summary.kingdomName}` : ''}
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          <button
            type="button"
            data-testid="city-inspector-edit-toggle"
            onClick={() => setActivePage((prev) => (prev === 'info' ? 'era' : 'info'))}
            aria-label={activePage === 'info' ? 'Edit city and kingdom' : 'View city info'}
            title={activePage === 'info' ? 'Edit city & kingdom' : 'View city info'}
            className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer transition-colors ${
              activePage !== 'info'
                ? 'px-btn-active text-[#fff6e6]'
                : 'px-btn text-[#dbc7ae] hover:text-[#f2c478]'
            }`}
          >
            <HudPixelIcon
              kind={activePage === 'info' ? 'pencil' : 'document'}
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 pixelated-canvas"
            />
          </button>

          <button
            type="button"
            onClick={() => onFocusTile(summary.centerX, summary.centerZ)}
            aria-label="Center camera on city"
            title="Center camera on city"
            className="px-btn w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer text-[#56cfe1] hover:text-[#80ed99] transition-colors"
          >
            <HudPixelIcon kind="center" className="w-3.5 h-3.5 sm:w-4 sm:h-4 pixelated-canvas" />
          </button>

          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="sm:hidden px-btn w-7 h-7 flex items-center justify-center cursor-pointer text-[#bfa88f] hover:text-[#f4e7d4]"
            aria-label="Minimize City Inspector"
            title="Minimize"
          >
            <HudPixelIcon kind="chevronUp" className="w-3.5 h-3.5 pixelated-canvas" />
          </button>

          <button
            type="button"
            data-testid="city-inspector-close-btn"
            onClick={onClose}
            aria-label="Close city inspector"
            title="Close"
            className="px-btn w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer text-[#9e866f] hover:text-[#f4e7d4] text-xs font-bold transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {!summary.exists ? (
        <div className="px-card p-3 text-xs text-[#b09880] space-y-2">
          <p>This settlement no longer stands in the world.</p>
          <button
            type="button"
            onClick={onClose}
            className="px-btn px-2.5 py-1 text-[11px] font-semibold text-[#f4e7d4] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      ) : (
        <>
          {/* Page Tabs: Overview + Two Dedicated Edit Pages */}
          <div className="grid grid-cols-3 gap-1 border-b border-[#423229] pb-1.5 shrink-0">
            <button
              type="button"
              data-testid="city-tab-info"
              onClick={() => setActivePage('info')}
              className={`px-1.5 py-1 text-[10px] sm:text-[11px] cursor-pointer transition-colors whitespace-nowrap ${
                activePage === 'info' ? 'px-btn-active font-bold text-[#fff6e6]' : 'px-btn font-semibold text-[#bfa88f]'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              data-testid="city-tab-era"
              onClick={() => setActivePage('era')}
              className={`px-1.5 py-1 text-[10px] sm:text-[11px] cursor-pointer transition-colors whitespace-nowrap ${
                activePage === 'era' ? 'px-btn-active font-bold text-[#fff6e6]' : 'px-btn font-semibold text-[#bfa88f]'
              }`}
            >
              Edit Realm
            </button>
            <button
              type="button"
              data-testid="city-tab-stockpile"
              onClick={() => setActivePage('stockpile')}
              className={`px-1.5 py-1 text-[10px] sm:text-[11px] cursor-pointer transition-colors whitespace-nowrap ${
                activePage === 'stockpile'
                  ? 'px-btn-active font-bold text-[#fff6e6]'
                  : 'px-btn font-semibold text-[#bfa88f]'
              }`}
            >
              Stockpile
            </button>
          </div>

          {/* ==============================================================
              PAGE 1: OVERVIEW (City & Kingdom Information)
             ============================================================== */}
          {activePage === 'info' && (
            <div className="space-y-2.5 text-xs" data-testid="city-info-page">
              {/* Era & Progress Gauge */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#f2c478] font-semibold">
                    {summary.currentEpoch.name}
                  </span>
                  <span className="font-pixel-num text-[#ccb69c] tabular-nums">
                    {summary.currentEpochIdx >= EPOCHS.length - 1
                      ? 'Max Era'
                      : `${summary.epochProgress}%`}
                  </span>
                </div>
                <div className="px-bar-track w-full h-3 overflow-hidden">
                  <div
                    className="px-bar-fill transition-all duration-200 bg-[#d9a441]"
                    style={{
                      width: `${
                        summary.currentEpochIdx >= EPOCHS.length - 1 ? 100 : summary.epochProgress
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Key Stats Grid */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="px-card px-2.5 py-1.5 flex items-center justify-between gap-1.5">
                  <span className="text-[11px] text-[#b09880]">Population</span>
                  <span className="font-pixel-num text-xs font-bold text-[#80ed99] tabular-nums">
                    {summary.population}
                    {summary.maxPopulation > 0 ? `/${summary.maxPopulation}` : ''}
                  </span>
                </div>
                <div className="px-card px-2.5 py-1.5 flex items-center justify-between gap-1.5">
                  <span className="text-[11px] text-[#b09880]">Buildings</span>
                  <span className="font-pixel-num text-xs font-bold text-[#f4e7d4] tabular-nums">
                    {summary.completedCount}
                    {summary.buildingCount > summary.completedCount
                      ? ` (+${summary.buildingCount - summary.completedCount})`
                      : ''}
                  </span>
                </div>
                <div className="px-card px-2.5 py-1.5 flex items-center justify-between gap-1.5">
                  <span className="text-[11px] text-[#b09880]">Adults / Youth</span>
                  <span className="font-pixel-num text-[11px] font-bold text-[#56cfe1] tabular-nums">
                    {summary.adults} / {summary.children}
                  </span>
                </div>
                <div className="px-card px-2.5 py-1.5 flex items-center justify-between gap-1.5">
                  <span className="text-[11px] text-[#b09880]">Policy</span>
                  <span
                    className={`text-[11px] font-bold ${
                      summary.isPeaceful ? 'text-[#80ed99]' : 'text-[#f2c478]'
                    }`}
                  >
                    {summary.isPeaceful ? 'Peaceful' : 'Expansionist'}
                  </span>
                </div>
              </div>

              {/* Realm / Leader / Diplomacy / Farm Details */}
              <div className="space-y-1.5 pt-1 border-t border-[#423229] text-xs text-[#bfa88f]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#8f7862] shrink-0">Kingdom</span>
                  <span className="text-[#f4e7d4] font-medium truncate">
                    {summary.kingdomName}
                  </span>
                </div>
                {summary.leaderName && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#8f7862] shrink-0">Ruler</span>
                    <span className="text-[#ffd36b] font-medium truncate">
                      {summary.leaderName}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#8f7862]">Diplomacy</span>
                  <span className="font-pixel-num text-[11px] tabular-nums">
                    <span className="text-[#56cfe1]">{summary.alliesCount} Allied</span>
                    {'  '}
                    <span className="text-[#ff8f6b]">{summary.warsCount} At War</span>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#8f7862]">Farms & Center</span>
                  <span className="font-pixel-num text-[11px] text-[#ccb69c] tabular-nums">
                    {summary.farmCount} farms ({summary.centerX}, {summary.centerZ})
                  </span>
                </div>
              </div>

              {/* Structures Breakdown */}
              {summary.topBuildings.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-[#423229]">
                  <div className="text-[10px] font-semibold text-[#8f7862]">Structures</div>
                  <div className="grid grid-cols-2 gap-1">
                    {summary.topBuildings.map(([name, count]) => (
                      <div
                        key={name}
                        className="px-card px-2 py-1 flex items-center justify-between gap-1 text-[10px]"
                      >
                        <span className="text-[#ccb69c] truncate">{name}</span>
                        <span className="font-pixel-num text-[#f4e7d4] font-bold tabular-nums">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stockpile Readout */}
              <div className="space-y-1 pt-1 border-t border-[#423229]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-[#8f7862]">Stockpile</span>
                  <button
                    type="button"
                    onClick={() => setActivePage('stockpile')}
                    className="text-[10px] text-[#f2c478] hover:underline cursor-pointer"
                  >
                    Edit Stockpile
                  </button>
                </div>
                <div
                  className="grid grid-cols-4 gap-1"
                  data-testid="city-inspector-resources"
                >
                  {CITY_RESOURCE_KEYS.map(({ key, label }) => (
                    <div
                      key={key}
                      title={`${label}: ${Math.floor(summary.resources[key] ?? 0)}`}
                      className="px-card px-1.5 py-1 flex items-center justify-between gap-1"
                    >
                      <ResourceIconSvg
                        resource={key}
                        className="w-3.5 h-3.5 pixelated-canvas shrink-0"
                      />
                      <span className="font-pixel-num text-[10px] text-[#eadbc6] tabular-nums">
                        {Math.floor(summary.resources[key] ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              PAGE 2: EDIT REALM (Names, Age/Era, Progress, Policy)
             ============================================================== */}
          {activePage === 'era' && (
            <div className="space-y-2.5 text-xs" data-testid="city-edit-era-page">
              {/* Rename City & Kingdom */}
              <div className="px-card p-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#bfa88f]">City Name</span>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[#f4e7d4] font-semibold truncate max-w-[155px]">
                      {summary.cityName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRenameTarget('settlement');
                        setDraftName(summary.cityName);
                      }}
                      className="px-btn px-1.5 py-0.5 text-[10px] text-[#f2c478] cursor-pointer"
                    >
                      Rename
                    </button>
                  </div>
                </div>

                {renameTarget === 'kingdom' ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      commitRename();
                    }}
                    className="flex items-center gap-1 pt-1 border-t border-[#423229]"
                  >
                    <input
                      type="text"
                      value={draftName}
                      maxLength={32}
                      autoFocus
                      data-testid="city-inspector-rename-kingdom-input"
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Escape') setRenameTarget(null);
                      }}
                      className="w-full min-w-0 bg-[#15100e] border border-[#f2c478] px-1.5 py-0.5 text-xs text-[#f4e7d4] outline-none"
                    />
                    <button
                      type="submit"
                      className="px-btn-active px-2 py-0.5 text-[10px] font-bold text-[#fff6e6] cursor-pointer shrink-0"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenameTarget(null)}
                      className="px-btn px-1.5 py-0.5 text-[10px] text-[#b09880] cursor-pointer shrink-0"
                    >
                      ✕
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#423229]">
                    <span className="text-[11px] text-[#bfa88f]">Kingdom Name</span>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[#f4e7d4] font-semibold truncate max-w-[155px]">
                        {summary.kingdomName}
                      </span>
                      <button
                        type="button"
                        data-testid="city-inspector-rename-kingdom-btn"
                        onClick={() => {
                          setRenameTarget('kingdom');
                          setDraftName(summary.kingdomName);
                        }}
                        className="px-btn px-1.5 py-0.5 text-[10px] text-[#f2c478] cursor-pointer"
                      >
                        Rename
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Age / Era Selector */}
              <div className="px-card p-2 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[#ccb69c]">Age / Era</span>
                  <span className="font-pixel-num text-[#f2c478]">{summary.currentEpoch.yearLabel}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-testid="city-era-prev-btn"
                    disabled={summary.currentEpochIdx <= 0}
                    onClick={() => onSetKingdomEpoch(summary.kid, summary.currentEpochIdx - 1)}
                    className="px-btn px-2 py-1 text-xs font-bold text-[#eadbc6] disabled:opacity-40 cursor-pointer"
                    aria-label="Previous era"
                  >
                    −
                  </button>
                  <select
                    data-testid="city-era-select"
                    value={summary.currentEpochIdx}
                    onChange={(e) => onSetKingdomEpoch(summary.kid, Number(e.target.value))}
                    className="flex-1 min-w-0 px-select px-2 py-1 text-xs outline-none cursor-pointer"
                  >
                    {EPOCHS.map((ep) => (
                      <option key={ep.id} value={ep.index}>
                        {ep.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    data-testid="city-era-next-btn"
                    disabled={summary.currentEpochIdx >= EPOCHS.length - 1}
                    onClick={() => onSetKingdomEpoch(summary.kid, summary.currentEpochIdx + 1)}
                    className="px-btn px-2 py-1 text-xs font-bold text-[#eadbc6] disabled:opacity-40 cursor-pointer"
                    aria-label="Next era"
                  >
                    +
                  </button>
                </div>

                {summary.currentEpochIdx < EPOCHS.length - 1 && (
                  <div className="space-y-1 pt-1 border-t border-[#423229]">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#bfa88f]">Era Progress</span>
                      <span className="font-pixel-num text-[#f4e7d4] tabular-nums">
                        {summary.epochProgress}%
                      </span>
                    </div>
                    <input
                      type="range"
                      data-testid="city-era-progress-slider"
                      min={0}
                      max={100}
                      step={5}
                      value={summary.epochProgress}
                      onChange={(e) =>
                        onSetKingdomEpochProgress(summary.kid, Number(e.target.value))
                      }
                      className="px-range w-full cursor-pointer"
                    />
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onSetKingdomEpochProgress(
                            summary.kid,
                            Math.min(100, summary.epochProgress + 25),
                          )
                        }
                        className="px-btn px-2 py-0.5 text-[10px] text-[#80ed99] cursor-pointer"
                      >
                        +25%
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetKingdomEpochProgress(summary.kid, 0)}
                        className="px-btn px-2 py-0.5 text-[10px] text-[#ccb69c] cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Policy / Temperament */}
              <div className="px-card p-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold text-[#ccb69c]">Temperament</div>
                  <div className="text-[10px] text-[#8f7862]">
                    {summary.isPeaceful
                      ? 'Avoids declaring offensive wars'
                      : 'Claims territory and rivals neighbors'}
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="city-temperament-toggle"
                  onClick={() => onToggleKingdomPeaceful(summary.kid)}
                  className={`px-2.5 py-1 text-[11px] font-bold cursor-pointer shrink-0 ${
                    summary.isPeaceful
                      ? 'px-btn-primary text-[#fff8eb]'
                      : 'px-btn text-[#f2c478]'
                  }`}
                >
                  {summary.isPeaceful ? 'Peaceful' : 'Expansionist'}
                </button>
              </div>
            </div>
          )}

          {/* ==============================================================
              PAGE 3: EDIT STOCKPILE (Resource Boosters & Direct Values)
             ============================================================== */}
          {activePage === 'stockpile' && (
            <div className="space-y-2 text-xs" data-testid="city-edit-stockpile-page">
              <div className="flex items-center justify-between gap-1 px-card p-2">
                <span className="text-[11px] font-semibold text-[#bfa88f]">Quick Grant</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-testid="city-boost-100-btn"
                    onClick={() => onBoostKingdomResources(summary.kid, 100)}
                    className="px-btn px-2 py-0.5 text-[10px] text-[#80ed99] font-bold cursor-pointer"
                  >
                    +100
                  </button>
                  <button
                    type="button"
                    data-testid="city-boost-1000-btn"
                    onClick={() => onBoostKingdomResources(summary.kid, 1000)}
                    className="px-btn px-2 py-0.5 text-[10px] text-[#f2c478] font-bold cursor-pointer"
                  >
                    +1000
                  </button>
                  <button
                    type="button"
                    data-testid="city-clear-resources-btn"
                    onClick={() => onBoostKingdomResources(summary.kid, 0)}
                    className="px-btn px-2 py-0.5 text-[10px] text-[#ff8f6b] cursor-pointer"
                  >
                    Zero
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1">
                {CITY_RESOURCE_KEYS.map(({ key, label }) => {
                  const val = Math.floor(summary.resources[key] ?? 0);
                  return (
                    <div
                      key={key}
                      className="px-card px-2 py-1 flex items-center justify-between gap-1.5"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ResourceIconSvg
                          resource={key}
                          className="w-3.5 h-3.5 pixelated-canvas shrink-0"
                        />
                        <span className="text-[11px] text-[#ccb69c] truncate">{label}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onSetKingdomResource(summary.kid, key, Math.max(0, val - 100))
                          }
                          className="px-btn w-6 h-6 flex items-center justify-center text-[11px] font-bold text-[#dbc7ae] cursor-pointer"
                          aria-label={`Decrease ${label}`}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={999999}
                          value={val}
                          onChange={(e) => {
                            const parsed = Number(e.target.value);
                            if (!Number.isNaN(parsed)) {
                              onSetKingdomResource(summary.kid, key, parsed);
                            }
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="w-16 bg-[#15100e] border border-[#544034] focus:border-[#f2c478] px-1.5 py-0.5 text-[11px] font-pixel-num text-[#f4e7d4] text-right tabular-nums outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => onSetKingdomResource(summary.kid, key, val + 100)}
                          className="px-btn w-6 h-6 flex items-center justify-center text-[11px] font-bold text-[#80ed99] cursor-pointer"
                          aria-label={`Increase ${label}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
};
