// V1.6: both difficulty choices use the same 180 effective play seconds.
// Keep one game clock: FruitGame.update is still authoritative for remaining,
// elapsed, physics, scoring and onEnd. This adapter does not run a second timer.
export const ROUND_SECONDS = 180;

export function formatRoundTime(seconds) {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// Only count intervals that belonged to active play at both ends of this
// animation callback. In particular a countdown/paused/auto-paused -> playing
// transition must not debit the previously unplayable interval. Retain V1.5's
// .5 s cap on a severe visible stall (its separate physics cap is untouched).
export function effectiveFrameSeconds(previousNow, now, activeBefore, activeAfter) {
  if (!activeBefore || !activeAfter || !Number.isFinite(previousNow) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.min(.5, (now - previousNow) / 1000));
}

// Do not read, copy, migrate or overwrite V1.5's 60-second score keys. A
// longer round is not comparable with those records; preserve both histories.
export function roundBestKey(mode) {
  return mode === 'active' || mode === 'easy' ? `fruit-planet-best-180-${mode}` : null;
}

const safeScore = value => Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;

export function bestForMode(storage, mode, score) {
  const current = safeScore(score), key = roundBestKey(mode);
  if (!storage || !key) return current;
  let previous = 0;
  try { previous = safeScore(Number(storage.getItem(key))); } catch {}
  const best = Math.max(current, previous);
  // Safari/private contexts can deny storage. An unpersistable record should
  // still show this round's result and must not prevent returning home/replay.
  try { storage.setItem(key, String(best)); } catch {}
  return best;
}
