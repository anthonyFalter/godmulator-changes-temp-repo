import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getDragonVariant } from './catalog';
import {
  BuildingType,
  ResourceNodeType,
  SpeciesId,
  TerrainType,
  UnitAgeStage,
  UnitRole,
  VehicleType,
} from './types';

const textureCache = new Map<string, THREE.Texture>();

export function getPixelArtTexture(
  key: string,
  baseHex: string,
  accentHex: string,
  shadowHex: string,
  pattern: 'stone' | 'grass' | 'wood' | 'roof' | 'water' | 'tech' | 'fertile',
): THREE.Texture {
  const existing = textureCache.get(key);
  if (existing) return existing;

  if (typeof document === 'undefined') {
    const data = new Uint8Array(16 * 16 * 4);
    const tex = new THREE.DataTexture(data, 16, 16, THREE.RGBAFormat);
    tex.needsUpdate = true;
    textureCache.set(key, tex);
    return tex;
  }

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
  coralReef: THREE.BufferGeometry[];
  coralReefBleached: THREE.BufferGeometry[];
  scrapFlotsam: THREE.BufferGeometry[];
  atlantisRuin: THREE.BufferGeometry[];
  standardMat: THREE.MeshStandardMaterial;
  crystalMat: THREE.MeshStandardMaterial;
  coralReefMat: THREE.MeshStandardMaterial;
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

  // 7a. Submerged Warm-Ocean Coral Reef Formations:
  // Built with organic cylindrical/conical staghorn antler branches, hemispherical brain-coral boulder domes,
  // clustered tubular barrel sponges / organ-pipe corals, and octagonal flared Acropora table plates on sculpted coralline limestone mounds.
  const addColoredCylinder = (
    parts: THREE.BufferGeometry[],
    rTop: number,
    rBot: number,
    h: number,
    segs: number,
    x: number,
    y: number,
    z: number,
    hex: number,
    rotX = 0,
    rotY = 0,
    rotZ = 0,
  ) => {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, segs);
    if (rotZ !== 0) g.rotateZ(rotZ);
    if (rotX !== 0) g.rotateX(rotX);
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
  };

  const addColoredDome = (
    parts: THREE.BufferGeometry[],
    radius: number,
    wSegs: number,
    hSegs: number,
    x: number,
    y: number,
    z: number,
    hex: number,
    scaleX = 1,
    scaleY = 1,
    scaleZ = 1,
  ) => {
    const g = new THREE.SphereGeometry(radius, wSegs, hSegs, 0, Math.PI * 2, 0, Math.PI * 0.52);
    if (scaleX !== 1 || scaleY !== 1 || scaleZ !== 1) {
      g.scale(scaleX, scaleY, scaleZ);
    }
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
  };

  // Sculpted coralline-algae terrace & sunlit pearl-sand reef foundation (keeps all vertices >= 0.0)
  const addReefLimestoneMound = (
    parts: THREE.BufferGeometry[],
    sandHex: number,
    corallineBaseHex: number,
    corallineMidHex: number,
    corallineCrestHex: number,
  ) => {
    // Broad sunlit reef-sand shoal base
    addColoredCylinder(parts, 0.41, 0.45, 0.022, 10, 0.0, 0.011, 0.0, sandHex, 0, 0.18);
    // Terraced coralline-algae ledges (lavender-rose, violet & coral-pink encrusted reef rock)
    addColoredCylinder(parts, 0.33, 0.39, 0.032, 9, -0.04, 0.024, 0.03, corallineBaseHex, 0, 0.55);
    addColoredCylinder(parts, 0.26, 0.32, 0.036, 8, 0.13, 0.028, -0.09, corallineMidHex, 0, -0.42);
    addColoredCylinder(parts, 0.23, 0.29, 0.034, 8, -0.15, 0.026, -0.11, corallineCrestHex, 0, 0.85);
    addColoredCylinder(parts, 0.21, 0.26, 0.030, 8, 0.10, 0.024, 0.14, corallineBaseHex, 0, 1.25);
  };

  // Majestic Spiraling Acropora Pagoda & Table Canopy with layered gradient disks and radial glowing polyp pearls
  const addTableCoralPlate = (
    parts: THREE.BufferGeometry[],
    cx: number,
    baseY: number,
    cz: number,
    radius: number,
    stalkHex: number,
    plateHex: number,
    midHex: number,
    rimHex: number,
    polypHex: number,
    rotY = 0,
  ) => {
    // Sculpted pedicel column
    addColoredCylinder(parts, radius * 0.28, radius * 0.42, 0.036, 8, cx, baseY + 0.018, cz, stalkHex, 0, rotY);
    // Broad flared lower fan canopy
    addColoredCylinder(parts, radius * 1.06, radius * 0.62, 0.022, 10, cx, baseY + 0.038, cz, plateHex, 0, rotY);
    // Vibrant middle coral terrace
    addColoredCylinder(parts, radius * 0.88, radius * 1.04, 0.014, 10, cx, baseY + 0.050, cz, midHex, 0, rotY + 0.18);
    // Luminous outer growth rim
    addColoredCylinder(parts, radius * 1.02, radius * 1.08, 0.010, 10, cx, baseY + 0.056, cz, rimHex, 0, rotY + 0.32);
    // Radial crown of glowing polyp pearls along the canopy edge
    const pearlCount = 8;
    for (let pi = 0; pi < pearlCount; pi++) {
      const ang = rotY + (pi * Math.PI * 2) / pearlCount;
      const px = cx + Math.cos(ang) * radius * 0.86;
      const pz = cz + Math.sin(ang) * radius * 0.86;
      addColoredDome(parts, radius * 0.11, 6, 4, px, baseY + 0.058, pz, polypHex, 1.0, 0.72, 1.0);
    }
  };

  // Crown-of-Neptune Two-Tiered Antler Staghorn & Elkhorn Coral Grove with bioluminescent axial tips
  const addStaghornThicket = (
    parts: THREE.BufferGeometry[],
    cx: number,
    baseY: number,
    cz: number,
    scale: number,
    stemHex: number,
    branchHex: number,
    upperHex: number,
    tipHex: number,
  ) => {
    const s = Math.min(1.02, scale);
    addColoredDome(parts, 0.11 * s, 8, 5, cx, baseY, cz, stemHex, 1.25, 0.55, 1.25);
    // Central royal spire + glowing crown tip
    const centerH = 0.105 * s;
    addColoredCylinder(parts, 0.022 * s, 0.038 * s, centerH, 7, cx, baseY + centerH * 0.5, cz, branchHex);
    addColoredDome(parts, 0.028 * s, 6, 4, cx, baseY + centerH * 0.98, cz, tipHex, 1.0, 0.85, 1.0);

    // Inner ring of 6 ascending antler tines
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3 + 0.22;
      const tilt = i % 2 === 0 ? 0.28 : 0.34;
      const dist = 0.046 * s;
      const bx = cx + Math.cos(ang) * dist;
      const bz = cz + Math.sin(ang) * dist;
      const bh = (i % 2 === 0 ? 0.096 : 0.088) * s;
      addColoredCylinder(
        parts,
        0.019 * s,
        0.032 * s,
        bh,
        6,
        bx,
        baseY + bh * 0.5,
        bz,
        i % 2 === 0 ? upperHex : branchHex,
        Math.sin(ang) * tilt,
        0,
        -Math.cos(ang) * tilt,
      );
      const tx = cx + Math.cos(ang) * (dist + Math.sin(tilt) * bh * 0.46);
      const tz = cz + Math.sin(ang) * (dist + Math.sin(tilt) * bh * 0.46);
      const ty = baseY + Math.cos(tilt) * bh * 0.94;
      addColoredDome(parts, 0.024 * s, 6, 4, tx, ty, tz, tipHex, 1.0, 0.8, 1.0);
    }

    // Outer ring of 6 sweeping elkhorn branches
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3 + 0.74;
      const tilt = 0.44;
      const dist = 0.078 * s;
      const bx = cx + Math.cos(ang) * dist;
      const bz = cz + Math.sin(ang) * dist;
      const bh = 0.076 * s;
      addColoredCylinder(
        parts,
        0.017 * s,
        0.028 * s,
        bh,
        6,
        bx,
        baseY + bh * 0.48,
        bz,
        i % 2 === 0 ? branchHex : stemHex,
        Math.sin(ang) * tilt,
        0,
        -Math.cos(ang) * tilt,
      );
      const tx = cx + Math.cos(ang) * (dist + Math.sin(tilt) * bh * 0.46);
      const tz = cz + Math.sin(ang) * (dist + Math.sin(tilt) * bh * 0.46);
      const ty = baseY + Math.cos(tilt) * bh * 0.90;
      addColoredDome(parts, 0.022 * s, 6, 4, tx, ty, tz, tipHex, 1.0, 0.78, 1.0);
    }
  };

  // Fluted Organ-Pipe & Sea-Chime Barrel Sponge Cathedral with flared bioluminescent osculum crowns
  const addBarrelSpongeCluster = (
    parts: THREE.BufferGeometry[],
    cx: number,
    baseY: number,
    cz: number,
    outerHex: number,
    midHex: number,
    rimHex: number,
    innerHex: number,
  ) => {
    const tubes: [number, number, number, number, boolean][] = [
      [0.0, 0.0, 0.068, 0.118, true],
      [-0.088, 0.052, 0.054, 0.098, false],
      [0.082, 0.058, 0.050, 0.092, true],
      [-0.044, -0.082, 0.048, 0.086, false],
      [0.072, -0.064, 0.044, 0.078, true],
      [-0.112, -0.024, 0.040, 0.070, false],
      [0.012, 0.096, 0.042, 0.074, true],
    ];
    for (const [ox, oz, rad, h, useAlt] of tubes) {
      const col = useAlt ? outerHex : midHex;
      addColoredCylinder(parts, rad * 1.12, rad * 0.84, h, 8, cx + ox, baseY + h * 0.5, cz + oz, col);
      addColoredCylinder(parts, rad * 1.02, rad * 1.16, 0.014, 8, cx + ox, baseY + h + 0.005, cz + oz, rimHex);
      addColoredCylinder(parts, rad * 0.62, rad * 0.62, 0.010, 7, cx + ox, baseY + h + 0.010, cz + oz, innerHex);
    }
  };

  // Concentric Labyrinth Brain-Coral Dome & Blooming Sea-Lotus Anemone Rosette
  const addBrainCoralBoulder = (
    parts: THREE.BufferGeometry[],
    cx: number,
    baseY: number,
    cz: number,
    radius: number,
    baseHex: number,
    grooveHex: number,
    crestHex: number,
    pearlHex: number,
  ) => {
    addColoredDome(parts, radius * 1.06, 9, 5, cx, baseY, cz, baseHex, 1.10, 0.52, 1.04);
    addColoredDome(parts, radius * 0.90, 9, 5, cx, baseY + radius * 0.11, cz, grooveHex, 1.05, 0.48, 1.00);
    addColoredDome(parts, radius * 0.72, 8, 4, cx, baseY + radius * 0.22, cz, crestHex, 1.0, 0.44, 0.96);
    addColoredDome(parts, radius * 0.44, 7, 4, cx, baseY + radius * 0.32, cz, pearlHex, 1.0, 0.40, 1.0);
  };

  // Blooming Sea-Lotus Anemone Crown with radiating bioluminescent tentacles and pearl oral center
  const addSeaLotusAnemone = (
    parts: THREE.BufferGeometry[],
    cx: number,
    baseY: number,
    cz: number,
    radius: number,
    calyxHex: number,
    petalHex: number,
    coreHex: number,
  ) => {
    addColoredCylinder(parts, radius * 0.68, radius * 0.52, 0.034, 8, cx, baseY + 0.017, cz, calyxHex);
    const petals = 10;
    for (let i = 0; i < petals; i++) {
      const ang = (i * Math.PI * 2) / petals;
      const dist = radius * 0.56;
      const px = cx + Math.cos(ang) * dist;
      const pz = cz + Math.sin(ang) * dist;
      addColoredCylinder(
        parts,
        radius * 0.12,
        radius * 0.18,
        radius * 0.52,
        6,
        px,
        baseY + 0.042,
        pz,
        i % 2 === 0 ? petalHex : calyxHex,
        Math.sin(ang) * 0.48,
        0,
        -Math.cos(ang) * 0.48,
      );
      const tx = cx + Math.cos(ang) * (dist + radius * 0.22);
      const tz = cz + Math.sin(ang) * (dist + radius * 0.22);
      addColoredDome(parts, radius * 0.14, 6, 4, tx, baseY + 0.062, tz, coreHex, 1.0, 0.75, 1.0);
    }
    addColoredDome(parts, radius * 0.38, 8, 4, cx, baseY + 0.032, cz, coreHex, 1.0, 0.65, 1.0);
  };

  const coralReef: THREE.BufferGeometry[] = [];
  {
    // Variant 0: Imperial Rose-Gold Pagoda Terraces, Sunburst Staghorn Crown & Neon-Aqua Sea-Lotus Sanctuary
    const p: THREE.BufferGeometry[] = [];
    addReefLimestoneMound(p, 0xfdf0d5, 0xc77dff, 0xe0aaff, 0xff8fa3);
    // Three cascading Rose-Gold & Magenta Acropora Pagoda Canopies
    addTableCoralPlate(p, -0.14, 0.026, 0.10, 0.25, 0x9d174d, 0xf43f5e, 0xfb7185, 0xffd166, 0xfff3b0, 0.15);
    addTableCoralPlate(p, -0.06, 0.068, 0.04, 0.20, 0xbe185d, 0xff4d6d, 0xff8fa3, 0xffe5ec, 0x72efdd, 0.55);
    addTableCoralPlate(p, 0.02, 0.104, -0.01, 0.15, 0xdb2777, 0xff758f, 0xffb3c6, 0xfff3b0, 0xffffff, 0.95);
    // Golden-Sunburst Crown-of-Neptune Staghorn Grove on NE terrace
    addStaghornThicket(p, 0.16, 0.036, -0.10, 1.08, 0xe85d04, 0xff7b00, 0xffaa00, 0xfff3b0);
    // Electric Turquoise-Aqua Labyrinth Brain Dome & Blooming Sea-Lotus Anemone
    addBrainCoralBoulder(p, -0.17, 0.028, -0.15, 0.15, 0x0077b6, 0x00b4d8, 0x48cae4, 0x90e0ef);
    addSeaLotusAnemone(p, 0.15, 0.028, 0.16, 0.15, 0x7209b7, 0xf72585, 0x4cc9f0);
    coralReef.push(finalizeMergedParts(p));
  }
  {
    // Variant 1: Bioluminescent Magenta Organ-Pipe Cathedral, Turquoise Labyrinth Dome & Golden Elkhorn Crown
    const p: THREE.BufferGeometry[] = [];
    addReefLimestoneMound(p, 0xfdf0d5, 0x9d4edd, 0xc77dff, 0xf72585);
    // Towering Magenta-Orchid & Violet Organ-Pipe Sponge Cathedral on NW flank
    addBarrelSpongeCluster(p, -0.13, 0.032, -0.06, 0xb5179e, 0x7209b7, 0xff70a6, 0x80ffdb);
    // Grand Turquoise-Emerald Labyrinth Brain-Coral Dome on E terrace
    addBrainCoralBoulder(p, 0.12, 0.030, 0.07, 0.21, 0x0077b6, 0x00b4d8, 0x48cae4, 0x80ffdb);
    // Sunlit Amber-Coral Staghorn Crown on NE ledge & Sea-Lotus Anemone on SW ledge
    addStaghornThicket(p, 0.15, 0.034, -0.15, 1.02, 0xf48c06, 0xff9f1c, 0xffbf69, 0xffffff);
    addSeaLotusAnemone(p, -0.10, 0.028, 0.16, 0.16, 0xe63946, 0xff758f, 0xffe66d);
    coralReef.push(finalizeMergedParts(p));
  }
  {
    // Variant 2: Sunburst Three-Tiered Acropora Spiral, Royal Violet Staghorn Grove & Cyan Lotus Garden
    const p: THREE.BufferGeometry[] = [];
    addReefLimestoneMound(p, 0xfdf0d5, 0xe0aaff, 0xc77dff, 0xff9e00);
    // Spiraling Sunburst-Coral, Tangerine & Pearl-Gold Acropora Table Canopies
    addTableCoralPlate(p, -0.12, 0.026, -0.09, 0.26, 0xc9184a, 0xff5400, 0xff8500, 0xffbd00, 0xfff3b0, 0.12);
    addTableCoralPlate(p, 0.02, 0.068, -0.02, 0.20, 0xe85d04, 0xff7b00, 0xffaa00, 0xffe169, 0x80ffdb, 0.48);
    addTableCoralPlate(p, 0.15, 0.036, 0.13, 0.19, 0xd90429, 0xff4d6d, 0xff8fa3, 0xffccd5, 0xfff3b0, -0.28);
    // Royal Violet-Amethyst Staghorn Antler Thicket on SW terrace
    addStaghornThicket(p, -0.15, 0.034, 0.14, 1.08, 0x5a189a, 0x9d4edd, 0xc77dff, 0x80ffdb);
    // Luminous Seafoam-Cyan Sea-Lotus Anemone on NE edge
    addSeaLotusAnemone(p, 0.17, 0.028, -0.13, 0.15, 0x0096c7, 0x48cae4, 0xfff3b0);
    coralReef.push(finalizeMergedParts(p));
  }
  {
    // Variant 3: Crimson-Peach Elkhorn Sanctuary, Seafoam-Aqua Organ-Pipe Chimes & Orchid Pagoda Terrace
    const p: THREE.BufferGeometry[] = [];
    addReefLimestoneMound(p, 0xfdf0d5, 0xc77dff, 0xff8fa3, 0x48cae4);
    // Sweeping Crimson-Rose & Pearl Elkhorn Antler Crown in center-west
    addStaghornThicket(p, -0.08, 0.036, 0.04, 1.12, 0xc9184a, 0xff4d6d, 0xff8fa3, 0xfff3b0);
    // Luminous Seafoam-Turquoise Organ-Pipe Cathedral on NE flank
    addBarrelSpongeCluster(p, 0.14, 0.032, -0.09, 0x0096c7, 0x00b4d8, 0x72efdd, 0xfff3b0);
    // Overlapping Royal-Orchid & Pink-Pearl Pagoda Table Canopy on SE flank
    addTableCoralPlate(p, 0.12, 0.032, 0.14, 0.21, 0x6a1b9a, 0x9d4edd, 0xc77dff, 0xf3c4fb, 0x80ffdb, 0.35);
    addBrainCoralBoulder(p, -0.17, 0.028, -0.14, 0.15, 0xf77f00, 0xfcbf49, 0xeae2b7, 0xffffff);
    coralReef.push(finalizeMergedParts(p));
  }

  // 7a-bleached. Bleached / Damaged Calcified Coral Reefs (matching majestic silhouettes in calcified bone/ash-gray)
  const coralReefBleached: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addReefLimestoneMound(p, 0x9ca3af, 0x64748b, 0x94a3b8, 0x78716c);
    addTableCoralPlate(p, -0.14, 0.026, 0.10, 0.25, 0x475569, 0x94a3b8, 0xcbd5e1, 0xe2e8f0, 0xf1f5f9, 0.15);
    addTableCoralPlate(p, -0.06, 0.068, 0.04, 0.20, 0x64748b, 0xcbd5e1, 0xe2e8f0, 0xf1f5f9, 0xf8fafc, 0.55);
    addStaghornThicket(p, 0.16, 0.036, -0.10, 1.08, 0x64748b, 0x94a3b8, 0xcbd5e1, 0xe2e8f0);
    addBrainCoralBoulder(p, -0.17, 0.028, -0.15, 0.15, 0x4b5563, 0x9ca3af, 0xd1d5db, 0xe5e7eb);
    coralReefBleached.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addReefLimestoneMound(p, 0x9ca3af, 0x57534e, 0x6b7280, 0x94a3b8);
    addBarrelSpongeCluster(p, -0.13, 0.032, -0.06, 0x64748b, 0x94a3b8, 0xcbd5e1, 0x334155);
    addBrainCoralBoulder(p, 0.12, 0.030, 0.07, 0.21, 0x475569, 0x94a3b8, 0xcbd5e1, 0xe2e8f0);
    addStaghornThicket(p, 0.15, 0.034, -0.15, 1.02, 0x64748b, 0x94a3b8, 0xcbd5e1, 0xf1f5f9);
    addSeaLotusAnemone(p, -0.10, 0.028, 0.16, 0.16, 0x64748b, 0x94a3b8, 0xe2e8f0);
    coralReefBleached.push(finalizeMergedParts(p));
  }

  // 7b. Scrap Flotsam & Sea Salvage (floating driftwood rafts, rusted metal plates, salvage barrels & crates)
  const scrapFlotsam: THREE.BufferGeometry[] = [];
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.44, 0.06, 0.1, -0.06, 0.01, -0.12, 0x7c5334, 0.25); // driftwood plank
    addColoredBox(p, 0.4, 0.06, 0.1, 0.04, 0.01, 0.04, 0x634128, -0.18);
    addColoredBox(p, 0.18, 0.16, 0.18, -0.14, 0.08, 0.12, 0xb45309, 0.4); // salvage crate
    addColoredBox(p, 0.14, 0.18, 0.14, 0.18, 0.07, -0.1, 0x475569, 0.2, 0.5); // steel drum
    addColoredBox(p, 0.22, 0.05, 0.18, 0.12, 0.02, 0.18, 0x94a3b8, -0.3); // scrap hull plate
    scrapFlotsam.push(finalizeMergedParts(p));
  }
  {
    const p: THREE.BufferGeometry[] = [];
    addColoredBox(p, 0.36, 0.07, 0.28, 0.0, 0.01, 0.0, 0x6b442a, 0.15);
    addColoredBox(p, 0.16, 0.14, 0.22, -0.12, 0.09, -0.06, 0x64748b, -0.2);
    addColoredBox(p, 0.14, 0.14, 0.14, 0.16, 0.08, 0.12, 0xd97706, 0.35);
    addColoredBox(p, 0.08, 0.22, 0.08, -0.2, 0.1, 0.18, 0x38bdf8, 0.2, -0.3); // salvage canister
    scrapFlotsam.push(finalizeMergedParts(p));
  }

  // 7c. Ancient Sunken City of Atlantis Temple Complex:
  // Expansive ~3.5-tile submerged Atlantean metropolis featuring concentric white-marble & golden-orichalcum city rings,
  // 4 radial sunken stepped temple pyramids rising right beneath the crystal-clear ocean surface (local y = 0.02..0.165, world y = 0.14..0.285),
  // glowing underwater cyan ley-line canals, 8 submerged crystal-beacon obelisks, sunken aqueduct colonnades,
  // and the emergent central marble temple colonnade & levitating portal spire rising above the waves!
  const atlantisRuin: THREE.BufferGeometry[] = [];
  const buildAtlantisComplex = (variantIdx: number): THREE.BufferGeometry => {
    const p: THREE.BufferGeometry[] = [];
    // 1. EXPANSIVE SUBMERGED ATLANTEAN CITY FOUNDATION & CONCENTRIC RINGS (local y = 0.01..0.165, world y = 0.13..0.285)
    // Outer sunken sea-marble metropolis foundation disc (diameter ~3.36 tiles)
    addColoredCylinder(p, 1.66, 1.74, 0.036, 12, 0, 0.018, 0, 0xcbd5e1);
    // Outer golden orichalcum city wall ring & raised perimeter walkway (clearly visible just below the water surface)
    addColoredCylinder(p, 1.54, 1.60, 0.042, 12, 0, 0.056, 0, 0xf5b742);
    // Submerged inner lagoon floor in deep Atlantean lapis-teal to contrast with the white marble & glowing cyan canals
    addColoredCylinder(p, 1.44, 1.46, 0.020, 12, 0, 0.082, 0, 0x0f4c5c);
    // Middle concentric white-marble acropolis terrace & golden orichalcum ring
    addColoredCylinder(p, 1.14, 1.20, 0.036, 12, 0, 0.102, 0, 0xe2e8f0);
    addColoredCylinder(p, 1.02, 1.06, 0.024, 12, 0, 0.128, 0, 0xf5b742);
    // Inner sunken sanctum dais right beneath the water surface (local y = 0.146 -> world y = 0.266)
    addColoredCylinder(p, 0.80, 0.86, 0.032, 12, 0, 0.146, 0, 0xf8fafc);

    // Glowing Underwater Cyan Ley-Line Canals & Cross-Avenues spanning the entire 3.4-tile sunken city
    addColoredBox(p, 3.24, 0.030, 0.22, 0, 0.118, 0, 0x00f5d4);
    addColoredBox(p, 0.22, 0.030, 3.24, 0, 0.118, 0, 0x00f5d4);
    addColoredBox(p, 2.50, 0.024, 0.14, 0, 0.112, 0, 0x48bfe3, Math.PI / 4);
    addColoredBox(p, 0.14, 0.024, 2.50, 0, 0.112, 0, 0x48bfe3, Math.PI / 4);

    // 4 Radial Sunken Grand Causeways & Stepped Temple Gateways at N, S, E, W (extending out to r = 1.72)
    for (const [sx, sz, isX] of [
      [1.46, 0, true],
      [-1.46, 0, true],
      [0, 1.46, false],
      [0, -1.46, false],
    ] as const) {
      addColoredBox(p, isX ? 0.56 : 0.78, 0.056, isX ? 0.78 : 0.56, sx, 0.052, sz, 0xe2e8f0);
      addColoredBox(p, isX ? 0.42 : 0.62, 0.048, isX ? 0.62 : 0.42, sx * 0.90, 0.098, sz * 0.90, 0xf5b742);
      addColoredBox(p, isX ? 0.30 : 0.48, 0.036, isX ? 0.48 : 0.30, sx * 0.82, 0.136, sz * 0.82, 0xf8fafc);
      // Flanking submerged gate pylons at each cardinal causeway entrance
      const perpX = isX ? 0 : 0.34;
      const perpZ = isX ? 0.34 : 0;
      for (const side of [-1, 1] as const) {
        const gx = sx + perpX * side;
        const gz = sz + perpZ * side;
        addColoredBox(p, 0.18, 0.11, 0.18, gx, 0.095, gz, 0xf8fafc);
        addColoredBox(p, 0.22, 0.028, 0.22, gx, 0.152, gz, 0xf5b742);
      }
    }

    // 4 Submerged Stepped Atlantean Temple Pyramids in the NE, NW, SE, SW City Quadrants
    // (Rising up to local y = 0.164 / world y = 0.284 so their tiered roofs & glowing crystal shrines are unmistakably visible underwater!)
    for (const [qx, qz] of [
      [-0.96, -0.96],
      [0.96, -0.96],
      [-0.96, 0.96],
      [0.96, 0.96],
    ] as const) {
      addColoredBox(p, 0.58, 0.042, 0.58, qx, 0.068, qz, 0xcbd5e1); // lower sunken pyramid tier
      addColoredBox(p, 0.46, 0.038, 0.46, qx, 0.106, qz, 0xe2e8f0); // middle sunken pyramid tier
      addColoredBox(p, 0.36, 0.026, 0.36, qx, 0.136, qz, 0xf5b742); // golden orichalcum frieze
      addColoredBox(p, 0.24, 0.028, 0.24, qx, 0.154, qz, 0x00f5d4, Math.PI / 4); // glowing cyan underwater sanctum cap
    }

    // 8 Outer Sunken Colonnade Pillars & Glowing Sea-Crystal Obelisks along the city perimeter ring
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4 + Math.PI / 8;
      const ox = Math.cos(ang) * 1.42;
      const oz = Math.sin(ang) * 1.42;
      addColoredCylinder(p, 0.08, 0.10, 0.09, 6, ox, 0.095, oz, 0xf1f5f9);
      addColoredCylinder(p, 0.10, 0.10, 0.024, 6, ox, 0.146, oz, 0xf5b742);
      addColoredCylinder(p, 0.02, 0.06, 0.028, 6, ox, 0.162, oz, 0x00f5d4);
    }

    // Fallen / Ruined Underwater Marble Columns resting on the sunken courtyard floor
    addColoredCylinder(p, 0.065, 0.065, 0.48, 8, -0.68, 0.125, 1.18, 0xf1f5f9, 0, 0.35, Math.PI / 2);
    addColoredCylinder(p, 0.065, 0.065, 0.46, 8, 1.18, 0.125, -0.64, 0xf1f5f9, Math.PI / 2, -0.28, 0);

    // 2. EMERGENT ABOVE-WATER TEMPLE COLONNADE & PORTAL GATEWAY (rising from y = 0.16 through the water surface up to y = 0.90)
    for (const [px, pz, colH, hasCap] of [
      [-0.46, -0.46, 0.58, true],
      [0.46, -0.46, variantIdx === 0 ? 0.58 : 0.40, variantIdx === 0],
      [-0.46, 0.46, variantIdx === 0 ? 0.42 : 0.58, variantIdx !== 0],
      [0.46, 0.46, 0.58, true],
    ] as const) {
      addColoredCylinder(p, 0.12, 0.14, 0.06, 8, px, 0.17, pz, 0xf5b742); // golden column base
      addColoredCylinder(p, 0.085, 0.095, colH, 8, px, 0.18 + colH * 0.5, pz, 0xf8fafc); // fluted marble column shaft
      if (hasCap) {
        addColoredBox(p, 0.22, 0.06, 0.22, px, 0.20 + colH, pz, 0xf5b742); // golden orichalcum capital
      }
    }

    // Emergent Golden Orichalcum Architrave Lintel & Temple Pediment Bridge above the waves
    if (variantIdx === 0) {
      addColoredBox(p, 1.16, 0.08, 0.24, 0, 0.80, -0.46, 0xf5b742);
      addColoredBox(p, 1.08, 0.06, 0.20, 0, 0.86, -0.46, 0xf8fafc);
    } else {
      addColoredBox(p, 0.24, 0.08, 1.16, -0.46, 0.80, 0, 0xf5b742);
      addColoredBox(p, 0.20, 0.06, 1.08, -0.46, 0.86, 0, 0xf8fafc);
    }

    // Central Atlantean Sanctum Altar & Levitating Sea-Crystal Portal Spire
    addColoredCylinder(p, 0.28, 0.34, 0.10, 8, 0, 0.19, 0, 0xe2e8f0);
    addColoredCylinder(p, 0.22, 0.26, 0.06, 8, 0, 0.26, 0, 0xf5b742);
    addColoredBox(p, 0.22, 0.58, 0.22, 0, 0.54, 0, 0x48bfe3, Math.PI / 4); // towering glowing portal crystal
    addColoredBox(p, 0.34, 0.05, 0.34, 0, 0.54, 0, 0xf5b742, Math.PI / 4); // floating golden orichalcum containment ring
    return finalizeMergedParts(p);
  };
  atlantisRuin.push(buildAtlantisComplex(0));
  atlantisRuin.push(buildAtlantisComplex(1));

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
    coralReef,
    coralReefBleached,
    scrapFlotsam,
    atlantisRuin,
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
    coralReefMat: (() => {
      const m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.26,
        metalness: 0.06,
      });
      m.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          diffuseColor.rgb = pow(diffuseColor.rgb, vec3(0.92)) * 1.18;`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += diffuseColor.rgb * 0.54;`,
        );
      };
      m.customProgramCacheKey = () => 'coral-reef-biolum-v1';
      return m;
    })(),
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
  } else if (nodeType === 'coral_reef') {
    geo = lib.coralReef[idx % lib.coralReef.length];
    mat = lib.coralReefMat;
  } else if (nodeType === 'scrap_flotsam') {
    geo = lib.scrapFlotsam[idx % lib.scrapFlotsam.length];
  } else if (nodeType === 'atlantis_ruin') {
    geo = lib.atlantisRuin[idx % lib.atlantisRuin.length];
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
    windowWarmMat: new THREE.MeshStandardMaterial({
      color: 0x3b2d22,
      emissive: 0xffa62b,
      emissiveIntensity: 0.05,
      roughness: 0.25,
    }),
    windowModernWarmMat: new THREE.MeshStandardMaterial({
      color: 0x334155,
      emissive: 0xffd166,
      emissiveIntensity: 0.08,
      roughness: 0.2,
    }),
    windowModernCoolMat: new THREE.MeshStandardMaterial({
      color: 0x334155,
      emissive: 0x56cfe1,
      emissiveIntensity: 0.08,
      roughness: 0.2,
    }),
    beaconRedMat: new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xff2a2a,
      emissiveIntensity: 0.35,
      roughness: 0.2,
    }),
  };
  return sharedBuildingMats;
}

export function updateBuildingNightMaterials(darkness: number, elapsed: number): void {
  const M = getBuildingMaterials();
  const d = THREE.MathUtils.clamp(darkness, 0, 1);
  const nightSmooth = d * d * (3 - 2 * d);
  const flicker =
    1 +
    (Math.sin(elapsed * 11.3) * 0.12 +
      Math.cos(elapsed * 17.9 + 1.4) * 0.08 +
      Math.sin(elapsed * 27.1 + 0.6) * 0.05) *
      (0.35 + 0.65 * nightSmooth);

  // Warm cottage / lantern / gaslight / tenement windows
  M.windowWarmMat.color.setHex(nightSmooth > 0.2 ? 0xffcb69 : 0x3b2d22);
  M.windowWarmMat.emissiveIntensity = (0.04 + nightSmooth * 2.15) * (0.94 + 0.06 * flicker);

  // Modern & Information Age skyscraper & apartment windows
  M.windowModernWarmMat.color.setHex(nightSmooth > 0.2 ? 0xffe194 : 0x334155);
  M.windowModernWarmMat.emissiveIntensity = 0.08 + nightSmooth * 2.35;

  M.windowModernCoolMat.color.setHex(nightSmooth > 0.2 ? 0x90e0ef : 0x334155);
  M.windowModernCoolMat.emissiveIntensity = 0.08 + nightSmooth * 2.25;

  // Pulsing red rooftop aviation warning beacons
  const beaconPulse = 0.5 + 0.5 * Math.sin(elapsed * 4.2);
  M.beaconRedMat.emissiveIntensity = 0.25 + nightSmooth * (0.9 + beaconPulse * 2.2);

  // Campfires, braziers, furnaces, and racial magical/magma/neon glows intensify at dark hours
  M.flameMat.emissiveIntensity = (0.95 + nightSmooth * 1.85) * flicker;
  M.glowCyanMat.emissiveIntensity = 0.85 + nightSmooth * 1.45;
  M.elfAquaGlowMat.emissiveIntensity = 0.9 + nightSmooth * 1.55;
  M.orcMagmaGlowMat.emissiveIntensity = (0.95 + nightSmooth * 1.65) * (0.92 + 0.08 * flicker);
}

