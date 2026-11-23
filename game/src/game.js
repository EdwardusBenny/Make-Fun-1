// The game: creates the renderer, city and every system, wires them through the event bus, turns
// crimes into heat, handles wasted/busted and respawns, and runs one frame of simulation + render.
import * as THREE from 'three';
import { buildCity } from './city/city.js';
import { createEvents } from './core/events.js';
import { createFollowCamera } from './core/camera.js';
import { createVehicleSystem } from './vehicles/vehicles.js';
import { createTraffic } from './vehicles/traffic.js';
import { createPedestrians } from './actors/pedestrians.js';
import { createEnemies } from './actors/enemies.js';
import { createPlayer } from './actors/player.js';
import { createCombat } from './combat/combat.js';
import { createParticles } from './fx/particles.js';
import { createTracers } from './fx/tracers.js';
import { createWanted } from './police/wanted.js';
import { createPolice } from './police/police.js';
import { createHelicopter } from './police/helicopter.js';
import { createHud } from './ui/hud.js';
import { createMinimap } from './ui/minimap.js';
import { createBigMap } from './ui/bigmap.js';
import { paintCityMap } from './ui/mapimage.js';
import { districtAt, streetNameAt, PLACES } from './city/layout.js';
import { createMissions } from './missions/missions.js';
import { createActivities } from './missions/activities.js';
import { createPickups } from './missions/pickups.js';
import { createMarkers } from './missions/markers.js';
import { mapBlips, MAP_LEGEND } from './ui/blips.js';
import { rand } from './core/random.js';

