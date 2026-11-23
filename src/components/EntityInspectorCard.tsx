import React, { useMemo, useState } from 'react';
import { getEntityInspectProfile } from '../game/entityInspector';
import {
  SimulationState,
  UnitEntity,
  UnitStatKey,
  UnitStatusEffect,
} from '../game/types';
import {
  ItemSlot,
  TraitCategory,
  UNIT_GENES,
  UNIT_ITEMS,
  UNIT_TRAITS,
  formatModifierList,
} from '../game/unitCustomization';
import { HudPixelIcon, InspectorPixelIcon, UnitPixelIcon } from './GameIcons';

export interface UnitEditHandlers {
  onSetUnitStat?: (unitId: string, stat: UnitStatKey, value: number) => void;
  onResetUnitStats?: (unitId: string) => void;
  onHealUnit?: (unitId: string) => void;
  onSetUnitAge?: (unitId: string, ageYears: number) => void;
  onSetUnitSizeScale?: (unitId: string, sizeScale: number) => void;
  onToggleUnitTrait?: (unitId: string, traitId: string) => void;
  onToggleUnitGene?: (unitId: string, geneName: string) => void;
  onAddUnitItem?: (unitId: string, itemName: string) => void;
  onRemoveUnitItem?: (unitId: string, itemIndex: number) => void;
}

interface EntityInspectorCardProps extends UnitEditHandlers {
  sim: SimulationState;
  hoveredUnit: UnitEntity | null;
  selectedUnit: UnitEntity | null;
  favoriteUnits: UnitEntity[];
  followingEntityId?: string | null;
  onToggleFavorite: (unitId: string) => void;
  onSelectUnit: (unitId: string | null) => void;
  onFocusUnit: (unit: UnitEntity) => void;
  onRenameUnit?: (unitId: string, newName: string) => void;
  onRenameSettlement?: (settlementId: string, newName: string) => void;
}

type InspectorTab = 'stats' | 'traits' | 'genes' | 'items' | 'favorites';

interface EditableStatMeta {
  key: UnitStatKey;
  label: string;
  step: number;
  min: number;
  max: number;
  suffix?: string;
}

const EDITABLE_STAT_ROWS: EditableStatMeta[] = [
  { key: 'maxHp', label: 'Max HP', step: 25, min: 10, max: 9999 },
  { key: 'attackDamage', label: 'Damage', step: 5, min: 1, max: 999 },
  { key: 'armor', label: 'Armor', step: 5, min: 0, max: 75, suffix: '%' },
  { key: 'speed', label: 'Speed', step: 0.5, min: 0.4, max: 12 },
  { key: 'critChance', label: 'Crit', step: 5, min: 0, max: 85, suffix: '%' },
  { key: 'attackRange', label: 'Range', step: 0.5, min: 0.8, max: 14 },
  { key: 'regenPerSec', label: 'Regen', step: 1, min: 0, max: 50, suffix: '/s' },
];

const TRAIT_FILTERS: { id: 'all' | TraitCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'combat', label: 'Combat' },
  { id: 'body', label: 'Body' },
  { id: 'mind', label: 'Mind' },
  { id: 'special', label: 'Special' },
];

const ITEM_FILTERS: { id: Exclude<ItemSlot, 'natural'>; label: string }[] = [
  { id: 'weapon', label: 'Weapons' },
  { id: 'armor', label: 'Armor' },
  { id: 'tool', label: 'Tools' },
  { id: 'trinket', label: 'Trinkets' },
];

function formatEffectName(effect: UnitStatusEffect): string {
  switch (effect) {
    case 'blessed':
      return 'Blessed';
    case 'shielded':
      return 'Shielded';
    case 'frenzied':
      return 'Frenzied';
    case 'plagued':
      return 'Plagued';
    case 'cursed':
      return 'Cursed';
    case 'frozen':
      return 'Frozen';
  }
}

function formatSlotLabel(slot: ItemSlot): string {
  switch (slot) {
    case 'weapon':
      return 'Weapon';
    case 'armor':
      return 'Armor';
    case 'tool':
      return 'Tool';
    case 'trinket':
      return 'Trinket';
    case 'natural':
      return 'Natural';
  }
}

