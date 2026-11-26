import * as THREE from 'three';
import {
  DivineTitanState,
  SimulationState,
  TitanMissile,
  TitanMushroomCloud,
  TitanOrbitalStrike,
  TitanShockwaveEffect,
  TitanSlashEffect,
} from './types';
import { TITAN_EXIT_DURATION, TITAN_SUMMON_DURATION } from './divineTitan';

// ---------------------------------------------------------------------------
// Procedural High-Resolution Sci-Fi Conqueror Textures (512x512)
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

  // Tactical military sci-fi greenish-grey (olive-slate) titanium hull plating
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#7c8a7f');
  bg.addColorStop(0.5, '#68766c');
  bg.addColorStop(1, '#546158');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Brushed directional alloy grain & battle micro-scratches
  for (let i = 0; i < 2400; i++) {
    const x = (i * 197) % size;
    const y = (i * 353) % size;
    const w = 10 + (i % 42);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(210,226,214,0.09)' : 'rgba(26,34,29,0.10)';
    ctx.fillRect(x, y, w, 1.5);
  }

  // Crisp armored panel seams with chamfered bevel highlights
  const grid = [0, 128, 256, 384, 512];
  ctx.strokeStyle = 'rgba(28, 36, 31, 0.78)';
  ctx.lineWidth = 4;
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
  ctx.strokeStyle = 'rgba(195, 212, 198, 0.42)';
  ctx.lineWidth = 1.6;
  for (const g of [131, 259, 387]) {
    ctx.beginPath();
    ctx.moveTo(g, 0);
    ctx.lineTo(g, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, g);
    ctx.lineTo(size, g);
    ctx.stroke();
  }

  // Recessed angular maintenance hatches & vent louver grates
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const bx = gx * 128;
      const by = gy * 128;
      if ((gx + gy) % 2 === 0) {
        // Louvered exhaust vent
        ctx.fillStyle = '#313a34';
        ctx.fillRect(bx + 22, by + 26, 84, 34);
        for (let lv = 0; lv < 5; lv++) {
          ctx.fillStyle = '#7e8c81';
          ctx.fillRect(bx + 25, by + 29 + lv * 6, 78, 3);
        }
      } else {
        // Diagonal tactical hazard stripe band (crimson-amber & olive-slate)
        ctx.save();
        ctx.beginPath();
        ctx.rect(bx + 14, by + 92, 100, 18);
        ctx.clip();
        ctx.fillStyle = '#38423b';
        ctx.fillRect(bx + 14, by + 92, 100, 18);
        ctx.fillStyle = '#b43428';
        for (let s = -20; s < 120; s += 20) {
          ctx.beginPath();
          ctx.moveTo(bx + 14 + s, by + 110);
          ctx.lineTo(bx + 24 + s, by + 110);
          ctx.lineTo(bx + 36 + s, by + 92);
          ctx.lineTo(bx + 26 + s, by + 92);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Heavy corner armor bolts
      for (const [ox, oy] of [
        [12, 12],
        [116, 12],
        [12, 116],
        [116, 116],
        [64, 12],
        [64, 116],
      ]) {
        ctx.fillStyle = '#2b342e';
        ctx.beginPath();
        ctx.arc(bx + ox, by + oy, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b8c7bc';
        ctx.beginPath();
        ctx.arc(bx + ox - 0.8, by + oy - 0.8, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Metallic edge wear highlights
  ctx.strokeStyle = 'rgba(205, 222, 210, 0.28)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const sx = (i * 89) % size;
    const sy = (i * 137) % size;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 18, sy + 7);
    ctx.stroke();
  }

  // High-contrast bump map
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#a4a4a4';
  bctx.fillRect(0, 0, size, size);
  bctx.strokeStyle = '#181818';
  bctx.lineWidth = 5;
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
      if ((gx + gy) % 2 === 0) {
        bctx.fillStyle = '#202020';
        bctx.fillRect(bx + 22, by + 26, 84, 34);
        for (let lv = 0; lv < 5; lv++) {
          bctx.fillStyle = '#e5e5e5';
          bctx.fillRect(bx + 25, by + 29 + lv * 6, 78, 3);
        }
      }
      for (const [ox, oy] of [
        [12, 12],
        [116, 12],
        [12, 116],
        [116, 116],
        [64, 12],
        [64, 116],
      ]) {
        bctx.fillStyle = '#ffffff';
        bctx.beginPath();
        bctx.arc(bx + ox, by + oy, 3.6, 0, Math.PI * 2);
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

  // Weathered greenish-slate industrial steel frame
  ctx.fillStyle = '#48544c';
  ctx.fillRect(0, 0, size, size);

  // Heavy industrial hydraulic ribs & cross-braced steel mesh
  for (let y = 0; y < size; y += 12) {
    ctx.fillStyle = 'rgba(24, 31, 27, 0.62)';
    ctx.fillRect(0, y, size, 4);
    ctx.fillStyle = 'rgba(175, 194, 180, 0.22)';
    ctx.fillRect(0, y + 4, size, 2);
  }
  ctx.strokeStyle = 'rgba(165, 184, 170, 0.22)';
  ctx.lineWidth = 2;
  for (let i = -size; i < size * 2; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + size, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
  }

  const bump = document.createElement('canvas');
  bump.width = size;
  bump.height = size;
  const bctx = bump.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 12) {
    bctx.fillStyle = '#181818';
    bctx.fillRect(0, y, size, 5);
    bctx.fillStyle = '#f0f0f0';
    bctx.fillRect(0, y + 5, size, 2.5);
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
// Hyper-Detailed Terrifying Sci-Fi Conqueror 4-Legged War-Walker Rig
// ---------------------------------------------------------------------------

const TITAN_BASE_SCALE = 1.26;
const TITAN_CHASSIS_Y = 2.75;

interface TitanLegRig {
  side: -1 | 1; // -1 left, +1 right
  front: -1 | 1; // +1 front, -1 rear
  hipX: number;
  hipY: number;
  hipZ: number;
  homeLocalX: number;
  homeLocalZ: number;
  baseYaw: number;
  femurBaseZ: number;
  kneeBaseZ: number;
  phaseOffset: number;
  coxaYawPivot: THREE.Group;
  femurPivot: THREE.Group;
  kneePivot: THREE.Group;
  anklePivot: THREE.Group;
  // World-space foot-locked Inverse Kinematics state
  ikInitialized: boolean;
  footX: number;
  footY: number;
  footZ: number;
  isStepping: boolean;
  stepProgress: number;
  stepFromX: number;
  stepFromY: number;
  stepFromZ: number;
  stepToX: number;
  stepToY: number;
  stepToZ: number;
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
  thrusterFlames: THREE.Mesh[];
  scannerEye: THREE.Mesh;
  reactorRing: THREE.Group;
  radarDish: THREE.Group;
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

  // Tactical military sci-fi greenish-grey (olive-slate) armor palette
  const armorDarkMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x8a9a8e,
      map: armorTex.map,
      bumpMap: armorTex.bumpMap,
      bumpScale: 0.065,
      metalness: 0.48,
      roughness: 0.36,
    }),
  );

  const armorHighlightMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xa4b4a8,
      map: armorTex.map,
      bumpMap: armorTex.bumpMap,
      bumpScale: 0.055,
      metalness: 0.44,
      roughness: 0.32,
    }),
  );

  const armorObsidianMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x5c6960,
      map: armorTex.map,
      bumpMap: armorTex.bumpMap,
      bumpScale: 0.055,
      metalness: 0.58,
      roughness: 0.38,
    }),
  );

  const frameMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x627066,
      map: frameTex.map,
      bumpMap: frameTex.bumpMap,
      bumpScale: 0.06,
      metalness: 0.7,
      roughness: 0.35,
    }),
  );

  const chromeMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xd0dbe8,
      metalness: 0.94,
      roughness: 0.14,
    }),
  );

  const bronzeTrimMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xc88d3a,
      metalness: 0.84,
      roughness: 0.26,
    }),
  );

  const crimsonArmorMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x8f1d1d,
      map: armorTex.map,
      bumpMap: armorTex.bumpMap,
      bumpScale: 0.045,
      metalness: 0.55,
      roughness: 0.35,
    }),
  );

  const glowCrimsonMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xff241a,
      emissive: 0xff1e14,
      emissiveIntensity: 3.0,
      roughness: 0.15,
      metalness: 0.1,
    }),
  );

  const glowFurnaceMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xff6a1a,
      emissive: 0xff4500,
      emissiveIntensity: 2.6,
      roughness: 0.2,
      metalness: 0.1,
    }),
  );

  const muzzleFlashMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xffb366,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  const thrusterFlameMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xff4d1a,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const CHASSIS_Y = TITAN_CHASSIS_Y;

  // =========================================================================
  // 1. MULTI-TIERED OCTAGONAL ARMORED CORE & SIDE FURNACE RADIATORS
  // =========================================================================
  const coreOctGeo = track(new THREE.CylinderGeometry(1.52, 1.32, 1.38, 8));
  const coreOct = new THREE.Mesh(coreOctGeo, frameMat);
  coreOct.rotation.y = Math.PI / 8;
  coreOct.position.set(0, CHASSIS_Y, -0.05);
  coreOct.castShadow = true;
  coreOct.receiveShadow = true;
  bodyGroup.add(coreOct);

  // Sloped composite armored upper carapace
  const upperCarapaceGeo = track(new THREE.CylinderGeometry(1.42, 1.72, 0.48, 8));
  const upperCarapace = new THREE.Mesh(upperCarapaceGeo, armorDarkMat);
  upperCarapace.rotation.y = Math.PI / 8;
  upperCarapace.position.set(0, CHASSIS_Y + 0.72, -0.05);
  upperCarapace.castShadow = true;
  upperCarapace.receiveShadow = true;
  bodyGroup.add(upperCarapace);

  // Dorsal spine armor ribs running front-to-back
  const spineRibGeo = track(new THREE.BoxGeometry(0.18, 0.26, 2.75));
  for (const sx of [-0.55, 0.55]) {
    const rib = new THREE.Mesh(spineRibGeo, armorObsidianMat);
    rib.position.set(sx, CHASSIS_Y + 0.92, -0.05);
    rib.castShadow = true;
    bodyGroup.add(rib);
  }

  // Side heat-sink radiator fin banks with glowing furnace core behind them
  const finGeo = track(new THREE.BoxGeometry(0.22, 0.56, 0.08));
  const ventGlowGeo = track(new THREE.BoxGeometry(0.14, 0.42, 1.35));
  for (const side of [-1, 1] as const) {
    const ventGlow = new THREE.Mesh(ventGlowGeo, glowFurnaceMat);
    ventGlow.position.set(side * 1.18, CHASSIS_Y - 0.05, -0.1);
    bodyGroup.add(ventGlow);
    for (let f = 0; f < 7; f++) {
      const fin = new THREE.Mesh(finGeo, armorObsidianMat);
      fin.position.set(side * 1.28, CHASSIS_Y - 0.05, -0.7 + f * 0.2);
      fin.rotation.y = side * 0.22;
      bodyGroup.add(fin);
    }
  }

  // =========================================================================
  // 2. TERRIFYING CONQUEROR WAR-HEAD / PREDATOR SENSOR PROW
  // =========================================================================
  const prowShape = new THREE.Shape();
  prowShape.moveTo(0, 0.78);
  prowShape.lineTo(1.28, 0.52);
  prowShape.lineTo(1.62, 0.16);
  prowShape.lineTo(1.28, -0.08);
  prowShape.lineTo(1.42, -0.46);
  prowShape.lineTo(0.85, -0.76);
  prowShape.lineTo(0, -0.62);
  prowShape.closePath();

  const prowGeo = track(
    new THREE.ExtrudeGeometry(prowShape, {
      depth: 1.56,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.09,
      bevelSegments: 4,
    }),
  );
  prowGeo.center();
  const prowMesh = new THREE.Mesh(prowGeo, armorDarkMat);
  prowMesh.rotation.y = -Math.PI / 2;
  prowMesh.position.set(0, CHASSIS_Y - 0.04, 1.58);
  prowMesh.castShadow = true;
  prowMesh.receiveShadow = true;
  bodyGroup.add(prowMesh);

  // Aggressive crimson-trimmed brow crown overhanging the optic bay
  const browGeo = track(new THREE.BoxGeometry(1.78, 0.22, 0.72));
  const brow = new THREE.Mesh(browGeo, crimsonArmorMat);
  brow.position.set(0, CHASSIS_Y + 0.44, 1.98);
  brow.rotation.x = 0.28;
  brow.castShadow = true;
  bodyGroup.add(brow);

  // Recessed obsidian optic bay
  const opticBayGeo = track(new THREE.BoxGeometry(1.36, 0.34, 0.28));
  const opticBay = new THREE.Mesh(opticBayGeo, armorObsidianMat);
  opticBay.position.set(0, CHASSIS_Y + 0.12, 2.22);
  opticBay.rotation.x = 0.22;
  bodyGroup.add(opticBay);

  // Glowing crimson optic track + sweeping cyclops scanner eye + dual menacing side eyes
  const visorTrackGeo = track(new THREE.BoxGeometry(1.18, 0.06, 0.08));
  const visorTrack = new THREE.Mesh(visorTrackGeo, glowFurnaceMat);
  visorTrack.position.set(0, CHASSIS_Y + 0.12, 2.34);
  bodyGroup.add(visorTrack);

  const scannerEyeGeo = track(new THREE.SphereGeometry(0.14, 16, 12));
  const scannerEye = new THREE.Mesh(scannerEyeGeo, glowCrimsonMat);
  scannerEye.position.set(0, CHASSIS_Y + 0.12, 2.36);
  scannerEye.scale.set(1.3, 0.85, 0.8);
  bodyGroup.add(scannerEye);

  const sideEyeGeo = track(new THREE.BoxGeometry(0.28, 0.09, 0.1));
  for (const side of [-1, 1] as const) {
    const sideEye = new THREE.Mesh(sideEyeGeo, glowCrimsonMat);
    sideEye.position.set(side * 0.46, CHASSIS_Y + 0.18, 2.32);
    sideEye.rotation.z = side * -0.26;
    bodyGroup.add(sideEye);
  }

  // Twin armored forward mandible fangs / chin sensor blades
  const tuskGeo = track(new THREE.ConeGeometry(0.16, 0.95, 6));
  for (const side of [-1, 1] as const) {
    const tusk = new THREE.Mesh(tuskGeo, armorHighlightMat);
    tusk.rotation.x = Math.PI / 2 + 0.22;
    tusk.rotation.z = side * -0.14;
    tusk.position.set(side * 0.56, CHASSIS_Y - 0.42, 2.36);
    tusk.castShadow = true;
    bodyGroup.add(tusk);
  }

  // =========================================================================
  // 3. EXPOSED SPINNING UNDERBELLY GYRO-REACTOR CORE
  // =========================================================================
  const reactorRing = new THREE.Group();
  reactorRing.position.set(0, CHASSIS_Y - 0.72, -0.05);
  bodyGroup.add(reactorRing);

  const reactorTorusGeo = track(new THREE.TorusGeometry(0.74, 0.11, 12, 28));
  const reactorTorus = new THREE.Mesh(reactorTorusGeo, bronzeTrimMat);
  reactorTorus.rotation.x = Math.PI / 2;
  reactorRing.add(reactorTorus);

  const reactorBladeGeo = track(new THREE.BoxGeometry(0.14, 0.18, 0.34));
  for (let b = 0; b < 8; b++) {
    const a = (b / 8) * Math.PI * 2;
    const blade = new THREE.Mesh(reactorBladeGeo, armorObsidianMat);
    blade.position.set(Math.sin(a) * 0.74, 0, Math.cos(a) * 0.74);
    blade.rotation.y = a;
    reactorRing.add(blade);
  }

  const reactorCoreGeo = track(new THREE.SphereGeometry(0.52, 20, 16));
  const reactorCore = new THREE.Mesh(reactorCoreGeo, glowCrimsonMat);
  reactorCore.scale.set(1, 0.55, 1);
  reactorCore.position.set(0, CHASSIS_Y - 0.72, -0.05);
  bodyGroup.add(reactorCore);

  // =========================================================================
  // 4. MULTI-LAYERED SWEEPING WAR-PAULDRONS, EXHAUST STACKS & BRAIDED CABLES
  // =========================================================================
  const cowlShape = new THREE.Shape();
  cowlShape.moveTo(-2.05, 0.12);
  cowlShape.quadraticCurveTo(-1.35, 0.96, 0.2, 0.84);
  cowlShape.quadraticCurveTo(1.45, 0.75, 2.08, 0.22);
  cowlShape.lineTo(1.85, -0.68);
  cowlShape.quadraticCurveTo(1.02, -0.16, 0.16, -0.3);
  cowlShape.quadraticCurveTo(-0.92, -0.5, -1.82, -0.82);
  cowlShape.closePath();

  const cowlGeo = track(
    new THREE.ExtrudeGeometry(cowlShape, {
      depth: 0.64,
      bevelEnabled: true,
      bevelThickness: 0.14,
      bevelSize: 0.1,
      bevelSegments: 4,
    }),
  );
  cowlGeo.center();

  const reactiveTileGeo = track(new THREE.BoxGeometry(0.18, 0.42, 0.62));
  const stackPipeGeo = track(new THREE.CylinderGeometry(0.14, 0.18, 0.92, 16));
  const stackCapGeo = track(new THREE.CylinderGeometry(0.19, 0.16, 0.14, 16));

  for (const side of [-1, 1] as const) {
    const cowl = new THREE.Mesh(cowlGeo, armorHighlightMat);
    cowl.rotation.y = -Math.PI / 2;
    cowl.position.set(side * 1.62, CHASSIS_Y + 0.34, -0.08);
    cowl.rotation.z = side * -0.15;
    cowl.castShadow = true;
    cowl.receiveShadow = true;
    bodyGroup.add(cowl);

    // Overlapping reactive armor plates bolted onto outer pauldron
    for (let t = 0; t < 4; t++) {
      const tile = new THREE.Mesh(reactiveTileGeo, t === 1 ? crimsonArmorMat : armorDarkMat);
      tile.position.set(side * 1.98, CHASSIS_Y + 0.45 - Math.abs(t - 1.5) * 0.08, -1.05 + t * 0.7);
      tile.rotation.z = side * -0.18;
      tile.castShadow = true;
      bodyGroup.add(tile);
    }

    // Twin vertical armored exhaust stacks with glowing crimson tips
    for (let st = 0; st < 2; st++) {
      const pipe = new THREE.Mesh(stackPipeGeo, frameMat);
      pipe.position.set(side * 1.48, CHASSIS_Y + 1.05, -0.85 - st * 0.42);
      pipe.rotation.x = -0.24;
      pipe.rotation.z = side * -0.14;
      pipe.castShadow = true;
      bodyGroup.add(pipe);

      const cap = new THREE.Mesh(stackCapGeo, glowFurnaceMat);
      cap.position.set(side * 1.54, CHASSIS_Y + 1.48, -0.96 - st * 0.42);
      cap.rotation.x = -0.24;
      bodyGroup.add(cap);
    }

    // Dual braided curved hydraulic hoses looping from rear cowling down to rear leg joints
    const cableCurveA = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 1.48, CHASSIS_Y + 0.08, -1.72),
      new THREE.Vector3(side * 1.88, CHASSIS_Y - 0.56, -2.18),
      new THREE.Vector3(side * 1.72, CHASSIS_Y - 1.38, -1.82),
      new THREE.Vector3(side * 1.35, CHASSIS_Y - 1.65, -1.25),
    ]);
    const cableMeshA = new THREE.Mesh(
      track(new THREE.TubeGeometry(cableCurveA, 24, 0.1, 12, false)),
      frameMat,
    );
    cableMeshA.castShadow = true;
    bodyGroup.add(cableMeshA);

    const cableCurveB = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 1.28, CHASSIS_Y - 0.1, -1.68),
      new THREE.Vector3(side * 1.62, CHASSIS_Y - 0.78, -2.02),
      new THREE.Vector3(side * 1.48, CHASSIS_Y - 1.48, -1.58),
      new THREE.Vector3(side * 1.22, CHASSIS_Y - 1.58, -1.1),
    ]);
    const cableMeshB = new THREE.Mesh(
      track(new THREE.TubeGeometry(cableCurveB, 20, 0.065, 10, false)),
      bronzeTrimMat,
    );
    bodyGroup.add(cableMeshB);
  }

  // =========================================================================
  // 5. DUAL HEAVY REAR GIMBALED BOOSTER THRUSTERS
  // =========================================================================
  const thrusterHousingGeo = track(new THREE.CylinderGeometry(0.42, 0.54, 0.8, 20));
  const nozzleBellGeo = track(new THREE.CylinderGeometry(0.28, 0.46, 0.55, 20));
  const thrusterFlameGeo = track(new THREE.ConeGeometry(0.36, 2.4, 20, 1, true));
  thrusterFlameGeo.translate(0, -1.2, 0);
  const thrusterFlames: THREE.Mesh[] = [];

  for (const side of [-1, 1] as const) {
    const housing = new THREE.Mesh(thrusterHousingGeo, armorDarkMat);
    housing.rotation.x = Math.PI / 2;
    housing.position.set(side * 0.68, CHASSIS_Y + 0.18, -1.78);
    housing.castShadow = true;
    bodyGroup.add(housing);

    const bell = new THREE.Mesh(nozzleBellGeo, frameMat);
    bell.rotation.x = Math.PI / 2;
    bell.position.set(side * 0.68, CHASSIS_Y + 0.18, -2.28);
    bodyGroup.add(bell);

    const flame = new THREE.Mesh(thrusterFlameGeo, thrusterFlameMat);
    flame.rotation.x = Math.PI / 2;
    flame.position.set(side * 0.68, CHASSIS_Y + 0.18, -2.42);
    bodyGroup.add(flame);
    thrusterFlames.push(flame);
  }

  // =========================================================================
  // 6. FOUR CHUNKY ARMORED HEAVY WAR-MECH SPIDER LEGS (Radial X-Stance + IK!)
  // =========================================================================
  const legs: TitanLegRig[] = [];
  const COXA_OFFSET = 0.48;
  const FEMUR_LEN = 2.15;
  const TIBIA_LEN = 3.65;
  const FEMUR_BASE_Z = 0.51;
  const KNEE_BASE_Z = -1.77;
  const HOME_RADIAL = COXA_OFFSET + 3.0; // ~3.48 local units radially from hip

  // Heavy chunky mechanical geometries
  const coxaTurretGeo = track(new THREE.CylinderGeometry(0.64, 0.72, 0.92, 24));
  const coxaGearGeo = track(new THREE.TorusGeometry(0.68, 0.11, 12, 24));
  const hipSkirtGeo = track(new THREE.BoxGeometry(1.05, 0.64, 1.16));

  // Massive armored femur box + beveled outer side shields + rib collars + thick hydraulics
  const femurCoreGeo = track(new THREE.BoxGeometry(FEMUR_LEN, 0.64, 0.74));
  const femurArmorShellGeo = track(new THREE.BoxGeometry(1.88, 0.84, 1.02));
  const femurCapPlateGeo = track(new THREE.BoxGeometry(1.52, 0.24, 1.12));
  const femurRibGeo = track(new THREE.BoxGeometry(0.24, 0.94, 1.08));
  const femurVeinGeo = track(new THREE.BoxGeometry(1.5, 0.14, 1.08));
  const pistonOuterGeo = track(new THREE.CylinderGeometry(0.16, 0.16, 1.25, 16));
  const pistonInnerGeo = track(new THREE.CylinderGeometry(0.1, 0.1, 1.65, 16));

  // Massive knee joint block with heavy calipers & armored knee cowl
  const kneeDrumGeo = track(new THREE.CylinderGeometry(0.62, 0.62, 1.08, 24));
  const kneeCapGeo = track(new THREE.CylinderGeometry(0.38, 0.38, 1.2, 20));
  const kneeShieldGeo = track(new THREE.BoxGeometry(1.05, 0.92, 1.18));
  const kneeSpikeGeo = track(new THREE.ConeGeometry(0.34, 0.95, 6));

  // Chunky armored siege-tibia (thick tapered armor housing, NOT thin sticks!)
  const tibiaCoreGeo = track(new THREE.BoxGeometry(TIBIA_LEN, 0.52, 0.64));
  const tibiaUpperArmorGeo = track(new THREE.BoxGeometry(1.85, 0.86, 0.96));
  const tibiaLowerArmorGeo = track(new THREE.BoxGeometry(1.65, 0.72, 0.82));
  const tibiaSidePlateGeo = track(new THREE.BoxGeometry(2.65, 0.56, 0.18));
  const tibiaPistonOuterGeo = track(new THREE.CylinderGeometry(0.15, 0.15, 1.85, 16));
  const tibiaPistonInnerGeo = track(new THREE.CylinderGeometry(0.095, 0.095, 2.85, 14));
  const ankleDrumGeo = track(new THREE.CylinderGeometry(0.42, 0.42, 0.86, 20));

  // Wide heavy armored mechanical spider foot
  const footToeShape = new THREE.Shape();
  footToeShape.moveTo(-0.42, 0);
  footToeShape.lineTo(1.58, 0.02);
  footToeShape.lineTo(1.34, 0.38);
  footToeShape.lineTo(0.36, 0.62);
  footToeShape.lineTo(-0.46, 0.52);
  footToeShape.closePath();
  const footToeGeo = track(
    new THREE.ExtrudeGeometry(footToeShape, {
      depth: 0.78,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 3,
    }),
  );
  footToeGeo.center();

  const sideTalonGeo = track(new THREE.BoxGeometry(1.12, 0.34, 0.36));
  const heelClawGeo = track(new THREE.BoxGeometry(0.95, 0.38, 0.74));
  const footPadGlowGeo = track(new THREE.BoxGeometry(0.54, 0.12, 0.52));

  const legSpecs: Array<{
    side: -1 | 1;
    front: -1 | 1;
    x: number;
    z: number;
    baseYaw: number;
    phaseOffset: number;
  }> = [
    // Front-Right (+X, +Z)
    { side: 1, front: 1, x: 1.42, z: 1.1, baseYaw: -Math.PI * 0.26, phaseOffset: 0 },
    // Rear-Left (-X, -Z)
    { side: -1, front: -1, x: -1.42, z: -1.1, baseYaw: Math.PI * 0.74, phaseOffset: 0.35 },
    // Front-Left (-X, +Z)
    { side: -1, front: 1, x: -1.42, z: 1.1, baseYaw: -Math.PI * 0.74, phaseOffset: Math.PI },
    // Rear-Right (+X, -Z)
    { side: 1, front: -1, x: 1.42, z: -1.1, baseYaw: Math.PI * 0.26, phaseOffset: Math.PI + 0.35 },
  ];

  for (const spec of legSpecs) {
    const hipY = CHASSIS_Y - 0.14;
    // 1. Heavy Vertical Coxa Yaw Turret
    const coxaYawPivot = new THREE.Group();
    coxaYawPivot.position.set(spec.x, hipY, spec.z);
    coxaYawPivot.rotation.y = spec.baseYaw;
    bodyGroup.add(coxaYawPivot);

    const coxaDrum = new THREE.Mesh(coxaTurretGeo, frameMat);
    coxaDrum.castShadow = true;
    coxaYawPivot.add(coxaDrum);

    const coxaGear = new THREE.Mesh(coxaGearGeo, bronzeTrimMat);
    coxaGear.rotation.x = Math.PI / 2;
    coxaGear.position.y = -0.28;
    coxaYawPivot.add(coxaGear);

    const hipSkirt = new THREE.Mesh(hipSkirtGeo, armorHighlightMat);
    hipSkirt.position.set(0.36, 0.26, 0);
    hipSkirt.rotation.z = -0.22;
    hipSkirt.castShadow = true;
    coxaYawPivot.add(hipSkirt);

    // 2. Massive Chunky Armored Femur
    const femurPivot = new THREE.Group();
    femurPivot.position.set(COXA_OFFSET, 0, 0);
    femurPivot.rotation.z = FEMUR_BASE_Z;
    coxaYawPivot.add(femurPivot);

    const femurCore = new THREE.Mesh(femurCoreGeo, frameMat);
    femurCore.position.set(FEMUR_LEN * 0.5, 0, 0);
    femurCore.castShadow = true;
    femurPivot.add(femurCore);

    const femurArmor = new THREE.Mesh(femurArmorShellGeo, armorDarkMat);
    femurArmor.position.set(FEMUR_LEN * 0.5, 0.14, 0);
    femurArmor.castShadow = true;
    femurArmor.receiveShadow = true;
    femurPivot.add(femurArmor);

    const femurCap = new THREE.Mesh(femurCapPlateGeo, armorHighlightMat);
    femurCap.position.set(FEMUR_LEN * 0.48, 0.54, 0);
    femurCap.castShadow = true;
    femurPivot.add(femurCap);

    // Heavy bolted rib collars wrapping the femur
    for (const rx of [0.55, 1.55]) {
      const rib = new THREE.Mesh(femurRibGeo, armorObsidianMat);
      rib.position.set(rx, 0.14, 0);
      femurPivot.add(rib);
    }

    // Glowing crimson hydraulic conduit recessed on femur sides
    const femurVein = new THREE.Mesh(femurVeinGeo, glowCrimsonMat);
    femurVein.position.set(FEMUR_LEN * 0.5, 0.08, 0);
    femurPivot.add(femurVein);

    // Dual thick chrome hydraulic lift rams underneath femur
    for (const pz of [-0.36, 0.36]) {
      const pOuter = new THREE.Mesh(pistonOuterGeo, armorObsidianMat);
      pOuter.rotation.z = Math.PI / 2;
      pOuter.position.set(0.72, -0.38, pz);
      femurPivot.add(pOuter);

      const pInner = new THREE.Mesh(pistonInnerGeo, chromeMat);
      pInner.rotation.z = Math.PI / 2;
      pInner.position.set(1.24, -0.38, pz);
      femurPivot.add(pInner);
    }

    // 3. Colossal Armored Knee Joint & Chunky Siege-Tibia
    const kneePivot = new THREE.Group();
    kneePivot.position.set(FEMUR_LEN, 0, 0);
    kneePivot.rotation.z = KNEE_BASE_Z;
    femurPivot.add(kneePivot);

    const kneeDrum = new THREE.Mesh(kneeDrumGeo, frameMat);
    kneeDrum.rotation.x = Math.PI / 2;
    kneeDrum.castShadow = true;
    kneePivot.add(kneeDrum);

    const kneeCap = new THREE.Mesh(kneeCapGeo, bronzeTrimMat);
    kneeCap.rotation.x = Math.PI / 2;
    kneePivot.add(kneeCap);

    const kneeShield = new THREE.Mesh(kneeShieldGeo, armorHighlightMat);
    kneeShield.position.set(-0.18, 0.24, 0);
    kneeShield.rotation.z = -0.35;
    kneeShield.castShadow = true;
    kneePivot.add(kneeShield);

    const kneeSpike = new THREE.Mesh(kneeSpikeGeo, crimsonArmorMat);
    kneeSpike.rotation.z = -0.58;
    kneeSpike.position.set(-0.55, 0.68, 0);
    kneeSpike.castShadow = true;
    kneePivot.add(kneeSpike);

    // Thick inner tibia frame + upper & lower heavy armor greaves
    const tibiaCore = new THREE.Mesh(tibiaCoreGeo, frameMat);
    tibiaCore.position.set(TIBIA_LEN * 0.5, 0, 0);
    tibiaCore.castShadow = true;
    kneePivot.add(tibiaCore);

    const tibiaUpper = new THREE.Mesh(tibiaUpperArmorGeo, armorDarkMat);
    tibiaUpper.position.set(1.12, 0.14, 0);
    tibiaUpper.castShadow = true;
    tibiaUpper.receiveShadow = true;
    kneePivot.add(tibiaUpper);

    const tibiaLower = new THREE.Mesh(tibiaLowerArmorGeo, armorHighlightMat);
    tibiaLower.position.set(2.58, 0.1, 0);
    tibiaLower.castShadow = true;
    tibiaLower.receiveShadow = true;
    kneePivot.add(tibiaLower);

    // Heavy side armor plates flanking the tibia
    for (const sz of [-0.46, 0.46]) {
      const sidePlate = new THREE.Mesh(tibiaSidePlateGeo, armorObsidianMat);
      sidePlate.position.set(1.78, 0.1, sz);
      sidePlate.castShadow = true;
      kneePivot.add(sidePlate);
    }

    // Thick rear tibia hydraulic shock-absorber rams
    for (const sz of [-0.32, 0.32]) {
      const pOut = new THREE.Mesh(tibiaPistonOuterGeo, armorObsidianMat);
      pOut.rotation.z = Math.PI / 2;
      pOut.position.set(1.15, -0.36, sz);
      kneePivot.add(pOut);

      const pIn = new THREE.Mesh(tibiaPistonInnerGeo, chromeMat);
      pIn.rotation.z = Math.PI / 2;
      pIn.position.set(1.88, -0.36, sz);
      kneePivot.add(pIn);
    }

    // 4. Heavy Auto-Leveling Ankle & Wide 3-Clawed Siege Spider Foot
    const anklePivot = new THREE.Group();
    anklePivot.position.set(TIBIA_LEN, 0, 0);
    anklePivot.rotation.z = -(FEMUR_BASE_Z + KNEE_BASE_Z);
    kneePivot.add(anklePivot);

    const ankleDrum = new THREE.Mesh(ankleDrumGeo, frameMat);
    ankleDrum.rotation.x = Math.PI / 2;
    anklePivot.add(ankleDrum);

    const footToe = new THREE.Mesh(footToeGeo, armorDarkMat);
    footToe.position.set(0.56, -0.1, 0);
    footToe.castShadow = true;
    footToe.receiveShadow = true;
    anklePivot.add(footToe);

    for (const ts of [-1, 1] as const) {
      const talon = new THREE.Mesh(sideTalonGeo, armorHighlightMat);
      talon.position.set(0.38, -0.14, ts * 0.56);
      talon.rotation.y = ts * -0.36;
      talon.castShadow = true;
      anklePivot.add(talon);
    }

    const heelClaw = new THREE.Mesh(heelClawGeo, armorObsidianMat);
    heelClaw.position.set(-0.48, -0.12, 0);
    heelClaw.castShadow = true;
    anklePivot.add(heelClaw);

    const footGlow = new THREE.Mesh(footPadGlowGeo, glowCrimsonMat);
    footGlow.position.set(0.3, 0.14, 0);
    anklePivot.add(footGlow);

    // Ideal rest foot position in bodyGroup local space (for world-space IK foot locking!)
    const homeLocalX = spec.x + Math.cos(spec.baseYaw) * HOME_RADIAL;
    const homeLocalZ = spec.z - Math.sin(spec.baseYaw) * HOME_RADIAL;

    legs.push({
      side: spec.side,
      front: spec.front,
      hipX: spec.x,
      hipY,
      hipZ: spec.z,
      homeLocalX,
      homeLocalZ,
      baseYaw: spec.baseYaw,
      femurBaseZ: FEMUR_BASE_Z,
      kneeBaseZ: KNEE_BASE_Z,
      phaseOffset: spec.phaseOffset,
      coxaYawPivot,
      femurPivot,
      kneePivot,
      anklePivot,
      ikInitialized: false,
      footX: 0,
      footY: 0,
      footZ: 0,
      isStepping: false,
      stepProgress: 0,
      stepFromX: 0,
      stepFromY: 0,
      stepFromZ: 0,
      stepToX: 0,
      stepToY: 0,
      stepToZ: 0,
    });
  }

  // =========================================================================
  // 7. DORSAL CONQUEROR SIEGE TURRET & TWO COLOSSAL SPLIT-RAIL CANNONS
  // =========================================================================
  const turretGroup = new THREE.Group();
  turretGroup.position.set(0, CHASSIS_Y + 0.98, -0.08);
  root.add(turretGroup);

  // Heavy toothed turret rotation collar
  const turretRingGeo = track(new THREE.CylinderGeometry(1.18, 1.32, 0.36, 32));
  const turretRing = new THREE.Mesh(turretRingGeo, frameMat);
  turretRing.castShadow = true;
  turretGroup.add(turretRing);

  const gearToothGeo = track(new THREE.BoxGeometry(0.12, 0.16, 0.2));
  for (let g = 0; g < 24; g++) {
    const a = (g / 24) * Math.PI * 2;
    const tooth = new THREE.Mesh(gearToothGeo, bronzeTrimMat);
    tooth.position.set(Math.sin(a) * 1.28, -0.04, Math.cos(a) * 1.28);
    tooth.rotation.y = a;
    turretGroup.add(tooth);
  }

  // Pitch cradle
  const turretPitchGroup = new THREE.Group();
  turretPitchGroup.position.set(0, 0.62, 0);
  turretGroup.add(turretPitchGroup);

  // Sloped octagonal armored turret bunker
  const bunkerGeo = track(new THREE.CylinderGeometry(1.12, 1.34, 0.66, 8));
  const bunkerMesh = new THREE.Mesh(bunkerGeo, armorDarkMat);
  bunkerMesh.rotation.y = Math.PI / 8;
  bunkerMesh.position.set(0, 0.04, -0.22);
  bunkerMesh.castShadow = true;
  turretPitchGroup.add(bunkerMesh);

  // Dorsal armored crest with crimson conqueror stripe
  const crestGeo = track(new THREE.BoxGeometry(0.84, 0.32, 2.35));
  const crestMesh = new THREE.Mesh(crestGeo, crimsonArmorMat);
  crestMesh.position.set(0, 0.44, -0.18);
  crestMesh.castShadow = true;
  turretPitchGroup.add(crestMesh);

  // Rotating sci-fi radar / orbital-link targeting array on top of turret
  const radarDish = new THREE.Group();
  radarDish.position.set(0, 0.72, -0.88);
  turretPitchGroup.add(radarDish);

  const radarMast = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.14, 0.45, 12)), frameMat);
  radarDish.add(radarMast);
  const radarBar = new THREE.Mesh(track(new THREE.BoxGeometry(1.15, 0.16, 0.18)), armorHighlightMat);
  radarBar.position.y = 0.28;
  radarDish.add(radarBar);
  const radarEmitter = new THREE.Mesh(track(new THREE.SphereGeometry(0.11, 12, 10)), glowCrimsonMat);
  radarEmitter.position.set(0, 0.28, 0.12);
  radarDish.add(radarEmitter);

  // Rear counterweight + cooling radiator block
  const rearBlockGeo = track(new THREE.BoxGeometry(1.88, 0.52, 0.96));
  const rearBlock = new THREE.Mesh(rearBlockGeo, armorObsidianMat);
  rearBlock.position.set(0, 0.08, -1.62);
  rearBlock.castShadow = true;
  turretPitchGroup.add(rearBlock);

  // Side armored ammo drums feeding each cannon
  const ammoDrumGeo = track(new THREE.CylinderGeometry(0.38, 0.38, 0.46, 20));
  for (const side of [-1, 1] as const) {
    const drum = new THREE.Mesh(ammoDrumGeo, armorHighlightMat);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(side * 1.28, 0.06, -0.78);
    drum.castShadow = true;
    turretPitchGroup.add(drum);
  }

  // TWO COLOSSAL PARALLEL ELECTROMAGNETIC SPLIT-RAIL SIEGE CANNONS
  const breechShroudGeo = track(new THREE.BoxGeometry(0.72, 0.64, 2.35));
  const recoilCoilGeo = track(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 20));
  const recoilPistonGeo = track(new THREE.CylinderGeometry(0.065, 0.065, 1.95, 14));
  const splitRailGeo = track(new THREE.BoxGeometry(0.26, 0.16, 4.15));
  const plasmaChannelGeo = track(new THREE.BoxGeometry(0.14, 0.14, 3.85));
  const accelCoilGeo = track(new THREE.BoxGeometry(0.52, 0.5, 0.14));
  const outerJacketGeo = track(new THREE.BoxGeometry(0.56, 0.48, 2.15));
  const muzzleBrakeGeo = track(new THREE.BoxGeometry(0.54, 0.56, 0.68));
  const bayonetFinGeo = track(new THREE.BoxGeometry(0.1, 0.36, 1.15));
  const sightFinGeo = track(new THREE.BoxGeometry(0.08, 0.34, 0.28));
  const muzzleFlashGeo = track(new THREE.SphereGeometry(0.85, 16, 12));

  const buildCannon = (side: -1 | 1): { group: THREE.Group; flash: THREE.Mesh } => {
    const cGroup = new THREE.Group();
    cGroup.position.set(side * 0.82, 0.2, 0.25);

    // 7-ring ribbed recoil-coil sleeve behind breech
    for (let r = 0; r < 7; r++) {
      const coil = new THREE.Mesh(recoilCoilGeo, r % 2 === 0 ? frameMat : bronzeTrimMat);
      coil.rotation.x = Math.PI / 2;
      coil.position.set(0, 0, -1.18 - r * 0.14);
      cGroup.add(coil);
    }

    // Flanking exposed chrome recoil-dampening hydraulic pistons
    for (const px of [-0.36, 0.36]) {
      const rp = new THREE.Mesh(recoilPistonGeo, chromeMat);
      rp.rotation.x = Math.PI / 2;
      rp.position.set(px, -0.14, 0.45);
      cGroup.add(rp);
    }

    // Heavy armored breech casing
    const breech = new THREE.Mesh(breechShroudGeo, armorDarkMat);
    breech.position.set(0, 0.06, 0.15);
    breech.castShadow = true;
    breech.receiveShadow = true;
    cGroup.add(breech);

    // Mid-barrel heavy jacket
    const jacket = new THREE.Mesh(outerJacketGeo, armorHighlightMat);
    jacket.position.set(0, 0, 1.9);
    jacket.castShadow = true;
    cGroup.add(jacket);

    // SPLIT UPPER & LOWER HEAVY RAIL-GUN BARRELS
    const upperRail = new THREE.Mesh(splitRailGeo, armorObsidianMat);
    upperRail.position.set(0, 0.18, 3.25);
    upperRail.castShadow = true;
    cGroup.add(upperRail);

    const lowerRail = new THREE.Mesh(splitRailGeo, armorObsidianMat);
    lowerRail.position.set(0, -0.18, 3.25);
    lowerRail.castShadow = true;
    cGroup.add(lowerRail);

    // Glowing crimson electromagnetic plasma accelerator channel between the split rails
    const plasmaChannel = new THREE.Mesh(plasmaChannelGeo, glowCrimsonMat);
    plasmaChannel.position.set(0, 0, 3.15);
    cGroup.add(plasmaChannel);

    // 5 heavy electromagnetic accelerator ribs spaced along the barrel
    for (let c = 0; c < 5; c++) {
      const ac = new THREE.Mesh(accelCoilGeo, c % 2 === 0 ? frameMat : armorHighlightMat);
      ac.position.set(0, 0, 2.25 + c * 0.65);
      ac.castShadow = true;
      cGroup.add(ac);
    }

    // Heavy slotted siege muzzle brake + lower bayonet stabilizer fin + upper laser sight
    const brake = new THREE.Mesh(muzzleBrakeGeo, frameMat);
    brake.position.set(0, 0, 5.25);
    brake.castShadow = true;
    cGroup.add(brake);

    const bayonet = new THREE.Mesh(bayonetFinGeo, armorHighlightMat);
    bayonet.position.set(0, -0.34, 4.95);
    cGroup.add(bayonet);

    const sight = new THREE.Mesh(sightFinGeo, crimsonArmorMat);
    sight.position.set(0, 0.36, 5.05);
    cGroup.add(sight);

    const flash = new THREE.Mesh(muzzleFlashGeo, muzzleFlashMat);
    flash.position.set(0, 0, 5.85);
    flash.scale.set(0.95, 0.95, 2.4);
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
    thrusterFlames,
    scannerEye,
    reactorRing,
    radarDish,
    legs,
    disposables,
  };
}

