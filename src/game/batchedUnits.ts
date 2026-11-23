import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getDinosaurVariant } from './catalog';
import { createUnitGroup, disposeEntityGroup } from './meshBuilders';
import { SpeciesId, UnitAgeStage, UnitEntity, UnitRole } from './types';

export type BatchedUnitPoseVariant = 'default' | 'submerged' | 'disguised' | 'petrified';

const ALWAYS_SKIP_NAMES = new Set([
  'contact_shadow',
  'status_ring',
  'carry_box',
  'held_tool',
  'battlewill_avatar',
  'leviathan_beam_group',
  'beam_muzzle',
  'beam_shaft',
  'beam_impact',
  'leviathan_splash_inner',
  'leviathan_splash_outer',
]);

function isUnderSkippedSubtree(
  obj: THREE.Object3D,
  root: THREE.Object3D,
  skipBranchNames: ReadonlySet<string>,
): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur && cur !== root) {
    if (cur.name && (ALWAYS_SKIP_NAMES.has(cur.name) || skipBranchNames.has(cur.name))) {
      return true;
    }
    cur = cur.parent;
  }
  return false;
}

function normalizeUnitSubmeshForBatch(
  source: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4,
  mat: THREE.Material,
  tintEmissive: boolean,
): THREE.BufferGeometry | null {
  const posAttr = source.getAttribute('position');
  if (!posAttr || posAttr.count === 0) return null;

  const nonIdx = source.index ? source.toNonIndexed() : source.clone();
  nonIdx.applyMatrix4(worldMatrix);

  const det = worldMatrix.determinant();
  if (det < 0) {
    // Flip triangle winding for mirrored submeshes (scale.x = -1, etc.) so FrontSide doesn't cull them
    const pArr = nonIdx.getAttribute('position');
    const nArr = nonIdx.getAttribute('normal');
    const cArr = nonIdx.getAttribute('color');
    const triN = Math.floor(pArr.count / 3);
    for (let t = 0; t < triN; t++) {
      const i1 = t * 3 + 1;
      const i2 = t * 3 + 2;
      const px = pArr.getX(i1);
      const py = pArr.getY(i1);
      const pz = pArr.getZ(i1);
      pArr.setXYZ(i1, pArr.getX(i2), pArr.getY(i2), pArr.getZ(i2));
      pArr.setXYZ(i2, px, py, pz);
      if (nArr) {
        const nx = nArr.getX(i1);
        const ny = nArr.getY(i1);
        const nz = nArr.getZ(i1);
        nArr.setXYZ(i1, nArr.getX(i2), nArr.getY(i2), nArr.getZ(i2));
        nArr.setXYZ(i2, nx, ny, nz);
      }
      if (cArr) {
        const cx = cArr.getX(i1);
        const cy = cArr.getY(i1);
        const cz = cArr.getZ(i1);
        cArr.setXYZ(i1, cArr.getX(i2), cArr.getY(i2), cArr.getZ(i2));
        cArr.setXYZ(i2, cx, cy, cz);
      }
    }
    pArr.needsUpdate = true;
    if (nArr) nArr.needsUpdate = true;
    if (cArr) cArr.needsUpdate = true;
  }

  if (!nonIdx.getAttribute('normal')) {
    nonIdx.computeVertexNormals();
  }

  const pos = nonIdx.getAttribute('position');
  const norm = nonIdx.getAttribute('normal');
  const vCount = pos.count;

  // Bake material color (+ emissive boost for unlit glow bucket) directly into per-vertex colors
  const stdMat = mat as THREE.MeshStandardMaterial;
  const baseCol = stdMat.color ?? new THREE.Color(0xffffff);
  let rCol = baseCol.r;
  let gCol = baseCol.g;
  let bCol = baseCol.b;
  if (tintEmissive && stdMat.emissive) {
    const ei = Math.min(1.0, Math.max(0.2, stdMat.emissiveIntensity ?? 1) * 0.65);
    rCol = Math.min(1, rCol * 0.45 + stdMat.emissive.r * (0.55 + ei * 0.45));
    gCol = Math.min(1, gCol * 0.45 + stdMat.emissive.g * (0.55 + ei * 0.45));
    bCol = Math.min(1, bCol * 0.45 + stdMat.emissive.b * (0.55 + ei * 0.45));
  }

  const srcColor = nonIdx.getAttribute('color');
  const bakedColors = new Float32Array(vCount * 3);
  if (srcColor) {
    for (let i = 0; i < vCount; i++) {
      bakedColors[i * 3] = Math.min(1, srcColor.getX(i) * rCol);
      bakedColors[i * 3 + 1] = Math.min(1, srcColor.getY(i) * gCol);
      bakedColors[i * 3 + 2] = Math.min(1, srcColor.getZ(i) * bCol);
    }
  } else {
    for (let i = 0; i < vCount; i++) {
      bakedColors[i * 3] = rCol;
      bakedColors[i * 3 + 1] = gCol;
      bakedColors[i * 3 + 2] = bCol;
    }
  }
  nonIdx.setAttribute('color', new THREE.BufferAttribute(bakedColors, 3));

  for (const attrName of Object.keys(nonIdx.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'color') {
      nonIdx.deleteAttribute(attrName);
    }
  }

  const triCount = Math.floor(vCount / 3);
  const isDoubleSided = mat.side === THREE.DoubleSide;

  if (isDoubleSided && triCount > 0 && norm) {
    // Emit both front and back faces for DoubleSide thin wings/membranes/fins so they never vanish in FrontSide BatchedMesh
    const dstVerts = triCount * 6;
    const newPos = new Float32Array(dstVerts * 3);
    const newNorm = new Float32Array(dstVerts * 3);
    const newCol = new Float32Array(dstVerts * 3);
    let outV = 0;
    for (let t = 0; t < triCount; t++) {
      const base = t * 3;
      // Front face (0, 1, 2)
      for (let k = 0; k < 3; k++) {
        const sv = base + k;
        const o3 = outV * 3;
        newPos[o3] = pos.getX(sv);
        newPos[o3 + 1] = pos.getY(sv);
        newPos[o3 + 2] = pos.getZ(sv);
        newNorm[o3] = norm.getX(sv);
        newNorm[o3 + 1] = norm.getY(sv);
        newNorm[o3 + 2] = norm.getZ(sv);
        newCol[o3] = bakedColors[sv * 3];
        newCol[o3 + 1] = bakedColors[sv * 3 + 1];
        newCol[o3 + 2] = bakedColors[sv * 3 + 2];
        outV++;
      }
      // Back face (0, 2, 1) with inverted normal
      for (const k of [0, 2, 1]) {
        const sv = base + k;
        const o3 = outV * 3;
        newPos[o3] = pos.getX(sv);
        newPos[o3 + 1] = pos.getY(sv);
        newPos[o3 + 2] = pos.getZ(sv);
        newNorm[o3] = -norm.getX(sv);
        newNorm[o3 + 1] = -norm.getY(sv);
        newNorm[o3 + 2] = -norm.getZ(sv);
        newCol[o3] = bakedColors[sv * 3];
        newCol[o3 + 1] = bakedColors[sv * 3 + 1];
        newCol[o3 + 2] = bakedColors[sv * 3 + 2];
        outV++;
      }
    }
    nonIdx.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
    nonIdx.setAttribute('normal', new THREE.BufferAttribute(newNorm, 3));
    nonIdx.setAttribute('color', new THREE.BufferAttribute(newCol, 3));
    return nonIdx;
  }

  // Strip strictly downward-facing (-Y) triangles occluded beneath solid opaque unit limbs/bodies
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
      const newCol = new Float32Array(dstVerts * 3);
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
          newCol[o3] = bakedColors[sv * 3];
          newCol[o3 + 1] = bakedColors[sv * 3 + 1];
          newCol[o3 + 2] = bakedColors[sv * 3 + 2];
          outV++;
        }
      }
      nonIdx.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
      nonIdx.setAttribute('normal', new THREE.BufferAttribute(newNorm, 3));
      nonIdx.setAttribute('color', new THREE.BufferAttribute(newCol, 3));
    }
  }

  return nonIdx;
}

