// ─────────────────────────────────────────────────────────────
// share.js — the result card image + sharing to LinkedIn
//
//   drawCard(result)      → a 1200×627 canvas (LinkedIn's image size):
//                           a photo of the station with the results on top
//   shareText(result)     → the post text, with a Wordle-style strip
//   shareResult(result)   → phone: share sheet with image (pick LinkedIn)
//                           desktop: save image + copy text + open a LinkedIn post
//   saveImage(result)     → download the card as a PNG
// ─────────────────────────────────────────────────────────────

const INK = '#0b1220';
const W = 1200;
const H = 627;

// Where the game lives (works on GitHub Pages or any host)
export const gameUrl = () => location.origin + location.pathname;

// The link we share depends on how the shift went. Each one is a small page
// (public/r/<outcome>/) with its own funny LinkedIn preview title and image,
// that sends people straight to the game.
export function outcome(r) {
  if (r.stationDown) return 'meltdown';
  return ['flawless', 'one-boom', 'two-booms'][Math.min(r.explosions, 2)];
}
export const shareUrl = (r) => `${gameUrl()}r/${outcome(r)}/`;

// ── Drawing helpers ──────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// A "plate" like the game UI: gradient, thick dark stroke, hard shadow below
function plate(ctx, x, y, w, h, r, top, bottom) {
  ctx.fillStyle = INK;
  roundRect(ctx, x, y + 10, w, h, r);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // light inner top edge
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + r, y + 6);
  ctx.lineTo(x + w - r, y + 6);
  ctx.stroke();
}

// Text with a thick dark outline (like the game titles)
function outlined(ctx, text, x, y, size, color = '#fff', align = 'left', font = 'Lilita One') {
  ctx.font = `${size}px "${font}", "Rubik", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y + size * 0.06); // drop
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

const fmt = (n) => Number(n).toLocaleString('en-US');

// ── The card ─────────────────────────────────────────────────

export async function drawCard(r) {
  // Make sure the game fonts are ready before drawing text
  await Promise.all([document.fonts.load('60px "Lilita One"'), document.fonts.load('700 30px "Rubik"')]);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ── Background: the photo of the station at the end of the shift ──
  if (r.snapshot) {
    ctx.drawImage(r.snapshot, 0, 0, W, H);
  } else {
    const bg = ctx.createRadialGradient(W / 2, H * 0.3, 50, W / 2, H / 2, W * 0.75);
    bg.addColorStop(0, '#1d3150');
    bg.addColorStop(1, '#0b1220');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }
  // Darken the top and bottom so the text is easy to read
  const topShade = ctx.createLinearGradient(0, 0, 0, 300);
  topShade.addColorStop(0, 'rgba(11,18,32,0.92)');
  topShade.addColorStop(0.6, 'rgba(11,18,32,0.55)');
  topShade.addColorStop(1, 'rgba(11,18,32,0)');
  ctx.fillStyle = topShade;
  ctx.fillRect(0, 0, W, 300);
  const bottomShade = ctx.createLinearGradient(0, H - 150, 0, H);
  bottomShade.addColorStop(0, 'rgba(11,18,32,0)');
  bottomShade.addColorStop(1, 'rgba(11,18,32,0.9)');
  ctx.fillStyle = bottomShade;
  ctx.fillRect(0, H - 150, W, 150);

  // ── Top-left: which shift, how it ended, game name, rank ──
  const tab = r.mode === 'daily' ? `DAILY SHIFT #${r.day} · ${r.dayLabel.toUpperCase()}` : 'PRACTICE SHIFT';
  ctx.font = '26px "Lilita One"';
  const tabW = ctx.measureText(tab).width + 44;
  plate(ctx, 40, 30, tabW, 48, 16, '#557aa8', '#34507a');
  outlined(ctx, tab, 40 + tabW / 2, 64, 26, '#fff', 'center');

  const status = r.stationDown ? 'STATION DOWN!' : 'SHIFT COMPLETE';
  ctx.font = '26px "Lilita One"';
  const stW = ctx.measureText(status).width + 44;
  plate(ctx, 40 + tabW + 14, 30, stW, 48, 16, r.stationDown ? '#e2554f' : '#4fbf6a', r.stationDown ? '#a8302b' : '#2e8f4a');
  outlined(ctx, status, 40 + tabW + 14 + stW / 2, 64, 26, '#fff', 'center');

  outlined(ctx, 'PUMP PANIC', 44, 140, 40, '#7fd0ff');
  outlined(ctx, r.rank, 44, 208, 64);

  // ── Top-right: score + 4 small stats ──
  plate(ctx, 820, 30, 340, 120, 24, '#3d5a80', '#2a4060');
  ctx.font = '700 20px "Rubik"';
  ctx.fillStyle = '#b3c3d9';
  ctx.textAlign = 'center';
  ctx.fillText('SCORE', 990, 64);
  outlined(ctx, fmt(r.score), 990, 128, 60, '#fff', 'center');

  const stats = [
    ['SAVED', r.saves],
    ['BOOMS', `${r.explosions}/3`],
    ['WATER', `${fmt(r.water)} m³`],
    ['COMBO', `x${r.bestCombo}`],
  ];
  stats.forEach(([label, value], k) => {
    const x = 820 + (k % 2) * 174;
    const y = 172 + Math.floor(k / 2) * 66;
    ctx.fillStyle = 'rgba(26,40,64,0.92)';
    roundRect(ctx, x, y, 166, 56, 14);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.font = '700 15px "Rubik"';
    ctx.fillStyle = '#b3c3d9';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 14, y + 22);
    outlined(ctx, String(value), x + 14, y + 48, 24);
  });

  // ── Bottom: timeline strip + call to action ──
  const events = r.timeline.slice(-30); // the latest events (the finale matters most)
  events.forEach((e, k) => {
    ctx.fillStyle = e === 'boom' ? '#ef4444' : '#4fbf6a';
    roundRect(ctx, 44 + k * 24, H - 112, 18, 18, 5);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
  });
  outlined(ctx, 'Can you keep the pumps alive for 90 seconds?', 44, H - 52, 30);
  ctx.font = '700 20px "Rubik"';
  ctx.fillStyle = '#7fd0ff';
  ctx.textAlign = 'left';
  ctx.fillText(`Play free: ${gameUrl().replace(/^https?:\/\//, '')}`, 46, H - 20);

  return canvas;
}

