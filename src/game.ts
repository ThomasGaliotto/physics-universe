import * as THREE from 'three';
import { G, RAPIER, quatFromYawTilt, restoreBodies, setEntityTransform, snapshotBodies, syncMeshes, type BodySnapshot, type Entity, type PartKind } from './core/physics';
import { Level } from './core/level';
import { Explorer, PLAYER_MASS, type PlayerInput } from './explorer';
import { PARTS, createPart, ghostMesh, springBounce } from './parts';
import type { Mission, MissionApi, RunStats } from './missions';
import type { Renderer } from './core/render';

export type WhatIf = 'gravite' | 'frottement' | 'ralenti' | 'masse';

export interface Insight {
  key: string;
  data: Record<string, number | string>;
  at: number;
}

export interface GameCallbacks {
  onWin: (result: { stars: [boolean, boolean, boolean]; stats: RunStats }) => void;
  onChange: () => void;
  toast: (text: string) => void;
  hint: (text: string) => void;
}

const MAX_LIFT = 8;

/** One play session of a mission (or the sandbox). */
export class Game {
  readonly level: Level;
  readonly player: Explorer;
  mode: 'play' | 'build' = 'play';
  tested = false;
  won = false;
  inventory: Partial<Record<PartKind, number>>;
  placed: Entity[] = [];
  selected: Entity | null = null;
  tool: PartKind | null = null;
  whatIf = new Set<WhatIf>();
  insights: Insight[] = [];
  stats: RunStats = { falls: 0, tests: 0, time: 0, maxY: 0, partsUsed: 0, crystals: 0, launches: 0 };
  killY: number;
  goal: THREE.Vector3 | null;
  /** Free data for mission scripts */
  vars: Record<string, number> = {};

  // camera
  camYaw = -Math.PI / 2 + 0.55;
  camPitch = 0.42;
  camDist = 9;
  camTarget = new THREE.Vector3();
  private buildFocus = new THREE.Vector3();

  private acc = 0;
  private snapshot: { bodies: BodySnapshot[]; player: THREE.Vector3; rockets: Map<Entity, number>; vars: Record<string, number> } | null = null;
  private ghost: THREE.Object3D | null = null;
  private selBox: THREE.LineSegments | null = null;
  private bases = new Map<number, THREE.Vector3>();
  private frictions = new Map<number, number>();
  private masses = new Map<number, number>();
  private springCooldown = new Map<number, number>();
  private testClock = 0;
  readonly api: MissionApi;
  private hinted = new Set<string>();

  constructor(
    private r: Renderer,
    readonly mission: Mission,
    private cb: GameCallbacks,
  ) {
    this.level = new Level(r.scene);
    const setup = mission.build(this.level);
    this.killY = setup.killY ?? -12;
    this.goal = setup.goal;
    this.inventory = { ...mission.inventory };
    this.player = new Explorer(this.level, setup.spawn, setup.facing ?? Math.PI / 2);
    if (setup.camYaw !== undefined) this.camYaw = setup.camYaw;
    this.camTarget.copy(setup.spawn).add(new THREE.Vector3(0, 1.3, 0));
    this.buildFocus.copy(this.camTarget);
    this.api = {
      level: this.level,
      game: this,
      emit: (key, data = {}) => this.emit(key, data),
      openGate: (id) => this.level.openGate(id),
      toast: (t) => this.cb.toast(t),
      hint: (t) => this.cb.hint(t),
    };
    // Mission objects that can be moved count as "placed" for build interactions
    syncMeshes(this.level.entities);
    this.player.syncModel(0);
  }

  dispose() {
    this.level.world.removeCharacterController(this.player.ctrl);
    this.level.dispose(this.r.scene);
  }

  emit(key: string, data: Record<string, number | string> = {}) {
    this.insights.unshift({ key, data, at: this.level.time });
    if (this.insights.length > 12) this.insights.pop();
    this.cb.onChange();
  }

  // ------------------------------------------------------------------ loop

