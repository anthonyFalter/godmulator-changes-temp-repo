import React from 'react';
import type {
  BuildingType,
  GodPowerType,
  Resources,
  TerrainToolType,
  ToolCategory,
  UnitRole,
  ZoneOverlayType,
} from '../game/types';
import { PixelArtSvg } from './icons/pixelEngine';
import {
  HUD_SPRITES,
  RESOURCE_SPRITES,
  TAB_SPRITES,
  TERRAIN_SPRITES,
  TITLE_EMBLEM_SPRITE,
  ZONE_SPRITES,
} from './icons/uiAndWorldSprites';
import { BUILDING_SPRITES, POWER_SPRITES } from './icons/powerAndBuildSprites';
import { UNIT_SPRITES } from './icons/unitSprites';
import { INSPECTOR_SPRITES } from './icons/inspectorSprites';
import type { InspectorIconKey } from '../game/unitCustomization';
import { getFlameSpriteSheetUrl } from '../game/fireSprites';

export const FlameSpriteIcon: React.FC<{ className?: string; label?: string }> = React.memo(({
  className = 'w-5 h-5',
  label = 'Flame',
}) => (
  <span
    role="img"
    aria-label={label}
    className={`flame-sprite-icon ${className}`}
    style={{ backgroundImage: `url("${getFlameSpriteSheetUrl()}")` }}
  />
));

export const TitleEmblemSvg: React.FC<{ centered?: boolean }> = React.memo(({ centered = true }) => (
  <div className={centered ? 'mb-3 flex justify-center' : 'flex items-center'}>
    <PixelArtSvg
      sprite={TITLE_EMBLEM_SPRITE}
      className={`${centered ? 'w-12 h-12 sm:w-14 sm:h-14' : 'w-9 h-9'} pixelated-canvas drop-shadow-[0_2px_0_#0b0a09]`}
    />
  </div>
));

function getUiIconUrl(category: string, key: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}assets/icons/${category}/${key}.png`;
}

const HQ_UNIT_ICONS = new Set<UnitRole>([
  'human', 'elf', 'orc', 'dwarf', 'lizardfolk', 'villager', 'forager', 'miner',
  'builder', 'warrior', 'priest', 'scholar', 'astro_engineer', 'raider_swarmer', 'raider_ranged', 'raider_behemoth',
  'pig', 'cow', 'bear', 'wolf', 'chicken', 'capybara', 'dinosaur', 'dragon',
  'unicorn', 'leviathan', 'deer', 'sheep', 'rabbit', 'fox', 'boar', 'lion',
  'elephant', 'camel', 'penguin', 'crocodile', 'phoenix', 'griffin', 'yeti', 'golem',
  'kitsune', 'horse', 'goat', 'monkey', 'panda', 'polar_bear', 'hippo', 'rhino',
  'turtle', 'frog', 'crab', 'hydra', 'minotaur', 'pegasus', 'cerberus', 'ent',
  'giraffe', 'zebra', 'tiger', 'gorilla', 'kangaroo', 'moose', 'bison', 'flamingo',
]);

const HQ_ZONE_ICONS = new Set<ZoneOverlayType>([
  'kingdomLabels', 'kingdoms', 'kings', 'territories', 'biomes', 'alliances',
]);

const HqIconImg: React.FC<{ category: string; name: string; className: string }> = React.memo(({
  category,
  name,
  className,
}) => (
  <img
    src={getUiIconUrl(category, name)}
    alt=""
    aria-hidden="true"
    draggable={false}
    className={`${className} object-contain select-none pointer-events-none`}
  />
));

export const ResourceIconSvg: React.FC<{ resource: keyof Resources; className?: string }> = React.memo(({
  resource,
  className = 'w-4 h-4 pixelated-canvas',
}) => <HqIconImg category="resources" name={resource} className={className} />);

export const TabPixelIcon: React.FC<{ category: ToolCategory; className?: string }> = React.memo(({
  category,
  className = 'w-4 h-4 pixelated-canvas',
}) => <HqIconImg category="tabs" name={category} className={className} />);

export const ZonePixelIcon: React.FC<{ zone: ZoneOverlayType; className?: string }> = React.memo(({
  zone,
  className = 'w-5 h-5 pixelated-canvas',
}) =>
  HQ_ZONE_ICONS.has(zone) ? (
    <HqIconImg category="zones" name={zone} className={className} />
  ) : (
    <PixelArtSvg sprite={ZONE_SPRITES[zone]} className={className} />
  ),
);

export const PowerPixelIcon: React.FC<{ power: GodPowerType; className?: string }> = React.memo(({
  power,
  className = 'w-7 h-7 pixelated-canvas',
}) => <HqIconImg category="powers" name={power} className={className} />);

export const TerrainPixelIcon: React.FC<{ tool: TerrainToolType; className?: string }> = React.memo(({
  tool,
  className = 'w-7 h-7 pixelated-canvas',
}) => <HqIconImg category="terrain" name={tool} className={className} />);

export const BuildingPixelIcon: React.FC<{ building: BuildingType; className?: string }> = React.memo(({
  building,
  className = 'w-7 h-7 pixelated-canvas',
}) => <HqIconImg category="buildings" name={building} className={className} />);

export const UnitPixelIcon: React.FC<{ role: UnitRole; className?: string }> = React.memo(({
  role,
  className = 'w-7 h-7 pixelated-canvas',
}) =>
  HQ_UNIT_ICONS.has(role) ? (
    <HqIconImg category="units" name={role} className={className} />
  ) : (
    <PixelArtSvg sprite={UNIT_SPRITES[role] ?? UNIT_SPRITES.human} className={className} />
  ),
);

export type HudIconKind = keyof typeof HUD_SPRITES;

export const HudPixelIcon: React.FC<{
  kind: HudIconKind;
  className?: string;
}> = React.memo(({ kind, className = 'w-4 h-4 pixelated-canvas' }) => (
  <PixelArtSvg sprite={HUD_SPRITES[kind]} className={className} />
));

export const InspectorPixelIcon: React.FC<{
  kind: InspectorIconKey;
  className?: string;
}> = React.memo(({ kind, className = 'w-4 h-4 pixelated-canvas' }) =>
  kind === 'flame' ? (
    <FlameSpriteIcon className={className} label="Flame" />
  ) : (
    <PixelArtSvg sprite={INSPECTOR_SPRITES[kind] ?? INSPECTOR_SPRITES.star} className={className} />
  ),
);
