import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BuildingType, SpeciesId } from './types';
import { createBuildingGroup, disposeEntityGroup } from './meshBuilders';

interface MaterialBatchBucket {
  material: THREE.Material;
  castShadow: boolean;
  receiveShadow: boolean;
  mesh: THREE.BatchedMesh;
  maxInstances: number;
  maxVertices: number;
  maxIndices: number;
  usedVertices: number;
  usedIndices: number;
  /** templateKey -> BatchedMesh geometryId */
  templateGeoIds: Map<string, number>;
  /** templateKey -> baked normalized BufferGeometry (retained for 1.5x buffer resize) */
  templateGeos: Map<string, THREE.BufferGeometry>;
  /** buildingId -> { instanceId, templateKey, matrix, visible } */
  instances: Map<
    string,
    {
      instanceId: number;
      templateKey: string;
      matrix: THREE.Matrix4;
      visible: boolean;
    }
  >;
}

interface BakedBuildingTemplate {
  key: string;
  /** One merged geometry per unique (material, castShadow, receiveShadow) bucket */
  staticParts: Array<{
    bucketKey: string;
    material: THREE.Material;
    castShadow: boolean;
    receiveShadow: boolean;
    geometry: THREE.BufferGeometry;
  }>;
  /** Animated parts that stay as lightweight scene meshes (rare: flicker_flame, spin_part) */
  animatedParts: Array<{
    name: string;
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
    castShadow: boolean;
    receiveShadow: boolean;
  }>;
}

export interface BatchedBuildingEntry {
  id: string;
  templateKey: string;
  type: BuildingType;
  epochLevel: number;
  species: SpeciesId;
  isWaterTile: boolean;
  cachedRotY: number;
  lastX: number;
  lastY: number;
  lastZ: number;
  lastScaleY: number;
  visible: boolean;
  seenStamp: number;
  /** Lightweight animated sub-meshes (only allocated if template has flicker_flame/spin_part) */
  animGroup: THREE.Group | null;
  flickerFlames: THREE.Object3D[];
  spinParts: THREE.Object3D[];
}

const ANIMATED_PART_NAMES = new Set(['flicker_flame', 'spin_part']);
let nextMatTag = 1;
const materialIds = new WeakMap<THREE.Material, number>();

function getMaterialTag(mat: THREE.Material): number {
  let id = materialIds.get(mat);
  if (!id) {
    id = nextMatTag++;
    materialIds.set(mat, id);
  }
  return id;
}

function normalizeGeometryForBatch(
  source: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4,
): THREE.BufferGeometry | null {
  const posAttr = source.getAttribute('position');
  if (!posAttr || posAttr.count === 0) return null;

  const nonIdx = source.index ? source.toNonIndexed() : source.clone();
  nonIdx.applyMatrix4(worldMatrix);

  if (!nonIdx.getAttribute('normal')) {
    nonIdx.computeVertexNormals();
  }

  // Keep consistent attribute set (position, normal, optional color/uv matched per bucket)
  const keepAttrs = new Set(['position', 'normal', 'color', 'uv']);
  for (const attrName of Object.keys(nonIdx.attributes)) {
    if (!keepAttrs.has(attrName)) {
      nonIdx.deleteAttribute(attrName);
    }
  }

  return nonIdx;
}