  update(dt: number, input: PlayerInput, buildPan: THREE.Vector2) {
    dt = Math.min(dt, 0.05);
    const scale = this.whatIf.has('ralenti') ? 0.25 : 1;
    if (this.mode === 'play' && !this.won) {
      this.stats.time += dt;
      this.acc += dt * scale;
      let n = 0;
      while (this.acc >= 1 / 60 && n < 4) {
        this.fixedStep(1 / 60, input);
        this.acc -= 1 / 60;
        n++;
        input.jump = false;
      }
      if (n === 4) this.acc = 0;
    }
    this.level.time += dt;
    for (const a of this.level.animated) a(this.level.time, dt * (this.mode === 'build' ? 0.3 : scale));
    syncMeshes(this.level.entities);
    this.player.syncModel(dt * scale);
    this.updateCamera(dt, buildPan);
    this.updateSelectionBox();
  }

  private fixedStep(dt: number, input: PlayerInput) {
    const w = this.level.world;
    this.testClock += dt;

    // Explorer
    const ev = this.player.step(dt, input, this.killY);
    if (ev.launchedBy) {
      this.stats.launches++;
      this.emit(ev.launchedBy === 'spring' ? 'ressort' : 'levier', { v: +(ev.launchSpeed ?? 0).toFixed(1), vin: +(ev.impactSpeed ?? 0).toFixed(1) });
    }
    if (ev.fell) {
      this.stats.falls++;
      this.emit('tombe', {});
      this.player.teleport(this.player.spawn);
      this.cb.toast('Oups ! La gravité t’a rattrapé…');
    }
    const feet = this.player.feet;
    this.stats.maxY = Math.max(this.stats.maxY, feet.y);

    // Springs launch bodies that land on them (collect first: bodies can't be modified inside a query)
    for (const e of this.level.entities) {
      if (!e.spring) continue;
      const t = e.pieces[0].body.translation();
      const touching: RAPIER.RigidBody[] = [];
      w.intersectionsWithShape({ x: t.x, y: t.y + 0.3, z: t.z }, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Cuboid(0.5, 0.2, 0.5), (c) => {
        const b = c.parent();
        if (b && b.isDynamic() && !touching.includes(b)) touching.push(b);
        return true;
      });
      for (const b of touching) {
        const cd = this.springCooldown.get(b.handle) ?? 0;
        if (cd > this.level.time) continue;
        const lv = b.linvel();
        const r = e.pieces[0].body.rotation();
        const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
        const v = new THREE.Vector3(lv.x, lv.y, lv.z);
        const vIn = -v.dot(axis);
        if (vIn < -0.5) continue;
        const out = springBounce(v, axis, Math.max(0, vIn), e.spring.launch);
        b.setLinvel({ x: out.x, y: out.y, z: out.z }, true);
        this.springCooldown.set(b.handle, this.level.time + 0.4);
        this.emit('ressort-objet', { v: +out.length().toFixed(1), label: this.level.entityOfBody(b)?.label ?? 'objet' });
      }
    }

    // Magnets pull metal
    for (const m of this.level.entities) {
      if (!m.magnet) continue;
      const mp = m.pieces[0].body.translation();
      for (const e of this.level.entities) {
        if (!e.metal || e === m) continue;
        const b = e.pieces[0].body;
        if (!b.isDynamic()) continue;
        const p = b.translation();
        const d = new THREE.Vector3(mp.x - p.x, mp.y - p.y, mp.z - p.z);
        const dist = d.length();
        if (dist > m.magnet.range || dist < 0.3) continue;
        const f = Math.min(2200, m.magnet.strength / (dist * dist));
        d.normalize().multiplyScalar(f * dt);
        b.applyImpulse({ x: d.x, y: d.y, z: d.z }, true);
        if (!this.vars['_mag' + e.id]) {
          this.vars['_mag' + e.id] = 1;
          this.emit('aimant', { label: e.label });
        }
      }
    }

    // Rockets
    for (const e of this.level.entities) {
      const rk = e.rocket;
      if (!rk) continue;
      const burning = this.tested && this.testClock > 0.4 && rk.burned < rk.burnTime;
      rk.flame.visible = burning;
      if (!burning) continue;
      rk.burned += dt;
      const b = e.pieces[0].body;
      const q = b.rotation();
      const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
      const imp = { x: dir.x * rk.thrust * dt, y: dir.y * rk.thrust * dt, z: dir.z * rk.thrust * dt };
      // Strapped on along the host's axis: the thrust line goes through the host's centre of mass
      // (no tipping torque). The fixed joint drags the rocket along.
      const host = rk.joint ? rk.host?.pieces[0].body : null;
      if (host) host.applyImpulse(imp, true);
      else b.applyImpulse(imp, true);
      rk.flame.scale.setScalar(0.85 + Math.random() * 0.3);
      if (rk.burned <= dt * 1.5) this.emit('fusee', { f: rk.thrust });
    }

    // Pressure plates
    for (const p of this.level.plates) {
      let load = 0;
      w.intersectionsWithShape({ x: p.pos.x, y: p.pos.y + 0.2, z: p.pos.z }, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Cuboid(p.size * 0.5, 0.18, p.size * 0.5), (c) => {
        const b = c.parent();
        if (b && b.isDynamic()) load += b.mass();
        return true;
      });
      if (Math.abs(feet.x - p.pos.x) < p.size * 0.55 && Math.abs(feet.z - p.pos.z) < p.size * 0.55 && Math.abs(feet.y - p.pos.y) < 0.4) load += PLAYER_MASS;
      p.load = load;
      const was = p.pressed;
      p.pressed = load >= p.minMass;
      if (p.pressed && !was && p.firstPress === null) p.firstPress = this.testClock;
      (p.light.material as THREE.MeshStandardMaterial).emissive.setHex(p.pressed ? 0x5dff8a : 0x2fd8ff);
    }

    this.mission.onStep?.(this.api, dt);
    w.step();

    // Crystals
    const centre = feet.clone().add(new THREE.Vector3(0, 0.85, 0));
    for (const c of this.level.crystals) {
      if (c.taken) continue;
      if (c.mesh.position.distanceTo(centre) < 0.95) {
        c.taken = true;
        c.mesh.visible = false;
        this.stats.crystals++;
        this.cb.toast('💎 Cristal récupéré !');
        this.cb.onChange();
      }
    }

    // Contextual hints
    for (const h of this.mission.hints ?? []) {
      if (this.hinted.has(h.id)) continue;
      if (h.when(this.api, feet)) {
        this.hinted.add(h.id);
        this.cb.hint(h.text);
      }
    }

    // Goal
    if (this.goal && !this.won) {
      const d = new THREE.Vector2(feet.x - this.goal.x, feet.z - this.goal.z).length();
      if (d < 1.5 && Math.abs(feet.y - this.goal.y) < 1.5 && (this.mission.canFinish?.(this.api) ?? true)) this.win();
    }
  }

