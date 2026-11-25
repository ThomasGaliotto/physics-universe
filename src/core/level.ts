import * as THREE from 'three';
import { G, RAPIER, newId, quatFromYawTilt, type Entity, type Piece } from './physics';
import { MAT, boxGeometry, shadowed } from '../world/materials';

export interface Plate {
  id: string;
  pos: THREE.Vector3;
  size: number;
  /** Minimum mass (kg) to press it */
  minMass: number;
  pressed: boolean;
  firstPress: number | null;
  mesh: THREE.Mesh;
  light: THREE.Mesh;
  /** Bodies currently on it */
  load: number;
}

export interface Crystal {
  pos: THREE.Vector3;
  mesh: THREE.Object3D;
  taken: boolean;
}

/**
 * A level owns its physics world, its scene graph and its entities.
 * Static terrain is made of fixed cuboids so that what you see is what you collide with.
 */
export class Level {
  readonly world: RAPIER.World;
  readonly root = new THREE.Group();
  readonly entities: Entity[] = [];
  readonly plates: Plate[] = [];
  readonly crystals: Crystal[] = [];
  /** Colliders that launch whatever lands on them (spring pads) */
  readonly springPads = new Map<number, Entity>();
  /** Animated decorations */
  readonly animated: ((t: number, dt: number) => void)[] = [];
  /** Fixed bodies that can be removed by a trigger (trapdoors, gates) */
  readonly gates = new Map<string, { body: RAPIER.RigidBody; mesh: THREE.Object3D }>();
  time = 0;