// ---------------------------------------------------------------------------
// Helical Plasma Coil Geometry Helper (for Orbital, M1, and Death Beam VFX)
// ---------------------------------------------------------------------------

function createHelixTubeGeometry(
  length: number,
  radius: number,
  turns: number,
  tubeRadius: number,
  axis: 'y' | 'z',
  phaseOffset = 0,
  tubularSegments = 56,
  radialSegments = 6,
): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = [];
  const steps = Math.max(24, tubularSegments);
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const angle = f * Math.PI * 2 * turns + phaseOffset;
    const c = Math.cos(angle) * radius;
    const s = Math.sin(angle) * radius;
    if (axis === 'y') {
      pts.push(new THREE.Vector3(c, f * length, s));
    } else {
      pts.push(new THREE.Vector3(c, s, f * length));
    }
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, tubularSegments, tubeRadius, radialSegments, false);
}

// ---------------------------------------------------------------------------
// Orbital Exterminatus Battle-Satellite + Helical Laser Beam VFX Rig (Skill 1)
// ---------------------------------------------------------------------------

interface OrbitalStrikeVisual {
  group: THREE.Group;
  satellite: THREE.Group;
  leftWingGroup: THREE.Group;
  rightWingGroup: THREE.Group;
  innerGyroRing: THREE.Group;
  outerGyroRing: THREE.Group;
  emitterProngs: THREE.Group[];
  emitterLens: THREE.Mesh;
  beaconOrb: THREE.Mesh;
  targetIcon: THREE.Mesh;
  lockLines: THREE.Mesh;
  lockLasers: THREE.Mesh[];
  beamGroup: THREE.Group;
  beamCore: THREE.Mesh;
  beamMid: THREE.Mesh;
  beamOuter: THREE.Mesh;
  beamHelixA: THREE.Mesh;
  beamHelixB: THREE.Mesh;
  impactFlare: THREE.Mesh;
  impactPillar: THREE.Mesh;
  impactDisc: THREE.Mesh;
  pulseRings: THREE.Mesh[];
}