  private win() {
    this.won = true;
    const allCrystals = this.level.crystals.every((c) => c.taken);
    const bonus = this.mission.bonus.check(this.stats, this.api);
    this.emit('victoire', {});
    this.cb.onWin({ stars: [true, allCrystals, bonus], stats: this.stats });
  }

  // ------------------------------------------------------------------ modes

  enterBuild() {
    if (this.won) return;
    this.mode = 'build';
    this.queriesDirty = true;
    this.buildFocus.copy(this.camTarget);
    this.camDist = Math.max(this.camDist, 13);
    this.cb.onChange();
  }

  /** ▶ Tester: remember the layout, then let physics run. */
  test() {
    if (this.mode !== 'build') return;
    this.select(null);
    this.setTool(null);
    for (const e of this.level.entities) if (e.rocket) this.attachRocket(e, true);
    this.snapshot = {
      bodies: snapshotBodies(this.level.world),
      player: this.player.feet,
      rockets: new Map(this.level.entities.filter((e) => e.rocket).map((e) => [e, 0])),
      vars: { ...this.vars },
    };
    for (const p of this.level.plates) {
      p.firstPress = null;
      p.pressed = false;
    }
    this.mode = 'play';
    this.tested = true;
    this.testClock = 0;
    this.stats.tests++;
    this.mission.onTest?.(this.api);
    this.cb.onChange();
  }

