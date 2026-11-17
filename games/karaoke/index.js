// Karaoke Club: everyone sings the same YouTube song together; lyrics from LRCLIB; mic drives mouths, score and lights.
import * as THREE from 'three';
import { buildCharacter, disposeCharacter, animateCharacter, labelSprite } from '../../shared/character.js';
import { hostOf, cleanProfile } from '../../shared/proto.js';
import { toast } from '../../hub/ui.js';
import { createClub } from './club.js';
import { createYouTube } from './youtube.js';
import { createMic } from './mic.js';
import { createLyricsView, searchLyrics, fetchLyrics } from './lyrics.js';
import { parseLRC, lineAt, singEnd, scoreLine, hueOf, videoIdFrom, cleanTitle, pickBest, cleanSong, cleanSing, cleanClock, cleanOffset } from './logic.js';

const COUNTDOWN = 3000, MAX_STAGE = 8;
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
const btn = (txt, cls = '') => { const b = el('button', 'btn ' + cls, txt); b.type = 'button'; return b; };
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export async function start({ scene, camera, net, me, players, sfx, input, exit, ui }) {
  const css = el('link');
  css.rel = 'stylesheet';
  css.href = new URL('./karaoke.css', import.meta.url).href;
  document.head.append(css);

  // swap the hub's sky, lights and fog for the club
  const hidden = scene.children.filter(o => o.visible);
  hidden.forEach(o => { o.visible = false; });
  const oldFog = scene.fog, oldBg = scene.background;
  scene.fog = new THREE.Fog('#1a0d2e', 16, 44);
  scene.background = new THREE.Color('#1a0d2e');
  const club = createClub(scene);

  // ---------- DOM ----------
  const root = el('div', 'kk');
  const lyricsEl = el('section', 'kk-lyrics');
  lyricsEl.setAttribute('aria-label', 'Lyrics');
  const view = createLyricsView(lyricsEl);
  const side = el('div', 'kk-side');
  const videoEl = el('div', 'kk-video');
  const board = el('ol', 'kk-board');
  board.setAttribute('aria-label', 'Scores');
  side.append(videoEl, board);
  const bar = el('div', 'kk-bar');
  const micBtn = btn('🎤 Mic off');
  micBtn.setAttribute('aria-pressed', 'false');
  const backBtn = btn('Back to hub');
  const hostTools = el('span', 'kk-host row');
  const earlier = btn('Lyrics earlier', 'small'), later = btn('Lyrics later', 'small'), offLabel = el('span', 'kk-off', '0.0 s'), stopBtn = btn('Stop', 'small');
  hostTools.append(earlier, offLabel, later, stopBtn);
  bar.append(micBtn, hostTools, backBtn);
  const tapBtn = btn('▶ Tap to start', 'primary big kk-tap');
  tapBtn.hidden = true;

  const picker = el('div', 'card kk-card kk-picker');
  const linkIn = el('input');
  Object.assign(linkIn, { type: 'url', placeholder: 'Paste a YouTube link', autocomplete: 'off' });
  linkIn.setAttribute('aria-label', 'YouTube link');
  const qIn = el('input');
  Object.assign(qIn, { type: 'search', placeholder: 'Song or artist', autocomplete: 'off' });
  qIn.setAttribute('aria-label', 'Lyrics search');
  const findYt = el('a', 'btn small', 'Find on YouTube ↗');
  Object.assign(findYt, { target: '_blank', rel: 'noopener noreferrer', href: 'https://www.youtube.com/' });
  const searchBtn = btn('Search lyrics', 'small');
  const status = el('p', 'kk-status', 'Paste a YouTube link, or search for a song first.');
  status.setAttribute('role', 'status');
  const results = el('ul', 'kk-results');
  const startBtn = btn('Start singing!', 'primary big');
  startBtn.disabled = true;
  picker.append(el('h2', '', 'Pick a song'), linkIn, el('div', 'row', ''), qIn, el('div', 'row'), status, results, startBtn);
  picker.children[2].append(findYt);
  picker.children[4].append(searchBtn);
  const wait = el('div', 'card kk-card kk-wait', 'The host is picking a song…');
  const resultsCard = el('div', 'card kk-card kk-end');

  root.append(lyricsEl, bar, picker, wait, resultsCard, tapBtn);
  ui.append(side);
  document.body.append(root);
  view.set([], 'Pick a song to start');

  // ---------- state ----------
  let phase = 'pick', song = null, lines = [], offset = 0, startAt = 0, token = 0;
  let mic = null, myVol = 0, myHue = -1, myScore = 0, scoringLine = -1, lineFrames = 0, lineVoiced = 0;
  let pick = { vid: null, chosen: null, list: [] };
  const remote = new Map(); // peerId -> {v, h, s, at}
  const chars = new Map(); // peerId -> {root, tag, v, cheer}
  const timers = [];
  const isHost = () => hostOf([net.selfId, ...net.peers()]) === net.selfId;
  const nameOf = id => (id === net.selfId ? `${me.name} (you)` : players.get(id)?.name ?? 'Someone');
  const scoreOf = id => (id === net.selfId ? myScore : remote.get(id)?.s ?? 0);

  // not awaited: net handlers below must be registered before any peer join/profile arrives
  let yt = null, disposed = false;
  const ytReady = createYouTube(videoEl).then(p => {
    if (disposed) { p.destroy(); return null; }
    yt = p;
    yt.onError(msg => toast(msg));
    yt.onEnd(() => { if (phase === 'playing') { if (isHost()) net.emit('stop', {}); showResults(); } });
    return p;
  }).catch(e => { console.error(e); toast('YouTube could not load'); return null; });

  // ---------- characters on stage ----------
  function layout() {
    const ids = [net.selfId, ...net.peers()].sort().slice(0, MAX_STAGE);
    for (const [id, c] of chars) if (!ids.includes(id)) { dropChar(c); chars.delete(id); }
    const spots = club.spots(ids.length);
    ids.forEach((id, i) => {
      let c = chars.get(id);
      if (!c) {
        const p = id === net.selfId ? me : players.get(id) ?? cleanProfile({});
        const r = buildCharacter(p);
        const tag = labelSprite(id === net.selfId ? 'You' : p.name);
        tag.position.y = 1.75;
        tag.scale.set(1.4, 0.35, 1);
        r.add(tag);
        scene.add(r);
        c = { root: r, tag, v: 0, cheer: 0 };
        chars.set(id, c);
      }
      c.root.position.set(spots[i].x, spots[i].y, spots[i].z);
      c.root.rotation.y = -spots[i].x * 0.06; // face the room
    });
    renderBoard();
  }
  function dropChar(c) { c.tag.material.map.dispose(); c.tag.material.dispose(); disposeCharacter(c.root); }

  function renderBoard() {
    const ids = [...chars.keys()].sort((a, b) => scoreOf(b) - scoreOf(a));
    board.replaceChildren(...ids.map(id => {
      const li = el('li', id === net.selfId ? 'me' : '');
      li.append(el('span', '', nameOf(id)), el('b', '', id === net.selfId && !mic ? 'no mic' : String(scoreOf(id))));
      return li;
    }));
  }

  // ---------- UI state ----------
  function refreshUi() {
    const host = isHost();
    picker.hidden = !(phase === 'pick' && host);
    wait.hidden = !(phase === 'pick' && !host);
    resultsCard.hidden = phase !== 'results';
    hostTools.hidden = !(phase === 'playing' && host);
    if (phase === 'results') renderResults();
  }

  // ---------- host: picking ----------
  async function onLink() {
    const vid = videoIdFrom(linkIn.value);
    if (!vid) { status.textContent = linkIn.value.trim() ? 'That does not look like a YouTube link.' : 'Paste a YouTube link, or search for a song first.'; return; }
    if (vid === pick.vid) return;
    pick.vid = vid;
    updateStart();
    status.textContent = 'Loading video…';
    const cued = ytReady.then(() => yt?.cue(vid));
    try {
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + vid)}`, { signal: AbortSignal.timeout(6000) });
      if (r.ok) { const o = await r.json(); qIn.value = cleanTitle(o.title, o.author_name); }
    } catch { /* title lookup is a convenience only */ }
    await cued;
    if (qIn.value) runSearch(); else status.textContent = 'Type the song name to find its lyrics.';
  }

  async function runSearch() {
    const q = qIn.value.trim();
    if (!q) return;
    findYt.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' lyrics')}`;
    status.textContent = 'Searching lyrics…';
    try {
      pick.list = pickBest(await searchLyrics(q), pick.vid ? yt?.duration() : 0).slice(0, 6);
    } catch (e) { pick.list = []; status.textContent = 'The lyrics site did not answer. Try again in a moment.'; return; }
    choose(pick.list[0] ?? null);
    status.textContent = !pick.list.length ? 'No synced lyrics found. Try a shorter search, like just the song name.'
      : pick.vid ? 'Lyrics found! Pick another below if they look wrong.' : 'Lyrics found. Now paste the YouTube link (use Find on YouTube).';
  }

  function choose(r) {
    pick.chosen = r;
    results.replaceChildren(...pick.list.map(x => {
      const li = el('li');
      const b = btn(`${x.trackName} — ${x.artistName} · ${mmss(x.duration)}`, 'small');
      b.setAttribute('aria-pressed', String(x === r));
      b.onclick = () => { sfx.play('click'); choose(x); };
      li.append(b);
      return li;
    }));
    updateStart();
  }
  const updateStart = () => { startBtn.disabled = !(pick.vid && pick.chosen); };

  // ---------- playing ----------
  async function playSong(s, lrc) {
    const my = ++token;
    song = s; offset = s.offset; phase = 'playing';
    myScore = 0; scoringLine = -1; lineFrames = lineVoiced = 0;
    remote.forEach(r => { r.s = 0; });
    chars.forEach(c => { c.cheer = 0; });
    offLabel.textContent = `${offset.toFixed(1)} s`;
    refreshUi();
    view.set([], 'Loading lyrics…');
    lines = [];
    startAt = performance.now() + COUNTDOWN;
    const lyricsReady = (async () => {
      try { lrc ??= (await fetchLyrics(s.id)).syncedLyrics; } catch { lrc = null; }
      if (my !== token) return;
      lines = parseLRC(lrc);
      view.set(lines, 'Could not load the lyrics for this song.');
    })();
    await ytReady;
    await yt?.cue(s.vid);
    await lyricsReady;
    if (my !== token) return;
    timers.push(setTimeout(() => {
      if (my !== token) return;
      yt?.play();
      sfx.play('start');
      timers.push(setTimeout(() => { if (my === token && phase === 'playing' && !yt?.playing()) tapBtn.hidden = false; }, 2500));
    }, Math.max(0, startAt - performance.now())));
  }

  function showResults() {
    if (phase !== 'playing') return;
    finishLine();
    phase = 'results';
    token++;
    yt?.pause();
    tapBtn.hidden = true;
    const top = [...chars.keys()].sort((a, b) => scoreOf(b) - scoreOf(a))[0];
    const c = chars.get(top);
    if (c && scoreOf(top) > 0) { club.confetti(c.root.position.x, c.root.position.y, c.root.position.z); c.cheer = 4; }
    sfx.play('join');
    refreshUi();
  }

  function renderResults() {
    const ids = [...chars.keys()].sort((a, b) => scoreOf(b) - scoreOf(a));
    const list = el('ol', 'kk-rank');
    list.append(...ids.map(id => { const li = el('li', id === net.selfId ? 'me' : ''); li.append(el('span', '', nameOf(id)), el('b', '', String(scoreOf(id)))); return li; }));
    const row = el('div', 'row');
    if (isHost()) { const next = btn('Pick next song', 'primary'); next.onclick = () => { sfx.play('click'); phase = 'pick'; refreshUi(); }; row.append(next); }
    else row.append(el('span', 'kk-status', 'Waiting for the host to pick the next song…'));
    resultsCard.replaceChildren(el('h2', '', song?.title ? `🎤 ${song.title}` : 'Results'), list, row);
  }

  function finishLine() {
    if (lineFrames > 0) myScore += scoreLine(lineVoiced, lineFrames);
    lineFrames = lineVoiced = 0;
  }

  // ---------- buttons ----------
  linkIn.addEventListener('change', onLink);
  linkIn.addEventListener('paste', () => setTimeout(onLink));
  searchBtn.onclick = () => { sfx.play('click'); runSearch(); };
  qIn.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
  startBtn.onclick = () => {
    if (!pick.vid || !pick.chosen) return;
    sfx.play('click');
    const s = cleanSong({ vid: pick.vid, id: pick.chosen.id, offset: 0, title: pick.chosen.trackName.includes(pick.chosen.artistName) ? pick.chosen.trackName : `${pick.chosen.artistName} – ${pick.chosen.trackName}` });
    net.emit('song', s);
    playSong(s, pick.chosen.syncedLyrics);
  };
  const nudge = d => { offset = Math.max(-30, Math.min(30, offset + d)); offLabel.textContent = `${offset.toFixed(1)} s`; net.emit('offset', offset); };
  earlier.onclick = () => nudge(-0.5);
  later.onclick = () => nudge(0.5);
  stopBtn.onclick = () => { net.emit('stop', {}); showResults(); };
  tapBtn.onclick = () => { yt?.play(); tapBtn.hidden = true; };
  backBtn.onclick = () => { sfx.play('click'); exit(); };
  micBtn.onclick = async () => {
    sfx.play('click');
    if (mic) { mic.stop(); mic = null; }
    else {
      micBtn.disabled = true;
      try { mic = await createMic(); toast('Mic on! Headphones keep the music out of your score'); }
      catch (e) { console.error(e); toast('No microphone, your character will lip-sync instead'); }
      micBtn.disabled = false;
    }
    micBtn.textContent = mic ? '🎤 Mic on' : '🎤 Mic off';
    micBtn.setAttribute('aria-pressed', String(!!mic));
    micBtn.classList.toggle('on', !!mic);
    renderBoard();
  };

  // ---------- network ----------
  net.onJoin(id => {
    net.sendProfile(me, id);
    if (isHost() && phase === 'playing' && song) { net.emit('song', song, id); net.emit('offset', offset, id); }
    layout(); refreshUi();
  });
  net.onLeave(id => { remote.delete(id); layout(); refreshUi(); });
  net.onProfile((id, p) => {
    players.set(id, p);
    const c = chars.get(id);
    if (c) { dropChar(c); chars.delete(id); }
    layout();
  });
  // song/offset/stop are accepted from any party member: a newcomer with a smaller id can become host mid-song
  net.on('song', d => {
    const s = cleanSong(d);
    if (!s) return;
    if (song && phase === 'playing' && s.vid === song.vid && s.id === song.id) return; // already on it
    playSong(s);
  });
  net.on('offset', d => { const o = cleanOffset(d); if (o !== null) { offset = o; offLabel.textContent = `${o.toFixed(1)} s`; } });
  net.on('stop', () => showResults());
  net.on('clock', (d, from) => {
    const c = cleanClock(d);
    if (!c || !yt || phase !== 'playing' || performance.now() < startAt || from !== hostOf([net.selfId, ...net.peers()])) return;
    if (c.playing && yt.playing() && Math.abs(yt.time() - c.t) > 0.6) yt.seek(c.t + 0.15);
  });
  net.on('sing', (d, from) => {
    const s = cleanSing(d);
    if (s) remote.set(from, { ...s, at: performance.now() });
  });

  layout();
  refreshUi();

  // ---------- loop ----------
  let t = 0, micTimer = 0, sendTimer = 0, clockTimer = 0, boardTimer = 0, vw = 0, vh = 0;
  return {
    update(dt) {
      t += dt;
      input.take(); // nothing to control here; drain so the hub does not get stale actions

      // keep the stage visible beside (desktop) or above (phone) the lyrics
      if (innerWidth !== vw || innerHeight !== vh) {
        vw = innerWidth; vh = innerHeight;
        const narrow = vw <= 640;
        camera.setViewOffset(vw, vh, narrow ? 0 : -vw * 0.22, narrow ? vh * 0.22 : 0, vw, vh);
      }
      const portrait = Math.max(1, 1.25 / camera.aspect);
      const camZ = Math.min(27, -1 + 10.5 * portrait);
      camera.position.set(Math.sin(t * 0.2) * 1.2, 3.6, camZ);
      scene.fog.near = camZ + 8; scene.fog.far = camZ + 40;
      camera.lookAt(0, 1.6, -3);

      const playing = phase === 'playing' && performance.now() >= startAt && yt;
      const lt = playing ? yt.time() - offset : -1;
      if (playing && view.update(lt)) {
        club.pulse(t);
        lyricsEl.style.setProperty('--hue', String((lineAt(lines, lt) * 47) % 360));
      }
      const li = playing ? lineAt(lines, lt) : -1, line = lines[li];
      const active = !!(line && line.text && lt < singEnd(line));

      // mic at 20 Hz: pitch detection is too heavy for every frame on phones
      if ((micTimer += dt) >= 0.05) {
        micTimer = 0;
        if (mic) { const r = mic.read(); myVol = r.vol; myHue = r.hz > 0 && r.vol > 0.08 ? hueOf(r.hz) : -1; }
        else { myVol = active ? 0.35 + 0.3 * Math.abs(Math.sin(t * 9)) : 0; myHue = -1; } // lip-sync without a mic
        if (playing) {
          if (li !== scoringLine) { finishLine(); scoringLine = li; }
          if (active) { lineFrames++; if (mic && myHue >= 0) lineVoiced++; }
        }
      }
      if ((sendTimer += dt) >= 0.1) { sendTimer = 0; if (net.peers().length) net.emit('sing', { v: +myVol.toFixed(2), h: +myHue.toFixed(3), s: myScore }); }
      if (isHost() && playing && (clockTimer += dt) >= 2) { clockTimer = 0; net.emit('clock', { t: yt.time(), playing: yt.playing() }); }
      if ((boardTimer += dt) >= 0.25) { boardTimer = 0; renderBoard(); }

      const singers = [];
      for (const [id, c] of chars) {
        const r = id === net.selfId ? { v: myVol, h: myHue } : remote.get(id);
        const fresh = r && (id === net.selfId || performance.now() - r.at < 1000);
        c.v += ((fresh ? r.v : 0) - c.v) * 0.3;
        c.cheer = Math.max(0, c.cheer - dt);
        animateCharacter(c.root, { t: t + c.root.position.x, sing: c.v, cheer: c.cheer > 0 || (c.v > 0.7 && phase === 'playing') });
        singers.push({ x: c.root.position.x, z: c.root.position.z, v: c.v, h: fresh ? r.h : -1 });
      }
      club.update(t, singers);
    },
    dispose() {
      token++;
      disposed = true;
      timers.forEach(clearTimeout);
      mic?.stop();
      yt?.destroy();
      chars.forEach(dropChar);
      club.dispose();
      root.remove();
      css.remove();
      camera.clearViewOffset();
      scene.fog = oldFog; scene.background = oldBg;
      hidden.forEach(o => { o.visible = true; });
    },
  };
}
