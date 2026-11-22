import * as THREE from 'three';
import { UnitRole } from './types';

// Shared geometry & material caches to keep memory & draw calls minimal
const _boxCache = new Map<string, THREE.BoxGeometry>();
const _octCache = new Map<string, THREE.OctahedronGeometry>();
const _ringCache = new Map<string, THREE.TorusGeometry>();
const _matCache = new Map<string, THREE.MeshStandardMaterial>();

function boxGeo(w: number, h: number, d: number): THREE.BoxGeometry {
  const k = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  let g = _boxCache.get(k);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    _boxCache.set(k, g);
  }
  return g;
}

function octGeo(r: number): THREE.OctahedronGeometry {
  const k = r.toFixed(3);
  let g = _octCache.get(k);
  if (!g) {
    g = new THREE.OctahedronGeometry(r, 0);
    _octCache.set(k, g);
  }
  return g;
}

function torusGeo(r: number, tube: number, segs = 12): THREE.TorusGeometry {
  const k = `${r.toFixed(3)}_${tube.toFixed(3)}_${segs}`;
  let g = _ringCache.get(k);
  if (!g) {
    g = new THREE.TorusGeometry(r, tube, 5, segs);
    _ringCache.set(k, g);
  }
  return g;
}

function glowMat(
  color: number,
  emissive: number,
  emissiveIntensity = 1.6,
  roughness = 0.25,
  metalness = 0.25,
  opacity = 1,
): THREE.MeshStandardMaterial {
  const k = `${color}_${emissive}_${emissiveIntensity.toFixed(2)}_${roughness.toFixed(2)}_${metalness.toFixed(2)}_${opacity.toFixed(2)}`;
  let m = _matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity,
      roughness,
      metalness,
      transparent: opacity < 0.99,
      opacity,
      flatShading: true,
    });
    _matCache.set(k, m);
  }
  return m;
}

function addBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(boxGeo(w, h, d), material);
  mesh.position.set(x, y, z);
  if (rx || ry || rz) mesh.rotation.set(rx, ry, rz);
  parent.add(mesh);
  return mesh;
}

function addCrystal(
  parent: THREE.Object3D,
  radius: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  sy = 1.5,
  rx = 0,
  rz = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(octGeo(radius), material);
  mesh.position.set(x, y, z);
  mesh.scale.set(1, sy, 1);
  if (rx || rz) mesh.rotation.set(rx, 0, rz);
  parent.add(mesh);
  return mesh;
}

function createOrbitAura(
  parent: THREE.Object3D,
  y: number,
  z: number,
  radius: number,
  orbCount: number,
  orbRadius: number,
  orbMat?: THREE.Material,
): THREE.Group {
  const aura = new THREE.Group();
  aura.name = 'mythic_aura_pivot';
  aura.position.set(0, y, z);

  if (orbMat && orbCount > 0) {
    for (let i = 0; i < orbCount; i++) {
      const ang = (i / orbCount) * Math.PI * 2;
      const ox = Math.cos(ang) * radius;
      const oz = Math.sin(ang) * radius;
      const oy = (i % 2 === 0 ? 1 : -1) * orbRadius * 0.7;
      const orb = new THREE.Mesh(octGeo(orbRadius), orbMat);
      orb.position.set(ox, oy, oz);
      orb.scale.set(1, 1.35, 1);
      aura.add(orb);
    }
  }

  parent.add(aura);
  return aura;
}

export const ENHANCED_MYTHIC_ROLES: ReadonlySet<string> = new Set([
  'phoenix',
  'thunderbird',
  'unicorn',
  'pegasus',
  'griffin',
  'kitsune',
  'yeti',
  'golem',
  'hydra',
  'minotaur',
  'cerberus',
  'ent',
  'basilisk',
  'kraken',
  'manticore',
  'gargoyle',
]);

/**
 * Enhances all mythical beasts (except dragon & leviathan, which already have bespoke rigs)
 * with sculpted magical anatomy, glowing emissive accents, and an animated `mythic_aura_pivot`.
 */