  /** ↺ Réessayer: put everything back where it was when ▶ Tester was pressed. */
  retry() {
    if (!this.snapshot) return;
    restoreBodies(this.snapshot.bodies);
    this.player.teleport(this.snapshot.player);
    for (const [e, burned] of this.snapshot.rockets) if (e.rocket) e.rocket.burned = burned;
    this.vars = { ...this.snapshot.vars };
    for (const p of this.level.plates) {
      p.firstPress = null;
      p.pressed = false;
    }
    this.mission.onRetry?.(this.api);
    syncMeshes(this.level.entities);
    this.queriesDirty = true;
    this.mode = 'build';
    this.tested = false;
    this.cb.onChange();
  }

  respawn() {
    this.player.teleport(this.player.spawn);
  }

  // ------------------------------------------------------------------ what if

  toggleWhatIf(k: WhatIf) {
    if (this.whatIf.has(k)) this.whatIf.delete(k);
    else this.whatIf.add(k);
    this.applyWhatIf();
    this.emit('etsi-' + k, { on: this.whatIf.has(k) ? 1 : 0 });
  }

  applyWhatIf() {
    const w = this.level.world;
    w.gravity = { x: 0, y: this.whatIf.has('gravite') ? G : -G, z: 0 };
    const noFriction = this.whatIf.has('frottement');
    const doubled = this.whatIf.has('masse');
    w.colliders.forEach((c) => {
      if (c.handle === this.player.collider.handle) return;
      if (!this.frictions.has(c.handle)) this.frictions.set(c.handle, c.friction());
      c.setFriction(noFriction ? 0 : this.frictions.get(c.handle)!);
      const b = c.parent();
      if (b && b.isDynamic()) {
        if (!this.masses.has(c.handle)) this.masses.set(c.handle, c.mass());
        c.setMass(this.masses.get(c.handle)! * (doubled ? 2 : 1));
      }
    });
    w.bodies.forEach((b) => b.wakeUp());
  }

  // ------------------------------------------------------------------ build

  setTool(k: PartKind | null) {
    this.tool = k;
    if (this.ghost) {
      this.level.root.remove(this.ghost);
      this.ghost = null;
    }
    if (k) {
      this.select(null);
      this.ghost = ghostMesh(k);
      this.ghost.visible = false;
      this.level.root.add(this.ghost);
    }
    this.cb.onChange();
  }

