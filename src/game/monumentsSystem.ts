import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getPixelArtTexture } from './meshBuilders';
import type { BattleMemorial, SimulationState, SpeciesId, WorldWonder } from './types';

export interface MonumentsSystem {
  group: THREE.Group;
  update: (state: SimulationState, elapsed: number) => void;
  dispose: () => void;
}

interface WonderVisual {
  id: string;
  species: SpeciesId;
  epochLevel: number;
  root: THREE.Group;
  animatedPart?: THREE.Object3D;
  baseAnimY: number;
}

type MaterialBucket = 'stone' | 'wood' | 'foliage' | 'metal' | 'cloth' | 'glow';

interface SharedWonderMaterials {
  stone: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  cloth: THREE.MeshStandardMaterial;
  glow: THREE.MeshStandardMaterial;
  beam: THREE.MeshBasicMaterial;
}

function createSharedWonderMaterials(): SharedWonderMaterials {
  return {
    stone: new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: getPixelArtTexture('wonder_stone_neutral', '#e6e6e6', '#ffffff', '#b4b4b4', 'stone'),
      roughness: 0.8,
      metalness: 0.08,
    }),
    wood: new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: getPixelArtTexture('wonder_wood_neutral', '#e4e4e4', '#ffffff', '#b0b0b0', 'wood'),
      roughness: 0.86,
      metalness: 0.04,
    }),
    foliage: new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: getPixelArtTexture('wonder_foliage_neutral', '#e4e4e4', '#ffffff', '#aeaeae', 'grass'),
      roughness: 0.78,
      metalness: 0.04,
    }),
    metal: new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: getPixelArtTexture('wonder_metal_neutral', '#e6e6e6', '#ffffff', '#b2b2b2', 'tech'),
      roughness: 0.34,
      metalness: 0.65,
    }),
    cloth: new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: getPixelArtTexture('wonder_cloth_neutral', '#e8e8e8', '#ffffff', '#b6b6b6', 'roof'),
      roughness: 0.74,
      metalness: 0.05,
    }),
    glow: new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.72,
      roughness: 0.18,
      metalness: 0.2,
    }),
    beam: new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.62,
    }),
  };
}

/** Strips invisible downward-facing (-Y) triangles for isometric optimization (PERFORMANCE_README Rule 1). */
function stripDownwardTriangles(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const nonIdx = g.index ? g.toNonIndexed() : g;
  const posAttr = nonIdx.getAttribute('position') as THREE.BufferAttribute;
  const normAttr = nonIdx.getAttribute('normal') as THREE.BufferAttribute;
  const colAttr = nonIdx.getAttribute('color') as THREE.BufferAttribute | undefined;
  const uvAttr = nonIdx.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!posAttr || !normAttr) return nonIdx;

  const nArr = normAttr.array as Float32Array;
  const pArr = posAttr.array as Float32Array;
  const cArr = colAttr ? (colAttr.array as Float32Array) : null;
  const uArr = uvAttr ? (uvAttr.array as Float32Array) : null;
  const triCount = Math.floor(posAttr.count / 3);
  let kept = 0;
  for (let t = 0; t < triCount; t++) {
    const b = t * 9;
    if (nArr[b + 1] < -0.94 && nArr[b + 4] < -0.94 && nArr[b + 7] < -0.94) continue;
    kept++;
  }
  if (kept === triCount) return nonIdx;

  const nextPos = new Float32Array(kept * 9);
  const nextNorm = new Float32Array(kept * 9);
  const nextCol = cArr ? new Float32Array(kept * 9) : null;
  const nextUv = uArr ? new Float32Array(kept * 6) : null;
  let w = 0;
  let wUv = 0;
  for (let t = 0; t < triCount; t++) {
    const b = t * 9;
    if (nArr[b + 1] < -0.94 && nArr[b + 4] < -0.94 && nArr[b + 7] < -0.94) continue;
    nextPos.set(pArr.subarray(b, b + 9), w);
    nextNorm.set(nArr.subarray(b, b + 9), w);
    if (nextCol && cArr) nextCol.set(cArr.subarray(b, b + 9), w);
    if (nextUv && uArr) {
      nextUv.set(uArr.subarray(t * 6, t * 6 + 6), wUv);
      wUv += 6;
    }
    w += 9;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(nextPos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nextNorm, 3));
  if (nextCol) out.setAttribute('color', new THREE.BufferAttribute(nextCol, 3));
  if (nextUv) out.setAttribute('uv', new THREE.BufferAttribute(nextUv, 2));
  if (nonIdx !== g) nonIdx.dispose();
  g.dispose();
  return out;
}

