import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BuildingType, ResourceNodeType, SpeciesId, TerrainType, UnitRole } from './types';

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
  farmCrop: THREE.BufferGeometry[];
  sciFiFarm: THREE.BufferGeometry[];
  stone: THREE.BufferGeometry[];
  ore: THREE.BufferGeometry[];
  crystal: THREE.BufferGeometry[];
  ambientGrass: THREE.BufferGeometry[];
  ambientForest: THREE.BufferGeometry[];
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

  cachedVariantLib = {
    timber,
    berry,
    farmCrop,
    sciFiFarm,
    stone,
    ore,
    crystal,
    ambientGrass,
    ambientForest,
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
      epochIndex >= 5 ? raceTechTrimMat : isOrc ? orcBasaltMat : isElf ? elfMossStoneMat : epochIndex >= 3 ? darkStoneMat : stoneMat;
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

    const windowMat = epochIndex >= 5 ? raceGlowMat : isOrc ? orcMagmaGlowMat : doorDarkMat;
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.19, 0.03),
      epochIndex >= 5 ? raceGlowMat : doorDarkMat,
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
      epochIndex >= 5 ? elfJadeRoofMat : elfMossStoneMat,
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
          epochIndex >= 5 ? elfAquaGlowMat : elfHeartwoodMat,
        );
        col.position.set(cx + Math.cos(a) * r * 0.95, curY + th * 0.5, cz + Math.sin(a) * r * 0.95);
        group.add(col);
      }

      if (t === 0) {
        // Luminous arched doorway on front +Z
        const archDoor = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, Math.min(0.22, th * 0.68), 0.04),
          opts.glowTrim || epochIndex >= 5 ? elfAquaGlowMat : elfHeartwoodMat,
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
      epochIndex >= 5 ? elfAquaGlowMat : goldMat,
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
      epochIndex >= 5 ? orcGunmetalMat : orcBasaltMat,
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
          const isSciFi = epochIndex >= 5;
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
          // Orc Ep 2+: Obsidian Fang War-Citadel -> Gunmetal Dreadnought Citadel (Ep 5+)
          const isSciFi = epochIndex >= 5;
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
        const isSciFi = epochIndex >= 5;
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
        } else {
          // Elven Ep 5-6: Pearl-Lotus Orbital Bio-Domes with Glowing Aqua Petals
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
          // Orc Ep 3-4: Riveted Rust-Iron Barracks Bunkers
          addOrcBastionHut({
            w: 0.64,
            h: 0.36,
            d: 0.52,
            wallMat: epochIndex === 4 ? orcGunmetalMat : orcIronMat,
            roofMat: orcCrimsonMat,
            tuskMat: orcIronMat,
            withBanner: true,
          });
        } else {
          // Orc Ep 5-6: Gunmetal Armored Siege Pods with Crimson Plasma Vent
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

      // HUMAN Houses across all epochs
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
        addVoxelCottage({
          w: variant % 2 === 0 ? 0.6 : 0.66,
          h: 0.36,
          d: 0.5,
          wallMat: variant === 3 ? stoneMat : brickMat,
          roofMat: darkStoneMat,
          chimneyMat: brickMat,
          chimneySide: variant % 2 === 0 ? 'left' : 'right',
          ridgeAlongZ: false,
          timberTrim: true,
        });
      } else if (epochIndex === 4) {
        addVoxelCottage({
          w: 0.64,
          h: 0.36,
          d: 0.52,
          wallMat: concreteMat,
          roofMat: darkStoneMat,
          chimneyMat: concreteMat,
          chimneySide: 'right',
          ridgeAlongZ: false,
        });
      } else {
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
          const isSciFi = epochIndex >= 5;
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
          const isSciFi = epochIndex >= 5;
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
        const isSciFi = epochIndex >= 5;
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
        if (epochIndex <= 4) {
          addElfPagodaPavilion({
            radius: 0.34,
            h: 0.3,
            wallMat: epochIndex >= 3 ? elfBirchMat : elfHeartwoodMat,
            roofMat: epochIndex >= 3 ? elfVerdigrisMat : elfJadeRoofMat,
            tiers: 1,
            glowTrim: true,
          });
          // Golden harvest urn beside pavilion
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
          wallMat: epochIndex >= 5 ? orcGunmetalMat : epochIndex >= 3 ? orcIronMat : orcCharredLogMat,
          roofMat: orcCrimsonMat,
          tuskMat: epochIndex >= 5 ? orcMagmaGlowMat : orcBoneMat,
          withBanner: true,
        });
        const drumSilo = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.16, 0.56, 7),
          epochIndex >= 5 ? orcMagmaGlowMat : orcIronMat,
        );
        drumSilo.position.set(-0.26, 0.3, -0.2);
        drumSilo.castShadow = true;
        group.add(drumSilo);
        break;
      }

      // HUMAN Granary / Market
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
      } else if (epochIndex <= 4) {
        addVoxelCottage({
          w: 0.66,
          h: 0.36,
          d: 0.54,
          wallMat: epochIndex === 3 ? brickMat : concreteMat,
          roofMat: epochIndex === 3 ? redRoofMat : darkStoneMat,
          chimneySide: 'none',
          timberTrim: epochIndex === 3,
        });
        const silo = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.15, 0.62, 8),
          epochIndex === 3 ? woodMat : concreteMat,
        );
        silo.position.set(-0.26, 0.34, -0.18);
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
        // Elven Three-Tiered Lore-Pagoda -> Orbital Sanctuary Spire
        addElfPagodaPavilion({
          radius: 0.33,
          h: 0.3,
          wallMat: epochIndex >= 5 ? elfPearlTechMat : elfBirchMat,
          roofMat: epochIndex >= 5 ? elfJadeRoofMat : epochIndex >= 3 ? elfVerdigrisMat : elfJadeRoofMat,
          tiers: epochIndex >= 5 ? 3 : 2,
          glowTrim: true,
        });
        if (epochIndex >= 5) {
          const halo = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 14), elfAquaGlowMat);
          halo.position.y = 0.92;
          halo.rotation.x = Math.PI / 2;
          halo.name = 'spin_part';
          group.add(halo);
        }
        break;
      }

      if (isOrc) {
        if (epochIndex < 5) {
          addOrcBastionHut({
            w: 0.72,
            h: 0.4,
            d: 0.56,
            wallMat: epochIndex >= 3 ? orcIronMat : orcBasaltMat,
            roofMat: orcCrimsonMat,
            tuskMat: orcBoneMat,
            withBanner: true,
          });
        } else {
          // Orc Ep 5+: Heavy Dreadnought War-Spire
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

      // HUMAN Guildhall
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
          w: 0.7,
          h: 0.42,
          d: 0.56,
          wallMat: epochIndex === 3 ? brickMat : concreteMat,
          roofMat: blueRoofMat,
          chimneyMat: epochIndex === 3 ? brickMat : concreteMat,
          chimneySide: 'front_right',
          ridgeAlongZ: false,
          timberTrim: epochIndex === 3,
        });
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
        ? epochIndex >= 5
          ? elfPearlTechMat
          : elfMossStoneMat
        : isOrc
          ? epochIndex >= 5
            ? orcGunmetalMat
            : epochIndex >= 3
              ? orcIronMat
              : orcBasaltMat
          : epochIndex >= 5
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
          : epochIndex >= 5
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
        const sunForge = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), epochIndex >= 5 ? elfAquaGlowMat : goldMat);
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
          tuskMat: epochIndex >= 5 ? orcMagmaGlowMat : orcBoneMat,
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
      } else if (epochIndex >= 5) {
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
        // Elven Astral Astrolabe Spire
        const baseMat = epochIndex >= 5 ? elfPearlTechMat : elfBirchMat;
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.74, 8), baseMat);
        spire.position.y = 0.37;
        spire.castShadow = true;
        group.add(spire);

        const eave = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.4, 0.08, 8), elfJadeRoofMat);
        eave.position.y = 0.72;
        group.add(eave);

        const astrolabe = new THREE.Mesh(
          new THREE.TorusGeometry(0.25, 0.032, 6, 16),
          epochIndex >= 5 ? elfAquaGlowMat : goldMat,
        );
        astrolabe.position.y = 0.96;
        astrolabe.rotation.x = 0.45;
        astrolabe.name = 'spin_part';
        group.add(astrolabe);
        break;
      }

      if (isOrc) {
        // Orcish Spiked Iron War-Watchtower & Magma Lens
        const towerMat = epochIndex >= 5 ? orcGunmetalMat : orcBasaltMat;
        const bastion = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.34, 0.66), towerMat);
        bastion.position.y = 0.17;
        group.add(bastion);

        const keep = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.5, 7), orcIronMat);
        keep.position.y = 0.56;
        keep.castShadow = true;
        group.add(keep);

        const spikedDome = new THREE.Mesh(
          new THREE.SphereGeometry(0.26, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
          epochIndex >= 5 ? orcGunmetalMat : orcCrimsonMat,
        );
        spikedDome.position.y = 0.8;
        group.add(spikedDome);

        const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), orcMagmaGlowMat);
        eye.position.y = 1.1;
        eye.name = 'spin_part';
        group.add(eye);
        break;
      }

      if (epochIndex >= 5) {
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
          epochIndex === 3 ? brickMat : marbleWhiteMat,
        );
        tower.position.y = 0.48;
        tower.castShadow = true;
        group.add(tower);

        const balcony = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.6), woodMat);
        balcony.position.y = 0.74;
        group.add(balcony);

        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          epochIndex === 4 ? techMat : goldMat,
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
          wallMat: epochIndex >= 5 ? elfPearlTechMat : elfBirchMat,
          roofMat: epochIndex >= 5 ? elfJadeRoofMat : elfVerdigrisMat,
          tiers: 1,
          glowTrim: true,
        });
        const coil = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.18, 0),
          epochIndex >= 5 || type === 'dynamo_plant' ? elfAquaGlowMat : goldMat,
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
          wallMat: epochIndex >= 5 ? orcGunmetalMat : orcIronMat,
          roofMat: orcCrimsonMat,
          tuskMat: epochIndex >= 5 ? orcMagmaGlowMat : orcIronMat,
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

      if (epochIndex >= 5) {
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
          wallMat: epochIndex === 4 ? concreteMat : brickMat,
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
          ? epochIndex >= 5
            ? orcGunmetalMat
            : orcIronMat
          : epochIndex >= 5
            ? techMat
            : concreteMat;
      const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.3, 0.72), baseMat);
      baseBlock.position.y = 0.18;
      baseBlock.castShadow = true;
      group.add(baseBlock);

      if (type === 'fission_reactor') {
        const coolingTower = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.3, 0.72, isElf ? 8 : 10),
          isElf ? elfJadeRoofMat : isOrc ? orcBasaltMat : epochIndex >= 5 ? darkTechMat : concreteMat,
        );
        coolingTower.position.set(-0.1, 0.52, -0.08);
        coolingTower.castShadow = true;
        group.add(coolingTower);

        const coreGlow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 0.24), raceGlowMat);
        coreGlow.position.set(0.2, 0.48, 0.18);
        if (epochIndex >= 5) coreGlow.name = 'spin_part';
        group.add(coreGlow);
      } else {
        const tower1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.82, 0.42), baseMat);
        tower1.position.y = 0.56;
        tower1.castShadow = true;
        group.add(tower1);

        const dataRing = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 0.52), raceGlowMat);
        dataRing.position.y = 0.8;
        dataRing.name = 'spin_part';
        group.add(dataRing);

        const spireAntenna = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.05, 0.38, 6),
          epochIndex >= 5 ? raceGlowMat : raceAccentMat,
        );
        spireAntenna.position.y = 1.12;
        group.add(spireAntenna);
      }
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

