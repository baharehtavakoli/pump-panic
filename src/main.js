// ─────────────────────────────────────────────────────────────
// main.js — the game rules
//
//   config.js    → all tuning numbers and texts
//   scene.js     → the 3D station and pump visuals
//   particles.js → steam, water, smoke, sparks
//   audio.js     → sound effects (made from code)
//   ui.js        → HUD, tool tray, gestures, screens
//   random.js    → daily challenge (same problems for everyone today)
//   share.js     → result card image + LinkedIn sharing
//
// One shift = 90 seconds. Problems pop up on random pumps and get
// worse every second. Press the matching tool button (the badge above
// the pump shows which), do the gesture, and the pump is saved.
// Hall B (3 more pumps) powers on halfway through.
// If a danger meter fills up: BOOM (3 booms = game over).
// ─────────────────────────────────────────────────────────────

import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/rubik/latin-800.css';
import '@fontsource/lilita-one/latin-400.css'; // chunky display font for titles and buttons
import './style.css';
import { CONFIG, TROUBLES, NO_TARGET, RANKS } from './config.js';
import { createWorld, PUMP_POS } from './scene.js';
import { createUI, TOOLS } from './ui.js';
import { sfx, unlock, isMuted, setMuted } from './audio.js';
import { makeRng, dailyInfo, getBest, saveBest } from './random.js';
import { drawCard, shareResult, saveImage } from './share.js';

const world = createWorld(document.getElementById('stage'));
const lerp = (a, b, t) => a + (b - a) * t;
const buzz = (pattern) => navigator.vibrate?.(pattern); // phone vibration (Android)

// ── Game state ───────────────────────────────────────────────

let game = null;

function newGame(mode) {
  return {
    mode, // 'daily' | 'practice'
    // Daily: seeded by today's date, so everyone gets the same problems
    rng: makeRng(mode === 'daily' ? daily.seed : Math.floor(Math.random() * 1e9)),
    timeline: [], // 'save' / 'boom' in order (for the result card)
    phase: 'play', // 'play' | 'over'
    time: 0,
    nextTrouble: CONFIG.firstTroubleAt,
    hallBOnline: false,
    score: 0,
    saves: 0,
    combo: 0,
    bestCombo: 0,
    explosions: 0,
    water: 0,
    selected: null, // index of the pump the player is working on
    alarmTimer: 0, // for the critical beep
    lastTick: 99, // for the countdown tick
    lastSpray: 0, // for the spray sound
    pumps: PUMP_POS.map((_, i) => ({
      name: `Pump ${i + 1}`,
      online: i < 3, // Hall A is on from the start
      trouble: null, // 'heat' | 'pressure' | 'clog' | null
      danger: 0, // 0–100
      working: false, // player is doing the gesture on it (danger pauses)
      broken: 0, // seconds until repaired after an explosion
    })),
  };
}

const daily = dailyInfo();
let lastResult = null;

const ui = createUI({
  onStart: start,
  onRestart: () => start(game?.mode ?? 'daily'),
  onShare: async () => {
    ui.shareNote(await shareResult(lastResult));
  },
  onSaveImage: () => saveImage(lastResult),
  onTool: useTool,
  onGestureDone: gestureDone,
  onSpray: () => {
    if (game.selected === null) return;
    world.spray(game.selected);
    if (game.time - game.lastSpray > 0.09) {
      sfx('spray');
      game.lastSpray = game.time;
    }
  },
  onTap: () => {
    if (game.selected === null) return;
    world.hit(game.selected);
    sfx('clank');
    buzz(15);
  },
});

function start(mode = 'daily') {
  unlock(); // sound is allowed now (the player tapped)
  // Repair any pumps still broken from the last game
  if (game) game.pumps.forEach((p, i) => p.broken > 0 && world.restore(i));
  game = newGame(mode);
  world.setHallB(false);
  stopWorking();
  ui.showScreen(null);
  sfx('start');
}

// ── Player actions ───────────────────────────────────────────

// Stop working on the current pump (its danger starts rising again)
function stopWorking() {
  if (game?.selected != null) game.pumps[game.selected].working = false;
  if (game) game.selected = null;
  world.select(null);
  ui.cancelGesture();
}

