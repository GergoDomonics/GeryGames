// Other players: one character per peer, drawn ~100 ms in the past between received poses.
import * as THREE from 'three';
import { buildCharacter, disposeCharacter, animateCharacter, labelSprite } from './character.js';
import { cleanProfile, samplePose } from './proto.js';

const DELAY = 100;

export function createRemotes(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const map = new Map(); // peerId -> {char, tag, profile, buf}

  const ensure = id => {
    let r = map.get(id);
    if (!r) { r = { buf: [], profile: null, char: null, tag: null }; map.set(id, r); setProfile(id, cleanProfile({ name: '...' })); }
    return r;
  };
  function setProfile(id, profile) {
    const r = map.get(id) || ensure(id);
    const at = r.char?.position.clone();
    if (r.char) disposeCharacter(r.char);
    r.tag?.material.map.dispose(); r.tag?.material.dispose();
    r.profile = profile;
    r.char = buildCharacter(profile);
    if (at) r.char.position.copy(at);
    r.tag = labelSprite(profile.name);
    r.tag.position.y = 1.75;
    r.tag.scale.set(1.4, 0.35, 1);
    r.char.add(r.tag);
    group.add(r.char);
    r.char.visible = r.buf.length > 0; // hidden until we know where they are
  }

  return {
    group, map,
    setProfile,
    pushPose(id, pose) {
      const r = ensure(id);
      r.buf.push({ t: performance.now(), ...pose });
      if (r.buf.length > 20) r.buf.shift();
      r.char.visible = true;
    },
    remove(id) {
      const r = map.get(id);
      if (!r) return;
      disposeCharacter(r.char);
      r.tag.material.map.dispose(); r.tag.material.dispose();
      map.delete(id);
    },
    clear() { for (const id of [...map.keys()]) this.remove(id); },
    update(t) {
      const now = performance.now() - DELAY;
      for (const r of map.values()) {
        const p = samplePose(r.buf, now);
        if (!p) continue;
        r.char.position.set(p.x, p.y, p.z);
        r.char.rotation.y = p.yaw;
        animateCharacter(r.char, { t, speed: p.s, grounded: p.g, vy: 0, wave: p.w });
      }
    },
    dispose() { this.clear(); group.removeFromParent(); },
  };
}
