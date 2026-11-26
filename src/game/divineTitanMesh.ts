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

    // Cannon recoil & muzzle flashes
    this.rig.leftCannonGroup.position.z = 0.25 - titan.recoilLeft * 0.72;
    this.rig.rightCannonGroup.position.z = 0.25 - titan.recoilRight * 0.72;
    (this.rig.muzzleFlashLeft.material as THREE.MeshBasicMaterial).opacity =
      titan.recoilLeft > 0.65 ? (titan.recoilLeft - 0.65) * 2.8 : 0;
    (this.rig.muzzleFlashRight.material as THREE.MeshBasicMaterial).opacity =
      titan.recoilRight > 0.65 ? (titan.recoilRight - 0.65) * 2.8 : 0;

    // Animate 4-legged heavy spider-mech with true world-space foot-locked IK
    this.animateRig(titan, dt, elapsedTotal, sampleGroundY);

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
