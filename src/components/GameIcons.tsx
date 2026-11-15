import React from 'react';
import {
  BuildingType,
  GodPowerType,
  Resources,
  TerrainToolType,
  ToolCategory,
  UnitRole,
  ZoneOverlayType,
} from '../game/types';

export const TitleEmblemSvg: React.FC<{ centered?: boolean }> = ({ centered = true }) => (
  <div
    className={`flex items-center gap-3 ${
      centered ? 'justify-center' : 'justify-start'
    }`}
  >
    {/* Stepped pixel ziggurat & flame emblem */}
    <svg
      viewBox="0 0 16 16"
      className="w-10 h-10 shrink-0 pixelated-canvas"
      role="img"
      aria-label="Godmulator Emblem"
      shapeRendering="crispEdges"
    >
      {/* Flame */}
      <rect x="7" y="1" width="2" height="2" fill="#ffd166" />
      <rect x="6" y="3" width="4" height="2" fill="#f77f00" />
      <rect x="7" y="3" width="2" height="1" fill="#fff3bf" />
      {/* Gold crown tier */}
      <rect x="6" y="5" width="4" height="2" fill="#f5b742" />
      <rect x="5" y="7" width="6" height="2" fill="#d97736" />
      {/* Stone base tiers */}
      <rect x="3" y="9" width="10" height="2" fill="#b8ada1" />
      <rect x="2" y="11" width="12" height="3" fill="#8f8478" />
      {/* Doorway */}
      <rect x="7" y="11" width="2" height="3" fill="#181512" />
      {/* Highlight steps */}
      <rect x="3" y="9" width="10" height="1" fill="#d6ccc0" />
      <rect x="2" y="11" width="12" height="1" fill="#a89e92" />
    </svg>
    <div className="font-display font-bold text-3xl tracking-normal text-[#f5b742] leading-none">
      Godmulator
    </div>
  </div>
);

export const ResourceIconSvg: React.FC<{ resource: keyof Resources; className?: string }> = ({
  resource,
  className = 'w-4 h-4 shrink-0 pixelated-canvas',
}) => {
  switch (resource) {
    case 'food':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="7" y="1" width="2" height="2" fill="#7c5234" />
          <rect x="9" y="2" width="3" height="2" fill="#6a994e" />
          <rect x="4" y="4" width="8" height="2" fill="#d62828" />
          <rect x="3" y="6" width="10" height="5" fill="#e63946" />
          <rect x="4" y="11" width="8" height="2" fill="#c1121f" />
          <rect x="5" y="13" width="6" height="1" fill="#8f0d16" />
          <rect x="5" y="6" width="2" height="2" fill="#ff9b9b" />
        </svg>
      );
    case 'wood':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="5" width="11" height="6" fill="#7c4f31" />
          <rect x="2" y="5" width="11" height="2" fill="#a86f46" />
          <rect x="2" y="9" width="11" height="2" fill="#59361f" />
          <rect x="11" y="5" width="3" height="6" fill="#d4b48c" />
          <rect x="12" y="7" width="1" height="2" fill="#8f6440" />
          <rect x="5" y="7" width="3" height="1" fill="#59361f" />
        </svg>
      );
    case 'stone':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="5" y="3" width="6" height="2" fill="#c2bab0" />
          <rect x="3" y="5" width="10" height="4" fill="#9c948b" />
          <rect x="2" y="9" width="12" height="4" fill="#736c64" />
          <rect x="5" y="4" width="4" height="2" fill="#e0d8ce" />
          <rect x="9" y="7" width="3" height="3" fill="#5b554e" />
        </svg>
      );
    case 'ore':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="3" width="8" height="3" fill="#64747a" />
          <rect x="2" y="6" width="12" height="7" fill="#465358" />
          <rect x="4" y="4" width="4" height="2" fill="#82949b" />
          <rect x="5" y="7" width="3" height="2" fill="#f5b742" />
          <rect x="9" y="9" width="3" height="3" fill="#e09f3e" />
          <rect x="6" y="7" width="1" height="1" fill="#fff3bf" />
        </svg>
      );
    case 'knowledge':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="3" y="2" width="10" height="12" fill="#3a6ea5" />
          <rect x="4" y="3" width="8" height="10" fill="#4ea8de" />
          <rect x="2" y="3" width="2" height="10" fill="#274c77" />
          <rect x="6" y="5" width="4" height="2" fill="#e0fbfc" />
          <rect x="5" y="8" width="6" height="1" fill="#bde0fe" />
          <rect x="5" y="10" width="5" height="1" fill="#bde0fe" />
        </svg>
      );
    case 'energy':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="8" y="1" width="3" height="3" fill="#ffd166" />
          <rect x="6" y="4" width="4" height="3" fill="#f5b742" />
          <rect x="4" y="7" width="8" height="2" fill="#fff3bf" />
          <rect x="6" y="9" width="4" height="3" fill="#f5b742" />
          <rect x="5" y="12" width="3" height="3" fill="#d97736" />
        </svg>
      );
    case 'alloy':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="4" width="8" height="2" fill="#c2f8ef" />
          <rect x="3" y="6" width="10" height="4" fill="#72efdd" />
          <rect x="2" y="10" width="12" height="3" fill="#48bfe3" />
          <rect x="5" y="5" width="5" height="2" fill="#ffffff" />
        </svg>
      );
    case 'faith':
    default:
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="7" y="1" width="2" height="14" fill="#f5b742" />
          <rect x="1" y="7" width="14" height="2" fill="#f5b742" />
          <rect x="5" y="5" width="6" height="6" fill="#ffd166" />
          <rect x="6" y="6" width="4" height="4" fill="#fff3bf" />
          <rect x="7" y="7" width="2" height="2" fill="#ffffff" />
        </svg>
      );
  }
};

