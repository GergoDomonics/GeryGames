// Boot: renderer, hub world, local player, networking, and switching between hub and games.
import * as THREE from 'three';
import { createWorld } from './hub/world.js';
import { createPortals } from './hub/portals.js';
import { createParty } from './hub/party.js';
import { toast, setStatus, createCustomizer, showTitle, wireHud } from './hub/ui.js';
import { buildCharacter, disposeCharacter } from './shared/character.js';
import { createPlayer, createFollowCam } from './shared/player.js';
import { createInput } from './shared/input.js';
import { createRemotes } from './shared/remotes.js';
import { loadProfile, saveProfile } from './shared/profile.js';
import { cleanProfile } from './shared/proto.js';
import { sfx } from './shared/sfx.js';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#ffe4f2', 70, 170);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
const resize = () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
};
addEventListener('resize', resize);
resize();

const world = createWorld(scene);
const portals = createPortals(world);
let { profile } = loadProfile();
const player = createPlayer(buildCharacter(profile), { colliders: world.colliders, radius: world.radius, spawn: { x: Math.random() * 4 - 2, z: 5 + Math.random() * 2 } });
scene.add(player.char);
player.onJump = () => sfx.play('jump');
const cam = createFollowCam(camera);
if (matchMedia('(pointer: coarse)').matches) { document.body.classList.add('touch'); $('touch').hidden = false; }
const input = createInput(canvas, $('touch'));
input.state.enabled = false;
const remotes = createRemotes(scene);

let netMod = null, hub = null, game = null, gameNet = null;
const known = new Map(); // peerId -> last profile seen this session; outlives hub leave/join races
const nameOf = id => (id === netMod?.selfId ? profile.name + ' (you)' : known.get(id)?.name ?? 'Someone');
const updateCount = () => setStatus(hub ? hub.peers().length + 1 : 1);

function setProfile(p) {
  profile = p;
  saveProfile(p);
  disposeCharacter(player.char);
  player.char = buildCharacter(p);
  scene.add(player.char);
  hub?.sendProfile(p);
}

const party = createParty({ panel: $('party'), nameOf, sfx, toast, onStart: enterGame });
const customizer = createCustomizer({
  get: () => profile, set: setProfile, sfx,
  onOpen: () => { cam.portrait = true; input.state.enabled = false; },
  onClose: () => { cam.portrait = false; input.state.enabled = true; },
});
wireHud({ sfx, onCustomize: () => customizer.isOpen ? customizer.close() : customizer.open() });

function joinHub() {
  if (!netMod) return;
  hub = netMod.connect('hub');
  hub.onJoin(id => { hub.sendProfile(profile, id); sfx.play('join'); updateCount(); });
  hub.onLeave(id => { remotes.remove(id); sfx.play('leave'); updateCount(); });
  hub.onPose((id, p) => remotes.pushPose(id, p));
  hub.onProfile((id, p) => { known.set(id, p); remotes.setProfile(id, p); party.render(); });
  party.bind(hub);
  updateCount();
}

async function enterGame(slug, code, members) {
  party.setNear(null); // late party messages must not reopen the panel in-game
  let mod;
  try { mod = await import(`./games/${slug}/index.js`); } catch (e) { console.error(e); toast('Could not load that game'); return; }
  const players = new Map(members.map(id => [id, id === hub.selfId ? profile : known.get(id) ?? cleanProfile({})]));
  hub.leave(); hub = null; remotes.clear();
  for (const id of ['party', 'hint', 'btn-custom', 'status']) $(id).hidden = true;
  customizer.close();
  world.group.visible = false; player.char.visible = false;
  sfx.music(false);
  gameNet = netMod.connect(`${slug}-${code}`);
  let left = false;
  const exit = () => {
    if (left) return;
    left = true;
    game?.dispose(); game = null;
    gameNet.leave(); gameNet = null;
    $('game-ui').replaceChildren();
    world.group.visible = true; player.char.visible = true;
    for (const id of ['hint', 'btn-custom', 'status']) $(id).hidden = false;
    sfx.music(true);
    joinHub();
  };
  try {
    game = await mod.start({ scene, camera, renderer, net: gameNet, me: profile, players, sfx, input, exit, ui: $('game-ui') });
  } catch (e) { console.error(e); toast('That game crashed on start'); exit(); }
}

if (location.hash === '#dev') window.gg = { player, enterGame, get hub() { return hub; } }; // testing: teleport, start games

const clock = new THREE.Clock();
let t = 0, poseTimer = 0, playing = false;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  if (game) game.update(dt);
  else {
    const act = input.take();
    if (!playing) cam.yaw += dt * 0.12; // slow orbit behind the title screen
    player.update(dt, input.move(), act, cam.yaw);
    cam.update(dt, player.pos, act, player.yaw);
    remotes.update(t);
    world.update(t);
    portals.update(t);
    if (playing) party.setNear(customizer.isOpen ? null : portals.near(player.pos));
    poseTimer += dt;
    if (hub && poseTimer > 1 / 15) { poseTimer = 0; if (hub.peers().length) hub.sendPose(player.pose()); }
  }
  renderer.render(scene, camera);
});

const { name, customize } = await showTitle({ profile, sfx });
setProfile(cleanProfile({ ...profile, name }));
playing = true;
input.state.enabled = true;
cam.yaw = 0;
if (customize) customizer.open();
try {
  netMod = await import('./shared/net.js');
  joinHub();
} catch (e) {
  console.error(e);
  toast('Multiplayer unavailable, playing solo');
}
