import * as THREE from 'three';
import {
  DivineTitanState,
  SimulationState,
  TitanOrbitalStrike,
  TitanShockwaveEffect,
  TitanSlashEffect,
} from './types';
import { TITAN_EXIT_DURATION, TITAN_SUMMON_DURATION } from './divineTitan';

// ---------------------------------------------------------------------------
// Procedural High-Resolution Canvas Textures (512x512)
// ---------------------------------------------------------------------------

function createArmorPlateTextures(): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  // Base ceramic-titanium off-white gradient (inspired by sleek white/silver mecha armor)
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#e5e9ef');
  bg.addColorStop(0.5, '#d7dde6');
  bg.addColorStop(1, '#c8d0dc');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Subtle brushed micro-grain
  for (let i = 0; i < 1800; i++) {
    const x = (i * 197) % size;
    const y = (i * 353) % size;
    const w = 12 + (i % 34);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(60,72,90,0.045)';
    ctx.fillRect(x, y, w, 1.5);
  }

  // Armor panel seams
  ctx.strokeStyle = 'rgba(42, 52, 68, 0.55)';
  ctx.lineWidth = 3;
  const grid = [0, 128, 256, 384, 512];
  for (const g of grid) {
    ctx.beginPath();
    ctx.moveTo(g, 0);
    ctx.lineTo(g, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, g);
    ctx.lineTo(size, g);
    ctx.stroke();
  }

  // Highlight bevels beside seams
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 1.5;
  for (const g of [130, 258, 386]) {
    ctx.beginPath();
    ctx.moveTo(g, 0);
    ctx.lineTo(g, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, g);
    ctx.lineTo(size, g);
    ctx.stroke();
  }

  // Subtle divine gold & crimson accent stripes on select panels
  ctx.fillStyle = 'rgba(217, 155, 42, 0.32)';
  ctx.fillRect(16, 110, 96, 8);
  ctx.fillRect(272, 366, 96, 8);
  ctx.fillStyle = 'rgba(185, 38, 38, 0.28)';
  ctx.fillRect(144, 238, 96, 6);

  // Panel rivets
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const bx = gx * 128;
      const by = gy * 128;
      const offsets = [
        [12, 12],
        [116, 12],
        [12, 116],
        [116, 116],
      ];
      for (const [ox, oy] of offsets) {
        ctx.fillStyle = 'rgba(48, 58, 72, 0.5)';
        ctx.beginPath();
        ctx.arc(bx + ox, by + oy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.arc(bx + ox - 1, by + oy - 1, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Bump canvas
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#b0b0b0';
  bctx.fillRect(0, 0, size, size);
  bctx.strokeStyle = '#303030';
  bctx.lineWidth = 4;
  for (const g of grid) {
    bctx.beginPath();
    bctx.moveTo(g, 0);
    bctx.lineTo(g, size);
    bctx.stroke();
    bctx.beginPath();
    bctx.moveTo(0, g);
    bctx.lineTo(size, g);
    bctx.stroke();
  }
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const bx = gx * 128;
      const by = gy * 128;
      for (const [ox, oy] of [
        [12, 12],
        [116, 12],
        [12, 116],
        [116, 116],
      ]) {
        bctx.fillStyle = '#ffffff';
        bctx.beginPath();
        bctx.arc(bx + ox, by + oy, 3.2, 0, Math.PI * 2);
        bctx.fill();
      }
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = 4;

  return { map, bumpMap };
}

function createMechFrameTextures(): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#343c47';
  ctx.fillRect(0, 0, size, size);

  // Ribbed mechanical grooves & vent slats
  for (let y = 0; y < size; y += 16) {
    ctx.fillStyle = 'rgba(18, 22, 28, 0.55)';
    ctx.fillRect(0, y, size, 4);
    ctx.fillStyle = 'rgba(160, 178, 200, 0.14)';
    ctx.fillRect(0, y + 4, size, 2);
  }
  for (let x = 0; x < size; x += 64) {
    ctx.fillStyle = 'rgba(15, 19, 24, 0.45)';
    ctx.fillRect(x, 0, 3, size);
  }

  const bump = document.createElement('canvas');
  bump.width = size;
  bump.height = size;
  const bctx = bump.getContext('2d')!;
  bctx.fillStyle = '#909090';
  bctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 16) {
    bctx.fillStyle = '#252525';
    bctx.fillRect(0, y, size, 5);
    bctx.fillStyle = '#e0e0e0';
    bctx.fillRect(0, y + 5, size, 3);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function createSolarPanelTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0c274d';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  for (let i = 0; i <= size; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, size - 4, size - 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRedTargetIconTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Soft crimson glow halo
  const grad = ctx.createRadialGradient(cx, cy, 18, cx, cy, 240);
  grad.addColorStop(0, 'rgba(255, 50, 50, 0.55)');
  grad.addColorStop(0.45, 'rgba(239, 30, 30, 0.22)');
  grad.addColorStop(0.85, 'rgba(220, 20, 20, 0.10)');
  grad.addColorStop(1, 'rgba(220, 20, 20, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Outer bold red target ring (4 segmented arcs)
  ctx.strokeStyle = '#ff2a2a';
  ctx.lineWidth = 14;
  for (let i = 0; i < 4; i++) {
    const start = i * (Math.PI / 2) + 0.18;
    const end = (i + 1) * (Math.PI / 2) - 0.18;
    ctx.beginPath();
    ctx.arc(cx, cy, 206, start, end);
    ctx.stroke();
  }

  // Middle precision ring
  ctx.strokeStyle = '#ff5252';
  ctx.lineWidth = 6;
  ctx.setLineDash([22, 14]);
  ctx.beginPath();
  ctx.arc(cx, cy, 144, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Inner lock-on ring
  ctx.strokeStyle = '#ff1e1e';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, 72, 0, Math.PI * 2);
  ctx.stroke();

  // 4 sharp cardinal crosshair spikes pointing inward
  ctx.fillStyle = '#ff2020';
  const spikes = [
    [cx - 8, 12, 16, 78],
    [cx - 8, size - 90, 16, 78],
    [12, cy - 8, 78, 16],
    [size - 90, cy - 8, 78, 16],
  ];
  for (const [x, y, w, h] of spikes) {
    ctx.fillRect(x, y, w, h);
  }

  // Inner crosshair lines
  ctx.strokeStyle = '#ff6b6b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 120, cy);
  ctx.lineTo(cx - 26, cy);
  ctx.moveTo(cx + 26, cy);
  ctx.lineTo(cx + 120, cy);
  ctx.moveTo(cx, cy - 120);
  ctx.lineTo(cx, cy - 26);
  ctx.moveTo(cx, cy + 26);
  ctx.lineTo(cx, cy + 120);
  ctx.stroke();

  // Bright center bullseye
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff1a1a';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---------------------------------------------------------------------------
// High-Detail Giant 4-Legged Twin-Cannon Robot Rig
// ---------------------------------------------------------------------------

interface TitanLegRig {
  side: -1 | 1; // -1 left, +1 right
  front: -1 | 1; // +1 front, -1 rear
  hipPivot: THREE.Group;
  kneePivot: THREE.Group;
  anklePivot: THREE.Group;
  baseHipX: number;
  baseHipY: number;
  baseHipZ: number;
}

interface TitanModelRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  turretGroup: THREE.Group;
  turretPitchGroup: THREE.Group;
  leftCannonGroup: THREE.Group;
  rightCannonGroup: THREE.Group;
  muzzleFlashLeft: THREE.Mesh;
  muzzleFlashRight: THREE.Mesh;
  thrusterFlame: THREE.Mesh;
  legs: TitanLegRig[];
  disposables: Array<{ dispose: () => void }>;
}

function buildDivineTitanModel(): TitanModelRig {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const armorTex = createArmorPlateTextures();
  track(armorTex.map);
  track(armorTex.bumpMap);

  const frameTex = createMechFrameTextures();
  track(frameTex.map);
  track(frameTex.bumpMap);

  // High-detail PBR materials
  const armorMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xeaf0f7,
      map: armorTex.map,
      bumpMap: armorTex.bumpMap,
      bumpScale: 0.045,
      metalness: 0.32,
      roughness: 0.34,
    }),
  );

  const armorSecondaryMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xbcc6d4,
      map: armorTex.map,
      bumpMap: armorTex.bumpMap,
      bumpScale: 0.035,
      metalness: 0.45,
      roughness: 0.38,
    }),
  );

  const frameMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x3b4452,
      map: frameTex.map,
      bumpMap: frameTex.bumpMap,
      bumpScale: 0.04,
      metalness: 0.72,
      roughness: 0.36,
    }),
  );

  const chromeMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xdbe3ee,
      metalness: 0.9,
      roughness: 0.18,
    }),
  );

  const goldTrimMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf5b742,
      metalness: 0.78,
      roughness: 0.25,
    }),
  );

  const glowCoreMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xff4422,
      emissive: 0xff3b1f,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.1,
    }),
  );

  const muzzleFlashMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xffe099,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  const thrusterFlameMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Chassis rests at y = 2.65 above ground (colossal ~6 units total height with twin cannons!)
  const CHASSIS_Y = 2.65;

  // 1. CENTRAL ARMORED CORE HULL
  const coreGeo = track(new THREE.BoxGeometry(2.1, 1.35, 2.55));
  const coreMesh = new THREE.Mesh(coreGeo, frameMat);
  coreMesh.position.set(0, CHASSIS_Y, 0);
  coreMesh.castShadow = true;
  coreMesh.receiveShadow = true;
  bodyGroup.add(coreMesh);

  // Upper beveled carapace deck
  const deckGeo = track(new THREE.BoxGeometry(2.35, 0.36, 2.75));
  const deckMesh = new THREE.Mesh(deckGeo, armorMat);
  deckMesh.position.set(0, CHASSIS_Y + 0.72, -0.05);
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  bodyGroup.add(deckMesh);

  // Sloped angular front cockpit prow (distinctive nose from reference image)
  const prowShape = new THREE.Shape();
  prowShape.moveTo(0, 0.65);
  prowShape.lineTo(1.15, 0.32);
  prowShape.lineTo(1.38, -0.22);
  prowShape.lineTo(0.88, -0.68);
  prowShape.lineTo(0, -0.58);
  prowShape.closePath();
  const prowGeo = track(
    new THREE.ExtrudeGeometry(prowShape, {
      depth: 1.48,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.08,
      bevelSegments: 4,
    }),
  );
  prowGeo.center();
  const prowMesh = new THREE.Mesh(prowGeo, armorMat);
  // Rotate so shape +X points along +Z (forward)
  prowMesh.rotation.y = -Math.PI / 2;
  prowMesh.position.set(0, CHASSIS_Y - 0.06, 1.52);
  prowMesh.castShadow = true;
  prowMesh.receiveShadow = true;
  bodyGroup.add(prowMesh);

  // Glowing divine optic visor strip recessed on front prow
  const visorFrameGeo = track(new THREE.BoxGeometry(1.12, 0.24, 0.22));
  const visorFrame = new THREE.Mesh(visorFrameGeo, frameMat);
  visorFrame.position.set(0, CHASSIS_Y + 0.12, 2.08);
  visorFrame.rotation.x = 0.28;
  bodyGroup.add(visorFrame);

  const visorGlowGeo = track(new THREE.BoxGeometry(0.92, 0.11, 0.14));
  const visorGlow = new THREE.Mesh(visorGlowGeo, glowCoreMat);
  visorGlow.position.set(0, CHASSIS_Y + 0.12, 2.16);
  visorGlow.rotation.x = 0.28;
  bodyGroup.add(visorGlow);

  // Underbelly divine reactor core ring
  const bellyRingGeo = track(new THREE.TorusGeometry(0.62, 0.1, 16, 32));
  const bellyRing = new THREE.Mesh(bellyRingGeo, goldTrimMat);
  bellyRing.rotation.x = Math.PI / 2;
  bellyRing.position.set(0, CHASSIS_Y - 0.7, 0);
  bodyGroup.add(bellyRing);

  const bellyCoreGeo = track(new THREE.CylinderGeometry(0.45, 0.35, 0.22, 24));
  const bellyCore = new THREE.Mesh(bellyCoreGeo, glowCoreMat);
  bellyCore.position.set(0, CHASSIS_Y - 0.72, 0);
  bodyGroup.add(bellyCore);

  // 2. SWEEPING CURVED SHOULDER COWLINGS / FENDERS (Left & Right, matching reference image!)
  const cowlShape = new THREE.Shape();
  cowlShape.moveTo(-1.85, 0.15);
  cowlShape.quadraticCurveTo(-1.25, 0.82, 0.25, 0.72);
  cowlShape.quadraticCurveTo(1.35, 0.65, 1.88, 0.18);
  cowlShape.lineTo(1.65, -0.58);
  cowlShape.quadraticCurveTo(0.95, -0.15, 0.15, -0.28);
  cowlShape.quadraticCurveTo(-0.85, -0.45, -1.62, -0.68);
  cowlShape.closePath();

  const cowlGeo = track(
    new THREE.ExtrudeGeometry(cowlShape, {
      depth: 0.56,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.09,
      bevelSegments: 5,
    }),
  );
  cowlGeo.center();

  for (const side of [-1, 1] as const) {
    const cowl = new THREE.Mesh(cowlGeo, armorMat);
    cowl.rotation.y = -Math.PI / 2;
    cowl.position.set(side * 1.48, CHASSIS_Y + 0.32, -0.1);
    cowl.rotation.z = side * -0.12;
    cowl.castShadow = true;
    cowl.receiveShadow = true;
    bodyGroup.add(cowl);

    // Gold divine trim rail along outer cowling
    const trimGeo = track(new THREE.BoxGeometry(0.12, 0.12, 2.4));
    const trim = new THREE.Mesh(trimGeo, goldTrimMat);
    trim.position.set(side * 1.82, CHASSIS_Y + 0.62, -0.1);
    bodyGroup.add(trim);

    // Curved hydraulic power cable looping from rear cowling down to rear leg mount
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 1.38, CHASSIS_Y + 0.05, -1.55),
      new THREE.Vector3(side * 1.65, CHASSIS_Y - 0.58, -1.95),
      new THREE.Vector3(side * 1.52, CHASSIS_Y - 1.32, -1.65),
      new THREE.Vector3(side * 1.25, CHASSIS_Y - 1.55, -1.15),
    ]);
    const cableGeo = track(new THREE.TubeGeometry(cableCurve, 22, 0.085, 12, false));
    const cableMesh = new THREE.Mesh(cableGeo, frameMat);
    cableMesh.castShadow = true;
    bodyGroup.add(cableMesh);
  }

  // 3. REAR THRUSTER / BOOSTER NOZZLE (matching reference image)
  const thrusterHousingGeo = track(new THREE.CylinderGeometry(0.46, 0.56, 0.72, 24));
  const thrusterHousing = new THREE.Mesh(thrusterHousingGeo, armorSecondaryMat);
  thrusterHousing.rotation.x = Math.PI / 2;
  thrusterHousing.position.set(0, CHASSIS_Y + 0.25, -1.68);
  thrusterHousing.castShadow = true;
  bodyGroup.add(thrusterHousing);

  const nozzleGeo = track(new THREE.CylinderGeometry(0.32, 0.48, 0.52, 24));
  const nozzle = new THREE.Mesh(nozzleGeo, frameMat);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, CHASSIS_Y + 0.25, -2.18);
  bodyGroup.add(nozzle);

  const thrusterFlameGeo = track(new THREE.ConeGeometry(0.38, 2.2, 20, 1, true));
  thrusterFlameGeo.translate(0, -1.1, 0);
  const thrusterFlame = new THREE.Mesh(thrusterFlameGeo, thrusterFlameMat);
  thrusterFlame.rotation.x = Math.PI / 2;
  thrusterFlame.position.set(0, CHASSIS_Y + 0.25, -2.35);
  bodyGroup.add(thrusterFlame);

  // 4. FOUR ARTICULATED REVERSE-JOINT MECHANICAL LEGS (high-detail, non-lowpoly!)
  const legs: TitanLegRig[] = [];
  const hipDrumGeo = track(new THREE.CylinderGeometry(0.42, 0.42, 0.54, 24));
  const thighArmorGeo = track(new THREE.CapsuleGeometry(0.42, 1.05, 10, 20));
  const pistonOuterGeo = track(new THREE.CylinderGeometry(0.11, 0.11, 1.1, 16));
  const pistonInnerGeo = track(new THREE.CylinderGeometry(0.065, 0.065, 1.25, 16));
  const kneeDrumGeo = track(new THREE.CylinderGeometry(0.34, 0.34, 0.52, 24));
  const kneeCapGeo = track(new THREE.CylinderGeometry(0.22, 0.22, 0.58, 20));
  const shinBeamGeo = track(new THREE.BoxGeometry(0.32, 1.75, 0.38));
  const shinArmorGeo = track(new THREE.BoxGeometry(0.44, 1.25, 0.26));
  const ankleDrumGeo = track(new THREE.CylinderGeometry(0.24, 0.24, 0.46, 20));

  // Elongated sleek mecha toe blade (matching reference image's long pointed feet!)
  const footToeShape = new THREE.Shape();
  footToeShape.moveTo(-0.25, 0);
  footToeShape.lineTo(1.28, 0.02);
  footToeShape.lineTo(1.05, 0.24);
  footToeShape.lineTo(0.25, 0.42);
  footToeShape.lineTo(-0.28, 0.36);
  footToeShape.closePath();
  const footToeGeo = track(
    new THREE.ExtrudeGeometry(footToeShape, {
      depth: 0.48,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.04,
      bevelSegments: 3,
    }),
  );
  footToeGeo.center();

  const heelClawGeo = track(new THREE.BoxGeometry(0.36, 0.24, 0.68));

  const legSpecs: Array<{ side: -1 | 1; front: -1 | 1; x: number; z: number }> = [
    { side: -1, front: 1, x: -1.42, z: 1.05 },
    { side: 1, front: 1, x: 1.42, z: 1.05 },
    { side: -1, front: -1, x: -1.42, z: -1.05 },
    { side: 1, front: -1, x: 1.42, z: -1.05 },
  ];

  for (const spec of legSpecs) {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(spec.x, CHASSIS_Y - 0.15, spec.z);
    bodyGroup.add(hipPivot);

    // Hip drum
    const hipDrum = new THREE.Mesh(hipDrumGeo, frameMat);
    hipDrum.rotation.z = Math.PI / 2;
    hipDrum.castShadow = true;
    hipPivot.add(hipDrum);

    // Splay legs slightly outward for massive intimidating quadruped stance
    const thighGroup = new THREE.Group();
    thighGroup.rotation.z = spec.side * 0.22;
    thighGroup.rotation.x = spec.front > 0 ? -0.45 : 0.42;
    hipPivot.add(thighGroup);

    // Sculpted bulbous armored thigh guard
    const thighArmor = new THREE.Mesh(thighArmorGeo, armorMat);
    thighArmor.position.set(spec.side * 0.14, -0.78, 0);
    thighArmor.scale.set(0.95, 1.0, 1.15);
    thighArmor.castShadow = true;
    thighArmor.receiveShadow = true;
    thighGroup.add(thighArmor);

    // Chrome hydraulic piston beside thigh
    const pistonOuter = new THREE.Mesh(pistonOuterGeo, frameMat);
    pistonOuter.position.set(spec.side * -0.14, -0.68, -0.22);
    thighGroup.add(pistonOuter);

    const pistonInner = new THREE.Mesh(pistonInnerGeo, chromeMat);
    pistonInner.position.set(spec.side * -0.14, -0.95, -0.22);
    thighGroup.add(pistonInner);

    // Knee pivot at end of thigh
    const kneePivot = new THREE.Group();
    kneePivot.position.set(spec.side * 0.12, -1.48, 0);
    thighGroup.add(kneePivot);

    const kneeDrum = new THREE.Mesh(kneeDrumGeo, frameMat);
    kneeDrum.rotation.z = Math.PI / 2;
    kneeDrum.castShadow = true;
    kneePivot.add(kneeDrum);

    const kneeCap = new THREE.Mesh(kneeCapGeo, goldTrimMat);
    kneeCap.rotation.z = Math.PI / 2;
    kneePivot.add(kneeCap);

    // Reverse-angled lower shin
    const shinAngle = spec.front > 0 ? 0.72 : -0.68;
    const shinGroup = new THREE.Group();
    shinGroup.rotation.x = shinAngle;
    shinGroup.rotation.z = spec.side * -0.16;
    kneePivot.add(shinGroup);

    const shinBeam = new THREE.Mesh(shinBeamGeo, frameMat);
    shinBeam.position.set(0, -0.88, 0);
    shinBeam.castShadow = true;
    shinGroup.add(shinBeam);

    const shinArmor = new THREE.Mesh(shinArmorGeo, armorSecondaryMat);
    shinArmor.position.set(0, -0.76, spec.front > 0 ? 0.18 : -0.18);
    shinArmor.castShadow = true;
    shinGroup.add(shinArmor);

    const shinPiston = new THREE.Mesh(pistonInnerGeo, chromeMat);
    shinPiston.position.set(spec.side * 0.18, -0.86, -0.16);
    shinGroup.add(shinPiston);

    // Ankle & elongated mecha foot
    const anklePivot = new THREE.Group();
    anklePivot.position.set(0, -1.72, 0);
    // Counter-rotate so foot rests flat on ground
    anklePivot.rotation.x = -(spec.front > 0 ? -0.45 : 0.42) - shinAngle;
    anklePivot.rotation.z = spec.side * -0.06;
    shinGroup.add(anklePivot);

    const ankleDrum = new THREE.Mesh(ankleDrumGeo, frameMat);
    ankleDrum.rotation.z = Math.PI / 2;
    anklePivot.add(ankleDrum);

    const footToe = new THREE.Mesh(footToeGeo, armorMat);
    footToe.rotation.y = -Math.PI / 2;
    footToe.position.set(0, -0.14, 0.46);
    footToe.castShadow = true;
    footToe.receiveShadow = true;
    anklePivot.add(footToe);

    const heelClaw = new THREE.Mesh(heelClawGeo, armorSecondaryMat);
    heelClaw.position.set(0, -0.16, -0.34);
    heelClaw.castShadow = true;
    anklePivot.add(heelClaw);

    legs.push({
      side: spec.side,
      front: spec.front,
      hipPivot,
      kneePivot,
      anklePivot,
      baseHipX: spec.x,
      baseHipY: CHASSIS_Y - 0.15,
      baseHipZ: spec.z,
    });
  }

  // 5. DORSAL TURRET & TWO MASSIVE RAIL-CANNONS (follows mouse cursor independently!)
  const turretGroup = new THREE.Group();
  turretGroup.position.set(0, CHASSIS_Y + 0.96, -0.08);
  root.add(turretGroup);

  // Heavy rotary turret ring
  const turretRingGeo = track(new THREE.CylinderGeometry(1.08, 1.18, 0.34, 32));
  const turretRing = new THREE.Mesh(turretRingGeo, frameMat);
  turretRing.castShadow = true;
  turretGroup.add(turretRing);

  const turretRingTrimGeo = track(new THREE.TorusGeometry(1.12, 0.06, 12, 32));
  const turretRingTrim = new THREE.Mesh(turretRingTrimGeo, goldTrimMat);
  turretRingTrim.rotation.x = Math.PI / 2;
  turretRingTrim.position.y = 0.12;
  turretGroup.add(turretRingTrim);

  // Pitch cradle
  const turretPitchGroup = new THREE.Group();
  turretPitchGroup.position.set(0, 0.56, 0);
  turretGroup.add(turretPitchGroup);

  // Dorsal armored turret bridge & stabilizer shroud
  const bridgeGeo = track(new THREE.BoxGeometry(1.92, 0.52, 1.85));
  const bridgeMesh = new THREE.Mesh(bridgeGeo, armorSecondaryMat);
  bridgeMesh.position.set(0, 0, -0.2);
  bridgeMesh.castShadow = true;
  turretPitchGroup.add(bridgeMesh);

  // Sleek upper dorsal spine crest (like the top sensor/shroud fin in reference image)
  const crestGeo = track(new THREE.BoxGeometry(0.76, 0.28, 2.25));
  const crestMesh = new THREE.Mesh(crestGeo, armorMat);
  crestMesh.position.set(0, 0.36, -0.15);
  crestMesh.castShadow = true;
  turretPitchGroup.add(crestMesh);

  // Rear counterweight & ammunition/energy feed block
  const rearBlockGeo = track(new THREE.BoxGeometry(1.56, 0.44, 0.85));
  const rearBlock = new THREE.Mesh(rearBlockGeo, frameMat);
  rearBlock.position.set(0, 0.06, -1.52);
  rearBlock.castShadow = true;
  turretPitchGroup.add(rearBlock);

  // Builder for each of the TWO MASSIVE CANNONS on top
  const breechShroudGeo = track(new THREE.BoxGeometry(0.62, 0.54, 2.15));
  const recoilCoilGeo = track(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 20));
  const mainBarrelGeo = track(new THREE.CylinderGeometry(0.18, 0.24, 3.85, 24));
  const outerJacketGeo = track(new THREE.BoxGeometry(0.46, 0.38, 2.05));
  const barrelTipGeo = track(new THREE.CylinderGeometry(0.22, 0.19, 0.55, 24));
  const sightFinGeo = track(new THREE.BoxGeometry(0.08, 0.32, 0.24));
  const plasmaRailGeo = track(new THREE.BoxGeometry(0.07, 0.09, 2.8));
  const muzzleFlashGeo = track(new THREE.SphereGeometry(0.65, 16, 12));

  const buildCannon = (side: -1 | 1): { group: THREE.Group; flash: THREE.Mesh } => {
    const cGroup = new THREE.Group();
    cGroup.position.set(side * 0.72, 0.16, 0.25);

    // Rear ribbed accordion recoil sleeve (matching reference image!)
    for (let r = 0; r < 6; r++) {
      const coil = new THREE.Mesh(recoilCoilGeo, frameMat);
      coil.rotation.x = Math.PI / 2;
      coil.position.set(0, 0, -1.15 - r * 0.14);
      cGroup.add(coil);
    }

    // Armored breech shroud
    const breech = new THREE.Mesh(breechShroudGeo, armorMat);
    breech.position.set(0, 0.05, 0.15);
    breech.castShadow = true;
    breech.receiveShadow = true;
    cGroup.add(breech);

    // Mid-barrel armored jacket
    const jacket = new THREE.Mesh(outerJacketGeo, armorSecondaryMat);
    jacket.position.set(0, -0.02, 1.85);
    jacket.castShadow = true;
    cGroup.add(jacket);

    // Massive long primary cannon barrel
    const barrel = new THREE.Mesh(mainBarrelGeo, chromeMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, 3.05);
    barrel.castShadow = true;
    cGroup.add(barrel);

    // Glowing divine energy accelerator rails along sides of barrel
    const rail = new THREE.Mesh(plasmaRailGeo, glowCoreMat);
    rail.position.set(side * 0.24, 0.04, 2.55);
    cGroup.add(rail);

    // Muzzle brake & raised front iron sight fin (distinctive detail from reference image!)
    const tip = new THREE.Mesh(barrelTipGeo, frameMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0, 4.95);
    tip.castShadow = true;
    cGroup.add(tip);

    const sight = new THREE.Mesh(sightFinGeo, armorMat);
    sight.position.set(0, 0.26, 4.78);
    cGroup.add(sight);

    const flash = new THREE.Mesh(muzzleFlashGeo, muzzleFlashMat);
    flash.position.set(0, 0, 5.45);
    flash.scale.set(0.8, 0.8, 2.0);
    cGroup.add(flash);

    turretPitchGroup.add(cGroup);
    return { group: cGroup, flash };
  };

  const leftBuilt = buildCannon(-1);
  const rightBuilt = buildCannon(1);

  return {
    root,
    bodyGroup,
    turretGroup,
    turretPitchGroup,
    leftCannonGroup: leftBuilt.group,
    rightCannonGroup: rightBuilt.group,
    muzzleFlashLeft: leftBuilt.flash,
    muzzleFlashRight: rightBuilt.flash,
    thrusterFlame,
    legs,
    disposables,
  };
}

