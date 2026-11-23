// Glowing world markers: translucent light columns with a ground ring and a floating icon, used for
// mission starts, objectives, shops and race checkpoints.
import * as THREE from 'three';
import { groundHeight } from '../city/roads.js';

function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.7, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0.9)');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function iconTexture(label, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color; g.strokeStyle = '#111'; g.lineWidth = 8;
  g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#111'; g.font = 'bold 64px "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createMarkers(scene) {
  const beamTex = beamTexture();
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0);
  const ringGeo = new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);
  const items = new Set();
  return {
    /** opts: { color, radius, height, label, checkpoint } */
    add(x, z, { color = '#ffd23f', radius = 2, height = 6, label = null, checkpoint = false } = {}) {
      const g = new THREE.Group();
      const y = groundHeight(x, z);
      g.position.set(x, y + 0.04, z);
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ map: beamTex, color, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
      beam.scale.set(radius, height, radius);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
      ring.scale.setScalar(radius);
      g.add(beam, ring);
      let icon = null;
      if (label) {
        icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(label, color), depthTest: false, fog: false }));
        icon.scale.setScalar(1.6);
        icon.position.y = height + 1.2;
        icon.renderOrder = 10;
        g.add(icon);
      }
      if (checkpoint) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.1, 0.35, 8, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, fog: false }));
        hoop.position.y = radius * 1.2;
        g.add(hoop);
      }
      scene.add(g);
      const m = { x, z, radius, group: g, icon, base: g.position.y, remove() { scene.remove(g); items.delete(m); }, set visible(v) { g.visible = v; } };
      items.add(m);
      return m;
    },
    update(dt, time) {
      for (const m of items) {
        if (m.icon) m.icon.position.y = m.group.children[0].scale.y + 1.2 + Math.sin(time * 2.5) * 0.25;
        m.group.children[1].scale.setScalar(m.radius * (1 + Math.sin(time * 4) * 0.05));
      }
    },
    clear() { for (const m of [...items]) m.remove(); },
  };
}
