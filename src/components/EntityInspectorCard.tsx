import React from 'react';
import {
  Crosshair,
  Dna,
  Heart,
  Package,
  Shield,
  Sparkles,
  Star,
  Swords,
  Utensils,
  X,
} from 'lucide-react';
import { DietCategory, getEntityInspectProfile } from '../game/entityInspector';
import { SimulationState, UnitEntity, UnitStatusEffect } from '../game/types';
import { UnitPixelIcon } from './GameIcons';

interface EntityInspectorCardProps {
  sim: SimulationState;
  hoveredUnit: UnitEntity | null;
  selectedUnit: UnitEntity | null;
  favoriteUnits: UnitEntity[];
  onToggleFavorite: (unitId: string) => void;
  onSelectUnit: (unitId: string | null) => void;
  onFocusUnit: (unit: UnitEntity) => void;
}

function getDietColors(category: DietCategory): string {
  switch (category) {
    case 'Herbivore':
    case 'Fey Herbivore':
      return 'text-[#80ed99] border-[#4f9d69] bg-[#16271d]';
    case 'Carnivore':
    case 'Pyro-Carnivore':
      return 'text-[#ff8f6b] border-[#a8432b] bg-[#2a1714]';
    default:
      return 'text-[#ffd166] border-[#a37b2c] bg-[#261f12]';
  }
}

function getFactionAccent(faction: 'Civilization' | 'Hostile' | 'Wildlife' | 'Mythical'): string {
  switch (faction) {
    case 'Civilization':
      return 'text-[#56cfe1]';
    case 'Hostile':
      return 'text-[#ff758f]';
    case 'Mythical':
      return 'text-[#ffd166]';
    default:
      return 'text-[#80ed99]';
  }
}

function formatStatusLabel(effect: UnitStatusEffect): { label: string; cls: string } {
  switch (effect) {
    case 'blessed':
      return { label: 'Blessed', cls: 'text-[#ffd166] border-[#9e7724] bg-[#272011]' };
    case 'shielded':
      return { label: 'Shielded', cls: 'text-[#72efdd] border-[#2d8a7e] bg-[#132624]' };
    case 'frenzied':
      return { label: 'Frenzied', cls: 'text-[#ff758f] border-[#a32943] bg-[#291319]' };
    case 'plagued':
      return { label: 'Plagued', cls: 'text-[#80ed99] border-[#428c54] bg-[#152418]' };
    case 'cursed':
      return { label: 'Cursed', cls: 'text-[#c77dff] border-[#6e3aa6] bg-[#21152c]' };
  }
}

