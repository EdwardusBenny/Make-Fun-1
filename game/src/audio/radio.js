// The car radio: three original stations whose music is composed on the fly by a step sequencer
// (drums, bass, chords, arpeggios), with a burst of static between stations. Q changes station.
//   WAVE 98.7   synthwave for night drives
//   SALT FM     tropical beach-party rhythms
//   COSTA CHILL lo-fi for the slow lane

const STATIONS = [
  { name: 'WAVE 98.7', tag: "Sunvale's synth station", bpm: 104, root: 45, style: 'synth',
    chords: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]] },
  { name: 'SALT FM', tag: 'Beach party, all day', bpm: 96, root: 50, style: 'tropical',
    chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]] },
  { name: 'COSTA CHILL', tag: 'Lo-fi for the slow lane', bpm: 78, root: 48, style: 'lofi',
    chords: [[0, 4, 7, 11], [9, 12, 16, 19], [2, 5, 9, 12], [7, 11, 14, 17]] },
  { name: 'RADIO OFF', tag: '', off: true },
];

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function createRadio(ctx, out, noiseBuf) {
  let station = 0;
  let on = false;
  let step = 0, nextTime = 0;
  const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(out);
  // a little space: feedback delay
  const delay = ctx.createDelay(1); delay.delayTime.value = 0.28;
  const fb = ctx.createGain(); fb.gain.value = 0.28;
  const wet = ctx.createGain(); wet.gain.value = 0.25;
  delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(bus);
  const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 9000;
  lpf.connect(bus);
  const dry = lpf;

  function voice(freq, t, dur, { type = 'sawtooth', gain = 0.1, cutoff = 2000, attack = 0.01, release = 0.1, send = false, detune = 0 } = {}) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.setValueAtTime(gain, t + Math.max(attack, dur - release)); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(f); f.connect(g); g.connect(dry);
    if (send) g.connect(delay);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function drum(kind, t, gain = 1) {
    if (kind === 'kick') {
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.55 * gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g); g.connect(dry); o.start(t); o.stop(t + 0.32);
      return;
    }
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const dur = kind === 'snare' ? 0.22 : kind === 'clap' ? 0.15 : 0.05;
    f.type = kind === 'hat' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'hat' ? 7000 : kind === 'clap' ? 1500 : 1800;
    g.gain.setValueAtTime((kind === 'hat' ? 0.12 : 0.35) * gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dry);
    if (kind === 'snare') g.connect(delay);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.02);
  }

  function schedule(st, k, t, sixteenth) {
    const bar = Math.floor(k / 16) % st.chords.length;
    const s = k % 16;
    const chord = st.chords[bar].map((n) => st.root + n);
    if (st.style === 'synth') {
      if (s % 4 === 0) drum('kick', t);
      if (s === 4 || s === 12) drum('snare', t);
      if (s % 2 === 0) drum('hat', t, 0.7);
      if (s % 2 === 0) voice(midi(chord[0] - 12), t, sixteenth * 1.8, { type: 'sawtooth', gain: 0.09, cutoff: 500 + (s % 4 ? 0 : 300) });
      voice(midi(chord[(s % 3)] + 12 + (s % 8 > 5 ? 12 : 0)), t, sixteenth * 0.9, { type: 'square', gain: 0.03, cutoff: 2600, send: true });
      if (s === 0) for (const n of chord) voice(midi(n), t, sixteenth * 16, { type: 'sawtooth', gain: 0.028, cutoff: 1200, attack: 0.4, release: 0.6, detune: 8 });
    } else if (st.style === 'tropical') {
      if (s % 4 === 0) drum('kick', t);
      if (s === 3 || s === 6 || s === 11 || s === 14) drum('clap', t, 0.9);
      if (s % 2 === 1) drum('hat', t, 0.6);
      if ([0, 3, 6, 8, 11, 14].includes(s)) voice(midi(chord[0] - 12), t, sixteenth * 1.5, { type: 'sine', gain: 0.22, cutoff: 800 });
      if ([0, 2, 5, 7, 10, 12, 15].includes(s)) {
        const n = chord[(s * 7) % chord.length] + 12;
        voice(midi(n), t, 0.18, { type: 'triangle', gain: 0.08, cutoff: 3500, attack: 0.002, release: 0.15, send: true });
      }
    } else {
      if (s === 0 || s === 10) drum('kick', t, 0.8);
      if (s === 4 || s === 12) drum('snare', t, 0.6);
      if (s % 2 === 0) drum('hat', t, 0.4);
      if (s === 0 || s === 8) for (const n of chord) voice(midi(n), t, sixteenth * 7, { type: 'triangle', gain: 0.035, cutoff: 1500, attack: 0.02, release: 0.4, send: true });
      if (s === 0 || s === 7 || s === 10) voice(midi(chord[0] - 12), t, sixteenth * 3, { type: 'sine', gain: 0.18, cutoff: 600 });
      if (s === 14 && bar % 2 === 1) voice(midi(chord[2] + 12), t, sixteenth * 4, { type: 'sine', gain: 0.05, cutoff: 3000, send: true });
    }
  }

  function staticBurst() {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.12, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500;
    src.connect(f); f.connect(g); g.connect(out);
    src.start(); src.stop(ctx.currentTime + 0.4);
  }

  return {
    get station() { return STATIONS[station]; },
    next() { station = (station + 1) % STATIONS.length; step = 0; nextTime = ctx.currentTime + 0.3; staticBurst(); return STATIONS[station]; },
    tuneIn(vehicle) {
      // each car remembers a station; police cars stay quiet
      if (vehicle.radioStation === undefined) vehicle.radioStation = vehicle.spec.police ? 3 : vehicle.id % 3;
      station = vehicle.radioStation; step = 0; nextTime = ctx.currentTime + 0.25;
    },
    update(now, playing) {
      const st = STATIONS[station];
      const want = playing && !st.off;
      if (want !== on) { on = want; bus.gain.setTargetAtTime(on ? 0.9 : 0, now, 0.15); if (on) { nextTime = now + 0.1; } }
      if (!on) return;
      const sixteenth = 60 / st.bpm / 4;
      if (nextTime < now) nextTime = now + 0.05;
      while (nextTime < now + 0.25) {
        schedule(st, step, nextTime, sixteenth);
        step++;
        nextTime += sixteenth;
      }
    },
    STATIONS,
  };
}
