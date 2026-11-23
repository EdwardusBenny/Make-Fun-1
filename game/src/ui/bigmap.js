// The full-screen city map (M): the whole of Sunvale with district names, the beach and pier,
// mission contacts, shops, the objective with its route, police, and a legend.
import { MAP_X0, MAP_Z0, MAP_W, MAP_H } from './mapimage.js';
import { DISTRICTS, PITCH, CITY_H, PIER } from '../city/layout.js';
import { route, nearestNode, nodeX, nodeZ } from '../city/roadgraph.js';

const LABELS = [
  ['Palm Heights', 1.5 * PITCH, 1.6 * PITCH], ['Neon Row', 4.9 * PITCH, 2.6 * PITCH], ['Mercado', 1.6 * PITCH, 5.5 * PITCH],
  ['Mercado', 7.0 * PITCH, 5.0 * PITCH], ['Coral Strand', 4.0 * PITCH, 7.5 * PITCH], ['Saltmarsh Docks', 9.0 * PITCH, 3.0 * PITCH],
  ['Sunvale Beach', 2.2 * PITCH, CITY_H + 60], ['Starwheel Pier', PIER.x1 + 50, PIER.z1 - 40], ['Solana Park', 4.5 * PITCH, 5.5 * PITCH],
  ['Bay of Sunvale', 6.5 * PITCH, CITY_H + 170],
];

export function createBigMap(canvas, mapImage) {
  const g = canvas.getContext('2d');
  return {
    draw(player, blips, gps, legend) {
      const W = canvas.width = window.innerWidth, H = canvas.height = window.innerHeight;
      g.fillStyle = '#2a86a8'; g.fillRect(0, 0, W, H);
      const scale = Math.min((W - 80) / (MAP_W - 300), (H - 80) / (MAP_H - 260));
      const ox = W / 2 - (MAP_X0 + 150 + (MAP_W - 300) / 2) * scale;
      const oy = H / 2 - (MAP_Z0 + 130 + (MAP_H - 260) / 2) * scale;
      const sx = (x) => ox + x * scale, sy = (z) => oy + z * scale;
      g.imageSmoothingEnabled = true;
      g.fillStyle = '#7fa860';
      g.fillRect(0, 0, sx(MAP_X0 + 1), sy(MAP_Z0 + 600));
      g.fillRect(0, 0, W, sy(MAP_Z0 + 1));
      g.drawImage(mapImage, sx(MAP_X0), sy(MAP_Z0), MAP_W * scale, MAP_H * scale);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      for (const [name, x, z] of LABELS) {
        g.font = `bold ${Math.round(15 * scale * 1.4)}px "Trebuchet MS", sans-serif`;
        g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.7)';
        g.strokeText(name.toUpperCase(), sx(x), sy(z));
        g.fillStyle = Object.values(DISTRICTS).find((d) => d.name === name)?.color ?? '#ffffff';
        g.fillText(name.toUpperCase(), sx(x), sy(z));
      }
      if (gps) {
        const path = route(nearestNode(player.x, player.z), nearestNode(gps.x, gps.z));
        g.strokeStyle = '#c46bff'; g.lineWidth = 5; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(sx(player.x), sy(player.z));
        for (const n of path) g.lineTo(sx(nodeX(n.i)), sy(nodeZ(n.j)));
        g.lineTo(sx(gps.x), sy(gps.z));
        g.stroke();
      }
      for (const b of blips) {
        g.fillStyle = b.color; g.strokeStyle = '#000'; g.lineWidth = 2;
        const r = (b.size ?? 5) * 1.5;
        g.beginPath();
        if (b.shape === 'square') g.rect(sx(b.x) - r, sy(b.z) - r, r * 2, r * 2); else g.arc(sx(b.x), sy(b.z), r, 0, Math.PI * 2);
        g.fill(); g.stroke();
        if (b.label) { g.fillStyle = '#000'; g.font = `bold ${Math.round(r * 1.3)}px sans-serif`; g.fillText(b.label, sx(b.x), sy(b.z) + 1); }
      }
      // player arrow
      g.save();
      g.translate(sx(player.x), sy(player.z));
      g.rotate(-player.heading + Math.PI);
      g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, -14); g.lineTo(10, 11); g.lineTo(0, 5); g.lineTo(-10, 11); g.closePath(); g.fill(); g.stroke();
      g.restore();
      // title and legend
      g.textAlign = 'left';
      g.font = 'bold 40px Impact, "Arial Black", sans-serif';
      g.fillStyle = '#ffd23f'; g.strokeStyle = '#3a1500'; g.lineWidth = 6;
      g.strokeText('SUNVALE', 30, 46); g.fillText('SUNVALE', 30, 46);
      g.font = 'bold 15px "Trebuchet MS", sans-serif';
      g.fillStyle = '#ffd8ef';
      g.fillText('CITY MAP  ·  press M to close', 32, 76);
      let y = H - 30 - legend.length * 24;
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(20, y - 20, 250, legend.length * 24 + 24);
      for (const [color, text, label] of legend) {
        g.fillStyle = color; g.strokeStyle = '#000';
        g.beginPath(); g.arc(40, y, 8, 0, Math.PI * 2); g.fill(); g.stroke();
        if (label) { g.fillStyle = '#000'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText(label, 40, y + 1); g.textAlign = 'left'; }
        g.fillStyle = '#fff'; g.font = '15px "Trebuchet MS", sans-serif';
        g.fillText(text, 58, y + 1);
        y += 24;
      }
    },
  };
}