  constructor(scene: THREE.Scene) {
    this.world = new RAPIER.World({ x: 0, y: -G, z: 0 });
    this.world.timestep = 1 / 60;
    scene.add(this.root);
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.root);
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    try {
      this.world.free();
    } catch (e) {
      // A wasm value still borrowed (rare): let the GC reclaim it instead of crashing the menu.
      console.warn('physics world not freed', e);
    }
  }

  // ---------------------------------------------------------------- terrain

  /** A fixed box. `top` is the y of its upper face. */
  block(x: number, z: number, w: number, d: number, top: number, h: number, mat: THREE.Material = MAT.rock, opts: { yaw?: number; tilt?: number; friction?: number; name?: string } = {}) {
    const q = quatFromYawTilt(opts.yaw ?? 0, opts.tilt ?? 0);
    const cy = top - h / 2;
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, cy, z).setRotation(q));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setFriction(opts.friction ?? 0.8), body);
    const mesh = shadowed(new THREE.Mesh(boxGeometry(w, h, d), mat));
    mesh.position.set(x, cy, z);
    mesh.quaternion.copy(q);
    this.root.add(mesh);
    return { body, mesh };
  }

  /**
   * A floating island: grass slab on top of a rock body, with a jagged rocky underside.
   * The collider is the box [x-w/2, x+w/2] × [top-depth, top] × [z-d/2, z+d/2].
   */
  island(x: number, z: number, w: number, d: number, top: number, depth = 3, opts: { trees?: number; seed?: number; waterfall?: boolean; flowers?: boolean } = {}) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, top - depth / 2, z));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, depth / 2, d / 2).setFriction(0.9), body);

    const g = new THREE.Group();
    g.position.set(x, top, z);
    const grass = new THREE.Mesh(boxGeometry(w + 0.3, 0.35, d + 0.3, 3), MAT.grass);
    grass.position.y = -0.17;
    const rock = new THREE.Mesh(boxGeometry(w, depth - 0.3, d, 3), MAT.rock);
    rock.position.y = -0.3 - (depth - 0.3) / 2;
    g.add(grass, rock);

    // Jagged underside (decor only, below the collider)
    let seed = opts.seed ?? Math.floor(x * 13 + z * 7 + top * 3);
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const under = new THREE.ConeGeometry(Math.max(w, d) * 0.62, Math.max(w, d) * 0.9 + depth, 9, 4);
    const pos = under.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > (Math.max(w, d) * 0.9 + depth) / 2 - 0.01) continue;
      pos.setX(i, pos.getX(i) * (0.8 + rnd() * 0.4));
      pos.setZ(i, pos.getZ(i) * (0.8 + rnd() * 0.4));
    }
    under.computeVertexNormals();
    const underMesh = new THREE.Mesh(under, MAT.rockDark);
    underMesh.rotation.x = Math.PI;
    underMesh.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    underMesh.position.y = -depth - (Math.max(w, d) * 0.9 + depth) / 2 + 0.5;
    g.add(underMesh);

    for (let i = 0; i < (opts.trees ?? 0); i++) {
      const tx = (rnd() - 0.5) * (w - 1.5);
      const tz = rnd() < 0.5 ? -d / 2 + 0.8 + rnd() * 0.6 : d / 2 - 0.8 - rnd() * 0.6;
      const tree = makeTree(0.8 + rnd() * 0.6, rnd);
      tree.position.set(tx, 0, tz);
      g.add(tree);
    }
    if (opts.flowers !== false) {
      for (let i = 0; i < Math.min(14, (w * d) / 6); i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 5, 4), rnd() < 0.5 ? MAT.glowGold : new THREE.MeshStandardMaterial({ color: [0xff7aa8, 0xffffff, 0x9fd6ff][i % 3] }));
        f.position.set((rnd() - 0.5) * (w - 0.6), 0.1, (rnd() - 0.5) * (d - 0.6));
        g.add(f);
      }
    }
    if (opts.waterfall) g.add(this.waterfall(new THREE.Vector3(w / 2 - 0.6, -0.25, d / 2 + 0.16), 1.2, 22));
    shadowed(g);
    this.root.add(g);
    return body;
  }

  waterfall(at: THREE.Vector3, width: number, height: number) {
    const tex = waterTexture();
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, fog: true });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    m.position.set(at.x, at.y - height / 2, at.z);
    this.animated.push((_t, dt) => {
      tex.offset.y += dt * 1.6;
    });
    return m;
  }

  // ---------------------------------------------------------------- mechanisms

  /** A seesaw: a dynamic plank on a revolute joint. `pivotOffset` shifts the pivot along the plank. */
  seesaw(x: number, z: number, top: number, length: number, pivotOffset: number, startTilt: number, mass = 30) {
    const baseH = top - 0.18;
    const base = this.block(x, z, 0.5, 1.2, baseH, 0.9, MAT.stone);
    const q = quatFromYawTilt(0, startTilt);
    const centre = new THREE.Vector3(-pivotOffset, 0, 0).applyQuaternion(q).add(new THREE.Vector3(x, top, z));
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(centre.x, centre.y, centre.z).setRotation(q).setAngularDamping(0.05).setCanSleep(false),
    );
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(length / 2, 0.08, 0.6).setMass(mass).setFriction(1.0), body);
    const mesh = shadowed(new THREE.Mesh(boxGeometry(length, 0.16, 1.2), MAT.wood));
    this.root.add(mesh);
    const joint = this.world.createImpulseJoint(
      RAPIER.JointData.revolute({ x: pivotOffset, y: 0, z: 0 }, { x: 0, y: 0.18 + 0.45, z: 0 }, { x: 0, y: 0, z: 1 }),
      body,
      base.body,
      true,
    );
    joint.setContactsEnabled(false);
    // pivot marker
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 12), MAT.brass);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(x, top, z);
    this.root.add(pin);
    const e: Entity = {
      id: newId(),
      part: null,
      label: 'Bascule',
      pieces: [{ body, mesh, localPos: new THREE.Vector3(), localRot: new THREE.Quaternion() }],
      joints: [joint],
      movable: false,
      fromInventory: false,
      metal: false,
      mass,
      half: new THREE.Vector3(length / 2, 0.08, 0.6),
      pos: centre.clone(),
      yaw: 0,
      tilt: startTilt,
      lift: 0,
      fixed: false,
      tag: 'seesaw',
    };
    this.entities.push(e);
    return { entity: e, pivot: new THREE.Vector3(x, top, z), length, pivotOffset };
  }

  /** A pressure plate: pressed when the mass resting on it reaches `minMass`. */
  plate(id: string, x: number, z: number, top: number, size = 1.4, minMass = 1) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.62, size * 0.7, 0.16, 24), MAT.darkMetal);
    base.position.set(x, top + 0.02, z);
    const light = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.5, size * 0.5, 0.06, 24), MAT.glow.clone());
    light.position.set(x, top + 0.12, z);
    shadowed(base);
    this.root.add(base, light);
    const p: Plate = { id, pos: new THREE.Vector3(x, top, z), size, minMass, pressed: false, firstPress: null, mesh: base, light, load: 0 };
    this.plates.push(p);
    return p;
  }

  crystal(x: number, y: number, z: number) {
    const g = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), MAT.crystal);
    gem.scale.y = 1.5;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 32), MAT.glow);
    halo.rotation.x = Math.PI / 2;
    g.add(gem, halo);
    g.position.set(x, y, z);
    this.root.add(g);
    const c: Crystal = { pos: new THREE.Vector3(x, y, z), mesh: g, taken: false };
    this.crystals.push(c);
    this.animated.push((t) => {
      if (c.taken) return;
      gem.rotation.y = t * 1.6;
      g.position.y = y + Math.sin(t * 2 + x) * 0.12;
      halo.rotation.z = t;
    });
    return c;
  }

  /** The goal: a checkered flag inside a glowing arch. */
  flag(x: number, top: number, z: number) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8), MAT.darkMetal);
    pole.position.y = 1.6;
    const tex = checkerTexture();
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.85, 8, 4), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }));
    cloth.position.set(0.66, 2.75, 0);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.07, 8, 40, Math.PI), MAT.glowGold);
    arch.rotation.y = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.7, 40), new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(pole, cloth, arch, ring);
    g.position.set(x, top, z);
    shadowed(g);
    this.root.add(g);
    const pos = cloth.geometry.attributes.position as THREE.BufferAttribute;
    const base = Float32Array.from(pos.array as Float32Array);
    this.animated.push((t) => {
      for (let i = 0; i < pos.count; i++) {
        const px = base[i * 3] + 0.65;
        pos.setZ(i, Math.sin(px * 4 - t * 5) * 0.08 * px);
      }
      pos.needsUpdate = true;
      ring.material.opacity = 0.25 + Math.sin(t * 3) * 0.12;
    });
    return new THREE.Vector3(x, top, z);
  }

  /** A fixed slab that a trigger can remove (trapdoor) or a gate that can open. */
  gate(id: string, x: number, z: number, w: number, d: number, top: number, h: number, mat: THREE.Material = MAT.stone) {
    const b = this.block(x, z, w, d, top, h, mat);
    this.gates.set(id, b);
    return b;
  }

  openGate(id: string) {
    const g = this.gates.get(id);
    if (!g) return;
    g.body.setEnabled(false);
    g.mesh.visible = false;
  }

  /** A fixed ramp whose top surface goes from (x0, y0) to (x1, y1), across z ∈ [z-d/2, z+d/2]. */
  ramp(x0: number, y0: number, x1: number, y1: number, z: number, d: number, mat: THREE.Material = MAT.stone, thick = 0.5) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const a = Math.atan2(y1 - y0, x1 - x0);
    const n = new THREE.Vector2(-Math.sin(a), Math.cos(a));
    const cx = (x0 + x1) / 2 - n.x * (thick / 2);
    const cy = (y0 + y1) / 2 - n.y * (thick / 2);
    const q = quatFromYawTilt(0, a);
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, z).setRotation(q));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(len / 2, thick / 2, d / 2).setFriction(0.8), body);
    const mesh = shadowed(new THREE.Mesh(boxGeometry(len, thick, d), mat));
    mesh.position.set(cx, cy, z);
    mesh.quaternion.copy(q);
    this.root.add(mesh);
    return { body, mesh };
  }

  /** Colliders that build-mode picking ignores (guard rails, invisible walls). */
  readonly unpickable = new Set<number>();

  /**
   * A smooth track following y = f(x) from x0 to x1, built from short ramp segments.
   * With `rail`, it is a thin guard rail (not pickable) instead of a road.
   */
  profile(f: (x: number) => number, x0: number, x1: number, z: number, d: number, mat: THREE.Material = MAT.stone, thick = 0.6, rail = false) {
    const n = Math.max(1, Math.round((x1 - x0) / 0.5));
    for (let i = 0; i < n; i++) {
      const a = x0 + ((x1 - x0) * i) / n;
      const b = x0 + ((x1 - x0) * (i + 1)) / n;
      // tiny overlap avoids seams between segments
      const r = this.ramp(a - 0.02, f(a - 0.02), b + 0.02, f(b + 0.02), z, d, mat, thick);
      if (rail) for (let k = 0; k < r.body.numColliders(); k++) this.unpickable.add(r.body.collider(k).handle);
    }
  }

  /** A gate that starts hidden and appears when revealed (a bridge that unfolds). */
  hiddenGate(id: string, x: number, z: number, w: number, d: number, top: number, h: number, mat: THREE.Material = MAT.glowGold) {
    const b = this.gate(id, x, z, w, d, top, h, mat);
    b.body.setEnabled(false);
    b.mesh.visible = false;
    return b;
  }

  revealGate(id: string) {
    const g = this.gates.get(id);
    if (!g || g.mesh.visible) return;
    g.body.setEnabled(true);
    g.mesh.visible = true;
    g.mesh.scale.set(0.01, 1, 1);
    const t0 = this.time;
    this.animated.push((t) => {
      const k = Math.min(1, (t - t0) / 1.2);
      g.mesh.scale.x = 0.01 + 0.99 * (1 - Math.pow(1 - k, 3));
    });
  }

  /** Decorative sign with a short text, facing the camera's default direction. */
  sign(x: number, z: number, top: number, text: string) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 192;
    const g = c.getContext('2d')!;
    g.fillStyle = '#7a5236';
    g.fillRect(0, 0, 512, 192);
    g.fillStyle = '#c98a4b';
    g.fillRect(10, 10, 492, 172);
    g.fillStyle = '#3a2214';
    g.font = 'bold 56px "Baloo 2", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, 100);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }));
    board.position.set(x, top + 1.3, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), MAT.trunk);
    post.position.set(x, top + 0.65, z - 0.02);
    shadowed(post);
    this.root.add(board, post);
  }

  addEntity(e: Entity) {
    this.entities.push(e);
    for (const p of e.pieces) this.root.add(p.mesh);
    if (e.spring) this.springPads.set(e.pieces[0].body.handle, e);
  }

  removeEntity(e: Entity) {
    for (const j of e.joints) this.world.removeImpulseJoint(j, true);
    if (e.rocket?.joint) this.world.removeImpulseJoint(e.rocket.joint, true);
    for (const p of e.pieces) {
      this.world.removeRigidBody(p.body);
      this.root.remove(p.mesh);
    }
    this.springPads.delete(e.pieces[0].body.handle);
    const i = this.entities.indexOf(e);
    if (i >= 0) this.entities.splice(i, 1);
    // Rockets attached to this entity fall off
    for (const o of this.entities) if (o.rocket?.host === e) o.rocket.host = null;
  }

  entityOfBody(b: RAPIER.RigidBody | null): Entity | null {
    if (!b) return null;
    for (const e of this.entities) for (const p of e.pieces) if (p.body.handle === b.handle) return e;
    return null;
  }

  pieceOf(e: Entity): Piece {
    return e.pieces[0];
  }
}

