// Cass Moreno, the player: on-foot movement relative to the camera (jog, sprint, jump), aiming and
// firing along the crosshair, punches, weapon switching and reloads, stealing cars (dragging the
// driver out), driving, drive-by shooting, and bailing out at speed.
import { Human } from './human.js';
import { WEAPONS, WEAPON_ORDER, newArsenal } from '../combat/weapons.js';
import { resolveCircle } from '../city/collision.js';

export function createPlayer(world, { combat, vehicles }) {
  const human = new Human(world, { role: 'player', x: 0, z: 0 });
  human.armour = 0;
  human.persistent = true;
  const player = {
    human,
    arsenal: newArsenal(),
    money: 0,
    cooldown: 0,
    reloading: 0,
    get x() { return human.x; },
    get z() { return human.z; },
    get alive() { return human.alive; },
    get vehicle() { return human.vehicle; },
    get weapon() { return player.arsenal.current; },
    hitMarker: 0,
  };

  function weaponOwned(id) { return id === 'fists' || player.arsenal[id]?.owned; }

  function switchWeapon(step) {
    let k = WEAPON_ORDER.indexOf(player.arsenal.current);
    for (let n = 0; n < WEAPON_ORDER.length; n++) {
      k = (k + step + WEAPON_ORDER.length) % WEAPON_ORDER.length;
      if (weaponOwned(WEAPON_ORDER[k])) { player.arsenal.current = WEAPON_ORDER[k]; break; }
    }
  }

  function reload() {
    const id = player.arsenal.current;
    if (id === 'fists') return;
    const slot = player.arsenal[id];
    const need = WEAPONS[id].clip - slot.clip;
    if (need <= 0 || slot.ammo <= 0 || player.reloading > 0) return;
    player.reloading = WEAPONS[id].reload;
    world.events.emit('reload', human);
  }

  function finishReload() {
    const id = player.arsenal.current;
    if (id === 'fists') return;
    const slot = player.arsenal[id];
    const take = Math.min(WEAPONS[id].clip - slot.clip, slot.ammo);
    slot.clip += take; slot.ammo -= take;
  }

  /** Fire the current gun toward whatever is under the crosshair. */
  function fireGun(cam) {
    const id = player.arsenal.current;
    const slot = player.arsenal[id];
    if (slot.clip <= 0) { reload(); if (slot.ammo <= 0) world.events.emit('dryFire'); return; }
    slot.clip--;
    player.cooldown = WEAPONS[id].cooldown;
    // find the aim point from the camera, then shoot at it from the muzzle
    const o = { x: cam.pos.x, y: cam.pos.y, z: cam.pos.z };
    const d = { x: cam.dir.x, y: cam.dir.y, z: cam.dir.z };
    const aim = combat.trace(o, d, 160, human);
    const ax = o.x + d.x * aim.t, ay = o.y + d.y * aim.t, az = o.z + d.z * aim.t;
    let m;
    if (human.vehicle) {
      const v = human.vehicle;
      m = { x: v.x + (ax - v.x) / Math.hypot(ax - v.x, az - v.z) * 1.3, y: v.y + v.spec.h - 0.2, z: v.z + (az - v.z) / Math.hypot(ax - v.x, az - v.z) * 1.3 };
    } else m = human.muzzle();
    const dx = ax - m.x, dy = ay - m.y, dz = az - m.z;
    const l = Math.hypot(dx, dy, dz) || 1;
    const hit = combat.shoot(human, id, m, { x: dx / l, y: dy / l, z: dz / l }, { spread: WEAPONS[id].spread * (human.aiming ? 1 : 2.2) * (human.vehicle ? 2 : 1) });
    cam.addShake(id === 'smg' ? 0.05 : 0.12);
    if (hit.human || hit.vehicle) player.hitMarker = 0.15;
    if (slot.clip === 0) reload();
  }

  function enterVehicle(v) {
    if (v.driver && v.driver !== human) {
      const d = v.driver;
      const door = v.doorPoint();
      d.vehicle = null; d.state = 'walk'; d.setVisible(true);
      d.x = door.x; d.z = door.z;
      d.takeDamage(4, { kind: 'melee', source: human, knockdown: true, dirX: d.x - v.x, dirZ: d.z - v.z, force: 3 });
      world.events.emit('carjack', human, v, d);
      if (d.role === 'civ' && !world.peds.list.includes(d)) {
        d.brain = { mode: 'beach', dir: 1, z: d.z, walk: 1.4, flee: 9, fx: v.x, fz: v.z };
        world.peds.list.push(d);
      }
    }
    v.driver = human;
    v.ai = null;
    v.handbrake = false;
    human.vehicle = v;
    human.state = 'drive';
    human.aiming = false;
    human.setVisible(false);
    world.events.emit('enterVehicle', human, v);
  }

  function exitVehicle() {
    const v = human.vehicle;
    if (!v) return;
    const speed = v.speed;
    const door = v.doorPoint();
    const r = resolveCircle(door.x, door.z, 0.4);
    human.x = r.x; human.z = r.z;
    human.heading = v.heading;
    human.vehicle = null;
    human.state = 'walk';
    human.setVisible(true);
    v.driver = null;
    v.throttle = 0; v.steerInput = 0;
    v.handbrake = speed < 3;
    if (speed > 9) {
      // bailing out at speed hurts
      human.takeDamage(Math.min(40, speed * 1.2), { kind: 'car', knockdown: true, dirX: -v.forwardZ, dirZ: v.forwardX, force: 4 });
    }
    world.events.emit('exitVehicle', human, v);
  }

  player.update = (dt, input, cam) => {
    if (player.cooldown > 0) player.cooldown -= dt;
    if (player.reloading > 0) { player.reloading -= dt; if (player.reloading <= 0) finishReload(); }
    if (player.hitMarker > 0) player.hitMarker -= dt;
    if (!human.alive) { human.aiming = false; return; }
    if (input.hit('Digit1')) player.arsenal.current = 'fists';
    if (input.hit('Digit2') && weaponOwned('pistol')) player.arsenal.current = 'pistol';
    if (input.hit('Digit3') && weaponOwned('smg')) player.arsenal.current = 'smg';
    if (input.mouse.wheel) switchWeapon(input.mouse.wheel > 0 ? 1 : -1);
    if (input.hit('KeyR')) reload();
    const weapon = WEAPONS[player.arsenal.current];
    const wantFire = weapon.auto ? input.mouse.left : input.mouse.leftPressed;

    if (human.vehicle) {
      const v = human.vehicle;
      v.throttle = input.axis('KeyS', 'KeyW') || input.axis('ArrowDown', 'ArrowUp');
      v.steerInput = input.axis('KeyA', 'KeyD') || input.axis('ArrowLeft', 'ArrowRight');
      v.handbrake = input.down('Space');
      v.horn = input.down('KeyH');
      cam.lookBehind = input.down('KeyC');
      human.x = v.x; human.z = v.z;
      if (input.hit('KeyF')) exitVehicle();
      else if (wantFire && !weapon.melee && player.cooldown <= 0 && player.reloading <= 0) fireGun(cam);
      return;
    }
    cam.lookBehind = false;
    // on foot
    const fwd = input.axis('KeyS', 'KeyW'), strafe = input.axis('KeyA', 'KeyD');
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
    const rx = -fz, rz = fx;
    const mx = fx * fwd + rx * strafe, mz = fz * fwd + rz * strafe;
    human.aiming = input.mouse.right && human.state === 'walk';
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = human.aiming ? 2.6 : sprint ? 7.4 : 4.6;
    human.move(mx, mz, (mx || mz) ? speed : 0, dt);
    if (human.aiming || (wantFire && !weapon.melee)) human.heading = cam.yaw;
    if (input.hit('Space') && human.jump === 0 && human.state === 'walk') { human.vy = 6.5; human.jump = 0.001; }
    if (input.hit('KeyF')) {
      const v = vehicles.nearest(human.x, human.z, 3.2, (c) => !c.wrecked && !c.locked);
      if (v) { enterVehicle(v); return; }
    }
    if (wantFire && human.state === 'walk') {
      if (weapon.melee) { if (player.cooldown <= 0) { player.cooldown = weapon.cooldown; combat.punch(human); } }
      else if (player.cooldown <= 0 && player.reloading <= 0) fireGun(cam);
    }
  };

  player.enterVehicle = enterVehicle;
  player.exitVehicle = exitVehicle;
  player.reset = () => {
    human.alive = true; human.health = human.maxHealth; human.state = 'walk'; human.stateTime = 0;
    human.vx = human.vz = 0; human.setVisible(true); human.vehicle = null;
  };
  return player;
}
