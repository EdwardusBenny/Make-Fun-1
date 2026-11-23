// Street furniture and greenery, all instanced: palm trees, street lamps (with light pools at
// night), working traffic signals, beach umbrellas and lifeguard towers, villa pools and the park fountain.
import * as THREE from 'three';
import { MeshBuilder } from './meshbuilder.js';
import { createRandom } from '../core/random.js';
import { NX, NZ, PITCH, HALF_ROAD, CITY_W, CITY_H, SHORE_Z, blockRect, blockDistrict, SPECIAL_BLOCKS } from './layout.js';
import { CURB } from './roads.js';
import { addCollider } from './collision.js';
import { lightState } from './roadgraph.js';

const dummy = new THREE.Object3D();

function palmGeometry() {
  const b = new MeshBuilder();
  const rnd = createRandom(77);
  const m = new THREE.Matrix4();
  // a gently curving trunk of stacked tapered segments
  const segs = 8, H = 9;
  let x = 0, z = 0;
  for (let s = 0; s < segs; s++) {
    const r0 = 0.32 - s * 0.018, r1 = 0.32 - (s + 1) * 0.018;
    const g = new THREE.CylinderGeometry(r1, r0, H / segs, 7, 1, true);
    const lean = (s / segs) ** 2 * 1.4;
    m.makeTranslation(x + lean, (s + 0.5) * (H / segs), z);
    b.add(g, m, s % 2 ? '#8a6b4a' : '#9c7b56');
  }
  const top = new THREE.Vector3(1.4, H, 0);
  // fronds: arched strips drooping from the crown
  for (let f = 0; f < 10; f++) {
    const ang = (f / 10) * Math.PI * 2 + rnd() * 0.3;
    const len = 4.2 + rnd() * 1.2;
    const dx = Math.cos(ang), dz = Math.sin(ang);
    const px = -dz, pz = dx;
    const steps = 6;
    let prev = null;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const w = Math.sin(t * Math.PI) * 0.75 + 0.05;
      const cx = top.x + dx * len * t, cz = top.z + dz * len * t;
      const cy = top.y + Math.sin(t * Math.PI * 0.9) * 1.1 - t * t * 2.4;
      const cur = [[cx - px * w, cy, cz - pz * w], [cx + px * w, cy, cz + pz * w]];
      if (prev) {
        const col = k % 2 ? '#3f8a3a' : '#4f9e44';
        b.quad(prev[0], prev[1], cur[1], cur[0], [0, 1, 0], [0, 0, 1, 1], col);
        b.quad(prev[1], prev[0], cur[0], cur[1], [0, -1, 0], [0, 0, 1, 1], '#2f6f2c');
      }
      prev = cur;
    }
  }
  const coco = new THREE.SphereGeometry(0.22, 6, 5);
  for (let k = 0; k < 4; k++) { m.makeTranslation(top.x + Math.cos(k * 1.6) * 0.35, top.y - 0.3, Math.sin(k * 1.6) * 0.35); b.add(coco, m, '#5a3d1f'); }
  return b.build();
}

function lampGeometry() {
  const b = new MeshBuilder();
  const m = new THREE.Matrix4();
  m.makeTranslation(0, 3.6, 0); b.add(new THREE.CylinderGeometry(0.09, 0.14, 7.2, 6), m, '#3b3f46');
  m.makeTranslation(0.9, 7.1, 0); b.add(new THREE.BoxGeometry(1.9, 0.12, 0.12), m, '#3b3f46');
  m.makeTranslation(1.75, 6.95, 0); b.add(new THREE.BoxGeometry(0.7, 0.18, 0.35), m, '#2b2f36');
  return b.build();
}

function signalGeometry() {
  const b = new MeshBuilder();
  const m = new THREE.Matrix4();
  m.makeTranslation(0, 2.2, 0); b.add(new THREE.CylinderGeometry(0.08, 0.1, 4.4, 6), m, '#2e3238');
  m.makeTranslation(0, 4.2, 0.18); b.add(new THREE.BoxGeometry(0.42, 1.25, 0.3), m, '#1d1f22');
  return b.build();
}

function umbrellaGeometry() {
  const b = new MeshBuilder();
  const m = new THREE.Matrix4();
  m.makeTranslation(0, 1.2, 0); b.add(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 5), m, '#eeeeee');
  m.makeTranslation(0, 2.35, 0); b.add(new THREE.ConeGeometry(1.5, 0.6, 8, 1, true), m, '#ffffff');
  return b.build();
}

