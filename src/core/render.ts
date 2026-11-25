import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** Phones and tablets get a lighter pipeline (no bloom, smaller shadow map, capped pixel ratio). */
export const LOW_POWER = matchMedia('(pointer: coarse)').matches;

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);
  readonly sun: THREE.DirectionalLight;
  private composer: EffectComposer | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, LOW_POWER ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene.fog = new THREE.Fog(0xf0c3dd, 140, 700);

    const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6b5a7a, 1.15);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    this.sun.position.set(-30, 50, 25);
    this.sun.castShadow = true;
    const s = LOW_POWER ? 1024 : 2048;
    this.sun.shadow.mapSize.set(s, s);
    const cam = this.sun.shadow.camera;
    cam.left = -32;
    cam.right = 32;
    cam.top = 32;
    cam.bottom = -32;
    cam.near = 1;
    cam.far = 160;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    if (!LOW_POWER) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.35, 0.5, 0.97));
      this.composer.addPass(new OutputPass());
    }
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    // Portrait phones need a wider vertical view to keep the scene readable
    this.camera.fov = w < h ? 70 : 55;
    this.camera.updateProjectionMatrix();
  }

  /** Keep the shadow frustum centred on what the player is looking at. */
  followShadow(target: THREE.Vector3) {
    this.sun.target.position.copy(target);
    this.sun.position.set(target.x - 30, target.y + 50, target.z + 25);
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
