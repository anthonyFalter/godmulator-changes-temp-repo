import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SpeciesId, VehicleType } from './types';

/** Normalize any Three.js BufferGeometry into non-indexed {position, normal, uv, color} for clean merging */
function pushGeo(parts: THREE.BufferGeometry[], rawGeo: THREE.BufferGeometry, hex: number): void {
  const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo;
  if (rawGeo.index) rawGeo.dispose();
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const pos = g.getAttribute('position');
  const norm = g.getAttribute('normal');
  for (const key of Object.keys(g.attributes)) {
    if (key !== 'position' && key !== 'normal') {
      g.deleteAttribute(key);
    }
  }
  const uvs = new Float32Array(pos.count * 2);
  const uvScale = 0.24;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const ax = Math.abs(norm.getX(i));
    const ay = Math.abs(norm.getY(i));
    const az = Math.abs(norm.getZ(i));
    if (ay >= ax && ay >= az) {
      uvs[i * 2] = px * uvScale;
      uvs[i * 2 + 1] = pz * uvScale;
    } else if (ax >= az) {
      uvs[i * 2] = pz * uvScale;
      uvs[i * 2 + 1] = py * uvScale;
    } else {
      uvs[i * 2] = px * uvScale;
      uvs[i * 2 + 1] = py * uvScale;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

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
    bevelSegments: 2,
  });
  g.rotateX(Math.PI / 2);
  g.translate(0, yTop, 0);
  pushGeo(parts, g, hex);
}

