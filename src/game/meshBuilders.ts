import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  BuildingType,
  ResourceNodeType,
  SpeciesId,
  TerrainType,
  UnitAgeStage,
  UnitRole,
  VehicleType,
} from './types';

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
    case 'savanna':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('savanna', '#ab964c', '#c9b363', '#827134', 'grass'),
        roughness: 0.85,
        metalness: 0.05,
      });
      break;
    case 'swamp':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('swamp', '#365242', '#4c6e57', '#23382c', 'fertile'),
        roughness: 0.72,
        metalness: 0.08,
      });
      break;
    case 'highland':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('highland', '#5b6e56', '#778767', '#3d4c3e', 'grass'),
        roughness: 0.82,
        metalness: 0.08,
      });
      break;
    case 'snow':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('snow', '#d6e3e8', '#eff6fa', '#a5bac4', 'grass'),
        roughness: 0.68,
        metalness: 0.06,
      });
      break;
    case 'stone_road':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('stone_road', '#a89482', '#c9b49f', '#6e5e50', 'stone'),
        roughness: 0.65,
        metalness: 0.1,
      });
      break;
    case 'rail_track':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('rail_track', '#5a544e', '#cbd5e1', '#3b2e25', 'stone'),
        roughness: 0.72,
        metalness: 0.25,
      });
      break;
    case 'runway':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('runway', '#2b303a', '#f8fafc', '#1e232b', 'stone'),
        roughness: 0.78,
        metalness: 0.12,
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
    case 'jungle':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('jungle', '#225832', '#367a44', '#163e24', 'grass'),
        roughness: 0.84,
        metalness: 0.04,
      });
      break;
    case 'mountain':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('mountain', '#6c747e', '#9aa2ac', '#444a54', 'stone'),
        roughness: 0.78,
        metalness: 0.14,
      });
      break;
    case 'taiga':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('taiga', '#325246', '#486c5c', '#203630', 'grass'),
        roughness: 0.84,
        metalness: 0.05,
      });
      break;
    case 'tundra':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('tundra', '#869490', '#b8c6c4', '#5c6c6e', 'grass'),
        roughness: 0.74,
        metalness: 0.06,
      });
      break;
    case 'badlands':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('badlands', '#b86038', '#da8652', '#864228', 'stone'),
        roughness: 0.84,
        metalness: 0.06,
      });
      break;
    case 'blossom':
      topMat = new THREE.MeshStandardMaterial({
        map: getPixelArtTexture('blossom', '#669c58', '#f6acc8', '#487644', 'grass'),
        roughness: 0.8,
        metalness: 0.04,
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
  m.name = 'contact_shadow';
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

function addJungleTree(
  parts: THREE.BufferGeometry[],
  tx: number,
  tz: number,
  scale: number,
  isPalm: boolean,
) {
  addColoredBox(parts, 0.34 * scale, 0.02, 0.34 * scale, tx, 0.01, tz, 0x13261a);
  if (isPalm) {
    // Curved tropical palm trunk + spreading frond crown + coconuts
    addColoredBox(parts, 0.1 * scale, 0.36 * scale, 0.1 * scale, tx, 0.18 * scale, tz, 0x6e4a2e, 0, 0.08);
    addColoredBox(parts, 0.09 * scale, 0.38 * scale, 0.09 * scale, tx - 0.04 * scale, 0.5 * scale, tz, 0x7d5738, 0, 0.16);
    const cy = 0.68 * scale;
    const cx = tx - 0.08 * scale;
    addColoredBox(parts, 0.56 * scale, 0.07 * scale, 0.14 * scale, cx, cy, tz, 0x2d8a4e);
    addColoredBox(parts, 0.14 * scale, 0.07 * scale, 0.56 * scale, cx, cy, tz, 0x3ba85e);
    addColoredBox(parts, 0.36 * scale, 0.08 * scale, 0.36 * scale, cx, cy + 0.06 * scale, tz, 0x52c46d);
    addColoredBox(parts, 0.08 * scale, 0.08 * scale, 0.08 * scale, cx + 0.07 * scale, cy - 0.06 * scale, tz + 0.06 * scale, 0x593a22);
  } else {
    // Giant rainforest mahogany/kapok buttress trunk + broad layered canopy + hanging vines
    addColoredBox(parts, 0.16 * scale, 0.44 * scale, 0.16 * scale, tx, 0.22 * scale, tz, 0x4f331e);
    addColoredBox(parts, 0.28 * scale, 0.12 * scale, 0.1 * scale, tx, 0.06 * scale, tz, 0x452b18);
    addColoredBox(parts, 0.64 * scale, 0.18 * scale, 0.6 * scale, tx, 0.5 * scale, tz, 0x1e6338);
    addColoredBox(parts, 0.48 * scale, 0.16 * scale, 0.48 * scale, tx + 0.03 * scale, 0.66 * scale, tz - 0.02 * scale, 0x2e854a);
    addColoredBox(parts, 0.3 * scale, 0.12 * scale, 0.3 * scale, tx - 0.02 * scale, 0.78 * scale, tz + 0.02 * scale, 0x4db35f);
    // Hanging liana vines
    addColoredBox(parts, 0.04 * scale, 0.24 * scale, 0.04 * scale, tx + 0.22 * scale, 0.36 * scale, tz + 0.16 * scale, 0x3b8c47);
    addColoredBox(parts, 0.04 * scale, 0.2 * scale, 0.04 * scale, tx - 0.22 * scale, 0.38 * scale, tz - 0.14 * scale, 0x3b8c47);
  }
}

function addTaigaConifer(
  parts: THREE.BufferGeometry[],
  tx: number,
  tz: number,
  scale: number,
  snowTipped: boolean,
) {
  addColoredBox(parts, 0.3 * scale, 0.02, 0.3 * scale, tx, 0.01, tz, 0x182622);
  addColoredBox(parts, 0.11 * scale, 0.26 * scale, 0.11 * scale, tx, 0.13 * scale, tz, 0x4a3121);
  addColoredBox(parts, 0.44 * scale, 0.16 * scale, 0.44 * scale, tx, 0.28 * scale, tz, 0x24473a);
  addColoredBox(parts, 0.34 * scale, 0.18 * scale, 0.34 * scale, tx, 0.44 * scale, tz, 0x2f5c4b);
  addColoredBox(parts, 0.22 * scale, 0.18 * scale, 0.22 * scale, tx, 0.6 * scale, tz, 0x3a705b);
  addColoredBox(
    parts,
    0.12 * scale,
    0.14 * scale,
    0.12 * scale,
    tx,
    0.74 * scale,
    tz,
    snowTipped ? 0xddeef2 : 0x49856e,
  );
  if (snowTipped) {
    addColoredBox(parts, 0.36 * scale, 0.05 * scale, 0.36 * scale, tx, 0.54 * scale, tz, 0xd4e6eb);
  }
}

function addSakuraTree(
  parts: THREE.BufferGeometry[],
  tx: number,
  tz: number,
  scale: number,
) {
  addColoredBox(parts, 0.32 * scale, 0.02, 0.32 * scale, tx, 0.01, tz, 0x292428);
  addColoredBox(parts, 0.12 * scale, 0.3 * scale, 0.12 * scale, tx, 0.15 * scale, tz, 0x4a3235);
  addColoredBox(parts, 0.48 * scale, 0.18 * scale, 0.46 * scale, tx, 0.36 * scale, tz, 0xe87ea8);
  addColoredBox(parts, 0.38 * scale, 0.16 * scale, 0.38 * scale, tx + 0.04 * scale, 0.51 * scale, tz - 0.03 * scale, 0xf7a8c6);
  addColoredBox(parts, 0.24 * scale, 0.13 * scale, 0.24 * scale, tx - 0.03 * scale, 0.63 * scale, tz + 0.02 * scale, 0xffd6e6);
}

export interface NodeVariantLibrary {
  timber: THREE.BufferGeometry[];
  timberJungle: THREE.BufferGeometry[];
  timberTaiga: THREE.BufferGeometry[];
  timberBlossom: THREE.BufferGeometry[];
  berry: THREE.BufferGeometry[];
  farmCrop: THREE.BufferGeometry[];
  sciFiFarm: THREE.BufferGeometry[];
  stone: THREE.BufferGeometry[];
  ore: THREE.BufferGeometry[];
  crystal: THREE.BufferGeometry[];
  ambientGrass: THREE.BufferGeometry[];
  ambientForest: THREE.BufferGeometry[];
  ambientJungle: THREE.BufferGeometry[];
  ambientMountain: THREE.BufferGeometry[];
  ambientTaiga: THREE.BufferGeometry[];
  ambientTundra: THREE.BufferGeometry[];
  ambientBadlands: THREE.BufferGeometry[];
  ambientBlossom: THREE.BufferGeometry[];
  ambientSand: THREE.BufferGeometry[];
  ambientRock: THREE.BufferGeometry[];
  ambientSnow: THREE.BufferGeometry[];
  ambientSavanna: THREE.BufferGeometry[];
  ambientSwamp: THREE.BufferGeometry[];
  ambientHighland: THREE.BufferGeometry[];
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

  // 2. Berry & Flora Bush variants (Prehistoric wild foraging shrubs)
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

  // 2b. Cultivated Agricultural Farm Fields (Bronze -> Industrial Ages: plowed furrows, golden wheat rows & wooden fence)
  const farmCrop: THREE.BufferGeometry[] = [];
  for (let v = 0; v < 4; v++) {
    const p: THREE.BufferGeometry[] = [];
    // Plowed dark-earth ridges & golden wheat crop rows
    for (let r = -1; r <= 1; r++) {
      const rz = r * 0.24;
      addColoredBox(p, 0.72, 0.05, 0.12, 0, 0.025, rz, 0x5c3e26);
      const wheatHeight = 0.18 + ((v + r + 2) % 3) * 0.04;
      const wheatColor = (v + r) % 2 === 0 ? 0xe9b44c : 0xdba13a;
      addColoredBox(p, 0.66, wheatHeight, 0.08, 0, 0.05 + wheatHeight * 0.5, rz, wheatColor);
    }
    // Corner wooden fence posts & side rail
    addColoredBox(p, 0.06, 0.22, 0.06, -0.38, 0.11, -0.38, 0x6b442a);
    addColoredBox(p, 0.06, 0.22, 0.06, 0.38, 0.11, -0.38, 0x6b442a);
    addColoredBox(p, 0.78, 0.04, 0.04, 0, 0.16, -0.38, 0x855839);
    if (v % 2 === 0) {
      // Harvest pumpkin / grain bale
      addColoredBox(p, 0.14, 0.14, 0.14, 0.32, 0.07, 0.32, 0xe07a2b);
    } else {
      // Wooden water trough
      addColoredBox(p, 0.22, 0.1, 0.12, -0.28, 0.05, 0.34, 0x4ea8de);
    }
    farmCrop.push(finalizeMergedParts(p));
  }

  // 2c. Techno-Modern Sci-Fi Hydroponic Bio-Domes (Atomic -> Orbital & Interstellar Ages)
  const sciFiFarm: THREE.BufferGeometry[] = [];
  for (let v = 0; v < 4; v++) {
    const p: THREE.BufferGeometry[] = [];
    // Sleek dark titanium hydroponic tray base
    addColoredBox(p, 0.82, 0.06, 0.82, 0, 0.03, 0, 0x263238);
    // White titanium raised planter rims
    addColoredBox(p, 0.76, 0.08, 0.22, 0, 0.07, -0.2, 0xd8dee9);
    addColoredBox(p, 0.76, 0.08, 0.22, 0, 0.07, 0.2, 0xd8dee9);
    // Glowing cyan & bioluminescent emerald engineered crops
    addColoredBox(p, 0.68, 0.14, 0.14, 0, 0.15, -0.2, v % 2 === 0 ? 0x52b788 : 0x64dfdf);
    addColoredBox(p, 0.68, 0.14, 0.14, 0, 0.15, 0.2, v % 2 === 0 ? 0x64dfdf : 0x80ed99);
    // Central glowing cyan nutrient conduit strip
    addColoredBox(p, 0.78, 0.04, 0.08, 0, 0.07, 0, 0x48bfe3);
    // Translucent-style cyan geodesic bio-dome arches over the crops
    addColoredBox(p, 0.05, 0.28, 0.78, -0.34, 0.18, 0, 0x56cfe1);
    addColoredBox(p, 0.05, 0.28, 0.78, 0.34, 0.18, 0, 0x56cfe1);
    addColoredBox(p, 0.74, 0.05, 0.18, 0, 0.31, 0, 0xeceff4);
    sciFiFarm.push(finalizeMergedParts(p));
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
  {
    // Desert cactus & sandstone pebbles
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.09, 0.28, 0.09, -0.16, 0.14, -0.14, 0x528246);
    addColoredBox(p, 0.12, 0.07, 0.07, -0.1, 0.18, -0.14, 0x528246);
    addColoredBox(p, 0.08, 0.12, 0.08, 0.2, 0.06, 0.18, 0xa8926d);
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

  const ambientSnow: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.22, 0.08, 0.2, -0.12, 0.04, -0.1, 0xe8f2f5);
    addColoredBox(p, 0.14, 0.1, 0.14, 0.18, 0.05, 0.16, 0x89a1ab);
    ambientSnow.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.12, 0.18, 0.12, -0.18, 0.09, 0.14, 0x7bc9d9); // ice crystal shard
    addColoredBox(p, 0.16, 0.06, 0.16, 0.16, 0.03, -0.16, 0xc7dce3);
    ambientSnow.push(finalizeMergedParts(p));
  }

  const ambientSavanna: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.09, 0.15, 0.09, -0.18, 0.075, -0.14, 0xc9af53);
    addColoredBox(p, 0.08, 0.12, 0.08, 0.18, 0.06, 0.18, 0xb89c42);
    addColoredBox(p, 0.12, 0.07, 0.12, -0.14, 0.035, 0.2, 0x87765a);
    ambientSavanna.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.18, 0.12, 0.18, 0.14, 0.06, -0.14, 0x7b8c42); // dry scrub bush
    addColoredBox(p, 0.08, 0.1, 0.08, -0.2, 0.05, 0.12, 0xd4bb63);
    ambientSavanna.push(finalizeMergedParts(p));
  }

  const ambientSwamp: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.05, 0.2, 0.05, -0.18, 0.1, -0.16, 0x4b7043); // cattail reed
    addColoredBox(p, 0.07, 0.07, 0.07, -0.18, 0.2, -0.16, 0x5c3e28);
    addColoredBox(p, 0.16, 0.03, 0.16, 0.16, 0.015, 0.16, 0x5d8a55); // lily pad
    ambientSwamp.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.14, 0.08, 0.14, -0.14, 0.04, 0.18, 0x3b5e43);
    addColoredBox(p, 0.07, 0.09, 0.07, 0.2, 0.045, -0.14, 0x8bc98d); // glow moss cap
    ambientSwamp.push(finalizeMergedParts(p));
  }

  const ambientHighland: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.14, 0.09, 0.14, -0.18, 0.045, -0.14, 0x6b7d5e);
    addColoredBox(p, 0.08, 0.08, 0.08, 0.18, 0.04, 0.16, 0x9b6b9e); // purple heather
    addColoredBox(p, 0.1, 0.07, 0.1, 0.14, 0.035, -0.18, 0x667073);
    ambientHighland.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.16, 0.1, 0.14, 0.16, 0.05, -0.12, 0x5d676b);
    addColoredBox(p, 0.1, 0.08, 0.1, -0.2, 0.04, 0.18, 0x87628a);
    ambientHighland.push(finalizeMergedParts(p));
  }

  // 6b. Biome-specific Timber Groves (Jungle Palms/Mahogany, Taiga Conifers, Sakura Blossoms)
  const timberJungle: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addJungleTree(p, -0.14, -0.1, 1.18, false);
    addJungleTree(p, 0.22, 0.18, 0.88, true);
    timberJungle.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addJungleTree(p, 0.14, -0.16, 1.08, true);
    addJungleTree(p, -0.2, 0.16, 1.02, false);
    addColoredBox(p, 0.18, 0.12, 0.18, 0.16, 0.06, 0.22, 0x267342);
    timberJungle.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addJungleTree(p, 0.0, 0.0, 1.32, false);
    addJungleTree(p, -0.26, 0.22, 0.68, true);
    timberJungle.push(finalizeMergedParts(p));
  }

  const timberTaiga: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addTaigaConifer(p, -0.16, -0.14, 1.12, true);
    addTaigaConifer(p, 0.2, 0.16, 0.86, false);
    timberTaiga.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addTaigaConifer(p, -0.18, 0.14, 0.94, true);
    addTaigaConifer(p, 0.18, -0.16, 1.02, true);
    addTaigaConifer(p, 0.06, 0.24, 0.72, false);
    timberTaiga.push(finalizeMergedParts(p));
  }

  const timberBlossom: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addSakuraTree(p, -0.14, -0.12, 1.14);
    addSakuraTree(p, 0.22, 0.18, 0.82);
    timberBlossom.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addSakuraTree(p, 0.02, 0.0, 1.25);
    addColoredBox(p, 0.14, 0.04, 0.14, -0.24, 0.02, 0.22, 0xf7a8c6);
    timberBlossom.push(finalizeMergedParts(p));
  }

  // 6c. New Biome Ambient Ground Props (Mountain spires, Jungle ferns/orchids, Taiga snow shrubs, Tundra ice, Badlands hoodoos, Blossom petals)
  const ambientJungle: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.24, 0.12, 0.24, -0.14, 0.06, -0.12, 0x2a7d46);
    addColoredBox(p, 0.16, 0.18, 0.16, 0.18, 0.09, 0.16, 0x3b9e56);
    addColoredBox(p, 0.08, 0.08, 0.08, 0.18, 0.2, 0.16, 0xf26444); // tropical flower
    ambientJungle.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.28, 0.08, 0.1, 0.0, 0.04, 0.12, 0x4f331e, 0.6); // mossy log
    addColoredBox(p, 0.2, 0.14, 0.2, -0.18, 0.07, -0.16, 0x1e6338);
    addColoredBox(p, 0.07, 0.07, 0.07, -0.16, 0.16, -0.14, 0xf5c542);
    ambientJungle.push(finalizeMergedParts(p));
  }

  const ambientMountain: THREE.BufferGeometry[] = [];
  {
    // Jagged craggy alpine granite spire + snow-dusted ledge
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.42, 0.34, 0.38, -0.06, 0.17, -0.04, 0x5c636e);
    addColoredBox(p, 0.28, 0.56, 0.26, 0.04, 0.28, 0.04, 0x767f8c);
    addColoredBox(p, 0.16, 0.72, 0.16, 0.06, 0.36, 0.02, 0x9aa4b2);
    addColoredBox(p, 0.18, 0.1, 0.18, 0.06, 0.74, 0.02, 0xe8f1f5);
    ambientMountain.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.32, 0.46, 0.32, -0.12, 0.23, 0.08, 0x68707d, 0.3);
    addColoredBox(p, 0.24, 0.3, 0.24, 0.18, 0.15, -0.14, 0x828b99);
    addColoredBox(p, 0.22, 0.08, 0.22, -0.12, 0.48, 0.08, 0xdde8ed);
    ambientMountain.push(finalizeMergedParts(p));
  }

  const ambientTaiga: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.18, 0.14, 0.18, -0.16, 0.07, -0.14, 0x2f5c4b);
    addColoredBox(p, 0.18, 0.05, 0.18, -0.16, 0.16, -0.14, 0xd8ebef);
    addColoredBox(p, 0.12, 0.08, 0.12, 0.18, 0.04, 0.18, 0x6f7a7e);
    ambientTaiga.push(finalizeMergedParts(p));
  }

  const ambientTundra: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.14, 0.24, 0.14, -0.16, 0.12, 0.12, 0x89d6e3, 0.4);
    addColoredBox(p, 0.2, 0.08, 0.18, 0.14, 0.04, -0.12, 0xc7dce3);
    ambientTundra.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.22, 0.14, 0.2, -0.08, 0.07, -0.1, 0x708084);
    addColoredBox(p, 0.2, 0.05, 0.18, -0.08, 0.16, -0.1, 0xe8f2f5);
    ambientTundra.push(finalizeMergedParts(p));
  }

  const ambientBadlands: THREE.BufferGeometry[] = [];
  {
    // Stepped terracotta sandstone hoodoo & desert scrub
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.3, 0.28, 0.28, -0.08, 0.14, -0.06, 0xb85c38);
    addColoredBox(p, 0.22, 0.24, 0.22, -0.08, 0.36, -0.06, 0xd97d48);
    addColoredBox(p, 0.26, 0.08, 0.26, -0.08, 0.5, -0.06, 0xe8a064);
    addColoredBox(p, 0.1, 0.09, 0.1, 0.22, 0.045, 0.2, 0x7a8544);
    ambientBadlands.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.2, 0.42, 0.2, 0.12, 0.21, -0.1, 0xa85030);
    addColoredBox(p, 0.16, 0.12, 0.16, -0.18, 0.06, 0.16, 0xd47644);
    ambientBadlands.push(finalizeMergedParts(p));
  }

  const ambientBlossom: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.16, 0.04, 0.16, -0.16, 0.02, 0.14, 0xf7a8c6);
    addColoredBox(p, 0.12, 0.04, 0.12, 0.18, 0.02, -0.16, 0xffd6e6);
    addColoredBox(p, 0.12, 0.14, 0.12, 0.16, 0.07, 0.18, 0x747b7e);
    addColoredBox(p, 0.08, 0.07, 0.08, 0.16, 0.17, 0.18, 0xffd166); // garden stone lantern
    ambientBlossom.push(finalizeMergedParts(p));
  }

  cachedVariantLib = {
    timber,
    timberJungle,
    timberTaiga,
    timberBlossom,
    berry,
    farmCrop,
    sciFiFarm,
    stone,
    ore,
    crystal,
    ambientGrass,
    ambientForest,
    ambientJungle,
    ambientMountain,
    ambientTaiga,
    ambientTundra,
    ambientBadlands,
    ambientBlossom,
    ambientSand,
    ambientRock,
    ambientSnow,
    ambientSavanna,
    ambientSwamp,
    ambientHighland,
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

let sharedBuildingMats: Record<string, THREE.MeshStandardMaterial> | null = null;

function getBuildingMaterials(): Record<string, THREE.MeshStandardMaterial> {
  if (sharedBuildingMats) return sharedBuildingMats;

  sharedBuildingMats = {
    mudEarthMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_mud_earth', '#6b4c35', '#856147', '#4d3523', 'wood'),
      roughness: 0.92,
    }),
    stickWoodMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_stick_wood', '#4a301c', '#634127', '#332012', 'wood'),
      roughness: 0.88,
    }),
    thatchMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_thatch_straw', '#cfa657', '#e3bd6f', '#9c7834', 'roof'),
      roughness: 0.85,
    }),
    goldenRoofMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_roof_gold_straw', '#eec643', '#f7d969', '#c99b26', 'roof'),
      roughness: 0.72,
    }),
    whitePlasterMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_white_plaster', '#f0ede6', '#faf8f5', '#d0cbc0', 'stone'),
      roughness: 0.74,
    }),
    marbleWhiteMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_marble_white', '#e8ebed', '#f7f9fa', '#bdc3c7', 'stone'),
      roughness: 0.58,
    }),
    tanPlasterMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_tan_plaster', '#dcc59a', '#ebd8b2', '#b3986b', 'stone'),
      roughness: 0.78,
    }),
    adobeMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_adobe_clay', '#b5895a', '#cfa372', '#87623a', 'stone'),
      roughness: 0.82,
    }),
    stoneMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_stone', '#8c9296', '#a8afb3', '#616669', 'stone'),
      roughness: 0.75,
    }),
    darkStoneMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_dark_stone', '#42494d', '#586066', '#282d30', 'stone'),
      roughness: 0.72,
    }),
    brickMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_brick_ind', '#9e4238', '#b85348', '#6e2922', 'stone'),
      roughness: 0.72,
    }),
    concreteMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_concrete_mod', '#9aa5b1', '#b4bfc9', '#6e7885', 'stone'),
      roughness: 0.58,
    }),
    woodMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_wood', '#8a4f28', '#a86438', '#5c3318', 'wood'),
      roughness: 0.8,
    }),
    redRoofMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_roof_red', '#a82e24', '#c93e32', '#731d16', 'roof'),
      roughness: 0.65,
    }),
    blueRoofMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_roof_blue', '#2744a6', '#3b5bdb', '#182b6e', 'roof'),
      roughness: 0.58,
    }),
    greenAwningMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_awning_green', '#3f8f4e', '#5cb86c', '#266132', 'roof'),
      roughness: 0.68,
    }),
    doorDarkMat: new THREE.MeshStandardMaterial({
      color: 0x261a12,
      roughness: 0.9,
    }),
    goldMat: new THREE.MeshStandardMaterial({
      color: 0xe9b44c,
      metalness: 0.68,
      roughness: 0.24,
    }),
    flameMat: new THREE.MeshStandardMaterial({
      color: 0xffb703,
      emissive: 0xfb8500,
      emissiveIntensity: 0.95,
      roughness: 0.2,
    }),
    techMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_tech', '#d8dee9', '#eceff4', '#9aa5b8', 'tech'),
      roughness: 0.3,
      metalness: 0.45,
    }),
    darkTechMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_dark_tech', '#263238', '#37474f', '#172026', 'tech'),
      roughness: 0.35,
      metalness: 0.55,
    }),
    glowCyanMat: new THREE.MeshStandardMaterial({
      color: 0x56cfe1,
      emissive: 0x48bfe3,
      emissiveIntensity: 0.85,
      roughness: 0.18,
    }),
    // --- ELVEN SYLVAN & CELESTIAL MATERIALS ---
    elfBirchMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_elf_birch', '#e6e8dc', '#f5f6ee', '#bcc4b0', 'wood'),
      roughness: 0.7,
    }),
    elfHeartwoodMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_elf_heartwood', '#7a6342', '#997d56', '#524129', 'wood'),
      roughness: 0.78,
    }),
    elfMossStoneMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_elf_mossstone', '#9db5a0', '#b9cfb9', '#6b8570', 'stone'),
      roughness: 0.72,
    }),
    elfLeafRoofMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_elf_leaf_roof', '#3d7d47', '#5ca665', '#25522d', 'roof'),
      roughness: 0.76,
    }),
    elfJadeRoofMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_elf_jade_roof', '#20786c', '#36a694', '#134d45', 'roof'),
      roughness: 0.45,
      metalness: 0.18,
    }),
    elfVerdigrisMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_elf_verdigris', '#429e86', '#64bfa6', '#286b59', 'tech'),
      roughness: 0.38,
      metalness: 0.35,
    }),
    elfPearlTechMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_elf_pearl_tech', '#eaf5f0', '#ffffff', '#b8d6ca', 'tech'),
      roughness: 0.25,
      metalness: 0.4,
    }),
    elfAquaGlowMat: new THREE.MeshStandardMaterial({
      color: 0x52f2c8,
      emissive: 0x2ec4b6,
      emissiveIntensity: 0.9,
      roughness: 0.16,
    }),
    // --- ORCISH BASTION, IRON & MAGMA MATERIALS ---
    orcHideMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_orc_hide', '#7a4d32', '#996444', '#4f2f1c', 'wood'),
      roughness: 0.9,
    }),
    orcCharredLogMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_orc_charred_log', '#3b261b', '#523627', '#24160f', 'wood'),
      roughness: 0.88,
    }),
    orcBasaltMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_orc_basalt', '#42454d', '#5a5f69', '#27292e', 'stone'),
      roughness: 0.82,
    }),
    orcCrimsonMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_orc_crimson', '#8a231e', '#b3342c', '#57120e', 'roof'),
      roughness: 0.72,
    }),
    orcIronMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_orc_iron', '#59514b', '#756a62', '#38322e', 'tech'),
      roughness: 0.48,
      metalness: 0.62,
    }),
    orcGunmetalMat: new THREE.MeshStandardMaterial({
      map: getPixelArtTexture('bld_orc_gunmetal', '#27252b', '#3a3740', '#16141a', 'tech'),
      roughness: 0.34,
      metalness: 0.74,
    }),
    orcBoneMat: new THREE.MeshStandardMaterial({
      color: 0xded4bf,
      roughness: 0.62,
      metalness: 0.06,
    }),
    orcMagmaGlowMat: new THREE.MeshStandardMaterial({
      color: 0xff5421,
      emissive: 0xe63200,
      emissiveIntensity: 0.95,
      roughness: 0.18,
    }),
  };
  return sharedBuildingMats;
}

