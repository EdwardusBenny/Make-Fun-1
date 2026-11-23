// The wanted level: crimes add heat, heat maps to 0-5 stars, and the stars only fall away once
// the police have lost sight of Cass for long enough (the stars flash while they search).
import { lineBlocked } from '../city/collision.js';
import { rand } from '../core/random.js';

const THRESHOLDS = [1, 5, 11, 20, 32];
/** Heat each crime adds, and whether someone must witness it for it to count. */
const CRIMES = {
  gunfire: { heat: 1, witness: false, cap: 2, every: 4 },
  assault: { heat: 1, witness: true },
  carjack: { heat: 1, witness: true },
  hitPed: { heat: 1, witness: true },
  murder: { heat: 3, witness: false },
  assaultCop: { heat: 4, witness: false },
  copKilled: { heat: 7, witness: false },
  copCarWrecked: { heat: 5, witness: false },
  explosion: { heat: 3, witness: false },
  robbery: { heat: 11, witness: false },
};

export function createWanted(world) {
  const w = {
    heat: 0, level: 0, lastReport: {}, unseen: 0, seenX: 0, seenZ: 0, flashing: false, searchRadius: 0, frozen: false,
    /** Seconds until the search is called off at the current level. */
    get evadeTime() { return 7 + w.level * 3.5; },
    report(kind, x = world.player.x, z = world.player.z) {
      const c = CRIMES[kind];
      if (!c || w.frozen) return;
      if (c.every) {
        // repeated gunfire is one report every few seconds, not one per bullet
        if (world.time - (w.lastReport[kind] ?? -99) < c.every) return;
        w.lastReport[kind] = world.time;
      }
      if (c.witness && !copCanSee(x, z, 55) && rand() > 0.45) return;
      if (c.cap && w.level >= c.cap) { w.unseen = 0; return; }
      w.heat += c.heat;
      w.setFromHeat();
      w.unseen = 0; w.seenX = x; w.seenZ = z;
    },
    /** Force at least `stars` (missions use this). */
    atLeast(stars) {
      if (stars <= w.level) return;
      w.heat = Math.max(w.heat, THRESHOLDS[stars - 1]);
      w.setFromHeat();
      w.unseen = 0; w.seenX = world.player.x; w.seenZ = world.player.z;
    },
    setFromHeat() {
      let lvl = 0;
      while (lvl < 5 && w.heat >= THRESHOLDS[lvl]) lvl++;
      if (lvl !== w.level) world.events.emit('wantedChanged', lvl, w.level);
      w.level = lvl;
    },
    clear() {
      const had = w.level;
      w.heat = 0; w.level = 0; w.unseen = 0; w.flashing = false;
      if (had) world.events.emit('wantedChanged', 0, had);
    },
    update(dt) {
      if (w.level === 0) { w.flashing = false; return; }
      const p = world.player;
      if (copCanSee(p.x, p.z, 70 + w.level * 10)) {
        w.unseen = 0; w.seenX = p.x; w.seenZ = p.z; w.flashing = false;
      } else {
        w.unseen += dt;
        w.flashing = true;
        if (w.unseen > w.evadeTime) {
          w.clear();
          world.events.emit('evaded');
        }
      }
      w.searchRadius = 60 + w.level * 22;
    },
  };

  function copCanSee(x, z, range) {
    for (const h of world.humans) {
      if (h.role !== 'police' || !h.alive) continue;
      const hx = h.vehicle ? h.vehicle.x : h.x, hz = h.vehicle ? h.vehicle.z : h.z;
      const d = Math.hypot(hx - x, hz - z);
      if (d < 12) return true;
      if (d < range && !lineBlocked(hx, hz, x, z)) return true;
    }
    if (world.heli && world.heli.active && Math.hypot(world.heli.x - x, world.heli.z - z) < 60) return true;
    return false;
  }
  w.copCanSee = copCanSee;
  return w;
}
