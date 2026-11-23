// Procedural low-poly people: legs, torso, arms and head on pivots so they can walk, run, aim,
// punch and fall. Looks (skin, clothes, hair, hats) are picked per role: civilians, police,
// Tiburones gang, Krane's security and Cass Moreno herself.
import * as THREE from 'three';
import { createRandom } from '../core/random.js';

const SKINS = ['#f1c7a5', '#e0a982', '#c68863', '#a86b48', '#8a5236', '#5e3a24', '#f6d5bc'];
const SHIRTS = ['#ff5fa2', '#2ec4b6', '#ffd23f', '#ffffff', '#3a86ff', '#ff7a3d', '#8338ec', '#06d6a0', '#ef476f', '#f4a261', '#90e0ef', '#e9c46a'];
const PANTS = ['#1d3557', '#2b2d42', '#6c584c', '#e9d8a6', '#264653', '#ffffff', '#3d405b', '#b08968'];
const HAIR = ['#1a1110', '#3b2314', '#6f4e37', '#c9a26b', '#0b0b0b', '#8d5524', '#d9c2a3'];

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts }));
  return matCache.get(key);
}

const G = {
  leg: new THREE.CapsuleGeometry(0.085, 0.72, 3, 8).translate(0, -0.45, 0),
  shoe: new THREE.BoxGeometry(0.15, 0.09, 0.28).translate(0, -0.9, 0.05),
  torso: new THREE.CylinderGeometry(0.23, 0.18, 0.6, 10).scale(1, 1, 0.58).translate(0, 0.3, 0),
  chest: new THREE.SphereGeometry(0.2, 10, 8).scale(1.15, 0.55, 0.68).translate(0, 0.52, 0),
  hips: new THREE.CylinderGeometry(0.19, 0.2, 0.2, 10).scale(1, 1, 0.65),
  arm: new THREE.CapsuleGeometry(0.06, 0.48, 3, 8).translate(0, -0.3, 0),
  hand: new THREE.SphereGeometry(0.058, 8, 6).translate(0, -0.62, 0),
  neck: new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8).translate(0, 0.64, 0),
  head: new THREE.SphereGeometry(0.125, 14, 12).scale(0.95, 1.12, 1.02),
  nose: new THREE.BoxGeometry(0.03, 0.05, 0.04).translate(0, -0.01, 0.125),
  hair: new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.98, 1.1, 1.06).translate(0, 0.012, -0.008),
  hairBack: new THREE.BoxGeometry(0.24, 0.26, 0.07).translate(0, -0.06, -0.1),
  pony: new THREE.CapsuleGeometry(0.045, 0.22, 3, 6),
  cap: new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.75, 1.05),
  brim: new THREE.BoxGeometry(0.22, 0.025, 0.13),
  gun: new THREE.BoxGeometry(0.05, 0.11, 0.24),
  smg: new THREE.BoxGeometry(0.07, 0.15, 0.42),
  badge: new THREE.BoxGeometry(0.06, 0.06, 0.02),
  belt: new THREE.CylinderGeometry(0.19, 0.19, 0.06, 10).scale(1, 1, 0.65),
};

export function randomLook(seed, role = 'civ') {
  const r = createRandom(seed);
  const p = (list) => list[Math.floor(r() * list.length)];
  const look = { skin: p(SKINS), shirt: p(SHIRTS), pants: p(PANTS), hair: p(HAIR), shoes: r() < 0.5 ? '#f4f4f4' : '#2a2a2a', long: r() < 0.45, cap: r() < 0.15 ? p(SHIRTS) : null, scale: 0.92 + r() * 0.14, jacket: null, sleeveless: r() < 0.3 };
  if (role === 'police') Object.assign(look, { shirt: '#1d3f8a', pants: '#14254d', cap: '#14254d', shoes: '#111', badge: true, long: false });
  if (role === 'gang') Object.assign(look, { shirt: p(['#13a89e', '#0b7a75', '#1fc8bb']), pants: p(['#222', '#2b2d42', '#e9d8a6']), cap: r() < 0.6 ? '#0b0b0b' : null, long: false, sleeveless: true });
  if (role === 'security') Object.assign(look, { shirt: '#18181c', pants: '#18181c', shoes: '#111', long: false, cap: null, jacket: '#2a2a30' });
  if (role === 'boss') Object.assign(look, { shirt: '#f4efe6', pants: '#e9e2d4', shoes: '#6b4226', long: false, hair: '#d9d9d9', scale: 1.02 });
  if (role === 'player') Object.assign(look, { skin: '#c68863', shirt: '#f4f1ea', pants: '#2c4a78', hair: '#120b08', long: false, pony: true, shoes: '#f4f4f4', scale: 1, jacket: '#ff5a4f' });
  return look;
}

