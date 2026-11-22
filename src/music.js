// ─────────────────────────────────────────────────────────────
// music.js — the background music, made live from code (no files).
//
// An original slapstick "oom-pah" tune in a cartoon style, F major, 126 BPM:
//   tuba-like bass on beats 1 and 3, plucked chord on 2 and 4,
//   a bouncy clarinet-like melody from bar 3, woodblocks when tension is on.
//
//   startMusic()       → start at the beginning of a shift
//   setTension(true)   → add woodblocks (after a boom / near the end)
//   stopMusic()        → fade out
//   playEndTag(won)    → "wah-wah-wah-waaah" (station down) or a happy flourish
//
// The music plays quietly and dips a little under each sound effect.
// It uses the same audio output as the sounds, so the mute button mutes it.
// ─────────────────────────────────────────────────────────────

import { getAudio, setSfxListener } from './audio.js';

const VOLUME = 0.3; // music level (sound effects are ~1)
const BEAT = 60 / 126;
const BAR = BEAT * 4;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// F – C7 – F – C. root/fifth for the bass, chord for the "pah"
const HARMONY = [
  { root: 41, fifth: 48, chord: [65, 69, 72] },
  { root: 36, fifth: 43, chord: [64, 67, 70] },
  { root: 41, fifth: 48, chord: [65, 69, 72] },
  { root: 36, fifth: 43, chord: [64, 67, 72] },
];
// Melody: 8 eighth-notes per bar (null = rest)
const MELODY = [
  [72, 69, 65, 69, 72, null, 74, 72],
  [70, 67, 64, 67, 70, null, 72, 70],
  [69, 72, 77, 72, 69, 65, 67, 69],
  [67, 64, 60, 64, 67, null, null, null],
  [72, 74, 76, 77, 76, 74, 72, 69],
  [70, 72, 74, 72, 70, 67, 64, null],
  [69, 65, 69, 72, 77, 76, 74, 72],
  [67, 64, 67, 70, 72, null, null, null],
];

let bus = null; // gain node for the current music
let timer = null;
let nextBar = 0;
let barIndex = 0;
let tension = false;

// ── Instruments ──────────────────────────────────────────────

function voice(ctx, dest, n, t, len, { type = 'triangle', vol = 0.1, attack = 0.008, filter = null, vibrato = 0, pan = 0 } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = midi(n);
  let lfo = null;
  if (vibrato) {
    lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const lg = ctx.createGain();
    lg.gain.value = vibrato;
    lfo.connect(lg).connect(o.detune);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + len * 0.6);
  g.gain.linearRampToValueAtTime(0, t + len);
  let node = o;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    o.connect(f);
    node = f;
  }
  node.connect(g);
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p).connect(dest);
  } else g.connect(dest);
  o.start(t);
  o.stop(t + len + 0.05);
  if (lfo) {
    lfo.start(t);
    lfo.stop(t + len + 0.05);
  }
}

const tuba = (ctx, d, n, t) => {
  voice(ctx, d, n, t, BEAT * 0.55, { vol: 0.2, filter: 520 });
  voice(ctx, d, n, t, BEAT * 0.55, { type: 'square', vol: 0.035, filter: 420 });
};
const pah = (ctx, d, notes, t) => notes.forEach((n, k) => voice(ctx, d, n, t, 0.11, { vol: 0.045, pan: (k - 1) * 0.3 }));
const clar = (ctx, d, n, t, len, vol = 0.05) => voice(ctx, d, n, t, len, { type: 'square', vol, attack: 0.015, filter: 1700, vibrato: 10, pan: 0.15 });
const block = (ctx, d, t, high) => voice(ctx, d, high ? 84 : 79, t, 0.05, { type: 'sine', vol: 0.06, attack: 0.002 });

