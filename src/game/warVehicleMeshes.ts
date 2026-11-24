import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SpeciesId, VehicleType } from './types';

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
  const pos = g.getAttribute('position');
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

function finalizeGroup(
  bodyParts: THREE.BufferGeometry[],
  glowParts: THREE.BufferGeometry[],
  metalness = 0.32,
  roughness = 0.58,
  glowHex = 0x38bdf8,
): THREE.Group {
  const group = new THREE.Group();
  if (bodyParts.length > 0) {
    const merged = mergeGeometries(bodyParts, false);
    for (const g of bodyParts) g.dispose();
    if (merged) {
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness,
        metalness,
      });
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  if (glowParts.length > 0) {
    const mergedGlow = mergeGeometries(glowParts, false);
    for (const g of glowParts) g.dispose();
    if (mergedGlow) {
      const glowMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        emissive: new THREE.Color(glowHex),
        emissiveIntensity: 1.35,
        roughness: 0.22,
        metalness: 0.1,
      });
      const glowMesh = new THREE.Mesh(mergedGlow, glowMat);
      group.add(glowMesh);
    }
  }
  return group;
}

/**
 * Builds large, detailed, race-unique 3D war vehicles for Sea, Land, Air, and Orbital eras.
 * Each of the 5 civilized races has a genuinely distinct architectural silhouette per vehicle class,
 * evolving visually across epochs (Industrial -> Atomic -> Information -> Orbital -> Interstellar).
 */
