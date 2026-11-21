// ─────────────────────────────────────────────────────────────
// ui.js — everything HTML: HUD, the tool tray, the three tool
// gestures, the floating badges, and the start / end screens.
//
// The tool buttons are always at the bottom. Pressing one opens its
// gesture right above them (the game picks the most urgent pump):
//   COOL → press and HOLD (water sprays while held)
//   VENT → DRAG the lever all the way up
//   FIX  → TAP quickly a few times
// ─────────────────────────────────────────────────────────────

import { CONFIG, TROUBLES, TOOL_VERB } from './config.js';

// ── Icons (simple line icons, color = currentColor) ──────────

const svg = (body) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  cool: svg('<path d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11z"/>'),
  vent: svg('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2"/><path d="M12 4.5V10M12 14v5.5M4.5 12H10M14 12h5.5"/>'),
  fix: svg('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.3-.6-.6-2.3z"/>'),
  boom: svg('<path d="M12 2l2 5 5-2-2 5 5 2-5 2 2 5-5-2-2 5-2-5-5 2 2-5-5-2 5-2-2-5 5 2z"/>'),
};

// A bolt seen from above: hex head with a cross slot (rotates when tightened)
const BOLT = `<svg viewBox="0 0 32 32" aria-hidden="true">
  <path d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25z" fill="currentColor" stroke="#0b1220" stroke-width="2.5" stroke-linejoin="round"/>
  <circle cx="16" cy="16" r="7.5" fill="rgb(0 0 0 / 0.18)"/>
  <path d="M16 10.5v11M10.5 16h11" stroke="#0b1220" stroke-width="3" stroke-linecap="round"/>
</svg>`;

export const TOOLS = [
  { id: 'cool', label: 'COOL', fixes: 'heat' },
  { id: 'vent', label: 'VENT', fixes: 'pressure' },
  { id: 'fix', label: 'FIX', fixes: 'clog' },
];
const toolOf = (trouble) => TOOLS.find((t) => t.id === TROUBLES[trouble].tool);

const $ = (id) => document.getElementById(id);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Little tool "chip" — a mini version of the tool button
const chip = (t) => `<span class="badge__tool badge__tool--${t.id}">${ICONS[t.id]}${t.label}</span>`;