export function createBuildingGroup(
  type: BuildingType,
  epochIndex: number,
  variantSeed = 0,
  species: SpeciesId = 'human',
  isWaterTile = false,
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
    windowWarmMat,
    windowModernWarmMat,
    windowModernCoolMat,
    beaconRedMat,
  } = M;

  const isElf = species === 'elf';
  const isOrc = species === 'orc';
  const raceGlowMat = isElf ? elfAquaGlowMat : isOrc ? orcMagmaGlowMat : glowCyanMat;
  const raceTechWallMat = isElf ? elfPearlTechMat : isOrc ? orcGunmetalMat : techMat;
  const raceTechTrimMat = isElf ? elfJadeRoofMat : isOrc ? orcIronMat : darkTechMat;
  const raceAccentMat = isElf ? goldMat : isOrc ? orcCrimsonMat : goldMat;

  // Floating City Foundation Platform when constructed on water (evolves across epochs & races)
  if (isWaterTile) {
    const platGroup = new THREE.Group();
    platGroup.name = 'floating_city_platform';
    if (epochIndex <= 0) {
      // Prehistoric: Lashed log raft / Elf lotus-root pad / Orc bone-tied hide pontoon raft
      const deckMat = isElf ? elfLeafRoofMat : isOrc ? orcCharredLogMat : stickWoodMat;
      const floatMat = isElf ? elfHeartwoodMat : isOrc ? orcHideMat : woodMat;
      for (let li = -3; li <= 3; li++) {
        const log = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.11), deckMat);
        log.position.set(0, -0.02, li * 0.13);
        platGroup.add(log);
      }
      for (const sx of [-0.44, 0.44]) {
        const outrigger = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.98), floatMat);
        outrigger.position.set(sx, -0.05, 0);
        platGroup.add(outrigger);
      }
      if (isOrc) {
        for (const [cx, cz] of [
          [-0.44, -0.44],
          [0.44, -0.44],
          [-0.44, 0.44],
          [0.44, 0.44],
        ] as const) {
          const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 4), orcBoneMat);
          tusk.position.set(cx, 0.07, cz);
          platGroup.add(tusk);
        }
      }
    } else if (epochIndex <= 2) {
      // Bronze & Medieval: Timber wharf / Elf moonstone & birch terrace / Orc basalt & iron-banded war-barge
      const deckMat = isElf ? elfBirchMat : isOrc ? orcCharredLogMat : woodMat;
      const trimM = isElf ? elfMossStoneMat : isOrc ? orcBasaltMat : stoneMat;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.08, 0.98), deckMat);
      deck.position.set(0, -0.03, 0);
      platGroup.add(deck);
      for (const [cx, cz] of [
        [-0.44, -0.44],
        [0.44, -0.44],
        [-0.44, 0.44],
        [0.44, 0.44],
      ] as const) {
        const piling = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 0.11), trimM);
        piling.position.set(cx, -0.06, cz);
        platGroup.add(piling);
      }
    } else if (epochIndex <= 3) {
      // Industrial: Riveted iron & brick caisson / Elf verdigris pontoon / Orc heavy iron forge-barge
      const caissonMat = isElf ? elfVerdigrisMat : isOrc ? orcIronMat : brickMat;
      const rimM = isElf ? elfHeartwoodMat : isOrc ? orcGunmetalMat : darkStoneMat;
      const caisson = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.12, 0.98), caissonMat);
      caisson.position.set(0, -0.05, 0);
      platGroup.add(caisson);
      for (const sx of [-0.46, 0.46]) {
        const pontoon = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 8), rimM);
        pontoon.rotation.x = Math.PI / 2;
        pontoon.position.set(sx, -0.08, 0);
        platGroup.add(pontoon);
      }
    } else if (epochIndex <= 5) {
      // Atomic & Modern: Reinforced offshore concrete & steel catamaran pontoon platform
      const deckMat = isElf ? elfPearlTechMat : isOrc ? orcGunmetalMat : concreteMat;
      const hullMat = isElf ? elfJadeRoofMat : isOrc ? orcCrimsonMat : darkTechMat;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.09, 1.0), deckMat);
      deck.position.set(0, -0.03, 0);
      platGroup.add(deck);
      for (const sx of [-0.42, 0.42]) {
        const floatHull = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 1.02), hullMat);
        floatHull.position.set(sx, -0.09, 0);
        platGroup.add(floatHull);
      }
    } else {
      // Orbital & Interstellar: Anti-gravity repulsor sea-pad with glowing racial plasma rings
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.54, 0.1, 8), raceTechWallMat);
      pad.position.set(0, -0.04, 0);
      platGroup.add(pad);
      const glowRing = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.04, 0.96), raceGlowMat);
      glowRing.position.set(0, -0.09, 0);
      platGroup.add(glowRing);
    }
    group.add(platGroup);
  }

  // Helper: Prehistoric outdoor stone-ring campfire with crossed logs & flickering flame
  const addPrehistoricCampfire = (cx: number, cz: number, fireMat: THREE.Material = flameMat) => {
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * Math.PI * 2;
      const stone = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.04, 0.055),
        isOrc ? orcBasaltMat : isElf ? elfMossStoneMat : stoneMat,
      );
      stone.position.set(cx + Math.cos(a) * 0.095, 0.025, cz + Math.sin(a) * 0.095);
      group.add(stone);
    }
    const log1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.035), stickWoodMat);
    log1.position.set(cx, 0.032, cz);
    log1.rotation.y = 0.55;
    group.add(log1);
    const log2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.035), stickWoodMat);
    log2.position.set(cx, 0.038, cz);
    log2.rotation.y = -0.65;
    group.add(log2);
    const emberCore = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.14, 5), fireMat);
    emberCore.position.set(cx, 0.095, cz);
    emberCore.name = 'flicker_flame';
    group.add(emberCore);
  };

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

    const windowMat =
      epochIndex >= 6
        ? raceGlowMat
        : isOrc
          ? orcMagmaGlowMat
          : isElf
            ? elfAquaGlowMat
            : epochIndex >= 4
              ? windowModernWarmMat
              : windowWarmMat;
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.19, 0.03),
      epochIndex >= 6 ? raceGlowMat : doorDarkMat,
    );
    door.position.set(cx - w * 0.12, 0.145, cz + d * 0.5 + 0.008);
    group.add(door);

    // Warm porch/doorway lantern or torch sconce beside the entrance
    const porchLantern = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.058, 0.042),
      epochIndex >= 6 ? raceGlowMat : isOrc ? orcMagmaGlowMat : isElf ? elfAquaGlowMat : flameMat,
    );
    porchLantern.position.set(cx - w * 0.28, 0.22, cz + d * 0.5 + 0.02);
    group.add(porchLantern);

    const winFront = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.095, 0.03), windowMat);
    winFront.position.set(cx + w * 0.2, 0.22, cz + d * 0.5 + 0.008);
    group.add(winFront);

    const winBack = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.095, 0.03), windowMat);
    winBack.position.set(cx + w * 0.14, 0.22, cz - d * 0.5 - 0.008);
    group.add(winBack);

    const winSideR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.095, 0.095), windowMat);
    winSideR.position.set(cx + w * 0.5 + 0.008, 0.22, cz);
    group.add(winSideR);

    const winSideL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.095, 0.095), windowMat);
    winSideL.position.set(cx - w * 0.5 - 0.008, 0.22, cz);
    group.add(winSideL);

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
          opts.glowTrim || epochIndex >= 1 ? elfAquaGlowMat : elfHeartwoodMat,
        );
        archDoor.position.set(cx, curY + Math.min(0.11, th * 0.34), cz + r * 0.96);
        group.add(archDoor);
      }

      // Luminous sylvan moon-windows on lateral & back faces
      if (epochIndex >= 1) {
        for (const sx of [-1, 1]) {
          const moonWin = new THREE.Mesh(
            new THREE.BoxGeometry(0.035, Math.min(0.12, th * 0.45), 0.085),
            elfAquaGlowMat,
          );
          moonWin.position.set(cx + sx * r * 0.94, curY + th * 0.54, cz);
          group.add(moonWin);
        }
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

    // Iron-banded doorway & fiery slit windows on front, back, and sides
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.21, 0.04), doorDarkMat);
    door.position.set(cx, 0.175, cz + d * 0.5 + 0.012);
    group.add(door);

    const slitWin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.035), orcMagmaGlowMat);
    slitWin.position.set(cx, 0.07 + h * 0.72, cz + d * 0.5 + 0.012);
    group.add(slitWin);

    for (const sx of [-1, 1]) {
      const sideSlit = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 0.14), orcMagmaGlowMat);
      sideSlit.position.set(cx + sx * (w * 0.5 + 0.012), 0.07 + h * 0.65, cz);
      group.add(sideSlit);
    }

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
          // Elven Ep 0: Leaf-canopy arbor wigwams & elevated woven tree-bower pods + glowing campfire
          addElfPagodaPavilion({
            radius: 0.3,
            h: 0.22,
            wallMat: elfHeartwoodMat,
            roofMat: elfLeafRoofMat,
            tiers: 1,
          });
          addPrehistoricCampfire(0.26, 0.26, flameMat);
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
          // Elven Ep 5 (Info Age): Living Helix Conservatory Arcology (spiraling ivory ribs & cantilevered hanging garden terraces)
          const dais = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.1, 10), elfMossStoneMat);
          dais.position.y = 0.05;
          group.add(dais);
          const coreSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 1.15, 10), elfPearlTechMat);
          coreSpire.position.y = 0.65;
          coreSpire.castShadow = true;
          group.add(coreSpire);
          // 3 Cantilevered Organic Leaf-Balcony Terraces spiraling upward
          for (let ti = 0; ti < 3; ti++) {
            const ty = 0.34 + ti * 0.3;
            const ang = (ti * Math.PI * 2) / 3 + variant * 0.5;
            const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.24 - ti * 0.03, 0.18, 0.09, 8), elfVerdigrisMat);
            pod.position.set(Math.cos(ang) * 0.14, ty, Math.sin(ang) * 0.14);
            pod.castShadow = true;
            group.add(pod);
            const gardenGlow = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), elfAquaGlowMat);
            gardenGlow.position.set(Math.cos(ang) * 0.24, ty + 0.08, Math.sin(ang) * 0.24);
            group.add(gardenGlow);
          }
          const crownBud = new THREE.Mesh(
            new THREE.ConeGeometry(0.18, 0.34, 8),
            elfJadeRoofMat,
          );
          crownBud.position.y = 1.38;
          group.add(crownBud);
        } else {
          // Elven Ep 6+: Pearl-Lotus Orbital Bio-Dome with Unfolding Glow Petals
          const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.08, 10), elfPearlTechMat);
          plinth.position.y = 0.04;
          group.add(plinth);
          const aquaDome = new THREE.Mesh(
            new THREE.SphereGeometry(0.27, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
            elfAquaGlowMat,
          );
          aquaDome.position.y = 0.12;
          group.add(aquaDome);
          for (let p = 0; p < 4; p++) {
            const a = (p / 4) * Math.PI * 2 + variant * 0.3;
            const petal = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.38, 4), elfJadeRoofMat);
            petal.position.set(Math.cos(a) * 0.28, 0.24, Math.sin(a) * 0.28);
            petal.rotation.z = -Math.cos(a) * 0.55;
            petal.rotation.x = Math.sin(a) * 0.55;
            group.add(petal);
          }
        }
        break;
      }

      if (isOrc) {
        if (epochIndex === 0) {
          // Orc Ep 0: Animal-Hide War Yurts & Tusk-Braced Lean-Tos + outdoor stone-ring campfire
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
          addPrehistoricCampfire(0.26, 0.28, orcMagmaGlowMat);
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
          // Orc Ep 5 (Info Age): Sloped Brutalist Ironclad Megablock with Twin Exhaust Stacks & Horned Battlements
          const towerH = 0.82 + (variant % 3) * 0.2;
          const podium = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.18, 4), orcBasaltMat);
          podium.rotation.y = Math.PI / 4;
          podium.position.y = 0.09;
          group.add(podium);
          const block = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.39, towerH, 4), orcGunmetalMat);
          block.rotation.y = Math.PI / 4;
          block.position.y = 0.18 + towerH * 0.5;
          block.castShadow = true;
          group.add(block);
          for (const sx of [-0.26, 0.26]) {
            const flues = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, towerH + 0.2, 6), orcIronMat);
            flues.position.set(sx, 0.22 + towerH * 0.5, -0.2);
            group.add(flues);
          }
          for (let f = 0; f < 3; f++) {
            const slit = new THREE.Mesh(new THREE.BoxGeometry(0.46 - f * 0.05, 0.05, 0.46 - f * 0.05), orcMagmaGlowMat);
            slit.position.y = 0.32 + f * (towerH * 0.28);
            group.add(slit);
          }
          for (const sx of [-0.18, 0.18]) {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 4), orcCrimsonMat);
            horn.position.set(sx, 0.28 + towerH, 0);
            horn.rotation.z = -Math.sign(sx) * 0.3;
            group.add(horn);
          }
          const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), beaconRedMat);
          beacon.position.set(0, 0.24 + towerH, 0);
          group.add(beacon);
        } else {
          // Orc Ep 6+: Sloped Hexagonal Ironclad Siege Pod with Crimson Magma Core
          const hexHull = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 0.42, 6), orcGunmetalMat);
          hexHull.position.y = 0.21;
          hexHull.castShadow = true;
          group.add(hexHull);
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + 0.3;
            const claw = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.34, 4), orcIronMat);
            claw.position.set(Math.cos(a) * 0.32, 0.44, Math.sin(a) * 0.32);
            claw.rotation.z = Math.cos(a) * 0.42;
            claw.rotation.x = -Math.sin(a) * 0.42;
            group.add(claw);
          }
          const plasmaCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), orcMagmaGlowMat);
          plasmaCore.position.set(0, 0.56, 0);
          plasmaCore.name = 'spin_part';
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
          const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.04), windowWarmMat);
          door.position.set(0, 0.14, 0.3);
          group.add(door);
        } else {
          const mudWall = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.22, 8), mudEarthMat);
          mudWall.position.y = 0.15;
          mudWall.castShadow = true;
          group.add(mudWall);
          const doorGlow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.04), windowWarmMat);
          doorGlow.position.set(0, 0.12, 0.32);
          group.add(doorGlow);
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
        // Outdoor prehistoric stone-ring campfire beside the hut
        addPrehistoricCampfire(-0.24, 0.28, flameMat);
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
        const upperWin = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.085, 0.55), windowWarmMat);
        upperWin.position.y = 0.36;
        group.add(upperWin);
      } else if (epochIndex === 4) {
        // Atomic Age: Multi-story urban concrete apartment mid-rise with rooftop water tower & lit window bands
        const midH = 0.58 + (variant % 2) * 0.18;
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.6), darkStoneMat);
        base.position.y = 0.04;
        group.add(base);
        const block = new THREE.Mesh(new THREE.BoxGeometry(0.6, midH, 0.54), concreteMat);
        block.position.y = 0.08 + midH * 0.5;
        block.castShadow = true;
        block.receiveShadow = true;
        group.add(block);
        for (let f = 0; f < 3; f++) {
          const winBand = new THREE.Mesh(
            new THREE.BoxGeometry(0.62, 0.055, 0.56),
            f % 2 === 0 ? windowModernWarmMat : windowModernCoolMat,
          );
          winBand.position.y = 0.2 + f * 0.17;
          group.add(winBand);
        }
        const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.06, 0.58), darkStoneMat);
        roofTrim.position.y = 0.1 + midH;
        group.add(roofTrim);
        const waterTank = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 8), woodMat);
        waterTank.position.set(0.16, 0.2 + midH, -0.1);
        group.add(waterTank);
        const roofBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.045), beaconRedMat);
        roofBeacon.position.set(-0.18, 0.16 + midH, 0.14);
        group.add(roofBeacon);
      } else if (epochIndex === 5) {
        // Information Age: High-Density Glass & Steel Skyscraper (varied skyline heights + warm/cyan window grid)
        const towerH = 0.92 + variant * 0.22;
        const lobby = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.18, 0.68), darkStoneMat);
        lobby.position.y = 0.09;
        lobby.castShadow = true;
        group.add(lobby);
        const lobbyGlow = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.06, 0.7), windowModernWarmMat);
        lobbyGlow.position.y = 0.09;
        group.add(lobbyGlow);
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.56, towerH, 0.52), blueRoofMat);
        shaft.position.y = 0.18 + towerH * 0.5;
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        group.add(shaft);
        const floors = 4 + (variant % 2);
        for (let f = 0; f < floors; f++) {
          const glassBand = new THREE.Mesh(
            new THREE.BoxGeometry(0.58, 0.06, 0.54),
            (f + variant) % 2 === 0 ? windowModernWarmMat : windowModernCoolMat,
          );
          glassBand.position.y = 0.28 + f * ((towerH - 0.14) / floors);
          group.add(glassBand);
        }
        const crown = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.36), techMat);
        crown.position.y = 0.24 + towerH;
        group.add(crown);
        if (variant % 2 === 0) {
          const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.32, 6), techMat);
          antenna.position.y = 0.42 + towerH;
          group.add(antenna);
          const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), beaconRedMat);
          beacon.position.y = 0.59 + towerH;
          group.add(beacon);
        } else {
          const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.048, 0.048), beaconRedMat);
          beacon.position.y = 0.32 + towerH;
          group.add(beacon);
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
        // ELVES: Ribbed Botanical Acorn / Lotus Seed Conservatory Vault + Amphorae Terrace
        const isSciFi = epochIndex >= 6;
        const dais = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 0.45, 0.08, 10),
          isSciFi ? elfPearlTechMat : elfMossStoneMat,
        );
        dais.position.y = 0.04;
        group.add(dais);
        const vault = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
          isSciFi ? elfPearlTechMat : elfBirchMat,
        );
        vault.scale.set(1, 1.35, 1);
        vault.position.y = 0.08;
        vault.castShadow = true;
        group.add(vault);
        for (let r = 0; r < 4; r++) {
          const a = (r / 4) * Math.PI * 2 + Math.PI / 4;
          const rib = new THREE.Mesh(
            new THREE.TorusGeometry(0.31, 0.025, 5, 10, Math.PI * 0.6),
            isSciFi ? elfJadeRoofMat : elfVerdigrisMat,
          );
          rib.rotation.y = a;
          rib.position.y = 0.08;
          group.add(rib);
        }
        const seedCrown = new THREE.Mesh(
          new THREE.ConeGeometry(0.11, 0.24, 8),
          isSciFi ? elfAquaGlowMat : goldMat,
        );
        seedCrown.position.y = 0.6;
        group.add(seedCrown);
        const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.22, 8), goldMat);
        urn.position.set(-0.28, 0.15, 0.26);
        group.add(urn);
        break;
      }

      if (isOrc) {
        // ORCS: Spiked Smokehouse & Iron-Ribbed Sloped Provision Bunker + Crane Tusk
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.12, 0.64), orcBasaltMat);
        base.position.y = 0.06;
        group.add(base);
        const smokehouse = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.38, 0.34, 4),
          epochIndex >= 6 ? orcGunmetalMat : epochIndex >= 3 ? orcIronMat : orcCharredLogMat,
        );
        smokehouse.rotation.y = Math.PI / 4;
        smokehouse.position.set(0.06, 0.28, 0.04);
        smokehouse.castShadow = true;
        group.add(smokehouse);
        const ironCap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.22, 4), orcCrimsonMat);
        ironCap.rotation.y = Math.PI / 4;
        ironCap.position.set(0.06, 0.56, 0.04);
        group.add(ironCap);
        const curingKiln = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.17, 0.54, 6),
          epochIndex >= 6 ? orcMagmaGlowMat : orcIronMat,
        );
        curingKiln.position.set(-0.28, 0.3, -0.2);
        curingKiln.castShadow = true;
        group.add(curingKiln);
        const tuskCrane = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.42, 5), orcBoneMat);
        tuskCrane.position.set(0.26, 0.36, 0.24);
        tuskCrane.rotation.z = -0.5;
        group.add(tuskCrane);
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
          const band = new THREE.Mesh(
            new THREE.BoxGeometry(0.58, 0.07, 0.54),
            f % 2 === 0 ? windowModernWarmMat : windowModernCoolMat,
          );
          band.position.y = 0.4 + f * 0.24;
          group.add(band);
        }
        const penthouse = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.34), techMat);
        penthouse.position.y = 1.46;
        group.add(penthouse);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.38, 6), techMat);
        mast.position.y = 1.72;
        group.add(mast);
        const topBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.055), beaconRedMat);
        topBeacon.position.y = 1.93;
        group.add(topBeacon);
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
        // ELVES: Open Solar-Prism Colonnade & Parabolic Leaf-Mirror Crucible (no industrial boxes)
        const basePad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 0.44, 0.08, 8),
          epochIndex >= 6 ? elfPearlTechMat : elfMossStoneMat,
        );
        basePad.position.y = 0.04;
        group.add(basePad);
        for (let m = 0; m < 4; m++) {
          const a = (m / 4) * Math.PI * 2 + Math.PI / 4;
          const petal = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.44, 0.18),
            epochIndex >= 6 ? elfPearlTechMat : elfJadeRoofMat,
          );
          petal.position.set(Math.cos(a) * 0.26, 0.26, Math.sin(a) * 0.26);
          petal.rotation.y = -a;
          petal.rotation.z = 0.28;
          petal.castShadow = true;
          group.add(petal);
        }
        const sunForge = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.16, 0),
          epochIndex >= 6 ? elfAquaGlowMat : goldMat,
        );
        sunForge.position.set(0, 0.34, 0);
        sunForge.name = 'spin_part';
        group.add(sunForge);
      } else if (isOrc) {
        // ORCS: Slanted Twin-Stack Magma Foundry & Armored Blast Furnace Trench
        const deck = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.12, 0.66), orcBasaltMat);
        deck.position.y = 0.06;
        group.add(deck);
        const anvilHull = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.34, 4), wallM);
        anvilHull.rotation.y = Math.PI / 4;
        anvilHull.position.set(0.08, 0.28, 0.06);
        anvilHull.castShadow = true;
        group.add(anvilHull);
        for (const [sx, rz] of [[-0.24, 0.22], [0.24, -0.22]] as const) {
          const blastStack = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.72, 6), orcIronMat);
          blastStack.position.set(sx, 0.42, -0.14);
          blastStack.rotation.z = rz;
          blastStack.castShadow = true;
          group.add(blastStack);
        }
        const magmaVat = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.16, 6), orcMagmaGlowMat);
        magmaVat.position.set(0.22, 0.16, 0.24);
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
        // ELVES: Ley-Line Harmonic Sanctuary with Curved Turquoise Fin Buttresses & Spinning Crystal Prism
        const pool = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.46, 0.1, 10),
          epochIndex >= 6 ? elfPearlTechMat : elfMossStoneMat,
        );
        pool.position.y = 0.05;
        group.add(pool);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.58, 0.18), elfVerdigrisMat);
          fin.position.set(Math.cos(a) * 0.24, 0.38, Math.sin(a) * 0.24);
          fin.rotation.y = -a;
          fin.rotation.z = 0.32;
          fin.castShadow = true;
          group.add(fin);
        }
        const coil = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.2, 0),
          epochIndex >= 6 || type === 'dynamo_plant' ? elfAquaGlowMat : goldMat,
        );
        coil.position.set(0, 0.62, 0);
        coil.name = 'spin_part';
        group.add(coil);
        break;
      }

      if (isOrc) {
        // ORCS: Twin Slanted Industrial War-Stacks + Riveted Turbine Drum + Plasma Conduit
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 0.72), orcBasaltMat);
        pad.position.y = 0.07;
        group.add(pad);
        const drum = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.32, 0.42, 8),
          epochIndex >= 6 ? orcGunmetalMat : orcIronMat,
        );
        drum.rotation.z = Math.PI / 2;
        drum.position.set(-0.04, 0.32, 0.06);
        drum.castShadow = true;
        group.add(drum);
        for (const sx of [-0.24, 0.06]) {
          const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.86, 6), orcCrimsonMat);
          stack.position.set(sx, 0.56, -0.22);
          stack.rotation.x = -0.14;
          stack.castShadow = true;
          group.add(stack);
        }
        const coil = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), orcMagmaGlowMat);
        coil.position.set(0.26, 0.58, 0.14);
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

    case 'fission_reactor': {
      if (isElf) {
        // ELVES: Harmonic Bio-Resonance Lotus Calyx cradling a spinning starlight plasma core
        const waterPool = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 12), elfJadeRoofMat);
        waterPool.position.y = 0.04;
        group.add(waterPool);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const petal = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.68, 0.16), elfPearlTechMat);
          petal.position.set(Math.cos(a) * 0.28, 0.4, Math.sin(a) * 0.28);
          petal.rotation.y = -a;
          petal.rotation.z = -0.34;
          petal.castShadow = true;
          group.add(petal);
        }
        const torus = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 6, 14), goldMat);
        torus.position.y = 0.52;
        torus.rotation.x = Math.PI / 2;
        group.add(torus);
        const coreCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), elfAquaGlowMat);
        coreCrystal.position.y = 0.54;
        coreCrystal.name = 'spin_part';
        group.add(coreCrystal);
      } else if (isOrc) {
        // ORCS: Volcanic Magma-Core Crater Reactor with 4 Slanted Exhaust Pipes & Blast Grate
        const crater = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.48, 0.38, 7), orcBasaltMat);
        crater.position.y = 0.19;
        crater.castShadow = true;
        group.add(crater);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, 0.62, 6), orcIronMat);
          pipe.position.set(Math.cos(a) * 0.28, 0.46, Math.sin(a) * 0.28);
          pipe.rotation.z = -Math.cos(a) * 0.32;
          pipe.rotation.x = Math.sin(a) * 0.32;
          pipe.castShadow = true;
          group.add(pipe);
        }
        const grate = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 5, 8), orcCrimsonMat);
        grate.position.y = 0.42;
        grate.rotation.x = Math.PI / 2;
        group.add(grate);
        const magmaCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), orcMagmaGlowMat);
        magmaCore.position.y = 0.44;
        magmaCore.name = 'spin_part';
        group.add(magmaCore);
      } else {
        // HUMAN: Twin Hyperbolic Concrete Cooling Stacks + Industrial Turbine Hall
        const slab = new THREE.Mesh(
          new THREE.BoxGeometry(0.84, 0.1, 0.78),
          epochIndex >= 6 ? darkTechMat : darkStoneMat,
        );
        slab.position.y = 0.05;
        group.add(slab);
        const hall = new THREE.Mesh(
          new THREE.BoxGeometry(0.38, 0.32, 0.62),
          epochIndex >= 6 ? techMat : concreteMat,
        );
        hall.position.set(0.2, 0.26, 0);
        hall.castShadow = true;
        group.add(hall);
        const stackMat = epochIndex >= 6 ? techMat : concreteMat;
        for (const pz of [-0.19, 0.19]) {
          const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.72, 10), stackMat);
          tower.position.set(-0.18, 0.46, pz);
          tower.castShadow = true;
          group.add(tower);
        }
        const coreGlow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.24), glowCyanMat);
        coreGlow.position.set(0.22, 0.48, 0);
        if (epochIndex >= 6) coreGlow.name = 'spin_part';
        group.add(coreGlow);
      }
      break;
    }

    case 'cyber_institute': {
      if (isElf) {
        // ELVES: Helical Crystalline Starlight Academy (3 curved arches cradling gyroscope astrolabe rings)
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.12, 10), elfPearlTechMat);
        base.position.y = 0.06;
        group.add(base);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          const arch = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.96, 0.12), elfBirchMat);
          arch.position.set(Math.cos(a) * 0.2, 0.54, Math.sin(a) * 0.2);
          arch.rotation.y = -a;
          arch.rotation.z = 0.2;
          arch.castShadow = true;
          group.add(arch);
        }
        const gyroOuter = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 16), elfJadeRoofMat);
        gyroOuter.position.y = 0.88;
        gyroOuter.rotation.x = 0.6;
        gyroOuter.name = 'spin_part';
        group.add(gyroOuter);
        const crystalApex = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), elfAquaGlowMat);
        crystalApex.position.y = 1.18;
        crystalApex.name = 'spin_part';
        group.add(crystalApex);
      } else if (isOrc) {
        // ORCS: Battered Dreadnought Command Monolith with Iron Buttresses & War-Radar Horns
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 0.76), orcBasaltMat);
        plinth.position.y = 0.07;
        group.add(plinth);
        const fortress = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.42, 0.84, 4),
          epochIndex >= 6 ? orcGunmetalMat : orcIronMat,
        );
        fortress.rotation.y = Math.PI / 4;
        fortress.position.y = 0.56;
        fortress.castShadow = true;
        group.add(fortress);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), orcMagmaGlowMat);
        visor.position.y = 0.82;
        group.add(visor);
        for (const sx of [-0.22, 0.22]) {
          const warHorn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.44, 4), orcCrimsonMat);
          warHorn.position.set(sx, 1.16, 0);
          warHorn.rotation.z = -Math.sign(sx) * 0.25;
          group.add(warHorn);
        }
        const warBeacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), orcMagmaGlowMat);
        warBeacon.position.y = 1.14;
        warBeacon.name = 'spin_part';
        group.add(warBeacon);
      } else {
        // HUMAN: Terraced Glass-and-Steel Tri-Tower Campus + Spinning Radar Array
        const baseWall = epochIndex >= 6 ? techMat : concreteMat;
        const atrium = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.22, 0.72), darkStoneMat);
        atrium.position.y = 0.11;
        group.add(atrium);
        const mainTower = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.96, 0.36), baseWall);
        mainTower.position.set(-0.1, 0.7, -0.08);
        mainTower.castShadow = true;
        group.add(mainTower);
        const sideWing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.62, 0.32), blueRoofMat);
        sideWing.position.set(0.18, 0.52, 0.14);
        sideWing.castShadow = true;
        group.add(sideWing);
        const dataBand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.4), glowCyanMat);
        dataBand.position.set(-0.1, 0.92, -0.08);
        group.add(dataBand);
        const dish = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.08), glowCyanMat);
        dish.position.set(-0.1, 1.26, -0.08);
        dish.name = 'spin_part';
        group.add(dish);
      }
      break;
    }

    case 'rail_station': {
      // Distinct racial train terminals (Elf crescent vine-arch concourse, Orc armored iron-ribbed bunker shed, Human barrel-vault glass grand terminal)
      const platformMat = epochIndex >= 6 ? raceTechTrimMat : isOrc ? orcBasaltMat : isElf ? elfMossStoneMat : darkStoneMat;
      const platform = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.08, 0.84), platformMat);
      platform.position.y = 0.04;
      platform.receiveShadow = true;
      group.add(platform);

      const safetyTrim = new THREE.Mesh(
        new THREE.BoxGeometry(0.88, 0.03, 0.08),
        epochIndex >= 6 ? raceGlowMat : goldMat,
      );
      safetyTrim.position.set(0, 0.085, 0.36);
      group.add(safetyTrim);

      if (isElf) {
        // ELVES: Crescent Vine-Arch Blossom Canopy & Suspended Lantern Pavilion
        const colonnadeM = epochIndex >= 5 ? elfPearlTechMat : elfBirchMat;
        for (const px of [-0.3, 0.3]) {
          const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.36, 8), colonnadeM);
          pier.position.set(px, 0.24, -0.06);
          group.add(pier);
        }
        const archVault = new THREE.Mesh(
          new THREE.CylinderGeometry(0.36, 0.38, 0.72, 10, 1, false, 0, Math.PI),
          epochIndex >= 5 ? elfJadeRoofMat : elfVerdigrisMat,
        );
        archVault.rotation.z = Math.PI / 2;
        archVault.position.set(0, 0.28, -0.06);
        archVault.castShadow = true;
        group.add(archVault);
        const spiritLamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), elfAquaGlowMat);
        spiritLamp.position.set(0, 0.54, 0.26);
        group.add(spiritLamp);
        if (epochIndex >= 5) {
          for (const px of [-0.32, 0.32]) {
            const archPier = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.66, 8), colonnadeM);
            archPier.position.set(px, 0.38, 0.24);
            group.add(archPier);
          }
          const skyCanopy = new THREE.Mesh(
            new THREE.CylinderGeometry(0.24, 0.42, 0.88, 8, 1, false, 0, Math.PI),
            elfJadeRoofMat,
          );
          skyCanopy.rotation.z = Math.PI / 2;
          skyCanopy.position.set(0, 0.72, 0.22);
          group.add(skyCanopy);
        }
      } else if (isOrc) {
        // ORCS: Armored Iron-Tusk Locomotive Shed + Siege Viaduct Overpass
        const hullM = epochIndex >= 5 ? orcGunmetalMat : orcIronMat;
        const shed = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.76, 4), hullM);
        shed.rotation.z = Math.PI / 2;
        shed.rotation.x = Math.PI / 4;
        shed.position.set(0, 0.28, -0.08);
        shed.castShadow = true;
        group.add(shed);
        for (const rx of [-0.28, 0, 0.28]) {
          const rib = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 5, 8, Math.PI), orcCrimsonMat);
          rib.rotation.y = Math.PI / 2;
          rib.position.set(rx, 0.26, -0.06);
          group.add(rib);
        }
        for (const sx of [-0.36, 0.36]) {
          const horn = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.28, 4), orcBoneMat);
          horn.position.set(sx, 0.56, 0.24);
          horn.rotation.x = 0.45;
          group.add(horn);
        }
        if (epochIndex >= 5) {
          const steelDeck = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.14, 0.44), orcIronMat);
          steelDeck.position.set(0, 0.72, 0.22);
          group.add(steelDeck);
          const magmaStrip = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.04, 0.06), orcMagmaGlowMat);
          magmaStrip.position.set(0, 0.78, 0.42);
          group.add(magmaStrip);
        }
      } else {
        // HUMAN: Classic Barrel-Vault Glass-and-Iron Grand Terminus & Clock Gable
        const wallM = epochIndex >= 6 ? techMat : epochIndex === 5 ? blueRoofMat : epochIndex === 4 ? concreteMat : brickMat;
        const concourse = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.24, 0.5), wallM);
        concourse.position.set(0, 0.2, -0.1);
        concourse.castShadow = true;
        group.add(concourse);
        const glassBarrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.26, 0.26, 0.72, 10, 1, false, 0, Math.PI),
          epochIndex >= 5 ? glowCyanMat : darkStoneMat,
        );
        glassBarrel.rotation.z = Math.PI / 2;
        glassBarrel.position.set(0, 0.32, -0.04);
        group.add(glassBarrel);
        const clockGable = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.08), wallM);
        clockGable.position.set(0, 0.42, 0.22);
        group.add(clockGable);
        const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 10), goldMat);
        dial.rotation.x = Math.PI / 2;
        dial.position.set(0, 0.44, 0.265);
        group.add(dial);
        if (epochIndex >= 5) {
          for (const px of [-0.34, 0.34]) {
            const pier = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.64, 0.16), platformMat);
            pier.position.set(px, 0.38, 0.24);
            pier.castShadow = true;
            group.add(pier);
          }
          const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.1, 0.44), platformMat);
          upperDeck.position.set(0, 0.72, 0.22);
          group.add(upperDeck);
          const upperCanopy = new THREE.Mesh(
            new THREE.BoxGeometry(0.86, 0.05, 0.32),
            epochIndex >= 6 ? darkTechMat : concreteMat,
          );
          upperCanopy.position.set(0, 1.0, 0.2);
          group.add(upperCanopy);
        }
      }

      const clockMast = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.42, 0.09), platformMat);
      clockMast.position.set(-0.34, epochIndex >= 5 ? 0.62 : 0.42, 0.26);
      group.add(clockMast);
      const signalBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), raceGlowMat);
      signalBeacon.position.set(-0.34, epochIndex >= 5 ? 0.88 : 0.62, 0.26);
      group.add(signalBeacon);
      break;
    }

    case 'airport': {
      const tarmac = new THREE.Mesh(
        new THREE.BoxGeometry(0.96, 0.06, 0.96),
        isElf ? elfMossStoneMat : isOrc ? orcBasaltMat : darkStoneMat,
      );
      tarmac.position.y = 0.03;
      tarmac.receiveShadow = true;
      group.add(tarmac);

      const taxiGuide = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.015, 0.42),
        epochIndex >= 6 ? raceGlowMat : goldMat,
      );
      taxiGuide.position.set(-0.24, 0.065, 0.22);
      group.add(taxiGuide);

      if (isElf) {
        // ELVES: Moth-Wing Sky-Harbor with Swept Tensile Wings & Twisting Lotus Beacon Spire
        for (const sx of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.56), elfJadeRoofMat);
          wing.position.set(sx * 0.18, 0.34, -0.08);
          wing.rotation.z = sx * 0.32;
          wing.rotation.y = sx * 0.18;
          wing.castShadow = true;
          group.add(wing);
        }
        const blossomHall = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.24, 10), elfPearlTechMat);
        blossomHall.position.set(0, 0.18, -0.08);
        group.add(blossomHall);
        const spireNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.86, 8), elfBirchMat);
        spireNeck.position.set(0.26, 0.48, 0.26);
        group.add(spireNeck);
        const lotusOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), elfAquaGlowMat);
        lotusOrb.position.set(0.26, 0.98, 0.26);
        lotusOrb.name = 'spin_part';
        group.add(lotusOrb);
      } else if (isOrc) {
        // ORCS: Armored Sawtooth Bomber Bastion + Flak Spotlight Tower + Spiked Blast Shields
        for (const rx of [-0.22, 0.14]) {
          const sawtooth = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.46, 4), orcGunmetalMat);
          sawtooth.rotation.z = Math.PI / 2;
          sawtooth.rotation.x = Math.PI / 4;
          sawtooth.position.set(rx, 0.22, -0.14);
          sawtooth.castShadow = true;
          group.add(sawtooth);
        }
        const blastTrim = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.1), orcCrimsonMat);
        blastTrim.position.set(-0.04, 0.12, 0.08);
        group.add(blastTrim);
        const flakTower = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.72, 6), orcIronMat);
        flakTower.position.set(0.28, 0.42, 0.26);
        flakTower.castShadow = true;
        group.add(flakTower);
        const redEye = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.22), orcMagmaGlowMat);
        redEye.position.set(0.28, 0.82, 0.26);
        redEye.name = 'spin_part';
        group.add(redEye);
        for (const sx of [-0.36, -0.16]) {
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), orcBoneMat);
          spike.position.set(sx, 0.16, 0.32);
          spike.rotation.x = -0.35;
          group.add(spike);
        }
      } else {
        // HUMAN: Modernist Vaulted Hangar + Glass Jetbridge Terminal + Flared ATC Tower
        const termWall = epochIndex >= 6 ? techMat : concreteMat;
        const termRoof = blueRoofMat;
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
        const terminal = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.56), termWall);
        terminal.position.set(0.22, 0.19, -0.08);
        terminal.castShadow = true;
        group.add(terminal);
        const termCap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.62), termRoof);
        termCap.position.set(0.22, 0.35, -0.08);
        group.add(termCap);
        const gateGlass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.44), glowCyanMat);
        gateGlass.position.set(0.02, 0.21, -0.08);
        group.add(gateGlass);
        const towerShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.78, 6), termWall);
        towerShaft.position.set(0.26, 0.45, 0.28);
        towerShaft.castShadow = true;
        group.add(towerShaft);
        const controlCab = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.14, 8), glowCyanMat);
        controlCab.position.set(0.26, 0.88, 0.28);
        group.add(controlCab);
        const cabRoof = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 8), termRoof);
        cabRoof.position.set(0.26, 0.97, 0.28);
        group.add(cabRoof);
        const radarBar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.06), goldMat);
        radarBar.position.set(0.26, 1.04, 0.28);
        radarBar.name = 'spin_part';
        group.add(radarBar);
      }

      const sockPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 5), concreteMat);
      sockPole.position.set(-0.38, 0.23, 0.34);
      group.add(sockPole);
      const windSock = new THREE.Mesh(
        new THREE.ConeGeometry(0.045, 0.14, 6),
        isElf ? elfAquaGlowMat : isOrc ? orcCrimsonMat : redRoofMat,
      );
      windSock.rotation.z = -Math.PI / 2;
      windSock.position.set(-0.31, 0.38, 0.34);
      group.add(windSock);
      break;
    }

    case 'launch_arcology': {
      if (isElf) {
        // ELVES: Unfolding 4-Petal Lotus Solar-Sail Star-Needle
        const dais = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.48, 0.12, 10), elfJadeRoofMat);
        dais.position.y = 0.06;
        group.add(dais);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const petal = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.62, 0.14), elfPearlTechMat);
          petal.position.set(Math.cos(a) * 0.24, 0.4, Math.sin(a) * 0.24);
          petal.rotation.y = -a;
          petal.rotation.z = -0.35;
          group.add(petal);
        }
        const needle = new THREE.Mesh(new THREE.ConeGeometry(0.11, 1.18, 10), elfPearlTechMat);
        needle.position.y = 0.82;
        needle.castShadow = true;
        group.add(needle);
        const solarSail = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.028, 6, 16), elfAquaGlowMat);
        solarSail.position.y = 0.92;
        solarSail.rotation.x = Math.PI / 2;
        solarSail.name = 'spin_part';
        group.add(solarSail);
      } else if (isOrc) {
        // ORCS: Recessed Hexagonal War-Silo Braced by 3 Iron Claws + Broad Twin-Booster Juggernaut
        const bunker = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.2, 6), orcBasaltMat);
        bunker.position.y = 0.1;
        group.add(bunker);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          const claw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.88, 0.12), orcIronMat);
          claw.position.set(Math.cos(a) * 0.28, 0.56, Math.sin(a) * 0.28);
          claw.rotation.y = -a;
          claw.rotation.z = 0.24;
          claw.castShadow = true;
          group.add(claw);
        }
        const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.72, 6), orcGunmetalMat);
        hull.position.y = 0.56;
        hull.castShadow = true;
        group.add(hull);
        const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.34, 6), orcCrimsonMat);
        warhead.position.y = 1.09;
        group.add(warhead);
        const flameBell = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.14, 6), orcMagmaGlowMat);
        flameBell.position.y = 0.24;
        flameBell.name = 'flicker_flame';
        group.add(flameBell);
      } else {
        // HUMAN: Stepped Crawlerway Pad + Lattice Umbilical Gantry + Core Tank & Twin Solid Boosters
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.16, 0.86), darkTechMat);
        pad.position.y = 0.08;
        group.add(pad);
        const gantry = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.12, 0.15), techMat);
        gantry.position.set(-0.24, 0.7, -0.18);
        gantry.castShadow = true;
        group.add(gantry);
        const core = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.88, 10), goldMat);
        core.position.set(0.08, 0.64, 0.06);
        core.castShadow = true;
        group.add(core);
        for (const sOff of [-0.14, 0.14]) {
          const srb = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.62, 8), whitePlasterMat);
          srb.position.set(0.08 + sOff, 0.5, 0.06);
          group.add(srb);
        }
        const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 10), whitePlasterMat);
        noseCone.position.set(0.08, 1.2, 0.06);
        group.add(noseCone);
        const thrusterGlow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.18), glowCyanMat);
        thrusterGlow.position.set(0.08, 0.2, 0.06);
        group.add(thrusterGlow);
      }
      break;
    }

    case 'dyson_spire': {
      if (isElf) {
        // ELVES: Floating Tri-Ring Celestial Sanctuary Orrery suspended by 3 Curved Ivory Ribs
        const dais = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.48, 0.14, 12), elfMossStoneMat);
        dais.position.y = 0.07;
        group.add(dais);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          const rib = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.16, 0.12), elfPearlTechMat);
          rib.position.set(Math.cos(a) * 0.24, 0.68, Math.sin(a) * 0.24);
          rib.rotation.y = -a;
          rib.rotation.z = 0.22;
          rib.castShadow = true;
          group.add(rib);
        }
        const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.032, 6, 18), goldMat);
        ring1.position.y = 0.96;
        ring1.rotation.x = 0.7;
        ring1.name = 'spin_part';
        group.add(ring1);
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.028, 6, 16), elfAquaGlowMat);
        ring2.position.y = 0.96;
        ring2.rotation.y = 0.8;
        ring2.name = 'spin_part';
        group.add(ring2);
        const starCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), elfAquaGlowMat);
        starCore.position.y = 0.96;
        group.add(starCore);
        const skyBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.0, 8), elfAquaGlowMat);
        skyBeam.position.y = 2.25;
        group.add(skyBeam);
      } else if (isOrc) {
        // ORCS: Infernal Forge-Cathedral Ziggurat with 4 Claw Pincers Caging a Crimson Plasma Star
        const tier1 = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.18, 0.88), orcBasaltMat);
        tier1.position.y = 0.09;
        group.add(tier1);
        const tier2 = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.22, 0.64), orcGunmetalMat);
        tier2.position.y = 0.29;
        group.add(tier2);
        for (const [cx, cz] of [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]]) {
          const pincer = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.88, 4), orcIronMat);
          pincer.position.set(cx, 0.78, cz);
          pincer.rotation.z = Math.sign(cx) * 0.26;
          pincer.rotation.x = -Math.sign(cz) * 0.26;
          pincer.castShadow = true;
          group.add(pincer);
        }
        const forgeSun = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), orcMagmaGlowMat);
        forgeSun.position.y = 0.92;
        forgeSun.name = 'spin_part';
        group.add(forgeSun);
        const plasmaBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 3.0, 6), orcMagmaGlowMat);
        plasmaBeam.position.y = 2.25;
        group.add(plasmaBeam);
      } else {
        // HUMAN: Precision Orbital Solar-Collector Pyramid & Superconducting Ring
        const tier1 = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.16, 0.84), darkTechMat);
        tier1.position.y = 0.08;
        group.add(tier1);
        const pyramid = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.12, 4), techMat);
        pyramid.rotation.y = Math.PI / 4;
        pyramid.position.y = 0.72;
        pyramid.castShadow = true;
        group.add(pyramid);
        for (let w = 0; w < 4; w++) {
          const a = (w / 4) * Math.PI * 2;
          const solarWing = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.16), goldMat);
          solarWing.position.set(Math.cos(a) * 0.32, 0.56, Math.sin(a) * 0.32);
          solarWing.rotation.y = -a;
          group.add(solarWing);
        }
        const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 6, 14), glowCyanMat);
        haloRing.position.y = 1.04;
        haloRing.rotation.x = Math.PI / 2;
        haloRing.name = 'spin_part';
        group.add(haloRing);
        const skyBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 3.0, 8), glowCyanMat);
        skyBeam.position.y = 2.22;
        group.add(skyBeam);
      }
      break;
    }
  }

  return group;
}