export const TabPixelIcon: React.FC<{ category: ToolCategory; className?: string }> = ({
  category,
  className = 'w-4 h-4 shrink-0 pixelated-canvas',
}) => {
  switch (category) {
    case 'powers':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="3" width="8" height="3" fill="#e5e7eb" />
          <rect x="2" y="5" width="12" height="3" fill="#cbd5e1" />
          <rect x="7" y="8" width="3" height="2" fill="#f5b742" />
          <rect x="6" y="10" width="4" height="2" fill="#ffd166" />
          <rect x="7" y="12" width="2" height="3" fill="#fff3bf" />
        </svg>
      );
    case 'terrain':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="7" y="3" width="2" height="2" fill="#f2ece1" />
          <rect x="5" y="5" width="6" height="2" fill="#c4a484" />
          <rect x="3" y="7" width="10" height="3" fill="#8d7258" />
          <rect x="1" y="10" width="14" height="3" fill="#6a994e" />
        </svg>
      );
    case 'build':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="3" y="3" width="8" height="3" fill="#cbd5e1" />
          <rect x="2" y="4" width="2" height="3" fill="#94a3b8" />
          <rect x="10" y="3" width="3" height="3" fill="#64748b" />
          <rect x="6" y="6" width="2" height="8" fill="#a86f46" />
        </svg>
      );
    case 'spawn':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="6" y="2" width="4" height="4" fill="#f2cba5" />
          <rect x="6" y="2" width="4" height="1" fill="#6b4423" />
          <rect x="5" y="6" width="6" height="5" fill="#4ea8de" />
          <rect x="3" y="7" width="2" height="3" fill="#f2cba5" />
          <rect x="11" y="7" width="2" height="3" fill="#f2cba5" />
          <rect x="5" y="11" width="2" height="3" fill="#5c4033" />
          <rect x="9" y="11" width="2" height="3" fill="#5c4033" />
        </svg>
      );
    case 'zones':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="2" width="5" height="5" fill="#3b82f6" />
          <rect x="9" y="2" width="5" height="5" fill="#10b981" />
          <rect x="2" y="9" width="5" height="5" fill="#f59e0b" />
          <rect x="9" y="9" width="5" height="5" fill="#ef4444" />
          <rect x="7" y="2" width="2" height="12" fill="#f8fafc" />
          <rect x="2" y="7" width="12" height="2" fill="#f8fafc" />
        </svg>
      );
    case 'epochs':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="2" width="8" height="12" fill="#3a86ff" />
          <rect x="2" y="4" width="12" height="8" fill="#3a86ff" />
          <rect x="5" y="4" width="4" height="4" fill="#6a994e" />
          <rect x="8" y="8" width="4" height="4" fill="#80ed99" />
          <rect x="4" y="9" width="3" height="2" fill="#6a994e" />
        </svg>
      );
    case 'inspect':
    default:
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="2" width="6" height="2" fill="#90e0ef" />
          <rect x="3" y="4" width="8" height="5" fill="#48bfe3" />
          <rect x="5" y="5" width="4" height="3" fill="#caf0f8" />
          <rect x="10" y="9" width="2" height="2" fill="#a86f46" />
          <rect x="12" y="11" width="2" height="3" fill="#7c4f31" />
        </svg>
      );
  }
};

export const ZonePixelIcon: React.FC<{ zone: ZoneOverlayType; className?: string }> = ({
  zone,
  className = 'w-7 h-7 pixelated-canvas',
}) => {
  switch (zone) {
    case 'kingdoms':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Crown & Maritime Banner */}
          <rect x="2" y="11" width="12" height="3" fill="#2563eb" />
          <rect x="3" y="5" width="2" height="6" fill="#fbbf24" />
          <rect x="7" y="3" width="2" height="8" fill="#fde047" />
          <rect x="11" y="5" width="2" height="6" fill="#fbbf24" />
          <rect x="3" y="9" width="10" height="2" fill="#f59e0b" />
          <rect x="5" y="7" width="2" height="2" fill="#f59e0b" />
          <rect x="9" y="7" width="2" height="2" fill="#f59e0b" />
          <rect x="7" y="10" width="2" height="1" fill="#ef4444" />
          <rect x="4" y="13" width="8" height="1" fill="#38bdf8" />
        </svg>
      );
    case 'territories':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Beast Paw & Territory Border */}
          <rect x="3" y="4" width="2" height="3" fill="#fb923c" />
          <rect x="6" y="2" width="2" height="3" fill="#fdba74" />
          <rect x="9" y="2" width="2" height="3" fill="#fdba74" />
          <rect x="11" y="5" width="2" height="3" fill="#fb923c" />
          <rect x="5" y="7" width="6" height="5" fill="#ea580c" />
          <rect x="4" y="9" width="8" height="3" fill="#c2410c" />
          <rect x="6" y="8" width="4" height="2" fill="#fed7aa" />
          <rect x="2" y="13" width="12" height="2" fill="#2dd4bf" />
        </svg>
      );
    case 'biomes':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Land Canopy & Sea Wave */}
          <rect x="5" y="2" width="6" height="3" fill="#4ade80" />
          <rect x="3" y="5" width="10" height="3" fill="#22c55e" />
          <rect x="4" y="8" width="8" height="2" fill="#16a34a" />
          <rect x="7" y="10" width="2" height="2" fill="#854d0e" />
          <rect x="2" y="12" width="12" height="3" fill="#0284c7" />
          <rect x="3" y="12" width="4" height="1" fill="#7dd3fc" />
          <rect x="9" y="13" width="4" height="1" fill="#7dd3fc" />
        </svg>
      );
    case 'temperature':
    default:
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Pixel Thermometer with Cold -> Hot bands */}
          <rect x="6" y="2" width="4" height="8" fill="#334155" />
          <rect x="7" y="3" width="2" height="2" fill="#38bdf8" />
          <rect x="7" y="5" width="2" height="2" fill="#4ade80" />
          <rect x="7" y="7" width="2" height="3" fill="#fb923c" />
          <rect x="5" y="10" width="6" height="4" fill="#ef4444" />
          <rect x="6" y="11" width="2" height="2" fill="#fca5a5" />
          <rect x="11" y="3" width="2" height="1" fill="#94a3b8" />
          <rect x="11" y="6" width="2" height="1" fill="#94a3b8" />
          <rect x="11" y="9" width="2" height="1" fill="#94a3b8" />
        </svg>
      );
  }
};

