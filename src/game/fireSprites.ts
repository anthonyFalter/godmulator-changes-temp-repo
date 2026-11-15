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

function createFireSpriteSheetTexture(frameCount = 8, frameW = 16, frameH = 24): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = frameCount * frameW;
  canvas.height = frameH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  for (let f = 0; f < frameCount; f++) {
    const ox = f * frameW;
    const phase = (f / frameCount) * Math.PI * 2;

    for (let py = 0; py < frameH; py++) {
      // ny: 0 at base bottom, 1 at top tip
      const ny = 1 - py / (frameH - 1);
      // Horizontal flame centerline waves back & forth like dancing fire tongues
      const sway =
        Math.sin(phase + ny * 5.4) * (0.65 + ny * 1.45) +
        Math.cos(phase * 2.0 - ny * 7.2) * (0.3 + ny * 0.65);

      // Flame envelope widens slightly near base, tapers jaggedly upward
      const taper = ny < 0.16 ? 0.68 + (ny / 0.16) * 0.32 : Math.pow(Math.max(0, 1 - (ny - 0.12) / 0.88), 0.72);
      const lick = 0.78 + 0.32 * Math.sin(phase * 2.0 + ny * 8.5);
      const halfWidth = Math.max(0, 5.4 * taper * lick);

      for (let px = 0; px < frameW; px++) {
        const dx = px + 0.5 - (frameW * 0.5 + sway);
        const adx = Math.abs(dx);
        const normDist = halfWidth > 0.25 ? adx / halfWidth : 99;

        // Main flame body + rising split licks
        let heat = Math.max(0, 1 - normDist * normDist) * (1 - ny * 0.38);

        // Secondary twin side tongue near mid-height
        const subCenter = Math.sin(phase + 1.8) * 2.9;
        const subDist = Math.abs(px + 0.5 - (frameW * 0.5 + subCenter));
        if (ny > 0.28 && ny < 0.78 && subDist < 1.9 * (1 - (ny - 0.28) * 1.4)) {
          heat = Math.max(heat, 0.44 - Math.abs(ny - 0.52) * 0.6);
        }

        // Detached glowing pixel sparks drifting upward in staggered frames
        const sparkX1 = Math.round(frameW * 0.5 + Math.sin(phase + 0.6) * 3.2);
        const sparkY1 = Math.round(2 + ((frameH - 4) * ((f * 3 + 1) % 8)) / 8);
        const sparkX2 = Math.round(frameW * 0.5 + Math.cos(phase + 2.1) * 4.1);
        const sparkY2 = Math.round(1 + ((frameH - 5) * ((f * 5 + 4) % 8)) / 8);
        if ((px === sparkX1 && py === sparkY1) || (px === sparkX2 && py === sparkY2)) {
          heat = Math.max(heat, 0.72);
        }

        if (heat <= 0.16) continue;

        let color: string;
        if (heat > 0.84 && ny < 0.48) {
          color = '#fffde7'; // White-hot hearth core
        } else if (heat > 0.66 && ny < 0.66) {
          color = '#fef08a'; // Bright yellow core
        } else if (heat > 0.48) {
          color = '#fb923c'; // Vibrant golden-orange body
        } else if (heat > 0.31) {
          color = '#f97316'; // Deep flame orange
        } else {
          color = '#dc2626'; // Crimson flickering tips
        }

        ctx.fillStyle = color;
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

function createSmokeSpriteSheetTexture(frameCount = 6, frameSize = 16): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = frameCount * frameSize;
  canvas.height = frameSize;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const palette = ['#222536', '#33384d', '#495069', '#646c87'];

  for (let f = 0; f < frameCount; f++) {
    const ox = f * frameSize;
    const phase = (f / frameCount) * Math.PI * 2;
    const puffs = [
      { cx: 8 + Math.sin(phase) * 1.4, cy: 9 - f * 0.25, r: 4.4 },
      { cx: 6 + Math.cos(phase + 1.0) * 1.5, cy: 7.5, r: 3.3 },
      { cx: 10.2 + Math.sin(phase + 2.2) * 1.2, cy: 7.2, r: 3.1 },
      { cx: 8 + Math.cos(phase * 2) * 1.1, cy: 5.0, r: 2.6 },
    ];

    for (let py = 0; py < frameSize; py++) {
      for (let px = 0; px < frameSize; px++) {
        let best = 0;
        for (const puff of puffs) {
          const d = Math.hypot(px + 0.5 - puff.cx, py + 0.5 - puff.cy) / puff.r;
          best = Math.max(best, 1 - d);
        }
        if (best <= 0.14) continue;
        const topBias = 1 - py / frameSize;
        const shadeIdx = Math.min(
          palette.length - 1,
          Math.max(0, Math.floor((best * 0.7 + topBias * 0.45) * palette.length)),
        );
        ctx.fillStyle = palette[shadeIdx];
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
  const FIRE_FRAMES = 8;
  const SMOKE_FRAMES = 6;
  const fireSheetTexture = createFireSpriteSheetTexture(FIRE_FRAMES, 16, 24);
  const smokeSheetTexture = createSmokeSpriteSheetTexture(SMOKE_FRAMES, 16);
  const breathScrollTexture = createBreathScrollTexture(32);

  const fireGeometry = new THREE.PlaneGeometry(0.95, 1.38);
  fireGeometry.translate(0, 0.64, 0);

  const smokeGeometry = new THREE.PlaneGeometry(0.76, 0.76);

  const fireMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: fireSheetTexture },
      uTime: { value: 0 },
      uFrameCount: { value: FIRE_FRAMES },
      uFps: { value: 11.0 },
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
        float sway = sin(uTime * 6.0 + phase * 18.0) * 0.075 * uv.y * sx;
        vec3 posWorld = worldCenter + camRight * (position.x * sx + sway) + camUp * (position.y * sy);

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
