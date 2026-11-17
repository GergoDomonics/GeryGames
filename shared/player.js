// Local player controller + third-person orbit camera. Reused by the hub and by games.
import * as THREE from 'three';
import { animateCharacter } from './character.js';

const SPEED = 5.5, GRAVITY = -26, JUMP = 9;

// opts: {colliders: [{x,z,r}], radius (walkable circle), spawn: {x,z}, groundY}
export function createPlayer(char, { colliders = [], radius = 17, spawn = { x: 0, z: 6 }, groundY = 0 } = {}) {
  const pos = new THREE.Vector3(spawn.x, groundY, spawn.z);
  const p = { char, pos, yaw: Math.PI, vy: 0, grounded: true, speed: 0, waveUntil: 0, t: 0 };

  p.update = (dt, move, actions, camYaw) => {
    p.t += dt;
    // camera-relative movement: forward = away from camera
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const dx = fx * move.z - fz * move.x, dz = fz * move.z + fx * move.x;
    const mag = Math.hypot(dx, dz);
    p.speed = THREE.MathUtils.lerp(p.speed, mag, 1 - Math.exp(-dt * 12));
    pos.x += dx * SPEED * dt;
    pos.z += dz * SPEED * dt;
    if (mag > 0.05) p.yaw = lerpYaw(p.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 14));

    if (actions.jump && p.grounded) { p.vy = JUMP; p.grounded = false; p.onJump?.(); }
    if (actions.wave) p.waveUntil = p.t + 1.6;
    p.vy += GRAVITY * dt;
    pos.y += p.vy * dt;
    if (pos.y <= groundY) { pos.y = groundY; p.vy = 0; p.grounded = true; }

    for (const c of colliders) { // push out of round obstacles
      const ox = pos.x - c.x, oz = pos.z - c.z, d = Math.hypot(ox, oz), min = c.r + 0.3;
      if (d < min && d > 1e-4) { pos.x = c.x + (ox / d) * min; pos.z = c.z + (oz / d) * min; }
    }
    const d = Math.hypot(pos.x, pos.z);
    if (d > radius) { pos.x *= radius / d; pos.z *= radius / d; }

    p.char.position.copy(pos);
    p.char.rotation.y = p.yaw;
    animateCharacter(p.char, { t: p.t, speed: p.speed, vy: p.vy, grounded: p.grounded, wave: p.t < p.waveUntil });
  };
  // what peers need to draw us
  p.pose = () => ({ x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2), yaw: +p.yaw.toFixed(2), s: +p.speed.toFixed(2), g: p.grounded, w: p.t < p.waveUntil });
  return p;
}

function lerpYaw(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function createFollowCam(camera) {
  const cam = { yaw: 0, pitch: 0.35, dist: 7, portrait: false };
  const target = new THREE.Vector3(), want = new THREE.Vector3();
  cam.update = (dt, focus, actions, facingYaw) => {
    if (!cam.portrait) {
      cam.yaw -= actions.look.x * 0.006;
      cam.pitch = THREE.MathUtils.clamp(cam.pitch + actions.look.y * 0.004, 0.05, 1.2);
      cam.dist = THREE.MathUtils.clamp(cam.dist + actions.zoom * 0.6, 3.5, 12);
    }
    // portrait: look at the character's face for the customizer
    const yaw = cam.portrait ? facingYaw : cam.yaw, pitch = cam.portrait ? 0.12 : cam.pitch, dist = cam.portrait ? 2.6 : cam.dist;
    const k = 1 - Math.exp(-dt * (cam.portrait ? 6 : 10));
    target.lerp(want.set(focus.x, focus.y + (cam.portrait ? 0.75 : 1.2), focus.z), k);
    const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist);
    camera.position.lerp(want.copy(target).add(off), cam.portrait ? k : 1);
    camera.lookAt(target);
  };
  return cam;
}
