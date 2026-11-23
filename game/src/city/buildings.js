// Buildings for every block, by district: glass towers in Neon Row, pastel art-deco hotels on the
// Coral Strand, colourful shop-topped walk-ups in Mercado, white villas in Palm Heights and
// warehouses at the docks, plus the story's special buildings. Facades are merged per material
// (one draw call each); every footprint becomes a collider.
import * as THREE from 'three';
import { MeshBuilder } from './meshbuilder.js';
import { createRandom, hash2 } from '../core/random.js';
import { NX, NZ, blockDistrict, lotRect, SPECIAL_BLOCKS, PITCH } from './layout.js';
import { makeFacade, makeStorefronts, makeSign } from './textures.js';
import { addCollider } from './collision.js';
import { CURB } from './roads.js';

const FLOOR = 3.4;
const BAY = 4;
/** Texture tile = 8 bays x 8 floors. */
const TILE = [BAY * 8, FLOOR * 8];

const PALETTES = {
  glass: ['#cfe8ff', '#b8f0ec', '#e8d8c0', '#d0d8ff', '#c8ffe8', '#ffe0c8'],
  office: ['#fff4e6', '#ffe0d0', '#e8f0ff', '#f6efe0', '#ffd8b8', '#e0e8e0'],
  deco: ['#ff9ec4', '#7fe6c8', '#ffcc70', '#b9a4ff', '#7fd4ff', '#ffaa88', '#ffe27a', '#ff8fb0'],
  resid: ['#ff9f80', '#ffd35a', '#86dcb0', '#ffaed2', '#9cc4ff', '#f6bb78', '#d79cff', '#ff8470', '#7fd8e0'],
  villa: ['#ffffff', '#fff4e4', '#f4f8ff'],
  warehouse: ['#c8d4dc', '#e0c8b0', '#b8c8b8', '#d8d0c0', '#a8b8c8'],
};

const SIGN_SETS = {
  hotels: ['HOTEL MARISOL', 'THE FLAMINGO', 'CASA AZUL', 'SEA BREEZE INN', 'THE PALMETTO', 'CORAL ROYALE', 'LUNA MOTEL', 'BAHIA SUITES'],
  ads: [
    ['SOLA COLA', 'TASTE THE SUN'], ['WAVE 98.7 FM', "SUNVALE'S SYNTH STATION"], ['KRANE DEVELOPMENT', "BUILDING TOMORROW'S SUNVALE"],
    ['PICO MOTORS', 'SMALL CAR. BIG SMILE.'], ['GLOW', 'ENERGY THAT NEVER SETS'], ['TIBURON TEQUILA', 'BITE BACK'],
    ['RE-ELECT CALDER', 'SAFE STREETS - BRIGHT FUTURE'], ['STARWHEEL PIER', 'RIDE THE NIGHT'],
  ],
  neon: ['BAR', 'CLUB AQUA', 'LIVE MUSIC', 'NOODLES', 'OPEN 24H', 'KARAOKE', 'DANCE', 'COCKTAILS'],
};
const NEON_COLORS = ['#ff4fa0', '#38e8ff', '#ffd23f', '#9b5cff', '#5dff8a', '#ff7a3d'];

