import * as THREE from 'three';

export interface AnimatedSpriteBundle {
  fireSheetTexture: THREE.CanvasTexture;
  smokeSheetTexture: THREE.CanvasTexture;
  breathScrollTexture: THREE.CanvasTexture;
  fireMaterial: THREE.ShaderMaterial;
  smokeMaterial: THREE.ShaderMaterial;
  fireGeometry: THREE.PlaneGeometry;
  smokeGeometry: THREE.PlaneGeometry;
  dispose: () => void;
}

function createFireSpriteSheetTexture(frameCount = 12, frameW = 24, frameH = 36): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = frameCount * frameW;
  canvas.height = frameH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  for (let f = 0; f < frameCount; f++) {
    const ox = f * frameW;
    const phase = (f / frameCount) * Math.PI * 2;
    const cxBase = frameW * 0.5;

    for (let py = 0; py < frameH; py++) {
      // ny: 0 at base bottom, 1 at top tip
      const ny = 1 - py / (frameH - 1);

      // Primary central flame tongue centerline & width
      const mainSway =
        Math.sin(phase + ny * 5.8) * (0.85 + ny * 2.1) +
        Math.cos(phase * 2.0 - ny * 8.2) * (0.4 + ny * 0.95);
      const mainTaper =
        ny < 0.14
          ? 0.58 + (ny / 0.14) * 0.42
          : Math.pow(Math.max(0, 1 - (ny - 0.10) / 0.88), 0.68);
      const mainLick = 0.80 + 0.28 * Math.sin(phase * 2.0 + ny * 9.5);
      const mainHalfW = Math.max(0, 7.6 * mainTaper * mainLick);

      // Left secondary curling flame tongue
      const leftCenter = cxBase - 3.6 + Math.sin(phase + ny * 6.4 + 1.2) * (1.1 + ny * 1.4);
      const leftEnv = ny > 0.05 && ny < 0.76 ? Math.sin(((ny - 0.05) / 0.71) * Math.PI) : 0;
      const leftHalfW = 3.6 * leftEnv * (0.78 + 0.25 * Math.cos(phase * 2.0 + ny * 7.0));

      // Right secondary curling flame tongue
      const rightCenter = cxBase + 3.5 + Math.cos(phase + ny * 6.8 - 0.9) * (1.1 + ny * 1.4);
      const rightEnv = ny > 0.06 && ny < 0.82 ? Math.sin(((ny - 0.06) / 0.76) * Math.PI) : 0;
      const rightHalfW = 3.5 * rightEnv * (0.78 + 0.25 * Math.sin(phase * 2.0 - ny * 7.5));

      // Upper detached flame wisp pinching off near the crown
      const wispCycle = ((f + 3) % frameCount) / frameCount;
      const wispY = 0.56 + wispCycle * 0.34;
      const wispCenter = cxBase + Math.sin(phase + 0.8) * 2.2;
      const wispDistY = Math.abs(ny - wispY);

      for (let px = 0; px < frameW; px++) {
        const x = px + 0.5;

        // 1. Main tongue contribution
        const dMain = mainHalfW > 0.2 ? Math.abs(x - (cxBase + mainSway)) / mainHalfW : 99;
        let heat = Math.max(0, 1 - dMain * dMain) * (1.02 - ny * 0.34);

        // Serrated flame notches along outer edges for crisp pixel-art flame silhouette
        const edgeNotch = Math.sin(ny * 17.0 - phase * 2.0 + (x < cxBase ? 0.0 : 2.1));
        if (dMain > 0.65 && edgeNotch < -0.25) {
          heat *= 0.62;
        }

        // 2. Left & right forked side tongues
        if (leftHalfW > 0.25) {
          const dLeft = Math.abs(x - leftCenter) / leftHalfW;
          if (dLeft < 1.1) {
            heat = Math.max(heat, (1 - dLeft * dLeft) * 0.78 * (1 - ny * 0.25));
          }
        }
        if (rightHalfW > 0.25) {
          const dRight = Math.abs(x - rightCenter) / rightHalfW;
          if (dRight < 1.1) {
            heat = Math.max(heat, (1 - dRight * dRight) * 0.80 * (1 - ny * 0.22));
          }
        }

        // 3. Crown pinching wisp
        if (wispDistY < 0.11) {
          const dWisp = Math.hypot((x - wispCenter) * 0.55, (ny - wispY) * 11.0);
          if (dWisp < 1.0) {
            heat = Math.max(heat, (1 - dWisp) * 0.66);
          }
        }

        // 4. Glowing ember & charred coal hearth bed at the base
        if (ny < 0.13) {
          const coalSpread = Math.abs(x - cxBase) / 8.8;
          if (coalSpread < 1.0) {
            const coalPulse = 0.55 + 0.35 * Math.sin(px * 1.9 + phase * 2.0);
            const coalHeat = (1 - coalSpread * coalSpread) * (0.48 + 0.35 * coalPulse);
            heat = Math.max(heat, coalHeat);
          }
        }

        if (heat <= 0.14) continue;

        let color: string;
        if (heat > 0.86 && ny < 0.44 && ny > 0.05) {
          color = '#fffbeb'; // White-hot inner core
        } else if (heat > 0.70 && ny < 0.64) {
          color = '#fef08a'; // Bright sun-yellow tongue
        } else if (heat > 0.58) {
          color = '#facc15'; // Golden yellow flame
        } else if (heat > 0.45) {
          color = '#fb923c'; // Vibrant amber-orange body
        } else if (heat > 0.33) {
          color = '#f97316'; // Deep wildfire orange
        } else if (heat > 0.23) {
          color = '#dc2626'; // Crimson outer flame lick
        } else {
          color = ny < 0.14 ? '#450a0a' : '#991b1b'; // Charred coal base / dark scarlet contour
        }

        ctx.fillStyle = color;
        ctx.fillRect(ox + px, py, 1, 1);
      }
    }

    // 5. Detached rising pixel embers & cinders drifting upward across frames
    for (let s = 0; s < 5; s++) {
      const progress = ((f + s * 2.4) % frameCount) / frameCount;
      const sy = Math.round((frameH - 6) * (1 - (0.32 + progress * 0.64)));
      const swayX = Math.sin(progress * Math.PI * 3 + s * 1.9) * (3.2 + (s % 3) * 1.8);
      const sx = Math.max(1, Math.min(frameW - 2, Math.round(cxBase + swayX)));
      if (sy >= 1 && sy < frameH - 3) {
        ctx.fillStyle = progress < 0.45 ? '#fef08a' : progress < 0.75 ? '#fb923c' : '#dc2626';
        ctx.fillRect(ox + sx, sy, 1, 1);
        if (progress < 0.35 && sy + 1 < frameH) {
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(ox + sx, sy + 1, 1, 1);
        }
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createSmokeSpriteSheetTexture(frameCount = 8, frameSize = 20): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = frameCount * frameSize;
  canvas.height = frameSize;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const coolPalette = ['#1b1e2b', '#2a2f42', '#3d445c', '#545d7a', '#717b99'];
  const emberUnderPalette = ['#381912', '#572416', '#7c3019'];

  for (let f = 0; f < frameCount; f++) {
    const ox = f * frameSize;
    const phase = (f / frameCount) * Math.PI * 2;
    const puffs = [
      { cx: 10 + Math.sin(phase) * 1.6, cy: 11.5 - f * 0.25, r: 5.6 },
      { cx: 7.4 + Math.cos(phase + 1.1) * 1.7, cy: 9.6, r: 4.3 },
      { cx: 12.8 + Math.sin(phase + 2.3) * 1.5, cy: 9.2, r: 4.1 },
      { cx: 10.0 + Math.cos(phase * 2) * 1.3, cy: 6.2, r: 3.5 },
      { cx: 8.6 + Math.sin(phase * 2 + 1.4) * 1.1, cy: 13.4, r: 3.6 },
    ];

    for (let py = 0; py < frameSize; py++) {
      for (let px = 0; px < frameSize; px++) {
        let best = 0;
        for (const puff of puffs) {
          const d = Math.hypot(px + 0.5 - puff.cx, py + 0.5 - puff.cy) / puff.r;
          best = Math.max(best, 1 - d);
        }
        if (best <= 0.13) continue;
        const ny = 1 - py / frameSize;
        if (ny < 0.28 && best > 0.34) {
          // Warm fire-lit underbelly on lower smoke puffs
          const eIdx = Math.min(emberUnderPalette.length - 1, Math.floor(best * emberUnderPalette.length));
          ctx.fillStyle = emberUnderPalette[eIdx];
        } else {
          const shadeIdx = Math.min(
            coolPalette.length - 1,
            Math.max(0, Math.floor((best * 0.68 + ny * 0.44) * coolPalette.length)),
          );
          ctx.fillStyle = coolPalette[shadeIdx];
        }
        ctx.fillRect(ox + px, py, 1, 1);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createBreathScrollTexture(size = 32): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wave1 = Math.sin((y / size) * Math.PI * 4 + (x / size) * Math.PI * 2);
      const wave2 = Math.cos((y / size) * Math.PI * 6 - (x / size) * Math.PI * 4);
      const streak = 0.52 + 0.28 * wave1 + 0.2 * wave2;
      const alpha = Math.min(1, Math.max(0.28, streak * 0.95));
      const bright = streak > 0.72 ? 255 : streak > 0.46 ? 228 : 185;
      ctx.fillStyle = `rgba(${bright}, ${bright}, ${bright}, ${alpha.toFixed(2)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createAnimatedFireSpriteBundle(): AnimatedSpriteBundle {
  const FIRE_FRAMES = 12;
  const SMOKE_FRAMES = 8;
  const fireSheetTexture = createFireSpriteSheetTexture(FIRE_FRAMES, 24, 36);
  const smokeSheetTexture = createSmokeSpriteSheetTexture(SMOKE_FRAMES, 20);
  const breathScrollTexture = createBreathScrollTexture(32);

  const fireGeometry = new THREE.PlaneGeometry(1.02, 1.48);
  fireGeometry.translate(0, 0.68, 0);

  const smokeGeometry = new THREE.PlaneGeometry(0.84, 0.84);

  const fireMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: fireSheetTexture },
      uTime: { value: 0 },
      uFrameCount: { value: FIRE_FRAMES },
      uFps: { value: 13.5 },
    },
    vertexShader: `
      attribute vec2 aFireData;
      attribute vec3 aFireColor;
      uniform float uTime;
      uniform float uFrameCount;
      uniform float uFps;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec3 worldCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float sx = length(vec3(instanceMatrix[0].xyz));
        float sy = length(vec3(instanceMatrix[1].xyz));

        vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 camUp = normalize(mix(vec3(0.0, 1.0, 0.0), vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]), 0.36));

        float phase = aFireData.x;
        float sway = (sin(uTime * 7.2 + phase * 19.0 + uv.y * 3.5) * 0.085 + cos(uTime * 11.5 - phase * 13.0) * 0.03) * uv.y * sx;
        float stretchY = 1.0 + sin(uTime * 9.5 + phase * 23.0) * 0.08 * uv.y;
        vec3 posWorld = worldCenter + camRight * (position.x * sx + sway) + camUp * (position.y * sy * stretchY);

        float frameIdx = floor(mod(uTime * uFps + phase * uFrameCount, uFrameCount));
        vUv = vec2((uv.x + frameIdx) / uFrameCount, uv.y);
        vColor = aFireColor;
        vAlpha = aFireData.y;

        gl_Position = projectionMatrix * viewMatrix * vec4(posWorld, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec4 tex = texture2D(uMap, vUv);
        if (tex.a < 0.15) discard;

        // Pure white (1,1,1) preserves classic yellow/orange/crimson pixel fire;
        // colored dragon fires remap luminance into bright dragon-colored flames with white-hot core.
        float tintStrength = smoothstep(0.02, 0.18, length(vColor - vec3(1.0)));
        float luma = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
        vec3 dragonFlame = mix(vColor * (0.62 + luma * 0.95), vec3(1.0, 0.99, 0.92), smoothstep(0.76, 0.97, luma));
        vec3 finalRgb = mix(tex.rgb, dragonFlame, tintStrength);

        gl_FragColor = vec4(finalRgb, tex.a * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const smokeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: smokeSheetTexture },
      uTime: { value: 0 },
      uFrameCount: { value: SMOKE_FRAMES },
      uFps: { value: 6.0 },
    },
    vertexShader: `
      attribute vec2 aSmokeData;
      uniform float uTime;
      uniform float uFrameCount;
      uniform float uFps;
      varying vec2 vUv;
      varying float vOpacity;

      void main() {
        vec3 worldCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float sx = length(vec3(instanceMatrix[0].xyz));
        float sy = length(vec3(instanceMatrix[1].xyz));

        vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 camUp = normalize(mix(vec3(0.0, 1.0, 0.0), vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]), 0.45));

        vec3 posWorld = worldCenter + camRight * (position.x * sx) + camUp * (position.y * sy);
        float phase = aSmokeData.x;
        float frameIdx = floor(mod(uTime * uFps + phase * uFrameCount, uFrameCount));
        vUv = vec2((uv.x + frameIdx) / uFrameCount, uv.y);
        vOpacity = aSmokeData.y;

        gl_Position = projectionMatrix * viewMatrix * vec4(posWorld, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec2 vUv;
      varying float vOpacity;

      void main() {
        vec4 tex = texture2D(uMap, vUv);
        if (tex.a < 0.15) discard;
        gl_FragColor = vec4(tex.rgb, tex.a * vOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  return {
    fireSheetTexture,
    smokeSheetTexture,
    breathScrollTexture,
    fireMaterial,
    smokeMaterial,
    fireGeometry,
    smokeGeometry,
    dispose: () => {
      fireSheetTexture.dispose();
      smokeSheetTexture.dispose();
      breathScrollTexture.dispose();
      fireMaterial.dispose();
      smokeMaterial.dispose();
      fireGeometry.dispose();
      smokeGeometry.dispose();
    },
  };
}