export const PowerPixelIcon: React.FC<{ power: GodPowerType; className?: string }> = ({
  power,
  className = 'w-7 h-7 pixelated-canvas',
}) => {
  switch (power) {
    case 'blessing':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="5" y="2" width="6" height="2" fill="#ffd166" />
          <rect x="4" y="5" width="3" height="2" fill="#ff6b6b" />
          <rect x="9" y="5" width="3" height="2" fill="#ff6b6b" />
          <rect x="3" y="7" width="10" height="3" fill="#e63946" />
          <rect x="5" y="10" width="6" height="2" fill="#e63946" />
          <rect x="7" y="12" width="2" height="2" fill="#c1121f" />
        </svg>
      );
    case 'rain_of_plenty':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="2" width="7" height="3" fill="#cbd5e1" />
          <rect x="2" y="4" width="12" height="3" fill="#94a3b8" />
          <rect x="4" y="9" width="2" height="3" fill="#4ea8de" />
          <rect x="8" y="8" width="2" height="4" fill="#56cfe1" />
          <rect x="11" y="10" width="2" height="3" fill="#4ea8de" />
        </svg>
      );
    case 'eureka':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="6" y="2" width="4" height="2" fill="#fff3bf" />
          <rect x="4" y="4" width="8" height="5" fill="#ffd166" />
          <rect x="6" y="5" width="4" height="3" fill="#ffffff" />
          <rect x="6" y="9" width="4" height="2" fill="#f5b742" />
          <rect x="6" y="12" width="4" height="2" fill="#94a3b8" />
        </svg>
      );
    case 'golden_age':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="4" width="2" height="5" fill="#ffd166" />
          <rect x="7" y="3" width="2" height="6" fill="#ffd166" />
          <rect x="12" y="4" width="2" height="5" fill="#ffd166" />
          <rect x="2" y="7" width="12" height="4" fill="#f5b742" />
          <rect x="2" y="11" width="12" height="2" fill="#b87c18" />
          <rect x="7" y="8" width="2" height="2" fill="#e63946" />
        </svg>
      );
    case 'divine_shield':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="3" y="2" width="10" height="7" fill="#48bfe3" />
          <rect x="4" y="9" width="8" height="3" fill="#3a86ff" />
          <rect x="6" y="12" width="4" height="2" fill="#274c77" />
          <rect x="5" y="4" width="6" height="4" fill="#90e0ef" />
          <rect x="7" y="5" width="2" height="4" fill="#ffd166" />
        </svg>
      );
    case 'bloodlust_frenzy':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="2" width="3" height="3" fill="#e5e7eb" />
          <rect x="4" y="4" width="3" height="3" fill="#e5e7eb" />
          <rect x="11" y="2" width="3" height="3" fill="#e5e7eb" />
          <rect x="9" y="4" width="3" height="3" fill="#e5e7eb" />
          <rect x="6" y="6" width="4" height="4" fill="#e63946" />
          <rect x="3" y="10" width="3" height="3" fill="#f5b742" />
          <rect x="10" y="10" width="3" height="3" fill="#f5b742" />
        </svg>
      );
    case 'curse':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="2" width="8" height="8" fill="#9d4edd" />
          <rect x="5" y="10" width="6" height="3" fill="#7b2cbf" />
          <rect x="5" y="5" width="2" height="2" fill="#141210" />
          <rect x="9" y="5" width="2" height="2" fill="#141210" />
          <rect x="6" y="11" width="1" height="2" fill="#e0aaff" />
          <rect x="9" y="11" width="1" height="2" fill="#e0aaff" />
        </svg>
      );
    case 'plague_miasma':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="3" width="7" height="4" fill="#80ed99" />
          <rect x="2" y="6" width="12" height="5" fill="#57cc99" />
          <rect x="5" y="11" width="6" height="2" fill="#38a3a5" />
          <rect x="5" y="6" width="2" height="2" fill="#141210" />
          <rect x="9" y="6" width="2" height="2" fill="#141210" />
        </svg>
      );
    case 'lightning_smite':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="8" y="1" width="4" height="3" fill="#caf0f8" />
          <rect x="6" y="4" width="4" height="3" fill="#90e0ef" />
          <rect x="4" y="7" width="8" height="2" fill="#ffffff" />
          <rect x="7" y="9" width="4" height="3" fill="#48bfe3" />
          <rect x="5" y="12" width="3" height="3" fill="#0096c7" />
        </svg>
      );
    case 'meteor_strike':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="9" y="1" width="5" height="4" fill="#ffd166" />
          <rect x="6" y="4" width="6" height="5" fill="#f77f00" />
          <rect x="3" y="7" width="7" height="6" fill="#d62828" />
          <rect x="4" y="9" width="4" height="4" fill="#5c4742" />
        </svg>
      );
    case 'earthquake':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="8" width="12" height="5" fill="#8d5b3c" />
          <rect x="2" y="7" width="5" height="2" fill="#6a994e" />
          <rect x="9" y="6" width="5" height="2" fill="#6a994e" />
          <rect x="7" y="4" width="2" height="3" fill="#ff7b00" />
          <rect x="6" y="7" width="3" height="3" fill="#ff5400" />
          <rect x="7" y="10" width="2" height="4" fill="#1b1512" />
          <rect x="4" y="3" width="2" height="2" fill="#ffd166" />
          <rect x="10" y="2" width="2" height="2" fill="#ffd166" />
        </svg>
      );
    case 'terraform_beam':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="6" y="1" width="4" height="7" fill="#06d6a0" />
          <rect x="7" y="2" width="2" height="6" fill="#b7f7e4" />
          <rect x="2" y="9" width="12" height="2" fill="#6a994e" />
          <rect x="2" y="11" width="12" height="3" fill="#7c5234" />
        </svg>
      );
    case 'wormhole_ascension':
    default:
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="3" y="3" width="10" height="10" fill="#7b2cbf" />
          <rect x="4" y="4" width="8" height="8" fill="#c77dff" />
          <rect x="6" y="6" width="4" height="4" fill="#141210" />
          <rect x="7" y="7" width="2" height="2" fill="#e0fbfc" />
        </svg>
      );
  }
};

