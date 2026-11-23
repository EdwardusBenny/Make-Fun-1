// Point-sprite particles for muzzle flashes, sparks, blood, tyre smoke, fire and explosions: two
// pooled systems (additive glow and soft smoke) updated on the CPU and drawn in one call each.
import * as THREE from 'three';

function spriteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function createPool(scene, capacity, additive, tex) {
  const pos = new Float32Array(capacity * 3);
  const col = new Float32Array(capacity * 4);
  const size = new Float32Array(capacity);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, scale: { value: 600 } },
    vertexShader: `attribute float size; attribute vec4 color; varying vec4 vColor; uniform float scale;
      void main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec4 vColor;
      void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor.rgb, vColor.a * t.a); if (gl_FragColor.a < 0.01) discard; }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = additive ? 3 : 2;
  scene.add(points);
  const parts = [];
  for (let k = 0; k < capacity; k++) parts.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 1, r: 1, g: 1, b: 1, a: 1, grav: 0, drag: 0 });
  let cursor = 0;
  return {
    mat,
    emit(o) {
      const p = parts[cursor];
      cursor = (cursor + 1) % capacity;
      Object.assign(p, { grav: 0, drag: 0, a: 1 }, o);
      p.life = p.max;
    },
    update(dt) {
      let n = 0;
      for (const p of parts) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) continue;
        p.vy -= p.grav * dt;
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vy *= d; p.vz *= d;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.3; }
        const t = 1 - p.life / p.max;
        pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
        col[n * 4] = p.r; col[n * 4 + 1] = p.g; col[n * 4 + 2] = p.b; col[n * 4 + 3] = p.a * (1 - t) * (t < 0.1 && !additive ? t * 10 : 1);
        size[n] = p.s0 + (p.s1 - p.s0) * t;
        n++;
      }
      geo.setDrawRange(0, n);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.attributes.size.needsUpdate = true;
    },
  };
}

export function createParticles(scene) {
  const tex = spriteTexture();
  const glow = createPool(scene, 1500, true, tex);
  const smoke = createPool(scene, 1200, false, tex);
  const r = Math.random;
  const fx = {
    resize(h) { glow.mat.uniforms.scale.value = h * 0.9; smoke.mat.uniforms.scale.value = h * 0.9; },
    update(dt) { glow.update(dt); smoke.update(dt); },
    muzzle(x, y, z, dx, dz) {
      for (let k = 0; k < 4; k++) glow.emit({ x: x + dx * k * 0.12, y, z: z + dz * k * 0.12, vx: dx * 3, vy: 0, vz: dz * 3, max: 0.06, s0: 0.9 - k * 0.15, s1: 0.2, r: 1, g: 0.8, b: 0.4 });
      smoke.emit({ x, y, z, vx: dx, vy: 0.6, vz: dz, max: 0.6, s0: 0.2, s1: 0.8, r: 0.8, g: 0.8, b: 0.8, a: 0.35 });
    },
    sparks(x, y, z, n = 8) {
      for (let k = 0; k < n; k++) glow.emit({ x, y, z, vx: (r() - 0.5) * 8, vy: r() * 5, vz: (r() - 0.5) * 8, max: 0.3 + r() * 0.3, s0: 0.18, s1: 0.05, r: 1, g: 0.75, b: 0.3, grav: 14 });
      smoke.emit({ x, y, z, vx: 0, vy: 0.4, vz: 0, max: 0.7, s0: 0.3, s1: 1.0, r: 0.6, g: 0.58, b: 0.55, a: 0.4 });
    },
    blood(x, y, z, n = 10) {
      for (let k = 0; k < n; k++) smoke.emit({ x, y, z, vx: (r() - 0.5) * 3, vy: r() * 2.5, vz: (r() - 0.5) * 3, max: 0.5 + r() * 0.3, s0: 0.16, s1: 0.08, r: 0.55, g: 0.02, b: 0.03, a: 0.95, grav: 9 });
    },
    dust(x, z, strength = 1) {
      smoke.emit({ x: x + (r() - 0.5), y: 0.3, z: z + (r() - 0.5), vx: (r() - 0.5) * 1.5, vy: 0.6 + r(), vz: (r() - 0.5) * 1.5, max: 1.4, s0: 0.6 * strength, s1: 2.8 * strength, r: 0.85, g: 0.83, b: 0.8, a: 0.35 });
    },
    carSmoke(x, y, z, dark) {
      const c = dark ? 0.15 : 0.6;
      smoke.emit({ x: x + (r() - 0.5) * 0.6, y, z: z + (r() - 0.5) * 0.6, vx: (r() - 0.5) * 0.6, vy: 2 + r(), vz: (r() - 0.5) * 0.6, max: 2.2, s0: 0.6, s1: 3, r: c, g: c, b: c, a: 0.55 });
    },
    fire(x, y, z) {
      glow.emit({ x: x + (r() - 0.5) * 1.2, y, z: z + (r() - 0.5) * 1.2, vx: (r() - 0.5), vy: 2 + r() * 2, vz: (r() - 0.5), max: 0.6 + r() * 0.3, s0: 1.4, s1: 0.3, r: 1, g: 0.45 + r() * 0.3, b: 0.1 });
    },
    explosion(x, y, z) {
      for (let k = 0; k < 60; k++) {
        const a = r() * Math.PI * 2, s = 4 + r() * 12;
        glow.emit({ x, y, z, vx: Math.cos(a) * s, vy: r() * 10, vz: Math.sin(a) * s, max: 0.5 + r() * 0.6, s0: 2.6, s1: 0.4, r: 1, g: 0.5 + r() * 0.4, b: 0.15, drag: 2.5 });
      }
      for (let k = 0; k < 30; k++) {
        smoke.emit({ x: x + (r() - 0.5) * 3, y: y + r() * 2, z: z + (r() - 0.5) * 3, vx: (r() - 0.5) * 4, vy: 2 + r() * 5, vz: (r() - 0.5) * 4, max: 3 + r() * 2, s0: 2, s1: 7, r: 0.12, g: 0.11, b: 0.1, a: 0.7, drag: 1 });
      }
      for (let k = 0; k < 25; k++) glow.emit({ x, y, z, vx: (r() - 0.5) * 20, vy: 5 + r() * 12, vz: (r() - 0.5) * 20, max: 1 + r(), s0: 0.25, s1: 0.1, r: 1, g: 0.8, b: 0.4, grav: 16 });
    },
    splash(x, z) {
      for (let k = 0; k < 20; k++) smoke.emit({ x, y: 0, z, vx: (r() - 0.5) * 4, vy: 3 + r() * 4, vz: (r() - 0.5) * 4, max: 0.9, s0: 0.4, s1: 0.2, r: 0.9, g: 0.95, b: 1, a: 0.8, grav: 12 });
    },
    sparkle(x, y, z) {
      glow.emit({ x: x + (r() - 0.5), y: y + (r() - 0.5), z: z + (r() - 0.5), vx: 0, vy: 0.8, vz: 0, max: 0.8, s0: 0.3, s1: 0, r: 1, g: 0.85, b: 0.3 });
    },
  };
  return fx;
}