/** Build a person; returns the root group and its animated pivots. */
export function buildHumanMesh(look) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const add = (geo, material, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const skin = mat(look.skin), shirt = mat(look.shirt), pants = mat(look.pants), hair = mat(look.hair), shoes = mat(look.shoes);
  const top = look.jacket ? mat(look.jacket) : shirt;
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.1, 0.95, 0); legR.position.set(0.1, 0.95, 0);
  add(G.leg, pants, legL); add(G.shoe, shoes, legL);
  add(G.leg, pants, legR); add(G.shoe, shoes, legR);
  body.add(legL, legR);
  add(G.hips, pants, body, 0, 0.98, 0);
  const torso = new THREE.Group();
  torso.position.set(0, 1.0, 0);
  body.add(torso);
  add(G.torso, top, torso);
  add(G.chest, top, torso);
  if (look.jacket && look.shirt !== look.jacket) add(new THREE.BoxGeometry(0.16, 0.42, 0.02).translate(0, 0.32, 0.122), shirt, torso);
  add(G.neck, skin, torso);
  if (look.badge) { add(G.badge, mat('#ffd23f', { metalness: 0.8, roughness: 0.3 }), torso, 0.1, 0.45, 0.125); add(G.belt, mat('#111'), torso, 0, 0.02, 0); }
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-0.27, 0.55, 0); armR.position.set(0.27, 0.55, 0);
  const sleeve = look.sleeveless ? skin : top;
  add(G.arm, sleeve, armL); add(G.hand, skin, armL);
  add(G.arm, sleeve, armR); add(G.hand, skin, armR);
  torso.add(armL, armR);
  const head = new THREE.Group();
  head.position.set(0, 0.82, 0);
  torso.add(head);
  add(G.head, skin, head);
  add(G.nose, skin, head);
  add(G.hair, hair, head);
  if (look.long) add(G.hairBack, hair, head);
  if (look.pony) { const p = add(G.pony, hair, head, 0, -0.02, -0.17); p.rotation.x = 0.5; }
  if (look.cap) { add(G.cap, mat(look.cap), head, 0, 0.05, 0); add(G.brim, mat(look.cap), head, 0, 0.06, 0.15); }
  // a gun model held in the right hand, shown when armed
  const gun = add(G.gun, mat('#1b1b1f', { metalness: 0.6, roughness: 0.4 }), armR, 0, -0.66, 0.08);
  const smg = add(G.smg, mat('#22252b', { metalness: 0.5, roughness: 0.4 }), armR, 0, -0.66, 0.14);
  gun.visible = false; smg.visible = false;
  root.scale.setScalar(look.scale ?? 1);
  return { root, body, legL, legR, armL, armR, torso, head, gun, smg };
}

/**
 * Pose the rig for this frame: `move` 0..1 walk/run blend, phase for the stride, aim/punch flags,
 * and the dead/down/sit states.
 */
export function poseHuman(rig, { phase, speed, aiming, punch, state, weapon, fall }) {
  const run = Math.min(1, speed / 6);
  const amp = speed < 0.1 ? 0 : 0.45 + run * 0.5;
  const s = Math.sin(phase);
  rig.legL.rotation.x = s * amp;
  rig.legR.rotation.x = -s * amp;
  rig.armL.rotation.x = -s * amp * 0.8;
  rig.armR.rotation.x = s * amp * 0.8;
  rig.armL.rotation.z = 0.06; rig.armR.rotation.z = -0.06;
  rig.torso.rotation.x = run * 0.18;
  rig.body.position.y = speed > 0.1 ? Math.abs(Math.cos(phase)) * 0.05 * (0.5 + run) : 0;
  rig.gun.visible = weapon === 'pistol';
  rig.smg.visible = weapon === 'smg';
  if (aiming) {
    rig.armR.rotation.x = -Math.PI / 2 + 0.05;
    rig.armR.rotation.z = 0.1;
    if (weapon === 'smg' || weapon === 'pistol') { rig.armL.rotation.x = -Math.PI / 2 + 0.25; rig.armL.rotation.z = -0.45; }
  }
  if (punch > 0) {
    const t = Math.sin(Math.min(1, punch) * Math.PI);
    rig.armR.rotation.x = -Math.PI / 2 * t - 0.2;
    rig.torso.rotation.y = -0.3 * t;
  } else rig.torso.rotation.y = 0;
  if (state === 'sit') {
    rig.legL.rotation.x = rig.legR.rotation.x = -Math.PI / 2;
    rig.body.position.y = -0.45;
  }
  if (state === 'dead' || state === 'down') {
    const f = Math.min(1, fall ?? 1);
    rig.body.rotation.x = -Math.PI / 2 * f;
    rig.body.position.y = 0.15 * f;
    rig.body.position.z = -0.9 * f;
    rig.legL.rotation.x = 0.1; rig.legR.rotation.x = -0.15;
    rig.armL.rotation.x = -2.6 * f; rig.armR.rotation.x = -0.4;
    rig.armL.rotation.z = 0.5; rig.armR.rotation.z = -0.7;
  } else {
    rig.body.rotation.x = 0;
    rig.body.position.z = 0;
  }
}