function alignAttributesForMerge(geos: THREE.BufferGeometry[]): void {
  let anyColor = false;
  let anyUv = false;
  for (let i = 0; i < geos.length; i++) {
    if (geos[i].getAttribute('color')) anyColor = true;
    if (geos[i].getAttribute('uv')) anyUv = true;
  }
  for (let i = 0; i < geos.length; i++) {
    const g = geos[i];
    const count = g.getAttribute('position').count;
    if (anyColor && !g.getAttribute('color')) {
      const colors = new Float32Array(count * 3);
      colors.fill(1);
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    if (anyUv && !g.getAttribute('uv')) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
  }
}

/**
 * Lossless `THREE.BatchedMesh` Building Renderer.
 *
 * Bakes each unique `(type, epochLevel, species, variantBucket, isWaterTile)` prototype
 * from `createBuildingGroup` once, then renders ALL static parts across hundreds or thousands
 * of buildings in ~6–12 BatchedMesh draw calls (one per shared Material) while preserving
 * 100% identical voxel geometry, night-window emissive animations, shadows, and per-instance
 * frustum culling!
 */
export class BatchedBuildingSystem {
  readonly group = new THREE.Group();
  private buckets = new Map<string, MaterialBatchBucket>();
  private templates = new Map<string, BakedBuildingTemplate>();
  private entries = new Map<string, BatchedBuildingEntry>();
  private scratchPos = new THREE.Vector3();
  private scratchQuat = new THREE.Quaternion();
  private scratchScale = new THREE.Vector3();
  private scratchEuler = new THREE.Euler();
  private scratchMat = new THREE.Matrix4();

  constructor() {
    this.group.name = 'batched_buildings_root';
  }

  getEntry(id: string): BatchedBuildingEntry | undefined {
    return this.entries.get(id);
  }

  getBuildingCount(): number {
    return this.entries.size;
  }

  getDrawCallBucketCount(): number {
    return this.buckets.size;
  }

  private getOrBakeTemplate(
    type: BuildingType,
    epochLevel: number,
    species: SpeciesId,
    variantSeed: number,
    isWaterTile: boolean,
  ): BakedBuildingTemplate {
    const variantBucket = Math.abs(variantSeed) % 4;
    const key = `${type}|${epochLevel}|${species}|${variantBucket}|${isWaterTile ? 1 : 0}`;
    const existing = this.templates.get(key);
    if (existing) return existing;

    const proto = createBuildingGroup(type, epochLevel, variantBucket, species, isWaterTile);
    proto.updateMatrixWorld(true);

    const staticBuckets = new Map<
      string,
      {
        material: THREE.Material;
        castShadow: boolean;
        receiveShadow: boolean;
        geos: THREE.BufferGeometry[];
      }
    >();
    const animatedParts: BakedBuildingTemplate['animatedParts'] = [];

    proto.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (Array.isArray(obj.material)) return;
      const mat = obj.material;

      if (ANIMATED_PART_NAMES.has(obj.name)) {
        // Compute world transform relative to proto root
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scl = new THREE.Vector3();
        obj.matrixWorld.decompose(pos, quat, scl);
        const rot = new THREE.Euler().setFromQuaternion(quat);
        animatedParts.push({
          name: obj.name,
          geometry: obj.geometry,
          material: mat,
          position: pos,
          rotation: rot,
          scale: scl,
          castShadow: obj.castShadow,
          receiveShadow: obj.receiveShadow,
        });
        return;
      }

      const normGeo = normalizeGeometryForBatch(obj.geometry, obj.matrixWorld);
      if (!normGeo) return;

      const matTag = getMaterialTag(mat);
      const bKey = `${matTag}|${obj.castShadow ? 1 : 0}|${obj.receiveShadow ? 1 : 0}`;
      let b = staticBuckets.get(bKey);
      if (!b) {
        b = {
          material: mat,
          castShadow: obj.castShadow,
          receiveShadow: obj.receiveShadow,
          geos: [],
        };
        staticBuckets.set(bKey, b);
      }
      b.geos.push(normGeo);
    });

    const staticParts: BakedBuildingTemplate['staticParts'] = [];
    for (const [bucketKey, b] of staticBuckets.entries()) {
      alignAttributesForMerge(b.geos);
      const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
      if (b.geos.length > 1) {
        for (let i = 0; i < b.geos.length; i++) b.geos[i].dispose();
      }
      if (merged) {
        staticParts.push({
          bucketKey,
          material: b.material,
          castShadow: b.castShadow,
          receiveShadow: b.receiveShadow,
          geometry: merged,
        });
      }
    }

    // Release temporary prototype group wrapper (shared materials/cached geometries stay protected)
    disposeEntityGroup(proto);

    const baked: BakedBuildingTemplate = { key, staticParts, animatedParts };
    this.templates.set(key, baked);
    return baked;
  }

  private createBucketMesh(
    material: THREE.Material,
    castShadow: boolean,
    receiveShadow: boolean,
    maxInstances: number,
    maxVertices: number,
    maxIndices: number,
  ): THREE.BatchedMesh {
    const mesh = new THREE.BatchedMesh(maxInstances, maxVertices, maxIndices, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.perObjectFrustumCulled = true;
    mesh.sortObjects = false;
    mesh.frustumCulled = false; // Per-instance frustum culling handles individual buildings
    return mesh;
  }

  private getOrCreateBucket(
    bucketKey: string,
    material: THREE.Material,
    castShadow: boolean,
    receiveShadow: boolean,
    minVerts: number,
    minIndices: number,
  ): MaterialBatchBucket {
    let bucket = this.buckets.get(bucketKey);
    if (bucket) return bucket;

    const maxInstances = 256;
    const maxVertices = Math.max(16384, minVerts * 8);
    const maxIndices = Math.max(24576, minIndices * 8);
    const mesh = this.createBucketMesh(
      material,
      castShadow,
      receiveShadow,
      maxInstances,
      maxVertices,
      maxIndices,
    );
    this.group.add(mesh);

    bucket = {
      material,
      castShadow,
      receiveShadow,
      mesh,
      maxInstances,
      maxVertices,
      maxIndices,
      usedVertices: 0,
      usedIndices: 0,
      templateGeoIds: new Map(),
      templateGeos: new Map(),
      instances: new Map(),
    };
    this.buckets.set(bucketKey, bucket);
    return bucket;
  }

  private growBucket(
    bucket: MaterialBatchBucket,
    needInstances: number,
    needVertices: number,
    needIndices: number,
  ): void {
    const nextMaxInst = Math.max(needInstances, Math.ceil(bucket.maxInstances * 1.6));
    const nextMaxVerts = Math.max(needVertices, Math.ceil(bucket.maxVertices * 1.6));
    const nextMaxIdx = Math.max(needIndices, Math.ceil(bucket.maxIndices * 1.6));

    const newMesh = this.createBucketMesh(
      bucket.material,
      bucket.castShadow,
      bucket.receiveShadow,
      nextMaxInst,
      nextMaxVerts,
      nextMaxIdx,
    );

    const newGeoIds = new Map<string, number>();
    let usedV = 0;
    let usedI = 0;

    for (const [tKey, geo] of bucket.templateGeos.entries()) {
      const gid = newMesh.addGeometry(geo);
      newGeoIds.set(tKey, gid);
      usedV += geo.getAttribute('position').count;
      usedI += geo.index ? geo.index.count : geo.getAttribute('position').count;
    }

    for (const [, inst] of bucket.instances.entries()) {
      const gid = newGeoIds.get(inst.templateKey);
      if (gid === undefined) continue;
      const newId = newMesh.addInstance(gid);
      newMesh.setMatrixAt(newId, inst.matrix);
      newMesh.setVisibleAt(newId, inst.visible);
      inst.instanceId = newId;
    }

    this.group.remove(bucket.mesh);
    bucket.mesh.dispose();
    this.group.add(newMesh);

    bucket.mesh = newMesh;
    bucket.maxInstances = nextMaxInst;
    bucket.maxVertices = nextMaxVerts;
    bucket.maxIndices = nextMaxIdx;
    bucket.usedVertices = usedV;
    bucket.usedIndices = usedI;
    bucket.templateGeoIds = newGeoIds;
  }

  private ensureGeometryInBucket(
    bucket: MaterialBatchBucket,
    templateKey: string,
    geometry: THREE.BufferGeometry,
  ): number {
    const existing = bucket.templateGeoIds.get(templateKey);
    if (existing !== undefined) return existing;

    const vCount = geometry.getAttribute('position').count;
    const iCount = geometry.index ? geometry.index.count : vCount;
    if (
      bucket.usedVertices + vCount > bucket.maxVertices ||
      bucket.usedIndices + iCount > bucket.maxIndices
    ) {
      this.growBucket(
        bucket,
        bucket.maxInstances,
        bucket.usedVertices + vCount + 4096,
        bucket.usedIndices + iCount + 6144,
      );
    }

    const gid = bucket.mesh.addGeometry(geometry);
    bucket.templateGeoIds.set(templateKey, gid);
    bucket.templateGeos.set(templateKey, geometry);
    bucket.usedVertices += vCount;
    bucket.usedIndices += iCount;
    return gid;
  }

  private removeBuildingInstances(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    const tpl = this.templates.get(entry.templateKey);
    if (tpl) {
      for (let i = 0; i < tpl.staticParts.length; i++) {
        const bucket = this.buckets.get(tpl.staticParts[i].bucketKey);
        if (!bucket) continue;
        const inst = bucket.instances.get(id);
        if (inst) {
          bucket.mesh.deleteInstance(inst.instanceId);
          bucket.instances.delete(id);
        }
      }
    }
    if (entry.animGroup) {
      this.group.remove(entry.animGroup);
      entry.animGroup = null;
      entry.flickerFlames.length = 0;
      entry.spinParts.length = 0;
    }
    this.entries.delete(id);
  }

  /**
   * Upserts a building instance into the BatchedMesh buckets (and updates its transform & visibility).
   */
  upsertBuilding(
    id: string,
    type: BuildingType,
    epochLevel: number,
    species: SpeciesId,
    variantSeed: number,
    isWaterTile: boolean,
    x: number,
    y: number,
    z: number,
    rotY: number,
    scaleY: number,
    visible: boolean,
    seenStamp: number,
  ): BatchedBuildingEntry {
    const entry = this.entries.get(id);
    const variantBucket = Math.abs(variantSeed) % 4;
    const targetTemplateKey = `${type}|${epochLevel}|${species}|${variantBucket}|${isWaterTile ? 1 : 0}`;

    if (!entry || entry.templateKey !== targetTemplateKey) {
      if (entry) {
        this.removeBuildingInstances(id);
      }

      const tpl = this.getOrBakeTemplate(type, epochLevel, species, variantSeed, isWaterTile);
      this.scratchPos.set(x, y, z);
      this.scratchEuler.set(0, rotY, 0);
      this.scratchQuat.setFromEuler(this.scratchEuler);
      this.scratchScale.set(1, scaleY, 1);
      this.scratchMat.compose(this.scratchPos, this.scratchQuat, this.scratchScale);

      for (let i = 0; i < tpl.staticParts.length; i++) {
        const part = tpl.staticParts[i];
        const vCount = part.geometry.getAttribute('position').count;
        const iCount = part.geometry.index ? part.geometry.index.count : vCount;
        const bucket = this.getOrCreateBucket(
          part.bucketKey,
          part.material,
          part.castShadow,
          part.receiveShadow,
          vCount,
          iCount,
        );
        const gid = this.ensureGeometryInBucket(bucket, tpl.key, part.geometry);

        if (bucket.instances.size + 1 >= bucket.maxInstances) {
          this.growBucket(
            bucket,
            bucket.instances.size + 128,
            bucket.maxVertices,
            bucket.maxIndices,
          );
        }

        const safeGid = bucket.templateGeoIds.get(tpl.key) ?? gid;
        const instId = bucket.mesh.addInstance(safeGid);
        bucket.mesh.setMatrixAt(instId, this.scratchMat);
        bucket.mesh.setVisibleAt(instId, visible);
        bucket.instances.set(id, {
          instanceId: instId,
          templateKey: tpl.key,
          matrix: this.scratchMat.clone(),
          visible,
        });
      }

      let animGroup: THREE.Group | null = null;
      const flickerFlames: THREE.Object3D[] = [];
      const spinParts: THREE.Object3D[] = [];
      if (tpl.animatedParts.length > 0) {
        animGroup = new THREE.Group();
        animGroup.position.set(x, y, z);
        animGroup.rotation.y = rotY;
        animGroup.scale.set(1, scaleY, 1);
        animGroup.visible = visible;
        for (let ai = 0; ai < tpl.animatedParts.length; ai++) {
          const ap = tpl.animatedParts[ai];
          const m = new THREE.Mesh(ap.geometry, ap.material);
          m.name = ap.name;
          m.position.copy(ap.position);
          m.rotation.copy(ap.rotation);
          m.scale.copy(ap.scale);
          m.castShadow = ap.castShadow;
          m.receiveShadow = ap.receiveShadow;
          animGroup.add(m);
          if (ap.name === 'flicker_flame') flickerFlames.push(m);
          else if (ap.name === 'spin_part') spinParts.push(m);
        }
        this.group.add(animGroup);
      }

      const created: BatchedBuildingEntry = {
        id,
        templateKey: tpl.key,
        type,
        epochLevel,
        species,
        isWaterTile,
        cachedRotY: rotY,
        lastX: x,
        lastY: y,
        lastZ: z,
        lastScaleY: scaleY,
        visible,
        seenStamp,
        animGroup,
        flickerFlames,
        spinParts,
      };
      this.entries.set(id, created);
      return created;
    }

    entry.seenStamp = seenStamp;
    const transformChanged =
      entry.lastX !== x ||
      entry.lastY !== y ||
      entry.lastZ !== z ||
      entry.cachedRotY !== rotY ||
      entry.lastScaleY !== scaleY;
    const visChanged = entry.visible !== visible;

    if (transformChanged || visChanged) {
      entry.lastX = x;
      entry.lastY = y;
      entry.lastZ = z;
      entry.cachedRotY = rotY;
      entry.lastScaleY = scaleY;
      entry.visible = visible;

      if (transformChanged) {
        this.scratchPos.set(x, y, z);
        this.scratchEuler.set(0, rotY, 0);
        this.scratchQuat.setFromEuler(this.scratchEuler);
        this.scratchScale.set(1, scaleY, 1);
        this.scratchMat.compose(this.scratchPos, this.scratchQuat, this.scratchScale);
      }

      const tpl = this.templates.get(entry.templateKey);
      if (tpl) {
        for (let i = 0; i < tpl.staticParts.length; i++) {
          const bucket = this.buckets.get(tpl.staticParts[i].bucketKey);
          if (!bucket) continue;
          const inst = bucket.instances.get(id);
          if (!inst) continue;
          if (transformChanged) {
            inst.matrix.copy(this.scratchMat);
            bucket.mesh.setMatrixAt(inst.instanceId, this.scratchMat);
          }
          if (visChanged) {
            inst.visible = visible;
            bucket.mesh.setVisibleAt(inst.instanceId, visible);
          }
        }
      }

      if (entry.animGroup) {
        if (transformChanged) {
          entry.animGroup.position.set(x, y, z);
          entry.animGroup.rotation.y = rotY;
          entry.animGroup.scale.set(1, scaleY, 1);
        }
        if (visChanged) {
          entry.animGroup.visible = visible;
        }
      }
    }

    return entry;
  }

  /**
   * Hides an out-of-view building without destroying its BatchedMesh slot.
   */
  setHidden(id: string, seenStamp: number): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.seenStamp = seenStamp;
    if (!entry.visible) return;
    entry.visible = false;
    const tpl = this.templates.get(entry.templateKey);
    if (tpl) {
      for (let i = 0; i < tpl.staticParts.length; i++) {
        const bucket = this.buckets.get(tpl.staticParts[i].bucketKey);
        const inst = bucket?.instances.get(id);
        if (bucket && inst) {
          inst.visible = false;
          bucket.mesh.setVisibleAt(inst.instanceId, false);
        }
      }
    }
    if (entry.animGroup) entry.animGroup.visible = false;
  }

  /**
   * Prunes any buildings no longer present in `SimulationState.buildings`.
   */
  pruneUnseen(currentStamp: number): void {
    for (const [id, entry] of this.entries.entries()) {
      if (entry.seenStamp !== currentStamp) {
        this.removeBuildingInstances(id);
      }
    }
  }

  dispose(): void {
    for (const bucket of this.buckets.values()) {
      this.group.remove(bucket.mesh);
      bucket.mesh.dispose();
    }
    this.buckets.clear();
    for (const tpl of this.templates.values()) {
      for (let i = 0; i < tpl.staticParts.length; i++) {
        tpl.staticParts[i].geometry.dispose();
      }
    }
    this.templates.clear();
    for (const entry of this.entries.values()) {
      if (entry.animGroup) this.group.remove(entry.animGroup);
    }
    this.entries.clear();
  }
}
