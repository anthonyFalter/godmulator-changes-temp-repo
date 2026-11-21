import * as THREE from 'three';
import { SimulationState, WarFrontArrowData } from './types';

const HEIGHT_STEP = 0.45;
const WATER_SURFACE_Y = 0.38;
const SHAFT_SEGMENTS = 28;
const DASH_SEGMENTS = 18;

const WAR_ARROW_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const WAR_ARROW_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uMomentum;
  uniform float uOpacity;
  uniform float uLength;
  varying vec2 vUv;

  void main() {
    // Crisp marching tactical chevrons moving from attacker (vUv.x = 0) toward target (vUv.x = 1)
    float speed = uMomentum > 0.5 ? 2.6 : (uMomentum < -0.5 ? 0.9 : 1.75);
    float edgeDist = abs(vUv.y - 0.5) * 2.0; // 0 at center, 1 at ribbon edge
    float chevronFreq = max(2.0, uLength * 0.48);
    float chevronCoord = fract(vUv.x * chevronFreq - uTime * speed - edgeDist * 0.42);
    float chevronBand = step(0.46, chevronCoord) * step(chevronCoord, 0.86);

    // Bright vanguard glow near the advancing arrow tip
    float tipGlow = smoothstep(0.72, 1.0, vUv.x) * 0.28;
    // Soft tail fade so the arrow originates smoothly from attacker territory
    float tailFade = smoothstep(0.0, 0.12, vUv.x);
    // Crisp dark edge trim inside the colored shaft
    float borderTrim = smoothstep(0.84, 0.98, edgeDist);

    vec3 highlightCol = mix(uColor, vec3(1.0, 0.97, 0.88), 0.58);
    vec3 shadowCol = uColor * 0.52;
    vec3 col = mix(uColor * 0.82, highlightCol, chevronBand * 0.72 + tipGlow);
    col = mix(col, shadowCol, borderTrim * 0.72);

    float alpha = uOpacity * (0.35 + 0.65 * tailFade);
    gl_FragColor = vec4(col, alpha);
  }
`;

const WAR_HEAD_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uMomentum;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float pulse = 0.5 + 0.5 * sin(uTime * (uMomentum > 0.5 ? 6.0 : 3.2));
    float tipHighlight = smoothstep(0.25, 1.0, vUv.x);
    vec3 bright = mix(uColor, vec3(1.0, 0.98, 0.9), 0.45 + 0.2 * pulse);
    vec3 col = mix(uColor, bright, tipHighlight * 0.85);
    gl_FragColor = vec4(col, uOpacity);
  }
`;

interface WarArrowVisualEntry {
  id: string;
  group: THREE.Group;
  shaftGeo: THREE.BufferGeometry;
  shaftPos: Float32Array;
  shaftMat: THREE.ShaderMaterial;
  shaftMesh: THREE.Mesh;
  borderGeo: THREE.BufferGeometry;
  borderPos: Float32Array;
  borderMat: THREE.MeshBasicMaterial;
  borderMesh: THREE.Mesh;
  headGeo: THREE.BufferGeometry;
  headPos: Float32Array;
  headMat: THREE.ShaderMaterial;
  headMesh: THREE.Mesh;
  headBorderGeo: THREE.BufferGeometry;
  headBorderPos: Float32Array;
  headBorderMesh: THREE.Mesh;
  dashGeo: THREE.BufferGeometry;
  dashPos: Float32Array;
  dashMat: THREE.LineDashedMaterial;
  dashLine: THREE.Line;
  currentProgress: number;
  targetProgress: number;
  labelX: number;
  labelY: number;
  labelZ: number;
  lastSeenStamp: number;
}

export interface WarFrontArrowsSystem {
  group: THREE.Group;
  sync: (
    arrows: WarFrontArrowData[] | undefined,
    simState: SimulationState,
    dt: number,
    elapsed: number,
  ) => void;
  getMarkerWorldPosition: (arrowId: string, out: THREE.Vector3) => boolean;
  dispose: () => void;
}

function sampleTerrainHeight(simState: SimulationState, wx: number, wz: number): number {
  const gSize = simState.gridSize;
  const tx = Math.max(0, Math.min(gSize - 1, Math.round(wx)));
  const tz = Math.max(0, Math.min(gSize - 1, Math.round(wz)));
  const tile = simState.tiles[tz * gSize + tx];
  if (!tile || tile.height <= 0) return WATER_SURFACE_Y;
  return tile.height * HEIGHT_STEP;
}

