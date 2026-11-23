// Resolving violence: hitscan shots against people (with headshots), car hulls (and the people
// inside) and buildings; punches; NPC gunfire with distance-based accuracy; explosions that hurt,
// fling and chain-react. Every shot is announced so pedestrians, traffic and police can react.
import { WEAPONS } from './weapons.js';
import { rayDistance } from '../city/collision.js';
import { rand } from '../core/random.js';

/** Entry distance of ray (o,d) into a person's vertical capsule, or Infinity. */
function rayHuman(o, d, h) {
  if (h.state === 'drive') return Infinity;
  const lying = h.state === 'dead' || h.state === 'down';
  const y0 = h.y + h.jump + (lying ? 0 : 0.1), y1 = h.y + h.jump + (lying ? 0.45 : 1.78);
  const r = lying ? 0.5 : 0.34;
  const hx = d.x, hz = d.z;
  const hh = hx * hx + hz * hz;
  if (hh < 1e-8) return Infinity;
  const t = ((h.x - o.x) * hx + (h.z - o.z) * hz) / hh;
  if (t < 0) return Infinity;
  const px = o.x + hx * t - h.x, pz = o.z + hz * t - h.z;
  const dist2 = px * px + pz * pz;
  if (dist2 > r * r) return Infinity;
  const te = t - Math.sqrt(r * r - dist2) / Math.sqrt(hh);
  const y = o.y + d.y * te;
  if (y < y0 || y > y1) return Infinity;
  return Math.max(0, te);
}

