import { cleanProfile, PRESETS } from './proto.js';

const KEY = 'gerygames.profile';

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { profile: cleanProfile(JSON.parse(raw)), isNew: false };
  } catch { /* private mode or corrupt: fall through to a fresh look */ }
  const preset = PRESETS[Math.floor(Math.random() * PRESETS.length)];
  return { profile: cleanProfile({ ...preset, name: '' }), isNew: true };
}

export function saveProfile(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* not persisted this session */ }
}
