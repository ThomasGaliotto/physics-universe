import * as THREE from 'three';

/** Small procedural canvas textures, so the game ships without image assets. */
function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

function rand(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const woodTex = canvasTexture(256, (g, s) => {
  g.fillStyle = '#c98a4b';
  g.fillRect(0, 0, s, s);
  const r = rand(7);
  for (let i = 0; i < 46; i++) {
    const y = r() * s;
    g.strokeStyle = `rgba(${90 + r() * 40},${50 + r() * 20},20,${0.25 + r() * 0.3})`;
    g.lineWidth = 1 + r() * 3;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 3);
    g.stroke();
  }
  // plank seams
  g.fillStyle = 'rgba(70,35,15,0.55)';
  for (let k = 1; k < 4; k++) g.fillRect(0, (k * s) / 4 - 1, s, 2);
});

const crateTex = canvasTexture(256, (g, s) => {
  g.drawImage(woodTex.image as HTMLCanvasElement, 0, 0);
  g.strokeStyle = '#6b3d1c';
  g.lineWidth = 26;
  g.strokeRect(13, 13, s - 26, s - 26);
  g.lineWidth = 22;
  g.beginPath();
  g.moveTo(20, 20);
  g.lineTo(s - 20, s - 20);
  g.stroke();
  g.fillStyle = '#d9b26f';
  for (const [x, y] of [[13, 13], [s - 13, 13], [13, s - 13], [s - 13, s - 13]]) {
    g.beginPath();
    g.arc(x, y, 6, 0, Math.PI * 2);
    g.fill();
  }
});

const grassTex = canvasTexture(256, (g, s) => {
  g.fillStyle = '#6fc24a';
  g.fillRect(0, 0, s, s);
  const r = rand(3);
  for (let i = 0; i < 900; i++) {
    const v = r();
    g.fillStyle = v < 0.5 ? 'rgba(90,170,55,0.7)' : v < 0.85 ? 'rgba(140,215,90,0.6)' : 'rgba(250,240,150,0.6)';
    g.fillRect(r() * s, r() * s, 2 + r() * 3, 2 + r() * 3);
  }
}, 1);

const rockTex = canvasTexture(256, (g, s) => {
  g.fillStyle = '#a07a5e';
  g.fillRect(0, 0, s, s);
  const r = rand(11);
  for (let i = 0; i < 26; i++) {
    const y = r() * s;
    g.fillStyle = `rgba(${120 + r() * 60},${85 + r() * 40},${70 + r() * 30},0.55)`;
    g.fillRect(0, y, s, 4 + r() * 18);
  }
  for (let i = 0; i < 400; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(60,40,30,0.25)' : 'rgba(255,230,200,0.15)';
    g.fillRect(r() * s, r() * s, 3, 3);
  }
});

const metalTex = canvasTexture(128, (g, s) => {
  g.fillStyle = '#6d7480';
  g.fillRect(0, 0, s, s);
  const r = rand(5);
  for (let i = 0; i < 300; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
    g.fillRect(r() * s, r() * s, 2, 2);
  }
});

export const MAT = {
  grass: new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }),
  rock: new THREE.MeshStandardMaterial({ map: rockTex, roughness: 0.9, flatShading: true }),
  rockDark: new THREE.MeshStandardMaterial({ color: 0x7a5a4a, roughness: 0.95, flatShading: true }),
  wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.75 }),
  crate: new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.8 }),
  metal: new THREE.MeshStandardMaterial({ map: metalTex, color: 0x9aa3b0, roughness: 0.35, metalness: 0.85 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.4, metalness: 0.8 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.3, metalness: 0.9 }),
  red: new THREE.MeshStandardMaterial({ color: 0xd8332f, roughness: 0.45 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.9 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xb9ad9c, roughness: 0.85, flatShading: true }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x4fae4a, roughness: 0.85, flatShading: true }),
  leafLight: new THREE.MeshStandardMaterial({ color: 0x8fd35a, roughness: 0.85, flatShading: true }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x7a5236, roughness: 0.9, flatShading: true }),
  glow: new THREE.MeshStandardMaterial({ color: 0x46e6ff, emissive: 0x2fd8ff, emissiveIntensity: 2.2, roughness: 0.3 }),
  glowGold: new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb830, emissiveIntensity: 2.0, roughness: 0.3 }),
  crystal: new THREE.MeshStandardMaterial({ color: 0xc86bff, emissive: 0x9b2cff, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.2, flatShading: true }),
  water: new THREE.MeshStandardMaterial({ color: 0xbfeaff, emissive: 0x4fb8ff, emissiveIntensity: 0.35, transparent: true, opacity: 0.75, roughness: 0.1 }),
};

/** Texture whose UVs we scale to keep a constant texel density on boxes of any size. */
export function boxGeometry(w: number, h: number, d: number, texScale = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i));
    const ny = Math.abs(n.getY(i));
    const [a, b] = nx > 0.5 ? [d, h] : ny > 0.5 ? [w, d] : [w, h];
    uv.setXY(i, (uv.getX(i) * a) / texScale, (uv.getY(i) * b) / texScale);
  }
  return g;
}

export function shadowed<T extends THREE.Object3D>(o: T, cast = true, receive = true): T {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = cast;
      c.receiveShadow = receive;
    }
  });
  return o;
}
