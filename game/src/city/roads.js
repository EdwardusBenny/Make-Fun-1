// The ground of Sunvale: asphalt carriageways with lane lines, crossings and stop lines, raised
// sidewalks with curbs around every block, park lawns, the beach, the quay and the hills behind.
import * as THREE from 'three';
import { MeshBuilder } from './meshbuilder.js';
import { NX, NZ, PITCH, HALF_ROAD, CITY_W, CITY_H, SHORE_Z, QUAY_X, PIER, blockRect, blockDistrict, SPECIAL_BLOCKS, lotRect, onRoad } from './layout.js';
import { makeAsphalt, makeSidewalk, makeSand, makeGrass, makeConcrete } from './textures.js';

export const CURB = 0.15;
/** Width of the beachfront promenade south of Coral Parade. */
export const PROMENADE = 7;

export function buildRoads(scene) {
  const group = new THREE.Group();
  group.name = 'roads';

  // asphalt for the whole grid
  const asphalt = new MeshBuilder();
  asphalt.ground(-HALF_ROAD - 30, -HALF_ROAD - 30, CITY_W + HALF_ROAD, CITY_H + HALF_ROAD, 0, '#ffffff', 10);
  const asphaltTex = makeAsphalt();
  const asphaltMesh = new THREE.Mesh(asphalt.build(), new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.92, vertexColors: true }));
  asphaltMesh.receiveShadow = true;
  group.add(asphaltMesh);

  // sidewalks with curbs, and lawns where a block is green
  const walk = new MeshBuilder();
  const grass = new MeshBuilder();
  const curbB = new MeshBuilder();
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NZ; j++) {
      const r = blockRect(i, j);
      walk.ground(r.x0, r.z0, r.x1, r.z1, CURB, '#ffffff', 4);
      curbB.box(r.x0, 0, r.z0, r.x1, CURB + 0.01, r.z1, '#d8d4cc', { skip: 'tb' });
      const special = SPECIAL_BLOCKS[`${i},${j}`];
      const d = blockDistrict(i, j);
      if (special === 'park' || d === 'heights') {
        const l = lotRect(i, j);
        grass.ground(l.x0, l.z0, l.x1, l.z1, CURB + 0.02, '#ffffff', 6);
      }
    }
  }
  // the beachfront promenade along Coral Parade
  walk.ground(-200, CITY_H + HALF_ROAD, QUAY_X, CITY_H + HALF_ROAD + PROMENADE, CURB, '#f6ead8', 4);
  curbB.box(-200, 0, CITY_H + HALF_ROAD, QUAY_X, CURB + 0.01, CITY_H + HALF_ROAD + PROMENADE, '#e8e0d0', { skip: 'tbn' });
  const walkMesh = new THREE.Mesh(walk.build(), new THREE.MeshStandardMaterial({ map: makeSidewalk(), roughness: 0.9, vertexColors: true }));
  walkMesh.receiveShadow = true;
  group.add(walkMesh);
  const grassTex = makeGrass();
  const grassMesh = new THREE.Mesh(grass.build(), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, vertexColors: true }));
  grassMesh.receiveShadow = true;
  group.add(grassMesh);
  group.add(new THREE.Mesh(curbB.build(), new THREE.MeshStandardMaterial({ roughness: 0.8, vertexColors: true })));

  // lane markings
  const marks = new MeshBuilder();
  const Y = 0.025;
  const yellow = '#f2c230', white = '#f4f4f0';
  const segStart = HALF_ROAD + 3.2, segLen = PITCH - 2 * segStart;
  for (let j = 0; j <= NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const x0 = i * PITCH + segStart, x1 = x0 + segLen, z = j * PITCH;
      marks.ground(x0, z - 0.32, x1, z - 0.12, Y, yellow, 100);
      marks.ground(x0, z + 0.12, x1, z + 0.32, Y, yellow, 100);
      for (let x = x0 + 1; x < x1 - 2; x += 6) {
        marks.ground(x, z - 3.6, x + 3, z - 3.4, Y, white, 100);
        marks.ground(x, z + 3.4, x + 3, z + 3.6, Y, white, 100);
      }
    }
  }
  for (let i = 0; i <= NX; i++) {
    for (let j = 0; j < NZ; j++) {
      const z0 = j * PITCH + segStart, z1 = z0 + segLen, x = i * PITCH;
      marks.ground(x - 0.32, z0, x - 0.12, z1, Y, yellow, 100);
      marks.ground(x + 0.12, z0, x + 0.32, z1, Y, yellow, 100);
      for (let z = z0 + 1; z < z1 - 2; z += 6) {
        marks.ground(x - 3.6, z, x - 3.4, z + 3, Y, white, 100);
        marks.ground(x + 3.4, z, x + 3.6, z + 3, Y, white, 100);
      }
    }
  }
  // zebra crossings and stop lines at every intersection approach
  for (let i = 0; i <= NX; i++) {
    for (let j = 0; j <= NZ; j++) {
      const cx = i * PITCH, cz = j * PITCH;
      const near = HALF_ROAD + 0.6, far = HALF_ROAD + 2.8;
      for (let s = -HALF_ROAD + 0.6; s < HALF_ROAD - 0.6; s += 1.4) {
        if (j > 0) marks.ground(cx + s, cz - far, cx + s + 0.7, cz - near, Y, white, 100);
        if (j < NZ) marks.ground(cx + s, cz + near, cx + s + 0.7, cz + far, Y, white, 100);
        if (i > 0) marks.ground(cx - far, cz + s, cx - near, cz + s + 0.7, Y, white, 100);
        if (i < NX) marks.ground(cx + near, cz + s, cx + far, cz + s + 0.7, Y, white, 100);
      }
      // stop lines on the approaching (right-hand) half
      if (j > 0) marks.ground(cx - HALF_ROAD + 0.3, cz - far - 0.8, cx, cz - far - 0.4, Y, white, 100);
      if (j < NZ) marks.ground(cx, cz + far + 0.4, cx + HALF_ROAD - 0.3, cz + far + 0.8, Y, white, 100);
      if (i > 0) marks.ground(cx - far - 0.8, cz, cx - far - 0.4, cz + HALF_ROAD - 0.3, Y, white, 100);
      if (i < NX) marks.ground(cx + far + 0.4, cz - HALF_ROAD + 0.3, cx + far + 0.8, cz, Y, white, 100);
    }
  }
  const markMesh = new THREE.Mesh(marks.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }));
  markMesh.receiveShadow = true;
  group.add(markMesh);

  // beach sand from the promenade to the sea, the quay, and the green hills beyond the grid
  const sand = new MeshBuilder();
  sand.ground(-200, CITY_H + HALF_ROAD, QUAY_X, SHORE_Z + 2, 0.0, '#ffffff', 8);
  // the wet slope down under the waterline
  sand.quad([-200, -2.2, SHORE_Z + 26], [QUAY_X, -2.2, SHORE_Z + 26], [QUAY_X, 0, SHORE_Z + 2], [-200, 0, SHORE_Z + 2], [0, 1, 0], [0, 0, 60, 3], '#c9ad7c');
  const sandMesh = new THREE.Mesh(sand.build(), new THREE.MeshStandardMaterial({ map: makeSand(), roughness: 1, vertexColors: true }));
  sandMesh.receiveShadow = true;
  group.add(sandMesh);

  const quay = new MeshBuilder();
  quay.ground(CITY_W + HALF_ROAD, -HALF_ROAD - 30, QUAY_X, CITY_H + HALF_ROAD, 0.02, '#ffffff', 8);
  quay.box(QUAY_X - 0.01, -3, -HALF_ROAD - 30, QUAY_X + 1.2, 0.02, SHORE_Z + 30, '#8a857c', { skip: 'b' });
  const quayMesh = new THREE.Mesh(quay.build(), new THREE.MeshStandardMaterial({ map: makeConcrete(), roughness: 0.95, vertexColors: true }));
  quayMesh.receiveShadow = true;
  group.add(quayMesh);

  const hills = new MeshBuilder();
  hills.ground(-900, -900, QUAY_X, -HALF_ROAD - 30, -0.02, '#ffffff', 12);
  hills.ground(-900, -HALF_ROAD - 30, -HALF_ROAD - 30, SHORE_Z + 30, -0.02, '#ffffff', 12);
  const hillMesh = new THREE.Mesh(hills.build(), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, vertexColors: true }));
  hillMesh.receiveShadow = true;
  group.add(hillMesh);

  scene.add(group);
  return group;
}

/** Height of the walkable surface at (x,z): road 0, raised sidewalks, the pier deck. */
export function groundHeight(x, z) {
  if (z > CITY_H + HALF_ROAD) {
    if (z > SHORE_Z - 4 && x > PIER.x0 - 1 && x < PIER.x1 + 1) return PIER_DECK;
    if (z > CITY_H + 52 && z < CITY_H + 64 && x > PIER.x0 - 1 && x < PIER.x1 + 1) return PIER_DECK * Math.min(1, (z - CITY_H - 52) / 10);
    if (z < CITY_H + HALF_ROAD + PROMENADE) return CURB;
    return 0;
  }
  if (x > CITY_W + HALF_ROAD) return 0.02;
  if (x < -HALF_ROAD || z < -HALF_ROAD) return 0;
  return onRoad(x, z) ? 0 : CURB;
}
export const PIER_DECK = 0.9;
