import { Color, Vector3 } from 'three';
import { TreeSegment, Leaf, BranchData, TreeParams } from './types';

const GOLD_PALETTE = [
  new Color('#FFD700'), new Color('#FFDF00'), new Color('#FFC200'),
  new Color('#FFE44D'), new Color('#FFF68F'), new Color('#FFCC33'),
  new Color('#FFBF00'), new Color('#FFB900'), new Color('#FFAA00'),
  new Color('#FFD54F'), new Color('#FFE082'), new Color('#FFF176'),
];

const TRUNK_COLOR = new Color('#111111');
const BRANCH_COLOR = new Color('#1a1612');
const LEAVES_PER_BRANCH_MAX = 8;
const LEAVES_PER_BRANCH_MIN = 4;
const ACTIVE_BRANCHES = 16;

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng: () => number = Math.random;
let currentSeed = 0;
let currentParams: TreeParams | null = null;

const MAX_LEAVES = 15000;
const MIN_NORMAL_Y = Math.sin(Math.PI / 3);

function rand(min: number, max: number): number {
  return rng() * (max - min) + min;
}

function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function getCurrentParams(): TreeParams | null {
  return currentParams;
}

export function resetPool(): void {
  branchPool = null;
  cachedTrunk = null;
  cachedBranches = null;
  cachedLeaves = null;
}

// ── ELLIPSOID ──

interface Ellipsoid {
  f1: Vector3;
  f2: Vector3;
  a: number;
  b: number;
  axisA: Vector3;
  axisB: Vector3;
  axisC: Vector3;
}

function createEllipsoid(f1: Vector3, f2: Vector3, semiMajor: number): Ellipsoid {
  const focalDir = f2.clone().sub(f1);
  const focalDist = focalDir.length();
  const c = focalDist / 2;
  const minA = c / Math.sqrt(0.75);
  const a = Math.max(semiMajor, minA);
  const b = Math.sqrt(Math.max(0.01, a * a - c * c));
  focalDir.normalize();
  let up = new Vector3(0, 1, 0);
  if (Math.abs(focalDir.dot(up)) > 0.99) up = new Vector3(1, 0, 0);
  const axisB = new Vector3().crossVectors(focalDir, up).normalize();
  const axisC = new Vector3().crossVectors(focalDir, axisB).normalize();
  return { f1: f1.clone(), f2: f2.clone(), a, b, axisA: focalDir, axisB, axisC };
}

function isInsideEllipsoid(p: Vector3, e: Ellipsoid): boolean {
  return p.distanceTo(e.f1) + p.distanceTo(e.f2) < e.a * 2;
}

function ellipsoidSurfacePoint(e: Ellipsoid): { pos: Vector3; normal: Vector3 } {
  const theta = rng() * Math.PI * 2;
  const phi = Math.acos(2 * rng() - 1);
  const local = new Vector3(
    e.a * Math.sin(phi) * Math.cos(theta),
    e.b * Math.sin(phi) * Math.sin(theta),
    e.b * Math.cos(phi),
  );
  const center = e.f1.clone().add(e.f2).multiplyScalar(0.5);
  const pos = new Vector3(
    center.x + local.x * e.axisA.x + local.y * e.axisB.x + local.z * e.axisC.x,
    center.y + local.x * e.axisA.y + local.y * e.axisB.y + local.z * e.axisC.y,
    center.z + local.x * e.axisA.z + local.y * e.axisB.z + local.z * e.axisC.z,
  );
  const n1 = pos.clone().sub(e.f1).normalize();
  const n2 = pos.clone().sub(e.f2).normalize();
  const normal = n1.add(n2).normalize();
  return { pos, normal };
}

function isOnOuterSurface(p: Vector3, ownerIdx: number, ellipsoids: Ellipsoid[]): boolean {
  for (let j = 0; j < ellipsoids.length; j++) {
    if (j === ownerIdx) continue;
    if (isInsideEllipsoid(p, ellipsoids[j])) return false;
  }
  return true;
}

