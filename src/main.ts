import { Matrix4, Vector3, Color } from 'three';
import { createScene } from './renderer';
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
  const start = new Vector3(
    (Math.random() - 0.5) * 3,
    3 + Math.random() * 3,
    (Math.random() - 0.5) * 3,
  );
  fallingLeaves.push({
    startPos: start,
    progress: 0,
    speed: 0.001 + Math.random() * 0.002,
    rotSpeed: (Math.random() - 0.5) * 0.08,
    driftX: (Math.random() - 0.5) * 0.3,
    driftZ: (Math.random() - 0.5) * 0.3,
  });
}

function updateFallingLeaves() {
  if (fallingLeaves.length < FALLING_COUNT && Math.random() < 0.05) {
    spawnFallingLeaf();
  }

  const alive: FallingLeaf[] = [];
  for (const fl of fallingLeaves) {
    fl.progress += fl.speed;
    if (fl.progress >= 1) continue;
    alive.push(fl);
  }
  fallingLeaves = alive;

  for (let i = 0; i < fallingLeaves.length; i++) {
    const fl = fallingLeaves[i];
    const t = fl.progress;
    const y = fl.startPos.y * (1 - t);
    const x = fl.startPos.x + Math.sin(t * 6 + fl.rotSpeed * 50) * 0.3 + fl.driftX * t;
    const z = fl.startPos.z + Math.cos(t * 5 + fl.rotSpeed * 30) * 0.3 + fl.driftZ * t;
    const rot = t * fl.rotSpeed * 100;

    const sx = 0.06, sy = 0.02, sz = 0.05;
    const scaleMatrix = new Matrix4().makeScale(sx, sy, sz);
    const rotMatrix = new Matrix4().makeRotationY(rot);
    const translateMatrix = new Matrix4().makeTranslation(x, y, z);

    dummyFalling.multiplyMatrices(translateMatrix, rotMatrix);
    dummyFalling.multiply(scaleMatrix);
    fallingLeafMesh.setMatrixAt(i, dummyFalling);

    const color = GOLD_FALLING[i % GOLD_FALLING.length];
    fallingLeafMesh.setColorAt(i, color);
  }
  fallingLeafMesh.count = fallingLeaves.length;
  fallingLeafMesh.instanceMatrix.needsUpdate = true;
  if (fallingLeafMesh.instanceColor) fallingLeafMesh.instanceColor.needsUpdate = true;
}

function setLeafCount(count: number) {
  const scale = Math.pow(count / 5000, 1 / 3);
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

  const count = getCurrentParams()?.leafCount ?? 8000;
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

const { leafCount } = createUI(setLeafCount, refreshAll, getCurrentParams);
setLeafCount(leafCount);

function animateLoop() {
  updateFallingLeaves();
  const { scene, camera, renderer, controls } = treeScene;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animateLoop);
}
animateLoop();
