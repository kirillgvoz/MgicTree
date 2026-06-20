import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  Object3D,
  Vector3,
  AmbientLight,
  DirectionalLight,
  PointLight,
  CircleGeometry,
  MeshBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  CanvasTexture,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  AdditiveBlending,
  Texture,
  InstancedMesh,
  PlaneGeometry,
  DynamicDrawUsage,
  Matrix4,
  DoubleSide,
  NearestFilter,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface TreeScene {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: OrbitControls;
  treeGroup: Object3D;
  enablePixelArt: (on: boolean) => void;
}

const keys: Record<string, boolean> = {};
window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
const panSpeed = 0.15;

function handleKeys(camera: PerspectiveCamera, controls: OrbitControls) {
  const forward = new Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();

  if (keys['w']) controls.target.addScaledVector(forward, panSpeed);
  if (keys['s']) controls.target.addScaledVector(forward, -panSpeed);
  if (keys['a']) controls.target.addScaledVector(right, -panSpeed);
  if (keys['d']) controls.target.addScaledVector(right, panSpeed);
}

function createGround(): Mesh {
  const geometry = new CircleGeometry(14, 48);
  geometry.rotateX(-Math.PI / 2);
  const material = new MeshStandardMaterial({
    color: 0x1a2a10,
    roughness: 0.95,
    metalness: 0.0,
  });
  const mesh = new Mesh(geometry, material);
  mesh.position.y = -0.01;
  mesh.receiveShadow = true;
  return mesh;
}

function createGrass(): InstancedMesh {
  const count = 200000;
  const geometry = new PlaneGeometry(0.02, 0.12);
  geometry.translate(0, 0.075, 0);

  const material = new MeshStandardMaterial({
    side: DoubleSide,
    roughness: 0.8,
    metalness: 0.0,
  });

  const mesh = new InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const dummy = new Matrix4();
  const grassColors = [
    new Color('#3d7a25'), new Color('#4a9030'), new Color('#5aaa38'),
    new Color('#448828'), new Color('#3c7220'), new Color('#508a2a'),
    new Color('#4e9430'), new Color('#5c9e35'), new Color('#488628'),
    new Color('#558c2e'), new Color('#5fa040'), new Color('#4d9230'),
  ];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 13;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    if (Math.sqrt(x * x + z * z) > 12.5) continue;

    const scaleY = 0.5 + Math.random() * 1.0;
    const rotY = Math.random() * Math.PI * 2;
    const leanX = (Math.random() - 0.5) * 0.4;
    const leanZ = (Math.random() - 0.5) * 0.4;

    dummy.identity();
    dummy.makeRotationY(rotY);
    dummy.multiply(new Matrix4().makeRotationX(leanX));
    dummy.multiply(new Matrix4().makeRotationZ(leanZ));
    dummy.multiply(new Matrix4().makeScale(1, scaleY, 1));
    dummy.multiply(new Matrix4().makeTranslation(x, 0, z));

    mesh.setMatrixAt(i, dummy);

    const color = grassColors[Math.floor(Math.random() * grassColors.length)].clone();
    color.multiplyScalar(0.6 + Math.random() * 0.7);
    mesh.setColorAt(i, color);
  }

  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

interface Comet2D {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  trail: { x: number; y: number; a: number }[];
}

let cometCanvas: HTMLCanvasElement;
let cometCtx: CanvasRenderingContext2D;
const comets2d: Comet2D[] = [];
const MAX_COMETS = 4;

function initCometOverlay() {
  cometCanvas = document.createElement('canvas');
  cometCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;';
  document.body.appendChild(cometCanvas);
  cometCtx = cometCanvas.getContext('2d')!;
  resizeCometCanvas();
  window.addEventListener('resize', resizeCometCanvas);
}

function resizeCometCanvas() {
  cometCanvas.width = window.innerWidth;
  cometCanvas.height = window.innerHeight;
}