/** Sculpted vertical naval/aerospace ventral keel blade (YZ-plane extruded silhouette, Alien-Mothership style) */
function pushVentralKeel(
  parts: THREE.BufferGeometry[],
  yzPoints: Array<[number, number]>,
  thickness: number,
  hex: number,
  bevel = 0.08,
): void {
  const shape = new THREE.Shape();
  shape.moveTo(yzPoints[0][0], yzPoints[0][1]);
  for (let i = 1; i < yzPoints.length; i++) shape.lineTo(yzPoints[i][0], yzPoints[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  g.translate(0, 0, -thickness * 0.5);
  g.rotateY(-Math.PI / 2);
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
const siegeSurfaceTexCache: Partial<Record<'weathered_armor' | 'brushed_metal', THREE.Texture>> = {};

/**
 * Generates crisp 32x32 pixel-art weathered armor & brushed metal surface textures (NearestFilter,
 * neutral light-grey base so vertexColors multiply cleanly without any repetitive black grid!).
 */
function getSiegeSurfaceTexture(style: 'weathered_armor' | 'brushed_metal'): THREE.Texture {
  const existing = siegeSurfaceTexCache[style];
  if (existing) return existing;

  if (typeof document === 'undefined') {
    const data = new Uint8Array(32 * 32 * 4).fill(235);
    const tex = new THREE.DataTexture(data, 32, 32, THREE.RGBAFormat);
    tex.needsUpdate = true;
    siegeSurfaceTexCache[style] = tex;
    return tex;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(32, 32);

  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      let h = Math.imul(x + 17, 374761393) ^ Math.imul(y + 31, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      const n = ((h ^ (h >>> 16)) >>> 0) / 4294967295;

      // Coarse 2x2 mottled weathering blotches (like Minecraft/voxel stone & weathered steel in image_2.png)
      let hc = Math.imul((x >> 1) + 5, 2246822519) ^ Math.imul((y >> 1) + 11, 3266489917);
      hc = Math.imul(hc ^ (hc >>> 15), 668265263);
      const nc = ((hc ^ (hc >>> 16)) >>> 0) / 4294967295;

      let v = 228;
      if (style === 'weathered_armor') {
        v = 216 + Math.round((nc - 0.5) * 44) + Math.round((n - 0.5) * 26);
        if (y % 8 === 0 && (x + (y >> 3) * 7) % 16 < 12) v -= 14;
        if ((x % 8 === 2 || x % 8 === 6) && y % 8 === 1 && n > 0.45) v += 18;
      } else {
        let hs = Math.imul((x >> 2) + 3, 374761393) ^ Math.imul(y + 19, 668265263);
        const streak = (((hs ^ (hs >>> 13)) >>> 0) / 4294967295 - 0.5) * 38;
        v = 224 + Math.round(streak) + Math.round((n - 0.5) * 20);
        if (y % 6 === 2 && n > 0.65) v += 24;
      }

      v = Math.max(150, Math.min(255, v));
      const idx = (y * 32 + x) * 4;
      img.data[idx] = v;
      img.data[idx + 1] = v;
      img.data[idx + 2] = v;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  siegeSurfaceTexCache[style] = tex;
  return tex;
}

function finalizeMultiFinishGroup(
  matteParts: THREE.BufferGeometry[],
  metalParts: THREE.BufferGeometry[],
  winParts: THREE.BufferGeometry[],
  glowParts: THREE.BufferGeometry[],
  darkParts: THREE.BufferGeometry[] = [],
  deckParts: THREE.BufferGeometry[] = [],
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

  // 1. Machined Armored Hull Plating (matches Alien Mothership armorMidMat / armorLightMat sheen!)
  addMerged(
    matteParts,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: getSiegeSurfaceTexture('weathered_armor'),
      roughness: 0.44,
      metalness: 0.56,
    }),
    true,
  );
  // 2. Brushed Gunmetal / Gold / Brass Trim & Barrels
  addMerged(
    metalParts,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: getSiegeSurfaceTexture('brushed_metal'),
      roughness: 0.28,
      metalness: 0.82,
    }),
    true,
  );
  // 3. Glossy Obsidian-Charcoal Structural Trusses, Hangars & Frames (zero muddy noise!)
  addMerged(
    darkParts,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.34,
      metalness: 0.78,
    }),
    true,
  );
  // 4. Clean Matte Flight Decks, Wood Planks & Stone Terraces
  addMerged(
    deckParts,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.12,
    }),
    true,
  );
  // 5. Crisp Lit Bridge Windows
  addMerged(
    winParts,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
    }),
    false,
  );
  // 6. Restrained Emissive Thruster / Reactor / Arcane Accents
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
  const dark: THREE.BufferGeometry[] = [];
  const deck: THREE.BufferGeometry[] = [];

  // =========================================================================
  // 1. PRIMARY SIEGE MACHINES (aircraft_carrier slot, Epoch 3+)
  //    - Human:      Mothership-grade Fleet Carrier (WWII wood-deck -> Nuclear Supercarrier, Sea)
  //    - Dwarf:      Runeforge Land-Dreadnought Mobile Fortress (Land)
  //    - Orc:        WAAAGH! Scrap-Juggernaut Jaw-Fortress (Land)
  //    - Elf:        Sylvan Aether-Carrier Levitating Sky-Citadel (Sky)
  //    - Lizardfolk: Amphibious Ziggurat-Leviathan (Hybrid Land + Sea)
  // =========================================================================
  if (type === 'aircraft_carrier') {
    const isPropEra = e <= 3;

    if (species === 'dwarf') {
      // DWARF: Runeforge Land-Dreadnought — high-contrast sloped gunmetal, glossy charcoal treads & riveted brass!
      for (const zOff of [-3.1, 2.2]) {
        for (const side of [-1, 1]) {
          pushBox(dark, 1.05, 0.95, 2.95, side * 2.15, 0.48, zOff, 0x181b20);
          for (let wi = -1; wi <= 1; wi++) {
            pushCyl(metal, 0.36, 0.36, 1.14, 12, side * 2.15, 0.38, zOff + wi * 0.94, 0xb45309, 0, 0, Math.PI / 2);
            pushCyl(dark, 0.16, 0.16, 1.22, 8, side * 2.15, 0.38, zOff + wi * 0.94, 0x111418, 0, 0, Math.PI / 2);
          }
          pushBox(matte, 1.26, 0.24, 3.25, side * 2.15, 1.04, zOff, 0x64748b);
          // Exposed structural fender braces
          for (const bz of [-1.2, 0, 1.2]) {
            pushBox(dark, 0.14, 0.65, 0.16, side * 2.74, 0.72, zOff + bz, 0x262a33);
          }
        }
      }
      pushTaperedHull(matte, [[1.65, -4.8], [1.98, -3.2], [1.98, 3.4], [1.45, 4.9], [0.55, 5.45]], 1.28, 1.70, 0x475569, 0.10);
      pushBox(deck, 3.35, 0.14, 8.8, 0, 1.76, -0.2, 0x1f2937); // dark ironclad upper deck
      pushBox(metal, 4.06, 0.16, 8.6, 0, 1.74, -0.2, 0xb45309);
      for (const side of [-1, 1]) {
        for (const fz of [-1.4, 0.0, 1.4]) {
          pushBox(dark, 0.22, 0.56, 0.92, side * 1.98, 1.12, fz, 0x111418);
          pushBox(glow, 0.08, 0.30, 0.64, side * 2.08, 1.12, fz, 0xf59e0b);
          pushBox(dark, 0.14, 0.95, 0.14, side * 2.04, 1.18, fz + 0.68, 0x262a33); // hull rib
        }
      }
      // Tiered Runeforge Citadel Keep + overhanging bronze command gallery + twin blast chimneys
      pushTaperedHull(matte, [[1.25, -3.2], [1.50, -1.8], [1.50, 1.2], [1.15, 2.2]], 1.18, 2.88, 0x64748b, 0.08);
      pushBox(dark, 2.75, 0.58, 2.6, 0, 3.22, -0.4, 0x181b20);
      pushBox(metal, 2.45, 0.18, 4.3, 0, 3.58, -0.6, 0xd97706);
      addWindowStrip(win, 0, 3.22, 0.94, 5, 0.36, false, 0xfbbf24);
      for (const side of [-1, 1]) {
        pushCyl(dark, 0.22, 0.28, 2.45, 12, side * 0.95, 4.15, -2.15, 0x181b20, -0.1, 0, 0);
        pushCyl(metal, 0.28, 0.28, 0.20, 12, side * 0.95, 5.32, -2.28, 0xd97706);
      }
      addNavalTurret(matte, metal, 0, 1.80, 3.45, 1.48, 0x64748b, 0x181b20, 0);
      addNavalTurret(matte, metal, 0, 1.80, -3.75, 1.28, 0x64748b, 0x181b20, Math.PI);
      addNavalTurret(matte, metal, -1.78, 1.80, 0.5, 0.92, 0xb45309, 0x181b20, -Math.PI / 2);
      addNavalTurret(matte, metal, 1.78, 1.80, 0.5, 0.92, 0xb45309, 0x181b20, Math.PI / 2);
      if (e >= 5) pushCyl(glow, 0.34, 0.44, 0.78, 10, 0, 4.02, -0.5, 0xfbbf24);
    } else if (species === 'orc') {
      // ORC: WAAAGH! Scrap-Juggernaut — high-contrast glossy charcoal chassis, crimson war-plates & iron tusks!
      for (const side of [-1, 1]) {
        pushBox(dark, 1.15, 1.05, 8.4, side * 2.12, 0.52, -0.2, 0x18181b);
        for (let tz = -3.6; tz <= 3.6; tz += 1.0) {
          pushCyl(metal, 0.04, 0.16, 0.58, 6, side * 2.78, 0.52, tz, 0xa1a1aa, 0, 0, -side * Math.PI / 2);
        }
      }
      pushTaperedHull(matte, [[1.75, -4.6], [2.05, -2.5], [2.05, 3.2], [1.65, 4.4]], 1.48, 1.88, 0x4b433e, 0.08);
      pushBox(deck, 3.65, 0.14, 8.2, 0, 1.92, -0.3, 0x262626);
      pushBox(matte, 1.48, 0.98, 5.6, -1.25, 1.50, -0.4, 0x991b1b, 0, 0, 0.08);
      pushBox(matte, 1.38, 0.88, 4.9, 1.25, 1.54, 0.2, 0x6b2f24, 0, 0, -0.06);
      // Roaring furnace-jaw ram with iron tusks
      pushBox(dark, 3.55, 1.02, 1.45, 0, 0.96, 4.65, 0x141417);
      pushBox(glow, 2.75, 0.56, 0.68, 0, 0.96, 5.18, 0xf97316);
      for (let tx = -1.35; tx <= 1.35; tx += 0.45) {
        pushCyl(metal, 0.03, 0.14, 0.92, 6, tx, 0.68, 5.56, 0xd4d4d8, Math.PI / 2 - 0.25, 0, 0);
        pushCyl(metal, 0.03, 0.12, 0.74, 6, tx, 1.40, 5.45, 0xd4d4d8, Math.PI / 2 + 0.22, 0, 0);
      }
      pushBox(dark, 2.35, 1.48, 3.7, 0.45, 2.58, -1.35, 0x262626);
      pushBox(matte, 1.72, 0.88, 2.3, 0.65, 3.68, -1.55, 0x991b1b);
      addWindowStrip(win, 0.65, 3.72, -0.36, 4, 0.30, false, 0xfbbf24);
      pushCyl(dark, 0.22, 0.28, 2.55, 10, -1.25, 3.30, -2.65, 0x18181b, -0.18, 0, 0.15);
      pushCyl(dark, 0.20, 0.26, 2.25, 10, 1.55, 3.50, -2.35, 0x18181b, -0.16, 0, -0.12);
      pushCyl(glow, 0.18, 0.18, 0.14, 10, -1.48, 4.55, -2.90, 0xf97316);
      addNavalTurret(matte, metal, -0.75, 1.94, 2.15, 1.48, 0x991b1b, 0x18181b, -0.15);
      addNavalTurret(matte, metal, 1.55, 1.94, 1.25, 0.95, 0x4b433e, 0x18181b, 0.5);
      pushCyl(metal, 0.04, 0.06, 2.7, 6, 1.45, 4.6, -1.2, 0xa1a1aa);
      pushBox(deck, 0.06, 1.0, 1.55, 1.45, 5.35, -1.98, 0xdc2626);
    } else if (species === 'elf') {
      // ELF: Sylvan Aether-Carrier — Mothership-grade ventral keel + swept swan-wings + gilded ivory sky-citadel!
      pushVentralKeel(matte, [[-4.2, -0.4], [4.6, -0.4], [2.4, -2.3], [-1.8, -1.9]], 0.42, 0xe8e2d0, 0.06);
      pushTaperedHull(matte, [[0.85, -6.2], [1.58, -3.8], [1.68, 2.8], [1.05, 5.3], [0.0, 6.8]], 0.88, 0.56, 0xf5f0e2, 0.09);
      pushTaperedHull(matte, [[1.45, -2.5], [4.55, -0.9], [4.05, 0.8], [1.45, 2.2]], 0.28, 0.26, 0xe8e2d0, 0.06);
      pushTaperedHull(deck, [[1.28, -5.8], [1.42, -3.5], [1.46, 2.6], [0.92, 4.9], [0.0, 6.2]], 0.12, 0.64, 0xf8f5eb, 0.02);
      pushBox(metal, 0.18, 0.04, 11.6, 0, 0.66, 0.2, 0xc8a441);
      pushBox(glow, 0.08, 0.04, 10.4, -0.98, 0.66, 0.15, 0x38bdf8);
      pushBox(glow, 0.08, 0.04, 10.4, 0.98, 0.66, 0.15, 0x38bdf8);
      for (const side of [-1, 1]) {
        for (let ri = -3; ri <= 3; ri++) {
          pushBox(metal, 0.14, 0.72, 0.14, side * 1.66, 0.15, ri * 1.45, 0xc8a441);
        }
        addDuctedTurbine(matte, metal, glow, side * 3.25, 0.08, -0.25, 1.24, 0xc8a441, 0xf8f5eb, 0x38bdf8);
        pushCyl(glow, 0.34, 0.54, 2.9, 12, side * 3.25, -1.5, -0.25, 0x7dd3fc);
      }
      pushBox(matte, 0.78, 1.45, 2.55, 1.18, 1.38, -1.25, 0xf8f5eb);
      pushBox(metal, 0.92, 0.18, 2.68, 1.18, 2.15, -1.25, 0xc8a441);
      pushCyl(metal, 0.08, 0.28, 1.95, 10, 1.18, 3.15, -1.25, 0xc8a441);
      pushCyl(glow, 0.20, 0.04, 0.92, 10, 1.18, 4.55, -1.25, 0xc084fc);
      addWindowStrip(win, 0.76, 1.56, -1.25, 5, 0.38, true, 0x7dd3fc);
      for (const zf of [-4.0, -2.2, -0.4, 1.4, 3.2]) {
        addDeckAircraft(matte, metal, win, -0.58, 0.68, zf, 0xc8a441, 0xf8f5eb, false, 0.12);
      }
    } else if (species === 'lizardfolk') {
      // LIZARDFOLK: Amphibious Ziggurat-Leviathan — high-contrast obsidian, gilded gold & jade hydro-ribs!
      for (const side of [-1, 1]) {
        pushBox(dark, 0.96, 0.82, 10.2, side * 2.18, 0.42, 0, 0x111827);
        pushBox(metal, 1.04, 0.18, 9.8, side * 2.18, 0.88, 0, 0xca8a04);
        pushBox(glow, 0.12, 0.18, 8.8, side * 2.68, 0.46, 0, 0x34d399);
        for (let ri = -3; ri <= 3; ri++) {
          pushBox(metal, 0.14, 0.78, 0.18, side * 2.68, 0.45, ri * 1.4, 0xd4af37);
        }
      }
      pushTaperedHull(matte, [[1.78, -5.0], [2.08, -3.2], [2.08, 3.2], [1.45, 5.0], [0.0, 5.9]], 1.08, 1.20, 0x1e293b, 0.08);
      pushBox(deck, 3.45, 0.64, 6.9, 0, 1.50, -0.4, 0x182230);
      pushBox(metal, 3.62, 0.16, 7.1, 0, 1.86, -0.4, 0xca8a04);
      pushBox(deck, 2.48, 0.64, 4.9, 0, 2.22, -0.5, 0x182230);
      pushBox(metal, 2.66, 0.16, 5.1, 0, 2.58, -0.5, 0xd4af37);
      pushBox(dark, 1.55, 0.58, 2.85, 0, 2.92, -0.6, 0x111827);
      pushCyl(glow, 0.08, 0.58, 1.65, 4, 0, 3.96, -0.6, 0x34d399);
      for (const side of [-1, 1]) {
        pushCyl(metal, 0.11, 0.15, 2.75, 8, side * 0.95, 1.42, 4.35, 0xd4af37, Math.PI / 2, 0, 0);
        pushCyl(glow, 0.09, 0.09, 0.38, 8, side * 0.95, 1.42, 5.75, 0x34d399, Math.PI / 2, 0, 0);
        for (const bz of [-3.6, 2.8]) {
          pushCyl(glow, 0.15, 0.22, 0.56, 8, side * 1.66, 2.12, bz, 0x34d399);
        }
      }
    } else {
      // HUMAN: Alien-Mothership-Grade Fleet Aircraft Carrier (13.4 tiles long!)
      // Crisp 6-material separation: machined light/mid steel hull, glossy dark hangars/trusses,
      // clean matte plank/asphalt flight deck, brushed steel turrets/girders/cranes, warm bridge slits!
      const hullLight = isPropEra ? 0xb4bfc9 : e >= 5 ? 0x64748b : 0x808e9c;
      const hullMid = isPropEra ? 0x808f9e : e >= 5 ? 0x475569 : 0x5d6b7a;
      const deckHex = isPropEra ? 0xe5cca4 : e >= 5 ? 0x1b212b : 0x2a3340;

      // 1. Maroon anti-fouling lower hull + smooth flared machined steel upper hull
      pushTaperedHull(deck, [
        [0.90, -6.3], [1.20, -4.6], [1.26, 2.9], [0.92, 5.3], [0.38, 6.5], [0.0, 6.9],
      ], 0.34, 0.30, 0x6b212a, 0.04);
      pushTaperedHull(matte, [
        [0.98, -6.2], [1.26, -4.5], [1.32, 2.9], [0.98, 5.3], [0.44, 6.4], [0.0, 6.8],
      ], 0.74, 1.02, hullMid, 0.06);

      // 2. Exposed dark structural truss ribs, recessed glossy hangars, sponsons & under-deck steel girders!
      for (const side of [-1, 1]) {
        // Light-grey upper armored gunwale belt + dark catwalk trough
        pushBox(matte, 0.22, 0.22, 10.2, side * 1.38, 0.94, -0.3, hullLight);
        pushBox(dark, 0.16, 0.12, 10.6, side * 1.48, 1.06, -0.3, 0x181b20);
        // 8 exposed structural hull ribs along each flank (Mothership-style mechanical density!)
        for (let ri = -4; ri <= 3; ri++) {
          pushBox(dark, 0.14, 0.72, 0.14, side * 1.34, 0.64, ri * 1.35 + 0.4, 0x262a33);
        }
        // Under-deck cantilevered girder pillars at bow & stern
        for (const gz of [-5.7, -5.0, 5.2, 5.9]) {
          pushCyl(dark, 0.055, 0.065, 0.68, 8, side * 0.72, 0.85, gz, 0x1e242c);
        }
        // Recessed glowing hangar bays framed in glossy charcoal
        for (const hz of [-2.6, 0.9]) {
          pushBox(dark, 0.18, 0.42, 1.78, side * 1.30, 0.64, hz, 0x111418);
          pushBox(win, 0.06, 0.12, 1.38, side * 1.36, 0.76, hz, 0xfbbf24);
        }
        // Compact armored lifeboat / sensor sponsons
        for (const lz of [-4.2, 3.2]) {
          pushBox(dark, 0.34, 0.26, 0.92, side * 1.46, 0.86, lz, 0x262a33);
          pushBox(matte, 0.30, 0.10, 0.86, side * 1.46, 1.02, lz, hullLight);
        }
      }

      // 3. Long clean matte flight deck + arrestor cables + blast deflectors + deck-edge elevators
      pushTaperedHull(deck, [
        [1.28, -6.1], [1.50, -4.4], [1.52, 3.8], [1.20, 5.9], [0.88, 6.4],
      ], 0.18, 1.20, deckHex, 0.03);
      // 4 crisp steel arrestor wires across aft landing zone
      for (let aw = 0; aw < 4; aw++) {
        pushBox(metal, 2.25, 0.025, 0.04, -0.15, 1.22, -5.1 + aw * 0.55, 0x94a3b8);
      }
      // Deck-edge aircraft elevators framed in dark steel
      for (const [ex, ez] of [[-1.62, -0.6], [1.62, 2.1], [-1.62, -3.5]]) {
        pushBox(dark, 0.48, 0.14, 1.45, ex, 1.15, ez, 0x181b20);
        pushBox(metal, 0.42, 0.06, 1.35, ex, 1.21, ez, 0x64748b);
      }

      if (isPropEra) {
        // Darker weathered aft landing deck + bold crimson bow star insignia (image.png!)
        pushBox(deck, 2.78, 0.02, 5.9, 0, 1.215, -2.95, 0xcab084);
        pushBox(deck, 0.64, 0.025, 0.64, 0, 1.22, 4.55, 0xb91c1c, 0, Math.PI / 4, 0);
        pushBox(deck, 0.64, 0.025, 0.64, 0, 1.22, 4.55, 0xb91c1c);
      } else {
        // Port angled landing deck sponson + crisp white dashed centerline & catapult tracks + jet blast deflectors
        pushBox(deck, 1.06, 0.16, 6.9, -1.48, 1.12, -0.85, deckHex, 0, 0.13, 0);
        pushBox(deck, 0.09, 0.025, 6.5, -1.34, 1.22, -0.85, 0xf1f5f9, 0, 0.13, 0);
        pushBox(deck, 0.09, 0.025, 11.6, -0.18, 1.22, 0.15, 0xf1f5f9);
        pushBox(deck, 0.06, 0.025, 10.2, 0.38, 1.22, 0.35, 0xfbbf24);
        pushBox(metal, 0.56, 0.18, 0.12, -0.18, 1.28, 1.55, 0x64748b, -0.45, 0, 0); // jet blast deflector
        if (e >= 6) pushBox(glow, 0.08, 0.03, 10.8, -0.18, 1.23, 0.15, 0x60a5fa);
      }

      // 4. Multi-tiered high-contrast Command Island (light steel + glossy charcoal bridge + amber slits + crane + radome!)
      pushBox(matte, 0.68, 1.30, 2.75, 1.14, 1.86, -1.15, hullMid);
      pushBox(dark, 0.78, 0.54, 1.95, 1.14, 2.52, -1.20, 0x181b20);
      pushBox(matte, 0.96, 0.20, 1.65, 1.14, 2.86, -1.25, hullLight); // overhanging bridge cap
      // Aft deck recovery crane boom
      pushCyl(metal, 0.05, 0.07, 1.35, 8, 1.22, 1.92, -3.15, 0x94a3b8, -0.55, 0, 0.15);
      if (isPropEra) {
        pushCyl(dark, 0.22, 0.26, 1.60, 12, 1.14, 2.95, -0.35, 0x181b20, -0.12, 0, 0);
        pushCyl(metal, 0.24, 0.24, 0.16, 12, 1.14, 3.72, -0.44, 0x475569);
        pushCyl(metal, 0.04, 0.08, 1.95, 8, 1.14, 3.75, -1.55, 0xcbd5e1);
        pushBox(metal, 0.78, 0.08, 0.06, 1.14, 4.25, -1.55, 0xe2e8f0);
      } else {
        pushCyl(metal, 0.06, 0.11, 1.85, 10, 1.14, 3.82, -1.25, 0xcbd5e1);
        pushBox(metal, 1.12, 0.12, 0.09, 1.14, 4.35, -1.25, 0xe2e8f0);
        pushCyl(deck, 0.24, 0.24, 0.28, 12, 1.14, 3.16, -0.75, 0xf8fafc); // crisp white radome
        pushBox(glow, 0.12, 0.10, 0.12, 1.14, 4.78, -1.25, 0x60a5fa); // mast beacon
      }
      addWindowStrip(win, 0.74, 2.52, -1.20, 5, 0.34, true, 0xfbbf24);
      addWindowStrip(win, 1.14, 2.54, -0.20, 3, 0.16, false, 0xfbbf24);

      // 5. 4 Armored AA Defense Turrets + 6 Sculpted Parked Aircraft
      addNavalTurret(matte, metal, -1.54, 1.20, 3.95, 0.72, hullLight, 0x181b20, -0.3);
      addNavalTurret(matte, metal, 1.46, 1.20, -4.75, 0.72, hullLight, 0x181b20, 2.8);
      addNavalTurret(matte, metal, -1.54, 1.20, -4.55, 0.65, hullLight, 0x181b20, -2.6);
      addNavalTurret(matte, metal, 1.46, 1.20, 4.05, 0.65, hullLight, 0x181b20, 0.3);
      for (const [fx, fz] of [[-0.68, -4.6], [-0.62, -2.8], [-0.56, -1.0], [-0.48, 0.8], [-0.36, 2.6], [0.34, 4.0]]) {
        addDeckAircraft(matte, metal, win, fx, 1.23, fz, 0x94a3b8, 0xe2e8f0, isPropEra, 0.14);
      }
    }

    return finalizeMultiFinishGroup(matte, metal, win, glow, dark, deck);
  }

  // =========================================================================
  // 2. SUBMARINE (Sea, Epoch 3+) — Submerged underwater silhouette + periscope above water!
  // =========================================================================
  if (type === 'submarine') {
    const silhouette: THREE.BufferGeometry[] = [];
    const silCol =
      species === 'dwarf' ? 0x291d14 : species === 'elf' ? 0x38bdf8 : 0x071929;
    const silOpacity = species === 'elf' ? 0.34 : species === 'dwarf' ? 0.52 : 0.46;

    // Helper: push a flattened underwater/subterranean/cloaked hull silhouette part
    const pushSilGeo = (raw: THREE.BufferGeometry) => {
      const g = raw.index ? raw.toNonIndexed() : raw;
      if (g !== raw) raw.dispose();
      g.deleteAttribute('uv');
      silhouette.push(g);
    };
    const pushSubSilhouetteCyl = (
      rTop: number,
      rBot: number,
      len: number,
      segs: number,
      x: number,
      z: number,
    ) => {
      const g = new THREE.CylinderGeometry(rTop, rBot, len, segs);
      g.rotateX(Math.PI / 2);
      g.scale(1, 0.08, 1);
      g.translate(x, 0.02, z);
      pushSilGeo(g);
    };
    const pushSubSilhouetteHull = (pts: [number, number][]) => {
      const shape = new THREE.Shape();
      shape.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
      for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(-pts[i][0], pts[i][1]);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
      g.rotateX(Math.PI / 2);
      g.translate(0, 0.035, 0);
      pushSilGeo(g);
    };

    if (species === 'elf') {
      // ELF: High-Altitude Astral Prism-Skiff (shimmering cloaked starlight silhouette + gilded crystal spire!)
      pushSubSilhouetteCyl(0.42, 0.46, 5.2, 12, 0, 0);
      pushSubSilhouetteCyl(0.05, 0.42, 1.85, 12, 0, 3.45);
      pushSubSilhouetteCyl(0.42, 0.05, 2.0, 12, 0, -3.55);
      pushSubSilhouetteHull([[0.48, -1.6], [2.45, -0.5], [1.95, 0.9], [0.48, 1.8]]);
      // Crisp gilded astral prism core & orbiting sapphire focus ring
      pushCyl(metal, 0.14, 0.24, 0.65, 6, 0, 0.35, 0.2, 0xc8a441);
      pushCyl(glow, 0.05, 0.16, 0.95, 6, 0, 1.05, 0.2, 0xc084fc);
      pushTorus(glow, 0.68, 0.05, 6, 16, 0, 0.55, 0.2, 0x7dd3fc);
    } else if (species === 'orc') {
      // ORC: Scrap-Shark Submersible (submerged shark-sub + twin torpedo pods + crooked periscope hatch)
      pushSubSilhouetteCyl(0.54, 0.54, 5.2, 10, 0, -0.1);
      pushSubSilhouetteCyl(0.16, 0.54, 1.55, 10, 0, 3.25);
      pushSubSilhouetteCyl(0.52, 0.14, 1.65, 10, 0, -3.52);
      for (const side of [-1, 1]) {
        pushSubSilhouetteCyl(0.18, 0.18, 2.65, 8, side * 0.66, 1.15);
      }
      pushBox(matte, 0.24, 0.36, 0.58, 0, 0.18, 0.42, 0x2c2825);
      pushCyl(metal, 0.05, 0.06, 0.86, 6, 0, 0.74, 0.54, 0x78716c);
      pushBox(metal, 0.14, 0.12, 0.24, 0, 1.14, 0.62, 0x44403c);
      pushBox(glow, 0.10, 0.08, 0.06, 0, 1.14, 0.75, 0xef4444);
      pushCyl(metal, 0.035, 0.045, 0.64, 6, 0.08, 0.62, 0.22, 0x57534e);
    } else if (species === 'dwarf') {
      // DWARF: Subterranean Mole-Driller / Seismic Rail-Howitzer (earthen burrow silhouette + bronze drill vents!)
      pushSubSilhouetteCyl(0.72, 0.72, 5.0, 10, 0, -0.1);
      pushSubSilhouetteCyl(0.12, 0.72, 1.95, 10, 0, 3.35);
      pushSubSilhouetteCyl(0.68, 0.26, 1.65, 10, 0, -3.35);
      // Above-ground: armored bronze seismic mortar cupola, twin steam-vent periscopes & glowing magma core
      pushCyl(matte, 0.36, 0.48, 0.38, 8, 0, 0.20, 0.15, 0x334155);
      pushCyl(metal, 0.26, 0.32, 0.28, 8, 0, 0.46, 0.15, 0xb45309);
      pushCyl(metal, 0.09, 0.12, 0.85, 8, 0, 0.85, 0.38, 0x1e293b, 0.42, 0, 0); // elevated seismic mortar tube
      pushCyl(metal, 0.05, 0.06, 0.92, 6, -0.22, 0.72, -0.15, 0xd97706); // steam vent chimney
      pushCyl(metal, 0.05, 0.06, 0.78, 6, 0.22, 0.65, -0.15, 0xd97706);
      pushBox(glow, 0.18, 0.12, 0.10, 0, 0.48, 0.46, 0xfbbf24);
    } else if (species === 'lizardfolk') {
      // LIZARDFOLK: Abyssal Sun-Serpent Submersible (serpentine underwater silhouette + golden dorsal fin!)
      pushSubSilhouetteCyl(0.48, 0.52, 5.4, 10, 0, 0);
      pushSubSilhouetteCyl(0.12, 0.48, 1.75, 10, 0, 3.55);
      pushSubSilhouetteCyl(0.50, 0.10, 1.95, 10, 0, -3.65);
      pushSubSilhouetteHull([[0.22, -4.15], [1.15, -3.55], [0.95, -2.85], [0.22, -2.75]]);
      pushBox(metal, 0.14, 0.38, 0.72, 0, 0.20, 0.35, 0xd4af37);
      for (const side of [-1, 1]) {
        pushCyl(metal, 0.035, 0.045, 0.72, 6, side * 0.11, 0.68, 0.48, 0xca8a04);
        pushBox(glow, 0.08, 0.08, 0.10, side * 0.11, 1.04, 0.54, 0x34d399);
      }
    } else {
      // HUMAN: Submerged sleek SLBM attack submarine silhouette + periscope-only above water!
      pushSubSilhouetteCyl(0.50, 0.50, 5.5, 12, 0, 0);
      pushSubSilhouetteCyl(0.10, 0.50, 1.48, 12, 0, 3.48);
      pushSubSilhouetteCyl(0.50, 0.08, 1.90, 12, 0, -3.68);
      pushSubSilhouetteHull([[0.18, 0.25], [0.96, 0.45], [0.96, 0.85], [0.18, 0.95]]);
      pushSubSilhouetteHull([[0.16, -4.15], [0.92, -3.95], [0.92, -3.55], [0.16, -3.45]]);
      pushTaperedHull(matte, [[0.10, -0.05], [0.16, 0.28], [0.14, 0.72], [0.04, 0.95]], 0.34, 0.36, 0x334155, 0.02);
      pushCyl(metal, 0.032, 0.045, 0.96, 8, -0.05, 0.82, 0.58, 0xcbd5e1);
      pushBox(metal, 0.10, 0.10, 0.22, -0.05, 1.28, 0.66, 0x475569);
      pushBox(glow, 0.07, 0.06, 0.05, -0.05, 1.28, 0.78, e >= 5 ? 0x38bdf8 : 0xfef08a);
      pushCyl(metal, 0.026, 0.036, 0.72, 6, 0.06, 0.70, 0.28, 0x94a3b8);
    }

    const subGroup = finalizeMultiFinishGroup(matte, metal, win, glow);

    if (silhouette.length > 0) {
      const mergedSil = mergeGeometries(silhouette, false);
      for (const g of silhouette) g.dispose();
      if (mergedSil) {
        const silMat = new THREE.MeshBasicMaterial({
          color: silCol,
          transparent: true,
          opacity: silOpacity,
          depthWrite: false,
        });
        const silMesh = new THREE.Mesh(mergedSil, silMat);
        silMesh.renderOrder = -4;
        subGroup.add(silMesh);
      }
    }

    // Waterline ripple collar (naval subs) or earthy dust collar (Dwarf Mole-Driller)
    if (species !== 'elf') {
      const rippleGeo = new THREE.RingGeometry(0.18, species === 'dwarf' ? 0.56 : 0.34, 16);
      rippleGeo.rotateX(-Math.PI / 2);
      rippleGeo.translate(0, 0.035, species === 'dwarf' ? 0.15 : 0.42);
      const rippleMat = new THREE.MeshBasicMaterial({
        color: species === 'dwarf' ? 0x785a3a : 0xe0f2fe,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
      rippleMesh.renderOrder = -3;
      subGroup.add(rippleMesh);
    }

    return subGroup;
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

      // 4 Articulated Hip-Pivoted Arachnid Spider Legs (animated in IsometricWorldCanvas during walking!)
      const legAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
      const hipR = 0.48;
      const kneeOut = (isOrbitalWalker ? 1.28 : 1.15) - hipR;
      const kneeLift = isOrbitalWalker ? 0.56 : 0.46;
      const footOut = (isOrbitalWalker ? 1.62 : 1.48) - hipR;
      const footDrop = -(bodyY - 0.10);

      // Build one canonical leg in local hip space (+X = radially outward) and share across all 4 pivots
      const legParts: THREE.BufferGeometry[] = [];
      const legGlowParts: THREE.BufferGeometry[] = [];
      // Hip socket
      pushCyl(legParts, 0.14, 0.14, 0.16, 8, 0, 0, 0, jointHex);
      // Upper femur angled UP and OUT to high spider knee
      pushStrut(legParts, 0, 0, 0, kneeOut, kneeLift, 0, 0.085, 0.11, legHex);
      // Armored knee joint hub
      pushCyl(legParts, 0.15, 0.15, 0.18, 8, kneeOut, kneeLift, 0, jointHex);
      if (isOrbitalWalker) {
        pushCyl(legGlowParts, 0.09, 0.09, 0.22, 6, kneeOut, kneeLift, 0, eyeGlow);
      }
      // Lower tibia angled DOWN and OUT to clawed footpad
      pushStrut(legParts, kneeOut, kneeLift, 0, footOut, footDrop, 0, 0.06, 0.095, legHex);
      // Armored arachnid footpad
      pushCyl(legParts, 0.12, 0.18, 0.12, 6, footOut, footDrop - 0.04, 0, jointHex);

      const mergedLegGeo = mergeGeometries(legParts, false);
      for (const g of legParts) g.dispose();
      const mergedLegGlowGeo = legGlowParts.length > 0 ? mergeGeometries(legGlowParts, false) : null;
      for (const g of legGlowParts) g.dispose();
      const legMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.42,
        metalness: 0.62,
      });
      const legGlowMat = mergedLegGlowGeo
        ? new THREE.MeshBasicMaterial({ vertexColors: true })
        : null;

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

      const walkerGroup = finalizeMultiFinishGroup(matte, metal, win, glow);
      if (mergedLegGeo) {
        for (let li = 0; li < legAngles.length; li++) {
          const ang = legAngles[li];
          const legPivot = new THREE.Group();
          legPivot.name = `spider_leg_${li}`;
          legPivot.position.set(Math.cos(ang) * hipR, bodyY, Math.sin(ang) * hipR);
          legPivot.rotation.order = 'YXZ';
          legPivot.rotation.y = -ang;
          legPivot.userData.baseYaw = -ang;
          legPivot.userData.legIndex = li;

          const legMesh = new THREE.Mesh(mergedLegGeo, legMat);
          legMesh.castShadow = true;
          legMesh.receiveShadow = true;
          legPivot.add(legMesh);

          if (mergedLegGlowGeo && legGlowMat) {
            legPivot.add(new THREE.Mesh(mergedLegGlowGeo, legGlowMat));
          }
          walkerGroup.add(legPivot);
        }
      }
      return walkerGroup;
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
  // 5. SKY SIEGE MACHINES (sky_carrier, Epoch 5+) — Mothership-grade Helicarrier & Sky Citadels!
  // =========================================================================
  if (type === 'sky_carrier') {
    if (species === 'elf') {
      // ELF: Grand Sylvan Aether-Citadel (sculpted ventral keel + swept wings + 4 astral lift-turbines)
      pushVentralKeel(matte, [[-4.8, -0.4], [5.2, -0.4], [2.6, -2.6], [-2.2, -2.1]], 0.48, 0xe8e2d0, 0.07);
      pushTaperedHull(matte, [[1.15, -6.1], [1.74, -3.4], [1.80, 3.0], [1.20, 5.5], [0.0, 6.8]], 0.90, 0.54, 0xf5f0e2, 0.09);
      pushTaperedHull(matte, [[1.58, -3.2], [4.25, -1.6], [4.25, 1.6], [1.58, 3.2]], 0.28, 0.24, 0xe8e2d0, 0.06);
      pushTaperedHull(deck, [[1.35, -5.7], [1.52, -3.2], [1.56, 2.8], [0.98, 5.0], [0.0, 6.2]], 0.12, 0.62, 0xf8f5eb, 0.02);
      pushBox(metal, 0.18, 0.04, 11.6, 0, 0.64, 0.15, 0xc8a441);
      pushBox(matte, 0.82, 1.55, 2.60, 1.32, 1.36, -1.25, 0xf8f5eb);
      pushBox(metal, 0.96, 0.20, 2.75, 1.32, 2.22, -1.25, 0xc8a441);
      pushCyl(metal, 0.10, 0.28, 1.85, 10, 1.32, 3.15, -1.25, 0xc8a441);
      pushCyl(glow, 0.24, 0.05, 0.95, 10, 1.32, 4.45, -1.25, 0xc084fc);
      addWindowStrip(win, 0.90, 1.68, -1.25, 5, 0.38, true, 0x7dd3fc);
      for (const [rx, rz] of [[-3.45, 2.25], [3.45, 2.25], [-3.45, -2.25], [3.45, -2.25]]) {
        addDuctedTurbine(matte, metal, glow, rx, 0.08, rz, 1.24, 0xc8a441, 0xf8f5eb, 0xc084fc);
        pushCyl(glow, 0.34, 0.54, 3.6, 12, rx, -1.75, rz, 0x7dd3fc);
      }
      for (const zf of [-4.0, -2.2, -0.4, 1.4, 3.2]) {
        addDeckAircraft(matte, metal, win, -0.62, 0.66, zf, 0xc8a441, 0xf8f5eb, false, 0.12);
      }
    } else if (species === 'orc') {
      // ORC: Scrap-Krumpa Sky-Hulk (glossy charcoal frame + bolted crimson armor + 4 flame-belching turbines)
      pushVentralKeel(dark, [[-4.4, -0.5], [4.6, -0.5], [3.4, -2.4], [-3.2, -1.8]], 0.56, 0x18181b, 0.06);
      pushTaperedHull(matte, [[1.45, -6.0], [1.96, -3.5], [2.02, 3.1], [1.50, 5.4], [0.74, 6.4]], 1.10, 0.60, 0x4b433e, 0.08);
      pushTaperedHull(deck, [[1.30, -5.6], [1.75, -3.3], [1.80, 2.9], [1.34, 5.1], [0.65, 5.9]], 0.12, 0.68, 0x262626, 0.02);
      pushBox(metal, 1.98, 0.22, 2.30, -0.25, 0.90, 5.35, 0x991b1b, -0.18, 0, 0);
      pushBox(dark, 1.00, 1.58, 2.85, 1.46, 1.40, -1.35, 0x262626);
      pushBox(matte, 0.86, 0.68, 1.90, 1.46, 2.48, -1.45, 0x991b1b);
      addWindowStrip(win, 0.94, 1.72, -1.35, 5, 0.42, true, 0xfbbf24);
      for (const [rx, rz] of [[-3.45, 2.65], [3.45, 2.65], [-3.45, -2.65], [3.45, -2.65]]) {
        addDuctedTurbine(matte, metal, glow, rx, 0.10, rz, 1.26, 0x18181b, 0x991b1b, 0xf97316);
        pushCyl(glow, 0.42, 0.64, 3.4, 12, rx, -1.65, rz, 0xf97316);
      }
      addNavalTurret(matte, metal, -1.84, 0.70, 3.55, 1.15, 0x991b1b, 0x18181b, -0.4);
      addNavalTurret(matte, metal, 1.68, 0.70, -4.35, 1.08, 0x991b1b, 0x18181b, 2.7);
      for (const zf of [-3.8, -2.0, -0.2, 1.6, 3.4]) {
        addDeckAircraft(matte, metal, win, -0.68, 0.72, zf, 0xb91c1c, 0x3f3a36, false, 0.15);
      }
    } else if (species === 'dwarf') {
      // DWARF: Ironclad Sky-Barge (sculpted armored ventral keel + brass-trimmed ironclad deck + magma turbines)
      pushVentralKeel(dark, [[-4.6, -0.5], [4.8, -0.5], [3.2, -2.6], [-2.8, -2.2]], 0.62, 0x181b20, 0.06);
      pushTaperedHull(matte, [[1.55, -5.9], [2.04, -3.3], [2.08, 3.2], [1.55, 5.4], [0.72, 6.3]], 1.18, 0.64, 0x475569, 0.08);
      pushTaperedHull(deck, [[1.38, -5.5], [1.82, -3.1], [1.86, 3.0], [1.38, 5.0], [0.62, 5.8]], 0.12, 0.72, 0x1f2937, 0.02);
      pushBox(metal, 4.18, 0.18, 9.6, 0, 0.68, -0.1, 0xb45309);
      pushBox(matte, 1.06, 1.54, 2.98, 1.48, 1.46, -1.25, 0x64748b);
      pushBox(dark, 1.14, 0.56, 2.15, 1.48, 2.38, -1.25, 0x181b20);
      pushBox(metal, 1.22, 0.18, 3.08, 1.48, 2.74, -1.25, 0xd97706);
      addWindowStrip(win, 0.90, 2.38, -1.25, 5, 0.36, true, 0xfbbf24);
      for (const [rx, rz] of [[-3.45, 2.55], [3.45, 2.55], [-3.45, -2.55], [3.45, -2.55]]) {
        addDuctedTurbine(matte, metal, glow, rx, 0.06, rz, 1.22, 0xb45309, 0x334155, 0xf59e0b);
        pushCyl(glow, 0.40, 0.60, 3.2, 12, rx, -1.55, rz, 0xfbbf24);
      }
      addNavalTurret(matte, metal, -1.86, 0.74, 3.55, 1.15, 0xb45309, 0x181b20, -0.35);
      addNavalTurret(matte, metal, 1.68, 0.74, -4.25, 1.08, 0xb45309, 0x181b20, 2.75);
      for (const zf of [-3.8, -2.0, -0.2, 1.6, 3.4]) {
        addDeckAircraft(matte, metal, win, -0.62, 0.76, zf, 0xd97706, 0x475569, false, 0.10);
      }
    } else if (species === 'lizardfolk') {
      // LIZARDFOLK: Floating Sun-Pyramid Sky-Temple (high-contrast obsidian & gold ziggurat + emerald obelisks)
      pushBox(dark, 7.4, 0.88, 7.4, 0, -0.15, 0, 0x111827);
      pushBox(metal, 7.6, 0.18, 7.6, 0, 0.34, 0, 0xca8a04);
      pushBox(deck, 5.5, 0.84, 5.5, 0, 0.80, 0, 0x1e293b);
      pushBox(metal, 5.7, 0.18, 5.7, 0, 1.26, 0, 0xd4af37);
      pushBox(dark, 3.6, 0.80, 3.6, 0, 1.70, 0, 0x111827);
      pushBox(metal, 3.8, 0.18, 3.8, 0, 2.14, 0, 0xd4af37);
      pushCyl(glow, 0.08, 0.96, 2.05, 4, 0, 3.32, 0, 0x34d399);
      pushCyl(glow, 0.98, 0.40, 1.95, 8, 0, -1.28, 0, 0xfacc15);
      for (const [ox, oz] of [[-4.3, 4.3], [4.3, 4.3], [-4.3, -4.3], [4.3, -4.3]]) {
        pushCyl(metal, 0.30, 0.44, 2.75, 4, ox, 0.55, oz, 0xca8a04);
        pushCyl(glow, 0.06, 0.28, 1.0, 4, ox, 2.30, oz, 0x34d399);
        pushCyl(glow, 0.28, 0.46, 3.0, 8, ox, -1.60, oz, 0x34d399);
      }
    } else {
      // HUMAN: Alien-Mothership-Grade Helicarrier (sculpted ventral keel blade, exposed flank truss ribs,
      // glossy dark structural hangars, clean charcoal flight deck, 4 giant lift-turbines + vertical light beams!)
      pushVentralKeel(matte, [[-4.2, -0.35], [5.4, -0.35], [3.6, -2.5], [0.8, -3.2], [-2.4, -2.0]], 0.52, 0x94a3b8, 0.08);
      pushTaperedHull(dark, [[1.05, -5.9], [1.42, -3.9], [1.46, 3.1], [1.05, 5.3], [0.58, 6.0]], 0.72, -0.30, 0x181b20, 0.05);
      pushTaperedHull(matte, [[1.34, -6.2], [1.70, -4.2], [1.74, 3.5], [1.34, 5.7], [0.90, 6.5]], 0.98, 0.58, 0x6b7280, 0.08);
      // Exposed Mothership-style side truss ribs, armored gunwale belts & recessed glowing hangars!
      for (const side of [-1, 1]) {
        pushBox(matte, 0.24, 0.24, 10.6, side * 1.78, 0.48, -0.2, 0x94a3b8);
        for (let ri = -4; ri <= 4; ri++) {
          pushBox(dark, 0.16, 0.86, 0.16, side * 1.76, 0.12, ri * 1.25, 0x262a33);
        }
        for (const hz of [-3.2, 0.2, 3.2]) {
          pushBox(dark, 0.22, 0.48, 1.65, side * 1.74, 0.16, hz, 0x111418);
          pushBox(win, 0.06, 0.14, 1.32, side * 1.82, 0.24, hz, 0xfbbf24);
        }
      }
      // Clean matte charcoal flight deck + angled landing deck + arrestor cables + blast deflectors + bow threshold!
      pushTaperedHull(deck, [[1.22, -5.9], [1.54, -4.0], [1.58, 3.4], [1.20, 5.5], [0.80, 6.3]], 0.14, 0.68, 0x181d24, 0.02);
      pushBox(deck, 1.22, 0.18, 7.2, -1.62, 0.56, -0.85, 0x181d24, 0, 0.13, 0);
      pushBox(deck, 0.10, 0.025, 11.2, -0.22, 0.71, 0.1, 0xf1f5f9);
      pushBox(deck, 0.09, 0.025, 6.6, -1.50, 0.67, -0.85, 0xf1f5f9, 0, 0.13, 0);
      pushBox(glow, 1.78, 0.04, 0.24, 0, 0.71, 6.18, 0xfbbf24); // glowing bow threshold strip
      for (let aw = 0; aw < 4; aw++) {
        pushBox(metal, 2.35, 0.025, 0.04, -0.2, 0.71, -5.0 + aw * 0.55, 0x94a3b8);
      }
      // 4 Swept Outrigger Wing-Struts + Huge Circular Ducted Lift-Turbines + Vertical Cyan-White Thruster Beams!
      for (const [rx, rz] of [[-3.65, 2.85], [3.65, 2.85], [-3.65, -2.85], [3.65, -2.85]]) {
        const sgn = rx > 0 ? 1 : -1;
        pushBox(matte, 2.15, 0.44, 1.75, sgn * 2.40, 0.18, rz, 0x6b7280);
        pushBox(dark, 2.10, 0.16, 1.82, sgn * 2.40, -0.08, rz, 0x181b20); // dark lower wing truss
        addDuctedTurbine(matte, metal, glow, rx, 0.10, rz, 1.38, 0x374151, 0x9ca3af, 0x7dd3fc);
        pushCyl(glow, 0.46, 0.74, 4.4, 14, rx, -2.15, rz, 0xe0f2fe);
        pushCyl(glow, 0.24, 0.44, 2.2, 12, rx, 1.30, rz, 0xbae6fd);
      }
      // High-Contrast 3-Tier Overhanging Command Citadel (light steel + glossy black bridge + radome + radar masts!)
      pushBox(matte, 0.86, 1.38, 2.80, 1.34, 1.36, -1.25, 0x6b7280);
      pushBox(dark, 1.48, 0.54, 1.85, 1.34, 2.24, -1.30, 0x181b20); // overhanging glossy charcoal bridge wings
      pushBox(matte, 1.32, 0.20, 1.65, 1.34, 2.60, -1.32, 0xc2c8d1); // light steel cap
      pushCyl(metal, 0.06, 0.11, 1.95, 10, 1.34, 3.68, -1.35, 0xe2e8f0);
      pushBox(metal, 1.22, 0.10, 0.08, 1.34, 4.18, -1.35, 0xe2e8f0);
      pushBox(glow, 0.14, 0.12, 0.14, 1.34, 4.68, -1.35, 0x60a5fa); // mast beacon
      pushCyl(deck, 0.26, 0.26, 0.28, 12, 1.34, 2.86, -0.82, 0xf8fafc); // crisp white radome
      addWindowStrip(win, 0.88, 1.68, -1.25, 5, 0.40, true, 0xfbbf24);
      addWindowStrip(win, 0.58, 2.26, -1.30, 4, 0.34, true, 0xfbbf24);
      // 4 Defense Turrets, Deck Crane, Cargo Containers & 6 Stealth Jets
      addNavalTurret(matte, metal, -1.90, 0.68, 3.85, 1.02, 0x94a3b8, 0x181b20, -0.3);
      addNavalTurret(matte, metal, 1.68, 0.68, -4.65, 1.02, 0x94a3b8, 0x181b20, 2.7);
      addNavalTurret(matte, metal, -1.90, 0.68, -4.55, 0.85, 0x94a3b8, 0x181b20, -2.6);
      pushCyl(metal, 0.05, 0.07, 1.35, 8, 1.42, 1.42, -3.25, 0x94a3b8, -0.55, 0, 0.15);
      pushBox(deck, 0.58, 0.36, 0.88, 0.90, 0.86, 1.65, 0x78716c);
      for (const [fx, fz] of [[-0.78, -4.2], [-0.72, -2.5], [-0.64, -0.8], [-0.56, 1.0], [-0.46, 2.8], [0.35, 4.2]]) {
        addDeckAircraft(matte, metal, win, fx, 0.71, fz, 0x94a3b8, 0xe2e8f0, false, 0.14);
      }
    }
    return finalizeMultiFinishGroup(matte, metal, win, glow, dark, deck);
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
