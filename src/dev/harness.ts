/* Dev-only scripted playtesting helpers, exposed as window.H (never bundled in production). */
import * as THREE from 'three';
import type { App } from '../app';
import { MISSIONS, SANDBOX } from '../missions';
import { RAPIER, type Entity, type PartKind } from '../core/physics';

export function installHarness(app: App) {
  const V = (x = 0, y = 0) => new THREE.Vector2(x, y);
  const H = {
    R: RAPIER,
    get g() {
      return app.game!;
    },
    step(n: number, mx = 0, mz = 0, jumpFirst = false) {
      for (let i = 0; i < n; i++) {
        this.g.update(1 / 60, { move: V(mx, mz), jump: jumpFirst && i === 0 }, V());
        if (this.g.won) break;
      }
      return this.f();
    },
    f() {
      const p = this.g.player.feet;
      return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];
    },
    /** Walk along x, jumping when passing each x in `xs` (if grounded). */
    walkJump(xs: number[], mz = 0, maxFrames = 2400, dirX = 1) {
      const g = this.g;
      let k = 0;
      const log: string[] = [];
      for (let i = 0; i < maxFrames; i++) {
        const f = g.player.feet;
        let jump = false;
        if (k < xs.length && (dirX > 0 ? f.x > xs[k] : f.x < xs[k]) && g.player.grounded) {
          jump = true;
          k++;
          log.push('J@' + f.x.toFixed(2));
        }
        g.update(1 / 60, { move: V(dirX, mz), jump }, V());
        if (g.won) {
          log.push('WON t=' + g.stats.time.toFixed(1));
          break;
        }
      }
      log.push(`feet=${this.f()} falls=${g.stats.falls} crystals=${g.stats.crystals} maxY=${g.stats.maxY.toFixed(2)}`);
      return log;
    },
    /** Walk toward a point (x,z) on the ground. */
    goTo(x: number, z: number, maxFrames = 1200) {
      for (let i = 0; i < maxFrames; i++) {
        const f = this.g.player.feet;
        const d = V(x - f.x, z - f.z);
        if (d.length() < 0.15) break;
        this.g.update(1 / 60, { move: d.length() > 1 ? d.normalize() : d, jump: false }, V());
      }
      return this.f();
    },
    ndc(x: number, y: number, z: number) {
      this.g.update(0.016, { move: V(), jump: false }, V());
      const v = new THREE.Vector3(x, y, z).project((app as unknown as { r: { camera: THREE.Camera } }).r.camera);
      return V(v.x, v.y);
    },
    focus(x: number, y: number, z: number) {
      const g = this.g as unknown as { buildFocus: THREE.Vector3 };
      g.buildFocus.set(x, y, z);
      for (let i = 0; i < 60; i++) this.g.update(1 / 60, { move: V(), jump: false }, V());
    },
    place(kind: PartKind, x: number, y: number, z: number): Entity | null {
      const g = this.g;
      if (g.mode !== 'build') g.enterBuild();
      this.focus(x, y + 1, z);
      g.setTool(kind);
      g.tap(this.ndc(x, y, z));
      return g.selected;
    },
    /** Select an existing entity by tapping it. */
    pickAt(x: number, y: number, z: number) {
      const g = this.g;
      if (g.mode !== 'build') g.enterBuild();
      this.focus(x, y, z);
      g.tap(this.ndc(x, y, z));
      return g.selected;
    },
    moveSelTo(x: number, y: number, z: number) {
      this.focus(x, y + 1, z);
      this.g.dragTo(this.ndc(x, y, z));
      return this.g.selected ? this.pos(this.g.selected) : null;
    },
    /** Teleport an entity (test setup only). */
    setPos(e: Entity, x: number, y: number, z: number) {
      e.pieces.forEach((p) => {
        const t = p.body.translation();
        const r = e.pieces[0].body.translation();
        p.body.setTranslation({ x: x + t.x - r.x, y: y + t.y - r.y, z: z + t.z - r.z }, true);
      });
      this.g.queriesDirty = true;
    },
    pos(e: Entity) {
      const t = e.pieces[0].body.translation();
      return [+t.x.toFixed(2), +t.y.toFixed(2), +t.z.toFixed(2)];
    },
    byTag(tag: string) {
      return this.g.level.entities.find((e) => e.tag === tag)!;
    },
    load(id: string) {
      const m = MISSIONS.find((x) => x.id === id) ?? SANDBOX;
      app.startMission(m);
      document.querySelector('.modal')?.remove();
      return this.g.mission.id;
    },
    insights() {
      return this.g.insights.map((i) => i.key + JSON.stringify(i.data));
    },
  };
  (window as unknown as { H: typeof H }).H = H;
}
