import * as THREE from 'three';
import { G, RAPIER } from './core/physics';
import type { Level } from './core/level';
import { MAT, shadowed } from './world/materials';
import { springBounce } from './parts';

export const PLAYER_MASS = 60; // kg
export const RUN_SPEED = 3.4; // m/s
export const JUMP_SPEED = 4.9; // m/s → about 1.2 m high
const PUSH_FORCE = 520; // N, the most the explorer can push with
const HALF_H = 0.5;
const RADIUS = 0.32;
const FOOT = HALF_H + RADIUS; // centre → feet

const skin = new THREE.MeshStandardMaterial({ color: 0xf1c29b, roughness: 0.7 });
const hair = new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.8, flatShading: true });
const hoodie = new THREE.MeshStandardMaterial({ color: 0x27375f, roughness: 0.75 });
const shirt = new THREE.MeshStandardMaterial({ color: 0xe8e0cf, roughness: 0.8 });
const jeans = new THREE.MeshStandardMaterial({ color: 0x2d3247, roughness: 0.8 });
const boot = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.7 });
const glove = new THREE.MeshStandardMaterial({ color: 0x22252c, roughness: 0.6 });
const leather = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.6 });

/** The explorer: brown spiky hair, navy hoodie over a cream shirt, glowing backpack core. Faces +z. */
export function makeExplorerModel() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const limb = (r1: number, r2: number, len: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry((r1 + r2) / 2, len, 4, 10), mat);
    m.position.y = -len / 2;
    return m;
  };

  // Legs, pivoting at the hips
  const legs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.12, 0.86, 0);
    const thigh = limb(0.09, 0.08, 0.36, jeans);
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    const shin = limb(0.08, 0.07, 0.3, jeans);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.28), boot);
    shoe.position.set(0, -0.4, 0.05);
    knee.add(shin, shoe);
    hip.add(thigh, knee);
    body.add(hip);
    legs.push(hip);
  }

  // Torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.32, 6, 14), hoodie);
  torso.position.y = 1.16;
  torso.scale.set(1.05, 1, 0.78);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.05), shirt);
  chest.position.set(0, 1.2, 0.15);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.07, 16), leather);
  belt.position.y = 0.9;
  belt.scale.z = 0.8;
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.03), MAT.brass);
  buckle.position.set(0, 0.9, 0.17);
  const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.08), leather);
  pouch.position.set(0.2, 0.85, 0.05);
  body.add(torso, chest, belt, buckle, pouch);

  // Backpack with the glowing core
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.16), hoodie);
  pack.position.set(0, 1.2, -0.21);
  const coreMat = MAT.glow.clone();
  const core = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 24), coreMat);
  core.position.set(0, 1.22, -0.3);
  const coreDot = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), coreMat);
  coreDot.position.set(0, 1.22, -0.301);
  coreDot.rotation.y = Math.PI;
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), MAT.brass);
  badge.position.set(-0.21, 1.3, 0.05);
  badge.rotation.y = -0.5;
  body.add(pack, core, coreDot, badge);

  // Arms, pivoting at the shoulders
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(side * 0.27, 1.36, 0);
    const upper = limb(0.07, 0.065, 0.24, shirt);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 10), hoodie);
    cuff.position.y = -0.1;
    const fore = limb(0.06, 0.055, 0.22, shirt);
    fore.position.y = -0.44;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), glove);
    hand.position.y = -0.6;
    sh.add(upper, cuff, fore, hand);
    sh.rotation.z = side * 0.12;
    body.add(sh);
    arms.push(sh);
  }

  // Head
  const head = new THREE.Group();
  head.position.y = 1.62;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16), skin);
  face.scale.set(0.95, 1.05, 0.95);
  const hood = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 8, 18, Math.PI * 1.2), hoodie);
  hood.position.set(0, -0.16, -0.06);
  hood.rotation.x = Math.PI / 2;
  hood.rotation.z = Math.PI * 0.9;
  head.add(face, hood);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2a1a10 }));
    eye.position.set(side * 0.07, 0.02, 0.17);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), skin);
    ear.position.set(side * 0.185, 0, 0);
    head.add(eye, ear);
  }
  // Spiky hair: a cap plus tufts
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  cap.position.y = 0.03;
  cap.rotation.x = -0.25;
  head.add(cap);
  const tufts: [number, number, number, number, number][] = [
    [0, 0.2, 0.06, -0.6, 0], [0.09, 0.17, 0.1, -0.9, -0.5], [-0.09, 0.17, 0.1, -0.9, 0.5], [0.12, 0.12, -0.05, 0.2, -0.9],
    [-0.12, 0.12, -0.05, 0.2, 0.9], [0, 0.16, -0.12, 0.8, 0], [0.05, 0.08, 0.17, -1.4, -0.2], [-0.06, 0.09, 0.17, -1.5, 0.3],
  ];
  for (const [x, y, z, rx, rz] of tufts) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 5), hair);
    t.position.set(x, y, z);
    t.rotation.set(rx, 0, rz);
    head.add(t);
  }
  body.add(head);

  shadowed(root);
  return { root, body, legs, arms, head, core };
}

