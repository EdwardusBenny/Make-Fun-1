// Runs the story: shows each contact's marker when they have work, starts a mission when Cass walks
// into it, steps through its script, handles failure (death, arrest, step failure) and success
// (cash, banner, autosave), and gives scripts helpers to spawn cars, drivers, enemies and fleeing targets.
import { MISSIONS } from './story.js';
import { CONTACTS } from './contacts.js';
import { Human } from '../actors/human.js';
import { DIRS } from '../city/roadgraph.js';
import { PITCH, LANE_OUTER } from '../city/layout.js';
import { formatMoney } from '../core/mathutil.js';
import { randInt } from '../core/random.js';

export function createMissions(game) {
  const { world, hud } = game;
  const completed = new Set();
  let active = null;      // { def, steps, index, ctx }
  let startMarkers = [];
  let cooldown = 0;

  function available() {
    return MISSIONS.filter((m) => !completed.has(m.id) && (m.requires ?? []).every((r) => completed.has(r)));
  }

  function refreshMarkers() {
    for (const m of startMarkers) m.marker.remove();
    startMarkers = [];
    if (active) return;
    const seen = new Set();
    for (const m of available()) {
      if (seen.has(m.contact) || m.auto) continue;
      seen.add(m.contact);
      const c = CONTACTS[m.contact];
      startMarkers.push({ def: m, marker: game.markers.add(c.place.x, c.place.z, { color: c.color, radius: 1.6, height: 4.5, label: c.label }) });
    }
  }

  function makeCtx(def) {
    const ctx = {
      game, def, data: {}, target: null, marker: null, vehicles: [], drivers: [],
      setObjective(html) { hud.setObjective(html, def.title); },
      clearMarker() { if (ctx.marker) { ctx.marker.remove(); ctx.marker = null; } },
      spawnVehicle(type, x, z, heading, color) {
        const v = game.vehicles.spawn(type, { x, z, heading, color });
        v.persistent = true;
        ctx.vehicles.push(v);
        return v;
      },
      spawnDriver(v, role) {
        const h = new Human(world, { role, seed: randInt(1, 1e7), x: v.x, z: v.z });
        h.state = 'drive'; h.vehicle = v; h.setVisible(false); h.persistent = true;
        h.weapon = 'pistol';
        world.humans.push(h);
        v.driver = h;
        ctx.drivers.push(h);
        return h;
      },
      spawnEnemy(role, x, z, opts) { return game.enemies.spawn(role, x, z, opts); },
      /** Hand a car to the traffic driver in panic mode, always turning away from Cass. */
      makeFlee(v) {
        const fx = v.forwardX, fz = v.forwardZ;
        let d = 0, best = -2;
        DIRS.forEach((dir, k) => { const dot = dir.x * fx + dir.z * fz; if (dot > best) { best = dot; d = k; } });
        const dir = DIRS[d];
        const i = dir.x > 0 ? Math.floor(v.x / PITCH) : dir.x < 0 ? Math.ceil(v.x / PITCH) : Math.round(v.x / PITCH);
        const j = dir.z > 0 ? Math.floor(v.z / PITCH) : dir.z < 0 ? Math.ceil(v.z / PITCH) : Math.round(v.z / PITCH);
        const along = (v.x - i * PITCH) * dir.x + (v.z - j * PITCH) * dir.z;
        game.traffic.attachBrain(v, i, j, d, along, LANE_OUTER);
        v.ai.cruise = 19; v.ai.panic = 1e9; v.ai.flee = true;
        v.ai.chooser = (ni, nj, dIn, opts) => {
          const p = game.player;
          const px = p.vehicle ? p.vehicle.x : p.x, pz = p.vehicle ? p.vehicle.z : p.z;
          let pickD = opts[0], far = -1;
          for (const o of opts) {
            const ex = (ni + DIRS[o].di) * PITCH, ez = (nj + DIRS[o].dj) * PITCH;
            const score = Math.hypot(ex - px, ez - pz) + Math.random() * 40;
            if (score > far) { far = score; pickD = o; }
          }
          return pickD;
        };
      },
      /** The driver jumps out; optionally runs as a fleeing enemy. */
      bail(v, flee) {
        const h = v.driver;
        if (!h || h === game.player.human) return;
        const door = v.doorPoint();
        h.vehicle = null; h.state = 'walk'; h.setVisible(true);
        h.x = door.x; h.z = door.z; h.collide();
        v.driver = null; v.ai = null; v.throttle = 0; v.handbrake = true;
        game.enemies.adopt(h, { flee });
      },
    };
    return ctx;
  }

  function start(def) {
    for (const m of startMarkers) m.marker.remove();
    startMarkers = [];
    const ctx = makeCtx(def);
    active = { def, steps: def.steps(), index: 0, ctx };
    hud.banner(def.title.toUpperCase(), CONTACTS[def.contact].name, '', 3.2);
    game.audio?.jingle('start');
    active.steps[0].start(ctx);
    world.events.emit('missionStart', def);
  }

  function cleanup(ctx) {
    ctx.clearMarker();
    hud.timer('');
    hud.setObjective('');
    for (const v of ctx.vehicles) { v.persistent = false; }
    for (const h of ctx.drivers) h.persistent = false;
    game.enemies.clear();
  }

  function fail(reason) {
    if (!active) return;
    const ctx = active.ctx;
    cleanup(ctx);
    hud.banner('MISSION FAILED', reason, 'wasted', 4);
    game.audio?.jingle('fail');
    world.events.emit('missionFail', active.def);
    active = null;
    cooldown = 5;
    refreshMarkers();
  }

  function pass() {
    const def = active.def;
    cleanup(active.ctx);
    completed.add(def.id);
    game.player.money += def.reward;
    hud.banner('MISSION PASSED', `${formatMoney(def.reward)}  ·  respect +`, '', 5);
    game.audio?.jingle('pass');
    world.events.emit('missionPass', def);
    active = null;
    cooldown = 3;
    refreshMarkers();
    game.save?.();
  }

  world.events.on('playerDown', (kind) => { if (active) fail(kind === 'busted' ? 'You were busted.' : 'You were wasted.'); });

  const api = {
    get active() { return active; },
    completed,
    update(dt) {
      if (cooldown > 0) cooldown -= dt;
      if (!active) {
        if (game.state !== 'play' || cooldown > 0) return;
        const auto = available().find((m) => m.auto);
        if (auto) { start(auto); return; }
        const p = game.player;
        const px = p.vehicle ? p.vehicle.x : p.x, pz = p.vehicle ? p.vehicle.z : p.z;
        for (const m of startMarkers) {
          if (Math.hypot(m.marker.x - px, m.marker.z - pz) < 2.6 && (!p.vehicle || p.vehicle.speed < 3)) { start(m.def); return; }
        }
        return;
      }
      if (game.state !== 'play') return;
      const ctx = active.ctx;
      const step = active.steps[active.index];
      const r = step.update(ctx, dt);
      if (r === 'done') {
        active.index++;
        if (active.index >= active.steps.length) pass();
        else active.steps[active.index].start(ctx);
      } else if (typeof r === 'string') fail(r);
    },
    blips() {
      const out = startMarkers.map((m) => {
        const c = CONTACTS[m.def.contact];
        return { x: m.marker.x, z: m.marker.z, color: c.color, size: 7, label: c.label, pin: true };
      });
      if (active?.ctx.target) out.push({ x: active.ctx.target.x, z: active.ctx.target.z, color: active.ctx.target.color ?? '#ffd23f', size: 7, pin: true });
      return out;
    },
    gps() {
      const t = active?.ctx.target;
      return t ? { x: t.x, z: t.z, color: t.color === '#ff4040' ? '#ff6060' : '#c46bff' } : null;
    },
    refresh: refreshMarkers,
    /** For saves and screenshots. */
    setCompleted(ids) { completed.clear(); for (const id of ids) completed.add(id); refreshMarkers(); },
    startById(id) { const def = MISSIONS.find((m) => m.id === id); if (def) start(def); },
    /** Jump the active mission to step `index` (screenshot staging). */
    skipTo(index) {
      if (!active) return;
      active.index = index;
      hud.subtitle('', 0.01);
      active.steps[index].start(active.ctx);
    },
    abort() { if (active) { cleanup(active.ctx); active = null; refreshMarkers(); } },
    count: MISSIONS.length,
  };
  return api;
}
