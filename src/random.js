// ─────────────────────────────────────────────────────────────
// random.js — the daily challenge
//
// A "seeded" random generator gives the same sequence of numbers for
// the same seed. Today's date is the seed, so everyone who plays today
// gets the same problems at the same moments — scores are comparable.
// ─────────────────────────────────────────────────────────────

const LAUNCH = Date.UTC(2026, 10, 21); // day #1 (months start at 0 → 10 = November)

// Small, well-known seeded generator (mulberry32). Returns 0 ≤ x < 1.
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Today's challenge: same for everyone (based on the UTC date)
export function dailyInfo(now = new Date()) {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const number = Math.max(1, Math.round((day - LAUNCH) / 86400000) + 1);
  const key = new Date(day).toISOString().slice(0, 10); // "2026-11-21"
  const label = new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return { seed: number * 2654435761, number, key, label };
}

// Best score of the day, remembered on this device
export function getBest(key) {
  try {
    return Number(localStorage.getItem(`pump-panic-best-${key}`)) || 0;
  } catch {
    return 0;
  }
}
export function saveBest(key, score) {
  try {
    if (score > getBest(key)) localStorage.setItem(`pump-panic-best-${key}`, String(score));
  } catch {
    /* storage blocked: nothing to remember */
  }
}
