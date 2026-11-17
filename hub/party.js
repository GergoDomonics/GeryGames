// Parties over the hub room. The party's creator is its host: it keeps the member list and says "go".
import { cleanParty, partyCode } from '../shared/proto.js';
import { GAMES } from '../games/registry.js';

export function createParty({ panel, nameOf, sfx, toast, onStart }) {
  const ads = new Map(); // code -> {slug, code, members, host, seen}
  let net = null, mine = null, game = null; // mine: {slug, code, members, host}
  const isHost = () => mine && mine.host === net?.selfId;
  const advertise = target => isHost() && net.emit('party', { slug: mine.slug, code: mine.code, members: mine.members }, target);

  function bind(n) {
    net = n;
    ads.clear();
    if (mine && !isHost()) mine = null; // our host is in another room now
    if (isHost()) mine.members = [net.selfId];
    n.on('party', (d, from) => {
      const p = cleanParty(d, GAMES);
      if (!p || !p.members.includes(from)) return;
      ads.set(p.code, { ...p, host: from, seen: performance.now() });
      if (mine?.code === p.code && mine.host === from) {
        const max = GAMES.find(g => g.slug === p.slug).maxPlayers;
        if (p.members.includes(net.selfId)) { mine.members = p.members; mine.confirmed = true; }
        // an advert without us: removed if we were in, full if we never got in; else our join is still in flight
        else if (mine.confirmed || p.members.length >= max) { mine = null; toast(p.members.length >= max ? 'That party is full' : 'You left the party'); }
      }
      render();
    });
    n.on('party-end', (d, from) => {
      const ad = ads.get(d?.code);
      if (!ad || ad.host !== from) return;
      ads.delete(ad.code);
      if (mine?.code === ad.code && !isHost()) { mine = null; toast('The party was closed'); }
      render();
    });
    n.on('party-join', (d, from) => {
      if (!isHost() || d?.code !== mine.code || mine.members.includes(from)) return;
      if (mine.members.length >= GAMES.find(g => g.slug === mine.slug).maxPlayers) return advertise(from); // full: they see they're not in
      mine.members.push(from);
      sfx.play('join');
      advertise();
      render();
    });
    n.on('party-leave', (d, from) => {
      if (!isHost() || d?.code !== mine.code) return;
      mine.members = mine.members.filter(m => m !== from);
      advertise();
      render();
    });
    n.on('party-go', (d, from) => {
      if (!mine || from !== mine.host || d?.code !== mine.code || !Array.isArray(d.members) || !d.members.includes(net.selfId)) return;
      const members = d.members.filter(m => typeof m === 'string').slice(0, 16);
      const go = mine;
      mine = null;
      onStart(go.slug, go.code, members, go.host);
    });
    n.onJoin(id => advertise(id));
    n.onLeave(id => {
      for (const [code, ad] of ads) if (ad.host === id) ads.delete(code);
      if (mine && mine.host === id) { mine = null; toast('The party host left'); }
      if (isHost() && mine.members.includes(id)) { mine.members = mine.members.filter(m => m !== id); advertise(); }
      render();
    });
  }

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const button = (text, cls, fn) => { const b = el('button', 'btn ' + cls, text); b.onclick = () => { sfx.play('click'); fn(); }; return b; };

  function render() {
    const shown = mine ? GAMES.find(g => g.slug === mine.slug) : game;
    panel.hidden = !shown;
    if (!shown) return;
    panel.replaceChildren();
    panel.style.setProperty('--game', shown.color);
    panel.append(el('h2', null, shown.title), el('p', 'blurb', shown.blurb));
    if (mine) {
      panel.append(el('p', 'label', `Your party · ${mine.members.length}/${shown.maxPlayers}`));
      const list = el('ul', 'members');
      for (const id of mine.members) list.append(el('li', id === mine.host ? 'host' : '', (id === mine.host ? '👑 ' : '') + nameOf(id)));
      panel.append(list);
      const row = el('div', 'row');
      if (isHost()) {
        const start = button('Start!', 'primary', () => {
          const members = [...mine.members];
          net.emit('party-go', { code: mine.code, members });
          net.emit('party-end', { code: mine.code });
          const go = mine;
          mine = null;
          onStart(go.slug, go.code, members, go.host);
        });
        start.disabled = mine.members.length < shown.minPlayers;
        if (start.disabled) start.title = `Needs ${shown.minPlayers} players`;
        row.append(start);
      } else row.append(el('p', 'label', 'Waiting for the host to start…'));
      row.append(button('Leave', '', leave));
      panel.append(row);
      return;
    }
    const open = [...ads.values()].filter(a => a.slug === shown.slug);
    if (open.length) {
      panel.append(el('p', 'label', 'Open parties'));
      const list = el('ul', 'members');
      for (const a of open) {
        const li = el('li', null, `${nameOf(a.host)}'s party · ${a.members.length}/${shown.maxPlayers}`);
        li.append(button('Join', 'small', () => { mine = { slug: a.slug, code: a.code, members: a.members, host: a.host }; net.emit('party-join', { code: a.code }, a.host); render(); }));
        list.append(li);
      }
      panel.append(list);
    }
    panel.append(button('Create party', 'primary', () => {
      mine = { slug: shown.slug, code: partyCode(), members: [net.selfId], host: net.selfId };
      advertise();
      render();
    }));
  }

  function leave() {
    if (!mine) return;
    net.emit(isHost() ? 'party-end' : 'party-leave', { code: mine.code }, isHost() ? undefined : mine.host);
    mine = null;
    render();
  }

  setInterval(() => { // keep adverts fresh, forget silent ones
    advertise();
    const now = performance.now();
    let changed = false;
    for (const [code, ad] of ads) if (now - ad.seen > 7000 && ad.code !== mine?.code) { ads.delete(code); changed = true; }
    if (changed) render();
  }, 2000);

  return {
    bind,
    render,
    // called each frame with the portal the player stands in (or null)
    setNear(g) { if (g !== game) { game = g; if (g) sfx.play('pop'); render(); } },
    get inParty() { return !!mine; },
  };
}