export function createBuildingGroup(
  type: BuildingType,
  epochIndex: number,
  variantSeed = 0,
  species: SpeciesId = 'human',
): THREE.Group {
  const group = new THREE.Group();
  const isMonumental =
    type === 'ziggurat' ||
    type === 'launch_arcology' ||
    type === 'dyson_spire' ||
    type === 'airport' ||
    type === 'rail_station' ||
    (type === 'bonfire' && epochIndex >= 2);
  group.add(createContactShadow(isMonumental ? 1.28 : 0.92));

  const variant = Math.abs(variantSeed) % 4;
  const M = getBuildingMaterials();

  const {
    mudEarthMat,
    stickWoodMat,
    thatchMat,
    goldenRoofMat,
    whitePlasterMat,
    marbleWhiteMat,
    tanPlasterMat,
    adobeMat,
    stoneMat,
    darkStoneMat,
    brickMat,
    concreteMat,
    woodMat,
    redRoofMat,
    blueRoofMat,
    greenAwningMat,
    doorDarkMat,
    goldMat,
    flameMat,
    techMat,
    darkTechMat,
    glowCyanMat,
    elfBirchMat,
    elfHeartwoodMat,
    elfMossStoneMat,
    elfLeafRoofMat,
    elfJadeRoofMat,
    elfVerdigrisMat,
    elfPearlTechMat,
    elfAquaGlowMat,
    orcHideMat,
    orcCharredLogMat,
    orcBasaltMat,
    orcCrimsonMat,
    orcIronMat,
    orcGunmetalMat,
    orcBoneMat,
    orcMagmaGlowMat,
  } = M;

  const isElf = species === 'elf';
  const isOrc = species === 'orc';
  const raceGlowMat = isElf ? elfAquaGlowMat : isOrc ? orcMagmaGlowMat : glowCyanMat;
  const raceTechWallMat = isElf ? elfPearlTechMat : isOrc ? orcGunmetalMat : techMat;
  const raceTechTrimMat = isElf ? elfJadeRoofMat : isOrc ? orcIronMat : darkTechMat;
  const raceAccentMat = isElf ? goldMat : isOrc ? orcCrimsonMat : goldMat;

  // Helper: Builds a multi-layer stair-stepped voxel pitched gable roof with solid stepped gable walls
  const addSteppedGableRoof = (
    cx: number,
    baseY: number,
    cz: number,
    spanW: number,
    lengthD: number,
    layers: number,
    layerH: number,
    roofMaterial: THREE.Material,
    gableWallMat: THREE.Material,
    ridgeAlongZ = true,
  ) => {
    for (let i = 0; i < layers; i++) {
      const frac = 1 - (i / layers) * 0.78;
      const curSpan = spanW * frac;
      const y = baseY + i * layerH + layerH * 0.5;

      const slabW = ridgeAlongZ ? curSpan : lengthD + 0.06;
      const slabD = ridgeAlongZ ? lengthD + 0.06 : curSpan;
      const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(slabW, layerH, slabD), roofMaterial);
      roofSlab.position.set(cx, y, cz);
      roofSlab.castShadow = true;
      roofSlab.receiveShadow = true;
      group.add(roofSlab);

      // Solid stepped gable wall infill underneath the eaves on both ends
      if (i < layers - 1) {
        const gableSpan = Math.max(0.08, curSpan - 0.08);
        const gW = ridgeAlongZ ? gableSpan : lengthD * 0.92;
        const gD = ridgeAlongZ ? lengthD * 0.92 : gableSpan;
        const gableFill = new THREE.Mesh(new THREE.BoxGeometry(gW, layerH, gD), gableWallMat);
        gableFill.position.set(cx, y - layerH * 0.15, cz);
        group.add(gableFill);
      }
    }
  };

  // Helper: Builds a complete stepped-voxel cottage / house (walls, stepped gable roof, door, windows, chimney)
  const addVoxelCottage = (opts: {
    cx?: number;
    cz?: number;
    w: number;
    h: number;
    d: number;
    wallMat: THREE.Material;
    roofMat: THREE.Material;
    chimneyMat?: THREE.Material;
    chimneySide?: 'left' | 'right' | 'front_right' | 'none';
    ridgeAlongZ?: boolean;
    timberTrim?: boolean;
  }) => {
    const cx = opts.cx ?? 0;
    const cz = opts.cz ?? 0;
    const { w, h, d, wallMat, roofMat } = opts;
    const ridgeAlongZ = opts.ridgeAlongZ ?? false;

    const trimMat =
      epochIndex >= 6 ? raceTechTrimMat : isOrc ? orcBasaltMat : isElf ? elfMossStoneMat : epochIndex >= 3 ? darkStoneMat : stoneMat;
    const foundation = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.05, d + 0.04), trimMat);
    foundation.position.set(cx, 0.025, cz);
    foundation.receiveShadow = true;
    group.add(foundation);

    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    walls.position.set(cx, 0.05 + h * 0.5, cz);
    walls.castShadow = true;
    walls.receiveShadow = true;
    group.add(walls);

    if (opts.timberTrim) {
      const postCorners = [
        [-w * 0.5, -d * 0.5],
        [w * 0.5, -d * 0.5],
        [-w * 0.5, d * 0.5],
        [w * 0.5, d * 0.5],
      ];
      const postMat = isOrc ? orcCharredLogMat : isElf ? elfHeartwoodMat : stickWoodMat;
      for (const [px, pz] of postCorners) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, h + 0.02, 0.055), postMat);
        post.position.set(cx + px, 0.05 + h * 0.5, cz + pz);
        group.add(post);
      }
    }

    const windowMat = epochIndex >= 6 ? raceGlowMat : isOrc ? orcMagmaGlowMat : doorDarkMat;
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.19, 0.03),
      epochIndex >= 6 ? raceGlowMat : doorDarkMat,
    );
    door.position.set(cx - w * 0.12, 0.145, cz + d * 0.5 + 0.008);
    group.add(door);

    const winFront = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.03), windowMat);
    winFront.position.set(cx + w * 0.2, 0.22, cz + d * 0.5 + 0.008);
    group.add(winFront);

    const winSide = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.09), windowMat);
    winSide.position.set(cx + w * 0.5 + 0.008, 0.22, cz);
    group.add(winSide);

    const eaveW = ridgeAlongZ ? w + 0.12 : w + 0.08;
    const eaveD = ridgeAlongZ ? d + 0.08 : d + 0.12;
    addSteppedGableRoof(
      cx,
      0.05 + h,
      cz,
      ridgeAlongZ ? eaveW : eaveD,
      ridgeAlongZ ? eaveD : eaveW,
      5,
      0.062,
      roofMat,
      wallMat,
      ridgeAlongZ,
    );

    if (opts.chimneySide && opts.chimneySide !== 'none') {
      const cMat = opts.chimneyMat ?? whitePlasterMat;
      const chH = h + 0.34;
      const chX =
        opts.chimneySide === 'left'
          ? cx - w * 0.34
          : opts.chimneySide === 'right'
            ? cx + w * 0.34
            : cx + w * 0.22;
      const chZ = opts.chimneySide === 'front_right' ? cz + d * 0.46 : cz - d * 0.12;
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.11, chH, 0.11), cMat);
      chimney.position.set(chX, 0.05 + chH * 0.5, chZ);
      chimney.castShadow = true;
      group.add(chimney);

      const flue = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.13), darkStoneMat);
      flue.position.set(chX, 0.05 + chH + 0.02, chZ);
      group.add(flue);
    }
  };

  // Helper (ELVES): Graceful Sylvan Octagonal Pavilion / Swept-Eave Pagoda with Gilded Finial
  const addElfPagodaPavilion = (opts: {
    cx?: number;
    cz?: number;
    radius: number;
    h: number;
    wallMat: THREE.Material;
    roofMat: THREE.Material;
    tiers?: number;
    glowTrim?: boolean;
  }) => {
    const cx = opts.cx ?? 0;
    const cz = opts.cz ?? 0;
    const { radius, h, wallMat, roofMat } = opts;
    const tiers = opts.tiers ?? 1;

    // Moss-marble octagonal plinth
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(radius + 0.06, radius + 0.09, 0.06, 8),
      epochIndex >= 6 ? elfJadeRoofMat : elfMossStoneMat,
    );
    plinth.position.set(cx, 0.03, cz);
    plinth.receiveShadow = true;
    group.add(plinth);

    let curY = 0.06;
    for (let t = 0; t < tiers; t++) {
      const tScale = 1 - t * 0.24;
      const r = radius * tScale;
      const th = h * (t === 0 ? 1 : 0.72);

      const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, th, 8), wallMat);
      body.position.set(cx, curY + th * 0.5, cz);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // 4 Delicate Corner Timber/Gold Colonnettes
      for (let c = 0; c < 4; c++) {
        const a = (c / 4) * Math.PI * 2 + Math.PI / 4;
        const col = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, th + 0.02, 0.04),
          epochIndex >= 6 ? elfAquaGlowMat : elfHeartwoodMat,
        );
        col.position.set(cx + Math.cos(a) * r * 0.95, curY + th * 0.5, cz + Math.sin(a) * r * 0.95);
        group.add(col);
      }

      if (t === 0) {
        // Luminous arched doorway on front +Z
        const archDoor = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, Math.min(0.22, th * 0.68), 0.04),
          opts.glowTrim || epochIndex >= 6 ? elfAquaGlowMat : elfHeartwoodMat,
        );
        archDoor.position.set(cx, curY + Math.min(0.11, th * 0.34), cz + r * 0.96);
        group.add(archDoor);
      }

      // Flared upturned canopy eaves + tapered leaf cone roof
      const eaveFlare = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.78, r * 1.38, 0.08, 8),
        roofMat,
      );
      eaveFlare.position.set(cx, curY + th + 0.04, cz);
      eaveFlare.castShadow = true;
      group.add(eaveFlare);

      const coneH = 0.22 * tScale;
      const roofCone = new THREE.Mesh(
        new THREE.ConeGeometry(r * 0.92, coneH, 8),
        roofMat,
      );
      roofCone.position.set(cx, curY + th + 0.08 + coneH * 0.5, cz);
      roofCone.castShadow = true;
      group.add(roofCone);

      curY += th + 0.14;
    }

    // Golden / Starlight Spire Finial
    const finial = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.22, 6),
      epochIndex >= 6 ? elfAquaGlowMat : goldMat,
    );
    finial.position.set(cx, curY + 0.16, cz);
    group.add(finial);
  };

  // Helper (ORCS): Rugged Spiked Bastion Hut / Longhouse with Jutting Corner Tusks & War-Banner
  const addOrcBastionHut = (opts: {
    cx?: number;
    cz?: number;
    w: number;
    h: number;
    d: number;
    wallMat: THREE.Material;
    roofMat: THREE.Material;
    tuskMat?: THREE.Material;
    withBanner?: boolean;
  }) => {
    const cx = opts.cx ?? 0;
    const cz = opts.cz ?? 0;
    const { w, h, d, wallMat, roofMat } = opts;
    const tuskMat = opts.tuskMat ?? orcBoneMat;

    // Thick basalt / iron plinth
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.1, 0.07, d + 0.1),
      epochIndex >= 6 ? orcGunmetalMat : orcBasaltMat,
    );
    plinth.position.set(cx, 0.035, cz);
    plinth.receiveShadow = true;
    group.add(plinth);

    // Armored battered bastion body
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.set(cx, 0.07 + h * 0.5, cz);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Corner armored ribs / log buttresses
    for (const [sx, sz] of [
      [-w * 0.48, -d * 0.48],
      [w * 0.48, -d * 0.48],
      [-w * 0.48, d * 0.48],
      [w * 0.48, d * 0.48],
    ]) {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.085, h + 0.08, 0.085),
        epochIndex >= 3 ? orcIronMat : orcCharredLogMat,
      );
      rib.position.set(cx + sx, 0.07 + h * 0.5, cz + sz);
      rib.castShadow = true;
      group.add(rib);
    }

    // Iron-banded doorway & fiery slit window
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.21, 0.04), doorDarkMat);
    door.position.set(cx, 0.175, cz + d * 0.5 + 0.012);
    group.add(door);

    const slitWin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.035), orcMagmaGlowMat);
    slitWin.position.set(cx, 0.07 + h * 0.72, cz + d * 0.5 + 0.012);
    group.add(slitWin);

    // Heavy pitched roof slabs
    addSteppedGableRoof(cx, 0.07 + h, cz, d + 0.12, w + 0.08, 4, 0.075, roofMat, wallMat, false);

    // Signature Diagonal Jutting Tusks / Iron Horns above the eaves
    const tuskOffsets = [
      [-w * 0.34, d * 0.34, 0.42, 0.28],
      [w * 0.34, d * 0.34, -0.42, 0.28],
      [-w * 0.34, -d * 0.34, 0.42, -0.28],
      [w * 0.34, -d * 0.34, -0.42, -0.28],
    ];
    for (const [tx, tz, rz, rx] of tuskOffsets) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.26, 5), tuskMat);
      tusk.position.set(cx + tx, 0.1 + h + 0.18, cz + tz);
      tusk.rotation.z = rz;
      tusk.rotation.x = rx;
      tusk.castShadow = true;
      group.add(tusk);
    }

    if (opts.withBanner) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.44, 0.035), orcIronMat);
      pole.position.set(cx + w * 0.38, 0.07 + h + 0.24, cz + d * 0.36);
      group.add(pole);

      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.02), orcCrimsonMat);
      cloth.position.set(cx + w * 0.44, 0.07 + h + 0.34, cz + d * 0.36);
      group.add(cloth);
    }
  };

  switch (type) {
    case 'bonfire':
    case 'ziggurat': {
      if (isElf) {
        if (type === 'bonfire' && epochIndex === 0) {
          // Elven Ep 0: Moss-ringed willow arbor with emerald spirit flame
          const mossRing = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.06, 8), elfMossStoneMat);
          mossRing.position.y = 0.03;
          group.add(mossRing);

          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + 0.2;
            const bough = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.62, 0.045), elfHeartwoodMat);
            bough.position.set(Math.cos(a) * 0.22, 0.32, Math.sin(a) * 0.22);
            bough.rotation.z = -Math.cos(a) * 0.38;
            bough.rotation.x = Math.sin(a) * 0.38;
            bough.castShadow = true;
            group.add(bough);
          }

          const leafCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.28, 0.14, 8), elfLeafRoofMat);
          leafCrown.position.y = 0.62;
          group.add(leafCrown);

          const spiritFire = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), elfAquaGlowMat);
          spiritFire.position.y = 0.28;
          spiritFire.name = 'flicker_flame';
          group.add(spiritFire);
        } else if (type === 'bonfire' && epochIndex === 1) {
          // Elven Ep 1: Crescent Birch & Moonstone Sanctuary Ring
          const dais = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.12, 8), elfMossStoneMat);
          dais.position.y = 0.06;
          group.add(dais);

          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const arch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.08), elfBirchMat);
            arch.position.set(Math.cos(a) * 0.26, 0.34, Math.sin(a) * 0.26);
            arch.castShadow = true;
            group.add(arch);
          }

          const halo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 6, 12), elfJadeRoofMat);
          halo.position.y = 0.56;
          halo.rotation.x = Math.PI / 2;
          group.add(halo);

          const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), goldMat);
          flame.position.y = 0.3;
          flame.name = 'flicker_flame';
          group.add(flame);
        } else {
          // Elven Ep 2+: Grand Celestial Starwell Moon Sanctuary (Tall Jade-and-Pearl Pagoda Spire + Moon Rings)
          const isSciFi = epochIndex >= 6;
          const daisMat = isSciFi ? elfPearlTechMat : elfMossStoneMat;
          const bodyMat = isSciFi ? elfPearlTechMat : elfBirchMat;
          const roofMat = isSciFi ? elfJadeRoofMat : epochIndex >= 3 ? elfVerdigrisMat : elfJadeRoofMat;

          const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.12, 8), daisMat);
          tier1.position.y = 0.06;
          tier1.receiveShadow = true;
          group.add(tier1);

          const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.1, 8), roofMat);
          tier2.position.y = 0.17;
          group.add(tier2);

          // 4 Slender Outer Leaf-Fin Buttresses + Lanterns
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.42, 0.09), bodyMat);
            pillar.position.set(Math.cos(a) * 0.32, 0.38, Math.sin(a) * 0.32);
            pillar.castShadow = true;
            group.add(pillar);

            const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), elfAquaGlowMat);
            lantern.position.set(Math.cos(a) * 0.32, 0.64, Math.sin(a) * 0.32);
            lantern.name = 'flicker_flame';
            group.add(lantern);
          }

          // Central Triple-Tiered Celestial Sanctuary Spire
          addElfPagodaPavilion({
            cx: 0,
            cz: 0,
            radius: 0.24,
            h: 0.32,
            wallMat: bodyMat,
            roofMat,
            tiers: 3,
            glowTrim: true,
          });

          const astrolabe = new THREE.Mesh(
            new THREE.TorusGeometry(0.28, 0.03, 6, 16),
            isSciFi ? elfAquaGlowMat : goldMat,
          );
          astrolabe.position.y = 1.12;
          astrolabe.rotation.x = 0.55;
          astrolabe.name = 'spin_part';
          group.add(astrolabe);
        }
        break;
      }

      if (isOrc) {
        if (type === 'bonfire' && epochIndex === 0) {
          // Orc Ep 0: Jagged boulder ring, huge crossed beast-tusks & roaring war-pyre
          const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.5, 0.07, 7), orcBasaltMat);
          pit.position.y = 0.035;
          group.add(pit);

          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + 0.4;
            const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.56, 5), orcBoneMat);
            tusk.position.set(Math.cos(a) * 0.26, 0.28, Math.sin(a) * 0.26);
            tusk.rotation.z = Math.cos(a) * 0.45;
            tusk.rotation.x = -Math.sin(a) * 0.45;
            tusk.castShadow = true;
            group.add(tusk);
          }

          const warFire = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 0.24), orcMagmaGlowMat);
          warFire.position.y = 0.24;
          warFire.name = 'flicker_flame';
          group.add(warFire);
        } else if (type === 'bonfire' && epochIndex === 1) {
          // Orc Ep 1: Stepped basalt dais with 4 angled tusks & crimson war-banners
          const dais = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.14, 0.84), orcBasaltMat);
          dais.position.y = 0.07;
          group.add(dais);

          for (const [cx, cz] of [
            [-0.3, -0.3],
            [0.3, -0.3],
            [-0.3, 0.3],
            [0.3, 0.3],
          ]) {
            const fang = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.52, 5), orcBoneMat);
            fang.position.set(cx, 0.38, cz);
            fang.rotation.z = Math.sign(cx) * 0.28;
            fang.rotation.x = -Math.sign(cz) * 0.28;
            fang.castShadow = true;
            group.add(fang);
          }

          const cauldron = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.26), orcMagmaGlowMat);
          cauldron.position.y = 0.28;
          cauldron.name = 'flicker_flame';
          group.add(cauldron);
        } else {
          // Orc Ep 2+: Obsidian Fang War-Citadel -> Gunmetal Dreadnought Citadel (Ep 6+)
          const isSciFi = epochIndex >= 6;
          const hullMat = isSciFi ? orcGunmetalMat : orcBasaltMat;
          const trimMat = isSciFi ? orcIronMat : orcCrimsonMat;
          const fireMat = orcMagmaGlowMat;

          const tier1 = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.14, 0.96), hullMat);
          tier1.position.y = 0.07;
          tier1.castShadow = true;
          group.add(tier1);

          const tier2 = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.18, 0.76), trimMat);
          tier2.position.y = 0.23;
          tier2.castShadow = true;
          group.add(tier2);

          const keep = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.52, 0.54), hullMat);
          keep.position.y = 0.58;
          keep.castShadow = true;
          group.add(keep);

          // 4 Huge Angled Iron / Bone War-Tusks Bastion Towers
          for (const [tx, tz] of [
            [-0.32, -0.32],
            [0.32, -0.32],
            [-0.32, 0.32],
            [0.32, 0.32],
          ]) {
            const bastion = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.54, 0.18), hullMat);
            bastion.position.set(tx, 0.42, tz);
            bastion.castShadow = true;
            group.add(bastion);

            const horn = new THREE.Mesh(
              new THREE.ConeGeometry(0.08, 0.54, 5),
              isSciFi ? orcIronMat : orcBoneMat,
            );
            horn.position.set(tx * 1.1, 0.88, tz * 1.1);
            horn.rotation.z = -Math.sign(tx) * 0.25;
            horn.rotation.x = Math.sign(tz) * 0.25;
            horn.castShadow = true;
            group.add(horn);
          }

          const magmaCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), fireMat);
          magmaCore.position.y = 0.96;
          magmaCore.name = isSciFi ? 'spin_part' : 'flicker_flame';
          group.add(magmaCore);

          if (isSciFi) {
            const armorRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 5, 8), fireMat);
            armorRing.position.y = 1.04;
            armorRing.rotation.x = Math.PI / 2;
            armorRing.name = 'spin_part';
            group.add(armorRing);
          }
        }
        break;
      }

      // HUMAN: Classic Campfire -> Stone Brazier -> Iconic Twin White Marble Spires -> Twin Titanium Tech Spires
      if (type === 'bonfire' && epochIndex === 0) {
        const earthMound = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.06, 8), mudEarthMat);
        earthMound.position.y = 0.03;
        group.add(earthMound);

        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + 0.3;
          const pole = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.56, 0.05), stickWoodMat);
          pole.position.set(Math.cos(a) * 0.18, 0.3, Math.sin(a) * 0.18);
          pole.rotation.z = -Math.cos(a) * 0.34;
          pole.rotation.x = Math.sin(a) * 0.34;
          pole.castShadow = true;
          group.add(pole);
        }
        const logs1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.1), stickWoodMat);
        logs1.position.y = 0.09;
        logs1.rotation.y = 0.4;
        group.add(logs1);
        const logs2 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.1), woodMat);
        logs2.position.y = 0.11;
        logs2.rotation.y = -0.7;
        group.add(logs2);

        const flameOuter = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), flameMat);
        flameOuter.position.y = 0.26;
        flameOuter.name = 'flicker_flame';
        group.add(flameOuter);

        const flameCore = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), goldMat);
        flameCore.position.y = 0.4;
        group.add(flameCore);
      } else if (type === 'bonfire' && epochIndex === 1) {
        const step1 = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.1, 0.76), darkStoneMat);
        step1.position.y = 0.05;
        group.add(step1);
        const step2 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.56), adobeMat);
        step2.position.y = 0.16;
        group.add(step2);

        for (const [cx, cz] of [
          [-0.26, -0.26],
          [0.26, -0.26],
          [-0.26, 0.26],
          [0.26, 0.26],
        ]) {
          const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.36, 0.11), marbleWhiteMat);
          pillar.position.set(cx, 0.28, cz);
          pillar.castShadow = true;
          group.add(pillar);
        }

        const flameOuter = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.18), flameMat);
        flameOuter.position.y = 0.34;
        flameOuter.name = 'flicker_flame';
        group.add(flameOuter);
      } else {
        const isSciFi = epochIndex >= 6;
        const baseStepMat = isSciFi ? darkTechMat : darkStoneMat;
        const spireMat = isSciFi ? techMat : marbleWhiteMat;
        const brazierFireMat = isSciFi ? glowCyanMat : flameMat;

        const tier1 = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.11, 0.96), baseStepMat);
        tier1.position.y = 0.055;
        tier1.receiveShadow = true;
        tier1.castShadow = true;
        group.add(tier1);

        const tier2 = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.11, 0.78), baseStepMat);
        tier2.position.y = 0.165;
        tier2.receiveShadow = true;
        tier2.castShadow = true;
        group.add(tier2);

        const tier3 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.6), baseStepMat);
        tier3.position.y = 0.27;
        tier3.castShadow = true;
        group.add(tier3);

        for (const [bx, bz] of [
          [-0.36, -0.36],
          [0.36, -0.36],
          [-0.36, 0.36],
          [0.36, 0.36],
        ]) {
          const ped = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), baseStepMat);
          ped.position.set(bx, 0.18, bz);
          ped.castShadow = true;
          group.add(ped);

          const bowl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.12), spireMat);
          bowl.position.set(bx, 0.265, bz);
          group.add(bowl);

          const fire = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.08), brazierFireMat);
          fire.position.set(bx, 0.36, bz);
          fire.name = 'flicker_flame';
          group.add(fire);
        }

        for (const sx of [-0.18, 0.18]) {
          const buttress = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.34), spireMat);
          buttress.position.set(sx + Math.sign(sx) * 0.08, 0.36, 0);
          buttress.castShadow = true;
          group.add(buttress);

          const segWidths = [0.22, 0.2, 0.18, 0.15, 0.12, 0.09];
          const segDepths = [0.3, 0.26, 0.22, 0.18, 0.14, 0.1];
          let curY = 0.32;
          for (let s = 0; s < segWidths.length; s++) {
            const segH = 0.18;
            const seg = new THREE.Mesh(new THREE.BoxGeometry(segWidths[s], segH, segDepths[s]), spireMat);
            const shiftX = sx - Math.sign(sx) * (s * 0.008);
            seg.position.set(shiftX, curY + segH * 0.5, 0);
            seg.castShadow = true;
            seg.receiveShadow = true;
            group.add(seg);
            curY += segH;
          }

          if (isSciFi) {
            const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.92, 0.05), glowCyanMat);
            neonStrip.position.set(sx, 0.82, 0.12);
            group.add(neonStrip);
          }
        }

        const centerFlame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.1), brazierFireMat);
        centerFlame.position.set(0, 0.44, 0);
        centerFlame.name = 'flicker_flame';
        group.add(centerFlame);

        if (isSciFi) {
          const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 6, 12), glowCyanMat);
          haloRing.position.y = 1.15;
          haloRing.rotation.x = Math.PI / 2;
          haloRing.name = 'spin_part';
          group.add(haloRing);
        }
      }
      break;
    }

    case 'forager_hut': {
      if (isElf) {
        if (epochIndex === 0) {
          // Elven Ep 0: Leaf-canopy arbor wigwams & elevated woven tree-bower pods
          addElfPagodaPavilion({
            radius: 0.3,
            h: 0.22,
            wallMat: elfHeartwoodMat,
            roofMat: elfLeafRoofMat,
            tiers: 1,
          });
        } else if (epochIndex <= 2) {
          // Elven Ep 1-2: Sylvan Ivory-Birch & Jade-Roof Pagoda Villas (4 graceful variants)
          addElfPagodaPavilion({
            cx: variant === 2 ? -0.06 : 0,
            cz: variant === 2 ? -0.04 : 0,
            radius: variant === 1 ? 0.34 : 0.31,
            h: variant === 1 ? 0.34 : 0.3,
            wallMat: variant === 3 ? elfMossStoneMat : elfBirchMat,
            roofMat: variant === 3 ? goldMat : elfJadeRoofMat,
            tiers: variant === 1 ? 2 : 1,
            glowTrim: variant === 0,
          });
          if (variant === 2) {
            // Side arched conservatory veranda
            addElfPagodaPavilion({
              cx: 0.22,
              cz: 0.18,
              radius: 0.16,
              h: 0.18,
              wallMat: elfBirchMat,
              roofMat: elfLeafRoofMat,
              tiers: 1,
            });
          }
        } else if (epochIndex <= 4) {
          // Elven Ep 3-4: Botanical Art-Nouveau Glass & Verdigris Houses
          addElfPagodaPavilion({
            radius: 0.34,
            h: 0.36,
            wallMat: epochIndex === 4 ? elfPearlTechMat : elfBirchMat,
            roofMat: elfVerdigrisMat,
            tiers: 2,
            glowTrim: true,
          });
        } else if (epochIndex === 5) {
          // Elven Ep 5 (Info Age): Sylvan Eco-Skyscraper (Tall Pearl & Emerald Curtain-Wall Tower)
          addElfPagodaPavilion({
            radius: 0.35,
            h: 0.36,
            wallMat: elfPearlTechMat,
            roofMat: elfVerdigrisMat,
            tiers: 3,
            glowTrim: true,
          });
        } else {
          // Elven Ep 6+: Pearl-Lotus Orbital Bio-Domes with Glowing Aqua Petals
          addElfPagodaPavilion({
            radius: 0.34,
            h: 0.32,
            wallMat: elfPearlTechMat,
            roofMat: elfJadeRoofMat,
            tiers: 1,
            glowTrim: true,
          });
          const aquaDome = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
            elfAquaGlowMat,
          );
          aquaDome.position.set(0, 0.46, 0);
          group.add(aquaDome);
        }
        break;
      }

      if (isOrc) {
        if (epochIndex === 0) {
          // Orc Ep 0: Animal-Hide War Yurts & Tusk-Braced Lean-Tos
          const earth = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.06, 7), orcBasaltMat);
          earth.position.y = 0.03;
          group.add(earth);

          const yurt = new THREE.Mesh(
            new THREE.CylinderGeometry(0.24, 0.36, 0.26, 7),
            variant % 2 === 0 ? orcHideMat : orcCrimsonMat,
          );
          yurt.position.y = 0.18;
          yurt.castShadow = true;
          group.add(yurt);

          const roof = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.28, 7), orcHideMat);
          roof.position.y = 0.44;
          roof.castShadow = true;
          group.add(roof);

          for (const sx of [-0.22, 0.22]) {
            const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.26, 5), orcBoneMat);
            tusk.position.set(sx, 0.4, 0.22);
            tusk.rotation.z = -Math.sign(sx) * 0.4;
            group.add(tusk);
          }
        } else if (epochIndex <= 2) {
          // Orc Ep 1-2: Basalt & Charred-Log Bastion Longhouses with Jutting Tusks
          addOrcBastionHut({
            w: variant === 1 ? 0.68 : 0.58,
            h: variant === 2 ? 0.34 : 0.29,
            d: 0.48,
            wallMat: variant === 3 ? orcCharredLogMat : orcBasaltMat,
            roofMat: variant % 2 === 0 ? orcCrimsonMat : orcHideMat,
            tuskMat: orcBoneMat,
            withBanner: variant === 1 || variant === 3,
          });
        } else if (epochIndex <= 4) {
          // Orc Ep 3-4: Riveted Rust-Iron Barracks Bunkers & Multi-Story Industrial Housing
          addOrcBastionHut({
            w: 0.64,
            h: epochIndex === 4 ? 0.48 : 0.36,
            d: 0.52,
            wallMat: epochIndex === 4 ? orcGunmetalMat : orcIronMat,
            roofMat: orcCrimsonMat,
            tuskMat: orcIronMat,
            withBanner: true,
          });
        } else if (epochIndex === 5) {
          // Orc Ep 5 (Info Age): Heavy Brutalist Steel High-Rise Arcology Block with Crimson Window Slits
          const towerH = 0.85 + (variant % 3) * 0.24;
          const podium = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.66), orcBasaltMat);
          podium.position.y = 0.09;
          group.add(podium);
          const block = new THREE.Mesh(new THREE.BoxGeometry(0.58, towerH, 0.52), orcGunmetalMat);
          block.position.y = 0.18 + towerH * 0.5;
          block.castShadow = true;
          group.add(block);
          for (let f = 0; f < 3; f++) {
            const band = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.54), orcMagmaGlowMat);
            band.position.y = 0.34 + f * (towerH * 0.28);
            group.add(band);
          }
          const crown = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.38), orcCrimsonMat);
          crown.position.y = 0.24 + towerH;
          group.add(crown);
        } else {
          // Orc Ep 6+: Gunmetal Armored Siege Pods with Crimson Plasma Vent
          addOrcBastionHut({
            w: 0.66,
            h: 0.34,
            d: 0.54,
            wallMat: orcGunmetalMat,
            roofMat: orcIronMat,
            tuskMat: orcMagmaGlowMat,
            withBanner: false,
          });
          const plasmaCore = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.24), orcMagmaGlowMat);
          plasmaCore.position.set(0, 0.66, 0);
          group.add(plasmaCore);
        }
        break;
      }

      // HUMAN Houses -> Brick Tenements (Ep 3) -> Concrete Mid-Rises (Ep 4) -> Glass Skyscrapers (Ep 5) -> Bio-Habitats (Ep 6+)
      if (epochIndex === 0) {
        const earthPad = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.05, 8), mudEarthMat);
        earthPad.position.y = 0.025;
        group.add(earthPad);

        if (variant % 2 === 0) {
          addSteppedGableRoof(0, 0.05, 0, 0.62, 0.58, 5, 0.075, thatchMat, mudEarthMat, variant === 0);
          const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.04), doorDarkMat);
          door.position.set(0, 0.14, 0.3);
          group.add(door);
        } else {
          const mudWall = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.22, 8), mudEarthMat);
          mudWall.position.y = 0.15;
          mudWall.castShadow = true;
          group.add(mudWall);
          for (let s = 0; s < 4; s++) {
            const r = 0.38 - s * 0.08;
            const tier = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r, 0.09, 8), thatchMat);
            tier.position.y = 0.28 + s * 0.085;
            tier.castShadow = true;
            group.add(tier);
          }
        }

        const rackL = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.22, 0.035), stickWoodMat);
        rackL.position.set(0.28, 0.14, 0.26);
        group.add(rackL);
        const rackR = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.22, 0.035), stickWoodMat);
        rackR.position.set(0.12, 0.14, 0.32);
        group.add(rackR);
        const rackBar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.035), woodMat);
        rackBar.position.set(0.2, 0.23, 0.29);
        rackBar.rotation.y = -0.35;
        group.add(rackBar);
      } else if (epochIndex <= 2) {
        if (variant === 0) {
          addVoxelCottage({
            w: 0.58,
            h: 0.3,
            d: 0.48,
            wallMat: whitePlasterMat,
            roofMat: goldenRoofMat,
            chimneyMat: whitePlasterMat,
            chimneySide: 'left',
            ridgeAlongZ: false,
          });
        } else if (variant === 1) {
          addVoxelCottage({
            w: 0.68,
            h: 0.29,
            d: 0.46,
            wallMat: whitePlasterMat,
            roofMat: goldenRoofMat,
            chimneyMat: whitePlasterMat,
            chimneySide: 'right',
            ridgeAlongZ: false,
          });
        } else if (variant === 2) {
          addVoxelCottage({
            cx: -0.05,
            cz: -0.04,
            w: 0.54,
            h: 0.3,
            d: 0.46,
            wallMat: whitePlasterMat,
            roofMat: goldenRoofMat,
            chimneyMat: whitePlasterMat,
            chimneySide: 'left',
            ridgeAlongZ: false,
          });
          addSteppedGableRoof(0.2, 0.24, 0.14, 0.34, 0.32, 3, 0.05, goldenRoofMat, whitePlasterMat, true);
          const wingWall = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.28), whitePlasterMat);
          wingWall.position.set(0.2, 0.14, 0.14);
          wingWall.castShadow = true;
          group.add(wingWall);
        } else {
          addVoxelCottage({
            w: 0.62,
            h: 0.32,
            d: 0.48,
            wallMat: tanPlasterMat,
            roofMat: redRoofMat,
            chimneyMat: stoneMat,
            chimneySide: 'right',
            ridgeAlongZ: false,
            timberTrim: true,
          });
        }
      } else if (epochIndex === 3) {
        // Industrial Age: Brick urban rowhouses & 2-story tenements
        addVoxelCottage({
          w: variant % 2 === 0 ? 0.62 : 0.68,
          h: 0.44,
          d: 0.52,
          wallMat: variant === 3 ? stoneMat : brickMat,
          roofMat: darkStoneMat,
          chimneyMat: brickMat,
          chimneySide: variant % 2 === 0 ? 'left' : 'right',
          ridgeAlongZ: false,
          timberTrim: false,
        });
        const upperWin = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.54), flameMat);
        upperWin.position.y = 0.36;
        group.add(upperWin);
      } else if (epochIndex === 4) {
        // Atomic Age: Multi-story urban concrete apartment mid-rise with rooftop water tower
        const midH = 0.58 + (variant % 2) * 0.18;
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.6), darkStoneMat);
        base.position.y = 0.04;
        group.add(base);
        const block = new THREE.Mesh(new THREE.BoxGeometry(0.6, midH, 0.54), concreteMat);
        block.position.y = 0.08 + midH * 0.5;
        block.castShadow = true;
        block.receiveShadow = true;
        group.add(block);
        for (let f = 0; f < 2; f++) {
          const winBand = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.56), glowCyanMat);
          winBand.position.y = 0.24 + f * 0.22;
          group.add(winBand);
        }
        const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.06, 0.58), darkStoneMat);
        roofTrim.position.y = 0.1 + midH;
        group.add(roofTrim);
        const waterTank = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 8), woodMat);
        waterTank.position.set(0.16, 0.2 + midH, -0.1);
        group.add(waterTank);
      } else if (epochIndex === 5) {
        // Information Age: High-Density Glass & Steel Skyscraper (varied skyline heights)
        const towerH = 0.92 + variant * 0.22;
        const lobby = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.18, 0.68), darkStoneMat);
        lobby.position.y = 0.09;
        lobby.castShadow = true;
        group.add(lobby);
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.56, towerH, 0.52), blueRoofMat);
        shaft.position.y = 0.18 + towerH * 0.5;
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        group.add(shaft);
        const floors = 3 + (variant % 2);
        for (let f = 0; f < floors; f++) {
          const glassBand = new THREE.Mesh(
            new THREE.BoxGeometry(0.58, 0.065, 0.54),
            f % 2 === 0 ? glowCyanMat : concreteMat,
          );
          glassBand.position.y = 0.3 + f * ((towerH - 0.16) / floors);
          group.add(glassBand);
        }
        const crown = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.36), techMat);
        crown.position.y = 0.24 + towerH;
        group.add(crown);
        if (variant % 2 === 0) {
          const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.32, 6), techMat);
          antenna.position.y = 0.42 + towerH;
          group.add(antenna);
        }
      } else {
        // Orbital & Interstellar: Techno-Modern Bio-Dome Habitat
        addVoxelCottage({
          w: 0.64,
          h: 0.32,
          d: 0.52,
          wallMat: techMat,
          roofMat: darkTechMat,
          chimneyMat: glowCyanMat,
          chimneySide: 'none',
          ridgeAlongZ: false,
        });
        const bioDome = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          glowCyanMat,
        );
        bioDome.position.set(0.18, 0.58, 0);
        group.add(bioDome);
      }
      break;
    }

    case 'shaman_totem': {
      if (isElf) {
        if (epochIndex === 0) {
          // Elven Ep 0: Birch-antler spirit arch woven with leaves
          const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 8), elfMossStoneMat);
          base.position.y = 0.04;
          group.add(base);
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.6, 6), elfBirchMat);
          trunk.position.y = 0.34;
          trunk.castShadow = true;
          group.add(trunk);
          const halo = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 12), elfLeafRoofMat);
          halo.position.y = 0.58;
          group.add(halo);
        } else {
          // Elven Ep 1+: Twin Crescent Moon-Gate Shrine with levitating starlight crystal
          const isSciFi = epochIndex >= 6;
          const dais = new THREE.Mesh(
            new THREE.CylinderGeometry(0.36, 0.42, 0.1, 8),
            isSciFi ? elfPearlTechMat : elfMossStoneMat,
          );
          dais.position.y = 0.05;
          group.add(dais);

          for (const sx of [-0.18, 0.18]) {
            const pillar = new THREE.Mesh(
              new THREE.BoxGeometry(0.08, 0.52, 0.08),
              isSciFi ? elfPearlTechMat : elfBirchMat,
            );
            pillar.position.set(sx, 0.34, 0);
            pillar.rotation.z = -Math.sign(sx) * 0.16;
            pillar.castShadow = true;
            group.add(pillar);
          }
          const crownArc = new THREE.Mesh(
            new THREE.TorusGeometry(0.2, 0.04, 6, 12, Math.PI),
            isSciFi ? elfJadeRoofMat : goldMat,
          );
          crownArc.position.y = 0.56;
          group.add(crownArc);

          const relic = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), elfAquaGlowMat);
          relic.position.y = 0.36;
          relic.name = 'spin_part';
          group.add(relic);
        }
        break;
      }

      if (isOrc) {
        if (epochIndex === 0) {
          // Orc Ep 0: Skull & Horn War Standard Totem
          const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.1, 6), orcBasaltMat);
          mound.position.y = 0.05;
          group.add(mound);
          const pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.64, 0.14), orcCharredLogMat);
          pole.position.y = 0.36;
          group.add(pole);
          for (const sx of [-0.18, 0.18]) {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 5), orcBoneMat);
            horn.position.set(sx, 0.62, 0);
            horn.rotation.z = -Math.sign(sx) * 0.6;
            group.add(horn);
          }
        } else {
          // Orc Ep 1+: Obsidian Fang & Twin Iron-Horn War Altar
          const isSciFi = epochIndex >= 6;
          const dais = new THREE.Mesh(
            new THREE.BoxGeometry(0.72, 0.14, 0.72),
            isSciFi ? orcGunmetalMat : orcBasaltMat,
          );
          dais.position.y = 0.07;
          group.add(dais);

          for (const sx of [-0.22, 0.22]) {
            const fang = new THREE.Mesh(
              new THREE.ConeGeometry(0.09, 0.62, 5),
              isSciFi ? orcIronMat : orcBasaltMat,
            );
            fang.position.set(sx, 0.42, 0);
            fang.rotation.z = Math.sign(sx) * 0.18;
            fang.castShadow = true;
            group.add(fang);
          }
          const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), orcMagmaGlowMat);
          core.position.y = 0.42;
          core.name = isSciFi ? 'spin_part' : 'flicker_flame';
          group.add(core);
        }
        break;
      }

      // HUMAN Shrines
      if (epochIndex === 0) {
        const earthBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.1, 6), mudEarthMat);
        earthBase.position.y = 0.05;
        group.add(earthBase);

        const totemPole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.64, 0.16), stickWoodMat);
        totemPole.position.y = 0.37;
        totemPole.castShadow = true;
        group.add(totemPole);

        const woodenWings = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.09, 0.08), thatchMat);
        woodenWings.position.y = 0.54;
        group.add(woodenWings);

        const maskCrest = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.2), redRoofMat);
        maskCrest.position.y = 0.68;
        group.add(maskCrest);
      } else {
        const isSciFi = epochIndex >= 6;
        const baseMat = isSciFi ? darkTechMat : stoneMat;
        const pillarMat = isSciFi ? techMat : stoneMat;
        const trimMat = isSciFi ? glowCyanMat : darkStoneMat;

        const base1 = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.09, 0.68), baseMat);
        base1.position.y = 0.045;
        base1.receiveShadow = true;
        base1.castShadow = true;
        group.add(base1);

        const stepNS = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.78), baseMat);
        stepNS.position.y = 0.035;
        group.add(stepNS);
        const stepEW = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.07, 0.32), baseMat);
        stepEW.position.y = 0.035;
        group.add(stepEW);

        const base2 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.56), trimMat);
        base2.position.y = 0.13;
        group.add(base2);

        for (const [px, pz] of [
          [-0.21, -0.21],
          [0.21, -0.21],
          [-0.21, 0.21],
          [0.21, 0.21],
        ]) {
          const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.1), pillarMat);
          pillar.position.set(px, 0.33, pz);
          pillar.castShadow = true;
          group.add(pillar);
        }

        const beamN = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.09, 0.11), pillarMat);
        beamN.position.set(0, 0.53, -0.21);
        beamN.castShadow = true;
        group.add(beamN);

        const beamS = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.09, 0.11), pillarMat);
        beamS.position.set(0, 0.53, 0.21);
        beamS.castShadow = true;
        group.add(beamS);

        const beamW = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.56), pillarMat);
        beamW.position.set(-0.21, 0.53, 0);
        beamW.castShadow = true;
        group.add(beamW);

        const beamE = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.56), pillarMat);
        beamE.position.set(0.21, 0.53, 0);
        beamE.castShadow = true;
        group.add(beamE);

        const relic = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.16, 0.14),
          isSciFi ? glowCyanMat : epochIndex >= 2 ? goldMat : stoneMat,
        );
        relic.position.y = 0.25;
        if (isSciFi) relic.name = 'spin_part';
        group.add(relic);
      }
      break;
    }

    case 'granary': {
      if (isElf) {
        if (epochIndex <= 5) {
          addElfPagodaPavilion({
            radius: 0.34,
            h: 0.3,
            wallMat: epochIndex >= 3 ? elfBirchMat : elfHeartwoodMat,
            roofMat: epochIndex >= 3 ? elfVerdigrisMat : elfJadeRoofMat,
            tiers: epochIndex >= 4 ? 2 : 1,
            glowTrim: true,
          });
          const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.22, 8), goldMat);
          urn.position.set(-0.28, 0.14, 0.24);
          group.add(urn);
        } else {
          addElfPagodaPavilion({
            radius: 0.34,
            h: 0.34,
            wallMat: elfPearlTechMat,
            roofMat: elfJadeRoofMat,
            tiers: 2,
            glowTrim: true,
          });
          const bioVat = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.52, 8), elfAquaGlowMat);
          bioVat.position.set(-0.28, 0.28, -0.2);
          group.add(bioVat);
        }
        break;
      }

      if (isOrc) {
        addOrcBastionHut({
          w: 0.68,
          h: 0.34,
          d: 0.54,
          wallMat: epochIndex >= 6 ? orcGunmetalMat : epochIndex >= 3 ? orcIronMat : orcCharredLogMat,
          roofMat: orcCrimsonMat,
          tuskMat: epochIndex >= 6 ? orcMagmaGlowMat : orcBoneMat,
          withBanner: true,
        });
        const drumSilo = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.16, 0.56, 7),
          epochIndex >= 6 ? orcMagmaGlowMat : orcIronMat,
        );
        drumSilo.position.set(-0.26, 0.3, -0.2);
        drumSilo.castShadow = true;
        group.add(drumSilo);
        break;
      }

      // HUMAN Granary / Urban Market Depot
      if (epochIndex <= 2) {
        const floorPad = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.07, 0.58), tanPlasterMat);
        floorPad.position.y = 0.035;
        floorPad.receiveShadow = true;
        group.add(floorPad);

        for (const [cx, cz] of [
          [-0.27, -0.22],
          [0, -0.22],
          [0.27, -0.22],
          [-0.27, 0.22],
          [0, 0.22],
          [0.27, 0.22],
        ]) {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.34, 0.065), tanPlasterMat);
          col.position.set(cx, 0.24, cz);
          col.castShadow = true;
          group.add(col);
        }

        const sackBlue = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), blueRoofMat);
        sackBlue.position.set(-0.12, 0.14, 0.05);
        group.add(sackBlue);

        const sackGold = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.15, 0.13), goldenRoofMat);
        sackGold.position.set(0.12, 0.145, -0.04);
        group.add(sackGold);

        const sackRed = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), redRoofMat);
        sackRed.position.set(0.14, 0.13, 0.12);
        group.add(sackRed);

        const roofBase = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.07, 0.64), woodMat);
        roofBase.position.y = 0.44;
        roofBase.castShadow = true;
        group.add(roofBase);

        for (let r = -2; r <= 2; r++) {
          const rafter = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.06, 0.07), stickWoodMat);
          rafter.position.set(0, 0.5, r * 0.12);
          rafter.castShadow = true;
          group.add(rafter);
        }

        const ridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.07, 0.38), woodMat);
        ridgeBeam.position.y = 0.55;
        group.add(ridgeBeam);
      } else if (epochIndex <= 5) {
        addVoxelCottage({
          w: 0.68,
          h: epochIndex === 5 ? 0.48 : 0.36,
          d: 0.56,
          wallMat: epochIndex === 3 ? brickMat : concreteMat,
          roofMat: epochIndex === 3 ? redRoofMat : epochIndex === 5 ? blueRoofMat : darkStoneMat,
          chimneySide: 'none',
          timberTrim: epochIndex === 3,
        });
        const silo = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.15, epochIndex === 5 ? 0.72 : 0.62, 8),
          epochIndex === 3 ? woodMat : concreteMat,
        );
        silo.position.set(-0.26, 0.36, -0.18);
        silo.castShadow = true;
        group.add(silo);
      } else {
        addVoxelCottage({
          w: 0.68,
          h: 0.34,
          d: 0.54,
          wallMat: techMat,
          roofMat: darkTechMat,
          chimneySide: 'none',
        });
        const cryoSilo = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.68, 10), glowCyanMat);
        cryoSilo.position.set(-0.24, 0.38, -0.18);
        group.add(cryoSilo);
      }
      break;
    }

    case 'guildhall': {
      if (isElf) {
        addElfPagodaPavilion({
          radius: 0.34,
          h: epochIndex === 5 ? 0.38 : 0.3,
          wallMat: epochIndex >= 5 ? elfPearlTechMat : elfBirchMat,
          roofMat: epochIndex >= 6 ? elfJadeRoofMat : epochIndex >= 3 ? elfVerdigrisMat : elfJadeRoofMat,
          tiers: epochIndex >= 5 ? 3 : 2,
          glowTrim: true,
        });
        if (epochIndex >= 6) {
          const halo = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 14), elfAquaGlowMat);
          halo.position.y = 0.92;
          halo.rotation.x = Math.PI / 2;
          halo.name = 'spin_part';
          group.add(halo);
        }
        break;
      }

      if (isOrc) {
        if (epochIndex < 6) {
          addOrcBastionHut({
            w: 0.72,
            h: epochIndex === 5 ? 0.66 : 0.4,
            d: 0.56,
            wallMat: epochIndex >= 4 ? orcGunmetalMat : epochIndex >= 3 ? orcIronMat : orcBasaltMat,
            roofMat: orcCrimsonMat,
            tuskMat: epochIndex >= 5 ? orcMagmaGlowMat : orcBoneMat,
            withBanner: true,
          });
        } else {
          // Orc Ep 6+: Heavy Dreadnought War-Spire
          const base = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.32, 0.66), orcGunmetalMat);
          base.position.y = 0.16;
          group.add(base);
          const keep = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.74, 0.5), orcIronMat);
          keep.position.y = 0.68;
          keep.castShadow = true;
          group.add(keep);
          const crimsonBand = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.54), orcMagmaGlowMat);
          crimsonBand.position.y = 0.78;
          group.add(crimsonBand);
          const warRotor = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), orcMagmaGlowMat);
          warRotor.position.y = 1.18;
          warRotor.name = 'spin_part';
          group.add(warRotor);
        }
        break;
      }

      // HUMAN Guildhall -> Clocktower City Hall (Ep 3-4) -> Downtown Corporate Skyscraper (Ep 5) -> Orbital Spire (Ep 6+)
      if (epochIndex <= 2) {
        addVoxelCottage({
          w: 0.66,
          h: 0.33,
          d: 0.52,
          wallMat: tanPlasterMat,
          roofMat: blueRoofMat,
          chimneyMat: tanPlasterMat,
          chimneySide: 'front_right',
          ridgeAlongZ: false,
          timberTrim: true,
        });

        const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.18), woodMat);
        porchRoof.position.set(-0.1, 0.28, 0.33);
        porchRoof.castShadow = true;
        group.add(porchRoof);

        const planter = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.12), greenAwningMat);
        planter.position.set(-0.12, 0.11, 0.32);
        group.add(planter);
      } else if (epochIndex <= 4) {
        addVoxelCottage({
          w: 0.72,
          h: 0.46,
          d: 0.58,
          wallMat: epochIndex === 3 ? brickMat : concreteMat,
          roofMat: blueRoofMat,
          chimneyMat: epochIndex === 3 ? brickMat : concreteMat,
          chimneySide: 'front_right',
          ridgeAlongZ: false,
          timberTrim: epochIndex === 3,
        });
        // Civic clock tower on top
        const clkShaft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.2), epochIndex === 3 ? brickMat : concreteMat);
        clkShaft.position.set(0, 0.78, 0);
        clkShaft.castShadow = true;
        group.add(clkShaft);
        const clkDial = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.22), goldMat);
        clkDial.position.set(0, 0.86, 0);
        group.add(clkDial);
        const clkCap = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.18, 4), darkStoneMat);
        clkCap.position.set(0, 1.08, 0);
        clkCap.rotation.y = Math.PI / 4;
        group.add(clkCap);
      } else if (epochIndex === 5) {
        // Info Age: Tall Corporate Downtown Skyscraper
        const podium = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.24, 0.7), darkStoneMat);
        podium.position.y = 0.12;
        podium.castShadow = true;
        group.add(podium);
        const mainTower = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.12, 0.52), blueRoofMat);
        mainTower.position.y = 0.8;
        mainTower.castShadow = true;
        group.add(mainTower);
        for (let f = 0; f < 4; f++) {
          const band = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.07, 0.54), glowCyanMat);
          band.position.y = 0.4 + f * 0.24;
          group.add(band);
        }
        const penthouse = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.34), techMat);
        penthouse.position.y = 1.46;
        group.add(penthouse);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.38, 6), techMat);
        mast.position.y = 1.72;
        group.add(mast);
      } else {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.64), darkTechMat);
        base.position.y = 0.16;
        base.castShadow = true;
        group.add(base);

        const tower = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.68, 0.48), techMat);
        tower.position.y = 0.66;
        tower.castShadow = true;
        group.add(tower);

        const neonBand1 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.52), glowCyanMat);
        neonBand1.position.y = 0.54;
        group.add(neonBand1);

        const neonBand2 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.52), glowCyanMat);
        neonBand2.position.y = 0.82;
        group.add(neonBand2);

        const crownRing = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.38), glowCyanMat);
        crownRing.position.y = 1.08;
        crownRing.name = 'spin_part';
        group.add(crownRing);
      }
      break;
    }

    case 'smeltery': {
      const wallM = isElf
        ? epochIndex >= 6
          ? elfPearlTechMat
          : elfMossStoneMat
        : isOrc
          ? epochIndex >= 6
            ? orcGunmetalMat
            : epochIndex >= 3
              ? orcIronMat
              : orcBasaltMat
          : epochIndex >= 6
            ? darkTechMat
            : epochIndex <= 1
              ? tanPlasterMat
              : epochIndex === 2
                ? stoneMat
                : brickMat;
      const roofM = isElf
        ? elfJadeRoofMat
        : isOrc
          ? orcCrimsonMat
          : epochIndex >= 6
            ? techMat
            : epochIndex <= 1
              ? woodMat
              : redRoofMat;

      if (isElf) {
        addElfPagodaPavilion({
          radius: 0.31,
          h: 0.32,
          wallMat: wallM,
          roofMat: roofM,
          tiers: 1,
          glowTrim: true,
        });
        const sunForge = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), epochIndex >= 6 ? elfAquaGlowMat : goldMat);
        sunForge.position.set(0.24, 0.18, 0.24);
        sunForge.name = 'spin_part';
        group.add(sunForge);
      } else if (isOrc) {
        addOrcBastionHut({
          w: 0.64,
          h: 0.34,
          d: 0.52,
          wallMat: wallM,
          roofMat: roofM,
          tuskMat: epochIndex >= 6 ? orcMagmaGlowMat : orcBoneMat,
          withBanner: true,
        });
        const blastStack = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.78, 7), orcIronMat);
        blastStack.position.set(-0.22, 0.42, -0.16);
        blastStack.castShadow = true;
        group.add(blastStack);
        const magmaVat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), orcMagmaGlowMat);
        magmaVat.position.set(0.22, 0.12, 0.26);
        magmaVat.name = 'flicker_flame';
        group.add(magmaVat);
      } else if (epochIndex >= 6) {
        addVoxelCottage({
          w: 0.64,
          h: 0.34,
          d: 0.52,
          wallMat: darkTechMat,
          roofMat: techMat,
          chimneySide: 'none',
        });
        const plasmaVat = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.24), glowCyanMat);
        plasmaVat.position.set(0.2, 0.14, 0.26);
        group.add(plasmaVat);

        const laserRing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.34), glowCyanMat);
        laserRing.position.set(-0.16, 0.78, -0.12);
        laserRing.name = 'spin_part';
        group.add(laserRing);
      } else {
        addVoxelCottage({
          w: 0.6,
          h: 0.32,
          d: 0.48,
          wallMat: wallM,
          roofMat: roofM,
          chimneyMat: darkStoneMat,
          chimneySide: 'left',
          ridgeAlongZ: false,
          timberTrim: true,
        });

        const furnace = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.22), darkStoneMat);
        furnace.position.set(-0.2, 0.36, -0.14);
        furnace.castShadow = true;
        group.add(furnace);

        const moltenVat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.2), flameMat);
        moltenVat.position.set(0.2, 0.12, 0.26);
        moltenVat.name = 'flicker_flame';
        group.add(moltenVat);
      }
      break;
    }

    case 'observatory': {
      if (isElf) {
        const baseMat = epochIndex >= 6 ? elfPearlTechMat : elfBirchMat;
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.74, 8), baseMat);
        spire.position.y = 0.37;
        spire.castShadow = true;
        group.add(spire);

        const eave = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.4, 0.08, 8), elfJadeRoofMat);
        eave.position.y = 0.72;
        group.add(eave);

        const astrolabe = new THREE.Mesh(
          new THREE.TorusGeometry(0.25, 0.032, 6, 16),
          epochIndex >= 6 ? elfAquaGlowMat : goldMat,
        );
        astrolabe.position.y = 0.96;
        astrolabe.rotation.x = 0.45;
        astrolabe.name = 'spin_part';
        group.add(astrolabe);
        break;
      }

      if (isOrc) {
        const towerMat = epochIndex >= 6 ? orcGunmetalMat : orcBasaltMat;
        const bastion = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.34, 0.66), towerMat);
        bastion.position.y = 0.17;
        group.add(bastion);

        const keep = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.5, 7), orcIronMat);
        keep.position.y = 0.56;
        keep.castShadow = true;
        group.add(keep);

        const spikedDome = new THREE.Mesh(
          new THREE.SphereGeometry(0.26, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
          epochIndex >= 6 ? orcGunmetalMat : orcCrimsonMat,
        );
        spikedDome.position.y = 0.8;
        group.add(spikedDome);

        const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), orcMagmaGlowMat);
        eye.position.y = 1.1;
        eye.name = 'spin_part';
        group.add(eye);
        break;
      }

      if (epochIndex >= 6) {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.68, 8), techMat);
        tower.position.y = 0.36;
        tower.castShadow = true;
        group.add(tower);

        const collar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.62), glowCyanMat);
        collar.position.y = 0.7;
        group.add(collar);

        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          darkTechMat,
        );
        dome.position.y = 0.74;
        group.add(dome);

        const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.05, 0.12, 8), glowCyanMat);
        dish.position.set(0.1, 1.02, 0.1);
        dish.rotation.z = -0.5;
        dish.name = 'spin_part';
        group.add(dish);
      } else {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.28, 0.62), whitePlasterMat);
        base.position.y = 0.16;
        base.castShadow = true;
        group.add(base);

        const tower = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.3, 0.56, 8),
          epochIndex === 3 ? brickMat : epochIndex >= 4 ? concreteMat : marbleWhiteMat,
        );
        tower.position.y = 0.48;
        tower.castShadow = true;
        group.add(tower);

        const balcony = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.6), woodMat);
        balcony.position.y = 0.74;
        group.add(balcony);

        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          epochIndex >= 4 ? techMat : goldMat,
        );
        dome.position.y = 0.77;
        group.add(dome);

        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.34, 6), darkStoneMat);
        scope.position.set(0.12, 0.92, 0.12);
        scope.rotation.z = -0.6;
        scope.rotation.x = 0.4;
        group.add(scope);
      }
      break;
    }

    case 'steam_foundry':
    case 'dynamo_plant': {
      if (isElf) {
        addElfPagodaPavilion({
          radius: 0.34,
          h: 0.36,
          wallMat: epochIndex >= 6 ? elfPearlTechMat : elfBirchMat,
          roofMat: epochIndex >= 6 ? elfJadeRoofMat : elfVerdigrisMat,
          tiers: 1,
          glowTrim: true,
        });
        const coil = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.18, 0),
          epochIndex >= 6 || type === 'dynamo_plant' ? elfAquaGlowMat : goldMat,
        );
        coil.position.set(0.22, 0.72, 0.12);
        coil.name = 'spin_part';
        group.add(coil);
        break;
      }

      if (isOrc) {
        addOrcBastionHut({
          w: 0.72,
          h: 0.38,
          d: 0.6,
          wallMat: epochIndex >= 6 ? orcGunmetalMat : orcIronMat,
          roofMat: orcCrimsonMat,
          tuskMat: epochIndex >= 6 ? orcMagmaGlowMat : orcIronMat,
          withBanner: true,
        });
        for (const sx of [-0.22, 0.04]) {
          const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.84, 7), orcBasaltMat);
          stack.position.set(sx, 0.56, -0.18);
          stack.castShadow = true;
          group.add(stack);
        }
        const coil = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), orcMagmaGlowMat);
        coil.position.set(0.2, 0.68, 0.14);
        coil.name = 'spin_part';
        group.add(coil);
        break;
      }

      if (epochIndex >= 6) {
        addVoxelCottage({
          w: 0.72,
          h: 0.38,
          d: 0.62,
          wallMat: techMat,
          roofMat: darkTechMat,
          chimneySide: 'none',
        });
        const pylon1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.82, 8), darkTechMat);
        pylon1.position.set(-0.22, 0.54, -0.18);
        group.add(pylon1);

        const energyRing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), glowCyanMat);
        energyRing.position.set(0.18, 0.68, 0.12);
        energyRing.name = 'spin_part';
        group.add(energyRing);
      } else {
        addVoxelCottage({
          w: 0.7,
          h: 0.36,
          d: 0.6,
          wallMat: epochIndex >= 4 ? concreteMat : brickMat,
          roofMat: darkStoneMat,
          chimneySide: 'none',
          timberTrim: true,
        });

        const stack1 = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.82, 8), darkStoneMat);
        stack1.position.set(-0.22, 0.54, -0.18);
        stack1.castShadow = true;
        group.add(stack1);

        const stack2 = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.72, 8), darkStoneMat);
        stack2.position.set(0.02, 0.48, -0.18);
        stack2.castShadow = true;
        group.add(stack2);

        const coil = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.24, 0.24),
          type === 'dynamo_plant' ? glowCyanMat : goldMat,
        );
        coil.position.set(0.18, 0.64, 0.12);
        coil.name = 'spin_part';
        group.add(coil);
      }
      break;
    }

    case 'fission_reactor':
    case 'cyber_institute': {
      const baseMat = isElf
        ? elfPearlTechMat
        : isOrc
          ? epochIndex >= 6
            ? orcGunmetalMat
            : orcIronMat
          : epochIndex >= 6
            ? techMat
            : concreteMat;
      const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.3, 0.72), baseMat);
      baseBlock.position.y = 0.18;
      baseBlock.castShadow = true;
      group.add(baseBlock);

      if (type === 'fission_reactor') {
        const coolingTower = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.3, 0.72, isElf ? 8 : 10),
          isElf ? elfJadeRoofMat : isOrc ? orcBasaltMat : epochIndex >= 6 ? darkTechMat : concreteMat,
        );
        coolingTower.position.set(-0.1, 0.52, -0.08);
        coolingTower.castShadow = true;
        group.add(coolingTower);

        const coreGlow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 0.24), raceGlowMat);
        coreGlow.position.set(0.2, 0.48, 0.18);
        if (epochIndex >= 6) coreGlow.name = 'spin_part';
        group.add(coreGlow);
      } else {
        const tower1 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.96, 0.46), baseMat);
        tower1.position.y = 0.64;
        tower1.castShadow = true;
        group.add(tower1);

        const dataRing = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.1, 0.54), raceGlowMat);
        dataRing.position.y = 0.92;
        dataRing.name = 'spin_part';
        group.add(dataRing);

        const spireAntenna = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.05, 0.42, 6),
          epochIndex >= 6 ? raceGlowMat : raceAccentMat,
        );
        spireAntenna.position.y = 1.28;
        group.add(spireAntenna);
      }
      break;
    }

    case 'rail_station': {
      // Transit Station: Brick Railway Depot (Ep 3) -> Commuter Terminal (Ep 4) -> Glass Metro Hub (Ep 5) -> Maglev Portal (Ep 6+)
      const platformMat = epochIndex >= 6 ? raceTechTrimMat : isOrc ? orcBasaltMat : isElf ? elfMossStoneMat : darkStoneMat;
      const platform = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.08, 0.84), platformMat);
      platform.position.y = 0.04;
      platform.receiveShadow = true;
      group.add(platform);

      // Yellow safety strip on platform edge
      const safetyTrim = new THREE.Mesh(
        new THREE.BoxGeometry(0.88, 0.03, 0.08),
        epochIndex >= 6 ? raceGlowMat : goldMat,
      );
      safetyTrim.position.set(0, 0.085, 0.36);
      group.add(safetyTrim);

      if (isElf) {
        addElfPagodaPavilion({
          cx: 0,
          cz: -0.06,
          radius: 0.32,
          h: 0.3,
          wallMat: epochIndex >= 5 ? elfPearlTechMat : elfBirchMat,
          roofMat: epochIndex >= 5 ? elfJadeRoofMat : elfVerdigrisMat,
          tiers: 1,
          glowTrim: true,
        });
      } else if (isOrc) {
        addOrcBastionHut({
          cx: 0,
          cz: -0.06,
          w: 0.7,
          h: 0.3,
          d: 0.5,
          wallMat: epochIndex >= 5 ? orcGunmetalMat : orcIronMat,
          roofMat: orcCrimsonMat,
          tuskMat: epochIndex >= 5 ? orcMagmaGlowMat : orcIronMat,
          withBanner: true,
        });
      } else {
        const wallM = epochIndex >= 6 ? techMat : epochIndex === 5 ? blueRoofMat : epochIndex === 4 ? concreteMat : brickMat;
        const roofM = epochIndex >= 6 ? darkTechMat : epochIndex >= 4 ? concreteMat : redRoofMat;

        const concourse = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.28, 0.44), wallM);
        concourse.position.set(0, 0.22, -0.1);
        concourse.castShadow = true;
        group.add(concourse);

        const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.07, 0.66), roofM);
        canopy.position.set(0, 0.4, 0.04);
        canopy.castShadow = true;
        group.add(canopy);

        const archSign = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.1, 0.08),
          epochIndex >= 5 ? glowCyanMat : goldMat,
        );
        archSign.position.set(0, 0.48, 0.34);
        group.add(archSign);
      }

      // Elevated upper-level metro platform & viaduct columns for Information/Space Ages (epochIndex >= 5)
      if (epochIndex >= 5) {
        for (const px of [-0.34, 0.34]) {
          const pier = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.64, 0.16), platformMat);
          pier.position.set(px, 0.38, 0.24);
          pier.castShadow = true;
          group.add(pier);
        }
        const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.1, 0.44), platformMat);
        upperDeck.position.set(0, 0.72, 0.22);
        upperDeck.castShadow = true;
        upperDeck.receiveShadow = true;
        group.add(upperDeck);

        const upperEdge = new THREE.Mesh(
          new THREE.BoxGeometry(0.94, 0.035, 0.06),
          epochIndex >= 6 ? glowCyanMat : goldMat,
        );
        upperEdge.position.set(0, 0.775, 0.41);
        group.add(upperEdge);

        const upperCanopy = new THREE.Mesh(
          new THREE.BoxGeometry(0.86, 0.05, 0.32),
          epochIndex >= 6 ? darkTechMat : concreteMat,
        );
        upperCanopy.position.set(0, 1.0, 0.2);
        upperCanopy.castShadow = true;
        group.add(upperCanopy);

        for (const sx of [-0.3, 0.3]) {
          const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.05), platformMat);
          strut.position.set(sx, 0.88, 0.12);
          group.add(strut);
        }
      }

      // Elevated station clock / transit pylon
      const clockMast = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.44, 0.1), platformMat);
      clockMast.position.set(-0.34, epochIndex >= 5 ? 0.62 : 0.42, 0.26);
      group.add(clockMast);
      const signalBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), raceGlowMat);
      signalBeacon.position.set(-0.34, epochIndex >= 5 ? 0.88 : 0.62, 0.26);
      group.add(signalBeacon);
      break;
    }

    case 'airport': {
      // Airport Hub: Taxiway Apron, Hangar Vault, Glass Boarding Terminal, Jetbridge & Radar ATC Tower
      const tarmac = new THREE.Mesh(
        new THREE.BoxGeometry(0.96, 0.06, 0.96),
        isElf ? elfMossStoneMat : isOrc ? orcBasaltMat : darkStoneMat,
      );
      tarmac.position.y = 0.03;
      tarmac.receiveShadow = true;
      group.add(tarmac);

      // Yellow taxiway apron guide strip connecting terminal out toward adjacent runway tiles
      const taxiGuide = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.015, 0.42),
        epochIndex >= 6 ? raceGlowMat : goldMat,
      );
      taxiGuide.position.set(-0.24, 0.065, 0.22);
      group.add(taxiGuide);

      const termWall = isElf ? elfPearlTechMat : isOrc ? orcGunmetalMat : epochIndex >= 6 ? techMat : concreteMat;
      const termRoof = isElf ? elfJadeRoofMat : isOrc ? orcCrimsonMat : blueRoofMat;

      // Arched Aircraft Hangar (-X / -Z quadrant)
      const hangarBody = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.34), termWall);
      hangarBody.position.set(-0.2, 0.17, -0.22);
      hangarBody.castShadow = true;
      group.add(hangarBody);
      const hangarRoof = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.19, 0.38, 8, 1, false, 0, Math.PI),
        termRoof,
      );
      hangarRoof.rotation.z = Math.PI / 2;
      hangarRoof.position.set(-0.2, 0.28, -0.22);
      group.add(hangarRoof);
      const hangarBay = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.04), darkTechMat);
      hangarBay.position.set(-0.2, 0.14, -0.04);
      group.add(hangarBay);

      // Passenger Terminal Concourse (+X side) + Boarding Jetbridge
      const terminal = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.56), termWall);
      terminal.position.set(0.22, 0.19, -0.08);
      terminal.castShadow = true;
      group.add(terminal);
      const termCap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.62), termRoof);
      termCap.position.set(0.22, 0.35, -0.08);
      group.add(termCap);
      const gateGlass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.44), raceGlowMat);
      gateGlass.position.set(0.02, 0.21, -0.08);
      group.add(gateGlass);
      const jetbridge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.1), termWall);
      jetbridge.position.set(-0.04, 0.19, 0.14);
      group.add(jetbridge);

      // Air Traffic Control Tower
      const towerShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.12, 0.78, isElf ? 8 : 6),
        isOrc ? orcIronMat : termWall,
      );
      towerShaft.position.set(0.26, 0.45, 0.28);
      towerShaft.castShadow = true;
      group.add(towerShaft);

      const controlCab = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.14, 8), raceGlowMat);
      controlCab.position.set(0.26, 0.88, 0.28);
      group.add(controlCab);

      const cabRoof = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 8), termRoof);
      cabRoof.position.set(0.26, 0.97, 0.28);
      group.add(cabRoof);

      const radarBar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.06), goldMat);
      radarBar.position.set(0.26, 1.04, 0.28);
      radarBar.name = 'spin_part';
      group.add(radarBar);

      // Windsock mast
      const sockPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 5), concreteMat);
      sockPole.position.set(-0.38, 0.23, 0.34);
      group.add(sockPole);
      const windSock = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 6), redRoofMat);
      windSock.rotation.z = -Math.PI / 2;
      windSock.position.set(-0.31, 0.38, 0.34);
      group.add(windSock);
      break;
    }

    case 'launch_arcology': {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.16, 0.84), raceTechTrimMat);
      pad.position.y = 0.08;
      group.add(pad);

      const gantry = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), raceGlowMat);
      gantry.position.set(-0.24, 0.68, -0.2);
      gantry.castShadow = true;
      group.add(gantry);

      const rocketBody = new THREE.Mesh(
        new THREE.CylinderGeometry(isElf ? 0.1 : 0.13, isOrc ? 0.2 : 0.17, 0.88, isOrc ? 6 : 8),
        raceTechWallMat,
      );
      rocketBody.position.set(0.08, 0.64, 0.06);
      rocketBody.castShadow = true;
      group.add(rocketBody);

      const noseCone = new THREE.Mesh(
        new THREE.ConeGeometry(isElf ? 0.1 : 0.14, isElf ? 0.36 : 0.28, isOrc ? 6 : 8),
        isOrc ? orcCrimsonMat : goldMat,
      );
      noseCone.position.set(0.08, isElf ? 1.26 : 1.22, 0.06);
      group.add(noseCone);

      const thrusterGlow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.2), raceGlowMat);
      thrusterGlow.position.set(0.08, 0.2, 0.06);
      group.add(thrusterGlow);
      break;
    }

    case 'dyson_spire': {
      const tier1 = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.2, 0.86), raceTechTrimMat);
      tier1.position.y = 0.1;
      group.add(tier1);

      const obelisk = new THREE.Mesh(
        new THREE.ConeGeometry(isElf ? 0.24 : 0.32, isElf ? 1.32 : 1.2, isElf ? 8 : 4),
        isOrc ? orcIronMat : goldMat,
      );
      obelisk.position.y = 0.8;
      obelisk.castShadow = true;
      group.add(obelisk);

      const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 6, 12), raceGlowMat);
      haloRing.position.y = 1.02;
      haloRing.rotation.x = Math.PI / 2;
      haloRing.name = 'spin_part';
      group.add(haloRing);

      const skyBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 3.0, 8), raceGlowMat);
      skyBeam.position.y = 2.2;
      group.add(skyBeam);
      break;
    }
  }

  return group;
}

