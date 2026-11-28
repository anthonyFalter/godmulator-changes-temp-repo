import * as THREE from 'three';
import type { SimulationState, UnitEntity } from './types';

export type BubbleIconKind =
  | 'combat'
  | 'build'
  | 'harvest'
  | 'mine'
  | 'danger'
  | 'happy'
  | 'eureka';

export interface CitizenBubbleSystem {
  group: THREE.Group;
  update: (
    state: SimulationState,
    elapsed: number,
    focusX: number,
    focusZ: number,
    frustumSize: number,
  ) => void;
  dispose: () => void;
}

const MAX_BUBBLES = 28;

function createBubbleTexture(kind: BubbleIconKind): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 24;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    // Pixel speech bubble card (dark rim + warm parchment fill + bottom pointer)
    ctx.fillStyle = '#1b1714';
    ctx.fillRect(3, 1, 18, 17);
    ctx.fillRect(2, 2, 20, 15);
    ctx.fillRect(10, 18, 4, 2);
    ctx.fillRect(11, 20, 2, 2);

    ctx.fillStyle = '#fbf4e4';
    ctx.fillRect(4, 2, 16, 15);
    ctx.fillRect(3, 3, 18, 13);
    ctx.fillRect(11, 17, 2, 2);

    // Subtle bottom inner shadow
    ctx.fillStyle = '#e5d7be';
    ctx.fillRect(4, 15, 16, 2);

    // Crisp pixel icon per activity
    switch (kind) {
      case 'combat': {
        // Crossed crimson/steel swords
        ctx.fillStyle = '#dc2626';
        for (let i = 0; i < 9; i++) {
          ctx.fillRect(7 + i, 5 + i, 2, 2);
          ctx.fillRect(15 - i, 5 + i, 2, 2);
        }
        ctx.fillStyle = '#facc15';
        ctx.fillRect(6, 12, 3, 2);
        ctx.fillRect(15, 12, 3, 2);
        break;
      }
      case 'build': {
        // Golden hammer
        ctx.fillStyle = '#92400e';
        ctx.fillRect(11, 8, 2, 7);
        ctx.fillStyle = '#d97706';
        ctx.fillRect(7, 5, 10, 4);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(8, 5, 6, 2);
        break;
      }
      case 'harvest': {
        // Golden wheat sheaf
        ctx.fillStyle = '#65a30d';
        ctx.fillRect(11, 10, 2, 5);
        ctx.fillStyle = '#eab308';
        ctx.fillRect(9, 5, 6, 6);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(10, 4, 4, 3);
        break;
      }
      case 'mine': {
        // Steel pickaxe
        ctx.fillStyle = '#78350f';
        for (let i = 0; i < 6; i++) ctx.fillRect(8 + i, 13 - i, 2, 2);
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(9, 4, 8, 3);
        ctx.fillRect(14, 6, 3, 5);
        ctx.fillStyle = '#bfdbfe';
        ctx.fillRect(10, 5, 5, 1);
        break;
      }
      case 'danger': {
        // Urgent exclamation mark
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(10, 4, 4, 7);
        ctx.fillRect(10, 12, 4, 3);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(11, 5, 2, 5);
        break;
      }
      case 'happy': {
        // Pink heart
        ctx.fillStyle = '#ec4899';
        ctx.fillRect(7, 6, 4, 4);
        ctx.fillRect(13, 6, 4, 4);
        ctx.fillRect(8, 8, 8, 4);
        ctx.fillRect(10, 12, 4, 2);
        ctx.fillRect(11, 14, 2, 1);
        ctx.fillStyle = '#fbcfe8';
        ctx.fillRect(8, 7, 2, 2);
        break;
      }
      case 'eureka': {
        // Glowing star / spark
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(11, 4, 2, 11);
        ctx.fillRect(6, 8, 12, 2);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(9, 7, 6, 4);
        break;
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function classifyCitizenBubble(state: SimulationState, u: UnitEntity): BubbleIconKind | null {
  if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0) return null;

  // Urgent danger / low health / cursed / plagued
  if (
    u.hp < u.maxHp * 0.38 ||
    (u.statusEffects.cursed ?? 0) > 0 ||
    (u.statusEffects.plagued ?? 0) > 0
  ) {
    return 'danger';
  }
  if (u.state === 'fighting') {
    return 'combat';
  }
  if (u.state === 'building') {
    return 'build';
  }
  if (u.state === 'gathering') {
    return u.role === 'miner' ? 'mine' : 'harvest';
  }
  if (u.state === 'researching' || u.state === 'praying') {
    return 'eureka';
  }
  if ((u.statusEffects.blessed ?? 0) > 0) {
    // Show happy/sparkle on a subset of citizens so it feels charming, not noisy
    const hash = (u.id.charCodeAt(u.id.length - 1) ?? 0) & 3;
    if (hash === 0) return 'happy';
  }
  return null;
}

/**
 * Renders crisp zoomed-in pixel-art thought/activity bubbles above active citizens.
 * Automatically hidden when zoomed out (`frustumSize >= 24`) to keep strategic view clean.
 */
export function createCitizenBubbleSystem(): CitizenBubbleSystem {
  const group = new THREE.Group();
  group.name = 'citizen_bubbles_group';

  const kinds: BubbleIconKind[] = [
    'combat',
    'build',
    'harvest',
    'mine',
    'danger',
    'happy',
    'eureka',
  ];
  const textures = new Map<BubbleIconKind, THREE.CanvasTexture>();
  const materials = new Map<BubbleIconKind, THREE.SpriteMaterial>();
  for (const k of kinds) {
    const tex = createBubbleTexture(k);
    textures.set(k, tex);
    materials.set(
      k,
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    );
  }

  const sprites: THREE.Sprite[] = [];
  const defaultMat = materials.get('happy')!;
  for (let i = 0; i < MAX_BUBBLES; i++) {
    const sp = new THREE.Sprite(defaultMat);
    sp.visible = false;
    sp.renderOrder = 25;
    sp.scale.set(0.62, 0.62, 1);
    sprites.push(sp);
    group.add(sp);
  }

  const candidates: Array<{ unit: UnitEntity; kind: BubbleIconKind; distSq: number }> = [];

  const update = (
    state: SimulationState,
    elapsed: number,
    focusX: number,
    focusZ: number,
    frustumSize: number,
  ) => {
    if (frustumSize >= 25) {
      if (group.visible) group.visible = false;
      return;
    }
    group.visible = true;
    const zoomOpacity = Math.min(1, Math.max(0, (25 - frustumSize) / 6));
    const maxDistSq = Math.max(14, frustumSize * 0.95) ** 2;

    candidates.length = 0;
    const units = state.units;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0) continue;
      const dx = u.x - focusX;
      const dz = u.z - focusZ;
      const dSq = dx * dx + dz * dz;
      if (dSq > maxDistSq) continue;
      const kind = classifyCitizenBubble(state, u);
      if (!kind) continue;
      candidates.push({ unit: u, kind, distSq: dSq });
    }

    if (candidates.length > MAX_BUBBLES) {
      candidates.sort((a, b) => a.distSq - b.distSq);
    }

    const showCount = Math.min(MAX_BUBBLES, candidates.length);
    const gs = state.gridSize;
    for (let i = 0; i < showCount; i++) {
      const c = candidates[i];
      const sp = sprites[i];
      const mat = materials.get(c.kind)!;
      if (sp.material !== mat) sp.material = mat;
      mat.opacity = zoomOpacity * 0.94;

      const tx = Math.max(0, Math.min(gs - 1, Math.round(c.unit.x)));
      const tz = Math.max(0, Math.min(gs - 1, Math.round(c.unit.z)));
      const tile = state.tiles[tz * gs + tx];
      const groundY = tile && tile.height > 0 ? tile.height * 0.45 + 0.25 : 0.28;
      const bob = Math.sin(elapsed * 3.4 + i * 1.1) * 0.06;
      const sizeScale = Math.max(0.45, Math.min(0.68, frustumSize * 0.032));

      sp.position.set(c.unit.x, groundY + 1.18 + (c.unit.altitude ?? 0) + bob, c.unit.z);
      sp.scale.set(sizeScale, sizeScale, 1);
      sp.visible = true;
    }

    for (let i = showCount; i < MAX_BUBBLES; i++) {
      sprites[i].visible = false;
    }
  };

  const dispose = () => {
    for (const mat of materials.values()) mat.dispose();
    for (const tex of textures.values()) tex.dispose();
  };

  return { group, update, dispose };
}
