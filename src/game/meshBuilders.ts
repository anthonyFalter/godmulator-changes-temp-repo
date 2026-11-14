import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BuildingType, ResourceNodeType, TerrainType, UnitRole } from './types';

const textureCache = new Map<string, THREE.CanvasTexture>();

export function getPixelArtTexture(
  key: string,
  baseHex: string,
  accentHex: string,
  shadowHex: string,
  pattern: 'stone' | 'grass' | 'wood' | 'roof' | 'water' | 'tech' | 'fertile',
): THREE.CanvasTexture {
  const existing = textureCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 16, 16);

  if (pattern === 'stone') {
    // Stepped stone masonry blocks like image_72c29f6b.png
    ctx.fillStyle = shadowHex;
    ctx.fillRect(0, 7, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(7, 0, 1, 7);
    ctx.fillRect(12, 8, 1, 7);
    ctx.fillRect(4, 8, 1, 7);

    ctx.fillStyle = accentHex;
    ctx.fillRect(1, 1, 5, 1);
    ctx.fillRect(9, 1, 5, 1);
    ctx.fillRect(6, 9, 5, 1);
    ctx.fillRect(1, 9, 2, 1);
  } else if (pattern === 'grass' || pattern === 'fertile') {
    // Rich pixel grass tufts & terrace highlights
    for (let y = 0; y < 16; y += 2) {
      for (let x = 0; x < 16; x += 2) {
        if ((x * 3 + y * 5) % 7 === 0) {
          ctx.fillStyle = accentHex;
          ctx.fillRect(x, y, 2, 1);
        } else if ((x * 7 + y * 3) % 11 === 0) {
          ctx.fillStyle = shadowHex;
          ctx.fillRect(x, y + 1, 1, 2);
        }
      }
    }
    if (pattern === 'fertile') {
      ctx.fillStyle = shadowHex;
      for (let y = 2; y < 16; y += 4) {
        ctx.fillRect(1, y, 14, 1);
      }
    }
  } else if (pattern === 'wood') {
    // Warm tavern timber planks like image_81b12287.png
    ctx.fillStyle = shadowHex;
    for (let y = 3; y < 16; y += 4) {
      ctx.fillRect(0, y, 16, 1);
    }
    ctx.fillStyle = accentHex;
    ctx.fillRect(2, 1, 8, 1);
    ctx.fillRect(6, 5, 7, 1);
    ctx.fillRect(1, 9, 9, 1);
    ctx.fillRect(5, 13, 8, 1);
  } else if (pattern === 'roof') {
    // Scalloped village roof tiles like image_352191d0.png
    for (let y = 0; y < 16; y += 4) {
      ctx.fillStyle = shadowHex;
      ctx.fillRect(0, y + 3, 16, 1);
      ctx.fillStyle = accentHex;
      for (let x = (y % 8 === 0 ? 0 : 2); x < 16; x += 4) {
        ctx.fillRect(x, y, 3, 2);
      }
    }
  } else if (pattern === 'tech') {
    ctx.fillStyle = shadowHex;
    ctx.fillRect(0, 0, 16, 1);
    ctx.fillRect(0, 0, 1, 16);
    ctx.fillStyle = accentHex;
    ctx.fillRect(3, 3, 4, 4);
    ctx.fillRect(9, 3, 4, 4);
    ctx.fillRect(3, 9, 10, 4);
  } else if (pattern === 'water') {
    ctx.fillStyle = accentHex;
    ctx.fillRect(2, 4, 5, 1);
    ctx.fillRect(9, 11, 5, 1);
    ctx.fillStyle = shadowHex;
    ctx.fillRect(3, 5, 5, 1);
    ctx.fillRect(8, 12, 5, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;

  textureCache.set(key, tex);
  return tex;
}

let cachedCliffSideMat: THREE.MeshStandardMaterial | null = null;
export function getCliffSideMaterial(): THREE.MeshStandardMaterial {
  if (!cachedCliffSideMat) {
    cachedCliffSideMat = new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('cliff_masonry', '#435358', '#5c7076', '#293538', 'stone'),
      roughness: 0.82,
      metalness: 0.08,
    });
  }
  return cachedCliffSideMat;
}

export function getTerrainMaterial(terrain: TerrainType): THREE.MeshStandardMaterial[] {
  let topMat: THREE.MeshStandardMaterial;
  switch (terrain) {
    case 'deep_water':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('deep_water', '#204556', '#35697e', '#17323f', 'water'),
        roughness: 0.25,
        metalness: 0.15,
      });
      break;
    case 'shallow_water':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('shallow_water', '#2f6678', '#5293a6', '#214c5b', 'water'),
        roughness: 0.22,
        metalness: 0.15,
      });
      break;
    case 'sand':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('sand', '#c7b08b', '#dfd0b2', '#a68f6d', 'grass'),
        roughness: 0.85,
        metalness: 0.05,
      });
      break;
    case 'fertile':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('fertile', '#587d47', '#7aa35e', '#3e5c31', 'fertile'),
        roughness: 0.8,
        metalness: 0.05,
      });
      break;
    case 'forest':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('forest', '#3b5e43', '#4f7a58', '#294530', 'grass'),
        roughness: 0.85,
        metalness: 0.05,
      });
      break;
    case 'stone_road':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('stone_road', '#a89482', '#c9b49f', '#6e5e50', 'stone'),
        roughness: 0.65,
        metalness: 0.1,
      });
      break;
    case 'rock':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('rock', '#536267', '#6f8187', '#354145', 'stone'),
        roughness: 0.75,
        metalness: 0.15,
      });
      break;
    case 'scorched':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('scorched', '#382a27', '#693628', '#1f1615', 'stone'),
        roughness: 0.9,
        metalness: 0.1,
      });
      break;
    case 'crystal_field':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('crystal_field', '#3e5463', '#64dfdf', '#273640', 'tech'),
        roughness: 0.35,
        metalness: 0.3,
      });
      break;
    case 'grass':
    default:
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('grass', '#688c54', '#86ab6e', '#4b693b', 'grass'),
        roughness: 0.8,
        metalness: 0.05,
      });
      break;
  }
  const cliff = getCliffSideMaterial();
  return [cliff, cliff, topMat, cliff, cliff, cliff];
}