export function buildBuildings(scene, envMap) {
  const group = new THREE.Group();
  group.name = 'buildings';
  const styles = ['glass', 'office', 'deco', 'resid', 'villa', 'warehouse'];
  const facades = {}, builders = {};
  styles.forEach((s, k) => { facades[s] = makeFacade(s, 100 + k); builders[s] = new MeshBuilder(); });
  const roofs = new MeshBuilder();
  const shopsB = new MeshBuilder();
  const trims = new MeshBuilder();
  const shopsTex = makeStorefronts();
  const signs = [];
  const ctx = { builders, roofs, shopsB, trims, signs, shopCount: shopsTex.count, palms: [], lamps: [], extras: [] };

  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NZ; j++) {
      const rnd = createRandom(1000 + i * 97 + j * 13);
      const special = SPECIAL_BLOCKS[`${i},${j}`];
      const lot = lotRect(i, j);
      if (special) buildSpecial(ctx, special, lot, rnd, i, j);
      else buildDistrictBlock(ctx, blockDistrict(i, j), lot, rnd, i, j);
    }
  }

  const materials = {};
  for (const s of styles) {
    const glass = s === 'glass';
    materials[s] = new THREE.MeshStandardMaterial({
      map: facades[s].map, emissiveMap: facades[s].emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0,
      vertexColors: true, roughness: glass ? 0.25 : 0.82, metalness: glass ? 0.45 : 0.02, envMap: glass ? envMap : null, envMapIntensity: 0.9,
    });
    const mesh = new THREE.Mesh(builders[s].build(), materials[s]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  }
  const roofMesh = new THREE.Mesh(roofs.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  roofMesh.castShadow = true; roofMesh.receiveShadow = true;
  group.add(roofMesh);
  const trimMesh = new THREE.Mesh(trims.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 }));
  trimMesh.castShadow = true; trimMesh.receiveShadow = true;
  group.add(trimMesh);
  const shopMat = new THREE.MeshStandardMaterial({ map: shopsTex.map, emissiveMap: shopsTex.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, roughness: 0.6 });
  materials.shops = shopMat;
  const shopMesh = new THREE.Mesh(shopsB.build(), shopMat);
  shopMesh.receiveShadow = true;
  group.add(shopMesh);

  // signs: one textured plane each, glowing at night
  const signMats = [];
  for (const s of signs) {
    const mat = new THREE.MeshStandardMaterial({ map: s.tex, emissiveMap: s.tex, emissive: new THREE.Color('#ffffff'), emissiveIntensity: s.neon ? 0.6 : 0.15, roughness: 0.5, side: THREE.DoubleSide });
    mat.userData.baseGlow = s.neon ? 0.6 : 0.15;
    signMats.push(mat);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
    mesh.position.set(s.x, s.y, s.z);
    mesh.rotation.y = s.ry;
    group.add(mesh);
  }

  scene.add(group);
  return {
    group, palms: ctx.palms, lamps: ctx.lamps, extras: ctx.extras,
    /** 0 = full day, 1 = full night: windows and signs light up. */
    setNight(f) {
      for (const s of styles) materials[s].emissiveIntensity = f * (s === 'warehouse' ? 0.4 : 1.1);
      shopMat.emissiveIntensity = 0.1 + f * 1.0;
      for (const m of signMats) m.emissiveIntensity = m.userData.baseGlow + f * 1.2;
    },
  };
}

function signTexture(text, rnd, neon) {
  const color = NEON_COLORS[Math.floor(rnd() * NEON_COLORS.length)];
  if (Array.isArray(text)) {
    return makeSign(text, { w: 512, h: 256, bg: ['#1a1030', '#ffffff', '#ffd23f', '#0f2a3a', '#ff5fa2'][Math.floor(rnd() * 5)], fg: color, glow: false, border: '#ffffff' });
  }
  return makeSign(text, { w: 512, h: 128, bg: neon ? 'rgba(10,5,20,0.85)' : '#ffffff', fg: color, glow: neon });
}

const texCache = new Map();
function cachedSign(text, rnd, neon) {
  const k = JSON.stringify(text) + neon;
  if (!texCache.has(k)) texCache.set(k, signTexture(text, rnd, neon));
  return texCache.get(k);
}

/** A sign plane facing outward from side (0 n, 1 e, 2 s, 3 w) of a box at height y. */
function addSignOnFace(ctx, box, side, y, w, h, tex, neon, along = 0.5) {
  const { x0, z0, x1, z1 } = box;
  const off = 0.25;
  let x, z, ry;
  if (side === 0) { x = x0 + (x1 - x0) * along; z = z0 - off; ry = Math.PI; }
  else if (side === 1) { x = x1 + off; z = z0 + (z1 - z0) * along; ry = Math.PI / 2; }
  else if (side === 2) { x = x0 + (x1 - x0) * along; z = z1 + off; ry = 0; }
  else { x = x0 - off; z = z0 + (z1 - z0) * along; ry = -Math.PI / 2; }
  ctx.signs.push({ x, y, z, ry, w, h, tex, neon });
}

