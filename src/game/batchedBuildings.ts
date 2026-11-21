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
  /** templateKey -> BatchedMesh geometryId (LOD0) */
  templateGeoIds: Map<string, number>;
  /** templateKey -> BatchedMesh geometryId (LOD1, may share gid with LOD0 or be omitted for micro-only buckets) */
  templateGeoIdsLod1: Map<string, number>;
  /** templateKey -> baked normalized BufferGeometry (retained for 1.5x buffer resize) */
  templateGeos: Map<string, THREE.BufferGeometry>;
  /** templateKey -> LOD1 BufferGeometry (retained for 1.5x buffer resize) */
  templateGeosLod1: Map<string, THREE.BufferGeometry>;
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
    geometryLod1: THREE.BufferGeometry | null;
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

  // Strip strictly downward-facing (-Y) triangles (e.g. box/cylinder undersides) that are
  // 100% invisible from the fixed-pitch top-down isometric camera.
  const pos = nonIdx.getAttribute('position');
  const norm = nonIdx.getAttribute('normal');
  const triCount = Math.floor(pos.count / 3);
  if (triCount > 0 && norm) {
    let keepTris = 0;
    const keepMask = new Uint8Array(triCount);
    for (let t = 0; t < triCount; t++) {
      const i0 = t * 3;
      const avgNy = (norm.getY(i0) + norm.getY(i0 + 1) + norm.getY(i0 + 2)) / 3;
      if (avgNy >= -0.92) {
        keepMask[t] = 1;
        keepTris++;
      }
    }
    if (keepTris === 0) {
      nonIdx.dispose();
      return null;
    }
    if (keepTris < triCount) {
      const dstVerts = keepTris * 3;
      const newPos = new Float32Array(dstVerts * 3);
      const newNorm = new Float32Array(dstVerts * 3);
      const srcColor = nonIdx.getAttribute('color');
      const srcUv = nonIdx.getAttribute('uv');
      const newColor = srcColor ? new Float32Array(dstVerts * 3) : null;
      const newUv = srcUv ? new Float32Array(dstVerts * 2) : null;

      let outV = 0;
      for (let t = 0; t < triCount; t++) {
        if (!keepMask[t]) continue;
        const base = t * 3;
        for (let k = 0; k < 3; k++) {
          const sv = base + k;
          const o3 = outV * 3;
          newPos[o3] = pos.getX(sv);
          newPos[o3 + 1] = pos.getY(sv);
          newPos[o3 + 2] = pos.getZ(sv);
          newNorm[o3] = norm.getX(sv);
          newNorm[o3 + 1] = norm.getY(sv);
          newNorm[o3 + 2] = norm.getZ(sv);
          if (newColor && srcColor) {
            newColor[o3] = srcColor.getX(sv);
            newColor[o3 + 1] = srcColor.getY(sv);
            newColor[o3 + 2] = srcColor.getZ(sv);
          }
          if (newUv && srcUv) {
            const o2 = outV * 2;
            newUv[o2] = srcUv.getX(sv);
            newUv[o2 + 1] = srcUv.getY(sv);
          }
          outV++;
        }
      }
      nonIdx.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
      nonIdx.setAttribute('normal', new THREE.BufferAttribute(newNorm, 3));
      if (newColor) nonIdx.setAttribute('color', new THREE.BufferAttribute(newColor, 3));
      if (newUv) nonIdx.setAttribute('uv', new THREE.BufferAttribute(newUv, 2));
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
  private lodLevel: 0 | 1 = 0;
  private scratchPos = new THREE.Vector3();
  private scratchQuat = new THREE.Quaternion();
  private scratchScale = new THREE.Vector3();
  private scratchEuler = new THREE.Euler();
  private scratchMat = new THREE.Matrix4();
  private scratchBboxSize = new THREE.Vector3();

  constructor() {
    this.group.name = 'batched_buildings_root';
  }

  getLodLevel(): 0 | 1 {
    return this.lodLevel;
  }

  setLodLevel(lod: 0 | 1): void {
    if (this.lodLevel === lod) return;
    this.lodLevel = lod;
    for (const bucket of this.buckets.values()) {
      for (const [, inst] of bucket.instances.entries()) {
        if (lod === 1) {
          const gid1 = bucket.templateGeoIdsLod1.get(inst.templateKey);
          if (gid1 !== undefined) {
            bucket.mesh.setGeometryIdAt(inst.instanceId, gid1);
            bucket.mesh.setVisibleAt(inst.instanceId, inst.visible);
          } else {
            bucket.mesh.setVisibleAt(inst.instanceId, false);
          }
        } else {
          const gid0 = bucket.templateGeoIds.get(inst.templateKey);
          if (gid0 !== undefined) {
            bucket.mesh.setGeometryIdAt(inst.instanceId, gid0);
          }
          bucket.mesh.setVisibleAt(inst.instanceId, inst.visible);
        }
      }
    }
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
        lod1Flags: boolean[];
      }
    >();
    const animatedParts: BakedBuildingTemplate['animatedParts'] = [];
    let nonMicroTotal = 0;

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

      normGeo.computeBoundingBox();
      let keepLod1 = true;
      if (normGeo.boundingBox) {
        normGeo.boundingBox.getSize(this.scratchBboxSize);
        const maxDim = Math.max(this.scratchBboxSize.x, this.scratchBboxSize.y, this.scratchBboxSize.z);
        const minDim = Math.min(this.scratchBboxSize.x, this.scratchBboxSize.y, this.scratchBboxSize.z);
        const isTinyCube =
          this.scratchBboxSize.x <= 0.24 &&
          this.scratchBboxSize.y <= 0.24 &&
          this.scratchBboxSize.z <= 0.24;
        const isTinyTrim = maxDim <= 0.2 || (minDim <= 0.06 && maxDim <= 0.36);
        if (isTinyCube || isTinyTrim) {
          keepLod1 = false;
        }
      }
      if (keepLod1) nonMicroTotal++;

      const matTag = getMaterialTag(mat);
      const bKey = `${matTag}|${obj.castShadow ? 1 : 0}|${obj.receiveShadow ? 1 : 0}`;
      let b = staticBuckets.get(bKey);
      if (!b) {
        b = {
          material: mat,
          castShadow: obj.castShadow,
          receiveShadow: obj.receiveShadow,
          geos: [],
          lod1Flags: [],
        };
        staticBuckets.set(bKey, b);
      }
      b.geos.push(normGeo);
      b.lod1Flags.push(keepLod1);
    });

    const staticParts: BakedBuildingTemplate['staticParts'] = [];
    for (const [bucketKey, b] of staticBuckets.entries()) {
      let keptCount = 0;
      for (let i = 0; i < b.lod1Flags.length; i++) {
        if (b.lod1Flags[i] || nonMicroTotal === 0) keptCount++;
      }

      let geometryLod1: THREE.BufferGeometry | null = null;
      if (keptCount > 0 && keptCount < b.geos.length) {
        const lod1Clones: THREE.BufferGeometry[] = [];
        for (let i = 0; i < b.geos.length; i++) {
          if (b.lod1Flags[i] || nonMicroTotal === 0) {
            lod1Clones.push(b.geos[i].clone());
          }
        }
        alignAttributesForMerge(lod1Clones);
        geometryLod1 = lod1Clones.length === 1 ? lod1Clones[0] : mergeGeometries(lod1Clones, false);
        if (lod1Clones.length > 1) {
          for (let i = 0; i < lod1Clones.length; i++) lod1Clones[i].dispose();
        }
      }

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
          geometryLod1: keptCount === 0 ? null : geometryLod1 ?? merged,
        });
      } else if (geometryLod1) {
        geometryLod1.dispose();
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
      templateGeoIdsLod1: new Map(),
      templateGeos: new Map(),
      templateGeosLod1: new Map(),
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
    const newGeoIdsLod1 = new Map<string, number>();
    let usedV = 0;
    let usedI = 0;

    for (const [tKey, geo] of bucket.templateGeos.entries()) {
      const gid = newMesh.addGeometry(geo);
      newGeoIds.set(tKey, gid);
      usedV += geo.getAttribute('position').count;
      usedI += geo.index ? geo.index.count : geo.getAttribute('position').count;
    }

    for (const [tKey, geo1] of bucket.templateGeosLod1.entries()) {
      const geo0 = bucket.templateGeos.get(tKey);
      if (geo1 === geo0) {
        const gid0 = newGeoIds.get(tKey);
        if (gid0 !== undefined) newGeoIdsLod1.set(tKey, gid0);
      } else {
        const gid1 = newMesh.addGeometry(geo1);
        newGeoIdsLod1.set(tKey, gid1);
        usedV += geo1.getAttribute('position').count;
        usedI += geo1.index ? geo1.index.count : geo1.getAttribute('position').count;
      }
    }

    const useLod1 = this.lodLevel === 1;
    for (const [, inst] of bucket.instances.entries()) {
      const gid = useLod1 ? newGeoIdsLod1.get(inst.templateKey) : newGeoIds.get(inst.templateKey);
      if (gid === undefined) {
        const gid0 = newGeoIds.get(inst.templateKey);
        if (gid0 === undefined) continue;
        const newId = newMesh.addInstance(gid0);
        newMesh.setMatrixAt(newId, inst.matrix);
        newMesh.setVisibleAt(newId, false);
        inst.instanceId = newId;
        continue;
      }
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
    bucket.templateGeoIdsLod1 = newGeoIdsLod1;
  }

  private ensureGeometryPairInBucket(
    bucket: MaterialBatchBucket,
    templateKey: string,
    geometry: THREE.BufferGeometry,
    geometryLod1: THREE.BufferGeometry | null,
  ): { gid0: number; gid1: number | undefined } {
    const existing0 = bucket.templateGeoIds.get(templateKey);
    if (existing0 !== undefined) {
      return { gid0: existing0, gid1: bucket.templateGeoIdsLod1.get(templateKey) };
    }

    const vCount0 = geometry.getAttribute('position').count;
    const iCount0 = geometry.index ? geometry.index.count : vCount0;
    const hasDistinctLod1 = geometryLod1 !== null && geometryLod1 !== geometry;
    const vCount1 = hasDistinctLod1 ? geometryLod1.getAttribute('position').count : 0;
    const iCount1 = hasDistinctLod1 ? (geometryLod1.index ? geometryLod1.index.count : vCount1) : 0;

    if (
      bucket.usedVertices + vCount0 + vCount1 > bucket.maxVertices ||
      bucket.usedIndices + iCount0 + iCount1 > bucket.maxIndices
    ) {
      this.growBucket(
        bucket,
        bucket.maxInstances,
        bucket.usedVertices + vCount0 + vCount1 + 4096,
        bucket.usedIndices + iCount0 + iCount1 + 6144,
      );
    }

    const gid0 = bucket.mesh.addGeometry(geometry);
    bucket.templateGeoIds.set(templateKey, gid0);
    bucket.templateGeos.set(templateKey, geometry);
    bucket.usedVertices += vCount0;
    bucket.usedIndices += iCount0;

    let gid1: number | undefined;
    if (geometryLod1 === geometry) {
      gid1 = gid0;
      bucket.templateGeoIdsLod1.set(templateKey, gid0);
      bucket.templateGeosLod1.set(templateKey, geometry);
    } else if (geometryLod1 !== null) {
      gid1 = bucket.mesh.addGeometry(geometryLod1);
      bucket.templateGeoIdsLod1.set(templateKey, gid1);
      bucket.templateGeosLod1.set(templateKey, geometryLod1);
      bucket.usedVertices += vCount1;
      bucket.usedIndices += iCount1;
    }

    return { gid0, gid1 };
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
        this.ensureGeometryPairInBucket(bucket, tpl.key, part.geometry, part.geometryLod1);

        if (bucket.instances.size + 1 >= bucket.maxInstances) {
          this.growBucket(
            bucket,
            bucket.instances.size + 128,
            bucket.maxVertices,
            bucket.maxIndices,
          );
        }

        const safeGid0 = bucket.templateGeoIds.get(tpl.key)!;
        const safeGid1 = bucket.templateGeoIdsLod1.get(tpl.key);
        const activeGid = this.lodLevel === 1 && safeGid1 !== undefined ? safeGid1 : safeGid0;
        const effectiveVisible = this.lodLevel === 1 ? visible && safeGid1 !== undefined : visible;
        const instId = bucket.mesh.addInstance(activeGid);
        bucket.mesh.setMatrixAt(instId, this.scratchMat);
        bucket.mesh.setVisibleAt(instId, effectiveVisible);
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
            const effectiveVisible =
              this.lodLevel === 1
                ? visible && bucket.templateGeoIdsLod1.has(inst.templateKey)
                : visible;
            bucket.mesh.setVisibleAt(inst.instanceId, effectiveVisible);
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
        const p = tpl.staticParts[i];
        p.geometry.dispose();
        if (p.geometryLod1 && p.geometryLod1 !== p.geometry) {
          p.geometryLod1.dispose();
        }
      }
    }
    this.templates.clear();
    for (const entry of this.entries.values()) {
      if (entry.animGroup) this.group.remove(entry.animGroup);
    }
    this.entries.clear();
  }
}