function makeColoredBox(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  hexColor: number,
  rotY = 0,
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  // Scale UVs proportionally to physical box face size so pixel texels stay uniform across large & small parts
  const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute;
  const normAttr = geo.getAttribute('normal') as THREE.BufferAttribute;
  if (uvAttr && normAttr) {
    const uvScale = 1.45;
    for (let i = 0; i < uvAttr.count; i++) {
      const nx = Math.abs(normAttr.getX(i));
      const ny = Math.abs(normAttr.getY(i));
      const u = uvAttr.getX(i);
      const v = uvAttr.getY(i);
      if (ny > 0.5) {
        uvAttr.setXY(i, u * w * uvScale, v * d * uvScale);
      } else if (nx > 0.5) {
        uvAttr.setXY(i, u * d * uvScale, v * h * uvScale);
      } else {
        uvAttr.setXY(i, u * w * uvScale, v * h * uvScale);
      }
    }
  }
  if (rotY !== 0) geo.rotateY(rotY);
  geo.translate(x, y, z);

  const nonIdx = geo.toNonIndexed();
  geo.dispose();
  const count = nonIdx.getAttribute('position').count;
  const col = new THREE.Color(hexColor);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  nonIdx.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return nonIdx;
}

function buildRaceWonderMesh(
  species: SpeciesId,
  epochLevel: number,
  mats: SharedWonderMaterials,
): {
  root: THREE.Group;
  animatedPart?: THREE.Object3D;
  baseAnimY: number;
} {
  const root = new THREE.Group();
  const buckets: Record<MaterialBucket, THREE.BufferGeometry[]> = {
    stone: [],
    wood: [],
    foliage: [],
    metal: [],
    cloth: [],
    glow: [],
  };

  const addPart = (
    bucket: MaterialBucket,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: number,
    rotY = 0,
  ) => {
    buckets[bucket].push(makeColoredBox(w, h, d, x, y, z, color, rotY));
  };

  let animatedPart: THREE.Object3D | undefined;
  let baseAnimY = 2.2;

  switch (species) {
    case 'human': {
      // Grand Sun Lighthouse: stepped marble plinth, 4 corner buttresses, fluted alabaster tower, glowing arches, banners & golden beacon
      addPart('stone', 1.66, 0.24, 1.66, 0, 0.12, 0, 0xcbd5e1);
      addPart('stone', 1.32, 0.28, 1.32, 0, 0.38, 0, 0xe2e8f0);
      addPart('stone', 0.84, 1.48, 0.84, 0, 1.26, 0, 0xf1f5f9);
      // 4 carved corner buttresses + arched pilasters
      for (const sx of [-0.46, 0.46]) {
        for (const sz of [-0.46, 0.46]) {
          addPart('stone', 0.22, 1.12, 0.22, sx, 0.96, sz, 0xd6d3d1);
          addPart('metal', 0.16, 0.14, 0.16, sx, 1.56, sz, 0xfbbf24);
        }
      }
      // Glowing arched lighthouse windows & royal crimson-gold banners
      addPart('glow', 0.16, 0.36, 0.88, 0, 1.24, 0, 0xfef08a);
      addPart('glow', 0.88, 0.36, 0.16, 0, 1.24, 0, 0xfef08a);
      addPart('cloth', 0.22, 0.56, 0.04, 0, 0.95, 0.44, 0xdc2626);
      addPart('cloth', 0.22, 0.56, 0.04, 0, 0.95, -0.44, 0xdc2626);
      // Gilded balcony & cupola rim
      addPart('metal', 1.04, 0.14, 1.04, 0, 2.06, 0, 0xfbbf24);
      addPart('stone', 0.92, 0.12, 0.92, 0, 2.18, 0, 0xf8fafc);

      const beacon = new THREE.Group();
      beacon.position.set(0, 2.52, 0);
      const coreGeo = new THREE.OctahedronGeometry(0.3, 0).toNonIndexed();
      const cCount = coreGeo.getAttribute('position').count;
      const cCols = new Float32Array(cCount * 3);
      const cCol = new THREE.Color(0xfef08a);
      for (let i = 0; i < cCount; i++) {
        cCols[i * 3] = cCol.r;
        cCols[i * 3 + 1] = cCol.g;
        cCols[i * 3 + 2] = cCol.b;
      }
      coreGeo.setAttribute('color', new THREE.BufferAttribute(cCols, 3));
      const core = new THREE.Mesh(coreGeo, mats.glow);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.12, 0.12), mats.beam);
      beacon.add(core, beam);
      root.add(beacon);
      animatedPart = beacon;
      baseAnimY = 2.52;
      break;
    }

    case 'elf': {
      // World Tree Sanctuary: mossy terraced stone plinth, flared ancient roots & trunk, dappled emerald & blossom canopy, hanging lanterns
      addPart('stone', 1.6, 0.2, 1.6, 0, 0.1, 0, 0xcbd5e1);
      addPart('foliage', 1.38, 0.14, 1.38, 0, 0.26, 0, 0x4ade80);
      // Flared gnarled roots & sculpted trunk
      addPart('wood', 0.56, 1.4, 0.56, 0, 0.96, 0, 0x78350f);
      addPart('wood', 0.96, 0.34, 0.28, 0, 0.44, 0, 0x92400e);
      addPart('wood', 0.28, 0.34, 0.96, 0, 0.44, 0, 0x92400e);
      // Tiered dappled emerald & sakura-blossom pixel canopy
      addPart('foliage', 1.66, 0.44, 1.66, 0, 1.72, 0, 0x22c55e);
      addPart('foliage', 1.38, 0.38, 1.38, 0.08, 2.08, -0.06, 0xf472b6);
      addPart('foliage', 1.08, 0.36, 1.08, -0.06, 2.42, 0.05, 0x4ade80);
      addPart('foliage', 0.68, 0.28, 0.68, 0, 2.72, 0, 0xf9a8d4);
      // Hanging golden sanctuary lanterns under lower boughs
      for (const [lx, lz] of [[-0.64, 0.54], [0.64, 0.54], [-0.64, -0.54], [0.64, -0.54]] as const) {
        addPart('glow', 0.12, 0.16, 0.12, lx, 1.38, lz, 0xfef08a);
      }

      const crownGeo = new THREE.OctahedronGeometry(0.28, 0).toNonIndexed();
      const cCount = crownGeo.getAttribute('position').count;
      const cCols = new Float32Array(cCount * 3);
      const cCol = new THREE.Color(0x6ee7b7);
      for (let i = 0; i < cCount; i++) {
        cCols[i * 3] = cCol.r;
        cCols[i * 3 + 1] = cCol.g;
        cCols[i * 3 + 2] = cCol.b;
      }
      crownGeo.setAttribute('color', new THREE.BufferAttribute(cCols, 3));
      const crown = new THREE.Mesh(crownGeo, mats.glow);
      crown.position.set(0, 3.1, 0);
      root.add(crown);
      animatedPart = crown;
      baseAnimY = 3.1;
      break;
    }

    case 'orc': {
      // Iron War Colossus: riveted basalt-iron bastion, 4 spiked corner totems, twin horned obsidian spires, crimson war banners & magma brazier
      addPart('stone', 1.68, 0.3, 1.68, 0, 0.15, 0, 0x3f3f46);
      addPart('metal', 1.18, 1.15, 1.04, 0, 0.88, 0, 0x52525b);
      addPart('metal', 0.28, 1.24, 0.28, -0.6, 1.72, 0, 0x27272a);
      addPart('metal', 0.28, 1.24, 0.28, 0.6, 1.72, 0, 0x27272a);
      // Horned iron tips & riveted corner bastions
      for (const sx of [-0.68, 0.68]) {
        for (const sz of [-0.68, 0.68]) {
          addPart('stone', 0.24, 0.54, 0.24, sx, 0.56, sz, 0x27272a);
          addPart('metal', 0.16, 0.22, 0.16, sx, 0.94, sz, 0xb45309);
        }
      }
      // Crimson war-banner crossbar & hanging banners
      addPart('cloth', 1.36, 0.22, 0.42, 0, 1.54, 0, 0x991b1b);
      addPart('cloth', 0.34, 0.68, 0.05, 0, 1.02, 0.56, 0xb91c1c);
      addPart('cloth', 0.34, 0.68, 0.05, 0, 1.02, -0.56, 0xb91c1c);
      addPart('metal', 0.38, 0.08, 0.07, 0, 1.38, 0.56, 0xf59e0b);
      addPart('metal', 0.38, 0.08, 0.07, 0, 1.38, -0.56, 0xf59e0b);

      const brazierGeo = new THREE.OctahedronGeometry(0.35, 0).toNonIndexed();
      const cCount = brazierGeo.getAttribute('position').count;
      const cCols = new Float32Array(cCount * 3);
      const cCol = new THREE.Color(0xfb923c);
      for (let i = 0; i < cCount; i++) {
        cCols[i * 3] = cCol.r;
        cCols[i * 3 + 1] = cCol.g;
        cCols[i * 3 + 2] = cCol.b;
      }
      brazierGeo.setAttribute('color', new THREE.BufferAttribute(cCols, 3));
      const brazier = new THREE.Mesh(brazierGeo, mats.glow);
      brazier.position.set(0, 2.08, 0);
      root.add(brazier);
      animatedPart = brazier;
      baseAnimY = 2.08;
      break;
    }

    case 'dwarf': {
      // Runic Titan Forge: chamfered granite-bronze dais, 4 corner runic obelisks, arched gilded anvil hearth, glowing molten core & spinning rune ring
      addPart('stone', 1.68, 0.34, 1.68, 0, 0.17, 0, 0x57534e);
      addPart('metal', 1.34, 0.2, 1.34, 0, 0.44, 0, 0x92400e);
      addPart('stone', 1.12, 0.78, 1.12, 0, 0.92, 0, 0x78716c);
      // 4 gilded corner forge pillars
      for (const sx of [-0.52, 0.52]) {
        for (const sz of [-0.52, 0.52]) {
          addPart('metal', 0.26, 1.08, 0.26, sx, 1.24, sz, 0xb45309);
          addPart('metal', 0.32, 0.12, 0.32, sx, 1.82, sz, 0xfbbf24);
        }
      }
      // Gilded anvil crown & glowing molten forge grates
      addPart('metal', 1.02, 0.22, 1.02, 0, 1.42, 0, 0xfbbf24);
      addPart('glow', 0.44, 0.36, 1.16, 0, 0.9, 0, 0xfb923c);
      addPart('glow', 1.16, 0.36, 0.44, 0, 0.9, 0, 0xfb923c);

      const ringGeo = new THREE.TorusGeometry(0.44, 0.09, 6, 8).toNonIndexed();
      const cCount = ringGeo.getAttribute('position').count;
      const cCols = new Float32Array(cCount * 3);
      const cCol = new THREE.Color(0x38bdf8);
      for (let i = 0; i < cCount; i++) {
        cCols[i * 3] = cCol.r;
        cCols[i * 3 + 1] = cCol.g;
        cCols[i * 3 + 2] = cCol.b;
      }
      ringGeo.setAttribute('color', new THREE.BufferAttribute(cCols, 3));
      const runeRing = new THREE.Mesh(ringGeo, mats.glow);
      runeRing.position.set(0, 2.24, 0);
      root.add(runeRing);
      animatedPart = runeRing;
      baseAnimY = 2.24;
      break;
    }

    case 'lizardfolk':
    default: {
      // Great Solar Ziggurat: 4-tier carved sandstone & jade pyramid, grand 4-sided stairs, corner fire braziers & levitating solar crystal
      addPart('stone', 1.74, 0.34, 1.74, 0, 0.17, 0, 0xd97706);
      addPart('stone', 1.4, 0.34, 1.4, 0, 0.51, 0, 0x10b981);
      addPart('stone', 1.06, 0.34, 1.06, 0, 0.85, 0, 0xeab308);
      addPart('stone', 0.72, 0.34, 0.72, 0, 1.19, 0, 0x059669);
      // Grand central stair ramps on all 4 cardinal sides
      addPart('stone', 0.36, 1.24, 1.82, 0, 0.62, 0, 0xf59e0b);
      addPart('stone', 1.82, 1.24, 0.36, 0, 0.62, 0, 0xf59e0b);
      // 4 gilded temple sanctum pillars + glowing corner fire braziers
      for (const sx of [-0.26, 0.26]) {
        for (const sz of [-0.26, 0.26]) {
          addPart('metal', 0.12, 0.42, 0.12, sx, 1.54, sz, 0xfbbf24);
        }
      }
      for (const [bx, bz] of [[-0.72, 0.72], [0.72, 0.72], [-0.72, -0.72], [0.72, -0.72]] as const) {
        addPart('stone', 0.18, 0.22, 0.18, bx, 0.44, bz, 0xb45309);
        addPart('glow', 0.12, 0.14, 0.12, bx, 0.62, bz, 0xfde047);
      }

      const sunGeo = new THREE.OctahedronGeometry(0.34, 0).toNonIndexed();
      const cCount = sunGeo.getAttribute('position').count;
      const cCols = new Float32Array(cCount * 3);
      const cCol = new THREE.Color(0xfef08a);
      for (let i = 0; i < cCount; i++) {
        cCols[i * 3] = cCol.r;
        cCols[i * 3 + 1] = cCol.g;
        cCols[i * 3 + 2] = cCol.b;
      }
      sunGeo.setAttribute('color', new THREE.BufferAttribute(cCols, 3));
      const sunCrystal = new THREE.Mesh(sunGeo, mats.glow);
      sunCrystal.position.set(0, 2.08, 0);
      root.add(sunCrystal);
      animatedPart = sunCrystal;
      baseAnimY = 2.08;
      break;
    }
  }

  // M1: Progressive Era Visual Evolution for World Wonders (Epochs 3..7)
  if (epochLevel >= 3) {
    // Industrial Era: Riveted iron corner buttresses & warm furnace beacon braziers
    for (const [cx, cz] of [[-0.86, -0.86], [0.86, -0.86], [-0.86, 0.86], [0.86, 0.86]] as const) {
      addPart('metal', 0.16, 0.62, 0.16, cx, 0.31, cz, 0x64748b);
      addPart('glow', 0.1, 0.14, 0.1, cx, 0.68, cz, epochLevel >= 5 ? 0x38bdf8 : 0xfbbf24);
    }
  }
  if (epochLevel >= 4) {
    // Atomic Era: Reinforced perimeter plinth ring & dual high-energy floodlight pylons
    addPart('stone', 2.02, 0.12, 2.02, 0, 0.06, 0, 0x94a3b8);
    addPart('metal', 0.14, 1.35, 0.14, -0.94, 0.68, 0, 0xcbd5e1);
    addPart('metal', 0.14, 1.35, 0.14, 0.94, 0.68, 0, 0xcbd5e1);
    addPart('glow', 0.16, 0.16, 0.16, -0.94, 1.42, 0, 0x38bdf8);
    addPart('glow', 0.16, 0.16, 0.16, 0.94, 1.42, 0, 0x38bdf8);
  }
  if (epochLevel >= 5) {
    // Information Era: Holographic data fins & cyan sky-transceiver needles
    for (const [cx, cz] of [[0, -0.94], [0, 0.94]] as const) {
      addPart('metal', 0.12, 1.85, 0.12, cx, 0.92, cz, 0xe2e8f0);
      addPart('glow', 0.08, 0.42, 0.08, cx, 1.98, cz, 0x22d3ee);
    }
  }
  if (epochLevel >= 6) {
    // Orbital Era: Elevated titanium ring canopy & vertical orbital resonance beam
    addPart('metal', 1.64, 0.08, 0.14, 0, 1.92, -0.78, 0xe2e8f0);
    addPart('metal', 1.64, 0.08, 0.14, 0, 1.92, 0.78, 0xe2e8f0);
    addPart('metal', 0.14, 0.08, 1.64, -0.78, 1.92, 0, 0xe2e8f0);
    addPart('metal', 0.14, 0.08, 1.64, 0.78, 1.92, 0, 0xe2e8f0);
    const orbitalBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, epochLevel >= 7 ? 3.8 : 2.6, 6),
      mats.beam,
    );
    orbitalBeam.position.set(0, epochLevel >= 7 ? 3.3 : 2.7, 0);
    root.add(orbitalBeam);
  }
  if (epochLevel >= 7) {
    // Star Age (Interstellar): Gilded stellar crown & twin radiant cosmic obelisks
    addPart('metal', 1.18, 0.12, 1.18, 0, 2.55, 0, 0xfbbf24);
    addPart('glow', 0.88, 0.1, 0.88, 0, 2.66, 0, 0x67e8f9);
    for (const [cx, cz] of [[-0.96, -0.96], [0.96, -0.96], [-0.96, 0.96], [0.96, 0.96]] as const) {
      addPart('metal', 0.12, 2.25, 0.12, cx, 1.12, cz, 0xf59e0b);
      addPart('glow', 0.16, 0.22, 0.16, cx, 2.34, cz, 0xfef08a);
    }
  }

  // Merge each material bucket into ONE draw call and strip invisible -Y underside triangles
  const bucketKeys: MaterialBucket[] = ['stone', 'wood', 'foliage', 'metal', 'cloth', 'glow'];
  for (const key of bucketKeys) {
    const parts = buckets[key];
    if (parts.length === 0) continue;
    const merged = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (!merged) continue;
    const stripped = stripDownwardTriangles(merged);
    const mesh = new THREE.Mesh(stripped, mats[key]);
    mesh.castShadow = key !== 'glow';
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  return { root, animatedPart, baseAnimY };
}

