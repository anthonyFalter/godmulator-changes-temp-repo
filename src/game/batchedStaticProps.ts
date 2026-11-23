import * as THREE from 'three';

function stripDownwardBottomTriangles(g: THREE.BufferGeometry): void {
  const posAttr = g.getAttribute('position') as THREE.BufferAttribute | undefined;
  const normAttr = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const colAttr = g.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!posAttr || !normAttr) return;

  const nArr = normAttr.array as Float32Array;
  const idxAttr = g.index;
  if (idxAttr) {
    const idxArr = idxAttr.array;
    const triCount = Math.floor(idxAttr.count / 3);
    let kept = 0;
    for (let t = 0; t < triCount; t++) {
      const o = t * 3;
      const a = idxArr[o];
      const b = idxArr[o + 1];
      const c = idxArr[o + 2];
      if (nArr[a * 3 + 1] < -0.95 && nArr[b * 3 + 1] < -0.95 && nArr[c * 3 + 1] < -0.95) {
        continue;
      }
      kept++;
    }
    if (kept === triCount) return;

    const nextIdx =
      posAttr.count > 65535 ? new Uint32Array(kept * 3) : new Uint16Array(kept * 3);
    let w = 0;
    for (let t = 0; t < triCount; t++) {
      const o = t * 3;
      const a = idxArr[o];
      const b = idxArr[o + 1];
      const c = idxArr[o + 2];
      if (nArr[a * 3 + 1] < -0.95 && nArr[b * 3 + 1] < -0.95 && nArr[c * 3 + 1] < -0.95) {
        continue;
      }
      nextIdx[w++] = a;
      nextIdx[w++] = b;
      nextIdx[w++] = c;
    }
    g.setIndex(new THREE.BufferAttribute(nextIdx, 1));
    return;
  }

  const pArr = posAttr.array as Float32Array;
  const cArr = colAttr ? (colAttr.array as Float32Array) : null;
  const triCount = Math.floor(posAttr.count / 3);
  let kept = 0;
  for (let t = 0; t < triCount; t++) {
    const base = t * 9;
    if (nArr[base + 1] < -0.95 && nArr[base + 4] < -0.95 && nArr[base + 7] < -0.95) {
      continue;
    }
    kept++;
  }
  if (kept === triCount) return;

  const nextPos = new Float32Array(kept * 9);
  const nextNorm = new Float32Array(kept * 9);
  const nextCol = cArr ? new Float32Array(kept * 9) : null;
  let w = 0;
  for (let t = 0; t < triCount; t++) {
    const base = t * 9;
    if (nArr[base + 1] < -0.95 && nArr[base + 4] < -0.95 && nArr[base + 7] < -0.95) {
      continue;
    }
    nextPos.set(pArr.subarray(base, base + 9), w);
    nextNorm.set(nArr.subarray(base, base + 9), w);
    if (nextCol && cArr) nextCol.set(cArr.subarray(base, base + 9), w);
    w += 9;
  }
  g.setAttribute('position', new THREE.BufferAttribute(nextPos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nextNorm, 3));
  if (nextCol) g.setAttribute('color', new THREE.BufferAttribute(nextCol, 3));
}

