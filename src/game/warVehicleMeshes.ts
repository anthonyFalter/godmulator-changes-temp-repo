import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SpeciesId, VehicleType } from './types';

let cachedHullPanelTex: THREE.CanvasTexture | null = null;

function getHullPanelTexture(): THREE.CanvasTexture | null {
  if (cachedHullPanelTex) return cachedHullPanelTex;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // Subtle neutral white/grey armor-plating seam & rivet texture that multiplies cleanly with vertex colors
  ctx.fillStyle = '#e6e8ec';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = '#f5f7fa';
  ctx.fillRect(1, 1, 14, 14);
  ctx.fillRect(17, 1, 14, 14);
  ctx.fillRect(1, 17, 14, 14);
  ctx.fillRect(17, 17, 14, 14);
  // Crisp panel seam lines
  ctx.fillStyle = '#a8b0bc';
  ctx.fillRect(0, 0, 32, 1);
  ctx.fillRect(0, 16, 32, 1);
  ctx.fillRect(0, 0, 1, 32);
  ctx.fillRect(16, 0, 1, 32);
  // Subtle micro rivets in panel corners
  ctx.fillStyle = '#8b95a5';
  for (const [rx, ry] of [
    [2, 2], [13, 2], [2, 13], [13, 13],
    [18, 2], [29, 2], [18, 13], [29, 13],
    [2, 18], [13, 18], [2, 29], [13, 29],
    [18, 18], [29, 18], [18, 29], [29, 29],
  ]) {
    ctx.fillRect(rx, ry, 1, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedHullPanelTex = tex;
  return tex;
}

function pushBox(
  parts: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  hex: number,
  rx = 0,
  ry = 0,
  rz = 0,
): void {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx !== 0) g.rotateX(rx);
  if (ry !== 0) g.rotateY(ry);
  if (rz !== 0) g.rotateZ(rz);
  g.translate(x, y, z);
  const pos = g.getAttribute('position');
  const col = new THREE.Color(hex);
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  parts.push(g);
}

/** Twin-barrel armored gun turret with barbette base & elevated barrels */
function addTurret(
  body: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  scale: number,
  hullHex: number,
  barrelHex: number,
  yaw = 0,
): void {
  const s = scale;
  pushBox(body, 0.44 * s, 0.16 * s, 0.44 * s, x, y + 0.08 * s, z, hullHex, 0, yaw, 0);
  pushBox(body, 0.34 * s, 0.20 * s, 0.42 * s, x, y + 0.24 * s, z, hullHex, 0, yaw, 0);
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  for (const side of [-0.09, 0.09]) {
    const bx = x + side * s * cos + 0.36 * s * sin;
    const bz = z - side * s * sin + 0.36 * s * cos;
    pushBox(body, 0.065 * s, 0.065 * s, 0.56 * s, bx, y + 0.27 * s, bz, barrelHex, -0.08, yaw, 0);
  }
}

/** Detailed micro-fighter parked on a carrier flight deck */
function addParkedFighter(
  body: THREE.BufferGeometry[],
  glow: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  wingHex: number,
  fuselageHex: number,
  glowHex: number,
  yaw = 0.12,
): void {
  pushBox(body, 0.16, 0.11, 0.68, x, y + 0.07, z, fuselageHex, 0, yaw, 0);
  pushBox(body, 0.64, 0.04, 0.24, x, y + 0.06, z - 0.04, wingHex, 0, yaw, 0);
  pushBox(body, 0.28, 0.03, 0.12, x, y + 0.07, z - 0.26, wingHex, 0, yaw, 0);
  pushBox(body, 0.04, 0.14, 0.14, x, y + 0.14, z - 0.26, fuselageHex, 0, yaw, 0);
  pushBox(glow, 0.08, 0.06, 0.16, x, y + 0.13, z + 0.12, glowHex, 0, yaw, 0);
}

/** Glowing vertical/horizontal thruster nacelle pod */
function addThrusterPod(
  body: THREE.BufferGeometry[],
  glow: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  casingHex: number,
  trimHex: number,
  glowHex: number,
): void {
  // Octagonal-style armored shroud built from crossed boxes
  pushBox(body, radius * 2.0, height, radius * 1.4, x, y, z, casingHex);
  pushBox(body, radius * 1.4, height, radius * 2.0, x, y, z, casingHex);
  pushBox(body, radius * 2.1, height * 0.22, radius * 1.5, x, y + height * 0.42, z, trimHex);
  pushBox(body, radius * 1.5, height * 0.22, radius * 2.1, x, y + height * 0.42, z, trimHex);
  // Central glowing turbine core visible from top & bottom
  pushBox(glow, radius * 1.15, height * 1.06, radius * 1.15, x, y, z, glowHex);
}

/** Horizontal row of glowing bridge/deck window ports */
function addWindowRow(
  glow: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  count: number,
  spacing: number,
  alongZ: boolean,
  hex: number,
): void {
  const half = ((count - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) {
    const off = -half + i * spacing;
    pushBox(
      glow,
      alongZ ? 0.08 : 0.14,
      0.10,
      alongZ ? 0.14 : 0.08,
      alongZ ? x : x + off,
      y,
      alongZ ? z + off : z,
      hex,
    );
  }
}

function finalizeGroup(
  bodyParts: THREE.BufferGeometry[],
  glowParts: THREE.BufferGeometry[],
  metalness = 0.44,
  roughness = 0.48,
  glowHex = 0x38bdf8,
): THREE.Group {
  const group = new THREE.Group();
  const hullTex = getHullPanelTexture();
  if (bodyParts.length > 0) {
    const merged = mergeGeometries(bodyParts, false);
    for (const g of bodyParts) g.dispose();
    if (merged) {
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: hullTex,
        roughness,
        metalness,
      });
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  if (glowParts.length > 0) {
    const mergedGlow = mergeGeometries(glowParts, false);
    for (const g of glowParts) g.dispose();
    if (mergedGlow) {
      const glowMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        emissive: new THREE.Color(glowHex),
        emissiveIntensity: 1.45,
        roughness: 0.2,
        metalness: 0.12,
      });
      const glowMesh = new THREE.Mesh(mergedGlow, glowMat);
      group.add(glowMesh);
    }
  }
  return group;
}

/**
 * Builds monumental, Mothership-grade, race-unique 3D war vehicles (~1/2 Alien Mothership scale)
 * for Sea, Land, Air, and Orbital eras — collapsed into only 2 merged draw calls per capital ship!
 */
