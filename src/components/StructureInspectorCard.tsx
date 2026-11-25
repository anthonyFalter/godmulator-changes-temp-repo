import React from 'react';
import { BUILDINGS, EPOCHS } from '../game/catalog';
import {
  createSeededNomadName,
  getBuildingEpochProductionMult,
  getBuildingPopCapBonus,
  getKingdomId,
  getSettlementEpoch,
  getTile,
} from '../game/simulation';
import { Resources, SimulationState, SpeciesId } from '../game/types';
import { BuildingPixelIcon, HudPixelIcon, ResourceIconSvg, UnitPixelIcon } from './GameIcons';

export type InspectedStructureRef =
  | { kind: 'building'; id: string }
  | { kind: 'wonder'; id: string }
  | { kind: 'memorial'; id: string }
  | { kind: 'bridge'; tileX: number; tileZ: number }
  | { kind: 'ruin'; tileX: number; tileZ: number };

interface StructureInspectorCardProps {
  sim: SimulationState;
  structureRef: InspectedStructureRef;
  offsetLeft?: boolean;
  onClose: () => void;
  onFocusTile: (tileX: number, tileZ: number) => void;
  onDemolishBuilding?: (buildingId: string) => void;
  onDemolishWonder?: (wonderId: string) => void;
}

const BUILDING_DEF_BY_TYPE = new Map(BUILDINGS.map((d) => [d.type, d]));

const BRIDGE_ERA_NAMES = [
  'Prehistoric Timber & Rope Span',
  'Bronze Plank Timber Bridge',
  'Medieval Stone Arch Bridge',
  'Industrial Iron Truss Bridge',
  'Atomic Reinforced Viaduct',
  'Information Smart-Deck Span',
  'Orbital Mag-Lev Conduit',
  'Starlight Hard-Light Span',
];

function formatSpeciesLabel(species?: SpeciesId): string {
  switch (species) {
    case 'elf':
      return 'Elven';
    case 'orc':
      return 'Orcish';
    case 'dwarf':
      return 'Dwarven';
    case 'lizardfolk':
      return 'Lizardfolk';
    default:
      return 'Human';
  }
}

function getLocalBridgeEpoch(sim: SimulationState, tileX: number, tileZ: number): number {
  let bestDistSq = Infinity;
  let bestEp = sim.epochIndex;
  for (let i = 0; i < sim.buildings.length; i++) {
    const b = sim.buildings[i];
    if (b.hp <= 0) continue;
    const dSq = (b.tileX - tileX) ** 2 + (b.tileZ - tileZ) ** 2;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestEp = getSettlementEpoch(sim, b.settlementId ?? 'city_default');
    }
  }
  return bestEp;
}

const RESOURCE_LABELS: { key: keyof Resources; label: string }[] = [
  { key: 'food', label: 'Food' },
  { key: 'wood', label: 'Wood' },
  { key: 'stone', label: 'Stone' },
  { key: 'ore', label: 'Ore' },
  { key: 'knowledge', label: 'Lore' },
  { key: 'energy', label: 'Energy' },
  { key: 'alloy', label: 'Alloy' },
  { key: 'faith', label: 'God Energy' },
];