function normalizeForStaticBatch(
  source: THREE.BufferGeometry,
  wantIndexed: boolean,
  stripBottomFaces: boolean,
): THREE.BufferGeometry {
  const g = source.index ? (wantIndexed ? source.clone() : source.toNonIndexed()) : source.clone();
  if (!g.getAttribute('normal')) {
    g.computeVertexNormals();
  }
  const count = g.getAttribute('position')?.count ?? 0;
  if (!g.getAttribute('color') && count > 0) {
    const colors = new Float32Array(count * 3);
    colors.fill(1);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  // Remove unused attributes so every geometry in the BatchedMesh has an identical attribute layout
  for (const attrName of Object.keys(g.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'color') {
      g.deleteAttribute(attrName);
    }
  }
  if (stripBottomFaces && count > 0) {
    stripDownwardBottomTriangles(g);
  }
  const postCount = g.getAttribute('position')?.count ?? 0;
  if (wantIndexed && !g.index && postCount > 0) {
    const idx = postCount > 65535 ? new Uint32Array(postCount) : new Uint16Array(postCount);
    for (let i = 0; i < postCount; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return g;
}

/**
 * Collapses dozens of static `InstancedMesh` variants (e.g. 32 voxel tree species × 4 LODs,
 * or 60+ resource/ambient prop variants sharing one Material) into a SINGLE `THREE.BatchedMesh`
 * draw call with zero per-frame heap allocations and dynamic capacity growth.
 */
export class BatchedStaticPool {
  readonly group = new THREE.Group();
  mesh: THREE.BatchedMesh;

  private readonly material: THREE.Material;
  private readonly castShadow: boolean;
  private readonly receiveShadow: boolean;
  private readonly normalizedGeos: THREE.BufferGeometry[];
  private readonly totalVerts: number;
  private readonly totalIndices: number;

  private geoIds: number[] = [];
  private maxInstances: number;
  private allocatedInstances = 0;
  private count = 0;
  private prevCount = 0;
  private readonly scratchMat = new THREE.Matrix4();
  private readonly scratchColor = new THREE.Color();
  private hasColors = false;

  constructor(
    name: string,
    material: THREE.Material,
    geometries: THREE.BufferGeometry[],
    castShadow: boolean,
    receiveShadow: boolean,
    initialMaxInstances = 512,
  ) {
    this.group.name = name;
    this.material = material;
    this.castShadow = castShadow;
    this.receiveShadow = receiveShadow;
    this.maxInstances = Math.max(64, initialMaxInstances);

    // Strip invisible occluded -Y bottom caps only on opaque FrontSide grounded materials
    const stripBottomFaces =
      !material.transparent &&
      (material.side === THREE.FrontSide || material.side === undefined);
    // Use indexed layout if all source geometries are indexed (e.g. voxelTrees), else non-indexed
    const allIndexed = geometries.length > 0 && geometries.every((g) => g.index !== null);
    this.normalizedGeos = geometries.map((g) =>
      normalizeForStaticBatch(g, allIndexed, stripBottomFaces),
    );

    let verts = 0;
    let indices = 0;
    for (let i = 0; i < this.normalizedGeos.length; i++) {
      const g = this.normalizedGeos[i];
      const v = g.getAttribute('position')?.count ?? 0;
      verts += v;
      indices += g.index ? g.index.count : v;
    }
    this.totalVerts = Math.max(64, verts);
    this.totalIndices = Math.max(64, indices);

    this.mesh = this.createMesh(this.maxInstances);
    this.group.add(this.mesh);
  }

  private createMesh(maxInst: number): THREE.BatchedMesh {
    const mesh = new THREE.BatchedMesh(
      maxInst,
      this.totalVerts,
      this.totalIndices,
      this.material,
    );
    mesh.castShadow = this.castShadow;
    mesh.receiveShadow = this.receiveShadow;
    mesh.perObjectFrustumCulled = false; // Handled upstream by exact camera OBB culling
    mesh.sortObjects = false;
    mesh.frustumCulled = false;
    mesh.visible = false;

    const ids: number[] = [];
    for (let i = 0; i < this.normalizedGeos.length; i++) {
      ids.push(mesh.addGeometry(this.normalizedGeos[i]));
    }
    this.geoIds = ids;
    return mesh;
  }

  private grow(needed: number): void {
    let nextMax = this.maxInstances;
    while (nextMax < needed) nextMax = Math.ceil(nextMax * 1.6);

    const oldMesh = this.mesh;
    const copyCount = this.count;

    // Snapshot active matrices, geometry IDs, and optional instance colors before swapping
    const savedMats = new Float32Array(copyCount * 16);
    const savedGids = new Int32Array(copyCount);
    const savedColors = this.hasColors ? new Uint32Array(copyCount) : null;
    for (let i = 0; i < copyCount; i++) {
      oldMesh.getMatrixAt(i, this.scratchMat);
      savedMats.set(this.scratchMat.elements, i * 16);
      savedGids[i] = oldMesh.getGeometryIdAt(i);
      if (savedColors) {
        oldMesh.getColorAt(i, this.scratchColor);
        savedColors[i] = this.scratchColor.getHex();
      }
    }

    this.group.remove(oldMesh);
    oldMesh.dispose();

    this.maxInstances = nextMax;
    this.mesh = this.createMesh(nextMax);
    this.group.add(this.mesh);
    this.allocatedInstances = 0;

    for (let i = 0; i < copyCount; i++) {
      const id = this.mesh.addInstance(savedGids[i]);
      const off = i * 16;
      const el = this.scratchMat.elements;
      for (let m = 0; m < 16; m++) el[m] = savedMats[off + m];
      this.mesh.setMatrixAt(id, this.scratchMat);
      if (savedColors) {
        this.scratchColor.setHex(savedColors[i]);
        this.mesh.setColorAt(id, this.scratchColor);
      }
      this.allocatedInstances++;
    }
    this.prevCount = copyCount;
  }

  reset(): void {
    this.count = 0;
  }

  pushFromMatrixArray(
    geoIndex: number,
    matArr: Float32Array,
    matOffset: number,
    tintHex = 0xffffff,
  ): void {
    const gid = this.geoIds[geoIndex];
    if (gid === undefined) return;

    const slot = this.count;
    if (slot >= this.maxInstances) {
      this.grow(slot + 1);
    }
    this.count = slot + 1;

    const el = this.scratchMat.elements;
    for (let m = 0; m < 16; m++) el[m] = matArr[matOffset + m];

    let id: number;
    if (slot >= this.allocatedInstances) {
      id = this.mesh.addInstance(gid);
      this.mesh.setMatrixAt(id, this.scratchMat);
      this.allocatedInstances++;
    } else {
      id = slot;
      this.mesh.setGeometryIdAt(slot, gid);
      this.mesh.setMatrixAt(slot, this.scratchMat);
      this.mesh.setVisibleAt(slot, true);
    }

    if (tintHex !== 0xffffff || this.hasColors) {
      this.hasColors = true;
      this.scratchColor.setHex(tintHex);
      this.mesh.setColorAt(id, this.scratchColor);
    }
  }

  commit(): void {
    for (let i = this.count; i < this.prevCount; i++) {
      this.mesh.setVisibleAt(i, false);
    }
    this.prevCount = this.count;
    this.mesh.visible = this.count > 0;
  }

  getCount(): number {
    return this.count;
  }

  dispose(): void {
    this.group.remove(this.mesh);
    this.mesh.dispose();
    for (let i = 0; i < this.normalizedGeos.length; i++) {
      this.normalizedGeos[i].dispose();
    }
  }
}
