import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SpeciesId, VehicleType } from './types';

/** Normalize any Three.js BufferGeometry into non-indexed {position, normal, uv, color} so mergeGeometries always succeeds */
function pushGeo(parts: THREE.BufferGeometry[], rawGeo: THREE.BufferGeometry, hex: number): void {
  const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo;
  if (rawGeo.index) rawGeo.dispose();
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const pos = g.getAttribute('position');
  if (!g.getAttribute('uv')) {
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uvs[i * 2] = pos.getX(i) * 0.4;
      uvs[i * 2 + 1] = pos.getZ(i) * 0.4;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
  // Strip any extra attributes (e.g. tangent) so all geometries match identically
  for (const key of Object.keys(g.attributes)) {
    if (key !== 'position' && key !== 'normal' && key !== 'uv') {
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

/**
 * Extrude a symmetric tapered warship hull/deck along Z from (halfWidth, z) profile points.
 * Points should go from stern (-Z) to bow (+Z) on the +X side; the -X side is mirrored automatically!
 */
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
  // Rotate so shape (x, y) lies on (x, z) and extrudes downward from yTop
  g.rotateX(Math.PI / 2);
  g.translate(0, yTop, 0);
  pushGeo(parts, g, hex);
}

/** Realistic naval/aerial twin-barrel turret with cylindrical barrels */
function addNavalTurret(
  body: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  scale: number,
  turretHex: number,
  barrelHex: number,
  yaw = 0,
): void {
  const s = scale;
  pushCyl(body, 0.24 * s, 0.28 * s, 0.16 * s, 8, x, y + 0.08 * s, z, turretHex);
  pushBox(body, 0.36 * s, 0.20 * s, 0.44 * s, x, y + 0.24 * s, z, turretHex, 0, yaw, 0);
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  for (const side of [-0.09, 0.09]) {
    const bx = x + side * s * cos + 0.42 * s * sin;
    const bz = z - side * s * sin + 0.42 * s * cos;
    pushCyl(body, 0.036 * s, 0.045 * s, 0.72 * s, 6, bx, y + 0.28 * s, bz, barrelHex, Math.PI / 2 - 0.1, yaw, 0);
  }
}

/** Detailed swept-wing jet or prop fighter parked on a carrier flight deck */
function addDeckAircraft(
  body: THREE.BufferGeometry[],
  glow: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  wingHex: number,
  fuselageHex: number,
  cockpitHex: number,
  isPropEra: boolean,
  yaw = 0.14,
): void {
  // Fuselage
  pushCyl(body, 0.045, 0.068, 0.78, 6, x, y + 0.08, z, fuselageHex, Math.PI / 2, yaw, 0);
  // Main wings (straight for prop era, swept delta for jet/sci-fi)
  if (isPropEra) {
    pushBox(body, 0.74, 0.03, 0.17, x, y + 0.09, z + 0.04, wingHex, 0, yaw, 0);
    pushBox(body, 0.26, 0.025, 0.10, x, y + 0.09, z - 0.30, wingHex, 0, yaw, 0);
  } else {
    pushBox(body, 0.68, 0.03, 0.22, x, y + 0.08, z - 0.06, wingHex, 0, yaw, 0);
    pushBox(body, 0.34, 0.03, 0.28, x, y + 0.08, z + 0.04, wingHex, 0, yaw, 0);
  }
  // Vertical tail fin
  pushBox(body, 0.03, 0.16, 0.14, x, y + 0.16, z - 0.28, fuselageHex, 0, yaw, 0);
  // Canopy glass
  pushBox(glow, 0.07, 0.06, 0.16, x, y + 0.14, z + 0.12, cockpitHex, 0, yaw, 0);
}

/** Realistic circular ducted VTOL lift-turbine shroud with rotor hub & glowing ring */
function addDuctedTurbine(
  body: THREE.BufferGeometry[],
  glow: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  radius: number,
  casingHex: number,
  bladeHex: number,
  glowHex: number,
): void {
  pushTorus(body, radius, radius * 0.20, 6, 12, x, y, z, casingHex);
  pushCyl(body, radius * 0.22, radius * 0.22, radius * 0.42, 8, x, y, z, bladeHex);
  // Cross rotor blades
  pushBox(body, radius * 1.75, 0.05, radius * 0.18, x, y, z, bladeHex, 0, 0.4, 0);
  pushBox(body, radius * 1.75, 0.05, radius * 0.18, x, y, z, bladeHex, 0, 1.97, 0);
  // Glowing underside lift core
  pushTorus(glow, radius * 0.72, radius * 0.09, 5, 12, x, y - radius * 0.16, z, glowHex);
}

/** Crisp horizontal window slit strip */
function addWindowStrip(
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
      alongZ ? 0.06 : 0.14,
      0.09,
      alongZ ? 0.14 : 0.06,
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
  metalness = 0.48,
  roughness = 0.44,
  glowHex = 0x38bdf8,
): THREE.Group {
  const group = new THREE.Group();
  if (bodyParts.length > 0) {
    const merged = mergeGeometries(bodyParts, false);
    for (const g of bodyParts) g.dispose();
    if (merged) {
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
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
        emissiveIntensity: 1.35,
        roughness: 0.22,
        metalness: 0.15,
      });
      const glowMesh = new THREE.Mesh(mergedGlow, glowMat);
      group.add(glowMesh);
    }
  }
  return group;
}

/**
 * Builds sleek, realistic, Mothership-grade race-unique 3D war vehicles (~1/2 Alien Mothership length)
 * using sculpted beveled ExtrudeGeometry hulls, cylindrical barrels/pressure-hulls/turbines,
 * TorusGeometry lift/warp rings, and authentic Industrial -> Atomic -> Info -> Orbital visual progression.
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
      ? 0xa855f7
      : species === 'orc'
        ? 0xf97316
        : species === 'dwarf'
          ? 0xf59e0b
          : species === 'lizardfolk'
            ? 0x10b981
            : 0x38bdf8;

  // =========================================================================
  // 1. AIRCRAFT CARRIER (Sea, Epoch 3+) — Sleek ~11.6–12.6 tiles long (~5:1 naval ratio!)
  // =========================================================================
  if (type === 'aircraft_carrier') {
    const isPropEra = e <= 3;
    const isAngledDeck = e >= 4;

    if (species === 'elf') {
      // Sleek twin-hull ivory catamaran supercarrier with graceful pointed swan-prows & spire bridge
      const hullProf: Array<[number, number]> = [
        [0.18, -5.6], [0.46, -4.6], [0.54, 0.0], [0.46, 4.2], [0.18, 5.8], [0.0, 6.4],
      ];
      for (const side of [-1, 1]) {
        const shape = new THREE.Shape();
        shape.moveTo(side * 1.15, -5.6);
        for (const [hw, z] of hullProf) shape.lineTo(side * 1.15 + hw, z);
        for (let i = hullProf.length - 1; i >= 0; i--) shape.lineTo(side * 1.15 - hullProf[i][0], hullProf[i][1]);
        shape.closePath();
        const hg = new THREE.ExtrudeGeometry(shape, { depth: 0.72, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 1 });
        hg.rotateX(Math.PI / 2);
        hg.translate(0, 0.78, 0);
        pushGeo(body, hg, 0xe8e2d0);
        // Gilded prow trim
        pushCyl(body, 0.05, 0.14, 1.35, 6, side * 1.15, 0.88, 6.15, 0xc8a441, Math.PI / 2 - 0.18, 0, 0);
      }
      // Long sleek tapered ivory flight deck (11.8 tiles long x 2.75 wide)
      pushTaperedHull(body, [
        [1.15, -5.4], [1.48, -3.5], [1.56, 1.8], [1.22, 4.6], [0.62, 5.7], [0.0, 6.1],
      ], 0.22, 1.04, 0xf2ede0, 0.06);
      pushBox(body, 0.14, 0.03, 10.4, 0, 1.12, 0.1, 0xc8a441);
      pushBox(glow, 0.08, 0.04, 9.6, -0.52, 1.12, 0.2, 0x38bdf8);
      // Graceful starboard crystal spire island
      pushBox(body, 0.56, 1.18, 2.25, 1.12, 1.68, -1.1, 0xf5f0e2);
      pushCyl(body, 0.10, 0.26, 1.55, 6, 1.12, 2.95, -1.15, 0xc8a441);
      pushCyl(glow, 0.16, 0.06, 0.62, 6, 1.12, 3.85, -1.15, 0xa855f7);
      addWindowStrip(glow, 0.82, 1.98, -1.1, 5, 0.34, true, 0xfef08a);
      addNavalTurret(body, -1.32, 1.08, 3.2, 0.85, 0xc8a441, 0xe2e8f0, -0.35);
      addNavalTurret(body, -1.32, 1.08, -3.4, 0.85, 0xc8a441, 0xe2e8f0, -2.6);
      for (const zf of [-4.0, -2.4, -0.8, 0.8, 2.4, 4.0]) {
        addDeckAircraft(body, glow, -0.56, 1.11, zf, 0xc8a441, 0xf8f5eb, 0xa855f7, isPropEra, 0.12);
      }
    } else if (species === 'orc') {
      // Long riveted scrap-iron dreadnought carrier (~11.8 tiles) with tusked ram prow & tilted stacks
      pushTaperedHull(body, [
        [1.18, -5.5], [1.46, -3.8], [1.54, 2.4], [1.18, 4.8], [0.55, 5.8], [0.0, 6.2],
      ], 0.92, 0.94, 0x3b3532, 0.08);
      // Heavy riveted flat-top deck + ski-jump bow ramp
      pushTaperedHull(body, [
        [1.38, -5.3], [1.66, -3.2], [1.72, 2.8], [1.34, 5.1], [0.85, 5.6],
      ], 0.22, 1.16, 0x4c443f, 0.05);
      pushBox(body, 1.65, 0.18, 1.95, -0.22, 1.38, 4.75, 0x574c45, -0.20, 0, 0);
      // Forward iron ram-tusks
      for (const tx of [-0.72, 0.72]) {
        pushCyl(body, 0.05, 0.20, 1.65, 6, tx, 0.65, 6.25, 0xa1a1aa, Math.PI / 2 - 0.12, 0, 0);
      }
      // Starboard armored iron bridge + twin tilted smokestacks
      pushBox(body, 0.76, 1.35, 2.55, 1.18, 1.88, -1.25, 0x5c2b22);
      pushBox(body, 0.58, 0.52, 1.45, 1.18, 2.75, -1.35, 0x3b3532);
      pushCyl(body, 0.20, 0.24, 1.65, 8, 1.24, 3.15, -0.65, 0x1f1c1a, -0.15, 0, 0.1);
      pushCyl(body, 0.18, 0.22, 1.45, 8, 1.24, 3.05, -1.85, 0x1f1c1a, -0.15, 0, 0.1);
      pushCyl(glow, 0.18, 0.18, 0.14, 8, 1.32, 3.92, -0.78, 0xf97316);
      addWindowStrip(glow, 0.78, 2.28, -1.25, 5, 0.36, true, 0xf97316);
      addNavalTurret(body, -1.48, 1.18, 2.6, 0.95, 0x7f1d1d, 0x27272a, -0.4);
      addNavalTurret(body, -1.48, 1.18, -3.2, 0.95, 0x7f1d1d, 0x27272a, -2.6);
      for (const zf of [-3.6, -1.9, -0.2, 1.5, 3.2]) {
        addDeckAircraft(body, glow, -0.58, 1.22, zf, 0x991b1b, 0x3f3a36, 0xf97316, isPropEra, 0.15);
      }
    } else if (species === 'dwarf') {
      // Long armored ironclad-and-bronze fleet carrier (~11.6 tiles) with runic ram-prow & forge funnels
      pushTaperedHull(body, [
        [1.24, -5.4], [1.56, -3.6], [1.62, 2.6], [1.26, 4.9], [0.58, 5.8], [0.0, 6.1],
      ], 0.96, 0.98, 0x334155, 0.08);
      pushTaperedHull(body, [
        [1.46, -5.2], [1.74, -3.4], [1.78, 2.8], [1.44, 5.1], [0.82, 5.6],
      ], 0.22, 1.20, 0x475569, 0.05);
      // Heavy bronze belt & prow armor
      pushBox(body, 0.18, 0.24, 9.6, -1.64, 0.72, -0.2, 0xb45309);
      pushBox(body, 0.18, 0.24, 9.6, 1.64, 0.72, -0.2, 0xb45309);
      pushBox(body, 0.16, 0.03, 10.0, -0.18, 1.26, 0.1, 0xd97706);
      // Starboard runic fortress island + twin brass funnels
      pushBox(body, 0.84, 1.28, 2.75, 1.22, 1.88, -1.15, 0x334155);
      pushBox(body, 0.90, 0.16, 2.85, 1.22, 2.58, -1.15, 0xd97706);
      pushCyl(body, 0.22, 0.26, 1.35, 8, 1.26, 3.22, -0.55, 0xb45309);
      pushCyl(body, 0.22, 0.26, 1.35, 8, 1.26, 3.22, -1.75, 0xb45309);
      addWindowStrip(glow, 0.78, 2.24, -1.15, 5, 0.42, true, 0xf59e0b);
      addNavalTurret(body, -1.52, 1.22, 3.1, 0.95, 0xb45309, 0x1e293b, -0.35);
      addNavalTurret(body, -1.52, 1.22, -3.1, 0.95, 0xb45309, 0x1e293b, -2.6);
      for (const zf of [-3.6, -1.9, -0.2, 1.5, 3.2]) {
        addDeckAircraft(body, glow, -0.54, 1.26, zf, 0xd97706, 0x475569, 0xf59e0b, isPropEra, 0.10);
      }
    } else if (species === 'lizardfolk') {
      // Sleek elongated obsidian & gold stepped-temple sea carrier (~11.8 tiles) with ziggurat bridge
      pushTaperedHull(body, [
        [1.18, -5.5], [1.48, -3.6], [1.56, 2.5], [1.18, 4.9], [0.52, 5.9], [0.0, 6.2],
      ], 0.92, 0.94, 0x1e293b, 0.08);
      pushTaperedHull(body, [
        [1.42, -5.3], [1.68, -3.4], [1.74, 2.8], [1.38, 5.0], [0.76, 5.7],
      ], 0.20, 1.16, 0x2c3645, 0.05);
      pushBox(body, 0.18, 0.04, 10.2, -0.22, 1.22, 0.1, 0xca8a04);
      pushBox(glow, 0.10, 0.05, 9.4, -0.62, 1.22, 0.15, 0x10b981);
      // Stepped golden ziggurat starboard bridge
      pushBox(body, 0.96, 0.48, 2.55, 1.14, 1.44, -1.1, 0x1e293b);
      pushBox(body, 0.72, 0.46, 1.85, 1.14, 1.90, -1.1, 0xca8a04);
      pushBox(body, 0.48, 0.44, 1.15, 1.14, 2.34, -1.1, 0x1f2937);
      pushCyl(glow, 0.04, 0.24, 0.85, 4, 1.14, 2.95, -1.1, 0x10b981);
      addNavalTurret(body, -1.48, 1.18, 3.0, 0.9, 0xca8a04, 0x1e293b, -0.35);
      addNavalTurret(body, -1.48, 1.18, -3.1, 0.9, 0xca8a04, 0x1e293b, -2.6);
      for (const zf of [-3.6, -1.9, -0.2, 1.5, 3.2]) {
        addDeckAircraft(body, glow, -0.58, 1.22, zf, 0xd4af37, 0x1e293b, 0x10b981, isPropEra, 0.14);
      }
    } else {
      // HUMAN: Realistic 5.5:1 Naval Fleet Carrier (~12.4 tiles long!)
      // Epoch 3 (Industrial): Wooden-planked WWII/interwar flat-top with tilted funnel & tripod mast
      // Epoch 4-5 (Atomic/Info): Modern angled-deck nuclear supercarrier with swept island & radar
      // Epoch 6+ (Orbital): Stealth faceted hull with cyan EM catapults
      const hullHex = e >= 5 ? 0x3b4856 : 0x566473;
      const deckHex = isPropEra ? 0x6e5b47 : e >= 5 ? 0x26303c : 0x374350;
      // Sleek tapered naval hull (12.4 tiles long x 2.3 wide at waterline!)
      pushTaperedHull(body, [
        [0.95, -5.8], [1.22, -4.4], [1.28, 2.6], [0.96, 4.9], [0.42, 6.0], [0.0, 6.4],
      ], 0.92, 0.94, hullHex, 0.08);
      // Long realistic flight deck (11.8 tiles long!)
      pushTaperedHull(body, [
        [1.26, -5.6], [1.46, -4.2], [1.48, 3.4], [1.18, 5.4], [0.88, 5.9],
      ], 0.20, 1.16, deckHex, 0.04);
      if (isAngledDeck) {
        // Authentic port-side angled landing deck sponson
        pushBox(body, 0.95, 0.18, 6.4, -1.42, 1.07, -0.85, deckHex, 0, 0.13, 0);
        pushBox(body, 0.10, 0.03, 6.0, -1.28, 1.18, -0.85, 0xf1f5f9, 0, 0.13, 0);
      }
      // Crisp centerline & catapult markings
      pushBox(body, 0.10, 0.03, 10.6, -0.18, 1.18, 0.15, 0xf1f5f9);
      pushBox(body, 0.07, 0.03, 9.6, 0.36, 1.18, 0.35, 0xfbbf24);
      if (e >= 6) pushBox(glow, 0.09, 0.04, 10.2, -0.18, 1.19, 0.15, 0x38bdf8);
      // Starboard command island superstructure
      pushBox(body, 0.64, 1.24, 2.45, 1.12, 1.80, -1.15, 0x64748b);
      pushBox(body, 0.50, 0.56, 1.45, 1.12, 2.65, -1.25, 0x94a3b8);
      if (isPropEra) {
        // Classic Industrial-era naval funnel + tripod mast
        pushCyl(body, 0.22, 0.26, 1.45, 8, 1.12, 2.75, -0.35, 0x475569, -0.12, 0, 0);
        pushCyl(body, 0.05, 0.09, 1.75, 6, 1.12, 3.45, -1.55, 0xcbd5e1);
      } else {
        // Modern radar mast + phased-array crossbar
        pushCyl(body, 0.07, 0.12, 1.65, 6, 1.12, 3.62, -1.25, 0xcbd5e1);
        pushBox(body, 0.96, 0.14, 0.10, 1.12, 4.12, -1.25, 0xe2e8f0);
      }
      addWindowStrip(glow, 0.78, 2.15, -1.15, 5, 0.36, true, 0xfef08a);
      addWindowStrip(glow, 1.12, 2.68, -0.50, 3, 0.16, false, 0x38bdf8);
      // AA sponsons & 6 detailed parked aircraft
      addNavalTurret(body, -1.45, 1.16, 3.65, 0.78, 0x64748b, 0xcbd5e1, -0.3);
      addNavalTurret(body, 1.38, 1.16, -4.45, 0.78, 0x64748b, 0xcbd5e1, 2.8);
      for (const [fx, fz] of [[-0.68, -4.2], [-0.62, -2.5], [-0.56, -0.8], [-0.48, 1.0], [-0.36, 2.8], [0.35, 3.9]]) {
        addDeckAircraft(body, glow, fx, 1.19, fz, 0x94a3b8, 0xe2e8f0, 0x38bdf8, isPropEra, 0.14);
      }
    }
    return finalizeGroup(body, glow, 0.46, 0.46, raceGlow);
  }

  // =========================================================================
  // 2. SUBMARINE (Sea, Epoch 3+) — Sleek ~7.8–8.4 tiles long (~7.5:1 ratio!)
  // =========================================================================
  if (type === 'submarine') {
    if (species === 'elf') {
      // Sleek hydrodynamic manta-nautilus submersible with curved pectoral hydrofoils & crystal dome
      pushCyl(body, 0.48, 0.52, 5.4, 10, 0, 0.34, 0, 0x1e3a5f, Math.PI / 2, 0, 0);
      pushCyl(body, 0.08, 0.48, 1.65, 10, 0, 0.34, 3.52, 0xd4af37, Math.PI / 2, 0, 0);
      pushCyl(body, 0.48, 0.08, 1.85, 10, 0, 0.34, -3.62, 0x1e3a5f, Math.PI / 2, 0, 0);
      pushTaperedHull(body, [[0.55, -1.6], [2.25, -0.4], [1.95, 0.8], [0.55, 1.8]], 0.14, 0.42, 0x2b5978, 0.04);
      pushCyl(glow, 0.36, 0.46, 1.35, 8, 0, 0.78, 0.45, 0x38bdf8, Math.PI / 2, 0, 0);
      pushBox(glow, 3.8, 0.06, 0.12, 0, 0.44, 0.15, 0xa855f7);
    } else if (species === 'orc') {
      // Long riveted iron shark-sub with cylindrical hull, jagged dorsal fin & twin torpedo pods
      pushCyl(body, 0.56, 0.56, 5.2, 8, 0, 0.38, -0.1, 0x3f3a36, Math.PI / 2, 0, 0);
      pushCyl(body, 0.18, 0.56, 1.55, 8, 0, 0.38, 3.25, 0x991b1b, Math.PI / 2, 0, 0); // red shark snout
      pushCyl(body, 0.54, 0.16, 1.65, 8, 0, 0.38, -3.52, 0x2c2825, Math.PI / 2, 0, 0);
      pushBox(body, 0.38, 1.15, 1.65, 0, 1.12, 0.45, 0x2c2825); // jagged dorsal sail
      pushCyl(body, 0.06, 0.06, 0.95, 6, 0, 2.02, 0.65, 0x9ca3af); // periscope
      for (const side of [-1, 1]) {
        pushCyl(body, 0.18, 0.18, 2.65, 8, side * 0.68, 0.38, 1.15, 0x57534e, Math.PI / 2, 0, 0);
        pushCyl(glow, 0.12, 0.12, 0.08, 6, side * 0.68, 0.38, 2.50, 0xf97316, Math.PI / 2, 0, 0);
      }
      pushCyl(glow, 0.24, 0.24, 0.16, 8, 0, 0.38, -4.38, 0xf97316, Math.PI / 2, 0, 0);
    } else if (species === 'dwarf') {
      // Armored cylindrical iron-beetle sub with twin brass ballast cylinders & conical rotary drill nose
      pushCyl(body, 0.62, 0.62, 4.8, 8, 0, 0.42, -0.1, 0x334155, Math.PI / 2, 0, 0);
      pushCyl(body, 0.06, 0.58, 1.65, 8, 0, 0.42, 3.12, 0xd97706, Math.PI / 2, 0, 0); // brass drill cone
      pushCyl(body, 0.58, 0.22, 1.55, 8, 0, 0.42, -3.28, 0x334155, Math.PI / 2, 0, 0);
      for (const side of [-1, 1]) {
        pushCyl(body, 0.28, 0.28, 4.25, 8, side * 0.78, 0.34, -0.1, 0xb45309, Math.PI / 2, 0, 0);
      }
      pushCyl(body, 0.48, 0.56, 0.92, 8, 0, 1.18, 0.25, 0x475569); // armored cupola
      addWindowStrip(glow, 0, 1.32, 0.78, 3, 0.24, false, 0xf59e0b);
    } else if (species === 'lizardfolk') {
      // Sleek crocodilian obsidian reef-sub with serrated golden dorsal crests & tail hydrofoils
      pushCyl(body, 0.50, 0.54, 5.4, 8, 0, 0.34, 0, 0x1e293b, Math.PI / 2, 0, 0);
      pushCyl(body, 0.14, 0.50, 1.75, 8, 0, 0.34, 3.55, 0x0f172a, Math.PI / 2, 0, 0);
      pushCyl(body, 0.52, 0.12, 1.95, 8, 0, 0.34, -3.65, 0x1e293b, Math.PI / 2, 0, 0);
      for (const zs of [-2.2, -1.1, 0.0, 1.1, 2.2]) {
        pushBox(body, 0.22, 0.52, 0.46, 0, 0.88, zs, 0xd4af37);
      }
      pushBox(body, 2.25, 0.12, 0.75, 0, 0.34, -3.15, 0x334155);
      pushBox(glow, 0.18, 0.14, 0.24, -0.34, 0.54, 2.85, 0x10b981);
      pushBox(glow, 0.18, 0.14, 0.24, 0.34, 0.54, 2.85, 0x10b981);
    } else {
      // HUMAN: Realistic 7.5:1 Cylindrical Naval Submarine (~8.2 tiles long, tapered bow/stern, sleek sail & periscopes!)
      const hullHex = e >= 5 ? 0x1e293b : 0x334155;
      pushCyl(body, 0.52, 0.52, 5.4, 10, 0, 0.38, 0, hullHex, Math.PI / 2, 0, 0);
      pushCyl(body, 0.12, 0.52, 1.45, 10, 0, 0.38, 3.42, hullHex, Math.PI / 2, 0, 0); // sleek parabolic bow
      pushCyl(body, 0.52, 0.10, 1.85, 10, 0, 0.38, -3.62, hullHex, Math.PI / 2, 0, 0); // tapered stern
      // Streamlined conning tower sail + diving planes + twin periscopes
      pushTaperedHull(body, [[0.18, -0.35], [0.28, 0.25], [0.26, 1.15], [0.08, 1.55]], 1.05, 1.68, 0x475569, 0.04);
      pushBox(body, 1.72, 0.10, 0.42, 0, 1.24, 0.65, 0x64748b); // sail diving planes
      pushCyl(body, 0.04, 0.05, 0.95, 6, -0.07, 2.15, 0.82, 0xcbd5e1); // periscope
      pushCyl(body, 0.035, 0.045, 0.72, 6, 0.08, 2.02, 0.45, 0x94a3b8); // radar snorkel
      pushBox(body, 0.12, 0.96, 0.72, 0, 0.58, -3.85, 0x475569); // vertical rudder
      pushBox(body, 1.65, 0.10, 0.48, 0, 0.38, -3.75, 0x64748b); // stern hydroplanes
      addWindowStrip(glow, 0, 1.48, 1.52, 3, 0.14, false, 0x38bdf8);
    }
    return finalizeGroup(body, glow, 0.54, 0.38, raceGlow);
  }

  // =========================================================================
  // 3. SIEGE ARTILLERY (Land, Epoch 3+) — Realistic ~4.4 tiles long low-slung SPG / Walker!
  // =========================================================================
  if (type === 'siege_artillery') {
    if (species === 'elf') {
      // Sleek quad-legged crystal prism-lance strider with cylindrical focusing barrel & golden ring
      pushTaperedHull(body, [[0.65, -1.4], [0.95, -0.4], [0.88, 1.1], [0.42, 1.7]], 0.56, 1.48, 0xf2ede0, 0.06);
      for (const [lx, lz] of [[-1.08, 0.95], [1.08, 0.95], [-1.08, -0.95], [1.08, -0.95]]) {
        pushCyl(body, 0.14, 0.18, 1.18, 6, lx, 0.60, lz, 0xc8a441);
        pushBox(body, 0.44, 0.16, 0.48, lx, 0.08, lz, 0xe8e2d0);
      }
      pushCyl(body, 0.16, 0.24, 3.65, 8, 0, 2.05, 0.85, 0xf8f5eb, Math.PI / 2 - 0.26, 0, 0);
      pushTorus(glow, 0.42, 0.07, 6, 12, 0, 2.15, 1.35, 0xa855f7, 0, 0, 0);
      pushCyl(glow, 0.08, 0.08, 3.75, 6, 0, 2.08, 0.92, 0xa855f7, Math.PI / 2 - 0.26, 0, 0);
    } else if (species === 'orc') {
      // Spiked iron doom-roller SPG with cylindrical crush drum, massive rifled cannon & twin stacks
      pushBox(body, 2.15, 0.72, 3.45, 0, 0.62, -0.25, 0x3f3a36);
      pushCyl(body, 0.48, 0.48, 2.65, 10, 0, 0.48, 1.75, 0x71717a, 0, 0, Math.PI / 2); // giant front crush drum
      for (const side of [-1, 1]) {
        pushBox(body, 0.46, 0.64, 3.15, side * 1.18, 0.34, -0.35, 0x262626);
        pushCyl(body, 0.14, 0.16, 1.35, 6, side * 0.85, 1.55, -1.65, 0x18181b);
      }
      pushCyl(body, 0.30, 0.42, 3.75, 8, 0, 1.72, 0.45, 0x27272a, Math.PI / 2 - 0.30, 0, 0);
      pushCyl(body, 0.40, 0.40, 0.48, 8, 0, 2.25, 2.05, 0x991b1b, Math.PI / 2 - 0.30, 0, 0);
      pushCyl(glow, 0.22, 0.22, 0.12, 8, 0, 2.34, 2.32, 0xf97316, Math.PI / 2 - 0.30, 0, 0);
    } else if (species === 'dwarf') {
      // Low-slung armored runic landship with heavy track skirts & colossal brass quake-mortar
      for (const side of [-1, 1]) {
        pushBox(body, 0.56, 0.62, 3.85, side * 1.08, 0.32, 0, 0x27272a);
        pushBox(body, 0.64, 0.22, 3.75, side * 1.08, 0.66, 0, 0xb45309);
      }
      pushTaperedHull(body, [[0.92, -1.7], [1.04, -0.5], [1.04, 1.2], [0.76, 1.85]], 0.76, 1.38, 0x334155, 0.06);
      pushCyl(body, 0.34, 0.44, 3.25, 10, 0, 1.98, 0.58, 0xb45309, Math.PI / 2 - 0.42, 0, 0);
      pushCyl(body, 0.46, 0.46, 0.38, 10, 0, 2.62, 1.95, 0xd97706, Math.PI / 2 - 0.42, 0, 0);
      pushBox(glow, 0.78, 0.36, 0.18, 0, 0.96, -1.78, 0xf59e0b);
    } else if (species === 'lizardfolk') {
      // Quadruped obsidian temple-walker with towering glowing emerald solar-obelisk cannon
      pushTaperedHull(body, [[0.85, -1.4], [1.15, 0.0], [0.95, 1.4], [0.55, 1.75]], 0.62, 1.32, 0x1e293b, 0.06);
      for (const [lx, lz] of [[-1.12, 1.05], [1.12, 1.05], [-1.12, -1.05], [1.12, -1.05]]) {
        pushCyl(body, 0.20, 0.24, 0.95, 6, lx, 0.48, lz, 0x334155);
        pushBox(body, 0.48, 0.16, 0.52, lx, 0.08, lz, 0xca8a04);
      }
      pushBox(body, 1.45, 0.42, 1.58, 0, 1.56, 0, 0xca8a04);
      pushCyl(glow, 0.08, 0.36, 1.95, 4, 0, 2.65, 0.05, 0x10b981);
    } else {
      // HUMAN: Realistic Self-Propelled Artillery Howitzer / Railgun SPG (~4.4 tiles long)
      const hullHex = e >= 5 ? 0x4b5563 : 0x4d5d42;
      for (const side of [-1, 1]) {
        pushBox(body, 0.52, 0.52, 3.85, side * 0.98, 0.28, 0, 0x262626);
        for (let wi = -2; wi <= 2; wi++) {
          pushCyl(body, 0.22, 0.22, 0.56, 8, side * 0.98, 0.24, wi * 0.68, 0x3f3f46, 0, 0, Math.PI / 2);
        }
        pushBox(body, 0.58, 0.16, 3.75, side * 0.98, 0.58, 0, hullHex);
      }
      pushTaperedHull(body, [[0.82, -1.85], [0.92, -0.4], [0.92, 1.3], [0.68, 1.95]], 0.58, 1.12, hullHex, 0.05);
      pushBox(body, 1.34, 0.72, 1.85, 0, 1.48, -0.55, 0x64748b); // rear artillery turret
      pushCyl(body, 0.12, 0.18, 3.85, 8, 0, 2.05, 0.95, 0x94a3b8, Math.PI / 2 - 0.30, 0, 0); // rifled howitzer barrel
      pushBox(body, 0.38, 0.28, 0.42, 0, 2.62, 2.75, 0x334155, -0.30, 0, 0); // slotted muzzle brake
      if (e >= 6) pushBox(glow, 0.16, 0.10, 3.35, 0, 2.12, 1.02, 0x38bdf8, -0.30, 0, 0);
    }
    return finalizeGroup(body, glow, 0.46, 0.48, raceGlow);
  }

  // =========================================================================
  // 4. SKY CANNONSHIP (Air, Epoch 4+) — Sleek ~9.2–9.8 tiles long aerial warship!
  // =========================================================================
  if (type === 'sky_cannonship') {
    if (species === 'elf') {
      // Graceful crescent-wing star-sail sky frigate (~9.5 tiles long) with circular lift rings
      pushTaperedHull(body, [[0.45, -4.5], [0.95, -2.4], [1.05, 1.8], [0.62, 3.9], [0.0, 5.0]], 0.85, 0.45, 0xf2ede0, 0.08);
      pushTaperedHull(body, [[0.85, -1.8], [3.65, -0.8], [3.15, 0.4], [0.95, 1.4]], 0.20, 0.18, 0xe8e2d0, 0.05);
      pushBox(body, 0.78, 0.92, 2.15, 0, 0.88, -1.35, 0xf8f5eb);
      addWindowStrip(glow, 0, 1.06, -0.25, 4, 0.18, false, 0xfef08a);
      addDuctedTurbine(body, glow, -2.55, 0.0, -0.35, 0.82, 0xc8a441, 0xf8f5eb, 0x38bdf8);
      addDuctedTurbine(body, glow, 2.55, 0.0, -0.35, 0.82, 0xc8a441, 0xf8f5eb, 0x38bdf8);
      addNavalTurret(body, 0, 0.46, 2.55, 1.05, 0xc8a441, 0xf8fafc, 0);
      pushCyl(glow, 0.12, 0.14, 2.65, 6, -1.25, -0.32, 1.45, 0xa855f7, Math.PI / 2, 0, 0);
      pushCyl(glow, 0.12, 0.14, 2.65, 6, 1.25, -0.32, 1.45, 0xa855f7, Math.PI / 2, 0, 0);
    } else if (species === 'orc') {
      // Heavy ironclad aerial dakka-frigate (~9.2 tiles long) with 4 circular rotor shrouds & broadside guns
      pushTaperedHull(body, [[1.05, -4.4], [1.45, -2.6], [1.48, 2.2], [1.05, 4.1], [0.0, 4.9]], 1.25, 0.62, 0x3f3a36, 0.08);
      pushBox(body, 1.35, 0.88, 2.25, 0, 1.05, -1.55, 0x5c2b22);
      addWindowStrip(glow, 0, 1.18, -0.40, 4, 0.28, false, 0xf97316);
      for (const zb of [-1.65, 0.0, 1.65]) {
        pushCyl(body, 0.14, 0.18, 4.45, 8, 0, -0.10, zb, 0x18181b, 0, 0, Math.PI / 2);
      }
      for (const [rx, rz] of [[-2.35, 1.65], [2.35, 1.65], [-2.35, -1.75], [2.35, -1.75]]) {
        addDuctedTurbine(body, glow, rx, 0.24, rz, 0.84, 0x262626, 0x991b1b, 0xf97316);
      }
      addNavalTurret(body, 0, 0.62, 2.45, 1.15, 0x991b1b, 0x18181b, 0);
    } else if (species === 'dwarf') {
      // Armored brass-and-ironclad sky dreadnought (~9.4 tiles long) with twin cylindrical lift-hulls
      pushTaperedHull(body, [[1.05, -4.4], [1.36, -2.5], [1.38, 2.4], [0.96, 4.2], [0.0, 4.9]], 1.18, 0.60, 0x475569, 0.08);
      for (const side of [-1, 1]) {
        pushCyl(body, 0.56, 0.56, 6.2, 10, side * 1.85, 0.12, -0.15, 0x334155, Math.PI / 2, 0, 0);
        pushCyl(body, 0.12, 0.56, 1.35, 10, side * 1.85, 0.12, 3.62, 0xb45309, Math.PI / 2, 0, 0);
        pushCyl(glow, 0.42, 0.42, 0.22, 8, side * 1.85, 0.12, -3.32, 0xf59e0b, Math.PI / 2, 0, 0);
      }
      for (const zb of [-1.45, 0.25, 1.95]) {
        pushCyl(body, 0.13, 0.16, 4.95, 8, 0, 0.05, zb, 0xb45309, 0, 0, Math.PI / 2);
      }
      addNavalTurret(body, 0, 0.62, 2.45, 1.15, 0xb45309, 0x1e293b, 0);
      addNavalTurret(body, 0, 0.62, -2.55, 1.15, 0xb45309, 0x1e293b, Math.PI);
    } else if (species === 'lizardfolk') {
      // Levitating stepped obsidian-and-gold sky temple frigate (~9.2 tiles long) + 4 hovering crystal pylons
      pushTaperedHull(body, [[1.15, -4.3], [1.62, -2.2], [1.62, 2.2], [1.05, 4.1], [0.0, 4.8]], 0.92, 0.46, 0x1e293b, 0.08);
      pushTaperedHull(body, [[0.85, -3.1], [1.22, -1.4], [1.22, 1.4], [0.68, 2.9]], 0.62, 1.08, 0xca8a04, 0.05);
      pushBox(body, 1.25, 0.64, 2.25, 0, 1.42, -0.35, 0x1e293b);
      pushCyl(glow, 0.06, 0.42, 1.15, 4, 0, 2.25, -0.35, 0x10b981);
      for (const [px, pz] of [[-2.35, 2.05], [2.35, 2.05], [-2.35, -2.05], [2.35, -2.05]]) {
        pushCyl(body, 0.34, 0.34, 1.25, 6, px, 0.15, pz, 0xca8a04);
        pushCyl(glow, 0.24, 0.06, 0.72, 6, px, -0.78, pz, 0x10b981);
      }
    } else {
      // HUMAN: Sleek armored aerial broadside frigate (~9.6 tiles long, 4 circular VTOL turbines & twin rail-turrets!)
      pushTaperedHull(body, [[0.92, -4.5], [1.34, -2.8], [1.38, 2.4], [0.88, 4.3], [0.0, 5.1]], 1.06, 0.54, 0x475569, 0.08);
      pushBox(body, 1.38, 0.86, 2.35, 0, 0.96, -1.35, 0x64748b);
      addWindowStrip(glow, 0, 1.14, -0.15, 5, 0.24, false, 0x38bdf8);
      for (const [rx, rz] of [[-2.25, 1.55], [2.25, 1.55], [-2.25, -1.85], [2.25, -1.85]]) {
        addDuctedTurbine(body, glow, rx, 0.10, rz, 0.86, 0x334155, 0x64748b, 0x38bdf8);
      }
      addNavalTurret(body, 0, 0.56, 2.65, 1.12, 0x64748b, 0xcbd5e1, 0);
      addNavalTurret(body, 0, 0.56, -3.15, 1.05, 0x64748b, 0xcbd5e1, Math.PI);
      // Twin underslung bow siege railguns (inspired by Alien Mothership)
      pushCyl(body, 0.11, 0.14, 3.25, 8, -0.62, -0.58, 3.25, 0x1e293b, Math.PI / 2, 0, 0);
      pushCyl(body, 0.11, 0.14, 3.25, 8, 0.62, -0.58, 3.25, 0x1e293b, Math.PI / 2, 0, 0);
      pushCyl(glow, 0.10, 0.10, 0.28, 6, -0.62, -0.58, 4.92, 0x38bdf8, Math.PI / 2, 0, 0);
      pushCyl(glow, 0.10, 0.10, 0.28, 6, 0.62, -0.58, 4.92, 0x38bdf8, Math.PI / 2, 0, 0);
    }
    return finalizeGroup(body, glow, 0.52, 0.42, raceGlow);
  }

  // =========================================================================
  // 5. SKY CARRIER / AIR CARRIER (Air, Epoch 5+) — ~12.2 tiles long, sleek quad-turbine helicarrier!
  // =========================================================================
  if (type === 'sky_carrier') {
    if (species === 'elf') {
      // Celestial Lotus Sky-Carrier (~12.0 tiles long): sleek petal launch deck + twin golden turbine rings
      pushTaperedHull(body, [[1.25, -5.6], [1.72, -3.2], [1.78, 2.8], [1.22, 5.1], [0.0, 6.2]], 0.85, 0.52, 0xf2ede0, 0.08);
      pushTaperedHull(body, [[1.65, -2.2], [3.65, -0.6], [3.45, 0.8], [1.65, 2.2]], 0.26, 0.24, 0xe8e2d0, 0.05);
      pushBox(body, 0.78, 1.48, 2.45, 1.32, 1.24, -1.25, 0xf8f5eb);
      pushCyl(body, 0.12, 0.28, 1.55, 6, 1.32, 2.65, -1.25, 0xc8a441);
      pushCyl(glow, 0.22, 0.06, 0.68, 6, 1.32, 3.65, -1.25, 0xa855f7);
      pushTorus(glow, 1.35, 0.18, 6, 16, 0, -0.42, 0, 0xa855f7);
      for (const [rx, rz] of [[-2.95, 0], [2.95, 0]]) {
        addDuctedTurbine(body, glow, rx, 0.05, rz, 1.12, 0xc8a441, 0xf8f5eb, 0x38bdf8);
      }
      for (const zf of [-4.0, -2.2, -0.4, 1.4, 3.2]) {
        addDeckAircraft(body, glow, -0.62, 0.54, zf, 0xc8a441, 0xf8f5eb, 0xa855f7, false, 0.12);
      }
    } else if (species === 'orc') {
      // Gargantuan bolted scrap-iron Mega-Helihulk (~12.2 tiles long) with 4 huge circular lift-rotors
      pushTaperedHull(body, [[1.48, -5.6], [1.95, -3.4], [2.02, 3.0], [1.52, 5.2], [0.75, 6.0]], 1.05, 0.58, 0x3c3734, 0.08);
      pushBox(body, 1.95, 0.20, 2.15, -0.25, 0.84, 5.15, 0x991b1b, -0.18, 0, 0);
      pushBox(body, 0.96, 1.55, 2.75, 1.45, 1.35, -1.35, 0x5c2b22);
      addWindowStrip(glow, 0.96, 1.68, -1.35, 5, 0.42, true, 0xf97316);
      for (const [rx, rz] of [[-3.15, 2.65], [3.15, 2.65], [-3.15, -2.65], [3.15, -2.65]]) {
        addDuctedTurbine(body, glow, rx, 0.12, rz, 1.15, 0x262626, 0x991b1b, 0xf97316);
      }
      addNavalTurret(body, -1.78, 0.62, 3.45, 1.1, 0x991b1b, 0x18181b, -0.4);
      for (const zf of [-3.8, -2.0, -0.2, 1.6, 3.4]) {
        addDeckAircraft(body, glow, -0.68, 0.62, zf, 0xb91c1c, 0x3f3a36, 0xf97316, false, 0.15);
      }
    } else if (species === 'dwarf') {
      // Twin-Furnace Armored Sky-Fortress Carrier (~12.0 tiles long) with 4 forge-turbine nacelles
      pushTaperedHull(body, [[1.56, -5.5], [2.02, -3.2], [2.06, 3.1], [1.56, 5.2], [0.72, 5.9]], 1.12, 0.62, 0x334155, 0.08);
      pushBox(body, 0.18, 0.04, 10.2, -0.24, 0.66, 0.1, 0xd97706);
      pushBox(body, 1.02, 1.52, 2.85, 1.48, 1.38, -1.25, 0x475569);
      addWindowStrip(glow, 0.96, 1.65, -1.25, 5, 0.44, true, 0xf59e0b);
      for (const [rx, rz] of [[-3.15, 2.55], [3.15, 2.55], [-3.15, -2.55], [3.15, -2.55]]) {
        addDuctedTurbine(body, glow, rx, 0.08, rz, 1.12, 0xb45309, 0x334155, 0xf59e0b);
      }
      addNavalTurret(body, -1.82, 0.64, 3.45, 1.1, 0xb45309, 0x1e293b, -0.35);
      for (const zf of [-3.8, -2.0, -0.2, 1.6, 3.4]) {
        addDeckAircraft(body, glow, -0.62, 0.66, zf, 0xd97706, 0x475569, 0xf59e0b, false, 0.10);
      }
    } else if (species === 'lizardfolk') {
      // Floating Golden Sun-Disc Wing Carrier (~12.0 tiles long) with stepped emerald ziggurat bridge
      pushTaperedHull(body, [[1.48, -5.5], [1.96, -3.2], [2.04, 3.0], [1.46, 5.2], [0.64, 6.0]], 0.96, 0.56, 0x1e293b, 0.08);
      pushBox(body, 0.22, 0.05, 10.0, -0.32, 0.60, 0.1, 0xd4af37);
      pushBox(glow, 0.12, 0.06, 9.2, -0.78, 0.60, 0.15, 0x10b981);
      pushBox(body, 1.24, 0.52, 2.65, 1.38, 0.86, -1.15, 0x1e293b);
      pushBox(body, 0.88, 0.48, 1.95, 1.38, 1.36, -1.15, 0xca8a04);
      pushCyl(glow, 0.06, 0.36, 0.96, 4, 1.38, 2.15, -1.15, 0x10b981);
      for (const [rx, rz] of [[-3.05, 2.35], [3.05, 2.35], [-3.05, -2.35], [3.05, -2.35]]) {
        addDuctedTurbine(body, glow, rx, 0.05, rz, 1.04, 0x1e293b, 0xd4af37, 0x10b981);
      }
      for (const zf of [-3.6, -1.8, 0.0, 1.8, 3.6]) {
        addDeckAircraft(body, glow, -0.68, 0.60, zf, 0xd4af37, 0x1e293b, 0x10b981, false, 0.12);
      }
    } else {
      // HUMAN: Sleek 4.5:1 Quad-Turbine Stratospheric Helicarrier (~12.4 tiles long, 4 massive circular turbines & 6 jets!)
      pushTaperedHull(body, [[1.32, -5.8], [1.66, -4.0], [1.72, 3.2], [1.34, 5.4], [0.85, 6.2]], 0.96, 0.56, 0x3b4856, 0.08);
      // Angled landing deck extension on port side
      pushBox(body, 1.15, 0.22, 6.8, -1.58, 0.48, -0.85, 0x26303c, 0, 0.13, 0);
      pushBox(body, 0.12, 0.03, 10.6, -0.22, 0.62, 0.1, 0xf1f5f9);
      pushBox(body, 0.10, 0.03, 6.2, -1.45, 0.62, -0.85, 0xf1f5f9, 0, 0.13, 0);
      pushBox(glow, 0.09, 0.04, 10.2, 0.34, 0.62, 0.25, 0x38bdf8);
      // Starboard command citadel + radar mast
      pushBox(body, 0.82, 1.38, 2.65, 1.34, 1.28, -1.25, 0x64748b);
      pushCyl(body, 0.08, 0.14, 1.65, 6, 1.34, 2.75, -1.35, 0xcbd5e1);
      addWindowStrip(glow, 0.92, 1.62, -1.25, 5, 0.40, true, 0x38bdf8);
      // 4 iconic colossal circular Helicarrier lift turbines
      for (const [rx, rz] of [[-3.18, 2.85], [3.18, 2.85], [-3.18, -2.85], [3.18, -2.85]]) {
        addDuctedTurbine(body, glow, rx, 0.08, rz, 1.24, 0x475569, 0x94a3b8, 0x38bdf8);
      }
      addNavalTurret(body, -1.85, 0.60, 3.65, 1.05, 0x64748b, 0xcbd5e1, -0.3);
      addNavalTurret(body, 1.65, 0.60, -4.45, 1.05, 0x64748b, 0xcbd5e1, 2.7);
      for (const [fx, fz] of [[-0.78, -4.2], [-0.72, -2.5], [-0.64, -0.8], [-0.56, 1.0], [-0.46, 2.8], [0.35, 4.1]]) {
        addDeckAircraft(body, glow, fx, 0.62, fz, 0x94a3b8, 0xe2e8f0, 0x38bdf8, false, 0.14);
      }
    }
    return finalizeGroup(body, glow, 0.52, 0.38, raceGlow);
  }

  // =========================================================================
  // 6. ORBITAL MOTHERSHIP (Orbital / Interstellar, Epoch 6+) — ~14.2 tiles long (~1/2 Alien Mothership!)
  // =========================================================================
  if (type === 'orbital_mothership') {
    if (species === 'elf') {
      // Celestial Star-Lotus Ark (~14.2 tiles long): sleek tapered ivory cathedral ship + circular golden halo rings
      pushTaperedHull(body, [[0.85, -6.6], [1.65, -4.2], [1.85, 2.2], [1.22, 5.4], [0.0, 7.2]], 1.45, 0.72, 0xf5f0e2, 0.12);
      pushTaperedHull(body, [[1.65, -2.6], [5.45, -1.0], [4.65, 0.6], [1.65, 2.4]], 0.32, 0.25, 0xe8e2d0, 0.06);
      pushCyl(body, 0.25, 0.85, 3.85, 8, 0, 2.45, -1.25, 0xf8f5eb); // towering spire cathedral
      pushCyl(body, 0.06, 0.28, 1.85, 6, 0, 5.15, -1.25, 0xc8a441);
      pushTorus(glow, 3.25, 0.22, 8, 24, 0, 0.85, -0.65, 0xa855f7); // huge circular halo ring
      pushTorus(glow, 2.15, 0.16, 6, 20, 0, 1.95, -1.25, 0x38bdf8);
      pushCyl(glow, 0.85, 0.45, 0.95, 8, 0, -1.05, 0.85, 0xa855f7); // ventral orbital beam lens
    } else if (species === 'orc') {
      // Colossal World-Krusher Orbital Mega-Hulk (~13.8 tiles long): armored dreadnought hull, giant tusks & rear engines
      pushTaperedHull(body, [[1.85, -6.2], [2.65, -3.6], [2.75, 2.4], [1.95, 5.2], [0.65, 6.4]], 2.15, 1.08, 0x36322f, 0.12);
      pushBox(body, 3.45, 1.45, 5.65, 0, 1.65, -1.25, 0x4d4540);
      pushBox(body, 2.15, 1.05, 2.25, 0, 2.85, -2.15, 0x991b1b);
      for (const side of [-1, 1]) {
        pushCyl(body, 0.08, 0.42, 3.65, 8, side * 1.65, 0.15, 7.25, 0xa1a1aa, Math.PI / 2 - 0.08, 0, 0); // colossal tusks
        pushCyl(body, 0.65, 0.78, 2.45, 8, side * 1.45, 0.15, -6.65, 0x262626, Math.PI / 2, 0, 0);
        pushCyl(glow, 0.52, 0.52, 0.24, 8, side * 1.45, 0.15, -7.92, 0xf97316, Math.PI / 2, 0, 0);
      }
      addNavalTurret(body, -1.65, 1.15, 3.25, 1.45, 0x991b1b, 0x18181b, -0.2);
      addNavalTurret(body, 1.65, 1.15, 3.25, 1.45, 0x991b1b, 0x18181b, 0.2);
      pushCyl(glow, 0.95, 0.55, 0.85, 8, 0, -1.25, 1.65, 0xff3b30);
    } else if (species === 'dwarf') {
      // Monumental Dyson-Anvil Orbital Citadel (~12.4 tile octagonal fortress ring + blazing miniature star-forge!)
      pushTorus(body, 4.45, 1.25, 6, 8, 0, 0.15, 0, 0x334155);
      pushTorus(body, 4.55, 0.28, 6, 8, 0, 1.22, 0, 0xd97706); // runic gold battlement rim
      pushTorus(body, 4.55, 0.28, 6, 8, 0, -0.92, 0, 0xb45309);
      for (let ai = 0; ai < 4; ai++) {
        const ang = (ai * Math.PI) / 2 + Math.PI / 4;
        const tx = Math.cos(ang) * 4.45;
        const tz = Math.sin(ang) * 4.45;
        addNavalTurret(body, tx, 1.32, tz, 1.45, 0xb45309, 0x1e293b, ang);
      }
      // Blazing miniature star-forge core suspended in center + glowing containment ring
      pushCyl(glow, 1.35, 1.35, 1.95, 10, 0, 0.15, 0, 0xf59e0b);
      pushTorus(glow, 2.25, 0.18, 6, 16, 0, 0.15, 0, 0xfbbf24);
    } else if (species === 'lizardfolk') {
      // Grand Floating Solar Ziggurat Ark (~11.6 tile stepped golden-obsidian pyramid + 4 orbiting obelisks)
      pushBox(body, 9.2, 1.05, 9.2, 0, -0.25, 0, 0x1e293b);
      pushBox(body, 7.1, 1.02, 7.1, 0, 0.78, 0, 0xca8a04);
      pushBox(body, 4.9, 1.02, 4.9, 0, 1.80, 0, 0x1f2937);
      pushBox(body, 2.8, 0.94, 2.8, 0, 2.76, 0, 0xd4af37);
      pushCyl(glow, 0.12, 1.15, 2.15, 4, 0, 4.15, 0, 0x10b981); // emerald apex crystal
      pushCyl(glow, 1.25, 0.45, 1.15, 6, 0, -1.25, 0, 0xfacc15); // ventral solar lens
      for (const [ox, oz] of [[-5.4, 5.4], [5.4, 5.4], [-5.4, -5.4], [5.4, -5.4]]) {
        pushCyl(body, 0.36, 0.56, 3.25, 4, ox, 0.65, oz, 0xca8a04);
        pushCyl(glow, 0.08, 0.34, 1.15, 4, ox, 2.65, oz, 0x10b981);
      }
    } else {
      // HUMAN: Sleek 14.4-tile Interstellar Ring-Ark Command Mothership (sculpted dreadnought hull + huge circular warp ring!)
      pushTaperedHull(body, [[1.35, -6.8], [2.15, -4.4], [2.25, 2.6], [1.55, 5.8], [0.0, 7.4]], 1.65, 0.85, 0x334155, 0.12);
      // Matte-dark upper flight/sensor spine + elevated rear command citadel
      pushBox(body, 1.85, 0.24, 9.2, 0, 0.98, 0.85, 0x181b20);
      pushBox(body, 2.15, 1.45, 2.85, 0, 1.62, -3.65, 0x475569);
      pushBox(body, 2.55, 0.72, 1.85, 0, 2.55, -3.55, 0x1e293b);
      addWindowStrip(glow, 0, 2.58, -2.58, 6, 0.32, false, 0xfbbf24);
      // 3 mid-dorsal cylindrical reactor drums (echoing Alien Mothership silhouette!)
      for (let di = 0; di < 3; di++) {
        pushCyl(body, 0.72, 0.72, 0.92, 10, 0, 1.38, -0.4 - di * 1.35, 0x64748b, Math.PI / 2, 0, 0);
        pushTorus(glow, 0.78, 0.08, 6, 14, 0, 1.38, -0.4 - di * 1.35, 0x38bdf8, 0, 0, 0);
      }
      // Huge encircling luminous circular warp-drive ring!
      pushTorus(body, 4.65, 0.34, 8, 28, 0, 0.05, -0.65, 0x475569);
      pushTorus(glow, 4.65, 0.16, 6, 28, 0, 0.05, -0.65, 0x38bdf8);
      // Twin underslung bow siege railgun barrels + triple cylindrical rear ion drives
      for (const side of [-1, 1]) {
        pushCyl(body, 0.14, 0.18, 4.45, 8, side * 0.88, -0.78, 5.45, 0x181b20, Math.PI / 2, 0, 0);
        pushCyl(glow, 0.12, 0.12, 0.32, 6, side * 0.88, -0.78, 7.72, 0x38bdf8, Math.PI / 2, 0, 0);
        addNavalTurret(body, side * 1.85, 0.86, 2.25, 1.25, 0x64748b, 0xcbd5e1, side * 0.35);
      }
      for (const ex of [-1.05, 0, 1.05]) {
        pushCyl(body, 0.42, 0.52, 1.35, 10, ex, 0.05, -7.25, 0x1e293b, Math.PI / 2, 0, 0);
        pushCyl(glow, 0.34, 0.34, 0.18, 10, ex, 0.05, -7.95, 0x38bdf8, Math.PI / 2, 0, 0);
      }
    }
    return finalizeGroup(body, glow, 0.56, 0.34, raceGlow);
  }

  return null;
}