// One bar of the tune, starting at time t0
function scheduleBar(ctx, d, b, t0) {
  const h = HARMONY[b % 4];
  for (let i = 0; i < 4; i++) {
    const tb = t0 + i * BEAT;
    if (i % 2 === 0) tuba(ctx, d, i === 0 ? h.root : h.fifth, tb);
    else pah(ctx, d, h.chord, tb);
    if (tension) block(ctx, d, tb + BEAT / 2, i % 2 === 0);
  }
  if (b >= 2) {
    MELODY[(b - 2) % MELODY.length].forEach((n, k) => {
      if (n !== null) clar(ctx, d, n, t0 + (k * BEAT) / 2, BEAT * 0.42);
    });
  }
}

// Schedules a little ahead of time, so the music never stutters
function tick() {
  const { ctx } = getAudio();
  if (!ctx || !bus) return;
  while (nextBar < ctx.currentTime + 0.6) {
    scheduleBar(ctx, bus, barIndex, nextBar);
    nextBar += BAR;
    barIndex++;
  }
}

// ── Controls ─────────────────────────────────────────────────

export function startMusic() {
  const { ctx, master } = getAudio();
  if (!ctx) return;
  stopMusic(0.01);
  bus = ctx.createGain();
  bus.gain.value = VOLUME;
  bus.connect(master);
  tension = false;
  barIndex = 0;
  nextBar = ctx.currentTime + 0.15;
  tick();
  timer = setInterval(tick, 100);
  // dip the music a little under every sound effect, then bring it back
  setSfxListener(() => {
    if (!bus) return;
    const now = ctx.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setTargetAtTime(VOLUME * 0.55, now, 0.02);
    bus.gain.setTargetAtTime(VOLUME, now + 0.25, 0.25);
  });
}

export const setTension = (on) => (tension = on);

export function stopMusic(fade = 0.08) {
  clearInterval(timer);
  timer = null;
  setSfxListener(null);
  const { ctx } = getAudio();
  if (!bus || !ctx) return;
  const old = bus;
  bus = null;
  old.gain.cancelScheduledValues(ctx.currentTime);
  old.gain.setTargetAtTime(0, ctx.currentTime, fade);
  setTimeout(() => old.disconnect(), 1500);
}

// End of shift: comedic trombone fall (station down) or a happy flourish
export function playEndTag(won) {
  const { ctx, master } = getAudio();
  if (!ctx) return;
  const out = ctx.createGain();
  out.gain.value = 0.9;
  out.connect(master);
  const t = ctx.currentTime + 0.05;

  if (won) {
    // oom-pah cadence + clarinet run up to a bright final chord
    [[41, 0], [36, 1], [41, 2]].forEach(([n, k]) => tuba(ctx, out, n, t + k * BEAT));
    [65, 69, 72, 77].forEach((n, k) => clar(ctx, out, n, t + k * BEAT * 0.5, BEAT * 0.45, 0.06));
    [65, 69, 72, 77].forEach((n) => voice(ctx, out, n, t + BEAT * 2, 1.2, { vol: 0.05 }));
    return;
  }

  // "wah… wah… wah… waaaah"
  const trombone = (n, start, len, bendTo, wobble) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(midi(n), start);
    if (bendTo) o.frequency.linearRampToValueAtTime(midi(bendTo), start + len * 0.9);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(500, start);
    f.frequency.linearRampToValueAtTime(1400, start + 0.08);
    f.frequency.linearRampToValueAtTime(600, start + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.08, start + 0.05);
    g.gain.setValueAtTime(0.08, start + len * 0.7);
    g.gain.linearRampToValueAtTime(0, start + len);
    if (wobble) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 6;
      const lg = ctx.createGain();
      lg.gain.value = 35;
      lfo.connect(lg).connect(o.detune);
      lfo.start(start);
      lfo.stop(start + len + 0.05);
    }
    o.connect(f).connect(g).connect(out);
    o.start(start);
    o.stop(start + len + 0.05);
  };
  trombone(55, t, 0.45);
  trombone(54, t + 0.5, 0.45);
  trombone(53, t + 1.0, 0.45);
  trombone(52, t + 1.5, 1.6, 50, true);
}
