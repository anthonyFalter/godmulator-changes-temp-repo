import * as THREE from 'three';
import type { LightingPreset, TileData } from './types';

export interface AmbientFaunaSystem {
  group: THREE.Group;
  update: (
    dt: number,
    elapsed: number,
    tiles: TileData[],
    gridSize: number,
    preset: LightingPreset,
    detail: 'full' | 'reduced' | 'low',
  ) => void;
  reseed: (tiles: TileData[], gridSize: number) => void;
  dispose: () => void;
}

interface BirdAgent {
  cx: number;
  cz: number;
  orbitR: number;
  angle: number;
  speed: number;
  alt: number;
  flapPhase: number;
  flapSpeed: number;
  scale: number;
}

interface ButterflyAgent {
  hx: number;
  hz: number;
  baseY: number;
  phase: number;
  speed: number;
  radius: number;
  scale: number;
}

interface FishAgent {
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  cycleDur: number;
  jumpDur: number;
  phase: number;
  arcLen: number;
  arcH: number;
  scale: number;
  isFreshwater: boolean;
}

interface SwimFishAgent {
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  depthY: number;
  speed: number;
  phase: number;
  scale: number;
  figureEight: boolean;
}

interface WaterInsectAgent {
  hx: number;
  hz: number;
  baseY: number;
  radiusX: number;
  radiusZ: number;
  speed: number;
  phase: number;
  scale: number;
}

/**
 * Lightweight instanced ambient world fauna (7 draw calls total):
 * - Soaring bird flocks with rhythmic flapping wings over forests, peaks, and coasts
 * - Colorful butterflies fluttering over meadows, blossom groves, and floral plains
 * - Leaping silver-cyan ocean fish & golden-silver river/lake trout with expanding water splash rings
 * - Underwater swimming minnow & koi schools gliding beneath translucent lakes and rivers
 * - Skimming dragonflies by day & softly glowing golden fireflies by night over lakes and riverbanks
 */
