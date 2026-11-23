// Seeded randomness (mulberry32). The whole world is built and populated from one seed, so a
// ?seed=N screenshot shows the same city, traffic and crowd every time.

export function createRandom(seed) {
  let a = seed | 0;
  const next = function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return next;
}

/** Shared game RNG; reseeded once at boot from ?seed or the clock. */
export const rng = { next: createRandom(1) };

export function reseed(seed) {
  rng.next = createRandom(seed);
}

export function rand() { return rng.next(); }
export function randRange(a, b) { return a + (b - a) * rng.next(); }
export function randInt(a, b) { return a + Math.floor(rng.next() * (b - a + 1)); }
export function pick(list) { return list[Math.floor(rng.next() * list.length)]; }
export function chance(p) { return rng.next() < p; }

/** A cheap deterministic hash of integers to [0,1), for per-block decisions independent of call order. */
export function hash2(x, y, salt = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