class DynamicUnitBatchBucket {
  readonly group = new THREE.Group();
  mesh: THREE.BatchedMesh;

  private readonly material: THREE.Material;
  private readonly receiveShadow: boolean;
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly geoIds: number[] = [];

  private maxInstances: number;
  private maxGeometries: number;
  private maxVertices: number;
  private usedVertices = 0;
  private allocatedInstances = 0;
  private count = 0;
  private prevCount = 0;

  private readonly scratchMat = new THREE.Matrix4();

  constructor(
    name: string,
    material: THREE.Material,
    receiveShadow: boolean,
    initialMaxInstances = 512,
    initialMaxGeos = 256,
    initialMaxVertices = 65536,
  ) {
    this.group.name = name;
    this.material = material;
    this.receiveShadow = receiveShadow;
    this.maxInstances = initialMaxInstances;
    this.maxGeometries = initialMaxGeos;
    this.maxVertices = initialMaxVertices;
    this.mesh = this.createMesh(this.maxInstances, this.maxVertices);
    this.group.add(this.mesh);
  }

  private createMesh(maxInst: number, maxVerts: number): THREE.BatchedMesh {
    const m = new THREE.BatchedMesh(maxInst, maxVerts, maxVerts, this.material);
    m.castShadow = false;
    m.receiveShadow = this.receiveShadow;
    m.perObjectFrustumCulled = false;
    m.sortObjects = false;
    m.frustumCulled = false;
    m.visible = false;
    this.geoIds.length = 0;
    for (let i = 0; i < this.geos.length; i++) {
      this.geoIds.push(m.addGeometry(this.geos[i]));
    }
    return m;
  }