export function createGame(canvas, { audio = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.3, 3200);

  const events = createEvents();
  const world = { scene, events, camera, time: 0, hour: 17.5, humans: [], vehicles: [], player: null, focus: { x: 0, z: 0 }, nearestSiren: Infinity, paused: false };
  const city = buildCity(scene, renderer);
  const fx = createParticles(scene);
  const tracers = createTracers(scene);
  const vehicles = createVehicleSystem(world);
  const combat = createCombat(world, fx, tracers);
  const player = createPlayer(world, { combat, vehicles });
  world.player = player;
  world.humans.push(player.human);
  const traffic = createTraffic(world, vehicles);
  const peds = createPedestrians(world);
  world.peds = peds;
  const enemies = createEnemies(world, { combat });
  const wanted = createWanted(world);
  const police = createPolice(world, { vehicles, combat, wanted });
  const heli = createHelicopter(world, { combat, wanted });
  world.heli = heli;
  const cam = createFollowCamera(camera);
  const hud = createHud();
  const mapImage = paintCityMap();
  const minimap = createMinimap(document.getElementById('hud-minimap'), mapImage);
  const bigmap = createBigMap(document.getElementById('bigmap'), mapImage);
  const markers = createMarkers(scene);
  const pickups = createPickups(world, { fx });
  const game = {
    world, scene, camera, renderer, city, fx, vehicles, combat, player, traffic, peds, enemies, wanted, police, heli, cam, hud, markers, pickups, audio,
    stats: { kills: 0, carsStolen: 0, played: 0, deaths: 0, arrests: 0 },
    flags: {},
    mapOpen: false,
    state: 'play', // play | wasted | busted
    stateTime: 0,
    timeScale: 1,
    clockSpeed: 1 / 60, // game hours per real second (1 minute per in-game hour)
  };
  game.missions = createMissions(game);
  game.activities = createActivities(game);

  // --- crimes and reactions
  const P = () => player.human;
  events.on('gunshot', (shooter) => { if (shooter === P()) { wanted.report('gunfire'); traffic.panic(shooter.x, shooter.z, 40); } });
  events.on('hurt', (h, info) => {
    if (h === P()) { hud.hurt(); cam.addShake(0.15); return; }
    if (info.source === P() && h.role === 'civ' && info.kind === 'melee') wanted.report('assault', h.x, h.z);
  });
  events.on('death', (h, info) => {
    if (h === P()) { onWasted(); return; }
    const byPlayer = info.source === P() || (info.vehicle && info.vehicle.driver === P());
    if (byPlayer) {
      game.stats.kills++;
      if (h.role === 'civ') wanted.report('murder', h.x, h.z);
      // the dead sometimes drop cash
      if (rand() < 0.55) pickups.spawn('cash', h.x + 0.6, h.z, { amount: 10 + Math.floor(rand() * (h.role === 'civ' ? 50 : 120)) });
      if (h.role === 'police' && rand() < 0.5) pickups.spawn('ammo', h.x - 0.6, h.z);
    }
  });
  events.on('runOver', (v, h, speed, killed) => { if (v.driver === P() && !killed && h.role === 'civ') wanted.report('hitPed', h.x, h.z); });
  events.on('carjack', () => { wanted.report('carjack'); game.stats.carsStolen++; });
  events.on('explosion', (e) => {
    const d = Math.hypot(e.x - camera.position.x, e.z - camera.position.z);
    cam.addShake(Math.max(0, 1 - d / 60) * 1.2);
    if (e.source === P()) wanted.report('explosion', e.x, e.z);
  });

  function onWasted() {
    if (game.state !== 'play') return;
    game.state = 'wasted'; game.stateTime = 0;
    game.stats.deaths++;
    hud.banner('WASTED', '', 'wasted', 5);
    events.emit('playerDown', 'wasted');
  }
  events.on('busted', () => {
    if (game.state !== 'play') return;
    game.state = 'busted'; game.stateTime = 0;
    game.stats.arrests++;
    if (player.vehicle) player.exitVehicle();
    P().aiming = false;
    hud.banner('BUSTED', '', 'busted', 5);
    events.emit('playerDown', 'busted');
  });

  function respawn(kind) {
    const place = kind === 'busted' ? PLACES.police : PLACES.hospital;
    const fee = Math.min(player.money, kind === 'busted' ? 500 : 300);
    player.money -= fee;
    if (kind === 'busted') {
      for (const id of ['pistol', 'smg']) { player.arsenal[id].ammo = Math.floor(player.arsenal[id].ammo / 2); }
    }
    player.reset();
    P().x = place.x; P().z = place.z + (kind === 'busted' ? -3 : -3);
    P().heading = Math.PI;
    P().armour = 0;
    wanted.clear();
    police.reset();
    game.state = 'play';
    hud.banner(kind === 'busted' ? 'RELEASED' : 'PATCHED UP', `-$${fee} ${kind === 'busted' ? 'bail' : 'hospital bill'}`, '', 3);
    events.emit('respawn', kind);
  }

  // --- the frame
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fx.resize(h);
  }
  window.addEventListener('resize', resize);
  resize();

  game.place = (x, z, heading = 0) => {
    P().x = x; P().z = z; P().heading = heading;
    cam.yaw = heading;
    world.focus.x = x; world.focus.z = z;
  };

  game.populate = () => {
    traffic.populate(P().x, P().z);
    peds.populate(P().x, P().z);
  };

  game.step = (dt, input) => {
    dt *= game.timeScale;
    world.time += dt;
    game.stats.played += dt;
    world.hour = (world.hour + dt * game.clockSpeed) % 24;
    if (input) {
      cam.look(input.mouse.dx, input.mouse.dy);
      game.activities.preInput(input);
      if (game.state === 'play') player.update(dt, input, cam);
    }
    if (game.state === 'wasted' || game.state === 'busted') {
      game.stateTime += dt;
      game.timeScale = game.stateTime < 3 ? 0.35 : 1;
      if (game.stateTime > 4.2) { game.timeScale = 1; respawn(game.state); }
    }
    const fp = player.vehicle ?? P();
    world.focus.x = fp.x; world.focus.z = fp.z;
    traffic.update(dt);
    police.update(dt);
    heli.update(dt);
    peds.update(dt);
    enemies.update(dt);
    game.missions.update(dt, input);
    game.activities.update(dt, input);
    vehicles.update(dt);
    for (const h of world.humans) {
      if (h.state === 'drive' && h.vehicle) { h.x = h.vehicle.x; h.z = h.vehicle.z; }
      h.update(dt);
    }
    // humans don't stand inside each other
    const hs = world.humans;
    for (let a = 0; a < hs.length; a++) {
      const A = hs[a];
      if (A.state !== 'walk') continue;
      for (let b = a + 1; b < hs.length; b++) {
        const B = hs[b];
        if (B.state !== 'walk') continue;
        const dx = B.x - A.x, dz = B.z - A.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 0.49 || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), push = (0.7 - d) / 2;
        A.x -= dx / d * push; A.z -= dz / d * push; B.x += dx / d * push; B.z += dz / d * push;
      }
    }
    // burning wrecks smoke; hurt cars smoke lightly
    for (const v of world.vehicles) {
      const ratio = v.health / v.spec.health;
      v.smokeTimer -= dt;
      if (v.smokeTimer <= 0 && (ratio < 0.35 || v.wrecked)) {
        v.smokeTimer = v.wrecked ? 0.12 : 0.18;
        const fx0 = v.x + v.forwardX * v.hl * 0.7, fz0 = v.z + v.forwardZ * v.hl * 0.7;
        fx.carSmoke(fx0, v.spec.h, fz0, v.wrecked || ratio < 0.15);
        if (v.health <= 0 && !v.wrecked) { fx.fire(fx0, v.spec.h * 0.8, fz0); fx.fire(fx0, v.spec.h * 0.8, fz0); }
        if (v.wrecked && v.stateFire === undefined) v.stateFire = 8;
      }
      if (v.wrecked && v.stateFire > 0) { v.stateFire -= dt; if (rand() < 0.5) fx.fire(v.x, 0.8, v.z); }
      if (v.slip > 4 && v.speed > 6 && v === player.vehicle && rand() < 0.5) { fx.dust(v.x - v.forwardX * v.hl, v.z - v.forwardZ * v.hl, 0.8); }
    }
    wanted.update(dt);
    pickups.update(dt);
    markers.update(dt, world.time);
    cam.update(dt, { human: P(), vehicle: player.vehicle });
    fx.update(dt);
    tracers.update(dt);
    city.update(world.time, dt, world.hour, world.focus);
    audio?.update(dt, game);
  };

  game.updateHud = (dt) => {
    const h = P();
    const v = player.vehicle;
    const slot = player.arsenal[player.weapon];
    hud.update(dt, {
      money: player.money, wanted: wanted.level, flashing: wanted.flashing, weapon: player.weapon,
      clip: slot?.clip ?? 0, ammo: slot?.ammo ?? 0, reloading: player.reloading > 0,
      health: h.health, armour: h.armour, hour: world.hour, district: districtAt(world.focus.x, world.focus.z), street: streetNameAt(world.focus.x, world.focus.z),
      vehicle: v, aiming: h.aiming || (!!v && !['fists'].includes(player.weapon) && false), hitMarker: player.hitMarker > 0,
    });
    const blips = mapBlips(game);
    const gps = game.missions.gps() ?? game.activities.gps();
    const speed = v ? v.speed : 0;
    const zoom = 0.75 + Math.min(speed, 40) * 0.025;
    minimap.draw(world.focus.x, world.focus.z, cam.yaw, v ? v.heading : h.heading, zoom, blips, gps,
      wanted.level > 0 && wanted.flashing ? { x: wanted.seenX, z: wanted.seenZ, r: wanted.searchRadius } : null, Math.floor(world.time * 3) % 2 === 0);
    if (game.mapOpen) bigmap.draw({ x: world.focus.x, z: world.focus.z, heading: v ? v.heading : h.heading }, blips, gps, MAP_LEGEND);
  };

  game.render = () => renderer.render(scene, camera);
  game.respawn = respawn;
  return game;
}
