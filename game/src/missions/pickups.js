// Things to pick up: dropped cash, health hearts, armour vests, ammo boxes and the twelve hidden
// Sun Tokens. They spin and bob, sparkle, and are collected by walking (or driving) through them.
import * as THREE from 'three';
import { groundHeight } from '../city/roads.js';
import { giveWeapon } from '../combat/weapons.js';

const LOOKS = {
  cash: { color: '#4cd964', geo: () => new THREE.BoxGeometry(0.5, 0.12, 0.28), emissive: '#1a6a2a' },
  health: { color: '#ff3b4f', geo: () => new THREE.OctahedronGeometry(0.35), emissive: '#801020' },
  armour: { color: '#3a9bff', geo: () => new THREE.BoxGeometry(0.5, 0.6, 0.2), emissive: '#103a80' },
  ammo: { color: '#d9a43a', geo: () => new THREE.BoxGeometry(0.45, 0.3, 0.3), emissive: '#503000' },
  token: { color: '#ffc928', geo: () => new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20).rotateX(Math.PI / 2), emissive: '#ff8a00' },
};

export function createPickups(world, { fx }) {
  const items = [];
  const geos = {};
  const mats = {};
  for (const [k, l] of Object.entries(LOOKS)) {
    geos[k] = l.geo();
    mats[k] = new THREE.MeshStandardMaterial({ color: l.color, emissive: l.emissive, emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.3 });
  }
  const api = {
    items,
    spawn(kind, x, z, data = {}) {
      const mesh = new THREE.Mesh(geos[kind], mats[kind]);
      mesh.castShadow = true;
      mesh.position.set(x, groundHeight(x, z) + 0.7, z);
      world.scene.add(mesh);
      const it = { kind, x, z, mesh, data, age: 0, life: data.life ?? (kind === 'cash' || kind === 'ammo' ? 40 : Infinity) };
      items.push(it);
      return it;
    },
    remove(it) {
      const k = items.indexOf(it);
      if (k >= 0) items.splice(k, 1);
      world.scene.remove(it.mesh);
    },
    update(dt) {
      const p = world.player;
      const px = p.vehicle ? p.vehicle.x : p.x, pz = p.vehicle ? p.vehicle.z : p.z;
      for (const it of [...items]) {
        it.age += dt;
        it.mesh.rotation.y += dt * 2.2;
        it.mesh.position.y = groundHeight(it.x, it.z) + 0.75 + Math.sin(it.age * 3) * 0.12;
        if (it.kind === 'token' && Math.random() < dt * 4) fx.sparkle(it.x, it.mesh.position.y, it.z);
        if (it.age > it.life) { api.remove(it); continue; }
        if (!p.alive || Math.hypot(it.x - px, it.z - pz) > (p.vehicle ? 2.6 : 1.3)) continue;
        if (collect(it)) api.remove(it);
      }
    },
    clear(kind) { for (const it of [...items]) if (!kind || it.kind === kind) api.remove(it); },
  };

  function collect(it) {
    const p = world.player;
    const h = p.human;
    switch (it.kind) {
      case 'cash': p.money += it.data.amount ?? 20; break;
      case 'health': if (h.health >= h.maxHealth) return false; h.health = h.maxHealth; break;
      case 'armour': if (h.armour >= 100) return false; h.armour = 100; break;
      case 'ammo': {
        const id = p.arsenal.smg.owned && Math.random() < 0.5 ? 'smg' : 'pistol';
        if (!p.arsenal[id].owned) return false;
        giveWeapon(p.arsenal, id, id === 'smg' ? 30 : 12);
        break;
      }
      case 'token': break;
      default: break;
    }
    world.events.emit('pickup', it);
    return true;
  }
  return api;
}
