// ─────────────────────────────────────────────────────────────
// audio.js — all sound effects, made from code (Web Audio API).
// No audio files: every sound is a few tones and bits of noise.
//
//   sfx('save', { combo: 3 })   → play one sound
//   setMuted(true/false)        → mute switch (remembered on this device)
//
// Browsers only allow sound after the player taps something, so
// unlock() is called from the "Start shift" button.
// ─────────────────────────────────────────────────────────────

let ctx = null;
let master = null;
let noiseBuffer = null;
let muted = false;
try {
  muted = localStorage.getItem('pump-panic-muted') === '1';
} catch {
  /* storage blocked: just start unmuted */
}

export function unlock() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    // 1 second of white noise, reused for hiss / spray / boom
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export const isMuted = () => muted;
export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = muted ? 0 : 0.5;
  try {
    localStorage.setItem('pump-panic-muted', muted ? '1' : '0');
  } catch {
    /* ignore */
  }
}

// ── Building blocks ──────────────────────────────────────────

// Extra start time, only used when rendering a soundtrack offline (renderOffline)
let offset = 0;

// A tone: frequency (Hz), optional slide to another frequency
function tone({ freq, to = freq, dur = 0.15, type = 'sine', vol = 0.3, delay = 0 }) {
  const t = ctx.currentTime + delay + offset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// Filtered noise: hiss, splash, rumble
function noise({ dur = 0.3, filter = 'bandpass', freq = 1000, q = 1, vol = 0.3, delay = 0 }) {
  const t = ctx.currentTime + delay + offset;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(gain).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

// ── The sounds ───────────────────────────────────────────────

const SOUNDS = {
  // a pump got a problem: two quick beeps
  trouble: () => {
    tone({ freq: 880, dur: 0.07, type: 'square', vol: 0.08 });
    tone({ freq: 660, dur: 0.09, type: 'square', vol: 0.08, delay: 0.09 });
  },
  // tool button pressed
  tool: () => tone({ freq: 520, to: 700, dur: 0.06, type: 'triangle', vol: 0.15 }),
  // nobody needs that tool: low "nope"
  nope: () => tone({ freq: 160, to: 110, dur: 0.18, type: 'square', vol: 0.12 }),
  // short splash while holding COOL
  spray: () => noise({ dur: 0.09, filter: 'highpass', freq: 3500, vol: 0.12 }),
  // steam hiss for VENT
  vent: () => noise({ dur: 0.7, filter: 'bandpass', freq: 1800, q: 0.7, vol: 0.35 }),
  // wrench clank for FIX
  clank: () => {
    tone({ freq: 1400 + Math.random() * 300, to: 900, dur: 0.08, type: 'triangle', vol: 0.25 });
    noise({ dur: 0.05, filter: 'highpass', freq: 5000, vol: 0.15 });
  },
  // saved! rising chime, higher with a bigger combo
  save: ({ combo = 1 } = {}) => {
    const base = 523 * Math.pow(2, (Math.min(combo, 4) - 1) / 6); // up a step per combo
    [1, 1.26, 1.5, 2].forEach((m, k) => tone({ freq: base * m, dur: 0.18, type: 'triangle', vol: 0.18, delay: k * 0.06 }));
  },
  // explosion: noise rumble + deep thud
  boom: () => {
    noise({ dur: 1.1, filter: 'lowpass', freq: 600, vol: 0.9 });
    tone({ freq: 90, to: 30, dur: 0.6, type: 'sine', vol: 0.8 });
  },
  // a pump is critical
  alarm: () => tone({ freq: 1040, dur: 0.07, type: 'square', vol: 0.07 }),
  // last 10 seconds
  tick: () => tone({ freq: 1500, dur: 0.03, type: 'sine', vol: 0.12 }),
  // Hall B online: rising sweep
  online: () => {
    tone({ freq: 220, to: 880, dur: 0.5, type: 'sawtooth', vol: 0.1 });
    tone({ freq: 880, dur: 0.25, type: 'triangle', vol: 0.15, delay: 0.5 });
  },
  start: () => [440, 554, 659].forEach((f, k) => tone({ freq: f, dur: 0.15, type: 'triangle', vol: 0.15, delay: k * 0.08 })),
  win: () => [523, 659, 784, 1047].forEach((f, k) => tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.18, delay: k * 0.1 })),
  lose: () => [392, 330, 262, 196].forEach((f, k) => tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.18, delay: k * 0.12 })),
};

export function sfx(name, opts) {
  if (import.meta.env.DEV) window.__sfxLog?.(name, opts); // dev: lets the video recorder note each sound
  if (!ctx || muted) return;
  SOUNDS[name]?.(opts);
}

// DEV TOOL: build a soundtrack offline from a list of { t, name, opts }
// (t = seconds), using the exact same sounds as the game. Returns a WAV file
// as base64. Used to put game sounds on the gameplay video.
export async function renderOffline(events, duration) {
  const rate = 48000;
  const saved = { ctx, master, noiseBuffer };
  ctx = new OfflineAudioContext(1, Math.ceil(duration * rate), rate);
  noiseBuffer = ctx.createBuffer(1, rate, rate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  // gentle limiter so overlapping booms don't distort
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.ratio.value = 8;
  limiter.connect(ctx.destination);
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(limiter);

  for (const e of events) {
    offset = e.t;
    SOUNDS[e.name]?.(e.opts);
  }
  offset = 0;
  const buffer = await ctx.startRendering();
  ({ ctx, master, noiseBuffer } = saved);

  // 16-bit mono WAV
  const pcm = buffer.getChannelData(0);
  const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  out.setUint32(4, 36 + pcm.length * 2, true);
  str(8, 'WAVEfmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 1, true);
  out.setUint32(24, rate, true);
  out.setUint32(28, rate * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  str(36, 'data');
  out.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  let bin = '';
  const bytes = new Uint8Array(out.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
