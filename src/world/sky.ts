import * as THREE from 'three';
import { LOW_POWER } from '../core/render';
import { MAT } from './materials';
import { makeTree } from '../core/level';

/**
 * The Terra backdrop: a sunset gradient sky, a ringed planet, a sea of clouds
 * and distant floating islands with waterfalls. Purely decorative, no physics.
 */
export function createSky(scene: THREE.Scene) {
  const group = new THREE.Group();
  scene.add(group);

  // Gradient dome
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x2d3c9a) },
      mid: { value: new THREE.Color(0x8fa6ff) },
      horizon: { value: new THREE.Color(0xffc2c8) },
      sunDir: { value: new THREE.Vector3(0.55, 0.18, 0.8).normalize() },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        float h = vDir.y;
        vec3 c = mix(horizon, mid, smoothstep(-0.05, 0.25, h));
        c = mix(c, top, smoothstep(0.25, 0.85, h));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        c += vec3(1.0, 0.75, 0.45) * pow(s, 24.0) * 0.9 + vec3(1.0,0.6,0.5) * pow(s, 4.0) * 0.25;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat);
  group.add(dome);

  // Ringed planet
  const planetTex = (() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d')!;
    const cols = ['#e9d3ff', '#cdb4f0', '#f5e6ff', '#b99ae0', '#e2c9fb', '#c4a8ec'];
    for (let y = 0; y < 256; y += 8) {
      g.fillStyle = cols[(y / 8) % cols.length | 0];
      g.fillRect(0, y + Math.sin(y) * 2, 512, 10);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const planet = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(60, 48, 32), new THREE.MeshStandardMaterial({ map: planetTex, roughness: 1, fog: false, emissive: 0x3a2a60, emissiveIntensity: 0.4 }));
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(78, 120, 96),
    new THREE.MeshBasicMaterial({ color: 0xf6e6ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: false }),
  );
  ring.rotation.x = Math.PI / 2.3;
  planet.add(ball, ring);
  planet.rotation.z = 0.35;
  planet.position.set(140, 230, 420);
  group.add(planet);

  // Sea of clouds below the islands
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffd9e8, emissiveIntensity: 0.25, flatShading: true });
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  const N = LOW_POWER ? 160 : 340;
  const clouds = new THREE.InstancedMesh(puffGeo, cloudMat, N);
  const m = new THREE.Matrix4();
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 20 + rnd() * 320;
    const s = 8 + rnd() * 18;
    m.compose(
      new THREE.Vector3(Math.cos(a) * r + 30, -38 - rnd() * 10, Math.sin(a) * r),
      new THREE.Quaternion(),
      new THREE.Vector3(s * 1.6, s * 0.6, s),
    );
    clouds.setMatrixAt(i, m);
  }
  group.add(clouds);

  // Distant floating islands
  const far = new THREE.Group();
  const spots: [number, number, number, number][] = [
    [-60, 10, 90, 9], [80, 22, 120, 12], [150, 0, 40, 8], [-40, 30, 170, 14], [10, -4, 140, 7], [190, 35, 160, 16],
    [-120, 18, 30, 10], [110, 8, -80, 9], [-30, 26, -120, 12], [60, -2, 70, 6], [-90, -6, 140, 7], [240, 14, 60, 10],
  ];
  for (const [x, y, z, s] of spots) {
    const isl = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 0.92, s * 0.25, 9), MAT.grass);
    const rock = new THREE.Mesh(new THREE.ConeGeometry(s * 0.95, s * 1.8, 9, 3), MAT.rockDark);
    rock.rotation.x = Math.PI;
    rock.position.y = -s * 1.0;
    isl.add(top, rock);
    for (let k = 0; k < 4; k++) {
      const tr = makeTree(s * 0.25 * (0.6 + rnd() * 0.6), rnd);
      tr.position.set((rnd() - 0.5) * s * 1.2, s * 0.12, (rnd() - 0.5) * s * 1.2);
      isl.add(tr);
    }
    if (rnd() < 0.6) {
      // a tiny tower, like the floating city in the concept art
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.12, s * 0.18, s * 1.4, 8), MAT.stone);
      tower.position.set(s * 0.2, s * 0.8, 0);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(s * 0.2, s * 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x4a6fd8 }));
      roof.position.set(s * 0.2, s * 1.75, 0);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(s * 0.3, s * 0.02, 6, 24), MAT.glow);
      halo.rotation.x = Math.PI / 2;
      halo.position.set(s * 0.2, s * 1.2, 0);
      isl.add(tower, roof, halo);
    }
    if (rnd() < 0.7) {
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.25, s * 2.6), MAT.water);
      fall.position.set(-s * 0.4, -s * 1.2, s * 0.85);
      isl.add(fall);
    }
    isl.position.set(x, y, z);
    far.add(isl);
  }
  group.add(far);

  // Drifting sparkles near the play area
  const sparkGeo = new THREE.BufferGeometry();
  const SP = 180;
  const sp = new Float32Array(SP * 3);
  for (let i = 0; i < SP; i++) {
    sp[i * 3] = (rnd() - 0.5) * 120 + 20;
    sp[i * 3 + 1] = rnd() * 30 - 5;
    sp[i * 3 + 2] = (rnd() - 0.5) * 80;
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xfff3b0, size: 0.12, transparent: true, opacity: 0.8 }));
  group.add(sparks);

  return {
    group,
    update(t: number) {
      planet.rotation.y = t * 0.01;
      far.position.y = Math.sin(t * 0.2) * 1.5;
      sparks.position.y = Math.sin(t * 0.3) * 0.8;
      clouds.position.x = Math.sin(t * 0.02) * 8;
    },
  };
}
