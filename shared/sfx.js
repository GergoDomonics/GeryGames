// Tiny synthesized SFX + one music track. Nothing plays before the first user gesture (unlock()).
let ctx = null, muted = false, music = null;
try { muted = localStorage.getItem('gerygames.muted') === '1'; } catch { /* default unmuted */ }

const SOUNDS = { // [wave, startHz, endHz, seconds, volume]
  click: ['triangle', 660, 880, 0.08, 0.25],
  jump: ['square', 300, 620, 0.14, 0.12],
  pop: ['sine', 520, 1040, 0.12, 0.3],
  join: ['sine', 660, 990, 0.25, 0.25],
  leave: ['sine', 600, 330, 0.25, 0.2],
  start: ['triangle', 440, 1320, 0.4, 0.25],
};

export const sfx = {
  unlock() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume?.();
    if (!music) {
      music = new Audio('assets/audio/hub-music.mp3');
      music.loop = true;
      music.volume = 0.35;
    }
    if (!muted) music.play().catch(() => {});
  },
  play(name) {
    const s = SOUNDS[name];
    if (!ctx || muted || !s) return;
    const [type, f0, f1, dur, vol] = s, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  },
  get muted() { return muted; },
  toggleMute() {
    muted = !muted;
    try { localStorage.setItem('gerygames.muted', muted ? '1' : '0'); } catch { /* session only */ }
    if (music) muted ? music.pause() : music.play().catch(() => {});
    return muted;
  },
  music(on) { if (music && !muted) on ? music.play().catch(() => {}) : music.pause(); },
};
