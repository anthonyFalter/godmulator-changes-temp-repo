import * as THREE from 'three';
import { TreeBiomeKey, VoxelTreeLibrary } from './voxelTrees';

const IMPOSTOR_BIOME_ORDER: readonly TreeBiomeKey[] = [
  'forest',
  'meadow',
  'jungle',
  'taiga',
  'blossom',
  'savanna',
  'swamp',
  'highland',
  'volcanic',
  'blight',
  'floral',
];

const ANGLES_PER_SPECIES = 8;
const CELL_PX = 64;
const ATLAS_COLS = 32; // 4 species * 8 angles per row
const ATLAS_ROWS = 32; // up to 128 species (live + burnt across all biomes)
const ATLAS_W = ATLAS_COLS * CELL_PX; // 2048
const ATLAS_H = ATLAS_ROWS * CELL_PX; // 2048

// Match IsometricWorldCanvas camera elevation (isoDist=28, isoHeight=22.5)
const BAKE_ISO_DIST = 28;
const BAKE_ISO_HEIGHT = 22.5;

interface BakedSpeciesMeta {
  speciesIndex: number;
  centerY: number;
  halfExtent: number;
}

/**
 * Multi-angle baked pixel-art impostor renderer for far/overview voxel trees.
 *
 * At startup, renders every full-detail LOD0 voxel tree species (live + burnt) from 8 yaw angles
 * at the exact isometric camera pitch into a single 2048x1024 crisp NearestFilter atlas.
 * At overview zoom (`lodBand === 3`), replaces 84–145 tri 3D LOD3 trees with a single 1-draw-call
 * `InstancedMesh` of 2-triangle camera-facing quads (-98% tree triangles on large maps) while
 * preserving full-detail LOD0 painterly silhouettes and dynamic day/night tinting.
 */
export class TreeImpostorSystem {
  readonly mesh: THREE.Mesh;
  isBaked: boolean;

  private readonly renderTarget: THREE.WebGLRenderTarget | null;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly speciesLookup: BakedSpeciesMeta[][][]; // [charred 0|1][biomeIdx 0..7][varIdx]

  // Progressive frame-sliced baking state (eliminates 512 synchronous WebGL render passes on page load)
  private bakeRenderer: THREE.WebGLRenderer | null = null;
  private bakeScene: THREE.Scene | null = null;
  private bakeCam: THREE.OrthographicCamera | null = null;
  private bakeMesh: THREE.Mesh | null = null;
  private bakeSpeciesGeos: THREE.BufferGeometry[] = [];
  private bakeSpeciesMetas: BakedSpeciesMeta[] = [];
  private bakeCursor = 0;
  private bakeInitialized = false;

  private capacity: number;
  private count = 0;
  private centerSizeArray: Float32Array;
  private specYawArray: Float32Array;
  private centerSizeAttr: THREE.InstancedBufferAttribute;
  private specYawAttr: THREE.InstancedBufferAttribute;

