// Deterministic screenshot scenes behind ?shot=NAME&seed=N. Each stages a real moment of play with
// the real systems, simulates it forward with a fixed step (an autopilot drives where needed), then
// renders once with the HUD:
//   cover   stolen Vela GT racing into the sunset on Coral Parade, two cruisers on its tail, a timed
//           delivery mission with its GPS route
//   chase   five-star police chase down Vega Blvd at dusk: cruisers, the helicopter, a burning wreck
//   combat  shoot-out with the Tiburones on Starwheel Pier as their getaway car explodes
//   vista   the title screen over the whole city, beach and pier at sunset
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

/** A car rolling straight at `speed` m/s (no AI: the scenes are short and the roads are straight). */
function rollingCar(game, type, color, x, z, heading, speed) {
  const v = game.vehicles.spawn(type, { x, z, heading, color });
  v.persistent = true;
  v.vx = Math.sin(heading) * speed; v.vz = Math.cos(heading) * speed;
  v.throttle = 1;
  return v;
}

/** Hold the player's car straight at speed while the world simulates around it. */
function holdSpeed(v, speed) {
  v.vx = Math.sin(v.heading) * speed; v.vz = Math.cos(v.heading) * speed;
  v.steerInput = 0; v.steer = 0;
}

/** Put the render camera at an offset in the car's frame (right, up, back) and look ahead of it. */
function chaseCam(game, v, { right = 0, up = 1.4, back = 6, aheadX = 0, ahead = 30, lookY = 1.6, fov = 68 }) {
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  const rx = -fz, rz = fx; // right of the heading
  const cam = game.camera;
  cam.position.set(v.x - fx * back + rx * right, v.y + up, v.z - fz * back + rz * right);
  cam.lookAt(v.x + fx * ahead + rx * aheadX, lookY, v.z + fz * ahead + rz * aheadX);
  cam.fov = fov; cam.updateProjectionMatrix();
}