export function createUnitGroup(
  role: UnitRole,
  faction: 'civilization' | 'hostile',
  epochLevel = 0,
  species: SpeciesId = 'human',
): THREE.Group {
  const group = new THREE.Group();
  group.add(createContactShadow(species === 'orc' ? 0.68 : 0.58));

  const resolvedSpecies: SpeciesId =
    role === 'elf' ? 'elf' : role === 'orc' ? 'orc' : role === 'human' ? 'human' : species;

  const skinHex =
    faction === 'hostile'
      ? 0x8f5656
      : resolvedSpecies === 'orc'
        ? 0x5b8c42
        : resolvedSpecies === 'elf'
          ? 0xf4dcc8
          : 0xe8be9e;

  const skinMat = new THREE.MeshStandardMaterial({
    color: skinHex,
    roughness: 0.65,
  });

  const outfitColors: Record<UnitRole, number> = {
    human: epochLevel >= 5 ? 0xd8dee9 : epochLevel >= 3 ? 0x3b6e8c : 0x4ea8de,
    elf: epochLevel >= 5 ? 0x80ed99 : 0x388e5a,
    orc: epochLevel >= 5 ? 0x9b2226 : 0x8d3b2b,
    villager: epochLevel >= 5 ? 0xd8dee9 : epochLevel >= 3 ? 0x3b6e8c : 0x4ea8de,
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
    roughness: epochLevel >= 4 ? 0.35 : 0.55,
    metalness:
      role === 'warrior' || role === 'astro_engineer' || epochLevel >= 4 ? 0.45 : 0.1,
  });

  const bootMat = new THREE.MeshStandardMaterial({
    color: resolvedSpecies === 'elf' ? 0x4a3b2c : 0x3d2b1f,
    roughness: 0.8,
  });
  const scale =
    role === 'raider_behemoth'
      ? 1.45
      : resolvedSpecies === 'orc'
        ? 1.14
        : resolvedSpecies === 'elf'
          ? 0.98
          : 1.0;
  const widthMult = resolvedSpecies === 'orc' ? 1.24 : resolvedSpecies === 'elf' ? 0.86 : 1.0;

  // 1. Legs
  const legL = new THREE.Mesh(
    new THREE.BoxGeometry(0.08 * scale * widthMult, 0.14 * scale, 0.08 * scale),
    bootMat,
  );
  legL.position.set(-0.055 * scale * widthMult, 0.07 * scale, 0);
  group.add(legL);

  const legR = new THREE.Mesh(
    new THREE.BoxGeometry(0.08 * scale * widthMult, 0.14 * scale, 0.08 * scale),
    bootMat,
  );
  legR.position.set(0.055 * scale * widthMult, 0.07 * scale, 0);
  group.add(legR);

  // 2. Torso
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.2 * scale * widthMult, 0.22 * scale, 0.14 * scale),
    tunicMat,
  );
  torso.position.y = 0.24 * scale;
  torso.castShadow = true;
  group.add(torso);

  // 3. Head (+ species ears / tusks)
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.18 * scale * widthMult, 0.18 * scale, 0.18 * scale),
    skinMat,
  );
  head.position.y = 0.44 * scale;
  head.castShadow = true;
  group.add(head);

  if (resolvedSpecies === 'elf' && faction === 'civilization') {
    const earGeo = new THREE.BoxGeometry(0.08 * scale, 0.045 * scale, 0.04 * scale);
    const earL = new THREE.Mesh(earGeo, skinMat);
    earL.position.set(-0.12 * scale, 0.45 * scale, -0.01 * scale);
    earL.rotation.z = 0.35;
    group.add(earL);
    const earR = new THREE.Mesh(earGeo, skinMat);
    earR.position.set(0.12 * scale, 0.45 * scale, -0.01 * scale);
    earR.rotation.z = -0.35;
    group.add(earR);
  } else if (resolvedSpecies === 'orc') {
    const tuskMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.45 });
    const tuskGeo = new THREE.BoxGeometry(0.03 * scale, 0.055 * scale, 0.03 * scale);
    const tuskL = new THREE.Mesh(tuskGeo, tuskMat);
    tuskL.position.set(-0.055 * scale, 0.40 * scale, 0.1 * scale);
    group.add(tuskL);
    const tuskR = new THREE.Mesh(tuskGeo, tuskMat);
    tuskR.position.set(0.055 * scale, 0.40 * scale, 0.1 * scale);
    group.add(tuskR);
  }

  // 4. Hat / Helmet / Circlet evolving across epochs
  const hatColor =
    faction === 'hostile'
      ? 0x222222
      : resolvedSpecies === 'elf'
        ? epochLevel >= 4
          ? 0x72efdd
          : 0xf5b742
        : resolvedSpecies === 'orc'
          ? epochLevel >= 2
            ? 0x5c677d
            : 0x2b2522
          : role === 'astro_engineer' || epochLevel >= 5
            ? 0xeceff4
            : role === 'priest' || role === 'warrior' || epochLevel === 1
              ? 0xe9b44c
              : epochLevel >= 2
                ? 0x8d99ae
                : 0x4a3423;
  const hatMat = new THREE.MeshStandardMaterial({
    color: hatColor,
    roughness: 0.4,
    metalness: role === 'warrior' || resolvedSpecies === 'elf' || epochLevel >= 1 ? 0.55 : 0.1,
  });
  const hat = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.2 * scale * widthMult,
      (resolvedSpecies === 'elf' ? 0.05 : epochLevel >= 2 ? 0.09 : 0.07) * scale,
      0.2 * scale,
    ),
    hatMat,
  );
  hat.position.y = 0.55 * scale;
  group.add(hat);

  if (faction === 'civilization' && epochLevel >= 4) {
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.16 * scale * widthMult, 0.05 * scale, 0.04 * scale),
      new THREE.MeshBasicMaterial({ color: 0x56cfe1 }),
    );
    visor.position.set(0, 0.45 * scale, 0.095 * scale);
    group.add(visor);
  }

  // 5. Held Tool / Weapon / Bow-Staff
  const toolMat = new THREE.MeshStandardMaterial({
    color:
      resolvedSpecies === 'elf'
        ? 0xf5b742
        : resolvedSpecies === 'orc'
          ? 0xd62828
          : role === 'priest' || role === 'scholar'
            ? 0xf5b742
            : epochLevel >= 4
              ? 0x56cfe1
              : 0xadb5bd,
    metalness: 0.6,
    roughness: 0.3,
  });
  const tool = new THREE.Mesh(
    new THREE.BoxGeometry(
      (resolvedSpecies === 'orc' ? 0.08 : 0.05) * scale,
      (resolvedSpecies === 'elf' ? 0.34 : 0.28) * scale,
      0.05 * scale,
    ),
    toolMat,
  );
  tool.position.set(0.14 * scale * widthMult, 0.28 * scale, 0.08 * scale);
  tool.rotation.x = 0.35;
  tool.name = 'held_tool';
  group.add(tool);

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
