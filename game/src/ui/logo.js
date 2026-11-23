// The SUNVALE title logo, painted on a canvas: a striped setting sun behind palm silhouettes and
// chunky gradient lettering with the "Salt & Neon" subtitle in pink neon script.

export function paintLogo(canvas) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  // sun with horizontal cut stripes
  const cx = W / 2, cy = H * 0.62, r = H * 0.46;
  const sun = g.createLinearGradient(0, cy - r, 0, cy + r * 0.3);
  sun.addColorStop(0, '#ffe46b'); sun.addColorStop(0.5, '#ff9a3c'); sun.addColorStop(1, '#ff3c7a');
  g.save();
  g.beginPath(); g.arc(cx, cy, r, Math.PI, 0); g.closePath(); g.clip();
  g.fillStyle = sun; g.fillRect(cx - r, cy - r, r * 2, r);
  g.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 6; k++) { const y = cy - r * 0.42 + k * r * 0.085; g.fillRect(cx - r, y, r * 2, 3 + k * 1.6); }
  g.restore();
  // palms
  const palm = (x, y, s, flip) => {
    g.save(); g.translate(x, y); g.scale(flip ? -s : s, s);
    g.fillStyle = '#2a0f3a';
    g.beginPath(); g.moveTo(-4, 0); g.quadraticCurveTo(10, -60, 30, -120); g.lineTo(36, -118); g.quadraticCurveTo(18, -60, 5, 0); g.fill();
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.48;
      g.save(); g.translate(33, -120); g.rotate(a);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(30, -18, 62, 10); g.quadraticCurveTo(30, -4, 0, 6); g.fill();
      g.restore();
    }
    g.restore();
  };
  palm(cx - r * 0.95, cy + 8, 1.1, false);
  palm(cx + r * 0.95, cy + 8, 0.95, true);
  // lettering
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `900 ${Math.floor(H * 0.42)}px Impact, "Arial Black", "DejaVu Sans", sans-serif`;
  const ty = cy + H * 0.08;
  g.lineJoin = 'round';
  g.lineWidth = 18; g.strokeStyle = '#1b0726'; g.strokeText('SUNVALE', cx, ty);
  const tg = g.createLinearGradient(0, ty - H * 0.36, 0, ty);
  tg.addColorStop(0, '#fff6c8'); tg.addColorStop(0.45, '#ffd23f'); tg.addColorStop(0.5, '#ff8a3d'); tg.addColorStop(1, '#ff3c7a');
  g.fillStyle = tg; g.fillText('SUNVALE', cx, ty);
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.strokeText('SUNVALE', cx, ty - 2);
  // neon subtitle
  g.font = `italic bold ${Math.floor(H * 0.13)}px "Brush Script MT", "Segoe Script", "DejaVu Serif", cursive`;
  g.shadowColor = '#ff2fa0'; g.shadowBlur = 22;
  g.fillStyle = '#ffd6f0';
  g.fillText('Salt & Neon', cx, ty + H * 0.17);
  g.shadowBlur = 0;
}
