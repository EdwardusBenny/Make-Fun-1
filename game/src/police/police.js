// The Sunvale Police Department: cruisers spawn out of sight as the stars rise and route to Cass
// along the road graph, switch to direct pursuit and ramming in sight, stop and deploy officers,
// who try to arrest at one star and shoot from two. A helicopter joins at four stars. Busted
// happens when officers pin a stationary or on-foot Cass for long enough.
import * as THREE from 'three';
import { Human } from '../actors/human.js';
import { nearestNode, route, nodeX, nodeZ, DIRS } from '../city/roadgraph.js';
import { NX, NZ } from '../city/layout.js';
import { lineBlocked } from '../city/collision.js';
import { rand, randInt } from '../core/random.js';
import { clamp, wrapAngle, dist2 } from '../core/mathutil.js';

const CARS_FOR_LEVEL = [0, 1, 2, 3, 5, 6];

export function createPolice(world, { vehicles, combat, wanted }) {
  const cars = [];
  const officers = [];
  let spawnTimer = 0;
  let bustTimer = 0;
  const sirenR = new THREE.PointLight('#ff2a3a', 0, 22, 1.6);
  const sirenB = new THREE.PointLight('#2a5aff', 0, 22, 1.6);
  world.scene.add(sirenR, sirenB);

  function spawnCar(px, pz) {
    for (let tries = 0; tries < 20; tries++) {
      const i = randInt(0, NX), j = randInt(0, NZ);
      const x = nodeX(i), z = nodeZ(j);
      const d = Math.hypot(x - px, z - pz);
      if (d < 95 || d > 190) continue;
      if (!lineBlocked(x, z, px, pz) && tries < 14) continue;
      if (vehicles.nearest(x, z, 8)) continue;
      return spawnCarAt(x, z, Math.atan2(px - x, pz - z));
    }
    return null;
  }

  /** A cruiser with two officers at an exact spot. */
  function spawnCarAt(x, z, heading) {
    {
      const v = vehicles.spawn('police', { x, z, heading });
      v.siren = true;
      v.ai = { kind: 'police', path: [], repath: 0, stuck: 0, reverse: 0 };
      const crew = [];
      for (let k = 0; k < 2; k++) {
        const o = new Human(world, { role: 'police', seed: randInt(1, 1e7), x, z });
        o.state = 'drive'; o.vehicle = v; o.setVisible(false); o.weapon = 'pistol';
        o.brain = { car: v, cool: 1 + rand(), seat: k };
        world.humans.push(o);
        officers.push(o);
        crew.push(o);
      }
      v.driver = crew[0];
      v.passengers = [crew[1]];
      v.crew = crew;
      cars.push(v);
      return v;
    }
  }

  function deploy(v) {
    v.ai.deployed = true;
    v.throttle = 0; v.handbrake = true;
    for (const o of v.crew ?? []) {
      if (!o.alive || o.vehicle !== v) continue;
      const side = o.brain.seat === 0 ? 1 : -1;
      o.vehicle = null; o.state = 'walk'; o.setVisible(true);
      o.x = v.x + v.forwardZ * (v.hw + 0.8) * side;
      o.z = v.z - v.forwardX * (v.hw + 0.8) * side;
      o.collide();
    }
    v.driver = null;
  }

  function remount(v) {
    for (const o of v.crew ?? []) {
      if (!o.alive) continue;
      o.vehicle = v; o.state = 'drive'; o.setVisible(false);
      o.aiming = false;
    }
    const alive = (v.crew ?? []).filter((o) => o.alive);
    if (!alive.length) return false;
    v.driver = alive[0];
    v.ai.deployed = false;
    v.handbrake = false;
    return true;
  }

  function driveCar(v, dt) {
    const ai = v.ai;
    if (v.wrecked || !v.driver || !v.driver.alive || v.driver.vehicle !== v) { v.throttle = 0; v.steerInput = 0; v.siren = false; return; }
    const p = world.player;
    const tx0 = p.vehicle ? p.vehicle.x : p.x, tz0 = p.vehicle ? p.vehicle.z : p.z;
    const dist = Math.hypot(tx0 - v.x, tz0 - v.z);
    if (wanted.level === 0) {
      // calm down and cruise off
      v.siren = false;
      v.throttle = 0.3; v.steerInput = 0;
      return;
    }
    v.siren = true;
    let tx, tz;
    const direct = dist < 55 && !lineBlocked(v.x, v.z, tx0, tz0, 1.5);
    if (direct) {
      const lead = p.vehicle ? 0.5 : 0;
      tx = tx0 + (p.vehicle ? p.vehicle.vx : 0) * lead; tz = tz0 + (p.vehicle ? p.vehicle.vz : 0) * lead;
    } else {
      ai.repath -= dt;
      if (ai.repath <= 0 || !ai.path.length) {
        ai.repath = 1.2;
        ai.path = route(nearestNode(v.x, v.z), nearestNode(tx0, tz0));
        // skip the node we're already past
        if (ai.path.length > 1) {
          const a = ai.path[0], b = ai.path[1];
          const ax = nodeX(a.i) - v.x, az = nodeZ(a.j) - v.z, bx = nodeX(b.i) - nodeX(a.i), bz = nodeZ(b.j) - nodeZ(a.j);
          if (ax * bx + az * bz < 0) ai.path.shift();
        }
      }
      while (ai.path.length && Math.hypot(nodeX(ai.path[0].i) - v.x, nodeZ(ai.path[0].j) - v.z) < 9) ai.path.shift();
      if (ai.path.length) { tx = nodeX(ai.path[0].i); tz = nodeZ(ai.path[0].j); }
      else { tx = tx0; tz = tz0; }
    }
    const want = Math.atan2(tx - v.x, tz - v.z);
    const err = wrapAngle(want - v.heading);
    const sp = v.forwardSpeed;
    if (ai.reverse > 0) {
      ai.reverse -= dt;
      v.throttle = -1; v.steerInput = clamp(err * 2, -1, 1); v.handbrake = false;
      return;
    }
    let desired = v.spec.maxSpeed * 0.82;
    if (Math.abs(err) > 0.5) desired = Math.max(9, 24 - Math.abs(err) * 14);
    if (direct && dist < 18 && p.vehicle && p.vehicle.speed < 4) desired = 4;
    v.steerInput = clamp(-err * 2.4, -1, 1);
    v.throttle = clamp((desired - sp) * 0.4, -1, 1);
    v.handbrake = Math.abs(err) > 1.2 && sp > 12;
    if (Math.abs(sp) < 1.5 && v.throttle > 0.3) { ai.stuck += dt; if (ai.stuck > 1.3) { ai.stuck = 0; ai.reverse = 1.1; } } else ai.stuck = 0;
    // close enough to get out
    const playerSlow = !p.vehicle || p.vehicle.speed < 3;
    if (playerSlow && dist < (p.vehicle ? 13 : 20)) deploy(v);
  }

  function officerAI(o, dt) {
    if (o.state !== 'walk' || !o.alive) return;
    const p = world.player;
    const b = o.brain;
    const px = p.vehicle ? p.vehicle.x : p.x, pz = p.vehicle ? p.vehicle.z : p.z;
    const d = Math.hypot(px - o.x, pz - o.z);
    if (wanted.level === 0 || !p.alive) {
      o.aiming = false;
      o.hostile = false;
      // drift back toward the car and wait to be cleaned up
      if (b.car && !b.car.wrecked) {
        const cd = Math.hypot(b.car.x - o.x, b.car.z - o.z);
        if (cd > 2.5) o.move(b.car.x - o.x, b.car.z - o.z, 1.6, dt);
        else o.speed = 0;
      }
      return;
    }
    o.hostile = true;
    // chase on wheels again if Cass drives away
    if (p.vehicle && p.vehicle.speed > 6 && d > 22 && b.car && !b.car.wrecked) {
      const cd = Math.hypot(b.car.x - o.x, b.car.z - o.z);
      if (cd < 4) {
        const others = (b.car.crew ?? []).filter((c) => c.alive && c.state === 'walk' && Math.hypot(c.x - b.car.x, c.z - b.car.z) > 4);
        if (!others.length) { remount(b.car); return; }
        o.speed = 0;
        return;
      }
      o.aiming = false;
      o.move(b.car.x - o.x, b.car.z - o.z, 6, dt);
      return;
    }
    const sees = d < 50 && !lineBlocked(o.x, o.z, px, pz, 1.2);
    const lethal = wanted.level >= 2;
    if (!lethal) {
      o.aiming = false;
      if (d > 1.4) o.move(px - o.x, pz - o.z, 6.4, dt);
      else { o.speed = 0; o.faceToward(px, pz, dt); }
      return;
    }
    o.aiming = sees && d < 40;
    if (o.aiming) {
      o.faceToward(px, pz, dt, 14);
      // close the gap while firing, strafe a little
      const strafe = Math.sin(world.time * 0.8 + o.id) > 0 ? 1 : -1;
      if (d > 16) o.move(px - o.x, pz - o.z, 3, dt, false);
      else o.move(-(pz - o.z) * strafe, (px - o.x) * strafe, 1.4, dt, false);
      b.cool -= dt;
      if (b.cool <= 0) {
        b.cool = 0.75 + rand() * 0.7;
        combat.npcShoot(o, p.human, 'pistol', 0.48 + wanted.level * 0.04);
      }
    } else {
      o.move(px - o.x, pz - o.z, 6.2, dt);
    }
  }

  function checkBusted(dt) {
    const p = world.player;
    if (wanted.level === 0 || !p.alive) { bustTimer = 0; return; }
    const slow = !p.vehicle || p.vehicle.speed < 1.2;
    let close = false;
    if (slow) {
      const px = p.vehicle ? p.vehicle.x : p.x, pz = p.vehicle ? p.vehicle.z : p.z;
      const reach = p.vehicle ? p.vehicle.hw + 2.2 : 1.7;
      for (const o of officers) if (o.alive && o.state === 'walk' && Math.hypot(o.x - px, o.z - pz) < reach) close = true;
    }
    // at one star an arrest is quick; above that only when Cass stands still with cops at arm's length
    const onFootStill = !p.vehicle && p.human.speed < 0.5;
    if (close && (wanted.level <= 1 || p.vehicle || onFootStill)) bustTimer += dt; else bustTimer = Math.max(0, bustTimer - dt);
    if (bustTimer > (wanted.level <= 1 ? 1.4 : 2.6)) { bustTimer = 0; world.events.emit('busted'); }
  }

  // crimes against the police
  world.events.on('hurt', (h, info) => {
    if (h.role === 'police' && info.source === world.player.human) wanted.report('assaultCop');
  });
  world.events.on('death', (h, info) => {
    if (h.role === 'police' && info.source === world.player.human) wanted.report('copKilled');
  });
  world.events.on('explosion', (e) => {
    if (e.vehicle && e.vehicle.spec.police && e.source === world.player.human) wanted.report('copCarWrecked');
  });

  function removeOfficer(o) {
    const k = officers.indexOf(o);
    if (k >= 0) officers.splice(k, 1);
    const h = world.humans.indexOf(o);
    if (h >= 0) world.humans.splice(h, 1);
    o.dispose();
  }

  const police = {
    cars, officers,
    get bustProgress() { return bustTimer; },
    update(dt) {
      const p = world.player;
      const px = p.vehicle ? p.vehicle.x : p.x, pz = p.vehicle ? p.vehicle.z : p.z;
      // traffic cops join in when they see a crime
      for (const v of vehicles.list) {
        if (v.spec.police && v.ai?.kind === 'traffic' && wanted.level > 0 && v.driver?.alive && dist2(v.x, v.z, px, pz) < 60) {
          v.ai = { kind: 'police', path: [], repath: 0, stuck: 0, reverse: 0 };
          v.crew = [v.driver];
          v.driver.weapon = 'pistol';
          v.driver.brain = { car: v, cool: 1, seat: 0 };
          officers.push(v.driver);
          cars.push(v);
        }
      }
      const active = cars.filter((v) => !v.removed && !v.wrecked && v.crew?.some((o) => o.alive));
      spawnTimer -= dt;
      if (spawnTimer <= 0 && active.length < CARS_FOR_LEVEL[wanted.level]) {
        spawnTimer = 2.5;
        spawnCar(px, pz);
      }
      for (const v of cars) if (!v.removed && v.ai?.kind === 'police' && !v.ai.deployed) driveCar(v, dt);
      for (const o of officers) officerAI(o, dt);
      // tidy up: forget removed cars, remove officers left far behind
      for (let k = cars.length - 1; k >= 0; k--) if (cars[k].removed) cars.splice(k, 1);
      for (const o of [...officers]) {
        const ox = o.vehicle ? o.vehicle.x : o.x, oz = o.vehicle ? o.vehicle.z : o.z;
        if (o.vehicle && o.vehicle.removed) { removeOfficer(o); continue; }
        if (!o.vehicle && (Math.hypot(ox - px, oz - pz) > 160 || (!o.alive && o.stateTime > 25))) removeOfficer(o);
        else if (!o.vehicle && wanted.level === 0 && Math.hypot(ox - px, oz - pz) > 90) removeOfficer(o);
      }
      if (wanted.level === 0) {
        for (const v of cars) if (!v.removed && v.ai) v.persistent = false;
      }
      checkBusted(dt);
      // two real lights follow the nearest wailing cruiser
      let best = null, bd = 80;
      for (const v of cars) {
        if (!v.siren || v.removed) continue;
        const d = Math.hypot(v.x - px, v.z - pz);
        if (d < bd) { bd = d; best = v; }
      }
      const ph = Math.floor(world.time * 6) % 2;
      if (best) {
        sirenR.position.set(best.x - best.forwardZ * 0.6, best.spec.h + 1, best.z + best.forwardX * 0.6);
        sirenB.position.set(best.x + best.forwardZ * 0.6, best.spec.h + 1, best.z - best.forwardX * 0.6);
        sirenR.intensity = ph ? 60 : 0; sirenB.intensity = ph ? 0 : 60;
      } else { sirenR.intensity = 0; sirenB.intensity = 0; }
      world.nearestSiren = best ? bd : Infinity;
    },
    /** Remove all police (after busted/wasted). */
    reset() {
      for (const v of [...cars]) vehicles.remove(v);
      cars.length = 0;
      for (const o of [...officers]) removeOfficer(o);
      bustTimer = 0;
    },
    spawnCar,
    spawnCarAt,
  };
  void DIRS;
  return police;
}