  select(e: Entity | null) {
    this.selected = e;
    if (this.selBox) {
      this.level.root.remove(this.selBox);
      this.selBox.geometry.dispose();
      this.selBox = null;
    }
    if (e) {
      const h = e.half;
      const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(h.x * 2 + 0.12, h.y * 2 + 0.12, h.z * 2 + 0.12));
      this.selBox = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x7fe9ff }));
      this.level.root.add(this.selBox);
      this.updateSelectionBox();
    }
    this.cb.onChange();
  }

  private updateSelectionBox() {
    if (!this.selBox || !this.selected) return;
    const p = this.selected.pieces[0].mesh;
    this.selBox.position.copy(p.position);
    this.selBox.quaternion.copy(p.quaternion);
    this.selBox.visible = this.mode === 'build';
  }

  /**
   * Rapier only refreshes its scene queries during a step. While time is frozen we run a
   * near-zero step and put velocities back, so ray picking sees what was just placed or moved.
   */
  private refreshQueries() {
    const w = this.level.world;
    const vels: [RAPIER.RigidBody, RAPIER.Vector, RAPIER.Vector][] = [];
    w.bodies.forEach((b) => {
      if (b.isDynamic()) vels.push([b, { ...b.linvel() }, { ...b.angvel() }]);
    });
    w.propagateModifiedBodyPositionsToColliders();
    const dt = w.timestep;
    w.timestep = 1e-6;
    w.step();
    w.timestep = dt;
    for (const [b, lv, av] of vels) {
      b.setLinvel(lv, false);
      b.setAngvel(av, false);
    }
    this.queriesDirty = false;
  }

  queriesDirty = true;

  /** Physics ray from a screen point, ignoring the explorer and optionally one entity. */
  pick(ndc: THREE.Vector2, ignore: Entity | null = null) {
    if (this.queriesDirty) this.refreshQueries();
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.r.camera);
    const o = rc.ray.origin;
    const d = rc.ray.direction;
    const ray = new RAPIER.Ray({ x: o.x, y: o.y, z: o.z }, { x: d.x, y: d.y, z: d.z });
    const skip = new Set<number>();
    if (ignore) for (const p of ignore.pieces) skip.add(p.body.handle);
    const hit = this.level.world.castRayAndGetNormal(ray, 300, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.player.collider, undefined, (c) => {
      if (this.level.unpickable.has(c.handle)) return false;
      const b = c.parent();
      return !b || !skip.has(b.handle);
    });
    if (!hit) return null;
    const point = new THREE.Vector3(o.x + d.x * hit.timeOfImpact, o.y + d.y * hit.timeOfImpact, o.z + d.z * hit.timeOfImpact);
    return { point, normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z), entity: this.level.entityOfBody(hit.collider.parent()) };
  }

  /** Tilt (about z) that puts a cart's front and back wheels on the ground around `p`. */
  private slopeTilt(p: THREE.Vector3, yaw = 0) {
    const w = this.level.world;
    const dir = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const groundY = (q: THREE.Vector3) => {
      const hit = w.castRay(new RAPIER.Ray({ x: q.x, y: p.y + 2, z: q.z }, { x: 0, y: -1, z: 0 }), 5, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC, undefined, this.player.collider, undefined, (c) => !this.level.unpickable.has(c.handle));
      return hit ? p.y + 2 - hit.timeOfImpact : null;
    };
    const f = groundY(p.clone().addScaledVector(dir, 0.65));
    const b = groundY(p.clone().addScaledVector(dir, -0.65));
    if (f === null || b === null) return 0;
    return Math.atan2(f - b, 1.3);
  }

  /** Height from the root centre to the bottom of an entity for a given orientation. */
  private halfHeight(e: { half: THREE.Vector3; part: PartKind | null; bottom?: number }, yaw: number, tilt: number) {
    if (e.part === 'chariot') return 0.5 / Math.max(0.5, Math.cos(tilt)) + Math.abs(Math.sin(tilt)) * 0.3;
    if (e.bottom !== undefined) return e.bottom / Math.max(0.5, Math.cos(tilt));
    const m = new THREE.Matrix4().makeRotationFromQuaternion(quatFromYawTilt(yaw, tilt)).elements;
    // world-Y extent of an oriented box = sum |R(1,j)| * half_j
    return Math.abs(m[1]) * e.half.x + Math.abs(m[5]) * e.half.y + Math.abs(m[9]) * e.half.z;
  }

  private rootFromSurface(e: { half: THREE.Vector3; part: PartKind | null }, point: THREE.Vector3, normal: THREE.Vector3, yaw: number, tilt: number, lift: number) {
    if (normal.y > 0.45) return new THREE.Vector3(point.x, point.y + this.halfHeight(e, yaw, tilt) + 0.02 + lift, point.z);
    const out = Math.max(e.half.x, e.half.z) + 0.05;
    return point.clone().addScaledVector(normal.setY(0).normalize(), out).add(new THREE.Vector3(0, lift, 0));
  }

  /**
   * Where a screen point lands for placing things. Tapping the side of a cliff snaps to its top edge.
   * When dragging (`keepY` set), the object glides at the same height over gaps instead of dropping.
   */
  surface(ndc: THREE.Vector2, ignore: Entity | null = null, keepY: number | null = null) {
    let hit: { point: THREE.Vector3; normal: THREE.Vector3 } | null = this.pick(ndc, ignore);
    if (hit && hit.normal.y < 0.45) {
      // Side of something: snap to its top (when dragging, only for low edges like a track or a crate)
      const top = this.topAbove(hit.point, hit.normal);
      hit = top && (keepY === null || top.point.y - hit.point.y < 1.0) ? top : keepY === null ? hit : null;
    }
    if (keepY !== null && (!hit || hit.normal.y < 0.45 || hit.point.y > keepY + 3.2)) {
      // Glide at the same height (over a gap, for instance)
      const rc = new THREE.Raycaster();
      rc.setFromCamera(ndc, this.r.camera);
      const p = new THREE.Vector3();
      if (rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -keepY), p)) return { point: p, normal: new THREE.Vector3(0, 1, 0) };
      return null;
    }
    return hit;
  }

  /** The top surface right above a point on the side of an obstacle. */
  private topAbove(point: THREE.Vector3, normal: THREE.Vector3) {
    const probe = point.clone().addScaledVector(normal.clone().setY(0).normalize(), -0.15);
    const down = this.level.world.castRayAndGetNormal(
      new RAPIER.Ray({ x: probe.x, y: probe.y + 30, z: probe.z }, { x: 0, y: -1, z: 0 }),
      40,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      this.player.collider,
      undefined,
      (c) => !this.level.unpickable.has(c.handle),
    );
    if (!down || down.normal.y <= 0.45) return null;
    const y = probe.y + 30 - down.timeOfImpact;
    if (y < point.y - 0.01) return null;
    return { point: new THREE.Vector3(probe.x, y, probe.z), normal: new THREE.Vector3(down.normal.x, down.normal.y, down.normal.z) };
  }

  hover(ndc: THREE.Vector2) {
    if (!this.ghost || !this.tool) return;
    const hit = this.surface(ndc);
    if (!hit) {
      this.ghost.visible = false;
      return;
    }
    const probe = { half: this.partHalf(this.tool), part: this.tool };
    const pos = this.rootFromSurface(probe, hit.point, hit.normal, 0, 0, 0);
    this.ghost.position.copy(pos);
    this.ghost.visible = true;
  }

  private partHalf(k: PartKind) {
    const h: Record<PartKind, [number, number, number]> = {
      planche: [3, 0.06, 0.4], caisse: [0.5, 0.5, 0.5], boulet: [0.35, 0.35, 0.35], ballon: [0.35, 0.35, 0.35], enclume: [0.45, 0.275, 0.25],
      chariot: [0.95, 0.5, 0.78], ressort: [0.6, 0.14, 0.6], aimant: [0.5, 0.4, 0.2], fusee: [0.6, 0.17, 0.17],
    };
    return new THREE.Vector3(...h[k]);
  }

  /** A tap in build mode: place the current tool, or select what was tapped. */
  tap(ndc: THREE.Vector2) {
    if (this.mode !== 'build') return;
    if (this.tool) {
      if ((this.inventory[this.tool] ?? 0) <= 0) return;
      const hit = this.surface(ndc);
      if (!hit) return;
      const kind = this.tool;
      const probe = { half: this.partHalf(kind), part: kind };
      // Wheeled things sit along the slope they are put on
      const tilt = kind === 'chariot' ? this.slopeTilt(hit.point) : 0;
      const pos = this.rootFromSurface(probe, hit.point, hit.normal, 0, tilt, 0);
      const e = createPart(this.level, kind, pos, 0, tilt);
      this.queriesDirty = true;
      this.bases.set(e.id, hit.point.clone());
      this.inventory[kind]! -= 1;
      this.placed.push(e);
      this.stats.partsUsed++;
      if (this.whatIf.size) this.applyWhatIf();
      if (e.rocket) this.attachRocket(e, false);
      const left = this.inventory[kind]!;
      this.setTool(left > 0 ? kind : null);
      this.select(e);
      this.emit('pose-' + kind, {});
      return;
    }
    const hit = this.pick(ndc);
    const e = hit?.entity;
    this.select(e && e.movable ? e : null);
  }

  /** Move the selected entity onto the surface under a screen point. */
  dragTo(ndc: THREE.Vector2) {
    const e = this.selected;
    if (!e || this.mode !== 'build') return;
    const prevBase = this.bases.get(e.id);
    const hit = this.surface(ndc, e, prevBase ? prevBase.y : e.pieces[0].body.translation().y - this.halfHeight(e, e.yaw, e.tilt));
    if (!hit) return;
    this.bases.set(e.id, hit.point.clone());
    if (e.part === 'chariot' || e.followSlope) e.tilt = this.slopeTilt(hit.point, e.yaw);
    const pos = this.rootFromSurface(e, hit.point, hit.normal.clone(), e.yaw, e.tilt, e.lift);
    this.moveEntity(e, pos);
  }

  private moveEntity(e: Entity, pos: THREE.Vector3) {
    if (e.lockZ !== undefined) pos.z = e.lockZ;
    e.pos.copy(pos);
    this.queriesDirty = true;
    setEntityTransform(e, pos, quatFromYawTilt(e.yaw, e.tilt));
    // Rockets strapped on it follow
    if (!e.rocket) this.layoutRockets(e);
    if (e.rocket) this.attachRocket(e, false);
    syncMeshes(this.level.entities);
  }

  /** Re-seat the selected entity after a rotation or height change. */
  private reseat(e: Entity) {
    const base = this.bases.get(e.id);
    const t = e.pieces[0].body.translation();
    const pos = base ? new THREE.Vector3(t.x, base.y + this.halfHeight(e, e.yaw, e.tilt) + 0.02 + e.lift, t.z) : new THREE.Vector3(t.x, t.y, t.z);
    this.moveEntity(e, pos);
  }

  rotateSelected(deg: number) {
    const e = this.selected;
    if (!e || e.lockZ !== undefined) return;
    e.yaw += (deg * Math.PI) / 180;
    this.reseat(e);
  }

  tiltSelected(deg: number) {
    const e = this.selected;
    if (!e) return;
    e.tilt = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, e.tilt + (deg * Math.PI) / 180));
    this.reseat(e);
  }

  liftSelected(d: number) {
    const e = this.selected;
    if (!e) return;
    if (!this.bases.has(e.id)) {
      const t = e.pieces[0].body.translation();
      this.bases.set(e.id, new THREE.Vector3(t.x, t.y - this.halfHeight(e, e.yaw, e.tilt) - 0.02, t.z));
    }
    e.lift = Math.max(0, Math.min(MAX_LIFT, Math.round((e.lift + d) * 10) / 10));
    this.reseat(e);
    this.cb.onChange();
  }

  removeSelected() {
    const e = this.selected;
    if (!e || !e.fromInventory || !e.part) return;
    this.select(null);
    this.level.removeEntity(e);
    this.queriesDirty = true;
    this.placed = this.placed.filter((p) => p !== e);
    this.inventory[e.part] = (this.inventory[e.part] ?? 0) + 1;
    this.stats.partsUsed = Math.max(0, this.stats.partsUsed - 1);
    this.cb.onChange();
  }

  /** Strap a rocket to the nearest dynamic object (fixed joint), if one is close enough. */
  private attachRocket(e: Entity, makeJoint: boolean) {
    const rk = e.rocket!;
    const w = this.level.world;
    if (rk.joint) {
      w.removeImpulseJoint(rk.joint, true);
      rk.joint = null;
    }
    const rb = e.pieces[0].body;
    const rp = rb.translation();
    let best: Entity | null = null;
    let bestD = 2;
    for (const o of this.level.entities) {
      if (o === e || o.rocket || o.fixed) continue;
      for (const p of o.pieces) {
        if (!p.body.isDynamic()) continue;
        const t = p.body.translation();
        // Carts are what rockets are meant for; small loose things (a ball, the core) come last
        const bias = o.part === 'chariot' ? -1 : Math.max(o.half.x, o.half.z) < 0.45 ? 1 : 0;
        const d = Math.hypot(t.x - rp.x, t.y - rp.y, t.z - rp.z) + bias;
        if (d < bestD && p === o.pieces[0]) {
          bestD = d;
          best = o;
        }
      }
    }
    rk.host = best;
    if (best && !makeJoint) this.layoutRockets(best);
    if (!best || !makeJoint) return;
    const hb = best.pieces[0].body;
    const ht = hb.translation();
    const hr = hb.rotation();
    const hq = new THREE.Quaternion(hr.x, hr.y, hr.z, hr.w);
    const inv = hq.clone().invert();
    const rr = rb.rotation();
    const local = new THREE.Vector3(rp.x - ht.x, rp.y - ht.y, rp.z - ht.z).applyQuaternion(inv);
    const frame = inv.clone().multiply(new THREE.Quaternion(rr.x, rr.y, rr.z, rr.w));
    const jd = RAPIER.JointData.fixed(
      { x: local.x, y: local.y, z: local.z },
      { x: frame.x, y: frame.y, z: frame.z, w: frame.w },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0, w: 1 },
    );
    rk.joint = w.createImpulseJoint(jd, hb, rb, true);
    rk.joint.setContactsEnabled(false);
  }

  /**
   * Snap the rockets strapped on a host to its back, pointing forward (+x of the host),
   * centred or side by side: an off-centre thrust would just spin the host round.
   */
  private layoutRockets(host: Entity) {
    const rockets = this.level.entities.filter((o) => o.rocket?.host === host);
    const hb = host.pieces[0].body;
    const ht = hb.translation();
    const hr = hb.rotation();
    const hq = new THREE.Quaternion(hr.x, hr.y, hr.z, hr.w);
    const back = -(host.half.x + 0.62);
    rockets.forEach((o, i) => {
      const z = rockets.length === 1 ? 0 : (i - (rockets.length - 1) / 2) * 0.36;
      const pos = new THREE.Vector3(back, 0.05, z).applyQuaternion(hq).add(new THREE.Vector3(ht.x, ht.y, ht.z));
      o.yaw = host.yaw;
      o.tilt = host.tilt;
      o.pos.copy(pos);
      setEntityTransform(o, pos, hq);
    });
    if (rockets.length) {
      syncMeshes(rockets);
      this.queriesDirty = true;
    }
  }

  // ------------------------------------------------------------------ camera

  orbit(dx: number, dy: number) {
    this.camYaw -= dx * 0.006;
    this.camPitch = Math.max(-0.1, Math.min(1.3, this.camPitch + dy * 0.005));
  }

  zoom(f: number) {
    this.camDist = Math.max(4, Math.min(40, this.camDist * f));
  }

  private updateCamera(dt: number, pan: THREE.Vector2) {
    const cam = this.r.camera;
    if (this.mode === 'build') {
      if (pan.lengthSq() > 0.001) {
        const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
        const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
        const speed = 10 * dt * (this.camDist / 12);
        this.buildFocus.addScaledVector(right, pan.x * speed).addScaledVector(fwd, pan.y * speed);
      }
      this.camTarget.lerp(this.buildFocus, 1 - Math.exp(-dt * 8));
    } else {
      const f = this.player.feet;
      const want = new THREE.Vector3(f.x, f.y + 1.3, f.z);
      this.camTarget.lerp(want, 1 - Math.exp(-dt * 6));
      this.camDist += (Math.min(this.camDist, 22) - this.camDist) * 0.05;
    }
    const off = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), Math.cos(this.camYaw) * Math.cos(this.camPitch)).multiplyScalar(this.camDist);
    cam.position.copy(this.camTarget).add(off);
    cam.lookAt(this.camTarget);
    this.r.followShadow(this.camTarget);
  }

  /** Converts a joystick vector (x right, y up) into a world direction relative to the camera. */
  cameraRelative(v: THREE.Vector2) {
    const fwd = new THREE.Vector2(-Math.sin(this.camYaw), -Math.cos(this.camYaw));
    const right = new THREE.Vector2(-fwd.y, fwd.x);
    return new THREE.Vector2(right.x * v.x + fwd.x * v.y, right.y * v.x + fwd.y * v.y);
  }

  liftOf(e: Entity | null) {
    return e ? e.lift : 0;
  }

  massLabel(e: Entity) {
    const m = e.part ? PARTS[e.part].mass : e.mass;
    return m > 0 ? `${e.label} · ${m * (this.whatIf.has('masse') ? 2 : 1)} kg` : e.label;
  }
}
