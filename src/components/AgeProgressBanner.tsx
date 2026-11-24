import React, { useEffect, useRef, useState } from 'react';
import { EPOCHS } from '../game/catalog';
import type { EpochDefinition, EpochId } from '../game/types';

export interface AgeProgressEvent {
  id: number;
  fromIndex: number;
  toIndex: number;
}

interface AgeProgressBannerProps {
  event: AgeProgressEvent | null;
  onImpact: () => void;
  onComplete: () => void;
}

// 2:1 panoramic pixel-art diorama resolution tailored to fill each half of the circular time-wheel
const TILE_W = 80;
const TILE_H = 40;
const cachedSceneryUrls = new Map<EpochId, string>();

/**
 * Renders a richly detailed, handcrafted 80x40 panoramic pixel-art scenery + foreground age emblem
 * designed to fill a full half-circle of the rotating celestial age dial (100% procedural).
 */
export function getEpochSceneryDataUrl(epochId: EpochId): string {
  const existing = cachedSceneryUrls.get(epochId);
  if (existing) return existing;
  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  canvas.width = TILE_W;
  canvas.height = TILE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;

  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  };

  // Checkerboard pixel dithering transition between horizontal bands
  const ditherBand = (yStart: number, height: number, c1: string, c2: string) => {
    for (let y = yStart; y < yStart + height; y++) {
      for (let x = 0; x < TILE_W; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? c1 : c2;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  };

  // Crisp integer-grid filled circle
  const circle = (cx: number, cy: number, r: number, color: string) => {
    ctx.fillStyle = color;
    const r2 = r * r;
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        if (dx * dx + dy * dy <= r2) {
          ctx.fillRect(Math.round(cx + dx), Math.round(cy + dy), 1, 1);
        }
      }
    }
  };

  // --- 1. Panoramic 80x40 Epoch Miniature Pixel Landscape Scenery ---
  switch (epochId) {
    case 'prehistoric': {
      // Dramatic volcanic crimson-amber sunset with dithered sky bands
      px(0, 0, TILE_W, 8, '#3b161c');
      ditherBand(8, 2, '#3b161c', '#6e2825');
      px(0, 10, TILE_W, 7, '#6e2825');
      ditherBand(17, 2, '#6e2825', '#b84925');
      px(0, 19, TILE_W, 7, '#b84925');
      ditherBand(26, 2, '#b84925', '#eb8838');
      px(0, 28, TILE_W, 4, '#eb8838');

      // Radiant setting sun on right horizon
      circle(61, 17, 5.8, '#f59e0b');
      circle(61, 17, 4.2, '#fde047');
      circle(61, 17, 2.4, '#fffbeb');

      // Billowing volcanic ash plumes
      circle(18, 8, 3.0, '#6e5652');
      circle(22, 6, 3.4, '#8c726c');
      circle(27, 5, 2.3, '#ad928a');
      px(17, 11, 4, 3, '#57413f');

      // Smoking volcano silhouette + glowing lava fissures on left
      for (let row = 0; row < 18; row++) {
        const halfW = 3 + Math.floor(row * 0.68);
        px(17 - halfW, 13 + row, halfW * 2, 1, row < 4 ? '#291413' : '#3d1f1b');
      }
      px(15, 13, 4, 1, '#ff7b29');
      px(16, 12, 2, 1, '#fde047');
      px(17, 14, 1, 3, '#f97316');
      px(18, 16, 1, 2, '#ea580c');

      // Distant volcanic ridge & lush savanna plains
      px(0, 29, TILE_W, 3, '#4a3323');
      px(48, 27, 32, 3, '#5c3e27');
      px(0, 31, TILE_W, 4, '#476125');
      px(0, 32, TILE_W, 1, '#6c8c35');
      ditherBand(35, 2, '#476125', '#2a3b16');
      px(0, 37, TILE_W, 3, '#2a3b16');

      // Savanna acacia silhouettes flanking the horizon
      px(6, 26, 8, 2, '#223615');
      px(7, 25, 6, 1, '#314f1e');
      px(9, 28, 1, 5, '#4a2e1a');
      px(65, 26, 8, 2, '#223615');
      px(66, 25, 6, 1, '#314f1e');
      px(69, 28, 1, 5, '#4a2e1a');
      break;
    }

    case 'bronze': {
      // Sun-drenched ancient desert sky with turquoise-to-gold dithered horizon
      px(0, 0, TILE_W, 8, '#1d4f78');
      ditherBand(8, 2, '#1d4f78', '#387ea8');
      px(0, 10, TILE_W, 8, '#387ea8');
      ditherBand(18, 2, '#387ea8', '#87bcc4');
      px(0, 20, TILE_W, 6, '#d9b56c');
      ditherBand(26, 2, '#d9b56c', '#f2ca77');
      px(0, 28, TILE_W, 4, '#f2ca77');

      // Blazing sun disc on upper-left sky
      circle(19, 13, 4.8, '#f59e0b');
      circle(19, 13, 3.4, '#fde047');
      circle(19, 13, 1.9, '#fffbeb');
      px(19, 6, 1, 2, '#fef08a');
      px(12, 13, 2, 1, '#fef08a');
      px(25, 13, 2, 1, '#fef08a');

      // Stepped Mesopotamian Ziggurat on right
      px(52, 24, 21, 6, '#9c6327');
      px(52, 24, 14, 6, '#ba7932');
      px(52, 24, 14, 1, '#e8ab58');
      px(55, 19, 15, 5, '#a86b2b');
      px(55, 19, 10, 5, '#cc883b');
      px(55, 19, 10, 1, '#f2ba68');
      px(58, 14, 9, 5, '#ba7932');
      px(58, 14, 6, 5, '#de9b49');
      px(58, 14, 6, 1, '#fcd386');
      px(61, 16, 2, 3, '#4a2b12'); // temple archway

      // Rolling golden sandstone dunes
      px(0, 30, TILE_W, 10, '#c48333');
      for (let x = 0; x < TILE_W; x++) {
        const y = 30 + Math.round(Math.sin(x * 0.11) * 1.4);
        px(x, y, 1, 2, '#ebb05b');
        px(x, y + 2, 1, 10, '#c48333');
      }
      for (let x = 22; x < TILE_W; x++) {
        const y = 35 + Math.round(Math.cos((x - 22) * 0.1) * 1.3);
        px(x, y, 1, 1, '#d99843');
        px(x, y + 1, 1, 6, '#9e6322');
      }

      // Oasis palm trees on left dune
      px(11, 27, 2, 6, '#5c3a1d');
      px(8, 25, 4, 2, '#2d6a32');
      px(12, 24, 4, 2, '#3d873e');
      px(10, 23, 3, 2, '#52a34c');
      break;
    }

    case 'medieval': {
      // Crisp fairytale cerulean sky with dithered horizon
      px(0, 0, TILE_W, 9, '#275da3');
      ditherBand(9, 2, '#275da3', '#4d8dd1');
      px(0, 11, TILE_W, 9, '#4d8dd1');
      ditherBand(20, 2, '#4d8dd1', '#8cc2eb');
      px(0, 22, TILE_W, 8, '#8cc2eb');

      // Shaded fluffy cumulus clouds
      circle(20, 11, 3.0, '#ffffff');
      circle(24, 11, 2.5, '#ffffff');
      circle(17, 12, 2.0, '#e2f1ff');
      px(16, 13, 10, 1, '#c8e1f5');
      circle(57, 10, 2.6, '#ffffff');
      circle(61, 11, 2.2, '#e2f1ff');
      px(55, 12, 8, 1, '#c8e1f5');

      // Distant blue-slate mountain peaks on left
      for (let x = 2; x < 34; x++) {
        const h = Math.max(0, 8 - Math.abs(x - 16) * 0.55);
        px(x, 30 - h, 1, h + 2, '#628db8');
      }

      // Stone castle keep with towers, battlements & royal crimson pennant on right
      px(54, 17, 16, 14, '#738294');
      px(54, 17, 10, 14, '#92a1b3');
      px(54, 14, 3, 3, '#aebcc9');
      px(60, 14, 4, 3, '#aebcc9');
      px(67, 14, 3, 3, '#8897a8');
      px(57, 21, 2, 4, '#2d3748');
      px(64, 21, 2, 4, '#2d3748');
      px(61, 9, 1, 5, '#3b2416');
      px(62, 9, 5, 2, '#dc2626');
      px(63, 11, 3, 1, '#991b1b');

      // Rolling emerald meadows & pine trees
      for (let x = 0; x < TILE_W; x++) {
        const y = 30 + Math.round(Math.sin(x * 0.09) * 1.6);
        px(x, y, 1, 2, '#6ec458');
        px(x, y + 2, 1, 10, '#438f3d');
      }
      ditherBand(36, 2, '#438f3d', '#2d662a');
      px(0, 38, TILE_W, 2, '#2d662a');

      // Pine trees on left ridge
      px(11, 26, 3, 2, '#1e4f24');
      px(10, 28, 5, 2, '#27632c');
      px(12, 30, 1, 2, '#4f3018');
      px(17, 27, 3, 2, '#1e4f24');
      px(16, 29, 5, 2, '#27632c');
      px(18, 31, 1, 2, '#4f3018');
      break;
    }

    case 'industrial': {
      // Victorian twilight smog sky (plum -> rust -> amber)
      px(0, 0, TILE_W, 8, '#2c2336');
      ditherBand(8, 2, '#2c2336', '#5e3c47');
      px(0, 10, TILE_W, 8, '#5e3c47');
      ditherBand(18, 2, '#5e3c47', '#a65b41');
      px(0, 20, TILE_W, 8, '#a65b41');
      ditherBand(28, 2, '#a65b41', '#db914d');
      px(0, 30, TILE_W, 3, '#db914d');

      // Rising steam & coal smoke plumes
      circle(16, 9, 3.0, '#b8b0aa');
      circle(20, 7, 3.4, '#d4cdc8');
      circle(25, 6, 2.2, '#e8e2dd');
      circle(62, 10, 2.8, '#a89f9a');
      circle(66, 8, 3.0, '#c7bfba');

      // Brick mill skyline & twin tall smokestacks
      px(13, 12, 4, 21, '#4a261e');
      px(13, 12, 2, 21, '#633428');
      px(61, 13, 4, 20, '#4a261e');
      px(61, 13, 2, 20, '#633428');
      px(4, 22, 21, 11, '#5c2e22');
      px(4, 22, 21, 1, '#7d4332');
      px(55, 20, 21, 13, '#52281e');
      px(55, 20, 21, 1, '#753d2d');

      // Warm glowing factory windows
      for (let wx = 7; wx <= 21; wx += 4) {
        px(wx, 25, 2, 3, '#fbbf24');
        px(wx, 25, 1, 2, '#fef08a');
        px(wx, 29, 2, 2, '#f59e0b');
      }
      for (let wx = 57; wx <= 71; wx += 4) {
        px(wx, 23, 2, 3, '#fbbf24');
        px(wx, 23, 1, 2, '#fef08a');
        px(wx, 28, 2, 3, '#f59e0b');
      }

      // Cobblestone & iron rail yard foreground
      px(0, 33, TILE_W, 7, '#292429');
      px(0, 33, TILE_W, 2, '#4f464c');
      for (let x = 3; x < TILE_W - 2; x += 6) {
        px(x, 36, 4, 2, '#3d353b');
      }
      break;
    }

    case 'atomic': {
      // Mid-century retro-futurist deep teal to luminous aqua sky
      px(0, 0, TILE_W, 9, '#0f3352');
      ditherBand(9, 2, '#0f3352', '#1d628a');
      px(0, 11, TILE_W, 9, '#1d628a');
      ditherBand(20, 2, '#1d628a', '#3da1c4');
      px(0, 22, TILE_W, 8, '#3da1c4');
      ditherBand(30, 2, '#3da1c4', '#8ce0eb');

      // Hyperbolic cooling tower + crisp white vapor puff on left
      circle(17, 11, 3.2, '#e0f7fa');
      circle(21, 10, 2.6, '#ffffff');
      for (let row = 0; row < 16; row++) {
        const pinch = Math.abs(row - 5) * 0.25;
        const hw = Math.round(3.5 + pinch);
        px(17 - hw, 17 + row, hw * 2, 1, '#78909c');
        px(17 - hw, 17 + row, hw, 1, '#a7bcc7');
      }
      px(13, 17, 8, 1, '#d2e3ec');

      // Modernist mid-century glass skyline on right
      px(56, 14, 8, 19, '#3e5869');
      px(56, 14, 5, 19, '#58788c');
      px(64, 19, 8, 14, '#2f4554');
      for (let wy = 16; wy <= 29; wy += 3) {
        px(57, wy, 2, 1, '#a5f3fc');
        px(60, wy, 2, 1, '#67e8f9');
        if (wy >= 21) px(66, wy, 4, 1, '#a5f3fc');
      }

      // Concrete highway horizon with golden lane dashes
      px(0, 33, TILE_W, 7, '#1e2c36');
      px(0, 33, TILE_W, 2, '#4a6475');
      for (let x = 4; x < TILE_W; x += 14) {
        px(x, 37, 7, 1, '#facc15');
      }
      break;
    }

    case 'information': {
      // Cyber-dusk sapphire skyline with neon glow horizon
      px(0, 0, TILE_W, 10, '#091126');
      ditherBand(10, 2, '#091126', '#142754');
      px(0, 12, TILE_W, 10, '#142754');
      ditherBand(22, 2, '#142754', '#1d4487');
      px(0, 24, TILE_W, 9, '#1d4487');

      // Glowing neon skyscrapers flanking both sides
      px(6, 14, 9, 20, '#14203b');
      px(15, 20, 7, 14, '#1c2d52');
      px(57, 12, 9, 22, '#14203b');
      px(66, 18, 8, 16, '#1c2d52');
      px(61, 7, 1, 5, '#38bdf8');
      px(61, 6, 1, 1, '#f43f5e');

      for (let wy = 16; wy <= 31; wy += 3) {
        px(8, wy, 2, 1, '#38bdf8');
        px(11, wy, 2, 1, wy % 2 === 0 ? '#facc15' : '#7dd3fc');
        if (wy >= 22) px(17, wy, 3, 1, '#38bdf8');
        px(59, wy, 2, 1, '#38bdf8');
        px(62, wy, 2, 1, '#c084fc');
        if (wy >= 20) px(68, wy, 4, 1, '#38bdf8');
      }

      // Illuminated fiber-optic transit boulevard
      px(0, 34, TILE_W, 6, '#0b1224');
      px(0, 34, TILE_W, 1, '#38bdf8');
      px(0, 35, TILE_W, 1, '#1d4ed8');
      px(8, 37, 16, 1, '#38bdf8');
      px(52, 38, 18, 1, '#a855f7');
      break;
    }

    case 'orbital': {
      // Deep space cosmos with twinkling stars & curved glowing planet limb
      px(0, 0, TILE_W, 18, '#060b1c');
      ditherBand(18, 3, '#060b1c', '#0d1b3d');
      px(0, 21, TILE_W, 10, '#0d1b3d');

      const stars: Array<[number, number, string]> = [
        [14, 10, '#ffffff'],
        [22, 6, '#bae6fd'],
        [31, 4, '#fde047'],
        [52, 6, '#ffffff'],
        [63, 11, '#e0f2fe'],
        [10, 20, '#ffffff'],
        [68, 19, '#fef08a'],
        [25, 16, '#93c5fd'],
        [56, 16, '#bae6fd'],
      ];
      for (const [sx, sy, sc] of stars) px(sx, sy, 1, 1, sc);
      px(52, 5, 1, 3, '#ffffff');
      px(51, 6, 3, 1, '#ffffff');

      // Curved planet limb across the lower panoramic horizon
      circle(40, 72, 43, '#a5f3fc');
      circle(40, 73, 42, '#38bdf8');
      circle(40, 75, 42, '#155e91');
      // Orbital continents & cloud bands
      px(14, 34, 14, 4, '#2ea043');
      px(17, 33, 8, 2, '#4ade80');
      px(52, 35, 15, 4, '#2ea043');
      px(56, 34, 8, 2, '#4ade80');
      px(24, 31, 10, 1, '#e0f2fe');
      px(46, 32, 9, 1, '#ffffff');
      break;
    }

    case 'interstellar': {
      // Deep galactic cosmos with diagonal magenta-violet-gold nebula & ringed world
      px(0, 0, TILE_W, TILE_H, '#060817');

      for (let i = 0; i < TILE_W; i++) {
        const cy = 30 - Math.floor(i * 0.28);
        px(i, cy - 7, 1, 14, '#1a1038');
        px(i, cy - 4, 1, 9, '#301654');
        px(i, cy - 2, 1, 4, '#54206b');
        if (i % 2 === 0) px(i, cy, 1, 2, '#823285');
      }

      const stars: Array<[number, number, string]> = [
        [12, 12, '#ffffff'],
        [20, 6, '#fde047'],
        [30, 8, '#c4b5fd'],
        [55, 6, '#f9a8d4'],
        [66, 13, '#ffffff'],
        [10, 24, '#7dd3fc'],
        [18, 34, '#ffffff'],
        [27, 36, '#fde047'],
        [68, 23, '#bae6fd'],
      ];
      for (const [sx, sy, sc] of stars) px(sx, sy, 1, 1, sc);

      // Ringed golden gas giant on right horizon
      circle(62, 30, 5.0, '#b45309');
      circle(61, 29, 3.6, '#f59e0b');
      circle(60, 28, 1.9, '#fde68a');
      for (let rx = -8; rx <= 8; rx++) {
        const ry = Math.round(rx * 0.28);
        px(62 + rx, 30 + ry, 1, 1, rx % 2 === 0 ? '#fef08a' : '#fbbf24');
      }
      break;
    }
  }

  // --- 2. Foreground Crisp, Finely Shaded Pixel Age Emblem (Centered at x=40, y=22) ---
  // Offset helper: maps 48x48 centered coordinates (center 24,24) -> 80x40 arch center (40,22)
  const ox = 16;
  const oy = -2;
  const paintEmblem = (pixels: Array<[number, number, number, number, string]>) => {
    for (const [x, y, w, h] of pixels) {
      px(x + ox - 1, y + oy, w + 2, h, '#120a07');
      px(x + ox, y + oy - 1, w, h + 2, '#120a07');
    }
    for (const [x, y, w, h, c] of pixels) {
      px(x + ox, y + oy, w, h, c);
    }
  };

  switch (epochId) {
    case 'prehistoric': {
      paintEmblem([
        [13, 35, 4, 3, '#6b7280'],
        [14, 35, 2, 1, '#9ca3af'],
        [31, 35, 4, 3, '#6b7280'],
        [32, 35, 2, 1, '#9ca3af'],
        [15, 33, 18, 4, '#5c2e16'],
        [17, 32, 14, 2, '#8a4824'],
        [18, 35, 12, 2, '#3d1c0c'],
        [16, 23, 16, 10, '#dc2626'],
        [17, 19, 14, 13, '#ea580c'],
        [19, 15, 10, 15, '#f97316'],
        [21, 11, 6, 8, '#f97316'],
        [23, 9, 2, 4, '#fb923c'],
        [19, 22, 10, 9, '#facc15'],
        [21, 17, 6, 11, '#facc15'],
        [23, 14, 2, 5, '#fde047'],
        [21, 24, 6, 6, '#fef9c3'],
        [22, 21, 4, 7, '#ffffff'],
        [16, 12, 2, 2, '#fde047'],
        [31, 14, 2, 2, '#fb923c'],
        [27, 9, 1, 2, '#fef08a'],
      ]);
      break;
    }

    case 'bronze': {
      paintEmblem([
        [15, 33, 18, 4, '#784116'],
        [16, 33, 16, 1, '#b56c2a'],
        [18, 28, 12, 5, '#9a541d'],
        [19, 28, 5, 5, '#bd6e2a'],
        [11, 21, 26, 7, '#cc7d2e'],
        [9, 21, 6, 4, '#e39a42'],
        [7, 21, 4, 2, '#f5bc62'],
        [13, 21, 23, 2, '#fde08a'],
        [14, 23, 21, 1, '#e8a246'],
        [28, 24, 8, 3, '#9a541d'],
        [20, 10, 11, 6, '#e59d40'],
        [21, 10, 9, 2, '#fff0b8'],
        [29, 11, 2, 4, '#9a541d'],
        [23, 16, 3, 5, '#6e3a1c'],
        [24, 16, 1, 5, '#9e5a31'],
        [14, 14, 2, 2, '#fef08a'],
        [17, 17, 1, 1, '#ffffff'],
        [34, 15, 2, 2, '#fde047'],
      ]);
      break;
    }

    case 'medieval': {
      paintEmblem([
        [13, 13, 22, 14, '#d97706'],
        [14, 27, 20, 4, '#b45309'],
        [16, 31, 16, 3, '#b45309'],
        [19, 34, 10, 3, '#92400e'],
        [22, 37, 4, 2, '#78350f'],
        [14, 13, 20, 1, '#fde047'],
        [13, 14, 1, 13, '#fbbf24'],
        [15, 15, 18, 12, '#b91c1c'],
        [16, 27, 16, 4, '#991b1b'],
        [18, 31, 12, 3, '#991b1b'],
        [21, 34, 6, 2, '#7f1d1d'],
        [15, 15, 9, 10, '#dc2626'],
        [24, 24, 9, 3, '#dc2626'],
        [22, 8, 4, 24, '#cbd5e1'],
        [22, 8, 2, 23, '#ffffff'],
        [23, 7, 2, 2, '#ffffff'],
        [24, 11, 1, 17, '#94a3b8'],
        [17, 20, 14, 3, '#f59e0b'],
        [18, 20, 12, 1, '#fef08a'],
        [16, 21, 2, 2, '#d97706'],
        [30, 21, 2, 2, '#d97706'],
        [23, 32, 2, 4, '#5c2e16'],
        [22, 36, 4, 3, '#f59e0b'],
        [23, 37, 2, 1, '#ef4444'],
      ]);
      break;
    }

    case 'industrial': {
      paintEmblem([
        [21, 8, 6, 30, '#c77c32'],
        [9, 20, 30, 6, '#c77c32'],
        [12, 11, 6, 6, '#b86d28'],
        [30, 11, 6, 6, '#b86d28'],
        [12, 29, 6, 6, '#b86d28'],
        [30, 29, 6, 6, '#b86d28'],
        [14, 13, 20, 20, '#e59f47'],
        [15, 12, 18, 22, '#e59f47'],
        [13, 14, 22, 18, '#e59f47'],
        [15, 13, 14, 2, '#fef0c7'],
        [14, 14, 2, 14, '#fad596'],
        [22, 9, 4, 2, '#fef0c7'],
        [17, 16, 14, 14, '#5e3920'],
        [22, 16, 4, 14, '#d98e3b'],
        [17, 21, 14, 4, '#d98e3b'],
        [20, 19, 8, 8, '#f5c77e'],
        [21, 20, 6, 6, '#c77c32'],
        [22, 21, 4, 4, '#241812'],
        [16, 15, 1, 1, '#fff7d6'],
        [31, 15, 1, 1, '#fff7d6'],
        [16, 30, 1, 1, '#fff7d6'],
        [31, 30, 1, 1, '#fff7d6'],
      ]);
      break;
    }

    case 'atomic': {
      paintEmblem([
        [22, 8, 4, 30, '#0284c7'],
        [9, 21, 30, 4, '#0284c7'],
        [14, 13, 20, 20, '#38bdf8'],
        [16, 15, 16, 16, '#0f2940'],
        [13, 12, 4, 4, '#7dd3fc'],
        [31, 12, 4, 4, '#7dd3fc'],
        [13, 30, 4, 4, '#7dd3fc'],
        [31, 30, 4, 4, '#7dd3fc'],
        [23, 9, 2, 28, '#bae6fd'],
        [10, 22, 28, 2, '#bae6fd'],
        [18, 17, 12, 12, '#0c2236'],
        [20, 19, 8, 8, '#f59e0b'],
        [21, 20, 6, 6, '#fde047'],
        [22, 21, 4, 4, '#ffffff'],
        [12, 11, 3, 3, '#e0f2fe'],
        [33, 11, 3, 3, '#e0f2fe'],
        [12, 32, 3, 3, '#e0f2fe'],
        [33, 32, 3, 3, '#e0f2fe'],
      ]);
      break;
    }

    case 'information': {
      paintEmblem([
        [17, 8, 2, 5, '#f59e0b'],
        [23, 8, 2, 5, '#fbbf24'],
        [29, 8, 2, 5, '#f59e0b'],
        [17, 34, 2, 5, '#f59e0b'],
        [23, 34, 2, 5, '#fbbf24'],
        [29, 34, 2, 5, '#f59e0b'],
        [8, 16, 5, 2, '#f59e0b'],
        [8, 22, 5, 2, '#fbbf24'],
        [8, 28, 5, 2, '#f59e0b'],
        [35, 16, 5, 2, '#f59e0b'],
        [35, 22, 5, 2, '#fbbf24'],
        [35, 28, 5, 2, '#f59e0b'],
        [13, 12, 22, 22, '#1d4ed8'],
        [14, 13, 20, 20, '#0f172a'],
        [14, 13, 20, 1, '#60a5fa'],
        [17, 15, 1, 16, '#1e40af'],
        [30, 15, 1, 16, '#1e40af'],
        [16, 16, 16, 1, '#1e40af'],
        [16, 29, 16, 1, '#1e40af'],
        [18, 17, 12, 12, '#0284c7'],
        [19, 18, 10, 10, '#38bdf8'],
        [21, 20, 6, 6, '#e0f2fe'],
        [22, 21, 3, 3, '#ffffff'],
      ]);
      break;
    }

    case 'orbital': {
      paintEmblem([
        [23, 7, 2, 3, '#ef4444'],
        [22, 10, 4, 3, '#dc2626'],
        [22, 10, 2, 3, '#f87171'],
        [20, 13, 8, 16, '#cbd5e1'],
        [20, 13, 5, 16, '#f8fafc'],
        [21, 13, 2, 15, '#ffffff'],
        [26, 14, 2, 15, '#94a3b8'],
        [22, 16, 4, 4, '#0284c7'],
        [23, 17, 2, 2, '#7dd3fc'],
        [23, 17, 1, 1, '#ffffff'],
        [20, 26, 8, 2, '#dc2626'],
        [15, 24, 5, 6, '#b91c1c'],
        [16, 25, 3, 4, '#ef4444'],
        [28, 24, 5, 6, '#b91c1c'],
        [29, 25, 3, 4, '#ef4444'],
        [21, 29, 6, 2, '#475569'],
        [21, 31, 6, 3, '#f97316'],
        [22, 32, 4, 5, '#facc15'],
        [23, 33, 2, 6, '#fffbeb'],
      ]);
      break;
    }

    case 'interstellar': {
      paintEmblem([
        [23, 7, 2, 32, '#d97706'],
        [8, 22, 32, 2, '#d97706'],
        [22, 11, 4, 24, '#f59e0b'],
        [12, 21, 24, 4, '#f59e0b'],
        [13, 12, 5, 5, '#fbbf24'],
        [30, 12, 5, 5, '#fbbf24'],
        [13, 29, 5, 5, '#fbbf24'],
        [30, 29, 5, 5, '#fbbf24'],
        [16, 15, 16, 16, '#fbbf24'],
        [18, 17, 12, 12, '#fde047'],
        [20, 19, 8, 8, '#fef9c3'],
        [22, 21, 4, 4, '#ffffff'],
        [23, 8, 2, 3, '#fef08a'],
        [23, 35, 2, 3, '#fef08a'],
        [9, 22, 3, 2, '#fef08a'],
        [36, 22, 3, 2, '#fef08a'],
      ]);
      break;
    }
  }

  const url = canvas.toDataURL('image/png');
  cachedSceneryUrls.set(epochId, url);
  return url;
}

