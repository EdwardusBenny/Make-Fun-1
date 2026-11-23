// Saving and loading progress in localStorage: money, story progress, weapons and ammo, health and
// armour, where Cass stood, the time of day, Sun Tokens, race records and lifetime stats.

const KEY = 'sunvale.save.v1';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function writeSave(game) {
  const p = game.player;
  const h = p.human;
  const data = {
    version: 1,
    savedAt: Date.now(),
    money: p.money,
    missions: [...game.missions.completed],
    arsenal: JSON.parse(JSON.stringify(p.arsenal)),
    health: h.health, armour: h.armour,
    pos: { x: h.x, z: h.z, heading: h.heading },
    hour: game.world.hour,
    activities: game.activities.save(),
    stats: game.stats,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function readSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Apply a save to a freshly created game. */
export function applySave(game, data) {
  const p = game.player;
  p.money = data.money ?? 0;
  game.missions.setCompleted(data.missions ?? []);
  if (data.arsenal) Object.assign(p.arsenal, data.arsenal);
  p.human.health = Math.max(30, data.health ?? 100);
  p.human.armour = data.armour ?? 0;
  if (data.pos) game.place(data.pos.x, data.pos.z, data.pos.heading ?? 0);
  if (typeof data.hour === 'number') game.world.hour = data.hour;
  game.activities.load(data.activities ?? {});
  if (data.stats) Object.assign(game.stats, data.stats);
  game.hud.snapMoney(p.money);
}
