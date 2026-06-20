import { Matrix4, Vector3, Color } from 'three';
import { createScene, tickComets } from './renderer';
import { getTreeData, getLeavesForCount, resetPool, getCurrentParams } from './tree';
import { createLeafMesh, updateLeafMesh, createBranchMesh, updateBranchMesh, createTrunkMesh } from './treeRenderer';
import { createUI } from './ui';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas element not found');

const treeScene = createScene(canvas);

const treeData = getTreeData();
let trunkMesh = createTrunkMesh(treeData.trunk);
treeScene.treeGroup.add(trunkMesh);

let connectionsMesh = createTrunkMesh([]);
treeScene.treeGroup.add(connectionsMesh);

const leafMesh = createLeafMesh();
treeScene.treeGroup.add(leafMesh);

const branchMesh = createBranchMesh();
treeScene.treeGroup.add(branchMesh);

const FALLING_COUNT = 12;
const fallingLeafMesh = createLeafMesh();
treeScene.treeGroup.add(fallingLeafMesh);

const GOLD_FALLING = [
  new Color('#FFD700'), new Color('#FFC107'), new Color('#FFB300'),
  new Color('#FFA000'), new Color('#FFCC33'), new Color('#FFBF00'),
  new Color('#FFD54F'), new Color('#FFE082'), new Color('#FFF176'),
  new Color('#FF8F00'), new Color('#FFB900'), new Color('#E6B800'),
];

interface FallingLeaf {
  startPos: Vector3;
  progress: number;
  speed: number;
  rotSpeed: number;
  driftX: number;
  driftZ: number;
}

let fallingLeaves: FallingLeaf[] = [];
const dummyFalling = new Matrix4();

function spawnFallingLeaf() {
  fallingLeaves.push({
    startPos: new Vector3((Math.random() - 0.5) * 3, 3 + Math.random() * 3, (Math.random() - 0.5) * 3),
    progress: 0,
    speed: 0.001 + Math.random() * 0.002,
    rotSpeed: (Math.random() - 0.5) * 0.08,
    driftX: (Math.random() - 0.5) * 0.3,
    driftZ: (Math.random() - 0.5) * 0.3,
  });
}

function updateFallingLeaves() {
  if (fallingLeaves.length < FALLING_COUNT && Math.random() < 0.05) spawnFallingLeaf();

  fallingLeaves = fallingLeaves.filter(fl => {
    fl.progress += fl.speed;
    return fl.progress < 1;
  });

  for (let i = 0; i < fallingLeaves.length; i++) {
    const fl = fallingLeaves[i];
    const t = fl.progress;
    const y = fl.startPos.y * (1 - t);
    const x = fl.startPos.x + Math.sin(t * 6 + fl.rotSpeed * 50) * 0.3 + fl.driftX * t;
    const z = fl.startPos.z + Math.cos(t * 5 + fl.rotSpeed * 30) * 0.3 + fl.driftZ * t;

    dummyFalling.identity();
    dummyFalling.makeRotationY(t * fl.rotSpeed * 100);
    dummyFalling.multiply(new Matrix4().makeScale(0.06, 0.02, 0.05));
    dummyFalling.setPosition(x, y, z);
    fallingLeafMesh.setMatrixAt(i, dummyFalling);
    fallingLeafMesh.setColorAt(i, GOLD_FALLING[i % GOLD_FALLING.length]);
  }
  fallingLeafMesh.count = fallingLeaves.length;
  fallingLeafMesh.instanceMatrix.needsUpdate = true;
  if (fallingLeafMesh.instanceColor) fallingLeafMesh.instanceColor.needsUpdate = true;
}

let currentLeafCount = 3000;

function setLeafCount(count: number) {
  currentLeafCount = count;
  const scale = Math.pow(Math.max(count, 1) / 5000, 1 / 3);
  treeScene.treeGroup.scale.setScalar(scale);

  const { branches, leaves, connections } = getLeavesForCount(count);
  updateLeafMesh(leafMesh, leaves);
  updateBranchMesh(branchMesh, branches);

  treeScene.treeGroup.remove(connectionsMesh);
  connectionsMesh.geometry.dispose();
  (connectionsMesh.material as any).dispose();
  connectionsMesh = createTrunkMesh(connections);
  treeScene.treeGroup.add(connectionsMesh);
}

function refreshAll() {
  resetPool();
  getTreeData();

  treeScene.treeGroup.remove(trunkMesh);
  trunkMesh.geometry.dispose();
  (trunkMesh.material as any).dispose();
  trunkMesh = createTrunkMesh(getTreeData().trunk);
  treeScene.treeGroup.add(trunkMesh);

  const count = getCurrentParams()?.leafCount ?? 0;
  const { branches, leaves, connections } = getLeavesForCount(count);
  updateLeafMesh(leafMesh, leaves);
  updateBranchMesh(branchMesh, branches);

  treeScene.treeGroup.remove(connectionsMesh);
  connectionsMesh.geometry.dispose();
  (connectionsMesh.material as any).dispose();
  connectionsMesh = createTrunkMesh(connections);
  treeScene.treeGroup.add(connectionsMesh);

  fallingLeaves = [];
}

let addLeaves: (delta: number) => void;

const { leafCount, onAddLeaves } = createUI(setLeafCount, refreshAll, getCurrentParams, treeScene.enablePixelArt);
addLeaves = onAddLeaves;
setLeafCount(leafCount);

canvas.addEventListener('pointerdown', () => addLeaves(10));
canvas.addEventListener('wheel', () => addLeaves(10));

function animateLoop() {
  updateFallingLeaves();
  tickComets();
  const { scene, camera, renderer, controls } = treeScene;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animateLoop);
}
animateLoop();