function buildCreatureUnitGroup(
  group: THREE.Group,
  role: UnitRole,
  s0: number,
  s1: number,
  s2: number,
  s3: number,
): THREE.Group {
  const mat = (color: number, roughness = 0.72, metalness = 0.05, emissive = 0, emissiveIntensity = 0) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      emissive,
      emissiveIntensity,
    });

  const darkEyeMat = mat(0x16161a, 0.35, 0.2);
  let shadowRadius = 0.56;
  let auraRadius = 0.28;

  if (role === 'chicken') {
    shadowRadius = 0.34;
    auraRadius = 0.2;
    const coats = [0xf8fafc, 0xd99b52, 0xb87333, 0xf1e3c6];
    const bodyMat = mat(coats[s0 % coats.length], 0.8);
    const wingTone = mat(s0 % 2 === 0 ? 0xe2e8f0 : 0x9c5a25, 0.82);
    const combMat = mat(0xd62828, 0.55);
    const beakMat = mat(0xf59e0b, 0.5);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.19), bodyMat);
    body.position.set(0, 0.13, 0);
    body.castShadow = true;
    group.add(body);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.08), wingTone);
    tail.position.set(0, 0.19, -0.11);
    tail.rotation.x = -0.35;
    group.add(tail);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), bodyMat);
    head.position.set(0, 0.23, 0.08);
    head.castShadow = true;
    group.add(head);

    const comb = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.075), combMat);
    comb.position.set(0, 0.3, 0.085);
    group.add(comb);

    const wattle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.03), combMat);
    wattle.position.set(0, 0.185, 0.13);
    group.add(wattle);

    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.055), beakMat);
    beak.position.set(0, 0.22, 0.15);
    group.add(beak);

    for (const ex of [-0.052, 0.052]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, 0.02), darkEyeMat);
      eye.position.set(ex, 0.24, 0.1);
      group.add(eye);
    }

    for (const lx of [-0.04, 0.04]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.08, 0.025), beakMat);
      leg.position.set(lx, 0.04, 0);
      group.add(leg);
    }

    const wingGeo = new THREE.BoxGeometry(0.03, 0.08, 0.12);
    const wingL = new THREE.Mesh(wingGeo, wingTone);
    wingL.position.set(-0.085, 0.15, -0.01);
    wingL.name = 'wing_l';
    group.add(wingL);

    const wingR = new THREE.Mesh(wingGeo, wingTone);
    wingR.position.set(0.085, 0.15, -0.01);
    wingR.name = 'wing_r';
    group.add(wingR);
  } else if (role === 'pig') {
    shadowRadius = 0.52;
    auraRadius = 0.28;
    const coats = [0xf4a5ae, 0xe88d9a, 0xd49b87, 0x4a423e];
    const bodyMat = mat(coats[s0 % coats.length], 0.72);
    const snoutMat = mat(0xf9bec7, 0.62);
    const hoofMat = mat(0x3a2e2b, 0.8);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.34), bodyMat);
    body.position.set(0, 0.18, -0.02);
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.18, 0.18), bodyMat);
    head.position.set(0, 0.22, 0.19);
    head.castShadow = true;
    group.add(head);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.06), snoutMat);
    snout.position.set(0, 0.19, 0.29);
    group.add(snout);

    for (const ex of [-0.075, 0.075]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.035), bodyMat);
      ear.position.set(ex, 0.31, 0.19);
      ear.rotation.z = ex < 0 ? 0.35 : -0.35;
      group.add(ear);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.024, 0.02), darkEyeMat);
      eye.position.set(ex * 0.9, 0.24, 0.285);
      group.add(eye);
    }

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.045), snoutMat);
    tail.position.set(0, 0.23, -0.2);
    tail.rotation.x = 0.5;
    group.add(tail);

    for (const [lx, lz] of [
      [-0.08, 0.1],
      [0.08, 0.1],
      [-0.08, -0.13],
      [0.08, -0.13],
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.06), bodyMat);
      leg.position.set(lx, 0.05, lz);
      group.add(leg);
      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.03, 0.062), hoofMat);
      hoof.position.set(lx, 0.015, lz);
      group.add(hoof);
    }
  } else if (role === 'capybara') {
    shadowRadius = 0.54;
    auraRadius = 0.29;
    const coats = [0x9c6644, 0x8b5a3c, 0xa47148, 0x7f5539];
    const bodyMat = mat(coats[s0 % coats.length], 0.84);
    const snoutMat = mat(0x5c3d2e, 0.86);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.4), bodyMat);
    body.position.set(0, 0.17, -0.02);
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.15, 0.22), bodyMat);
    head.position.set(0, 0.26, 0.22);
    head.castShadow = true;
    group.add(head);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.05), snoutMat);
    nose.position.set(0, 0.24, 0.33);
    group.add(nose);

    for (const ex of [-0.065, 0.065]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.04), snoutMat);
      ear.position.set(ex, 0.35, 0.15);
      group.add(ear);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.025), darkEyeMat);
      eye.position.set(ex * 1.32, 0.29, 0.25);
      group.add(eye);
    }

    for (const [lx, lz] of [
      [-0.085, 0.12],
      [0.085, 0.12],
      [-0.085, -0.15],
      [0.085, -0.15],
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.065), snoutMat);
      leg.position.set(lx, 0.045, lz);
      group.add(leg);
    }
  } else if (role === 'cow') {
    shadowRadius = 0.66;
    auraRadius = 0.34;
    const isHolstein = s0 % 3 !== 1;
    const baseMat = mat(isHolstein ? 0xf8fafc : 0x9c5a25, 0.78);
    const spotMat = mat(isHolstein ? 0x1e2026 : 0xf2dfc4, 0.8);
    const muzzleMat = mat(0xf4b6c2, 0.65);
    const hornMat = mat(0xe8dec8, 0.5);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.5), baseMat);
    body.position.set(0, 0.27, -0.02);
    body.castShadow = true;
    group.add(body);

    const patch1 = new THREE.Mesh(new THREE.BoxGeometry(0.295, 0.16, 0.2), spotMat);
    patch1.position.set(0, 0.3, -0.08);
    group.add(patch1);
    const patch2 = new THREE.Mesh(new THREE.BoxGeometry(0.295, 0.14, 0.14), spotMat);
    patch2.position.set(0, 0.24, 0.14);
    group.add(patch2);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), baseMat);
    head.position.set(0, 0.36, 0.29);
    head.castShadow = true;
    group.add(head);

    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.08), muzzleMat);
    muzzle.position.set(0, 0.3, 0.39);
    group.add(muzzle);

    for (const hx of [-0.11, 0.11]) {
      const horn = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.045, 0.045), hornMat);
      horn.position.set(hx, 0.45, 0.28);
      horn.rotation.z = hx < 0 ? 0.3 : -0.3;
      group.add(horn);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.025), darkEyeMat);
      eye.position.set(hx * 0.92, 0.39, 0.36);
      group.add(eye);
    }

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), spotMat);
    tail.position.set(0, 0.26, -0.29);
    tail.rotation.x = 0.2;
    group.add(tail);

    for (const [lx, lz] of [
      [-0.09, 0.16],
      [0.09, 0.16],
      [-0.09, -0.2],
      [0.09, -0.2],
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.07), baseMat);
      leg.position.set(lx, 0.08, lz);
      group.add(leg);
    }
  } else if (role === 'wolf') {
    shadowRadius = 0.56;
    auraRadius = 0.3;
    const coats = [0x7b848f, 0xd8dee9, 0x434850, 0x8f7a66];
    const furColor = coats[s0 % coats.length];
    const furMat = mat(furColor, 0.78);
    const ruffMat = mat(s0 % 4 === 1 ? 0xf8fafc : 0xcbd5e1, 0.8);
    const eyeMat = mat(0xfbbf24, 0.3, 0.2, 0xf59e0b, 0.45);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.19, 0.42), furMat);
    body.position.set(0, 0.23, -0.02);
    body.castShadow = true;
    group.add(body);

    const ruff = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.21, 0.14), ruffMat);
    ruff.position.set(0, 0.25, 0.15);
    group.add(ruff);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.17), furMat);
    head.position.set(0, 0.32, 0.24);
    head.castShadow = true;
    group.add(head);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.12), furMat);
    snout.position.set(0, 0.29, 0.36);
    group.add(snout);

    for (const ex of [-0.055, 0.055]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.085, 4), furMat);
      ear.position.set(ex, 0.43, 0.22);
      group.add(ear);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.02, 0.02), eyeMat);
      eye.position.set(ex * 0.95, 0.34, 0.325);
      group.add(eye);
    }

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.24), furMat);
    tail.position.set(0, 0.27, -0.31);
    tail.rotation.x = 0.45;
    group.add(tail);

    for (const [lx, lz] of [
      [-0.065, 0.14],
      [0.065, 0.14],
      [-0.065, -0.18],
      [0.065, -0.18],
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.16, 0.055), furMat);
      leg.position.set(lx, 0.08, lz);
      group.add(leg);
    }
  } else if (role === 'bear') {
    shadowRadius = 0.72;
    auraRadius = 0.38;
    const coats = [0x6f4528, 0x2b2523, 0x855331, 0xe8edf2];
    const furMat = mat(coats[s0 % coats.length], 0.85);
    const snoutMat = mat(s0 % 4 === 3 ? 0xdbe3ea : 0xb08968, 0.8);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.54), furMat);
    body.position.set(0, 0.3, -0.02);
    body.castShadow = true;
    group.add(body);

    const hump = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.22), furMat);
    hump.position.set(0, 0.47, 0.12);
    group.add(hump);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.23, 0.24), furMat);
    head.position.set(0, 0.4, 0.32);
    head.castShadow = true;
    group.add(head);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.1), snoutMat);
    snout.position.set(0, 0.36, 0.45);
    group.add(snout);

    for (const ex of [-0.095, 0.095]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.065, 0.045), furMat);
      ear.position.set(ex, 0.52, 0.28);
      group.add(ear);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.02), darkEyeMat);
      eye.position.set(ex * 0.75, 0.43, 0.44);
      group.add(eye);
    }

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), furMat);
    tail.position.set(0, 0.35, -0.31);
    group.add(tail);

    for (const [lx, lz] of [
      [-0.12, 0.18],
      [0.12, 0.18],
      [-0.12, -0.2],
      [0.12, -0.2],
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.11), furMat);
      leg.position.set(lx, 0.09, lz);
      group.add(leg);
    }
  } else if (role === 'dinosaur') {
    shadowRadius = 0.85;
    auraRadius = 0.46;
    const morph = s0 % 3;
    const skinPalettes = [0x3b7a48, 0x7c5c3e, 0x2d6a6a, 0x8b4a39];
    const scaleMat = mat(skinPalettes[s1 % skinPalettes.length], 0.72);
    const bellyMat = mat(0xc2b280, 0.78);
    const hornMat = mat(0xf4ecd8, 0.45);

    if (morph === 0) {
      // Tyrannosaur biped predator
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.54), scaleMat);
      torso.position.set(0, 0.44, 0.02);
      torso.rotation.x = -0.22;
      torso.castShadow = true;
      group.add(torso);

      const belly = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.42), bellyMat);
      belly.position.set(0, 0.39, 0.05);
      belly.rotation.x = -0.22;
      group.add(belly);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.36), scaleMat);
      head.position.set(0, 0.69, 0.34);
      head.castShadow = true;
      group.add(head);

      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.08, 0.3), bellyMat);
      jaw.position.set(0, 0.55, 0.33);
      group.add(jaw);

      for (const tx of [-0.07, 0.07]) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.04), hornMat);
        tooth.position.set(tx, 0.59, 0.47);
        group.add(tooth);
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.035, 0.035), mat(0xfbbf24, 0.3, 0.2, 0xf59e0b, 0.4));
        eye.position.set(tx * 1.85, 0.73, 0.35);
        group.add(eye);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.14), scaleMat);
        arm.position.set(tx * 2.3, 0.41, 0.26);
        group.add(arm);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.14), scaleMat);
        leg.position.set(tx * 1.9, 0.15, -0.02);
        group.add(leg);
      }

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.17, 0.52), scaleMat);
      tail.position.set(0, 0.44, -0.44);
      tail.rotation.x = 0.14;
      group.add(tail);
    } else if (morph === 1) {
      // Triceratops armored horned quadruped
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.58), scaleMat);
      body.position.set(0, 0.32, -0.02);
      body.castShadow = true;
      group.add(body);

      const frill = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 0.09), scaleMat);
      frill.position.set(0, 0.47, 0.26);
      frill.rotation.x = -0.22;
      frill.castShadow = true;
      group.add(frill);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.26), scaleMat);
      head.position.set(0, 0.35, 0.39);
      group.add(head);

      for (const hx of [-0.11, 0.11]) {
        const browHorn = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.24, 5), hornMat);
        browHorn.rotation.x = Math.PI * 0.42;
        browHorn.position.set(hx, 0.47, 0.49);
        group.add(browHorn);
      }
      const noseHorn = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.14, 5), hornMat);
      noseHorn.rotation.x = Math.PI * 0.32;
      noseHorn.position.set(0, 0.39, 0.52);
      group.add(noseHorn);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.36), scaleMat);
      tail.position.set(0, 0.28, -0.42);
      group.add(tail);

      for (const [lx, lz] of [
        [-0.13, 0.18],
        [0.13, 0.18],
        [-0.13, -0.2],
        [0.13, -0.2],
      ]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.11), scaleMat);
        leg.position.set(lx, 0.1, lz);
        group.add(leg);
      }
    } else {
      // Stegosaurus plated herbivore
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.62), scaleMat);
      body.position.set(0, 0.32, 0);
      body.castShadow = true;
      group.add(body);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.22), scaleMat);
      head.position.set(0, 0.34, 0.4);
      group.add(head);

      const plateMat = mat(0xe09f3e, 0.6);
      for (let pi = 0; pi < 5; pi++) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.17, 0.11), plateMat);
        plate.position.set(pi % 2 === 0 ? -0.05 : 0.05, 0.54, 0.22 - pi * 0.13);
        plate.rotation.x = 0.12;
        group.add(plate);
      }

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.42), scaleMat);
      tail.position.set(0, 0.32, -0.45);
      group.add(tail);
      for (const sx of [-0.07, 0.07]) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 4), hornMat);
        spike.rotation.z = sx < 0 ? 0.8 : -0.8;
        spike.position.set(sx, 0.38, -0.58);
        group.add(spike);
      }

      for (const [lx, lz] of [
        [-0.12, 0.2],
        [0.12, 0.2],
        [-0.12, -0.2],
        [0.12, -0.2],
      ]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), scaleMat);
        leg.position.set(lx, 0.1, lz);
        group.add(leg);
      }
    }
  } else if (role === 'dragon') {
    shadowRadius = 0.95;
    auraRadius = 0.52;
    const dragonVariants = [
      { body: 0xb91c1c, belly: 0xf59e0b, wing: 0x7f1d1d, glow: 0xff6b35 }, // Crimson Ember
      { body: 0x15803d, belly: 0xd9f99d, wing: 0x14532d, glow: 0x4ade80 }, // Jade Wyrm
      { body: 0xd97706, belly: 0xfef3c7, wing: 0x92400e, glow: 0xfacc15 }, // Solar Aureate
      { body: 0x312e81, belly: 0x7dd3fc, wing: 0x1e1b4b, glow: 0x38bdf8 }, // Void Astral
    ];
    const dv = dragonVariants[s0 % dragonVariants.length];
    const scaleMat = mat(dv.body, 0.42, 0.32);
    const bellyMat = mat(dv.belly, 0.48, 0.2, dv.glow, 0.18);
    const wingMat = mat(dv.wing, 0.55, 0.15, 0, 0);
    wingMat.side = THREE.DoubleSide;
    const hornMat = mat(0xf1e6d2, 0.35, 0.25);
    const eyeMat = mat(dv.glow, 0.2, 0.1, dv.glow, 1.0);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.62), scaleMat);
    torso.position.set(0, 0.34, 0);
    torso.castShadow = true;
    group.add(torso);

    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.52), bellyMat);
    chestPlate.position.set(0, 0.22, 0.02);
    group.add(chestPlate);

    // Arched serpentine neck & horned dragon head
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.18), scaleMat);
    neck.position.set(0, 0.52, 0.32);
    neck.rotation.x = 0.32;
    group.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.34), scaleMat);
    head.position.set(0, 0.69, 0.47);
    head.castShadow = true;
    group.add(head);

    const fireMaw = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.1), eyeMat);
    fireMaw.position.set(0, 0.62, 0.62);
    group.add(fireMaw);

    for (const hx of [-0.09, 0.09]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.24, 5), hornMat);
      horn.rotation.x = -0.75;
      horn.rotation.z = hx < 0 ? 0.22 : -0.22;
      horn.position.set(hx, 0.84, 0.38);
      group.add(horn);

      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.032, 0.04), eyeMat);
      eye.position.set(hx * 1.25, 0.72, 0.53);
      group.add(eye);
    }

    // Long spiked tail
    const tail1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.42), scaleMat);
    tail1.position.set(0, 0.32, -0.45);
    group.add(tail1);
    const tail2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.36), scaleMat);
    tail2.position.set(0, 0.36, -0.76);
    tail2.rotation.x = 0.22;
    group.add(tail2);

    // Articulated left & right wing pivots for animated wing flapping
    const wingPivotL = new THREE.Group();
    wingPivotL.position.set(-0.16, 0.44, 0.06);
    wingPivotL.name = 'wing_l';
    const wingBoneL = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 0.07), scaleMat);
    wingBoneL.position.set(-0.29, 0.04, 0.04);
    wingPivotL.add(wingBoneL);
    const wingMemL = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.38), wingMat);
    wingMemL.position.set(-0.28, 0.02, -0.14);
    wingMemL.castShadow = true;
    wingPivotL.add(wingMemL);
    group.add(wingPivotL);

    const wingPivotR = new THREE.Group();
    wingPivotR.position.set(0.16, 0.44, 0.06);
    wingPivotR.name = 'wing_r';
    const wingBoneR = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 0.07), scaleMat);
    wingBoneR.position.set(0.29, 0.04, 0.04);
    wingPivotR.add(wingBoneR);
    const wingMemR = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.38), wingMat);
    wingMemR.position.set(0.28, 0.02, -0.14);
    wingMemR.castShadow = true;
    wingPivotR.add(wingMemR);
    group.add(wingPivotR);

    for (const [lx, lz] of [
      [-0.14, 0.18],
      [0.14, 0.18],
      [-0.14, -0.2],
      [0.14, -0.2],
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), scaleMat);
      leg.position.set(lx, 0.1, lz);
      group.add(leg);
    }
  } else {
    // Unicorn: radiant ivory steed, golden spiral horn & pastel mane
    shadowRadius = 0.64;
    auraRadius = 0.36;
    const coatHex = s0 % 3 === 0 ? 0xfafafa : s0 % 3 === 1 ? 0xf3e8ff : 0xe0f2fe;
    const bodyMat = mat(coatHex, 0.45, 0.12);
    const hoofMat = mat(0xf5b742, 0.3, 0.7);
    const hornMat = mat(0xffd166, 0.2, 0.6, 0xfbbf24, 0.85);
    const maneColors = [0xf472b6, 0x72efdd, 0xc084fc];

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.23, 0.5), bodyMat);
    body.position.set(0, 0.34, -0.02);
    body.castShadow = true;
    group.add(body);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.14), bodyMat);
    neck.position.set(0, 0.49, 0.22);
    neck.rotation.x = 0.35;
    neck.castShadow = true;
    group.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.24), bodyMat);
    head.position.set(0, 0.61, 0.32);
    head.castShadow = true;
    group.add(head);

    // Spiraled golden horn
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.24, 6), hornMat);
    horn.rotation.x = 0.42;
    horn.position.set(0, 0.76, 0.42);
    group.add(horn);

    // Multi-tone radiant mane & tail
    for (let mi = 0; mi < 3; mi++) {
      const mMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.1, 0.08),
        mat(maneColors[mi], 0.5, 0.1, maneColors[mi], 0.25),
      );
      mMesh.position.set(0, 0.64 - mi * 0.08, 0.21 - mi * 0.03);
      group.add(mMesh);
    }

    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.24, 0.1),
      mat(maneColors[s1 % maneColors.length], 0.48, 0.1, maneColors[s1 % maneColors.length], 0.25),
    );
    tail.position.set(0, 0.33, -0.32);
    tail.rotation.x = 0.45;
    group.add(tail);

    for (const ex of [-0.078, 0.078]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.07, 4), bodyMat);
      ear.position.set(ex * 0.72, 0.71, 0.25);
      group.add(ear);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.026, 0.03), mat(0x38bdf8, 0.25, 0.1, 0x38bdf8, 0.55));
      eye.position.set(ex, 0.62, 0.36);
      group.add(eye);
    }

    for (const [lx, lz] of [
      [-0.08, 0.16],
      [0.08, 0.16],
      [-0.08, -0.2],
      [0.08, -0.2],
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), bodyMat);
      leg.position.set(lx, 0.13, lz);
      group.add(leg);
      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.04, 0.064), hoofMat);
      hoof.position.set(lx, 0.02, lz);
      group.add(hoof);
    }
  }

  group.add(createContactShadow(shadowRadius));

  const auraGeo = new THREE.RingGeometry(auraRadius * 0.78, auraRadius * 1.04, 14);
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

