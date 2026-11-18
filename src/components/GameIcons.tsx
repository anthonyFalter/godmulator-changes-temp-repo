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
    {/* Outlined 24x24 pixel ziggurat & brazier flame emblem */}
    <svg
      viewBox="0 0 24 24"
      className="w-11 h-11 shrink-0 pixelated-canvas"
      role="img"
      aria-label="Godmulator Emblem"
      shapeRendering="crispEdges"
    >
      {/* Flame outline & glow */}
      <rect x="10" y="1" width="4" height="1" fill="#0b0a09" />
      <rect x="9" y="2" width="1" height="2" fill="#0b0a09" />
      <rect x="14" y="2" width="1" height="2" fill="#0b0a09" />
      <rect x="8" y="4" width="1" height="3" fill="#0b0a09" />
      <rect x="15" y="4" width="1" height="3" fill="#0b0a09" />
      <rect x="11" y="2" width="2" height="2" fill="#fff3bf" />
      <rect x="10" y="3" width="1" height="3" fill="#ffd166" />
      <rect x="13" y="3" width="1" height="3" fill="#ffd166" />
      <rect x="9" y="4" width="6" height="3" fill="#f77f00" />
      <rect x="11" y="4" width="2" height="2" fill="#fff3bf" />
      {/* Gold crown tier */}
      <rect x="7" y="7" width="10" height="1" fill="#0b0a09" />
      <rect x="6" y="8" width="1" height="3" fill="#0b0a09" />
      <rect x="17" y="8" width="1" height="3" fill="#0b0a09" />
      <rect x="7" y="8" width="10" height="1" fill="#ffe08a" />
      <rect x="7" y="9" width="10" height="2" fill="#f5b742" />
      <rect x="14" y="9" width="3" height="2" fill="#d97736" />
      {/* Middle tier */}
      <rect x="4" y="11" width="16" height="1" fill="#0b0a09" />
      <rect x="3" y="12" width="1" height="4" fill="#0b0a09" />
      <rect x="20" y="12" width="1" height="4" fill="#0b0a09" />
      <rect x="4" y="12" width="16" height="1" fill="#e6ddd1" />
      <rect x="4" y="13" width="16" height="3" fill="#b8ada1" />
      <rect x="16" y="13" width="4" height="3" fill="#8f8478" />
      {/* Base tier */}
      <rect x="2" y="16" width="20" height="1" fill="#0b0a09" />
      <rect x="1" y="17" width="1" height="5" fill="#0b0a09" />
      <rect x="22" y="17" width="1" height="5" fill="#0b0a09" />
      <rect x="1" y="22" width="22" height="1" fill="#0b0a09" />
      <rect x="2" y="17" width="20" height="1" fill="#c7bdb0" />
      <rect x="2" y="18" width="20" height="4" fill="#8f8478" />
      <rect x="18" y="18" width="4" height="4" fill="#685f56" />
      {/* Arcane doorway & rune */}
      <rect x="9" y="16" width="6" height="6" fill="#0b0a09" />
      <rect x="10" y="17" width="4" height="5" fill="#1b3a4b" />
      <rect x="11" y="18" width="2" height="2" fill="#56cfe1" />
      {/* Side torches */}
      <rect x="5" y="14" width="2" height="2" fill="#ffd166" />
      <rect x="17" y="14" width="2" height="2" fill="#ffd166" />
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
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Stem & Leaf */}
          <rect x="11" y="2" width="2" height="4" fill="#0b0a09" />
          <rect x="11" y="3" width="2" height="3" fill="#7c5234" />
          <rect x="13" y="2" width="5" height="4" fill="#0b0a09" />
          <rect x="13" y="3" width="4" height="2" fill="#80ed99" />
          <rect x="15" y="4" width="2" height="1" fill="#4f772d" />
          {/* Apple outline */}
          <rect x="6" y="6" width="12" height="1" fill="#0b0a09" />
          <rect x="4" y="7" width="16" height="2" fill="#0b0a09" />
          <rect x="3" y="9" width="18" height="8" fill="#0b0a09" />
          <rect x="4" y="17" width="16" height="3" fill="#0b0a09" />
          <rect x="6" y="20" width="12" height="2" fill="#0b0a09" />
          {/* Shaded body */}
          <rect x="6" y="7" width="5" height="2" fill="#ff595e" />
          <rect x="13" y="7" width="5" height="2" fill="#e63946" />
          <rect x="4" y="9" width="16" height="8" fill="#e63946" />
          <rect x="5" y="17" width="14" height="2" fill="#c1121f" />
          <rect x="7" y="19" width="10" height="2" fill="#9b0e18" />
          <rect x="15" y="9" width="5" height="8" fill="#c1121f" />
          {/* Gloss highlight */}
          <rect x="6" y="9" width="3" height="3" fill="#ff9b9b" />
          <rect x="7" y="10" width="2" height="1" fill="#fff0f3" />
          <rect x="6" y="13" width="2" height="2" fill="#ff758f" />
        </svg>
      );
    case 'wood':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Cut Timber Log Outline */}
          <rect x="3" y="6" width="18" height="12" fill="#0b0a09" />
          <rect x="2" y="8" width="20" height="8" fill="#0b0a09" />
          {/* Bark cylinder */}
          <rect x="3" y="8" width="13" height="8" fill="#7c4f31" />
          <rect x="4" y="7" width="12" height="2" fill="#a86f46" />
          <rect x="4" y="9" width="11" height="2" fill="#945d39" />
          <rect x="3" y="14" width="13" height="3" fill="#59361f" />
          {/* Bark grooves */}
          <rect x="6" y="10" width="5" height="1" fill="#59361f" />
          <rect x="8" y="12" width="6" height="1" fill="#59361f" />
          <rect x="5" y="14" width="4" height="1" fill="#3d2414" />
          {/* End grain cross-section */}
          <rect x="15" y="7" width="5" height="10" fill="#e8cfa8" />
          <rect x="16" y="8" width="4" height="8" fill="#d4b48c" />
          <rect x="17" y="10" width="2" height="4" fill="#a8794d" />
          <rect x="18" y="11" width="1" height="2" fill="#7c4f31" />
        </svg>
      );
    case 'stone':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Faceted Stone Block Outline */}
          <rect x="6" y="4" width="12" height="2" fill="#0b0a09" />
          <rect x="4" y="6" width="16" height="3" fill="#0b0a09" />
          <rect x="2" y="9" width="20" height="10" fill="#0b0a09" />
          <rect x="4" y="19" width="16" height="2" fill="#0b0a09" />
          {/* Top facet */}
          <rect x="6" y="5" width="11" height="3" fill="#e0d8ce" />
          <rect x="5" y="7" width="13" height="3" fill="#c2bab0" />
          {/* Front & shadow facets */}
          <rect x="3" y="10" width="11" height="8" fill="#9c948b" />
          <rect x="14" y="10" width="7" height="8" fill="#736c64" />
          <rect x="5" y="17" width="14" height="3" fill="#5b554e" />
          {/* Chisel crack & specular */}
          <rect x="7" y="6" width="5" height="1" fill="#f5efe6" />
          <rect x="8" y="12" width="2" height="3" fill="#5b554e" />
          <rect x="10" y="14" width="2" height="2" fill="#464038" />
        </svg>
      );
    case 'ore':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Ore Boulder Outline */}
          <rect x="6" y="4" width="12" height="2" fill="#0b0a09" />
          <rect x="4" y="6" width="16" height="4" fill="#0b0a09" />
          <rect x="2" y="10" width="20" height="9" fill="#0b0a09" />
          <rect x="4" y="19" width="16" height="2" fill="#0b0a09" />
          {/* Slate matrix */}
          <rect x="6" y="5" width="11" height="4" fill="#64747a" />
          <rect x="4" y="9" width="16" height="9" fill="#465358" />
          <rect x="5" y="17" width="14" height="3" fill="#313b3f" />
          <rect x="7" y="6" width="6" height="2" fill="#82949b" />
          {/* Gold crystal veins */}
          <rect x="7" y="9" width="5" height="4" fill="#e09f3e" />
          <rect x="8" y="9" width="3" height="3" fill="#ffd166" />
          <rect x="8" y="9" width="1" height="2" fill="#fff3bf" />
          <rect x="13" y="12" width="5" height="5" fill="#e09f3e" />
          <rect x="14" y="12" width="3" height="4" fill="#f5b742" />
          <rect x="14" y="13" width="1" height="2" fill="#fff3bf" />
          <rect x="5" y="14" width="3" height="3" fill="#f5b742" />
        </svg>
      );
    case 'knowledge':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Arcane Tome Outline */}
          <rect x="4" y="2" width="16" height="20" fill="#0b0a09" />
          <rect x="3" y="4" width="18" height="16" fill="#0b0a09" />
          {/* Leather spine */}
          <rect x="4" y="3" width="3" height="18" fill="#1d3557" />
          <rect x="5" y="5" width="1" height="14" fill="#457b9d" />
          {/* Book cover */}
          <rect x="7" y="3" width="12" height="17" fill="#3a6ea5" />
          <rect x="8" y="4" width="10" height="15" fill="#4ea8de" />
          {/* Page edge bottom */}
          <rect x="7" y="19" width="12" height="2" fill="#e8e0d2" />
          {/* Gold crest & clasp */}
          <rect x="10" y="6" width="6" height="4" fill="#ffd166" />
          <rect x="11" y="7" width="4" height="2" fill="#fff3bf" />
          <rect x="18" y="10" width="2" height="4" fill="#f5b742" />
          {/* Illuminated script lines */}
          <rect x="9" y="12" width="7" height="1" fill="#e0fbfc" />
          <rect x="9" y="14" width="6" height="1" fill="#bde0fe" />
          <rect x="9" y="16" width="4" height="1" fill="#bde0fe" />
        </svg>
      );
    case 'energy':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Lightning Bolt Outline */}
          <rect x="11" y="1" width="6" height="2" fill="#0b0a09" />
          <rect x="9" y="3" width="7" height="3" fill="#0b0a09" />
          <rect x="7" y="6" width="8" height="3" fill="#0b0a09" />
          <rect x="5" y="9" width="14" height="4" fill="#0b0a09" />
          <rect x="9" y="13" width="8" height="3" fill="#0b0a09" />
          <rect x="8" y="16" width="7" height="3" fill="#0b0a09" />
          <rect x="7" y="19" width="5" height="4" fill="#0b0a09" />
          {/* Inner glow */}
          <rect x="12" y="2" width="4" height="2" fill="#ffd166" />
          <rect x="10" y="4" width="5" height="3" fill="#f5b742" />
          <rect x="8" y="7" width="5" height="3" fill="#ffd166" />
          <rect x="6" y="10" width="12" height="2" fill="#fff3bf" />
          <rect x="9" y="10" width="6" height="2" fill="#ffffff" />
          <rect x="10" y="12" width="6" height="3" fill="#f5b742" />
          <rect x="9" y="15" width="5" height="3" fill="#e09f3e" />
          <rect x="8" y="18" width="3" height="3" fill="#d97736" />
        </svg>
      );
    case 'alloy':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Ingot Bar Outline */}
          <rect x="6" y="5" width="12" height="2" fill="#0b0a09" />
          <rect x="4" y="7" width="16" height="4" fill="#0b0a09" />
          <rect x="2" y="11" width="20" height="7" fill="#0b0a09" />
          <rect x="3" y="18" width="18" height="2" fill="#0b0a09" />
          {/* Top face */}
          <rect x="6" y="6" width="12" height="3" fill="#c2f8ef" />
          <rect x="8" y="6" width="7" height="2" fill="#ffffff" />
          {/* Middle bevel */}
          <rect x="4" y="9" width="15" height="4" fill="#72efdd" />
          {/* Front shadow face */}
          <rect x="3" y="13" width="18" height="5" fill="#48bfe3" />
          <rect x="15" y="13" width="6" height="5" fill="#2a8db8" />
          {/* Metallic glint */}
          <rect x="6" y="11" width="3" height="4" fill="#e0fbfc" />
        </svg>
      );
    case 'faith':
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Radiant 4-Point Sun Star Outline */}
          <rect x="10" y="1" width="4" height="22" fill="#0b0a09" />
          <rect x="1" y="10" width="22" height="4" fill="#0b0a09" />
          <rect x="8" y="5" width="8" height="14" fill="#0b0a09" />
          <rect x="5" y="8" width="14" height="8" fill="#0b0a09" />
          {/* Rays */}
          <rect x="11" y="2" width="2" height="20" fill="#f5b742" />
          <rect x="2" y="11" width="20" height="2" fill="#f5b742" />
          {/* Warm glow diamond */}
          <rect x="9" y="6" width="6" height="12" fill="#ffd166" />
          <rect x="6" y="9" width="12" height="6" fill="#ffd166" />
          <rect x="8" y="8" width="8" height="8" fill="#fff3bf" />
          <rect x="10" y="10" width="4" height="4" fill="#ffffff" />
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
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Cloud + Lightning */}
          <rect x="6" y="2" width="11" height="2" fill="#0b0a09" />
          <rect x="3" y="4" width="18" height="8" fill="#0b0a09" />
          <rect x="6" y="3" width="10" height="3" fill="#f1f5f9" />
          <rect x="4" y="5" width="16" height="5" fill="#cbd5e1" />
          <rect x="5" y="9" width="14" height="2" fill="#94a3b8" />
          {/* Bolt */}
          <rect x="10" y="11" width="6" height="11" fill="#0b0a09" />
          <rect x="8" y="14" width="8" height="3" fill="#0b0a09" />
          <rect x="12" y="11" width="3" height="3" fill="#ffd166" />
          <rect x="9" y="14" width="6" height="2" fill="#fff3bf" />
          <rect x="11" y="16" width="3" height="3" fill="#f5b742" />
          <rect x="10" y="19" width="2" height="3" fill="#d97736" />
        </svg>
      );
    case 'terrain':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Alpine Mountain & Meadow */}
          <rect x="10" y="2" width="4" height="2" fill="#0b0a09" />
          <rect x="8" y="4" width="8" height="3" fill="#0b0a09" />
          <rect x="6" y="7" width="12" height="4" fill="#0b0a09" />
          <rect x="3" y="11" width="18" height="5" fill="#0b0a09" />
          <rect x="1" y="16" width="22" height="6" fill="#0b0a09" />
          {/* Snow cap */}
          <rect x="10" y="3" width="4" height="2" fill="#f8fafc" />
          <rect x="9" y="5" width="6" height="2" fill="#e2e8f0" />
          {/* Mountain rock */}
          <rect x="7" y="7" width="6" height="4" fill="#b89f86" />
          <rect x="13" y="7" width="4" height="4" fill="#8d7258" />
          <rect x="4" y="11" width="10" height="5" fill="#9b7e62" />
          <rect x="14" y="11" width="6" height="5" fill="#6f5842" />
          {/* Meadow & earth */}
          <rect x="2" y="16" width="20" height="2" fill="#80ed99" />
          <rect x="2" y="18" width="20" height="3" fill="#52b788" />
        </svg>
      );
    case 'build':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Forged Smith Hammer */}
          <rect x="4" y="2" width="16" height="8" fill="#0b0a09" />
          <rect x="2" y="4" width="20" height="5" fill="#0b0a09" />
          <rect x="10" y="10" width="4" height="12" fill="#0b0a09" />
          {/* Steel Head */}
          <rect x="5" y="3" width="13" height="2" fill="#f1f5f9" />
          <rect x="3" y="5" width="16" height="3" fill="#cbd5e1" />
          <rect x="15" y="4" width="5" height="4" fill="#64748b" />
          <rect x="9" y="8" width="6" height="2" fill="#94a3b8" />
          {/* Oak Handle */}
          <rect x="11" y="10" width="2" height="11" fill="#a86f46" />
          <rect x="12" y="11" width="1" height="10" fill="#7c4f31" />
          <rect x="10" y="19" width="4" height="2" fill="#f5b742" />
        </svg>
      );
    case 'spawn':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Settler Bust */}
          <rect x="7" y="2" width="10" height="9" fill="#0b0a09" />
          <rect x="5" y="10" width="14" height="7" fill="#0b0a09" />
          <rect x="7" y="17" width="10" height="5" fill="#0b0a09" />
          {/* Hair & Head */}
          <rect x="8" y="3" width="8" height="2" fill="#7c4f31" />
          <rect x="8" y="5" width="8" height="4" fill="#f2cba5" />
          <rect x="9" y="6" width="2" height="1" fill="#181512" />
          <rect x="13" y="6" width="2" height="1" fill="#181512" />
          {/* Tunic & Gold Clasp */}
          <rect x="7" y="10" width="10" height="6" fill="#4ea8de" />
          <rect x="11" y="10" width="2" height="3" fill="#ffd166" />
          <rect x="4" y="11" width="3" height="4" fill="#f2cba5" />
          <rect x="17" y="11" width="3" height="4" fill="#f2cba5" />
          {/* Boots */}
          <rect x="8" y="16" width="3" height="5" fill="#5c4033" />
          <rect x="13" y="16" width="3" height="5" fill="#5c4033" />
        </svg>
      );
    case 'zones':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Folded Map with Kingdom Borders */}
          <rect x="2" y="3" width="20" height="18" fill="#0b0a09" />
          <rect x="3" y="4" width="6" height="8" fill="#3b82f6" />
          <rect x="9" y="4" width="6" height="8" fill="#10b981" />
          <rect x="15" y="4" width="6" height="8" fill="#f59e0b" />
          <rect x="3" y="12" width="6" height="8" fill="#6366f1" />
          <rect x="9" y="12" width="6" height="8" fill="#ef4444" />
          <rect x="15" y="12" width="6" height="8" fill="#14b8a6" />
          {/* Border Grid Lines */}
          <rect x="8" y="4" width="2" height="16" fill="#f8fafc" />
          <rect x="14" y="4" width="2" height="16" fill="#f8fafc" />
          <rect x="3" y="11" width="18" height="2" fill="#f8fafc" />
          {/* Map pin */}
          <rect x="10" y="7" width="4" height="4" fill="#ffd166" />
          <rect x="11" y="8" width="2" height="2" fill="#e63946" />
        </svg>
      );
    case 'rules':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Divine Edict Tablet */}
          <rect x="4" y="2" width="16" height="20" fill="#0b0a09" />
          <rect x="5" y="3" width="14" height="18" fill="#8f8478" />
          <rect x="6" y="4" width="12" height="16" fill="#6b635a" />
          <rect x="8" y="5" width="8" height="3" fill="#ffd166" />
          <rect x="9" y="6" width="6" height="1" fill="#fff3bf" />
          <rect x="7" y="10" width="10" height="2" fill="#f2ece1" />
          <rect x="7" y="13" width="7" height="2" fill="#e2d9cc" />
          <rect x="7" y="16" width="8" height="2" fill="#56cfe1" />
        </svg>
      );
    case 'epochs':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Shaded World Globe */}
          <rect x="7" y="2" width="10" height="20" fill="#0b0a09" />
          <rect x="4" y="4" width="16" height="16" fill="#0b0a09" />
          <rect x="2" y="7" width="20" height="10" fill="#0b0a09" />
          {/* Ocean */}
          <rect x="7" y="3" width="10" height="18" fill="#2563eb" />
          <rect x="5" y="5" width="14" height="14" fill="#3a86ff" />
          <rect x="3" y="8" width="18" height="8" fill="#3a86ff" />
          {/* Continents */}
          <rect x="6" y="6" width="6" height="5" fill="#6a994e" />
          <rect x="7" y="6" width="4" height="3" fill="#80ed99" />
          <rect x="13" y="11" width="6" height="6" fill="#52b788" />
          <rect x="14" y="12" width="3" height="3" fill="#80ed99" />
          <rect x="5" y="14" width="4" height="3" fill="#6a994e" />
          {/* Specular */}
          <rect x="8" y="4" width="3" height="2" fill="#90e0ef" />
        </svg>
      );
    case 'inspect':
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Brass Magnifying Glass */}
          <rect x="5" y="2" width="9" height="2" fill="#0b0a09" />
          <rect x="3" y="4" width="13" height="2" fill="#0b0a09" />
          <rect x="2" y="6" width="15" height="7" fill="#0b0a09" />
          <rect x="3" y="13" width="13" height="2" fill="#0b0a09" />
          <rect x="5" y="15" width="9" height="2" fill="#0b0a09" />
          {/* Brass frame */}
          <rect x="5" y="3" width="9" height="13" fill="#f5b742" />
          <rect x="3" y="5" width="13" height="9" fill="#ffd166" />
          {/* Crystal lens */}
          <rect x="6" y="5" width="7" height="9" fill="#48bfe3" />
          <rect x="5" y="6" width="9" height="7" fill="#90e0ef" />
          <rect x="6" y="7" width="3" height="3" fill="#ffffff" />
          {/* Handle */}
          <rect x="14" y="14" width="4" height="4" fill="#0b0a09" />
          <rect x="16" y="16" width="5" height="5" fill="#0b0a09" />
          <rect x="14" y="14" width="3" height="3" fill="#a86f46" />
          <rect x="17" y="17" width="3" height="3" fill="#7c4f31" />
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
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Heraldic Crown & Sea Banner */}
          <rect x="3" y="16" width="18" height="6" fill="#0b0a09" />
          <rect x="4" y="5" width="16" height="11" fill="#0b0a09" />
          <rect x="10" y="3" width="4" height="3" fill="#0b0a09" />
          {/* Sea base */}
          <rect x="4" y="17" width="16" height="4" fill="#2563eb" />
          <rect x="6" y="19" width="12" height="1" fill="#38bdf8" />
          {/* Crown tines */}
          <rect x="5" y="7" width="3" height="8" fill="#fbbf24" />
          <rect x="10" y="4" width="4" height="11" fill="#fde047" />
          <rect x="16" y="7" width="3" height="8" fill="#fbbf24" />
          <rect x="5" y="12" width="14" height="4" fill="#f59e0b" />
          <rect x="11" y="13" width="2" height="2" fill="#ef4444" />
        </svg>
      );
    case 'kings':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="10" y="2" width="4" height="3" fill="#0b0a09" />
          <rect x="2" y="6" width="20" height="14" fill="#0b0a09" />
          <rect x="11" y="3" width="2" height="2" fill="#fff3bf" />
          <rect x="3" y="7" width="3" height="10" fill="#ffd166" />
          <rect x="10" y="5" width="4" height="12" fill="#ffd166" />
          <rect x="18" y="7" width="3" height="10" fill="#ffd166" />
          <rect x="6" y="11" width="4" height="6" fill="#f59e0b" />
          <rect x="14" y="11" width="4" height="6" fill="#f59e0b" />
          <rect x="3" y="15" width="18" height="4" fill="#d97706" />
          <rect x="5" y="16" width="3" height="2" fill="#38bdf8" />
          <rect x="10" y="15" width="4" height="3" fill="#ef4444" />
          <rect x="16" y="16" width="3" height="2" fill="#10b981" />
        </svg>
      );
    case 'territories':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Beast Paw Print + Territory Strip */}
          <rect x="4" y="6" width="4" height="5" fill="#0b0a09" />
          <rect x="8" y="3" width="4" height="5" fill="#0b0a09" />
          <rect x="12" y="3" width="4" height="5" fill="#0b0a09" />
          <rect x="16" y="7" width="4" height="5" fill="#0b0a09" />
          <rect x="6" y="10" width="12" height="8" fill="#0b0a09" />
          <rect x="3" y="19" width="18" height="4" fill="#0b0a09" />
          <rect x="5" y="7" width="2" height="3" fill="#fb923c" />
          <rect x="9" y="4" width="2" height="3" fill="#fdba74" />
          <rect x="13" y="4" width="2" height="3" fill="#fdba74" />
          <rect x="17" y="8" width="2" height="3" fill="#fb923c" />
          <rect x="7" y="11" width="10" height="6" fill="#ea580c" />
          <rect x="9" y="12" width="6" height="3" fill="#fed7aa" />
          <rect x="4" y="20" width="16" height="2" fill="#2dd4bf" />
        </svg>
      );
    case 'biomes':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="7" y="2" width="10" height="5" fill="#0b0a09" />
          <rect x="4" y="6" width="16" height="8" fill="#0b0a09" />
          <rect x="9" y="14" width="6" height="4" fill="#0b0a09" />
          <rect x="2" y="17" width="20" height="5" fill="#0b0a09" />
          <rect x="8" y="3" width="8" height="4" fill="#4ade80" />
          <rect x="5" y="7" width="14" height="5" fill="#22c55e" />
          <rect x="7" y="11" width="10" height="2" fill="#16a34a" />
          <rect x="10" y="13" width="4" height="4" fill="#854d0e" />
          <rect x="3" y="18" width="18" height="3" fill="#0284c7" />
          <rect x="5" y="18" width="5" height="1" fill="#7dd3fc" />
          <rect x="13" y="19" width="6" height="1" fill="#7dd3fc" />
        </svg>
      );
    case 'alliances':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Twin Shields */}
          <rect x="2" y="4" width="9" height="14" fill="#0b0a09" />
          <rect x="13" y="4" width="9" height="14" fill="#0b0a09" />
          <rect x="3" y="5" width="7" height="8" fill="#2563eb" />
          <rect x="4" y="6" width="5" height="4" fill="#60a5fa" />
          <rect x="5" y="13" width="3" height="4" fill="#1d4ed8" />
          <rect x="14" y="5" width="7" height="8" fill="#dc2626" />
          <rect x="15" y="6" width="5" height="4" fill="#f87171" />
          <rect x="16" y="13" width="3" height="4" fill="#b91c1c" />
          {/* Treaty Gold Link */}
          <rect x="10" y="9" width="4" height="4" fill="#fde047" />
          <rect x="8" y="19" width="8" height="2" fill="#e5e7eb" />
        </svg>
      );
    case 'temperature':
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="8" y="2" width="8" height="12" fill="#0b0a09" />
          <rect x="6" y="13" width="12" height="9" fill="#0b0a09" />
          <rect x="9" y="3" width="6" height="11" fill="#334155" />
          <rect x="11" y="4" width="2" height="3" fill="#38bdf8" />
          <rect x="11" y="7" width="2" height="3" fill="#4ade80" />
          <rect x="11" y="10" width="2" height="4" fill="#fb923c" />
          <rect x="7" y="14" width="10" height="7" fill="#ef4444" />
          <rect x="9" y="15" width="3" height="3" fill="#fca5a5" />
          <rect x="17" y="5" width="3" height="1" fill="#94a3b8" />
          <rect x="17" y="8" width="3" height="1" fill="#94a3b8" />
          <rect x="17" y="11" width="3" height="1" fill="#94a3b8" />
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
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Golden Halo + Heart */}
          <rect x="7" y="2" width="10" height="4" fill="#0b0a09" />
          <rect x="8" y="3" width="8" height="2" fill="#ffd166" />
          <rect x="9" y="3" width="6" height="1" fill="#fff3bf" />
          <rect x="4" y="7" width="7" height="3" fill="#0b0a09" />
          <rect x="13" y="7" width="7" height="3" fill="#0b0a09" />
          <rect x="3" y="9" width="18" height="6" fill="#0b0a09" />
          <rect x="5" y="15" width="14" height="3" fill="#0b0a09" />
          <rect x="8" y="18" width="8" height="2" fill="#0b0a09" />
          <rect x="10" y="20" width="4" height="2" fill="#0b0a09" />
          <rect x="5" y="8" width="5" height="2" fill="#ff758f" />
          <rect x="14" y="8" width="5" height="2" fill="#ff758f" />
          <rect x="4" y="10" width="16" height="4" fill="#e63946" />
          <rect x="6" y="14" width="12" height="3" fill="#e63946" />
          <rect x="9" y="17" width="6" height="2" fill="#c1121f" />
          <rect x="11" y="19" width="2" height="2" fill="#9b0e18" />
          <rect x="6" y="10" width="3" height="2" fill="#ffb3c1" />
        </svg>
      );
    case 'rain_of_plenty':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Raincloud + Droplets */}
          <rect x="6" y="3" width="11" height="3" fill="#0b0a09" />
          <rect x="3" y="6" width="18" height="7" fill="#0b0a09" />
          <rect x="7" y="4" width="9" height="3" fill="#f1f5f9" />
          <rect x="4" y="7" width="16" height="5" fill="#cbd5e1" />
          <rect x="5" y="10" width="14" height="2" fill="#94a3b8" />
          <rect x="5" y="14" width="3" height="5" fill="#0b0a09" />
          <rect x="11" y="15" width="3" height="6" fill="#0b0a09" />
          <rect x="16" y="14" width="3" height="5" fill="#0b0a09" />
          <rect x="6" y="14" width="2" height="4" fill="#4ea8de" />
          <rect x="12" y="15" width="2" height="5" fill="#56cfe1" />
          <rect x="17" y="14" width="2" height="4" fill="#90e0ef" />
        </svg>
      );
    case 'eureka':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Radiant Lightbulb */}
          <rect x="11" y="1" width="2" height="2" fill="#ffd166" />
          <rect x="4" y="4" width="2" height="2" fill="#ffd166" />
          <rect x="18" y="4" width="2" height="2" fill="#ffd166" />
          <rect x="7" y="4" width="10" height="3" fill="#0b0a09" />
          <rect x="5" y="7" width="14" height="7" fill="#0b0a09" />
          <rect x="8" y="14" width="8" height="7" fill="#0b0a09" />
          <rect x="8" y="5" width="8" height="2" fill="#fff3bf" />
          <rect x="6" y="7" width="12" height="6" fill="#ffd166" />
          <rect x="9" y="8" width="6" height="4" fill="#ffffff" />
          <rect x="9" y="14" width="6" height="2" fill="#f5b742" />
          <rect x="9" y="16" width="6" height="4" fill="#94a3b8" />
          <rect x="10" y="20" width="4" height="1" fill="#64748b" />
        </svg>
      );
    case 'golden_age':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="3" y="6" width="18" height="13" fill="#0b0a09" />
          <rect x="10" y="3" width="4" height="4" fill="#0b0a09" />
          <rect x="4" y="7" width="3" height="7" fill="#ffd166" />
          <rect x="10" y="4" width="4" height="10" fill="#fff3bf" />
          <rect x="17" y="7" width="3" height="7" fill="#ffd166" />
          <rect x="4" y="11" width="16" height="5" fill="#f5b742" />
          <rect x="4" y="16" width="16" height="2" fill="#b87c18" />
          <rect x="11" y="12" width="2" height="3" fill="#e63946" />
          <rect x="6" y="13" width="2" height="2" fill="#56cfe1" />
          <rect x="16" y="13" width="2" height="2" fill="#80ed99" />
        </svg>
      );
    case 'divine_shield':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="3" width="16" height="10" fill="#0b0a09" />
          <rect x="5" y="13" width="14" height="5" fill="#0b0a09" />
          <rect x="8" y="18" width="8" height="3" fill="#0b0a09" />
          <rect x="5" y="4" width="14" height="8" fill="#48bfe3" />
          <rect x="6" y="12" width="12" height="5" fill="#3a86ff" />
          <rect x="9" y="17" width="6" height="3" fill="#274c77" />
          <rect x="7" y="6" width="10" height="7" fill="#90e0ef" />
          <rect x="11" y="6" width="2" height="9" fill="#ffd166" />
          <rect x="8" y="9" width="8" height="2" fill="#ffd166" />
        </svg>
      );
    case 'bloodlust_frenzy':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Crossed Battle Blades */}
          <rect x="3" y="3" width="6" height="6" fill="#0b0a09" />
          <rect x="15" y="3" width="6" height="6" fill="#0b0a09" />
          <rect x="7" y="7" width="10" height="10" fill="#0b0a09" />
          <rect x="3" y="15" width="6" height="6" fill="#0b0a09" />
          <rect x="15" y="15" width="6" height="6" fill="#0b0a09" />
          <rect x="4" y="4" width="4" height="4" fill="#f1f5f9" />
          <rect x="16" y="4" width="4" height="4" fill="#f1f5f9" />
          <rect x="7" y="7" width="3" height="3" fill="#cbd5e1" />
          <rect x="14" y="7" width="3" height="3" fill="#cbd5e1" />
          <rect x="9" y="9" width="6" height="6" fill="#e63946" />
          <rect x="11" y="11" width="2" height="2" fill="#ffd166" />
          <rect x="4" y="16" width="4" height="4" fill="#f5b742" />
          <rect x="16" y="16" width="4" height="4" fill="#f5b742" />
        </svg>
      );
    case 'curse':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Arcane Skull */}
          <rect x="6" y="3" width="12" height="12" fill="#0b0a09" />
          <rect x="7" y="15" width="10" height="6" fill="#0b0a09" />
          <rect x="7" y="4" width="10" height="10" fill="#9d4edd" />
          <rect x="9" y="5" width="6" height="3" fill="#c77dff" />
          <rect x="8" y="14" width="8" height="6" fill="#7b2cbf" />
          <rect x="8" y="9" width="3" height="3" fill="#0b0a09" />
          <rect x="13" y="9" width="3" height="3" fill="#0b0a09" />
          <rect x="9" y="10" width="1" height="1" fill="#ff4d6d" />
          <rect x="14" y="10" width="1" height="1" fill="#ff4d6d" />
          <rect x="9" y="17" width="2" height="3" fill="#e0aaff" />
          <rect x="13" y="17" width="2" height="3" fill="#e0aaff" />
        </svg>
      );
    case 'plague_miasma':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Toxic Miasma Cloud */}
          <rect x="6" y="4" width="11" height="4" fill="#0b0a09" />
          <rect x="3" y="8" width="18" height="9" fill="#0b0a09" />
          <rect x="7" y="17" width="10" height="3" fill="#0b0a09" />
          <rect x="7" y="5" width="9" height="4" fill="#80ed99" />
          <rect x="4" y="9" width="16" height="7" fill="#57cc99" />
          <rect x="8" y="16" width="8" height="3" fill="#38a3a5" />
          <rect x="7" y="10" width="3" height="3" fill="#0b0a09" />
          <rect x="14" y="10" width="3" height="3" fill="#0b0a09" />
          <rect x="4" y="4" width="2" height="2" fill="#80ed99" />
          <rect x="18" y="5" width="2" height="2" fill="#80ed99" />
        </svg>
      );
    case 'lightning_smite':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="11" y="2" width="7" height="4" fill="#0b0a09" />
          <rect x="8" y="6" width="8" height="4" fill="#0b0a09" />
          <rect x="5" y="10" width="14" height="4" fill="#0b0a09" />
          <rect x="9" y="14" width="8" height="4" fill="#0b0a09" />
          <rect x="7" y="18" width="6" height="4" fill="#0b0a09" />
          <rect x="12" y="3" width="5" height="3" fill="#caf0f8" />
          <rect x="9" y="7" width="6" height="3" fill="#90e0ef" />
          <rect x="6" y="11" width="12" height="2" fill="#ffffff" />
          <rect x="10" y="14" width="6" height="3" fill="#48bfe3" />
          <rect x="8" y="18" width="4" height="3" fill="#0096c7" />
        </svg>
      );
    case 'meteor_strike':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="13" y="2" width="9" height="7" fill="#0b0a09" />
          <rect x="9" y="6" width="10" height="8" fill="#0b0a09" />
          <rect x="3" y="10" width="12" height="11" fill="#0b0a09" />
          <rect x="14" y="3" width="7" height="5" fill="#ffd166" />
          <rect x="10" y="7" width="8" height="6" fill="#f77f00" />
          <rect x="4" y="11" width="10" height="9" fill="#d62828" />
          <rect x="5" y="13" width="6" height="6" fill="#5c4742" />
          <rect x="6" y="14" width="3" height="2" fill="#8d726b" />
        </svg>
      );
    case 'earthquake':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="9" width="20" height="12" fill="#0b0a09" />
          <rect x="3" y="10" width="8" height="3" fill="#6a994e" />
          <rect x="13" y="9" width="8" height="3" fill="#6a994e" />
          <rect x="3" y="13" width="18" height="7" fill="#8d5b3c" />
          <rect x="10" y="10" width="4" height="10" fill="#181512" />
          <rect x="11" y="7" width="2" height="5" fill="#ff7b00" />
          <rect x="10" y="12" width="3" height="4" fill="#ff5400" />
          <rect x="6" y="4" width="3" height="3" fill="#ffd166" />
          <rect x="15" y="3" width="3" height="3" fill="#ffd166" />
        </svg>
      );
    case 'terraform_beam':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="8" y="2" width="8" height="12" fill="#0b0a09" />
          <rect x="9" y="2" width="6" height="11" fill="#06d6a0" />
          <rect x="11" y="2" width="2" height="11" fill="#e0fbfc" />
          <rect x="2" y="14" width="20" height="8" fill="#0b0a09" />
          <rect x="3" y="15" width="18" height="3" fill="#80ed99" />
          <rect x="3" y="18" width="18" height="3" fill="#7c5234" />
        </svg>
      );
    case 'drag_entity':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Telekinetic Gauntlet */}
          <rect x="7" y="2" width="10" height="19" fill="#0b0a09" />
          <rect x="4" y="6" width="16" height="12" fill="#0b0a09" />
          <rect x="9" y="3" width="6" height="3" fill="#e0fbfc" />
          <rect x="6" y="6" width="12" height="4" fill="#56cfe1" />
          <rect x="5" y="10" width="4" height="8" fill="#38bdf8" />
          <rect x="15" y="10" width="4" height="8" fill="#38bdf8" />
          <rect x="10" y="11" width="4" height="6" fill="#ffd166" />
          <rect x="6" y="18" width="4" height="2" fill="#ffd166" />
          <rect x="14" y="18" width="4" height="2" fill="#ffd166" />
        </svg>
      );
    case 'heat_wave':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="7" y="2" width="10" height="9" fill="#0b0a09" />
          <rect x="5" y="4" width="14" height="6" fill="#0b0a09" />
          <rect x="8" y="3" width="8" height="6" fill="#fde047" />
          <rect x="6" y="5" width="12" height="4" fill="#fb923c" />
          <rect x="9" y="4" width="6" height="4" fill="#fff3bf" />
          <rect x="3" y="13" width="18" height="8" fill="#0b0a09" />
          <rect x="4" y="14" width="4" height="3" fill="#ff7b00" />
          <rect x="10" y="15" width="4" height="3" fill="#ff5400" />
          <rect x="16" y="14" width="4" height="3" fill="#ff7b00" />
          <rect x="4" y="18" width="16" height="2" fill="#e63946" />
        </svg>
      );
    case 'freeze_snap':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="10" y="2" width="4" height="20" fill="#0b0a09" />
          <rect x="2" y="10" width="20" height="4" fill="#0b0a09" />
          <rect x="5" y="5" width="14" height="14" fill="#0b0a09" />
          <rect x="11" y="3" width="2" height="18" fill="#7dd3fc" />
          <rect x="3" y="11" width="18" height="2" fill="#7dd3fc" />
          <rect x="6" y="6" width="3" height="3" fill="#bae6fd" />
          <rect x="15" y="6" width="3" height="3" fill="#bae6fd" />
          <rect x="6" y="15" width="3" height="3" fill="#bae6fd" />
          <rect x="15" y="15" width="3" height="3" fill="#bae6fd" />
          <rect x="9" y="9" width="6" height="6" fill="#ffffff" />
        </svg>
      );
    case 'tornado':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="3" width="20" height="4" fill="#0b0a09" />
          <rect x="4" y="7" width="16" height="4" fill="#0b0a09" />
          <rect x="6" y="11" width="12" height="4" fill="#0b0a09" />
          <rect x="8" y="15" width="8" height="4" fill="#0b0a09" />
          <rect x="10" y="19" width="4" height="3" fill="#0b0a09" />
          <rect x="3" y="4" width="18" height="2" fill="#e2e8f0" />
          <rect x="5" y="7" width="14" height="3" fill="#94a3b8" />
          <rect x="7" y="11" width="10" height="3" fill="#cbd5e1" />
          <rect x="9" y="15" width="6" height="3" fill="#64748b" />
          <rect x="11" y="18" width="2" height="3" fill="#475569" />
        </svg>
      );
    case 'tsunami':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="6" y="3" width="13" height="5" fill="#0b0a09" />
          <rect x="3" y="7" width="15" height="8" fill="#0b0a09" />
          <rect x="1" y="14" width="22" height="8" fill="#0b0a09" />
          <rect x="7" y="4" width="10" height="3" fill="#e0fbfc" />
          <rect x="13" y="6" width="4" height="3" fill="#ffffff" />
          <rect x="4" y="8" width="12" height="6" fill="#48cae4" />
          <rect x="2" y="15" width="20" height="6" fill="#023e8a" />
          <rect x="4" y="16" width="7" height="2" fill="#90e0ef" />
          <rect x="14" y="18" width="6" height="2" fill="#0096c7" />
        </svg>
      );
    case 'wormhole_ascension':
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="4" width="16" height="16" fill="#0b0a09" />
          <rect x="2" y="8" width="20" height="8" fill="#0b0a09" />
          <rect x="8" y="2" width="8" height="20" fill="#0b0a09" />
          <rect x="5" y="5" width="14" height="14" fill="#7b2cbf" />
          <rect x="7" y="7" width="10" height="10" fill="#c77dff" />
          <rect x="9" y="9" width="6" height="6" fill="#141210" />
          <rect x="11" y="11" width="2" height="2" fill="#e0fbfc" />
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
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="10" y="2" width="4" height="8" fill="#0b0a09" />
          <rect x="7" y="5" width="10" height="4" fill="#0b0a09" />
          <rect x="11" y="3" width="2" height="7" fill="#80ed99" />
          <rect x="8" y="6" width="8" height="2" fill="#80ed99" />
          <rect x="3" y="13" width="18" height="9" fill="#0b0a09" />
          <rect x="4" y="14" width="16" height="3" fill="#6a994e" />
          <rect x="4" y="17" width="16" height="4" fill="#8d5b3c" />
        </svg>
      );
    case 'lower':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="10" y="3" width="4" height="8" fill="#0b0a09" />
          <rect x="7" y="8" width="10" height="4" fill="#0b0a09" />
          <rect x="11" y="4" width="2" height="6" fill="#f4a261" />
          <rect x="8" y="9" width="8" height="2" fill="#f4a261" />
          <rect x="2" y="14" width="20" height="8" fill="#0b0a09" />
          <rect x="3" y="15" width="18" height="3" fill="#a88b6d" />
          <rect x="6" y="18" width="12" height="3" fill="#6e5a47" />
        </svg>
      );
    case 'flatten':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="3" y="6" width="18" height="5" fill="#0b0a09" />
          <rect x="4" y="7" width="16" height="3" fill="#ffd166" />
          <rect x="10" y="7" width="4" height="3" fill="#fff3bf" />
          <rect x="2" y="12" width="20" height="9" fill="#0b0a09" />
          <rect x="3" y="13" width="18" height="3" fill="#b8ada1" />
          <rect x="3" y="16" width="18" height="4" fill="#695e53" />
        </svg>
      );
    case 'stone_road':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="3" y="4" width="18" height="16" fill="#0b0a09" />
          <rect x="4" y="5" width="16" height="14" fill="#4e4841" />
          <rect x="5" y="6" width="6" height="5" fill="#c7bdb0" />
          <rect x="12" y="6" width="7" height="5" fill="#9c9287" />
          <rect x="5" y="12" width="8" height="6" fill="#9c9287" />
          <rect x="14" y="12" width="5" height="6" fill="#c7bdb0" />
        </svg>
      );
    case 'rail_track':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="5" width="20" height="14" fill="#0b0a09" />
          <rect x="3" y="6" width="18" height="12" fill="#4a453f" />
          <rect x="4" y="7" width="3" height="10" fill="#8d5b3c" />
          <rect x="10" y="7" width="3" height="10" fill="#8d5b3c" />
          <rect x="16" y="7" width="3" height="10" fill="#8d5b3c" />
          <rect x="2" y="8" width="20" height="3" fill="#cbd5e1" />
          <rect x="2" y="13" width="20" height="3" fill="#cbd5e1" />
        </svg>
      );
    case 'fertile_meadow':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="13" width="20" height="8" fill="#0b0a09" />
          <rect x="3" y="14" width="18" height="6" fill="#52b788" />
          <rect x="5" y="7" width="4" height="7" fill="#0b0a09" />
          <rect x="14" y="8" width="4" height="6" fill="#0b0a09" />
          <rect x="6" y="9" width="2" height="5" fill="#80ed99" />
          <rect x="15" y="10" width="2" height="4" fill="#80ed99" />
          <rect x="5" y="6" width="4" height="3" fill="#ffd166" />
          <rect x="14" y="7" width="4" height="3" fill="#ff595e" />
        </svg>
      );
    case 'plant_forest':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="9" y="2" width="6" height="4" fill="#0b0a09" />
          <rect x="6" y="6" width="12" height="5" fill="#0b0a09" />
          <rect x="4" y="11" width="16" height="5" fill="#0b0a09" />
          <rect x="9" y="16" width="6" height="6" fill="#0b0a09" />
          <rect x="10" y="3" width="4" height="3" fill="#80ed99" />
          <rect x="7" y="7" width="10" height="4" fill="#52b788" />
          <rect x="5" y="12" width="14" height="3" fill="#2d6a4f" />
          <rect x="10" y="16" width="4" height="5" fill="#7c4f31" />
        </svg>
      );
    case 'seed_ore':
      return <ResourceIconSvg resource="ore" className={className} />;
    case 'carve_river':
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="5" width="20" height="14" fill="#0b0a09" />
          <rect x="3" y="6" width="18" height="12" fill="#1d6fa5" />
          <rect x="5" y="8" width="6" height="3" fill="#90e0ef" />
          <rect x="12" y="13" width="7" height="3" fill="#48bfe3" />
          <rect x="4" y="14" width="4" height="2" fill="#caf0f8" />
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
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="9" y="2" width="6" height="5" fill="#0b0a09" />
          <rect x="6" y="7" width="12" height="7" fill="#0b0a09" />
          <rect x="2" y="14" width="20" height="8" fill="#0b0a09" />
          <rect x="10" y="3" width="4" height="4" fill="#ffd166" />
          <rect x="7" y="8" width="10" height="6" fill="#f77f00" />
          <rect x="10" y="9" width="4" height="5" fill="#fff3bf" />
          <rect x="4" y="15" width="16" height="3" fill="#7c4f31" />
          <rect x="3" y="18" width="18" height="3" fill="#8f8478" />
        </svg>
      );
    case 'forager_hut':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="5" y="4" width="14" height="4" fill="#0b0a09" />
          <rect x="2" y="8" width="20" height="4" fill="#0b0a09" />
          <rect x="4" y="12" width="16" height="9" fill="#0b0a09" />
          <rect x="6" y="5" width="12" height="3" fill="#a86f46" />
          <rect x="3" y="9" width="18" height="3" fill="#8d5b3c" />
          <rect x="5" y="13" width="14" height="7" fill="#d4b48c" />
          <rect x="10" y="15" width="4" height="5" fill="#59361f" />
        </svg>
      );
    case 'shaman_totem':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="8" y="2" width="8" height="19" fill="#0b0a09" />
          <rect x="5" y="6" width="14" height="4" fill="#0b0a09" />
          <rect x="9" y="3" width="6" height="15" fill="#8f8478" />
          <rect x="6" y="7" width="12" height="2" fill="#c2bab0" />
          <rect x="10" y="8" width="4" height="3" fill="#56cfe1" />
          <rect x="7" y="18" width="10" height="3" fill="#59524a" />
        </svg>
      );
    case 'granary':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="6" y="3" width="12" height="5" fill="#0b0a09" />
          <rect x="5" y="8" width="14" height="13" fill="#0b0a09" />
          <rect x="7" y="4" width="10" height="4" fill="#e09f3e" />
          <rect x="6" y="8" width="12" height="9" fill="#d4b48c" />
          <rect x="5" y="17" width="14" height="3" fill="#8f8478" />
          <rect x="10" y="14" width="4" height="6" fill="#59361f" />
        </svg>
      );
    case 'smeltery':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="13" y="2" width="6" height="8" fill="#0b0a09" />
          <rect x="3" y="9" width="18" height="12" fill="#0b0a09" />
          <rect x="14" y="3" width="4" height="7" fill="#736c64" />
          <rect x="4" y="10" width="16" height="10" fill="#8f8478" />
          <rect x="7" y="14" width="7" height="6" fill="#f77f00" />
          <rect x="9" y="15" width="3" height="5" fill="#ffd166" />
        </svg>
      );
    case 'ziggurat':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="8" y="3" width="8" height="5" fill="#0b0a09" />
          <rect x="5" y="8" width="14" height="5" fill="#0b0a09" />
          <rect x="2" y="13" width="20" height="8" fill="#0b0a09" />
          <rect x="9" y="4" width="6" height="4" fill="#f5b742" />
          <rect x="6" y="9" width="12" height="4" fill="#d4b48c" />
          <rect x="3" y="14" width="18" height="6" fill="#b89872" />
          <rect x="10" y="15" width="4" height="5" fill="#181512" />
        </svg>
      );
    case 'guildhall':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="4" width="16" height="5" fill="#0b0a09" />
          <rect x="2" y="9" width="20" height="12" fill="#0b0a09" />
          <rect x="5" y="5" width="14" height="4" fill="#c85a32" />
          <rect x="3" y="10" width="18" height="10" fill="#d4b48c" />
          <rect x="7" y="10" width="3" height="10" fill="#6b4423" />
          <rect x="14" y="10" width="3" height="10" fill="#6b4423" />
          <rect x="10" y="15" width="4" height="5" fill="#59361f" />
        </svg>
      );
    case 'observatory':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="7" y="4" width="10" height="7" fill="#0b0a09" />
          <rect x="15" y="2" width="5" height="4" fill="#0b0a09" />
          <rect x="5" y="11" width="14" height="10" fill="#0b0a09" />
          <rect x="8" y="5" width="8" height="6" fill="#4ea8de" />
          <rect x="16" y="3" width="3" height="2" fill="#ffd166" />
          <rect x="6" y="11" width="12" height="9" fill="#b8ada1" />
          <rect x="10" y="14" width="4" height="6" fill="#274c77" />
        </svg>
      );
    case 'steam_foundry':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="5" y="2" width="5" height="8" fill="#0b0a09" />
          <rect x="13" y="4" width="5" height="6" fill="#0b0a09" />
          <rect x="2" y="10" width="20" height="11" fill="#0b0a09" />
          <rect x="6" y="3" width="3" height="7" fill="#94a3b8" />
          <rect x="14" y="5" width="3" height="5" fill="#94a3b8" />
          <rect x="3" y="11" width="18" height="9" fill="#64748b" />
          <rect x="7" y="14" width="10" height="5" fill="#f77f00" />
          <rect x="9" y="15" width="6" height="3" fill="#ffd166" />
        </svg>
      );
    case 'dynamo_plant':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="9" y="2" width="6" height="7" fill="#0b0a09" />
          <rect x="3" y="9" width="18" height="12" fill="#0b0a09" />
          <rect x="10" y="3" width="4" height="6" fill="#ffd166" />
          <rect x="7" y="6" width="10" height="3" fill="#f5b742" />
          <rect x="4" y="10" width="16" height="10" fill="#536267" />
          <rect x="7" y="14" width="10" height="4" fill="#56cfe1" />
        </svg>
      );
    case 'fission_reactor':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="5" y="3" width="14" height="6" fill="#0b0a09" />
          <rect x="3" y="9" width="18" height="12" fill="#0b0a09" />
          <rect x="6" y="4" width="12" height="5" fill="#94a3b8" />
          <rect x="4" y="9" width="16" height="11" fill="#64748b" />
          <rect x="9" y="11" width="6" height="6" fill="#80ed99" />
          <rect x="10" y="12" width="4" height="4" fill="#d8f3dc" />
        </svg>
      );
    case 'cyber_institute':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="10" y="2" width="4" height="7" fill="#0b0a09" />
          <rect x="5" y="9" width="14" height="12" fill="#0b0a09" />
          <rect x="11" y="3" width="2" height="7" fill="#56cfe1" />
          <rect x="6" y="10" width="12" height="10" fill="#334155" />
          <rect x="8" y="12" width="8" height="4" fill="#90e0ef" />
        </svg>
      );
    case 'rail_station':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="2" y="5" width="20" height="15" fill="#0b0a09" />
          <rect x="3" y="6" width="18" height="4" fill="#b54d38" />
          <rect x="4" y="10" width="16" height="5" fill="#cbd5e1" />
          <rect x="7" y="11" width="10" height="3" fill="#56cfe1" />
          <rect x="3" y="15" width="18" height="3" fill="#64748b" />
          <rect x="4" y="18" width="16" height="1" fill="#ffd166" />
        </svg>
      );
    case 'airport':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="15" y="2" width="7" height="13" fill="#0b0a09" />
          <rect x="2" y="14" width="20" height="7" fill="#0b0a09" />
          <rect x="4" y="9" width="10" height="6" fill="#0b0a09" />
          <rect x="3" y="15" width="18" height="5" fill="#334155" />
          <rect x="4" y="17" width="4" height="1" fill="#f8fafc" />
          <rect x="11" y="17" width="4" height="1" fill="#f8fafc" />
          <rect x="17" y="5" width="3" height="10" fill="#94a3b8" />
          <rect x="16" y="3" width="5" height="3" fill="#56cfe1" />
          <rect x="5" y="10" width="8" height="5" fill="#e2e8f0" />
        </svg>
      );
    case 'launch_arcology':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="9" y="1" width="6" height="14" fill="#0b0a09" />
          <rect x="5" y="14" width="14" height="7" fill="#0b0a09" />
          <rect x="11" y="2" width="2" height="12" fill="#f8fafc" />
          <rect x="9" y="6" width="6" height="8" fill="#cbd5e1" />
          <rect x="6" y="15" width="12" height="5" fill="#475569" />
          <rect x="10" y="15" width="4" height="5" fill="#f77f00" />
          <rect x="11" y="17" width="2" height="3" fill="#ffd166" />
        </svg>
      );
    case 'dyson_spire':
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="10" y="1" width="4" height="22" fill="#0b0a09" />
          <rect x="5" y="6" width="14" height="4" fill="#0b0a09" />
          <rect x="5" y="14" width="14" height="4" fill="#0b0a09" />
          <rect x="11" y="2" width="2" height="20" fill="#ffd166" />
          <rect x="6" y="7" width="12" height="2" fill="#56cfe1" />
          <rect x="6" y="15" width="12" height="2" fill="#56cfe1" />
          <rect x="9" y="10" width="6" height="4" fill="#fff3bf" />
          <rect x="11" y="11" width="2" height="2" fill="#ffffff" />
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
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="7" y="2" width="10" height="7" fill="#0b0a09" />
        <rect x="4" y="6" width="16" height="3" fill="#0b0a09" />
        <rect x="6" y="9" width="12" height="7" fill="#0b0a09" />
        <rect x="7" y="16" width="10" height="6" fill="#0b0a09" />
        <rect x="8" y="3" width="8" height="2" fill="#f5b742" />
        <rect x="7" y="5" width="10" height="1" fill="#ffd166" />
        <rect x="5" y="6" width="4" height="2" fill="#f7dec8" />
        <rect x="15" y="6" width="4" height="2" fill="#f7dec8" />
        <rect x="9" y="6" width="6" height="3" fill="#f7dec8" />
        <rect x="7" y="9" width="10" height="7" fill="#388e5a" />
        <rect x="11" y="9" width="2" height="7" fill="#80ed99" />
        <rect x="18" y="3" width="2" height="14" fill="#d97736" />
        <rect x="20" y="6" width="1" height="8" fill="#ffd166" />
        <rect x="8" y="16" width="3" height="5" fill="#4a3b2c" />
        <rect x="13" y="16" width="3" height="5" fill="#4a3b2c" />
      </svg>
    );
  }

  if (role === 'orc') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="5" y="2" width="14" height="15" fill="#0b0a09" />
        <rect x="7" y="17" width="10" height="5" fill="#0b0a09" />
        <rect x="7" y="3" width="10" height="3" fill="#464038" />
        <rect x="6" y="6" width="12" height="4" fill="#6a994e" />
        <rect x="7" y="9" width="2" height="3" fill="#f2ece1" />
        <rect x="15" y="9" width="2" height="3" fill="#f2ece1" />
        <rect x="6" y="11" width="12" height="5" fill="#9b2226" />
        <rect x="18" y="4" width="3" height="12" fill="#94a3b8" />
        <rect x="19" y="4" width="3" height="5" fill="#e5e7eb" />
        <rect x="8" y="17" width="3" height="4" fill="#3d2b1f" />
        <rect x="13" y="17" width="3" height="4" fill="#3d2b1f" />
      </svg>
    );
  }

  if (role === 'cow') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="4" y="4" width="16" height="13" fill="#0b0a09" />
        <rect x="6" y="17" width="12" height="5" fill="#0b0a09" />
        <rect x="4" y="5" width="3" height="2" fill="#e8dec8" />
        <rect x="17" y="5" width="3" height="2" fill="#e8dec8" />
        <rect x="6" y="6" width="12" height="7" fill="#f8fafc" />
        <rect x="6" y="7" width="4" height="4" fill="#1e2026" />
        <rect x="14" y="6" width="4" height="3" fill="#1e2026" />
        <rect x="8" y="9" width="1" height="2" fill="#16161a" />
        <rect x="15" y="9" width="1" height="2" fill="#16161a" />
        <rect x="7" y="12" width="10" height="4" fill="#f4b6c2" />
        <rect x="7" y="17" width="3" height="4" fill="#f8fafc" />
        <rect x="14" y="17" width="3" height="4" fill="#f8fafc" />
      </svg>
    );
  }

  if (role === 'pig') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="5" y="5" width="14" height="12" fill="#0b0a09" />
        <rect x="7" y="17" width="10" height="5" fill="#0b0a09" />
        <rect x="5" y="6" width="2" height="3" fill="#e88d9a" />
        <rect x="17" y="6" width="2" height="3" fill="#e88d9a" />
        <rect x="6" y="7" width="12" height="9" fill="#f4a5ae" />
        <rect x="8" y="10" width="2" height="2" fill="#16161a" />
        <rect x="14" y="10" width="2" height="2" fill="#16161a" />
        <rect x="9" y="12" width="6" height="4" fill="#f9bec7" />
        <rect x="10" y="13" width="1" height="2" fill="#b56576" />
        <rect x="13" y="13" width="1" height="2" fill="#b56576" />
        <rect x="8" y="17" width="3" height="4" fill="#f4a5ae" />
        <rect x="13" y="17" width="3" height="4" fill="#f4a5ae" />
      </svg>
    );
  }

  if (role === 'chicken') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="10" y="2" width="5" height="4" fill="#0b0a09" />
        <rect x="6" y="6" width="12" height="12" fill="#0b0a09" />
        <rect x="11" y="3" width="3" height="3" fill="#d62828" />
        <rect x="7" y="6" width="8" height="6" fill="#f8fafc" />
        <rect x="15" y="8" width="4" height="3" fill="#f59e0b" />
        <rect x="12" y="8" width="2" height="2" fill="#16161a" />
        <rect x="5" y="12" width="11" height="5" fill="#e2e8f0" />
        <rect x="9" y="18" width="2" height="3" fill="#f59e0b" />
        <rect x="13" y="18" width="2" height="3" fill="#f59e0b" />
      </svg>
    );
  }

  if (role === 'capybara') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="4" y="6" width="17" height="12" fill="#0b0a09" />
        <rect x="6" y="18" width="12" height="4" fill="#0b0a09" />
        <rect x="13" y="5" width="3" height="2" fill="#5c3d2e" />
        <rect x="10" y="6" width="10" height="7" fill="#9c6644" />
        <rect x="17" y="9" width="3" height="4" fill="#5c3d2e" />
        <rect x="14" y="8" width="2" height="1" fill="#16161a" />
        <rect x="5" y="10" width="12" height="7" fill="#8b5a3c" />
        <rect x="7" y="18" width="3" height="3" fill="#5c3d2e" />
        <rect x="14" y="18" width="3" height="3" fill="#5c3d2e" />
      </svg>
    );
  }

  if (role === 'wolf') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="5" y="4" width="14" height="12" fill="#0b0a09" />
        <rect x="6" y="16" width="12" height="6" fill="#0b0a09" />
        <rect x="6" y="5" width="3" height="4" fill="#7b848f" />
        <rect x="15" y="5" width="3" height="4" fill="#7b848f" />
        <rect x="6" y="8" width="12" height="7" fill="#7b848f" />
        <rect x="8" y="10" width="2" height="2" fill="#fbbf24" />
        <rect x="14" y="10" width="2" height="2" fill="#fbbf24" />
        <rect x="9" y="12" width="6" height="4" fill="#cbd5e1" />
        <rect x="11" y="14" width="2" height="2" fill="#1e2026" />
        <rect x="7" y="16" width="3" height="5" fill="#7b848f" />
        <rect x="14" y="16" width="3" height="5" fill="#7b848f" />
      </svg>
    );
  }

  if (role === 'bear') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="4" y="4" width="16" height="17" fill="#0b0a09" />
        <rect x="5" y="5" width="3" height="3" fill="#6f4528" />
        <rect x="16" y="5" width="3" height="3" fill="#6f4528" />
        <rect x="6" y="6" width="12" height="9" fill="#6f4528" />
        <rect x="8" y="9" width="2" height="2" fill="#16161a" />
        <rect x="14" y="9" width="2" height="2" fill="#16161a" />
        <rect x="9" y="11" width="6" height="4" fill="#b08968" />
        <rect x="11" y="12" width="2" height="2" fill="#1e2026" />
        <rect x="5" y="15" width="14" height="5" fill="#5c381f" />
      </svg>
    );
  }

  if (role === 'dinosaur') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="9" y="3" width="11" height="7" fill="#0b0a09" />
        <rect x="6" y="9" width="11" height="8" fill="#0b0a09" />
        <rect x="2" y="13" width="6" height="4" fill="#0b0a09" />
        <rect x="8" y="17" width="9" height="5" fill="#0b0a09" />
        <rect x="10" y="4" width="9" height="5" fill="#3b7a48" />
        <rect x="14" y="5" width="2" height="2" fill="#fbbf24" />
        <rect x="14" y="9" width="5" height="2" fill="#f4ecd8" />
        <rect x="7" y="9" width="8" height="7" fill="#3b7a48" />
        <rect x="9" y="11" width="4" height="4" fill="#c2b280" />
        <rect x="3" y="14" width="4" height="2" fill="#3b7a48" />
        <rect x="9" y="17" width="3" height="4" fill="#2d6a4f" />
        <rect x="13" y="17" width="3" height="4" fill="#2d6a4f" />
      </svg>
    );
  }

  if (role === 'dragon') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="2" y="4" width="7" height="7" fill="#0b0a09" />
        <rect x="15" y="4" width="7" height="7" fill="#0b0a09" />
        <rect x="8" y="3" width="8" height="17" fill="#0b0a09" />
        <rect x="3" y="5" width="5" height="5" fill="#7f1d1d" />
        <rect x="16" y="5" width="5" height="5" fill="#7f1d1d" />
        <rect x="9" y="3" width="2" height="3" fill="#f1e6d2" />
        <rect x="13" y="3" width="2" height="3" fill="#f1e6d2" />
        <rect x="9" y="6" width="6" height="5" fill="#b91c1c" />
        <rect x="10" y="8" width="4" height="2" fill="#ff6b35" />
        <rect x="8" y="11" width="8" height="6" fill="#b91c1c" />
        <rect x="10" y="11" width="4" height="6" fill="#f59e0b" />
        <rect x="8" y="17" width="3" height="4" fill="#991b1b" />
        <rect x="13" y="17" width="3" height="4" fill="#991b1b" />
      </svg>
    );
  }

  if (role === 'unicorn') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="13" y="2" width="3" height="4" fill="#0b0a09" />
        <rect x="6" y="6" width="14" height="11" fill="#0b0a09" />
        <rect x="5" y="17" width="13" height="5" fill="#0b0a09" />
        <rect x="14" y="2" width="2" height="4" fill="#ffd166" />
        <rect x="9" y="6" width="3" height="5" fill="#f472b6" />
        <rect x="7" y="8" width="3" height="4" fill="#72efdd" />
        <rect x="12" y="6" width="7" height="5" fill="#fafafa" />
        <rect x="15" y="7" width="2" height="2" fill="#38bdf8" />
        <rect x="6" y="11" width="11" height="6" fill="#fafafa" />
        <rect x="3" y="13" width="3" height="4" fill="#c084fc" />
        <rect x="6" y="17" width="3" height="4" fill="#f5b742" />
        <rect x="13" y="17" width="3" height="4" fill="#f5b742" />
      </svg>
    );
  }

  if (role === 'leviathan') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="3" y="4" width="18" height="15" fill="#0b0a09" />
        <rect x="4" y="5" width="16" height="5" fill="#133c55" />
        <rect x="6" y="6" width="3" height="3" fill="#72efdd" />
        <rect x="15" y="6" width="3" height="3" fill="#72efdd" />
        <rect x="4" y="10" width="16" height="4" fill="#3b0d1e" />
        <rect x="6" y="10" width="2" height="3" fill="#f8fafc" />
        <rect x="10" y="10" width="2" height="3" fill="#f8fafc" />
        <rect x="14" y="10" width="2" height="3" fill="#f8fafc" />
        <rect x="17" y="10" width="2" height="3" fill="#f8fafc" />
        <rect x="3" y="14" width="18" height="4" fill="#5fa8d3" />
        <rect x="2" y="19" width="20" height="2" fill="#e0fbfc" />
      </svg>
    );
  }

  if (role === 'human' || role === 'villager') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
        <rect x="7" y="2" width="10" height="8" fill="#0b0a09" />
        <rect x="5" y="9" width="14" height="8" fill="#0b0a09" />
        <rect x="7" y="17" width="10" height="5" fill="#0b0a09" />
        <rect x="8" y="3" width="8" height="3" fill="#7c4f31" />
        <rect x="8" y="6" width="8" height="3" fill="#f2cba5" />
        <rect x="7" y="9" width="10" height="7" fill="#4ea8de" />
        <rect x="11" y="9" width="2" height="3" fill="#ffd166" />
        <rect x="5" y="10" width="2" height="5" fill="#f2cba5" />
        <rect x="17" y="10" width="2" height="5" fill="#f2cba5" />
        <rect x="8" y="17" width="3" height="4" fill="#463a31" />
        <rect x="13" y="17" width="3" height="4" fill="#463a31" />
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
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
      <rect x="7" y="2" width="10" height="8" fill="#0b0a09" />
      <rect x="5" y="9" width="14" height="8" fill="#0b0a09" />
      <rect x="7" y="17" width="10" height="5" fill="#0b0a09" />
      <rect x="8" y="3" width="8" height="3" fill={p.hat} />
      <rect x="8" y="6" width="8" height="3" fill={p.skin} />
      <rect x="7" y="9" width="10" height="7" fill={p.shirt} />
      <rect x="5" y="10" width="2" height="5" fill={p.skin} />
      <rect x="17" y="10" width="2" height="5" fill={p.skin} />
      {p.item && <rect x="18" y="6" width="3" height="6" fill={p.item} />}
      <rect x="8" y="17" width="3" height="4" fill="#463a31" />
      <rect x="13" y="17" width="3" height="4" fill="#463a31" />
    </svg>
  );
};

