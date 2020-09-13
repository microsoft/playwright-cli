/*
  Copyright (c) Microsoft Corporation.
 
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
 
      http://www.apache.org/licenses/LICENSE-2.0
 
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

export type Point = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type Vector = Point;

export function intersectQuadWithViewport(quad: Point[], width: number, height: number): Point[] {
  return quad.map(point => ({
    x: Math.min(Math.max(point.x, 0), width),
    y: Math.min(Math.max(point.y, 0), height),
  }));
}

export function computeQuadArea(quad: Point[]) {
  let area = 0;
  for (let i = 0; i < quad.length; ++i) {
    const p1 = quad[i];
    const p2 = quad[(i + 1) % quad.length];
    area += vectorCrossProduct(p1, p2) / 2;
  }
  return Math.abs(area);
}

export function quadCenter(quad: Point[]): Point {
  let x = 0;
  let y = 0;
  for (const point of quad) {
    x += point.x;
    y += point.y;
  }
  return {
    x: x / 4,
    y: y / 4
  };
}

function vectorDiff(a: Vector, b: Vector): Vector {
  return { x: a.x - b.x, y: a.y - b.y };
}

function vectorCrossProduct(a: Vector, b: Vector): number {
  return a.x * b.y - a.y * b.x;
}

function vectorDotProduct(a: Vector, b: Vector): number {
  return a.x * b.x + a.y * b.y;
}

// Returns angle in [0; 2PI).
function vectorRotationAngle(from: Vector, to: Vector): number {
  let a = Math.atan2(vectorCrossProduct(from, to), vectorDotProduct(from, to));
  if (a < 0)
    a += Math.PI * 2;
  return a;
}

// Quad points come in different order depending on transform. Sort them
// in the counter-clockwise order starting from left-bottom.
export function sortQuadPoints(points: Point[]) {
  const center = quadCenter(points);
  points.sort((p1, p2) => {
    const v1 = vectorDiff(p1, center);
    const v2 = vectorDiff(p2, center);
    const a1 = vectorRotationAngle({x: -1, y: 0}, v1);
    const a2 = vectorRotationAngle({x: -1, y: 0}, v2);
    return a1 - a2;
  });
  return points;
}
