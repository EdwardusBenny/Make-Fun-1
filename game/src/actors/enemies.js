// Hostile people for missions: Tiburones gangsters, Krane's security and their bosses. They guard
// a spot until alerted (by gunfire, a hit or Cass getting close), then fight: shoot when they have
// line of sight, strafe, advance or hold, and sometimes run for it.
import { Human } from './human.js';
import { lineBlocked } from '../city/collision.js';
import { rand, randInt } from '../core/random.js';

export function createEnemies(world, { combat }) {
  const list = [];

  function spawn(role, x, z, { weapon = 'pistol', skill = 0.55, heading = 0, alertRange = 28, name = null, flee = false } = {}) {
    const h = new Human(world, { role, seed: randInt(1, 1e7), x, z, heading });
    h.weapon = weapon;
    h.persistent = true;
    h.name = name;
    h.brain = { post: { x, z }, alert: false, alertRange, cool: 0.6 + rand(), skill, flee, strafe: rand() < 0.5 ? 1 : -1 };
    world.humans.push(h);
    list.push(h);
    return h;
  }

  function alertAll(x, z, radius) {
    for (const h of list) if (h.alive && Math.hypot(h.x - x, h.z - z) < radius) h.brain.alert = true;
  }
  world.events.on('gunshot', (shooter, x, z) => { if (shooter === world.player.human) alertAll(x, z, 45); });
  world.events.on('hurt', (h, info) => { if (list.includes(h) && info.source === world.player.human) alertAll(h.x, h.z, 40); });

  function think(h, dt) {
    if (!h.alive || h.state !== 'walk') return;
    const b = h.brain;
    const p = world.player;
    const px = p.vehicle ? p.vehicle.x : p.x, pz = p.vehicle ? p.vehicle.z : p.z;
    const d = Math.hypot(px - h.x, pz - h.z);
    if (!b.alert) {
      if (d < b.alertRange && p.alive) b.alert = true;
      else {
        h.aiming = false;
        const pd = Math.hypot(b.post.x - h.x, b.post.z - h.z);
        if (pd > 1.5) h.move(b.post.x - h.x, b.post.z - h.z, 1.3, dt); else h.speed = 0;
        return;
      }
    }
    h.hostile = true;
    if (!p.alive) { h.aiming = false; h.speed = 0; return; }
    if (b.flee) {
      h.aiming = false;
      h.move(h.x - px, h.z - pz, 6.5, dt);
      return;
    }
    const sees = d < 55 && !lineBlocked(h.x, h.z, px, pz, 1.2);
    h.aiming = sees;
    if (sees) {
      h.faceToward(px, pz, dt, 14);
      if (d > 22) h.move(px - h.x, pz - h.z, 3.2, dt, false);
      else {
        if (rand() < dt * 0.4) b.strafe *= -1;
        h.move(-(pz - h.z) * b.strafe, (px - h.x) * b.strafe, 1.8, dt, false);
      }
      b.cool -= dt;
      if (b.cool <= 0) {
        const burst = h.weapon === 'smg';
        b.cool = burst ? 0.18 + (rand() < 0.2 ? 0.8 : 0) : 0.7 + rand() * 0.8;
        combat.npcShoot(h, p.human, h.weapon, b.skill);
      }
    } else {
      h.move(px - h.x, pz - h.z, 5.5, dt);
    }
  }

  /** Turn an existing person (a bailing driver) into a mission enemy. */
  function adopt(h, { flee = false, weapon = 'pistol', skill = 0.5 } = {}) {
    h.weapon = h.weapon ?? weapon;
    h.persistent = true;
    h.brain = { post: { x: h.x, z: h.z }, alert: true, alertRange: 60, cool: 1, skill, flee, strafe: 1 };
    if (!list.includes(h)) list.push(h);
    if (!world.humans.includes(h)) world.humans.push(h);
  }

  return {
    list, spawn, alertAll, adopt,
    update(dt) {
      for (const h of list) think(h, dt);
    },
    remove(h) {
      const k = list.indexOf(h);
      if (k >= 0) list.splice(k, 1);
      const w = world.humans.indexOf(h);
      if (w >= 0) world.humans.splice(w, 1);
      h.dispose();
    },
    clear() { for (const h of [...list]) this.remove(h); },
  };
}
