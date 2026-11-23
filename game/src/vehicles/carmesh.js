// Procedural car models built from shaped boxes: a paint body, tinted glass cabin, black trim,
// glowing head and tail lights, wheels that spin and steer, and extras per model (taxi roof
// sign, police light bar, pickup bed, van box). Models face +z.
import * as THREE from 'three';
import { MeshBuilder } from '../city/meshbuilder.js';
import { makeSign } from '../city/textures.js';

const paintCache = new Map();
export function paintMaterial(color) {
  if (!paintCache.has(color)) paintCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.55, envMapIntensity: 1.3 }));
  return paintCache.get(color);
}
const shared = {
  trim: new THREE.MeshStandardMaterial({ color: '#1b1c20', roughness: 0.6, metalness: 0.2 }),
  glass: new THREE.MeshStandardMaterial({ color: '#16222c', roughness: 0.05, metalness: 0.9, envMapIntensity: 1.6 }),
  head: new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4c8', emissiveIntensity: 0.6 }),
  tail: new THREE.MeshStandardMaterial({ color: '#b3121c', emissive: '#ff1a1a', emissiveIntensity: 0.5 }),
  tire: new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.9 }),
  rim: new THREE.MeshStandardMaterial({ color: '#c8ccd2', roughness: 0.3, metalness: 0.8 }),
  burnt: new THREE.MeshStandardMaterial({ color: '#1d1a18', roughness: 1 }),
  // light-bar lamps are brighter than white so the bloom pass gives them a halo
  red: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2030').multiplyScalar(4) }),
  blue: new THREE.MeshBasicMaterial({ color: new THREE.Color('#2050ff').multiplyScalar(5) }),
  off: new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.5 }),
};
export const CAR_MATERIALS = shared;

const geoCache = new Map();

/** Side silhouettes (z along the car, y up) for the lower body and the glasshouse of each shape. */
function profiles(spec) {
  const hl = spec.l / 2, h = spec.h;
  switch (spec.shape) {
    case 'coupe': return {
      body: [[-hl, 0.3], [-hl, 0.7], [-hl + 0.35, 0.8], [hl - 1.7, 0.84], [hl - 0.55, 0.7], [hl, 0.56], [hl, 0.3]],
      cabin: [[-hl + 0.75, 0.8], [-0.55, h], [0.35, h], [hl - 1.65, 0.83]], nose: 0.56, belt: 0.8 };
    case 'hatch': return {
      body: [[-hl, 0.3], [-hl, 0.86], [hl - 1.25, 0.9], [hl - 0.35, 0.78], [hl, 0.66], [hl, 0.3]],
      cabin: [[-hl + 0.02, 0.86], [-hl + 0.22, h], [hl - 2.05, h], [hl - 1.25, 0.9]], nose: 0.66, belt: 0.88 };
    case 'pickup': return {
      body: [[-hl, 0.42], [-hl, 1.02], [hl - 0.35, 1.02], [hl, 0.86], [hl, 0.42]],
      cabin: [[-0.35, 1.0], [-0.25, h], [hl - 1.95, h], [hl - 1.3, 1.0]], nose: 0.86, belt: 1.0 };
    case 'van': return {
      body: [[-hl, 0.34], [-hl, h], [hl - 1.15, h], [hl - 0.25, 1.15], [hl, 0.95], [hl, 0.34]],
      cabin: [[hl - 1.12, h - 0.06], [hl - 0.3, 1.18], [hl - 0.55, 1.14], [hl - 1.3, h - 0.3]], nose: 0.95, belt: 1.1 };
    default: return {
      body: [[-hl, 0.32], [-hl, 0.8], [-hl + 0.2, 0.9], [hl - 1.45, 0.93], [hl - 0.4, 0.8], [hl, 0.66], [hl, 0.32]],
      cabin: [[-hl + 0.95, 0.91], [-hl + 1.65, h], [hl - 2.35, h], [hl - 1.45, 0.92]], nose: 0.66, belt: 0.92 };
  }
}

