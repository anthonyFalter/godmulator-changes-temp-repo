import React, { useState } from 'react';
import {
  Crosshair,
  Star,
  X,
} from 'lucide-react';
import { getEntityInspectProfile, isIntrinsicGene } from '../game/entityInspector';
import { Resources, SimulationState, UnitEntity, UnitStatusEffect, ZoneToggleState } from '../game/types';
import { TileZoneInspection } from '../game/zones';
import { ResourceIconSvg, UnitPixelIcon } from './GameIcons';

const INSPECT_RESOURCE_KEYS: { key: keyof Resources; label: string }[] = [
  { key: 'food', label: 'Food' },
  { key: 'wood', label: 'Wood' },
  { key: 'stone', label: 'Stone' },
  { key: 'ore', label: 'Ore' },
  { key: 'knowledge', label: 'Lore' },
  { key: 'energy', label: 'Energy' },
  { key: 'alloy', label: 'Alloy' },
  { key: 'faith', label: 'Faith' },
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
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('profile');
  const [minimized, setMinimized] = useState<boolean>(false);

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
        {profile ? `Inspect: ${profile.name}` : 'Inspect ▾'}
      </button>
    );
  }

  return (
    <aside
      aria-label="Entity Information"
      data-testid="entity-inspector-panel"
      className="pointer-events-auto absolute left-0 top-0 z-10 w-[min(316px,100%)] max-h-full px-panel p-2.5 sm:p-4 flex flex-col gap-2.5 sm:gap-3.5 overflow-y-auto"
    >
      {profile && displayUnit ? (
        <>
          {/* Header Block: Avatar, Name, Affordance & Primary Action Buttons */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-11 h-11 shrink-0 flex items-center justify-center bg-[#191613] border border-[#2f2720]"
                aria-hidden="true"
              >
                <UnitPixelIcon role={displayUnit.role} className="w-8 h-8" />
              </div>
              <div className="min-w-0">
                <h2
                  className="text-sm font-bold text-[#f2ece1] truncate leading-tight"
                  data-testid="inspector-entity-name"
                >
                  {profile.name}
                </h2>
                <div className="text-xs text-[#cfc6b8] leading-tight mt-0.5 truncate">
                  <span>{profile.subtitle}</span>
                </div>

              </div>
            </div>

            {/* Action Buttons: 36x36 touch-friendly affordances */}
            <div className="flex items-center gap-1 shrink-0 pt-0.5">
              {isSelectedDisplayed ? (
                <button
                  type="button"
                  data-testid="inspector-favorite-btn"
                  onClick={() => onToggleFavorite(displayUnit.id)}
                  aria-label={profile.favorite ? 'Unfavorite entity' : 'Favorite entity'}
                  title={profile.favorite ? 'Remove from favorites' : 'Add to favorites'}
                  className={`w-8 h-8 flex items-center justify-center cursor-pointer transition-colors ${
                    profile.favorite
                      ? 'px-btn-active text-[#ffd166]'
                      : 'px-btn text-[#a89f91] hover:text-[#ffd166]'
                  }`}
                >
                  <Star className="w-4 h-4" fill={profile.favorite ? '#ffd166' : 'none'} />
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
                  className="px-btn w-8 h-8 flex items-center justify-center cursor-pointer text-[#a89f91] hover:text-[#ffd166] transition-colors"
                >
                  <Star className="w-4 h-4" fill={profile.favorite ? '#ffd166' : 'none'} />
                </button>
              )}

              {selectedUnit && (
                <button
                  type="button"
                  onClick={() => onFocusUnit(selectedUnit)}
                  aria-label={isFollowing ? 'Stop following entity' : 'Follow entity with camera'}
                  title={isFollowing ? 'Following entity · Click to stop' : 'Follow entity with camera'}
                  className={`w-8 h-8 flex items-center justify-center cursor-pointer transition-colors ${
                    isFollowing
                      ? 'px-btn-active text-[#80ed99] border-[#40916c]'
                      : 'px-btn text-[#56cfe1] hover:text-[#80ed99]'
                  }`}
                >
                  <Crosshair className="w-4 h-4" />
                </button>
              )}

              {selectedUnit && (
                <button
                  type="button"
                  onClick={() => onSelectUnit(null)}
                  aria-label="Unpin selection"
                  title="Unpin selection"
                  className="px-btn w-8 h-8 flex items-center justify-center cursor-pointer text-[#8f8679] hover:text-[#f2ece1] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
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
          <div className="flex items-center gap-1 border-b border-[#2c2620] pb-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-2.5 py-1 font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                activeTab === 'profile' ? 'px-btn-active text-[#f5b742]' : 'px-btn text-[#a89f91]'
              }`}
            >
              Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('traits')}
              className={`px-2.5 py-1 font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                activeTab === 'traits' ? 'px-btn-active text-[#f5b742]' : 'px-btn text-[#a89f91]'
              }`}
            >
              Traits &amp; Gear
            </button>
            {favoriteUnits.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('favorites')}
                className={`px-2.5 py-1 font-semibold cursor-pointer transition-colors whitespace-nowrap ${
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
            <div className="space-y-3 text-xs">
              {/* Combat & Movement Attributes: Clean Tabular Metric Strip */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="bg-[#191613] p-2">
                  <div className="text-[10px] text-[#8f8679]">Attack</div>
                  <div className="font-pixel-num text-sm font-bold text-[#ff9f68] tabular-nums mt-0.5">
                    {profile.informations.attackDamage}
                  </div>
                </div>
                <div className="bg-[#191613] p-2">
                  <div className="text-[10px] text-[#8f8679]">Range</div>
                  <div className="font-pixel-num text-sm font-bold text-[#f2ece1] tabular-nums mt-0.5">
                    {profile.informations.attackRange}
                  </div>
                </div>
                <div className="bg-[#191613] p-2">
                  <div className="text-[10px] text-[#8f8679]">Speed</div>
                  <div className="font-pixel-num text-sm font-bold text-[#56cfe1] tabular-nums mt-0.5">
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
                  <div className="text-xs text-[#80ed99] flex flex-wrap gap-x-2 gap-y-0.5">
                    {profile.informations.statusEffects.map((eff) => (
                      <span key={eff}>· {formatEffectName(eff)}</span>
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
                <div className="flex items-center justify-between">
                  <span className="text-[#8f8679]">Home</span>
                  <span className="text-[#f2ece1] truncate max-w-[170px] text-right font-medium">
                    {profile.informations.settlementName ?? 'Wilderness'}
                  </span>
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
                        <Star className="w-3.5 h-3.5" fill="#ffd166" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2 text-xs text-[#cfc6b8]" data-testid="zone-inspector-content">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-[#f5b742] text-sm">Inspect Tool</h2>
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="md:hidden px-btn px-2 py-0.5 text-[11px] text-[#b8afa2] cursor-pointer"
              aria-label="Minimize Inspector"
            >
              Hide
            </button>
          </div>

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
                      <span className="font-bold text-[#f2ece1] truncate">
                        {hoveredZoneInfo.kingdom.name}
                      </span>
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
