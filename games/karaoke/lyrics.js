// LRCLIB lyrics (free, no key, CORS open) + a Spotify-style scrolling lyrics view.
import { lineAt, lineProgress } from './logic.js';

const API = 'https://lrclib.net/api';
const get = async url => {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Lyrics site answered ${r.status}`);
  return r.json();
};
export const searchLyrics = q => get(`${API}/search?q=${encodeURIComponent(q)}`);
export const fetchLyrics = id => get(`${API}/get/${id}`);

export function createLyricsView(el) {
  const list = document.createElement('div');
  list.className = 'kk-lines';
  el.replaceChildren(list);
  let lines = [], rows = [], cur = -2, y = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    set(newLines, message = '') {
      lines = newLines;
      cur = -2;
      rows = lines.map(l => {
        const p = document.createElement('p');
        p.textContent = l.text || '♪';
        if (!l.text) p.className = 'gap';
        return p;
      });
      if (!rows.length) {
        const p = document.createElement('p');
        p.className = 'note';
        p.textContent = message;
        rows.push(p);
      }
      list.replaceChildren(...rows);
      y = 0;
      list.style.transform = '';
    },
    // returns true when the active line changed
    update(t) {
      const i = lineAt(lines, t);
      const changed = i !== cur;
      if (changed) {
        rows[cur]?.classList.remove('on');
        rows.forEach((r, k) => r.classList.toggle('past', k < i));
        rows[i]?.classList.add('on');
        cur = i;
      }
      if (rows[i] && lines[i]) rows[i].style.setProperty('--p', `${(lineProgress(lines[i], t) * 100).toFixed(1)}%`);
      const target = rows[Math.max(0, i)] ? rows[Math.max(0, i)].offsetTop - el.clientHeight * 0.3 : 0;
      y = still ? target : y + (target - y) * 0.12;
      list.style.transform = `translateY(${-Math.max(0, y)}px)`;
      return changed && i >= 0;
    },
  };
}