  constructor(
    renderer: THREE.WebGLRenderer | null,
    voxelTreeLib: VoxelTreeLibrary,
    initialCapacity = 2048,
    environmentTexture: THREE.Texture | null = null,
    deferBake = true,
  ) {
    this.capacity = Math.max(256, initialCapacity);
    this.speciesLookup = [[], []];

    const speciesGeos: THREE.BufferGeometry[] = [];
    const speciesMetas: BakedSpeciesMeta[] = [];
    const tmpBox = new THREE.Box3();
    const tmpSize = new THREE.Vector3();
    const tmpCenter = new THREE.Vector3();

    for (let charred = 0; charred < 2; charred++) {
      const biomeMap = charred === 0 ? voxelTreeLib.byBiome : voxelTreeLib.burntByBiome;
      for (let b = 0; b < IMPOSTOR_BIOME_ORDER.length; b++) {
        const biomeKey = IMPOSTOR_BIOME_ORDER[b];
        const geos = biomeMap[biomeKey] ?? [];
        const row: BakedSpeciesMeta[] = [];
        for (let v = 0; v < geos.length; v++) {
          const g = geos[v];
          if (!g.boundingBox) g.computeBoundingBox();
          tmpBox.copy(g.boundingBox!);
          tmpBox.getSize(tmpSize);
          tmpBox.getCenter(tmpCenter);

          const radXZ = Math.max(
            Math.abs(tmpBox.min.x),
            Math.abs(tmpBox.max.x),
            Math.abs(tmpBox.min.z),
            Math.abs(tmpBox.max.z),
          );
          const halfY = tmpSize.y * 0.5;
          // Bounding sphere radius around (0, centerY, 0) padded by 8% so zero pixels clip at any angle
          const halfExtent = Math.max(0.25, Math.hypot(radXZ, halfY) * 1.08);

          const meta: BakedSpeciesMeta = {
            speciesIndex: speciesGeos.length,
            centerY: tmpCenter.y,
            halfExtent,
          };
          speciesGeos.push(g);
          speciesMetas.push(meta);
          row.push(meta);
        }
        this.speciesLookup[charred].push(row);
      }
    }

    // Prepare 2048x1024 atlas RenderTarget; bake progressively via stepBake() unless deferBake=false
    let rt: THREE.WebGLRenderTarget | null = null;
    this.isBaked = false;
    if (renderer && speciesGeos.length > 0 && speciesGeos.length <= (ATLAS_COLS * ATLAS_ROWS) / ANGLES_PER_SPECIES) {
      try {
        rt = this.initBakeContext(renderer, voxelTreeLib.material, environmentTexture, speciesGeos, speciesMetas);
        if (!deferBake) {
          this.stepBake(speciesGeos.length);
        }
      } catch {
        rt = null;
        this.clearBakeContext();
      }
    }
    this.renderTarget = rt;

    // Build single 2-triangle InstancedBufferGeometry
    const basePlane = new THREE.PlaneGeometry(1, 1);
    const instGeo = new THREE.InstancedBufferGeometry();
    instGeo.index = basePlane.index;
    instGeo.attributes.position = basePlane.attributes.position;
    instGeo.attributes.uv = basePlane.attributes.uv;
    basePlane.dispose();

    this.centerSizeArray = new Float32Array(this.capacity * 4);
    this.specYawArray = new Float32Array(this.capacity * 2);
    this.centerSizeAttr = new THREE.InstancedBufferAttribute(this.centerSizeArray, 4);
    this.specYawAttr = new THREE.InstancedBufferAttribute(this.specYawArray, 2);
    this.centerSizeAttr.setUsage(THREE.DynamicDrawUsage);
    this.specYawAttr.setUsage(THREE.DynamicDrawUsage);

    instGeo.setAttribute('aTreeCenterSize', this.centerSizeAttr);
    instGeo.setAttribute('aTreeSpecYaw', this.specYawAttr);
    instGeo.instanceCount = 0;
    this.geometry = instGeo;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: rt ? rt.texture : null },
        uCamYaw: { value: Math.PI / 4 },
        uTint: { value: new THREE.Color(1, 1, 1) },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aTreeCenterSize;
        attribute vec2 aTreeSpecYaw;

        uniform float uCamYaw;
        varying vec2 vUv;

        const float TWO_PI = 6.28318530718;
        const float SECTOR = 0.78539816339; // TWO_PI / 8.0
        const float HALF_SECTOR = 0.39269908169;

