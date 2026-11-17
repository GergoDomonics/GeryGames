// Neon karaoke club, all procedural. Reacts to singers ({x, v, h}) and lyric line changes (pulse()).
import * as THREE from 'three';
import { toon } from '../../shared/character.js';

const STAGE_Y = 0.6, STAGE_Z = -4.6;
const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: opacity >= 1, side: THREE.DoubleSide });
const hsl = (c, h, s, l) => c.setHSL(((h % 1) + 1) % 1, s, l);

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.font = '700 150px Fredoka, system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowBlur = 40;
  g.font = '700 130px Fredoka, system-ui, sans-serif';
  g.textAlign = 'left';
  const a = g.measureText('GERY ').width, b = g.measureText('KARAOKE').width, x = (1024 - a - b) / 2;
  g.shadowColor = '#ff4fd8'; g.fillStyle = '#ffd6f6';
  g.fillText('GERY', x, 128);
  g.shadowColor = '#3ee8ff'; g.fillStyle = '#d6fbff';
  g.fillText('KARAOKE', x + a, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createClub(scene) {
  const group = new THREE.Group();
  const add = (m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); group.add(m); return m; };

  add(new THREE.HemisphereLight('#9c7dff', '#1c0d2c', 1.3));
  add(new THREE.DirectionalLight('#ffd9f2', 1.6), 3, 9, 8);

  // room, stage, neon edge
  add(new THREE.Mesh(new THREE.BoxGeometry(30, 10, 44), toon('#1d1033', { side: THREE.BackSide })), 0, 4.9, 8); // deep, so phone cameras can back off
  add(new THREE.Mesh(new THREE.BoxGeometry(15, STAGE_Y, 4.4), toon('#2b1a47')), 0, STAGE_Y / 2, -5.2);
  add(new THREE.Mesh(new THREE.BoxGeometry(15, 0.08, 0.08), glow('#ff4fd8')), 0, STAGE_Y, -3);
  add(new THREE.Mesh(new THREE.BoxGeometry(15, 6, 0.2), toon('#120a20')), 0, 3, -7.4);
  const frame = glow('#3ee8ff');
  add(new THREE.Mesh(new THREE.BoxGeometry(15, 0.08, 0.08), frame), 0, 6, -7.25);
  for (const x of [-7.5, 7.5]) add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 6, 0.08), frame), x, 3, -7.25);
  const signTex = signTexture();
  add(new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, depthWrite: false })), 0, 7.4, -7.3);

  // LED dance floor
  const COLS = 17, ROWS = 9, tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.92, 0.05, 0.92), new THREE.MeshBasicMaterial(), COLS * ROWS);
  const tilePos = [], m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = c - (COLS - 1) / 2, z = -2.2 + r;
    tilePos.push([x, z]);
    tiles.setMatrixAt(tilePos.length - 1, m4.makeTranslation(x, 0.02, z));
    tiles.setColorAt(tilePos.length - 1, col.set('#000'));
  }
  group.add(tiles);
  add(new THREE.Mesh(new THREE.PlaneGeometry(30, 44), toon('#140a24')), 0, 0, 8).rotation.x = -Math.PI / 2;

  // equalizer bars on the back wall + spotlight cones, one per singer slot
  const bars = [], cones = [];
  for (let i = 0; i < 8; i++) {
    const bar = add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 1, 0.1), glow('#ffffff')), 0, 0, -7.25);
    const cone = add(new THREE.Mesh(new THREE.ConeGeometry(1.1, 7.5, 24, 1, true), glow('#ffffff', 0.1)), 0, STAGE_Y + 3.75, 0);
    bar.visible = cone.visible = false;
    bars.push(bar); cones.push(cone);
  }

  // speakers
  const speakers = [];
  for (const x of [-8.6, 8.6]) {
    const s = new THREE.Group();
    s.position.set(x, 0, -4.5);
    for (const y of [0.9, 2.6]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.2), toon('#221533'));
      box.position.y = y;
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.1, 24), toon('#3a2a52'));
      cone.rotation.x = Math.PI / 2;
      cone.position.set(0, y, 0.62);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.04, 6, 32), glow('#ff4fd8'));
      ring.position.set(0, y, 0.66);
      s.add(box, cone, ring);
    }
    group.add(s);
    speakers.push(s);
  }

  // disco ball + its light sparkles
  const disco = add(new THREE.Group(), 0, 7.2, 0.5);
  disco.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), new THREE.MeshPhongMaterial({ color: '#d8d8f0', specular: '#ffffff', shininess: 120, flatShading: true })));
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3), toon('#555')), 0, 8.9, 0.5);
  const dots = new Float32Array(900);
  for (let i = 0; i < 300; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(9 + Math.random() * 3);
    dots.set([v.x, v.y * 0.6, v.z], i * 3);
  }
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(dots, 3));
  const sparkles = new THREE.Points(dotGeo, new THREE.PointsMaterial({ size: 0.13, color: '#ffffff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  disco.add(sparkles);

  // lasers from the back corners
  const lasers = [];
  for (const [x, dir] of [[-6.8, 1], [6.8, -1], [-6.8, 1], [6.8, -1]]) {
    const pivot = add(new THREE.Group(), x, 6.2, -6.9);
    const geo = new THREE.CylinderGeometry(0.025, 0.025, 30, 6);
    geo.translate(0, 15, 0);
    geo.rotateX(Math.PI / 2); // beam points +z
    const beam = new THREE.Mesh(geo, glow('#3ee8ff', 0.6));
    pivot.add(beam);
    pivot.userData = { dir, phase: lasers.length * 1.7 };
    lasers.push(pivot);
  }

  // confetti
  const CONF = 160, confPos = new Float32Array(CONF * 3), confVel = new Float32Array(CONF * 3), confCol = new Float32Array(CONF * 3);
  const confGeo = new THREE.BufferGeometry();
  confGeo.setAttribute('position', new THREE.BufferAttribute(confPos, 3));
  confGeo.setAttribute('color', new THREE.BufferAttribute(confCol, 3));
  const confetti = new THREE.Points(confGeo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true }));
  confetti.visible = false;
  confetti.frustumCulled = false;
  group.add(confetti);
  let confLife = 0;

  scene.add(group);
  let pulseT = -10, spin = 0, last = 0;
  const lineHue = { h: 0.85 };

  return {
    group,
    // stage spots in a soft arc, centred for n singers
    spots(n) {
      const gap = Math.min(1.6, 13 / Math.max(1, n));
      return Array.from({ length: n }, (_, i) => {
        const x = (i - (n - 1) / 2) * gap;
        return { x, y: STAGE_Y, z: STAGE_Z + x * x * 0.03 };
      });
    },
    pulse(t) { pulseT = t; lineHue.h = (lineHue.h + 0.17) % 1; },
    confetti(x, y, z) {
      for (let i = 0; i < CONF; i++) {
        confPos.set([x, y + 1.5, z], i * 3);
        confVel.set([(Math.random() - 0.5) * 6, 4 + Math.random() * 5, (Math.random() - 0.2) * 5], i * 3);
        hsl(col, Math.random(), 1, 0.6).toArray(confCol, i * 3);
      }
      confGeo.attributes.color.needsUpdate = true;
      confetti.visible = true;
      confLife = 3;
    },
    // singers: [{x, z, v 0..1, h hue or -1}]
    update(t, singers) {
      const dt = Math.min(0.05, t - last); last = t;
      const energy = singers.reduce((s, p) => s + p.v, 0) / Math.max(1, singers.length);
      const beat = Math.exp(-(t - pulseT) * 4); // 1 right after a new lyric line, decays

      for (let i = 0; i < tilePos.length; i++) {
        const [x, z] = tilePos[i];
        let near = null, d = 1e9;
        for (const s of singers) { const dd = Math.abs(s.x - x); if (dd < d) { d = dd; near = s; } }
        const ring = Math.abs(Math.hypot(x, z + 3) - (t - pulseT) * 9) < 0.7 ? 0.35 * beat : 0;
        const chase = 0.06 + 0.05 * Math.sin(t * 2 + x * 0.6 + z * 0.4);
        if (near && near.v > 0.05) {
          const fall = Math.exp(-d * 0.45) * Math.exp(-(z + 2.2) * 0.12);
          hsl(col, near.h >= 0 ? near.h : lineHue.h, 1, Math.min(0.75, chase + near.v * 0.55 * fall + ring));
        } else hsl(col, lineHue.h + (x + z) * 0.02 + t * 0.03, 0.9, chase + ring);
        tiles.setColorAt(i, col);
      }
      tiles.instanceColor.needsUpdate = true;

      for (let i = 0; i < 8; i++) {
        const s = singers[i];
        bars[i].visible = cones[i].visible = !!s;
        if (!s) continue;
        const h = s.h >= 0 ? s.h : lineHue.h;
        const hgt = THREE.MathUtils.lerp(bars[i].scale.y, 0.2 + s.v * 4.5, 0.3);
        bars[i].scale.y = hgt;
        bars[i].position.set(s.x, STAGE_Y + 0.1 + hgt / 2, -7.25);
        hsl(bars[i].material.color, h, 1, 0.6);
        cones[i].position.x = s.x; cones[i].position.z = s.z;
        cones[i].material.opacity = 0.04 + s.v * 0.3;
        hsl(cones[i].material.color, h, 1, 0.55);
      }

      spin += dt * (0.3 + energy * 2.5);
      disco.rotation.y = spin;
      sparkles.material.opacity = 0.35 + energy * 0.6;
      for (const s of speakers) s.scale.setScalar(1 + beat * 0.06 + energy * 0.03);
      for (const l of lasers) {
        const { dir, phase } = l.userData;
        l.rotation.y = dir * (0.35 + 0.35 * Math.sin(t * (0.6 + beat * 3) + phase));
        l.rotation.x = 0.25 + 0.15 * Math.sin(t * 0.9 + phase);
        hsl(l.children[0].material.color, lineHue.h + phase * 0.1, 1, 0.6);
        l.children[0].material.opacity = 0.25 + beat * 0.5 + energy * 0.25;
      }

      if (confLife > 0) {
        confLife -= dt;
        for (let i = 0; i < CONF * 3; i += 3) {
          confVel[i + 1] -= 9 * dt;
          for (let k = 0; k < 3; k++) confPos[i + k] += confVel[i + k] * dt;
        }
        confGeo.attributes.position.needsUpdate = true;
        confetti.visible = confLife > 0;
      }
    },
    dispose() {
      group.removeFromParent();
      signTex.dispose();
      group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
    },
  };
}
