import assert from 'node:assert/strict';
import { parseLRC, lineAt, lineProgress, singEnd, scoreLine, detectPitch, hueOf, videoIdFrom, cleanTitle, pickBest, cleanSong, cleanSing, cleanClock, cleanOffset } from '../games/karaoke/logic.js';

// LRC: metadata skipped, repeated stamps, blank gap lines, sorting, end times
const lrc = '[ar:Someone]\n[00:12.50] Second line\n[00:05.00][00:20.00] Chorus line\n[00:15.00]\nnot a lyric';
const lines = parseLRC(lrc);
assert.deepEqual(lines.map(l => [l.t, l.text]), [[5, 'Chorus line'], [12.5, 'Second line'], [15, ''], [20, 'Chorus line']]);
assert.equal(lines[0].end, 12.5);
assert.equal(lines[3].end, 26);
assert.deepEqual(parseLRC(null), []);
assert.equal(parseLRC('[offset:+500]\n[00:01.00] a')[0].t, 0.5);
assert.equal(parseLRC('[01:02.5] x')[0].t, 62.5);

// enhanced word tags
const w = parseLRC('[00:10.00] <00:10.00> Hello <00:11.00> world <00:12.00>\n[00:20.00] next')[0];
assert.equal(w.text, 'Hello world');
assert.deepEqual(w.words.map(x => [x.t, x.text]), [[10, 'Hello'], [11, 'world']]);
assert.equal(lineProgress(w, 9), 0);
assert.ok(Math.abs(lineProgress(w, 11) - 0.5) < 0.01);
assert.equal(lineProgress(w, 30), 1);

// timing
assert.equal(lineAt(lines, 0), -1);
assert.equal(lineAt(lines, 5), 0);
assert.equal(lineAt(lines, 13), 1);
assert.equal(lineAt(lines, 99), 3);
assert.ok(singEnd(lines[1]) <= lines[1].end);
assert.equal(lineProgress(lines[2], 16), 0); // gap
assert.equal(lineProgress(lines[0], 5), 0);
assert.equal(lineProgress(lines[0], 100), 1);

// scoring
assert.equal(scoreLine(0, 0), 0);
assert.equal(scoreLine(0, 10), 0);
assert.equal(scoreLine(6, 10), 100);
assert.equal(scoreLine(10, 10), 100);
assert.equal(scoreLine(3, 10), 50);

// pitch: sine at 220 Hz, plus silence
const sr = 48000, sine = new Float32Array(2048).map((_, i) => 0.3 * Math.sin(2 * Math.PI * 220 * i / sr));
const p = detectPitch(sine, sr);
assert.ok(Math.abs(p.hz - 220) < 3, `pitch ${p.hz}`);
assert.equal(detectPitch(new Float32Array(2048), sr).hz, 0);
const rich = new Float32Array(2048).map((_, i) => 0.2 * Math.sin(2 * Math.PI * 330 * i / sr) + 0.15 * Math.sin(2 * Math.PI * 660 * i / sr));
assert.ok(Math.abs(detectPitch(rich, sr).hz - 330) < 5, 'harmonics do not cause octave error');
assert.equal(hueOf(0), -1);
assert.ok(Math.abs(hueOf(220) - hueOf(440)) < 1e-9);
assert.ok(hueOf(300) >= 0 && hueOf(300) < 1);

// links
assert.equal(videoIdFrom('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), 'dQw4w9WgXcQ');
assert.equal(videoIdFrom('https://youtu.be/dQw4w9WgXcQ?si=x'), 'dQw4w9WgXcQ');
assert.equal(videoIdFrom('https://music.youtube.com/watch?list=x&v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
assert.equal(videoIdFrom('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
assert.equal(videoIdFrom('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
assert.equal(videoIdFrom('never gonna give you up'), null);
assert.equal(videoIdFrom(5), null);

// titles
assert.equal(cleanTitle('Rick Astley - Never Gonna Give You Up (Official Music Video)'), 'Rick Astley Never Gonna Give You Up');
assert.equal(cleanTitle('Song Name [Lyrics] ft. Someone', 'Band - Topic'), 'Band Song Name');
assert.equal(cleanTitle('Artist – Track 【MV】 HD'), 'Artist Track');

// lyrics search results
const res = [
  { id: 1, duration: 300, syncedLyrics: '[00:01.00] a' },
  { id: 2, duration: 212, syncedLyrics: '[00:01.00] b' },
  { id: 3, duration: 210, syncedLyrics: null },
  { id: 4, duration: 211, syncedLyrics: '[00:01.00] c', instrumental: true },
  null,
];
assert.deepEqual(pickBest(res, 210).map(r => r.id), [2, 1]);
assert.deepEqual(pickBest(res, 0).map(r => r.id), [1, 2]);
assert.deepEqual(pickBest('x', 1), []);

// validators
assert.deepEqual(cleanSong({ vid: 'dQw4w9WgXcQ', id: 7, offset: 99, title: 'A‮B' }), { vid: 'dQw4w9WgXcQ', id: 7, offset: 30, title: 'AB' });
assert.equal(cleanSong({ vid: '<script>', id: 7 }), null);
assert.equal(cleanSong({ vid: 'dQw4w9WgXcQ', id: 1.5 }), null);
assert.equal(cleanSong(null), null);
assert.deepEqual(cleanSing({ v: 5, h: 0.3, s: 12.4 }), { v: 1, h: 0.3, s: 12 });
assert.deepEqual(cleanSing({ v: 'x', h: -0.5, s: -3 }), { v: 0, h: -1, s: 0 });
assert.equal(cleanSing('x'), null);
assert.deepEqual(cleanClock({ t: 12, playing: true }), { t: 12, playing: true });
assert.equal(cleanClock({ t: NaN }), null);
assert.equal(cleanClock(null), null);
assert.equal(cleanOffset(-50), -30);
assert.equal(cleanOffset('1'), null);

console.log('karaoke logic ok');