/** A building: facade box(es) in `style`, roof cap, optional shop band and collider. */
function addBuilding(ctx, style, x0, z0, x1, z1, height, rnd, { shops = false, tint = null, tiers = 0, roofColor = '#8c8a86', parapet = true } = {}) {
  const b = ctx.builders[style];
  const color = tint ?? PALETTES[style][Math.floor(rnd() * PALETTES[style].length)];
  const off = [Math.floor(rnd() * 8) / 8, Math.floor(rnd() * 8) / 8];
  const base = CURB;
  let y0 = base;
  if (shops) {
    const sh = 4.6;
    addShopBand(ctx, x0, z0, x1, z1, base, base + sh, rnd);
    y0 = base + sh;
    ctx.trims.box(x0 - 0.3, y0 - 0.25, z0 - 0.3, x1 + 0.3, y0 + 0.25, z1 + 0.3, '#f4efe6');
  }
  let bx0 = x0, bz0 = z0, bx1 = x1, bz1 = z1, top = base + height;
  const tierCount = tiers;
  for (let t = 0; t <= tierCount; t++) {
    const segTop = t === tierCount ? top : y0 + (top - y0) * (0.55 + 0.15 * t);
    b.box(bx0, y0, bz0, bx1, segTop, bz1, color, { tile: TILE, off, skip: 'tb' });
    addRoof(ctx, bx0, bz0, bx1, bz1, segTop, roofColor, parapet, color);
    y0 = segTop;
    const ix = (bx1 - bx0) * 0.12, iz = (bz1 - bz0) * 0.12;
    bx0 += ix; bx1 -= ix; bz0 += iz; bz1 -= iz;
  }
  addCollider(x0, z0, x1, z1, top, 0, 'building');
  // roof clutter
  const w = x1 - x0, d = z1 - z0;
  const n = Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) {
    const cx = bx0 + rnd() * (bx1 - bx0 - 3), cz = bz0 + rnd() * (bz1 - bz0 - 3);
    ctx.roofs.box(cx, y0, cz, cx + 2 + rnd() * 2, y0 + 1.2 + rnd(), cz + 2 + rnd() * 2, '#b8b8b4');
  }
  if (height > 40 && rnd() < 0.5) ctx.roofs.box(x0 + w / 2 - 0.2, y0, z0 + d / 2 - 0.2, x0 + w / 2 + 0.2, y0 + 10, z0 + d / 2 + 0.2, '#d0d0d0');
  return { x0, z0, x1, z1, top, color };
}

function addRoof(ctx, x0, z0, x1, z1, y, roofColor, parapet, wallColor) {
  ctx.roofs.box(x0, y - 0.05, z0, x1, y + 0.05, z1, roofColor, { skip: 'b' });
  if (parapet) {
    const p = 0.35;
    ctx.roofs.box(x0, y, z0, x1, y + 0.9, z0 + p, wallColor);
    ctx.roofs.box(x0, y, z1 - p, x1, y + 0.9, z1, wallColor);
    ctx.roofs.box(x0, y, z0, x0 + p, y + 0.9, z1, wallColor);
    ctx.roofs.box(x1 - p, y, z0, x1, y + 0.9, z1, wallColor);
  }
}

