// The plan of Sunvale: a grid of avenues and streets, the blocks between them, which district each
// block belongs to, the beach and harbour edges, and the named places missions and shops use.
// Everything else (meshes, traffic, minimap, missions) reads the city from here.
//
// Axes: x runs east, z runs south, y is up. Road centre lines sit at multiples of PITCH.

export const PITCH = 84;
export const ROAD_W = 14;
export const HALF_ROAD = ROAD_W / 2;
export const LANE_INNER = 1.75;
export const LANE_OUTER = 5.25;
export const SIDEWALK = 4;
export const NX = 10;
export const NZ = 8;
export const CITY_W = NX * PITCH;
export const CITY_H = NZ * PITCH;
/** Where sand meets sea along the south coast and where the quay ends in the east. */
export const SHORE_Z = CITY_H + 98;
export const QUAY_X = CITY_W + 40;
export const PIER = { x0: 4.5 * PITCH - 7, x1: 4.5 * PITCH + 7, z0: CITY_H + 60, z1: CITY_H + 230 };
export const BOUNDS = { x0: -30, x1: QUAY_X - 2, z0: -30, z1: SHORE_Z - 2 };

export const DISTRICTS = {
  neon: { name: 'Neon Row', color: '#ff5fa2' },
  coral: { name: 'Coral Strand', color: '#ffb36b' },
  heights: { name: 'Palm Heights', color: '#7fe08a' },
  mercado: { name: 'Mercado', color: '#ffd23f' },
  docks: { name: 'Saltmarsh Docks', color: '#7fb8ff' },
  beach: { name: 'Sunvale Beach', color: '#ffe6a8' },
  pier: { name: 'Starwheel Pier', color: '#ff9ec8' },
};

/** Street names: index i for north-south avenues, j for east-west streets. */
export const AVENUE_NAMES = ['Mangrove Ave', 'Calle Lumen', 'Heron Ave', 'Pastel Ave', 'Marisol Ave', 'Vega Blvd', 'Neon Ave', 'Breaker Ave', 'Cargo Way', 'Pelican Ave', 'Quay Road'];
export const STREET_NAMES = ['Hilltop Dr', '1st St', '2nd St', 'Grand St', 'Sol Street', 'Cypress St', 'Tidewater St', 'Flamingo St', 'Coral Parade'];

/** Blocks with a fixed purpose; every other block is filled by its district's style. */
export const SPECIAL_BLOCKS = {
  '4,5': 'park',
  '5,2': 'kraneTower',
  '9,6': 'baitShop',
  '1,5': 'garage',
  '3,3': 'bank',
  '2,4': 'hospital',
  '6,5': 'police',
  '7,3': 'gunShop',
  '7,6': 'paintShop',
  '8,1': 'warehouseYard',
};

export function blockDistrict(i, j) {
  if (i >= 8) return 'docks';
  if (j === NZ - 1) return 'coral';
  if (i >= 3 && i <= 6 && j >= 1 && j <= 4) return 'neon';
  if (i <= 2 && j <= 3) return 'heights';
  return 'mercado';
}

export function blockRect(i, j) {
  return { x0: i * PITCH + HALF_ROAD, x1: (i + 1) * PITCH - HALF_ROAD, z0: j * PITCH + HALF_ROAD, z1: (j + 1) * PITCH - HALF_ROAD };
}

/** The lot inside a block's sidewalk ring, where buildings stand. */
export function lotRect(i, j) {
  const r = blockRect(i, j);
  return { x0: r.x0 + SIDEWALK, x1: r.x1 - SIDEWALK, z0: r.z0 + SIDEWALK, z1: r.z1 - SIDEWALK };
}

/** A point on the sidewalk on one side of a block: side 0 north, 1 east, 2 south, 3 west. */
export function blockFront(i, j, side = 0, along = 0.5) {
  const r = blockRect(i, j);
  const m = SIDEWALK / 2;
  if (side === 0) return { x: r.x0 + (r.x1 - r.x0) * along, z: r.z0 + m };
  if (side === 1) return { x: r.x1 - m, z: r.z0 + (r.z1 - r.z0) * along };
  if (side === 2) return { x: r.x0 + (r.x1 - r.x0) * along, z: r.z1 - m };
  return { x: r.x0 + m, z: r.z0 + (r.z1 - r.z0) * along };
}

