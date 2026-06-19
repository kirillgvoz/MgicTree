import {
  InstancedMesh,
  SphereGeometry,
  BoxGeometry,
  MeshBasicMaterial,
  Matrix4,
  DynamicDrawUsage,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  Vector3,
} from 'three';
import { TreeSegment, Leaf, BranchData } from './types';

const MAX_LEAVES = 15000;
const MAX_BRANCHES = 2000;

const leafGeometry = new SphereGeometry(1, 5, 5);
const leafMaterial = new MeshBasicMaterial();
const branchGeometry = new BoxGeometry(1, 1, 1);
const branchMaterial = new MeshBasicMaterial({ color: 0x1a1612 });
const dummy = new Matrix4();

export function createLeafMesh(): InstancedMesh {
  const mesh = new InstancedMesh(leafGeometry, leafMaterial, MAX_LEAVES);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.count = 0;
  return mesh;
}

export function updateLeafMesh(mesh: InstancedMesh, leaves: Leaf[]): void {
  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i];
    const scaleMatrix = new Matrix4().makeScale(leaf.scaleX, leaf.scaleY, leaf.scaleZ);
    const translateMatrix = new Matrix4().makeTranslation(
      leaf.position.x, leaf.position.y, leaf.position.z
    );
    dummy.multiplyMatrices(translateMatrix, scaleMatrix);
    mesh.setMatrixAt(i, dummy);
    mesh.setColorAt(i, leaf.color);
  }
  mesh.count = leaves.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export function createBranchMesh(): InstancedMesh {
  const mesh = new InstancedMesh(branchGeometry, branchMaterial, MAX_BRANCHES);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.count = 0;
  return mesh;
}

export function updateBranchMesh(mesh: InstancedMesh, branches: BranchData[]): void {
  const ref = new Vector3(0, 1, 0);

  for (let i = 0; i < branches.length; i++) {
    const b = branches[i];
    const normal = b.normal;

    let right = new Vector3().crossVectors(ref, normal).normalize();
    if (right.length() < 0.01) {
      right = new Vector3(1, 0, 0).cross(normal).normalize();
    }
    const up = new Vector3().crossVectors(normal, right).normalize();

    const scaleMatrix = new Matrix4().makeScale(b.width, b.length, b.width);
    const rotMatrix = new Matrix4().makeBasis(right, normal, up);
    const offset = normal.clone().multiplyScalar(b.length * 0.5);
    const center = b.center.clone().add(offset);
    const translateMatrix = new Matrix4().makeTranslation(center.x, center.y, center.z);

    dummy.multiplyMatrices(translateMatrix, rotMatrix);
    dummy.multiply(scaleMatrix);
    mesh.setMatrixAt(i, dummy);
  }

  mesh.count = branches.length;
  mesh.instanceMatrix.needsUpdate = true;
}

export function createTrunkMesh(segments: TreeSegment[]): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  for (const seg of segments) {
    const dir = seg.end.clone().sub(seg.start);
    const length = dir.length();
    if (length < 0.001) continue;
    dir.normalize();

    let up = new Vector3(0, 1, 0);
    if (Math.abs(dir.dot(up)) > 0.99) up = new Vector3(1, 0, 0);
    const right = new Vector3().crossVectors(dir, up).normalize();
    up = new Vector3().crossVectors(right, dir).normalize();

    const radialSegments = 8;
    const baseIndex = positions.length / 3;

    for (let i = 0; i <= radialSegments; i++) {
      const angle = (i / radialSegments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const nx = cos * right.x + sin * up.x;
      const ny = cos * right.y + sin * up.y;
      const nz = cos * right.z + sin * up.z;

      for (let end = 0; end < 2; end++) {
        const pt = end === 0 ? seg.start : seg.end;
        positions.push(pt.x + nx * seg.radius, pt.y + ny * seg.radius, pt.z + nz * seg.radius);
        normals.push(nx, ny, nz);
        colors.push(seg.color.r, seg.color.g, seg.color.b);
      }
    }

    for (let i = 0; i < radialSegments; i++) {
      const a = baseIndex + i * 2;
      const b = baseIndex + i * 2 + 1;
      const c = baseIndex + (i + 1) * 2;
      const d = baseIndex + (i + 1) * 2 + 1;
      positions.push(
        positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2],
        positions[c * 3], positions[c * 3 + 1], positions[c * 3 + 2],
        positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2],
        positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2],
        positions[c * 3], positions[c * 3 + 1], positions[c * 3 + 2],
        positions[d * 3], positions[d * 3 + 1], positions[d * 3 + 2],
      );
      normals.push(
        normals[a * 3], normals[a * 3 + 1], normals[a * 3 + 2],
        normals[c * 3], normals[c * 3 + 1], normals[c * 3 + 2],
        normals[b * 3], normals[b * 3 + 1], normals[b * 3 + 2],
        normals[b * 3], normals[b * 3 + 1], normals[b * 3 + 2],
        normals[c * 3], normals[c * 3 + 1], normals[c * 3 + 2],
        normals[d * 3], normals[d * 3 + 1], normals[d * 3 + 2],
      );
      colors.push(
        colors[a * 3], colors[a * 3 + 1], colors[a * 3 + 2],
        colors[c * 3], colors[c * 3 + 1], colors[c * 3 + 2],
        colors[b * 3], colors[b * 3 + 1], colors[b * 3 + 2],
        colors[b * 3], colors[b * 3 + 1], colors[b * 3 + 2],
        colors[c * 3], colors[c * 3 + 1], colors[c * 3 + 2],
        colors[d * 3], colors[d * 3 + 1], colors[d * 3 + 2],
      );
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const material = new MeshBasicMaterial({ vertexColors: true });
  return new Mesh(geometry, material);
}