export const TerrainPixelIcon: React.FC<{ tool: TerrainToolType; className?: string }> = ({
  tool,
  className = 'w-7 h-7 pixelated-canvas',
}) => {
  switch (tool) {
    case 'raise':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="7" y="2" width="2" height="5" fill="#80ed99" />
          <rect x="5" y="4" width="6" height="2" fill="#80ed99" />
          <rect x="3" y="9" width="10" height="2" fill="#6a994e" />
          <rect x="3" y="11" width="10" height="3" fill="#8d5b3c" />
        </svg>
      );
    case 'lower':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="7" y="3" width="2" height="5" fill="#f4a261" />
          <rect x="5" y="6" width="6" height="2" fill="#f4a261" />
          <rect x="2" y="10" width="12" height="2" fill="#a88b6d" />
          <rect x="4" y="12" width="8" height="2" fill="#6e5a47" />
        </svg>
      );
    case 'flatten':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="5" width="12" height="2" fill="#ffd166" />
          <rect x="2" y="8" width="12" height="2" fill="#8f8478" />
          <rect x="2" y="10" width="12" height="3" fill="#695e53" />
        </svg>
      );
    case 'stone_road':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="3" width="12" height="10" fill="#5e574f" />
          <rect x="3" y="4" width="4" height="3" fill="#b8ada1" />
          <rect x="8" y="4" width="5" height="3" fill="#9c9287" />
          <rect x="3" y="8" width="6" height="4" fill="#9c9287" />
          <rect x="10" y="8" width="3" height="4" fill="#b8ada1" />
        </svg>
      );
    case 'rail_track':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="4" width="12" height="8" fill="#524d47" />
          <rect x="3" y="5" width="2" height="6" fill="#8d5b3c" />
          <rect x="7" y="5" width="2" height="6" fill="#8d5b3c" />
          <rect x="11" y="5" width="2" height="6" fill="#8d5b3c" />
          <rect x="1" y="5" width="14" height="2" fill="#cbd5e1" />
          <rect x="1" y="9" width="14" height="2" fill="#cbd5e1" />
        </svg>
      );
    case 'fertile_meadow':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="9" width="12" height="4" fill="#6a994e" />
          <rect x="4" y="5" width="2" height="4" fill="#80ed99" />
          <rect x="10" y="6" width="2" height="3" fill="#80ed99" />
          <rect x="4" y="4" width="2" height="2" fill="#ffd166" />
          <rect x="10" y="5" width="2" height="2" fill="#e63946" />
        </svg>
      );
    case 'plant_forest':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="7" y="2" width="2" height="2" fill="#6a994e" />
          <rect x="5" y="4" width="6" height="3" fill="#4f772d" />
          <rect x="3" y="7" width="10" height="4" fill="#386641" />
          <rect x="7" y="11" width="2" height="3" fill="#7c4f31" />
        </svg>
      );
    case 'seed_ore':
      return <ResourceIconSvg resource="ore" className={className} />;
    case 'carve_river':
    default:
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="4" width="12" height="8" fill="#1d6fa5" />
          <rect x="3" y="6" width="4" height="2" fill="#90e0ef" />
          <rect x="8" y="9" width="5" height="2" fill="#48bfe3" />
        </svg>
      );
  }
};