// A tool button was pressed: work on the most urgent pump that needs it
function useTool(tool) {
  if (game?.phase !== 'play') return;
  const candidates = game.pumps
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.trouble && p.broken <= 0 && TROUBLES[p.trouble].tool === tool);

  if (!candidates.length) {
    ui.toast(NO_TARGET[tool], 'bad');
    ui.flashTool(tool, 'shake');
    ui.lockTools(CONFIG.noTargetLockout);
    sfx('nope');
    return;
  }
  const { p, i } = candidates.sort((a, b) => b.p.danger - a.p.danger)[0];
  if (game.selected === i) return; // already working on it

  stopWorking();
  game.selected = i;
  p.working = true;
  world.select(i);
  sfx('tool');
  if (tool === 'vent') {
    world.vent(i);
    sfx('vent');
  }
  ui.startGesture(tool, p.name);
}

function gestureDone() {
  const i = game.selected;
  const p = game.pumps[i];
  if (i === null || !p.trouble) return; // it exploded meanwhile

  if (p.trouble === 'pressure') {
    world.vent(i);
    sfx('vent');
  }
  // Points: base × combo, plus a bonus for saving it early
  game.combo++;
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  const mult = Math.min(game.combo, CONFIG.maxCombo);
  const points = CONFIG.pointsPerSave * mult + Math.round((100 - p.danger) / 2);
  game.score += points;
  game.saves++;
  game.timeline.push('save');

  world.celebrate(i); // bounce + sparkles
  world.popup(i, mult > 1 ? `+${points} <small>x${mult}</small>` : `+${points}`, 'good');
  sfx('save', { combo: game.combo });
  buzz(30);

  p.trouble = null;
  p.danger = 0;
  stopWorking();
}

function explode(i) {
  const p = game.pumps[i];
  world.explode(i);
  world.popup(i, 'BOOM!', 'boom');
  sfx('boom');
  buzz([90, 40, 90]);
  game.explosions++;
  game.timeline.push('boom');
  game.combo = 0;
  p.trouble = null;
  p.danger = 0;
  p.broken = CONFIG.repairSeconds;
  if (game.selected === i) stopWorking();
}

// Tapping a pump: no extra step needed, just point at the right button
const stage = document.getElementById('stage');
let downAt = null;
stage.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
stage.addEventListener('pointerup', (e) => {
  if (game?.phase !== 'play' || !downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 12) return;
  const i = world.pick(e.clientX, e.clientY);
  const p = i === null ? null : game.pumps[i];
  if (p?.trouble) {
    const tool = TOOLS.find((t) => t.id === TROUBLES[p.trouble].tool);
    ui.flashTool(tool.id, 'pulse');
    ui.toast(`Press ${tool.label} below!`);
  } else if (p && !p.online) {
    ui.toast(`Hall B powers on at ${CONFIG.hallBOnlineAt}s.`);
  }
});

// Mute button
const muteBtn = document.getElementById('btn-mute');
const showMute = () => muteBtn.classList.toggle('off', isMuted());
muteBtn.addEventListener('click', () => {
  unlock();
  setMuted(!isMuted());
  showMute();
});
showMute();

// ── Rules, every frame ───────────────────────────────────────

