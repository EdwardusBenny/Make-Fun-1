// Every texture in Sunvale is painted here on a canvas at load time: building facades (with a
// matching night map of lit windows), storefronts with invented shop names, asphalt, pavement,
// sand, grass, the sea's normal map and neon signs. No image files are loaded.
import * as THREE from 'three';
import { createRandom } from '../core/random.js';

let maxAniso = 4;
export function setAnisotropy(n) { maxAniso = n; }

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTexture(c, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function noise(ctx, w, h, amount, rnd, alpha = 0.08) {
  for (let i = 0; i < amount; i++) {
    const v = Math.floor(rnd() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

/** Facade atlas: 8 floors x 8 bays per tile. Returns { map, emissive } sharing one window layout. */
export function makeFacade(style, seed = 1) {
  const rnd = createRandom(seed);
  const S = 512, C = 64;
  const day = canvas(S, S), night = canvas(S, S);
  const d = day.getContext('2d'), n = night.getContext('2d');
  n.fillStyle = '#000'; n.fillRect(0, 0, S, S);
  const wallColor = { glass: '#9fb4bd', office: '#efe9df', deco: '#fbf7f0', resid: '#f3e6d3', warehouse: '#d8d2c8', villa: '#fff8ee' }[style];
  d.fillStyle = wallColor; d.fillRect(0, 0, S, S);
  noise(d, S, S, 3000, rnd, 0.05);
  const warm = ['#ffd890', '#ffe7b8', '#ffc870', '#fff2d0', '#bfe4ff'];
  for (let fy = 0; fy < 8; fy++) {
    for (let bx = 0; bx < 8; bx++) {
      const x = bx * C, y = fy * C;
      const lit = rnd() < 0.38;
      const litColor = warm[Math.floor(rnd() * warm.length)];
      let wx, wy, ww, wh;
      if (style === 'glass') {
        wx = x + 2; wy = y + 3; ww = C - 4; wh = C - 6;
        const g = d.createLinearGradient(x, y, x + C, y + C);
        const tone = 30 + rnd() * 30;
        g.addColorStop(0, `rgb(${tone + 40},${tone + 90},${tone + 110})`);
        g.addColorStop(0.55, `rgb(${tone},${tone + 50},${tone + 75})`);
        g.addColorStop(1, `rgb(${tone + 60},${tone + 100},${tone + 120})`);
        d.fillStyle = g; d.fillRect(wx, wy, ww, wh);
        d.fillStyle = 'rgba(255,255,255,0.10)';
        d.fillRect(wx + ww * 0.6, wy, 6, wh);
      } else if (style === 'warehouse') {
        // corrugated cladding with a band of high windows on the top floors
        d.fillStyle = 'rgba(0,0,0,0.10)';
        for (let k = 0; k < C; k += 8) d.fillRect(x + k, y, 3, C);
        if (fy % 4 === 0) { wx = x + 8; wy = y + 14; ww = C - 16; wh = 16; } else continue;
        d.fillStyle = '#4e5d66'; d.fillRect(wx, wy, ww, wh);
      } else {
        const narrow = style === 'deco' ? 0.32 : style === 'villa' ? 0.5 : 0.56;
        ww = Math.floor(C * narrow); wh = style === 'deco' ? 36 : 34;
        wx = x + (C - ww) / 2; wy = y + 14;
        // frame and sill
        d.fillStyle = 'rgba(0,0,0,0.18)'; d.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
        const g = d.createLinearGradient(0, wy, 0, wy + wh);
        g.addColorStop(0, '#5f8aa6'); g.addColorStop(0.5, '#25445a'); g.addColorStop(1, '#3b6680');
        d.fillStyle = g; d.fillRect(wx, wy, ww, wh);
        d.fillStyle = 'rgba(255,255,255,0.22)'; d.fillRect(wx + 3, wy + 3, ww * 0.25, wh - 6);
        if (rnd() < 0.35) { d.fillStyle = rnd() < 0.5 ? '#e9dcc0' : '#c9d6d8'; d.fillRect(wx, wy, ww, wh * (0.3 + rnd() * 0.5)); }
        d.fillStyle = 'rgba(0,0,0,0.35)'; d.fillRect(wx, wy + wh / 2 - 1, ww, 2);
        if (style === 'deco') {
          d.fillStyle = 'rgba(0,0,0,0.10)'; d.fillRect(x, y + 6, C, 4); // eyebrow ledge
        }
        if (style === 'resid' && fy % 2 === 1) {
          d.fillStyle = 'rgba(40,40,40,0.55)';
          d.fillRect(x + 4, wy + wh - 12, C - 8, 3);
          for (let k = x + 6; k < x + C - 4; k += 6) d.fillRect(k, wy + wh - 12, 2, 14);
        }
        if (style === 'office') { d.fillStyle = 'rgba(0,0,0,0.06)'; d.fillRect(x, y + C - 6, C, 6); }
      }
      if (lit) {
        n.fillStyle = litColor;
        n.globalAlpha = 0.65 + rnd() * 0.35;
        n.fillRect(wx, wy, ww, wh);
        n.globalAlpha = 1;
      }
    }
  }
  return { map: toTexture(day), emissive: toTexture(night) };
}

const SHOPS = [
  { name: 'TACOS EL SOL', bg: '#ffcf3f', fg: '#c0262d', awn: ['#c0262d', '#ffffff'] },
  { name: 'BOBA BAY', bg: '#7fe0d0', fg: '#1d3557', awn: ['#ff8fb8', '#ffffff'] },
  { name: '24/7 SUNMART', bg: '#1d3557', fg: '#ffd23f', awn: ['#2a9d8f', '#e9f5f2'] },
  { name: 'LAVANDERIA', bg: '#f1faee', fg: '#457b9d', awn: ['#457b9d', '#f1faee'] },
  { name: 'SURF SHACK', bg: '#ff9f1c', fg: '#ffffff', awn: ['#2ec4b6', '#ffffff'] },
  { name: 'PICO MOTORS', bg: '#222831', fg: '#ff5fa2', awn: ['#ff5fa2', '#222831'] },
  { name: 'FARMACIA', bg: '#e9fff0', fg: '#1a8f4a', awn: ['#1a8f4a', '#ffffff'] },
  { name: 'CUBANO CAFE', bg: '#6b2d1c', fg: '#ffe2b0', awn: ['#c96f3a', '#ffe2b0'] },
];

/** A 4x2 atlas of shop fronts: glazing, a signboard and a striped awning. */
export function makeStorefronts() {
  const W = 1024, H = 512, cw = 256, ch = 256;
  const c = canvas(W, H), e = canvas(W, H);
  const g = c.getContext('2d'), n = e.getContext('2d');
  n.fillStyle = '#000'; n.fillRect(0, 0, W, H);
  SHOPS.forEach((s, k) => {
    const x = (k % 4) * cw, y = Math.floor(k / 4) * ch;
    g.fillStyle = '#d9d2c5'; g.fillRect(x, y, cw, ch);
    // sign band
    g.fillStyle = s.bg; g.fillRect(x, y + 20, cw, 60);
    g.fillStyle = s.fg; g.font = 'bold 34px "Arial Black", "DejaVu Sans", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(s.name, x + cw / 2, y + 52, cw - 20);
    n.fillStyle = s.fg; n.font = g.font; n.textAlign = 'center'; n.textBaseline = 'middle';
    n.fillText(s.name, x + cw / 2, y + 52, cw - 20);
    // awning stripes
    for (let k2 = 0; k2 < 8; k2++) { g.fillStyle = s.awn[k2 % 2]; g.fillRect(x + k2 * 32, y + 82, 32, 26); }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + 106, cw, 4);
    // glazing and door
    const gl = g.createLinearGradient(0, y + 112, 0, y + 250);
    gl.addColorStop(0, '#2b3f4c'); gl.addColorStop(1, '#6f8fa0');
    g.fillStyle = gl; g.fillRect(x + 10, y + 114, cw - 20, 136);
    n.fillStyle = 'rgba(255,214,150,0.55)'; n.fillRect(x + 10, y + 114, cw - 20, 136);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 30, y + 120, 18, 120);
    g.fillStyle = '#3a2f28'; g.fillRect(x + cw / 2 - 22, y + 150, 44, 100);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + cw / 2 - 16, y + 158, 32, 50);
  });
  return { map: toTexture(c, false), emissive: toTexture(e, false), count: SHOPS.length };
}

function groundTexture(size, base, specks, seed, draw) {
  const rnd = createRandom(seed);
  const c = canvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (const [color, count, maxSize] of specks) {
    g.fillStyle = color;
    for (let i = 0; i < count; i++) g.fillRect(rnd() * size, rnd() * size, 1 + rnd() * maxSize, 1 + rnd() * maxSize);
  }
  if (draw) draw(g, rnd, size);
  return toTexture(c);
}

export function makeAsphalt() {
  return groundTexture(256, '#4a4a50', [['#3c3c42', 2600, 2], ['#5b5a5f', 2200, 2], ['#2f2f33', 300, 4]], 11, (g, rnd, s) => {
    g.strokeStyle = 'rgba(20,20,24,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 6; i++) { g.beginPath(); let x = rnd() * s, y = rnd() * s; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
  });
}

export function makeSidewalk() {
  return groundTexture(256, '#c9c1b4', [['#b8afa1', 1500, 2], ['#d8d1c6', 1500, 2]], 12, (g) => {
    g.strokeStyle = 'rgba(90,80,70,0.35)'; g.lineWidth = 2;
    for (let k = 0; k <= 256; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); }
  });
}