export function createAmbientFaunaSystem(
  gridSize: number,
  initialTiles: TileData[],
): AmbientFaunaSystem {
  const group = new THREE.Group();
  group.name = 'ambient_fauna_group';

  const scaleFactor = Math.min(2.2, Math.max(0.8, gridSize / 64));
  const BIRD_CAP = Math.min(56, Math.round(28 * scaleFactor));
  const BUTTERFLY_CAP = Math.min(64, Math.round(30 * scaleFactor));
  const FISH_CAP = Math.min(54, Math.round(28 * scaleFactor));
  const SPLASH_CAP = FISH_CAP * 2;
  const SWIM_FISH_CAP = Math.min(72, Math.round(38 * scaleFactor));
  const WATER_INSECT_CAP = Math.min(56, Math.round(28 * scaleFactor));

  // 1. Bird geometry: crisp voxel-styled left/right wings pivoted at center body
  const leftWingGeo = new THREE.BoxGeometry(0.24, 0.04, 0.14);
  leftWingGeo.translate(-0.12, 0, 0);
  const rightWingGeo = new THREE.BoxGeometry(0.24, 0.04, 0.14);
  rightWingGeo.translate(0.12, 0, 0);
  const birdMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.05,
    flatShading: true,
  });

  const birdLeftInst = new THREE.InstancedMesh(leftWingGeo, birdMat, BIRD_CAP);
  const birdRightInst = new THREE.InstancedMesh(rightWingGeo, birdMat, BIRD_CAP);
  birdLeftInst.frustumCulled = false;
  birdRightInst.frustumCulled = false;
  birdLeftInst.castShadow = false;
  birdRightInst.castShadow = false;

  // 2. Butterfly geometry: tiny twin-wing diamond silhouette
  const butterflyGeo = new THREE.BoxGeometry(0.14, 0.025, 0.1);
  const butterflyMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  const butterflyInst = new THREE.InstancedMesh(butterflyGeo, butterflyMat, BUTTERFLY_CAP);
  butterflyInst.frustumCulled = false;

  // 3. Jumping fish geometry: sleek voxel trout / minnow with per-instance color tinting
  const fishGeo = new THREE.BoxGeometry(0.1, 0.08, 0.24);
  const fishMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color('#0c4a6e'),
    emissiveIntensity: 0.18,
    roughness: 0.24,
    metalness: 0.32,
    flatShading: true,
  });
  const fishInst = new THREE.InstancedMesh(fishGeo, fishMat, FISH_CAP);
  fishInst.frustumCulled = false;

  // 4. Expanding water surface splash rings synced with fish leaps & splashdowns
  const splashRingGeo = new THREE.RingGeometry(0.14, 0.21, 8);
  splashRingGeo.rotateX(-Math.PI / 2);
  const splashRingMat = new THREE.MeshBasicMaterial({
    color: 0xe6fbff,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const splashRingInst = new THREE.InstancedMesh(splashRingGeo, splashRingMat, SPLASH_CAP);
  splashRingInst.frustumCulled = false;

  // 5. Underwater swimming minnow & koi schools gliding beneath lakes & rivers
  const swimFishGeo = new THREE.BoxGeometry(0.072, 0.052, 0.21);
  const swimFishMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color('#134e4a'),
    emissiveIntensity: 0.16,
    roughness: 0.32,
    metalness: 0.22,
    flatShading: true,
  });
  const swimFishInst = new THREE.InstancedMesh(swimFishGeo, swimFishMat, SWIM_FISH_CAP);
  swimFishInst.frustumCulled = false;

  // 6. Freshwater skimming dragonflies (day) / glowing golden fireflies (night)
  const waterInsectGeo = new THREE.BoxGeometry(0.15, 0.024, 0.11);
  const waterInsectMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  const waterInsectInst = new THREE.InstancedMesh(waterInsectGeo, waterInsectMat, WATER_INSECT_CAP);
  waterInsectInst.frustumCulled = false;

  group.add(
    birdLeftInst,
    birdRightInst,
    butterflyInst,
    fishInst,
    splashRingInst,
    swimFishInst,
    waterInsectInst,
  );

  const birds: BirdAgent[] = [];
  const butterflies: ButterflyAgent[] = [];
  const fish: FishAgent[] = [];
  const swimFish: SwimFishAgent[] = [];
  const waterInsects: WaterInsectAgent[] = [];

  const BIRD_COLORS = [0xf8fafc, 0xe2e8f0, 0xd6d3d1, 0xfef3c7, 0xcbd5e1];
  const BUTTERFLY_COLORS = [0xfacc15, 0xf472b6, 0x38bdf8, 0xc084fc, 0xfb923c, 0x4ade80];
  const OCEAN_FISH_COLORS = [0x7dd3fc, 0xbae6fd, 0x38bdf8, 0xe0f2fe];
  const FRESHWATER_JUMP_COLORS = [0xf8fafc, 0xfdba74, 0xfde047, 0xcbd5e1, 0x86efac];
  const LAKE_SWIM_COLORS = [0xfb923c, 0xfacc15, 0xf8fafc, 0xf97316, 0xa7f3d0, 0xcbd5e1];
  const RIVER_SWIM_COLORS = [0xcbd5e1, 0x94a3b8, 0xa7f3d0, 0xfde68a, 0x93c5fd];
  const DRAGONFLY_COLORS = [0x2dd4bf, 0x38bdf8, 0x34d399, 0x60a5fa, 0xfbbf24];
  const FIREFLY_COLORS = [0xfef08a, 0xfde047, 0xd9f99d, 0xfef9c3, 0xbef264];

  const tmpColor = new THREE.Color();
  let lastInsectNightMode: boolean | null = null;

  const isCleanWaterTile = (tiles: TileData[], gs: number, x: number, z: number): boolean => {
    if (x < 0 || z < 0 || x >= gs || z >= gs) return false;
    const t = tiles[z * gs + x];
    return Boolean(t && t.height === 0 && !t.waterKind && t.terrain !== 'ice');
  };

  const applyWaterInsectPalette = (nightMode: boolean) => {
    const palette = nightMode ? FIREFLY_COLORS : DRAGONFLY_COLORS;
    for (let i = 0; i < waterInsects.length; i++) {
      tmpColor.setHex(palette[i % palette.length]);
      waterInsectInst.setColorAt(i, tmpColor);
    }
    if (waterInsectInst.instanceColor) waterInsectInst.instanceColor.needsUpdate = true;
    lastInsectNightMode = nightMode;
  };

  const reseed = (tiles: TileData[], gs: number) => {
    birds.length = 0;
    butterflies.length = 0;
    fish.length = 0;
    swimFish.length = 0;
    waterInsects.length = 0;
    lastInsectNightMode = null;

    const meadowSpots: TileData[] = [];
    const oceanSpots: TileData[] = [];
    const freshwaterSpots: TileData[] = [];
    const landSpots: TileData[] = [];

    const stride = Math.max(1, Math.floor(tiles.length / 900));
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (!t) continue;

      // Capture ALL clean inland lakes & rivers so freshwater waterways are never starved by ocean area
      if (
        t.height === 0 &&
        !t.waterKind &&
        t.terrain !== 'ice' &&
        (t.isRiver || t.isLake)
      ) {
        freshwaterSpots.push(t);
        continue;
      }

      if (i % stride !== 0) continue;

      if (t.height > 0) {
        landSpots.push(t);
        if (
          t.terrain === 'grass' ||
          t.terrain === 'fertile' ||
          t.terrain === 'blossom' ||
          t.terrain === 'floral_plains' ||
          t.terrain === 'forest'
        ) {
          meadowSpots.push(t);
        }
      } else if (
        t.height === 0 &&
        !t.waterKind &&
        (t.terrain === 'shallow_water' || t.terrain === 'deep_water')
      ) {
        oceanSpots.push(t);
      }
    }

    // Seed bird flocks (groups of 4-5 birds orbiting shared sky centers)
    const flockCount = Math.max(3, Math.floor(BIRD_CAP / 5));
    let bIdx = 0;
    for (let f = 0; f < flockCount && bIdx < BIRD_CAP; f++) {
      const anchor =
        landSpots.length > 0
          ? landSpots[Math.floor(Math.random() * landSpots.length)]
          : { x: gs * 0.5, z: gs * 0.5, height: 2 };
      const flockR = 4.5 + Math.random() * 7.5;
      const flockAlt = 4.2 + Math.min(3.0, anchor.height * 0.45) + Math.random() * 2.8;
      const flockSpeed = (0.28 + Math.random() * 0.22) * (Math.random() < 0.5 ? 1 : -1);
      const baseAngle = Math.random() * Math.PI * 2;
      const members = Math.min(5, BIRD_CAP - bIdx);
      for (let m = 0; m < members; m++) {
        birds.push({
          cx: anchor.x + (Math.random() - 0.5) * 3.0,
          cz: anchor.z + (Math.random() - 0.5) * 3.0,
          orbitR: Math.max(2.5, flockR + (Math.random() - 0.5) * 2.2),
          angle: baseAngle + m * 0.22 + (Math.random() - 0.5) * 0.14,
          speed: flockSpeed * (0.94 + Math.random() * 0.12),
          alt: flockAlt + (Math.random() - 0.5) * 0.65,
          flapPhase: Math.random() * Math.PI * 2,
          flapSpeed: 6.5 + Math.random() * 2.8,
          scale: 0.78 + Math.random() * 0.36,
        });
        tmpColor.setHex(BIRD_COLORS[bIdx % BIRD_COLORS.length]);
        birdLeftInst.setColorAt(bIdx, tmpColor);
        birdRightInst.setColorAt(bIdx, tmpColor);
        bIdx++;
      }
    }
    if (birdLeftInst.instanceColor) birdLeftInst.instanceColor.needsUpdate = true;
    if (birdRightInst.instanceColor) birdRightInst.instanceColor.needsUpdate = true;

    // Seed butterflies over meadows & blossom groves
    for (let i = 0; i < BUTTERFLY_CAP && meadowSpots.length > 0; i++) {
      const t = meadowSpots[Math.floor(Math.random() * meadowSpots.length)];
      butterflies.push({
        hx: t.x + (Math.random() - 0.5) * 0.8,
        hz: t.z + (Math.random() - 0.5) * 0.8,
        baseY: t.height * 0.45 + 0.55 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
        speed: 1.4 + Math.random() * 1.2,
        radius: 0.75 + Math.random() * 1.35,
        scale: 0.7 + Math.random() * 0.5,
      });
      tmpColor.setHex(BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length]);
      butterflyInst.setColorAt(i, tmpColor);
    }
    if (butterflyInst.instanceColor) butterflyInst.instanceColor.needsUpdate = true;

    // Seed jumping fish: prioritize ~60% in inland lakes & rivers so waterways feel alive!
    const freshJumpQuota =
      freshwaterSpots.length > 0
        ? oceanSpots.length > 0
          ? Math.round(FISH_CAP * 0.62)
          : FISH_CAP
        : 0;
    for (let i = 0; i < FISH_CAP; i++) {
      const pickFresh = i < freshJumpQuota && freshwaterSpots.length > 0;
      const pool = pickFresh ? freshwaterSpots : oceanSpots.length > 0 ? oceanSpots : freshwaterSpots;
      if (pool.length === 0) break;
      const t = pool[Math.floor(Math.random() * pool.length)];

      // Choose leap direction that stays over water when possible
      let dirX = 1;
      let dirZ = 0;
      let arcLen = pickFresh ? 0.58 + Math.random() * 0.36 : 0.9 + Math.random() * 0.65;
      let foundOpenDir = false;
      const baseAng = Math.random() * Math.PI * 2;
      for (let attempt = 0; attempt < 6; attempt++) {
        const ang = baseAng + (attempt * Math.PI) / 3;
        const dx = Math.cos(ang);
        const dz = Math.sin(ang);
        const sx = Math.round(t.x - dx * arcLen * 0.5);
        const sz = Math.round(t.z - dz * arcLen * 0.5);
        const ex = Math.round(t.x + dx * arcLen * 0.5);
        const ez = Math.round(t.z + dz * arcLen * 0.5);
        if (isCleanWaterTile(tiles, gs, sx, sz) && isCleanWaterTile(tiles, gs, ex, ez)) {
          dirX = dx;
          dirZ = dz;
          foundOpenDir = true;
          break;
        }
      }
      if (!foundOpenDir) {
        dirX = Math.cos(baseAng);
        dirZ = Math.sin(baseAng);
        arcLen = 0.34;
      }

      fish.push({
        x: t.x,
        z: t.z,
        dirX,
        dirZ,
        cycleDur: pickFresh ? 3.8 + Math.random() * 4.6 : 4.8 + Math.random() * 5.6,
        jumpDur: 0.68 + Math.random() * 0.28,
        phase: Math.random() * 10,
        arcLen,
        arcH: pickFresh ? 0.36 + Math.random() * 0.24 : 0.42 + Math.random() * 0.3,
        scale: pickFresh ? 0.78 + Math.random() * 0.34 : 0.85 + Math.random() * 0.4,
        isFreshwater: pickFresh,
      });
    }

    // Seed underwater swimming koi & minnow schools in inland lakes and rivers
    if (freshwaterSpots.length > 0) {
      let sIdx = 0;
      const schoolAttempts = Math.min(SWIM_FISH_CAP, Math.max(8, Math.ceil(SWIM_FISH_CAP / 2)));
      for (let s = 0; s < schoolAttempts && sIdx < SWIM_FISH_CAP; s++) {
        const t = freshwaterSpots[Math.floor(Math.random() * freshwaterSpots.length)];
        const openE = isCleanWaterTile(tiles, gs, t.x + 1, t.z);
        const openW = isCleanWaterTile(tiles, gs, t.x - 1, t.z);
        const openS = isCleanWaterTile(tiles, gs, t.x, t.z + 1);
        const openN = isCleanWaterTile(tiles, gs, t.x, t.z - 1);
        const safeRx = openE && openW ? 0.68 + Math.random() * 0.34 : 0.26 + Math.random() * 0.1;
        const safeRz = openS && openN ? 0.68 + Math.random() * 0.34 : 0.26 + Math.random() * 0.1;
        const schoolSize = Math.min(t.isLake ? 3 : 2, SWIM_FISH_CAP - sIdx);
        const baseSpeed = (0.75 + Math.random() * 0.55) * (Math.random() < 0.5 ? 1 : -1);
        const basePhase = Math.random() * Math.PI * 2;
        const useFigureEight = Boolean(t.isLake && safeRx > 0.5 && safeRz > 0.5);
        const palette = t.isLake ? LAKE_SWIM_COLORS : RIVER_SWIM_COLORS;

        for (let m = 0; m < schoolSize; m++) {
          swimFish.push({
            cx: t.x + (Math.random() - 0.5) * 0.16,
            cz: t.z + (Math.random() - 0.5) * 0.16,
            rx: safeRx * (0.85 + Math.random() * 0.2),
            rz: safeRz * (0.85 + Math.random() * 0.2),
            depthY: 0.175 + Math.random() * 0.045,
            speed: baseSpeed * (0.94 + Math.random() * 0.12),
            phase: basePhase + m * 0.42,
            scale: (t.isLake ? 0.88 : 0.76) + Math.random() * 0.32,
            figureEight: useFigureEight,
          });
          tmpColor.setHex(palette[(sIdx + m) % palette.length]);
          swimFishInst.setColorAt(sIdx, tmpColor);
          sIdx++;
        }
      }
      if (swimFishInst.instanceColor) swimFishInst.instanceColor.needsUpdate = true;

      // Seed freshwater dragonflies (day) / fireflies (night) skimming over lakes & riverbanks
      for (let i = 0; i < WATER_INSECT_CAP; i++) {
        const t = freshwaterSpots[Math.floor(Math.random() * freshwaterSpots.length)];
        waterInsects.push({
          hx: t.x + (Math.random() - 0.5) * 0.6,
          hz: t.z + (Math.random() - 0.5) * 0.6,
          baseY: 0.46 + Math.random() * 0.32,
          radiusX: 0.55 + Math.random() * 0.85,
          radiusZ: 0.55 + Math.random() * 0.85,
          speed: 1.55 + Math.random() * 1.15,
          phase: Math.random() * Math.PI * 2,
          scale: 0.72 + Math.random() * 0.45,
        });
      }
      applyWaterInsectPalette(false);
    }
  };

  reseed(initialTiles, gridSize);

  const dummy = new THREE.Object3D();
  const wingEuler = new THREE.Euler();

  const update = (
    dt: number,
    elapsed: number,
    _tiles: TileData[],
    _gs: number,
    preset: LightingPreset,
    detail: 'full' | 'reduced' | 'low',
  ) => {
    const densityMult = detail === 'low' ? 0.35 : detail === 'reduced' ? 0.65 : 1.0;
    const isNight = preset === 'night' || preset === 'midnight';

    // 1. Update soaring birds
    const activeBirds = Math.min(birds.length, Math.floor(birds.length * densityMult));
    for (let i = 0; i < activeBirds; i++) {
      const b = birds[i];
      b.angle += b.speed * dt;
      const x = b.cx + Math.cos(b.angle) * b.orbitR;
      const z = b.cz + Math.sin(b.angle) * b.orbitR;
      const y = b.alt + Math.sin(elapsed * 0.9 + b.flapPhase) * 0.25;

      // Tangent heading along orbit
      const dirSign = b.speed >= 0 ? 1 : -1;
      const vx = -Math.sin(b.angle) * dirSign;
      const vz = Math.cos(b.angle) * dirSign;
      const yaw = Math.atan2(vx, vz);

      // Periodic glide + flap cycle
      const glideMod = Math.sin(elapsed * 0.65 + b.flapPhase) > 0.25 ? 0.22 : 1.0;
      const flapAngle = Math.sin(elapsed * b.flapSpeed + b.flapPhase) * 0.52 * glideMod;

      // Left wing
      dummy.position.set(x, y, z);
      wingEuler.set(0, yaw, flapAngle, 'YXZ');
      dummy.rotation.copy(wingEuler);
      dummy.scale.setScalar(b.scale);
      dummy.updateMatrix();
      birdLeftInst.setMatrixAt(i, dummy.matrix);

      // Right wing
      wingEuler.set(0, yaw, -flapAngle, 'YXZ');
      dummy.rotation.copy(wingEuler);
      dummy.updateMatrix();
      birdRightInst.setMatrixAt(i, dummy.matrix);
    }
    birdLeftInst.count = activeBirds;
    birdRightInst.count = activeBirds;
    birdLeftInst.visible = activeBirds > 0;
    birdRightInst.visible = activeBirds > 0;
    if (activeBirds > 0) {
      birdLeftInst.instanceMatrix.needsUpdate = true;
      birdRightInst.instanceMatrix.needsUpdate = true;
    }

    // 2. Update butterflies (active during daytime/dawn/dusk, tucked away at deep night)
    const activeButterflies = isNight
      ? 0
      : Math.min(butterflies.length, Math.floor(butterflies.length * densityMult));
    for (let i = 0; i < activeButterflies; i++) {
      const bf = butterflies[i];
      const t = elapsed * bf.speed + bf.phase;
      const x = bf.hx + Math.sin(t) * bf.radius;
      const z = bf.hz + Math.sin(t * 2.0) * bf.radius * 0.55;
      const y = bf.baseY + Math.sin(t * 3.1) * 0.22;
      const flutter = Math.sin(elapsed * 18.0 + bf.phase) * 0.65;
      dummy.position.set(x, y, z);
      dummy.rotation.set(flutter * 0.35, t * 0.8, flutter);
      dummy.scale.set(
        bf.scale,
        bf.scale,
        bf.scale * (0.65 + Math.abs(Math.cos(elapsed * 18.0 + bf.phase)) * 0.55),
      );
      dummy.updateMatrix();
      butterflyInst.setMatrixAt(i, dummy.matrix);
    }
    butterflyInst.count = activeButterflies;
    butterflyInst.visible = activeButterflies > 0;
    if (activeButterflies > 0) {
      butterflyInst.instanceMatrix.needsUpdate = true;
    }

    // 3. Update jumping fish + synced expanding water splash rings
    const maxFish = Math.min(fish.length, Math.floor(fish.length * densityMult));
    let visibleFish = 0;
    let visibleSplashes = 0;
    const SPLASH_DUR = 0.68;

    for (let i = 0; i < maxFish; i++) {
      const f = fish[i];
      const localT = (elapsed + f.phase) % f.cycleDur;

      // Takeoff splash ring at leap origin
      if (localT < SPLASH_DUR && visibleSplashes < SPLASH_CAP) {
        const sProg = localT / SPLASH_DUR;
        const ringScale = (0.45 + sProg * 1.45) * f.scale;
        const fadeThick = Math.max(0.08, 1.0 - sProg);
        dummy.position.set(
          f.x - f.dirX * f.arcLen * 0.5,
          0.312,
          f.z - f.dirZ * f.arcLen * 0.5,
        );
        dummy.rotation.set(0, f.phase, 0);
        dummy.scale.set(ringScale, fadeThick, ringScale);
        dummy.updateMatrix();
        splashRingInst.setMatrixAt(visibleSplashes++, dummy.matrix);
      }

      // Splashdown ripple ring where fish re-enters the water
      const postJumpT = localT - f.jumpDur;
      if (postJumpT >= 0 && postJumpT < SPLASH_DUR && visibleSplashes < SPLASH_CAP) {
        const sProg = postJumpT / SPLASH_DUR;
        const ringScale = (0.55 + sProg * 1.85) * f.scale;
        const fadeThick = Math.max(0.08, 1.0 - sProg);
        dummy.position.set(
          f.x + f.dirX * f.arcLen * 0.5,
          0.312,
          f.z + f.dirZ * f.arcLen * 0.5,
        );
        dummy.rotation.set(0, f.phase + 1.1, 0);
        dummy.scale.set(ringScale, fadeThick, ringScale);
        dummy.updateMatrix();
        splashRingInst.setMatrixAt(visibleSplashes++, dummy.matrix);
      }

      if (localT > f.jumpDur) continue;
      const u = localT / f.jumpDur; // 0..1 across the leap
      const horiz = (u - 0.5) * f.arcLen;
      const x = f.x + f.dirX * horiz;
      const z = f.z + f.dirZ * horiz;
      const y = 0.22 + 4 * u * (1 - u) * f.arcH;
      const pitch = (0.5 - u) * 1.45;
      const yaw = Math.atan2(f.dirX, f.dirZ);

      dummy.position.set(x, y, z);
      dummy.rotation.set(-pitch, yaw, 0, 'YXZ');
      dummy.scale.setScalar(f.scale);
      dummy.updateMatrix();
      const palette = f.isFreshwater ? FRESHWATER_JUMP_COLORS : OCEAN_FISH_COLORS;
      tmpColor.setHex(palette[i % palette.length]);
      fishInst.setColorAt(visibleFish, tmpColor);
      fishInst.setMatrixAt(visibleFish++, dummy.matrix);
    }
    fishInst.count = visibleFish;
    fishInst.visible = visibleFish > 0;
    if (visibleFish > 0) {
      fishInst.instanceMatrix.needsUpdate = true;
      if (fishInst.instanceColor) fishInst.instanceColor.needsUpdate = true;
    }
    splashRingInst.count = visibleSplashes;
    splashRingInst.visible = visibleSplashes > 0;
    if (visibleSplashes > 0) {
      splashRingInst.instanceMatrix.needsUpdate = true;
    }

    // 4. Update underwater swimming koi & minnow schools
    const activeSwimFish = Math.min(swimFish.length, Math.floor(swimFish.length * densityMult));
    for (let i = 0; i < activeSwimFish; i++) {
      const sf = swimFish[i];
      const ang = elapsed * sf.speed + sf.phase;
      let x: number;
      let z: number;
      let vx: number;
      let vz: number;
      if (sf.figureEight) {
        x = sf.cx + Math.sin(ang) * sf.rx;
        z = sf.cz + Math.sin(ang * 2.0) * sf.rz * 0.5;
        vx = Math.cos(ang) * sf.rx * sf.speed;
        vz = Math.cos(ang * 2.0) * sf.rz * sf.speed;
      } else {
        x = sf.cx + Math.cos(ang) * sf.rx;
        z = sf.cz + Math.sin(ang) * sf.rz;
        vx = -Math.sin(ang) * sf.rx * sf.speed;
        vz = Math.cos(ang) * sf.rz * sf.speed;
      }
      const tailWiggle = Math.sin(elapsed * 9.5 + sf.phase * 3.0) * 0.16;
      const yaw = Math.atan2(vx, vz) + tailWiggle;
      dummy.position.set(x, sf.depthY + Math.sin(elapsed * 1.8 + sf.phase) * 0.015, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.setScalar(sf.scale);
      dummy.updateMatrix();
      swimFishInst.setMatrixAt(i, dummy.matrix);
    }
    swimFishInst.count = activeSwimFish;
    swimFishInst.visible = activeSwimFish > 0;
    if (activeSwimFish > 0) {
      swimFishInst.instanceMatrix.needsUpdate = true;
    }

    // 5. Update freshwater dragonflies (day) / glowing golden fireflies (night)
    const activeWaterInsects = Math.min(
      waterInsects.length,
      Math.floor(waterInsects.length * densityMult),
    );
    if (activeWaterInsects > 0 && lastInsectNightMode !== isNight) {
      applyWaterInsectPalette(isNight);
    }
    for (let i = 0; i < activeWaterInsects; i++) {
      const wi = waterInsects[i];
      if (isNight) {
        // Gentle drifting fireflies with soft bioluminescent blink
        const t = elapsed * wi.speed * 0.42 + wi.phase;
        const x = wi.hx + Math.sin(t) * wi.radiusX;
        const z = wi.hz + Math.cos(t * 1.35) * wi.radiusZ;
        const y = wi.baseY + 0.18 + Math.sin(t * 2.1) * 0.24;
        const glowPulse = 0.55 + 0.45 * Math.sin(elapsed * 3.4 + wi.phase * 2.7);
        const s = wi.scale * 0.58 * glowPulse;
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, t, 0);
        dummy.scale.set(s, s * 2.4, s);
      } else {
        // Crisp darting dragonflies skimming over lakes & riverbanks
        const t = elapsed * wi.speed + wi.phase;
        const dart = t + Math.sin(t * 2.0) * 0.35;
        const x = wi.hx + Math.cos(dart) * wi.radiusX;
        const z = wi.hz + Math.sin(dart * 1.5) * wi.radiusZ;
        const y = wi.baseY + Math.sin(elapsed * 4.2 + wi.phase) * 0.12;
        const vx = -Math.sin(dart) * wi.radiusX;
        const vz = Math.cos(dart * 1.5) * 1.5 * wi.radiusZ;
        const yaw = Math.atan2(vx, vz);
        const wingBuzz = Math.sin(elapsed * 32.0 + wi.phase) * 0.35;
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, yaw, wingBuzz, 'YXZ');
        dummy.scale.set(wi.scale * 1.15, wi.scale * 0.8, wi.scale * 0.95);
      }
      dummy.updateMatrix();
      waterInsectInst.setMatrixAt(i, dummy.matrix);
    }
    waterInsectInst.count = activeWaterInsects;
    waterInsectInst.visible = activeWaterInsects > 0;
    if (activeWaterInsects > 0) {
      waterInsectInst.instanceMatrix.needsUpdate = true;
    }
  };

  const dispose = () => {
    leftWingGeo.dispose();
    rightWingGeo.dispose();
    birdMat.dispose();
    butterflyGeo.dispose();
    butterflyMat.dispose();
    fishGeo.dispose();
    fishMat.dispose();
    splashRingGeo.dispose();
    splashRingMat.dispose();
    swimFishGeo.dispose();
    swimFishMat.dispose();
    waterInsectGeo.dispose();
    waterInsectMat.dispose();
  };

  return { group, update, reseed, dispose };
}
