// Floating island plaza. Returns {group, colliders, radius, update(t)}.
import * as THREE from 'three';
import { toon } from '../shared/character.js';

export const ISLAND_R = 18;

function rng(seed) { // deterministic so every visit looks the same
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

function sky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#6ec3ff') }, bottom: { value: new THREE.Color('#ffe4f2') } },
    vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 p; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.2, 0.6, p.y)), 1.0); }',
  });
  return new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), mat);
}

const shaded = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };

export function createWorld(scene) {
  const group = new THREE.Group();
  const colliders = [];
  const rand = rng(7);
  scene.add(sky());

  scene.add(new THREE.HemisphereLight('#cfeaff', '#f5c9a6', 1.6));
  const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
  sun.position.set(12, 25, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // island: grass top, earth rim, rocky underside
  const grass = shaded(new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R, ISLAND_R - 0.4, 1, 48), toon('#8fd16a')), false);
  grass.position.y = -0.5;
  group.add(grass);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R - 0.4, ISLAND_R - 1.2, 1.4, 48), toon('#c99a6b'));
  rim.position.y = -1.7;
  group.add(rim);
  const under = new THREE.Mesh(new THREE.ConeGeometry(ISLAND_R - 1.2, 15, 10), toon('#a7856a', { flatShading: true }));
  under.rotation.x = Math.PI;
  under.position.y = -9.9;
  group.add(under);

  // plaza + fountain
  const plaza = shaded(new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.06, 48), toon('#f6e7cf')), false);
  plaza.position.y = 0.03;
  group.add(plaza);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.12, 6, 64), toon('#e2c9a6'));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.06;
  group.add(ring);
  const stone = toon('#efe2cf'), water = toon('#7fd6ff', { transparent: true, opacity: 0.85 });
  const add = (geo, mat, y) => { const m = shaded(new THREE.Mesh(geo, mat)); m.position.y = y; group.add(m); return m; };
  add(new THREE.CylinderGeometry(2.2, 2.4, 0.6, 32), stone, 0.3);
  add(new THREE.CylinderGeometry(1.95, 1.95, 0.1, 32), water, 0.56);
  add(new THREE.CylinderGeometry(0.3, 0.4, 1.4, 12), stone, 1.2);
  add(new THREE.CylinderGeometry(0.9, 0.5, 0.3, 20), stone, 1.95);
  const spout = add(new THREE.SphereGeometry(0.35, 16, 10), water, 2.25);
  colliders.push({ x: 0, z: 0, r: 2.4 });

  // trees, bushes and flowers on the grass ring, leaving portal lanes free
  const leaves = ['#5cbf5a', '#7dd36b', '#4aa96c', '#a3d96a'].map(c => toon(c, { flatShading: true }));
  const trunk = toon('#9a6a46');
  const blossom = ['#ff8fc8', '#ffd43b', '#ffffff', '#b197fc'].map(c => toon(c));
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + rand() * 0.2;
    const r = 10.5 + rand() * 5.5, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const s = 0.8 + rand() * 0.6;
    if (Math.abs(a - Math.PI / 2) < 0.45) continue; // keep the camera lane behind the spawn point clear
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    const stem = shaded(new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.25 * s, 1.4 * s, 8), trunk));
    stem.position.y = 0.7 * s;
    tree.add(stem);
    const top = shaded(new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * s, 1), leaves[i % 4]));
    top.position.y = 1.9 * s;
    tree.add(top);
    const top2 = shaded(new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 * s, 1), leaves[(i + 1) % 4]));
    top2.position.set(0.3 * s, 2.7 * s, 0.1 * s);
    tree.add(top2);
    tree.userData.portalLane = a; // portals.js removes trees standing in a portal lane
    group.add(tree);
    colliders.push({ x, z, r: 0.45 * s, tree });
  }
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2, r = 7.6 + rand() * 9.5;
    const f = shaded(new THREE.Mesh(new THREE.SphereGeometry(0.12 + rand() * 0.1, 8, 6), blossom[i % 4]), false);
    f.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r);
    group.add(f);
  }

  // clouds drifting around and under the island
  const clouds = new THREE.Group();
  const cloudMat = toon('#ffffff', { transparent: true, opacity: 0.95 });
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Group(), a = (i / 14) * Math.PI * 2, r = 28 + rand() * 25;
    c.position.set(Math.cos(a) * r, -14 + rand() * 22, Math.sin(a) * r);
    for (let k = 0; k < 4; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.5 + rand() * 1.5, 12, 8), cloudMat);
      puff.position.set(k * 1.8 - 2.7, rand() * 0.8, rand() * 1.2);
      c.add(puff);
    }
    clouds.add(c);
  }
  group.add(clouds);
  scene.add(group);

  return {
    group, colliders, radius: ISLAND_R - 0.8,
    update(t) {
      clouds.rotation.y = t * 0.01;
      spout.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
    },
  };
}