const sharedShadowGeo = new THREE.CircleGeometry(0.38, 12);
sharedShadowGeo.rotateX(-Math.PI / 2);
const sharedShadowMat = new THREE.MeshBasicMaterial({
  color: 0x090b0c,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
});

function createContactShadow(scale = 1.0): THREE.Mesh {
  const m = new THREE.Mesh(sharedShadowGeo, sharedShadowMat);
  m.scale.setScalar(scale);
  m.position.y = 0.015;
  return m;
}

const _tmpColor = new THREE.Color();

function addColoredBox(
  parts: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  hex: number,
  rotY = 0,
  rotZ = 0,
) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotZ !== 0) g.rotateZ(rotZ);
  if (rotY !== 0) g.rotateY(rotY);
  g.translate(x, y, z);

  _tmpColor.setHex(hex);
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = _tmpColor.r;
    colors[i * 3 + 1] = _tmpColor.g;
    colors[i * 3 + 2] = _tmpColor.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  parts.push(g);
}

function finalizeMergedParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return merged ?? new THREE.BoxGeometry(0.1, 0.1, 0.1);
}

function addPixelTree(
  parts: THREE.BufferGeometry[],
  tx: number,
  tz: number,
  scale: number,
  variantPalette: 0 | 1 | 2,
) {
  const trunkHex = 0x6b442a;
  const palettes: [number, number, number][] = [
    [0x3b6e4c, 0x528c5c, 0x76ab6d],
    [0x2f5e41, 0x457d53, 0x679e61],
    [0x476b3b, 0x618c49, 0x89ab5c],
  ];
  const [c1, c2, c3] = palettes[variantPalette];
  // Ground shadow pad
  addColoredBox(parts, 0.34 * scale, 0.02, 0.34 * scale, tx, 0.01, tz, 0x1b2920);
  // Trunk
  addColoredBox(parts, 0.13 * scale, 0.32 * scale, 0.13 * scale, tx, 0.16 * scale, tz, trunkHex);
  // 3 stepped foliage tiers
  addColoredBox(parts, 0.44 * scale, 0.2 * scale, 0.44 * scale, tx, 0.36 * scale, tz, c1);
  addColoredBox(parts, 0.32 * scale, 0.18 * scale, 0.32 * scale, tx, 0.52 * scale, tz, c2);
  addColoredBox(parts, 0.18 * scale, 0.14 * scale, 0.18 * scale, tx, 0.65 * scale, tz, c3);
}

function addPixelRock(
  parts: THREE.BufferGeometry[],
  rx: number,
  rz: number,
  scale: number,
  oreHex?: number,
  mossy = false,
) {
  addColoredBox(parts, 0.34 * scale, 0.02, 0.34 * scale, rx, 0.01, rz, 0x1c2224);
  addColoredBox(parts, 0.34 * scale, 0.24 * scale, 0.3 * scale, rx, 0.12 * scale, rz, 0x74726c);
  addColoredBox(
    parts,
    0.22 * scale,
    0.32 * scale,
    0.22 * scale,
    rx + 0.05 * scale,
    0.16 * scale,
    rz - 0.04 * scale,
    0x8f8b82,
  );
  if (mossy) {
    addColoredBox(
      parts,
      0.24 * scale,
      0.06 * scale,
      0.22 * scale,
      rx + 0.04 * scale,
      0.33 * scale,
      rz - 0.04 * scale,
      0x588147,
    );
  }
  if (oreHex !== undefined) {
    addColoredBox(
      parts,
      0.11 * scale,
      0.13 * scale,
      0.11 * scale,
      rx - 0.1 * scale,
      0.2 * scale,
      rz + 0.08 * scale,
      oreHex,
    );
    addColoredBox(
      parts,
      0.09 * scale,
      0.1 * scale,
      0.09 * scale,
      rx + 0.14 * scale,
      0.14 * scale,
      rz + 0.1 * scale,
      oreHex,
    );
  }
}

