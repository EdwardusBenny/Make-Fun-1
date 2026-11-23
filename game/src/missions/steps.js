// Building blocks for mission scripts. Each step has start(ctx) and update(ctx, dt) and returns
// 'done' or a failure reason string from update; the runner advances through a mission's list.
import { CONTACTS } from './contacts.js';

const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** Dialogue lines [speaker, text]; the player keeps control while they play. */
export function say(lines, { blocking = true } = {}) {
  let k = -1, t = 0;
  const show = (ctx) => {
    const [who, text] = lines[k];
    const c = CONTACTS[who];
    const name = c ? c.name : who === 'cass' ? 'Cass' : who;
    const cls = c ? c.css : '';
    ctx.game.hud.subtitle(`<b class="${cls}">${name}:</b> ${text}`, 99);
    t = Math.max(2.6, text.length * 0.055);
  };
  return {
    start(ctx) { k = 0; show(ctx); },
    update(ctx, dt) {
      t -= dt;
      if (t > 0 && blocking) return null;
      if (t > 0) return 'done';
      k++;
      if (k >= lines.length) { ctx.game.hud.subtitle('', 0.01); return 'done'; }
      show(ctx);
      return null;
    },
  };
}

/** Go to a place. opts: radius, vehicle (must be in a car), onFoot, timer (seconds), color. */
export function goTo(where, text, opts = {}) {
  let left = 0;
  return {
    start(ctx) {
      const p = typeof where === 'function' ? where(ctx) : where;
      ctx.target = { x: p.x, z: p.z };
      ctx.marker = ctx.game.markers.add(p.x, p.z, { color: opts.color ?? '#ffd23f', radius: opts.radius ?? 3, height: 7 });
      ctx.setObjective(text);
      left = opts.timer ?? 0;
    },
    update(ctx, dt) {
      const pl = ctx.game.player;
      if (opts.timer) {
        left -= dt;
        ctx.game.hud.timer(fmtTime(Math.max(0, left)));
        if (left <= 0) return 'You ran out of time.';
      }
      if (opts.vehicle && !pl.vehicle) ctx.setObjective(opts.vehicleText ?? `Get back in a <b>vehicle</b>.`);
      else ctx.setObjective(text);
      const px = pl.vehicle ? pl.vehicle.x : pl.x, pz = pl.vehicle ? pl.vehicle.z : pl.z;
      const close = Math.hypot(px - ctx.target.x, pz - ctx.target.z) < (opts.radius ?? 3) + (pl.vehicle ? 1.5 : 0);
      if (close && (!opts.vehicle || pl.vehicle) && (!opts.onFoot || !pl.vehicle) && (!opts.slow || !pl.vehicle || pl.vehicle.speed < 4)) {
        ctx.clearMarker();
        ctx.game.hud.timer('');
        return 'done';
      }
      return null;
    },
  };
}

export function getVehicle(text = 'Steal a <b>car</b>: walk up to one and press <b>F</b>.') {
  return {
    start(ctx) { ctx.setObjective(text); ctx.target = null; },
    update(ctx) { return ctx.game.player.vehicle ? 'done' : null; },
  };
}

/** Stay inside a radius for `seconds` (e.g. waiting for a crew). */
export function holdAt(where, seconds, text, opts = {}) {
  let t = 0;
  return {
    start(ctx) {
      ctx.target = { x: where.x, z: where.z };
      ctx.marker = ctx.game.markers.add(where.x, where.z, { color: opts.color ?? '#ffd23f', radius: opts.radius ?? 4, height: 5 });
      t = seconds;
    },
    update(ctx, dt) {
      const pl = ctx.game.player;
      const px = pl.vehicle ? pl.vehicle.x : pl.x, pz = pl.vehicle ? pl.vehicle.z : pl.z;
      const inside = Math.hypot(px - where.x, pz - where.z) < (opts.radius ?? 4) + 2;
      if (inside) t -= dt;
      ctx.setObjective(inside ? `${text} <b>${Math.ceil(t)}</b>` : opts.awayText ?? 'Get back to the <b>marker</b>.');
      if (t <= 0) { ctx.clearMarker(); return 'done'; }
      return null;
    },
  };
}

export function raiseWanted(stars) {
  return { start(ctx) { ctx.game.wanted.atLeast(stars); }, update() { return 'done'; } };
}

export function loseWanted(text = 'Lose the <b>cops</b>.') {
  return {
    start(ctx) { ctx.setObjective(text); ctx.target = null; },
    update(ctx) { return ctx.game.wanted.level === 0 ? 'done' : null; },
  };
}

/** Run arbitrary code once. */
export function run(fn) {
  return { start(ctx) { fn(ctx); }, update() { return 'done'; } };
}

/** A custom step: start(ctx), update(ctx, dt) returning 'done', a failure string, or null. */
export function custom(start, update) { return { start, update }; }

export function wait(seconds) {
  let t = 0;
  return { start() { t = seconds; }, update(ctx, dt) { t -= dt; return t <= 0 ? 'done' : null; } };
}
