import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EPOCHS, GOD_POWERS } from '../game/catalog';
import {
  createBuildingGroup,
  createUnitGroup,
  getNodeVariantLibrary,
} from '../game/meshBuilders';
import {
  createOceanFoamSystem,
  createSkyCloudSystem,
  createStyledTerrainSystem,
} from '../game/skyAndSea';
import {
  executeGodPowerImpact,
  getSettlementAnchor,
  stepSimulation,
} from '../game/simulation';
import { soundEngine } from '../game/sound';
import {
  ActiveTool,
  GameLifecycleState,
  GodPowerType,
  LightingPreset,
  SimulationState,
  TerrainType,
} from '../game/types';

interface IsometricWorldCanvasProps {
  simRef: React.MutableRefObject<SimulationState>;
  gameState: GameLifecycleState;
  timeScale: number;
  activeTool: ActiveTool;
  brushRadius: number;
  pixelScale: number;
  lightingPreset: LightingPreset;
  cameraActionRef: React.MutableRefObject<{
    rotateDelta: number;
    zoomDelta: number;
    centerHome: boolean;
  }>;
  onTileInteract: (tileX: number, tileZ: number) => void;
  onHoverTileChange: (tile: { x: number; z: number } | null) => void;
  onSyncHud: () => void;
}

const HEIGHT_STEP = 0.45;
const MAX_PARTICLES = 650;

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