export const EntityInspectorCard: React.FC<EntityInspectorCardProps> = ({
  sim,
  hoveredUnit,
  selectedUnit,
  favoriteUnits,
  onToggleFavorite,
  onSelectUnit,
  onFocusUnit,
}) => {
  const displayUnit = hoveredUnit ?? selectedUnit;
  const isShowingHovered = Boolean(hoveredUnit);
  const isSelectedDisplayed = Boolean(displayUnit && selectedUnit && displayUnit.id === selectedUnit.id);
  const profile = displayUnit ? getEntityInspectProfile(sim, displayUnit) : null;

  return (
    <aside
      aria-label="Entity Inspector"
      data-testid="entity-inspector-panel"
      className="pointer-events-auto fixed left-3 top-16 z-20 w-[300px] sm:w-[324px] max-h-[calc(100vh-11.5rem)] flex flex-col gap-2 overflow-y-auto"
    >
      {profile && displayUnit ? (
        <div className="px-panel p-3 flex flex-col gap-2.5">
          {/* Header: Icon + Name + Hover/Selected Badge + Actions */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="px-panel-inset w-11 h-11 flex items-center justify-center shrink-0">
                <UnitPixelIcon role={displayUnit.role} className="w-8 h-8" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2
                    className="text-sm font-bold text-[#f2ece1] truncate"
                    data-testid="inspector-entity-name"
                  >
                    {profile.name}
                  </h2>
                  <span
                    className={`font-pixel-num text-[9px] px-1.5 py-0.5 border leading-none ${
                      isShowingHovered && !isSelectedDisplayed
                        ? 'text-[#56cfe1] border-[#337c8c] bg-[#112228]'
                        : 'text-[#ffd166] border-[#997325] bg-[#261f11]'
                    }`}
                  >
                    {isShowingHovered && !isSelectedDisplayed ? 'HOVERED' : 'SELECTED'}
                  </span>
                </div>
                <div className="text-[11px] text-[#cfc6b8] leading-tight mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>{profile.subtitle}</span>
                  <span className={`font-semibold ${getFactionAccent(profile.factionLabel)}`}>
                    • {profile.factionLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isSelectedDisplayed ? (
                <button
                  type="button"
                  data-testid="inspector-favorite-btn"
                  onClick={() => onToggleFavorite(displayUnit.id)}
                  aria-label={profile.favorite ? 'Unfavorite entity' : 'Favorite entity'}
                  title={profile.favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                  className={`w-7 h-7 flex items-center justify-center cursor-pointer ${
                    profile.favorite ? 'px-btn-active text-[#ffd166]' : 'px-btn text-[#cfc6b8]'
                  }`}
                >
                  <Star
                    className="w-4 h-4"
                    fill={profile.favorite ? '#ffd166' : 'none'}
                  />
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
                  title="Select & Favorite (or click creature in world to select)"
                  className="px-btn w-7 h-7 flex items-center justify-center cursor-pointer text-[#cfc6b8] hover:text-[#ffd166]"
                >
                  <Star className="w-4 h-4" fill={profile.favorite ? '#ffd166' : 'none'} />
                </button>
              )}

              {selectedUnit && (
                <button
                  type="button"
                  onClick={() => onFocusUnit(selectedUnit)}
                  aria-label="Center camera on selected entity"
                  title="Focus Camera"
                  className="px-btn w-7 h-7 flex items-center justify-center cursor-pointer text-[#56cfe1]"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                </button>
              )}

              {selectedUnit && (
                <button
                  type="button"
                  onClick={() => onSelectUnit(null)}
                  aria-label="Clear selected entity"
                  title="Unpin Selection"
                  className="px-btn w-7 h-7 flex items-center justify-center cursor-pointer text-[#a89f91]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* HP Bar */}
          <div className="px-panel-inset px-2 py-1.5">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="flex items-center gap-1 text-[#cfc6b8] font-semibold">
                <Heart className="w-3 h-3 text-[#ff6b6b]" fill="#ff6b6b" />
                Health
              </span>
              <span className="font-pixel-num text-[10px] text-[#f2ece1]">
                {profile.informations.hp} / {profile.informations.maxHp}
              </span>
            </div>
            <div className="w-full h-2 bg-[#14110f] border border-[#3a332b] overflow-hidden">
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${profile.informations.hpPercent}%`,
                  backgroundColor:
                    profile.informations.hpPercent > 55
                      ? '#80ed99'
                      : profile.informations.hpPercent > 25
                        ? '#f5b742'
                        : '#e63946',
                }}
              />
            </div>
          </div>

          {/* Diet */}
          <div className="px-panel-inset px-2.5 py-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#f5b742] uppercase tracking-wider">
                <Utensils className="w-3 h-3" />
                Diet
              </span>
              <span
                data-testid="inspector-entity-diet"
                className={`text-[10px] font-bold px-1.5 py-0.5 border leading-none ${getDietColors(
                  profile.diet.category,
                )}`}
              >
                {profile.diet.category}
              </span>
            </div>
            <p className="text-[11px] text-[#cfc6b8] leading-snug">{profile.diet.detail}</p>
          </div>

          {/* Informations */}
          <div className="px-panel-inset px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#f5b742] uppercase tracking-wider mb-1.5">
              <Shield className="w-3 h-3" />
              Informations
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <div className="text-[#a89f91]">Stage</div>
              <div className="text-[#f2ece1] text-right font-semibold tabular-nums">
                {profile.informations.ageStageLabel} ({profile.informations.ageYears}y)
              </div>

              <div className="text-[#a89f91]">Activity</div>
              <div className="text-[#80ed99] text-right font-semibold">
                {profile.informations.activity}
              </div>

              <div className="text-[#a89f91]">Home</div>
              <div className="text-[#f2ece1] text-right truncate">
                {profile.informations.settlementName ?? 'Wilderness'}
              </div>

              <div className="text-[#a89f91]">Coords</div>
              <div className="font-pixel-num text-[10px] text-[#cfc6b8] text-right">
                ({profile.informations.tileX}, {profile.informations.tileZ})
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-[#322b24] flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1 text-[#ff9f68] font-semibold tabular-nums">
                <Swords className="w-3 h-3" />
                ATK {profile.informations.attackDamage}
              </span>
              <span className="text-[#cfc6b8] tabular-nums">
                RNG {profile.informations.attackRange}
              </span>
              <span className="text-[#56cfe1] tabular-nums">
                SPD {profile.informations.speed}
              </span>
            </div>

            {profile.informations.breathCooldown !== null && (
              <div className="mt-1.5 pt-1.5 border-t border-[#322b24] flex items-center justify-between text-[11px]">
                <span className="text-[#ff8f6b] font-semibold">Flame Breath</span>
                <span className="font-pixel-num text-[10px] text-[#ffd166]">
                  {profile.informations.breathCooldown <= 0
                    ? 'READY'
                    : `${profile.informations.breathCooldown}s`}
                </span>
              </div>
            )}

            {profile.informations.statusEffects.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {profile.informations.statusEffects.map((eff) => {
                  const badge = formatStatusLabel(eff);
                  return (
                    <span
                      key={eff}
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 border ${badge.cls}`}
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      {badge.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="px-panel-inset px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#f5b742] uppercase tracking-wider mb-1.5">
              <Package className="w-3 h-3" />
              Items
            </div>
            <div className="flex flex-wrap gap-1" data-testid="inspector-entity-items">
              {profile.items.map((item) => (
                <span
                  key={item}
                  className={`text-[10px] px-1.5 py-0.5 border leading-tight ${
                    item.startsWith('Carrying ')
                      ? 'text-[#80ed99] border-[#3d7a51] bg-[#142319] font-semibold'
                      : 'text-[#e8dfd1] border-[#3d352c] bg-[#1e1a16]'
                  }`}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Genes */}
          <div className="px-panel-inset px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#f5b742] uppercase tracking-wider mb-1.5">
              <Dna className="w-3 h-3" />
              Genes
            </div>
            <div className="flex flex-wrap gap-1" data-testid="inspector-entity-genes">
              {profile.genes.map((gene) => (
                <span
                  key={gene}
                  className="text-[10px] px-1.5 py-0.5 border border-[#325b66] bg-[#122026] text-[#8be3f0] leading-tight"
                >
                  {gene}
                </span>
              ))}
            </div>
          </div>

          {!isSelectedDisplayed && (
            <div className="text-[10px] text-[#a89f91] leading-tight">
              Click entity in world to pin &amp; toggle favorite.
            </div>
          )}
        </div>
      ) : (
        <div className="px-panel px-3 py-2.5 text-xs text-[#cfc6b8]">
          <div className="font-bold text-[#f5b742] mb-0.5">Entity Inspector</div>
          <p className="text-[11px] text-[#b8afa2] leading-snug">
            Hover over any living creature to view its diet, stats, items, and genes. Click to select &amp; favorite.
          </p>
        </div>
      )}

      {/* Favorited Living Entities Quick-Access List */}
      {favoriteUnits.length > 0 && (
        <div className="px-panel p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1 text-[11px] font-bold text-[#ffd166] uppercase tracking-wider">
              <Star className="w-3 h-3" fill="#ffd166" />
              Favorites ({favoriteUnits.length})
            </span>
          </div>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
            {favoriteUnits.map((fav) => {
              const isCurrent = selectedUnit?.id === fav.id;
              return (
                <div
                  key={fav.id}
                  className={`flex items-center justify-between gap-1.5 px-1.5 py-1 border text-[11px] ${
                    isCurrent
                      ? 'border-[#f5b742] bg-[#2a2215]'
                      : 'border-[#3a332b] bg-[#191613]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectUnit(fav.id);
                      onFocusUnit(fav);
                    }}
                    className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                    title="Select & focus camera"
                  >
                    <UnitPixelIcon role={fav.role} className="w-4 h-4 shrink-0" />
                    <span className="font-semibold text-[#f2ece1] truncate">{fav.name}</span>
                    <span className="font-pixel-num text-[9px] text-[#80ed99] shrink-0">
                      {Math.round(fav.hp)}hp
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(fav.id)}
                    aria-label={`Unfavorite ${fav.name}`}
                    className="text-[#ffd166] hover:text-[#ff8f6b] cursor-pointer px-1"
                    title="Unfavorite"
                  >
                    <Star className="w-3 h-3" fill="#ffd166" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};
