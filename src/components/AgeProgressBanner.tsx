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

const TILE_PX = 48;
const cachedSceneryUrls = new Map<EpochId, string>();

/**
 * Renders a richly detailed, handcrafted 48x48 pixel-art scenery + foreground age emblem
 * for each of the 8 civilization epochs (100% procedural, zero external assets).
 */
export function getEpochSceneryDataUrl(epochId: EpochId): string {
  const existing = cachedSceneryUrls.get(epochId);
  if (existing) return existing;
  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;

  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  };

  // Checkerboard pixel dithering transition between two horizontal bands
  const ditherBand = (yStart: number, height: number, c1: string, c2: string) => {
    for (let y = yStart; y < yStart + height; y++) {
      for (let x = 0; x < TILE_PX; x++) {
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

  // --- 1. Epoch-Specific Detailed 48x48 Miniature Pixel Landscape Scenery ---
  switch (epochId) {
    case 'prehistoric': {
      // Volcanic crimson-amber twilight sky with pixel-dithered bands
      px(0, 0, 48, 9, '#3d191e');
      ditherBand(9, 2, '#3d191e', '#6e2b27');
      px(0, 11, 48, 8, '#6e2b27');
      ditherBand(19, 2, '#6e2b27', '#b84c27');
      px(0, 21, 48, 7, '#b84c27');
      ditherBand(28, 2, '#b84c27', '#e68437');
      px(0, 30, 48, 4, '#e68437');

      // Radiant setting sun with warm halo
      circle(36, 18, 6.2, '#f59e0b');
      circle(36, 18, 4.6, '#fde047');
      circle(36, 18, 2.8, '#fffbeb');

      // Billowing volcanic ash plumes
      circle(11, 6, 3.2, '#6b5350');
      circle(15, 4, 3.6, '#876d68');
      circle(19, 3, 2.5, '#a88d86');
      px(10, 9, 4, 3, '#57413f');

      // Smoking volcano silhouette + glowing lava fissures
      for (let row = 0; row < 18; row++) {
        const halfW = 3 + Math.floor(row * 0.62);
        px(10 - halfW, 13 + row, halfW * 2, 1, row < 4 ? '#2b1615' : '#3d201c');
      }
      px(8, 13, 4, 1, '#ff7b29');
      px(9, 12, 2, 1, '#fde047');
      px(10, 14, 1, 3, '#f97316');
      px(11, 16, 1, 2, '#ea580c');

      // Distant volcanic ridge & savanna plains
      px(0, 30, 48, 4, '#4a3525');
      px(24, 28, 24, 3, '#5c3f28');
      px(0, 33, 48, 5, '#465e26');
      px(0, 34, 48, 1, '#688735');
      px(0, 38, 48, 10, '#2c3d18');
      ditherBand(38, 2, '#465e26', '#2c3d18');

      // Savanna acacia silhouettes & foreground grass blades
      px(3, 27, 7, 2, '#223615');
      px(4, 26, 5, 1, '#2f4a1d');
      px(6, 29, 1, 5, '#4a2e1a');
      px(39, 28, 7, 2, '#223615');
      px(40, 27, 5, 1, '#2f4a1d');
      px(42, 30, 1, 5, '#4a2e1a');
      px(2, 41, 1, 2, '#5a782d');
      px(44, 40, 1, 2, '#5a782d');
      break;
    }

    case 'bronze': {
      // Sun-drenched ancient desert sky with turquoise-to-gold dithered horizon
      px(0, 0, 48, 9, '#1f537d');
      ditherBand(9, 2, '#1f537d', '#3b82ab');
      px(0, 11, 48, 9, '#3b82ab');
      ditherBand(20, 2, '#3b82ab', '#8ec2c9');
      px(0, 22, 48, 6, '#d9b56c');
      ditherBand(28, 2, '#d9b56c', '#f0c875');
      px(0, 30, 48, 4, '#f0c875');

      // Blazing sun disc with subtle cross rays
      circle(9, 9, 5.2, '#f59e0b');
      circle(9, 9, 3.8, '#fde047');
      circle(9, 9, 2.1, '#fffbeb');
      px(9, 2, 1, 2, '#fef08a');
      px(2, 9, 2, 1, '#fef08a');
      px(15, 9, 2, 1, '#fef08a');

      // Stepped Mesopotamian Ziggurat with lit stone terraces & shadow side
      px(26, 26, 19, 6, '#9c6327');
      px(26, 26, 13, 6, '#ba7932');
      px(26, 26, 13, 1, '#e6a856');
      px(29, 21, 13, 5, '#a86b2b');
      px(29, 21, 9, 5, '#cc883b');
      px(29, 21, 9, 1, '#f2ba68');
      px(32, 16, 7, 5, '#ba7932');
      px(32, 16, 5, 5, '#de9b49');
      px(32, 16, 5, 1, '#fcd386');
      px(34, 18, 2, 3, '#4a2b12'); // temple sanctuary doorway

      // Rolling sandstone dunes with crest highlights
      px(0, 32, 48, 16, '#c48333');
      for (let x = 0; x < 30; x++) {
        const y = 31 + Math.round(Math.sin(x * 0.14) * 1.5);
        px(x, y, 1, 2, '#ebb05b');
        px(x, y + 2, 1, 16, '#c48333');
      }
      for (let x = 16; x < 48; x++) {
        const y = 36 + Math.round(Math.cos((x - 16) * 0.13) * 1.6);
        px(x, y, 1, 1, '#d99843');
        px(x, y + 1, 1, 12, '#9e6322');
      }

      // Oasis palm silhouette on left
      px(4, 29, 2, 6, '#5c3a1d');
      px(1, 27, 4, 2, '#2d6a32');
      px(5, 26, 4, 2, '#3d873e');
      px(3, 25, 3, 2, '#52a34c');
      break;
    }

    case 'medieval': {
      // Fairytale cerulean kingdom sky with dithered horizon
      px(0, 0, 48, 10, '#2a62a8');
      ditherBand(10, 2, '#2a62a8', '#4f8fd1');
      px(0, 12, 48, 10, '#4f8fd1');
      ditherBand(22, 2, '#4f8fd1', '#8cc2eb');
      px(0, 24, 48, 8, '#8cc2eb');

      // Layered shaded cumulus clouds
      circle(9, 8, 3.2, '#ffffff');
      circle(13, 8, 2.8, '#ffffff');
      circle(6, 9, 2.2, '#e2f1ff');
      px(5, 10, 10, 2, '#c8e1f5');
      circle(36, 7, 2.8, '#ffffff');
      circle(40, 8, 2.4, '#e2f1ff');
      px(34, 9, 8, 1, '#c8e1f5');

      // Distant blue-slate mountain range
      for (let x = 0; x < 24; x++) {
        const h = Math.max(0, 7 - Math.abs(x - 10) * 0.65);
        px(x, 30 - h, 1, h + 2, '#628db8');
      }

      // Stone castle keep with towers, embrasures & royal crimson pennant
      px(30, 18, 14, 14, '#738294');
      px(30, 18, 9, 14, '#92a1b3');
      px(30, 15, 3, 3, '#aebcc9');
      px(35, 15, 3, 3, '#aebcc9');
      px(40, 15, 4, 3, '#8897a8');
      px(33, 22, 2, 4, '#2d3748'); // arrow slit
      px(39, 22, 2, 4, '#2d3748');
      px(36, 10, 1, 5, '#3b2416'); // flagpole
      px(37, 10, 5, 2, '#dc2626'); // fluttering royal banner
      px(38, 12, 3, 1, '#991b1b');

      // Rolling emerald meadows + foreground sunlit ridge
      for (let x = 0; x < 48; x++) {
        const y = 31 + Math.round(Math.sin(x * 0.12) * 1.8);
        px(x, y, 1, 2, '#6ec458');
        px(x, y + 2, 1, 16, '#438f3d');
      }
      ditherBand(38, 2, '#438f3d', '#2d662a');
      px(0, 40, 48, 8, '#2d662a');

      // Pine trees on left hill
      px(4, 28, 3, 2, '#1e4f24');
      px(3, 30, 5, 2, '#27632c');
      px(5, 32, 1, 2, '#4f3018');
      break;
    }

    case 'industrial': {
      // Victorian twilight smog sky (plum -> copper -> amber)
      px(0, 0, 48, 9, '#2e2536');
      ditherBand(9, 2, '#2e2536', '#5e3d47');
      px(0, 11, 48, 9, '#5e3d47');
      ditherBand(20, 2, '#5e3d47', '#a65c42');
      px(0, 22, 48, 8, '#a65c42');
      ditherBand(30, 2, '#a65c42', '#d9914e');
      px(0, 32, 48, 3, '#d9914e');

      // Rising billowing steam & coal smoke plumes
      circle(8, 6, 3.2, '#b8b0aa');
      circle(12, 4, 3.6, '#d4cdc8');
      circle(16, 3, 2.4, '#e8e2dd');
      circle(38, 7, 2.8, '#a89f9a');
      circle(42, 5, 3.2, '#c7bfba');

      // Brick mill skyline & twin tall smokestacks
      px(6, 10, 4, 24, '#4a261e');
      px(6, 10, 2, 24, '#633428');
      px(36, 11, 4, 23, '#4a261e');
      px(36, 11, 2, 23, '#633428');
      px(1, 22, 15, 13, '#5c2e22');
      px(1, 22, 15, 1, '#7d4332');
      px(31, 20, 16, 15, '#52281e');
      px(31, 20, 16, 1, '#753d2d');

      // Warm lit arched factory windows
      for (let wx = 3; wx <= 12; wx += 4) {
        px(wx, 25, 2, 3, '#fbbf24');
        px(wx, 25, 1, 2, '#fef08a');
        px(wx, 30, 2, 2, '#f59e0b');
      }
      for (let wx = 33; wx <= 43; wx += 4) {
        px(wx, 23, 2, 3, '#fbbf24');
        px(wx, 23, 1, 2, '#fef08a');
        px(wx, 28, 2, 3, '#f59e0b');
      }

      // Cobblestone & iron rail yard foreground
      px(0, 34, 48, 14, '#292429');
      px(0, 34, 48, 2, '#4f464c');
      for (let x = 2; x < 46; x += 6) {
        px(x, 38, 4, 2, '#3d353b');
        px(x + 2, 42, 4, 2, '#3d353b');
      }
      break;
    }

    case 'atomic': {
      // Mid-century retro-futurist deep teal to luminous aqua sky
      px(0, 0, 48, 10, '#103554');
      ditherBand(10, 2, '#103554', '#1d628a');
      px(0, 12, 48, 10, '#1d628a');
      ditherBand(22, 2, '#1d628a', '#3da1c4');
      px(0, 24, 48, 8, '#3da1c4');
      ditherBand(32, 2, '#3da1c4', '#8ce0eb');

      // Hyperbolic nuclear cooling tower + crisp white vapor cloud
      circle(9, 8, 3.4, '#e0f7fa');
      circle(13, 7, 2.8, '#ffffff');
      for (let row = 0; row < 18; row++) {
        const pinch = Math.abs(row - 6) * 0.25;
        const hw = Math.round(3.5 + pinch);
        px(9 - hw, 16 + row, hw * 2, 1, '#78909c');
        px(9 - hw, 16 + row, hw, 1, '#a7bcc7');
      }
      px(5, 16, 8, 1, '#d2e3ec');

      // Modernist mid-century glass towers on right
      px(33, 14, 7, 20, '#3e5869');
      px(33, 14, 4, 20, '#58788c');
      px(40, 19, 7, 15, '#2f4554');
      for (let wy = 16; wy <= 30; wy += 3) {
        px(34, wy, 2, 1, '#a5f3fc');
        px(37, wy, 2, 1, '#67e8f9');
        if (wy >= 21) px(42, wy, 3, 1, '#a5f3fc');
      }

      // Concrete highway horizon with golden lane dashes
      px(0, 34, 48, 14, '#1e2c36');
      px(0, 34, 48, 2, '#4a6475');
      px(3, 40, 7, 2, '#facc15');
      px(17, 40, 7, 2, '#facc15');
      px(31, 40, 7, 2, '#facc15');
      px(44, 40, 4, 2, '#facc15');
      break;
    }

    case 'information': {
      // Cyber-dusk sapphire skyline with neon glow horizon
      px(0, 0, 48, 11, '#0a1229');
      ditherBand(11, 2, '#0a1229', '#142754');
      px(0, 13, 48, 11, '#142754');
      ditherBand(24, 2, '#142754', '#1d4487');
      px(0, 26, 48, 8, '#1d4487');

      // Distant glowing neon spires & glass skyscrapers
      px(1, 13, 8, 22, '#14203b');
      px(9, 19, 6, 16, '#1c2d52');
      px(33, 11, 8, 24, '#14203b');
      px(41, 17, 6, 18, '#1c2d52');
      px(36, 6, 1, 5, '#38bdf8'); // spire antenna
      px(36, 5, 1, 1, '#f43f5e'); // blinking beacon

      for (let wy = 15; wy <= 31; wy += 3) {
        px(2, wy, 2, 1, '#38bdf8');
        px(5, wy, 2, 1, wy % 2 === 0 ? '#facc15' : '#7dd3fc');
        if (wy >= 21) px(10, wy, 3, 1, '#38bdf8');
        px(34, wy, 2, 1, '#38bdf8');
        px(37, wy, 2, 1, '#c084fc');
        if (wy >= 19) px(42, wy, 3, 1, '#38bdf8');
      }

      // Illuminated fiber-optic transit boulevard
      px(0, 35, 48, 13, '#0b1224');
      px(0, 35, 48, 1, '#38bdf8');
      px(0, 36, 48, 1, '#1d4ed8');
      px(4, 40, 12, 1, '#38bdf8');
      px(26, 42, 16, 1, '#a855f7');
      break;
    }

    case 'orbital': {
      // Deep space cosmos with twinkling stars & curved glowing planet limb
      px(0, 0, 48, 22, '#060b1c');
      ditherBand(22, 3, '#060b1c', '#0d1b3d');
      px(0, 25, 48, 10, '#0d1b3d');

      // Multi-tinted starfield
      const stars: Array<[number, number, string]> = [
        [4, 4, '#ffffff'],
        [12, 7, '#bae6fd'],
        [20, 3, '#fde047'],
        [34, 5, '#ffffff'],
        [43, 8, '#e0f2fe'],
        [7, 15, '#ffffff'],
        [39, 14, '#fef08a'],
        [44, 21, '#bae6fd'],
        [3, 23, '#93c5fd'],
      ];
      for (const [sx, sy, sc] of stars) px(sx, sy, 1, 1, sc);
      // 4-point bright star glint
      px(34, 4, 1, 3, '#ffffff');
      px(33, 5, 3, 1, '#ffffff');

      // Curved planet limb with turquoise atmospheric rim & continents
      circle(24, 62, 32, '#a5f3fc'); // outer atmosphere glow
      circle(24, 63, 31, '#38bdf8'); // upper atmosphere
      circle(24, 65, 31, '#155e91'); // deep ocean
      // Orbital continents & cloud swirls
      px(7, 38, 10, 4, '#2ea043');
      px(9, 37, 6, 2, '#4ade80');
      px(30, 39, 11, 5, '#2ea043');
      px(33, 38, 6, 2, '#4ade80');
      px(14, 34, 8, 2, '#e0f2fe');
      px(27, 35, 7, 1, '#ffffff');
      break;
    }

    case 'interstellar': {
      // Deep galactic cosmos with diagonal magenta-violet-gold nebula & ringed world
      px(0, 0, 48, 48, '#060817');

      // Diagonal layered nebula band
      for (let i = 0; i < 48; i++) {
        const cy = 34 - Math.floor(i * 0.48);
        px(i, cy - 8, 1, 16, '#1a1038');
        px(i, cy - 5, 1, 10, '#301654');
        px(i, cy - 2, 1, 5, '#54206b');
        if (i % 2 === 0) px(i, cy, 1, 2, '#823285');
      }

      // Dense twinkling starfield
      const stars: Array<[number, number, string]> = [
        [4, 5, '#ffffff'],
        [11, 3, '#fde047'],
        [19, 8, '#c4b5fd'],
        [37, 4, '#f9a8d4'],
        [43, 11, '#ffffff'],
        [5, 21, '#7dd3fc'],
        [9, 39, '#ffffff'],
        [17, 43, '#fde047'],
        [42, 24, '#bae6fd'],
        [31, 42, '#c4b5fd'],
      ];
      for (const [sx, sy, sc] of stars) px(sx, sy, 1, 1, sc);

      // Ringed golden gas giant in bottom-right
      circle(38, 37, 5.2, '#b45309');
      circle(37, 36, 3.8, '#f59e0b');
      circle(36, 35, 2.0, '#fde68a');
      // Tilted planetary ring
      for (let rx = -8; rx <= 8; rx++) {
        const ry = Math.round(rx * 0.3);
        px(38 + rx, 37 + ry, 1, 1, rx % 2 === 0 ? '#fef08a' : '#fbbf24');
      }
      break;
    }
  }

  // --- 2. Foreground Crisp, Finely Shaded Pixel Age Emblem (Centered) ---
  const paintEmblem = (pixels: Array<[number, number, number, number, string]>) => {
    // Crisp 1px dark silhouette halo behind emblem so it reads cleanly over scenery
    for (const [x, y, w, h] of pixels) {
      px(x - 1, y, w + 2, h, '#120a07');
      px(x, y - 1, w, h + 2, '#120a07');
    }
    for (const [x, y, w, h, c] of pixels) {
      px(x, y, w, h, c);
    }
  };

  switch (epochId) {
    case 'prehistoric': {
      // Stone-ringed crackling bonfire with crossed logs, layered tongues & rising sparks
      paintEmblem([
        // Hearth stones
        [13, 35, 4, 3, '#6b7280'],
        [14, 35, 2, 1, '#9ca3af'],
        [31, 35, 4, 3, '#6b7280'],
        [32, 35, 2, 1, '#9ca3af'],
        // Crossed charred oak logs
        [15, 33, 18, 4, '#5c2e16'],
        [17, 32, 14, 2, '#8a4824'],
        [18, 35, 12, 2, '#3d1c0c'],
        // Outer crimson-orange flame body
        [16, 23, 16, 10, '#dc2626'],
        [17, 19, 14, 13, '#ea580c'],
        [19, 15, 10, 15, '#f97316'],
        [21, 11, 6, 8, '#f97316'],
        [23, 9, 2, 4, '#fb923c'],
        // Inner golden-yellow heart
        [19, 22, 10, 9, '#facc15'],
        [21, 17, 6, 11, '#facc15'],
        [23, 14, 2, 5, '#fde047'],
        // White-hot core
        [21, 24, 6, 6, '#fef9c3'],
        [22, 21, 4, 7, '#ffffff'],
        // Floating embers
        [16, 12, 2, 2, '#fde047'],
        [31, 14, 2, 2, '#fb923c'],
        [27, 9, 1, 2, '#fef08a'],
      ]);
      break;
    }

    case 'bronze': {
      // Horned bronze anvil with beveled metallic shine + forged hammer & sparks
      paintEmblem([
        // Anvil base & pedestal
        [15, 33, 18, 4, '#784116'],
        [16, 33, 16, 1, '#b56c2a'],
        [18, 28, 12, 5, '#9a541d'],
        [19, 28, 5, 5, '#bd6e2a'],
        // Anvil body & tapered horn
        [11, 21, 26, 7, '#cc7d2e'],
        [9, 21, 6, 4, '#e39a42'],
        [7, 21, 4, 2, '#f5bc62'],
        [13, 21, 23, 2, '#fde08a'], // gleaming top face
        [14, 23, 21, 1, '#e8a246'],
        [28, 24, 8, 3, '#9a541d'], // right heel shadow
        // Forging hammer poised above
        [20, 10, 11, 6, '#e59d40'],
        [21, 10, 9, 2, '#fff0b8'],
        [29, 11, 2, 4, '#9a541d'],
        [23, 16, 3, 5, '#6e3a1c'], // wood handle
        [24, 16, 1, 5, '#9e5a31'],
        // Forge sparks
        [14, 14, 2, 2, '#fef08a'],
        [17, 17, 1, 1, '#ffffff'],
        [34, 15, 2, 2, '#fde047'],
      ]);
      break;
    }

    case 'medieval': {
      // Ornate gold-rimmed heraldic heater shield + gleaming silver broadsword
      paintEmblem([
        // Shield outer gold rim
        [13, 13, 22, 14, '#d97706'],
        [14, 27, 20, 4, '#b45309'],
        [16, 31, 16, 3, '#b45309'],
        [19, 34, 10, 3, '#92400e'],
        [22, 37, 4, 2, '#78350f'],
        // Shield bevel highlight
        [14, 13, 20, 1, '#fde047'],
        [13, 14, 1, 13, '#fbbf24'],
        // Crimson heraldic field (quartered subtle shading)
        [15, 15, 18, 12, '#b91c1c'],
        [16, 27, 16, 4, '#991b1b'],
        [18, 31, 12, 3, '#991b1b'],
        [21, 34, 6, 2, '#7f1d1d'],
        [15, 15, 9, 10, '#dc2626'], // top-left bright quarter
        [24, 24, 9, 3, '#dc2626'],
        // Broadsword blade with specular edge & fuller
        [22, 7, 4, 25, '#cbd5e1'],
        [22, 7, 2, 24, '#ffffff'],
        [23, 6, 2, 2, '#ffffff'],
        [24, 10, 1, 18, '#94a3b8'],
        // Ornate golden crossguard
        [17, 20, 14, 3, '#f59e0b'],
        [18, 20, 12, 1, '#fef08a'],
        [16, 21, 2, 2, '#d97706'],
        [30, 21, 2, 2, '#d97706'],
        // Leather grip & ruby pommel
        [23, 32, 2, 5, '#5c2e16'],
        [22, 37, 4, 3, '#f59e0b'],
        [23, 38, 2, 1, '#ef4444'],
      ]);
      break;
    }

    case 'industrial': {
      // Intricate 8-tooth burnished brass steam gear with spokes & steel hub
      paintEmblem([
        // Cardinal gear teeth
        [21, 8, 6, 32, '#c77c32'],
        [8, 21, 32, 6, '#c77c32'],
        // Diagonal teeth
        [12, 12, 6, 6, '#b86d28'],
        [30, 12, 6, 6, '#b86d28'],
        [12, 30, 6, 6, '#b86d28'],
        [30, 30, 6, 6, '#b86d28'],
        // Main brass rim
        [14, 14, 20, 20, '#e59f47'],
        [15, 13, 18, 22, '#e59f47'],
        [13, 15, 22, 18, '#e59f47'],
        // Top-left metallic gleam
        [15, 14, 14, 2, '#fef0c7'],
        [14, 15, 2, 14, '#fad596'],
        [22, 9, 4, 2, '#fef0c7'],
        // Recessed inner wheel well
        [17, 17, 14, 14, '#5e3920'],
        // Inner spokes
        [22, 17, 4, 14, '#d98e3b'],
        [17, 22, 14, 4, '#d98e3b'],
        // Center axle boss & dark bore
        [20, 20, 8, 8, '#f5c77e'],
        [21, 21, 6, 6, '#c77c32'],
        [22, 22, 4, 4, '#241812'],
        // Rivet highlights
        [16, 16, 1, 1, '#fff7d6'],
        [31, 16, 1, 1, '#fff7d6'],
        [16, 31, 1, 1, '#fff7d6'],
        [31, 31, 1, 1, '#fff7d6'],
      ]);
      break;
    }

    case 'atomic': {
      // Luminous orbital atom with criss-cross rings, radiant golden nucleus & electrons
      paintEmblem([
        // Vertical & horizontal orbit ellipses
        [22, 8, 4, 32, '#0284c7'],
        [8, 22, 32, 4, '#0284c7'],
        [14, 14, 20, 20, '#38bdf8'],
        [16, 16, 16, 16, '#0f2940'],
        // Diagonal orbit arcs
        [13, 13, 4, 4, '#7dd3fc'],
        [31, 13, 4, 4, '#7dd3fc'],
        [13, 31, 4, 4, '#7dd3fc'],
        [31, 31, 4, 4, '#7dd3fc'],
        [23, 9, 2, 30, '#bae6fd'],
        [9, 23, 30, 2, '#bae6fd'],
        // Inner dark ring cutout
        [18, 18, 12, 12, '#0c2236'],
        // Blazing golden-white nucleus
        [20, 20, 8, 8, '#f59e0b'],
        [21, 21, 6, 6, '#fde047'],
        [22, 22, 4, 4, '#ffffff'],
        // Orbiting bright cyan-white electrons
        [12, 12, 3, 3, '#e0f2fe'],
        [33, 12, 3, 3, '#e0f2fe'],
        [12, 33, 3, 3, '#e0f2fe'],
        [33, 33, 3, 3, '#e0f2fe'],
      ]);
      break;
    }

    case 'information': {
      // Gold-pinned silicon microchip with circuit traces & iridescent cyan die
      paintEmblem([
        // Gold pins on all 4 sides (3 per side)
        [17, 8, 2, 5, '#f59e0b'],
        [23, 8, 2, 5, '#fbbf24'],
        [29, 8, 2, 5, '#f59e0b'],
        [17, 35, 2, 5, '#f59e0b'],
        [23, 35, 2, 5, '#fbbf24'],
        [29, 35, 2, 5, '#f59e0b'],
        [8, 17, 5, 2, '#f59e0b'],
        [8, 23, 5, 2, '#fbbf24'],
        [8, 29, 5, 2, '#f59e0b'],
        [35, 17, 5, 2, '#f59e0b'],
        [35, 23, 5, 2, '#fbbf24'],
        [35, 29, 5, 2, '#f59e0b'],
        // Package chassis
        [13, 13, 22, 22, '#1d4ed8'],
        [14, 14, 20, 20, '#0f172a'],
        [14, 14, 20, 1, '#60a5fa'],
        // Circuit traces
        [17, 16, 1, 16, '#1e40af'],
        [30, 16, 1, 16, '#1e40af'],
        [16, 17, 16, 1, '#1e40af'],
        [16, 30, 16, 1, '#1e40af'],
        // Glowing silicon core die
        [18, 18, 12, 12, '#0284c7'],
        [19, 19, 10, 10, '#38bdf8'],
        [21, 21, 6, 6, '#e0f2fe'],
        [22, 22, 3, 3, '#ffffff'],
      ]);
      break;
    }

    case 'orbital': {
      // Sleek retro-sci-fi launch rocket with shaded hull, porthole & thruster blaze
      paintEmblem([
        // Crimson nosecone
        [23, 6, 2, 3, '#ef4444'],
        [22, 9, 4, 3, '#dc2626'],
        [22, 9, 2, 3, '#f87171'],
        // Shaded white fuselage
        [20, 12, 8, 17, '#cbd5e1'],
        [20, 12, 5, 17, '#f8fafc'],
        [21, 12, 2, 16, '#ffffff'],
        [26, 13, 2, 16, '#94a3b8'],
        // Glowing blue cockpit viewport
        [22, 16, 4, 4, '#0284c7'],
        [23, 17, 2, 2, '#7dd3fc'],
        [23, 17, 1, 1, '#ffffff'],
        // Crimson stripe & swept booster fins
        [20, 26, 8, 2, '#dc2626'],
        [15, 24, 5, 7, '#b91c1c'],
        [16, 25, 3, 4, '#ef4444'],
        [28, 24, 5, 7, '#b91c1c'],
        [29, 25, 3, 4, '#ef4444'],
        // Engine bell & blazing plasma plume
        [21, 29, 6, 2, '#475569'],
        [21, 31, 6, 4, '#f97316'],
        [22, 32, 4, 6, '#facc15'],
        [23, 33, 2, 7, '#fffbeb'],
      ]);
      break;
    }

    case 'interstellar': {
      // Radiant 8-point Golden Dyson Starburst with nested celestial ring
      paintEmblem([
        // Long cardinal starburst rays
        [23, 6, 2, 36, '#d97706'],
        [6, 23, 36, 2, '#d97706'],
        [22, 10, 4, 28, '#f59e0b'],
        [10, 22, 28, 4, '#f59e0b'],
        // Diagonal rays
        [13, 13, 5, 5, '#fbbf24'],
        [30, 13, 5, 5, '#fbbf24'],
        [13, 30, 5, 5, '#fbbf24'],
        [30, 30, 5, 5, '#fbbf24'],
        // Golden Dyson ring & luminous core
        [16, 16, 16, 16, '#fbbf24'],
        [18, 18, 12, 12, '#fde047'],
        [20, 20, 8, 8, '#fef9c3'],
        [22, 22, 4, 4, '#ffffff'],
        // Starburst tip glints
        [23, 7, 2, 3, '#fef08a'],
        [23, 38, 2, 3, '#fef08a'],
        [7, 23, 3, 2, '#fef08a'],
        [38, 23, 3, 2, '#fef08a'],
      ]);
      break;
    }
  }

  // --- 3. Subtle Inner Pixel Vignette ---
  px(0, 0, TILE_PX, 1, 'rgba(12,7,5,0.55)');
  px(0, TILE_PX - 1, TILE_PX, 1, 'rgba(12,7,5,0.65)');
  px(0, 0, 1, TILE_PX, 'rgba(12,7,5,0.55)');
  px(TILE_PX - 1, 0, 1, TILE_PX, 'rgba(12,7,5,0.65)');

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

  // Trigger timeline phases & particle burst synchronized to the astrolabe zenith lock-in
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

      // Explode crisp pixel-art sparks from the left-side half-circle dial & across the text!
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

      // 1. High-energy radial pixel spark explosion around the half-circle dial zenith
      for (let i = 0; i < 56; i++) {
        const angle = (i / 56) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const speed = 135 + Math.random() * 255;
        burst.push({
          x: dialOriginX + (Math.random() - 0.5) * 28,
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

  const counterPhaseClass =
    phase === 'spinning'
      ? 'age-dial-counter-rotate'
      : phase === 'impact'
        ? 'age-dial-counter-impact'
        : phase === 'enter'
          ? 'age-dial-counter-ready'
          : 'age-dial-counter-settled';

  return (
    <div
      key={event.id}
      data-testid="age-progress-banner"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[48] flex items-start justify-center pt-[76px] sm:pt-[72px] select-none ${
        phase === 'exit' ? 'age-banner-exit' : 'age-banner-enter'
      }`}
    >
      {/* Unified Horizontal HUD Plaque: Half-Circle Astrolabe Dial (Left) + Age Title (Right) */}
      <div className="relative flex items-center justify-center">
        {/* Crisp pixelated explosion particle canvas aligned to dial + title */}
        <canvas
          ref={canvasRef}
          width={580}
          height={260}
          className="pixelated-canvas pointer-events-none absolute left-1/2 -top-[52px] -translate-x-1/2 w-[580px] h-[260px] max-w-[100vw]"
        />

        <div
          className={`px-panel-hero pt-3.5 pb-2.5 pl-3 pr-4 sm:pt-4 sm:pb-3 sm:pl-4 sm:pr-7 flex flex-row items-center gap-3 sm:gap-4 min-w-[260px] sm:min-w-[320px] ${
            showNewText ? 'age-text-slam' : ''
          }`}
        >
          {/* LEFT: Half-Circle Celestial Time-Wheel Dial (Astrolabe Age Transition) */}
          <div className="relative shrink-0 w-[108px] h-[62px] sm:w-[122px] sm:h-[70px] [--dial-r:31px] sm:[--dial-r:35px]">
            {/* Semicircular Clipped Celestial Viewport */}
            <div
              className="relative w-full h-full rounded-t-full overflow-hidden border-t-[3px] border-x-[3px] border-b-[3px] border-[#0c0705]"
              style={{
                background:
                  'radial-gradient(circle at 50% 100%, #3d281d 0%, #241610 56%, #130b08 100%)',
                boxShadow:
                  'inset 0 2px 0 rgba(247,210,166,0.45), inset 0 0 12px rgba(0,0,0,0.75), 0 3px 0 rgba(10,6,4,0.75)',
              }}
            >
              {/* Static Astrolabe Outer Arc Rings, Degree Ticks & Starfield */}
              <svg
                viewBox="0 0 122 70"
                className="pointer-events-none absolute inset-0 w-full h-full"
                aria-hidden="true"
              >
                {/* Tiny cosmic background stars */}
                <rect x="24" y="22" width="1.5" height="1.5" fill="#fff7d6" opacity="0.7" />
                <rect x="96" y="20" width="1.5" height="1.5" fill="#f7d2a6" opacity="0.75" />
                <rect x="16" y="42" width="1.5" height="1.5" fill="#fde68a" opacity="0.5" />
                <rect x="104" y="40" width="1.5" height="1.5" fill="#fff7d6" opacity="0.55" />
                <rect x="44" y="14" width="1" height="1" fill="#ffffff" opacity="0.6" />
                <rect x="78" y="13" width="1" height="1" fill="#ffffff" opacity="0.6" />

                {/* Concentric golden astrolabe arcs */}
                <path
                  d="M 5 68 A 56 56 0 0 1 117 68"
                  fill="none"
                  stroke="#d99968"
                  strokeWidth="1.5"
                  opacity="0.85"
                />
                <path
                  d="M 11 68 A 50 50 0 0 1 111 68"
                  fill="none"
                  stroke="#f7d2a6"
                  strokeWidth="0.9"
                  strokeDasharray="2 3"
                  opacity="0.65"
                />
                <path
                  d="M 27 68 A 34 34 0 0 1 95 68"
                  fill="none"
                  stroke="#a66b44"
                  strokeWidth="1"
                  opacity="0.55"
                />

                {/* Radial clockwork degree ticks around the 180° arch */}
                {[-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75].map((deg) => {
                  const rad = ((deg - 90) * Math.PI) / 180;
                  const isMajor = deg % 30 === 0;
                  const rOuter = 56;
                  const rInner = isMajor ? 49.5 : 52;
                  const x1 = 61 + Math.cos(rad) * rInner;
                  const y1 = 68 + Math.sin(rad) * rInner;
                  const x2 = 61 + Math.cos(rad) * rOuter;
                  const y2 = 68 + Math.sin(rad) * rOuter;
                  return (
                    <line
                      key={deg}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isMajor ? '#ffe49e' : '#d99968'}
                      strokeWidth={isMajor ? 1.4 : 0.9}
                      opacity={isMajor ? 0.9 : 0.6}
                    />
                  );
                })}
              </svg>

              {/* Rotating Celestial Astrolabe Wheel (centered at bottom horizon: 50% 100%) */}
              <div
                className={`absolute left-1/2 bottom-0 w-0 h-0 ${wheelPhaseClass}`}
                style={{ willChange: 'transform' }}
              >
                {/* Rotating Golden Astrolabe Filigree Gear & Pointer Hand */}
                <svg
                  viewBox="-60 -60 120 120"
                  className="pointer-events-none absolute -left-[58px] -top-[58px] w-[116px] h-[116px]"
                  aria-hidden="true"
                >
                  {/* Orbiting dashed celestial ring */}
                  <circle
                    cx="0"
                    cy="0"
                    r="35"
                    fill="none"
                    stroke="#f7d2a6"
                    strokeWidth="1.2"
                    strokeDasharray="3 4"
                    opacity="0.5"
                  />
                  {/* Inner brass clockwork gear ring */}
                  <circle
                    cx="0"
                    cy="0"
                    r="21"
                    fill="none"
                    stroke="#d99968"
                    strokeWidth="1.5"
                    opacity="0.55"
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r="16"
                    fill="none"
                    stroke="#f7d2a6"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                    opacity="0.5"
                  />
                  {/* 12 Brass gear spokes / teeth */}
                  {Array.from({ length: 12 }).map((_, idx) => {
                    const a = (idx * 30 * Math.PI) / 180;
                    return (
                      <line
                        key={idx}
                        x1={Math.cos(a) * 16}
                        y1={Math.sin(a) * 16}
                        x2={Math.cos(a) * 24}
                        y2={Math.sin(a) * 24}
                        stroke="#f7d2a6"
                        strokeWidth="1.6"
                        opacity="0.55"
                      />
                    );
                  })}
                  {/* Opposing celestial arms connecting old age (top) and new age (bottom) */}
                  <line
                    x1="0"
                    y1="-34"
                    x2="0"
                    y2="34"
                    stroke="#ffe49e"
                    strokeWidth="1.2"
                    opacity="0.45"
                  />
                  {/* Center pivot jewel */}
                  <circle cx="0" cy="0" r="4" fill="#33241b" stroke="#f7d2a6" strokeWidth="1.5" />
                  <circle cx="0" cy="0" r="1.5" fill="#ffe49e" />
                </svg>

                {/* SLOT 1 (0° Zenith -> sets clockwise to right horizon): PREVIOUS AGE */}
                <div
                  className="absolute left-0 top-0"
                  style={{ transform: 'translate(-50%, calc(-50% - var(--dial-r)))' }}
                >
                  <div
                    className={`w-[42px] h-[42px] sm:w-[48px] sm:h-[48px] rounded-full overflow-hidden bg-[#2b1d15] border-[2.5px] border-[#0c0705] ${counterPhaseClass}`}
                    style={{
                      boxShadow:
                        'inset 0 0 0 2px #d99968, 0 0 0 1.5px #a66b44, 0 3px 6px rgba(0,0,0,0.7)',
                      willChange: 'transform',
                    }}
                  >
                    <img
                      src={fromUrl}
                      alt={fromEpoch.name}
                      className="pixelated-canvas w-full h-full block object-cover"
                    />
                  </div>
                </div>

                {/* SLOT 2 (180° Below Horizon -> rises from left horizon to 12 o'clock Zenith): NEXT AGE */}
                <div
                  className="absolute left-0 top-0"
                  style={{ transform: 'translate(-50%, calc(-50% + var(--dial-r)))' }}
                >
                  <div
                    className={`relative w-[42px] h-[42px] sm:w-[48px] sm:h-[48px] rounded-full overflow-hidden bg-[#2b1d15] border-[2.5px] border-[#0c0705] ${counterPhaseClass}`}
                    style={{
                      boxShadow:
                        'inset 0 0 0 2px #ffe49e, 0 0 0 1.5px #f7d2a6, 0 0 10px rgba(253,224,71,0.35), 0 3px 6px rgba(0,0,0,0.75)',
                      willChange: 'transform',
                    }}
                  >
                    <img
                      src={toUrl}
                      alt={toEpoch.name}
                      className="pixelated-canvas w-full h-full block object-cover"
                    />
                    {/* Crisp white-gold zenith lock-in flash */}
                    {phase === 'impact' && (
                      <div className="age-impact-flash pointer-events-none absolute inset-0 rounded-full bg-[#fff9db]" />
                    )}
                  </div>
                </div>
              </div>

              {/* Horizon Golden Rim Trim along the bottom edge */}
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
                boxShadow: '0 0 6px rgba(255,228,158,0.75)',
              }}
            />

            {/* Left & Right Horizon Astrolabe Nodes (like dawn/dusk markers) */}
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