function addPixelBush(
  parts: THREE.BufferGeometry[],
  bx: number,
  bz: number,
  scale: number,
  fruitHex: number,
) {
  addColoredBox(parts, 0.28 * scale, 0.16 * scale, 0.28 * scale, bx, 0.08 * scale, bz, 0x45753d);
  addColoredBox(
    parts,
    0.18 * scale,
    0.1 * scale,
    0.18 * scale,
    bx + 0.02 * scale,
    0.18 * scale,
    bz - 0.02 * scale,
    0x59914b,
  );
  addColoredBox(
    parts,
    0.07 * scale,
    0.07 * scale,
    0.07 * scale,
    bx - 0.08 * scale,
    0.17 * scale,
    bz + 0.08 * scale,
    fruitHex,
  );
  addColoredBox(
    parts,
    0.07 * scale,
    0.07 * scale,
    0.07 * scale,
    bx + 0.09 * scale,
    0.19 * scale,
    bz - 0.04 * scale,
    fruitHex,
  );
}

export interface NodeVariantLibrary {
  timber: THREE.BufferGeometry[];
  berry: THREE.BufferGeometry[];
  stone: THREE.BufferGeometry[];
  ore: THREE.BufferGeometry[];
  crystal: THREE.BufferGeometry[];
  ambientGrass: THREE.BufferGeometry[];
  ambientForest: THREE.BufferGeometry[];
  ambientSand: THREE.BufferGeometry[];
  ambientRock: THREE.BufferGeometry[];
  standardMat: THREE.MeshStandardMaterial;
  crystalMat: THREE.MeshStandardMaterial;
}

let cachedVariantLib: NodeVariantLibrary | null = null;

