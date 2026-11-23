// One vehicle: arcade driving physics (throttle, brakes, steering that tightens at low speed,
// lateral grip with handbrake drifts), wall and car-to-car collisions, running people over,
// damage that leads to smoke, fire and an explosion, and the siren lights on police cars.
import { VEHICLES } from './specs.js';
import { buildCarMesh, CAR_MATERIALS } from './carmesh.js';
import { resolveCircle } from '../city/collision.js';
import { clampToBounds } from '../city/layout.js';
import { groundHeight } from '../city/roads.js';
import { clamp, damp, wrapAngle } from '../core/mathutil.js';

let nextId = 1;

export class Vehicle {
  constructor(world, type, { x = 0, z = 0, heading = 0, color = null } = {}) {
    this.id = nextId++;
    this.world = world;
    this.type = type;
    this.spec = VEHICLES[type];
    this.color = color ?? this.spec.paints[0];
    const m = buildCarMesh(this.spec, this.color);
    Object.assign(this, { mesh: m.root, bodyGroup: m.body, bodyMesh: m.bodyMesh, wheels: m.wheels, extras: m.extras });
    world.scene.add(this.mesh);
    this.x = x; this.z = z; this.heading = heading;
    this.vx = 0; this.vz = 0; this.yawRate = 0;
    this.steer = 0;
    this.throttle = 0; this.steerInput = 0; this.handbrake = false;
    this.health = this.spec.health;
    this.driver = null;      // Human at the wheel (player or AI)
    this.passengers = [];
    this.ai = null;          // traffic / police / mission brain
    this.wrecked = false;
    this.onFire = 0;
    this.siren = false;
    this.horn = false;
    this.locked = false;
    this.persistent = false;
    this.wheelSpin = 0;
    this.roll = 0; this.pitch = 0;
    this.lastHitBy = null;
    this.smokeTimer = 0;
    this.y = 0;
  }

  get hw() { return this.spec.w / 2; }
  get hl() { return this.spec.l / 2; }
  get forwardX() { return Math.sin(this.heading); }
  get forwardZ() { return Math.cos(this.heading); }
  /** Signed speed along the car's nose (m/s). */
  get forwardSpeed() { return this.vx * this.forwardX + this.vz * this.forwardZ; }
  get speed() { return Math.hypot(this.vx, this.vz); }

  /** The three circles along the car's length that stand in for its hull. */
  circles() {
    const r = this.hw * 0.98, o = this.hl - r;
    const fx = this.forwardX, fz = this.forwardZ;
    return [
      { x: this.x + fx * o, z: this.z + fz * o, r },
      { x: this.x, z: this.z, r },
      { x: this.x - fx * o, z: this.z - fz * o, r },
    ];
  }