export function createUnitGroup(
  role: UnitRole,
  faction: 'civilization' | 'hostile' | 'wildlife',
  epochLevel = 0,
  species: SpeciesId = 'human',
  appearanceSeed = 1,
  ageStage: UnitAgeStage = 'adult',
): THREE.Group {
  const group = new THREE.Group();
  const isChild = ageStage === 'child' && faction === 'civilization';

  // Orthogonal deterministic hashes per individual so each person is visually distinct
  const seed = Math.abs(Math.floor(appearanceSeed) || 1);
  const s0 = Math.abs(Math.imul(seed ^ 0x9e3779b9, 2654435761)) >>> 0;
  const s1 = Math.abs(Math.imul(seed ^ 0x85ebca6b, 2246822519)) >>> 0;
  const s2 = Math.abs(Math.imul(seed ^ 0xc2b2ae35, 3266489917)) >>> 0;
  const s3 = Math.abs(Math.imul(seed ^ 0x27d4eb2f, 668265263)) >>> 0;

  if (
    role === 'cow' ||
    role === 'bear' ||
    role === 'wolf' ||
    role === 'chicken' ||
    role === 'pig' ||
    role === 'capybara' ||
    role === 'dinosaur' ||
    role === 'dragon' ||
    role === 'unicorn'
  ) {
    return buildCreatureUnitGroup(group, role, s0, s1, s2, s3);
  }

  const resolvedSpecies: SpeciesId =
    role === 'elf' ? 'elf' : role === 'orc' ? 'orc' : role === 'human' ? 'human' : species;

  const shadowRadius = isChild ? 0.42 : species === 'orc' ? 0.68 : 0.58;
  group.add(createContactShadow(shadowRadius));

  // 1. Diverse multi-ethnic skin tones per race
  const humanSkins = [
    0xf8dcc8, // pale ivory
    0xecc1a1, // warm peach
    0xdba67b, // golden olive
    0xc48a54, // warm tan
    0xa5693c, // rich bronze
    0x885028, // caramel brown
    0x6c3d1e, // chestnut umber
    0x4e2b16, // deep mahogany
    0x371d0f, // dark espresso
  ];
  const elfSkins = [
    0xfaeadc, // moonlit porcelain
    0xebc3a1, // sun-elf warm fair
    0xc98c63, // woodland bronze
    0x996240, // forest amber brown
    0x7d7698, // moon-elf twilight ash
    0xd3e1ea, // frost silver-kin
    0xe7c67f, // golden fey
    0xa28bb0, // dusk lavender
  ];
  const orcSkins = [
    0x5b8c42, // moss green
    0x3d6930, // deep forest green
    0x7d9e44, // chartreuse olive
    0x636b78, // iron slate-grey
    0x494952, // cinder charcoal
    0x9c4d35, // mag'har russet ochre
    0xb35f3c, // red-clay warclan
    0x8f825b, // dune tan
  ];
  const hostileSkins = [0x8f5656, 0x544a4e, 0x4c6b3a, 0x5c446e, 0x9c5e42];

  const skinPool =
    faction === 'hostile'
      ? hostileSkins
      : resolvedSpecies === 'orc'
        ? orcSkins
        : resolvedSpecies === 'elf'
          ? elfSkins
          : humanSkins;
  const skinHex = skinPool[s0 % skinPool.length];
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinHex,
    roughness: 0.64,
  });

  // 2. Diverse hair color & styles
  const humanHairs = isChild
    ? [0x1c1917, 0x3d2817, 0x6e4228, 0x9e472a, 0xe3b549, 0xd17a36, 0x2c221e]
    : [0x1c1917, 0x3d2817, 0x6e4228, 0x9e472a, 0xe3b549, 0xd17a36, 0xcbd5e1];
  const elfHairs = isChild
    ? [0xf4d35e, 0xc46d5e, 0x1e202b, 0x3a7d5c, 0xb89ce6, 0xe8eef5]
    : [0xe8eef5, 0xf4d35e, 0x3a7d5c, 0x1e202b, 0xc46d5e, 0xb89ce6, 0x9be7dc];
  const orcHairs = isChild
    ? [0x18181b, 0x8c3b28, 0x4a4b52, 0xcfc7b8]
    : [0x18181b, 0xdcd4c2, 0xb54229, 0x4a4b52, 0x633224];
  const hairPool =
    resolvedSpecies === 'elf' ? elfHairs : resolvedSpecies === 'orc' ? orcHairs : humanHairs;
  const hairMat = new THREE.MeshStandardMaterial({
    color: hairPool[(s0 >> 4) % hairPool.length],
    roughness: 0.72,
  });

  // 3. Individual outfit & accent variety (respecting role/epoch flavor while giving unique wardrobe)
  const roleBasePalette: Partial<Record<UnitRole, number[]>> = {
    human:
      epochLevel >= 6
        ? [0xd8dee9, 0x90e0ef, 0xe2e8f0, 0xc77dff, 0xf8fafc]
        : epochLevel >= 3
          ? [0x3b6e8c, 0x7f4f24, 0x4a5568, 0x9e2a2b, 0x2d6a4f, 0x5c4d7d]
          : [0x4ea8de, 0xe07a5f, 0x3d405b, 0x81b29a, 0xd9a05b, 0x9b5de5, 0xc1554d],
    elf:
      epochLevel >= 6
        ? [0x80ed99, 0x72efdd, 0xe0fbfc, 0xb8f2e6, 0x9d4edd]
        : [0x388e5a, 0x2d6a4f, 0x4895ef, 0xc97b63, 0x7b2cbf, 0x8c6d46, 0x2a9d8f],
    orc:
      epochLevel >= 6
        ? [0x9b2226, 0x5a189a, 0xbb3e03, 0x334155]
        : [0x8d3b2b, 0x6b2d26, 0x495057, 0x7f4f24, 0x9b2226, 0x3f4e37],
    villager:
      epochLevel >= 6
        ? [0xd8dee9, 0x72efdd, 0xcbd5e1]
        : [0x4ea8de, 0xe07a5f, 0x52b788, 0xe9c46a, 0x8d5b4c, 0x7b68ee],
    forager: [0x52b788, 0x74c69d, 0x40916c, 0x95d5b2],
    miner: [0xe09f3e, 0xca6702, 0x9a6b38, 0xbb8530],
    builder: [0xd97736, 0xbc6c25, 0xe07a5f, 0x9c6644],
    warrior: [0xd62828, 0x9b2226, 0x495057, 0x1d3557],
    priest: [0xf4a261, 0xf8fafc, 0xf5b742, 0x9d4edd],
    scholar: [0x7209b7, 0x3a0ca3, 0x4361ee, 0x8338ec],
    astro_engineer: [0x56cfe1, 0x4ea8de, 0xe0fbfc, 0x72efdd],
    raider_swarmer: [0x9b2226, 0x6a040f, 0x370617, 0x5c374c],
    raider_ranged: [0xae2012, 0x9b2226, 0x4a4e69, 0x7f4f24],
    raider_behemoth: [0x3c096c, 0x240046, 0x6a040f, 0x2b2d42],
  };
  const childTunics = [0xffb703, 0x4cc9f0, 0x80ed99, 0xf28482, 0x90dbf4, 0xf4a261, 0xc77dff];
  const tunicChoices = isChild ? childTunics : roleBasePalette[role] ?? [0x4ea8de];
  const tunicColor = tunicChoices[s1 % tunicChoices.length];

  const sashChoices = [0xf5b742, 0xe63946, 0xf1faee, 0x2ec4b6, 0x7f4f24, 0x9d4edd, 0x52b788];
  const sashColor = sashChoices[(s1 >> 5) % sashChoices.length];

  const tunicMat = new THREE.MeshStandardMaterial({
    color: tunicColor,
    roughness: epochLevel >= 4 && !isChild ? 0.35 : 0.58,
    metalness:
      !isChild && (role === 'warrior' || role === 'astro_engineer' || epochLevel >= 5) ? 0.42 : 0.08,
  });
  const sashMat = new THREE.MeshStandardMaterial({
    color: sashColor,
    roughness: 0.55,
  });

  const pantPalette = [0x2b2d42, 0x4a3b2c, 0x3d405b, 0x5c4738, 0x264653, 0x6b5848];
  const pantMat = new THREE.MeshStandardMaterial({
    color: pantPalette[(s2 >> 3) % pantPalette.length],
    roughness: 0.78,
  });

  // 4. Individual height, build, and head ratio (Children noticeably smaller & rounder-headed)
  const heightVariance = isChild
    ? 0.62 + ((s1 & 7) / 7) * 0.11
    : 0.90 + ((s1 & 15) / 15) * 0.22;
  const widthVariance = isChild
    ? 0.88 + (((s1 >> 3) & 7) / 7) * 0.11
    : 0.90 + (((s1 >> 4) & 15) / 15) * 0.20;

  const baseSpeciesScale =
    role === 'raider_behemoth'
      ? 1.45
      : resolvedSpecies === 'orc'
        ? 1.13
        : resolvedSpecies === 'elf'
          ? 0.99
          : 1.0;
  const scale = baseSpeciesScale * heightVariance;
  const widthMult =
    (resolvedSpecies === 'orc' ? 1.22 : resolvedSpecies === 'elf' ? 0.86 : 1.0) * widthVariance;
  const headMult = isChild ? 1.22 : 1.0;

  // 1. Legs
  const legL = new THREE.Mesh(
    new THREE.BoxGeometry(0.08 * scale * widthMult, 0.14 * scale, 0.08 * scale),
    pantMat,
  );
  legL.position.set(-0.055 * scale * widthMult, 0.07 * scale, 0);
  group.add(legL);

  const legR = new THREE.Mesh(
    new THREE.BoxGeometry(0.08 * scale * widthMult, 0.14 * scale, 0.08 * scale),
    pantMat,
  );
  legR.position.set(0.055 * scale * widthMult, 0.07 * scale, 0);
  group.add(legR);

  // 2. Torso + individual belt/sash or shoulder cloak
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.2 * scale * widthMult, 0.22 * scale, 0.14 * scale),
    tunicMat,
  );
  torso.position.y = 0.24 * scale;
  torso.castShadow = true;
  group.add(torso);

  const bodyDetailMode = s3 % 4;
  if (bodyDetailMode === 0 || isChild) {
    // Vibrant waistband / collar stripe
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.215 * scale * widthMult, 0.045 * scale, 0.152 * scale),
      sashMat,
    );
    belt.position.y = isChild ? 0.28 * scale : 0.18 * scale;
    group.add(belt);
  } else if (bodyDetailMode === 1) {
    // Diagonal scarf / shoulder sash
    const sash = new THREE.Mesh(
      new THREE.BoxGeometry(0.21 * scale * widthMult, 0.055 * scale, 0.155 * scale),
      sashMat,
    );
    sash.position.y = 0.31 * scale;
    sash.rotation.z = 0.22;
    group.add(sash);
  } else if (bodyDetailMode === 2) {
    // Explorer backpack or traveler cloak
    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.14 * scale * widthMult, 0.16 * scale, 0.07 * scale),
      sashMat,
    );
    pack.position.set(0, 0.25 * scale, -0.095 * scale);
    group.add(pack);
  } else if (resolvedSpecies === 'orc' || role === 'warrior') {
    // Asymmetric pauldron guard
    const pauldron = new THREE.Mesh(
      new THREE.BoxGeometry(0.085 * scale * widthMult, 0.075 * scale, 0.16 * scale),
      sashMat,
    );
    pauldron.position.set(-0.11 * scale * widthMult, 0.33 * scale, 0);
    group.add(pauldron);
  }

  // 3. Head (+ species ears / tusks / facial hair)
  const headSizeX = 0.18 * scale * widthMult * headMult;
  const headSizeY = 0.18 * scale * headMult;
  const headSizeZ = 0.18 * scale * headMult;
  const headCenterY = (isChild ? 0.455 : 0.44) * scale;

  const head = new THREE.Mesh(new THREE.BoxGeometry(headSizeX, headSizeY, headSizeZ), skinMat);
  head.position.y = headCenterY;
  head.castShadow = true;
  group.add(head);

  if (resolvedSpecies === 'elf' && faction === 'civilization') {
    const earGeo = new THREE.BoxGeometry(0.085 * scale, 0.045 * scale, 0.04 * scale);
    const earL = new THREE.Mesh(earGeo, skinMat);
    earL.position.set(-headSizeX * 0.68, headCenterY + 0.01 * scale, -0.01 * scale);
    earL.rotation.z = 0.36;
    group.add(earL);
    const earR = new THREE.Mesh(earGeo, skinMat);
    earR.position.set(headSizeX * 0.68, headCenterY + 0.01 * scale, -0.01 * scale);
    earR.rotation.z = -0.36;
    group.add(earR);
  } else if (resolvedSpecies === 'orc') {
    const tuskMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.45 });
    const tuskH = isChild ? 0.032 : 0.055;
    const tuskGeo = new THREE.BoxGeometry(0.03 * scale, tuskH * scale, 0.03 * scale);
    const tuskStyle = s2 % 5; // 0-3 both tusks, 4 single chipped tusk
    const tuskL = new THREE.Mesh(tuskGeo, tuskMat);
    tuskL.position.set(-0.055 * scale * headMult, headCenterY - 0.04 * scale, 0.1 * scale * headMult);
    group.add(tuskL);
    if (tuskStyle !== 4) {
      const tuskR = new THREE.Mesh(tuskGeo, tuskMat);
      tuskR.position.set(0.055 * scale * headMult, headCenterY - 0.04 * scale, 0.1 * scale * headMult);
      group.add(tuskR);
    }
  }

  // Facial hair / warpaint on adults
  if (!isChild && faction === 'civilization') {
    if ((resolvedSpecies === 'human' || resolvedSpecies === 'orc') && (s3 % 6 === 0 || s3 % 6 === 1)) {
      const beard = new THREE.Mesh(
        new THREE.BoxGeometry(headSizeX * 0.72, 0.065 * scale, 0.04 * scale),
        hairMat,
      );
      beard.position.set(0, headCenterY - headSizeY * 0.36, headSizeZ * 0.48);
      group.add(beard);
    } else if (resolvedSpecies === 'orc' && s3 % 6 === 2) {
      // War-paint stripe
      const paint = new THREE.Mesh(
        new THREE.BoxGeometry(headSizeX * 1.03, 0.032 * scale, headSizeZ * 1.03),
        sashMat,
      );
      paint.position.set(0, headCenterY + 0.01 * scale, 0);
      group.add(paint);
    }
  }

  // 4. Expressive Sculpted Hairstyles + Optional Epoch Headgear
  const hairStyle = s2 % 7;
  const hairTopY = headCenterY + headSizeY * 0.52;
  if (hairStyle !== 6 || isChild) {
    // Top hair cap (skip only for bald adults on style 6)
    const capH = hairStyle === 4 ? 0.085 : 0.055;
    const capW = hairStyle === 4 ? headSizeX * 1.24 : headSizeX * 1.08;
    const capD = hairStyle === 4 ? headSizeZ * 1.2 : headSizeZ * 1.08;
    const hairCap = new THREE.Mesh(
      new THREE.BoxGeometry(capW, capH * scale, capD),
      hairMat,
    );
    hairCap.position.set(0, hairTopY + (hairStyle === 4 ? 0.025 : 0.01) * scale, 0);
    group.add(hairCap);
  }

  if (hairStyle === 1) {
    // Flowing long locks down the back
    const backHair = new THREE.Mesh(
      new THREE.BoxGeometry(headSizeX * 1.02, 0.16 * scale, 0.06 * scale),
      hairMat,
    );
    backHair.position.set(0, headCenterY - 0.04 * scale, -headSizeZ * 0.48);
    group.add(backHair);
  } else if (hairStyle === 2) {
    // Twin side pigtails / hair buns (classic child & elven look)
    const bunGeo = new THREE.BoxGeometry(0.065 * scale, 0.075 * scale, 0.065 * scale);
    const bunL = new THREE.Mesh(bunGeo, hairMat);
    bunL.position.set(-headSizeX * 0.62, hairTopY - 0.01 * scale, -0.02 * scale);
    group.add(bunL);
    const bunR = new THREE.Mesh(bunGeo, hairMat);
    bunR.position.set(headSizeX * 0.62, hairTopY - 0.01 * scale, -0.02 * scale);
    group.add(bunR);
  } else if (hairStyle === 3) {
    // Tall topknot / mohawk crest
    const crest = new THREE.Mesh(
      new THREE.BoxGeometry(0.055 * scale, 0.11 * scale, headSizeZ * 0.92),
      hairMat,
    );
    crest.position.set(0, hairTopY + 0.06 * scale, -0.01 * scale);
    group.add(crest);
  } else if (hairStyle === 5) {
    // Ponytail / braid in back
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.06 * scale, 0.13 * scale, 0.06 * scale),
      hairMat,
    );
    tail.position.set(0, headCenterY - 0.01 * scale, -headSizeZ * 0.56);
    tail.rotation.x = 0.28;
    group.add(tail);
  }

  // Hats / Helmets / Circlets on military roles, high epochs, or select adults (never hiding children's cute hairstyles unless a small headband!)
  const wearsHeadgear =
    !isChild &&
    (faction === 'hostile' ||
      role === 'warrior' ||
      role === 'priest' ||
      role === 'astro_engineer' ||
      epochLevel >= 5 ||
      s3 % 5 === 0);

  if (wearsHeadgear) {
    const hatColor =
      faction === 'hostile'
        ? 0x222222
        : resolvedSpecies === 'elf'
          ? epochLevel >= 5
            ? 0x72efdd
            : 0xf5b742
          : resolvedSpecies === 'orc'
            ? epochLevel >= 2
              ? 0x5c677d
              : 0x2b2522
            : role === 'astro_engineer' || epochLevel >= 6
              ? 0xeceff4
              : role === 'priest' || role === 'warrior' || epochLevel === 1
                ? 0xe9b44c
                : epochLevel >= 2
                  ? 0x8d99ae
                  : sashColor;
    const hatMat = new THREE.MeshStandardMaterial({
      color: hatColor,
      roughness: 0.4,
      metalness: role === 'warrior' || resolvedSpecies === 'elf' || epochLevel >= 1 ? 0.55 : 0.12,
    });
    const hat = new THREE.Mesh(
      new THREE.BoxGeometry(
        headSizeX * 1.12,
        (resolvedSpecies === 'elf' ? 0.045 : epochLevel >= 2 ? 0.08 : 0.06) * scale,
        headSizeZ * 1.12,
      ),
      hatMat,
    );
    hat.position.y = hairTopY + 0.045 * scale;
    group.add(hat);
  } else if (isChild && (s3 & 1) === 0) {
    // Colorful ribbon / headband for kids
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(headSizeX * 1.1, 0.028 * scale, headSizeZ * 1.1),
      sashMat,
    );
    band.position.y = headCenterY + headSizeY * 0.34;
    group.add(band);
  }

  if (!isChild && faction === 'civilization' && epochLevel >= 4) {
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(headSizeX * 0.88, 0.045 * scale, 0.04 * scale),
      new THREE.MeshBasicMaterial({ color: resolvedSpecies === 'orc' ? 0xff7b54 : 0x56cfe1 }),
    );
    visor.position.set(0, headCenterY + 0.01 * scale, headSizeZ * 0.51);
    group.add(visor);
  }

  // 5. Held Tool / Weapon / Child's Toy Stick
  if (!isChild || s2 % 3 === 0) {
    const toolMat = new THREE.MeshStandardMaterial({
      color: isChild
        ? 0x8d5b4c
        : resolvedSpecies === 'elf'
          ? 0xf5b742
          : resolvedSpecies === 'orc'
            ? 0xd62828
            : role === 'priest' || role === 'scholar'
              ? 0xf5b742
              : epochLevel >= 4
                ? 0x56cfe1
                : 0xadb5bd,
      metalness: isChild ? 0.05 : 0.6,
      roughness: isChild ? 0.85 : 0.3,
    });
    const tool = new THREE.Mesh(
      new THREE.BoxGeometry(
        (isChild ? 0.035 : resolvedSpecies === 'orc' ? 0.08 : 0.05) * scale,
        (isChild ? 0.16 : resolvedSpecies === 'elf' ? 0.34 : 0.28) * scale,
        (isChild ? 0.035 : 0.05) * scale,
      ),
      toolMat,
    );
    tool.position.set(0.14 * scale * widthMult, 0.27 * scale, 0.08 * scale);
    tool.rotation.x = 0.35;
    tool.name = 'held_tool';
    group.add(tool);
  }

  // 6. Carried Resource Bundle (shown when hauling lumber, berries, stone, ore, crystals)
  const carryMat = new THREE.MeshStandardMaterial({ color: 0x8f5d38, roughness: 0.7 });
  const carryBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.13 * scale, 0.13 * scale, 0.13 * scale),
    carryMat,
  );
  carryBox.position.set(0, 0.27 * scale, 0.14 * scale);
  carryBox.visible = false;
  carryBox.name = 'carry_box';
  group.add(carryBox);

  // 7. Status Ring (hidden unless blessed/cursed/frenzied/plagued)
  const auraGeo = new THREE.RingGeometry(0.22 * scale, 0.29 * scale, 12);
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