function spawnComet2D() {
  const side = Math.floor(Math.random() * 4);
  let x: number, y: number, vx: number, vy: number;
  const w = cometCanvas.width, h = cometCanvas.height;
  if (side === 0) { x = -20; y = Math.random() * h; vx = 3 + Math.random() * 4; vy = (Math.random() - 0.5) * 1.5; }
  else if (side === 1) { x = w + 20; y = Math.random() * h; vx = -(3 + Math.random() * 4); vy = (Math.random() - 0.5) * 1.5; }
  else if (side === 2) { y = -20; x = Math.random() * w; vy = 3 + Math.random() * 4; vx = (Math.random() - 0.5) * 1.5; }
  else { y = h + 20; x = Math.random() * w; vy = -(3 + Math.random() * 4); vx = (Math.random() - 0.5) * 1.5; }

  comets2d.push({
    x, y, vx, vy,
    life: 0,
    maxLife: 2 + Math.random() * 3,
    size: 2 + Math.random() * 3,
    trail: [],
  });
}

function updateComets2D() {
  while (comets2d.length < MAX_COMETS && Math.random() < 0.015) {
    spawnComet2D();
  }
  for (let i = comets2d.length - 1; i >= 0; i--) {
    const c = comets2d[i];
    c.life += 0.016;
    c.x += c.vx;
    c.y += c.vy;
    c.trail.unshift({ x: c.x, y: c.y, a: 1 });
    if (c.trail.length > 40) c.trail.pop();
    for (let t = 0; t < c.trail.length; t++) {
      c.trail[t].a *= 0.92;
    }
    if (c.life > c.maxLife || c.x < -100 || c.x > cometCanvas.width + 100 || c.y < -100 || c.y > cometCanvas.height + 100) {
      comets2d.splice(i, 1);
    }
  }
}

function renderComets2D() {
  if (!cometCtx) return;
  cometCtx.clearRect(0, 0, cometCanvas.width, cometCanvas.height);
  for (const c of comets2d) {
    const fade = Math.min(1, (1 - c.life / c.maxLife) * 2);
    for (let t = c.trail.length - 1; t >= 0; t--) {
      const p = c.trail[t];
      const alpha = p.a * fade * 0.6;
      const radius = c.size * (1 - t / c.trail.length) * 0.8;
      cometCtx.fillStyle = `rgba(255,${180 + Math.floor(fade * 50)},${80 + Math.floor(fade * 60)},${alpha})`;
      cometCtx.beginPath();
      cometCtx.fillRect(p.x - radius / 2, p.y - radius / 2, radius, radius);
    }
    const headAlpha = fade;
    const hs = c.size * 1.5;
    cometCtx.fillStyle = `rgba(255,220,150,${headAlpha})`;
    cometCtx.fillRect(c.x - hs / 2, c.y - hs / 2, hs, hs);
  }
}

