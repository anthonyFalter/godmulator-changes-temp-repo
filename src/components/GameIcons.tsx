import React from 'react';
import { Resources } from '../game/types';

export const TitleEmblemSvg: React.FC = () => (
  <svg
    viewBox="0 0 360 88"
    className="w-72 h-auto mb-2"
    role="img"
    aria-label="Aeon Emblem"
  >
    {/* Dark stepped architectural stone silhouette */}
    <path
      d="M28 74 L48 26 L68 26 L88 74 Z"
      fill="#181512"
      stroke="#d97736"
      strokeWidth="2.5"
    />
    {/* Stepped ziggurat interior detail */}
    <rect x="44" y="56" width="28" height="10" fill="#a69282" />
    <rect x="48" y="44" width="20" height="10" fill="#c7b08b" />
    <rect x="52" y="32" width="12" height="10" fill="#f5b742" />
    {/* Sacred flame & star */}
    <polygon points="58,10 63,22 58,28 53,22" fill="#ff922b" />
    <circle cx="58" cy="20" r="2.5" fill="#fff3bf" />

    {/* Display Typography inside Emblem */}
    <text
      x="104"
      y="54"
      fill="#ede8df"
      fontFamily="Fraunces, Georgia, serif"
      fontWeight="700"
      fontSize="38"
    >
      Aeon
    </text>
    <text
      x="106"
      y="74"
      fill="#c7b08b"
      fontFamily="Plus Jakarta Sans, sans-serif"
      fontWeight="500"
      fontSize="13.5"
    >
      Isometric God &amp; Civilization Simulator
    </text>
  </svg>
);

export const ResourceIconSvg: React.FC<{ resource: keyof Resources; className?: string }> = ({
  resource,
  className = 'w-4 h-4 shrink-0',
}) => {
  switch (resource) {
    case 'food':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M12 3 C7 6 5 11 7 17 C9 20 15 20 17 17 C19 11 17 6 12 3 Z" fill="#181512" />
          <path d="M12 5 C8 8 7 12 8.5 16 C10 18 14 18 15.5 16 C17 12 16 8 12 5 Z" fill="#6a994e" />
          <circle cx="10.5" cy="11" r="2" fill="#e63946" />
          <circle cx="14" cy="13" r="2" fill="#f4a261" />
        </svg>
      );
    case 'wood':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect x="3" y="7" width="18" height="10" fill="#181512" />
          <rect x="4" y="8" width="16" height="8" fill="#8d5b3c" />
          <rect x="4" y="8" width="16" height="3" fill="#b07d56" />
          <circle cx="18" cy="12" r="2.5" fill="#d4b89c" />
        </svg>
      );
    case 'stone':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <polygon points="4,18 7,7 16,6 20,18" fill="#181512" />
          <polygon points="5.5,17 8,8.5 15,7.5 18.5,17" fill="#8f8478" />
          <polygon points="8,8.5 15,7.5 16,12 7,12" fill="#b8ada1" />
        </svg>
      );
    case 'ore':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <polygon points="4,18 8,5 17,6 20,18" fill="#181512" />
          <polygon points="5.5,17 9,6.5 16,7.5 18.5,17" fill="#536267" />
          <rect x="9" y="9" width="4" height="4" fill="#e09f3e" />
          <rect x="13" y="12" width="3" height="3" fill="#f4a261" />
        </svg>
      );
    case 'knowledge':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" fill="#181512" />
          <rect x="6" y="6" width="12" height="12" fill="#3a506b" />
          <polygon points="12,7 16,12 12,17 8,12" fill="#56cfe1" />
        </svg>
      );
    case 'energy':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <polygon points="13,2 5,13 11,13 10,22 19,10 13,10" fill="#f5b742" stroke="#181512" strokeWidth="1.5" />
        </svg>
      );
    case 'alloy':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <polygon points="6,6 18,6 21,18 3,18" fill="#181512" />
          <polygon points="7.5,7.5 16.5,7.5 19,16.5 5,16.5" fill="#72efdd" />
          <rect x="8" y="8" width="8" height="3" fill="#e0fbfc" />
        </svg>
      );
    case 'faith':
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <polygon points="12,2 15,9 22,12 15,15 12,22 9,15 2,12 9,9" fill="#181512" />
          <polygon points="12,4 14.2,9.8 20,12 14.2,14.2 12,20 9.8,14.2 4,12 9.8,9.8" fill="#ffd166" />
          <circle cx="12" cy="12" r="2.5" fill="#ffffff" />
        </svg>
      );
  }
};