// ── CROWN ──

interface BranchPosition {
  center: Vector3;
  normal: Vector3;
  ellipsoidIdx: number;
  smallAxis: number;
  largeAxis: number;
}

let currentEllipsoids: Ellipsoid[] = [];
let branchPool: BranchPosition[] | null = null;

function generateEllipsoids(trunkTop: Vector3, scale: number): Ellipsoid[] {
  const ellipsoids: Ellipsoid[] = [];
  const baseRadius = (0.8 + rng() * 0.7) * scale;
  const regularCount = 1 + Math.floor(rng() * 5);
  for (let i = 0; i < regularCount; i++) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const angle = rand(0, Math.PI * 2);
      const dist = rand(baseRadius, baseRadius * 2.5);
      const upDist = rand(0.3, 1.5) * scale;
      const f2 = new Vector3(
        trunkTop.x + Math.cos(angle) * dist,
        trunkTop.y + upDist,
        trunkTop.z + Math.sin(angle) * dist,
      );
      let insideAny = false;
      for (const e of ellipsoids) {
        if (isInsideEllipsoid(f2, e)) { insideAny = true; break; }
      }
      if (insideAny) continue;
      ellipsoids.push(createEllipsoid(trunkTop, f2, rand(0.75, 1.5) * scale));
      break;
    }
  }

  for (let attempt = 0; attempt < 100; attempt++) {
    const vDist = rand(1.5, 4.0) * scale;
    const vF2 = new Vector3(trunkTop.x, trunkTop.y + vDist, trunkTop.z);
    let insideAny = false;
    for (const e of ellipsoids) {
      if (isInsideEllipsoid(vF2, e)) { insideAny = true; break; }
    }
    if (insideAny) continue;
    const minA = (vDist / 2) / Math.sqrt(1 - 0.55 * 0.55);
    const semiMajor = Math.max(minA, rand(0.75, 1.5) * scale);
    ellipsoids.push(createEllipsoid(trunkTop, vF2, semiMajor));
    break;
  }

  return ellipsoids;
}

function generateBranchPool(trunkTop: Vector3, ellipsoids: Ellipsoid[]): BranchPosition[] {
  const pool: BranchPosition[] = [];
  const needed = Math.ceil(MAX_LEAVES / 4) + 50;
  const candidatesPer = 12;
  for (let i = 0; i < needed * candidatesPer && pool.length < needed; i++) {
    const ei = Math.floor(rng() * ellipsoids.length);
    const e = ellipsoids[ei];
    const { pos, normal } = ellipsoidSurfacePoint(e);
    if (pos.y < trunkTop.y && Math.abs(normal.y) > MIN_NORMAL_Y) continue;
    if (!isOnOuterSurface(pos, ei, ellipsoids)) continue;
    pool.push({ center: pos, normal, ellipsoidIdx: ei, smallAxis: e.b, largeAxis: e.a });
  }
  while (pool.length < needed) {
    const ei = Math.floor(rng() * ellipsoids.length);
    const e = ellipsoids[ei];
    const { pos, normal } = ellipsoidSurfacePoint(e);
    if (pos.y < trunkTop.y && Math.abs(normal.y) > MIN_NORMAL_Y) continue;
    pool.push({ center: pos, normal, ellipsoidIdx: ei, smallAxis: e.b, largeAxis: e.a });
  }
  return pool;
}

// ── TRUNK ──