export function getNodeVariantLibrary(): NodeVariantLibrary {
  if (cachedVariantLib) return cachedVariantLib;

  // 1. Timber Grove variants (1-3 full trees + saplings/stumps per tile)
  const timber: THREE.BufferGeometry[] = [];
  {
    // V0: 2 trees staggered + mossy stump
    const p: THREE.BufferGeometry[] = [];
    addPixelTree(p, -0.17, -0.14, 1.05, 0);
    addPixelTree(p, 0.2, 0.17, 0.78, 1);
    addColoredBox(p, 0.12, 0.1, 0.12, -0.2, 0.05, 0.22, 0x6b442a);
    addColoredBox(p, 0.14, 0.04, 0.14, -0.2, 0.11, 0.22, 0x5c8a47);
    timber.push(finalizeMergedParts(p));
  }
  {
    // V1: 3 dense woodland trees
    const p: THREE.BufferGeometry[] = [];
    addPixelTree(p, -0.21, -0.15, 0.85, 1);
    addPixelTree(p, 0.21, -0.11, 0.74, 2);
    addPixelTree(p, 0.0, 0.22, 0.92, 0);
    timber.push(finalizeMergedParts(p));
  }
  {
    // V2: 1 grand ancient tree + 2 saplings + fallen log
    const p: THREE.BufferGeometry[] = [];
    addPixelTree(p, -0.04, -0.04, 1.22, 0);
    addPixelTree(p, 0.26, -0.22, 0.56, 2);
    addPixelTree(p, -0.25, 0.24, 0.52, 1);
    addColoredBox(p, 0.26, 0.08, 0.09, 0.2, 0.04, 0.22, 0x5c3a22, 0.4);
    timber.push(finalizeMergedParts(p));
  }
  {
    // V3: 3 slender asymmetric pines
    const p: THREE.BufferGeometry[] = [];
    addPixelTree(p, 0.2, -0.2, 0.96, 1);
    addPixelTree(p, -0.2, 0.04, 0.76, 0);
    addPixelTree(p, 0.12, 0.24, 0.68, 2);
    timber.push(finalizeMergedParts(p));
  }

  // 2. Berry & Flora Bush variants (2-4 shrubs, crops, pumpkins, flowers per tile)
  const berry: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addPixelBush(p, -0.2, -0.16, 1.0, 0xd94e34);
    addPixelBush(p, 0.2, -0.1, 0.85, 0xd94e34);
    addPixelBush(p, -0.02, 0.22, 0.92, 0xe89c31);
    berry.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addPixelBush(p, -0.22, -0.2, 0.8, 0xd94e34);
    addPixelBush(p, 0.2, 0.2, 0.85, 0xd94e34);
    addColoredBox(p, 0.16, 0.26, 0.16, 0.2, 0.13, -0.18, 0xe0a943);
    addColoredBox(p, 0.14, 0.22, 0.14, -0.2, 0.11, 0.18, 0xe8bc54);
    berry.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addPixelBush(p, -0.14, 0.0, 1.05, 0xd94e34);
    addPixelBush(p, 0.2, -0.18, 0.78, 0xf2b749);
    addColoredBox(p, 0.14, 0.12, 0.14, 0.18, 0.06, 0.2, 0xe06d2b);
    addColoredBox(p, 0.11, 0.1, 0.11, -0.02, 0.05, 0.26, 0xe06d2b);
    berry.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addPixelBush(p, 0.0, -0.22, 0.88, 0xd94e34);
    addPixelBush(p, -0.22, 0.14, 0.84, 0xf4c95d);
    addPixelBush(p, 0.22, 0.16, 0.8, 0xd94e34);
    berry.push(finalizeMergedParts(p));
  }

  // 3. Stone Outcrop variants (1-3 boulders + pebbles per tile)
  const stone: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addPixelRock(p, -0.1, -0.08, 1.15, undefined, false);
    addPixelRock(p, 0.22, 0.18, 0.7, undefined, true);
    addColoredBox(p, 0.1, 0.07, 0.1, -0.24, 0.035, 0.22, 0x8f8b82);
    stone.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addPixelRock(p, -0.2, -0.16, 0.85, undefined, false);
    addPixelRock(p, 0.2, -0.1, 0.75, undefined, false);
    addPixelRock(p, 0.0, 0.22, 0.95, undefined, true);
    stone.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addPixelRock(p, 0.0, 0.0, 1.3, undefined, true);
    addColoredBox(p, 0.14, 0.1, 0.14, 0.26, 0.05, 0.22, 0x74726c);
    addColoredBox(p, 0.12, 0.08, 0.12, -0.26, 0.04, -0.2, 0x99958b);
    stone.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addPixelRock(p, 0.18, -0.18, 0.9, undefined, true);
    addPixelRock(p, -0.18, 0.16, 0.86, undefined, false);
    addPixelRock(p, -0.22, -0.18, 0.56, undefined, false);
    stone.push(finalizeMergedParts(p));
  }

  // 4. Ore Vein variants (1-3 metallic ore clusters per tile)
  const ore: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addPixelRock(p, -0.1, -0.06, 1.1, 0xe08e36);
    addPixelRock(p, 0.22, 0.18, 0.75, 0xf5b742);
    ore.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addPixelRock(p, -0.2, -0.14, 0.82, 0xe08e36);
    addPixelRock(p, 0.2, -0.12, 0.78, 0xf5b742);
    addPixelRock(p, 0.02, 0.22, 0.9, 0xd97228);
    ore.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addPixelRock(p, 0.0, 0.0, 1.25, 0xf5b742);
    addColoredBox(p, 0.12, 0.12, 0.12, -0.26, 0.06, 0.22, 0xe08e36);
    addColoredBox(p, 0.1, 0.1, 0.1, 0.26, 0.05, -0.22, 0xf5b742);
    ore.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addPixelRock(p, 0.18, -0.16, 0.92, 0xd97228);
    addPixelRock(p, -0.18, 0.16, 0.88, 0xf5b742);
    ore.push(finalizeMergedParts(p));
  }

  // 5. Crystal Monolith variants (1-4 luminous spires per tile)
  const crystal: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.48, 0.12, 0.48, 0, 0.06, 0, 0x37474f);
    addColoredBox(p, 0.18, 0.66, 0.18, 0, 0.38, 0, 0x48bfe3, Math.PI / 4);
    addColoredBox(p, 0.12, 0.4, 0.12, 0.18, 0.24, 0.12, 0x64dfdf, 0, -0.22);
    addColoredBox(p, 0.11, 0.34, 0.11, -0.17, 0.2, -0.14, 0x4ea8de, 0, 0.24);
    crystal.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.22, 0.1, 0.22, -0.18, 0.05, -0.12, 0x37474f);
    addColoredBox(p, 0.13, 0.54, 0.13, -0.18, 0.32, -0.12, 0x48bfe3, 0.4, 0.12);
    addColoredBox(p, 0.12, 0.48, 0.12, 0.2, 0.28, -0.14, 0x64dfdf, 0.7, -0.18);
    addColoredBox(p, 0.14, 0.6, 0.14, 0.02, 0.34, 0.22, 0x56cfe1, 0.2);
    crystal.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.11, 0.42, 0.11, -0.2, 0.21, -0.18, 0x64dfdf, 0.3, 0.18);
    addColoredBox(p, 0.11, 0.46, 0.11, 0.2, 0.23, -0.16, 0x48bfe3, 0.6, -0.16);
    addColoredBox(p, 0.12, 0.52, 0.12, -0.16, 0.26, 0.2, 0x56cfe1, 0.1, 0.14);
    addColoredBox(p, 0.1, 0.38, 0.1, 0.22, 0.19, 0.18, 0x72efdd, 0.5, -0.2);
    crystal.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.42, 0.1, 0.36, 0, 0.05, 0, 0x37474f);
    addColoredBox(p, 0.17, 0.68, 0.17, -0.1, 0.38, -0.05, 0x48bfe3, 0.5, 0.14);
    addColoredBox(p, 0.15, 0.56, 0.15, 0.14, 0.32, 0.12, 0x64dfdf, 0.2, -0.18);
    crystal.push(finalizeMergedParts(p));
  }

  // 6. Ambient Ground Details (2-4 sub-tile flora/pebble/mushroom clusters on open land)
  const ambientGrass: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.08, 0.12, 0.08, -0.2, 0.06, -0.18, 0x78a65a);
    addColoredBox(p, 0.07, 0.1, 0.07, 0.18, 0.05, 0.14, 0x68964c);
    addColoredBox(p, 0.07, 0.07, 0.07, 0.18, 0.11, 0.14, 0xf2c94c); // flower
    addColoredBox(p, 0.08, 0.09, 0.08, -0.12, 0.045, 0.22, 0x86b565);
    ambientGrass.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.09, 0.1, 0.09, 0.18, 0.05, -0.2, 0x5c8a47);
    addColoredBox(p, 0.06, 0.08, 0.06, -0.22, 0.04, 0.08, 0xe87a5d); // coral wildflower
    addColoredBox(p, 0.06, 0.08, 0.06, 0.04, 0.04, 0.24, 0xede4d3); // cream wildflower
    ambientGrass.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.1, 0.12, 0.1, -0.16, 0.06, 0.16, 0x68964c);
    addColoredBox(p, 0.08, 0.14, 0.08, 0.22, 0.07, -0.12, 0x78a65a);
    addColoredBox(p, 0.07, 0.08, 0.07, 0.02, 0.04, -0.22, 0xf2c94c);
    ambientGrass.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.12, 0.08, 0.12, -0.2, 0.04, -0.14, 0x567d46);
    addColoredBox(p, 0.09, 0.1, 0.09, 0.16, 0.05, 0.2, 0x73a156);
    ambientGrass.push(finalizeMergedParts(p));
  }

  const ambientForest: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.16, 0.1, 0.16, -0.18, 0.05, -0.14, 0x456e43); // fern
    addColoredBox(p, 0.05, 0.07, 0.05, 0.2, 0.035, 0.16, 0xede4d3); // mushroom stem
    addColoredBox(p, 0.09, 0.05, 0.09, 0.2, 0.08, 0.16, 0xc94a38); // red cap
    ambientForest.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.24, 0.07, 0.08, 0.04, 0.035, 0.12, 0x5e3e27, 0.5); // twig/log
    addColoredBox(p, 0.12, 0.1, 0.12, -0.2, 0.05, -0.16, 0x4f7a58);
    ambientForest.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.14, 0.12, 0.14, 0.16, 0.06, -0.18, 0x3b633c);
    addColoredBox(p, 0.08, 0.07, 0.08, -0.18, 0.035, 0.18, 0xd4a359);
    ambientForest.push(finalizeMergedParts(p));
  }

  const ambientSand: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.1, 0.05, 0.1, -0.2, 0.025, 0.16, 0x998e7c);
    addColoredBox(p, 0.07, 0.04, 0.07, 0.2, 0.02, -0.16, 0xebd7c5); // shell
    ambientSand.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.08, 0.14, 0.08, -0.16, 0.07, -0.18, 0x7d9454); // dune grass
    addColoredBox(p, 0.07, 0.1, 0.07, -0.1, 0.05, -0.14, 0x8ea660);
    addColoredBox(p, 0.09, 0.05, 0.09, 0.18, 0.025, 0.2, 0xa89b87);
    ambientSand.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.18, 0.06, 0.07, 0.06, 0.03, 0.08, 0x8a6b4e, -0.4); // driftwood
    addColoredBox(p, 0.08, 0.04, 0.08, -0.22, 0.02, -0.14, 0xe8b4a2);
    ambientSand.push(finalizeMergedParts(p));
  }

  const ambientRock: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.14, 0.08, 0.12, -0.18, 0.04, -0.14, 0x6f7a7e);
    addColoredBox(p, 0.1, 0.06, 0.1, 0.2, 0.03, 0.18, 0x8a9599);
    addColoredBox(p, 0.08, 0.05, 0.08, 0.12, 0.025, -0.2, 0x576166);
    ambientRock.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.16, 0.1, 0.16, 0.14, 0.05, -0.12, 0x636e73);
    addColoredBox(p, 0.09, 0.06, 0.09, -0.2, 0.03, 0.16, 0x808c91);
    ambientRock.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.12, 0.07, 0.12, -0.14, 0.035, 0.18, 0x7b858a);
    addColoredBox(p, 0.11, 0.08, 0.11, 0.2, 0.04, -0.16, 0x646f73);
    ambientRock.push(finalizeMergedParts(p));
  }

  cachedVariantLib = {
    timber,
    berry,
    stone,
    ore,
    crystal,
    ambientGrass,
    ambientForest,
    ambientSand,
    ambientRock,
    standardMat: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.08,
    }),
    crystalMat: new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: 0x104c63,
      emissiveIntensity: 0.45,
      roughness: 0.24,
      metalness: 0.35,
    }),
  };

  return cachedVariantLib;
}

