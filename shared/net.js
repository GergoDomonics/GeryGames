// The only module that talks to Trystero. Everything received goes through proto.js validators.
import { joinRoom, selfId } from 'trystero';
import { cleanPose, cleanProfile } from './proto.js';

const APP_ID = 'gerygames-v1';
export { selfId };

export function connect(roomName) {
  const room = joinRoom({ appId: APP_ID }, roomName);
  const pose = room.makeAction('pose'), prof = room.makeAction('prof'), evt = room.makeAction('evt');
  const subs = { join: [], leave: [], pose: [], prof: [] }, topics = {};
  let alive = true; // Trystero can still call back after leave(); drop those
  const fire = (list, ...a) => alive && list.forEach(fn => { try { fn(...a); } catch (e) { console.error(e); } });

  room.onPeerJoin = id => fire(subs.join, id);
  room.onPeerLeave = id => fire(subs.leave, id);
  pose.onMessage = (d, { peerId }) => { const p = cleanPose(d); if (p) fire(subs.pose, peerId, p); };
  prof.onMessage = (d, { peerId }) => fire(subs.prof, peerId, cleanProfile(d));
  evt.onMessage = (d, { peerId }) => {
    if (!alive || !d || typeof d.t !== 'string' || !topics[d.t]) return;
    fire(topics[d.t], d.d, peerId);
  };

  return {
    selfId,
    peers: () => Object.keys(room.getPeers()),
    sendPose: p => pose.send(p),
    sendProfile: (p, target) => prof.send(p, target ? { target } : undefined),
    // data is untrusted on the receiving side: validate in the handler
    emit: (t, d, target) => evt.send({ t, d }, target ? { target } : undefined),
    on: (t, fn) => { (topics[t] ||= []).push(fn); return () => topics[t].splice(topics[t].indexOf(fn), 1); },
    onJoin: fn => subs.join.push(fn),
    onLeave: fn => subs.leave.push(fn),
    onPose: fn => subs.pose.push(fn),
    onProfile: fn => subs.prof.push(fn),
    leave: () => { alive = false; room.leave(); },
  };
}
