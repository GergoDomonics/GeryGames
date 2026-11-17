// Procedural chibi character: big head, small body, every colour slot its own material.
import * as THREE from 'three';

let gradient;
export function toon(color, extra = {}) {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...extra });
}

// Text on a rounded pill, drawn to canvas (never HTML, so peer names are safe).
export function labelSprite(text, color = '#3b2f4a') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.font = '600 64px Fredoka, system-ui, sans-serif';
  const w = Math.min(500, g.measureText(text).width + 60);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath(); g.roundRect((512 - w) / 2, 14, w, 100, 50); g.fill();
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 66, 460);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  s.scale.set(2, 0.5, 1);
  return s;
}

const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};
const cap = (r, theta) => new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI * theta);
const backShell = (r, theta) => new THREE.SphereGeometry(r, 20, 12, Math.PI, Math.PI, 0, Math.PI * theta);
const HEAD_Y = 0.95;

function addHair(head, style, mat) {
  const top = mesh(cap(0.35, style === 'buzz' ? 0.36 : 0.44), mat);
  top.rotation.x = -0.3; // front sits higher than the back, keeps the face clear
  head.add(top);
  if (style === 'spiky') for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, c = mesh(new THREE.ConeGeometry(0.08, 0.2, 6), mat, Math.cos(a) * 0.17, 0.3, Math.sin(a) * 0.17 - 0.05);
    c.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    head.add(c);
  }
  if (style === 'bob' || style === 'long') {
    const back = mesh(backShell(0.37, style === 'long' ? 0.8 : 0.66), mat);
    back.material.side = THREE.DoubleSide;
    if (style === 'long') back.scale.set(1, 1.3, 1);
    head.add(back);
  }
  if (style === 'bun') head.add(mesh(new THREE.SphereGeometry(0.13, 14, 10), mat, 0, 0.32, -0.16));
}

function addAccessory(a, acc, p) {
  const { head, torso } = a;
  if (acc === 'cap' || acc === 'beanie') {
    const m = toon(p.shirt);
    const dome = mesh(cap(0.37, 0.42), m);
    dome.rotation.x = -0.25;
    head.add(dome);
    if (acc === 'cap') {
      const brim = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 20), m, 0, 0.16, 0.3);
      brim.rotation.x = 0.15;
      head.add(brim);
    } else head.add(mesh(new THREE.SphereGeometry(0.08, 12, 8), toon('#ffffff'), 0, 0.38, -0.05));
  }
  if (acc === 'glasses') {
    const m = toon('#222222');
    for (const x of [-0.12, 0.12]) head.add(mesh(new THREE.TorusGeometry(0.075, 0.015, 6, 16), m, x, 0, 0.32));
    head.add(mesh(new THREE.BoxGeometry(0.1, 0.015, 0.015), m, 0, 0, 0.33));
  }
  if (acc === 'crown') {
    const m = toon('#ffcc33');
    head.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 16, 1, true), m, 0, 0.33, -0.03));
    for (let i = 0; i < 5; i++) {
      const t = (i / 5) * Math.PI * 2;
      head.add(mesh(new THREE.ConeGeometry(0.04, 0.09, 4), m, Math.cos(t) * 0.17, 0.42, Math.sin(t) * 0.17 - 0.03));
    }
  }
  if (acc === 'flower') {
    const f = new THREE.Group();
    f.position.set(0.24, 0.2, 0.12);
    const petal = toon('#ff8fc8');
    for (let i = 0; i < 5; i++) {
      const t = (i / 5) * Math.PI * 2;
      f.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), petal, Math.cos(t) * 0.06, Math.sin(t) * 0.06, 0));
    }
    f.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), toon('#ffd43b'), 0, 0, 0.02));
    f.rotation.y = 0.9;
    head.add(f);
  }
  if (acc === 'backpack') {
    const bag = mesh(new THREE.CapsuleGeometry(0.14, 0.12, 4, 10), toon(p.pants), 0, 0, -0.2);
    bag.scale.z = 0.6;
    torso.add(bag);
  }
}

