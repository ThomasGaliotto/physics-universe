# Physics Universe

A 3D physics puzzle game for the browser, designed for iPhone (Safari) first. You play an explorer on floating islands: walk around, then switch to build mode to place planks, crates, springs, rockets… and test your idea. Every object is really simulated (Rapier rigid-body physics, SI units, g = 9.81 m/s²). The **💡 Comprendre** button explains what just happened, with a simple explanation, an animation, the formula and an experiment to try.

**Play:** https://thomasgaliotto.github.io/physics-universe/

The game's interface is in French.

## The prototype

World 1, **Terra** (gravity and forces), with 10 missions:

| # | Mission | Concept |
|---|---------|---------|
| 1 | Premiers pas | Gravity, jumping |
| 2 | La rampe | Inclined plane |
| 3 | Le pont | Supports |
| 4 | Le contrepoids | Centre of mass |
| 5 | La chute | Free fall (mass doesn't change the fall time) |
| 6 | Le ressort | Elastic energy |
| 7 | La catapulte | Levers |
| 8 | La descente | Potential ↔ kinetic energy |
| 9 | Le bloc de fonte | Friction |
| 10 | La fusée | Action and reaction |

There is also a sandbox with every part and every **"Et si… ?"** toggle:
- reversed gravity
- no friction
- slow motion ×0.25
- double mass

Stars, crystals and player levels are saved locally on the device.

The seven other worlds (Velocity, Mechanica, Energon, Magnetika, Electra, Aquaria, Quantum) appear on the map, locked.

## Controls

On a phone:
- Left joystick to walk, ⤒ to jump.
- Drag the scene to turn the camera, pinch to zoom.
- 🔧 opens build mode (time freezes), ▶ runs the test, ↺ puts everything back.

On a keyboard:

| Key | Action |
|-----|--------|
| WASD / arrows | Walk |
| Space | Jump |
| B or Enter | Build mode, then test |
| R | Retry |
| C | Comprendre |

In build mode: T rotates, Y / H tilts, Page Up / Page Down raises and lowers, Delete removes.

Tip: in Safari, *Share → Add to Home Screen* gives a full-screen app.

## Development

```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN)
npm run typecheck
npm run build      # static site in dist/
```

The stack is [three.js](https://threejs.org) for rendering, [Rapier](https://rapier.rs) (WASM) for physics, and Vite + TypeScript, with no UI framework. Every push to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`.

Dev-mode helpers (left out of production builds):
- `?m=terra-3` in the URL jumps straight into a mission.
- `window.H` exposes scripted playtesting helpers (`src/dev/harness.ts`).

```
src/
  core/          renderer, physics helpers, level builder
  world/         procedural materials, sky and backdrop
  explorer.ts    the playable character
  parts.ts       buildable parts (plank, crate, spring, rocket…)
  game.ts        game loop, build mode, camera
  missions.ts    the 10 Terra missions and the sandbox
  understand.ts  "Comprendre" explanations and animations
  app.ts         menus, HUD, modals, input
```

## License

MIT, see [LICENSE](LICENSE).
