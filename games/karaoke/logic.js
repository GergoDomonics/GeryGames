// Pure karaoke logic: LRC parsing, timing, scoring, pitch, link/title parsing, and validators for received events.
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const text = (s, max) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g, '').trim().slice(0, max) : '');

const TS = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
const WORD = /<(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)>/g;
const secs = (m, s) => Number(m) * 60 + Number(s.replace(':', '.'));

// LRC text -> [{t, end, text, words: [{t, text}] | null}], sorted. Empty text = instrumental gap.
export function parseLRC(lrc) {
  if (typeof lrc !== 'string') return [];
  const lines = [];
  let offset = 0;
  for (const raw of lrc.split(/\r?\n/)) {
    const off = raw.match(/^\[offset:\s*([+-]?\d+)\]/i);
    if (off) { offset = Number(off[1]) / 1000; continue; }
    const stamps = [...raw.matchAll(TS)];
    if (!stamps.length) continue;
    const body = raw.replace(TS, '');
    let words = null;
    if (/<\d{1,3}:\d/.test(body)) {
      words = [];
      const parts = body.split(WORD); // [pre, m, s, word, m, s, word...]
      for (let i = 1; i + 2 < parts.length; i += 3) {
        const w = parts[i + 2].trim();
        if (w) words.push({ t: secs(parts[i], parts[i + 1]), text: w });
      }
    }
    const line = text(body.replace(WORD, ' ').replace(/\s+/g, ' '), 200);
    for (const s of stamps) lines.push({ t: secs(s[1], s[2]), text: line, words: words && words.map(w => ({ ...w })) });
  }
  lines.sort((a, b) => a.t - b.t);
  for (const l of lines) { l.t -= offset; l.words?.forEach(w => { w.t -= offset; }); }
  lines.forEach((l, i) => { l.end = i + 1 < lines.length ? lines[i + 1].t : l.t + 6; });
  return lines;
}

// index of the line playing at time t, -1 before the first line
export function lineAt(lines, t) {
  let i = -1;
  while (i + 1 < lines.length && lines[i + 1].t <= t) i++;
  return i;
}

// when the singing in a line is probably over: long gaps before the next line are not singing
export const singEnd = l => l.words?.length ? Math.min(l.end, l.words.at(-1).t + 0.8) : Math.min(l.end, l.t + Math.max(1.5, l.text.length * 0.12));

// 0..1 sweep across the line's characters
export function lineProgress(l, t) {
  if (!l || !l.text) return 0;
  if (l.words?.length) {
    const total = l.words.reduce((n, w) => n + w.text.length + 1, 0);
    let done = 0;
    for (let i = 0; i < l.words.length; i++) {
      const w = l.words[i], next = l.words[i + 1]?.t ?? singEnd(l);
      if (t < w.t) break;
      done += (w.text.length + 1) * Math.min(1, (t - w.t) / Math.max(0.05, next - w.t));
    }
    return Math.min(1, done / total);
  }
  return Math.min(1, Math.max(0, (t - l.t) / Math.max(0.1, singEnd(l) - l.t)));
}

// 60% of the line voiced = full marks (breaths and consonants are not voiced)
export const scoreLine = (voiced, total) => (total > 0 ? Math.round(100 * Math.min(1, voiced / (total * 0.6))) : 0);

// autocorrelation pitch. buf: Float32Array of samples -1..1. Returns {rms, hz} with hz 0 when unvoiced.
export function detectPitch(buf, sampleRate) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.01) return { rms, hz: 0 };
  const minLag = Math.floor(sampleRate / 1000), maxLag = Math.min(Math.floor(sampleRate / 70), n >> 1);
  const corr = new Float32Array(maxLag + 2);
  let energy = 0;
  for (let i = 0; i < n - maxLag; i++) energy += buf[i] * buf[i];
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let c = 0;
    for (let i = 0; i < n - maxLag; i++) c += buf[i] * buf[i + lag];
    corr[lag] = c / energy;
  }
  // first peak above 0.9 of the best one, so octave errors (lag x2) lose to the true period
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) best = Math.max(best, corr[lag]);
  if (best < 0.5) return { rms, hz: 0 };
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (corr[lag] >= best * 0.9 && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) {
      const a = corr[lag - 1], b = corr[lag], c = corr[lag + 1], shift = (a - c) / (2 * (a - 2 * b + c) || 1);
      return { rms, hz: sampleRate / (lag + shift) };
    }
  }
  return { rms, hz: 0 };
}

// same note = same colour in every octave
export const hueOf = hz => (hz > 0 ? (((Math.log2(hz / 261.63) % 1) + 1) % 1) : -1);

export function videoIdFrom(s) {
  if (typeof s !== 'string') return null;
  s = s.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// "Artist - Song (Official Video) [HD] ft. X" -> "Artist Song"; channel name used when the title has no artist
export function cleanTitle(title, author = '') {
  let t = text(title, 200)
    .replace(/[([{【][^)\]}】]*[)\]}】]/g, ' ')
    .replace(/\b(official|music|lyrics?|video|audio|visuali[sz]er|hd|4k|mv|remaster(ed)?)\b/gi, ' ')
    .replace(/\s(ft|feat)\.?\s.*$/i, '')
    .replace(/["“”|]/g, ' ');
  if (!/\s[-–—]\s/.test(t) && author) t = text(author, 80).replace(/\s*-\s*topic$/i, '').replace(/vevo$/i, '') + ' ' + t;
  return t.replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
}

// LRCLIB search results -> usable ones, closest duration first
export function pickBest(results, duration) {
  if (!Array.isArray(results)) return [];
  const ok = results.filter(r => r && Number.isInteger(r.id) && typeof r.syncedLyrics === 'string' && r.syncedLyrics && !r.instrumental);
  return duration > 0 ? ok.sort((a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration)) : ok;
}

export function cleanSong(d) {
  if (!d || typeof d !== 'object') return null;
  const vid = videoIdFrom(d.vid), id = Number.isInteger(d.id) && d.id > 0 ? d.id : null;
  if (!vid || !id) return null;
  return { vid, id, offset: num(d.offset, -30, 30) ?? 0, title: text(d.title, 80) };
}
export function cleanSing(d) {
  if (!d || typeof d !== 'object') return null;
  const h = num(d.h, -1, 1);
  return { v: num(d.v, 0, 1) ?? 0, h: h === null || h < 0 ? -1 : h, s: Math.round(num(d.s, 0, 1e6) ?? 0) };
}
export function cleanClock(d) {
  const t = d && num(d.t, 0, 36000);
  return t === null || t === undefined ? null : { t, playing: d.playing === true };
}
export const cleanOffset = d => num(d, -30, 30);