        void main() {
          vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 camUp    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

          vec3 worldPos = aTreeCenterSize.xyz
            + camRight * (position.x * aTreeCenterSize.w)
            + camUp    * (position.y * aTreeCenterSize.w);

          float relYaw = mod(uCamYaw - aTreeSpecYaw.y + TWO_PI * 4.0 + HALF_SECTOR, TWO_PI);
          float angleIdx = floor(relYaw / SECTOR);
          angleIdx = clamp(angleIdx, 0.0, 7.0);

          float cellIdx = floor(aTreeSpecYaw.x + 0.5) * 8.0 + angleIdx;
          float col = mod(cellIdx, ${ATLAS_COLS.toFixed(1)});
          float row = floor(cellIdx / ${ATLAS_COLS.toFixed(1)});

          // Half-texel inset prevents bleeding across adjacent atlas cells
          vec2 pad = vec2(0.5 / ${CELL_PX.toFixed(1)}, 0.5 / ${CELL_PX.toFixed(1)});
          vec2 localUv = mix(pad, vec2(1.0) - pad, uv);
          vUv = (vec2(col, row) + localUv) / vec2(${ATLAS_COLS.toFixed(1)}, ${ATLAS_ROWS.toFixed(1)});

          gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uAtlas;
        uniform vec3 uTint;
        varying vec2 vUv;

        void main() {
          vec4 tex = texture2D(uAtlas, vUv);
          if (tex.a < 0.45) discard;
          gl_FragColor = vec4(tex.rgb * uTint, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      side: THREE.FrontSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'voxel_tree_impostors';
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.visible = false;
  }

  private initBakeContext(
    renderer: THREE.WebGLRenderer,
    treeMaterial: THREE.Material,
    environmentTexture: THREE.Texture | null,
    speciesGeos: THREE.BufferGeometry[],
    speciesMetas: BakedSpeciesMeta[],
  ): THREE.WebGLRenderTarget {
    const rt = new THREE.WebGLRenderTarget(ATLAS_W, ATLAS_H, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
      generateMipmaps: false,
    });

    const bakeScene = new THREE.Scene();
    if (environmentTexture) {
      bakeScene.environment = environmentTexture;
      bakeScene.environmentIntensity = 0.92;
    }

    // Match TIME_OF_DAY_PRESETS.noon 1:1 so midday impostors have identical brightness & hues to 3D trees
    const hemi = new THREE.HemisphereLight(0x8ecae6, 0x2b3a3e, 0.86);
    hemi.position.set(0, 30, 0);
    bakeScene.add(hemi);

    const key = new THREE.DirectionalLight(0xffdfb0, 1.92);
    key.position.set(12, 29, 8);
    bakeScene.add(key);

    const rim = new THREE.DirectionalLight(0x56cfe1, 0.55);
    rim.position.set(-16, 15, -16);
    bakeScene.add(rim);

    const bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
    const bakeMesh = new THREE.Mesh(speciesGeos[0], treeMaterial);
    bakeScene.add(bakeMesh);

    this.bakeRenderer = renderer;
    this.bakeScene = bakeScene;
    this.bakeCam = bakeCam;
    this.bakeMesh = bakeMesh;
    this.bakeSpeciesGeos = speciesGeos;
    this.bakeSpeciesMetas = speciesMetas;
    this.bakeCursor = 0;
    this.bakeInitialized = false;
    return rt;
  }

  private clearBakeContext(): void {
    this.bakeRenderer = null;
    this.bakeScene = null;
    this.bakeCam = null;
    this.bakeMesh = null;
    this.bakeSpeciesGeos = [];
    this.bakeSpeciesMetas = [];
  }

  /**
   * Progressively bakes up to `maxSpeciesPerFrame` species (8 yaw cells each) into the atlas.
   * Returns `true` on the exact frame baking finishes so the caller can flip overview trees to impostors.
   */
  stepBake(maxSpeciesPerFrame = 2): boolean {
    if (this.isBaked) return false;
    const renderer = this.bakeRenderer;
    const rt = this.renderTarget;
    const bakeScene = this.bakeScene;
    const bakeCam = this.bakeCam;
    const bakeMesh = this.bakeMesh;
    if (!renderer || !rt || !bakeScene || !bakeCam || !bakeMesh) return false;

    const total = this.bakeSpeciesGeos.length;
    if (total === 0) {
      this.clearBakeContext();
      return false;
    }

    const prevTarget = renderer.getRenderTarget();
    const prevViewport = new THREE.Vector4();
    renderer.getViewport(prevViewport);
    const prevScissor = new THREE.Vector4();
    renderer.getScissor(prevScissor);
    const prevScissorTest = renderer.getScissorTest();
    const prevClearColor = new THREE.Color();
    renderer.getClearColor(prevClearColor);
    const prevClearAlpha = renderer.getClearAlpha();
    const prevAutoClear = renderer.autoClear;
    const prevShadowEnabled = renderer.shadowMap.enabled;
    const prevToneMapping = renderer.toneMapping;

    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = false;
    renderer.setRenderTarget(rt);

    if (!this.bakeInitialized) {
      this.bakeInitialized = true;
      renderer.setViewport(0, 0, ATLAS_W, ATLAS_H);
      renderer.setScissorTest(false);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, false);
    }

    renderer.setScissorTest(true);
    const end = Math.min(total, this.bakeCursor + Math.max(1, maxSpeciesPerFrame));
    for (let s = this.bakeCursor; s < end; s++) {
      const meta = this.bakeSpeciesMetas[s];
      bakeMesh.geometry = this.bakeSpeciesGeos[s];

      const ext = meta.halfExtent;
      bakeCam.left = -ext;
      bakeCam.right = ext;
      bakeCam.top = ext;
      bakeCam.bottom = -ext;
      bakeCam.updateProjectionMatrix();

      for (let a = 0; a < ANGLES_PER_SPECIES; a++) {
        const yaw = (a / ANGLES_PER_SPECIES) * Math.PI * 2;
        bakeCam.position.set(
          Math.sin(yaw) * BAKE_ISO_DIST,
          meta.centerY + BAKE_ISO_HEIGHT,
          Math.cos(yaw) * BAKE_ISO_DIST,
        );
        bakeCam.lookAt(0, meta.centerY, 0);
        bakeCam.updateMatrixWorld();

        const cellIdx = s * ANGLES_PER_SPECIES + a;
        const col = cellIdx % ATLAS_COLS;
        const row = Math.floor(cellIdx / ATLAS_COLS);
        const vx = col * CELL_PX;
        const vy = row * CELL_PX;

        renderer.setViewport(vx, vy, CELL_PX, CELL_PX);
        renderer.setScissor(vx, vy, CELL_PX, CELL_PX);
        renderer.clear(false, true, false);
        renderer.render(bakeScene, bakeCam);
      }
    }
    this.bakeCursor = end;

    renderer.setRenderTarget(prevTarget);
    renderer.setViewport(prevViewport);
    renderer.setScissor(prevScissor);
    renderer.setScissorTest(prevScissorTest);
    renderer.setClearColor(prevClearColor, prevClearAlpha);
    renderer.autoClear = prevAutoClear;
    renderer.shadowMap.enabled = prevShadowEnabled;
    renderer.toneMapping = prevToneMapping;

    if (this.bakeCursor >= total) {
      this.isBaked = true;
      this.clearBakeContext();
      return true;
    }
    return false;
  }

