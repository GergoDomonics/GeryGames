// A glowing portal per game around the plaza. near(pos) -> game whose portal you stand in, or null.
import * as THREE from 'three';
import { toon, labelSprite } from '../shared/character.js';
import { GAMES } from '../games/registry.js';

const PORTAL_R = 12.5;

export function createPortals(world) {
  const portals = GAMES.map((game, i) => {
    const a = -Math.PI / 2 + (i / GAMES.length) * Math.PI * 2; // first portal straight ahead of spawn, behind the fountain
    const x = Math.cos(a) * PORTAL_R, z = Math.sin(a) * PORTAL_R;
    // clear trees out of this portal's lane
    for (let k = world.colliders.length - 1; k >= 0; k--) {
      const t = world.colliders[k].tree;
      if (t && Math.abs(Math.atan2(Math.sin(t.userData.portalLane - a), Math.cos(t.userData.portalLane - a))) < 0.4) {
        t.removeFromParent();
        world.colliders.splice(k, 1);
      }
    }
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = -a - Math.PI / 2; // face the fountain
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.25, 32), toon('#efe2cf'));
    base.position.y = 0.12;
    base.receiveShadow = true;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.2, 10, 40), toon(game.color));
    arch.position.y = 1.75;
    arch.castShadow = true;
    const swirl = new THREE.Mesh(new THREE.CircleGeometry(1.2, 40), new THREE.MeshBasicMaterial({ color: game.color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    swirl.position.y = 1.75;
    const label = labelSprite(game.title, game.color);
    label.position.y = 3.6;
    g.add(base, arch, swirl, label);
    world.group.add(g);
    return { game, x, z, swirl };
  });

  return {
    near(pos) {
      return portals.find(p => (pos.x - p.x) ** 2 + (pos.z - p.z) ** 2 < 2.2 ** 2)?.game ?? null;
    },
    update(t) {
      for (const p of portals) {
        p.swirl.material.opacity = 0.45 + Math.sin(t * 2.5) * 0.15;
        p.swirl.scale.setScalar(1 + Math.sin(t * 2) * 0.03);
      }
    },
  };
}
