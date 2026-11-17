// Placeholder game: a small arena where the party walks around together. Proves the module contract.
import * as THREE from 'three';
import { buildCharacter, disposeCharacter, toon } from '../../shared/character.js';
import { createPlayer, createFollowCam } from '../../shared/player.js';
import { createRemotes } from '../../shared/remotes.js';
import { hostOf } from '../../shared/proto.js';

export async function start({ scene, camera, net, me, players, sfx, input, exit, ui }) {
  const root = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(8, 7.5, 0.5, 40), toon('#ffd8a8'));
  floor.position.y = -0.25;
  floor.receiveShadow = true;
  root.add(floor);
  scene.add(root);

  const a = Math.random() * Math.PI * 2;
  const player = createPlayer(buildCharacter(me), { radius: 7.3, spawn: { x: Math.cos(a) * 3, z: Math.sin(a) * 3 } });
  scene.add(player.char);
  player.onJump = () => sfx.play('jump');
  const cam = createFollowCam(camera);
  const remotes = createRemotes(scene);
  for (const [id, p] of players) if (id !== net.selfId) remotes.setProfile(id, p);

  const label = document.createElement('span');
  label.className = 'pill live';
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Back to hub';
  btn.onclick = () => { sfx.play('click'); exit(); };
  const box = document.createElement('div');
  box.className = 'row';
  box.append(label, btn);
  ui.append(box);
  const showHost = () => {
    const host = hostOf([net.selfId, ...net.peers()]);
    label.textContent = `Test Room · ${net.peers().length + 1} here · host: ${host === net.selfId ? 'you' : players.get(host)?.name ?? 'someone'}`;
  };
  showHost();

  net.onJoin(id => { net.sendProfile(me, id); showHost(); });
  net.onLeave(id => { remotes.remove(id); showHost(); });
  net.onPose((id, p) => remotes.pushPose(id, p));
  net.onProfile((id, p) => { players.set(id, p); remotes.setProfile(id, p); showHost(); });

  let t = 0, poseTimer = 0;
  return {
    update(dt) {
      t += dt;
      const act = input.take();
      player.update(dt, input.move(), act, cam.yaw);
      cam.update(dt, player.pos, act, player.yaw);
      remotes.update(t);
      if ((poseTimer += dt) > 1 / 15) { poseTimer = 0; if (net.peers().length) net.sendPose(player.pose()); }
    },
    dispose() {
      remotes.dispose();
      disposeCharacter(player.char);
      root.removeFromParent();
      floor.geometry.dispose(); floor.material.dispose();
    },
  };
}
