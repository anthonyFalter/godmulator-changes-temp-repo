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
  const uvScale = 0.52;
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
      map: getSiegeSurfaceTexture('weathered_armor'),
      roughness: 0.72,
      metalness: 0.22,
    }),
    true,
  );
  addMerged(
    metalParts,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: getSiegeSurfaceTexture('brushed_metal'),
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
  // 1. PRIMARY SIEGE MACHINES (aircraft_carrier slot, Epoch 3+)
  //    - Human:      Voxel WWII Wood-Deck Carrier (image.png) -> Nuclear Supercarrier (Sea)
  //    - Dwarf:      Runeforge Land-Dreadnought Mobile Fortress (Land)
  //    - Orc:        WAAAGH! Scrap-Juggernaut Jaw-Fortress (Land)
  //    - Elf:        Sylvan Aether-Carrier Levitating Sky-Citadel (Sky)
  //    - Lizardfolk: Amphibious Ziggurat-Leviathan (Hybrid Land + Sea)
  // =========================================================================
  if (type === 'aircraft_carrier') {
    const isPropEra = e <= 3;

    if (species === 'dwarf') {
      // DWARF: Runeforge Land-Dreadnought — sleek sloped-armor quad-tread mobile fortress (Land Siege Machine)
      for (const zOff of [-3.1, 2.2]) {
        for (const side of [-1, 1]) {
          pushBox(matte, 1.05, 0.95, 2.85, side * 2.15, 0.48, zOff, 0x1f2937);
          for (let wi = -1; wi <= 1; wi++) {
            pushCyl(metal, 0.34, 0.34, 1.12, 10, side * 2.15, 0.38, zOff + wi * 0.92, 0xb45309, 0, 0, Math.PI / 2);
          }
          pushBox(matte, 1.20, 0.22, 3.15, side * 2.15, 1.02, zOff, 0x475569); // armored track skirts
        }
      }
      // Tapered armored glacis hull + bronze ram prow + glowing magma furnace grates
      pushTaperedHull(matte, [[1.65, -4.8], [1.95, -3.2], [1.95, 3.4], [1.45, 4.9], [0.55, 5.4]], 1.25, 1.68, 0x334155, 0.08);
      pushBox(metal, 3.98, 0.16, 8.6, 0, 1.72, -0.2, 0xb45309); // riveted brass trim belt
      for (const side of [-1, 1]) {
        for (const fz of [-1.2, 0.0, 1.2]) {
          pushBox(matte, 0.16, 0.48, 0.85, side * 1.98, 1.12, fz, 0x1e293b);
          pushBox(glow, 0.08, 0.30, 0.62, side * 2.04, 1.12, fz, 0xf59e0b); // blast furnace vents
        }
      }
      // Tiered octagonal Runeforge Citadel Keep + twin tall industrial chimneys
      pushTaperedHull(matte, [[1.25, -3.2], [1.48, -1.8], [1.48, 1.2], [1.15, 2.2]], 1.15, 2.85, 0x475569, 0.06);
      pushBox(metal, 2.35, 0.18, 4.2, 0, 2.94, -0.6, 0xd97706);
      addWindowStrip(win, 0, 2.48, 2.24, 5, 0.34, false, 0xfbbf24);
      for (const side of [-1, 1]) {
        pushCyl(metal, 0.22, 0.28, 2.35, 10, side * 0.95, 3.85, -2.15, 0x1e293b, -0.1, 0, 0);
        pushCyl(metal, 0.26, 0.26, 0.18, 10, side * 0.95, 4.98, -2.28, 0xd97706);
      }
      // Twin heavy twin-barrel siege turrets (fore & aft) + flank sponsons
      addNavalTurret(matte, metal, 0, 1.72, 3.35, 1.45, 0x475569, 0x1e293b, 0);
      addNavalTurret(matte, metal, 0, 1.72, -3.75, 1.25, 0x475569, 0x1e293b, Math.PI);
      addNavalTurret(matte, metal, -1.75, 1.72, 0.5, 0.9, 0xb45309, 0x1e293b, -Math.PI / 2);
      addNavalTurret(matte, metal, 1.75, 1.72, 0.5, 0.9, 0xb45309, 0x1e293b, Math.PI / 2);
      if (e >= 5) pushCyl(glow, 0.32, 0.42, 0.72, 8, 0, 3.38, -0.5, 0xfbbf24);
    } else if (species === 'orc') {
      // ORC: WAAAGH! Scrap-Juggernaut — brutal sloped scrap-armor jaw-fortress on spiked treads (Land Siege Machine)
      for (const side of [-1, 1]) {
        pushBox(matte, 1.15, 1.05, 8.2, side * 2.1, 0.52, -0.2, 0x262626);
        for (let tz = -3.6; tz <= 3.6; tz += 1.2) {
          pushCyl(metal, 0.04, 0.16, 0.55, 5, side * 2.75, 0.52, tz, 0xa1a1aa, 0, 0, -side * Math.PI / 2);
        }
      }
      // Asymmetric welded scrap hull + crimson war-plates
      pushTaperedHull(matte, [[1.75, -4.6], [2.05, -2.5], [2.05, 3.2], [1.65, 4.4]], 1.45, 1.85, 0x3b3532, 0.08);
      pushBox(matte, 1.45, 0.95, 5.4, -1.25, 1.48, -0.4, 0x881b1b, 0, 0, 0.08);
      pushBox(matte, 1.35, 0.85, 4.8, 1.25, 1.52, 0.2, 0x5c2b22, 0, 0, -0.06);
      // Roaring furnace-jaw ram with iron tusks at the bow
      pushBox(matte, 3.4, 0.95, 1.4, 0, 0.95, 4.65, 0x18181b);
      pushBox(glow, 2.7, 0.55, 0.65, 0, 0.95, 5.15, 0xf97316);
      for (let tx = -1.35; tx <= 1.35; tx += 0.54) {
        pushCyl(metal, 0.03, 0.14, 0.88, 5, tx, 0.68, 5.52, 0xd4d4d8, Math.PI / 2 - 0.25, 0, 0);
        pushCyl(metal, 0.03, 0.12, 0.72, 5, tx, 1.38, 5.42, 0xd4d4d8, Math.PI / 2 + 0.22, 0, 0);
      }
      // Off-center Warboss Citadel + belching tilted exhaust pipes + crimson war-banner
      pushBox(matte, 2.25, 1.45, 3.6, 0.45, 2.55, -1.35, 0x4d4540);
      pushBox(matte, 1.65, 0.85, 2.2, 0.65, 3.65, -1.55, 0x991b1b);
      addWindowStrip(win, 0.65, 3.68, -0.42, 4, 0.30, false, 0xfbbf24);
      pushCyl(metal, 0.20, 0.26, 2.45, 8, -1.25, 3.25, -2.65, 0x262626, -0.18, 0, 0.15);
      pushCyl(metal, 0.18, 0.24, 2.15, 8, 1.55, 3.45, -2.35, 0x262626, -0.16, 0, -0.12);
      pushCyl(glow, 0.16, 0.16, 0.12, 8, -1.45, 4.45, -2.88, 0xf97316);
      // Heavy rotary dakka turret + crimson banner pole
      addNavalTurret(matte, metal, -0.75, 1.88, 2.15, 1.45, 0x881b1b, 0x18181b, -0.15);
      pushCyl(metal, 0.04, 0.06, 2.6, 6, 1.45, 4.5, -1.2, 0x78716c);
      pushBox(matte, 0.06, 0.95, 1.45, 1.45, 5.25, -1.95, 0xdc2626);
    } else if (species === 'elf') {
      // ELF: Sylvan Aether-Carrier — sleek sweeping ivory & gold levitating sky-citadel (Sky Siege Machine)
      pushTaperedHull(matte, [[0.85, -6.1], [1.55, -3.8], [1.65, 2.8], [1.05, 5.2], [0.0, 6.6]], 0.86, 0.56, 0xf5f0e2, 0.08);
      pushTaperedHull(matte, [[1.45, -2.4], [4.35, -0.9], [3.85, 0.7], [1.45, 2.1]], 0.26, 0.26, 0xe8e2d0, 0.05); // swept swan-wings
      pushBox(metal, 0.16, 0.04, 11.4, 0, 0.60, 0.2, 0xc8a441); // gilded runway spine
      pushBox(glow, 0.08, 0.04, 10.2, -0.95, 0.60, 0.15, 0x38bdf8);
      pushBox(glow, 0.08, 0.04, 10.2, 0.95, 0.60, 0.15, 0x38bdf8);
      // Twin ducted arcane lift-turbines with vertical light shafts
      for (const side of [-1, 1]) {
        addDuctedTurbine(matte, metal, glow, side * 3.15, 0.08, -0.25, 1.18, 0xc8a441, 0xf8f5eb, 0x38bdf8);
        pushCyl(glow, 0.32, 0.52, 2.8, 8, side * 3.15, -1.45, -0.25, 0x7dd3fc);
      }
      // Graceful starboard crystal spire bridge + parked star-gliders
      pushTaperedHull(matte, [[0.28, -2.6], [0.46, -1.2], [0.42, 0.4], [0.16, 1.1]], 1.35, 1.92, 0xf8f5eb, 0.05);
      pushCyl(metal, 0.08, 0.26, 1.85, 8, 1.18, 2.55, -1.25, 0xc8a441);
      pushCyl(glow, 0.18, 0.04, 0.85, 8, 1.18, 3.85, -1.25, 0xc084fc);
      addWindowStrip(win, 0.72, 1.48, -1.15, 5, 0.36, true, 0x7dd3fc);
      for (const zf of [-4.0, -2.2, -0.4, 1.4, 3.2]) {
        addDeckAircraft(matte, metal, win, -0.58, 0.62, zf, 0xc8a441, 0xf8f5eb, false, 0.12);
      }
    } else if (species === 'lizardfolk') {
      // LIZARDFOLK: Amphibious Ziggurat-Leviathan — hybrid land + sea obsidian & gold temple-crawler!
      for (const side of [-1, 1]) {
        // Armored amphibious pontoon-treads with glowing jade hydro-ribs
        pushTaperedHull(matte, [[0.35, -5.2], [0.65, -3.8], [0.68, 3.8], [0.35, 5.2], [0.0, 5.7]], 0.82, 0.82, 0x1e293b, 0.05);
        pushBox(matte, 0.92, 0.78, 9.8, side * 2.15, 0.42, 0, 0x1e293b);
        pushBox(metal, 0.98, 0.16, 9.4, side * 2.15, 0.84, 0, 0xca8a04);
        pushBox(glow, 0.12, 0.18, 8.6, side * 2.62, 0.46, 0, 0x34d399);
      }
      pushTaperedHull(matte, [[1.75, -5.0], [2.05, -3.2], [2.05, 3.2], [1.45, 5.0], [0.0, 5.8]], 1.05, 1.18, 0x0f172a, 0.07);
      // 3-Tiered crisp stepped golden-obsidian ziggurat sanctuary deck
      pushBox(matte, 3.4, 0.62, 6.8, 0, 1.48, -0.4, 0x1e293b);
      pushBox(metal, 3.55, 0.14, 7.0, 0, 1.82, -0.4, 0xca8a04);
      pushBox(matte, 2.45, 0.62, 4.8, 0, 2.18, -0.5, 0x1e293b);
      pushBox(metal, 2.6, 0.14, 5.0, 0, 2.52, -0.5, 0xd4af37);
      pushBox(matte, 1.5, 0.56, 2.8, 0, 2.86, -0.6, 0x1e293b);
      pushCyl(glow, 0.08, 0.55, 1.55, 4, 0, 3.85, -0.6, 0x34d399); // blazing emerald sun-obelisk
      // Twin forward solar-lance cannons + 4 corner emerald temple braziers
      for (const side of [-1, 1]) {
        pushCyl(metal, 0.10, 0.14, 2.65, 6, side * 0.95, 1.38, 4.25, 0xd4af37, Math.PI / 2, 0, 0);
        pushCyl(glow, 0.08, 0.08, 0.35, 6, side * 0.95, 1.38, 5.62, 0x34d399, Math.PI / 2, 0, 0);
        for (const bz of [-3.6, 2.8]) {
          pushCyl(glow, 0.14, 0.20, 0.52, 6, side * 1.62, 2.08, bz, 0x34d399);
        }
      }
    } else {
      // HUMAN: Sleek, Realistic Textured Fleet Aircraft Carrier (13.2 tiles long, ~5.6:1 naval ratio!)
      // Epoch 3 (Industrial): Warm weathered cream wood deck + crimson bow insignia (image.png) + steel girders!
      // Epoch 4+ (Atomic/Info): Dark angled-deck nuclear supercarrier with delta jets, radar island & elevators!
      const hullHex = isPropEra ? 0x9aa7b4 : e >= 5 ? 0x475569 : 0x64748b;
      const deckHex = isPropEra ? 0xe6cfa8 : e >= 5 ? 0x262f3b : 0x334155;
      // Dark maroon anti-fouling lower hull waterline belt
      pushTaperedHull(matte, [
        [0.90, -6.2], [1.18, -4.5], [1.24, 2.9], [0.90, 5.2], [0.38, 6.4], [0.0, 6.8],
      ], 0.32, 0.30, 0x6b212a, 0.03);
      // Weathered steel flared hull rising smoothly to the hangar deck
      pushTaperedHull(matte, [
        [0.96, -6.1], [1.24, -4.4], [1.30, 2.9], [0.96, 5.2], [0.42, 6.3], [0.0, 6.7],
      ], 0.72, 1.00, hullHex, 0.05);
      // Under-deck steel girder pillars supporting the cantilevered bow & stern flight deck
      for (const side of [-1, 1]) {
        for (const gz of [-5.5, -4.8, 5.1, 5.8]) {
          pushCyl(metal, 0.055, 0.065, 0.65, 6, side * 0.68, 0.85, gz, 0x475569);
        }
        // Recessed glowing hangar bay openings + deck-edge elevators
        for (const hz of [-2.5, 0.9]) {
          pushBox(matte, 0.14, 0.36, 1.65, side * 1.28, 0.66, hz, 0x111827);
          pushBox(win, 0.06, 0.12, 1.35, side * 1.31, 0.76, hz, 0xfbbf24);
        }
      }
      // Long cantilevered flight deck (12.8 tiles long) with two-tone weathered aft/fore deck on Industrial era
      pushTaperedHull(matte, [
        [1.26, -6.0], [1.48, -4.3], [1.50, 3.7], [1.18, 5.8], [0.86, 6.3],
      ], 0.18, 1.18, deckHex, 0.03);
      if (isPropEra) {
        // Darker weathered aft landing deck + bold crimson bow star insignia (matching image.png!)
        pushBox(matte, 2.75, 0.02, 5.8, 0, 1.195, -2.9, 0xcbb287);
        pushBox(matte, 0.62, 0.025, 0.62, 0, 1.20, 4.45, 0xb91c1c, 0, Math.PI / 4, 0);
        pushBox(matte, 0.62, 0.025, 0.62, 0, 1.20, 4.45, 0xb91c1c);
      } else {
        // Port angled landing deck sponson + crisp white & amber catapult markings
        pushBox(matte, 1.02, 0.16, 6.8, -1.46, 1.10, -0.85, deckHex, 0, 0.13, 0);
        pushBox(matte, 0.09, 0.025, 6.4, -1.32, 1.20, -0.85, 0xf1f5f9, 0, 0.13, 0);
        pushBox(matte, 0.09, 0.025, 11.4, -0.18, 1.20, 0.15, 0xf1f5f9);
        pushBox(matte, 0.06, 0.025, 10.0, 0.38, 1.20, 0.35, 0xfbbf24);
        if (e >= 6) pushBox(glow, 0.08, 0.03, 10.6, -0.18, 1.21, 0.15, 0x60a5fa);
      }
      // Deck-edge aircraft elevators
      pushBox(metal, 0.42, 0.12, 1.35, -1.58, 1.14, -0.6, 0x475569);
      pushBox(metal, 0.42, 0.12, 1.35, 1.58, 1.14, 2.1, 0x475569);
      // Detailed starboard command island, overhanging bridge wings, funnel & radar mast
      pushBox(matte, 0.66, 1.28, 2.65, 1.12, 1.84, -1.15, hullHex);
      pushBox(matte, 0.88, 0.48, 1.55, 1.12, 2.68, -1.25, 0x94a3b8);
      if (isPropEra) {
        pushCyl(metal, 0.22, 0.26, 1.55, 10, 1.12, 2.82, -0.35, 0x334155, -0.12, 0, 0);
        pushCyl(metal, 0.04, 0.08, 1.85, 6, 1.12, 3.55, -1.55, 0xcbd5e1);
        pushBox(metal, 0.72, 0.08, 0.06, 1.12, 4.05, -1.55, 0xe2e8f0);
      } else {
        pushCyl(metal, 0.06, 0.11, 1.75, 8, 1.12, 3.68, -1.25, 0xcbd5e1);
        pushBox(metal, 1.05, 0.12, 0.09, 1.12, 4.18, -1.25, 0xe2e8f0);
        pushCyl(matte, 0.22, 0.22, 0.26, 8, 1.12, 3.05, -0.75, 0xf8fafc); // white radome
      }
      addWindowStrip(win, 0.78, 2.18, -1.15, 5, 0.36, true, 0xfbbf24);
      addWindowStrip(win, 1.12, 2.72, -0.45, 3, 0.16, false, 0xfbbf24);
      // Flank AA defense turrets & parked aircraft in rows
      addNavalTurret(matte, metal, -1.52, 1.18, 3.85, 0.72, 0x64748b, 0x1e293b, -0.3);
      addNavalTurret(matte, metal, 1.44, 1.18, -4.65, 0.72, 0x64748b, 0x1e293b, 2.8);
      addNavalTurret(matte, metal, -1.52, 1.18, -4.45, 0.65, 0x64748b, 0x1e293b, -2.6);
      for (const [fx, fz] of [[-0.68, -4.6], [-0.62, -2.8], [-0.56, -1.0], [-0.48, 0.8], [-0.36, 2.6], [0.34, 4.0]]) {
        addDeckAircraft(matte, metal, win, fx, 1.21, fz, 0x94a3b8, 0xe2e8f0, isPropEra, 0.14);
      }
    }

    return finalizeMultiFinishGroup(matte, metal, win, glow);
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
  // 5. SKY SIEGE MACHINES (sky_carrier, Epoch 5+) — Sleek sculpted Helicarrier & Sky Citadels!
  // =========================================================================
  if (type === 'sky_carrier') {
    if (species === 'elf') {
      // ELF: Grand Sylvan Aether-Citadel (sweeping ivory & gold sky-carrier with 4 glowing astral lift-turbines)
      pushTaperedHull(matte, [[1.15, -6.0], [1.72, -3.4], [1.78, 3.0], [1.20, 5.4], [0.0, 6.6]], 0.88, 0.54, 0xf5f0e2, 0.08);
      pushTaperedHull(matte, [[1.58, -3.2], [4.15, -1.6], [4.15, 1.6], [1.58, 3.2]], 0.28, 0.24, 0xe8e2d0, 0.05);
      pushBox(metal, 0.16, 0.04, 11.4, 0, 0.58, 0.15, 0xc8a441);
      pushBox(matte, 0.80, 1.55, 2.55, 1.32, 1.32, -1.25, 0xf8f5eb);
      pushCyl(metal, 0.10, 0.28, 1.75, 8, 1.32, 2.82, -1.25, 0xc8a441);
      pushCyl(glow, 0.22, 0.05, 0.85, 8, 1.32, 3.95, -1.25, 0xc084fc);
      addWindowStrip(win, 0.90, 1.65, -1.25, 5, 0.38, true, 0x7dd3fc);
      for (const [rx, rz] of [[-3.35, 2.25], [3.35, 2.25], [-3.35, -2.25], [3.35, -2.25]]) {
        addDuctedTurbine(matte, metal, glow, rx, 0.08, rz, 1.18, 0xc8a441, 0xf8f5eb, 0xc084fc);
        pushCyl(glow, 0.32, 0.52, 3.4, 8, rx, -1.65, rz, 0x7dd3fc);
      }
      for (const zf of [-4.0, -2.2, -0.4, 1.4, 3.2]) {
        addDeckAircraft(matte, metal, win, -0.62, 0.58, zf, 0xc8a441, 0xf8f5eb, false, 0.12);
      }
    } else if (species === 'orc') {
      // ORC: Scrap-Krumpa Sky-Hulk (bolted ironclad flying dreadnought with flame-belching turbines & ski-jump prow)
      pushTaperedHull(matte, [[1.45, -5.9], [1.95, -3.5], [2.00, 3.1], [1.50, 5.4], [0.74, 6.3]], 1.08, 0.60, 0x3b3532, 0.07);
      pushBox(metal, 1.95, 0.20, 2.25, -0.25, 0.86, 5.3, 0x991b1b, -0.18, 0, 0);
      pushBox(matte, 0.96, 1.56, 2.80, 1.46, 1.36, -1.35, 0x5c2b22);
      pushBox(matte, 0.82, 0.65, 1.85, 1.46, 2.42, -1.45, 0x991b1b);
      addWindowStrip(win, 0.96, 1.68, -1.35, 5, 0.42, true, 0xfbbf24);
      for (const [rx, rz] of [[-3.35, 2.65], [3.35, 2.65], [-3.35, -2.65], [3.35, -2.65]]) {
        addDuctedTurbine(matte, metal, glow, rx, 0.10, rz, 1.22, 0x262626, 0x991b1b, 0xf97316);
        pushCyl(glow, 0.40, 0.62, 3.2, 8, rx, -1.55, rz, 0xf97316);
      }
      addNavalTurret(matte, metal, -1.82, 0.62, 3.55, 1.12, 0x991b1b, 0x18181b, -0.4);
      addNavalTurret(matte, metal, 1.65, 0.62, -4.35, 1.05, 0x991b1b, 0x18181b, 2.7);
      for (const zf of [-3.8, -2.0, -0.2, 1.6, 3.4]) {
        addDeckAircraft(matte, metal, win, -0.68, 0.63, zf, 0xb91c1c, 0x3f3a36, false, 0.15);
      }
    } else if (species === 'dwarf') {
      // DWARF: Ironclad Sky-Barge (heavy brass-ribbed armored fortress dirigible with magma turbines)
      pushTaperedHull(matte, [[1.55, -5.8], [2.02, -3.3], [2.06, 3.2], [1.55, 5.3], [0.72, 6.2]], 1.15, 0.64, 0x334155, 0.07);
      pushBox(metal, 4.12, 0.16, 9.6, 0, 0.66, -0.1, 0xb45309);
      pushBox(matte, 1.04, 1.52, 2.95, 1.48, 1.42, -1.25, 0x475569);
      pushBox(metal, 1.12, 0.18, 3.05, 1.48, 2.24, -1.25, 0xd97706);
      addWindowStrip(win, 0.94, 1.68, -1.25, 5, 0.44, true, 0xfbbf24);
      for (const [rx, rz] of [[-3.35, 2.55], [3.35, 2.55], [-3.35, -2.55], [3.35, -2.55]]) {
        addDuctedTurbine(matte, metal, glow, rx, 0.06, rz, 1.18, 0xb45309, 0x334155, 0xf59e0b);
        pushCyl(glow, 0.38, 0.58, 3.0, 8, rx, -1.5, rz, 0xfbbf24);
      }
      addNavalTurret(matte, metal, -1.84, 0.66, 3.55, 1.12, 0xb45309, 0x1e293b, -0.35);
      addNavalTurret(matte, metal, 1.65, 0.66, -4.25, 1.05, 0xb45309, 0x1e293b, 2.75);
      for (const zf of [-3.8, -2.0, -0.2, 1.6, 3.4]) {
        addDeckAircraft(matte, metal, win, -0.62, 0.68, zf, 0xd97706, 0x475569, false, 0.10);
      }
    } else if (species === 'lizardfolk') {
      // LIZARDFOLK: Floating Sun-Pyramid Sky-Temple (stepped obsidian-gold levitating ziggurat + 4 corner obelisks)
      pushBox(matte, 7.2, 0.85, 7.2, 0, -0.15, 0, 0x1e293b);
      pushBox(metal, 7.4, 0.16, 7.4, 0, 0.32, 0, 0xca8a04);
      pushBox(matte, 5.4, 0.82, 5.4, 0, 0.78, 0, 0x1e293b);
      pushBox(metal, 5.6, 0.16, 5.6, 0, 1.24, 0, 0xd4af37);
      pushBox(matte, 3.5, 0.78, 3.5, 0, 1.68, 0, 0x1e293b);
      pushBox(metal, 3.7, 0.16, 3.7, 0, 2.12, 0, 0xd4af37);
      pushCyl(glow, 0.08, 0.92, 1.95, 4, 0, 3.25, 0, 0x34d399);
      pushCyl(glow, 0.95, 0.38, 1.85, 6, 0, -1.25, 0, 0xfacc15);
      for (const [ox, oz] of [[-4.2, 4.2], [4.2, 4.2], [-4.2, -4.2], [4.2, -4.2]]) {
        pushCyl(metal, 0.28, 0.42, 2.65, 4, ox, 0.55, oz, 0xca8a04);
        pushCyl(glow, 0.06, 0.26, 0.95, 4, ox, 2.25, oz, 0x34d399);
        pushCyl(glow, 0.26, 0.44, 2.8, 6, ox, -1.55, oz, 0x34d399);
      }
    } else {
      // HUMAN: Sleek Sculpted Textured Helicarrier (matching image_2.png silhouette & details without blocky cubes!)
      // Deep tapered lower armored keel + main weathered steel hull + recessed glowing hangar bays
      pushTaperedHull(matte, [[0.95, -5.8], [1.35, -3.8], [1.40, 3.0], [1.00, 5.2], [0.55, 5.9]], 0.72, -0.35, 0x334155, 0.05);
      pushTaperedHull(matte, [[1.32, -6.1], [1.68, -4.1], [1.72, 3.4], [1.32, 5.6], [0.88, 6.4]], 0.96, 0.58, 0x64748b, 0.07);
      for (const side of [-1, 1]) {
        for (const hz of [-3.2, 0.2, 3.2]) {
          pushBox(matte, 0.14, 0.42, 1.55, side * 1.72, 0.18, hz, 0x111827);
          pushBox(win, 0.06, 0.14, 1.25, side * 1.75, 0.24, hz, 0xfbbf24);
        }
      }
      // Dark charcoal flight deck + port angled landing deck + crisp white runway markings + glowing bow threshold
      pushTaperedHull(matte, [[1.20, -5.8], [1.52, -3.9], [1.56, 3.3], [1.18, 5.4], [0.78, 6.2]], 0.14, 0.66, 0x1f2630, 0.02);
      pushBox(matte, 1.18, 0.18, 7.0, -1.60, 0.54, -0.85, 0x1f2630, 0, 0.13, 0);
      pushBox(matte, 0.10, 0.025, 11.0, -0.22, 0.69, 0.1, 0xf1f5f9);
      pushBox(matte, 0.09, 0.025, 6.4, -1.48, 0.65, -0.85, 0xf1f5f9, 0, 0.13, 0);
      pushBox(glow, 1.72, 0.04, 0.22, 0, 0.69, 6.08, 0xfbbf24); // bow launch threshold lights (image_2.png!)
      // 4 Swept Outrigger Wing-Struts + Huge Circular Ducted Lift-Turbines + Vertical Cyan-White Thruster Beams!
      for (const [rx, rz] of [[-3.55, 2.75], [3.55, 2.75], [-3.55, -2.75], [3.55, -2.75]]) {
        const sgn = rx > 0 ? 1 : -1;
        pushBox(matte, 2.05, 0.42, 1.65, sgn * 2.35, 0.18, rz, 0x64748b);
        addDuctedTurbine(matte, metal, glow, rx, 0.10, rz, 1.32, 0x475569, 0x94a3b8, 0x7dd3fc);
        pushCyl(glow, 0.44, 0.72, 4.2, 10, rx, -2.05, rz, 0xe0f2fe); // bright lower thruster shaft
        pushCyl(glow, 0.22, 0.42, 2.1, 8, rx, 1.25, rz, 0xbae6fd); // upper intake glow column
      }
      // Towering 3-tier overhanging command bridge + radar domes & twin antenna masts (image_2.png!)
      pushBox(matte, 0.84, 1.38, 2.75, 1.32, 1.34, -1.25, 0x64748b);
      pushBox(matte, 1.38, 0.48, 1.75, 1.32, 2.22, -1.30, 0x94a3b8); // overhanging bridge wings
      pushBox(matte, 0.72, 0.42, 1.25, 1.32, 2.66, -1.35, 0x475569);
      pushCyl(metal, 0.06, 0.11, 1.85, 8, 1.32, 3.65, -1.35, 0xe2e8f0);
      pushBox(metal, 1.15, 0.10, 0.08, 1.32, 4.12, -1.35, 0xe2e8f0);
      pushCyl(matte, 0.24, 0.24, 0.26, 8, 1.32, 3.02, -0.85, 0xf8fafc); // white radome
      addWindowStrip(win, 0.90, 1.66, -1.25, 5, 0.40, true, 0xfbbf24);
      addWindowStrip(win, 0.62, 2.24, -1.30, 4, 0.34, true, 0xfbbf24);
      // Deck defense turrets, cargo crates & parked stealth jets
      addNavalTurret(matte, metal, -1.86, 0.66, 3.75, 1.02, 0x64748b, 0x181b20, -0.3);
      addNavalTurret(matte, metal, 1.65, 0.66, -4.55, 1.02, 0x64748b, 0x181b20, 2.7);
      pushBox(matte, 0.55, 0.34, 0.85, 0.88, 0.84, 1.65, 0x78716c);
      for (const [fx, fz] of [[-0.78, -4.2], [-0.72, -2.5], [-0.64, -0.8], [-0.56, 1.0], [-0.46, 2.8], [0.35, 4.2]]) {
        addDeckAircraft(matte, metal, win, fx, 0.69, fz, 0x94a3b8, 0xe2e8f0, false, 0.14);
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
