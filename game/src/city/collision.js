// Static collision for the city: every building, wall and prop that blocks movement is an
// axis-aligned box in a spatial hash. Circles (people, car hulls) are pushed out of boxes, line of
// sight is a 2D segment test, and bullets ray-march against box heights.

const CELL = 24;
const boxes = [];
const grid = new Map();

function key(cx, cz) { return cx * 73856093 ^ cz * 19349663; }

export function clearColliders() { boxes.length = 0; grid.clear(); }

/** Every collider (read-only use: the map paints building footprints from them). */
export function allColliders() { return boxes; }

/** Add a solid box; y0/y1 give its vertical extent for bullets. */
export function addCollider(x0, z0, x1, z1, y1 = 30, y0 = 0, tag = 'wall') {
  const b = { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), y0, y1, tag, stamp: 0 };
  boxes.push(b);
  for (let cx = Math.floor(b.x0 / CELL); cx <= Math.floor(b.x1 / CELL); cx++) {
    for (let cz = Math.floor(b.z0 / CELL); cz <= Math.floor(b.z1 / CELL); cz++) {
      const k = key(cx, cz);
      let list = grid.get(k);
      if (!list) { list = []; grid.set(k, list); }
      list.push(b);
    }
  }
  return b;
}

let stamp = 1;
const out = [];
/** Boxes whose cells overlap the square around (x,z) of half-size r. Reused array: copy if kept. */
export function queryColliders(x, z, r) {
  stamp++;
  out.length = 0;
  for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
    for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
      const list = grid.get(key(cx, cz));
      if (!list) continue;
      for (const b of list) {
        if (b.stamp === stamp) continue;
        b.stamp = stamp;
        if (x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1) out.push(b);
      }
    }
  }
  return out;
}

/**
 * Push a circle out of every box it overlaps. Returns { x, z, hit, nx, nz } with the summed
 * push direction, so callers can kill velocity into the wall.
 */
export function resolveCircle(x, z, r, height = 0) {
  const res = { x, z, hit: false, nx: 0, nz: 0 };
  const list = queryColliders(x, z, r + 1);
  for (let pass = 0; pass < 2; pass++) {
    for (const b of list) {
      if (height > b.y1) continue;
      const cx = Math.max(b.x0, Math.min(res.x, b.x1));
      const cz = Math.max(b.z0, Math.min(res.z, b.z1));
      let dx = res.x - cx, dz = res.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-5) {
        // centre inside the box: leave by the nearest face
        const l = res.x - b.x0, rr = b.x1 - res.x, t = res.z - b.z0, bt = b.z1 - res.z;
        const m = Math.min(l, rr, t, bt);
        if (m === l) { dx = -1; dz = 0; d = 0; res.x = b.x0; }
        else if (m === rr) { dx = 1; dz = 0; d = 0; res.x = b.x1; }
        else if (m === t) { dx = 0; dz = -1; d = 0; res.z = b.z0; }
        else { dx = 0; dz = 1; d = 0; res.z = b.z1; }
        res.x += dx * r; res.z += dz * r;
        res.nx += dx; res.nz += dz; res.hit = true;
        continue;
      }
      dx /= d; dz /= d;
      res.x += dx * (r - d); res.z += dz * (r - d);
      res.nx += dx; res.nz += dz; res.hit = true;
    }
  }
  const nl = Math.hypot(res.nx, res.nz);
  if (nl > 0) { res.nx /= nl; res.nz /= nl; }
  return res;
}

function segBox(ax, az, bx, bz, b) {
  // slab test on the 2D segment
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (const [p, d, lo, hi] of [[ax, dx, b.x0, b.x1], [az, dz, b.z0, b.z1]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return -1; continue; }
    let ta = (lo - p) / d, tb = (hi - p) / d;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return -1;
  }
  return t0;
}

/** True when a building (taller than `minHeight`) stands between the two points. */
export function lineBlocked(ax, az, bx, bz, minHeight = 2.5) {
  const len = Math.hypot(bx - ax, bz - az);
  const steps = Math.ceil(len / CELL) + 1;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const list = queryColliders(ax + (bx - ax) * t, az + (bz - az) * t, CELL * 0.75);
    for (const b of list) if (b.y1 >= minHeight && segBox(ax, az, bx, bz, b) >= 0) return true;
  }
  return false;
}

/** Distance along a 3D ray to the first box it enters, or `max` when it hits nothing. */
export function rayDistance(ox, oy, oz, dx, dy, dz, max) {
  let best = max;
  const steps = Math.ceil(max / (CELL * 0.5));
  const seen = new Set();
  for (let s = 0; s <= steps; s++) {
    const t = (s / steps) * max;
    if (t > best) break;
    const list = queryColliders(ox + dx * t, oz + dz * t, CELL * 0.5);
    for (const b of list) {
      if (seen.has(b)) continue;
      seen.add(b);
      let t0 = 0, t1 = best;
      let ok = true;
      for (const [p, d, lo, hi] of [[ox, dx, b.x0, b.x1], [oy, dy, b.y0, b.y1], [oz, dz, b.z0, b.z1]]) {
        if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { ok = false; break; } continue; }
        let ta = (lo - p) / d, tb = (hi - p) / d;
        if (ta > tb) { const q = ta; ta = tb; tb = q; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < best) best = t0;
    }
  }
  return best;
}