  physics(dt) {
    const spec = this.spec;
    const fx = this.forwardX, fz = this.forwardZ;
    const rx = -fz, rz = fx;
    let vF = this.vx * fx + this.vz * fz;
    let vR = this.vx * rx + this.vz * rz;
    const dead = this.wrecked || this.health <= 0;
    const throttle = dead ? 0 : this.throttle;
    // engine and brakes
    if (throttle > 0) {
      if (vF < -0.5) vF += 22 * throttle * dt;
      else vF += spec.accel * throttle * Math.max(0, 1 - vF / spec.maxSpeed) * dt;
    } else if (throttle < 0) {
      if (vF > 0.5) vF += 24 * throttle * dt;
      else vF += spec.accel * 0.6 * throttle * Math.max(0, 1 + vF / 14) * dt;
    } else {
      vF -= Math.sign(vF) * Math.min(Math.abs(vF), (1.2 + Math.abs(vF) * 0.06) * dt);
    }
    if (this.handbrake) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 9 * dt);
    // steering: lock shrinks with speed so high-speed driving stays stable
    const lock = spec.steer / (1 + Math.abs(vF) / 22);
    this.steer = damp(this.steer, this.steerInput * lock, 9, dt);
    const wheelbase = spec.l * 0.62;
    const targetYaw = (vF / wheelbase) * Math.tan(this.steer);
    this.yawRate = damp(this.yawRate, targetYaw, this.handbrake ? 5 : 12, dt);
    this.heading -= this.yawRate * dt;
    // lateral grip: tyres scrub sideways velocity; handbrake lets the tail go
    const grip = this.handbrake ? 1.6 : spec.grip * (dead ? 0.6 : 1);
    vR *= Math.exp(-grip * dt);
    const nfx = Math.sin(this.heading), nfz = Math.cos(this.heading);
    const nrx = -nfz, nrz = nfx;
    this.vx = nfx * vF + nrx * vR;
    this.vz = nfz * vF + nrz * vR;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.slip = Math.abs(vR);
    this.collideStatic();
    // body roll/pitch for feel
    this.roll = damp(this.roll, clamp(-this.yawRate * vF * 0.012, -0.09, 0.09), 6, dt);
    this.pitch = damp(this.pitch, clamp(throttle * 0.02 - (this.handbrake ? 0.02 : 0), -0.04, 0.04), 5, dt);
    this.wheelSpin += vF * dt / 0.36;
  }

  collideStatic() {
    const cs = this.circles();
    let hit = null;
    for (const c of cs) {
      const r = resolveCircle(c.x, c.z, c.r, 0.5);
      if (r.hit) {
        this.x += r.x - c.x; this.z += r.z - c.z;
        hit = r;
      }
    }
    const b = clampToBounds(this.x, this.z);
    if (b.x !== this.x || b.z !== this.z) {
      hit = { nx: Math.sign(b.x - this.x), nz: Math.sign(b.z - this.z) };
      this.x = b.x; this.z = b.z;
    }
    if (hit) {
      const vn = this.vx * hit.nx + this.vz * hit.nz;
      if (vn < 0) {
        this.vx -= hit.nx * vn * 1.35;
        this.vz -= hit.nz * vn * 1.35;
        const impact = -vn;
        if (impact > 3) {
          this.damage(impact * impact * 0.9, null, 'crash');
          this.world.events.emit('crash', this, impact);
        }
        // glancing blows twist the car a little
        this.heading += wrapAngle(Math.atan2(hit.nx, hit.nz) - this.heading) * 0.0;
      }
    }
  }

  damage(amount, source = null, kind = 'hit') {
    if (this.wrecked) return;
    this.health -= amount;
    if (source) this.lastHitBy = source;
    this.world.events.emit('vehicleDamaged', this, amount, source, kind);
    if (this.health <= 0) {
      this.health = 0;
      if (this.onFire <= 0) this.onFire = 0.01;
    }
  }

  /** Called every frame by the vehicle system. */
  update(dt) {
    if (this.health <= 0 && !this.wrecked) {
      this.onFire += dt;
      if (this.onFire > 4.5) this.explode();
    }
    this.physics(dt);
    // keep the mesh in sync
    const gy = groundHeight(this.x, this.z) > 0.5 ? groundHeight(this.x, this.z) : 0;
    this.y = damp(this.y, gy, 10, dt);
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
    this.bodyGroup.rotation.z = this.roll;
    this.bodyGroup.rotation.x = this.pitch;
    for (const w of this.wheels) {
      w.spin.rotation.x = this.wheelSpin;
      if (w.front) w.pivot.rotation.y = -this.steer;
    }
    if (this.spec.police && this.extras.red) {
      const on = this.siren && !this.wrecked;
      const ph = Math.floor(this.world.time * 6 + this.id) % 2;
      this.extras.red.material = on && ph ? CAR_MATERIALS.red : CAR_MATERIALS.off;
      this.extras.blue.material = on && !ph ? CAR_MATERIALS.blue : CAR_MATERIALS.off;
      this.extras.haloR.visible = on && !!ph;
      this.extras.haloB.visible = on && !ph;
    }
  }

  explode() {
    if (this.wrecked) return;
    this.wrecked = true;
    this.health = 0;
    this.siren = false;
    this.bodyMesh.material = CAR_MATERIALS.burnt;
    this.vx *= 0.3; this.vz *= 0.3;
    this.world.events.emit('explosion', { x: this.x, y: 1, z: this.z, radius: 9, source: this.lastHitBy, vehicle: this });
  }

  /** Seat position for entering/exiting: the driver's door on the left side. */
  doorPoint() {
    const fx = this.forwardX, fz = this.forwardZ;
    // left of heading (fx,fz) is (fz,-fx)
    return { x: this.x + fz * (this.hw + 0.7) + fx * 0.3, z: this.z - fx * (this.hw + 0.7) + fz * 0.3 };
  }

  dispose() {
    this.world.scene.remove(this.mesh);
    this.removed = true;
  }
}