function makeTrunk(params: TreeParams): TreeSegment[] {
  const segments: TreeSegment[] = [];
  const h = 0.25;
  const count = Math.ceil(params.trunkHeight / h);
  let x = 0, y = 0, z = 0;
  let dx = gaussianRandom() * 0.02;
  let dz = gaussianRandom() * 0.02;
  for (let i = 0; i < count; i++) {
    const r = params.trunkRadius * (1 - (i / count) * 0.5);
    const sx = x, sy = y, sz = z;
    dx += gaussianRandom() * 0.04;
    dz += gaussianRandom() * 0.04;
    dx *= 0.9;
    dz *= 0.9;
    x += dx * h;
    y += h;
    z += dz * h;
    segments.push({ start: new Vector3(sx, sy, sz), end: new Vector3(x, y, z), radius: r, color: TRUNK_COLOR.clone() });
    if (params.relief > 0.1) {
      const bumps = 1 + Math.floor(rng() * 2);
      for (let b = 0; b < bumps; b++) {
        if (rng() > params.relief * 0.5) continue;
        const bt = rng();
        const bx = sx + (x - sx) * bt;
        const by = sy + (y - sy) * bt;
        const bz = sz + (z - sz) * bt;
        const angle = rng() * Math.PI * 2;
        const len = r * (0.15 + rng() * 0.3) * params.relief;
        const nr = r * (0.1 + rng() * 0.15);
        segments.push({
          start: new Vector3(bx, by, bz),
          end: new Vector3(bx + Math.cos(angle) * len, by + gaussianRandom() * len * 0.3, bz + Math.sin(angle) * len),
          radius: nr, color: TRUNK_COLOR.clone(),
        });
      }
    }
  }
  return segments;
}

// ── BRANCHES + LEAVES (hedgehog system) ──

interface ActiveBranch {
  poolIdx: number;
  leafCount: number;
  maxLeaves: number;
}

interface ComputedState {
  branches: BranchData[];
  leaves: Leaf[];
  connections: TreeSegment[];
}

let poolIdxCounter = 0;

function computeState(leafCount: number, pool: BranchPosition[]): ComputedState {
  const active: ActiveBranch[] = [];
  const completePoolIdxs: number[] = [];
  const completeLeafCounts: number[] = [];
  poolIdxCounter = 0;

  const result: ComputedState = { branches: [], leaves: [], connections: [] };

  for (let n = 0; n < leafCount; n++) {
    if (active.length < ACTIVE_BRANCHES) {
      const maxL = LEAVES_PER_BRANCH_MIN + Math.floor(rng() * (LEAVES_PER_BRANCH_MAX - LEAVES_PER_BRANCH_MIN + 1));
      active.push({ poolIdx: poolIdxCounter++, leafCount: 0, maxLeaves: maxL });
    }

    let minIdx = 0;
    for (let j = 1; j < active.length; j++) {
      if (active[j].leafCount < active[minIdx].leafCount) minIdx = j;
    }

    active[minIdx].leafCount++;

    if (active[minIdx].leafCount >= active[minIdx].maxLeaves) {
      completePoolIdxs.push(active[minIdx].poolIdx);
      completeLeafCounts.push(active[minIdx].maxLeaves);
      active[minIdx] = {
        poolIdx: poolIdxCounter++,
        leafCount: 0,
        maxLeaves: LEAVES_PER_BRANCH_MIN + Math.floor(rng() * (LEAVES_PER_BRANCH_MAX - LEAVES_PER_BRANCH_MIN + 1)),
      };
    }
  }

  function makeBranchAndLeaves(pos: BranchPosition, count: number) {
    const length = Math.min(pos.smallAxis * 1.2, rand(0.25, 0.75));
    const width = length * rand(0.012, 0.024);

    const tiltAngle = rand(0, Math.PI / 12);
    const tiltDir = rand(0, Math.PI * 2);
    let up = new Vector3(0, 1, 0);
    if (Math.abs(pos.normal.dot(up)) > 0.99) up = new Vector3(1, 0, 0);
    const right = new Vector3().crossVectors(up, pos.normal).normalize();
    up = new Vector3().crossVectors(pos.normal, right).normalize();
    const tiltedNormal = pos.normal.clone()
      .addScaledVector(right, Math.sin(tiltAngle) * Math.cos(tiltDir))
      .addScaledVector(up, Math.sin(tiltAngle) * Math.sin(tiltDir))
      .normalize();

    result.branches.push({ center: pos.center, normal: tiltedNormal, length, width });

    for (let l = 0; l < count; l++) {
      const t = (l + 0.5) / count;
      const alongBranch = tiltedNormal.clone().multiplyScalar(t * length);

      const dispR = (rng() - 0.5) * width * 24;
      const dispU = (rng() - 0.5) * width * 24;
      const dispersion = right.clone().multiplyScalar(dispR).add(up.clone().multiplyScalar(dispU));

      const leafPos = pos.center.clone().add(alongBranch).add(dispersion);
      const color = GOLD_PALETTE[Math.floor(rng() * GOLD_PALETTE.length)].clone().multiplyScalar(0.85 + rng() * 0.3);

      const flatAxis = Math.floor(rng() * 3);
      const sx = flatAxis === 0 ? 0.045 + rng() * 0.06 : 0.09 + rng() * 0.09;
      const sy = flatAxis === 1 ? 0.045 + rng() * 0.06 : 0.09 + rng() * 0.09;
      const sz = flatAxis === 2 ? 0.045 + rng() * 0.06 : 0.09 + rng() * 0.09;

      result.leaves.push({ position: leafPos, normal: tiltedNormal, size: 1, color, scaleX: sx, scaleY: sy, scaleZ: sz });
    }
  }

  for (let i = 0; i < completePoolIdxs.length; i++) {
    makeBranchAndLeaves(pool[completePoolIdxs[i] % pool.length], completeLeafCounts[i]);
  }

  for (const ab of active) {
    if (ab.leafCount > 0) {
      makeBranchAndLeaves(pool[ab.poolIdx % pool.length], ab.leafCount);
    }
  }

  const branchCenters = result.branches.map(b => b.center);
  result.connections = generateConnectionsForBranches(branchCenters);

  return result;
}