export function createResourceNodeGroup(nodeType: ResourceNodeType, variant = 0): THREE.Group {
  const group = new THREE.Group();
  if (nodeType === 'none') return group;

  const lib = getNodeVariantLibrary();
  const idx = Math.abs(variant) % 4;
  let geo: THREE.BufferGeometry = lib.timber[0];
  let mat = lib.standardMat;

  if (nodeType === 'timber_grove') geo = lib.timber[idx % lib.timber.length];
  else if (nodeType === 'berry_bush') geo = lib.berry[idx % lib.berry.length];
  else if (nodeType === 'stone_outcrop') geo = lib.stone[idx % lib.stone.length];
  else if (nodeType === 'ore_vein') geo = lib.ore[idx % lib.ore.length];
  else if (nodeType === 'crystal_monolith') {
    geo = lib.crystal[idx % lib.crystal.length];
    mat = lib.crystalMat;
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

export function createBuildingGroup(type: BuildingType, epochIndex: number): THREE.Group {
  const group = new THREE.Group();
  group.add(createContactShadow(1.35));

  const stoneMat = new THREE.MeshStandardMaterial({
    map: getPixelArtTexture('bld_stone', '#8f8478', '#b0a496', '#5c534b', 'stone'),
    roughness: 0.75,
  });
  const darkStoneMat = new THREE.MeshStandardMaterial({
    map: getPixelArtTexture('bld_dark_stone', '#465459', '#607178', '#2c363a', 'stone'),
    roughness: 0.7,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: getPixelArtTexture('bld_wood', '#7d5338', '#9e6b49', '#523522', 'wood'),
    roughness: 0.8,
  });
  const redRoofMat = new THREE.MeshStandardMaterial({
    map: getPixelArtTexture('bld_roof_red', '#b84239', '#d95b50', '#7d2923', 'roof'),
    roughness: 0.6,
  });
  const blueRoofMat = new THREE.MeshStandardMaterial({
    map: getPixelArtTexture('bld_roof_blue', '#3b5bdb', '#5c7cfa', '#263b8c', 'roof'),
    roughness: 0.55,
  });
  const greenAwningMat = new THREE.MeshStandardMaterial({
    map: getPixelArtTexture('bld_awning_green', '#3f8f65', '#5eb586', '#286143', 'roof'),
    roughness: 0.65,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xe9b44c,
    metalness: 0.65,
    roughness: 0.25,
  });
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xff922b,
    emissive: 0xf76707,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });
  const techMat = new THREE.MeshStandardMaterial({
    map: getPixelArtTexture('bld_tech', '#d8dee9', '#eceff4', '#9aa5b8', 'tech'),
    roughness: 0.35,
    metalness: 0.4,
  });
  const glowCyanMat = new THREE.MeshStandardMaterial({
    color: 0x56cfe1,
    emissive: 0x48bfe3,
    emissiveIntensity: 0.75,
    roughness: 0.2,
  });

  // Stepped stone foundation plinth shared across structures
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.14, 0.88), darkStoneMat);
  plinth.position.y = 0.07;
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  group.add(plinth);

  switch (type) {
    case 'bonfire': {
      // Civic Center — evolves visually with epochIndex while keeping sacred hearth fire!
      const step2 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.72), stoneMat);
      step2.position.y = 0.2;
      group.add(step2);

      // 4 standing pillars / monoliths around the hearth
      const corners = [
        [-0.28, -0.28],
        [0.28, -0.28],
        [-0.28, 0.28],
        [0.28, 0.28],
      ];
      for (const [cx, cz] of corners) {
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.48 + epochIndex * 0.05, 0.12),
          epochIndex >= 4 ? techMat : stoneMat,
        );
        pillar.position.set(cx, 0.48, cz);
        pillar.castShadow = true;
        group.add(pillar);
      }

      // Logs + flickering multi-tier flame
      const logs = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.28), woodMat);
      logs.position.y = 0.3;
      group.add(logs);

      const flameOuter = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.32, 0.2), flameMat);
      flameOuter.position.y = 0.46;
      flameOuter.name = 'flicker_flame';
      group.add(flameOuter);

      const flameCore = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.22, 0.1),
        epochIndex >= 5 ? glowCyanMat : goldMat,
      );
      flameCore.position.y = 0.62;
      group.add(flameCore);
      break;
    }

    case 'forager_hut': {
      // Cozy timber lodge with green awning & barrels (inspired by image_352191d0.png)
      const walls = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.42, 0.62), woodMat);
      walls.position.y = 0.35;
      walls.castShadow = true;
      group.add(walls);

      const roof1 = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.16, 0.72), redRoofMat);
      roof1.position.y = 0.62;
      roof1.castShadow = true;
      group.add(roof1);

      const roof2 = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.14, 0.52), redRoofMat);
      roof2.position.y = 0.76;
      group.add(roof2);

      const awning = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.24), greenAwningMat);
      awning.position.set(0, 0.42, 0.36);
      group.add(awning);

      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), woodMat);
      barrel.position.set(0.26, 0.23, 0.34);
      group.add(barrel);
      break;
    }

    case 'shaman_totem': {
      // Stepped stone altar with carved totem & twin candle braziers (image_72c29f6b.png vibe)
      const altar = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.24, 0.56), darkStoneMat);
      altar.position.y = 0.26;
      group.add(altar);

      const totemShaft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.22), stoneMat);
      totemShaft.position.y = 0.68;
      totemShaft.castShadow = true;
      group.add(totemShaft);

      const wings = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.12, 0.14), goldMat);
      wings.position.y = 0.82;
      group.add(wings);

      const candleL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.08), flameMat);
      candleL.position.set(-0.2, 0.44, 0.2);
      group.add(candleL);

      const candleR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.08), flameMat);
      candleR.position.set(0.2, 0.44, 0.2);
      group.add(candleR);
      break;
    }

    case 'granary': {
      // Terraced market granary with striped awning & grain silos
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.46, 0.68), stoneMat);
      body.position.y = 0.37;
      body.castShadow = true;
      group.add(body);

      const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.64, 8), woodMat);
      silo.position.set(-0.22, 0.46, -0.18);
      silo.castShadow = true;
      group.add(silo);

      const siloCap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 8), goldMat);
      siloCap.position.set(-0.22, 0.88, -0.18);
      group.add(siloCap);

      const awning = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.26), greenAwningMat);
      awning.position.set(0.08, 0.46, 0.38);
      group.add(awning);
      break;
    }

    case 'smeltery': {
      // Stepped stone forge, chimney stack, and glowing molten crucible
      const hall = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.4, 0.64), darkStoneMat);
      hall.position.y = 0.34;
      hall.castShadow = true;
      group.add(hall);

      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.24), stoneMat);
      chimney.position.set(-0.16, 0.53, -0.14);
      chimney.castShadow = true;
      group.add(chimney);

      const vat = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.24), flameMat);
      vat.position.set(0.18, 0.24, 0.18);
      group.add(vat);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.58), redRoofMat);
      roof.position.set(0.12, 0.58, 0);
      group.add(roof);
      break;
    }

    case 'ziggurat': {
      // Monumental 4-tier stepped temple with staircase & sacred flame (inspired by image_72c29f6b.png)
      const tier1 = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.22, 0.86), darkStoneMat);
      tier1.position.y = 0.25;
      tier1.castShadow = true;
      group.add(tier1);

      const tier2 = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.22, 0.66), stoneMat);
      tier2.position.y = 0.47;
      tier2.castShadow = true;
      group.add(tier2);

      const tier3 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.46), darkStoneMat);
      tier3.position.y = 0.69;
      tier3.castShadow = true;
      group.add(tier3);

      const stairs = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.56, 0.32), stoneMat);
      stairs.position.set(0, 0.38, 0.36);
      stairs.rotation.x = -0.35;
      group.add(stairs);

      const sanctum = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.24), goldMat);
      sanctum.position.y = 0.9;
      group.add(sanctum);

      const brazier = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.14), flameMat);
      brazier.position.y = 1.08;
      group.add(brazier);
      break;
    }

    case 'guildhall': {
      // Multi-story timber-and-stone house with blue tiled pitched roof (image_352191d0.png)
      const stoneBase = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.32, 0.68), stoneMat);
      stoneBase.position.y = 0.3;
      stoneBase.castShadow = true;
      group.add(stoneBase);

      const timberUpper = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.34, 0.72), woodMat);
      timberUpper.position.y = 0.63;
      timberUpper.castShadow = true;
      group.add(timberUpper);

      const roofLow = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.16, 0.78), blueRoofMat);
      roofLow.position.y = 0.88;
      roofLow.castShadow = true;
      group.add(roofLow);

      const roofPeak = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.74), blueRoofMat);
      roofPeak.position.y = 1.04;
      group.add(roofPeak);

      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.1), flameMat);
      lantern.position.set(0.32, 0.42, 0.38);
      group.add(lantern);
      break;
    }

    case 'observatory': {
      // Stepped stone tower with rotating copper/gold dome & telescope
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.72, 8), stoneMat);
      tower.position.y = 0.5;
      tower.castShadow = true;
      group.add(tower);

      const balcony = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.68), woodMat);
      balcony.position.y = 0.84;
      group.add(balcony);

      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), goldMat);
      dome.position.y = 0.88;
      group.add(dome);

      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.38, 6), darkStoneMat);
      scope.position.set(0.14, 1.04, 0.14);
      scope.rotation.z = -0.6;
      scope.rotation.x = 0.4;
      group.add(scope);
      break;
    }

    case 'steam_foundry':
    case 'dynamo_plant': {
      // Industrial brick & iron factory with twin smokestacks and rotating flywheel
      const factoryHall = new THREE.Mesh(
        new THREE.BoxGeometry(0.78, 0.48, 0.74),
        type === 'steam_foundry' ? redRoofMat : darkStoneMat,
      );
      factoryHall.position.y = 0.38;
      factoryHall.castShadow = true;
      group.add(factoryHall);

      const stack1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.85, 8), darkStoneMat);
      stack1.position.set(-0.24, 0.68, -0.22);
      stack1.castShadow = true;
      group.add(stack1);

      const stack2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.75, 8), darkStoneMat);
      stack2.position.set(0.02, 0.62, -0.22);
      stack2.castShadow = true;
      group.add(stack2);

      const coil = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.28, 0.28),
        type === 'dynamo_plant' ? glowCyanMat : goldMat,
      );
      coil.position.set(0.2, 0.68, 0.14);
      coil.name = 'spin_part';
      group.add(coil);
      break;
    }

    case 'fission_reactor':
    case 'cyber_institute': {
      // Modernist concrete/steel spire & cooling tower with glowing cyan core
      const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.36, 0.78), techMat);
      baseBlock.position.y = 0.32;
      baseBlock.castShadow = true;
      group.add(baseBlock);

      if (type === 'fission_reactor') {
        const coolingTower = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.76, 10), stoneMat);
        coolingTower.position.set(-0.12, 0.66, -0.1);
        coolingTower.castShadow = true;
        group.add(coolingTower);

        const coreGlow = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.38, 0.26), glowCyanMat);
        coreGlow.position.set(0.22, 0.62, 0.2);
        group.add(coreGlow);
      } else {
        const tower1 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.88, 0.44), techMat);
        tower1.position.y = 0.68;
        tower1.castShadow = true;
        group.add(tower1);

        const dataRing = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.12, 0.54), glowCyanMat);
        dataRing.position.y = 0.92;
        dataRing.name = 'spin_part';
        group.add(dataRing);

        const spireAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.4, 6), goldMat);
        spireAntenna.position.y = 1.24;
        group.add(spireAntenna);
      }
      break;
    }

    case 'launch_arcology': {
      // Orbital launch pad with gantry tower and vertical white/gold starship
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.22, 0.86), darkStoneMat);
      pad.position.y = 0.24;
      group.add(pad);

      const gantry = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.15, 0.18), redRoofMat);
      gantry.position.set(-0.26, 0.78, -0.22);
      gantry.castShadow = true;
      group.add(gantry);

      const rocketBody = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.92, 8), techMat);
      rocketBody.position.set(0.08, 0.76, 0.06);
      rocketBody.castShadow = true;
      group.add(rocketBody);

      const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 8), goldMat);
      noseCone.position.set(0.08, 1.36, 0.06);
      group.add(noseCone);

      const thrusterGlow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), flameMat);
      thrusterGlow.position.set(0.08, 0.32, 0.06);
      group.add(thrusterGlow);
      break;
    }

    case 'dyson_spire': {
      // Interstellar Ascension Monument: obsidian & gold pyramid with levitating rings & skyward beam
      const tier1 = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.26, 0.88), darkStoneMat);
      tier1.position.y = 0.26;
      group.add(tier1);

      const obelisk = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.25, 4), goldMat);
      obelisk.position.y = 0.95;
      obelisk.castShadow = true;
      group.add(obelisk);

      const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 6, 12), glowCyanMat);
      haloRing.position.y = 1.15;
      haloRing.rotation.x = Math.PI / 2;
      haloRing.name = 'spin_part';
      group.add(haloRing);

      const skyBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), glowCyanMat);
      skyBeam.position.y = 2.4;
      group.add(skyBeam);
      break;
    }
  }

  return group;
}

