import * as THREE from 'three';
import { RAPIER, newId, quatFromYawTilt, setEntityTransform, type Entity, type PartKind, type Piece } from './core/physics';
import type { Level } from './core/level';
import { MAT, boxGeometry, shadowed } from './world/materials';

export interface PartDef {
  label: string;
  icon: string;
  mass: number;
  /** One-line description shown in the build bar */
  info: string;
  metal: boolean;
}

export const PARTS: Record<PartKind, PartDef> = {
  planche: { label: 'Planche', icon: '🪵', mass: 24, info: 'Planche de 6 m · 24 kg', metal: false },
  caisse: { label: 'Caisse', icon: '📦', mass: 25, info: 'Caisse de 1 m · 25 kg', metal: false },
  boulet: { label: 'Boulet', icon: '⚫', mass: 50, info: 'Boulet de fer · 50 kg', metal: true },
  ballon: { label: 'Ballon', icon: '🔴', mass: 1, info: 'Ballon léger · 1 kg', metal: false },
  enclume: { label: 'Enclume', icon: '⚓', mass: 100, info: 'Enclume · 100 kg', metal: true },
  chariot: { label: 'Chariot', icon: '🛒', mass: 38, info: 'Chariot à roues · 38 kg', metal: true },
  ressort: { label: 'Ressort', icon: '🌀', mass: 0, info: 'Ressort : propulse vers le haut', metal: false },
  aimant: { label: 'Aimant', icon: '🧲', mass: 0, info: 'Aimant : attire le métal', metal: false },
  fusee: { label: 'Fusée', icon: '🚀', mass: 4, info: 'Fusée : 350 N pendant 2 s', metal: false },
};

export const PART_ORDER: PartKind[] = ['planche', 'caisse', 'boulet', 'ballon', 'enclume', 'chariot', 'ressort', 'aimant', 'fusee'];

export const SPRING_LAUNCH = 10.5; // m/s, speed given to something at rest
export const SPRING_MAX = 15.5; // m/s
export const ROCKET_THRUST = 350; // N
export const ROCKET_BURN = 2.0; // s

/**
 * A spring pad gives back the energy you bring (v_in) and adds its own (launch):
 * ½·v_out² = ½·v_in² + ½·launch², along the pad's axis.
 */
export function springBounce(v: THREE.Vector3, axis: THREE.Vector3, vIn: number, launch: number) {
  const along = v.dot(axis);
  const out = Math.min(SPRING_MAX, Math.sqrt(vIn * vIn + launch * launch));
  return v.clone().addScaledVector(axis, out - along);
}

function piece(level: Level, desc: RAPIER.RigidBodyDesc, colliders: RAPIER.ColliderDesc[], mesh: THREE.Object3D, localPos = new THREE.Vector3(), localRot = new THREE.Quaternion()): Piece {
  const body = level.world.createRigidBody(desc);
  for (const c of colliders) level.world.createCollider(c, body);
  shadowed(mesh);
  return { body, mesh, localPos, localRot };
}

function entity(kind: PartKind, pieces: Piece[], half: THREE.Vector3, extra: Partial<Entity> = {}): Entity {
  const def = PARTS[kind];
  return {
    id: newId(),
    part: kind,
    label: def.label,
    pieces,
    joints: [],
    movable: true,
    fromInventory: true,
    metal: def.metal,
    mass: def.mass,
    half,
    pos: new THREE.Vector3(),
    yaw: 0,
    tilt: 0,
    lift: 0,
    fixed: false,
    ...extra,
  };
}

const dyn = () => RAPIER.RigidBodyDesc.dynamic().setCanSleep(true).setCcdEnabled(true);

