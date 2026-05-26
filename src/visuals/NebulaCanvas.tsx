import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Palette, VisualSettings } from "../types";

type NebulaCanvasProps = {
  settings: VisualSettings;
  palette: Palette;
};

type ParticlePayload = {
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  points: THREE.Points;
};

const vertexShader = `
  attribute float size;
  attribute float phase;
  attribute float arm;
  varying vec3 vColor;
  varying float vGlow;
  uniform float uTime;
  uniform float uWarp;
  uniform float uPixelRatio;

  mat2 rotate2d(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
  }

  void main() {
    vec3 p = position;
    float radius = length(p.xz);
    float breath = sin(uTime * 0.7 + phase + radius * 0.18);
    float flare = cos(uTime * 0.42 + arm * 1.7 + radius * 0.08);
    float twist = uTime * (0.045 + uWarp * 0.075) + radius * (0.008 + uWarp * 0.015);

    p.xz = rotate2d(twist + breath * 0.025 * uWarp) * p.xz;
    p.y += breath * (0.18 + uWarp * 0.52) + flare * uWarp * 0.2;
    p.xz *= 1.0 + sin(uTime * 0.34 + phase) * 0.018 * uWarp;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float depthScale = 190.0 / max(24.0, -mvPosition.z);
    gl_PointSize = clamp(size * uPixelRatio * depthScale, 0.45, 9.0);
    vColor = color;
    vGlow = clamp(1.0 - radius / 54.0, 0.0, 1.0);
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vGlow;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.18, 0.0, d);
    float halo = smoothstep(0.5, 0.06, d);
    float alpha = clamp(core * 0.32 + halo * (0.032 + vGlow * 0.058), 0.0, 0.62);

    if (alpha < 0.015) {
      discard;
    }

    vec3 color = vColor * (0.5 + core * 0.74 + vGlow * 0.3);
    gl_FragColor = vec4(color, alpha);
  }
`;

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number) {
  let u = 0;
  let v = 0;

  while (u === 0) u = rand();
  while (v === 0) v = rand();

  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function mixColor(a: THREE.Color, b: THREE.Color, amount: number) {
  return a.clone().lerp(b, THREE.MathUtils.clamp(amount, 0, 1));
}

function createParticleField(count: number, seed: number, palette: Palette, pixelRatio: number): ParticlePayload {
  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const arms = new Float32Array(count);

  const colorA = new THREE.Color(palette.colors[0]);
  const colorB = new THREE.Color(palette.colors[1]);
  const colorC = new THREE.Color(palette.colors[2]);
  const centerColor = mixColor(new THREE.Color(palette.colors[2]), new THREE.Color(palette.glow), 0.45);
  const armCount = 5;

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const radius = 1.4 + Math.pow(rand(), 1.34) * 52.6;
    const arm = Math.floor(rand() * armCount);
    const armOffset = (arm / armCount) * Math.PI * 2;
    const spin = radius * 0.28;
    const scatter = 0.34 + radius * 0.045;
    const angle = armOffset + spin + gaussian(rand) * 0.18;
    const halo = rand() > 0.82;

    const lateral = gaussian(rand) * scatter * (halo ? 2.9 : 1);
    const vertical = gaussian(rand) * (0.18 + radius * 0.025) * (halo ? 2.4 : 1);
    const x = Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * lateral;
    const z = Math.sin(angle) * radius + Math.sin(angle + Math.PI / 2) * lateral;

    positions[i3] = x;
    positions[i3 + 1] = vertical + Math.sin(angle * 2.0 + radius) * 0.24;
    positions[i3 + 2] = z;
    phases[i] = rand() * Math.PI * 2;
    arms[i] = arm;
    sizes[i] = (halo ? 0.55 : 0.82) + Math.pow(rand(), 5) * 2.8 + (1 - radius / 54) * 1.2;

    const band = radius / 54;
    const base = band < 0.42 ? mixColor(centerColor, colorA, band / 0.42) : mixColor(colorA, colorB, (band - 0.42) / 0.58);
    const finalColor = base.lerp(colorC, Math.pow(rand(), 7) * 0.55);
    finalColor.multiplyScalar(0.18 + rand() * 0.36);

    colors[i3] = finalColor.r;
    colors[i3 + 1] = finalColor.g;
    colors[i3 + 2] = finalColor.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("arm", new THREE.BufferAttribute(arms, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWarp: { value: 0 },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader,
    fragmentShader,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return { geometry, material, points };
}

function createRibbon(seed: number, palette: Palette) {
  const rand = mulberry32(seed);
  const group = new THREE.Group();
  const colors = palette.colors.map((color) => new THREE.Color(color));

  for (let i = 0; i < 7; i += 1) {
    const points: THREE.Vector3[] = [];
    const radius = 11 + rand() * 33;
    const yShift = -2 + rand() * 4;
    const phase = rand() * Math.PI * 2;

    for (let j = 0; j < 92; j += 1) {
      const t = (j / 91) * Math.PI * 2;
      const pulse = Math.sin(t * (2 + i * 0.24) + phase) * (1.8 + rand() * 0.2);
      points.push(
        new THREE.Vector3(
          Math.cos(t) * (radius + pulse),
          yShift + Math.sin(t * 3 + phase) * (1.4 + i * 0.09),
          Math.sin(t) * (radius * 0.58 + pulse),
        ),
      );
    }

    const curve = new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.45);
    const geometry = new THREE.TubeGeometry(curve, 180, 0.018 + i * 0.004, 6, true);
    const material = new THREE.MeshBasicMaterial({
      color: colors[i % colors.length],
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = rand() * Math.PI;
    mesh.rotation.z = rand() * Math.PI;
    mesh.userData.speed = 0.04 + rand() * 0.08;
    group.add(mesh);
  }

  return group;
}

function createCore(palette: Palette) {
  const group = new THREE.Group();
  const glow = new THREE.Color(palette.glow);
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.2, 5),
    new THREE.MeshBasicMaterial({
      color: glow,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      wireframe: true,
    }),
  );
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.18, 6),
    new THREE.MeshBasicMaterial({
      color: glow,
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
    }),
  );
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: glow,
    transparent: true,
    opacity: 0.36,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(5.8, 0.035, 8, 280), ringMaterial);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(8.4, 0.022, 8, 280), ringMaterial.clone());
  ringA.rotation.x = Math.PI * 0.58;
  ringB.rotation.x = Math.PI * 0.42;
  ringB.rotation.y = Math.PI * 0.32;

  group.add(shell, core, ringA, ringB);
  return group;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}

