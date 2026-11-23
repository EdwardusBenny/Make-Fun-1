// The sea around Sunvale's south coast and harbour: a wide glossy plane with a scrolling procedural
// normal map that catches the low sun, plus a band of surf foam along the beach.
import * as THREE from 'three';
import { makeWaterNormal } from './textures.js';
import { SHORE_Z, QUAY_X, CITY_H } from './layout.js';

export const SEA_LEVEL = -0.55;

export function buildWater(scene, envMap) {
  const normal = makeWaterNormal();
  normal.repeat.set(180, 180);
  const mat = new THREE.MeshStandardMaterial({
    color: '#1f8fa8', roughness: 0.12, metalness: 0.35, normalMap: normal, normalScale: new THREE.Vector2(0.6, 0.6),
    envMap, envMapIntensity: 1.0,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000).rotateX(-Math.PI / 2), mat);
  sea.position.set(400, SEA_LEVEL, 400);
  sea.receiveShadow = true;
  scene.add(sea);

  // surf: a soft white strip that breathes in and out along the shore
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  for (let x = 0; x < 256; x += 2) {
    const h = 20 + Math.sin(x * 0.11) * 8 + Math.sin(x * 0.37) * 4;
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.7, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(x, 0, 2, h);
  }
  const foamTex = new THREE.CanvasTexture(c);
  foamTex.wrapS = THREE.RepeatWrapping;
  foamTex.repeat.set(40, 1);
  const foamMat = new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, opacity: 0.8 });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(QUAY_X + 400, 7).rotateX(-Math.PI / 2), foamMat);
  foam.position.set((QUAY_X - 400) / 2 + 100, SEA_LEVEL + 0.06, SHORE_Z + 7);
  scene.add(foam);

  void CITY_H;
  return {
    update(time) {
      normal.offset.set(time * 0.004, time * 0.0065);
      foamTex.offset.x = time * 0.01;
      foam.position.z = SHORE_Z + 7 + Math.sin(time * 0.7) * 1.2;
      foamMat.opacity = 0.55 + Math.sin(time * 0.7 + 1) * 0.25;
    },
  };
}
