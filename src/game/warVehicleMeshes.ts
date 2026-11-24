import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SpeciesId, VehicleType } from './types';

/** Normalize any Three.js BufferGeometry into non-indexed {position, normal, color} for clean merging */
function pushGeo(parts: THREE.BufferGeometry[], rawGeo: THREE.BufferGeometry, hex: number): void {
  const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo;
  if (rawGeo.index) rawGeo.dispose();
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const pos = g.getAttribute('position');
  for (const key of Object.keys(g.attributes)) {
    if (key !== 'position' && key !== 'normal') {
      g.deleteAttribute(key);
    }
  }
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
  pushGeo(parts, g, hex);
}

function pushCyl(
  parts: THREE.BufferGeometry[],
  rTop: number,
  rBot: number,
  len: number,
  segs: number,
  x: number,
  y: number,
  z: number,
  hex: number,
  rx = 0,
  ry = 0,
  rz = 0,
): void {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, segs);
  if (rx !== 0) g.rotateX(rx);
  if (ry !== 0) g.rotateY(ry);
  if (rz !== 0) g.rotateZ(rz);
  g.translate(x, y, z);
  pushGeo(parts, g, hex);
}

function pushTorus(
  parts: THREE.BufferGeometry[],
  radius: number,
  tube: number,
  radSegs: number,
  tubSegs: number,
  x: number,
  y: number,
  z: number,
  hex: number,
  rx = Math.PI / 2,
  ry = 0,
  rz = 0,
): void {
  const g = new THREE.TorusGeometry(radius, tube, radSegs, tubSegs);
  if (rx !== 0) g.rotateX(rx);
  if (ry !== 0) g.rotateY(ry);
  if (rz !== 0) g.rotateZ(rz);
  g.translate(x, y, z);
  pushGeo(parts, g, hex);
}

function pushTaperedHull(
  parts: THREE.BufferGeometry[],
  profile: Array<[number, number]>,
  height: number,
  yTop: number,
  hex: number,
  bevel = 0.08,
): void {
  const shape = new THREE.Shape();
  shape.moveTo(0, profile[0][1]);
  for (let i = 0; i < profile.length; i++) {
    shape.lineTo(profile[i][0], profile[i][1]);
  }
  for (let i = profile.length - 1; i >= 0; i--) {
    shape.lineTo(-profile[i][0], profile[i][1]);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
  });
  g.rotateX(Math.PI / 2);
  g.translate(0, yTop, 0);
  pushGeo(parts, g, hex);
}

/** Realistic twin-barrel armored turret with matte housing + metallic cylindrical barrels */
function addNavalTurret(
  matte: THREE.BufferGeometry[],
  metal: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  scale: number,
  turretHex: number,
  barrelHex: number,
  yaw = 0,
): void {
  const s = scale;
  pushCyl(matte, 0.24 * s, 0.28 * s, 0.15 * s, 8, x, y + 0.075 * s, z, turretHex);
  pushBox(matte, 0.36 * s, 0.19 * s, 0.44 * s, x, y + 0.22 * s, z, turretHex, 0, yaw, 0);
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  for (const side of [-0.085, 0.085]) {
    const bx = x + side * s * cos + 0.42 * s * sin;
    const bz = z - side * s * sin + 0.42 * s * cos;
    pushCyl(metal, 0.032 * s, 0.042 * s, 0.72 * s, 6, bx, y + 0.26 * s, bz, barrelHex, Math.PI / 2 - 0.1, yaw, 0);
  }
}

/** Crisp parked carrier aircraft */
function addDeckAircraft(
  matte: THREE.BufferGeometry[],
  metal: THREE.BufferGeometry[],
  win: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  wingHex: number,
  fuselageHex: number,
  isPropEra: boolean,
  yaw = 0.14,
): void {
  pushCyl(metal, 0.04, 0.062, 0.76, 6, x, y + 0.075, z, fuselageHex, Math.PI / 2, yaw, 0);
  if (isPropEra) {
    pushBox(matte, 0.74, 0.028, 0.16, x, y + 0.085, z + 0.04, wingHex, 0, yaw, 0);
    pushBox(matte, 0.26, 0.022, 0.09, x, y + 0.085, z - 0.30, wingHex, 0, yaw, 0);
  } else {
    pushBox(matte, 0.68, 0.026, 0.22, x, y + 0.075, z - 0.06, wingHex, 0, yaw, 0);
    pushBox(matte, 0.32, 0.026, 0.28, x, y + 0.075, z + 0.04, wingHex, 0, yaw, 0);
  }
  pushBox(matte, 0.026, 0.15, 0.14, x, y + 0.15, z - 0.27, fuselageHex, 0, yaw, 0);
  pushBox(win, 0.06, 0.05, 0.14, x, y + 0.13, z + 0.12, 0x93c5fd, 0, yaw, 0);
}

/** Circular ducted lift-turbine shroud (Helicarrier / Sky-Frigate style) */
function addDuctedTurbine(
  matte: THREE.BufferGeometry[],
  metal: THREE.BufferGeometry[],
  glow: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  radius: number,
  casingHex: number,
  bladeHex: number,
  glowHex: number,
): void {
  pushTorus(matte, radius, radius * 0.22, 6, 14, x, y, z, casingHex);
  pushTorus(metal, radius * 1.04, radius * 0.07, 5, 14, x, y + radius * 0.15, z, bladeHex);
  pushCyl(metal, radius * 0.20, radius * 0.22, radius * 0.42, 8, x, y, z, bladeHex);
  pushBox(metal, radius * 1.72, 0.045, radius * 0.16, x, y, z, bladeHex, 0, 0.4, 0);
  pushBox(metal, radius * 1.72, 0.045, radius * 0.16, x, y, z, bladeHex, 0, 1.97, 0);
  pushTorus(glow, radius * 0.72, radius * 0.08, 5, 14, x, y - radius * 0.16, z, glowHex);
}

function addWindowStrip(
  win: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  count: number,
  spacing: number,
  alongZ: boolean,
  hex = 0xfbbf24,
): void {
  const half = ((count - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) {
    const off = -half + i * spacing;
    pushBox(
      win,
      alongZ ? 0.06 : 0.14,
      0.085,
      alongZ ? 0.14 : 0.06,
      alongZ ? x : x + off,
      y,
      alongZ ? z + off : z,
      hex,
    );
  }
}

/**
 * 4-Material Alien-Mothership Finish Pipeline (ZERO tiled grid textures, only 3–4 merged draw calls!):
 * 1. Matte Armor & Decks (roughness 0.72, metalness 0.18) — decks, hulls, dark plating
 * 2. Brushed Gunmetal / Gold / Steel Trim (roughness 0.34, metalness 0.74) — barrels, masts, turbines, trim
 * 3. Crisp Lit Bridge Windows (MeshBasicMaterial) — warm amber/ice-blue viewports
 * 4. Restrained Engine / Reactor Glow (MeshBasicMaterial) — thruster cores & accent strips
 */
function finalizeMultiFinishGroup(
  matteParts: THREE.BufferGeometry[],
  metalParts: THREE.BufferGeometry[],
  winParts: THREE.BufferGeometry[],
  glowParts: THREE.BufferGeometry[],
): THREE.Group {
  const group = new THREE.Group();

  const addMerged = (parts: THREE.BufferGeometry[], mat: THREE.Material, castShadow: boolean) => {
    if (parts.length === 0) return;
    const merged = mergeGeometries(parts, false);
    for (const g of parts) g.dispose();
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = castShadow;
    group.add(mesh);
  };

  addMerged(
    matteParts,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.18,
    }),
    true,
  );
  addMerged(
    metalParts,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.34,
      metalness: 0.74,
    }),
    true,
  );
  addMerged(
    winParts,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
    }),
    false,
  );
  addMerged(
    glowParts,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
    }),
    false,
  );

  return group;
}

/**
 * Builds sleek, realistic, grid-free 3D capital war vehicles (~1/2 Alien Mothership length)
 * with authentic naval/aerospace/sci-fi silhouettes and 5 genuinely unique race designs.
 */