// profile -> Group with userData.parts for animate(). Feet at y=0, facing +z.
export function buildCharacter(p) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = toon(p.skin), shirt = toon(p.shirt), pants = toon(p.pants), shoes = toon(p.shoes);

  const leg = x => {
    const g = new THREE.Group();
    g.position.set(x, 0.3, 0);
    g.add(mesh(new THREE.CapsuleGeometry(0.085, 0.14, 4, 10), pants, 0, -0.13, 0));
    const shoe = mesh(new THREE.SphereGeometry(0.1, 12, 8), shoes, 0, -0.27, 0.03);
    shoe.scale.set(1, 0.6, 1.3);
    g.add(shoe);
    body.add(g);
    return g;
  };
  const arm = x => {
    const g = new THREE.Group();
    g.position.set(x, 0.62, 0);
    g.add(mesh(new THREE.CapsuleGeometry(0.06, 0.16, 4, 10), shirt, 0, -0.1, 0));
    g.add(mesh(new THREE.SphereGeometry(0.065, 10, 8), skin, 0, -0.24, 0));
    g.rotation.z = Math.sign(x) * 0.25;
    body.add(g);
    return g;
  };
  const torso = mesh(new THREE.CapsuleGeometry(0.19, 0.16, 4, 14), shirt, 0, 0.47, 0);
  body.add(torso);
  const head = new THREE.Group();
  head.position.y = HEAD_Y;
  head.add(mesh(new THREE.SphereGeometry(0.33, 24, 16), skin));
  const eye = toon('#222222'), shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  for (const x of [-0.12, 0.12]) {
    const e = mesh(new THREE.SphereGeometry(0.05, 12, 8), eye, x, 0, 0.29);
    e.scale.set(0.8, 1.15, 0.6);
    head.add(e);
    head.add(mesh(new THREE.SphereGeometry(0.016, 6, 4), shine, x + 0.015, 0.025, 0.325));
    const cheek = mesh(new THREE.SphereGeometry(0.045, 10, 6), toon('#ff9aa8'), x * 1.55, -0.08, 0.26);
    cheek.scale.set(1, 0.55, 0.4);
    head.add(cheek);
  }
  const smile = mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 12, Math.PI), eye, 0, -0.08, 0.315);
  smile.rotation.z = Math.PI;
  head.add(smile);
  const mouth = mesh(new THREE.SphereGeometry(0.045, 12, 8), toon('#6b2433'), 0, -0.095, 0.3); // opens when singing
  mouth.scale.set(1, 0.01, 0.4);
  mouth.visible = false;
  head.add(mouth);
  body.add(head);

  const parts = { body, head, torso, smile, mouth, legL: leg(-0.1), legR: leg(0.1), armL: arm(-0.26), armR: arm(0.26) };
  addHair(head, p.hairStyle, toon(p.hair)); // hats are a bit bigger and sit over it
  addAccessory(parts, p.acc, p);
  root.userData.parts = parts;
  return root;
}

export function disposeCharacter(root) {
  root.removeFromParent();
  root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
}

// state: {t, speed 0..1, vy, grounded, wave, sing 0..1 (mouth + bounce), cheer (arms up)}
export function animateCharacter(root, { t, speed = 0, vy = 0, grounded = true, wave = false, sing = 0, cheer = false }) {
  const { body, head, legL, legR, armL, armR, smile, mouth } = root.userData.parts;
  smile.visible = sing < 0.08;
  mouth.visible = !smile.visible;
  mouth.scale.y = 0.3 + sing * 1.1;
  const swing = Math.sin(t * 11) * 0.7 * speed;
  legL.rotation.x = grounded ? swing : -0.5;
  legR.rotation.x = grounded ? -swing : 0.3;
  armL.rotation.x = grounded ? -swing : -2.4;
  armR.rotation.x = wave ? -2.6 : grounded ? swing : -2.4;
  armR.rotation.z = wave ? -0.4 + Math.sin(t * 14) * 0.5 : 0.25;
  armL.rotation.z = -0.25;
  if (cheer) { armL.rotation.set(-2.7, 0, 0.3 + Math.sin(t * 8) * 0.2); armR.rotation.set(-2.7, 0, -0.3 - Math.sin(t * 8) * 0.2); }
  body.position.y = grounded ? Math.abs(Math.sin(t * 11)) * 0.05 * speed + Math.abs(Math.sin(t * 7)) * 0.08 * sing : 0;
  const stretch = grounded ? 1 + Math.sin(t * 2.2) * 0.015 : 1 + THREE.MathUtils.clamp(vy * 0.02, -0.12, 0.15);
  body.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
  head.rotation.z = Math.sin(t * 1.3) * 0.04;
}
