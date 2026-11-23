// The vehicles of Sunvale: invented makes and models with their size, handling and paint.
// Sizes are metres (w = width, l = length, h = roof height); speeds are m/s.

export const VEHICLES = {
  pico: { name: 'Pico Hatch', w: 1.75, l: 3.8, h: 1.48, maxSpeed: 40, accel: 10, grip: 7.5, mass: 1000, steer: 0.62, shape: 'hatch', health: 700,
    paints: ['#ff6b6b', '#ffd23f', '#4ecdc4', '#ffffff', '#a8e6cf', '#ff9ec8', '#5aa9e6'] },
  marlin: { name: 'Marlin Sedan', w: 1.85, l: 4.6, h: 1.45, maxSpeed: 47, accel: 11, grip: 7, mass: 1400, steer: 0.56, shape: 'sedan', health: 900,
    paints: ['#e9ecef', '#2b2d42', '#8d99ae', '#e07a5f', '#3d8c6a', '#9a7bb0', '#c9ada7', '#3a6ea5', '#f2cc8f'] },
  vela: { name: 'Vela GT', w: 1.95, l: 4.45, h: 1.22, maxSpeed: 64, accel: 17, grip: 8.5, mass: 1250, steer: 0.58, shape: 'coupe', health: 800,
    paints: ['#ff3b3b', '#ffb000', '#00b4d8', '#f72585', '#111111', '#ffffff'] },
  dune: { name: 'Dunerunner Pickup', w: 2.0, l: 5.1, h: 1.85, maxSpeed: 42, accel: 10, grip: 6.5, mass: 1900, steer: 0.52, shape: 'pickup', health: 1200,
    paints: ['#bc4749', '#e9c46a', '#2a9d8f', '#f4f1de', '#3d405b', '#81b29a'] },
  van: { name: 'Haulmaster Van', w: 2.1, l: 5.4, h: 2.5, maxSpeed: 36, accel: 8, grip: 6, mass: 2400, steer: 0.5, shape: 'van', health: 1300,
    paints: ['#ffffff', '#f4f1de', '#e76f51', '#457b9d'] },
  cab: { name: 'SunCab Taxi', w: 1.85, l: 4.6, h: 1.45, maxSpeed: 46, accel: 11, grip: 7, mass: 1400, steer: 0.56, shape: 'sedan', health: 900, taxi: true,
    paints: ['#ffc300'] },
  police: { name: 'SVPD Interceptor', w: 1.9, l: 4.8, h: 1.5, maxSpeed: 56, accel: 15, grip: 8, mass: 1600, steer: 0.58, shape: 'sedan', health: 1100, police: true,
    paints: ['#ffffff'] },
  limo: { name: 'Regent Executive', w: 2.0, l: 5.6, h: 1.5, maxSpeed: 50, accel: 12, grip: 7, mass: 2200, steer: 0.5, shape: 'sedan', health: 1500,
    paints: ['#0d0d10'] },
};

/** Weights for civilian traffic. */
export const TRAFFIC_MIX = [['pico', 5], ['marlin', 6], ['vela', 1.5], ['dune', 2.5], ['van', 1.5], ['cab', 2], ['police', 0.8]];

export function pickTrafficType(r) {
  const total = TRAFFIC_MIX.reduce((s, [, w]) => s + w, 0);
  let x = r * total;
  for (const [t, w] of TRAFFIC_MIX) { x -= w; if (x <= 0) return t; }
  return 'marlin';
}
