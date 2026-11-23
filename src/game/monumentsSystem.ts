import * as THREE from 'three';
import type { BattleMemorial, SimulationState, SpeciesId, WorldWonder } from './types';

export interface MonumentsSystem {
  group: THREE.Group;
  update: (state: SimulationState, elapsed: number) => void;
  dispose: () => void;
}

interface WonderVisual {
  id: string;
  species: SpeciesId;
  root: THREE.Group;
  animatedPart?: THREE.Object3D;
  baseAnimY: number;
}

function buildRaceWonderMesh(species: SpeciesId): {
  root: THREE.Group;
  animatedPart?: THREE.Object3D;
  baseAnimY: number;
} {
  const root = new THREE.Group();

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: number,
    emissive = 0x000000,
    emissiveIntensity = 0,
    metalness = 0.15,
    roughness = 0.65,
  ) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity,
      metalness,
      roughness,
      flatShading: true,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    return m;
  };

  switch (species) {
    case 'human': {
      // Grand Sun Lighthouse: stepped marble plinth + fluted alabaster tower + rotating golden beacon
      addBox(1.55, 0.28, 1.55, 0, 0.14, 0, 0xd6d3d1, 0, 0, 0.1, 0.78);
      addBox(1.18, 0.34, 1.18, 0, 0.45, 0, 0xe7e5e4, 0, 0, 0.1, 0.72);
      addBox(0.76, 1.45, 0.76, 0, 1.34, 0, 0xf5f5f4, 0, 0, 0.12, 0.62);
      addBox(0.92, 0.16, 0.92, 0, 2.12, 0, 0xfbbf24, 0xd97706, 0.25, 0.55, 0.35);
      // Beacon turret
      const beacon = new THREE.Group();
      beacon.position.set(0, 2.48, 0);
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xf59e0b,
          emissiveIntensity: 1.35,
          roughness: 0.15,
          flatShading: true,
        }),
      );
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.14, 0.14),
        new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.65,
        }),
      );
      beacon.add(core, beam);
      root.add(beacon);
      return { root, animatedPart: beacon, baseAnimY: 2.48 };
    }

    case 'elf': {
      // World Tree Sanctuary: sculpted ancient trunk + lush tiered blossom-emerald canopy + floating spirit crown
      addBox(1.4, 0.22, 1.4, 0, 0.11, 0, 0x86efac, 0, 0, 0.05, 0.85);
      addBox(0.58, 1.35, 0.58, 0, 0.88, 0, 0x78350f, 0, 0, 0.05, 0.9);
      addBox(1.55, 0.48, 1.55, 0, 1.72, 0, 0x22c55e, 0x15803d, 0.15, 0.05, 0.75);
      addBox(1.22, 0.44, 1.22, 0, 2.16, 0, 0xf472b6, 0xdb2777, 0.22, 0.05, 0.7);
      addBox(0.76, 0.36, 0.76, 0, 2.54, 0, 0x4ade80, 0x22c55e, 0.2, 0.05, 0.7);
      const crown = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshStandardMaterial({
          color: 0xa7f3d0,
          emissive: 0x34d399,
          emissiveIntensity: 1.15,
          roughness: 0.2,
          flatShading: true,
        }),
      );
      crown.position.set(0, 2.98, 0);
      root.add(crown);
      return { root, animatedPart: crown, baseAnimY: 2.98 };
    }

    case 'orc': {
      // Iron War Colossus: dark iron bastion + twin horned obsidian spires + blazing magma brazier
      addBox(1.6, 0.32, 1.6, 0, 0.16, 0, 0x292524, 0, 0, 0.35, 0.7);
      addBox(1.05, 1.2, 0.9, 0, 0.92, 0, 0x44403c, 0, 0, 0.55, 0.55);
      addBox(0.26, 1.1, 0.26, -0.58, 1.8, 0, 0x1c1917, 0, 0, 0.65, 0.45);
      addBox(0.26, 1.1, 0.26, 0.58, 1.8, 0, 0x1c1917, 0, 0, 0.65, 0.45);
      addBox(1.28, 0.24, 0.38, 0, 1.56, 0, 0x991b1b, 0x7f1d1d, 0.2, 0.2, 0.65);
      const brazier = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.36, 0),
        new THREE.MeshStandardMaterial({
          color: 0xfb923c,
          emissive: 0xff3b00,
          emissiveIntensity: 1.4,
          roughness: 0.25,
          flatShading: true,
        }),
      );
      brazier.position.set(0, 2.02, 0);
      root.add(brazier);
      return { root, animatedPart: brazier, baseAnimY: 2.02 };
    }

    case 'dwarf': {
      // Runic Titan Forge: heavy granite-bronze plinth + twin anvil pillars + spinning mithril rune ring
      addBox(1.62, 0.36, 1.62, 0, 0.18, 0, 0x57534e, 0, 0, 0.3, 0.72);
      addBox(1.2, 0.85, 1.2, 0, 0.78, 0, 0x92400e, 0, 0, 0.62, 0.42);
      addBox(0.32, 0.95, 0.32, -0.46, 1.52, -0.46, 0xb45309, 0, 0, 0.72, 0.35);
      addBox(0.32, 0.95, 0.32, 0.46, 1.52, 0.46, 0xb45309, 0, 0, 0.72, 0.35);
      addBox(0.95, 0.22, 0.95, 0, 1.32, 0, 0xfbbf24, 0xd97706, 0.22, 0.75, 0.3);
      const runeRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.46, 0.1, 6, 8),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 1.15,
          metalness: 0.6,
          roughness: 0.2,
          flatShading: true,
        }),
      );
      runeRing.position.set(0, 2.15, 0);
      root.add(runeRing);
      return { root, animatedPart: runeRing, baseAnimY: 2.15 };
    }

    case 'lizardfolk':
    default: {
      // Great Solar Ziggurat: 4-tier stepped sandstone & jade pyramid + levitating solar crystal
      addBox(1.7, 0.34, 1.7, 0, 0.17, 0, 0xd97706, 0, 0, 0.12, 0.78);
      addBox(1.36, 0.36, 1.36, 0, 0.52, 0, 0x10b981, 0x059669, 0.14, 0.18, 0.65);
      addBox(1.02, 0.36, 1.02, 0, 0.88, 0, 0xeab308, 0, 0, 0.25, 0.6);
      addBox(0.68, 0.34, 0.68, 0, 1.23, 0, 0x059669, 0x047857, 0.2, 0.2, 0.58);
      const sunCrystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.36, 0),
        new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xfacc15,
          emissiveIntensity: 1.45,
          roughness: 0.12,
          metalness: 0.3,
          flatShading: true,
        }),
      );
      sunCrystal.position.set(0, 1.98, 0);
      root.add(sunCrystal);
      return { root, animatedPart: sunCrystal, baseAnimY: 1.98 };
    }
  }
}