const scenes = {
  // Golden hour on Coral Parade: the stolen Vela GT races west into the sun with two cruisers on
  // its tail, the Starwheel and the bay off to the left, Coral Strand's neon on the right.
  async cover(game) {
    begin(game, 18.55, 14820);
    game.missions.setCompleted(['homecoming']);
    giveWeapon(game.player.arsenal, 'pistol', 60);
    game.player.arsenal.current = 'pistol';
    const z = 8 * PITCH - LANE_INNER, x = 7 * PITCH + 70, heading = -Math.PI / 2, speed = 31;
    game.place(x, z, heading);
    game.populate();
    const v = rollingCar(game, 'vela', '#ff2a3a', x, z, heading, speed);
    game.player.enterVehicle(v);
    game.missions.startById('bait');
    game.missions.skipTo(3);
    game.wanted.atLeast(2);
    // one cruiser pulling alongside in the outer lane, another right behind
    const copSlots = [[4.2, -3.6], [13, 0.4]];
    const cops = copSlots.map(([back, side]) => {
      const c = game.police.spawnCarAt(x + back, z + side, heading);
      c.vx = -speed; c.vz = 0;
      return c;
    });
    const pinCops = () => cops.forEach((c, k) => { c.x = v.x + copSlots[k][0]; c.z = v.z + copSlots[k][1]; c.heading = heading; holdSpeed(c, speed); });
    // westbound traffic ahead and oncoming traffic in the far lanes
    rollingCar(game, 'marlin', '#2ec4b6', x - 46, z - (LANE_OUTER - LANE_INNER), heading, 17);
    rollingCar(game, 'cab', '#ffc300', x - 80, z, heading, 15);
    rollingCar(game, 'dune', '#f4f0e8', x - 40, 8 * PITCH + LANE_INNER, Math.PI / 2, 15);
    rollingCar(game, 'marlin', '#9b5cff', x - 95, 8 * PITCH + LANE_OUTER, Math.PI / 2, 14);
    // clear civilians from the player's lane so the run reads cleanly
    for (const t of [...game.vehicles.list]) {
      if (t.ai?.kind === 'traffic' && Math.abs(t.z - z) < 4 && t.x > x - 70 && t.x < x + 30) game.vehicles.remove(t);
    }
    for (let k = 0; k < 14; k++) game.peds.spawnNear(x - 40, z, 6, 60);
    simulate(game, 1.3, () => { holdSpeed(v, speed); v.z = z; v.heading = heading; pinCops(); });
    game.player.human.health = 86;
    game.player.human.armour = 40;
    game.hud.radio('WAVE 98.7', "Sunvale's synth station");
    game.hud.clearBanner();
    game.updateHud(DT);
    chaseCam(game, v, { right: 0.2, up: 1.55, back: 8.6, aheadX: -6, ahead: 40, lookY: 3.0, fov: 68 });
  },
  // Five stars on Vega Blvd at dusk: the camera rides ahead of the Vela looking back at the pack.
  async chase(game) {
    begin(game, 19.55, 23310);
    game.missions.setCompleted(['homecoming', 'bait', 'repo']);
    giveWeapon(game.player.arsenal, 'smg', 120);
    game.player.arsenal.current = 'smg';
    const x = 5 * PITCH - LANE_INNER, z = 1 * PITCH + 20, heading = 0, speed = 24;
    game.place(x, z, heading);
    game.populate();
    for (const t of [...game.vehicles.list]) {
      if (t.ai?.kind === 'traffic' && Math.abs(t.x - x) < 12 && t.z > z - 80 && t.z < z + 70) game.vehicles.remove(t);
    }
    const v = rollingCar(game, 'vela', '#ffb000', x, z, heading, speed);
    game.player.enterVehicle(v);
    game.wanted.atLeast(5);
    const cops = [];
    for (const [dz, dx] of [[-6.5, 2.4], [-11, -2.2], [-17, 1.0], [-24, -3], [-32, 2.8]]) {
      const c = game.police.spawnCarAt(x + dx, z + dz, 0);
      c.vx = 0; c.vz = speed;
      cops.push(c);
    }
    // a cruiser that lost it against a lamp post earlier, now burning at the kerb
    const wreck = game.vehicles.spawn('police', { x: 5 * PITCH + 7.2, z: z + 36, heading: 2.4 });
    wreck.persistent = true;
    const hold = () => { holdSpeed(v, speed); for (const c of cops) holdSpeed(c, speed); };
    simulate(game, 0.5, hold);
    wreck.explode();
    simulate(game, 1.5, hold);
    game.heli.active = true;
    game.heli.x = v.x - 4; game.heli.z = v.z - 26; game.heli.y = 20;
    simulate(game, 0.2, (t, last) => {
      hold();
      // the lead cruiser scrapes the Vela's bumper
      if (last) for (let k = 0; k < 3; k++) game.fx.sparks(v.x - 0.8, 0.5, v.z - v.hl - 0.4, 12);
    });
    game.hud.clearBanner();
    game.updateHud(DT);
    const cam = game.camera;
    cam.position.set(v.x + 3.4, 2.6, v.z + 10.5);
    cam.lookAt(v.x - 0.4, 3.4, v.z - 30);
    cam.fov = 66; cam.updateProjectionMatrix();
  },
  // Sharks on the Pier: Cass trades fire with the Tiburones as their getaway car goes up.
  async combat(game) {
    begin(game, 18.35, 41760);
    game.missions.setCompleted(['homecoming', 'bait', 'repo', 'lowtide']);
    giveWeapon(game.player.arsenal, 'smg', 150);
    giveWeapon(game.player.arsenal, 'pistol', 60);
    game.player.arsenal.current = 'smg';
    const cx = PIER.x0 + 7;
    game.place(cx + 1.6, CITY_H + 96, 0);
    game.populate();
    game.missions.startById('sharks');
    game.missions.skipTo(3);
    const h = game.player.human;
    h.armour = 64; h.health = 78;
    for (const e of game.enemies.list) e.brain.alert = true;
    const car = game.vehicles.spawn('marlin', { x: cx + 0.5, z: CITY_H + 136, heading: 1.2, color: '#1a1a1a' });
    car.persistent = true;
    const nearest = () => game.enemies.list.filter((e) => e.alive)
      .sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z))[0];
    const shootAt = (t) => {
      if (!t) return;
      h.aiming = true;
      h.heading = Math.atan2(t.x - h.x, t.z - h.z);
      const m = h.muzzle();
      const dx = t.x - m.x, dy = t.y + 1.3 - m.y, dz = t.z - m.z, l = Math.hypot(dx, dy, dz);
      game.combat.shoot(h, 'smg', m, { x: dx / l, y: dy / l, z: dz / l }, { spread: 0.03 });
    };
    simulate(game, 1.9, (t, last) => {
      h.aiming = true;
      h.x = cx + 1.6; h.z = CITY_H + 96;
      if (Math.abs(t - 1.58) < DT / 2) car.explode();
      if ((t > 1.2 && Math.round(t / DT) % 3 === 0) || last) shootAt(nearest());
      if (last) {
        // everyone still standing returns fire on the final frame
        for (const e of game.enemies.list) if (e.alive) { e.aiming = true; game.combat.npcShoot(e, h, e.weapon ?? 'pistol', 0.3); }
      }
    });
    game.hud.clearBanner();
    game.updateHud(DT);
    const cam = game.camera;
    cam.position.set(h.x + 1.5, h.y + 1.85, h.z - 2.6);
    cam.lookAt(h.x - 1.9, h.y + 2.6, h.z + 16);
    cam.fov = 50; cam.updateProjectionMatrix();
    document.getElementById('hud-crosshair').classList.remove('on');
  },
  // The title screen over the whole of Sunvale at sunset: city, beach, pier, Starwheel and bay.
  async vista(game) {
    game.state = 'title';
    game.world.hour = 18.6;
    game.clockSpeed = 0;
    game.player.human.setVisible(false);
    const fx0 = 6 * PITCH, fz0 = 6 * PITCH;
    game.place(fx0, fz0, 0);
    game.populate();
    simulate(game, 1);
    game.world.focus.x = PIER.x0; game.world.focus.z = CITY_H;
    game.city.update(game.world.time, 0, game.world.hour, game.world.focus);
    const q = new URLSearchParams(location.search);
    const n = (k, d) => Number(q.get(k) ?? d);
    game.camera.position.set(n('x', 470), n('y', 60), n('z', 1010));
    game.camera.lookAt(n('lx', 300), n('ly', 40), n('lz', 520));
    game.camera.fov = n('fov', 58); game.camera.updateProjectionMatrix();
    paintLogo(document.getElementById('logo'));
    const menus = createMenus({});
    menus.setContinue(true);
    menus.show('title');
    game.hud.show(false);
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
    game.camera.fov = n('fov', 62); game.camera.updateProjectionMatrix();
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
  game.markers.update(0, game.world.time, game.camera.position); // fade beams for the final camera
  await frames(2);
  game.render();
  await frames(2);
  game.render();
  void PLACES;
}
