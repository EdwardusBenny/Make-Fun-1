// The set of vehicles in the world: steps each one, resolves car-to-car impacts and cars hitting
// people, and answers "which car is nearest" for stealing and AI.
import { Vehicle } from './vehicle.js';
import { RADIUS } from '../actors/human.js';

export function createVehicleSystem(world) {
  const list = world.vehicles;

  function spawn(type, opts) {
    const v = new Vehicle(world, type, opts);
    list.push(v);
    return v;
  }

  function remove(v) {
    const k = list.indexOf(v);
    if (k >= 0) list.splice(k, 1);
    v.dispose();
  }

  function carCar(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const reach = a.hl + b.hl + 0.5;
    if (dx * dx + dz * dz > reach * reach) return;
    const ca = a.circles(), cb = b.circles();
    for (const p of ca) {
      for (const q of cb) {
        let nx = q.x - p.x, nz = q.z - p.z;
        const d = Math.hypot(nx, nz);
        const min = p.r + q.r;
        if (d >= min || d < 1e-4) continue;
        nx /= d; nz /= d;
        const ma = a.spec.mass, mb = b.spec.mass;
        const pen = min - d;
        const wa = mb / (ma + mb), wb = ma / (ma + mb);
        a.x -= nx * pen * wa; a.z -= nz * pen * wa;
        b.x += nx * pen * wb; b.z += nz * pen * wb;
        const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rel < 0) {
          const j = -(1.3) * rel / (1 / ma + 1 / mb);
          a.vx -= j / ma * nx; a.vz -= j / ma * nz;
          b.vx += j / mb * nx; b.vz += j / mb * nz;
          const impact = -rel;
          if (impact > 2.5) {
            const dmg = impact * impact * 0.7;
            a.damage(dmg * wa * 1.6, b.driver, 'crash');
            b.damage(dmg * wb * 1.6, a.driver, 'crash');
            world.events.emit('carCrash', a, b, impact);
          }
        }
        return;
      }
    }
  }

  function carHuman(v, h) {
    if (!h.alive && h.state === 'dead' && v.speed < 6) return;
    if (h.state === 'drive') return;
    const dx = h.x - v.x, dz = h.z - v.z;
    if (dx * dx + dz * dz > (v.hl + 1) * (v.hl + 1)) return;
    // into car-local space
    const fx = v.forwardX, fz = v.forwardZ;
    const lz = dx * fx + dz * fz, lx = dx * -fz + dz * fx;
    const ex = v.hw + RADIUS, ez = v.hl + RADIUS;
    if (Math.abs(lx) > ex || Math.abs(lz) > ez) return;
    const speed = v.speed;
    // push out along the shallower axis
    const px = ex - Math.abs(lx), pz = ez - Math.abs(lz);
    let ox = 0, oz = 0;
    if (px < pz) ox = Math.sign(lx) * px; else oz = Math.sign(lz) * pz;
    h.x += ox * -fz + oz * fx;
    h.z += ox * fx + oz * fz;
    if (speed > 4 && h.alive && h.jump < 0.6) {
      const dirX = v.vx / speed, dirZ = v.vz / speed;
      const killed = h.takeDamage(speed * speed * 0.35 + 8, { kind: 'car', source: v.driver, vehicle: v, dirX, dirZ, force: speed * 0.9, knockdown: true });
      world.events.emit('runOver', v, h, speed, killed);
      v.vx *= 0.93; v.vz *= 0.93;
    }
  }

  return {
    list, spawn, remove,
    update(dt) {
      for (const v of list) v.update(dt);
      for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) carCar(list[a], list[b]);
      for (const v of list) {
        if (v.speed < 0.3 && v.ai == null && !v.driver) continue;
        for (const h of world.humans) carHuman(v, h);
      }
    },
    nearest(x, z, maxDist = 6, filter = null) {
      let best = null, bd = maxDist;
      for (const v of list) {
        if (filter && !filter(v)) continue;
        const d = Math.hypot(v.x - x, v.z - z) - v.hw;
        if (d < bd) { bd = d; best = v; }
      }
      return best;
    },
  };
}
