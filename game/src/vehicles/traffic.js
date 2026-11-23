// Civilian traffic: cars that follow their lane, stop at red lights, take random turns through
// intersections on smooth curves, keep their distance from whatever is ahead, honk at the player,
// panic after being shot at, and are recycled around the player to keep the streets busy.
import { DIRS, lanePoint, lightState, exits, STOP_LINE, nodeX, nodeZ } from '../city/roadgraph.js';
import { NX, NZ, PITCH, HALF_ROAD, LANE_INNER, LANE_OUTER } from '../city/layout.js';
import { pickTrafficType, VEHICLES } from './specs.js';
import { Human } from '../actors/human.js';
import { rand, randInt, pick } from '../core/random.js';
import { clamp, wrapAngle } from '../core/mathutil.js';

const TARGET_COUNT = 26;
const DESPAWN = 230;

function bezier(p0, p1, p2, t) {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, z: u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z };
}

export function createTraffic(world, vehicles) {
  /** Give a vehicle a traffic brain on edge (i,j)->d at `along` metres. */
  function attachBrain(v, i, j, d, along, lane) {
    v.ai = {
      kind: 'traffic', i, j, d, along, lane, mode: 'lane', next: chooseNext(i + DIRS[d].di, j + DIRS[d].dj, d),
      cruise: 11 + rand() * 4, blocked: 0, panic: 0, honk: 0, turn: null,
    };
  }

  function chooseNext(i, j, d) {
    const opts = exits(i, j).filter((e) => e !== (d + 2) % 4);
    if (!opts.length) return (d + 2) % 4;
    // prefer straight on
    if (opts.includes(d) && rand() < 0.55) return d;
    return pick(opts);
  }

  function exitsFrom(i, j, d) {
    const opts = exits(i, j).filter((e) => e !== (d + 2) % 4);
    return opts.length ? opts : [(d + 2) % 4];
  }

  function spawnAround(px, pz, minD, maxD) {
    for (let tries = 0; tries < 20; tries++) {
      const horizontal = rand() < 0.5;
      let i, j, d;
      if (horizontal) { j = randInt(0, NZ); i = randInt(0, NX - 1); d = rand() < 0.5 ? 0 : 2; if (d === 2) i += 1; }
      else { i = randInt(0, NX); j = randInt(0, NZ - 1); d = rand() < 0.5 ? 1 : 3; if (d === 3) j += 1; }
      const along = HALF_ROAD + 6 + rand() * (PITCH - 2 * HALF_ROAD - 14);
      const lane = rand() < 0.5 ? LANE_INNER : LANE_OUTER;
      const p = lanePoint(i, j, d, along, lane);
      const dist = Math.hypot(p.x - px, p.z - pz);
      if (dist < minD || dist > maxD) continue;
      if (vehicles.nearest(p.x, p.z, 9)) continue;
      const type = pickTrafficType(rand());
      const spec = VEHICLES[type];
      const v = vehicles.spawn(type, { x: p.x, z: p.z, heading: Math.atan2(DIRS[d].x, DIRS[d].z), color: pick(spec.paints) });
      const driver = new Human(world, { role: type === 'police' ? 'police' : 'civ', seed: randInt(1, 1e6) });
      driver.state = 'drive'; driver.vehicle = v; driver.setVisible(false);
      world.humans.push(driver);
      v.driver = driver;
      attachBrain(v, i, j, d, along, lane);
      const f = v.ai.cruise * 0.7;
      v.vx = Math.sin(v.heading) * f; v.vz = Math.cos(v.heading) * f;
      return v;
    }
    return null;
  }

  function obstacleAhead(v, range) {
    const fx = v.forwardX, fz = v.forwardZ;
    let nearest = range;
    let byPlayer = false;
    const check = (x, z, width, isPlayer) => {
      const dx = x - v.x, dz = z - v.z;
      const a = dx * fx + dz * fz;
      if (a <= 0 || a >= nearest) return;
      const l = Math.abs(dx * -fz + dz * fx);
      if (l < width) { nearest = a; byPlayer = isPlayer; }
    };
    for (const o of vehicles.list) {
      if (o === v) continue;
      check(o.x, o.z, 2.3, o.driver === world.player);
    }
    for (const h of world.humans) {
      if (h.state === 'drive' || (!h.alive && h.stateTime > 4)) continue;
      check(h.x, h.z, 1.6, h === world.player);
    }
    return { dist: nearest, byPlayer };
  }

  function drive(v, dt) {
    const ai = v.ai;
    if (!v.driver || !v.driver.alive || v.driver.vehicle !== v) { v.throttle = 0; v.steerInput = 0; v.handbrake = true; return; }
    const dir = DIRS[ai.d];
    const ni = ai.i + dir.di, nj = ai.j + dir.dj;
    let target, desired = ai.panic > 0 ? ai.cruise * 1.7 : ai.cruise;
    if (ai.panic > 0) ai.panic -= dt;
    if (ai.mode === 'lane') {
      ai.along = (v.x - nodeX(ai.i)) * dir.x + (v.z - nodeZ(ai.j)) * dir.z;
      target = lanePoint(ai.i, ai.j, ai.d, ai.along + 7, ai.lane);
      const toStop = PITCH - STOP_LINE - ai.along;
      const axis = dir.x !== 0 ? 0 : 1;
      const light = lightState(ni, nj, axis, world.time);
      if (light !== 'green' && toStop > -0.5 && toStop < 30 && ai.panic <= 0) {
        desired = Math.min(desired, Math.max(0, toStop - 1) * 0.8);
      }
      if (ai.next !== ai.d) desired = Math.min(desired, 6 + Math.max(0, toStop) * 0.4);
      if (ai.along > PITCH - HALF_ROAD - 2.5) {
        const p0 = lanePoint(ai.i, ai.j, ai.d, PITCH - HALF_ROAD - 2.5, ai.lane);
        const p2 = lanePoint(ni, nj, ai.next, HALF_ROAD + 2.5, ai.lane);
        // control point where the two lane lines cross
        const p1 = ai.next === ai.d ? { x: (p0.x + p2.x) / 2, z: (p0.z + p2.z) / 2 }
          : dir.x !== 0 ? { x: p2.x, z: p0.z } : { x: p0.x, z: p2.z };
        const len = Math.hypot(p1.x - p0.x, p1.z - p0.z) + Math.hypot(p2.x - p1.x, p2.z - p1.z);
        ai.turn = { p0, p1, p2, len, s: 0 };
        ai.mode = 'turn';
      }
    }
    if (ai.mode === 'turn') {
      const t = ai.turn;
      t.s += Math.max(0.5, v.forwardSpeed) * dt / t.len;
      target = bezier(t.p0, t.p1, t.p2, Math.min(1, t.s + 0.3));
      if (ai.next !== ai.d) desired = Math.min(desired, 7);
      if (t.s >= 1) {
        ai.i = ni; ai.j = nj; ai.d = ai.next; ai.mode = 'lane';
        const nd = DIRS[ai.d];
        ai.next = ai.chooser ? ai.chooser(ai.i + nd.di, ai.j + nd.dj, ai.d, exitsFrom(ai.i + nd.di, ai.j + nd.dj, ai.d)) : chooseNext(ai.i + nd.di, ai.j + nd.dj, ai.d);
        ai.along = HALF_ROAD + 2.5;
      }
    }
    // keep distance
    const ob = obstacleAhead(v, 16);
    if (ob.dist < 16) {
      desired = Math.min(desired, Math.max(ai.flee ? 6 : 0, (ob.dist - 6) * (ai.flee ? 2.5 : 1.1)));
      if (ob.dist < 9 && v.forwardSpeed < 1) {
        ai.blocked += dt;
        if (ob.byPlayer && ai.blocked > 1.5 && ai.honk <= 0) { world.events.emit('honk', v); ai.honk = 3 + rand() * 3; }
      }
    } else ai.blocked = 0;
    if (ai.honk > 0) ai.honk -= dt;
    // stuck for long behind a wreck: swing out into the other lane
    if (ai.blocked > 6) { ai.lane = ai.lane === LANE_INNER ? LANE_OUTER : LANE_INNER; ai.blocked = 0; }
    // steer toward the target
    const want = Math.atan2(target.x - v.x, target.z - v.z);
    const err = wrapAngle(want - v.heading);
    v.steerInput = clamp(-err * 2.2, -1, 1);
    const sp = v.forwardSpeed;
    v.throttle = clamp((desired - sp) * 0.5, -1, 1);
    v.handbrake = desired < 0.5 && sp < 1.5;
    // lost the road somehow (pushed into a building): drop the brain
    if (Math.hypot(target.x - v.x, target.z - v.z) > 30) ai.lost = (ai.lost ?? 0) + dt;
  }

  function release(v) {
    const k = vehicles.list.indexOf(v);
    if (k < 0) return;
    if (v.driver && v.driver.vehicle === v && v.driver !== world.player) {
      const hk = world.humans.indexOf(v.driver);
      if (hk >= 0) world.humans.splice(hk, 1);
      v.driver.dispose();
    }
    vehicles.remove(v);
  }

  let spawnTimer = 0;
  return {
    spawnAround,
    attachBrain,
    /** Fill the streets around (x,z) at load. */
    populate(x, z, count = TARGET_COUNT) {
      for (let k = 0; k < count; k++) spawnAround(x, z, 12, 200);
    },
    update(dt) {
      const p = world.focus;
      for (const v of [...vehicles.list]) {
        if (v.ai && v.ai.kind === 'traffic') drive(v, dt);
        if (v.persistent || v === world.player.vehicle) continue;
        const d = Math.hypot(v.x - p.x, v.z - p.z);
        if (d > DESPAWN || (v.wrecked && d > 120) || (v.ai?.lost > 5 && d > 60)) release(v);
      }
      spawnTimer -= dt;
      const civilian = vehicles.list.filter((v) => v.ai && v.ai.kind === 'traffic').length;
      if (spawnTimer <= 0 && civilian < TARGET_COUNT) {
        spawnTimer = 0.3;
        spawnAround(p.x, p.z, 110, 210);
      }
    },
    /** Scare drivers near a gunshot or crash. */
    panic(x, z, radius) {
      for (const v of vehicles.list) {
        if (v.ai?.kind === 'traffic' && Math.hypot(v.x - x, v.z - z) < radius) v.ai.panic = 6;
      }
    },
  };
}
