// The third-person camera: mouse orbit on foot, a tighter over-the-shoulder view when aiming, a
// chase camera in cars that swings back behind the car when the mouse is idle and pulls out with
// speed, look-behind, collision with buildings, and shake for explosions and impacts.
import * as THREE from 'three';
import { rayDistance } from '../city/collision.js';
import { clamp, damp, dampAngle } from '../core/mathutil.js';

export function createFollowCamera(camera) {
  const cam = {
    yaw: 0, pitch: 0.18, dist: 4.6, fov: 62,
    idle: 0, shake: 0, lookBehind: false,
    pos: new THREE.Vector3(), target: new THREE.Vector3(),
    dir: new THREE.Vector3(0, 0, 1),
    addShake(a) { cam.shake = Math.min(1.2, cam.shake + a); },
    /** Mouse look input in pixels. */
    look(dx, dy) {
      cam.yaw -= dx * 0.0032;
      cam.pitch = clamp(cam.pitch + dy * 0.0026, -0.55, 1.2);
      if (dx !== 0 || dy !== 0) cam.idle = 0;
    },
    update(dt, player) {
      cam.idle += dt;
      const v = player.vehicle;
      let tx, ty, tz, dist, height, fov, side = 0;
      if (v) {
        const speed = v.speed;
        if (cam.idle > 1.2) {
          const want = cam.lookBehind ? v.heading + Math.PI : (speed > 2 && v.forwardSpeed < -1 ? v.heading : v.heading);
          cam.yaw = dampAngle(cam.yaw, want, cam.lookBehind ? 20 : 2.6, dt);
          cam.pitch = damp(cam.pitch, 0.22, 2, dt);
        }
        tx = v.x; ty = v.y + v.spec.h + 0.4; tz = v.z;
        dist = v.spec.l * 1.25 + 3 + Math.min(speed, 40) * 0.06;
        height = 0.5;
        fov = 64 + Math.min(speed, 50) * 0.22;
      } else {
        const aim = player.human.aiming;
        tx = player.human.x; ty = player.human.y + player.human.jump + 1.55; tz = player.human.z;
        dist = aim ? 2.3 : 4.4;
        side = aim ? 0.75 : 0.25;
        height = 0;
        fov = aim ? 50 : 62;
      }
      cam.dist = damp(cam.dist, dist, 6, dt);
      cam.fov = damp(cam.fov, fov, 6, dt);
      const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
      // right of look direction (fx,fz) is (-fz, fx)
      cam.target.set(tx + -fz * side, ty, tz + fx * side);
      const bx = -fx * cp, by = sp + height / cam.dist, bz = -fz * cp;
      const bl = Math.hypot(bx, by, bz);
      let d = cam.dist;
      const hit = rayDistance(cam.target.x, cam.target.y, cam.target.z, bx / bl, by / bl, bz / bl, d + 0.4);
      if (hit < d + 0.4) d = Math.max(0.8, hit - 0.4);
      cam.pos.set(cam.target.x + bx / bl * d, Math.max(0.4, cam.target.y + by / bl * d), cam.target.z + bz / bl * d);
      if (cam.shake > 0) {
        cam.pos.x += (Math.random() - 0.5) * cam.shake * 0.5;
        cam.pos.y += (Math.random() - 0.5) * cam.shake * 0.5;
        cam.shake = Math.max(0, cam.shake - dt * 2.2);
      }
      camera.position.copy(cam.pos);
      camera.lookAt(cam.target);
      if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
      camera.getWorldDirection(cam.dir);
    },
  };
  return cam;
}