/** Create a part at a position. The entity is added to the level. */
export function createPart(level: Level, kind: PartKind, pos: THREE.Vector3, yaw = 0, tilt = 0): Entity {
  let e: Entity;
  switch (kind) {
    case 'planche': {
      const mesh = new THREE.Mesh(boxGeometry(6, 0.12, 0.8, 2.5), MAT.wood);
      e = entity(kind, [piece(level, dyn(), [RAPIER.ColliderDesc.cuboid(3, 0.06, 0.4).setMass(24).setFriction(0.9)], mesh)], new THREE.Vector3(3, 0.06, 0.4));
      break;
    }
    case 'caisse': {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), MAT.crate);
      e = entity(kind, [piece(level, dyn(), [RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setMass(25).setFriction(0.6)], mesh)], new THREE.Vector3(0.5, 0.5, 0.5));
      break;
    }
    case 'boulet': {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 16), MAT.darkMetal);
      e = entity(kind, [piece(level, dyn(), [RAPIER.ColliderDesc.ball(0.35).setMass(50).setFriction(0.6).setRestitution(0.1)], mesh)], new THREE.Vector3(0.35, 0.35, 0.35));
      break;
    }
    case 'ballon': {
      const g = new THREE.Group();
      const colors = [0xff4d4d, 0xffffff, 0x3fa9ff, 0xffd23f, 0xffffff, 0x47d16b];
      for (let i = 0; i < 6; i++) {
        const seg = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 14, (i * Math.PI) / 3, Math.PI / 3), new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.35 }));
        g.add(seg);
      }
      e = entity(kind, [piece(level, dyn(), [RAPIER.ColliderDesc.ball(0.35).setMass(1).setFriction(0.6).setRestitution(0.35)], g)], new THREE.Vector3(0.35, 0.35, 0.35));
      break;
    }
    case 'enclume': {
      const g = new THREE.Group();
      const top = new THREE.Mesh(boxGeometry(0.9, 0.22, 0.5), MAT.darkMetal);
      top.position.y = 0.165;
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.4, 10), MAT.darkMetal);
      horn.rotation.z = Math.PI / 2;
      horn.position.set(0.6, 0.2, 0);
      const waist = new THREE.Mesh(boxGeometry(0.4, 0.2, 0.34), MAT.darkMetal);
      waist.position.y = -0.04;
      const foot = new THREE.Mesh(boxGeometry(0.7, 0.14, 0.5), MAT.darkMetal);
      foot.position.y = -0.205;
      g.add(top, horn, waist, foot);
      e = entity(kind, [piece(level, dyn(), [RAPIER.ColliderDesc.cuboid(0.45, 0.275, 0.25).setMass(100).setFriction(0.7)], g)], new THREE.Vector3(0.45, 0.275, 0.25));
      break;
    }
    case 'chariot': {
      const g = new THREE.Group();
      // An open box on wheels: deck + four low walls keep the cargo inside
      const deck = new THREE.Mesh(boxGeometry(1.8, 0.16, 1.1), MAT.wood);
      const side1 = new THREE.Mesh(boxGeometry(1.8, 0.44, 0.08), MAT.brass);
      side1.position.set(0, 0.3, 0.51);
      const side2 = side1.clone();
      side2.position.z = -0.51;
      const back = new THREE.Mesh(boxGeometry(0.08, 0.44, 1.1), MAT.brass);
      back.position.set(-0.86, 0.3, 0);
      const front = back.clone();
      front.position.x = 0.86;
      g.add(deck, side1, side2, back, front);
      const wall = (x: number, z: number, hx: number, hz: number) => RAPIER.ColliderDesc.cuboid(hx, 0.22, hz).setTranslation(x, 0.3, z).setMass(0.5).setFriction(0.4);
      const chassis = piece(
        level,
        dyn(),
        [RAPIER.ColliderDesc.cuboid(0.9, 0.08, 0.55).setMass(28).setFriction(0.5), wall(0, 0.51, 0.9, 0.04), wall(0, -0.51, 0.9, 0.04), wall(-0.86, 0, 0.04, 0.55), wall(0.86, 0, 0.04, 0.55)],
        g,
      );
      const pieces: Piece[] = [chassis];
      const wheels: [number, number][] = [[0.62, 0.62], [0.62, -0.62], [-0.62, 0.62], [-0.62, -0.62]];
      for (const [wx, wz] of wheels) {
        const wg = new THREE.Group();
        const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 20), MAT.rubber);
        tyre.rotation.x = Math.PI / 2;
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 12), MAT.brass);
        hub.rotation.x = Math.PI / 2;
        wg.add(tyre, hub);
        pieces.push(piece(level, dyn(), [RAPIER.ColliderDesc.ball(0.3).setMass(2).setFriction(1.2)], wg, new THREE.Vector3(wx, -0.2, wz)));
      }
      e = entity(kind, pieces, new THREE.Vector3(0.95, 0.5, 0.78));
      // half.y is the distance from the chassis centre down to the bottom of the wheels
      for (let i = 1; i < pieces.length; i++) {
        const lp = pieces[i].localPos;
        const j = level.world.createImpulseJoint(RAPIER.JointData.revolute({ x: lp.x, y: lp.y, z: lp.z }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }), chassis.body, pieces[i].body, true);
        j.setContactsEnabled(false);
        e.joints.push(j);
      }
      break;
    }
    case 'ressort': {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.14, 24), MAT.darkMetal);
      base.position.y = -0.18;
      const coil = new THREE.Mesh(new THREE.TubeGeometry(new HelixCurve(0.38, 0.26, 5), 120, 0.045, 6, false), MAT.metal);
      coil.position.y = -0.11;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 24), MAT.red);
      pad.position.y = 0.2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 6, 32), MAT.glow);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.26;
      g.add(base, coil, pad, ring);
      // Low pad (28 cm): you can walk onto it
      g.scale.y = 0.56;
      const holder = new THREE.Group();
      holder.add(g);
      const p = piece(level, RAPIER.RigidBodyDesc.fixed(), [RAPIER.ColliderDesc.cuboid(0.6, 0.14, 0.6).setFriction(0.9)], holder);
      e = entity(kind, [p], new THREE.Vector3(0.6, 0.14, 0.6), { fixed: true, spring: { launch: SPRING_LAUNCH, cooldown: 0, pad } });
      break;
    }
    case 'aimant': {
      const g = new THREE.Group();
      const u = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.14, 10, 24, Math.PI), MAT.red);
      u.rotation.z = Math.PI;
      u.position.y = 0.1;
      const tipL = new THREE.Mesh(boxGeometry(0.28, 0.26, 0.28), MAT.metal);
      tipL.position.set(-0.34, -0.06 + 0.1, 0);
      const tipR = tipL.clone();
      tipR.position.x = 0.34;
      const field = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.015, 6, 40), MAT.glow);
      field.rotation.x = Math.PI / 2;
      g.add(u, tipL, tipR, field);
      const p = piece(level, RAPIER.RigidBodyDesc.fixed(), [RAPIER.ColliderDesc.cuboid(0.5, 0.4, 0.2).setFriction(0.8)], g);
      e = entity(kind, [p], new THREE.Vector3(0.5, 0.4, 0.2), { fixed: true, magnet: { strength: 2600, range: 8 } });
      level.animated.push((t) => {
        field.scale.setScalar(1 + ((t * 0.8) % 1) * 0.8);
        (field.material as THREE.MeshStandardMaterial).opacity = 1;
      });
      break;
    }
    case 'fusee': {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.8, 16), MAT.white);
      body.rotation.z = Math.PI / 2;
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 16), MAT.red);
      nose.rotation.z = -Math.PI / 2;
      nose.position.x = 0.56;
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.16, 12), MAT.darkMetal);
      nozzle.rotation.z = Math.PI / 2;
      nozzle.position.x = -0.48;
      g.add(body, nose, nozzle);
      for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(boxGeometry(0.28, 0.02, 0.22), MAT.red);
        fin.position.x = -0.3;
        fin.rotation.x = (i * Math.PI * 2) / 3;
        fin.translateZ(0.17);
        g.add(fin);
      }
      const flame = new THREE.Group();
      const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.9, 12), new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.9 }));
      f1.rotation.z = Math.PI / 2;
      f1.position.x = -0.98;
      const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.4, 12), new THREE.MeshBasicMaterial({ color: 0xff7a2e, transparent: true, opacity: 0.55 }));
      f2.rotation.z = Math.PI / 2;
      f2.position.x = -1.2;
      flame.add(f2, f1);
      flame.visible = false;
      g.add(flame);
      const p = piece(level, dyn(), [RAPIER.ColliderDesc.cuboid(0.55, 0.16, 0.16).setMass(4).setFriction(0.6)], g);
      e = entity(kind, [p], new THREE.Vector3(0.6, 0.17, 0.17), { rocket: { thrust: ROCKET_THRUST, burnTime: ROCKET_BURN, burned: 0, host: null, joint: null, flame } });
      break;
    }
  }
  e.pos.copy(pos);
  e.yaw = yaw;
  e.tilt = tilt;
  setEntityTransform(e, pos, quatFromYawTilt(yaw, tilt));
  level.addEntity(e);
  for (const p of e.pieces) {
    const t = p.body.translation();
    const r = p.body.rotation();
    p.mesh.position.set(t.x, t.y, t.z);
    p.mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }
  return e;
}