// ── Text for the post ────────────────────────────────────────

export function shareText(r) {
  const strip = r.timeline
    .slice(-20) // the latest events
    .map((e) => (e === 'boom' ? '💥' : '✅'))
    .join('');
  const head = r.mode === 'daily' ? `Pump Panic · Daily shift #${r.day}` : 'Pump Panic · Practice shift';
  return [
    `${head} 🛠️`,
    `${r.rank} · ${fmt(r.score)} points`,
    strip,
    `${r.saves} pumps saved, ${r.explosions} explosion${r.explosions === 1 ? '' : 's'}.`,
    '',
    `Can you beat it? ${shareUrl(r)}`,
  ].join('\n');
}

// ── Actions ──────────────────────────────────────────────────

const toBlob = (canvas) => new Promise((res) => canvas.toBlob(res, 'image/png'));

const imageName = (r) => `pump-panic-${r.mode === 'daily' ? `day-${r.day}` : 'practice'}.png`;

export async function saveImage(r) {
  const blob = await toBlob(await drawCard(r));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = imageName(r);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Returns a short message for the player about what happened
export async function shareResult(r) {
  const text = shareText(r);
  const isPhone = matchMedia('(pointer: coarse)').matches;

  // Phones: the share sheet with the image attached (pick the LinkedIn app)
  if (isPhone && navigator.canShare) {
    const file = new File([await toBlob(await drawCard(r))], 'pump-panic.png', { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return '';
      } catch {
        return ''; // player closed the share sheet
      }
    }
  }

  // Desktop: a post WITH the image shows big in the feed (a plain link only
  // gets a small preview strip). LinkedIn does not let websites attach an
  // image to a post, so: save the image, copy the text (it includes the link),
  // and open LinkedIn's post box with the text already filled in
  // ("text=" is an unofficial LinkedIn option; the copied text is the backup).
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* clipboard blocked: the text is still filled in by the link below */
  }
  await saveImage(r);
  window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  // Step-by-step note shown under the buttons
  return [
    `✅ Image saved to your Downloads: ${imageName(r)}`,
    '✅ Post text with the game link is ready',
    'In LinkedIn: click the photo icon (Add media) and choose the image.',
    'If the text box is empty, paste it with Ctrl+V.',
  ].join('\n');
}