interface DragonGeoTemplate {
  bodyScale: THREE.BufferGeometry;
  bodyBelly: THREE.BufferGeometry;
  bodyHorn: THREE.BufferGeometry;
  headScale: THREE.BufferGeometry;
  headBelly: THREE.BufferGeometry;
  headHorn: THREE.BufferGeometry;
  headEye: THREE.BufferGeometry;
  jawBelly: THREE.BufferGeometry;
  jawHorn: THREE.BufferGeometry;
  tailScale: THREE.BufferGeometry;
  tailBelly: THREE.BufferGeometry;
  tailHorn: THREE.BufferGeometry;
  wingInnerBoneL: THREE.BufferGeometry;
  wingInnerMemL: THREE.BufferGeometry;
  wingInnerHornL: THREE.BufferGeometry;
  wingInnerBoneR: THREE.BufferGeometry;
  wingInnerMemR: THREE.BufferGeometry;
  wingInnerHornR: THREE.BufferGeometry;
  wingOuterBoneL: THREE.BufferGeometry;
  wingOuterMemL: THREE.BufferGeometry;
  wingOuterBoneR: THREE.BufferGeometry;
  wingOuterMemR: THREE.BufferGeometry;
  legScale: THREE.BufferGeometry;
  legHorn: THREE.BufferGeometry;
}

let cachedDragonGeoTemplate: DragonGeoTemplate | null = null;
const cachedDragonPaletteMats = new Map<
  string,
  {
    scaleMat: THREE.MeshStandardMaterial;
    bellyMat: THREE.MeshStandardMaterial;
    wingMat: THREE.MeshStandardMaterial;
    hornMat: THREE.MeshStandardMaterial;
    eyeMat: THREE.MeshStandardMaterial;
  }
>();

function mergeCleanParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepped: THREE.BufferGeometry[] = [];
  for (const g of parts) {
    const clean = g.index ? g.toNonIndexed() : g.clone();
    if (clean.attributes.uv) clean.deleteAttribute('uv');
    if (clean.attributes.color) clean.deleteAttribute('color');
    if (!clean.attributes.normal) clean.computeVertexNormals();
    prepped.push(clean);
    g.dispose();
  }
  const merged = mergeGeometries(prepped, false);
  for (const p of prepped) p.dispose();
  if (!merged) {
    return new THREE.BoxGeometry(0.1, 0.1, 0.1);
  }
  return merged;
}

