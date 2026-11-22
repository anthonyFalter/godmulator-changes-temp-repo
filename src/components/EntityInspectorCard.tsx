import React, { useState } from 'react';
import { getEntityInspectProfile, isIntrinsicGene } from '../game/entityInspector';
import { Resources, SimulationState, UnitEntity, UnitStatusEffect, ZoneToggleState } from '../game/types';
import { TileZoneInspection } from '../game/zones';
import { HudPixelIcon, ResourceIconSvg, UnitPixelIcon } from './GameIcons';

const INSPECT_RESOURCE_KEYS: { key: keyof Resources; label: string }[] = [
  { key: 'food', label: 'Food' },
  { key: 'wood', label: 'Wood' },
  { key: 'stone', label: 'Stone' },
  { key: 'ore', label: 'Ore' },
  { key: 'knowledge', label: 'Lore' },
  { key: 'alloy', label: 'Alloy' },
  { key: 'faith', label: 'God Energy' },
];

interface EntityInspectorCardProps {
  sim: SimulationState;
  hoveredUnit: UnitEntity | null;
  selectedUnit: UnitEntity | null;
  favoriteUnits: UnitEntity[];
  followingEntityId?: string | null;
  hoveredZoneInfo?: TileZoneInspection | null;
  activeZones?: ZoneToggleState;
  onToggleFavorite: (unitId: string) => void;
  onSelectUnit: (unitId: string | null) => void;
  onFocusUnit: (unit: UnitEntity) => void;
  onRenameUnit?: (unitId: string, newName: string) => void;
  onRenameSettlement?: (settlementId: string, newName: string) => void;
  onRenameKingdom?: (kingdomId: string, newName: string) => void;
}

type InspectorTab = 'profile' | 'traits' | 'favorites';

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

