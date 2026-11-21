import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EPOCHS, GOD_POWERS, getDinosaurVariant } from '../game/catalog';
import { createAnimatedFireSpriteBundle } from '../game/fireSprites';
import {
  TreeBiomeKey,
  getVoxelTreeLibrary,
  mapTerrainToTreeBiome,
} from '../game/voxelTrees';
import {
  createAlienMothershipVisual,
  createBuildingGroup,
  createHyperspaceRippleEffects,
  createUnitGroup,
  createVehicleGroup,
  disposeEntityGroup,
  getNodeVariantLibrary,
  getSharedCarryMaterial,
  getSharedStatusRingMaterial,
  HyperspacePortalRig,
  HyperspaceRippleEffectsVisual,
  updateBuildingNightMaterials,
} from '../game/meshBuilders';
import {
  AutoOptimizer,
  AutoOptimizerDecisions,
  DESPAWN_CULL_HYSTERESIS,
  WorldCullBounds,
  computeOrthoGroundCullBounds,
  computeSnappedShadowBounds,
  isHazardIntersectingCullBounds,
  isPointInCullBounds,
} from '../game/autoOptimizer';
import {
  TIME_OF_DAY_PRESETS,
  clampSimulationSpeed,
  getEpochCityLightProfile,
  getTimeOfDayLightingState,
  wrapShaderTime,
} from '../game/dayNightLighting';
import {
  createOceanFoamSystem,
  createPixelSpaceSystem,
  createSkyCloudSystem,
  createStyledTerrainSystem,
  createWorldUnderglowSystem,
  createZoneOverlaySystem,
} from '../game/skyAndSea';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  ResolvedGraphicsProfile,
  resolveGraphicsProfile,
} from '../game/graphics';
import {
  TouchPoint,
  TwoFingerState,
  computeDynamicPixelScale,
  computeDynamicRenderDimensions,
  computeTwoFingerCameraDelta,
  computeTwoFingerState,
  getResponsiveMaxZoomOut,
  getResponsiveTitleFrustum,
  getResponsiveWholeMapFrustum,
} from '../game/cameraTouch';
import {
  beginDragUnit,
  closestFaultDistanceSq,
  executeGodPowerImpact,
  executeHugeAsteroidImpact,
  executeTerrainDropTileImpact,
  getSettlementAnchor,
  getSettlementEpoch,
  getUnitEpoch,
  releaseDragUnit,
  stepDraggedUnitKinematics,
  ensureWorldGrid,
  stepSimulation,
  updateDragUnit,
} from '../game/simulation';
import {
  CHUNK_SIZE,
  TERRAIN_TO_CODE,
  markTileDirty,
  raycastWorldGrid,
  syncWorldGridFromTiles,
} from '../game/worldGrid';
import { ChunkTerrainSystem } from '../game/chunkTerrainRenderer';
import { BatchedBuildingSystem } from '../game/batchedBuildings';
import { BatchedStaticPool } from '../game/batchedStaticProps';
import { TreeImpostorSystem } from '../game/treeImpostors';
import { EngineWorkerPool } from '../game/workerPool';
import {
  createMagicCirclePlaneGeometry,
  disposeMagicCircleTextureCache,
  getMagicCircleTexture,
  getMagicCircleThemeForPower,
} from '../game/magicCircles';
import {
  disposePixelReticleTextureCache,
  getPixelReticleTexture,
  getPowerEffectiveRadius,
  getTerrainTileRadius,
} from '../game/brushSizes';
import { soundEngine } from '../game/sound';
import {
  ActiveTool,
  BrushInputMode,
  EarthquakeFaultSegment,
  EarthquakeShapeKind,
  GameLifecycleState,
  GodPowerType,
  GraphicsSettings,
  LightingPreset,
  PerfTelemetrySnapshot,
  SimulationState,
  TerrainToolType,
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
  brushSize?: number;
  brushInputMode?: BrushInputMode;
  mobilePanMode?: boolean;
  pixelScale: number;
  lightingPreset: LightingPreset;
  graphicsSettings?: GraphicsSettings;
  cameraActionRef: React.MutableRefObject<{
    rotateDelta: number;
    zoomDelta: number;
    centerHome: boolean;
    playTransition?: boolean;
    focusTarget?: { x: number; z: number; zoom?: number } | null;
  }>;
  captureThumbnailRef?: React.MutableRefObject<(() => string | null) | null>;
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
  onPerfTelemetry?: (snapshot: PerfTelemetrySnapshot) => void;
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

export const IsometricWorldCanvas: React.FC<IsometricWorldCanvasProps> = React.memo(({
  simRef,
  gameState,
  timeScale,
  activeTool,
  brushRadius,
  brushSize = 1,
  brushInputMode = 'hold',
  mobilePanMode = false,
  pixelScale,
  lightingPreset,
  graphicsSettings = DEFAULT_GRAPHICS_SETTINGS,
  cameraActionRef,
  hoveredEntityId = null,
  selectedEntityId = null,
  followingEntityId = null,
  captureThumbnailRef,
  zoneOverlayBuffers,
  onTileInteract,
  onHoverTileChange,
  onHoverEntityChange,
  onSelectEntity,
  onBreakFollow,
  onSyncHud,
  onPerfTelemetry,
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
    brushSize,
    brushInputMode,
    mobilePanMode,
    pixelScale,
    lightingPreset,
    graphicsSettings,
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
    onPerfTelemetry,
  });

  useEffect(() => {
    propsRef.current = {
      gameState,
      timeScale,
      activeTool,
      brushRadius,
      brushSize,
      brushInputMode,
      mobilePanMode,
      pixelScale,
      lightingPreset,
      graphicsSettings,
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
      onPerfTelemetry,
    };
  }, [
    gameState,
    timeScale,
    activeTool,
    brushRadius,
    brushSize,
    brushInputMode,
    mobilePanMode,
    pixelScale,
    lightingPreset,
    graphicsSettings,
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
    onPerfTelemetry,
  ]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: false, // Deliberate crisp pixel edges
      powerPreference: 'high-performance',
    });
    const isSoftwareGl = (() => {
      const gl = renderer.getContext();
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.BasicShadowMap; // Crisp pixel-art shadow edges
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    renderer.domElement.className = 'w-full h-full block pixelated-canvas outline-none touch-none';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.tabIndex = 0;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070b14');
    scene.fog = new THREE.FogExp2(
      TIME_OF_DAY_PRESETS.noon.fogColorHex,
      TIME_OF_DAY_PRESETS.noon.fogDensity,
    );

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Orthographic camera for authentic isometric projection (responsive to portrait & landscape)
    const sim = simRef.current;
    const getCurrentAspect = () =>
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
    const getWholeMapFrustum = (gs: number) =>
      getResponsiveWholeMapFrustum(gs, getCurrentAspect());
    const aspect = getCurrentAspect();
    let frustumSize =
      propsRef.current.gameState === 'title'
        ? getResponsiveTitleFrustum(aspect)
        : getWholeMapFrustum(sim.gridSize);
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

    const initialGfxProfile = resolveGraphicsProfile(propsRef.current.graphicsSettings, 0);
    const keyLight = new THREE.DirectionalLight(0xffdfb0, 1.85);
    keyLight.position.set(gridCenter + 12, 28, gridCenter + 8);
    keyLight.target.position.set(gridCenter, 0, gridCenter);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = initialGfxProfile.shadowMapSize;
    keyLight.shadow.mapSize.height = initialGfxProfile.shadowMapSize;
    keyLight.shadow.intensity = !isSoftwareGl && initialGfxProfile.shadowsEnabled ? 1 : 0;
    renderer.shadowMap.autoUpdate = !isSoftwareGl && initialGfxProfile.shadowsEnabled;
    let shadowBounds = 18;
    keyLight.shadow.camera.left = -shadowBounds;
    keyLight.shadow.camera.right = shadowBounds;
    keyLight.shadow.camera.top = shadowBounds;
    keyLight.shadow.camera.bottom = -shadowBounds;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 75;
    keyLight.shadow.bias = -0.0014;
    keyLight.shadow.normalBias = 0.035;
    scene.add(keyLight);
    scene.add(keyLight.target);

    const rimLight = new THREE.DirectionalLight(0x56cfe1, 0.55);
    rimLight.position.set(-16, 15, -16);
    scene.add(rimLight);

    // Warm sacred bonfire / torch point light at settlement heart + cluster point lights for active cities at night
    const hearthLight = new THREE.PointLight(0xff922b, 2.4, 14, 1.5);
    hearthLight.position.set(gridCenter, 3.0, gridCenter);
    scene.add(hearthLight);

    const cityClusterLights: THREE.PointLight[] = [];
    for (let ci = 0; ci < 4; ci++) {
      const cLight = new THREE.PointLight(0xffa62b, 0, 12, 1.5);
      cLight.position.set(gridCenter, 2.5, gridCenter);
      scene.add(cLight);
      cityClusterLights.push(cLight);
    }

    // Dynamic God Power Flash Light (illuminates terrain & structures during miracle/disaster casts)
    const vfxFlashLight = new THREE.PointLight(0xff922b, 0, 26, 1.2);
    vfxFlashLight.position.set(gridCenter, 6.0, gridCenter);
    scene.add(vfxFlashLight);

    // Groups for terrain, nodes, buildings, units, cursor, and particles
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const terrainGroup = new THREE.Group();
    terrainGroup.renderOrder = 0;
    const nodesGroup = new THREE.Group();
    nodesGroup.renderOrder = 1;
    const buildingsGroup = new THREE.Group();
    const unitsGroup = new THREE.Group();
    const vehiclesGroup = new THREE.Group();
    const wispsGroup = new THREE.Group();
    worldGroup.add(terrainGroup, nodesGroup, buildingsGroup, unitsGroup, vehiclesGroup, wispsGroup);

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

    const zoneOverlay = createZoneOverlaySystem(sim.gridSize);
    zoneOverlay.updateMap(sim.tiles);
    worldGroup.add(zoneOverlay.mesh);

    const skyClouds = createSkyCloudSystem(sim.gridSize);
    worldGroup.add(skyClouds.shadowGroup);
    worldGroup.add(skyClouds.group);

    // Frustum-culled 32x32 hidden-face-culled greedy-meshed terrain chunk system
    // (100% pixel-identical to individual blocks via world-space styledTerrain shaders!)
    const styledTerrain = createStyledTerrainSystem(sim.gridSize);
    styledTerrain.updateMap(sim.tiles, sim.buildings, sim.settlementSpecies);

    const worldBoundsSphere = new THREE.Sphere(
      new THREE.Vector3(gridCenter, 2, gridCenter),
      sim.gridSize * 1.1,
    );

    function ensureInstancedCapacity(
      inst: THREE.InstancedMesh,
      needed: number,
      indexMap?: Map<THREE.InstancedMesh, Int32Array>,
      maxLimit = simRef.current.tiles.length * 2,
    ) {
      const curCap = inst.instanceMatrix.count;
      if (needed <= curCap) return;
      const nextCap = Math.min(maxLimit, Math.max(needed, Math.ceil(curCap * 1.5)));
      const prevArr = inst.instanceMatrix.array as Float32Array;
      const nextArr = new Float32Array(nextCap * 16);
      nextArr.set(prevArr);
      const nextAttr = new THREE.InstancedBufferAttribute(nextArr, 16);
      nextAttr.setUsage(THREE.DynamicDrawUsage);
      inst.instanceMatrix = nextAttr;
      if (indexMap) {
        const prevIdx = indexMap.get(inst);
        if (prevIdx) {
          const nextIdx = new Int32Array(nextCap);
          nextIdx.set(prevIdx);
          indexMap.set(inst, nextIdx);
        }
      }
    }

    const terrainWorkerPool = new EngineWorkerPool();
    const { topMat: chunkTopMat, cliffMat: chunkCliffMat } = styledTerrain.getChunkMaterials();
    const chunkTerrain = new ChunkTerrainSystem(
      sim.gridSize,
      chunkTopMat,
      chunkCliffMat,
      terrainWorkerPool,
      CHUNK_SIZE,
    );
    terrainGroup.add(chunkTerrain.group);

    const tileCurrentY = new Float32Array(sim.tiles.length);
    const tileRenderY = new Float32Array(sim.tiles.length);
    const tilePropSig = new Int32Array(sim.tiles.length);
    const tileLastNodeY = new Float32Array(sim.tiles.length);
    const tileTerrainCode = new Int8Array(sim.tiles.length).fill(-1);
    const tileHadHazard = new Uint8Array(sim.tiles.length);
    for (let i = 0; i < sim.tiles.length; i++) {
      const t = sim.tiles[i];
      const isWaterWalkway =
        t.height === 0 &&
        (t.terrain === 'stone_road' || t.terrain === 'rail_track' || t.terrain === 'runway');
      const isSeaIce = t.height === 0 && t.terrain === 'ice';
      const y0 = t.height === 0 ? (isWaterWalkway ? 0.3 : isSeaIce ? 0.21 : 0.12) : t.height * HEIGHT_STEP + 0.25;
      tileCurrentY[i] = y0;
      tileRenderY[i] = y0;
      tileTerrainCode[i] = TERRAIN_TO_CODE[t.terrain] ?? 3;
      tileLastNodeY[i] = -999;
      tilePropSig[i] = -1;
    }
    const initWorldGrid = ensureWorldGrid(sim);
    chunkTerrain.rebuildAllSync(initWorldGrid, tileRenderY);

    // Instanced Multi-Object Props (1-4 objects per tile, starting compactly and growing on demand)
    const variantLib = getNodeVariantLibrary();


    // 3D Sculpted Micro-Voxel Biome Trees (4-tier zoom LOD greedy-merged static InstancedMeshes)
    const voxelTreeLib = getVoxelTreeLibrary();
    const TREE_BIOME_KEYS: TreeBiomeKey[] = [
      'forest',
      'meadow',
      'jungle',
      'taiga',
      'blossom',
      'savanna',
      'swamp',
      'highland',
    ];
    const BIOME_KEY_TO_IDX: Record<TreeBiomeKey, number> = {
      forest: 0,
      meadow: 1,
      jungle: 2,
      taiga: 3,
      blossom: 4,
      savanna: 5,
      swamp: 6,
      highland: 7,
    };

    // Collapse all 32 live + 32 burnt voxel tree species × 4 LODs (384 InstancedMeshes -> 2 BatchedMeshes!)
    const treeBatchGeos: THREE.BufferGeometry[] = [];
    // Indexed as [charred: 0|1][lod: 0..3][biomeIdx: 0..7][varIdx] -> flat geometry index
    const treeGeoIdx: number[][][][] = [[], []];
    const treeBiomePoolLen: number[][] = [[], []];
    const treeLodRecords = [
      [voxelTreeLib.byBiome, voxelTreeLib.byBiomeLod1, voxelTreeLib.byBiomeLod2, voxelTreeLib.byBiomeLod3],
      [
        voxelTreeLib.burntByBiome,
        voxelTreeLib.burntByBiomeLod1,
        voxelTreeLib.burntByBiomeLod2,
        voxelTreeLib.burntByBiomeLod3,
      ],
    ];
    for (let c = 0; c < 2; c++) {
      for (let lod = 0; lod < 4; lod++) {
        const byBiomeArr: number[][] = [];
        const rec = treeLodRecords[c][lod];
        for (let b = 0; b < TREE_BIOME_KEYS.length; b++) {
          const geos = rec[TREE_BIOME_KEYS[b]];
          if (lod === 0) treeBiomePoolLen[c][b] = geos.length;
          const varIds: number[] = [];
          for (let v = 0; v < geos.length; v++) {
            varIds.push(treeBatchGeos.length);
            treeBatchGeos.push(geos[v]);
          }
          byBiomeArr.push(varIds);
        }
        treeGeoIdx[c].push(byBiomeArr);
      }
    }
    const treeBatchShadow = new BatchedStaticPool(
      'batched_trees_shadow',
      voxelTreeLib.material,
      treeBatchGeos,
      true,
      true,
      512,
    );
    const treeBatchNoShadow = new BatchedStaticPool(
      'batched_trees_noshadow',
      voxelTreeLib.material,
      treeBatchGeos,
      false,
      true,
      512,
    );
    worldGroup.add(treeBatchShadow.group);
    worldGroup.add(treeBatchNoShadow.group);

    // Baked multi-angle pixel-art tree impostor system (2 tris/tree in 1 draw call at overview/far zoom)
    const treeImpostors = new TreeImpostorSystem(renderer, voxelTreeLib, 2048, scene.environment);
    const _impostorTint = new THREE.Color(1, 1, 1);
    const _noonRefColor = new THREE.Color(0xffdfb0);
    worldGroup.add(treeImpostors.mesh);

    // Collapse all 10 resource prop kinds × 2 LODs (~70 InstancedMeshes -> 5 BatchedMeshes!)
    // Buckets: 0=std+shadow, 1=std+noShadow, 2=crystal+shadow, 3=crystal+noShadow, 4=coral+noShadow
    const propBucketGeos: THREE.BufferGeometry[][] = [[], [], [], [], []];
    const propKindSpecs: {
      lod0: THREE.BufferGeometry[];
      lod2: THREE.BufferGeometry[];
      b0: number;
      b2: number;
    }[] = [
      { lod0: variantLib.berry, lod2: variantLib.berryLod2, b0: 0, b2: 1 }, // 0: berry
      { lod0: variantLib.farmCrop, lod2: variantLib.farmCropLod2, b0: 0, b2: 1 }, // 1: farmCrop
      { lod0: variantLib.sciFiFarm, lod2: variantLib.sciFiFarmLod2, b0: 2, b2: 3 }, // 2: sciFiFarm
      { lod0: variantLib.stone, lod2: variantLib.stoneLod2, b0: 0, b2: 1 }, // 3: stone
      { lod0: variantLib.ore, lod2: variantLib.oreLod2, b0: 0, b2: 1 }, // 4: ore
      { lod0: variantLib.crystal, lod2: variantLib.crystalLod2, b0: 2, b2: 2 }, // 5: crystal
      { lod0: variantLib.coralReef, lod2: variantLib.coralReefLod2, b0: 4, b2: 4 }, // 6: coralReef
      { lod0: variantLib.coralReefBleached, lod2: variantLib.coralReefBleachedLod2, b0: 1, b2: 1 }, // 7: coralReefBleached
      { lod0: variantLib.scrapFlotsam, lod2: variantLib.scrapFlotsamLod2, b0: 0, b2: 1 }, // 8: scrapFlotsam
      { lod0: variantLib.atlantisRuin, lod2: variantLib.atlantisRuinLod2, b0: 0, b2: 0 }, // 9: atlantisRuin
    ];
    const propKindLens: number[] = [];
    const propLod0Bucket: number[] = [];
    const propLod2Bucket: number[] = [];
    const propLod0GeoIdx: number[][] = [];
    const propLod2GeoIdx: number[][] = [];
    for (let k = 0; k < propKindSpecs.length; k++) {
      const spec = propKindSpecs[k];
      propKindLens.push(spec.lod0.length);
      propLod0Bucket.push(spec.b0);
      propLod2Bucket.push(spec.b2);
      const ids0: number[] = [];
      for (let v = 0; v < spec.lod0.length; v++) {
        ids0.push(propBucketGeos[spec.b0].length);
        propBucketGeos[spec.b0].push(spec.lod0[v]);
      }
      propLod0GeoIdx.push(ids0);
      const ids2: number[] = [];
      for (let v = 0; v < spec.lod2.length; v++) {
        ids2.push(propBucketGeos[spec.b2].length);
        propBucketGeos[spec.b2].push(spec.lod2[v]);
      }
      propLod2GeoIdx.push(ids2);
    }
    const propBatches: BatchedStaticPool[] = [
      new BatchedStaticPool('batched_props_std_shadow', variantLib.standardMat, propBucketGeos[0], true, true, 512),
      new BatchedStaticPool('batched_props_std_noshadow', variantLib.standardMat, propBucketGeos[1], false, true, 512),
      new BatchedStaticPool('batched_props_crystal_shadow', variantLib.crystalMat, propBucketGeos[2], true, true, 256),
      new BatchedStaticPool('batched_props_crystal_noshadow', variantLib.crystalMat, propBucketGeos[3], false, true, 128),
      new BatchedStaticPool('batched_props_coral_noshadow', variantLib.coralReefMat, propBucketGeos[4], false, true, 256),
    ];
    for (let i = 0; i < propBatches.length; i++) {
      nodesGroup.add(propBatches[i].group);
    }

    // Collapse all 14 ambient biome detail groups (35 InstancedMeshes -> 1 BatchedMesh draw call!)
    const ambSourceLists: THREE.BufferGeometry[][] = [
      variantLib.ambientGrass,
      variantLib.ambientForest,
      variantLib.ambientSand,
      variantLib.ambientRock,
      variantLib.ambientSnow,
      variantLib.ambientSavanna,
      variantLib.ambientSwamp,
      variantLib.ambientHighland,
      variantLib.ambientJungle,
      variantLib.ambientMountain,
      variantLib.ambientTaiga,
      variantLib.ambientTundra,
      variantLib.ambientBadlands,
      variantLib.ambientBlossom,
    ];
    const ambBatchGeos: THREE.BufferGeometry[] = [];
    const ambGeoIdx: number[][] = [];
    const ambGroupLens: number[] = [];
    for (let g = 0; g < ambSourceLists.length; g++) {
      const list = ambSourceLists[g];
      ambGroupLens.push(list.length);
      const ids: number[] = [];
      for (let v = 0; v < list.length; v++) {
        ids.push(ambBatchGeos.length);
        ambBatchGeos.push(list[v]);
      }
      ambGeoIdx.push(ids);
    }
    const ambBatch = new BatchedStaticPool(
      'batched_ambient_details',
      variantLib.standardMat,
      ambBatchGeos,
      false,
      true,
      512,
    );
    worldGroup.add(ambBatch.group);

    // Flat typed placement caches for zero-GC zoom LOD & viewport frustum culling
    let treeCacheCap = 1024;
    let treeCacheCount = 0;
    let treeCacheX = new Float32Array(treeCacheCap);
    let treeCacheZ = new Float32Array(treeCacheCap);
    let treeCacheBiome = new Uint8Array(treeCacheCap);
    let treeCacheVar = new Uint8Array(treeCacheCap);
    let treeCacheFlags = new Uint8Array(treeCacheCap); // bit0=charred, bit1=companion(k>=1), bit2=underSapling(k===2)
    let treeCacheMat = new Float32Array(treeCacheCap * 16);

    let propCacheCap = 512;
    let propCacheCount = 0;
    let propCacheX = new Float32Array(propCacheCap);
    let propCacheZ = new Float32Array(propCacheCap);
    let propCacheKind = new Uint8Array(propCacheCap);
    let propCacheVar = new Uint8Array(propCacheCap);
    let propCacheMat = new Float32Array(propCacheCap * 16);

    let ambCacheCap = 512;
    let ambCacheCount = 0;
    let ambCacheX = new Float32Array(ambCacheCap);
    let ambCacheZ = new Float32Array(ambCacheCap);
    let ambCacheGroup = new Uint8Array(ambCacheCap);
    let ambCacheVar = new Uint8Array(ambCacheCap);
    let ambCacheTier = new Uint8Array(ambCacheCap); // 0=low, 1=med, 2=full
    let ambCacheMat = new Float32Array(ambCacheCap * 16);

    let propViewDirty = true;
    const tileTerrainSig = new Int32Array(sim.tiles.length).fill(-1);
    const tileMetroSig = new Int32Array(sim.tiles.length).fill(-1);

    function applyAmbientFoliageFactor(_factor: number) {
      propViewDirty = true;
    }

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
    const streetPoleMat = new THREE.MeshStandardMaterial({
      color: 0x4a3525,
      roughness: 0.78,
      metalness: 0.15,
    });
    const streetLampGlowMat = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      emissive: 0xff8811,
      emissiveIntensity: 0.35,
      roughness: 0.2,
    });
    const skywayDeckMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.56,
      metalness: 0.35,
    });
    const skywayTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.75,
      roughness: 0.28,
    });
    const billboardCyanMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.15,
      roughness: 0.18,
    });
    const billboardPinkMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 1.2,
      roughness: 0.18,
    });
    const billboardGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 1.1,
      roughness: 0.2,
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
    const streetPoleGeo = new THREE.BoxGeometry(0.042, 1.0, 0.042);
    const streetLampHeadGeo = new THREE.BoxGeometry(0.085, 0.085, 0.085);
    const skywayDeckGeo = new THREE.BoxGeometry(0.46, 0.075, 1.0);
    const skywayTrimGeo = new THREE.BoxGeometry(0.05, 0.045, 1.0);
    const billboardFrameGeo = new THREE.BoxGeometry(0.54, 0.28, 0.05);
    const billboardScreenGeo = new THREE.BoxGeometry(0.48, 0.22, 0.062);

    const INITIAL_METRO_CAP = 64;
    const makeMetroInst = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      _cap: number,
      castShadow: boolean,
    ) => {
      const inst = new THREE.InstancedMesh(geo, mat, INITIAL_METRO_CAP);
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
    const streetPoleInst = makeMetroInst(streetPoleGeo, streetPoleMat, MAX_METRO_INST, false);
    const streetLampHeadInst = makeMetroInst(streetLampHeadGeo, streetLampGlowMat, MAX_METRO_INST, false);
    const skywayDeckInst = makeMetroInst(skywayDeckGeo, skywayDeckMat, MAX_METRO_INST, true);
    const skywayTrimInst = makeMetroInst(skywayTrimGeo, skywayTrimMat, MAX_METRO_STRIP_INST, false);
    const billboardFrameInst = makeMetroInst(billboardFrameGeo, streetPoleMat, MAX_METRO_INST, true);
    const billboardCyanInst = makeMetroInst(billboardScreenGeo, billboardCyanMat, MAX_METRO_INST, false);
    const billboardPinkInst = makeMetroInst(billboardScreenGeo, billboardPinkMat, MAX_METRO_INST, false);
    const billboardGoldInst = makeMetroInst(billboardScreenGeo, billboardGoldMat, MAX_METRO_INST, false);

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
      streetPoleInst,
      streetLampHeadInst,
      skywayDeckInst,
      skywayTrimInst,
      billboardFrameInst,
      billboardCyanInst,
      billboardPinkInst,
      billboardGoldInst,
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
      void_goo: 22,
      ice: 23,
    };
    const NODE_CODE: Record<string, number> = {
      none: 0,
      timber_grove: 1,
      berry_bush: 2,
      stone_outcrop: 3,
      ore_vein: 4,
      crystal_monolith: 5,
      coral_reef: 6,
      scrap_flotsam: 7,
      atlantis_ruin: 8,
    };

    interface BuildingMeshEntry {
      group: THREE.Group;
      epochLevel: number;
      type: string;
      species: string;
      isWaterTile: boolean;
      flickerFlames: THREE.Object3D[];
      spinParts: THREE.Object3D[];
      cachedRotY: number;
      seenStamp: number;
    }
    interface UnitMeshEntry {
      group: THREE.Group;
      epochLevel: number;
      role: string;
      species: string;
      ageStage: string;
      bodyPivot?: THREE.Object3D;
      headPivot?: THREE.Object3D;
      jawPivot?: THREE.Object3D;
      tailPivot?: THREE.Object3D;
      wingL?: THREE.Object3D;
      wingR?: THREE.Object3D;
      wingOuterL?: THREE.Object3D;
      wingOuterR?: THREE.Object3D;
      fireMaw?: THREE.Mesh;
      legFL?: THREE.Object3D;
      legFR?: THREE.Object3D;
      legBL?: THREE.Object3D;
      legBR?: THREE.Object3D;
      kneeFL?: THREE.Object3D;
      kneeFR?: THREE.Object3D;
      kneeBL?: THREE.Object3D;
      kneeBR?: THREE.Object3D;
      legL?: THREE.Object3D;
      legR?: THREE.Object3D;
      contactShadow?: THREE.Object3D;
      contactShadowScale: number;
      heldTool?: THREE.Object3D;
      carryBox?: THREE.Mesh;
      statusRing?: THREE.Mesh;
      battlewillAvatar?: THREE.Object3D;
      battlewillSwordPivot?: THREE.Object3D;
      leviathanSilhouette?: THREE.Object3D;
      leviathanSurfaced?: THREE.Object3D;
      silHead?: THREE.Object3D;
      silSeg0?: THREE.Object3D;
      silSeg1?: THREE.Object3D;
      silSeg2?: THREE.Object3D;
      silTail?: THREE.Object3D;
      silFinL?: THREE.Object3D;
      silFinR?: THREE.Object3D;
      mandibleL?: THREE.Object3D;
      mandibleR?: THREE.Object3D;
      leviathanTailMid?: THREE.Object3D;
      leviathanBeamGroup?: THREE.Object3D;
      beamShaft?: THREE.Object3D;
      beamImpact?: THREE.Object3D;
      beamMuzzle?: THREE.Object3D;
      leviathanSplashInner?: THREE.Object3D;
      leviathanSplashOuter?: THREE.Object3D;
      ufoRing?: THREE.Object3D;
      lastCarryType: string | null;
      lastStatusKey: number;
      shadowCasters: THREE.Mesh[];
      lastUnitCastShadow: boolean;
      seenStamp: number;
    }
    interface VehicleMeshEntry {
      group: THREE.Group;
      epochLevel: number;
      type: VehicleType;
      species: string;
      spinProps: THREE.Object3D[];
      spinRotors: THREE.Object3D[];
      thrusterPlumes: THREE.Object3D[];
      contactShadows: THREE.Object3D[];
      seenStamp: number;
    }

    interface WispMeshEntry {
      group: THREE.Group;
      core: THREE.Mesh;
      halo: THREE.Mesh;
      orbitDot: THREE.Mesh;
      materials: THREE.Material[];
      color: string;
      seenStamp: number;
    }

    const batchedBuildings = new BatchedBuildingSystem();
    buildingsGroup.add(batchedBuildings.group);
    const unitMeshes = new Map<string, UnitMeshEntry>();
    const vehicleMeshes = new Map<string, VehicleMeshEntry>();
    const wispMeshes = new Map<string, WispMeshEntry>();
    const sharedWispCoreGeo = new THREE.OctahedronGeometry(0.3, 0);
    const sharedWispHaloGeo = new THREE.IcosahedronGeometry(0.54, 1);
    const sharedWispOrbitGeo = new THREE.OctahedronGeometry(0.13, 0);

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

    // Hover / Tool Brush Pixelated Circle Reticle
    const reticleGroup = new THREE.Group();
    const reticleRingGeo = new THREE.PlaneGeometry(1, 1);
    reticleRingGeo.rotateX(-Math.PI / 2);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0xf5b742,
      map: getPixelReticleTexture(0),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    let lastReticleTileRadius = 0;
    const reticleMesh = new THREE.Mesh(reticleRingGeo, reticleMat);
    reticleMesh.position.y = 0.04;
    reticleMesh.renderOrder = 5;
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
      outerRing.renderOrder = 5;
      const innerRing = new THREE.Mesh(innerGeo, ringMat);
      innerRing.position.y = 0.06;
      innerRing.renderOrder = 5;
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
        post.renderOrder = 5;
        ringRoot.add(post);
      }

      const pointer = new THREE.Mesh(pointerGeo, bracketMat);
      pointer.position.set(0, 1.85, 0);
      pointer.renderOrder = 5;

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
    const dragHighlightRig = createEntityHighlightRig(0x00f5d4);

    const dragTargetReticleGeo = new THREE.RingGeometry(0.28, 0.44, 16);
    dragTargetReticleGeo.rotateX(-Math.PI / 2);
    const dragTargetReticleMat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const dragTargetReticle = new THREE.Mesh(dragTargetReticleGeo, dragTargetReticleMat);
    dragTargetReticle.visible = false;
    dragTargetReticle.renderOrder = 5;
    worldGroup.add(dragTargetReticle);

    const dragTetherGeo = new THREE.BufferGeometry();
    const dragTetherPositions = new Float32Array(6);
    dragTetherGeo.setAttribute('position', new THREE.BufferAttribute(dragTetherPositions, 3));
    const dragTetherMat = new THREE.LineBasicMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.75,
    });
    const dragTetherLine = new THREE.Line(dragTetherGeo, dragTetherMat);
    dragTetherLine.visible = false;
    dragTetherLine.renderOrder = 5;
    worldGroup.add(dragTetherLine);

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

    // Single InstancedMesh for ALL unit contact shadows (collapses 100-500+ shadow disc draw calls into 1!)
    const unitShadowGeo = new THREE.CircleGeometry(0.38, 12);
    unitShadowGeo.rotateX(-Math.PI / 2);
    const unitShadowMat = new THREE.MeshBasicMaterial({
      color: 0x090d14,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    const unitContactShadowsInst = new THREE.InstancedMesh(unitShadowGeo, unitShadowMat, 512);
    unitContactShadowsInst.count = 0;
    unitContactShadowsInst.visible = false;
    unitContactShadowsInst.frustumCulled = false;
    unitContactShadowsInst.renderOrder = 1;
    worldGroup.add(unitContactShadowsInst);

    // Zero-GC Pooled Particle System (InstancedMesh)
    const particleGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleInstanced = new THREE.InstancedMesh(particleGeo, particleMat, MAX_PARTICLES);
    particleInstanced.frustumCulled = false;
    particleInstanced.count = 0;
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
    let activeParticleCount = 0;
    let particleOverwriteCursor = 0;

    let activeGfxProfile: ResolvedGraphicsProfile = { ...initialGfxProfile };
    const autoOptimizer = new AutoOptimizer();
    const FIXED_SIM_DT = 1 / 15;
    let simAccumulator = 0;
    let simInterpAlpha = 1;
    let lastSimTickMs = 0;
    let perfHudAccum = 0;
    let perfFrameCount = 0;
    const worldCullBounds: WorldCullBounds = {
      minX: -12,
      maxX: sim.gridSize + 12,
      minZ: -12,
      maxZ: sim.gridSize + 12,
    };
    let visibleUnitCountLastFrame = 0;
    let autoOptDecisions: AutoOptimizerDecisions = {
      tier: 0,
      shadowUpdateStride: 1,
      unitCastShadows: true,
      crowdAnimStride: 1,
      particleScale: 1,
      pixelScaleMult: 1,
      maxSimDt: 0.12,
      isZoomedOut: false,
    };

    const allocParticleSlot = (): PooledParticle => {
      if (activeParticleCount < MAX_PARTICLES) {
        return particles[activeParticleCount++];
      }
      const p = particles[particleOverwriteCursor];
      particleOverwriteCursor = (particleOverwriteCursor + 1) % MAX_PARTICLES;
      return p;
    };

    const getScaledParticleCount = (rawCount: number): number => {
      const scale = activeGfxProfile.particleScale * autoOptDecisions.particleScale;
      if (scale >= 0.99) return rawCount;
      if (activeParticleCount > MAX_PARTICLES * 0.85 && scale < 0.5) return 0;
      return Math.max(1, Math.round(rawCount * scale));
    };

    const _burstBaseCol = new THREE.Color();
    const _burstHotCol = new THREE.Color();
    const _burstDeepCol = new THREE.Color();
    const _whiteColorConst = new THREE.Color(0xffffff);

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
      if (!isPointInCullBounds(x, z, worldCullBounds, 6.0)) return;
      const n = getScaledParticleCount(count);
      if (n <= 0) return;
      _burstBaseCol.set(hexColor);
      for (let i = 0; i < n; i++) {
        const p = allocParticleSlot();
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
        p.color.copy(_burstBaseCol).offsetHSL((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.22);
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
      if (!isPointInCullBounds(x, z, worldCullBounds, 6.0 + radius)) return;
      const n = getScaledParticleCount(count);
      if (n <= 0) return;
      _burstBaseCol.set(hexColor);
      for (let i = 0; i < n; i++) {
        const p = allocParticleSlot();
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
        p.color.copy(_burstBaseCol).offsetHSL((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.2);
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
      if (
        !isPointInCullBounds(ox, oz, worldCullBounds, 6.0) &&
        !isPointInCullBounds(tx, tz, worldCullBounds, 6.0)
      ) {
        return;
      }
      const n = getScaledParticleCount(count);
      if (n <= 0) return;
      _burstBaseCol.set(hexColor);
      _burstHotCol.copy(_burstBaseCol).lerp(_whiteColorConst, 0.52);
      _burstDeepCol.copy(_burstBaseCol).multiplyScalar(0.76);
      const dx = tx - ox;
      const dy = ty - oy;
      const dz = tz - oz;
      const len = Math.max(0.3, Math.hypot(dx, dy, dz));
      const speedBase = Math.max(5.5, len * 2.6);
      const travelSec = Math.min(0.62, len / speedBase);
      for (let i = 0; i < n; i++) {
        const p = allocParticleSlot();
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
          p.color.copy(_burstHotCol);
        } else if (roll < 0.48) {
          p.color.copy(_burstDeepCol);
        } else {
          p.color.copy(_burstBaseCol).offsetHSL((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.12);
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
      if (!isPointInCullBounds(cx, cz, worldCullBounds, 6.0 + outerRadius)) return;
      const n = getScaledParticleCount(count);
      if (n <= 0) return;
      _burstBaseCol.set(hexColor);
      for (let i = 0; i < n; i++) {
        const p = allocParticleSlot();
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
        p.color.copy(_burstBaseCol).offsetHSL((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.2);
      }
    }

    // Active Tile Fire Flames & Smoke Plumes (Zero-GC Instanced Billboarded Animated Pixel-Art Sprites)
    const MAX_FIRE_TILES = 320;
    const MAX_FIRE_SPRITES = MAX_FIRE_TILES * 5;
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
    fireSpriteInst.renderOrder = 6;
    fireSmokeInst.renderOrder = 7;
    fireSpriteInst.count = 0;
    fireSmokeInst.count = 0;
    worldGroup.add(fireSpriteInst, fireSmokeInst);

    // Surface Y & render-order helpers so VFX, magic circles, reticles, and attacks stay cleanly above water waves
    const WATER_SURFACE_EFFECT_Y = 0.36;
    const getTileEffectSurfaceY = (tile: { height: number } | undefined, fallbackY = 0.5): number => {
      if (!tile) return Math.max(WATER_SURFACE_EFFECT_Y, fallbackY);
      if (tile.height <= 0) return WATER_SURFACE_EFFECT_Y;
      return tile.height * HEIGHT_STEP + 0.25;
    };
    const setSubtreeRenderOrder = (root: THREE.Object3D, order: number): void => {
      root.renderOrder = order;
      const children = root.children;
      for (let i = 0; i < children.length; i++) {
        setSubtreeRenderOrder(children[i], order);
      }
    };

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
    const sharedMagicCircleGeo = createMagicCirclePlaneGeometry();
    let magicCircleSeedCounter = 1;
    function createMagicCircleMat(
      powerOrTool: string,
      opacity = 0.94,
      seedOffset = 0,
    ): THREE.MeshBasicMaterial {
      const theme = getMagicCircleThemeForPower(powerOrTool);
      const tex = getMagicCircleTexture(theme, magicCircleSeedCounter++ + seedOffset);
      return new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.NormalBlending,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
    }
    const sharedRiftTorusGeo = new THREE.TorusGeometry(1.65, 0.22, 8, 24);
    const sharedRiftCoreGeo = new THREE.SphereGeometry(0.95, 16, 12);
    const sharedWaveBaseGeo = new THREE.BoxGeometry(1.12, 0.72, 1.45);
    const sharedWaveFaceGeo = new THREE.BoxGeometry(1.12, 1.48, 0.92);
    const sharedWaveLipGeo = new THREE.BoxGeometry(1.16, 0.62, 1.05);
    const sharedWaveFoamGeo = new THREE.BoxGeometry(1.22, 0.44, 0.68);
    // Pre-baked local-offset wave geometries so all 68 tsunami segments render in 4 InstancedMeshes (340 -> 4 draw calls!)
    const sharedWaveBaseBakedGeo = sharedWaveBaseGeo.clone();
    sharedWaveBaseBakedGeo.translate(0, 0.36, -0.38);
    const sharedWaveFaceBakedGeo = sharedWaveFaceGeo.clone();
    sharedWaveFaceBakedGeo.translate(0, 0.74, 0.12);
    const sharedWaveLipBakedGeo = sharedWaveLipGeo.clone();
    sharedWaveLipBakedGeo.rotateX(0.46);
    sharedWaveLipBakedGeo.translate(0, 1.42, 0.56);
    const sharedWaveFoamBakedGeo = (() => {
      const top = sharedWaveFoamGeo.clone();
      top.rotateX(0.3);
      top.translate(0, 1.56, 0.88);
      const toe = sharedWaveFoamGeo.clone();
      toe.scale(1.06, 0.68, 0.85);
      toe.translate(0, 0.22, 0.96);
      const merged = mergeGeometries([top, toe], false);
      top.dispose();
      toe.dispose();
      return merged;
    })();
    const sharedFaultCrackGeo = new THREE.BoxGeometry(1, 0.14, 1);
    const sharedTornadoRingGeo = new THREE.BoxGeometry(1.35, 0.24, 1.35);
    const sharedTornadoFunnelGeo = new THREE.CylinderGeometry(1.95, 0.28, 5.8, 24, 16, true);
    sharedTornadoFunnelGeo.translate(0, 2.9, 0);
    const sharedTornadoCapGeo = new THREE.BoxGeometry(2.6, 0.75, 2.6);
    const sharedDebrisCubeGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    const sharedWhirlpoolDiskGeo = new THREE.PlaneGeometry(2.0, 2.0, 1, 1);
    sharedWhirlpoolDiskGeo.rotateX(-Math.PI / 2);
    const sharedWhirlpoolFunnelGeo = new THREE.CylinderGeometry(0.92, 0.14, 0.26, 28, 1, true);

    interface TsunamiWaveSegment {
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

    interface OrbitingDebris {
      mesh: THREE.Mesh;
      angle: number;
      dist: number;
      height: number;
      speed: number;
      tilt: number;
    }

    interface HazardVisual {
      kind:
        | 'rain_cloud'
        | 'plague_cloud'
        | 'shield_dome'
        | 'wormhole_rift'
        | 'tornado_vortex'
        | 'tsunami_wave'
        | 'earthquake_zone'
        | 'whirlpool'
        | 'rogue_wave'
        | 'volcano_eruption'
        | 'undead_portal'
        | 'alien_mothership'
        | 'chrono_field'
        | 'orbital_beam'
        | 'gravity_anomaly';
      isSuper?: boolean;
      group: THREE.Group;
      materials: THREE.Material[];
      geometries?: THREE.BufferGeometry[];
      dropsInst?: THREE.InstancedMesh;
      drops?: { offsetY: number; speed: number; baseX: number; baseZ: number }[];
      spores?: { mesh: THREE.Mesh; angle: number; dist: number; phase: number; height: number }[];
      waveInsts?: THREE.InstancedMesh[];
      waveSegments?: TsunamiWaveSegment[];
      gravityRings?: THREE.Mesh[];
      vortexMotes?: VortexMote[];
      tornadoRings?: THREE.Mesh[];
      debrisChunks?: OrbitingDebris[];
      ringMesh?: THREE.Mesh;
      secondaryRingMesh?: THREE.Mesh;
      waveWallMesh?: THREE.Mesh;
      cloudBody?: THREE.Group;
      currentY?: number;
      crackMeshes?: THREE.Mesh[];
      faultSegments?: EarthquakeFaultSegment[];
      seenStamp: number;
    }
    const hazardMeshes = new Map<string, HazardVisual>();
    function disposeHazardVisual(hv: HazardVisual) {
      hazardsGroup.remove(hv.group);
      if (hv.dropsInst) hv.dropsInst.dispose();
      if (hv.waveInsts) {
        for (const inst of hv.waveInsts) inst.dispose();
      }
      if (hv.geometries) {
        for (const g of hv.geometries) g.dispose();
      }
      for (const m of hv.materials) m.dispose();
    }

    function createHazardVisual(
      kind: HazardVisual['kind'],
      radius: number,
      faultSegments?: EarthquakeFaultSegment[],
      originX = 0,
      originZ = 0,
      isSuper = false,
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

        const dropCount = 40;
        const dropsInst = new THREE.InstancedMesh(sharedRainDropGeo, dropMat, dropCount);
        dropsInst.frustumCulled = false;
        group.add(dropsInst);
        const drops: { offsetY: number; speed: number; baseX: number; baseZ: number }[] = [];
        for (let i = 0; i < dropCount; i++) {
          const a = (i / dropCount) * Math.PI * 2 + (i % 5) * 0.35;
          const r = (0.15 + ((i * 29) % 100) / 100) * radius * 0.82;
          const bx = Math.cos(a) * r;
          const bz = Math.sin(a) * r;
          drops.push({
            offsetY: (i * 0.19) % 4.4,
            speed: 7.5 + (i % 4) * 1.4,
            baseX: bx,
            baseZ: bz,
          });
        }
        return { kind, group, materials, dropsInst, drops, ringMesh, cloudBody, seenStamp: 0 };
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
        const ringMat = createMagicCircleMat('plague_miasma', 0.84);
        materials.push(sporeMat, darkSporeMat, ringMat);
        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, ringMat);
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
        return { kind, group, materials, spores, ringMesh, seenStamp: 0 };
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
        const ringMat = createMagicCircleMat('divine_shield', 0.95);
        materials.push(domeMat, wireMat, ringMat);

        const dome = new THREE.Mesh(sharedDomeCylinderGeo, domeMat);
        dome.scale.set(radius, 1.15, radius);
        group.add(dome);

        const geoShell = new THREE.Mesh(sharedDomeGeo, wireMat);
        geoShell.scale.set(radius * 0.98, radius * 0.65, radius * 0.98);
        geoShell.position.y = 0.4;
        group.add(geoShell);

        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, ringMat);
        ringMesh.position.y = 0.08;
        ringMesh.scale.setScalar(radius * 1.02);
        group.add(ringMesh);
        return { kind, group, materials, ringMesh, secondaryRingMesh: geoShell, seenStamp: 0 };
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

        const totalSegs = 40 + 28;
        const baseInst = new THREE.InstancedMesh(sharedWaveBaseBakedGeo, deepSwellMat, totalSegs);
        const faceInst = new THREE.InstancedMesh(sharedWaveFaceBakedGeo, waveWallMat, totalSegs);
        const lipInst = new THREE.InstancedMesh(sharedWaveLipBakedGeo, waveLipMat, totalSegs);
        const foamInst = new THREE.InstancedMesh(sharedWaveFoamBakedGeo, crestFoamMat, totalSegs);
        const waveInsts = [baseInst, faceInst, lipInst, foamInst];
        for (const inst of waveInsts) {
          inst.frustumCulled = false;
          inst.count = 0;
          group.add(inst);
        }

        const waveSegments: TsunamiWaveSegment[] = [];
        const buildWaveRing = (count: number, isWake: boolean) => {
          for (let i = 0; i < count; i++) {
            waveSegments.push({
              angle: (i / count) * Math.PI * 2,
              isWake,
              phase: i * 0.65 + (isWake ? 1.9 : 0),
            });
          }
        };

        // Primary towering tsunami wave crest (40 segments) + secondary trailing wave swell (28 segments)
        buildWaveRing(40, false);
        buildWaveRing(28, true);

        return { kind, group, materials, waveInsts, waveSegments, seenStamp: 0 };
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
          seenStamp: 0,
        };
      }

      if (kind === 'tornado_vortex') {
        // Whirlpool-style quantized pixel-art logarithmic spiral ground vortex + 3D pixel-shader helical wind funnel + blocky voxel debris
        const groundVortexShaderMat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: 0.94 },
            uIsSuper: { value: isSuper ? 1.0 : 0.0 },
          },
          vertexShader: /* glsl */ `
            varying vec2 vUvCentered;
            void main() {
              vUvCentered = uv * 2.0 - 1.0;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: /* glsl */ `
            uniform float uTime;
            uniform float uOpacity;
            uniform float uIsSuper;
            varying vec2 vUvCentered;

            void main() {
              // Crisp pixel-art quantization matching the whirlpool shader style
              vec2 p = floor(vUvCentered * 22.0 + 0.5) / 22.0;
              float r = length(p);
              if (r > 1.0) discard;

              float theta = atan(p.y, p.x);
              float logR = log(max(0.065, r));
              float spiral1 = theta * 3.0 + logR * 8.2 - uTime * 8.4;
              float spiral2 = theta * 2.0 + logR * 6.5 - uTime * 6.4 + 1.57;

              float armPrimary = smoothstep(0.16, 0.78, sin(spiral1));
              float armSecondary = smoothstep(0.34, 0.88, sin(spiral2));
              float gustCrest = step(0.62, sin(spiral1 + 0.3)) * smoothstep(0.14, 0.30, r) * (1.0 - smoothstep(0.76, 0.96, r));
              float innerEyeWall = smoothstep(0.15, 0.23, r) * (1.0 - smoothstep(0.23, 0.33, r)) * step(0.12, sin(theta * 5.0 - uTime * 10.5));

              vec3 eyeDark = mix(vec3(0.10, 0.14, 0.22), vec3(0.09, 0.04, 0.22), uIsSuper);
              vec3 midSlate = mix(vec3(0.32, 0.42, 0.56), vec3(0.36, 0.16, 0.68), uIsSuper);
              vec3 windSilver = mix(vec3(0.64, 0.76, 0.89), vec3(0.48, 0.38, 0.96), uIsSuper);
              vec3 windCyan = mix(vec3(0.84, 0.93, 0.98), vec3(0.22, 0.82, 0.98), uIsSuper);
              vec3 crestWhite = mix(vec3(0.96, 0.99, 1.0), vec3(0.92, 0.85, 1.0), uIsSuper);

              float throatMask = 1.0 - smoothstep(0.07, 0.25, r);
              vec3 col = mix(midSlate, windSilver, armPrimary * 0.85);
              col = mix(col, windCyan, armSecondary * 0.68);
              col = mix(col, crestWhite, clamp(gustCrest + innerEyeWall * 0.85, 0.0, 1.0));
              col = mix(col, eyeDark, throatMask);

              float outerFade = 1.0 - smoothstep(0.74, 1.0, r);
              float alpha = clamp((0.78 + gustCrest * 0.2 + throatMask * 0.16) * outerFade * uOpacity, 0.0, 0.96);
              if (alpha < 0.05) discard;
              gl_FragColor = vec4(col, alpha);
            }
          `,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        });

        const funnelWallShaderMat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: 0.92 },
            uIsSuper: { value: isSuper ? 1.0 : 0.0 },
          },
          vertexShader: /* glsl */ `
            uniform float uTime;
            varying vec2 vUv;
            void main() {
              vUv = uv;
              vec3 pos = position;
              float hFrac = clamp(uv.y, 0.0, 1.0);
              // Sinuous cyclone bend & helical breathing along the vertical funnel column
              pos.x += sin(uTime * 6.2 - hFrac * 4.2) * (0.14 + hFrac * 0.55);
              pos.z += cos(uTime * 5.5 - hFrac * 4.2) * (0.14 + hFrac * 0.55);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
          `,
          fragmentShader: /* glsl */ `
            uniform float uTime;
            uniform float uOpacity;
            uniform float uIsSuper;
            varying vec2 vUv;

            void main() {
              // Quantize UV into crisp pixel-art vortex bands around and up the 3D cone
              vec2 qUv = vec2(floor(vUv.x * 32.0) / 32.0, floor(vUv.y * 24.0) / 24.0);
              float theta = qUv.x * 6.2831853;
              float h = qUv.y;

              float helix1 = sin(theta * 3.0 + h * 15.0 - uTime * 10.5);
              float helix2 = sin(theta * 2.0 - h * 11.0 - uTime * 7.8 + 1.2);
              float bandPrimary = step(0.15, helix1);
              float bandSecondary = step(0.45, helix2);
              float streakCrest = step(0.76, sin(theta * 4.0 + h * 18.0 - uTime * 12.0));

              vec3 baseCol = mix(vec3(0.28, 0.37, 0.49), vec3(0.26, 0.11, 0.52), uIsSuper);
              vec3 midCol = mix(vec3(0.58, 0.70, 0.84), vec3(0.48, 0.28, 0.88), uIsSuper);
              vec3 hiCol = mix(vec3(0.86, 0.94, 0.99), vec3(0.24, 0.84, 0.98), uIsSuper);
              vec3 crestCol = vec3(0.97, 0.99, 1.0);

              vec3 col = mix(baseCol, midCol, bandPrimary * 0.82);
              col = mix(col, hiCol, bandSecondary * 0.72);
              col = mix(col, crestCol, streakCrest * 0.85);

              float verticalEdge = smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.88, 1.0, h));
              float alpha = (0.58 + bandPrimary * 0.24 + streakCrest * 0.16) * verticalEdge * uOpacity;
              if (alpha < 0.06) discard;
              gl_FragColor = vec4(col, alpha);
            }
          `,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        });

        const funnelOuterMat = new THREE.MeshBasicMaterial({
          color: isSuper ? 0x7c3aed : 0x94a3b8,
          transparent: true,
          opacity: isSuper ? 0.82 : 0.76,
        });
        const funnelCoreMat = new THREE.MeshBasicMaterial({
          color: isSuper ? 0x38bdf8 : 0xe2e8f0,
          transparent: true,
          opacity: isSuper ? 0.9 : 0.86,
        });
        const stormCapMat = new THREE.MeshStandardMaterial({
          color: isSuper ? 0x1e1b4b : 0x334155,
          roughness: 0.9,
          transparent: true,
          opacity: 0.95,
        });
        const debrisWoodMat = new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 0.85 });
        const debrisLeafMat = new THREE.MeshStandardMaterial({ color: isSuper ? 0x38bdf8 : 0x4f772d, roughness: 0.8 });
        materials.push(
          groundVortexShaderMat,
          funnelWallShaderMat,
          funnelOuterMat,
          funnelCoreMat,
          stormCapMat,
          debrisWoodMat,
          debrisLeafMat,
        );

        // 1. Whirlpool-style quantized pixel-art ground vortex disk
        const ringMesh = new THREE.Mesh(sharedWhirlpoolDiskGeo, groundVortexShaderMat);
        ringMesh.position.y = 0.09;
        ringMesh.scale.setScalar(radius * (isSuper ? 1.15 : 0.98));
        group.add(ringMesh);

        // 2. 3D Conical Pixel-Shader Helical Wind Funnel
        const maxH = isSuper ? 7.6 : 5.8;
        const funnelCone = new THREE.Mesh(sharedTornadoFunnelGeo, funnelWallShaderMat);
        funnelCone.position.y = 0.08;
        funnelCone.scale.set(isSuper ? 1.45 : 1.05, maxH / 5.8, isSuper ? 1.45 : 1.05);
        group.add(funnelCone);

        // 3. Stepped Blocky Voxel Wind-Collar Cubes orbiting up the funnel
        const tornadoRings: THREE.Mesh[] = [];
        const tierCount = isSuper ? 10 : 8;
        for (let ti = 0; ti < tierCount; ti++) {
          const frac = ti / (tierCount - 1);
          const ringScale = (isSuper ? 0.55 : 0.42) + Math.pow(frac, 1.25) * (isSuper ? 2.45 : 1.85);
          const rMesh = new THREE.Mesh(sharedTornadoRingGeo, ti % 2 === 0 ? funnelCoreMat : funnelOuterMat);
          rMesh.position.y = 0.35 + frac * maxH;
          rMesh.scale.set(ringScale, 0.65 + frac * 0.45, ringScale);
          group.add(rMesh);
          tornadoRings.push(rMesh);
        }

        // 4. Multi-block Voxel Storm-Cloud Anvil Crown
        const cloudBody = new THREE.Group();
        const anvilBlocks = [
          { x: 0, y: maxH + 0.55, z: 0, sx: isSuper ? 2.1 : 1.6, sy: 1.1, sz: isSuper ? 2.0 : 1.5 },
          { x: 0.95, y: maxH + 0.9, z: -0.65, sx: isSuper ? 1.5 : 1.15, sy: 0.9, sz: isSuper ? 1.5 : 1.15 },
          { x: -0.9, y: maxH + 0.82, z: 0.6, sx: isSuper ? 1.45 : 1.1, sy: 0.85, sz: isSuper ? 1.4 : 1.05 },
        ];
        for (const ab of anvilBlocks) {
          const cap = new THREE.Mesh(sharedTornadoCapGeo, stormCapMat);
          cap.position.set(ab.x, ab.y, ab.z);
          cap.scale.set(ab.sx, ab.sy, ab.sz);
          cloudBody.add(cap);
        }
        group.add(cloudBody);

        // 5. Orbiting Blocky Voxel Debris Chunks sucked around the funnel
        const debrisChunks: OrbitingDebris[] = [];
        const debrisCount = isSuper ? 24 : 16;
        for (let di = 0; di < debrisCount; di++) {
          const frac = di / debrisCount;
          const dMesh = new THREE.Mesh(sharedDebrisCubeGeo, di % 2 === 0 ? debrisLeafMat : debrisWoodMat);
          dMesh.scale.setScalar((isSuper ? 0.88 : 0.7) + (di % 3) * 0.25);
          group.add(dMesh);
          debrisChunks.push({
            mesh: dMesh,
            angle: (di / debrisCount) * Math.PI * 2,
            dist: (isSuper ? 0.85 : 0.65) + frac * (isSuper ? 2.8 : 2.05),
            height: 0.35 + frac * (maxH - 0.4),
            speed: (isSuper ? 7.6 : 5.8) + (1 - frac) * 4.8,
            tilt: (di % 5) * 0.4,
          });
        }

        return {
          kind,
          isSuper,
          group,
          materials,
          ringMesh,
          secondaryRingMesh: funnelCone,
          tornadoRings,
          cloudBody,
          debrisChunks,
          seenStamp: 0,
        };
      }

      if (kind === 'wormhole_rift') {
        // wormhole_rift — horizontal top-facing runic event horizon magic circles + contracting gravity-well magic circles
        const ringMat = createMagicCircleMat('wormhole_ascension', 0.95, 0);
        const cyanRingMat = createMagicCircleMat('wormhole_ascension', 0.9, 2);
        const coreMat = new THREE.MeshBasicMaterial({
          color: 0x070012,
        });
        const gravRingMat1 = createMagicCircleMat('wormhole_ascension', 0.78, 3);
        const gravRingMat2 = createMagicCircleMat('wormhole_ascension', 0.78, 4);
        const gravRingMat3 = createMagicCircleMat('wormhole_ascension', 0.78, 5);
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

        const torus1 = new THREE.Mesh(sharedMagicCircleGeo, ringMat);
        torus1.position.y = 1.8;
        torus1.scale.setScalar(1.35);
        group.add(torus1);

        const torus2 = new THREE.Mesh(sharedMagicCircleGeo, cyanRingMat);
        torus2.position.y = 0.16;
        torus2.scale.setScalar(Math.max(1.2, radius * 0.85));
        group.add(torus2);

        const core = new THREE.Mesh(sharedRiftCoreGeo, coreMat);
        core.position.y = 1.8;
        core.scale.setScalar(1.08);
        group.add(core);

        // 3 Concentric Gravity-Well Magic Circles that continuously contract inward from the outer pull radius into the core
        const gravMats = [gravRingMat1, gravRingMat2, gravRingMat3];
        const gravityRings: THREE.Mesh[] = [];
        for (let i = 0; i < 3; i++) {
          const gRing = new THREE.Mesh(sharedMagicCircleGeo, gravMats[i]);
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

        // 16 Orbiting Terrain Chunks ripped from the ground around the black hole
        const earthGrassMat = new THREE.MeshStandardMaterial({ color: 0x588157, roughness: 0.85 });
        const earthSoilMat = new THREE.MeshStandardMaterial({ color: 0x6c4e38, roughness: 0.9 });
        const earthRockMat = new THREE.MeshStandardMaterial({ color: 0x6c757d, roughness: 0.8 });
        const earthCrystalMat = new THREE.MeshBasicMaterial({ color: 0xc77dff });
        materials.push(earthGrassMat, earthSoilMat, earthRockMat, earthCrystalMat);
        const chunkMats = [earthGrassMat, earthSoilMat, earthRockMat, earthCrystalMat];
        const debrisChunks: OrbitingDebris[] = [];
        for (let ci = 0; ci < 16; ci++) {
          const cMesh = new THREE.Mesh(sharedDebrisCubeGeo, chunkMats[ci % chunkMats.length]);
          const s = 0.72 + (ci % 4) * 0.22;
          cMesh.scale.set(s * 1.15, s * 0.85, s);
          group.add(cMesh);
          debrisChunks.push({
            mesh: cMesh,
            angle: (ci / 16) * Math.PI * 2,
            dist: (0.28 + (ci % 5) * 0.16) * radius,
            height: 0.5 + (ci % 4) * 0.65,
            speed: 2.8 + (4 - (ci % 4)) * 0.95,
            tilt: ci * 0.55,
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
          debrisChunks,
          seenStamp: 0,
        };
      }

      if (kind === 'whirlpool') {
        const vortexFunnelShaderMat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: 0.96 },
          },
          vertexShader: /* glsl */ `
            varying vec2 vUvCentered;
            void main() {
              vUvCentered = uv * 2.0 - 1.0;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: /* glsl */ `
            uniform float uTime;
            uniform float uOpacity;
            varying vec2 vUvCentered;

            void main() {
              // Crisp pixel-art quantization matching the isometric ocean grid
              vec2 p = floor(vUvCentered * 22.0 + 0.5) / 22.0;
              float r = length(p);
              if (r > 1.0) discard;

              float theta = atan(p.y, p.x);
              // Logarithmic spiral arms pulling inward toward the abyssal throat
              float logR = log(max(0.065, r));
              float spiral1 = theta * 3.0 + logR * 7.8 - uTime * 6.8;
              float spiral2 = theta * 2.0 + logR * 6.2 - uTime * 5.2 + 1.57;

              float armPrimary = smoothstep(0.18, 0.78, sin(spiral1));
              float armSecondary = smoothstep(0.38, 0.88, sin(spiral2));
              float foamCrest = step(0.66, sin(spiral1 + 0.25)) * smoothstep(0.16, 0.32, r) * (1.0 - smoothstep(0.78, 0.96, r));
              float innerSuctionFoam = smoothstep(0.17, 0.24, r) * (1.0 - smoothstep(0.24, 0.33, r)) * step(0.15, sin(theta * 5.0 - uTime * 9.0));

              vec3 abyssCol = vec3(0.008, 0.028, 0.065);
              vec3 trenchCol = vec3(0.016, 0.13, 0.24);
              vec3 swirlTeal = vec3(0.04, 0.58, 0.74);
              vec3 swirlCyan = vec3(0.32, 0.86, 0.94);
              vec3 foamWhite = vec3(0.90, 0.99, 1.0);

              // Deep funnel gradient from outer rim into the black maelstrom eye
              float throatMask = 1.0 - smoothstep(0.08, 0.27, r);
              vec3 col = mix(trenchCol, swirlTeal, armPrimary * 0.82);
              col = mix(col, swirlCyan, armSecondary * 0.65);
              col = mix(col, foamWhite, clamp(foamCrest + innerSuctionFoam * 0.85, 0.0, 1.0));
              col = mix(col, abyssCol, throatMask);

              float outerFade = 1.0 - smoothstep(0.76, 1.0, r);
              float alpha = clamp((0.82 + foamCrest * 0.18 + throatMask * 0.18) * outerFade * uOpacity, 0.0, 0.98);
              if (alpha < 0.05) discard;
              gl_FragColor = vec4(col, alpha);
            }
          `,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        });

        const funnelWallMat = new THREE.MeshBasicMaterial({
          color: 0x04243c,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const swirlOuterMat = new THREE.MeshBasicMaterial({
          color: 0x22d3ee,
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
        });
        const swirlFoamMat = new THREE.MeshBasicMaterial({
          color: 0xe0fbfc,
          transparent: true,
          opacity: 0.94,
          depthWrite: false,
        });
        materials.push(vortexFunnelShaderMat, funnelWallMat, swirlOuterMat, swirlFoamMat);

        const vortexDisk = new THREE.Mesh(sharedWhirlpoolDiskGeo, vortexFunnelShaderMat);
        vortexDisk.position.y = 0.055;
        vortexDisk.scale.setScalar(radius * 1.08);
        group.add(vortexDisk);

        const funnelCone = new THREE.Mesh(sharedWhirlpoolFunnelGeo, funnelWallMat);
        funnelCone.position.y = -0.04;
        funnelCone.scale.set(radius * 0.88, 1.0, radius * 0.88);
        group.add(funnelCone);

        const vortexMotes: VortexMote[] = [];
        for (let i = 0; i < 20; i++) {
          const m = new THREE.Mesh(sharedDebrisCubeGeo, i % 3 === 0 ? swirlOuterMat : swirlFoamMat);
          m.scale.set(0.36, 0.18, 0.22);
          group.add(m);
          vortexMotes.push({
            mesh: m,
            baseAngle: (i / 20) * Math.PI * 2,
            phase: (i / 20) + (i % 5) * 0.07,
            speed: 0.75 + (i % 4) * 0.18,
          });
        }

        return {
          kind,
          group,
          materials,
          ringMesh: vortexDisk,
          secondaryRingMesh: funnelCone,
          vortexMotes,
          seenStamp: 0,
        };
      }

      if (kind === 'rogue_wave') {
        const deepSwellMat = new THREE.MeshStandardMaterial({
          color: 0x023e8a,
          roughness: 0.38,
          transparent: true,
          opacity: 0.9,
        });
        const waveWallMat = new THREE.MeshStandardMaterial({
          color: 0x0077b6,
          emissive: 0x005082,
          emissiveIntensity: 0.32,
          roughness: 0.32,
          transparent: true,
          opacity: 0.94,
        });
        const crestFoamMat = new THREE.MeshBasicMaterial({
          color: 0xe0fbfc,
          transparent: true,
          opacity: 0.98,
        });
        materials.push(deepSwellMat, waveWallMat, crestFoamMat);

        const wallGroup = new THREE.Group();
        const spanCount = Math.max(5, Math.round(radius * 2.2));
        for (let si = 0; si < spanCount; si++) {
          const u = (si / (spanCount - 1)) * 2 - 1;
          const arch = Math.cos(u * Math.PI * 0.48);
          const lx = u * radius * 0.95;
          const lz = -Math.pow(u, 2) * 0.65;

          const baseM = new THREE.Mesh(sharedWaveBaseGeo, deepSwellMat);
          baseM.position.set(lx, 0.32 * arch, lz - 0.35);
          baseM.scale.set(0.95, arch, 1.0);
          wallGroup.add(baseM);

          const faceM = new THREE.Mesh(sharedWaveFaceGeo, waveWallMat);
          faceM.position.set(lx, 0.78 * arch, lz + 0.12);
          faceM.scale.set(0.95, 1.15 * arch, 1.0);
          wallGroup.add(faceM);

          const foamM = new THREE.Mesh(sharedWaveFoamGeo, crestFoamMat);
          foamM.position.set(lx, 1.55 * arch, lz + 0.68);
          foamM.rotation.x = 0.35;
          foamM.scale.set(1.0, arch, 1.0);
          wallGroup.add(foamM);
        }
        group.add(wallGroup);

        return {
          kind,
          group,
          materials,
          cloudBody: wallGroup,
          seenStamp: 0,
        };
      }

      if (kind === 'volcano_eruption') {
        const magmaMat = new THREE.MeshBasicMaterial({
          color: 0xff5400,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const coreHotMat = new THREE.MeshBasicMaterial({
          color: 0xffee55,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const ashPlumeMat = new THREE.MeshStandardMaterial({
          color: 0x2b2d42,
          roughness: 0.95,
          transparent: true,
          opacity: 0.86,
        });
        const emberMat = new THREE.MeshBasicMaterial({
          color: 0xff9e00,
          transparent: true,
          opacity: 0.95,
        });
        const basaltRockMat = new THREE.MeshStandardMaterial({
          color: 0x241c19,
          roughness: 0.88,
          metalness: 0.12,
        });
        const scorchedRimMat = new THREE.MeshStandardMaterial({
          color: 0x3d2820,
          emissive: 0x7c1d05,
          emissiveIntensity: 0.45,
          roughness: 0.82,
        });
        materials.push(magmaMat, coreHotMat, ashPlumeMat, emberMat, basaltRockMat, scorchedRimMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, magmaMat);
        ringMesh.position.y = 0.22;
        ringMesh.scale.setScalar(0.1);
        group.add(ringMesh);

        const secondaryRingMesh = new THREE.Mesh(sharedHazRingGeo, coreHotMat);
        secondaryRingMesh.position.y = 0.28;
        secondaryRingMesh.scale.setScalar(0.1);
        group.add(secondaryRingMesh);

        const volcanoGeos: THREE.BufferGeometry[] = [];
        // 3D Blocky Stepped Voxel Volcano Cone (merged from 20 sub-meshes into 2 draw calls!)
        const coneGroup = new THREE.Group();
        const coneTiers = [
          { y: 0.28, w: 3.8, h: 0.56, d: 3.8, isBasalt: true },
          { y: 0.78, w: 3.05, h: 0.54, d: 3.05, isBasalt: true },
          { y: 1.26, w: 2.35, h: 0.5, d: 2.35, isBasalt: false },
          { y: 1.72, w: 1.72, h: 0.48, d: 1.72, isBasalt: false },
        ];
        const basaltParts: THREE.BufferGeometry[] = [];
        const scorchedParts: THREE.BufferGeometry[] = [];
        for (let ti = 0; ti < coneTiers.length; ti++) {
          const ct = coneTiers[ti];
          const target = ct.isBasalt ? basaltParts : scorchedParts;
          const slab = new THREE.BoxGeometry(ct.w, ct.h, ct.d);
          slab.translate(0, ct.y, 0);
          target.push(slab);
          for (const [cx, cz] of [
            [ct.w * 0.45, 0],
            [-ct.w * 0.45, 0],
            [0, ct.d * 0.45],
            [0, -ct.d * 0.45],
          ]) {
            const buttress = new THREE.BoxGeometry(ct.w * 0.34, ct.h * 0.85, ct.d * 0.34);
            buttress.translate(cx, ct.y - 0.06, cz);
            target.push(buttress);
          }
        }
        const basaltConeGeo = mergeGeometries(basaltParts, false);
        const scorchedConeGeo = mergeGeometries(scorchedParts, false);
        for (const p of basaltParts) p.dispose();
        for (const p of scorchedParts) p.dispose();
        volcanoGeos.push(basaltConeGeo, scorchedConeGeo);
        coneGroup.add(new THREE.Mesh(basaltConeGeo, basaltRockMat));
        coneGroup.add(new THREE.Mesh(scorchedConeGeo, scorchedRimMat));

        // Glowing bubbling caldera lava pool at the summit
        const craterPool = new THREE.Mesh(sharedDebrisCubeGeo, coreHotMat);
        craterPool.position.set(0, 1.98, 0);
        craterPool.scale.set(1.18 / 0.32, 0.14 / 0.32, 1.18 / 0.32);
        coneGroup.add(craterPool);

        // 8 Stepped Blocky Molten Lava Streams merged into 6 step rings (48 -> 6 draw calls!)
        const lavaStreams: THREE.Mesh[] = [];
        const streamDirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [0.72, 0.72],
          [-0.72, 0.72],
          [0.72, -0.72],
          [-0.72, -0.72],
        ];
        const stepsPerStream = 6;
        for (let step = 0; step < stepsPerStream; step++) {
          const frac = step / (stepsPerStream - 1);
          const dist = 0.62 + frac * 1.85;
          const ly = 1.86 - frac * 1.62;
          const sz = 0.36 + frac * 0.28;
          const ringParts: THREE.BufferGeometry[] = [];
          for (let si = 0; si < streamDirs.length; si++) {
            const [dx, dz] = streamDirs[si];
            const b = new THREE.BoxGeometry(sz, 0.22, sz);
            b.translate(dx * dist, 0, dz * dist);
            ringParts.push(b);
          }
          const stepGeo = mergeGeometries(ringParts, false);
          for (const rp of ringParts) rp.dispose();
          volcanoGeos.push(stepGeo);
          const lMesh = new THREE.Mesh(stepGeo, step < 2 ? coreHotMat : magmaMat);
          lMesh.position.set(0, ly, 0);
          lMesh.userData.stepIndex = step;
          lMesh.userData.targetScaleX = 1;
          lMesh.userData.targetScaleY = 1;
          lMesh.userData.targetScaleZ = 1;
          lMesh.scale.setScalar(0.001);
          lMesh.visible = false;
          coneGroup.add(lMesh);
          lavaStreams.push(lMesh);
        }
        coneGroup.scale.set(1, 0.04, 1);
        group.userData.coneGroup = coneGroup;
        group.userData.lavaStreams = lavaStreams;
        group.add(coneGroup);

        const cloudBody = new THREE.Group();
        const ashPuffs = [
          { x: 0, y: 4.6, z: 0, sx: 3.4, sy: 1.5, sz: 3.4 },
          { x: -1.4, y: 5.4, z: 0.9, sx: 2.6, sy: 1.3, sz: 2.5 },
          { x: 1.5, y: 5.2, z: -1.0, sx: 2.8, sy: 1.3, sz: 2.6 },
        ];
        for (const pf of ashPuffs) {
          const m = new THREE.Mesh(sharedHazSphereGeo, ashPlumeMat);
          m.position.set(pf.x, pf.y, pf.z);
          m.scale.set(pf.sx, pf.sy, pf.sz);
          cloudBody.add(m);
        }
        cloudBody.scale.setScalar(0.01);
        group.add(cloudBody);

        const vortexMotes: VortexMote[] = [];
        for (let i = 0; i < 16; i++) {
          const m = new THREE.Mesh(sharedDebrisCubeGeo, emberMat);
          m.scale.setScalar(0.38);
          group.add(m);
          vortexMotes.push({
            mesh: m,
            baseAngle: (i / 16) * Math.PI * 2,
            phase: i / 16,
            speed: 0.8 + (i % 4) * 0.22,
          });
        }

        return {
          kind,
          group,
          materials,
          geometries: volcanoGeos,
          ringMesh,
          secondaryRingMesh,
          cloudBody,
          vortexMotes,
          seenStamp: 0,
        };
      }

      if (kind === 'undead_portal') {
        const portalRimMat = createMagicCircleMat('undead_portal', 0.95, 0);
        const innerVoidMat = new THREE.MeshBasicMaterial({
          color: 0x090014,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
        });
        const ringMat = createMagicCircleMat('undead_portal', 0.88, 2);
        const moteMat = new THREE.MeshBasicMaterial({
          color: 0xd8b4fe,
          transparent: true,
          opacity: 0.9,
        });
        materials.push(portalRimMat, innerVoidMat, ringMat, moteMat);

        const gateRing = new THREE.Mesh(sharedMagicCircleGeo, portalRimMat);
        gateRing.position.y = 2.05;
        gateRing.scale.setScalar(Math.max(1.2, radius * 0.72));
        group.add(gateRing);

        const darkCore = new THREE.Mesh(sharedRiftCoreGeo, innerVoidMat);
        darkCore.position.y = 1.35;
        darkCore.scale.set(0.85, 1.35, 0.85);
        group.add(darkCore);

        const floorRing = new THREE.Mesh(sharedMagicCircleGeo, ringMat);
        floorRing.position.y = 0.12;
        floorRing.scale.setScalar(Math.max(1.4, radius * 0.95));
        group.add(floorRing);

        const vortexMotes: VortexMote[] = [];
        for (let i = 0; i < 14; i++) {
          const m = new THREE.Mesh(sharedDebrisCubeGeo, moteMat);
          m.scale.setScalar(0.32);
          group.add(m);
          vortexMotes.push({
            mesh: m,
            baseAngle: (i / 14) * Math.PI * 2,
            phase: i / 14,
            speed: 0.95 + (i % 3) * 0.25,
          });
        }

        return {
          kind,
          group,
          materials,
          ringMesh: gateRing,
          secondaryRingMesh: floorRing,
          vortexMotes,
          seenStamp: 0,
        };
      }

      if (kind === 'alien_mothership') {
        const dread = createAlienMothershipVisual(radius);
        const hyperVfx = createHyperspaceRippleEffects(radius);
        const shadowMat = new THREE.MeshBasicMaterial({
          color: 0x020617,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const beamMat = new THREE.MeshBasicMaterial({
          color: 0x93c5fd,
          transparent: true,
          opacity: 0.13,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const beaconMat = new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(...dread.materials, ...hyperVfx.materials, shadowMat, beamMat, beaconMat);

        // Colossal dreadnought-shaped shadow silhouette blanketing the terrain below
        const groundShadow = new THREE.Mesh(dread.shadowGeo, shadowMat);
        groundShadow.position.y = 0.14;
        groundShadow.rotation.y = 0.68;
        group.add(groundShadow);

        // Red orbital probe lock ring on the ground
        const beaconRing = new THREE.Mesh(sharedHazRingGeo, beaconMat);
        beaconRing.position.y = 0.18;
        beaconRing.scale.setScalar(2.4);
        group.add(beaconRing);

        // Sky-covering Orbital Dreadnought-Carrier hovering high above
        dread.shipGroup.position.y = 22.0;
        dread.shipGroup.rotation.y = 0.68;

        // Glowing central tractor/deployment beam cone reaching down from the ventral emitter maw
        const tractorBeam = new THREE.Mesh(sharedDomeCylinderGeo, beamMat);
        tractorBeam.position.set(0, -21.95, 0.2);
        tractorBeam.scale.set(2.35, 7.25, 2.35);
        dread.shipGroup.add(tractorBeam);

        group.add(
          dread.shipGroup,
          hyperVfx.entryPortal.group,
          hyperVfx.exitPortal.group,
          hyperVfx.wakeGroup,
          hyperVfx.groundRippleMesh,
        );
        group.userData.tractorBeam = tractorBeam;
        group.userData.reactorDrums = dread.reactorDrums;
        group.userData.engineGlowMeshes = dread.engineGlowMeshes;
        group.userData.turretPivots = dread.turretPivots;
        group.userData.hyperVfx = hyperVfx;

        return {
          kind,
          group,
          materials,
          geometries: [...dread.geometries, ...hyperVfx.geometries],
          cloudBody: dread.shipGroup,
          ringMesh: groundShadow,
          secondaryRingMesh: beaconRing,
          seenStamp: 0,
        };
      }

      if (kind === 'chrono_field') {
        const cyanMat = createMagicCircleMat('chrono_surge', 0.92, 0);
        const goldMat = createMagicCircleMat('chrono_surge', 0.9, 2);
        const moteGoldMat = new THREE.MeshBasicMaterial({
          color: 0xfacc15,
          transparent: true,
          opacity: 0.9,
        });
        const moteCyanMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.88,
        });
        materials.push(cyanMat, goldMat, moteGoldMat, moteCyanMat);

        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, cyanMat);
        ringMesh.position.y = 0.14;
        ringMesh.scale.setScalar(radius);
        group.add(ringMesh);

        const secondaryRingMesh = new THREE.Mesh(sharedMagicCircleGeo, goldMat);
        secondaryRingMesh.position.y = 0.45;
        secondaryRingMesh.scale.setScalar(radius * 0.68);
        group.add(secondaryRingMesh);

        const vortexMotes: VortexMote[] = [];
        for (let i = 0; i < 12; i++) {
          const m = new THREE.Mesh(sharedDebrisCubeGeo, i % 2 === 0 ? moteGoldMat : moteCyanMat);
          m.scale.setScalar(0.28);
          group.add(m);
          vortexMotes.push({
            mesh: m,
            baseAngle: (i / 12) * Math.PI * 2,
            phase: i / 12,
            speed: 1.15,
          });
        }

        return {
          kind,
          group,
          materials,
          ringMesh,
          secondaryRingMesh,
          vortexMotes,
          seenStamp: 0,
        };
      }

      if (kind === 'orbital_beam') {
        const coreBeamMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.96,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const outerBeamMat = new THREE.MeshBasicMaterial({
          color: 0xf97316,
          transparent: true,
          opacity: 0.56,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const scorchRingMat = createMagicCircleMat('solar_orbital_laser', 0.94);
        materials.push(coreBeamMat, outerBeamMat, scorchRingMat);

        const coreCol = new THREE.Mesh(sharedDomeCylinderGeo, coreBeamMat);
        coreCol.position.y = 0;
        coreCol.scale.set(0.75, 14.0, 0.75);
        group.add(coreCol);

        const outerCol = new THREE.Mesh(sharedDomeCylinderGeo, outerBeamMat);
        outerCol.position.y = 0;
        outerCol.scale.set(1.75, 14.0, 1.75);
        group.add(outerCol);

        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, scorchRingMat);
        ringMesh.position.y = 0.14;
        ringMesh.scale.setScalar(Math.max(1.8, radius * 0.78));
        group.add(ringMesh);

        return {
          kind,
          group,
          materials,
          ringMesh,
          secondaryRingMesh: outerCol,
          seenStamp: 0,
        };
      }

      if (kind === 'gravity_anomaly') {
        const violetMat = createMagicCircleMat('gravity_flip', 0.9, 0);
        const deepMat = createMagicCircleMat('gravity_flip', 0.76, 2);
        materials.push(violetMat, deepMat);

        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, violetMat);
        ringMesh.position.y = 0.14;
        ringMesh.scale.setScalar(radius);
        group.add(ringMesh);

        const gravityRings: THREE.Mesh[] = [];
        for (let i = 0; i < 3; i++) {
          const gr = new THREE.Mesh(sharedMagicCircleGeo, i % 2 === 0 ? violetMat : deepMat);
          gr.position.y = 0.4 + i * 1.4;
          gr.scale.setScalar(radius * (0.9 - i * 0.15));
          group.add(gr);
          gravityRings.push(gr);
        }

        return {
          kind,
          group,
          materials,
          ringMesh,
          gravityRings,
          seenStamp: 0,
        };
      }

      return {
        kind,
        group,
        materials,
        seenStamp: 0,
      };
    }

    // One-shot Animated Power VFX (Blocky Voxel Asteroid dive + fireball dome, Multi-fork Lightning, Orbital Beams, Shockwaves)
    const burstFxGroup = new THREE.Group();
    worldGroup.add(burstFxGroup);

    // Build a true Blocky Voxel Space-Rock Asteroid from merged 3D cubes with dark chondrite rock blocks & recessed glowing magma fissure blocks
    const sharedMeteorGeo = (() => {
      const colCrustDark = new THREE.Color('#241a18');
      const colCrustMid = new THREE.Color('#3f302b');
      const colCrustHi = new THREE.Color('#5c4740');
      const colScorch = new THREE.Color('#9e3312');
      const colLava = new THREE.Color('#ff5400');
      const colLavaHot = new THREE.Color('#ffee55');
      const tmpCol = new THREE.Color();

      const voxelGeos: THREE.BufferGeometry[] = [];
      const step = 0.42;
      for (let gx = -3; gx <= 3; gx++) {
        for (let gy = -2; gy <= 2; gy++) {
          for (let gz = -3; gz <= 3; gz++) {
            const nx = gx / 3.1;
            const ny = gy / 2.3;
            const nz = gz / 2.8;
            const distSq = nx * nx + ny * ny + nz * nz;
            const hash = Math.sin(gx * 12.7 + gy * 7.3 - gz * 9.1) * 0.18 + Math.cos(gx * 5.1 - gz * 11.3) * 0.12;
            if (distSq > 1.05 + hash) continue;
            // Skip purely internal hidden cubes to keep triangle count lean
            if (Math.abs(gx) <= 1 && Math.abs(gy) <= 1 && Math.abs(gz) <= 1) continue;

            const isMagmaFissure =
              (gx === 0 && Math.abs(gy) <= 1) ||
              (gy === 0 && Math.abs(gz) <= 1 && (gx + gz) % 2 === 0) ||
              hash < -0.11;
            const boxScale = isMagmaFissure ? step * 0.92 : step * 1.04;
            const box = new THREE.BoxGeometry(boxScale, boxScale, boxScale).toNonIndexed();
            box.translate(gx * step, gy * step, gz * step);

            const posCount = box.attributes.position.count;
            const colors = new Float32Array(posCount * 3);
            if (isMagmaFissure) {
              tmpCol.copy(Math.abs(gx) + Math.abs(gz) <= 2 ? colLavaHot : colLava);
            } else if (distSq < 0.68) {
              tmpCol.copy(colScorch).lerp(colCrustDark, 0.5);
            } else if ((gx + gy + gz) % 2 === 0) {
              tmpCol.copy(colCrustDark).lerp(colCrustMid, 0.45);
            } else {
              tmpCol.copy(colCrustMid).lerp(colCrustHi, 0.55);
            }
            for (let vi = 0; vi < posCount; vi++) {
              colors[vi * 3] = tmpCol.r;
              colors[vi * 3 + 1] = tmpCol.g;
              colors[vi * 3 + 2] = tmpCol.b;
            }
            box.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            voxelGeos.push(box);
          }
        }
      }
      const merged = mergeGeometries(voxelGeos, false);
      for (const vg of voxelGeos) vg.dispose();
      merged.computeVertexNormals();
      return merged;
    })();

    // Stepped Blocky Voxel Atmospheric Plasma Sheath & Comet Wake Tail
    const sharedMeteorAuraGeo = (() => {
      const auraCubes: THREE.BufferGeometry[] = [];
      const tailBlocks = [
        { x: 0, y: 0, z: 0, sx: 2.8, sy: 2.1, sz: 2.4 },
        { x: 0.65, y: 1.35, z: -0.65, sx: 2.2, sy: 1.8, sz: 2.0 },
        { x: 1.35, y: 2.75, z: -1.35, sx: 1.65, sy: 1.5, sz: 1.55 },
        { x: 2.05, y: 4.1, z: -2.05, sx: 1.1, sy: 1.15, sz: 1.05 },
      ];
      for (const tb of tailBlocks) {
        const b = new THREE.BoxGeometry(tb.sx, tb.sy, tb.sz).toNonIndexed();
        b.translate(tb.x, tb.y, tb.z);
        auraCubes.push(b);
      }
      const mergedAura = mergeGeometries(auraCubes, false);
      for (const ac of auraCubes) ac.dispose();
      mergedAura.computeVertexNormals();
      return mergedAura;
    })();

    // Single merged blocky mushroom-cloud plume (108 tris, 1 draw call instead of 9x 1,320-tri meteor meshes)
    const sharedAsteroidPlumeGeo = (() => {
      const stemConfigs = [
        { x: 0, y: 1.0, z: 0, sx: 1.6, sy: 2.0, sz: 1.6 },
        { x: 0, y: 2.8, z: 0, sx: 1.3, sy: 2.0, sz: 1.3 },
        { x: 0, y: 4.5, z: 0, sx: 3.6, sy: 1.4, sz: 3.6 },
        { x: 0, y: 5.5, z: 0, sx: 4.8, sy: 1.2, sz: 4.8 },
        { x: 0, y: 6.4, z: 0, sx: 3.2, sy: 1.0, sz: 3.2 },
        { x: 1.9, y: 5.2, z: 0, sx: 1.8, sy: 1.1, sz: 2.2 },
        { x: -1.9, y: 5.2, z: 0, sx: 1.8, sy: 1.1, sz: 2.2 },
        { x: 0, y: 5.2, z: 1.9, sx: 2.2, sy: 1.1, sz: 1.8 },
        { x: 0, y: 5.2, z: -1.9, sx: 2.2, sy: 1.1, sz: 1.8 },
      ];
      const parts: THREE.BufferGeometry[] = [];
      for (const sc of stemConfigs) {
        const b = new THREE.BoxGeometry(sc.sx * 0.95, sc.sy * 0.95, sc.sz * 0.95).toNonIndexed();
        b.translate(sc.x, sc.y, sc.z);
        parts.push(b);
      }
      const merged = mergeGeometries(parts, false);
      for (const p of parts) p.dispose();
      merged.computeVertexNormals();
      return merged;
    })();

    // Chunky 2-box vertex-colored voxel boulder (24 tris) for asteroid lobes & instanced ejecta
    const sharedEjectaBoulderGeo = (() => {
      const b1 = new THREE.BoxGeometry(1.1, 0.9, 1.0).toNonIndexed();
      const b2 = new THREE.BoxGeometry(0.75, 0.72, 0.82).toNonIndexed();
      b2.translate(0.32, 0.24, -0.22);
      const merged = mergeGeometries([b1, b2], false);
      b1.dispose();
      b2.dispose();
      const posCount = merged.attributes.position.count;
      const colors = new Float32Array(posCount * 3);
      for (let i = 0; i < posCount; i++) {
        const hot = i >= posCount * 0.6;
        colors[i * 3] = hot ? 0.95 : 0.28;
        colors[i * 3 + 1] = hot ? 0.36 : 0.25;
        colors[i * 3 + 2] = hot ? 0.1 : 0.24;
      }
      merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      merged.computeVertexNormals();
      return merged;
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
    const sharedSkyOreGeo = new THREE.DodecahedronGeometry(0.24, 0);
    const sharedSkyCrystalGeo = (() => {
      const g = new THREE.OctahedronGeometry(0.2, 0);
      g.scale(0.82, 1.85, 0.82);
      return g;
    })();
    const sharedSkySeedGeo = new THREE.IcosahedronGeometry(0.17, 0);
    const sharedSkyCrateGeo = new THREE.BoxGeometry(0.32, 0.24, 0.32);
    const sharedSkyStreakGeo = (() => {
      const g = new THREE.CylinderGeometry(0.025, 0.09, 2.4, 5);
      g.translate(0, 1.2, 0);
      return g;
    })();

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
        | 'blackhole_explosion'
        | 'heat_wave_burst'
        | 'freeze_snap_burst'
        | 'tornado_summon'
        | 'tsunami_summon'
        | 'earthquake_quake'
        | 'dragon_flame'
        | 'animal_strike'
        | 'ripple_ring'
        | 'weapon_spark'
        | 'nuke_blast'
        | 'arcane_cataclysm'
        | 'battlewill_slash'
        | 'projectile_tracer'
        | 'volcano_burst'
        | 'volcanic_lava_bomb'
        | 'void_goo_splash'
        | 'sky_rain_shower';
      isMegaMeteor?: boolean;
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
      outerShockWallMesh?: THREE.Mesh;
      ringMesh?: THREE.Mesh;
      outerRingMesh?: THREE.Mesh;
      thirdRingMesh?: THREE.Mesh;
      plumeGroup?: THREE.Group;
      ejectaInst?: THREE.InstancedMesh;
      ejectaBoulders?: {
        active: boolean;
        x: number;
        y: number;
        z: number;
        scale: number;
        rx: number;
        ry: number;
        rz: number;
        vx: number;
        vy: number;
        vz: number;
        rotX: number;
        rotY: number;
        rotZ: number;
      }[];
      floatingCrown?: THREE.Group;
      strataRings?: THREE.Mesh[];
      motes?: PowerMote[];
      spikes?: THREE.Mesh[];
      crackMeshes?: THREE.Mesh[];
      slashMeshes?: THREE.Mesh[];
      sparkShards?: THREE.Mesh[];
      runePillars?: THREE.Mesh[];
      skyCircleMesh?: THREE.Mesh;
      beamCoreMesh?: THREE.Mesh;
      beamAuraMesh?: THREE.Mesh;
      torusCapMesh?: THREE.Mesh;
      muzzleRingMesh?: THREE.Mesh;
      slashBaseYaw?: number;
      flameCoreCone?: THREE.Mesh;
      flameOuterCone?: THREE.Mesh;
      tracerMesh?: THREE.Object3D;
      vfxSubtype?: 'bullet' | 'cannon_shell' | 'bomb' | 'missile' | 'arcane_bolt' | 'plasma_beam' | 'laser_beam';
      stemMesh?: THREE.Mesh;
      capMesh?: THREE.Mesh;
      faultSegments?: EarthquakeFaultSegment[];
      quakeShapeKind?: EarthquakeShapeKind;
      particleEmitTimer?: number;
      skyRainDrops?: Array<{
        mesh: THREE.Mesh;
        streak: THREE.Mesh;
        tx: number;
        ty: number;
        tz: number;
        ox: number;
        oy: number;
        oz: number;
        tileX: number;
        tileZ: number;
        extraTiles?: Array<{ x: number; z: number }>;
        dropKind: TerrainToolType;
        applyOnLand: boolean;
        delay: number;
        fallDur: number;
        landed: boolean;
        spinX: number;
        spinY: number;
        swayAmp: number;
        impactColor: string;
        secondaryColor: string;
        sparkCount: number;
      }>;
      colorHex: string;
    }
    const MAX_BURST_FX = 36;
    const activeBurstFx: ActiveBurstFx[] = [];

    function flushPendingSkyRainDrops(fx: ActiveBurstFx) {
      if (!fx.skyRainDrops) return;
      for (const d of fx.skyRainDrops) {
        if (!d.landed) {
          d.landed = true;
          if (d.applyOnLand) {
            executeTerrainDropTileImpact(simRef.current, d.dropKind, d.tileX, d.tileZ);
            if (d.extraTiles) {
              for (const et of d.extraTiles) {
                executeTerrainDropTileImpact(simRef.current, d.dropKind, et.x, et.z);
              }
            }
          }
        }
      }
    }

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
      ox?: number,
      oy?: number,
      oz?: number,
      dropKind?: TerrainToolType,
      dropTargets?: Array<{ x: number; y: number; z: number }>,
    ) {
      // Ensure every power burst & magic circle spawns cleanly above the animated ocean surface
      ty = Math.max(WATER_SURFACE_EFFECT_Y, ty);

      // Bound simultaneous active bursts for smooth performance during continuous S-pattern painting
      if (activeBurstFx.length >= MAX_BURST_FX) {
        const dropIdx = activeBurstFx.findIndex((f) => f.impactFired || !f.deferImpact);
        const idx = dropIdx >= 0 ? dropIdx : 0;
        const old = activeBurstFx[idx];
        if (old) {
          flushPendingSkyRainDrops(old);
          burstFxGroup.remove(old.group);
          for (const m of old.materials) m.dispose();
          activeBurstFx.splice(idx, 1);
        }
      }

      const group = new THREE.Group();
      const materials: THREE.Material[] = [];

      if (type === 'meteor_strike' || type === 'huge_asteroid_strike') {
        const isMegaMeteor = type === 'huge_asteroid_strike';
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
        const outerShockWallMat = new THREE.MeshBasicMaterial({
          color: 0xffe066,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const machRingMat = new THREE.MeshBasicMaterial({
          color: 0xfff3b0,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const plumeSmokeMat = new THREE.MeshStandardMaterial({
          color: 0x2b2d42,
          roughness: 0.92,
          metalness: 0.05,
          emissive: new THREE.Color(0xff4500),
          emissiveIntensity: 0.35,
          transparent: true,
          opacity: 0.92,
        });
        materials.push(
          rockMat,
          coreGlowMat,
          domeMat,
          ringMat,
          outerRingMat,
          innerDomeMat,
          shockWallMat,
          outerShockWallMat,
          machRingMat,
          plumeSmokeMat,
        );

        const meteorGroup = new THREE.Group();
        const meteorRockCore = new THREE.Group();
        const meteorRock = new THREE.Mesh(sharedMeteorGeo, rockMat);
        // Orthogonal blocky voxel rock clusters attached to the main voxel asteroid body
        const lobeOffsets = [
          { x: 0.84, y: 0.42, z: -0.42, s: 0.44 },
          { x: -0.84, y: -0.42, z: 0.42, s: 0.48 },
          { x: 0.42, y: 0.64, z: 0.64, s: 0.38 },
          { x: -0.42, y: -0.64, z: -0.64, s: 0.42 },
        ];
        for (const lb of lobeOffsets) {
          const lobe = new THREE.Mesh(sharedEjectaBoulderGeo, rockMat);
          lobe.position.set(lb.x, lb.y, lb.z);
          lobe.scale.setScalar(lb.s * 1.45);
          meteorRockCore.add(lobe);
        }
        meteorRockCore.add(meteorRock);

        const meteorAura = new THREE.Mesh(sharedMeteorAuraGeo, coreGlowMat);
        meteorGroup.add(meteorRockCore, meteorAura);
        if (isMegaMeteor) {
          meteorGroup.scale.setScalar(2.65);
          meteorGroup.position.set(tx + 24, ty + 54, tz - 24);
        } else {
          meteorGroup.position.set(tx + 15.5, ty + 34, tz - 15.5);
        }
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

        const outerShockWallMesh = new THREE.Mesh(sharedDomeCylinderGeo, outerShockWallMat);
        outerShockWallMesh.position.set(tx, ty + 0.05, tz);
        outerShockWallMesh.scale.set(0.3, 0.6, 0.3);
        outerShockWallMesh.visible = false;
        group.add(outerShockWallMesh);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
        ringMesh.position.set(tx, ty + 0.12, tz);
        ringMesh.scale.setScalar(radius * 0.95);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, outerRingMat);
        outerRingMesh.position.set(tx, ty + 0.16, tz);
        outerRingMesh.scale.setScalar(radius * 1.45);
        group.add(outerRingMesh);

        const thirdRingMesh = new THREE.Mesh(sharedHazRingGeo, machRingMat);
        thirdRingMesh.position.set(tx, ty + 0.2, tz);
        thirdRingMesh.scale.setScalar(0.4);
        thirdRingMesh.visible = false;
        group.add(thirdRingMesh);

        // 16 erupting magma debris pillars around the crater rim
        const spikeCount = isMegaMeteor ? 16 : 12;
        const spikes: THREE.Mesh[] = [];
        for (let i = 0; i < spikeCount; i++) {
          const a = (i / spikeCount) * Math.PI * 2;
          const sp = new THREE.Mesh(sharedPillarSpikeGeo, i % 2 === 0 ? rockMat : coreGlowMat);
          sp.position.set(tx + Math.cos(a) * (radius * 0.58), ty, tz + Math.sin(a) * (radius * 0.58));
          sp.rotation.z = Math.cos(a) * -0.45;
          sp.rotation.x = Math.sin(a) * 0.45;
          sp.scale.set(1, 0.01, 1);
          sp.visible = false;
          group.add(sp);
          spikes.push(sp);
        }

        // Rising 3D blocky voxel mushroom cloud (1 draw call) & instanced ballistic ejecta boulders (1 draw call)
        let plumeGroup: THREE.Group | undefined;
        let ejectaInst: THREE.InstancedMesh | undefined;
        let ejectaBoulders: ActiveBurstFx['ejectaBoulders'];
        if (isMegaMeteor) {
          plumeGroup = new THREE.Group();
          plumeGroup.position.set(tx, ty + 0.2, tz);
          plumeGroup.visible = false;
          const plumeMesh = new THREE.Mesh(sharedAsteroidPlumeGeo, plumeSmokeMat);
          plumeGroup.add(plumeMesh);
          group.add(plumeGroup);

          const ejectaCount = 24;
          ejectaInst = new THREE.InstancedMesh(sharedEjectaBoulderGeo, rockMat, ejectaCount);
          ejectaInst.frustumCulled = false;
          ejectaInst.visible = false;
          ejectaInst.count = 0;
          group.add(ejectaInst);

          ejectaBoulders = [];
          for (let bi = 0; bi < ejectaCount; bi++) {
            const angle = (bi / ejectaCount) * Math.PI * 2 + (bi % 3) * 0.14;
            const speed = 7.5 + (bi % 5) * 2.3;
            const upVel = 9.5 + (bi % 4) * 2.8;
            ejectaBoulders.push({
              active: false,
              x: tx,
              y: ty + 0.4,
              z: tz,
              scale: 0.34 + (bi % 4) * 0.14,
              rx: 0,
              ry: 0,
              rz: 0,
              vx: Math.cos(angle) * speed,
              vy: upVel,
              vz: Math.sin(angle) * speed,
              rotX: (bi % 2 === 0 ? 1 : -1) * (4.5 + (bi % 3) * 1.8),
              rotY: 3.8 + (bi % 4) * 1.5,
              rotZ: (bi % 3 === 0 ? -1 : 1) * 4.2,
            });
          }
        }

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'meteor',
          isMegaMeteor,
          powerType: type,
          group,
          materials,
          age: 0,
          duration: isMegaMeteor ? 10.2 : 2.95,
          impactDelay: isMegaMeteor ? 4.6 : 1.15,
          deferImpact: isMegaMeteor ? true : deferImpact,
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
          outerShockWallMesh,
          ringMesh,
          outerRingMesh,
          thirdRingMesh,
          plumeGroup,
          ejectaInst,
          ejectaBoulders,
          spikes,
          particleEmitTimer: 0,
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

      // 4. INSIGHT (eureka): 5-second lingering sacred geometry magic circle with continuous upward-floating wisdom motes & particles
      if (type === 'eureka') {
        const outerMat = createMagicCircleMat('eureka', 0.96, 11);
        const runeMat = createMagicCircleMat('eureka', 0.88, 37);
        const moteMat = new THREE.MeshBasicMaterial({
          color: 0x90e0ef,
          transparent: true,
          opacity: 0.92,
        });
        materials.push(outerMat, runeMat, moteMat);

        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, outerMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        ringMesh.scale.setScalar(radius * 1.05);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedMagicCircleGeo, runeMat);
        outerRingMesh.position.set(tx, ty + 0.17, tz);
        outerRingMesh.scale.setScalar(radius * 0.72);
        group.add(outerRingMesh);

        const thirdRingMesh = new THREE.Mesh(sharedMagicCircleGeo, outerMat);
        thirdRingMesh.position.set(tx, ty + 0.19, tz);
        thirdRingMesh.scale.setScalar(radius * 0.45);
        group.add(thirdRingMesh);

        const motes: PowerMote[] = [];
        for (let i = 0; i < 28; i++) {
          const angle = (i / 28) * Math.PI * 2 + (i % 3) * 0.4;
          const dist = (0.14 + ((i * 37) % 85) / 100) * radius * 0.9;
          const m = new THREE.Mesh(sharedOrbMoteGeo, moteMat);
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

      // 5. BLESS (blessing): Blooming golden-emerald runic magic circle & ascending spiral life petals
      if (type === 'blessing') {
        const goldMat = createMagicCircleMat('blessing', 0.95, 19);
        const emeraldMat = createMagicCircleMat('blessing', 0.85, 53);
        const petalMat = new THREE.MeshBasicMaterial({
          color: 0xfff3b0,
          transparent: true,
          opacity: 0.92,
        });
        materials.push(goldMat, emeraldMat, petalMat);

        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, goldMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        ringMesh.scale.setScalar(radius * 1.02);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedMagicCircleGeo, emeraldMat);
        outerRingMesh.position.set(tx, ty + 0.17, tz);
        outerRingMesh.scale.setScalar(radius * 0.56);
        group.add(outerRingMesh);

        const motes: PowerMote[] = [];
        for (let i = 0; i < 22; i++) {
          const angle = (i / 22) * Math.PI * 2;
          const dist = (0.18 + ((i * 29) % 80) / 100) * radius * 0.86;
          const m = new THREE.Mesh(sharedOrbMoteGeo, petalMat);
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

      // 6. GOLDEN AGE (golden_age): Top-facing solar runic crown + triple imperial ground seal + 5.5s golden stardust
      if (type === 'golden_age') {
        const sunMat = createMagicCircleMat('golden_age', 0.96, 23);
        const crownMat = createMagicCircleMat('golden_age', 0.92, 67);
        const moteMat = new THREE.MeshBasicMaterial({
          color: 0xfff3b0,
          transparent: true,
          opacity: 0.95,
        });
        materials.push(sunMat, crownMat, moteMat);

        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, sunMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        ringMesh.scale.setScalar(radius * 1.06);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedMagicCircleGeo, crownMat);
        outerRingMesh.position.set(tx, ty + 0.17, tz);
        outerRingMesh.scale.setScalar(radius * 0.76);
        group.add(outerRingMesh);

        const thirdRingMesh = new THREE.Mesh(sharedMagicCircleGeo, sunMat);
        thirdRingMesh.position.set(tx, ty + 0.19, tz);
        thirdRingMesh.scale.setScalar(radius * 0.48);
        group.add(thirdRingMesh);

        const floatingCrown = new THREE.Group();
        floatingCrown.position.set(tx, ty + 3.4, tz);
        const halo1 = new THREE.Mesh(sharedMagicCircleGeo, crownMat);
        halo1.scale.setScalar(1.65);
        const halo2 = new THREE.Mesh(sharedMagicCircleGeo, sunMat);
        halo2.position.y = 0.12;
        halo2.scale.setScalar(1.15);
        floatingCrown.add(halo1, halo2);
        group.add(floatingCrown);

        const motes: PowerMote[] = [];
        for (let i = 0; i < 26; i++) {
          const angle = (i / 26) * Math.PI * 2;
          const dist = (0.15 + ((i * 41) % 85) / 100) * radius * 0.92;
          const m = new THREE.Mesh(sharedOrbMoteGeo, moteMat);
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

      // 7. DIVINE SHIELD (divine_shield): Expanding crystalline Aegis hemisphere & runic magic circle wave
      if (type === 'divine_shield') {
        const domeMat = new THREE.MeshBasicMaterial({
          color: 0x72efdd,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const ringMat = createMagicCircleMat('divine_shield', 0.96, 31);
        materials.push(domeMat, ringMat);

        const explosionDome = new THREE.Mesh(sharedExplosionDomeGeo, domeMat);
        explosionDome.position.set(tx, ty + 0.05, tz);
        explosionDome.scale.setScalar(0.2);
        group.add(explosionDome);

        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, ringMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        ringMesh.scale.setScalar(0.3);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedMagicCircleGeo, ringMat);
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

      // 8. BLOODLUST FURY (bloodlust_frenzy): Crimson war-arena runic sigil & fast-whirling horizontal ember cyclone
      if (type === 'bloodlust_frenzy') {
        const crimsonMat = createMagicCircleMat('bloodlust_frenzy', 0.95, 41);
        const emberMat = createMagicCircleMat('bloodlust_frenzy', 0.88, 73);
        const shardMat = new THREE.MeshBasicMaterial({
          color: 0xff7b00,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(crimsonMat, emberMat, shardMat);

        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, crimsonMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        ringMesh.scale.setScalar(radius * 1.02);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedMagicCircleGeo, emberMat);
        outerRingMesh.position.set(tx, ty + 0.17, tz);
        outerRingMesh.scale.setScalar(radius * 0.72);
        group.add(outerRingMesh);

        const motes: PowerMote[] = [];
        for (let i = 0; i < 22; i++) {
          const angle = (i / 22) * Math.PI * 2;
          const dist = (0.28 + ((i * 19) % 70) / 100) * radius * 0.92;
          const m = new THREE.Mesh(sharedShardMoteGeo, shardMat);
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

      // 9. ABYSSAL CURSE (curse): Inward-collapsing dark void eclipse runic magic circles & curling shadow wisps
      if (type === 'curse') {
        const violetMat = createMagicCircleMat('curse', 0.94, 47);
        const voidMat = createMagicCircleMat('curse', 0.86, 83);
        const wispMat = new THREE.MeshBasicMaterial({
          color: 0x9d4edd,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(violetMat, voidMat, wispMat);

        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, violetMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        ringMesh.scale.setScalar(radius * 1.04);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedMagicCircleGeo, voidMat);
        outerRingMesh.position.set(tx, ty + 0.17, tz);
        outerRingMesh.scale.setScalar(radius * 0.85);
        group.add(outerRingMesh);

        const motes: PowerMote[] = [];
        for (let i = 0; i < 22; i++) {
          const angle = (i / 22) * Math.PI * 2;
          const dist = (0.25 + ((i * 31) % 75) / 100) * radius * 0.95;
          const m = new THREE.Mesh(sharedShardMoteGeo, wispMat);
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

      // 10. PLAGUE MIASMA (plague_miasma): Bubbling bio-toxic mire globules swelling & popping from a runic ground circle
      if (type === 'plague_miasma') {
        const toxicMat = createMagicCircleMat('plague_miasma', 0.92, 59);
        const mireMat = new THREE.MeshBasicMaterial({
          color: 0x38b000,
          transparent: true,
          opacity: 0.82,
        });
        materials.push(toxicMat, mireMat);

        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, toxicMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        ringMesh.scale.setScalar(radius * 1.02);
        group.add(ringMesh);

        const motes: PowerMote[] = [];
        for (let i = 0; i < 18; i++) {
          const angle = (i / 18) * Math.PI * 2 + (i % 3) * 0.3;
          const dist = (0.12 + ((i * 23) % 85) / 100) * radius * 0.85;
          const m = new THREE.Mesh(sharedHazSphereGeo, mireMat);
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

      // 11. ORBITAL TERRAFORM (terraform_beam): Stacked horizontal top-facing runic scanning circles & levitating earth blocks
      if (type === 'terraform_beam') {
        const terraMat = createMagicCircleMat('terraform_beam', 0.94, 61);
        const gridMat = createMagicCircleMat('terraform_beam', 0.86, 89);
        const orbMat = new THREE.MeshBasicMaterial({
          color: 0x06d6a0,
          transparent: true,
          opacity: 0.9,
        });
        materials.push(terraMat, gridMat, orbMat);

        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, terraMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        ringMesh.scale.setScalar(radius * 1.05);
        group.add(ringMesh);

        const strataRings: THREE.Mesh[] = [];
        for (let s = 0; s < 4; s++) {
          const sr = new THREE.Mesh(sharedMagicCircleGeo, s % 2 === 0 ? terraMat : gridMat);
          sr.position.set(tx, ty + 1.5 + s * 1.4, tz);
          sr.scale.setScalar(radius * (0.94 - s * 0.14));
          group.add(sr);
          strataRings.push(sr);
        }

        const motes: PowerMote[] = [];
        for (let i = 0; i < 20; i++) {
          const angle = (i / 20) * Math.PI * 2;
          const dist = (0.2 + ((i * 33) % 78) / 100) * radius * 0.88;
          const m = new THREE.Mesh(sharedHazSphereGeo, orbMat);
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

      // 12. SINGULARITY RIFT (wormhole_ascension): Gravitational inward implosion & horizontal top-facing runic accretion circles
      if (type === 'wormhole_ascension') {
        const riftMat = createMagicCircleMat('wormhole_ascension', 0.95, 71);
        const cyanMat = createMagicCircleMat('wormhole_ascension', 0.88, 97);
        const moteMat = new THREE.MeshBasicMaterial({
          color: 0xc77dff,
          transparent: true,
          opacity: 0.92,
        });
        materials.push(riftMat, cyanMat, moteMat);

        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, riftMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        ringMesh.scale.setScalar(radius * 1.18);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedMagicCircleGeo, cyanMat);
        outerRingMesh.position.set(tx, ty + 1.8, tz);
        outerRingMesh.scale.setScalar(radius * 1.25);
        group.add(outerRingMesh);

        const motes: PowerMote[] = [];
        for (let i = 0; i < 24; i++) {
          const angle = (i / 24) * Math.PI * 2;
          const dist = (0.35 + ((i * 29) % 75) / 100) * radius * 1.2;
          const m = new THREE.Mesh(sharedOrbMoteGeo, moteMat);
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

      if (type === 'blackhole_explosion') {
        const flashDomeMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.98,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const plasmaDomeMat = new THREE.MeshBasicMaterial({
          color: 0xc77dff,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const shockWallMat = new THREE.MeshBasicMaterial({
          color: 0x56cfe1,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xe0aaff,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(flashDomeMat, plasmaDomeMat, shockWallMat, ringMat);

        const innerDomeMesh = new THREE.Mesh(sharedExplosionDomeGeo, flashDomeMat);
        innerDomeMesh.position.set(tx, ty + 0.35, tz);
        group.add(innerDomeMesh);

        const explosionDome = new THREE.Mesh(sharedExplosionDomeGeo, plasmaDomeMat);
        explosionDome.position.set(tx, ty + 0.15, tz);
        group.add(explosionDome);

        const shockWallMesh = new THREE.Mesh(sharedDomeCylinderGeo, shockWallMat);
        shockWallMesh.position.set(tx, ty + 0.05, tz);
        group.add(shockWallMesh);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
        ringMesh.position.set(tx, ty + 0.18, tz);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, shockWallMat);
        outerRingMesh.position.set(tx, ty + 0.22, tz);
        group.add(outerRingMesh);

        triggerLightFlash(tx, ty + 3, tz, '#e0aaff', 55);
        soundEngine.playMegaExplosion();
        trauma = 1.0;
        hitstopTimer = 0.09;
        spawnParticleBurst(tx, ty + 1.5, tz, 110, '#e0aaff', radius * 1.35, 13.5, 1.8);
        spawnParticleBurst(tx, ty + 1.4, tz, 75, '#56cfe1', radius * 1.1, 14.5, 1.5);
        spawnParticleBurst(tx, ty + 1.0, tz, 55, '#ff9e00', radius * 0.9, 10.0, 1.65);

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'blackhole_explosion',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 1.95,
          impactDelay: 0,
          deferImpact: false,
          tx,
          ty,
          tz,
          radius,
          impactFired: true,
          innerDomeMesh,
          explosionDome,
          shockWallMesh,
          ringMesh,
          outerRingMesh,
          colorHex,
        });
        return;
      }

      if (type === 'heat_wave') {
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xff7b00,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const innerMat = new THREE.MeshBasicMaterial({
          color: 0xffbe0b,
          transparent: true,
          opacity: 0.88,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const hazeMat = new THREE.MeshBasicMaterial({
          color: 0xff922b,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(ringMat, innerMat, hazeMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, innerMat);
        outerRingMesh.position.set(tx, ty + 0.22, tz);
        group.add(outerRingMesh);

        const shockWallMesh = new THREE.Mesh(sharedDomeCylinderGeo, hazeMat);
        shockWallMesh.position.set(tx, ty + 0.06, tz);
        group.add(shockWallMesh);

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'heat_wave_burst',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 1.55,
          impactDelay: 0.14,
          deferImpact,
          tx,
          ty,
          tz,
          radius,
          impactFired: false,
          ringMesh,
          outerRingMesh,
          shockWallMesh,
          colorHex,
        });
        return;
      }

      if (type === 'freeze_snap') {
        const frostMat = new THREE.MeshBasicMaterial({
          color: 0x7dd3fc,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const iceMat = new THREE.MeshStandardMaterial({
          color: 0xe0f2fe,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.35,
          roughness: 0.25,
          transparent: true,
          opacity: 0.9,
        });
        materials.push(frostMat, iceMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, frostMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, frostMat);
        outerRingMesh.position.set(tx, ty + 0.2, tz);
        group.add(outerRingMesh);

        const spikes: THREE.Mesh[] = [];
        for (let si = 0; si < 14; si++) {
          const ang = (si / 14) * Math.PI * 2 + (si % 3) * 0.2;
          const dist = (0.28 + ((si * 31) % 70) / 100) * radius * 0.85;
          const sp = new THREE.Mesh(sharedPillarSpikeGeo, iceMat);
          sp.userData.distFrac = dist / Math.max(0.1, radius * 0.85);
          sp.position.set(tx + Math.cos(ang) * dist, ty, tz + Math.sin(ang) * dist);
          sp.rotation.set(Math.sin(ang) * 0.35, ang, Math.cos(ang) * -0.35);
          sp.scale.set(0.85, 0.01, 0.85);
          group.add(sp);
          spikes.push(sp);
        }

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'freeze_snap_burst',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 1.75,
          impactDelay: 0.14,
          deferImpact,
          tx,
          ty,
          tz,
          radius,
          impactFired: false,
          ringMesh,
          outerRingMesh,
          spikes,
          colorHex,
        });
        return;
      }

      if (type === 'tornado' || type === 'super_tornado' || type === 'tsunami') {
        const isSuperTornado = type === 'super_tornado';
        const isTornado = type === 'tornado' || isSuperTornado;
        const ringMat = new THREE.MeshBasicMaterial({
          color: isSuperTornado ? 0x6d28d9 : isTornado ? 0xa5b4fc : 0x00b4d8,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const outerMat = new THREE.MeshBasicMaterial({
          color: isSuperTornado ? 0x38bdf8 : 0xe0fbfc,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(ringMat, outerMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, outerMat);
        outerRingMesh.position.set(tx, ty + 0.2, tz);
        group.add(outerRingMesh);

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: isTornado ? 'tornado_summon' : 'tsunami_summon',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: isSuperTornado ? 1.35 : 1.0,
          impactDelay: 0.18,
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

      if (type === 'volcano_eruption') {
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xff5400,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const outerMat = new THREE.MeshBasicMaterial({
          color: 0xffd166,
          transparent: true,
          opacity: 0.88,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const moundRockMat = new THREE.MeshStandardMaterial({
          color: 0x291e1a,
          emissive: 0x9e2a08,
          emissiveIntensity: 0.55,
          roughness: 0.85,
        });
        materials.push(ringMat, outerMat, moundRockMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, outerMat);
        outerRingMesh.position.set(tx, ty + 0.2, tz);
        group.add(outerRingMesh);

        // Pre-eruption rising blocky magma mound that heaves upward from the ground before the caldera bursts
        const risingMound = new THREE.Group();
        for (let tier = 0; tier < 3; tier++) {
          const w = (2.8 - tier * 0.75) / 0.32;
          const h = 0.52 / 0.32;
          const block = new THREE.Mesh(sharedDebrisCubeGeo, tier === 2 ? ringMat : moundRockMat);
          block.position.set(0, 0.26 + tier * 0.48, 0);
          block.scale.set(w, h, w);
          risingMound.add(block);
        }
        risingMound.position.set(tx, ty, tz);
        risingMound.scale.set(1, 0.05, 1);
        group.add(risingMound);

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'volcano_burst',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: deferImpact ? 2.1 : 1.5,
          impactDelay: deferImpact ? 0.78 : 0.16,
          deferImpact,
          tx,
          ty,
          tz,
          radius,
          impactFired: false,
          tracerMesh: risingMound,
          ringMesh,
          outerRingMesh,
          colorHex,
        });
        return;
      }

      if (type === 'volcanic_lava_bomb') {
        const bombMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          flatShading: true,
          color: 0xff7b00,
          emissive: 0xff5400,
          emissiveIntensity: 0.9,
          roughness: 0.55,
        });
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xff5400,
          transparent: true,
          opacity: 0.78,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(bombMat, ringMat);

        const bombMesh = new THREE.Mesh(sharedMeteorGeo, bombMat);
        bombMesh.scale.setScalar(0.36);
        bombMesh.position.set(ox ?? tx, (oy ?? ty) + 2.5, oz ?? tz);
        group.add(bombMesh);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
        ringMesh.position.set(tx, ty + 0.12, tz);
        ringMesh.scale.setScalar(radius * 0.45);
        group.add(ringMesh);

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'volcanic_lava_bomb',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 1.35,
          impactDelay: 0.92,
          deferImpact: false,
          tx,
          ty,
          tz,
          ox: ox ?? tx,
          oy: (oy ?? ty) + 2.5,
          oz: oz ?? tz,
          radius,
          impactFired: false,
          tracerMesh: bombMesh,
          ringMesh,
          colorHex,
        });
        return;
      }

      if (type === 'void_goo' || type === 'void_goo_splash') {
        const isSkySeedDrop = type === 'void_goo';
        const voidRingMat = new THREE.MeshBasicMaterial({
          color: 0x3b0764,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const starRingMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const seedShellMat = new THREE.MeshStandardMaterial({
          color: 0x090214,
          emissive: 0x3b0764,
          emissiveIntensity: 0.85,
          roughness: 0.3,
        });
        const seedCrystalMat = new THREE.MeshBasicMaterial({
          color: 0xa855f7,
        });
        const seedStarCoreMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
        });
        materials.push(voidRingMat, starRingMat, seedShellMat, seedCrystalMat, seedStarCoreMat);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, voidRingMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, starRingMat);
        outerRingMesh.position.set(tx, ty + 0.18, tz);
        group.add(outerRingMesh);

        let seedGroup: THREE.Group | undefined;
        if (isSkySeedDrop) {
          // Blocky Abyssal Void Seed Pod that drops from the heavens before infecting the land
          seedGroup = new THREE.Group();
          const coreCube = new THREE.Mesh(sharedDebrisCubeGeo, seedShellMat);
          coreCube.scale.set(2.4, 3.2, 2.4);
          seedGroup.add(coreCube);

          const crossX = new THREE.Mesh(sharedDebrisCubeGeo, seedCrystalMat);
          crossX.scale.set(3.2, 1.6, 1.4);
          seedGroup.add(crossX);

          const crossZ = new THREE.Mesh(sharedDebrisCubeGeo, seedCrystalMat);
          crossZ.scale.set(1.4, 1.6, 3.2);
          seedGroup.add(crossZ);

          const starTips = [
            [0, 0.65, 0],
            [0, -0.65, 0],
            [0.52, 0.35, 0.52],
            [-0.52, -0.35, -0.52],
          ];
          for (const [sx, sy, sz] of starTips) {
            const tip = new THREE.Mesh(sharedDebrisCubeGeo, seedStarCoreMat);
            tip.position.set(sx, sy, sz);
            tip.scale.setScalar(1.05);
            seedGroup.add(tip);
          }
          seedGroup.position.set(tx + 4.2, ty + 18.0, tz - 4.2);
          group.add(seedGroup);
        }

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'void_goo_splash',
          powerType: 'void_goo',
          group,
          materials,
          age: 0,
          duration: isSkySeedDrop ? 1.65 : 1.1,
          impactDelay: isSkySeedDrop ? 0.68 : 0.06,
          deferImpact,
          tx,
          ty,
          tz,
          ox: tx + 4.2,
          oy: ty + 18.0,
          oz: tz - 4.2,
          radius,
          impactFired: false,
          tracerMesh: seedGroup,
          ringMesh,
          outerRingMesh,
          colorHex,
        });
        return;
      }

      // New Creative God Powers (Necrotic Rift, Probe Remote, Chrono Warp, Peace Accord, Helios Orbital Beam, Gravity Flux)
      if (type === 'undead_portal' || type === 'alien_invasion' || type === 'chrono_surge' || type === 'harmony_dove' || type === 'solar_orbital_laser' || type === 'gravity_flip') {
        const ringMat = createMagicCircleMat(type, 0.96, 101);
        const outerRingMat = createMagicCircleMat(type, 0.88, 131);
        materials.push(ringMat, outerRingMat);

        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, ringMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        ringMesh.scale.setScalar(Math.max(1.5, radius * 0.65));
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedMagicCircleGeo, outerRingMat);
        outerRingMesh.position.set(tx, ty + 0.18, tz);
        outerRingMesh.scale.setScalar(Math.max(1.05, radius * 0.42));
        group.add(outerRingMesh);

        let dropObj: THREE.Object3D | undefined;
        if (type === 'alien_invasion') {
          const probeMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x22d3ee, emissiveIntensity: 0.7 });
          materials.push(probeMat);
          const probe = new THREE.Mesh(sharedDebrisCubeGeo, probeMat);
          probe.scale.set(1.4, 2.2, 1.4);
          probe.position.set(tx, ty + 16, tz);
          group.add(probe);
          dropObj = probe;
        } else if (type === 'harmony_dove') {
          const doveMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3, transparent: true, opacity: 0.96, side: THREE.DoubleSide });
          materials.push(doveMat);
          const doveGrp = new THREE.Group();
          const body = new THREE.Mesh(sharedDebrisCubeGeo, doveMat);
          body.scale.set(0.8, 0.7, 1.8);
          const wL = new THREE.Mesh(sharedDebrisCubeGeo, doveMat);
          wL.position.set(-0.5, 0.15, 0);
          wL.scale.set(2.2, 0.25, 1.0);
          const wR = new THREE.Mesh(sharedDebrisCubeGeo, doveMat);
          wR.position.set(0.5, 0.15, 0);
          wR.scale.set(2.2, 0.25, 1.0);
          doveGrp.add(body, wL, wR);
          doveGrp.position.set(tx, ty + 2.0, tz);
          group.add(doveGrp);
          dropObj = doveGrp;
        }

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'ripple_ring',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: type === 'alien_invasion' ? 1.35 : 1.05,
          impactDelay: type === 'alien_invasion' ? 0.42 : type === 'solar_orbital_laser' ? 0.26 : 0.16,
          deferImpact,
          tx,
          ty,
          tz,
          ox: tx,
          oy: ty + (type === 'alien_invasion' ? 16 : 2.0),
          oz: tz,
          radius: Math.max(2.0, radius),
          impactFired: false,
          tracerMesh: dropObj,
          ringMesh,
          outerRingMesh,
          colorHex,
        });
        return;
      }

      if (type === 'sky_rain_drop') {
        const kind = dropKind ?? 'seed_ore';
        const palette: Record<
          string,
          { primary: number; secondary: number; streak: number; impactHex: string; secondaryHex: string; geo: THREE.BufferGeometry; emissive: number; sway: number; dur: number }
        > = {
          seed_ore: { primary: 0xfacc15, secondary: 0xf59e0b, streak: 0xfde047, impactHex: '#facc15', secondaryHex: '#cbd5e1', geo: sharedSkyOreGeo, emissive: 0.65, sway: 0.0, dur: 0.36 },
          crystal_shower: { primary: 0xe879f9, secondary: 0x38bdf8, streak: 0xf0abfc, impactHex: '#e879f9', secondaryHex: '#38bdf8', geo: sharedSkyCrystalGeo, emissive: 0.85, sway: 0.0, dur: 0.38 },
          boulder_rain: { primary: 0x94a3b8, secondary: 0x64748b, streak: 0xe2e8f0, impactHex: '#94a3b8', secondaryHex: '#475569', geo: sharedSkyOreGeo, emissive: 0.2, sway: 0.0, dur: 0.34 },
          salvage_drop: { primary: 0xeab308, secondary: 0x94a3b8, streak: 0xfef08a, impactHex: '#eab308', secondaryHex: '#38bdf8', geo: sharedSkyCrateGeo, emissive: 0.45, sway: 0.15, dur: 0.42 },
          blossom_rain: { primary: 0xf472b6, secondary: 0xfbcfe8, streak: 0xf9a8d4, impactHex: '#f472b6', secondaryHex: '#fef08a', geo: sharedSkySeedGeo, emissive: 0.72, sway: 0.55, dur: 0.54 },
        };
        const cfg = palette[kind] ?? palette.seed_ore;

        const ringMat = createMagicCircleMat(kind, 0.92, 149);
        const outerRingMat = createMagicCircleMat(kind, 0.86, 173);
        const dropMatPrimary = new THREE.MeshStandardMaterial({
          color: cfg.primary,
          emissive: new THREE.Color(cfg.primary),
          emissiveIntensity: cfg.emissive,
          roughness: 0.32,
          metalness: kind === 'seed_ore' || kind === 'salvage_drop' ? 0.75 : 0.2,
          flatShading: true,
        });
        const dropMatSecondary = new THREE.MeshStandardMaterial({
          color: cfg.secondary,
          emissive: new THREE.Color(cfg.secondary),
          emissiveIntensity: cfg.emissive * 0.9,
          roughness: 0.36,
          metalness: kind === 'seed_ore' || kind === 'salvage_drop' ? 0.68 : 0.18,
          flatShading: true,
        });
        const streakMat = new THREE.MeshBasicMaterial({
          color: cfg.streak,
          transparent: true,
          opacity: 0.62,
          depthWrite: false,
        });
        materials.push(ringMat, outerRingMat, dropMatPrimary, dropMatSecondary, streakMat);

        // Multi-colored crystal materials for crystal_shower so each falling crystal has a distinct color
        const crystalColors = [
          { hex: 0xe848a8, str: '#e848a8', sec: '#7dd3fc' },
          { hex: 0x8b5cf6, str: '#8b5cf6', sec: '#38bdf8' },
          { hex: 0x10b981, str: '#10b981', sec: '#a7f3d0' },
          { hex: 0xf59e0b, str: '#f59e0b', sec: '#fef08a' },
          { hex: 0x0ea5e9, str: '#0ea5e9', sec: '#e0f2fe' },
          { hex: 0xef4444, str: '#ef4444', sec: '#fda4af' },
        ];
        const crystalDropMats: THREE.MeshStandardMaterial[] = [];
        if (kind === 'crystal_shower') {
          for (const cc of crystalColors) {
            const cm = new THREE.MeshStandardMaterial({
              color: cc.hex,
              emissive: new THREE.Color(cc.hex),
              emissiveIntensity: 0.75,
              roughness: 0.22,
              metalness: 0.2,
              flatShading: true,
            });
            crystalDropMats.push(cm);
            materials.push(cm);
          }
        }

        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, ringMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        ringMesh.scale.setScalar(Math.max(1.3, radius * 0.85));
        group.add(ringMesh);

        // Elevated top-facing sky magic circle overhead from which the items rain down
        const outerRingMesh = new THREE.Mesh(sharedMagicCircleGeo, outerRingMat);
        outerRingMesh.position.set(tx + 2.4, ty + 18.2, tz - 2.4);
        outerRingMesh.scale.setScalar(Math.max(1.5, radius * 0.95));
        group.add(outerRingMesh);

        const baseTargets =
          dropTargets && dropTargets.length > 0
            ? dropTargets
            : [{ x: tx, y: ty, z: tz }];
        const MAX_VISUAL_DROPS = 48;
        const totalDrops =
          baseTargets.length > MAX_VISUAL_DROPS
            ? MAX_VISUAL_DROPS
            : Math.max(baseTargets.length, Math.min(24, Math.max(8, baseTargets.length * 2)));
        const skyRainDrops: NonNullable<ActiveBurstFx['skyRainDrops']> = [];
        const assignedTileImpacts = new Set<string>();
        const dropExtraBuckets: Array<Array<{ x: number; z: number }>> = Array.from(
          { length: totalDrops },
          () => [],
        );
        if (Boolean(deferImpact) && baseTargets.length > totalDrops) {
          for (let ti = totalDrops; ti < baseTargets.length; ti++) {
            const extraTgt = baseTargets[ti];
            const ex = Math.round(extraTgt.x);
            const ez = Math.round(extraTgt.z);
            const eKey = `${ex},${ez}`;
            if (!assignedTileImpacts.has(eKey)) {
              assignedTileImpacts.add(eKey);
              dropExtraBuckets[ti % totalDrops].push({ x: ex, z: ez });
            }
          }
        }

        for (let di = 0; di < totalDrops; di++) {
          const tgt = baseTargets[di % baseTargets.length];
          const tileX = Math.round(tgt.x);
          const tileZ = Math.round(tgt.z);
          const tileKey = `${tileX},${tileZ}`;
          const applyOnLand = Boolean(deferImpact) && !assignedTileImpacts.has(tileKey);
          assignedTileImpacts.add(tileKey);
          const extraTiles = dropExtraBuckets[di].length > 0 ? dropExtraBuckets[di] : undefined;

          const jitterScale = di < baseTargets.length ? 0.35 : baseTargets.length === 1 ? 0.95 : 0.65;
          const jitterX = (Math.random() - 0.5) * jitterScale;
          const jitterZ = (Math.random() - 0.5) * jitterScale;
          const dtx = tgt.x + jitterX;
          const dty = tgt.y;
          const dtz = tgt.z + jitterZ;
          const heightStart = dty + 17.5 + Math.random() * 4.5;
          const dox = dtx + 2.4 + (Math.random() - 0.5) * 1.2;
          const doz = dtz - 2.4 + (Math.random() - 0.5) * 1.2;

          const dropMat =
            kind === 'crystal_shower' && crystalDropMats.length > 0
              ? crystalDropMats[di % crystalDropMats.length]
              : di % 2 === 0
                ? dropMatPrimary
                : dropMatSecondary;
          const mesh = new THREE.Mesh(cfg.geo, dropMat);
          const dropScale =
            kind === 'boulder_rain'
              ? 1.15 + Math.random() * 0.55
              : kind === 'crystal_shower'
                ? 0.98 + Math.random() * 0.48
                : kind === 'blossom_rain'
                  ? 0.72 + Math.random() * 0.32
                  : 0.88 + Math.random() * 0.42;
          mesh.scale.setScalar(dropScale);
          mesh.position.set(dox, heightStart, doz);
          mesh.visible = false;
          group.add(mesh);

          const streak = new THREE.Mesh(sharedSkyStreakGeo, streakMat);
          streak.position.set(dox, heightStart, doz);
          streak.rotation.set(0.14, 0, -0.14);
          streak.visible = false;
          group.add(streak);

          const ccInfo =
            kind === 'crystal_shower'
              ? crystalColors[di % crystalColors.length]
              : null;

          skyRainDrops.push({
            mesh,
            streak,
            tx: dtx,
            ty: dty,
            tz: dtz,
            ox: dox,
            oy: heightStart,
            oz: doz,
            tileX,
            tileZ,
            extraTiles,
            dropKind: kind,
            applyOnLand: applyOnLand || Boolean(extraTiles),
            delay: (di / totalDrops) * 0.28 + Math.random() * 0.05,
            fallDur: cfg.dur + Math.random() * 0.08,
            landed: false,
            spinX: (Math.random() - 0.5) * 11,
            spinY: (Math.random() - 0.5) * 13,
            swayAmp: cfg.sway,
            impactColor: ccInfo ? ccInfo.str : cfg.impactHex,
            secondaryColor: ccInfo ? ccInfo.sec : cfg.secondaryHex,
            sparkCount: totalDrops > 12 ? 7 : 10,
          });
        }

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'sky_rain_shower',
          powerType: type,
          group,
          materials,
          age: 0,
          duration: 1.25,
          impactDelay: 0.25,
          deferImpact: Boolean(deferImpact),
          tx,
          ty,
          tz,
          radius: Math.max(1.2, radius),
          impactFired: false,
          ringMesh,
          outerRingMesh,
          skyRainDrops,
          colorHex,
        });
        return;
      }

      // Utility events (terrain_sculpt, epoch_up): Top-facing runic magic circle on the ground
      const ringMat = createMagicCircleMat(type, 0.9, 191);
      const outerRingMat = createMagicCircleMat(type, 0.82, 211);
      materials.push(ringMat, outerRingMat);

      const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, ringMat);
      ringMesh.position.set(tx, ty + 0.14, tz);
      ringMesh.scale.setScalar(Math.max(1.1, radius * 0.65));
      group.add(ringMesh);

      const outerRingMesh = new THREE.Mesh(sharedMagicCircleGeo, outerRingMat);
      outerRingMesh.position.set(tx, ty + 0.17, tz);
      outerRingMesh.scale.setScalar(Math.max(0.8, radius * 0.42));
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
        const mawObj = uEntry.fireMaw ?? uEntry.group;
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
      const isSpecialSkill = radius >= 1.7;
      const slashMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const whiteMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: isSpecialSkill ? 0.58 : 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const materials: THREE.Material[] = [slashMat, whiteMat, ringMat];

      const slashMeshes: THREE.Mesh[] = [];
      const yaw = Math.atan2(tx - ox, tz - oz);
      // Position physical contact right between attacker snout/paws and target
      const cx = ox * 0.28 + tx * 0.72;
      const cz = oz * 0.28 + tz * 0.72;

      if (variant === 'bite') {
        // Wolf Fang Bite: compact upper & lower jaw fang arcs snapping shut on the prey (no ground explosion)
        for (let i = 0; i < 2; i++) {
          const isUpper = i === 0;
          const m = new THREE.Mesh(sharedSlashBladeGeo, isUpper ? whiteMat : slashMat);
          m.position.set(cx, ty + (isUpper ? 0.44 : 0.24), cz);
          m.rotation.set(isUpper ? 0.42 : -0.42, yaw, isUpper ? 0.18 : -0.18);
          m.scale.set(0.42, 0.55, 0.42);
          m.userData.baseY = m.position.y;
          m.userData.snapDir = isUpper ? -1 : 1;
          group.add(m);
          slashMeshes.push(m);
        }
        spawnParticleBurst(cx, ty + 0.34, cz, 3, colorHex, 0.16, 1.35, 0.42);
      } else if (variant === 'crunch') {
        if (isSpecialSkill) {
          // 5-Second Special Skill: Dinosaur Headbutt Rush / Heavy Timber Smash
          for (let i = 0; i < 2; i++) {
            const m = new THREE.Mesh(sharedSlamClawGeo, i === 0 ? slashMat : whiteMat);
            m.position.set(cx + Math.sin(yaw) * (i * 0.14), ty + 0.48, cz + Math.cos(yaw) * (i * 0.14));
            m.rotation.set(0.55, yaw, 0);
            m.scale.set(0.72, 0.72, 0.72);
            group.add(m);
            slashMeshes.push(m);
          }
          spawnParticleBurst(tx, ty + 0.42, tz, 7, colorHex, 0.42, 2.4, 0.58);
        } else {
          // Normal Dinosaur Jaw Crunch: opposing upper & lower tooth-jaw chomp arcs (no ground explosion)
          for (let i = 0; i < 2; i++) {
            const isUpper = i === 0;
            const m = new THREE.Mesh(sharedSlashBladeGeo, isUpper ? slashMat : whiteMat);
            m.position.set(cx, ty + (isUpper ? 0.58 : 0.32), cz);
            m.rotation.set(isUpper ? 0.48 : -0.48, yaw, isUpper ? 0.22 : -0.22);
            m.scale.set(0.56, 0.68, 0.56);
            m.userData.baseY = m.position.y;
            m.userData.snapDir = isUpper ? -1 : 1;
            group.add(m);
            slashMeshes.push(m);
          }
          spawnParticleBurst(cx, ty + 0.44, cz, 3, colorHex, 0.2, 1.5, 0.46);
        }
      } else if (variant === 'slam') {
        // Bear Paw Swipe: 3 parallel diagonal claw rake scratches swiping downward
        for (let i = 0; i < 3; i++) {
          const lateral = (i - 1) * 0.11;
          const perpX = Math.cos(yaw) * lateral;
          const perpZ = -Math.sin(yaw) * lateral;
          const m = new THREE.Mesh(sharedSlashBladeGeo, i === 1 ? whiteMat : slashMat);
          m.position.set(cx + perpX, ty + 0.46, cz + perpZ);
          m.rotation.set(0.65, yaw, 0.35);
          m.scale.set(isSpecialSkill ? 0.58 : 0.42, 0.62, isSpecialSkill ? 0.58 : 0.42);
          m.userData.baseY = m.position.y;
          m.userData.snapDir = -1;
          group.add(m);
          slashMeshes.push(m);
        }
        spawnParticleBurst(cx, ty + 0.34, cz, isSpecialSkill ? 6 : 3, '#d97706', isSpecialSkill ? 0.36 : 0.18, 1.6, 0.45);
      } else if (variant === 'horn_blast') {
        // Unicorn Horn Thrust: single slender forward horn gleam & 3 soft sparkles
        const m = new THREE.Mesh(sharedHornStarGeo, whiteMat);
        m.position.set(cx, ty + 0.48, cz);
        m.rotation.y = yaw;
        m.scale.setScalar(0.45);
        group.add(m);
        slashMeshes.push(m);
        spawnRisingParticles(cx, ty + 0.3, cz, 4, colorHex, 0.22, 1.4, 0.55, 0.7);
      } else {
        // Small wildlife peck / nudge: single tiny beak tick
        const m = new THREE.Mesh(sharedSlashBladeGeo, slashMat);
        m.position.set(cx, ty + 0.28, cz);
        m.rotation.set(0.5, yaw, 0);
        m.scale.set(0.24, 0.32, 0.24);
        group.add(m);
        slashMeshes.push(m);
      }

      let ringMesh: THREE.Mesh | undefined;
      if (isSpecialSkill) {
        // Only the 5-second Special Skill (e.g. Dino Headbutt Rush on a tree) gets a compact physical dust ring
        ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
        ringMesh.position.set(tx, ty + 0.1, tz);
        ringMesh.scale.setScalar(0.22);
        group.add(ringMesh);
      }

      burstFxGroup.add(group);
      activeBurstFx.push({
        kind: 'animal_strike',
        powerType: 'animal_attack',
        group,
        materials,
        age: 0,
        duration: isSpecialSkill ? 0.42 : 0.28,
        impactDelay: 0.01,
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
        slashMeshes,
        colorHex,
      });
    }

    const sharedTracerGeo = new THREE.BoxGeometry(0.11, 0.11, 0.78);
    const sharedBulletCoreGeo = new THREE.BoxGeometry(0.055, 0.055, 0.58);
    const sharedShellGeo = new THREE.SphereGeometry(0.17, 8, 6);
    const sharedShellHaloGeo = new THREE.SphereGeometry(0.29, 8, 6);
    const sharedBombBodyGeo = new THREE.CylinderGeometry(0.11, 0.16, 0.48, 8);
    sharedBombBodyGeo.rotateX(Math.PI / 2);
    const sharedBombFinGeo = new THREE.BoxGeometry(0.32, 0.32, 0.11);
    const sharedMissileGeo = new THREE.CylinderGeometry(0.06, 0.088, 0.62, 7);
    sharedMissileGeo.rotateX(Math.PI / 2);
    const sharedMissileWarheadGeo = new THREE.ConeGeometry(0.095, 0.22, 7);
    sharedMissileWarheadGeo.rotateX(Math.PI / 2);
    const sharedMissilePlumeGeo = new THREE.ConeGeometry(0.1, 0.48, 6);
    sharedMissilePlumeGeo.rotateX(-Math.PI / 2);
    const sharedArcaneBoltGeo = new THREE.OctahedronGeometry(0.24, 0);
    const sharedArcaneRingGeo = new THREE.TorusGeometry(0.32, 0.036, 6, 14);
    const sharedPlasmaBeamGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8);
    sharedPlasmaBeamGeo.rotateX(Math.PI / 2);
    const sharedPlasmaMuzzleGeo = new THREE.OctahedronGeometry(0.26, 1);
    const sharedSparkShardGeo = new THREE.BoxGeometry(0.075, 0.46, 0.075);

    const sharedNukeStemGeo = new THREE.CylinderGeometry(0.42, 0.88, 1.0, 14);
    sharedNukeStemGeo.translate(0, 0.5, 0);
    const sharedNukeCapGeo = new THREE.SphereGeometry(1.0, 18, 14);
    const sharedNukeTorusGeo = new THREE.TorusGeometry(0.95, 0.34, 12, 24);
    sharedNukeTorusGeo.rotateX(Math.PI / 2);

    const sharedArcaneSpireGeo = new THREE.ConeGeometry(0.88, 1.0, 10, 1, true);
    sharedArcaneSpireGeo.translate(0, 0.5, 0);
    const sharedArcaneHaloTorusGeo = new THREE.TorusGeometry(1.0, 0.048, 6, 28);
    sharedArcaneHaloTorusGeo.rotateX(Math.PI / 2);
    const sharedRunePillarGeo = (() => {
      const g = new THREE.OctahedronGeometry(0.28, 0);
      g.scale(0.85, 2.6, 0.85);
      return g;
    })();
    const sharedBeamColGeo = new THREE.CylinderGeometry(1.0, 1.0, 1.0, 16, 1, true);
    sharedBeamColGeo.translate(0, 0.5, 0);

    const sharedBattlewillCrescentGeo = (() => {
      const g = new THREE.RingGeometry(0.46, 1.0, 28, 1, -Math.PI * 0.68, Math.PI * 1.36);
      g.rotateX(-Math.PI / 2);
      return g;
    })();
    const sharedBattlewillEdgeGeo = (() => {
      const g = new THREE.TorusGeometry(0.96, 0.085, 6, 28, Math.PI * 1.36);
      g.rotateX(Math.PI / 2);
      g.rotateY(-Math.PI * 0.68);
      return g;
    })();

    function spawnWeaponSparkVisual(
      tx: number,
      ty: number,
      tz: number,
      radius: number,
      colorHex: string,
    ) {
      if (activeBurstFx.length >= MAX_BURST_FX) {
        const dropIdx = activeBurstFx.findIndex((f) => f.impactFired || !f.deferImpact);
        const idx = dropIdx >= 0 ? dropIdx : 0;
        const old = activeBurstFx[idx];
        if (old) {
          flushPendingSkyRainDrops(old);
          burstFxGroup.remove(old.group);
          for (const m of old.materials) m.dispose();
          activeBurstFx.splice(idx, 1);
        }
      }

      const group = new THREE.Group();
      const baseColor = colorHex || '#fbbf24';
      const shardMat = new THREE.MeshBasicMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.96,
      });
      const whiteMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.94,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const materials: THREE.Material[] = [shardMat, whiteMat];

      const ringMesh = new THREE.Mesh(sharedHazRingGeo, whiteMat);
      ringMesh.position.set(tx, ty + 0.14, tz);
      ringMesh.scale.setScalar(0.22);
      group.add(ringMesh);

      const sparkShards: THREE.Mesh[] = [];
      for (let s = 0; s < 5; s++) {
        const angle = (s / 5) * Math.PI * 2 + Math.random() * 0.4;
        const shard = new THREE.Mesh(sharedSparkShardGeo, s % 2 === 0 ? shardMat : whiteMat);
        shard.position.set(tx, ty + 0.35, tz);
        shard.rotation.set(0.45 + Math.random() * 0.5, angle, (Math.random() - 0.5) * 1.1);
        group.add(shard);
        sparkShards.push(shard);
      }

      spawnParticleBurst(tx, ty + 0.3, tz, 14, baseColor, Math.max(0.45, radius * 0.65), 4.4, 0.85);
      burstFxGroup.add(group);
      activeBurstFx.push({
        kind: 'weapon_spark',
        powerType: 'hit_spark',
        group,
        materials,
        age: 0,
        duration: 0.34,
        impactDelay: 0,
        deferImpact: false,
        tx,
        ty,
        tz,
        radius: Math.max(0.55, radius),
        impactFired: true,
        ringMesh,
        sparkShards,
        colorHex: baseColor,
      });
    }

    function spawnWarWeaponVisual(
      kind: 'projectile_tracer' | 'nuke_blast' | 'arcane_cataclysm' | 'battlewill_slash',
      ox: number,
      oy: number,
      oz: number,
      tx: number,
      ty: number,
      tz: number,
      radius: number,
      colorHex: string,
      vfxSubtype?: 'bullet' | 'cannon_shell' | 'bomb' | 'missile' | 'arcane_bolt' | 'plasma_beam' | 'laser_beam',
    ) {
      if (activeBurstFx.length >= MAX_BURST_FX) {
        const dropIdx = activeBurstFx.findIndex((f) => f.impactFired || !f.deferImpact);
        const idx = dropIdx >= 0 ? dropIdx : 0;
        const old = activeBurstFx[idx];
        if (old) {
          flushPendingSkyRainDrops(old);
          burstFxGroup.remove(old.group);
          for (const m of old.materials) m.dispose();
          activeBurstFx.splice(idx, 1);
        }
      }

      const group = new THREE.Group();
      const materials: THREE.Material[] = [];

      if (kind === 'projectile_tracer') {
        const subtype = vfxSubtype ?? 'bullet';
        const boltColor = colorHex || '#fde047';
        const boltMat = new THREE.MeshBasicMaterial({
          color: subtype === 'bomb' ? '#334155' : boltColor,
          transparent: true,
          opacity: 0.96,
        });
        const coreMat = new THREE.MeshBasicMaterial({
          color: subtype === 'bomb' ? '#ff9e00' : subtype === 'plasma_beam' || subtype === 'laser_beam' ? '#ecfeff' : '#ffffff',
          transparent: true,
          opacity: 0.94,
        });
        const ringMat = new THREE.MeshBasicMaterial({
          color: subtype === 'bomb' ? '#ff6b35' : boltColor,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(boltMat, coreMat, ringMat);

        const startY = subtype === 'bomb' ? oy : oy + 0.45;
        const endY = ty + 0.35;
        let tracerObj: THREE.Object3D;
        let muzzleRingMesh: THREE.Mesh | undefined;

        if (subtype === 'bomb') {
          const bombGrp = new THREE.Group();
          const casing = new THREE.Mesh(sharedBombBodyGeo, boltMat);
          const finCross = new THREE.Mesh(sharedBombFinGeo, coreMat);
          finCross.position.z = -0.22;
          const tailGlow = new THREE.Mesh(sharedPlasmaMuzzleGeo, ringMat);
          tailGlow.scale.setScalar(0.55);
          tailGlow.position.z = -0.34;
          bombGrp.add(casing, finCross, tailGlow);
          bombGrp.position.set(ox, startY, oz);
          bombGrp.lookAt(tx, endY, tz);
          tracerObj = bombGrp;
        } else if (subtype === 'cannon_shell') {
          const shellGrp = new THREE.Group();
          const shell = new THREE.Mesh(sharedShellGeo, boltMat);
          const glowHalo = new THREE.Mesh(sharedShellHaloGeo, coreMat);
          const wakeCone = new THREE.Mesh(sharedMissilePlumeGeo, ringMat);
          wakeCone.position.z = -0.32;
          shellGrp.add(shell, glowHalo, wakeCone);
          shellGrp.position.set(ox, startY, oz);
          shellGrp.lookAt(tx, endY, tz);
          tracerObj = shellGrp;
          muzzleRingMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
          muzzleRingMesh.position.set(ox, startY, oz);
          muzzleRingMesh.scale.setScalar(0.24);
          group.add(muzzleRingMesh);
          spawnParticleBurst(ox, startY, oz, 7, '#e2e8f0', 0.42, 2.6, 0.7);
        } else if (subtype === 'missile') {
          const misGrp = new THREE.Group();
          const body = new THREE.Mesh(sharedMissileGeo, coreMat);
          const warhead = new THREE.Mesh(sharedMissileWarheadGeo, boltMat);
          warhead.position.z = 0.34;
          const fins = new THREE.Mesh(sharedBombFinGeo, boltMat);
          fins.scale.setScalar(0.65);
          fins.position.z = -0.24;
          const exhaust = new THREE.Mesh(sharedMissilePlumeGeo, ringMat);
          exhaust.position.z = -0.45;
          misGrp.add(body, warhead, fins, exhaust);
          misGrp.position.set(ox, startY, oz);
          misGrp.lookAt(tx, endY, tz);
          tracerObj = misGrp;
          spawnParticleBurst(ox, startY, oz, 5, '#fed7aa', 0.3, 2.0, 0.5);
        } else if (subtype === 'arcane_bolt') {
          const arcGrp = new THREE.Group();
          const crystal = new THREE.Mesh(sharedArcaneBoltGeo, boltMat);
          const auraA = new THREE.Mesh(sharedArcaneRingGeo, coreMat);
          const auraB = new THREE.Mesh(sharedArcaneRingGeo, ringMat);
          auraB.rotation.x = Math.PI / 2;
          arcGrp.add(crystal, auraA, auraB);
          arcGrp.position.set(ox, startY, oz);
          arcGrp.lookAt(tx, endY, tz);
          tracerObj = arcGrp;
        } else if (subtype === 'plasma_beam' || subtype === 'laser_beam') {
          const beamDist = Math.max(0.5, Math.hypot(tx - ox, endY - startY, tz - oz));
          const beamWidthMult = subtype === 'laser_beam' ? (radius >= 2.2 ? 3.2 : 1.45) : 1.65;
          const beamGrp = new THREE.Group();
          const outerBeam = new THREE.Mesh(sharedPlasmaBeamGeo, boltMat);
          outerBeam.scale.set(beamWidthMult, beamWidthMult, beamDist);
          const innerBeam = new THREE.Mesh(sharedPlasmaBeamGeo, coreMat);
          innerBeam.scale.set(beamWidthMult * 0.48, beamWidthMult * 0.48, beamDist);
          const muzzleStar = new THREE.Mesh(sharedPlasmaMuzzleGeo, coreMat);
          muzzleStar.position.z = -beamDist * 0.48;
          const tipStar = new THREE.Mesh(sharedPlasmaMuzzleGeo, ringMat);
          tipStar.scale.setScalar(subtype === 'laser_beam' && radius >= 2.2 ? 2.1 : 1.35);
          tipStar.position.z = beamDist * 0.48;
          beamGrp.add(outerBeam, innerBeam, muzzleStar, tipStar);
          beamGrp.position.set((ox + tx) * 0.5, (startY + endY) * 0.5, (oz + tz) * 0.5);
          beamGrp.lookAt(tx, endY, tz);
          tracerObj = beamGrp;
        } else {
          const bulletGrp = new THREE.Group();
          const outerSlug = new THREE.Mesh(sharedTracerGeo, boltMat);
          const innerCore = new THREE.Mesh(sharedBulletCoreGeo, coreMat);
          bulletGrp.add(outerSlug, innerCore);
          bulletGrp.position.set(ox, startY, oz);
          bulletGrp.lookAt(tx, endY, tz);
          tracerObj = bulletGrp;
          muzzleRingMesh = new THREE.Mesh(sharedHazRingGeo, coreMat);
          muzzleRingMesh.position.set(ox, startY, oz);
          muzzleRingMesh.scale.setScalar(0.16);
          group.add(muzzleRingMesh);
          spawnParticleBurst(ox, startY, oz, 4, '#fef08a', 0.22, 2.2, 0.48);
        }

        group.add(tracerObj);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
        ringMesh.position.set(tx, ty + 0.14, tz);
        ringMesh.scale.setScalar(subtype === 'bomb' ? 0.28 : 0.18);
        group.add(ringMesh);

        if (subtype === 'plasma_beam' || subtype === 'laser_beam') {
          spawnParticleBurst(tx, ty + 0.35, tz, radius >= 2.2 ? 32 : 18, boltColor || '#56cfe1', radius >= 2.2 ? 1.45 : 0.8, 5.2, 0.96);
          spawnParticleBurst(tx, ty + 0.4, tz, 10, '#ffffff', 0.5, 5.8, 0.65);
        } else if (subtype !== 'bomb' && subtype !== 'cannon_shell') {
          spawnParticleBurst(tx, ty + 0.35, tz, 10, boltColor, 0.5, 3.6, 0.78);
        }

        const dur =
          subtype === 'bomb'
            ? 0.44
            : subtype === 'cannon_shell'
              ? 0.36
              : subtype === 'missile'
                ? 0.32
                : subtype === 'arcane_bolt'
                  ? 0.27
                  : subtype === 'laser_beam'
                    ? 0.34
                    : subtype === 'plasma_beam'
                      ? 0.25
                      : 0.2;

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'projectile_tracer',
          vfxSubtype: subtype,
          powerType: kind,
          group,
          materials,
          age: 0,
          duration: dur,
          impactDelay: dur * 0.62,
          deferImpact: false,
          tx,
          ty: endY,
          tz,
          ox,
          oy: startY,
          oz,
          radius: Math.max(0.55, radius),
          impactFired: false,
          tracerMesh: tracerObj,
          ringMesh,
          muzzleRingMesh,
          colorHex,
        });
        return;
      }

      if (kind === 'nuke_blast') {
        const flashMat = new THREE.MeshBasicMaterial({
          color: 0xfffbeb,
          transparent: true,
          opacity: 0.98,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const stemMat = new THREE.MeshBasicMaterial({
          color: 0xf97316,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        });
        const capMat = new THREE.MeshBasicMaterial({
          color: 0xff5400,
          transparent: true,
          opacity: 0.94,
          depthWrite: false,
        });
        const torusMat = new THREE.MeshBasicMaterial({
          color: 0xfde047,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
        });
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xfacc15,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const outerRingMat = new THREE.MeshBasicMaterial({
          color: 0xdc2626,
          transparent: true,
          opacity: 0.88,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(flashMat, stemMat, capMat, torusMat, ringMat, outerRingMat);

        const innerDomeMesh = new THREE.Mesh(sharedExplosionDomeGeo, flashMat);
        innerDomeMesh.position.set(tx, ty + 0.12, tz);
        group.add(innerDomeMesh);

        const stemMesh = new THREE.Mesh(sharedNukeStemGeo, stemMat);
        stemMesh.position.set(tx, ty + 0.1, tz);
        stemMesh.scale.set(0.65, 0.25, 0.65);
        group.add(stemMesh);

        const capMesh = new THREE.Mesh(sharedNukeCapGeo, capMat);
        capMesh.position.set(tx, ty + 0.7, tz);
        capMesh.scale.set(0.95, 0.55, 0.95);
        group.add(capMesh);

        const torusCapMesh = new THREE.Mesh(sharedNukeTorusGeo, torusMat);
        torusCapMesh.position.set(tx, ty + 0.7, tz);
        torusCapMesh.scale.setScalar(0.9);
        group.add(torusCapMesh);

        const ringMesh = new THREE.Mesh(sharedHazRingGeo, ringMat);
        ringMesh.position.set(tx, ty + 0.16, tz);
        group.add(ringMesh);

        const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, outerRingMat);
        outerRingMesh.position.set(tx, ty + 0.2, tz);
        group.add(outerRingMesh);

        triggerLightFlash(tx, ty + 3.2, tz, '#ff922b', 46);
        soundEngine.playMegaExplosion();
        trauma = Math.min(1.0, trauma + 0.58);
        spawnParticleBurst(tx, ty + 0.6, tz, 82, '#ff6d00', radius * 1.2, 10.8, 1.7);
        spawnParticleBurst(tx, ty + 0.8, tz, 50, '#fef08a', radius * 0.9, 12.6, 1.4);

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'nuke_blast',
          powerType: kind,
          group,
          materials,
          age: 0,
          duration: 2.25,
          impactDelay: 0,
          deferImpact: false,
          tx,
          ty,
          tz,
          radius: Math.max(2.6, radius),
          impactFired: true,
          innerDomeMesh,
          stemMesh,
          capMesh,
          torusCapMesh,
          ringMesh,
          outerRingMesh,
          colorHex,
        });
        return;
      }

      if (kind === 'arcane_cataclysm') {
        // Phase 1: Unidirectional top-facing ground & sky Magic Circles + 6 converging Rune Pillars
        // Phase 2: Colossal sky-splitting Magic Beam + prism dome obliteration
        const circleMat = createMagicCircleMat('arcane_cataclysm', 0.96, 223);
        const runeMat = createMagicCircleMat('arcane_cataclysm', 0.92, 251);
        const skyMat = createMagicCircleMat('arcane_cataclysm', 0.94, 277);
        const pillarMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.95,
        });
        const beamCoreMat = new THREE.MeshBasicMaterial({
          color: 0xf0fdff,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const beamAuraMat = new THREE.MeshBasicMaterial({
          color: 0xa855f7,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const domeMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materials.push(
          circleMat,
          runeMat,
          skyMat,
          pillarMat,
          beamCoreMat,
          beamAuraMat,
          domeMat,
        );

        const effRadius = Math.max(2.8, radius);

        // Ground primary magic circle & inscribed inner runic circle
        const ringMesh = new THREE.Mesh(sharedMagicCircleGeo, circleMat);
        ringMesh.position.set(tx, ty + 0.18, tz);
        ringMesh.scale.setScalar(0.4);
        group.add(ringMesh);

        const thirdRingMesh = new THREE.Mesh(sharedMagicCircleGeo, runeMat);
        thirdRingMesh.position.set(tx, ty + 0.24, tz);
        thirdRingMesh.scale.setScalar(0.35);
        group.add(thirdRingMesh);

        // Elevated Sky Magic Circle descending overhead before firing the beam
        const skyCircleMesh = new THREE.Mesh(sharedMagicCircleGeo, skyMat);
        skyCircleMesh.position.set(tx, ty + 6.8, tz);
        skyCircleMesh.scale.setScalar(0.45);
        group.add(skyCircleMesh);

        const outerRingMesh = new THREE.Mesh(sharedMagicCircleGeo, runeMat);
        outerRingMesh.position.set(tx, ty + 0.16, tz);
        outerRingMesh.scale.setScalar(0.3);
        group.add(outerRingMesh);

        // 6 Orbiting glowing Rune Pillars around the perimeter
        const runePillars: THREE.Mesh[] = [];
        for (let rp = 0; rp < 6; rp++) {
          const angle = (rp / 6) * Math.PI * 2;
          const pillar = new THREE.Mesh(sharedRunePillarGeo, pillarMat);
          pillar.position.set(
            tx + Math.cos(angle) * effRadius * 0.9,
            ty + 0.85,
            tz + Math.sin(angle) * effRadius * 0.9,
          );
          group.add(pillar);
          runePillars.push(pillar);
        }

        // Phase 2 Colossal Celestial Beam + Prism Dome + Spire
        const beamCoreMesh = new THREE.Mesh(sharedBeamColGeo, beamCoreMat);
        beamCoreMesh.position.set(tx, ty + 0.1, tz);
        beamCoreMesh.scale.set(0.01, 0.01, 0.01);
        group.add(beamCoreMesh);

        const beamAuraMesh = new THREE.Mesh(sharedBeamColGeo, beamAuraMat);
        beamAuraMesh.position.set(tx, ty + 0.1, tz);
        beamAuraMesh.scale.set(0.01, 0.01, 0.01);
        group.add(beamAuraMesh);

        const stemMesh = new THREE.Mesh(sharedArcaneSpireGeo, beamAuraMat);
        stemMesh.position.set(tx, ty + 0.1, tz);
        stemMesh.scale.set(0.01, 0.01, 0.01);
        group.add(stemMesh);

        const explosionDome = new THREE.Mesh(sharedExplosionDomeGeo, domeMat);
        explosionDome.position.set(tx, ty + 0.12, tz);
        explosionDome.scale.setScalar(0.01);
        group.add(explosionDome);

        triggerLightFlash(tx, ty + 2.4, tz, '#5eead4', 24);
        soundEngine.playBlessing();
        spawnRisingParticles(tx, ty + 0.2, tz, 28, '#c084fc', effRadius * 0.95, 4.5, 0.8, 1.0);

        burstFxGroup.add(group);
        activeBurstFx.push({
          kind: 'arcane_cataclysm',
          powerType: kind,
          group,
          materials,
          age: 0,
          duration: 2.35,
          impactDelay: 2.35 * 0.42,
          deferImpact: false,
          tx,
          ty,
          tz,
          radius: effRadius,
          impactFired: false,
          ringMesh,
          outerRingMesh,
          thirdRingMesh,
          skyCircleMesh,
          runePillars,
          beamCoreMesh,
          beamAuraMesh,
          stemMesh,
          explosionDome,
          colorHex,
        });
        return;
      }

      // battlewill_slash: titanic diagonal sword slash arc able to cleave mountains & shear forests
      const arcMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.96,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const goldMat = new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.98,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const fissureMat = new THREE.MeshBasicMaterial({
        color: 0xff6b35,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      materials.push(arcMat, goldMat, fissureMat);

      const slashBaseYaw = Math.atan2(tx - ox, tz - oz);
      const effSlashR = Math.max(3.6, radius * 1.15);
      const slashMeshes: THREE.Mesh[] = [];

      // Huge molten blade edge + wide crimson crescent wake tilted into a colossal sword cleave plane
      const outerArc = new THREE.Mesh(sharedBattlewillCrescentGeo, arcMat);
      outerArc.position.set(ox, oy + 1.35, oz);
      outerArc.rotation.set(0.32, slashBaseYaw - 0.9, -0.34);
      outerArc.scale.setScalar(effSlashR);
      group.add(outerArc);
      slashMeshes.push(outerArc);

      const edgeArc = new THREE.Mesh(sharedBattlewillEdgeGeo, goldMat);
      edgeArc.position.set(ox, oy + 1.4, oz);
      edgeArc.rotation.set(0.32, slashBaseYaw - 0.9, -0.34);
      edgeArc.scale.setScalar(effSlashR * 1.04);
      group.add(edgeArc);
      slashMeshes.push(edgeArc);

      const trailArc = new THREE.Mesh(sharedBattlewillCrescentGeo, goldMat);
      trailArc.position.set(ox, oy + 1.25, oz);
      trailArc.rotation.set(-0.22, slashBaseYaw - 1.15, 0.28);
      trailArc.scale.setScalar(effSlashR * 0.82);
      group.add(trailArc);
      slashMeshes.push(trailArc);

      // Ground cleave fissure scar blocks radiating out across target mountain/forest
      const crackMeshes: THREE.Mesh[] = [];
      const dirX = Math.sin(slashBaseYaw);
      const dirZ = Math.cos(slashBaseYaw);
      for (let ci = 0; ci < 5; ci++) {
        const stepDist = 1.1 + ci * 1.35;
        const crack = new THREE.Mesh(sharedFaultCrackGeo, ci % 2 === 0 ? goldMat : fissureMat);
        crack.position.set(ox + dirX * stepDist, ty + 0.22, oz + dirZ * stepDist);
        crack.rotation.y = slashBaseYaw + Math.PI * 0.5 + (ci - 2) * 0.14;
        crack.scale.set(1.3, 1.4, 0.4 + ci * 0.28);
        group.add(crack);
        crackMeshes.push(crack);
      }

      const ringMesh = new THREE.Mesh(sharedHazRingGeo, fissureMat);
      ringMesh.position.set(tx, ty + 0.18, tz);
      group.add(ringMesh);

      const outerRingMesh = new THREE.Mesh(sharedHazRingGeo, goldMat);
      outerRingMesh.position.set(tx, ty + 0.22, tz);
      group.add(outerRingMesh);

      triggerLightFlash(tx, ty + 2.1, tz, '#ef4444', 42);
      soundEngine.playHeavyImpact();
      trauma = Math.min(1.0, trauma + 0.52);
      spawnParticleBurst(tx, ty + 0.65, tz, 68, '#ef4444', effSlashR * 0.85, 10.2, 1.55);
      spawnParticleBurst(tx, ty + 0.85, tz, 44, '#fde047', effSlashR * 0.65, 11.4, 1.3);

      burstFxGroup.add(group);
      activeBurstFx.push({
        kind: 'battlewill_slash',
        powerType: kind,
        group,
        materials,
        age: 0,
        duration: 0.92,
        impactDelay: 0,
        deferImpact: false,
        tx,
        ty,
        tz,
        ox,
        oy,
        oz,
        slashBaseYaw,
        radius: effSlashR,
        impactFired: true,
        slashMeshes,
        crackMeshes,
        ringMesh,
        outerRingMesh,
        colorHex,
      });
    }

    // Camera state
    const camTarget = new THREE.Vector3(gridCenter, 1.2, gridCenter);
    const camDesiredTarget = new THREE.Vector3(gridCenter, 1.2, gridCenter);
    let camYaw = Math.PI / 4; // 45 deg true isometric
    let camDesiredYaw = Math.PI / 4;
    let desiredFrustum =
      propsRef.current.gameState === 'title'
        ? getResponsiveTitleFrustum(getCurrentAspect())
        : getWholeMapFrustum(sim.gridSize);
    let prevGameState: GameLifecycleState = propsRef.current.gameState;
    let wasEventCinematicActive = false;
    let hasPreEventCamera = false;
    let preEventFrustum = desiredFrustum;
    const preEventCamTarget = new THREE.Vector3(gridCenter, 1.2, gridCenter);
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

    let draggedUnitId: string | null = null;
    const _dragPlaneNormal = new THREE.Vector3(0, 1, 0);
    const dragPlane = new THREE.Plane(_dragPlaneNormal, -1.5);
    const _dragIntersectPt = new THREE.Vector3();
    let lastDragWorld = { x: 0, z: 0, time: 0 };
    let dragVelocity = { x: 0, z: 0 };

    let isHoldPainting = false;
    let lastPaintTile: { x: number; z: number } | null = null;
    const paintedStrokeTiles = new Set<string>();
    let lastHoldCastTime = 0;
    let lastHoldCastPos: { x: number; z: number } | null = null;

    const isDragPowerActive = () =>
      propsRef.current.activeTool.kind === 'power' &&
      propsRef.current.activeTool.power === 'drag_entity';

    let renderWidth = 320;
    let renderHeight = 180;
    const _renderSizeOut = { width: 320, height: 180 };
    let currentDynamicPixelScale = computeDynamicPixelScale(
      desiredFrustum,
      simRef.current.gridSize,
      getCurrentAspect(),
      propsRef.current.pixelScale || 2.5,
    );

    const updateSize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      const newAspect = w / h;
      const maxZoomOut = getResponsiveMaxZoomOut(simRef.current.gridSize, newAspect);
      if (propsRef.current.gameState === 'title') {
        desiredFrustum = getResponsiveTitleFrustum(newAspect);
        frustumSize = desiredFrustum;
      } else if (desiredFrustum > maxZoomOut) {
        desiredFrustum = maxZoomOut;
        if (frustumSize > maxZoomOut) frustumSize = maxZoomOut;
      }
      const baseScale = propsRef.current.pixelScale || 2.5;
      currentDynamicPixelScale = computeDynamicPixelScale(
        frustumSize,
        simRef.current.gridSize,
        newAspect,
        baseScale,
      );
      computeDynamicRenderDimensions(
        w,
        h,
        currentDynamicPixelScale,
        window.devicePixelRatio || 1,
        baseScale,
        1.0,
        isSoftwareGl,
        _renderSizeOut,
      );
      renderWidth = _renderSizeOut.width;
      renderHeight = _renderSizeOut.height;

      renderer.setSize(renderWidth, renderHeight, false);
      camera.left = (-frustumSize * newAspect) / 2;
      camera.right = (frustumSize * newAspect) / 2;
      camera.top = frustumSize / 2;
      camera.bottom = -frustumSize / 2;
      camera.updateProjectionMatrix();
    };

    updateSize();
    const resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(container);
    const onOrientationOrViewportChange = () => {
      window.setTimeout(updateSize, 60);
    };
    window.addEventListener('orientationchange', onOrientationOrViewportChange);
    window.visualViewport?.addEventListener('resize', updateSize);

    const updateHoverTile = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);

      if (propsRef.current.activeTool.kind === 'inspect' || isDragPowerActive()) {
        const pickedUnit = pickLivingUnitAtRay(raycaster.ray);
        if (pickedUnit !== hoveredEntityInternal) {
          hoveredEntityInternal = pickedUnit;
          propsRef.current.onHoverEntityChange?.(pickedUnit);
        }
      } else if (hoveredEntityInternal !== null) {
        hoveredEntityInternal = null;
        propsRef.current.onHoverEntityChange?.(null);
      }

      // Analytical 3D Amanatides-Woo DDA voxel raymarch (< 0.05 ms even on 512x512 worlds!)
      const gridHit = raycastWorldGrid(raycaster.ray, ensureWorldGrid(simRef.current), tileRenderY);
      if (gridHit) {
        if (!hoveredTileCoords || hoveredTileCoords.x !== gridHit.x || hoveredTileCoords.z !== gridHit.z) {
          hoveredTileCoords = { x: gridHit.x, z: gridHit.z };
          propsRef.current.onHoverTileChange(hoveredTileCoords);
        }
      } else if (hoveredTileCoords !== null) {
        hoveredTileCoords = null;
        propsRef.current.onHoverTileChange(null);
      }
    };

    const applyHoldStrokeToTile = (tx: number, tz: number, nowMs: number) => {
      const tool = propsRef.current.activeTool;
      if (tool.kind === 'terrain' || tool.kind === 'build') {
        const sx = lastPaintTile ? lastPaintTile.x : tx;
        const sz = lastPaintTile ? lastPaintTile.z : tz;
        let x0 = sx;
        let z0 = sz;
        const dx = Math.abs(tx - sx);
        const dz = Math.abs(tz - sz);
        const stepX = sx < tx ? 1 : -1;
        const stepZ = sz < tz ? 1 : -1;
        let err = dx - dz;
        for (let guard = 0; guard < 128; guard++) {
          const key = `${x0},${z0}`;
          if (!paintedStrokeTiles.has(key)) {
            paintedStrokeTiles.add(key);
            propsRef.current.onTileInteract(x0, z0);
          }
          if (x0 === tx && z0 === tz) break;
          const e2 = 2 * err;
          if (e2 > -dz) {
            err -= dz;
            x0 += stepX;
          }
          if (e2 < dx) {
            err += dx;
            z0 += stepZ;
          }
        }
        lastPaintTile = { x: tx, z: tz };
      } else if (tool.kind === 'spawn' || (tool.kind === 'power' && tool.power !== 'drag_entity')) {
        const isThermalBrush = tool.kind === 'power' && (tool.power === 'freeze_snap' || tool.power === 'heat_wave');
        const minMs = tool.kind === 'spawn' ? 85 : isThermalBrush ? 175 : 145;
        const minDist = tool.kind === 'spawn' ? 0.9 : 1.5;
        const holdRepeatMs = isThermalBrush ? 210 : 260;
        const movedEnough =
          !lastHoldCastPos || Math.hypot(tx - lastHoldCastPos.x, tz - lastHoldCastPos.z) >= minDist;
        if (
          !lastHoldCastPos ||
          (nowMs - lastHoldCastTime >= minMs && movedEnough) ||
          nowMs - lastHoldCastTime >= holdRepeatMs
        ) {
          lastHoldCastTime = nowMs;
          lastHoldCastPos = { x: tx, z: tz };
          propsRef.current.onTileInteract(tx, tz);
        }
      }
    };

    let hoverRaycastTimer = 0;

    // Multi-touch gesture tracking (drag/pan, two-finger pinch zoom & twist rotate)
    const activeTouches = new Map<number, TouchPoint>();
    type TouchGestureMode =
      | 'none'
      | 'one_finger_pending'
      | 'one_finger_pan'
      | 'one_finger_paint'
      | 'one_finger_drag_unit'
      | 'two_finger_transform'
      | 'wait_all_up';
    let touchGestureMode: TouchGestureMode = 'none';
    let oneFingerInfo: {
      pointerId: number;
      startX: number;
      startY: number;
      lastX: number;
      lastY: number;
    } | null = null;
    let twoFingerLast: TwoFingerState | null = null;

    const panCameraByScreenDelta = (dx: number, dy: number, customPanFactor?: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const panFactor =
        customPanFactor ??
        Math.max(
          frustumSize * 0.0022,
          (frustumSize / Math.max(260, rect.height)) * 1.3,
        );
      const forwardX = Math.sin(camYaw);
      const forwardZ = Math.cos(camYaw);
      const rightX = Math.cos(camYaw);
      const rightZ = -Math.sin(camYaw);

      camDesiredTarget.x -= (dx * rightX + dy * forwardX) * panFactor;
      camDesiredTarget.z -= (dx * rightZ + dy * forwardZ) * panFactor;
      camDesiredTarget.x = THREE.MathUtils.clamp(
        camDesiredTarget.x,
        2,
        simRef.current.gridSize - 3,
      );
      camDesiredTarget.z = THREE.MathUtils.clamp(
        camDesiredTarget.z,
        2,
        simRef.current.gridSize - 3,
      );
      if (propsRef.current.followingEntityId) {
        propsRef.current.onBreakFollow?.();
      }
    };

    const getTwoTouchPair = (): [TouchPoint, TouchPoint] | null => {
      if (activeTouches.size < 2) return null;
      const iter = activeTouches.values();
      const first = iter.next().value;
      const second = iter.next().value;
      if (!first || !second) return null;
      return [first, second];
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        activeTouches.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

        // 2+ fingers: switch cleanly into simultaneous pinch zoom + twist rotate + centroid pan
        if (activeTouches.size >= 2) {
          isPointerDragging = false;
          isHoldPainting = false;
          paintedStrokeTiles.clear();
          lastPaintTile = null;
          lastHoldCastPos = null;
          if (draggedUnitId) {
            releaseDragUnit(simRef.current, draggedUnitId, 0, 0);
            draggedUnitId = null;
            dragVelocity = { x: 0, z: 0 };
          }
          oneFingerInfo = null;
          touchGestureMode = 'two_finger_transform';
          const pair = getTwoTouchPair();
          if (pair) {
            twoFingerLast = computeTwoFingerState(pair[0], pair[1]);
          }
          return;
        }

        // Single finger touch start
        const nowMs = performance.now();
        hoverRaycastTimer = nowMs;
        updateHoverTile(e.clientX, e.clientY);

        if (propsRef.current.gameState !== 'playing') {
          touchGestureMode = 'one_finger_pending';
          oneFingerInfo = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            lastX: e.clientX,
            lastY: e.clientY,
          };
          return;
        }

        const shouldOneFingerPan =
          propsRef.current.mobilePanMode ||
          propsRef.current.activeTool.kind === 'inspect' ||
          propsRef.current.brushInputMode === 'tap';

        if (!shouldOneFingerPan && isDragPowerActive()) {
          const picked = hoveredEntityInternal ?? pickLivingUnitAtRay(raycaster.ray);
          if (picked) {
            const grabbed = beginDragUnit(simRef.current, picked);
            if (grabbed) {
              draggedUnitId = grabbed.id;
              const ht = getTileFromArray(simRef.current, grabbed.x, grabbed.z);
              const planeY = (ht ? Math.max(0.25, ht.height * HEIGHT_STEP + 0.25) : 0.6) + 1.55;
              dragPlane.set(_dragPlaneNormal, -planeY);
              lastDragWorld = { x: grabbed.x, z: grabbed.z, time: nowMs };
              dragVelocity = { x: 0, z: 0 };
              touchGestureMode = 'one_finger_drag_unit';
              soundEngine.playGrab();
              propsRef.current.onSyncHud();
              return;
            }
          }
        }

        if (shouldOneFingerPan || isDragPowerActive()) {
          touchGestureMode = 'one_finger_pending';
          oneFingerInfo = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            lastX: e.clientX,
            lastY: e.clientY,
          };
          return;
        }

        // Hold paint/cast mode with Pan disabled -> paint immediately & smoothly
        touchGestureMode = 'one_finger_paint';
        isHoldPainting = true;
        paintedStrokeTiles.clear();
        lastPaintTile = null;
        lastHoldCastPos = null;
        lastHoldCastTime = 0;
        oneFingerInfo = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
        };
        if (hoveredTileCoords) {
          applyHoldStrokeToTile(hoveredTileCoords.x, hoveredTileCoords.z, nowMs);
        }
        return;
      }

      if (e.button === 2 || e.button === 1 || e.shiftKey) {
        isPointerDragging = true;
        dragStartClient = { x: e.clientX, y: e.clientY };
        pointerDownMoved = false;
        return;
      }
      isPointerDragging = false;
      dragStartClient = { x: e.clientX, y: e.clientY };
      pointerDownMoved = false;
      const nowMs = performance.now();
      hoverRaycastTimer = nowMs;
      updateHoverTile(e.clientX, e.clientY);

      if (e.button === 0 && !e.altKey && propsRef.current.gameState === 'playing') {
        if (isDragPowerActive()) {
          const picked = hoveredEntityInternal ?? pickLivingUnitAtRay(raycaster.ray);
          if (picked) {
            const grabbed = beginDragUnit(simRef.current, picked);
            if (grabbed) {
              draggedUnitId = grabbed.id;
              const ht = getTileFromArray(simRef.current, grabbed.x, grabbed.z);
              const planeY = (ht ? Math.max(0.25, ht.height * HEIGHT_STEP + 0.25) : 0.6) + 1.55;
              dragPlane.set(_dragPlaneNormal, -planeY);
              lastDragWorld = { x: grabbed.x, z: grabbed.z, time: nowMs };
              dragVelocity = { x: 0, z: 0 };
              soundEngine.playGrab();
              propsRef.current.onSyncHud();
              return;
            }
          }
        } else if (
          propsRef.current.brushInputMode === 'hold' &&
          propsRef.current.activeTool.kind !== 'inspect'
        ) {
          isHoldPainting = true;
          paintedStrokeTiles.clear();
          lastPaintTile = null;
          lastHoldCastPos = null;
          lastHoldCastTime = 0;
          if (hoveredTileCoords) {
            applyHoldStrokeToTile(hoveredTileCoords.x, hoveredTileCoords.z, nowMs);
          }
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (activeTouches.has(e.pointerId)) {
          activeTouches.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
        }

        if (touchGestureMode === 'two_finger_transform') {
          const pair = getTwoTouchPair();
          if (pair && twoFingerLast) {
            const nextState = computeTwoFingerState(pair[0], pair[1]);
            const rect = renderer.domElement.getBoundingClientRect();
            const maxZoomOut = getResponsiveMaxZoomOut(
              simRef.current.gridSize,
              getCurrentAspect(),
            );
            const delta = computeTwoFingerCameraDelta(
              twoFingerLast,
              nextState,
              desiredFrustum,
              maxZoomOut,
              rect.height || window.innerHeight,
            );
            desiredFrustum = delta.nextFrustum;
            camDesiredYaw += delta.yawDelta;
            if (Math.abs(delta.panScreenDx) > 0.1 || Math.abs(delta.panScreenDy) > 0.1) {
              panCameraByScreenDelta(delta.panScreenDx, delta.panScreenDy, delta.panFactor);
            }
            twoFingerLast = nextState;
          }
          return;
        }

        if (touchGestureMode === 'wait_all_up') {
          return;
        }

        if (touchGestureMode === 'one_finger_drag_unit' && draggedUnitId) {
          const rect = renderer.domElement.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointerNdc, camera);
            if (raycaster.ray.intersectPlane(dragPlane, _dragIntersectPt)) {
              const nowMs = performance.now();
              const dtDrag = Math.max(0.008, (nowMs - lastDragWorld.time) / 1000);
              const gMax = simRef.current.gridSize - 2;
              const nx = THREE.MathUtils.clamp(_dragIntersectPt.x, 1, gMax);
              const nz = THREE.MathUtils.clamp(_dragIntersectPt.z, 1, gMax);
              const vxRaw = (nx - lastDragWorld.x) / dtDrag;
              const vzRaw = (nz - lastDragWorld.z) / dtDrag;
              dragVelocity.x = dragVelocity.x * 0.45 + vxRaw * 0.55;
              dragVelocity.z = dragVelocity.z * 0.45 + vzRaw * 0.55;
              lastDragWorld = { x: nx, z: nz, time: nowMs };
              updateDragUnit(simRef.current, draggedUnitId, nx, nz, 2.8);
            }
          }
          return;
        }

        if (
          (touchGestureMode === 'one_finger_pending' || touchGestureMode === 'one_finger_pan') &&
          oneFingerInfo &&
          e.pointerId === oneFingerInfo.pointerId
        ) {
          const totalDist = Math.hypot(
            e.clientX - oneFingerInfo.startX,
            e.clientY - oneFingerInfo.startY,
          );
          if (touchGestureMode === 'one_finger_pending' && totalDist > 8) {
            touchGestureMode = 'one_finger_pan';
          }
          if (touchGestureMode === 'one_finger_pan') {
            const stepDx = e.clientX - oneFingerInfo.lastX;
            const stepDy = e.clientY - oneFingerInfo.lastY;
            panCameraByScreenDelta(stepDx, stepDy);
          }
          oneFingerInfo.lastX = e.clientX;
          oneFingerInfo.lastY = e.clientY;
          return;
        }

        if (
          touchGestureMode === 'one_finger_paint' &&
          oneFingerInfo &&
          e.pointerId === oneFingerInfo.pointerId
        ) {
          const nowMs = performance.now();
          if (nowMs - hoverRaycastTimer >= 16) {
            hoverRaycastTimer = nowMs;
            updateHoverTile(e.clientX, e.clientY);
            if (
              isHoldPainting &&
              propsRef.current.gameState === 'playing' &&
              hoveredTileCoords
            ) {
              applyHoldStrokeToTile(hoveredTileCoords.x, hoveredTileCoords.z, nowMs);
            }
          }
        }
        return;
      }

      const dx = e.clientX - dragStartClient.x;
      const dy = e.clientY - dragStartClient.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) {
        pointerDownMoved = true;
      }

      if (draggedUnitId) {
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointerNdc, camera);
          if (raycaster.ray.intersectPlane(dragPlane, _dragIntersectPt)) {
            const nowMs = performance.now();
            const dtDrag = Math.max(0.008, (nowMs - lastDragWorld.time) / 1000);
            const gMax = simRef.current.gridSize - 2;
            const nx = THREE.MathUtils.clamp(_dragIntersectPt.x, 1, gMax);
            const nz = THREE.MathUtils.clamp(_dragIntersectPt.z, 1, gMax);
            const vxRaw = (nx - lastDragWorld.x) / dtDrag;
            const vzRaw = (nz - lastDragWorld.z) / dtDrag;
            dragVelocity.x = dragVelocity.x * 0.45 + vxRaw * 0.55;
            dragVelocity.z = dragVelocity.z * 0.45 + vzRaw * 0.55;
            lastDragWorld = { x: nx, z: nz, time: nowMs };
            updateDragUnit(simRef.current, draggedUnitId, nx, nz, 2.8);
          }
        }
        return;
      }

      if (isPointerDragging || (e.buttons === 1 && e.altKey)) {
        panCameraByScreenDelta(dx, dy, frustumSize * 0.0022);
        dragStartClient = { x: e.clientX, y: e.clientY };
        return;
      }

      const nowMs = performance.now();
      const throttleMs = isHoldPainting ? 16 : 32;
      if (nowMs - hoverRaycastTimer >= throttleMs) {
        hoverRaycastTimer = nowMs;
        updateHoverTile(e.clientX, e.clientY);
        if (
          isHoldPainting &&
          (e.buttons & 1) === 1 &&
          propsRef.current.gameState === 'playing' &&
          propsRef.current.brushInputMode === 'hold' &&
          hoveredTileCoords
        ) {
          applyHoldStrokeToTile(hoveredTileCoords.x, hoveredTileCoords.z, nowMs);
        }
      }
    };

    const onPointerLeave = () => {
      if (isHoldPainting) {
        isHoldPainting = false;
        paintedStrokeTiles.clear();
        lastPaintTile = null;
        lastHoldCastPos = null;
      }
      if (hoveredEntityInternal !== null && !draggedUnitId) {
        hoveredEntityInternal = null;
        propsRef.current.onHoverEntityChange?.(null);
      }
      if (hoveredTileCoords !== null) {
        hoveredTileCoords = null;
        propsRef.current.onHoverTileChange(null);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        activeTouches.delete(e.pointerId);

        if (touchGestureMode === 'two_finger_transform') {
          twoFingerLast = null;
          touchGestureMode = activeTouches.size > 0 ? 'wait_all_up' : 'none';
          return;
        }

        if (touchGestureMode === 'wait_all_up') {
          if (activeTouches.size === 0) {
            touchGestureMode = 'none';
            oneFingerInfo = null;
          }
          return;
        }

        if (draggedUnitId) {
          const nowMs = performance.now();
          const timeSinceMove = nowMs - lastDragWorld.time;
          const effVx = timeSinceMove > 90 ? 0 : dragVelocity.x;
          const effVz = timeSinceMove > 90 ? 0 : dragVelocity.z;
          const releaseSpd = Math.hypot(effVx, effVz);
          releaseDragUnit(simRef.current, draggedUnitId, effVx, effVz);
          draggedUnitId = null;
          dragVelocity = { x: 0, z: 0 };
          touchGestureMode = 'none';
          oneFingerInfo = null;
          if (releaseSpd >= 2.0) {
            soundEngine.playThrow();
          }
          propsRef.current.onSyncHud();
          return;
        }

        if (isHoldPainting) {
          isHoldPainting = false;
          paintedStrokeTiles.clear();
          lastPaintTile = null;
          lastHoldCastPos = null;
          touchGestureMode = 'none';
          oneFingerInfo = null;
          return;
        }

        const wasTap =
          e.type === 'pointerup' &&
          touchGestureMode === 'one_finger_pending' &&
          oneFingerInfo &&
          e.pointerId === oneFingerInfo.pointerId &&
          propsRef.current.gameState === 'playing' &&
          !propsRef.current.mobilePanMode;

        touchGestureMode = 'none';
        oneFingerInfo = null;

        if (wasTap) {
          hoverRaycastTimer = performance.now();
          updateHoverTile(e.clientX, e.clientY);
          if (propsRef.current.activeTool.kind === 'inspect') {
            propsRef.current.onSelectEntity?.(hoveredEntityInternal);
          }
          if (hoveredTileCoords && !isDragPowerActive()) {
            propsRef.current.onTileInteract(hoveredTileCoords.x, hoveredTileCoords.z);
          }
        }
        return;
      }

      if (draggedUnitId) {
        const nowMs = performance.now();
        const timeSinceMove = nowMs - lastDragWorld.time;
        const effVx = timeSinceMove > 90 ? 0 : dragVelocity.x;
        const effVz = timeSinceMove > 90 ? 0 : dragVelocity.z;
        const releaseSpd = Math.hypot(effVx, effVz);
        releaseDragUnit(simRef.current, draggedUnitId, effVx, effVz);
        draggedUnitId = null;
        dragVelocity = { x: 0, z: 0 };
        if (releaseSpd >= 2.0) {
          soundEngine.playThrow();
        }
        propsRef.current.onSyncHud();
        return;
      }
      if (isHoldPainting) {
        isHoldPainting = false;
        paintedStrokeTiles.clear();
        lastPaintTile = null;
        lastHoldCastPos = null;
        return;
      }
      if (isPointerDragging) {
        isPointerDragging = false;
        return;
      }
      if (!pointerDownMoved && e.button === 0 && propsRef.current.gameState === 'playing') {
        hoverRaycastTimer = performance.now();
        updateHoverTile(e.clientX, e.clientY);
        if (propsRef.current.activeTool.kind === 'inspect') {
          propsRef.current.onSelectEntity?.(hoveredEntityInternal);
        }
        if (hoveredTileCoords && !isDragPowerActive()) {
          propsRef.current.onTileInteract(hoveredTileCoords.x, hoveredTileCoords.z);
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const maxZoomOut = getResponsiveMaxZoomOut(simRef.current.gridSize, getCurrentAspect());
      // Normalize across pixel (0), line (1 - Firefox/mice), and page (2) wheel modes
      const rawDelta =
        e.deltaMode === 1
          ? e.deltaY * 32
          : e.deltaMode === 2
            ? e.deltaY * 400
            : e.deltaY;
      const clampedDelta = THREE.MathUtils.clamp(rawDelta, -450, 450);
      // Multiplicative/exponential zoom (~24% per standard 100px notch) so close-up and overview zoom feel equally crisp & fast
      const zoomFactor = Math.exp(clampedDelta * 0.0022);
      desiredFrustum = THREE.MathUtils.clamp(desiredFrustum * zoomFactor, 7.5, maxZoomOut);
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
      activeTouches.clear();
      touchGestureMode = 'none';
      oneFingerInfo = null;
      twoFingerLast = null;
      isPointerDragging = false;
      isHoldPainting = false;
      paintedStrokeTiles.clear();
      lastPaintTile = null;
      lastHoldCastPos = null;
      if (draggedUnitId) {
        releaseDragUnit(simRef.current, draggedUnitId, 0, 0);
        draggedUnitId = null;
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    domElem.addEventListener('pointermove', onPointerMove);
    domElem.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
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
    const _bgColor = new THREE.Color('#273345');
    const _targetBgColor = new THREE.Color('#273345');
    const _targetFogColor = new THREE.Color(TIME_OF_DAY_PRESETS.noon.fogColorHex);
    const _targetLightColor = new THREE.Color(0xffdfb0);

    let lastTime = performance.now();
    let hudSyncAccumulator = 0;
    let elapsedTotal = 0;
    let dayNightClock = 0;
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
    const _zoneProjVec = new THREE.Vector3();
    const _kingProjVec = new THREE.Vector3();
    const bldTypeAtCache = new Map<number, string>();
    let lastSyncedSim: SimulationState = sim;
    let lastSyncedEpochIndex = sim.epochIndex;
    let lastSyncedKingdomEpochSig = '';
    let lastSpaceSeed = sim.seed;
    let lastZoneOverlayVersion = -1;
    let syncFrameStamp = 0;
    let lastSyncedBuildingCount = -1;
    let initialMapsPreuploaded = true;
    const activeFireTileIndices: number[] = [];

    let lastPropLodBand = -1;
    let lastPropLodFrustum = -1;
    let lastPropCullMinX = 0;
    let lastPropCullMaxX = 0;
    let lastPropCullMinZ = 0;
    let lastPropCullMaxZ = 0;
    let lastPropCamX = -9999;
    let lastPropCamZ = -9999;
    let lastPropCamYaw = -9999;
    let lastPropFoliageFactor = -1;

    const pushTreeCache = (
      x: number,
      z: number,
      biomeIdx: number,
      variantIdx: number,
      flags: number,
      els: number[],
    ) => {
      if (treeCacheCount >= treeCacheCap) {
        const nextCap = treeCacheCap * 2;
        const nx = new Float32Array(nextCap);
        const nz = new Float32Array(nextCap);
        const nb = new Uint8Array(nextCap);
        const nv = new Uint8Array(nextCap);
        const nf = new Uint8Array(nextCap);
        const nm = new Float32Array(nextCap * 16);
        nx.set(treeCacheX);
        nz.set(treeCacheZ);
        nb.set(treeCacheBiome);
        nv.set(treeCacheVar);
        nf.set(treeCacheFlags);
        nm.set(treeCacheMat);
        treeCacheX = nx;
        treeCacheZ = nz;
        treeCacheBiome = nb;
        treeCacheVar = nv;
        treeCacheFlags = nf;
        treeCacheMat = nm;
        treeCacheCap = nextCap;
      }
      const idx = treeCacheCount++;
      treeCacheX[idx] = x;
      treeCacheZ[idx] = z;
      treeCacheBiome[idx] = biomeIdx;
      treeCacheVar[idx] = variantIdx;
      treeCacheFlags[idx] = flags;
      const off = idx * 16;
      for (let m = 0; m < 16; m++) treeCacheMat[off + m] = els[m];
    };

    const pushPropCache = (
      kind: number,
      variantIdx: number,
      x: number,
      z: number,
      els: number[],
    ) => {
      if (propCacheCount >= propCacheCap) {
        const nextCap = propCacheCap * 2;
        const nx = new Float32Array(nextCap);
        const nz = new Float32Array(nextCap);
        const nk = new Uint8Array(nextCap);
        const nv = new Uint8Array(nextCap);
        const nm = new Float32Array(nextCap * 16);
        nx.set(propCacheX);
        nz.set(propCacheZ);
        nk.set(propCacheKind);
        nv.set(propCacheVar);
        nm.set(propCacheMat);
        propCacheX = nx;
        propCacheZ = nz;
        propCacheKind = nk;
        propCacheVar = nv;
        propCacheMat = nm;
        propCacheCap = nextCap;
      }
      const idx = propCacheCount++;
      propCacheX[idx] = x;
      propCacheZ[idx] = z;
      propCacheKind[idx] = kind;
      propCacheVar[idx] = variantIdx;
      const off = idx * 16;
      for (let m = 0; m < 16; m++) propCacheMat[off + m] = els[m];
    };

    const pushAmbCache = (
      groupIdx: number,
      variantIdx: number,
      tier: number,
      x: number,
      z: number,
      els: number[],
    ) => {
      if (ambCacheCount >= ambCacheCap) {
        const nextCap = ambCacheCap * 2;
        const nx = new Float32Array(nextCap);
        const nz = new Float32Array(nextCap);
        const ng = new Uint8Array(nextCap);
        const nv = new Uint8Array(nextCap);
        const nt = new Uint8Array(nextCap);
        const nm = new Float32Array(nextCap * 16);
        nx.set(ambCacheX);
        nz.set(ambCacheZ);
        ng.set(ambCacheGroup);
        nv.set(ambCacheVar);
        nt.set(ambCacheTier);
        nm.set(ambCacheMat);
        ambCacheX = nx;
        ambCacheZ = nz;
        ambCacheGroup = ng;
        ambCacheVar = nv;
        ambCacheTier = nt;
        ambCacheMat = nm;
        ambCacheCap = nextCap;
      }
      const idx = ambCacheCount++;
      ambCacheX[idx] = x;
      ambCacheZ[idx] = z;
      ambCacheGroup[idx] = groupIdx;
      ambCacheVar[idx] = variantIdx;
      ambCacheTier[idx] = tier;
      const off = idx * 16;
      for (let m = 0; m < 16; m++) ambCacheMat[off + m] = els[m];
    };

    const rebuildVisiblePropsAndLod = () => {
      for (let i = 0; i < propBatches.length; i++) {
        propBatches[i].reset();
      }
      treeImpostors.reset();
      treeBatchShadow.reset();
      treeBatchNoShadow.reset();
      ambBatch.reset();

      // Balanced high-detail LOD bands (paired with exact OBB culling so detail stays crisp further out):
      // 0 (<22): close-up (LOD0 hero / LOD1 companion)
      // 1 (22..40): mid-close (LOD1 hero & inner companion / LOD2 outer — 100% 3D)
      // 2 (40..64): region (LOD2 inner 3D / 2-tri baked impostor outer)
      // 3 (>=64): far & overview (2-tri baked impostors in 1 draw call)
      const lodBand = frustumSize < 22 ? 0 : frustumSize < 40 ? 1 : frustumSize < 64 ? 2 : 3;
      const focusX = camTarget.x;
      const focusZ = camTarget.z;
      const innerR = Math.max(
        8.5,
        frustumSize * (lodBand === 0 ? 0.65 : lodBand === 1 ? 0.58 : 0.45),
      );
      const innerRSq = innerR * innerR;
      const propR = Math.max(14, frustumSize * 0.55);
      const propRSq = propR * propR;

      // Exact camera-oriented 2D bounding box (OBB) eliminates ~75% of off-screen trees
      // that used to leak through the 4 empty diagonal corners of the axis-aligned AABB.
      const obbAspect = getCurrentAspect();
      const obbPad = 6.0;
      const rx = Math.cos(camYaw);
      const rz = -Math.sin(camYaw);
      const fx = Math.sin(camYaw);
      const fz = Math.cos(camYaw);
      const halfW = (frustumSize * obbAspect) * 0.5 + obbPad;
      const halfFFront = frustumSize * 0.82 + 3.0 + obbPad;
      const halfFBack = frustumSize * 0.82 + 7.5 + obbPad;

      const cMinX = worldCullBounds.minX - obbPad;
      const cMaxX = worldCullBounds.maxX + obbPad;
      const cMinZ = worldCullBounds.minZ - obbPad;
      const cMaxZ = worldCullBounds.maxZ + obbPad;
      const useImpostors = treeImpostors.isBaked;

      // 1. Trees (exact OBB cull + high-detail 4-tier LOD in 2 BatchedMesh draw calls + baked 2-tri impostors at far/overview)
      for (let i = 0; i < treeCacheCount; i++) {
        const tx = treeCacheX[i];
        const tz = treeCacheZ[i];
        const dx = tx - focusX;
        const dz = tz - focusZ;
        const projR = dx * rx + dz * rz;
        if (projR < -halfW || projR > halfW) continue;
        const projF = dx * fx + dz * fz;
        if (projF < -halfFBack || projF > halfFFront) continue;

        const flags = treeCacheFlags[i];
        // Hide cramped under-canopy sapling layer (k===2) at overview where overlapping foliage occludes it
        if (lodBand === 3 && (flags & 4) !== 0) continue;

        const charred = flags & 1;
        const isCompanion = (flags & 2) !== 0;

        if (lodBand === 3) {
          if (useImpostors) {
            treeImpostors.pushTreeFromMatrix(charred, treeCacheBiome[i], treeCacheVar[i], treeCacheMat, i * 16);
            continue;
          }
        } else if (lodBand === 2) {
          if (dx * dx + dz * dz > innerRSq && useImpostors) {
            treeImpostors.pushTreeFromMatrix(charred, treeCacheBiome[i], treeCacheVar[i], treeCacheMat, i * 16);
            continue;
          }
        }

        let lod = 3;
        let castShad = !isCompanion;
        if (lodBand === 0) {
          if (dx * dx + dz * dz <= innerRSq) {
            lod = isCompanion ? 1 : 0;
          } else {
            lod = 1;
          }
        } else if (lodBand === 1) {
          if (dx * dx + dz * dz <= innerRSq) {
            lod = 1;
          } else {
            lod = 2;
          }
        } else if (lodBand === 2) {
          lod = dx * dx + dz * dz <= innerRSq ? 2 : 3;
        } else {
          lod = 3;
        }

        const gIdx = treeGeoIdx[charred][lod][treeCacheBiome[i]][treeCacheVar[i]];
        if (castShad) {
          treeBatchShadow.pushFromMatrixArray(gIdx, treeCacheMat, i * 16);
        } else {
          treeBatchNoShadow.pushFromMatrixArray(gIdx, treeCacheMat, i * 16);
        }
      }
      treeImpostors.commit();
      treeBatchShadow.commit();
      treeBatchNoShadow.commit();

      // 2. Resource Props (exact OBB cull + LOD0 close-up, LOD2 mid/region/overview)
      for (let i = 0; i < propCacheCount; i++) {
        const px = propCacheX[i];
        const pz = propCacheZ[i];
        const kind = propCacheKind[i];
        const pad = kind === 9 ? 3.5 : 0; // Atlantis ruins have ~1.7u outer perimeter
        const dx = px - focusX;
        const dz = pz - focusZ;
        const projR = dx * rx + dz * rz;
        if (projR < -halfW - pad || projR > halfW + pad) continue;
        const projF = dx * fx + dz * fz;
        if (projF < -halfFBack - pad || projF > halfFFront + pad) continue;

        let useLod0 = false;
        if (lodBand === 0) {
          useLod0 = true;
        } else if (lodBand === 1) {
          useLod0 = dx * dx + dz * dz <= propRSq;
        }

        const v = propCacheVar[i];
        const bIdx = useLod0 ? propLod0Bucket[kind] : propLod2Bucket[kind];
        const gIdx = (useLod0 ? propLod0GeoIdx : propLod2GeoIdx)[kind][v];
        propBatches[bIdx].pushFromMatrixArray(gIdx, propCacheMat, i * 16);
      }
      for (let i = 0; i < propBatches.length; i++) {
        propBatches[i].commit();
      }

      // 3. Ambient Ground Details (exact OBB cull + 1 single BatchedMesh draw call)
      const factorTier = appliedFoliageFactor < 0.35 ? 0 : appliedFoliageFactor < 0.75 ? 1 : 2;
      const zoomAmbTier = lodBand >= 2 ? 0 : lodBand === 1 ? 1 : 2;
      const allowedAmbTier = Math.min(factorTier, zoomAmbTier);
      for (let i = 0; i < ambCacheCount; i++) {
        if (ambCacheTier[i] > allowedAmbTier) continue;
        const ax = ambCacheX[i];
        const az = ambCacheZ[i];
        const dx = ax - focusX;
        const dz = az - focusZ;
        const projR = dx * rx + dz * rz;
        if (projR < -halfW || projR > halfW) continue;
        const projF = dx * fx + dz * fz;
        if (projF < -halfFBack || projF > halfFFront) continue;
        const gIdx = ambGeoIdx[ambCacheGroup[i]][ambCacheVar[i]];
        ambBatch.pushFromMatrixArray(gIdx, ambCacheMat, i * 16);
      }
      ambBatch.commit();

      propViewDirty = false;
      lastPropLodBand = lodBand;
      lastPropLodFrustum = frustumSize;
      lastPropCullMinX = cMinX;
      lastPropCullMaxX = cMaxX;
      lastPropCullMinZ = cMinZ;
      lastPropCullMaxZ = cMaxZ;
      lastPropCamX = focusX;
      lastPropCamZ = focusZ;
      lastPropCamYaw = camYaw;
      lastPropFoliageFactor = appliedFoliageFactor;
    };

    const computeKingdomEpochSig = (s: SimulationState): string => {
      const ke = s.kingdomEpochs;
      if (!ke) return `${s.epochIndex}`;
      let sig = `${s.epochIndex}|`;
      for (const k in ke) {
        sig += `${k}:${ke[k]},`;
      }
      return sig;
    };

    type ActiveHazardItem = NonNullable<SimulationState['activeHazards']>[number];
    const activeTsunamis: ActiveHazardItem[] = [];
    const activeQuakes: {
      qh: ActiveHazardItem;
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
    }[] = [];

    let lastTileScanTime = -1;
    let lastTileScanPendingY = true;
    let lastPropRebuildTime = -1;
    let pendingPropsSync = false;
    let lastMapTexSyncTime = -1;
    let pendingWaterMapSync = false;
    let pendingTerrainMapSync = false;
    let simSteppedThisFrame = true;

    function syncSceneFromSimulation(simState: SimulationState, dt: number, elapsed: number) {
      syncFrameStamp++;

      const zb = propsRef.current.zoneOverlayBuffers;
      if (zb && zb.version !== lastZoneOverlayVersion) {
        lastZoneOverlayVersion = zb.version;
        oceanFoam.updateZones(zb.colorData, zb.idData, zb.anyActive);
        styledTerrain.updateZones(zb.colorData, zb.idData, zb.anyActive);
        zoneOverlay.updateZones(zb.colorData, zb.idData, zb.anyActive);
      }

      let propsNeedSync = pendingPropsSync;
      let metroNeedsSync = false;
      let terrainMapDirty = false;
      const curKingdomEpochSig = computeKingdomEpochSig(simState);
      if (simState.epochIndex !== lastSyncedEpochIndex || curKingdomEpochSig !== lastSyncedKingdomEpochSig) {
        lastSyncedEpochIndex = simState.epochIndex;
        lastSyncedKingdomEpochSig = curKingdomEpochSig;
        propsNeedSync = true;
        metroNeedsSync = true;
        terrainMapDirty = true;
      }
      if (simState.buildings.length !== lastSyncedBuildingCount) {
        lastSyncedBuildingCount = simState.buildings.length;
        metroNeedsSync = true;
        terrainMapDirty = true;
      }

      const simChanged = simState !== lastSyncedSim;
      let waterMapNeedsSync = simChanged;
      if (simChanged) {
        initialMapsPreuploaded = false;
        lastSyncedSim = simState;
        lastSyncedEpochIndex = simState.epochIndex;
        lastSyncedKingdomEpochSig = curKingdomEpochSig;
        lastSyncedBuildingCount = simState.buildings.length;
        propsNeedSync = true;
        metroNeedsSync = true;
        terrainMapDirty = true;
        if (simState.seed !== lastSpaceSeed) {
          lastSpaceSeed = simState.seed;
          pixelSpace.setSeed(lastSpaceSeed);
        }
        tileTerrainCode.fill(-1);
        tileTerrainSig.fill(-1);
        tileMetroSig.fill(-1);
        tileHadHazard.fill(0);
        for (let i = 0; i < simState.tiles.length; i++) {
          const t = simState.tiles[i];
          const isWaterWalkway =
            t.height === 0 &&
            (t.terrain === 'stone_road' || t.terrain === 'rail_track' || t.terrain === 'runway');
          const isSeaIce = t.height === 0 && t.terrain === 'ice';
          const y0 = t.height === 0 ? (isWaterWalkway ? 0.3 : isSeaIce ? 0.21 : 0.12) : t.height * HEIGHT_STEP + 0.25;
          tileCurrentY[i] = y0;
          tileRenderY[i] = y0;
          tileTerrainCode[i] = TERRAIN_TO_CODE[t.terrain] ?? 3;
          tileLastNodeY[i] = -999;
          tilePropSig[i] = -1;
        }
        const refreshedGrid = ensureWorldGrid(simState);
        syncWorldGridFromTiles(refreshedGrid, simState.tiles, true);
        chunkTerrain.rebuildAllSync(refreshedGrid, tileRenderY);
        const newCenter = (simState.gridSize - 1) / 2;
        camDesiredTarget.set(newCenter, 1.2, newCenter);
        camTarget.set(newCenter, 1.2, newCenter);
        desiredFrustum =
          propsRef.current.gameState === 'title'
            ? getResponsiveTitleFrustum(getCurrentAspect())
            : getWholeMapFrustum(simState.gridSize);
      }

      // 1. Collect active terrain-deforming hazards without heap allocations
      activeTsunamis.length = 0;
      let activeQuakeCount = 0;
      const hazardsList = simState.activeHazards;
      if (hazardsList && hazardsList.length > 0) {
        for (let hi = 0; hi < hazardsList.length; hi++) {
          const h = hazardsList[hi];
          if (h.kind === 'tsunami_wave') {
            activeTsunamis.push(h);
          } else if (h.kind === 'earthquake_zone') {
            let minX = h.x - h.radius * 1.25;
            let maxX = h.x + h.radius * 1.25;
            let minZ = h.z - h.radius * 1.25;
            let maxZ = h.z + h.radius * 1.25;
            if (h.faultSegments) {
              for (let si = 0; si < h.faultSegments.length; si++) {
                const seg = h.faultSegments[si];
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
            if (activeQuakeCount < activeQuakes.length) {
              const entry = activeQuakes[activeQuakeCount];
              entry.qh = h;
              entry.minX = minX;
              entry.maxX = maxX;
              entry.minZ = minZ;
              entry.maxZ = maxZ;
            } else {
              activeQuakes.push({ qh: h, minX, maxX, minZ, maxZ });
            }
            activeQuakeCount++;
          }
        }
      }
      const hasTsunamis = activeTsunamis.length > 0;
      const hasQuakes = activeQuakeCount > 0;

      // Single-pass dirty-chunk terrain & prop synchronization against flat WorldGridBuffers.
      // Skip scanning all 65k-262k tiles on interpolated frames where neither a sim tick nor
      // dynamic terrain deformation ran (saves ~75% of full-map CPU scans at 60 FPS).
      const worldGrid = ensureWorldGrid(simState);
      const tiles = simState.tiles;
      const tileCount = tiles.length;

      let anyDynamicTileY = false;
      const shouldScanTiles =
        simChanged ||
        simSteppedThisFrame ||
        lastTileScanPendingY ||
        hasTsunamis ||
        hasQuakes ||
        terrainMapDirty ||
        worldGrid.dirtyChunkCount > 0 ||
        elapsed - lastTileScanTime >= 0.065;

      if (shouldScanTiles) {
        lastTileScanTime = elapsed;
        activeFireTileIndices.length = 0;

      for (let i = 0; i < tileCount; i++) {
        const t = tiles[i];
        const tCode = TERRAIN_CODE[t.terrain] ?? 3;
        const isWaterWalkway =
          t.height === 0 && (tCode === 9 || tCode === 14 || tCode === 21);
        const isSeaIce = t.height === 0 && tCode === 23;
        const crushDip = t.height > 0 && (t.crushedTimer ?? 0) > 0 ? 0.14 : 0;
        let targetTopY =
          t.height === 0
            ? isWaterWalkway
              ? 0.3
              : isSeaIce
                ? 0.21
                : 0.12
            : t.height * HEIGHT_STEP + 0.25 - crushDip;
        let hasHazardEffect = false;

        if (hasTsunamis && t.height <= 2) {
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
              hasHazardEffect = true;
            } else if (curR > 3.8 && t.height === 0) {
              const wakeR = curR * 0.65;
              const diffWake = Math.abs(dist - wakeR);
              if (diffWake < 1.9) {
                const wakeBell = Math.cos((diffWake / 1.9) * (Math.PI * 0.5));
                targetTopY = Math.max(targetTopY, 0.34 + wakeBell * 0.68 * fade);
                hasHazardEffect = true;
              }
            }
          }
        }

        let quakeJoltY = 0;
        if (hasQuakes && t.height > 0) {
          for (let qi = 0; qi < activeQuakeCount; qi++) {
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
              hasHazardEffect = true;
            }
          }
        }

        const prevY = tileCurrentY[i];
        const curY =
          Math.abs(prevY - targetTopY) > 0.001
            ? THREE.MathUtils.damp(prevY, targetTopY, 14, dt)
            : targetTopY;
        tileCurrentY[i] = curY;

        const prevRenderY = tileRenderY[i];
        const renderTopY = curY + quakeJoltY;
        tileRenderY[i] = renderTopY;

        const isCrushedByte = crushDip > 0 ? 1 : 0;
        const gridChanged =
          worldGrid.heightMap[i] !== t.height ||
          worldGrid.terrainCodeMap[i] !== tCode ||
          worldGrid.crushedMask[i] !== isCrushedByte;

        if (gridChanged) {
          worldGrid.heightMap[i] = t.height;
          worldGrid.terrainCodeMap[i] = tCode;
          worldGrid.crushedMask[i] = isCrushedByte;
          worldGrid.terrainVersion++;
          tileTerrainCode[i] = tCode;
          markTileDirty(worldGrid, t.x, t.z);
          waterMapNeedsSync = true;
        } else if (
          Math.abs(renderTopY - prevRenderY) > 0.0005 ||
          quakeJoltY !== 0 ||
          tileHadHazard[i] !== 0
        ) {
          markTileDirty(worldGrid, t.x, t.z);
          anyDynamicTileY = true;
        }
        tileHadHazard[i] = hasHazardEffect || quakeJoltY !== 0 ? 1 : 0;

        if (t.onFireTimer > 0 && t.height > 0 && t.resourceNode !== 'ore_vein') {
          activeFireTileIndices.push(i);
        }

        const terrSig =
          (t.height << 8) |
          (tCode << 2) |
          ((t.farmSettlementId ? 1 : 0) << 1) |
          isCrushedByte;
        if (tileTerrainSig[i] !== terrSig) {
          tileTerrainSig[i] = terrSig;
          terrainMapDirty = true;
        }
        const mSig =
          tCode === 9 || tCode === 14 || tCode === 21 ? (t.height << 5) | tCode : 0;
        if (tileMetroSig[i] !== mSig) {
          tileMetroSig[i] = mSig;
          metroNeedsSync = true;
        }

        if (t.height > 0) {
          const isBurntTree =
            t.burntTree || (t.resourceNode === 'timber_grove' && t.terrain === 'scorched')
              ? 1
              : 0;
          const burntBiomeCode =
            t.burntTreeBiome === 'forest'
              ? 1
              : t.burntTreeBiome === 'meadow'
                ? 2
                : t.burntTreeBiome === 'jungle'
                  ? 3
                  : t.burntTreeBiome === 'taiga'
                    ? 4
                    : t.burntTreeBiome === 'blossom'
                      ? 5
                      : t.burntTreeBiome === 'savanna'
                        ? 6
                        : t.burntTreeBiome === 'swamp'
                          ? 7
                          : t.burntTreeBiome === 'highland'
                            ? 8
                            : 0;
          const sig =
            (burntBiomeCode << 19) |
            (isBurntTree << 18) |
            (t.height << 12) |
            (tCode << 6) |
            ((NODE_CODE[t.resourceNode] ?? 0) << 1) |
            (t.buildingId ? 1 : 0);
          if (tilePropSig[i] !== sig || Math.abs(curY - tileLastNodeY[i]) > 0.002) {
            if (tilePropSig[i] <= 0 && !initialMapsPreuploaded) waterMapNeedsSync = true;
            tilePropSig[i] = sig;
            tileLastNodeY[i] = curY;
            propsNeedSync = true;
          }
        } else {
          const waterNodeCode = NODE_CODE[t.resourceNode] ?? 0;
          const isCoralBleached =
            t.resourceNode === 'coral_reef' &&
            ((t.coralBleachTimer ?? 0) > 0 || t.resourceAmount <= 0)
              ? 1
              : 0;
          const waterFlags =
            (isCoralBleached << 8) |
            (waterNodeCode << 4) |
            ((t.isRiver ? 1 : 0) << 3) |
            ((t.isLake ? 1 : 0) << 2) |
            ((t.buildingId ? 1 : 0) << 1) |
            (tCode === 0 ? 1 : 0);
          const waterSig = -10 - waterFlags;
          if (tilePropSig[i] !== waterSig) {
            tilePropSig[i] = waterSig;
            propsNeedSync = true;
            if (!initialMapsPreuploaded) waterMapNeedsSync = true;
          }
        }
      }
      lastTileScanPendingY = anyDynamicTileY;
      }

      if (initialMapsPreuploaded) {
        initialMapsPreuploaded = false;
      } else {
        if (waterMapNeedsSync) pendingWaterMapSync = true;
        if (terrainMapDirty || waterMapNeedsSync) pendingTerrainMapSync = true;
        const canRunMapTexSync =
          simChanged || lastMapTexSyncTime < 0 || elapsed - lastMapTexSyncTime >= 0.12;
        if (canRunMapTexSync && (pendingWaterMapSync || pendingTerrainMapSync)) {
          lastMapTexSyncTime = elapsed;
          if (pendingWaterMapSync) {
            pendingWaterMapSync = false;
            oceanFoam.updateMap(simState.tiles);
          }
          if (pendingTerrainMapSync) {
            pendingTerrainMapSync = false;
            styledTerrain.updateMap(simState.tiles, simState.buildings, simState.settlementSpecies);
            zoneOverlay.updateMap(simState.tiles);
          }
        }
      }

      // Rebuild only modified 32x32 chunks (sync for instant 1-6 chunk edits, Comlink workers for bulk)
      if (worldGrid.dirtyChunkCount > 0) {
        chunkTerrain.flushDirtyChunks(
          worldGrid,
          anyDynamicTileY || hasTsunamis || hasQuakes ? tileRenderY : null,
          anyDynamicTileY || hasTsunamis || hasQuakes,
        );
      }

      // Debounce routine full-map prop matrix recompositions (~5.5 Hz) while keeping world switches instant
      const runPropsSyncNow =
        propsNeedSync && (simChanged || lastPropRebuildTime < 0 || elapsed - lastPropRebuildTime >= 0.18);
      if (propsNeedSync && !runPropsSyncNow) {
        pendingPropsSync = true;
      }
      if (runPropsSyncNow) {
        pendingPropsSync = false;
        lastPropRebuildTime = elapsed;
        treeCacheCount = 0;
        propCacheCount = 0;
        ambCacheCount = 0;

        for (let i = 0; i < simState.tiles.length; i++) {
          const t = simState.tiles[i];
          if (t.buildingId) continue;
          if (t.height <= 0) {
            if (
              t.resourceNode !== 'coral_reef' &&
              t.resourceNode !== 'scrap_flotsam' &&
              t.resourceNode !== 'atlantis_ruin'
            ) {
              continue;
            }
          }

          const curY =
            t.height <= 0
              ? t.resourceNode === 'coral_reef' || t.resourceNode === 'atlantis_ruin'
                ? tileCurrentY[i]
                : 0.25
              : tileCurrentY[i];
          // Deterministic spatial hash so clusters & rotations are rich and never flicker
          const h = Math.abs(((t.x * 73856093) ^ (t.z * 19349663) ^ (simState.seed * 2654435761)) | 0);
          const isCharredTreeTile =
            Boolean(t.burntTree) || (t.resourceNode === 'timber_grove' && t.terrain === 'scorched');
          if (t.resourceNode === 'timber_grove' || (t.resourceNode === 'none' && t.burntTree)) {
            const biome: TreeBiomeKey = t.burntTreeBiome ?? mapTerrainToTreeBiome(t.terrain);
            const biomeIdx = BIOME_KEY_TO_IDX[biome];
            const poolLen = treeBiomePoolLen[isCharredTreeTile ? 1 : 0][biomeIdx];
            const isDenseBiome =
              biome === 'forest' ||
              biome === 'jungle' ||
              biome === 'taiga' ||
              biome === 'blossom' ||
              biome === 'swamp';

            // Spatial old-growth canopy wave so forest cores soar high while edges have younger trees & saplings
            const canopyWave =
              Math.sin(t.x * 0.27 + t.z * 0.23 + (simState.seed & 255)) * 0.16 +
              Math.cos(t.x * 0.13 - t.z * 0.19) * 0.09;

            const roll = (h >> 12) % 100;
            // Dense forest biomes always weave 2-3 trees per tile into lush interlocking groves; open biomes get 1-2
            const treeCount = isDenseBiome
              ? roll < 52
                ? 3
                : 2
              : roll < 58
                ? 2
                : 1;
            const heroSlot = h % poolLen;
            const baseAng = ((h >> 4) & 7) * (Math.PI / 4);

            for (let k = 0; k < treeCount; k++) {
              const kh = Math.abs((h ^ ((k + 1) * 2654435761) ^ (k * 97531)) | 0);
              const variantIdx =
                k === 0 ? heroSlot : (heroSlot + 1 + (kh % Math.max(1, poolLen - 1))) % poolLen;

              // 16-angle compass 3D rotation + clustered triangular grove spacing so neighboring canopies weave together
              const rotAngle = ((kh >> 2) & 15) * (Math.PI / 8);
              _propQuat.setFromAxisAngle(_propAxisY, rotAngle);

              let ox = (((kh >> 6) & 31) / 31 - 0.5) * 0.24;
              let oz = (((kh >> 11) & 31) / 31 - 0.5) * 0.24;
              if (treeCount >= 2) {
                const ang = baseAng + (k * (Math.PI * 2)) / treeCount + (((kh >> 5) & 7) - 3.5) * 0.12;
                const rad = k === 0 ? 0.16 : k === 1 ? 0.34 : 0.38;
                ox = Math.cos(ang) * rad;
                oz = Math.sin(ang) * rad;
              }
              const wx = t.x + ox;
              const wz = t.z + oz;
              _dummyPos.set(wx, curY, wz);

              // Lush layered canopy heights: tall hero (0.82x..1.38x), medium companion (0.62x..0.94x), young sapling (0.48x..0.68x)
              const sizeTier = (kh >> 16) % 7;
              let scaleY = 0.78 + sizeTier * 0.092 + canopyWave * 0.72;
              let scaleXZ = 0.8 + sizeTier * 0.058 + (((kh >> 20) & 7) - 3.5) * 0.025 + canopyWave * 0.35;
              if (k === 1) {
                scaleY *= 0.72 + ((kh >> 22) & 3) * 0.06;
                scaleXZ *= 0.76 + ((kh >> 24) & 3) * 0.05;
              } else if (k === 2) {
                scaleY *= 0.54 + ((kh >> 22) & 3) * 0.05;
                scaleXZ *= 0.58 + ((kh >> 24) & 3) * 0.04;
              }
              scaleY = Math.max(0.46, Math.min(1.42, scaleY));
              scaleXZ = Math.max(0.52, Math.min(1.24, scaleXZ));

              _propScale.set(scaleXZ, scaleY, scaleXZ);
              _dummyMatrix.compose(_dummyPos, _propQuat, _propScale);
              const flags = (isCharredTreeTile ? 1 : 0) | (k >= 1 ? 2 : 0) | (k === 2 ? 4 : 0);
              pushTreeCache(wx, wz, biomeIdx, variantIdx, flags, _dummyMatrix.elements);
            }
            _propScale.set(1, 1, 1);
            continue;
          }

          const rotStep = (h >> 2) & 3;
          _propQuat.setFromAxisAngle(_propAxisY, rotStep * (Math.PI / 2));
          _dummyPos.set(t.x, curY, t.z);
          if (t.resourceNode === 'coral_reef') {
            const isBleached = (t.coralBleachTimer ?? 0) > 0 || t.resourceAmount <= 0;
            const scaleXZ = (1.28 + ((h >> 4) % 3) * 0.06) * (isBleached ? 0.92 : 1.0);
            _propScale.set(scaleXZ, isBleached ? 0.88 : 1.0, scaleXZ);
          } else {
            _propScale.set(1, 1, 1);
          }
          _dummyMatrix.compose(_dummyPos, _propQuat, _propScale);
          _propScale.set(1, 1, 1);

          if (t.resourceNode === 'coral_reef') {
            const isBleached = (t.coralBleachTimer ?? 0) > 0 || t.resourceAmount <= 0;
            const kind = isBleached ? 7 : 6;
            const len = propKindLens[kind];
            pushPropCache(kind, h % len, t.x, t.z, _dummyMatrix.elements);
          } else if (t.resourceNode === 'scrap_flotsam') {
            pushPropCache(8, h % propKindLens[8], t.x, t.z, _dummyMatrix.elements);
          } else if (t.resourceNode === 'atlantis_ruin') {
            pushPropCache(9, h % propKindLens[9], t.x, t.z, _dummyMatrix.elements);
          } else if (t.resourceNode === 'berry_bush') {
            const farmEpoch = t.farmSettlementId ? getSettlementEpoch(simState, t.farmSettlementId) : 0;
            if (t.farmSettlementId && farmEpoch >= 6) {
              pushPropCache(2, h % propKindLens[2], t.x, t.z, _dummyMatrix.elements);
            } else if (t.farmSettlementId && farmEpoch >= 1) {
              pushPropCache(1, h % propKindLens[1], t.x, t.z, _dummyMatrix.elements);
            } else {
              pushPropCache(0, h % propKindLens[0], t.x, t.z, _dummyMatrix.elements);
            }
          } else if (t.resourceNode === 'stone_outcrop') {
            pushPropCache(3, h % propKindLens[3], t.x, t.z, _dummyMatrix.elements);
          } else if (t.resourceNode === 'ore_vein') {
            pushPropCache(4, h % propKindLens[4], t.x, t.z, _dummyMatrix.elements);
          } else if (t.resourceNode === 'crystal_monolith') {
            pushPropCache(5, h % propKindLens[5], t.x, t.z, _dummyMatrix.elements);
          } else {
            // Ambient multi-object sub-tile details partitioned into Low / Med / Full tiers
            const chance = (h >> 4) % 100;
            let ambGroupIdx = -1;
            let ambThresh = 0;
            if (t.terrain === 'grass' || (t.terrain === 'fertile' && !t.farmSettlementId)) {
              ambThresh = 48;
              ambGroupIdx = 0;
            } else if (t.terrain === 'forest') {
              ambThresh = 60;
              ambGroupIdx = 1;
            } else if (t.terrain === 'sand') {
              ambThresh = 44;
              ambGroupIdx = 2;
            } else if (t.terrain === 'rock') {
              ambThresh = 45;
              ambGroupIdx = 3;
            } else if (t.terrain === 'snow') {
              ambThresh = 42;
              ambGroupIdx = 4;
            } else if (t.terrain === 'savanna') {
              ambThresh = 50;
              ambGroupIdx = 5;
            } else if (t.terrain === 'swamp') {
              ambThresh = 55;
              ambGroupIdx = 6;
            } else if (t.terrain === 'highland') {
              ambThresh = 48;
              ambGroupIdx = 7;
            } else if (t.terrain === 'jungle') {
              ambThresh = 72;
              ambGroupIdx = 8;
            } else if (t.terrain === 'mountain') {
              ambThresh = 62;
              ambGroupIdx = 9;
            } else if (t.terrain === 'taiga') {
              ambThresh = 58;
              ambGroupIdx = 10;
            } else if (t.terrain === 'tundra') {
              ambThresh = 52;
              ambGroupIdx = 11;
            } else if (t.terrain === 'badlands') {
              ambThresh = 58;
              ambGroupIdx = 12;
            } else if (t.terrain === 'blossom') {
              ambThresh = 66;
              ambGroupIdx = 13;
            } else if (t.terrain === 'crystal_field') {
              ambThresh = 64;
              if (chance < ambThresh) {
                _propScale.set(0.62, 0.62, 0.62);
                _dummyMatrix.compose(_dummyPos, _propQuat, _propScale);
                _propScale.set(1, 1, 1);
                pushPropCache(5, (h >> 3) % propKindLens[5], t.x, t.z, _dummyMatrix.elements);
              }
            }

            if (ambGroupIdx >= 0 && chance < ambThresh) {
              const ambTier = chance < ambThresh * 0.22 ? 0 : chance < ambThresh * 0.55 ? 1 : 2;
              const len = ambGroupLens[ambGroupIdx];
              pushAmbCache(ambGroupIdx, h % len, ambTier, t.x, t.z, _dummyMatrix.elements);
            }
          }
        }

        propViewDirty = true;
      }

      const curLodBand = frustumSize < 22 ? 0 : frustumSize < 40 ? 1 : frustumSize < 64 ? 2 : 3;
      const wholeMapVisible =
        worldCullBounds.minX <= 0 &&
        worldCullBounds.maxX >= simState.gridSize - 1 &&
        worldCullBounds.minZ <= 0 &&
        worldCullBounds.maxZ >= simState.gridSize - 1;
      const prevWholeMap =
        lastPropCullMinX <= 0 &&
        lastPropCullMaxX >= simState.gridSize - 1 &&
        lastPropCullMinZ <= 0 &&
        lastPropCullMaxZ >= simState.gridSize - 1;
      const boundsShifted =
        !wholeMapVisible &&
        (worldCullBounds.minX < lastPropCullMinX + 1.0 ||
          worldCullBounds.maxX > lastPropCullMaxX - 1.0 ||
          worldCullBounds.minZ < lastPropCullMinZ + 1.0 ||
          worldCullBounds.maxZ > lastPropCullMaxZ - 1.0 ||
          worldCullBounds.minX - lastPropCullMinX > 16.0 ||
          lastPropCullMaxX - worldCullBounds.maxX > 16.0 ||
          worldCullBounds.minZ - lastPropCullMinZ > 16.0 ||
          lastPropCullMaxZ - worldCullBounds.maxZ > 16.0);
      if (boundsShifted || (wholeMapVisible && !prevWholeMap)) {
        metroNeedsSync = true;
      }
      const frustumDeltaPct =
        Math.abs(frustumSize - lastPropLodFrustum) / Math.max(10, lastPropLodFrustum);
      const radialCamMoved =
        !wholeMapVisible &&
        (Math.abs(camTarget.x - lastPropCamX) > 4.2 ||
          Math.abs(camTarget.z - lastPropCamZ) > 4.2);
      const yawMoved = !wholeMapVisible && Math.abs(camYaw - lastPropCamYaw) > 0.14;

      if (
        propViewDirty ||
        curLodBand !== lastPropLodBand ||
        lastPropFoliageFactor !== appliedFoliageFactor ||
        boundsShifted ||
        yawMoved ||
        (curLodBand < 3 && frustumDeltaPct > 0.22) ||
        radialCamMoved
      ) {
        rebuildVisiblePropsAndLod();
      }

      if (metroNeedsSync) {
        // Rebuild Elevated Metro Viaducts (Epoch 5+) & Dedicated Runway Edge Beacons per settlement epoch
        for (const mInst of allMetroInsts) mInst.count = 0;

        let maxWorldEpoch = simState.epochIndex;
        if (simState.kingdomEpochs) {
          for (const k in simState.kingdomEpochs) {
            const epVal = simState.kingdomEpochs[k];
            if (epVal > maxWorldEpoch) maxWorldEpoch = epVal;
          }
        }

        if (maxWorldEpoch >= 6) {
          metroConcreteMat.color.setHex(0xcbd5e1);
          metroConcreteMat.metalness = 0.28;
          metroConcreteMat.roughness = 0.42;
          metroParapetMat.color.setHex(0x52647a);
          metroRailMat.color.setHex(0x56cfe1);
          metroRailMat.emissive.setHex(0x38bdf8);
          metroRailMat.emissiveIntensity = 0.95;
          skywayDeckMat.color.setHex(0x36475c);
          skywayTrimMat.color.setHex(0x56cfe1);
          skywayTrimMat.emissive.setHex(0x38bdf8);
          skywayTrimMat.emissiveIntensity = 0.95;
        } else {
          metroConcreteMat.color.setHex(0x8d99ae);
          metroConcreteMat.metalness = 0.08;
          metroConcreteMat.roughness = 0.78;
          metroParapetMat.color.setHex(0x5c677d);
          metroRailMat.color.setHex(0xe2e8f0);
          metroRailMat.emissive.setHex(0x000000);
          metroRailMat.emissiveIntensity = 0;
          skywayDeckMat.color.setHex(0x475569);
          skywayTrimMat.color.setHex(0xfbbf24);
          skywayTrimMat.emissive.setHex(0xf59e0b);
          skywayTrimMat.emissiveIntensity = maxWorldEpoch >= 5 ? 0.72 : 0.42;
        }

        const gs = simState.gridSize;
        bldTypeAtCache.clear();
        const settlementAnchors: Array<{ x: number; z: number; epoch: number }> = [];
        const seenAnchorSids = new Map<string, { sx: number; sz: number; n: number; epoch: number }>();
        for (let bi = 0; bi < simState.buildings.length; bi++) {
          const bld = simState.buildings[bi];
          bldTypeAtCache.set(bld.tileZ * gs + bld.tileX, bld.type);
          const sid = bld.settlementId ?? 'city_default';
          let acc = seenAnchorSids.get(sid);
          if (!acc) {
            acc = { sx: 0, sz: 0, n: 0, epoch: getSettlementEpoch(simState, sid) };
            seenAnchorSids.set(sid, acc);
          }
          acc.sx += bld.tileX;
          acc.sz += bld.tileZ;
          acc.n += 1;
        }
        seenAnchorSids.forEach((acc) => {
          settlementAnchors.push({ x: acc.sx / acc.n, z: acc.sz / acc.n, epoch: acc.epoch });
        });

        const getLocalTileEpoch = (tx: number, tz: number): number => {
          if (settlementAnchors.length === 0) return simState.epochIndex;
          let bestDistSq = Infinity;
          let bestEp = simState.epochIndex;
          for (let ai = 0; ai < settlementAnchors.length; ai++) {
            const sa = settlementAnchors[ai];
            const dSq = (sa.x - tx) ** 2 + (sa.z - tz) ** 2;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              bestEp = sa.epoch;
            }
          }
          return bestEp;
        };

        const isRailOrStationAt = (tx: number, tz: number) => {
          if (tx < 0 || tz < 0 || tx >= gs || tz >= gs) return false;
          const tileIdx = tz * gs + tx;
          const tile = simState.tiles[tileIdx];
          if (!tile) return false;
          return tile.terrain === 'rail_track' || bldTypeAtCache.get(tileIdx) === 'rail_station';
        };

        const isElevatedNodeAt = (tx: number, tz: number) => {
          if (tx < 0 || tz < 0 || tx >= gs || tz >= gs) return false;
          if (getLocalTileEpoch(tx, tz) < 5) return false;
          const tileIdx = tz * gs + tx;
          const tile = simState.tiles[tileIdx];
          if (!tile) return false;
          if (tile.terrain === 'rail_track' || bldTypeAtCache.get(tileIdx) === 'rail_station') {
            return true;
          }
          if (tile.terrain === 'stone_road') {
            const ewBridge = isRailOrStationAt(tx - 1, tz) && isRailOrStationAt(tx + 1, tz);
            const nsBridge = isRailOrStationAt(tx, tz - 1) && isRailOrStationAt(tx, tz + 1);
            const seBridge = isRailOrStationAt(tx - 1, tz - 1) && isRailOrStationAt(tx + 1, tz + 1);
            const swBridge = isRailOrStationAt(tx + 1, tz - 1) && isRailOrStationAt(tx - 1, tz + 1);
            return ewBridge || nsBridge || seBridge || swBridge;
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
          const slot = inst.count;
          if (slot >= MAX_METRO_STRIP_INST * 2) return;
          ensureInstancedCapacity(inst, slot + 1, undefined, MAX_METRO_STRIP_INST * 2);
          _dummyPos.set(px, py, pz);
          if (qx !== 0 || qy !== 0 || qz !== 0) {
            _metroEuler.set(qx, qy, qz, 'YXZ');
            _propQuat.setFromEuler(_metroEuler);
          } else {
            _propQuat.identity();
          }
          _dummyScale.set(sx, sy, sz);
          _dummyMatrix.compose(_dummyPos, _propQuat, _dummyScale);
          inst.count = slot + 1;
          inst.setMatrixAt(slot, _dummyMatrix);
        };

        const isSkywayExpressAt = (tx: number, tz: number): boolean => {
          if (getLocalTileEpoch(tx, tz) < 5) return false;
          if (tx < 1 || tz < 1 || tx >= gs - 1 || tz >= gs - 1) return false;
          const idx = tz * gs + tx;
          const tt = simState.tiles[idx];
          if (!tt || tt.terrain !== 'stone_road' || tt.height <= 0) return false;
          const hasEast = simState.tiles[tz * gs + (tx + 1)]?.terrain === 'stone_road';
          const hasWest = simState.tiles[tz * gs + (tx - 1)]?.terrain === 'stone_road';
          const hasSouth = simState.tiles[(tz + 1) * gs + tx]?.terrain === 'stone_road';
          // Clean orthogonal double-wide boulevards only (no diagonal spaghetti webs)
          return (
            (hasEast || hasWest) &&
            hasSouth &&
            simState.tiles[(tz + 1) * gs + (tx + 1)]?.terrain === 'stone_road'
          );
        };

        const elevatedActive = maxWorldEpoch >= 5;
        const skybridgesActive = maxWorldEpoch >= 4;
        const mMinX = Math.max(0, Math.floor(worldCullBounds.minX - 2));
        const mMaxX = Math.min(gs - 1, Math.ceil(worldCullBounds.maxX + 2));
        const mMinZ = Math.max(0, Math.floor(worldCullBounds.minZ - 2));
        const mMaxZ = Math.min(gs - 1, Math.ceil(worldCullBounds.maxZ + 2));
        for (let mz = mMinZ; mz <= mMaxZ; mz++) {
          const mRowOff = mz * gs;
          for (let mx = mMinX; mx <= mMaxX; mx++) {
            const i = mRowOff + mx;
            const t = simState.tiles[i];
          const isWaterWalkway =
            t.height === 0 &&
            (t.terrain === 'stone_road' || t.terrain === 'rail_track' || t.terrain === 'runway');
          if (t.height <= 0 && !isWaterWalkway) continue;
          const curY = tileCurrentY[i];

          // Water walkway support pilings / pontoons under bridges & water causeways
          if (isWaterWalkway) {
            for (const [px, pz] of [
              [-0.42, -0.42],
              [0.42, -0.42],
              [-0.42, 0.42],
              [0.42, 0.42],
            ] as const) {
              pushInst(streetPoleInst, t.x + px, 0.22, t.z + pz, 0, 0, 0, 1.45, 0.24, 1.45);
            }
          }

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

          // Age-dependent street & settlement illumination fixtures along stone_road tiles and plazas
          if (t.terrain === 'stone_road' && !bldTypeAtCache.has(i) && ((t.x * 3 + t.z * 5) & 3) === 0) {
            const ep = getLocalTileEpoch(t.x, t.z);
            const sideSign = ((t.x * 13 + t.z * 7) & 1) === 0 ? 1 : -1;
            const nRoad = t.z > 0 && simState.tiles[(t.z - 1) * gs + t.x]?.terrain === 'stone_road';
            const sRoad = t.z + 1 < gs && simState.tiles[(t.z + 1) * gs + t.x]?.terrain === 'stone_road';
            const wRoad = t.x > 0 && simState.tiles[t.z * gs + (t.x - 1)]?.terrain === 'stone_road';
            const eRoad = t.x + 1 < gs && simState.tiles[t.z * gs + (t.x + 1)]?.terrain === 'stone_road';
            const offX = nRoad || sRoad ? sideSign * 0.34 : 0.18;
            const offZ = nRoad || sRoad ? 0.18 : sideSign * 0.34;
            const fx = t.x + offX;
            const fz = t.z + offZ;

            if (ep === 0) {
              pushInst(streetPoleInst, fx, curY + 0.09, fz, 0, 0, 0, 1.15, 0.18, 1.15);
              pushInst(streetLampHeadInst, fx, curY + 0.21, fz, 0, 0.4, 0, 1.35, 1.5, 1.35);
            } else if (ep <= 2) {
              pushInst(streetPoleInst, fx, curY + 0.17, fz, 0, 0, 0, 1.0, 0.34, 1.0);
              pushInst(streetLampHeadInst, fx, curY + 0.37, fz, 0, 0, 0, 1.15, 1.25, 1.15);
            } else if (ep === 3) {
              pushInst(streetPoleInst, fx, curY + 0.22, fz, 0, 0, 0, 0.9, 0.44, 0.9);
              pushInst(streetLampHeadInst, fx, curY + 0.47, fz, 0, 0, 0, 1.1, 1.35, 1.1);
            } else if (ep <= 5) {
              pushInst(streetPoleInst, fx, curY + 0.28, fz, 0, 0, 0, 0.82, 0.56, 0.82);
              const armInX = fx - Math.sign(offX || 1) * 0.07;
              const armInZ = fz - Math.sign(offZ || 1) * 0.07;
              pushInst(streetLampHeadInst, armInX, curY + 0.58, armInZ, 0, 0, 0, 1.45, 0.72, 1.45);
            } else {
              pushInst(streetPoleInst, fx, curY + 0.25, fz, 0, 0, 0, 0.88, 0.5, 0.88);
              pushInst(streetLampHeadInst, fx, curY + 0.53, fz, 0, 0.78, 0, 1.15, 1.65, 1.15);
            }

            // 3D Times Square / Tokyo LED Roadside & Plaza Gantry Billboards in Epochs 4+
            const roadLinks = (nRoad ? 1 : 0) + (sRoad ? 1 : 0) + (wRoad ? 1 : 0) + (eRoad ? 1 : 0);
            if (ep >= 4 && roadLinks >= 2 && ((t.x * 7 + t.z * 11) % 3) === 0 && !isWaterWalkway) {
              const bYaw = roadLinks >= 3 ? Math.PI / 4 : nRoad || sRoad ? 0 : Math.PI / 2;
              const bx = t.x + (nRoad || sRoad ? -sideSign * 0.36 : 0);
              const bz = t.z + (nRoad || sRoad ? 0 : -sideSign * 0.36);
              pushInst(streetPoleInst, bx, curY + 0.32, bz, 0, 0, 0, 1.25, 0.64, 1.25);
              pushInst(billboardFrameInst, bx, curY + 0.68, bz, 0, bYaw, 0, 1, 1, 1);
              const screenPick = (t.x + t.z * 3) % 3;
              const screenInst =
                screenPick === 0 ? billboardCyanInst : screenPick === 1 ? billboardPinkInst : billboardGoldInst;
              pushInst(screenInst, bx, curY + 0.68, bz, 0, bYaw, 0, 1, 1, 1);
            }
          }

          // 3D Urban Skybridges (linking level facing high-rises across streets in Atomic Age 4+) & Orthogonal Elevated Skyways (Epoch 5+)
          if (skybridgesActive && t.terrain === 'stone_road' && !bldTypeAtCache.has(i) && !isElevatedNodeAt(t.x, t.z)) {
            const hasBldN = t.z > 0 && bldTypeAtCache.has((t.z - 1) * gs + t.x);
            const hasBldS = t.z + 1 < gs && bldTypeAtCache.has((t.z + 1) * gs + t.x);
            const hasBldW = t.x > 0 && bldTypeAtCache.has(t.z * gs + (t.x - 1));
            const hasBldE = t.x + 1 < gs && bldTypeAtCache.has(t.z * gs + (t.x + 1));
            if (hasBldN && hasBldS && ((t.x + t.z) & 1) === 0) {
              const yN = tileCurrentY[(t.z - 1) * gs + t.x];
              const yS = tileCurrentY[(t.z + 1) * gs + t.x];
              if (Math.abs(yN - yS) < 0.25 && Math.abs(yN - curY) < 0.25) {
                pushInst(skywayDeckInst, t.x, curY + 0.56, t.z, 0, 0, 0, 0.55, 1.0, 1.02);
                pushInst(skywayTrimInst, t.x - 0.12, curY + 0.61, t.z, 0, 0, 0, 1.0, 1.0, 1.02);
                pushInst(skywayTrimInst, t.x + 0.12, curY + 0.61, t.z, 0, 0, 0, 1.0, 1.0, 1.02);
              }
            } else if (hasBldW && hasBldE && ((t.x + t.z) & 1) === 0) {
              const yW = tileCurrentY[t.z * gs + (t.x - 1)];
              const yE = tileCurrentY[t.z * gs + (t.x + 1)];
              if (Math.abs(yW - yE) < 0.25 && Math.abs(yW - curY) < 0.25) {
                pushInst(skywayDeckInst, t.x, curY + 0.56, t.z, 0, Math.PI / 2, 0, 0.55, 1.0, 1.02);
                pushInst(skywayTrimInst, t.x, curY + 0.61, t.z - 0.12, 0, Math.PI / 2, 0, 1.0, 1.0, 1.02);
                pushInst(skywayTrimInst, t.x, curY + 0.61, t.z + 0.12, 0, Math.PI / 2, 0, 1.0, 1.0, 1.02);
              }
            }

            if (isSkywayExpressAt(t.x, t.z)) {
              // Slender overpass pier column & orthogonal elevated Skyway expressway deck segment
              if (((t.x + t.z) & 1) === 0) {
                pushInst(streetPoleInst, t.x, curY + 0.22, t.z, 0, 0, 0, 2.0, 0.44, 2.0);
              }
              const dirs: ReadonlyArray<[number, number]> = [
                [1, 0],
                [0, 1],
              ];
              for (const [dx, dz] of dirs) {
                const nx = t.x + dx;
                const nz = t.z + dz;
                if (!isSkywayExpressAt(nx, nz)) continue;
                const nIdx = nz * gs + nx;
                const nextY = tileCurrentY[nIdx];
                const dy = nextY - curY;
                if (Math.abs(dy) > 0.35) continue;
                const planar = 1.0;
                const spanLen = Math.hypot(planar, dy);
                const yaw = Math.atan2(dx, dz);
                const pitchX = -Math.atan2(dy, planar);
                const midY = (curY + nextY) * 0.5;
                const mx = t.x + dx * 0.5;
                const mz = t.z + dz * 0.5;
                const pxOff = dz * 0.21;
                const pzOff = -dx * 0.21;
                pushInst(skywayDeckInst, mx, midY + 0.46, mz, pitchX, yaw, 0, 1, 1, spanLen);
                pushInst(skywayTrimInst, mx + pxOff, midY + 0.505, mz + pzOff, pitchX, yaw, 0, 1, 1, spanLen);
                pushInst(skywayTrimInst, mx - pxOff, midY + 0.505, mz - pzOff, pitchX, yaw, 0, 1, 1, spanLen);
              }
            }
          }

          if (!elevatedActive) continue;

          const nodeHere = isElevatedNodeAt(t.x, t.z);
          if (!nodeHere) continue;

          const isStationHere = bldTypeAtCache.get(i) === 'rail_station';
          const isRoadBridgeHere = t.terrain === 'stone_road';

          if (t.terrain === 'rail_track' && !isStationHere) {
            pushInst(metroPillarInst, t.x, curY + 0.32, t.z);
            pushInst(metroCapInst, t.x, curY + 0.60, t.z);
          }
          if (t.terrain === 'rail_track' || isRoadBridgeHere) {
            // Rotate hub node by 45 degrees along purely diagonal curved segments
            const hasCard =
              isElevatedNodeAt(t.x + 1, t.z) ||
              isElevatedNodeAt(t.x - 1, t.z) ||
              isElevatedNodeAt(t.x, t.z + 1) ||
              isElevatedNodeAt(t.x, t.z - 1);
            const hubYaw = hasCard ? 0 : Math.PI / 4;
            pushInst(metroDeckHubInst, t.x, curY + 0.68, t.z, 0, hubYaw, 0);
            pushInst(metroRailHubInst, t.x, curY + 0.75, t.z, 0, hubYaw, 0);
          }

          if (t.x + 1 < gs && isElevatedNodeAt(t.x + 1, t.z)) {
            const eastIdx = t.z * gs + (t.x + 1);
            const eastTile = simState.tiles[eastIdx];
            const eastIsRoad = eastTile.terrain === 'stone_road';
            const eastIsStation = bldTypeAtCache.get(eastIdx) === 'rail_station';
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

          if (t.z + 1 < gs && isElevatedNodeAt(t.x, t.z + 1)) {
            const southIdx = (t.z + 1) * gs + t.x;
            const southTile = simState.tiles[southIdx];
            const southIsRoad = southTile.terrain === 'stone_road';
            const southIsStation = bldTypeAtCache.get(southIdx) === 'rail_station';
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

          // Smooth Diagonal Elevated Viaduct Spans (SE & SW) for sweeping curved rail segments
          const diagSteps: ReadonlyArray<[number, number]> = [
            [1, 1],
            [-1, 1],
          ];
          for (const [dx, dz] of diagSteps) {
            const nx = t.x + dx;
            const nz = t.z + dz;
            if (nx < 0 || nx >= gs || nz < 0 || nz >= gs) continue;
            if (!isElevatedNodeAt(nx, nz)) continue;
            // Only bridge diagonally when not redundant with two adjacent L-cardinal elevated nodes
            if (isElevatedNodeAt(t.x + dx, t.z) || isElevatedNodeAt(t.x, t.z + dz)) continue;
            const nIdx = nz * gs + nx;
            const nextTile = simState.tiles[nIdx];
            if (isRoadBridgeHere && nextTile.terrain === 'stone_road') continue;
            const nextY = tileCurrentY[nIdx];
            const dy = nextY - curY;
            const planar = Math.SQRT2;
            const spanLen = Math.hypot(planar, dy);
            const yaw = Math.atan2(dx, dz);
            const slopeX = -Math.atan2(dy, planar);
            const midY = (curY + nextY) * 0.5;
            const mx = t.x + dx * 0.5;
            const mz = t.z + dz * 0.5;
            const perpX = dz / planar;
            const perpZ = -dx / planar;
            pushInst(metroSpanNSInst, mx, midY + 0.68, mz, slopeX, yaw, 0, 1, 1, spanLen);
            pushInst(metroRailNSInst, mx + perpX * 0.14, midY + 0.755, mz + perpZ * 0.14, slopeX, yaw, 0, 1, 1, spanLen);
            pushInst(metroRailNSInst, mx - perpX * 0.14, midY + 0.755, mz - perpZ * 0.14, slopeX, yaw, 0, 1, 1, spanLen);
            pushInst(metroParapetNSInst, mx + perpX * 0.27, midY + 0.76, mz + perpZ * 0.27, slopeX, yaw, 0, 1, 1, spanLen);
            pushInst(metroParapetNSInst, mx - perpX * 0.27, midY + 0.76, mz - perpZ * 0.27, slopeX, yaw, 0, 1, 1, spanLen);
          }
          }
        }

        for (const mInst of allMetroInsts) {
          mInst.visible = mInst.count > 0;
          if (mInst.count > 0) {
            mInst.instanceMatrix.clearUpdateRanges();
            mInst.instanceMatrix.addUpdateRange(0, mInst.count * 16);
            mInst.instanceMatrix.needsUpdate = true;
          }
        }
      }

      const gsBld = simState.gridSize;
      const computeBuildingRotY = (bx: number, bz: number, bType: string) => {
        const tS = bz + 1 < gsBld ? simState.tiles[(bz + 1) * gsBld + bx] : undefined;
        const tE = bx + 1 < gsBld ? simState.tiles[bz * gsBld + (bx + 1)] : undefined;
        const tN = bz - 1 >= 0 ? simState.tiles[(bz - 1) * gsBld + bx] : undefined;
        const tW = bx - 1 >= 0 ? simState.tiles[bz * gsBld + (bx - 1)] : undefined;
        let rotY = ((bx * 19 + bz * 7) & 1) === 0 ? 0 : Math.PI / 2;
        if (bType === 'rail_station') {
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
        return rotY;
      };

      // 2. Sync buildings via lossless THREE.BatchedMesh with 2-tier zoom LOD
      batchedBuildings.setLodLevel(frustumSize >= 46 ? 1 : 0);
      const cullMinX = worldCullBounds.minX;
      const cullMaxX = worldCullBounds.maxX;
      const cullMinZ = worldCullBounds.minZ;
      const cullMaxZ = worldCullBounds.maxZ;

      for (let bi = 0; bi < simState.buildings.length; bi++) {
        const b = simState.buildings[bi];
        const existingEntry = batchedBuildings.getEntry(b.id);
        const bInView = isPointInCullBounds(
          b.tileX,
          b.tileZ,
          worldCullBounds,
          existingEntry ? DESPAWN_CULL_HYSTERESIS : 0,
        );
        if (!bInView) {
          // Leave seenStamp unstamped so pruneUnseen() unrenders & frees off-screen BatchedMesh slots
          continue;
        }

        const tile = simState.tiles[b.tileZ * gsBld + b.tileX];
        const isWaterTile = Boolean(tile && tile.height === 0);
        const groundY = tile
          ? isWaterTile
            ? 0.29 + Math.sin(elapsed * 2.1 + b.tileX * 0.7 + b.tileZ * 0.5) * 0.02
            : Math.max(0.18, tile.height * HEIGHT_STEP + 0.25)
          : 1.0;

        const bSpecies =
          b.species ??
          (b.settlementId ? simState.settlementSpecies?.[b.settlementId] : undefined) ??
          'human';
        const rotY =
          !existingEntry || propsNeedSync
            ? computeBuildingRotY(b.tileX, b.tileZ, b.type)
            : existingEntry.cachedRotY;
        const buildScaleY =
          b.constructionProgress < 100 ? 0.22 + 0.78 * (b.constructionProgress / 100) : 1;
        const variantSeed = b.tileX * 31 + b.tileZ * 17;

        const entry = batchedBuildings.upsertBuilding(
          b.id,
          b.type,
          b.epochLevel,
          bSpecies,
          variantSeed,
          isWaterTile,
          b.tileX,
          groundY,
          b.tileZ,
          rotY,
          buildScaleY,
          true,
          syncFrameStamp,
        );

        for (let fi = 0; fi < entry.flickerFlames.length; fi++) {
          const flame = entry.flickerFlames[fi];
          const s = 0.92 + Math.sin(elapsed * 14 + b.tileX) * 0.14;
          flame.scale.set(s, 0.9 + Math.cos(elapsed * 18) * 0.18, s);
        }
        for (let si = 0; si < entry.spinParts.length; si++) {
          entry.spinParts[si].rotation.y += dt * 1.8;
        }
      }

      if (simState.buildings.length > 0) {
        const primary = simState.buildings[0];
        const pt = simState.tiles[primary.tileZ * gsBld + primary.tileX];
        hearthLight.position.set(
          primary.tileX,
          (pt ? Math.max(0.18, pt.height * HEIGHT_STEP + 0.25) : 1.0) + 1.8,
          primary.tileZ,
        );
      } else {
        hearthLight.position.set(gridCenter, 3.0, gridCenter);
      }

      batchedBuildings.pruneUnseen(syncFrameStamp);

      // 3. Sync units with cached limb/status references, viewport culling & zoom-aware shadow/detail LOD
      const selectedUnitId = propsRef.current.selectedEntityId;
      const hoveredUnitId = propsRef.current.hoveredEntityId ?? hoveredEntityInternal;
      const followingUnitId = propsRef.current.followingEntityId;
      const wantSmallUnitShadow = autoOptDecisions.unitCastShadows && frustumSize < 56;
      const crowdAnimStride = autoOptDecisions.crowdAnimStride;
      const autoOptFrame = autoOptimizer.getFrameCounter();
      let unitShadowCount = 0;
      let visibleUnitsThisFrame = 0;

      for (let ui = 0; ui < simState.units.length; ui++) {
        const u = simState.units[ui];
        let uEntry = unitMeshes.get(u.id);
        const isCameraPinnedUnit =
          u.id === selectedUnitId ||
          u.id === hoveredUnitId ||
          u.id === followingUnitId ||
          Boolean(u.draggedByPlayer);
        const isBossUnit =
          u.role === 'dragon' ||
          u.role === 'leviathan' ||
          u.role === 'alien_walker' ||
          u.role === 'alien_ufo';
        const isProtectedUnit =
          isCameraPinnedUnit ||
          Boolean(u.favorite) ||
          Boolean(u.isKing) ||
          isBossUnit;

        // Embarked or off-screen units are completely unrendered and live purely in simulation data
        if (u.embarkedVehicleId) {
          continue;
        }
        if (!isCameraPinnedUnit) {
          const bossPad = isBossUnit ? 6.0 : 0.0;
          const uPad = uEntry ? bossPad + DESPAWN_CULL_HYSTERESIS : bossPad;
          if (!isPointInCullBounds(u.x, u.z, worldCullBounds, uPad)) {
            continue;
          }
        }
        visibleUnitsThisFrame++;

        const desiredEpoch = u.faction === 'civilization' ? getUnitEpoch(simState, u) : 0;
        const unitSpecies = u.species ?? 'human';
        const unitAgeStage = u.ageStage ?? 'adult';
        if (
          !uEntry ||
          uEntry.epochLevel !== desiredEpoch ||
          uEntry.role !== u.role ||
          uEntry.species !== unitSpecies ||
          uEntry.ageStage !== unitAgeStage
        ) {
          if (uEntry) {
            unitsGroup.remove(uEntry.group);
            disposeEntityGroup(uEntry.group);
          }
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
          const shadowCasters: THREE.Mesh[] = [];
          group.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh && obj.userData?.isUnitShadowCaster) {
              shadowCasters.push(obj as THREE.Mesh);
            }
          });
          unitsGroup.add(group);
          uEntry = {
            group,
            epochLevel: desiredEpoch,
            role: u.role,
            species: unitSpecies,
            ageStage: unitAgeStage,
            bodyPivot: group.getObjectByName('body_pivot'),
            headPivot: group.getObjectByName('head_pivot'),
            jawPivot: group.getObjectByName('jaw_pivot'),
            tailPivot: group.getObjectByName('tail_pivot'),
            wingL: group.getObjectByName('wing_l'),
            wingR: group.getObjectByName('wing_r'),
            wingOuterL: group.getObjectByName('wing_outer_l'),
            wingOuterR: group.getObjectByName('wing_outer_r'),
            fireMaw: group.getObjectByName('fire_maw') as THREE.Mesh | undefined,
            legFL: group.getObjectByName('leg_fl'),
            legFR: group.getObjectByName('leg_fr'),
            legBL: group.getObjectByName('leg_bl'),
            legBR: group.getObjectByName('leg_br'),
            kneeFL: group.getObjectByName('knee_fl'),
            kneeFR: group.getObjectByName('knee_fr'),
            kneeBL: group.getObjectByName('knee_bl'),
            kneeBR: group.getObjectByName('knee_br'),
            legL: group.getObjectByName('leg_l'),
            legR: group.getObjectByName('leg_r'),
            contactShadow: (() => {
              const cs = group.getObjectByName('contact_shadow');
              if (cs) cs.visible = false;
              return cs;
            })(),
            contactShadowScale: group.getObjectByName('contact_shadow')?.scale.x ?? 0,
            heldTool: group.getObjectByName('held_tool'),
            carryBox: group.getObjectByName('carry_box') as THREE.Mesh | undefined,
            statusRing: group.getObjectByName('status_ring') as THREE.Mesh | undefined,
            battlewillAvatar: group.getObjectByName('battlewill_avatar'),
            battlewillSwordPivot: group.getObjectByName('battlewill_sword_pivot'),
            leviathanSilhouette: group.getObjectByName('leviathan_silhouette'),
            leviathanSurfaced: group.getObjectByName('leviathan_surfaced'),
            silHead: group.getObjectByName('sil_head'),
            silSeg0: group.getObjectByName('sil_seg_0'),
            silSeg1: group.getObjectByName('sil_seg_1'),
            silSeg2: group.getObjectByName('sil_seg_2'),
            silTail: group.getObjectByName('sil_tail'),
            silFinL: group.getObjectByName('sil_fin_l'),
            silFinR: group.getObjectByName('sil_fin_r'),
            mandibleL: group.getObjectByName('mandible_l'),
            mandibleR: group.getObjectByName('mandible_r'),
            leviathanTailMid: group.getObjectByName('leviathan_tail_mid'),
            leviathanBeamGroup: group.getObjectByName('leviathan_beam_group'),
            beamShaft: group.getObjectByName('beam_shaft'),
            beamImpact: group.getObjectByName('beam_impact'),
            beamMuzzle: group.getObjectByName('beam_muzzle'),
            leviathanSplashInner: group.getObjectByName('leviathan_splash_inner'),
            leviathanSplashOuter: group.getObjectByName('leviathan_splash_outer'),
            ufoRing: group.getObjectByName('ufo_ring'),
            lastCarryType: '__unset__',
            lastStatusKey: -1,
            shadowCasters,
            lastUnitCastShadow: true,
            seenStamp: syncFrameStamp,
          };
          unitMeshes.set(u.id, uEntry);
        } else {
          uEntry.seenStamp = syncFrameStamp;
        }
        const uGroup = uEntry.group;
        if (!uGroup.visible) uGroup.visible = true;

        // Toggle small humanoid directional shadow-map casting automatically when zoomed out or under dense crowd load
        // (ground contact_shadow disks remain crisp at all zoom distances; giant bosses keep directional shadows)
        const wantUnitShadow =
          u.role === 'dragon' ||
          u.role === 'leviathan' ||
          u.role === 'alien_walker' ||
          u.role === 'alien_ufo'
            ? autoOptDecisions.unitCastShadows
            : wantSmallUnitShadow;
        if (uEntry.shadowCasters.length > 0 && uEntry.lastUnitCastShadow !== wantUnitShadow) {
          uEntry.lastUnitCastShadow = wantUnitShadow;
          for (let sci = 0; sci < uEntry.shadowCasters.length; sci++) {
            uEntry.shadowCasters[sci].castShadow = wantUnitShadow;
          }
        }

        // Toggle Leviathan between submerged silhouette vs surfaced breaching monster
        if (u.role === 'leviathan') {
          const isSubmerged = Boolean(u.leviathanSubmerged);
          const leapTimer = u.leviathanLeapTimer ?? 0;
          const beamTimer = u.leviathanBeamTimer ?? 0;
          // Phase 1 of Breach Jump (leapTimer > 4.0): dives deep beneath the waves for 2.2 seconds
          const isDeepDivePreBreach = leapTimer > 4.0;
          const diveFadeFrac = isDeepDivePreBreach
            ? THREE.MathUtils.clamp((leapTimer - 4.0) / 2.2, 0, 1)
            : 1;

          if (uEntry.leviathanSilhouette) {
            uEntry.leviathanSilhouette.visible = isSubmerged && (!isDeepDivePreBreach || diveFadeFrac > 0.12);
            // Scale down smoothly as it dives into the abyss during the calm 2.2s pre-breach window
            const silScale = isDeepDivePreBreach ? Math.max(0.05, Math.pow(diveFadeFrac, 1.8)) : 1.0;
            uEntry.leviathanSilhouette.scale.setScalar(silScale);
          }
          if (uEntry.leviathanSurfaced) {
            uEntry.leviathanSurfaced.visible = !isSubmerged;
          }

          // Animate terrifying undulating silhouette spine & scythe-fins when hidden
          if (isSubmerged) {
            const wavePhase = elapsed * 2.45 + ((u.appearanceSeed ?? 1) % 17) * 0.5;
            if (uEntry.silHead) {
              uEntry.silHead.position.x = Math.sin(wavePhase) * 0.08;
              uEntry.silHead.rotation.y = Math.cos(wavePhase) * 0.14;
            }
            if (uEntry.silSeg0) {
              uEntry.silSeg0.position.x = Math.sin(wavePhase - 0.85) * 0.14;
              uEntry.silSeg0.rotation.y = Math.cos(wavePhase - 0.85) * 0.18;
            }
            if (uEntry.silSeg1) {
              uEntry.silSeg1.position.x = Math.sin(wavePhase - 1.7) * 0.22;
              uEntry.silSeg1.rotation.y = Math.cos(wavePhase - 1.7) * 0.24;
            }
            if (uEntry.silSeg2) {
              uEntry.silSeg2.position.x = Math.sin(wavePhase - 2.55) * 0.3;
              uEntry.silSeg2.rotation.y = Math.cos(wavePhase - 2.55) * 0.3;
            }
            if (uEntry.silTail) {
              uEntry.silTail.position.x = Math.sin(wavePhase - 3.4) * 0.38;
              uEntry.silTail.rotation.y = Math.cos(wavePhase - 3.4) * 0.42;
            }
            const finSweep = Math.sin(wavePhase * 0.8) * 0.18;
            if (uEntry.silFinL) uEntry.silFinL.rotation.y = 0.25 + finSweep;
            if (uEntry.silFinR) uEntry.silFinR.rotation.y = -0.25 - finSweep;
            if (!isDeepDivePreBreach && Math.random() < 0.18) {
              spawnParticleBurst(u.x, 0.31, u.z, 1, '#0891b2', 0.9, 1.2, 0.55);
            }
          } else {
            // Surfaced ambient & breach water spray
            if (leapTimer > 0 && leapTimer <= 4.0) {
              if (Math.random() < 0.75) {
                spawnParticleBurst(
                  u.x,
                  0.34 + (u.altitude ?? 0) * 0.65,
                  u.z,
                  5,
                  '#e0fbfc',
                  2.4,
                  5.2,
                  0.95,
                );
              }
            } else if (Math.random() < 0.38) {
              spawnParticleBurst(u.x, 0.34, u.z, 3, '#a5f3fc', 2.2, 3.8, 0.78);
            }
          }

          // Pulse surface breach foam rings
          const isAirborneLeap = leapTimer > 0 && leapTimer <= 4.0 && (u.altitude ?? 0) > 0.6;
          if (uEntry.leviathanSplashInner) {
            uEntry.leviathanSplashInner.visible = !isSubmerged && !isAirborneLeap;
            const pulse = 1 + Math.sin(elapsed * 4.5) * 0.12 + (beamTimer > 0 ? 0.22 : 0);
            uEntry.leviathanSplashInner.scale.set(pulse, pulse, 1);
          }
          if (uEntry.leviathanSplashOuter) {
            uEntry.leviathanSplashOuter.visible = !isSubmerged && !isAirborneLeap;
            const pulseOuter = 1 + Math.cos(elapsed * 3.6) * 0.16 + (beamTimer > 0 ? 0.35 : 0);
            uEntry.leviathanSplashOuter.scale.set(pulseOuter, pulseOuter, 1);
          }
        }

        const tx = Math.round(THREE.MathUtils.clamp(u.x, 0, gsBld - 1));
        const tz = Math.round(THREE.MathUtils.clamp(u.z, 0, gsBld - 1));
        const tile = simState.tiles[tz * gsBld + tx];
        const isWaterWalkwayTile =
          tile &&
          tile.height === 0 &&
          (tile.terrain === 'stone_road' ||
            tile.terrain === 'rail_track' ||
            tile.terrain === 'runway' ||
            Boolean(tile.buildingId));
        const isSeaIceTile = tile && tile.height === 0 && tile.terrain === 'ice';
        const groundY = tile
          ? u.role === 'leviathan'
            ? u.leviathanSubmerged
              ? 0.295
              : 0.34
            : u.isSwimming
              ? 0.12 + Math.sin(elapsed * 5.5 + u.x) * 0.035
              : isWaterWalkwayTile
                ? 0.3
                : isSeaIceTile
                  ? 0.21
                  : Math.max(
                      0.18,
                      tile.height * HEIGHT_STEP +
                        0.25 -
                        ((tile.crushedTimer ?? 0) > 0 && tile.height > 0 ? 0.14 : 0),
                    )
          : 0.5;
        if (u.isSwimming && Math.random() < 0.16 * autoOptDecisions.particleScale) {
          spawnParticleBurst(u.x, 0.26, u.z, 1, '#e0fbfc', 0.22, 0.85, 0.32);
        }

        let blackHolePullFrac = 0;
        let blackHoleAngle = 0;
        if (!u.statusEffects.shielded && hazardsList) {
          for (let hi = 0; hi < hazardsList.length; hi++) {
            const hz = hazardsList[hi];
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
        const isLeviathan = u.role === 'leviathan';
        const isAnimal =
          u.role === 'cow' ||
          u.role === 'pig' ||
          u.role === 'chicken' ||
          u.role === 'capybara' ||
          u.role === 'wolf' ||
          u.role === 'bear' ||
          u.role === 'dinosaur' ||
          u.role === 'unicorn' ||
          isLeviathan ||
          isDragon;
        const seedPhase = ((u.appearanceSeed ?? 1) % 31) * 0.41;
        const atkTimer = u.attackAnimTimer ?? 0;
        const atkDur = isDragon ? 0.78 : 0.48;
        const atkProg = atkTimer > 0 ? THREE.MathUtils.clamp(1 - atkTimer / atkDur, 0, 1) : 0;
        const isGrazingAnim = isAnimal && u.state === 'gathering';
        const isAttacking = atkTimer > 0 && u.state !== 'ko' && !isGrazingAnim;
        const isHerbivoreDino =
          u.role === 'dinosaur' && getDinosaurVariant(u.appearanceSeed).diet === 'herbivore';

        const isFrozen = Boolean(u.statusEffects.frozen);
        const simAltitude = u.altitude ?? 0;
        const isAirborneVisual = simAltitude > 0.35 || Boolean(u.draggedByPlayer);

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
        const walkBob =
          isDragon || isLeviathan || u.role === 'alien_walker' || isFrozen || isAirborneVisual
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
          isAttacking && !isFrozen && !isDragon && !isLeviathan && u.role !== 'bear'
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
            : u.role === 'alien_ufo' && u.state !== 'ko'
              ? Math.sin(elapsed * 3.8 + seedPhase) * 0.26
              : 0;
        const levitateY =
          blackHolePullFrac > 0
            ? Math.pow(blackHolePullFrac, 1.3) * 1.65 +
              Math.sin(elapsed * 9 + u.x * 2) * 0.12 * blackHolePullFrac
            : 0;
        const altScale = isLeviathan ? 0.72 : u.role === 'alien_ufo' ? 0.85 : 0.55;
        const airborneAltY =
          blackHolePullFrac > 0
            ? Math.max(simAltitude * altScale, levitateY)
            : simAltitude * altScale;
        let finalUnitY =
          groundY + (walkBob + pounceHopY + targetHoverY) * (1 - blackHolePullFrac) + airborneAltY;
        if (isDragon && u.state !== 'ko' && blackHolePullFrac <= 0 && !u.draggedByPlayer) {
          const prevDragonY =
            typeof uGroup.userData.smoothWorldY === 'number'
              ? uGroup.userData.smoothWorldY
              : finalUnitY;
          finalUnitY = THREE.MathUtils.damp(prevDragonY, finalUnitY, 6.2, dt);
          uGroup.userData.smoothWorldY = finalUnitY;
        }
        const flightHoverY = Math.max(0, finalUnitY - groundY);
        // Smooth 60FPS visual interpolation between decoupled 15Hz simulation ticks
        const interpX =
          !u.draggedByPlayer && u.prevX !== undefined && Math.abs(u.x - u.prevX) < 3.5
            ? u.prevX + (u.x - u.prevX) * simInterpAlpha
            : u.x;
        const interpZ =
          !u.draggedByPlayer && u.prevZ !== undefined && Math.abs(u.z - u.prevZ) < 3.5
            ? u.prevZ + (u.z - u.prevZ) * simInterpAlpha
            : u.z;
        uGroup.position.set(interpX, finalUnitY, interpZ);

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
          const isLeviathanBeamActive = isLeviathan && (u.leviathanBeamTimer ?? 0) > 0;
          const isLeviathanLeapActive = isLeviathan && (u.leviathanLeapTimer ?? 0) > 0;
          const faceX =
            isLeviathanBeamActive && u.leviathanBeamTargetX !== undefined
              ? u.leviathanBeamTargetX
              : isLeviathanLeapActive && u.leviathanLeapTargetX !== undefined
                ? u.leviathanLeapTargetX
                : isAttacking && u.attackTargetX !== undefined
                  ? u.attackTargetX
                  : u.targetX;
          const faceZ =
            isLeviathanBeamActive && u.leviathanBeamTargetZ !== undefined
              ? u.leviathanBeamTargetZ
              : isLeviathanLeapActive && u.leviathanLeapTargetZ !== undefined
                ? u.leviathanLeapTargetZ
                : isAttacking && u.attackTargetZ !== undefined
                  ? u.attackTargetZ
                  : u.targetZ;
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
            const turnRate = isLeviathanBeamActive ? 6.5 : isLeviathan ? 2.8 : 14;
            uGroup.rotation.y = curYaw + yawDiff * Math.min(1, dt * turnRate);
          }
        }

        // Pace secondary tilt/limb/tool micro-animations on dense distant crowds while keeping 60Hz position & facing
        const runMicroAnim =
          isProtectedUnit ||
          isDragon ||
          isLeviathan ||
          u.state === 'ko' ||
          blackHolePullFrac > 0 ||
          isAirborneVisual ||
          crowdAnimStride <= 1 ||
          ((autoOptFrame + ((u.appearanceSeed ?? ui) & 0xff)) % crowdAnimStride === 0);

        if (runMicroAnim) {
        if (u.draggedByPlayer && u.dragTargetX !== undefined && u.dragTargetZ !== undefined) {
          const dragDx = u.dragTargetX - u.x;
          const dragDz = u.dragTargetZ - u.z;
          const tiltAmt = Math.min(0.52, Math.hypot(dragDx, dragDz) * 0.18);
          const dragAngle = Math.atan2(dragDx, dragDz);
          uGroup.rotation.z = Math.sin(dragAngle) * -tiltAmt + Math.sin(elapsed * 9 + seedPhase) * 0.12;
          uGroup.rotation.x = Math.cos(dragAngle) * tiltAmt + Math.cos(elapsed * 7.5 + seedPhase) * 0.1;
          uGroup.scale.setScalar(1.04 + Math.sin(elapsed * 12) * 0.03);
        } else if (u.state === 'ko') {
          uGroup.rotation.z = THREE.MathUtils.damp(uGroup.rotation.z, Math.PI / 2, 12, dt);
          uGroup.rotation.x = 0;
          uGroup.scale.setScalar(1);
        } else if (blackHolePullFrac > 0) {
          uGroup.rotation.z = blackHolePullFrac * 0.92 * Math.sin(elapsed * 7.5 + u.x);
          uGroup.rotation.x = blackHolePullFrac * 0.72 * Math.cos(elapsed * 6.5 + u.z);
          const bhScale = Math.max(0.58, 1 - Math.pow(blackHolePullFrac, 1.8) * 0.38);
          uGroup.scale.setScalar(bhScale);
        } else if (isAirborneVisual && !isDragon && !isLeviathan) {
          uGroup.rotation.z = Math.sin(elapsed * 16 + seedPhase) * 0.44;
          uGroup.rotation.x = Math.cos(elapsed * 13 + seedPhase) * 0.32;
          uGroup.scale.setScalar(1);
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
        } else if (isLeviathan) {
          uGroup.rotation.z = 0;
          const leapTimer = u.leviathanLeapTimer ?? 0;
          if (leapTimer > 0 && leapTimer <= 4.0) {
            // Slow-motion head-first breach arc: bursts upward head-first (-1.32 rad), arches over apex (0 rad), and plunges head-first (+1.32 rad) into the sea
            const airProg = THREE.MathUtils.clamp((4.0 - leapTimer) / 4.0, 0, 1);
            const targetPitch = -(1 - airProg * 2.0) * 1.32;
            uGroup.rotation.x = THREE.MathUtils.damp(uGroup.rotation.x, targetPitch, 9.0, dt);
          } else {
            uGroup.rotation.x = THREE.MathUtils.damp(uGroup.rotation.x, 0, 8.0, dt);
          }
          uGroup.scale.setScalar(1);
        } else if (u.role === 'alien_walker') {
          uGroup.rotation.z = 0;
          uGroup.rotation.x = 0;
          uGroup.scale.setScalar(1);
        } else {
          uGroup.rotation.z = !isFrozen && isMoving
            ? Math.sin(elapsed * bobFreq + seedPhase) * (u.role === 'chicken' ? 0.12 : 0.08)
            : 0;
          uGroup.rotation.x =
            !isFrozen && isWorking && !isAnimal ? Math.sin(elapsed * 16 + u.x) * 0.22 : 0;
          uGroup.scale.setScalar(1);
        }

        const {
          bodyPivot,
          headPivot,
          jawPivot,
          tailPivot,
          wingL,
          wingR,
          wingOuterL,
          wingOuterR,
        } = uEntry;

        if (isAnimal && u.state !== 'ko') {
          if (bodyPivot) {
            let bodyPitch = 0;
            let bodyForward = 0;
            if (isLeviathan) {
              const beamTimer = u.leviathanBeamTimer ?? 0;
              const leapTimer = u.leviathanLeapTimer ?? 0;
              if (beamTimer > 0) {
                // Braced, shuddering recoil posture while firing the 7-second water beam
                bodyPitch = -0.14 + Math.sin(elapsed * 22) * 0.025;
                bodyForward = -0.12 + Math.cos(elapsed * 26) * 0.03;
              } else if (leapTimer > 0 && leapTimer <= 4.0) {
                // Graceful spinal flex during slow-motion breach
                const airProg = THREE.MathUtils.clamp((4.0 - leapTimer) / 4.0, 0, 1);
                bodyPitch = Math.sin(airProg * Math.PI) * -0.18;
              } else if (isAttacking) {
                const s = Math.sin(atkProg * Math.PI);
                bodyPitch = -0.22 * s;
                bodyForward = 0.32 * s;
              } else {
                bodyPitch = Math.sin(elapsed * 2.1 + seedPhase) * 0.04;
              }
            } else if (u.role === 'dinosaur' && (u.dinoRushTimer ?? 0) > 0) {
              // Dinosaur 5-second Special Rush: lowers torso and charges forward like a battering ram
              bodyPitch = 0.22;
              bodyForward = 0.26;
            } else if (isAttacking) {
              const s = Math.sin(atkProg * Math.PI);
              if (u.role === 'bear') {
                bodyPitch = atkProg < 0.45 ? -0.58 * (atkProg / 0.45) : -0.58 + 0.88 * ((atkProg - 0.45) / 0.55);
                bodyForward = atkProg > 0.45 ? 0.24 * Math.sin(((atkProg - 0.45) / 0.55) * Math.PI) : -0.08;
              } else if (u.role === 'unicorn') {
                bodyPitch = -0.34 * s;
                bodyForward = 0.28 * s;
              } else if (u.role === 'dinosaur') {
                bodyPitch = (isHerbivoreDino ? 0.34 : 0.26) * s;
                bodyForward = 0.36 * s;
              } else if (!isDragon) {
                bodyPitch = 0.24 * s;
                bodyForward = (u.role === 'wolf' ? 0.38 : 0.24) * s;
              }
            }
            bodyPivot.rotation.x = bodyPitch;
            bodyPivot.position.z = bodyForward;
            const breath = isMoving || isLeviathan ? 0 : Math.sin(elapsed * 3.4 + seedPhase) * 0.035;
            if (u.role !== 'dinosaur') {
              bodyPivot.scale.y = 1 + breath;
            }
          }

          if (headPivot) {
            if (isLeviathan) {
              const beamTimer = u.leviathanBeamTimer ?? 0;
              if (beamTimer > 0) {
                headPivot.rotation.x = -0.08 + Math.sin(elapsed * 28) * 0.025;
                headPivot.rotation.y = Math.cos(elapsed * 24) * 0.02;
              } else if (isAttacking) {
                headPivot.rotation.x = Math.sin(atkProg * Math.PI) * 0.32;
                headPivot.rotation.y = 0;
              } else {
                headPivot.rotation.x = Math.sin(elapsed * 2.1 + seedPhase) * 0.07;
                headPivot.rotation.y = Math.cos(elapsed * 1.6 + seedPhase) * 0.09;
              }
            } else if (isDragon) {
              const targetHeadX = isDragonStrafing
                ? 0.34
                : Math.sin(elapsed * 2.2 + seedPhase) * 0.08;
              const targetHeadY = isDragonStrafing
                ? 0
                : THREE.MathUtils.clamp(dragonYawDelta * 0.45, -0.28, 0.28) +
                  Math.sin(elapsed * 1.4 + seedPhase) * 0.12;
              headPivot.rotation.x = THREE.MathUtils.damp(headPivot.rotation.x, targetHeadX, 9, dt);
              headPivot.rotation.y = THREE.MathUtils.damp(headPivot.rotation.y, targetHeadY, 8, dt);
            } else if (u.role === 'dinosaur' && (u.dinoRushTimer ?? 0) > 0) {
              // Lowered skull/horns while rushing to headbutt a tree or prey
              headPivot.rotation.x = 0.62;
              headPivot.rotation.y = 0;
            } else if (isAttacking) {
              if (u.role === 'dinosaur' && isHerbivoreDino) {
                // Upward horn/skull headbutt snap at the moment of impact
                headPivot.rotation.x = atkProg < 0.4 ? 0.58 : 0.58 - Math.sin(((atkProg - 0.4) / 0.6) * Math.PI) * 0.92;
              } else {
                headPivot.rotation.x = Math.sin(atkProg * Math.PI) * (u.role === 'chicken' ? 0.65 : u.role === 'dinosaur' ? 0.52 : 0.42);
              }
              headPivot.rotation.y = 0;
            } else if (u.role === 'chicken') {
              const peckCycle = (elapsed * 1.4 + seedPhase) % 3.2;
              const isPecking = !isMoving && peckCycle < 0.7;
              headPivot.rotation.x = isPecking
                ? Math.max(0, Math.sin((peckCycle / 0.7) * Math.PI * 2)) * 0.65
                : isMoving
                  ? Math.sin(elapsed * 17 + seedPhase) * 0.22
                  : 0;
              headPivot.rotation.y = !isMoving && !isPecking ? Math.sin(elapsed * 2.2 + seedPhase) * 0.38 : 0;
            } else if (isGrazingAnim) {
              headPivot.rotation.x = 0.28 + Math.sin(atkProg * Math.PI * 2) * 0.22;
              headPivot.rotation.y = Math.sin(elapsed * 2.1 + seedPhase) * 0.1;
            } else if (
              u.role === 'cow' ||
              u.role === 'pig' ||
              u.role === 'capybara' ||
              u.role === 'unicorn' ||
              isHerbivoreDino
            ) {
              const grazeWave = Math.max(0, Math.sin(elapsed * 0.75 + seedPhase));
              headPivot.rotation.x = !isMoving
                ? grazeWave * (u.role === 'unicorn' ? 0.28 : isHerbivoreDino ? 0.36 : 0.45)
                : Math.sin(elapsed * bobFreq + seedPhase) * 0.08;
              headPivot.rotation.y = !isMoving ? Math.sin(elapsed * 1.3 + seedPhase) * 0.24 : 0;
            } else {
              headPivot.rotation.x = isMoving ? Math.sin(elapsed * bobFreq + seedPhase) * 0.07 : Math.sin(elapsed * 2.1 + seedPhase) * 0.06;
              headPivot.rotation.y = !isMoving ? Math.sin(elapsed * 1.7 + seedPhase) * 0.35 : 0;
            }
          }

          if (jawPivot) {
            if (isLeviathan) {
              const beamTimer = u.leviathanBeamTimer ?? 0;
              const leapTimer = u.leviathanLeapTimer ?? 0;
              const isBreachingAir = leapTimer > 0 && leapTimer <= 4.0;
              const targetJawOpen =
                beamTimer > 0
                  ? 0.92 + Math.sin(elapsed * 26) * 0.05
                  : isBreachingAir
                    ? 0.68
                    : isAttacking
                      ? Math.sin(atkProg * Math.PI) * 0.78
                      : 0.1 + Math.max(0, Math.sin(elapsed * 2.1 + seedPhase)) * 0.14;
              jawPivot.rotation.x = THREE.MathUtils.damp(jawPivot.rotation.x, targetJawOpen, 14, dt);

              const targetMandibleFlare =
                beamTimer > 0
                  ? 0.56 + Math.sin(elapsed * 24) * 0.04
                  : isBreachingAir
                    ? 0.38
                    : isAttacking
                      ? Math.sin(atkProg * Math.PI) * 0.46
                      : 0.05 + Math.max(0, Math.sin(elapsed * 2.1 + seedPhase)) * 0.08;
              if (uEntry.mandibleL) {
                uEntry.mandibleL.rotation.y = THREE.MathUtils.damp(
                  uEntry.mandibleL.rotation.y,
                  -targetMandibleFlare,
                  14,
                  dt,
                );
              }
              if (uEntry.mandibleR) {
                uEntry.mandibleR.rotation.y = THREE.MathUtils.damp(
                  uEntry.mandibleR.rotation.y,
                  targetMandibleFlare,
                  14,
                  dt,
                );
              }

              // Glow abyssal hydro-core maw & animate 3D high-pressure water beam
              const mawObj = uEntry.fireMaw;
              if (mawObj && mawObj.material instanceof THREE.MeshStandardMaterial) {
                const targetGlow =
                  beamTimer > 0
                    ? 3.6 + Math.sin(elapsed * 28) * 0.6
                    : (u.leviathanBeamCooldown ?? 10) < 2.2
                      ? 2.1 + Math.sin(elapsed * 12) * 0.4
                      : 1.25 + Math.sin(elapsed * 4.0 + seedPhase) * 0.25;
                mawObj.material.emissiveIntensity = THREE.MathUtils.damp(
                  mawObj.material.emissiveIntensity,
                  targetGlow,
                  10,
                  dt,
                );
              }

              if (uEntry.leviathanBeamGroup) {
                const showBeam =
                  beamTimer > 0 &&
                  !u.leviathanSubmerged &&
                  u.leviathanBeamTargetX !== undefined &&
                  u.leviathanBeamTargetZ !== undefined;
                uEntry.leviathanBeamGroup.visible = showBeam;
                if (showBeam) {
                  const bDx = (u.leviathanBeamTargetX ?? u.x) - u.x;
                  const bDz = (u.leviathanBeamTargetZ ?? u.z) - u.z;
                  const beamLen = Math.max(2.0, Math.min(20.0, Math.hypot(bDx, bDz)));
                  const pulseRadius = 1.0 + Math.sin(elapsed * 32) * 0.16;
                  if (uEntry.beamShaft) {
                    uEntry.beamShaft.scale.set(pulseRadius, pulseRadius, beamLen);
                    uEntry.beamShaft.rotation.z = elapsed * 16.0;
                  }
                  if (uEntry.beamMuzzle) {
                    const muzzleScale = 1.0 + Math.sin(elapsed * 28) * 0.22;
                    uEntry.beamMuzzle.scale.setScalar(muzzleScale);
                    uEntry.beamMuzzle.rotation.z = -elapsed * 14.0;
                  }
                  if (uEntry.beamImpact) {
                    uEntry.beamImpact.position.set(0, -0.25, beamLen);
                    const impScale = 1.0 + Math.cos(elapsed * 26) * 0.25;
                    uEntry.beamImpact.scale.setScalar(impScale);
                    uEntry.beamImpact.rotation.y = elapsed * 12.0;
                  }
                  if (Math.random() < 0.65) {
                    const frac = Math.random();
                    const px = u.x + bDx * frac;
                    const pz = u.z + bDz * frac;
                    spawnParticleBurst(
                      px,
                      0.45,
                      pz,
                      2,
                      Math.random() < 0.5 ? '#22d3ee' : '#e0fbfc',
                      1.8,
                      3.6,
                      0.55,
                    );
                  }
                }
              }
            } else if (isDragon) {
              const targetJaw = isDragonStrafing
                ? 0.64
                : 0.06 + Math.max(0, Math.sin(elapsed * 2.0 + seedPhase)) * 0.1;
              jawPivot.rotation.x = THREE.MathUtils.damp(jawPivot.rotation.x, targetJaw, 12, dt);
              const mawObj = uEntry.fireMaw;
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
              jawPivot.rotation.x = Math.sin(atkProg * Math.PI) * 0.68;
            } else {
              jawPivot.rotation.x = Math.max(0, Math.sin(elapsed * 2.4 + seedPhase)) * 0.14;
            }
          }

          if (tailPivot) {
            if (isLeviathan) {
              const swimFreq = (u.leviathanBeamTimer ?? 0) > 0 ? 5.2 : isMoving ? 3.4 : 2.1;
              const swimAmp = (u.leviathanBeamTimer ?? 0) > 0 ? 0.18 : isMoving ? 0.34 : 0.22;
              tailPivot.rotation.y = Math.sin(elapsed * swimFreq + seedPhase) * swimAmp;
              tailPivot.rotation.x = Math.cos(elapsed * (swimFreq * 0.7) + seedPhase) * 0.1;
              if (uEntry.leviathanTailMid) {
                uEntry.leviathanTailMid.rotation.y =
                  Math.sin(elapsed * swimFreq + seedPhase - 0.95) * (swimAmp * 1.35);
                uEntry.leviathanTailMid.rotation.x =
                  Math.cos(elapsed * (swimFreq * 0.7) + seedPhase - 0.8) * 0.14;
              }
            } else if (isDragon) {
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
          const { legFL, legFR, legBL, legBR, legL, legR } = uEntry;

          if (legFL && legFR && legBL && legBR) {
            if (isDragon) {
              legFL.rotation.x = 0.52;
              legFR.rotation.x = 0.52;
              legBL.rotation.x = 0.68;
              legBR.rotation.x = 0.68;
            } else if (u.role === 'alien_walker') {
              const walkerSwing = isMoving ? Math.sin(legPhase * 0.52) * 0.34 : 0;
              legFL.rotation.x = walkerSwing;
              legBR.rotation.x = walkerSwing;
              legFR.rotation.x = -walkerSwing;
              legBL.rotation.x = -walkerSwing;
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
          if (uEntry.ufoRing) {
            uEntry.ufoRing.rotation.y = elapsed * 4.5 + seedPhase;
          }
        } else if (u.role === 'alien_walker' && u.state !== 'ko') {
          // Colossal AT-Walker: vertical-only hydraulic body motion + 4-beat articulated hip & knee stride
          const { legFL, legFR, legBL, legBR, kneeFL, kneeFR, kneeBL, kneeBR } = uEntry;
          const strideSpeed = 0.52;
          const prevCyc =
            typeof uGroup.userData.walkerCycle === 'number'
              ? uGroup.userData.walkerCycle
              : (elapsed * strideSpeed + seedPhase) % 1;
          const curCyc = isMoving && !isFrozen ? (elapsed * strideSpeed + seedPhase) % 1 : prevCyc;
          uGroup.userData.walkerCycle = curCyc;

          if (bodyPivot) {
            bodyPivot.rotation.set(0, 0, 0);
            if (isMoving && !isFrozen) {
              // Crisp 4-beat vertical hydraulic piston bob synced to each footpad strike (strictly up & down only)
              const beatFrac = (curCyc * 4) % 1;
              const liftArch = Math.sin(beatFrac * Math.PI);
              const stepThump = Math.exp(-beatFrac * 8.5) * -0.15;
              bodyPivot.position.set(0, liftArch * 0.14 + stepThump, 0);
            } else {
              const idleHum = Math.sin(elapsed * 1.6 + seedPhase) * 0.035;
              const recoilDrop = isAttacking ? Math.sin(atkProg * Math.PI) * -0.09 : 0;
              bodyPivot.position.set(0, idleHum + recoilDrop, 0);
            }
          }

          if (headPivot) {
            headPivot.rotation.z = 0;
            headPivot.rotation.x = isAttacking
              ? -Math.sin(atkProg * Math.PI) * 0.12
              : isMoving && !isFrozen
                ? Math.sin(curCyc * Math.PI * 4) * 0.03
                : Math.sin(elapsed * 1.1 + seedPhase) * 0.025;
            headPivot.rotation.y = !isMoving
              ? Math.sin(elapsed * 0.85 + seedPhase) * 0.24
              : Math.sin(elapsed * 0.65 + seedPhase) * 0.1;
          }

          const legSpecs: readonly [
            THREE.Object3D | undefined,
            THREE.Object3D | undefined,
            number,
            number,
            number,
          ][] = [
            [legFL, kneeFL, 0.0, -1.08, 1.1],
            [legBR, kneeBR, 0.5, 1.08, -1.26],
            [legFR, kneeFR, 0.25, 1.08, 1.1],
            [legBL, kneeBL, 0.75, -1.08, -1.26],
          ];

          for (let li = 0; li < legSpecs.length; li++) {
            const [hip, knee, offset, localX, localZ] = legSpecs[li];
            if (!hip) continue;
            if (isMoving && !isFrozen) {
              const sPrev = (prevCyc + offset) % 1;
              const s = (curCyc + offset) % 1;
              if (s < 0.26) {
                // Swing phase: thigh swings forward (-Z->+Z is negative X rot) while knee bends backward (+X rot)
                const uSwing = s / 0.26;
                const smoothSwing = 0.5 - 0.5 * Math.cos(uSwing * Math.PI);
                hip.rotation.x = 0.34 - smoothSwing * 0.7;
                if (knee) knee.rotation.x = Math.sin(uSwing * Math.PI) * 0.64;
              } else {
                // Stance phase: foot planted on ground pulling colossal hull forward
                const uStance = (s - 0.26) / 0.74;
                hip.rotation.x = -0.36 + uStance * 0.7;
                if (knee) knee.rotation.x = Math.sin(uStance * Math.PI) * 0.08;
                // Detect exact footfall landing transition -> eject mud/dust shock burst
                if (sPrev < 0.26 && s >= 0.26) {
                  const yaw = uGroup.rotation.y;
                  const sinY = Math.sin(yaw);
                  const cosY = Math.cos(yaw);
                  const fx = u.x + localX * cosY + localZ * sinY;
                  const fz = u.z - localX * sinY + localZ * cosY;
                  spawnParticleBurst(fx, groundY + 0.08, fz, 6, '#7c5332', 0.85, 2.2, 0.7);
                }
              }
            } else {
              // Locked heroic AT-AT firing/standing stance
              const restAngle = li % 2 === 0 ? -0.11 : 0.11;
              hip.rotation.x = THREE.MathUtils.damp(hip.rotation.x, restAngle, 8, dt);
              if (knee) knee.rotation.x = THREE.MathUtils.damp(knee.rotation.x, 0.06, 8, dt);
            }
          }
        }

        if (wingL && wingR && u.state !== 'ko') {
          if (isLeviathan) {
            const leapTimer = u.leviathanLeapTimer ?? 0;
            const beamTimer = u.leviathanBeamTimer ?? 0;
            const isBreachingAir = leapTimer > 0 && leapTimer <= 4.0;
            const finFreq = beamTimer > 0 ? 5.5 : isBreachingAir ? 2.2 : isMoving ? 3.2 : 2.0;
            const finFlap = isBreachingAir
              ? -0.24 + Math.sin(elapsed * finFreq + seedPhase) * 0.18
              : Math.sin(elapsed * finFreq + seedPhase) * 0.28;
            const finSweep = beamTimer > 0 ? -0.32 : Math.cos(elapsed * finFreq + seedPhase) * 0.16;
            wingL.rotation.z = THREE.MathUtils.damp(wingL.rotation.z, finFlap, 9, dt);
            wingR.rotation.z = THREE.MathUtils.damp(wingR.rotation.z, -finFlap, 9, dt);
            wingL.rotation.y = THREE.MathUtils.damp(wingL.rotation.y, finSweep, 9, dt);
            wingR.rotation.y = THREE.MathUtils.damp(wingR.rotation.y, -finSweep, 9, dt);
            if (wingOuterL && wingOuterR) {
              const rearStroke = Math.sin(elapsed * finFreq + seedPhase - 1.1) * 0.24;
              wingOuterL.rotation.z = THREE.MathUtils.damp(wingOuterL.rotation.z, rearStroke, 9, dt);
              wingOuterR.rotation.z = THREE.MathUtils.damp(wingOuterR.rotation.z, -rearStroke, 9, dt);
            }
          } else if (isDragon) {
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

        if (uEntry.contactShadowScale > 0 && !(u.role === 'leviathan' && u.leviathanSubmerged)) {
          const totalAir = flightHoverY + airborneAltY + pounceHopY;
          const s = uEntry.contactShadowScale * Math.max(0.28, 1 - totalAir * 0.18);
          const slot = unitShadowCount++;
          ensureInstancedCapacity(unitContactShadowsInst, unitShadowCount);
          const arr = unitContactShadowsInst.instanceMatrix.array as Float32Array;
          const off = slot * 16;
          arr[off] = s;
          arr[off + 1] = 0;
          arr[off + 2] = 0;
          arr[off + 3] = 0;
          arr[off + 4] = 0;
          arr[off + 5] = s;
          arr[off + 6] = 0;
          arr[off + 7] = 0;
          arr[off + 8] = 0;
          arr[off + 9] = 0;
          arr[off + 10] = s;
          arr[off + 11] = 0;
          arr[off + 12] = uGroup.position.x;
          arr[off + 13] = uGroup.position.y + 0.018;
          arr[off + 14] = uGroup.position.z;
          arr[off + 15] = 1;
        }

        const heldTool = uEntry.heldTool;
        if (heldTool && heldTool.visible && runMicroAnim) {
          heldTool.rotation.x = isWorking && !isFrozen ? 0.45 + Math.sin(elapsed * 18) * 0.65 : 0.35;
        }
        } // end runMicroAnim

        if (uEntry.heldTool) {
          const showTool = frustumSize < 38;
          if (uEntry.heldTool.visible !== showTool) uEntry.heldTool.visible = showTool;
        }

        const carryBox = uEntry.carryBox;
        if (carryBox) {
          const carryType = u.carryingAmount > 0 && u.carryingType ? u.carryingType : null;
          if (carryType !== uEntry.lastCarryType) {
            uEntry.lastCarryType = carryType;
            if (carryType) {
              carryBox.visible = true;
              carryBox.material = getSharedCarryMaterial(carryType);
            } else {
              carryBox.visible = false;
            }
          }
        }

        const statusRing = uEntry.statusRing;
        if (statusRing) {
          const statusKey = u.statusEffects.frozen
            ? 6
            : u.statusEffects.blessed
              ? 1
              : u.statusEffects.shielded
                ? 2
                : u.statusEffects.frenzied
                  ? 3
                  : u.statusEffects.plagued
                    ? 4
                    : u.statusEffects.cursed
                      ? 5
                      : 0;
          if (statusKey !== uEntry.lastStatusKey) {
            uEntry.lastStatusKey = statusKey;
            const sharedStatusMat = getSharedStatusRingMaterial(statusKey);
            if (sharedStatusMat) {
              statusRing.material = sharedStatusMat;
              statusRing.visible = true;
            } else {
              statusRing.visible = false;
            }
          }
        }

        const battlewillAvatar = uEntry.battlewillAvatar;
        if (battlewillAvatar) {
          const bwActive = (u.battlewillActive ?? 0) > 0 && u.state !== 'ko';
          battlewillAvatar.visible = bwActive;
          if (bwActive) {
            const pulse = 1 + Math.sin(elapsed * 7.5 + seedPhase) * 0.045;
            battlewillAvatar.scale.set(pulse, pulse, pulse);
            battlewillAvatar.position.y = Math.sin(elapsed * 4.5 + seedPhase) * 0.1;
            const swordPivot = uEntry.battlewillSwordPivot;
            if (swordPivot) {
              const slashTimer = u.battlewillSlashTimer ?? 0;
              if (slashTimer > 0) {
                const prog = THREE.MathUtils.clamp(1 - slashTimer / 0.55, 0, 1);
                swordPivot.rotation.y = -1.35 + prog * 2.7;
                swordPivot.rotation.x = 0.55 + Math.sin(prog * Math.PI) * 0.45;
              } else {
                swordPivot.rotation.y = Math.sin(elapsed * 2.4 + seedPhase) * 0.14;
                swordPivot.rotation.x = 0.2 + Math.cos(elapsed * 3.0 + seedPhase) * 0.08;
              }
            }
          }
        }
      }

      visibleUnitCountLastFrame = visibleUnitsThisFrame;
      unitContactShadowsInst.count = unitShadowCount;
      unitContactShadowsInst.visible = unitShadowCount > 0;
      if (unitShadowCount > 0) {
        unitContactShadowsInst.instanceMatrix.clearUpdateRanges();
        unitContactShadowsInst.instanceMatrix.addUpdateRange(0, unitShadowCount * 16);
        unitContactShadowsInst.instanceMatrix.needsUpdate = true;
      }

      for (const [id, uEntry] of unitMeshes.entries()) {
        if (uEntry.seenStamp !== syncFrameStamp) {
          unitsGroup.remove(uEntry.group);
          disposeEntityGroup(uEntry.group);
          unitMeshes.delete(id);
        }
      }

      // 3b. Sync vehicles with cached animated children & viewport culling
      const vehicles = simState.vehicles;
      if (vehicles && vehicles.length > 0) {
        for (let vi = 0; vi < vehicles.length; vi++) {
          const v = vehicles[vi];
          let vEntry = vehicleMeshes.get(v.id);
          const vBasePad =
            v.type === 'plane' || v.type === 'bomber_plane' || v.type === 'orbital_gunship'
              ? 3.5
              : 0.5;
          const vPad = vEntry ? vBasePad + DESPAWN_CULL_HYSTERESIS : vBasePad;
          if (!isPointInCullBounds(v.x, v.z, worldCullBounds, vPad)) {
            continue;
          }
          if (
            !vEntry ||
            vEntry.epochLevel !== v.epochLevel ||
            vEntry.type !== v.type ||
            vEntry.species !== v.species
          ) {
            if (vEntry) {
              vehiclesGroup.remove(vEntry.group);
              disposeEntityGroup(vEntry.group);
            }
            const seedHash =
              Math.abs(Math.round(v.x * 13 + v.z * 7)) + v.id.charCodeAt(v.id.length - 1);
            const group = createVehicleGroup(v.type, v.epochLevel, v.species, seedHash);
            vehiclesGroup.add(group);
            const spinProps: THREE.Object3D[] = [];
            const spinRotors: THREE.Object3D[] = [];
            const thrusterPlumes: THREE.Object3D[] = [];
            const contactShadows: THREE.Object3D[] = [];
            for (let ci = 0; ci < group.children.length; ci++) {
              const ch = group.children[ci];
              if (ch.name === 'spin_prop') spinProps.push(ch);
              else if (ch.name === 'spin_rotor') spinRotors.push(ch);
              else if (ch.name === 'thruster_plume') thrusterPlumes.push(ch);
              else if (ch.name === 'contact_shadow') contactShadows.push(ch);
            }
            vEntry = {
              group,
              epochLevel: v.epochLevel,
              type: v.type,
              species: v.species,
              spinProps,
              spinRotors,
              thrusterPlumes,
              contactShadows,
              seenStamp: syncFrameStamp,
            };
            vehicleMeshes.set(v.id, vEntry);
          } else {
            vEntry.seenStamp = syncFrameStamp;
          }
          const vGroup = vEntry.group;
          if (!vGroup.visible) vGroup.visible = true;
          const vtx = Math.round(THREE.MathUtils.clamp(v.x, 0, gsBld - 1));
          const vtz = Math.round(THREE.MathUtils.clamp(v.z, 0, gsBld - 1));
          const vTile = simState.tiles[vtz * gsBld + vtx];
          const groundY = vTile ? Math.max(0.18, vTile.height * HEIGHT_STEP + 0.25) : 0.5;

          if (v.type === 'car') {
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
          } else if (v.type === 'plane' || v.type === 'bomber_plane') {
            const minAirFloor = v.flightPhase === 'cruise' || v.type === 'bomber_plane' ? 3.85 : groundY;
            const planeY = Math.max(groundY + v.y, minAirFloor + Math.max(0, v.y - 2.0));
            vGroup.position.set(v.x, planeY, v.z);
            if (v.type === 'bomber_plane' && Math.random() < 0.45) {
              const exColor = v.epochLevel >= 6 ? '#56cfe1' : v.epochLevel >= 5 ? '#fb923c' : '#cbd5e1';
              spawnParticleBurst(
                v.x - Math.sin(v.heading) * 0.48,
                planeY + 0.16,
                v.z - Math.cos(v.heading) * 0.48,
                1,
                exColor,
                0.18,
                0.55,
                0.35,
              );
            }
          } else if (v.type === 'warship' || v.type === 'passenger_ship') {
            const isSea = vTile?.height === 0;
            const shipY = isSea
              ? 0.26 + Math.sin(elapsed * 2.2 + v.x * 0.7) * 0.035
              : groundY + v.y + 0.02;
            vGroup.position.set(v.x, shipY, v.z);
            if (isSea && Math.random() < 0.55) {
              // Seafoam stern wake trailing behind sailing/cruising ships & ferries
              spawnParticleBurst(
                v.x - Math.sin(v.heading) * 0.62,
                shipY + 0.05,
                v.z - Math.cos(v.heading) * 0.62,
                2,
                v.epochLevel >= 6 ? '#56cfe1' : '#e0f2fe',
                0.22,
                0.45,
                0.42,
              );
            }
            if (v.epochLevel === 3 && Math.random() < 0.38) {
              // Industrial steam ferry / ironclad smokestack plumes
              spawnParticleBurst(v.x, shipY + 0.58, v.z, 1, '#475569', 0.18, 0.9, 0.52);
            }
          } else if (v.type === 'helicopter') {
            const heliY = Math.max(
              groundY + 1.35,
              groundY + v.y * 0.52 + 1.25 + Math.sin(elapsed * 4.2 + v.x) * 0.06,
            );
            vGroup.position.set(v.x, heliY, v.z);
          } else if (v.type === 'glider' || v.type === 'airship' || v.type === 'orc_flyer') {
            const bob = v.type === 'glider' ? 0 : Math.sin(elapsed * 3.6 + v.z) * 0.05;
            const airY = Math.max(groundY + 1.05, groundY + v.y * 0.45 + 1.15 + bob);
            vGroup.position.set(v.x, airY, v.z);
            if (v.type === 'orc_flyer' && v.epochLevel >= 3 && Math.random() < 0.3) {
              spawnParticleBurst(v.x, airY + 0.25, v.z, 1, '#64748b', 0.16, 0.6, 0.35);
            }
          } else if (v.type === 'orbital_gunship') {
            const orbY = Math.max(groundY + 2.3, groundY + v.y * 0.55 + 2.2);
            vGroup.position.set(v.x, orbY, v.z);
            if (Math.random() < 0.45) {
              spawnParticleBurst(v.x, orbY - 0.15, v.z, 1, '#38bdf8', 0.18, 0.6, 0.36);
            }
          } else if (v.type === 'tank' && v.epochLevel >= 6) {
            const hoverBob = Math.sin(elapsed * 3.4 + v.x) * 0.04;
            vGroup.position.set(v.x, groundY + v.y + hoverBob, v.z);
          } else {
            vGroup.position.set(v.x, groundY + v.y + 0.02, v.z);
          }

          vGroup.rotation.order = 'YXZ';
          vGroup.rotation.set(v.pitch, v.heading, v.bank);

          for (let spi = 0; spi < vEntry.spinProps.length; spi++) {
            vEntry.spinProps[spi].rotation.z += dt * 28;
          }
          for (let sri = 0; sri < vEntry.spinRotors.length; sri++) {
            vEntry.spinRotors[sri].rotation.y += dt * (v.type === 'warship' ? 6.5 : 26);
          }
          const thrusterActive = Boolean(v.thrusterActive);
          for (let tpi = 0; tpi < vEntry.thrusterPlumes.length; tpi++) {
            const plume = vEntry.thrusterPlumes[tpi];
            plume.visible = thrusterActive;
            if (thrusterActive) {
              const flicker = 0.8 + Math.sin(elapsed * 48 + plume.position.x * 30) * 0.28;
              plume.scale.set(0.9 + (flicker - 0.8) * 0.4, flicker, 0.9 + (flicker - 0.8) * 0.4);
            }
          }
          if (vEntry.contactShadows.length > 0) {
            const shadowFade = Math.max(0.25, 1 - Math.max(0, v.y - 0.1) * 0.25);
            for (let csi = 0; csi < vEntry.contactShadows.length; csi++) {
              vEntry.contactShadows[csi].scale.setScalar(shadowFade);
            }
          }
        }
      }

      for (const [id, vEntry] of vehicleMeshes.entries()) {
        if (vEntry.seenStamp !== syncFrameStamp) {
          vehiclesGroup.remove(vEntry.group);
          disposeEntityGroup(vEntry.group);
          vehicleMeshes.delete(id);
        }
      }

      // 3c. Sync glowing Void Wisps spawned from infected void_goo terrain (viewport-culled)
      const wispsList = simState.voidWisps;
      if (wispsList && wispsList.length > 0) {
        const gsWisp = simState.gridSize;
        for (let wi = 0; wi < wispsList.length; wi++) {
          const w = wispsList[wi];
          let wEntry = wispMeshes.get(w.id);
          const wPad = wEntry ? DESPAWN_CULL_HYSTERESIS : 0;
          if (!isPointInCullBounds(w.x, w.z, worldCullBounds, wPad)) {
            continue;
          }
          if (!wEntry || wEntry.color !== w.color) {
            if (wEntry) {
              wispsGroup.remove(wEntry.group);
              for (const m of wEntry.materials) m.dispose();
            }
            const wGroup = new THREE.Group();
            const coreMat = new THREE.MeshBasicMaterial({
              color: w.color,
              transparent: true,
              opacity: 0.96,
            });
            const haloMat = new THREE.MeshBasicMaterial({
              color: w.color,
              transparent: true,
              opacity: 0.38,
              depthWrite: false,
            });
            const orbitMat = new THREE.MeshBasicMaterial({
              color: '#ffffff',
              transparent: true,
              opacity: 0.9,
            });
            const core = new THREE.Mesh(sharedWispCoreGeo, coreMat);
            const halo = new THREE.Mesh(sharedWispHaloGeo, haloMat);
            const orbitDot = new THREE.Mesh(sharedWispOrbitGeo, orbitMat);
            orbitDot.position.set(0.45, 0.1, 0);
            wGroup.add(core, halo, orbitDot);
            wispsGroup.add(wGroup);
            wEntry = {
              group: wGroup,
              core,
              halo,
              orbitDot,
              materials: [coreMat, haloMat, orbitMat],
              color: w.color,
              seenStamp: syncFrameStamp,
            };
            wispMeshes.set(w.id, wEntry);
          } else {
            wEntry.seenStamp = syncFrameStamp;
            if (!wEntry.group.visible) wEntry.group.visible = true;
          }

          const wx = Math.max(0, Math.min(gsWisp - 1, Math.round(w.x)));
          const wz = Math.max(0, Math.min(gsWisp - 1, Math.round(w.z)));
          const wt = simState.tiles[wz * gsWisp + wx];
          const baseGroundY = wt ? Math.max(0.24, wt.height * HEIGHT_STEP + 0.25) : 0.6;
          const bob = Math.sin(elapsed * 4.2 + w.phase) * 0.22;
          const wy = baseGroundY + w.y + bob;
          wEntry.group.position.set(w.x, wy, w.z);
          const s = w.size * (0.94 + Math.sin(elapsed * 6.5 + w.phase) * 0.08);
          wEntry.group.scale.setScalar(s);
          wEntry.core.rotation.y = elapsed * 2.4 + w.phase;
          wEntry.core.rotation.x = elapsed * 1.5;
          const oa = elapsed * 4.4 + w.phase * 2;
          wEntry.orbitDot.position.set(Math.cos(oa) * 0.52, Math.sin(oa * 1.7) * 0.18, Math.sin(oa) * 0.52);
        }
      }
      if (wispMeshes.size > 0) {
        for (const [id, wEntry] of wispMeshes.entries()) {
          if (wEntry.seenStamp !== syncFrameStamp) {
            wispsGroup.remove(wEntry.group);
            for (const m of wEntry.materials) m.dispose();
            wispMeshes.delete(id);
          }
        }
      }

      // 4. Consume pending VFX bursts (always run gameplay-deferred impacts; skip purely cosmetic off-screen VFX)
      while (simState.pendingVfx.length > 0) {
        const vfx = simState.pendingVfx.shift()!;
        const mustRunSimulationImpact =
          Boolean(vfx.deferImpact) ||
          vfx.type === 'huge_asteroid_strike' ||
          (vfx.type === 'sky_rain_drop' && Boolean(vfx.dropTargets && vfx.dropTargets.length > 0));
        if (!mustRunSimulationImpact) {
          const vfxPad = Math.max(4.0, (vfx.radius ?? 1) + 2.5);
          const ox = vfx.originX ?? vfx.x;
          const oz = vfx.originZ ?? vfx.z;
          if (
            !isPointInCullBounds(vfx.x, vfx.z, worldCullBounds, vfxPad) &&
            !isPointInCullBounds(ox, oz, worldCullBounds, vfxPad)
          ) {
            continue;
          }
        }
        const vTile = getTileFromArray(simState, vfx.x, vfx.z);
        const surfY = getTileEffectSurfaceY(vTile, vfx.y);
        if (vfx.type === 'hit_spark') {
          spawnWeaponSparkVisual(vfx.x, surfY + 0.28, vfx.z, vfx.radius, vfx.color);
        } else if (vfx.type === 'build_complete') {
          spawnParticleBurst(vfx.x, surfY + 0.25, vfx.z, 22, vfx.color, vfx.radius * 0.55, 3.8, 0.95);
        } else if (vfx.type === 'fire_spread') {
          const ox = vfx.originX ?? vfx.x;
          const oz = vfx.originZ ?? vfx.z;
          const oTile = getTileFromArray(simState, ox, oz);
          const originGroundY = getTileEffectSurfaceY(oTile, surfY) + 0.11;
          spawnDirectionalFlameStream(
            ox,
            originGroundY,
            oz,
            vfx.x,
            surfY + 0.26,
            vfx.z,
            9,
            vfx.color || '#ff6b00',
            0.34,
          );
          spawnParticleBurst(vfx.x, surfY + 0.18, vfx.z, 6, '#ffd166', 0.38, 2.2, 0.72);
        } else if (vfx.type === 'dragon_fire_breath') {
          const ox = vfx.originX ?? vfx.x;
          const oz = vfx.originZ ?? vfx.z;
          const oTile = getTileFromArray(simState, ox, oz);
          const originGroundY = getTileEffectSurfaceY(oTile, surfY);
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
          const originGroundY = getTileEffectSurfaceY(oTile, surfY);
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
        } else if (
          vfx.type === 'projectile_tracer' ||
          vfx.type === 'nuke_blast' ||
          vfx.type === 'arcane_cataclysm' ||
          vfx.type === 'battlewill_slash'
        ) {
          const ox = vfx.originX ?? vfx.x;
          const oz = vfx.originZ ?? vfx.z;
          const oTile = getTileFromArray(simState, ox, oz);
          const originGroundY = getTileEffectSurfaceY(oTile, surfY);
          spawnWarWeaponVisual(
            vfx.type,
            ox,
            vfx.originY !== undefined ? Math.max(originGroundY, vfx.originY) : originGroundY,
            oz,
            vfx.x,
            surfY,
            vfx.z,
            vfx.radius,
            vfx.color,
            vfx.vfxSubtype,
          );
        } else {
          if (vfx.type === 'huge_asteroid_strike') {
            soundEngine.playHugeAsteroidApproach();
          }
          spawnPowerVisualEffect(
            vfx.type,
            vfx.x,
            Math.max(surfY, vfx.y),
            vfx.z,
            vfx.radius,
            vfx.color,
            Boolean(vfx.deferImpact),
            vfx.faultSegments,
            vfx.quakeShapeKind,
            vfx.originX,
            vfx.originY,
            vfx.originZ,
            vfx.dropKind,
            vfx.dropTargets,
          );
        }
      }

      // Guarantee every active burst VFX (powers, magic circles, unit attacks, projectiles) renders after oceanFoam
      for (let bi = 0; bi < activeBurstFx.length; bi++) {
        const bGroup = activeBurstFx[bi].group;
        if (!bGroup.userData._roApplied) {
          setSubtreeRenderOrder(bGroup, 9);
          bGroup.userData._roApplied = true;
        }
      }

      // 5. Sync lingering hazard zones
      if (hazardsList && hazardsList.length > 0) {
        for (let hi = 0; hi < hazardsList.length; hi++) {
          const haz = hazardsList[hi];
          if (
            haz.kind === 'heat_wave_zone' ||
            haz.kind === 'freeze_wave_zone' ||
            haz.kind === 'blessing_wave' ||
            haz.kind === 'curse_wave' ||
            haz.kind === 'frenzy_wave' ||
            haz.kind === 'terraform_wave' ||
            haz.kind === 'asteroid_shockwave'
          ) {
            continue;
          }
          let hv = hazardMeshes.get(haz.id);
          const hazPad = hv ? DESPAWN_CULL_HYSTERESIS : 0;
          if (!isHazardIntersectingCullBounds(haz, worldCullBounds, hazPad)) {
            continue;
          }
          if (!hv || hv.isSuper !== haz.isSuper) {
            if (hv) {
              disposeHazardVisual(hv);
            }
            hv = createHazardVisual(
              haz.kind,
              haz.radius,
              haz.faultSegments,
              haz.x,
              haz.z,
              Boolean(haz.isSuper),
            );
            setSubtreeRenderOrder(hv.group, 8);
            hazardsGroup.add(hv.group);
            hazardMeshes.set(haz.id, hv);
          }
          hv.seenStamp = syncFrameStamp;
          const ht = getTileFromArray(simState, haz.x, haz.z);
          const targetHy = getTileEffectSurfaceY(ht, 0.8);
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
            const speedNorm = Math.min(1, Math.max(0, (speed - 0.6) / 16.0));

            if (hv.cloudBody) {
              const windYaw = Math.atan2(wz, wx);
              hv.cloudBody.rotation.y = -windYaw;
              const stretchX = 1.0 + speedNorm * 0.36 + Math.sin(elapsed * 3.2) * 0.04 * (1 - speedNorm);
              const squashY = 1.0 - speedNorm * 0.14 + Math.cos(elapsed * 3.8) * 0.05 * (1 - speedNorm);
              hv.cloudBody.scale.set(stretchX, squashY, 1.0 - speedNorm * 0.08);
              hv.cloudBody.position.y = Math.sin(elapsed * 2.6) * 0.18 * (1 - speedNorm * 0.6);
            }

            if (hv.dropsInst) {
              _dummyMatrix.makeRotationFromEuler(
                new THREE.Euler(-wz * speedNorm * 0.42, 0, wx * speedNorm * 0.42),
              );
              const el = _dummyMatrix.elements;
              const arr = hv.dropsInst.instanceMatrix.array as Float32Array;
              for (let di = 0; di < hv.drops.length; di++) {
                const d = hv.drops[di];
                const fallProgress = ((elapsed * (d.speed + speedNorm * 4.5) + d.offsetY) % 4.4) / 4.4;
                const dropY = 4.4 * (1 - fallProgress);
                const windLag = fallProgress * speedNorm * 1.65;
                const off = di * 16;
                arr[off + 0] = el[0]; arr[off + 1] = el[1]; arr[off + 2] = el[2]; arr[off + 3] = 0;
                arr[off + 4] = el[4]; arr[off + 5] = el[5]; arr[off + 6] = el[6]; arr[off + 7] = 0;
                arr[off + 8] = el[8]; arr[off + 9] = el[9]; arr[off + 10] = el[10]; arr[off + 11] = 0;
                arr[off + 12] = d.baseX - wx * windLag;
                arr[off + 13] = dropY;
                arr[off + 14] = d.baseZ - wz * windLag;
                arr[off + 15] = 1;
              }
              hv.dropsInst.instanceMatrix.needsUpdate = true;
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
            for (let mi = 0; mi < hv.materials.length; mi++) {
              const m = hv.materials[mi];
              if ('opacity' in m) (m as THREE.MeshBasicMaterial).opacity = 0.9 * fade * arriveAlpha;
            }
          } else if (hv.spores) {
            for (let si = 0; si < hv.spores.length; si++) {
              const sp = hv.spores[si];
              const a = sp.angle + elapsed * 1.1;
              sp.mesh.position.set(
                Math.cos(a) * sp.dist,
                sp.height + Math.sin(elapsed * 3.2 + sp.phase) * 0.35,
                Math.sin(a) * sp.dist,
              );
              sp.mesh.rotation.y = elapsed * 1.5 + sp.phase;
            }
            if (hv.ringMesh) {
              hv.ringMesh.rotation.set(0, elapsed * 0.8, 0);
            }
            for (let mi = 0; mi < hv.materials.length; mi++) {
              const m = hv.materials[mi];
              if ('opacity' in m) (m as THREE.MeshBasicMaterial).opacity = 0.72 * fade;
            }
          } else if (hv.kind === 'shield_dome') {
            if (hv.ringMesh) hv.ringMesh.rotation.set(0, elapsed * 0.9, 0);
            if (hv.secondaryRingMesh) hv.secondaryRingMesh.rotation.set(0, elapsed * 1.25, 0);
            (hv.materials[0] as THREE.MeshBasicMaterial).opacity =
              (0.26 + Math.sin(elapsed * 5) * 0.06) * fade;
          } else if (hv.kind === 'wormhole_rift') {
            if (hv.ringMesh) {
              hv.ringMesh.rotation.set(0, elapsed * 2.4, 0);
            }
            if (hv.secondaryRingMesh) {
              hv.secondaryRingMesh.rotation.set(0, elapsed * 1.8, 0);
            }
            if (hv.gravityRings) {
              const maxPullR = haz.radius * 1.55;
              for (let gi = 0; gi < hv.gravityRings.length; gi++) {
                const gRing = hv.gravityRings[gi];
                const cycle = (elapsed * 0.85 + gi / hv.gravityRings.length) % 1;
                const easeIn = Math.pow(cycle, 1.55);
                const curRingR = Math.max(0.2, maxPullR * (1 - easeIn));
                gRing.scale.setScalar(curRingR);
                gRing.position.y = 0.1 + easeIn * 1.7;
                gRing.rotation.set(0, elapsed * (1.8 + gi * 0.6), 0);
                const gMat = hv.materials[3 + gi] as THREE.MeshBasicMaterial | undefined;
                if (gMat) {
                  gMat.opacity = Math.sin(cycle * Math.PI) * 0.82 * fade;
                }
              }
            }
            if (hv.vortexMotes) {
              const maxMoteR = haz.radius * 1.5;
              for (let mi = 0; mi < hv.vortexMotes.length; mi++) {
                const vm = hv.vortexMotes[mi];
                const cycle = (elapsed * vm.speed + vm.phase) % 1;
                const inward = Math.pow(cycle, 1.4);
                const r = Math.max(0.12, maxMoteR * (1 - inward));
                const theta = vm.baseAngle + elapsed * 2.8 + inward * 8.5;
                const my = 0.15 + Math.pow(cycle, 1.65) * 1.65;
                vm.mesh.position.set(Math.cos(theta) * r, my, Math.sin(theta) * r);
                vm.mesh.rotation.set(elapsed * 5 + mi, theta, elapsed * 4);
                const s = 0.16 + Math.sin(cycle * Math.PI) * 0.24;
                vm.mesh.scale.set(s * 1.4, s * 0.7, s);
              }
            }
            if (hv.debrisChunks) {
              for (let ci = 0; ci < hv.debrisChunks.length; ci++) {
                const dc = hv.debrisChunks[ci];
                const a = dc.angle + elapsed * dc.speed;
                const orbitR = dc.dist * (0.72 + Math.sin(elapsed * 1.8 + dc.tilt) * 0.22);
                dc.mesh.position.set(
                  Math.cos(a) * orbitR,
                  dc.height + Math.sin(elapsed * 3.5 + ci) * 0.45,
                  Math.sin(a) * orbitR,
                );
                dc.mesh.rotation.set(elapsed * 3.8 + dc.tilt, elapsed * 4.5, dc.tilt);
              }
            }
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
          } else if (hv.kind === 'tornado_vortex') {
            const safeT = wrapShaderTime(elapsed);
            const groundShader = hv.materials[0] as THREE.ShaderMaterial | undefined;
            if (groundShader && groundShader.uniforms) {
              groundShader.uniforms.uTime.value = safeT;
              groundShader.uniforms.uOpacity.value = 0.94 * fade;
            }
            const funnelShader = hv.materials[1] as THREE.ShaderMaterial | undefined;
            if (funnelShader && funnelShader.uniforms) {
              funnelShader.uniforms.uTime.value = safeT;
              funnelShader.uniforms.uOpacity.value = 0.92 * fade;
            }
            if (hv.ringMesh) {
              const pulse = 1 + Math.sin(elapsed * 5.2) * 0.05;
              hv.ringMesh.scale.setScalar(haz.radius * (hv.isSuper ? 1.15 : 0.98) * pulse * fade);
            }
            if (hv.secondaryRingMesh) {
              hv.secondaryRingMesh.rotation.y = -elapsed * 4.5;
            }
            if (hv.tornadoRings) {
              const maxH = hv.isSuper ? 7.6 : 5.8;
              for (let ti = 0; ti < hv.tornadoRings.length; ti++) {
                const tr = hv.tornadoRings[ti];
                const frac = ti / Math.max(1, hv.tornadoRings.length - 1);
                const wobbleX = Math.sin(elapsed * 6.2 - frac * 4.2) * (0.14 + frac * 0.55);
                const wobbleZ = Math.cos(elapsed * 5.5 - frac * 4.2) * (0.14 + frac * 0.55);
                tr.position.set(wobbleX, 0.35 + frac * maxH, wobbleZ);
                tr.rotation.y = elapsed * (9.0 - frac * 4.0) + ti * 0.65;
              }
            }
            if (hv.cloudBody) {
              hv.cloudBody.rotation.y = elapsed * 1.4;
              hv.cloudBody.position.x = Math.sin(elapsed * 6.2 - 4.2) * 0.55;
              hv.cloudBody.position.z = Math.cos(elapsed * 5.5 - 4.2) * 0.55;
            }
            if (hv.debrisChunks) {
              for (let di = 0; di < hv.debrisChunks.length; di++) {
                const dc = hv.debrisChunks[di];
                const a = dc.angle + elapsed * dc.speed;
                dc.mesh.position.set(
                  Math.cos(a) * dc.dist,
                  dc.height + Math.sin(elapsed * 5 + di) * 0.35,
                  Math.sin(a) * dc.dist,
                );
                dc.mesh.rotation.set(elapsed * 6 + di, elapsed * 5, dc.tilt);
              }
            }
            if (Math.random() < 0.6) {
              spawnRisingParticles(haz.x, hy, haz.z, 2, hv.isSuper ? '#38bdf8' : '#cbd5e1', haz.radius * 0.85, 5.5, 0.9, 1.1);
            }
            hv.group.scale.setScalar(Math.max(0.1, fade));
          } else if (hv.kind === 'tsunami_wave') {
            hv.group.position.set(haz.x, 0, haz.z);
            const curR = haz.currentRadius ?? haz.radius;
            const maxR = haz.maxRadius ?? haz.radius * 3.8;
            const expandProg = Math.min(1, curR / Math.max(1, maxR));

            if (hv.waveSegments && hv.waveInsts) {
              const primaryCount = 40;
              const wakeCount = 28;
              let visCount = 0;
              const segEuler = new THREE.Euler();
              for (let si = 0; si < hv.waveSegments.length; si++) {
                const seg = hv.waveSegments[si];
                const baseR = seg.isWake ? Math.max(0.7, curR * 0.65) : curR;
                const rippledR = baseR + Math.sin(elapsed * 5.8 + seg.phase * 2.0) * 0.28;
                const dx = Math.cos(seg.angle) * rippledR;
                const dz = Math.sin(seg.angle) * rippledR;
                const wx = haz.x + dx;
                const wz = haz.z + dz;
                const segTile = getTileFromArray(simState, wx, wz);

                if (!segTile || segTile.height >= 4) {
                  continue;
                }

                const baseY = segTile.height === 0 ? 0.32 : segTile.height * HEIGHT_STEP + 0.22;
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

                const breakPitch =
                  0.1 + Math.sin(elapsed * 9.2 + seg.phase) * 0.1 + (segTile.height >= 1 ? 0.2 : 0);
                _dummyPos.set(dx, baseY, dz);
                segEuler.set(breakPitch, Math.atan2(dx, dz), 0);
                _dummyQuat.setFromEuler(segEuler);
                _dummyScale.set(
                  arcWidth,
                  waveH,
                  (seg.isWake ? 0.78 : 1.18) * (0.92 + Math.cos(elapsed * 7.2 + seg.phase) * 0.12),
                );
                _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
                for (let wi = 0; wi < hv.waveInsts.length; wi++) {
                  hv.waveInsts[wi].setMatrixAt(visCount, _dummyMatrix);
                }
                visCount++;

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
              for (let wi = 0; wi < hv.waveInsts.length; wi++) {
                hv.waveInsts[wi].count = visCount;
                hv.waveInsts[wi].visible = visCount > 0;
                if (visCount > 0) hv.waveInsts[wi].instanceMatrix.needsUpdate = true;
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
          } else if (hv.kind === 'whirlpool') {
            hv.group.position.set(haz.x, 0.24, haz.z);
            const shaderMat = hv.materials[0] as THREE.ShaderMaterial | undefined;
            if (shaderMat && shaderMat.uniforms) {
              shaderMat.uniforms.uTime.value = wrapShaderTime(elapsed);
              shaderMat.uniforms.uOpacity.value = 0.96 * fade;
            }
            if (hv.ringMesh) {
              const pulse = 1 + Math.sin(elapsed * 4.5) * 0.035;
              hv.ringMesh.scale.setScalar(haz.radius * 1.08 * pulse * fade);
            }
            if (hv.secondaryRingMesh) {
              hv.secondaryRingMesh.rotation.y = -elapsed * 6.5;
              hv.secondaryRingMesh.scale.set(haz.radius * 0.88 * fade, 1.0, haz.radius * 0.88 * fade);
            }
            if (hv.vortexMotes) {
              for (let mi = 0; mi < hv.vortexMotes.length; mi++) {
                const vm = hv.vortexMotes[mi];
                const cycle = (elapsed * vm.speed + vm.phase) % 1;
                // Exponential inward logarithmic spiral trajectory into the throat
                const radialFrac = Math.pow(1 - cycle, 1.35);
                const r = Math.max(0.14, haz.radius * (0.14 + radialFrac * 0.82)) * fade;
                const theta = vm.baseAngle + elapsed * 4.8 + (1 - radialFrac) * 9.5;
                const yDepth = -0.05 + radialFrac * 0.13;
                vm.mesh.position.set(Math.cos(theta) * r, yDepth, Math.sin(theta) * r);
                vm.mesh.rotation.y = -theta + Math.PI * 0.35;
                const s = (0.22 + Math.sin(cycle * Math.PI) * 0.24) * fade;
                vm.mesh.scale.set(s * 1.5, s * 0.65, s * 0.85);
              }
            }
            if (Math.random() < 0.45) {
              spawnParticleBurst(haz.x, 0.28, haz.z, 2, '#e0fbfc', haz.radius * 0.68, 1.6, 0.5);
            }
          } else if (hv.kind === 'rogue_wave') {
            hv.group.position.set(haz.x, 0.24, haz.z);
            const heading = haz.heading ?? 0;
            hv.group.rotation.y = heading;
            if (hv.cloudBody) {
              const swell = 0.92 + Math.sin(elapsed * 7.5) * 0.14;
              hv.cloudBody.scale.set(1, swell * fade, 1);
            }
            if (Math.random() < 0.7) {
              spawnParticleBurst(
                haz.x + (Math.random() - 0.5) * haz.radius,
                0.85,
                haz.z + (Math.random() - 0.5) * haz.radius,
                2,
                '#e0fbfc',
                0.85,
                2.8,
                0.78,
              );
            }
          } else if (hv.kind === 'volcano_eruption') {
            const hazAge = Math.max(0, haz.duration - haz.remaining);
            // Phase 1 (0 -> 1.15s): Blocky Volcano Cone heaves upward out of the earth
            const riseRaw = Math.min(1, hazAge / 1.15);
            const riseEase = 1 - Math.pow(1 - riseRaw, 3);
            // Phase 2 (0.85 -> 1.95s): Molten lava channels cascade down the flanks from crater rim to base
            const lavaFlowProg = Math.max(0, Math.min(1, (hazAge - 0.85) / 1.1));

            const coneGroup = hv.group.userData.coneGroup as THREE.Group | undefined;
            if (coneGroup) {
              coneGroup.scale.set(fade, Math.max(0.04, riseEase * fade), fade);
            }
            const lavaStreams = hv.group.userData.lavaStreams as THREE.Mesh[] | undefined;
            if (lavaStreams) {
              for (let li = 0; li < lavaStreams.length; li++) {
                const lm = lavaStreams[li];
                const stepIdx = (lm.userData.stepIndex as number) || 0;
                const stepThreshold = stepIdx / 6;
                const stepLocal = Math.max(0, Math.min(1, (lavaFlowProg - stepThreshold) * 3.2));
                if (stepLocal <= 0.01) {
                  lm.visible = false;
                } else {
                  lm.visible = true;
                  const pulse = 0.92 + Math.sin(elapsed * 10 - stepIdx * 0.9) * 0.12;
                  lm.scale.set(
                    (lm.userData.targetScaleX as number) * stepLocal * pulse,
                    (lm.userData.targetScaleY as number) * stepLocal,
                    (lm.userData.targetScaleZ as number) * stepLocal * pulse,
                  );
                }
              }
            }

            if (hv.ringMesh) {
              const basePoolScale = Math.max(0.08, lavaFlowProg * haz.radius * (0.58 + Math.sin(elapsed * 7) * 0.06) * fade);
              hv.ringMesh.scale.setScalar(basePoolScale);
              hv.ringMesh.rotation.set(0, elapsed * 0.9, 0);
            }
            if (hv.secondaryRingMesh) {
              const innerPoolScale = Math.max(0.06, riseEase * haz.radius * (0.3 + Math.cos(elapsed * 9) * 0.05) * fade);
              hv.secondaryRingMesh.scale.setScalar(innerPoolScale);
            }
            if (hv.cloudBody) {
              const plumeScale = Math.max(0.01, Math.min(1, (hazAge - 0.55) / 0.85) * fade);
              hv.cloudBody.rotation.y = elapsed * 0.45;
              hv.cloudBody.position.y = Math.sin(elapsed * 2.4) * 0.35;
              hv.cloudBody.scale.setScalar(plumeScale);
            }
            if (hv.vortexMotes) {
              for (let mi = 0; mi < hv.vortexMotes.length; mi++) {
                const vm = hv.vortexMotes[mi];
                if (hazAge < 0.75) {
                  vm.mesh.visible = false;
                  continue;
                }
                vm.mesh.visible = true;
                const cycle = (elapsed * vm.speed + vm.phase) % 1;
                const r = cycle * haz.radius * 0.75;
                const theta = vm.baseAngle + elapsed * 1.4;
                vm.mesh.position.set(Math.cos(theta) * r, 1.9 + Math.sin(cycle * Math.PI) * 4.2, Math.sin(theta) * r);
                vm.mesh.scale.setScalar(0.34 * (1 - cycle * 0.5) * fade);
              }
            }
            if (Math.random() < 0.65) {
              if (hazAge < 0.85) {
                spawnRisingParticles(haz.x, hy + 0.25, haz.z, 3, '#78716c', haz.radius * 0.45, 4.2, 0.9, 1.2);
              } else {
                spawnRisingParticles(haz.x, hy + 1.8, haz.z, 3, '#ff5400', haz.radius * 0.45, 6.2, 1.0, 1.3);
                spawnRisingParticles(haz.x, hy + 2.2, haz.z, 2, '#334155', haz.radius * 0.6, 5.0, 1.2, 1.6);
              }
            }
          } else if (hv.kind === 'undead_portal') {
            if (hv.ringMesh) {
              hv.ringMesh.rotation.set(0, elapsed * 1.6, 0);
            }
            if (hv.secondaryRingMesh) {
              hv.secondaryRingMesh.rotation.set(0, elapsed * 1.2, 0);
              hv.secondaryRingMesh.scale.setScalar(haz.radius * (0.72 + Math.sin(elapsed * 4) * 0.06) * fade);
            }
            if (hv.vortexMotes) {
              for (let mi = 0; mi < hv.vortexMotes.length; mi++) {
                const vm = hv.vortexMotes[mi];
                const ang = vm.baseAngle + elapsed * 2.6 * vm.speed;
                const r = 1.4 + Math.sin(elapsed * 3 + mi) * 0.45;
                vm.mesh.position.set(Math.cos(ang) * r, 2.0 + Math.sin(ang * 2) * 1.1, Math.sin(ang) * r);
                vm.mesh.rotation.set(elapsed * 3, ang, elapsed * 2);
              }
            }
            if (Math.random() < 0.38) {
              spawnRisingParticles(haz.x, hy + 0.4, haz.z, 2, '#a855f7', 1.6, 2.4, 0.8, 1.0);
            }
            hv.group.scale.setScalar(Math.max(0.05, fade));
          } else if (hv.kind === 'alien_mothership') {
            const beaconLeft = haz.beaconTimer ?? 0;
            const hazAge = Math.max(0, haz.duration - haz.remaining);
            const slideInDur = 2.3;
            const departStart = 12.5;
            const departDur = Math.max(1.5, haz.duration - departStart);
            const yaw = 0.68;
            const fwdX = Math.sin(yaw);
            const fwdZ = Math.cos(yaw);

            let travelZ = 0;
            let departFrac = 0;
            let pitchAdj = 0;
            if (hazAge < slideInDur) {
              // Slow hover slide-in from off-world horizon at full 1.0 scale (no fade-in)
              const tIn = THREE.MathUtils.clamp(hazAge / slideInDur, 0, 1);
              const easeOut = 1 - Math.pow(1 - tIn, 3);
              travelZ = -78.0 * (1 - easeOut);
              pitchAdj = 0.03 * (1 - easeOut);
            } else if (hazAge < departStart) {
              // Stationary ~10s siege hover locked directly over target
              travelZ = 0;
            } else {
              // Gradual sublight spool-up -> rapid hyperspace acceleration ahead
              departFrac = THREE.MathUtils.clamp((hazAge - departStart) / departDur, 0, 1);
              travelZ = 14.0 * departFrac + 245.0 * Math.pow(departFrac, 3.6);
              pitchAdj = -0.06 * Math.sin(Math.min(1, departFrac * 2.2) * Math.PI * 0.5);
            }

            if (hv.cloudBody) {
              const hoverY = 22.0 + Math.sin(elapsed * 0.95) * 0.35;
              hv.cloudBody.position.set(fwdX * travelZ, hoverY, fwdZ * travelZ);
              hv.cloudBody.scale.setScalar(1.0);
              hv.cloudBody.rotation.y = yaw;
              hv.cloudBody.rotation.z = Math.sin(elapsed * 0.72) * 0.018 * (1 - departFrac);
              hv.cloudBody.rotation.x =
                pitchAdj + Math.cos(elapsed * 0.54) * 0.014 * (1 - departFrac);
            }
            const reactorDrums = hv.group.userData.reactorDrums as THREE.Object3D[] | undefined;
            if (reactorDrums) {
              const spinBoost = 1 + departFrac * 4.5;
              for (let di = 0; di < reactorDrums.length; di++) {
                reactorDrums[di].rotation.z =
                  elapsed * spinBoost * (di % 2 === 0 ? 1.35 : -1.75);
              }
            }
            const engineGlowMeshes = hv.group.userData.engineGlowMeshes as
              | THREE.Object3D[]
              | undefined;
            if (engineGlowMeshes) {
              for (let ei = 0; ei < engineGlowMeshes.length; ei++) {
                const flicker = 0.9 + Math.sin(elapsed * 20.0 + ei * 1.4) * 0.24;
                const widthScale = 1.0 + departFrac * 0.65;
                const lengthScale =
                  (hazAge < slideInDur ? 1.35 : 1.0) * flicker + departFrac * 7.2;
                engineGlowMeshes[ei].scale.set(widthScale, widthScale, lengthScale);
              }
            }
            const turretPivots = hv.group.userData.turretPivots as THREE.Object3D[] | undefined;
            if (turretPivots) {
              for (let ti = 0; ti < turretPivots.length; ti++) {
                turretPivots[ti].rotation.y = Math.sin(elapsed * 1.15 + ti * 0.9) * 0.65;
              }
            }
            const tractorBeam = hv.group.userData.tractorBeam as THREE.Object3D | undefined;
            if (tractorBeam) {
              tractorBeam.visible = hazAge >= 1.9 && hazAge < departStart;
              const bPulse = 0.85 + Math.sin(elapsed * 6.5) * 0.25;
              tractorBeam.scale.set(2.35 * bPulse, 7.25, 2.35 * bPulse);
            }
            if (hv.ringMesh) {
              // Dreadnought ground shadow glides synchronously with the hovering/accelerating ship
              hv.ringMesh.position.set(fwdX * travelZ, 0.14, fwdZ * travelZ);
              hv.ringMesh.scale.setScalar(1.0);
              hv.ringMesh.rotation.y = yaw;
              const shadowMat = (hv.ringMesh as THREE.Mesh).material;
              if (shadowMat instanceof THREE.MeshBasicMaterial) {
                const distFade = THREE.MathUtils.clamp(1 - Math.max(0, Math.abs(travelZ) - 52) / 50, 0, 1);
                shadowMat.opacity = 0.5 * distFade;
              }
            }
            if (hv.secondaryRingMesh) {
              hv.secondaryRingMesh.visible = beaconLeft > 0;
              hv.secondaryRingMesh.scale.setScalar(1.6 + Math.sin(elapsed * 14) * 0.9);
            }

            // Hyperspace Arrival & Departure Ripple VFX
            const hyperVfx = hv.group.userData.hyperVfx as HyperspaceRippleEffectsVisual | undefined;
            if (hyperVfx) {
              const safeT = wrapShaderTime(elapsed);
              const animatePortalRig = (
                rig: HyperspacePortalRig,
                active: boolean,
                progress: number,
                envelope: number,
                direction: number,
                posTravel: number,
                streakBoost: number,
              ) => {
                rig.group.visible = active;
                if (!active) return;
                rig.group.position.set(fwdX * posTravel, 22.0, fwdZ * posTravel);
                rig.group.rotation.y = yaw;
                rig.discMat.uniforms.uTime.value = safeT;
                rig.discMat.uniforms.uProgress.value = progress;
                rig.discMat.uniforms.uOpacity.value = 0.92 * envelope;
                rig.discMat.uniforms.uDirection.value = direction;
                const discScale =
                  direction < 0
                    ? 1.05 - progress * 0.42
                    : 0.58 + progress * 1.08;
                rig.discMesh.scale.setScalar(discScale);

                for (let ri = 0; ri < rig.shockRings.length; ri++) {
                  const rPhase =
                    direction < 0
                      ? (progress * 1.8 + ri * 0.33) % 1.0
                      : THREE.MathUtils.clamp((progress - ri * 0.16) / 0.72, 0, 1);
                  const rMesh = rig.shockRings[ri];
                  const visibleRing = direction < 0 ? envelope > 0.05 : rPhase > 0 && rPhase < 1;
                  rMesh.visible = visibleRing;
                  if (visibleRing) {
                    const rad =
                      direction < 0
                        ? 11.5 - rPhase * 8.2
                        : 3.0 + rPhase * 15.5;
                    rMesh.scale.set(rad, rad * 0.76, 1.0);
                    rig.ringMats[ri].opacity =
                      (direction < 0 ? 0.55 * (1 - Math.abs(rPhase - 0.5) * 1.6) : (1 - rPhase) * Math.min(1, rPhase * 5)) *
                      envelope;
                  }
                }

                rig.streakMat.opacity = envelope * streakBoost;
                for (let si = 0; si < rig.warpStreaks.length; si++) {
                  const st = rig.warpStreaks[si];
                  const stLen = 3.5 + streakBoost * 18.0 * (0.7 + (si % 3) * 0.25);
                  st.scale.set(1.0, 1.0, stLen);
                  st.position.z =
                    (((si % 4) - 1.5) * 1.8 + (direction > 0 ? progress * 7.5 : -progress * 4.5));
                }
              };

              // 1. Hyperspace Entry Aperture & Arrival Ripples (0.0 -> 2.65s)
              const entryWin = 2.65;
              const entryActive = hazAge < entryWin;
              const entryProg = THREE.MathUtils.clamp(hazAge / entryWin, 0, 1);
              const entryEnv = Math.sin(entryProg * Math.PI);
              animatePortalRig(hyperVfx.entryPortal, entryActive, entryProg, entryEnv, 1.0, -19.5, 0.85 * (1 - entryProg * 0.6));

              if (hazAge >= 0.45 && hazAge < 1.2 && !hv.group.userData.entryFlashDone) {
                hv.group.userData.entryFlashDone = true;
                triggerLightFlash(haz.x + fwdX * -14, hy + 21, haz.z + fwdZ * -14, '#bfdbfe', 24);
                spawnParticleBurst(haz.x + fwdX * -14, hy + 20, haz.z + fwdZ * -14, 24, '#dbeafe', 0.9, 6.5, 0.95);
                trauma = Math.min(1.0, trauma + 0.26);
              } else if (hazAge >= 1.2) {
                hv.group.userData.entryFlashDone = true;
              }

              // 2. Pre-Departure Hyperdrive Spool-up & Departure Hyperspace Jump Ripple (11.2 -> end)
              const spoolStart = 11.2;
              const departPunchStart = 12.65;
              if (hazAge >= spoolStart && hazAge < departPunchStart) {
                const spoolT = THREE.MathUtils.clamp((hazAge - spoolStart) / (departPunchStart - spoolStart), 0, 1);
                animatePortalRig(hyperVfx.exitPortal, true, spoolT, 0.28 + spoolT * 0.65, -1.0, 19.5, 0.35 + spoolT * 0.45);
              } else if (hazAge >= departPunchStart) {
                const punchT = THREE.MathUtils.clamp(
                  (hazAge - departPunchStart) / Math.max(1.1, haz.duration - departPunchStart),
                  0,
                  1,
                );
                const punchEnv = Math.sin(punchT * Math.PI);
                animatePortalRig(hyperVfx.exitPortal, true, punchT, Math.max(0.18, punchEnv), 1.0, 19.5, 0.95);
                if (hazAge >= 12.78 && hazAge < 13.5 && !hv.group.userData.exitFlashDone) {
                  hv.group.userData.exitFlashDone = true;
                  triggerLightFlash(haz.x + fwdX * 16, hy + 21, haz.z + fwdZ * 16, '#dbeafe', 26);
                  spawnParticleBurst(haz.x + fwdX * 16, hy + 20, haz.z + fwdZ * 16, 28, '#e0f2fe', 0.95, 7.5, 1.0);
                  trauma = Math.min(1.0, trauma + 0.28);
                } else if (hazAge >= 13.5) {
                  hv.group.userData.exitFlashDone = true;
                }
              } else {
                hyperVfx.exitPortal.group.visible = false;
              }

              // 3. Hull-Wrapping Spatial Wake Ripples peeling across the mothership body
              const wakeArrivalActive = hazAge >= 0.2 && hazAge < 2.55;
              const wakeDepartActive = hazAge >= 11.4 && hazAge < 14.4;
              hyperVfx.wakeGroup.visible = wakeArrivalActive || wakeDepartActive;
              if (hyperVfx.wakeGroup.visible) {
                const hullY = 22.0 + Math.sin(elapsed * 0.95) * 0.35;
                hyperVfx.wakeGroup.position.set(fwdX * travelZ, hullY, fwdZ * travelZ);
                hyperVfx.wakeGroup.rotation.y = yaw;
                const wakeWindowT = wakeArrivalActive
                  ? THREE.MathUtils.clamp((hazAge - 0.2) / 2.35, 0, 1)
                  : THREE.MathUtils.clamp((hazAge - 11.4) / 3.0, 0, 1);
                const wakeEnv = Math.sin(wakeWindowT * Math.PI);
                for (let wi = 0; wi < hyperVfx.wakeRings.length; wi++) {
                  const wPhase = (wakeWindowT * 2.2 + wi * 0.33) % 1.0;
                  const wr = hyperVfx.wakeRings[wi];
                  const zSlide = wakeArrivalActive
                    ? 12.5 - wPhase * 25.0
                    : -11.0 + wPhase * 24.0;
                  wr.position.set(0, 0, zSlide);
                  const wRad = 3.4 + wPhase * 7.2;
                  wr.scale.set(wRad, wRad * 0.72, 1.0);
                  hyperVfx.wakeMats[wi].opacity =
                    (1 - Math.abs(wPhase - 0.45) * 1.45) * wakeEnv * 0.72;
                }
              }

              // 4. Ground Atmospheric Pressure Ripple beneath the dreadnought on arrival & departure
              const gArrActive = hazAge >= 0.85 && hazAge < 2.65;
              const gDepActive = hazAge >= 12.35 && hazAge < 14.65;
              hyperVfx.groundRippleMesh.visible = gArrActive || gDepActive;
              if (hyperVfx.groundRippleMesh.visible) {
                const gp = gArrActive
                  ? THREE.MathUtils.clamp((hazAge - 0.85) / 1.8, 0, 1)
                  : THREE.MathUtils.clamp((hazAge - 12.35) / 2.3, 0, 1);
                const gEnv = Math.sin(gp * Math.PI);
                hyperVfx.groundRippleMat.uniforms.uTime.value = safeT;
                hyperVfx.groundRippleMat.uniforms.uProgress.value = gp;
                hyperVfx.groundRippleMat.uniforms.uOpacity.value = 0.78 * gEnv;
                hyperVfx.groundRippleMesh.scale.setScalar(haz.radius * (1.25 + gp * 1.65));
              }
            }
          } else if (hv.kind === 'chrono_field') {
            if (hv.ringMesh) {
              hv.ringMesh.rotation.set(0, elapsed * 1.6, 0);
              hv.ringMesh.scale.setScalar(haz.radius * (0.98 + Math.sin(elapsed * 4.5) * 0.05) * fade);
            }
            if (hv.secondaryRingMesh) {
              hv.secondaryRingMesh.rotation.set(0, elapsed * 2.1, 0);
              hv.secondaryRingMesh.scale.setScalar(haz.radius * 0.72 * fade);
            }
            if (hv.vortexMotes) {
              for (let mi = 0; mi < hv.vortexMotes.length; mi++) {
                const vm = hv.vortexMotes[mi];
                const cycle = (elapsed * 0.75 + vm.phase) % 1;
                const ang = vm.baseAngle + elapsed * 2.4;
                const r = haz.radius * (0.35 + (mi % 4) * 0.16);
                vm.mesh.position.set(Math.cos(ang) * r, 0.3 + cycle * 3.8, Math.sin(ang) * r);
                vm.mesh.rotation.y = elapsed * 4;
              }
            }
          } else if (hv.kind === 'orbital_beam') {
            hv.group.position.set(haz.x, hy, haz.z);
            const pulse = 0.86 + Math.sin(elapsed * 28) * 0.18;
            if (hv.ringMesh) {
              hv.ringMesh.rotation.set(0, elapsed * 2.2, 0);
              hv.ringMesh.scale.setScalar(Math.max(2.0, haz.radius * 0.88) * pulse * fade);
            }
            if (hv.secondaryRingMesh) {
              hv.secondaryRingMesh.scale.set(1.75 * pulse * fade, 14.0, 1.75 * pulse * fade);
            }
            if (Math.random() < 0.85) {
              spawnParticleBurst(haz.x, hy + 0.35, haz.z, 4, '#fb923c', 1.4, 6.2, 0.95);
            }
          } else if (hv.kind === 'gravity_anomaly') {
            if (hv.ringMesh) {
              hv.ringMesh.rotation.set(0, elapsed * 2.0, 0);
              hv.ringMesh.scale.setScalar(haz.radius * (0.98 + Math.sin(elapsed * 6) * 0.06) * fade);
            }
            if (hv.gravityRings) {
              for (let gi = 0; gi < hv.gravityRings.length; gi++) {
                const gr = hv.gravityRings[gi];
                const riseCycle = (elapsed * 0.9 + gi / hv.gravityRings.length) % 1;
                gr.position.y = 0.25 + riseCycle * 5.2;
                gr.scale.setScalar(haz.radius * (0.92 - riseCycle * 0.45) * fade);
                gr.rotation.set(0, elapsed * (1.8 + gi * 0.5), 0);
              }
            }
            if (Math.random() < 0.55) {
              spawnRisingParticles(haz.x, hy + 0.2, haz.z, 2, '#c084fc', haz.radius * 0.75, 4.2, 0.85, 1.0);
            }
          }
        }
      }
      if (hazardMeshes.size > 0) {
        for (const [id, hv] of hazardMeshes.entries()) {
          if (hv.seenStamp !== syncFrameStamp) {
            disposeHazardVisual(hv);
            hazardMeshes.delete(id);
          }
        }
      }

      // 6. Sync active tile fire animated sprites & billowing smoke sprites
      const safeSpriteElapsed = wrapShaderTime(elapsed);
      spriteBundle.fireMaterial.uniforms.uTime.value = safeSpriteElapsed;
      spriteBundle.smokeMaterial.uniforms.uTime.value = safeSpriteElapsed;
      spriteBundle.breathScrollTexture.offset.y = -((safeSpriteElapsed * 4.2) % 1.0);

      let fireTileCount = 0;
      let fireSpriteCount = 0;
      for (let fi = 0; fi < activeFireTileIndices.length && fireTileCount < MAX_FIRE_TILES; fi++) {
        const i = activeFireTileIndices[fi];
        const t = simState.tiles[i];
        if (
          t.onFireTimer > 0 &&
          t.height > 0 &&
          t.resourceNode !== 'ore_vein' &&
          t.x >= cullMinX &&
          t.x <= cullMaxX &&
          t.z >= cullMinZ &&
          t.z <= cullMaxZ
        ) {
          const fy = tileCurrentY[i] || t.height * HEIGHT_STEP + 0.25;
          const phase = ((t.x * 13 + t.z * 29) & 31) / 32;
          const fadeEnv = Math.min(1, t.onFireTimer / 0.8);
          const hasTreeOrStructure =
            Boolean(t.buildingId) || t.resourceNode === 'timber_grove' || Boolean(t.burntTree);
          const intensityBoost = hasTreeOrStructure ? 1.24 : 0.98;
          const pulse = (0.92 + Math.sin(elapsed * 16 + t.x * 3 + t.z * 7) * 0.12) * intensityBoost;
          // Creeping spread radius: flames expand outward toward tile edges as the fire engulfs the tile
          const burnProgress = Math.max(0.18, Math.min(1.0, 1.0 - (t.onFireTimer - 0.6) / 4.2));
          const spreadRadius = 0.16 + burnProgress * 0.26;

          if (t.fireColor) {
            _fireTintCol.set(t.fireColor);
          } else {
            _fireTintCol.copy(_whiteCol);
          }

          // 1. Primary central hearth blaze
          _dummyPos.set(t.x, fy, t.z);
          _dummyScale.set(pulse * 1.04, pulse * (1.02 + fadeEnv * 0.18), 1);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          fireSpriteInst.setMatrixAt(fireSpriteCount, _dummyMatrix);
          fireDataArray[fireSpriteCount * 2] = phase;
          fireDataArray[fireSpriteCount * 2 + 1] = 0.96 * fadeEnv;
          fireColorArray[fireSpriteCount * 3] = _fireTintCol.r;
          fireColorArray[fireSpriteCount * 3 + 1] = _fireTintCol.g;
          fireColorArray[fireSpriteCount * 3 + 2] = _fireTintCol.b;
          fireSpriteCount++;

          // 2. Creeping perimeter flame tongues spreading outward across the tile & up into tree canopies
          const clusterCount = hasTreeOrStructure ? 4 : 3;
          const baseAng = phase * Math.PI * 2;
          for (let ci = 0; ci < clusterCount && fireSpriteCount < MAX_FIRE_SPRITES; ci++) {
            const ang = baseAng + (ci * (Math.PI * 2)) / clusterCount + Math.sin(elapsed * 2.4 + ci * 1.9) * 0.18;
            const isCanopyFlame = hasTreeOrStructure && ci >= 2;
            const rad = isCanopyFlame ? spreadRadius * 0.62 : spreadRadius * (0.85 + (ci & 1) * 0.24);
            const ox = Math.cos(ang) * rad;
            const oz = Math.sin(ang) * rad;
            const oy = isCanopyFlame
              ? ci === 2
                ? 0.34
                : 0.62
              : 0.02 + (ci & 1) * 0.04;
            const subScaleW = isCanopyFlame ? pulse * 0.76 : pulse * (0.64 + (ci & 1) * 0.1);
            const subScaleH = isCanopyFlame ? pulse * 0.88 : pulse * (0.68 + burnProgress * 0.16);
            _dummyPos.set(t.x + ox, fy + oy, t.z + oz);
            _dummyScale.set(subScaleW, subScaleH, 1);
            _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
            fireSpriteInst.setMatrixAt(fireSpriteCount, _dummyMatrix);
            fireDataArray[fireSpriteCount * 2] = (phase + 0.27 * (ci + 1)) % 1.0;
            fireDataArray[fireSpriteCount * 2 + 1] = (isCanopyFlame ? 0.9 : 0.84) * fadeEnv;
            fireColorArray[fireSpriteCount * 3] = _fireTintCol.r;
            fireColorArray[fireSpriteCount * 3 + 1] = _fireTintCol.g;
            fireColorArray[fireSpriteCount * 3 + 2] = _fireTintCol.b;
            fireSpriteCount++;
          }

          const smokeCycle = (elapsed * 1.45 + (t.x * 0.37 + t.z * 0.53)) % 1.0;
          const smokeY = fy + (hasTreeOrStructure ? 1.08 : 0.82) + smokeCycle * 2.05;
          const smokeScale = (0.6 + smokeCycle * 0.84) * (0.88 + 0.32 * intensityBoost);
          _dummyPos.set(
            t.x + Math.sin(elapsed * 2.6 + t.z) * 0.22,
            smokeY,
            t.z + Math.cos(elapsed * 2.6 + t.x) * 0.22,
          );
          _dummyScale.set(smokeScale, smokeScale, 1);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          fireSmokeInst.setMatrixAt(fireTileCount, _dummyMatrix);
          smokeDataArray[fireTileCount * 2] = (phase + smokeCycle * 0.5) % 1.0;
          smokeDataArray[fireTileCount * 2 + 1] = Math.sin(smokeCycle * Math.PI) * 0.62 * fadeEnv;

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

    let emaFrameMs = 16.7;
    let autoTrimLevel: 0 | 1 | 2 = 0;
    let autoTrimCooldown = 2.5;
    let gfxStaggerCooldown = 0;
    let shadowFrameCounter = 0;
    let appliedShadowsEnabled = initialGfxProfile.shadowsEnabled;
    let appliedShadowMapSize: 512 | 1024 = initialGfxProfile.shadowMapSize;
    let appliedShadowStride: number = initialGfxProfile.shadowUpdateStride;
    let lastShadowCenterX = gridCenter;
    let lastShadowCenterZ = gridCenter;
    let appliedCloudsQuality: 'full' | 'reduced' | 'off' = initialGfxProfile.cloudsAndSky;
    let appliedFoliageFactor = initialGfxProfile.foliageFactor;

    skyClouds.setQuality(appliedCloudsQuality);
    pixelSpace.setQuality('full');
    worldUnderglow.mesh.visible = appliedCloudsQuality !== 'off';

    function tick() {
      const now = performance.now();
      const rawMs = now - lastTime;
      const rawDt = rawMs / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.15);
      elapsedTotal += dt;
      const shaderElapsed = wrapShaderTime(elapsedTotal);

      const currentGameState = propsRef.current.gameState;
      if (prevGameState !== currentGameState && currentGameState === 'playing') {
        autoTrimCooldown = 3.5;
        emaFrameMs = 16.7;
        autoOptimizer.reset();
      }

      // Auto-Optimize FPS monitor (active only when Low-End Mode is selected; Strict Lossless skips downgrades)
      const gfxSettings = propsRef.current.graphicsSettings;
      const isStrictLossless = gfxSettings.strictLossless !== false;
      if (!isSoftwareGl && !isStrictLossless && gfxSettings.autoOptimizeFps && currentGameState === 'playing') {
        const clampedMs = Math.min(120, Math.max(4, rawMs));
        emaFrameMs = emaFrameMs * 0.92 + clampedMs * 0.08;
        if (autoTrimCooldown > 0) {
          autoTrimCooldown = Math.max(0, autoTrimCooldown - dt);
        } else if (emaFrameMs > 28 && autoTrimLevel < 2) {
          autoTrimLevel = (autoTrimLevel + 1) as 0 | 1 | 2;
          autoTrimCooldown = 2.5;
        } else if (emaFrameMs < 15.0 && autoTrimLevel > 0) {
          autoTrimLevel = (autoTrimLevel - 1) as 0 | 1 | 2;
          autoTrimCooldown = 4.0;
        }
      } else {
        autoTrimLevel = 0;
      }

      autoOptDecisions = autoOptimizer.update({
        rawFrameMs: rawMs,
        dt,
        frustumSize,
        visibleUnitCount: visibleUnitCountLastFrame,
        totalUnitCount: simRef.current.units.length,
        isPlaying: currentGameState === 'playing',
        isSoftwareGl,
        autoEnabled: gfxSettings.autoOptimizeFps,
        strictLossless: isStrictLossless,
      });

      activeGfxProfile = resolveGraphicsProfile(gfxSettings, autoTrimLevel);

      // Scalar shadow update cadence (zero reallocation/shader compile cost)
      const wantShadows = !isSoftwareGl && activeGfxProfile.shadowsEnabled;
      const wantStride = Math.max(
        activeGfxProfile.shadowUpdateStride,
        autoOptDecisions.shadowUpdateStride,
      );
      if (wantStride !== appliedShadowStride) {
        appliedShadowStride = wantStride;
        renderer.shadowMap.autoUpdate = false;
      }
      if (appliedShadowsEnabled) {
        // Sim ticks at 15 Hz, so 30 Hz shadow refreshes (stride >= 2) plus immediate updates on
        // camera/frustum shifts look identical while halving GPU shadow-pass cost.
        const effectiveStride = Math.max(2, appliedShadowStride);
        shadowFrameCounter = (shadowFrameCounter + 1) % effectiveStride;
        if (shadowFrameCounter === 0) {
          renderer.shadowMap.needsUpdate = true;
        }
      }

      // Stagger heavy graphics/pipeline subsystem changes across separate frames so toggling
      // presets or multiple features never triggers a single-frame stall
      if (gfxStaggerCooldown > 0) {
        gfxStaggerCooldown--;
      } else if (activeGfxProfile.cloudsAndSky !== appliedCloudsQuality) {
        appliedCloudsQuality = activeGfxProfile.cloudsAndSky;
        skyClouds.setQuality(appliedCloudsQuality);
        worldUnderglow.mesh.visible = appliedCloudsQuality !== 'off';
        gfxStaggerCooldown = 2;
      } else if (Math.abs(activeGfxProfile.foliageFactor - appliedFoliageFactor) > 0.01) {
        appliedFoliageFactor = activeGfxProfile.foliageFactor;
        applyAmbientFoliageFactor(appliedFoliageFactor);
        gfxStaggerCooldown = 2;
      } else if (wantShadows !== appliedShadowsEnabled) {
        appliedShadowsEnabled = wantShadows;
        // Adjust intensity & autoUpdate rather than toggling shadowMap.enabled/castShadow so
        // Three.js never recompiles 60+ shaders synchronously on toggle
        keyLight.shadow.intensity = wantShadows ? 1 : 0;
        renderer.shadowMap.autoUpdate = false;
        if (wantShadows) renderer.shadowMap.needsUpdate = true;
        gfxStaggerCooldown = 2;
      } else if (wantShadows && activeGfxProfile.shadowMapSize !== appliedShadowMapSize) {
        appliedShadowMapSize = activeGfxProfile.shadowMapSize;
        keyLight.shadow.mapSize.set(appliedShadowMapSize, appliedShadowMapSize);
        if (keyLight.shadow.map) {
          keyLight.shadow.map.dispose();
          keyLight.shadow.map = null;
        }
        renderer.shadowMap.needsUpdate = true;
        gfxStaggerCooldown = 2;
      }

      if (lastAppliedPixelScale !== propsRef.current.pixelScale) {
        lastAppliedPixelScale = propsRef.current.pixelScale;
        updateSize();
      }

      // Camera action requests from HUD buttons & game state lifecycle transitions
      const camAct = cameraActionRef.current;
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
        desiredFrustum = getResponsiveTitleFrustum(getCurrentAspect());
        const center = (simRef.current.gridSize - 1) / 2;
        camDesiredTarget.set(center, 1.2, center);
      }
      prevGameState = currentGameState;

      const maxZoomOut = getResponsiveMaxZoomOut(simRef.current.gridSize, getCurrentAspect());
      if (camAct.rotateDelta !== 0) {
        camDesiredYaw += camAct.rotateDelta;
        camAct.rotateDelta = 0;
      }
      if (camAct.zoomDelta !== 0) {
        const scaledStep = camAct.zoomDelta * Math.max(0.45, desiredFrustum / 32);
        desiredFrustum = THREE.MathUtils.clamp(desiredFrustum + scaledStep, 7.5, maxZoomOut);
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

      // Live Entity / Random Event Cinematic Camera Tracking
      const activeEvt = simRef.current.activeWorldEvent;
      const evtCinematicOn =
        currentGameState === 'playing' &&
        Boolean(activeEvt && activeEvt.cinematicActive && !activeEvt.dismissedByUser && activeEvt.remaining > 0);
      if (evtCinematicOn && activeEvt) {
        if (!wasEventCinematicActive) {
          preEventFrustum = desiredFrustum;
          preEventCamTarget.copy(camDesiredTarget);
          hasPreEventCamera = true;
          desiredFrustum = THREE.MathUtils.clamp(
            activeEvt.kind === 'huge_asteroid' && !activeEvt.impactTriggered ? 19.5 : 18.5,
            7.5,
            maxZoomOut,
          );
          propsRef.current.onSyncHud();
        } else if (activeEvt.kind === 'huge_asteroid' && activeEvt.impactTriggered) {
          desiredFrustum = THREE.MathUtils.lerp(
            desiredFrustum,
            THREE.MathUtils.clamp(34.0, 7.5, maxZoomOut),
            Math.min(1, dt * 3.2),
          );
        }
        camDesiredTarget.x = THREE.MathUtils.clamp(activeEvt.trackX, 2, simRef.current.gridSize - 3);
        camDesiredTarget.y = Math.max(1.2, activeEvt.trackY);
        camDesiredTarget.z = THREE.MathUtils.clamp(activeEvt.trackZ, 2, simRef.current.gridSize - 3);
        wasEventCinematicActive = true;
      } else {
        if (wasEventCinematicActive) {
          if (hasPreEventCamera) {
            desiredFrustum = THREE.MathUtils.clamp(preEventFrustum, 7.5, maxZoomOut);
            camDesiredTarget.set(
              THREE.MathUtils.clamp(preEventCamTarget.x, 2, simRef.current.gridSize - 3),
              1.2,
              THREE.MathUtils.clamp(preEventCamTarget.z, 2, simRef.current.gridSize - 3),
            );
            hasPreEventCamera = false;
          } else {
            if (activeEvt?.dismissedByUser) {
              desiredFrustum = THREE.MathUtils.clamp(Math.max(desiredFrustum + 14, 34), 7.5, maxZoomOut);
            }
            camDesiredTarget.y = 1.2;
          }
          wasEventCinematicActive = false;
          propsRef.current.onSyncHud();
        }

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
      }

      // Continuous stationary hold casting for thermal brushes (freeze_snap / heat_wave)
      if (
        isHoldPainting &&
        hoveredTileCoords &&
        currentGameState === 'playing' &&
        propsRef.current.brushInputMode === 'hold' &&
        propsRef.current.activeTool.kind === 'power' &&
        (propsRef.current.activeTool.power === 'freeze_snap' || propsRef.current.activeTool.power === 'heat_wave')
      ) {
        applyHoldStrokeToTile(hoveredTileCoords.x, hoveredTileCoords.z, now);
      }

      // Decoupled fixed-timestep simulation accumulator (15 Hz) with 60 FPS visual interpolation!
      // Eliminates 4x redundant AI/tile scans per second while keeping silky-smooth 60Hz motion.
      simSteppedThisFrame = false;
      const clampedSimSpeed = clampSimulationSpeed(propsRef.current.timeScale);
      const simStepDt = Math.min(dt, autoOptDecisions.maxSimDt);
      if (hitstopTimer > 0) {
        hitstopTimer = Math.max(0, hitstopTimer - dt);
      } else if (propsRef.current.gameState === 'playing' && clampedSimSpeed > 0) {
        simAccumulator = Math.min(FIXED_SIM_DT * 2.5, simAccumulator + simStepDt);
        let ticksThisFrame = 0;
        while (simAccumulator >= FIXED_SIM_DT && ticksThisFrame < 2) {
          const simT0 = performance.now();
          stepSimulation(simRef.current, FIXED_SIM_DT * clampedSimSpeed, { skipDragStep: true });
          lastSimTickMs = performance.now() - simT0;
          simAccumulator -= FIXED_SIM_DT;
          ticksThisFrame++;
          simSteppedThisFrame = true;
        }
        simInterpAlpha = Math.min(1, Math.max(0, simAccumulator / FIXED_SIM_DT));
      } else if (propsRef.current.gameState === 'title') {
        // Live World Camera Tour on Title Screen
        camDesiredYaw += dt * 0.18;
        simAccumulator = Math.min(FIXED_SIM_DT * 2, simAccumulator + simStepDt);
        if (simAccumulator >= FIXED_SIM_DT) {
          const simT0 = performance.now();
          stepSimulation(simRef.current, FIXED_SIM_DT * 0.35, {
            skipDragStep: true,
            skipRandomEvents: true,
          });
          lastSimTickMs = performance.now() - simT0;
          simAccumulator -= FIXED_SIM_DT;
          simSteppedThisFrame = true;
        }
        simInterpAlpha = Math.min(1, Math.max(0, simAccumulator / FIXED_SIM_DT));
      } else {
        simInterpAlpha = 1;
      }

      // Smooth kinematics for dragged units runs every frame at full 60fps (even if paused or in hitstop)
      stepDraggedUnitKinematics(simRef.current, dt);

      // Update animated one-shot power VFX BEFORE syncSceneFromSimulation so when a projectile/bolt/beam
      // impacts the ground (`!fx.impactFired`), `executeGodPowerImpact` mutates the tiles and
      // `syncSceneFromSimulation` immediately updates the 3D terrain & shader texture in the exact same frame!
      for (let i = activeBurstFx.length - 1; i >= 0; i--) {
        const fx = activeBurstFx[i];
        if (!fx.group.userData._roApplied) {
          setSubtreeRenderOrder(fx.group, 9);
          fx.group.userData._roApplied = true;
        }
        fx.age += dt;

        if (fx.kind === 'meteor' && fx.meteorMesh && fx.ringMesh) {
          const startOffX = fx.isMegaMeteor ? 24 : 15.5;
          const startOffY = fx.isMegaMeteor ? 54 : 34;
          const startOffZ = fx.isMegaMeteor ? -24 : -15.5;
          const dropPhase = Math.min(1, fx.age / fx.impactDelay);
          if (fx.isMegaMeteor && simRef.current.activeWorldEvent?.kind === 'huge_asteroid') {
            simRef.current.activeWorldEvent.elapsed = fx.age;
            simRef.current.activeWorldEvent.remaining = Math.max(0.05, fx.duration - fx.age);
          }
          if (dropPhase < 1) {
            const easeIn = fx.isMegaMeteor ? Math.pow(dropPhase, 1.35) : Math.pow(dropPhase, 1.65);
            const mx = fx.tx + startOffX * (1 - easeIn);
            const my = fx.ty + startOffY * (1 - easeIn) + 0.4;
            const mz = fx.tz + startOffZ * (1 - easeIn);
            fx.meteorMesh.position.set(mx, my, mz);
            if (fx.isMegaMeteor && simRef.current.activeWorldEvent?.kind === 'huge_asteroid' && !simRef.current.activeWorldEvent.dismissedByUser) {
              simRef.current.activeWorldEvent.trackX = mx;
              simRef.current.activeWorldEvent.trackY = Math.max(fx.ty + 2.2, my * 0.72);
              simRef.current.activeWorldEvent.trackZ = mz;
            }
            if (fx.meteorRockCore) {
              const spinMult = fx.isMegaMeteor ? 0.55 : 1.0;
              fx.meteorRockCore.rotation.x += dt * 5.8 * spinMult;
              fx.meteorRockCore.rotation.y += dt * 4.4 * spinMult;
              fx.meteorRockCore.rotation.z += dt * 3.2 * spinMult;
            }
            (fx.materials[0] as THREE.MeshStandardMaterial).emissiveIntensity = 0.38 + easeIn * 0.65;
            // Dynamic atmospheric entry light following the falling asteroid
            vfxFlashLight.position.set(mx, Math.max(fx.ty + 3, my), mz);
            vfxFlashLight.color.set('#ff7b00');
            vfxFlashLight.intensity = (fx.isMegaMeteor ? 22 : 9) + easeIn * 26;
            // Dual contracting target lock rings on the ground before impact
            fx.ringMesh.scale.setScalar(fx.radius * (1.05 - dropPhase * 0.72));
            (fx.materials[3] as THREE.MeshBasicMaterial).opacity = 0.35 + dropPhase * 0.6;
            if (fx.outerRingMesh) {
              fx.outerRingMesh.scale.setScalar(fx.radius * (1.55 - easeIn * 1.15));
              (fx.materials[4] as THREE.MeshBasicMaterial).opacity = 0.25 + dropPhase * 0.65;
            }
            // Thick blazing comet trail + dark re-entry smoke (throttled to ~20 Hz to avoid thrashing the 650-particle pool)
            fx.particleEmitTimer = (fx.particleEmitTimer ?? 0) + dt;
            if (fx.particleEmitTimer >= 0.05) {
              fx.particleEmitTimer = 0;
              spawnParticleBurst(mx, my, mz, fx.isMegaMeteor ? 8 : 5, '#ff5400', fx.isMegaMeteor ? 2.2 : 1.1, 2.4, 1.75);
              spawnParticleBurst(mx, my, mz, fx.isMegaMeteor ? 5 : 3, '#ffee55', fx.isMegaMeteor ? 1.3 : 0.6, 1.7, 1.45);
              spawnParticleBurst(mx + 0.6, my + 0.9, mz - 0.6, fx.isMegaMeteor ? 4 : 2, '#2b2d42', fx.isMegaMeteor ? 2.3 : 1.2, 1.4, 1.9);
            }
          } else {
            if (!fx.impactFired) {
              fx.impactFired = true;
              const preImpactTile = getTileFromArray(simRef.current, fx.tx, fx.tz);
              const hitWater =
                !preImpactTile ||
                preImpactTile.height === 0 ||
                preImpactTile.terrain === 'deep_water' ||
                preImpactTile.terrain === 'shallow_water';
              if (fx.isMegaMeteor) {
                executeHugeAsteroidImpact(simRef.current, fx.tx, fx.tz);
                soundEngine.playMegaExplosion();
                if (simRef.current.activeWorldEvent?.kind === 'huge_asteroid') {
                  simRef.current.activeWorldEvent.impactTriggered = true;
                  simRef.current.activeWorldEvent.trackX = fx.tx;
                  simRef.current.activeWorldEvent.trackY = fx.ty + 2.4;
                  simRef.current.activeWorldEvent.trackZ = fx.tz;
                  if (!simRef.current.activeWorldEvent.dismissedByUser) {
                    desiredFrustum = THREE.MathUtils.clamp(Math.max(desiredFrustum, 32.0), 7.5, maxZoomOut);
                  }
                }
              } else if (fx.deferImpact) {
                executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
                soundEngine.playHeavyImpact();
              }
              fx.meteorMesh.visible = false;
              if (fx.innerDomeMesh) fx.innerDomeMesh.visible = true;
              if (fx.explosionDome) fx.explosionDome.visible = true;
              trauma = fx.isMegaMeteor ? 1.45 : 1.0;
              hitstopTimer = fx.isMegaMeteor ? 0.16 : 0.1;
              if (hitWater) {
                // Ocean Asteroid Impact -> Erupt a towering vertical Hydro-Geyser column + supersonic Mach shockwaves while 3D Tsunami waves roll out!
                fx.ringMesh.visible = fx.isMegaMeteor ? true : false;
                if (fx.outerRingMesh) fx.outerRingMesh.visible = fx.isMegaMeteor ? true : false;
                if (fx.thirdRingMesh) fx.thirdRingMesh.visible = fx.isMegaMeteor ? true : false;
                if (fx.shockWallMesh) fx.shockWallMesh.visible = fx.isMegaMeteor ? true : false;
                if (fx.outerShockWallMesh) fx.outerShockWallMesh.visible = fx.isMegaMeteor ? true : false;
                (fx.materials[2] as THREE.MeshBasicMaterial).color.setHex(0x00b4d8);
                if (fx.materials[5]) (fx.materials[5] as THREE.MeshBasicMaterial).color.setHex(0xe0fbfc);
                if (fx.materials[6]) (fx.materials[6] as THREE.MeshBasicMaterial).color.setHex(0x90e0ef);
                if (fx.materials[7]) (fx.materials[7] as THREE.MeshBasicMaterial).color.setHex(0xcaf0f8);
                triggerLightFlash(fx.tx, fx.ty + 3, fx.tz, '#48cae4', fx.isMegaMeteor ? 68 : 42);
                spawnParticleBurst(fx.tx, fx.ty + 0.5, fx.tz, fx.isMegaMeteor ? 120 : 90, '#00b4d8', fx.radius * 1.55, 16.5, 2.1);
                spawnParticleBurst(fx.tx, fx.ty + 0.8, fx.tz, fx.isMegaMeteor ? 80 : 60, '#e0fbfc', fx.radius * 1.25, 18.5, 1.75);
                spawnParticleBurst(fx.tx, fx.ty + 0.4, fx.tz, fx.isMegaMeteor ? 55 : 40, '#0077b6', fx.radius * 1.05, 12.5, 2.2);
              } else {
                if (fx.shockWallMesh) fx.shockWallMesh.visible = true;
                if (fx.outerShockWallMesh) fx.outerShockWallMesh.visible = Boolean(fx.isMegaMeteor);
                if (fx.outerRingMesh) fx.outerRingMesh.visible = true;
                if (fx.thirdRingMesh) fx.thirdRingMesh.visible = Boolean(fx.isMegaMeteor);
                if (fx.plumeGroup) fx.plumeGroup.visible = true;
                if (fx.ejectaBoulders && fx.ejectaInst) {
                  for (const eb of fx.ejectaBoulders) eb.active = true;
                  fx.ejectaInst.visible = true;
                }
                triggerLightFlash(fx.tx, fx.ty + 3.5, fx.tz, '#ffbe0b', fx.isMegaMeteor ? 75 : 42);
                // Colossal lava, white-hot blinding flash, spark & pyroclastic ash eruption
                spawnParticleBurst(fx.tx, fx.ty + 0.5, fx.tz, fx.isMegaMeteor ? 120 : 85, '#ff5400', fx.radius * 1.65, 14.5, 2.05);
                spawnParticleBurst(fx.tx, fx.ty + 0.6, fx.tz, fx.isMegaMeteor ? 75 : 45, '#fff3b0', fx.radius * 1.25, 16.5, 1.65);
                spawnParticleBurst(fx.tx, fx.ty + 0.8, fx.tz, fx.isMegaMeteor ? 60 : 35, '#2b2d42', fx.radius * 1.15, 11.5, 2.35);
              }
              if (fx.spikes) {
                for (const sp of fx.spikes) sp.visible = true;
              }
            }
            const postImpactElapsed = fx.age - fx.impactDelay;
            const wavePhase = Math.min(1, postImpactElapsed / Math.max(0.1, fx.duration - fx.impactDelay));
            const easeOut = 1 - Math.pow(1 - wavePhase, 2.4);
            const fastShockPhase = Math.min(1, postImpactElapsed / (fx.isMegaMeteor ? 3.2 : 1.8));
            const shockEase = 1 - Math.pow(1 - fastShockPhase, 2.1);

            // Sustained rumble aftershocks and radial hurricane wind gusts during mega asteroid impact
            if (fx.isMegaMeteor && fastShockPhase < 1) {
              trauma = Math.max(trauma, (1 - fastShockPhase) * 0.68);
              fx.particleEmitTimer = (fx.particleEmitTimer ?? 0) + dt;
              if (fx.particleEmitTimer >= 0.08) {
                fx.particleEmitTimer = 0;
                const gustR = 3.0 + shockEase * 28.0;
                for (let gi = 0; gi < 6; gi++) {
                  const ga = (gi / 6) * Math.PI * 2 + postImpactElapsed * 2.7;
                  const gx = fx.tx + Math.cos(ga) * gustR;
                  const gz = fx.tz + Math.sin(ga) * gustR;
                  spawnParticleBurst(
                    gx,
                    fx.ty + 0.45,
                    gz,
                    2,
                    gi % 2 === 0 ? '#ffd166' : '#adb5bd',
                    1.4,
                    4.2,
                    1.15,
                  );
                }
              }
            }

            // Animate ballistic voxel ejecta boulders flying out of the crater (1 InstancedMesh draw call)
            if (fx.ejectaBoulders && fx.ejectaInst) {
              let activeEjecta = 0;
              const ebEuler = new THREE.Euler();
              for (const eb of fx.ejectaBoulders) {
                if (!eb.active) continue;
                eb.x += eb.vx * dt;
                eb.y += eb.vy * dt;
                eb.z += eb.vz * dt;
                eb.vy -= 18.5 * dt;
                eb.rx += eb.rotX * dt;
                eb.ry += eb.rotY * dt;
                eb.rz += eb.rotZ * dt;
                if (eb.y <= fx.ty + 0.15 && postImpactElapsed > 0.25) {
                  eb.active = false;
                  spawnParticleBurst(eb.x, fx.ty + 0.2, eb.z, 4, '#ff6b35', 0.8, 3.2, 1.1);
                  continue;
                }
                _dummyPos.set(eb.x, eb.y, eb.z);
                ebEuler.set(eb.rx, eb.ry, eb.rz);
                _dummyQuat.setFromEuler(ebEuler);
                _dummyScale.setScalar(eb.scale);
                _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
                fx.ejectaInst.setMatrixAt(activeEjecta, _dummyMatrix);
                activeEjecta++;
              }
              fx.ejectaInst.count = activeEjecta;
              fx.ejectaInst.visible = activeEjecta > 0;
              if (activeEjecta > 0) fx.ejectaInst.instanceMatrix.needsUpdate = true;
            }

            // Animate rising 3D blocky mushroom plume
            if (fx.plumeGroup && fx.plumeGroup.visible) {
              const plumeRise = Math.min(1, postImpactElapsed / 4.2);
              const plumeScale = 0.45 + (1 - Math.pow(1 - plumeRise, 1.8)) * 1.95;
              fx.plumeGroup.scale.set(plumeScale, 0.4 + plumeRise * 1.85, plumeScale);
              fx.plumeGroup.position.y = fx.ty + 0.2 + plumeRise * 2.8;
              fx.plumeGroup.rotation.y += dt * 0.45;
              if (fx.materials[9]) {
                const pMat = fx.materials[9] as THREE.MeshStandardMaterial;
                pMat.emissiveIntensity = Math.max(0.05, (1 - wavePhase * 1.15) * 0.75);
                pMat.opacity = Math.max(0, Math.pow(1 - wavePhase, 0.85) * 0.92);
              }
            }

            const isWaterSplash = !fx.ringMesh.visible && !fx.isMegaMeteor;
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
                const innerPhase = Math.min(1, fastShockPhase * 1.35);
                const domeMult = fx.isMegaMeteor ? 1.35 : 1.05;
                fx.innerDomeMesh.scale.setScalar(0.8 + (1 - (1 - innerPhase) * (1 - innerPhase)) * fx.radius * domeMult);
                (fx.materials[5] as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - innerPhase) * 0.96);
              }
              if (fx.explosionDome) {
                const expMult = fx.isMegaMeteor ? 1.85 : 1.55;
                fx.explosionDome.scale.setScalar(0.8 + shockEase * fx.radius * expMult);
                (fx.materials[2] as THREE.MeshBasicMaterial).opacity = Math.pow(1 - fastShockPhase, 1.25) * 0.92;
              }
              if (fx.shockWallMesh && fx.materials[6]) {
                const wallMaxMult = fx.isMegaMeteor ? 2.15 : 2.45;
                const wallRadius = 0.8 + shockEase * fx.radius * wallMaxMult;
                const wallHeight = (fx.isMegaMeteor ? 1.4 : 0.6) + Math.sin(fastShockPhase * Math.PI) * (fx.isMegaMeteor ? 4.2 : 1.85);
                fx.shockWallMesh.scale.set(wallRadius, wallHeight, wallRadius);
                (fx.materials[6] as THREE.MeshBasicMaterial).opacity = Math.pow(1 - fastShockPhase, 1.3) * (fx.isMegaMeteor ? 0.78 : 0.65);
              }
              if (fx.outerShockWallMesh && fx.materials[7]) {
                const outerWallRadius = 1.2 + fastShockPhase * fx.radius * 2.55;
                const outerWallHeight = 1.1 + Math.sin(fastShockPhase * Math.PI) * 3.1;
                fx.outerShockWallMesh.scale.set(outerWallRadius, outerWallHeight, outerWallRadius);
                (fx.materials[7] as THREE.MeshBasicMaterial).opacity = Math.pow(1 - fastShockPhase, 1.15) * 0.58;
              }
              // Huge primary, secondary & supersonic Mach concentric shockwaves sweeping across the map
              const ring1Mult = fx.isMegaMeteor ? 2.15 : 2.85;
              fx.ringMesh.scale.setScalar(0.8 + shockEase * fx.radius * ring1Mult);
              (fx.materials[3] as THREE.MeshBasicMaterial).opacity = Math.pow(1 - fastShockPhase, 1.15) * 0.98;
              if (fx.outerRingMesh) {
                const ring2Mult = fx.isMegaMeteor ? 2.45 : 3.5;
                fx.outerRingMesh.scale.setScalar(0.5 + fastShockPhase * fx.radius * ring2Mult);
                (fx.materials[4] as THREE.MeshBasicMaterial).opacity = Math.pow(1 - fastShockPhase, 1.05) * 0.92;
              }
              if (fx.thirdRingMesh && fx.materials[8]) {
                fx.thirdRingMesh.scale.setScalar(1.0 + Math.pow(fastShockPhase, 0.82) * fx.radius * 2.75);
                (fx.materials[8] as THREE.MeshBasicMaterial).opacity = Math.pow(1 - fastShockPhase, 1.1) * 0.85;
              }
              if (fx.spikes) {
                const spikeH = Math.sin(fastShockPhase * Math.PI) * (fx.isMegaMeteor ? 3.85 : 2.35);
                const spikeW = fx.isMegaMeteor ? 1.65 : 1.25;
                for (const sp of fx.spikes) {
                  sp.scale.set(spikeW, Math.max(0.05, spikeH), spikeW);
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
                executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
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
                executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
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
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
              soundEngine.playBlessing();
            }
            triggerLightFlash(fx.tx, fx.ty, fx.tz, '#56cfe1', 15);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 28, '#56cfe1', fx.radius * 0.92, 2.8, 1.05, 1.8);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 16, '#e0fbfc', fx.radius * 0.75, 3.2, 0.9, 1.6);
          }
          const fadeIn = Math.min(1, fx.age / 0.3);
          const fadeOut = Math.min(1, (fx.duration - fx.age) / 0.85);
          const envelope = fadeIn * fadeOut;

          fx.ringMesh.scale.setScalar(fx.radius * (0.98 + Math.sin(fx.age * 3.2) * 0.04));
          fx.ringMesh.rotation.set(0, fx.age * 0.75, 0);
          if (fx.outerRingMesh) {
            fx.outerRingMesh.rotation.set(0, fx.age * 1.1, 0);
            fx.outerRingMesh.scale.setScalar(fx.radius * (0.72 + Math.cos(fx.age * 2.8) * 0.04));
          }
          if (fx.thirdRingMesh) {
            fx.thirdRingMesh.rotation.set(0, fx.age * 1.45, 0);
            fx.thirdRingMesh.scale.setScalar(fx.radius * (0.46 + Math.sin(fx.age * 4.5) * 0.05));
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
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
              soundEngine.playBlessing();
            }
            triggerLightFlash(fx.tx, fx.ty, fx.tz, '#f5b742', 14);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 26, '#f5b742', fx.radius * 0.9, 2.4, 1.0, 1.7);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 18, '#80ed99', fx.radius * 0.85, 2.1, 0.95, 1.6);
          }
          const envelope = Math.min(1, fx.age / 0.25) * Math.min(1, (fx.duration - fx.age) / 0.75);
          fx.ringMesh.scale.setScalar(fx.radius * (0.98 + Math.sin(fx.age * 3.5) * 0.05));
          fx.ringMesh.rotation.set(0, fx.age * 0.8, 0);
          if (fx.outerRingMesh) {
            const ripple = (fx.age * 0.65) % 1.0;
            fx.outerRingMesh.scale.setScalar(fx.radius * (0.35 + ripple * 0.68));
            fx.outerRingMesh.rotation.set(0, fx.age * 1.25, 0);
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
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
              soundEngine.playBlessing();
              trauma = Math.min(1.0, trauma + 0.35);
            }
            triggerLightFlash(fx.tx, fx.ty + 2, fx.tz, '#ffd166', 20);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 36, '#ffd166', fx.radius * 0.95, 2.8, 1.1, 1.9);
          }
          const envelope = Math.min(1, fx.age / 0.3) * Math.min(1, (fx.duration - fx.age) / 0.9);
          fx.ringMesh.scale.setScalar(fx.radius * (1.02 + Math.sin(fx.age * 3.0) * 0.04));
          fx.ringMesh.rotation.set(0, fx.age * 0.7, 0);
          if (fx.outerRingMesh) fx.outerRingMesh.rotation.set(0, fx.age * 1.05, 0);
          if (fx.thirdRingMesh) {
            fx.thirdRingMesh.rotation.set(0, fx.age * 1.4, 0);
            fx.thirdRingMesh.scale.setScalar(fx.radius * (0.48 + Math.cos(fx.age * 4) * 0.05));
          }
          if (fx.floatingCrown) {
            fx.floatingCrown.position.y = fx.ty + 3.2 + Math.sin(fx.age * 2.5) * 0.25;
            fx.floatingCrown.rotation.set(0, fx.age * 1.2, 0);
            if (fx.floatingCrown.children[0]) fx.floatingCrown.children[0].rotation.set(0, fx.age * 0.8, 0);
            if (fx.floatingCrown.children[1]) fx.floatingCrown.children[1].rotation.set(0, fx.age * 1.35, 0);
            fx.floatingCrown.scale.setScalar(Math.max(0.05, envelope));
          }
          if (fx.motes) {
            for (const m of fx.motes) {
              const cycle = ((fx.age * m.speed + m.phase) % m.height) / m.height;
              const swirl = m.angle + fx.age * 0.45;
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
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
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
          fx.ringMesh.rotation.set(0, fx.age * 1.4, 0);
          if (fx.outerRingMesh) {
            fx.outerRingMesh.scale.setScalar(0.2 + tNorm * fx.radius * 1.65);
            fx.outerRingMesh.rotation.set(0, fx.age * 1.85, 0);
          }
          (fx.materials[0] as THREE.MeshBasicMaterial).opacity = (1 - tNorm) * 0.58;
          (fx.materials[1] as THREE.MeshBasicMaterial).opacity = (1 - tNorm) * 0.95;
        } else if (fx.kind === 'fury_vortex' && fx.ringMesh) {
          if (fx.age >= fx.impactDelay && !fx.impactFired) {
            fx.impactFired = true;
            if (fx.deferImpact) {
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
              soundEngine.playCurse();
              trauma = Math.min(1.0, trauma + 0.45);
            }
            triggerLightFlash(fx.tx, fx.ty, fx.tz, '#e63946', 18);
            spawnParticleBurst(fx.tx, fx.ty + 0.3, fx.tz, 48, '#e63946', fx.radius * 0.85, 5.5, 1.2);
          }
          const envelope = Math.min(1, fx.age / 0.2) * Math.min(1, (fx.duration - fx.age) / 0.7);
          fx.ringMesh.scale.setScalar(fx.radius * (0.98 + Math.sin(fx.age * 8) * 0.05));
          fx.ringMesh.rotation.set(0, fx.age * 1.6, 0);
          if (fx.outerRingMesh) {
            fx.outerRingMesh.rotation.set(0, fx.age * 2.4, 0);
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
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
              soundEngine.playCurse();
              trauma = Math.min(1.0, trauma + 0.4);
            }
            triggerLightFlash(fx.tx, fx.ty, fx.tz, '#9d4edd', 16);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 30, '#9d4edd', fx.radius * 0.9, 1.9, 1.05, 1.8);
          }
          const envelope = Math.min(1, fx.age / 0.25) * Math.min(1, (fx.duration - fx.age) / 0.8);
          // Inward-collapsing dark eclipse magic circles rotating in one direction
          const collapseCycle = (fx.age * 0.75) % 1.0;
          if (fx.outerRingMesh) {
            fx.outerRingMesh.scale.setScalar(fx.radius * (1.05 - collapseCycle * 0.75));
            fx.outerRingMesh.rotation.set(0, fx.age * 1.5, 0);
          }
          fx.ringMesh.scale.setScalar(fx.radius * (0.98 + Math.sin(fx.age * 4) * 0.04));
          fx.ringMesh.rotation.set(0, fx.age * 1.0, 0);
          if (fx.motes) {
            for (const m of fx.motes) {
              const cycle = ((fx.age * m.speed + m.phase) % m.height) / m.height;
              const inwardR = m.dist * (1 - cycle * 0.65);
              const swirl = m.angle + fx.age * 1.4;
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
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
              soundEngine.playCurse();
            }
            triggerLightFlash(fx.tx, fx.ty, fx.tz, '#80ed99', 15);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 34, '#80ed99', fx.radius * 0.9, 2.2, 1.1, 1.7);
          }
          const envelope = Math.min(1, fx.age / 0.22) * Math.min(1, (fx.duration - fx.age) / 0.75);
          fx.ringMesh.scale.setScalar(fx.radius * (0.96 + Math.sin(fx.age * 4.5) * 0.06));
          fx.ringMesh.rotation.set(0, fx.age * 0.95, 0);
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
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
              soundEngine.playHeavyImpact();
              trauma = Math.min(1.0, trauma + 0.6);
              hitstopTimer = 0.04;
            }
            triggerLightFlash(fx.tx, fx.ty, fx.tz, '#06d6a0', 20);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 36, '#06d6a0', fx.radius * 0.92, 3.0, 1.1, 1.7);
          }
          const envelope = Math.min(1, fx.age / 0.2) * Math.min(1, (fx.duration - fx.age) / 0.75);
          fx.ringMesh.scale.setScalar(fx.radius * (1.02 + Math.sin(fx.age * 4) * 0.03));
          fx.ringMesh.rotation.set(0, fx.age * 0.9, 0);
          if (fx.strataRings) {
            for (let s = 0; s < fx.strataRings.length; s++) {
              const sr = fx.strataRings[s];
              const cycle = ((fx.age * 0.75 + s * 0.25) % 1.0);
              sr.position.y = fx.ty + 0.15 + cycle * 4.2;
              sr.scale.setScalar(fx.radius * (0.98 - cycle * 0.38));
              sr.rotation.set(0, fx.age * (1.0 + s * 0.25), 0);
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
            fx.ringMesh.rotation.set(0, fx.age * 2.5, 0);
            if (fx.outerRingMesh) {
              fx.outerRingMesh.scale.setScalar(fx.radius * (1.4 - prePhase * 1.15));
              fx.outerRingMesh.rotation.set(0, fx.age * 3.8, 0);
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
                executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
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
            fx.ringMesh.rotation.set(0, fx.age * 2.5, 0);
            if (fx.outerRingMesh) {
              fx.outerRingMesh.scale.setScalar(0.25 + postPhase * fx.radius * 1.15);
              fx.outerRingMesh.rotation.set(0, fx.age * 3.8, 0);
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
                radiusOverride: fx.radius,
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
        } else if (fx.kind === 'animal_strike') {
          const prog = Math.min(1, fx.age / fx.duration);
          const easeOut = 1 - Math.pow(1 - prog, 2);
          const env = 1 - prog;
          if (fx.ringMesh) {
            fx.ringMesh.scale.setScalar(0.22 + easeOut * 0.65);
            (fx.materials[2] as THREE.MeshBasicMaterial).opacity = env * 0.55;
          }
          if (fx.slashMeshes) {
            for (let si = 0; si < fx.slashMeshes.length; si++) {
              const sm = fx.slashMeshes[si];
              if (typeof sm.userData.baseY === 'number' && typeof sm.userData.snapDir === 'number') {
                sm.position.y = sm.userData.baseY + sm.userData.snapDir * easeOut * 0.11;
              }
            }
          }
          (fx.materials[0] as THREE.MeshBasicMaterial).opacity = env * 0.92;
          (fx.materials[1] as THREE.MeshBasicMaterial).opacity = env * 0.85;
        } else if (fx.kind === 'blackhole_explosion' && fx.ringMesh) {
          const prog = Math.min(1, fx.age / fx.duration);
          const easeOut = 1 - Math.pow(1 - prog, 2.5);
          const env = Math.max(0, 1 - prog);
          if (fx.innerDomeMesh && fx.materials[0]) {
            const fProg = Math.min(1, prog * 1.75);
            fx.innerDomeMesh.scale.setScalar(1.0 + fProg * fx.radius * 1.45);
            (fx.materials[0] as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - fProg) * 0.95);
          }
          if (fx.explosionDome && fx.materials[1]) {
            fx.explosionDome.scale.setScalar(0.8 + easeOut * fx.radius * 1.75);
            (fx.materials[1] as THREE.MeshBasicMaterial).opacity = Math.pow(env, 1.3) * 0.9;
          }
          if (fx.shockWallMesh && fx.materials[2]) {
            const wR = 0.8 + easeOut * fx.radius * 2.4;
            fx.shockWallMesh.scale.set(wR, 0.7 + Math.sin(prog * Math.PI) * 2.1, wR);
            (fx.materials[2] as THREE.MeshBasicMaterial).opacity = Math.pow(env, 1.4) * 0.72;
          }
          fx.ringMesh.scale.setScalar(0.6 + easeOut * fx.radius * 2.75);
          (fx.materials[3] as THREE.MeshBasicMaterial).opacity = Math.pow(env, 1.2) * 0.95;
          if (fx.outerRingMesh) {
            fx.outerRingMesh.scale.setScalar(0.4 + prog * fx.radius * 3.2);
          }
        } else if (fx.kind === 'heat_wave_burst' && fx.ringMesh) {
          if (fx.age >= fx.impactDelay && !fx.impactFired) {
            fx.impactFired = true;
            if (fx.deferImpact) {
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
            }
            soundEngine.playHeatWave();
            triggerLightFlash(fx.tx, fx.ty + 1.5, fx.tz, '#ff7b00', 22);
            spawnRisingParticles(fx.tx, fx.ty, fx.tz, 30, '#ff7b00', fx.radius * 0.45, 3.2, 1.05, 1.4);
          }
          const prog = Math.min(1, fx.age / fx.duration);
          const easeOut = 1 - Math.pow(1 - prog, 2);
          const env = Math.max(0, 1 - prog);
          const currentRadius = 0.3 + easeOut * fx.radius * 1.25;
          fx.ringMesh.scale.setScalar(currentRadius);
          (fx.materials[0] as THREE.MeshBasicMaterial).opacity = env * 0.9;
          if (fx.outerRingMesh) {
            fx.outerRingMesh.scale.setScalar(0.2 + prog * fx.radius * 1.4);
            (fx.materials[1] as THREE.MeshBasicMaterial).opacity = env * 0.85;
          }
          if (fx.shockWallMesh && fx.materials[2]) {
            fx.shockWallMesh.scale.set(0.5 + easeOut * fx.radius * 1.05, 1.2 + prog * 1.4, 0.5 + easeOut * fx.radius * 1.05);
            (fx.materials[2] as THREE.MeshBasicMaterial).opacity = Math.sin(prog * Math.PI) * 0.35;
          }
          // Incremental scorch sparks along the expanding wave front
          if (prog > 0.08 && prog < 0.85 && Math.random() < 0.4) {
            const sparkAngle = Math.random() * Math.PI * 2;
            const sx = fx.tx + Math.cos(sparkAngle) * currentRadius * 0.88;
            const sz = fx.tz + Math.sin(sparkAngle) * currentRadius * 0.88;
            spawnRisingParticles(sx, fx.ty + 0.1, sz, 3, '#ff922b', 0.5, 2.6, 0.55, 0.9);
          }
        } else if (fx.kind === 'freeze_snap_burst' && fx.ringMesh) {
          if (fx.age >= fx.impactDelay && !fx.impactFired) {
            fx.impactFired = true;
            if (fx.deferImpact) {
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
            }
            soundEngine.playFreeze();
            triggerLightFlash(fx.tx, fx.ty + 1.5, fx.tz, '#7dd3fc', 22);
            spawnParticleBurst(fx.tx, fx.ty + 0.35, fx.tz, 30, '#bae6fd', fx.radius * 0.5, 4.2, 1.15);
          }
          const prog = Math.min(1, fx.age / fx.duration);
          const easeOut = 1 - Math.pow(1 - prog, 2.2);
          const env = Math.max(0, 1 - prog);
          fx.ringMesh.scale.setScalar(0.3 + easeOut * fx.radius * 1.3);
          if (fx.outerRingMesh) {
            fx.outerRingMesh.scale.setScalar(0.25 + prog * fx.radius * 1.5);
          }
          if (fx.spikes) {
            // Ice spikes sprout incrementally as the freeze wave expands outward
            for (const sp of fx.spikes) {
              const dFrac = (sp.userData.distFrac as number) || 0;
              const spikeActive = easeOut - dFrac * 0.85;
              if (spikeActive > 0) {
                const growthProg = Math.min(1, spikeActive / 0.22);
                const spikeH = Math.sin(growthProg * Math.PI * 0.5) * 1.45 * env;
                sp.scale.set(0.85, Math.max(0.01, spikeH), 0.85);
              } else {
                sp.scale.set(0.85, 0.01, 0.85);
              }
            }
          }
          (fx.materials[0] as THREE.MeshBasicMaterial).opacity = env * 0.92;
          if (fx.materials[1]) (fx.materials[1] as THREE.MeshStandardMaterial).opacity = env * 0.9;
        } else if ((fx.kind === 'tornado_summon' || fx.kind === 'tsunami_summon') && fx.ringMesh) {
          if (fx.age >= fx.impactDelay && !fx.impactFired) {
            fx.impactFired = true;
            if (fx.deferImpact) {
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
            }
            if (fx.kind === 'tornado_summon') {
              const isSuperCast = fx.powerType === 'super_tornado';
              if (isSuperCast) {
                soundEngine.playSuperTornado();
                trauma = Math.min(1.0, trauma + 0.72);
                spawnRisingParticles(fx.tx, fx.ty, fx.tz, 52, '#a5b4fc', fx.radius * 1.2, 6.8, 1.35, 1.6);
              } else {
                soundEngine.playTornado();
                trauma = Math.min(1.0, trauma + 0.45);
                spawnRisingParticles(fx.tx, fx.ty, fx.tz, 36, '#cbd5e1', fx.radius, 5.5, 1.15, 1.4);
              }
            } else {
              soundEngine.playTsunami();
              trauma = Math.min(1.0, trauma + 0.72);
              spawnParticleBurst(fx.tx, fx.ty + 0.5, fx.tz, 75, '#00b4d8', fx.radius * 1.2, 11.0, 1.6);
              spawnParticleBurst(fx.tx, fx.ty + 0.6, fx.tz, 45, '#e0fbfc', fx.radius, 12.5, 1.35);
            }
          }
          const prog = Math.min(1, fx.age / fx.duration);
          fx.ringMesh.scale.setScalar(0.3 + prog * fx.radius * 1.6);
          (fx.materials[0] as THREE.MeshBasicMaterial).opacity = (1 - prog) * 0.9;
          if (fx.outerRingMesh) {
            fx.outerRingMesh.scale.setScalar(0.2 + prog * fx.radius * 1.9);
            (fx.materials[1] as THREE.MeshBasicMaterial).opacity = (1 - prog) * 0.82;
          }
        } else if (fx.kind === 'volcano_burst' && fx.ringMesh) {
          if (fx.age < fx.impactDelay) {
            const riseT = Math.min(1, fx.age / Math.max(0.05, fx.impactDelay));
            const easeOut = 1 - Math.pow(1 - riseT, 3);
            if (fx.tracerMesh) {
              fx.tracerMesh.scale.set(0.65 + easeOut * 0.45, Math.max(0.05, easeOut * 1.15), 0.65 + easeOut * 0.45);
            }
            fx.ringMesh.scale.setScalar(0.25 + easeOut * fx.radius * 0.55);
            if (Math.random() < 0.75) {
              spawnRisingParticles(fx.tx, fx.ty + 0.25, fx.tz, 3, '#a8a29e', fx.radius * 0.45, 4.5, 0.85, 1.1);
              spawnParticleBurst(fx.tx, fx.ty + 0.4, fx.tz, 2, '#ff5400', 0.55, 2.6, 0.8);
            }
          } else {
            if (!fx.impactFired) {
              fx.impactFired = true;
              if (fx.tracerMesh) fx.tracerMesh.visible = false;
              if (fx.deferImpact) {
                executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
              }
              soundEngine.playVolcanoEruption();
              trauma = Math.min(1.0, trauma + 0.78);
              triggerLightFlash(fx.tx, fx.ty + 2.5, fx.tz, '#ff5400', 28);
              spawnRisingParticles(fx.tx, fx.ty + 0.4, fx.tz, 64, '#ff5400', fx.radius * 0.85, 8.2, 1.25, 1.5);
              spawnRisingParticles(fx.tx, fx.ty + 0.6, fx.tz, 36, '#ffee55', fx.radius * 0.55, 9.5, 1.0, 1.3);
            }
            const postT = Math.min(1, (fx.age - fx.impactDelay) / Math.max(0.08, fx.duration - fx.impactDelay));
            fx.ringMesh.scale.setScalar(0.3 + postT * fx.radius * 1.45);
            (fx.materials[0] as THREE.MeshBasicMaterial).opacity = (1 - postT) * 0.92;
            if (fx.outerRingMesh) {
              fx.outerRingMesh.scale.setScalar(0.2 + postT * fx.radius * 1.75);
              (fx.materials[1] as THREE.MeshBasicMaterial).opacity = (1 - postT) * 0.85;
            }
          }
        } else if (fx.kind === 'volcanic_lava_bomb' && fx.tracerMesh && fx.ringMesh) {
          const dropT = Math.min(1, fx.age / fx.impactDelay);
          if (dropT < 1) {
            const ox = fx.ox ?? fx.tx;
            const oy = fx.oy ?? fx.ty + 2.5;
            const oz = fx.oz ?? fx.tz;
            const arcPeak = 7.5;
            const cx = ox + (fx.tx - ox) * dropT;
            const cz = oz + (fx.tz - oz) * dropT;
            const cy = oy + (fx.ty - oy) * dropT + 4 * dropT * (1 - dropT) * arcPeak;
            fx.tracerMesh.position.set(cx, cy, cz);
            fx.tracerMesh.rotation.x += dt * 7;
            fx.tracerMesh.rotation.y += dt * 5;
            if (Math.random() < 0.7) {
              spawnParticleBurst(cx, cy, cz, 2, '#ff7b00', 0.35, 1.4, 0.75);
            }
          } else {
            if (!fx.impactFired) {
              fx.impactFired = true;
              fx.tracerMesh.visible = false;
              triggerLightFlash(fx.tx, fx.ty + 1.0, fx.tz, '#ff5400', 18);
              spawnParticleBurst(fx.tx, fx.ty + 0.35, fx.tz, 28, '#ff5400', fx.radius * 0.85, 6.2, 1.25);
              spawnParticleBurst(fx.tx, fx.ty + 0.35, fx.tz, 14, '#ffee55', fx.radius * 0.55, 7.2, 1.05);
            }
            const postT = Math.min(1, (fx.age - fx.impactDelay) / Math.max(0.05, fx.duration - fx.impactDelay));
            fx.ringMesh.scale.setScalar(0.35 + postT * fx.radius * 1.35);
            (fx.materials[1] as THREE.MeshBasicMaterial).opacity = (1 - postT) * 0.82;
          }
        } else if (fx.kind === 'void_goo_splash' && fx.ringMesh) {
          if (fx.tracerMesh && fx.age < fx.impactDelay) {
            // Sky-Seed descending from the heavens before landing and spreading Void Goo
            const dropT = Math.min(1, fx.age / Math.max(0.05, fx.impactDelay));
            const easeIn = dropT * dropT;
            const ox = fx.ox ?? fx.tx + 4.2;
            const oy = fx.oy ?? fx.ty + 18.0;
            const oz = fx.oz ?? fx.tz - 4.2;
            const sx = ox + (fx.tx - ox) * easeIn;
            const sy = oy + (fx.ty + 0.25 - oy) * easeIn;
            const sz = oz + (fx.tz - oz) * easeIn;
            fx.tracerMesh.position.set(sx, sy, sz);
            fx.tracerMesh.rotation.x += dt * 6.5;
            fx.tracerMesh.rotation.y += dt * 8.5;
            fx.ringMesh.scale.setScalar((1 - dropT * 0.65) * fx.radius * 0.85);
            if (fx.outerRingMesh) {
              fx.outerRingMesh.scale.setScalar((0.35 + dropT * 0.65) * fx.radius * 0.65);
            }
            if (Math.random() < 0.85) {
              spawnParticleBurst(sx, sy, sz, 2, '#a855f7', 0.4, 1.8, 0.85);
              spawnParticleBurst(sx, sy, sz, 1, '#38bdf8', 0.3, 1.4, 0.7);
            }
          } else {
            if (!fx.impactFired) {
              fx.impactFired = true;
              if (fx.tracerMesh) fx.tracerMesh.visible = false;
              if (fx.deferImpact) {
                executeGodPowerImpact(simRef.current, 'void_goo', fx.tx, fx.tz, { radiusOverride: fx.radius });
              }
              soundEngine.playVoidGoo();
              triggerLightFlash(fx.tx, fx.ty + 1.5, fx.tz, '#a855f7', 22);
              spawnParticleBurst(fx.tx, fx.ty + 0.35, fx.tz, 32, '#3b0764', fx.radius * 0.75, 4.4, 1.15);
              spawnParticleBurst(fx.tx, fx.ty + 0.45, fx.tz, 22, '#38bdf8', fx.radius * 0.65, 5.4, 0.95);
            }
            const postT = Math.min(1, (fx.age - fx.impactDelay) / Math.max(0.08, fx.duration - fx.impactDelay));
            fx.ringMesh.scale.setScalar(0.3 + postT * fx.radius * 1.25);
            fx.ringMesh.rotation.set(0, fx.age * 1.6, 0);
            (fx.materials[0] as THREE.MeshBasicMaterial).opacity = (1 - postT) * 0.9;
            if (fx.outerRingMesh) {
              fx.outerRingMesh.scale.setScalar(0.2 + postT * fx.radius * 1.45);
              fx.outerRingMesh.rotation.set(0, fx.age * 2.1, 0);
              (fx.materials[1] as THREE.MeshBasicMaterial).opacity = (1 - postT) * 0.82;
            }
          }
        } else if (fx.kind === 'sky_rain_shower' && fx.skyRainDrops && fx.ringMesh) {
          const ringProg = Math.min(1, fx.age / fx.duration);
          fx.ringMesh.scale.setScalar(0.45 + ringProg * fx.radius * 1.15);
          fx.ringMesh.rotation.set(0, fx.age * 1.4, 0);
          (fx.materials[0] as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - ringProg) * 0.65);
          if (fx.outerRingMesh) {
            fx.outerRingMesh.scale.setScalar(0.3 + ringProg * fx.radius * 1.38);
            fx.outerRingMesh.rotation.set(0, fx.age * 1.8, 0);
            (fx.materials[1] as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - ringProg) * 0.58);
          }

          for (let di = 0; di < fx.skyRainDrops.length; di++) {
            const d = fx.skyRainDrops[di];
            if (d.landed) continue;
            const localAge = fx.age - d.delay;
            if (localAge < 0) continue;
            const fallT = Math.min(1, localAge / Math.max(0.08, d.fallDur));
            if (fallT < 1) {
              const accel = fallT * fallT;
              const swayX = d.swayAmp > 0 ? Math.sin(localAge * 9 + di * 1.7) * d.swayAmp * (1 - fallT) : 0;
              const swayZ = d.swayAmp > 0 ? Math.cos(localAge * 7 + di * 1.3) * d.swayAmp * (1 - fallT) : 0;
              const curX = d.ox + (d.tx - d.ox) * accel + swayX;
              const curY = d.oy + (d.ty + 0.18 - d.oy) * accel;
              const curZ = d.oz + (d.tz - d.oz) * accel + swayZ;
              d.mesh.visible = true;
              d.mesh.position.set(curX, curY, curZ);
              d.mesh.rotation.x += dt * d.spinX;
              d.mesh.rotation.y += dt * d.spinY;
              d.streak.visible = true;
              d.streak.position.set(curX, curY, curZ);
              d.streak.scale.set(1, 0.7 + fallT * 1.1, 1);
            } else {
              d.landed = true;
              d.mesh.visible = false;
              d.streak.visible = false;
              if (d.applyOnLand) {
                executeTerrainDropTileImpact(simRef.current, d.dropKind, d.tileX, d.tileZ);
                if (d.extraTiles) {
                  for (const et of d.extraTiles) {
                    executeTerrainDropTileImpact(simRef.current, d.dropKind, et.x, et.z);
                  }
                }
                if (di === 0) {
                  soundEngine.playBlessing();
                }
              }
              spawnParticleBurst(d.tx, d.ty + 0.25, d.tz, d.sparkCount, d.impactColor, 0.62, 3.6, 0.72);
              spawnParticleBurst(d.tx, d.ty + 0.25, d.tz, Math.max(3, Math.floor(d.sparkCount * 0.5)), d.secondaryColor, 0.42, 4.2, 0.58);
              if (di === 0 || di === Math.floor(fx.skyRainDrops.length / 2)) {
                triggerLightFlash(d.tx, d.ty + 1.0, d.tz, d.impactColor, 11);
              }
            }
          }
        } else if (fx.kind === 'ripple_ring' && fx.ringMesh) {
          if (fx.tracerMesh && !fx.impactFired) {
            if (fx.powerType === 'alien_invasion') {
              const pDrop = Math.min(1, fx.age / Math.max(0.05, fx.impactDelay));
              fx.tracerMesh.position.set(fx.tx, fx.ty + 16 * (1 - pDrop * pDrop), fx.tz);
              fx.tracerMesh.rotation.y += dt * 6;
            } else if (fx.powerType === 'harmony_dove') {
              const a = fx.age * 4.5;
              fx.tracerMesh.position.set(fx.tx + Math.cos(a) * 1.8, fx.ty + 2.0 + fx.age * 3.8, fx.tz + Math.sin(a) * 1.8);
              fx.tracerMesh.rotation.y = -a;
            }
          }
          if (fx.age >= fx.impactDelay && !fx.impactFired) {
            fx.impactFired = true;
            if (fx.tracerMesh && fx.powerType === 'alien_invasion') fx.tracerMesh.visible = false;
            if (fx.deferImpact) {
              executeGodPowerImpact(simRef.current, fx.powerType as GodPowerType, fx.tx, fx.tz, { radiusOverride: fx.radius });
            }
            if (fx.powerType === 'undead_portal') {
              soundEngine.playPortalSummon();
              trauma = Math.min(1.0, trauma + 0.42);
            } else if (fx.powerType === 'alien_invasion') {
              soundEngine.playAlienInvasion();
              trauma = Math.min(1.0, trauma + 0.52);
            } else if (fx.powerType === 'chrono_surge') {
              soundEngine.playChronoWarp();
            } else if (fx.powerType === 'harmony_dove') {
              soundEngine.playPeaceAccord();
            } else if (fx.powerType === 'solar_orbital_laser') {
              soundEngine.playOrbitalLaser();
              trauma = Math.min(1.0, trauma + 0.58);
            } else if (fx.powerType === 'gravity_flip') {
              soundEngine.playGravityFlux();
              trauma = Math.min(1.0, trauma + 0.45);
            }
            triggerLightFlash(fx.tx, fx.ty + 1.5, fx.tz, fx.colorHex, 20);
            spawnParticleBurst(fx.tx, fx.ty + 0.25, fx.tz, 26, fx.colorHex, fx.radius * 0.72, 4.4, 1.0);
          }
          if (fx.tracerMesh && fx.powerType === 'harmony_dove') {
            const a = fx.age * 4.5;
            fx.tracerMesh.position.set(fx.tx + Math.cos(a) * 1.8, fx.ty + 2.0 + fx.age * 3.8, fx.tz + Math.sin(a) * 1.8);
            fx.tracerMesh.rotation.y = -a;
          }
          const wavePhase = Math.min(1, fx.age / fx.duration);
          const easeOut = 1 - (1 - wavePhase) * (1 - wavePhase);
          fx.ringMesh.scale.setScalar(0.35 + easeOut * fx.radius * 1.05);
          fx.ringMesh.rotation.set(0, fx.age * 1.5, 0);
          (fx.materials[0] as THREE.MeshBasicMaterial).opacity = (1 - wavePhase) * 0.85;
          if (fx.outerRingMesh) {
            fx.outerRingMesh.scale.setScalar(0.2 + wavePhase * fx.radius * 1.25);
            fx.outerRingMesh.rotation.set(0, fx.age * 2.1, 0);
            (fx.materials[1] as THREE.MeshBasicMaterial).opacity = (1 - wavePhase) * 0.75;
          }
        } else if (fx.kind === 'weapon_spark' && fx.ringMesh) {
          const prog = Math.min(1, fx.age / fx.duration);
          const easeOut = 1 - Math.pow(1 - prog, 2.2);
          fx.ringMesh.scale.setScalar(0.22 + easeOut * fx.radius * 1.35);
          if (fx.materials[1]) {
            (fx.materials[1] as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - prog) * 0.94);
          }
          if (fx.materials[0]) {
            (fx.materials[0] as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - prog) * 0.96);
          }
          if (fx.sparkShards) {
            for (let si = 0; si < fx.sparkShards.length; si++) {
              const s = fx.sparkShards[si];
              s.position.y = fx.ty + 0.35 + prog * (1.2 + si * 0.14);
              s.scale.set(1 - prog * 0.65, Math.max(0.15, 1.3 - prog * 0.95), 1 - prog * 0.65);
            }
          }
        } else if (fx.kind === 'projectile_tracer' && fx.tracerMesh && fx.ringMesh) {
          const prog = Math.min(1, fx.age / fx.duration);
          const flightEndFrac = fx.vfxSubtype === 'plasma_beam' || fx.vfxSubtype === 'laser_beam' ? 0.38 : 0.65;
          const flightT = Math.min(1, prog / flightEndFrac);
          const ox = fx.ox ?? fx.tx;
          const oy = fx.oy ?? fx.ty;
          const oz = fx.oz ?? fx.tz;

          if (fx.vfxSubtype === 'bomb') {
            const curX = ox + (fx.tx - ox) * flightT;
            const curZ = oz + (fx.tz - oz) * flightT;
            const curY = oy + (fx.ty - oy) * (flightT * flightT);
            fx.tracerMesh.position.set(curX, curY, curZ);
            fx.tracerMesh.rotation.x = 0.35 + flightT * 1.15;
            if (flightT >= 1 && !fx.impactFired) {
              fx.impactFired = true;
              spawnParticleBurst(fx.tx, fx.ty + 0.25, fx.tz, 32, '#ff9e00', fx.radius * 0.95, 6.6, 1.2);
              spawnParticleBurst(fx.tx, fx.ty + 0.35, fx.tz, 18, '#475569', fx.radius * 0.75, 4.0, 1.4);
            }
          } else if (fx.vfxSubtype === 'cannon_shell') {
            const horizDist = Math.hypot(fx.tx - ox, fx.tz - oz);
            const arcPeak = Math.min(3.1, Math.max(0.55, horizDist * 0.25));
            const curX = ox + (fx.tx - ox) * flightT;
            const curZ = oz + (fx.tz - oz) * flightT;
            const curY = oy + (fx.ty - oy) * flightT + 4 * flightT * (1 - flightT) * arcPeak;
            fx.tracerMesh.position.set(curX, curY, curZ);
            if (flightT < 1 && Math.random() < 0.4) {
              spawnParticleBurst(curX, curY, curZ, 1, '#94a3b8', 0.14, 0.4, 0.32);
            }
            if (flightT >= 1 && !fx.impactFired) {
              fx.impactFired = true;
              spawnParticleBurst(fx.tx, fx.ty + 0.25, fx.tz, 24, '#ff9e00', fx.radius * 0.85, 5.4, 1.05);
            }
          } else if (fx.vfxSubtype === 'missile') {
            const curX = ox + (fx.tx - ox) * flightT;
            const curY = oy + (fx.ty - oy) * flightT + Math.sin(flightT * Math.PI) * 0.52;
            const curZ = oz + (fx.tz - oz) * flightT;
            fx.tracerMesh.position.set(curX, curY, curZ);
            if (flightT < 1 && Math.random() < 0.75) {
              spawnParticleBurst(curX, curY, curZ, 1, '#e2e8f0', 0.16, 0.5, 0.34);
            }
            if (flightT >= 1 && !fx.impactFired) {
              fx.impactFired = true;
              spawnParticleBurst(fx.tx, fx.ty + 0.25, fx.tz, 24, '#ff6b35', fx.radius * 0.8, 5.2, 0.98);
            }
          } else if (fx.vfxSubtype === 'arcane_bolt') {
            const curX = ox + (fx.tx - ox) * flightT;
            const curY = oy + (fx.ty - oy) * flightT + Math.sin(flightT * Math.PI) * 0.34;
            const curZ = oz + (fx.tz - oz) * flightT;
            fx.tracerMesh.position.set(curX, curY, curZ);
            fx.tracerMesh.rotation.z = prog * 16;
            fx.tracerMesh.rotation.y += dt * 12;
            if (flightT < 1 && Math.random() < 0.55) {
              spawnParticleBurst(curX, curY, curZ, 1, '#c084fc', 0.14, 0.5, 0.3);
            }
          } else if (fx.vfxSubtype === 'plasma_beam' || fx.vfxSubtype === 'laser_beam') {
            const beamPulse = Math.max(0.28, 1.4 - prog * 1.15);
            fx.tracerMesh.scale.set(beamPulse, beamPulse, 1);
          } else {
            fx.tracerMesh.position.set(
              ox + (fx.tx - ox) * flightT,
              oy + (fx.ty - oy) * flightT,
              oz + (fx.tz - oz) * flightT,
            );
          }

          const bodyOpacity =
            fx.vfxSubtype === 'plasma_beam' || fx.vfxSubtype === 'laser_beam'
              ? Math.max(0, 1 - prog)
              : flightT < 1
                ? 0.96
                : Math.max(0, 1 - (prog - flightEndFrac) / Math.max(0.05, 1 - flightEndFrac));
          if (fx.materials[0]) (fx.materials[0] as THREE.MeshBasicMaterial).opacity = bodyOpacity;
          if (fx.materials[1]) (fx.materials[1] as THREE.MeshBasicMaterial).opacity = bodyOpacity * 0.92;
          const ringMat = fx.materials[2] ?? fx.materials[1];
          fx.ringMesh.scale.setScalar(
            (fx.vfxSubtype === 'bomb' ? 0.34 : 0.2) +
              prog * fx.radius * (fx.vfxSubtype === 'bomb' ? 1.65 : 1.2),
          );
          if (ringMat) (ringMat as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - prog) * 0.88);
          if (fx.muzzleRingMesh) {
            fx.muzzleRingMesh.scale.setScalar(0.16 + Math.min(1, prog * 3.5) * 0.55);
          }
        } else if (fx.kind === 'nuke_blast' && fx.ringMesh) {
          const prog = Math.min(1, fx.age / fx.duration);
          const easeOut = 1 - Math.pow(1 - prog, 2.3);
          const env = Math.max(0, 1 - prog);
          const stemH = 0.45 + Math.min(1, prog * 1.75) * (2.9 + fx.radius * 0.58);
          if (fx.innerDomeMesh && fx.materials[0]) {
            const flashP = Math.min(1, prog * 2.6);
            fx.innerDomeMesh.scale.setScalar(0.55 + flashP * fx.radius * 1.0);
            (fx.materials[0] as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - flashP) * 0.98);
          }
          if (fx.stemMesh && fx.materials[1]) {
            fx.stemMesh.scale.set(0.68 + prog * 0.32, stemH, 0.68 + prog * 0.32);
            (fx.materials[1] as THREE.MeshBasicMaterial).opacity = env * 0.9;
          }
          if (fx.capMesh && fx.materials[2]) {
            fx.capMesh.position.y = fx.ty + stemH + 0.1;
            const capW = 0.95 + easeOut * fx.radius * 0.58;
            fx.capMesh.scale.set(capW, capW * 0.54, capW);
            (fx.materials[2] as THREE.MeshBasicMaterial).opacity = env * 0.94;
          }
          if (fx.torusCapMesh && fx.materials[3]) {
            fx.torusCapMesh.position.y = fx.ty + stemH * 0.88;
            const tScale = 0.72 + easeOut * fx.radius * 0.52;
            fx.torusCapMesh.scale.setScalar(tScale);
            fx.torusCapMesh.rotation.z = prog * 2.2;
            (fx.materials[3] as THREE.MeshBasicMaterial).opacity = env * 0.9;
          }
          fx.ringMesh.scale.setScalar(0.45 + easeOut * fx.radius * 1.72);
          (fx.materials[4] as THREE.MeshBasicMaterial).opacity = env * 0.94;
          if (fx.outerRingMesh && fx.materials[5]) {
            fx.outerRingMesh.scale.setScalar(0.32 + prog * fx.radius * 2.15);
            (fx.materials[5] as THREE.MeshBasicMaterial).opacity = env * 0.82;
          }
        } else if (fx.kind === 'arcane_cataclysm' && fx.ringMesh) {
          const prog = Math.min(1, fx.age / fx.duration);
          const beamTriggerFrac = 0.42;

          if (prog < beamTriggerFrac) {
            // PHASE 1: Magic Circle inscribes on ground + Sky Circle focuses overhead + 6 Runes orbit & converge
            const p1 = prog / beamTriggerFrac;
            const p1Ease = 1 - Math.pow(1 - p1, 2);
            fx.ringMesh.scale.setScalar(0.4 + p1Ease * fx.radius * 1.15);
            fx.ringMesh.rotation.set(0, p1 * 3.8, 0);
            (fx.materials[0] as THREE.MeshBasicMaterial).opacity = Math.min(0.98, 0.45 + p1 * 0.55);

            if (fx.thirdRingMesh) {
              fx.thirdRingMesh.scale.setScalar(0.35 + p1Ease * fx.radius * 1.1);
              fx.thirdRingMesh.rotation.set(0, p1 * 4.5, 0);
              (fx.materials[1] as THREE.MeshBasicMaterial).opacity = Math.min(0.95, 0.35 + p1 * 0.6);
            }
            if (fx.skyCircleMesh) {
              fx.skyCircleMesh.position.y = fx.ty + 7.2 - p1Ease * 2.1;
              fx.skyCircleMesh.scale.setScalar(0.35 + p1Ease * fx.radius * 0.95);
              fx.skyCircleMesh.rotation.set(0, p1 * 5.2, 0);
              (fx.materials[2] as THREE.MeshBasicMaterial).opacity = Math.min(0.95, 0.25 + p1 * 0.72);
            }
            if (fx.outerRingMesh) {
              fx.outerRingMesh.scale.setScalar(0.3 + p1 * fx.radius * 1.25);
              (fx.materials[1] as THREE.MeshBasicMaterial).opacity = (1 - p1 * 0.35) * 0.85;
            }
            if (fx.runePillars) {
              const orbitR = fx.radius * (1.08 - p1Ease * 0.62);
              for (let rp = 0; rp < fx.runePillars.length; rp++) {
                const a = (rp / fx.runePillars.length) * Math.PI * 2 + p1 * 4.2;
                const pillar = fx.runePillars[rp];
                pillar.position.set(
                  fx.tx + Math.cos(a) * orbitR,
                  fx.ty + 0.8 + Math.sin(p1 * Math.PI) * 1.5,
                  fx.tz + Math.sin(a) * orbitR,
                );
                pillar.rotation.y = a * 2;
                pillar.scale.setScalar(0.8 + p1 * 0.55);
              }
              (fx.materials[3] as THREE.MeshBasicMaterial).opacity = 0.95;
            }
          } else {
            // PHASE 2: Colossal Celestial Magic Beam erupts & obliterates everything in the circle!
            if (!fx.impactFired) {
              fx.impactFired = true;
              triggerLightFlash(fx.tx, fx.ty + 3.2, fx.tz, '#c084fc', 48);
              soundEngine.playMegaExplosion();
              trauma = Math.min(1.0, trauma + 0.56);
              spawnParticleBurst(fx.tx, fx.ty + 0.8, fx.tz, 78, '#c084fc', fx.radius * 1.2, 10.6, 1.6);
              spawnParticleBurst(fx.tx, fx.ty + 1.0, fx.tz, 54, '#5eead4', fx.radius * 0.95, 12.0, 1.38);
            }

            const p2 = (prog - beamTriggerFrac) / (1 - beamTriggerFrac);
            const p2Ease = 1 - Math.pow(1 - p2, 2.2);
            const env = Math.max(0, 1 - p2);
            const beamPulse = Math.max(0.25, 1 - p2 * 0.72);
            const beamW = fx.radius * 0.52 * beamPulse;

            if (fx.beamCoreMesh && fx.materials[4]) {
              fx.beamCoreMesh.scale.set(beamW * 0.55, 14.5, beamW * 0.55);
              (fx.materials[4] as THREE.MeshBasicMaterial).opacity = env * 0.98;
            }
            if (fx.beamAuraMesh && fx.materials[5]) {
              fx.beamAuraMesh.scale.set(beamW * 1.22, 14.0, beamW * 1.22);
              fx.beamAuraMesh.rotation.y = p2 * 6.0;
              (fx.materials[5] as THREE.MeshBasicMaterial).opacity = env * 0.78;
            }
            if (fx.stemMesh) {
              const spireH = 1.2 + p2Ease * (4.2 + fx.radius * 0.7);
              fx.stemMesh.scale.set(fx.radius * 0.45 * beamPulse, spireH, fx.radius * 0.45 * beamPulse);
              fx.stemMesh.rotation.y = -p2 * 4.5;
            }
            if (fx.explosionDome && fx.materials[6]) {
              fx.explosionDome.scale.setScalar(0.5 + p2Ease * fx.radius * 1.2);
              (fx.materials[6] as THREE.MeshBasicMaterial).opacity = env * 0.82;
            }

            fx.ringMesh.scale.setScalar(fx.radius * (1.15 + p2Ease * 0.75));
            fx.ringMesh.rotation.set(0, fx.age * 4.2, 0);
            (fx.materials[0] as THREE.MeshBasicMaterial).opacity = env * 0.94;
            if (fx.thirdRingMesh) {
              fx.thirdRingMesh.scale.setScalar(fx.radius * (1.1 + p2Ease * 0.65));
              fx.thirdRingMesh.rotation.set(0, fx.age * 5.0, 0);
              (fx.materials[1] as THREE.MeshBasicMaterial).opacity = env * 0.88;
            }
            if (fx.skyCircleMesh) {
              fx.skyCircleMesh.scale.setScalar(fx.radius * (0.95 + p2Ease * 0.5));
              fx.skyCircleMesh.rotation.set(0, fx.age * 6.0, 0);
              (fx.materials[2] as THREE.MeshBasicMaterial).opacity = env * 0.9;
            }
            if (fx.outerRingMesh) {
              fx.outerRingMesh.scale.setScalar(0.4 + p2Ease * fx.radius * 2.0);
            }
            if (fx.runePillars) {
              for (let rp = 0; rp < fx.runePillars.length; rp++) {
                fx.runePillars[rp].position.y += dt * 6.5;
                fx.runePillars[rp].scale.setScalar(Math.max(0.05, 1.35 * env));
              }
              (fx.materials[3] as THREE.MeshBasicMaterial).opacity = env * 0.88;
            }
          }
        } else if (fx.kind === 'battlewill_slash' && fx.ringMesh) {
          const prog = Math.min(1, fx.age / fx.duration);
          const easeOut = 1 - Math.pow(1 - prog, 2.35);
          const env = Math.max(0, 1 - prog);
          const baseYaw = fx.slashBaseYaw ?? 0;
          const sweepAngle = baseYaw - 1.05 + easeOut * 2.15;
          if (fx.slashMeshes) {
            for (let si = 0; si < fx.slashMeshes.length; si++) {
              const sm = fx.slashMeshes[si];
              sm.rotation.y = sweepAngle - si * 0.14;
              const mult = si === 0 ? 1.0 : si === 1 ? 1.05 : 0.84;
              sm.scale.setScalar((0.72 + easeOut * 0.62) * fx.radius * mult);
            }
          }
          if (fx.crackMeshes) {
            for (let ci = 0; ci < fx.crackMeshes.length; ci++) {
              const cr = fx.crackMeshes[ci];
              cr.scale.set(1.2 + easeOut * 0.7, 1.4 * env + 0.1, 0.55 + easeOut * 0.5);
            }
          }
          (fx.materials[0] as THREE.MeshBasicMaterial).opacity = env * 0.96;
          (fx.materials[1] as THREE.MeshBasicMaterial).opacity = env * 0.98;
          fx.ringMesh.scale.setScalar(0.4 + easeOut * fx.radius * 1.45);
          if (fx.outerRingMesh) {
            fx.outerRingMesh.scale.setScalar(0.25 + prog * fx.radius * 1.75);
          }
          (fx.materials[2] as THREE.MeshBasicMaterial).opacity = env * 0.9;
        }

        if (fx.age >= fx.duration) {
          flushPendingSkyRainDrops(fx);
          burstFxGroup.remove(fx.group);
          if (fx.ejectaInst) fx.ejectaInst.dispose();
          for (const m of fx.materials) m.dispose();
          activeBurstFx.splice(i, 1);
        }
      }

      // Compute generously padded orthographic ground-plane cull bounds before syncing entities
      if (elapsedTotal > 0.05) {
        computeOrthoGroundCullBounds(camera, simRef.current.gridSize, worldCullBounds, 6.5, 6.0);
      } else {
        worldCullBounds.minX = -12;
        worldCullBounds.maxX = simRef.current.gridSize + 12;
        worldCullBounds.minZ = -12;
        worldCullBounds.maxZ = simRef.current.gridSize + 12;
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
            const mawObj = uEntry.fireMaw ?? uEntry.group;
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

      // Update compact active pooled particles in-place (swap-remove expired slots)
      const hadParticles = activeParticleCount > 0;
      for (let i = 0; i < activeParticleCount; ) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          activeParticleCount--;
          if (i < activeParticleCount) {
            const last = particles[activeParticleCount];
            particles[activeParticleCount] = p;
            particles[i] = last;
          }
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
        i++;
      }
      particleInstanced.count = activeParticleCount;
      if (activeParticleCount > 0 || hadParticles) {
        particleInstanced.instanceMatrix.needsUpdate = true;
        if (particleInstanced.instanceColor) particleInstanced.instanceColor.needsUpdate = true;
      }

      if (vfxFlashLight.intensity > 0.05) {
        vfxFlashLight.intensity = THREE.MathUtils.damp(vfxFlashLight.intensity, 0, 5.5, dt);
      } else {
        vfxFlashLight.intensity = 0;
      }

      const isInspectMode =
        propsRef.current.gameState === 'playing' &&
        propsRef.current.activeTool.kind === 'inspect';
      const isDragMode =
        propsRef.current.gameState === 'playing' &&
        isDragPowerActive();

      if (!isInspectMode && !isDragMode && hoveredEntityInternal !== null) {
        hoveredEntityInternal = null;
        propsRef.current.onHoverEntityChange?.(null);
      }

      const activeHoverUnitId =
        isInspectMode || isDragMode
          ? (propsRef.current.hoveredEntityId ?? hoveredEntityInternal)
          : null;
      const activeSelectedUnitId = isInspectMode
        ? propsRef.current.selectedEntityId
        : null;

      // Update Telekinesis Drag Highlight Rig
      const draggedTargetUnit = draggedUnitId
        ? simRef.current.units.find((u) => u.id === draggedUnitId && u.state !== 'ko')
        : undefined;
      if (draggedTargetUnit) {
        const metrics = getUnitInspectMetrics(draggedTargetUnit);
        const uGrp = unitMeshes.get(draggedTargetUnit.id)?.group;
        const dx = uGrp ? uGrp.position.x : draggedTargetUnit.x;
        const dy = uGrp ? uGrp.position.y : 2.0;
        const dz = uGrp ? uGrp.position.z : draggedTargetUnit.z;
        dragHighlightRig.group.visible = true;
        dragHighlightRig.group.position.set(dx, dy, dz);
        dragHighlightRig.ringRoot.scale.setScalar(metrics.ringScale * (1.1 + Math.sin(elapsedTotal * 12) * 0.1));
        dragHighlightRig.ringRoot.rotation.y = elapsedTotal * 4.5;
        dragHighlightRig.pointer.position.y = metrics.bodyHeight + 0.5 + Math.sin(elapsedTotal * 8) * 0.12;
        dragHighlightRig.pointer.rotation.y = elapsedTotal * 5;

        // Visual target reticle on ground & energetic telekinesis tether line
        const tx = draggedTargetUnit.dragTargetX ?? dx;
        const tz = draggedTargetUnit.dragTargetZ ?? dz;
        const targetTile = getTileFromArray(simRef.current, Math.round(tx), Math.round(tz));
        const reticleY = getTileEffectSurfaceY(targetTile, 0.36) + 0.06;
        dragTargetReticle.visible = true;
        dragTargetReticle.position.set(tx, reticleY, tz);
        dragTargetReticle.rotation.y = elapsedTotal * 2.5;
        dragTargetReticle.scale.setScalar(0.9 + Math.sin(elapsedTotal * 10) * 0.15);

        dragTetherLine.visible = true;
        const posAttr = dragTetherGeo.attributes.position as THREE.BufferAttribute;
        posAttr.setXYZ(0, dx, dy, dz);
        posAttr.setXYZ(1, tx, reticleY + 0.1, tz);
        posAttr.needsUpdate = true;
      } else {
        dragHighlightRig.group.visible = false;
        dragTargetReticle.visible = false;
        dragTetherLine.visible = false;
      }

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
        if (!isPointInCullBounds(fu.x, fu.z, worldCullBounds, 1.5)) continue;
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
          propsRef.current.zoneOverlayBuffers?.kingsActive &&
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

      // Update Hover Pixelated Circle Reticle position & integer tile footprint
      if (
        hoveredTileCoords &&
        propsRef.current.gameState === 'playing' &&
        !draggedUnitId &&
        !((isInspectMode || isDragMode) && hoverTargetUnit)
      ) {
        reticleGroup.visible = true;
        const ht =
          simRef.current.tiles[
            hoveredTileCoords.z * simRef.current.gridSize + hoveredTileCoords.x
          ];
        const hy = ht ? (ht.height <= 0 ? WATER_SURFACE_EFFECT_Y + 0.02 : ht.height * HEIGHT_STEP + 0.28) : 0.5;
        reticleGroup.position.set(hoveredTileCoords.x, hy, hoveredTileCoords.z);

        const tool = propsRef.current.activeTool;
        const activeBrushSize = propsRef.current.brushSize ?? 1;
        let reticleTileRadius = 0;
        let hexColor = '#f5b742';
        if (tool.kind === 'power') {
          const pDef = GOD_POWERS.find((p) => p.type === tool.power);
          if (tool.power === 'drag_entity') {
            reticleTileRadius = 0;
          } else {
            const effR = pDef ? getPowerEffectiveRadius(pDef.radius, activeBrushSize) : 2.5;
            reticleTileRadius = Math.max(0, Math.min(28, Math.round(effR)));
          }
          hexColor = pDef ? pDef.color : '#f5b742';
        } else if (tool.kind === 'terrain') {
          reticleTileRadius = getTerrainTileRadius(activeBrushSize);
          hexColor = '#56cfe1';
        } else if (tool.kind === 'build') {
          reticleTileRadius = 0;
          hexColor = '#80ed99';
        } else {
          reticleTileRadius = 0;
        }
        if (reticleTileRadius !== lastReticleTileRadius) {
          lastReticleTileRadius = reticleTileRadius;
          reticleMat.map = getPixelReticleTexture(reticleTileRadius);
          reticleMat.needsUpdate = true;
        }
        const gridSpan = reticleTileRadius * 2 + 1;
        reticleMesh.scale.set(gridSpan, 1, gridSpan);
        reticleMat.color.set(hexColor);
      } else {
        reticleGroup.visible = false;
      }

      // Update lighting preset (with live Day/Night Cycle support: Dawn, Noon, Dusk, Night, Midnight) & epoch atmosphere
      const rawPreset = propsRef.current.lightingPreset;
      const isCycleActive =
        rawPreset === 'auto' || simRef.current.worldRules?.dayNightCycle === true;
      let cyclePhase01 = 0.35;
      if (isCycleActive) {
        const cycleRate =
          propsRef.current.gameState === 'title'
            ? 0.35
            : clampSimulationSpeed(propsRef.current.timeScale);
        dayNightClock = (dayNightClock + dt * cycleRate) % 80;
        cyclePhase01 = dayNightClock / 80;
      }

      const todState = getTimeOfDayLightingState(
        isCycleActive ? 'auto' : rawPreset,
        cyclePhase01,
      );
      const preset = todState.preset;
      const currentDarkness = todState.darkness;
      const epochIdx = simRef.current.epochIndex;
      const epochDef = EPOCHS[epochIdx] || EPOCHS[0];

      if (preset === 'midnight') {
        _targetBgColor.set('#050811');
      } else if (preset === 'night') {
        _targetBgColor.set('#0b121c');
      } else if (preset === 'dusk') {
        _targetBgColor.set('#221826');
      } else if (preset === 'dawn') {
        _targetBgColor.set('#1f2836');
      } else {
        _targetBgColor.set(epochDef.skyColor);
      }
      _targetLightColor.setHex(todState.keyColorHex);

      const lightBlend = Math.min(1, dt * (isCycleActive ? 2.4 : 6.0));
      _bgColor.lerp(_targetBgColor, lightBlend);
      keyLight.color.lerp(_targetLightColor, lightBlend);
      keyLight.intensity += (todState.keyIntensity - keyLight.intensity) * lightBlend;

      // Dynamically tint hemisphere sky/ground fill, rim light, PBR environment intensity, and exposure
      _targetLightColor.setHex(todState.hemiSkyHex);
      hemiLight.color.lerp(_targetLightColor, lightBlend);
      _targetLightColor.setHex(todState.hemiGroundHex);
      hemiLight.groundColor.lerp(_targetLightColor, lightBlend);
      hemiLight.intensity += (todState.hemiIntensity - hemiLight.intensity) * lightBlend;

      _targetLightColor.setHex(todState.rimColorHex);
      rimLight.color.lerp(_targetLightColor, lightBlend);
      rimLight.intensity += (todState.rimIntensity - rimLight.intensity) * lightBlend;
      rimLight.position.set(todState.rimOffset[0], todState.rimOffset[1], todState.rimOffset[2]);

      scene.environmentIntensity = THREE.MathUtils.lerp(
        scene.environmentIntensity ?? 1.0,
        todState.environmentIntensity,
        lightBlend,
      );
      renderer.toneMappingExposure = THREE.MathUtils.lerp(
        renderer.toneMappingExposure,
        todState.toneMappingExposure,
        lightBlend,
      );

      scene.background = _bgColor;

      if (treeImpostors.mesh.visible) {
        // Normalize strictly relative to TIME_OF_DAY_PRESETS.noon (key=1.92, hemi=0.86, env=0.92)
        // so midday impostors stay 1.0x identical to 3D trees with zero darkening, while dusk/night tint smoothly.
        const noonRefLight = 1.92 * 0.62 + 0.86 * 0.38;
        const curLight = keyLight.intensity * 0.62 + hemiLight.intensity * 0.38;
        const daylightFactor = Math.max(0.24, Math.min(1.18, curLight / noonRefLight));
        const rRatio = Math.min(1.25, keyLight.color.r / Math.max(0.05, _noonRefColor.r));
        const gRatio = Math.min(1.25, keyLight.color.g / Math.max(0.05, _noonRefColor.g));
        const bRatio = Math.min(1.25, keyLight.color.b / Math.max(0.05, _noonRefColor.b));
        _impostorTint.setRGB(
          rRatio * 0.65 + 0.35,
          gRatio * 0.65 + 0.35,
          bRatio * 0.65 + 0.35,
        );
        treeImpostors.updateCameraAndLighting(camYaw, daylightFactor, _impostorTint);
      }
      if (scene.fog instanceof THREE.FogExp2) {
        _targetFogColor.setHex(todState.fogColorHex);
        scene.fog.color.lerp(_targetFogColor, lightBlend);
        scene.fog.density += (todState.fogDensity - scene.fog.density) * lightBlend;
      }

      // Age-dependent city, window, campfire, lamppost, and street illumination at dark hours
      updateBuildingNightMaterials(currentDarkness, shaderElapsed);

      const blds = simRef.current.buildings;
      const primarySpecies =
        blds.length > 0
          ? blds[0].species ??
            (blds[0].settlementId
              ? simRef.current.settlementSpecies?.[blds[0].settlementId]
              : undefined) ??
            'human'
          : 'human';
      const cityLightProfile = getEpochCityLightProfile(
        epochIdx,
        primarySpecies,
        currentDarkness,
        shaderElapsed,
      );

      // Update 3D street fixture materials according to current epoch & darkness
      if (epochIdx === 0) {
        streetPoleMat.color.setHex(0x4a301c);
        streetPoleMat.metalness = 0.05;
      } else if (epochIdx <= 2) {
        streetPoleMat.color.setHex(0x5c3a21);
        streetPoleMat.metalness = 0.18;
      } else if (epochIdx === 3) {
        streetPoleMat.color.setHex(0x282d33);
        streetPoleMat.metalness = 0.68;
      } else if (epochIdx <= 5) {
        streetPoleMat.color.setHex(0x64748b);
        streetPoleMat.metalness = 0.62;
      } else {
        streetPoleMat.color.setHex(0xcbd5e1);
        streetPoleMat.metalness = 0.75;
      }
      streetLampGlowMat.color.setHex(
        currentDarkness > 0.12 ? cityLightProfile.primaryHex : 0x475569,
      );
      streetLampGlowMat.emissive.setHex(cityLightProfile.primaryHex);
      streetLampGlowMat.emissiveIntensity = cityLightProfile.streetFixtureEmissiveIntensity;
      runwayBeaconMat.emissiveIntensity = 0.55 + currentDarkness * 2.25;

      // Update settlement heart light & distributed city cluster point lights
      hearthLight.color.setHex(cityLightProfile.primaryHex);
      hearthLight.distance = cityLightProfile.pointLightDistance;
      hearthLight.intensity =
        blds.length > 0
          ? Math.max(0.85, cityLightProfile.pointLightIntensity)
          : 0.35 * (1 - currentDarkness * 0.5);

      for (let ci = 0; ci < cityClusterLights.length; ci++) {
        const cLight = cityClusterLights[ci];
        if (blds.length > ci + 1 && currentDarkness > 0.08) {
          const step = Math.max(1, Math.floor(blds.length / (cityClusterLights.length + 1)));
          const bld = blds[Math.min(blds.length - 1, (ci + 1) * step)];
          const bTile = simRef.current.tiles[bld.tileZ * simRef.current.gridSize + bld.tileX];
          const by = (bTile ? Math.max(0.18, bTile.height * HEIGHT_STEP + 0.25) : 1.0) + 1.65;
          cLight.position.set(bld.tileX, by, bld.tileZ);
          const bSpec =
            bld.species ??
            (bld.settlementId
              ? simRef.current.settlementSpecies?.[bld.settlementId]
              : undefined) ??
            primarySpecies;
          const bProf = getEpochCityLightProfile(
            bld.epochLevel ?? epochIdx,
            bSpec,
            currentDarkness,
            shaderElapsed + ci * 1.3,
          );
          cLight.color.setHex(ci % 2 === 0 ? bProf.primaryHex : bProf.secondaryHex);
          cLight.distance = bProf.pointLightDistance;
          cLight.intensity = bProf.pointLightIntensity * 0.85;
        } else {
          cLight.intensity = 0;
        }
      }

      // Animate pixelated starry space backdrop, sculpted sky clouds & ocean coastal/reef/whitecap foaming
      pixelSpace.update({
        elapsed: elapsedTotal,
        width: renderWidth,
        height: renderHeight,
        pixelScale: currentDynamicPixelScale,
        camYaw,
        camX: camTarget.x,
        camZ: camTarget.z,
        frustumSize,
        preset,
      });

      if (appliedCloudsQuality !== 'off') {
        worldUnderglow.update(
          shaderElapsed,
          preset,
          epochIdx,
          currentDynamicPixelScale,
        );
      }
      if (preset === 'dusk') {
        glowTrimMat.color.set('#d98078');
        glowTrimMat.opacity = 0.4;
      } else if (preset === 'midnight') {
        glowTrimMat.color.set('#3a86ff');
        glowTrimMat.opacity = 0.56;
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
        propsRef.current.gameState === 'title'
          ? 0.5
          : clampedSimSpeed === 0
            ? 0
            : Math.min(5, Math.max(0.25, clampedSimSpeed));
      skyClouds.update(dt * atmosSpeed, shaderElapsed, preset);
      oceanFoam.updateFrame(shaderElapsed, preset);
      zoneOverlay.updateFrame(shaderElapsed);
      styledTerrain.updateFrame(
        shaderElapsed,
        epochIdx,
        isCycleActive ? 'auto' : preset,
        cyclePhase01,
      );

      // Smooth exponential camera damping + decaying trauma shake
      const followDamp = propsRef.current.followingEntityId ? 11 : 8;
      camYaw = THREE.MathUtils.damp(camYaw, camDesiredYaw, 8, dt);
      camTarget.x = THREE.MathUtils.damp(camTarget.x, camDesiredTarget.x, followDamp, dt);
      camTarget.y = THREE.MathUtils.damp(camTarget.y, camDesiredTarget.y, followDamp, dt);
      camTarget.z = THREE.MathUtils.damp(camTarget.z, camDesiredTarget.z, followDamp, dt);

      if (container) {
        const w = Math.max(1, container.clientWidth);
        const h = Math.max(1, container.clientHeight);
        const newAspect = w / h;

        if (Math.abs(frustumSize - desiredFrustum) > 0.01) {
          frustumSize = THREE.MathUtils.damp(frustumSize, desiredFrustum, 15, dt);
          camera.left = (-frustumSize * newAspect) / 2;
          camera.right = (frustumSize * newAspect) / 2;
          camera.top = frustumSize / 2;
          camera.bottom = -frustumSize / 2;
          camera.updateProjectionMatrix();
        }

        // Dynamically and smoothly interpolate pixel scale from 2.5x (zoomed in) to 1.0x (zoomed out)
        // On HiDPI mobile devices, also unlocks up to 2x native sharpness as the player zooms out
        // Under severe sustained tier-3 GPU stalls, gently relax pixel density and recover automatically
        const baseScale = propsRef.current.pixelScale || 2.5;
        const baseTargetPixelScale = computeDynamicPixelScale(
          frustumSize,
          simRef.current.gridSize,
          newAspect,
          baseScale,
        );
        const targetDynamicPixelScale =
          autoOptDecisions.pixelScaleMult < 0.99
            ? Math.min(3.0, baseTargetPixelScale / autoOptDecisions.pixelScaleMult)
            : baseTargetPixelScale;
        if (Math.abs(currentDynamicPixelScale - targetDynamicPixelScale) > 0.0005) {
          currentDynamicPixelScale = THREE.MathUtils.damp(
            currentDynamicPixelScale,
            targetDynamicPixelScale,
            8,
            dt,
          );
        } else {
          currentDynamicPixelScale = targetDynamicPixelScale;
        }
        computeDynamicRenderDimensions(
          w,
          h,
          currentDynamicPixelScale,
          window.devicePixelRatio || 1,
          baseScale,
          1.0,
          isSoftwareGl,
          _renderSizeOut,
        );
        const dw = Math.abs(_renderSizeOut.width - renderWidth);
        const dh = Math.abs(_renderSizeOut.height - renderHeight);
        if (dw > 0 || dh > 0) {
          const zoomSettled =
            Math.abs(frustumSize - desiredFrustum) <= 0.08 &&
            Math.abs(currentDynamicPixelScale - targetDynamicPixelScale) <= 0.004;
          const bigResize =
            dw >= Math.max(36, renderWidth * 0.08) || dh >= Math.max(24, renderHeight * 0.08);
          if (zoomSettled || bigResize) {
            renderWidth = _renderSizeOut.width;
            renderHeight = _renderSizeOut.height;
            renderer.setSize(renderWidth, renderHeight, false);
          }
        }
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

      // Keep directional keyLight tracking camTarget with tight texel-snapped shadow frustum
      const snappedShadow = computeSnappedShadowBounds(
        camTarget.x,
        camTarget.z,
        frustumSize,
        getCurrentAspect(),
        simRef.current.gridSize,
        appliedShadowMapSize,
      );
      keyLight.target.position.set(snappedShadow.centerX, 0, snappedShadow.centerZ);
      keyLight.position.set(
        snappedShadow.centerX + todState.keyOffset[0],
        todState.keyOffset[1],
        snappedShadow.centerZ + todState.keyOffset[2],
      );
      let shadowFrustumChanged = false;
      if (Math.abs(shadowBounds - snappedShadow.halfExtent) > Math.max(2.5, shadowBounds * 0.12)) {
        shadowBounds = snappedShadow.halfExtent;
        keyLight.shadow.camera.left = -shadowBounds;
        keyLight.shadow.camera.right = shadowBounds;
        keyLight.shadow.camera.top = shadowBounds;
        keyLight.shadow.camera.bottom = -shadowBounds;
        keyLight.shadow.camera.updateProjectionMatrix();
        shadowFrustumChanged = true;
      }
      if (
        appliedShadowsEnabled &&
        (shadowFrustumChanged ||
          Math.abs(lastShadowCenterX - snappedShadow.centerX) > 1.2 ||
          Math.abs(lastShadowCenterZ - snappedShadow.centerZ) > 1.2)
      ) {
        lastShadowCenterX = snappedShadow.centerX;
        lastShadowCenterZ = snappedShadow.centerZ;
        renderer.shadowMap.needsUpdate = true;
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
        for (let i = 0; i < labelLayer.children.length; i++) {
          const el = labelLayer.children[i] as HTMLElement;
          const tx = Number(el.dataset.tileX);
          const tz = Number(el.dataset.tileZ);
          const isFlatGround = el.dataset.flatGround === '1';
          const tile = curSim.tiles[tz * gSize + tx];
          const surfaceY = tile ? Math.max(0.15, tile.height * HEIGHT_STEP) : 0.45;
          const worldY = isFlatGround ? surfaceY + 0.35 : Math.max(0.5, surfaceY) + 1.6;
          _zoneProjVec.set(tx, worldY, tz).project(camera);
          const sx = (_zoneProjVec.x * 0.5 + 0.5) * cWidth;
          const sy = (-_zoneProjVec.y * 0.5 + 0.5) * cHeight;
          const offscreen =
            _zoneProjVec.z > 1 || sx < -120 || sx > cWidth + 120 || sy < -60 || sy > cHeight + 60;
          const nextOpacity = offscreen ? '0' : '1';
          if (el.dataset.lastOpacity !== nextOpacity) {
            el.dataset.lastOpacity = nextOpacity;
            el.style.opacity = nextOpacity;
          }
          if (!offscreen) {
            const anchorTranslate = isFlatGround ? 'translate(-50%, -50%)' : 'translate(-50%, -100%)';
            const nextTransform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0) ${anchorTranslate}`;
            if (el.dataset.lastTransform !== nextTransform) {
              el.dataset.lastTransform = nextTransform;
              el.style.transform = nextTransform;
            }
          }
        }
      }

      // Update floating screen-space King Crown markers on the map
      const kingLayer = kingMarkersLayerRef.current;
      if (kingLayer && kingLayer.children.length > 0) {
        const cWidth = container?.clientWidth || window.innerWidth;
        const cHeight = container?.clientHeight || window.innerHeight;
        const gSize = curSim.gridSize;
        for (let i = 0; i < kingLayer.children.length; i++) {
          const el = kingLayer.children[i] as HTMLElement;
          const unitId = el.dataset.unitId;
          const kingUnit = unitId
            ? curSim.units.find((u) => u.id === unitId && u.state !== 'ko')
            : undefined;
          if (!kingUnit) {
            if (el.dataset.lastOpacity !== '0') {
              el.dataset.lastOpacity = '0';
              el.style.opacity = '0';
            }
            continue;
          }
          const uGrp = unitMeshes.get(kingUnit.id)?.group;
          const kx = uGrp ? uGrp.position.x : kingUnit.x;
          const kz = uGrp ? uGrp.position.z : kingUnit.z;
          const tile = curSim.tiles[Math.round(kz) * gSize + Math.round(kx)];
          const baseY = uGrp
            ? uGrp.position.y
            : Math.max(0.5, (tile ? tile.height : 1) * HEIGHT_STEP);
          _kingProjVec.set(kx, baseY + 1.45, kz).project(camera);
          const sx = (_kingProjVec.x * 0.5 + 0.5) * cWidth;
          const sy = (-_kingProjVec.y * 0.5 + 0.5) * cHeight;
          const offscreen =
            _kingProjVec.z > 1 || sx < -120 || sx > cWidth + 120 || sy < -60 || sy > cHeight + 60;
          const nextOpacity = offscreen ? '0' : '1';
          if (el.dataset.lastOpacity !== nextOpacity) {
            el.dataset.lastOpacity = nextOpacity;
            el.style.opacity = nextOpacity;
          }
          if (!offscreen) {
            const nextTransform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0) translate(-50%, -100%)`;
            if (el.dataset.lastTransform !== nextTransform) {
              el.dataset.lastTransform = nextTransform;
              el.style.transform = nextTransform;
            }
          }
        }
      }

      // Throttle React HUD state synchronization to <= 6 Hz during gameplay so we never setState at 60Hz or during title screen
      hudSyncAccumulator += dt;
      if (hudSyncAccumulator >= 0.18) {
        hudSyncAccumulator = 0;
        if (currentGameState === 'playing') {
          propsRef.current.onSyncHud();
        }
      }

      // Optional Phase 0 Performance Debug HUD telemetry (throttled to ~4 Hz; zero overhead when off)
      if (propsRef.current.graphicsSettings?.showPerformanceHud && propsRef.current.onPerfTelemetry) {
        perfHudAccum += dt;
        perfFrameCount++;
        if (perfHudAccum >= 0.25) {
          const avgFrameMs = (perfHudAccum * 1000) / Math.max(1, perfFrameCount);
          const avgFps = Math.round(perfFrameCount / perfHudAccum);
          const chunkStats = chunkTerrain.updateVisibilityStats(camera);
          propsRef.current.onPerfTelemetry({
            fps: avgFps,
            frameMs: avgFrameMs,
            drawCalls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            visibleChunks: chunkStats.visibleChunks,
            totalChunks: chunkStats.totalChunks,
            activeUnits: simRef.current.units.length,
            activeBuildings: simRef.current.buildings.length,
            simTickMs: lastSimTickMs,
            workerQueue: chunkStats.pendingWorkerChunks,
            gridSize: simRef.current.gridSize,
          });
          perfHudAccum = 0;
          perfFrameCount = 0;
        }
      } else {
        perfHudAccum = 0;
        perfFrameCount = 0;
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (captureThumbnailRef) {
      captureThumbnailRef.current = () => {
        try {
          const srcCanvas = renderer.domElement;
          if (!srcCanvas || srcCanvas.width <= 0 || srcCanvas.height <= 0) {
            return null;
          }
          renderer.render(scene, camera);
          const targetW = 320;
          const targetH = 180;
          const thumbCanvas = document.createElement('canvas');
          thumbCanvas.width = targetW;
          thumbCanvas.height = targetH;
          const ctx = thumbCanvas.getContext('2d');
          if (!ctx) return null;
          ctx.imageSmoothingEnabled = false;
          const srcAspect = srcCanvas.width / srcCanvas.height;
          const dstAspect = targetW / targetH;
          let sx = 0;
          let sy = 0;
          let sw = srcCanvas.width;
          let sh = srcCanvas.height;
          if (srcAspect > dstAspect) {
            sw = Math.max(1, Math.round(srcCanvas.height * dstAspect));
            sx = Math.max(0, Math.round((srcCanvas.width - sw) * 0.5));
          } else if (srcAspect < dstAspect) {
            sh = Math.max(1, Math.round(srcCanvas.width / dstAspect));
            sy = Math.max(0, Math.round((srcCanvas.height - sh) * 0.5));
          }
          ctx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, targetW, targetH);
          return thumbCanvas.toDataURL('image/jpeg', 0.85);
        } catch {
          return null;
        }
      };
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      if (captureThumbnailRef) {
        captureThumbnailRef.current = null;
      }
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('orientationchange', onOrientationOrViewportChange);
      window.visualViewport?.removeEventListener('resize', updateSize);
      domElem.removeEventListener('pointerdown', onPointerDown);
      domElem.removeEventListener('pointermove', onPointerMove);
      domElem.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      domElem.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      hoverHighlightRig.dispose();
      selectedHighlightRig.dispose();
      dragHighlightRig.dispose();
      favoriteStarGeo.dispose();
      favoriteStarMat.dispose();
      kingCrownGeo.dispose();
      kingCrownMat.dispose();
      unitShadowGeo.dispose();
      unitShadowMat.dispose();
      for (const hv of hazardMeshes.values()) {
        disposeHazardVisual(hv);
      }
      batchedBuildings.dispose();
      treeImpostors.dispose();
      treeBatchShadow.dispose();
      treeBatchNoShadow.dispose();
      ambBatch.dispose();
      for (const uEntry of unitMeshes.values()) {
        disposeEntityGroup(uEntry.group);
      }
      for (const vEntry of vehicleMeshes.values()) {
        disposeEntityGroup(vEntry.group);
      }
      for (const we of wispMeshes.values()) {
        for (const m of we.materials) m.dispose();
      }
      sharedWispCoreGeo.dispose();
      sharedWispHaloGeo.dispose();
      sharedWispOrbitGeo.dispose();
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
      sharedTornadoRingGeo.dispose();
      sharedTornadoFunnelGeo.dispose();
      sharedTornadoCapGeo.dispose();
      sharedDebrisCubeGeo.dispose();
      sharedWhirlpoolDiskGeo.dispose();
      sharedWhirlpoolFunnelGeo.dispose();
      sharedMeteorGeo.dispose();
      sharedMeteorAuraGeo.dispose();
      sharedExplosionDomeGeo.dispose();
      sharedBoltGeo.dispose();
      sharedRuneSquareGeo.dispose();
      sharedOrbMoteGeo.dispose();
      sharedShardMoteGeo.dispose();
      sharedPillarSpikeGeo.dispose();
      sharedTracerGeo.dispose();
      sharedBulletCoreGeo.dispose();
      sharedShellGeo.dispose();
      sharedShellHaloGeo.dispose();
      sharedBombBodyGeo.dispose();
      sharedBombFinGeo.dispose();
      sharedMissileGeo.dispose();
      sharedMissileWarheadGeo.dispose();
      sharedMissilePlumeGeo.dispose();
      sharedArcaneBoltGeo.dispose();
      sharedArcaneRingGeo.dispose();
      sharedPlasmaBeamGeo.dispose();
      sharedPlasmaMuzzleGeo.dispose();
      sharedSparkShardGeo.dispose();
      sharedNukeStemGeo.dispose();
      sharedNukeCapGeo.dispose();
      sharedNukeTorusGeo.dispose();
      sharedArcaneSpireGeo.dispose();
      sharedArcaneHaloTorusGeo.dispose();
      sharedRunePillarGeo.dispose();
      sharedBeamColGeo.dispose();
      sharedBattlewillCrescentGeo.dispose();
      sharedBattlewillEdgeGeo.dispose();
      sharedMagicCircleGeo.dispose();
      disposeMagicCircleTextureCache();
      disposePixelReticleTextureCache();
      dragTargetReticleGeo.dispose();
      dragTargetReticleMat.dispose();
      dragTetherGeo.dispose();
      dragTetherMat.dispose();
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
      zoneOverlay.dispose();
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
      streetPoleGeo.dispose();
      streetLampHeadGeo.dispose();
      skywayDeckGeo.dispose();
      skywayTrimGeo.dispose();
      billboardFrameGeo.dispose();
      billboardScreenGeo.dispose();
      streetPoleMat.dispose();
      streetLampGlowMat.dispose();
      skywayDeckMat.dispose();
      skywayTrimMat.dispose();
      billboardCyanMat.dispose();
      billboardPinkMat.dispose();
      billboardGoldMat.dispose();
      chunkTerrain.dispose();
      terrainWorkerPool.dispose();
      for (const batch of propBatches) batch.dispose();
      for (const inst of allMetroInsts) inst.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      particleInstanced.dispose();
      favoriteStarsInst.dispose();
      kingCrownsInst.dispose();
      renderer.dispose();
    };
  }, [cameraActionRef, captureThumbnailRef, simRef]);

  const activeLabels = zoneOverlayBuffers?.labels ?? [];
  const kingsOverlayOn = Boolean(zoneOverlayBuffers?.kingsActive);
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
        className="fixed inset-0 w-full h-full bg-[#141210] overflow-hidden touch-none select-none"
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
              data-flat-ground={lbl.flatGround ? '1' : '0'}
              style={{
                backgroundColor: `color-mix(in srgb, ${lbl.hexColor} 28%, #161310)`,
                borderColor: `color-mix(in srgb, ${lbl.hexColor} 55%, #000000)`,
                left: 0,
                top: 0,
                opacity: 0,
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
              {lbl.epochName && (
                <span className="text-[10px] font-semibold text-[#d6cec0] border-l border-white/20 pl-1.5">
                  {lbl.epochName}
                </span>
              )}
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
});
