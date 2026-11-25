import './style.css';
import * as THREE from 'three';
import { initPhysics } from './core/physics';
import { Renderer } from './core/render';
import { createSky } from './world/sky';
import { App } from './app';

async function start() {
  await initPhysics();
  const r = new Renderer(document.getElementById('scene') as HTMLCanvasElement);
  const sky = createSky(r.scene);
  const app = new App(r);
  document.getElementById('boot')?.remove();

  // Dev-only playtesting handle (window.__pu) and ?m=terra-3 to jump into a mission
  if (import.meta.env.DEV) {
    (window as unknown as { __pu: App; __THREE: typeof THREE }).__pu = app;
    (window as unknown as { __THREE: typeof THREE }).__THREE = THREE;
    (await import('./dev/harness')).installHarness(app);
    const id = new URLSearchParams(location.search).get('m');
    if (id) {
      const { MISSIONS, SANDBOX } = await import('./missions');
      const m = id === 'sandbox' ? SANDBOX : MISSIONS.find((x) => x.id === id);
      if (m) app.startMission(m);
    }
  }

  let last = performance.now();
  let t = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    app.update(dt);
    sky.update(t);
    r.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

start().catch((e) => {
  const boot = document.getElementById('boot');
  if (boot) boot.querySelector('.boot-sub')!.textContent = 'Impossible de démarrer : ' + (e instanceof Error ? e.message : String(e));
  console.error(e);
});
