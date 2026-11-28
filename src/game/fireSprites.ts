import * as THREE from 'three';

export const FLAME_SPRITESHEET_FRAMES = 8;

export function getFlameSpriteSheetUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}assets/sprites/flame_spritesheet.png`;
}

export interface AnimatedSpriteBundle {
  fireSheetTexture: THREE.Texture;
  smokeSheetTexture: THREE.CanvasTexture;
  breathScrollTexture: THREE.CanvasTexture;
  fireMaterial: THREE.ShaderMaterial;
  smokeMaterial: THREE.ShaderMaterial;
  fireGeometry: THREE.PlaneGeometry;
  smokeGeometry: THREE.PlaneGeometry;
  dispose: () => void;
}

function createFireSpriteSheetTexture(): THREE.Texture {
  const loader = new THREE.TextureLoader();
  const tex = loader.load(getFlameSpriteSheetUrl());
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
  const FIRE_FRAMES = FLAME_SPRITESHEET_FRAMES;
  const SMOKE_FRAMES = 8;
  const fireSheetTexture = createFireSpriteSheetTexture();
  const smokeSheetTexture = createSmokeSpriteSheetTexture(SMOKE_FRAMES, 20);
  const breathScrollTexture = createBreathScrollTexture(32);

  // 64x64 square frames with flame base near bottom; lift by 0.70 so base sits flush on tiles
  const fireGeometry = new THREE.PlaneGeometry(1.56, 1.56);
  fireGeometry.translate(0, 0.70, 0);

  const smokeGeometry = new THREE.PlaneGeometry(0.84, 0.84);

  const fireMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: fireSheetTexture },
      uTime: { value: 0 },
      uFrameCount: { value: FIRE_FRAMES },
      uFps: { value: 11.5 },
    },
    vertexShader: `
      attribute vec2 aFireData;
      attribute vec3 aFireColor;
      uniform float uTime;
      uniform float uFrameCount;
      uniform float uFps;
      varying vec2 vUv;
      varying float vAlpha;

      void main() {
        vec3 worldCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float sx = length(vec3(instanceMatrix[0].xyz));
        float sy = length(vec3(instanceMatrix[1].xyz));

        vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 camUp = normalize(mix(vec3(0.0, 1.0, 0.0), vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]), 0.36));

        float phase = aFireData.x;
        // Subtle organic breeze sway that complements the baked pixel-art spritesheet loop
        float sway = (sin(uTime * 5.8 + phase * 19.0 + uv.y * 2.5) * 0.028 + cos(uTime * 9.0 - phase * 13.0) * 0.012) * uv.y * sx;
        float stretchY = 1.0 + sin(uTime * 7.5 + phase * 23.0) * 0.035 * uv.y;
        vec3 posWorld = worldCenter + camRight * (position.x * sx + sway) + camUp * (position.y * sy * stretchY);

        float frameIdx = floor(mod(uTime * uFps + phase * uFrameCount, uFrameCount));
        vUv = vec2((uv.x + frameIdx) / uFrameCount, uv.y);
        vAlpha = aFireData.y;

        gl_Position = projectionMatrix * viewMatrix * vec4(posWorld, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec2 vUv;
      varying float vAlpha;

      void main() {
        vec4 tex = texture2D(uMap, vUv);
        if (tex.a < 0.15) discard;
        // All flames render with the authentic pixel-art spritesheet colors (no per-color re-tinting)
        gl_FragColor = vec4(tex.rgb, tex.a * vAlpha);
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
