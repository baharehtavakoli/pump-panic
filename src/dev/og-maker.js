// ─────────────────────────────────────────────────────────────
// dev/og-maker.js — DEV TOOL (never part of the published game)
//
// Rebuilds the four link-preview images (public/og-<outcome>.png):
//   1. npm run dev
//   2. open http://localhost:5174/#make-og
// It stages each outcome in the real game, takes a photo of the station,
// adds the title text and saves it through the dev server (vite.config.js).
// ─────────────────────────────────────────────────────────────

const OUTCOMES = {
  flawless: { headline: 'FLAWLESS SHIFT!', color: '#8ff59d' },
  'one-boom': { headline: 'ONE PUMP DOWN', color: '#ffd166' },
  'two-booms': { headline: 'TWO PUMPS DOWN', color: '#ffb15c' },
  meltdown: { headline: 'STATION MELTDOWN', color: '#ff6b5e' },
};

export async function makeAll(api) {
  const results = [];
  for (const kind of Object.keys(OUTCOMES)) results.push(await makeOne(api, kind));
  document.title = 'og-done';
  console.log('og-maker:', results.join(' | '));
  return results;
}

async function makeOne({ frame, world, CONFIG, getGame }, kind) {
  // Freeze the rules: no new problems, no danger growth (we set the scene by hand)
  CONFIG.dangerPerSecond = { start: 0, end: 0 };
  CONFIG.spawnEvery = { start: 999, end: 999 };
  CONFIG.idleSpawnDelay = 999;
  document.getElementById('btn-practice').click(); // fresh shift (repairs old booms)
  const g = getGame();
  g.nextTrouble = 999;
  g.pumps.forEach((p) => (p.trouble = null));
  g.time = 30.2; // just before Hall B powers on

  let t = 300;
  const step = (s) => {
    for (let i = 0; i < Math.round(s * 30); i++) {
      t += 1 / 30;
      frame(1 / 30, t);
    }
  };
  step(1.4); // Hall B on, power-up flash faded
  const boom = (i) => {
    g.pumps[i].broken = 6;
    world.explode(i);
  };
  const trouble = (i, tr, d) => {
    g.pumps[i].trouble = tr;
    g.pumps[i].danger = d;
  };

  if (kind === 'flawless') {
    step(0.2);
    [0, 2, 4].forEach((i) => world.celebrate(i));
    step(0.25);
  } else if (kind === 'one-boom') {
    trouble(2, 'pressure', 40);
    step(0.8);
    boom(4);
    step(0.5);
  } else if (kind === 'two-booms') {
    trouble(0, 'heat', 70);
    trouble(5, 'clog', 50);
    step(1.2);
    boom(3);
    step(0.25);
    boom(1);
    step(0.45);
  } else {
    trouble(0, 'heat', 85);
    trouble(2, 'clog', 90);
    trouble(5, 'pressure', 80);
    step(1.4);
    boom(3);
    step(0.2);
    boom(4);
    step(0.2);
    boom(1);
    step(0.4);
  }

  const canvas = await compose(world.snapshot(), OUTCOMES[kind]);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const res = await fetch(`/__save-og?name=og-${kind}.png`, { method: 'POST', body: blob });
  return `${await res.text()} (${Math.round(blob.size / 1024)} KB)`;
}

// Photo + title, CTA, in the game's chunky style
async function compose(snapshot, { headline, color }) {
  await document.fonts.load('100px "Lilita One"');
  const W = 1200;
  const H = 627;
  const INK = '#0b1220';
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(snapshot, 0, 0);

  const top = ctx.createLinearGradient(0, 0, 0, 340);
  top.addColorStop(0, 'rgba(11,18,32,0.92)');
  top.addColorStop(0.65, 'rgba(11,18,32,0.5)');
  top.addColorStop(1, 'rgba(11,18,32,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 340);
  const bot = ctx.createLinearGradient(0, H - 140, 0, H);
  bot.addColorStop(0, 'rgba(11,18,32,0)');
  bot.addColorStop(1, 'rgba(11,18,32,0.85)');
  ctx.fillStyle = bot;
  ctx.fillRect(0, H - 140, W, 140);

  const rr = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };
  const plate = (x, y, w, h, r, a, b) => {
    ctx.fillStyle = INK;
    rr(x, y + 8, w, h, r);
    ctx.fill();
    const gr = ctx.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, a);
    gr.addColorStop(1, b);
    ctx.fillStyle = gr;
    rr(x, y, w, h, r);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = INK;
    ctx.stroke();
  };
  const text = (s, x, y, size, fill = '#fff') => {
    ctx.font = `${size}px "Lilita One"`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.16;
    ctx.strokeStyle = INK;
    ctx.strokeText(s, x, y + size * 0.07);
    ctx.strokeText(s, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(s, x, y);
  };

  ctx.font = '28px "Lilita One"';
  const tab = 'PUMP PANIC · NIGHT SHIFT';
  const tw = ctx.measureText(tab).width + 48;
  plate(W / 2 - tw / 2, 28, tw, 52, 16, '#557aa8', '#34507a');
  text(tab, W / 2, 64, 28);
  text(headline, W / 2, 186, 104, color);
  text('Can you keep the pumps alive for 90 seconds?', W / 2, 248, 38);
  ctx.font = '30px "Lilita One"';
  const cta = 'PLAY FREE · NEW SHIFT EVERY DAY';
  const cw = ctx.measureText(cta).width + 60;
  plate(W / 2 - cw / 2, H - 92, cw, 60, 20, '#7fd0ff', '#2f86e0');
  text(cta, W / 2, H - 50, 30);
  return c;
}