export function createCapitalWarVehicleGroup(
  type: VehicleType,
  epochLevel: number,
  species: SpeciesId,
): THREE.Group | null {
  const e = Math.max(3, epochLevel);
  const body: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const raceGlow =
    species === 'elf'
      ? 0xc084fc
      : species === 'orc'
        ? 0xff5722
        : species === 'dwarf'
          ? 0xf59e0b
          : species === 'lizardfolk'
            ? 0x34d399
            : 0x38bdf8;

  // =========================================================================
  // 1. AIRCRAFT CARRIER (Sea, Epoch 3+)
  // =========================================================================
  if (type === 'aircraft_carrier') {
    const sc = e >= 6 ? 1.24 : e >= 5 ? 1.15 : 1.05;
    if (species === 'elf') {
      // Twin-outrigger ivory catamaran carrier with crescent launch deck & golden crystal spire
      pushBox(body, 0.24, 0.20, 1.85, -0.34, 0.08, 0, 0xede7d5);
      pushBox(body, 0.24, 0.20, 1.85, 0.34, 0.08, 0, 0xede7d5);
      pushBox(body, 0.16, 0.16, 0.45, -0.34, 0.10, 1.02, 0xd4af37);
      pushBox(body, 0.16, 0.16, 0.45, 0.34, 0.10, 1.02, 0xd4af37);
      // Sweeping elevated ivory & emerald flight deck
      pushBox(body, 0.96, 0.08, 1.72, 0, 0.22, -0.02, 0xf3efe2);
      pushBox(body, 0.14, 0.02, 1.56, 0, 0.27, -0.02, 0xd4af37);
      // Starboard crystal spire bridge
      pushBox(body, 0.18, 0.44, 0.44, 0.36, 0.44, -0.18, 0xf8f5eb);
      pushBox(body, 0.10, 0.24, 0.16, 0.36, 0.72, -0.18, 0xd4af37);
      pushBox(glow, 0.12, 0.18, 0.12, 0.36, 0.86, -0.18, 0xc084fc);
      // Glowing crystal catapult strips & parked golden star-fighters
      pushBox(glow, 0.05, 0.03, 1.35, -0.18, 0.27, 0.05, 0x38bdf8);
      for (const zf of [-0.52, -0.1, 0.36]) {
        pushBox(body, 0.22, 0.04, 0.18, -0.22, 0.29, zf, 0xd4af37);
        pushBox(body, 0.06, 0.05, 0.24, -0.22, 0.30, zf, 0xf8fafc);
      }
    } else if (species === 'orc') {
      // Asymmetric bolted scrap-iron flat-top hulk with spiked ram prow, ski-jump ramp & twin smokestacks
      pushBox(body, 0.84, 0.26, 1.88, 0, 0.10, -0.04, 0x3c3734);
      pushBox(body, 0.96, 0.10, 1.74, -0.03, 0.25, -0.02, 0x4d4540);
      // Jagged crimson war-paint & spiked bow ram
      pushBox(body, 0.68, 0.14, 0.32, 0, 0.18, 0.98, 0x991b1b);
      pushBox(body, 0.10, 0.12, 0.34, -0.26, 0.14, 1.18, 0x9ca3af);
      pushBox(body, 0.10, 0.12, 0.34, 0.26, 0.14, 1.18, 0x9ca3af);
      // Up-angled iron ski-jump bow ramp
      pushBox(body, 0.62, 0.08, 0.42, -0.08, 0.32, 0.78, 0x574c45, -0.22, 0, 0);
      // Starboard skull-tower island & belching twin smokestacks
      pushBox(body, 0.24, 0.44, 0.56, 0.34, 0.46, -0.26, 0x5c2b22);
      pushBox(body, 0.11, 0.34, 0.11, 0.38, 0.76, -0.14, 0x262626);
      pushBox(body, 0.11, 0.30, 0.11, 0.38, 0.74, -0.38, 0x262626);
      pushBox(glow, 0.12, 0.08, 0.12, 0.38, 0.92, -0.14, 0xff5722);
      // Parked red dakka-planes on deck
      for (const zf of [-0.45, 0.08]) {
        pushBox(body, 0.26, 0.05, 0.20, -0.18, 0.33, zf, 0xb91c1c);
      }
    } else if (species === 'dwarf') {
      // Heavy twin-hull bronze-and-ironclad forge carrier with armored blast-doors & glowing furnace vents
      pushBox(body, 0.94, 0.26, 1.84, 0, 0.10, 0, 0x475569);
      pushBox(body, 1.02, 0.09, 1.76, 0, 0.25, 0, 0x64748b);
      // Heavy gold-trimmed runic bow armor
      pushBox(body, 0.78, 0.22, 0.26, 0, 0.14, 0.98, 0xb45309);
      pushBox(body, 0.98, 0.06, 0.14, 0, 0.26, 0.88, 0xd97706);
      // Armored fortress bridge with twin forge stacks
      pushBox(body, 0.28, 0.38, 0.62, 0.36, 0.44, -0.16, 0x334155);
      pushBox(body, 0.30, 0.07, 0.64, 0.36, 0.64, -0.16, 0xd97706);
      pushBox(glow, 0.12, 0.14, 0.38, 0.22, 0.44, -0.16, 0xf59e0b);
      // Side armored gun sponsons & parked stubby gyro-bombers
      pushBox(body, 0.14, 0.12, 0.30, -0.52, 0.22, 0.35, 0xb45309);
      pushBox(body, 0.14, 0.12, 0.30, -0.52, 0.22, -0.35, 0xb45309);
      for (const zf of [-0.46, 0.05, 0.48]) {
        pushBox(body, 0.22, 0.07, 0.16, -0.16, 0.33, zf, 0xd97706);
      }
    } else if (species === 'lizardfolk') {
      // Monumental obsidian & gold stepped-temple sea ark with emerald sun-crystal bridge
      pushBox(body, 0.88, 0.24, 1.88, 0, 0.10, 0, 0x1e293b);
      pushBox(body, 0.98, 0.09, 1.76, 0, 0.24, 0, 0x334155);
      pushBox(body, 1.02, 0.04, 1.78, 0, 0.29, 0, 0xd4af37);
      // Stepped ziggurat command island
      pushBox(body, 0.30, 0.16, 0.54, 0.32, 0.38, -0.18, 0x1f2937);
      pushBox(body, 0.22, 0.16, 0.38, 0.32, 0.54, -0.18, 0xca8a04);
      pushBox(glow, 0.14, 0.22, 0.14, 0.32, 0.72, -0.18, 0x34d399);
      // Glowing emerald runway glyph strip & golden solar gliders
      pushBox(glow, 0.08, 0.03, 1.44, -0.14, 0.32, 0.04, 0x34d399);
      for (const zf of [-0.48, 0.12]) {
        pushBox(body, 0.24, 0.04, 0.18, -0.16, 0.34, zf, 0xfacc15);
      }
    } else {
      // HUMAN: Angled flat-top naval supercarrier with white markings, starboard island, radar mast & parked fighters
      const hullHex = e >= 5 ? 0x3b4856 : 0x52606d;
      const deckHex = e >= 5 ? 0x2a3440 : 0x3e4c59;
      pushBox(body, 0.80, 0.24, 1.92, 0, 0.10, 0, hullHex);
      pushBox(body, 0.98, 0.08, 1.86, -0.04, 0.24, 0, deckHex);
      // Angled flight deck stripe & catapult tracks
      pushBox(body, 0.06, 0.02, 1.66, -0.16, 0.29, 0.04, 0xf1f5f9);
      pushBox(body, 0.04, 0.02, 1.54, 0.08, 0.29, 0.08, 0xfbbf24);
      // Starboard control island + radar mast
      pushBox(body, 0.20, 0.38, 0.50, 0.36, 0.44, -0.20, 0x64748b);
      pushBox(body, 0.06, 0.32, 0.06, 0.36, 0.76, -0.22, 0x94a3b8);
      pushBox(body, 0.22, 0.05, 0.05, 0.36, 0.86, -0.22, 0xe2e8f0);
      if (e >= 6) pushBox(glow, 0.06, 0.03, 1.62, -0.16, 0.30, 0.04, 0x38bdf8);
      // 3 micro-fighters parked on flight deck
      for (const zf of [-0.56, -0.06, 0.44]) {
        pushBox(body, 0.22, 0.04, 0.16, -0.22, 0.31, zf, 0xcbd5e1);
        pushBox(body, 0.06, 0.05, 0.24, -0.22, 0.32, zf, 0x94a3b8);
      }
    }
    const g = finalizeGroup(body, glow, 0.36, 0.52, raceGlow);
    g.scale.setScalar(sc);
    return g;
  }

  // =========================================================================
  // 2. SUBMARINE (Sea, Epoch 3+)
  // =========================================================================
  if (type === 'submarine') {
    const sc = e >= 6 ? 1.16 : 1.04;
    if (species === 'elf') {
      // Sleek manta-ray bio-crystal submersible with swept pectoral fins & glowing dome
      pushBox(body, 0.46, 0.18, 1.38, 0, 0.08, 0, 0x1e3a5f);
      pushBox(body, 0.92, 0.06, 0.56, 0, 0.09, 0.08, 0x2b5978);
      pushBox(body, 0.26, 0.10, 0.42, 0, 0.12, 0.76, 0xd4af37);
      pushBox(glow, 0.22, 0.14, 0.38, 0, 0.22, 0.04, 0x38bdf8);
      pushBox(glow, 0.86, 0.03, 0.06, 0, 0.12, 0.16, 0xc084fc);
    } else if (species === 'orc') {
      // Riveted iron shark-jawed monster sub with jagged dorsal fin & bolted torpedo tubes
      pushBox(body, 0.44, 0.22, 1.36, 0, 0.09, 0, 0x3f3a36);
      pushBox(body, 0.36, 0.18, 0.28, 0, 0.09, 0.78, 0x991b1b); // red shark snout
      pushBox(body, 0.14, 0.34, 0.34, 0, 0.30, 0.08, 0x2c2825); // jagged dorsal sail
      pushBox(body, 0.06, 0.22, 0.06, 0, 0.52, 0.12, 0x9ca3af); // periscope
      pushBox(body, 0.10, 0.10, 0.42, -0.24, 0.10, 0.38, 0x57534e); // side torpedo tube
      pushBox(body, 0.10, 0.10, 0.42, 0.24, 0.10, 0.38, 0x57534e);
      pushBox(glow, 0.14, 0.06, 0.08, 0, 0.14, -0.70, 0xff5722);
    } else if (species === 'dwarf') {
      // Armored iron-beetle bathyscaphe with twin brass ballast pods & rotary drill-prow
      pushBox(body, 0.52, 0.24, 1.24, 0, 0.10, 0, 0x334155);
      pushBox(body, 0.16, 0.16, 0.96, -0.32, 0.08, -0.04, 0xb45309);
      pushBox(body, 0.16, 0.16, 0.96, 0.32, 0.08, -0.04, 0xb45309);
      pushBox(body, 0.24, 0.20, 0.28, 0, 0.10, 0.72, 0xd97706); // brass drill nose
      pushBox(body, 0.28, 0.24, 0.34, 0, 0.28, 0.05, 0x475569); // squat armored cupola
      pushBox(glow, 0.18, 0.07, 0.10, 0, 0.30, 0.22, 0xf59e0b);
    } else if (species === 'lizardfolk') {
      // Crocodilian obsidian reef-sub with serrated golden dorsal ridge & glowing amber eyes
      pushBox(body, 0.44, 0.18, 1.44, 0, 0.08, 0, 0x1e293b);
      pushBox(body, 0.32, 0.14, 0.36, 0, 0.07, 0.82, 0x0f172a);
      for (const zs of [-0.42, -0.14, 0.14, 0.42]) {
        pushBox(body, 0.10, 0.16, 0.14, 0, 0.22, zs, 0xd4af37);
      }
      pushBox(glow, 0.08, 0.06, 0.08, -0.12, 0.14, 0.66, 0x34d399);
      pushBox(glow, 0.08, 0.06, 0.08, 0.12, 0.14, 0.66, 0x34d399);
    } else {
      // HUMAN: Sleek cylindrical naval submarine with diving planes, conning tower sail & periscopes
      const hullHex = e >= 5 ? 0x1e293b : 0x334155;
      pushBox(body, 0.38, 0.22, 1.44, 0, 0.09, 0, hullHex);
      pushBox(body, 0.28, 0.18, 0.26, 0, 0.09, 0.80, hullHex);
      pushBox(body, 0.16, 0.30, 0.38, 0, 0.28, 0.14, 0x475569); // conning tower sail
      pushBox(body, 0.46, 0.04, 0.14, 0, 0.28, 0.16, 0x64748b); // sail diving planes
      pushBox(body, 0.04, 0.22, 0.04, 0, 0.50, 0.18, 0xcbd5e1); // periscope
      pushBox(body, 0.06, 0.22, 0.24, 0, 0.14, -0.68, 0x475569); // stern rudder
      if (e >= 5) pushBox(glow, 0.18, 0.04, 0.12, 0, 0.38, 0.30, 0x38bdf8);
    }
    const g = finalizeGroup(body, glow, 0.42, 0.46, raceGlow);
    g.scale.setScalar(sc);
    return g;
  }

  // =========================================================================
  // 3. SIEGE ARTILLERY (Land, Epoch 3+)
  // =========================================================================
  if (type === 'siege_artillery') {
    const sc = e >= 6 ? 1.18 : 1.06;
    if (species === 'elf') {
      // Graceful quad-legged crystal prism-lance strider with floating focus rings
      pushBox(body, 0.56, 0.22, 0.72, 0, 0.34, 0, 0xf3efe2);
      for (const [lx, lz] of [[-0.32, 0.28], [0.32, 0.28], [-0.32, -0.28], [0.32, -0.28]]) {
        pushBox(body, 0.10, 0.36, 0.10, lx, 0.18, lz, 0xd4af37);
      }
      pushBox(body, 0.16, 0.16, 1.02, 0, 0.54, 0.24, 0xf8f5eb, -0.28, 0, 0);
      pushBox(glow, 0.10, 0.10, 1.06, 0, 0.56, 0.28, 0xc084fc, -0.28, 0, 0);
    } else if (species === 'orc') {
      // Spiked iron doom-roller with huge front crush-drum & colossal chained cannon
      pushBox(body, 0.74, 0.26, 0.92, 0, 0.20, -0.06, 0x3f3a36);
      pushBox(body, 0.84, 0.24, 0.24, 0, 0.14, 0.48, 0x71717a); // front spiked crush roller
      pushBox(body, 0.28, 0.26, 1.06, 0, 0.48, 0.12, 0x27272a, -0.32, 0, 0); // colossal cannon
      pushBox(body, 0.34, 0.32, 0.18, 0, 0.64, 0.56, 0x991b1b, -0.32, 0, 0); // red muzzle collar
      pushBox(glow, 0.16, 0.16, 0.08, 0, 0.66, 0.64, 0xff5722);
    } else if (species === 'dwarf') {
      // Quad-tracked runic landship with massive brass quake-mortar barrel
      pushBox(body, 0.84, 0.22, 0.98, 0, 0.14, 0, 0x334155);
      pushBox(body, 0.68, 0.28, 0.78, 0, 0.34, -0.04, 0x475569);
      pushBox(body, 0.72, 0.06, 0.82, 0, 0.48, -0.04, 0xd97706);
      pushBox(body, 0.26, 0.26, 0.92, 0, 0.58, 0.16, 0xb45309, -0.45, 0, 0);
      pushBox(glow, 0.22, 0.12, 0.14, 0, 0.34, -0.44, 0xf59e0b);
    } else if (species === 'lizardfolk') {
      // Quadruped obsidian temple-walker with towering emerald solar-obelisk emitter
      pushBox(body, 0.68, 0.22, 0.84, 0, 0.28, 0, 0x1e293b);
      for (const [lx, lz] of [[-0.34, 0.30], [0.34, 0.30], [-0.34, -0.30], [0.34, -0.30]]) {
        pushBox(body, 0.14, 0.28, 0.14, lx, 0.14, lz, 0x334155);
      }
      pushBox(body, 0.48, 0.16, 0.52, 0, 0.46, 0, 0xca8a04);
      pushBox(glow, 0.20, 0.52, 0.20, 0, 0.76, 0.04, 0x34d399);
    } else {
      // HUMAN: Heavy twin-track self-propelled artillery / railgun crawler
      const hullHex = e >= 5 ? 0x4b5563 : 0x4d5d42;
      pushBox(body, 0.78, 0.18, 1.02, 0, 0.12, 0, 0x262626); // heavy tracks
      pushBox(body, 0.62, 0.22, 0.88, 0, 0.26, 0, hullHex);
      pushBox(body, 0.46, 0.24, 0.52, 0, 0.46, -0.10, 0x64748b); // armored turret
      pushBox(body, 0.12, 0.12, 1.06, 0, 0.62, 0.28, 0x94a3b8, -0.34, 0, 0); // long artillery barrel
      if (e >= 6) pushBox(glow, 0.08, 0.06, 0.96, 0, 0.64, 0.30, 0x38bdf8, -0.34, 0, 0);
    }
    const g = finalizeGroup(body, glow, 0.38, 0.54, raceGlow);
    g.scale.setScalar(sc);
    return g;
  }

  // =========================================================================
  // 4. SKY CANNONSHIP (Air, Epoch 4+)
  // =========================================================================
  if (type === 'sky_cannonship') {
    const sc = e >= 6 ? 1.24 : 1.12;
    if (species === 'elf') {
      // Sweeping crescent-wing star-sail sky frigate with glowing crystal ring-drive
      pushBox(body, 0.46, 0.24, 1.68, 0, 0, 0, 0xf3efe2);
      pushBox(body, 1.56, 0.07, 0.52, 0, 0.04, -0.06, 0xede7d5);
      pushBox(body, 0.18, 0.18, 0.44, 0, 0.04, 0.92, 0xd4af37);
      pushBox(body, 0.22, 0.28, 0.44, 0, 0.22, -0.18, 0xf8f5eb);
      pushBox(glow, 0.92, 0.08, 0.12, 0, -0.08, 0.14, 0xc084fc); // broadside prism cannons
      pushBox(glow, 0.28, 0.28, 0.12, 0, 0.02, -0.88, 0x38bdf8);
    } else if (species === 'orc') {
      // Belching multi-rotor iron sky-barge bristling with oversized broadside dakka-cannons
      pushBox(body, 0.78, 0.36, 1.58, 0, 0, 0, 0x3f3a36);
      pushBox(body, 0.84, 0.16, 0.34, 0, 0.04, 0.82, 0x991b1b); // crimson prow
      // Quad heavy broadside cannon barrels sticking out both flanks
      for (const zb of [-0.32, 0.22]) {
        pushBox(body, 1.28, 0.11, 0.11, 0, -0.04, zb, 0x18181b);
      }
      // Twin side lift-rotor pods
      pushBox(body, 0.34, 0.12, 0.34, -0.62, 0.20, 0, 0x57534e);
      pushBox(body, 0.34, 0.12, 0.34, 0.62, 0.20, 0, 0x57534e);
      pushBox(glow, 0.22, 0.16, 0.14, 0, -0.02, -0.84, 0xff5722);
    } else if (species === 'dwarf') {
      // Armored brass-and-ironclad sky-dreadnought with broadside mortar casemates & forge thrusters
      pushBox(body, 0.72, 0.34, 1.62, 0, 0, 0, 0x475569);
      pushBox(body, 0.76, 0.08, 1.64, 0, 0.18, 0, 0xd97706);
      pushBox(body, 0.32, 0.28, 1.18, -0.52, 0.04, -0.04, 0x64748b); // twin armored side hulls
      pushBox(body, 0.32, 0.28, 1.18, 0.52, 0.04, -0.04, 0x64748b);
      pushBox(body, 1.38, 0.10, 0.10, 0, 0.02, 0.28, 0xb45309); // broadside guns
      pushBox(body, 1.38, 0.10, 0.10, 0, 0.02, -0.26, 0xb45309);
      pushBox(glow, 0.24, 0.16, 0.12, -0.52, -0.02, -0.66, 0xf59e0b);
      pushBox(glow, 0.24, 0.16, 0.12, 0.52, -0.02, -0.66, 0xf59e0b);
    } else if (species === 'lizardfolk') {
      // Floating stepped obsidian-and-gold temple sky-barge with 4 corner emerald hover pylons
      pushBox(body, 0.84, 0.26, 1.54, 0, 0, 0, 0x1e293b);
      pushBox(body, 0.62, 0.20, 1.12, 0, 0.22, 0, 0xca8a04);
      pushBox(body, 0.38, 0.18, 0.64, 0, 0.38, -0.06, 0x1e293b);
      pushBox(glow, 0.22, 0.26, 0.22, 0, 0.54, -0.06, 0x34d399);
      for (const [px, pz] of [[-0.56, 0.52], [0.56, 0.52], [-0.56, -0.52], [0.56, -0.52]]) {
        pushBox(glow, 0.16, 0.22, 0.16, px, -0.08, pz, 0x34d399);
      }
    } else {
      // HUMAN: Armored aerial broadside gun-frigate with twin VTOL turbofan pods & heavy turret batteries
      pushBox(body, 0.64, 0.30, 1.66, 0, 0, 0, 0x475569);
      pushBox(body, 0.42, 0.22, 0.56, 0, 0.24, -0.18, 0x64748b); // command bridge
      // Side VTOL ducted fan nacelles
      pushBox(body, 0.36, 0.16, 0.64, -0.56, 0.04, -0.06, 0x334155);
      pushBox(body, 0.36, 0.16, 0.64, 0.56, 0.04, -0.06, 0x334155);
      // Forward & ventral heavy cannon turrets
      pushBox(body, 0.10, 0.10, 0.62, -0.16, -0.12, 0.66, 0x94a3b8);
      pushBox(body, 0.10, 0.10, 0.62, 0.16, -0.12, 0.66, 0x94a3b8);
      pushBox(glow, 0.26, 0.06, 0.42, -0.56, -0.06, -0.06, 0x38bdf8);
      pushBox(glow, 0.26, 0.06, 0.42, 0.56, -0.06, -0.06, 0x38bdf8);
    }
    const g = finalizeGroup(body, glow, 0.42, 0.46, raceGlow);
    g.scale.setScalar(sc);
    return g;
  }

  // =========================================================================
  // 5. SKY CARRIER / AIR CARRIER (Air, Epoch 5+)
  // =========================================================================
  if (type === 'sky_carrier') {
    const sc = e >= 7 ? 1.38 : 1.24;
    if (species === 'elf') {
      // Celestial Lotus Sky-Carrier: petal-shaped ivory launch decks orbiting a glowing golden crystal core
      pushBox(body, 0.92, 0.24, 2.08, 0, 0, 0, 0xf3efe2);
      pushBox(body, 1.92, 0.12, 0.88, 0, 0.04, 0, 0xede7d5);
      pushBox(body, 0.26, 0.54, 0.56, 0.44, 0.34, -0.22, 0xf8f5eb);
      pushBox(body, 0.14, 0.28, 0.14, 0.44, 0.72, -0.22, 0xd4af37);
      pushBox(glow, 0.48, 0.32, 0.48, 0, -0.14, 0, 0xc084fc); // central levitation lotus crystal
      pushBox(glow, 0.08, 0.04, 1.72, -0.16, 0.15, 0, 0x38bdf8);
      for (const zf of [-0.62, 0.0, 0.58]) {
        pushBox(body, 0.24, 0.05, 0.18, -0.22, 0.18, zf, 0xd4af37);
      }
    } else if (species === 'orc') {
      // Gargantuan scrap-iron Mega-Helihulk with 4 huge lift turbines, jagged runway & skull-bridge
      pushBox(body, 1.18, 0.32, 2.16, 0, 0, 0, 0x3c3734);
      pushBox(body, 0.92, 0.14, 0.44, 0, 0.16, 1.06, 0x991b1b, -0.18, 0, 0);
      pushBox(body, 0.34, 0.52, 0.66, 0.48, 0.38, -0.28, 0x5c2b22);
      for (const [rx, rz] of [[-0.86, 0.56], [0.86, 0.56], [-0.86, -0.56], [0.86, -0.56]]) {
        pushBox(body, 0.46, 0.16, 0.46, rx, 0.02, rz, 0x262626);
        pushBox(glow, 0.30, 0.08, 0.30, rx, -0.08, rz, 0xff5722);
      }
      for (const zf of [-0.52, 0.18]) {
        pushBox(body, 0.28, 0.06, 0.22, -0.22, 0.21, zf, 0xb91c1c);
      }
    } else if (species === 'dwarf') {
      // Twin-Furnace Armored Sky-Fortress Carrier with ironclad flight-bays & massive forge-thrusters
      pushBox(body, 1.24, 0.34, 2.10, 0, 0, 0, 0x334155);
      pushBox(body, 1.32, 0.09, 2.02, 0, 0.20, 0, 0x64748b);
      pushBox(body, 1.36, 0.06, 0.22, 0, 0.24, 0.94, 0xd97706);
      pushBox(body, 0.36, 0.46, 0.72, 0.48, 0.42, -0.22, 0x475569);
      for (const [rx, rz] of [[-0.82, 0.52], [0.82, 0.52], [-0.82, -0.52], [0.82, -0.52]]) {
        pushBox(body, 0.38, 0.26, 0.46, rx, -0.02, rz, 0xb45309);
        pushBox(glow, 0.26, 0.10, 0.32, rx, -0.18, rz, 0xf59e0b);
      }
    } else if (species === 'lizardfolk') {
      // Floating Golden Sun-Disc Wing Carrier with stepped emerald pyramid command nexus
      pushBox(body, 1.32, 0.24, 2.04, 0, 0, 0, 0x1e293b);
      pushBox(body, 1.66, 0.08, 1.36, 0, 0.14, 0, 0xd4af37);
      pushBox(body, 0.52, 0.22, 0.68, 0.38, 0.30, -0.18, 0x1f2937);
      pushBox(body, 0.34, 0.20, 0.46, 0.38, 0.48, -0.18, 0xca8a04);
      pushBox(glow, 0.22, 0.28, 0.22, 0.38, 0.70, -0.18, 0x34d399);
      pushBox(glow, 0.10, 0.04, 1.72, -0.22, 0.20, 0, 0x34d399);
    } else {
      // HUMAN: Quad-turbine Stratospheric Helicarrier with angled dual flight decks & parked jet fighters
      pushBox(body, 1.12, 0.30, 2.24, 0, 0, 0, 0x3b4856);
      pushBox(body, 1.24, 0.09, 2.12, -0.06, 0.18, 0, 0x26303c);
      pushBox(body, 0.08, 0.02, 1.88, -0.24, 0.24, 0, 0xf1f5f9);
      pushBox(body, 0.26, 0.44, 0.60, 0.44, 0.42, -0.24, 0x64748b);
      // Four iconic glowing quad-lift helicarrier turbine rings
      for (const [rx, rz] of [[-0.86, 0.62], [0.86, 0.62], [-0.86, -0.62], [0.86, -0.62]]) {
        pushBox(body, 0.48, 0.14, 0.48, rx, 0.04, rz, 0x475569);
        pushBox(glow, 0.34, 0.08, 0.34, rx, -0.04, rz, 0x38bdf8);
      }
      for (const zf of [-0.62, -0.08, 0.46]) {
        pushBox(body, 0.24, 0.04, 0.18, -0.26, 0.26, zf, 0xe2e8f0);
      }
    }
    const g = finalizeGroup(body, glow, 0.45, 0.42, raceGlow);
    g.scale.setScalar(sc);
    return g;
  }

  // =========================================================================
  // 6. ORBITAL MOTHERSHIP (Orbital / Interstellar, Epoch 6+)
  // =========================================================================
  if (type === 'orbital_mothership') {
    const sc = e >= 7 ? 1.56 : 1.38;
    if (species === 'elf') {
      // Celestial Star-Lotus Ark: towering crystalline spire ringed by golden halos & starlight wings
      pushBox(body, 0.86, 0.42, 2.48, 0, 0, 0, 0xf8f5eb);
      pushBox(body, 2.34, 0.12, 0.82, 0, 0.04, -0.14, 0xede7d5);
      pushBox(body, 0.48, 0.94, 0.56, 0, 0.42, -0.18, 0xf3efe2);
      pushBox(body, 0.22, 0.54, 0.22, 0, 1.04, -0.18, 0xd4af37);
      // Concentric glowing celestial halo rings
      pushBox(glow, 1.62, 0.08, 0.14, 0, 0.28, 0.42, 0xc084fc);
      pushBox(glow, 1.62, 0.08, 0.14, 0, 0.28, -0.74, 0xc084fc);
      pushBox(glow, 0.14, 0.08, 1.24, -0.82, 0.28, -0.16, 0x38bdf8);
      pushBox(glow, 0.14, 0.08, 1.24, 0.82, 0.28, -0.16, 0x38bdf8);
      pushBox(glow, 0.34, 0.34, 0.34, 0, -0.32, 0, 0xc084fc); // ventral orbital beam lens
    } else if (species === 'orc') {
      // Colossal World-Krusher Orbital Mega-Hulk: bolted asteroid-fortress with iron tusks & plasma cannons
      pushBox(body, 1.64, 0.64, 2.42, 0, 0.04, 0, 0x36322f);
      pushBox(body, 1.28, 0.48, 1.84, 0.14, 0.44, -0.12, 0x4d4540);
      pushBox(body, 0.82, 0.34, 0.56, -0.18, 0.72, -0.26, 0x991b1b);
      // Giant forward iron ram-tusks
      pushBox(body, 0.22, 0.24, 0.88, -0.68, 0.02, 1.46, 0xa1a1aa);
      pushBox(body, 0.22, 0.24, 0.88, 0.68, 0.02, 1.46, 0xa1a1aa);
      // Blazing crimson-orange warp thrusters & ventral mega-cannon
      pushBox(glow, 1.24, 0.32, 0.18, 0, 0.04, -1.28, 0xff5722);
      pushBox(glow, 0.42, 0.28, 0.42, 0, -0.34, 0.32, 0xff3b30);
    } else if (species === 'dwarf') {
      // Monumental Dyson-Anvil Orbital Citadel: octagonal runic-gold & dark-iron fortress with star-forge core
      pushBox(body, 2.04, 0.44, 0.66, 0, 0, 0.84, 0x334155);
      pushBox(body, 2.04, 0.44, 0.66, 0, 0, -0.84, 0x334155);
      pushBox(body, 0.66, 0.44, 2.04, -0.84, 0, 0, 0x475569);
      pushBox(body, 0.66, 0.44, 2.04, 0.84, 0, 0, 0x475569);
      // Runic gold battlements around the entire citadel ring
      pushBox(body, 2.12, 0.10, 0.72, 0, 0.26, 0.84, 0xd97706);
      pushBox(body, 2.12, 0.10, 0.72, 0, 0.26, -0.84, 0xd97706);
      pushBox(body, 0.72, 0.10, 2.12, -0.84, 0.26, 0, 0xd97706);
      pushBox(body, 0.72, 0.10, 2.12, 0.84, 0.26, 0, 0xd97706);
      // Blazing miniature star-forge core suspended in the hollow center
      pushBox(glow, 0.64, 0.64, 0.64, 0, 0.04, 0, 0xf59e0b);
    } else if (species === 'lizardfolk') {
      // Grand Floating Solar Ziggurat Ark: colossal levitating golden-obsidian pyramid + 4 orbiting obelisks
      pushBox(body, 2.04, 0.28, 2.04, 0, -0.06, 0, 0x1e293b);
      pushBox(body, 1.56, 0.26, 1.56, 0, 0.20, 0, 0xca8a04);
      pushBox(body, 1.06, 0.26, 1.06, 0, 0.46, 0, 0x1f2937);
      pushBox(body, 0.62, 0.24, 0.62, 0, 0.70, 0, 0xd4af37);
      // Blazing sun-disc crown & 4 floating corner obelisks
      pushBox(glow, 0.44, 0.44, 0.44, 0, 1.04, 0, 0x34d399);
      pushBox(glow, 0.46, 0.26, 0.46, 0, -0.28, 0, 0xfacc15);
      for (const [ox, oz] of [[-1.24, 1.24], [1.24, 1.24], [-1.24, -1.24], [1.24, -1.24]]) {
        pushBox(body, 0.22, 0.68, 0.22, ox, 0.14, oz, 0xca8a04);
        pushBox(glow, 0.16, 0.24, 0.16, ox, 0.56, oz, 0x34d399);
      }
    } else {
      // HUMAN: Interstellar Ring-Ark Command Mothership with glowing cyan warp-ring & twin carrier bays
      pushBox(body, 1.04, 0.42, 2.64, 0, 0.04, 0, 0x334155);
      pushBox(body, 1.62, 0.26, 1.24, 0, 0.08, -0.18, 0x475569);
      pushBox(body, 0.46, 0.42, 0.74, 0, 0.44, -0.28, 0x64748b); // upper command citadel
      // Encircling luminous cyan warp-drive ring
      pushBox(glow, 2.28, 0.10, 0.18, 0, 0.02, 0.66, 0x38bdf8);
      pushBox(glow, 2.28, 0.10, 0.18, 0, 0.02, -0.92, 0x38bdf8);
      pushBox(glow, 0.18, 0.10, 1.72, -1.12, 0.02, -0.13, 0x38bdf8);
      pushBox(glow, 0.18, 0.10, 1.72, 1.12, 0.02, -0.13, 0x38bdf8);
      // Ventral orbital lance core & rear ion drive banks
      pushBox(glow, 0.36, 0.22, 0.54, 0, -0.24, 0.42, 0x38bdf8);
      pushBox(glow, 0.74, 0.22, 0.14, 0, 0.04, -1.36, 0x38bdf8);
    }
    const g = finalizeGroup(body, glow, 0.52, 0.34, raceGlow);
    g.scale.setScalar(sc);
    return g;
  }

  return null;
}