/** Places the story, shops and respawns use (x, z on the sidewalk in front of the building). */
export const PLACES = {
  start: { x: 2.5 * PITCH, z: 6 * PITCH - HALF_ROAD - 2, label: 'Bus stop' },
  teo: { ...blockFront(9, 6, 3, 0.5), label: "Teo's Bait & Tackle" },
  lena: { ...blockFront(1, 5, 1, 0.5), label: 'Park Auto & Custom' },
  bank: { ...blockFront(3, 3, 1, 0.5), label: 'Coral Savings & Trust' },
  hospital: { ...blockFront(2, 4, 0, 0.5), label: 'Sunvale General' },
  police: { ...blockFront(6, 5, 0, 0.5), label: 'SVPD Central' },
  gunShop: { ...blockFront(7, 3, 0, 0.5), label: 'Lockbox Arms' },
  paintShop: { ...blockFront(7, 6, 0, 0.5), label: 'Fresh Coat Paint & Body' },
  kraneTower: { ...blockFront(5, 2, 2, 0.5), label: 'Krane Tower' },
  courier: { ...blockFront(4, 1, 2, 0.3), label: 'Neon Row Courier' },
  pierEnd: { x: PIER.x0 + 7, z: PIER.z1 - 25, label: 'Pier end' },
  pierGate: { x: PIER.x0 + 7, z: CITY_H + 40, label: 'Pier gate' },
};

export function districtAt(x, z) {
  if (x >= PIER.x0 - 2 && x <= PIER.x1 + 2 && z > CITY_H + 60) return 'pier';
  if (z > CITY_H + HALF_ROAD) return 'beach';
  if (x > CITY_W + HALF_ROAD) return 'docks';
  const i = Math.max(0, Math.min(NX - 1, Math.floor(x / PITCH)));
  const j = Math.max(0, Math.min(NZ - 1, Math.floor(z / PITCH)));
  return blockDistrict(i, j);
}

/** True when (x,z) is on a carriageway (not sidewalk, not lot). */
export function onRoad(x, z) {
  if (x < -HALF_ROAD || x > CITY_W + HALF_ROAD || z < -HALF_ROAD || z > CITY_H + HALF_ROAD) return false;
  const fx = ((x % PITCH) + PITCH) % PITCH;
  const fz = ((z % PITCH) + PITCH) % PITCH;
  return fx < HALF_ROAD || fx > PITCH - HALF_ROAD || fz < HALF_ROAD || fz > PITCH - HALF_ROAD;
}

export function streetNameAt(x, z) {
  const fi = Math.round(x / PITCH), fj = Math.round(z / PITCH);
  const dx = Math.abs(x - fi * PITCH), dz = Math.abs(z - fj * PITCH);
  if (dz <= dx && fj >= 0 && fj <= NZ) return STREET_NAMES[fj];
  if (fi >= 0 && fi <= NX) return AVENUE_NAMES[fi];
  return '';
}

export function inBounds(x, z) {
  if (x >= PIER.x0 + 1 && x <= PIER.x1 - 1 && z >= BOUNDS.z0 && z <= PIER.z1) return true;
  return x >= BOUNDS.x0 && x <= BOUNDS.x1 && z >= BOUNDS.z0 && z <= BOUNDS.z1;
}

/** Push (x,z) back inside the playable area; returns the corrected pair. */
export function clampToBounds(x, z) {
  // Past the shoreline only the pier deck is solid: keep its walkers between the rails.
  if (z > BOUNDS.z1 && x > PIER.x0 - 2 && x < PIER.x1 + 2) {
    return { x: Math.max(PIER.x0 + 1, Math.min(PIER.x1 - 1, x)), z: Math.min(z, PIER.z1 - 1) };
  }
  return {
    x: Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, x)),
    z: Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, z)),
  };
}