export function makeSand() {
  return groundTexture(256, '#ecd3a0', [['#e0c08a', 3000, 2], ['#f6e2b8', 3000, 2], ['#cfae78', 400, 2]], 13);
}

export function makeGrass() {
  return groundTexture(256, '#5c9a3f', [['#4c8a35', 3000, 3], ['#72b04f', 2500, 2], ['#3f7a2c', 600, 3]], 14);
}

export function makeConcrete() {
  return groundTexture(256, '#a9a59d', [['#9b978f', 2500, 3], ['#b9b5ad', 2000, 2]], 15, (g) => {
    g.strokeStyle = 'rgba(60,60,60,0.3)'; g.lineWidth = 2;
    g.strokeRect(0, 0, 256, 256);
  });
}

export function makeWood() {
  return groundTexture(256, '#8a6a4a', [['#7a5a3c', 1200, 2]], 16, (g) => {
    g.fillStyle = 'rgba(40,25,10,0.45)';
    for (let k = 0; k < 256; k += 32) g.fillRect(0, k, 256, 3);
  });
}

/** A tileable normal map for the sea, summed from a few travelling sine ripples. */
export function makeWaterNormal() {
  const S = 256;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const waves = [[3, 1, 0.9], [1, 4, 0.6], [5, -2, 0.4], [-3, 5, 0.3], [7, 3, 0.2]];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let nx = 0, ny = 0;
      for (const [kx, ky, a] of waves) {
        const ph = (kx * x + ky * y) / S * Math.PI * 2;
        const dv = Math.cos(ph) * a;
        nx += dv * kx * 0.08; ny += dv * ky * 0.08;
      }
      const i = (y * S + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, 128 + nx * 127));
      img.data[i + 1] = Math.max(0, Math.min(255, 128 + ny * 127));
      img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(c, true, false);
}

/** A sign or billboard face: text on a coloured panel, optionally glowing neon. */
export function makeSign(lines, { w = 512, h = 128, bg = '#1a1030', fg = '#ff5fa2', glow = true, font = '"Arial Black", "DejaVu Sans", sans-serif', border = null } = {}) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  if (border) { g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const list = Array.isArray(lines) ? lines : [lines];
  list.forEach((line, k) => {
    const size = k === 0 ? h * 0.52 / list.length * 1.3 : h * 0.3 / list.length * 1.3;
    g.font = `bold ${Math.floor(size)}px ${font}`;
    const y = h * (k + 0.5) / list.length;
    if (glow) { g.shadowColor = fg; g.shadowBlur = 18; }
    g.fillStyle = k === 0 ? fg : '#ffffff';
    g.fillText(line, w / 2, y, w - 24);
    g.shadowBlur = 0;
  });
  return toTexture(c, false);
}
