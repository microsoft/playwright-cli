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

export function lowerBound<T>(array: T[], object: T, comparator: (t1: T, t2: T) => number): number {
  let l = 0;
  let r = array.length;
  while (l < r) {
    const m = (l + r) >> 1;
    if (comparator(object, array[m]) > 0)
      l = m + 1;
    else
      r = m;
  }
  return r;
}

export type Random = () => number;

export function shuffle(array: any[], random : Random = createRandom(Math.round(Math.random() * 100))) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; --i) {
    const j = random() % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createRandom(seed: number): () => number {
  return () => seed = seed * 48271 % 2147483647;
}

export function deepCopy(a: any): any {
  return JSON.parse(JSON.stringify(a));
}

export function deepAssign(to: any, from: any) {
  if (from instanceof Array) {
    for (let i = 0; i < from.length; ++i) {
      if (typeof to[i] === 'object' && typeof from[i] === 'object')
        deepAssign(to[i], from[i]);
      else
        to[i] = deepCopy(from[i]);
    }
    to.length = from.length;
    return;
  }

  for (const key in to) {
    if (!(key in from))
      delete to[key];
  }
  for (const key in from) {
    if (typeof to[key] === 'object' && typeof from[key] === 'object')
      deepAssign(to[key], from[key]);
    else
      to[key] = deepCopy(from[key]);
  }
}

export function deepCompare(a: any, b: any, depth = 1000): boolean {
  if (a === b)
    return true;
  if (typeof a !== typeof b)
    return false;
  if (typeof a !== 'object')
    return false;
  if ((a instanceof Array) !== (b instanceof Array))
    return false;
  if (!depth)
    return false;

  const akeys = Object.keys(a);
  const bkeys = Object.keys(b);
  if (akeys.length !== bkeys.length)
    return false;
  for (const key of akeys) {
    if (!deepCompare(a[key], b[key], depth - 1))
      return false;
  }
  return true;
}