export function createUI(handlers) {
  // handlers: onStart, onRestart, onTool(tool), onGestureDone(), onSpray(), onTap()
  const tray = $('tray');
  const gesture = $('gesture');
  const toolsEl = $('tools');

  // ── Static parts built once ────────────────────────────────

  toolsEl.innerHTML = TOOLS.map(
    (t) => `<button class="tool tool--${t.id}" data-tool="${t.id}">${ICONS[t.id]}<span>${t.label}</span></button>`
  ).join('');
  // pointerdown (not click) so the button reacts the instant a finger lands
  toolsEl.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-tool]');
    if (b && !toolsEl.classList.contains('locked')) handlers.onTool(b.dataset.tool);
  });

  $('howto').innerHTML = TOOLS.map(
    (t) => `<li>${chip(t)}
      <span class="howto__text"><b>${TROUBLES[t.fixes].label}</b>${TROUBLES[t.fixes].hint}</span>
    </li>`
  ).join('');

  $('btn-start').addEventListener('click', () => handlers.onStart('daily'));
  $('btn-practice').addEventListener('click', () => handlers.onStart('practice'));
  $('btn-again').addEventListener('click', () => handlers.onRestart());
  $('btn-share').addEventListener('click', () => handlers.onShare());
  $('btn-image').addEventListener('click', () => handlers.onSaveImage());

  // Today's challenge number on the start button
  function setDaily(day) {
    $('btn-start').textContent = `Play today's shift #${day.number}`;
  }

  // ── Screens ────────────────────────────────────────────────

  function showScreen(id) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
    tray.hidden = id !== null; // tools only during a shift
  }

  // End screen: rank, the result card image (it holds score + stats), best of today
  function showOver(r, cardUrl) {
    $('over-title').textContent = r.stationDown ? 'Station down!' : 'Shift complete';
    $('over-rank').textContent = r.rank;
    const card = $('over-card');
    card.src = cardUrl;
    card.alt = `Score ${r.score}, ${r.saves} pumps saved, ${r.explosions} explosions, ${r.water} m³ water, best combo x${r.bestCombo}`;
    $('over-best').textContent =
      r.mode === 'daily'
        ? r.score >= r.best
          ? `New best for daily shift #${r.day}!`
          : `Your best today: ${r.best.toLocaleString('en-US')}`
        : 'Practice shift: try the daily shift to compare with others.';
    showScreen('screen-over');
  }

  // ── HUD ────────────────────────────────────────────────────

  $('h-lives').innerHTML = Array.from({ length: CONFIG.maxExplosions }, () => `<i>${ICONS.boom}</i>`).join('');

  function setHud({ timeLeft, score, combo, explosions }) {
    $('h-time').textContent = fmtTime(Math.ceil(timeLeft));
    $('hud-time').classList.toggle('hurry', timeLeft <= 10);
    $('h-score').textContent = score.toLocaleString('en-US');
    $('h-combo').textContent = combo > 1 ? `x${Math.min(combo, CONFIG.maxCombo)}` : '';
    [...$('h-lives').children].forEach((el, i) => el.classList.toggle('used', i < explosions));
  }

  // Short messages that float in and fade out
  function toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = `toast toast--${kind}`;
    el.textContent = text;
    $('toasts').prepend(el);
    setTimeout(() => el.remove(), 1900);
    while ($('toasts').children.length > 2) $('toasts').lastChild.remove();
  }

  // Button feedback: shake = "no", pulse = "this one!"
  function flashTool(tool, kind) {
    const b = toolsEl.querySelector(`[data-tool="${tool}"]`);
    b.classList.remove('shake', 'pulse');
    void b.offsetWidth; // restart the animation
    b.classList.add(kind);
  }

  function lockTools(seconds) {
    toolsEl.classList.add('locked');
    clearTimeout(lockTools.timer);
    lockTools.timer = setTimeout(() => toolsEl.classList.remove('locked'), seconds * 1000);
  }

  // ── Gestures ───────────────────────────────────────────────

  let g = null; // current gesture state

  function startGesture(tool, pumpName) {
    cancelGesture();
    gesture.hidden = false;
    toolsEl.querySelector(`[data-tool="${tool}"]`).classList.add('active');
    g = { tool, progress: 0, holding: false, taps: 0 };
    const title = `<p class="g-title">${TOOL_VERB[tool]} <b>${pumpName}</b></p>`;

    if (tool === 'cool') {
      gesture.innerHTML = `${title}<button class="g-hold" id="g-btn"><span class="g-ring" id="g-ring"></span>${ICONS.cool}<b>HOLD</b></button>`;
      const btn = $('g-btn');
      btn.addEventListener('pointerdown', (e) => {
        btn.setPointerCapture(e.pointerId);
        g.holding = true;
      });
      for (const ev of ['pointerup', 'pointercancel']) btn.addEventListener(ev, () => g && (g.holding = false));
    }

    if (tool === 'vent') {
      gesture.innerHTML = `${title}<div class="g-lever" id="g-track"><span class="g-arrow">▲</span><div class="g-fill" id="g-fill"></div><div class="g-handle" id="g-handle">${ICONS.vent}</div></div>`;
      const track = $('g-track');
      const setValue = (y) => {
        const r = track.getBoundingClientRect();
        g.progress = Math.min(1, Math.max(0, (r.bottom - y - 22) / (r.height - 44)));
        if (g.progress >= 0.95) finish();
      };
      track.addEventListener('pointerdown', (e) => {
        track.setPointerCapture(e.pointerId);
        g.holding = true;
        setValue(e.clientY);
      });
      track.addEventListener('pointermove', (e) => g?.holding && setValue(e.clientY));
      for (const ev of ['pointerup', 'pointercancel']) {
        track.addEventListener(ev, () => g && ((g.holding = false), (g.progress = 0)));
      }
    }

    if (tool === 'fix') {
      // One bolt per tap: each tap spins the next bolt and drives it in
      gesture.innerHTML = `${title}<button class="g-tap" id="g-btn">
        <span class="g-bolts">${`<i class="bolt">${BOLT}</i>`.repeat(CONFIG.fixTaps)}</span>
        <b>TIGHTEN!</b></button>`;
      const bolts = [...gesture.querySelectorAll('.bolt')];
      bolts[0].classList.add('next');
      $('g-btn').addEventListener('pointerdown', (e) => {
        const btn = e.currentTarget;
        g.taps++;
        handlers.onTap();
        btn.classList.remove('hit');
        void btn.offsetWidth;
        btn.classList.add('hit'); // little squash on every tap
        bolts.forEach((el, i) => {
          el.classList.toggle('tight', i < g.taps);
          el.classList.toggle('next', i === g.taps);
        });
        if (g.taps >= CONFIG.fixTaps) setTimeout(finish, 120); // let the last bolt finish turning
      });
    }
  }

  function finish() {
    g = null;
    handlers.onGestureDone();
  }

  function cancelGesture() {
    g = null;
    gesture.hidden = true;
    gesture.innerHTML = '';
    toolsEl.querySelectorAll('.active').forEach((b) => b.classList.remove('active'));
  }

  // Called every frame (for HOLD progress, lever position, vent steam)
  function update(dt) {
    if (!g) return;
    if (g.tool === 'cool') {
      if (g.holding) {
        g.progress += dt / CONFIG.coolHoldSeconds;
        handlers.onSpray();
      } else {
        g.progress = Math.max(0, g.progress - dt * 0.8);
      }
      $('g-ring').style.setProperty('--p', g.progress);
      if (g.progress >= 1) finish();
    }
    if (g?.tool === 'vent') {
      $('g-fill').style.height = `${g.progress * 100}%`;
      $('g-handle').style.bottom = `calc(${g.progress} * (100% - 44px))`;
    }
  }

  // ── Floating badge above a pump ────────────────────────────

  function setBadge(el, s) {
    const mode = s.broken > 0 ? 'out' : s.trouble ?? 'none';
    if (el.dataset.mode !== mode) {
      el.dataset.mode = mode;
      el.className = `badge badge--${mode}`;
      // The badge shows the TOOL the pump needs — same icon, name and
      // color as the button below — so it is obvious which button to press.
      el.innerHTML =
        mode === 'out'
          ? `${ICONS.boom}<span class="badge__text"></span>`
          : mode === 'none'
            ? ''
            : `${chip(toolOf(mode))}<span class="badge__bar"><i></i></span>`;
    }
    if (mode === 'out') el.querySelector('.badge__text').textContent = `${Math.ceil(s.broken)}s`;
    if (s.trouble && mode !== 'out') {
      el.querySelector('.badge__bar i').style.width = `${s.danger}%`;
      el.classList.toggle('critical', s.danger > 70);
      el.classList.toggle('working', !!s.working);
    }
    return mode !== 'none';
  }

  return { setDaily, showScreen, showOver, setHud, toast, flashTool, lockTools, startGesture, cancelGesture, update, setBadge };
}