export function enhanceMythicBeastModel(role: UnitRole, group: THREE.Group): void {
  if (!ENHANCED_MYTHIC_ROLES.has(role)) return;

  const bodyPivot = group.getObjectByName('body_pivot') ?? group;
  const headPivot = group.getObjectByName('head_pivot');
  const tailPivot = group.getObjectByName('tail_pivot');
  const wingL = group.getObjectByName('wing_l');
  const wingR = group.getObjectByName('wing_r');
  const wingOuterL = group.getObjectByName('wing_outer_l');
  const wingOuterR = group.getObjectByName('wing_outer_r');

  switch (role) {
    case 'phoenix': {
      const solarCore = glowMat(0xfef08a, 0xfde047, 2.5, 0.15, 0.1);
      const flameGold = glowMat(0xfbbf24, 0xf97316, 1.9, 0.2, 0.25);
      const flameRuby = glowMat(0xf97316, 0xef4444, 1.5, 0.28, 0.15);
      const haloMat = glowMat(0xfef08a, 0xf59e0b, 2.2, 0.15, 0.1, 0.85);

      // Blazing molten breast heart & dorsal fire-ridge
      addCrystal(bodyPivot, 0.11, 0, 0.45, 0.24, solarCore, 1.35);
      for (let i = 0; i < 4; i++) {
        addCrystal(bodyPivot, 0.055, 0, 0.62 - i * 0.015, 0.14 - i * 0.13, i % 2 === 0 ? solarCore : flameGold, 1.8, -0.35);
      }
      // Layered glowing primary feathers on inner & outer wings
      for (const [w, wo, dir] of [
        [wingL, wingOuterL, -1],
        [wingR, wingOuterR, 1],
      ] as const) {
        if (w) {
          for (let i = 0; i < 4; i++) {
            addBox(w, 0.14, 0.03, 0.26, dir * (0.16 + i * 0.15), 0.025, -0.18 - i * 0.04, i % 2 === 0 ? flameGold : flameRuby, 0, dir * -0.15, 0);
          }
          addBox(w, 0.66, 0.035, 0.06, dir * 0.34, 0.035, 0.16, solarCore);
        }
        if (wo) {
          for (let i = 0; i < 3; i++) {
            addBox(wo, 0.18, 0.028, 0.22, dir * (0.14 + i * 0.18), 0.015, -0.14 - i * 0.05, i === 2 ? solarCore : flameGold, 0, dir * -0.22, 0);
          }
        }
      }
      // Radiant solar halo behind head
      if (headPivot) {
        const halo = new THREE.Mesh(torusGeo(0.18, 0.018, 12), haloMat);
        halo.position.set(0, 0.28, -0.02);
        headPivot.add(halo);
        addCrystal(headPivot, 0.042, 0, 0.43, 0.02, solarCore, 1.7, -0.25);
      }
      // Luminous tail fire plumes
      if (tailPivot) {
        addCrystal(tailPivot, 0.065, 0, 0.01, -0.78, solarCore, 2.2, Math.PI / 2);
        addCrystal(tailPivot, 0.048, -0.12, -0.01, -0.62, flameGold, 1.9, Math.PI / 2);
        addCrystal(tailPivot, 0.048, 0.12, -0.01, -0.62, flameGold, 1.9, Math.PI / 2);
      }
      createOrbitAura(bodyPivot, 0.56, 0, 0.62, 0, 0);
      break;
    }

    case 'thunderbird': {
      const boltCyan = glowMat(0xe0f2fe, 0x38bdf8, 2.6, 0.12, 0.1);
      const boltGold = glowMat(0xfef08a, 0xfacc15, 2.1, 0.2, 0.35);
      const stormCloud = glowMat(0x334155, 0x0ea5e9, 0.55, 0.85, 0.05, 0.88);

      // Crackling chest thunder-emblem + storm-cloud belly ruff
      addCrystal(bodyPivot, 0.12, 0, 0.46, 0.34, boltCyan, 1.45);
      addBox(bodyPivot, 0.28, 0.09, 0.42, 0, 0.29, 0.02, stormCloud);
      addBox(bodyPivot, 0.34, 0.07, 0.34, 0, 0.33, -0.06, stormCloud);
      // Jagged dorsal lightning spikes
      for (let i = 0; i < 4; i++) {
        addCrystal(bodyPivot, 0.055, 0, 0.69, 0.16 - i * 0.15, i % 2 === 0 ? boltCyan : boltGold, 2.0, -0.4);
      }
      // Wing lightning arcs & gold-tipped storm pinions
      for (const [w, wo, dir] of [
        [wingL, wingOuterL, -1],
        [wingR, wingOuterR, 1],
      ] as const) {
        if (w) {
          addBox(w, 0.60, 0.032, 0.055, dir * 0.30, 0.055, 0.02, boltCyan, 0, dir * 0.18, 0);
          addBox(w, 0.42, 0.032, 0.05, dir * 0.36, 0.055, -0.14, boltGold, 0, dir * -0.22, 0);
        }
        if (wo) {
          for (let i = 0; i < 3; i++) {
            addBox(wo, 0.20, 0.03, 0.08, dir * (0.18 + i * 0.17), 0.04, -0.12 - i * 0.04, i === 2 ? boltCyan : boltGold, 0, dir * -0.28, 0);
          }
        }
      }
      // Crowned thunderbolt horns on head
      if (headPivot) {
        addCrystal(headPivot, 0.055, -0.12, 0.28, 0.02, boltCyan, 2.2, -0.35, 0.45);
        addCrystal(headPivot, 0.055, 0.12, 0.28, 0.02, boltCyan, 2.2, -0.35, -0.45);
        addCrystal(headPivot, 0.048, 0, 0.34, 0.06, boltGold, 2.1, -0.25);
      }
      // Forked lightning tail
      if (tailPivot) {
        addCrystal(tailPivot, 0.06, -0.14, 0.02, -0.42, boltCyan, 2.4, Math.PI / 2, 0.2);
        addCrystal(tailPivot, 0.06, 0.14, 0.02, -0.42, boltCyan, 2.4, Math.PI / 2, -0.2);
      }
      createOrbitAura(bodyPivot, 0.56, 0, 0.72, 0, 0);
      break;
    }

    case 'unicorn': {
      const hornGold = glowMat(0xfef08a, 0xfacc15, 2.3, 0.15, 0.4);
      const starPink = glowMat(0xfbcfe8, 0xf472b6, 1.9, 0.2, 0.15);
      const starCyan = glowMat(0xbae6fd, 0x38bdf8, 1.9, 0.2, 0.15);

      // Elongated gleaming prismatic horn + glowing tip star + celestial circlet
      if (headPivot) {
        addCrystal(headPivot, 0.032, 0, 0.46, 0.30, hornGold, 3.6, 0.42);
        addCrystal(headPivot, 0.044, 0, 0.57, 0.36, starCyan, 1.3);
        addBox(headPivot, 0.15, 0.028, 0.04, 0, 0.29, 0.21, hornGold);
        addBox(headPivot, 0.055, 0.24, 0.11, 0, 0.18, -0.02, starPink, 0.2);
      }
      // Luminous saddle-crest & flowing iridescent tail shimmer
      addBox(bodyPivot, 0.25, 0.04, 0.26, 0, 0.48, -0.02, starCyan);
      if (tailPivot) {
        addCrystal(tailPivot, 0.055, 0, -0.14, -0.16, starPink, 2.2, 0.6);
        addCrystal(tailPivot, 0.04, 0.04, -0.18, -0.22, starCyan, 2.0, 0.65);
      }
      createOrbitAura(bodyPivot, 0.46, 0, 0.48, 0, 0);
      break;
    }

    case 'pegasus': {
      const skyGlow = glowMat(0xe0f2fe, 0x7dd3fc, 2.1, 0.15, 0.15);
      const goldTrim = glowMat(0xfef08a, 0xfbbf24, 1.8, 0.2, 0.5);

      // Golden chest star & celestial wing-feather tips
      addCrystal(bodyPivot, 0.085, 0, 0.42, 0.32, goldTrim, 1.3);
      for (const [w, wo, dir] of [
        [wingL, wingOuterL, -1],
        [wingR, wingOuterR, 1],
      ] as const) {
        if (w) {
          addBox(w, 0.52, 0.032, 0.06, dir * 0.26, 0.035, 0.12, goldTrim);
        }
        if (wo) {
          for (let i = 0; i < 3; i++) {
            addBox(wo, 0.16, 0.026, 0.18, dir * (0.14 + i * 0.15), 0.02, -0.1 - i * 0.04, i === 2 ? goldTrim : skyGlow, 0, dir * -0.18, 0);
          }
        }
      }
      if (headPivot) {
        // Winged golden browband crown
        addBox(headPivot, 0.16, 0.03, 0.04, 0, 0.26, 0.20, goldTrim);
        addCrystal(headPivot, 0.036, -0.09, 0.30, 0.14, skyGlow, 1.9, -0.2, 0.45);
        addCrystal(headPivot, 0.036, 0.09, 0.30, 0.14, skyGlow, 1.9, -0.2, -0.45);
      }
      createOrbitAura(bodyPivot, 0.56, 0, 0.58, 0, 0);
      break;
    }

    case 'griffin': {
      const royalGold = glowMat(0xfbbf24, 0xd97706, 1.15, 0.25, 0.65);
      const windGlow = glowMat(0xfef9c3, 0xfde047, 1.9, 0.18, 0.15);

      // Regal embossed golden breastplate & shoulder pauldrons
      addBox(bodyPivot, 0.34, 0.18, 0.16, 0, 0.42, 0.24, royalGold);
      addCrystal(bodyPivot, 0.068, 0, 0.44, 0.33, windGlow, 1.3);
      addBox(bodyPivot, 0.12, 0.12, 0.18, -0.19, 0.50, 0.14, royalGold, 0, 0, 0.25);
      addBox(bodyPivot, 0.12, 0.12, 0.18, 0.19, 0.50, 0.14, royalGold, 0, 0, -0.25);
      // Golden eagle crest & glowing eyes
      if (headPivot) {
        addCrystal(headPivot, 0.042, 0, 0.30, 0.04, royalGold, 2.0, -0.45);
        addCrystal(headPivot, 0.034, -0.06, 0.27, 0.02, windGlow, 1.7, -0.5, 0.25);
        addCrystal(headPivot, 0.034, 0.06, 0.27, 0.02, windGlow, 1.7, -0.5, -0.25);
      }
      // Golden-tipped wing pinions
      for (const [wo, dir] of [
        [wingOuterL, -1],
        [wingOuterR, 1],
      ] as const) {
        if (wo) {
          addBox(wo, 0.24, 0.03, 0.18, dir * 0.38, 0.02, -0.1, royalGold);
        }
      }
      createOrbitAura(bodyPivot, 0.54, 0, 0.58, 0, 0);
      break;
    }

    case 'kitsune': {
      const foxFire = glowMat(0xfef08a, 0xf97316, 2.4, 0.15, 0.1);
      const spiritRuby = glowMat(0xfca5a5, 0xef4444, 1.8, 0.2, 0.15);
      const shrineGold = glowMat(0xfbbf24, 0xf59e0b, 1.3, 0.25, 0.55);

      // Sacred shrine collar & forehead sun-mark
      addBox(bodyPivot, 0.24, 0.06, 0.08, 0, 0.38, 0.22, spiritRuby);
      addCrystal(bodyPivot, 0.048, 0, 0.35, 0.27, shrineGold, 1.2);
      if (headPivot) {
        addCrystal(headPivot, 0.032, 0, 0.24, 0.19, spiritRuby, 1.3);
      }
      // Glowing fox-fire tips across the nine-tail fan
      if (tailPivot) {
        for (let i = -2; i <= 2; i++) {
          const tx = i * 0.12;
          const ty = 0.22 + (2 - Math.abs(i)) * 0.06;
          addCrystal(tailPivot, 0.045, tx, ty, -0.34 - (2 - Math.abs(i)) * 0.04, i % 2 === 0 ? foxFire : spiritRuby, 1.7);
        }
      }
      // 4 orbiting kitsune-bi spirit-fire orbs
      createOrbitAura(bodyPivot, 0.52, -0.06, 0.52, 4, 0.055, foxFire);
      break;
    }

    case 'yeti': {
      const iceCrystal = glowMat(0xe0f2fe, 0x38bdf8, 1.9, 0.15, 0.2, 0.92);
      const frostCore = glowMat(0xbae6fd, 0x0ea5e9, 1.6, 0.2, 0.15);

      // Jagged glacial ice-crystal shoulder pauldrons & dorsal frost spikes
      addCrystal(bodyPivot, 0.11, -0.30, 0.86, 0.02, iceCrystal, 1.9, 0, 0.45);
      addCrystal(bodyPivot, 0.11, 0.30, 0.86, 0.02, iceCrystal, 1.9, 0, -0.45);
      addCrystal(bodyPivot, 0.085, 0, 0.92, -0.14, frostCore, 2.2, -0.3);
      addCrystal(bodyPivot, 0.07, -0.14, 0.82, -0.18, iceCrystal, 1.8, -0.35, 0.25);
      addCrystal(bodyPivot, 0.07, 0.14, 0.82, -0.18, iceCrystal, 1.8, -0.35, -0.25);
      if (headPivot) {
        // Curved glacial horns & glowing frost-eyes
        addCrystal(headPivot, 0.048, -0.16, 0.28, 0.04, iceCrystal, 2.2, 0.15, 0.55);
        addCrystal(headPivot, 0.048, 0.16, 0.28, 0.04, iceCrystal, 2.2, 0.15, -0.55);
      }
      createOrbitAura(bodyPivot, 0.72, 0, 0.62, 0, 0);
      break;
    }

    case 'golem': {
      const runeCyan = glowMat(0xa5f3fc, 0x06b6d4, 2.4, 0.15, 0.2);
      const runeGold = glowMat(0xfef08a, 0xf59e0b, 1.9, 0.2, 0.4);
      const runeStone = glowMat(0x64748b, 0x06b6d4, 0.45, 0.85, 0.15);

      // Levitating glowing arcane heart-core & inlaid runic chest/back stripes
      addCrystal(bodyPivot, 0.13, 0, 0.78, 0.25, runeCyan, 1.4);
      addBox(bodyPivot, 0.34, 0.038, 0.04, 0, 0.88, 0.23, runeGold);
      addBox(bodyPivot, 0.34, 0.038, 0.04, 0, 0.68, 0.23, runeGold);
      addBox(bodyPivot, 0.05, 0.36, 0.04, 0, 0.78, -0.22, runeCyan);
      // Floating runic shoulder monoliths
      addCrystal(bodyPivot, 0.09, -0.42, 1.06, 0, runeStone, 1.7, 0, 0.2);
      addCrystal(bodyPivot, 0.09, 0.42, 1.06, 0, runeStone, 1.7, 0, -0.2);
      addCrystal(bodyPivot, 0.048, -0.42, 1.18, 0, runeCyan, 1.3);
      addCrystal(bodyPivot, 0.048, 0.42, 1.18, 0, runeCyan, 1.3);
      if (headPivot) {
        addBox(headPivot, 0.22, 0.035, 0.04, 0, 0.18, 0.16, runeCyan);
      }
      createOrbitAura(bodyPivot, 0.92, 0, 0.68, 4, 0.06, runeCyan);
      break;
    }

    case 'hydra': {
      const venomGlow = glowMat(0x86efac, 0x22c55e, 2.3, 0.18, 0.1);
      const acidGold = glowMat(0xd9f99d, 0x84cc16, 1.9, 0.2, 0.15);

      // Glowing venomous dorsal spines & throat crystal sacs
      for (let i = 0; i < 5; i++) {
        addCrystal(bodyPivot, 0.065, 0, 0.56 - i * 0.04, 0.22 - i * 0.16, i % 2 === 0 ? venomGlow : acidGold, 1.9, -0.3);
      }
      for (const sx of [-0.22, 0, 0.22]) {
        addCrystal(bodyPivot, 0.075, sx, 0.58, 0.34, venomGlow, 1.5);
      }
      createOrbitAura(bodyPivot, 0.66, 0.06, 0.72, 0, 0);
      break;
    }

    case 'minotaur': {
      const bronzeMat = glowMat(0xd97706, 0x92400e, 0.55, 0.3, 0.72);
      const rageEmber = glowMat(0xfef08a, 0xef4444, 2.3, 0.15, 0.15);

      // Embossed bronze war pauldrons & glowing fury chest-brand
      addBox(bodyPivot, 0.18, 0.16, 0.24, -0.32, 0.88, 0.02, bronzeMat, 0, 0, 0.25);
      addBox(bodyPivot, 0.18, 0.16, 0.24, 0.32, 0.88, 0.02, bronzeMat, 0, 0, -0.25);
      addCrystal(bodyPivot, 0.06, -0.36, 0.99, 0.02, rageEmber, 1.7, 0, 0.3);
      addCrystal(bodyPivot, 0.06, 0.36, 0.99, 0.02, rageEmber, 1.7, 0, -0.3);
      addCrystal(bodyPivot, 0.085, 0, 0.76, 0.22, rageEmber, 1.4);
      if (headPivot) {
        // Golden nose ring & glowing crimson eyes
        const noseRing = new THREE.Mesh(torusGeo(0.048, 0.014, 8), bronzeMat);
        noseRing.position.set(0, 0.04, 0.22);
        headPivot.add(noseRing);
        addBox(headPivot, 0.036, 0.032, 0.036, -0.09, 0.15, 0.18, rageEmber);
        addBox(headPivot, 0.036, 0.032, 0.036, 0.09, 0.15, 0.18, rageEmber);
      }
      createOrbitAura(bodyPivot, 0.76, 0, 0.58, 0, 0);
      break;
    }

    case 'cerberus': {
      const hellfire = glowMat(0xfef08a, 0xf97316, 2.5, 0.15, 0.1);
      const magmaRed = glowMat(0xf97316, 0xdc2626, 1.9, 0.22, 0.15);
      const ironSpike = glowMat(0x27272a, 0xef4444, 0.45, 0.4, 0.65);

      // Spiked obsidian hell-collar & molten lava-cracked spine ridges
      addBox(bodyPivot, 0.42, 0.08, 0.10, 0, 0.46, 0.26, ironSpike);
      for (let i = 0; i < 4; i++) {
        addCrystal(bodyPivot, 0.062, 0, 0.58, 0.16 - i * 0.15, i % 2 === 0 ? hellfire : magmaRed, 2.0, -0.35);
      }
      // Burning ember shoulders
      addCrystal(bodyPivot, 0.07, -0.22, 0.50, 0.18, hellfire, 1.5, 0, 0.4);
      addCrystal(bodyPivot, 0.07, 0.22, 0.50, 0.18, hellfire, 1.5, 0, -0.4);
      createOrbitAura(bodyPivot, 0.52, 0.04, 0.62, 0, 0);
      break;
    }

    case 'ent': {
      const heartEmerald = glowMat(0xa7f3d0, 0x10b981, 2.3, 0.18, 0.1);
      const blossomGold = glowMat(0xfef08a, 0x4ade80, 1.8, 0.2, 0.15);

      // Glowing ancient heart-rune carved into trunk chest
      addCrystal(bodyPivot, 0.11, 0, 0.76, 0.24, heartEmerald, 1.5);
      addBox(bodyPivot, 0.04, 0.34, 0.04, 0, 0.76, 0.22, blossomGold);
      // Glowing nature-crystal buds on canopy shoulders
      addCrystal(bodyPivot, 0.065, -0.32, 1.12, 0.08, blossomGold, 1.5);
      addCrystal(bodyPivot, 0.065, 0.32, 1.12, 0.08, blossomGold, 1.5);
      addCrystal(bodyPivot, 0.07, 0, 1.24, -0.06, heartEmerald, 1.6);
      createOrbitAura(bodyPivot, 0.94, 0, 0.66, 0, 0);
      break;
    }

    case 'basilisk': {
      const gazeGold = glowMat(0xfef08a, 0xfacc15, 2.5, 0.12, 0.25);
      const venomJade = glowMat(0x4ade80, 0x16a34a, 1.8, 0.2, 0.25);

      // Royal golden serpent crown & petrifying eye flares
      if (headPivot) {
        addCrystal(headPivot, 0.052, 0, 0.30, 0.06, gazeGold, 2.2, -0.2);
        addCrystal(headPivot, 0.04, -0.08, 0.26, 0.04, gazeGold, 1.8, -0.2, 0.35);
        addCrystal(headPivot, 0.04, 0.08, 0.26, 0.04, gazeGold, 1.8, -0.2, -0.35);
        addCrystal(headPivot, 0.032, -0.10, 0.16, 0.22, gazeGold, 1.1);
        addCrystal(headPivot, 0.032, 0.10, 0.16, 0.22, gazeGold, 1.1);
      }
      // Armored glowing dorsal spines along serpent back
      for (let i = 0; i < 5; i++) {
        addCrystal(bodyPivot, 0.052, 0, 0.44, 0.20 - i * 0.16, i % 2 === 0 ? gazeGold : venomJade, 1.9, -0.35);
      }
      createOrbitAura(bodyPivot, 0.48, 0.04, 0.60, 0, 0);
      break;
    }

    case 'kraken': {
      const abyssCyan = glowMat(0xa5f3fc, 0x06b6d4, 2.3, 0.15, 0.15);
      const abyssViolet = glowMat(0xd8b4fe, 0xa855f7, 2.0, 0.18, 0.15);

      // Bioluminescent mantle spots & glowing dorsal crest fins
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + 0.4;
        addCrystal(bodyPivot, 0.075, Math.cos(ang) * 0.32, 0.78 + (i % 2) * 0.12, Math.sin(ang) * 0.32, i % 2 === 0 ? abyssCyan : abyssViolet, 1.3);
      }
      addCrystal(bodyPivot, 0.10, 0, 1.18, -0.05, abyssCyan, 1.8);
      createOrbitAura(bodyPivot, 0.72, 0, 0.92, 0, 0);
      break;
    }

    case 'manticore': {
      const venomGreen = glowMat(0xbef264, 0x84cc16, 2.3, 0.15, 0.15);
      const crimsonGlow = glowMat(0xfca5a5, 0xef4444, 1.9, 0.2, 0.2);
      const goldHorn = glowMat(0xfbbf24, 0xd97706, 1.1, 0.28, 0.6);

      // Horned crimson crown & glowing chest brand
      if (headPivot) {
        addCrystal(headPivot, 0.044, -0.10, 0.26, 0.04, goldHorn, 2.1, -0.2, 0.4);
        addCrystal(headPivot, 0.044, 0.10, 0.26, 0.04, goldHorn, 2.1, -0.2, -0.4);
      }
      addCrystal(bodyPivot, 0.08, 0, 0.46, 0.28, crimsonGlow, 1.4);
      // Glowing venomous scorpion stinger bulb on tail
      if (tailPivot) {
        addCrystal(tailPivot, 0.085, 0, 0.36, -0.34, venomGreen, 1.8, 0.55);
      }
      // Spiky wing clasps
      for (const [w, dir] of [
        [wingL, -1],
        [wingR, 1],
      ] as const) {
        if (w) {
          addCrystal(w, 0.055, dir * 0.56, 0.06, 0.12, crimsonGlow, 1.7, 0.2, dir * -0.4);
        }
      }
      createOrbitAura(bodyPivot, 0.56, 0, 0.62, 0, 0);
      break;
    }

    case 'gargoyle': {
      const arcaneViolet = glowMat(0xe9d5ff, 0xa855f7, 2.4, 0.15, 0.2);
      const runeMagenta = glowMat(0xf5d0fe, 0xd946ef, 2.0, 0.18, 0.15);
      const obsidianHorn = glowMat(0x334155, 0x7c3aed, 0.65, 0.35, 0.5);

      // Glowing arcane rune cracks across stone chest & back
      addCrystal(bodyPivot, 0.095, 0, 0.56, 0.22, arcaneViolet, 1.5);
      addBox(bodyPivot, 0.04, 0.28, 0.04, -0.09, 0.56, 0.20, runeMagenta, 0, 0, 0.22);
      addBox(bodyPivot, 0.04, 0.28, 0.04, 0.09, 0.56, 0.20, runeMagenta, 0, 0, -0.22);
      if (headPivot) {
        // Gothic curved obsidian horns with glowing violet tips
        addCrystal(headPivot, 0.048, -0.11, 0.26, 0.02, obsidianHorn, 2.3, -0.25, 0.45);
        addCrystal(headPivot, 0.048, 0.11, 0.26, 0.02, obsidianHorn, 2.3, -0.25, -0.45);
        addCrystal(headPivot, 0.032, -0.14, 0.35, -0.01, arcaneViolet, 1.3);
        addCrystal(headPivot, 0.032, 0.14, 0.35, -0.01, arcaneViolet, 1.3);
      }
      for (const [w, dir] of [
        [wingL, -1],
        [wingR, 1],
      ] as const) {
        if (w) {
          addBox(w, 0.46, 0.03, 0.045, dir * 0.24, 0.04, 0.10, arcaneViolet);
        }
      }
      createOrbitAura(bodyPivot, 0.62, 0, 0.56, 0, 0);
      break;
    }

    default:
      break;
  }
}