export function createVehicleGroup(
  type: VehicleType,
  epochLevel: number,
  species: SpeciesId = 'human',
  variantSeed = 0,
): THREE.Group {
  const group = new THREE.Group();
  const isElf = species === 'elf';
  const isOrc = species === 'orc';
  const variant = Math.abs(variantSeed);

  const raceBodyHex = isElf
    ? epochLevel >= 5
      ? 0xd8f3dc
      : 0x2ec4b6
    : isOrc
      ? 0x9b2226
      : epochLevel <= 3
        ? 0x3b4252
        : epochLevel === 4
          ? variant % 3 === 1
            ? 0xf4a261
            : 0x3a86ff
          : epochLevel === 5
            ? variant % 4 === 0
              ? 0xe63946
              : variant % 4 === 1
                ? 0x00b4d8
                : variant % 4 === 2
                  ? 0xe5e7eb
                  : 0x4361ee
            : 0xe2e8f0;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: raceBodyHex,
    roughness: epochLevel >= 5 ? 0.25 : 0.48,
    metalness: epochLevel >= 5 ? 0.55 : 0.25,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: isOrc ? 0x2b2d42 : isElf ? 0xf5b742 : 0x334155,
    roughness: 0.4,
    metalness: 0.5,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: isOrc ? 0xff7b54 : 0x90e0ef,
    emissive: isOrc ? 0xd62828 : 0x48bfe3,
    emissiveIntensity: epochLevel >= 5 ? 0.55 : 0.25,
    roughness: 0.15,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfff3bf });
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const glowMat = new THREE.MeshBasicMaterial({
    color: isElf ? 0x52f2c8 : isOrc ? 0xff5421 : 0x56cfe1,
  });

  if (type === 'roadster') {
    const contactShadow = createContactShadow(0.46);
    contactShadow.name = 'contact_shadow';
    group.add(contactShadow);

    const roadsterPaintHex =
      variant % 3 === 1 ? 0xf8fafc : variant % 3 === 2 ? 0x1e293b : 0xd90429;
    const roadsterMat = new THREE.MeshStandardMaterial({
      color: roadsterPaintHex,
      roughness: 0.14,
      metalness: 0.78,
    });
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.52,
      metalness: 0.35,
    });
    const alloyMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.22,
      metalness: 0.86,
    });
    const thrusterBodyMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.35,
      metalness: 0.75,
    });
    const coldGasOuterMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
    });
    const coldGasCoreMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
    });

    // Low-slung wedge chassis + carbon front splitter & rear diffuser
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.085, 0.44), roadsterMat);
    lowerBody.position.set(0, 0.08, 0);
    lowerBody.castShadow = true;
    group.add(lowerBody);

    const noseSlope = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.16), roadsterMat);
    noseSlope.position.set(0, 0.068, 0.19);
    noseSlope.rotation.x = 0.14;
    group.add(noseSlope);

    const frontSplitter = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.09), carbonMat);
    frontSplitter.position.set(0, 0.042, 0.22);
    group.add(frontSplitter);

    const rearDeck = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.055, 0.14), roadsterMat);
    rearDeck.position.set(0, 0.115, -0.15);
    group.add(rearDeck);

    // Targa open-top cockpit, panoramic raked windshield, rollbar & dual sport seats
    const cockpitTub = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.18), carbonMat);
    cockpitTub.position.set(0, 0.125, -0.01);
    group.add(cockpitTub);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.065, 0.11), glassMat);
    windshield.position.set(0, 0.15, 0.05);
    windshield.rotation.x = -0.38;
    group.add(windshield);

    const targaHoop = new THREE.Mesh(new THREE.BoxGeometry(0.195, 0.065, 0.045), roadsterMat);
    targaHoop.position.set(0, 0.155, -0.09);
    group.add(targaHoop);

    // 4 low-profile sport wheels + bright turbine alloy rims
    const wheelGeo = new THREE.BoxGeometry(0.045, 0.085, 0.085);
    const rimGeo = new THREE.BoxGeometry(0.05, 0.045, 0.045);
    for (const [wx, wz] of [
      [-0.12, 0.14],
      [0.12, 0.14],
      [-0.125, -0.14],
      [0.125, -0.14],
    ]) {
      const w = new THREE.Mesh(wheelGeo, tireMat);
      w.position.set(wx, 0.042, wz);
      group.add(w);
      const rim = new THREE.Mesh(rimGeo, alloyMat);
      rim.position.set(wx, 0.042, wz);
      group.add(rim);
    }

    // Sleek LED headlight blades & full-width crimson taillight bar
    for (const lx of [-0.075, 0.075]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.02), headlightMat);
      hl.position.set(lx, 0.072, 0.255);
      group.add(hl);
    }
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.024, 0.02), taillightMat);
    tailBar.position.set(0, 0.115, -0.228);
    group.add(tailBar);

    // SpaceX Cold-Gas Thruster Nozzles (twin rear rocket pods + twin belly VTOL nozzles)
    const nozzleGeo = new THREE.CylinderGeometry(0.022, 0.032, 0.06, 8);
    nozzleGeo.rotateX(Math.PI / 2);
    for (const nx of [-0.055, 0.055]) {
      const rearPod = new THREE.Mesh(nozzleGeo, thrusterBodyMat);
      rearPod.position.set(nx, 0.085, -0.235);
      group.add(rearPod);

      const plumeOuter = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.28, 7), coldGasOuterMat);
      plumeOuter.rotation.x = -Math.PI / 2;
      plumeOuter.position.set(nx, 0.085, -0.39);
      plumeOuter.name = 'thruster_plume';
      plumeOuter.visible = false;
      group.add(plumeOuter);

      const plumeCore = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.18, 6), coldGasCoreMat);
      plumeCore.rotation.x = -Math.PI / 2;
      plumeCore.position.set(nx, 0.085, -0.34);
      plumeCore.name = 'thruster_plume';
      plumeCore.visible = false;
      group.add(plumeCore);

      // Belly VTOL cold-gas jets for vertical jumps / hover spins
      const vtolPlume = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.24, 7), coldGasOuterMat);
      vtolPlume.rotation.x = Math.PI;
      vtolPlume.position.set(nx, -0.07, 0);
      vtolPlume.name = 'thruster_plume';
      vtolPlume.visible = false;
      group.add(vtolPlume);
    }
    return group;
  }

  if (type === 'car') {
    group.add(createContactShadow(0.42));
    const isBus = epochLevel >= 4 && variant % 4 === 0;
    const isHover = epochLevel >= 6;
    const len = isBus ? 0.5 : 0.36;
    const wid = isBus ? 0.22 : 0.2;
    const h = isBus ? 0.18 : 0.11;

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(wid, h, len), bodyMat);
    chassis.position.y = isHover ? 0.13 : 0.085;
    chassis.castShadow = true;
    group.add(chassis);

    if (!isBus) {
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(wid * 0.86, 0.09, len * 0.54),
        isHover ? glassMat : bodyMat,
      );
      cabin.position.set(0, isHover ? 0.21 : 0.165, -0.02);
      cabin.castShadow = true;
      group.add(cabin);

      const windshield = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.88, 0.06, len * 0.56), glassMat);
      windshield.position.set(0, isHover ? 0.2 : 0.155, -0.01);
      group.add(windshield);
    } else {
      const busWindows = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.01, 0.07, len * 0.86), glassMat);
      busWindows.position.set(0, isHover ? 0.16 : 0.125, 0);
      group.add(busWindows);
    }

    if (isHover) {
      const hoverPad = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.9, 0.03, len * 0.82), glowMat);
      hoverPad.position.y = 0.06;
      group.add(hoverPad);
    } else {
      const wheelGeo = new THREE.BoxGeometry(0.04, 0.075, 0.075);
      for (const [wx, wz] of [
        [-wid * 0.5, len * 0.3],
        [wid * 0.5, len * 0.3],
        [-wid * 0.5, -len * 0.3],
        [wid * 0.5, -len * 0.3],
      ]) {
        const w = new THREE.Mesh(wheelGeo, tireMat);
        w.position.set(wx, 0.038, wz);
        group.add(w);
      }
    }

    for (const lx of [-wid * 0.3, wid * 0.3]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.02), headlightMat);
      hl.position.set(lx, 0.09, len * 0.5 + 0.005);
      group.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.02), taillightMat);
      tl.position.set(lx, 0.09, -len * 0.5 - 0.005);
      group.add(tl);
    }
    return group;
  }

  if (type === 'train') {
    const isMaglev = epochLevel >= 6;
    const isMetro = epochLevel === 5;
    const isSteam = epochLevel <= 3;
    if (!isMetro && !isMaglev) {
      group.add(createContactShadow(0.62));
    }

    // Front Locomotive / Lead Metro Car (+Z) + Linked Passenger Coach (-Z)
    const leadZ = 0.24;
    const coachZ = -0.26;
    const railBaseY = isMetro || isMaglev ? 0.02 : 0.09;

    const leadMat = isSteam ? trimMat : bodyMat;
    const leadBody = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.44), leadMat);
    leadBody.position.set(0, railBaseY + 0.11, leadZ);
    leadBody.castShadow = true;
    group.add(leadBody);

    if (isSteam) {
      const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 8), trimMat);
      boiler.rotation.x = Math.PI / 2;
      boiler.position.set(0, railBaseY + 0.22, leadZ + 0.06);
      group.add(boiler);
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 6), trimMat);
      stack.position.set(0, railBaseY + 0.33, leadZ + 0.14);
      group.add(stack);
    } else {
      const aeroNose = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.12), glassMat);
      aeroNose.position.set(0, railBaseY + 0.11, leadZ + 0.22);
      group.add(aeroNose);
      const leadWin = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.08, 0.32), glassMat);
      leadWin.position.set(0, railBaseY + 0.14, leadZ);
      group.add(leadWin);
    }

    // Coach car trailing behind
    const coachBody = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.21, 0.42), bodyMat);
    coachBody.position.set(0, railBaseY + 0.105, coachZ);
    coachBody.castShadow = true;
    group.add(coachBody);

    const coachWin = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.34), glassMat);
    coachWin.position.set(0, railBaseY + 0.14, coachZ);
    group.add(coachWin);

    if (isMetro || isMaglev) {
      const roofAccent = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.86), glowMat);
      roofAccent.position.set(0, railBaseY + 0.23, 0);
      group.add(roofAccent);
    }

    const headLamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.025), headlightMat);
    headLamp.position.set(0, railBaseY + 0.08, leadZ + 0.24);
    group.add(headLamp);
    return group;
  }

  // Aircraft ('plane') aligned +Z forward with swept X wingspan
  const fuselageMat = isElf ? bodyMat : isOrc ? trimMat : new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.32, metalness: 0.35 });
  const wingMat = bodyMat;
  const isProp = epochLevel <= 4;
  const isOrbitalShuttle = epochLevel >= 6;

  // Fuselage
  const fuselage = new THREE.Mesh(
    new THREE.BoxGeometry(isOrbitalShuttle ? 0.24 : 0.2, 0.2, isOrbitalShuttle ? 0.96 : 1.06),
    fuselageMat,
  );
  fuselage.position.y = 0.2;
  fuselage.castShadow = true;
  group.add(fuselage);

  // Nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 6), fuselageMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.2, 0.64);
  group.add(nose);

  // Cockpit glass
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.22), glassMat);
  cockpit.position.set(0, 0.28, 0.42);
  group.add(cockpit);

  // Passenger window stripe
  const cabStrip = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.045, 0.56), glassMat);
  cabStrip.position.set(0, 0.22, 0.02);
  group.add(cabStrip);

  // Main Wings
  const wingSpan = isOrbitalShuttle ? 1.18 : 1.38;
  const mainWing = new THREE.Mesh(new THREE.BoxGeometry(wingSpan, 0.05, 0.34), wingMat);
  mainWing.position.set(0, 0.18, 0.04);
  mainWing.castShadow = true;
  group.add(mainWing);

  // Tailplane + Vertical Stabilizer
  const hTail = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.04, 0.18), wingMat);
  hTail.position.set(0, 0.22, -0.44);
  group.add(hTail);
  const vTail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.22), wingMat);
  vTail.position.set(0, 0.36, -0.44);
  vTail.castShadow = true;
  group.add(vTail);

  // Engines (Propellers in Atomic vs Twin Jet Pods / Plasma Thrusters in Info/Orbital)
  for (const ex of [-0.36, 0.36]) {
    const pod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.06, 0.22, 6),
      isOrbitalShuttle ? glowMat : trimMat,
    );
    pod.rotation.x = Math.PI / 2;
    pod.position.set(ex, 0.14, 0.12);
    group.add(pod);

    if (isProp) {
      const prop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.02), headlightMat);
      prop.position.set(ex, 0.14, 0.25);
      prop.name = 'spin_prop';
      group.add(prop);
    }
  }

  // Wingtip Navigation Lights (Red port / Emerald starboard)
  const portLight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), taillightMat);
  portLight.position.set(-wingSpan * 0.5, 0.19, 0.04);
  group.add(portLight);
  const stbdLight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), glowMat);
  stbdLight.position.set(wingSpan * 0.5, 0.19, 0.04);
  group.add(stbdLight);

  return group;
}

