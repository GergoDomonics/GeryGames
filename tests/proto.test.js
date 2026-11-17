import assert from 'node:assert/strict';
import { cleanProfile, cleanPose, hostOf, samplePose, lerpAngle, cleanParty, partyCode, PRESETS } from '../shared/proto.js';

// profile: junk in -> safe profile out
const p = cleanProfile({ name: '  <b>Gery</b>‮\u0007 very long name here', skin: 'red', hair: '#ABCDEF', hairStyle: 'mohawk', acc: 'crown' });
assert.equal(p.name, '<b>Gery</b> very');          // trimmed to 16, control/bidi chars removed (rendered as text, never HTML)
assert.equal(p.skin, PRESETS[0].skin);
assert.equal(p.hair, '#abcdef');
assert.equal(p.hairStyle, PRESETS[0].hairStyle);
assert.equal(p.acc, 'crown');
assert.equal(cleanProfile(null).name, 'Guest');
assert.equal(cleanProfile({ name: 42 }).name, 'Guest');

// pose
assert.equal(cleanPose(null), null);
assert.equal(cleanPose({ x: 'a', y: 0, z: 0, yaw: 0 }), null);
assert.equal(cleanPose({ x: NaN, y: 0, z: 0, yaw: 0 }), null);
assert.deepEqual(cleanPose({ x: 1e9, y: 0, z: -3, yaw: 1, s: 5, g: false, w: 'yes' }), { x: 60, y: 0, z: -3, yaw: 1, s: 1, g: false, w: false });

// host
assert.equal(hostOf(['zz', 'ab', 'mm']), 'ab');

// angles wrap the short way
assert.ok(Math.abs(lerpAngle(3.0, -3.0, 0.5) - (3.0 + (2 * Math.PI - 6) / 2)) < 1e-9);

// interpolation
const buf = [{ t: 0, x: 0, y: 0, z: 0, yaw: 0 }, { t: 100, x: 10, y: 0, z: 0, yaw: 0 }, { t: 200, x: 10, y: 0, z: 10, yaw: 0 }];
assert.equal(samplePose(buf, 50).x, 5);
assert.equal(samplePose(buf, 150).z, 5);
assert.equal(samplePose(buf, -5).x, 0);
assert.equal(samplePose(buf, 999).z, 10);
assert.equal(samplePose([], 0), null);

// party adverts
const games = [{ slug: 'test-room', maxPlayers: 2 }];
assert.equal(cleanParty({ slug: 'nope', code: 'abcd', members: [] }, games), null);
assert.equal(cleanParty({ slug: 'test-room', code: 'AB', members: [] }, games), null);
assert.deepEqual(cleanParty({ slug: 'test-room', code: 'ab12', members: ['a', 'a', 'b', 'c', 5] }, games).members, ['a', 'b']);
assert.match(partyCode(), /^[a-z0-9]{4}$/);

console.log('proto.test.js: all passed');