  private ensureCapacity(needed: number): void {
    if (needed <= this.capacity) return;
    let nextCap = this.capacity;
    while (nextCap < needed) nextCap = Math.ceil(nextCap * 1.6);

    const nextCS = new Float32Array(nextCap * 4);
    nextCS.set(this.centerSizeArray.subarray(0, this.count * 4));
    const nextSY = new Float32Array(nextCap * 2);
    nextSY.set(this.specYawArray.subarray(0, this.count * 2));

    this.capacity = nextCap;
    this.centerSizeArray = nextCS;
    this.specYawArray = nextSY;
    this.centerSizeAttr = new THREE.InstancedBufferAttribute(nextCS, 4);
    this.specYawAttr = new THREE.InstancedBufferAttribute(nextSY, 2);
    this.centerSizeAttr.setUsage(THREE.DynamicDrawUsage);
    this.specYawAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('aTreeCenterSize', this.centerSizeAttr);
    this.geometry.setAttribute('aTreeSpecYaw', this.specYawAttr);
  }

  reset(): void {
    this.count = 0;
  }

  pushTreeFromMatrix(
    charred: number,
    biomeIdx: number,
    varIdx: number,
    matArr: Float32Array,
    matOffset: number,
  ): void {
    const meta = this.speciesLookup[charred]?.[biomeIdx]?.[varIdx];
    if (!meta) return;

    const slot = this.count;
    this.ensureCapacity(slot + 1);
    this.count = slot + 1;

    const m0 = matArr[matOffset];
    const m2 = matArr[matOffset + 2];
    const m5 = matArr[matOffset + 5];
    const wx = matArr[matOffset + 12];
    const wy = matArr[matOffset + 13];
    const wz = matArr[matOffset + 14];

    const scaleXZ = Math.hypot(m0, m2);
    const scaleY = m5;
    const yaw = Math.atan2(-m2, m0);
    const quadSize = Math.max(scaleXZ, scaleY) * meta.halfExtent * 2.0;

    const o4 = slot * 4;
    this.centerSizeArray[o4] = wx;
    this.centerSizeArray[o4 + 1] = wy + meta.centerY * scaleY;
    this.centerSizeArray[o4 + 2] = wz;
    this.centerSizeArray[o4 + 3] = quadSize;

    const o2 = slot * 2;
    this.specYawArray[o2] = meta.speciesIndex;
    this.specYawArray[o2 + 1] = yaw;
  }

  commit(): void {
    this.geometry.instanceCount = this.count;
    this.mesh.visible = this.isBaked && this.count > 0;
    if (this.count > 0) {
      this.centerSizeAttr.needsUpdate = true;
      this.specYawAttr.needsUpdate = true;
    }
  }

  updateCameraAndLighting(camYaw: number, daylightFactor: number, tintColor?: THREE.Color): void {
    this.material.uniforms.uCamYaw.value = camYaw;
    const uTint = this.material.uniforms.uTint.value as THREE.Color;
    if (tintColor) {
      uTint.copy(tintColor).multiplyScalar(daylightFactor);
    } else {
      uTint.setRGB(daylightFactor, daylightFactor, daylightFactor);
    }
  }

  getCount(): number {
    return this.count;
  }

  dispose(): void {
    this.clearBakeContext();
    this.geometry.dispose();
    this.material.dispose();
    if (this.renderTarget) {
      this.renderTarget.dispose();
    }
  }
}
