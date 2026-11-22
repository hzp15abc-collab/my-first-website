// V1.6: ten actual material-based fruit cues per bank and a separate reward.
// Existing style IDs and the five music choices remain unchanged. Real CC0
// WAVs (including explicit material proxies) are prepared at build time.
import { FRUIT_TYPES } from './game.js';
export const DEFAULT_SFX = 'juice';
export const SFX_EVENTS = Object.freeze(['slice', 'combo', 'bomb', 'wave', 'countdown', 'start', 'end']);
export const SFX_BANK_LABELS = Object.freeze({ juice: '街机果汁 · 实录材质', chime: '泡泡乐园 · 轻柔玩具', off: '关闭音效' });
export const SFX_FRUIT_TYPES = FRUIT_TYPES;
export const SFX_COMBO_DELAY = .085;
export const SFX_BUNDLE_REVISION = 'v17-cartoon-bomb-24000-mono-1';
export const SFX_BUNDLE_MAX_BYTES = 700 * 1024;

// Only the two V1.7 cartoon-obstacle assets have a new physical identity.
// The existing loader uses force-cache; content-versioned filenames prevent
// a browser with a previous version's audio cache from replaying an old cue.
const BOMB_FILES = Object.freeze({
  'juice-bomb': 'juice-bomb.df79ee481e5c.wav',
  'chime-bomb': 'chime-bomb.2ea43c60e9a3.wav',
});

function clip(id, level, fruitType) {
  const file=BOMB_FILES[id]||`${id}.wav`;
  return Object.freeze({ id, src: new URL(`../assets/sfx/${file}`, import.meta.url).href, level,
    ...(BOMB_FILES[id] ? {file} : {}), ...(fruitType ? {fruitType} : {}) });
}

function bank(id, levels) {
  const entries = SFX_EVENTS.map(event => [event, Object.freeze(event === 'slice'
    ? SFX_FRUIT_TYPES.map(fruit => clip(`${id}-slice-${fruit}`, levels.slice, fruit))
    : [clip(`${id}-${event}`, levels[event])])]);
  return Object.freeze(Object.fromEntries(entries));
}

// Each actual cut selects its own material recording. A combo is reward-only,
// scheduled after the fruit cue (not a replacement or a second cutting sound).
// The obstruction's peak is kept below a fruit cue despite its fuller tail.
export const SFX_BANKS = Object.freeze({
  juice: bank('juice', { slice: 1.12, combo: .83, bomb: .90, wave: .50, countdown: .80, start: .90, end: .85 }),
  chime: bank('chime', { slice: 1.12, combo: .83, bomb: .90, wave: .34, countdown: .80, start: .90, end: .85 }),
});

export const SFX_CLIPS = Object.freeze(Object.fromEntries(
  Object.values(SFX_BANKS).flatMap(events => Object.values(events).flat()).map(clip => [clip.id, clip])
));

export function normalizeEffectsStyle(value) {
  return typeof value === 'string' && (value === 'off' || Object.hasOwn(SFX_BANKS, value)) ? value : DEFAULT_SFX;
}