// ---------------------------------------------------------------------------
// Orbital Satellite + Laser Beam VFX Rig (Skill 1)
// ---------------------------------------------------------------------------

interface OrbitalStrikeVisual {
  group: THREE.Group;
  satellite: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  gyroRing: THREE.Mesh;
  targetIcon: THREE.Mesh;
  lockLines: THREE.Mesh;
  beamGroup: THREE.Group;
  beamCore: THREE.Mesh;
  beamOuter: THREE.Mesh;
  impactFlare: THREE.Mesh;
  pulseRings: THREE.Mesh[];
}

function buildOrbitalStrikeVisual(
  solarTex: THREE.CanvasTexture,
  redTargetTex: THREE.CanvasTexture,
): OrbitalStrikeVisual {
  const group = new THREE.Group();

  // 1. Ground Red Target Icon (prominent, high-contrast, animated)
  const targetGeo = new THREE.PlaneGeometry(11.6, 11.6);
  targetGeo.rotateX(-Math.PI / 2);
  const targetMat = new THREE.MeshBasicMaterial({
    map: redTargetTex,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const targetIcon = new THREE.Mesh(targetGeo, targetMat);
  targetIcon.position.y = 0.22;
  group.add(targetIcon);

  // Vertical crimson lock-on targeting cone/lines
  const lockGeo = new THREE.CylinderGeometry(0.18, 4.2, 26, 16, 1, true);
  lockGeo.translate(0, 13, 0);
  const lockMat = new THREE.MeshBasicMaterial({
    color: 0xff2a2a,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const lockLines = new THREE.Mesh(lockGeo, lockMat);
  group.add(lockLines);

  // 2. Detailed 3D Orbital Satellite hovering high in the sky
  const satellite = new THREE.Group();
  satellite.position.y = 26;
  group.add(satellite);

  const satBodyMat = new THREE.MeshStandardMaterial({
    color: 0xf5c851,
    metalness: 0.82,
    roughness: 0.25,
  });
  const satMetalMat = new THREE.MeshStandardMaterial({
    color: 0xdbe4ee,
    metalness: 0.72,
    roughness: 0.3,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    map: solarTex,
    metalness: 0.45,
    roughness: 0.3,
    emissive: 0x0a2e5c,
    emissiveIntensity: 0.4,
  });
  const lensMat = new THREE.MeshBasicMaterial({
    color: 0xff3b30,
  });

  const satCore = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 2.2, 8), satBodyMat);
  satellite.add(satCore);

  const satCap = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.1, 8), satMetalMat);
  satCap.position.y = 1.65;
  satellite.add(satCap);

  const emitterDish = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 0.75, 0.9, 16), satMetalMat);
  emitterDish.position.y = -1.45;
  satellite.add(emitterDish);

  const emitterLens = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), lensMat);
  emitterLens.position.y = -1.8;
  satellite.add(emitterLens);

  const gyroRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.35, 0.14, 12, 32),
    satMetalMat,
  );
  gyroRing.rotation.x = Math.PI / 2;
  gyroRing.position.y = -0.5;
  satellite.add(gyroRing);

  // Unfolding solar wings
  const wingGeo = new THREE.BoxGeometry(5.6, 0.12, 2.1);
  const leftWing = new THREE.Mesh(wingGeo, wingMat);
  leftWing.position.set(-4.0, 0.15, 0);
  satellite.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, wingMat);
  rightWing.position.set(4.0, 0.15, 0);
  satellite.add(rightWing);

  // 3. Towering Orbital Laser Beam
  const beamGroup = new THREE.Group();
  beamGroup.visible = false;
  group.add(beamGroup);

  const beamCoreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.96,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const beamOuterMat = new THREE.MeshBasicMaterial({
    color: 0xff2a1a,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 26, 20, 1, true), beamCoreMat);
  beamCore.position.y = 13;
  beamGroup.add(beamCore);

  const beamOuter = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.85, 26, 24, 1, true), beamOuterMat);
  beamOuter.position.y = 13;
  beamGroup.add(beamOuter);

  const impactFlare = new THREE.Mesh(
    new THREE.SphereGeometry(3.8, 20, 16),
    new THREE.MeshBasicMaterial({
      color: 0xff6b35,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  impactFlare.scale.set(1.25, 0.45, 1.25);
  impactFlare.position.y = 0.5;
  beamGroup.add(impactFlare);

  const pulseRings: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.18, 10, 28),
      new THREE.MeshBasicMaterial({
        color: 0xffaa44,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    beamGroup.add(ring);
    pulseRings.push(ring);
  }

  return {
    group,
    satellite,
    leftWing,
    rightWing,
    gyroRing,
    targetIcon,
    lockLines,
    beamGroup,
    beamCore,
    beamOuter,
    impactFlare,
    pulseRings,
  };
}

// ---------------------------------------------------------------------------
// Crescent Slash Wave Mesh (M1)
// ---------------------------------------------------------------------------

function createCrescentSlashGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const outerR = 4.2;
  const innerR = 2.95;
  const segments = 24;
  const startAngle = -Math.PI * 0.42;
  const endAngle = Math.PI * 0.42;

  for (let i = 0; i <= segments; i++) {
    const a = startAngle + ((endAngle - startAngle) * i) / segments;
    const x = Math.sin(a) * outerR;
    const y = Math.cos(a) * outerR;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = segments; i >= 0; i--) {
    const a = startAngle + ((endAngle - startAngle) * i) / segments;
    const taper = Math.sin((i / segments) * Math.PI);
    const r = outerR - (outerR - innerR) * Math.max(0.12, taper);
    const x = Math.sin(a) * r;
    const y = Math.cos(a) * r;
    shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  geo.rotateX(Math.PI / 2);
  return geo;
}

// ---------------------------------------------------------------------------
// Main Renderer Controller attached to IsometricWorldCanvas
// ---------------------------------------------------------------------------

export class DivineTitanRenderer {
  public readonly group: THREE.Group;
  private rig: TitanModelRig;
  private redTargetTex: THREE.CanvasTexture;
  private solarTex: THREE.CanvasTexture;
  private slashGeo: THREE.BufferGeometry;
  private shockTorusGeo: THREE.TorusGeometry;
  private shockDiscGeo: THREE.RingGeometry;

  private cursorReticle: THREE.Mesh;
  private leapPreviewRing: THREE.Mesh;

  // Sky beam for Summon & Exit Extraction
  private skyBeamGroup: THREE.Group;
  private skyBeamCore: THREE.Mesh;
  private skyBeamOuter: THREE.Mesh;
  private skyBeamRing: THREE.Mesh;

  private slashMeshes = new Map<string, { group: THREE.Group; core: THREE.Mesh; aura: THREE.Mesh }>();
  private shockwaveMeshes = new Map<string, { group: THREE.Group; torus: THREE.Mesh; ring: THREE.Mesh }>();
  private orbitalVisuals = new Map<string, OrbitalStrikeVisual>();

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'divine_titan_system';
    scene.add(this.group);

    this.rig = buildDivineTitanModel();
    this.rig.root.visible = false;
    this.group.add(this.rig.root);

    this.redTargetTex = createRedTargetIconTexture();
    this.solarTex = createSolarPanelTexture();
    this.slashGeo = createCrescentSlashGeometry();
    this.shockTorusGeo = new THREE.TorusGeometry(1.0, 0.14, 12, 40);
    this.shockTorusGeo.rotateX(Math.PI / 2);
    this.shockDiscGeo = new THREE.RingGeometry(0.68, 1.0, 40);
    this.shockDiscGeo.rotateX(-Math.PI / 2);

    // Cursor red target icon on the ground (aim indicator for cannons & Skill 1)
    const reticleGeo = new THREE.PlaneGeometry(5.6, 5.6);
    reticleGeo.rotateX(-Math.PI / 2);
    const reticleMat = new THREE.MeshBasicMaterial({
      map: this.redTargetTex,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.cursorReticle = new THREE.Mesh(reticleGeo, reticleMat);
    this.cursorReticle.visible = false;
    this.group.add(this.cursorReticle);

    // Skill 2 leap landing indicator ring
    const leapGeo = new THREE.RingGeometry(5.2, 6.2, 48);
    leapGeo.rotateX(-Math.PI / 2);
    const leapMat = new THREE.MeshBasicMaterial({
      color: 0xff6b1a,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.leapPreviewRing = new THREE.Mesh(leapGeo, leapMat);
    this.leapPreviewRing.visible = false;
    this.group.add(this.leapPreviewRing);

    // Summoning / Exit Extraction Sky Laser Beam
    this.skyBeamGroup = new THREE.Group();
    this.skyBeamGroup.visible = false;
    this.group.add(this.skyBeamGroup);

    this.skyBeamCore = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.5, 44, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.skyBeamCore.position.y = 22;
    this.skyBeamGroup.add(this.skyBeamCore);

    this.skyBeamOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.8, 44, 28, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.skyBeamOuter.position.y = 22;
    this.skyBeamGroup.add(this.skyBeamOuter);

    this.skyBeamRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.2, 0.22, 12, 36),
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.skyBeamRing.rotation.x = Math.PI / 2;
    this.skyBeamGroup.add(this.skyBeamRing);
  }

  public update(
    sim: SimulationState,
    _dt: number,
    elapsedTotal: number,
    sampleGroundY: (x: number, z: number) => number,
  ): void {
    const titan = sim.divineTitan;
    if (!titan) {
      this.rig.root.visible = false;
      this.cursorReticle.visible = false;
      this.leapPreviewRing.visible = false;
      this.skyBeamGroup.visible = false;
      this.clearDynamicEffects();
      return;
    }

    this.rig.root.visible = true;
    this.rig.root.position.set(titan.x, titan.y, titan.z);
    this.rig.bodyGroup.rotation.y = titan.bodyYaw;
    this.rig.turretGroup.rotation.y = titan.turretYaw;
    this.rig.turretPitchGroup.rotation.x = -titan.turretPitch;

    // Cannon recoil & muzzle flashes
    this.rig.leftCannonGroup.position.z = 0.25 - titan.recoilLeft * 0.72;
    this.rig.rightCannonGroup.position.z = 0.25 - titan.recoilRight * 0.72;
    (this.rig.muzzleFlashLeft.material as THREE.MeshBasicMaterial).opacity =
      titan.recoilLeft > 0.65 ? (titan.recoilLeft - 0.65) * 2.8 : 0;
    (this.rig.muzzleFlashRight.material as THREE.MeshBasicMaterial).opacity =
      titan.recoilRight > 0.65 ? (titan.recoilRight - 0.65) * 2.8 : 0;

    // Animate 4-legged heavy walker gait & jump poses
    this.animateRig(titan, elapsedTotal);

    // Cursor red target icon on the ground
    if (titan.phase === 'active' || titan.phase === 'jumping') {
      const aimGroundY = sampleGroundY(titan.aimX, titan.aimZ);
      this.cursorReticle.visible = true;
      this.cursorReticle.position.set(titan.aimX, aimGroundY + 0.18, titan.aimZ);
      this.cursorReticle.rotation.z = elapsedTotal * (titan.skill1Targeting ? 1.8 : 0.65);
      const pulse = 1 + Math.sin(elapsedTotal * (titan.skill1Targeting ? 10 : 5)) * 0.08;
      const scale = titan.skill1Targeting ? 2.05 * pulse : 1.05 * pulse;
      this.cursorReticle.scale.set(scale, scale, 1);
      (this.cursorReticle.material as THREE.MeshBasicMaterial).opacity = titan.skill1Targeting ? 0.98 : 0.72;
    } else {
      this.cursorReticle.visible = false;
    }

    // Skill 2 leap landing indicator ring
    if (titan.phase === 'jumping') {
      const landY = sampleGroundY(titan.jumpTargetX, titan.jumpTargetZ);
      this.leapPreviewRing.visible = true;
      this.leapPreviewRing.position.set(titan.jumpTargetX, landY + 0.2, titan.jumpTargetZ);
      const p = 0.92 + Math.sin(elapsedTotal * 14) * 0.12;
      this.leapPreviewRing.scale.set(p, p, 1);
    } else {
      this.leapPreviewRing.visible = false;
    }

    // Summoning / Exit Extraction Sky Laser Beam
    this.updateSkyBeam(titan, elapsedTotal);

    // Sync M1 Slashes, Shockwaves, and Skill 1 Orbital Satellite Strikes
    this.syncSlashes(titan.slashes);
    this.syncShockwaves(titan.shockwaves);
    this.syncOrbitalStrikes(titan.orbitalStrikes, elapsedTotal, sampleGroundY);
  }

  private animateRig(titan: DivineTitanState, elapsedTotal: number): void {
    const isMoving = titan.phase === 'active' && titan.moveSpeed > 0.35;
    let bodyBobY = 0;
    let bodyPitch = 0;
    let scaleFactor = 1.0;

    if (titan.phase === 'summoning') {
      const t = Math.min(1, titan.phaseTimer / TITAN_SUMMON_DURATION);
      scaleFactor = 0.2 + 0.8 * (1 - (1 - t) * (1 - t));
      bodyBobY = (1 - t) * 2.2;
    } else if (titan.phase === 'exiting') {
      const t = Math.min(1, titan.phaseTimer / TITAN_EXIT_DURATION);
      // First 0.35s laser strikes down onto Titan; then Titan dissolves & shrinks into light
      const dissolveT = Math.max(0, (t - 0.35) / 0.65);
      scaleFactor = Math.max(0.01, 1 - dissolveT * dissolveT);
      bodyBobY = dissolveT * 1.4;
    } else if (titan.phase === 'jumping') {
      if (titan.jumpElapsed < titan.jumpWindup) {
        const w = titan.jumpElapsed / Math.max(0.01, titan.jumpWindup);
        bodyBobY = -0.75 * Math.sin(w * Math.PI * 0.5);
        bodyPitch = 0.14 * w;
      } else {
        const flightT = Math.min(1, (titan.jumpElapsed - titan.jumpWindup) / titan.jumpDuration);
        bodyPitch = (0.5 - flightT) * 0.42;
      }
    } else if (isMoving) {
      bodyBobY = Math.abs(Math.sin(titan.walkCycle)) * 0.26;
      bodyPitch = Math.sin(titan.walkCycle * 2) * 0.04;
    } else {
      // Subtle hydraulic idle breathing
      bodyBobY = Math.sin(elapsedTotal * 2.2) * 0.06;
    }

    this.rig.root.scale.setScalar(scaleFactor);
    this.rig.bodyGroup.position.y = bodyBobY;
    this.rig.bodyGroup.rotation.x = bodyPitch;
    this.rig.turretGroup.position.y = 2.65 + 0.96 + bodyBobY;

    // Thruster flame flare during jump or movement
    const flameScale =
      titan.phase === 'jumping'
        ? 1.7 + Math.sin(elapsedTotal * 40) * 0.35
        : isMoving
          ? 0.55 + Math.sin(elapsedTotal * 24) * 0.12
          : 0.25;
    this.rig.thrusterFlame.scale.set(flameScale * 0.65, flameScale, flameScale * 0.65);

    // 4-leg articulated diagonal gait (FL+RR together, FR+RL opposite phase)
    for (const leg of this.rig.legs) {
      const diagPhase = leg.side * leg.front > 0 ? 0 : Math.PI;
      if (titan.phase === 'jumping') {
        if (titan.jumpElapsed < titan.jumpWindup) {
          // Deep coil crouch
          leg.hipPivot.rotation.x = leg.front * -0.45;
          leg.kneePivot.rotation.x = leg.front * 0.42;
        } else {
          // Dynamic airborne tuck
          leg.hipPivot.rotation.x = leg.front * 0.35;
          leg.kneePivot.rotation.x = leg.front * -0.25;
        }
      } else if (isMoving) {
        const cyc = titan.walkCycle + diagPhase;
        const swing = Math.sin(cyc) * 0.44;
        const lift = Math.max(0, Math.cos(cyc)) * 0.38;
        leg.hipPivot.rotation.x = swing;
        leg.kneePivot.rotation.x = -lift * leg.front;
      } else {
        leg.hipPivot.rotation.x *= 0.85;
        leg.kneePivot.rotation.x *= 0.85;
      }
    }
  }

  private updateSkyBeam(titan: DivineTitanState, elapsedTotal: number): void {
    if (titan.phase !== 'summoning' && titan.phase !== 'exiting') {
      this.skyBeamGroup.visible = false;
      return;
    }

    this.skyBeamGroup.visible = true;
    this.skyBeamGroup.position.set(titan.x, titan.y, titan.z);

    if (titan.phase === 'summoning') {
      const t = Math.min(1, titan.phaseTimer / TITAN_SUMMON_DURATION);
      const fade = 1 - t;
      (this.skyBeamOuter.material as THREE.MeshBasicMaterial).color.setHex(0xfbbf24);
      (this.skyBeamRing.material as THREE.MeshBasicMaterial).color.setHex(0xfde68a);
      (this.skyBeamCore.material as THREE.MeshBasicMaterial).opacity = fade * 0.95;
      (this.skyBeamOuter.material as THREE.MeshBasicMaterial).opacity = fade * 0.6;
      const w = 0.5 + fade * 1.1;
      this.skyBeamCore.scale.set(w, 1, w);
      this.skyBeamOuter.scale.set(w, 1, w);
      this.skyBeamRing.position.y = 0.35 + t * 5.0;
      this.skyBeamRing.scale.setScalar(1 + t * 1.4);
      (this.skyBeamRing.material as THREE.MeshBasicMaterial).opacity = fade * 0.85;
    } else {
      // EXIT EXTRACTION LASER BEAM from sky landing directly on the entity before it vanishes!
      const t = Math.min(1, titan.phaseTimer / TITAN_EXIT_DURATION);
      (this.skyBeamOuter.material as THREE.MeshBasicMaterial).color.setHex(0x38bdf8);
      (this.skyBeamRing.material as THREE.MeshBasicMaterial).color.setHex(0xbae6fd);

      // Beam strikes downward rapidly in first 0.22s, peaks brightly, then narrows and fades as Titan vanishes
      const strikeDown = Math.min(1, t / 0.22);
      const fadeOut = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
      const beamRadius = (0.35 + 0.85 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5)) * (0.4 + 0.6 * fadeOut);

      this.skyBeamCore.scale.set(beamRadius, strikeDown, beamRadius);
      this.skyBeamCore.position.y = 44 - 22 * strikeDown;
      this.skyBeamOuter.scale.set(beamRadius * 1.15, strikeDown, beamRadius * 1.15);
      this.skyBeamOuter.position.y = 44 - 22 * strikeDown;

      (this.skyBeamCore.material as THREE.MeshBasicMaterial).opacity = 0.95 * fadeOut;
      (this.skyBeamOuter.material as THREE.MeshBasicMaterial).opacity = 0.62 * fadeOut;

      this.skyBeamRing.position.y = 0.3 + ((elapsedTotal * 12) % 8.0);
      this.skyBeamRing.scale.setScalar(0.85 + 0.45 * fadeOut);
      (this.skyBeamRing.material as THREE.MeshBasicMaterial).opacity = 0.9 * fadeOut;
    }
  }

  private syncSlashes(slashes: TitanSlashEffect[]): void {
    const aliveIds = new Set<string>();
    for (const s of slashes) {
      aliveIds.add(s.id);
      let vis = this.slashMeshes.get(s.id);
      if (!vis) {
        const grp = new THREE.Group();
        const core = new THREE.Mesh(
          this.slashGeo,
          new THREE.MeshBasicMaterial({
            color: 0xfff5d6,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        const aura = new THREE.Mesh(
          this.slashGeo,
          new THREE.MeshBasicMaterial({
            color: 0xff3b1f,
            transparent: true,
            opacity: 0.72,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        aura.scale.set(1.18, 1.35, 1.18);
        grp.add(aura);
        grp.add(core);
        this.group.add(grp);
        vis = { group: grp, core, aura };
        this.slashMeshes.set(s.id, vis);
      }

      const t = Math.min(1, s.elapsed / s.duration);
      const easeOut = 1 - (1 - t) * (1 - t);
      const travel = easeOut * (s.range * 0.85);
      vis.group.position.set(
        s.x + Math.sin(s.yaw) * travel,
        s.y - easeOut * 0.6,
        s.z + Math.cos(s.yaw) * travel,
      );
      vis.group.rotation.set(0, s.yaw, s.tilt);
      const sc = 0.75 + easeOut * 1.15;
      vis.group.scale.set(sc, 1, sc);
      const alpha = 1 - t * t;
      (vis.core.material as THREE.MeshBasicMaterial).opacity = alpha * 0.96;
      (vis.aura.material as THREE.MeshBasicMaterial).opacity = alpha * 0.7;
    }

    for (const [id, vis] of this.slashMeshes.entries()) {
      if (!aliveIds.has(id)) {
        this.group.remove(vis.group);
        (vis.core.material as THREE.Material).dispose();
        (vis.aura.material as THREE.Material).dispose();
        this.slashMeshes.delete(id);
      }
    }
  }

  private syncShockwaves(shockwaves: TitanShockwaveEffect[]): void {
    const aliveIds = new Set<string>();
    for (const sw of shockwaves) {
      aliveIds.add(sw.id);
      let vis = this.shockwaveMeshes.get(sw.id);
      if (!vis) {
        const grp = new THREE.Group();
        const col = new THREE.Color(sw.color);
        const torus = new THREE.Mesh(
          this.shockTorusGeo,
          new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        const ring = new THREE.Mesh(
          this.shockDiscGeo,
          new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.52,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        grp.add(torus);
        grp.add(ring);
        this.group.add(grp);
        vis = { group: grp, torus, ring };
        this.shockwaveMeshes.set(sw.id, vis);
      }

      const t = Math.min(1, sw.elapsed / sw.duration);
      const ease = 1 - Math.pow(1 - t, 2.6);
      const rad = 0.75 + ease * sw.maxRadius;
      vis.group.position.set(sw.x, sw.y + 0.16, sw.z);
      const heightScale = sw.kind === 'slam' || sw.kind === 'tsunami_slam' ? 2.4 * (1 - t * 0.65) : 1.0;
      vis.torus.scale.set(rad, heightScale, rad);
      vis.ring.scale.set(rad, 1, rad);
      const alpha = Math.pow(1 - t, 1.4);
      (vis.torus.material as THREE.MeshBasicMaterial).opacity = alpha * 0.92;
      (vis.ring.material as THREE.MeshBasicMaterial).opacity = alpha * 0.5;
    }

    for (const [id, vis] of this.shockwaveMeshes.entries()) {
      if (!aliveIds.has(id)) {
        this.group.remove(vis.group);
        (vis.torus.material as THREE.Material).dispose();
        (vis.ring.material as THREE.Material).dispose();
        this.shockwaveMeshes.delete(id);
      }
    }
  }

  private syncOrbitalStrikes(
    strikes: TitanOrbitalStrike[],
    elapsedTotal: number,
    sampleGroundY: (x: number, z: number) => number,
  ): void {
    const aliveIds = new Set<string>();
    for (const st of strikes) {
      aliveIds.add(st.id);
      let vis = this.orbitalVisuals.get(st.id);
      if (!vis) {
        vis = buildOrbitalStrikeVisual(this.solarTex, this.redTargetTex);
        this.group.add(vis.group);
        this.orbitalVisuals.set(st.id, vis);
      }

      const gy = sampleGroundY(st.targetX, st.targetZ);
      vis.group.position.set(st.targetX, gy, st.targetZ);

      // Animate spinning Red Target Icon on the ground
      vis.targetIcon.rotation.z = elapsedTotal * 2.4;
      vis.gyroRing.rotation.z = elapsedTotal * 3.8;

      if (st.phase === 'lockon') {
        const t = Math.min(1, st.elapsed / st.lockonDuration);
        const ease = 1 - (1 - t) * (1 - t);
        // Satellite descends into orbital position & unfolds solar wings
        vis.satellite.position.y = 38 - 12 * ease;
        vis.leftWing.scale.x = 0.25 + 0.75 * ease;
        vis.rightWing.scale.x = 0.25 + 0.75 * ease;
        vis.targetIcon.scale.setScalar(1.35 - 0.35 * ease);
        (vis.targetIcon.material as THREE.MeshBasicMaterial).opacity = 0.98;
        vis.lockLines.visible = true;
        vis.lockLines.scale.set(1.2 - 0.8 * ease, 1, 1.2 - 0.8 * ease);
        vis.beamGroup.visible = false;
      } else if (st.phase === 'firing') {
        vis.satellite.position.y = 26 + Math.sin(elapsedTotal * 18) * 0.15;
        vis.leftWing.scale.x = 1;
        vis.rightWing.scale.x = 1;
        vis.targetIcon.scale.setScalar(1.05 + Math.sin(elapsedTotal * 20) * 0.08);
        (vis.targetIcon.material as THREE.MeshBasicMaterial).opacity = 0.92;
        vis.lockLines.visible = false;
        vis.beamGroup.visible = true;

        const flicker = 0.92 + Math.sin(elapsedTotal * 45) * 0.12;
        vis.beamCore.scale.set(flicker, 1, flicker);
        vis.beamOuter.scale.set(flicker * 1.05, 1, flicker * 1.05);
        (vis.beamCore.material as THREE.MeshBasicMaterial).opacity = 0.96;
        (vis.beamOuter.material as THREE.MeshBasicMaterial).opacity = 0.68;

        vis.impactFlare.scale.set(1.3 * flicker, 0.5 * flicker, 1.3 * flicker);
        (vis.impactFlare.material as THREE.MeshBasicMaterial).opacity = 0.85;

        // Animated descending plasma pulse rings along the beam
        for (let i = 0; i < vis.pulseRings.length; i++) {
          const ring = vis.pulseRings[i];
          const phase = ((elapsedTotal * 2.2 + i * 0.25) % 1);
          ring.position.y = 25 * (1 - phase);
          const rs = 0.75 + phase * 0.85;
          ring.scale.setScalar(rs);
          (ring.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.85;
        }
      } else {
        // fadeout: beam shrinks, satellite ascends back to orbit
        const t = Math.min(1, st.elapsed / st.fadeDuration);
        const fade = 1 - t;
        vis.satellite.position.y = 26 + t * 18;
        vis.lockLines.visible = false;
        vis.beamGroup.visible = true;
        vis.beamCore.scale.set(fade, 1, fade);
        vis.beamOuter.scale.set(fade, 1, fade);
        (vis.beamCore.material as THREE.MeshBasicMaterial).opacity = fade * 0.9;
        (vis.beamOuter.material as THREE.MeshBasicMaterial).opacity = fade * 0.55;
        (vis.impactFlare.material as THREE.MeshBasicMaterial).opacity = fade * 0.65;
        (vis.targetIcon.material as THREE.MeshBasicMaterial).opacity = fade * 0.85;
        for (const ring of vis.pulseRings) {
          (ring.material as THREE.MeshBasicMaterial).opacity = fade * 0.5;
        }
      }
    }

    for (const [id, vis] of this.orbitalVisuals.entries()) {
      if (!aliveIds.has(id)) {
        this.group.remove(vis.group);
        vis.group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
        this.orbitalVisuals.delete(id);
      }
    }
  }

  private clearDynamicEffects(): void {
    for (const [, vis] of this.slashMeshes.entries()) {
      this.group.remove(vis.group);
      (vis.core.material as THREE.Material).dispose();
      (vis.aura.material as THREE.Material).dispose();
    }
    this.slashMeshes.clear();

    for (const [, vis] of this.shockwaveMeshes.entries()) {
      this.group.remove(vis.group);
      (vis.torus.material as THREE.Material).dispose();
      (vis.ring.material as THREE.Material).dispose();
    }
    this.shockwaveMeshes.clear();

    for (const [, vis] of this.orbitalVisuals.entries()) {
      this.group.remove(vis.group);
    }
    this.orbitalVisuals.clear();
  }

  public dispose(): void {
    this.clearDynamicEffects();
    for (const d of this.rig.disposables) {
      d.dispose();
    }
    this.redTargetTex.dispose();
    this.solarTex.dispose();
    this.slashGeo.dispose();
    this.shockTorusGeo.dispose();
    this.shockDiscGeo.dispose();
    this.group.removeFromParent();
  }
}