/** Entry distance of a ray into a vehicle's oriented box, or Infinity. */
function rayVehicle(o, d, v) {
  const c = Math.cos(v.heading), s = Math.sin(v.heading);
  const rx = o.x - v.x, rz = o.z - v.z;
  // world -> local (inverse rotation about y)
  const lo = { x: rx * c - rz * s, y: o.y - v.y, z: rx * s + rz * c };
  const ld = { x: d.x * c - d.z * s, y: d.y, z: d.x * s + d.z * c };
  let t0 = 0, t1 = Infinity;
  for (const [p, dd, lo1, hi] of [[lo.x, ld.x, -v.hw, v.hw], [lo.y, ld.y, 0.25, v.spec.h], [lo.z, ld.z, -v.hl, v.hl]]) {
    if (Math.abs(dd) < 1e-9) { if (p < lo1 || p > hi) return Infinity; continue; }
    let ta = (lo1 - p) / dd, tb = (hi - p) / dd;
    if (ta > tb) { const q = ta; ta = tb; tb = q; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return Infinity;
  }
  return t0;
}

export function createCombat(world, fx, tracers) {
  /** First thing a ray hits: { t, human?, vehicle?, wall? } within `max` metres. */
  function trace(o, d, max, ignore) {
    let best = { t: rayDistance(o.x, o.y, o.z, d.x, d.y, d.z, max), wall: true };
    for (const h of world.humans) {
      if (h === ignore || h.removed) continue;
      if (Math.abs(h.x - o.x) > max || Math.abs(h.z - o.z) > max) continue;
      const t = rayHuman(o, d, h);
      if (t < best.t) best = { t, human: h };
    }
    for (const v of world.vehicles) {
      if (ignore && v === ignore.vehicle) continue;
      if (Math.abs(v.x - o.x) > max + 4 || Math.abs(v.z - o.z) > max + 4) continue;
      const t = rayVehicle(o, d, v);
      if (t < best.t) best = { t, vehicle: v };
    }
    if (best.t >= max) best = { t: max, none: true };
    return best;
  }

  /** Fire `weaponId` from `shooter` at origin o along unit direction d. Returns the hit. */
  function shoot(shooter, weaponId, o, d, { spread = null, damageScale = 1 } = {}) {
    const w = WEAPONS[weaponId];
    const sp = spread ?? w.spread;
    const dir = { x: d.x + (rand() - 0.5) * sp * 2, y: d.y + (rand() - 0.5) * sp * 2, z: d.z + (rand() - 0.5) * sp * 2 };
    const l = Math.hypot(dir.x, dir.y, dir.z);
    dir.x /= l; dir.y /= l; dir.z /= l;
    const hit = trace(o, dir, w.range, shooter);
    const hx = o.x + dir.x * hit.t, hy = o.y + dir.y * hit.t, hz = o.z + dir.z * hit.t;
    tracers.add(o.x, o.y, o.z, hx, hy, hz, shooter === world.player ? [1, 0.9, 0.55] : [1, 0.6, 0.4]);
    fx.muzzle(o.x, o.y, o.z, dir.x, dir.z);
    world.events.emit('gunshot', shooter, o.x, o.z, weaponId);
    if (hit.human) {
      const h = hit.human;
      const head = hy > h.y + h.jump + 1.52 && h.state === 'walk';
      const dmg = w.damage * damageScale * (head ? 2.6 : 1);
      fx.blood(hx, hy, hz, head ? 16 : 9);
      h.takeDamage(dmg, { kind: 'bullet', source: shooter, dirX: dir.x, dirZ: dir.z, force: 1.5, head });
      world.events.emit('bulletHit', shooter, h, head);
    } else if (hit.vehicle) {
      const v = hit.vehicle;
      fx.sparks(hx, hy, hz, 6);
      v.damage(w.damage * damageScale * 0.9, shooter, 'bullet');
      // a bullet through the glass can find the driver
      if (hy - v.y > v.spec.h * 0.62 && v.driver && v.driver !== shooter && rand() < 0.3) {
        v.driver.takeDamage(w.damage * damageScale * 0.8, { kind: 'bullet', source: shooter });
      }
      world.events.emit('bulletHit', shooter, v, false);
    } else if (hit.wall) {
      fx.sparks(hx, hy, hz, 5);
    }
    return hit;
  }

  /** A punch in front of the attacker. */
  function punch(attacker) {
    const w = WEAPONS.fists;
    const fx0 = Math.sin(attacker.heading), fz0 = Math.cos(attacker.heading);
    attacker.punchT = 1;
    let target = null, bd = w.range;
    for (const h of world.humans) {
      if (h === attacker || h.state === 'drive' || !h.alive) continue;
      const dx = h.x - attacker.x, dz = h.z - attacker.z;
      const d = Math.hypot(dx, dz);
      if (d > bd) continue;
      if ((dx * fx0 + dz * fz0) / (d || 1) < 0.5) continue;
      bd = d; target = h;
    }
    world.events.emit('swing', attacker, !!target);
    if (target) {
      target.takeDamage(w.damage * (attacker === world.player ? 1 : 0.6), { kind: 'melee', source: attacker, dirX: fx0, dirZ: fz0, force: 3.2, knockdown: rand() < 0.3 });
      fx.blood(target.x, target.y + 1.5, target.z, 4);
      return target;
    }
    const v = world.vehicles.find((c) => Math.hypot(c.x - (attacker.x + fx0), c.z - (attacker.z + fz0)) < c.hw + 0.6);
    if (v) v.damage(5, attacker, 'melee');
    return null;
  }

  /** An NPC shoots at a target person with accuracy falling off with distance and target speed. */
  function npcShoot(shooter, target, weaponId = 'pistol', skill = 0.6) {
    const m = shooter.muzzle();
    const tx = target.x, tz = target.z;
    const ty = target.y + target.jump + 1.2;
    const dist = Math.hypot(tx - m.x, tz - m.z);
    const targetSpeed = target.vehicle ? target.vehicle.speed : target.speed;
    const chance = Math.max(0.08, Math.min(0.85, skill - dist / 70 - targetSpeed * 0.02));
    const miss = rand() > chance;
    const off = miss ? 1.2 + rand() * 1.5 : 0;
    const ax = tx + (rand() - 0.5) * off * 2, ay = ty + (rand() - 0.5) * off, az = tz + (rand() - 0.5) * off * 2;
    const dx = ax - m.x, dy = ay - m.y, dz = az - m.z;
    const l = Math.hypot(dx, dy, dz);
    return shoot(shooter, weaponId, m, { x: dx / l, y: dy / l, z: dz / l }, { spread: 0.004, damageScale: target === world.player.human ? 0.36 : 1 });
  }

  world.events.on('explosion', (e) => {
    fx.explosion(e.x, e.y, e.z);
    for (const h of world.humans) {
      if (h.state === 'drive' && h.vehicle !== e.vehicle) continue;
      const d = Math.hypot(h.x - e.x, h.z - e.z);
      if (d > e.radius) continue;
      const k = 1 - d / e.radius;
      h.takeDamage(140 * k, { kind: 'explosion', source: e.source, dirX: (h.x - e.x) / (d || 1), dirZ: (h.z - e.z) / (d || 1), force: 12 * k, knockdown: true });
    }
    for (const v of world.vehicles) {
      if (v === e.vehicle) continue;
      const d = Math.hypot(v.x - e.x, v.z - e.z);
      if (d > e.radius) continue;
      const k = 1 - d / e.radius;
      v.vx += (v.x - e.x) / (d || 1) * 10 * k; v.vz += (v.z - e.z) / (d || 1) * 10 * k;
      v.damage(500 * k, e.source, 'explosion');
    }
  });

  return { shoot, punch, npcShoot, trace };
}