/** Ghost preview of a part for build mode. */
export function ghostMesh(kind: PartKind): THREE.Object3D {
  const mat = new THREE.MeshBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0.35, depthWrite: false });
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
  };
  switch (kind) {
    case 'planche': add(new THREE.BoxGeometry(6, 0.12, 0.8)); break;
    case 'caisse': add(new THREE.BoxGeometry(1, 1, 1)); break;
    case 'boulet':
    case 'ballon': add(new THREE.SphereGeometry(0.35, 16, 12)); break;
    case 'enclume': add(new THREE.BoxGeometry(0.9, 0.55, 0.5)); break;
    case 'chariot':
      add(new THREE.BoxGeometry(1.8, 0.16, 1.1));
      for (const [x, z] of [[0.62, 0.62], [0.62, -0.62], [-0.62, 0.62], [-0.62, -0.62]]) add(new THREE.SphereGeometry(0.3, 12, 8), x, -0.2, z);
      break;
    case 'ressort': add(new THREE.CylinderGeometry(0.6, 0.6, 0.28, 20)); break;
    case 'aimant': add(new THREE.BoxGeometry(1, 0.8, 0.4)); break;
    case 'fusee': {
      const c = new THREE.CylinderGeometry(0.16, 0.16, 1.2, 12);
      c.rotateZ(Math.PI / 2);
      add(c);
      break;
    }
  }
  return g;
}

class HelixCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private r: number, private h: number, private turns: number) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const a = t * Math.PI * 2 * this.turns;
    return target.set(Math.cos(a) * this.r, t * this.h, Math.sin(a) * this.r);
  }
}