  private rebuildMesh(nextMaxInst: number, nextMaxVerts: number): void {
    const oldMesh = this.mesh;
    const copyCount = this.count;
    const savedMats = new Float32Array(copyCount * 16);
    const savedGids = new Int32Array(copyCount);
    for (let i = 0; i < copyCount; i++) {
      oldMesh.getMatrixAt(i, this.scratchMat);
      savedMats.set(this.scratchMat.elements, i * 16);
      savedGids[i] = oldMesh.getGeometryIdAt(i);
    }

    this.group.remove(oldMesh);
    oldMesh.dispose();

    this.maxInstances = nextMaxInst;
    this.maxVertices = nextMaxVerts;
    this.mesh = this.createMesh(nextMaxInst, nextMaxVerts);
    this.group.add(this.mesh);
    this.allocatedInstances = 0;

    for (let i = 0; i < copyCount; i++) {
      const id = this.mesh.addInstance(savedGids[i]);
      const off = i * 16;
      const el = this.scratchMat.elements;
      for (let m = 0; m < 16; m++) el[m] = savedMats[off + m];
      this.mesh.setMatrixAt(id, this.scratchMat);
      this.allocatedInstances++;
    }
    this.prevCount = copyCount;
  }

  addGeometry(geo: THREE.BufferGeometry): number {
    const vCount = geo.getAttribute('position')?.count ?? 0;
    if (
      this.usedVertices + vCount > this.maxVertices ||
      this.geos.length >= this.maxGeometries
    ) {
      const nextVerts = Math.max(
        this.usedVertices + vCount + 4096,
        Math.ceil(this.maxVertices * 1.6),
      );
      if (this.geos.length >= this.maxGeometries) {
        this.maxGeometries = Math.ceil(this.maxGeometries * 1.6);
      }
      this.rebuildMesh(this.maxInstances, nextVerts);
    }
    const idx = this.geos.length;
    this.geos.push(geo);
    this.usedVertices += vCount;
    const gid = this.mesh.addGeometry(geo);
    this.geoIds.push(gid);
    return idx;
  }

