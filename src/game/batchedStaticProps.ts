import * as THREE from 'three';

function normalizeForStaticBatch(
  source: THREE.BufferGeometry,
  wantIndexed: boolean,
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
  if (wantIndexed && !g.index && count > 0) {
    const idx = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
    for (let i = 0; i < count; i++) idx[i] = i;
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

    // Use indexed layout if all source geometries are indexed (e.g. voxelTrees), else non-indexed
    const allIndexed = geometries.length > 0 && geometries.every((g) => g.index !== null);
    this.normalizedGeos = geometries.map((g) => normalizeForStaticBatch(g, allIndexed));

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

    // Snapshot active matrices & geometry IDs before swapping
    const savedMats = new Float32Array(copyCount * 16);
    const savedGids = new Int32Array(copyCount);
    for (let i = 0; i < copyCount; i++) {
      oldMesh.getMatrixAt(i, this.scratchMat);
      savedMats.set(this.scratchMat.elements, i * 16);
      savedGids[i] = oldMesh.getGeometryIdAt(i);
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
      this.allocatedInstances++;
    }
    this.prevCount = copyCount;
  }

  reset(): void {
    this.count = 0;
  }

  pushFromMatrixArray(geoIndex: number, matArr: Float32Array, matOffset: number): void {
    const gid = this.geoIds[geoIndex];
    if (gid === undefined) return;

    const slot = this.count;
    if (slot >= this.maxInstances) {
      this.grow(slot + 1);
    }
    this.count = slot + 1;

    const el = this.scratchMat.elements;
    for (let m = 0; m < 16; m++) el[m] = matArr[matOffset + m];

    if (slot >= this.allocatedInstances) {
      const id = this.mesh.addInstance(gid);
      this.mesh.setMatrixAt(id, this.scratchMat);
      this.allocatedInstances++;
    } else {
      this.mesh.setGeometryIdAt(slot, gid);
      this.mesh.setMatrixAt(slot, this.scratchMat);
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