export function createCapitalWarVehicleGroup(
  type: VehicleType,
  epochLevel: number,
  species: SpeciesId,
): THREE.Group | null {
  const e = Math.max(3, epochLevel);
  const body: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const raceGlow =
    species === 'elf'
      ? 0xc084fc
      : species === 'orc'
        ? 0xff5722
        : species === 'dwarf'
          ? 0xf59e0b
          : species === 'lizardfolk'
            ? 0x34d399
            : 0x38bdf8;

  // =========================================================================
  // 1. AIRCRAFT CARRIER (Sea, Epoch 3+) — ~7.8 to 8.8 tiles long!
  // =========================================================================
  if (type === 'aircraft_carrier') {
    const sc = e >= 6 ? 1.12 : e >= 5 ? 1.06 : 1.0;
    if (species === 'elf') {
      // Twin-outrigger ivory catamaran supercarrier with crescent launch deck, crystal spire & golden sails
      for (const side of [-1, 1]) {
        pushBox(body, 0.85, 0.72, 7.6, side * 1.25, 0.34, 0, 0xede7d5);
        pushBox(body, 0.62, 0.56, 1.4, side * 1.25, 0.38, 4.15, 0xd4af37); // gilded swan-prows
        pushBox(body, 0.32, 0.42, 0.9, side * 1.25, 0.42, 4.95, 0xf8f5eb);
        // Structural ribs along hulls
        for (let ri = -3; ri <= 3; ri++) {
          pushBox(body, 0.96, 0.32, 0.18, side * 1.25, 0.52, ri * 0.95, 0xd4af37);
        }
      }
      // Sweeping elevated ivory & emerald flight deck
      pushBox(body, 3.65, 0.24, 7.2, 0, 0.86, -0.1, 0xf5f1e4);
      pushBox(body, 2.75, 0.20, 1.35, 0, 0.88, 3.85, 0xede7d5);
      pushBox(body, 0.26, 0.04, 6.8, 0, 1.0, 0.1, 0xd4af37); // golden launch centerline
      pushBox(glow, 0.14, 0.05, 6.4, -0.68, 1.0, 0.15, 0x38bdf8); // crystal catapult rails
      pushBox(glow, 0.14, 0.05, 6.4, 0.68, 1.0, 0.15, 0xc084fc);
      // Tall starboard crystal spire bridge tower
      pushBox(body, 0.72, 1.35, 1.85, 1.42, 1.62, -0.75, 0xf8f5eb);
      pushBox(body, 0.52, 0.88, 1.18, 1.42, 2.65, -0.82, 0xede7d5);
      pushBox(body, 0.28, 0.92, 0.36, 1.42, 3.45, -0.85, 0xd4af37);
      pushBox(glow, 0.34, 0.54, 0.34, 1.42, 4.05, -0.85, 0xc084fc);
      addWindowRow(glow, 1.04, 1.85, -0.75, 4, 0.36, true, 0xfef08a);
      addTurret(body, -1.68, 0.96, 2.2, 0.95, 0xd4af37, 0xf8fafc, -0.4);
      addTurret(body, -1.68, 0.96, -2.1, 0.95, 0xd4af37, 0xf8fafc, -2.4);
      for (const zf of [-2.4, -1.0, 0.4, 1.8, 3.0]) {
        addParkedFighter(body, glow, -0.62, 1.0, zf, 0xd4af37, 0xf8f5eb, 0xc084fc, 0.15);
      }
    } else if (species === 'orc') {
      // Colossal riveted scrap-iron flat-top hulk with spiked ram-jaw prow, ski-jump ramp & belching stacks
      pushBox(body, 3.15, 0.96, 7.6, 0, 0.42, -0.15, 0x3b3532);
      pushBox(body, 3.85, 0.28, 7.1, -0.12, 1.0, -0.1, 0x4d4540);
      // Heavy bolted armor sponsons & ribs
      for (const side of [-1, 1]) {
        pushBox(body, 0.58, 0.64, 5.2, side * 1.85, 0.54, 0, 0x2c2826);
        for (let ri = -2; ri <= 2; ri++) {
          pushBox(body, 0.24, 0.84, 0.24, side * 2.12, 0.52, ri * 1.1, 0x71717a);
        }
      }
      // Jagged crimson ram-prow & massive iron tusks
      pushBox(body, 2.65, 0.56, 1.25, 0, 0.62, 4.05, 0x991b1b);
      for (const tx of [-1.05, -0.38, 0.38, 1.05]) {
        pushBox(body, 0.24, 0.34, 1.15, tx, 0.48, 4.95, 0xa1a1aa);
      }
      // Steep iron ski-jump bow ramp
      pushBox(body, 2.35, 0.24, 1.75, -0.35, 1.26, 3.25, 0x574c45, -0.24, 0, 0);
      // Starboard armored skull-citadel island + twin roaring furnace smokestacks
      pushBox(body, 0.92, 1.55, 2.35, 1.38, 1.82, -0.95, 0x5c2b22);
      pushBox(body, 0.72, 0.68, 1.45, 1.38, 2.84, -1.05, 0x3b3532);
      pushBox(body, 0.38, 1.45, 0.38, 1.52, 3.25, -0.45, 0x1f1c1a);
      pushBox(body, 0.38, 1.25, 0.38, 1.52, 3.15, -1.45, 0x1f1c1a);
      pushBox(glow, 0.36, 0.24, 0.36, 1.52, 4.02, -0.45, 0xff5722);
      pushBox(glow, 0.36, 0.24, 0.36, 1.52, 3.82, -1.45, 0xff5722);
      addWindowRow(glow, 0.9, 2.25, -0.95, 4, 0.42, true, 0xff7043);
      addTurret(body, -1.85, 1.05, 1.8, 1.15, 0x991b1b, 0x18181b, -0.5);
      addTurret(body, -1.85, 1.05, -2.0, 1.15, 0x991b1b, 0x18181b, -2.3);
      for (const zf of [-2.2, -0.7, 0.8, 2.2]) {
        addParkedFighter(body, glow, -0.68, 1.14, zf, 0xb91c1c, 0x3f3a36, 0xff5722, 0.18);
      }
    } else if (species === 'dwarf') {
      // Heavy twin-hull bronze-and-ironclad forge carrier with armored blast-doors, runic prow & furnace stacks
      pushBox(body, 3.55, 0.98, 7.4, 0, 0.44, 0, 0x334155);
      pushBox(body, 4.05, 0.28, 7.1, 0, 1.02, 0, 0x475569);
      // Heavy gilded runic prow-beard & bronze belt trim
      pushBox(body, 3.05, 0.88, 1.15, 0, 0.56, 4.1, 0xb45309);
      pushBox(body, 4.15, 0.18, 0.52, 0, 1.06, 3.45, 0xd97706);
      for (const side of [-1, 1]) {
        pushBox(body, 0.32, 0.28, 6.8, side * 1.96, 0.72, 0, 0xd97706);
        for (let ri = -3; ri <= 3; ri++) {
          pushBox(body, 0.42, 0.82, 0.28, side * 1.86, 0.48, ri * 0.98, 0x64748b);
        }
      }
      // Armored fortress bridge with glowing forge grates & twin brass chimneys
      pushBox(body, 1.12, 1.48, 2.55, 1.42, 1.82, -0.65, 0x334155);
      pushBox(body, 1.18, 0.22, 2.65, 1.42, 2.62, -0.65, 0xd97706);
      pushBox(body, 0.42, 1.05, 0.42, 1.48, 3.22, -0.15, 0xb45309);
      pushBox(body, 0.42, 1.05, 0.42, 1.48, 3.22, -1.15, 0xb45309);
      pushBox(glow, 0.26, 0.52, 1.65, 0.82, 1.72, -0.65, 0xf59e0b);
      addWindowRow(glow, 1.42, 2.32, 0.66, 3, 0.32, false, 0xfbbf24);
      addTurret(body, -1.75, 1.12, 2.35, 1.1, 0xb45309, 0x1e293b, -0.35);
      addTurret(body, -1.75, 1.12, -2.35, 1.1, 0xb45309, 0x1e293b, -2.4);
      for (const zf of [-2.4, -0.9, 0.6, 2.1]) {
        addParkedFighter(body, glow, -0.55, 1.16, zf, 0xd97706, 0x475569, 0xf59e0b, 0.08);
      }
    } else if (species === 'lizardfolk') {
      // Monumental obsidian & gold stepped-temple sea ark with emerald sun-crystal ziggurat bridge
      pushBox(body, 3.45, 0.92, 7.6, 0, 0.42, 0, 0x1e293b);
      pushBox(body, 3.92, 0.28, 7.2, 0, 0.98, 0, 0x334155);
      pushBox(body, 4.04, 0.12, 7.32, 0, 1.14, 0, 0xd4af37); // golden temple deck rim
      for (const side of [-1, 1]) {
        for (let ri = -3; ri <= 3; ri++) {
          pushBox(body, 0.34, 0.68, 0.32, side * 1.88, 0.52, ri * 1.02, 0xca8a04);
        }
      }
      // Stepped ziggurat command island crowned with glowing emerald sun-crystal
      pushBox(body, 1.24, 0.56, 2.35, 1.28, 1.44, -0.75, 0x1e293b);
      pushBox(body, 0.92, 0.54, 1.72, 1.28, 1.98, -0.75, 0xca8a04);
      pushBox(body, 0.62, 0.52, 1.12, 1.28, 2.50, -0.75, 0x1f2937);
      pushBox(glow, 0.44, 0.82, 0.44, 1.28, 3.16, -0.75, 0x34d399);
      pushBox(glow, 0.22, 0.05, 6.2, -0.58, 1.20, 0.15, 0x34d399);
      addTurret(body, -1.78, 1.18, 2.2, 1.0, 0xca8a04, 0x1e293b, -0.4);
      addTurret(body, -1.78, 1.18, -2.2, 1.0, 0xca8a04, 0x1e293b, -2.5);
      for (const zf of [-2.3, -0.8, 0.7, 2.2]) {
        addParkedFighter(body, glow, -0.62, 1.22, zf, 0xfacc15, 0x1e293b, 0x34d399, 0.14);
      }
    } else {
      // HUMAN: Monumental angled flat-top naval supercarrier with white/amber runway markings, island, radar & 5 jets
      const hullHex = e >= 5 ? 0x3b4856 : 0x52606d;
      const deckHex = e >= 5 ? 0x26303c : 0x374350;
      pushBox(body, 2.95, 0.96, 7.9, 0, 0.44, 0, hullHex);
      pushBox(body, 2.25, 0.78, 1.25, 0, 0.42, 4.2, hullHex); // tapered bow
      pushBox(body, 3.95, 0.26, 7.6, -0.18, 1.02, 0, deckHex); // wide cantilevered flight deck
      // Flared angled landing-strip sponson on port side
      pushBox(body, 1.15, 0.24, 4.6, -2.02, 1.02, -0.45, deckHex, 0, 0.16, 0);
      // Structural ribs & under-deck hangar sponsons
      for (const side of [-1, 1]) {
        pushBox(body, 0.46, 0.56, 5.4, side * 1.62, 0.62, 0, 0x2c3540);
        for (let ri = -3; ri <= 3; ri++) {
          pushBox(body, 0.20, 0.72, 0.22, side * 1.82, 0.66, ri * 0.92, 0x64748b);
        }
      }
      // Crisp white & amber runway striping + catapult tracks
      pushBox(body, 0.14, 0.03, 6.8, -0.78, 1.17, 0.1, 0xf1f5f9);
      pushBox(body, 0.10, 0.03, 6.2, 0.25, 1.17, 0.3, 0xfbbf24);
      pushBox(body, 0.12, 0.03, 4.4, -1.68, 1.17, -0.4, 0xf1f5f9, 0, 0.16, 0);
      if (e >= 6) pushBox(glow, 0.14, 0.04, 6.6, -0.78, 1.18, 0.1, 0x38bdf8);
      // Multi-story starboard command island + radar mast + glowing bridge windows
      pushBox(body, 0.86, 1.38, 2.15, 1.38, 1.78, -0.85, 0x64748b);
      pushBox(body, 0.68, 0.62, 1.35, 1.38, 2.74, -0.92, 0x94a3b8);
      pushBox(body, 0.18, 1.25, 0.18, 1.38, 3.55, -0.96, 0xcbd5e1);
      pushBox(body, 0.92, 0.16, 0.12, 1.38, 3.92, -0.96, 0xe2e8f0); // rotating radar bar
      addWindowRow(glow, 0.94, 2.22, -0.85, 4, 0.36, true, 0xfef08a);
      addWindowRow(glow, 1.38, 2.78, -0.24, 3, 0.22, false, 0x38bdf8);
      // AA defense turrets & 5 parked carrier jets
      addTurret(body, -1.85, 1.12, 2.65, 0.92, 0x64748b, 0xcbd5e1, -0.35);
      addTurret(body, 1.65, 1.12, -3.25, 0.92, 0x64748b, 0xcbd5e1, 2.7);
      for (const [fx, fz] of [[-1.25, -2.3], [-1.15, -0.9], [-0.95, 0.5], [-0.75, 1.9], [0.42, 2.5]]) {
        addParkedFighter(body, glow, fx, 1.16, fz, 0x94a3b8, 0xe2e8f0, 0x38bdf8, 0.16);
      }
    }
    const g = finalizeGroup(body, glow, 0.46, 0.46, raceGlow);
    g.scale.setScalar(sc);
    return g;
  }

  // =========================================================================
  // 2. SUBMARINE (Sea, Epoch 3+) — ~5.4 to 6.0 tiles long!
  // =========================================================================
  if (type === 'submarine') {
    const sc = e >= 6 ? 1.1 : 1.0;
    if (species === 'elf') {
      // Wide sleek manta-ray bio-crystal submarine with swept pectoral hydrofoils & glowing crystal canopy
      pushBox(body, 1.55, 0.62, 5.2, 0, 0.24, 0, 0x1e3a5f);
      pushBox(body, 3.65, 0.20, 2.15, 0, 0.28, 0.35, 0x2b5978); // swept manta wings
      pushBox(body, 2.45, 0.16, 1.35, 0, 0.32, -1.45, 0x2b5978); // rear hydrofoils
      pushBox(body, 0.92, 0.42, 1.25, 0, 0.28, 2.85, 0xd4af37);
      pushBox(glow, 0.78, 0.46, 1.48, 0, 0.68, 0.35, 0x38bdf8); // crystal bridge dome
      pushBox(glow, 3.45, 0.08, 0.18, 0, 0.38, 0.55, 0xc084fc);
    } else if (species === 'orc') {
      // Massive riveted iron shark-jawed monster sub with jagged dorsal fin, twin torpedo pods & exhaust
      pushBox(body, 1.65, 0.78, 5.1, 0, 0.32, 0, 0x3f3a36);
      pushBox(body, 1.35, 0.66, 1.15, 0, 0.32, 2.85, 0x991b1b); // crimson shark nose
      for (const tx of [-0.52, 0, 0.52]) {
        pushBox(body, 0.18, 0.22, 0.46, tx, 0.24, 3.48, 0xe4e4e7); // iron shark teeth
      }
      pushBox(body, 0.52, 1.15, 1.35, 0, 1.02, 0.35, 0x2c2825); // jagged dorsal sail
      pushBox(body, 0.16, 0.75, 0.16, 0, 1.85, 0.52, 0x9ca3af); // periscope
      for (const side of [-1, 1]) {
        pushBox(body, 0.42, 0.42, 1.95, side * 0.98, 0.34, 1.25, 0x57534e); // torpedo tubes
        pushBox(glow, 0.18, 0.18, 0.12, side * 0.98, 0.34, 2.26, 0xff5722);
      }
      pushBox(glow, 0.64, 0.28, 0.16, 0, 0.38, -2.62, 0xff5722);
    } else if (species === 'dwarf') {
      // Broad armored iron-beetle bathyscaphe with twin brass ballast tanks, rotary drill-prow & cupola
      pushBox(body, 1.95, 0.84, 4.65, 0, 0.34, 0, 0x334155);
      for (const side of [-1, 1]) {
        pushBox(body, 0.62, 0.62, 3.85, side * 1.22, 0.28, -0.1, 0xb45309);
        for (let ri = -1; ri <= 1; ri++) {
          pushBox(body, 0.72, 0.72, 0.22, side * 1.22, 0.28, ri * 1.15, 0xd97706);
        }
      }
      pushBox(body, 1.05, 0.76, 1.05, 0, 0.36, 2.65, 0xd97706); // rotary brass drill nose
      pushBox(body, 0.58, 0.48, 0.65, 0, 0.36, 3.35, 0xf59e0b);
      pushBox(body, 1.02, 0.86, 1.38, 0, 1.04, 0.15, 0x475569); // armored cupola
      addWindowRow(glow, 0, 1.14, 0.85, 3, 0.28, false, 0xf59e0b);
    } else if (species === 'lizardfolk') {
      // Elongated crocodilian obsidian reef-sub with serrated golden dorsal ridge-plates & emerald eyes
      pushBox(body, 1.62, 0.68, 5.45, 0, 0.26, 0, 0x1e293b);
      pushBox(body, 1.18, 0.52, 1.35, 0, 0.24, 3.05, 0x0f172a);
      for (const zs of [-1.75, -0.85, 0.05, 0.95, 1.85]) {
        pushBox(body, 0.36, 0.58, 0.48, 0, 0.78, zs, 0xd4af37);
      }
      pushBox(body, 2.55, 0.16, 0.95, 0, 0.26, -2.05, 0x334155); // tail hydrofoils
      pushBox(glow, 0.28, 0.20, 0.28, -0.46, 0.46, 2.45, 0x34d399);
      pushBox(glow, 0.28, 0.20, 0.28, 0.46, 0.46, 2.45, 0x34d399);
      pushBox(glow, 0.20, 0.12, 3.6, 0, 0.62, 0.0, 0x34d399);
    } else {
      // HUMAN: Sleek nuclear/stealth submarine with segmented hull, diving planes, sail & twin periscopes
      const hullHex = e >= 5 ? 0x1e293b : 0x334155;
      pushBox(body, 1.48, 0.78, 5.55, 0, 0.32, 0, hullHex);
      pushBox(body, 1.12, 0.64, 1.05, 0, 0.32, 3.05, hullHex);
      pushBox(body, 0.62, 1.05, 1.48, 0, 1.04, 0.55, 0x475569); // conning tower sail
      pushBox(body, 1.88, 0.14, 0.52, 0, 1.04, 0.62, 0x64748b); // sail diving planes
      pushBox(body, 0.12, 0.78, 0.12, -0.10, 1.88, 0.72, 0xcbd5e1); // primary periscope
      pushBox(body, 0.10, 0.58, 0.10, 0.12, 1.78, 0.42, 0x94a3b8); // radar mast
      pushBox(body, 0.22, 0.78, 0.88, 0, 0.52, -2.55, 0x475569); // stern rudder
      pushBox(body, 1.75, 0.14, 0.58, 0, 0.32, -2.45, 0x64748b); // stern planes
      addWindowRow(glow, 0, 1.32, 1.30, 3, 0.18, false, 0x38bdf8);
    }
    const g = finalizeGroup(body, glow, 0.52, 0.40, raceGlow);
    g.scale.setScalar(sc);
    return g;
  }

  // =========================================================================
  // 3. SIEGE ARTILLERY (Land, Epoch 3+) — ~3.5 to 4.0 tiles long!
  // =========================================================================
  if (type === 'siege_artillery') {
    const sc = e >= 6 ? 1.12 : 1.0;
    if (species === 'elf') {
      // Tall quad-legged crystal prism-lance strider with floating golden focusing rings
      pushBox(body, 1.75, 0.72, 2.25, 0, 1.18, 0, 0xf3efe2);
      pushBox(body, 1.92, 0.16, 2.42, 0, 1.56, 0, 0xd4af37);
      for (const [lx, lz] of [[-1.05, 0.92], [1.05, 0.92], [-1.05, -0.92], [1.05, -0.92]]) {
        pushBox(body, 0.34, 1.25, 0.34, lx, 0.62, lz, 0xd4af37);
        pushBox(body, 0.52, 0.22, 0.52, lx, 0.11, lz, 0xede7d5);
      }
      pushBox(body, 0.56, 0.56, 3.25, 0, 1.95, 0.75, 0xf8f5eb, -0.26, 0, 0);
      pushBox(glow, 0.32, 0.32, 3.45, 0, 2.02, 0.82, 0xc084fc, -0.26, 0, 0);
    } else if (species === 'orc') {
      // Massive spiked iron doom-roller with giant front crush-drum, chained mega-cannon & smokestacks
      pushBox(body, 2.35, 0.88, 2.95, 0, 0.62, -0.18, 0x3f3a36);
      pushBox(body, 2.75, 0.78, 0.78, 0, 0.42, 1.55, 0x71717a); // giant front spiked roller
      for (const sx of [-1.05, -0.35, 0.35, 1.05]) {
        pushBox(body, 0.20, 0.28, 0.36, sx, 0.42, 2.02, 0xe4e4e7);
      }
      pushBox(body, 0.92, 0.86, 3.35, 0, 1.58, 0.35, 0x27272a, -0.30, 0, 0); // colossal siege cannon
      pushBox(body, 1.12, 1.06, 0.56, 0, 2.05, 1.75, 0x991b1b, -0.30, 0, 0);
      pushBox(body, 0.28, 1.15, 0.28, -0.92, 1.48, -1.25, 0x18181b);
      pushBox(body, 0.28, 1.15, 0.28, 0.92, 1.48, -1.25, 0x18181b);
      pushBox(glow, 0.52, 0.52, 0.16, 0, 2.12, 2.04, 0xff5722);
    } else if (species === 'dwarf') {
      // Colossal quad-tracked runic landship with bronze fortress casemate & huge brass quake-mortar
      for (const side of [-1, 1]) {
        pushBox(body, 0.62, 0.64, 3.25, side * 1.15, 0.34, 0, 0x27272a);
        pushBox(body, 0.70, 0.22, 3.15, side * 1.15, 0.68, 0, 0xb45309);
      }
      pushBox(body, 2.15, 0.96, 2.65, 0, 1.04, -0.1, 0x334155);
      pushBox(body, 2.28, 0.20, 2.78, 0, 1.56, -0.1, 0xd97706);
      pushBox(body, 0.86, 0.86, 2.85, 0, 1.92, 0.52, 0xb45309, -0.44, 0, 0);
      pushBox(body, 1.04, 1.04, 0.42, 0, 2.48, 1.68, 0xd97706, -0.44, 0, 0);
      pushBox(glow, 0.82, 0.42, 0.24, 0, 1.04, -1.46, 0xf59e0b);
    } else if (species === 'lizardfolk') {
      // Quadruped obsidian temple-walker with towering glowing emerald solar-obelisk cannon
      pushBox(body, 2.15, 0.74, 2.65, 0, 0.92, 0, 0x1e293b);
      for (const [lx, lz] of [[-1.12, 0.98], [1.12, 0.98], [-1.12, -0.98], [1.12, -0.98]]) {
        pushBox(body, 0.46, 0.92, 0.46, lx, 0.46, lz, 0x334155);
        pushBox(body, 0.56, 0.20, 0.56, lx, 0.10, lz, 0xca8a04);
      }
      pushBox(body, 1.58, 0.52, 1.72, 0, 1.52, 0, 0xca8a04);
      pushBox(glow, 0.64, 1.65, 0.64, 0, 2.48, 0.12, 0x34d399);
    } else {
      // HUMAN: Heavy twin-track self-propelled siege howitzer / railgun crawler with recoil spades
      const hullHex = e >= 5 ? 0x4b5563 : 0x4d5d42;
      for (const side of [-1, 1]) {
        pushBox(body, 0.58, 0.58, 3.35, side * 1.06, 0.30, 0, 0x262626);
        pushBox(body, 0.64, 0.18, 3.25, side * 1.06, 0.62, 0, hullHex);
      }
      pushBox(body, 1.88, 0.72, 2.95, 0, 0.86, 0, hullHex);
      pushBox(body, 1.48, 0.82, 1.75, 0, 1.56, -0.32, 0x64748b); // heavy armored turret
      pushBox(body, 0.38, 0.38, 3.45, 0, 2.08, 0.95, 0x94a3b8, -0.32, 0, 0); // long artillery barrel
      pushBox(body, 0.54, 0.48, 0.42, 0, 2.58, 2.45, 0x334155, -0.32, 0, 0); // muzzle brake
      if (e >= 6) pushBox(glow, 0.24, 0.16, 3.15, 0, 2.16, 0.98, 0x38bdf8, -0.32, 0, 0);
    }
    const g = finalizeGroup(body, glow, 0.44, 0.50, raceGlow);
    g.scale.setScalar(sc);
    return g;
  }

  // =========================================================================
  // 4. SKY CANNONSHIP (Air, Epoch 4+) — ~6.6 to 7.4 tiles long!
  // =========================================================================
  if (type === 'sky_cannonship') {
    const sc = e >= 6 ? 1.12 : 1.0;
    if (species === 'elf') {
      // Sweeping crescent-wing star-sail sky frigate with glowing crystal ring-drive & twin lance pods
      pushBox(body, 1.65, 0.92, 6.45, 0, 0, 0, 0xf3efe2);
      pushBox(body, 5.85, 0.24, 1.95, 0, 0.14, -0.25, 0xede7d5); // sweeping crescent wings
      pushBox(body, 0.68, 0.64, 1.65, 0, 0.12, 3.65, 0xd4af37); // gilded bowsprit
      pushBox(body, 0.88, 1.05, 1.75, 0, 0.92, -0.65, 0xf8f5eb); // spire bridge
      addWindowRow(glow, 0, 1.06, 0.26, 3, 0.26, false, 0xfef08a);
      pushBox(glow, 3.45, 0.26, 0.44, 0, -0.32, 0.55, 0xc084fc); // broadside prism lance array
      addThrusterPod(body, glow, -2.35, -0.1, -0.45, 0.55, 0.48, 0xd4af37, 0xf8f5eb, 0x38bdf8);
      addThrusterPod(body, glow, 2.35, -0.1, -0.45, 0.55, 0.48, 0xd4af37, 0xf8f5eb, 0x38bdf8);
    } else if (species === 'orc') {
      // Belching multi-rotor iron sky-barge bristling with oversized broadside dakka-cannons
      pushBox(body, 2.85, 1.35, 6.15, 0, 0, 0, 0x3f3a36);
      pushBox(body, 3.15, 0.58, 1.35, 0, 0.16, 3.25, 0x991b1b); // crimson iron ram prow
      pushBox(body, 1.45, 0.95, 1.85, 0, 1.12, -0.95, 0x5c2b22);
      addWindowRow(glow, 0, 1.24, 0.0, 4, 0.32, false, 0xff7043);
      // 6 heavy broadside cannon barrels sticking out both flanks
      for (const zb of [-1.55, 0.0, 1.55]) {
        pushBox(body, 4.65, 0.36, 0.36, 0, -0.14, zb, 0x18181b);
      }
      // Quad side lift-rotor thruster pods
      for (const [rx, rz] of [[-2.15, 1.45], [2.15, 1.45], [-2.15, -1.55], [2.15, -1.55]]) {
        addThrusterPod(body, glow, rx, 0.45, rz, 0.62, 0.42, 0x262626, 0x991b1b, 0xff5722);
      }
    } else if (species === 'dwarf') {
      // Heavy riveted brass-and-ironclad sky-dreadnought with twin armored side hulls & broadside mortars
      pushBox(body, 2.65, 1.28, 6.35, 0, 0, 0, 0x475569);
      pushBox(body, 2.82, 0.28, 6.45, 0, 0.72, 0, 0xd97706);
      for (const side of [-1, 1]) {
        pushBox(body, 1.18, 1.05, 4.55, side * 1.95, 0.14, -0.15, 0x334155);
        pushBox(glow, 0.88, 0.56, 0.36, side * 1.95, -0.05, -2.48, 0xf59e0b);
      }
      for (const zb of [-1.45, 0.15, 1.75]) {
        pushBox(body, 5.15, 0.34, 0.34, 0, 0.08, zb, 0xb45309); // triple broadside mortar batteries
      }
      addTurret(body, 0, 0.84, 1.85, 1.25, 0xb45309, 0x1e293b, 0);
      addTurret(body, 0, 0.84, -1.95, 1.25, 0xb45309, 0x1e293b, Math.PI);
    } else if (species === 'lizardfolk') {
      // Levitating stepped obsidian-and-gold sky-temple barge with 4 floating emerald crystal pylons
      pushBox(body, 3.15, 0.96, 5.95, 0, 0, 0, 0x1e293b);
      pushBox(body, 2.35, 0.74, 4.35, 0, 0.82, 0, 0xca8a04);
      pushBox(body, 1.45, 0.68, 2.45, 0, 1.48, -0.22, 0x1e293b);
      pushBox(glow, 0.84, 1.05, 0.84, 0, 2.15, -0.22, 0x34d399);
      for (const [px, pz] of [[-2.15, 1.95], [2.15, 1.95], [-2.15, -1.95], [2.15, -1.95]]) {
        pushBox(body, 0.62, 1.15, 0.62, px, 0.15, pz, 0xca8a04);
        pushBox(glow, 0.48, 0.68, 0.48, px, -0.42, pz, 0x34d399);
      }
    } else {
      // HUMAN: Armored aerial broadside gun-frigate with twin VTOL turbofan pods & heavy turret batteries
      pushBox(body, 2.45, 1.15, 6.55, 0, 0, 0, 0x475569);
      pushBox(body, 1.75, 0.88, 1.25, 0, -0.05, 3.65, 0x334155);
      pushBox(body, 1.55, 0.86, 2.15, 0, 0.98, -0.75, 0x64748b); // armored command bridge
      addWindowRow(glow, 0, 1.12, 0.35, 4, 0.32, false, 0x38bdf8);
      for (const side of [-1, 1]) {
        addThrusterPod(body, glow, side * 2.15, 0.14, 0.85, 0.68, 0.56, 0x334155, 0x64748b, 0x38bdf8);
        addThrusterPod(body, glow, side * 2.15, 0.14, -1.45, 0.68, 0.56, 0x334155, 0x64748b, 0x38bdf8);
      }
      addTurret(body, 0, 0.58, 2.15, 1.25, 0x64748b, 0xcbd5e1, 0);
      addTurret(body, 0, 0.58, -2.35, 1.25, 0x64748b, 0xcbd5e1, Math.PI);
      pushBox(body, 0.34, 0.34, 2.15, -0.68, -0.56, 2.35, 0x94a3b8); // ventral heavy cannons
      pushBox(body, 0.34, 0.34, 2.15, 0.68, -0.56, 2.35, 0x94a3b8);
    }
    const g = finalizeGroup(body, glow, 0.48, 0.44, raceGlow);
    g.scale.setScalar(sc);
    return g;
  }

  // =========================================================================
  // 5. SKY CARRIER / AIR CARRIER (Air, Epoch 5+) — ~8.8 to 9.8 tiles long!
  // =========================================================================
  if (type === 'sky_carrier') {
    const sc = e >= 7 ? 1.12 : 1.0;
    if (species === 'elf') {
      // Celestial Lotus Sky-Carrier: huge petal-shaped ivory launch decks orbiting a blazing lotus crystal
      pushBox(body, 3.45, 0.92, 8.6, 0, 0, 0, 0xf3efe2);
      pushBox(body, 6.85, 0.42, 3.45, 0, 0.16, 0, 0xede7d5);
      pushBox(body, 1.05, 2.05, 2.15, 1.65, 1.38, -0.85, 0xf8f5eb);
      pushBox(body, 0.48, 1.15, 0.48, 1.65, 2.85, -0.85, 0xd4af37);
      pushBox(glow, 1.85, 1.25, 1.85, 0, -0.58, 0, 0xc084fc); // central levitation lotus crystal
      pushBox(glow, 0.24, 0.08, 7.2, -0.58, 0.52, 0, 0x38bdf8);
      for (const [tx, tz] of [[-2.75, 0], [2.75, 0]]) {
        addThrusterPod(body, glow, tx, 0.0, tz, 0.85, 0.55, 0xd4af37, 0xf8f5eb, 0xc084fc);
      }
      for (const zf of [-2.8, -1.2, 0.4, 2.0, 3.2]) {
        addParkedFighter(body, glow, -0.72, 0.50, zf, 0xd4af37, 0xf8f5eb, 0xc084fc, 0.14);
      }
    } else if (species === 'orc') {
      // Gargantuan scrap-iron Mega-Helihulk held aloft by 4 huge roaring lift turbines & skull-bridge
      pushBox(body, 4.35, 1.24, 8.8, 0, 0, 0, 0x3c3734);
      pushBox(body, 3.45, 0.48, 1.85, 0, 0.56, 4.35, 0x991b1b, -0.18, 0, 0);
      pushBox(body, 1.28, 1.95, 2.55, 1.75, 1.48, -1.05, 0x5c2b22);
      addWindowRow(glow, 1.1, 1.85, -1.05, 5, 0.42, true, 0xff7043);
      for (const [rx, rz] of [[-3.15, 2.15], [3.15, 2.15], [-3.15, -2.15], [3.15, -2.15]]) {
        addThrusterPod(body, glow, rx, 0.08, rz, 0.98, 0.62, 0x262626, 0x991b1b, 0xff5722);
      }
      addTurret(body, -2.05, 0.62, 2.85, 1.25, 0x991b1b, 0x18181b, -0.4);
      addTurret(body, -2.05, 0.62, -2.85, 1.25, 0x991b1b, 0x18181b, -2.4);
      for (const zf of [-2.6, -1.0, 0.6, 2.2]) {
        addParkedFighter(body, glow, -0.78, 0.66, zf, 0xb91c1c, 0x3f3a36, 0xff5722, 0.18);
      }
    } else if (species === 'dwarf') {
      // Monumental Twin-Furnace Armored Sky-Fortress Carrier with ironclad flight bays & huge forge-thrusters
      pushBox(body, 4.55, 1.32, 8.5, 0, 0, 0, 0x334155);
      pushBox(body, 4.95, 0.34, 8.1, 0, 0.78, 0, 0x64748b);
      pushBox(body, 5.15, 0.24, 0.82, 0, 0.92, 3.85, 0xd97706);
      pushBox(body, 1.38, 1.75, 2.75, 1.82, 1.62, -0.85, 0x475569);
      addWindowRow(glow, 1.12, 1.85, -0.85, 5, 0.44, true, 0xfbbf24);
      for (const [rx, rz] of [[-3.05, 2.05], [3.05, 2.05], [-3.05, -2.05], [3.05, -2.05]]) {
        addThrusterPod(body, glow, rx, -0.05, rz, 0.92, 0.96, 0xb45309, 0xd97706, 0xf59e0b);
      }
      addTurret(body, -2.15, 0.94, 2.65, 1.25, 0xb45309, 0x1e293b, -0.35);
      addTurret(body, -2.15, 0.94, -2.65, 1.25, 0xb45309, 0x1e293b, -2.4);
      for (const zf of [-2.6, -1.0, 0.6, 2.2]) {
        addParkedFighter(body, glow, -0.68, 0.98, zf, 0xd97706, 0x475569, 0xf59e0b, 0.08);
      }
    } else if (species === 'lizardfolk') {
      // Majestic floating Golden Sun-Disc Wing Carrier with stepped emerald pyramid command nexus
      pushBox(body, 4.85, 0.92, 8.3, 0, 0, 0, 0x1e293b);
      pushBox(body, 6.25, 0.32, 5.4, 0, 0.52, 0, 0xd4af37);
      pushBox(body, 1.95, 0.82, 2.55, 1.48, 1.12, -0.75, 0x1f2937);
      pushBox(body, 1.32, 0.74, 1.75, 1.48, 1.84, -0.75, 0xca8a04);
      pushBox(glow, 0.82, 1.05, 0.82, 1.48, 2.68, -0.75, 0x34d399);
      pushBox(glow, 0.34, 0.12, 6.8, -0.82, 0.72, 0, 0x34d399);
      for (const [rx, rz] of [[-2.95, 1.95], [2.95, 1.95], [-2.95, -1.95], [2.95, -1.95]]) {
        addThrusterPod(body, glow, rx, -0.1, rz, 0.78, 0.56, 0x1e293b, 0xd4af37, 0x34d399);
      }
      for (const zf of [-2.4, -0.8, 0.8, 2.4]) {
        addParkedFighter(body, glow, -0.85, 0.74, zf, 0xfacc15, 0x1e293b, 0x34d399, 0.14);
      }
    } else {
      // HUMAN: Colossal Quad-Turbine Stratospheric Helicarrier (~9 tiles long, 4 massive lift turbines, 5 jets!)
      pushBox(body, 4.05, 1.15, 9.0, 0, 0, 0, 0x3b4856);
      pushBox(body, 4.65, 0.32, 8.5, -0.22, 0.68, 0, 0x26303c);
      pushBox(body, 0.22, 0.04, 7.6, -0.92, 0.86, 0, 0xf1f5f9);
      pushBox(body, 0.14, 0.04, 7.0, 0.24, 0.86, 0.25, 0xfbbf24);
      pushBox(body, 1.05, 1.65, 2.35, 1.68, 1.56, -0.95, 0x64748b); // command tower
      pushBox(body, 0.22, 1.25, 0.22, 1.68, 2.95, -1.05, 0xcbd5e1);
      addWindowRow(glow, 1.14, 1.88, -0.95, 5, 0.38, true, 0x38bdf8);
      // Four iconic colossal glowing helicarrier lift-turbine rings
      for (const [rx, rz] of [[-3.18, 2.35], [3.18, 2.35], [-3.18, -2.35], [3.18, -2.35]]) {
        addThrusterPod(body, glow, rx, 0.12, rz, 1.04, 0.52, 0x475569, 0x94a3b8, 0x38bdf8);
      }
      addTurret(body, -2.15, 0.84, 2.95, 1.15, 0x64748b, 0xcbd5e1, -0.35);
      addTurret(body, 1.95, 0.84, -3.45, 1.15, 0x64748b, 0xcbd5e1, 2.65);
      for (const zf of [-3.0, -1.5, 0.0, 1.5, 3.0]) {
        addParkedFighter(body, glow, -0.98, 0.88, zf, 0x94a3b8, 0xe2e8f0, 0x38bdf8, 0.16);
      }
    }
    const g = finalizeGroup(body, glow, 0.50, 0.40, raceGlow);
    g.scale.setScalar(sc);
    return g;
  }

  // =========================================================================
  // 6. ORBITAL MOTHERSHIP (Orbital / Interstellar, Epoch 6+) — ~11.2 to 12.2 tiles long (~1/2 Alien Mothership!)
  // =========================================================================
  if (type === 'orbital_mothership') {
    const sc = e >= 7 ? 1.10 : 1.0;
    if (species === 'elf') {
      // Celestial Star-Lotus Ark: towering crystalline spire ringed by concentric golden halos & starlight wings
      pushBox(body, 3.35, 1.65, 10.6, 0, 0, 0, 0xf8f5eb);
      pushBox(body, 9.25, 0.46, 3.25, 0, 0.18, -0.55, 0xede7d5); // vast crescent wings
      pushBox(body, 1.85, 3.45, 2.25, 0, 1.75, -0.75, 0xf3efe2); // central crystal cathedral spire
      pushBox(body, 0.85, 2.15, 0.85, 0, 4.15, -0.75, 0xd4af37);
      // Concentric glowing celestial halo rings
      pushBox(glow, 6.45, 0.30, 0.48, 0, 1.15, 1.65, 0xc084fc);
      pushBox(glow, 6.45, 0.30, 0.48, 0, 1.15, -2.95, 0xc084fc);
      pushBox(glow, 0.48, 0.30, 4.95, -3.22, 1.15, -0.65, 0x38bdf8);
      pushBox(glow, 0.48, 0.30, 4.95, 3.22, 1.15, -0.65, 0x38bdf8);
      pushBox(glow, 1.45, 1.25, 1.45, 0, -1.25, 0, 0xc084fc); // ventral orbital beam lens
      addWindowRow(glow, 0, 2.25, 0.40, 5, 0.32, false, 0xfef08a);
    } else if (species === 'orc') {
      // Colossal World-Krusher Orbital Mega-Hulk: bolted asteroid-fortress with giant iron tusks & plasma cannons
      pushBox(body, 6.15, 2.45, 10.4, 0, 0.15, 0, 0x36322f);
      pushBox(body, 4.85, 1.85, 7.6, 0.45, 1.65, -0.45, 0x4d4540);
      pushBox(body, 3.15, 1.35, 2.25, -0.65, 2.85, -1.05, 0x991b1b);
      for (const side of [-1, 1]) {
        for (let ri = -3; ri <= 3; ri++) {
          pushBox(body, 0.55, 2.15, 0.48, side * 3.25, 0.15, ri * 1.35, 0x71717a);
        }
      }
      // Giant forward iron ram-tusks
      pushBox(body, 0.85, 0.92, 3.65, -2.55, 0.08, 6.15, 0xa1a1aa);
      pushBox(body, 0.85, 0.92, 3.65, 2.55, 0.08, 6.15, 0xa1a1aa);
      addTurret(body, -2.15, 2.55, 2.45, 1.65, 0x991b1b, 0x18181b, -0.2);
      addTurret(body, 2.15, 2.55, 2.45, 1.65, 0x991b1b, 0x18181b, 0.2);
      // Blazing crimson-orange warp thrusters & ventral mega-cannon
      pushBox(glow, 4.65, 1.25, 0.56, 0, 0.15, -5.35, 0xff5722);
      pushBox(glow, 1.65, 1.05, 1.65, 0, -1.35, 1.25, 0xff3b30);
    } else if (species === 'dwarf') {
      // Monumental Dyson-Anvil Orbital Citadel: huge octagonal runic-gold & dark-iron fortress with star-forge core
      pushBox(body, 8.2, 1.75, 2.55, 0, 0, 3.35, 0x334155);
      pushBox(body, 8.2, 1.75, 2.55, 0, 0, -3.35, 0x334155);
      pushBox(body, 2.55, 1.75, 8.2, -3.35, 0, 0, 0x475569);
      pushBox(body, 2.55, 1.75, 8.2, 3.35, 0, 0, 0x475569);
      // Runic gold battlements around entire citadel ring
      pushBox(body, 8.45, 0.38, 2.75, 0, 1.02, 3.35, 0xd97706);
      pushBox(body, 8.45, 0.38, 2.75, 0, 1.02, -3.35, 0xd97706);
      pushBox(body, 2.75, 0.38, 8.45, -3.35, 1.02, 0, 0xd97706);
      pushBox(body, 2.75, 0.38, 8.45, 3.35, 1.02, 0, 0xd97706);
      for (const [tx, tz, tyaw] of [[-3.35, 3.35, -0.78], [3.35, 3.35, 0.78], [-3.35, -3.35, -2.35], [3.35, -3.35, 2.35]]) {
        addTurret(body, tx, 1.20, tz, 1.55, 0xb45309, 0x1e293b, tyaw);
      }
      // Blazing miniature star-forge core suspended in the hollow center
      pushBox(glow, 2.55, 2.55, 2.55, 0, 0.15, 0, 0xf59e0b);
    } else if (species === 'lizardfolk') {
      // Grand Floating Solar Ziggurat Ark: colossal levitating golden-obsidian stepped pyramid + 4 orbiting obelisks
      pushBox(body, 8.2, 1.05, 8.2, 0, -0.25, 0, 0x1e293b);
      pushBox(body, 6.3, 1.02, 6.3, 0, 0.78, 0, 0xca8a04);
      pushBox(body, 4.3, 1.02, 4.3, 0, 1.80, 0, 0x1f2937);
      pushBox(body, 2.5, 0.94, 2.5, 0, 2.76, 0, 0xd4af37);
      // Blazing emerald sun-disc crown & ventral solar lens
      pushBox(glow, 1.75, 1.75, 1.75, 0, 4.05, 0, 0x34d399);
      pushBox(glow, 1.85, 0.95, 1.85, 0, -1.15, 0, 0xfacc15);
      // 4 towering floating corner obelisks
      for (const [ox, oz] of [[-4.85, 4.85], [4.85, 4.85], [-4.85, -4.85], [4.85, -4.85]]) {
        pushBox(body, 0.88, 2.75, 0.88, ox, 0.55, oz, 0xca8a04);
        pushBox(glow, 0.64, 0.96, 0.64, ox, 2.25, oz, 0x34d399);
      }
    } else {
      // HUMAN: Monumental Interstellar Ring-Ark Command Mothership (~11.4 tiles long, glowing warp-ring & twin bays!)
      pushBox(body, 4.05, 1.65, 11.2, 0, 0.15, 0, 0x334155);
      pushBox(body, 6.25, 1.05, 5.15, 0, 0.28, -0.65, 0x475569); // heavy armored flank bays
      pushBox(body, 1.85, 1.55, 2.95, 0, 1.72, -1.15, 0x64748b); // towering command citadel
      pushBox(body, 0.42, 1.45, 0.42, 0, 3.12, -1.35, 0xcbd5e1); // sensor spire
      for (const side of [-1, 1]) {
        for (let ri = -3; ri <= 3; ri++) {
          pushBox(body, 0.36, 1.35, 0.36, side * 2.18, 0.22, ri * 1.45, 0x94a3b8);
        }
      }
      addWindowRow(glow, 0, 1.95, 0.36, 5, 0.32, false, 0xfbbf24);
      addWindowRow(glow, -2.06, 0.45, 0, 7, 1.15, true, 0x38bdf8);
      addWindowRow(glow, 2.06, 0.45, 0, 7, 1.15, true, 0x38bdf8);
      addTurret(body, -2.25, 0.82, 1.15, 1.45, 0x64748b, 0xcbd5e1, -0.4);
      addTurret(body, 2.25, 0.82, 1.15, 1.45, 0x64748b, 0xcbd5e1, 0.4);
      // Encircling luminous cyan warp-drive ring
      pushBox(glow, 8.85, 0.36, 0.62, 0, 0.08, 2.65, 0x38bdf8);
      pushBox(glow, 8.85, 0.36, 0.62, 0, 0.08, -3.75, 0x38bdf8);
      pushBox(glow, 0.62, 0.36, 6.85, -4.35, 0.08, -0.55, 0x38bdf8);
      pushBox(glow, 0.62, 0.36, 6.85, 4.35, 0.08, -0.55, 0x38bdf8);
      // Ventral orbital lance core & massive rear ion drive banks
      pushBox(glow, 1.45, 0.85, 2.15, 0, -0.95, 1.75, 0x38bdf8);
      pushBox(glow, 2.95, 0.88, 0.48, 0, 0.15, -5.75, 0x38bdf8);
    }
    const g = finalizeGroup(body, glow, 0.56, 0.34, raceGlow);
    g.scale.setScalar(sc);
    return g;
  }

  return null;
}