  beginFrame(): void {
    this.count = 0;
  }

  pushInstance(geoIdx: number, matrix: THREE.Matrix4): void {
    const gid = this.geoIds[geoIdx];
    if (gid === undefined) return;
    const slot = this.count;
    if (slot >= this.maxInstances) {
      this.rebuildMesh(Math.ceil(this.maxInstances * 1.6), this.maxVertices);
    }
    this.count = slot + 1;
    if (slot >= this.allocatedInstances) {
      const id = this.mesh.addInstance(gid);
      this.mesh.setMatrixAt(id, matrix);
      this.allocatedInstances++;
    } else {
      this.mesh.setGeometryIdAt(slot, gid);
      this.mesh.setMatrixAt(slot, matrix);
      this.mesh.setVisibleAt(slot, true);
    }
  }

  commit(): void {
    for (let i = this.count; i < this.prevCount; i++) {
      this.mesh.setVisibleAt(i, false);
    }
    this.prevCount = this.count;
    this.mesh.visible = this.count > 0;
  }

  getActiveCount(): number {
    return this.count;
  }

  dispose(): void {
    this.group.remove(this.mesh);
    this.mesh.dispose();
    for (let i = 0; i < this.geos.length; i++) {
      this.geos[i].dispose();
    }
    this.geos.length = 0;
    this.geoIds.length = 0;
  }
}

interface BakedUnitTemplate {
  stdGeoIdx: number; // -1 if none
  glowGeoIdx: number; // -1 if none
  contactShadowScale: number;
}

export function getBatchedUnitPose(u: Pick<UnitEntity, 'role' | 'leviathanSubmerged' | 'treantDisguised' | 'gargoylePetrified' | 'state' | 'draggedByPlayer'>): BatchedUnitPoseVariant {
  if (u.role === 'leviathan' && u.leviathanSubmerged) return 'submerged';
  if (u.role === 'ent' && u.treantDisguised && u.state !== 'ko' && !u.draggedByPlayer) return 'disguised';
  if (u.role === 'gargoyle' && u.gargoylePetrified && u.state !== 'ko' && !u.draggedByPlayer) return 'petrified';
  return 'default';
}

export function getBatchedUnitTemplateKey(
  role: UnitRole,
  faction: 'civilization' | 'hostile' | 'wildlife',
  epochLevel: number,
  species: SpeciesId,
  ageStage: UnitAgeStage,
  appearanceSeed: number,
  pose: BatchedUnitPoseVariant,
): string {
  const seed = Math.abs(Math.floor(appearanceSeed) || 1);
  const varBucket =
    role === 'dinosaur'
      ? `${getDinosaurVariant(seed).morph}_${seed % 2}`
      : faction === 'civilization'
        ? `${seed % 6}`
        : `${seed % 3}`;
  return `${role}|${faction}|${epochLevel}|${species}|${ageStage}|${varBucket}|${pose}`;
}

/**
 * Collapses zoomed-out & dense-crowd units/wildlife into at most **2** `THREE.BatchedMesh`
 * draw calls (`std` vertex-colored PBR + `glow` unlit emissive accents), while retaining
 * per-species silhouettes, dinosaur morphs, coat variations, walking bob, yaw & KO tilt.
 */
export class BatchedUnitSystem {
  readonly group = new THREE.Group();

  private readonly stdMat: THREE.MeshStandardMaterial;
  private readonly glowMat: THREE.MeshBasicMaterial;
  private readonly stdBucket: DynamicUnitBatchBucket;
  private readonly glowBucket: DynamicUnitBatchBucket;

  private readonly templates = new Map<string, BakedUnitTemplate>();
  private readonly unitPositions = new Map<string, { x: number; y: number; z: number }>();