/** Extrude a side silhouette across the car's width (with rounded edges). */
function extrudeProfile(points, width, bevel) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const depth = Math.max(0.05, width - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 2 });
  // shape (u, v, e) -> car (x = width/2 - bevel - e, y = v, z = u), a proper rotation
  geo.applyMatrix4(new THREE.Matrix4().set(0, 0, -1, depth / 2, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  geo.computeVertexNormals();
  return geo;
}

/** Body, cabin and trim geometries for a model shape, cached. */
function shapeGeometries(spec) {
  const key = spec.shape + spec.w + spec.l + spec.h;
  if (geoCache.has(key)) return geoCache.get(key);
  const { w, l } = spec;
  const hw = w / 2, hl = l / 2;
  const pr = profiles(spec);
  const trim = new MeshBuilder(), lightsF = new MeshBuilder(), lightsR = new MeshBuilder();
  const W = '#ffffff';
  const body = extrudeProfile(pr.body, w, 0.08);
  const glass = extrudeProfile(pr.cabin, w - 0.22, 0.05);
  // roof skin in paint over the glasshouse
  const top = pr.cabin.filter(([, y]) => y >= spec.h - 0.01);
  const roofPts = top.length >= 2 ? [[top[0][0] + 0.12, spec.h - 0.06], [top[0][0] + 0.06, spec.h + 0.02], [top[top.length - 1][0] - 0.06, spec.h + 0.02], [top[top.length - 1][0] - 0.12, spec.h - 0.06]] : null;
  const roof = roofPts ? extrudeProfile(roofPts, w - 0.2, 0.03) : null;
  if (spec.shape === 'pickup') {
    // the load bed reads as a dark tonneau cover
    trim.box(-hw + 0.06, pr.belt + 0.01, -hl + 0.15, hw - 0.06, pr.belt + 0.03, -0.45, W);
  }
  // bumpers, grille, side skirts, mirrors
  const by = 0.3;
  trim.box(-hw + 0.02, by - 0.06, hl - 0.06, hw - 0.02, by + 0.16, hl + 0.07, W);
  trim.box(-hw + 0.02, by - 0.06, -hl - 0.07, hw - 0.02, by + 0.16, -hl + 0.06, W);
  trim.box(-hw * 0.45, by + 0.16, hl - 0.02, hw * 0.45, pr.nose - 0.1, hl + 0.03, W);
  trim.box(-hw - 0.01, by - 0.04, -hl + 0.75, hw + 0.01, by + 0.06, hl - 0.75, W);
  const mz = pr.cabin[pr.cabin.length - 1][0] - 0.1;
  trim.box(-hw - 0.16, pr.belt + 0.02, mz - 0.08, -hw + 0.02, pr.belt + 0.16, mz + 0.08, W);
  trim.box(hw - 0.02, pr.belt + 0.02, mz - 0.08, hw + 0.16, pr.belt + 0.16, mz + 0.08, W);
  // lights
  const ly = (by + 0.16 + pr.nose) / 2 + 0.02;
  lightsF.box(-hw + 0.1, ly - 0.06, hl - 0.02, -hw + 0.48, ly + 0.07, hl + 0.04, W);
  lightsF.box(hw - 0.48, ly - 0.06, hl - 0.02, hw - 0.1, ly + 0.07, hl + 0.04, W);
  const ry = spec.shape === 'van' ? 0.9 : Math.min(pr.body[1][1] - 0.12, 0.72);
  lightsR.box(-hw + 0.06, ry - 0.08, -hl - 0.04, -hw + 0.5, ry + 0.08, -hl + 0.02, W);
  lightsR.box(hw - 0.5, ry - 0.08, -hl - 0.04, hw - 0.06, ry + 0.08, -hl + 0.02, W);
  const out = { body, roof, glass, trim: trim.build(), head: lightsF.build(), tail: lightsR.build() };
  geoCache.set(key, out);
  return out;
}

let haloTex = null;
const haloMats = new Map();
function haloMaterial(color) {
  if (!haloTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.7)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    haloTex = new THREE.CanvasTexture(c);
  }
  if (!haloMats.has(color)) haloMats.set(color, new THREE.SpriteMaterial({ map: haloTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  return haloMats.get(color);
}

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14).rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.28, 8).rotateZ(Math.PI / 2);
let taxiSign = null, policeDoor = null;

export function buildCarMesh(spec, color) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // tilts for roll and pitch
  root.add(body);
  const g = shapeGeometries(spec);
  const paint = paintMaterial(color);
  const bodyMesh = new THREE.Mesh(g.body, paint);
  const parts = [bodyMesh, new THREE.Mesh(g.glass, shared.glass), new THREE.Mesh(g.trim, shared.trim), new THREE.Mesh(g.head, shared.head), new THREE.Mesh(g.tail, shared.tail)];
  if (g.roof) parts.push(new THREE.Mesh(g.roof, paint));
  for (const p of parts) { p.castShadow = true; body.add(p); }
  const hw = spec.w / 2, hl = spec.l / 2;
  const wheels = [];
  const axF = hl - 0.85, axR = -hl + 0.85;
  for (const [x, z, front] of [[-hw + 0.12, axF, true], [hw - 0.12, axF, true], [-hw + 0.12, axR, false], [hw - 0.12, axR, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, shared.tire);
    tire.castShadow = true;
    spin.add(tire, new THREE.Mesh(rimGeo, shared.rim));
    pivot.add(spin);
    root.add(pivot);
    wheels.push({ pivot, spin, front });
  }
  const extras = {};
  if (spec.taxi) {
    if (!taxiSign) taxiSign = makeSign('SUNCAB', { w: 256, h: 64, bg: '#111', fg: '#ffc300', glow: false });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.3), new THREE.MeshStandardMaterial({ map: taxiSign, emissiveMap: taxiSign, emissive: '#ffffff', emissiveIntensity: 0.5 }));
    sign.position.set(0, spec.h + 0.14, -0.2);
    body.add(sign);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.03, 0.12, spec.l * 0.55), shared.trim);
    stripe.position.set(0, 0.62, 0);
    body.add(stripe);
  }
  if (spec.police) {
    // black-and-white livery: dark lower doors, light bar on the roof
    const lower = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.02, 0.32, spec.l * 0.5), paintMaterial('#101218'));
    lower.position.set(0, 0.5, -0.1);
    body.add(lower);
    if (!policeDoor) policeDoor = makeSign(['SVPD'], { w: 256, h: 96, bg: '#ffffff', fg: '#1d3f8a', glow: false });
    for (const sx of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.4), new THREE.MeshStandardMaterial({ map: policeDoor, roughness: 0.5 }));
      d.position.set(sx * (spec.w / 2 + 0.015), 0.8, 0.05);
      d.rotation.y = sx * Math.PI / 2;
      body.add(d);
    }
    const bar = new THREE.Group();
    bar.position.set(0, spec.h + 0.08, -0.15);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.3), shared.trim);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.26), shared.off);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.26), shared.off);
    red.position.set(-0.32, 0.1, 0); blue.position.set(0.32, 0.1, 0);
    bar.add(base, red, blue);
    body.add(bar);
    extras.red = red; extras.blue = blue;
    // strobing halos so the bar reads from a distance
    const haloR = new THREE.Sprite(haloMaterial('#ff2a3a'));
    const haloB = new THREE.Sprite(haloMaterial('#3a6bff'));
    haloR.scale.setScalar(2.8); haloB.scale.setScalar(2.8);
    haloR.position.set(-0.32, 0.12, 0); haloB.position.set(0.32, 0.12, 0);
    bar.add(haloR, haloB);
    extras.haloR = haloR; extras.haloB = haloB;
  }
  return { root, body, bodyMesh, wheels, extras, paint };
}
