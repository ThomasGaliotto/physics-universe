import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export { RAPIER };
export const G = 9.81;

export async function initPhysics() {
  await RAPIER.init();
}

export type PartKind = 'planche' | 'caisse' | 'boulet' | 'ballon' | 'enclume' | 'chariot' | 'ressort' | 'aimant' | 'fusee';

/** One rigid body of an entity with its visual and its offset from the entity root. */
export interface Piece {
  body: RAPIER.RigidBody;
  mesh: THREE.Object3D;
  localPos: THREE.Vector3;
  localRot: THREE.Quaternion;
}

export interface RocketState {
  thrust: number; // N
  burnTime: number; // s
  burned: number;
  host: Entity | null;
  joint: RAPIER.ImpulseJoint | null;
  flame: THREE.Object3D;
}

/** Anything dynamic or editable in a level: a part, a mission object, a chariot with its wheels… */
export interface Entity {
  id: number;
  part: PartKind | null;
  label: string;
  pieces: Piece[];
  joints: RAPIER.ImpulseJoint[];
  /** Can be picked up and moved in build mode */
  movable: boolean;
  /** Placed by the player from the inventory (removable) */
  fromInventory: boolean;
  metal: boolean;
  /** Mass shown to the player (kg) */
  mass: number;
  /** Half extents of the root shape, used for placement */
  half: THREE.Vector3;
  /** Build-mode transform (root) */
  pos: THREE.Vector3;
  yaw: number;
  tilt: number;
  lift: number;
  fixed: boolean;
  rocket?: RocketState;
  spring?: { launch: number; cooldown: number; pad: THREE.Object3D };
  magnet?: { strength: number; range: number };
  tag?: string;
  /** Keep this entity on a vertical plane z = lockZ (a wagon on rails) */
  lockZ?: number;
  /** Placed along the slope under it (carts) */
  followSlope?: boolean;
  /** Height from the root centre to the bottom, if not given by `half` */
  bottom?: number;
}

let nextId = 1;
export const newId = () => nextId++;

export function quatFromYawTilt(yaw: number, tilt: number) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, tilt, 'YXZ'));
  return q;
}

const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

/** Teleport every piece of an entity to a new root transform (used in build mode). */
export function setEntityTransform(e: Entity, pos: THREE.Vector3, rot: THREE.Quaternion) {
  for (const p of e.pieces) {
    tmpV.copy(p.localPos).applyQuaternion(rot).add(pos);
    tmpQ.copy(rot).multiply(p.localRot);
    p.body.setTranslation({ x: tmpV.x, y: tmpV.y, z: tmpV.z }, true);
    p.body.setRotation({ x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w }, true);
    p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
}

export function syncMeshes(entities: Entity[]) {
  for (const e of entities) {
    for (const p of e.pieces) {
      const t = p.body.translation();
      const r = p.body.rotation();
      p.mesh.position.set(t.x, t.y, t.z);
      p.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }
}

export interface BodySnapshot {
  body: RAPIER.RigidBody;
  t: RAPIER.Vector;
  r: RAPIER.Rotation;
  lv: RAPIER.Vector;
  av: RAPIER.Vector;
  enabled: boolean;
}

export function snapshotBodies(world: RAPIER.World): BodySnapshot[] {
  const out: BodySnapshot[] = [];
  world.bodies.forEach((b) => {
    if (b.isFixed() || b.isKinematic()) return;
    out.push({ body: b, t: { ...b.translation() }, r: { ...b.rotation() }, lv: { ...b.linvel() }, av: { ...b.angvel() }, enabled: b.isEnabled() });
  });
  return out;
}

export function restoreBodies(snap: BodySnapshot[]) {
  for (const s of snap) {
    s.body.setEnabled(s.enabled);
    s.body.setTranslation(s.t, true);
    s.body.setRotation(s.r, true);
    s.body.setLinvel(s.lv, true);
    s.body.setAngvel(s.av, true);
    s.body.resetForces(true);
    s.body.resetTorques(true);
  }
}