function makeTransformedBox(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

function makeTransformedCone(
  r: number,
  h: number,
  seg: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(r, h, seg);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

function makeWingTriangleGeo(tris: Array<[number, number, number]>): THREE.BufferGeometry {
  const arr = new Float32Array(tris.length * 3);
  for (let i = 0; i < tris.length; i++) {
    arr[i * 3] = tris[i][0];
    arr[i * 3 + 1] = tris[i][1];
    arr[i * 3 + 2] = tris[i][2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  geo.computeVertexNormals();
  return geo;
}

function getDragonGeoTemplate(): DragonGeoTemplate {
  if (cachedDragonGeoTemplate) return cachedDragonGeoTemplate;

  // 1. Torso & Shoulders
  const bodyScaleParts: THREE.BufferGeometry[] = [
    makeTransformedBox(0.7, 0.56, 0.84, 0, 0.6, 0.16), // Muscular thorax
    makeTransformedBox(0.58, 0.44, 0.44, 0, 0.55, 0.54, 0.14), // Pectoral chest
    makeTransformedBox(0.48, 0.42, 0.52, 0, 0.56, -0.44, -0.06), // Tapered waist & pelvis
    makeTransformedBox(0.24, 0.3, 0.38, -0.36, 0.67, 0.28, 0, 0, 0.14), // Left shoulder pauldron
    makeTransformedBox(0.24, 0.3, 0.38, 0.36, 0.67, 0.28, 0, 0, -0.14), // Right shoulder pauldron
    makeTransformedBox(0.2, 0.26, 0.34, -0.28, 0.57, -0.42, 0, 0, 0.1), // Left hip armor
    makeTransformedBox(0.2, 0.26, 0.34, 0.28, 0.57, -0.42, 0, 0, -0.1), // Right hip armor
  ];
  const bodyBellyParts: THREE.BufferGeometry[] = [];
  for (let bi = 0; bi < 6; bi++) {
    const bz = 0.54 - bi * 0.21;
    const bw = 0.54 - Math.abs(bi - 2) * 0.045;
    const by = 0.33 + (bi >= 4 ? 0.03 : 0);
    bodyBellyParts.push(makeTransformedBox(bw, 0.11, 0.2, 0, by, bz, bi === 0 ? -0.18 : 0));
  }
  const bodyHornParts: THREE.BufferGeometry[] = [
    // Swept collar spikes flanking the neck base
    makeTransformedCone(0.065, 0.28, 4, -0.25, 0.9, 0.52, -0.58, 0, 0.38),
    makeTransformedCone(0.065, 0.28, 4, 0.25, 0.9, 0.52, -0.58, 0, -0.38),
  ];
  for (let si = 0; si < 6; si++) {
    const spineH = 0.28 - si * 0.022;
    bodyHornParts.push(
      makeTransformedCone(0.062, spineH, 4, 0, 0.93 - si * 0.015, 0.48 - si * 0.21, -0.42),
    );
  }

  // 2. Serpentine Neck & Horned Skull (relative to head_pivot at (0, 0.72, 0.62))
  const headScaleParts: THREE.BufferGeometry[] = [
    // S-curved 3-segment neck
    makeTransformedBox(0.36, 0.34, 0.34, 0, 0.12, 0.1, 0.54),
    makeTransformedBox(0.32, 0.34, 0.32, 0, 0.36, 0.24, 0.26),
    makeTransformedBox(0.3, 0.26, 0.28, 0, 0.54, 0.36, 0.06),
    // Angular cranium + elongated snout bridge + flared brow/cheek armor
    makeTransformedBox(0.48, 0.3, 0.42, 0, 0.66, 0.56),
    makeTransformedBox(0.34, 0.21, 0.38, 0, 0.63, 0.88),
    makeTransformedBox(0.24, 0.17, 0.16, 0, 0.62, 1.07),
    // Twin fierce brow ridges
    makeTransformedBox(0.14, 0.09, 0.36, -0.2, 0.79, 0.65, 0.16, -0.14, 0.22),
    makeTransformedBox(0.14, 0.09, 0.36, 0.2, 0.79, 0.65, 0.16, 0.14, -0.22),
    // Flared cheekbone armor
    makeTransformedBox(0.1, 0.16, 0.28, -0.25, 0.58, 0.6, 0, -0.18),
    makeTransformedBox(0.1, 0.16, 0.28, 0.25, 0.58, 0.6, 0, 0.18),
    // Twin raised nostrils
    makeTransformedBox(0.06, 0.06, 0.08, -0.075, 0.72, 1.04),
    makeTransformedBox(0.06, 0.06, 0.08, 0.075, 0.72, 1.04),
  ];
  const headBellyParts: THREE.BufferGeometry[] = [
    makeTransformedBox(0.24, 0.14, 0.26, 0, 0.14, 0.2, 0.48),
    makeTransformedBox(0.22, 0.14, 0.24, 0, 0.34, 0.33, 0.24),
    // Glowing lateral neck heat-vents
    makeTransformedBox(0.35, 0.07, 0.12, 0, 0.24, 0.24, 0.36),
    makeTransformedBox(0.33, 0.07, 0.12, 0, 0.4, 0.34, 0.18),
  ];
  const headHornParts: THREE.BufferGeometry[] = [
    // Neck dorsal crests
    makeTransformedCone(0.048, 0.2, 4, 0, 0.24, 0.02, -0.45),
    makeTransformedCone(0.045, 0.18, 4, 0, 0.46, 0.14, -0.45),
    makeTransformedCone(0.045, 0.18, 4, 0, 0.68, 0.32, -0.55),
    // Nasal horn & brow crest
    makeTransformedCone(0.055, 0.22, 4, 0, 0.78, 0.99, 0.42),
    // Two-stage sweeping great horns (base + backward curved tip)
    makeTransformedCone(0.09, 0.4, 5, -0.17, 0.87, 0.42, -0.72, 0, 0.26),
    makeTransformedCone(0.058, 0.34, 5, -0.25, 0.99, 0.18, -1.12, 0, 0.34),
    makeTransformedCone(0.09, 0.4, 5, 0.17, 0.87, 0.42, -0.72, 0, -0.26),
    makeTransformedCone(0.058, 0.34, 5, 0.25, 0.99, 0.18, -1.12, 0, -0.34),
    // Secondary temple/cheek horns
    makeTransformedCone(0.05, 0.24, 4, -0.26, 0.74, 0.44, -0.95, 0, 0.65),
    makeTransformedCone(0.05, 0.24, 4, 0.26, 0.74, 0.44, -0.95, 0, -0.65),
    // Upper fangs along snout edge
    makeTransformedCone(0.028, 0.095, 4, -0.11, 0.51, 0.88, Math.PI),
    makeTransformedCone(0.028, 0.095, 4, 0.11, 0.51, 0.88, Math.PI),
    makeTransformedCone(0.026, 0.09, 4, -0.08, 0.51, 1.06, Math.PI),
    makeTransformedCone(0.026, 0.09, 4, 0.08, 0.51, 1.06, Math.PI),
  ];
  const headEyeParts: THREE.BufferGeometry[] = [
    makeTransformedBox(0.055, 0.06, 0.11, -0.21, 0.71, 0.68),
    makeTransformedBox(0.055, 0.06, 0.11, 0.21, 0.71, 0.68),
  ];

  // 3. Lower Jaw (relative to jaw_pivot at (0, 0.48, 0.46))
  const jawBellyParts: THREE.BufferGeometry[] = [
    makeTransformedBox(0.35, 0.1, 0.5, 0, -0.04, 0.24),
    makeTransformedBox(0.24, 0.09, 0.2, 0, -0.02, 0.52),
  ];
  const jawHornParts: THREE.BufferGeometry[] = [
    makeTransformedCone(0.042, 0.16, 4, 0, -0.1, 0.44, -2.55), // Chin spike
    makeTransformedCone(0.032, 0.11, 4, -0.12, 0.04, 0.44),
    makeTransformedCone(0.032, 0.11, 4, 0.12, 0.04, 0.44),
    makeTransformedCone(0.026, 0.09, 4, -0.09, 0.04, 0.58),
    makeTransformedCone(0.026, 0.09, 4, 0.09, 0.04, 0.58),
  ];

  // 4. Barbed Sinuous Tail (relative to tail_pivot at (0, 0.56, -0.68))
  const tailScaleParts: THREE.BufferGeometry[] = [
    makeTransformedBox(0.36, 0.32, 0.56, 0, 0.0, -0.26),
    makeTransformedBox(0.26, 0.24, 0.52, 0, 0.04, -0.72, 0.14),
    makeTransformedBox(0.18, 0.16, 0.48, 0, 0.14, -1.16, 0.28),
    makeTransformedBox(0.11, 0.11, 0.4, 0, 0.28, -1.54, 0.34),
  ];
  const tailBellyParts: THREE.BufferGeometry[] = [
    makeTransformedBox(0.26, 0.08, 0.46, 0, -0.14, -0.26),
    makeTransformedBox(0.18, 0.07, 0.42, 0, -0.07, -0.7, 0.14),
    makeTransformedBox(0.12, 0.06, 0.36, 0, 0.06, -1.12, 0.28),
  ];
  const tailHornParts: THREE.BufferGeometry[] = [
    makeTransformedCone(0.046, 0.18, 4, 0, 0.22, -0.24, -0.45),
    makeTransformedCone(0.042, 0.16, 4, 0, 0.22, -0.58, -0.45),
    makeTransformedCone(0.036, 0.15, 4, 0, 0.26, -0.92, -0.55),
    makeTransformedCone(0.032, 0.14, 4, 0, 0.36, -1.28, -0.62),
    // Halberd diamond tail spade + twin lateral barbs
    makeTransformedCone(0.17, 0.42, 4, 0, 0.4, -1.84, -Math.PI / 2 + 0.34, Math.PI / 4),
    makeTransformedCone(0.055, 0.24, 4, -0.14, 0.35, -1.72, -1.2, -0.55),
    makeTransformedCone(0.055, 0.24, 4, 0.14, 0.35, -1.72, -1.2, 0.55),
  ];

  // 5. Detailed Bat-Like Multi-Spar Scalloped Wings (symmetric Left & Right)
  const buildWingSide = (sign: -1 | 1) => {
    const innerBones: THREE.BufferGeometry[] = [
      // Heavy armored leading wing arm + elbow joint + two radiating inner finger ribs
      makeTransformedBox(1.06, 0.1, 0.14, sign * 0.52, 0.06, 0.06),
      makeTransformedBox(0.22, 0.14, 0.18, sign * 1.0, 0.07, 0.06), // Wrist joint knuckle
      makeTransformedBox(0.08, 0.05, 0.72, sign * 0.52, 0.04, -0.32, 0, sign * -0.12), // Mid rib
      makeTransformedBox(0.07, 0.05, 0.62, sign * 0.84, 0.04, -0.3, 0, sign * 0.18), // Outer rib
    ];
    const innerHorns: THREE.BufferGeometry[] = [
      makeTransformedCone(0.048, 0.22, 4, sign * 1.04, 0.12, 0.19, 0.9, 0, sign * -0.2), // Wing wrist claw
    ];
    // Scalloped inner wing membrane web
    const innerMem = makeWingTriangleGeo([
      [0, 0.05, 0.02], [sign * 0.52, 0.06, 0.02], [sign * 0.45, 0.03, -0.74],
      [0, 0.05, 0.02], [sign * 0.45, 0.03, -0.74], [0, 0.02, -0.58],
      [sign * 0.52, 0.06, 0.02], [sign * 1.02, 0.05, 0.02], [sign * 0.94, 0.02, -0.68],
      [sign * 0.52, 0.06, 0.02], [sign * 0.94, 0.02, -0.68], [sign * 0.45, 0.03, -0.74],
      // Scalloped notches at trailing edge
      [0, 0.02, -0.58], [sign * 0.24, 0.02, -0.52], [sign * 0.45, 0.03, -0.74],
      [sign * 0.45, 0.03, -0.74], [sign * 0.72, 0.02, -0.56], [sign * 0.94, 0.02, -0.68],
    ]);

    // Outer wing fingers (swept main leading phalanx + 3 fanned finger spars)
    const outerBones: THREE.BufferGeometry[] = [
      makeTransformedBox(1.16, 0.08, 0.11, sign * 0.56, 0.01, -0.12, 0, sign * -0.24), // Main leading spar
      makeTransformedBox(1.02, 0.05, 0.07, sign * 0.45, 0.0, -0.34, 0, sign * -0.52), // Finger 2
      makeTransformedBox(0.84, 0.045, 0.06, sign * 0.28, -0.01, -0.46, 0, sign * -0.88), // Finger 3
      makeTransformedBox(0.64, 0.04, 0.055, sign * 0.08, -0.02, -0.48, 0, sign * -1.24), // Finger 4
    ];
    // 3-bay scalloped outer bat-wing membrane
    const outerMem = makeWingTriangleGeo([
      // Bay 1: leading tip -> finger 2 tip
      [0, 0.02, 0.0], [sign * 1.12, 0.01, -0.26], [sign * 0.84, -0.01, -0.66],
      [0, 0.02, 0.0], [sign * 0.84, -0.01, -0.66], [sign * 0.66, 0.0, -0.38],
      // Bay 2: finger 2 -> finger 3
      [0, 0.02, 0.0], [sign * 0.84, -0.01, -0.66], [sign * 0.46, -0.02, -0.82],
      [0, 0.02, 0.0], [sign * 0.46, -0.02, -0.82], [sign * 0.36, 0.0, -0.56],
      // Bay 3: finger 3 -> trailing root
      [0, 0.02, 0.0], [sign * 0.46, -0.02, -0.82], [sign * 0.06, -0.02, -0.76],
      [0, 0.02, 0.0], [sign * 0.06, -0.02, -0.76], [sign * -0.08, -0.01, -0.68],
    ]);

    return {
      innerBone: mergeCleanParts(innerBones),
      innerMem,
      innerHorn: mergeCleanParts(innerHorns),
      outerBone: mergeCleanParts(outerBones),
      outerMem,
    };
  };

  const leftWing = buildWingSide(-1);
  const rightWing = buildWingSide(1);

  // 6. Digitigrade Clawed Legs (reused across all 4 limbs)
  const legScaleParts: THREE.BufferGeometry[] = [
    makeTransformedBox(0.2, 0.22, 0.22, 0, -0.08, -0.02, -0.18), // Muscular thigh
    makeTransformedBox(0.14, 0.22, 0.14, 0, -0.24, 0.04, 0.24), // Angled shin
  ];
  const legHornParts: THREE.BufferGeometry[] = [
    makeTransformedBox(0.18, 0.06, 0.16, 0, -0.35, 0.07), // Foot pad
    makeTransformedCone(0.03, 0.12, 4, -0.065, -0.36, 0.19, Math.PI / 2), // Left talon
    makeTransformedCone(0.032, 0.14, 4, 0, -0.36, 0.21, Math.PI / 2), // Center talon
    makeTransformedCone(0.03, 0.12, 4, 0.065, -0.36, 0.19, Math.PI / 2), // Right talon
    makeTransformedCone(0.026, 0.1, 4, 0, -0.33, -0.04, -1.2), // Rear ankle spur
  ];

  cachedDragonGeoTemplate = {
    bodyScale: mergeCleanParts(bodyScaleParts),
    bodyBelly: mergeCleanParts(bodyBellyParts),
    bodyHorn: mergeCleanParts(bodyHornParts),
    headScale: mergeCleanParts(headScaleParts),
    headBelly: mergeCleanParts(headBellyParts),
    headHorn: mergeCleanParts(headHornParts),
    headEye: mergeCleanParts(headEyeParts),
    jawBelly: mergeCleanParts(jawBellyParts),
    jawHorn: mergeCleanParts(jawHornParts),
    tailScale: mergeCleanParts(tailScaleParts),
    tailBelly: mergeCleanParts(tailBellyParts),
    tailHorn: mergeCleanParts(tailHornParts),
    wingInnerBoneL: leftWing.innerBone,
    wingInnerMemL: leftWing.innerMem,
    wingInnerHornL: leftWing.innerHorn,
    wingInnerBoneR: rightWing.innerBone,
    wingInnerMemR: rightWing.innerMem,
    wingInnerHornR: rightWing.innerHorn,
    wingOuterBoneL: leftWing.outerBone,
    wingOuterMemL: leftWing.outerMem,
    wingOuterBoneR: rightWing.outerBone,
    wingOuterMemR: rightWing.outerMem,
    legScale: mergeCleanParts(legScaleParts),
    legHorn: mergeCleanParts(legHornParts),
  };

  return cachedDragonGeoTemplate;
}

function getDragonPaletteMaterials(palette: ReturnType<typeof getDragonVariant>) {
  let mats = cachedDragonPaletteMats.get(palette.name);
  if (!mats) {
    const wingMat = new THREE.MeshStandardMaterial({
      color: palette.wing,
      roughness: 0.54,
      metalness: 0.14,
      side: THREE.DoubleSide,
    });
    mats = {
      scaleMat: new THREE.MeshStandardMaterial({
        color: palette.body,
        roughness: 0.36,
        metalness: 0.36,
      }),
      bellyMat: new THREE.MeshStandardMaterial({
        color: palette.belly,
        roughness: 0.44,
        metalness: 0.22,
        emissive: new THREE.Color(palette.glow),
        emissiveIntensity: 0.2,
      }),
      wingMat,
      hornMat: new THREE.MeshStandardMaterial({
        color: 0xf4e8d2,
        roughness: 0.3,
        metalness: 0.28,
      }),
      eyeMat: new THREE.MeshStandardMaterial({
        color: palette.glow,
        roughness: 0.18,
        metalness: 0.1,
        emissive: new THREE.Color(palette.glow),
        emissiveIntensity: 1.35,
      }),
    };
    cachedDragonPaletteMats.set(palette.name, mats);
  }
  return mats;
}

function buildCreatureUnitGroup(
  group: THREE.Group,
  role: UnitRole,
  s0: number,
  s1: number,
  _s2: number,
  _s3: number,
): THREE.Group {
  const mat = (color: number, roughness = 0.72, metalness = 0.05, emissive = 0, emissiveIntensity = 0) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      emissive,
      emissiveIntensity,
    });

  const makePivot = (name: string, x: number, y: number, z: number) => {
    const p = new THREE.Group();
    p.name = name;
    p.position.set(x, y, z);
    return p;
  };

  const darkEyeMat = mat(0x16161a, 0.35, 0.2);
  let shadowRadius = 0.56;
  let auraRadius = 0.28;

  const bodyPivot = makePivot('body_pivot', 0, 0, 0);
  group.add(bodyPivot);

  if (role === 'chicken') {
    shadowRadius = 0.36;
    auraRadius = 0.22;
    const coats = [0xf8fafc, 0xd99b52, 0xb87333, 0xf1e3c6];
    const bodyMat = mat(coats[s0 % coats.length], 0.8);
    const wingTone = mat(s0 % 2 === 0 ? 0xe2e8f0 : 0x9c5a25, 0.82);
    const combMat = mat(0xd62828, 0.55);
    const beakMat = mat(0xf59e0b, 0.5);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.2), bodyMat);
    body.position.set(0, 0.14, 0);
    body.castShadow = true;
    bodyPivot.add(body);

    const tailPivot = makePivot('tail_pivot', 0, 0.17, -0.09);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.09), wingTone);
    tail.position.set(0, 0.03, -0.04);
    tail.rotation.x = -0.4;
    tailPivot.add(tail);
    bodyPivot.add(tailPivot);

    const headPivot = makePivot('head_pivot', 0, 0.2, 0.07);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), bodyMat);
    head.position.set(0, 0.05, 0.02);
    head.castShadow = true;
    headPivot.add(head);

    const comb = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.055, 0.08), combMat);
    comb.position.set(0, 0.125, 0.025);
    headPivot.add(comb);

    const wattle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.03), combMat);
    wattle.position.set(0, 0.0, 0.075);
    headPivot.add(wattle);

    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.03, 0.06), beakMat);
    beak.position.set(0, 0.04, 0.095);
    headPivot.add(beak);

    for (const ex of [-0.056, 0.056]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.022, 0.022), darkEyeMat);
      eye.position.set(ex, 0.06, 0.04);
      headPivot.add(eye);
    }
    bodyPivot.add(headPivot);

    for (const [name, lx] of [
      ['leg_l', -0.045],
      ['leg_r', 0.045],
    ] as const) {
      const legPivot = makePivot(name, lx, 0.09, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.09, 0.026), beakMat);
      leg.position.set(0, -0.045, 0);
      legPivot.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.016, 0.055), beakMat);
      foot.position.set(0, -0.082, 0.012);
      legPivot.add(foot);
      group.add(legPivot);
    }

    const wingGeo = new THREE.BoxGeometry(0.032, 0.085, 0.13);
    const wingLPivot = makePivot('wing_l', -0.08, 0.17, 0);
    const wingL = new THREE.Mesh(wingGeo, wingTone);
    wingL.position.set(-0.016, -0.01, -0.01);
    wingLPivot.add(wingL);
    bodyPivot.add(wingLPivot);

    const wingRPivot = makePivot('wing_r', 0.08, 0.17, 0);
    const wingR = new THREE.Mesh(wingGeo, wingTone);
    wingR.position.set(0.016, -0.01, -0.01);
    wingRPivot.add(wingR);
    bodyPivot.add(wingRPivot);
  } else if (role === 'pig') {
    shadowRadius = 0.54;
    auraRadius = 0.28;
    const coats = [0xf4a5ae, 0xe88d9a, 0xd49b87, 0x4a423e];
    const bodyMat = mat(coats[s0 % coats.length], 0.72);
    const snoutMat = mat(0xf9bec7, 0.62);
    const hoofMat = mat(0x3a2e2b, 0.8);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.21, 0.35), bodyMat);
    body.position.set(0, 0.19, -0.02);
    body.castShadow = true;
    bodyPivot.add(body);

    const headPivot = makePivot('head_pivot', 0, 0.23, 0.14);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.19, 0.18), bodyMat);
    head.position.set(0, 0.0, 0.06);
    head.castShadow = true;
    headPivot.add(head);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.085, 0.065), snoutMat);
    snout.position.set(0, -0.03, 0.165);
    headPivot.add(snout);

    for (const ex of [-0.078, 0.078]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.035), bodyMat);
      ear.position.set(ex, 0.095, 0.06);
      ear.rotation.z = ex < 0 ? 0.35 : -0.35;
      headPivot.add(ear);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.026, 0.02), darkEyeMat);
      eye.position.set(ex * 0.9, 0.02, 0.155);
      headPivot.add(eye);
    }
    bodyPivot.add(headPivot);

    const tailPivot = makePivot('tail_pivot', 0, 0.23, -0.19);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.055, 0.055), snoutMat);
    tail.position.set(0, 0.015, -0.02);
    tail.rotation.x = 0.55;
    tailPivot.add(tail);
    bodyPivot.add(tailPivot);

    for (const [name, lx, lz] of [
      ['leg_fl', -0.085, 0.1],
      ['leg_fr', 0.085, 0.1],
      ['leg_bl', -0.085, -0.13],
      ['leg_br', 0.085, -0.13],
    ] as const) {
      const legPivot = makePivot(name, lx, 0.11, lz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.09, 0.062), bodyMat);
      leg.position.set(0, -0.045, 0);
      legPivot.add(leg);
      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.03, 0.064), hoofMat);
      hoof.position.set(0, -0.095, 0);
      legPivot.add(hoof);
      group.add(legPivot);
    }
  } else if (role === 'capybara') {
    shadowRadius = 0.56;
    auraRadius = 0.29;
    const coats = [0x9c6644, 0x8b5a3c, 0xa47148, 0x7f5539];
    const bodyMat = mat(coats[s0 % coats.length], 0.84);
    const snoutMat = mat(0x5c3d2e, 0.86);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.21, 0.42), bodyMat);
    body.position.set(0, 0.18, -0.02);
    body.castShadow = true;
    bodyPivot.add(body);

    const headPivot = makePivot('head_pivot', 0, 0.26, 0.16);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.23), bodyMat);
    head.position.set(0, 0.01, 0.07);
    head.castShadow = true;
    headPivot.add(head);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.085, 0.055), snoutMat);
    nose.position.set(0, -0.01, 0.185);
    headPivot.add(nose);

    for (const ex of [-0.068, 0.068]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.048, 0.042), snoutMat);
      ear.position.set(ex, 0.1, 0.0);
      headPivot.add(ear);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.024, 0.026), darkEyeMat);
      eye.position.set(ex * 1.32, 0.04, 0.1);
      headPivot.add(eye);
    }
    bodyPivot.add(headPivot);

    const tailPivot = makePivot('tail_pivot', 0, 0.19, -0.22);
    const nub = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), snoutMat);
    tailPivot.add(nub);
    bodyPivot.add(tailPivot);

    for (const [name, lx, lz] of [
      ['leg_fl', -0.09, 0.12],
      ['leg_fr', 0.09, 0.12],
      ['leg_bl', -0.09, -0.15],
      ['leg_br', 0.09, -0.15],
    ] as const) {
      const legPivot = makePivot(name, lx, 0.1, lz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.1, 0.068), snoutMat);
      leg.position.set(0, -0.05, 0);
      legPivot.add(leg);
      group.add(legPivot);
    }
  } else if (role === 'cow') {
    shadowRadius = 0.68;
    auraRadius = 0.34;
    const isHolstein = s0 % 3 !== 1;
    const baseMat = mat(isHolstein ? 0xf8fafc : 0x9c5a25, 0.78);
    const spotMat = mat(isHolstein ? 0x1e2026 : 0xf2dfc4, 0.8);
    const muzzleMat = mat(0xf4b6c2, 0.65);
    const hornMat = mat(0xe8dec8, 0.5);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.27, 0.52), baseMat);
    body.position.set(0, 0.28, -0.02);
    body.castShadow = true;
    bodyPivot.add(body);

    const patch1 = new THREE.Mesh(new THREE.BoxGeometry(0.305, 0.17, 0.21), spotMat);
    patch1.position.set(0, 0.31, -0.08);
    bodyPivot.add(patch1);
    const patch2 = new THREE.Mesh(new THREE.BoxGeometry(0.305, 0.15, 0.15), spotMat);
    patch2.position.set(0, 0.25, 0.14);
    bodyPivot.add(patch2);

    const headPivot = makePivot('head_pivot', 0, 0.35, 0.22);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.21, 0.21), baseMat);
    head.position.set(0, 0.02, 0.08);
    head.castShadow = true;
    headPivot.add(head);

    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.095, 0.085), muzzleMat);
    muzzle.position.set(0, -0.04, 0.185);
    headPivot.add(muzzle);

    for (const hx of [-0.115, 0.115]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.085, 5), hornMat);
      horn.position.set(hx, 0.125, 0.07);
      horn.rotation.z = hx < 0 ? 0.55 : -0.55;
      headPivot.add(horn);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.028, 0.026), darkEyeMat);
      eye.position.set(hx * 0.9, 0.05, 0.15);
      headPivot.add(eye);
    }
    bodyPivot.add(headPivot);

    const tailPivot = makePivot('tail_pivot', 0, 0.36, -0.28);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.21, 0.042), spotMat);
    tail.position.set(0, -0.09, -0.02);
    tail.rotation.x = 0.2;
    tailPivot.add(tail);
    bodyPivot.add(tailPivot);

    for (const [name, lx, lz] of [
      ['leg_fl', -0.095, 0.16],
      ['leg_fr', 0.095, 0.16],
      ['leg_bl', -0.095, -0.2],
      ['leg_br', 0.095, -0.2],
    ] as const) {
      const legPivot = makePivot(name, lx, 0.16, lz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.16, 0.075), baseMat);
      leg.position.set(0, -0.08, 0);
      legPivot.add(leg);
      group.add(legPivot);
    }
  } else if (role === 'wolf') {
    shadowRadius = 0.62;
    auraRadius = 0.32;
    const coats = [0x7b848f, 0xd8dee9, 0x434850, 0x8f7a66];
    const furColor = coats[s0 % coats.length];
    const furMat = mat(furColor, 0.78);
    const ruffMat = mat(s0 % 4 === 1 ? 0xf8fafc : 0xcbd5e1, 0.8);
    const eyeMat = mat(0xfbbf24, 0.3, 0.2, 0xf59e0b, 0.55);
    const fangMat = mat(0xfefefe, 0.3);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.21, 0.46), furMat);
    body.position.set(0, 0.25, -0.02);
    body.castShadow = true;
    bodyPivot.add(body);

    const ruff = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.23, 0.16), ruffMat);
    ruff.position.set(0, 0.27, 0.16);
    bodyPivot.add(ruff);

    const headPivot = makePivot('head_pivot', 0, 0.33, 0.21);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.17, 0.18), furMat);
    head.position.set(0, 0.02, 0.06);
    head.castShadow = true;
    headPivot.add(head);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.13), furMat);
    snout.position.set(0, 0.0, 0.18);
    headPivot.add(snout);

    const jawPivot = makePivot('jaw_pivot', 0, -0.035, 0.11);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.038, 0.12), ruffMat);
    jaw.position.set(0, 0, 0.055);
    jawPivot.add(jaw);
    for (const fx of [-0.032, 0.032]) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.035, 4), fangMat);
      fang.position.set(fx, 0.025, 0.09);
      jawPivot.add(fang);
    }
    headPivot.add(jawPivot);

    for (const ex of [-0.06, 0.06]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.095, 4), furMat);
      ear.position.set(ex, 0.14, 0.04);
      headPivot.add(ear);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.022, 0.022), eyeMat);
      eye.position.set(ex * 0.95, 0.045, 0.145);
      headPivot.add(eye);
    }
    bodyPivot.add(headPivot);

    const tailPivot = makePivot('tail_pivot', 0, 0.28, -0.24);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.26), furMat);
    tail.position.set(0, 0.02, -0.12);
    tail.rotation.x = 0.42;
    tailPivot.add(tail);
    bodyPivot.add(tailPivot);

    for (const [name, lx, lz] of [
      ['leg_fl', -0.07, 0.15],
      ['leg_fr', 0.07, 0.15],
      ['leg_bl', -0.07, -0.19],
      ['leg_br', 0.07, -0.19],
    ] as const) {
      const legPivot = makePivot(name, lx, 0.17, lz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.17, 0.06), furMat);
      leg.position.set(0, -0.085, 0);
      legPivot.add(leg);
      group.add(legPivot);
    }
  } else if (role === 'bear') {
    shadowRadius = 0.78;
    auraRadius = 0.42;
    const coats = [0x6f4528, 0x2b2523, 0x855331, 0xe8edf2];
    const furMat = mat(coats[s0 % coats.length], 0.85);
    const snoutMat = mat(s0 % 4 === 3 ? 0xdbe3ea : 0xb08968, 0.8);
    const clawMat = mat(0xeae2d0, 0.45);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.6), furMat);
    body.position.set(0, 0.33, -0.02);
    body.castShadow = true;
    bodyPivot.add(body);

    const hump = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.24), furMat);
    hump.position.set(0, 0.51, 0.13);
    bodyPivot.add(hump);

    const headPivot = makePivot('head_pivot', 0, 0.41, 0.26);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.25, 0.26), furMat);
    head.position.set(0, 0.02, 0.09);
    head.castShadow = true;
    headPivot.add(head);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.11), snoutMat);
    snout.position.set(0, -0.02, 0.22);
    headPivot.add(snout);

    const jawPivot = makePivot('jaw_pivot', 0, -0.075, 0.14);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.12), snoutMat);
    jaw.position.set(0, 0, 0.05);
    jawPivot.add(jaw);
    headPivot.add(jawPivot);

    for (const ex of [-0.1, 0.1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.048), furMat);
      ear.position.set(ex, 0.145, 0.05);
      headPivot.add(ear);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.022), darkEyeMat);
      eye.position.set(ex * 0.78, 0.05, 0.21);
      headPivot.add(eye);
    }
    bodyPivot.add(headPivot);

    const tailPivot = makePivot('tail_pivot', 0, 0.37, -0.33);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), furMat);
    tailPivot.add(tail);
    bodyPivot.add(tailPivot);

    for (const [name, lx, lz] of [
      ['leg_fl', -0.13, 0.2],
      ['leg_fr', 0.13, 0.2],
      ['leg_bl', -0.13, -0.22],
      ['leg_br', 0.13, -0.22],
    ] as const) {
      const legPivot = makePivot(name, lx, 0.19, lz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.19, 0.12), furMat);
      leg.position.set(0, -0.095, 0);
      legPivot.add(leg);
      const claws = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.05), clawMat);
      claws.position.set(0, -0.175, 0.06);
      legPivot.add(claws);
      group.add(legPivot);
    }
  } else if (role === 'dinosaur') {
    shadowRadius = 1.05;
    auraRadius = 0.56;
    const morph = s0 % 3;
    const skinPalettes = [0x3b7a48, 0x7c5c3e, 0x2d6a6a, 0x8b4a39];
    const scaleMat = mat(skinPalettes[s1 % skinPalettes.length], 0.7);
    const bellyMat = mat(0xc2b280, 0.78);
    const hornMat = mat(0xf4ecd8, 0.42);
    const dinoScale = 1.28;

    if (morph === 0) {
      // Tyrannosaur biped apex predator
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.64), scaleMat);
      torso.position.set(0, 0.54, 0.02);
      torso.rotation.x = -0.24;
      torso.castShadow = true;
      bodyPivot.add(torso);

      const belly = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.48), bellyMat);
      belly.position.set(0, 0.48, 0.06);
      belly.rotation.x = -0.24;
      bodyPivot.add(belly);

      const headPivot = makePivot('head_pivot', 0, 0.72, 0.28);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.42), scaleMat);
      head.position.set(0, 0.09, 0.14);
      head.castShadow = true;
      headPivot.add(head);

      const jawPivot = makePivot('jaw_pivot', 0, -0.02, 0.06);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.34), bellyMat);
      jaw.position.set(0, -0.04, 0.11);
      jawPivot.add(jaw);
      for (const tx of [-0.08, 0.08]) {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.065, 4), hornMat);
        tooth.position.set(tx, 0.025, 0.25);
        jawPivot.add(tooth);
      }
      headPivot.add(jawPivot);

      for (const tx of [-0.085, 0.085]) {
        const upperTooth = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.07, 4), hornMat);
        upperTooth.rotation.x = Math.PI;
        upperTooth.position.set(tx, -0.035, 0.31);
        headPivot.add(upperTooth);
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.04), mat(0xfbbf24, 0.3, 0.2, 0xf59e0b, 0.55));
        eye.position.set(tx * 1.8, 0.13, 0.16);
        headPivot.add(eye);
      }
      bodyPivot.add(headPivot);

      for (const tx of [-0.18, 0.18]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.18), scaleMat);
        arm.position.set(tx, 0.5, 0.31);
        bodyPivot.add(arm);
      }

      const tailPivot = makePivot('tail_pivot', 0, 0.52, -0.28);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.21, 0.68), scaleMat);
      tail.position.set(0, -0.02, -0.32);
      tail.rotation.x = 0.14;
      tailPivot.add(tail);
      bodyPivot.add(tailPivot);

      for (const [name, lx] of [
        ['leg_l', -0.15],
        ['leg_r', 0.15],
      ] as const) {
        const legPivot = makePivot(name, lx, 0.36, -0.02);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.36, 0.16), scaleMat);
        leg.position.set(0, -0.18, 0);
        legPivot.add(leg);
        group.add(legPivot);
      }
    } else if (morph === 1) {
      // Triceratops armored horned charger
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 0.68), scaleMat);
      body.position.set(0, 0.38, -0.02);
      body.castShadow = true;
      bodyPivot.add(body);

      const headPivot = makePivot('head_pivot', 0, 0.42, 0.28);
      const frill = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.1), scaleMat);
      frill.position.set(0, 0.12, 0.04);
      frill.rotation.x = -0.22;
      frill.castShadow = true;
      headPivot.add(frill);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.3), scaleMat);
      head.position.set(0, 0.0, 0.17);
      headPivot.add(head);

      for (const hx of [-0.13, 0.13]) {
        const browHorn = new THREE.Mesh(new THREE.ConeGeometry(0.046, 0.32, 5), hornMat);
        browHorn.rotation.x = Math.PI * 0.42;
        browHorn.position.set(hx, 0.13, 0.31);
        headPivot.add(browHorn);
      }
      const noseHorn = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.18, 5), hornMat);
      noseHorn.rotation.x = Math.PI * 0.32;
      noseHorn.position.set(0, 0.05, 0.33);
      headPivot.add(noseHorn);
      bodyPivot.add(headPivot);

      const tailPivot = makePivot('tail_pivot', 0, 0.34, -0.34);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.44), scaleMat);
      tail.position.set(0, -0.02, -0.2);
      tailPivot.add(tail);
      bodyPivot.add(tailPivot);

      for (const [name, lx, lz] of [
        ['leg_fl', -0.16, 0.2],
        ['leg_fr', 0.16, 0.2],
        ['leg_bl', -0.16, -0.22],
        ['leg_br', 0.16, -0.22],
      ] as const) {
        const legPivot = makePivot(name, lx, 0.22, lz);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.22, 0.13), scaleMat);
        leg.position.set(0, -0.11, 0);
        legPivot.add(leg);
        group.add(legPivot);
      }
    } else {
      // Stegosaurus plated bruiser
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.72), scaleMat);
      body.position.set(0, 0.38, 0);
      body.castShadow = true;
      bodyPivot.add(body);

      const headPivot = makePivot('head_pivot', 0, 0.39, 0.34);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.15, 0.26), scaleMat);
      head.position.set(0, 0, 0.12);
      headPivot.add(head);
      bodyPivot.add(headPivot);

      const plateMat = mat(0xe09f3e, 0.6);
      for (let pi = 0; pi < 5; pi++) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.22, 0.13), plateMat);
        plate.position.set(pi % 2 === 0 ? -0.06 : 0.06, 0.64, 0.24 - pi * 0.15);
        plate.rotation.x = 0.12;
        bodyPivot.add(plate);
      }

      const tailPivot = makePivot('tail_pivot', 0, 0.38, -0.34);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.5), scaleMat);
      tail.position.set(0, 0, -0.24);
      tailPivot.add(tail);
      for (const sx of [-0.085, 0.085]) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.18, 4), hornMat);
        spike.rotation.z = sx < 0 ? 0.85 : -0.85;
        spike.position.set(sx, 0.08, -0.38);
        tailPivot.add(spike);
      }
      bodyPivot.add(tailPivot);

      for (const [name, lx, lz] of [
        ['leg_fl', -0.14, 0.22],
        ['leg_fr', 0.14, 0.22],
        ['leg_bl', -0.14, -0.22],
        ['leg_br', 0.14, -0.22],
      ] as const) {
        const legPivot = makePivot(name, lx, 0.22, lz);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.12), scaleMat);
        leg.position.set(0, -0.11, 0);
        legPivot.add(leg);
        group.add(legPivot);
      }
    }
    bodyPivot.scale.setScalar(dinoScale);
    group.children.forEach((c) => {
      if (c.name.startsWith('leg_')) c.scale.setScalar(dinoScale);
    });
  } else if (role === 'dragon') {
    // Detailed, geometry-merged colossal winged dragon (~4.3-unit wingspan, sculpted horned head, fangs, scalloped wings, barbed tail)
    shadowRadius = 1.65;
    auraRadius = 0.92;
    const dragonSeed = Number(group.userData.appearanceSeed ?? 1);
    const palette = getDragonVariant(dragonSeed);
    const geo = getDragonGeoTemplate();
    const { scaleMat, bellyMat, wingMat, hornMat, eyeMat } = getDragonPaletteMaterials(palette);
    const mawGlowMat = new THREE.MeshStandardMaterial({
      color: palette.glow,
      emissive: new THREE.Color(palette.glow),
      emissiveIntensity: 1.45,
      roughness: 0.2,
      metalness: 0.1,
    });
    mawGlowMat.name = 'dragon_maw_mat';

    // Merged armored torso, ventral keel plates, and dorsal spine ridge
    const bodyScaleMesh = new THREE.Mesh(geo.bodyScale, scaleMat);
    bodyScaleMesh.castShadow = true;
    bodyPivot.add(bodyScaleMesh);
    bodyPivot.add(new THREE.Mesh(geo.bodyBelly, bellyMat));
    bodyPivot.add(new THREE.Mesh(geo.bodyHorn, hornMat));

    // Articulated arched S-neck, horned skull, brow ridges, nostrils, upper fangs & glowing eyes
    const headPivot = makePivot('head_pivot', 0, 0.72, 0.62);
    const headScaleMesh = new THREE.Mesh(geo.headScale, scaleMat);
    headScaleMesh.castShadow = true;
    headPivot.add(headScaleMesh);
    headPivot.add(new THREE.Mesh(geo.headBelly, bellyMat));
    headPivot.add(new THREE.Mesh(geo.headHorn, hornMat));
    headPivot.add(new THREE.Mesh(geo.headEye, eyeMat));

    const fireMaw = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.28), mawGlowMat);
    fireMaw.position.set(0, 0.51, 0.84);
    fireMaw.name = 'fire_maw';
    headPivot.add(fireMaw);

    const jawPivot = makePivot('jaw_pivot', 0, 0.48, 0.46);
    jawPivot.add(new THREE.Mesh(geo.jawBelly, bellyMat));
    jawPivot.add(new THREE.Mesh(geo.jawHorn, hornMat));
    headPivot.add(jawPivot);
    bodyPivot.add(headPivot);

    // Sweeping articulated sinuous tail with ventral plates & halberd tail spade
    const tailPivot = makePivot('tail_pivot', 0, 0.56, -0.68);
    tailPivot.add(new THREE.Mesh(geo.tailScale, scaleMat));
    tailPivot.add(new THREE.Mesh(geo.tailBelly, bellyMat));
    tailPivot.add(new THREE.Mesh(geo.tailHorn, hornMat));
    bodyPivot.add(tailPivot);

    // Massive 2-segment scalloped multi-spar dragon wings (~4.3 units total span!)
    const wingPivotL = makePivot('wing_l', -0.34, 0.78, 0.16);
    const wingBoneL = new THREE.Mesh(geo.wingInnerBoneL, scaleMat);
    wingBoneL.castShadow = true;
    wingPivotL.add(wingBoneL);
    const wingMemMeshL = new THREE.Mesh(geo.wingInnerMemL, wingMat);
    wingMemMeshL.castShadow = true;
    wingPivotL.add(wingMemMeshL);
    wingPivotL.add(new THREE.Mesh(geo.wingInnerHornL, hornMat));

    const wingOuterL = makePivot('wing_outer_l', -1.02, 0.06, 0.05);
    wingOuterL.add(new THREE.Mesh(geo.wingOuterBoneL, scaleMat));
    const wingOuterMemMeshL = new THREE.Mesh(geo.wingOuterMemL, wingMat);
    wingOuterMemMeshL.castShadow = true;
    wingOuterL.add(wingOuterMemMeshL);
    wingPivotL.add(wingOuterL);
    bodyPivot.add(wingPivotL);

    const wingPivotR = makePivot('wing_r', 0.34, 0.78, 0.16);
    const wingBoneR = new THREE.Mesh(geo.wingInnerBoneR, scaleMat);
    wingBoneR.castShadow = true;
    wingPivotR.add(wingBoneR);
    const wingMemMeshR = new THREE.Mesh(geo.wingInnerMemR, wingMat);
    wingMemMeshR.castShadow = true;
    wingPivotR.add(wingMemMeshR);
    wingPivotR.add(new THREE.Mesh(geo.wingInnerHornR, hornMat));

    const wingOuterR = makePivot('wing_outer_r', 1.02, 0.06, 0.05);
    wingOuterR.add(new THREE.Mesh(geo.wingOuterBoneR, scaleMat));
    const wingOuterMemMeshR = new THREE.Mesh(geo.wingOuterMemR, wingMat);
    wingOuterMemMeshR.castShadow = true;
    wingOuterR.add(wingOuterMemMeshR);
    wingPivotR.add(wingOuterR);
    bodyPivot.add(wingPivotR);

    for (const [name, lx, lz] of [
      ['leg_fl', -0.28, 0.42],
      ['leg_fr', 0.28, 0.42],
      ['leg_bl', -0.28, -0.42],
      ['leg_br', 0.28, -0.42],
    ] as const) {
      const legPivot = makePivot(name, lx, 0.38, lz);
      legPivot.add(new THREE.Mesh(geo.legScale, scaleMat));
      legPivot.add(new THREE.Mesh(geo.legHorn, hornMat));
      bodyPivot.add(legPivot);
    }
  } else if (role === 'leviathan') {
    // Leviathan:
    // 1. `leviathan_silhouette`: Always-visible, sinuously undulating abyssal sea-monster shadow gliding just beneath the ocean surface film
    //    (multi-segment serpentine spine, horned predator skull, split reaper mandibles, sweeping scythe-fins, forked trident tail & glowing abyssal eyes)
    // 2. `leviathan_surfaced`: Colossal multi-segment Abyssal Sea-Serpent / Kraken-Dragon Dreadnought with articulated serpentine spine,
    //    3-way gaping mandibular maw, flared bioluminescent gill-frills, sweeping scythe-fins, and an integrated 3D High-Pressure Water Beam!
    shadowRadius = 5.2;
    auraRadius = 3.2;

    const silGroup = new THREE.Group();
    silGroup.name = 'leviathan_silhouette';
    const silCoreMat = new THREE.MeshBasicMaterial({
      color: 0x020611,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const silPenumbraMat = new THREE.MeshBasicMaterial({
      color: 0x07192e,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const silEyeMat = new THREE.MeshBasicMaterial({
      color: 0xff1e42,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    const silBioMat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });

    const addSilMesh = (geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.renderOrder = 16;
      parent.add(mesh);
      return mesh;
    };

    // Articulated Head & Thorax Silhouette (local y = 0.03..0.06 so it renders cleanly at the water surface)
    const silHeadPivot = makePivot('sil_head', 0, 0.04, 1.85);
    const silSkull = addSilMesh(new THREE.BoxGeometry(2.35, 0.08, 1.65), silCoreMat, silHeadPivot);
    silSkull.position.set(0, 0.01, 0.78);
    const silSnout = addSilMesh(new THREE.BoxGeometry(1.75, 0.08, 1.25), silCoreMat, silHeadPivot);
    silSnout.position.set(0, 0.01, 1.95);

    const silSkullAura = addSilMesh(new THREE.BoxGeometry(2.85, 0.06, 2.85), silPenumbraMat, silHeadPivot);
    silSkullAura.position.set(0, 0.0, 1.15);

    for (const side of [-1, 1]) {
      // Swept-back curved cranial horns
      const silHorn = addSilMesh(new THREE.ConeGeometry(0.28, 2.1, 6), silCoreMat, silHeadPivot);
      silHorn.rotation.x = -Math.PI / 2;
      silHorn.rotation.z = -side * 0.42;
      silHorn.scale.set(1.0, 1.0, 0.18);
      silHorn.position.set(side * 1.35, 0.01, 0.25);

      // Forward split reaper mandibles
      const silMandible = addSilMesh(new THREE.ConeGeometry(0.24, 1.65, 6), silCoreMat, silHeadPivot);
      silMandible.rotation.x = Math.PI / 2;
      silMandible.rotation.z = side * 0.28;
      silMandible.scale.set(1.0, 1.0, 0.18);
      silMandible.position.set(side * 0.78, 0.01, 2.55);

      // Glowing abyssal predator eyes & bioluminescent gill slits visible through the water
      for (let ei = 0; ei < 2; ei++) {
        const silEye = addSilMesh(new THREE.SphereGeometry(0.16 - ei * 0.03, 6, 4), silEyeMat, silHeadPivot);
        silEye.scale.set(0.85, 0.35, 1.35);
        silEye.position.set(side * (0.86 - ei * 0.14), 0.03, 1.55 - ei * 0.48);
      }
      const silGill = addSilMesh(new THREE.BoxGeometry(0.55, 0.02, 0.12), silBioMat, silHeadPivot);
      silGill.position.set(side * 1.18, 0.02, 0.45);
      silGill.rotation.y = -side * 0.45;
    }
    silGroup.add(silHeadPivot);

    // Segment 0: Blocky Anterior Thorax & Sweeping Scythe Pectoral Fins
    const silSeg0 = makePivot('sil_seg_0', 0, 0.04, 0.4);
    const silTorso0 = addSilMesh(new THREE.BoxGeometry(2.65, 0.08, 2.75), silCoreMat, silSeg0);
    const silTorso0Aura = addSilMesh(new THREE.BoxGeometry(3.25, 0.06, 3.25), silPenumbraMat, silSeg0);
    silTorso0Aura.position.set(0, -0.01, 0);

    for (const side of [-1, 1]) {
      const finPiv = makePivot(side < 0 ? 'sil_fin_l' : 'sil_fin_r', side * 1.2, 0.0, 0.35);
      const scythe = addSilMesh(new THREE.ConeGeometry(0.72, 3.1, 6), silCoreMat, finPiv);
      scythe.rotation.z = -side * (Math.PI / 2);
      scythe.rotation.y = -side * 0.42;
      scythe.scale.set(0.14, 1.0, 1.0);
      scythe.position.set(side * 1.35, 0, -0.35);
      const finVein = addSilMesh(new THREE.BoxGeometry(2.1, 0.02, 0.12), silBioMat, finPiv);
      finVein.position.set(side * 1.15, 0.02, -0.25);
      finVein.rotation.y = -side * 0.42;
      silSeg0.add(finPiv);
    }
    silGroup.add(silSeg0);

    // Chained Blocky Spine Segments (sil_seg_1 -> sil_seg_2 -> sil_tail)
    const silSeg1 = makePivot('sil_seg_1', 0, 0.04, -1.55);
    addSilMesh(new THREE.BoxGeometry(2.15, 0.08, 2.35), silCoreMat, silSeg1);
    for (const side of [-1, 1]) {
      const rearFin = addSilMesh(new THREE.ConeGeometry(0.45, 1.85, 5), silCoreMat, silSeg1);
      rearFin.rotation.z = -side * (Math.PI / 2);
      rearFin.rotation.y = -side * 0.48;
      rearFin.scale.set(0.14, 1.0, 1.0);
      rearFin.position.set(side * 1.35, 0, -0.2);
    }
    silGroup.add(silSeg1);

    const silSeg2 = makePivot('sil_seg_2', 0, 0.04, -3.35);
    addSilMesh(new THREE.BoxGeometry(1.55, 0.07, 2.15), silCoreMat, silSeg2);
    silGroup.add(silSeg2);

    const silTail = makePivot('sil_tail', 0, 0.04, -4.95);
    const silTailShaft = addSilMesh(new THREE.BoxGeometry(1.05, 0.07, 2.15), silCoreMat, silTail);
    silTailShaft.position.set(0, 0, -0.95);
    for (const side of [-1, 1]) {
      const fluke = addSilMesh(new THREE.ConeGeometry(0.38, 1.95, 5), silCoreMat, silTail);
      fluke.rotation.x = -Math.PI / 2;
      fluke.rotation.z = -side * 0.62;
      fluke.scale.set(1.0, 1.0, 0.12);
      fluke.position.set(side * 0.85, 0, -1.95);
    }
    silGroup.add(silTail);
    group.add(silGroup);

    // 2. SURFACED / BREACHING LEVIATHAN DREADNOUGHT (Tiered Blocky Main Body + Horns, Teeth, Eyes & Scythe-Fins)
    const surfGroup = new THREE.Group();
    surfGroup.name = 'leviathan_surfaced';
    const carapaceHex = s0 % 2 === 0 ? 0x090f1d : 0x0f172a;
    const chitinPlateHex = s0 % 2 === 0 ? 0x1e1b4b : 0x16243b;
    const crimsonWebHex = 0x881337;
    const underbellyHex = 0x31102f;
    const carapaceMat = mat(carapaceHex, 0.30, 0.35);
    const chitinMat = mat(chitinPlateHex, 0.42, 0.22);
    const crimsonWebMat = mat(crimsonWebHex, 0.45, 0.15, 0x4c0519, 0.45);
    const bellyMat = mat(underbellyHex, 0.58, 0.10);
    const mawInMat = mat(0x082f49, 0.35, 0.15, 0x0284c7, 0.85);
    const hornBoneMat = mat(0xe7e5e4, 0.35, 0.18);
    const toothMat = mat(0xf8fafc, 0.22, 0.15);
    const eyeGlowMat = mat(0xff1e42, 0.15, 0.1, 0xff0033, 2.3);
    const biolumVeinMat = mat(0x00f5d4, 0.22, 0.12, 0x00bbf9, 1.65);
    const biolumCrimsonMat = mat(0xf43f5e, 0.25, 0.1, 0xe11d48, 1.45);
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xe0fbfc,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
    });
    const foamOuterMat = new THREE.MeshBasicMaterial({
      color: 0x90e0ef,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });

    // Tiered Blocky Dreadnought Thorax (stepped voxel/block segments instead of a cylinder)
    const chestBlock = new THREE.Mesh(new THREE.BoxGeometry(2.58, 1.48, 1.85), carapaceMat);
    chestBlock.position.set(0, 1.06, 1.08);
    chestBlock.castShadow = true;
    chestBlock.receiveShadow = true;
    surfGroup.add(chestBlock);

    const midThoraxBlock = new THREE.Mesh(new THREE.BoxGeometry(2.38, 1.38, 1.65), carapaceMat);
    midThoraxBlock.position.set(0, 1.00, -0.32);
    midThoraxBlock.castShadow = true;
    midThoraxBlock.receiveShadow = true;
    surfGroup.add(midThoraxBlock);

    const rearThoraxBlock = new THREE.Mesh(new THREE.BoxGeometry(2.10, 1.24, 1.35), carapaceMat);
    rearThoraxBlock.position.set(0, 0.92, -1.42);
    rearThoraxBlock.castShadow = true;
    rearThoraxBlock.receiveShadow = true;
    surfGroup.add(rearThoraxBlock);

    // Lateral Beveled Shoulder & Flank Armor Blocks
    for (const side of [-1, 1]) {
      const shoulderBlock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.02, 1.55), chitinMat);
      shoulderBlock.position.set(side * 1.38, 1.04, 1.02);
      shoulderBlock.castShadow = true;
      surfGroup.add(shoulderBlock);

      const flankBlock = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.92, 1.42), chitinMat);
      flankBlock.position.set(side * 1.26, 0.96, -0.35);
      flankBlock.castShadow = true;
      surfGroup.add(flankBlock);
    }

    // Stepped Blocky Armored Underbelly Keel
    const bellyBlockUpper = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.42, 3.65), bellyMat);
    bellyBlockUpper.position.set(0, 0.44, 0.22);
    surfGroup.add(bellyBlockUpper);

    const bellyBlockLower = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.26, 3.25), bellyMat);
    bellyBlockLower.position.set(0, 0.22, 0.22);
    surfGroup.add(bellyBlockLower);

    // Overlapping Blocky Chitinous Dorsal Carapace Slabs & Glowing Cyan/Crimson Abyssal Conduits
    for (let pi = 0; pi < 5; pi++) {
      const pScale = 1.0 - pi * 0.08;
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(2.36 * pScale, 0.36, 0.78),
        chitinMat,
      );
      plate.rotation.x = -0.14;
      plate.position.set(0, 1.72 - pi * 0.08, 1.65 - pi * 0.82);
      plate.castShadow = true;
      surfGroup.add(plate);

      const upperRidgeBlock = new THREE.Mesh(
        new THREE.BoxGeometry(1.42 * pScale, 0.24, 0.62),
        carapaceMat,
      );
      upperRidgeBlock.rotation.x = -0.14;
      upperRidgeBlock.position.set(0, 1.92 - pi * 0.08, 1.62 - pi * 0.82);
      surfGroup.add(upperRidgeBlock);

      for (const side of [-1, 1]) {
        const gillVein = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.46 * pScale, 0.24),
          pi % 2 === 0 ? biolumVeinMat : biolumCrimsonMat,
        );
        gillVein.position.set(side * (1.32 * pScale), 1.16 - pi * 0.06, 1.55 - pi * 0.82);
        surfGroup.add(gillVein);
      }

      // Towering curved dorsal bone-spines & crimson fin webbing along the anterior back
      const spineH = 1.65 - pi * 0.14;
      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.20, spineH, 5), hornBoneMat);
      spine.position.set(0, 2.28 - pi * 0.11, 1.50 - pi * 0.82);
      spine.rotation.x = -0.44;
      surfGroup.add(spine);

      const web = new THREE.Mesh(new THREE.BoxGeometry(0.10, spineH * 0.85, 0.64), crimsonWebMat);
      web.position.set(0, 2.08 - pi * 0.11, 1.25 - pi * 0.82);
      web.rotation.x = -0.38;
      surfGroup.add(web);
    }

    // Articulated Wing-Like Scythe Pectoral Fins (`wing_l`, `wing_r`) & Pelvic Hydrofoils (`wing_outer_l`, `wing_outer_r`)
    for (const side of [-1, 1]) {
      const finPivot = makePivot(side < 0 ? 'wing_l' : 'wing_r', side * 1.28, 0.72, 0.78);
      const finArm = new THREE.Mesh(new THREE.ConeGeometry(0.52, 3.15, 6), carapaceMat);
      finArm.rotation.z = -side * (Math.PI / 2 - 0.15);
      finArm.rotation.y = -side * 0.38;
      finArm.scale.set(0.32, 1.0, 1.0);
      finArm.position.set(side * 1.35, -0.12, -0.35);
      finPivot.add(finArm);

      const finMembrane = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.10, 1.15), crimsonWebMat);
      finMembrane.position.set(side * 1.32, -0.16, -0.68);
      finMembrane.rotation.y = -side * 0.42;
      finMembrane.rotation.z = -side * 0.15;
      finPivot.add(finMembrane);

      const finVein = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.12, 0.14), biolumVeinMat);
      finVein.position.set(side * 1.25, -0.11, -0.28);
      finVein.rotation.y = -side * 0.38;
      finPivot.add(finVein);

      const finClaw = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.95, 5), hornBoneMat);
      finClaw.position.set(side * 2.75, -0.28, -0.82);
      finClaw.rotation.z = side * 1.28;
      finClaw.rotation.x = -0.45;
      finPivot.add(finClaw);
      surfGroup.add(finPivot);

      const pelvicPivot = makePivot(side < 0 ? 'wing_outer_l' : 'wing_outer_r', side * 1.08, 0.56, -1.45);
      const pelvicBlade = new THREE.Mesh(new THREE.ConeGeometry(0.38, 2.05, 5), chitinMat);
      pelvicBlade.rotation.z = -side * (Math.PI / 2 - 0.18);
      pelvicBlade.rotation.y = -side * 0.44;
      pelvicBlade.scale.set(0.28, 1.0, 1.0);
      pelvicBlade.position.set(side * 0.88, -0.1, -0.25);
      pelvicPivot.add(pelvicBlade);
      surfGroup.add(pelvicPivot);
    }

    // Articulated Posterior Blocky Spine & Trident Tail (`tail_pivot` -> `leviathan_tail_mid` -> `tail_fluke`)
    const tailPivot = makePivot('tail_pivot', 0, 0.86, -1.65);
    const abdBlockFront = new THREE.Mesh(new THREE.BoxGeometry(1.82, 1.12, 1.28), carapaceMat);
    abdBlockFront.position.set(0, 0.02, -0.56);
    abdBlockFront.castShadow = true;
    tailPivot.add(abdBlockFront);

    const abdBlockRear = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.96, 1.25), carapaceMat);
    abdBlockRear.position.set(0, -0.04, -1.58);
    abdBlockRear.castShadow = true;
    tailPivot.add(abdBlockRear);

    const abdPlateTop = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.26, 2.15), chitinMat);
    abdPlateTop.position.set(0, 0.56, -1.06);
    tailPivot.add(abdPlateTop);

    const abdBelly = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.30, 2.15), bellyMat);
    abdBelly.position.set(0, -0.48, -1.06);
    tailPivot.add(abdBelly);

    for (let ti = 0; ti < 2; ti++) {
      const tSpine = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.05 - ti * 0.18, 5), hornBoneMat);
      tSpine.position.set(0, 0.98 - ti * 0.14, -0.65 - ti * 0.95);
      tSpine.rotation.x = -0.46;
      tailPivot.add(tSpine);
    }

    const tailMidPivot = makePivot('leviathan_tail_mid', 0, -0.06, -2.15);
    const tailBlockFront = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.78, 1.22), chitinMat);
    tailBlockFront.position.set(0, 0, -0.54);
    tailBlockFront.castShadow = true;
    tailMidPivot.add(tailBlockFront);

    const tailBlockRear = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.58, 1.22), carapaceMat);
    tailBlockRear.position.set(0, -0.02, -1.56);
    tailBlockRear.castShadow = true;
    tailMidPivot.add(tailBlockRear);

    // Forked crimson & bone trident tail-fluke blades
    for (const side of [-1, 1]) {
      const flukeBlade = new THREE.Mesh(new THREE.ConeGeometry(0.44, 2.35, 5), crimsonWebMat);
      flukeBlade.position.set(side * 0.96, 0.06, -2.15);
      flukeBlade.rotation.x = -Math.PI * 0.5;
      flukeBlade.rotation.z = -side * 0.54;
      flukeBlade.scale.set(1.0, 1.0, 0.28);
      tailMidPivot.add(flukeBlade);

      const flukeSpike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.15, 5), hornBoneMat);
      flukeSpike.position.set(side * 1.65, 0.06, -2.75);
      flukeSpike.rotation.x = -Math.PI * 0.5;
      flukeSpike.rotation.z = -side * 0.48;
      tailMidPivot.add(flukeSpike);
    }
    const centerFlukeSpike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.45, 5), biolumVeinMat);
    centerFlukeSpike.position.set(0, 0.06, -2.65);
    centerFlukeSpike.rotation.x = -Math.PI * 0.5;
    tailMidPivot.add(centerFlukeSpike);

    tailPivot.add(tailMidPivot);
    surfGroup.add(tailPivot);

    // 3. TERRIFYING HORNED ABYSSAL PREDATOR HEAD, 3-WAY GAPING MAW & INTEGRATED 3D WATER BEAM (`head_pivot`)
    const headPivot = makePivot('head_pivot', 0, 1.18, 1.95);
    // Stepped blocky predator cranium & snout blocks
    const upperSkull = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.94, 1.55), carapaceMat);
    upperSkull.position.set(0, 0.48, 0.72);
    upperSkull.castShadow = true;
    headPivot.add(upperSkull);

    const midSnoutBlock = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.80, 1.22), chitinMat);
    midSnoutBlock.position.set(0, 0.42, 1.82);
    midSnoutBlock.castShadow = true;
    headPivot.add(midSnoutBlock);

    const snoutCrest = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.64, 0.92), carapaceMat);
    snoutCrest.position.set(0, 0.34, 2.58);
    snoutCrest.castShadow = true;
    headPivot.add(snoutCrest);

    const browArmorBlock = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.26, 1.45), chitinMat);
    browArmorBlock.position.set(0, 0.92, 0.98);
    headPivot.add(browArmorBlock);

    // Nasal horn spike & glowing forehead abyssal crest
    const nasalHorn = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.98, 5), hornBoneMat);
    nasalHorn.position.set(0, 0.96, 2.65);
    nasalHorn.rotation.x = 0.38;
    headPivot.add(nasalHorn);

    const browGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), biolumVeinMat);
    browGem.scale.set(0.75, 0.55, 1.65);
    browGem.position.set(0, 0.98, 1.45);
    headPivot.add(browGem);

    // Swept-back demonic cranial horns, flared gill-frill fans & hinged lateral reaper mandibles (`mandible_l`, `mandible_r`)
    for (const side of [-1, 1]) {
      const mainHorn = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.35, 6), hornBoneMat);
      mainHorn.position.set(side * 1.28, 1.18, 0.25);
      mainHorn.rotation.x = -1.08;
      mainHorn.rotation.z = -side * 0.44;
      headPivot.add(mainHorn);

      const cheekSpike = new THREE.Mesh(new THREE.ConeGeometry(0.20, 1.48, 5), hornBoneMat);
      cheekSpike.position.set(side * 1.48, 0.48, 0.55);
      cheekSpike.rotation.x = -0.88;
      cheekSpike.rotation.z = -side * 0.68;
      headPivot.add(cheekSpike);

      // Bioluminescent abyssal frill fan
      const frillFan = new THREE.Mesh(new THREE.ConeGeometry(0.68, 1.55, 5), crimsonWebMat);
      frillFan.position.set(side * 1.55, 0.62, 0.15);
      frillFan.rotation.z = -side * 1.12;
      frillFan.rotation.x = -0.52;
      frillFan.scale.set(0.25, 1.0, 1.0);
      headPivot.add(frillFan);

      // Hinged Lateral Reaper Mandible (`mandible_l` / `mandible_r`) that flares wide open during Water Beam!
      const mandPivot = makePivot(side < 0 ? 'mandible_l' : 'mandible_r', side * 1.12, 0.06, 0.85);
      const mandibleArm = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 1.68), chitinMat);
      mandibleArm.position.set(side * 0.22, 0, 0.85);
      mandibleArm.rotation.y = side * 0.18;
      mandPivot.add(mandibleArm);

      const mandiblePincer = new THREE.Mesh(new THREE.ConeGeometry(0.20, 1.05, 5), hornBoneMat);
      mandiblePincer.position.set(side * 0.12, 0, 1.95);
      mandiblePincer.rotation.x = Math.PI * 0.5;
      mandiblePincer.rotation.z = side * 0.48;
      mandPivot.add(mandiblePincer);

      for (let mf = 0; mf < 3; mf++) {
        const inFang = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.36, 4), toothMat);
        inFang.rotation.z = side * (Math.PI / 2);
        inFang.position.set(side * 0.05, 0, 0.65 + mf * 0.42);
        mandPivot.add(inFang);
      }
      headPivot.add(mandPivot);

      // 3 blazing crimson predator eyes per side
      for (let ei = 0; ei < 3; ei++) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15 - ei * 0.02, 6, 5), eyeGlowMat);
        eye.scale.set(0.75, 0.85, 1.35);
        eye.position.set(side * (1.18 - ei * 0.08), 0.64 + (ei === 1 ? 0.12 : 0), 1.92 - ei * 0.48);
        headPivot.add(eye);
      }
    }

    // Glowing pressurized Hydro-Core inside the oral cavity (`fire_maw`)
    const mawCavity = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.72, 1.65), mawInMat);
    mawCavity.name = 'fire_maw';
    mawCavity.position.set(0, 0.12, 1.15);
    headPivot.add(mawCavity);

    // Upper jagged fangs: curved double-row of bone-fangs
    for (let ti = -5; ti <= 5; ti++) {
      const isCornerTusk = Math.abs(ti) === 5 || Math.abs(ti) === 3;
      const fangLen = isCornerTusk ? 0.72 : 0.48;
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.11, fangLen, 5), toothMat);
      fang.rotation.x = Math.PI;
      fang.position.set(ti * 0.19, -0.04, 2.48 - Math.abs(ti) * 0.15);
      headPivot.add(fang);
    }

    // Hinged spiked blocky lower jaw (`jaw_pivot`) that drops 50+ degrees open when firing the Water Beam!
    const jawPivot = makePivot('jaw_pivot', 0, 0.02, 0.32);
    const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.48, 1.48), carapaceMat);
    lowerJaw.position.set(0, -0.28, 0.82);
    jawPivot.add(lowerJaw);

    const chinTip = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.42, 1.18), chitinMat);
    chinTip.position.set(0, -0.26, 1.98);
    jawPivot.add(chinTip);

    for (let bi = -1; bi <= 1; bi++) {
      const chinSpike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.68, 5), hornBoneMat);
      chinSpike.rotation.x = Math.PI * 0.78;
      chinSpike.position.set(bi * 0.48, -0.58, 2.22 - Math.abs(bi) * 0.2);
      jawPivot.add(chinSpike);
    }

    for (let ti = -5; ti <= 5; ti++) {
      const isTusk = Math.abs(ti) === 4;
      const fang = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, isTusk ? 0.68 : 0.46, 5),
        toothMat,
      );
      fang.position.set(ti * 0.18, 0.10, 2.35 - Math.abs(ti) * 0.14);
      jawPivot.add(fang);
    }
    headPivot.add(jawPivot);

    // 4. INTEGRATED 3D HIGH-PRESSURE WATER BEAM ASSEMBLY (`leviathan_beam_group`)
    // Attached to the gaping maw so when `leviathanBeamTimer > 0`, a roaring multi-layered hydro-cannon beam
    // with spinning helical shock-rings & impact geyser blasts directly from the Leviathan's open mouth!
    const beamGroup = new THREE.Group();
    beamGroup.name = 'leviathan_beam_group';
    beamGroup.position.set(0, 0.06, 2.15);
    beamGroup.visible = false;

    const beamCoreMat = new THREE.MeshBasicMaterial({
      color: 0xe0fbfc,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
    });
    const beamOuterMat = new THREE.MeshBasicMaterial({
      color: 0x00bbf9,
      transparent: true,
      opacity: 0.68,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beamSpiralMat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Muzzle charge sphere at the jaws
    const muzzleOrb = new THREE.Mesh(new THREE.SphereGeometry(0.78, 10, 8), beamCoreMat);
    muzzleOrb.name = 'beam_muzzle';
    beamGroup.add(muzzleOrb);

    // Inner high-pressure white-cyan hydro-laser core (unit length along +Z, scaled dynamically to target distance)
    const beamShaft = new THREE.Group();
    beamShaft.name = 'beam_shaft';
    const coreCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 1.0, 10, 1, true), beamCoreMat);
    coreCyl.rotation.x = Math.PI / 2;
    coreCyl.position.set(0, 0, 0.5);
    beamShaft.add(coreCyl);

    const outerCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.54, 1.0, 12, 1, true), beamOuterMat);
    outerCyl.rotation.x = Math.PI / 2;
    outerCyl.position.set(0, 0, 0.5);
    beamShaft.add(outerCyl);

    for (let ri = 0; ri < 5; ri++) {
      const shockRing = new THREE.Mesh(new THREE.RingGeometry(0.52, 1.15, 12), beamSpiralMat);
      shockRing.position.set(0, 0, 0.15 + ri * 0.18);
      beamShaft.add(shockRing);
    }
    beamGroup.add(beamShaft);

    // Impact hydro-geyser dome at the end of the beam
    const impactGeyser = new THREE.Group();
    impactGeyser.name = 'beam_impact';
    const geyserCone = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 0.75, 2.2, 12, 1, true), beamOuterMat);
    geyserCone.position.set(0, 0.9, 0);
    impactGeyser.add(geyserCone);
    const geyserRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 2.4, 16), beamCoreMat);
    geyserRing.rotation.x = -Math.PI / 2;
    geyserRing.position.set(0, 0.08, 0);
    impactGeyser.add(geyserRing);
    beamGroup.add(impactGeyser);

    headPivot.add(beamGroup);
    surfGroup.add(headPivot);

    // Churning white seafoam breach rings around the colossal Leviathan
    const splashRing = new THREE.Mesh(new THREE.RingGeometry(2.8, 4.2, 28), foamMat);
    splashRing.name = 'leviathan_splash_inner';
    splashRing.rotation.x = -Math.PI / 2;
    splashRing.position.set(0, 0.08, 0.2);
    surfGroup.add(splashRing);

    const outerSplashRing = new THREE.Mesh(new THREE.RingGeometry(4.3, 5.5, 24), foamOuterMat);
    outerSplashRing.name = 'leviathan_splash_outer';
    outerSplashRing.rotation.x = -Math.PI / 2;
    outerSplashRing.position.set(0, 0.06, 0.2);
    surfGroup.add(outerSplashRing);

    bodyPivot.add(surfGroup);
  } else {
    // Unicorn: radiant ivory steed, golden spiral horn, animated legs & pastel mane
    shadowRadius = 0.68;
    auraRadius = 0.38;
    const coatHex = s0 % 3 === 0 ? 0xfafafa : s0 % 3 === 1 ? 0xf3e8ff : 0xe0f2fe;
    const bodyMat = mat(coatHex, 0.45, 0.12);
    const hoofMat = mat(0xf5b742, 0.3, 0.7);
    const hornMat = mat(0xffd166, 0.2, 0.6, 0xfbbf24, 0.9);
    const maneColors = [0xf472b6, 0x72efdd, 0xc084fc];

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.52), bodyMat);
    body.position.set(0, 0.36, -0.02);
    body.castShadow = true;
    bodyPivot.add(body);

    const headPivot = makePivot('head_pivot', 0, 0.44, 0.2);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.14), bodyMat);
    neck.position.set(0, 0.1, 0.04);
    neck.rotation.x = 0.35;
    neck.castShadow = true;
    headPivot.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.26), bodyMat);
    head.position.set(0, 0.22, 0.14);
    head.castShadow = true;
    headPivot.add(head);

    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.28, 6), hornMat);
    horn.rotation.x = 0.42;
    horn.position.set(0, 0.38, 0.24);
    headPivot.add(horn);

    for (let mi = 0; mi < 3; mi++) {
      const mMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, 0.11, 0.085),
        mat(maneColors[mi], 0.48, 0.1, maneColors[mi], 0.35),
      );
      mMesh.position.set(0, 0.25 - mi * 0.08, 0.02 - mi * 0.03);
      headPivot.add(mMesh);
    }

    for (const ex of [-0.08, 0.08]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.075, 4), bodyMat);
      ear.position.set(ex * 0.72, 0.32, 0.07);
      headPivot.add(ear);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.028, 0.03), mat(0x38bdf8, 0.25, 0.1, 0x38bdf8, 0.65));
      eye.position.set(ex, 0.23, 0.18);
      headPivot.add(eye);
    }
    bodyPivot.add(headPivot);

    const tailPivot = makePivot('tail_pivot', 0, 0.38, -0.27);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.25, 0.11),
      mat(maneColors[s1 % maneColors.length], 0.48, 0.1, maneColors[s1 % maneColors.length], 0.3),
    );
    tail.position.set(0, -0.06, -0.06);
    tail.rotation.x = 0.5;
    tailPivot.add(tail);
    bodyPivot.add(tailPivot);

    for (const [name, lx, lz] of [
      ['leg_fl', -0.085, 0.17],
      ['leg_fr', 0.085, 0.17],
      ['leg_bl', -0.085, -0.21],
      ['leg_br', 0.085, -0.21],
    ] as const) {
      const legPivot = makePivot(name, lx, 0.25, lz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.22, 0.064), bodyMat);
      leg.position.set(0, -0.11, 0);
      legPivot.add(leg);
      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.04, 0.068), hoofMat);
      hoof.position.set(0, -0.22, 0);
      legPivot.add(hoof);
      group.add(legPivot);
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
  group.userData.appearanceSeed = seed;
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
    role === 'unicorn' ||
    role === 'leviathan'
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

  // 5. Held Tool / Racial & Epoch-Scaled Weaponry Group / Child's Toy Stick
  if (!isChild || s2 % 3 === 0) {
    const toolGroup = new THREE.Group();
    toolGroup.name = 'held_tool';
    toolGroup.position.set(0.14 * scale * widthMult, 0.25 * scale, 0.08 * scale);
    toolGroup.rotation.x = 0.35;

    const woodShaftMat = new THREE.MeshStandardMaterial({ color: 0x7f4f24, roughness: 0.8 });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.28,
      metalness: 0.78,
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.38,
      metalness: 0.65,
    });
    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf5b742,
      roughness: 0.28,
      metalness: 0.72,
    });

    if (isChild) {
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015 * scale, 0.018 * scale, 0.17 * scale, 5),
        woodShaftMat,
      );
      stick.position.y = 0.07 * scale;
      toolGroup.add(stick);
      const twig = new THREE.Mesh(new THREE.BoxGeometry(0.03 * scale, 0.03 * scale, 0.02 * scale), sashMat);
      twig.position.set(0.015 * scale, 0.14 * scale, 0);
      toolGroup.add(twig);
    } else if (resolvedSpecies === 'elf') {
      const crystalColor = epochLevel >= 5 ? 0x56cfe1 : 0xc084fc;
      const crystalMat = new THREE.MeshStandardMaterial({
        color: crystalColor,
        emissive: crystalColor,
        emissiveIntensity: 0.75,
        roughness: 0.15,
      });
      if (epochLevel <= 1) {
        // Sylvan curved longbow + arrow
        const bowArc = new THREE.Mesh(
          new THREE.TorusGeometry(0.15 * scale, 0.014 * scale, 5, 10, Math.PI * 0.95),
          woodShaftMat,
        );
        bowArc.rotation.z = -Math.PI * 0.48;
        bowArc.position.set(0, 0.06 * scale, 0.04 * scale);
        toolGroup.add(bowArc);
        const arrowShaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008 * scale, 0.008 * scale, 0.24 * scale, 4),
          goldTrimMat,
        );
        arrowShaft.rotation.x = Math.PI / 2;
        arrowShaft.position.set(0, 0.06 * scale, 0.06 * scale);
        toolGroup.add(arrowShaft);
      } else if (epochLevel <= 3) {
        // Ornate Gold-Trimmed Crystal Runestaff
        const staff = new THREE.Mesh(
          new THREE.CylinderGeometry(0.016 * scale, 0.014 * scale, 0.38 * scale, 6),
          goldTrimMat,
        );
        staff.position.y = 0.12 * scale;
        toolGroup.add(staff);
        const cradle = new THREE.Mesh(
          new THREE.TorusGeometry(0.042 * scale, 0.01 * scale, 5, 8, Math.PI * 1.3),
          goldTrimMat,
        );
        cradle.rotation.z = -Math.PI * 0.15;
        cradle.position.set(0, 0.33 * scale, 0);
        toolGroup.add(cradle);
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.036 * scale, 0), crystalMat);
        gem.position.set(0, 0.34 * scale, 0);
        toolGroup.add(gem);
      } else {
        // Astral Pulse-Lance / Crystal Carbine
        const receiver = new THREE.Mesh(
          new THREE.BoxGeometry(0.042 * scale, 0.06 * scale, 0.24 * scale),
          goldTrimMat,
        );
        receiver.position.set(0, 0.05 * scale, 0.08 * scale);
        toolGroup.add(receiver);
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015 * scale, 0.018 * scale, 0.24 * scale, 6),
          crystalMat,
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.065 * scale, 0.23 * scale);
        toolGroup.add(barrel);
        const prismFin = new THREE.Mesh(
          new THREE.BoxGeometry(0.018 * scale, 0.09 * scale, 0.07 * scale),
          crystalMat,
        );
        prismFin.position.set(0, 0.04 * scale, 0.04 * scale);
        toolGroup.add(prismFin);
      }
    } else if (resolvedSpecies === 'orc') {
      const furnaceMat = new THREE.MeshStandardMaterial({
        color: 0xff4500,
        emissive: 0xd62828,
        emissiveIntensity: 0.75,
        roughness: 0.25,
      });
      if (epochLevel <= 1) {
        // Jagged Stone-Spiked War Club
        const haft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02 * scale, 0.015 * scale, 0.28 * scale, 6),
          woodShaftMat,
        );
        haft.position.y = 0.09 * scale;
        toolGroup.add(haft);
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.09 * scale, 0.1 * scale, 0.075 * scale),
          darkMetalMat,
        );
        head.position.set(0, 0.21 * scale, 0.02 * scale);
        toolGroup.add(head);
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.026 * scale, 0.07 * scale, 4), steelMat);
        spike.rotation.x = Math.PI / 2;
        spike.position.set(0, 0.22 * scale, 0.075 * scale);
        toolGroup.add(spike);
      } else if (epochLevel <= 3) {
        // Massive Double-Headed Iron Battleaxe
        const haft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018 * scale, 0.018 * scale, 0.34 * scale, 6),
          darkMetalMat,
        );
        haft.position.y = 0.11 * scale;
        toolGroup.add(haft);
        const boss = new THREE.Mesh(new THREE.BoxGeometry(0.045 * scale, 0.07 * scale, 0.05 * scale), steelMat);
        boss.position.set(0, 0.24 * scale, 0);
        toolGroup.add(boss);
        for (const side of [-1, 1]) {
          const blade = new THREE.Mesh(
            new THREE.BoxGeometry(0.024 * scale, 0.13 * scale, 0.09 * scale),
            steelMat,
          );
          blade.position.set(0, 0.24 * scale, side * 0.062 * scale);
          blade.rotation.x = side * 0.22;
          toolGroup.add(blade);
        }
      } else {
        // Magma Furnace Chain-Cleaver
        const engineBox = new THREE.Mesh(
          new THREE.BoxGeometry(0.065 * scale, 0.11 * scale, 0.12 * scale),
          darkMetalMat,
        );
        engineBox.position.set(0, 0.08 * scale, 0.02 * scale);
        toolGroup.add(engineBox);
        const chainBar = new THREE.Mesh(
          new THREE.BoxGeometry(0.032 * scale, 0.25 * scale, 0.08 * scale),
          furnaceMat,
        );
        chainBar.position.set(0, 0.22 * scale, 0.06 * scale);
        chainBar.rotation.x = 0.3;
        toolGroup.add(chainBar);
      }
    } else {
      // Humans: Spear -> Longsword -> Bayonet Musket -> Assault Rifle -> Space Plasma Carbine
      if (epochLevel <= 1) {
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014 * scale, 0.015 * scale, 0.36 * scale, 5),
          woodShaftMat,
        );
        shaft.position.y = 0.12 * scale;
        toolGroup.add(shaft);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03 * scale, 0.1 * scale, 4), goldTrimMat);
        tip.position.y = 0.32 * scale;
        toolGroup.add(tip);
      } else if (epochLevel === 2) {
        const grip = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014 * scale, 0.014 * scale, 0.08 * scale, 5),
          woodShaftMat,
        );
        grip.position.y = 0.02 * scale;
        toolGroup.add(grip);
        const guard = new THREE.Mesh(
          new THREE.BoxGeometry(0.09 * scale, 0.02 * scale, 0.028 * scale),
          goldTrimMat,
        );
        guard.position.y = 0.07 * scale;
        toolGroup.add(guard);
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.03 * scale, 0.24 * scale, 0.015 * scale),
          steelMat,
        );
        blade.position.y = 0.19 * scale;
        toolGroup.add(blade);
      } else if (epochLevel === 3) {
        // Bayonet Musket
        const stock = new THREE.Mesh(
          new THREE.BoxGeometry(0.034 * scale, 0.052 * scale, 0.24 * scale),
          woodShaftMat,
        );
        stock.position.set(0, 0.04 * scale, 0.06 * scale);
        toolGroup.add(stock);
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012 * scale, 0.014 * scale, 0.24 * scale, 6),
          darkMetalMat,
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.065 * scale, 0.2 * scale);
        toolGroup.add(barrel);
        const bayonet = new THREE.Mesh(new THREE.ConeGeometry(0.012 * scale, 0.08 * scale, 4), steelMat);
        bayonet.rotation.x = Math.PI / 2;
        bayonet.position.set(0, 0.048 * scale, 0.31 * scale);
        toolGroup.add(bayonet);
      } else if (epochLevel <= 5) {
        // Modern Assault Rifle with optic & magazine
        const receiver = new THREE.Mesh(
          new THREE.BoxGeometry(0.038 * scale, 0.06 * scale, 0.22 * scale),
          darkMetalMat,
        );
        receiver.position.set(0, 0.05 * scale, 0.06 * scale);
        toolGroup.add(receiver);
        const mag = new THREE.Mesh(
          new THREE.BoxGeometry(0.026 * scale, 0.075 * scale, 0.042 * scale),
          darkMetalMat,
        );
        mag.position.set(0, -0.01 * scale, 0.08 * scale);
        mag.rotation.x = 0.25;
        toolGroup.add(mag);
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012 * scale, 0.012 * scale, 0.16 * scale, 6),
          steelMat,
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.06 * scale, 0.22 * scale);
        toolGroup.add(barrel);
        const optic = new THREE.Mesh(
          new THREE.BoxGeometry(0.024 * scale, 0.026 * scale, 0.07 * scale),
          steelMat,
        );
        optic.position.set(0, 0.095 * scale, 0.06 * scale);
        toolGroup.add(optic);
      } else {
        // Space Plasma Pulse Carbine
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(0.044 * scale, 0.068 * scale, 0.24 * scale),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.24, metalness: 0.72 }),
        );
        body.position.set(0, 0.05 * scale, 0.07 * scale);
        toolGroup.add(body);
        const plasmaCoil = new THREE.Mesh(
          new THREE.BoxGeometry(0.03 * scale, 0.032 * scale, 0.2 * scale),
          new THREE.MeshBasicMaterial({ color: 0x56cfe1 }),
        );
        plasmaCoil.position.set(0, 0.072 * scale, 0.16 * scale);
        toolGroup.add(plasmaCoil);
      }
    }
    group.add(toolGroup);
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

  // 8. Orc Battlewill Avatar Extension (hidden unless battlewillActive > 0; follows its caster physically)
  if (!isChild && resolvedSpecies === 'orc' && faction === 'civilization') {
    const bwGroup = new THREE.Group();
    bwGroup.name = 'battlewill_avatar';
    bwGroup.visible = false;
    bwGroup.position.set(0, 0.28, -0.18);

    const bwAuraMat = new THREE.MeshStandardMaterial({
      color: 0xff3b30,
      emissive: 0xff5400,
      emissiveIntensity: 0.92,
      roughness: 0.32,
      metalness: 0.28,
      transparent: true,
      opacity: 0.75,
    });
    const bwArmorMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xef233c,
      emissiveIntensity: 0.5,
      roughness: 0.28,
      metalness: 0.6,
      transparent: true,
      opacity: 0.86,
    });
    const bwCoreMat = new THREE.MeshStandardMaterial({
      color: 0xffbe0b,
      emissive: 0xff8800,
      emissiveIntensity: 1.0,
      roughness: 0.22,
      metalness: 0.45,
      transparent: true,
      opacity: 0.9,
    });

    const bwTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.24, 0.78, 6), bwAuraMat);
    bwTorso.position.set(0, 0.92, 0);
    bwGroup.add(bwTorso);

    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.42, 0.4), bwArmorMat);
    chestPlate.position.set(0, 1.06, 0.02);
    bwGroup.add(chestPlate);

    const bwCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.19, 0), bwCoreMat);
    bwCore.position.set(0, 1.02, 0.19);
    bwGroup.add(bwCore);

    // Warlord Helm & Brow
    const bwHead = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), bwArmorMat);
    bwHead.position.set(0, 1.54, 0.04);
    bwGroup.add(bwHead);
    const helmVisor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.08), bwCoreMat);
    helmVisor.position.set(0, 1.54, 0.2);
    bwGroup.add(helmVisor);

    // Back Battlewill Flame Halo / Spikes
    const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.045, 5, 14, Math.PI * 1.45), bwCoreMat);
    haloRing.rotation.z = -Math.PI * 0.225;
    haloRing.position.set(0, 1.25, -0.22);
    bwGroup.add(haloRing);

    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.34, 5), bwCoreMat);
      horn.position.set(side * 0.21, 1.76, 0.04);
      horn.rotation.z = -side * 0.48;
      bwGroup.add(horn);

      const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.42), bwArmorMat);
      pauldron.position.set(side * 0.44, 1.26, 0);
      pauldron.rotation.z = -side * 0.3;
      bwGroup.add(pauldron);

      const pauldronSpike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 4), bwCoreMat);
      pauldronSpike.position.set(side * 0.54, 1.42, 0);
      pauldronSpike.rotation.z = -side * 0.45;
      bwGroup.add(pauldronSpike);
    }

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.56, 0.21), bwAuraMat);
    leftArm.position.set(-0.48, 0.88, 0.08);
    bwGroup.add(leftArm);

    const swordPivot = new THREE.Group();
    swordPivot.name = 'battlewill_sword_pivot';
    swordPivot.position.set(0.48, 1.12, 0.08);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.5, 0.21), bwAuraMat);
    rightArm.position.set(0, -0.18, 0.12);
    rightArm.rotation.x = 0.65;
    swordPivot.add(rightArm);

    const swordGuard = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.1, 0.12), bwArmorMat);
    swordGuard.position.set(0, -0.04, 0.38);
    swordPivot.add(swordGuard);

    // Tapered beveled greatsword with glowing spine & pointed tip
    const swordBlade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.32, 0.07), bwArmorMat);
    swordBlade.position.set(0, 0.62, 0.48);
    swordBlade.rotation.x = 0.25;
    swordPivot.add(swordBlade);

    const swordCore = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.24, 0.09), bwCoreMat);
    swordCore.position.set(0, 0.62, 0.48);
    swordCore.rotation.x = 0.25;
    swordPivot.add(swordCore);

    const swordTip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.36, 4), bwCoreMat);
    swordTip.position.set(0, 1.4, 0.68);
    swordTip.rotation.x = 0.25;
    swordTip.rotation.y = Math.PI / 4;
    swordPivot.add(swordTip);

    bwGroup.add(swordPivot);
    group.add(bwGroup);
  }

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
    const isVintage = epochLevel <= 3;
    const isModern = epochLevel === 5;
    const isBus = epochLevel >= 4 && variant % 4 === 0;
    const isHover = epochLevel >= 6;

    if (isElf) {
      // Majestic Elf Sylvan Swan-Skiff: levitating ivory-and-gold curved gondola with sweeping lotus prows & floating crystal orb
      const ivoryMat = new THREE.MeshStandardMaterial({ color: 0xfefae0, roughness: 0.22, metalness: 0.35 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xffb703, roughness: 0.2, metalness: 0.85 });
      const hullRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.032, 7, 16), goldMat);
      hullRing.rotation.x = Math.PI / 2;
      hullRing.scale.set(0.85, 1.45, 1);
      hullRing.position.set(0, 0.14, 0);
      hullRing.castShadow = true;
      group.add(hullRing);

      const swanHull = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.46, 6), ivoryMat);
      swanHull.rotation.x = Math.PI / 2;
      swanHull.scale.set(1.1, 0.65, 1);
      swanHull.position.set(0, 0.14, 0.02);
      swanHull.castShadow = true;
      group.add(swanHull);

      const swanNeck = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.24, 5), goldMat);
      swanNeck.position.set(0, 0.24, 0.22);
      swanNeck.rotation.x = 0.45;
      group.add(swanNeck);

      for (const side of [-1, 1]) {
        const petalFin = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.28, 4), ivoryMat);
        petalFin.rotation.x = -Math.PI / 2;
        petalFin.rotation.z = side * 0.55;
        petalFin.position.set(side * 0.16, 0.17, -0.06);
        group.add(petalFin);
      }

      const coreCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), glowMat);
      coreCrystal.position.set(0, 0.25, -0.02);
      group.add(coreCrystal);
      return group;
    }

    if (isOrc) {
      // Intimidating Orc Spiked War-Buggy: rusted iron cage, oversized front crusher roller, bone tusks & twin roaring exhaust pipes
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.65, metalness: 0.72 });
      const bloodMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.52, metalness: 0.35 });
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.45 });

      const warFrame = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.38), bloodMat);
      warFrame.position.set(0, 0.11, -0.02);
      warFrame.castShadow = true;
      group.add(warFrame);

      const frontRoller = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.28, 8), ironMat);
      frontRoller.rotation.z = Math.PI / 2;
      frontRoller.position.set(0, 0.068, 0.2);
      group.add(frontRoller);

      for (const sx of [-0.14, 0.14]) {
        const rearWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 8), tireMat);
        rearWheel.rotation.z = Math.PI / 2;
        rearWheel.position.set(sx, 0.085, -0.14);
        group.add(rearWheel);

        const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.16, 4), boneMat);
        tusk.rotation.x = Math.PI / 2 - 0.2;
        tusk.position.set(sx * 0.75, 0.1, 0.27);
        group.add(tusk);

        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.22, 5), ironMat);
        pipe.position.set(sx * 0.85, 0.22, -0.12);
        pipe.rotation.x = -0.35;
        group.add(pipe);
      }
      return group;
    }

    const len = isBus ? 0.5 : isVintage ? 0.34 : 0.38;
    const wid = isBus ? 0.22 : isVintage ? 0.19 : 0.21;
    const h = isBus ? 0.18 : isVintage ? 0.13 : 0.1;

    const brassOrChrome = new THREE.MeshStandardMaterial({
      color: isVintage ? 0xd4a373 : 0xe2e8f0,
      roughness: 0.26,
      metalness: 0.78,
    });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(wid, h, len), bodyMat);
    chassis.position.y = isHover ? 0.14 : 0.085;
    chassis.castShadow = true;
    group.add(chassis);

    if (isVintage) {
      // Industrial boxy brass-grille carriage automobile
      const grille = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.65, 0.09, 0.03), brassOrChrome);
      grille.position.set(0, 0.085, len * 0.5 + 0.01);
      group.add(grille);
      const tallCab = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.88, 0.12, len * 0.48), bodyMat);
      tallCab.position.set(0, 0.18, -0.05);
      tallCab.castShadow = true;
      group.add(tallCab);
      const roofVisor = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.92, 0.022, len * 0.52), trimMat);
      roofVisor.position.set(0, 0.245, -0.05);
      group.add(roofVisor);
    } else if (!isBus) {
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(wid * 0.86, isModern ? 0.08 : 0.09, len * 0.54),
        isHover ? glassMat : bodyMat,
      );
      cabin.position.set(0, isHover ? 0.21 : 0.165, -0.02);
      cabin.castShadow = true;
      group.add(cabin);

      const windshield = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.88, 0.06, len * 0.56), glassMat);
      windshield.position.set(0, isHover ? 0.2 : 0.155, -0.01);
      group.add(windshield);
      if (isModern) {
        const lightBar = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.9, 0.018, 0.025), glowMat);
        lightBar.position.set(0, 0.11, len * 0.5 + 0.008);
        group.add(lightBar);
      }
    } else {
      const busWindows = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.01, 0.07, len * 0.86), glassMat);
      busWindows.position.set(0, isHover ? 0.16 : 0.125, 0);
      group.add(busWindows);
    }

    if (isHover) {
      const hoverPad = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.94, 0.03, len * 0.84), glowMat);
      hoverPad.position.y = 0.065;
      group.add(hoverPad);
      for (const px of [-wid * 0.48, wid * 0.48]) {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, len * 0.65), brassOrChrome);
        pod.position.set(px, 0.11, 0);
        group.add(pod);
      }
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

    const leadZ = 0.24;
    const coachZ = -0.26;
    const railBaseY = isMetro || isMaglev ? 0.02 : 0.09;

    if (isElf) {
      // Majestic Elf Astral Leyline Serpent-Train: articulated crystalline spires & golden astrolabe halos
      const ivoryMat = new THREE.MeshStandardMaterial({ color: 0xfefae0, roughness: 0.2, metalness: 0.4 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xffb703, roughness: 0.2, metalness: 0.86 });
      for (const cz of [leadZ, coachZ]) {
        const crystalCar = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), ivoryMat);
        crystalCar.scale.set(0.85, 0.72, 1.35);
        crystalCar.position.set(0, railBaseY + 0.14, cz);
        crystalCar.castShadow = true;
        group.add(crystalCar);

        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 6, 14), goldMat);
        halo.position.set(0, railBaseY + 0.16, cz);
        group.add(halo);
      }
      const prowLance = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 6), glowMat);
      prowLance.rotation.x = Math.PI / 2;
      prowLance.position.set(0, railBaseY + 0.14, leadZ + 0.28);
      group.add(prowLance);
      return group;
    }

    if (isOrc) {
      // Intimidating Orc Hell-Iron Juggernaut Train: cowcatcher ram spikes, furnace boiler core & heavy armored gun-car
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.6, metalness: 0.75 });
      const bloodMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5, metalness: 0.35 });
      const loco = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.46), ironMat);
      loco.position.set(0, railBaseY + 0.13, leadZ);
      loco.castShadow = true;
      group.add(loco);

      const ramPlow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.24, 4), bloodMat);
      ramPlow.rotation.x = Math.PI / 2;
      ramPlow.rotation.y = Math.PI / 4;
      ramPlow.position.set(0, railBaseY + 0.1, leadZ + 0.32);
      group.add(ramPlow);

      for (const sx of [-0.09, 0.09]) {
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.22, 6), bloodMat);
        stack.position.set(sx, railBaseY + 0.34, leadZ + 0.08);
        group.add(stack);
      }

      const gunCar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.42), bloodMat);
      gunCar.position.set(0, railBaseY + 0.11, coachZ);
      gunCar.castShadow = true;
      group.add(gunCar);
      return group;
    }

    // Front Locomotive / Lead Metro Car (+Z) + Linked Passenger Coach (-Z)
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

  if (type === 'glider') {
    // Fixed-wing Scout Glider (Epoch 2 Medieval: unpowered) -> Propeller Biplane Fighter (Epoch 3 Industrial: spinning front propeller, ZERO jets/rotors!)
    const isBiplaneFighter = epochLevel >= 3;

    if (isElf) {
      // Majestic Elf Celestial Sun-Hawk: golden crescent bow-ring chassis, layered feathered crystal pinions, beak crest & trailing phoenix tail ribbons
      const ivoryMat = new THREE.MeshStandardMaterial({ color: 0xfefae0, roughness: 0.18, metalness: 0.38 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xffb703, roughness: 0.18, metalness: 0.88 });

      // Central Golden Crescent Bow-Arc
      const crescentArc = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.028, 7, 18, Math.PI * 1.15), goldMat);
      crescentArc.rotation.x = Math.PI / 2;
      crescentArc.rotation.z = -Math.PI * 0.075;
      crescentArc.position.set(0, 0.2, 0.08);
      crescentArc.castShadow = true;
      group.add(crescentArc);

      // Faceted Alabaster Crystal Spire Body & Golden Hawk Beak
      const crystalSpire = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), ivoryMat);
      crystalSpire.scale.set(0.65, 0.55, 3.4);
      crystalSpire.position.set(0, 0.21, 0.06);
      crystalSpire.castShadow = true;
      group.add(crystalSpire);

      const hawkBeak = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.34, 5), goldMat);
      hawkBeak.rotation.x = Math.PI / 2 - 0.12;
      hawkBeak.position.set(0, 0.21, 0.58);
      group.add(hawkBeak);

      const heartGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), glowMat);
      heartGem.position.set(0, 0.26, 0.18);
      group.add(heartGem);

      // Layered Feathered Pinions (sweeping graceful avian silhouette, zero boxy plank wings)
      for (const side of [-1, 1]) {
        for (let fi = 0; fi < 3; fi++) {
          const featherLen = 0.58 - fi * 0.11;
          const feather = new THREE.Mesh(
            new THREE.ConeGeometry(0.065 - fi * 0.01, featherLen, 4),
            fi === 1 ? glowMat : ivoryMat,
          );
          feather.rotation.z = -side * (Math.PI / 2 - 0.18 - fi * 0.08);
          feather.rotation.y = -side * (0.28 + fi * 0.18);
          feather.scale.set(1, 1, 0.32);
          feather.position.set(side * (0.34 + fi * 0.14), 0.21 + fi * 0.025, 0.14 - fi * 0.14);
          feather.castShadow = true;
          group.add(feather);
        }
        const tailRibbon = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.52, 4), goldMat);
        tailRibbon.rotation.x = -Math.PI / 2 + 0.18;
        tailRibbon.rotation.y = side * 0.22;
        tailRibbon.position.set(side * 0.12, 0.23, -0.54);
        group.add(tailRibbon);
      }

      if (isBiplaneFighter) {
        const sunPropGroup = new THREE.Group();
        sunPropGroup.name = 'spin_prop';
        sunPropGroup.position.set(0, 0.21, 0.72);
        sunPropGroup.add(
          new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.032, 0.016), goldMat),
          new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.32, 0.016), goldMat),
        );
        group.add(sunPropGroup);
      }
      return group;
    }

    if (isOrc) {
      // Intimidating Orc Gore-Talon Bat-Fighter: brutal skull-ram prow, spiked iron spine & jagged blood-red bat-talon wings (with nose propeller in Industrial Epoch 3)
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.62, metalness: 0.78 });
      const bloodMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.54, metalness: 0.28 });
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.42 });

      // Brutalist Iron Skull-Hull & Forward Cleaver Blade
      const skullBlock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), ironMat);
      skullBlock.scale.set(1.05, 0.85, 2.3);
      skullBlock.position.set(0, 0.2, 0.04);
      skullBlock.castShadow = true;
      group.add(skullBlock);

      const noseCleaver = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 3), ironMat);
      noseCleaver.rotation.x = Math.PI / 2;
      noseCleaver.scale.set(0.35, 1.3, 1);
      noseCleaver.position.set(0, 0.19, 0.56);
      group.add(noseCleaver);

      // Giant Curved Bone Tusks flanking the skull jaw
      for (const side of [-1, 1]) {
        const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.36, 4), boneMat);
        tusk.rotation.x = Math.PI / 2 - 0.28;
        tusk.rotation.y = side * 0.25;
        tusk.position.set(side * 0.16, 0.15, 0.52);
        group.add(tusk);

        // Jagged Bat-Claw Wings (3 splayed iron/crimson talons per side)
        const wingArm = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 0.68, 5), ironMat);
        wingArm.rotation.z = side * (Math.PI / 2 - 0.22);
        wingArm.rotation.y = side * 0.24;
        wingArm.position.set(side * 0.38, 0.24, 0.16);
        group.add(wingArm);

        for (let ci = 0; ci < 3; ci++) {
          const clawMembrane = new THREE.Mesh(
            new THREE.ConeGeometry(0.16, 0.56 - ci * 0.08, 3),
            ci === 1 ? ironMat : bloodMat,
          );
          clawMembrane.rotation.x = -Math.PI / 2;
          clawMembrane.rotation.z = side * (0.25 + ci * 0.22);
          clawMembrane.scale.set(1.2, 1, 0.22);
          clawMembrane.position.set(side * (0.28 + ci * 0.19), 0.2 - ci * 0.01, -0.04 - ci * 0.06);
          clawMembrane.castShadow = true;
          group.add(clawMembrane);
        }

        const wingHook = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 4), boneMat);
        wingHook.rotation.x = Math.PI / 2;
        wingHook.position.set(side * 0.68, 0.26, 0.34);
        group.add(wingHook);
      }

      // Dorsal Spine Spikes & Industrial Nose Propeller (Epoch 3)
      for (const sz of [0.16, -0.06, -0.28]) {
        const dorsalSpike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 4), boneMat);
        dorsalSpike.rotation.x = -0.35;
        dorsalSpike.position.set(0, 0.34, sz);
        group.add(dorsalSpike);
      }
      if (isBiplaneFighter) {
        const nosePropGroup = new THREE.Group();
        nosePropGroup.name = 'spin_prop';
        nosePropGroup.position.set(0, 0.19, 0.72);
        nosePropGroup.add(
          new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.044, 0.02), ironMat),
          new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.36, 0.02), bloodMat),
        );
        group.add(nosePropGroup);
      }
      return group;
    }

    const wingMat = new THREE.MeshStandardMaterial({
      color: isBiplaneFighter ? 0xe9d8a6 : 0xf4ecd8,
      roughness: 0.54,
      metalness: isBiplaneFighter ? 0.28 : 0.08,
    });
    const sparMat = new THREE.MeshStandardMaterial({
      color: isBiplaneFighter ? 0x475569 : 0x7f4f24,
      roughness: 0.48,
      metalness: isBiplaneFighter ? 0.55 : 0.12,
    });

    // Human Fixed-wing Wooden Glider (Epoch 2) -> WWI Propeller Biplane Fighter (Epoch 3)
    const fuselage = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.038, isBiplaneFighter ? 0.96 : 0.88, 8),
      sparMat,
    );
    fuselage.rotation.x = Math.PI / 2;
    fuselage.position.set(0, 0.16, 0);
    fuselage.castShadow = true;
    group.add(fuselage);

    const noseCap = new THREE.Mesh(
      new THREE.ConeGeometry(0.068, 0.2, 8),
      isBiplaneFighter ? trimMat : sparMat,
    );
    noseCap.rotation.x = Math.PI / 2;
    noseCap.position.set(0, 0.16, isBiplaneFighter ? 0.54 : 0.48);
    group.add(noseCap);

    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(isBiplaneFighter ? 0.66 : 0.72, 0.032, isBiplaneFighter ? 0.26 : 0.3),
        wingMat,
      );
      panel.position.set(side * 0.36, 0.17, 0.06);
      panel.rotation.y = -side * 0.18;
      panel.rotation.z = side * 0.06;
      panel.castShadow = true;
      group.add(panel);

      const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.16), trimMat);
      winglet.position.set(side * (isBiplaneFighter ? 0.68 : 0.72), 0.21, -0.02);
      group.add(winglet);
    }

    if (isBiplaneFighter) {
      for (const side of [-1, 1]) {
        const upWing = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.032, 0.24), wingMat);
        upWing.position.set(side * 0.33, 0.34, 0.1);
        upWing.rotation.y = -side * 0.14;
        upWing.castShadow = true;
        group.add(upWing);

        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 5), sparMat);
        strut.position.set(side * 0.4, 0.25, 0.08);
        group.add(strut);

        const gunPod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.24, 6), trimMat);
        gunPod.rotation.x = Math.PI / 2;
        gunPod.position.set(side * 0.24, 0.13, 0.18);
        group.add(gunPod);
      }

      const cockpitWind = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.16), glassMat);
      cockpitWind.position.set(0, 0.24, 0.16);
      group.add(cockpitWind);

      const nosePropGroup = new THREE.Group();
      nosePropGroup.name = 'spin_prop';
      nosePropGroup.position.set(0, 0.16, 0.65);
      const bladeA = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.036, 0.018), headlightMat);
      const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.32, 0.018), headlightMat);
      nosePropGroup.add(bladeA, bladeB);
      group.add(nosePropGroup);
    }

    for (const side of [-1, 1]) {
      const hStab = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.028, 0.14), wingMat);
      hStab.position.set(side * 0.14, 0.17, -0.4);
      hStab.rotation.y = -side * 0.24;
      group.add(hStab);
    }
    const vFin = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.2, 0.18), trimMat);
    vFin.position.set(0, 0.26, -0.4);
    vFin.rotation.x = -0.22;
    group.add(vFin);
    return group;
  }

  if (type === 'helicopter') {
    // Rotorcraft (Epoch 4 Atomic: Utility Chopper / Lotus Gyro -> Epoch 5+ Info Age: Heavy Attack Gunship / Celestial Valkyrie)
    const isApacheGunship = epochLevel >= 5;
    if (isElf) {
      // Elf Sylvan Lotus Gyro-Skiff (Epoch 4) -> Celestial Valkyrie Attack Gunship (Epoch 5+)
      const ivoryMat = new THREE.MeshStandardMaterial({
        color: isApacheGunship ? 0xd8f3dc : 0xfefae0,
        roughness: 0.18,
        metalness: isApacheGunship ? 0.56 : 0.42,
      });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xffb703, roughness: 0.18, metalness: 0.88 });

      if (!isApacheGunship) {
        // Epoch 4: Vertical Floating Crystal Spire Sanctum + Cradle Arch + Single 6-Petal Lotus Rotor
        const crystalCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), ivoryMat);
        crystalCore.scale.set(0.82, 1.55, 0.82);
        crystalCore.position.set(0, 0.28, 0);
        crystalCore.castShadow = true;
        group.add(crystalCore);

        const cradleArch = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.026, 7, 18), goldMat);
        cradleArch.rotation.y = Math.PI / 2;
        cradleArch.position.set(0, 0.28, 0);
        group.add(cradleArch);

        for (const [px, pz] of [
          [-0.28, 0.22],
          [0.28, 0.22],
          [-0.28, -0.22],
          [0.28, -0.22],
        ]) {
          const obelisk = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), glowMat);
          obelisk.scale.set(0.65, 2.1, 0.65);
          obelisk.position.set(px, 0.24, pz);
          group.add(obelisk);
        }
      } else {
        // Epoch 5+: Sleek Swept Valkyrie Gunship with emerald visor, swept razor forward wings, twin crystal missile pods & star-lance chin beam
        const valkyrieHull = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.86, 8), ivoryMat);
        valkyrieHull.rotation.x = Math.PI / 2;
        valkyrieHull.scale.set(1.15, 0.82, 1);
        valkyrieHull.position.set(0, 0.22, 0.04);
        valkyrieHull.castShadow = true;
        group.add(valkyrieHull);

        const canopy = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), glassMat);
        canopy.scale.set(0.85, 0.72, 1.9);
        canopy.position.set(0, 0.28, 0.34);
        group.add(canopy);

        const starLance = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.42, 6), glowMat);
        starLance.rotation.x = Math.PI / 2;
        starLance.position.set(0, 0.13, 0.56);
        group.add(starLance);

        for (const side of [-1, 1]) {
          const razorWing = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.032, 0.2), goldMat);
          razorWing.position.set(side * 0.28, 0.22, 0.04);
          razorWing.rotation.y = -side * 0.36;
          razorWing.rotation.z = side * 0.14;
          group.add(razorWing);

          const crystalPod = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), glowMat);
          crystalPod.scale.set(0.8, 0.8, 2.4);
          crystalPod.position.set(side * 0.42, 0.2, 0.12);
          group.add(crystalPod);

          const vTailBlade = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.24, 0.16), ivoryMat);
          vTailBlade.position.set(side * 0.14, 0.34, -0.44);
          vTailBlade.rotation.z = -side * 0.42;
          group.add(vTailBlade);
        }
      }

      // Majestic Overhead Spinning Lotus-Astrolabe Halo Rotor
      const mainRotor = new THREE.Group();
      mainRotor.name = 'spin_rotor';
      mainRotor.position.set(0, isApacheGunship ? 0.52 : 0.56, 0);
      const outerHalo = new THREE.Mesh(new THREE.TorusGeometry(isApacheGunship ? 0.64 : 0.56, 0.022, 6, 20), goldMat);
      outerHalo.rotation.x = Math.PI / 2;
      mainRotor.add(outerHalo);
      const innerHalo = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.018, 6, 16), glowMat);
      innerHalo.rotation.x = Math.PI / 2;
      mainRotor.add(innerHalo);
      const petalCount = isApacheGunship ? 8 : 6;
      for (let pi = 0; pi < petalCount; pi++) {
        const ang = (pi / petalCount) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.ConeGeometry(0.08, isApacheGunship ? 0.62 : 0.54, 4), pi % 2 === 0 ? glowMat : ivoryMat);
        petal.rotation.x = Math.PI / 2;
        petal.rotation.z = ang;
        petal.scale.set(1, 1, 0.28);
        petal.position.set(Math.sin(ang) * 0.3, 0, Math.cos(ang) * 0.3);
        mainRotor.add(petal);
      }
      group.add(mainRotor);

      const tailRotor = new THREE.Group();
      tailRotor.name = 'spin_prop';
      tailRotor.position.set(0, 0.28, -0.48);
      const starRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.016, 6, 12), goldMat);
      tailRotor.add(starRing);
      for (let si = 0; si < 4; si++) {
        const spoke = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), glowMat);
        spoke.scale.set(0.5, 3.2, 0.5);
        spoke.rotation.z = (si * Math.PI) / 4;
        tailRotor.add(spoke);
      }
      group.add(tailRotor);
      return group;
    }

    if (isOrc) {
      // Orc Gore-Grinder Skull-Chopper (Epoch 4) -> Orc Heavy Turbine Dread-Kopter (Epoch 5+)
      const ironMat = new THREE.MeshStandardMaterial({
        color: isApacheGunship ? 0x111827 : 0x18181b,
        roughness: isApacheGunship ? 0.44 : 0.62,
        metalness: 0.82,
      });
      const bloodMat = new THREE.MeshStandardMaterial({
        color: isApacheGunship ? 0xdc2626 : 0x991b1b,
        roughness: 0.48,
        metalness: 0.35,
      });
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.44 });

      const skullCore = new THREE.Mesh(new THREE.DodecahedronGeometry(isApacheGunship ? 0.31 : 0.28, 0), ironMat);
      skullCore.scale.set(1.22, 1.0, isApacheGunship ? 1.55 : 1.35);
      skullCore.position.set(0, 0.25, 0.08);
      skullCore.castShadow = true;
      group.add(skullCore);

      const ironJaw = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.34, 4), bloodMat);
      ironJaw.rotation.x = Math.PI / 2;
      ironJaw.rotation.y = Math.PI / 4;
      ironJaw.position.set(0, 0.14, 0.46);
      group.add(ironJaw);

      for (const sx of [-0.11, 0.11]) {
        const eyeGlow = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), glowMat);
        eyeGlow.position.set(sx, 0.3, 0.38);
        group.add(eyeGlow);
      }

      for (const side of [-1, 1]) {
        const megaTusk = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.46, 5), boneMat);
        megaTusk.rotation.x = Math.PI / 2 - 0.32;
        megaTusk.rotation.y = side * 0.28;
        megaTusk.position.set(side * 0.22, 0.16, 0.56);
        group.add(megaTusk);

        const gatlingDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.5, 6), bloodMat);
        gatlingDrum.rotation.x = Math.PI / 2;
        gatlingDrum.position.set(side * 0.36, 0.22, 0.14);
        group.add(gatlingDrum);

        const exhaustPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.34, 6), ironMat);
        exhaustPipe.position.set(side * 0.26, 0.44, -0.18);
        exhaustPipe.rotation.x = -0.42;
        exhaustPipe.rotation.z = -side * 0.25;
        group.add(exhaustPipe);

        if (isApacheGunship) {
          // Epoch 5+ Dread-Kopter stub wings, turbine nacelles & missile racks
          const stubWing = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.26), ironMat);
          stubWing.position.set(side * 0.42, 0.22, 0.04);
          group.add(stubWing);
          const rocketPod = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.42, 6), glowMat);
          rocketPod.rotation.x = Math.PI / 2;
          rocketPod.position.set(side * 0.58, 0.18, 0.12);
          group.add(rocketPod);
          const turbineNacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.42, 7), bloodMat);
          turbineNacelle.rotation.x = Math.PI / 2;
          turbineNacelle.position.set(side * 0.28, 0.36, -0.06);
          group.add(turbineNacelle);
        }
      }

      const tailChain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.58, 5), ironMat);
      tailChain.rotation.x = Math.PI / 2;
      tailChain.position.set(0, 0.25, -0.46);
      group.add(tailChain);

      const mainRotor = new THREE.Group();
      mainRotor.name = 'spin_rotor';
      mainRotor.position.set(0, 0.56, 0.04);
      const sawRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.032, 5, 10), bloodMat);
      sawRing.rotation.x = Math.PI / 2;
      mainRotor.add(sawRing);
      const bladeCount = isApacheGunship ? 6 : 4;
      for (let bi = 0; bi < bladeCount; bi++) {
        const ang = (bi * Math.PI * 2) / bladeCount;
        const cleaverBlade = new THREE.Mesh(new THREE.ConeGeometry(0.14, isApacheGunship ? 0.88 : 0.78, 3), ironMat);
        cleaverBlade.rotation.x = Math.PI / 2;
        cleaverBlade.rotation.z = ang;
        cleaverBlade.scale.set(1, 1, 0.22);
        cleaverBlade.position.set(Math.sin(ang) * 0.4, 0, Math.cos(ang) * 0.4);
        mainRotor.add(cleaverBlade);
      }
      group.add(mainRotor);

      const tailRotor = new THREE.Group();
      tailRotor.name = 'spin_prop';
      tailRotor.position.set(0.08, 0.28, -0.74);
      tailRotor.rotation.y = Math.PI / 2;
      const buzzDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.025, 7), bloodMat);
      buzzDisc.rotation.x = Math.PI / 2;
      tailRotor.add(buzzDisc);
      group.add(tailRotor);
      return group;
    }

    const heliMat = new THREE.MeshStandardMaterial({
      color: isApacheGunship ? 0x334155 : 0x4d5d3b,
      roughness: isApacheGunship ? 0.34 : 0.48,
      metalness: isApacheGunship ? 0.62 : 0.38,
    });

    if (!isApacheGunship) {
      // Epoch 4 (Atomic Age 1965 CE): Classic UH-1 Huey / Bell Bubble-Canopy Utility Chopper (NO Apache stub-wings or Hellfire pods)
      const hueyBody = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.13, 0.54, 8), heliMat);
      hueyBody.rotation.x = Math.PI / 2;
      hueyBody.scale.set(1.0, 0.92, 1.0);
      hueyBody.position.set(0, 0.21, 0.06);
      hueyBody.castShadow = true;
      group.add(hueyBody);

      const bubbleCanopy = new THREE.Mesh(new THREE.SphereGeometry(0.145, 8, 8), glassMat);
      bubbleCanopy.scale.set(0.95, 0.85, 1.25);
      bubbleCanopy.position.set(0, 0.22, 0.32);
      group.add(bubbleCanopy);

      const topTurbine = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.28, 7), trimMat);
      topTurbine.rotation.x = Math.PI / 2;
      topTurbine.position.set(0, 0.34, -0.02);
      group.add(topTurbine);
    } else {
      // Epoch 5+ (Info Age 2015 CE): Modern AH-64 Apache Attack Gunship with tandem armored cockpit, chin gun & stub-wing missile pods
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.62), heliMat);
      cabin.position.set(0, 0.2, 0.08);
      cabin.castShadow = true;
      group.add(cabin);

      const cockpitNose = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.3, 8), glassMat);
      cockpitNose.rotation.x = Math.PI / 2;
      cockpitNose.position.set(0, 0.21, 0.48);
      group.add(cockpitNose);

      const chinTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.22, 6), trimMat);
      chinTurret.rotation.x = Math.PI / 2;
      chinTurret.position.set(0, 0.1, 0.56);
      group.add(chinTurret);
    }

    const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.075, 0.64, 7), heliMat);
    tailBoom.rotation.x = Math.PI / 2;
    tailBoom.position.set(0, 0.24, -0.5);
    group.add(tailBoom);

    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.16), bodyMat);
    tailFin.position.set(0, 0.34, -0.78);
    tailFin.rotation.x = -0.25;
    group.add(tailFin);

    for (const sx of [-0.16, 0.16]) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.68, 6), trimMat);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(sx, 0.05, 0.06);
      group.add(skid);
      for (const sz of [-0.14, 0.24]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.12, 0.025), trimMat);
        leg.position.set(sx * 0.85, 0.11, sz);
        leg.rotation.z = sx < 0 ? 0.25 : -0.25;
        group.add(leg);
      }

      if (isApacheGunship) {
        const pylonArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.12), trimMat);
        pylonArm.position.set(sx * 1.15, 0.19, 0.05);
        group.add(pylonArm);
        const rocketPod = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.28, 7), bodyMat);
        rocketPod.rotation.x = Math.PI / 2;
        rocketPod.position.set(sx * 1.65, 0.18, 0.08);
        group.add(rocketPod);

        const engineNacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.34, 7), trimMat);
        engineNacelle.rotation.x = Math.PI / 2;
        engineNacelle.position.set(sx * 0.72, 0.33, -0.02);
        group.add(engineNacelle);
      }
    }

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.18, 6), trimMat);
    mast.position.set(0, 0.4, 0.02);
    group.add(mast);

    const mainRotor = new THREE.Group();
    mainRotor.name = 'spin_rotor';
    mainRotor.position.set(0, 0.49, 0.02);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8), trimMat);
    mainRotor.add(hub);
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.022, 0.075), trimMat);
    mainRotor.add(blade1);
    if (isApacheGunship) {
      const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.022, 1.36), trimMat);
      mainRotor.add(blade2);
    }
    group.add(mainRotor);

    const tailRotor = new THREE.Group();
    tailRotor.name = 'spin_prop';
    tailRotor.position.set(0.055, 0.38, -0.78);
    tailRotor.rotation.y = Math.PI / 2;
    const tb1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.015), headlightMat);
    const tb2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.24, 0.015), headlightMat);
    tailRotor.add(tb1, tb2);
    group.add(tailRotor);
    return group;
  }

  if (type === 'tank') {
    group.add(createContactShadow(0.56));
    const isIndustrial = epochLevel <= 3;
    const isAtomic = epochLevel === 4;
    const isInfo = epochLevel === 5;
    const isOrbitalHover = epochLevel >= 6;
    const isStarSiege = epochLevel >= 7;

    if (isElf) {
      // Elf Sylvan Runic War-Chariot Progression:
      // Epoch 3 (Industrial): Wheeled Gilded Sun-Wagon
      // Epoch 4 (Atomic): Levitating Lotus Strider (crystal shield vanes)
      // Epoch 5 (Info): Mirage Arc-Chariot MBT (twin hover keels + astrolabe ring + star lance)
      // Epoch 6+ (Orbital/Star): Celestial Sun-Prism Sanctuary (+ Epoch 7 Crown Halo & Twin Lances)
      const ivoryMat = new THREE.MeshStandardMaterial({
        color: isOrbitalHover ? 0xe0fbfc : isInfo ? 0xd8f3dc : 0xfefae0,
        roughness: 0.18,
        metalness: isOrbitalHover ? 0.62 : 0.4,
      });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xffb703, roughness: 0.18, metalness: 0.88 });
      const baseHoverY = isOrbitalHover ? 0.22 : isInfo ? 0.17 : isAtomic ? 0.15 : 0.12;

      if (isIndustrial) {
        // Epoch 3 Industrial: Ornate 4-wheeled gilded sun-carriage + brass prism cannon
        const carriage = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.56, 7), ivoryMat);
        carriage.rotation.x = Math.PI / 2;
        carriage.scale.set(1.25, 0.72, 1);
        carriage.position.set(0, baseHoverY + 0.05, 0);
        carriage.castShadow = true;
        group.add(carriage);

        for (const [wx, wz] of [
          [-0.24, 0.2],
          [0.24, 0.2],
          [-0.26, -0.2],
          [0.26, -0.2],
        ]) {
          const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 12), goldMat);
          wheel.rotation.y = Math.PI / 2;
          wheel.position.set(wx, 0.1, wz);
          group.add(wheel);
          const hub = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), glowMat);
          hub.position.set(wx, 0.1, wz);
          group.add(hub);
        }

        const prowCrest = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 5), goldMat);
        prowCrest.rotation.x = Math.PI / 2 - 0.2;
        prowCrest.position.set(0, baseHoverY + 0.12, 0.36);
        group.add(prowCrest);

        const brassBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 0.36, 6), goldMat);
        brassBarrel.rotation.x = Math.PI / 2;
        brassBarrel.position.set(0, baseHoverY + 0.22, 0.22);
        group.add(brassBarrel);

        const turretGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), glowMat);
        turretGem.position.set(0, baseHoverY + 0.22, -0.02);
        group.add(turretGem);
        return group;
      }

      if (isAtomic) {
        // Epoch 4 Atomic: Levitating Lotus Strider with single halo ring + side crystal shield vanes
        const levRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.028, 7, 18), goldMat);
        levRing.rotation.x = Math.PI / 2;
        levRing.scale.set(0.9, 1.24, 1);
        levRing.position.set(0, baseHoverY, 0);
        group.add(levRing);

        const lotusHull = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 6), ivoryMat);
        lotusHull.rotation.x = Math.PI;
        lotusHull.position.set(0, baseHoverY + 0.04, 0);
        lotusHull.castShadow = true;
        group.add(lotusHull);

        for (const side of [-1, 1]) {
          const crystalVane = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.34), glowMat);
          crystalVane.position.set(side * 0.26, baseHoverY + 0.14, 0.02);
          crystalVane.rotation.z = -side * 0.28;
          group.add(crystalVane);
        }

        const prismTurret = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), ivoryMat);
        prismTurret.scale.set(1, 0.85, 1.2);
        prismTurret.position.set(0, baseHoverY + 0.22, -0.02);
        group.add(prismTurret);

        const crystalCannon = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.42, 6), glowMat);
        crystalCannon.rotation.x = Math.PI / 2;
        crystalCannon.position.set(0, baseHoverY + 0.22, 0.28);
        group.add(crystalCannon);
        return group;
      }

      if (isInfo) {
        // Epoch 5 Info: Sleek Swept Mirage Arc-Chariot MBT with twin hover keels + spinning astrolabe turret ring
        for (const kx of [-0.22, 0.22]) {
          const keel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.64), ivoryMat);
          keel.position.set(kx, baseHoverY - 0.02, 0);
          keel.castShadow = true;
          group.add(keel);
          const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.028, 0.42), goldMat);
          wingBlade.position.set(kx * 1.45, baseHoverY + 0.05, -0.06);
          wingBlade.rotation.y = kx < 0 ? 0.32 : -0.32;
          group.add(wingBlade);
        }
        const coreDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.56, 6), ivoryMat);
        coreDeck.rotation.x = Math.PI / 2;
        coreDeck.scale.set(1.2, 0.5, 1);
        coreDeck.position.set(0, baseHoverY + 0.06, 0.02);
        group.add(coreDeck);

        const astrolabe = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 14), goldMat);
        astrolabe.rotation.x = Math.PI / 2;
        astrolabe.name = 'spin_rotor';
        astrolabe.position.set(0, baseHoverY + 0.26, -0.04);
        group.add(astrolabe);

        const railSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.036, 0.54, 6), glowMat);
        railSpire.rotation.x = Math.PI / 2;
        railSpire.position.set(0, baseHoverY + 0.2, 0.34);
        group.add(railSpire);
        return group;
      }

      // Epoch 6+ (Orbital / Star): Celestial Sun-Prism Sanctuary
      const outerHalo = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.032, 7, 20), goldMat);
      outerHalo.rotation.x = Math.PI / 2;
      outerHalo.scale.set(0.92, 1.28, 1);
      outerHalo.position.set(0, baseHoverY, 0);
      outerHalo.castShadow = true;
      group.add(outerHalo);

      const innerRuneRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 16), glowMat);
      innerRuneRing.rotation.x = Math.PI / 2;
      innerRuneRing.position.set(0, baseHoverY - 0.03, 0);
      group.add(innerRuneRing);

      const lotusPlatform = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.18, 6), ivoryMat);
      lotusPlatform.rotation.x = Math.PI;
      lotusPlatform.position.set(0, baseHoverY + 0.04, 0);
      lotusPlatform.castShadow = true;
      group.add(lotusPlatform);

      for (const side of [-1, 1]) {
        const wingArch = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.48, 4), ivoryMat);
        wingArch.rotation.x = -Math.PI / 2 + 0.25;
        wingArch.rotation.z = side * 0.48;
        wingArch.position.set(side * 0.28, baseHoverY + 0.12, -0.04);
        wingArch.castShadow = true;
        group.add(wingArch);

        const crystalPylon = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), glowMat);
        crystalPylon.scale.set(0.7, 1.9, 0.7);
        crystalPylon.position.set(side * 0.34, baseHoverY + 0.18, 0.14);
        group.add(crystalPylon);
      }

      const sunPrism = new THREE.Mesh(new THREE.OctahedronGeometry(0.19, 0), glowMat);
      sunPrism.scale.set(0.85, 1.45, 0.95);
      sunPrism.position.set(0, baseHoverY + 0.32, -0.02);
      sunPrism.castShadow = true;
      group.add(sunPrism);

      const prismCrown = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 6, 14), goldMat);
      prismCrown.rotation.y = Math.PI / 2;
      prismCrown.position.set(0, baseHoverY + 0.32, 0.06);
      group.add(prismCrown);

      const starLance = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.48, 6), goldMat);
      starLance.rotation.x = Math.PI / 2;
      starLance.position.set(0, baseHoverY + 0.32, 0.34);
      group.add(starLance);

      if (isStarSiege) {
        const archonCrown = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 6, 16), glowMat);
        archonCrown.position.set(0, baseHoverY + 0.52, -0.06);
        archonCrown.rotation.x = Math.PI / 3;
        group.add(archonCrown);
      }
      return group;
    }

    if (isOrc) {
      // Orc Brutalist Siege Progression:
      // Epoch 3 (Industrial): Riveted Steam Kill-Roller (front grinder drum + rear iron tractor wheels + chimneys)
      // Epoch 4 (Atomic): Heavy Skull-Dozer Tank (treads + spiked bulldozer blade + single heavy cannon + horns)
      // Epoch 5 (Info): Rocket-Barrage Assault Juggernaut (armored tread skirts + twin missile pods + twin gatlings + mega horns)
      // Epoch 6+ (Orbital/Star): Magma Hover Skull-Crusher (glowing magma hover skids + twin plasma hell-cannons + Epoch 7 dorsal mortar)
      const ironMat = new THREE.MeshStandardMaterial({
        color: isInfo ? 0x27272a : 0x18181b,
        roughness: isOrbitalHover ? 0.38 : 0.65,
        metalness: 0.8,
      });
      const bloodMat = new THREE.MeshStandardMaterial({
        color: isInfo || isOrbitalHover ? 0xb91c1c : 0x991b1b,
        roughness: 0.48,
        metalness: 0.36,
      });
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.42 });
      const baseY = isOrbitalHover ? 0.18 : 0.12;

      if (isIndustrial) {
        // Epoch 3 Industrial: Spiked front roller + tractor chassis + chimneys
        const boilerBox = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.5), bloodMat);
        boilerBox.position.set(0, baseY + 0.1, -0.04);
        boilerBox.castShadow = true;
        group.add(boilerBox);

        const grinderDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.52, 8), ironMat);
        grinderDrum.rotation.z = Math.PI / 2;
        grinderDrum.position.set(0, baseY, 0.34);
        group.add(grinderDrum);

        for (const gx of [-0.18, 0, 0.18]) {
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 4), boneMat);
          spike.rotation.x = Math.PI / 2;
          spike.position.set(gx, baseY + 0.02, 0.5);
          group.add(spike);
        }
        for (const side of [-1, 1]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 7), ironMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(side * 0.26, baseY, -0.18);
          group.add(wheel);

          const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.055, 0.28, 6), ironMat);
          chimney.position.set(side * 0.14, baseY + 0.32, -0.22);
          group.add(chimney);
        }
        const shortCannon = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.26, 6), ironMat);
        shortCannon.rotation.x = Math.PI / 2;
        shortCannon.position.set(0, baseY + 0.24, 0.22);
        group.add(shortCannon);
        return group;
      }

      if (isAtomic) {
        // Epoch 4 Atomic: Heavy Treads + Spiked Front Dozer Blade + Horned Skull-Bunker Turret
        const hull = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.62), bloodMat);
        hull.position.set(0, baseY + 0.05, 0);
        hull.castShadow = true;
        group.add(hull);

        const dozerBlade = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.08), ironMat);
        dozerBlade.position.set(0, baseY + 0.01, 0.36);
        dozerBlade.rotation.x = -0.35;
        group.add(dozerBlade);

        for (const tx of [-0.25, 0.25]) {
          const tread = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.68), tireMat);
          tread.position.set(tx, 0.08, 0);
          group.add(tread);
        }

        const skullTurret = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), ironMat);
        skullTurret.scale.set(1.1, 0.88, 1.15);
        skullTurret.position.set(0, baseY + 0.24, -0.04);
        group.add(skullTurret);

        for (const side of [-1, 1]) {
          const horn = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.32, 5), boneMat);
          horn.rotation.z = -side * 0.65;
          horn.position.set(side * 0.24, baseY + 0.32, 0.04);
          group.add(horn);
        }
        const bigBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.06, 0.48, 6), ironMat);
        bigBarrel.rotation.x = Math.PI / 2;
        bigBarrel.position.set(0, baseY + 0.25, 0.32);
        group.add(bigBarrel);
        return group;
      }

      if (isInfo) {
        // Epoch 5 Info: Rocket-Barrage Assault Juggernaut (Armored Skirts + Dual Missile Pods + Twin Gatling Cannons)
        const hull = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.68), ironMat);
        hull.position.set(0, baseY + 0.06, 0);
        hull.castShadow = true;
        group.add(hull);

        for (const tx of [-0.28, 0.28]) {
          const armoredSkirt = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.72), bloodMat);
          armoredSkirt.position.set(tx, baseY, 0);
          group.add(armoredSkirt);
        }

        const wedgeTurret = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), ironMat);
        wedgeTurret.scale.set(1.2, 0.85, 1.3);
        wedgeTurret.position.set(0, baseY + 0.25, -0.02);
        group.add(wedgeTurret);

        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.08), glowMat);
        visor.position.set(0, baseY + 0.28, 0.22);
        group.add(visor);

        for (const side of [-1, 1]) {
          const missilePod = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.26), bloodMat);
          missilePod.position.set(side * 0.3, baseY + 0.3, -0.06);
          group.add(missilePod);

          const twinCannon = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.045, 0.52, 6), trimMat);
          twinCannon.rotation.x = Math.PI / 2;
          twinCannon.position.set(side * 0.1, baseY + 0.24, 0.34);
          group.add(twinCannon);

          const megaHorn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.38, 5), boneMat);
          megaHorn.rotation.x = Math.PI / 2 - 0.25;
          megaHorn.position.set(side * 0.2, baseY + 0.1, 0.44);
          group.add(megaHorn);
        }
        return group;
      }

      // Epoch 6+ (Orbital / Star): Magma Hover Skull-Crusher Juggernaut
      const juggernautHull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), bloodMat);
      juggernautHull.scale.set(1.25, 0.78, 1.35);
      juggernautHull.position.set(0, baseY + 0.14, -0.04);
      juggernautHull.castShadow = true;
      group.add(juggernautHull);

      const skullTower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), ironMat);
      skullTower.scale.set(1.15, 0.95, 1.1);
      skullTower.position.set(0, baseY + 0.32, -0.06);
      skullTower.castShadow = true;
      group.add(skullTower);

      for (const sx of [-0.26, 0.26]) {
        const hoverSkid = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.66), ironMat);
        hoverSkid.position.set(sx, 0.11, 0);
        group.add(hoverSkid);
        const magmaGlow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.6), glowMat);
        magmaGlow.position.set(sx, 0.07, 0);
        group.add(magmaGlow);
      }

      for (const side of [-1, 1]) {
        const megaHorn = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.44, 5), boneMat);
        megaHorn.rotation.z = -side * 0.65;
        megaHorn.rotation.x = 0.35;
        megaHorn.position.set(side * 0.28, baseY + 0.42, 0.04);
        group.add(megaHorn);

        const prowTusk = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.32, 4), boneMat);
        prowTusk.rotation.x = Math.PI / 2;
        prowTusk.position.set(side * 0.18, baseY + 0.1, 0.44);
        group.add(prowTusk);

        const siegeMortar = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.078, 0.5, 6), glowMat);
        siegeMortar.rotation.x = Math.PI / 2 - 0.08;
        siegeMortar.position.set(side * 0.14, baseY + 0.34, 0.28);
        group.add(siegeMortar);

        const smokestack = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.34, 6), ironMat);
        smokestack.position.set(side * 0.2, baseY + 0.42, -0.28);
        smokestack.rotation.x = -0.3;
        group.add(smokestack);
      }
      if (isStarSiege) {
        const dorsalCannon = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.62, 7), glowMat);
        dorsalCannon.rotation.x = Math.PI / 2;
        dorsalCannon.position.set(0, baseY + 0.52, 0.18);
        group.add(dorsalCannon);
      }
      return group;
    }

    // Human Tank (Industrial WWI Trench Tank -> Atomic Cast-Turret Tank -> Info Composite ERA MBT -> Orbital Hover Railgun -> Star Cosmic Tank)
    const armorMat = new THREE.MeshStandardMaterial({
      color: isOrbitalHover ? 0xe2e8f0 : isInfo ? 0x3b4252 : isAtomic ? 0x4d5d3b : 0x57534e,
      roughness: isOrbitalHover ? 0.24 : isInfo ? 0.34 : isAtomic ? 0.44 : 0.62,
      metalness: isOrbitalHover ? 0.8 : isInfo ? 0.64 : isAtomic ? 0.48 : 0.42,
    });
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(isOrbitalHover ? 0.44 : 0.4, isInfo || isAtomic ? 0.14 : 0.18, isOrbitalHover ? 0.62 : 0.58),
      armorMat,
    );
    hull.position.y = isOrbitalHover ? 0.2 : 0.14;
    hull.castShadow = true;
    group.add(hull);

    const glacis = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.18), trimMat);
    glacis.position.set(0, isOrbitalHover ? 0.2 : 0.14, 0.29);
    glacis.rotation.x = 0.42;
    group.add(glacis);

    if (isOrbitalHover) {
      for (const sx of [-0.24, 0.24]) {
        const ski = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.64), trimMat);
        ski.position.set(sx, 0.12, 0);
        group.add(ski);
        const glowPad = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.025, 0.58), glowMat);
        glowPad.position.set(sx, 0.08, 0);
        group.add(glowPad);
      }
      const turret = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.11, 0.34), bodyMat);
      turret.position.set(0, 0.31, -0.02);
      turret.castShadow = true;
      group.add(turret);
      for (const bx of [-0.06, 0.06]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.46), glowMat);
        rail.position.set(bx, 0.31, 0.3);
        group.add(rail);
      }
      if (isStarSiege) {
        const fusionDome = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), glowMat);
        fusionDome.position.set(0, 0.42, -0.08);
        group.add(fusionDome);
      }
    } else if (isInfo) {
      // Epoch 5 Info: Composite ERA MBT (side skirts, wide angular wedge turret, sensor optics mast, long smoothbore cannon + muzzle brake)
      for (const tx of [-0.21, 0.21]) {
        const tread = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.12, 0.66), tireMat);
        tread.position.set(tx, 0.07, 0);
        group.add(tread);
        const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.62), armorMat);
        skirt.position.set(tx + (tx < 0 ? -0.035 : 0.035), 0.12, 0);
        group.add(skirt);
      }
      const turret = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.36), bodyMat);
      turret.position.set(0, 0.26, -0.02);
      turret.castShadow = true;
      group.add(turret);
      const opticsPod = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.08), glassMat);
      opticsPod.position.set(0.08, 0.34, 0.06);
      group.add(opticsPod);
      for (const sx of [-0.15, 0.15]) {
        const eraCheek = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.2), trimMat);
        eraCheek.position.set(sx, 0.26, 0.04);
        group.add(eraCheek);
      }
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.52, 6), trimMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.26, 0.34);
      group.add(barrel);
      const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.07, 6), tireMat);
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(0, 0.26, 0.59);
      group.add(muzzle);
    } else if (isAtomic) {
      // Epoch 4 Atomic: Rounded Cast-Turret Cold War Tank with cupola & rear fuel drums
      for (const tx of [-0.21, 0.21]) {
        const tread = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.12, 0.62), tireMat);
        tread.position.set(tx, 0.07, 0);
        group.add(tread);
        const fuelDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.16, 7), trimMat);
        fuelDrum.rotation.z = Math.PI / 2;
        fuelDrum.position.set(tx * 0.52, 0.22, -0.28);
        group.add(fuelDrum);
      }
      const castTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.11, 10), bodyMat);
      castTurret.position.set(0, 0.26, 0.01);
      castTurret.castShadow = true;
      group.add(castTurret);
      const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 8), trimMat);
      cupola.position.set(-0.05, 0.33, -0.02);
      group.add(cupola);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.44, 6), trimMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.26, 0.3);
      group.add(barrel);
    } else {
      // Epoch 3 Industrial: Tall WWI Lozenge Trench Tank with side sponsons & twin exhaust pipes
      for (const tx of [-0.22, 0.22]) {
        const tread = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.16, 0.66), tireMat);
        tread.position.set(tx, 0.09, 0);
        group.add(tread);
      }
      const boxTurret = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.24), bodyMat);
      boxTurret.position.set(0, 0.28, -0.02);
      boxTurret.castShadow = true;
      group.add(boxTurret);
      for (const sx of [-0.11, 0.11]) {
        const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.16, 6), trimMat);
        exhaust.position.set(sx, 0.28, -0.24);
        group.add(exhaust);
      }
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.3, 6), trimMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.28, 0.2);
      group.add(barrel);
    }
    return group;
  }

  if (type === 'passenger_ship') {
    // Evolving Civilian & Transport Ships across Epochs 0..7 and Races (Human, Elf, Orc):
    // Epoch 0: Outrigger Canoe / Leaf-Sail Pirogue / Hide & Bone Log-Raft
    // Epoch 1: Bronze Merchant Coaster / Swan Transport / Horned Outrigger Barge
    // Epoch 2: Medieval Carrack / Elven Trimaran Packet / Orc Longship Transport
    // Epoch 3: Side-Wheel Steam Ferry / Aether-Wheel Riverboat / Iron-Paddle Coal Ferry
    // Epoch 4: Twin-Deck Car & Passenger Ferry / Hydrofoil Catamaran / Armored Troop Transport Ferry
    // Epoch 5: Multi-Deck Luxury Cruise Ship / Solar-Sail Eco Cruise Liner / Heavy Steel Mega-Transport
    // Epoch 6+: Orbital/Star Anti-Grav Luxury Star-Liner
    const isPrehistoricRaft = epochLevel <= 0;
    const isBronzeBoat = epochLevel === 1;
    const isMedievalShip = epochLevel === 2;
    const isSteamFerry = epochLevel === 3;
    const isModernFerry = epochLevel === 4;
    const isCruiseShip = epochLevel === 5;
    const isStarLiner = epochLevel >= 6;

    if (isPrehistoricRaft) {
      const woodColor = isElf ? 0xc8b88a : isOrc ? 0x4a2c18 : 0x7c5334;
      const logMat = new THREE.MeshStandardMaterial({ color: woodColor, roughness: 0.85 });
      const sailMat = new THREE.MeshStandardMaterial({
        color: isElf ? 0x52b788 : isOrc ? 0x9b2226 : 0xe9c46a,
        roughness: 0.78,
        side: THREE.DoubleSide,
      });
      for (let li = -2; li <= 2; li++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.76, 6), logMat);
        log.rotation.x = Math.PI / 2;
        log.position.set(li * 0.075, 0.08, 0);
        log.castShadow = true;
        group.add(log);
      }
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.48, 5), logMat);
      mast.position.set(0, 0.32, 0.04);
      group.add(mast);
      const sail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.025), sailMat);
      sail.position.set(0, 0.36, 0.06);
      group.add(sail);
      if (isElf) {
        const outrigger = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.68, 5), logMat);
        outrigger.rotation.x = Math.PI / 2;
        outrigger.position.set(0.32, 0.07, 0);
        group.add(outrigger);
        const spar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.025, 0.04), logMat);
        spar.position.set(0.16, 0.1, 0);
        group.add(spar);
      } else if (isOrc) {
        const boneMat = new THREE.MeshStandardMaterial({ color: 0xe5dec9, roughness: 0.7 });
        for (const sx of [-0.14, 0.14]) {
          const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.18, 4), boneMat);
          tusk.rotation.x = Math.PI * 0.38;
          tusk.position.set(sx, 0.14, 0.42);
          group.add(tusk);
        }
      }
      return group;
    }

    if (isBronzeBoat || isMedievalShip) {
      const hullColor = isElf ? 0xf4e4c1 : isOrc ? 0x3b1d0e : 0x6b442a;
      const hullMat = new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.65 });
      const sailMat = new THREE.MeshStandardMaterial({
        color: isElf ? 0xb8f2e6 : isOrc ? 0xb91c1c : 0xfef3c7,
        roughness: 0.6,
        side: THREE.DoubleSide,
      });
      const hullLen = isMedievalShip ? 1.02 : 0.86;
      const hull = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, hullLen * 0.68), hullMat);
      hull.position.y = 0.1;
      hull.castShadow = true;
      group.add(hull);

      const bow = new THREE.Mesh(new THREE.ConeGeometry(0.22, hullLen * 0.34, 4), hullMat);
      bow.rotation.x = Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.position.set(0, 0.12, hullLen * 0.42);
      group.add(bow);

      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, isMedievalShip ? 0.18 : 0.12, 0.32),
        bodyMat,
      );
      cabin.position.set(0, 0.24, -0.18);
      group.add(cabin);

      const masts = isMedievalShip ? [-0.12, 0.18] : [0.05];
      for (const mz of masts) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.66, 6), trimMat);
        mast.position.set(0, 0.44, mz);
        group.add(mast);
        const sail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.03), sailMat);
        sail.position.set(0, 0.48, mz + 0.02);
        group.add(sail);
      }
      if (isElf) {
        // Sleek twin trimaran outriggers
        for (const side of [-1, 1]) {
          const ama = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, hullLen * 0.72), hullMat);
          ama.position.set(side * 0.32, 0.09, 0.02);
          group.add(ama);
        }
      } else if (isOrc) {
        // War-ram & iron side bucklers
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 4), trimMat);
        spike.rotation.x = Math.PI / 2;
        spike.position.set(0, 0.14, hullLen * 0.62);
        group.add(spike);
      } else {
        // Human raised forecastle
        const forecastle = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.2), bodyMat);
        forecastle.position.set(0, 0.2, hullLen * 0.22);
        group.add(forecastle);
      }
      return group;
    }

    if (isSteamFerry) {
      // Epoch 3 Industrial: Side-Wheel Paddle Steamer Ferry / Elf Aether Riverboat / Orc Iron-Paddle Coal Ferry
      const hullMat = new THREE.MeshStandardMaterial({
        color: isElf ? 0x2ec4b6 : isOrc ? 0x3f3f46 : 0x334155,
        roughness: 0.5,
        metalness: 0.35,
      });
      const deckHouseMat = new THREE.MeshStandardMaterial({
        color: isElf ? 0xfefae0 : isOrc ? 0x7f1d1d : 0xf8fafc,
        roughness: 0.45,
      });
      const hull = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 1.08), hullMat);
      hull.position.y = 0.1;
      hull.castShadow = true;
      group.add(hull);

      const promenade = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.78), deckHouseMat);
      promenade.position.set(0, 0.26, -0.02);
      promenade.castShadow = true;
      group.add(promenade);

      const wheelhouse = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.22), deckHouseMat);
      wheelhouse.position.set(0, 0.4, 0.16);
      group.add(wheelhouse);

      if (isOrc) {
        // Twin smoky iron stacks + angular armored ram prow
        for (const sx of [-0.1, 0.1]) {
          const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.36, 7), tireMat);
          stack.position.set(sx, 0.49, -0.14);
          group.add(stack);
        }
        const ram = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 4), trimMat);
        ram.rotation.x = Math.PI / 2;
        ram.position.set(0, 0.12, 0.64);
        group.add(ram);
      } else if (isElf) {
        // Arched golden canopy ribs & stern crystal lantern
        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32, 6), glowMat);
        spire.position.set(0, 0.52, -0.2);
        group.add(spire);
        for (const side of [-1, 1]) {
          const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.56), trimMat);
          fin.position.set(side * 0.23, 0.24, 0.04);
          group.add(fin);
        }
      } else {
        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.34, 8), tireMat);
        funnel.position.set(0, 0.48, -0.1);
        group.add(funnel);
      }

      for (const side of [-1, 1]) {
        const paddleWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.09, 8), taillightMat);
        paddleWheel.rotation.z = Math.PI / 2;
        paddleWheel.position.set(side * 0.26, 0.14, 0);
        paddleWheel.name = 'spin_prop';
        group.add(paddleWheel);
      }
      return group;
    }

    if (isModernFerry) {
      // Epoch 4 Atomic: Twin-Deck Roll-On/Roll-Off Ferry (or Elf Hydrofoil Catamaran / Orc Armored Troop Ferry)
      const hullMat = new THREE.MeshStandardMaterial({
        color: isElf ? 0x0d9488 : isOrc ? 0x27272a : 0x1d4ed8,
        roughness: 0.38,
        metalness: 0.45,
      });
      const superMat = new THREE.MeshStandardMaterial({
        color: isOrc ? 0x52525b : 0xf8fafc,
        roughness: 0.32,
      });
      const hull = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 1.18), hullMat);
      hull.position.y = 0.11;
      hull.castShadow = true;
      group.add(hull);

      const deck1 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.94), superMat);
      deck1.position.set(0, 0.26, -0.02);
      group.add(deck1);

      const winStrip = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.88), glassMat);
      winStrip.position.set(0, 0.28, -0.02);
      group.add(winStrip);

      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.11, 0.36), superMat);
      bridge.position.set(0, 0.38, 0.16);
      group.add(bridge);

      const funnel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.18), bodyMat);
      funnel.position.set(0, 0.42, -0.24);
      funnel.rotation.x = -0.18;
      group.add(funnel);

      if (isElf) {
        for (const side of [-1, 1]) {
          const foil = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.84), glowMat);
          foil.position.set(side * 0.3, 0.09, 0);
          group.add(foil);
        }
      } else if (isOrc) {
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.07), trimMat);
        ramp.position.set(0, 0.16, 0.62);
        ramp.rotation.x = 0.24;
        group.add(ramp);
      }
      return group;
    }

    // Epoch 5 (Cruise Ship) & Epoch 6+ (Anti-Grav Star-Liner):
    // Multi-tiered ocean cruise liner with wrap-around glass promenade decks, lido pool deck, radar arch & sleek bow
    const hullMat = new THREE.MeshStandardMaterial({
      color: isStarLiner ? 0xe0f2fe : isElf ? 0xe6fcf5 : isOrc ? 0x18181b : 0xffffff,
      roughness: 0.24,
      metalness: isStarLiner ? 0.65 : 0.25,
    });
    const hullLen = isStarLiner ? 1.42 : 1.32;
    const baseHull = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.2, hullLen * 0.72), hullMat);
    baseHull.position.y = 0.12;
    baseHull.castShadow = true;
    group.add(baseHull);

    const bowCone = new THREE.Mesh(new THREE.ConeGeometry(0.26, hullLen * 0.34, 4), hullMat);
    bowCone.rotation.x = Math.PI / 2;
    bowCone.rotation.y = Math.PI / 4;
    bowCone.position.set(0, 0.14, hullLen * 0.44);
    group.add(bowCone);

    // 3 stepped luxury passenger cabin tiers + panoramic glass bands
    for (let tier = 0; tier < 3; tier++) {
      const tLen = (hullLen * 0.68) * (1 - tier * 0.14);
      const tWidth = 0.44 - tier * 0.04;
      const tY = 0.26 + tier * 0.11;
      const tierBox = new THREE.Mesh(new THREE.BoxGeometry(tWidth, 0.09, tLen), hullMat);
      tierBox.position.set(0, tY, -0.04);
      tierBox.castShadow = true;
      group.add(tierBox);

      const glassBand = new THREE.Mesh(
        new THREE.BoxGeometry(tWidth + 0.015, 0.04, tLen * 0.94),
        isStarLiner ? glowMat : glassMat,
      );
      glassBand.position.set(0, tY + 0.01, -0.04);
      group.add(glassBand);
    }

    // Lido deck turquoise swimming pool & iconic swept cruise funnel
    const pool = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.02, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
    );
    pool.position.set(0, 0.54, 0.08);
    group.add(pool);

    const cruiseFunnel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.24), bodyMat);
    cruiseFunnel.position.set(0, 0.6, -0.24);
    cruiseFunnel.rotation.x = -0.24;
    group.add(cruiseFunnel);

    if (isElf) {
      for (const side of [-1, 1]) {
        const wingSail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.56), glowMat);
        wingSail.position.set(side * 0.27, 0.38, -0.08);
        wingSail.rotation.z = -side * 0.28;
        group.add(wingSail);
      }
    } else if (isOrc) {
      const prowArmour = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.28), trimMat);
      prowArmour.position.set(0, 0.22, hullLen * 0.34);
      group.add(prowArmour);
    }

    if (isStarLiner) {
      for (const ox of [-0.3, 0.3]) {
        const hoverPod = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.92), glowMat);
        hoverPod.position.set(ox, 0.08, -0.02);
        group.add(hoverPod);
      }
    }
    return group;
  }

  if (type === 'warship') {
    const isBronzeGalley = epochLevel <= 1;
    const isMedievalGalleon = epochLevel === 2;
    const isIronclad = epochLevel === 3;
    const isAtomicDestroyer = epochLevel === 4;
    const isInfoStealthShip = epochLevel === 5;
    const isOrbitalCruiser = epochLevel >= 6;
    const isStarDreadnought = epochLevel >= 7;

    if (isElf) {
      // Elf Swanships (1 Bronze / 2 Medieval) -> Aether-Sloop (3) -> Wave-Runner (4) -> Stealth Crescent Frigate (5) -> Star-Seraph Cruiser (6+)
      const hullMat = new THREE.MeshStandardMaterial({
        color: isOrbitalCruiser ? 0xe0fbfc : isInfoStealthShip ? 0x115e59 : isIronclad || isAtomicDestroyer ? 0x2ec4b6 : 0xf4e4c1,
        roughness: isOrbitalCruiser ? 0.22 : 0.42,
        metalness: isOrbitalCruiser ? 0.68 : isInfoStealthShip ? 0.52 : 0.28,
      });
      const hullLen = isOrbitalCruiser ? 1.44 : isInfoStealthShip || isAtomicDestroyer ? 1.28 : isIronclad ? 1.18 : 1.08;
      const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, hullLen * 0.72, 8), hullMat);
      spine.rotation.x = Math.PI / 2;
      spine.scale.set(1.25, 0.62, 1);
      spine.position.y = 0.12;
      spine.castShadow = true;
      group.add(spine);

      const swanProw = new THREE.Mesh(new THREE.ConeGeometry(0.12, hullLen * 0.38, 6), trimMat);
      swanProw.rotation.x = Math.PI / 2 - 0.18;
      swanProw.position.set(0, 0.2, hullLen * 0.44);
      group.add(swanProw);

      if (isBronzeGalley || isMedievalGalleon) {
        const sailMat = new THREE.MeshStandardMaterial({ color: 0xb8f2e6, roughness: 0.48, side: THREE.DoubleSide });
        const masts = isMedievalGalleon ? [-0.14, 0.18] : [0.02];
        for (const mz of masts) {
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.032, isMedievalGalleon ? 0.86 : 0.72, 6), trimMat);
          mast.position.set(0, 0.52, mz);
          group.add(mast);
          const lateenSail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 3), sailMat);
          lateenSail.scale.set(0.18, 1, 1.3);
          lateenSail.position.set(0, 0.56, mz);
          lateenSail.castShadow = true;
          group.add(lateenSail);
        }
        if (isBronzeGalley) {
          for (const ox of [-0.24, 0.24]) {
            for (const oz of [-0.16, 0.08]) {
              const leafOar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.03), trimMat);
              leafOar.position.set(ox, 0.08, oz);
              leafOar.rotation.z = ox < 0 ? 0.3 : -0.3;
              group.add(leafOar);
            }
          }
        } else {
          const lanternPavilion = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), glowMat);
          lanternPavilion.position.set(0, 0.34, -hullLen * 0.36);
          group.add(lanternPavilion);
        }
        const sternWings = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.24), trimMat);
        sternWings.position.set(0, 0.22, -hullLen * 0.34);
        group.add(sternWings);
      } else if (isIronclad) {
        for (const ox of [-0.26, 0.26]) {
          const pontoon = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.82, 7), hullMat);
          pontoon.rotation.x = Math.PI / 2;
          pontoon.position.set(ox, 0.1, -0.02);
          group.add(pontoon);
          const brace = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.14), trimMat);
          brace.position.set(ox * 0.5, 0.18, 0);
          group.add(brace);
        }
        const spireTower = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.48, 6), bodyMat);
        spireTower.position.set(0, 0.38, -0.04);
        group.add(spireTower);
        const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), glowMat);
        beacon.position.set(0, 0.64, -0.04);
        group.add(beacon);
      } else if (isAtomicDestroyer) {
        // Epoch 4 Atomic: Wave-Runner Destroyer with twin outriggers & dual sun-lance turrets fore & aft
        for (const ox of [-0.26, 0.26]) {
          const foilHull = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.88), hullMat);
          foilHull.position.set(ox, 0.13, -0.02);
          group.add(foilHull);
        }
        const archSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.34, 6), bodyMat);
        archSpire.position.set(0, 0.32, 0);
        group.add(archSpire);
        for (const [tz, dir] of [
          [0.34, 1],
          [-0.34, -1],
        ] as const) {
          const domeTurret = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 7), trimMat);
          domeTurret.position.set(0, 0.23, tz);
          group.add(domeTurret);
          const gunSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.26, 6), glowMat);
          gunSpire.rotation.x = Math.PI / 2;
          gunSpire.position.set(0, 0.24, tz + dir * 0.16);
          group.add(gunSpire);
        }
      } else if (isInfoStealthShip) {
        // Epoch 5 Info: Stealth Crescent Aegis Frigate with swept crystal fins & spinning astrolabe ring
        for (const ox of [-0.3, 0.3]) {
          const sweptBlade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.96), trimMat);
          sweptBlade.position.set(ox, 0.15, -0.06);
          sweptBlade.rotation.y = ox < 0 ? 0.16 : -0.16;
          group.add(sweptBlade);
          const crystalFin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.44), glowMat);
          crystalFin.position.set(ox * 0.95, 0.26, -0.14);
          group.add(crystalFin);
        }
        const aegisPyramid = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 4), hullMat);
        aegisPyramid.position.set(0, 0.34, 0.02);
        group.add(aegisPyramid);
        const astroRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.024, 6, 12), glowMat);
        astroRing.name = 'spin_rotor';
        astroRing.position.set(0, 0.54, 0.02);
        group.add(astroRing);
      } else {
        // Epoch 6+ (Orbital / Star): Sylvan Aegis Plasma Trimaran Cruiser
        for (const ox of [-0.3, 0.3]) {
          const foilHull = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.96), trimMat);
          foilHull.position.set(ox, 0.14, -0.04);
          group.add(foilHull);
          const crystalFin = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.2, 0.46), glowMat);
          crystalFin.position.set(ox, 0.25, -0.14);
          group.add(crystalFin);
        }
        const spireBridge = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, 0.4, 6), hullMat);
        spireBridge.position.set(0, 0.34, -0.08);
        group.add(spireBridge);
        const astroRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.024, 6, 12), glowMat);
        astroRing.name = 'spin_rotor';
        astroRing.position.set(0, 0.56, -0.08);
        group.add(astroRing);
        const starLance = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.04, 0.54, 6), glowMat);
        starLance.rotation.x = Math.PI / 2;
        starLance.position.set(0, 0.26, 0.5);
        group.add(starLance);
        if (isStarDreadnought) {
          for (const px of [-0.42, 0.42]) {
            const pylon = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), glowMat);
            pylon.scale.set(0.65, 2.1, 0.65);
            pylon.position.set(px, 0.34, 0.08);
            group.add(pylon);
          }
        }
      }
      return group;
    }

    if (isOrc) {
      // Orc Warships:
      // 1: Bone-Ram Raft-Galley -> 2: Brute War-Hulk -> 3: Ironclad Steam-Krusha -> 4: Big-Gun Iron Barge -> 5: Missile-Jaw Dreadnought -> 6+: Plasma Iron-Jaw Cruiser
      const hullMat = new THREE.MeshStandardMaterial({
        color: isOrbitalCruiser ? 0x18181b : isInfoStealthShip ? 0x27272a : isAtomicDestroyer ? 0x3f3f46 : 0x451a03,
        roughness: 0.56,
        metalness: epochLevel >= 3 ? 0.72 : 0.24,
      });
      const hullLen = isOrbitalCruiser ? 1.4 : isInfoStealthShip || isAtomicDestroyer ? 1.28 : isIronclad ? 1.2 : 1.1;
      const barge = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, hullLen * 0.72), hullMat);
      barge.position.y = 0.12;
      barge.castShadow = true;
      group.add(barge);

      const ramJaw = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.26), bodyMat);
      ramJaw.position.set(0, 0.12, hullLen * 0.42);
      group.add(ramJaw);
      for (const tx of [-0.14, 0, 0.14]) {
        const ramSpike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 4), trimMat);
        ramSpike.rotation.x = Math.PI / 2;
        ramSpike.position.set(tx, 0.12, hullLen * 0.56);
        group.add(ramSpike);
      }

      if (isBronzeGalley || isMedievalGalleon) {
        const sailMat = new THREE.MeshStandardMaterial({ color: 0x9b2226, roughness: 0.72, side: THREE.DoubleSide });
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.045, 0.74, 6), trimMat);
        mast.position.set(0, 0.5, 0);
        group.add(mast);
        const warSail = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.34, 0.035), sailMat);
        warSail.position.set(0, 0.54, 0.03);
        group.add(warSail);
        if (isBronzeGalley) {
          for (const ox of [-0.28, 0.28]) {
            for (const oz of [-0.16, 0.08]) {
              const spikedOar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.032), hullMat);
              spikedOar.position.set(ox, 0.08, oz);
              spikedOar.rotation.z = ox < 0 ? 0.32 : -0.32;
              group.add(spikedOar);
            }
          }
        } else {
          const foreMast = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, 0.56, 6), trimMat);
          foreMast.position.set(0, 0.4, 0.26);
          group.add(foreMast);
          const foreSail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.035), sailMat);
          foreSail.position.set(0, 0.44, 0.28);
          group.add(foreSail);
          const rearBastion = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.26), bodyMat);
          rearBastion.position.set(0, 0.3, -0.32);
          group.add(rearBastion);
        }
      } else if (isIronclad) {
        const ironCitadel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.56), trimMat);
        ironCitadel.position.set(0, 0.3, -0.04);
        group.add(ironCitadel);
        for (const sz of [-0.2, 0.02, 0.22]) {
          const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 0.3, 6), tireMat);
          stack.position.set(0, 0.48, sz);
          group.add(stack);
        }
        for (const cx of [-0.26, 0.26]) {
          const sideCannon = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.16, 6), trimMat);
          sideCannon.rotation.z = Math.PI / 2;
          sideCannon.position.set(cx, 0.22, 0.06);
          group.add(sideCannon);
        }
      } else if (isAtomicDestroyer) {
        // Epoch 4 Atomic: Heavy Big-Gun Iron Barge with dual heavy turrets + twin angled funnels
        const gunBunker = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.34), bodyMat);
        gunBunker.position.set(0, 0.32, -0.06);
        group.add(gunBunker);
        for (const fx of [-0.12, 0.12]) {
          const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.06, 0.28, 6), tireMat);
          funnel.position.set(fx, 0.46, -0.18);
          funnel.rotation.x = -0.2;
          group.add(funnel);
        }
        for (const [tz, dir] of [
          [0.24, 1],
          [-0.36, -1],
        ] as const) {
          const turret = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.22), trimMat);
          turret.position.set(0, 0.27, tz);
          group.add(turret);
          for (const bx of [-0.05, 0.05]) {
            const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.034, 0.34, 6), trimMat);
            gun.rotation.x = Math.PI / 2;
            gun.position.set(bx, 0.28, tz + dir * 0.2);
            group.add(gun);
          }
        }
      } else if (isInfoStealthShip) {
        // Epoch 5 Info: Missile-Spiked Dreadnought (VLS rocket racks + horned skull tower + spin_rotor radar cross)
        const fortTower = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.34), bodyMat);
        fortTower.position.set(0, 0.34, -0.12);
        fortTower.castShadow = true;
        group.add(fortTower);
        const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.05), glowMat);
        beacon.position.set(0, 0.52, -0.12);
        beacon.name = 'spin_rotor';
        group.add(beacon);
        for (const vx of [-0.14, 0.14]) {
          const missileRack = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.32), trimMat);
          missileRack.position.set(vx, 0.26, 0.24);
          missileRack.rotation.x = -0.25;
          group.add(missileRack);
        }
        const sternTurret = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.2), trimMat);
        sternTurret.position.set(0, 0.26, -0.36);
        group.add(sternTurret);
      } else {
        // Epoch 6+ (Orbital / Star): Orc Magma Plasma Kroozer
        const fortTower = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.38), bodyMat);
        fortTower.position.set(0, 0.35, -0.14);
        fortTower.castShadow = true;
        group.add(fortTower);
        const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.045, 0.06), glowMat);
        beacon.position.set(0, 0.54, -0.14);
        beacon.name = 'spin_rotor';
        group.add(beacon);
        for (const tx of [0.22, -0.32]) {
          const gunTurret = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.2), trimMat);
          gunTurret.position.set(0, 0.26, tx);
          group.add(gunTurret);
          const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.38, 6), glowMat);
          cannon.rotation.x = Math.PI / 2;
          cannon.position.set(0, 0.27, tx + (tx > 0 ? 0.22 : -0.22));
          group.add(cannon);
        }
        for (const px of [-0.3, 0.3]) {
          const sponson = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.74), glowMat);
          sponson.position.set(px, 0.15, 0);
          group.add(sponson);
        }
        if (isStarDreadnought) {
          for (const bx of [-0.14, 0.14]) {
            const extraBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.56, 6), glowMat);
            extraBarrel.rotation.x = Math.PI / 2;
            extraBarrel.position.set(bx, 0.44, 0.16);
            group.add(extraBarrel);
          }
        }
      }
      return group;
    }

    // Human Warships (1 Bronze Galley -> 2 Sailing Galleon -> 3 Ironclad -> 4 Gun Destroyer -> 5 Stealth Missile Destroyer -> 6 Trimaran Cruiser -> 7 Fleet Dreadnought)
    const hullMat = new THREE.MeshStandardMaterial({
      color: isOrbitalCruiser
        ? 0xe2e8f0
        : isInfoStealthShip
          ? 0x475569
          : isAtomicDestroyer
            ? 0x64748b
            : isIronclad
              ? 0x334155
              : 0x5c3d2e,
      roughness: isOrbitalCruiser ? 0.24 : epochLevel >= 3 ? 0.42 : 0.64,
      metalness: isOrbitalCruiser ? 0.78 : epochLevel >= 3 ? 0.62 : 0.12,
    });
    const deckMat = new THREE.MeshStandardMaterial({
      color: isOrbitalCruiser ? 0x334155 : isInfoStealthShip ? 0x1e293b : isAtomicDestroyer ? 0x475569 : isIronclad ? 0x1e293b : 0x8d5b4c,
      roughness: 0.68,
      metalness: epochLevel >= 3 ? 0.35 : 0.05,
    });

    const hullLen = isOrbitalCruiser ? 1.42 : isInfoStealthShip || isAtomicDestroyer ? 1.28 : isIronclad ? 1.18 : 1.08;
    const waist = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, hullLen * 0.62), hullMat);
    waist.position.y = 0.11;
    waist.castShadow = true;
    group.add(waist);

    const deckPlank = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, hullLen * 0.66), deckMat);
    deckPlank.position.y = 0.215;
    group.add(deckPlank);

    for (const gx of [-0.195, 0.195]) {
      const gunwale = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, hullLen * 0.62), trimMat);
      gunwale.position.set(gx, 0.23, 0);
      group.add(gunwale);
    }

    const bowHull = new THREE.Mesh(new THREE.ConeGeometry(0.24, hullLen * 0.36, 4), hullMat);
    bowHull.rotation.x = Math.PI / 2;
    bowHull.rotation.y = Math.PI / 4;
    bowHull.scale.set(1.15, 0.72, 1);
    bowHull.position.set(0, 0.12, hullLen * 0.38);
    bowHull.castShadow = true;
    group.add(bowHull);

    const sternHull = new THREE.Mesh(new THREE.ConeGeometry(0.22, hullLen * 0.26, 4), hullMat);
    sternHull.rotation.x = -Math.PI / 2;
    sternHull.rotation.y = Math.PI / 4;
    sternHull.scale.set(1.1, 0.75, 1);
    sternHull.position.set(0, 0.12, -hullLen * 0.36);
    group.add(sternHull);

    if (isBronzeGalley || isMedievalGalleon) {
      if (isBronzeGalley) {
        const ram = new THREE.Mesh(
          new THREE.ConeGeometry(0.085, 0.24, 5),
          new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.75 }),
        );
        ram.rotation.x = Math.PI / 2;
        ram.position.set(0, 0.09, hullLen * 0.56);
        group.add(ram);
      } else {
        const bowsprit = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.028, 0.42, 6), trimMat);
        bowsprit.rotation.x = Math.PI / 2 - 0.25;
        bowsprit.position.set(0, 0.25, hullLen * 0.52);
        group.add(bowsprit);
      }

      const sternCastle = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, isMedievalGalleon ? 0.22 : 0.12, 0.32),
        hullMat,
      );
      sternCastle.position.set(0, isMedievalGalleon ? 0.29 : 0.22, -0.32);
      sternCastle.castShadow = true;
      group.add(sternCastle);

      const sailMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.68, side: THREE.DoubleSide });
      const mastOffsets = isMedievalGalleon ? [-0.14, 0.18] : [0.04];
      for (const mz of mastOffsets) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.034, isMedievalGalleon ? 0.78 : 0.68, 6), trimMat);
        mast.position.set(0, 0.54, mz);
        group.add(mast);

        const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, mz > 0 ? 0.52 : 0.42, 5), trimMat);
        yard.rotation.z = Math.PI / 2;
        yard.position.set(0, 0.72, mz + 0.02);
        group.add(yard);

        const sailRadius = mz > 0 ? 0.24 : 0.2;
        const sailSheet = new THREE.Mesh(
          new THREE.CylinderGeometry(sailRadius, sailRadius, 0.36, 8, 1, true, -Math.PI * 0.42, Math.PI * 0.84),
          sailMat,
        );
        sailSheet.rotation.y = Math.PI / 2;
        sailSheet.scale.set(0.35, 1, 1.15);
        sailSheet.position.set(0, 0.54, mz + 0.02);
        sailSheet.castShadow = true;
        group.add(sailSheet);

        const pennant = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.14), bodyMat);
        pennant.position.set(0, isMedievalGalleon ? 0.91 : 0.86, mz - 0.06);
        group.add(pennant);
      }

      if (isBronzeGalley) {
        for (const ox of [-0.26, 0.26]) {
          for (const oz of [-0.18, 0.0, 0.18]) {
            const oar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.026), hullMat);
            oar.position.set(ox, 0.08, oz);
            oar.rotation.z = ox < 0 ? 0.32 : -0.32;
            group.add(oar);
            const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.015, 8), bodyMat);
            shield.rotation.z = Math.PI / 2;
            shield.position.set(ox * 0.82, 0.18, oz);
            group.add(shield);
          }
        }
      } else {
        for (const cx of [-0.21, 0.21]) {
          for (const cz of [-0.1, 0.08]) {
            const portGun = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.08, 5), tireMat);
            portGun.rotation.z = Math.PI / 2;
            portGun.position.set(cx, 0.16, cz);
            group.add(portGun);
          }
        }
      }
    } else if (isIronclad) {
      const casemate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.44), hullMat);
      casemate.position.set(0, 0.28, -0.04);
      casemate.castShadow = true;
      group.add(casemate);
      const bridgeTower = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.18), bodyMat);
      bridgeTower.position.set(0, 0.41, 0.08);
      group.add(bridgeTower);
      for (const sz of [-0.2, -0.02]) {
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.056, 0.3, 8), tireMat);
        stack.position.set(0, 0.46, sz);
        stack.rotation.x = -0.14;
        group.add(stack);
        const stackBand = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.05, 8), taillightMat);
        stackBand.position.set(0, 0.56, sz - 0.02);
        stackBand.rotation.x = -0.14;
        group.add(stackBand);
      }
      for (const [tz, dir] of [
        [0.3, 1],
        [-0.36, -1],
      ] as const) {
        const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.09, 8), trimMat);
        turret.position.set(0, 0.26, tz);
        group.add(turret);
        for (const bx of [-0.032, 0.032]) {
          const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.26, 6), trimMat);
          cannon.rotation.x = Math.PI / 2;
          cannon.position.set(bx, 0.27, tz + dir * 0.16);
          group.add(cannon);
        }
      }
    } else if (isAtomicDestroyer) {
      // Epoch 4 Atomic: Classic Twin-Funnel WW2/Cold-War Gun Destroyer with Fore & Aft Dual Turrets
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.28), bodyMat);
      bridge.position.set(0, 0.31, 0.08);
      bridge.castShadow = true;
      group.add(bridge);
      const bridgeWindow = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.045, 0.1), glassMat);
      bridgeWindow.position.set(0, 0.37, 0.16);
      group.add(bridgeWindow);

      const radarMast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.038, 0.26, 6), trimMat);
      radarMast.position.set(0, 0.52, 0.06);
      group.add(radarMast);
      const radarBar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.04), glowMat);
      radarBar.position.set(0, 0.65, 0.06);
      radarBar.name = 'spin_rotor';
      group.add(radarBar);

      for (const fz of [-0.06, -0.22]) {
        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.052, 0.2, 7), tireMat);
        funnel.position.set(0, 0.32, fz);
        funnel.rotation.x = -0.15;
        group.add(funnel);
      }

      for (const [tz, dir] of [
        [0.36, 1],
        [-0.4, -1],
      ] as const) {
        const gunTurret = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.16), trimMat);
        gunTurret.position.set(0, 0.25, tz);
        group.add(gunTurret);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.28, 6), trimMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.26, tz + dir * 0.16);
        group.add(barrel);
      }
    } else if (isInfoStealthShip) {
      // Epoch 5 Info: Stealth Aegis Guided-Missile Destroyer (faceted integrated tower, VLS cell deck, single stealth turret, rear helipad)
      const stealthSuper = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.32, 4), bodyMat);
      stealthSuper.rotation.y = Math.PI / 4;
      stealthSuper.position.set(0, 0.35, 0.04);
      stealthSuper.castShadow = true;
      group.add(stealthSuper);
      const aegisWindow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.14), glassMat);
      aegisWindow.position.set(0, 0.35, 0.14);
      group.add(aegisWindow);

      const radarBar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.032, 0.045), glowMat);
      radarBar.position.set(0, 0.54, 0.04);
      radarBar.name = 'spin_rotor';
      group.add(radarBar);

      const vlsDeck = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.22), trimMat);
      vlsDeck.position.set(0, 0.24, 0.28);
      group.add(vlsDeck);
      const bowTurret = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.16), bodyMat);
      bowTurret.position.set(0, 0.25, 0.45);
      group.add(bowTurret);
      const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.24, 6), trimMat);
      cannon.rotation.x = Math.PI / 2;
      cannon.position.set(0, 0.26, 0.57);
      group.add(cannon);

      const helipad = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.12, 12), headlightMat);
      helipad.rotation.x = -Math.PI / 2;
      helipad.position.set(0, 0.235, -0.36);
      group.add(helipad);
    } else {
      // Epoch 6+ (Orbital / Star): Trimaran Plasma Cruiser / Fleet Dreadnought
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.42), trimMat);
      bridge.position.set(0, 0.32, -0.06);
      bridge.castShadow = true;
      group.add(bridge);
      const bridgeGlass = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.065, 0.26), glassMat);
      bridgeGlass.position.set(0, 0.38, 0.02);
      group.add(bridgeGlass);
      const sensorRing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.05), glowMat);
      sensorRing.position.set(0, 0.5, -0.06);
      sensorRing.name = 'spin_rotor';
      group.add(sensorRing);
      for (const ox of [-0.28, 0.28]) {
        const outrigger = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.075, 0.88), trimMat);
        outrigger.position.set(ox, 0.14, -0.04);
        group.add(outrigger);
        const repulsor = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.028, 0.8), glowMat);
        repulsor.position.set(ox, 0.08, -0.04);
        group.add(repulsor);
        if (isStarDreadnought) {
          const wingFin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.36), bodyMat);
          wingFin.position.set(ox * 1.1, 0.24, -0.2);
          group.add(wingFin);
        }
      }
      for (const rx of [-0.055, 0.055]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.48, 6), glowMat);
        rail.rotation.x = Math.PI / 2;
        rail.position.set(rx, 0.28, 0.44);
        group.add(rail);
      }
      if (isStarDreadnought) {
        const haloDish = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 6, 14), glowMat);
        haloDish.position.set(0, 0.56, -0.06);
        haloDish.rotation.x = Math.PI / 3;
        group.add(haloDish);
      }
    }
    return group;
  }

  if (type === 'airship') {
    const isRigidZeppelin = epochLevel >= 3 && epochLevel < 6;
    const isIonCruiser = epochLevel >= 6;

    if (isElf) {
      // Elf Sylvan Solar Dirigible (Epoch 3+: arched silk-and-crystal envelope, sweeping gold sky-fins, crystal lantern bridge + golden wind-props!)
      const ivoryMat = new THREE.MeshStandardMaterial({
        color: isIonCruiser ? 0xe0fbfc : 0xfefae0,
        roughness: 0.22,
        metalness: isIonCruiser ? 0.65 : 0.32,
      });
      const skyEnvelope = new THREE.Mesh(
        new THREE.CylinderGeometry(isIonCruiser ? 0.2 : 0.17, 0.12, isIonCruiser ? 1.36 : 1.18, 8),
        ivoryMat,
      );
      skyEnvelope.rotation.x = Math.PI / 2;
      skyEnvelope.scale.set(1.15, 0.72, 1);
      skyEnvelope.position.set(0, 0.36, 0);
      skyEnvelope.castShadow = true;
      group.add(skyEnvelope);

      const deckHull = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 1.1, 8), bodyMat);
      deckHull.rotation.x = Math.PI / 2;
      deckHull.scale.set(1.15, 0.58, 1);
      deckHull.position.set(0, 0.15, 0);
      group.add(deckHull);

      const prowSpire = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.36, 6), trimMat);
      prowSpire.rotation.x = Math.PI / 2;
      prowSpire.position.set(0, 0.28, 0.7);
      group.add(prowSpire);

      for (const side of [-1, 1]) {
        const skyFin = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.028, 0.32), trimMat);
        skyFin.position.set(side * 0.34, 0.24, 0.06);
        skyFin.rotation.y = -side * 0.35;
        skyFin.rotation.z = side * 0.24;
        group.add(skyFin);

        const crystalSail = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.02, 0.22), glowMat);
        crystalSail.position.set(side * 0.32, 0.27, 0.04);
        crystalSail.rotation.y = -side * 0.35;
        crystalSail.rotation.z = side * 0.26;
        group.add(crystalSail);

        if (isRigidZeppelin) {
          const vanePod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.22, 6), trimMat);
          vanePod.rotation.x = Math.PI / 2;
          vanePod.position.set(side * 0.32, 0.16, -0.1);
          group.add(vanePod);
          const prop = new THREE.Group();
          prop.name = 'spin_prop';
          prop.position.set(side * 0.32, 0.16, 0.04);
          prop.add(
            new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.028, 0.016), trimMat),
            new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.24, 0.016), trimMat),
          );
          group.add(prop);
        }
      }

      const ringPositions = isIonCruiser ? [-0.34, 0, 0.34] : [-0.22, 0.22];
      for (const rz of ringPositions) {
        const levRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.032, 7, 14), glowMat);
        levRing.position.set(0, 0.34, rz);
        group.add(levRing);
      }

      const lanternBridge = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), glassMat);
      lanternBridge.scale.set(0.9, 1.1, 1.6);
      lanternBridge.position.set(0, 0.22, -0.05);
      group.add(lanternBridge);
      return group;
    }

    if (isOrc) {
      // Orc Waaagh-Blimp / Iron Dirigible / Plasma Sky-Kroozer
      const orcBag = new THREE.MeshStandardMaterial({
        color: isIonCruiser ? 0x27272a : 0x7f1d1d,
        roughness: isIonCruiser ? 0.42 : 0.62,
        metalness: isIonCruiser ? 0.72 : 0.28,
      });
      const balloon = new THREE.Mesh(
        new THREE.CylinderGeometry(isIonCruiser ? 0.31 : 0.29, 0.25, isIonCruiser ? 1.26 : 1.12, 8),
        orcBag,
      );
      balloon.rotation.x = Math.PI / 2;
      balloon.position.set(0, 0.46, 0);
      balloon.castShadow = true;
      group.add(balloon);

      for (const bz of [-0.32, 0, 0.32]) {
        const ironBand = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 8), trimMat);
        ironBand.rotation.x = Math.PI / 2;
        ironBand.position.set(0, 0.46, bz);
        group.add(ironBand);
      }
      const jawNose = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.34, 5), trimMat);
      jawNose.rotation.x = Math.PI / 2;
      jawNose.position.set(0, 0.46, 0.68);
      group.add(jawNose);

      const warGondola = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.68), trimMat);
      warGondola.position.set(0, 0.14, 0.04);
      warGondola.castShadow = true;
      group.add(warGondola);
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.04), glassMat);
      slit.position.set(0, 0.16, 0.39);
      group.add(slit);

      if (isIonCruiser) {
        for (const ex of [-0.32, 0.32]) {
          const magmaPod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.42, 7), glowMat);
          magmaPod.rotation.x = Math.PI / 2;
          magmaPod.position.set(ex, 0.26, -0.06);
          group.add(magmaPod);
        }
      } else if (isRigidZeppelin) {
        for (const ex of [-0.26, 0.26]) {
          const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.3, 6), bodyMat);
          pod.rotation.x = Math.PI / 2;
          pod.position.set(ex, 0.24, -0.08);
          group.add(pod);
          const prop = new THREE.Group();
          prop.name = 'spin_prop';
          prop.position.set(ex, 0.24, 0.1);
          prop.add(
            new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.036, 0.02), headlightMat),
            new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.26, 0.02), headlightMat),
          );
          group.add(prop);
        }
      }
      return group;
    }

    // Human Rigid Zeppelin Dirigible (Epoch 3+) -> Ion Sky-Cruiser (Epoch 6+)
    const bagMat = new THREE.MeshStandardMaterial({
      color: isIonCruiser ? 0xe2e8f0 : isRigidZeppelin ? 0x94a3b8 : 0xf4ecd8,
      roughness: isIonCruiser ? 0.24 : isRigidZeppelin ? 0.36 : 0.68,
      metalness: isIonCruiser ? 0.78 : isRigidZeppelin ? 0.55 : 0.08,
    });
    const envelope = new THREE.Mesh(
      new THREE.CylinderGeometry(isIonCruiser ? 0.28 : 0.26, 0.22, isIonCruiser ? 1.32 : isRigidZeppelin ? 1.24 : 0.96, 10),
      bagMat,
    );
    envelope.rotation.x = Math.PI / 2;
    envelope.position.set(0, 0.44, 0);
    envelope.castShadow = true;
    group.add(envelope);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 8), isIonCruiser ? glassMat : trimMat);
    nose.scale.set(1, 1, 1.25);
    nose.position.set(0, 0.44, isIonCruiser ? 0.64 : isRigidZeppelin ? 0.58 : 0.46);
    group.add(nose);
    const sternCone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.34, 8), bagMat);
    sternCone.rotation.x = -Math.PI / 2;
    sternCone.position.set(0, 0.44, isRigidZeppelin ? -0.74 : -0.62);
    group.add(sternCone);
    const gondola = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, isRigidZeppelin ? 0.66 : 0.44), trimMat);
    gondola.position.set(0, 0.12, 0.04);
    gondola.castShadow = true;
    group.add(gondola);
    const tailV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.38, 0.24), bodyMat);
    tailV.position.set(0, 0.44, isRigidZeppelin ? -0.6 : -0.48);
    group.add(tailV);
    const tailH = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.22), bodyMat);
    tailH.position.set(0, 0.44, isRigidZeppelin ? -0.6 : -0.48);
    group.add(tailH);

    if (isIonCruiser) {
      for (const px of [-0.34, 0.34]) {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.38, 8), trimMat);
        pod.rotation.x = Math.PI / 2;
        pod.position.set(px, 0.28, -0.05);
        group.add(pod);
        const core = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 6), glowMat);
        core.rotation.x = Math.PI / 2;
        core.position.set(px, 0.28, -0.26);
        group.add(core);
      }
      const bellyRing = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.46), glowMat);
      bellyRing.position.set(0, 0.03, 0.02);
      group.add(bellyRing);
    } else if (isRigidZeppelin) {
      for (const px of [-0.3, 0.3]) {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.24, 7), trimMat);
        pod.rotation.x = Math.PI / 2;
        pod.position.set(px, 0.24, 0);
        group.add(pod);
        const prop = new THREE.Group();
        prop.name = 'spin_prop';
        prop.position.set(px, 0.24, 0.14);
        prop.add(
          new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.015), headlightMat),
          new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.015), headlightMat),
        );
        group.add(prop);
      }
    }
    return group;
  }

  if (type === 'orc_flyer') {
    // Orc Deff-Kopter Progression:
    // Epoch 4 (Atomic): Skull-Cauldron Buzzsaw Chopper (iron skull core, jaw trap, bone tusks, 4-cleaver buzzsaw spin_rotor & rear spin_prop)
    // Epoch 5+ (Info): Heavy Turbine Dread-Kopter (stub wings with 6-tube missile pods, twin jet turbine nacelles, 6-blade cleaver rotor, dual chin cannons)
    const isHeavyTurbine = epochLevel >= 5;
    const ironMat = new THREE.MeshStandardMaterial({
      color: isHeavyTurbine ? 0x111827 : 0x18181b,
      roughness: isHeavyTurbine ? 0.38 : 0.62,
      metalness: 0.82,
    });
    const bloodMat = new THREE.MeshStandardMaterial({
      color: isHeavyTurbine ? 0xdc2626 : 0x991b1b,
      roughness: 0.46,
      metalness: 0.34,
    });
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.44 });

    const skullCore = new THREE.Mesh(
      new THREE.DodecahedronGeometry(isHeavyTurbine ? 0.31 : 0.28, 0),
      ironMat,
    );
    skullCore.scale.set(1.22, 1.0, isHeavyTurbine ? 1.55 : 1.35);
    skullCore.position.set(0, 0.25, 0.08);
    skullCore.castShadow = true;
    group.add(skullCore);

    const ironJaw = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.34, 4), bloodMat);
    ironJaw.rotation.x = Math.PI / 2;
    ironJaw.rotation.y = Math.PI / 4;
    ironJaw.position.set(0, 0.14, 0.46);
    group.add(ironJaw);

    for (const sx of [-0.11, 0.11]) {
      const eyeGlow = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), glowMat);
      eyeGlow.position.set(sx, 0.3, 0.38);
      group.add(eyeGlow);
    }

    for (const side of [-1, 1]) {
      const megaTusk = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.46, 5), boneMat);
      megaTusk.rotation.x = Math.PI / 2 - 0.32;
      megaTusk.rotation.y = side * 0.28;
      megaTusk.position.set(side * 0.22, 0.16, 0.56);
      group.add(megaTusk);

      const gatlingDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.5, 6), bloodMat);
      gatlingDrum.rotation.x = Math.PI / 2;
      gatlingDrum.position.set(side * 0.36, 0.22, 0.14);
      group.add(gatlingDrum);

      const exhaustPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.34, 6), ironMat);
      exhaustPipe.position.set(side * 0.26, 0.44, -0.18);
      exhaustPipe.rotation.x = -0.42;
      exhaustPipe.rotation.z = -side * 0.25;
      group.add(exhaustPipe);

      if (isHeavyTurbine) {
        const stubWing = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.26), ironMat);
        stubWing.position.set(side * 0.44, 0.22, 0.04);
        group.add(stubWing);
        const rocketPod = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.44, 6), glowMat);
        rocketPod.rotation.x = Math.PI / 2;
        rocketPod.position.set(side * 0.6, 0.18, 0.12);
        group.add(rocketPod);
        const turbinePod = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.42, 7), bloodMat);
        turbinePod.rotation.x = Math.PI / 2;
        turbinePod.position.set(side * 0.28, 0.36, -0.06);
        group.add(turbinePod);
      }
    }

    const tailChain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.58, 5), ironMat);
    tailChain.rotation.x = Math.PI / 2;
    tailChain.position.set(0, 0.25, -0.46);
    group.add(tailChain);

    const mainRotor = new THREE.Group();
    mainRotor.name = 'spin_rotor';
    mainRotor.position.set(0, 0.56, 0.04);
    const sawRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.032, 5, 10), bloodMat);
    sawRing.rotation.x = Math.PI / 2;
    mainRotor.add(sawRing);
    const bladeCount = isHeavyTurbine ? 6 : 4;
    for (let bi = 0; bi < bladeCount; bi++) {
      const ang = (bi * Math.PI * 2) / bladeCount;
      const cleaverBlade = new THREE.Mesh(new THREE.ConeGeometry(0.14, isHeavyTurbine ? 0.88 : 0.78, 3), ironMat);
      cleaverBlade.rotation.x = Math.PI / 2;
      cleaverBlade.rotation.z = ang;
      cleaverBlade.scale.set(1, 1, 0.22);
      cleaverBlade.position.set(Math.sin(ang) * 0.4, 0, Math.cos(ang) * 0.4);
      mainRotor.add(cleaverBlade);
    }
    group.add(mainRotor);

    const tailRotor = new THREE.Group();
    tailRotor.name = 'spin_prop';
    tailRotor.position.set(0.08, 0.28, -0.74);
    tailRotor.rotation.y = Math.PI / 2;
    const buzzDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.025, 7), bloodMat);
    buzzDisc.rotation.x = Math.PI / 2;
    tailRotor.add(buzzDisc);
    group.add(tailRotor);
    return group;
  }

  if (type === 'bomber_plane') {
    // Fixed-wing Strategic Bomber (Epoch 4 Atomic Prop -> Epoch 5 Info Stealth Jet -> Epoch 6 Orbital Plasma -> Epoch 7 Star Over-Bomber)
    const isAtomicProp = epochLevel <= 4;
    const isStealth = epochLevel === 5;
    const isPlasmaBomber = epochLevel >= 6;
    const isStarBomber = epochLevel >= 7;

    if (isElf) {
      // Elf Aerial Heavy Bombers:
      // 4 (Atomic): Sylvan Twin-Prop Sky-Swan (carved ivory/teal bird-hull + dual golden spin_prop engine pods)
      // 5 (Info): Stealth Crescent Void-Wing (dark emerald/gold razor flying-wing, ZERO props)
      // 6+ (Orbital/Star): Astral Phoenix Star-Bomber (+ glowing sun-orb, forward canards, golden crown halo + Epoch 7 twin plasma lances)
      const hullMat = new THREE.MeshStandardMaterial({
        color: isPlasmaBomber ? 0xd8f3dc : isStealth ? 0x0f766e : 0xfefae0,
        roughness: isPlasmaBomber ? 0.2 : 0.28,
        metalness: isStealth || isPlasmaBomber ? 0.56 : 0.34,
      });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xffb703, roughness: 0.2, metalness: 0.86 });

      const spine = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.065, isPlasmaBomber ? 1.44 : 1.32, 8),
        hullMat,
      );
      spine.rotation.x = Math.PI / 2;
      spine.scale.set(1.2, 0.72, 1);
      spine.position.set(0, 0.24, 0);
      spine.castShadow = true;
      group.add(spine);

      const crystalNose = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), isStealth ? glassMat : glowMat);
      crystalNose.scale.set(0.8, 0.75, 2.2);
      crystalNose.position.set(0, 0.24, 0.74);
      group.add(crystalNose);

      for (const side of [-1, 1]) {
        const innerSwept = new THREE.Mesh(
          new THREE.BoxGeometry(isStealth ? 0.92 : 0.76, 0.038, isStealth ? 0.42 : 0.32),
          hullMat,
        );
        innerSwept.position.set(side * 0.44, 0.24, isStealth ? -0.06 : 0.04);
        innerSwept.rotation.y = -side * (isStealth ? 0.54 : 0.34);
        innerSwept.rotation.z = side * 0.08;
        innerSwept.castShadow = true;
        group.add(innerSwept);

        if (isAtomicProp) {
          // Twin Sylvan Gold-Crystal Propeller Pods
          const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.28, 7), goldMat);
          pod.rotation.x = Math.PI / 2;
          pod.position.set(side * 0.38, 0.22, 0.14);
          group.add(pod);
          const prop = new THREE.Group();
          prop.name = 'spin_prop';
          prop.position.set(side * 0.38, 0.22, 0.3);
          prop.add(
            new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.016), goldMat),
            new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.016), goldMat),
          );
          group.add(prop);
          const ribbonFin = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.44, 4), goldMat);
          ribbonFin.rotation.x = -Math.PI / 2 + 0.15;
          ribbonFin.position.set(side * 0.14, 0.26, -0.62);
          group.add(ribbonFin);
        } else {
          const outerTip = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.026, 0.16), trimMat);
          outerTip.position.set(side * 0.88, 0.27, -0.24);
          outerTip.rotation.y = -side * 0.68;
          group.add(outerTip);

          const haloFin = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.26, 0.24), glowMat);
          haloFin.position.set(side * 0.32, 0.36, -0.44);
          haloFin.rotation.z = -side * 0.35;
          group.add(haloFin);

          if (isPlasmaBomber) {
            const forwardCanard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.028, 0.12), trimMat);
            forwardCanard.position.set(side * 0.19, 0.25, 0.44);
            forwardCanard.rotation.y = -side * 0.32;
            group.add(forwardCanard);
          }
          if (isStarBomber) {
            const wingLance = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.56, 6), glowMat);
            wingLance.rotation.x = Math.PI / 2;
            wingLance.position.set(side * 0.62, 0.22, 0.18);
            group.add(wingLance);
          }
        }
      }
      if (isPlasmaBomber) {
        const bellyOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), glowMat);
        bellyOrb.position.set(0, 0.14, 0.02);
        group.add(bellyOrb);
        const dorsalHalo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 6, 14), goldMat);
        dorsalHalo.position.set(0, 0.38, -0.08);
        dorsalHalo.rotation.x = Math.PI / 3;
        group.add(dorsalHalo);
      }
      return group;
    }

    if (isOrc) {
      // Orc Heavy Bombers:
      // 4 (Atomic): Twin-Boom Wazbom Prop Fortress (iron center crew pod + giant booms + spin_prop + belly bomb)
      // 5 (Info): Swept Red-Baron Jet Marauder (swept crimson delta wings + bone tusks + twin jet afterburners)
      // 6+ (Orbital/Star): Magma Plasma Dread-Bomber (dark steel armored flying wedge + glowing magma wing edges + triple horns + Epoch 7 dorsal cannon)
      const orcMetal = new THREE.MeshStandardMaterial({
        color: isPlasmaBomber ? 0x18181b : isStealth ? 0x27272a : 0x3f3f46,
        roughness: 0.42,
        metalness: 0.74,
      });
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.42 });

      if (isAtomicProp) {
        const mainPlank = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.06, 0.4), bodyMat);
        mainPlank.position.set(0, 0.24, 0.06);
        mainPlank.castShadow = true;
        group.add(mainPlank);

        const centerPod = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.84), orcMetal);
        centerPod.position.set(0, 0.24, 0.24);
        group.add(centerPod);
        const slit = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.16), glassMat);
        slit.position.set(0, 0.3, 0.48);
        group.add(slit);
        const bellyBomb = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.54, 7), glowMat);
        bellyBomb.rotation.x = Math.PI / 2;
        bellyBomb.position.set(0, 0.1, 0.18);
        group.add(bellyBomb);

        for (const bx of [-0.46, 0.46]) {
          const boom = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.18), orcMetal);
          boom.position.set(bx, 0.24, -0.1);
          boom.castShadow = true;
          group.add(boom);

          const tailSpikeFin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.22), bodyMat);
          tailSpikeFin.position.set(bx, 0.38, -0.62);
          group.add(tailSpikeFin);

          const prop = new THREE.Group();
          prop.name = 'spin_prop';
          prop.position.set(bx, 0.24, 0.5);
          prop.add(
            new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.02), headlightMat),
            new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.02), headlightMat),
          );
          group.add(prop);
        }
        const tailBridge = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.05, 0.18), bodyMat);
        tailBridge.position.set(0, 0.26, -0.64);
        group.add(tailBridge);
        return group;
      }

      // Epoch 5 Jet Marauder OR Epoch 6+ Magma Dread-Bomber
      const fuseBody = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), orcMetal);
      fuseBody.scale.set(1.1, 0.72, isPlasmaBomber ? 3.2 : 2.8);
      fuseBody.position.set(0, 0.24, 0);
      fuseBody.castShadow = true;
      group.add(fuseBody);

      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.16), glassMat);
      slit.position.set(0, 0.31, 0.46);
      group.add(slit);

      for (const side of [-1, 1]) {
        const sweptWing = new THREE.Mesh(
          new THREE.BoxGeometry(isPlasmaBomber ? 0.96 : 0.84, 0.055, isPlasmaBomber ? 0.52 : 0.4),
          isPlasmaBomber ? orcMetal : bodyMat,
        );
        sweptWing.position.set(side * 0.52, 0.24, -0.06);
        sweptWing.rotation.y = -side * (isPlasmaBomber ? 0.52 : 0.44);
        sweptWing.castShadow = true;
        group.add(sweptWing);

        const noseTusk = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34, 4), boneMat);
        noseTusk.rotation.x = Math.PI / 2;
        noseTusk.position.set(side * 0.16, 0.2, 0.74);
        group.add(noseTusk);

        const cantedFin = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.28, 0.24), bodyMat);
        cantedFin.position.set(side * 0.34, 0.38, -0.56);
        cantedFin.rotation.z = side * 0.42;
        group.add(cantedFin);

        const jetPod = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.42, 7), orcMetal);
        jetPod.rotation.x = Math.PI / 2;
        jetPod.position.set(side * 0.44, 0.18, -0.08);
        group.add(jetPod);

        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 6), glowMat);
        flame.rotation.x = -Math.PI / 2;
        flame.position.set(side * 0.44, 0.18, -0.4);
        group.add(flame);

        if (isPlasmaBomber) {
          const magmaEdge = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.028, 0.08), glowMat);
          magmaEdge.position.set(side * 0.52, 0.24, 0.14);
          magmaEdge.rotation.y = -side * 0.52;
          group.add(magmaEdge);
        }
      }
      if (isStarBomber) {
        const dorsalGun = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.56, 6), glowMat);
        dorsalGun.rotation.x = Math.PI / 2;
        dorsalGun.position.set(0, 0.42, 0.18);
        group.add(dorsalGun);
      }
      return group;
    }

    // Human Strategic Bomber:
    // 4 (Atomic): 4-Engine Heavy Prop Fortress (metallic fuselage, glass nose, twin-fin H-tail, 4 spin_prop nacelles)
    // 5 (Info): B-2 Stealth Flying Wing (dark matte cranked delta wing blending into fuselage, NO tail fins!)
    // 6+ (Orbital/Star): Plasma Delta Lancer (silver hypersonic delta + forward canards + glowing cyan twin plasma nacelles + Epoch 7 wingtip rail-lances)
    const hullMat = new THREE.MeshStandardMaterial({
      color: isPlasmaBomber ? 0xf1f5f9 : isStealth ? 0x1e293b : 0x64748b,
      roughness: isPlasmaBomber ? 0.22 : isStealth ? 0.32 : 0.4,
      metalness: isPlasmaBomber ? 0.78 : 0.62,
    });

    if (isStealth) {
      // Epoch 5 Info: True Tailless B-2 Stealth Flying Wing
      const centerWing = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.92, 4), hullMat);
      centerWing.rotation.x = Math.PI / 2;
      centerWing.rotation.y = Math.PI / 4;
      centerWing.scale.set(1.45, 0.22, 1);
      centerWing.position.set(0, 0.24, 0.06);
      centerWing.castShadow = true;
      group.add(centerWing);

      const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.26), glassMat);
      canopy.position.set(0, 0.3, 0.24);
      group.add(canopy);

      for (const side of [-1, 1]) {
        const outerWing = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.048, 0.44), hullMat);
        outerWing.position.set(side * 0.54, 0.23, -0.08);
        outerWing.rotation.y = -side * 0.54;
        outerWing.castShadow = true;
        group.add(outerWing);

        const exhaust = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 6), glowMat);
        exhaust.rotation.x = -Math.PI / 2;
        exhaust.position.set(side * 0.26, 0.24, -0.34);
        group.add(exhaust);
      }
      return group;
    }

    const fuselage = new THREE.Mesh(
      new THREE.CylinderGeometry(isPlasmaBomber ? 0.13 : 0.15, 0.11, isPlasmaBomber ? 1.36 : 1.24, 8),
      hullMat,
    );
    fuselage.rotation.x = Math.PI / 2;
    fuselage.scale.set(1.05, 1, 0.85);
    fuselage.position.set(0, 0.24, 0);
    fuselage.castShadow = true;
    group.add(fuselage);

    const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 8), isPlasmaBomber ? hullMat : glassMat);
    noseCone.rotation.x = Math.PI / 2;
    noseCone.position.set(0, 0.24, 0.72);
    group.add(noseCone);

    const halfSpan = isPlasmaBomber ? 0.96 : 0.88;
    for (const side of [-1, 1]) {
      const wingPanel = new THREE.Mesh(
        new THREE.BoxGeometry(halfSpan, 0.048, isPlasmaBomber ? 0.48 : 0.34),
        isPlasmaBomber ? hullMat : bodyMat,
      );
      wingPanel.position.set(side * (halfSpan * 0.5 + 0.06), 0.24, isPlasmaBomber ? -0.1 : 0.02);
      wingPanel.rotation.y = -side * (isPlasmaBomber ? 0.52 : 0.22);
      wingPanel.castShadow = true;
      group.add(wingPanel);

      const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.16, 0.24), isPlasmaBomber ? glowMat : trimMat);
      winglet.position.set(side * (halfSpan + 0.02), 0.29, isPlasmaBomber ? -0.28 : -0.1);
      group.add(winglet);

      if (isPlasmaBomber) {
        const canard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.12), trimMat);
        canard.position.set(side * 0.2, 0.24, 0.46);
        canard.rotation.y = -side * 0.36;
        group.add(canard);
      }
      if (isStarBomber) {
        const railPod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.52, 6), glowMat);
        railPod.rotation.x = Math.PI / 2;
        railPod.position.set(side * (halfSpan + 0.02), 0.24, 0.08);
        group.add(railPod);
      }
    }

    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.28), glassMat);
    cockpit.position.set(0, 0.34, 0.38);
    group.add(cockpit);

    const bombBay = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.52), trimMat);
    bombBay.position.set(0, 0.14, 0.02);
    group.add(bombBay);

    for (const side of [-1, 1]) {
      const hTail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.18), bodyMat);
      hTail.position.set(side * 0.18, 0.26, -0.52);
      hTail.rotation.y = -side * 0.3;
      group.add(hTail);

      const twinFin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.22), isPlasmaBomber ? hullMat : bodyMat);
      twinFin.position.set(side * 0.26, 0.37, -0.52);
      twinFin.rotation.z = side * (isPlasmaBomber ? 0.35 : 0);
      group.add(twinFin);
    }

    const engineXs = isAtomicProp ? [-0.68, -0.36, 0.36, 0.68] : [-0.46, 0.46];
    for (const ex of engineXs) {
      const eng = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.072, 0.3, 8),
        isPlasmaBomber ? glowMat : trimMat,
      );
      eng.rotation.x = Math.PI / 2;
      eng.position.set(ex, 0.2, 0.06);
      group.add(eng);
      if (isAtomicProp) {
        const prop = new THREE.Group();
        prop.name = 'spin_prop';
        prop.position.set(ex, 0.2, 0.23);
        prop.add(
          new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.028, 0.016), headlightMat),
          new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.24, 0.016), headlightMat),
        );
        group.add(prop);
      } else {
        const exhaustGlow = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.24, 6), glowMat);
        exhaustGlow.rotation.x = -Math.PI / 2;
        exhaustGlow.position.set(ex, 0.2, -0.18);
        group.add(exhaustGlow);
      }
    }
    return group;
  }

  if (type === 'orbital_gunship') {
    const isSuperDreadnought = epochLevel >= 7;

    if (isElf) {
      // Elf Astral Arch-Seraph: Needle crystal hull encircled by a vertical/canted golden halo ring & quadruple feather-vanes
      const alloyHull = new THREE.MeshStandardMaterial({ color: 0xd8f3dc, roughness: 0.2, metalness: 0.72 });
      const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, isSuperDreadnought ? 1.56 : 1.38, 8), alloyHull);
      needle.rotation.x = Math.PI / 2;
      needle.scale.set(1.15, 0.75, 1);
      needle.position.y = 0.24;
      needle.castShadow = true;
      group.add(needle);

      const spearTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), glowMat);
      spearTip.scale.set(0.8, 0.65, 2.5);
      spearTip.position.set(0, 0.24, isSuperDreadnought ? 0.92 : 0.82);
      group.add(spearTip);

      // Halo Ring around mid-hull
      const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.032, 7, 16), trimMat);
      haloRing.position.set(0, 0.26, -0.1);
      group.add(haloRing);

      for (const side of [-1, 1]) {
        const upperFeather = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.032, 0.26), trimMat);
        upperFeather.position.set(side * 0.48, 0.32, -0.14);
        upperFeather.rotation.y = -side * 0.48;
        upperFeather.rotation.z = side * 0.26;
        group.add(upperFeather);

        const lowerFeather = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.03, 0.22), glowMat);
        lowerFeather.position.set(side * 0.4, 0.16, -0.06);
        lowerFeather.rotation.y = -side * 0.42;
        lowerFeather.rotation.z = -side * 0.18;
        group.add(lowerFeather);

        const starLance = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.035, 0.56, 6), glowMat);
        starLance.rotation.x = Math.PI / 2;
        starLance.position.set(side * 0.34, 0.22, 0.32);
        group.add(starLance);
      }

      if (isSuperDreadnought) {
        const crownHalo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.024, 6, 12), glowMat);
        crownHalo.position.set(0, 0.46, -0.2);
        crownHalo.rotation.x = Math.PI / 3;
        group.add(crownHalo);
      }
      return group;
    }

    if (isOrc) {
      // Orc Orbital Ironclad Kroozer: brutalist hammerhead prow + armored casemate wings + heavy plasma broadside
      const orcSteel = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.32, metalness: 0.84 });
      const coreBlock = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.28, isSuperDreadnought ? 1.44 : 1.28), orcSteel);
      coreBlock.position.y = 0.24;
      coreBlock.castShadow = true;
      group.add(coreBlock);

      const hammerProw = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.24, 0.32), bodyMat);
      hammerProw.position.set(0, 0.24, isSuperDreadnought ? 0.76 : 0.68);
      group.add(hammerProw);

      for (const side of [-1, 1]) {
        const prowTusk = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.3, 4), trimMat);
        prowTusk.rotation.x = Math.PI / 2;
        prowTusk.position.set(side * 0.28, 0.24, isSuperDreadnought ? 0.98 : 0.88);
        group.add(prowTusk);

        const armoredWing = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.1, 0.54), orcSteel);
        armoredWing.position.set(side * 0.52, 0.22, -0.14);
        armoredWing.castShadow = true;
        group.add(armoredWing);

        const megaCannon = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.58, 6), glowMat);
        megaCannon.rotation.x = Math.PI / 2;
        megaCannon.position.set(side * 0.62, 0.24, 0.26);
        group.add(megaCannon);

        const sideThruster = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.28, 7), glowMat);
        sideThruster.rotation.x = Math.PI / 2;
        sideThruster.position.set(side * 0.44, 0.22, isSuperDreadnought ? -0.78 : -0.7);
        group.add(sideThruster);
      }

      const bridgeCitadel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.42), bodyMat);
      bridgeCitadel.position.set(0, 0.44, -0.16);
      group.add(bridgeCitadel);
      if (isSuperDreadnought) {
        const dorsalMegaGun = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.68, 6), glowMat);
        dorsalMegaGun.rotation.x = Math.PI / 2;
        dorsalMegaGun.position.set(0, 0.48, 0.22);
        group.add(dorsalMegaGun);
      }
      return group;
    }

    // Human Orbital Gunship -> Super-Dreadnought
    const alloyHull = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.22,
      metalness: 0.82,
    });
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.14, isSuperDreadnought ? 1.48 : 1.32, 8),
      alloyHull,
    );
    hull.rotation.x = Math.PI / 2;
    hull.scale.set(1.25, 0.8, 1);
    hull.position.y = 0.24;
    hull.castShadow = true;
    group.add(hull);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.36, 6), alloyHull);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.24, isSuperDreadnought ? 0.86 : 0.78);
    group.add(nose);

    for (const side of [-1, 1]) {
      const sweptWing = new THREE.Mesh(
        new THREE.BoxGeometry(isSuperDreadnought ? 0.86 : 0.72, 0.048, 0.42),
        trimMat,
      );
      sweptWing.position.set(side * 0.44, 0.22, -0.12);
      sweptWing.rotation.y = -side * 0.42;
      sweptWing.castShadow = true;
      group.add(sweptWing);

      const railCannon = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.54, 6), glowMat);
      railCannon.rotation.x = Math.PI / 2;
      railCannon.position.set(side * 0.52, 0.22, 0.3);
      group.add(railCannon);

      const vtolPod = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 6, 10), glowMat);
      vtolPod.rotation.x = Math.PI / 2;
      vtolPod.position.set(side * 0.36, 0.18, -0.06);
      group.add(vtolPod);
    }

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.42), glassMat);
    canopy.position.set(0, 0.34, 0.26);
    group.add(canopy);

    if (isSuperDreadnought) {
      for (const fx of [-0.88, 0.88]) {
        const shieldFin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.52), bodyMat);
        shieldFin.position.set(fx, 0.24, -0.22);
        group.add(shieldFin);
      }
      const dorsalTurret = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.26), glowMat);
      dorsalTurret.position.set(0, 0.39, -0.18);
      group.add(dorsalTurret);
    }
    const coreDrive = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.24, 8), glowMat);
    coreDrive.rotation.x = Math.PI / 2;
    coreDrive.position.set(0, 0.22, isSuperDreadnought ? -0.82 : -0.74);
    group.add(coreDrive);
    return group;
  }

  // Civilian Aircraft ('plane') aligned +Z forward with streamlined cylindrical cabin & swept X wingspan + subtle racial accents
  const fuselageMat = isElf ? bodyMat : isOrc ? trimMat : new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.32, metalness: 0.35 });
  const wingMat = bodyMat;
  const isProp = epochLevel <= 4;
  const isOrbitalShuttle = epochLevel >= 6;

  const fuselage = new THREE.Mesh(
    new THREE.CylinderGeometry(isOrbitalShuttle ? 0.12 : 0.105, isOrbitalShuttle ? 0.1 : 0.085, isOrbitalShuttle ? 0.96 : 1.06, 10),
    fuselageMat,
  );
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.y = 0.2;
  fuselage.castShadow = true;
  group.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 8), fuselageMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.2, 0.64);
  group.add(nose);

  if (isElf) {
    const crestRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 6, 12), trimMat);
    crestRing.position.set(0, 0.2, 0.12);
    group.add(crestRing);
  } else if (isOrc) {
    for (const tx of [-0.09, 0.09]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.18, 4), trimMat);
      tusk.rotation.x = Math.PI / 2;
      tusk.position.set(tx, 0.17, 0.62);
      group.add(tusk);
    }
  }

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.2), glassMat);
  cockpit.position.set(0, 0.27, 0.42);
  group.add(cockpit);

  const wingSpan = isOrbitalShuttle ? 1.18 : 1.38;
  for (const side of [-1, 1]) {
    const wingPanel = new THREE.Mesh(new THREE.BoxGeometry(wingSpan * 0.48, 0.042, 0.28), wingMat);
    wingPanel.position.set(side * (wingSpan * 0.27), 0.19, 0.02);
    wingPanel.rotation.y = -side * (isOrbitalShuttle ? 0.42 : 0.24);
    wingPanel.rotation.z = side * 0.05;
    wingPanel.castShadow = true;
    group.add(wingPanel);

    const wTip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.14), wingMat);
    wTip.position.set(side * (wingSpan * 0.5), 0.23, -0.08);
    group.add(wTip);
  }

  for (const side of [-1, 1]) {
    const hTail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.035, 0.14), wingMat);
    hTail.position.set(side * 0.15, 0.22, -0.44);
    hTail.rotation.y = -side * 0.28;
    group.add(hTail);
  }
  const vTail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.26, 0.2), wingMat);
  vTail.position.set(0, 0.35, -0.45);
  vTail.rotation.x = -0.22;
  vTail.castShadow = true;
  group.add(vTail);

  for (const ex of [-0.34, 0.34]) {
    const pod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.06, 0.24, 8),
      isOrbitalShuttle ? glowMat : trimMat,
    );
    pod.rotation.x = Math.PI / 2;
    pod.position.set(ex, 0.14, 0.1);
    group.add(pod);

    if (isProp) {
      const prop = new THREE.Group();
      prop.name = 'spin_prop';
      prop.position.set(ex, 0.14, 0.24);
      prop.add(
        new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.016), headlightMat),
        new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.016), headlightMat),
      );
      group.add(prop);
    }
  }

  const portLight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), taillightMat);
  portLight.position.set(-wingSpan * 0.5, 0.21, -0.06);
  group.add(portLight);
  const stbdLight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), glowMat);
  stbdLight.position.set(wingSpan * 0.5, 0.21, -0.06);
  group.add(stbdLight);

  return group;
}