/** Ground-floor shop fronts around a footprint, one shop per ~10 m of wall. */
function addShopBand(ctx, x0, z0, x1, z1, y0, y1, rnd) {
  const n = ctx.shopCount;
  const cellU = 1 / 4, cellV = 1 / 2;
  const faces = [
    { a: [x1, z0], b: [x0, z0], nrm: [0, 0, -1] },
    { a: [x1, z1], b: [x1, z0], nrm: [1, 0, 0] },
    { a: [x0, z1], b: [x1, z1], nrm: [0, 0, 1] },
    { a: [x0, z0], b: [x0, z1], nrm: [-1, 0, 0] },
  ];
  for (const f of faces) {
    const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    const count = Math.max(1, Math.round(len / 10));
    for (let k = 0; k < count; k++) {
      const t0 = k / count, t1 = (k + 1) / count;
      const ax = f.a[0] + (f.b[0] - f.a[0]) * t0, az = f.a[1] + (f.b[1] - f.a[1]) * t0;
      const bx = f.a[0] + (f.b[0] - f.a[0]) * t1, bz = f.a[1] + (f.b[1] - f.a[1]) * t1;
      const s = Math.floor(rnd() * n);
      const u0 = (s % 4) * cellU, v1 = 1 - Math.floor(s / 4) * cellV, v0 = v1 - cellV;
      ctx.shopsB.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], f.nrm, [u0 + 0.002, v0 + 0.004, u0 + cellU - 0.002, v1 - 0.004], '#ffffff');
    }
  }
}

function pastel(rnd, style) { const p = PALETTES[style]; return p[Math.floor(rnd() * p.length)]; }