export interface PlayerInput {
  /** Desired horizontal direction in world space, length ≤ 1 */
  move: THREE.Vector2;
  jump: boolean;
}

/** What happened to the explorer this step, for the game and for 💡 Comprendre. */
export interface PlayerEvents {
  landedOn?: string;
  launchedBy?: 'spring' | 'lever';
  launchSpeed?: number;
  impactSpeed?: number;
  fell?: boolean;
}

export class Explorer {
  readonly model = makeExplorerModel();
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly ctrl: RAPIER.KinematicCharacterController;
  vel = new THREE.Vector3();
  facing = 0;
  grounded = false;
  groundBody: RAPIER.RigidBody | null = null;
  private groundVel = new THREE.Vector3();
  private walkPhase = 0;
  private airTime = 0;
  /** Speed at the last landing, used by springs */
  private impactSpeed = 0;
  spawn = new THREE.Vector3();

  constructor(private level: Level, spawn: THREE.Vector3, facing = Math.PI / 2) {
    this.spawn.copy(spawn);
    this.facing = facing;
    const w = level.world;
    this.body = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + FOOT, spawn.z));
    this.collider = w.createCollider(RAPIER.ColliderDesc.capsule(HALF_H, RADIUS).setFriction(0.5), this.body);
    this.ctrl = w.createCharacterController(0.03);
    this.ctrl.enableAutostep(0.32, 0.2, false);
    this.ctrl.enableSnapToGround(0.25);
    this.ctrl.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.ctrl.setMinSlopeSlideAngle((60 * Math.PI) / 180);
    this.ctrl.setApplyImpulsesToDynamicBodies(false);
    this.ctrl.setSlideEnabled(true);
    level.root.add(this.model.root);
    this.syncModel(0);
  }

  get feet() {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y - FOOT, t.z);
  }

  teleport(p: THREE.Vector3) {
    this.body.setTranslation({ x: p.x, y: p.y + FOOT, z: p.z }, true);
    this.body.setNextKinematicTranslation({ x: p.x, y: p.y + FOOT, z: p.z });
    this.vel.set(0, 0, 0);
    this.groundBody = null;
  }

  /** One fixed physics step. */
  step(dt: number, input: PlayerInput, killY: number): PlayerEvents {
    const ev: PlayerEvents = {};
    const w = this.level.world;

    // Horizontal control
    const target = new THREE.Vector2(input.move.x * RUN_SPEED, input.move.y * RUN_SPEED);
    const accel = this.grounded ? 28 : 9;
    const cur = new THREE.Vector2(this.vel.x, this.vel.z);
    const diff = target.clone().sub(cur);
    const maxD = accel * dt;
    if (diff.length() > maxD) diff.setLength(maxD);
    cur.add(diff);
    this.vel.x = cur.x;
    this.vel.z = cur.y;
    if (input.move.lengthSq() > 0.01) this.facing = Math.atan2(input.move.x, input.move.y);

    // Ground probe (what we stand on)
    const pos = this.body.translation();
    const ray = new RAPIER.Ray({ x: pos.x, y: pos.y - FOOT + 0.25, z: pos.z }, { x: 0, y: -1, z: 0 });
    const hit = w.castRay(ray, 0.45, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.collider, this.body);
    const groundCollider = hit && this.grounded ? hit.collider : null;
    const gBody = groundCollider?.parent() ?? null;

    // Springs launch you
    if (gBody && this.level.springPads.has(gBody.handle) && this.vel.y <= 0.5) {
      const sp = this.level.springPads.get(gBody.handle)!;
      const r = gBody.rotation();
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
      const v = springBounce(this.vel, axis, this.impactSpeed, sp.spring!.launch);
      this.vel.copy(v);
      this.grounded = false;
      ev.launchedBy = 'spring';
      ev.launchSpeed = v.length();
      ev.impactSpeed = this.impactSpeed;
    }
    this.impactSpeed = 0;

    // Standing on a moving body: ride it, and keep its upward speed when it stops (catapult)
    let carry = new THREE.Vector3();
    if (gBody && gBody.isDynamic()) {
      const p = { x: pos.x, y: pos.y - FOOT, z: pos.z };
      const v = gBody.velocityAtPoint(p);
      carry.set(v.x, 0, v.z);
      this.groundVel.set(v.x, v.y, v.z);
      if (v.y > 0 && this.vel.y < v.y) this.vel.y = v.y;
      // Our weight pushes down on it
      gBody.applyImpulseAtPoint({ x: 0, y: -PLAYER_MASS * G * dt, z: 0 }, p, true);
    } else if (this.groundBody && this.groundBody.isDynamic() && !this.grounded) {
      // just left a moving body: keep its momentum
      const prev = this.groundVel;
      if (prev.y > 3.2) {
        ev.launchedBy = 'lever';
        ev.launchSpeed = prev.y;
      }
      this.groundVel.set(0, 0, 0);
    }
    this.groundBody = gBody;

    // Vertical: our own gravity (the explorer's boots keep normal gravity, even in "What if" modes)
    if (this.grounded && input.jump && !ev.launchedBy) {
      this.vel.y = Math.max(this.vel.y, 0) + JUMP_SPEED;
      this.grounded = false;
    }
    this.vel.y -= G * dt;

    const desired = new THREE.Vector3(this.vel.x + carry.x, this.vel.y, this.vel.z + carry.z).multiplyScalar(dt);
    this.ctrl.computeColliderMovement(this.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const mv = this.ctrl.computedMovement();
    const wasGrounded = this.grounded;
    this.grounded = this.ctrl.computedGrounded();

    // Push dynamic bodies we walk into
    for (let i = 0; i < this.ctrl.numComputedCollisions(); i++) {
      const c = this.ctrl.computedCollision(i);
      const b = c?.collider?.parent();
      if (!c || !b || !b.isDynamic()) continue;
      const n = c.normal1;
      if (Math.abs(n.y) > 0.6) continue;
      const dir = new THREE.Vector3(-n.x, 0, -n.z).normalize();
      const along = dir.dot(new THREE.Vector3(input.move.x, 0, input.move.y));
      if (along <= 0.2) continue;
      b.applyImpulseAtPoint({ x: dir.x * PUSH_FORCE * dt * along, y: 0, z: dir.z * PUSH_FORCE * dt * along }, { x: c.witness1.x, y: Math.max(c.witness1.y, b.translation().y), z: c.witness1.z }, true);
    }

    // Hitting a ceiling or landing cancels vertical speed
    if (this.grounded && this.vel.y < 0) {
      if (!wasGrounded) this.impactSpeed = -this.vel.y;
      if (!wasGrounded && this.airTime > 0.25) {
        const e = hit ? this.level.entityOfBody(hit.collider.parent()) : null;
        ev.landedOn = e?.label ?? 'sol';
      }
      this.vel.y = 0;
    }
    if (!this.grounded && this.vel.y > 0 && mv.y < desired.y * 0.5) this.vel.y = 0;
    this.airTime = this.grounded ? 0 : this.airTime + dt;

    const np = { x: pos.x + mv.x, y: pos.y + mv.y, z: pos.z + mv.z };
    this.body.setNextKinematicTranslation(np);

    if (np.y - FOOT < killY) {
      ev.fell = true;
    }
    return ev;
  }

  /** Visual update (interpolated, animation). */
  syncModel(dt: number) {
    const t = this.body.translation();
    const m = this.model;
    m.root.position.set(t.x, t.y - FOOT, t.z);
    // smooth turn
    let d = this.facing - m.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    m.root.rotation.y += d * Math.min(1, dt * 12);

    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded) {
      this.walkPhase += dt * speed * 3.2;
      const s = Math.sin(this.walkPhase) * Math.min(1, speed / RUN_SPEED) * 0.75;
      m.legs[0].rotation.x = s;
      m.legs[1].rotation.x = -s;
      m.arms[0].rotation.x = -s * 0.8;
      m.arms[1].rotation.x = s * 0.8;
      m.body.position.y = Math.abs(Math.cos(this.walkPhase)) * 0.04 * Math.min(1, speed);
      m.body.rotation.x = speed * 0.02;
    } else {
      m.legs[0].rotation.x = -0.7;
      m.legs[1].rotation.x = 0.3;
      m.arms[0].rotation.x = -2.4;
      m.arms[1].rotation.x = -2.2;
      m.body.position.y = 0;
    }
    const breathe = Math.sin(performance.now() / 600) * 0.01;
    m.head.position.y = 1.62 + breathe;
    (m.core.material as THREE.MeshStandardMaterial).emissiveIntensity = 2 + Math.sin(performance.now() / 300) * 0.6;
  }
}