export const EntityInspectorCard: React.FC<EntityInspectorCardProps> = ({
  sim,
  hoveredUnit,
  selectedUnit,
  favoriteUnits,
  followingEntityId,
  hoveredZoneInfo = null,
  activeZones,
  onToggleFavorite,
  onSelectUnit,
  onFocusUnit,
  onRenameUnit,
  onRenameSettlement,
  onRenameKingdom,
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('profile');
  const [minimized, setMinimized] = useState<boolean>(false);
  const [editingTarget, setEditingTarget] = useState<{
    kind: 'unit' | 'settlement' | 'kingdom';
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
      else if (editingTarget.kind === 'kingdom') onRenameKingdom?.(editingTarget.id, trimmed);
    }
    setEditingTarget(null);
  };

  const displayUnit = hoveredUnit ?? selectedUnit;
  const isSelectedDisplayed = Boolean(
    displayUnit && selectedUnit && displayUnit.id === selectedUnit.id,
  );
  const isFollowing = Boolean(
    displayUnit && followingEntityId && displayUnit.id === followingEntityId,
  );
  const profile = displayUnit ? getEntityInspectProfile(sim, displayUnit) : null;

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
      className="pointer-events-auto absolute left-0 top-0 z-10 w-[min(276px,100%)] sm:w-[316px] max-h-[min(240px,100%)] sm:max-h-full px-panel p-2 sm:p-4 flex flex-col gap-2 sm:gap-3.5 overflow-y-auto"
    >
      {profile && displayUnit ? (
        <>
          {/* Header Block: Avatar, Name, Affordance & Primary Action Buttons */}
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div
                className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center bg-[#191613] border border-[#2f2720]"
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
                <div className="text-[11px] sm:text-xs text-[#cfc6b8] leading-tight mt-0.5 truncate">
                  <span>{profile.subtitle}</span>
                </div>

              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1 shrink-0 pt-0.5">
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
                  onClick={() => onSelectUnit(null)}
                  aria-label="Unpin selection"
                  title="Unpin selection"
                  className="px-btn w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer text-[#8f8679] hover:text-[#f2ece1] transition-colors"
                >
                  <HudPixelIcon kind="close" className="w-3.5 h-3.5 sm:w-4 sm:h-4 pixelated-canvas" />
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

          {/* Integrated Health Gauge: Clean unboxed layout with tabular figures */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#a89f91]">Health</span>
              <span className="font-pixel-num text-[11px] text-[#f2ece1] tabular-nums">
                {profile.informations.hp} / {profile.informations.maxHp}
              </span>
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

          {/* Progressive Disclosure: Clean Segmented Navigation (No Pill Badges) */}
          <div className="flex items-center gap-1 border-b border-[#2c2620] pb-1.5 sm:pb-2 text-[11px] sm:text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-2 py-0.5 sm:px-2.5 sm:py-1 font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                activeTab === 'profile' ? 'px-btn-active text-[#f5b742]' : 'px-btn text-[#a89f91]'
              }`}
            >
              Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('traits')}
              className={`px-2 py-0.5 sm:px-2.5 sm:py-1 font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                activeTab === 'traits' ? 'px-btn-active text-[#f5b742]' : 'px-btn text-[#a89f91]'
              }`}
            >
              Traits &amp; Gear
            </button>
            {favoriteUnits.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('favorites')}
                className={`px-2 py-0.5 sm:px-2.5 sm:py-1 font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'favorites'
                    ? 'px-btn-active text-[#ffd166]'
                    : 'px-btn text-[#a89f91]'
                }`}
              >
                Favorites ({favoriteUnits.length})
              </button>
            )}
          </div>

          {/* TAB CONTENT: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-2 sm:space-y-3 text-xs">
              {/* Combat & Movement Attributes: Clean Tabular Metric Strip */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-0.5 sm:pt-1 text-center">
                <div className="bg-[#191613] p-1.5 sm:p-2">
                  <div className="text-[10px] text-[#8f8679]">Attack</div>
                  <div className="font-pixel-num text-xs sm:text-sm font-bold text-[#ff9f68] tabular-nums mt-0.5">
                    {profile.informations.attackDamage}
                  </div>
                </div>
                <div className="bg-[#191613] p-1.5 sm:p-2">
                  <div className="text-[10px] text-[#8f8679]">Range</div>
                  <div className="font-pixel-num text-xs sm:text-sm font-bold text-[#f2ece1] tabular-nums mt-0.5">
                    {profile.informations.attackRange}
                  </div>
                </div>
                <div className="bg-[#191613] p-1.5 sm:p-2">
                  <div className="text-[10px] text-[#8f8679]">Speed</div>
                  <div className="font-pixel-num text-xs sm:text-sm font-bold text-[#56cfe1] tabular-nums mt-0.5">
                    {profile.informations.speed}
                  </div>
                </div>
              </div>

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

              {/* Status Effects: Clean inline typography (No Pill Badges) */}
              {profile.informations.statusEffects.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="text-[11px] text-[#8f8679]">Active effects</div>
                  <div className="text-xs text-[#80ed99] flex flex-wrap gap-x-1.5 gap-y-0.5">
                    {profile.informations.statusEffects.map((eff, idx, arr) => (
                      <span key={eff}>
                        {formatEffectName(eff)}
                        {idx < arr.length - 1 ? ',' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Demographic & Location Data: Clean Key-Value Pairs */}
              <div className="space-y-1.5 pt-1 text-xs text-[#b8afa2]">
                <div className="flex items-center justify-between">
                  <span className="text-[#8f8679]">Stage &amp; Lifespan</span>
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
                      <span className="text-[#f2ece1] truncate max-w-[155px] text-right font-medium">
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

          {/* TAB CONTENT: TRAITS & GEAR */}
          {activeTab === 'traits' && (
            <div className="space-y-3.5 text-xs">
              {/* Equipment & Cargo: Clean Unboxed List */}
              <div className="space-y-1.5">
                <div className="font-semibold text-[#f2ece1]">Equipment &amp; Cargo</div>
                <div
                  className="space-y-1 text-xs"
                  data-testid="inspector-entity-items"
                >
                  {profile.items.map((item) => (
                    <div
                      key={item}
                      className={`flex items-baseline gap-2 ${
                        item.startsWith('Carrying ')
                          ? 'text-[#80ed99] font-medium'
                          : 'text-[#cfc6b8]'
                      }`}
                    >
                      <span className="text-[#8f8679]" aria-hidden="true">
                        •
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Genetics & Lineage: Clean Unboxed List with Intrinsic vs Rare Distinction */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#f2ece1]">Genetics &amp; Lineage</span>
                  <span className="text-[10px] text-[#8f8679] tabular-nums">
                    {profile.genes.length} {profile.genes.length === 1 ? 'trait' : 'traits'}
                  </span>
                </div>
                <div
                  className="space-y-1.5 text-xs"
                  data-testid="inspector-entity-genes"
                >
                  {profile.genes.map((gene, idx) => {
                    const isIntrinsic = isIntrinsicGene(gene) || idx === 0;
                    return (
                      <div
                        key={gene}
                        className="flex items-baseline justify-between gap-2"
                      >
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span
                            className={isIntrinsic ? 'text-[#3a7d8a]' : 'text-[#d97706]'}
                            aria-hidden="true"
                          >
                            •
                          </span>
                          <span
                            className={`truncate ${
                              isIntrinsic ? 'text-[#56cfe1]' : 'text-[#ffd166] font-medium'
                            }`}
                          >
                            {gene}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] whitespace-nowrap tabular-nums ${
                            isIntrinsic ? 'text-[#8f8679]' : 'text-[#ffd166]'
                          }`}
                        >
                          {isIntrinsic ? 'Intrinsic' : 'Rare Mutation'}
                        </span>
                      </div>
                    );
                  })}

                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: FAVORITES LIST */}
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
        <div className="space-y-1.5 sm:space-y-2 text-xs text-[#cfc6b8]" data-testid="zone-inspector-content">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-[#f5b742] text-xs sm:text-sm">Inspect Tool</h2>
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="sm:hidden px-btn px-1.5 py-0.5 text-[10px] text-[#b8afa2] cursor-pointer"
              aria-label="Minimize Inspector"
            >
              Hide
            </button>
          </div>

          {editingTarget?.kind === 'kingdom' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                commitRename();
              }}
              className="bg-[#191613] px-2.5 py-2 border border-[#f5b742] space-y-1.5"
            >
              <div className="text-[10px] text-[#f5b742] font-semibold">Rename City / Kingdom</div>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={draftName}
                  maxLength={32}
                  autoFocus
                  data-testid="inspector-rename-kingdom-input"
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Escape') setEditingTarget(null);
                  }}
                  className="w-full min-w-0 bg-[#141210] border border-[#3a332b] px-1.5 py-0.5 text-xs text-[#f2ece1] outline-none"
                />
                <button
                  type="submit"
                  className="px-btn-active px-2 py-0.5 text-[10px] font-bold text-[#f5b742] cursor-pointer shrink-0"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  className="px-btn px-1.5 py-0.5 text-[10px] text-[#a89f91] cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>
            </form>
          )}

          {(() => {
            const otherZonesOnly =
              !activeZones?.kingdoms &&
              !activeZones?.alliances &&
              Boolean(
                activeZones?.territories || activeZones?.biomes || activeZones?.temperature,
              );
            const showKingdomCard = Boolean(hoveredZoneInfo?.kingdom && !otherZonesOnly);
            const showAnyZone = Boolean(
              hoveredZoneInfo &&
                (showKingdomCard ||
                  (activeZones?.territories && hoveredZoneInfo.territory) ||
                  (activeZones?.biomes && hoveredZoneInfo.biomeZone) ||
                  (activeZones?.temperature && hoveredZoneInfo.temperatureZone)),
            );
            if (!showAnyZone || !hoveredZoneInfo) {
              return (
                <p className="text-xs text-[#a89f91]">
                  Hover or tap on a unit, city, or zone to see stats!
                </p>
              );
            }
            return (
              <div className="space-y-2">
                {showKingdomCard && hoveredZoneInfo.kingdom && (
                  <div
                    className="bg-[#191613] px-3 py-2 border-l-4 space-y-2"
                    style={{ borderLeftColor: hoveredZoneInfo.kingdom.hexColor }}
                    data-testid="inspect-zone-kingdom"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-bold text-[#f2ece1] truncate">
                          {hoveredZoneInfo.kingdom.name}
                        </span>
                        {onRenameKingdom && (
                          <button
                            type="button"
                            data-testid="inspector-rename-kingdom-btn"
                            aria-label="Rename city or kingdom"
                            title="Rename city / kingdom"
                            onClick={() => {
                              setEditingTarget({
                                kind: 'kingdom',
                                id: hoveredZoneInfo.kingdom!.kingdomId,
                                label: 'Kingdom',
                              });
                              setDraftName(hoveredZoneInfo.kingdom!.name);
                            }}
                            className="text-[11px] text-[#9e9486] hover:text-[#f5b742] cursor-pointer shrink-0 px-0.5"
                          >
                            ✎
                          </button>
                        )}
                      </div>
                      <span className="font-pixel-num text-xs font-bold text-[#80ed99] tabular-nums shrink-0">
                        Pop {hoveredZoneInfo.kingdom.population}
                      </span>
                    </div>
                    <div
                      className="grid grid-cols-4 gap-1 pt-1 border-t border-[#2c2620]"
                      data-testid="inspect-kingdom-resources"
                    >
                      {INSPECT_RESOURCE_KEYS.map(({ key, label }) => (
                        <div
                          key={key}
                          title={`${label}: ${Math.floor(hoveredZoneInfo.kingdom!.resources[key] ?? 0)}`}
                          className="bg-[#141210] px-1.5 py-1 flex items-center justify-between gap-1"
                        >
                          <ResourceIconSvg
                            resource={key}
                            className="w-3.5 h-3.5 pixelated-canvas shrink-0"
                          />
                          <span className="font-pixel-num text-[10px] text-[#e8e0d2] tabular-nums">
                            {Math.floor(hoveredZoneInfo.kingdom!.resources[key] ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeZones?.territories && hoveredZoneInfo.territory && (
                  <div
                    className="bg-[#191613] px-3 py-2 border-l-4 flex items-center justify-between gap-2"
                    style={{ borderLeftColor: hoveredZoneInfo.territory.hexColor }}
                    data-testid="inspect-zone-territory"
                  >
                    <span className="font-bold text-[#f2ece1] truncate">
                      {hoveredZoneInfo.territory.name}
                    </span>
                    <span className="font-pixel-num text-xs font-bold text-[#fb923c] tabular-nums shrink-0">
                      Pop {hoveredZoneInfo.territory.animalCount}
                    </span>
                  </div>
                )}

                {activeZones?.biomes && hoveredZoneInfo.biomeZone && (
                  <div
                    className="bg-[#191613] px-3 py-2 border-l-4 flex items-center justify-between gap-2"
                    style={{ borderLeftColor: hoveredZoneInfo.biomeZone.hexColor }}
                    data-testid="inspect-zone-biome"
                  >
                    <span className="font-bold text-[#f2ece1] truncate">
                      {hoveredZoneInfo.biomeZone.name}
                    </span>
                  </div>
                )}

                {activeZones?.temperature && hoveredZoneInfo.temperatureZone && (
                  <div
                    className="bg-[#191613] px-3 py-2 border-l-4 flex items-center justify-between gap-2"
                    style={{ borderLeftColor: hoveredZoneInfo.temperatureZone.hexColor }}
                    data-testid="inspect-zone-temperature"
                  >
                    <span className="font-bold text-[#f2ece1] truncate">
                      {hoveredZoneInfo.temperatureZone.name}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </aside>
  );
};