function buildDistrictBlock(ctx, district, lot, rnd, i, j) {
  const { x0, z0, x1, z1 } = lot;
  const W = x1 - x0, D = z1 - z0;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  if (district === 'neon') {
    const split = rnd() < 0.55;
    if (split) {
      const m = x0 + W * (0.4 + rnd() * 0.2);
      const h1 = 45 + rnd() * 70, h2 = 30 + rnd() * 60;
      const a = addBuilding(ctx, rnd() < 0.6 ? 'glass' : 'office', x0, z0, m - 1, z1, h1, rnd, { shops: true, tiers: rnd() < 0.5 ? 1 : 0 });
      const b = addBuilding(ctx, rnd() < 0.5 ? 'glass' : 'office', m + 1, z0, x1, z1, h2, rnd, { shops: true, tiers: rnd() < 0.4 ? 2 : 0 });
      maybeBillboard(ctx, a, rnd); maybeNeon(ctx, b, rnd);
    } else {
      // podium with a tower on top
      addBuilding(ctx, 'office', x0, z0, x1, z1, 10, rnd, { shops: true });
      const t = addBuilding(ctx, 'glass', x0 + 8, z0 + 8, x1 - 8, z1 - 8, 60 + rnd() * 80, rnd, { tiers: rnd() < 0.5 ? 2 : 1 });
      maybeBillboard(ctx, t, rnd);
    }
    return;
  }
  if (district === 'coral') {
    // hotels face the beach (south side), set back a little from the street
    const count = 3;
    for (let k = 0; k < count; k++) {
      const bx0 = x0 + (W / count) * k + 1, bx1 = x0 + (W / count) * (k + 1) - 1;
      const h = 10 + Math.floor(rnd() * 4) * FLOOR;
      const bz0 = z0 + 10 + rnd() * 6;
      const tint = pastel(rnd, 'deco');
      const bld = addBuilding(ctx, 'deco', bx0, bz0, bx1, z1 - 3, h, rnd, { tint, roofColor: '#e8e0d0' });
      // deco fins and a name sign
      const fin = (bx0 + bx1) / 2;
      ctx.trims.box(fin - 0.6, CURB, z1 - 3.5, fin + 0.6, h + 4, z1 - 2.2, '#ffffff');
      ctx.trims.box(bx0, CURB + 3.4, z1 - 3.4, bx1, CURB + 3.7, z1 - 1.2, '#ffffff');
      const name = SIGN_SETS.hotels[(i * 3 + k) % SIGN_SETS.hotels.length];
      addSignOnFace(ctx, bld, 2, h - 2, Math.min(12, bx1 - bx0 - 2), 3, cachedSign(name, rnd, true), true);
      ctx.palms.push({ x: bx0 + 2, z: z1 + 2, s: 0.9 + rnd() * 0.3 });
    }
    // back half: low shops
    addBuilding(ctx, 'resid', x0 + 2, z0, x1 - 2, z0 + 8, 8, rnd, { shops: true });
    return;
  }
  if (district === 'heights') {
    const spots = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
    for (const [fx, fz] of spots) {
      if (rnd() < 0.2) continue;
      const vx = x0 + W * fx, vz = z0 + D * fz;
      const w = 12 + rnd() * 6, d = 10 + rnd() * 5;
      addBuilding(ctx, 'villa', vx - w / 2, vz - d / 2, vx + w / 2, vz + d / 2, 6.5, rnd, { roofColor: '#c9b8a0' });
      if (rnd() < 0.7) addBuilding(ctx, 'villa', vx - w / 2 + 2, vz - d / 2 + 2, vx + w / 4, vz + d / 2 - 2, 10, rnd, { roofColor: '#c9b8a0' });
      // pool
      ctx.extras.push({ type: 'pool', x: vx + (fx < 0.5 ? -1 : 1) * 0, z: vz + d / 2 + 4, w: 8, d: 4 });
      ctx.palms.push({ x: vx + w / 2 + 2, z: vz - d / 2 - 2, s: 1 + rnd() * 0.3 });
      ctx.palms.push({ x: vx - w / 2 - 2, z: vz + d / 2 + 2, s: 0.8 + rnd() * 0.3 });
    }
    return;
  }
  if (district === 'docks') {
    const split = rnd() < 0.6;
    if (split) {
      addBuilding(ctx, 'warehouse', x0 + 2, z0 + 2, x1 - 2, cz - 4, 10 + rnd() * 6, rnd, { roofColor: '#7d8a93', parapet: false });
      containerYard(ctx, x0 + 4, cz + 2, x1 - 4, z1 - 4, rnd);
    } else {
      addBuilding(ctx, 'warehouse', x0 + 3, z0 + 3, x1 - 3, z1 - 3, 12 + rnd() * 5, rnd, { roofColor: '#7d8a93', parapet: false });
    }
    return;
  }
  // Mercado: three to four colourful walk-ups with shops
  const cols = rnd() < 0.5 ? 2 : 3;
  for (let a = 0; a < cols; a++) {
    for (let b = 0; b < 2; b++) {
      const bx0 = x0 + (W / cols) * a + 0.5, bx1 = x0 + (W / cols) * (a + 1) - 0.5;
      const bz0 = z0 + (D / 2) * b + 0.5, bz1 = z0 + (D / 2) * (b + 1) - 0.5;
      const h = 9 + Math.floor(rnd() * 5) * FLOOR;
      const bld = addBuilding(ctx, rnd() < 0.75 ? 'resid' : 'office', bx0, bz0, bx1, bz1, h, rnd, { shops: true });
      if (rnd() < 0.3) maybeNeon(ctx, bld, rnd);
    }
  }
  if (rnd() < 0.3) ctx.extras.push({ type: 'water-tank', x: cx, z: cz });
}

function maybeBillboard(ctx, b, rnd) {
  if (rnd() < 0.35) return;
  const ad = SIGN_SETS.ads[Math.floor(rnd() * SIGN_SETS.ads.length)];
  const side = Math.floor(rnd() * 4);
  addSignOnFace(ctx, b, side, Math.min(b.top - 6, 18 + rnd() * 20), 14, 7, cachedSign(ad, rnd, false), false);
}

function maybeNeon(ctx, b, rnd) {
  const text = SIGN_SETS.neon[Math.floor(rnd() * SIGN_SETS.neon.length)];
  const side = Math.floor(rnd() * 4);
  addSignOnFace(ctx, b, side, 7.5, 8, 2, cachedSign(text, rnd, true), true, 0.3 + rnd() * 0.4);
}

