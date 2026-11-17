// Pure data + validation shared by hub, games and tests. No imports: runs in node too.

export const HAIR_STYLES = ['short', 'spiky', 'bob', 'bun', 'long', 'buzz'];
export const ACCESSORIES = ['none', 'cap', 'beanie', 'glasses', 'crown', 'flower', 'backpack'];
export const PALETTE = {
  skin: ['#ffe0c7', '#f6c9a3', '#e0a57c', '#c68653', '#8d5a3b', '#5c3a24'],
  hair: ['#2b2220', '#6b4226', '#e8b05c', '#f2e2c4', '#e5533d', '#ff8fc8', '#7b6cff', '#4fc3a1'],
  cloth: ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa', '#f783ac', '#f8f9fa', '#343a40'],
};

export const PRESETS = [
  { skin: '#ffe0c7', hair: '#e8b05c', hairStyle: 'bob', shirt: '#f783ac', pants: '#4dabf7', shoes: '#f8f9fa', acc: 'flower' },
  { skin: '#e0a57c', hair: '#2b2220', hairStyle: 'spiky', shirt: '#ffa94d', pants: '#343a40', shoes: '#ff6b6b', acc: 'cap' },
  { skin: '#8d5a3b', hair: '#ff8fc8', hairStyle: 'bun', shirt: '#9775fa', pants: '#f8f9fa', shoes: '#ffd43b', acc: 'glasses' },
  { skin: '#f6c9a3', hair: '#e5533d', hairStyle: 'long', shirt: '#69db7c', pants: '#9775fa', shoes: '#343a40', acc: 'crown' },
  { skin: '#c68653', hair: '#4fc3a1', hairStyle: 'short', shirt: '#4dabf7', pants: '#ffd43b', shoes: '#f8f9fa', acc: 'backpack' },
  { skin: '#5c3a24', hair: '#f2e2c4', hairStyle: 'buzz', shirt: '#ffd43b', pants: '#ff6b6b', shoes: '#4dabf7', acc: 'beanie' },
];

const HEX = /^#[0-9a-f]{6}$/i;
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);

// Untrusted profile from storage or a peer -> always a usable profile.
export function cleanProfile(p, fallback = PRESETS[0]) {
  const o = p && typeof p === 'object' ? p : {};
  const col = k => (typeof o[k] === 'string' && HEX.test(o[k]) ? o[k].toLowerCase() : fallback[k]);
  const name = typeof o.name === 'string' ? o.name.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮]/g, '').trim().slice(0, 16) : '';
  return {
    name: name || 'Guest',
    skin: col('skin'), hair: col('hair'), shirt: col('shirt'), pants: col('pants'), shoes: col('shoes'),
    hairStyle: HAIR_STYLES.includes(o.hairStyle) ? o.hairStyle : fallback.hairStyle,
    acc: ACCESSORIES.includes(o.acc) ? o.acc : fallback.acc,
  };
}

// Untrusted pose -> {x,y,z,yaw,s,g,w} or null. World is +-60 units, nobody legit goes further.
export function cleanPose(p) {
  if (!p || typeof p !== 'object') return null;
  const x = num(p.x, -60, 60), y = num(p.y, -60, 60), z = num(p.z, -60, 60), yaw = num(p.yaw, -10, 10);
  if (x === null || y === null || z === null || yaw === null) return null;
  return { x, y, z, yaw, s: num(p.s, 0, 1) ?? 0, g: p.g !== false, w: p.w === true };
}

export const hostOf = ids => [...ids].sort()[0];

export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// buf: [{t, x,y,z,yaw,...}] ascending by t. Returns the pose at time t (clamped to the ends).
export function samplePose(buf, t) {
  if (!buf.length) return null;
  if (t <= buf[0].t) return buf[0];
  const last = buf[buf.length - 1];
  if (t >= last.t) return last;
  let i = buf.length - 2;
  while (i > 0 && buf[i].t > t) i--;
  const a = buf[i], b = buf[i + 1], k = (t - a.t) / (b.t - a.t || 1);
  return {
    ...b,
    x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k,
    yaw: lerpAngle(a.yaw, b.yaw, k),
  };
}

export const partyCode = () => Array.from({ length: 4 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');

// Untrusted party advert -> clean advert or null. `games` = registry.
export function cleanParty(p, games) {
  if (!p || typeof p !== 'object' || typeof p.code !== 'string' || !/^[a-z0-9]{4}$/.test(p.code)) return null;
  const game = games.find(g => g.slug === p.slug);
  if (!game || !Array.isArray(p.members)) return null;
  const members = [...new Set(p.members.filter(m => typeof m === 'string' && m.length < 64))].slice(0, game.maxPlayers);
  return { slug: game.slug, code: p.code, members };
}