export const BuildingPixelIcon: React.FC<{ building: BuildingType; className?: string }> = ({
  building,
  className = 'w-7 h-7 pixelated-canvas',
}) => {
  switch (building) {
    case 'bonfire':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="7" y="2" width="2" height="3" fill="#ffd166" />
          <rect x="5" y="5" width="6" height="4" fill="#f77f00" />
          <rect x="7" y="6" width="2" height="3" fill="#fff3bf" />
          <rect x="3" y="10" width="10" height="2" fill="#7c4f31" />
          <rect x="2" y="12" width="12" height="2" fill="#8f8478" />
        </svg>
      );
    case 'forager_hut':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="3" width="8" height="2" fill="#a86f46" />
          <rect x="2" y="5" width="12" height="3" fill="#8d5b3c" />
          <rect x="3" y="8" width="10" height="5" fill="#d4b48c" />
          <rect x="7" y="10" width="2" height="3" fill="#59361f" />
        </svg>
      );
    case 'shaman_totem':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="6" y="2" width="4" height="12" fill="#8f8478" />
          <rect x="4" y="4" width="8" height="2" fill="#c2bab0" />
          <rect x="7" y="5" width="2" height="2" fill="#56cfe1" />
          <rect x="5" y="12" width="6" height="2" fill="#59524a" />
        </svg>
      );
    case 'granary':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="5" y="3" width="6" height="2" fill="#e09f3e" />
          <rect x="4" y="5" width="8" height="8" fill="#d4b48c" />
          <rect x="3" y="11" width="10" height="2" fill="#8f8478" />
          <rect x="7" y="9" width="2" height="4" fill="#59361f" />
        </svg>
      );
    case 'smeltery':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="9" y="2" width="3" height="5" fill="#736c64" />
          <rect x="3" y="6" width="10" height="7" fill="#8f8478" />
          <rect x="5" y="9" width="4" height="4" fill="#f77f00" />
          <rect x="6" y="10" width="2" height="3" fill="#ffd166" />
        </svg>
      );
    case 'ziggurat':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="6" y="3" width="4" height="3" fill="#f5b742" />
          <rect x="4" y="6" width="8" height="3" fill="#d4b48c" />
          <rect x="2" y="9" width="12" height="4" fill="#b89872" />
          <rect x="7" y="10" width="2" height="3" fill="#181512" />
        </svg>
      );
    case 'guildhall':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="3" y="3" width="10" height="3" fill="#c85a32" />
          <rect x="2" y="6" width="12" height="7" fill="#d4b48c" />
          <rect x="5" y="6" width="2" height="7" fill="#6b4423" />
          <rect x="9" y="6" width="2" height="7" fill="#6b4423" />
          <rect x="7" y="10" width="2" height="3" fill="#59361f" />
        </svg>
      );
    case 'observatory':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="5" y="3" width="6" height="4" fill="#4ea8de" />
          <rect x="10" y="2" width="3" height="2" fill="#ffd166" />
          <rect x="4" y="7" width="8" height="6" fill="#b8ada1" />
          <rect x="7" y="9" width="2" height="4" fill="#274c77" />
        </svg>
      );
    case 'steam_foundry':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="2" width="2" height="5" fill="#94a3b8" />
          <rect x="9" y="3" width="2" height="4" fill="#94a3b8" />
          <rect x="2" y="7" width="12" height="6" fill="#64748b" />
          <rect x="5" y="9" width="6" height="3" fill="#f77f00" />
        </svg>
      );
    case 'dynamo_plant':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="3" y="6" width="10" height="7" fill="#536267" />
          <rect x="7" y="2" width="2" height="5" fill="#f5b742" />
          <rect x="5" y="4" width="6" height="2" fill="#ffd166" />
          <rect x="5" y="9" width="6" height="2" fill="#56cfe1" />
        </svg>
      );
    case 'fission_reactor':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="3" width="8" height="3" fill="#94a3b8" />
          <rect x="3" y="6" width="10" height="7" fill="#64748b" />
          <rect x="6" y="7" width="4" height="4" fill="#80ed99" />
        </svg>
      );
    case 'cyber_institute':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="7" y="2" width="2" height="11" fill="#56cfe1" />
          <rect x="4" y="6" width="8" height="7" fill="#334155" />
          <rect x="5" y="8" width="6" height="2" fill="#90e0ef" />
        </svg>
      );
    case 'rail_station':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="4" width="12" height="3" fill="#b54d38" />
          <rect x="3" y="7" width="10" height="4" fill="#cbd5e1" />
          <rect x="5" y="8" width="6" height="2" fill="#56cfe1" />
          <rect x="1" y="11" width="14" height="2" fill="#64748b" />
          <rect x="2" y="13" width="12" height="1" fill="#ffd166" />
        </svg>
      );
    case 'airport':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="1" y="10" width="14" height="4" fill="#334155" />
          <rect x="2" y="12" width="3" height="1" fill="#f8fafc" />
          <rect x="7" y="12" width="3" height="1" fill="#f8fafc" />
          <rect x="11" y="3" width="3" height="7" fill="#94a3b8" />
          <rect x="10" y="2" width="5" height="2" fill="#56cfe1" />
          <rect x="3" y="6" width="6" height="4" fill="#e2e8f0" />
        </svg>
      );
    case 'launch_arcology':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="7" y="1" width="2" height="9" fill="#e5e7eb" />
          <rect x="6" y="4" width="4" height="5" fill="#cbd5e1" />
          <rect x="4" y="10" width="8" height="3" fill="#475569" />
          <rect x="7" y="10" width="2" height="3" fill="#f77f00" />
        </svg>
      );
    case 'dyson_spire':
    default:
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="7" y="1" width="2" height="13" fill="#ffd166" />
          <rect x="4" y="4" width="8" height="2" fill="#56cfe1" />
          <rect x="4" y="9" width="8" height="2" fill="#56cfe1" />
          <rect x="6" y="6" width="4" height="3" fill="#fff3bf" />
        </svg>
      );
  }
};

