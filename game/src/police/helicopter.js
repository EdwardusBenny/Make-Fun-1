// The SVPD helicopter: joins the chase at four stars, flies in from the edge of the city, circles
// above Cass with a searchlight (it always counts as seeing her when close), and at five stars a
// marksman takes shots from the open door.
import * as THREE from 'three';
import { damp, dampAngle } from '../core/mathutil.js';
import { rand } from '../core/random.js';

function buildHeli() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.4, metalness: 0.3 });
  const blue = new THREE.MeshStandardMaterial({ color: '#1d3f8a', roughness: 0.4, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1a2a38', roughness: 0.05, metalness: 0.9 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12).scale(1, 0.9, 1.7), white);
  const stripe = new THREE.Mesh(new THREE.SphereGeometry(1.62, 16, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.2).scale(1, 0.9, 1.7), blue);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 10).scale(1, 0.8, 1), glass);
  nose.position.set(0, 0.2, 1.6);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 5, 8).rotateX(Math.PI / 2), white);
  boom.position.set(0, 0.3, -4.2);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.9), blue);
  fin.position.set(0, 0.9, -6.4);
  const rotor = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 11), dark);
    blade.rotation.y = (k * Math.PI) / 4;
    rotor.add(blade);
  }
  rotor.position.y = 1.7;
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.8, 0.2), dark);
  tailRotor.position.set(0.2, 0.9, -6.4);
  for (const x of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.6), dark);
    skid.position.set(x, -1.5, 0);
    g.add(skid);
  }
  const lightCone = new THREE.Mesh(new THREE.ConeGeometry(7, 46, 24, 1, true).translate(0, -23, 0),
    new THREE.MeshBasicMaterial({ color: '#fff6d0', transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  lightCone.position.set(0, -1.2, 1.2);
  g.add(body, stripe, nose, boom, fin, rotor, tailRotor, lightCone);
  g.traverse((o) => { if (o.isMesh && o !== lightCone) o.castShadow = true; });
  return { g, rotor, tailRotor, lightCone };
}

export function createHelicopter(world, { combat, wanted }) {
  const m = buildHeli();
  m.g.visible = false;
  world.scene.add(m.g);
  const heli = {
    active: false, x: -400, y: 60, z: -400, heading: 0, cool: 3,
    mesh: m.g,
    update(dt) {
      const p = world.player;
      const px = p.vehicle ? p.vehicle.x : p.x, pz = p.vehicle ? p.vehicle.z : p.z;
      const want = wanted.level >= 4;
      if (want && !heli.active) {
        heli.active = true;
        const a = rand() * Math.PI * 2;
        heli.x = px + Math.cos(a) * 300; heli.z = pz + Math.sin(a) * 300; heli.y = 70;
      }
      if (!heli.active) return;
      m.g.visible = true;
      let tx, tz, ty;
      if (want && p.alive) {
        const orbit = world.time * 0.25;
        tx = px + Math.cos(orbit) * 22; tz = pz + Math.sin(orbit) * 22; ty = 42;
      } else {
        tx = heli.x + Math.sin(heli.heading) * 100; tz = heli.z + Math.cos(heli.heading) * 100; ty = 90;
        if (Math.hypot(heli.x - px, heli.z - pz) > 500) { heli.active = false; m.g.visible = false; return; }
      }
      const dx = tx - heli.x, dz = tz - heli.z;
      const d = Math.hypot(dx, dz);
      const speed = Math.min(32, d * 0.8);
      if (d > 0.5) { heli.x += dx / d * speed * dt; heli.z += dz / d * speed * dt; }
      heli.y = damp(heli.y, ty, 0.8, dt);
      heli.heading = dampAngle(heli.heading, Math.atan2(px - heli.x, pz - heli.z), 1.5, dt);
      m.g.position.set(heli.x, heli.y, heli.z);
      m.g.rotation.set(Math.min(0.25, speed * 0.008), heli.heading, 0);
      m.rotor.rotation.y += dt * 28;
      m.tailRotor.rotation.x += dt * 40;
      // aim the searchlight at Cass
      const lx = px - heli.x, ly = -(heli.y - 1), lz = pz - heli.z;
      m.lightCone.lookAt(new THREE.Vector3(px, 0, pz));
      m.lightCone.rotateX(-Math.PI / 2);
      void lx; void ly; void lz;
      m.lightCone.visible = world.player.alive && want;
      if (wanted.level >= 5 && p.alive) {
        heli.cool -= dt;
        if (heli.cool <= 0) {
          heli.cool = 1.6 + rand() * 1.2;
          const shooter = { x: heli.x, y: heli.y - 1.5, z: heli.z, jump: 0, vehicle: null, muzzle: () => ({ x: heli.x, y: heli.y - 1.8, z: heli.z }) };
          combat.npcShoot(shooter, p.human, 'pistol', 0.45);
        }
      }
    },
    reset() { heli.active = false; m.g.visible = false; },
  };
  return heli;
}
