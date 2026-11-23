// Paints the city plan once into an offscreen canvas (1 pixel = 1 metre): sea, hills, beach,
// pier, quay, roads and blocks tinted by district. The minimap and the full map both sample it.
import { NX, NZ, PITCH, HALF_ROAD, CITY_W, CITY_H, SHORE_Z, QUAY_X, PIER, blockRect, blockDistrict, SPECIAL_BLOCKS } from '../city/layout.js';

export const MAP_X0 = -260, MAP_Z0 = -260, MAP_W = 1360, MAP_H = 1320;

const BLOCK_COLORS = { neon: '#5d5470', coral: '#c9a084', heights: '#6f9a63', mercado: '#a78f6a', docks: '#6c7d8a' };

export function paintCityMap() {
  const c = document.createElement('canvas');
  c.width = MAP_W; c.height = MAP_H;
  const g = c.getContext('2d');
  g.translate(-MAP_X0, -MAP_Z0);
  g.fillStyle = '#2a86a8'; g.fillRect(MAP_X0, MAP_Z0, MAP_W, MAP_H);
  // land
  g.fillStyle = '#7fa860'; g.fillRect(MAP_X0, MAP_Z0, QUAY_X - MAP_X0, SHORE_Z - MAP_Z0);
  g.fillStyle = '#e8d29a'; g.fillRect(MAP_X0, CITY_H + HALF_ROAD, QUAY_X - MAP_X0, SHORE_Z - CITY_H - HALF_ROAD + 4);
  g.fillStyle = '#9a9a96'; g.fillRect(CITY_W + HALF_ROAD, -HALF_ROAD - 30, QUAY_X - CITY_W - HALF_ROAD, CITY_H + 37);
  g.fillStyle = '#a07850'; g.fillRect(PIER.x0, CITY_H + 52, PIER.x1 - PIER.x0, PIER.z1 - CITY_H - 52);
  // roads
  g.fillStyle = '#3a3d45';
  g.fillRect(-HALF_ROAD - 30, -HALF_ROAD - 30, CITY_W + 2 * HALF_ROAD + 30, CITY_H + 2 * HALF_ROAD + 30);
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NZ; j++) {
      const r = blockRect(i, j);
      const sp = SPECIAL_BLOCKS[`${i},${j}`];
      g.fillStyle = '#cfc8bb';
      g.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0);
      g.fillStyle = sp === 'park' ? '#5fae5a' : BLOCK_COLORS[blockDistrict(i, j)];
      g.fillRect(r.x0 + 3, r.z0 + 3, r.x1 - r.x0 - 6, r.z1 - r.z0 - 6);
    }
  }
  // centre lines
  g.strokeStyle = 'rgba(255,214,90,0.35)'; g.lineWidth = 1;
  for (let i = 0; i <= NX; i++) { g.beginPath(); g.moveTo(i * PITCH, 0); g.lineTo(i * PITCH, CITY_H); g.stroke(); }
  for (let j = 0; j <= NZ; j++) { g.beginPath(); g.moveTo(0, j * PITCH); g.lineTo(CITY_W, j * PITCH); g.stroke(); }
  return c;
}
