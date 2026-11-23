// A geometry accumulator: boxes, quads and transformed primitive geometries are appended into one
// BufferGeometry with vertex colours, so a whole district of buildings is a single draw call.
import * as THREE from 'three';

const tmpColor = new THREE.Color();
const tmpV = new THREE.Vector3();
const tmpN = new THREE.Vector3();
const normalMatrix = new THREE.Matrix3();

export class MeshBuilder {
  constructor() {
    this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = [];
  }

  get vertexCount() { return this.pos.length / 3; }

  /** Four corners counter-clockwise seen from the front; uvs as [u0,v0,u1,v1]. */
  quad(a, b, c, d, n, uv, color) {
    const base = this.vertexCount;
    const col = tmpColor.set(color);
    for (const p of [a, b, c, d]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.col.push(col.r, col.g, col.b); }
    const [u0, v0, u1, v1] = uv;
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /**
   * An axis-aligned box from (x0,y0,z0) to (x1,y1,z1). `tile` = [metres per u, metres per v] maps the
   * sides like a facade (u along the wall, v up); `off` shifts the uvs; `skip` names faces to leave out.
   */
  box(x0, y0, z0, x1, y1, z1, color, { tile = [1, 1], off = [0, 0], skip = '', topColor = null } = {}) {
    const [tu, tv] = tile, [ou, ov] = off;
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const vTop = ov + h / tv;
    if (!skip.includes('s')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [ou, ov, ou + w / tu, vTop], color);
    if (!skip.includes('n')) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [ou + 0.37, ov, ou + 0.37 + w / tu, vTop], color);
    if (!skip.includes('e')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [ou + 0.61, ov, ou + 0.61 + d / tu, vTop], color);
    if (!skip.includes('w')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [ou + 0.13, ov, ou + 0.13 + d / tu, vTop], color);
    if (!skip.includes('t')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [0, 0, w / tu, d / tu], topColor ?? color);
    if (!skip.includes('b')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [0, 0, 1, 1], color);
  }

  /** A flat rectangle on the ground at height y, uvs tiled every `tile` metres. */
  ground(x0, z0, x1, z1, y, color, tile = 4) {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], [x0 / tile, -z1 / tile, x1 / tile, -z0 / tile], color);
  }

  /** Append any BufferGeometry, transformed by `matrix`, in one colour. */
  add(geometry, matrix, color) {
    const g = geometry.index ? geometry : geometry;
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    const base = this.vertexCount;
    normalMatrix.getNormalMatrix(matrix);
    const col = tmpColor.set(color);
    for (let i = 0; i < p.count; i++) {
      tmpV.fromBufferAttribute(p, i).applyMatrix4(matrix);
      this.pos.push(tmpV.x, tmpV.y, tmpV.z);
      if (n) { tmpN.fromBufferAttribute(n, i).applyMatrix3(normalMatrix).normalize(); this.nor.push(tmpN.x, tmpN.y, tmpN.z); } else this.nor.push(0, 1, 0);
      if (uv) this.uv.push(uv.getX(i), uv.getY(i)); else this.uv.push(0, 0);
      this.col.push(col.r, col.g, col.b);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    const count = this.vertexCount;
    geo.setIndex(count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }
}