function createParticles(): Points {
  const count = 600;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 15;

    positions[i * 3] = Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.random() * 6;
    positions[i * 3 + 2] = Math.sin(theta) * r;

    const warmth = Math.random();
    colors[i * 3] = 0.8 + warmth * 0.2;
    colors[i * 3 + 1] = 0.5 + warmth * 0.3;
    colors[i * 3 + 2] = 0.1 + warmth * 0.2;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));

  const material = new PointsMaterial({
    size: 0.08,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  return new Points(geometry, material);
}

function createNebulaTexture(): Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createSquareTexture(): Texture {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

let nebulaMaterial: PointsMaterial | null = null;
const squareTex = createSquareTexture();
const roundTex = createNebulaTexture();

function createNebulaClouds(): Points {
  const clusterCount = 4 + Math.floor(Math.random() * 4);
  const particlesPerCluster = 60 + Math.floor(Math.random() * 80);
  const total = clusterCount * particlesPerCluster;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);

  const nebulaPalette = [
    [0.4, 0.15, 0.08], [0.35, 0.1, 0.2], [0.25, 0.12, 0.05],
    [0.3, 0.18, 0.06], [0.2, 0.08, 0.15], [0.35, 0.2, 0.05],
  ];

  let idx = 0;
  for (let c = 0; c < clusterCount; c++) {
    const cx = (Math.random() - 0.5) * 30;
    const cy = 0.1 + Math.random() * 0.3;
    const cz = (Math.random() - 0.5) * 30;
    const spreadX = 3 + Math.random() * 6;
    const spreadY = 0.1 + Math.random() * 0.2;
    const spreadZ = 3 + Math.random() * 6;

    const baseColor = nebulaPalette[Math.floor(Math.random() * nebulaPalette.length)];
    const bright = 0.5 + Math.random() * 0.5;

    for (let i = 0; i < particlesPerCluster; i++) {
      const u1 = Math.random(), u2 = Math.random(), u3 = Math.random();
      const gx = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2) * spreadX;
      const gy = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.sin(2 * Math.PI * u2) * spreadY;
      const gz = (u3 - 0.5) * 2 * spreadZ;

      positions[idx * 3] = cx + gx;
      positions[idx * 3 + 1] = cy + gy;
      positions[idx * 3 + 2] = cz + gz;

      const variation = 0.5 + Math.random() * 0.5;
      colors[idx * 3] = baseColor[0] * variation * bright;
      colors[idx * 3 + 1] = baseColor[1] * variation * bright;
      colors[idx * 3 + 2] = baseColor[2] * variation * bright;
      idx++;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));

  nebulaMaterial = new PointsMaterial({
    size: 3.0,
    map: roundTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.4,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  return new Points(geometry, nebulaMaterial);
}

function getCameraDistance(): number {
  return window.innerWidth < 768 ? 16 : 10;
}

function getCameraY(): number {
  return window.innerWidth < 768 ? 8 : 5;
}

const PIXEL_SCALE = 3;

export function createScene(canvas: HTMLCanvasElement): TreeScene {
  const scene = new Scene();
  scene.background = new Color('#020204');

  const camera = new PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  camera.position.set(4, getCameraY(), getCameraDistance());
  camera.lookAt(0, 2.5, 0);

  let pixelOn = true;

  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
  });
  const pixW = Math.floor(window.innerWidth / PIXEL_SCALE);
  const pixH = Math.floor(window.innerHeight / PIXEL_SCALE);
  renderer.setSize(pixW, pixH, false);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  renderer.setPixelRatio(1);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 3;
  controls.maxDistance = 25;
  controls.enablePan = true;
  controls.autoRotate = false;
  controls.target.set(0, 2.5, 0);

  const ambientLight = new AmbientLight(0x443322);
  scene.add(ambientLight);

  const sunLight = new DirectionalLight(0xffeedd, 0.8);
  sunLight.position.set(5, 10, 3);
  scene.add(sunLight);

  const warmLight = new PointLight(0xffaa44, 0.3, 20);
  warmLight.position.set(0, 4, 0);
  scene.add(warmLight);

  const treeGroup = new Object3D();
  scene.add(treeGroup);

  const ground = createGround();
  scene.add(ground);

  const grass = createGrass();
  scene.add(grass);

  const particles = createParticles();
  scene.add(particles);

  const nebulae = createNebulaClouds();
  scene.add(nebulae);

  initCometOverlay();

  function enablePixelArt(on: boolean) {
    pixelOn = on;
    setPixelArtParticles(on);
    if (on) {
      const pw = Math.floor(window.innerWidth / PIXEL_SCALE);
      const ph = Math.floor(window.innerHeight / PIXEL_SCALE);
      renderer.setSize(pw, ph, false);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    } else {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    }
  }

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    enablePixelArt(pixelOn);
  };

  window.addEventListener('resize', onResize);

  return { scene, camera, renderer, controls, treeGroup, enablePixelArt };
}

export function tickComets() {
  updateComets2D();
  renderComets2D();
}

export function setPixelArtParticles(on: boolean) {
  if (nebulaMaterial) {
    nebulaMaterial.map = on ? squareTex : roundTex;
    nebulaMaterial.needsUpdate = true;
  }
}