export const EntityInspectorCard: React.FC<EntityInspectorCardProps> = ({
  sim,
  hoveredUnit,
  selectedUnit,
  favoriteUnits,
  followingEntityId,
  onToggleFavorite,
  onSelectUnit,
  onFocusUnit,
  onRenameUnit,
  onRenameSettlement,
  onSetUnitStat,
  onResetUnitStats,
  onHealUnit,
  onSetUnitAge,
  onSetUnitSizeScale,
  onToggleUnitTrait,
  onToggleUnitGene,
  onAddUnitItem,
  onRemoveUnitItem,
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('stats');
  const [minimized, setMinimized] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [traitFilter, setTraitFilter] = useState<'all' | TraitCategory>('all');
  const [geneFilter, setGeneFilter] = useState<'all' | 'mutation' | 'intrinsic'>('all');
  const [itemFilter, setItemFilter] = useState<Exclude<ItemSlot, 'natural'>>('weapon');
  const [editingTarget, setEditingTarget] = useState<{
    kind: 'unit' | 'settlement';
    id: string;
    label: string;
  } | null>(null);
  const [draftName, setDraftName] = useState<string>('');

  const commitRename = () => {
    if (!editingTarget) return;
    const trimmed = draftName.trim();
    if (trimmed.length > 0) {
      if (editingTarget.kind === 'unit') onRenameUnit?.(editingTarget.id, trimmed);
      else if (editingTarget.kind === 'settlement') onRenameSettlement?.(editingTarget.id, trimmed);
    }
    setEditingTarget(null);
  };

  // Strictly show entities only (selected unit takes priority over hovered unit)
  const displayUnit = selectedUnit ?? hoveredUnit;
  const isSelectedDisplayed = Boolean(
    displayUnit && selectedUnit && displayUnit.id === selectedUnit.id,
  );
  const isFollowing = Boolean(
    displayUnit && followingEntityId && displayUnit.id === followingEntityId,
  );
  const profile = displayUnit ? getEntityInspectProfile(sim, displayUnit) : null;

  const canEdit = Boolean(
    onSetUnitStat || onToggleUnitTrait || onToggleUnitGene || onAddUnitItem,
  );

  const toggleEditMode = () => {
    if (!displayUnit) return;
    if (!editMode && !isSelectedDisplayed) {
      onSelectUnit(displayUnit.id);
    }
    setEditMode((prev) => !prev);
  };

  const activeTraitIds = useMemo(
    () => new Set(profile?.traits.map((t) => t.id) ?? []),
    [profile?.traits],
  );
  const activeGeneNames = useMemo(
    () => new Set(profile?.genes ?? []),
    [profile?.genes],
  );

  const filteredTraits = useMemo(
    () =>
      traitFilter === 'all'
        ? UNIT_TRAITS
        : UNIT_TRAITS.filter((t) => t.category === traitFilter),
    [traitFilter],
  );

  const filteredGenes = useMemo(
    () =>
      geneFilter === 'all'
        ? UNIT_GENES
        : UNIT_GENES.filter((g) => g.kind === geneFilter),
    [geneFilter],
  );

  const filteredCatalogItems = useMemo(
    () => UNIT_ITEMS.filter((item) => item.slot === itemFilter),
    [itemFilter],
  );

  if (minimized) {
    return (
      <button
        type="button"
        data-testid="entity-inspector-expand"
        onClick={() => setMinimized(false)}
        className="pointer-events-auto px-panel px-2.5 py-1.5 text-xs font-bold text-[#f5b742] cursor-pointer self-start shrink-0"
      >
        {profile ? `Inspect: ${profile.name}` : 'Inspect >'}
      </button>
    );
  }

  return (
    <aside
      aria-label="Entity Information"
      data-testid="entity-inspector-panel"
      className="pointer-events-auto absolute left-0 top-0 z-10 w-[min(320px,100%)] sm:w-[360px] max-h-[min(340px,100%)] sm:max-h-full px-panel p-2.5 sm:p-3.5 flex flex-col gap-2.5 overflow-y-auto"
    >
      {profile && displayUnit ? (
        <>
          {/* Header Block: Avatar, Name, Subtitle & Primary Actions */}
          <div className="flex items-start justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center bg-[#191613] border border-[#2f2720]"
                aria-hidden="true"
              >
                <UnitPixelIcon role={displayUnit.role} className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <div className="min-w-0 flex-1">
                {editingTarget?.kind === 'unit' && editingTarget.id === displayUnit.id ? (
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
                      data-testid="inspector-rename-unit-input"
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Escape') setEditingTarget(null);
                      }}
                      className="w-full min-w-0 bg-[#141210] border border-[#f5b742] px-1.5 py-0.5 text-xs text-[#f2ece1] outline-none"
                    />
                    <button
                      type="submit"
                      className="px-btn-active px-1.5 py-0.5 text-[10px] font-bold text-[#f5b742] cursor-pointer shrink-0"
                    >
                      Save
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1 min-w-0">
                    <h2
                      className="text-xs sm:text-sm font-bold text-[#f2ece1] truncate leading-tight"
                      data-testid="inspector-entity-name"
                    >
                      {profile.name}
                    </h2>
                    {onRenameUnit && (
                      <button
                        type="button"
                        data-testid="inspector-rename-unit-btn"
                        aria-label="Rename entity"
                        title="Rename entity"
                        onClick={() => {
                          if (!isSelectedDisplayed) onSelectUnit(displayUnit.id);
                          setEditingTarget({ kind: 'unit', id: displayUnit.id, label: 'Entity' });
                          setDraftName(displayUnit.name);
                        }}
                        className="text-[11px] text-[#9e9486] hover:text-[#f5b742] cursor-pointer shrink-0 px-0.5"
                      >
                        ✎
                      </button>
                    )}
                  </div>
                )}
                <div className="text-[11px] text-[#cfc6b8] leading-tight mt-0.5 truncate">
                  <span>{profile.subtitle}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1 shrink-0 pt-0.5">
              {canEdit && (
                <button
                  type="button"
                  data-testid="inspector-edit-toggle-btn"
                  onClick={toggleEditMode}
                  aria-label={editMode ? 'Finish editing unit' : 'Edit unit stats and gear'}
                  title={editMode ? 'Done editing' : 'Edit stats, traits, genes & items'}
                  className={`h-7 sm:h-8 px-2 flex items-center justify-center cursor-pointer text-[11px] font-bold transition-colors ${
                    editMode
                      ? 'px-btn-active text-[#f5b742]'
                      : 'px-btn text-[#d8cfc2] hover:text-[#f5b742]'
                  }`}
                >
                  {editMode ? 'Done' : 'Edit'}
                </button>
              )}

              {isSelectedDisplayed ? (
                <button
                  type="button"
                  data-testid="inspector-favorite-btn"
                  onClick={() => onToggleFavorite(displayUnit.id)}
                  aria-label={profile.favorite ? 'Unfavorite entity' : 'Favorite entity'}
                  title={profile.favorite ? 'Remove from favorites' : 'Add to favorites'}
                  className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer transition-colors ${
                    profile.favorite
                      ? 'px-btn-active text-[#ffd166]'
                      : 'px-btn text-[#a89f91] hover:text-[#ffd166]'
                  }`}
                >
                  <HudPixelIcon kind={profile.favorite ? 'starOn' : 'star'} className="w-3.5 h-3.5 sm:w-4 sm:h-4 pixelated-canvas" />
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="inspector-select-favorite-btn"
                  onClick={() => {
                    onSelectUnit(displayUnit.id);
                    if (!profile.favorite) onToggleFavorite(displayUnit.id);
                  }}
                  aria-label="Select and favorite entity"
                  title="Select & Favorite"
                  className="px-btn w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer text-[#a89f91] hover:text-[#ffd166] transition-colors"
                >
                  <HudPixelIcon kind={profile.favorite ? 'starOn' : 'star'} className="w-3.5 h-3.5 sm:w-4 sm:h-4 pixelated-canvas" />
                </button>
              )}

              {selectedUnit && (
                <button
                  type="button"
                  onClick={() => onFocusUnit(selectedUnit)}
                  aria-label={isFollowing ? 'Stop following entity' : 'Follow entity with camera'}
                  title={isFollowing ? 'Following entity (click to stop)' : 'Follow entity with camera'}
                  className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer transition-colors ${
                    isFollowing
                      ? 'px-btn-active text-[#80ed99] border-[#40916c]'
                      : 'px-btn text-[#56cfe1] hover:text-[#80ed99]'
                  }`}
                >
                  <HudPixelIcon kind="center" className="w-3.5 h-3.5 sm:w-4 sm:h-4 pixelated-canvas" />
                </button>
              )}

              {selectedUnit && (
                <button
                  type="button"
                  onClick={() => {
                    setEditMode(false);
                    onSelectUnit(null);
                  }}
                  aria-label="Unpin selection"
                  title="Unpin selection"
                  className="px-btn w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer text-[#8f8679] hover:text-[#f2ece1] transition-colors"
                >
                  <HudPixelIcon kind="unpin" className="w-3.5 h-3.5 sm:w-4 sm:h-4 pixelated-canvas" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="sm:hidden px-btn w-7 h-7 flex items-center justify-center cursor-pointer text-[#b8afa2] hover:text-[#f2ece1]"
                aria-label="Minimize Inspector"
                title="Minimize"
              >
                <HudPixelIcon kind="chevronUp" className="w-3.5 h-3.5 pixelated-canvas" />
              </button>
            </div>
          </div>

          {/* Integrated Health Gauge */}
          <div className="space-y-1 shrink-0">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-[#a89f91]">
                <InspectorPixelIcon kind="heart" className="w-3.5 h-3.5 pixelated-canvas" />
                <span>Health</span>
              </div>
              <div className="flex items-center gap-2">
                {editMode && onHealUnit && (
                  <button
                    type="button"
                    data-testid="inspector-heal-btn"
                    onClick={() => onHealUnit(displayUnit.id)}
                    className="px-btn px-1.5 py-0.5 text-[10px] font-bold text-[#80ed99] cursor-pointer"
                  >
                    Heal Full
                  </button>
                )}
                <span className="font-pixel-num text-[11px] text-[#f2ece1] tabular-nums">
                  {profile.informations.hp} / {profile.informations.maxHp}
                </span>
              </div>
            </div>
            <div className="w-full h-1.5 bg-[#191613] overflow-hidden">
              <div
                className="h-full transition-all duration-200"
                style={{
                  width: `${profile.informations.hpPercent}%`,
                  backgroundColor:
                    profile.informations.hpPercent > 50
                      ? '#80ed99'
                      : profile.informations.hpPercent > 25
                        ? '#f5b742'
                        : '#ff6b6b',
                }}
              />
            </div>
          </div>

          {/* Section Navigation Tabs: All tabs always visible without clipping */}
          <div className="flex items-stretch gap-1 border-b border-[#2c2620] pb-1.5 shrink-0">
            <div className="grid grid-cols-4 gap-1 flex-1 min-w-0">
              {(
                [
                  { id: 'stats', label: 'Stats', count: null },
                  { id: 'traits', label: 'Traits', count: profile.traits.length },
                  { id: 'genes', label: 'Genes', count: profile.genes.length },
                  { id: 'items', label: 'Items', count: profile.itemDetails.length },
                ] as { id: InspectorTab; label: string; count: number | null }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`inspector-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-w-0 px-1 py-1 text-[10px] sm:text-[11px] font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${
                    activeTab === tab.id ? 'px-btn-active text-[#f5b742]' : 'px-btn text-[#a89f91]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span className="font-pixel-num text-[9px] opacity-80 tabular-nums">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {favoriteUnits.length > 0 && (
              <button
                type="button"
                data-testid="inspector-tab-favorites"
                onClick={() => setActiveTab('favorites')}
                className={`shrink-0 px-1.5 py-1 text-[10px] sm:text-[11px] font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${
                  activeTab === 'favorites'
                    ? 'px-btn-active text-[#ffd166]'
                    : 'px-btn text-[#a89f91]'
                }`}
                title="Favorite units"
              >
                <HudPixelIcon kind="starOn" className="w-3 h-3 pixelated-canvas shrink-0" />
                <span className="font-pixel-num text-[9px] tabular-nums">{favoriteUnits.length}</span>
              </button>
            )}
          </div>

          {/* ================================================================
              TAB 1: STATS (Read-only & Inline Edit Mode)
             ================================================================ */}
          {activeTab === 'stats' && (
            <div className="space-y-2.5 text-xs" data-testid="inspector-stats-tab">
              {editMode && onSetUnitStat ? (
                <div className="space-y-1.5 bg-[#191613] border border-[#2f2720] p-2">
                  <div className="flex items-center justify-between pb-1 border-b border-[#2c2620]">
                    <span className="text-[11px] font-bold text-[#f5b742]">Edit Base Stats</span>
                    {onResetUnitStats && profile.hasStatOverrides && (
                      <button
                        type="button"
                        data-testid="inspector-reset-stats-btn"
                        onClick={() => onResetUnitStats(displayUnit.id)}
                        className="px-btn px-1.5 py-0.5 text-[10px] text-[#ff9f68] cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  {EDITABLE_STAT_ROWS.map((row) => {
                    const currentVal = profile.baseStats[row.key];
                    const isDecimal = row.step < 1;
                    return (
                      <div
                        key={row.key}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="text-[#cfc6b8] w-16 shrink-0">{row.label}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            data-testid={`stat-dec-${row.key}`}
                            onClick={() =>
                              onSetUnitStat(
                                displayUnit.id,
                                row.key,
                                Math.max(row.min, Number((currentVal - row.step).toFixed(2))),
                              )
                            }
                            className="px-btn w-6 h-6 flex items-center justify-center text-xs font-bold text-[#f2ece1] cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            data-testid={`stat-input-${row.key}`}
                            value={isDecimal ? Number(currentVal.toFixed(1)) : Math.round(currentVal)}
                            step={row.step}
                            min={row.min}
                            max={row.max}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const parsed = parseFloat(e.target.value);
                              if (!Number.isNaN(parsed)) {
                                onSetUnitStat(displayUnit.id, row.key, parsed);
                              }
                            }}
                            className="w-16 bg-[#141210] border border-[#3a332b] focus:border-[#f5b742] px-1.5 py-0.5 text-center font-pixel-num text-[11px] text-[#f2ece1] tabular-nums outline-none"
                          />
                          <button
                            type="button"
                            data-testid={`stat-inc-${row.key}`}
                            onClick={() =>
                              onSetUnitStat(
                                displayUnit.id,
                                row.key,
                                Math.min(row.max, Number((currentVal + row.step).toFixed(2))),
                              )
                            }
                            className="px-btn w-6 h-6 flex items-center justify-center text-xs font-bold text-[#f2ece1] cursor-pointer"
                          >
                            +
                          </button>
                          <span className="w-4 text-[10px] text-[#8f8679]">{row.suffix ?? ''}</span>
                        </div>
                      </div>
                    );
                  })}

                  {onSetUnitAge && (
                    <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-[#2c2620]">
                      <span className="text-[#cfc6b8] w-16 shrink-0">Age (y)</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onSetUnitAge(displayUnit.id, Math.max(0, profile.informations.ageYears - 5))
                          }
                          className="px-btn w-6 h-6 flex items-center justify-center text-xs font-bold text-[#f2ece1] cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          data-testid="stat-input-age"
                          value={profile.informations.ageYears}
                          min={0}
                          max={9999}
                          onKeyDown={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const parsed = parseInt(e.target.value, 10);
                            if (!Number.isNaN(parsed)) onSetUnitAge(displayUnit.id, parsed);
                          }}
                          className="w-16 bg-[#141210] border border-[#3a332b] focus:border-[#f5b742] px-1.5 py-0.5 text-center font-pixel-num text-[11px] text-[#f2ece1] tabular-nums outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            onSetUnitAge(displayUnit.id, profile.informations.ageYears + 5)
                          }
                          className="px-btn w-6 h-6 flex items-center justify-center text-xs font-bold text-[#f2ece1] cursor-pointer"
                        >
                          +
                        </button>
                        <span className="w-4 text-[10px] text-[#8f8679]">y</span>
                      </div>
                    </div>
                  )}

                  {onSetUnitSizeScale && (
                    <div className="flex flex-col gap-1.5 text-[11px] pt-1.5 border-t border-[#2c2620]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#cfc6b8] w-16 shrink-0">Size</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              onSetUnitSizeScale(
                                displayUnit.id,
                                Math.max(0.35, Number((profile.informations.sizeScale - 0.15).toFixed(2))),
                              )
                            }
                            className="px-btn w-6 h-6 flex items-center justify-center text-xs font-bold text-[#f2ece1] cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            data-testid="stat-input-size"
                            value={profile.informations.sizeScale}
                            min={0.35}
                            max={4.0}
                            step={0.05}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const parsed = parseFloat(e.target.value);
                              if (!Number.isNaN(parsed)) onSetUnitSizeScale(displayUnit.id, parsed);
                            }}
                            className="w-16 bg-[#141210] border border-[#3a332b] focus:border-[#f5b742] px-1.5 py-0.5 text-center font-pixel-num text-[11px] text-[#f2ece1] tabular-nums outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              onSetUnitSizeScale(
                                displayUnit.id,
                                Math.min(4.0, Number((profile.informations.sizeScale + 0.15).toFixed(2))),
                              )
                            }
                            className="px-btn w-6 h-6 flex items-center justify-center text-xs font-bold text-[#f2ece1] cursor-pointer"
                          >
                            +
                          </button>
                          <span className="w-4 text-[10px] text-[#8f8679]">×</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          data-testid="stat-slider-size"
                          min={0.35}
                          max={4.0}
                          step={0.05}
                          value={profile.informations.sizeScale}
                          onChange={(e) => {
                            const parsed = parseFloat(e.target.value);
                            if (!Number.isNaN(parsed)) onSetUnitSizeScale(displayUnit.id, parsed);
                          }}
                          className="w-full accent-[#f5b742] cursor-pointer h-1.5"
                        />
                        {Math.abs(profile.informations.sizeScale - 1.0) > 0.005 && (
                          <button
                            type="button"
                            onClick={() => onSetUnitSizeScale(displayUnit.id, 1.0)}
                            className="px-btn px-1.5 py-0.5 text-[10px] text-[#cfc6b8] hover:text-[#f5b742] shrink-0 cursor-pointer"
                          >
                            1×
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Compact 2-column stat readout with pixel icons */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-[#191613] px-2 py-1.5 flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] text-[#a89f91]">
                        <InspectorPixelIcon kind="sword" className="w-3.5 h-3.5 shrink-0" />
                        Damage
                      </span>
                      <span className="font-pixel-num text-xs font-bold text-[#ff9f68] tabular-nums">
                        {profile.informations.attackDamage}
                      </span>
                    </div>
                    <div className="bg-[#191613] px-2 py-1.5 flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] text-[#a89f91]">
                        <InspectorPixelIcon kind="shield" className="w-3.5 h-3.5 shrink-0" />
                        Armor
                      </span>
                      <span className="font-pixel-num text-xs font-bold text-[#cbd5e1] tabular-nums">
                        {profile.informations.armor}%
                      </span>
                    </div>
                    <div className="bg-[#191613] px-2 py-1.5 flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] text-[#a89f91]">
                        <InspectorPixelIcon kind="boot" className="w-3.5 h-3.5 shrink-0" />
                        Speed
                      </span>
                      <span className="font-pixel-num text-xs font-bold text-[#56cfe1] tabular-nums">
                        {profile.informations.speed}
                      </span>
                    </div>
                    <div className="bg-[#191613] px-2 py-1.5 flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] text-[#a89f91]">
                        <InspectorPixelIcon kind="crit" className="w-3.5 h-3.5 shrink-0" />
                        Crit
                      </span>
                      <span className="font-pixel-num text-xs font-bold text-[#f5b742] tabular-nums">
                        {profile.informations.critChance}%
                      </span>
                    </div>
                    <div className="bg-[#191613] px-2 py-1.5 flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] text-[#a89f91]">
                        <InspectorPixelIcon kind="range" className="w-3.5 h-3.5 shrink-0" />
                        Range
                      </span>
                      <span className="font-pixel-num text-xs font-bold text-[#f2ece1] tabular-nums">
                        {profile.informations.attackRange}
                      </span>
                    </div>
                    <div className="bg-[#191613] px-2 py-1.5 flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] text-[#a89f91]">
                        <InspectorPixelIcon kind="regen" className="w-3.5 h-3.5 shrink-0" />
                        Regen
                      </span>
                      <span className="font-pixel-num text-xs font-bold text-[#80ed99] tabular-nums">
                        {profile.informations.regenPerSec > 0
                          ? `+${profile.informations.regenPerSec}/s`
                          : '0/s'}
                      </span>
                    </div>
                    <div className="bg-[#191613] px-2 py-1.5 flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] text-[#a89f91]">
                        <InspectorPixelIcon kind="pickaxe" className="w-3.5 h-3.5 shrink-0" />
                        Gather
                      </span>
                      <span className="font-pixel-num text-xs font-bold text-[#e2d8c5] tabular-nums">
                        {Math.round(profile.informations.harvestMult * 100)}%
                      </span>
                    </div>
                    <div className="bg-[#191613] px-2 py-1.5 flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] text-[#a89f91]">
                        <InspectorPixelIcon kind="skull" className="w-3.5 h-3.5 shrink-0" />
                        Kills
                      </span>
                      <span className="font-pixel-num text-xs font-bold text-[#ff8f6b] tabular-nums">
                        {profile.informations.kills}
                      </span>
                    </div>
                  </div>

                  {/* Special active passives summary */}
                  {(profile.informations.fireproof ||
                    profile.informations.thorns ||
                    profile.informations.venomous ||
                    profile.informations.vampiric) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#f5b742] pt-0.5">
                      {profile.informations.fireproof && (
                        <span className="flex items-center gap-1">
                          <InspectorPixelIcon kind="flame" className="w-3 h-3" />
                          Fireproof
                        </span>
                      )}
                      {profile.informations.thorns && (
                        <span className="flex items-center gap-1">
                          <InspectorPixelIcon kind="spike" className="w-3 h-3" />
                          Thorns
                        </span>
                      )}
                      {profile.informations.venomous && (
                        <span className="flex items-center gap-1">
                          <InspectorPixelIcon kind="venom" className="w-3 h-3" />
                          Venomous
                        </span>
                      )}
                      {profile.informations.vampiric && (
                        <span className="flex items-center gap-1">
                          <InspectorPixelIcon kind="blood" className="w-3 h-3" />
                          Lifesteal
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Dragon Flame Breath if applicable */}
              {profile.informations.breathCooldown !== null && (
                <div className="flex items-center justify-between text-xs bg-[#191613] px-2.5 py-1.5">
                  <span className="text-[#b8afa2]">Flame breath</span>
                  <span className="font-pixel-num text-[11px] text-[#f5b742] tabular-nums">
                    {profile.informations.breathCooldown <= 0
                      ? 'Ready'
                      : `${profile.informations.breathCooldown}s`}
                  </span>
                </div>
              )}

              {/* Status Effects */}
              {profile.informations.statusEffects.length > 0 && (
                <div className="flex items-baseline justify-between gap-2 text-xs pt-0.5">
                  <span className="text-[#8f8679] shrink-0">Effects</span>
                  <span className="text-[#80ed99] text-right">
                    {profile.informations.statusEffects.map(formatEffectName).join(', ')}
                  </span>
                </div>
              )}

              {/* Demographic & Location Details */}
              <div className="space-y-1.5 pt-1 border-t border-[#2c2620] text-xs text-[#b8afa2]">
                <div className="flex items-center justify-between">
                  <span className="text-[#8f8679]">Age</span>
                  <span className="text-[#f2ece1] tabular-nums font-medium">
                    {profile.informations.ageStageLabel} ({profile.informations.ageYears}y /{' '}
                    {profile.informations.immortal
                      ? 'Immortal'
                      : `${profile.informations.maxLifespan ?? '?'}y`}
                    )
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8f8679]">Activity</span>
                  <span className="text-[#80ed99] font-medium">
                    {profile.informations.activity}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#8f8679] shrink-0">Home</span>
                  {displayUnit.settlementId &&
                  editingTarget?.kind === 'settlement' &&
                  editingTarget.id === displayUnit.settlementId ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        commitRename();
                      }}
                      className="flex items-center gap-1 min-w-0 flex-1 justify-end"
                    >
                      <input
                        type="text"
                        value={draftName}
                        maxLength={32}
                        autoFocus
                        data-testid="inspector-rename-city-input"
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Escape') setEditingTarget(null);
                        }}
                        className="w-full max-w-[140px] bg-[#141210] border border-[#f5b742] px-1.5 py-0.5 text-xs text-[#f2ece1] outline-none"
                      />
                      <button
                        type="submit"
                        className="px-btn-active px-1.5 py-0.5 text-[10px] font-bold text-[#f5b742] cursor-pointer shrink-0"
                      >
                        Save
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-1 min-w-0 justify-end">
                      <span className="text-[#f2ece1] truncate max-w-[165px] text-right font-medium">
                        {profile.informations.settlementName ?? 'Wilderness'}
                      </span>
                      {displayUnit.settlementId && onRenameSettlement && (
                        <button
                          type="button"
                          data-testid="inspector-rename-city-btn"
                          aria-label="Rename city"
                          title="Rename city"
                          onClick={() => {
                            if (!isSelectedDisplayed) onSelectUnit(displayUnit.id);
                            setEditingTarget({
                              kind: 'settlement',
                              id: displayUnit.settlementId!,
                              label: 'City',
                            });
                            setDraftName(profile.informations.settlementName ?? '');
                          }}
                          className="text-[11px] text-[#9e9486] hover:text-[#f5b742] cursor-pointer shrink-0 px-0.5"
                        >
                          ✎
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8f8679]">Location</span>
                  <span className="font-pixel-num text-[11px] text-[#cfc6b8] tabular-nums">
                    ({profile.informations.tileX}, {profile.informations.tileZ})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB 2: TRAITS (Icons, Descriptions, Live Add/Remove Picker)
             ================================================================ */}
          {activeTab === 'traits' && (
            <div className="space-y-2.5 text-xs" data-testid="inspector-entity-traits">
              {profile.traits.length === 0 ? (
                <div className="text-[#8f8679] text-[11px] py-2">
                  No traits assigned. Click Edit to add traits.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {profile.traits.map((trait) => {
                    const modLabels = formatModifierList(trait.mods);
                    return (
                      <div
                        key={trait.id}
                        className="bg-[#191613] border border-[#2c2620] p-2 flex items-start gap-2"
                      >
                        <div className="w-7 h-7 shrink-0 bg-[#141210] border border-[#2f2720] flex items-center justify-center mt-0.5">
                          <InspectorPixelIcon kind={trait.icon} className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`font-bold truncate ${
                                trait.negative ? 'text-[#ff8f6b]' : 'text-[#f2ece1]'
                              }`}
                            >
                              {trait.name}
                            </span>
                            {editMode && onToggleUnitTrait && (
                              <button
                                type="button"
                                data-testid={`remove-trait-${trait.id}`}
                                onClick={() => onToggleUnitTrait(displayUnit.id, trait.id)}
                                className="px-btn px-1.5 py-0.5 text-[10px] text-[#ff8f6b] cursor-pointer shrink-0"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-[#a89f91] leading-snug mt-0.5">
                            {trait.description}
                          </p>
                          {modLabels.length > 0 && (
                            <div className="text-[10px] font-semibold text-[#80ed99] mt-1 tabular-nums">
                              {modLabels.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {editMode && onToggleUnitTrait && (
                <div className="pt-2 border-t border-[#2c2620] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#f5b742]">Add or Toggle Traits</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {TRAIT_FILTERS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setTraitFilter(f.id)}
                        className={`px-1.5 py-0.5 text-[10px] font-semibold cursor-pointer ${
                          traitFilter === f.id ? 'px-btn-active text-[#f5b742]' : 'px-btn text-[#a89f91]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto pr-0.5">
                    {filteredTraits.map((trait) => {
                      const active = activeTraitIds.has(trait.id);
                      const modText = formatModifierList(trait.mods).join(', ');
                      return (
                        <button
                          key={trait.id}
                          type="button"
                          data-testid={`pick-trait-${trait.id}`}
                          title={`${trait.description}${modText ? ` (${modText})` : ''}`}
                          onClick={() => onToggleUnitTrait(displayUnit.id, trait.id)}
                          className={`p-1.5 flex items-center gap-1.5 text-left cursor-pointer transition-colors ${
                            active
                              ? 'px-btn-active text-[#f5b742]'
                              : 'bg-[#191613] hover:bg-[#221d18] border border-[#2c2620] text-[#d8cfc2]'
                          }`}
                        >
                          <InspectorPixelIcon kind={trait.icon} className="w-4 h-4 shrink-0" />
                          <span className="text-[11px] font-semibold truncate">{trait.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              TAB 3: GENES (Icons, Descriptions, Live Add/Remove Picker)
             ================================================================ */}
          {activeTab === 'genes' && (
            <div className="space-y-2.5 text-xs" data-testid="inspector-entity-genes">
              {profile.geneDetails.length === 0 ? (
                <div className="text-[#8f8679] text-[11px] py-2">
                  No genetic traits listed. Click Edit to splice genes.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {profile.geneDetails.map((entry) => {
                    const modLabels = formatModifierList(entry.info.mods);
                    return (
                      <div
                        key={entry.name}
                        className="bg-[#191613] border border-[#2c2620] p-2 flex items-start gap-2"
                      >
                        <div className="w-7 h-7 shrink-0 bg-[#141210] border border-[#2f2720] flex items-center justify-center mt-0.5">
                          <InspectorPixelIcon kind={entry.info.icon} className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`font-bold truncate ${
                                entry.isIntrinsic ? 'text-[#56cfe1]' : 'text-[#ffd166]'
                              }`}
                            >
                              {entry.name}
                            </span>
                            {editMode && onToggleUnitGene ? (
                              <button
                                type="button"
                                data-testid={`remove-gene-${entry.name}`}
                                onClick={() => onToggleUnitGene(displayUnit.id, entry.name)}
                                className="px-btn px-1.5 py-0.5 text-[10px] text-[#ff8f6b] cursor-pointer shrink-0"
                              >
                                Remove
                              </button>
                            ) : (
                              <span
                                className={`text-[10px] shrink-0 ${
                                  entry.isIntrinsic ? 'text-[#8f8679]' : 'text-[#ffd166]'
                                }`}
                              >
                                {entry.isIntrinsic ? 'Intrinsic' : 'Mutation'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#a89f91] leading-snug mt-0.5">
                            {entry.info.description}
                          </p>
                          {modLabels.length > 0 && (
                            <div className="text-[10px] font-semibold text-[#80ed99] mt-1 tabular-nums">
                              {modLabels.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {editMode && onToggleUnitGene && (
                <div className="pt-2 border-t border-[#2c2620] space-y-2">
                  <div className="text-[11px] font-bold text-[#f5b742]">Edit Genetics</div>
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'mutation', label: 'Mutations' },
                        { id: 'intrinsic', label: 'Lineage' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setGeneFilter(f.id)}
                        className={`px-1.5 py-0.5 text-[10px] font-semibold cursor-pointer ${
                          geneFilter === f.id ? 'px-btn-active text-[#f5b742]' : 'px-btn text-[#a89f91]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto pr-0.5">
                    {filteredGenes.map((gene) => {
                      const active = activeGeneNames.has(gene.name);
                      const modText = formatModifierList(gene.mods).join(', ');
                      return (
                        <button
                          key={gene.name}
                          type="button"
                          data-testid={`pick-gene-${gene.name}`}
                          title={`${gene.description}${modText ? ` (${modText})` : ''}`}
                          onClick={() => onToggleUnitGene(displayUnit.id, gene.name)}
                          className={`p-1.5 flex items-center gap-1.5 text-left cursor-pointer transition-colors ${
                            active
                              ? 'px-btn-active text-[#ffd166]'
                              : 'bg-[#191613] hover:bg-[#221d18] border border-[#2c2620] text-[#d8cfc2]'
                          }`}
                        >
                          <InspectorPixelIcon kind={gene.icon} className="w-4 h-4 shrink-0" />
                          <span className="text-[11px] font-semibold truncate">{gene.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              TAB 4: ITEMS & GEAR (Icons, Descriptions, Add/Remove Equipment)
             ================================================================ */}
          {activeTab === 'items' && (
            <div className="space-y-2.5 text-xs" data-testid="inspector-entity-items">
              {profile.itemDetails.length === 0 ? (
                <div className="text-[#8f8679] text-[11px] py-2">
                  No items carried. Click Edit to equip gear.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {profile.itemDetails.map((entry, idx) => {
                    const modLabels = formatModifierList(entry.info.mods);
                    return (
                      <div
                        key={`${entry.name}-${idx}`}
                        className="bg-[#191613] border border-[#2c2620] p-2 flex items-start gap-2"
                      >
                        <div className="w-7 h-7 shrink-0 bg-[#141210] border border-[#2f2720] flex items-center justify-center mt-0.5">
                          <InspectorPixelIcon kind={entry.info.icon} className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`font-bold truncate ${
                                entry.isCargo ? 'text-[#80ed99]' : 'text-[#f2ece1]'
                              }`}
                            >
                              {entry.name}
                            </span>
                            {editMode && !entry.isCargo && entry.itemIndex !== null && onRemoveUnitItem ? (
                              <button
                                type="button"
                                data-testid={`remove-item-${entry.itemIndex}`}
                                onClick={() => onRemoveUnitItem(displayUnit.id, entry.itemIndex!)}
                                className="px-btn px-1.5 py-0.5 text-[10px] text-[#ff8f6b] cursor-pointer shrink-0"
                              >
                                Drop
                              </button>
                            ) : (
                              <span className="text-[10px] text-[#8f8679] shrink-0">
                                {entry.isCargo ? 'Cargo' : formatSlotLabel(entry.info.slot)}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#a89f91] leading-snug mt-0.5">
                            {entry.info.description}
                          </p>
                          {modLabels.length > 0 && (
                            <div className="text-[10px] font-semibold text-[#80ed99] mt-1 tabular-nums">
                              {modLabels.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {editMode && onAddUnitItem && (
                <div className="pt-2 border-t border-[#2c2620] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#f5b742]">Give Item</span>
                    <span className="text-[10px] text-[#8f8679] tabular-nums">
                      {(displayUnit.items?.length ?? 0)} / 12
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ITEM_FILTERS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setItemFilter(f.id)}
                        className={`px-1.5 py-0.5 text-[10px] font-semibold cursor-pointer ${
                          itemFilter === f.id ? 'px-btn-active text-[#f5b742]' : 'px-btn text-[#a89f91]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                    {filteredCatalogItems.map((item) => {
                      const modText = formatModifierList(item.mods).join(', ');
                      return (
                        <button
                          key={item.name}
                          type="button"
                          data-testid={`give-item-${item.name}`}
                          onClick={() => onAddUnitItem(displayUnit.id, item.name)}
                          className="w-full p-1.5 bg-[#191613] hover:bg-[#241f19] border border-[#2c2620] flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <InspectorPixelIcon kind={item.icon} className="w-4 h-4 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold text-[#f2ece1] truncate">
                                {item.name}
                              </div>
                              <div className="text-[10px] text-[#80ed99] truncate tabular-nums">
                                {modText || item.description}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-[#f5b742] shrink-0">+ Add</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              TAB 5: FAVORITES LIST
             ================================================================ */}
          {activeTab === 'favorites' && favoriteUnits.length > 0 && (
            <div className="space-y-2 text-xs">
              <div className="text-[11px] text-[#8f8679]">
                Click an entity to select and center the camera:
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {favoriteUnits.map((fav) => {
                  const isCurrent = selectedUnit?.id === fav.id;
                  return (
                    <div
                      key={fav.id}
                      className={`flex items-center justify-between gap-2 p-1.5 transition-colors ${
                        isCurrent
                          ? 'bg-[#292218] border border-[#f5b742]'
                          : 'bg-[#191613] hover:bg-[#201c18]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectUnit(fav.id);
                          onFocusUnit(fav);
                        }}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                        title="Select & focus camera"
                      >
                        <UnitPixelIcon role={fav.role} className="w-5 h-5 shrink-0" />
                        <span className="font-semibold text-[#f2ece1] truncate">{fav.name}</span>
                        <span className="font-pixel-num text-[10px] text-[#80ed99] tabular-nums shrink-0">
                          {Math.round(fav.hp)}hp
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(fav.id)}
                        aria-label={`Unfavorite ${fav.name}`}
                        className="text-[#ffd166] hover:text-[#ff8f6b] cursor-pointer p-1"
                        title="Unfavorite"
                      >
                        <HudPixelIcon kind="starOn" className="w-3.5 h-3.5 pixelated-canvas" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2 text-xs text-[#cfc6b8]" data-testid="entity-inspector-empty">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-[#f5b742] text-xs sm:text-sm">Entity Inspector</h2>
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="sm:hidden px-btn px-1.5 py-0.5 text-[10px] text-[#b8afa2] cursor-pointer"
              aria-label="Minimize Inspector"
            >
              Hide
            </button>
          </div>

          <p className="text-xs text-[#a89f91]">
            Hover or tap on any unit or creature to inspect stats, traits, genetics, and items.
          </p>

          {favoriteUnits.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-[#2c2620]">
              <div className="text-[11px] font-semibold text-[#ffd166]">Favorites</div>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                {favoriteUnits.map((fav) => (
                  <div
                    key={fav.id}
                    className="flex items-center justify-between gap-2 p-1.5 bg-[#191613] hover:bg-[#201c18] transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectUnit(fav.id);
                        onFocusUnit(fav);
                      }}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                      title="Select & focus camera"
                    >
                      <UnitPixelIcon role={fav.role} className="w-5 h-5 shrink-0" />
                      <span className="font-semibold text-[#f2ece1] truncate">{fav.name}</span>
                      <span className="font-pixel-num text-[10px] text-[#80ed99] tabular-nums shrink-0">
                        {Math.round(fav.hp)}hp
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(fav.id)}
                      aria-label={`Unfavorite ${fav.name}`}
                      className="text-[#ffd166] hover:text-[#ff8f6b] cursor-pointer p-1"
                      title="Unfavorite"
                    >
                      <HudPixelIcon kind="starOn" className="w-3.5 h-3.5 pixelated-canvas" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
