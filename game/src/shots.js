// Deterministic screenshot scenes behind ?shot=NAME&seed=N. Each stages a real moment of play with
// the real systems, simulates it forward with a fixed step (an autopilot drives where needed), then
// renders once with the HUD:
//   cover   stolen Vela GT on Coral Parade at golden hour, traffic, a timed delivery mission
//   chase   four-star police chase down Vega Blvd at dusk, cruisers and the helicopter
//   combat  shoot-out with the Tiburones on Starwheel Pier
//   map     the full city map with contacts, shops and the GPS route
//   title   the title screen over the city
import { PITCH, CITY_H, PIER, LANE_OUTER, LANE_INNER, PLACES } from './city/layout.js';
import { giveWeapon } from './combat/weapons.js';
import { paintLogo } from './ui/logo.js';
import { createMenus } from './ui/menus.js';

const DT = 1 / 30;

function simulate(game, seconds, each) {
  const n = Math.round(seconds / DT);
  for (let k = 0; k < n; k++) {
    each?.(k * DT, k === n - 1);
    game.step(DT, null);
    game.updateHud(DT);
  }
}

function frames(n) {
  return new Promise((resolve) => {
    const tick = () => (n-- <= 0 ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });
}

function begin(game, hour, money) {
  game.state = 'play';
  game.world.hour = hour;
  game.clockSpeed = 0;
  game.player.money = money;
  game.hud.snapMoney(money);
  game.hud.show(true);
  game.activities.load({ tokens: [0, 3, 5] });
}

function driveCar(game, type, color, x, z, d, i, j, along, lane, cruise) {
  const v = game.vehicles.spawn(type, { x, z, heading: [Math.PI / 2, 0, -Math.PI / 2, Math.PI][d], color });
  v.persistent = true;
  game.player.enterVehicle(v);
  game.traffic.attachBrain(v, i, j, d, along, lane);
  v.ai.cruise = cruise; v.ai.panic = 1e9;
  v.ai.chooser = (ni, nj, dIn) => dIn;
  v.vx = Math.sin(v.heading) * cruise; v.vz = Math.cos(v.heading) * cruise;
  return v;
}

const scenes = {
  async cover(game) {
    begin(game, 17.35, 14820);
    game.missions.setCompleted(['homecoming']);
    giveWeapon(game.player.arsenal, 'pistol', 60);
    game.player.arsenal.current = 'pistol';
    const z = 8 * PITCH + LANE_OUTER, x = 2 * PITCH + 26;
    game.place(x, z, Math.PI / 2);
    game.populate();
    const v = driveCar(game, 'vela', '#ff3b3b', x, z, 0, 2, 8, 26, LANE_OUTER, 16);
    game.missions.startById('bait');
    game.missions.skipTo(3);
    game.cam.yaw = v.heading + 0.22; game.cam.pitch = 0.17; game.cam.idle = -100;
    simulate(game, 2.2, () => { game.cam.idle = -100; game.cam.yaw = v.heading + 0.22; });
    v.ai = null;
    game.player.human.health = 86;
    game.player.human.armour = 40;
    game.hud.radio('WAVE 98.7', "Sunvale's synth station");
    game.hud.clearBanner();
    game.updateHud(DT);
  },
  async chase(game) {
    begin(game, 19.3, 23310);
    game.missions.setCompleted(['homecoming', 'bait', 'repo']);
    giveWeapon(game.player.arsenal, 'smg', 120);
    game.player.arsenal.current = 'smg';
    const x = 5 * PITCH - LANE_INNER, z = 1 * PITCH + 24;
    game.place(x, z, 0);
    game.populate();
    const v = driveCar(game, 'vela', '#ffb000', x, z, 1, 5, 1, 24, LANE_INNER, 21);
    game.wanted.atLeast(4);
    const cops = [];
    for (const [dz, dx] of [[-8, -3.4], [-12.5, 2.6], [-19, -0.6]]) {
      const c = game.police.spawnCarAt(x + dx, z + dz, 0);
      c.vx = 0; c.vz = 21;
      cops.push(c);
    }
    // clear the lane ahead and behind of civilians so the chase reads clearly
    for (const t of [...game.vehicles.list]) {
      if (t !== v && t.ai?.kind === 'traffic' && Math.abs(t.x - x) < 9 && t.z > z - 60 && t.z < z + 60) game.vehicles.remove(t);
    }
    const look = () => { game.cam.idle = -100; game.cam.yaw = v.heading + Math.PI * 0.9; game.cam.pitch = 0.22; };
    simulate(game, 0.45, look);
    game.heli.active = true;
    game.heli.x = v.x + 3; game.heli.z = v.z - 46; game.heli.y = 12;
    simulate(game, 0.15, look);
    v.ai = null;
    game.hud.clearBanner();
    game.updateHud(DT);
  },
  async combat(game) {
    begin(game, 17.9, 41760);
    game.missions.setCompleted(['homecoming', 'bait', 'repo', 'lowtide']);
    giveWeapon(game.player.arsenal, 'smg', 150);
    giveWeapon(game.player.arsenal, 'pistol', 60);
    game.player.arsenal.current = 'smg';
    const cx = PIER.x0 + 7;
    game.place(cx - 1, CITY_H + 98, 0);
    game.populate();
    game.missions.startById('sharks');
    game.missions.skipTo(3);
    const h = game.player.human;
    h.armour = 64; h.health = 78;
    for (const e of game.enemies.list) e.brain.alert = true;
    const shootAt = () => {
      const targets = game.enemies.list.filter((e) => e.alive);
      const t = targets.sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z))[0];
      if (!t) return;
      h.aiming = true;
      h.heading = Math.atan2(t.x - h.x, t.z - h.z);
      const m = h.muzzle();
      const dx = t.x - m.x, dy = t.y + 1.3 - m.y, dz = t.z - m.z, l = Math.hypot(dx, dy, dz);
      game.combat.shoot(h, 'smg', m, { x: dx / l, y: dy / l, z: dz / l }, { spread: 0.03 });
    };
    simulate(game, 1.6, (t, lastStep) => {
      h.aiming = true;
      if ((t > 1.1 && Math.round(t / DT) % 3 === 0) || lastStep) shootAt();
    });
    game.hud.clearBanner();
    game.updateHud(DT);
    const cam = game.camera;
    cam.position.set(h.x + 3.0, h.y + 2.2, h.z - 4.4);
    cam.lookAt(h.x - 1.2, h.y + 1.3, h.z + 14);
    cam.fov = 60; cam.updateProjectionMatrix();
    document.getElementById('hud-crosshair').classList.remove('on');
  },
  async map(game) {
    begin(game, 17.5, 41760);
    game.missions.setCompleted(['homecoming', 'bait', 'repo']);
    game.place(6 * PITCH - 3.5, 6 * PITCH + 30, Math.PI);
    game.populate();
    game.wanted.atLeast(2);
    simulate(game, 3);
    game.mapOpen = true;
    document.getElementById('bigmap').classList.remove('hidden');
    game.updateHud(DT);
  },
  /** Free camera for checking the city: &x=&z=&y=&lx=&lz=&hour= */
  async look(game) {
    const q = new URLSearchParams(location.search);
    const n = (k, d) => Number(q.get(k) ?? d);
    game.state = 'title';
    game.world.hour = n('hour', 17.4);
    game.clockSpeed = 0;
    game.player.human.setVisible(false);
    game.place(n('x', 400), n('z', 600), 0);
    game.populate();
    simulate(game, 0.5);
    game.camera.position.set(n('x', 400), n('y', 30), n('z', 600));
    game.camera.lookAt(n('lx', 400), n('ly', 5), n('lz', 400));
    game.hud.show(false);
  },
  async title(game) {
    game.state = 'title';
    game.world.hour = 17.8;
    game.clockSpeed = 0;
    game.player.human.setVisible(false);
    const ox = 4.5 * PITCH, oz = CITY_H + 30;
    game.place(ox, oz, 0);
    game.populate();
    simulate(game, 1);
    game.camera.position.set(ox + 70, 34, oz + 95);
    game.camera.lookAt(ox - 20, 22, oz - 160);
    paintLogo(document.getElementById('logo'));
    const menus = createMenus({});
    menus.setContinue(true);
    menus.show('title');
    game.hud.show(false);
  },
};

export async function stageShot(name, game) {
  const scene = scenes[name] ?? scenes.cover;
  await scene(game);
  await frames(2);
  game.render();
  await frames(2);
  game.render();
  void PLACES;
}