function disposeWonderGeometries(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
  });
}

/**
 * Renders Phase 4 Monuments:
 * - Race-themed World Wonders (pixel-textured, merged-bucket optimized 3D monuments)
 * - Battle Memorials (instanced pixel-textured stone obelisks + gilded bronze plaques)
 */
export function createMonumentsSystem(): MonumentsSystem {
  const group = new THREE.Group();
  group.name = 'monuments_group';

  const sharedMats = createSharedWonderMaterials();
  const wonderVisuals = new Map<string, WonderVisual>();

  // Instanced Battle Memorials (2 draw calls total for all memorials, now with pixel-art textures!)
  const MAX_MEMORIALS = 32;
  const obeliskGeo = new THREE.BoxGeometry(0.28, 0.78, 0.28);
  const obeliskMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e2e8f0'),
    map: getPixelArtTexture('memorial_stone', '#cbd5e1', '#f8fafc', '#64748b', 'stone'),
    roughness: 0.82,
    metalness: 0.1,
  });
  const plaqueGeo = new THREE.BoxGeometry(0.46, 0.14, 0.46);
  const plaqueMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#cbd5e1'),
    map: getPixelArtTexture('memorial_bronze', '#94a3b8', '#fde68a', '#475569', 'tech'),
    emissive: new THREE.Color('#f59e0b'),
    emissiveIntensity: 0.2,
    roughness: 0.58,
    metalness: 0.35,
  });
  const obeliskInst = new THREE.InstancedMesh(obeliskGeo, obeliskMat, MAX_MEMORIALS);
  const plaqueInst = new THREE.InstancedMesh(plaqueGeo, plaqueMat, MAX_MEMORIALS);
  obeliskInst.count = 0;
  plaqueInst.count = 0;
  obeliskInst.visible = false;
  plaqueInst.visible = false;
  obeliskInst.frustumCulled = false;
  plaqueInst.frustumCulled = false;
  obeliskInst.castShadow = true;

  group.add(obeliskInst, plaqueInst);

  let lastMemorialSig = '';
  const dummy = new THREE.Object3D();

  const update = (state: SimulationState, elapsed: number) => {
    const gs = state.gridSize;
    const wonders: WorldWonder[] = state.worldWonders ?? [];

    // 1. Sync World Wonders (with construction progress scale-up & 8-epoch visual evolution)
    const activeIds = new Set<string>();
    for (let i = 0; i < wonders.length; i++) {
      const w = wonders[i];
      activeIds.add(w.id);
      const wonderEpoch = Math.max(0, Math.min(7, w.epochLevel ?? state.kingdomEpochs?.[w.kingdomId] ?? 2));
      let vis = wonderVisuals.get(w.id);
      if (!vis || vis.epochLevel !== wonderEpoch) {
        if (vis) {
          group.remove(vis.root);
          disposeWonderGeometries(vis.root);
        }
        const built = buildRaceWonderMesh(w.species, wonderEpoch, sharedMats);
        vis = {
          id: w.id,
          species: w.species,
          epochLevel: wonderEpoch,
          root: built.root,
          animatedPart: built.animatedPart,
          baseAnimY: built.baseAnimY,
        };
        wonderVisuals.set(w.id, vis);
        group.add(vis.root);
      }
      const tile = state.tiles[w.tileZ * gs + w.tileX];
      if (!tile || tile.height <= 0) {
        vis.root.visible = false;
        continue;
      }
      vis.root.visible = true;
      const groundY = tile.height * 0.45 + 0.25;
      vis.root.position.set(w.tileX, groundY, w.tileZ);

      const prog = Math.max(0, Math.min(100, w.constructionProgress ?? 100));
      const scaleY = prog < 100 ? 0.26 + 0.74 * (prog / 100) : 1.0;
      vis.root.scale.set(1, scaleY, 1);

      if (vis.animatedPart) {
        vis.animatedPart.visible = prog >= 100;
        if (prog >= 100) {
          vis.animatedPart.rotation.y = elapsed * (w.species === 'human' ? 1.4 : 1.05);
          vis.animatedPart.position.y = vis.baseAnimY + Math.sin(elapsed * 2.4 + i) * 0.08;
        }
      }
    }

    for (const [id, vis] of wonderVisuals.entries()) {
      if (!activeIds.has(id)) {
        group.remove(vis.root);
        disposeWonderGeometries(vis.root);
        wonderVisuals.delete(id);
      }
    }

    // 2. Sync Battle Memorials (hash ALL memorials including tile elevation so terrain changes always resync)
    const memorials: BattleMemorial[] = state.battleMemorials ?? [];
    let memSig = `${memorials.length}`;
    for (let i = 0; i < memorials.length; i++) {
      const m = memorials[i];
      const tile = state.tiles[m.tileZ * gs + m.tileX];
      const h = tile ? tile.height : -1;
      memSig += `|${m.id}:${m.tileX},${m.tileZ},${h}`;
    }
    if (memSig !== lastMemorialSig) {
      lastMemorialSig = memSig;
      let count = 0;
      for (let i = 0; i < memorials.length && count < MAX_MEMORIALS; i++) {
        const m = memorials[i];
        const tile = state.tiles[m.tileZ * gs + m.tileX];
        if (!tile || tile.height <= 0) continue;
        const groundY = tile.height * 0.45 + 0.25;

        dummy.position.set(m.tileX, groundY + 0.07, m.tileZ);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        plaqueInst.setMatrixAt(count, dummy.matrix);

        dummy.position.set(m.tileX, groundY + 0.46, m.tileZ);
        dummy.rotation.set(0, ((m.tileX + m.tileZ) & 3) * (Math.PI / 4), 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        obeliskInst.setMatrixAt(count, dummy.matrix);
        count++;
      }
      obeliskInst.count = count;
      plaqueInst.count = count;
      obeliskInst.visible = count > 0;
      plaqueInst.visible = count > 0;
      if (count > 0) {
        obeliskInst.instanceMatrix.needsUpdate = true;
        plaqueInst.instanceMatrix.needsUpdate = true;
      }
    }
  };

  const dispose = () => {
    for (const vis of wonderVisuals.values()) {
      disposeWonderGeometries(vis.root);
    }
    wonderVisuals.clear();
    sharedMats.stone.dispose();
    sharedMats.wood.dispose();
    sharedMats.foliage.dispose();
    sharedMats.metal.dispose();
    sharedMats.cloth.dispose();
    sharedMats.glow.dispose();
    sharedMats.beam.dispose();
    obeliskGeo.dispose();
    obeliskMat.dispose();
    plaqueGeo.dispose();
    plaqueMat.dispose();
  };

  return { group, update, dispose };
}