export const UnitPixelIcon: React.FC<{ role: UnitRole; className?: string }> = ({
  role,
  className = 'w-7 h-7 pixelated-canvas',
}) => {
  if (role === 'elf') {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
        {/* Golden circlet & hair */}
        <rect x="6" y="1" width="4" height="2" fill="#f5b742" />
        <rect x="5" y="3" width="6" height="1" fill="#ffd166" />
        {/* Pointed Elf ears */}
        <rect x="3" y="4" width="3" height="2" fill="#f7dec8" />
        <rect x="10" y="4" width="3" height="2" fill="#f7dec8" />
        {/* Face */}
        <rect x="6" y="4" width="4" height="2" fill="#f7dec8" />
        {/* Emerald tunic */}
        <rect x="5" y="6" width="6" height="5" fill="#388e5a" />
        <rect x="7" y="6" width="2" height="5" fill="#80ed99" />
        {/* Bow / Staff */}
        <rect x="12" y="2" width="1" height="9" fill="#d97736" />
        <rect x="13" y="4" width="1" height="5" fill="#ffd166" />
        {/* Legs */}
        <rect x="5" y="11" width="2" height="3" fill="#4a3b2c" />
        <rect x="9" y="11" width="2" height="3" fill="#4a3b2c" />
      </svg>
    );
  }

  if (role === 'orc') {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
        {/* Iron helm / brow */}
        <rect x="5" y="2" width="6" height="2" fill="#2b2522" />
        {/* Broad green head */}
        <rect x="4" y="4" width="8" height="3" fill="#6a994e" />
        {/* Tusks */}
        <rect x="5" y="6" width="1" height="2" fill="#f2ece1" />
        <rect x="10" y="6" width="1" height="2" fill="#f2ece1" />
        {/* Crimson armor torso */}
        <rect x="4" y="7" width="8" height="4" fill="#9b2226" />
        <rect x="3" y="7" width="1" height="3" fill="#6a994e" />
        {/* Heavy axe */}
        <rect x="12" y="3" width="2" height="8" fill="#94a3b8" />
        <rect x="13" y="3" width="2" height="3" fill="#e5e7eb" />
        {/* Legs */}
        <rect x="5" y="11" width="2" height="3" fill="#3d2b1f" />
        <rect x="9" y="11" width="2" height="3" fill="#3d2b1f" />
      </svg>
    );
  }

  if (role === 'cow') {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="3" y="3" width="2" height="2" fill="#e8dec8" />
        <rect x="11" y="3" width="2" height="2" fill="#e8dec8" />
        <rect x="4" y="4" width="8" height="6" fill="#f8fafc" />
        <rect x="4" y="5" width="3" height="3" fill="#1e2026" />
        <rect x="9" y="4" width="3" height="2" fill="#1e2026" />
        <rect x="5" y="6" width="1" height="1" fill="#16161a" />
        <rect x="10" y="6" width="1" height="1" fill="#16161a" />
        <rect x="5" y="8" width="6" height="3" fill="#f4b6c2" />
        <rect x="4" y="11" width="2" height="3" fill="#f8fafc" />
        <rect x="10" y="11" width="2" height="3" fill="#f8fafc" />
      </svg>
    );
  }

  if (role === 'pig') {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="3" y="4" width="2" height="2" fill="#e88d9a" />
        <rect x="11" y="4" width="2" height="2" fill="#e88d9a" />
        <rect x="4" y="5" width="8" height="6" fill="#f4a5ae" />
        <rect x="5" y="7" width="1" height="1" fill="#16161a" />
        <rect x="10" y="7" width="1" height="1" fill="#16161a" />
        <rect x="6" y="8" width="4" height="3" fill="#f9bec7" />
        <rect x="7" y="9" width="1" height="1" fill="#b56576" />
        <rect x="9" y="9" width="1" height="1" fill="#b56576" />
        <rect x="5" y="11" width="2" height="3" fill="#f4a5ae" />
        <rect x="9" y="11" width="2" height="3" fill="#f4a5ae" />
      </svg>
    );
  }

  if (role === 'chicken') {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="7" y="2" width="3" height="2" fill="#d62828" />
        <rect x="5" y="4" width="5" height="4" fill="#f8fafc" />
        <rect x="10" y="5" width="3" height="2" fill="#f59e0b" />
        <rect x="8" y="5" width="1" height="1" fill="#16161a" />
        <rect x="4" y="8" width="7" height="4" fill="#e2e8f0" />
        <rect x="2" y="7" width="2" height="3" fill="#cbd5e1" />
        <rect x="6" y="12" width="1" height="2" fill="#f59e0b" />
        <rect x="9" y="12" width="1" height="2" fill="#f59e0b" />
      </svg>
    );
  }

  if (role === 'capybara') {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="9" y="3" width="2" height="2" fill="#5c3d2e" />
        <rect x="7" y="4" width="6" height="5" fill="#9c6644" />
        <rect x="11" y="6" width="3" height="3" fill="#5c3d2e" />
        <rect x="10" y="5" width="1" height="1" fill="#16161a" />
        <rect x="3" y="7" width="8" height="5" fill="#8b5a3c" />
        <rect x="4" y="12" width="2" height="2" fill="#5c3d2e" />
        <rect x="9" y="12" width="2" height="2" fill="#5c3d2e" />
      </svg>
    );
  }

  if (role === 'wolf') {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="4" y="3" width="2" height="3" fill="#7b848f" />
        <rect x="10" y="3" width="2" height="3" fill="#7b848f" />
        <rect x="4" y="5" width="8" height="5" fill="#7b848f" />
        <rect x="5" y="7" width="1" height="1" fill="#fbbf24" />
        <rect x="10" y="7" width="1" height="1" fill="#fbbf24" />
        <rect x="6" y="8" width="4" height="3" fill="#cbd5e1" />
        <rect x="7" y="10" width="2" height="1" fill="#1e2026" />
        <rect x="4" y="10" width="2" height="4" fill="#7b848f" />
        <rect x="10" y="10" width="2" height="4" fill="#7b848f" />
      </svg>
    );
  }

  if (role === 'bear') {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="3" y="3" width="2" height="2" fill="#6f4528" />
        <rect x="11" y="3" width="2" height="2" fill="#6f4528" />
        <rect x="4" y="4" width="8" height="6" fill="#6f4528" />
        <rect x="5" y="6" width="1" height="1" fill="#16161a" />
        <rect x="10" y="6" width="1" height="1" fill="#16161a" />
        <rect x="6" y="7" width="4" height="3" fill="#b08968" />
        <rect x="7" y="8" width="2" height="1" fill="#1e2026" />
        <rect x="3" y="10" width="10" height="4" fill="#5c381f" />
      </svg>
    );
  }

  if (role === 'dinosaur') {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="7" y="2" width="6" height="4" fill="#3b7a48" />
        <rect x="9" y="3" width="1" height="1" fill="#fbbf24" />
        <rect x="9" y="6" width="4" height="1" fill="#f4ecd8" />
        <rect x="5" y="6" width="5" height="5" fill="#3b7a48" />
        <rect x="6" y="7" width="3" height="3" fill="#c2b280" />
        <rect x="2" y="9" width="3" height="2" fill="#3b7a48" />
        <rect x="6" y="11" width="2" height="3" fill="#2d6a4f" />
        <rect x="9" y="11" width="2" height="3" fill="#2d6a4f" />
      </svg>
    );
  }

  if (role === 'dragon') {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="2" y="3" width="4" height="4" fill="#7f1d1d" />
        <rect x="10" y="3" width="4" height="4" fill="#7f1d1d" />
        <rect x="6" y="2" width="1" height="2" fill="#f1e6d2" />
        <rect x="9" y="2" width="1" height="2" fill="#f1e6d2" />
        <rect x="6" y="4" width="4" height="4" fill="#b91c1c" />
        <rect x="7" y="5" width="2" height="1" fill="#ff6b35" />
        <rect x="5" y="8" width="6" height="4" fill="#b91c1c" />
        <rect x="7" y="8" width="2" height="4" fill="#f59e0b" />
        <rect x="5" y="12" width="2" height="2" fill="#991b1b" />
        <rect x="9" y="12" width="2" height="2" fill="#991b1b" />
      </svg>
    );
  }

  if (role === 'unicorn') {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="9" y="1" width="2" height="3" fill="#ffd166" />
        <rect x="6" y="4" width="2" height="4" fill="#f472b6" />
        <rect x="5" y="5" width="2" height="3" fill="#72efdd" />
        <rect x="8" y="4" width="5" height="4" fill="#fafafa" />
        <rect x="10" y="5" width="1" height="1" fill="#38bdf8" />
        <rect x="4" y="8" width="7" height="4" fill="#fafafa" />
        <rect x="2" y="9" width="2" height="3" fill="#c084fc" />
        <rect x="4" y="12" width="2" height="2" fill="#f5b742" />
        <rect x="9" y="12" width="2" height="2" fill="#f5b742" />
      </svg>
    );
  }

  if (role === 'human' || role === 'villager') {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="6" y="2" width="4" height="2" fill="#7c4f31" />
        <rect x="6" y="4" width="4" height="2" fill="#f2cba5" />
        <rect x="5" y="6" width="6" height="5" fill="#4ea8de" />
        <rect x="7" y="6" width="2" height="2" fill="#ffd166" />
        <rect x="3" y="7" width="2" height="3" fill="#f2cba5" />
        <rect x="11" y="7" width="2" height="3" fill="#f2cba5" />
        <rect x="5" y="11" width="2" height="3" fill="#463a31" />
        <rect x="9" y="11" width="2" height="3" fill="#463a31" />
      </svg>
    );
  }

  const palette: Record<
    string,
    { shirt: string; hat: string; skin: string; item?: string }
  > = {
    forager: { shirt: '#6a994e', hat: '#386641', skin: '#f2cba5', item: '#ffd166' },
    miner: { shirt: '#8f8478', hat: '#f5b742', skin: '#f2cba5', item: '#cbd5e1' },
    builder: { shirt: '#d97736', hat: '#b07d56', skin: '#f2cba5', item: '#94a3b8' },
    warrior: { shirt: '#c85a32', hat: '#cbd5e1', skin: '#f2cba5', item: '#f5b742' },
    priest: { shirt: '#e5e7eb', hat: '#ffd166', skin: '#f2cba5', item: '#56cfe1' },
    scholar: { shirt: '#3a6ea5', hat: '#274c77', skin: '#f2cba5', item: '#90e0ef' },
    astro_engineer: { shirt: '#e0fbfc', hat: '#48bfe3', skin: '#334155', item: '#ffd166' },
    raider_swarmer: { shirt: '#9b2226', hat: '#5c4033', skin: '#d4a373', item: '#cbd5e1' },
    raider_ranged: { shirt: '#6c2b35', hat: '#3d2226', skin: '#d4a373', item: '#a86f46' },
    raider_behemoth: { shirt: '#4a1c24', hat: '#1f181a', skin: '#8d5b3c', item: '#e63946' },
  };
  const p = palette[role] ?? { shirt: '#4ea8de', hat: '#6b4423', skin: '#f2cba5' };

  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
      <rect x="6" y="2" width="4" height="2" fill={p.hat} />
      <rect x="6" y="4" width="4" height="2" fill={p.skin} />
      <rect x="5" y="6" width="6" height="5" fill={p.shirt} />
      <rect x="3" y="7" width="2" height="3" fill={p.skin} />
      <rect x="11" y="7" width="2" height="3" fill={p.skin} />
      {p.item && <rect x="12" y="4" width="2" height="4" fill={p.item} />}
      <rect x="5" y="11" width="2" height="3" fill="#463a31" />
      <rect x="9" y="11" width="2" height="3" fill="#463a31" />
    </svg>
  );
};

