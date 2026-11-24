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

type VoxelFinish = 'matte' | 'metal' | 'win' | 'glow';

/**
 * Fast face-culled micro-voxel builder for Siege Machines.
 * Culls all interior shared faces between touching voxels and applies subtle deterministic
 * per-voxel weathering/brightness jitter so ships have crisp pixel/voxel detail (zero flat plastic,
 * zero tiled grid textures, and <= 4 draw calls per mega-structure).
 */
class VoxelShipBuilder {
  private voxels = new Map<number, { r: number; g: number; b: number; finish: VoxelFinish }>();
  private readonly vs: number;
  private readonly offsetY: number;

  constructor(voxelSize = 0.25, offsetY = 0) {
    this.vs = voxelSize;
    this.offsetY = offsetY;
  }

  private static key(x: number, y: number, z: number): number {
    return ((x + 128) << 16) | ((y + 128) << 8) | (z + 128);
  }

  private static hash(x: number, y: number, z: number): number {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  set(ix: number, iy: number, iz: number, hex: number, finish: VoxelFinish = 'matte', jitter = 0.065): void {
    const x = Math.round(ix);
    const y = Math.round(iy);
    const z = Math.round(iz);
    if (x < -127 || x > 127 || y < -127 || y > 127 || z < -127 || z > 127) return;
    let r = ((hex >> 16) & 255) / 255;
    let g = ((hex >> 8) & 255) / 255;
    let b = (hex & 255) / 255;
    if (jitter > 0) {
      const n = (VoxelShipBuilder.hash(x, y, z) - 0.5) * 2 * jitter;
      r = Math.max(0, Math.min(1, r + n));
      g = Math.max(0, Math.min(1, g + n));
      b = Math.max(0, Math.min(1, b + n));
    }
    this.voxels.set(VoxelShipBuilder.key(x, y, z), { r, g, b, finish });
  }

  clear(ix: number, iy: number, iz: number): void {
    this.voxels.delete(VoxelShipBuilder.key(Math.round(ix), Math.round(iy), Math.round(iz)));
  }

  box(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    hex: number,
    finish: VoxelFinish = 'matte',
    jitter = 0.065,
  ): void {
    const minX = Math.round(Math.min(x0, x1));
    const maxX = Math.round(Math.max(x0, x1));
    const minY = Math.round(Math.min(y0, y1));
    const maxY = Math.round(Math.max(y0, y1));
    const minZ = Math.round(Math.min(z0, z1));
    const maxZ = Math.round(Math.max(z0, z1));
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          this.set(x, y, z, hex, finish, jitter);
        }
      }
    }
  }

  symBox(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    hex: number,
    finish: VoxelFinish = 'matte',
    jitter = 0.065,
  ): void {
    this.box(x0, y0, z0, x1, y1, z1, hex, finish, jitter);
    this.box(-x1, y0, z0, -x0, y1, z1, hex, finish, jitter);
  }

  /** Stamp a tiny crisp voxel aircraft parked on a flight deck */
  parkedAircraft(cx: number, y: number, cz: number, bodyHex: number, wingHex: number, isJet = true): void {
    // Fuselage
    this.box(cx, y, cz - 1, cx, y, cz + 2, bodyHex, 'metal', 0.04);
    if (isJet) {
      // Swept delta wings
      this.set(cx - 1, y, cz, wingHex, 'matte', 0.04);
      this.set(cx + 1, y, cz, wingHex, 'matte', 0.04);
      this.set(cx - 2, y, cz - 1, wingHex, 'matte', 0.04);
      this.set(cx + 2, y, cz - 1, wingHex, 'matte', 0.04);
      this.set(cx - 1, y, cz - 1, wingHex, 'matte', 0.04);
      this.set(cx + 1, y, cz - 1, wingHex, 'matte', 0.04);
      this.set(cx, y + 1, cz - 1, bodyHex, 'metal', 0.03); // tail fin
    } else {
      // Straight WWII wings + tiny tail
      this.box(cx - 2, y, cz + 1, cx + 2, y, cz + 1, wingHex, 'matte', 0.04);
      this.set(cx - 1, y, cz - 1, wingHex, 'matte', 0.04);
      this.set(cx + 1, y, cz - 1, wingHex, 'matte', 0.04);
    }
    this.set(cx, y + 1, cz + 1, 0x38bdf8, 'win', 0); // cockpit canopy
  }

  emit(
    matte: THREE.BufferGeometry[],
    metal: THREE.BufferGeometry[],
    win: THREE.BufferGeometry[],
    glow: THREE.BufferGeometry[],
  ): void {
    const buckets: Record<VoxelFinish, { pos: number[]; norm: number[]; uv: number[]; col: number[] }> = {
      matte: { pos: [], norm: [], uv: [], col: [] },
      metal: { pos: [], norm: [], uv: [], col: [] },
      win: { pos: [], norm: [], uv: [], col: [] },
      glow: { pos: [], norm: [], uv: [], col: [] },
    };

    const vs = this.vs;
    const oy = this.offsetY;
    const uvScale = 0.52;

    const hasVox = (x: number, y: number, z: number) => this.voxels.has(VoxelShipBuilder.key(x, y, z));

    // 6 cardinal faces with outward CCW winding
    const faces: Array<{
      dx: number;
      dy: number;
      dz: number;
      nx: number;
      ny: number;
      nz: number;
      corners: [number, number, number][];
      shade: number;
    }> = [
      { dx: 1, dy: 0, dz: 0, nx: 1, ny: 0, nz: 0, corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.92 },
      { dx: -1, dy: 0, dz: 0, nx: -1, ny: 0, nz: 0, corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.86 },
      { dx: 0, dy: 1, dz: 0, nx: 0, ny: 1, nz: 0, corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
      { dx: 0, dy: -1, dz: 0, nx: 0, ny: -1, nz: 0, corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.72 },
      { dx: 0, dy: 0, dz: 1, nx: 0, ny: 0, nz: 1, corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.95 },
      { dx: 0, dy: 0, dz: -1, nx: 0, ny: 0, nz: -1, corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.84 },
    ];

    const aoLevels = [1.0, 0.87, 0.76, 0.66];

    for (const [k, v] of this.voxels.entries()) {
      const x = ((k >>> 16) & 255) - 128;
      const y = ((k >>> 8) & 255) - 128;
      const z = (k & 255) - 128;
      const b = buckets[v.finish];
      const wx = (x - 0.5) * vs;
      const wy = y * vs + oy;
      const wz = (z - 0.5) * vs;
      const isEmissive = v.finish === 'glow' || v.finish === 'win';

      for (let fi = 0; fi < 6; fi++) {
        const f = faces[fi];
        const nx = x + f.dx;
        const ny = y + f.dy;
        const nz = z + f.dz;
        if (hasVox(nx, ny, nz)) continue;
        const c = f.corners;
        const baseShade = isEmissive ? 1.0 : f.shade;

        // Compute per-corner voxel Ambient Occlusion (Minecraft-style crease darkening!)
        const cornerAo: [number, number, number, number] = [1, 1, 1, 1];
        if (!isEmissive) {
          for (let ci = 0; ci < 4; ci++) {
            const pt = c[ci];
            const sx = pt[0] === 0 ? -1 : 1;
            const sy = pt[1] === 0 ? -1 : 1;
            const sz = pt[2] === 0 ? -1 : 1;
            let occ = 0;
            if (f.dy !== 0) {
              const s1 = hasVox(nx + sx, ny, nz) ? 1 : 0;
              const s2 = hasVox(nx, ny, nz + sz) ? 1 : 0;
              const cr = s1 && s2 ? 1 : hasVox(nx + sx, ny, nz + sz) ? 1 : 0;
              occ = s1 + s2 + cr;
            } else if (f.dx !== 0) {
              const s1 = hasVox(nx, ny + sy, nz) ? 1 : 0;
              const s2 = hasVox(nx, ny, nz + sz) ? 1 : 0;
              const cr = s1 && s2 ? 1 : hasVox(nx, ny + sy, nz + sz) ? 1 : 0;
              occ = s1 + s2 + cr;
            } else {
              const s1 = hasVox(nx + sx, ny, nz) ? 1 : 0;
              const s2 = hasVox(nx, ny + sy, nz) ? 1 : 0;
              const cr = s1 && s2 ? 1 : hasVox(nx + sx, ny + sy, nz) ? 1 : 0;
              occ = s1 + s2 + cr;
            }
            cornerAo[ci] = aoLevels[occ];
          }
        }

        // Flip quad diagonal when AO anisotropy requires it for smooth crease shading
        const idx = cornerAo[0] + cornerAo[2] > cornerAo[1] + cornerAo[3] ? [0, 1, 2, 0, 2, 3] : [1, 2, 3, 1, 3, 0];
        for (let ti = 0; ti < 6; ti++) {
          const ci = idx[ti];
          const pt = c[ci];
          const vx = wx + pt[0] * vs;
          const vy = wy + pt[1] * vs;
          const vz = wz + pt[2] * vs;
          b.pos.push(vx, vy, vz);
          b.norm.push(f.nx, f.ny, f.nz);
          if (f.dy !== 0) {
            b.uv.push(vx * uvScale, vz * uvScale);
          } else if (f.dx !== 0) {
            b.uv.push(vz * uvScale, vy * uvScale);
          } else {
            b.uv.push(vx * uvScale, vy * uvScale);
          }
          const sh = baseShade * cornerAo[ci];
          b.col.push(v.r * sh, v.g * sh, v.b * sh);
        }
      }
    }

    const pushBucket = (
      target: THREE.BufferGeometry[],
      data: { pos: number[]; norm: number[]; uv: number[]; col: number[] },
    ) => {
      if (data.pos.length === 0) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(data.norm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(data.col, 3));
      target.push(g);
    };

    pushBucket(matte, buckets.matte);
    pushBucket(metal, buckets.metal);
    pushBucket(win, buckets.win);
    pushBucket(glow, buckets.glow);
  }
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
      // DWARF: Colossal Runeforge Land-Dreadnought (micro-voxel armored fortress on quad-treads!)
      const v = new VoxelShipBuilder(0.26, 0.02);
      for (const zOff of [-13, 8]) {
        v.symBox(6, 0, zOff - 5, 10, 3, zOff + 5, 0x1f2937, 'matte', 0.06);
        v.symBox(7, 1, zOff - 4, 10, 2, zOff + 4, 0xb45309, 'metal', 0.05);
        v.symBox(6, 4, zOff - 6, 10, 4, zOff + 6, 0x475569, 'matte', 0.06);
      }
      v.box(-6, 2, -18, 6, 6, 17, 0x334155, 'matte', 0.07);
      v.box(-5, 2, 18, 5, 5, 20, 0x475569, 'matte', 0.06);
      v.symBox(6, 3, -4, 7, 5, 4, 0x1e293b, 'matte', 0.04);
      for (let fz = -3; fz <= 3; fz += 2) {
        v.symBox(7, 3, fz, 7, 4, fz, 0xf59e0b, 'glow', 0);
      }
      v.box(-7, 7, -17, 7, 7, 16, 0xb45309, 'metal', 0.05);
      v.box(-6, 8, -15, 6, 9, 13, 0x475569, 'matte', 0.07);
      v.box(-5, 10, -11, 5, 13, 3, 0x334155, 'matte', 0.07);
      v.box(-4, 14, -9, 4, 15, 1, 0xb45309, 'metal', 0.05);
      for (let wx = -3; wx <= 3; wx += 2) v.set(wx, 12, 4, 0xfbbf24, 'win', 0);
      v.symBox(3, 14, -10, 4, 21, -8, 0x1e293b, 'metal', 0.05);
      v.symBox(3, 21, -10, 4, 21, -8, 0xd97706, 'metal', 0.04);
      if (e >= 5) v.box(-1, 16, -5, 1, 18, -3, 0xfbbf24, 'glow', 0);
      v.box(-3, 10, 6, 3, 12, 11, 0x64748b, 'metal', 0.05);
      v.symBox(1, 11, 12, 2, 11, 19, 0x1e293b, 'metal', 0.04);
      v.box(-3, 10, -16, 3, 11, -12, 0x64748b, 'metal', 0.05);
      v.symBox(1, 10, -21, 2, 10, -17, 0x1e293b, 'metal', 0.04);
      v.emit(matte, metal, win, glow);
    } else if (species === 'orc') {
      // ORC: Terrifying WAAAGH! Scrap-Juggernaut (asymmetric spiked jaw-fortress on crusher treads!)
      const v = new VoxelShipBuilder(0.26, 0.02);
      v.symBox(6, 0, -16, 10, 4, 15, 0x262626, 'matte', 0.08);
      for (let tz = -15; tz <= 14; tz += 3) {
        v.symBox(10, 1, tz, 11, 2, tz, 0xa1a1aa, 'metal', 0.05);
      }
      v.box(-6, 2, -16, 6, 7, 14, 0x3b3532, 'matte', 0.09);
      v.box(-6, 4, -14, -3, 7, 10, 0x881b1b, 'matte', 0.08);
      v.box(2, 5, -10, 6, 8, 12, 0x5c2b22, 'matte', 0.09);
      v.box(-7, 2, 15, 7, 5, 19, 0x18181b, 'matte', 0.06);
      v.box(-5, 3, 16, 5, 5, 18, 0xf97316, 'glow', 0);
      for (let tx = -6; tx <= 6; tx += 2) {
        v.box(tx, 1, 19, tx, 3, 21, 0xd4d4d8, 'metal', 0.05);
        v.box(tx, 5, 19, tx, 7, 20, 0xd4d4d8, 'metal', 0.05);
      }
      v.box(-5, 8, -13, 5, 12, 4, 0x4d4540, 'matte', 0.09);
      v.box(-2, 13, -11, 5, 16, -2, 0x991b1b, 'matte', 0.08);
      for (let wx = -1; wx <= 4; wx += 2) v.set(wx, 14, -1, 0xfbbf24, 'win', 0);
      v.box(-6, 9, 4, -2, 12, 10, 0x262626, 'metal', 0.06);
      v.box(-5, 10, 11, -3, 11, 18, 0x18181b, 'metal', 0.04);
      v.box(-5, 13, -13, -4, 21, -12, 0x262626, 'metal', 0.05);
      v.box(4, 15, -10, 5, 22, -9, 0x262626, 'metal', 0.05);
      v.box(-5, 21, -13, -4, 22, -12, 0xf97316, 'glow', 0);
      v.box(5, 17, -4, 5, 22, -4, 0x78716c, 'metal', 0.04);
      v.box(5, 19, -7, 5, 22, -5, 0xdc2626, 'matte', 0.06);
      v.emit(matte, metal, win, glow);
    } else if (species === 'elf') {
      // ELF: Majestic Sylvan Aether-Carrier (levitating ivory, gold & sapphire sky-citadel!)
      const v = new VoxelShipBuilder(0.25, 0.0);
      for (let z = -22; z <= 25; z++) {
        const halfW = z > 14 ? Math.max(1, Math.round(6 - (z - 14) * 0.52)) : z < -15 ? Math.max(2, Math.round(6 - (-15 - z) * 0.55)) : 6;
        v.box(-halfW + 1, 0, z, halfW - 1, 1, z, 0xdbeafe, 'matte', 0.04);
        v.box(-halfW, 2, z, halfW, 3, z, 0xf5f0e2, 'matte', 0.04);
        if (Math.abs(z) % 5 === 0 && halfW >= 4) {
          v.symBox(halfW, 2, z, halfW, 3, z, 0xc8a441, 'metal', 0.04);
        }
      }
      for (let x = 7; x <= 16; x++) {
        const zSpan = Math.max(2, Math.round(9 - (x - 7) * 0.75));
        v.symBox(x, 2, -zSpan - 2, x, 3, zSpan - 2, 0xf5f0e2, 'matte', 0.04);
        v.symBox(x, 3, zSpan - 2, x, 3, zSpan - 2, 0xc8a441, 'metal', 0.04);
      }
      for (const side of [-1, 1]) {
        const cx = side * 12;
        for (let dx = -3; dx <= 3; dx++) {
          for (let dz = -3; dz <= 3; dz++) {
            const d = Math.hypot(dx, dz);
            if (d >= 2.2 && d <= 3.3) v.set(cx + dx, 3, -2 + dz, 0xc8a441, 'metal', 0.03);
            else if (d < 2.2) v.set(cx + dx, 2, -2 + dz, 0x38bdf8, 'glow', 0);
          }
        }
        pushCyl(glow, 0.35, 0.55, 2.6, 8, side * 3.0, -1.1, -0.5, 0x7dd3fc);
      }
      v.box(-5, 4, -20, 5, 4, 22, 0xf8f5eb, 'matte', 0.035);
      v.box(0, 4, -18, 0, 4, 21, 0xc8a441, 'metal', 0.03);
      v.symBox(5, 4, -18, 5, 4, 18, 0x38bdf8, 'glow', 0);
      for (const pz of [-12, -4, 4, 12]) {
        v.parkedAircraft(-3, 5, pz, 0xc8a441, 0xf8f5eb, true);
      }
      v.box(3, 5, -13, 6, 10, -4, 0xf8f5eb, 'matte', 0.035);
      v.box(4, 11, -11, 5, 16, -6, 0xc8a441, 'metal', 0.04);
      v.box(4, 17, -9, 5, 21, -8, 0xc084fc, 'glow', 0);
      for (let wz = -11; wz <= -6; wz += 2) v.set(3, 8, wz, 0x7dd3fc, 'win', 0);
      v.emit(matte, metal, win, glow);
    } else if (species === 'lizardfolk') {
      // LIZARDFOLK: Amphibious Ziggurat-Leviathan (hybrid land + sea stepped obsidian-gold temple-crawler!)
      const v = new VoxelShipBuilder(0.26, 0.02);
      v.symBox(6, 0, -18, 10, 3, 18, 0x1e293b, 'matte', 0.06);
      v.symBox(7, 2, -16, 10, 2, 16, 0x34d399, 'glow', 0);
      v.symBox(6, 3, -17, 10, 4, 17, 0xca8a04, 'metal', 0.05);
      v.box(-6, 1, -20, 6, 5, 20, 0x0f172a, 'matte', 0.07);
      v.box(-5, 2, 21, 5, 4, 23, 0xd4af37, 'metal', 0.05);
      v.box(-6, 6, -15, 6, 8, 13, 0x1e293b, 'matte', 0.06);
      v.box(-6, 8, -15, 6, 8, 13, 0xca8a04, 'metal', 0.05);
      v.box(-5, 9, -11, 5, 11, 9, 0x1e293b, 'matte', 0.06);
      v.box(-5, 11, -11, 5, 11, 9, 0xd4af37, 'metal', 0.05);
      v.box(-3, 12, -7, 3, 14, 5, 0x1e293b, 'matte', 0.06);
      v.box(-3, 14, -7, 3, 14, 5, 0xd4af37, 'metal', 0.05);
      v.box(-1, 15, -2, 1, 20, 0, 0x34d399, 'glow', 0);
      v.set(0, 21, -1, 0xfacc15, 'glow', 0);
      v.symBox(5, 9, 12, 5, 11, 12, 0x34d399, 'glow', 0);
      v.symBox(5, 9, -14, 5, 11, -14, 0x34d399, 'glow', 0);
      v.symBox(3, 6, 14, 4, 7, 22, 0xd4af37, 'metal', 0.04);
      v.symBox(3, 7, 22, 4, 7, 23, 0x34d399, 'glow', 0);
      v.emit(matte, metal, win, glow);
    } else {
      // HUMAN: Crisp Micro-Voxel Aircraft Carrier!
      // Epoch 3 (Industrial): Modeled after image.png — long narrow cream wood-deck carrier with crimson bow star!
      // Epoch 4+ (Atomic/Info): Angled-deck dark-slate nuclear supercarrier with parked delta jets!
      const v = new VoxelShipBuilder(0.25, 0.0);
      const hullGrey = isPropEra ? 0x9aa7b4 : e >= 5 ? 0x475569 : 0x64748b;
      const deckCol = isPropEra ? 0xe6cfa8 : e >= 5 ? 0x262f3b : 0x334155;

      for (let z = -25; z <= 27; z++) {
        const hw =
          z > 18
            ? Math.max(1, Math.round(4 - (z - 18) * 0.38))
            : z < -19
              ? Math.max(2, Math.round(4 - (-19 - z) * 0.35))
              : 4;
        v.box(-hw, 0, z, hw, 1, z, 0x6b212a, 'matte', 0.05);
        v.box(-hw, 2, z, hw, 4, z, hullGrey, 'matte', 0.075);
      }
      // Under-deck steel support girders holding up the cantilevered bow & stern flight deck (image.png!)
      for (const gz of [-23, -20, 21, 24]) {
        v.symBox(3, 2, gz, 3, 4, gz, 0x475569, 'metal', 0.05);
      }
      // Deck-edge aircraft elevator cutouts & armored AA gun sponsons with metallic gun barrels
      for (const sz of [-18, -9, 2, 12, 19]) {
        v.symBox(5, 3, sz - 1, 6, 4, sz + 1, 0x64748b, 'metal', 0.05);
        addNavalTurret(matte, metal, -1.5, 1.25, sz * 0.25, 0.48, 0x64748b, 0x1e293b, -0.5);
        addNavalTurret(matte, metal, 1.5, 1.25, sz * 0.25, 0.48, 0x64748b, 0x1e293b, 0.5);
      }
      for (const hz of [-12, 4]) {
        v.symBox(4, 2, hz - 3, 4, 3, hz + 3, 0x111827, 'matte', 0.02);
        v.symBox(4, 3, hz - 2, 4, 3, hz + 2, 0xfbbf24, 'win', 0);
      }
      // Two-tone weathered flight deck (darker worn aft landing zone vs lighter clean forward launch deck, matching image.png!)
      v.box(-5, 5, -25, 5, 5, -2, isPropEra ? 0xcbb287 : deckCol, 'matte', 0.06);
      v.box(-5, 5, -1, 5, 5, 25, deckCol, 'matte', 0.055);
      v.box(-4, 5, 26, 4, 5, 27, deckCol, 'matte', 0.05);
      // Deck-edge elevator platforms
      v.box(-6, 5, -4, -5, 5, 1, 0x475569, 'metal', 0.04);
      v.box(5, 5, 8, 6, 5, 13, 0x475569, 'metal', 0.04);

      if (isPropEra) {
        for (let z = -22; z <= 22; z += 4) {
          v.box(-4, 5, z, 4, 5, z, z < 0 ? 0xb59b70 : 0xd5bc92, 'matte', 0.03);
        }
        // Bold crimson star/roundel insignia on forward bow deck (matching image.png!)
        v.box(-1, 5, 17, 1, 5, 19, 0xb91c1c, 'matte', 0.02);
        v.set(0, 5, 20, 0xb91c1c, 'matte', 0.02);
        v.set(0, 5, 16, 0xb91c1c, 'matte', 0.02);
        v.set(-2, 5, 18, 0xb91c1c, 'matte', 0.02);
        v.set(2, 5, 18, 0xb91c1c, 'matte', 0.02);
        // Detailed starboard bridge island + angled WWII funnel + lattice tripod mast
        v.box(4, 6, -10, 6, 9, -2, hullGrey, 'matte', 0.06);
        v.box(3, 10, -9, 6, 11, -3, 0x94a3b8, 'matte', 0.05);
        v.box(4, 12, -8, 5, 14, -5, 0x475569, 'metal', 0.05);
        v.box(5, 11, -4, 5, 17, -4, 0xcbd5e1, 'metal', 0.03);
        v.box(3, 15, -4, 7, 15, -4, 0xe2e8f0, 'metal', 0.03);
        v.set(4, 8, -3, 0xfbbf24, 'win', 0);
        v.set(4, 8, -5, 0xfbbf24, 'win', 0);
        v.set(3, 10, -4, 0xfbbf24, 'win', 0);
        for (const [px, pz] of [[-2, -21], [1, -18], [-2, -14], [1, -10], [-2, -6], [1, -2]]) {
          v.parkedAircraft(px, 6, pz, 0x64748b, 0xcbd5e1, false);
        }
      } else {
        v.box(-8, 5, -18, -6, 5, 5, deckCol, 'matte', 0.05);
        v.box(-7, 4, -17, -6, 4, 4, hullGrey, 'matte', 0.06);
        for (let z = -22; z <= 24; z += 3) v.set(-1, 5, z, 0xf1f5f9, 'matte', 0.01);
        for (let z = -16; z <= 4; z += 3) v.set(-6, 5, z, 0xfbbf24, 'matte', 0.01);
        if (e >= 6) v.box(1, 5, -20, 1, 5, 22, 0x60a5fa, 'glow', 0);
        v.box(3, 6, -12, 6, 11, -2, 0x64748b, 'matte', 0.06);
        v.box(2, 12, -11, 7, 14, -3, 0x94a3b8, 'matte', 0.05);
        v.box(5, 15, -8, 5, 20, -8, 0xe2e8f0, 'metal', 0.03);
        v.box(3, 18, -8, 7, 18, -8, 0xe2e8f0, 'metal', 0.03);
        for (let wz = -10; wz <= -4; wz += 2) v.set(3, 10, wz, 0xfbbf24, 'win', 0);
        for (const [px, pz] of [[-4, -20], [-2, -13], [-3, -5], [-2, 4], [1, 13]]) {
          v.parkedAircraft(px, 6, pz, 0x94a3b8, 0x64748b, true);
        }
      }
      v.emit(matte, metal, win, glow);
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
  // 5. SKY SIEGE MACHINES (sky_carrier, Epoch 5+) — Monumental micro-voxel Helicarrier & Sky Citadels!
  // =========================================================================
  if (type === 'sky_carrier') {
    const v = new VoxelShipBuilder(0.26, -0.4);

    if (species === 'elf') {
      // ELF: Grand Sylvan Aether-Citadel (swept ivory & gold sky-carrier with 4 glowing astral lift-pillars!)
      for (let z = -22; z <= 25; z++) {
        const hw = z > 15 ? Math.max(1, Math.round(6 - (z - 15) * 0.55)) : z < -16 ? Math.max(2, Math.round(6 - (-16 - z) * 0.5)) : 6;
        v.box(-hw, 0, z, hw, 3, z, 0xf5f0e2, 'matte', 0.04);
        v.box(-hw + 1, 4, z, hw - 1, 4, z, 0xe8e2d0, 'matte', 0.035);
      }
      // Swept dual outrigger wings housing 4 astral crystal lift rings
      for (const [rx, rz] of [[-13, 8], [13, 8], [-13, -9], [13, -9]]) {
        v.box(rx > 0 ? 6 : rx, 1, rz - 3, rx > 0 ? rx : -6, 3, rz + 3, 0xf2ede0, 'matte', 0.04);
        for (let dx = -4; dx <= 4; dx++) {
          for (let dz = -4; dz <= 4; dz++) {
            const d = Math.hypot(dx, dz);
            if (d >= 2.6 && d <= 4.1) v.set(rx + dx, 3, rz + dz, 0xc8a441, 'metal', 0.03);
            else if (d < 2.6) v.set(rx + dx, 2, rz + dz, 0xc084fc, 'glow', 0);
          }
        }
        pushCyl(glow, 0.35, 0.55, 3.4, 8, rx * 0.26, -1.6, rz * 0.26, 0x7dd3fc);
      }
      v.box(0, 4, -18, 0, 4, 22, 0xc8a441, 'metal', 0.03);
      for (const pz of [-12, -3, 6, 14]) v.parkedAircraft(-3, 5, pz, 0xc8a441, 0xf8f5eb, true);
      v.box(3, 5, -13, 6, 11, -3, 0xf8f5eb, 'matte', 0.035);
      v.box(4, 12, -10, 5, 19, -6, 0xc8a441, 'metal', 0.04);
      v.box(4, 20, -9, 5, 24, -7, 0xc084fc, 'glow', 0);
    } else if (species === 'orc') {
      // ORC: Scrap-Krumpa Sky-Hulk (bolted flying scrapyard dreadnought with flame-belching turbines!)
      v.box(-7, 0, -21, 7, 4, 20, 0x3b3532, 'matte', 0.09);
      v.box(-6, 4, -18, 6, 5, 19, 0x262626, 'matte', 0.08);
      v.box(-5, 5, 16, 4, 7, 23, 0x991b1b, 'matte', 0.08); // crimson bolted ski-jump prow
      for (const [rx, rz] of [[-14, 9], [14, 9], [-14, -10], [14, -10]]) {
        v.box(rx > 0 ? 7 : rx, 1, rz - 3, rx > 0 ? rx : -7, 4, rz + 3, 0x4d4540, 'matte', 0.09);
        for (let dx = -4; dx <= 4; dx++) {
          for (let dz = -4; dz <= 4; dz++) {
            const d = Math.hypot(dx, dz);
            if (d >= 2.6 && d <= 4.2) v.set(rx + dx, 3, rz + dz, 0x881b1b, 'metal', 0.06);
            else if (d < 2.6) v.set(rx + dx, 2, rz + dz, 0xf97316, 'glow', 0);
          }
        }
        pushCyl(glow, 0.42, 0.65, 3.2, 8, rx * 0.26, -1.6, rz * 0.26, 0xf97316);
      }
      v.box(3, 6, -14, 7, 13, -3, 0x5c2b22, 'matte', 0.09);
      v.box(4, 14, -12, 7, 17, -5, 0x991b1b, 'matte', 0.08);
      for (let wz = -11; wz <= -5; wz += 2) v.set(3, 11, wz, 0xfbbf24, 'win', 0);
      for (const pz of [-11, -2, 7, 14]) v.parkedAircraft(-3, 6, pz, 0xb91c1c, 0x3f3a36, true);
    } else if (species === 'dwarf') {
      // DWARF: Ironclad Sky-Barge (heavy brass-ribbed armored fortress dirigible with magma turbines!)
      v.box(-8, 0, -21, 8, 5, 20, 0x334155, 'matte', 0.07);
      v.box(-8, 5, -20, 8, 5, 19, 0xb45309, 'metal', 0.05);
      v.box(-6, 6, -18, 6, 6, 18, 0x475569, 'matte', 0.07);
      for (const [rx, rz] of [[-14, 9], [14, 9], [-14, -9], [14, -9]]) {
        v.box(rx > 0 ? 8 : rx, 1, rz - 3, rx > 0 ? rx : -8, 4, rz + 3, 0x334155, 'matte', 0.07);
        for (let dx = -4; dx <= 4; dx++) {
          for (let dz = -4; dz <= 4; dz++) {
            const d = Math.hypot(dx, dz);
            if (d >= 2.5 && d <= 4.1) v.set(rx + dx, 4, rz + dz, 0xd97706, 'metal', 0.04);
            else if (d < 2.5) v.set(rx + dx, 2, rz + dz, 0xf59e0b, 'glow', 0);
          }
        }
        pushCyl(glow, 0.4, 0.6, 3.0, 8, rx * 0.26, -1.5, rz * 0.26, 0xfbbf24);
      }
      v.box(3, 7, -14, 7, 13, -3, 0x475569, 'matte', 0.07);
      v.box(3, 14, -14, 7, 15, -3, 0xb45309, 'metal', 0.05);
      for (let wz = -12; wz <= -4; wz += 2) v.set(3, 11, wz, 0xfbbf24, 'win', 0);
      for (const pz of [-10, -1, 8]) v.parkedAircraft(-3, 7, pz, 0xd97706, 0x475569, true);
    } else if (species === 'lizardfolk') {
      // LIZARDFOLK: Floating Sun-Pyramid Sky-Temple (stepped obsidian-gold levitating ziggurat + corner obelisks!)
      v.box(-14, 0, -14, 14, 2, 14, 0x1e293b, 'matte', 0.06);
      v.box(-14, 2, -14, 14, 2, 14, 0xca8a04, 'metal', 0.05);
      v.box(-11, 3, -11, 11, 6, 11, 0x1e293b, 'matte', 0.06);
      v.box(-11, 6, -11, 11, 6, 11, 0xd4af37, 'metal', 0.05);
      v.box(-7, 7, -7, 7, 10, 7, 0x1e293b, 'matte', 0.06);
      v.box(-7, 10, -7, 7, 10, 7, 0xd4af37, 'metal', 0.05);
      v.box(-4, 11, -4, 4, 14, 4, 0x0f172a, 'matte', 0.06);
      v.box(-2, 15, -2, 2, 20, 2, 0x34d399, 'glow', 0); // blazing emerald sun-crystal apex
      for (const [ox, oz] of [[-15, 15], [15, 15], [-15, -15], [15, -15]]) {
        v.box(ox - 1, 1, oz - 1, ox + 1, 9, oz + 1, 0xca8a04, 'metal', 0.05);
        v.box(ox, 10, oz, ox, 13, oz, 0x34d399, 'glow', 0);
        pushCyl(glow, 0.3, 0.5, 3.2, 6, ox * 0.26, -1.6, oz * 0.26, 0x34d399);
      }
      pushCyl(glow, 0.85, 0.35, 2.2, 6, 0, -1.4, 0, 0xfacc15);
    } else {
      // HUMAN: Monumental Micro-Voxel Helicarrier modeled directly after image_2.png!
      // Deep stepped under-hull keel, lower hangar deck, 4 diagonal wing-outrigger circular lift-turbines
      // with bright cyan-white vertical light thruster shafts, parked delta jets, deck cranes & towering command bridge!
      for (let z = -24; z <= 26; z++) {
        const hw = z > 18 ? Math.max(4, Math.round(6 - (z - 18) * 0.35)) : z < -18 ? Math.max(4, Math.round(6 - (-18 - z) * 0.35)) : 6;
        // Deep tapered under-hull armored keel (y = -3 .. -1)
        const kw = Math.max(2, hw - 2);
        v.box(-kw, -2, z, kw, -1, z, 0x334155, 'matte', 0.08);
        if (Math.abs(z) <= 18) v.box(-kw + 1, -3, z, kw - 1, -3, z, 0x1e293b, 'matte', 0.07);
        // Main weathered mottled steel hull (y = 0 .. 3) + dark flight deck runway (y = 4)
        v.box(-hw, 0, z, hw, 3, z, 0x64748b, 'matte', 0.085);
        v.box(-hw + 1, 4, z, hw - 1, 4, z, 0x262f3b, 'matte', 0.05);
      }
      // Recessed glowing lower hangar bays & armored hull ribs along both flanks
      for (const hz of [-14, 0, 13]) {
        v.symBox(6, 0, hz - 3, 6, 2, hz + 3, 0x111827, 'matte', 0.03);
        v.symBox(6, 1, hz - 2, 6, 1, hz + 2, 0xfbbf24, 'win', 0);
      }
      // Port-side angled landing deck sponson & crisp runway markings
      v.box(-10, 3, -16, -7, 4, 5, 0x262f3b, 'matte', 0.05);
      v.box(-9, 1, -15, -7, 2, 4, 0x64748b, 'matte', 0.08);
      for (let z = -20; z <= 24; z += 3) v.set(-1, 4, z, 0xf1f5f9, 'matte', 0.01);
      v.box(-5, 4, 24, 5, 4, 25, 0xfbbf24, 'glow', 0);
      // 4 Giant Swept-Wing Outrigger Circular Lift-Turbine Pods with vertical white-cyan light thruster beams!
      for (const [rx, rz] of [[-15, 10], [15, 10], [-15, -10], [15, -10]]) {
        const sgn = rx > 0 ? 1 : -1;
        // Tapered stepped wing strut connecting hull to turbine pod
        for (let step = 7; step <= 14; step++) {
          const zHalf = Math.max(3, Math.round(5 - (step - 7) * 0.25));
          v.box(sgn * step, 0, rz - zHalf, sgn * step, 3, rz + zHalf, 0x64748b, 'matte', 0.085);
          v.box(sgn * step, 3, rz + zHalf, sgn * step, 3, rz + zHalf, 0x94a3b8, 'metal', 0.05);
        }
        for (let dx = -5; dx <= 5; dx++) {
          for (let dz = -5; dz <= 5; dz++) {
            const d = Math.hypot(dx, dz);
            if (d >= 3.2 && d <= 5.2) {
              v.set(rx + dx, 1, rz + dz, 0x334155, 'matte', 0.08);
              v.set(rx + dx, 2, rz + dz, 0x475569, 'matte', 0.08);
              v.set(rx + dx, 3, rz + dz, 0x94a3b8, 'metal', 0.06);
            } else if (d < 3.2) {
              // Crossed steel turbine rotor struts over glowing cyan thruster core
              if (Math.abs(dx) === 0 || Math.abs(dz) === 0) {
                v.set(rx + dx, 2, rz + dz, 0x1e293b, 'metal', 0.04);
              } else {
                v.set(rx + dx, 2, rz + dz, 0x7dd3fc, 'glow', 0);
              }
            }
          }
        }
        // Bright vertical thruster light columns (above & below turbines, matching image_2.png!)
        pushCyl(glow, 0.45, 0.72, 4.4, 10, rx * 0.26, -2.0, rz * 0.26, 0xe0f2fe);
        pushCyl(glow, 0.22, 0.42, 2.3, 8, rx * 0.26, 1.4, rz * 0.26, 0xbae6fd);
      }
      // Deck defense turrets, cargo crates & parked stealth fighter jets (image_2.png!)
      addNavalTurret(matte, metal, -2.1, 0.72, 4.8, 0.95, 0x64748b, 0x181b20, -0.35);
      addNavalTurret(matte, metal, 2.0, 0.72, -5.2, 0.95, 0x64748b, 0x181b20, 2.75);
      v.box(3, 5, 5, 5, 6, 8, 0x78716c, 'matte', 0.07);
      v.box(3, 5, 10, 4, 6, 12, 0x94a3b8, 'matte', 0.06);
      for (const [px, pz] of [[-2, 19], [1, 15], [-3, 10], [-4, -4], [-3, -14]]) {
        v.parkedAircraft(px, 5, pz, 0x475569, 0x64748b, true);
      }
      // Towering 3-tier overhanging voxel command bridge with radar domes & antenna array (image_2.png!)
      v.box(3, 5, -14, 7, 10, -3, 0x64748b, 'matte', 0.08);
      v.box(1, 11, -13, 9, 13, -4, 0x94a3b8, 'matte', 0.07); // wide overhanging bridge wings
      v.box(3, 14, -12, 7, 16, -6, 0x475569, 'matte', 0.07);
      for (let wz = -11; wz <= -5; wz += 2) {
        v.set(1, 12, wz, 0xfbbf24, 'win', 0);
        v.set(3, 8, wz, 0xfbbf24, 'win', 0);
      }
      // Tall antenna masts, radar crossbar & white radome
      v.box(5, 17, -10, 5, 24, -10, 0xe2e8f0, 'metal', 0.03);
      v.box(2, 20, -10, 8, 20, -10, 0xe2e8f0, 'metal', 0.03);
      v.box(6, 17, -7, 6, 22, -7, 0xcbd5e1, 'metal', 0.03);
      v.box(4, 17, -8, 5, 18, -7, 0xf8fafc, 'matte', 0.02); // white radar dome
    }

    v.emit(matte, metal, win, glow);
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
