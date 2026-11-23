// Boot and the main loop. The title screen flies a camera over the living city; New Game or
// Continue hands control to Cass. The loop reads input, steps the simulation (clamped dt), updates
// the HUD and renders. Esc/P pauses, M opens the city map, Q changes the radio station.
//
// ?seed=N fixes the city's random population. ?shot=NAME stages a screenshot scene (shots.js),
// renders it and sets window.__shotReady instead of running the loop.
import { reseed, createRandom } from './core/random.js';
import { createInput } from './core/input.js';
import { createGame } from './game.js';
import { createAudio, wireAudio } from './audio/audio.js';
import { createMenus } from './ui/menus.js';
import { paintLogo } from './ui/logo.js';
import { hasSave, readSave, writeSave, applySave } from './save.js';
import { PLACES, CITY_H, PITCH } from './city/layout.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (Date.now() % 1e9);
reseed(seed);
if (shot) Math.random = createRandom(seed * 31 + 7); // every effect repeatable in screenshots

const canvas = document.getElementById('view');
const audio = createAudio();
const game = createGame(canvas, { audio });
wireAudio(audio, game);
game.save = () => writeSave(game);
window.__sunvale = game; // handle for automated tests in the dev tools
paintLogo(document.getElementById('logo'));
document.getElementById('loading').classList.add('hidden');

if (shot) {
  stageShot(shot, game).then(() => { window.__shotReady = true; });
} else {
  run();
}

function run() {
  const input = createInput(canvas);
  let mode = 'title';
  let wasLocked = false;
  let last = performance.now();
  let autosave = 0;
  const orbit = { x: 4.5 * PITCH, z: CITY_H + 30, a: 0 };

  const menus = createMenus({
    continue() { startGame(readSave()); },
    new() { startGame(null); },
    resume() { resume(); },
    map() { menus.show(null); game.mapOpen = true; document.getElementById('bigmap').classList.remove('hidden'); mode = 'map'; },
    save() { const ok = writeSave(game); game.hud.help(ok ? 'Game saved.' : 'Could not save (storage unavailable).', 3); resume(); },
    quit() { writeSave(game); location.reload(); },
  });

  function toTitle() {
    mode = 'title';
    game.state = 'title';
    game.player.human.setVisible(false);
    game.place(orbit.x, orbit.z, 0);
    game.world.hour = 17.8;
    game.populate();
    menus.setContinue(hasSave());
    menus.show('title');
  }

  function startGame(data) {
    audio.init();
    game.state = 'play';
    game.timeScale = 1;
    game.player.human.setVisible(true);
    if (data) applySave(game, data);
    else {
      game.place(PLACES.start.x, PLACES.start.z, 0);
      game.world.hour = 16.8;
      game.player.money = 120;
      game.hud.snapMoney(120);
      game.activities.load({});
      game.missions.refresh();
      game.hud.banner('SUNVALE', 'Four years upstate. The city didn\'t wait for Cass Moreno.', '', 5);
    }
    game.populate();
    menus.show(null);
    game.hud.show(true);
    input.wantLock = true;
    canvas.requestPointerLock?.();
    mode = 'play';
    game.hud.help('<kbd>WASD</kbd> move · <kbd>Mouse</kbd> look · <kbd>F</kbd> steal/enter cars · <kbd>M</kbd> map · <kbd>Esc</kbd> pause', 8);
  }

  function pause() {
    if (mode !== 'play') return;
    mode = 'paused';
    game.paused = true;
    menus.pauseStats(game);
    menus.show('pause');
    game.hud.show(false);
    input.releaseLock();
  }
  function resume() {
    mode = 'play';
    game.paused = false;
    game.mapOpen = false;
    document.getElementById('bigmap').classList.add('hidden');
    menus.show(null);
    game.hud.show(true);
    canvas.requestPointerLock?.();
  }

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (wasLocked && !locked && mode === 'play') pause();
    wasLocked = locked;
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('click', () => audio.init(), { once: true });
  window.addEventListener('keydown', () => audio.init(), { once: true });

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (mode === 'title') {
      orbit.a += dt * 0.05;
      game.step(dt, null);
      const cam = game.camera;
      cam.position.set(orbit.x + Math.sin(orbit.a) * 120, 38, orbit.z + 40 + Math.cos(orbit.a) * 60);
      cam.lookAt(orbit.x, 18, orbit.z - 160);
      game.render();
      input.endFrame();
      return;
    }
    if (mode === 'play') {
      if (input.hit('Escape') || input.hit('KeyP')) { pause(); input.endFrame(); return; }
      if (input.hit('KeyM')) {
        game.mapOpen = !game.mapOpen;
        document.getElementById('bigmap').classList.toggle('hidden', !game.mapOpen);
      }
      if (input.hit('KeyQ') && game.player.vehicle && audio.radio) {
        const st = audio.radio.next();
        game.player.vehicle.radioStation = audio.radio.STATIONS.indexOf(st);
        game.hud.radio(st.name, st.tag);
      }
      if (!game.mapOpen) game.step(dt, input);
      game.updateHud(dt);
      autosave += dt;
      if (autosave > 60 && game.state === 'play' && !game.missions.active) { autosave = 0; writeSave(game); }
    } else if (mode === 'map') {
      game.updateHud(dt);
      if (input.hit('KeyM') || input.hit('Escape')) resume();
    } else if (mode === 'paused') {
      if (input.hit('KeyP')) resume();
    }
    game.render();
    input.endFrame();
  }
  game.world.events.on('enterVehicle', (h, v) => {
    if (h !== game.player.human || !audio.radio) return;
    const st = audio.radio.station;
    if (!st.off) game.hud.radio(st.name, st.tag);
    void v;
  });
  toTitle();
  requestAnimationFrame(frame);
}