export const HudPixelIcon: React.FC<{
  kind:
    | 'rotateLeft'
    | 'rotateRight'
    | 'center'
    | 'zoomIn'
    | 'zoomOut'
    | 'pan'
    | 'log'
    | 'audioOn'
    | 'audioOff'
    | 'pause'
    | 'play'
    | 'reset'
    | 'save'
    | 'camera'
    | 'speed'
    | 'chevronDown'
    | 'chevronUp'
    | 'sliders'
    | 'settings';
  className?: string;
}> = ({ kind, className = 'w-4 h-4 pixelated-canvas' }) => {
  switch (kind) {
    case 'rotateLeft':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="8" y="2" width="4" height="3" fill="#0b0a09" />
          <rect x="5" y="5" width="14" height="14" fill="#0b0a09" />
          <rect x="8" y="6" width="8" height="12" fill="none" />
          <rect x="8" y="5" width="9" height="3" fill="currentColor" />
          <rect x="5" y="8" width="3" height="8" fill="currentColor" />
          <rect x="8" y="16" width="9" height="3" fill="currentColor" />
          <rect x="16" y="8" width="3" height="9" fill="currentColor" />
          <rect x="9" y="3" width="3" height="2" fill="#f5b742" />
          <rect x="9" y="8" width="3" height="2" fill="#f5b742" />
          <rect x="8" y="8" width="8" height="8" fill="#1c1916" />
        </svg>
      );
    case 'rotateRight':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="12" y="2" width="4" height="3" fill="#0b0a09" />
          <rect x="5" y="5" width="14" height="14" fill="#0b0a09" />
          <rect x="7" y="5" width="9" height="3" fill="currentColor" />
          <rect x="16" y="8" width="3" height="8" fill="currentColor" />
          <rect x="7" y="16" width="9" height="3" fill="currentColor" />
          <rect x="5" y="8" width="3" height="9" fill="currentColor" />
          <rect x="12" y="3" width="3" height="2" fill="#f5b742" />
          <rect x="12" y="8" width="3" height="2" fill="#f5b742" />
          <rect x="8" y="8" width="8" height="8" fill="#1c1916" />
        </svg>
      );
    case 'zoomIn':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Magnifying glass + plus */}
          <rect x="5" y="2" width="10" height="13" fill="#0b0a09" />
          <rect x="2" y="5" width="15" height="9" fill="#0b0a09" />
          <rect x="5" y="3" width="9" height="11" fill="currentColor" />
          <rect x="3" y="5" width="13" height="7" fill="currentColor" />
          <rect x="5" y="5" width="9" height="7" fill="#1c1916" />
          <rect x="9" y="6" width="2" height="5" fill="#80ed99" />
          <rect x="7" y="8" width="6" height="2" fill="#80ed99" />
          <rect x="15" y="15" width="5" height="5" fill="#0b0a09" />
          <rect x="16" y="16" width="3" height="3" fill="#a86f46" />
        </svg>
      );
    case 'zoomOut':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="5" y="2" width="10" height="13" fill="#0b0a09" />
          <rect x="2" y="5" width="15" height="9" fill="#0b0a09" />
          <rect x="5" y="3" width="9" height="11" fill="currentColor" />
          <rect x="3" y="5" width="13" height="7" fill="currentColor" />
          <rect x="5" y="5" width="9" height="7" fill="#1c1916" />
          <rect x="7" y="8" width="6" height="2" fill="#f5b742" />
          <rect x="15" y="15" width="5" height="5" fill="#0b0a09" />
          <rect x="16" y="16" width="3" height="3" fill="#a86f46" />
        </svg>
      );
    case 'pan':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="10" y="1" width="4" height="22" fill="#0b0a09" />
          <rect x="1" y="10" width="22" height="4" fill="#0b0a09" />
          <rect x="8" y="3" width="8" height="3" fill="#0b0a09" />
          <rect x="8" y="18" width="8" height="3" fill="#0b0a09" />
          <rect x="3" y="8" width="3" height="8" fill="#0b0a09" />
          <rect x="18" y="8" width="3" height="8" fill="#0b0a09" />
          <rect x="11" y="2" width="2" height="20" fill="currentColor" />
          <rect x="2" y="11" width="20" height="2" fill="currentColor" />
          <rect x="9" y="4" width="6" height="2" fill="currentColor" />
          <rect x="9" y="18" width="6" height="2" fill="currentColor" />
          <rect x="4" y="9" width="2" height="6" fill="currentColor" />
          <rect x="18" y="9" width="2" height="6" fill="currentColor" />
          <rect x="10" y="10" width="4" height="4" fill="#f5b742" />
        </svg>
      );
    case 'center':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="10" y="2" width="4" height="5" fill="#0b0a09" />
          <rect x="10" y="17" width="4" height="5" fill="#0b0a09" />
          <rect x="2" y="10" width="5" height="4" fill="#0b0a09" />
          <rect x="17" y="10" width="5" height="4" fill="#0b0a09" />
          <rect x="8" y="8" width="8" height="8" fill="#0b0a09" />
          <rect x="11" y="3" width="2" height="4" fill="currentColor" />
          <rect x="11" y="17" width="2" height="4" fill="currentColor" />
          <rect x="3" y="11" width="4" height="2" fill="currentColor" />
          <rect x="17" y="11" width="4" height="2" fill="currentColor" />
          <rect x="9" y="9" width="6" height="6" fill="#f5b742" />
          <rect x="11" y="11" width="2" height="2" fill="#fff3bf" />
        </svg>
      );
    case 'camera':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Pixel Camera / Spyglass Viewport */}
          <rect x="7" y="3" width="10" height="3" fill="#0b0a09" />
          <rect x="2" y="6" width="20" height="14" fill="#0b0a09" />
          <rect x="8" y="4" width="8" height="2" fill="#b8ada1" />
          <rect x="3" y="7" width="18" height="12" fill="currentColor" />
          <rect x="4" y="8" width="16" height="2" fill="#f5efe6" />
          <rect x="16" y="8" width="3" height="2" fill="#ffd166" />
          <rect x="8" y="9" width="8" height="8" fill="#0b0a09" />
          <rect x="9" y="10" width="6" height="6" fill="#4ea8de" />
          <rect x="10" y="11" width="2" height="2" fill="#e0fbfc" />
        </svg>
      );
    case 'speed':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="4" width="16" height="16" fill="#0b0a09" />
          <rect x="5" y="5" width="2" height="14" fill="currentColor" />
          <rect x="7" y="7" width="2" height="10" fill="currentColor" />
          <rect x="9" y="9" width="2" height="6" fill="currentColor" />
          <rect x="12" y="5" width="2" height="14" fill="#f5b742" />
          <rect x="14" y="7" width="2" height="10" fill="#f5b742" />
          <rect x="16" y="9" width="2" height="6" fill="#ffd166" />
        </svg>
      );
    case 'log':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* Parchment Scroll with Wax Seal */}
          <rect x="4" y="2" width="16" height="20" fill="#0b0a09" />
          <rect x="5" y="3" width="14" height="3" fill="#d4b48c" />
          <rect x="5" y="6" width="14" height="12" fill="#f2ece1" />
          <rect x="5" y="18" width="14" height="3" fill="#b89872" />
          <rect x="7" y="8" width="10" height="2" fill="#464038" />
          <rect x="7" y="11" width="8" height="2" fill="#6b635a" />
          <rect x="7" y="14" width="6" height="2" fill="#6b635a" />
          <rect x="14" y="14" width="4" height="4" fill="#e63946" />
        </svg>
      );
    case 'audioOn':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="3" y="8" width="5" height="8" fill="#0b0a09" />
          <rect x="8" y="4" width="5" height="16" fill="#0b0a09" />
          <rect x="4" y="9" width="4" height="6" fill="currentColor" />
          <rect x="8" y="6" width="4" height="12" fill="currentColor" />
          <rect x="15" y="8" width="2" height="8" fill="#80ed99" />
          <rect x="18" y="5" width="2" height="14" fill="#52b788" />
        </svg>
      );
    case 'audioOff':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="3" y="8" width="5" height="8" fill="#0b0a09" />
          <rect x="8" y="4" width="5" height="16" fill="#0b0a09" />
          <rect x="4" y="9" width="4" height="6" fill="currentColor" />
          <rect x="8" y="6" width="4" height="12" fill="currentColor" />
          <rect x="14" y="8" width="2" height="2" fill="#ff595e" />
          <rect x="18" y="8" width="2" height="2" fill="#ff595e" />
          <rect x="16" y="10" width="2" height="4" fill="#e63946" />
          <rect x="14" y="14" width="2" height="2" fill="#ff595e" />
          <rect x="18" y="14" width="2" height="2" fill="#ff595e" />
        </svg>
      );
    case 'pause':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="5" y="3" width="6" height="18" fill="#0b0a09" />
          <rect x="13" y="3" width="6" height="18" fill="#0b0a09" />
          <rect x="6" y="4" width="4" height="16" fill="currentColor" />
          <rect x="14" y="4" width="4" height="16" fill="currentColor" />
        </svg>
      );
    case 'play':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="5" y="3" width="5" height="18" fill="#0b0a09" />
          <rect x="10" y="5" width="4" height="14" fill="#0b0a09" />
          <rect x="14" y="8" width="4" height="8" fill="#0b0a09" />
          <rect x="18" y="10" width="2" height="4" fill="#0b0a09" />
          <rect x="6" y="4" width="3" height="16" fill="currentColor" />
          <rect x="9" y="6" width="4" height="12" fill="currentColor" />
          <rect x="13" y="8" width="3" height="8" fill="currentColor" />
          <rect x="16" y="10" width="2" height="4" fill="currentColor" />
        </svg>
      );
    case 'save':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="3" y="3" width="18" height="18" fill="#0b0a09" />
          <rect x="4" y="4" width="15" height="16" fill="currentColor" />
          <rect x="6" y="4" width="10" height="6" fill="#181512" />
          <rect x="12" y="5" width="3" height="4" fill="#f5b742" />
          <rect x="6" y="12" width="12" height="7" fill="#e8e0d2" />
          <rect x="8" y="14" width="8" height="1" fill="#8f8478" />
          <rect x="8" y="16" width="6" height="1" fill="#8f8478" />
        </svg>
      );
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          {/* 8-tooth Forged Gear */}
          <rect x="9" y="2" width="6" height="20" fill="#0b0a09" />
          <rect x="2" y="9" width="20" height="6" fill="#0b0a09" />
          <rect x="5" y="5" width="14" height="14" fill="#0b0a09" />
          <rect x="10" y="3" width="4" height="18" fill="currentColor" />
          <rect x="3" y="10" width="18" height="4" fill="currentColor" />
          <rect x="6" y="6" width="12" height="12" fill="currentColor" />
          <rect x="9" y="9" width="6" height="6" fill="#0b0a09" />
          <rect x="10" y="10" width="4" height="4" fill="#f5b742" />
        </svg>
      );
    case 'sliders':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="3" y="6" width="18" height="2" fill="currentColor" />
          <rect x="3" y="12" width="18" height="2" fill="currentColor" />
          <rect x="3" y="18" width="18" height="2" fill="currentColor" />
          <rect x="7" y="4" width="4" height="6" fill="#f5b742" />
          <rect x="14" y="10" width="4" height="6" fill="#80ed99" />
          <rect x="9" y="16" width="4" height="6" fill="#56cfe1" />
        </svg>
      );
    case 'chevronDown':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="4" y="7" width="4" height="4" fill="currentColor" />
          <rect x="16" y="7" width="4" height="4" fill="currentColor" />
          <rect x="7" y="10" width="4" height="4" fill="currentColor" />
          <rect x="13" y="10" width="4" height="4" fill="currentColor" />
          <rect x="10" y="13" width="4" height="4" fill="currentColor" />
        </svg>
      );
    case 'chevronUp':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="10" y="7" width="4" height="4" fill="currentColor" />
          <rect x="7" y="10" width="4" height="4" fill="currentColor" />
          <rect x="13" y="10" width="4" height="4" fill="currentColor" />
          <rect x="4" y="13" width="4" height="4" fill="currentColor" />
          <rect x="16" y="13" width="4" height="4" fill="currentColor" />
        </svg>
      );
    case 'reset':
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" shapeRendering="crispEdges">
          <rect x="6" y="4" width="12" height="3" fill="currentColor" />
          <rect x="4" y="7" width="3" height="10" fill="currentColor" />
          <rect x="6" y="17" width="12" height="3" fill="currentColor" />
          <rect x="17" y="11" width="3" height="6" fill="currentColor" />
          <rect x="14" y="7" width="6" height="3" fill="#f5b742" />
        </svg>
      );
  }
};