function buildRibbonIndexBuffer(segments: number): Uint16Array {
  const indices = new Uint16Array(segments * 6);
  let ptr = 0;
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices[ptr++] = a;
    indices[ptr++] = b;
    indices[ptr++] = c;
    indices[ptr++] = b;
    indices[ptr++] = d;
    indices[ptr++] = c;
  }
  return indices;
}

function buildRibbonUvBuffer(segments: number): Float32Array {
  const uvs = new Float32Array((segments + 1) * 2 * 2);
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    uvs[i * 4] = u;
    uvs[i * 4 + 1] = 0;
    uvs[i * 4 + 2] = u;
    uvs[i * 4 + 3] = 1;
  }
  return uvs;
}

function createArrowEntry(arrow: WarFrontArrowData): WarArrowVisualEntry {
  const group = new THREE.Group();
  const vertCount = (SHAFT_SEGMENTS + 1) * 2;
  const sharedIndices = buildRibbonIndexBuffer(SHAFT_SEGMENTS);
  const sharedUvs = buildRibbonUvBuffer(SHAFT_SEGMENTS);

  const shaftPos = new Float32Array(vertCount * 3);
  const shaftGeo = new THREE.BufferGeometry();
  shaftGeo.setAttribute('position', new THREE.BufferAttribute(shaftPos, 3));
  shaftGeo.setAttribute('uv', new THREE.BufferAttribute(sharedUvs, 2));
  shaftGeo.setIndex(new THREE.BufferAttribute(sharedIndices, 1));

  const shaftMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(arrow.hexColor) },
      uTime: { value: 0 },
      uMomentum: { value: 0 },
      uOpacity: { value: 0.94 },
      uLength: { value: 10 },
    },
    vertexShader: WAR_ARROW_VERTEX_SHADER,
    fragmentShader: WAR_ARROW_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
  shaftMesh.renderOrder = 15;
  shaftMesh.frustumCulled = false;

  const borderPos = new Float32Array(vertCount * 3);
  const borderGeo = new THREE.BufferGeometry();
  borderGeo.setAttribute('position', new THREE.BufferAttribute(borderPos, 3));
  borderGeo.setIndex(new THREE.BufferAttribute(sharedIndices.slice(), 1));
  const borderMat = new THREE.MeshBasicMaterial({
    color: 0x0b0a09,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const borderMesh = new THREE.Mesh(borderGeo, borderMat);
  borderMesh.renderOrder = 14;
  borderMesh.frustumCulled = false;

  // V-notched arrowhead: 4 vertices (0: tip, 1: leftWing, 2: innerNotch, 3: rightWing) -> 2 triangles
  const headPos = new Float32Array(4 * 3);
  const headUvs = new Float32Array([1, 0.5, 0, 0, 0.28, 0.5, 0, 1]);
  const headIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const headGeo = new THREE.BufferGeometry();
  headGeo.setAttribute('position', new THREE.BufferAttribute(headPos, 3));
  headGeo.setAttribute('uv', new THREE.BufferAttribute(headUvs, 2));
  headGeo.setIndex(new THREE.BufferAttribute(headIndices, 1));
  const headMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(arrow.hexColor) },
      uTime: { value: 0 },
      uMomentum: { value: 0 },
      uOpacity: { value: 0.98 },
    },
    vertexShader: WAR_ARROW_VERTEX_SHADER,
    fragmentShader: WAR_HEAD_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.renderOrder = 16;
  headMesh.frustumCulled = false;

  const headBorderPos = new Float32Array(4 * 3);
  const headBorderGeo = new THREE.BufferGeometry();
  headBorderGeo.setAttribute('position', new THREE.BufferAttribute(headBorderPos, 3));
  headBorderGeo.setIndex(new THREE.BufferAttribute(headIndices.slice(), 1));
  const headBorderMesh = new THREE.Mesh(headBorderGeo, borderMat);
  headBorderMesh.renderOrder = 14;
  headBorderMesh.frustumCulled = false;

  // Faint dashed route line from current tip to defender target capital
  const dashPos = new Float32Array((DASH_SEGMENTS + 1) * 3);
  const dashGeo = new THREE.BufferGeometry();
  dashGeo.setAttribute('position', new THREE.BufferAttribute(dashPos, 3));
  const dashMat = new THREE.LineDashedMaterial({
    color: new THREE.Color(arrow.hexColor),
    dashSize: 0.85,
    gapSize: 0.55,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const dashLine = new THREE.Line(dashGeo, dashMat);
  dashLine.renderOrder = 13;
  dashLine.frustumCulled = false;

  group.add(dashLine, borderMesh, headBorderMesh, shaftMesh, headMesh);

  return {
    id: arrow.id,
    group,
    shaftGeo,
    shaftPos,
    shaftMat,
    shaftMesh,
    borderGeo,
    borderPos,
    borderMat,
    borderMesh,
    headGeo,
    headPos,
    headMat,
    headMesh,
    headBorderGeo,
    headBorderPos,
    headBorderMesh,
    dashGeo,
    dashPos,
    dashMat,
    dashLine,
    // Start slightly retracted on initial zone open so arrows animate outward cleanly
    currentProgress: Math.max(0.08, arrow.progress * 0.45),
    targetProgress: arrow.progress,
    labelX: arrow.fromX,
    labelY: 2.0,
    labelZ: arrow.fromZ,
    lastSeenStamp: 0,
  };
}

function disposeArrowEntry(entry: WarArrowVisualEntry) {
  entry.shaftGeo.dispose();
  entry.shaftMat.dispose();
  entry.borderGeo.dispose();
  entry.borderMat.dispose();
  entry.headGeo.dispose();
  entry.headMat.dispose();
  entry.headBorderGeo.dispose();
  entry.dashGeo.dispose();
  entry.dashMat.dispose();
}

export function createWarFrontArrowsSystem(): WarFrontArrowsSystem {
  const group = new THREE.Group();
  group.visible = false;
  const entries = new Map<string, WarArrowVisualEntry>();
  let syncStamp = 0;

  // Reusable scratch color to avoid allocations inside per-frame sync
  const _scratchColor = new THREE.Color();

  function evaluateCurvePoint(
    fromX: number,
    fromZ: number,
    ctrlX: number,
    ctrlZ: number,
    toX: number,
    toZ: number,
    t: number,
  ): [number, number] {
    const inv = 1 - t;
    return [
      inv * inv * fromX + 2 * inv * t * ctrlX + t * t * toX,
      inv * inv * fromZ + 2 * inv * t * ctrlZ + t * t * toZ,
    ];
  }

  function evaluateCurveTangent(
    fromX: number,
    fromZ: number,
    ctrlX: number,
    ctrlZ: number,
    toX: number,
    toZ: number,
    t: number,
  ): [number, number] {
    const tx = 2 * (1 - t) * (ctrlX - fromX) + 2 * t * (toX - ctrlX);
    const tz = 2 * (1 - t) * (ctrlZ - fromZ) + 2 * t * (toZ - ctrlZ);
    const len = Math.hypot(tx, tz) || 1;
    return [tx / len, tz / len];
  }

  function sync(
    arrows: WarFrontArrowData[] | undefined,
    simState: SimulationState,
    dt: number,
    elapsed: number,
  ) {
    if (!arrows || arrows.length === 0) {
      if (entries.size > 0) {
        for (const entry of entries.values()) {
          group.remove(entry.group);
          disposeArrowEntry(entry);
        }
        entries.clear();
      }
      group.visible = false;
      return;
    }

    syncStamp++;
    group.visible = true;
    const safeDt = Math.min(0.1, Math.max(0.001, dt));

    for (let i = 0; i < arrows.length; i++) {
      const arrow = arrows[i];
      let entry = entries.get(arrow.id);
      if (!entry) {
        entry = createArrowEntry(arrow);
        entries.set(arrow.id, entry);
        group.add(entry.group);
      }
      entry.lastSeenStamp = syncStamp;
      entry.targetProgress = Math.max(0.12, Math.min(0.94, arrow.progress));
      // Smoothly expand forward or retract backward as territory is gained or lost
      entry.currentProgress = THREE.MathUtils.damp(
        entry.currentProgress,
        entry.targetProgress,
        4.2,
        safeDt,
      );

      const dx = arrow.toX - arrow.fromX;
      const dz = arrow.toZ - arrow.fromZ;
      const spanDist = Math.max(2.0, Math.hypot(dx, dz));
      const dirX = dx / spanDist;
      const dirZ = dz / spanDist;
      // Right-hand perpendicular vector so opposing war arrows bow cleanly apart
      const perpX = -dirZ;
      const perpZ = dirX;

      const curveBow = Math.max(1.2, Math.min(5.2, spanDist * 0.12));
      const ctrlX = (arrow.fromX + arrow.toX) * 0.5 + perpX * curveBow;
      const ctrlZ = (arrow.fromZ + arrow.toZ) * 0.5 + perpZ * curveBow;

      // Keep a small setback from exact capital centers so labels & arrowheads stay crisp
      const startT = Math.min(0.1, 1.4 / spanDist);
      const tipT = Math.max(startT + 0.06, Math.min(0.95, entry.currentProgress));
      const headLenWorld = Math.max(1.25, Math.min(2.45, spanDist * 0.075));
      const headHalfWidth = headLenWorld * 0.72;
      const shaftEndT = Math.max(startT + 0.02, tipT - (headLenWorld * 0.62) / spanDist);
      const baseHalfW = Math.max(0.32, Math.min(0.68, spanDist * 0.018));
      const borderPad = Math.max(0.14, baseHalfW * 0.34);
      const arcLift = Math.min(2.4, Math.max(0.55, spanDist * 0.04));

      // 1. Update tapered ribbon shaft + dark outline skirt
      for (let s = 0; s <= SHAFT_SEGMENTS; s++) {
        const frac = s / SHAFT_SEGMENTS;
        const t = startT + (shaftEndT - startT) * frac;
        const [px, pz] = evaluateCurvePoint(arrow.fromX, arrow.fromZ, ctrlX, ctrlZ, arrow.toX, arrow.toZ, t);
        const [tx, tz] = evaluateCurveTangent(arrow.fromX, arrow.fromZ, ctrlX, ctrlZ, arrow.toX, arrow.toZ, t);
        const sideX = -tz;
        const sideZ = tx;

        const surfY = sampleTerrainHeight(simState, px, pz);
        const py = Math.max(WATER_SURFACE_Y + 0.72, surfY + 1.12) + Math.sin(t * Math.PI) * arcLift;

        // Slightly widens from tail toward arrowhead for bold strategic arrow silhouette
        const halfW = baseHalfW * (0.62 + frac * 0.54);
        const bHalfW = halfW + borderPad;
        const vIdx = s * 6;

        entry.shaftPos[vIdx] = px - sideX * halfW;
        entry.shaftPos[vIdx + 1] = py + 0.06;
        entry.shaftPos[vIdx + 2] = pz - sideZ * halfW;
        entry.shaftPos[vIdx + 3] = px + sideX * halfW;
        entry.shaftPos[vIdx + 4] = py + 0.06;
        entry.shaftPos[vIdx + 5] = pz + sideZ * halfW;

        entry.borderPos[vIdx] = px - sideX * bHalfW;
        entry.borderPos[vIdx + 1] = py;
        entry.borderPos[vIdx + 2] = pz - sideZ * bHalfW;
        entry.borderPos[vIdx + 3] = px + sideX * bHalfW;
        entry.borderPos[vIdx + 4] = py;
        entry.borderPos[vIdx + 5] = pz + sideZ * bHalfW;

        if (s === Math.floor(SHAFT_SEGMENTS * 0.55)) {
          entry.labelX = px;
          entry.labelY = py + 0.75;
          entry.labelZ = pz;
        }
      }
      entry.shaftGeo.attributes.position.needsUpdate = true;
      entry.borderGeo.attributes.position.needsUpdate = true;

      // 2. Update bold V-notched arrowhead & border silhouette at live tipT
      const [tipX, tipZ] = evaluateCurvePoint(arrow.fromX, arrow.fromZ, ctrlX, ctrlZ, arrow.toX, arrow.toZ, tipT);
      const [tDirX, tDirZ] = evaluateCurveTangent(arrow.fromX, arrow.fromZ, ctrlX, ctrlZ, arrow.toX, arrow.toZ, tipT);
      const hSideX = -tDirZ;
      const hSideZ = tDirX;
      const tipSurfY = sampleTerrainHeight(simState, tipX, tipZ);
      const tipY = Math.max(WATER_SURFACE_Y + 0.72, tipSurfY + 1.12) + Math.sin(tipT * Math.PI) * arcLift;

      const writeHeadQuad = (
        arr: Float32Array,
        yOff: number,
        lenScale: number,
        wScale: number,
        forwardPad: number,
      ) => {
        const hl = headLenWorld * lenScale;
        const hw = headHalfWidth * wScale;
        const notchBack = hl * 0.62;
        // 0: Tip
        arr[0] = tipX + tDirX * forwardPad;
        arr[1] = tipY + yOff;
        arr[2] = tipZ + tDirZ * forwardPad;
        // 1: Left Wing
        arr[3] = tipX - tDirX * hl - hSideX * hw;
        arr[4] = tipY + yOff;
        arr[5] = tipZ - tDirZ * hl - hSideZ * hw;
        // 2: Inner Notch
        arr[6] = tipX - tDirX * notchBack;
        arr[7] = tipY + yOff;
        arr[8] = tipZ - tDirZ * notchBack;
        // 3: Right Wing
        arr[9] = tipX - tDirX * hl + hSideX * hw;
        arr[10] = tipY + yOff;
        arr[11] = tipZ - tDirZ * hl + hSideZ * hw;
      };

      writeHeadQuad(entry.headPos, 0.09, 1.0, 1.0, 0.0);
      writeHeadQuad(entry.headBorderPos, 0.02, 1.16, 1.24, 0.24);
      entry.headGeo.attributes.position.needsUpdate = true;
      entry.headBorderGeo.attributes.position.needsUpdate = true;

      // 3. Update remaining dashed conquest path from tip -> target nation
      const dashEndT = Math.max(tipT + 0.02, 0.96);
      for (let d = 0; d <= DASH_SEGMENTS; d++) {
        const dtFrac = d / DASH_SEGMENTS;
        const t = tipT + (dashEndT - tipT) * dtFrac;
        const [px, pz] = evaluateCurvePoint(arrow.fromX, arrow.fromZ, ctrlX, ctrlZ, arrow.toX, arrow.toZ, t);
        const surfY = sampleTerrainHeight(simState, px, pz);
        const py = Math.max(WATER_SURFACE_Y + 0.68, surfY + 1.04) + Math.sin(t * Math.PI) * arcLift;
        entry.dashPos[d * 3] = px;
        entry.dashPos[d * 3 + 1] = py;
        entry.dashPos[d * 3 + 2] = pz;
      }
      entry.dashGeo.attributes.position.needsUpdate = true;
      entry.dashLine.computeLineDistances();
      entry.dashLine.visible = tipT < 0.92;

      // 4. Sync colors & shader uniforms
      _scratchColor.set(arrow.hexColor);
      const momentumNum =
        arrow.momentum === 'advancing' ? 1.0 : arrow.momentum === 'retreating' ? -1.0 : 0.0;
      entry.shaftMat.uniforms.uColor.value.copy(_scratchColor);
      entry.shaftMat.uniforms.uTime.value = elapsed;
      entry.shaftMat.uniforms.uMomentum.value = momentumNum;
      entry.shaftMat.uniforms.uLength.value = spanDist * Math.max(0.15, tipT - startT);

      entry.headMat.uniforms.uColor.value.copy(_scratchColor);
      entry.headMat.uniforms.uTime.value = elapsed;
      entry.headMat.uniforms.uMomentum.value = momentumNum;

      entry.dashMat.color.copy(_scratchColor);
    }

    // Dispose arrows whose wars ended or that are no longer active
    for (const [id, entry] of entries.entries()) {
      if (entry.lastSeenStamp !== syncStamp) {
        group.remove(entry.group);
        disposeArrowEntry(entry);
        entries.delete(id);
      }
    }
  }

  function getMarkerWorldPosition(arrowId: string, out: THREE.Vector3): boolean {
    const entry = entries.get(arrowId);
    if (!entry) return false;
    out.set(entry.labelX, entry.labelY, entry.labelZ);
    return true;
  }

  function dispose() {
    for (const entry of entries.values()) {
      group.remove(entry.group);
      disposeArrowEntry(entry);
    }
    entries.clear();
  }

  return {
    group,
    sync,
    getMarkerWorldPosition,
    dispose,
  };
}
