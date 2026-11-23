// Civilians on foot: each strolls a loop around a block's sidewalk (or along the beach), pauses
// now and then, flees from gunfire, explosions and reckless drivers, sometimes fights back when
// punched, and is recycled around the player so the streets always have people.
import { Human } from './human.js';
import { NX, NZ, blockRect, SIDEWALK, CITY_H, CITY_W, HALF_ROAD } from '../city/layout.js';
import { rand, randInt, randRange } from '../core/random.js';

const TARGET = 46;
const DESPAWN = 150;

/** Point on the sidewalk loop of block (i,j) at parameter s (0..1 around the perimeter). */
function loopPoint(i, j, s) {
  const r = blockRect(i, j);
  const m = SIDEWALK / 2;
  const x0 = r.x0 + m, x1 = r.x1 - m, z0 = r.z0 + m, z1 = r.z1 - m;
  const w = x1 - x0, d = z1 - z0, per = 2 * (w + d);
  let t = ((s % 1) + 1) % 1 * per;
  if (t < w) return { x: x0 + t, z: z0 };
  t -= w;
  if (t < d) return { x: x1, z: z0 + t };
  t -= d;
  if (t < w) return { x: x1 - t, z: z1 };
  t -= w;
  return { x: x0, z: z1 - t };
}

function loopLength(i, j) {
  const r = blockRect(i, j);
  return 2 * ((r.x1 - r.x0 - SIDEWALK) + (r.z1 - r.z0 - SIDEWALK));
}

export function createPedestrians(world) {
  const peds = [];

  function spawnNear(px, pz, minD, maxD) {
    for (let tries = 0; tries < 16; tries++) {
      let h, brain;
      if (rand() < 0.18 && pz > CITY_H - 160) {
        // beach stroller
        const x = randRange(-20, CITY_W), z = CITY_H + HALF_ROAD + randRange(8, 70);
        if (Math.hypot(x - px, z - pz) < minD || Math.hypot(x - px, z - pz) > maxD) continue;
        brain = { mode: 'beach', dir: rand() < 0.5 ? 1 : -1, z, pause: 0 };
        h = new Human(world, { role: 'civ', seed: randInt(1, 1e7), x, z });
      } else {
        const i = randInt(0, NX - 1), j = randInt(0, NZ - 1);
        const s = rand();
        const p = loopPoint(i, j, s);
        const d = Math.hypot(p.x - px, p.z - pz);
        if (d < minD || d > maxD) continue;
        brain = { mode: 'loop', i, j, s, dir: rand() < 0.5 ? 1 : -1, pause: 0, len: loopLength(i, j) };
        h = new Human(world, { role: 'civ', seed: randInt(1, 1e7), x: p.x, z: p.z });
      }
      brain.walk = randRange(1.1, 1.6);
      brain.tough = rand() < 0.12;
      h.brain = brain;
      world.humans.push(h);
      peds.push(h);
      return h;
    }
    return null;
  }

  function remove(h) {
    const k = peds.indexOf(h);
    if (k >= 0) peds.splice(k, 1);
    const w = world.humans.indexOf(h);
    if (w >= 0) world.humans.splice(w, 1);
    h.dispose();
  }

  function think(h, dt) {
    const b = h.brain;
    if (h.state !== 'walk') return;
    const player = world.player;
    if (b.fight > 0 && player.alive) {
      b.fight -= dt;
      const d = Math.hypot(player.x - h.x, player.z - h.z);
      h.faceToward(player.x, player.z, dt);
      if (d > 1.3) h.move(player.x - h.x, player.z - h.z, 4.5, dt);
      else {
        h.speed = 0;
        b.swing = (b.swing ?? 0) - dt;
        if (b.swing <= 0) { b.swing = 0.9; h.punchT = 1; world.events.emit('npcPunch', h, player); }
      }
      return;
    }
    if (b.flee > 0) {
      b.flee -= dt;
      let ax = h.x - b.fx, az = h.z - b.fz;
      const l = Math.hypot(ax, az) || 1;
      // wobble so crowds scatter rather than run in a line
      ax = ax / l + Math.sin(world.time * 2 + h.id) * 0.3; az = az / l + Math.cos(world.time * 2 + h.id) * 0.3;
      h.move(ax, az, 5.2, dt);
      if (b.flee <= 0 && b.mode === 'loop') {
        // rejoin the nearest loop
        b.i = Math.max(0, Math.min(NX - 1, Math.floor(h.x / 84)));
        b.j = Math.max(0, Math.min(NZ - 1, Math.floor(h.z / 84)));
        b.len = loopLength(b.i, b.j);
        b.s = nearestS(b.i, b.j, h.x, h.z);
      }
      return;
    }
    if (b.pause > 0) { b.pause -= dt; h.speed = 0; return; }
    if (rand() < dt * 0.03) { b.pause = randRange(1.5, 5); return; }
    if (b.mode === 'beach') {
      h.move(b.dir, (b.z - h.z) * 0.2, b.walk, dt);
      if (h.x < -25 || h.x > CITY_W + 10) b.dir *= -1;
      return;
    }
    b.s += b.dir * b.walk * dt / b.len;
    const p = loopPoint(b.i, b.j, b.s);
    const dx = p.x - h.x, dz = p.z - h.z;
    const d = Math.hypot(dx, dz);
    h.move(dx, dz, d > 0.3 ? Math.min(b.walk * 1.6, d * 3) : 0, dt);
  }

  function nearestS(i, j, x, z) {
    let best = 0, bd = 1e9;
    for (let k = 0; k < 64; k++) {
      const p = loopPoint(i, j, k / 64);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = k / 64; }
    }
    return best;
  }

  // reactions
  function scare(x, z, radius, duration = 7) {
    for (const h of peds) {
      if (!h.alive || h.brain.fight > 0) continue;
      const d = Math.hypot(h.x - x, h.z - z);
      if (d < radius) {
        h.brain.flee = duration * (0.7 + rand() * 0.6);
        h.brain.fx = x; h.brain.fz = z;
        if (rand() < 0.1) world.events.emit('scream', h);
      }
    }
  }
  world.events.on('gunshot', (shooter, x, z) => scare(x, z, 38));
  world.events.on('explosion', (e) => scare(e.x, e.z, 60, 10));
  world.events.on('runOver', (v) => scare(v.x, v.z, 25));
  world.events.on('hurt', (h, info) => {
    if (h.role !== 'civ' || !h.alive || !peds.includes(h)) return;
    if (info.kind === 'melee' && h.brain.tough && info.source === world.player) { h.brain.fight = 8; return; }
    h.brain.flee = 8; h.brain.fx = info.source?.x ?? h.x; h.brain.fz = info.source?.z ?? h.z;
  });

  let timer = 0;
  return {
    list: peds,
    spawnNear,
    remove,
    populate(x, z) { for (let k = 0; k < TARGET; k++) spawnNear(x, z, 6, 120); },
    update(dt) {
      const p = world.focus;
      for (const h of [...peds]) {
        think(h, dt);
        const d = Math.hypot(h.x - p.x, h.z - p.z);
        if ((d > DESPAWN && !h.persistent) || (!h.alive && h.stateTime > 25)) remove(h);
      }
      timer -= dt;
      if (timer <= 0 && peds.length < TARGET) { timer = 0.2; spawnNear(p.x, p.z, 70, 140); }
    },
    scare,
  };
}