// ── INTERNAL BRANCHES (between foci) ──

const INTERNAL_COLOR = new Color('#1a1612');

let cachedInternalEndpoints: Vector3[] = [];

function generateInternalBranches(ellipsoids: Ellipsoid[]): TreeSegment[] {
  const segments: TreeSegment[] = [];
  cachedInternalEndpoints = [];
  for (const e of ellipsoids) {
    const focalDir = e.f2.clone().sub(e.f1);
    const focalLen = focalDir.length();
    focalDir.normalize();

    let up = new Vector3(0, 1, 0);
    if (Math.abs(focalDir.dot(up)) > 0.99) up = new Vector3(1, 0, 0);
    const right = new Vector3().crossVectors(focalDir, up).normalize();
    up = new Vector3().crossVectors(focalDir, right).normalize();

    const branchCount = 2 + Math.floor(rng() * 3);
    for (let b = 0; b < branchCount; b++) {
      const thickness = e.a * rand(0.015, 0.035) + rand(0.002, 0.008);
      const branchLen = focalLen * rand(0.3, 0.75);

      const tiltAngle = rand(0, Math.PI / 6);
      const tiltDir = rand(0, Math.PI * 2);
      const branchDir = focalDir.clone()
        .addScaledVector(right, Math.sin(tiltAngle) * Math.cos(tiltDir))
        .addScaledVector(up, Math.sin(tiltAngle) * Math.sin(tiltDir))
        .normalize();

      const basePos = e.f1.clone();
      const endPos = basePos.clone().add(branchDir.clone().multiplyScalar(branchLen));

      segments.push({
        start: basePos,
        end: endPos,
        radius: thickness,
        color: INTERNAL_COLOR.clone(),
      });
      cachedInternalEndpoints.push(endPos.clone());

      const subCount = 1 + Math.floor(rng() * 2);
      for (let s = 0; s < subCount; s++) {
        const st = 0.3 + rng() * 0.5;
        const subBase = basePos.clone().lerp(endPos, st);
        const subLen = branchLen * rand(0.15, 0.4);
        const subTilt = rand(0, Math.PI / 4);
        const subDir = branchDir.clone()
          .addScaledVector(right, Math.sin(subTilt) * Math.cos(rng() * Math.PI * 2))
          .addScaledVector(up, Math.sin(subTilt) * Math.sin(rng() * Math.PI * 2))
          .normalize();
        const subEnd = subBase.clone().add(subDir.clone().multiplyScalar(subLen));
        segments.push({
          start: subBase,
          end: subEnd,
          radius: thickness * rand(0.3, 0.6),
          color: INTERNAL_COLOR.clone(),
        });
        cachedInternalEndpoints.push(subEnd.clone());
      }
    }
  }
  return segments;
}

