// One person in the world, player or not: position, movement with collision, health and armour,
// weapons, getting knocked down or killed, and keeping the animated mesh in sync.
import { buildHumanMesh, poseHuman, randomLook } from './humanmesh.js';
import { resolveCircle } from '../city/collision.js';
import { groundHeight } from '../city/roads.js';
import { clampToBounds } from '../city/layout.js';
import { dampAngle } from '../core/mathutil.js';

let nextId = 1;
export const RADIUS = 0.35;

export class Human {
  constructor(world, { role = 'civ', look = null, seed = 1, x = 0, z = 0, heading = 0 } = {}) {
    this.id = nextId++;
    this.world = world;
    this.role = role;
    this.look = look ?? randomLook(seed, role);
    this.rig = buildHumanMesh(this.look);
    this.mesh = this.rig.root;
    world.scene.add(this.mesh);
    this.x = x; this.z = z; this.y = groundHeight(x, z);
    this.jump = 0; this.vy = 0;
    this.heading = heading;
    this.vx = 0; this.vz = 0;       // external push (knockback), decays
    this.speed = 0;                 // current walking speed for animation
    this.phase = Math.random() * 6;
    this.maxHealth = role === 'player' ? 100 : role === 'boss' ? 160 : role === 'civ' ? 60 : 90;
    this.health = this.maxHealth;
    this.armour = role === 'police' || role === 'security' ? 30 : 0;
    this.alive = true;
    this.state = 'walk';            // walk | down | dead | drive
    this.stateTime = 0;
    this.vehicle = null;
    this.weapon = null;
    this.aiming = false;
    this.punchT = 0;
    this.hostile = false;
    this.brain = {};
    this.lastAttacker = null;
    this.persistent = false;        // missions keep their people from being recycled
  }

  get dead() { return !this.alive; }

  /** Walk in direction (dx,dz) (any length; normalised) at `speed` m/s, with collision. */
  move(dx, dz, speed, dt, face = true) {
    if (this.state !== 'walk') return;
    const len = Math.hypot(dx, dz);
    let mx = 0, mz = 0;
    if (len > 1e-4 && speed > 0) { mx = dx / len * speed; mz = dz / len * speed; }
    this.speed = Math.hypot(mx, mz);
    this.x += (mx + this.vx) * dt;
    this.z += (mz + this.vz) * dt;
    this.collide();
    if (face && this.speed > 0.2 && !this.aiming) this.heading = dampAngle(this.heading, Math.atan2(mx, mz), 10, dt);
  }

  collide() {
    const r = resolveCircle(this.x, this.z, RADIUS, this.y + this.jump);
    let x = r.x, z = r.z;
    const c = clampToBounds(x, z);
    this.x = c.x; this.z = c.z;
  }

  faceToward(x, z, dt, rate = 12) {
    this.heading = dampAngle(this.heading, Math.atan2(x - this.x, z - this.z), rate, dt);
  }

  /** Apply damage; returns true when this blow killed. */
  takeDamage(amount, info = {}) {
    if (!this.alive) return false;
    if (info.kind !== 'car' && info.kind !== 'explosion' && this.armour > 0) {
      const absorbed = Math.min(this.armour, amount * 0.7);
      this.armour -= absorbed;
      amount -= absorbed;
    }
    this.health -= amount;
    if (info.source) this.lastAttacker = info.source;
    if (info.dirX !== undefined && info.force) {
      this.vx += info.dirX * info.force;
      this.vz += info.dirZ * info.force;
    }
    this.world.events.emit('hurt', this, info);
    if (this.health <= 0) {
      this.health = 0;
      this.die(info);
      return true;
    }
    if (info.knockdown && this.state === 'walk') { this.state = 'down'; this.stateTime = 0; }
    return false;
  }

  die(info = {}) {
    if (!this.alive) return;
    this.alive = false;
    this.state = 'dead';
    this.stateTime = 0;
    this.aiming = false;
    this.world.events.emit('death', this, info);
  }

  update(dt) {
    this.stateTime += dt;
    // knockback and gravity
    const decay = Math.exp(-(this.state === 'walk' ? 8 : 3) * dt);
    if (this.state !== 'walk' && this.state !== 'drive') {
      this.x += this.vx * dt; this.z += this.vz * dt;
      this.collide();
    }
    this.vx *= decay; this.vz *= decay;
    if (this.jump > 0 || this.vy > 0) {
      this.vy -= 22 * dt;
      this.jump = Math.max(0, this.jump + this.vy * dt);
      if (this.jump === 0) this.vy = 0;
    }
    if (this.state === 'down' && this.stateTime > 2.2 && this.alive) { this.state = 'walk'; this.stateTime = 0; }
    if (this.punchT > 0) this.punchT = Math.max(0, this.punchT - dt * 3.2);
    this.y = groundHeight(this.x, this.z);
    if (this.state === 'drive') return;
    this.phase += dt * (2.2 + this.speed * 1.55);
    this.mesh.position.set(this.x, this.y + this.jump, this.z);
    this.mesh.rotation.y = this.heading;
    poseHuman(this.rig, {
      phase: this.phase, speed: this.state === 'walk' ? this.speed : 0, aiming: this.aiming, punch: this.punchT,
      state: this.state, weapon: this.weapon, fall: this.stateTime * 3,
    });
    if (this.state !== 'walk') this.speed = 0;
  }

  setVisible(v) { this.mesh.visible = v; }

  /** Muzzle position, roughly at the right hand when aiming. */
  muzzle() {
    const s = Math.sin(this.heading), c = Math.cos(this.heading);
    // forward (s, c) plus a little to the right (-c, s), where the gun hand is
    return { x: this.x + s * 0.75 - c * 0.22, y: this.y + this.jump + 1.45, z: this.z + c * 0.75 + s * 0.22 };
  }

  dispose() {
    this.world.scene.remove(this.mesh);
    this.removed = true;
  }
}
