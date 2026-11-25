import * as THREE from 'three';
import { getPixelArtTexture } from './meshBuilders';
import type { SimulationState, TileData } from './types';

export interface SpectacleEffectsSystem {
  group: THREE.Group;
  spawnFestival: (x: number, y: number, z: number, accentHex?: string) => void;
  syncRuins: (tiles: TileData[]) => void;
  update: (
    dt: number,
    elapsed: number,
    state: SimulationState,
    detail: 'full' | 'reduced' | 'low',
  ) => void;
  dispose: () => void;
}

interface LanternParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  colorHex: number;
  isFirework: boolean;
  hasBurst: boolean;
}

interface MistParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  scale: number;
  colorHex: number;
}

/**
 * Phase 3 World Landmarks & Spectacle renderer:
 * 1. Ancient Ruin stone archways + glowing floating rune orbs (vanish when explored)
 * 2. Town Festival floating sky lanterns & firework bursts
 * 3. Waterfall mist / magma embers / toxic fumes where elevated stacked lakes spill over cliffs
 */
export function createSpectacleEffectsSystem(initialTiles: TileData[]): SpectacleEffectsSystem {
  const group = new THREE.Group();
  group.name = 'spectacle_effects_group';

  // --- 1. Ancient Ruins (stone pillars + floating rune orbs) ---
  const MAX_RUINS = 64;
  const ruinPillarGeo = new THREE.BoxGeometry(0.24, 0.92, 0.24);
  const ruinArchGeo = new THREE.BoxGeometry(0.86, 0.2, 0.28);
  const ruinStoneMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d6d3d1'),
    map: getPixelArtTexture('ancient_ruin_stone', '#9ca3af', '#cbd5e1', '#52525b', 'stone'),
    roughness: 0.88,
    metalness: 0.06,
  });
  const ruinOrbGeo = new THREE.OctahedronGeometry(0.18, 0);
  const ruinOrbMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#38bdf8'),
    emissive: new THREE.Color('#facc15'),
    emissiveIntensity: 0.95,
    roughness: 0.15,
    metalness: 0.3,
    flatShading: true,
  });

  const ruinPillarInst = new THREE.InstancedMesh(ruinPillarGeo, ruinStoneMat, MAX_RUINS * 2);
  const ruinArchInst = new THREE.InstancedMesh(ruinArchGeo, ruinStoneMat, MAX_RUINS);
  const ruinOrbInst = new THREE.InstancedMesh(ruinOrbGeo, ruinOrbMat, MAX_RUINS);
  ruinPillarInst.frustumCulled = false;
  ruinArchInst.frustumCulled = false;
  ruinOrbInst.frustumCulled = false;
  ruinPillarInst.castShadow = true;
  ruinArchInst.castShadow = true;

  // --- 2. Festival Sky Lanterns & Firework Sparks ---
  const MAX_LANTERNS = 180;
  const lanternGeo = new THREE.BoxGeometry(0.16, 0.2, 0.16);
  const lanternMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.94,
  });
  const lanternInst = new THREE.InstancedMesh(lanternGeo, lanternMat, MAX_LANTERNS);
  lanternInst.count = 0;
  lanternInst.visible = false;
  lanternInst.frustumCulled = false;
  lanternInst.renderOrder = 12;

  // --- 3. Waterfall Mist & Cliff Spill Puffs ---
  const MAX_MIST = 160;
  const mistGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const mistMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  const mistInst = new THREE.InstancedMesh(mistGeo, mistMat, MAX_MIST);
  mistInst.count = 0;
  mistInst.visible = false;
  mistInst.frustumCulled = false;
  mistInst.renderOrder = 6;

  group.add(ruinPillarInst, ruinArchInst, ruinOrbInst, lanternInst, mistInst);

  const unexploredOrbs: Array<{ x: number; y: number; z: number; phase: number }> = [];
  const lanterns: LanternParticle[] = [];
  const mistPuffs: MistParticle[] = [];
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  const syncRuins = (tiles: TileData[]) => {
    let pillarCount = 0;
    let archCount = 0;
    unexploredOrbs.length = 0;

    for (let i = 0; i < tiles.length && archCount < MAX_RUINS; i++) {
      const t = tiles[i];
      if (!t || t.resourceNode !== 'ancient_ruin' || t.height <= 0) continue;
      const groundY = t.height * 0.45 + 0.25;
      const yaw = ((t.x * 31 + t.z * 17) & 3) * (Math.PI / 2);
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);

      // Left & right weathered stone pillars
      dummy.position.set(t.x - cosY * 0.3, groundY + 0.44, t.z + sinY * 0.3);
      dummy.rotation.set(0, yaw, 0.04);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ruinPillarInst.setMatrixAt(pillarCount++, dummy.matrix);

      dummy.position.set(t.x + cosY * 0.3, groundY + 0.38, t.z - sinY * 0.3);
      dummy.rotation.set(0, yaw, -0.05);
      dummy.scale.set(1, 0.88, 1);
      dummy.updateMatrix();
      ruinPillarInst.setMatrixAt(pillarCount++, dummy.matrix);

      // Top lintel arch
      dummy.position.set(t.x, groundY + 0.9, t.z);
      dummy.rotation.set(0, yaw, -0.03);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ruinArchInst.setMatrixAt(archCount++, dummy.matrix);

      // Unexplored ruins get a hovering glowing relic orb!
      if (t.resourceAmount > 0) {
        unexploredOrbs.push({
          x: t.x,
          y: groundY + 1.38,
          z: t.z,
          phase: (t.x * 0.7 + t.z * 1.1) % (Math.PI * 2),
        });
      }
    }

    ruinPillarInst.count = pillarCount;
    ruinPillarInst.visible = pillarCount > 0;
    if (pillarCount > 0) ruinPillarInst.instanceMatrix.needsUpdate = true;

    ruinArchInst.count = archCount;
    ruinArchInst.visible = archCount > 0;
    if (archCount > 0) ruinArchInst.instanceMatrix.needsUpdate = true;

    ruinOrbInst.count = unexploredOrbs.length;
    ruinOrbInst.visible = unexploredOrbs.length > 0;
  };

  syncRuins(initialTiles);

  const FESTIVAL_COLORS = [0xfef08a, 0xfbbf24, 0xf472b6, 0x38bdf8, 0x4ade80, 0xfb923c];

  const spawnFestival = (x: number, y: number, z: number, accentHex?: string) => {
    const accentNum = accentHex ? new THREE.Color(accentHex).getHex() : 0xfbbf24;
    // Launch 16 drifting golden sky lanterns
    for (let i = 0; i < 16 && lanterns.length < MAX_LANTERNS; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 0.5 + Math.random() * 3.8;
      lanterns.push({
        x: x + Math.cos(ang) * rad,
        y: y + 0.5 + Math.random() * 0.8,
        z: z + Math.sin(ang) * rad,
        vx: (Math.random() - 0.5) * 0.45,
        vy: 0.75 + Math.random() * 0.55,
        vz: (Math.random() - 0.5) * 0.45,
        age: 0,
        life: 4.5 + Math.random() * 3.2,
        colorHex: i % 3 === 0 ? accentNum : i % 2 === 0 ? 0xfef08a : 0xfb923c,
        isFirework: false,
        hasBurst: false,
      });
    }
    // Launch 4 rising firework rockets that burst overhead
    for (let f = 0; f < 4 && lanterns.length < MAX_LANTERNS; f++) {
      lanterns.push({
        x: x + (Math.random() - 0.5) * 3.2,
        y: y + 0.4,
        z: z + (Math.random() - 0.5) * 3.2,
        vx: (Math.random() - 0.5) * 0.35,
        vy: 4.2 + Math.random() * 1.4,
        vz: (Math.random() - 0.5) * 0.35,
        age: 0,
        life: 0.95 + Math.random() * 0.35,
        colorHex: FESTIVAL_COLORS[Math.floor(Math.random() * FESTIVAL_COLORS.length)],
        isFirework: true,
        hasBurst: false,
      });
    }
  };

  let mistSpawnTimer = 0;
  let ruinResyncTimer = 0;

  const update = (
    dt: number,
    elapsed: number,
    state: SimulationState,
    detail: 'full' | 'reduced' | 'low',
  ) => {
    // Periodically sync ruins so explored orbs disappear cleanly
    ruinResyncTimer += dt;
    if (ruinResyncTimer >= 1.2) {
      ruinResyncTimer = 0;
      syncRuins(state.tiles);
    }

    // 1. Animate hovering rune orbs above unexplored ruins
    if (unexploredOrbs.length > 0) {
      for (let i = 0; i < unexploredOrbs.length; i++) {
        const o = unexploredOrbs[i];
        const bob = Math.sin(elapsed * 2.8 + o.phase) * 0.14;
        dummy.position.set(o.x, o.y + bob, o.z);
        dummy.rotation.set(elapsed * 0.9, elapsed * 1.8 + o.phase, 0);
        dummy.scale.setScalar(0.92 + Math.sin(elapsed * 3.5 + o.phase) * 0.12);
        dummy.updateMatrix();
        ruinOrbInst.setMatrixAt(i, dummy.matrix);
      }
      ruinOrbInst.count = unexploredOrbs.length;
      ruinOrbInst.visible = true;
      ruinOrbInst.instanceMatrix.needsUpdate = true;
    } else if (ruinOrbInst.visible) {
      ruinOrbInst.visible = false;
    }

    // 2. Step Festival Lanterns & Fireworks
    for (let i = lanterns.length - 1; i >= 0; i--) {
      const p = lanterns[i];
      p.age += dt;
      if (p.age >= p.life) {
        if (p.isFirework && !p.hasBurst) {
          p.hasBurst = true;
          const burstColor = FESTIVAL_COLORS[Math.floor(Math.random() * FESTIVAL_COLORS.length)];
          const sparkCount = detail === 'low' ? 6 : 12;
          for (let s = 0; s < sparkCount && lanterns.length < MAX_LANTERNS; s++) {
            const theta = (s / sparkCount) * Math.PI * 2 + Math.random() * 0.25;
            const elev = (Math.random() - 0.35) * 2.2;
            const spd = 1.8 + Math.random() * 1.3;
            lanterns.push({
              x: p.x,
              y: p.y,
              z: p.z,
              vx: Math.cos(theta) * spd,
              vy: elev,
              vz: Math.sin(theta) * spd,
              age: 0,
              life: 0.75 + Math.random() * 0.45,
              colorHex: s % 2 === 0 ? burstColor : 0xfef08a,
              isFirework: false,
              hasBurst: true,
            });
          }
        }
        lanterns.splice(i, 1);
        continue;
      }
      if (p.hasBurst) {
        // Firework spark gravity
        p.vy -= 2.4 * dt;
        p.vx *= 0.97;
        p.vz *= 0.97;
      } else if (!p.isFirework) {
        // Gentle lantern sway
        p.x += Math.sin(elapsed * 1.9 + i) * 0.18 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }

    if (lanterns.length > 0) {
      for (let i = 0; i < lanterns.length; i++) {
        const p = lanterns[i];
        const fade = Math.max(0.05, 1 - p.age / p.life);
        const sc = p.hasBurst ? 0.55 * fade : p.isFirework ? 0.7 : 0.85 * Math.min(1, fade * 2.2);
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, elapsed + i, 0);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        lanternInst.setMatrixAt(i, dummy.matrix);
        tmpColor.setHex(p.colorHex);
        lanternInst.setColorAt(i, tmpColor);
      }
      lanternInst.count = lanterns.length;
      lanternInst.visible = true;
      lanternInst.instanceMatrix.needsUpdate = true;
      if (lanternInst.instanceColor) lanternInst.instanceColor.needsUpdate = true;
    } else if (lanternInst.visible) {
      lanternInst.count = 0;
      lanternInst.visible = false;
    }

    // 3. Waterfall Mist & Cliff Spill Puffs
    mistSpawnTimer += dt;
    const spawnInterval = detail === 'low' ? 0.35 : detail === 'reduced' ? 0.22 : 0.14;
    if (mistSpawnTimer >= spawnInterval) {
      mistSpawnTimer = 0;
      const gs = state.gridSize;
      const tiles = state.tiles;
      let spawned = 0;
      for (let z = 1; z < gs - 1 && spawned < 6 && mistPuffs.length < MAX_MIST; z++) {
        const rowOff = z * gs;
        for (let x = 1; x < gs - 1 && spawned < 6 && mistPuffs.length < MAX_MIST; x++) {
          const t = tiles[rowOff + x];
          if (!t || (t.liquidLevel ?? 0) <= t.height) continue;
          const lvl = t.liquidLevel!;
          // Check if this elevated liquid borders a cliff drop
          const nbs = [
            tiles[rowOff + x + 1],
            tiles[rowOff + x - 1],
            tiles[rowOff + gs + x],
            tiles[rowOff - gs + x],
          ];
          for (let d = 0; d < 4; d++) {
            const nb = nbs[d];
            if (!nb) continue;
            if (Math.max(nb.height, nb.liquidLevel ?? 0) <= lvl - 2) {
              if (Math.random() < 0.32) {
                const edgeX = (t.x + nb.x) * 0.5 + (Math.random() - 0.5) * 0.4;
                const edgeZ = (t.z + nb.z) * 0.5 + (Math.random() - 0.5) * 0.4;
                const dropY = Math.max(0.35, nb.height * 0.45 + 0.38);
                const col =
                  t.liquidKind === 'lava'
                    ? 0xfb923c
                    : t.liquidKind === 'poison'
                      ? 0xa3e635
                      : 0xe0f2fe;
                mistPuffs.push({
                  x: edgeX,
                  y: dropY,
                  z: edgeZ,
                  vx: (nb.x - t.x) * 0.45 + (Math.random() - 0.5) * 0.25,
                  vy: 0.55 + Math.random() * 0.45,
                  vz: (nb.z - t.z) * 0.45 + (Math.random() - 0.5) * 0.25,
                  age: 0,
                  life: 0.85 + Math.random() * 0.55,
                  scale: 0.65 + Math.random() * 0.55,
                  colorHex: col,
                });
                spawned++;
              }
              break;
            }
          }
        }
      }
    }

    for (let i = mistPuffs.length - 1; i >= 0; i--) {
      const m = mistPuffs[i];
      m.age += dt;
      if (m.age >= m.life) {
        mistPuffs.splice(i, 1);
        continue;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.z += m.vz * dt;
      m.vy *= 0.96;
    }

    if (mistPuffs.length > 0) {
      for (let i = 0; i < mistPuffs.length; i++) {
        const m = mistPuffs[i];
        const u = m.age / m.life;
        const sc = m.scale * (0.6 + u * 0.8) * (1 - u * 0.65);
        dummy.position.set(m.x, m.y, m.z);
        dummy.rotation.set(u * 2, u * 1.5, 0);
        dummy.scale.setScalar(Math.max(0.05, sc));
        dummy.updateMatrix();
        mistInst.setMatrixAt(i, dummy.matrix);
        tmpColor.setHex(m.colorHex);
        mistInst.setColorAt(i, tmpColor);
      }
      mistInst.count = mistPuffs.length;
      mistInst.visible = true;
      mistInst.instanceMatrix.needsUpdate = true;
      if (mistInst.instanceColor) mistInst.instanceColor.needsUpdate = true;
    } else if (mistInst.visible) {
      mistInst.count = 0;
      mistInst.visible = false;
    }
  };

  const dispose = () => {
    ruinPillarGeo.dispose();
    ruinArchGeo.dispose();
    ruinStoneMat.dispose();
    ruinOrbGeo.dispose();
    ruinOrbMat.dispose();
    lanternGeo.dispose();
    lanternMat.dispose();
    mistGeo.dispose();
    mistMat.dispose();
  };

  return { group, spawnFestival, syncRuins, update, dispose };
}