function disposeObjectTree(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) m.dispose();
      } else {
        mesh.material.dispose();
      }
    }
  });
}

/**
 * Renders Phase 4 Monuments:
 * - Race-themed World Wonders (bespoke multi-part animated 3D structures)
 * - Battle Memorials (instanced stone obelisks + crimson/gold war-sword plaques)
 */
export function createMonumentsSystem(): MonumentsSystem {
  const group = new THREE.Group();
  group.name = 'monuments_group';

  const wonderVisuals = new Map<string, WonderVisual>();

  // Instanced Battle Memorials (2 draw calls total for all memorials)
  const MAX_MEMORIALS = 32;
  const obeliskGeo = new THREE.BoxGeometry(0.28, 0.78, 0.28);
  const obeliskMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#cbd5e1'),
    roughness: 0.82,
    metalness: 0.1,
    flatShading: true,
  });
  const plaqueGeo = new THREE.BoxGeometry(0.46, 0.14, 0.46);
  const plaqueMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#64748b'),
    emissive: new THREE.Color('#f59e0b'),
    emissiveIntensity: 0.22,
    roughness: 0.65,
    metalness: 0.25,
    flatShading: true,
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

  let lastMemorialSig = -1;
  const dummy = new THREE.Object3D();

  const update = (state: SimulationState, elapsed: number) => {
    const gs = state.gridSize;
    const wonders: WorldWonder[] = state.worldWonders ?? [];

    // 1. Sync World Wonders
    const activeIds = new Set<string>();
    for (let i = 0; i < wonders.length; i++) {
      const w = wonders[i];
      activeIds.add(w.id);
      let vis = wonderVisuals.get(w.id);
      if (!vis) {
        const built = buildRaceWonderMesh(w.species);
        vis = {
          id: w.id,
          species: w.species,
          root: built.root,
          animatedPart: built.animatedPart,
          baseAnimY: built.baseAnimY,
        };
        wonderVisuals.set(w.id, vis);
        group.add(vis.root);
      }
      const tile = state.tiles[w.tileZ * gs + w.tileX];
      const groundY = tile && tile.height > 0 ? tile.height * 0.45 + 0.25 : 0.25;
      vis.root.position.set(w.tileX, groundY, w.tileZ);

      if (vis.animatedPart) {
        vis.animatedPart.rotation.y = elapsed * (w.species === 'human' ? 1.4 : 1.05);
        vis.animatedPart.position.y = vis.baseAnimY + Math.sin(elapsed * 2.4 + i) * 0.08;
      }
    }

    for (const [id, vis] of wonderVisuals.entries()) {
      if (!activeIds.has(id)) {
        group.remove(vis.root);
        disposeObjectTree(vis.root);
        wonderVisuals.delete(id);
      }
    }

    // 2. Sync Battle Memorials (only rebuild matrices when count/list changes)
    const memorials: BattleMemorial[] = state.battleMemorials ?? [];
    const memSig =
      memorials.length > 0
        ? memorials.length * 10007 + memorials[memorials.length - 1].tileX * 97 + memorials[memorials.length - 1].tileZ
        : 0;
    if (memSig !== lastMemorialSig) {
      lastMemorialSig = memSig;
      const count = Math.min(MAX_MEMORIALS, memorials.length);
      for (let i = 0; i < count; i++) {
        const m = memorials[i];
        const tile = state.tiles[m.tileZ * gs + m.tileX];
        const groundY = tile && tile.height > 0 ? tile.height * 0.45 + 0.25 : 0.25;

        dummy.position.set(m.tileX, groundY + 0.07, m.tileZ);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        plaqueInst.setMatrixAt(i, dummy.matrix);

        dummy.position.set(m.tileX, groundY + 0.46, m.tileZ);
        dummy.rotation.set(0, ((m.tileX + m.tileZ) & 3) * (Math.PI / 4), 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        obeliskInst.setMatrixAt(i, dummy.matrix);
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
      disposeObjectTree(vis.root);
    }
    wonderVisuals.clear();
    obeliskGeo.dispose();
    obeliskMat.dispose();
    plaqueGeo.dispose();
    plaqueMat.dispose();
  };

  return { group, update, dispose };
}