export const StructureInspectorCard: React.FC<StructureInspectorCardProps> = React.memo(
  ({
    sim,
    structureRef,
    offsetLeft = false,
    onClose,
    onFocusTile,
    onDemolishBuilding,
    onDemolishWonder,
  }) => {
    const positionClass = offsetLeft
      ? 'left-0 lg:left-[372px] top-0 z-20'
      : 'left-0 top-0 z-20';

    const renderHeader = (
      title: string,
      subtitle: string,
      focusX: number,
      focusZ: number,
      iconNode: React.ReactNode,
    ) => (
      <div className="flex items-start justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center bg-[#181310] border border-[#544034]"
            aria-hidden="true"
          >
            {iconNode}
          </div>
          <div className="min-w-0 flex-1">
            <h2
              className="text-xs sm:text-sm font-bold text-[#f4e7d4] truncate leading-tight"
              data-testid="structure-inspector-title"
            >
              {title}
            </h2>
            <div className="text-[11px] text-[#ccb69c] leading-tight mt-0.5 truncate">
              {subtitle}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          <button
            type="button"
            onClick={() => onFocusTile(focusX, focusZ)}
            aria-label="Center camera on structure"
            title="Center camera on structure"
            className="px-btn w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer text-[#56cfe1] hover:text-[#80ed99] transition-colors"
          >
            <HudPixelIcon kind="center" className="w-3.5 h-3.5 sm:w-4 sm:h-4 pixelated-canvas" />
          </button>
          <button
            type="button"
            data-testid="structure-inspector-close-btn"
            onClick={onClose}
            aria-label="Close structure inspector"
            title="Close"
            className="px-btn w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer text-[#9e866f] hover:text-[#f4e7d4] text-xs font-bold transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    );

    const renderMissing = (label: string) => (
      <aside
        aria-label="Structure Information"
        data-testid="structure-inspector-panel"
        className={`pointer-events-auto absolute ${positionClass} w-[min(330px,100%)] sm:w-[348px] px-panel p-3 flex flex-col gap-2.5`}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs sm:text-sm font-bold text-[#f4e7d4]">{label}</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-btn w-7 h-7 flex items-center justify-center cursor-pointer text-[#9e866f] hover:text-[#f4e7d4] text-xs font-bold"
          >
            ✕
          </button>
        </div>
        <div className="px-card p-2.5 text-xs text-[#b09880]">
          This structure no longer stands at its site.
        </div>
      </aside>
    );

    if (structureRef.kind === 'building') {
      const b = sim.buildings.find((item) => item.id === structureRef.id && item.hp > 0);
      if (!b) return renderMissing('Structure Destroyed');

      const def = BUILDING_DEF_BY_TYPE.get(b.type);
      const tile = getTile(sim, b.tileX, b.tileZ);
      const sid = b.settlementId ?? 'city_default';
      const kid = getKingdomId(sim, sid);
      const species: SpeciesId = b.species ?? sim.settlementSpecies?.[sid] ?? 'human';
      const cityName =
        sim.settlementNames?.[sid] || createSeededNomadName(sid, sim.seed, species);
      const kingdomName = sim.settlementNames?.[kid] || cityName;
      const epInfo = EPOCHS[Math.max(0, Math.min(EPOCHS.length - 1, b.epochLevel))] ?? EPOCHS[0];
      const hpPct = Math.max(0, Math.min(100, Math.round((b.hp / Math.max(1, b.maxHp)) * 100)));
      const buildPct = Math.max(0, Math.min(100, Math.round(b.constructionProgress)));
      const upgradePct = Math.max(0, Math.min(100, Math.round(b.upgradeProgress ?? 0)));
      const prodMult = getBuildingEpochProductionMult(b.epochLevel);
      const popCapBonus = def ? getBuildingPopCapBonus(def, b.epochLevel) : 0;

      const productionEntries = def
        ? RESOURCE_LABELS.filter(({ key }) => (def.productionPerSec[key] ?? 0) > 0).map(({ key, label }) => ({
            key,
            label,
            rate: (def.productionPerSec[key] ?? 0) * prodMult,
          }))
        : [];

      const activeStatuses: { label: string; color: string }[] = [];
      if (buildPct < 100) activeStatuses.push({ label: 'Under Construction', color: 'text-[#f2c478]' });
      if (b.blessedTimer > 0) activeStatuses.push({ label: 'Blessed', color: 'text-[#80ed99]' });
      if (b.cursedTimer > 0) activeStatuses.push({ label: 'Cursed', color: 'text-[#ff8f6b]' });
      if (b.shieldTimer > 0) activeStatuses.push({ label: 'Shielded', color: 'text-[#56cfe1]' });
      if (tile && tile.onFireTimer > 0) activeStatuses.push({ label: 'On Fire', color: 'text-[#ff6b4a]' });
      if (b.isWaterBuilt) activeStatuses.push({ label: 'Sea Platform', color: 'text-[#56cfe1]' });

      return (
        <aside
          aria-label="Structure Information"
          data-testid="structure-inspector-panel"
          className={`pointer-events-auto absolute ${positionClass} w-[min(330px,100%)] sm:w-[348px] max-h-[min(380px,100%)] sm:max-h-full px-panel p-2.5 sm:p-3.5 flex flex-col gap-2.5 overflow-y-auto`}
        >
          {renderHeader(
            def?.name ?? b.type,
            `${formatSpeciesLabel(species)} Structure · ${epInfo.name}`,
            b.tileX,
            b.tileZ,
            <BuildingPixelIcon building={b.type} className="w-7 h-7 sm:w-8 sm:h-8 pixelated-canvas" />,
          )}

          {/* HP & Construction Bars */}
          <div className="space-y-2 text-xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#bfa88f]">Integrity</span>
                <span className="font-pixel-num text-[#f4e7d4] tabular-nums">
                  {Math.round(b.hp)} / {Math.round(b.maxHp)} HP
                </span>
              </div>
              <div className="px-bar-track w-full h-2.5 overflow-hidden">
                <div
                  className={`px-bar-fill transition-all duration-150 ${
                    hpPct > 55 ? 'bg-[#6ec97a]' : hpPct > 25 ? 'bg-[#d9a441]' : 'bg-[#d9534f]'
                  }`}
                  style={{ width: `${hpPct}%` }}
                />
              </div>
            </div>

            {buildPct < 100 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#f2c478]">Construction</span>
                  <span className="font-pixel-num text-[#f2c478] tabular-nums">{buildPct}%</span>
                </div>
                <div className="px-bar-track w-full h-2.5 overflow-hidden">
                  <div
                    className="px-bar-fill transition-all duration-150 bg-[#d9a441]"
                    style={{ width: `${buildPct}%` }}
                  />
                </div>
              </div>
            )}

            {buildPct >= 100 && b.epochLevel < EPOCHS.length - 1 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#b09880]">Era Retrofit</span>
                  <span className="font-pixel-num text-[#ccb69c] tabular-nums">{upgradePct}%</span>
                </div>
                <div className="px-bar-track w-full h-2 overflow-hidden">
                  <div
                    className="px-bar-fill transition-all duration-150 bg-[#56cfe1]"
                    style={{ width: `${upgradePct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Core Stats */}
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="px-card px-2 py-1.5 flex items-center justify-between gap-1">
              <span className="text-[11px] text-[#b09880]">Era Output</span>
              <span className="font-pixel-num text-[11px] font-bold text-[#80ed99] tabular-nums">
                ×{prodMult.toFixed(2)}
              </span>
            </div>
            <div className="px-card px-2 py-1.5 flex items-center justify-between gap-1">
              <span className="text-[11px] text-[#b09880]">Housing</span>
              <span className="font-pixel-num text-[11px] font-bold text-[#f4e7d4] tabular-nums">
                {popCapBonus > 0 ? `+${popCapBonus}` : '—'}
              </span>
            </div>
          </div>

          {/* Live Production */}
          {productionEntries.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-[#423229]">
              <div className="text-[10px] font-semibold text-[#8f7862]">
                {buildPct >= 100 ? 'Output / sec' : 'Output when Built'}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {productionEntries.map(({ key, label, rate }) => (
                  <div
                    key={key}
                    className="px-card px-2 py-1 flex items-center justify-between gap-1 text-[11px]"
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <ResourceIconSvg resource={key} className="w-3.5 h-3.5 pixelated-canvas shrink-0" />
                      <span className="text-[#ccb69c] truncate">{label}</span>
                    </div>
                    <span className="font-pixel-num text-[#80ed99] font-bold tabular-nums">
                      +{rate.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata Rows */}
          <div className="space-y-1 pt-1 border-t border-[#423229] text-xs text-[#bfa88f]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#8f7862]">Settlement</span>
              <span className="text-[#f4e7d4] font-medium truncate">{cityName}</span>
            </div>
            {kid !== sid && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#8f7862]">Kingdom</span>
                <span className="text-[#f4e7d4] font-medium truncate">{kingdomName}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#8f7862]">Coordinates</span>
              <span className="font-pixel-num text-[11px] text-[#ccb69c] tabular-nums">
                ({b.tileX}, {b.tileZ})
              </span>
            </div>
            {activeStatuses.length > 0 && (
              <div className="flex items-start justify-between gap-2 pt-0.5">
                <span className="text-[#8f7862] shrink-0">Status</span>
                <span className="text-[11px] font-semibold text-right">
                  {activeStatuses.map((st, idx) => (
                    <span key={st.label} className={st.color}>
                      {idx > 0 ? ' · ' : ''}
                      {st.label}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>

          {def?.roleSummary && (
            <p className="text-[11px] text-[#a7927c] leading-snug pt-1 border-t border-[#423229]">
              {def.roleSummary}
            </p>
          )}

          {onDemolishBuilding && (
            <div className="pt-1 border-t border-[#423229] flex justify-end">
              <button
                type="button"
                data-testid="structure-inspector-demolish-btn"
                onClick={() => onDemolishBuilding(b.id)}
                className="px-btn px-2.5 py-1 text-[11px] font-semibold text-[#ff8f6b] hover:text-[#ffb499] cursor-pointer"
              >
                Demolish Structure
              </button>
            </div>
          )}
        </aside>
      );
    }

    if (structureRef.kind === 'wonder') {
      const w = (sim.worldWonders ?? []).find((item) => item.id === structureRef.id);
      if (!w) return renderMissing('World Wonder Lost');

      const epIdx = Math.max(0, Math.min(EPOCHS.length - 1, w.epochLevel ?? 2));
      const epInfo = EPOCHS[epIdx] ?? EPOCHS[2];
      const maxHp = w.maxHp ?? 2600;
      const hp = w.hp ?? maxHp;
      const hpPct = Math.max(0, Math.min(100, Math.round((hp / Math.max(1, maxHp)) * 100)));
      const buildPct = Math.max(0, Math.min(100, Math.round(w.constructionProgress ?? 100)));
      const kingdomName =
        sim.settlementNames?.[w.kingdomId] ||
        createSeededNomadName(w.kingdomId, sim.seed, w.species);

      return (
        <aside
          aria-label="World Wonder Information"
          data-testid="structure-inspector-panel"
          className={`pointer-events-auto absolute ${positionClass} w-[min(330px,100%)] sm:w-[348px] px-panel p-2.5 sm:p-3.5 flex flex-col gap-2.5`}
        >
          {renderHeader(
            w.name,
            `${formatSpeciesLabel(w.species)} World Wonder · ${epInfo.name}`,
            w.tileX,
            w.tileZ,
            <UnitPixelIcon role={w.species} className="w-7 h-7 sm:w-8 sm:h-8" />,
          )}

          <div className="space-y-2 text-xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#bfa88f]">Monument Integrity</span>
                <span className="font-pixel-num text-[#f4e7d4] tabular-nums">
                  {Math.round(hp)} / {Math.round(maxHp)} HP
                </span>
              </div>
              <div className="px-bar-track w-full h-2.5 overflow-hidden">
                <div
                  className={`px-bar-fill transition-all duration-150 ${
                    hpPct > 55 ? 'bg-[#d9a441]' : hpPct > 25 ? 'bg-[#e08b3e]' : 'bg-[#d9534f]'
                  }`}
                  style={{ width: `${hpPct}%` }}
                />
              </div>
            </div>

            {buildPct < 100 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#f2c478]">Construction Progress</span>
                  <span className="font-pixel-num text-[#f2c478] tabular-nums">{buildPct}%</span>
                </div>
                <div className="px-bar-track w-full h-2.5 overflow-hidden">
                  <div
                    className="px-bar-fill transition-all duration-150 bg-[#56cfe1]"
                    style={{ width: `${buildPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="px-card px-2 py-1.5 flex items-center justify-between gap-1">
              <span className="text-[11px] text-[#b09880]">Lore Aura</span>
              <span className="font-pixel-num text-[11px] font-bold text-[#56cfe1] tabular-nums">
                {buildPct >= 100 ? '+3.5/s' : 'Pending'}
              </span>
            </div>
            <div className="px-card px-2 py-1.5 flex items-center justify-between gap-1">
              <span className="text-[11px] text-[#b09880]">Faith Aura</span>
              <span className="font-pixel-num text-[11px] font-bold text-[#f2c478] tabular-nums">
                {buildPct >= 100 ? '+2.5/s' : 'Pending'}
              </span>
            </div>
          </div>

          <div className="space-y-1 pt-1 border-t border-[#423229] text-xs text-[#bfa88f]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#8f7862]">Patron Kingdom</span>
              <span className="text-[#f4e7d4] font-medium truncate">{kingdomName}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#8f7862]">Founded</span>
              <span className="font-pixel-num text-[11px] text-[#ccb69c] tabular-nums">
                Year {w.builtYear}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#8f7862]">Coordinates</span>
              <span className="font-pixel-num text-[11px] text-[#ccb69c] tabular-nums">
                ({w.tileX}, {w.tileZ})
              </span>
            </div>
          </div>

          {onDemolishWonder && (
            <div className="pt-1 border-t border-[#423229] flex justify-end">
              <button
                type="button"
                onClick={() => onDemolishWonder(w.id)}
                className="px-btn px-2.5 py-1 text-[11px] font-semibold text-[#ff8f6b] hover:text-[#ffb499] cursor-pointer"
              >
                Raze Wonder
              </button>
            </div>
          )}
        </aside>
      );
    }

    if (structureRef.kind === 'memorial') {
      const m = (sim.battleMemorials ?? []).find((item) => item.id === structureRef.id);
      if (!m) return renderMissing('Memorial Cleared');

      return (
        <aside
          aria-label="Battle Memorial Information"
          data-testid="structure-inspector-panel"
          className={`pointer-events-auto absolute ${positionClass} w-[min(330px,100%)] sm:w-[348px] px-panel p-2.5 sm:p-3.5 flex flex-col gap-2.5`}
        >
          {renderHeader(
            m.label,
            'Historic Battle Memorial',
            m.tileX,
            m.tileZ,
            <UnitPixelIcon role={m.species ?? 'human'} className="w-7 h-7 sm:w-8 sm:h-8" />,
          )}
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="px-card px-2 py-1.5 flex items-center justify-between gap-1">
              <span className="text-[11px] text-[#b09880]">Fallen</span>
              <span className="font-pixel-num text-[11px] font-bold text-[#ff8f6b] tabular-nums">
                {m.fallenCount}
              </span>
            </div>
            <div className="px-card px-2 py-1.5 flex items-center justify-between gap-1">
              <span className="text-[11px] text-[#b09880]">Era</span>
              <span className="font-pixel-num text-[11px] font-bold text-[#f2c478] tabular-nums">
                {m.yearLabel}
              </span>
            </div>
          </div>
          <div className="space-y-1 pt-1 border-t border-[#423229] text-xs text-[#bfa88f]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#8f7862]">Honored Kin</span>
              <span className="text-[#f4e7d4] font-medium">{formatSpeciesLabel(m.species)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#8f7862]">Coordinates</span>
              <span className="font-pixel-num text-[11px] text-[#ccb69c] tabular-nums">
                ({m.tileX}, {m.tileZ})
              </span>
            </div>
          </div>
        </aside>
      );
    }

    if (structureRef.kind === 'bridge') {
      const tile = getTile(sim, structureRef.tileX, structureRef.tileZ);
      if (
        !tile ||
        (tile.terrain !== 'stone_road' && tile.terrain !== 'rail_track')
      ) {
        return renderMissing('Bridge Collapsed');
      }
      const bridgeEp = getLocalBridgeEpoch(sim, tile.x, tile.z);
      const eraName =
        BRIDGE_ERA_NAMES[Math.max(0, Math.min(BRIDGE_ERA_NAMES.length - 1, bridgeEp))];
      const deckLabel = tile.terrain === 'rail_track' ? 'Rail Viaduct' : 'Roadway Span';

      return (
        <aside
          aria-label="Bridge Information"
          data-testid="structure-inspector-panel"
          className={`pointer-events-auto absolute ${positionClass} w-[min(330px,100%)] sm:w-[348px] px-panel p-2.5 sm:p-3.5 flex flex-col gap-2.5`}
        >
          {renderHeader(
            eraName,
            `${deckLabel} · ${EPOCHS[bridgeEp]?.name ?? EPOCHS[0].name}`,
            tile.x,
            tile.z,
            <BuildingPixelIcon building="rail_station" className="w-7 h-7 sm:w-8 sm:h-8 pixelated-canvas" />,
          )}
          <div className="space-y-1 pt-1 border-t border-[#423229] text-xs text-[#bfa88f]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#8f7862]">Surface</span>
              <span className="text-[#f4e7d4] font-medium">{deckLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#8f7862]">Elevation</span>
              <span className="font-pixel-num text-[11px] text-[#ccb69c] tabular-nums">
                Level {tile.height}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#8f7862]">Coordinates</span>
              <span className="font-pixel-num text-[11px] text-[#ccb69c] tabular-nums">
                ({tile.x}, {tile.z})
              </span>
            </div>
          </div>
        </aside>
      );
    }

    // Ancient Ruin / Atlantis Ruin
    const tile = getTile(sim, structureRef.tileX, structureRef.tileZ);
    if (
      !tile ||
      (tile.resourceNode !== 'ancient_ruin' && tile.resourceNode !== 'atlantis_ruin')
    ) {
      return renderMissing('Ruin Vanished');
    }
    const isAtlantis = tile.resourceNode === 'atlantis_ruin';
    const isExplored = tile.resourceAmount <= 0;

    return (
      <aside
        aria-label="Ancient Ruin Information"
        data-testid="structure-inspector-panel"
        className={`pointer-events-auto absolute ${positionClass} w-[min(330px,100%)] sm:w-[348px] px-panel p-2.5 sm:p-3.5 flex flex-col gap-2.5`}
      >
        {renderHeader(
          isAtlantis ? 'Sunken Atlantis Ruin' : 'Ancient Relic Ruin',
          isExplored ? 'Excavated Site' : 'Unexplored Lore Site',
          tile.x,
          tile.z,
          <BuildingPixelIcon building="ziggurat" className="w-7 h-7 sm:w-8 sm:h-8 pixelated-canvas" />,
        )}
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <div className="px-card px-2 py-1.5 flex items-center justify-between gap-1">
            <span className="text-[11px] text-[#b09880]">Status</span>
            <span
              className={`text-[11px] font-bold ${
                isExplored ? 'text-[#9e866f]' : 'text-[#80ed99]'
              }`}
            >
              {isExplored ? 'Explored' : 'Unexplored'}
            </span>
          </div>
          <div className="px-card px-2 py-1.5 flex items-center justify-between gap-1">
            <span className="text-[11px] text-[#b09880]">Relics</span>
            <span className="font-pixel-num text-[11px] font-bold text-[#56cfe1] tabular-nums">
              {Math.max(0, Math.round(tile.resourceAmount))}
            </span>
          </div>
        </div>
        <div className="space-y-1 pt-1 border-t border-[#423229] text-xs text-[#bfa88f]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#8f7862]">Elevation</span>
            <span className="font-pixel-num text-[11px] text-[#ccb69c] tabular-nums">
              Level {tile.height}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#8f7862]">Coordinates</span>
            <span className="font-pixel-num text-[11px] text-[#ccb69c] tabular-nums">
              ({tile.x}, {tile.z})
            </span>
          </div>
        </div>
      </aside>
    );
  },
);