interface PixelBurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  age: number;
  life: number;
  gravity: number;
  drag: number;
  sparkle: boolean;
}

const IMPACT_DELAY_MS = 960;
const EXIT_START_MS = 2850;
const TOTAL_DURATION_MS = 3300;

export const AgeProgressBanner: React.FC<AgeProgressBannerProps> = ({
  event,
  onImpact,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'enter' | 'spinning' | 'impact' | 'exit'>('enter');
  const [showNewText, setShowNewText] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<PixelBurstParticle[]>([]);
  const onImpactRef = useRef(onImpact);
  const onCompleteRef = useRef(onComplete);
  onImpactRef.current = onImpact;
  onCompleteRef.current = onComplete;

  const fromEpoch: EpochDefinition =
    EPOCHS[Math.max(0, Math.min(EPOCHS.length - 1, event?.fromIndex ?? 0))] ?? EPOCHS[0];
  const toEpoch: EpochDefinition =
    EPOCHS[Math.max(0, Math.min(EPOCHS.length - 1, event?.toIndex ?? 0))] ?? EPOCHS[0];

  // Trigger timeline phases & particle burst synchronized to the full-dial 180° lock-in
  useEffect(() => {
    if (!event) return;

    setPhase('enter');
    setShowNewText(false);
    particlesRef.current = [];

    const spinTimer = window.setTimeout(() => {
      setPhase('spinning');
    }, 340);

    const impactTimer = window.setTimeout(() => {
      setPhase('impact');
      setShowNewText(true);
      onImpactRef.current();

      const canvas = canvasRef.current;
      const cw = canvas ? canvas.width : 580;
      const dialOriginX = cw * 0.5 - 92;
      const dialOriginY = 92;
      const palette = [
        '#fff9db',
        '#fde047',
        '#f59e0b',
        '#f7d2a6',
        toEpoch.accentColor,
        '#ffffff',
      ];
      const burst: PixelBurstParticle[] = [];

      // 1. High-energy radial pixel spark explosion around the half-circle dial
      for (let i = 0; i < 56; i++) {
        const angle = (i / 56) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const speed = 135 + Math.random() * 255;
        burst.push({
          x: dialOriginX + (Math.random() - 0.5) * 32,
          y: dialOriginY + (Math.random() - 0.5) * 24,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 25,
          size: Math.random() < 0.32 ? 8 : Math.random() < 0.72 ? 6 : 4,
          color: palette[Math.floor(Math.random() * palette.length)],
          age: 0,
          life: 0.52 + Math.random() * 0.52,
          gravity: 320 + Math.random() * 140,
          drag: 0.94,
          sparkle: Math.random() < 0.42,
        });
      }

      // 2. Horizontal pixel spark shimmer along the newly revealed age title on the right
      for (let i = 0; i < 28; i++) {
        const tx = cw * 0.5 + 32 + (Math.random() - 0.5) * 180;
        const ty = dialOriginY + 6 + (Math.random() - 0.5) * 24;
        burst.push({
          x: tx,
          y: ty,
          vx: (tx - dialOriginX) * 0.65 + (Math.random() - 0.5) * 85,
          vy: -(55 + Math.random() * 150),
          size: Math.random() < 0.5 ? 6 : 4,
          color: i % 3 === 0 ? '#ffffff' : i % 2 === 0 ? '#fde047' : toEpoch.accentColor,
          age: 0,
          life: 0.6 + Math.random() * 0.5,
          gravity: 250,
          drag: 0.95,
          sparkle: true,
        });
      }

      particlesRef.current = burst;
    }, IMPACT_DELAY_MS);

    const exitTimer = window.setTimeout(() => {
      setPhase('exit');
    }, EXIT_START_MS);

    const doneTimer = window.setTimeout(() => {
      onCompleteRef.current();
    }, TOTAL_DURATION_MS);

    return () => {
      window.clearTimeout(spinTimer);
      window.clearTimeout(impactTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, [event, toEpoch.accentColor]);

  // Dedicated crisp pixel-particle canvas animation loop (zero React re-renders per frame)
  useEffect(() => {
    if (!event) return;
    let rafId = 0;
    let lastTs = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const list = particlesRef.current;
        for (let i = list.length - 1; i >= 0; i--) {
          const p = list[i];
          p.age += dt;
          if (p.age >= p.life) {
            list.splice(i, 1);
            continue;
          }
          const damp = Math.pow(p.drag, dt * 60);
          p.vx *= damp;
          p.vy = p.vy * damp + p.gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          const t = p.age / p.life;
          const alpha = t > 0.65 ? Math.max(0, 1 - (t - 0.65) / 0.35) : 1;
          if (p.sparkle && Math.floor(p.age * 24) % 3 === 0) continue;

          const sz = Math.max(2, Math.round((p.size * (1 - t * 0.35)) / 2) * 2);
          const rx = Math.round(p.x / 2) * 2 - (sz >> 1);
          const ry = Math.round(p.y / 2) * 2 - (sz >> 1);

          ctx.globalAlpha = alpha;
          if (sz >= 6) {
            ctx.fillStyle = '#120a07';
            ctx.fillRect(rx - 2, ry - 2, sz + 4, sz + 4);
          }
          ctx.fillStyle = p.color;
          ctx.fillRect(rx, ry, sz, sz);
        }
        ctx.globalAlpha = 1;
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [event]);

  if (!event) return null;

  const fromUrl = getEpochSceneryDataUrl(fromEpoch.id);
  const toUrl = getEpochSceneryDataUrl(toEpoch.id);
  const displayedEpoch = showNewText ? toEpoch : fromEpoch;

  const wheelPhaseClass =
    phase === 'spinning'
      ? 'age-dial-wheel-rotate'
      : phase === 'impact'
        ? 'age-dial-wheel-impact'
        : phase === 'enter'
          ? 'age-dial-wheel-ready'
          : 'age-dial-wheel-settled';

  return (
    <div
      key={event.id}
      data-testid="age-progress-banner"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[48] flex items-start justify-center pt-[76px] sm:pt-[72px] select-none ${
        phase === 'exit' ? 'age-banner-exit' : 'age-banner-enter'
      }`}
    >
      {/* Unified Horizontal HUD Plaque: Full-Bleed Half-Circle Age Dial (Left) + Age Title (Right) */}
      <div className="relative flex items-center justify-center">
        {/* Crisp pixelated explosion particle canvas aligned to dial + title */}
        <canvas
          ref={canvasRef}
          width={580}
          height={260}
          className="pixelated-canvas pointer-events-none absolute left-1/2 -top-[52px] -translate-x-1/2 w-[580px] h-[260px] max-w-[100vw]"
        />

        <div
          className={`px-panel-hero pt-3.5 pb-2.5 pl-3 pr-4 sm:pt-4 sm:pb-3 sm:pl-4 sm:pr-7 flex flex-row items-center gap-3.5 sm:gap-4 min-w-[268px] sm:min-w-[330px] ${
            showNewText ? 'age-text-slam' : ''
          }`}
        >
          {/* LEFT: Full-Bleed Half-Circle Rotating Age Wheel (Exact 2:1 Semicircle) */}
          <div className="relative shrink-0 w-[108px] h-[57px] sm:w-[128px] sm:h-[67px]">
            {/* Semicircular Clipped Viewport */}
            <div
              className="relative w-full h-full rounded-t-full overflow-hidden border-t-[3px] border-x-[3px] border-b-[3px] border-[#0c0705] bg-[#140c08]"
              style={{
                boxShadow:
                  '0 0 0 1.5px #d99968, 0 4px 0 rgba(10,6,4,0.8)',
              }}
            >
              {/* Full Circular Two-Half Diorama Disk (Top Half = Previous Age, Bottom Half = Next Age) */}
              <div
                className={`absolute left-0 top-0 w-[102px] h-[102px] sm:w-[122px] sm:h-[122px] rounded-full overflow-hidden ${wheelPhaseClass}`}
                style={{ willChange: 'transform' }}
              >
                {/* TOP HALF (0°): Full-Bleed Previous Age Scene */}
                <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden">
                  <img
                    src={fromUrl}
                    alt={fromEpoch.name}
                    className="pixelated-canvas w-full h-full block object-cover"
                  />
                </div>

                {/* BOTTOM HALF (180°): Full-Bleed Next Age Scene (pre-rotated 180° so it lands upright!) */}
                <div
                  className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden"
                  style={{ transform: 'rotate(180deg)' }}
                >
                  <img
                    src={toUrl}
                    alt={toEpoch.name}
                    className="pixelated-canvas w-full h-full block object-cover"
                  />
                </div>

                {/* Golden Astrolabe Seam Divider Separating the Two Ages Across the Diameter */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-[4px] bg-[#0c0705] flex items-center"
                >
                  <div className="w-full h-[2px] bg-gradient-to-r from-[#a66b44] via-[#ffe49e] to-[#a66b44]" />
                </div>

                {/* Center Astrolabe Pivot Jewel */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full bg-[#ffe49e] border-[2px] border-[#0c0705]"
                  style={{ boxShadow: '0 0 6px rgba(255,228,158,0.8)' }}
                />
              </div>

              {/* Crisp Astrolabe Golden Arc Rim & Degree Ticks Overlay */}
              <svg
                viewBox="0 0 128 64"
                className="pointer-events-none absolute inset-0 w-full h-full"
                aria-hidden="true"
              >
                {/* Inner golden arch bezel */}
                <path
                  d="M 2 63 A 62 62 0 0 1 126 63"
                  fill="none"
                  stroke="#f7d2a6"
                  strokeWidth="2"
                  opacity="0.88"
                />
                <path
                  d="M 6 63 A 58 58 0 0 1 122 63"
                  fill="none"
                  stroke="#0c0705"
                  strokeWidth="1.2"
                  opacity="0.55"
                />
                {/* Fine radial astrolabe degree ticks along the rim */}
                {[-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75].map((deg) => {
                  const rad = ((deg - 90) * Math.PI) / 180;
                  const isMajor = deg % 30 === 0;
                  const rOuter = 61;
                  const rInner = isMajor ? 54.5 : 57;
                  const x1 = 64 + Math.cos(rad) * rInner;
                  const y1 = 63 + Math.sin(rad) * rInner;
                  const x2 = 64 + Math.cos(rad) * rOuter;
                  const y2 = 63 + Math.sin(rad) * rOuter;
                  return (
                    <line
                      key={deg}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isMajor ? '#fff3c4' : '#f7d2a6'}
                      strokeWidth={isMajor ? 1.5 : 1}
                      opacity={isMajor ? 0.92 : 0.65}
                    />
                  );
                })}
              </svg>

              {/* Crisp white-gold zenith lock-in flash across the full semicircle */}
              {phase === 'impact' && (
                <div className="age-impact-flash pointer-events-none absolute inset-0 bg-[#fff9db]" />
              )}

              {/* Bottom Horizon Golden Rim Trim */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-[#8f5b38] via-[#ffe49e] to-[#8f5b38]"
              />
            </div>

            {/* Ornate Zenith Diamond Pointer at 12 o'clock (top of arch) */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute left-1/2 -top-[5px] -translate-x-1/2 w-[11px] h-[11px] rotate-45 bg-[#ffe49e] border-[2px] border-[#0c0705] ${
                phase === 'impact' ? 'age-zenith-pulse' : ''
              }`}
              style={{
                boxShadow: '0 0 6px rgba(255,228,158,0.8)',
              }}
            />

            {/* Left & Right Horizon Astrolabe Nodes */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-[3px] bottom-[-2px] w-[7px] h-[7px] rounded-full bg-[#f7d2a6] border-[1.5px] border-[#0c0705]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-[3px] bottom-[-2px] w-[7px] h-[7px] rounded-full bg-[#d99968] border-[1.5px] border-[#0c0705]"
            />
          </div>

          {/* RIGHT: Age Eyebrow & Title Text */}
          <div className="flex flex-col items-start text-left justify-center min-w-0">
            <span className="font-pixel-num text-[10px] sm:text-xs font-bold tracking-[0.15em] uppercase text-[#d9a977] leading-none mb-1">
              {displayedEpoch.yearLabel}
            </span>
            <span
              data-testid="age-progress-banner-title"
              className="font-bold text-base sm:text-xl leading-tight tracking-wide whitespace-nowrap"
              style={{
                color: showNewText ? '#ffe49e' : '#eadbc6',
                textShadow:
                  '0 2px 0 #140c08, 2px 0 0 #140c08, -2px 0 0 #140c08, 0 -2px 0 #140c08',
              }}
            >
              {displayedEpoch.name}
            </span>
            {/* Subtle decorative golden underline accent */}
            <div
              aria-hidden="true"
              className="mt-1.5 h-[2px] w-full max-w-[140px] bg-gradient-to-r from-[#f7d2a6] via-[#d99968]/70 to-transparent"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
