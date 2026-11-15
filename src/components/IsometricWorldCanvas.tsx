import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EPOCHS, GOD_POWERS, getDinosaurVariant } from '../game/catalog';
import { createAnimatedFireSpriteBundle } from '../game/fireSprites';
import {
  createBuildingGroup,
  createUnitGroup,
  createVehicleGroup,
  getNodeVariantLibrary,
} from '../game/meshBuilders';
import {
  createOceanFoamSystem,
  createPixelSpaceSystem,
  createSkyCloudSystem,
  createStyledTerrainSystem,
  createWorldUnderglowSystem,
} from '../game/skyAndSea';
import {
  closestFaultDistanceSq,
  executeGodPowerImpact,
  getSettlementAnchor,
  stepSimulation,
} from '../game/simulation';
import { soundEngine } from '../game/sound';
import {
  ActiveTool,
  EarthquakeFaultSegment,
  EarthquakeShapeKind,
  GameLifecycleState,
  GodPowerType,
  LightingPreset,
  SimulationState,
  TerrainType,
  UnitEntity,
  VehicleType,
} from '../game/types';
import { ZoneMapLabel } from '../game/zones';

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
    playTransition?: boolean;
    focusTarget?: { x: number; z: number; zoom?: number } | null;
  }>;
  hoveredEntityId?: string | null;
  selectedEntityId?: string | null;
  followingEntityId?: string | null;
  zoneOverlayBuffers?: {
    colorData: Uint8Array;
    idData: Uint8Array;
    anyActive: boolean;
    kingdomsActive?: boolean;
    kingsActive?: boolean;
    version: number;
    labels?: ZoneMapLabel[];
    kingdomColors?: Record<string, string>;
  };
  onTileInteract: (tileX: number, tileZ: number) => void;
  onHoverTileChange: (tile: { x: number; z: number } | null) => void;
  onHoverEntityChange?: (unitId: string | null) => void;
  onSelectEntity?: (unitId: string | null) => void;
  onBreakFollow?: () => void;
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
  gravity: number;
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
  hoveredEntityId = null,
  selectedEntityId = null,
  followingEntityId = null,
  zoneOverlayBuffers,
  onTileInteract,
  onHoverTileChange,
  onHoverEntityChange,
  onSelectEntity,
  onBreakFollow,
  onSyncHud,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const zoneLabelsLayerRef = useRef<HTMLDivElement | null>(null);
  const kingMarkersLayerRef = useRef<HTMLDivElement | null>(null);

  // Store latest props in refs so WebGLRenderer mounts once and never tears down on HUD updates
  const propsRef = useRef({
    gameState,
    timeScale,
    activeTool,
    brushRadius,
    pixelScale,
    lightingPreset,
    hoveredEntityId,
    selectedEntityId,
    followingEntityId,
    zoneOverlayBuffers,
    onTileInteract,
    onHoverTileChange,
    onHoverEntityChange,
    onSelectEntity,
    onBreakFollow,
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
      hoveredEntityId,
      selectedEntityId,
      followingEntityId,
      zoneOverlayBuffers,
      onTileInteract,
      onHoverTileChange,
      onHoverEntityChange,
      onSelectEntity,
      onBreakFollow,
      onSyncHud,
    };
  }, [
    gameState,
    timeScale,
    activeTool,
    brushRadius,
    pixelScale,
    lightingPreset,
    hoveredEntityId,
    selectedEntityId,
    followingEntityId,
    zoneOverlayBuffers,
    onTileInteract,
    onHoverTileChange,
    onHoverEntityChange,
    onSelectEntity,
    onBreakFollow,
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
    scene.background = new THREE.Color('#070b14');
    scene.fog = new THREE.FogExp2('#0c131d', 0.0085);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Orthographic camera for authentic isometric projection
    const sim = simRef.current;
    const getWholeMapFrustum = (gs: number) => Math.round(gs * (105 / 128));
    const aspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
    let frustumSize =
      propsRef.current.gameState === 'title' ? 22 : getWholeMapFrustum(sim.gridSize);
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      -260,
      420,
    );

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
    const vehiclesGroup = new THREE.Group();
    worldGroup.add(terrainGroup, nodesGroup, buildingsGroup, unitsGroup, vehiclesGroup);

    // Seeded pixelated deep-space & Milky Way galaxy backdrop behind the floating world
    const pixelSpace = createPixelSpaceSystem(sim.seed);
    scene.add(pixelSpace.mesh);

    // Subtle Bayer-dithered pixelated glow beneath & around the floating world diorama
    const worldUnderglow = createWorldUnderglowSystem(sim.gridSize);
    worldGroup.add(worldUnderglow.mesh);

    // Animated pixelated ocean, coastal surf foam, reef foam, & sculpted drifting sky clouds
    const oceanFoam = createOceanFoamSystem(sim.gridSize);
    oceanFoam.updateMap(sim.tiles);
    worldGroup.add(oceanFoam.mesh);

    const skyClouds = createSkyCloudSystem(sim.gridSize);
    worldGroup.add(skyClouds.shadowGroup);
    worldGroup.add(skyClouds.group);

    // Instanced terrain system (22 draw calls total regardless of map size!)
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
      'rail_track',
      'jungle',
      'mountain',
      'taiga',
      'tundra',
      'badlands',
      'blossom',
      'runway',
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

    // Instanced Multi-Object Props (1-4 objects per tile across 128x128)
    const variantLib = getNodeVariantLibrary();
    const maxPropCapacity = Math.ceil(sim.tiles.length * 0.55);
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
    const timberJungleInsts = makePropInstancedList(variantLib.timberJungle, variantLib.standardMat, true);
    const timberTaigaInsts = makePropInstancedList(variantLib.timberTaiga, variantLib.standardMat, true);
    const timberBlossomInsts = makePropInstancedList(variantLib.timberBlossom, variantLib.standardMat, true);
    const berryInsts = makePropInstancedList(variantLib.berry, variantLib.standardMat, true);
    const farmCropInsts = makePropInstancedList(variantLib.farmCrop, variantLib.standardMat, true);
    const sciFiFarmInsts = makePropInstancedList(variantLib.sciFiFarm, variantLib.crystalMat, true);
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
    const ambJungleInsts = makePropInstancedList(variantLib.ambientJungle, variantLib.standardMat, false);
    const ambMountainInsts = makePropInstancedList(variantLib.ambientMountain, variantLib.standardMat, false);
    const ambTaigaInsts = makePropInstancedList(variantLib.ambientTaiga, variantLib.standardMat, false);
    const ambTundraInsts = makePropInstancedList(variantLib.ambientTundra, variantLib.standardMat, false);
    const ambBadlandsInsts = makePropInstancedList(variantLib.ambientBadlands, variantLib.standardMat, false);
    const ambBlossomInsts = makePropInstancedList(variantLib.ambientBlossom, variantLib.standardMat, false);

    const allPropInsts = [
      ...timberInsts,
      ...timberJungleInsts,
      ...timberTaigaInsts,
      ...timberBlossomInsts,
      ...berryInsts,
      ...farmCropInsts,
      ...sciFiFarmInsts,
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
      ...ambJungleInsts,
      ...ambMountainInsts,
      ...ambTaigaInsts,
      ...ambTundraInsts,
      ...ambBadlandsInsts,
      ...ambBlossomInsts,
    ];

    // Elevated Metro Viaduct System (Epoch 5+ concrete / Epoch 6+ titanium-maglev on T-pillars) & Runway Beacons
    const MAX_METRO_INST = 4096;
    const MAX_METRO_STRIP_INST = 8192;
    const MAX_RUNWAY_LIGHT_INST = 1024;
    const metroGroup = new THREE.Group();
    worldGroup.add(metroGroup);

    const metroConcreteMat = new THREE.MeshStandardMaterial({
      color: 0x8d99ae,
      roughness: 0.78,
      metalness: 0.08,
    });
    const metroParapetMat = new THREE.MeshStandardMaterial({
      color: 0x5c677d,
      roughness: 0.65,
      metalness: 0.18,
    });
    const metroRailMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.28,
      metalness: 0.72,
      emissive: 0x000000,
      emissiveIntensity: 0,
    });
    const runwayBeaconMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.15,
      roughness: 0.25,
    });

    const metroPillarGeo = new THREE.BoxGeometry(0.17, 0.64, 0.17);
    const metroCapGeo = new THREE.BoxGeometry(0.36, 0.09, 0.36);
    const metroDeckHubGeo = new THREE.BoxGeometry(0.58, 0.12, 0.58);
    const metroSpanEWGeo = new THREE.BoxGeometry(1.0, 0.12, 0.58);
    const metroSpanNSGeo = new THREE.BoxGeometry(0.58, 0.12, 1.0);
    const metroRailHubGeo = new THREE.BoxGeometry(0.30, 0.045, 0.30);
    const metroRailEWGeo = new THREE.BoxGeometry(1.0, 0.045, 0.06);
    const metroRailNSGeo = new THREE.BoxGeometry(0.06, 0.045, 1.0);
    const metroParapetEWGeo = new THREE.BoxGeometry(1.0, 0.065, 0.055);
    const metroParapetNSGeo = new THREE.BoxGeometry(0.055, 0.065, 1.0);
    const runwayBeaconGeo = new THREE.BoxGeometry(0.07, 0.11, 0.07);

    const makeMetroInst = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      cap: number,
      castShadow: boolean,
    ) => {
      const inst = new THREE.InstancedMesh(geo, mat, cap);
      inst.frustumCulled = false;
      inst.boundingSphere = worldBoundsSphere;
      inst.castShadow = castShadow;
      inst.receiveShadow = true;
      inst.count = 0;
      metroGroup.add(inst);
      return inst;
    };

    const metroPillarInst = makeMetroInst(metroPillarGeo, metroConcreteMat, MAX_METRO_INST, true);
    const metroCapInst = makeMetroInst(metroCapGeo, metroConcreteMat, MAX_METRO_INST, true);
    const metroDeckHubInst = makeMetroInst(metroDeckHubGeo, metroConcreteMat, MAX_METRO_INST, true);
    const metroSpanEWInst = makeMetroInst(metroSpanEWGeo, metroConcreteMat, MAX_METRO_INST, true);
    const metroSpanNSInst = makeMetroInst(metroSpanNSGeo, metroConcreteMat, MAX_METRO_INST, true);
    const metroRailHubInst = makeMetroInst(metroRailHubGeo, metroRailMat, MAX_METRO_INST, false);
    const metroRailEWInst = makeMetroInst(metroRailEWGeo, metroRailMat, MAX_METRO_STRIP_INST, false);
    const metroRailNSInst = makeMetroInst(metroRailNSGeo, metroRailMat, MAX_METRO_STRIP_INST, false);
    const metroParapetEWInst = makeMetroInst(metroParapetEWGeo, metroParapetMat, MAX_METRO_STRIP_INST, true);
    const metroParapetNSInst = makeMetroInst(metroParapetNSGeo, metroParapetMat, MAX_METRO_STRIP_INST, true);
    const runwayBeaconInst = makeMetroInst(runwayBeaconGeo, runwayBeaconMat, MAX_RUNWAY_LIGHT_INST, false);

    const allMetroInsts = [
      metroPillarInst,
      metroCapInst,
      metroDeckHubInst,
      metroSpanEWInst,
      metroSpanNSInst,
      metroRailHubInst,
      metroRailEWInst,
      metroRailNSInst,
      metroParapetEWInst,
      metroParapetNSInst,
      runwayBeaconInst,
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
      rail_track: 14,
      jungle: 15,
      mountain: 16,
      taiga: 17,
      tundra: 18,
      badlands: 19,
      blossom: 20,
      runway: 21,
    };
    const NODE_CODE: Record<string, number> = {
      none: 0,
      timber_grove: 1,
      berry_bush: 2,
      stone_outcrop: 3,
      ore_vein: 4,
      crystal_monolith: 5,
    };

    const buildingMeshes = new Map<
      string,
      { group: THREE.Group; epochLevel: number; type: string; species: string }
    >();
    const unitMeshes = new Map<
      string,
      { group: THREE.Group; epochLevel: number; role: string; species: string; ageStage: string }
    >();
    const vehicleMeshes = new Map<
      string,
      { group: THREE.Group; epochLevel: number; type: VehicleType; species: string }
    >();

    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x26353e,
      emissive: 0x0b1620,
      emissiveIntensity: 0.45,
      roughness: 0.88,
    });
    const skirtGeo = new THREE.BoxGeometry(sim.gridSize + 0.9, 1.8, sim.gridSize + 0.9);
    const baseSkirt = new THREE.Mesh(skirtGeo, skirtMat);
    baseSkirt.position.set(gridCenter, -0.95, gridCenter);
    worldGroup.add(baseSkirt);

    // Crisp illuminated slate-stone diorama rim framing the ocean edge against deep space
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x526e7d,
      emissive: 0x162a38,
      emissiveIntensity: 0.45,
      roughness: 0.72,
    });
    const rimGeo = new THREE.BoxGeometry(sim.gridSize + 1.35, 0.24, sim.gridSize + 1.35);
    const baseRim = new THREE.Mesh(rimGeo, rimMat);
    baseRim.position.set(gridCenter, 0.14, gridCenter);
    worldGroup.add(baseRim);

    // Subtle celestial trim along the underside of the diorama slab matching the underglow
    const glowTrimMat = new THREE.MeshBasicMaterial({
      color: 0x48bfe3,
      transparent: true,
      opacity: 0.42,
    });
    const glowTrimGeo = new THREE.BoxGeometry(sim.gridSize + 1.1, 0.12, sim.gridSize + 1.1);
    const baseGlowTrim = new THREE.Mesh(glowTrimGeo, glowTrimMat);
    baseGlowTrim.position.set(gridCenter, -1.8, gridCenter);
    worldGroup.add(baseGlowTrim);

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

    // Inspect Mode Entity Highlight Rigs (Zero-mutation overlay rings, corner posts & overhead pointer)
    const createEntityHighlightRig = (colorHex: number) => {
      const group = new THREE.Group();
      group.visible = false;

      const outerGeo = new THREE.RingGeometry(0.62, 0.8, 24);
      outerGeo.rotateX(-Math.PI / 2);
      const innerGeo = new THREE.RingGeometry(0.4, 0.48, 24);
      innerGeo.rotateX(-Math.PI / 2);
      const postGeo = new THREE.BoxGeometry(0.09, 0.45, 0.09);
      const pointerGeo = new THREE.OctahedronGeometry(0.18, 0);

      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });
      const bracketMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.88,
      });

      const ringRoot = new THREE.Group();
      const outerRing = new THREE.Mesh(outerGeo, ringMat);
      outerRing.position.y = 0.05;
      const innerRing = new THREE.Mesh(innerGeo, ringMat);
      innerRing.position.y = 0.06;
      ringRoot.add(outerRing, innerRing);

      const cornerOffsets: [number, number][] = [
        [-0.58, -0.58],
        [0.58, -0.58],
        [-0.58, 0.58],
        [0.58, 0.58],
      ];
      for (const [cx, cz] of cornerOffsets) {
        const post = new THREE.Mesh(postGeo, bracketMat);
        post.position.set(cx, 0.24, cz);
        ringRoot.add(post);
      }

      const pointer = new THREE.Mesh(pointerGeo, bracketMat);
      pointer.position.set(0, 1.85, 0);

      group.add(ringRoot, pointer);
      worldGroup.add(group);

      return {
        group,
        ringRoot,
        pointer,
        ringMat,
        bracketMat,
        dispose: () => {
          outerGeo.dispose();
          innerGeo.dispose();
          postGeo.dispose();
          pointerGeo.dispose();
          ringMat.dispose();
          bracketMat.dispose();
        },
      };
    };

    const hoverHighlightRig = createEntityHighlightRig(0x56cfe1);
    const selectedHighlightRig = createEntityHighlightRig(0xffd166);

    const MAX_FAVORITE_STARS = 64;
    const favoriteStarGeo = new THREE.OctahedronGeometry(0.14, 0);
    const favoriteStarMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    const favoriteStarsInst = new THREE.InstancedMesh(
      favoriteStarGeo,
      favoriteStarMat,
      MAX_FAVORITE_STARS,
    );
    favoriteStarsInst.count = 0;
    favoriteStarsInst.frustumCulled = false;
    worldGroup.add(favoriteStarsInst);

    const MAX_KING_CROWNS = 16;
    const kingCrownGeo = new THREE.CylinderGeometry(0.22, 0.14, 0.18, 6);
    const kingCrownMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });
    const kingCrownsInst = new THREE.InstancedMesh(
      kingCrownGeo,
      kingCrownMat,
      MAX_KING_CROWNS,
    );
    kingCrownsInst.count = 0;
    kingCrownsInst.frustumCulled = false;
    worldGroup.add(kingCrownsInst);

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
      gravity: 11.5,
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
        p.gravity = 11.5;
        p.maxLife = 0.65 + Math.random() * 0.75;
        p.life = p.maxLife;
        p.size = (0.85 + Math.random() * 1.35) * sizeMult;
        p.color.copy(baseCol).offsetHSL((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.22);
      }
    }

    function spawnRisingParticles(
      x: number,
      y: number,
      z: number,
      count: number,
      hexColor: string,
      radius = 4.5,
      riseSpeed = 2.4,
      sizeMult = 0.95,
      lifeSec = 1.5,
    ) {
      const baseCol = new THREE.Color(hexColor);
      for (let i = 0; i < count; i++) {
        const p = particles[particleHead];
        particleHead = (particleHead + 1) % MAX_PARTICLES;
        p.active = true;
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius;
        p.x = x + Math.cos(angle) * r;
        p.y = y + 0.12 + Math.random() * 0.35;
        p.z = z + Math.sin(angle) * r;
        p.vx = (Math.random() - 0.5) * 0.45;
        p.vy = riseSpeed * (0.75 + Math.random() * 0.55);
        p.vz = (Math.random() - 0.5) * 0.45;
        p.gravity = -0.35; // Gentle upward buoyancy so motes float steadily skyward
        p.maxLife = lifeSec * (0.75 + Math.random() * 0.45);
        p.life = p.maxLife;
        p.size = (0.75 + Math.random() * 0.95) * sizeMult;
        p.color.copy(baseCol).offsetHSL((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.2);
      }
    }

    function spawnDirectionalFlameStream(
      ox: number,
      oy: number,
      oz: number,
      tx: number,
      ty: number,
      tz: number,
      count: number,
      hexColor: string,
      spread = 0.45,
    ) {
      const baseCol = new THREE.Color(hexColor);
      const hotCol = baseCol.clone().lerp(new THREE.Color(0xffffff), 0.52);
      const deepCol = baseCol.clone().multiplyScalar(0.76);
      const dx = tx - ox;
      const dy = ty - oy;
      const dz = tz - oz;
      const len = Math.max(0.3, Math.hypot(dx, dy, dz));
      const speedBase = Math.max(5.5, len * 2.6);
      const travelSec = Math.min(0.62, len / speedBase);
      for (let i = 0; i < count; i++) {
        const p = particles[particleHead];
        particleHead = (particleHead + 1) % MAX_PARTICLES;
        p.active = true;
        const along = Math.random() * 0.22;
        p.x = ox + dx * along + (Math.random() - 0.5) * 0.24;
        p.y = oy + dy * along + (Math.random() - 0.5) * 0.2;
        p.z = oz + dz * along + (Math.random() - 0.5) * 0.24;
        const invLen = speedBase * (0.85 + Math.random() * 0.4) / len;
        p.vx = dx * invLen + (Math.random() - 0.5) * spread * 2.4;
        p.vy = dy * invLen + (Math.random() - 0.5) * spread * 1.6;
        p.vz = dz * invLen + (Math.random() - 0.5) * spread * 2.4;
        p.gravity = -0.8; // Slight thermal updraft along jet
        p.maxLife = travelSec * (0.75 + Math.random() * 0.55);
        p.life = p.maxLife;
        p.size = 1.15 + Math.random() * 1.45;
        const roll = Math.random();
        if (roll < 0.24) {
          p.color.copy(hotCol);
        } else if (roll < 0.48) {
          p.color.copy(deepCol);
        } else {
          p.color.copy(baseCol).offsetHSL((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.12);
        }
      }
    }

    function spawnInwardPullParticles(
      cx: number,
      cy: number,
      cz: number,
      count: number,
      hexColor: string,
      outerRadius = 6.5,
      sizeMult = 0.95,
    ) {
      const baseCol = new THREE.Color(hexColor);
      for (let i = 0; i < count; i++) {
        const p = particles[particleHead];
        particleHead = (particleHead + 1) % MAX_PARTICLES;
        p.active = true;
        const angle = Math.random() * Math.PI * 2;
        const r = outerRadius * (0.45 + Math.random() * 0.55);
        const sx = cx + Math.cos(angle) * r;
        const sy = cy + 0.1 + Math.random() * 0.9;
        const sz = cz + Math.sin(angle) * r;
        p.x = sx;
        p.y = sy;
        p.z = sz;
        const travelTime = 0.48 + Math.random() * 0.32;
        // Aim velocity inward + tangential swirl so particles visibly spiral into the singularity core at (cx, cy + 1.8, cz)
        const rx = (cx - sx) / travelTime;
        const rz = (cz - sz) / travelTime;
        const tx = -Math.sin(angle) * 2.8;
        const tz = Math.cos(angle) * 2.8;
        p.vx = rx + tx;
        p.vy = (cy + 1.8 - sy) / travelTime;
        p.vz = rz + tz;
        p.gravity = 0;
        p.maxLife = travelTime;
        p.life = travelTime;
        p.size = (0.75 + Math.random() * 0.95) * sizeMult;
        p.color.copy(baseCol).offsetHSL((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.2);
      }
    }

    // Active Tile Fire Flames & Smoke Plumes (Zero-GC Instanced Billboarded Animated Pixel-Art Sprites)
    const MAX_FIRE_TILES = 320;
    const MAX_FIRE_SPRITES = MAX_FIRE_TILES * 2;
    const spriteBundle = createAnimatedFireSpriteBundle();

    const fireSpriteGeo = spriteBundle.fireGeometry.clone();
    const fireDataArray = new Float32Array(MAX_FIRE_SPRITES * 2);
    const fireColorArray = new Float32Array(MAX_FIRE_SPRITES * 3);
    const fireDataAttr = new THREE.InstancedBufferAttribute(fireDataArray, 2);
    fireDataAttr.setUsage(THREE.DynamicDrawUsage);
    const fireColorAttr = new THREE.InstancedBufferAttribute(fireColorArray, 3);
    fireColorAttr.setUsage(THREE.DynamicDrawUsage);
    fireSpriteGeo.setAttribute('aFireData', fireDataAttr);
    fireSpriteGeo.setAttribute('aFireColor', fireColorAttr);

    const fireSmokeGeo = spriteBundle.smokeGeometry.clone();
    const smokeDataArray = new Float32Array(MAX_FIRE_TILES * 2);
    const smokeDataAttr = new THREE.InstancedBufferAttribute(smokeDataArray, 2);
    smokeDataAttr.setUsage(THREE.DynamicDrawUsage);
    fireSmokeGeo.setAttribute('aSmokeData', smokeDataAttr);

    const fireSpriteInst = new THREE.InstancedMesh(
      fireSpriteGeo,
      spriteBundle.fireMaterial,
      MAX_FIRE_SPRITES,
    );
    const fireSmokeInst = new THREE.InstancedMesh(
      fireSmokeGeo,
      spriteBundle.smokeMaterial,
      MAX_FIRE_TILES,
    );
    const _fireTintCol = new THREE.Color(1, 1, 1);
    const _whiteCol = new THREE.Color(1, 1, 1);
    fireSpriteInst.frustumCulled = false;
    fireSmokeInst.frustumCulled = false;
    fireSpriteInst.renderOrder = 3;
    fireSmokeInst.renderOrder = 4;
    fireSpriteInst.count = 0;
    fireSmokeInst.count = 0;
    worldGroup.add(fireSpriteInst, fireSmokeInst);

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
    const sharedWaveBaseGeo = new THREE.BoxGeometry(1.12, 0.72, 1.45);
    const sharedWaveFaceGeo = new THREE.BoxGeometry(1.12, 1.48, 0.92);
    const sharedWaveLipGeo = new THREE.BoxGeometry(1.16, 0.62, 1.05);
    const sharedWaveFoamGeo = new THREE.BoxGeometry(1.22, 0.44, 0.68);
    const sharedFaultCrackGeo = new THREE.BoxGeometry(1, 0.14, 1);

    interface TsunamiWaveSegment {
      group: THREE.Group;
      angle: number;
      isWake: boolean;
      phase: number;
    }

    interface VortexMote {
      mesh: THREE.Mesh;
      baseAngle: number;
      phase: number;
      speed: number;
    }

    interface HazardVisual {
      kind:
        | 'rain_cloud'
        | 'plague_cloud'
        | 'shield_dome'
        | 'wormhole_rift'
        | 'tsunami_wave'
        | 'earthquake_zone';
      group: THREE.Group;
      materials: THREE.Material[];
      drops?: { mesh: THREE.Mesh; offsetY: number; speed: number; baseX: number; baseZ: number }[];
      spores?: { mesh: THREE.Mesh; angle: number; dist: number; phase: number; height: number }[];
      waveSegments?: TsunamiWaveSegment[];
      gravityRings?: THREE.Mesh[];
      vortexMotes?: VortexMote[];
      ringMesh?: THREE.Mesh;
      secondaryRingMesh?: THREE.Mesh;
      waveWallMesh?: THREE.Mesh;
      cloudBody?: THREE.Group;
      currentY?: number;
      crackMeshes?: THREE.Mesh[];
      faultSegments?: EarthquakeFaultSegment[];
    }
    const hazardMeshes = new Map<string, HazardVisual>();

    function createHazardVisual(
      kind: HazardVisual['kind'],
      radius: number,
      faultSegments?: EarthquakeFaultSegment[],
      originX = 0,
      originZ = 0,
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

      if (kind === 'tsunami_wave') {
        const deepSwellMat = new THREE.MeshStandardMaterial({
          color: 0x023e8a,
          roughness: 0.42,
          transparent: true,
          opacity: 0.88,
        });
        const waveWallMat = new THREE.MeshStandardMaterial({
          color: 0x0077b6,
          emissive: 0x005082,
          emissiveIntensity: 0.28,
          roughness: 0.35,
          transparent: true,
          opacity: 0.92,
        });
        const waveLipMat = new THREE.MeshBasicMaterial({
          color: 0x00b4d8,
          transparent: true,
          opacity: 0.94,
        });
        const crestFoamMat = new THREE.MeshBasicMaterial({
          color: 0xe0fbfc,
          transparent: true,
          opacity: 0.98,
        });
        materials.push(deepSwellMat, waveWallMat, waveLipMat, crestFoamMat);

        const waveSegments: TsunamiWaveSegment[] = [];
        const buildWaveRing = (count: number, isWake: boolean) => {
          for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const segGroup = new THREE.Group();

            // 1. Deep ocean swell back-slope
            const baseMesh = new THREE.Mesh(sharedWaveBaseGeo, deepSwellMat);
            baseMesh.position.set(0, 0.36, -0.38);
            segGroup.add(baseMesh);

            // 2. Steep rising ocean wave wall
            const faceMesh = new THREE.Mesh(sharedWaveFaceGeo, waveWallMat);
            faceMesh.position.set(0, 0.74, 0.12);
            segGroup.add(faceMesh);

            // 3. Forward-curling turquoise wave tube / lip overhanging the front
            const lipMesh = new THREE.Mesh(sharedWaveLipGeo, waveLipMat);
            lipMesh.position.set(0, 1.42, 0.56);
            lipMesh.rotation.x = 0.46;
            segGroup.add(lipMesh);

            // 4. Chunky pixelated white surf crown & breaking toe foam
            const topFoamMesh = new THREE.Mesh(sharedWaveFoamGeo, crestFoamMat);
            topFoamMesh.position.set(0, 1.56, 0.88);
            topFoamMesh.rotation.x = 0.3;
            segGroup.add(topFoamMesh);

            const toeFoamMesh = new THREE.Mesh(sharedWaveFoamGeo, crestFoamMat);
            toeFoamMesh.position.set(0, 0.22, 0.96);
            toeFoamMesh.scale.set(1.06, 0.68, 0.85);
            segGroup.add(toeFoamMesh);

            group.add(segGroup);
            waveSegments.push({
              group: segGroup,
              angle,
              isWake,
              phase: i * 0.65 + (isWake ? 1.9 : 0),
            });
          }
        };

        // Primary towering tsunami wave crest (40 segments) + secondary trailing wave swell (28 segments)
        buildWaveRing(40, false);
        buildWaveRing(28, true);

        return { kind, group, materials, waveSegments };
      }

      if (kind === 'earthquake_zone') {
        const quakeRingMat = new THREE.MeshBasicMaterial({
          color: 0xe07a2b,
          transparent: true,
          opacity: 0.52,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const crackMat = new THREE.MeshBasicMaterial({
          color: 0xffaa44,
          transparent: true,
          opacity: 0.78,
          depthWrite: false,
        });
        materials.push(quakeRingMat, crackMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, quakeRingMat);
        ringMesh.position.y = 0.08;
        ringMesh.scale.setScalar(Math.min(4.8, radius * 0.48));
        group.add(ringMesh);

        const crackMeshes: THREE.Mesh[] = [];
        const segs =
          faultSegments && faultSegments.length > 0
            ? faultSegments
            : [{ x1: originX - 3, z1: originZ, x2: originX + 3, z2: originZ, width: 1, upliftBias: 0.5 }];

        for (let si = 0; si < segs.length; si++) {
          const s = segs[si];
          const dx = s.x2 - s.x1;
          const dz = s.z2 - s.z1;
          const len = Math.max(0.6, Math.hypot(dx, dz));
          const midX = (s.x1 + s.x2) * 0.5 - originX;
          const midZ = (s.z1 + s.z2) * 0.5 - originZ;
          const angle = Math.atan2(dz, dx);

          const crack = new THREE.Mesh(sharedFaultCrackGeo, crackMat);
          crack.position.set(midX, 0.14, midZ);
          crack.rotation.y = -angle;
          crack.scale.set(len + 0.35, 0.55, Math.max(0.24, s.width * (s.isBranch ? 0.34 : 0.48)));
          crack.userData.baseScaleZ = crack.scale.z;
          group.add(crack);
          crackMeshes.push(crack);
        }

        return {
          kind,
          group,
          materials,
          ringMesh,
          crackMeshes,
          faultSegments: segs,
        };
      }

      // wormhole_rift — spinning black hole event horizon + contracting gravity-well funnel rings + inward-spiraling accretion shards
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
        color: 0x070012,
      });
      const gravRingMat1 = new THREE.MeshBasicMaterial({
        color: 0x9d4edd,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const gravRingMat2 = new THREE.MeshBasicMaterial({
        color: 0x56cfe1,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const gravRingMat3 = new THREE.MeshBasicMaterial({
        color: 0xe0aaff,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const motePurpleMat = new THREE.MeshBasicMaterial({
        color: 0xe0aaff,
        transparent: true,
        opacity: 0.92,
      });
      const moteCyanMat = new THREE.MeshBasicMaterial({
        color: 0x72efdd,
        transparent: true,
        opacity: 0.92,
      });
      materials.push(
        ringMat,
        cyanRingMat,
        coreMat,
        gravRingMat1,
        gravRingMat2,
        gravRingMat3,
        motePurpleMat,
        moteCyanMat,
      );

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
      core.scale.setScalar(1.08);
      group.add(core);

      // 3 Concentric Gravity-Well Rings that continuously contract inward from the outer pull radius into the core
      const gravMats = [gravRingMat1, gravRingMat2, gravRingMat3];
      const gravityRings: THREE.Mesh[] = [];
      for (let i = 0; i < 3; i++) {
        const gRing = new THREE.Mesh(sharedHazRingGeo, gravMats[i]);
        gRing.position.y = 0.15;
        group.add(gRing);
        gravityRings.push(gRing);
      }

      // 24 Inward-Spiraling Accretion Shards sucked from the ground perimeter up into the Event Horizon
      const vortexMotes: VortexMote[] = [];
      for (let i = 0; i < 24; i++) {
        const m = new THREE.Mesh(sharedHazSphereGeo, i % 2 === 0 ? motePurpleMat : moteCyanMat);
        m.scale.setScalar(0.28);
        group.add(m);
        vortexMotes.push({
          mesh: m,
          baseAngle: (i / 24) * Math.PI * 2,
          phase: (i / 24) + (i % 5) * 0.07,
          speed: 0.65 + (i % 4) * 0.14,
        });
      }

      return {
        kind,
        group,
        materials,
        ringMesh: torus1,
        secondaryRingMesh: torus2,
        gravityRings,
        vortexMotes,
      };
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
    const sharedPillarSpikeGeo = new THREE.BoxGeometry(0.45, 2.2, 0.45);
    sharedPillarSpikeGeo.translate(0, 1.1, 0);
    const sharedRuneSquareGeo = new THREE.RingGeometry(0.84, 0.96, 4);
    sharedRuneSquareGeo.rotateX(-Math.PI / 2);
    const sharedOrbMoteGeo = new THREE.OctahedronGeometry(0.24, 0);
    const sharedShardMoteGeo = new THREE.BoxGeometry(0.2, 0.42, 0.2);
    const sharedFlameOuterGeo = (() => {
      const g = new THREE.ConeGeometry(0.68, 1.0, 12, 1, true);
      g.translate(0, -0.5, 0);
      g.rotateX(-Math.PI / 2);
      return g;
    })();
    const sharedFlameCoreGeo = (() => {
      const g = new THREE.ConeGeometry(0.35, 1.0, 10, 1, true);
      g.translate(0, -0.5, 0);
      g.rotateX(-Math.PI / 2);
      return g;
    })();
    const sharedSlashBladeGeo = new THREE.BoxGeometry(0.85, 0.09, 0.14);
    const sharedSlamClawGeo = new THREE.BoxGeometry(0.14, 0.1, 0.95);
    const sharedHornStarGeo = new THREE.OctahedronGeometry(0.28, 0);

    interface PowerMote {
      mesh: THREE.Mesh;
      angle: number;
      dist: number;
      speed: number;
      phase: number;
      height: number;
    }

    interface ActiveBurstFx {
      kind:
        | 'meteor'
        | 'lightning'
        | 'rain_summon'
        | 'insight_circle'
        | 'blessing_bloom'
        | 'golden_dawn'
        | 'shield_pulse'
        | 'fury_vortex'
        | 'curse_eclipse'
        | 'plague_eruption'
        | 'terraform_strata'
        | 'rift_implosion'
        | 'earthquake_quake'
        | 'dragon_flame'
        | 'animal_strike'
        | 'ripple_ring';
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
      ox?: number;
      oy?: number;
      oz?: number;
      sourceUnitId?: string;
      variant?: string;
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
      thirdRingMesh?: THREE.Mesh;
      floatingCrown?: THREE.Group;
      strataRings?: THREE.Mesh[];
      motes?: PowerMote[];
      spikes?: THREE.Mesh[];
      crackMeshes?: THREE.Mesh[];
      slashMeshes?: THREE.Mesh[];
      flameCoreCone?: THREE.Mesh;
      flameOuterCone?: THREE.Mesh;
      faultSegments?: EarthquakeFaultSegment[];
      quakeShapeKind?: EarthquakeShapeKind;
      particleEmitTimer?: number;
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
      faultSegments?: EarthquakeFaultSegment[],
      quakeShapeKind?: EarthquakeShapeKind,
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

      // 4. INSIGHT (eureka): 5-second lingering sacred geometry circle with continuous upward-floating wisdom motes & particles
      if (type === 'eureka') {
        const outerMat = new THREE.MeshBasicMaterial({
          color: 0x56cfe1,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const runeMat = new THREE.MeshBasicMaterial({
          color: 0xe0fbfc,
          transparent: true,
          opacity: 0.82,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const moteMat = new THREE.MeshBasicMaterial({
          color: 0x90e0ef,
          transparent: true,
          opacity: 0.92,
        });
        materials.push(outerMat, runeMat, moteMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, outerMat);
        ringMesh.position.set(tx, ty + 0.12, tz);
        ringMesh.scale.setScalar(radius * 0.96);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedRuneSquareGeo, runeMat);
        outerRingMesh.position.set(tx, ty + 0.15, tz);
        outerRingMesh.scale.setScalar(radius * 0.88);
        group.add(outerRingMesh);

        const thirdRingMesh = new THREE.Mesh(sharedHazRingGeo, runeMat);
        thirdRingMesh.position.set(tx, ty + 0.16, tz);
        thirdRingMesh.scale.setScalar(radius * 0.52);
        group.add(thirdRingMesh);

        const motes: PowerMote[] = [];
        for (let i = 0; i < 28; i++) {
          const angle = (i / 28) * Math.PI * 2 + (i % 3) * 0.4;
          const dist = (0.14 + ((i * 37) % 85) / 100) * radius * 0.9;
          const m = new THREE.Mesh(sharedOrbMoteGeo, i % 3 === 0 ? runeMat : moteMat);
          const s = 0.65 + (i % 4) * 0.22;
          m.scale.setScalar(s);
          m.position.set(tx + Math.cos(angle) * dist, ty + 0.2, tz + Math.sin(angle) * dist);
          group.add(m);
          motes.push({
            mesh: m,
            angle,
            dist,
            speed: 1.6 + (i % 5) * 0.35,
            phase: (i * 0.23) % 4.2,
            height: 3.8 + (i % 3) * 0.65,
          });
        }

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'insight_circle',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 5.25,
          impactDelay: 0.22,
          deferImpact,
          tx,
          ty,
          tz,
          radius,
          impactFired: false,
          ringMesh,
          outerRingMesh,
          thirdRingMesh,
          motes,
          particleEmitTimer: 0,
          colorHex,
        });
        return;
      }

      // 5. BLESS (blessing): Blooming golden-emerald meadow rings & ascending spiral life petals
      if (type === 'blessing') {
        const goldMat = new THREE.MeshBasicMaterial({
          color: 0xf5b742,
          transparent: true,
          opacity: 0.88,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const emeraldMat = new THREE.MeshBasicMaterial({
          color: 0x80ed99,
          transparent: true,
          opacity: 0.82,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const petalMat = new THREE.MeshBasicMaterial({
          color: 0xfff3b0,
          transparent: true,
          opacity: 0.92,
        });
        materials.push(goldMat, emeraldMat, petalMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, goldMat);
        ringMesh.position.set(tx, ty + 0.12, tz);
        ringMesh.scale.setScalar(radius * 0.92);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, emeraldMat);
        outerRingMesh.position.set(tx, ty + 0.15, tz);
        outerRingMesh.scale.setScalar(radius * 0.45);
        group.add(outerRingMesh);

        const motes: PowerMote[] = [];
        for (let i = 0; i < 22; i++) {
          const angle = (i / 22) * Math.PI * 2;
          const dist = (0.18 + ((i * 29) % 80) / 100) * radius * 0.86;
          const m = new THREE.Mesh(sharedOrbMoteGeo, i % 2 === 0 ? petalMat : emeraldMat);
          m.scale.set(0.85, 1.25, 0.85);
          m.position.set(tx + Math.cos(angle) * dist, ty + 0.2, tz + Math.sin(angle) * dist);
          group.add(m);
          motes.push({
            mesh: m,
            angle,
            dist,
            speed: 1.45 + (i % 4) * 0.3,
            phase: (i * 0.27) % 3.6,
            height: 3.4,
          });
        }

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'blessing_bloom',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 4.2,
          impactDelay: 0.2,
          deferImpact,
          tx,
          ty,
          tz,
          radius,
          impactFired: false,
          ringMesh,
          outerRingMesh,
          motes,
          particleEmitTimer: 0,
          colorHex,
        });
        return;
      }

      // 6. GOLDEN AGE (golden_age): Hovering gyroscopic solar crown + triple imperial ground seal + 5.5s golden stardust
      if (type === 'golden_age') {
        const sunMat = new THREE.MeshBasicMaterial({
          color: 0xffd166,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const crownMat = new THREE.MeshBasicMaterial({
          color: 0xfff3b0,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(sunMat, crownMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, sunMat);
        ringMesh.position.set(tx, ty + 0.12, tz);
        ringMesh.scale.setScalar(radius * 0.96);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedRuneSquareGeo, crownMat);
        outerRingMesh.position.set(tx, ty + 0.15, tz);
        outerRingMesh.scale.setScalar(radius * 0.72);
        group.add(outerRingMesh);

        const thirdRingMesh = new THREE.Mesh(sharedHazRingGeo, sunMat);
        thirdRingMesh.position.set(tx, ty + 0.17, tz);
        thirdRingMesh.scale.setScalar(radius * 0.42);
        group.add(thirdRingMesh);

        const floatingCrown = new THREE.Group();
        floatingCrown.position.set(tx, ty + 3.4, tz);
        const halo1 = new THREE.Mesh(sharedRiftTorusGeo, crownMat);
        halo1.rotation.x = Math.PI / 2;
        halo1.scale.setScalar(1.35);
        const halo2 = new THREE.Mesh(sharedRiftTorusGeo, sunMat);
        halo2.rotation.x = Math.PI / 3;
        halo2.scale.setScalar(0.95);
        floatingCrown.add(halo1, halo2);
        group.add(floatingCrown);

        const motes: PowerMote[] = [];
        for (let i = 0; i < 26; i++) {
          const angle = (i / 26) * Math.PI * 2;
          const dist = (0.15 + ((i * 41) % 85) / 100) * radius * 0.92;
          const m = new THREE.Mesh(sharedOrbMoteGeo, i % 2 === 0 ? crownMat : sunMat);
          m.scale.setScalar(0.8 + (i % 3) * 0.25);
          group.add(m);
          motes.push({
            mesh: m,
            angle,
            dist,
            speed: 1.5 + (i % 4) * 0.35,
            phase: (i * 0.25) % 4.0,
            height: 4.2,
          });
        }

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'golden_dawn',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 5.5,
          impactDelay: 0.25,
          deferImpact,
          tx,
          ty,
          tz,
          radius,
          impactFired: false,
          ringMesh,
          outerRingMesh,
          thirdRingMesh,
          floatingCrown,
          motes,
          particleEmitTimer: 0,
          colorHex,
        });
        return;
      }

      // 7. DIVINE SHIELD (divine_shield): Expanding crystalline Aegis hemisphere & repulsion wave
      if (type === 'divine_shield') {
        const domeMat = new THREE.MeshBasicMaterial({
          color: 0x72efdd,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x90e0ef,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(domeMat, ringMat);

        const explosionDome = new THREE.Mesh(sharedExplosionDomeGeo, domeMat);
        explosionDome.position.set(tx, ty + 0.05, tz);
        explosionDome.scale.setScalar(0.2);
        group.add(explosionDome);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        ringMesh.scale.setScalar(0.3);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, domeMat);
        outerRingMesh.position.set(tx, ty + 0.18, tz);
        outerRingMesh.scale.setScalar(0.2);
        group.add(outerRingMesh);

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'shield_pulse',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 1.75,
          impactDelay: 0.18,
          deferImpact,
          tx,
          ty,
          tz,
          radius,
          impactFired: false,
          explosionDome,
          ringMesh,
          outerRingMesh,
          colorHex,
        });
        return;
      }

      // 8. BLOODLUST FURY (bloodlust_frenzy): Crimson war-arena sigil & fast-whirling horizontal ember cyclone
      if (type === 'bloodlust_frenzy') {
        const crimsonMat = new THREE.MeshBasicMaterial({
          color: 0xe63946,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const emberMat = new THREE.MeshBasicMaterial({
          color: 0xff7b00,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(crimsonMat, emberMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, crimsonMat);
        ringMesh.position.set(tx, ty + 0.12, tz);
        ringMesh.scale.setScalar(radius * 0.94);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedRuneSquareGeo, emberMat);
        outerRingMesh.position.set(tx, ty + 0.15, tz);
        outerRingMesh.scale.setScalar(radius * 0.72);
        group.add(outerRingMesh);

        const motes: PowerMote[] = [];
        for (let i = 0; i < 22; i++) {
          const angle = (i / 22) * Math.PI * 2;
          const dist = (0.28 + ((i * 19) % 70) / 100) * radius * 0.92;
          const m = new THREE.Mesh(sharedShardMoteGeo, i % 3 === 0 ? emberMat : crimsonMat);
          m.rotation.z = 0.55;
          group.add(m);
          motes.push({
            mesh: m,
            angle,
            dist,
            speed: 4.5 + (i % 4) * 0.85,
            phase: i * 0.4,
            height: 0.45 + (i % 5) * 0.35,
          });
        }

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'fury_vortex',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 4.4,
          impactDelay: 0.2,
          deferImpact,
          tx,
          ty,
          tz,
          radius,
          impactFired: false,
          ringMesh,
          outerRingMesh,
          motes,
          particleEmitTimer: 0,
          colorHex,
        });
        return;
      }

      // 9. ABYSSAL CURSE (curse): Inward-collapsing dark void eclipse rings & curling shadow wisps
      if (type === 'curse') {
        const violetMat = new THREE.MeshBasicMaterial({
          color: 0x9d4edd,
          transparent: true,
          opacity: 0.88,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const voidMat = new THREE.MeshBasicMaterial({
          color: 0x3c096c,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(violetMat, voidMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, violetMat);
        ringMesh.position.set(tx, ty + 0.12, tz);
        ringMesh.scale.setScalar(radius * 0.96);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, voidMat);
        outerRingMesh.position.set(tx, ty + 0.15, tz);
        outerRingMesh.scale.setScalar(radius * 0.85);
        group.add(outerRingMesh);

        const motes: PowerMote[] = [];
        for (let i = 0; i < 22; i++) {
          const angle = (i / 22) * Math.PI * 2;
          const dist = (0.25 + ((i * 31) % 75) / 100) * radius * 0.95;
          const m = new THREE.Mesh(sharedShardMoteGeo, i % 2 === 0 ? violetMat : voidMat);
          m.scale.set(0.9, 1.35, 0.9);
          group.add(m);
          motes.push({
            mesh: m,
            angle,
            dist,
            speed: 1.35 + (i % 4) * 0.3,
            phase: (i * 0.31) % 3.2,
            height: 2.8,
          });
        }

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'curse_eclipse',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 4.5,
          impactDelay: 0.24,
          deferImpact,
          tx,
          ty,
          tz,
          radius,
          impactFired: false,
          ringMesh,
          outerRingMesh,
          motes,
          particleEmitTimer: 0,
          colorHex,
        });
        return;
      }

      // 10. PLAGUE MIASMA (plague_miasma): Bubbling bio-toxic mire globules swelling & popping from the ground
      if (type === 'plague_miasma') {
        const toxicMat = new THREE.MeshBasicMaterial({
          color: 0x80ed99,
          transparent: true,
          opacity: 0.86,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const mireMat = new THREE.MeshBasicMaterial({
          color: 0x38b000,
          transparent: true,
          opacity: 0.82,
        });
        materials.push(toxicMat, mireMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, toxicMat);
        ringMesh.position.set(tx, ty + 0.12, tz);
        ringMesh.scale.setScalar(radius * 0.94);
        group.add(ringMesh);

        const motes: PowerMote[] = [];
        for (let i = 0; i < 18; i++) {
          const angle = (i / 18) * Math.PI * 2 + (i % 3) * 0.3;
          const dist = (0.12 + ((i * 23) % 85) / 100) * radius * 0.85;
          const m = new THREE.Mesh(sharedHazSphereGeo, i % 2 === 0 ? toxicMat : mireMat);
          group.add(m);
          motes.push({
            mesh: m,
            angle,
            dist,
            speed: 1.6 + (i % 4) * 0.35,
            phase: (i * 0.22) % 2.0,
            height: 2.2,
          });
        }

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'plague_eruption',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 3.5,
          impactDelay: 0.24,
          deferImpact,
          tx,
          ty,
          tz,
          radius,
          impactFired: false,
          ringMesh,
          motes,
          particleEmitTimer: 0,
          colorHex,
        });
        return;
      }

      // 11. ORBITAL TERRAFORM (terraform_beam): Stacked horizontal tectonic scanning rings & levitating earth blocks
      if (type === 'terraform_beam') {
        const terraMat = new THREE.MeshBasicMaterial({
          color: 0x06d6a0,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const gridMat = new THREE.MeshBasicMaterial({
          color: 0x90e0ef,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(terraMat, gridMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, terraMat);
        ringMesh.position.set(tx, ty + 0.12, tz);
        ringMesh.scale.setScalar(radius * 0.98);
        group.add(ringMesh);

        const strataRings: THREE.Mesh[] = [];
        for (let s = 0; s < 4; s++) {
          const sr = new THREE.Mesh(s % 2 === 0 ? sharedHazRingGeo : sharedRuneSquareGeo, s % 2 === 0 ? terraMat : gridMat);
          sr.position.set(tx, ty + 1.5 + s * 1.4, tz);
          sr.scale.setScalar(radius * (0.92 - s * 0.14));
          group.add(sr);
          strataRings.push(sr);
        }

        const motes: PowerMote[] = [];
        for (let i = 0; i < 20; i++) {
          const angle = (i / 20) * Math.PI * 2;
          const dist = (0.2 + ((i * 33) % 78) / 100) * radius * 0.88;
          const m = new THREE.Mesh(sharedHazSphereGeo, i % 2 === 0 ? terraMat : gridMat);
          m.scale.set(0.38, 0.38, 0.38);
          group.add(m);
          motes.push({
            mesh: m,
            angle,
            dist,
            speed: 1.5 + (i % 4) * 0.3,
            phase: (i * 0.25) % 3.0,
            height: 3.6,
          });
        }

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'terraform_strata',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 3.8,
          impactDelay: 0.34,
          deferImpact,
          tx,
          ty,
          tz,
          radius,
          impactFired: false,
          ringMesh,
          strataRings,
          motes,
          particleEmitTimer: 0,
          colorHex,
        });
        return;
      }

      // 12. SINGULARITY RIFT (wormhole_ascension): Gravitational inward implosion & relativistic accretion disk wave
      if (type === 'wormhole_ascension') {
        const riftMat = new THREE.MeshBasicMaterial({
          color: 0xc77dff,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const cyanMat = new THREE.MeshBasicMaterial({
          color: 0x56cfe1,
          transparent: true,
          opacity: 0.88,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(riftMat, cyanMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, riftMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        ringMesh.scale.setScalar(radius * 1.15);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, cyanMat);
        outerRingMesh.position.set(tx, ty + 1.8, tz);
        outerRingMesh.scale.setScalar(radius * 1.25);
        group.add(outerRingMesh);

        const motes: PowerMote[] = [];
        for (let i = 0; i < 24; i++) {
          const angle = (i / 24) * Math.PI * 2;
          const dist = (0.35 + ((i * 29) % 75) / 100) * radius * 1.2;
          const m = new THREE.Mesh(sharedOrbMoteGeo, i % 2 === 0 ? riftMat : cyanMat);
          m.scale.setScalar(0.85);
          group.add(m);
          motes.push({
            mesh: m,
            angle,
            dist,
            speed: 3.6 + (i % 4) * 0.65,
            phase: i * 0.35,
            height: 1.8 + ((i % 5) - 2) * 0.45,
          });
        }

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'rift_implosion',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 3.8,
          impactDelay: 0.34,
          deferImpact,
          tx,
          ty,
          tz,
          radius,
          impactFired: false,
          ringMesh,
          outerRingMesh,
          motes,
          particleEmitTimer: 0,
          colorHex,
        });
        return;
      }

      if (type === 'earthquake') {
        const quakeAmberMat = new THREE.MeshBasicMaterial({
          color: 0xe07a2b,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const quakeHotMat = new THREE.MeshBasicMaterial({
          color: 0xffbe5c,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        });
        const spireMat = new THREE.MeshStandardMaterial({
          color: 0x6b6057,
          roughness: 0.92,
          flatShading: true,
        });
        materials.push(quakeAmberMat, quakeHotMat, spireMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, quakeAmberMat);
        ringMesh.position.set(tx, ty + 0.12, tz);
        ringMesh.scale.setScalar(0.5);
        group.add(ringMesh);

        const segs =
          faultSegments && faultSegments.length > 0
            ? faultSegments
            : [{ x1: tx - 3, z1: tz, x2: tx + 3, z2: tz, width: 1, upliftBias: 0.6 }];

        const crackMeshes: THREE.Mesh[] = [];
        const spikes: THREE.Mesh[] = [];
        const isOrogenic = quakeShapeKind === 'orogenic_uplift';

        for (let si = 0; si < segs.length; si++) {
          const s = segs[si];
          const dx = s.x2 - s.x1;
          const dz = s.z2 - s.z1;
          const len = Math.max(0.6, Math.hypot(dx, dz));
          const angle = Math.atan2(dz, dx);

          const crack = new THREE.Mesh(sharedFaultCrackGeo, quakeHotMat);
          crack.position.set((s.x1 + s.x2) * 0.5, ty + 0.15, (s.z1 + s.z2) * 0.5);
          crack.rotation.y = -angle;
          crack.scale.set(0.01, 0.7, Math.max(0.28, s.width * (s.isBranch ? 0.36 : 0.54)));
          crack.userData.targetLen = len + 0.4;
          crack.userData.revealOffset = Math.min(0.6, (si / Math.max(1, segs.length)) * 0.42);
          group.add(crack);
          crackMeshes.push(crack);

          const spireCount = isOrogenic ? 4 : s.isBranch ? 2 : 3;
          const perpX = -dz / len;
          const perpZ = dx / len;
          for (let k = 0; k < spireCount; k++) {
            const frac = (k + 0.5) / spireCount;
            const alongX = s.x1 + dx * frac;
            const alongZ = s.z1 + dz * frac;
            const sideSign = (si + k) % 2 === 0 ? 1 : -1;
            const lateral = (isOrogenic ? 0.55 + ((k * 37) % 10) * 0.14 : 0.9 + ((k * 23) % 10) * 0.13) * s.width;
            const sp = new THREE.Mesh(sharedPillarSpikeGeo, spireMat);
            sp.position.set(alongX + perpX * lateral * sideSign, ty, alongZ + perpZ * lateral * sideSign);
            sp.rotation.set(
              (((si * 7 + k) % 5) - 2) * 0.15,
              angle + k * 0.9,
              (((si + k * 3) % 3) - 1) * 0.18,
            );
            const targetH = isOrogenic
              ? 1.15 + ((si + k * 3) % 4) * 0.38
              : 0.55 + Math.max(0, s.upliftBias) * 0.45 + ((si + k) % 3) * 0.25;
            const targetW = isOrogenic ? 1.08 : 0.78 + (s.isBranch ? -0.1 : 0.12);
            sp.userData.targetH = targetH;
            sp.userData.targetW = targetW;
            sp.userData.revealOffset = Math.min(0.65, (si / Math.max(1, segs.length)) * 0.45 + frac * 0.12);
            sp.scale.set(targetW, 0.01, targetW);
            group.add(sp);
            spikes.push(sp);
          }
        }

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'earthquake_quake',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: quakeShapeKind === 'short_rupture' ? 2.6 : quakeShapeKind === 'long_rift' ? 3.8 : 3.3,
          impactDelay: 0.06,
          deferImpact,
          tx,
          ty,
          tz,
          radius,
          impactFired: false,
          ringMesh,
          crackMeshes,
          spikes,
          faultSegments: segs,
          quakeShapeKind,
          particleEmitTimer: 0,
          colorHex,
        });
        return;
      }

      // Utility events (terrain_sculpt, epoch_up): Clean ground ripple without any beam pillar
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.78,
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
      materials.push(ringMat, outerRingMat);

      const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
      ringMesh.position.set(tx, ty + 0.1, tz);
      ringMesh.scale.setScalar(radius * 0.55);
      group.add(ringMesh);

      const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, outerRingMat);
      outerRingMesh.position.set(tx, ty + 0.15, tz);
      outerRingMesh.scale.setScalar(radius * 0.35);
      group.add(outerRingMesh);

      burstFxGroup.add(group);
      activeBurstFx.push({
        kind: 'ripple_ring',
        powerType: type,
        group,
        materials,
        age: 0,
        duration: 0.95,
        impactDelay: 0.05,
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
    }

    const _zUnitAxis = new THREE.Vector3(0, 0, 1);
    const _mawWorldPos = new THREE.Vector3();
    const _segVecTemp = new THREE.Vector3();
    const _segDirTemp = new THREE.Vector3();

    function spawnDragonFireBreath(
      ox: number,
      oy: number,
      oz: number,
      tx: number,
      ty: number,
      tz: number,
      radius: number,
      colorHex: string,
      sourceUnitId?: string,
    ) {
      if (sourceUnitId) {
        const existing = activeBurstFx.find(
          (f) => f.kind === 'dragon_flame' && f.sourceUnitId === sourceUnitId,
        );
        if (existing) {
          existing.age = Math.min(existing.age, 0.14);
          existing.duration = 0.68;
          existing.tx = tx;
          existing.ty = ty + 0.25;
          existing.tz = tz;
          existing.impactFired = false;
          existing.impactDelay = 0.04;
          triggerLightFlash(tx, ty + 1.2, tz, colorHex, 18);
          spawnParticleBurst(tx, ty + 0.2, tz, 14, colorHex, 1.15, 4.2, 1.1);
          return;
        }
      }

      const group = new THREE.Group();
      const outerCol = new THREE.Color(colorHex);
      const coreCol = outerCol.clone().lerp(new THREE.Color(0xffffff), 0.54);
      const outerMat = new THREE.MeshBasicMaterial({
        color: outerCol,
        map: spriteBundle.breathScrollTexture,
        transparent: true,
        opacity: 0.86,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const coreMat = new THREE.MeshBasicMaterial({
        color: coreCol,
        map: spriteBundle.breathScrollTexture,
        transparent: true,
        opacity: 0.96,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMat = new THREE.MeshBasicMaterial({
        color: outerCol,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const materials: THREE.Material[] = [outerMat, coreMat, ringMat];

      // Compute exact 3D vector from dragon's aerial jaw to ground target
      let mouthX = ox;
      let mouthY = oy;
      let mouthZ = oz;
      const uEntry = sourceUnitId ? unitMeshes.get(sourceUnitId) : undefined;
      if (uEntry) {
        uEntry.group.updateMatrixWorld(true);
        const mawObj = uEntry.group.getObjectByName('fire_maw') ?? uEntry.group;
        mawObj.getWorldPosition(_mawWorldPos);
        mouthX = _mawWorldPos.x;
        mouthY = _mawWorldPos.y;
        mouthZ = _mawWorldPos.z;
      } else {
        const dx = tx - ox;
        const dy = ty - oy;
        const dz = tz - oz;
        const dist = Math.max(0.6, Math.hypot(dx, dy, dz));
        mouthX = ox + (dx / dist) * 1.15;
        mouthY = oy + (dy / dist) * 0.25;
        mouthZ = oz + (dz / dist) * 1.15;
      }

      _segVecTemp.set(tx - mouthX, ty + 0.25 - mouthY, tz - mouthZ);
      const segLen = Math.max(0.5, _segVecTemp.length());
      _segDirTemp.copy(_segVecTemp).divideScalar(segLen);

      const flameOuterCone = new THREE.Mesh(sharedFlameOuterGeo, outerMat);
      flameOuterCone.position.set(mouthX, mouthY, mouthZ);
      flameOuterCone.quaternion.setFromUnitVectors(_zUnitAxis, _segDirTemp);
      flameOuterCone.scale.set(0.95, 0.95, 0.15);
      group.add(flameOuterCone);

      const flameCoreCone = new THREE.Mesh(sharedFlameCoreGeo, coreMat);
      flameCoreCone.position.set(mouthX, mouthY, mouthZ);
      flameCoreCone.quaternion.copy(flameOuterCone.quaternion);
      flameCoreCone.scale.set(0.85, 0.85, 0.15);
      group.add(flameCoreCone);

      const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
      ringMesh.position.set(tx, ty + 0.14, tz);
      ringMesh.scale.setScalar(0.3);
      group.add(ringMesh);

      triggerLightFlash(tx, ty + 1.2, tz, colorHex, 20);
      spawnDirectionalFlameStream(mouthX, mouthY, mouthZ, tx, ty + 0.25, tz, 20, colorHex, 0.55);

      burstFxGroup.add(group);
      activeBurstFx.push({
        kind: 'dragon_flame',
        powerType: 'dragon_fire_breath',
        sourceUnitId,
        group,
        materials,
        age: 0,
        duration: 0.72,
        impactDelay: 0.08,
        deferImpact: false,
        tx,
        ty: ty + 0.25,
        tz,
        ox: mouthX,
        oy: mouthY,
        oz: mouthZ,
        radius: Math.max(1.2, segLen, radius),
        impactFired: false,
        flameCoreCone,
        flameOuterCone,
        ringMesh,
        particleEmitTimer: 0,
        colorHex,
      });
    }

    function spawnAnimalAttackVisual(
      variant: string,
      ox: number,
      oy: number,
      oz: number,
      tx: number,
      ty: number,
      tz: number,
      radius: number,
      colorHex: string,
    ) {
      const group = new THREE.Group();
      const slashMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const whiteMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const materials: THREE.Material[] = [slashMat, whiteMat, ringMat];

      const slashMeshes: THREE.Mesh[] = [];
      const yaw = Math.atan2(tx - ox, tz - oz);

      if (variant === 'bite' || variant === 'crunch') {
        // Crossed glowing claw/fang slash blades snapping across the target
        const slashCount = variant === 'crunch' ? 4 : 3;
        const slashSpread = variant === 'crunch' ? 1.35 : 0.92;
        for (let i = 0; i < slashCount; i++) {
          const m = new THREE.Mesh(sharedSlashBladeGeo, i % 2 === 0 ? slashMat : whiteMat);
          m.position.set(tx, ty + 0.52 + (i - 1) * 0.12, tz);
          m.rotation.set(0.35, yaw + (i % 2 === 0 ? 0.55 : -0.55), (i % 2 === 0 ? 1 : -1) * 0.62);
          m.scale.set(slashSpread, 1, 1);
          group.add(m);
          slashMeshes.push(m);
        }
        spawnParticleBurst(tx, ty + 0.45, tz, variant === 'crunch' ? 28 : 18, colorHex, radius * 0.65, 5.2, 1.1);
        spawnParticleBurst(tx, ty + 0.45, tz, 10, '#ffffff', radius * 0.4, 6.0, 0.85);
      } else if (variant === 'slam') {
        // Bear heavy ground-pound radial claw blades + shockwave dome
        for (let i = 0; i < 4; i++) {
          const a = yaw + (i - 1.5) * 0.35;
          const m = new THREE.Mesh(sharedSlamClawGeo, i % 2 === 0 ? slashMat : whiteMat);
          m.position.set(tx + Math.sin(a) * 0.25, ty + 0.26, tz + Math.cos(a) * 0.25);
          m.rotation.y = a;
          group.add(m);
          slashMeshes.push(m);
        }
        spawnParticleBurst(tx, ty + 0.3, tz, 26, '#d97706', radius * 0.85, 5.6, 1.15);
        spawnParticleBurst(tx, ty + 0.3, tz, 14, '#fef3c7', radius * 0.55, 6.2, 0.9);
      } else if (variant === 'horn_blast') {
        // Unicorn radiant prismatic starburst crescent & sparkles
        for (let i = 0; i < 3; i++) {
          const m = new THREE.Mesh(sharedHornStarGeo, i === 0 ? whiteMat : slashMat);
          m.position.set(tx, ty + 0.55, tz);
          m.rotation.y = yaw + i * 0.7;
          group.add(m);
          slashMeshes.push(m);
        }
        spawnRisingParticles(tx, ty + 0.25, tz, 22, colorHex, radius * 0.8, 3.6, 1.1, 1.1);
      } else {
        spawnParticleBurst(tx, ty + 0.35, tz, 14, colorHex, 0.55, 4.0, 0.9);
      }

      const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
      ringMesh.position.set(tx, ty + 0.12, tz);
      ringMesh.scale.setScalar(0.35);
      group.add(ringMesh);

      const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, whiteMat);
      outerRingMesh.position.set(tx, ty + 0.15, tz);
      outerRingMesh.scale.setScalar(0.25);
      group.add(outerRingMesh);

      burstFxGroup.add(group);
      activeBurstFx.push({
        kind: 'animal_strike',
        powerType: 'animal_attack',
        group,
        materials,
        age: 0,
        duration: variant === 'crunch' || variant === 'slam' ? 0.56 : 0.44,
        impactDelay: 0.02,
        deferImpact: false,
        tx,
        ty,
        tz,
        ox,
        oy,
        oz,
        variant,
        radius,
        impactFired: true,
        ringMesh,
        outerRingMesh,
        slashMeshes,
        colorHex,
      });
    }

    // Camera state
    const camTarget = new THREE.Vector3(gridCenter, 1.2, gridCenter);
    const camDesiredTarget = new THREE.Vector3(gridCenter, 1.2, gridCenter);
    let camYaw = Math.PI / 4; // 45 deg true isometric
    let camDesiredYaw = Math.PI / 4;
    let desiredFrustum =
      propsRef.current.gameState === 'title' ? 22 : getWholeMapFrustum(sim.gridSize);
    let prevGameState: GameLifecycleState = propsRef.current.gameState;
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
    let hoveredEntityInternal: string | null = null;
    const _pickCenter = new THREE.Vector3();
    const _pickDelta = new THREE.Vector3();

    const getUnitInspectMetrics = (u: UnitEntity) => {
      if (u.role === 'dragon') {
        return { pickRadius: 1.65, ringScale: 1.75, bodyHeight: 1.55, centerOffsetY: 0.65 };
      }
      if (u.role === 'dinosaur') {
        return { pickRadius: 1.05, ringScale: 1.32, bodyHeight: 1.8, centerOffsetY: 0.78 };
      }
      if (u.role === 'bear' || u.role === 'unicorn') {
        return { pickRadius: 0.82, ringScale: 1.15, bodyHeight: 1.38, centerOffsetY: 0.56 };
      }
      if (u.role === 'raider_behemoth') {
        return { pickRadius: 0.78, ringScale: 1.15, bodyHeight: 1.52, centerOffsetY: 0.68 };
      }
      if (u.role === 'cow' || u.role === 'pig' || u.role === 'wolf' || u.role === 'capybara') {
        return { pickRadius: 0.68, ringScale: 0.96, bodyHeight: 0.98, centerOffsetY: 0.42 };
      }
      if (u.role === 'chicken') {
        return { pickRadius: 0.54, ringScale: 0.76, bodyHeight: 0.78, centerOffsetY: 0.32 };
      }
      if (u.ageStage === 'child') {
        return { pickRadius: 0.54, ringScale: 0.78, bodyHeight: 1.04, centerOffsetY: 0.45 };
      }
      return { pickRadius: 0.65, ringScale: 0.92, bodyHeight: 1.35, centerOffsetY: 0.62 };
    };

    const pickLivingUnitAtRay = (ray: THREE.Ray): string | null => {
      const simUnits = simRef.current.units;
      const gSize = simRef.current.gridSize;
      let bestId: string | null = null;
      let bestScore = Infinity;

      for (let i = 0; i < simUnits.length; i++) {
        const u = simUnits[i];
        if (u.state === 'ko') continue;
        const metrics = getUnitInspectMetrics(u);
        const uGroup = unitMeshes.get(u.id)?.group;
        let ux = u.x;
        let uz = u.z;
        let uy = 0.5;
        if (uGroup) {
          ux = uGroup.position.x;
          uy = uGroup.position.y;
          uz = uGroup.position.z;
        } else {
          const tx = Math.round(THREE.MathUtils.clamp(u.x, 0, gSize - 1));
          const tz = Math.round(THREE.MathUtils.clamp(u.z, 0, gSize - 1));
          const t = simRef.current.tiles[tz * gSize + tx];
          uy = t ? Math.max(0.18, t.height * HEIGHT_STEP + 0.25) : 0.5;
        }

        _pickCenter.set(ux, uy + metrics.centerOffsetY, uz);
        const distSq = ray.distanceSqToPoint(_pickCenter);
        if (distSq <= metrics.pickRadius * metrics.pickRadius) {
          const along = _pickDelta.subVectors(_pickCenter, ray.origin).dot(ray.direction);
          const score = along + distSq * 0.35;
          if (score < bestScore) {
            bestScore = score;
            bestId = u.id;
          }
        }
      }
      return bestId;
    };

    let isPointerDragging = false;
    let dragStartClient = { x: 0, y: 0 };
    let pointerDownMoved = false;

    let renderWidth = 320;
    let renderHeight = 180;

    const updateSize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      const pxScale = Math.max(1, propsRef.current.pixelScale || 3);
      const rw = Math.max(160, Math.floor(w / pxScale));
      const rh = Math.max(100, Math.floor(h / pxScale));
      renderWidth = rw;
      renderHeight = rh;

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

      if (propsRef.current.activeTool.kind === 'inspect') {
        const pickedUnit = pickLivingUnitAtRay(raycaster.ray);
        if (pickedUnit !== hoveredEntityInternal) {
          hoveredEntityInternal = pickedUnit;
          propsRef.current.onHoverEntityChange?.(pickedUnit);
        }
      } else if (hoveredEntityInternal !== null) {
        hoveredEntityInternal = null;
        propsRef.current.onHoverEntityChange?.(null);
      }

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
      } else if (hoveredTileCoords !== null) {
        hoveredTileCoords = null;
        propsRef.current.onHoverTileChange(null);
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
        camDesiredTarget.x = THREE.MathUtils.clamp(camDesiredTarget.x, 2, simRef.current.gridSize - 3);
        camDesiredTarget.z = THREE.MathUtils.clamp(camDesiredTarget.z, 2, simRef.current.gridSize - 3);
        dragStartClient = { x: e.clientX, y: e.clientY };
        if (propsRef.current.followingEntityId) {
          propsRef.current.onBreakFollow?.();
        }
        return;
      }

      updateHoverTile(e.clientX, e.clientY);
    };

    const onPointerLeave = () => {
      if (hoveredEntityInternal !== null) {
        hoveredEntityInternal = null;
        propsRef.current.onHoverEntityChange?.(null);
      }
      if (hoveredTileCoords !== null) {
        hoveredTileCoords = null;
        propsRef.current.onHoverTileChange(null);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isPointerDragging) {
        isPointerDragging = false;
        return;
      }
      if (!pointerDownMoved && e.button === 0 && propsRef.current.gameState === 'playing') {
        updateHoverTile(e.clientX, e.clientY);
        if (propsRef.current.activeTool.kind === 'inspect') {
          propsRef.current.onSelectEntity?.(hoveredEntityInternal);
        }
        if (hoveredTileCoords) {
          propsRef.current.onTileInteract(hoveredTileCoords.x, hoveredTileCoords.z);
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const maxZoomOut = Math.max(105, getWholeMapFrustum(simRef.current.gridSize));
      desiredFrustum = THREE.MathUtils.clamp(desiredFrustum + e.deltaY * 0.015, 7.5, maxZoomOut);
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
    domElem.addEventListener('pointerleave', onPointerLeave);
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
    const _metroEuler = new THREE.Euler();
    let lastSyncedSim: SimulationState = sim;
    let lastSyncedEpochIndex = sim.epochIndex;
    let lastSpaceSeed = sim.seed;
    let lastZoneOverlayVersion = -1;

    function syncSceneFromSimulation(simState: SimulationState, dt: number, elapsed: number) {
      const zb = propsRef.current.zoneOverlayBuffers;
      if (zb && zb.version !== lastZoneOverlayVersion) {
        lastZoneOverlayVersion = zb.version;
        oceanFoam.updateZones(zb.colorData, zb.idData, zb.anyActive);
        styledTerrain.updateZones(zb.colorData, zb.idData, zb.anyActive);
      }

      let propsNeedSync = false;
      if (simState.epochIndex !== lastSyncedEpochIndex) {
        lastSyncedEpochIndex = simState.epochIndex;
        propsNeedSync = true;
      }

      let waterMapNeedsSync = simState !== lastSyncedSim;
      if (simState !== lastSyncedSim) {
        lastSyncedSim = simState;
        lastSyncedEpochIndex = simState.epochIndex;
        propsNeedSync = true;
        if (simState.seed !== lastSpaceSeed) {
          lastSpaceSeed = simState.seed;
          pixelSpace.setSeed(lastSpaceSeed);
        }
        for (let i = 0; i < simState.tiles.length; i++) {
          const t = simState.tiles[i];
          tileCurrentY[i] = t.height === 0 ? 0.12 : t.height * HEIGHT_STEP + 0.25;
          tileLastNodeY[i] = -999;
          tilePropSig[i] = -1;
        }
        const newCenter = (simState.gridSize - 1) / 2;
        camDesiredTarget.set(newCenter, 1.2, newCenter);
        camTarget.set(newCenter, 1.2, newCenter);
        desiredFrustum =
          propsRef.current.gameState === 'title' ? 22 : getWholeMapFrustum(simState.gridSize);
      }

      // 1. Update instanced terrain tiles & detect if props/nodes/water-map need rebuild
      for (const tType of TERRAIN_TYPES) {
        const inst = terrainInstancedMap.get(tType)!;
        inst.count = 0;
      }

      const activeTsunamis = (simState.activeHazards ?? []).filter((h) => h.kind === 'tsunami_wave');
      const activeQuakes = (simState.activeHazards ?? [])
        .filter((h) => h.kind === 'earthquake_zone')
        .map((qh) => {
          let minX = qh.x - qh.radius * 1.25;
          let maxX = qh.x + qh.radius * 1.25;
          let minZ = qh.z - qh.radius * 1.25;
          let maxZ = qh.z + qh.radius * 1.25;
          if (qh.faultSegments) {
            for (let si = 0; si < qh.faultSegments.length; si++) {
              const seg = qh.faultSegments[si];
              const pad = seg.width * 3.0 + 1.5;
              if (seg.x1 - pad < minX) minX = seg.x1 - pad;
              if (seg.x2 - pad < minX) minX = seg.x2 - pad;
              if (seg.x1 + pad > maxX) maxX = seg.x1 + pad;
              if (seg.x2 + pad > maxX) maxX = seg.x2 + pad;
              if (seg.z1 - pad < minZ) minZ = seg.z1 - pad;
              if (seg.z2 - pad < minZ) minZ = seg.z2 - pad;
              if (seg.z1 + pad > maxZ) maxZ = seg.z1 + pad;
              if (seg.z2 + pad > maxZ) maxZ = seg.z2 + pad;
            }
          }
          return { qh, minX, maxX, minZ, maxZ };
        });

      for (let i = 0; i < simState.tiles.length; i++) {
        const t = simState.tiles[i];
        // Water base boxes sit cleanly submerged under the animated shader ocean surface unless lifted by a 3D Tsunami swell
        let targetTopY = t.height === 0 ? 0.12 : t.height * HEIGHT_STEP + 0.25;
        if (activeTsunamis.length > 0 && t.height <= 2) {
          for (let ti = 0; ti < activeTsunamis.length; ti++) {
            const th = activeTsunamis[ti];
            const curR = th.currentRadius ?? th.radius;
            const dist = Math.hypot(t.x - th.x, t.z - th.z);
            const fade = Math.min(1, th.remaining / 1.2);
            const diffPrimary = Math.abs(dist - curR);
            if (diffPrimary < 2.6) {
              const bell = Math.cos((diffPrimary / 2.6) * (Math.PI * 0.5));
              if (t.height === 0) {
                targetTopY = Math.max(targetTopY, 0.36 + bell * 1.18 * fade);
              } else {
                targetTopY += bell * 0.26 * fade;
              }
            } else if (curR > 3.8 && t.height === 0) {
              const wakeR = curR * 0.65;
              const diffWake = Math.abs(dist - wakeR);
              if (diffWake < 1.9) {
                const wakeBell = Math.cos((diffWake / 1.9) * (Math.PI * 0.5));
                targetTopY = Math.max(targetTopY, 0.34 + wakeBell * 0.68 * fade);
              }
            }
          }
        }
        let quakeJoltY = 0;
        if (activeQuakes.length > 0 && t.height > 0) {
          for (let qi = 0; qi < activeQuakes.length; qi++) {
            const { qh, minX, maxX, minZ, maxZ } = activeQuakes[qi];
            if (t.x < minX || t.x > maxX || t.z < minZ || t.z > maxZ) continue;
            const segs = qh.faultSegments;
            let strength = 0;
            if (segs && segs.length > 0) {
              const hit = closestFaultDistanceSq(t.x, t.z, segs);
              const reach = (hit.segment?.width ?? 1) * 3.1;
              if (hit.distSq <= reach * reach) {
                strength = (1 - Math.sqrt(hit.distSq) / reach) * Math.min(1, qh.remaining / 1.0);
              }
            } else {
              const dx = t.x - qh.x;
              const dz = t.z - qh.z;
              const distSq = dx * dx + dz * dz;
              const rSq = qh.radius * qh.radius * 1.44;
              if (distSq <= rSq) {
                strength = (1 - Math.sqrt(distSq) / (qh.radius * 1.2)) * Math.min(1, qh.remaining / 1.0);
              }
            }
            if (strength > 0) {
              quakeJoltY += Math.sin(elapsed * 42 + t.x * 3.1 + t.z * 2.7) * 0.075 * strength;
            }
          }
        }
        const curY =
          Math.abs(tileCurrentY[i] - targetTopY) > 0.001
            ? THREE.MathUtils.damp(tileCurrentY[i], targetTopY, 14, dt)
            : targetTopY;
        tileCurrentY[i] = curY;

        const inst = terrainInstancedMap.get(t.terrain) ?? terrainInstancedMap.get('grass')!;
        const slot = inst.count;
        inst.count = slot + 1;
        terrainInstanceToTile.get(inst)![slot] = i;

        const renderTopY = curY + quakeJoltY;
        _dummyPos.set(t.x, renderTopY, t.z);
        _dummyQuat.identity();
        _dummyScale.set(1, Math.max(0.2, renderTopY + 0.6), 1);
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
            if (t.terrain === 'jungle') {
              targetInst = timberJungleInsts[h % timberJungleInsts.length];
            } else if (t.terrain === 'taiga') {
              targetInst = timberTaigaInsts[h % timberTaigaInsts.length];
            } else if (t.terrain === 'blossom') {
              targetInst = timberBlossomInsts[h % timberBlossomInsts.length];
            } else {
              targetInst = timberInsts[h % timberInsts.length];
            }
          } else if (t.resourceNode === 'berry_bush') {
            if (t.farmSettlementId && simState.epochIndex >= 6) {
              targetInst = sciFiFarmInsts[h % sciFiFarmInsts.length];
            } else if (t.farmSettlementId && simState.epochIndex >= 1) {
              targetInst = farmCropInsts[h % farmCropInsts.length];
            } else {
              targetInst = berryInsts[h % berryInsts.length];
            }
          } else if (t.resourceNode === 'stone_outcrop') {
            targetInst = stoneInsts[h % stoneInsts.length];
          } else if (t.resourceNode === 'ore_vein') {
            targetInst = oreInsts[h % oreInsts.length];
          } else if (t.resourceNode === 'crystal_monolith') {
            targetInst = crystalInsts[h % crystalInsts.length];
          } else {
            // Ambient multi-object sub-tile details on open land for lively biome density
            const chance = (h >> 4) % 100;
            if ((t.terrain === 'grass' || (t.terrain === 'fertile' && !t.farmSettlementId)) && chance < 48) {
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
            } else if (t.terrain === 'jungle' && chance < 72) {
              targetInst = ambJungleInsts[h % ambJungleInsts.length];
            } else if (t.terrain === 'mountain' && chance < 62) {
              targetInst = ambMountainInsts[h % ambMountainInsts.length];
            } else if (t.terrain === 'taiga' && chance < 58) {
              targetInst = ambTaigaInsts[h % ambTaigaInsts.length];
            } else if (t.terrain === 'tundra' && chance < 52) {
              targetInst = ambTundraInsts[h % ambTundraInsts.length];
            } else if (t.terrain === 'badlands' && chance < 58) {
              targetInst = ambBadlandsInsts[h % ambBadlandsInsts.length];
            } else if (t.terrain === 'blossom' && chance < 66) {
              targetInst = ambBlossomInsts[h % ambBlossomInsts.length];
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

        // Rebuild Elevated Metro Viaducts (Epoch 5+) & Dedicated Runway Edge Beacons
        for (const mInst of allMetroInsts) mInst.count = 0;

        if (simState.epochIndex >= 6) {
          metroConcreteMat.color.setHex(0xcbd5e1);
          metroConcreteMat.metalness = 0.28;
          metroConcreteMat.roughness = 0.42;
          metroParapetMat.color.setHex(0x334155);
          metroRailMat.color.setHex(0x56cfe1);
          metroRailMat.emissive.setHex(0x38bdf8);
          metroRailMat.emissiveIntensity = 0.95;
        } else {
          metroConcreteMat.color.setHex(0x8d99ae);
          metroConcreteMat.metalness = 0.08;
          metroConcreteMat.roughness = 0.78;
          metroParapetMat.color.setHex(0x5c677d);
          metroRailMat.color.setHex(0xe2e8f0);
          metroRailMat.emissive.setHex(0x000000);
          metroRailMat.emissiveIntensity = 0;
        }

        const gs = simState.gridSize;
        const bldTypeAt = new Map<number, string>();
        for (let bi = 0; bi < simState.buildings.length; bi++) {
          const bld = simState.buildings[bi];
          bldTypeAt.set(bld.tileZ * gs + bld.tileX, bld.type);
        }

        const isRailOrStationAt = (tx: number, tz: number) => {
          if (tx < 0 || tz < 0 || tx >= gs || tz >= gs) return false;
          const tileIdx = tz * gs + tx;
          const tile = simState.tiles[tileIdx];
          if (!tile || tile.height <= 0) return false;
          return tile.terrain === 'rail_track' || bldTypeAt.get(tileIdx) === 'rail_station';
        };

        const isElevatedNodeAt = (tx: number, tz: number) => {
          if (tx < 0 || tz < 0 || tx >= gs || tz >= gs) return false;
          const tileIdx = tz * gs + tx;
          const tile = simState.tiles[tileIdx];
          if (!tile || tile.height <= 0) return false;
          if (tile.terrain === 'rail_track' || bldTypeAt.get(tileIdx) === 'rail_station') {
            return true;
          }
          if (tile.terrain === 'stone_road') {
            const ewBridge = isRailOrStationAt(tx - 1, tz) && isRailOrStationAt(tx + 1, tz);
            const nsBridge = isRailOrStationAt(tx, tz - 1) && isRailOrStationAt(tx, tz + 1);
            return ewBridge || nsBridge;
          }
          return false;
        };

        const pushInst = (
          inst: THREE.InstancedMesh,
          px: number,
          py: number,
          pz: number,
          qx = 0,
          qy = 0,
          qz = 0,
          sx = 1,
          sy = 1,
          sz = 1,
        ) => {
          if (inst.count >= inst.instanceMatrix.count) return;
          _dummyPos.set(px, py, pz);
          if (qx !== 0 || qy !== 0 || qz !== 0) {
            _metroEuler.set(qx, qy, qz);
            _propQuat.setFromEuler(_metroEuler);
          } else {
            _propQuat.identity();
          }
          _dummyScale.set(sx, sy, sz);
          _dummyMatrix.compose(_dummyPos, _propQuat, _dummyScale);
          const slot = inst.count;
          inst.count = slot + 1;
          inst.setMatrixAt(slot, _dummyMatrix);
        };

        const elevatedActive = simState.epochIndex >= 5;
        for (let i = 0; i < simState.tiles.length; i++) {
          const t = simState.tiles[i];
          if (t.height <= 0) continue;
          const curY = tileCurrentY[i];

          // Runway perimeter beacons (all epochs once airport runway exists)
          if (t.terrain === 'runway') {
            const nRunway = t.z > 0 && simState.tiles[(t.z - 1) * gs + t.x]?.terrain === 'runway';
            const sRunway = t.z + 1 < gs && simState.tiles[(t.z + 1) * gs + t.x]?.terrain === 'runway';
            const wRunway = t.x > 0 && simState.tiles[t.z * gs + (t.x - 1)]?.terrain === 'runway';
            const eRunway = t.x + 1 < gs && simState.tiles[t.z * gs + (t.x + 1)]?.terrain === 'runway';
            if ((eRunway || wRunway) && !nRunway && !sRunway) {
              pushInst(runwayBeaconInst, t.x, curY + 0.055, t.z - 0.43);
              pushInst(runwayBeaconInst, t.x, curY + 0.055, t.z + 0.43);
            } else if ((nRunway || sRunway) && !eRunway && !wRunway) {
              pushInst(runwayBeaconInst, t.x - 0.43, curY + 0.055, t.z);
              pushInst(runwayBeaconInst, t.x + 0.43, curY + 0.055, t.z);
            } else {
              if (!nRunway) pushInst(runwayBeaconInst, t.x, curY + 0.055, t.z - 0.43);
              if (!sRunway) pushInst(runwayBeaconInst, t.x, curY + 0.055, t.z + 0.43);
              if (!wRunway) pushInst(runwayBeaconInst, t.x - 0.43, curY + 0.055, t.z);
              if (!eRunway) pushInst(runwayBeaconInst, t.x + 0.43, curY + 0.055, t.z);
            }
          }

          if (!elevatedActive) continue;

          const nodeHere = isElevatedNodeAt(t.x, t.z);
          if (!nodeHere) continue;

          const isStationHere = bldTypeAt.get(i) === 'rail_station';
          const isRoadBridgeHere = t.terrain === 'stone_road';

          // Support pillar + flared T-cap on elevated rail tiles (skip pillars in road traffic lanes & inside stations)
          if (t.terrain === 'rail_track' && !isStationHere) {
            pushInst(metroPillarInst, t.x, curY + 0.32, t.z);
            pushInst(metroCapInst, t.x, curY + 0.60, t.z);
          }
          // Elevated deck hub + top rail plate on track tiles & 4-way road-crossing spans
          if (t.terrain === 'rail_track' || isRoadBridgeHere) {
            pushInst(metroDeckHubInst, t.x, curY + 0.68, t.z);
            pushInst(metroRailHubInst, t.x, curY + 0.75, t.z);
          }

          // Connect East (+X) neighbor if it forms a continuous viaduct span
          if (t.x + 1 < gs && isElevatedNodeAt(t.x + 1, t.z)) {
            const eastIdx = t.z * gs + (t.x + 1);
            const eastTile = simState.tiles[eastIdx];
            const eastIsRoad = eastTile.terrain === 'stone_road';
            const eastIsStation = bldTypeAt.get(eastIdx) === 'rail_station';
            // Connect if at least one end is rail_track (or road bridge connecting rail_tracks)
            if (t.terrain === 'rail_track' || eastTile.terrain === 'rail_track' || !eastIsStation) {
              if (!(isRoadBridgeHere && eastIsRoad)) {
                const nextY = tileCurrentY[eastIdx];
                const dy = nextY - curY;
                const spanLen = Math.hypot(1, dy);
                const slopeZ = Math.atan2(dy, 1);
                const midY = (curY + nextY) * 0.5;
                pushInst(metroSpanEWInst, t.x + 0.5, midY + 0.68, t.z, 0, 0, slopeZ, spanLen, 1, 1);
                pushInst(metroRailEWInst, t.x + 0.5, midY + 0.755, t.z - 0.14, 0, 0, slopeZ, spanLen, 1, 1);
                pushInst(metroRailEWInst, t.x + 0.5, midY + 0.755, t.z + 0.14, 0, 0, slopeZ, spanLen, 1, 1);
                pushInst(metroParapetEWInst, t.x + 0.5, midY + 0.76, t.z - 0.27, 0, 0, slopeZ, spanLen, 1, 1);
                pushInst(metroParapetEWInst, t.x + 0.5, midY + 0.76, t.z + 0.27, 0, 0, slopeZ, spanLen, 1, 1);
              }
            }
          }

          // Connect South (+Z) neighbor if it forms a continuous viaduct span
          if (t.z + 1 < gs && isElevatedNodeAt(t.x, t.z + 1)) {
            const southIdx = (t.z + 1) * gs + t.x;
            const southTile = simState.tiles[southIdx];
            const southIsRoad = southTile.terrain === 'stone_road';
            const southIsStation = bldTypeAt.get(southIdx) === 'rail_station';
            if (t.terrain === 'rail_track' || southTile.terrain === 'rail_track' || !southIsStation) {
              if (!(isRoadBridgeHere && southIsRoad)) {
                const nextY = tileCurrentY[southIdx];
                const dy = nextY - curY;
                const spanLen = Math.hypot(1, dy);
                const slopeX = -Math.atan2(dy, 1);
                const midY = (curY + nextY) * 0.5;
                pushInst(metroSpanNSInst, t.x, midY + 0.68, t.z + 0.5, slopeX, 0, 0, 1, 1, spanLen);
                pushInst(metroRailNSInst, t.x - 0.14, midY + 0.755, t.z + 0.5, slopeX, 0, 0, 1, 1, spanLen);
                pushInst(metroRailNSInst, t.x + 0.14, midY + 0.755, t.z + 0.5, slopeX, 0, 0, 1, 1, spanLen);
                pushInst(metroParapetNSInst, t.x - 0.27, midY + 0.76, t.z + 0.5, slopeX, 0, 0, 1, 1, spanLen);
                pushInst(metroParapetNSInst, t.x + 0.27, midY + 0.76, t.z + 0.5, slopeX, 0, 0, 1, 1, spanLen);
              }
            }
          }
        }

        for (const mInst of allMetroInsts) {
          mInst.instanceMatrix.needsUpdate = true;
        }
      }

      // 2. Sync buildings
      const activeBldIds = new Set<string>();
      for (const b of simState.buildings) {
        activeBldIds.add(b.id);
        const tile = simState.tiles[b.tileZ * simState.gridSize + b.tileX];
        const groundY = tile ? Math.max(0.18, tile.height * HEIGHT_STEP + 0.25) : 1.0;

        const bSpecies =
          b.species ??
          (b.settlementId ? simState.settlementSpecies?.[b.settlementId] : undefined) ??
          'human';
        let entry = buildingMeshes.get(b.id);
        if (
          !entry ||
          entry.epochLevel !== b.epochLevel ||
          entry.type !== b.type ||
          entry.species !== bSpecies
        ) {
          if (entry) buildingsGroup.remove(entry.group);
          const variantSeed = b.tileX * 31 + b.tileZ * 17;
          const group = createBuildingGroup(b.type, b.epochLevel, variantSeed, bSpecies);
          group.position.set(b.tileX, groundY, b.tileZ);
          buildingsGroup.add(group);
          entry = { group, epochLevel: b.epochLevel, type: b.type, species: bSpecies };
          buildingMeshes.set(b.id, entry);
        }

        // Orient building doorway (+Z in local space) toward adjacent street or deterministic cardinal angle
        const gs = simState.gridSize;
        const tS = b.tileZ + 1 < gs ? simState.tiles[(b.tileZ + 1) * gs + b.tileX] : undefined;
        const tE = b.tileX + 1 < gs ? simState.tiles[b.tileZ * gs + (b.tileX + 1)] : undefined;
        const tN = b.tileZ - 1 >= 0 ? simState.tiles[(b.tileZ - 1) * gs + b.tileX] : undefined;
        const tW = b.tileX - 1 >= 0 ? simState.tiles[b.tileZ * gs + (b.tileX - 1)] : undefined;
        let rotY = (((b.tileX * 19 + b.tileZ * 7) & 1) === 0 ? 0 : Math.PI / 2);
        if (b.type === 'rail_station') {
          if (tS?.terrain === 'rail_track') rotY = 0;
          else if (tE?.terrain === 'rail_track') rotY = Math.PI / 2;
          else if (tN?.terrain === 'rail_track') rotY = Math.PI;
          else if (tW?.terrain === 'rail_track') rotY = -Math.PI / 2;
          else if (tS?.terrain === 'stone_road') rotY = 0;
          else if (tE?.terrain === 'stone_road') rotY = Math.PI / 2;
          else if (tN?.terrain === 'stone_road') rotY = Math.PI;
          else if (tW?.terrain === 'stone_road') rotY = -Math.PI / 2;
        } else {
          if (tS?.terrain === 'stone_road') rotY = 0;
          else if (tE?.terrain === 'stone_road') rotY = Math.PI / 2;
          else if (tN?.terrain === 'stone_road') rotY = Math.PI;
          else if (tW?.terrain === 'stone_road') rotY = -Math.PI / 2;
        }
        entry.group.rotation.y = rotY;

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
        const unitAgeStage = u.ageStage ?? 'adult';
        if (
          !uEntry ||
          uEntry.epochLevel !== desiredEpoch ||
          uEntry.role !== u.role ||
          uEntry.species !== unitSpecies ||
          uEntry.ageStage !== unitAgeStage
        ) {
          if (uEntry) unitsGroup.remove(uEntry.group);
          const fallbackSeed = Math.abs(
            (u.id.charCodeAt(u.id.length - 1) * 73856093) ^ (u.id.charCodeAt(0) * 19349663),
          );
          const group = createUnitGroup(
            u.role,
            u.faction,
            desiredEpoch,
            unitSpecies,
            u.appearanceSeed ?? fallbackSeed,
            unitAgeStage,
          );
          unitsGroup.add(group);
          uEntry = {
            group,
            epochLevel: desiredEpoch,
            role: u.role,
            species: unitSpecies,
            ageStage: unitAgeStage,
          };
          unitMeshes.set(u.id, uEntry);
        }
        const uGroup = uEntry.group;

        const tx = Math.round(THREE.MathUtils.clamp(u.x, 0, simState.gridSize - 1));
        const tz = Math.round(THREE.MathUtils.clamp(u.z, 0, simState.gridSize - 1));
        const tile = simState.tiles[tz * simState.gridSize + tx];
        const groundY = tile ? Math.max(0.18, tile.height * HEIGHT_STEP + 0.25) : 0.5;

        // Check if unit is being pulled by an active Black Hole (wormhole_rift) for 3D levitation & vortex spiral tilt
        let blackHolePullFrac = 0;
        let blackHoleAngle = 0;
        if (!u.statusEffects.shielded && simState.activeHazards) {
          for (let hi = 0; hi < simState.activeHazards.length; hi++) {
            const hz = simState.activeHazards[hi];
            if (hz.kind === 'wormhole_rift') {
              const pullR = hz.radius * 1.65;
              const d = Math.hypot(u.x - hz.x, u.z - hz.z);
              if (d <= pullR) {
                const frac = Math.max(0, Math.min(1, 1 - d / pullR));
                if (frac > blackHolePullFrac) {
                  blackHolePullFrac = frac;
                  blackHoleAngle = Math.atan2(hz.z - u.z, hz.x - u.x);
                }
              }
            }
          }
        }

        const isMoving = u.state === 'moving';
        const isWorking =
          u.state === 'gathering' || u.state === 'building' || u.state === 'fighting';
        const isDragon = u.role === 'dragon';
        const isAnimal =
          u.role === 'cow' ||
          u.role === 'pig' ||
          u.role === 'chicken' ||
          u.role === 'capybara' ||
          u.role === 'wolf' ||
          u.role === 'bear' ||
          u.role === 'dinosaur' ||
          u.role === 'unicorn' ||
          isDragon;
        const seedPhase = ((u.appearanceSeed ?? 1) % 31) * 0.41;
        const atkTimer = u.attackAnimTimer ?? 0;
        const atkDur = isDragon ? 0.78 : 0.48;
        const atkProg = atkTimer > 0 ? THREE.MathUtils.clamp(1 - atkTimer / atkDur, 0, 1) : 0;
        const isGrazingAnim = isAnimal && u.state === 'gathering';
        const isAttacking = atkTimer > 0 && u.state !== 'ko' && !isGrazingAnim;
        const isHerbivoreDino =
          u.role === 'dinosaur' && getDinosaurVariant(u.appearanceSeed).diet === 'herbivore';

        const bobFreq =
          u.role === 'chicken'
            ? 17
            : u.role === 'wolf'
              ? 14
              : u.role === 'dinosaur' || u.role === 'bear'
                ? 9.5
                : unitAgeStage === 'child'
                  ? 14.5
                  : 11;
        const walkBob = isDragon
          ? 0
          : isMoving
            ? Math.abs(Math.sin(elapsed * bobFreq + seedPhase)) *
              (u.role === 'chicken'
                ? 0.13
                : u.role === 'wolf' || u.role === 'unicorn'
                  ? 0.1
                  : unitAgeStage === 'child'
                    ? 0.095
                    : 0.08)
            : isWorking
              ? Math.abs(Math.sin(elapsed * 14 + seedPhase)) * (isAnimal ? 0.025 : 0.05)
              : 0;
        const pounceHopY =
          isAttacking && !isDragon && u.role !== 'bear'
            ? Math.sin(atkProg * Math.PI) * (u.role === 'wolf' ? 0.42 : u.role === 'chicken' ? 0.24 : 0.16)
            : 0;
        const isDragonStrafing =
          isDragon && (u.dragonRunPhase === 'strafe' || isAttacking);
        const targetHoverY =
          isDragon && u.state !== 'ko'
            ? (isDragonStrafing
                ? 1.86
                : u.dragonRunPhase === 'turn'
                  ? 2.54
                  : 2.34) + Math.sin(elapsed * 2.3 + seedPhase) * (isDragonStrafing ? 0.08 : 0.22)
            : 0;
        const levitateY =
          blackHolePullFrac > 0
            ? Math.pow(blackHolePullFrac, 1.3) * 1.65 +
              Math.sin(elapsed * 9 + u.x * 2) * 0.12 * blackHolePullFrac
            : 0;
        let finalUnitY =
          groundY + (walkBob + pounceHopY + targetHoverY) * (1 - blackHolePullFrac) + levitateY;
        if (isDragon && u.state !== 'ko' && blackHolePullFrac <= 0) {
          const prevDragonY =
            typeof uGroup.userData.smoothWorldY === 'number'
              ? uGroup.userData.smoothWorldY
              : finalUnitY;
          finalUnitY = THREE.MathUtils.damp(prevDragonY, finalUnitY, 6.2, dt);
          uGroup.userData.smoothWorldY = finalUnitY;
        }
        const flightHoverY = Math.max(0, finalUnitY - groundY);
        uGroup.position.set(u.x, finalUnitY, u.z);

        // Smoothly damped facing direction & turn-rate banking calculation
        let dragonYawDelta = 0;
        if (blackHolePullFrac > 0.15) {
          uGroup.rotation.y = blackHoleAngle + elapsed * 3.5 * blackHolePullFrac;
        } else if (isDragon) {
          const dirX =
            u.dragonRunDirX !== undefined ? u.dragonRunDirX : u.targetX - u.x;
          const dirZ =
            u.dragonRunDirZ !== undefined ? u.dragonRunDirZ : u.targetZ - u.z;
          if (dirX * dirX + dirZ * dirZ > 0.0005) {
            const desiredYaw = Math.atan2(dirX, dirZ);
            const curYaw =
              typeof uGroup.userData.initYaw === 'boolean'
                ? uGroup.rotation.y
                : desiredYaw;
            uGroup.userData.initYaw = true;
            const yawDiff = Math.atan2(
              Math.sin(desiredYaw - curYaw),
              Math.cos(desiredYaw - curYaw),
            );
            dragonYawDelta = yawDiff;
            uGroup.rotation.y = curYaw + yawDiff * Math.min(1, dt * 9.5);
          }
        } else {
          const faceX = isAttacking && u.attackTargetX !== undefined ? u.attackTargetX : u.targetX;
          const faceZ = isAttacking && u.attackTargetZ !== undefined ? u.attackTargetZ : u.targetZ;
          const dx = faceX - u.x;
          const dz = faceZ - u.z;
          if (dx * dx + dz * dz > 0.005) {
            const desiredYaw = Math.atan2(dx, dz);
            const curYaw =
              typeof uGroup.userData.initYaw === 'boolean'
                ? uGroup.rotation.y
                : desiredYaw;
            uGroup.userData.initYaw = true;
            const yawDiff = Math.atan2(
              Math.sin(desiredYaw - curYaw),
              Math.cos(desiredYaw - curYaw),
            );
            uGroup.rotation.y = curYaw + yawDiff * Math.min(1, dt * 14);
          }
        }

        // KO topple, Black Hole 3D vortex tumble/spaghettification, or aerodynamic flight/stride sway
        if (u.state === 'ko') {
          uGroup.rotation.z = THREE.MathUtils.damp(uGroup.rotation.z, Math.PI / 2, 12, dt);
          uGroup.rotation.x = 0;
          uGroup.scale.setScalar(1);
        } else if (blackHolePullFrac > 0) {
          uGroup.rotation.z = blackHolePullFrac * 0.92 * Math.sin(elapsed * 7.5 + u.x);
          uGroup.rotation.x = blackHolePullFrac * 0.72 * Math.cos(elapsed * 6.5 + u.z);
          const bhScale = Math.max(0.58, 1 - Math.pow(blackHolePullFrac, 1.8) * 0.38);
          uGroup.scale.setScalar(bhScale);
        } else if (isDragon) {
          const targetBank = THREE.MathUtils.clamp(dragonYawDelta * 1.45, -0.48, 0.48);
          const targetPitch = isDragonStrafing
            ? 0.18
            : u.dragonRunPhase === 'turn'
              ? -0.1
              : 0.05 + Math.sin(elapsed * 2.3 + seedPhase) * 0.04;
          uGroup.rotation.z = THREE.MathUtils.damp(uGroup.rotation.z, targetBank, 7.0, dt);
          uGroup.rotation.x = THREE.MathUtils.damp(uGroup.rotation.x, targetPitch, 7.0, dt);
          uGroup.scale.setScalar(1);
        } else {
          uGroup.rotation.z = isMoving
            ? Math.sin(elapsed * bobFreq + seedPhase) * (u.role === 'chicken' ? 0.12 : 0.08)
            : 0;
          uGroup.rotation.x =
            isWorking && !isAnimal ? Math.sin(elapsed * 16 + u.x) * 0.22 : 0;
          uGroup.scale.setScalar(1);
        }

        // Articulated creature animation (wings, head grazing/pecking/prowling, jaw snapping, tail wagging, legs)
        const bodyPivot = uGroup.getObjectByName('body_pivot');
        const headPivot = uGroup.getObjectByName('head_pivot');
        const jawPivot = uGroup.getObjectByName('jaw_pivot');
        const tailPivot = uGroup.getObjectByName('tail_pivot');
        const wingL = uGroup.getObjectByName('wing_l');
        const wingR = uGroup.getObjectByName('wing_r');
        const wingOuterL = uGroup.getObjectByName('wing_outer_l');
        const wingOuterR = uGroup.getObjectByName('wing_outer_r');

        if (isAnimal && u.state !== 'ko') {
          if (bodyPivot) {
            let bodyPitch = 0;
            let bodyForward = 0;
            if (isAttacking) {
              const s = Math.sin(atkProg * Math.PI);
              if (u.role === 'bear') {
                // Towering rear-up followed by heavy slam
                bodyPitch = atkProg < 0.45 ? -0.58 * (atkProg / 0.45) : -0.58 + 0.88 * ((atkProg - 0.45) / 0.55);
                bodyForward = atkProg > 0.45 ? 0.22 * Math.sin(((atkProg - 0.45) / 0.55) * Math.PI) : -0.08;
              } else if (u.role === 'unicorn') {
                bodyPitch = -0.34 * s;
                bodyForward = 0.26 * s;
              } else if (!isDragon) {
                bodyPitch = 0.24 * s;
                bodyForward = (u.role === 'wolf' ? 0.34 : 0.24) * s;
              }
            }
            bodyPivot.rotation.x = bodyPitch;
            bodyPivot.position.z = bodyForward;
            // Subtle idle chest breathing
            const breath = isMoving ? 0 : Math.sin(elapsed * 3.4 + seedPhase) * 0.035;
            if (u.role !== 'dinosaur') {
              bodyPivot.scale.y = 1 + breath;
            }
          }

          if (headPivot) {
            if (isDragon) {
              const targetHeadX = isDragonStrafing
                ? 0.34
                : Math.sin(elapsed * 2.2 + seedPhase) * 0.08;
              const targetHeadY = isDragonStrafing
                ? 0
                : THREE.MathUtils.clamp(dragonYawDelta * 0.45, -0.28, 0.28) +
                  Math.sin(elapsed * 1.4 + seedPhase) * 0.12;
              headPivot.rotation.x = THREE.MathUtils.damp(headPivot.rotation.x, targetHeadX, 9, dt);
              headPivot.rotation.y = THREE.MathUtils.damp(headPivot.rotation.y, targetHeadY, 8, dt);
            } else if (isAttacking) {
              headPivot.rotation.x = Math.sin(atkProg * Math.PI) * (u.role === 'chicken' ? 0.65 : 0.42);
              headPivot.rotation.y = 0;
            } else if (u.role === 'chicken') {
              // Brisk pecking & alert side-glances
              const peckCycle = (elapsed * 1.4 + seedPhase) % 3.2;
              const isPecking = !isMoving && peckCycle < 0.7;
              headPivot.rotation.x = isPecking
                ? Math.max(0, Math.sin((peckCycle / 0.7) * Math.PI * 2)) * 0.65
                : isMoving
                  ? Math.sin(elapsed * 17 + seedPhase) * 0.22
                  : 0;
              headPivot.rotation.y = !isMoving && !isPecking ? Math.sin(elapsed * 2.2 + seedPhase) * 0.38 : 0;
            } else if (isGrazingAnim) {
              // Gentle chewing/browsing head dip while eating plants
              headPivot.rotation.x = 0.28 + Math.sin(atkProg * Math.PI * 2) * 0.22;
              headPivot.rotation.y = Math.sin(elapsed * 2.1 + seedPhase) * 0.1;
            } else if (
              u.role === 'cow' ||
              u.role === 'pig' ||
              u.role === 'capybara' ||
              u.role === 'unicorn' ||
              isHerbivoreDino
            ) {
              // Periodic grazing dip when idle, subtle look around
              const grazeWave = Math.max(0, Math.sin(elapsed * 0.75 + seedPhase));
              headPivot.rotation.x = !isMoving
                ? grazeWave * (u.role === 'unicorn' ? 0.28 : isHerbivoreDino ? 0.36 : 0.45)
                : Math.sin(elapsed * bobFreq + seedPhase) * 0.08;
              headPivot.rotation.y = !isMoving ? Math.sin(elapsed * 1.3 + seedPhase) * 0.24 : 0;
            } else {
              // Wolf, Bear, Carnivore Dinosaur alert scanning
              headPivot.rotation.x = isMoving ? Math.sin(elapsed * bobFreq + seedPhase) * 0.07 : Math.sin(elapsed * 2.1 + seedPhase) * 0.06;
              headPivot.rotation.y = !isMoving ? Math.sin(elapsed * 1.7 + seedPhase) * 0.35 : 0;
            }
          }

          if (jawPivot) {
            if (isDragon) {
              const targetJaw = isDragonStrafing
                ? 0.64
                : 0.06 + Math.max(0, Math.sin(elapsed * 2.0 + seedPhase)) * 0.1;
              jawPivot.rotation.x = THREE.MathUtils.damp(jawPivot.rotation.x, targetJaw, 12, dt);
              const mawObj = uGroup.getObjectByName('fire_maw') as THREE.Mesh | undefined;
              if (mawObj && mawObj.material instanceof THREE.MeshStandardMaterial) {
                const cd = u.dragonBreathCooldown ?? 0;
                const targetGlow = isDragonStrafing
                  ? 2.15
                  : cd > 1.2
                    ? 0.42
                    : 1.15 + Math.sin(elapsed * 8.0 + seedPhase) * 0.25;
                mawObj.material.emissiveIntensity = THREE.MathUtils.damp(
                  mawObj.material.emissiveIntensity,
                  targetGlow,
                  8,
                  dt,
                );
              }
            } else if (isAttacking) {
              // Open wide then snap shut cleanly
              jawPivot.rotation.x = Math.sin(atkProg * Math.PI) * 0.68;
            } else {
              jawPivot.rotation.x = Math.max(0, Math.sin(elapsed * 2.4 + seedPhase)) * 0.14;
            }
          }

          if (tailPivot) {
            if (isDragon) {
              const targetTailY =
                -THREE.MathUtils.clamp(dragonYawDelta * 0.55, -0.35, 0.35) +
                Math.sin(elapsed * (isDragonStrafing ? 3.2 : 4.5) + seedPhase) *
                  (isDragonStrafing ? 0.16 : 0.28);
              tailPivot.rotation.y = THREE.MathUtils.damp(tailPivot.rotation.y, targetTailY, 8, dt);
              tailPivot.rotation.x = Math.cos(elapsed * 2.8 + seedPhase) * 0.1;
            } else if (isAttacking && u.role === 'dinosaur') {
              tailPivot.rotation.y = Math.sin(atkProg * Math.PI * 2) * 0.58;
            } else {
              const tailSpeed = isMoving ? 10 : u.role === 'wolf' ? 6.5 : 3.5;
              tailPivot.rotation.y = Math.sin(elapsed * tailSpeed + seedPhase) * (u.role === 'wolf' || u.role === 'dinosaur' ? 0.36 : 0.22);
            }
          }

          const strideFreq = isMoving ? bobFreq : 0;
          const legAmp = isMoving ? (u.role === 'wolf' || u.role === 'unicorn' ? 0.62 : 0.48) : 0;
          const legPhase = elapsed * strideFreq + seedPhase;
          const legFL = uGroup.getObjectByName('leg_fl');
          const legFR = uGroup.getObjectByName('leg_fr');
          const legBL = uGroup.getObjectByName('leg_bl');
          const legBR = uGroup.getObjectByName('leg_br');
          const legL = uGroup.getObjectByName('leg_l');
          const legR = uGroup.getObjectByName('leg_r');

          if (legFL && legFR && legBL && legBR) {
            if (isDragon) {
              // Tucked aerodynamic flight legs
              legFL.rotation.x = 0.52;
              legFR.rotation.x = 0.52;
              legBL.rotation.x = 0.68;
              legBR.rotation.x = 0.68;
            } else if (isAttacking && (u.role === 'bear' || u.role === 'unicorn')) {
              const pawLift = Math.sin(atkProg * Math.PI) * -0.95;
              legFL.rotation.x = pawLift;
              legFR.rotation.x = pawLift;
              legBL.rotation.x = 0.2;
              legBR.rotation.x = 0.2;
            } else {
              const swing = Math.sin(legPhase) * legAmp;
              legFL.rotation.x = swing;
              legBR.rotation.x = swing;
              legFR.rotation.x = -swing;
              legBL.rotation.x = -swing;
            }
          }
          if (legL && legR) {
            const swing = Math.sin(legPhase) * (isMoving ? 0.62 : 0);
            legL.rotation.x = swing;
            legR.rotation.x = -swing;
          }
        }

        if (wingL && wingR && u.state !== 'ko') {
          if (isDragon) {
            // Spread wide in a steady aerodynamic glide when carpet-bombing; beat powerfully when turning/climbing
            const wingFreq = u.dragonRunPhase === 'turn' ? 7.4 : 6.2;
            const targetFlap = isDragonStrafing
              ? 0.14 + Math.sin(elapsed * 2.6 + seedPhase) * 0.1
              : Math.sin(elapsed * wingFreq + seedPhase) * 0.55 + 0.08;
            wingL.rotation.z = THREE.MathUtils.damp(wingL.rotation.z, targetFlap, 11, dt);
            wingR.rotation.z = THREE.MathUtils.damp(wingR.rotation.z, -targetFlap, 11, dt);
            if (wingOuterL && wingOuterR) {
              const targetOuter = isDragonStrafing
                ? -0.06 + Math.sin(elapsed * 2.6 + seedPhase - 0.6) * 0.08
                : Math.sin(elapsed * wingFreq + seedPhase - 0.85) * 0.42;
              wingOuterL.rotation.z = THREE.MathUtils.damp(wingOuterL.rotation.z, targetOuter, 11, dt);
              wingOuterR.rotation.z = THREE.MathUtils.damp(wingOuterR.rotation.z, -targetOuter, 11, dt);
            }
          } else if (u.role === 'chicken' && (isMoving || isAttacking || ((elapsed + seedPhase) % 4.5 < 0.55))) {
            const flutter = Math.sin(elapsed * 24 + seedPhase) * 0.55;
            wingL.rotation.z = flutter;
            wingR.rotation.z = -flutter;
          } else {
            wingL.rotation.z = 0;
            wingR.rotation.z = 0;
          }
        }

        const unitShadow = uGroup.getObjectByName('contact_shadow');
        if (unitShadow) {
          const totalAir = flightHoverY + levitateY + pounceHopY;
          unitShadow.scale.setScalar(Math.max(0.28, 1 - totalAir * 0.18));
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

      // 3b. Sync vehicles (cars on roads, trains/metros on railways, planes & shuttles in flight)
      const activeVehicleIds = new Set<string>();
      for (const v of simState.vehicles ?? []) {
        activeVehicleIds.add(v.id);
        let vEntry = vehicleMeshes.get(v.id);
        if (
          !vEntry ||
          vEntry.epochLevel !== v.epochLevel ||
          vEntry.type !== v.type ||
          vEntry.species !== v.species
        ) {
          if (vEntry) vehiclesGroup.remove(vEntry.group);
          const seedHash =
            Math.abs(Math.round(v.x * 13 + v.z * 7)) + v.id.charCodeAt(v.id.length - 1);
          const group = createVehicleGroup(v.type, v.epochLevel, v.species, seedHash);
          vehiclesGroup.add(group);
          vEntry = { group, epochLevel: v.epochLevel, type: v.type, species: v.species };
          vehicleMeshes.set(v.id, vEntry);
        }
        const vGroup = vEntry.group;
        const vtx = Math.round(THREE.MathUtils.clamp(v.x, 0, simState.gridSize - 1));
        const vtz = Math.round(THREE.MathUtils.clamp(v.z, 0, simState.gridSize - 1));
        const vTile = simState.tiles[vtz * simState.gridSize + vtx];
        const groundY = vTile ? Math.max(0.18, vTile.height * HEIGHT_STEP + 0.25) : 0.5;

        if (v.type === 'car') {
          // Right-hand lane offset perpendicular to forward heading
          const laneX = -Math.cos(v.heading) * 0.14;
          const laneZ = Math.sin(v.heading) * 0.14;
          vGroup.position.set(v.x + laneX, groundY + v.y, v.z + laneZ);
        } else if (v.type === 'roadster') {
          const laneScale = v.y > 0.25 ? Math.max(0, 1 - (v.y - 0.25) * 0.8) : 1;
          const laneX = -Math.cos(v.heading) * 0.12 * laneScale;
          const laneZ = Math.sin(v.heading) * 0.12 * laneScale;
          vGroup.position.set(v.x + laneX, groundY + v.y, v.z + laneZ);
          if (v.thrusterActive && Math.random() < 0.75) {
            spawnParticleBurst(
              v.x + laneX,
              groundY + v.y + 0.08,
              v.z + laneZ,
              2,
              Math.random() < 0.55 ? '#38bdf8' : '#e0f2fe',
              0.25,
              1.6,
              0.42,
            );
          }
        } else if (v.type === 'plane') {
          const minAirFloor = v.flightPhase === 'cruise' ? 3.85 : groundY;
          const planeY = Math.max(groundY + v.y, minAirFloor + Math.max(0, v.y - 2.0));
          vGroup.position.set(v.x, planeY, v.z);
        } else {
          vGroup.position.set(v.x, groundY + v.y + 0.01, v.z);
        }

        vGroup.rotation.order = 'YXZ';
        vGroup.rotation.set(v.pitch, v.heading, v.bank);

        for (const child of vGroup.children) {
          if (child.name === 'spin_prop') {
            child.rotation.z += dt * 28;
          } else if (child.name === 'thruster_plume') {
            const active = Boolean(v.thrusterActive);
            child.visible = active;
            if (active) {
              const flicker = 0.8 + Math.sin(elapsed * 48 + child.position.x * 30) * 0.28;
              child.scale.set(0.9 + (flicker - 0.8) * 0.4, flicker, 0.9 + (flicker - 0.8) * 0.4);
            }
          } else if (child.name === 'contact_shadow') {
            const shadowFade = Math.max(0.25, 1 - Math.max(0, v.y - 0.1) * 0.25);
            child.scale.setScalar(shadowFade);
          }
        }
      }

      for (const [id, vEntry] of vehicleMeshes.entries()) {
        if (!activeVehicleIds.has(id)) {
          vehiclesGroup.remove(vEntry.group);
          vehicleMeshes.delete(id);
        }
      }

      // 4. Consume pending VFX bursts & trigger dramatic 3D power & creature combat animations
      while (simState.pendingVfx.length > 0) {
        const vfx = simState.pendingVfx.shift()!;
        const vTile = getTileFromArray(simState, vfx.x, vfx.z);
        const surfY = vTile ? Math.max(0.22, vTile.height * HEIGHT_STEP + 0.25) : Math.max(0.45, vfx.y);
        if (vfx.type === 'hit_spark' || vfx.type === 'build_complete') {
          spawnParticleBurst(vfx.x, surfY + 0.25, vfx.z, 22, vfx.color, vfx.radius * 0.55, 3.8, 0.95);
        } else if (vfx.type === 'dragon_fire_breath') {
          const ox = vfx.originX ?? vfx.x;
          const oz = vfx.originZ ?? vfx.z;
          const oTile = getTileFromArray(simState, ox, oz);
          const originGroundY = oTile ? Math.max(0.22, oTile.height * HEIGHT_STEP + 0.25) : surfY;
          spawnDragonFireBreath(
            ox,
            originGroundY + 3.05,
            oz,
            vfx.x,
            surfY,
            vfx.z,
            vfx.radius,
            vfx.color,
            vfx.sourceUnitId,
          );
        } else if (vfx.type === 'animal_attack') {
          const ox = vfx.originX ?? vfx.x;
          const oz = vfx.originZ ?? vfx.z;
          const oTile = getTileFromArray(simState, ox, oz);
          const originGroundY = oTile ? Math.max(0.22, oTile.height * HEIGHT_STEP + 0.25) : surfY;
          spawnAnimalAttackVisual(
            vfx.variant ?? 'bite',
            ox,
            originGroundY,
            oz,
            vfx.x,
            surfY,
            vfx.z,
            vfx.radius,
            vfx.color,
          );
        } else {
          spawnPowerVisualEffect(
            vfx.type,
            vfx.x,
            vfx.y,
            vfx.z,
            vfx.radius,
            vfx.color,
            Boolean(vfx.deferImpact),
            vfx.faultSegments,
            vfx.quakeShapeKind,
          );
        }
      }

      // 5. Sync lingering hazard zones (monsoon rain clouds, plague clouds, shield domes, cosmic rifts)
      const activeHazIds = new Set<string>();
      for (const haz of simState.activeHazards ?? []) {
        activeHazIds.add(haz.id);
        let hv = hazardMeshes.get(haz.id);
        if (!hv) {
          hv = createHazardVisual(haz.kind, haz.radius, haz.faultSegments, haz.x, haz.z);
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
            hv.ringMesh.rotation.z = elapsed * 4.8;
            hv.ringMesh.rotation.y = elapsed * 2.1;
          }
          if (hv.secondaryRingMesh) {
            hv.secondaryRingMesh.rotation.x = elapsed * 3.6;
            hv.secondaryRingMesh.rotation.z = -elapsed * 2.8;
          }
          // Animate 3 concentric gravity-well rings continuously contracting from outer pull radius into the singularity core
          if (hv.gravityRings) {
            const maxPullR = haz.radius * 1.55;
            for (let gi = 0; gi < hv.gravityRings.length; gi++) {
              const gRing = hv.gravityRings[gi];
              const cycle = (elapsed * 0.85 + gi / hv.gravityRings.length) % 1; // 0 (outer rim) -> 1 (swallowed at core)
              const easeIn = Math.pow(cycle, 1.55);
              const curRingR = Math.max(0.2, maxPullR * (1 - easeIn));
              gRing.scale.setScalar(curRingR);
              gRing.position.y = 0.1 + easeIn * 1.7;
              gRing.rotation.z = elapsed * (2.2 + gi * 0.8);
              const gMat = hv.materials[3 + gi] as THREE.MeshBasicMaterial | undefined;
              if (gMat) {
                gMat.opacity = Math.sin(cycle * Math.PI) * 0.82 * fade;
              }
            }
          }
          // Animate 24 accretion shards spiraling inward & upward from the ground perimeter into the Event Horizon at y=1.8
          if (hv.vortexMotes) {
            const maxMoteR = haz.radius * 1.5;
            for (let mi = 0; mi < hv.vortexMotes.length; mi++) {
              const vm = hv.vortexMotes[mi];
              const cycle = (elapsed * vm.speed + vm.phase) % 1; // 0 (outer rim) -> 1 (core)
              const inward = Math.pow(cycle, 1.4);
              const r = Math.max(0.12, maxMoteR * (1 - inward));
              // Spiral angle accelerates as radius shrinks (conservation of angular momentum)
              const theta = vm.baseAngle + elapsed * 2.8 + inward * 8.5;
              const my = 0.15 + Math.pow(cycle, 1.65) * 1.65;
              vm.mesh.position.set(Math.cos(theta) * r, my, Math.sin(theta) * r);
              vm.mesh.rotation.set(elapsed * 5 + mi, theta, elapsed * 4);
              const s = 0.16 + Math.sin(cycle * Math.PI) * 0.24;
              vm.mesh.scale.set(s * 1.4, s * 0.7, s);
            }
          }
          // Continuous stream of inward-sucking cosmic dust & debris particles
          if (Math.random() < 0.65) {
            spawnInwardPullParticles(
              haz.x,
              hy,
              haz.z,
              2,
              Math.random() < 0.5 ? '#c77dff' : '#56cfe1',
              haz.radius * 1.45,
              0.95,
            );
          }
          const pulse = (0.95 + Math.sin(elapsed * 9) * 0.12) * fade;
          hv.group.scale.setScalar(Math.max(0.05, pulse));
        } else if (hv.kind === 'tsunami_wave') {
          hv.group.position.set(haz.x, 0, haz.z);
          const curR = haz.currentRadius ?? haz.radius;
          const maxR = haz.maxRadius ?? haz.radius * 3.8;
          const expandProg = Math.min(1, curR / Math.max(1, maxR));

          if (hv.waveSegments) {
            const primaryCount = 40;
            const wakeCount = 28;
            for (let si = 0; si < hv.waveSegments.length; si++) {
              const seg = hv.waveSegments[si];
              const baseR = seg.isWake ? Math.max(0.7, curR * 0.65) : curR;
              const rippledR = baseR + Math.sin(elapsed * 5.8 + seg.phase * 2.0) * 0.28;
              const dx = Math.cos(seg.angle) * rippledR;
              const dz = Math.sin(seg.angle) * rippledR;
              const wx = haz.x + dx;
              const wz = haz.z + dz;
              const segTile = getTileFromArray(simState, wx, wz);

              // High mountain cliffs (height >= 4) block the tsunami wave from climbing over them
              if (!segTile || segTile.height >= 4) {
                seg.group.visible = false;
                continue;
              }
              seg.group.visible = true;

              const baseY = segTile.height === 0 ? 0.32 : segTile.height * HEIGHT_STEP + 0.22;
              // Tsunami shoals and rears up taller as it hits shallow water and coastal land (height 1-2)
              const shoalMult =
                segTile.height === 1 ? 1.24 : segTile.height === 2 ? 0.96 : segTile.height === 3 ? 0.56 : 1.05;
              const wakeMult = seg.isWake ? 0.62 : 1.0;
              const undulation = 0.88 + Math.sin(elapsed * 8.5 + seg.phase * 2.5) * 0.18;
              const waveH = Math.max(
                0.22,
                (1.22 - expandProg * 0.36) * shoalMult * wakeMult * undulation * fade,
              );
              const segCount = seg.isWake ? wakeCount : primaryCount;
              const arcWidth = Math.max(0.68, ((2 * Math.PI * rippledR) / segCount) * 1.14);

              seg.group.position.set(dx, baseY, dz);
              // Orient radially outward in direction of wave travel and pitch forward as it curls/breaks on shore
              const breakPitch =
                0.1 + Math.sin(elapsed * 9.2 + seg.phase) * 0.1 + (segTile.height >= 1 ? 0.2 : 0);
              seg.group.rotation.set(breakPitch, Math.atan2(dx, dz), 0);
              seg.group.scale.set(
                arcWidth,
                waveH,
                (seg.isWake ? 0.78 : 1.18) * (0.92 + Math.cos(elapsed * 7.2 + seg.phase) * 0.12),
              );

              // Spawn breaking whitewater surf spray where the wave crests and crashes onto coastal land
              if (!seg.isWake && ((si + Math.floor(elapsed * 30)) % 7 === 0)) {
                const isLandBreak = segTile.height >= 1;
                spawnParticleBurst(
                  wx,
                  baseY + waveH * 1.35,
                  wz,
                  isLandBreak ? 3 : 1,
                  isLandBreak ? '#ffffff' : '#e0fbfc',
                  isLandBreak ? 0.85 : 0.45,
                  isLandBreak ? 3.6 : 2.2,
                  isLandBreak ? 1.25 : 0.95,
                );
              }
            }
          }
          (hv.materials[0] as THREE.MeshStandardMaterial).opacity = 0.86 * fade;
          (hv.materials[1] as THREE.MeshStandardMaterial).opacity = 0.9 * fade;
          (hv.materials[2] as THREE.MeshBasicMaterial).opacity = 0.94 * fade;
          (hv.materials[3] as THREE.MeshBasicMaterial).opacity = 0.98 * fade;
        } else if (hv.kind === 'earthquake_zone') {
          const pulseWave = (elapsed * 1.45) % 1;
          if (hv.ringMesh) {
            hv.ringMesh.scale.setScalar(Math.min(5.2, haz.radius * 0.45) * (0.45 + pulseWave * 0.65));
            (hv.materials[0] as THREE.MeshBasicMaterial).opacity = Math.sin(pulseWave * Math.PI) * 0.48 * fade;
          }
          if (hv.crackMeshes) {
            for (let ci = 0; ci < hv.crackMeshes.length; ci++) {
              const cm = hv.crackMeshes[ci];
              const baseZ = (cm.userData.baseScaleZ as number) || 0.35;
              cm.scale.z = baseZ * (0.85 + Math.sin(elapsed * 16 + ci * 1.4) * 0.25);
            }
            (hv.materials[1] as THREE.MeshBasicMaterial).opacity = (0.58 + Math.sin(elapsed * 12) * 0.16) * fade;
          }
          const segs = hv.faultSegments ?? haz.faultSegments;
          if (Math.random() < 0.72) {
            let px = haz.x;
            let pz = haz.z;
            if (segs && segs.length > 0) {
              const s = segs[Math.floor(Math.random() * segs.length)];
              const u = Math.random();
              px = s.x1 + (s.x2 - s.x1) * u + (Math.random() - 0.5) * s.width * 1.4;
              pz = s.z1 + (s.z2 - s.z1) * u + (Math.random() - 0.5) * s.width * 1.4;
            } else {
              const ang = Math.random() * Math.PI * 2;
              const dist = Math.random() * haz.radius * 0.8;
              px = haz.x + Math.cos(ang) * dist;
              pz = haz.z + Math.sin(ang) * dist;
            }
            spawnParticleBurst(
              px,
              hy + 0.15,
              pz,
              2,
              Math.random() < 0.5 ? '#c2a88d' : '#e07a2b',
              0.7,
              3.2,
              0.85,
            );
          }
        }
      }
      for (const [id, hv] of hazardMeshes.entries()) {
        if (!activeHazIds.has(id)) {
          hazardsGroup.remove(hv.group);
          for (const m of hv.materials) m.dispose();
          hazardMeshes.delete(id);
        }
      }

      // 6. Sync active tile fire animated sprites & billowing smoke sprites
      spriteBundle.fireMaterial.uniforms.uTime.value = elapsed;
      spriteBundle.smokeMaterial.uniforms.uTime.value = elapsed;
      spriteBundle.breathScrollTexture.offset.y = -((elapsed * 4.2) % 1.0);

      let fireTileCount = 0;
      let fireSpriteCount = 0;
      for (let i = 0; i < simState.tiles.length && fireTileCount < MAX_FIRE_TILES; i++) {
        const t = simState.tiles[i];
        if (t.onFireTimer > 0 && t.height > 0 && t.resourceNode !== 'ore_vein') {
          const fy = tileCurrentY[i] || t.height * HEIGHT_STEP + 0.25;
          const phase = ((t.x * 13 + t.z * 29) & 31) / 32;
          const fadeEnv = Math.min(1, t.onFireTimer / 0.8);
          const intensityBoost = t.buildingId || t.resourceNode === 'timber_grove' ? 1.16 : 0.94;
          const pulse = (0.9 + Math.sin(elapsed * 16 + t.x * 3 + t.z * 7) * 0.12) * intensityBoost;

          if (t.fireColor) {
            _fireTintCol.set(t.fireColor);
          } else {
            _fireTintCol.copy(_whiteCol);
          }

          // Primary camera-facing animated pixel flame sprite
          _dummyPos.set(t.x, fy, t.z);
          _dummyScale.set(pulse * 0.96, pulse * (0.95 + fadeEnv * 0.15), 1);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          fireSpriteInst.setMatrixAt(fireSpriteCount, _dummyMatrix);
          fireDataArray[fireSpriteCount * 2] = phase;
          fireDataArray[fireSpriteCount * 2 + 1] = 0.94 * fadeEnv;
          fireColorArray[fireSpriteCount * 3] = _fireTintCol.r;
          fireColorArray[fireSpriteCount * 3 + 1] = _fireTintCol.g;
          fireColorArray[fireSpriteCount * 3 + 2] = _fireTintCol.b;
          fireSpriteCount++;

          // Secondary offset side tongue for richer volumetric pixel fire silhouette
          if (fireSpriteCount < MAX_FIRE_SPRITES) {
            const ox = Math.sin(phase * Math.PI * 2) * 0.22;
            const oz = Math.cos(phase * Math.PI * 2) * 0.18;
            _dummyPos.set(t.x + ox, fy + 0.04, t.z + oz);
            _dummyScale.set(pulse * 0.64, pulse * 0.72, 1);
            _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
            fireSpriteInst.setMatrixAt(fireSpriteCount, _dummyMatrix);
            fireDataArray[fireSpriteCount * 2] = (phase + 0.43) % 1.0;
            fireDataArray[fireSpriteCount * 2 + 1] = 0.85 * fadeEnv;
            fireColorArray[fireSpriteCount * 3] = _fireTintCol.r;
            fireColorArray[fireSpriteCount * 3 + 1] = _fireTintCol.g;
            fireColorArray[fireSpriteCount * 3 + 2] = _fireTintCol.b;
            fireSpriteCount++;
          }

          // Rising animated pixel smoke puff sprite above each burning tile
          const smokeCycle = (elapsed * 1.45 + (t.x * 0.37 + t.z * 0.53)) % 1.0;
          const smokeY = fy + 0.82 + smokeCycle * 1.95;
          const smokeScale = (0.55 + smokeCycle * 0.78) * (0.85 + 0.3 * intensityBoost);
          _dummyPos.set(
            t.x + Math.sin(elapsed * 2.6 + t.z) * 0.2,
            smokeY,
            t.z + Math.cos(elapsed * 2.6 + t.x) * 0.2,
          );
          _dummyScale.set(smokeScale, smokeScale, 1);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          fireSmokeInst.setMatrixAt(fireTileCount, _dummyMatrix);
          smokeDataArray[fireTileCount * 2] = (phase + smokeCycle * 0.5) % 1.0;
          smokeDataArray[fireTileCount * 2 + 1] = Math.sin(smokeCycle * Math.PI) * 0.58 * fadeEnv;

          fireTileCount++;
        }
      }
      fireSpriteInst.count = fireSpriteCount;
      fireSmokeInst.count = fireTileCount;
      if (fireSpriteCount > 0) {
        fireSpriteInst.instanceMatrix.needsUpdate = true;
        fireDataAttr.needsUpdate = true;
        fireColorAttr.needsUpdate = true;
      }
      if (fireTileCount > 0) {
        fireSmokeInst.instanceMatrix.needsUpdate = true;
        smokeDataAttr.needsUpdate = true;
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

      // Camera action requests from HUD buttons & game state lifecycle transitions
      const camAct = cameraActionRef.current;
      const currentGameState = propsRef.current.gameState;
      const isPlayTransition =
        Boolean(camAct.playTransition) ||
        (prevGameState === 'title' && currentGameState === 'playing');

      if (isPlayTransition) {
        camAct.playTransition = false;
        // Smoothly rotate to 45 degrees (true isometric view: Math.PI / 4) taking the shortest angular path
        const targetYaw = Math.PI / 4;
        const yawDiff = Math.atan2(Math.sin(targetYaw - camYaw), Math.cos(targetYaw - camYaw));
        camDesiredYaw = camYaw + yawDiff;

        // Smoothly center on the whole map so the entire island is in view
        const center = (simRef.current.gridSize - 1) / 2;
        camDesiredTarget.set(center, 1.2, center);

        // Zoom out so the player can see the whole map
        desiredFrustum = getWholeMapFrustum(simRef.current.gridSize);

        if (propsRef.current.followingEntityId) {
          propsRef.current.onBreakFollow?.();
        }
      } else if (prevGameState !== 'title' && currentGameState === 'title') {
        // Return to title screen: overview zoom and center on island
        desiredFrustum = 22;
        const center = (simRef.current.gridSize - 1) / 2;
        camDesiredTarget.set(center, 1.2, center);
      }
      prevGameState = currentGameState;

      const maxZoomOut = Math.max(105, getWholeMapFrustum(simRef.current.gridSize));
      if (camAct.rotateDelta !== 0) {
        camDesiredYaw += camAct.rotateDelta;
        camAct.rotateDelta = 0;
      }
      if (camAct.zoomDelta !== 0) {
        desiredFrustum = THREE.MathUtils.clamp(desiredFrustum + camAct.zoomDelta, 7.5, maxZoomOut);
        camAct.zoomDelta = 0;
      }
      if (camAct.centerHome) {
        const anchor = getSettlementAnchor(simRef.current);
        camDesiredTarget.set(anchor.x, 1.2, anchor.z);
        desiredFrustum = 14.5;
        camAct.centerHome = false;
        if (propsRef.current.followingEntityId) {
          propsRef.current.onBreakFollow?.();
        }
      }
      if (camAct.focusTarget) {
        camDesiredTarget.set(camAct.focusTarget.x, 1.2, camAct.focusTarget.z);
        if (camAct.focusTarget.zoom !== undefined) {
          desiredFrustum = THREE.MathUtils.clamp(camAct.focusTarget.zoom, 7.5, maxZoomOut);
        }
        camAct.focusTarget = null;
      }

      // Keyboard WASD / Arrow camera pan & Q/E rotate (scales with zoom for 128x128 navigation)
      const panSpeed = Math.max(12, frustumSize * 1.15) * dt;
      const forwardX = -Math.sin(camYaw);
      const forwardZ = -Math.cos(camYaw);
      const rightX = Math.cos(camYaw);
      const rightZ = -Math.sin(camYaw);

      let panKeyMoved = false;
      if (keysPressed.has('KeyW') || keysPressed.has('ArrowUp')) {
        camDesiredTarget.x += forwardX * panSpeed;
        camDesiredTarget.z += forwardZ * panSpeed;
        panKeyMoved = true;
      }
      if (keysPressed.has('KeyS') || keysPressed.has('ArrowDown')) {
        camDesiredTarget.x -= forwardX * panSpeed;
        camDesiredTarget.z -= forwardZ * panSpeed;
        panKeyMoved = true;
      }
      if (keysPressed.has('KeyA') || keysPressed.has('ArrowLeft')) {
        camDesiredTarget.x -= rightX * panSpeed;
        camDesiredTarget.z -= rightZ * panSpeed;
        panKeyMoved = true;
      }
      if (keysPressed.has('KeyD') || keysPressed.has('ArrowRight')) {
        camDesiredTarget.x += rightX * panSpeed;
        camDesiredTarget.z += rightZ * panSpeed;
        panKeyMoved = true;
      }

      if (panKeyMoved && propsRef.current.followingEntityId) {
        propsRef.current.onBreakFollow?.();
      }

      // Live Entity Camera Tracking: Smoothly follow moving or flying creatures frame-by-frame
      const activeFollowId = propsRef.current.followingEntityId;
      if (activeFollowId && !panKeyMoved && !isPointerDragging) {
        const followUnit = simRef.current.units.find(
          (u) => u.id === activeFollowId && u.state !== 'ko',
        );
        if (followUnit) {
          const uGroup = unitMeshes.get(activeFollowId)?.group;
          const targetX = uGroup ? uGroup.position.x : followUnit.x;
          const targetY = uGroup ? Math.max(1.2, uGroup.position.y * 0.8) : 1.2;
          const targetZ = uGroup ? uGroup.position.z : followUnit.z;

          camDesiredTarget.x = THREE.MathUtils.clamp(targetX, 2, simRef.current.gridSize - 3);
          camDesiredTarget.y = targetY;
          camDesiredTarget.z = THREE.MathUtils.clamp(targetZ, 2, simRef.current.gridSize - 3);
        } else {
          propsRef.current.onBreakFollow?.();
        }
      } else {
        camDesiredTarget.x = THREE.MathUtils.clamp(camDesiredTarget.x, 2, simRef.current.gridSize - 3);
        camDesiredTarget.z = THREE.MathUtils.clamp(camDesiredTarget.z, 2, simRef.current.gridSize - 3);
      }

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
              const preImpactTile = getTileFromArray(simRef.current, fx.tx, fx.tz);
              const hitWater =
                !preImpactTile ||
                preImpactTile.height === 0 ||
                preImpactTile.terrain === 'deep_water' ||
                preImpactTile.terrain === 'shallow_water';
              if (fx.deferImpact) {
                executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz);
                soundEngine.playHeavyImpact();
              }
              fx.meteorMesh.visible = false;
              if (fx.innerDomeMesh) fx.innerDomeMesh.visible = true;
              if (fx.explosionDome) fx.explosionDome.visible = true;
              trauma = 1.0;
              hitstopTimer = 0.1;
              if (hitWater) {
                // Ocean Asteroid Impact -> Hide flat shockwave rings & erupt a towering vertical Hydro-Geyser column while 3D Tsunami waves roll out!
                fx.ringMesh.visible = false;
                if (fx.outerRingMesh) fx.outerRingMesh.visible = false;
                if (fx.shockWallMesh) fx.shockWallMesh.visible = false;
                (fx.materials[2] as THREE.MeshBasicMaterial).color.setHex(0x00b4d8);
                if (fx.materials[5]) (fx.materials[5] as THREE.MeshBasicMaterial).color.setHex(0xe0fbfc);
                if (fx.materials[7]) (fx.materials[7] as THREE.MeshBasicMaterial).color.setHex(0x90e0ef);
                triggerLightFlash(fx.tx, fx.ty + 2, fx.tz, '#48cae4', 42);
                spawnParticleBurst(fx.tx, fx.ty + 0.5, fx.tz, 140, '#00b4d8', fx.radius * 1.35, 14.5, 1.95);
                spawnParticleBurst(fx.tx, fx.ty + 0.8, fx.tz, 95, '#e0fbfc', fx.radius * 1.05, 16.5, 1.6);
                spawnParticleBurst(fx.tx, fx.ty + 0.4, fx.tz, 55, '#0077b6', fx.radius * 0.85, 10.5, 2.05);
              } else {
                if (fx.shockWallMesh) fx.shockWallMesh.visible = true;
                if (fx.outerRingMesh) fx.outerRingMesh.visible = true;
                triggerLightFlash(fx.tx, fx.ty + 2, fx.tz, '#ffaa00', 42);
                // Colossal lava, spark & pyroclastic ash eruption
                spawnParticleBurst(fx.tx, fx.ty + 0.5, fx.tz, 120, '#ff5400', fx.radius * 1.45, 11.5, 1.85);
                spawnParticleBurst(fx.tx, fx.ty + 0.6, fx.tz, 60, '#ffee55', fx.radius * 0.95, 13.5, 1.45);
                spawnParticleBurst(fx.tx, fx.ty + 0.8, fx.tz, 45, '#2b2d42', fx.radius * 0.75, 8.5, 2.1);
              }
              if (fx.spikes) {
                for (const sp of fx.spikes) sp.visible = true;
              }
            }
            const wavePhase = Math.min(1, (fx.age - fx.impactDelay) / (fx.duration - fx.impactDelay));
            const easeOut = 1 - Math.pow(1 - wavePhase, 2.4);
            const isWaterSplash = !fx.ringMesh.visible;
            if (isWaterSplash) {
              // Towering vertical water splash column & crown instead of spherical shockwave dome
              const plumeH = Math.sin(wavePhase * Math.PI) * 5.2 + (1 - wavePhase) * 2.4;
              const plumeW = 0.9 + easeOut * fx.radius * 0.48;
              if (fx.innerDomeMesh && fx.materials[5]) {
                fx.innerDomeMesh.scale.set(plumeW * 0.82, Math.max(0.2, plumeH * 1.15), plumeW * 0.82);
                (fx.materials[5] as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - wavePhase) * 0.92);
              }
              if (fx.explosionDome) {
                fx.explosionDome.scale.set(plumeW, Math.max(0.2, plumeH), plumeW);
                (fx.materials[2] as THREE.MeshBasicMaterial).opacity = Math.pow(1 - wavePhase, 1.25) * 0.88;
              }
              if (fx.spikes) {
                const spikeH = Math.sin(wavePhase * Math.PI) * 3.4;
                for (const sp of fx.spikes) {
                  sp.scale.set(1.15, Math.max(0.05, spikeH), 1.15);
                }
              }
            } else {
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
        } else if (fx.kind === 'insight_circle' && fx.ringMesh) {
          // 5-second lingering Sacred Knowledge Circle with continuous upward particles
          if (fx.age >= fx.impactDelay && !fx.impactFired) {
            fx.impactFired = true;
            if (fx.deferImpact) {
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz);
              soundEngine.playBlessing();
            }
            triggerLightFlash(fx.tx, fx.ty, fx.tz, '#56cfe1', 15);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 28, '#56cfe1', fx.radius * 0.92, 2.8, 1.05, 1.8);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 16, '#e0fbfc', fx.radius * 0.75, 3.2, 0.9, 1.6);
          }
          const fadeIn = Math.min(1, fx.age / 0.3);
          const fadeOut = Math.min(1, (fx.duration - fx.age) / 0.85);
          const envelope = fadeIn * fadeOut;

          fx.ringMesh.scale.setScalar(fx.radius * (0.94 + Math.sin(fx.age * 3.2) * 0.04));
          fx.ringMesh.rotation.z = fx.age * 0.45;
          if (fx.outerRingMesh) {
            fx.outerRingMesh.rotation.z = -fx.age * 0.65;
            fx.outerRingMesh.scale.setScalar(fx.radius * (0.86 + Math.cos(fx.age * 2.8) * 0.04));
          }
          if (fx.thirdRingMesh) {
            fx.thirdRingMesh.scale.setScalar(fx.radius * (0.48 + Math.sin(fx.age * 4.5) * 0.06));
          }
          if (fx.motes) {
            for (const m of fx.motes) {
              const cycle = ((fx.age * m.speed + m.phase) % m.height) / m.height; // 0 -> 1 upward
              const yOff = cycle * m.height;
              const swirl = m.angle + fx.age * 0.55;
              m.mesh.position.set(
                fx.tx + Math.cos(swirl) * m.dist,
                fx.ty + 0.15 + yOff,
                fx.tz + Math.sin(swirl) * m.dist,
              );
              m.mesh.rotation.y = fx.age * 2.4 + m.phase;
              m.mesh.rotation.x = fx.age * 1.6;
              const moteScale = Math.sin(cycle * Math.PI) * 1.15 * envelope;
              m.mesh.scale.setScalar(Math.max(0.01, moteScale));
            }
          }
          // Emit a steady upward stream of glowing cyan & white particles throughout the 5s duration
          fx.particleEmitTimer = (fx.particleEmitTimer ?? 0) + dt;
          if (fx.particleEmitTimer >= 0.09 && fx.age < fx.duration - 0.5) {
            fx.particleEmitTimer = 0;
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 4, '#56cfe1', fx.radius * 0.9, 2.5, 0.9, 1.5);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 2, '#e0fbfc', fx.radius * 0.75, 3.0, 0.8, 1.4);
          }
          (fx.materials[0] as THREE.MeshBasicMaterial).opacity = 0.88 * envelope;
          (fx.materials[1] as THREE.MeshBasicMaterial).opacity = 0.78 * envelope;
          (fx.materials[2] as THREE.MeshBasicMaterial).opacity = 0.92 * envelope;
        } else if (fx.kind === 'blessing_bloom' && fx.ringMesh) {
          if (fx.age >= fx.impactDelay && !fx.impactFired) {
            fx.impactFired = true;
            if (fx.deferImpact) {
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz);
              soundEngine.playBlessing();
            }
            triggerLightFlash(fx.tx, fx.ty, fx.tz, '#f5b742', 14);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 26, '#f5b742', fx.radius * 0.9, 2.4, 1.0, 1.7);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 18, '#80ed99', fx.radius * 0.85, 2.1, 0.95, 1.6);
          }
          const envelope = Math.min(1, fx.age / 0.25) * Math.min(1, (fx.duration - fx.age) / 0.75);
          fx.ringMesh.scale.setScalar(fx.radius * (0.92 + Math.sin(fx.age * 3.5) * 0.05));
          if (fx.outerRingMesh) {
            const ripple = (fx.age * 0.65) % 1.0;
            fx.outerRingMesh.scale.setScalar(fx.radius * (0.25 + ripple * 0.78));
          }
          if (fx.motes) {
            for (const m of fx.motes) {
              const cycle = ((fx.age * m.speed + m.phase) % m.height) / m.height;
              const swirl = m.angle + cycle * 1.8;
              m.mesh.position.set(
                fx.tx + Math.cos(swirl) * m.dist,
                fx.ty + 0.15 + cycle * m.height,
                fx.tz + Math.sin(swirl) * m.dist,
              );
              m.mesh.rotation.y = fx.age * 2.2;
              m.mesh.scale.setScalar(Math.max(0.01, Math.sin(cycle * Math.PI) * envelope));
            }
          }
          fx.particleEmitTimer = (fx.particleEmitTimer ?? 0) + dt;
          if (fx.particleEmitTimer >= 0.11 && fx.age < fx.duration - 0.5) {
            fx.particleEmitTimer = 0;
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 3, '#f5b742', fx.radius * 0.88, 2.2, 0.88, 1.4);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 2, '#80ed99', fx.radius * 0.8, 2.0, 0.82, 1.4);
          }
          for (const mat of fx.materials) {
            (mat as THREE.MeshBasicMaterial).opacity = 0.85 * envelope;
          }
        } else if (fx.kind === 'golden_dawn' && fx.ringMesh) {
          if (fx.age >= fx.impactDelay && !fx.impactFired) {
            fx.impactFired = true;
            if (fx.deferImpact) {
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz);
              soundEngine.playBlessing();
              trauma = Math.min(1.0, trauma + 0.35);
            }
            triggerLightFlash(fx.tx, fx.ty + 2, fx.tz, '#ffd166', 20);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 36, '#ffd166', fx.radius * 0.95, 2.8, 1.1, 1.9);
          }
          const envelope = Math.min(1, fx.age / 0.3) * Math.min(1, (fx.duration - fx.age) / 0.9);
          fx.ringMesh.scale.setScalar(fx.radius * (0.96 + Math.sin(fx.age * 3.0) * 0.04));
          if (fx.outerRingMesh) fx.outerRingMesh.rotation.z = fx.age * 0.5;
          if (fx.thirdRingMesh) fx.thirdRingMesh.scale.setScalar(fx.radius * (0.42 + Math.cos(fx.age * 4) * 0.05));
          if (fx.floatingCrown) {
            fx.floatingCrown.position.y = fx.ty + 3.2 + Math.sin(fx.age * 2.5) * 0.25;
            fx.floatingCrown.rotation.y = fx.age * 1.4;
            fx.floatingCrown.children[0].rotation.z = fx.age * 1.8;
            fx.floatingCrown.children[1].rotation.x = Math.PI / 3 + fx.age * 1.2;
            fx.floatingCrown.scale.setScalar(Math.max(0.05, envelope));
          }
          if (fx.motes) {
            for (const m of fx.motes) {
              const cycle = ((fx.age * m.speed + m.phase) % m.height) / m.height;
              const swirl = m.angle - fx.age * 0.45;
              m.mesh.position.set(
                fx.tx + Math.cos(swirl) * m.dist,
                fx.ty + 0.15 + cycle * m.height,
                fx.tz + Math.sin(swirl) * m.dist,
              );
              m.mesh.rotation.y = fx.age * 2.5;
              m.mesh.scale.setScalar(Math.max(0.01, Math.sin(cycle * Math.PI) * 1.1 * envelope));
            }
          }
          fx.particleEmitTimer = (fx.particleEmitTimer ?? 0) + dt;
          if (fx.particleEmitTimer >= 0.09 && fx.age < fx.duration - 0.5) {
            fx.particleEmitTimer = 0;
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 5, '#ffd166', fx.radius * 0.95, 2.6, 0.95, 1.6);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 2, '#fff3b0', fx.radius * 0.7, 3.1, 0.85, 1.5);
          }
          for (const mat of fx.materials) {
            (mat as THREE.MeshBasicMaterial).opacity = 0.9 * envelope;
          }
        } else if (fx.kind === 'shield_pulse' && fx.ringMesh) {
          if (fx.age >= fx.impactDelay && !fx.impactFired) {
            fx.impactFired = true;
            if (fx.deferImpact) {
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz);
              soundEngine.playBlessing();
            }
            triggerLightFlash(fx.tx, fx.ty, fx.tz, '#72efdd', 18);
            spawnParticleBurst(fx.tx, fx.ty + 0.35, fx.tz, 45, '#72efdd', fx.radius * 0.9, 5.2, 1.15);
          }
          const tNorm = Math.min(1, fx.age / fx.duration);
          const easeOut = 1 - Math.pow(1 - tNorm, 2.4);
          if (fx.explosionDome) {
            fx.explosionDome.scale.set(
              0.3 + easeOut * fx.radius * 1.02,
              0.3 + easeOut * fx.radius * 0.7,
              0.3 + easeOut * fx.radius * 1.02,
            );
          }
          fx.ringMesh.scale.setScalar(0.4 + easeOut * fx.radius * 1.35);
          if (fx.outerRingMesh) {
            fx.outerRingMesh.scale.setScalar(0.2 + tNorm * fx.radius * 1.65);
          }
          (fx.materials[0] as THREE.MeshBasicMaterial).opacity = (1 - tNorm) * 0.58;
          (fx.materials[1] as THREE.MeshBasicMaterial).opacity = (1 - tNorm) * 0.95;
        } else if (fx.kind === 'fury_vortex' && fx.ringMesh) {
          if (fx.age >= fx.impactDelay && !fx.impactFired) {
            fx.impactFired = true;
            if (fx.deferImpact) {
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz);
              soundEngine.playCurse();
              trauma = Math.min(1.0, trauma + 0.45);
            }
            triggerLightFlash(fx.tx, fx.ty, fx.tz, '#e63946', 18);
            spawnParticleBurst(fx.tx, fx.ty + 0.3, fx.tz, 48, '#e63946', fx.radius * 0.85, 5.5, 1.2);
          }
          const envelope = Math.min(1, fx.age / 0.2) * Math.min(1, (fx.duration - fx.age) / 0.7);
          fx.ringMesh.scale.setScalar(fx.radius * (0.94 + Math.sin(fx.age * 8) * 0.05));
          if (fx.outerRingMesh) {
            fx.outerRingMesh.rotation.z = fx.age * 2.8;
          }
          if (fx.motes) {
            for (const m of fx.motes) {
              const a = m.angle + fx.age * m.speed;
              const r = m.dist * (0.85 + Math.sin(fx.age * 5 + m.phase) * 0.15);
              m.mesh.position.set(
                fx.tx + Math.cos(a) * r,
                fx.ty + m.height + Math.sin(fx.age * 7 + m.phase) * 0.25,
                fx.tz + Math.sin(a) * r,
              );
              m.mesh.rotation.y = -a;
              m.mesh.scale.setScalar(Math.max(0.01, envelope * 1.1));
            }
          }
          fx.particleEmitTimer = (fx.particleEmitTimer ?? 0) + dt;
          if (fx.particleEmitTimer >= 0.1 && fx.age < fx.duration - 0.4) {
            fx.particleEmitTimer = 0;
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 4, '#e63946', fx.radius * 0.85, 3.2, 0.9, 1.1);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 2, '#ff7b00', fx.radius * 0.7, 3.6, 0.85, 1.0);
          }
          for (const mat of fx.materials) {
            (mat as THREE.MeshBasicMaterial).opacity = 0.9 * envelope;
          }
        } else if (fx.kind === 'curse_eclipse' && fx.ringMesh) {
          if (fx.age >= fx.impactDelay && !fx.impactFired) {
            fx.impactFired = true;
            if (fx.deferImpact) {
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz);
              soundEngine.playCurse();
              trauma = Math.min(1.0, trauma + 0.4);
            }
            triggerLightFlash(fx.tx, fx.ty, fx.tz, '#9d4edd', 16);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 30, '#9d4edd', fx.radius * 0.9, 1.9, 1.05, 1.8);
          }
          const envelope = Math.min(1, fx.age / 0.25) * Math.min(1, (fx.duration - fx.age) / 0.8);
          // Inward-collapsing dark eclipse rings
          const collapseCycle = (fx.age * 0.75) % 1.0;
          if (fx.outerRingMesh) {
            fx.outerRingMesh.scale.setScalar(fx.radius * (1.05 - collapseCycle * 0.8));
          }
          fx.ringMesh.scale.setScalar(fx.radius * (0.95 + Math.sin(fx.age * 4) * 0.04));
          if (fx.motes) {
            for (const m of fx.motes) {
              const cycle = ((fx.age * m.speed + m.phase) % m.height) / m.height;
              const inwardR = m.dist * (1 - cycle * 0.65);
              const swirl = m.angle - fx.age * 1.4;
              m.mesh.position.set(
                fx.tx + Math.cos(swirl) * inwardR,
                fx.ty + 0.15 + cycle * m.height,
                fx.tz + Math.sin(swirl) * inwardR,
              );
              m.mesh.rotation.y = swirl;
              m.mesh.scale.setScalar(Math.max(0.01, Math.sin(cycle * Math.PI) * envelope));
            }
          }
          fx.particleEmitTimer = (fx.particleEmitTimer ?? 0) + dt;
          if (fx.particleEmitTimer >= 0.12 && fx.age < fx.duration - 0.5) {
            fx.particleEmitTimer = 0;
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 4, '#9d4edd', fx.radius * 0.88, 1.8, 0.95, 1.5);
          }
          for (const mat of fx.materials) {
            (mat as THREE.MeshBasicMaterial).opacity = 0.88 * envelope;
          }
        } else if (fx.kind === 'plague_eruption' && fx.ringMesh) {
          if (fx.age >= fx.impactDelay && !fx.impactFired) {
            fx.impactFired = true;
            if (fx.deferImpact) {
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz);
              soundEngine.playCurse();
            }
            triggerLightFlash(fx.tx, fx.ty, fx.tz, '#80ed99', 15);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 34, '#80ed99', fx.radius * 0.9, 2.2, 1.1, 1.7);
          }
          const envelope = Math.min(1, fx.age / 0.22) * Math.min(1, (fx.duration - fx.age) / 0.75);
          fx.ringMesh.scale.setScalar(fx.radius * (0.92 + Math.sin(fx.age * 4.5) * 0.06));
          if (fx.motes) {
            for (const m of fx.motes) {
              const bubbleCycle = ((fx.age * m.speed + m.phase) % m.height) / m.height;
              const swell = Math.sin(bubbleCycle * Math.PI) * 0.85 * envelope;
              m.mesh.position.set(
                fx.tx + Math.cos(m.angle) * m.dist,
                fx.ty + 0.12 + bubbleCycle * m.height,
                fx.tz + Math.sin(m.angle) * m.dist,
              );
              m.mesh.scale.set(swell * 1.15, swell * 0.85, swell * 1.15);
            }
          }
          fx.particleEmitTimer = (fx.particleEmitTimer ?? 0) + dt;
          if (fx.particleEmitTimer >= 0.11 && fx.age < fx.duration - 0.4) {
            fx.particleEmitTimer = 0;
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 4, '#80ed99', fx.radius * 0.85, 2.0, 0.95, 1.4);
          }
          for (const mat of fx.materials) {
            (mat as THREE.MeshBasicMaterial).opacity = 0.84 * envelope;
          }
        } else if (fx.kind === 'terraform_strata' && fx.ringMesh) {
          if (fx.age >= fx.impactDelay && !fx.impactFired) {
            fx.impactFired = true;
            if (fx.deferImpact) {
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz);
              soundEngine.playHeavyImpact();
              trauma = Math.min(1.0, trauma + 0.6);
              hitstopTimer = 0.04;
            }
            triggerLightFlash(fx.tx, fx.ty, fx.tz, '#06d6a0', 20);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 36, '#06d6a0', fx.radius * 0.92, 3.0, 1.1, 1.7);
          }
          const envelope = Math.min(1, fx.age / 0.2) * Math.min(1, (fx.duration - fx.age) / 0.75);
          fx.ringMesh.scale.setScalar(fx.radius * (0.98 + Math.sin(fx.age * 4) * 0.03));
          if (fx.strataRings) {
            for (let s = 0; s < fx.strataRings.length; s++) {
              const sr = fx.strataRings[s];
              const cycle = ((fx.age * 0.75 + s * 0.25) % 1.0);
              sr.position.y = fx.ty + 0.15 + cycle * 4.2;
              sr.scale.setScalar(fx.radius * (0.98 - cycle * 0.38));
              sr.rotation.z = (s % 2 === 0 ? 1 : -1) * fx.age * 0.8;
            }
          }
          if (fx.motes) {
            for (const m of fx.motes) {
              const cycle = ((fx.age * m.speed + m.phase) % m.height) / m.height;
              m.mesh.position.set(
                fx.tx + Math.cos(m.angle) * m.dist,
                fx.ty + 0.15 + cycle * m.height,
                fx.tz + Math.sin(m.angle) * m.dist,
              );
              m.mesh.rotation.y = fx.age * 1.8;
              m.mesh.scale.setScalar(Math.max(0.01, Math.sin(cycle * Math.PI) * 0.5 * envelope));
            }
          }
          fx.particleEmitTimer = (fx.particleEmitTimer ?? 0) + dt;
          if (fx.particleEmitTimer >= 0.1 && fx.age < fx.duration - 0.4) {
            fx.particleEmitTimer = 0;
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 4, '#06d6a0', fx.radius * 0.9, 2.7, 0.95, 1.4);
          }
          for (const mat of fx.materials) {
            (mat as THREE.MeshBasicMaterial).opacity = 0.88 * envelope;
          }
        } else if (fx.kind === 'rift_implosion' && fx.ringMesh) {
          const prePhase = Math.min(1, fx.age / fx.impactDelay);
          if (prePhase < 1) {
            // Gravitational inward collapse before event horizon birth
            fx.ringMesh.scale.setScalar(fx.radius * (1.35 - prePhase * 1.05));
            if (fx.outerRingMesh) {
              fx.outerRingMesh.scale.setScalar(fx.radius * (1.4 - prePhase * 1.15));
              fx.outerRingMesh.rotation.z = fx.age * 6.0;
            }
            if (fx.motes) {
              for (const m of fx.motes) {
                const r = m.dist * (1 - prePhase * 0.88);
                const a = m.angle + prePhase * 3.5;
                m.mesh.position.set(
                  fx.tx + Math.cos(a) * r,
                  fx.ty + 1.8 + (m.height - 1.8) * (1 - prePhase),
                  fx.tz + Math.sin(a) * r,
                );
              }
            }
          } else {
            if (!fx.impactFired) {
              fx.impactFired = true;
              if (fx.deferImpact) {
                executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz);
                soundEngine.playHeavyImpact();
                trauma = Math.min(1.0, trauma + 0.65);
                hitstopTimer = 0.05;
              }
              triggerLightFlash(fx.tx, fx.ty + 1.8, fx.tz, '#c77dff', 22);
              spawnParticleBurst(fx.tx, fx.ty + 1.5, fx.tz, 55, '#c77dff', fx.radius * 0.95, 6.2, 1.25);
              spawnParticleBurst(fx.tx, fx.ty + 1.5, fx.tz, 28, '#56cfe1', fx.radius * 0.65, 6.8, 1.1);
            }
            const postPhase = Math.min(1, (fx.age - fx.impactDelay) / (fx.duration - fx.impactDelay));
            const envelope = 1 - postPhase;
            fx.ringMesh.scale.setScalar(0.3 + Math.sqrt(postPhase) * fx.radius * 1.35);
            if (fx.outerRingMesh) {
              fx.outerRingMesh.scale.setScalar(0.25 + postPhase * fx.radius * 1.15);
              fx.outerRingMesh.rotation.z = fx.age * 5.0;
            }
            if (fx.motes) {
              for (const m of fx.motes) {
                const a = m.angle + fx.age * m.speed;
                const r = m.dist * (0.25 + (1 - postPhase * 0.6) * 0.75);
                m.mesh.position.set(
                  fx.tx + Math.cos(a) * r,
                  fx.ty + m.height + Math.sin(fx.age * 5 + m.phase) * 0.3,
                  fx.tz + Math.sin(a) * r,
                );
                m.mesh.scale.setScalar(Math.max(0.01, envelope * 0.9));
              }
            }
            for (const mat of fx.materials) {
              (mat as THREE.MeshBasicMaterial).opacity = 0.9 * envelope;
            }
          }
        } else if (fx.kind === 'earthquake_quake' && fx.ringMesh) {
          if (fx.age >= fx.impactDelay && !fx.impactFired) {
            fx.impactFired = true;
            if (fx.deferImpact) {
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, {
                faultSegments: fx.faultSegments,
                quakeShapeKind: fx.quakeShapeKind,
                quakeExtent: fx.radius,
              });
            }
            trauma = Math.max(trauma, 0.64);
            hitstopTimer = 0.04;
            triggerLightFlash(fx.tx, fx.ty + 1.5, fx.tz, '#e07a2b', 28);
            const segs = fx.faultSegments;
            if (segs && segs.length > 0) {
              for (let si = 0; si < segs.length; si++) {
                const s = segs[si];
                const mx = (s.x1 + s.x2) * 0.5;
                const mz = (s.z1 + s.z2) * 0.5;
                spawnParticleBurst(mx, fx.ty + 0.35, mz, 10, '#a88b70', s.width * 1.4, 5.2, 1.25);
                spawnParticleBurst(mx, fx.ty + 0.35, mz, 6, '#e07a2b', s.width * 1.1, 6.0, 1.05);
              }
            } else {
              spawnParticleBurst(fx.tx, fx.ty + 0.35, fx.tz, 48, '#a88b70', fx.radius * 0.85, 5.8, 1.35);
              spawnParticleBurst(fx.tx, fx.ty + 0.35, fx.tz, 26, '#e07a2b', fx.radius * 0.65, 6.4, 1.15);
            }
          }
          const phase = Math.min(1, fx.age / fx.duration);
          const env = 1 - phase;
          const shockCycle = (fx.age * 1.5) % 1;
          fx.ringMesh.scale.setScalar(0.5 + shockCycle * Math.min(6.2, fx.radius * 0.62));
          (fx.materials[0] as THREE.MeshBasicMaterial).opacity = Math.sin(shockCycle * Math.PI) * 0.62 * env;
          if (fx.crackMeshes) {
            for (let ci = 0; ci < fx.crackMeshes.length; ci++) {
              const cm = fx.crackMeshes[ci];
              const revealOffset = (cm.userData.revealOffset as number) || 0;
              const targetLen = (cm.userData.targetLen as number) || 3;
              const segProg = Math.min(1, Math.max(0.01, (fx.age - revealOffset) / 0.25));
              cm.scale.x = targetLen * segProg;
            }
            (fx.materials[1] as THREE.MeshBasicMaterial).opacity = 0.88 * env;
          }
          if (fx.spikes) {
            const dropPhase = fx.age > fx.duration - 0.65 ? Math.max(0, (fx.duration - fx.age) / 0.65) : 1;
            for (let si = 0; si < fx.spikes.length; si++) {
              const sp = fx.spikes[si];
              const revealOffset = (sp.userData.revealOffset as number) || 0;
              const upPhase = Math.min(1, Math.max(0.01, (fx.age - revealOffset) / 0.26));
              const targetH = (sp.userData.targetH as number) || 0.8;
              const targetW = (sp.userData.targetW as number) || 0.82;
              sp.scale.set(targetW, Math.max(0.01, targetH * upPhase * dropPhase), targetW);
              sp.position.y = fx.ty + Math.sin(elapsedTotal * 42 + si) * 0.06 * env;
            }
          }
        } else if (fx.kind === 'dragon_flame' && fx.flameOuterCone && fx.flameCoreCone && fx.ringMesh) {
          if (fx.sourceUnitId) {
            const srcUnit = simRef.current.units.find((u) => u.id === fx.sourceUnitId);
            if (!srcUnit || srcUnit.state === 'ko' || srcUnit.dragonRunPhase === 'turn') {
              fx.age = Math.max(fx.age, fx.duration - 0.16);
            }
          }
          if (fx.age >= fx.impactDelay && !fx.impactFired) {
            fx.impactFired = true;
            spawnParticleBurst(fx.tx, fx.ty + 0.15, fx.tz, 18, fx.colorHex, 1.25, 4.6, 1.2);
          }
          const prog = Math.min(1, fx.age / fx.duration);
          const extendProg = Math.min(1, prog / 0.14);
          const fadeOut = prog > 0.72 ? Math.max(0, 1 - (prog - 0.72) / 0.28) : 1;
          const pulse = 0.9 + Math.sin(elapsedTotal * 34) * 0.14;
          const reach = fx.radius * extendProg;
          const coneScale = (0.78 + extendProg * 0.34) * pulse * (0.4 + fadeOut * 0.6);

          fx.flameOuterCone.scale.set(coneScale, coneScale, Math.max(0.15, reach));
          fx.flameCoreCone.scale.set(coneScale * 0.85, coneScale * 0.85, Math.max(0.15, reach * 0.94));
          (fx.materials[0] as THREE.MeshBasicMaterial).opacity = 0.82 * fadeOut;
          (fx.materials[1] as THREE.MeshBasicMaterial).opacity = 0.94 * fadeOut;

          fx.ringMesh.scale.setScalar(0.35 + prog * 1.65);
          (fx.materials[2] as THREE.MeshBasicMaterial).opacity = Math.sin(prog * Math.PI) * 0.92;

          // Emit continuous directional flame & ember stream from dragon's mouth down onto target!
          fx.particleEmitTimer = (fx.particleEmitTimer ?? 0) + dt;
          if (fx.particleEmitTimer >= 0.035 && prog < 0.78) {
            fx.particleEmitTimer = 0;
            spawnDirectionalFlameStream(
              fx.ox ?? fx.tx,
              fx.oy ?? fx.ty + 2.5,
              fx.oz ?? fx.tz,
              fx.tx,
              fx.ty,
              fx.tz,
              8,
              fx.colorHex,
              0.55,
            );
            spawnParticleBurst(fx.tx, fx.ty + 0.15, fx.tz, 4, fx.colorHex, 0.85, 3.4, 1.05);
          }
        } else if (fx.kind === 'animal_strike' && fx.ringMesh) {
          const prog = Math.min(1, fx.age / fx.duration);
          const easeOut = 1 - Math.pow(1 - prog, 2);
          const env = 1 - prog;
          fx.ringMesh.scale.setScalar(0.28 + easeOut * fx.radius * 1.15);
          (fx.materials[2] as THREE.MeshBasicMaterial).opacity = env * 0.9;
          if (fx.outerRingMesh) {
            fx.outerRingMesh.scale.setScalar(0.18 + prog * fx.radius * 1.45);
          }
          if (fx.slashMeshes) {
            for (let si = 0; si < fx.slashMeshes.length; si++) {
              const sm = fx.slashMeshes[si];
              const sScale = 0.65 + easeOut * 0.75;
              sm.scale.set(sScale, 1 + (1 - env) * 0.35, sScale);
            }
          }
          (fx.materials[0] as THREE.MeshBasicMaterial).opacity = env * 0.95;
          (fx.materials[1] as THREE.MeshBasicMaterial).opacity = env * 0.9;
        } else if (fx.kind === 'ripple_ring' && fx.ringMesh) {
          if (fx.age >= fx.impactDelay && !fx.impactFired) {
            fx.impactFired = true;
            spawnParticleBurst(fx.tx, fx.ty + 0.25, fx.tz, 22, fx.colorHex, fx.radius * 0.65, 3.8, 0.95);
          }
          const wavePhase = Math.min(1, fx.age / fx.duration);
          const easeOut = 1 - (1 - wavePhase) * (1 - wavePhase);
          fx.ringMesh.scale.setScalar(0.35 + easeOut * fx.radius * 1.05);
          (fx.materials[0] as THREE.MeshBasicMaterial).opacity = (1 - wavePhase) * 0.85;
          if (fx.outerRingMesh) {
            fx.outerRingMesh.scale.setScalar(0.2 + wavePhase * fx.radius * 1.25);
            (fx.materials[1] as THREE.MeshBasicMaterial).opacity = (1 - wavePhase) * 0.75;
          }
        }

        if (fx.age >= fx.duration) {
          burstFxGroup.remove(fx.group);
          for (const m of fx.materials) m.dispose();
          activeBurstFx.splice(i, 1);
        }
      }

      syncSceneFromSimulation(simRef.current, dt, elapsedTotal);

      // Lock active dragon_flame cones to the gliding dragon's 3D jaw (fire_maw) with zero frame lag
      for (let i = 0; i < activeBurstFx.length; i++) {
        const fx = activeBurstFx[i];
        if (
          fx.kind === 'dragon_flame' &&
          fx.sourceUnitId &&
          fx.flameOuterCone &&
          fx.flameCoreCone &&
          fx.ringMesh
        ) {
          const uEntry = unitMeshes.get(fx.sourceUnitId);
          if (uEntry) {
            uEntry.group.updateMatrixWorld(true);
            const mawObj = uEntry.group.getObjectByName('fire_maw') ?? uEntry.group;
            mawObj.getWorldPosition(_mawWorldPos);
            fx.ox = _mawWorldPos.x;
            fx.oy = _mawWorldPos.y;
            fx.oz = _mawWorldPos.z;

            const fwdX = Math.sin(uEntry.group.rotation.y);
            const fwdZ = Math.cos(uEntry.group.rotation.y);
            const sweepX = _mawWorldPos.x + fwdX * 2.05;
            const sweepZ = _mawWorldPos.z + fwdZ * 2.05;
            const sTile = getTileFromArray(simRef.current, sweepX, sweepZ);
            const sweepY =
              (sTile ? Math.max(0.22, sTile.height * HEIGHT_STEP + 0.25) : fx.ty) + 0.22;

            fx.tx = THREE.MathUtils.damp(fx.tx, sweepX, 9, dt);
            fx.ty = THREE.MathUtils.damp(fx.ty, sweepY, 9, dt);
            fx.tz = THREE.MathUtils.damp(fx.tz, sweepZ, 9, dt);

            _segVecTemp.set(fx.tx - fx.ox, fx.ty - fx.oy, fx.tz - fx.oz);
            const segLen = Math.max(0.65, _segVecTemp.length());
            fx.radius = segLen;
            _segDirTemp.copy(_segVecTemp).divideScalar(segLen);

            fx.flameOuterCone.position.set(fx.ox, fx.oy, fx.oz);
            fx.flameOuterCone.quaternion.setFromUnitVectors(_zUnitAxis, _segDirTemp);
            fx.flameCoreCone.position.set(fx.ox, fx.oy, fx.oz);
            fx.flameCoreCone.quaternion.copy(fx.flameOuterCone.quaternion);
            fx.ringMesh.position.set(fx.tx, fx.ty - 0.08, fx.tz);

            const prog = Math.min(1, fx.age / fx.duration);
            const extendProg = Math.min(1, prog / 0.14);
            const reach = fx.radius * extendProg;
            fx.flameOuterCone.scale.z = Math.max(0.15, reach);
            fx.flameCoreCone.scale.z = Math.max(0.15, reach * 0.94);
          }
        }
      }

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
        p.vy -= p.gravity * dt; // Gravity (positive falls down, negative floats skyward)
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.gravity > 0 && p.y < 0.22 && p.vy < 0) {
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

      const isInspectMode =
        propsRef.current.gameState === 'playing' &&
        propsRef.current.activeTool.kind === 'inspect';

      if (!isInspectMode && hoveredEntityInternal !== null) {
        hoveredEntityInternal = null;
        propsRef.current.onHoverEntityChange?.(null);
      }

      const activeHoverUnitId = isInspectMode
        ? (propsRef.current.hoveredEntityId ?? hoveredEntityInternal)
        : null;
      const activeSelectedUnitId = isInspectMode
        ? propsRef.current.selectedEntityId
        : null;

      // Update Hover Highlight Ring (cyan pulsing enclosure + diamond pointer for hovered living unit)
      const hoverTargetUnit = activeHoverUnitId
        ? simRef.current.units.find((u) => u.id === activeHoverUnitId && u.state !== 'ko')
        : undefined;
      if (hoverTargetUnit) {
        const metrics = getUnitInspectMetrics(hoverTargetUnit);
        const uGrp = unitMeshes.get(hoverTargetUnit.id)?.group;
        const hx = uGrp ? uGrp.position.x : hoverTargetUnit.x;
        const hy = uGrp ? uGrp.position.y : 0.5;
        const hz = uGrp ? uGrp.position.z : hoverTargetUnit.z;
        const pulse = 1 + Math.sin(elapsedTotal * 7.5) * 0.08;
        hoverHighlightRig.group.visible = true;
        hoverHighlightRig.group.position.set(hx, hy, hz);
        hoverHighlightRig.ringRoot.scale.setScalar(metrics.ringScale * pulse);
        hoverHighlightRig.ringRoot.rotation.y = elapsedTotal * 1.4;
        hoverHighlightRig.pointer.position.y =
          metrics.bodyHeight + 0.45 + Math.sin(elapsedTotal * 5.2) * 0.09;
        hoverHighlightRig.pointer.rotation.y = elapsedTotal * 2.6;
        hoverHighlightRig.ringMat.opacity = 0.78 + Math.sin(elapsedTotal * 7.5) * 0.18;
      } else {
        hoverHighlightRig.group.visible = false;
      }

      // Update Selected Highlight Ring (warm amber-gold enclosure)
      const selectedTargetUnit =
        activeSelectedUnitId && activeSelectedUnitId !== activeHoverUnitId
          ? simRef.current.units.find((u) => u.id === activeSelectedUnitId && u.state !== 'ko')
          : activeSelectedUnitId && activeSelectedUnitId === activeHoverUnitId
            ? hoverTargetUnit
            : undefined;
      if (selectedTargetUnit) {
        const metrics = getUnitInspectMetrics(selectedTargetUnit);
        const uGrp = unitMeshes.get(selectedTargetUnit.id)?.group;
        const sx = uGrp ? uGrp.position.x : selectedTargetUnit.x;
        const sy = uGrp ? uGrp.position.y : 0.5;
        const sz = uGrp ? uGrp.position.z : selectedTargetUnit.z;
        const ringPad = selectedTargetUnit.id === activeHoverUnitId ? 1.18 : 1.0;
        selectedHighlightRig.group.visible = true;
        selectedHighlightRig.group.position.set(sx, sy, sz);
        selectedHighlightRig.ringRoot.scale.setScalar(metrics.ringScale * ringPad);
        selectedHighlightRig.ringRoot.rotation.y = -elapsedTotal * 0.9;
        selectedHighlightRig.pointer.visible = selectedTargetUnit.id !== activeHoverUnitId;
        selectedHighlightRig.pointer.position.y =
          metrics.bodyHeight + 0.48 + Math.sin(elapsedTotal * 4.2) * 0.07;
        selectedHighlightRig.pointer.rotation.y = -elapsedTotal * 2.1;
      } else {
        selectedHighlightRig.group.visible = false;
      }

      // Update Persistent Golden Star Markers above Favorited Living Units & Royal Crowns above Kings
      let favCount = 0;
      let kingCount = 0;
      const simUnitsList = simRef.current.units;
      for (let i = 0; i < simUnitsList.length; i++) {
        const fu = simUnitsList[i];
        if (fu.state === 'ko') continue;
        if (fu.favorite && favCount < MAX_FAVORITE_STARS) {
          const metrics = getUnitInspectMetrics(fu);
          const uGrp = unitMeshes.get(fu.id)?.group;
          const fx = uGrp ? uGrp.position.x : fu.x;
          const fy =
            (uGrp ? uGrp.position.y : 0.5) +
            metrics.bodyHeight +
            0.32 +
            Math.sin(elapsedTotal * 3.8 + favCount * 1.1) * 0.06;
          const fz = uGrp ? uGrp.position.z : fu.z;
          _dummyPos.set(fx, fy, fz);
          _dummyQuat.setFromAxisAngle(_propAxisY, elapsedTotal * 2.2 + favCount);
          _dummyScale.set(1.1, 1.35, 1.1);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          favoriteStarsInst.setMatrixAt(favCount, _dummyMatrix);
          favCount++;
        }
        if (
          (propsRef.current.zoneOverlayBuffers?.kingsActive ||
            propsRef.current.zoneOverlayBuffers?.kingdomsActive) &&
          fu.isKing &&
          fu.faction === 'civilization' &&
          kingCount < MAX_KING_CROWNS
        ) {
          const metrics = getUnitInspectMetrics(fu);
          const uGrp = unitMeshes.get(fu.id)?.group;
          const kx = uGrp ? uGrp.position.x : fu.x;
          const ky =
            (uGrp ? uGrp.position.y : 0.5) +
            metrics.bodyHeight +
            0.22 +
            Math.sin(elapsedTotal * 3.0 + kingCount) * 0.04;
          const kz = uGrp ? uGrp.position.z : fu.z;
          _dummyPos.set(kx, ky, kz);
          _dummyQuat.setFromAxisAngle(_propAxisY, elapsedTotal * 1.6 + kingCount);
          _dummyScale.set(1.0, 1.0, 1.0);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          kingCrownsInst.setMatrixAt(kingCount, _dummyMatrix);
          kingCount++;
        }
      }
      _dummyQuat.identity();
      favoriteStarsInst.count = favCount;
      if (favCount > 0) {
        favoriteStarsInst.instanceMatrix.needsUpdate = true;
      }
      kingCrownsInst.count = kingCount;
      if (kingCount > 0) {
        kingCrownsInst.instanceMatrix.needsUpdate = true;
      }

      // Update Hover Reticle position & radius
      if (
        hoveredTileCoords &&
        propsRef.current.gameState === 'playing' &&
        !(isInspectMode && hoverTargetUnit)
      ) {
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

      // Animate pixelated starry space backdrop, sculpted sky clouds & ocean coastal/reef/whitecap foaming
      pixelSpace.update({
        elapsed: elapsedTotal,
        width: renderWidth,
        height: renderHeight,
        pixelScale: propsRef.current.pixelScale || 3,
        camYaw,
        camX: camTarget.x,
        camZ: camTarget.z,
        frustumSize,
        preset,
      });

      worldUnderglow.update(
        elapsedTotal,
        preset,
        simRef.current.epochIndex,
        propsRef.current.pixelScale || 3,
      );
      if (preset === 'dusk') {
        glowTrimMat.color.set('#d98078');
        glowTrimMat.opacity = 0.4;
      } else if (preset === 'night') {
        glowTrimMat.color.set('#56cfe1');
        glowTrimMat.opacity = 0.5;
      } else if (preset === 'dawn') {
        glowTrimMat.color.set('#7fd4e6');
        glowTrimMat.opacity = 0.42;
      } else {
        glowTrimMat.color.set('#4eb8d4');
        glowTrimMat.opacity = 0.38;
      }

      const atmosSpeed =
        propsRef.current.timeScale === 0
          ? 0.35
          : 1 + Math.min(3, Math.max(0, propsRef.current.timeScale - 1)) * 0.25;
      skyClouds.update(dt * atmosSpeed, elapsedTotal, preset);
      oceanFoam.updateFrame(elapsedTotal, preset);
      styledTerrain.updateFrame(elapsedTotal, simRef.current.epochIndex);

      // Smooth exponential camera damping + decaying trauma shake
      const followDamp = propsRef.current.followingEntityId ? 11 : 8;
      camYaw = THREE.MathUtils.damp(camYaw, camDesiredYaw, 8, dt);
      camTarget.x = THREE.MathUtils.damp(camTarget.x, camDesiredTarget.x, followDamp, dt);
      camTarget.y = THREE.MathUtils.damp(camTarget.y, camDesiredTarget.y, followDamp, dt);
      camTarget.z = THREE.MathUtils.damp(camTarget.z, camDesiredTarget.z, followDamp, dt);

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

      // Sustained earthquake tremor keeps a subtle, tapering camera rumble during active quake zones
      let maxQuakeFade = 0;
      const hazards = simRef.current.activeHazards ?? [];
      for (let hi = 0; hi < hazards.length; hi++) {
        const hz = hazards[hi];
        if (hz.kind === 'earthquake_zone' && hz.remaining > 0) {
          const fade = Math.min(1, hz.remaining / Math.max(1, hz.duration || 4));
          if (fade > maxQuakeFade) maxQuakeFade = fade;
        }
      }
      if (maxQuakeFade > 0) {
        const quakeFloor = 0.24 + 0.24 * maxQuakeFade;
        if (trauma > quakeFloor) {
          trauma = Math.max(quakeFloor, trauma - dt * 1.5);
        } else {
          trauma = quakeFloor;
        }
      } else {
        trauma = Math.max(0, trauma - dt * 2.0);
      }
      const shakePower = trauma * trauma;
      const shakeHoriz =
        frustumSize *
        0.013 *
        shakePower *
        (Math.sin(elapsedTotal * 38) * 0.6 + Math.sin(elapsedTotal * 61) * 0.25 + (Math.random() - 0.5) * 0.3);
      const shakeVert =
        frustumSize *
        0.01 *
        shakePower *
        (Math.cos(elapsedTotal * 33) * 0.6 + Math.cos(elapsedTotal * 53) * 0.25 + (Math.random() - 0.5) * 0.3);
      const shakeRightX = Math.cos(camYaw) * shakeHoriz;
      const shakeRightZ = -Math.sin(camYaw) * shakeHoriz;

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
      // Translate BOTH camera position and lookAt target together so orthographic view visibly shakes!
      camera.position.set(
        camTarget.x + Math.sin(camYaw) * isoDist + shakeRightX,
        camTarget.y + isoHeight + shakeVert,
        camTarget.z + Math.cos(camYaw) * isoDist + shakeRightZ,
      );
      camera.lookAt(
        camTarget.x + shakeRightX,
        camTarget.y + shakeVert,
        camTarget.z + shakeRightZ,
      );
      if (shakePower > 0.002) {
        camera.rotation.z += Math.sin(elapsedTotal * 34) * 0.008 * shakePower;
      }

      renderer.render(scene, camera);

      // Update floating screen-space Zone headers (Zone Name + Population if any)
      const curSim = simRef.current;
      const labelLayer = zoneLabelsLayerRef.current;
      if (labelLayer && labelLayer.children.length > 0) {
        const cWidth = container?.clientWidth || window.innerWidth;
        const cHeight = container?.clientHeight || window.innerHeight;
        const gSize = curSim.gridSize;
        const zoneProjVec = new THREE.Vector3();
        for (let i = 0; i < labelLayer.children.length; i++) {
          const el = labelLayer.children[i] as HTMLElement;
          const tx = Number(el.dataset.tileX);
          const tz = Number(el.dataset.tileZ);
          const tile = curSim.tiles[tz * gSize + tx];
          const worldY = Math.max(0.5, (tile ? tile.height : 1) * HEIGHT_STEP) + 1.8;
          zoneProjVec.set(tx, worldY, tz).project(camera);
          const sx = (zoneProjVec.x * 0.5 + 0.5) * cWidth;
          const sy = (-zoneProjVec.y * 0.5 + 0.5) * cHeight;
          if (zoneProjVec.z > 1 || sx < -120 || sx > cWidth + 120 || sy < -60 || sy > cHeight + 60) {
            el.style.opacity = '0';
          } else {
            el.style.opacity = '1';
            el.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0) translate(-50%, -100%)`;
          }
        }
      }

      // Update floating screen-space King Crown markers on the map
      const kingLayer = kingMarkersLayerRef.current;
      if (kingLayer && kingLayer.children.length > 0) {
        const cWidth = container?.clientWidth || window.innerWidth;
        const cHeight = container?.clientHeight || window.innerHeight;
        const gSize = curSim.gridSize;
        const kingProjVec = new THREE.Vector3();
        for (let i = 0; i < kingLayer.children.length; i++) {
          const el = kingLayer.children[i] as HTMLElement;
          const unitId = el.dataset.unitId;
          const kingUnit = unitId
            ? curSim.units.find((u) => u.id === unitId && u.state !== 'ko')
            : undefined;
          if (!kingUnit) {
            el.style.opacity = '0';
            continue;
          }
          const uGrp = unitMeshes.get(kingUnit.id)?.group;
          const kx = uGrp ? uGrp.position.x : kingUnit.x;
          const kz = uGrp ? uGrp.position.z : kingUnit.z;
          const tile = curSim.tiles[Math.round(kz) * gSize + Math.round(kx)];
          const baseY = uGrp
            ? uGrp.position.y
            : Math.max(0.5, (tile ? tile.height : 1) * HEIGHT_STEP);
          kingProjVec.set(kx, baseY + 1.45, kz).project(camera);
          const sx = (kingProjVec.x * 0.5 + 0.5) * cWidth;
          const sy = (-kingProjVec.y * 0.5 + 0.5) * cHeight;
          if (kingProjVec.z > 1 || sx < -120 || sx > cWidth + 120 || sy < -60 || sy > cHeight + 60) {
            el.style.opacity = '0';
          } else {
            el.style.opacity = '1';
            el.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0) translate(-50%, -100%)`;
          }
        }
      }

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
      domElem.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointerup', onPointerUp);
      domElem.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      hoverHighlightRig.dispose();
      selectedHighlightRig.dispose();
      favoriteStarGeo.dispose();
      favoriteStarMat.dispose();
      kingCrownGeo.dispose();
      kingCrownMat.dispose();
      for (const hv of hazardMeshes.values()) {
        for (const m of hv.materials) m.dispose();
      }
      for (const fx of activeBurstFx) {
        for (const m of fx.materials) m.dispose();
      }
      fireSpriteGeo.dispose();
      fireSmokeGeo.dispose();
      spriteBundle.dispose();
      sharedHazSphereGeo.dispose();
      sharedRainDropGeo.dispose();
      sharedDomeGeo.dispose();
      sharedDomeCylinderGeo.dispose();
      sharedHazRingGeo.dispose();
      sharedRiftTorusGeo.dispose();
      sharedRiftCoreGeo.dispose();
      sharedWaveBaseGeo.dispose();
      sharedWaveFaceGeo.dispose();
      sharedWaveLipGeo.dispose();
      sharedWaveFoamGeo.dispose();
      sharedFaultCrackGeo.dispose();
      sharedMeteorGeo.dispose();
      sharedMeteorAuraGeo.dispose();
      sharedExplosionDomeGeo.dispose();
      sharedBoltGeo.dispose();
      sharedRuneSquareGeo.dispose();
      sharedOrbMoteGeo.dispose();
      sharedShardMoteGeo.dispose();
      sharedPillarSpikeGeo.dispose();
      pixelSpace.dispose();
      worldUnderglow.dispose();
      skirtGeo.dispose();
      skirtMat.dispose();
      rimGeo.dispose();
      rimMat.dispose();
      glowTrimGeo.dispose();
      glowTrimMat.dispose();
      skyClouds.dispose();
      oceanFoam.dispose();
      styledTerrain.dispose();
      metroConcreteMat.dispose();
      metroParapetMat.dispose();
      metroRailMat.dispose();
      runwayBeaconMat.dispose();
      metroPillarGeo.dispose();
      metroCapGeo.dispose();
      metroDeckHubGeo.dispose();
      metroSpanEWGeo.dispose();
      metroSpanNSGeo.dispose();
      metroRailHubGeo.dispose();
      metroRailEWGeo.dispose();
      metroRailNSGeo.dispose();
      metroParapetEWGeo.dispose();
      metroParapetNSGeo.dispose();
      runwayBeaconGeo.dispose();
      renderer.dispose();
    };
  }, [cameraActionRef, simRef]);

  const activeLabels = zoneOverlayBuffers?.labels ?? [];
  const kingsOverlayOn = Boolean(
    zoneOverlayBuffers?.kingsActive || zoneOverlayBuffers?.kingdomsActive,
  );
  const activeKings =
    gameState !== 'title' && kingsOverlayOn
      ? simRef.current.units.filter(
          (u) => u.isKing && u.state !== 'ko' && u.faction === 'civilization',
        )
      : [];

  return (
    <>
      <div
        ref={mountRef}
        data-testid="isometric-world-canvas"
        className="fixed inset-0 w-full h-full bg-[#141210] overflow-hidden"
      />
      {gameState !== 'title' && activeKings.length > 0 && (
        <div
          ref={kingMarkersLayerRef}
          data-testid="king-map-markers-layer"
          className="fixed inset-0 z-20 pointer-events-none overflow-hidden select-none"
        >
          {activeKings.map((king) => {
            const simState = simRef.current;
            const rootKingdomId =
              (king.settlementId && simState.settlementKingdoms?.[king.settlementId]) ||
              king.kingdomId ||
              king.settlementId;
            const fallbackSpeciesHex =
              king.species === 'elf'
                ? '#10b981'
                : king.species === 'orc'
                  ? '#ef4444'
                  : '#3b82f6';
            const kingdomHex =
              (king.settlementId && zoneOverlayBuffers?.kingdomColors?.[king.settlementId]) ||
              (rootKingdomId && zoneOverlayBuffers?.kingdomColors?.[rootKingdomId]) ||
              fallbackSpeciesHex;
            const kingdomName =
              (rootKingdomId && simState.settlementNames?.[rootKingdomId]) ||
              (king.settlementId && simState.settlementNames?.[king.settlementId]) ||
              null;
            return (
              <div
                key={king.id}
                data-testid={`king-map-marker-${king.id}`}
                data-unit-id={king.id}
                data-kingdom-color={kingdomHex}
                style={{
                  backgroundColor: `color-mix(in srgb, ${kingdomHex} 28%, #161310)`,
                  borderColor: `color-mix(in srgb, ${kingdomHex} 55%, #000000)`,
                  left: 0,
                  top: 0,
                  boxShadow: '0 2px 0 #0b0a09',
                }}
                className="absolute px-2 py-0.5 border-2 flex items-center gap-1.5 whitespace-nowrap"
              >
                <svg
                  viewBox="0 0 16 14"
                  className="w-4 h-3.5 shrink-0"
                  aria-hidden="true"
                  shapeRendering="crispEdges"
                >
                  <rect x="7" y="0" width="2" height="2" fill="#fff3bf" />
                  <rect x="1" y="3" width="2" height="7" fill="#ffd166" />
                  <rect x="7" y="2" width="2" height="8" fill="#ffd166" />
                  <rect x="13" y="3" width="2" height="7" fill="#ffd166" />
                  <rect x="3" y="6" width="4" height="4" fill="#f59e0b" />
                  <rect x="9" y="6" width="4" height="4" fill="#f59e0b" />
                  <rect x="1" y="9" width="14" height="3" fill="#d97706" />
                  <rect x="3" y="10" width="2" height="1" fill="#38bdf8" />
                  <rect x="7" y="9" width="2" height="2" fill={kingdomHex} />
                  <rect x="11" y="10" width="2" height="1" fill="#10b981" />
                  <rect x="1" y="12" width="14" height="1" fill="#fff3bf" />
                </svg>
                <span
                  className="text-[11px] font-bold leading-none"
                  style={{ color: `color-mix(in srgb, ${kingdomHex} 78%, #ffffff)` }}
                >
                  {king.name}
                </span>
                {kingdomName && (
                  <span
                    className="text-[10px] font-semibold leading-none"
                    style={{ color: `color-mix(in srgb, ${kingdomHex} 45%, #e5dfd3)` }}
                  >
                    · {kingdomName}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {gameState !== 'title' && activeLabels.length > 0 && (
        <div
          ref={zoneLabelsLayerRef}
          data-testid="zone-map-labels-layer"
          className="fixed inset-0 z-10 pointer-events-none overflow-hidden select-none"
        >
          {activeLabels.map((lbl) => (
            <div
              key={lbl.id}
              data-testid={`zone-map-label-${lbl.id}`}
              data-tile-x={lbl.tileX}
              data-tile-z={lbl.tileZ}
              style={{
                backgroundColor: `color-mix(in srgb, ${lbl.hexColor} 28%, #161310)`,
                borderColor: `color-mix(in srgb, ${lbl.hexColor} 55%, #000000)`,
                left: 0,
                top: 0,
              }}
              className={`absolute px-2 py-0.5 border-2 flex items-center gap-1.5 whitespace-nowrap ${
                lbl.isHovered ? 'scale-110 z-20' : 'z-10'
              }`}
            >
              <span
                className="w-2 h-2 shrink-0"
                style={{ backgroundColor: lbl.hexColor }}
                aria-hidden="true"
              />
              <span className="text-[11px] font-bold text-[#f2ece1]">
                {lbl.name}
              </span>
              {lbl.population !== null && (
                <span className="font-pixel-num text-[10px] font-bold text-[#ffd166] tabular-nums">
                  {lbl.population}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};