// ---------------------------------------------------------------- decor helpers

export function makeTree(scale: number, rnd: () => number) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.6, 6), MAT.trunk);
  trunk.position.y = 0.8;
  g.add(trunk);
  const n = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75 - i * 0.12, 0), i % 2 ? MAT.leafLight : MAT.leaf);
    leaf.position.set((rnd() - 0.5) * 0.4, 1.7 + i * 0.55, (rnd() - 0.5) * 0.4);
    g.add(leaf);
  }
  g.scale.setScalar(scale);
  return g;
}

let waterTex: THREE.CanvasTexture | null = null;
function waterTexture() {
  if (waterTex) return waterTex.clone();
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 64, 0);
  grd.addColorStop(0, 'rgba(200,240,255,0)');
  grd.addColorStop(0.2, 'rgba(200,240,255,0.85)');
  grd.addColorStop(0.8, 'rgba(200,240,255,0.85)');
  grd.addColorStop(1, 'rgba(200,240,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.5})`;
    g.fillRect(8 + Math.random() * 48, Math.random() * 256, 2, 14 + Math.random() * 30);
  }
  waterTex = new THREE.CanvasTexture(c);
  waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(1, 4);
  return waterTex;
}

function checkerTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 84;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 9; x++) {
      g.fillStyle = (x + y) % 2 ? '#111' : '#fafafa';
      g.fillRect(x * 14.3, y * 14, 14.3, 14);
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