export function NebulaCanvas({ settings, palette }: NebulaCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef(settings);
  const paletteRef = useRef(palette);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    paletteRef.current = palette;
  }, [palette]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2("#05060b", 0.017);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.78;
    renderer.setClearColor("#05060b", 1);
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
    camera.position.set(0, 16, 72);

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), settingsRef.current.bloom, 0.55, 0.14);
    const outputPass = new OutputPass();
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);

    const clock = new THREE.Clock();
    const pointer = new THREE.Vector2(0, 0);
    const smoothPointer = new THREE.Vector2(0, 0);
    const root = new THREE.Group();
    scene.add(root);

    let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    let particlePayload = createParticleField(settingsRef.current.particles, settingsRef.current.seed, paletteRef.current, pixelRatio);
    let ribbons = createRibbon(settingsRef.current.seed + 100, paletteRef.current);
    let core = createCore(paletteRef.current);
    root.add(particlePayload.points, ribbons, core);

    let lastSeed = settingsRef.current.seed;
    let lastCount = settingsRef.current.particles;
    let lastPalette = paletteRef.current.name;
    let raf = 0;

    const resize = () => {
      const width = mount.clientWidth || window.innerWidth;
      const height = mount.clientHeight || window.innerHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, width < 700 ? 1.5 : 2);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      particlePayload.material.uniforms.uPixelRatio.value = pixelRatio;
    };

    const rebuild = () => {
      root.remove(particlePayload.points, ribbons, core);
      particlePayload.geometry.dispose();
      particlePayload.material.dispose();
      disposeObject(ribbons);
      disposeObject(core);

      particlePayload = createParticleField(settingsRef.current.particles, settingsRef.current.seed, paletteRef.current, pixelRatio);
      ribbons = createRibbon(settingsRef.current.seed + 100, paletteRef.current);
      core = createCore(paletteRef.current);
      root.add(particlePayload.points, ribbons, core);

      lastSeed = settingsRef.current.seed;
      lastCount = settingsRef.current.particles;
      lastPalette = paletteRef.current.name;
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * -2;
    };

    const animate = () => {
      raf = window.requestAnimationFrame(animate);

      const activeSettings = settingsRef.current;
      if (
        activeSettings.seed !== lastSeed ||
        activeSettings.particles !== lastCount ||
        paletteRef.current.name !== lastPalette
      ) {
        rebuild();
      }

      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      const speed = activeSettings.paused ? 0 : activeSettings.speed;
      const time = elapsed * speed;
      smoothPointer.lerp(pointer, 0.065);

      particlePayload.material.uniforms.uTime.value = time;
      particlePayload.material.uniforms.uWarp.value = activeSettings.warp;

      root.rotation.y += delta * speed * (0.035 + activeSettings.warp * 0.025);
      root.rotation.x = smoothPointer.y * 0.08;
      root.rotation.z = smoothPointer.x * -0.08;

      ribbons.children.forEach((child, index) => {
        child.rotation.y += delta * speed * (child.userData.speed + activeSettings.warp * 0.03);
        child.rotation.x += Math.sin(time * 0.12 + index) * 0.0008;
      });

      core.rotation.x += delta * speed * 0.19;
      core.rotation.y -= delta * speed * 0.25;
      const pulse = 1 + Math.sin(time * 1.5) * 0.045 + activeSettings.warp * 0.06;
      core.scale.setScalar(pulse);

      if (activeSettings.cinematic) {
        const orbitRadius = 69 - activeSettings.warp * 12;
        camera.position.x = Math.sin(time * 0.075) * 18 + smoothPointer.x * 5;
        camera.position.y = 14 + Math.sin(time * 0.11) * 4 + smoothPointer.y * 3;
        camera.position.z = orbitRadius + Math.cos(time * 0.06) * 10;
      } else {
        camera.position.x += (smoothPointer.x * 10 - camera.position.x) * 0.045;
        camera.position.y += (16 + smoothPointer.y * 6 - camera.position.y) * 0.045;
        camera.position.z += (72 - camera.position.z) * 0.045;
      }

      camera.lookAt(0, 0, 0);
      bloomPass.strength = activeSettings.bloom;
      bloomPass.radius = 0.32 + activeSettings.warp * 0.22;
      bloomPass.threshold = 0.18 + Math.max(0, 1.1 - activeSettings.bloom) * 0.05;

      composer.render();
    };

    resize();
    window.addEventListener("resize", resize);
    mount.addEventListener("pointermove", onPointerMove);
    animate();

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      mount.removeEventListener("pointermove", onPointerMove);
      root.remove(particlePayload.points, ribbons, core);
      particlePayload.geometry.dispose();
      particlePayload.material.dispose();
      disposeObject(ribbons);
      disposeObject(core);
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="canvas-root" ref={mountRef} aria-hidden="true" />;
}
