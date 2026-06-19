import { Color, Vector3 } from 'three';

export interface TreeSegment {
  start: Vector3;
  end: Vector3;
  radius: number;
  color: Color;
}

export interface Leaf {
  position: Vector3;
  normal: Vector3;
  size: number;
  color: Color;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

export interface BranchData {
  center: Vector3;
  normal: Vector3;
  length: number;
  width: number;
}

export interface TreeParams {
  seed: number;
  trunkHeight: number;
  trunkRadius: number;
  crownRadius: number;
  crownHeight: number;
  crownIrregularity: number;
  branchDepth: number;
  relief: number;
  leafCount: number;
}
