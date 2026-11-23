// The road network as a graph for AI: intersections are nodes (i,j), streets are edges. Traffic
// picks turns from it, police route to the player along it, and each intersection runs a light cycle.
import { NX, NZ, PITCH, HALF_ROAD } from './layout.js';

export const DIRS = [
  { di: 1, dj: 0, x: 1, z: 0 },   // east
  { di: 0, dj: 1, x: 0, z: 1 },   // south
  { di: -1, dj: 0, x: -1, z: 0 }, // west
  { di: 0, dj: -1, x: 0, z: -1 }, // north
];

export function nodeValid(i, j) { return i >= 0 && i <= NX && j >= 0 && j <= NZ; }
export function nodeX(i) { return i * PITCH; }
export function nodeZ(j) { return j * PITCH; }

/** Directions (indices into DIRS) leaving node (i,j). */
export function exits(i, j) {
  const list = [];
  for (let d = 0; d < 4; d++) if (nodeValid(i + DIRS[d].di, j + DIRS[d].dj)) list.push(d);
  return list;
}

export function nearestNode(x, z) {
  return {
    i: Math.max(0, Math.min(NX, Math.round(x / PITCH))),
    j: Math.max(0, Math.min(NZ, Math.round(z / PITCH))),
  };
}

/** Breadth-first route of nodes from a to b (both {i,j}); includes both ends. */
export function route(a, b, maxLen = 60) {
  if (a.i === b.i && a.j === b.j) return [a];
  const W = NX + 1;
  const prev = new Map();
  const start = a.j * W + a.i, goal = b.j * W + b.i;
  const queue = [start];
  prev.set(start, -1);
  while (queue.length) {
    const cur = queue.shift();
    if (cur === goal) break;
    const ci = cur % W, cj = Math.floor(cur / W);
    for (const d of DIRS) {
      const ni = ci + d.di, nj = cj + d.dj;
      if (!nodeValid(ni, nj)) continue;
      const k = nj * W + ni;
      if (prev.has(k)) continue;
      prev.set(k, cur);
      queue.push(k);
    }
  }
  const path = [];
  let k = goal;
  while (k !== -1 && k !== undefined && path.length < maxLen) {
    path.unshift({ i: k % W, j: Math.floor(k / W) });
    k = prev.get(k);
  }
  return path;
}

/** The point in a lane: on the road leaving node (i,j) in direction d, `along` metres from its centre. */
export function lanePoint(i, j, d, along, laneOffset) {
  const dir = DIRS[d];
  // driving on the right: right of heading (x,z) is (-z, x)
  return {
    x: nodeX(i) + dir.x * along - dir.z * laneOffset,
    z: nodeZ(j) + dir.z * along + dir.x * laneOffset,
  };
}

const CYCLE = 18;
/** Whether the light at (i,j) shows green to traffic travelling along axis 0 (east-west) or 1 (north-south). */
export function lightGreen(i, j, axis, time) {
  const t = (time + ((i * 7 + j * 3) % CYCLE)) % CYCLE;
  // 8 s green each way with a short all-red between
  if (axis === 0) return t < 8;
  return t >= 9 && t < 17;
}

export function lightState(i, j, axis, time) {
  const t = (time + ((i * 7 + j * 3) % CYCLE)) % CYCLE;
  const g0 = t < 8, a0 = t >= 8 && t < 9;
  const g1 = t >= 9 && t < 17, a1 = t >= 17;
  if (axis === 0) return g0 ? 'green' : a0 ? 'amber' : 'red';
  return g1 ? 'green' : a1 ? 'amber' : 'red';
}

/** Distance from an intersection centre to its stop line. */
export const STOP_LINE = HALF_ROAD + 3;
