// The circular radar: the city map rotated with the camera, zooming out with speed, a GPS route to
// the current objective along the road graph, the wanted search area, and blips for police,
// enemies, mission contacts, shops and the objective (pinned to the rim when off-screen).
import { MAP_X0, MAP_Z0 } from './mapimage.js';
import { route, nearestNode, nodeX, nodeZ } from '../city/roadgraph.js';

export function createMinimap(canvas, mapImage) {
  const g = canvas.getContext('2d');
  const S = canvas.width, R = S / 2;
  let gpsKey = '', gpsPath = [];

  function blip(x, y, color, size, shape = 'dot', label = null, pin = false) {
    const dx = x - R, dy = y - R;
    const d = Math.hypot(dx, dy);
    const lim = R - 12;
    if (d > lim) {
      if (!pin) return;
      x = R + dx / d * lim; y = R + dy / d * lim;
    }
    g.save();
    g.fillStyle = color; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath();
    if (shape === 'square') g.rect(x - size, y - size, size * 2, size * 2);
    else g.arc(x, y, size, 0, Math.PI * 2);
    g.fill(); g.stroke();
    if (label) {
      g.fillStyle = '#000'; g.font = `bold ${Math.round(size * 1.3)}px sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(label, x, y + 1);
    }
    g.restore();
  }

  return {
    /**
     * Draw centred on (cx,cz), rotated so the camera yaw points up.
     * blips: [{x,z,color,size,shape,label,pin}], gps: {x,z}|null, search: {x,z,r}|null
     */
    draw(cx, cz, yaw, heading, zoom, blips, gps, search, flash) {
      g.save();
      g.clearRect(0, 0, S, S);
      g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#2a86a8'; g.fillRect(0, 0, S, S);
      // world (x,z) -> screen, the same mapping as toScreen below, as one affine transform
      const ca = Math.cos(yaw), sa = Math.sin(yaw);
      const a = -ca / zoom, c = sa / zoom, b = -sa / zoom, d = -ca / zoom;
      g.setTransform(a, b, c, d, R - a * cx - c * cz, R - b * cx - d * cz);
      g.drawImage(mapImage, MAP_X0, MAP_Z0);
      g.restore();
      const toScreen = (x, z) => {
        const dx = x - cx, dz = z - cz;
        // forward (sin yaw, cos yaw) maps to screen up; right (-cos, sin) maps to screen right
        const f = dx * sa + dz * ca;
        const r = dx * -ca + dz * sa;
        return [R + r / zoom, R - f / zoom];
      };
      g.save();
      g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.clip();
      if (search) {
        const [sx, sy] = toScreen(search.x, search.z);
        g.fillStyle = flash ? 'rgba(255,40,60,0.22)' : 'rgba(60,100,255,0.22)';
        g.beginPath(); g.arc(sx, sy, search.r / zoom, 0, Math.PI * 2); g.fill();
      }
      if (gps) {
        const key = `${Math.round(cx / 20)},${Math.round(cz / 20)},${Math.round(gps.x)},${Math.round(gps.z)}`;
        if (key !== gpsKey) {
          gpsKey = key;
          gpsPath = route(nearestNode(cx, cz), nearestNode(gps.x, gps.z)).map((n) => [nodeX(n.i), nodeZ(n.j)]);
          gpsPath.unshift([cx, cz]);
          gpsPath.push([gps.x, gps.z]);
        }
        g.strokeStyle = gps.color ?? '#c46bff'; g.lineWidth = 5; g.lineJoin = 'round'; g.lineCap = 'round';
        g.globalAlpha = 0.9;
        g.beginPath();
        gpsPath.forEach(([x, z], k) => {
          const [sx, sy] = toScreen(k === 0 ? cx : x, k === 0 ? cz : z);
          if (k === 0) g.moveTo(sx, sy); else g.lineTo(sx, sy);
        });
        g.stroke();
        g.globalAlpha = 1;
      }
      for (const b of blips) {
        const [sx, sy] = toScreen(b.x, b.z);
        blip(sx, sy, b.color, b.size ?? 5, b.shape, b.label, b.pin);
      }
      g.restore();
      // player arrow
      g.save();
      g.translate(R, R);
      g.rotate(yaw - heading);
      g.fillStyle = '#ffffff'; g.strokeStyle = '#000'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath();
      g.fill(); g.stroke();
      g.restore();
      // north marker on the rim
      const [nx, ny] = toScreen(cx, cz - 10000);
      const nd = Math.hypot(nx - R, ny - R);
      blip(R + (nx - R) / nd * (R - 12), R + (ny - R) / nd * (R - 12), '#ffffff', 8, 'dot', 'N', true);
    },
  };
}