const CONTAINER_COLORS = ['#c0392b', '#2471a3', '#d68910', '#1e8449', '#7d3c98', '#e67e22', '#17a589', '#b03a2e'];
function containerYard(ctx, x0, z0, x1, z1, rnd) {
  const cw = 2.5, cl = 12, ch = 2.6;
  for (let x = x0; x + cl <= x1; x += cl + 1.5) {
    for (let z = z0; z + cw <= z1; z += cw + 0.4) {
      if (rnd() < 0.25) continue;
      const stack = 1 + Math.floor(rnd() * 3);
      for (let s = 0; s < stack; s++) {
        const col = CONTAINER_COLORS[Math.floor(rnd() * CONTAINER_COLORS.length)];
        ctx.trims.box(x, CURB + s * ch, z, x + cl, CURB + (s + 1) * ch - 0.05, z + cw, col);
      }
      addCollider(x, z, x + cl, z + cw, CURB + stack * ch, 0, 'container');
    }
  }
}

function buildSpecial(ctx, kind, lot, rnd, i, j) {
  const { x0, z0, x1, z1 } = lot;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const sign = (text, b, side, y, w, h, opts) => addSignOnFace(ctx, b, side, y, w, h, makeSign(text, opts), true);
  switch (kind) {
    case 'park': {
      // fountain, paths and palms; the lawn itself comes from the roads module
      ctx.extras.push({ type: 'fountain', x: cx, z: cz });
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        ctx.palms.push({ x: cx + Math.cos(a) * (18 + (k % 2) * 8), z: cz + Math.sin(a) * (18 + (k % 2) * 8), s: 0.9 + rnd() * 0.4 });
      }
      ctx.trims.box(cx - 1.5, CURB, z0, cx + 1.5, CURB + 0.05, z1, '#d9cbb0');
      ctx.trims.box(x0, CURB, cz - 1.5, x1, CURB + 0.05, cz + 1.5, '#d9cbb0');
      break;
    }
    case 'kraneTower': {
      addBuilding(ctx, 'office', x0, z0, x1, z1, 12, rnd, { shops: true, tint: '#fff2e0' });
      const t = addBuilding(ctx, 'glass', x0 + 9, z0 + 9, x1 - 9, z1 - 9, 150, rnd, { tint: '#ffd8b0', tiers: 3 });
      ctx.roofs.box(cx - 1, t.top, cz - 1, cx + 1, t.top + 26, cz + 1, '#e8e8e8');
      sign('KRANE', { x0: x0 + 9, z0: z0 + 9, x1: x1 - 9, z1: z1 - 9 }, 2, 120, 26, 7, { w: 512, h: 128, bg: null, fg: '#ffb347', glow: true });
      sign('KRANE TOWER', { x0, z0, x1, z1 }, 2, 9, 22, 3, { w: 512, h: 96, bg: '#1b1b1b', fg: '#ffb347', glow: true });
      break;
    }
    case 'baitShop': {
      addBuilding(ctx, 'warehouse', x0 + 20, z0 + 4, x1 - 4, z0 + 30, 11, rnd, { roofColor: '#7d8a93', parapet: false });
      const shack = addBuilding(ctx, 'villa', x0 + 2, cz - 6, x0 + 16, cz + 8, 4.5, rnd, { tint: '#9fd8e8', roofColor: '#6d4c3a', parapet: false });
      sign(["TEO'S", 'BAIT & TACKLE'], shack, 3, 3.4, 9, 3.2, { w: 512, h: 192, bg: '#f4e4c4', fg: '#1d6f8b', glow: false, border: '#1d6f8b' });
      containerYard(ctx, x0 + 20, z0 + 36, x1 - 4, z1 - 4, rnd);
      break;
    }
    case 'garage': {
      const g = addBuilding(ctx, 'warehouse', x0 + 22, z0 + 8, x1 - 2, z1 - 8, 8, rnd, { tint: '#ffd0e8', roofColor: '#555', parapet: true });
      sign(['PARK AUTO', '& CUSTOM'], g, 1, 6.4, 14, 3.2, { w: 512, h: 160, bg: '#221830', fg: '#ff5fa2', glow: true });
      ctx.trims.box(x1 - 2.05, CURB, cz - 5, x1 - 1.9, CURB + 5, cz + 5, '#3a3a40');
      addBuilding(ctx, 'resid', x0, z0, x0 + 20, z1, 14, rnd, { shops: true });
      break;
    }
    case 'bank': {
      const b = addBuilding(ctx, 'office', x0 + 6, z0 + 6, x1 - 2, z1 - 6, 28, rnd, { tint: '#f6eedc', roofColor: '#9a9284' });
      for (let k = 0; k < 6; k++) {
        const z = z0 + 10 + k * ((z1 - z0 - 20) / 5);
        ctx.trims.box(x1 + 0.2, CURB, z - 0.7, x1 + 1.6, CURB + 12, z + 0.7, '#fffaf0');
      }
      ctx.trims.box(x1 - 2, CURB + 12, z0 + 6, x1 + 2.2, CURB + 14, z1 - 6, '#fffaf0');
      sign('CORAL SAVINGS & TRUST', { x0: x1, z0: z0 + 6, x1: x1 + 2.2, z1: z1 - 6 }, 1, CURB + 13, 22, 1.6, { w: 1024, h: 96, bg: '#fffaf0', fg: '#14506b', glow: false });
      addBuilding(ctx, 'glass', x0, z0, x0 + 24, z1, 50, rnd, { shops: false });
      void b;
      break;
    }
    case 'hospital': {
      const h = addBuilding(ctx, 'office', x0 + 4, z0 + 8, x1 - 4, z1 - 4, 30, rnd, { tint: '#ffffff', roofColor: '#c8c8c8', tiers: 1 });
      sign(['SUNVALE GENERAL', 'HOSPITAL'], h, 0, 24, 20, 5, { w: 512, h: 128, bg: '#ffffff', fg: '#d62839', glow: false });
      ctx.roofs.box(cx - 6, h.top, cz - 6, cx + 6, h.top + 0.15, cz + 6, '#d62839');
      break;
    }
    case 'police': {
      const p = addBuilding(ctx, 'office', x0 + 4, z0 + 8, x1 - 4, z1 - 4, 22, rnd, { tint: '#dfe8ff', roofColor: '#9aa0aa' });
      sign(['SVPD', 'CENTRAL PRECINCT'], p, 0, 17, 16, 4.5, { w: 512, h: 144, bg: '#0f2a5a', fg: '#ffffff', glow: false });
      ctx.trims.box(x0 + 4, CURB, z0 + 7.5, x1 - 4, CURB + 4, z0 + 8, '#1d3f8a');
      break;
    }
    case 'gunShop': {
      const s = addBuilding(ctx, 'office', x0 + 2, z0 + 2, cx - 2, z1 - 2, 9, rnd, { shops: false, tint: '#c8c0b8' });
      sign('LOCKBOX ARMS', s, 0, 6, 14, 2.6, { w: 512, h: 96, bg: '#151515', fg: '#ff3b3b', glow: true });
      addBuilding(ctx, 'resid', cx + 2, z0, x1, z1, 16, rnd, { shops: true });
      break;
    }
    case 'paintShop': {
      const s = addBuilding(ctx, 'warehouse', x0 + 4, z0 + 4, cx, z1 - 4, 9, rnd, { tint: '#b8ffe8', roofColor: '#555' });
      sign('FRESH COAT', s, 0, 6.5, 14, 2.6, { w: 512, h: 96, bg: '#0b3d3a', fg: '#5dffcf', glow: true });
      addBuilding(ctx, 'resid', cx + 3, z0, x1, z1, 13, rnd, { shops: true });
      break;
    }
    case 'warehouseYard': {
      addBuilding(ctx, 'warehouse', x0 + 2, z0 + 2, x1 - 2, z0 + 26, 13, rnd, { roofColor: '#7d8a93', parapet: false });
      containerYard(ctx, x0 + 3, z0 + 30, x1 - 3, z1 - 3, rnd);
      break;
    }
    default:
      buildDistrictBlock(ctx, 'mercado', lot, rnd, i, j);
  }
  void PITCH; void hash2;
}