export function createUnitGroup(role: UnitRole, faction: 'civilization' | 'hostile'): THREE.Group {
  const group = new THREE.Group();
  group.add(createContactShadow(0.58));

  const skinMat = new THREE.MeshStandardMaterial({
    color: faction === 'hostile' ? 0x8f5656 : 0xe8be9e,
    roughness: 0.65,
  });

  const outfitColors: Record<UnitRole, number> = {
    villager: 0x4ea8de,
    forager: 0x52b788,
    miner: 0xe09f3e,
    builder: 0xd97736,
    warrior: 0xd62828,
    priest: 0xf4a261,
    scholar: 0x7209b7,
    astro_engineer: 0x56cfe1,
    raider_swarmer: 0x9b2226,
    raider_ranged: 0xae2012,
    raider_behemoth: 0x3c096c,
  };

  const tunicMat = new THREE.MeshStandardMaterial({
    color: outfitColors[role] ?? 0x4ea8de,
    roughness: 0.55,
    metalness: role === 'warrior' || role === 'astro_engineer' ? 0.45 : 0.1,
  });

  const bootMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.8 });
  const scale = role === 'raider_behemoth' ? 1.45 : 1.0;

  // 1. Legs
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scale, 0.14 * scale, 0.08 * scale), bootMat);
  legL.position.set(-0.05 * scale, 0.07 * scale, 0);
  group.add(legL);

  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scale, 0.14 * scale, 0.08 * scale), bootMat);
  legR.position.set(0.05 * scale, 0.07 * scale, 0);
  group.add(legR);

  // 2. Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.22 * scale, 0.14 * scale), tunicMat);
  torso.position.y = 0.24 * scale;
  torso.castShadow = true;
  group.add(torso);

  // 3. Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scale, 0.18 * scale, 0.18 * scale), skinMat);
  head.position.y = 0.44 * scale;
  head.castShadow = true;
  group.add(head);

  // 4. Hat / Helmet / Hair
  const hatColor =
    role === 'priest' || role === 'warrior'
      ? 0xffd166
      : role === 'astro_engineer'
        ? 0xffffff
        : faction === 'hostile'
          ? 0x222222
          : 0x4a3423;
  const hatMat = new THREE.MeshStandardMaterial({
    color: hatColor,
    roughness: 0.4,
    metalness: role === 'warrior' ? 0.6 : 0.1,
  });
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.07 * scale, 0.2 * scale), hatMat);
  hat.position.y = 0.55 * scale;
  group.add(hat);

  // 5. Held Tool / Weapon / Staff
  const toolMat = new THREE.MeshStandardMaterial({
    color: role === 'priest' || role === 'scholar' ? 0xf5b742 : 0xadb5bd,
    metalness: 0.6,
    roughness: 0.3,
  });
  const tool = new THREE.Mesh(new THREE.BoxGeometry(0.05 * scale, 0.28 * scale, 0.05 * scale), toolMat);
  tool.position.set(0.14 * scale, 0.28 * scale, 0.08 * scale);
  tool.rotation.x = 0.35;
  group.add(tool);

  // 6. Status Ring (hidden unless blessed/cursed/frenzied/plagued)
  const auraGeo = new THREE.RingGeometry(0.22, 0.29, 12);
  auraGeo.rotateX(-Math.PI / 2);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xf5b742,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0,
  });
  const auraRing = new THREE.Mesh(auraGeo, auraMat);
  auraRing.position.y = 0.03;
  auraRing.name = 'status_ring';
  group.add(auraRing);

  return group;
}