  private readonly posVec = new THREE.Vector3();
  private readonly euler = new THREE.Euler();
  private readonly quat = new THREE.Quaternion();
  private readonly scaleVec = new THREE.Vector3(1, 1, 1);
  private readonly mat4 = new THREE.Matrix4();

  constructor() {
    this.group.name = 'batched_units_root';
    this.stdMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.68,
      metalness: 0.1,
    });
    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
    });
    this.stdBucket = new DynamicUnitBatchBucket(
      'batched_units_std',
      this.stdMat,
      true,
      512,
      256,
      81920,
    );
    this.glowBucket = new DynamicUnitBatchBucket(
      'batched_units_glow',
      this.glowMat,
      false,
      256,
      192,
      20480,
    );
    this.group.add(this.stdBucket.group, this.glowBucket.group);
  }

  private getOrBakeTemplate(
    role: UnitRole,
    faction: 'civilization' | 'hostile' | 'wildlife',
    epochLevel: number,
    species: SpeciesId,
    ageStage: UnitAgeStage,
    appearanceSeed: number,
    pose: BatchedUnitPoseVariant,
  ): BakedUnitTemplate {
    const key = getBatchedUnitTemplateKey(
      role,
      faction,
      epochLevel,
      species,
      ageStage,
      appearanceSeed,
      pose,
    );
    const cached = this.templates.get(key);
    if (cached) return cached;

    const proto = createUnitGroup(
      role,
      faction,
      epochLevel,
      species,
      appearanceSeed,
      ageStage,
    );
    proto.updateMatrixWorld(true);

    const csObj = proto.getObjectByName('contact_shadow');
    const contactShadowScale = csObj ? csObj.scale.x : 0;

    const skipBranches = new Set<string>();
    if (role === 'leviathan') {
      skipBranches.add(pose === 'submerged' ? 'leviathan_surfaced' : 'leviathan_silhouette');
    } else if (role === 'ent') {
      skipBranches.add(pose === 'disguised' ? 'treant_awakened' : 'treant_disguised');
    } else if (role === 'gargoyle') {
      skipBranches.add(pose === 'petrified' ? 'gargoyle_awakened' : 'gargoyle_statue');
    }

    const stdParts: THREE.BufferGeometry[] = [];
    const glowParts: THREE.BufferGeometry[] = [];

    proto.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (Array.isArray(obj.material)) return;
      if (isUnderSkippedSubtree(obj, proto, skipBranches)) return;
      const mat = obj.material;
      if ((mat as THREE.Material & { transparent?: boolean }).transparent && (mat as THREE.Material & { opacity?: number }).opacity !== undefined && ((mat as THREE.Material & { opacity?: number }).opacity ?? 1) < 0.25) {
        return;
      }

      const stdMat = mat as THREE.MeshStandardMaterial;
      const isGlow =
        mat instanceof THREE.MeshBasicMaterial ||
        (Boolean(stdMat.emissive) &&
          stdMat.emissive.getHex() !== 0 &&
          (stdMat.emissiveIntensity ?? 0) > 0.12);

      const baked = normalizeUnitSubmeshForBatch(obj.geometry, obj.matrixWorld, mat, isGlow);
      if (!baked) return;
      if (isGlow) {
        glowParts.push(baked);
      } else {
        stdParts.push(baked);
      }
    });

    let stdGeoIdx = -1;
    if (stdParts.length > 0) {
      const mergedStd = stdParts.length === 1 ? stdParts[0] : mergeGeometries(stdParts, false);
      if (stdParts.length > 1) {
        for (let i = 0; i < stdParts.length; i++) stdParts[i].dispose();
      }
      if (mergedStd) {
        stdGeoIdx = this.stdBucket.addGeometry(mergedStd);
      }
    }

    let glowGeoIdx = -1;
    if (glowParts.length > 0) {
      const mergedGlow = glowParts.length === 1 ? glowParts[0] : mergeGeometries(glowParts, false);
      if (glowParts.length > 1) {
        for (let i = 0; i < glowParts.length; i++) glowParts[i].dispose();
      }
      if (mergedGlow) {
        glowGeoIdx = this.glowBucket.addGeometry(mergedGlow);
      }
    }

    disposeEntityGroup(proto);

    const tpl: BakedUnitTemplate = {
      stdGeoIdx,
      glowGeoIdx,
      contactShadowScale,
    };
    this.templates.set(key, tpl);
    return tpl;
  }

  hasCachedTemplate(
    role: UnitRole,
    faction: 'civilization' | 'hostile' | 'wildlife',
    epochLevel: number,
    species: SpeciesId,
    ageStage: UnitAgeStage,
    appearanceSeed: number,
    pose: BatchedUnitPoseVariant,
  ): boolean {
    const key = getBatchedUnitTemplateKey(
      role,
      faction,
      epochLevel,
      species,
      ageStage,
      appearanceSeed,
      pose,
    );
    return this.templates.has(key);
  }

  private frameBakeBudget = 0;
  private frameBakedCount = 0;

  beginFrame(maxNewTemplates = 0): void {
    this.stdBucket.beginFrame();
    this.glowBucket.beginFrame();
    this.unitPositions.clear();
    this.frameBakeBudget = maxNewTemplates;
    this.frameBakedCount = 0;
  }

  pushUnit(
    unit: UnitEntity,
    epochLevel: number,
    species: SpeciesId,
    ageStage: UnitAgeStage,
    appearanceSeed: number,
    wx: number,
    wy: number,
    wz: number,
    yaw: number,
    koTiltZ: number,
    scale = 1.0,
  ): number {
    const pose = getBatchedUnitPose(unit);
    if (this.frameBakeBudget > 0) {
      const key = getBatchedUnitTemplateKey(
        unit.role,
        unit.faction,
        epochLevel,
        species,
        ageStage,
        appearanceSeed,
        pose,
      );
      if (!this.templates.has(key)) {
        if (this.frameBakedCount >= this.frameBakeBudget) {
          return 0;
        }
        this.frameBakedCount++;
      }
    }
    const tpl = this.getOrBakeTemplate(
      unit.role,
      unit.faction,
      epochLevel,
      species,
      ageStage,
      appearanceSeed,
      pose,
    );

    this.posVec.set(wx, wy, wz);
    this.euler.set(0, yaw, koTiltZ, 'YXZ');
    this.quat.setFromEuler(this.euler);
    this.scaleVec.setScalar(scale);
    this.mat4.compose(this.posVec, this.quat, this.scaleVec);

    if (tpl.stdGeoIdx >= 0) {
      this.stdBucket.pushInstance(tpl.stdGeoIdx, this.mat4);
    }
    if (tpl.glowGeoIdx >= 0) {
      this.glowBucket.pushInstance(tpl.glowGeoIdx, this.mat4);
    }
    this.unitPositions.set(unit.id, { x: wx, y: wy, z: wz });
    return tpl.contactShadowScale;
  }

  commit(): void {
    this.stdBucket.commit();
    this.glowBucket.commit();
  }

  getUnitPosition(unitId: string, out: THREE.Vector3): boolean {
    const p = this.unitPositions.get(unitId);
    if (!p) return false;
    out.set(p.x, p.y, p.z);
    return true;
  }

  getActiveDrawCallCount(): number {
    return (
      (this.stdBucket.getActiveCount() > 0 ? 1 : 0) +
      (this.glowBucket.getActiveCount() > 0 ? 1 : 0)
    );
  }

  getTemplateCount(): number {
    return this.templates.size;
  }

  dispose(): void {
    this.stdBucket.dispose();
    this.glowBucket.dispose();
    this.stdMat.dispose();
    this.glowMat.dispose();
    this.templates.clear();
    this.unitPositions.clear();
  }
}