export const IsometricWorldCanvas: React.FC<IsometricWorldCanvasProps> = ({
  simRef,
  gameState,
  timeScale,
  activeTool,
  brushRadius,
  pixelScale,
  lightingPreset,
  cameraActionRef,
  onTileInteract,
  onHoverTileChange,
  onSyncHud,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store latest props in refs so WebGLRenderer mounts once and never tears down on HUD updates
  const propsRef = useRef({
    gameState,
    timeScale,
    activeTool,
    brushRadius,
    pixelScale,
    lightingPreset,
    onTileInteract,
    onHoverTileChange,
    onSyncHud,
  });

  useEffect(() => {
    propsRef.current = {
      gameState,
      timeScale,
      activeTool,
      brushRadius,
      pixelScale,
      lightingPreset,
      onTileInteract,
      onHoverTileChange,
      onSyncHud,
    };
  }, [
    gameState,
    timeScale,
    activeTool,
    brushRadius,
    pixelScale,
    lightingPreset,
    onTileInteract,
    onHoverTileChange,
    onSyncHud,
  ]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: false, // Deliberate crisp pixel edges
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.BasicShadowMap; // Crisp pixel-art shadow edges

    renderer.domElement.className = 'w-full h-full block pixelated-canvas outline-none';
    renderer.domElement.tabIndex = 0;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1a2428');
    scene.fog = new THREE.FogExp2('#1a2428', 0.014);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Orthographic camera for authentic isometric projection
    const aspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
    let frustumSize = 15;
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      -120,
      220,
    );

    const sim = simRef.current;
    const gridCenter = (sim.gridSize - 1) / 2;

    // 3-Point Warm/Cool Studio + Temple Torch Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x8ecae6, 0x2b3a3e, 0.85);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffdfb0, 1.85);
    keyLight.position.set(gridCenter + 12, 28, gridCenter + 8);
    keyLight.target.position.set(gridCenter, 0, gridCenter);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    let shadowBounds = 18;
    keyLight.shadow.camera.left = -shadowBounds;
    keyLight.shadow.camera.right = shadowBounds;
    keyLight.shadow.camera.top = shadowBounds;
    keyLight.shadow.camera.bottom = -shadowBounds;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 75;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);
    scene.add(keyLight.target);

    const rimLight = new THREE.DirectionalLight(0x56cfe1, 0.55);
    rimLight.position.set(-16, 15, -16);
    scene.add(rimLight);

    // Warm sacred bonfire / torch point light at settlement heart
    const hearthLight = new THREE.PointLight(0xff922b, 2.4, 12, 1.6);
    hearthLight.position.set(gridCenter, 3.0, gridCenter);
    scene.add(hearthLight);

    // Dynamic God Power Flash Light (illuminates terrain & structures during miracle/disaster casts)
    const vfxFlashLight = new THREE.PointLight(0xff922b, 0, 26, 1.2);
    vfxFlashLight.position.set(gridCenter, 6.0, gridCenter);
    scene.add(vfxFlashLight);

    // Groups for terrain, nodes, buildings, units, cursor, and particles
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const terrainGroup = new THREE.Group();
    const nodesGroup = new THREE.Group();
    const buildingsGroup = new THREE.Group();
    const unitsGroup = new THREE.Group();
    worldGroup.add(terrainGroup, nodesGroup, buildingsGroup, unitsGroup);

    // Animated pixelated ocean, coastal surf foam, reef foam, & sculpted drifting sky clouds
    const oceanFoam = createOceanFoamSystem(sim.gridSize);
    oceanFoam.updateMap(sim.tiles);
    worldGroup.add(oceanFoam.mesh);

    const skyClouds = createSkyCloudSystem(sim.gridSize);
    worldGroup.add(skyClouds.shadowGroup);
    worldGroup.add(skyClouds.group);

    // Instanced terrain system (14 draw calls total regardless of map size!)
    const TERRAIN_TYPES: TerrainType[] = [
      'deep_water',
      'shallow_water',
      'sand',
      'grass',
      'fertile',
      'forest',
      'savanna',
      'swamp',
      'highland',
      'stone_road',
      'rock',
      'snow',
      'scorched',
      'crystal_field',
    ];
    const tileGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    tileGeo.translate(0, -0.5, 0);

    const styledTerrain = createStyledTerrainSystem(sim.gridSize);
    styledTerrain.updateMap(sim.tiles);

    const terrainInstancedMap = new Map<TerrainType, THREE.InstancedMesh>();
    const terrainInstancedList: THREE.InstancedMesh[] = [];
    const terrainInstanceToTile = new Map<THREE.InstancedMesh, Int32Array>();
    const worldBoundsSphere = new THREE.Sphere(
      new THREE.Vector3(gridCenter, 2, gridCenter),
      sim.gridSize * 1.1,
    );

    for (const tType of TERRAIN_TYPES) {
      const mat = styledTerrain.getMaterials(tType);
      const inst = new THREE.InstancedMesh(tileGeo, mat, sim.tiles.length);
      inst.frustumCulled = false;
      inst.boundingSphere = worldBoundsSphere;
      inst.receiveShadow = true;
      inst.castShadow = tType !== 'deep_water' && tType !== 'shallow_water';
      inst.count = 0;
      terrainGroup.add(inst);
      terrainInstancedMap.set(tType, inst);
      terrainInstancedList.push(inst);
      terrainInstanceToTile.set(inst, new Int32Array(sim.tiles.length));
    }

    const tileCurrentY = new Float32Array(sim.tiles.length);
    const tilePropSig = new Int32Array(sim.tiles.length);
    const tileLastNodeY = new Float32Array(sim.tiles.length);
    for (let i = 0; i < sim.tiles.length; i++) {
      const t = sim.tiles[i];
      const y0 = t.height === 0 ? 0.12 : t.height * HEIGHT_STEP + 0.25;
      tileCurrentY[i] = y0;
      tileLastNodeY[i] = -999;
      tilePropSig[i] = -1;
    }

    // Instanced Multi-Object Props (1-4 objects per tile across 128x128 in ~33 draw calls)
    const variantLib = getNodeVariantLibrary();
    const maxPropCapacity = Math.ceil(sim.tiles.length * 0.45);
    const makePropInstancedList = (
      geos: THREE.BufferGeometry[],
      mat: THREE.Material,
      castShadow: boolean,
    ) =>
      geos.map((geo) => {
        const inst = new THREE.InstancedMesh(geo, mat, maxPropCapacity);
        inst.frustumCulled = false;
        inst.boundingSphere = worldBoundsSphere;
        inst.castShadow = castShadow;
        inst.receiveShadow = true;
        inst.count = 0;
        nodesGroup.add(inst);
        return inst;
      });

    const timberInsts = makePropInstancedList(variantLib.timber, variantLib.standardMat, true);
    const berryInsts = makePropInstancedList(variantLib.berry, variantLib.standardMat, true);
    const stoneInsts = makePropInstancedList(variantLib.stone, variantLib.standardMat, true);
    const oreInsts = makePropInstancedList(variantLib.ore, variantLib.standardMat, true);
    const crystalInsts = makePropInstancedList(variantLib.crystal, variantLib.crystalMat, true);
    const ambGrassInsts = makePropInstancedList(variantLib.ambientGrass, variantLib.standardMat, false);
    const ambForestInsts = makePropInstancedList(variantLib.ambientForest, variantLib.standardMat, false);
    const ambSandInsts = makePropInstancedList(variantLib.ambientSand, variantLib.standardMat, false);
    const ambRockInsts = makePropInstancedList(variantLib.ambientRock, variantLib.standardMat, false);
    const ambSnowInsts = makePropInstancedList(variantLib.ambientSnow, variantLib.standardMat, false);
    const ambSavannaInsts = makePropInstancedList(variantLib.ambientSavanna, variantLib.standardMat, false);
    const ambSwampInsts = makePropInstancedList(variantLib.ambientSwamp, variantLib.standardMat, false);
    const ambHighlandInsts = makePropInstancedList(variantLib.ambientHighland, variantLib.standardMat, false);

    const allPropInsts = [
      ...timberInsts,
      ...berryInsts,
      ...stoneInsts,
      ...oreInsts,
      ...crystalInsts,
      ...ambGrassInsts,
      ...ambForestInsts,
      ...ambSandInsts,
      ...ambRockInsts,
      ...ambSnowInsts,
      ...ambSavannaInsts,
      ...ambSwampInsts,
      ...ambHighlandInsts,
    ];

    const TERRAIN_CODE: Record<string, number> = {
      deep_water: 0,
      shallow_water: 1,
      sand: 2,
      grass: 3,
      fertile: 4,
      forest: 5,
      savanna: 6,
      swamp: 7,
      highland: 8,
      stone_road: 9,
      rock: 10,
      snow: 11,
      scorched: 12,
      crystal_field: 13,
    };
    const NODE_CODE: Record<string, number> = {
      none: 0,
      timber_grove: 1,
      berry_bush: 2,
      stone_outcrop: 3,
      ore_vein: 4,
      crystal_monolith: 5,
    };

    const buildingMeshes = new Map<string, { group: THREE.Group; epochLevel: number; type: string }>();
    const unitMeshes = new Map<
      string,
      { group: THREE.Group; epochLevel: number; role: string; species: string }
    >();

    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x1b262b,
      roughness: 0.9,
    });
    const baseSkirt = new THREE.Mesh(
      new THREE.BoxGeometry(sim.gridSize + 1.0, 1.8, sim.gridSize + 1.0),
      skirtMat,
    );
    baseSkirt.position.set(gridCenter, -0.95, gridCenter);
    worldGroup.add(baseSkirt);

    // Hover / Tool Brush Reticle Ring
    const reticleGroup = new THREE.Group();
    const reticleRingGeo = new THREE.RingGeometry(0.45, 0.54, 24);
    reticleRingGeo.rotateX(-Math.PI / 2);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0xf5b742,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const reticleMesh = new THREE.Mesh(reticleRingGeo, reticleMat);
    reticleMesh.position.y = 0.04;
    reticleGroup.add(reticleMesh);
    worldGroup.add(reticleGroup);

    // Zero-GC Pooled Particle System (InstancedMesh)
    const particleGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleInstanced = new THREE.InstancedMesh(particleGeo, particleMat, MAX_PARTICLES);
    particleInstanced.frustumCulled = false;
    worldGroup.add(particleInstanced);

    const particles: PooledParticle[] = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: -100,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1,
      size: 1,
      color: new THREE.Color(0xffffff),
    }));
    let particleHead = 0;

    function spawnParticleBurst(
      x: number,
      y: number,
      z: number,
      count: number,
      hexColor: string,
      spread = 1.8,
      upSpeed = 4.5,
      sizeMult = 1.0,
    ) {
      const baseCol = new THREE.Color(hexColor);
      for (let i = 0; i < count; i++) {
        const p = particles[particleHead];
        particleHead = (particleHead + 1) % MAX_PARTICLES;
        p.active = true;
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * spread;
        p.x = x + Math.cos(angle) * r * 0.55;
        p.y = y + 0.15 + Math.random() * 0.45;
        p.z = z + Math.sin(angle) * r * 0.55;
        const radialSpeed = (1.2 + Math.random() * 3.8) * (0.5 + spread * 0.18);
        p.vx = Math.cos(angle) * radialSpeed;
        p.vy = upSpeed * (0.55 + Math.random() * 1.05);
        p.vz = Math.sin(angle) * radialSpeed;
        p.maxLife = 0.65 + Math.random() * 0.75;
        p.life = p.maxLife;
        p.size = (0.85 + Math.random() * 1.35) * sizeMult;
        p.color.copy(baseCol).offsetHSL((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.22);
      }
    }

    // Active Tile Fire Flames & Smoke Plumes (Zero-GC InstancedMesh for burning tiles)
    const MAX_FIRE_TILES = 320;
    const fireOuterGeo = new THREE.BoxGeometry(0.28, 0.68, 0.28);
    fireOuterGeo.translate(0, 0.34, 0);
    const fireCoreGeo = new THREE.BoxGeometry(0.16, 0.48, 0.16);
    fireCoreGeo.translate(0, 0.24, 0);
    const fireSmokeGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    const fireOuterMat = new THREE.MeshBasicMaterial({
      color: 0xff5400,
      transparent: true,
      opacity: 0.92,
    });
    const fireCoreMat = new THREE.MeshBasicMaterial({ color: 0xffee55 });
    const fireSmokeMat = new THREE.MeshBasicMaterial({
      color: 0x2b2d42,
      transparent: true,
      opacity: 0.58,
    });
    const fireOuterInst = new THREE.InstancedMesh(fireOuterGeo, fireOuterMat, MAX_FIRE_TILES);
    const fireCoreInst = new THREE.InstancedMesh(fireCoreGeo, fireCoreMat, MAX_FIRE_TILES);
    const fireSmokeInst = new THREE.InstancedMesh(fireSmokeGeo, fireSmokeMat, MAX_FIRE_TILES);
    fireOuterInst.frustumCulled = false;
    fireCoreInst.frustumCulled = false;
    fireSmokeInst.frustumCulled = false;
    fireOuterInst.count = 0;
    fireCoreInst.count = 0;
    fireSmokeInst.count = 0;
    worldGroup.add(fireOuterInst, fireCoreInst, fireSmokeInst);

    // Lingering Hazard Zones (Monsoon storm clouds, Plague miasma, Aegis shield dome, Singularity rift)
    const hazardsGroup = new THREE.Group();
    worldGroup.add(hazardsGroup);

    const sharedHazSphereGeo = new THREE.BoxGeometry(1, 0.65, 1);
    const sharedRainDropGeo = new THREE.BoxGeometry(0.08, 0.55, 0.08);
    const sharedDomeGeo = new THREE.IcosahedronGeometry(1, 2);
    const sharedDomeCylinderGeo = new THREE.CylinderGeometry(1, 1, 2.8, 24, 1, true);
    sharedDomeCylinderGeo.translate(0, 1.4, 0);
    const sharedHazRingGeo = new THREE.RingGeometry(0.86, 1.0, 32);
    sharedHazRingGeo.rotateX(-Math.PI / 2);
    const sharedRiftTorusGeo = new THREE.TorusGeometry(1.65, 0.22, 8, 24);
    const sharedRiftCoreGeo = new THREE.SphereGeometry(0.95, 16, 12);

    interface HazardVisual {
      kind: 'rain_cloud' | 'plague_cloud' | 'shield_dome' | 'wormhole_rift';
      group: THREE.Group;
      materials: THREE.Material[];
      drops?: { mesh: THREE.Mesh; offsetY: number; speed: number; baseX: number; baseZ: number }[];
      spores?: { mesh: THREE.Mesh; angle: number; dist: number; phase: number; height: number }[];
      ringMesh?: THREE.Mesh;
      secondaryRingMesh?: THREE.Mesh;
      cloudBody?: THREE.Group;
      currentY?: number;
    }
    const hazardMeshes = new Map<string, HazardVisual>();

    function createHazardVisual(
      kind: HazardVisual['kind'],
      radius: number,
    ): HazardVisual {
      const group = new THREE.Group();
      const materials: THREE.Material[] = [];

      if (kind === 'rain_cloud') {
        const cloudMat = new THREE.MeshStandardMaterial({
          color: 0x334155,
          roughness: 0.85,
          transparent: true,
          opacity: 0.95,
        });
        const cloudBellyMat = new THREE.MeshBasicMaterial({
          color: 0x64748b,
          transparent: true,
          opacity: 0.9,
        });
        const dropMat = new THREE.MeshBasicMaterial({
          color: 0x72efdd,
          transparent: true,
          opacity: 0.92,
        });
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x4ea8de,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(cloudMat, cloudBellyMat, dropMat, ringMat);

        const cloudBody = new THREE.Group();
        const puffs = [
          { x: 0, y: 4.8, z: 0, sx: 4.4, sy: 1.2, sz: 3.8, belly: false },
          { x: -1.9, y: 4.4, z: 1.1, sx: 2.8, sy: 1.0, sz: 2.5, belly: true },
          { x: 2.0, y: 4.5, z: -0.9, sx: 3.0, sy: 1.1, sz: 2.6, belly: false },
          { x: 0.8, y: 5.1, z: 1.6, sx: 2.5, sy: 1.0, sz: 2.4, belly: false },
          { x: -1.4, y: 4.6, z: -1.5, sx: 2.6, sy: 0.95, sz: 2.4, belly: true },
          { x: 1.6, y: 4.3, z: 1.4, sx: 2.2, sy: 0.9, sz: 2.2, belly: true },
        ];
        for (const pf of puffs) {
          const m = new THREE.Mesh(sharedHazSphereGeo, pf.belly ? cloudBellyMat : cloudMat);
          m.position.set(pf.x, pf.y, pf.z);
          m.scale.set(pf.sx, pf.sy, pf.sz);
          cloudBody.add(m);
        }
        group.add(cloudBody);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
        ringMesh.position.y = 0.08;
        ringMesh.scale.setScalar(radius * 0.92);
        group.add(ringMesh);

        const drops: { mesh: THREE.Mesh; offsetY: number; speed: number; baseX: number; baseZ: number }[] = [];
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * Math.PI * 2 + (i % 5) * 0.35;
          const r = (0.15 + ((i * 29) % 100) / 100) * radius * 0.82;
          const bx = Math.cos(a) * r;
          const bz = Math.sin(a) * r;
          const dMesh = new THREE.Mesh(sharedRainDropGeo, dropMat);
          dMesh.position.set(bx, 2.2, bz);
          group.add(dMesh);
          drops.push({
            mesh: dMesh,
            offsetY: (i * 0.19) % 4.4,
            speed: 7.5 + (i % 4) * 1.4,
            baseX: bx,
            baseZ: bz,
          });
        }
        return { kind, group, materials, drops, ringMesh, cloudBody };
      }

      if (kind === 'plague_cloud') {
        const sporeMat = new THREE.MeshBasicMaterial({
          color: 0x80ed99,
          transparent: true,
          opacity: 0.78,
        });
        const darkSporeMat = new THREE.MeshBasicMaterial({
          color: 0x38b000,
          transparent: true,
          opacity: 0.65,
        });
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x80ed99,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(sporeMat, darkSporeMat, ringMat);
        const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
        ringMesh.position.y = 0.08;
        ringMesh.scale.setScalar(radius);
        group.add(ringMesh);

        const spores: { mesh: THREE.Mesh; angle: number; dist: number; phase: number; height: number }[] = [];
        for (let i = 0; i < 18; i++) {
          const angle = (i / 18) * Math.PI * 2;
          const dist = 0.35 + ((i * 37) % 10) * 0.085 * radius;
          const m = new THREE.Mesh(sharedHazSphereGeo, i % 2 === 0 ? sporeMat : darkSporeMat);
          const s = 0.95 + (i % 3) * 0.38;
          m.scale.set(s, s * 0.85, s);
          const h = 0.65 + (i % 4) * 0.45;
          m.position.set(Math.cos(angle) * dist, h, Math.sin(angle) * dist);
          group.add(m);
          spores.push({ mesh: m, angle, dist, phase: i * 0.7, height: h });
        }
        return { kind, group, materials, spores, ringMesh };
      }

      if (kind === 'shield_dome') {
        const domeMat = new THREE.MeshBasicMaterial({
          color: 0x56cfe1,
          transparent: true,
          opacity: 0.28,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const wireMat = new THREE.MeshBasicMaterial({
          color: 0x90e0ef,
          wireframe: true,
          transparent: true,
          opacity: 0.62,
        });
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x72efdd,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(domeMat, wireMat, ringMat);

        const dome = new THREE.Mesh(sharedDomeCylinderGeo, domeMat);
        dome.scale.set(radius, 1.15, radius);
        group.add(dome);

        const geoShell = new THREE.Mesh(sharedDomeGeo, wireMat);
        geoShell.scale.set(radius * 0.98, radius * 0.65, radius * 0.98);
        geoShell.position.y = 0.4;
        group.add(geoShell);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
        ringMesh.position.y = 0.08;
        ringMesh.scale.setScalar(radius * 1.02);
        group.add(ringMesh);
        return { kind, group, materials, ringMesh, secondaryRingMesh: geoShell };
      }

      // wormhole_rift — spinning black hole event horizon + twin gyroscopic accretion rings + cosmic beam
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xc77dff,
        transparent: true,
        opacity: 0.95,
      });
      const cyanRingMat = new THREE.MeshBasicMaterial({
        color: 0x56cfe1,
        transparent: true,
        opacity: 0.9,
      });
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0x10002b,
      });
      materials.push(ringMat, cyanRingMat, coreMat);

      const torus1 = new THREE.Mesh(sharedRiftTorusGeo, ringMat);
      torus1.position.y = 1.8;
      torus1.rotation.x = Math.PI / 2;
      group.add(torus1);

      const torus2 = new THREE.Mesh(sharedRiftTorusGeo, cyanRingMat);
      torus2.position.y = 1.8;
      torus2.scale.setScalar(0.75);
      torus2.rotation.x = Math.PI / 3;
      group.add(torus2);

      const core = new THREE.Mesh(sharedRiftCoreGeo, coreMat);
      core.position.y = 1.8;
      group.add(core);
      return { kind, group, materials, ringMesh: torus1, secondaryRingMesh: torus2 };
    }

    // One-shot Animated Power VFX (Sculpted Craggy Asteroid dive + fireball dome, Multi-fork Lightning, Orbital Beams, Shockwaves)
    const burstFxGroup = new THREE.Group();
    worldGroup.add(burstFxGroup);

    // Build a sculpted, craggy, crater-pitted space-rock asteroid with vertex-colored dark chondrite crust & glowing magma fissures
    const sharedMeteorGeo = (() => {
      const base = new THREE.IcosahedronGeometry(1.55, 2).toNonIndexed();
      const pos = base.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const craters = [
        new THREE.Vector3(0.72, 0.48, 0.5).normalize(),
        new THREE.Vector3(-0.78, 0.25, 0.56).normalize(),
        new THREE.Vector3(0.15, -0.86, 0.48).normalize(),
        new THREE.Vector3(-0.35, 0.68, -0.64).normalize(),
        new THREE.Vector3(0.62, -0.38, -0.68).normalize(),
        new THREE.Vector3(-0.52, -0.58, -0.62).normalize(),
      ];
      const v = new THREE.Vector3();
      const n = new THREE.Vector3();
      const colCrustDark = new THREE.Color('#241a18');
      const colCrustMid = new THREE.Color('#3f302b');
      const colCrustHi = new THREE.Color('#5c4740');
      const colScorch = new THREE.Color('#9e3312');
      const colLava = new THREE.Color('#ff5400');
      const colLavaHot = new THREE.Color('#ffee55');
      const tmpCol = new THREE.Color();

      // Process triangle-by-triangle so each rock facet has crisp flat-shaded pixel-art rock contrast
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        n.copy(v).normalize();

        // Multi-frequency rocky crag & ridge displacement
        const crag =
          Math.sin(n.x * 4.5 + n.y * 3.2) * 0.2 +
          Math.cos(n.y * 6.1 - n.z * 5.4) * 0.15 +
          Math.sin(n.z * 8.3 + n.x * 7.1) * 0.1;

        // Carve impact craters & raised rims into the asteroid surface
        let craterDelta = 0;
        for (const cDir of craters) {
          const d = n.dot(cDir);
          if (d > 0.78) {
            const depth = (d - 0.78) / 0.22;
            craterDelta -= depth * 0.34;
          } else if (d > 0.66) {
            const rim = 1 - Math.abs(d - 0.72) / 0.06;
            craterDelta += Math.max(0, rim) * 0.11;
          }
        }

        const rawScale = 1.0 + crag + craterDelta;
        const snappedScale = Math.round(rawScale * 18) / 18;

        // Asymmetric potato/bolide proportions (not a sphere or cube!)
        v.x *= snappedScale * 1.28;
        v.y *= snappedScale * 0.92;
        v.z *= snappedScale * 1.08;
        pos.setXYZ(i, v.x, v.y, v.z);

        // Fissure & crater magma glow in deep crevices, dark charred chondrite rock on outer ridges
        const fissureWave = Math.sin(n.x * 9.5 - n.z * 8.2) * Math.cos(n.y * 9.1);
        const depthMetric = snappedScale + fissureWave * 0.08;

        if (depthMetric < 0.84) {
          tmpCol.copy(colLavaHot).lerp(colLava, Math.max(0, (depthMetric - 0.72) / 0.12));
        } else if (depthMetric < 0.94) {
          tmpCol.copy(colLava).lerp(colScorch, (depthMetric - 0.84) / 0.1);
        } else if (depthMetric < 1.04) {
          tmpCol.copy(colCrustDark).lerp(colCrustMid, (depthMetric - 0.94) / 0.1);
        } else {
          tmpCol.copy(colCrustMid).lerp(colCrustHi, Math.min(1, (depthMetric - 1.04) / 0.18));
        }

        colors[i * 3] = tmpCol.r;
        colors[i * 3 + 1] = tmpCol.g;
        colors[i * 3 + 2] = tmpCol.b;
      }

      base.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      base.computeVertexNormals();
      return base;
    })();

    // Streamlined teardrop/parabolic atmospheric plasma sheath & tail (instead of a 3D box!)
    const sharedMeteorAuraGeo = (() => {
      const aura = new THREE.IcosahedronGeometry(1.95, 2);
      const pos = aura.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        // Stretch trailing upper-back wake along (+1, +2.2, -1) flight axis into a comet teardrop
        const trailDot = (v.x * 0.38 + v.y * 0.84 - v.z * 0.38) / 1.95;
        if (trailDot > 0) {
          const stretch = 1 + trailDot * 1.85;
          v.x += 0.38 * trailDot * 2.4;
          v.y += 0.84 * trailDot * 2.4;
          v.z -= 0.38 * trailDot * 2.4;
          v.multiplyScalar(1 - trailDot * 0.22 + stretch * 0.08);
        }
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      aura.computeVertexNormals();
      return aura;
    })();

    const sharedExplosionDomeGeo = new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const sharedBoltGeo = new THREE.BoxGeometry(0.34, 6.2, 0.34);
    const sharedBeamGeo = new THREE.CylinderGeometry(0.85, 1.35, 18, 16, 1, true);
    sharedBeamGeo.translate(0, 9, 0);
    const sharedPillarSpikeGeo = new THREE.BoxGeometry(0.45, 2.2, 0.45);
    sharedPillarSpikeGeo.translate(0, 1.1, 0);

    interface ActiveBurstFx {
      kind: 'meteor' | 'lightning' | 'rain_summon' | 'beam_ring';
      powerType: string;
      group: THREE.Group;
      materials: THREE.Material[];
      age: number;
      duration: number;
      impactDelay: number;
      deferImpact: boolean;
      tx: number;
      ty: number;
      tz: number;
      radius: number;
      impactFired: boolean;
      meteorMesh?: THREE.Group;
      meteorRockCore?: THREE.Object3D;
      boltSegments?: THREE.Mesh[];
      forkMeshes?: THREE.Mesh[];
      explosionDome?: THREE.Mesh;
      innerDomeMesh?: THREE.Mesh;
      shockWallMesh?: THREE.Mesh;
      ringMesh?: THREE.Mesh;
      outerRingMesh?: THREE.Mesh;
      beamMesh?: THREE.Mesh;
      spikes?: THREE.Mesh[];
      colorHex: string;
    }
    const activeBurstFx: ActiveBurstFx[] = [];

    function triggerLightFlash(x: number, y: number, z: number, hexColor: string, intensity = 16) {
      vfxFlashLight.position.set(x, y + 4.5, z);
      vfxFlashLight.color.set(hexColor);
      vfxFlashLight.intensity = intensity;
    }

    function spawnPowerVisualEffect(
      type: string,
      tx: number,
      ty: number,
      tz: number,
      radius: number,
      colorHex: string,
      deferImpact = false,
    ) {
      const group = new THREE.Group();
      const materials: THREE.Material[] = [];

      if (type === 'meteor_strike') {
        const rockMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          flatShading: true,
          roughness: 0.78,
          metalness: 0.15,
          emissive: new THREE.Color(0xff4500),
          emissiveIntensity: 0.42,
        });
        const coreGlowMat = new THREE.MeshBasicMaterial({
          color: 0xff7b00,
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
        });
        const domeMat = new THREE.MeshBasicMaterial({
          color: 0xff5400,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xffaa00,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const outerRingMat = new THREE.MeshBasicMaterial({
          color: 0xff2a00,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const innerDomeMat = new THREE.MeshBasicMaterial({
          color: 0xfff3b0,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const shockWallMat = new THREE.MeshBasicMaterial({
          color: 0xff922b,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(
          rockMat,
          coreGlowMat,
          domeMat,
          ringMat,
          outerRingMat,
          innerDomeMat,
          shockWallMat,
        );

        const meteorGroup = new THREE.Group();
        const meteorRockCore = new THREE.Group();
        const meteorRock = new THREE.Mesh(sharedMeteorGeo, rockMat);
        // Protruding rocky sub-boulders embedded into the main asteroid body for an unmistakable irregular silhouette
        const lobeOffsets = [
          { x: 0.95, y: 0.35, z: -0.45, s: 0.48, rx: 0.5, ry: 1.1 },
          { x: -0.88, y: -0.42, z: 0.52, s: 0.52, rx: 1.4, ry: 0.3 },
          { x: 0.25, y: 0.78, z: 0.72, s: 0.42, rx: 2.1, ry: 0.8 },
          { x: -0.45, y: -0.68, z: -0.65, s: 0.45, rx: 0.9, ry: 1.9 },
        ];
        for (const lb of lobeOffsets) {
          const lobe = new THREE.Mesh(sharedMeteorGeo, rockMat);
          lobe.position.set(lb.x, lb.y, lb.z);
          lobe.scale.setScalar(lb.s);
          lobe.rotation.set(lb.rx, lb.ry, 0.4);
          meteorRockCore.add(lobe);
        }
        meteorRockCore.add(meteorRock);

        const meteorAura = new THREE.Mesh(sharedMeteorAuraGeo, coreGlowMat);
        meteorGroup.add(meteorRockCore, meteorAura);
        meteorGroup.position.set(tx + 15.5, ty + 34, tz - 15.5);
        group.add(meteorGroup);

        const innerDomeMesh = new THREE.Mesh(sharedExplosionDomeGeo, innerDomeMat);
        innerDomeMesh.position.set(tx, ty + 0.05, tz);
        innerDomeMesh.scale.setScalar(0.2);
        innerDomeMesh.visible = false;
        group.add(innerDomeMesh);

        const explosionDome = new THREE.Mesh(sharedExplosionDomeGeo, domeMat);
        explosionDome.position.set(tx, ty + 0.05, tz);
        explosionDome.scale.setScalar(0.2);
        explosionDome.visible = false;
        group.add(explosionDome);

        const shockWallMesh = new THREE.Mesh(sharedDomeCylinderGeo, shockWallMat);
        shockWallMesh.position.set(tx, ty + 0.05, tz);
        shockWallMesh.scale.set(0.3, 0.5, 0.3);
        shockWallMesh.visible = false;
        group.add(shockWallMesh);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
        ringMesh.position.set(tx, ty + 0.12, tz);
        ringMesh.scale.setScalar(radius * 0.95);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, outerRingMat);
        outerRingMesh.position.set(tx, ty + 0.16, tz);
        outerRingMesh.scale.setScalar(radius * 1.45);
        group.add(outerRingMesh);

        // 12 erupting magma debris pillars around the crater rim
        const spikes: THREE.Mesh[] = [];
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const sp = new THREE.Mesh(sharedPillarSpikeGeo, i % 2 === 0 ? rockMat : coreGlowMat);
          sp.position.set(tx + Math.cos(a) * (radius * 0.62), ty, tz + Math.sin(a) * (radius * 0.62));
          sp.rotation.z = Math.cos(a) * -0.42;
          sp.rotation.x = Math.sin(a) * 0.42;
          sp.scale.set(1, 0.01, 1);
          sp.visible = false;
          group.add(sp);
          spikes.push(sp);
        }

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'meteor',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 2.95,
          impactDelay: 1.15,
          deferImpact,
          tx,
          ty,
          tz,
          radius,
          impactFired: false,
          meteorMesh: meteorGroup,
          meteorRockCore,
          explosionDome,
          innerDomeMesh,
          shockWallMesh,
          ringMesh,
          outerRingMesh,
          spikes,
          colorHex,
        });
        return;
      }

      if (type === 'lightning_smite') {
        triggerLightFlash(tx, ty + 10, tz, '#90e0ef', 8);
        const boltMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 1,
        });
        const arcMat = new THREE.MeshBasicMaterial({
          color: 0x48bfe3,
          transparent: true,
          opacity: 0.95,
        });
        const domeMat = new THREE.MeshBasicMaterial({
          color: 0x90e0ef,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xe0fbfc,
          transparent: true,
          opacity: 1.0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(boltMat, arcMat, domeMat, ringMat);

        // Main sky-to-ground trunk bolt segments (revealed top-to-bottom as bolt descends)
        const mainSegments = [
          { x: 0.4, y: 16.5, z: -0.3, rz: 0.18, rx: -0.1, scale: 1.2 },
          { x: -0.35, y: 11.2, z: 0.25, rz: -0.24, rx: 0.14, scale: 1.15 },
          { x: 0.25, y: 6.2, z: -0.15, rz: 0.2, rx: -0.12, scale: 1.1 },
          { x: 0, y: 2.2, z: 0, rz: -0.1, rx: 0.05, scale: 1.25 },
        ];
        const boltSegments: THREE.Mesh[] = [];
        for (const s of mainSegments) {
          const seg = new THREE.Mesh(sharedBoltGeo, boltMat);
          seg.position.set(tx + s.x, ty + s.y, tz + s.z);
          seg.rotation.set(s.rx, 0, s.rz);
          seg.scale.set(s.scale, 1, s.scale);
          seg.visible = false;
          group.add(seg);
          boltSegments.push(seg);
        }

        const forkMeshes: THREE.Mesh[] = [];
        for (let f = 0; f < 4; f++) {
          const fa = (f / 4) * Math.PI * 2 + 0.4;
          const fr = radius * 0.48;
          const fork = new THREE.Mesh(sharedBoltGeo, arcMat);
          fork.position.set(tx + Math.cos(fa) * fr, ty + 3.2, tz + Math.sin(fa) * fr);
          fork.rotation.set(Math.sin(fa) * 0.42, 0, Math.cos(fa) * -0.42);
          fork.scale.set(0.65, 1.1, 0.65);
          fork.visible = false;
          group.add(fork);
          forkMeshes.push(fork);
        }

        const explosionDome = new THREE.Mesh(sharedExplosionDomeGeo, domeMat);
        explosionDome.position.set(tx, ty + 0.05, tz);
        explosionDome.scale.setScalar(0.3);
        explosionDome.visible = false;
        group.add(explosionDome);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
        ringMesh.position.set(tx, ty + 0.12, tz);
        ringMesh.scale.setScalar(radius * 0.6);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, arcMat);
        outerRingMesh.position.set(tx, ty + 0.16, tz);
        outerRingMesh.visible = false;
        group.add(outerRingMesh);

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'lightning',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 0.86,
          impactDelay: 0.22,
          deferImpact,
          tx,
          ty,
          tz,
          radius,
          impactFired: false,
          boltSegments,
          forkMeshes,
          explosionDome,
          ringMesh,
          outerRingMesh,
          colorHex,
        });
        return;
      }

      if (type === 'rain_of_plenty') {
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x4ea8de,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const outerRingMat = new THREE.MeshBasicMaterial({
          color: 0x72efdd,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(ringMat, outerRingMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
        ringMesh.position.set(tx, ty + 0.1, tz);
        ringMesh.scale.setScalar(radius * 0.92);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, outerRingMat);
        outerRingMesh.position.set(tx, ty + 0.14, tz);
        outerRingMesh.scale.setScalar(radius * 1.25);
        group.add(outerRingMesh);

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'rain_summon',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 1.5,
          impactDelay: 0.72,
          deferImpact,
          tx,
          ty,
          tz,
          radius,
          impactFired: false,
          ringMesh,
          outerRingMesh,
          colorHex,
        });
        return;
      }

      // All other powers: descending celestial/orbital beam -> ground touchdown -> shockwave rings & monolith spikes
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const outerRingMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const beamMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.58,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      materials.push(ringMat, outerRingMat, beamMat);

      const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
      ringMesh.position.set(tx, ty + 0.1, tz);
      ringMesh.scale.setScalar(radius * 0.75);
      group.add(ringMesh);

      const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, outerRingMat);
      outerRingMesh.position.set(tx, ty + 0.45, tz);
      outerRingMesh.visible = false;
      group.add(outerRingMesh);

      const beamMesh = new THREE.Mesh(sharedBeamGeo, beamMat);
      beamMesh.position.set(tx, ty + 14, tz);
      const beamWidth =
        type === 'golden_age' || type === 'terraform_beam' ? radius * 0.58 : radius * 0.42;
      beamMesh.scale.set(beamWidth * 0.35, 1.2, beamWidth * 0.35);
      group.add(beamMesh);

      // Erupting crystal/golden/crimson/necrotic pillars around the power zone
      const spikes: THREE.Mesh[] = [];
      const spikeCount = type === 'golden_age' || type === 'terraform_beam' ? 8 : 6;
      for (let i = 0; i < spikeCount; i++) {
        const a = (i / spikeCount) * Math.PI * 2;
        const dist = radius * 0.52;
        const sp = new THREE.Mesh(sharedPillarSpikeGeo, i % 2 === 0 ? ringMat : outerRingMat);
        sp.position.set(tx + Math.cos(a) * dist, ty, tz + Math.sin(a) * dist);
        sp.scale.set(0.85, 0.01, 0.85);
        sp.visible = false;
        group.add(sp);
        spikes.push(sp);
      }

      burstFxGroup.add(group);
      activeBurstFx.push({
        kind: 'beam_ring',
        powerType: type,
        group,
        materials,
        age: 0,
        duration: 1.2,
        impactDelay: 0.28,
        deferImpact,
        tx,
        ty,
        tz,
        radius,
        impactFired: false,
        ringMesh,
        outerRingMesh,
        beamMesh,
        spikes,
        colorHex,
      });
    }

    // Camera state
    const camTarget = new THREE.Vector3(gridCenter, 1.2, gridCenter);
    const camDesiredTarget = new THREE.Vector3(gridCenter, 1.2, gridCenter);
    let camYaw = Math.PI / 4; // 45 deg true isometric
    let camDesiredYaw = Math.PI / 4;
    let desiredFrustum = 14.5;
    let trauma = 0;
    let hitstopTimer = 0;

    // Input state
    const keysPressed = new Set<string>();
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let hoveredTileCoords: { x: number; z: number } | null = {
      x: Math.floor(gridCenter),
      z: Math.floor(gridCenter),
    };
    let isPointerDragging = false;
    let dragStartClient = { x: 0, y: 0 };
    let pointerDownMoved = false;

    const updateSize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      const pxScale = Math.max(1, propsRef.current.pixelScale || 2);
      const rw = Math.max(160, Math.floor(w / pxScale));
      const rh = Math.max(100, Math.floor(h / pxScale));

      renderer.setSize(rw, rh, false);
      const newAspect = w / h;
      camera.left = (-frustumSize * newAspect) / 2;
      camera.right = (frustumSize * newAspect) / 2;
      camera.top = frustumSize / 2;
      camera.bottom = -frustumSize / 2;
      camera.updateProjectionMatrix();
    };

    updateSize();
    const resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(container);

    const updateHoverTile = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(terrainInstancedList, false);
      if (hits.length > 0 && hits[0].instanceId !== undefined) {
        const hitInst = hits[0].object as THREE.InstancedMesh;
        const tileIndex = terrainInstanceToTile.get(hitInst)?.[hits[0].instanceId];
        if (tileIndex !== undefined) {
          const tile = simRef.current.tiles[tileIndex];
          if (tile && (!hoveredTileCoords || hoveredTileCoords.x !== tile.x || hoveredTileCoords.z !== tile.z)) {
            hoveredTileCoords = { x: tile.x, z: tile.z };
            propsRef.current.onHoverTileChange(hoveredTileCoords);
          }
        }
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 2 || e.button === 1 || e.shiftKey) {
        isPointerDragging = true;
        dragStartClient = { x: e.clientX, y: e.clientY };
        pointerDownMoved = false;
        return;
      }
      isPointerDragging = false;
      dragStartClient = { x: e.clientX, y: e.clientY };
      pointerDownMoved = false;
      updateHoverTile(e.clientX, e.clientY);
    };

    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragStartClient.x;
      const dy = e.clientY - dragStartClient.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) {
        pointerDownMoved = true;
      }

      if (isPointerDragging || (e.buttons === 1 && e.altKey)) {
        const panFactor = frustumSize * 0.0022;
        const forwardX = Math.sin(camYaw);
        const forwardZ = Math.cos(camYaw);
        const rightX = Math.cos(camYaw);
        const rightZ = -Math.sin(camYaw);

        camDesiredTarget.x -= (dx * rightX + dy * forwardX) * panFactor;
        camDesiredTarget.z -= (dx * rightZ + dy * forwardZ) * panFactor;
        camDesiredTarget.x = THREE.MathUtils.clamp(camDesiredTarget.x, 2, sim.gridSize - 3);
        camDesiredTarget.z = THREE.MathUtils.clamp(camDesiredTarget.z, 2, sim.gridSize - 3);
        dragStartClient = { x: e.clientX, y: e.clientY };
        return;
      }

      updateHoverTile(e.clientX, e.clientY);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isPointerDragging) {
        isPointerDragging = false;
        return;
      }
      if (!pointerDownMoved && e.button === 0 && propsRef.current.gameState === 'playing') {
        updateHoverTile(e.clientX, e.clientY);
        if (hoveredTileCoords) {
          propsRef.current.onTileInteract(hoveredTileCoords.x, hoveredTileCoords.z);
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      desiredFrustum = THREE.MathUtils.clamp(desiredFrustum + e.deltaY * 0.015, 7.5, 64);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keysPressed.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.code);
    };

    const clearInputs = () => {
      keysPressed.clear();
      isPointerDragging = false;
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    domElem.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domElem.addEventListener('wheel', onWheel, { passive: false });
    domElem.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pre-allocate scratch math objects outside the animation loop (Zero-GC)
    const _dummyMatrix = new THREE.Matrix4();
    const _dummyPos = new THREE.Vector3();
    const _dummyQuat = new THREE.Quaternion();
    const _dummyScale = new THREE.Vector3();
    const _bgColor = new THREE.Color();

    let lastTime = performance.now();
    let hudSyncAccumulator = 0;
    let elapsedTotal = 0;
    let lastAppliedPixelScale = propsRef.current.pixelScale;
    let frameId = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const _propAxisY = new THREE.Vector3(0, 1, 0);
    const _propQuat = new THREE.Quaternion();
    const _propScale = new THREE.Vector3(1, 1, 1);
    let lastSyncedSim: SimulationState = sim;

    function syncSceneFromSimulation(simState: SimulationState, dt: number, elapsed: number) {
      let propsNeedSync = false;

      let waterMapNeedsSync = simState !== lastSyncedSim;
        if (simState !== lastSyncedSim) {
        lastSyncedSim = simState;
        propsNeedSync = true;
        for (let i = 0; i < simState.tiles.length; i++) {
          const t = simState.tiles[i];
          tileCurrentY[i] = t.height === 0 ? 0.12 : t.height * HEIGHT_STEP + 0.25;
          tileLastNodeY[i] = -999;
          tilePropSig[i] = -1;
        }
        const newCenter = (simState.gridSize - 1) / 2;
        camDesiredTarget.set(newCenter, 1.2, newCenter);
        camTarget.set(newCenter, 1.2, newCenter);
      }

      // 1. Update instanced terrain tiles & detect if props/nodes/water-map need rebuild
      for (const tType of TERRAIN_TYPES) {
        const inst = terrainInstancedMap.get(tType)!;
        inst.count = 0;
      }

      for (let i = 0; i < simState.tiles.length; i++) {
        const t = simState.tiles[i];
        // Water base boxes sit cleanly submerged under the animated shader ocean surface so boxes provide
        // raycast targets & world edges without Z-fighting through animated wave troughs
        const targetTopY = t.height === 0 ? 0.12 : t.height * HEIGHT_STEP + 0.25;
        const curY =
          Math.abs(tileCurrentY[i] - targetTopY) > 0.001
            ? THREE.MathUtils.damp(tileCurrentY[i], targetTopY, 12, dt)
            : targetTopY;
        tileCurrentY[i] = curY;

        const inst = terrainInstancedMap.get(t.terrain) ?? terrainInstancedMap.get('grass')!;
        const slot = inst.count;
        inst.count = slot + 1;
        terrainInstanceToTile.get(inst)![slot] = i;

        _dummyPos.set(t.x, curY, t.z);
        _dummyScale.set(1, curY + 0.6, 1);
        _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
        inst.setMatrixAt(slot, _dummyMatrix);

        if (t.height > 0) {
          const sig =
            (t.height << 12) |
            ((TERRAIN_CODE[t.terrain] ?? 3) << 6) |
            ((NODE_CODE[t.resourceNode] ?? 0) << 1) |
            (t.buildingId ? 1 : 0);
          if (tilePropSig[i] !== sig || Math.abs(curY - tileLastNodeY[i]) > 0.002) {
            if (tilePropSig[i] <= 0) waterMapNeedsSync = true;
            tilePropSig[i] = sig;
            tileLastNodeY[i] = curY;
            propsNeedSync = true;
          }
        } else {
          const waterSig = t.terrain === 'deep_water' ? -2 : -3;
          if (tilePropSig[i] !== waterSig) {
            tilePropSig[i] = waterSig;
            propsNeedSync = true;
            waterMapNeedsSync = true;
          }
        }
      }

      if (waterMapNeedsSync) {
        oceanFoam.updateMap(simState.tiles);
      }
      if (propsNeedSync || waterMapNeedsSync) {
        styledTerrain.updateMap(simState.tiles);
      }

      for (const inst of terrainInstancedList) {
        if (inst.count > 0) {
          inst.instanceMatrix.needsUpdate = true;
        }
      }

      if (propsNeedSync) {
        for (const pInst of allPropInsts) pInst.count = 0;

        for (let i = 0; i < simState.tiles.length; i++) {
          const t = simState.tiles[i];
          if (t.height <= 0 || t.buildingId) continue;

          const curY = tileCurrentY[i];
          // Deterministic spatial hash so clusters & rotations are rich and never flicker
          const h = Math.abs(((t.x * 73856093) ^ (t.z * 19349663) ^ (simState.seed * 2654435761)) | 0);
          const rotStep = (h >> 2) & 3;
          _propQuat.setFromAxisAngle(_propAxisY, rotStep * (Math.PI / 2));
          _dummyPos.set(t.x, curY, t.z);
          _dummyMatrix.compose(_dummyPos, _propQuat, _propScale);

          let targetInst: THREE.InstancedMesh | null = null;
          if (t.resourceNode === 'timber_grove') {
            targetInst = timberInsts[h % timberInsts.length];
          } else if (t.resourceNode === 'berry_bush') {
            targetInst = berryInsts[h % berryInsts.length];
          } else if (t.resourceNode === 'stone_outcrop') {
            targetInst = stoneInsts[h % stoneInsts.length];
          } else if (t.resourceNode === 'ore_vein') {
            targetInst = oreInsts[h % oreInsts.length];
          } else if (t.resourceNode === 'crystal_monolith') {
            targetInst = crystalInsts[h % crystalInsts.length];
          } else {
            // Ambient multi-object sub-tile details on open land for lively biome density
            const chance = (h >> 4) % 100;
            if ((t.terrain === 'grass' || t.terrain === 'fertile') && chance < 48) {
              targetInst = ambGrassInsts[h % ambGrassInsts.length];
            } else if (t.terrain === 'forest' && chance < 60) {
              targetInst = ambForestInsts[h % ambForestInsts.length];
            } else if (t.terrain === 'sand' && chance < 44) {
              targetInst = ambSandInsts[h % ambSandInsts.length];
            } else if (t.terrain === 'rock' && chance < 45) {
              targetInst = ambRockInsts[h % ambRockInsts.length];
            } else if (t.terrain === 'snow' && chance < 42) {
              targetInst = ambSnowInsts[h % ambSnowInsts.length];
            } else if (t.terrain === 'savanna' && chance < 50) {
              targetInst = ambSavannaInsts[h % ambSavannaInsts.length];
            } else if (t.terrain === 'swamp' && chance < 55) {
              targetInst = ambSwampInsts[h % ambSwampInsts.length];
            } else if (t.terrain === 'highland' && chance < 48) {
              targetInst = ambHighlandInsts[h % ambHighlandInsts.length];
            }
          }

          if (targetInst && targetInst.count < targetInst.instanceMatrix.count) {
            const pSlot = targetInst.count;
            targetInst.count = pSlot + 1;
            targetInst.setMatrixAt(pSlot, _dummyMatrix);
          }
        }

        for (const pInst of allPropInsts) {
          pInst.instanceMatrix.needsUpdate = true;
        }
      }

      // 2. Sync buildings
      const activeBldIds = new Set<string>();
      for (const b of simState.buildings) {
        activeBldIds.add(b.id);
        const tile = simState.tiles[b.tileZ * simState.gridSize + b.tileX];
        const groundY = tile ? Math.max(0.18, tile.height * HEIGHT_STEP + 0.25) : 1.0;

        let entry = buildingMeshes.get(b.id);
        if (!entry || entry.epochLevel !== b.epochLevel || entry.type !== b.type) {
          if (entry) buildingsGroup.remove(entry.group);
          const group = createBuildingGroup(b.type, b.epochLevel);
          group.position.set(b.tileX, groundY, b.tileZ);
          buildingsGroup.add(group);
          entry = { group, epochLevel: b.epochLevel, type: b.type };
          buildingMeshes.set(b.id, entry);
        }

        entry.group.position.set(b.tileX, groundY, b.tileZ);
        const buildScaleY =
          b.constructionProgress < 100 ? 0.22 + 0.78 * (b.constructionProgress / 100) : 1;
        entry.group.scale.y = buildScaleY;

        // Animate flickering flames or rotating dynamo/cyber/dyson rings
        for (const child of entry.group.children) {
          if (child.name === 'flicker_flame') {
            const s = 0.92 + Math.sin(elapsed * 14 + b.tileX) * 0.14;
            child.scale.set(s, 0.9 + Math.cos(elapsed * 18) * 0.18, s);
          } else if (child.name === 'spin_part') {
            child.rotation.y += dt * 1.8;
          }
        }
      }

      if (simState.buildings.length > 0) {
        const primary = simState.buildings[0];
        const pt = simState.tiles[primary.tileZ * simState.gridSize + primary.tileX];
        hearthLight.position.set(
          primary.tileX,
          (pt ? Math.max(0.18, pt.height * HEIGHT_STEP + 0.25) : 1.0) + 1.8,
          primary.tileZ,
        );
      } else {
        hearthLight.position.set(gridCenter, 3.0, gridCenter);
      }

      for (const [id, entry] of buildingMeshes.entries()) {
        if (!activeBldIds.has(id)) {
          buildingsGroup.remove(entry.group);
          buildingMeshes.delete(id);
        }
      }

      // 3. Sync units with gait bob, work chop animation, carried resources, species, and epoch gear
      const activeUnitIds = new Set<string>();
      for (const u of simState.units) {
        activeUnitIds.add(u.id);
        let uEntry = unitMeshes.get(u.id);
        const desiredEpoch = u.faction === 'civilization' ? simState.epochIndex : 0;
        const unitSpecies = u.species ?? 'human';
        if (
          !uEntry ||
          uEntry.epochLevel !== desiredEpoch ||
          uEntry.role !== u.role ||
          uEntry.species !== unitSpecies
        ) {
          if (uEntry) unitsGroup.remove(uEntry.group);
          const group = createUnitGroup(u.role, u.faction, desiredEpoch, unitSpecies);
          unitsGroup.add(group);
          uEntry = { group, epochLevel: desiredEpoch, role: u.role, species: unitSpecies };
          unitMeshes.set(u.id, uEntry);
        }
        const uGroup = uEntry.group;

        const tx = Math.round(THREE.MathUtils.clamp(u.x, 0, simState.gridSize - 1));
        const tz = Math.round(THREE.MathUtils.clamp(u.z, 0, simState.gridSize - 1));
        const tile = simState.tiles[tz * simState.gridSize + tx];
        const groundY = tile ? Math.max(0.18, tile.height * HEIGHT_STEP + 0.25) : 0.5;

        const isMoving = u.state === 'moving';
        const isWorking =
          u.state === 'gathering' || u.state === 'building' || u.state === 'fighting';
        const walkBob = isMoving
          ? Math.abs(Math.sin(elapsed * 11 + u.x * 3)) * 0.08
          : isWorking
            ? Math.abs(Math.sin(elapsed * 14 + u.z * 2)) * 0.04
            : 0;
        uGroup.position.set(u.x, groundY + walkBob, u.z);

        // Face movement/target direction
        const dx = u.targetX - u.x;
        const dz = u.targetZ - u.z;
        if (dx * dx + dz * dz > 0.01) {
          uGroup.rotation.y = Math.atan2(dx, dz);
        }

        // KO topple, movement sway, & active chop/hammer nod
        if (u.state === 'ko') {
          uGroup.rotation.z = THREE.MathUtils.damp(uGroup.rotation.z, Math.PI / 2, 12, dt);
          uGroup.rotation.x = 0;
        } else {
          uGroup.rotation.z = isMoving ? Math.sin(elapsed * 11 + u.z * 2) * 0.08 : 0;
          uGroup.rotation.x = isWorking ? Math.sin(elapsed * 16 + u.x) * 0.22 : 0;
        }

        const heldTool = uGroup.getObjectByName('held_tool');
        if (heldTool) {
          heldTool.rotation.x = isWorking ? 0.45 + Math.sin(elapsed * 18) * 0.65 : 0.35;
        }

        const carryBox = uGroup.getObjectByName('carry_box') as THREE.Mesh | undefined;
        if (carryBox) {
          if (u.carryingAmount > 0 && u.carryingType) {
            carryBox.visible = true;
            const cMat = carryBox.material as THREE.MeshStandardMaterial;
            if (u.carryingType === 'wood') cMat.color.setHex(0x7d4e2d);
            else if (u.carryingType === 'food') cMat.color.setHex(0xd94e34);
            else if (u.carryingType === 'stone') cMat.color.setHex(0x8f8b82);
            else if (u.carryingType === 'ore') cMat.color.setHex(0xe08e36);
            else cMat.color.setHex(0x56cfe1);
          } else {
            carryBox.visible = false;
          }
        }

        // Status ring aura
        const statusRing = uGroup.getObjectByName('status_ring') as THREE.Mesh | undefined;
        if (statusRing) {
          const mat = statusRing.material as THREE.MeshBasicMaterial;
          if (u.statusEffects.blessed) {
            mat.color.setHex(0xf5b742);
            mat.opacity = 0.85;
          } else if (u.statusEffects.shielded) {
            mat.color.setHex(0x72efdd);
            mat.opacity = 0.85;
          } else if (u.statusEffects.frenzied) {
            mat.color.setHex(0xe63946);
            mat.opacity = 0.85;
          } else if (u.statusEffects.plagued) {
            mat.color.setHex(0x80ed99);
            mat.opacity = 0.85;
          } else if (u.statusEffects.cursed) {
            mat.color.setHex(0x9d4edd);
            mat.opacity = 0.85;
          } else {
            mat.opacity = 0.0;
          }
        }
      }

      for (const [id, uEntry] of unitMeshes.entries()) {
        if (!activeUnitIds.has(id)) {
          unitsGroup.remove(uEntry.group);
          unitMeshes.delete(id);
        }
      }

      // 4. Consume pending VFX bursts & trigger dramatic 3D power animations
      while (simState.pendingVfx.length > 0) {
        const vfx = simState.pendingVfx.shift()!;
        if (vfx.type === 'hit_spark' || vfx.type === 'build_complete') {
          spawnParticleBurst(vfx.x, vfx.y + 0.2, vfx.z, 20, vfx.color, vfx.radius * 0.5, 3.5, 0.9);
        } else {
          spawnPowerVisualEffect(
            vfx.type,
            vfx.x,
            vfx.y,
            vfx.z,
            vfx.radius,
            vfx.color,
            Boolean(vfx.deferImpact),
          );
        }
      }

      // 5. Sync lingering hazard zones (monsoon rain clouds, plague clouds, shield domes, cosmic rifts)
      const activeHazIds = new Set<string>();
      for (const haz of simState.activeHazards ?? []) {
        activeHazIds.add(haz.id);
        let hv = hazardMeshes.get(haz.id);
        if (!hv) {
          hv = createHazardVisual(haz.kind, haz.radius);
          hazardsGroup.add(hv.group);
          hazardMeshes.set(haz.id, hv);
        }
        const ht = getTileFromArray(simState, haz.x, haz.z);
        const targetHy = ht ? Math.max(0.25, ht.height * HEIGHT_STEP + 0.25) : 0.8;
        const hy =
          hv.currentY === undefined
            ? targetHy
            : THREE.MathUtils.damp(hv.currentY, targetHy, 8, dt);
        hv.currentY = hy;
        hv.group.position.set(haz.x, hy, haz.z);

        const fade = Math.min(1, haz.remaining / 1.35);
        if (hv.drops) {
          const speed = haz.currentSpeed ?? 0.55;
          const wx = haz.windX ?? 0.78;
          const wz = haz.windZ ?? 0.62;
          // Normalized wind-speed factor (0 during slow linger, up to 1 during fast arrival & fast expiration)
          const speedNorm = Math.min(1, Math.max(0, (speed - 0.6) / 16.0));

          if (hv.cloudBody) {
            const windYaw = Math.atan2(wz, wx);
            hv.cloudBody.rotation.y = -windYaw;
            // Aerodynamic stretch along wind axis when moving fast; gentle vertical billow when lingering slowly
            const stretchX = 1.0 + speedNorm * 0.36 + Math.sin(elapsed * 3.2) * 0.04 * (1 - speedNorm);
            const squashY = 1.0 - speedNorm * 0.14 + Math.cos(elapsed * 3.8) * 0.05 * (1 - speedNorm);
            hv.cloudBody.scale.set(stretchX, squashY, 1.0 - speedNorm * 0.08);
            hv.cloudBody.position.y = Math.sin(elapsed * 2.6) * 0.18 * (1 - speedNorm * 0.6);
          }

          for (const d of hv.drops) {
            const fallProgress = ((elapsed * (d.speed + speedNorm * 4.5) + d.offsetY) % 4.4) / 4.4;
            const dropY = 4.4 * (1 - fallProgress);
            // Raindrops slant backward against the wind when the cloud is racing fast
            const windLag = fallProgress * speedNorm * 1.65;
            d.mesh.position.set(d.baseX - wx * windLag, dropY, d.baseZ - wz * windLag);
            d.mesh.rotation.z = wx * speedNorm * 0.42;
            d.mesh.rotation.x = -wz * speedNorm * 0.42;
          }
          if (hv.ringMesh) {
            hv.ringMesh.scale.setScalar(
              haz.radius * (0.84 + Math.sin(elapsed * 5) * 0.08) * (1 - speedNorm * 0.22),
            );
          }
          const arriveAlpha =
            (haz.arrivalRemaining ?? 0) > 0
              ? Math.min(1, 0.35 + (1 - (haz.arrivalRemaining ?? 0) / (haz.arrivalDuration ?? 0.72)) * 0.65)
              : 1;
          for (const m of hv.materials) {
            if ('opacity' in m) (m as THREE.MeshBasicMaterial).opacity = 0.9 * fade * arriveAlpha;
          }
        } else if (hv.spores) {
          for (const sp of hv.spores) {
            const a = sp.angle + elapsed * 1.1;
            sp.mesh.position.set(
              Math.cos(a) * sp.dist,
              sp.height + Math.sin(elapsed * 3.2 + sp.phase) * 0.35,
              Math.sin(a) * sp.dist,
            );
            sp.mesh.rotation.y = elapsed * 1.5 + sp.phase;
          }
          if (hv.ringMesh) {
            hv.ringMesh.rotation.z = -elapsed * 0.8;
          }
          for (const m of hv.materials) {
            if ('opacity' in m) (m as THREE.MeshBasicMaterial).opacity = 0.72 * fade;
          }
        } else if (hv.kind === 'shield_dome') {
          if (hv.ringMesh) hv.ringMesh.rotation.z = elapsed * 0.9;
          if (hv.secondaryRingMesh) hv.secondaryRingMesh.rotation.y = -elapsed * 0.6;
          (hv.materials[0] as THREE.MeshBasicMaterial).opacity =
            (0.26 + Math.sin(elapsed * 5) * 0.06) * fade;
        } else if (hv.kind === 'wormhole_rift') {
          if (hv.ringMesh) {
            hv.ringMesh.rotation.z = elapsed * 4.2;
            hv.ringMesh.rotation.y = elapsed * 1.8;
          }
          if (hv.secondaryRingMesh) {
            hv.secondaryRingMesh.rotation.x = elapsed * 3.1;
            hv.secondaryRingMesh.rotation.z = -elapsed * 2.4;
          }
          const pulse = (0.95 + Math.sin(elapsed * 9) * 0.14) * fade;
          hv.group.scale.setScalar(Math.max(0.05, pulse));
        }
      }
      for (const [id, hv] of hazardMeshes.entries()) {
        if (!activeHazIds.has(id)) {
          hazardsGroup.remove(hv.group);
          for (const m of hv.materials) m.dispose();
          hazardMeshes.delete(id);
        }
      }

      // 6. Sync active tile fire flames & smoke plumes (burning tiles, skipping ore_vein center so crater core is clear)
      let fireCount = 0;
      for (let i = 0; i < simState.tiles.length && fireCount < MAX_FIRE_TILES; i++) {
        const t = simState.tiles[i];
        if (t.onFireTimer > 0 && t.height > 0 && t.resourceNode !== 'ore_vein') {
          const fy = tileCurrentY[i] || t.height * HEIGHT_STEP + 0.25;
          const flick = 0.85 + Math.sin(elapsed * 22 + t.x * 3 + t.z * 7) * 0.3;
          const w = 0.88 + Math.cos(elapsed * 17 + t.x) * 0.15;
          _dummyPos.set(t.x, fy, t.z);
          _dummyScale.set(w, flick, w);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          fireOuterInst.setMatrixAt(fireCount, _dummyMatrix);

          _dummyScale.set(w * 0.76, flick * 1.1, w * 0.76);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          fireCoreInst.setMatrixAt(fireCount, _dummyMatrix);

          // Rising animated smoke puff above each burning tile
          const smokeCycle = (elapsed * 1.8 + (t.x * 0.37 + t.z * 0.53)) % 1.0;
          const smokeY = fy + 0.65 + smokeCycle * 1.9;
          const smokeScale = (0.45 + smokeCycle * 0.7) * (1 - smokeCycle * 0.45);
          _dummyPos.set(
            t.x + Math.sin(elapsed * 3 + t.z) * 0.16,
            smokeY,
            t.z + Math.cos(elapsed * 3 + t.x) * 0.16,
          );
          _dummyScale.setScalar(smokeScale);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          fireSmokeInst.setMatrixAt(fireCount, _dummyMatrix);

          fireCount++;
        }
      }
      fireOuterInst.count = fireCount;
      fireCoreInst.count = fireCount;
      fireSmokeInst.count = fireCount;
      if (fireCount > 0) {
        fireOuterInst.instanceMatrix.needsUpdate = true;
        fireCoreInst.instanceMatrix.needsUpdate = true;
        fireSmokeInst.instanceMatrix.needsUpdate = true;
      }
    }

    function getTileFromArray(simState: SimulationState, x: number, z: number) {
      const ix = Math.round(x);
      const iz = Math.round(z);
      if (ix < 0 || iz < 0 || ix >= simState.gridSize || iz >= simState.gridSize) return undefined;
      return simState.tiles[iz * simState.gridSize + ix];
    }

    function tick() {
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      elapsedTotal += dt;

      if (lastAppliedPixelScale !== propsRef.current.pixelScale) {
        lastAppliedPixelScale = propsRef.current.pixelScale;
        updateSize();
      }

      // Camera action requests from HUD buttons
      const camAct = cameraActionRef.current;
      if (camAct.rotateDelta !== 0) {
        camDesiredYaw += camAct.rotateDelta;
        camAct.rotateDelta = 0;
      }
      if (camAct.zoomDelta !== 0) {
        desiredFrustum = THREE.MathUtils.clamp(desiredFrustum + camAct.zoomDelta, 7.5, 64);
        camAct.zoomDelta = 0;
      }
      if (camAct.centerHome) {
        const anchor = getSettlementAnchor(simRef.current);
        camDesiredTarget.set(anchor.x, 1.2, anchor.z);
        desiredFrustum = 14.5;
        camAct.centerHome = false;
      }

      // Keyboard WASD / Arrow camera pan & Q/E rotate (scales with zoom for 128x128 navigation)
      const panSpeed = Math.max(12, frustumSize * 1.15) * dt;
      const forwardX = -Math.sin(camYaw);
      const forwardZ = -Math.cos(camYaw);
      const rightX = Math.cos(camYaw);
      const rightZ = -Math.sin(camYaw);

      if (keysPressed.has('KeyW') || keysPressed.has('ArrowUp')) {
        camDesiredTarget.x += forwardX * panSpeed;
        camDesiredTarget.z += forwardZ * panSpeed;
      }
      if (keysPressed.has('KeyS') || keysPressed.has('ArrowDown')) {
        camDesiredTarget.x -= forwardX * panSpeed;
        camDesiredTarget.z -= forwardZ * panSpeed;
      }
      if (keysPressed.has('KeyA') || keysPressed.has('ArrowLeft')) {
        camDesiredTarget.x -= rightX * panSpeed;
        camDesiredTarget.z -= rightZ * panSpeed;
      }
      if (keysPressed.has('KeyD') || keysPressed.has('ArrowRight')) {
        camDesiredTarget.x += rightX * panSpeed;
        camDesiredTarget.z += rightZ * panSpeed;
      }
      camDesiredTarget.x = THREE.MathUtils.clamp(camDesiredTarget.x, 2, sim.gridSize - 3);
      camDesiredTarget.z = THREE.MathUtils.clamp(camDesiredTarget.z, 2, sim.gridSize - 3);

      // Advance simulation when in 'playing' (or gentle ambient motion in 'title')
      if (hitstopTimer > 0) {
        hitstopTimer = Math.max(0, hitstopTimer - dt);
      } else if (propsRef.current.gameState === 'playing' && propsRef.current.timeScale > 0) {
        stepSimulation(simRef.current, dt * propsRef.current.timeScale);
      } else if (propsRef.current.gameState === 'title') {
        // Live World Camera Tour on Title Screen
        camDesiredYaw += dt * 0.18;
        stepSimulation(simRef.current, dt * 0.35);
      }

      // Update animated one-shot power VFX BEFORE syncSceneFromSimulation so when a projectile/bolt/beam
      // impacts the ground (`!fx.impactFired`), `executeGodPowerImpact` mutates the tiles and
      // `syncSceneFromSimulation` immediately updates the 3D terrain & shader texture in the exact same frame!
      for (let i = activeBurstFx.length - 1; i >= 0; i--) {
        const fx = activeBurstFx[i];
        fx.age += dt;

        if (fx.kind === 'meteor' && fx.meteorMesh && fx.ringMesh) {
          const dropPhase = Math.min(1, fx.age / fx.impactDelay);
          if (dropPhase < 1) {
            const easeIn = Math.pow(dropPhase, 1.65);
            const mx = fx.tx + 15.5 * (1 - easeIn);
            const my = fx.ty + 34 * (1 - easeIn) + 0.4;
            const mz = fx.tz - 15.5 * (1 - easeIn);
            fx.meteorMesh.position.set(mx, my, mz);
            if (fx.meteorRockCore) {
              fx.meteorRockCore.rotation.x += dt * 5.8;
              fx.meteorRockCore.rotation.y += dt * 4.4;
              fx.meteorRockCore.rotation.z += dt * 3.2;
            }
            (fx.materials[0] as THREE.MeshStandardMaterial).emissiveIntensity = 0.38 + easeIn * 0.65;
            // Dynamic atmospheric entry light following the falling asteroid
            vfxFlashLight.position.set(mx, Math.max(fx.ty + 3, my), mz);
            vfxFlashLight.color.set('#ff7b00');
            vfxFlashLight.intensity = 9 + easeIn * 18;
            // Dual contracting target lock rings on the ground before impact
            fx.ringMesh.scale.setScalar(fx.radius * (1.05 - dropPhase * 0.72));
            (fx.materials[3] as THREE.MeshBasicMaterial).opacity = 0.35 + dropPhase * 0.6;
            if (fx.outerRingMesh) {
              fx.outerRingMesh.scale.setScalar(fx.radius * (1.55 - easeIn * 1.15));
              (fx.materials[4] as THREE.MeshBasicMaterial).opacity = 0.25 + dropPhase * 0.65;
            }
            // Thick blazing comet trail + dark re-entry smoke
            spawnParticleBurst(mx, my, mz, 6, '#ff5400', 1.1, 2.0, 1.5);
            spawnParticleBurst(mx, my, mz, 4, '#ffee55', 0.6, 1.4, 1.2);
            spawnParticleBurst(mx + 0.6, my + 0.9, mz - 0.6, 3, '#2b2d42', 1.2, 1.2, 1.65);
          } else {
            if (!fx.impactFired) {
              fx.impactFired = true;
              if (fx.deferImpact) {
                executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz);
                soundEngine.playHeavyImpact();
              }
              fx.meteorMesh.visible = false;
              if (fx.innerDomeMesh) fx.innerDomeMesh.visible = true;
              if (fx.explosionDome) fx.explosionDome.visible = true;
              if (fx.shockWallMesh) fx.shockWallMesh.visible = true;
              if (fx.outerRingMesh) fx.outerRingMesh.visible = true;
              trauma = 1.0;
              hitstopTimer = 0.1;
              triggerLightFlash(fx.tx, fx.ty + 2, fx.tz, '#ffaa00', 42);
              // Colossal lava, spark & pyroclastic ash eruption
              spawnParticleBurst(fx.tx, fx.ty + 0.5, fx.tz, 120, '#ff5400', fx.radius * 1.45, 11.5, 1.85);
              spawnParticleBurst(fx.tx, fx.ty + 0.6, fx.tz, 60, '#ffee55', fx.radius * 0.95, 13.5, 1.45);
              spawnParticleBurst(fx.tx, fx.ty + 0.8, fx.tz, 45, '#2b2d42', fx.radius * 0.75, 8.5, 2.1);
              if (fx.spikes) {
                for (const sp of fx.spikes) sp.visible = true;
              }
            }
            const wavePhase = Math.min(1, (fx.age - fx.impactDelay) / (fx.duration - fx.impactDelay));
            const easeOut = 1 - Math.pow(1 - wavePhase, 2.4);
            if (fx.innerDomeMesh && fx.materials[5]) {
              const innerPhase = Math.min(1, wavePhase * 1.5);
              fx.innerDomeMesh.scale.setScalar(0.8 + (1 - (1 - innerPhase) * (1 - innerPhase)) * fx.radius * 1.05);
              (fx.materials[5] as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - innerPhase) * 0.95);
            }
            if (fx.explosionDome) {
              fx.explosionDome.scale.setScalar(0.8 + easeOut * fx.radius * 1.55);
              (fx.materials[2] as THREE.MeshBasicMaterial).opacity = Math.pow(1 - wavePhase, 1.3) * 0.92;
            }
            if (fx.shockWallMesh && fx.materials[6]) {
              const wallRadius = 0.8 + easeOut * fx.radius * 2.45;
              const wallHeight = 0.6 + Math.sin(wavePhase * Math.PI) * 1.85;
              fx.shockWallMesh.scale.set(wallRadius, wallHeight, wallRadius);
              (fx.materials[6] as THREE.MeshBasicMaterial).opacity = Math.pow(1 - wavePhase, 1.5) * 0.65;
            }
            // Huge primary & secondary concentric shockwaves sweeping across the map
            fx.ringMesh.scale.setScalar(0.8 + easeOut * fx.radius * 2.85);
            (fx.materials[3] as THREE.MeshBasicMaterial).opacity = Math.pow(1 - wavePhase, 1.2) * 0.98;
            if (fx.outerRingMesh) {
              fx.outerRingMesh.scale.setScalar(0.5 + wavePhase * fx.radius * 3.5);
              (fx.materials[4] as THREE.MeshBasicMaterial).opacity = Math.pow(1 - wavePhase, 1.1) * 0.9;
            }
            if (fx.spikes) {
              const spikeH = Math.sin(wavePhase * Math.PI) * 2.35;
              for (const sp of fx.spikes) {
                sp.scale.set(1.25, Math.max(0.05, spikeH), 1.25);
              }
            }
          }
        } else if (fx.kind === 'lightning' && fx.ringMesh) {
          const strikePhase = Math.min(1, fx.age / fx.impactDelay);
          if (strikePhase < 1) {
            // Reveal sky-to-ground bolt segments sequentially from top to ground
            if (fx.boltSegments) {
              const visibleCount = Math.max(1, Math.ceil(strikePhase * fx.boltSegments.length));
              for (let sIdx = 0; sIdx < fx.boltSegments.length; sIdx++) {
                fx.boltSegments[sIdx].visible = sIdx < visibleCount;
              }
            }
            fx.ringMesh.scale.setScalar(fx.radius * (0.65 - strikePhase * 0.4));
            (fx.materials[3] as THREE.MeshBasicMaterial).opacity = 0.4 + strikePhase * 0.5;
          } else {
            if (!fx.impactFired) {
              fx.impactFired = true;
              if (fx.deferImpact) {
                executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz);
                soundEngine.playHeavyImpact();
              }
              if (fx.boltSegments) {
                for (const seg of fx.boltSegments) seg.visible = true;
              }
              if (fx.forkMeshes) {
                for (const fk of fx.forkMeshes) fk.visible = true;
              }
              if (fx.explosionDome) fx.explosionDome.visible = true;
              if (fx.outerRingMesh) fx.outerRingMesh.visible = true;
              trauma = Math.min(1.0, trauma + 0.85);
              hitstopTimer = 0.06;
              triggerLightFlash(fx.tx, fx.ty, fx.tz, '#90e0ef', 25);
              spawnParticleBurst(fx.tx, fx.ty + 0.35, fx.tz, 65, '#48bfe3', fx.radius * 0.85, 6.8, 1.35);
              spawnParticleBurst(fx.tx, fx.ty + 0.25, fx.tz, 30, '#ffffff', fx.radius * 0.45, 8.2, 1.15);
            }
            const wavePhase = Math.min(1, (fx.age - fx.impactDelay) / (fx.duration - fx.impactDelay));
            const easeOut = 1 - (1 - wavePhase) * (1 - wavePhase);
            fx.ringMesh.scale.setScalar(0.6 + easeOut * fx.radius * 1.45);
            if (fx.outerRingMesh) {
              fx.outerRingMesh.scale.setScalar(0.3 + wavePhase * fx.radius * 1.85);
            }
            if (fx.explosionDome) {
              fx.explosionDome.scale.setScalar(0.8 + easeOut * fx.radius * 0.85);
            }
            // Rapid high-voltage strobe flash
            const strobe =
              wavePhase < 0.45
                ? Math.floor(fx.age * 45) % 2 === 0
                  ? 1.0
                  : 0.65
                : 1 - (wavePhase - 0.45) / 0.55;
            for (const m of fx.materials) {
              (m as THREE.MeshBasicMaterial).opacity = Math.max(0, strobe);
            }
          }
        } else if (fx.kind === 'rain_summon' && fx.ringMesh) {
          const arrivalPhase = Math.min(1, fx.age / fx.impactDelay);
          // Keep the arriving rain_cloud locked to the 0.72s real-time fast swoop into (fx.tx, fx.tz)
          const arrivingCloud = simRef.current.activeHazards?.find(
            (h) =>
              h.kind === 'rain_cloud' &&
              h.impactPending &&
              Math.hypot((h.targetX ?? h.x) - fx.tx, (h.targetZ ?? h.z) - fx.tz) < 1.5,
          );
          if (arrivalPhase < 1) {
            if (arrivingCloud) {
              const arrDur = Math.max(0.1, arrivingCloud.arrivalDuration ?? 0.72);
              arrivingCloud.arrivalRemaining = Math.max(0.001, (1 - arrivalPhase) * arrDur);
              const wx = arrivingCloud.windX ?? 0.78;
              const wz = arrivingCloud.windZ ?? 0.62;
              const s = -1.5 - 17.0 * Math.pow(1 - arrivalPhase, 2.4);
              arrivingCloud.currentSpeed = Math.max(
                0.6,
                (17.0 * 2.4 * Math.pow(1 - arrivalPhase, 1.4)) / arrDur,
              );
              arrivingCloud.x = fx.tx + wx * s;
              arrivingCloud.z = fx.tz + wz * s;
            }
            // Contracting aqua summon rings on the ground where the rain was summoned
            fx.ringMesh.scale.setScalar(fx.radius * (0.95 - arrivalPhase * 0.52));
            (fx.materials[0] as THREE.MeshBasicMaterial).opacity = 0.35 + arrivalPhase * 0.55;
            if (fx.outerRingMesh) {
              fx.outerRingMesh.scale.setScalar(fx.radius * (1.3 - arrivalPhase * 0.65));
              (fx.materials[1] as THREE.MeshBasicMaterial).opacity = 0.25 + arrivalPhase * 0.55;
            }
          } else {
            if (!fx.impactFired) {
              fx.impactFired = true;
              if (fx.deferImpact) {
                executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz);
                soundEngine.playBlessing();
              }
              triggerLightFlash(fx.tx, fx.ty, fx.tz, '#72efdd', 14);
              spawnParticleBurst(fx.tx, fx.ty + 0.25, fx.tz, 45, '#4ea8de', fx.radius * 0.85, 4.8, 1.15);
              spawnParticleBurst(fx.tx, fx.ty + 0.2, fx.tz, 24, '#72efdd', fx.radius * 0.5, 5.4, 1.0);
            }
            const splashPhase = Math.min(1, (fx.age - fx.impactDelay) / (fx.duration - fx.impactDelay));
            const easeOut = 1 - (1 - splashPhase) * (1 - splashPhase);
            fx.ringMesh.scale.setScalar(0.45 + easeOut * fx.radius * 1.15);
            (fx.materials[0] as THREE.MeshBasicMaterial).opacity = (1 - splashPhase) * 0.85;
            if (fx.outerRingMesh) {
              fx.outerRingMesh.scale.setScalar(0.65 + splashPhase * fx.radius * 1.35);
              (fx.materials[1] as THREE.MeshBasicMaterial).opacity = (1 - splashPhase) * 0.75;
            }
          }
        } else if (fx.kind === 'beam_ring' && fx.ringMesh) {
          const descentPhase = Math.min(1, fx.age / fx.impactDelay);
          const baseBeamWidth =
            fx.powerType === 'golden_age' || fx.powerType === 'terraform_beam'
              ? fx.radius * 0.58
              : fx.radius * 0.42;
          if (descentPhase < 1) {
            // Beam descends from sky to ground before impact
            if (fx.beamMesh) {
              fx.beamMesh.position.y = fx.ty + 14 * (1 - descentPhase);
              const w = baseBeamWidth * (0.35 + descentPhase * 0.65);
              fx.beamMesh.scale.set(w, 1.2, w);
              fx.beamMesh.rotation.y += dt * 4.0;
            }
            fx.ringMesh.scale.setScalar(fx.radius * (0.8 - descentPhase * 0.45));
            (fx.materials[0] as THREE.MeshBasicMaterial).opacity = 0.45 + descentPhase * 0.45;
          } else {
            if (!fx.impactFired) {
              fx.impactFired = true;
              if (fx.deferImpact) {
                const isHeavyImpact = executeGodPowerImpact(
                  simRef.current,
                  fx.powerType as GodPowerType,
                  fx.tx,
                  fx.tz,
                );
                const pDef = GOD_POWERS.find((p) => p.type === fx.powerType);
                if (fx.powerType === 'terraform_beam' || fx.powerType === 'wormhole_ascension') {
                  soundEngine.playHeavyImpact();
                } else if (pDef?.category === 'Wrathful') {
                  soundEngine.playCurse();
                } else {
                  soundEngine.playBlessing();
                }
                if (isHeavyImpact) {
                  trauma = Math.min(1.0, trauma + 0.65);
                  hitstopTimer = 0.05;
                }
              }
              if (fx.beamMesh) fx.beamMesh.position.y = fx.ty;
              if (fx.outerRingMesh) fx.outerRingMesh.visible = true;
              if (fx.spikes) {
                for (const sp of fx.spikes) sp.visible = true;
              }
              triggerLightFlash(fx.tx, fx.ty, fx.tz, fx.colorHex, 18);
              spawnParticleBurst(fx.tx, fx.ty + 0.35, fx.tz, 60, fx.colorHex, fx.radius * 0.85, 6.2, 1.3);
              spawnParticleBurst(fx.tx, fx.ty + 0.25, fx.tz, 24, '#ffffff', fx.radius * 0.45, 7.2, 1.1);
            }
            const wavePhase = Math.min(1, (fx.age - fx.impactDelay) / (fx.duration - fx.impactDelay));
            const easeOut = 1 - (1 - wavePhase) * (1 - wavePhase);
            fx.ringMesh.scale.setScalar(0.5 + easeOut * fx.radius * 1.35);
            (fx.materials[0] as THREE.MeshBasicMaterial).opacity = (1 - wavePhase) * 0.95;
            if (fx.outerRingMesh) {
              fx.outerRingMesh.scale.setScalar(0.4 + wavePhase * fx.radius * 1.05);
              fx.outerRingMesh.position.y = fx.ty + 0.25 + wavePhase * 4.8;
              (fx.materials[1] as THREE.MeshBasicMaterial).opacity = (1 - wavePhase) * 0.88;
            }
            if (fx.beamMesh && fx.materials[2]) {
              fx.beamMesh.rotation.y += dt * 3.5;
              const pulseWidth = baseBeamWidth * (1.15 - wavePhase * 0.65);
              fx.beamMesh.scale.set(pulseWidth, 1.2, pulseWidth);
              (fx.materials[2] as THREE.MeshBasicMaterial).opacity = (1 - wavePhase) * 0.58;
            }
            if (fx.spikes) {
              const spikeH = Math.sin(wavePhase * Math.PI) * 1.65;
              for (const sp of fx.spikes) {
                sp.scale.set(0.95, Math.max(0.05, spikeH), 0.95);
                sp.rotation.y += dt * 2.5;
              }
            }
          }
        }

        if (fx.age >= fx.duration) {
          burstFxGroup.remove(fx.group);
          for (const m of fx.materials) m.dispose();
          activeBurstFx.splice(i, 1);
        }
      }

      syncSceneFromSimulation(simRef.current, dt, elapsedTotal);

      // Update pooled particles in-place
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particles[i];
        if (!p.active) {
          _dummyScale.setScalar(0);
          _dummyPos.set(0, -100, 0);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          particleInstanced.setMatrixAt(i, _dummyMatrix);
          continue;
        }
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          _dummyScale.setScalar(0);
          _dummyPos.set(0, -100, 0);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          particleInstanced.setMatrixAt(i, _dummyMatrix);
          continue;
        }
        p.vy -= 11.5 * dt; // Gravity
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y < 0.22 && p.vy < 0) {
          p.y = 0.22;
          p.vy = -p.vy * 0.42;
          p.vx *= 0.78;
          p.vz *= 0.78;
        }
        const ratio = p.life / p.maxLife;
        _dummyPos.set(p.x, Math.max(0.15, p.y), p.z);
        _dummyScale.setScalar(p.size * (0.35 + ratio * 0.65));
        _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
        particleInstanced.setMatrixAt(i, _dummyMatrix);
        particleInstanced.setColorAt(i, p.color);
      }
      particleInstanced.instanceMatrix.needsUpdate = true;
      if (particleInstanced.instanceColor) particleInstanced.instanceColor.needsUpdate = true;

      if (vfxFlashLight.intensity > 0.05) {
        vfxFlashLight.intensity = THREE.MathUtils.damp(vfxFlashLight.intensity, 0, 5.5, dt);
      } else {
        vfxFlashLight.intensity = 0;
      }

      // Update Hover Reticle position & radius
      if (hoveredTileCoords && propsRef.current.gameState === 'playing') {
        reticleGroup.visible = true;
        const ht =
          simRef.current.tiles[
            hoveredTileCoords.z * simRef.current.gridSize + hoveredTileCoords.x
          ];
        const hy = ht ? Math.max(0.18, ht.height * HEIGHT_STEP + 0.28) : 0.5;
        reticleGroup.position.set(hoveredTileCoords.x, hy, hoveredTileCoords.z);

        const tool = propsRef.current.activeTool;
        let radiusScale = 1.0;
        let hexColor = '#f5b742';
        if (tool.kind === 'power') {
          const pDef = GOD_POWERS.find((p) => p.type === tool.power);
          radiusScale = pDef ? pDef.radius * 1.65 : 2.5;
          hexColor = pDef ? pDef.color : '#f5b742';
        } else if (tool.kind === 'terrain') {
          radiusScale = (propsRef.current.brushRadius + 0.5) * 1.5;
          hexColor = '#56cfe1';
        } else if (tool.kind === 'build') {
          radiusScale = 1.15;
          hexColor = '#80ed99';
        }
        reticleMesh.scale.setScalar(radiusScale);
        reticleMat.color.set(hexColor);
      } else {
        reticleGroup.visible = false;
      }

      // Update lighting preset & epoch atmosphere
      const preset = propsRef.current.lightingPreset;
      const epochDef = EPOCHS[simRef.current.epochIndex] || EPOCHS[0];
      if (preset === 'night') {
        _bgColor.set('#0e151a');
        keyLight.color.setHex(0x6c8ead);
        keyLight.intensity = 0.75;
        hearthLight.intensity = 3.6 + Math.sin(elapsedTotal * 12) * 0.4;
      } else if (preset === 'dusk') {
        _bgColor.set('#221c24');
        keyLight.color.setHex(0xf48c42);
        keyLight.intensity = 1.65;
        hearthLight.intensity = 2.8;
      } else if (preset === 'dawn') {
        _bgColor.set('#1f2933');
        keyLight.color.setHex(0xffb5a7);
        keyLight.intensity = 1.5;
        hearthLight.intensity = 2.2;
      } else {
        _bgColor.set(epochDef.skyColor);
        keyLight.color.setHex(0xffdfb0);
        keyLight.intensity = 1.9;
        hearthLight.intensity =
          (simRef.current.buildings.length > 0 ? 2.3 : 0.45) + Math.sin(elapsedTotal * 10) * 0.2;
      }
      scene.background = _bgColor;
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(_bgColor);
      }

      // Animate sculpted sky clouds & ocean coastal/reef/whitecap foaming
      const atmosSpeed =
        propsRef.current.timeScale === 0
          ? 0.35
          : 1 + Math.min(3, Math.max(0, propsRef.current.timeScale - 1)) * 0.25;
      skyClouds.update(dt * atmosSpeed, elapsedTotal, preset);
      oceanFoam.updateFrame(elapsedTotal, preset);
      styledTerrain.updateFrame(elapsedTotal);

      // Smooth exponential camera damping + decaying trauma shake
      camYaw = THREE.MathUtils.damp(camYaw, camDesiredYaw, 8, dt);
      camTarget.x = THREE.MathUtils.damp(camTarget.x, camDesiredTarget.x, 8, dt);
      camTarget.y = THREE.MathUtils.damp(camTarget.y, camDesiredTarget.y, 8, dt);
      camTarget.z = THREE.MathUtils.damp(camTarget.z, camDesiredTarget.z, 8, dt);

      if (Math.abs(frustumSize - desiredFrustum) > 0.01 && container) {
        frustumSize = THREE.MathUtils.damp(frustumSize, desiredFrustum, 8, dt);
        const w = Math.max(1, container.clientWidth);
        const h = Math.max(1, container.clientHeight);
        const newAspect = w / h;
        camera.left = (-frustumSize * newAspect) / 2;
        camera.right = (frustumSize * newAspect) / 2;
        camera.top = frustumSize / 2;
        camera.bottom = -frustumSize / 2;
        camera.updateProjectionMatrix();
      }

      trauma = Math.max(0, trauma - dt * 1.8);
      const shakeMag = trauma * trauma * 0.35;
      const shakeX = (Math.random() - 0.5) * shakeMag;
      const shakeY = (Math.random() - 0.5) * shakeMag;

      // Keep directional keyLight tracking camTarget so shadows stay crisp across 128x128
      keyLight.target.position.set(camTarget.x, 0, camTarget.z);
      keyLight.position.set(camTarget.x + 12, 28, camTarget.z + 8);
      const desiredShadowBounds = Math.max(18, Math.min(48, frustumSize * 1.2));
      if (Math.abs(shadowBounds - desiredShadowBounds) > 1.5) {
        shadowBounds = desiredShadowBounds;
        keyLight.shadow.camera.left = -shadowBounds;
        keyLight.shadow.camera.right = shadowBounds;
        keyLight.shadow.camera.top = shadowBounds;
        keyLight.shadow.camera.bottom = -shadowBounds;
        keyLight.shadow.camera.updateProjectionMatrix();
      }

      const isoDist = 28;
      const isoHeight = 22.5;
      camera.position.set(
        camTarget.x + Math.sin(camYaw) * isoDist + shakeX,
        camTarget.y + isoHeight + shakeY,
        camTarget.z + Math.cos(camYaw) * isoDist,
      );
      camera.lookAt(camTarget.x, camTarget.y, camTarget.z);

      renderer.render(scene, camera);

      // Throttle React HUD state synchronization to <= 6 Hz so we never setState at 60Hz
      hudSyncAccumulator += dt;
      if (hudSyncAccumulator >= 0.18) {
        hudSyncAccumulator = 0;
        propsRef.current.onSyncHud();
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      domElem.removeEventListener('pointerdown', onPointerDown);
      domElem.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domElem.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      for (const hv of hazardMeshes.values()) {
        for (const m of hv.materials) m.dispose();
      }
      for (const fx of activeBurstFx) {
        for (const m of fx.materials) m.dispose();
      }
      fireOuterGeo.dispose();
      fireCoreGeo.dispose();
      fireSmokeGeo.dispose();
      fireOuterMat.dispose();
      fireCoreMat.dispose();
      fireSmokeMat.dispose();
      sharedHazSphereGeo.dispose();
      sharedRainDropGeo.dispose();
      sharedDomeGeo.dispose();
      sharedDomeCylinderGeo.dispose();
      sharedHazRingGeo.dispose();
      sharedRiftTorusGeo.dispose();
      sharedRiftCoreGeo.dispose();
      sharedMeteorGeo.dispose();
      sharedMeteorAuraGeo.dispose();
      sharedExplosionDomeGeo.dispose();
      sharedBoltGeo.dispose();
      sharedBeamGeo.dispose();
      sharedPillarSpikeGeo.dispose();
      skyClouds.dispose();
      oceanFoam.dispose();
      styledTerrain.dispose();
      renderer.dispose();
    };
  }, [cameraActionRef, simRef]);

  return (
    <div
      ref={mountRef}
      data-testid="isometric-world-canvas"
      className="fixed inset-0 w-full h-full bg-[#141210] overflow-hidden"
    />
  );
};
