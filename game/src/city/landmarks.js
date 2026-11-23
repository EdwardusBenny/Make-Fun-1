// Sunvale's landmarks: Starwheel Pier with its Ferris wheel and neon gateway, the harbour cranes on
// the Saltmarsh quay, the striped lighthouse, the hills of the hinterland and boats on the bay.
import * as THREE from 'three';
import { MeshBuilder } from './meshbuilder.js';
import { createRandom } from '../core/random.js';
import { PIER, CITY_W, CITY_H, QUAY_X, SHORE_Z, HALF_ROAD } from './layout.js';
import { makeSign, makeWood } from './textures.js';
import { addCollider } from './collision.js';
import { PIER_DECK } from './roads.js';
import { SEA_LEVEL } from './water.js';

export function buildLandmarks(scene) {
  const group = new THREE.Group();
  group.name = 'landmarks';
  const rnd = createRandom(909);
  const solid = new MeshBuilder();
  const m = new THREE.Matrix4();

  // --- pier deck on piles, with railings
  const deck = new MeshBuilder();
  deck.box(PIER.x0, PIER_DECK - 0.3, CITY_H + 52, PIER.x1, PIER_DECK, PIER.z1, '#ffffff', { tile: [4, 4] });
  const deckMesh = new THREE.Mesh(deck.build(), new THREE.MeshStandardMaterial({ map: makeWood(), vertexColors: true, roughness: 0.9 }));
  deckMesh.receiveShadow = true; deckMesh.castShadow = true;
  group.add(deckMesh);
  for (let z = CITY_H + 60; z < PIER.z1; z += 6) {
    for (const x of [PIER.x0 + 0.4, PIER.x1 - 0.4]) {
      m.makeTranslation(x, (PIER_DECK + SEA_LEVEL - 3) / 2, z);
      solid.add(new THREE.CylinderGeometry(0.3, 0.3, PIER_DECK - SEA_LEVEL + 3, 6), m, '#5a4630');
      solid.box(x - 0.08, PIER_DECK, z - 0.08, x + 0.08, PIER_DECK + 1.1, z + 0.08, '#f4f0e8');
    }
  }
  solid.box(PIER.x0, PIER_DECK + 1.0, CITY_H + 60, PIER.x0 + 0.15, PIER_DECK + 1.15, PIER.z1, '#f4f0e8');
  solid.box(PIER.x1 - 0.15, PIER_DECK + 1.0, CITY_H + 60, PIER.x1, PIER_DECK + 1.15, PIER.z1, '#f4f0e8');
  solid.box(PIER.x0, PIER_DECK + 1.0, PIER.z1 - 0.15, PIER.x1, PIER_DECK + 1.15, PIER.z1, '#f4f0e8');

  // pier gateway arch with a neon name
  const gx = (PIER.x0 + PIER.x1) / 2, gz = CITY_H + 56;
  solid.box(PIER.x0 - 1.2, 0, gz - 0.6, PIER.x0, 9, gz + 0.6, '#ff5fa2');
  solid.box(PIER.x1, 0, gz - 0.6, PIER.x1 + 1.2, 9, gz + 0.6, '#ff5fa2');
  solid.box(PIER.x0 - 1.4, 9, gz - 0.7, PIER.x1 + 1.4, 11.6, gz + 0.7, '#2a1440');
  addCollider(PIER.x0 - 1.2, gz - 0.6, PIER.x0, gz + 0.6, 9);
  addCollider(PIER.x1, gz - 0.6, PIER.x1 + 1.2, gz + 0.6, 9);
  const archSign = makeSign('STARWHEEL PIER', { w: 1024, h: 160, bg: '#2a1440', fg: '#ffd23f', glow: true });
  const signMat = new THREE.MeshStandardMaterial({ map: archSign, emissiveMap: archSign, emissive: '#ffffff', emissiveIntensity: 0.8 });
  for (const [z, ry] of [[gz - 0.72, Math.PI], [gz + 0.72, 0]]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(PIER.x1 - PIER.x0 + 2.6, 2.4), signMat);
    s.position.set(gx, 10.3, z); s.rotation.y = ry;
    group.add(s);
  }

  // food stands on the pier
  const standColors = ['#ff7a3d', '#2ec4b6', '#ffd23f', '#ff5fa2'];
  for (let k = 0; k < 4; k++) {
    const z = CITY_H + 90 + k * 26, x = k % 2 ? PIER.x1 - 3.4 : PIER.x0 + 0.6;
    solid.box(x, PIER_DECK, z, x + 2.8, PIER_DECK + 2.6, z + 4, standColors[k]);
    solid.box(x - 0.3, PIER_DECK + 2.6, z - 0.3, x + 3.1, PIER_DECK + 2.9, z + 4.3, '#ffffff');
    addCollider(x, z, x + 2.8, z + 4, 3);
  }

  // --- the Starwheel
  const wheel = new THREE.Group();
  const wb = new MeshBuilder();
  const R = 22, spokes = 16;
  const ring = new THREE.TorusGeometry(R, 0.35, 6, 64);
  wb.add(ring, new THREE.Matrix4().makeTranslation(0, 0, 1.2), '#f4f4f4');
  wb.add(ring, new THREE.Matrix4().makeTranslation(0, 0, -1.2), '#f4f4f4');
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * Math.PI * 2;
    const sp = new THREE.CylinderGeometry(0.12, 0.12, R, 4);
    for (const z of [1.2, -1.2]) {
      m.makeRotationZ(a).premultiply(new THREE.Matrix4().makeTranslation(0, 0, z));
      m.multiply(new THREE.Matrix4().makeTranslation(0, R / 2, 0));
      wb.add(sp, m, '#e8e8e8');
    }
  }
  wb.add(new THREE.CylinderGeometry(1.3, 1.3, 3.2, 12).rotateX(Math.PI / 2), new THREE.Matrix4(), '#ff5fa2');
  const wheelMesh = new THREE.Mesh(wb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.5 }));
  wheelMesh.castShadow = true;
  wheel.add(wheelMesh);
  // gondolas hang from the rim and stay level
  const gondolas = [];
  const gColors = ['#ff5fa2', '#38e8ff', '#ffd23f', '#9b5cff'];
  for (let k = 0; k < spokes; k++) {
    const gm = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 2.2), new THREE.MeshStandardMaterial({ color: gColors[k % 4], roughness: 0.5 }));
    gm.castShadow = true;
    wheel.add(gm);
    gondolas.push({ mesh: gm, a: (k / spokes) * Math.PI * 2 });
  }
  // rim lights for the evening
  const bulbs = new THREE.Mesh(new THREE.TorusGeometry(R + 0.3, 0.18, 4, 96), new THREE.MeshBasicMaterial({ color: '#ffd8f0' }));
  wheel.add(bulbs);
  const wx = gx, wz = PIER.z1 - 40, wy = PIER_DECK + R + 3;
  wheel.position.set(wx, wy, wz);
  wheel.rotation.y = Math.PI / 2;
  group.add(wheel);
  for (const dz of [-1, 1]) {
    for (const dx of [-1, 1]) {
      const legLen = Math.hypot(R * 0.6, R + 3);
      m.makeTranslation(wx + dz * 2.6, PIER_DECK + (R + 3) / 2, wz + dx * R * 0.3);
      m.multiply(new THREE.Matrix4().makeRotationX(dx * Math.atan2(R * 0.6, R + 3)));
      solid.add(new THREE.CylinderGeometry(0.35, 0.5, legLen, 6), m, '#d8d8d8');
    }
  }
  addCollider(wx - 3.5, wz - R * 0.65, wx + 3.5, wz + R * 0.65, R * 2 + 4);

  // --- harbour cranes along the quay
  const craneColors = ['#e74c3c', '#f39c12', '#e74c3c'];
  for (let k = 0; k < 3; k++) {
    const cz = 120 + k * 190, cx = QUAY_X - 8;
    const col = craneColors[k];
    for (const [dx, dz] of [[-4, -5], [4, -5], [-4, 5], [4, 5]]) {
      solid.box(cx + dx - 0.5, 0, cz + dz - 0.5, cx + dx + 0.5, 26, cz + dz + 0.5, col);
      addCollider(cx + dx - 0.5, cz + dz - 0.5, cx + dx + 0.5, cz + dz + 0.5, 26);
    }
    solid.box(cx - 5, 24, cz - 6, cx + 5, 30, cz + 6, col);
    solid.box(cx - 26, 30, cz - 1.2, cx + 40, 32.4, cz + 1.2, col);
    solid.box(cx - 3, 32, cz - 3, cx + 3, 36, cz + 3, '#f4f4f4');
    solid.box(cx + 30, 18, cz - 0.05, cx + 30.1, 30, cz + 0.05, '#222');
    solid.box(cx + 28.5, 16.5, cz - 1.3, cx + 31.5, 18, cz + 1.3, '#333');
  }

  // --- lighthouse at the end of the quay breakwater
  const lx = QUAY_X + 60, lz = SHORE_Z + 40;
  solid.box(QUAY_X, -0.5, lz - 4, lx + 6, 0.6, lz + 4, '#9a958c');
  for (let s = 0; s < 6; s++) {
    m.makeTranslation(lx, 0.6 + s * 3.4 + 1.7, lz);
    solid.add(new THREE.CylinderGeometry(2.6 - s * 0.2 - 0.2, 2.6 - s * 0.2, 3.4, 16), m, s % 2 ? '#d62839' : '#ffffff');
  }
  m.makeTranslation(lx, 22.2, lz); solid.add(new THREE.CylinderGeometry(1.8, 1.8, 2.4, 12), m, '#2a2a2a');
  m.makeTranslation(lx, 24.2, lz); solid.add(new THREE.ConeGeometry(2.2, 2, 12), m, '#d62839');
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff4c0' }));
  beacon.position.set(lx, 22.2, lz);
  group.add(beacon);

  // --- hills to the north and west, dotted with hillside homes
  const hills = new MeshBuilder();
  const hillGeo = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const hillSpots = [];
  for (let x = -260; x < QUAY_X + 200; x += 110) hillSpots.push([x + rnd() * 50, -150 - rnd() * 120]);
  for (let z = -100; z < CITY_H + 60; z += 110) hillSpots.push([-170 - rnd() * 120, z + rnd() * 50]);
  for (const [x, z] of hillSpots) {
    const r = 90 + rnd() * 70, h = 30 + rnd() * 45;
    m.compose(new THREE.Vector3(x, -2, z), new THREE.Quaternion(), new THREE.Vector3(r, h, r));
    hills.add(hillGeo, m, rnd() < 0.5 ? '#6f9a4a' : '#8aa55a');
  }
  for (let k = 0; k < 40; k++) {
    const onNorth = k % 2 === 0;
    const x = onNorth ? -100 + rnd() * (CITY_W + 200) : -70 - rnd() * 90;
    const z = onNorth ? -60 - rnd() * 80 : rnd() * CITY_H;
    const y = Math.max(0, (onNorth ? (-z - 50) : (-x - 60)) * 0.22);
    hills.box(x, y - 1, z, x + 8 + rnd() * 6, y + 5 + rnd() * 4, z + 7, '#fff6ea');
  }
  const hillMesh = new THREE.Mesh(hills.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  hillMesh.receiveShadow = true;
  group.add(hillMesh);

  // --- sailboats on the bay
  const boats = [];
  for (let k = 0; k < 9; k++) {
    const b = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
    hull.position.y = 0.2;
    const sail = new THREE.Mesh(new THREE.ConeGeometry(2.6, 9, 3, 1), new THREE.MeshStandardMaterial({ color: k % 3 ? '#fff8f0' : '#ff9ec8', roughness: 0.8 }));
    sail.scale.set(0.15, 1, 1); sail.position.set(0, 5.4, 0.6);
    b.add(hull, sail);
    b.position.set(-100 + rnd() * (CITY_W + 300), SEA_LEVEL, SHORE_Z + 120 + rnd() * 500);
    b.rotation.y = rnd() * 6;
    group.add(b);
    boats.push({ g: b, speed: 1 + rnd() * 2, phase: rnd() * 6 });
  }

  const solidMesh = new THREE.Mesh(solid.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15 }));
  solidMesh.castShadow = true; solidMesh.receiveShadow = true;
  group.add(solidMesh);
  scene.add(group);
  void HALF_ROAD;

  return {
    wheel: { x: wx, z: wz },
    update(time, dt, night) {
      const rot = time * 0.06;
      wheelMesh.rotation.z = rot;
      bulbs.rotation.z = rot;
      for (const g of gondolas) {
        const a = g.a + rot;
        g.mesh.position.set(Math.cos(a) * R, Math.sin(a) * R - 1.4, 0);
      }
      bulbs.material.color.setScalar(0.6 + night * 0.4);
      beacon.material.color.setRGB(1, 0.95, 0.7).multiplyScalar(0.6 + 0.4 * Math.max(0, Math.sin(time * 2)));
      signMat.emissiveIntensity = 0.8 + night * 1.2;
      for (const b of boats) {
        b.g.position.y = SEA_LEVEL + Math.sin(time * 1.3 + b.phase) * 0.15;
        b.g.rotation.z = Math.sin(time * 0.9 + b.phase) * 0.05;
        b.g.position.x += Math.sin(b.g.rotation.y) * b.speed * dt * 0.3;
        b.g.position.z += Math.cos(b.g.rotation.y) * b.speed * dt * 0.3;
      }
    },
  };
}