export const HudPixelIcon: React.FC<{
  kind:
    | 'rotateLeft'
    | 'rotateRight'
    | 'center'
    | 'log'
    | 'audioOn'
    | 'audioOff'
    | 'pause'
    | 'play'
    | 'reset'
    | 'settings';
  className?: string;
}> = ({ kind, className = 'w-4 h-4 pixelated-canvas' }) => {
  switch (kind) {
    case 'rotateLeft':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="5" y="3" width="6" height="2" fill="currentColor" />
          <rect x="3" y="5" width="2" height="4" fill="currentColor" />
          <rect x="6" y="1" width="2" height="2" fill="currentColor" />
          <rect x="6" y="5" width="2" height="2" fill="currentColor" />
          <rect x="5" y="10" width="6" height="2" fill="currentColor" />
          <rect x="11" y="5" width="2" height="5" fill="currentColor" />
        </svg>
      );
    case 'rotateRight':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="5" y="3" width="6" height="2" fill="currentColor" />
          <rect x="11" y="5" width="2" height="4" fill="currentColor" />
          <rect x="8" y="1" width="2" height="2" fill="currentColor" />
          <rect x="8" y="5" width="2" height="2" fill="currentColor" />
          <rect x="5" y="10" width="6" height="2" fill="currentColor" />
          <rect x="3" y="5" width="2" height="5" fill="currentColor" />
        </svg>
      );
    case 'center':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="7" y="2" width="2" height="3" fill="currentColor" />
          <rect x="7" y="11" width="2" height="3" fill="currentColor" />
          <rect x="2" y="7" width="3" height="2" fill="currentColor" />
          <rect x="11" y="7" width="3" height="2" fill="currentColor" />
          <rect x="6" y="6" width="4" height="4" fill="#f5b742" />
        </svg>
      );
    case 'log':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="3" y="2" width="10" height="12" fill="currentColor" />
          <rect x="5" y="4" width="6" height="2" fill="#181512" />
          <rect x="5" y="7" width="6" height="2" fill="#181512" />
          <rect x="5" y="10" width="4" height="2" fill="#181512" />
        </svg>
      );
    case 'audioOn':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="3" y="6" width="3" height="4" fill="currentColor" />
          <rect x="6" y="4" width="3" height="8" fill="currentColor" />
          <rect x="10" y="5" width="2" height="6" fill="#80ed99" />
          <rect x="13" y="3" width="1" height="10" fill="#80ed99" />
        </svg>
      );
    case 'audioOff':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="3" y="6" width="3" height="4" fill="currentColor" />
          <rect x="6" y="4" width="3" height="8" fill="currentColor" />
          <rect x="10" y="5" width="2" height="2" fill="#e63946" />
          <rect x="12" y="7" width="2" height="2" fill="#e63946" />
          <rect x="10" y="9" width="2" height="2" fill="#e63946" />
          <rect x="12" y="5" width="2" height="2" fill="#e63946" />
          <rect x="10" y="7" width="2" height="2" fill="#e63946" />
          <rect x="12" y="9" width="2" height="2" fill="#e63946" />
        </svg>
      );
    case 'pause':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="3" width="3" height="10" fill="currentColor" />
          <rect x="9" y="3" width="3" height="10" fill="currentColor" />
        </svg>
      );
    case 'play':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="3" width="2" height="10" fill="currentColor" />
          <rect x="6" y="4" width="2" height="8" fill="currentColor" />
          <rect x="8" y="5" width="2" height="6" fill="currentColor" />
          <rect x="10" y="7" width="2" height="2" fill="currentColor" />
        </svg>
      );
    case 'settings':
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="7" y="2" width="2" height="2" fill="currentColor" />
          <rect x="7" y="12" width="2" height="2" fill="currentColor" />
          <rect x="2" y="7" width="2" height="2" fill="currentColor" />
          <rect x="12" y="7" width="2" height="2" fill="currentColor" />
          <rect x="4" y="4" width="8" height="8" fill="currentColor" />
          <rect x="6" y="6" width="4" height="4" fill="#181512" />
        </svg>
      );
    case 'reset':
    default:
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="3" width="8" height="2" fill="currentColor" />
          <rect x="3" y="5" width="2" height="6" fill="currentColor" />
          <rect x="4" y="11" width="8" height="2" fill="currentColor" />
          <rect x="11" y="7" width="2" height="4" fill="currentColor" />
          <rect x="9" y="5" width="4" height="2" fill="currentColor" />
        </svg>
      );
  }
};
