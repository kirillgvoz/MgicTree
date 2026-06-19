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
  CanvasTexture,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  AdditiveBlending,
  Texture,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface TreeScene {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: OrbitControls;
  treeGroup: Object3D;
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
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );
  gradient.addColorStop(0, '#2a2015');
  gradient.addColorStop(0.3, '#1a1510');
  gradient.addColorStop(0.7, '#0d0b08');
  gradient.addColorStop(1, '#050403');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;

  const geometry = new CircleGeometry(12, 48);
  geometry.rotateX(-Math.PI / 2);
  const material = new MeshBasicMaterial({ map: texture });
  const mesh = new Mesh(geometry, material);
  mesh.position.y = -0.01;
  return mesh;
}

function createParticles(): Points {
  const count = 600;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 8 + Math.random() * 15;

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.random() * 6;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const warmth = Math.random();
    colors[i * 3] = 0.8 + warmth * 0.2;
    colors[i * 3 + 1] = 0.5 + warmth * 0.3;
    colors[i * 3 + 2] = 0.1 + warmth * 0.2;

    sizes[i] = 0.03 + Math.random() * 0.06;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));

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

function createNebulaClouds(): Points {
  const clusterCount = 4 + Math.floor(Math.random() * 4);
  const particlesPerCluster = 60 + Math.floor(Math.random() * 80);
  const total = clusterCount * particlesPerCluster;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);

  const nebulaPalette = [
    [0.4, 0.15, 0.08],
    [0.35, 0.1, 0.2],
    [0.25, 0.12, 0.05],
    [0.3, 0.18, 0.06],
    [0.2, 0.08, 0.15],
    [0.35, 0.2, 0.05],
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

  const material = new PointsMaterial({
    size: 3.0,
    map: createNebulaTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.4,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  return new Points(geometry, material);
}

function getCameraDistance(): number {
  const isMobile = window.innerWidth < 768;
  return isMobile ? 16 : 10;
}

function getCameraY(): number {
  const isMobile = window.innerWidth < 768;
  return isMobile ? 8 : 5;
}

export function createScene(canvas: HTMLCanvasElement): TreeScene {
  const scene = new Scene();
  scene.background = new Color('#080604');

  const camera = new PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  camera.position.set(4, getCameraY(), getCameraDistance());
  camera.lookAt(0, 2.5, 0);

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 3;
  controls.maxDistance = 25;
  controls.enablePan = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.4;
  controls.target.set(0, 2.5, 0);

  const treeGroup = new Object3D();
  scene.add(treeGroup);

  const ground = createGround();
  scene.add(ground);

  const particles = createParticles();
  scene.add(particles);

  const nebulae = createNebulaClouds();
  scene.add(nebulae);

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  };

  window.addEventListener('resize', onResize);

  return { scene, camera, renderer, controls, treeGroup };
}

export function animate(treeScene: TreeScene): void {
  const { scene, camera, renderer, controls } = treeScene;
  handleKeys(camera, controls);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(() => animate(treeScene));
}
