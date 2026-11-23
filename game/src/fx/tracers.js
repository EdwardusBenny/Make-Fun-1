// Bullet tracers: short-lived glowing line segments from muzzle to impact, pooled in one buffer.
import * as THREE from 'three';

export function createTracers(scene, capacity = 96) {
  const pos = new Float32Array(capacity * 6);
  const col = new Float32Array(capacity * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  lines.frustumCulled = false;
  scene.add(lines);
  const items = [];
  return {
    add(ax, ay, az, bx, by, bz, color = [1, 0.85, 0.5]) {
      if (items.length >= capacity) items.shift();
      items.push({ a: [ax, ay, az], b: [bx, by, bz], life: 0.09, max: 0.09, color });
    },
    update(dt) {
      let n = 0;
      for (let k = items.length - 1; k >= 0; k--) {
        const it = items[k];
        it.life -= dt;
        if (it.life <= 0) { items.splice(k, 1); continue; }
      }
      for (const it of items) {
        const f = it.life / it.max;
        // draw the trailing 60% of the path so it reads as a moving streak
        const t0 = 1 - f;
        const ax = it.a[0] + (it.b[0] - it.a[0]) * t0 * 0.6, ay = it.a[1] + (it.b[1] - it.a[1]) * t0 * 0.6, az = it.a[2] + (it.b[2] - it.a[2]) * t0 * 0.6;
        pos.set([ax, ay, az, it.b[0], it.b[1], it.b[2]], n * 6);
        // over-bright (HDR) colours so the bloom pass thickens the streak into a visible glow
        const g = 4;
        col.set([it.color[0] * f * g, it.color[1] * f * g, it.color[2] * f * g, it.color[0] * g, it.color[1] * g, it.color[2] * g], n * 6);
        n++;
      }
      geo.setDrawRange(0, n * 2);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}