function buildOrbitalStrikeVisual(
  solarTex: THREE.CanvasTexture,
  redTargetTex: THREE.CanvasTexture,
): OrbitalStrikeVisual {
  const group = new THREE.Group();

  // 1. Ground Red Target Icon (prominent, high-contrast, animated)
  const targetGeo = new THREE.PlaneGeometry(12.2, 12.2);
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

  // Translucent crimson lock-on targeting cone
  const lockGeo = new THREE.CylinderGeometry(0.22, 4.8, 26, 20, 1, true);
  lockGeo.translate(0, 13, 0);
  const lockMat = new THREE.MeshBasicMaterial({
    color: 0xff1e2d,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const lockLines = new THREE.Mesh(lockGeo, lockMat);
  group.add(lockLines);

  // 4 razor-sharp converging targeting laser sightlines during lock-on
  const lockLasers: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const lGeo = new THREE.CylinderGeometry(0.08, 0.08, 26.5, 6, 1, true);
    lGeo.translate(0, -13.25, 0);
    const lMesh = new THREE.Mesh(
      lGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff3040,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    lMesh.position.y = 26;
    group.add(lMesh);
    lockLasers.push(lMesh);
  }

  // 2. Detailed Sci-Fi Exterminatus Battle-Satellite hovering high in orbit
  const satellite = new THREE.Group();
  satellite.position.y = 26;
  group.add(satellite);

  const satArmorMat = new THREE.MeshStandardMaterial({
    color: 0x5c6b60,
    metalness: 0.78,
    roughness: 0.28,
  });
  const satDarkMat = new THREE.MeshStandardMaterial({
    color: 0x2c3430,
    metalness: 0.86,
    roughness: 0.26,
  });
  const satGoldMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    metalness: 0.88,
    roughness: 0.22,
  });
  const satSteelMat = new THREE.MeshStandardMaterial({
    color: 0x9aa8a0,
    metalness: 0.8,
    roughness: 0.25,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    map: solarTex,
    metalness: 0.48,
    roughness: 0.26,
    emissive: 0x0b3a6e,
    emissiveIntensity: 0.55,
  });
  const crimsonGlowMat = new THREE.MeshBasicMaterial({
    color: 0xff2233,
  });
  const coreHotMat = new THREE.MeshBasicMaterial({
    color: 0xfff0dd,
  });

  // Multi-tiered hexagonal armored core hull
  const upperHull = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.55, 1.25, 6), satArmorMat);
  upperHull.position.y = 0.85;
  satellite.add(upperHull);

  const midReactor = new THREE.Mesh(new THREE.CylinderGeometry(1.68, 1.68, 1.05, 6), satDarkMat);
  midReactor.position.y = -0.15;
  satellite.add(midReactor);

  const lowerHull = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.05, 1.0, 6), satArmorMat);
  lowerHull.position.y = -1.05;
  satellite.add(lowerHull);

  // Gold thermal foil shielding collar + 6 glowing crimson reactor vents around equator
  const foilCollar = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.42, 0.36, 12), satGoldMat);
  foilCollar.position.y = 0.42;
  satellite.add(foilCollar);

  for (let v = 0; v < 6; v++) {
    const a = (v / 6) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.35, 0.45), satDarkMat);
    rib.position.set(Math.cos(a) * 1.62, -0.05, Math.sin(a) * 1.62);
    rib.rotation.y = -a;
    satellite.add(rib);

    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.34), crimsonGlowMat);
    vent.position.set(Math.cos(a + Math.PI / 6) * 1.58, -0.15, Math.sin(a + Math.PI / 6) * 1.58);
    vent.rotation.y = -(a + Math.PI / 6);
    satellite.add(vent);
  }

  // Tall upper command comms & targeting antenna spire
  const spireBase = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 0.7, 6), satDarkMat);
  spireBase.position.y = 1.78;
  satellite.add(spireBase);

  const spireMast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.28, 2.2, 8), satSteelMat);
  spireMast.position.y = 3.1;
  satellite.add(spireMast);

  const radarBar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.14, 0.22), satSteelMat);
  radarBar.position.y = 2.85;
  satellite.add(radarBar);

  const radarDish = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.18, 0.28, 12), satGoldMat);
  radarDish.rotation.x = Math.PI / 3;
  radarDish.position.set(0, 2.55, 0.72);
  satellite.add(radarDish);

  const beaconOrb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), crimsonGlowMat.clone());
  beaconOrb.position.y = 4.35;
  satellite.add(beaconOrb);

  // Underside focusing emitter housing & blinding core lens
  const emitterDish = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 0.85, 0.75, 12), satDarkMat);
  emitterDish.position.y = -1.75;
  satellite.add(emitterDish);

  const emitterLens = new THREE.Mesh(new THREE.SphereGeometry(0.82, 16, 12), coreHotMat.clone());
  emitterLens.position.y = -2.05;
  satellite.add(emitterLens);

  // 4 articulated armored focusing claws/prongs around the laser aperture
  const emitterProngs: THREE.Group[] = [];
  for (let p = 0; p < 4; p++) {
    const a = (p / 4) * Math.PI * 2 + Math.PI / 4;
    const prongPivot = new THREE.Group();
    prongPivot.position.set(Math.cos(a) * 1.18, -1.65, Math.sin(a) * 1.18);
    prongPivot.rotation.y = -a + Math.PI / 2;

    const clawUpper = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.35, 0.42), satDarkMat);
    clawUpper.position.set(0, -0.62, 0.12);
    clawUpper.rotation.x = 0.22;
    prongPivot.add(clawUpper);

    const clawTip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.95, 0.28), satSteelMat);
    clawTip.position.set(0, -1.48, -0.02);
    clawTip.rotation.x = -0.35;
    prongPivot.add(clawTip);

    const innerRail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 0.1), crimsonGlowMat);
    innerRail.position.set(0, -0.95, -0.14);
    prongPivot.add(innerRail);

    satellite.add(prongPivot);
    emitterProngs.push(prongPivot);
  }

  // Dual counter-rotating concentric gyro-accelerator rings
  const innerGyroRing = new THREE.Group();
  innerGyroRing.position.y = -0.7;
  const innerTorus = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.14, 10, 32), satGoldMat);
  innerTorus.rotation.x = Math.PI / 2;
  innerGyroRing.add(innerTorus);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.24), satSteelMat);
    fin.position.set(Math.cos(a) * 2.25, 0, Math.sin(a) * 2.25);
    fin.rotation.y = -a;
    innerGyroRing.add(fin);
  }
  satellite.add(innerGyroRing);

  const outerGyroRing = new THREE.Group();
  outerGyroRing.position.y = -1.15;
  const outerTorus = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.18, 12, 36), satDarkMat);
  outerTorus.rotation.x = Math.PI / 2;
  outerGyroRing.add(outerTorus);
  for (let n = 0; n < 8; n++) {
    const a = (n / 8) * Math.PI * 2;
    const nodeHousing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.42), satArmorMat);
    nodeHousing.position.set(Math.cos(a) * 3.25, 0, Math.sin(a) * 3.25);
    nodeHousing.rotation.y = -a;
    outerGyroRing.add(nodeHousing);

    const plasmaNode = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), crimsonGlowMat);
    plasmaNode.position.set(Math.cos(a) * 3.25, -0.22, Math.sin(a) * 3.25);
    outerGyroRing.add(plasmaNode);
  }
  satellite.add(outerGyroRing);

  // Articulated Dual-Tier Solar Wing Arrays (Left & Right)
  const buildWingArray = (side: -1 | 1): THREE.Group => {
    const wg = new THREE.Group();
    wg.position.set(side * 1.65, 0.2, 0);

    // Heavy truss boom spine
    const boom = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.22, 0.32), satDarkMat);
    boom.position.x = side * 3.4;
    wg.add(boom);

    const goldBus = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.08, 0.14), satGoldMat);
    goldBus.position.set(side * 3.4, 0.14, 0);
    wg.add(goldBus);

    // Dual photovoltaic panels (front & rear bays) with armored border frames
    for (const zOff of [-1.25, 1.25]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.09, 1.85), wingMat);
      panel.position.set(side * 3.55, 0.02, zOff);
      wg.add(panel);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.13, 0.16), satSteelMat);
      frame.position.set(side * 3.55, 0.02, zOff + Math.sign(zOff) * 0.94);
      wg.add(frame);
    }

    // Wingtip stabilizer pylon + glowing red navigation strobe
    const tipPylon = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.55, 4.4), satArmorMat);
    tipPylon.position.set(side * 6.75, 0.05, 0);
    wg.add(tipPylon);

    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), crimsonGlowMat);
    strobe.position.set(side * 6.95, 0.32, 0);
    wg.add(strobe);

    return wg;
  };

  const leftWingGroup = buildWingArray(-1);
  const rightWingGroup = buildWingArray(1);
  satellite.add(leftWingGroup);
  satellite.add(rightWingGroup);

  // 3. Towering Ultra-Lasery Orbital Beam (Triple-Layer + Double Plasma Helix)
  const beamGroup = new THREE.Group();
  beamGroup.visible = false;
  group.add(beamGroup);

  const beamCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 1.05, 26, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  beamCore.position.y = 13;
  beamGroup.add(beamCore);

  const beamMid = new THREE.Mesh(
    new THREE.CylinderGeometry(1.75, 2.05, 26, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff1e56,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  beamMid.position.y = 13;
  beamGroup.add(beamMid);

  const beamOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(2.95, 3.55, 26, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xb91c1c,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  beamOuter.position.y = 13;
  beamGroup.add(beamOuter);

  // Double-helix twisting plasma energy spirals around the orbital laser
  const beamHelixA = new THREE.Mesh(
    createHelixTubeGeometry(26, 2.35, 3.5, 0.24, 'y', 0, 64, 6),
    new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  beamGroup.add(beamHelixA);

  const beamHelixB = new THREE.Mesh(
    createHelixTubeGeometry(26, 2.65, 3.5, 0.2, 'y', Math.PI, 64, 6),
    new THREE.MeshBasicMaterial({
      color: 0xff2255,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  beamGroup.add(beamHelixB);

  // Blazing molten ground impact core, vertical eruption pillar & scorch ring
  const impactFlare = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 22, 16),
    new THREE.MeshBasicMaterial({
      color: 0xff6b2b,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  impactFlare.scale.set(1.3, 0.5, 1.3);
  impactFlare.position.y = 0.55;
  beamGroup.add(impactFlare);

  const impactPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 1.2, 7.5, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff3b1f,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  impactPillar.position.y = 3.75;
  beamGroup.add(impactPillar);

  const impactDiscGeo = new THREE.RingGeometry(2.2, 6.4, 36);
  impactDiscGeo.rotateX(-Math.PI / 2);
  const impactDisc = new THREE.Mesh(
    impactDiscGeo,
    new THREE.MeshBasicMaterial({
      color: 0xff451a,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  impactDisc.position.y = 0.26;
  beamGroup.add(impactDisc);

  // 6 high-speed descending laser shock-rings
  const pulseRings: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.8, 0.2, 10, 32),
      new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xffcc55 : 0xff2a44,
        transparent: true,
        opacity: 0.9,
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
    leftWingGroup,
    rightWingGroup,
    innerGyroRing,
    outerGyroRing,
    emitterProngs,
    emitterLens,
    beaconOrb,
    targetIcon,
    lockLines,
    lockLasers,
    beamGroup,
    beamCore,
    beamMid,
    beamOuter,
    beamHelixA,
    beamHelixB,
    impactFlare,
    impactPillar,
    impactDisc,
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
  private m1HelixGeo: THREE.TubeGeometry;
  private m1MuzzleRingGeo: THREE.TorusGeometry;

  private cursorReticle: THREE.Mesh;
  private leapPreviewRing: THREE.Mesh;

  // Sky beam for Summon & Exit Extraction
  private skyBeamGroup: THREE.Group;
  private skyBeamCore: THREE.Mesh;
  private skyBeamOuter: THREE.Mesh;
  private skyBeamRing: THREE.Mesh;

  private slashMeshes = new Map<
    string,
    {
      group: THREE.Group;
      core: THREE.Mesh;
      mid: THREE.Mesh;
      outer: THREE.Mesh;
      helix: THREE.Mesh;
      muzzleRing: THREE.Mesh;
      impactCore: THREE.Mesh;
      impactDome: THREE.Mesh;
      impactRing: THREE.Mesh;
    }
  >();
  private shockwaveMeshes = new Map<string, { group: THREE.Group; torus: THREE.Mesh; ring: THREE.Mesh }>();
  private orbitalVisuals = new Map<string, OrbitalStrikeVisual>();
  private mushroomMeshes = new Map<string, THREE.Group>();
  private missileMeshes = new Map<string, THREE.Group>();

  // Skill 3: Combined Cannon Death Beam VFX
  private deathBeamGroup: THREE.Group;
  private dbChargeOrb: THREE.Mesh;
  private dbChargeRings: THREE.Mesh[] = [];
  private dbChargeArcs: THREE.Mesh[] = [];
  private dbRangeLaser: THREE.Mesh;
  private dbBeamCore: THREE.Mesh;
  private dbBeamMid: THREE.Mesh;
  private dbBeamOuter: THREE.Mesh;
  private dbHelixA: THREE.Mesh;
  private dbHelixB: THREE.Mesh;
  private dbEndSphere: THREE.Mesh;
  private dbEndVortex: THREE.Mesh;
  private dbEndPillar: THREE.Mesh;
  private dbPulseRings: THREE.Mesh[] = [];

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
    this.m1HelixGeo = createHelixTubeGeometry(1.0, 0.48, 2.75, 0.085, 'z', 0, 44, 5);
    this.m1MuzzleRingGeo = new THREE.TorusGeometry(0.72, 0.11, 8, 24);

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

    // Skill 3: Combined Cannon Death Beam VFX group (oriented via lookAt along +Z)
    this.deathBeamGroup = new THREE.Group();
    this.deathBeamGroup.visible = false;
    this.group.add(this.deathBeamGroup);

    this.dbChargeOrb = new THREE.Mesh(
      new THREE.SphereGeometry(1.65, 22, 16),
      new THREE.MeshBasicMaterial({
        color: 0xfff8e6,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.deathBeamGroup.add(this.dbChargeOrb);

    for (let i = 0; i < 3; i++) {
      const rMesh = new THREE.Mesh(
        new THREE.TorusGeometry(2.3 + i * 0.85, 0.15, 10, 36),
        new THREE.MeshBasicMaterial({
          color: i === 0 ? 0xffffff : i === 1 ? 0xff2255 : 0xffaa22,
          transparent: true,
          opacity: 0.88,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      this.deathBeamGroup.add(rMesh);
      this.dbChargeRings.push(rMesh);
    }

    // 4 crackling converging energy filaments during cannon fusion
    for (let i = 0; i < 4; i++) {
      const arcGeo = new THREE.CylinderGeometry(0.05, 0.18, 4.4, 6, 1, true);
      arcGeo.translate(0, 2.2, 0);
      const arc = new THREE.Mesh(
        arcGeo,
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xff3355 : 0xffcc44,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      this.deathBeamGroup.add(arc);
      this.dbChargeArcs.push(arc);
    }

    // Pulsing crimson rangefinder lock-on sightline laser during combining phase
    const rangeGeo = new THREE.CylinderGeometry(0.11, 0.11, 1.0, 8, 1, true);
    rangeGeo.rotateX(Math.PI / 2);
    rangeGeo.translate(0, 0, 0.5);
    this.dbRangeLaser = new THREE.Mesh(
      rangeGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff1a33,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.deathBeamGroup.add(this.dbRangeLaser);

    // Triple-layered colossal Death Beam (Core + Crimson-Magenta Mid + Deep Blood-Red Outer)
    const dbCoreGeo = new THREE.CylinderGeometry(1.05, 1.25, 1.0, 20, 1, true);
    dbCoreGeo.rotateX(Math.PI / 2);
    dbCoreGeo.translate(0, 0, 0.5);
    this.dbBeamCore = new THREE.Mesh(
      dbCoreGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.98,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.deathBeamGroup.add(this.dbBeamCore);

    const dbMidGeo = new THREE.CylinderGeometry(2.1, 2.45, 1.0, 24, 1, true);
    dbMidGeo.rotateX(Math.PI / 2);
    dbMidGeo.translate(0, 0, 0.5);
    this.dbBeamMid = new THREE.Mesh(
      dbMidGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff1e4d,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.deathBeamGroup.add(this.dbBeamMid);

    const dbOuterGeo = new THREE.CylinderGeometry(3.35, 3.95, 1.0, 24, 1, true);
    dbOuterGeo.rotateX(Math.PI / 2);
    dbOuterGeo.translate(0, 0, 0.5);
    this.dbBeamOuter = new THREE.Mesh(
      dbOuterGeo,
      new THREE.MeshBasicMaterial({
        color: 0xb91c1c,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.deathBeamGroup.add(this.dbBeamOuter);

    // Twin counter-rotating helical plasma ribbons racing along the Death Beam
    this.dbHelixA = new THREE.Mesh(
      createHelixTubeGeometry(1.0, 2.45, 4.5, 0.24, 'z', 0, 72, 6),
      new THREE.MeshBasicMaterial({
        color: 0xffbb33,
        transparent: true,
        opacity: 0.94,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.deathBeamGroup.add(this.dbHelixA);

    this.dbHelixB = new THREE.Mesh(
      createHelixTubeGeometry(1.0, 2.85, 4.5, 0.2, 'z', Math.PI, 72, 6),
      new THREE.MeshBasicMaterial({
        color: 0xff2255,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.deathBeamGroup.add(this.dbHelixB);

    // Apocalyptic endpoint: molten plasma core + spinning vortex ring + eruption plume
    this.dbEndSphere = new THREE.Mesh(
      new THREE.SphereGeometry(4.1, 22, 16),
      new THREE.MeshBasicMaterial({
        color: 0xff6a1f,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.deathBeamGroup.add(this.dbEndSphere);

    this.dbEndVortex = new THREE.Mesh(
      new THREE.TorusGeometry(4.8, 0.48, 12, 36),
      new THREE.MeshBasicMaterial({
        color: 0xff2244,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.deathBeamGroup.add(this.dbEndVortex);

    const endPillarGeo = new THREE.CylinderGeometry(4.2, 1.4, 11.5, 20, 1, true);
    endPillarGeo.translate(0, 5.75, 0);
    this.dbEndPillar = new THREE.Mesh(
      endPillarGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff451a,
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.deathBeamGroup.add(this.dbEndPillar);

    // 7 Mach-diamond laser shock rings racing down the Death Beam
    for (let i = 0; i < 7; i++) {
      const pr = new THREE.Mesh(
        new THREE.TorusGeometry(3.0, 0.24, 10, 32),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xffcc55 : 0xff2a44,
          transparent: true,
          opacity: 0.88,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      this.deathBeamGroup.add(pr);
      this.dbPulseRings.push(pr);
    }
  }

  public update(
    sim: SimulationState,
    dt: number,
    elapsedTotal: number,
    sampleGroundY: (x: number, z: number) => number,
  ): void {
    const titan = sim.divineTitan;
    if (!titan) {
      this.rig.root.visible = false;
      this.cursorReticle.visible = false;
      this.leapPreviewRing.visible = false;
      this.skyBeamGroup.visible = false;
      this.deathBeamGroup.visible = false;
      for (const leg of this.rig.legs) {
        leg.ikInitialized = false;
        leg.isStepping = false;
      }
      this.clearDynamicEffects();
      return;
    }

    this.rig.root.visible = true;
    this.rig.root.position.set(titan.x, titan.y, titan.z);
    this.rig.bodyGroup.rotation.y = titan.bodyYaw;
    this.rig.turretGroup.rotation.y = titan.turretYaw;
    this.rig.turretPitchGroup.rotation.x = -titan.turretPitch;

    // Twin cannon combination animation during Skill 3 Death Beam!
    let targetCannonSpread = 0.82;
    let combineRecoil = 0;
    if (titan.phase === 'death_beam' && titan.deathBeam) {
      const db = titan.deathBeam;
      if (db.subPhase === 'combining') {
        const cT = Math.min(1, db.elapsed / db.combineDuration);
        const smooth = cT * cT * (3 - 2 * cT);
        targetCannonSpread = 0.82 - smooth * 0.56; // Slides tightly together to ±0.26!
      } else if (db.subPhase === 'firing') {
        targetCannonSpread = 0.26;
        combineRecoil = 0.35 + Math.sin(elapsedTotal * 48) * 0.12;
      } else {
        // Un-combine smoothly after detonation
        const uT = Math.min(1, db.elapsed / db.detonateDuration);
        targetCannonSpread = 0.26 + uT * 0.56;
      }
    }
    this.rig.leftCannonGroup.position.x += (-targetCannonSpread - this.rig.leftCannonGroup.position.x) * 0.22;
    this.rig.rightCannonGroup.position.x += (targetCannonSpread - this.rig.rightCannonGroup.position.x) * 0.22;

    // Cannon recoil & muzzle flashes
    this.rig.leftCannonGroup.position.z = 0.25 - Math.max(titan.recoilLeft * 0.72, combineRecoil);
    this.rig.rightCannonGroup.position.z = 0.25 - Math.max(titan.recoilRight * 0.72, combineRecoil);
    (this.rig.muzzleFlashLeft.material as THREE.MeshBasicMaterial).opacity =
      titan.recoilLeft > 0.65 ? (titan.recoilLeft - 0.65) * 2.8 : 0;
    (this.rig.muzzleFlashRight.material as THREE.MeshBasicMaterial).opacity =
      titan.recoilRight > 0.65 ? (titan.recoilRight - 0.65) * 2.8 : 0;

    // Animate 4-legged heavy spider-mech with true world-space foot-locked IK
    this.animateRig(titan, dt, elapsedTotal, sampleGroundY);

    // Cursor red target icon on the ground (hidden during movie-like Death Beam cutscene)
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

    // Summoning / Exit Extraction Sky Laser Beam & Skill 3 Combined Death Beam
    this.updateSkyBeam(titan, elapsedTotal);
    this.updateDeathBeam(titan, elapsedTotal);

    // Sync M1 Lasers, Shockwaves, Skill 1 Orbital Satellite, Skill 3 Mushroom Clouds, and Skill 4 Missiles
    this.syncSlashes(titan.slashes, elapsedTotal);
    this.syncShockwaves(titan.shockwaves);
    this.syncOrbitalStrikes(titan.orbitalStrikes, elapsedTotal, sampleGroundY);
    this.syncMushroomClouds(titan.mushroomClouds, elapsedTotal);
    this.syncMissiles(titan.missiles, elapsedTotal);
  }

  private animateRig(
    titan: DivineTitanState,
    dt: number,
    elapsedTotal: number,
    sampleGroundY: (x: number, z: number) => number,
  ): void {
    const isMoving = titan.phase === 'active' && titan.moveSpeed > 0.25;
    let bodyBobY = 0;
    let bodyPitch = 0;
    let bodyRoll = 0;
    let scaleFactor = TITAN_BASE_SCALE;

    if (titan.phase === 'summoning') {
      const t = Math.min(1, titan.phaseTimer / TITAN_SUMMON_DURATION);
      scaleFactor = TITAN_BASE_SCALE * (0.2 + 0.8 * (1 - (1 - t) * (1 - t)));
      bodyBobY = (1 - t) * 2.4;
    } else if (titan.phase === 'exiting') {
      const t = Math.min(1, titan.phaseTimer / TITAN_EXIT_DURATION);
      const dissolveT = Math.max(0, (t - 0.35) / 0.65);
      scaleFactor = Math.max(0.01, TITAN_BASE_SCALE * (1 - dissolveT * dissolveT));
      bodyBobY = dissolveT * 1.6;
    } else if (titan.phase === 'jumping') {
      if (titan.jumpElapsed < titan.jumpWindup) {
        const w = titan.jumpElapsed / Math.max(0.01, titan.jumpWindup);
        bodyBobY = -0.88 * Math.sin(w * Math.PI * 0.5);
        bodyPitch = 0.16 * w;
      } else {
        const flightT = Math.min(1, (titan.jumpElapsed - titan.jumpWindup) / titan.jumpDuration);
        bodyPitch = (0.5 - flightT) * 0.45;
      }
    } else if (isMoving) {
      const stepWave = Math.abs(Math.sin(titan.walkCycle));
      bodyBobY = Math.pow(stepWave, 0.72) * 0.24 - 0.08;
      bodyPitch = Math.sin(titan.walkCycle * 2) * 0.035;
      bodyRoll = Math.cos(titan.walkCycle) * 0.04;
    } else {
      bodyBobY = Math.sin(elapsedTotal * 1.8) * 0.045;
    }

    this.rig.root.scale.setScalar(scaleFactor);
    this.rig.bodyGroup.position.y = bodyBobY;
    this.rig.bodyGroup.rotation.x = bodyPitch;
    this.rig.bodyGroup.rotation.z = bodyRoll;
    this.rig.turretGroup.position.y = TITAN_CHASSIS_Y + 0.98 + bodyBobY;

    // Sweeping crimson cyclops scanner eye, spinning reactor core, rotating radar array
    this.rig.scannerEye.position.x = Math.sin(elapsedTotal * 2.6) * 0.46;
    this.rig.reactorRing.rotation.y = elapsedTotal * 2.2;
    this.rig.radarDish.rotation.y = elapsedTotal * 1.45;

    // Dual rear thruster afterburner flare
    const flameScale =
      titan.phase === 'jumping'
        ? 1.9 + Math.sin(elapsedTotal * 42) * 0.38
        : isMoving
          ? 0.65 + Math.sin(elapsedTotal * 20) * 0.16
          : 0.32 + Math.sin(elapsedTotal * 10) * 0.06;
    for (const flame of this.rig.thrusterFlames) {
      flame.scale.set(flameScale * 0.68, flameScale, flameScale * 0.68);
    }

    // =========================================================================
    // WORLD-SPACE FOOT-LOCKED 3-DOF ANALYTICAL SPIDER INVERSE KINEMATICS
    // Feet stay planted on exact world coordinates while walking AND rotating!
    // =========================================================================
    const COXA_OFFSET = 0.48;
    const FEMUR_LEN = 2.15;
    const TIBIA_LEN = 3.65;
    const FOOT_H = 0.22;

    // During jump flight / summoning / exiting, use posed legs and reset IK for clean landing
    if (titan.phase === 'jumping' && titan.jumpElapsed >= titan.jumpWindup) {
      for (const leg of this.rig.legs) {
        leg.ikInitialized = false;
        leg.isStepping = false;
        leg.coxaYawPivot.rotation.y += (leg.baseYaw - leg.coxaYawPivot.rotation.y) * 0.25;
        leg.femurPivot.rotation.z += (leg.femurBaseZ - 0.34 - leg.femurPivot.rotation.z) * 0.25;
        leg.kneePivot.rotation.z += (leg.kneeBaseZ + 0.48 - leg.kneePivot.rotation.z) * 0.25;
        leg.anklePivot.rotation.z = -(leg.femurPivot.rotation.z + leg.kneePivot.rotation.z);
      }
      return;
    }

    if (titan.phase === 'summoning' || titan.phase === 'exiting') {
      for (const leg of this.rig.legs) {
        leg.ikInitialized = false;
        leg.isStepping = false;
        leg.coxaYawPivot.rotation.y = leg.baseYaw;
        leg.femurPivot.rotation.z = leg.femurBaseZ;
        leg.kneePivot.rotation.z = leg.kneeBaseZ;
        leg.anklePivot.rotation.z = -(leg.femurBaseZ + leg.kneeBaseZ);
      }
      return;
    }

    const clampedDt = Math.min(0.08, Math.max(0.001, dt));
    const cosYaw = Math.cos(titan.bodyYaw);
    const sinYaw = Math.sin(titan.bodyYaw);

    // Lead foot targets slightly ahead of movement direction so steps plant forward naturally
    const leadMag = isMoving ? Math.min(1.35, titan.moveSpeed * 0.34) : 0;
    const leadX = Math.sin(titan.bodyYaw) * leadMag;
    const leadZ = Math.cos(titan.bodyYaw) * leadMag;

    // 1. Compute ideal world-space home position for each leg
    const homeTargets: Array<{ x: number; y: number; z: number; err: number }> = [];
    for (let i = 0; i < this.rig.legs.length; i++) {
      const leg = this.rig.legs[i];
      const hx = titan.x + (leg.homeLocalX * cosYaw + leg.homeLocalZ * sinYaw) * scaleFactor + leadX;
      const hz = titan.z + (-leg.homeLocalX * sinYaw + leg.homeLocalZ * cosYaw) * scaleFactor + leadZ;
      const hy = sampleGroundY(hx, hz);

      if (!leg.ikInitialized) {
        leg.footX = hx;
        leg.footY = hy;
        leg.footZ = hz;
        leg.isStepping = false;
        leg.stepProgress = 0;
        leg.ikInitialized = true;
      }

      const err = Math.hypot(hx - leg.footX, hz - leg.footZ);
      homeTargets.push({ x: hx, y: hy, z: hz, err });
    }

    // 2. Trigger new steps for legs that stretched past threshold (works for BOTH walking & rotating!)
    // Stability rule: do not lift a leg if either of its adjacent (non-diagonal) neighbors is mid-step.
    // Diagonal pairs: (0 & 1) and (2 & 3). Adjacent pairs: 0<->{2,3}, 1<->{2,3}.
    const stepThreshold = isMoving ? 1.85 : 1.05;
    const stepDuration = 0.36;

    for (let i = 0; i < this.rig.legs.length; i++) {
      const leg = this.rig.legs[i];
      const ht = homeTargets[i];
      if (!leg.isStepping && ht.err > stepThreshold) {
        const myGroup = i < 2 ? 0 : 1;
        let adjacentStepping = false;
        for (let j = 0; j < this.rig.legs.length; j++) {
          const otherGroup = j < 2 ? 0 : 1;
          if (otherGroup !== myGroup && this.rig.legs[j].isStepping && this.rig.legs[j].stepProgress < 0.78) {
            adjacentStepping = true;
            break;
          }
        }
        // Always step immediately if severely overstretched (> 4.2) even if adjacent is stepping
        if (!adjacentStepping || ht.err > 4.2) {
          leg.isStepping = true;
          leg.stepProgress = 0;
          leg.stepFromX = leg.footX;
          leg.stepFromY = leg.footY;
          leg.stepFromZ = leg.footZ;
          leg.stepToX = ht.x;
          leg.stepToY = ht.y;
          leg.stepToZ = ht.z;
        }
      }
    }

    // 3. Advance active steps & solve exact 3-DOF Analytical Spider IK for every leg!
    for (let i = 0; i < this.rig.legs.length; i++) {
      const leg = this.rig.legs[i];
      let targetFX = leg.footX;
      let targetFY = leg.footY;
      let targetFZ = leg.footZ;

      if (leg.isStepping) {
        leg.stepProgress += clampedDt / stepDuration;
        if (leg.stepProgress >= 1) {
          leg.isStepping = false;
          leg.stepProgress = 1;
          leg.footX = leg.stepToX;
          leg.footZ = leg.stepToZ;
          leg.footY = sampleGroundY(leg.footX, leg.footZ);
          targetFX = leg.footX;
          targetFY = leg.footY;
          targetFZ = leg.footZ;
        } else {
          // Smooth S-curve horizontally + high crisp hydraulic spider lift arc vertically
          const t = leg.stepProgress;
          const smooth = t * t * (3 - 2 * t);
          // Slightly track updated home target during early swing so fast turns feel tight
          if (t < 0.45) {
            leg.stepToX = homeTargets[i].x;
            leg.stepToZ = homeTargets[i].z;
            leg.stepToY = homeTargets[i].y;
          }
          targetFX = leg.stepFromX + (leg.stepToX - leg.stepFromX) * smooth;
          targetFZ = leg.stepFromZ + (leg.stepToZ - leg.stepFromZ) * smooth;
          const baseGroundY = leg.stepFromY + (leg.stepToY - leg.stepFromY) * smooth;
          const liftArc = Math.pow(Math.sin(t * Math.PI), 0.7) * 1.85;
          targetFY = baseGroundY + liftArc;
        }
      } else {
        // Keep planted foot locked to ground elevation (zero horizontal sliding!)
        leg.footY = sampleGroundY(leg.footX, leg.footZ);
        targetFY = leg.footY;
      }

      // Transform world-space ankle target into bodyGroup local space
      const dxW = targetFX - titan.x;
      const dyW = targetFY + FOOT_H * scaleFactor - (titan.y + bodyBobY * scaleFactor);
      const dzW = targetFZ - titan.z;
      const localX = (dxW * cosYaw - dzW * sinYaw) / scaleFactor;
      const localY = dyW / scaleFactor;
      const localZ = (dxW * sinYaw + dzW * cosYaw) / scaleFactor;

      // Vector from hip turret to ankle target
      const rx = localX - leg.hipX;
      const ry = localY - leg.hipY;
      const rz = localZ - leg.hipZ;

      // 1) Coxa horizontal yaw toward target foot
      const coxaYaw = Math.atan2(-rz, rx);

      // 2) 2-Bone planar Law of Cosines (elbow-UP spider arch!)
      const radialDist = Math.hypot(rx, rz);
      const horiz = Math.max(0.3, radialDist - COXA_OFFSET);
      const vert = ry;
      const rawDist = Math.hypot(horiz, vert);
      const maxReach = FEMUR_LEN + TIBIA_LEN - 0.08;
      const minReach = Math.abs(TIBIA_LEN - FEMUR_LEN) + 0.18;
      const d = Math.max(minReach, Math.min(maxReach, rawDist));

      const alpha = Math.atan2(vert, horiz);
      const cosBeta = Math.max(
        -1,
        Math.min(1, (FEMUR_LEN * FEMUR_LEN + d * d - TIBIA_LEN * TIBIA_LEN) / (2 * FEMUR_LEN * d)),
      );
      const beta = Math.acos(cosBeta);
      const femurZ = alpha + beta;

      const cosGamma = Math.max(
        -1,
        Math.min(
          1,
          (FEMUR_LEN * FEMUR_LEN + TIBIA_LEN * TIBIA_LEN - d * d) / (2 * FEMUR_LEN * TIBIA_LEN),
        ),
      );
      const gamma = Math.acos(cosGamma);
      const kneeZ = -(Math.PI - gamma);

      leg.coxaYawPivot.rotation.y = coxaYaw;
      leg.femurPivot.rotation.z = femurZ;
      leg.kneePivot.rotation.z = kneeZ;
      leg.anklePivot.rotation.z = -(femurZ + kneeZ);
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

  private syncSlashes(slashes: TitanSlashEffect[], elapsedTotal: number): void {
    const aliveIds = new Set<string>();
    for (const s of slashes) {
      aliveIds.add(s.id);
      let vis = this.slashMeshes.get(s.id);
      if (!vis) {
        const grp = new THREE.Group();

        // Blinding white-hot central laser lance (unit-length along +Z)
        const coreGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.0, 12, 1, true);
        coreGeo.rotateX(Math.PI / 2);
        coreGeo.translate(0, 0, 0.5);
        const core = new THREE.Mesh(
          coreGeo,
          new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.98,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );

        // Electric crimson-magenta mid-plasma sheath
        const midGeo = new THREE.CylinderGeometry(0.52, 0.52, 1.0, 14, 1, true);
        midGeo.rotateX(Math.PI / 2);
        midGeo.translate(0, 0, 0.5);
        const mid = new THREE.Mesh(
          midGeo,
          new THREE.MeshBasicMaterial({
            color: 0xff1e4d,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );

        // Deep blood-red outer ionized heat halo
        const outerGeo = new THREE.CylinderGeometry(0.95, 0.95, 1.0, 14, 1, true);
        outerGeo.rotateX(Math.PI / 2);
        outerGeo.translate(0, 0, 0.5);
        const outer = new THREE.Mesh(
          outerGeo,
          new THREE.MeshBasicMaterial({
            color: 0xb91c1c,
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );

        // Spinning helical plasma coil twisting along the laser (shared geometry)
        const helix = new THREE.Mesh(
          this.m1HelixGeo,
          new THREE.MeshBasicMaterial({
            color: 0xffbb33,
            transparent: true,
            opacity: 0.92,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );

        // Expanding muzzle shock-ring bursting from the cannon barrel (shared geometry)
        const muzzleRing = new THREE.Mesh(
          this.m1MuzzleRingGeo,
          new THREE.MeshBasicMaterial({
            color: 0xffcc66,
            transparent: true,
            opacity: 0.92,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );

        // Multi-layered impact detonation at hit point (white flash + fiery dome + shock ring)
        const impactCore = new THREE.Mesh(
          new THREE.SphereGeometry(0.9, 12, 10),
          new THREE.MeshBasicMaterial({
            color: 0xfff8e6,
            transparent: true,
            opacity: 0.96,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );

        const impactDome = new THREE.Mesh(
          new THREE.SphereGeometry(1.75, 16, 12),
          new THREE.MeshBasicMaterial({
            color: 0xff3b1a,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );

        const impactRing = new THREE.Mesh(
          this.m1MuzzleRingGeo,
          new THREE.MeshBasicMaterial({
            color: 0xff8822,
            transparent: true,
            opacity: 0.88,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );

        grp.add(outer);
        grp.add(mid);
        grp.add(core);
        grp.add(helix);
        grp.add(muzzleRing);
        grp.add(impactDome);
        grp.add(impactCore);
        grp.add(impactRing);
        this.group.add(grp);
        vis = { group: grp, core, mid, outer, helix, muzzleRing, impactCore, impactDome, impactRing };
        this.slashMeshes.set(s.id, vis);
      }

      const t = Math.min(1, s.elapsed / s.duration);
      const dx = s.targetX - s.x;
      const dy = s.targetY - s.y;
      const dz = s.targetZ - s.z;
      const beamLen = Math.max(0.5, Math.hypot(dx, dy, dz));

      vis.group.position.set(s.x, s.y, s.z);
      vis.group.lookAt(s.targetX, s.targetY, s.targetZ);

      const widthFade = 1.3 - t * 1.0;
      vis.core.scale.set(widthFade, widthFade, beamLen);
      vis.mid.scale.set(widthFade * 1.12, widthFade * 1.12, beamLen);
      vis.outer.scale.set(widthFade * 1.25, widthFade * 1.25, beamLen);

      vis.helix.scale.set(widthFade * 1.15, widthFade * 1.15, beamLen);
      vis.helix.rotation.z = elapsedTotal * 26 + s.elapsed * 18;

      vis.muzzleRing.position.set(0, 0, 0.25 + t * 2.2);
      vis.muzzleRing.scale.setScalar(0.65 + t * 1.75);

      vis.impactCore.position.set(0, 0, beamLen);
      vis.impactCore.scale.setScalar(0.95 + t * 0.9);

      vis.impactDome.position.set(0, 0, beamLen);
      vis.impactDome.scale.setScalar(0.75 + t * 1.75);

      vis.impactRing.position.set(0, 0, beamLen);
      vis.impactRing.scale.setScalar(0.85 + t * 2.8);

      const alpha = 1 - t * t;
      (vis.core.material as THREE.MeshBasicMaterial).opacity = alpha * 0.98;
      (vis.mid.material as THREE.MeshBasicMaterial).opacity = alpha * 0.85;
      (vis.outer.material as THREE.MeshBasicMaterial).opacity = alpha * 0.45;
      (vis.helix.material as THREE.MeshBasicMaterial).opacity = alpha * 0.92;
      (vis.muzzleRing.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.9;
      (vis.impactCore.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.96;
      (vis.impactDome.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.86;
      (vis.impactRing.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.85;
    }

    for (const [id, vis] of this.slashMeshes.entries()) {
      if (!aliveIds.has(id)) {
        this.group.remove(vis.group);
        vis.core.geometry.dispose();
        vis.mid.geometry.dispose();
        vis.outer.geometry.dispose();
        vis.impactCore.geometry.dispose();
        vis.impactDome.geometry.dispose();
        (vis.core.material as THREE.Material).dispose();
        (vis.mid.material as THREE.Material).dispose();
        (vis.outer.material as THREE.Material).dispose();
        (vis.helix.material as THREE.Material).dispose();
        (vis.muzzleRing.material as THREE.Material).dispose();
        (vis.impactCore.material as THREE.Material).dispose();
        (vis.impactDome.material as THREE.Material).dispose();
        (vis.impactRing.material as THREE.Material).dispose();
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

      // Animate spinning Red Target Icon & counter-rotating satellite gyro-accelerator rings
      vis.targetIcon.rotation.z = elapsedTotal * 2.6;
      const spinMult = st.phase === 'firing' ? 2.4 : 1.0;
      vis.innerGyroRing.rotation.y = elapsedTotal * 3.8 * spinMult;
      vis.outerGyroRing.rotation.y = -elapsedTotal * 2.5 * spinMult;

      // Pulsing top spire beacon strobe
      const beaconPulse = 0.75 + Math.sin(elapsedTotal * 14) * 0.45;
      vis.beaconOrb.scale.setScalar(beaconPulse);

      if (st.phase === 'lockon') {
        const t = Math.min(1, st.elapsed / st.lockonDuration);
        const ease = 1 - (1 - t) * (1 - t);
        const satY = 38 - 12 * ease;
        vis.satellite.position.y = satY;

        // Smoothly unfold articulated dual-tier solar wing arrays & flare focusing prongs
        vis.leftWingGroup.scale.x = 0.22 + 0.78 * ease;
        vis.rightWingGroup.scale.x = 0.22 + 0.78 * ease;
        for (const prong of vis.emitterProngs) {
          prong.rotation.x = -0.15 - ease * 0.45;
        }
        vis.emitterLens.scale.setScalar(0.7 + ease * 0.65 + Math.sin(elapsedTotal * 30) * 0.1);

        vis.targetIcon.scale.setScalar(1.38 - 0.38 * ease);
        (vis.targetIcon.material as THREE.MeshBasicMaterial).opacity = 0.98;
        vis.lockLines.visible = true;
        vis.lockLines.scale.set(1.25 - 0.85 * ease, 1, 1.25 - 0.85 * ease);

        // 4 converging red targeting laser sightlines sweeping inward onto the ground target
        const spreadRadius = (1 - ease) * 5.2 + 0.35;
        for (let i = 0; i < vis.lockLasers.length; i++) {
          const laser = vis.lockLasers[i];
          laser.visible = true;
          laser.position.y = satY - 2.0;
          const angle = (i / 4) * Math.PI * 2 + elapsedTotal * 1.4;
          const tilt = Math.atan2(spreadRadius, satY - 2.0);
          laser.rotation.set(Math.sin(angle) * tilt, 0, Math.cos(angle) * tilt);
          (laser.material as THREE.MeshBasicMaterial).opacity = 0.45 + ease * 0.55;
        }
        vis.beamGroup.visible = false;
      } else if (st.phase === 'firing') {
        vis.satellite.position.y = 26 + Math.sin(elapsedTotal * 22) * 0.16;
        vis.leftWingGroup.scale.x = 1;
        vis.rightWingGroup.scale.x = 1;
        for (const prong of vis.emitterProngs) {
          prong.rotation.x = -0.68 + Math.sin(elapsedTotal * 32) * 0.06;
        }
        vis.emitterLens.scale.setScalar(1.35 + Math.sin(elapsedTotal * 40) * 0.18);

        vis.targetIcon.scale.setScalar(1.08 + Math.sin(elapsedTotal * 22) * 0.1);
        (vis.targetIcon.material as THREE.MeshBasicMaterial).opacity = 0.94;
        vis.lockLines.visible = false;
        for (const laser of vis.lockLasers) laser.visible = false;
        vis.beamGroup.visible = true;

        const flicker = 0.92 + Math.sin(elapsedTotal * 48) * 0.13;
        vis.beamCore.scale.set(flicker, 1, flicker);
        vis.beamMid.scale.set(flicker * 1.04, 1, flicker * 1.04);
        vis.beamOuter.scale.set(flicker * 1.08, 1, flicker * 1.08);
        (vis.beamCore.material as THREE.MeshBasicMaterial).opacity = 0.98;
        (vis.beamMid.material as THREE.MeshBasicMaterial).opacity = 0.8;
        (vis.beamOuter.material as THREE.MeshBasicMaterial).opacity = 0.5;

        // Spin double-helix plasma spirals rapidly in opposite directions
        vis.beamHelixA.rotation.y = elapsedTotal * 11.5;
        vis.beamHelixB.rotation.y = -elapsedTotal * 9.0;
        vis.beamHelixA.scale.set(flicker, 1, flicker);
        vis.beamHelixB.scale.set(flicker * 1.05, 1, flicker * 1.05);
        (vis.beamHelixA.material as THREE.MeshBasicMaterial).opacity = 0.94;
        (vis.beamHelixB.material as THREE.MeshBasicMaterial).opacity = 0.88;

        // Blazing molten ground impact core, eruption pillar & heat ring
        vis.impactFlare.scale.set(1.35 * flicker, 0.55 * flicker, 1.35 * flicker);
        (vis.impactFlare.material as THREE.MeshBasicMaterial).opacity = 0.9;
        vis.impactPillar.scale.set(flicker * 1.1, 0.85 + Math.sin(elapsedTotal * 28) * 0.25, flicker * 1.1);
        (vis.impactPillar.material as THREE.MeshBasicMaterial).opacity = 0.68;
        vis.impactDisc.rotation.z = -elapsedTotal * 5.0;
        vis.impactDisc.scale.setScalar(0.95 + Math.sin(elapsedTotal * 26) * 0.14);
        (vis.impactDisc.material as THREE.MeshBasicMaterial).opacity = 0.82;

        // 6 high-speed descending laser shock-rings slamming into the ground
        for (let i = 0; i < vis.pulseRings.length; i++) {
          const ring = vis.pulseRings[i];
          const phase = (elapsedTotal * 2.6 + i / vis.pulseRings.length) % 1;
          ring.position.y = 25 * (1 - phase);
          const rs = 0.72 + phase * 1.05;
          ring.scale.setScalar(rs);
          (ring.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.9;
        }
      } else {
        // fadeout: beam collapses, prongs close, satellite ascends back to orbit
        const t = Math.min(1, st.elapsed / st.fadeDuration);
        const fade = 1 - t;
        vis.satellite.position.y = 26 + t * 18;
        for (const prong of vis.emitterProngs) {
          prong.rotation.x = -0.68 * fade;
        }
        vis.emitterLens.scale.setScalar(0.6 + fade * 0.65);
        vis.lockLines.visible = false;
        for (const laser of vis.lockLasers) laser.visible = false;
        vis.beamGroup.visible = true;
        vis.beamCore.scale.set(fade, 1, fade);
        vis.beamMid.scale.set(fade, 1, fade);
        vis.beamOuter.scale.set(fade, 1, fade);
        vis.beamHelixA.scale.set(fade, 1, fade);
        vis.beamHelixB.scale.set(fade, 1, fade);
        (vis.beamCore.material as THREE.MeshBasicMaterial).opacity = fade * 0.92;
        (vis.beamMid.material as THREE.MeshBasicMaterial).opacity = fade * 0.72;
        (vis.beamOuter.material as THREE.MeshBasicMaterial).opacity = fade * 0.45;
        (vis.beamHelixA.material as THREE.MeshBasicMaterial).opacity = fade * 0.85;
        (vis.beamHelixB.material as THREE.MeshBasicMaterial).opacity = fade * 0.8;
        (vis.impactFlare.material as THREE.MeshBasicMaterial).opacity = fade * 0.7;
        (vis.impactPillar.material as THREE.MeshBasicMaterial).opacity = fade * 0.55;
        (vis.impactDisc.material as THREE.MeshBasicMaterial).opacity = fade * 0.65;
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

  private updateDeathBeam(titan: DivineTitanState, elapsedTotal: number): void {
    const db = titan.deathBeam;
    if (!db || titan.phase !== 'death_beam') {
      this.deathBeamGroup.visible = false;
      return;
    }

    this.deathBeamGroup.visible = true;
    this.deathBeamGroup.position.set(db.originX, db.originY, db.originZ);
    this.deathBeamGroup.lookAt(db.targetX, db.targetY, db.targetZ);

    const beamLen = Math.max(
      1.0,
      Math.hypot(db.targetX - db.originX, db.targetY - db.originY, db.targetZ - db.originZ),
    );

    if (db.subPhase === 'combining') {
      const t = Math.min(1, db.elapsed / db.combineDuration);
      this.dbChargeOrb.visible = true;
      this.dbChargeOrb.scale.setScalar(0.28 + t * 1.75 + Math.sin(elapsedTotal * 38) * 0.16);
      (this.dbChargeOrb.material as THREE.MeshBasicMaterial).opacity = 0.58 + t * 0.42;

      for (let i = 0; i < this.dbChargeRings.length; i++) {
        const ring = this.dbChargeRings[i];
        ring.visible = true;
        const shrink = Math.max(0.18, 1.45 - t * 1.2);
        ring.scale.setScalar(shrink);
        ring.rotation.z = elapsedTotal * (5.2 + i * 2.4) * (i % 2 === 0 ? 1 : -1);
        ring.position.z = (1 - t) * (1.6 + i * 1.25);
      }

      // 4 crackling energy filaments snapping inward into the fusing twin cannons
      for (let i = 0; i < this.dbChargeArcs.length; i++) {
        const arc = this.dbChargeArcs[i];
        arc.visible = true;
        const a = (i / this.dbChargeArcs.length) * Math.PI * 2 + elapsedTotal * 7.5;
        arc.rotation.set(Math.sin(elapsedTotal * 24 + i) * 0.45, 0, a);
        arc.scale.set(0.7 + t * 0.8, 0.35 + (1 - t) * 0.95, 0.7 + t * 0.8);
        (arc.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.abs(Math.sin(elapsedTotal * 36 + i)) * 0.45;
      }

      // Thin terrifying pulsing crimson rangefinder laser locking onto the target spot
      this.dbRangeLaser.visible = true;
      const rangeWidth = 0.55 + t * 1.35 + Math.sin(elapsedTotal * 45) * 0.25;
      this.dbRangeLaser.scale.set(rangeWidth, rangeWidth, beamLen);
      (this.dbRangeLaser.material as THREE.MeshBasicMaterial).opacity = 0.45 + t * 0.55;

      this.dbBeamCore.visible = false;
      this.dbBeamMid.visible = false;
      this.dbBeamOuter.visible = false;
      this.dbHelixA.visible = false;
      this.dbHelixB.visible = false;
      this.dbEndSphere.visible = false;
      this.dbEndVortex.visible = false;
      this.dbEndPillar.visible = false;
      for (const pr of this.dbPulseRings) pr.visible = false;
    } else if (db.subPhase === 'firing') {
      const t = Math.min(1, db.elapsed / db.fireDuration);
      const flicker = 0.93 + Math.sin(elapsedTotal * 56) * 0.13;
      // Ramp width violently over the 7-second burn as energy builds toward detonation!
      const surge = 1.0 + t * 0.5;

      this.dbChargeOrb.visible = true;
      this.dbChargeOrb.scale.setScalar(1.65 * flicker * surge);
      (this.dbChargeOrb.material as THREE.MeshBasicMaterial).opacity = 0.96;

      for (const ring of this.dbChargeRings) ring.visible = false;
      for (const arc of this.dbChargeArcs) arc.visible = false;
      this.dbRangeLaser.visible = false;

      // Triple-layered colossal beam
      this.dbBeamCore.visible = true;
      this.dbBeamMid.visible = true;
      this.dbBeamOuter.visible = true;
      this.dbBeamCore.scale.set(flicker * surge, flicker * surge, beamLen);
      this.dbBeamMid.scale.set(flicker * surge * 1.05, flicker * surge * 1.05, beamLen);
      this.dbBeamOuter.scale.set(flicker * surge * 1.12, flicker * surge * 1.12, beamLen);
      (this.dbBeamCore.material as THREE.MeshBasicMaterial).opacity = 0.98;
      (this.dbBeamMid.material as THREE.MeshBasicMaterial).opacity = 0.84;
      (this.dbBeamOuter.material as THREE.MeshBasicMaterial).opacity = 0.52;

      // Twin counter-rotating helical plasma ribbons racing along the Death Beam
      this.dbHelixA.visible = true;
      this.dbHelixB.visible = true;
      this.dbHelixA.scale.set(flicker * surge, flicker * surge, beamLen);
      this.dbHelixB.scale.set(flicker * surge * 1.05, flicker * surge * 1.05, beamLen);
      this.dbHelixA.rotation.z = elapsedTotal * 14.5;
      this.dbHelixB.rotation.z = -elapsedTotal * 11.2;

      // Apocalyptic molten plasma core + spinning vortex ring + eruption column at beam endpoint!
      this.dbEndSphere.visible = true;
      this.dbEndSphere.position.set(0, 0, beamLen);
      const endScale = (0.8 + t * 1.45) * flicker;
      this.dbEndSphere.scale.setScalar(endScale);
      (this.dbEndSphere.material as THREE.MeshBasicMaterial).opacity = 0.92;

      this.dbEndVortex.visible = true;
      this.dbEndVortex.position.set(0, 0, beamLen);
      this.dbEndVortex.rotation.set(Math.PI / 2, 0, elapsedTotal * 8.5);
      this.dbEndVortex.scale.setScalar((0.85 + t * 1.3) * flicker);

      this.dbEndPillar.visible = true;
      this.dbEndPillar.position.set(0, 0, beamLen);
      this.dbEndPillar.scale.set((0.75 + t * 1.1) * flicker, 0.7 + t * 1.25, (0.75 + t * 1.1) * flicker);

      // 7 Mach-diamond laser shock rings racing from the combined cannon down to the target!
      for (let i = 0; i < this.dbPulseRings.length; i++) {
        const pr = this.dbPulseRings[i];
        pr.visible = true;
        const p = (elapsedTotal * 2.8 + i / this.dbPulseRings.length) % 1;
        pr.position.set(0, 0, p * beamLen);
        pr.scale.setScalar((0.78 + p * 0.75) * surge);
        (pr.material as THREE.MeshBasicMaterial).opacity = (1 - p * 0.6) * 0.9;
      }
    } else {
      // detonating: beam vanishes as the colossal mushroom cloud erupts!
      this.deathBeamGroup.visible = false;
    }
  }

  private syncMushroomClouds(clouds: TitanMushroomCloud[], elapsedTotal: number): void {
    const aliveIds = new Set<string>();
    for (const mc of clouds) {
      aliveIds.add(mc.id);
      let grp = this.mushroomMeshes.get(mc.id);
      if (!grp) {
        grp = new THREE.Group();

        // 1. Initial blinding pixelated voxel flash burst
        const flashGroup = new THREE.Group();
        flashGroup.name = 'mc_flash';
        const flashMat = new THREE.MeshBasicMaterial({
          color: 0xfff8dc,
          transparent: true,
          opacity: 0.98,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        flashGroup.add(new THREE.Mesh(new THREE.BoxGeometry(9.5, 9.5, 9.5), flashMat));
        flashGroup.add(new THREE.Mesh(new THREE.BoxGeometry(13.5, 5.5, 5.5), flashMat));
        flashGroup.add(new THREE.Mesh(new THREE.BoxGeometry(5.5, 5.5, 13.5), flashMat));
        flashGroup.add(new THREE.Mesh(new THREE.BoxGeometry(5.5, 13.5, 5.5), flashMat));
        grp.add(flashGroup);

        const ashDarkMat = new THREE.MeshStandardMaterial({
          color: 0x352e2c,
          emissive: 0xc2410c,
          emissiveIntensity: 0.42,
          roughness: 0.96,
          flatShading: true,
          transparent: true,
          opacity: 0.94,
        });
        const ashMidMat = new THREE.MeshStandardMaterial({
          color: 0x4d413d,
          emissive: 0xd9480f,
          emissiveIntensity: 0.35,
          roughness: 0.95,
          flatShading: true,
          transparent: true,
          opacity: 0.92,
        });
        const moltenCoreMat = new THREE.MeshBasicMaterial({
          color: 0xff6a1a,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const radGlowMat = new THREE.MeshBasicMaterial({
          color: 0xa3e635,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });

        // 2. Stepped pixelated voxel ground dust & ember base skirt
        const skirtGroup = new THREE.Group();
        skirtGroup.name = 'mc_skirt';
        const skirtCoords: Array<[number, number, number, number]> = [
          [4.6, 0, 2.8, 2.2],
          [-4.6, 0, 2.8, 2.2],
          [0, 4.6, 2.8, 2.2],
          [0, -4.6, 2.8, 2.2],
          [3.6, 3.6, 2.4, 1.8],
          [-3.6, 3.6, 2.4, 1.8],
          [3.6, -3.6, 2.4, 1.8],
          [-3.6, -3.6, 2.4, 1.8],
          [5.4, 2.0, 1.9, 1.4],
          [-5.4, -2.0, 1.9, 1.4],
          [2.0, -5.4, 1.9, 1.4],
          [-2.0, 5.4, 1.9, 1.4],
        ];
        for (let i = 0; i < skirtCoords.length; i++) {
          const [sx, sz, sw, sh] = skirtCoords[i];
          const blk = new THREE.Mesh(
            new THREE.BoxGeometry(sw, sh, sw),
            i % 3 === 0 ? ashMidMat : ashDarkMat,
          );
          blk.position.set(sx, sh * 0.5, sz);
          skirtGroup.add(blk);
        }
        grp.add(skirtGroup);

        // 3. Towering stepped pixelated voxel stem pillar (normalized y = 0..1)
        const stemGroup = new THREE.Group();
        stemGroup.name = 'mc_stem';
        const stemTiers = 7;
        for (let tier = 0; tier < stemTiers; tier++) {
          const frac = tier / stemTiers;
          const h = 1 / stemTiers + 0.02;
          const yPos = (tier + 0.5) / stemTiers;
          const outerW = 5.4 - frac * 2.0 + (tier % 2 === 0 ? 0.5 : -0.2);
          const innerW = outerW * 0.62;
          const jx = (tier % 2 === 0 ? 1 : -1) * 0.25;
          const jz = (tier % 3 === 0 ? -1 : 1) * 0.22;

          const outerBlk = new THREE.Mesh(
            new THREE.BoxGeometry(outerW, h, outerW),
            tier % 2 === 0 ? ashDarkMat : ashMidMat,
          );
          outerBlk.position.set(jx, yPos, jz);
          stemGroup.add(outerBlk);

          const coreBlk = new THREE.Mesh(new THREE.BoxGeometry(innerW, h, innerW), moltenCoreMat);
          coreBlk.position.set(0, yPos, 0);
          stemGroup.add(coreBlk);
        }
        grp.add(stemGroup);

        // 4. Pixelated blocky Wilson condensation shock-ring around mid-stem
        const wilsonGroup = new THREE.Group();
        wilsonGroup.name = 'mc_wilson';
        const wilsonMat = new THREE.MeshBasicMaterial({
          color: 0xffedd5,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        });
        const wilsonOffsets: Array<[number, number, number, number]> = [
          [0, 6.2, 6.8, 1.5],
          [0, -6.2, 6.8, 1.5],
          [6.2, 0, 1.5, 6.8],
          [-6.2, 0, 1.5, 6.8],
          [4.8, 4.8, 2.2, 2.2],
          [-4.8, 4.8, 2.2, 2.2],
          [4.8, -4.8, 2.2, 2.2],
          [-4.8, -4.8, 2.2, 2.2],
        ];
        for (const [wx, wz, ww, wd] of wilsonOffsets) {
          const wBlk = new THREE.Mesh(new THREE.BoxGeometry(ww, 1.1, wd), wilsonMat);
          wBlk.position.set(wx, 0, wz);
          wilsonGroup.add(wBlk);
        }
        grp.add(wilsonGroup);

        // 5. Towering Stepped Voxel / Pixelated Mushroom Cap (zero curvy spheres!)
        const capGroup = new THREE.Group();
        capGroup.name = 'mc_cap';

        // Blazing molten + radioactive voxel underside slab
        const underCore = new THREE.Mesh(new THREE.BoxGeometry(10.8, 2.4, 10.8), moltenCoreMat);
        underCore.position.y = -1.1;
        capGroup.add(underCore);

        const underCrossA = new THREE.Mesh(new THREE.BoxGeometry(14.2, 1.8, 6.8), moltenCoreMat);
        underCrossA.position.y = -0.9;
        capGroup.add(underCrossA);

        const underCrossB = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.8, 14.2), moltenCoreMat);
        underCrossB.position.y = -0.9;
        capGroup.add(underCrossB);

        // Glowing radioactive green-gold pixel pockets on the underside rim
        for (const [rx, rz] of [
          [5.6, 5.6],
          [-5.6, 5.6],
          [5.6, -5.6],
          [-5.6, -5.6],
        ]) {
          const radBlk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2.4), radGlowMat);
          radBlk.position.set(rx, -1.2, rz);
          capGroup.add(radBlk);
        }

        // Tier 1: Wide blocky voxel mushroom overhang rim (stepped pixel grid)
        const rimBlocks: Array<[number, number, number, number, number]> = [
          [0, 0.5, 0, 12.6, 3.0],
          [6.8, 0.2, 0, 4.0, 2.6],
          [-6.8, 0.2, 0, 4.0, 2.6],
          [0, 0.2, 6.8, 4.0, 2.6],
          [0, 0.2, -6.8, 4.0, 2.6],
          [5.2, 0.0, 5.2, 4.2, 2.4],
          [-5.2, 0.0, 5.2, 4.2, 2.4],
          [5.2, 0.0, -5.2, 4.2, 2.4],
          [-5.2, 0.0, -5.2, 4.2, 2.4],
        ];
        for (let i = 0; i < rimBlocks.length; i++) {
          const [bx, by, bz, bw, bh] = rimBlocks[i];
          const b = new THREE.Mesh(
            new THREE.BoxGeometry(bw, bh, bw),
            i % 2 === 0 ? ashDarkMat : ashMidMat,
          );
          b.position.set(bx, by, bz);
          capGroup.add(b);
        }

        // Tier 2: Stepped mid crown voxel slab + corner blocks
        const midCrown = new THREE.Mesh(new THREE.BoxGeometry(10.2, 2.8, 10.2), ashMidMat);
        midCrown.position.y = 2.8;
        capGroup.add(midCrown);

        for (const [cx, cz] of [
          [4.2, 0],
          [-4.2, 0],
          [0, 4.2],
          [0, -4.2],
        ]) {
          const shoulder = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.2, 3.8), ashDarkMat);
          shoulder.position.set(cx, 2.6, cz);
          capGroup.add(shoulder);
        }

        // Tier 3: Boxy stepped apex crown block + floating pixel embers
        const topCrown = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.4, 6.2), ashDarkMat);
        topCrown.position.y = 5.0;
        capGroup.add(topCrown);

        for (const [ex, ey, ez] of [
          [4.5, 6.2, 2.2],
          [-4.2, 6.6, -2.5],
          [2.0, 7.0, -4.4],
          [-2.4, 6.4, 4.5],
        ]) {
          const ember = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.15), moltenCoreMat);
          ember.position.set(ex, ey, ez);
          capGroup.add(ember);
        }
        grp.add(capGroup);

        this.group.add(grp);
        this.mushroomMeshes.set(mc.id, grp);
      }

      grp.position.set(mc.x, mc.y, mc.z);
      const t = Math.min(1, mc.elapsed / mc.duration);
      const riseEase = 1 - Math.pow(1 - Math.min(1, t * 2.2), 2.4);
      const fadeOut = t > 0.68 ? 1 - (t - 0.68) / 0.32 : 1;
      const curHeight = 3.5 + riseEase * (mc.maxHeight - 3.5);

      // Blinding voxel flash decays rapidly in first 0.55s
      const flash = grp.getObjectByName('mc_flash');
      if (flash) {
        const ft = Math.min(1, mc.elapsed / 0.55);
        flash.visible = ft < 1;
        flash.scale.setScalar(0.8 + ft * 2.1);
        flash.traverse((c) => {
          if (c instanceof THREE.Mesh && c.material instanceof THREE.Material) {
            c.material.opacity = (1 - ft) * (1 - ft);
          }
        });
      }

      const skirt = grp.getObjectByName('mc_skirt');
      if (skirt) {
        const sk = 0.65 + Math.pow(t, 0.55) * 2.2;
        skirt.scale.set(sk, 0.8 + t * 0.5, sk);
        skirt.traverse((c) => {
          if (c instanceof THREE.Mesh && c.material instanceof THREE.Material) {
            c.material.opacity = 0.9 * fadeOut;
          }
        });
      }

      const stem = grp.getObjectByName('mc_stem');
      if (stem) {
        const stemW = 0.85 + t * 0.45;
        stem.scale.set(stemW, curHeight, stemW);
        stem.traverse((c) => {
          if (c instanceof THREE.Mesh && c.material instanceof THREE.Material) {
            c.material.opacity = 0.88 * fadeOut;
          }
        });
      }

      const wilson = grp.getObjectByName('mc_wilson');
      if (wilson) {
        wilson.position.y = curHeight * 0.56;
        const ws = 0.72 + Math.pow(t, 0.5) * 1.85;
        wilson.scale.set(ws, 1, ws);
        wilson.traverse((c) => {
          if (c instanceof THREE.Mesh && c.material instanceof THREE.Material) {
            c.material.opacity = 0.68 * fadeOut * (1 - t * 0.4);
          }
        });
      }

      const cap = grp.getObjectByName('mc_cap');
      if (cap) {
        cap.position.y = curHeight;
        cap.rotation.y = Math.floor(elapsedTotal * 2) * 0.04; // subtle stepped retro rotation
        const capScale = 0.48 + Math.pow(Math.min(1, t * 1.8), 0.65) * 1.1;
        cap.scale.setScalar(capScale);
        cap.traverse((c) => {
          if (c instanceof THREE.Mesh && c.material instanceof THREE.Material) {
            c.material.opacity = 0.92 * fadeOut;
          }
        });
      }
    }

    for (const [id, grp] of this.mushroomMeshes.entries()) {
      if (!aliveIds.has(id)) {
        this.group.remove(grp);
        grp.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
            else obj.material.dispose();
          }
        });
        this.mushroomMeshes.delete(id);
      }
    }
  }

  private syncMissiles(missiles: TitanMissile[], elapsedTotal: number): void {
    const aliveIds = new Set<string>();
    for (const m of missiles) {
      aliveIds.add(m.id);
      let grp = this.missileMeshes.get(m.id);
      if (!grp) {
        grp = new THREE.Group();

        const hullMat = new THREE.MeshStandardMaterial({
          color: 0x68766c,
          metalness: 0.78,
          roughness: 0.25,
        });
        const darkMat = new THREE.MeshStandardMaterial({
          color: 0x262e2a,
          metalness: 0.85,
          roughness: 0.28,
        });

        // Armored military warhead fuselage oriented along +Z
        const bodyGeo = new THREE.CylinderGeometry(0.15, 0.19, 1.5, 10);
        bodyGeo.rotateX(Math.PI / 2);
        const body = new THREE.Mesh(bodyGeo, hullMat);
        grp.add(body);

        // Tactical dark armor collar bands
        const bandGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.22, 10);
        bandGeo.rotateX(Math.PI / 2);
        const bandFront = new THREE.Mesh(bandGeo, darkMat);
        bandFront.position.z = 0.42;
        grp.add(bandFront);

        const bandRear = new THREE.Mesh(bandGeo, darkMat);
        bandRear.position.z = -0.45;
        grp.add(bandRear);

        // Glowing crimson warhead nosecone + white-hot laser seeker eye
        const noseGeo = new THREE.ConeGeometry(0.17, 0.62, 10);
        noseGeo.rotateX(Math.PI / 2);
        const nose = new THREE.Mesh(
          noseGeo,
          new THREE.MeshBasicMaterial({ color: 0xff1e3a }),
        );
        nose.position.z = 1.04;
        grp.add(nose);

        const seekerEye = new THREE.Mesh(
          new THREE.SphereGeometry(0.085, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xfff8e6 }),
        );
        seekerEye.position.z = 1.32;
        grp.add(seekerEye);

        // 4 angled metallic cruciform stabilizer tail fins
        const finGeo = new THREE.BoxGeometry(0.04, 0.48, 0.45);
        for (let f = 0; f < 4; f++) {
          const fin = new THREE.Mesh(finGeo, darkMat);
          const a = (f / 4) * Math.PI * 2 + Math.PI / 4;
          fin.position.set(Math.cos(a) * 0.22, Math.sin(a) * 0.22, -0.58);
          fin.rotation.z = a - Math.PI / 2;
          grp.add(fin);
        }

        // Thruster nozzle + dual-layered flickering plasma exhaust plume (-Z)
        const nozzleGeo = new THREE.CylinderGeometry(0.14, 0.21, 0.24, 10);
        nozzleGeo.rotateX(Math.PI / 2);
        const nozzle = new THREE.Mesh(nozzleGeo, darkMat);
        nozzle.position.z = -0.82;
        grp.add(nozzle);

        const plumeCoreGeo = new THREE.ConeGeometry(0.14, 1.85, 8, 1, true);
        plumeCoreGeo.rotateX(-Math.PI / 2);
        const plumeCore = new THREE.Mesh(
          plumeCoreGeo,
          new THREE.MeshBasicMaterial({
            color: 0xfff7dd,
            transparent: true,
            opacity: 0.96,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        plumeCore.position.z = -1.75;
        plumeCore.name = 'missile_plume_core';
        grp.add(plumeCore);

        const plumeOuterGeo = new THREE.ConeGeometry(0.32, 3.2, 10, 1, true);
        plumeOuterGeo.rotateX(-Math.PI / 2);
        const plumeOuter = new THREE.Mesh(
          plumeOuterGeo,
          new THREE.MeshBasicMaterial({
            color: 0xff3b14,
            transparent: true,
            opacity: 0.82,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        plumeOuter.position.z = -2.35;
        plumeOuter.name = 'missile_plume_outer';
        grp.add(plumeOuter);

        this.group.add(grp);
        this.missileMeshes.set(m.id, grp);
      }

      grp.position.set(m.x, m.y, m.z);
      const vx = m.x - m.prevX;
      const vy = m.y - m.prevY;
      const vz = m.z - m.prevZ;
      if (vx * vx + vy * vy + vz * vz > 0.0001) {
        grp.lookAt(m.x + vx, m.y + vy, m.z + vz);
      }

      // High-frequency rocket exhaust flicker
      const pFlicker = 0.85 + Math.sin(elapsedTotal * 55 + m.x * 3.1) * 0.22;
      const pCore = grp.getObjectByName('missile_plume_core');
      if (pCore) pCore.scale.set(1, 1, pFlicker);
      const pOuter = grp.getObjectByName('missile_plume_outer');
      if (pOuter) pOuter.scale.set(0.95 + pFlicker * 0.12, 0.95 + pFlicker * 0.12, pFlicker * 1.08);
    }

    for (const [id, grp] of this.missileMeshes.entries()) {
      if (!aliveIds.has(id)) {
        this.group.remove(grp);
        grp.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
            else obj.material.dispose();
          }
        });
        this.missileMeshes.delete(id);
      }
    }
  }

  private clearDynamicEffects(): void {
    for (const [, vis] of this.slashMeshes.entries()) {
      this.group.remove(vis.group);
      vis.core.geometry.dispose();
      vis.mid.geometry.dispose();
      vis.outer.geometry.dispose();
      vis.impactCore.geometry.dispose();
      vis.impactDome.geometry.dispose();
      (vis.core.material as THREE.Material).dispose();
      (vis.mid.material as THREE.Material).dispose();
      (vis.outer.material as THREE.Material).dispose();
      (vis.helix.material as THREE.Material).dispose();
      (vis.muzzleRing.material as THREE.Material).dispose();
      (vis.impactCore.material as THREE.Material).dispose();
      (vis.impactDome.material as THREE.Material).dispose();
      (vis.impactRing.material as THREE.Material).dispose();
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

    for (const [, grp] of this.mushroomMeshes.entries()) {
      this.group.remove(grp);
    }
    this.mushroomMeshes.clear();

    for (const [, grp] of this.missileMeshes.entries()) {
      this.group.remove(grp);
    }
    this.missileMeshes.clear();
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
    this.m1HelixGeo.dispose();
    this.m1MuzzleRingGeo.dispose();
    this.group.removeFromParent();
  }
}
