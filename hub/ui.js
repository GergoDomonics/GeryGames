// Title screen, customizer, HUD and toast. DOM only; the 3D side reacts through callbacks.
import { HAIR_STYLES, ACCESSORIES, PALETTE, PRESETS, cleanProfile } from '../shared/proto.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

let toastTimer;
export function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

export function setStatus(count) {
  const s = $('status');
  s.textContent = count > 1 ? `${count} players here` : 'Looking for friends…';
  s.classList.toggle('live', count > 1);
}

// get(): current profile; set(profile): apply + save; sfx for clicks
export function createCustomizer({ get, set, sfx, onOpen, onClose }) {
  const panel = $('custom'), body = $('custom-body');
  const update = patch => { set(cleanProfile({ ...get(), ...patch })); render(); };
  const section = title => { const s = el('div', 'opt'); s.append(el('h3', null, title)); body.append(s); return s; };

  function chips(title, values, key) {
    const wrap = el('div', 'chips');
    for (const v of values) {
      const b = el('button', 'btn', v);
      b.setAttribute('aria-pressed', get()[key] === v);
      b.onclick = () => { sfx.play('click'); update({ [key]: v }); };
      wrap.append(b);
    }
    section(title).append(wrap);
  }
  function colors(title, key, palette) {
    const wrap = el('div', 'swatches');
    const cur = get()[key];
    for (const c of palette) {
      const b = el('button', 'swatch');
      b.style.background = c;
      b.setAttribute('aria-label', `${title} ${c}`);
      b.setAttribute('aria-pressed', cur === c);
      b.onclick = () => { sfx.play('click'); update({ [key]: c }); };
      wrap.append(b);
    }
    const any = el('label', 'swatch custom');
    any.setAttribute('aria-pressed', !palette.includes(cur));
    const input = el('input');
    input.type = 'color';
    input.value = cur;
    input.setAttribute('aria-label', `Any ${title.toLowerCase()} colour`);
    input.onchange = () => update({ [key]: input.value });
    any.append(input);
    wrap.append(any);
    section(title).append(wrap);
  }

  function render() {
    body.replaceChildren();
    const name = el('input');
    name.type = 'text'; name.maxLength = 16; name.value = get().name; name.setAttribute('aria-label', 'Your name');
    name.onchange = () => update({ name: name.value });
    section('Name').append(name);

    const presets = el('div', 'chips');
    PRESETS.forEach((pr, i) => {
      const b = el('button', 'btn');
      b.setAttribute('aria-label', `Preset ${i + 1}`);
      const dots = el('span', 'preset');
      for (const c of [pr.skin, pr.hair, pr.shirt, pr.pants]) { const d = el('i'); d.style.background = c; dots.append(d); }
      b.append(dots);
      b.onclick = () => { sfx.play('pop'); update({ ...pr, name: get().name }); };
      presets.append(b);
    });
    section('Presets').append(presets);
    chips('Hair style', HAIR_STYLES, 'hairStyle');
    chips('Accessory', ACCESSORIES, 'acc');
    colors('Skin', 'skin', PALETTE.skin);
    colors('Hair', 'hair', PALETTE.hair);
    colors('Shirt', 'shirt', PALETTE.cloth);
    colors('Pants', 'pants', PALETTE.cloth);
    colors('Shoes', 'shoes', PALETTE.cloth);
  }

  const open = () => { render(); panel.hidden = false; onOpen(); };
  const close = () => { panel.hidden = true; onClose(); };
  $('custom-done').onclick = () => { sfx.play('click'); close(); };
  addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) close(); });
  return { open, close, get isOpen() { return !panel.hidden; } };
}

// Title screen: resolves {name, customize} once Play or Customize is pressed.
export function showTitle({ profile, sfx }) {
  const name = $('name');
  name.value = profile.name === 'Guest' ? '' : profile.name;
  return new Promise(resolve => {
    const go = customize => { sfx.unlock(); sfx.play('start'); $('title').hidden = true; $('hud').hidden = false; resolve({ name: name.value, customize }); };
    $('play').onclick = () => go(false);
    $('title-custom').onclick = () => go(true);
    name.onkeydown = e => { if (e.key === 'Enter') go(false); };
  });
}

export function wireHud({ sfx, onCustomize }) {
  const mute = $('btn-mute');
  const show = () => { mute.textContent = sfx.muted ? '🔇' : '🔊'; mute.setAttribute('aria-label', sfx.muted ? 'Unmute' : 'Mute'); };
  show();
  mute.onclick = () => { sfx.toggleMute(); show(); };
  $('btn-custom').onclick = () => { sfx.play('click'); onCustomize(); };
}
