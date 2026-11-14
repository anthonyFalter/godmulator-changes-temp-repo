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
import { getSettlementAnchor, stepSimulation } from '../game/simulation';
import {
  ActiveTool,
  GameLifecycleState,
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
const MAX_PARTICLES = 160;

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
    const unitMeshes = new Map<string, { group: THREE.Group; epochLevel: number; role: string }>();

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
    const particleGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
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
      spread = 1.5,
      upSpeed = 3.2,
    ) {
      const baseCol = new THREE.Color(hexColor);
      for (let i = 0; i < count; i++) {
        const p = particles[particleHead];
        particleHead = (particleHead + 1) % MAX_PARTICLES;
        p.active = true;
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * spread;
        p.x = x + Math.cos(angle) * r * 0.45;
        p.y = y + 0.15 + Math.random() * 0.3;
        p.z = z + Math.sin(angle) * r * 0.45;
        p.vx = Math.cos(angle) * (0.8 + Math.random() * 2.2);
        p.vy = upSpeed * (0.5 + Math.random() * 0.9);
        p.vz = Math.sin(angle) * (0.8 + Math.random() * 2.2);
        p.maxLife = 0.45 + Math.random() * 0.45;
        p.life = p.maxLife;
        p.size = 0.7 + Math.random() * 0.9;
        p.color.copy(baseCol).offsetHSL((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.15);
      }
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

      // 3. Sync units with gait bob, work chop animation, carried resources, and epoch gear
      const activeUnitIds = new Set<string>();
      for (const u of simState.units) {
        activeUnitIds.add(u.id);
        let uEntry = unitMeshes.get(u.id);
        const desiredEpoch = u.faction === 'civilization' ? simState.epochIndex : 0;
        if (!uEntry || uEntry.epochLevel !== desiredEpoch || uEntry.role !== u.role) {
          if (uEntry) unitsGroup.remove(uEntry.group);
          const group = createUnitGroup(u.role, u.faction, desiredEpoch);
          unitsGroup.add(group);
          uEntry = { group, epochLevel: desiredEpoch, role: u.role };
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

      // 4. Consume pending VFX bursts
      while (simState.pendingVfx.length > 0) {
        const vfx = simState.pendingVfx.shift()!;
        const isHeavy =
          vfx.type === 'meteor_strike' ||
          vfx.type === 'lightning_smite' ||
          vfx.type === 'terraform_beam' ||
          vfx.type === 'epoch_up' ||
          vfx.type === 'wormhole_ascension';
        if (isHeavy) {
          trauma = Math.min(1.0, trauma + 0.65);
          hitstopTimer = 0.06;
          spawnParticleBurst(vfx.x, vfx.y + 0.3, vfx.z, 28, vfx.color, vfx.radius * 0.7, 4.8);
        } else {
          spawnParticleBurst(vfx.x, vfx.y + 0.2, vfx.z, 12, vfx.color, vfx.radius * 0.45, 2.8);
        }
      }
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
        p.vy -= 9.5 * dt; // Gravity
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const ratio = p.life / p.maxLife;
        _dummyPos.set(p.x, Math.max(0.1, p.y), p.z);
        _dummyScale.setScalar(p.size * ratio);
        _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
        particleInstanced.setMatrixAt(i, _dummyMatrix);
        particleInstanced.setColorAt(i, p.color);
      }
      particleInstanced.instanceMatrix.needsUpdate = true;
      if (particleInstanced.instanceColor) particleInstanced.instanceColor.needsUpdate = true;

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
