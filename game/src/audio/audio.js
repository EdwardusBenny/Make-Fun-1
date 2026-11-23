// All sound is synthesised with WebAudio, no files: a car engine whose pitch follows simulated gears,
// the two-tone police siren (louder as cruisers close in), gunshots, punches, crashes, explosions,
// horns, the bank alarm, UI jingles, and the car radio (see radio.js).
import { createRadio } from './radio.js';

export function createAudio() {
  let ctx = null, master, sfx, music, noiseBuf;
  let engine = null, siren = null, horn = null;
  let radio = null;
  let lastShot = 0;
  const a = {
    get ready() { return !!ctx; },
    volume: 0.8,
    /** Must be called from a user gesture. */
    init() {
      if (ctx) { ctx.resume?.(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = a.volume; master.connect(ctx.destination);
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
      comp.connect(master);
      sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(comp);
      music = ctx.createGain(); music.gain.value = 0.45; music.connect(comp);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      radio = createRadio(ctx, music, noiseBuf);
    },
    get radio() { return radio; },
  };

  function noise(dur, { type = 'bandpass', freq = 1200, q = 0.8, gain = 0.5, attack = 0.002, decay = dur, when = 0, dest = sfx, sweepTo = null } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + decay);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  function tone(freq, dur, { type = 'sine', gain = 0.3, when = 0, slideTo = null, dest = sfx, attack = 0.005 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  const vol = (dist) => Math.max(0, 1 - dist / 140);

  a.gunshot = (weapon, dist) => {
    const v = vol(dist);
    if (v <= 0 || !ctx) return;
    if (weapon === 'smg' && ctx.currentTime - lastShot < 0.03) return;
    lastShot = ctx.currentTime;
    noise(0.25, { type: 'lowpass', freq: 3800, gain: 0.7 * v, decay: weapon === 'smg' ? 0.12 : 0.22, sweepTo: 400 });
    tone(140, 0.12, { type: 'triangle', gain: 0.5 * v, slideTo: 45 });
  };
  a.punch = (hit) => { noise(0.1, { type: 'lowpass', freq: hit ? 900 : 2400, gain: hit ? 0.6 : 0.15, decay: 0.09 }); if (hit) tone(90, 0.08, { gain: 0.4, slideTo: 50 }); };
  a.explosion = (dist) => {
    const v = Math.max(0.1, 1 - dist / 260);
    noise(2.2, { type: 'lowpass', freq: 1400, gain: 0.9 * v, decay: 2.0, sweepTo: 120 });
    tone(70, 1.2, { gain: 0.8 * v, slideTo: 25 });
  };
  a.crash = (impact, dist) => {
    const v = vol(dist) * Math.min(1, impact / 14);
    if (v < 0.03) return;
    noise(0.4, { type: 'lowpass', freq: 1800, gain: 0.7 * v, decay: 0.35 });
    noise(0.25, { type: 'highpass', freq: 3000, gain: 0.25 * v, decay: 0.25, when: 0.02 });
  };
  a.hitPed = () => { noise(0.15, { type: 'lowpass', freq: 600, gain: 0.5, decay: 0.15 }); };
  a.reload = () => { tone(1800, 0.03, { type: 'square', gain: 0.08 }); tone(1200, 0.04, { type: 'square', gain: 0.08, when: 0.25 }); };
  a.dry = () => tone(2200, 0.02, { type: 'square', gain: 0.06 });
  a.honk = (dist) => { const v = vol(dist); if (v > 0) { tone(410, 0.45, { type: 'square', gain: 0.08 * v }); tone(520, 0.45, { type: 'square', gain: 0.06 * v }); } };
  a.alarm = () => { for (let k = 0; k < 24; k++) tone(k % 2 ? 950 : 780, 0.24, { type: 'square', gain: 0.07, when: k * 0.25 }); };
  a.jingle = (kind) => {
    if (!ctx) return;
    const seq = {
      pass: [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.5], [1047, 0.62]],
      fail: [[392, 0], [330, 0.2], [262, 0.4], [196, 0.6]],
      start: [[440, 0], [554, 0.1], [659, 0.2]],
      token: [[1319, 0], [1568, 0.07], [2093, 0.14]],
      buy: [[988, 0], [1319, 0.08]],
      checkpoint: [[880, 0], [1175, 0.08]],
      pickup: [[784, 0], [1175, 0.06]],
    }[kind] ?? [];
    for (const [f, t] of seq) { tone(f, 0.25, { type: 'triangle', gain: 0.22, when: t }); tone(f * 2, 0.18, { type: 'sine', gain: 0.06, when: t }); }
  };
  a.sting = (kind) => {
    if (!ctx) return;
    if (kind === 'wasted') { tone(220, 2.4, { type: 'sawtooth', gain: 0.12, slideTo: 55 }); noise(2.4, { type: 'lowpass', freq: 300, gain: 0.3, decay: 2.2 }); }
    else { for (let k = 0; k < 6; k++) tone(k % 2 ? 660 : 880, 0.3, { type: 'square', gain: 0.07, when: k * 0.3 }); }
  };

  function ensureLoops() {
    if (engine || !ctx) return;
    // engine: two detuned oscillators through a lowpass, plus a rumble
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'square';
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 3;
    const g = ctx.createGain(); g.gain.value = 0;
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(sfx);
    o1.start(); o2.start();
    engine = { o1, o2, lp, g };
    // siren: one oscillator swept by an LFO-driven schedule
    const so = ctx.createOscillator(); so.type = 'sawtooth';
    const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 2200;
    const sg = ctx.createGain(); sg.gain.value = 0;
    so.connect(sf); sf.connect(sg); sg.connect(sfx);
    so.start();
    siren = { so, sg };
    const h1 = ctx.createOscillator(); h1.type = 'square'; h1.frequency.value = 415;
    const h2 = ctx.createOscillator(); h2.type = 'square'; h2.frequency.value = 523;
    const hg = ctx.createGain(); hg.gain.value = 0;
    const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 1800;
    h1.connect(hf); h2.connect(hf); hf.connect(hg); hg.connect(sfx);
    h1.start(); h2.start();
    horn = { g: hg };
  }

  a.update = (dt, game) => {
    if (!ctx) return;
    ensureLoops();
    const t = ctx.currentTime;
    const p = game.player;
    const v = p.vehicle;
    const playing = game.state !== 'title' && !game.paused;
    if (v && playing && !v.wrecked) {
      const speed = Math.abs(v.forwardSpeed);
      // simple gearbox: rpm climbs within each gear band
      const band = 9 + (v.spec.maxSpeed / 6);
      const gear = Math.min(5, Math.floor(speed / band));
      const rpm = 0.25 + ((speed - gear * band) / band) * 0.75 * (gear < 5 ? 1 : 0.8) + Math.abs(v.throttle) * 0.08;
      const base = v.spec.mass > 2000 ? 38 : v.type === 'vela' ? 62 : 48;
      const f = base * (1 + rpm * 2.2);
      engine.o1.frequency.setTargetAtTime(f, t, 0.05);
      engine.o2.frequency.setTargetAtTime(f * 0.501, t, 0.05);
      engine.lp.frequency.setTargetAtTime(400 + rpm * 1400 + Math.abs(v.throttle) * 500, t, 0.08);
      engine.g.gain.setTargetAtTime(0.09 + Math.abs(v.throttle) * 0.06, t, 0.1);
      horn.g.gain.setTargetAtTime(v.horn ? 0.08 : 0, t, 0.02);
    } else {
      engine.g.gain.setTargetAtTime(0, t, 0.1);
      horn.g.gain.setTargetAtTime(0, t, 0.02);
    }
    const sd = game.world.nearestSiren;
    const sv = playing && sd < 150 ? Math.max(0, 1 - sd / 150) * 0.11 : 0;
    siren.sg.gain.setTargetAtTime(sv, t, 0.1);
    const wail = (Math.sin(game.world.time * 2.2) + 1) / 2;
    siren.so.frequency.setTargetAtTime(650 + wail * 650, t, 0.03);
    radio.update(t, playing && !!v);
  };

  // master mute when the tab is hidden
  document.addEventListener('visibilitychange', () => { if (ctx) master.gain.value = document.hidden ? 0 : a.volume; });
  return a;
}

/** Route world events to sounds. */
export function wireAudio(a, game) {
  const ev = game.world.events;
  const camDist = (x, z) => Math.hypot(x - game.camera.position.x, z - game.camera.position.z);
  ev.on('gunshot', (s, x, z, w) => a.gunshot(w, camDist(x, z)));
  ev.on('swing', (s, hit) => a.punch(hit));
  ev.on('npcPunch', () => a.punch(true));
  ev.on('explosion', (e) => a.explosion(camDist(e.x, e.z)));
  ev.on('crash', (v, impact) => a.crash(impact, camDist(v.x, v.z)));
  ev.on('carCrash', (x, y, impact) => a.crash(impact, camDist(x.x, x.z)));
  ev.on('runOver', () => a.hitPed());
  ev.on('reload', () => a.reload());
  ev.on('dryFire', () => a.dry());
  ev.on('honk', (v) => a.honk(camDist(v.x, v.z)));
  ev.on('pickup', (it) => a.jingle(it.kind === 'token' ? 'token' : 'pickup'));
  ev.on('playerDown', (kind) => a.sting(kind));
  ev.on('enterVehicle', (h, v) => { if (h === game.player.human) a.radio?.tuneIn(v); });
}