export function createCapitalWarVehicleGroup(
  type: VehicleType,
  epochLevel: number,
  species: SpeciesId,
): THREE.Group | null {
  const e = Math.max(3, epochLevel);
  const matte: THREE.BufferGeometry[] = [];
  const metal: THREE.BufferGeometry[] = [];
  const win: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];

  // =========================================================================
  // 1. AIRCRAFT CARRIER (Sea, Epoch 3+) — Long ~12.6 tiles (~5.6:1 naval ratio!)
  // =========================================================================
  if (type === 'aircraft_carrier') {
    const isPropEra = e <= 3;
    const isAngledDeck = e >= 4;

    if (species === 'elf') {
      // Twin-hull ivory catamaran supercarrier with gilded swan-prows & spire bridge
      const hullProf: Array<[number, number]> = [
        [0.16, -5.8], [0.44, -4.6], [0.50, 0.0], [0.42, 4.4], [0.16, 6.0], [0.0, 6.6],
      ];
      for (const side of [-1, 1]) {
        const shape = new THREE.Shape();
        shape.moveTo(side * 1.15, -5.8);
        for (const [hw, z] of hullProf) shape.lineTo(side * 1.15 + hw, z);
        for (let i = hullProf.length - 1; i >= 0; i--) shape.lineTo(side * 1.15 - hullProf[i][0], hullProf[i][1]);
        shape.closePath();
        const hg = new THREE.ExtrudeGeometry(shape, { depth: 0.72, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 1 });
        hg.rotateX(Math.PI / 2);
        hg.translate(0, 0.74, 0);
        pushGeo(matte, hg, 0xe8e2d0);
        pushCyl(metal, 0.04, 0.13, 1.45, 6, side * 1.15, 0.86, 6.35, 0xc8a441, Math.PI / 2 - 0.16, 0, 0);
      }
      pushTaperedHull(matte, [
        [1.15, -5.6], [1.46, -3.5], [1.52, 2.0], [1.20, 4.8], [0.60, 5.9], [0.0, 6.3],
      ], 0.20, 1.02, 0xf2ede0, 0.05);
      pushBox(metal, 0.12, 0.03, 10.8, 0, 1.09, 0.1, 0xc8a441);
      pushBox(glow, 0.06, 0.04, 9.8, -0.52, 1.09, 0.2, 0x7dd3fc);
      pushBox(matte, 0.54, 1.15, 2.25, 1.12, 1.66, -1.15, 0xf5f0e2);
      pushCyl(metal, 0.08, 0.24, 1.55, 6, 1.12, 2.92, -1.2, 0xc8a441);
      pushCyl(glow, 0.14, 0.05, 0.58, 6, 1.12, 3.82, -1.2, 0xc084fc);
      addWindowStrip(win, 0.83, 1.94, -1.15, 5, 0.34, true, 0xfef08a);
      addNavalTurret(matte, metal, -1.32, 1.04, 3.4, 0.82, 0xd4af37, 0xe2e8f0, -0.35);
      addNavalTurret(matte, metal, -1.32, 1.04, -3.5, 0.82, 0xd4af37, 0xe2e8f0, -2.6);
      for (const zf of [-4.1, -2.4, -0.7, 1.0, 2.7, 4.3]) {
        addDeckAircraft(matte, metal, win, -0.56, 1.08, zf, 0xc8a441, 0xf8f5eb, isPropEra, 0.12);
      }
    } else if (species === 'orc') {
      // Long riveted ironclad flat-top hulk (~12.2 tiles) with crimson waterline, ski-jump bow & tilted stacks
      pushTaperedHull(matte, [
        [1.14, -5.7], [1.42, -3.8], [1.48, 2.6], [1.14, 5.0], [0.52, 6.0], [0.0, 6.4],
      ], 0.32, 0.30, 0x6b1d1d, 0.04); // dark crimson waterline belt
      pushTaperedHull(matte, [
        [1.18, -5.6], [1.46, -3.8], [1.52, 2.6], [1.16, 5.0], [0.54, 5.9], [0.0, 6.3],
      ], 0.64, 0.94, 0x3b3532, 0.06);
      pushTaperedHull(matte, [
        [1.36, -5.4], [1.62, -3.2], [1.66, 2.9], [1.30, 5.2], [0.82, 5.7],
      ], 0.20, 1.14, 0x4b433e, 0.04);
      pushBox(metal, 1.58, 0.16, 2.0, -0.22, 1.36, 4.95, 0x574c45, -0.20, 0, 0); // iron ski-jump ramp
      for (const tx of [-0.68, 0.68]) {
        pushCyl(metal, 0.04, 0.18, 1.65, 6, tx, 0.62, 6.45, 0xa1a1aa, Math.PI / 2 - 0.12, 0, 0);
      }
      pushBox(matte, 0.74, 1.32, 2.55, 1.18, 1.84, -1.25, 0x5c2b22);
      pushBox(matte, 0.56, 0.50, 1.45, 1.18, 2.70, -1.35, 0x3b3532);
      pushCyl(metal, 0.18, 0.22, 1.65, 8, 1.24, 3.10, -0.65, 0x262626, -0.15, 0, 0.1);
      pushCyl(metal, 0.16, 0.20, 1.45, 8, 1.24, 3.00, -1.85, 0x262626, -0.15, 0, 0.1);
      addWindowStrip(win, 0.79, 2.24, -1.25, 5, 0.36, true, 0xfbbf24);
      addNavalTurret(matte, metal, -1.46, 1.16, 2.8, 0.92, 0x7f1d1d, 0x27272a, -0.4);
      addNavalTurret(matte, metal, -1.46, 1.16, -3.3, 0.92, 0x7f1d1d, 0x27272a, -2.6);
      for (const zf of [-3.7, -2.0, -0.3, 1.4, 3.1]) {
        addDeckAircraft(matte, metal, win, -0.58, 1.19, zf, 0x991b1b, 0x3f3a36, isPropEra, 0.15);
      }
    } else if (species === 'dwarf') {
      // Heavy ironclad-and-bronze fleet carrier (~12.0 tiles) with gilded belt, fortress island & brass funnels
      pushTaperedHull(matte, [
        [1.22, -5.6], [1.54, -3.6], [1.60, 2.7], [1.24, 5.0], [0.56, 6.0], [0.0, 6.3],
      ], 0.92, 0.94, 0x334155, 0.06);
      pushTaperedHull(matte, [
        [1.42, -5.4], [1.70, -3.4], [1.74, 2.9], [1.40, 5.2], [0.80, 5.7],
      ], 0.20, 1.16, 0x475569, 0.04);
      pushBox(metal, 0.16, 0.22, 9.8, -1.62, 0.70, -0.2, 0xb45309);
      pushBox(metal, 0.16, 0.22, 9.8, 1.62, 0.70, -0.2, 0xb45309);
      pushBox(metal, 0.14, 0.03, 10.2, -0.18, 1.22, 0.1, 0xd97706);
      pushBox(matte, 0.82, 1.24, 2.75, 1.22, 1.84, -1.15, 0x334155);
      pushBox(metal, 0.88, 0.16, 2.85, 1.22, 2.52, -1.15, 0xd97706);
      pushCyl(metal, 0.20, 0.24, 1.35, 8, 1.26, 3.16, -0.55, 0xb45309);
      pushCyl(metal, 0.20, 0.24, 1.35, 8, 1.26, 3.16, -1.75, 0xb45309);
      addWindowStrip(win, 0.79, 2.20, -1.15, 5, 0.42, true, 0xfbbf24);
      addNavalTurret(matte, metal, -1.50, 1.18, 3.2, 0.92, 0xb45309, 0x1e293b, -0.35);
      addNavalTurret(matte, metal, -1.50, 1.18, -3.2, 0.92, 0xb45309, 0x1e293b, -2.6);
      for (const zf of [-3.7, -2.0, -0.3, 1.4, 3.1]) {
        addDeckAircraft(matte, metal, win, -0.54, 1.22, zf, 0xd97706, 0x475569, isPropEra, 0.10);
      }
    } else if (species === 'lizardfolk') {
      // Elongated obsidian & gold stepped-temple sea carrier (~12.2 tiles) with emerald ziggurat bridge
      pushTaperedHull(matte, [
        [1.16, -5.7], [1.46, -3.6], [1.54, 2.6], [1.16, 5.0], [0.50, 6.0], [0.0, 6.4],
      ], 0.88, 0.92, 0x1e293b, 0.06);
      pushTaperedHull(matte, [
        [1.38, -5.4], [1.64, -3.4], [1.70, 2.9], [1.34, 5.1], [0.74, 5.8],
      ], 0.20, 1.14, 0x2c3645, 0.04);
      pushBox(metal, 0.16, 0.04, 10.4, -0.22, 1.19, 0.1, 0xca8a04);
      pushBox(glow, 0.08, 0.04, 9.4, -0.62, 1.19, 0.15, 0x34d399);
      pushBox(matte, 0.94, 0.46, 2.55, 1.14, 1.40, -1.1, 0x1e293b);
      pushBox(metal, 0.70, 0.44, 1.85, 1.14, 1.85, -1.1, 0xca8a04);
      pushBox(matte, 0.46, 0.42, 1.15, 1.14, 2.28, -1.1, 0x1f2937);
      pushCyl(glow, 0.04, 0.22, 0.82, 4, 1.14, 2.88, -1.1, 0x34d399);
      addNavalTurret(matte, metal, -1.46, 1.16, 3.1, 0.88, 0xca8a04, 0x1e293b, -0.35);
      addNavalTurret(matte, metal, -1.46, 1.16, -3.2, 0.88, 0xca8a04, 0x1e293b, -2.6);
      for (const zf of [-3.7, -2.0, -0.3, 1.4, 3.1]) {
        addDeckAircraft(matte, metal, win, -0.58, 1.19, zf, 0xd4af37, 0x1e293b, isPropEra, 0.14);
      }
    } else {
      // HUMAN: Authentic 5.6:1 Naval Fleet Carrier (~12.8 tiles long!) with dark-red anti-fouling lower hull,
      // recessed hangar openings, Industrial teak wood deck -> Atomic/Info angled asphalt deck -> Orbital stealth deck!
      const hullHex = e >= 5 ? 0x475569 : 0x64748b;
      const deckHex = isPropEra ? 0x8a7052 : e >= 5 ? 0x1f2630 : 0x303945;
      // Dark red anti-fouling lower hull waterline belt
      pushTaperedHull(matte, [
        [0.92, -6.0], [1.18, -4.4], [1.24, 2.8], [0.92, 5.1], [0.40, 6.2], [0.0, 6.6],
      ], 0.30, 0.28, 0x7c2d2d, 0.03);
      // Main grey steel hull rising to hangar deck
      pushTaperedHull(matte, [
        [0.95, -5.9], [1.22, -4.4], [1.28, 2.8], [0.95, 5.1], [0.42, 6.1], [0.0, 6.5],
      ], 0.68, 0.96, hullHex, 0.05);
      // Recessed dark hangar bay doors along both flanks with warm amber interior glow
      for (const side of [-1, 1]) {
        for (const hz of [-2.4, 0.8]) {
          pushBox(matte, 0.12, 0.34, 1.55, side * 1.26, 0.62, hz, 0x111827);
          pushBox(win, 0.06, 0.10, 1.25, side * 1.28, 0.72, hz, 0xfbbf24);
        }
      }
      // Long cantilevered flight deck (12.2 tiles long!)
      pushTaperedHull(matte, [
        [1.24, -5.8], [1.44, -4.2], [1.46, 3.6], [1.16, 5.6], [0.86, 6.1],
      ], 0.18, 1.14, deckHex, 0.03);
      if (isAngledDeck) {
        // Port-side angled landing deck sponson + crisp white dashed landing strip
        pushBox(matte, 0.96, 0.16, 6.6, -1.42, 1.06, -0.85, deckHex, 0, 0.13, 0);
        pushBox(matte, 0.09, 0.025, 6.2, -1.28, 1.16, -0.85, 0xf1f5f9, 0, 0.13, 0);
      }
      // Crisp runway centerline & catapult tracks
      pushBox(matte, 0.09, 0.025, 11.0, -0.18, 1.16, 0.15, 0xf1f5f9);
      pushBox(matte, 0.06, 0.025, 9.8, 0.36, 1.16, 0.35, 0xfbbf24);
      if (e >= 6) pushBox(glow, 0.08, 0.03, 10.4, -0.18, 1.17, 0.15, 0x60a5fa);
      // Starboard command island superstructure
      pushBox(matte, 0.62, 1.22, 2.55, 1.10, 1.78, -1.15, 0x64748b);
      pushBox(matte, 0.48, 0.54, 1.48, 1.10, 2.62, -1.25, 0x94a3b8);
      if (isPropEra) {
        // Classic Industrial-era naval funnel + lattice tripod mast
        pushCyl(metal, 0.20, 0.24, 1.45, 8, 1.10, 2.72, -0.35, 0x334155, -0.12, 0, 0);
        pushCyl(metal, 0.04, 0.08, 1.75, 6, 1.10, 3.42, -1.55, 0xcbd5e1);
      } else {
        // Modern radar mast + crossbar + dome
        pushCyl(metal, 0.06, 0.11, 1.65, 6, 1.10, 3.58, -1.25, 0xcbd5e1);
        pushBox(metal, 0.96, 0.12, 0.09, 1.10, 4.08, -1.25, 0xe2e8f0);
      }
      addWindowStrip(win, 0.78, 2.12, -1.15, 5, 0.36, true, 0xfbbf24);
      addWindowStrip(win, 1.10, 2.66, -0.49, 3, 0.16, false, 0xfbbf24);
      addNavalTurret(matte, metal, -1.44, 1.14, 3.75, 0.75, 0x64748b, 0xcbd5e1, -0.3);
      addNavalTurret(matte, metal, 1.36, 1.14, -4.55, 0.75, 0x64748b, 0xcbd5e1, 2.8);
      for (const [fx, fz] of [[-0.68, -4.4], [-0.62, -2.6], [-0.56, -0.8], [-0.48, 1.0], [-0.36, 2.8], [0.34, 4.1]]) {
        addDeckAircraft(matte, metal, win, fx, 1.17, fz, 0x94a3b8, 0xe2e8f0, isPropEra, 0.14);
      }
    }
    return finalizeMultiFinishGroup(matte, metal, win, glow);
  }

  // =========================================================================
  // 2. SUBMARINE (Sea, Epoch 3+) — Sleek ~8.4 tiles long cigar riding half-submerged!
  // =========================================================================
  if (type === 'submarine') {
    if (species === 'elf') {
      pushCyl(matte, 0.46, 0.50, 5.4, 12, 0, 0.24, 0, 0x1e3a5f, Math.PI / 2, 0, 0);
      pushCyl(metal, 0.06, 0.46, 1.75, 12, 0, 0.24, 3.55, 0xc8a441, Math.PI / 2, 0, 0);
      pushCyl(matte, 0.46, 0.06, 1.95, 12, 0, 0.24, -3.65, 0x1e3a5f, Math.PI / 2, 0, 0);
      pushTaperedHull(matte, [[0.52, -1.6], [2.15, -0.4], [1.85, 0.8], [0.52, 1.8]], 0.12, 0.32, 0x2b5978, 0.03);
      pushCyl(glow, 0.34, 0.42, 1.35, 10, 0, 0.66, 0.45, 0x7dd3fc, Math.PI / 2, 0, 0);
    } else if (species === 'orc') {
      pushCyl(matte, 0.54, 0.54, 5.2, 10, 0, 0.26, -0.1, 0x3b3532, Math.PI / 2, 0, 0);
      pushCyl(matte, 0.16, 0.54, 1.55, 10, 0, 0.26, 3.25, 0x881b1b, Math.PI / 2, 0, 0);
      pushCyl(matte, 0.52, 0.14, 1.65, 10, 0, 0.26, -3.52, 0x2c2825, Math.PI / 2, 0, 0);
      pushBox(matte, 0.36, 1.08, 1.65, 0, 0.96, 0.45, 0x2c2825);
      pushCyl(metal, 0.05, 0.05, 0.95, 6, 0, 1.85, 0.65, 0x9ca3af);
      for (const side of [-1, 1]) {
        pushCyl(metal, 0.16, 0.16, 2.65, 8, side * 0.64, 0.26, 1.15, 0x57534e, Math.PI / 2, 0, 0);
      }
      pushCyl(glow, 0.22, 0.22, 0.14, 8, 0, 0.26, -4.38, 0xf97316, Math.PI / 2, 0, 0);
    } else if (species === 'dwarf') {
      pushCyl(matte, 0.58, 0.58, 4.8, 10, 0, 0.28, -0.1, 0x334155, Math.PI / 2, 0, 0);
      pushCyl(metal, 0.05, 0.54, 1.65, 10, 0, 0.28, 3.12, 0xd97706, Math.PI / 2, 0, 0);
      pushCyl(matte, 0.54, 0.20, 1.55, 10, 0, 0.28, -3.28, 0x334155, Math.PI / 2, 0, 0);
      for (const side of [-1, 1]) {
        pushCyl(metal, 0.26, 0.26, 4.25, 8, side * 0.74, 0.22, -0.1, 0xb45309, Math.PI / 2, 0, 0);
      }
      pushCyl(matte, 0.44, 0.52, 0.88, 10, 0, 1.02, 0.25, 0x475569);
      addWindowStrip(win, 0, 1.16, 0.74, 3, 0.22, false, 0xfbbf24);
    } else if (species === 'lizardfolk') {
      pushCyl(matte, 0.48, 0.52, 5.4, 10, 0, 0.24, 0, 0x1e293b, Math.PI / 2, 0, 0);
      pushCyl(matte, 0.12, 0.48, 1.75, 10, 0, 0.24, 3.55, 0x0f172a, Math.PI / 2, 0, 0);
      pushCyl(matte, 0.50, 0.10, 1.95, 10, 0, 0.24, -3.65, 0x1e293b, Math.PI / 2, 0, 0);
      for (const zs of [-2.2, -1.1, 0.0, 1.1, 2.2]) {
        pushBox(metal, 0.20, 0.48, 0.44, 0, 0.74, zs, 0xd4af37);
      }
      pushBox(matte, 2.15, 0.10, 0.72, 0, 0.24, -3.15, 0x334155);
      pushBox(glow, 0.16, 0.12, 0.22, -0.32, 0.44, 2.85, 0x34d399);
      pushBox(glow, 0.16, 0.12, 0.22, 0.32, 0.44, 2.85, 0x34d399);
    } else {
      // HUMAN: Sleek matte-charcoal nuclear/diesel attack submarine (~8.4 tiles long, 7.8:1 ratio!)
      const hullHex = e >= 5 ? 0x181d24 : 0x2a333f;
      pushCyl(matte, 0.50, 0.50, 5.5, 12, 0, 0.26, 0, hullHex, Math.PI / 2, 0, 0);
      pushCyl(matte, 0.10, 0.50, 1.48, 12, 0, 0.26, 3.48, hullHex, Math.PI / 2, 0, 0); // parabolic sonar bow
      pushCyl(matte, 0.50, 0.08, 1.90, 12, 0, 0.26, -3.68, hullHex, Math.PI / 2, 0, 0); // tapered tail
      // Streamlined conning tower sail + diving planes + twin slender periscopes
      pushTaperedHull(matte, [[0.16, -0.35], [0.26, 0.25], [0.24, 1.15], [0.06, 1.55]], 1.02, 1.54, 0x334155, 0.03);
      pushBox(metal, 1.68, 0.08, 0.38, 0, 1.10, 0.65, 0x475569);
      pushCyl(metal, 0.035, 0.045, 0.92, 6, -0.06, 1.98, 0.82, 0xcbd5e1);
      pushCyl(metal, 0.03, 0.04, 0.68, 6, 0.07, 1.86, 0.45, 0x94a3b8);
      pushBox(matte, 0.10, 0.92, 0.68, 0, 0.46, -3.92, 0x334155);
      pushBox(metal, 1.62, 0.08, 0.44, 0, 0.26, -3.82, 0x475569);
      addWindowStrip(win, 0, 1.34, 1.52, 3, 0.13, false, 0xfbbf24);
    }
    return finalizeMultiFinishGroup(matte, metal, win, glow);
  }

  // =========================================================================
  // 3. MOBILE SENTRY -> 4-LEGGED SPIDER WALKING SENTRY (Land, Epoch 3+)
  //    - Epoch 3 (Industrial): Wheeled Armored Gun-Carriage Sentry (NO walker legs!)
  //    - Epoch 4 (Atomic):     8x8 Armored Radar Sentry Vehicle (NO walker legs!)
  //    - Epoch 5 (Info):       4-Legged Articulated Spider-Like Walking Sentry!
  //    - Epoch 6+ (Orbital):   Apex 4-Legged Plasma/Orbital Spider-Walker!
  // =========================================================================
  if (type === 'siege_artillery') {
    const isSpiderWalker = e >= 5;
    const isOrbitalWalker = e >= 6;

    // Helper: push a 3D strut connecting point A to point B cleanly
    const pushStrut = (
      target: THREE.BufferGeometry[],
      ax: number,
      ay: number,
      az: number,
      bx: number,
      by: number,
      bz: number,
      rTop: number,
      rBot: number,
      hex: number,
    ) => {
      const dx = bx - ax;
      const dy = by - ay;
      const dz = bz - az;
      const len = Math.hypot(dx, dy, dz);
      if (len < 0.001) return;
      const g = new THREE.CylinderGeometry(rTop, rBot, len, 6);
      const dir = new THREE.Vector3(dx, dy, dz).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      g.applyQuaternion(quat);
      g.translate((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
      pushGeo(target, g, hex);
    };

    if (!isSpiderWalker) {
      // --- INDUSTRIAL (Epoch 3) & ATOMIC (Epoch 4): WHEELED ARMORED SENTRY CARRIAGES (NO WALKER LEGS) ---
      const isAtomicRadar = e === 4;
      const wheelCount = isAtomicRadar ? 4 : 3;
      const hullPrimary =
        species === 'elf'
          ? 0xf2ede0
          : species === 'orc'
            ? 0x3b3532
            : species === 'dwarf'
              ? 0x334155
              : species === 'lizardfolk'
                ? 0x1e293b
                : isAtomicRadar
                  ? 0x4b5563
                  : 0x4d5d42;
      const trimCol =
        species === 'elf'
          ? 0xc8a441
          : species === 'orc'
            ? 0x881b1b
            : species === 'dwarf'
              ? 0xb45309
              : species === 'lizardfolk'
                ? 0xca8a04
                : 0x64748b;
      const accentGlow =
        species === 'elf'
          ? 0xc084fc
          : species === 'orc'
            ? 0xf97316
            : species === 'dwarf'
              ? 0xf59e0b
              : species === 'lizardfolk'
                ? 0x34d399
                : 0x60a5fa;

      // Sleek compact armored wheeled chassis (~2.7 tiles long x 1.45 wide)
      pushTaperedHull(
        matte,
        [
          [0.58, -1.25],
          [0.68, -0.35],
          [0.68, 0.85],
          [0.44, 1.38],
        ],
        0.48,
        0.78,
        hullPrimary,
        0.04,
      );
      // Side wheel arches & cylindrical armored wheels (6x6 in Industrial, 8x8 in Atomic)
      for (const side of [-1, 1]) {
        pushBox(matte, 0.22, 0.14, 2.35, side * 0.72, 0.54, 0, trimCol);
        for (let wi = 0; wi < wheelCount; wi++) {
          const wz = -0.95 + (wi / Math.max(1, wheelCount - 1)) * 1.9;
          pushCyl(matte, 0.24, 0.24, 0.18, 10, side * 0.74, 0.24, wz, 0x1f2328, 0, 0, Math.PI / 2);
          pushCyl(metal, 0.11, 0.11, 0.20, 6, side * 0.74, 0.24, wz, trimCol, 0, 0, Math.PI / 2);
        }
      }
      // Race-distinct compact sentry turret cupola + twin weapons
      if (species === 'elf') {
        pushCyl(matte, 0.36, 0.48, 0.36, 8, 0, 0.98, -0.05, 0xf8f5eb);
        pushCyl(metal, 0.05, 0.08, 1.45, 6, -0.22, 1.04, 0.65, 0xc8a441, Math.PI / 2 - 0.12, 0, 0);
        pushCyl(metal, 0.05, 0.08, 1.45, 6, 0.22, 1.04, 0.65, 0xc8a441, Math.PI / 2 - 0.12, 0, 0);
        pushBox(glow, 0.24, 0.16, 0.14, 0, 1.04, 0.38, accentGlow);
      } else if (species === 'orc') {
        pushBox(matte, 0.92, 0.44, 0.96, 0, 1.02, -0.1, 0x881b1b);
        pushBox(metal, 1.38, 0.22, 0.26, 0, 0.42, 1.42, 0x71717a); // spiked ram bumper
        pushCyl(metal, 0.10, 0.12, 1.42, 6, -0.24, 1.05, 0.65, 0x27272a, Math.PI / 2 - 0.1, 0, 0);
        pushCyl(metal, 0.10, 0.12, 1.42, 6, 0.24, 1.05, 0.65, 0x27272a, Math.PI / 2 - 0.1, 0, 0);
        pushCyl(metal, 0.08, 0.10, 0.85, 6, 0.42, 1.25, -0.95, 0x18181b); // exhaust stack
        pushBox(win, 0.44, 0.10, 0.08, 0, 1.08, 0.40, 0xfbbf24);
      } else if (species === 'dwarf') {
        pushCyl(matte, 0.46, 0.56, 0.42, 8, 0, 1.00, -0.05, 0x475569);
        pushCyl(metal, 0.48, 0.48, 0.08, 8, 0, 1.22, -0.05, 0xd97706);
        pushCyl(metal, 0.11, 0.14, 1.35, 8, -0.24, 1.04, 0.62, 0xb45309, Math.PI / 2 - 0.18, 0, 0);
        pushCyl(metal, 0.11, 0.14, 1.35, 8, 0.24, 1.04, 0.62, 0xb45309, Math.PI / 2 - 0.18, 0, 0);
        pushCyl(metal, 0.12, 0.14, 0.72, 8, 0, 1.18, -0.88, 0xb45309); // steam boiler funnel
        pushBox(glow, 0.34, 0.16, 0.10, 0, 0.62, -1.26, accentGlow);
      } else if (species === 'lizardfolk') {
        pushBox(matte, 0.96, 0.26, 0.96, 0, 0.92, -0.05, 0x1e293b);
        pushBox(metal, 0.68, 0.24, 0.68, 0, 1.16, -0.05, 0xca8a04);
        pushCyl(glow, 0.06, 0.20, 0.78, 4, 0, 1.62, -0.05, accentGlow);
        pushCyl(metal, 0.08, 0.10, 1.15, 6, 0, 1.06, 0.68, 0xca8a04, Math.PI / 2 - 0.12, 0, 0);
      } else {
        // Human Armored Gun-Carriage (Epoch 3) -> 8x8 Radar Sentry Vehicle (Epoch 4)
        pushBox(matte, 0.88, 0.42, 1.04, 0, 1.00, -0.1, 0x64748b);
        pushCyl(metal, 0.06, 0.08, 1.55, 6, -0.20, 1.04, 0.72, 0x94a3b8, Math.PI / 2 - 0.14, 0, 0);
        pushCyl(metal, 0.06, 0.08, 1.55, 6, 0.20, 1.04, 0.72, 0x94a3b8, Math.PI / 2 - 0.14, 0, 0);
        addWindowStrip(win, 0, 0.64, 1.38, 3, 0.18, false, 0xfbbf24);
      }
      if (isAtomicRadar) {
        // Atomic Age rotating radar dish + missile pod atop the wheeled sentry
        pushCyl(metal, 0.05, 0.06, 0.48, 6, 0, 1.44, -0.35, 0x94a3b8);
        pushBox(metal, 0.62, 0.24, 0.08, 0, 1.68, -0.35, 0xe2e8f0, -0.22, 0, 0);
        pushBox(glow, 0.12, 0.12, 0.06, 0, 1.68, -0.30, accentGlow);
      }
    } else {
      // --- INFORMATION AGE (Epoch 5) & ORBITAL/INTERSTELLAR (Epoch 6+): 4-LEGGED SPIDER WALKING SENTRY! ---
      const bodyY = isOrbitalWalker ? 1.08 : 0.96;
      const bodyHex =
        species === 'elf'
          ? 0xf5f0e2
          : species === 'orc'
            ? 0x3b3532
            : species === 'dwarf'
              ? 0x334155
              : species === 'lizardfolk'
                ? 0x1e293b
                : isOrbitalWalker
                  ? 0x475569
                  : 0x374151;
      const legHex =
        species === 'elf'
          ? 0xc8a441
          : species === 'orc'
            ? 0x57534e
            : species === 'dwarf'
              ? 0xb45309
              : species === 'lizardfolk'
                ? 0xca8a04
                : 0x1f242b;
      const jointHex =
        species === 'elf'
          ? 0xf8f5eb
          : species === 'orc'
            ? 0x881b1b
            : species === 'dwarf'
              ? 0xd97706
              : species === 'lizardfolk'
                ? 0xd4af37
                : 0x94a3b8;
      const eyeGlow =
        species === 'elf'
          ? 0xc084fc
          : species === 'orc'
            ? 0xf97316
            : species === 'dwarf'
              ? 0xf59e0b
              : species === 'lizardfolk'
                ? 0x34d399
                : 0x38bdf8;

      // 4 Articulated High-Kneed Arachnid Spider Legs radiating at 45°, 135°, 225°, 315°
      const legAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
      const hipR = 0.48;
      const kneeR = isOrbitalWalker ? 1.28 : 1.15;
      const kneeY = bodyY + (isOrbitalWalker ? 0.56 : 0.46);
      const footR = isOrbitalWalker ? 1.62 : 1.48;
      for (const ang of legAngles) {
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const hx = ca * hipR;
        const hz = sa * hipR;
        const kx = ca * kneeR;
        const kz = sa * kneeR;
        const fx = ca * footR;
        const fz = sa * footR;

        // Hip joint socket
        pushCyl(metal, 0.14, 0.14, 0.16, 8, hx, bodyY, hz, jointHex);
        // Upper femur angled UP and OUT to high spider knee
        pushStrut(metal, hx, bodyY, hz, kx, kneeY, kz, 0.085, 0.11, legHex);
        // Armored knee joint hub (+ glowing actuator in Orbital Age)
        pushCyl(matte, 0.15, 0.15, 0.18, 8, kx, kneeY, kz, jointHex);
        if (isOrbitalWalker) {
          pushCyl(glow, 0.09, 0.09, 0.22, 6, kx, kneeY, kz, eyeGlow);
        }
        // Lower tibia angled DOWN and OUT to clawed footpad
        pushStrut(matte, kx, kneeY, kz, fx, 0.10, fz, 0.06, 0.095, legHex);
        // Armored arachnid footpad
        pushCyl(metal, 0.12, 0.18, 0.12, 6, fx, 0.06, fz, jointHex);
      }

      // Race-Unique Central Spider-Sentry Carapace & Twin Weapon Pods
      if (species === 'elf') {
        // Sylvan Weaver-Strider: graceful domed ivory carapace, amethyst eye core & twin starlight lances
        pushCyl(matte, 0.48, 0.66, 0.44, 8, 0, bodyY + 0.12, 0, bodyHex);
        pushCyl(metal, 0.14, 0.44, 0.34, 8, 0, bodyY + 0.48, -0.04, 0xc8a441);
        pushCyl(glow, 0.22, 0.22, 0.16, 8, 0, bodyY + 0.16, 0.56, eyeGlow, Math.PI / 2, 0, 0);
        for (const side of [-1, 1]) {
          pushCyl(metal, 0.05, 0.075, 1.38, 6, side * 0.58, bodyY + 0.10, 0.52, 0xc8a441, Math.PI / 2, 0, 0);
          pushCyl(glow, 0.04, 0.04, 0.35, 6, side * 0.58, bodyY + 0.10, 1.24, eyeGlow, Math.PI / 2, 0, 0);
        }
        if (isOrbitalWalker) {
          pushTorus(glow, 0.62, 0.06, 6, 16, 0, bodyY + 0.62, -0.04, eyeGlow);
        }
      } else if (species === 'orc') {
        // Orc Scrap-Skuttler: brutal riveted crimson-and-iron spider turret with rotary dakka cannons & exhausts
        pushBox(matte, 1.12, 0.58, 1.18, 0, bodyY + 0.14, 0, bodyHex);
        pushBox(matte, 0.92, 0.34, 0.88, 0, bodyY + 0.54, -0.05, 0x881b1b);
        pushBox(glow, 0.58, 0.14, 0.10, 0, bodyY + 0.22, 0.60, eyeGlow); // angry glowing visor slit
        for (const side of [-1, 1]) {
          pushCyl(metal, 0.12, 0.14, 1.32, 6, side * 0.68, bodyY + 0.14, 0.52, 0x18181b, Math.PI / 2, 0, 0);
          pushCyl(metal, 0.08, 0.10, 0.68, 6, side * 0.38, bodyY + 0.78, -0.42, 0x262626);
        }
        if (isOrbitalWalker) {
          pushCyl(glow, 0.10, 0.10, 0.24, 6, -0.68, bodyY + 0.14, 1.22, eyeGlow, Math.PI / 2, 0, 0);
          pushCyl(glow, 0.10, 0.10, 0.24, 6, 0.68, bodyY + 0.14, 1.22, eyeGlow, Math.PI / 2, 0, 0);
        }
      } else if (species === 'dwarf') {
        // Runeforge Forge-Spider: heavy armored octagonal ironclad carapace, amber furnace core & twin heavy mortars
        pushCyl(matte, 0.62, 0.74, 0.54, 8, 0, bodyY + 0.14, 0, bodyHex);
        pushCyl(metal, 0.66, 0.66, 0.10, 8, 0, bodyY + 0.44, 0, 0xd97706);
        pushBox(glow, 0.42, 0.22, 0.12, 0, bodyY + 0.18, 0.66, eyeGlow);
        for (const side of [-1, 1]) {
          pushCyl(metal, 0.13, 0.17, 1.25, 8, side * 0.68, bodyY + 0.26, 0.46, 0xb45309, Math.PI / 2 - 0.18, 0, 0);
        }
        if (isOrbitalWalker) {
          pushCyl(glow, 0.28, 0.28, 0.28, 8, 0, bodyY + 0.62, 0, eyeGlow);
        }
      } else if (species === 'lizardfolk') {
        // Temple-Scarab Sentry Walker: stepped obsidian-and-gold carapace + blazing emerald sun-beam obelisk
        pushBox(matte, 1.18, 0.34, 1.18, 0, bodyY + 0.06, 0, bodyHex);
        pushBox(metal, 0.86, 0.28, 0.86, 0, bodyY + 0.36, 0, 0xca8a04);
        pushCyl(glow, 0.06, 0.28, 0.92, 4, 0, bodyY + 0.86, 0, eyeGlow);
        pushBox(glow, 0.36, 0.16, 0.12, 0, bodyY + 0.12, 0.60, eyeGlow);
        for (const side of [-1, 1]) {
          pushCyl(metal, 0.07, 0.09, 1.18, 6, side * 0.64, bodyY + 0.12, 0.48, 0xd4af37, Math.PI / 2, 0, 0);
        }
      } else {
        // HUMAN: Sleek Tactical 4-Legged Spider-Sentry (Info Age) -> Orbital Plasma Spider-Walker (Orbital+)
        pushCyl(matte, 0.56, 0.68, 0.46, 8, 0, bodyY + 0.12, 0, bodyHex);
        pushBox(matte, 0.82, 0.28, 0.94, 0, bodyY + 0.44, -0.06, 0x181b20); // matte-black turret crown
        // Iconic glowing cyclops optic visor
        pushBox(glow, 0.46, 0.14, 0.10, 0, bodyY + 0.16, 0.64, eyeGlow);
        // Twin shoulder-mounted rail-autocannons
        for (const side of [-1, 1]) {
          pushBox(matte, 0.22, 0.24, 0.68, side * 0.68, bodyY + 0.18, 0.05, 0x4b5563);
          pushCyl(metal, 0.05, 0.065, 1.42, 6, side * 0.68, bodyY + 0.18, 0.72, 0x94a3b8, Math.PI / 2, 0, 0);
          if (isOrbitalWalker) {
            pushCyl(glow, 0.04, 0.04, 0.42, 6, side * 0.68, bodyY + 0.18, 1.38, eyeGlow, Math.PI / 2, 0, 0);
          }
        }
        // Top tactical sensor dish / orbital plasma ring
        if (isOrbitalWalker) {
          pushTorus(metal, 0.52, 0.06, 6, 14, 0, bodyY + 0.72, -0.06, 0x64748b);
          pushCyl(glow, 0.18, 0.18, 0.16, 8, 0, bodyY + 0.72, -0.06, eyeGlow);
        } else {
          pushCyl(metal, 0.04, 0.05, 0.36, 6, 0.22, bodyY + 0.74, -0.22, 0xcbd5e1);
          pushBox(metal, 0.42, 0.18, 0.06, 0.22, bodyY + 0.92, -0.22, 0xe2e8f0, -0.2, 0, 0);
        }
      }
    }
    return finalizeMultiFinishGroup(matte, metal, win, glow);
  }

  // =========================================================================
  // 4. SKY CANNONSHIP (Air, Epoch 4+) — Sleek ~9.6 tiles long aerial frigate!
  // =========================================================================
  if (type === 'sky_cannonship') {
    if (species === 'elf') {
      pushTaperedHull(matte, [[0.45, -4.6], [0.95, -2.4], [1.02, 1.9], [0.60, 4.0], [0.0, 5.1]], 0.82, 0.44, 0xf2ede0, 0.07);
      pushTaperedHull(matte, [[0.85, -1.8], [3.65, -0.8], [3.15, 0.4], [0.95, 1.4]], 0.18, 0.18, 0xe8e2d0, 0.04);
      pushBox(matte, 0.76, 0.90, 2.15, 0, 0.86, -1.35, 0xf8f5eb);
      addWindowStrip(win, 0, 1.04, -0.25, 4, 0.18, false, 0xfef08a);
      addDuctedTurbine(matte, metal, glow, -2.55, 0.0, -0.35, 0.82, 0xc8a441, 0xf8f5eb, 0x60a5fa);
      addDuctedTurbine(matte, metal, glow, 2.55, 0.0, -0.35, 0.82, 0xc8a441, 0xf8f5eb, 0x60a5fa);
      addNavalTurret(matte, metal, 0, 0.45, 2.55, 1.02, 0xc8a441, 0xf8fafc, 0);
    } else if (species === 'orc') {
      pushTaperedHull(matte, [[1.05, -4.4], [1.42, -2.6], [1.46, 2.2], [1.02, 4.1], [0.0, 4.9]], 1.22, 0.60, 0x3b3532, 0.07);
      pushBox(matte, 1.32, 0.86, 2.25, 0, 1.02, -1.55, 0x5c2b22);
      addWindowStrip(win, 0, 1.16, -0.40, 4, 0.28, false, 0xfbbf24);
      for (const zb of [-1.65, 0.0, 1.65]) {
        pushCyl(metal, 0.13, 0.17, 4.45, 8, 0, -0.10, zb, 0x18181b, 0, 0, Math.PI / 2);
      }
      for (const [rx, rz] of [[-2.35, 1.65], [2.35, 1.65], [-2.35, -1.75], [2.35, -1.75]]) {
        addDuctedTurbine(matte, metal, glow, rx, 0.22, rz, 0.84, 0x262626, 0x991b1b, 0xf97316);
      }
      addNavalTurret(matte, metal, 0, 0.60, 2.45, 1.12, 0x991b1b, 0x18181b, 0);
    } else if (species === 'dwarf') {
      pushTaperedHull(matte, [[1.02, -4.4], [1.34, -2.5], [1.36, 2.4], [0.94, 4.2], [0.0, 4.9]], 1.14, 0.58, 0x475569, 0.07);
      for (const side of [-1, 1]) {
        pushCyl(matte, 0.54, 0.54, 6.2, 10, side * 1.82, 0.12, -0.15, 0x334155, Math.PI / 2, 0, 0);
        pushCyl(metal, 0.10, 0.54, 1.35, 10, side * 1.82, 0.12, 3.62, 0xb45309, Math.PI / 2, 0, 0);
        pushCyl(glow, 0.40, 0.40, 0.20, 8, side * 1.82, 0.12, -3.32, 0xf59e0b, Math.PI / 2, 0, 0);
      }
      for (const zb of [-1.45, 0.25, 1.95]) {
        pushCyl(metal, 0.12, 0.15, 4.95, 8, 0, 0.05, zb, 0xb45309, 0, 0, Math.PI / 2);
      }
      addNavalTurret(matte, metal, 0, 0.60, 2.45, 1.12, 0xb45309, 0x1e293b, 0);
      addNavalTurret(matte, metal, 0, 0.60, -2.55, 1.12, 0xb45309, 0x1e293b, Math.PI);
    } else if (species === 'lizardfolk') {
      pushTaperedHull(matte, [[1.12, -4.3], [1.58, -2.2], [1.58, 2.2], [1.02, 4.1], [0.0, 4.8]], 0.90, 0.46, 0x1e293b, 0.07);
      pushTaperedHull(metal, [[0.82, -3.1], [1.20, -1.4], [1.20, 1.4], [0.66, 2.9]], 0.58, 1.04, 0xca8a04, 0.04);
      pushBox(matte, 1.22, 0.62, 2.25, 0, 1.38, -0.35, 0x1e293b);
      pushCyl(glow, 0.05, 0.40, 1.12, 4, 0, 2.20, -0.35, 0x34d399);
      for (const [px, pz] of [[-2.35, 2.05], [2.35, 2.05], [-2.35, -2.05], [2.35, -2.05]]) {
        pushCyl(metal, 0.32, 0.32, 1.22, 6, px, 0.15, pz, 0xca8a04);
        pushCyl(glow, 0.22, 0.05, 0.70, 6, px, -0.76, pz, 0x34d399);
      }
    } else {
      // HUMAN: Sleek UNSC-style aerial broadside frigate (~9.8 tiles long) with Alien-Mothership matte/steel palette!
      pushTaperedHull(matte, [[0.92, -4.6], [1.34, -2.8], [1.36, 2.5], [0.86, 4.4], [0.0, 5.2]], 1.04, 0.52, 0x6b7280, 0.07);
      pushBox(matte, 1.52, 0.22, 5.4, 0, 0.62, 0.45, 0x181b20); // matte black dorsal deck plate
      pushBox(matte, 1.36, 0.84, 2.35, 0, 0.94, -1.45, 0x9ca3af);
      pushBox(matte, 1.56, 0.42, 1.45, 0, 1.52, -1.45, 0x181b20);
      addWindowStrip(win, 0, 1.54, -0.70, 5, 0.24, false, 0xfbbf24);
      for (const [rx, rz] of [[-2.25, 1.55], [2.25, 1.55], [-2.25, -1.85], [2.25, -1.85]]) {
        addDuctedTurbine(matte, metal, glow, rx, 0.08, rz, 0.86, 0x374151, 0x9ca3af, 0x60a5fa);
      }
      addNavalTurret(matte, metal, 0, 0.72, 2.65, 1.08, 0x6b7280, 0x181b20, 0);
      addNavalTurret(matte, metal, 0, 0.72, -3.25, 1.02, 0x6b7280, 0x181b20, Math.PI);
      // Twin underslung bow siege railgun barrels
      for (const side of [-1, 1]) {
        pushCyl(metal, 0.10, 0.13, 3.45, 8, side * 0.60, -0.56, 3.35, 0x181b20, Math.PI / 2, 0, 0);
        pushCyl(glow, 0.09, 0.09, 0.24, 6, side * 0.60, -0.56, 5.12, 0x60a5fa, Math.PI / 2, 0, 0);
      }
    }
    return finalizeMultiFinishGroup(matte, metal, win, glow);
  }

  // =========================================================================
  // 5. SKY CARRIER / AIR CARRIER (Air, Epoch 5+) — ~12.4 tiles long helicarrier!
  // =========================================================================
  if (type === 'sky_carrier') {
    if (species === 'elf') {
      pushTaperedHull(matte, [[1.22, -5.7], [1.68, -3.2], [1.74, 2.9], [1.18, 5.2], [0.0, 6.3]], 0.82, 0.50, 0xf2ede0, 0.07);
      pushTaperedHull(matte, [[1.62, -2.2], [3.60, -0.6], [3.40, 0.8], [1.62, 2.2]], 0.24, 0.24, 0xe8e2d0, 0.04);
      pushBox(matte, 0.76, 1.45, 2.45, 1.30, 1.22, -1.25, 0xf8f5eb);
      pushCyl(metal, 0.10, 0.26, 1.55, 6, 1.30, 2.62, -1.25, 0xc8a441);
      pushCyl(glow, 0.20, 0.05, 0.65, 6, 1.30, 3.60, -1.25, 0xc084fc);
      pushTorus(glow, 1.32, 0.16, 6, 16, 0, -0.40, 0, 0xc084fc);
      for (const [rx, rz] of [[-2.95, 0], [2.95, 0]]) {
        addDuctedTurbine(matte, metal, glow, rx, 0.04, rz, 1.12, 0xc8a441, 0xf8f5eb, 0x60a5fa);
      }
      for (const zf of [-4.0, -2.2, -0.4, 1.4, 3.2]) {
        addDeckAircraft(matte, metal, win, -0.62, 0.52, zf, 0xc8a441, 0xf8f5eb, false, 0.12);
      }
    } else if (species === 'orc') {
      pushTaperedHull(matte, [[1.44, -5.7], [1.90, -3.4], [1.96, 3.0], [1.48, 5.2], [0.72, 6.1]], 1.02, 0.56, 0x3b3532, 0.07);
      pushBox(metal, 1.90, 0.18, 2.15, -0.25, 0.82, 5.2, 0x991b1b, -0.18, 0, 0);
      pushBox(matte, 0.94, 1.52, 2.75, 1.44, 1.32, -1.35, 0x5c2b22);
      addWindowStrip(win, 0.95, 1.64, -1.35, 5, 0.42, true, 0xfbbf24);
      for (const [rx, rz] of [[-3.15, 2.65], [3.15, 2.65], [-3.15, -2.65], [3.15, -2.65]]) {
        addDuctedTurbine(matte, metal, glow, rx, 0.10, rz, 1.15, 0x262626, 0x991b1b, 0xf97316);
      }
      addNavalTurret(matte, metal, -1.76, 0.58, 3.45, 1.08, 0x991b1b, 0x18181b, -0.4);
      for (const zf of [-3.8, -2.0, -0.2, 1.6, 3.4]) {
        addDeckAircraft(matte, metal, win, -0.68, 0.59, zf, 0xb91c1c, 0x3f3a36, false, 0.15);
      }
    } else if (species === 'dwarf') {
      pushTaperedHull(matte, [[1.52, -5.6], [1.98, -3.2], [2.02, 3.1], [1.52, 5.2], [0.70, 6.0]], 1.08, 0.60, 0x334155, 0.07);
      pushBox(metal, 0.16, 0.04, 10.4, -0.24, 0.63, 0.1, 0xd97706);
      pushBox(matte, 1.00, 1.48, 2.85, 1.46, 1.36, -1.25, 0x475569);
      addWindowStrip(win, 0.94, 1.62, -1.25, 5, 0.44, true, 0xfbbf24);
      for (const [rx, rz] of [[-3.15, 2.55], [3.15, 2.55], [-3.15, -2.55], [3.15, -2.55]]) {
        addDuctedTurbine(matte, metal, glow, rx, 0.06, rz, 1.12, 0xb45309, 0x334155, 0xf59e0b);
      }
      addNavalTurret(matte, metal, -1.80, 0.62, 3.45, 1.08, 0xb45309, 0x1e293b, -0.35);
      for (const zf of [-3.8, -2.0, -0.2, 1.6, 3.4]) {
        addDeckAircraft(matte, metal, win, -0.62, 0.63, zf, 0xd97706, 0x475569, false, 0.10);
      }
    } else if (species === 'lizardfolk') {
      pushTaperedHull(matte, [[1.44, -5.6], [1.92, -3.2], [2.00, 3.0], [1.42, 5.2], [0.62, 6.1]], 0.92, 0.54, 0x1e293b, 0.07);
      pushBox(metal, 0.20, 0.04, 10.2, -0.32, 0.57, 0.1, 0xd4af37);
      pushBox(glow, 0.10, 0.05, 9.2, -0.78, 0.57, 0.15, 0x34d399);
      pushBox(matte, 1.20, 0.50, 2.65, 1.36, 0.84, -1.15, 0x1e293b);
      pushBox(metal, 0.86, 0.46, 1.95, 1.36, 1.32, -1.15, 0xca8a04);
      pushCyl(glow, 0.05, 0.34, 0.94, 4, 1.36, 2.10, -1.15, 0x34d399);
      for (const [rx, rz] of [[-3.05, 2.35], [3.05, 2.35], [-3.05, -2.35], [3.05, -2.35]]) {
        addDuctedTurbine(matte, metal, glow, rx, 0.04, rz, 1.04, 0x1e293b, 0xd4af37, 0x34d399);
      }
      for (const zf of [-3.6, -1.8, 0.0, 1.8, 3.6]) {
        addDeckAircraft(matte, metal, win, -0.68, 0.57, zf, 0xd4af37, 0x1e293b, false, 0.12);
      }
    } else {
      // HUMAN: Sleek Helicarrier (~12.6 tiles long) matching Alien Mothership matte-black/grey/ice-blue finish!
      pushTaperedHull(matte, [[1.30, -5.9], [1.64, -4.0], [1.68, 3.3], [1.30, 5.5], [0.84, 6.3]], 0.92, 0.54, 0x4b5563, 0.07);
      pushTaperedHull(matte, [[1.18, -5.6], [1.48, -3.8], [1.52, 3.2], [1.16, 5.3], [0.76, 6.0]], 0.14, 0.62, 0x181b20, 0.02);
      pushBox(matte, 1.12, 0.18, 6.8, -1.56, 0.50, -0.85, 0x181b20, 0, 0.13, 0);
      pushBox(matte, 0.10, 0.025, 10.6, -0.22, 0.65, 0.1, 0xe5e7eb);
      pushBox(matte, 0.09, 0.025, 6.2, -1.44, 0.61, -0.85, 0xe5e7eb, 0, 0.13, 0);
      pushBox(glow, 0.07, 0.03, 10.2, 0.34, 0.65, 0.25, 0x60a5fa);
      pushBox(matte, 0.80, 1.34, 2.65, 1.32, 1.28, -1.25, 0x6b7280);
      pushBox(matte, 0.66, 0.44, 1.65, 1.32, 2.12, -1.30, 0x181b20);
      pushCyl(metal, 0.07, 0.12, 1.55, 6, 1.32, 2.95, -1.35, 0xcbd5e1);
      addWindowStrip(win, 0.91, 1.62, -1.25, 5, 0.40, true, 0xfbbf24);
      for (const [rx, rz] of [[-3.18, 2.85], [3.18, 2.85], [-3.18, -2.85], [3.18, -2.85]]) {
        addDuctedTurbine(matte, metal, glow, rx, 0.06, rz, 1.24, 0x374151, 0x9ca3af, 0x60a5fa);
      }
      addNavalTurret(matte, metal, -1.82, 0.62, 3.65, 1.02, 0x6b7280, 0x181b20, -0.3);
      addNavalTurret(matte, metal, 1.62, 0.62, -4.45, 1.02, 0x6b7280, 0x181b20, 2.7);
      for (const [fx, fz] of [[-0.78, -4.2], [-0.72, -2.5], [-0.64, -0.8], [-0.56, 1.0], [-0.46, 2.8], [0.35, 4.1]]) {
        addDeckAircraft(matte, metal, win, fx, 0.65, fz, 0x94a3b8, 0xe2e8f0, false, 0.14);
      }
    }
    return finalizeMultiFinishGroup(matte, metal, win, glow);
  }

  // =========================================================================
  // 6. ORBITAL MOTHERSHIP (Orbital / Interstellar, Epoch 6+) — ~14.6 tiles (~1/2 Alien Mothership!)
  // =========================================================================
  if (type === 'orbital_mothership') {
    if (species === 'elf') {
      pushTaperedHull(matte, [[0.85, -6.7], [1.62, -4.2], [1.82, 2.3], [1.20, 5.5], [0.0, 7.3]], 1.42, 0.70, 0xf5f0e2, 0.10);
      pushTaperedHull(matte, [[1.62, -2.6], [5.45, -1.0], [4.65, 0.6], [1.62, 2.4]], 0.30, 0.24, 0xe8e2d0, 0.05);
      pushCyl(matte, 0.24, 0.82, 3.85, 10, 0, 2.42, -1.25, 0xf8f5eb);
      pushCyl(metal, 0.05, 0.26, 1.85, 8, 0, 5.10, -1.25, 0xc8a441);
      pushTorus(metal, 3.25, 0.22, 8, 24, 0, 0.85, -0.65, 0xc8a441);
      pushTorus(glow, 3.25, 0.10, 6, 24, 0, 0.85, -0.65, 0xc084fc);
      pushCyl(glow, 0.82, 0.42, 0.92, 10, 0, -1.02, 0.85, 0xc084fc);
      addWindowStrip(win, 0, 2.20, 0.42, 5, 0.30, false, 0xfef08a);
    } else if (species === 'orc') {
      pushTaperedHull(matte, [[1.82, -6.3], [2.62, -3.6], [2.72, 2.4], [1.92, 5.2], [0.62, 6.5]], 2.12, 1.06, 0x36322f, 0.10);
      pushBox(matte, 3.40, 1.42, 5.65, 0, 1.62, -1.25, 0x4d4540);
      pushBox(matte, 2.12, 1.02, 2.25, 0, 2.82, -2.15, 0x881b1b);
      addWindowStrip(win, 0, 2.86, -0.98, 5, 0.34, false, 0xfbbf24);
      for (const side of [-1, 1]) {
        pushCyl(metal, 0.07, 0.40, 3.65, 8, side * 1.62, 0.14, 7.25, 0xa1a1aa, Math.PI / 2 - 0.08, 0, 0);
        pushCyl(metal, 0.62, 0.76, 2.45, 8, side * 1.44, 0.14, -6.65, 0x262626, Math.PI / 2, 0, 0);
        pushCyl(glow, 0.50, 0.50, 0.20, 8, side * 1.44, 0.14, -7.92, 0xf97316, Math.PI / 2, 0, 0);
      }
      addNavalTurret(matte, metal, -1.62, 1.12, 3.25, 1.42, 0x881b1b, 0x18181b, -0.2);
      addNavalTurret(matte, metal, 1.62, 1.12, 3.25, 1.42, 0x881b1b, 0x18181b, 0.2);
      pushCyl(glow, 0.92, 0.52, 0.82, 8, 0, -1.22, 1.65, 0xf97316);
    } else if (species === 'dwarf') {
      pushTorus(matte, 4.45, 1.22, 6, 8, 0, 0.15, 0, 0x334155);
      pushTorus(metal, 4.55, 0.26, 6, 8, 0, 1.20, 0, 0xd97706);
      pushTorus(metal, 4.55, 0.26, 6, 8, 0, -0.90, 0, 0xb45309);
      for (let ai = 0; ai < 4; ai++) {
        const ang = (ai * Math.PI) / 2 + Math.PI / 4;
        addNavalTurret(matte, metal, Math.cos(ang) * 4.45, 1.30, Math.sin(ang) * 4.45, 1.42, 0xb45309, 0x1e293b, ang);
      }
      pushCyl(glow, 1.32, 1.32, 1.92, 10, 0, 0.15, 0, 0xf59e0b);
      pushTorus(glow, 2.22, 0.16, 6, 16, 0, 0.15, 0, 0xfbbf24);
    } else if (species === 'lizardfolk') {
      pushBox(matte, 9.2, 1.02, 9.2, 0, -0.25, 0, 0x1e293b);
      pushBox(metal, 7.1, 1.00, 7.1, 0, 0.76, 0, 0xca8a04);
      pushBox(matte, 4.9, 1.00, 4.9, 0, 1.76, 0, 0x1f2937);
      pushBox(metal, 2.8, 0.92, 2.8, 0, 2.72, 0, 0xd4af37);
      pushCyl(glow, 0.10, 1.12, 2.12, 4, 0, 4.10, 0, 0x34d399);
      pushCyl(glow, 1.22, 0.42, 1.12, 6, 0, -1.22, 0, 0xfacc15);
      for (const [ox, oz] of [[-5.4, 5.4], [5.4, 5.4], [-5.4, -5.4], [5.4, -5.4]]) {
        pushCyl(metal, 0.34, 0.54, 3.22, 4, ox, 0.64, oz, 0xca8a04);
        pushCyl(glow, 0.07, 0.32, 1.12, 4, ox, 2.62, oz, 0x34d399);
      }
    } else {
      // HUMAN: Monumental 14.6-tile Ring-Ark Dreadnought matching the Alien Mothership's crisp steel/black/amber/ice-blue finish!
      pushTaperedHull(matte, [[1.32, -6.9], [2.12, -4.4], [2.22, 2.7], [1.52, 5.9], [0.0, 7.5]], 1.62, 0.84, 0x6b7280, 0.10);
      pushBox(matte, 1.82, 0.22, 9.4, 0, 0.96, 0.85, 0x181b20); // matte black dorsal deck
      pushBox(matte, 2.12, 1.42, 2.85, 0, 1.60, -3.65, 0x9ca3af);
      pushBox(matte, 2.52, 0.70, 1.85, 0, 2.52, -3.55, 0x181b20);
      addWindowStrip(win, 0, 2.55, -2.58, 6, 0.32, false, 0xfbbf24);
      // 3 mid-dorsal cylindrical reactor drums
      for (let di = 0; di < 3; di++) {
        pushCyl(metal, 0.70, 0.70, 0.90, 10, 0, 1.36, -0.4 - di * 1.35, 0x64748b, Math.PI / 2, 0, 0);
        pushTorus(glow, 0.76, 0.07, 6, 14, 0, 1.36, -0.4 - di * 1.35, 0x60a5fa, 0, 0, 0);
      }
      // Huge encircling metallic warp-drive ring with restrained ice-blue inner core
      pushTorus(metal, 4.65, 0.32, 8, 28, 0, 0.05, -0.65, 0x374151);
      pushTorus(glow, 4.65, 0.13, 6, 28, 0, 0.05, -0.65, 0x60a5fa);
      for (const side of [-1, 1]) {
        pushCyl(metal, 0.13, 0.17, 4.55, 8, side * 0.88, -0.76, 5.55, 0x181b20, Math.PI / 2, 0, 0);
        pushCyl(glow, 0.11, 0.11, 0.28, 6, side * 0.88, -0.76, 7.86, 0x60a5fa, Math.PI / 2, 0, 0);
        addNavalTurret(matte, metal, side * 1.82, 0.85, 2.25, 1.22, 0x6b7280, 0x181b20, side * 0.35);
      }
      for (const ex of [-1.05, 0, 1.05]) {
        pushCyl(metal, 0.40, 0.50, 1.35, 10, ex, 0.05, -7.25, 0x181b20, Math.PI / 2, 0, 0);
        pushCyl(glow, 0.32, 0.32, 0.16, 10, ex, 0.05, -7.95, 0x93c5fd, Math.PI / 2, 0, 0);
      }
    }
    return finalizeMultiFinishGroup(matte, metal, win, glow);
  }

  return null;
}