function update(dt) {
  const g = game;
  g.time += dt;
  const progress = Math.min(1, g.time / CONFIG.shiftSeconds); // 0 → 1 over the shift

  // Halfway event: Hall B powers on
  if (!g.hallBOnline && g.time >= CONFIG.hallBOnlineAt) {
    g.hallBOnline = true;
    g.pumps.forEach((p, i) => {
      if (!p.online) {
        p.online = true;
        world.powerOn(i);
      }
    });
    world.setHallB(true);
    ui.toast('Hall B is online! 6 pumps now.', 'good');
    sfx('online');
  }

  // Never let the station sit idle: if no pump has a problem,
  // the next one comes very soon (no "nothing is happening" moments)
  if (!g.pumps.some((p) => p.trouble)) g.nextTrouble = Math.min(g.nextTrouble, CONFIG.idleSpawnDelay);

  // New trouble on a random healthy pump
  g.nextTrouble -= dt;
  if (g.nextTrouble <= 0) {
    const [rPump, rType, rWait] = [g.rng(), g.rng(), g.rng()];
    const free = g.pumps.filter((p) => p.online && !p.trouble && p.broken <= 0);
    if (free.length) {
      const kinds = Object.keys(TROUBLES);
      free[Math.floor(rPump * free.length)].trouble = kinds[Math.floor(rType * kinds.length)];
      sfx('trouble');
    }
    g.nextTrouble = lerp(CONFIG.spawnEvery.start, CONFIG.spawnEvery.end, progress) * (0.75 + rWait * 0.5);
  }

  // Troubles get worse; repairs tick down; working pumps deliver water
  const rate = lerp(CONFIG.dangerPerSecond.start, CONFIG.dangerPerSecond.end, progress);
  g.pumps.forEach((p, i) => {
    if (!p.online) return;
    if (p.broken > 0) {
      p.broken -= dt;
      if (p.broken <= 0) {
        world.restore(i);
      }
      return;
    }
    g.water += CONFIG.waterPerPumpSecond * dt;
    if (p.trouble && !p.working) {
      p.danger += rate * dt;
      if (p.danger >= 100) explode(i);
    }
  });

  // Alarm beep while any pump is critical (faster when closer to boom)
  const worst = Math.max(0, ...g.pumps.filter((p) => p.trouble && !p.working).map((p) => p.danger));
  g.alarmTimer -= dt;
  if (worst > 70 && g.alarmTimer <= 0) {
    sfx('alarm');
    g.alarmTimer = worst > 88 ? 0.25 : 0.5;
  }
  // Red glow at the screen edges when something is about to blow
  document.getElementById('vignette').style.opacity = worst > 70 ? ((worst - 70) / 30).toFixed(2) : 0;

  // Countdown tick in the last 10 seconds
  const left = Math.ceil(CONFIG.shiftSeconds - g.time);
  if (left <= 10 && left < g.lastTick) {
    g.lastTick = left;
    sfx('tick');
  }

  // End of shift
  if (g.explosions >= CONFIG.maxExplosions || g.time >= CONFIG.shiftSeconds) endGame();
}

function endGame() {
  const g = game;
  g.phase = 'over';
  stopWorking();
  document.getElementById('vignette').style.opacity = 0;
  const stationDown = g.explosions >= CONFIG.maxExplosions;
  const score = g.score + Math.round(g.water);
  const rank = [...RANKS].reverse().find((r) => score >= r.min).title;
  const best = g.mode === 'daily' ? Math.max(score, getBest(daily.key)) : 0;
  if (g.mode === 'daily') saveBest(daily.key, score);
  lastResult = {
    mode: g.mode, day: daily.number, dayLabel: daily.label, stationDown, score, rank, best,
    saves: g.saves, explosions: g.explosions, water: Math.round(g.water), bestCombo: g.bestCombo, timeline: g.timeline,
  };
  // Take the picture of the station for the result card. After a final
  // explosion, wait a moment so the smoke and flying parts are in the shot.
  const cardReady = new Promise((resolve) =>
    setTimeout(() => {
      lastResult.snapshot = world.snapshot();
      resolve(drawCard(lastResult).then((c) => c.toDataURL('image/png')));
    }, stationDown ? 450 : 0)
  );
  setTimeout(
    async () => {
      sfx(stationDown ? 'lose' : 'win');
      ui.showOver(lastResult, await cardReady);
    },
    stationDown ? 1200 : 300 // let the last boom play out
  );
}

// ── Main loop ────────────────────────────────────────────────

let last = performance.now();
world.renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000); // cap: no huge jumps after a tab switch
  last = now;
  frame(dt, now / 1000);
});

// Calm pumps for the start screen (Hall B off)
const idle = PUMP_POS.map((_, i) => ({ online: i < 3, trouble: null, danger: 0, broken: 0 }));

// One frame of the game: rules, UI, visuals, render
function frame(dt, t) {
  if (game?.phase === 'play') update(dt);
  ui.update(dt);

  const states = game ? game.pumps : idle;
  world.updatePumps(states, t, dt);
  states.forEach((s, i) => (world.pumps[i].badge.visible = ui.setBadge(world.pumps[i].badgeEl, s)));
  if (game) {
    ui.setHud({
      timeLeft: Math.max(0, CONFIG.shiftSeconds - game.time),
      score: game.score + Math.round(game.water),
      combo: game.combo,
      explosions: game.explosions,
    });
  }
  world.render(dt);
}

// Dev only (not in the published build): lets automated tests step the
// game frame by frame, even when the browser pauses animation.
if (import.meta.env.DEV) window.__pumpPanic = { frame, world, CONFIG, get game() { return game; } };

ui.setDaily(daily);
ui.showScreen('screen-start');