export function buildProps(scene, palmSpots, extras) {
  const group = new THREE.Group();
  group.name = 'props';
  const rnd = createRandom(4242);

  // palms: from the building plan, along the beach promenade and the Palm Heights streets
  const palms = [...palmSpots];
  for (let x = -20; x < CITY_W + 20; x += 16) palms.push({ x: x + rnd() * 4, z: CITY_H + HALF_ROAD + 4.5, s: 0.9 + rnd() * 0.35 });
  for (let x = -10; x < CITY_W; x += 26) palms.push({ x: x + rnd() * 8, z: CITY_H + 40 + rnd() * 30, s: 0.8 + rnd() * 0.5 });
  for (let i = 0; i <= 3; i++) for (let z = 10; z < 4 * PITCH; z += 20) palms.push({ x: i * PITCH + HALF_ROAD + 1.4, z, s: 0.85 + rnd() * 0.3 });
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    if (blockDistrict(i, j) !== 'mercado' || rnd() < 0.5) continue;
    const r = blockRect(i, j);
    palms.push({ x: r.x0 + 1.2, z: r.z0 + 12 + rnd() * 40, s: 0.8 + rnd() * 0.2 });
  }
  const palmMesh = new THREE.InstancedMesh(palmGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }), palms.length);
  palms.forEach((p, k) => {
    dummy.position.set(p.x, CURB, p.z);
    dummy.rotation.set(0, rnd() * Math.PI * 2, 0);
    dummy.scale.setScalar(p.s ?? 1);
    dummy.updateMatrix();
    palmMesh.setMatrixAt(k, dummy.matrix);
    addCollider(p.x - 0.35, p.z - 0.35, p.x + 0.35, p.z + 0.35, 8, 0, 'palm');
  });
  palmMesh.castShadow = true; palmMesh.receiveShadow = true;
  group.add(palmMesh);

  // street lamps along every block edge, arm reaching over the road
  const lamps = [];
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NZ; j++) {
      const r = blockRect(i, j);
      for (let t = 0.2; t < 1; t += 0.6) {
        lamps.push({ x: r.x0 + (r.x1 - r.x0) * t, z: r.z0 + 0.6, ry: Math.PI / 2 });
        lamps.push({ x: r.x0 + (r.x1 - r.x0) * (t + 0.2), z: r.z1 - 0.6, ry: -Math.PI / 2 });
        lamps.push({ x: r.x0 + 0.6, z: r.z0 + (r.z1 - r.z0) * (t + 0.2), ry: Math.PI });
        lamps.push({ x: r.x1 - 0.6, z: r.z0 + (r.z1 - r.z0) * t, ry: 0 });
      }
    }
  }
  const lampMesh = new THREE.InstancedMesh(lampGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 }), lamps.length);
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#fff3d0' });
  const bulbMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.06, 0.3), bulbMat, lamps.length);
  const poolTex = lightPoolTexture();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffcf8a' });
  const poolMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), poolMat, lamps.length);
  lamps.forEach((l, k) => {
    dummy.position.set(l.x, CURB, l.z); dummy.rotation.set(0, l.ry, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
    lampMesh.setMatrixAt(k, dummy.matrix);
    const hx = l.x + Math.cos(l.ry) * 1.75, hz = l.z - Math.sin(l.ry) * 1.75;
    dummy.position.set(hx, CURB + 6.85, hz); dummy.updateMatrix();
    bulbMesh.setMatrixAt(k, dummy.matrix);
    dummy.position.set(hx, 0.05, hz); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    poolMesh.setMatrixAt(k, dummy.matrix);
    addCollider(l.x - 0.15, l.z - 0.15, l.x + 0.15, l.z + 0.15, 7, 0, 'pole');
  });
  lampMesh.castShadow = true;
  group.add(lampMesh, bulbMesh, poolMesh);

  // traffic signals: one head per approach, its lit lamp moved and recoloured as the cycle runs
  const signals = [];
  const C = HALF_ROAD + 1.2;
  for (let i = 0; i <= NX; i++) {
    for (let j = 0; j <= NZ; j++) {
      const cx = i * PITCH, cz = j * PITCH;
      if (j > 0) signals.push({ i, j, axis: 1, x: cx - C, z: cz - C, ry: Math.PI });
      if (j < NZ) signals.push({ i, j, axis: 1, x: cx + C, z: cz + C, ry: 0 });
      if (i > 0) signals.push({ i, j, axis: 0, x: cx - C, z: cz + C, ry: -Math.PI / 2 });
      if (i < NX) signals.push({ i, j, axis: 0, x: cx + C, z: cz - C, ry: Math.PI / 2 });
    }
  }
  const sigMesh = new THREE.InstancedMesh(signalGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), signals.length);
  const litMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), signals.length);
  signals.forEach((s, k) => {
    dummy.position.set(s.x, CURB, s.z); dummy.rotation.set(0, s.ry, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
    sigMesh.setMatrixAt(k, dummy.matrix);
    litMesh.setColorAt(k, new THREE.Color('#ff2020'));
    addCollider(s.x - 0.12, s.z - 0.12, s.x + 0.12, s.z + 0.12, 4.5, 0, 'pole');
  });
  sigMesh.castShadow = true;
  group.add(sigMesh, litMesh);
  const lampColors = { red: new THREE.Color('#ff2a1a'), amber: new THREE.Color('#ffb21a'), green: new THREE.Color('#2aff6a') };
  const lampY = { red: 4.6, amber: 4.2, green: 3.8 };

  // beach: umbrellas, towels and lifeguard towers
  const umbrellas = [];
  for (let k = 0; k < 70; k++) umbrellas.push({ x: -10 + rnd() * (CITY_W + 20), z: CITY_H + 45 + rnd() * 40 });
  const umbColors = ['#ff5fa2', '#2ec4b6', '#ffd23f', '#ff7a3d', '#3a86ff', '#ffffff'];
  const umbMesh = new THREE.InstancedMesh(umbrellaGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }), umbrellas.length);
  const towelMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.03, 2), new THREE.MeshStandardMaterial({ roughness: 1 }), umbrellas.length);
  umbrellas.forEach((u, k) => {
    dummy.position.set(u.x, 0, u.z); dummy.rotation.set((rnd() - 0.5) * 0.2, rnd() * 6, 0); dummy.updateMatrix();
    umbMesh.setMatrixAt(k, dummy.matrix);
    umbMesh.setColorAt(k, new THREE.Color(umbColors[k % umbColors.length]));
    dummy.position.set(u.x + 1.4, 0.03, u.z + 0.5); dummy.rotation.set(0, rnd(), 0); dummy.updateMatrix();
    towelMesh.setMatrixAt(k, dummy.matrix);
    towelMesh.setColorAt(k, new THREE.Color(umbColors[(k + 2) % umbColors.length]));
  });
  umbMesh.castShadow = true; towelMesh.receiveShadow = true;
  group.add(umbMesh, towelMesh);

  const towers = new MeshBuilder();
  for (let x = 60; x < CITY_W; x += 190) {
    const z = CITY_H + 70;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) towers.box(x + dx * 1.2 - 0.1, 0, z + dz * 1.2 - 0.1, x + dx * 1.2 + 0.1, 2.6, z + dz * 1.2 + 0.1, '#f4f4f4');
    towers.box(x - 1.6, 2.6, z - 1.6, x + 1.6, 2.8, z + 1.6, '#f4f4f4');
    towers.box(x - 1.4, 2.8, z - 1.4, x + 1.4, 4.6, z + 1.4, '#ff5a3c');
    towers.box(x - 1.8, 4.6, z - 1.8, x + 1.8, 4.9, z + 1.8, '#ffffff');
    addCollider(x - 1.6, z - 1.6, x + 1.6, z + 1.6, 4.9, 0, 'tower');
  }
  // villa pools, the park fountain
  const pools = new MeshBuilder();
  for (const e of extras) {
    if (e.type === 'pool') {
      towers.box(e.x - e.w / 2 - 0.5, CURB, e.z - e.d / 2 - 0.5, e.x + e.w / 2 + 0.5, CURB + 0.12, e.z + e.d / 2 + 0.5, '#f0ece4');
      pools.ground(e.x - e.w / 2, e.z - e.d / 2, e.x + e.w / 2, e.z + e.d / 2, CURB + 0.14, '#ffffff', 4);
    } else if (e.type === 'fountain') {
      const m = new THREE.Matrix4();
      m.makeTranslation(e.x, CURB + 0.4, e.z); towers.add(new THREE.CylinderGeometry(7, 7.4, 0.8, 24), m, '#e8dcc8');
      pools.add(new THREE.CircleGeometry(6.5, 24).rotateX(-Math.PI / 2), new THREE.Matrix4().makeTranslation(e.x, CURB + 0.75, e.z), '#ffffff');
      m.makeTranslation(e.x, CURB + 1.6, e.z); towers.add(new THREE.CylinderGeometry(0.5, 0.8, 2.4, 10), m, '#e8dcc8');
      m.makeTranslation(e.x, CURB + 2.9, e.z); towers.add(new THREE.CylinderGeometry(2.2, 1.2, 0.4, 16), m, '#e8dcc8');
      addCollider(e.x - 6.5, e.z - 6.5, e.x + 6.5, e.z + 6.5, 1.2, 0, 'fountain');
    }
  }
  const towerMesh = new THREE.Mesh(towers.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  towerMesh.castShadow = true; towerMesh.receiveShadow = true;
  group.add(towerMesh);
  const poolWater = new THREE.Mesh(pools.build(), new THREE.MeshStandardMaterial({ color: '#3fd0e8', roughness: 0.1, metalness: 0.2, emissive: '#0a5a70', emissiveIntensity: 0.4 }));
  group.add(poolWater);

  scene.add(group);
  let lastSignalUpdate = -1;
  return {
    group,
    update(time, night) {
      poolMat.opacity = night * 0.55;
      bulbMat.color.setRGB(0.6 + night * 0.4, 0.55 + night * 0.4, 0.4 + night * 0.4);
      if (Math.floor(time * 4) === lastSignalUpdate) return;
      lastSignalUpdate = Math.floor(time * 4);
      signals.forEach((s, k) => {
        const st = lightState(s.i, s.j, s.axis, time);
        const fx = Math.sin(s.ry) * 0.33, fz = Math.cos(s.ry) * 0.33;
        dummy.position.set(s.x + fx, CURB + lampY[st], s.z + fz); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
        litMesh.setMatrixAt(k, dummy.matrix);
        litMesh.setColorAt(k, lampColors[st]);
      });
      litMesh.instanceMatrix.needsUpdate = true;
      if (litMesh.instanceColor) litMesh.instanceColor.needsUpdate = true;
    },
  };
}

function lightPoolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export { SHORE_Z, SPECIAL_BLOCKS };