// ── CONNECTIONS (surface branches → internal endpoints) ──

const CONNECTION_COLOR = new Color('#151210');

function generateConnectionsForBranches(branchCenters: Vector3[]): TreeSegment[] {
  const segments: TreeSegment[] = [];
  if (cachedInternalEndpoints.length === 0 || branchCenters.length === 0) return segments;

  for (const center of branchCenters) {
    let bestDist = Infinity;
    let bestEndpoint = cachedInternalEndpoints[0];
    for (const ep of cachedInternalEndpoints) {
      const d = center.distanceTo(ep);
      if (d < bestDist) {
        bestDist = d;
        bestEndpoint = ep;
      }
    }
    segments.push({
      start: center,
      end: bestEndpoint,
      radius: rand(0.003, 0.008),
      color: CONNECTION_COLOR.clone(),
    });
  }
  return segments;
}

// ── CACHE ──

let cachedTrunk: TreeSegment[] | null = null;
let cachedBranches: BranchData[] | null = null;
let cachedLeaves: Leaf[] | null = null;

export function getEllipsoids(): Ellipsoid[] {
  return currentEllipsoids;
}

export function getTreeData(seed?: number): {
  trunk: TreeSegment[];
  branches: BranchData[];
  leaves: Leaf[];
} {
  if (cachedTrunk && cachedBranches && cachedLeaves) {
    return { trunk: cachedTrunk, branches: cachedBranches, leaves: cachedLeaves };
  }

  currentSeed = seed ?? Math.floor(Math.random() * 2147483647);
  rng = mulberry32(currentSeed);

  const trunkHeight = rand(2.5, 4.5);
  const trunkRadius = rand(0.12, 0.3);

  currentParams = {
    seed: currentSeed,
    trunkHeight,
    trunkRadius,
    crownRadius: rand(1.8, 3.5),
    crownHeight: rand(1.5, 3.0),
    crownIrregularity: rand(0.3, 1.0),
    branchDepth: 2 + Math.floor(rng() * 2),
    relief: rand(0.1, 0.8),
    leafCount: MAX_LEAVES,
  };

  cachedTrunk = makeTrunk(currentParams);
  const trunkTop = cachedTrunk.length > 0
    ? cachedTrunk[cachedTrunk.length - 1].end
    : new Vector3(0, trunkHeight, 0);

  currentEllipsoids = generateEllipsoids(trunkTop, 1);
  const internalBranches = generateInternalBranches(currentEllipsoids);
  branchPool = generateBranchPool(trunkTop, currentEllipsoids);
  cachedTrunk = [...cachedTrunk, ...internalBranches];

  const state = computeState(0, branchPool);
  cachedBranches = state.branches;
  cachedLeaves = state.leaves;

  return { trunk: cachedTrunk, branches: cachedBranches, leaves: cachedLeaves };
}

export function getLeavesForCount(leafCount: number): { branches: BranchData[]; leaves: Leaf[]; connections: TreeSegment[] } {
  if (!branchPool) {
    getTreeData();
  }
  const state = computeState(leafCount, branchPool!);
  cachedBranches = state.branches;
  cachedLeaves = state.leaves;
  return { branches: state.branches, leaves: state.leaves, connections: state.connections };
}
