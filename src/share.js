// ─────────────────────────────────────────────────────────────
// share.js — the result card image + sharing to LinkedIn
//
//   drawCard(result)      → a 1200×627 canvas (LinkedIn's image size):
//                           a photo of the station with what happened,
//                           the score and rank (details stay on the end screen)
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
  // Darken top and bottom so the text is easy to read; the middle stays a clear photo
  const shade = (y0, y1, from, to) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, `rgba(11,18,32,${from})`);
    g.addColorStop(1, `rgba(11,18,32,${to})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, W, y1 - y0);
  };
  shade(0, 330, 0.92, 0);
  shade(H - 200, H, 0, 0.92);

  // ── Small tab: game + which shift ──
  const tab = r.mode === 'daily' ? `PUMP PANIC · TONIGHT'S SHIFT #${r.day}` : 'PUMP PANIC · PRACTICE SHIFT';
  ctx.font = '26px "Lilita One"';
  const tabW = ctx.measureText(tab).width + 44;
  plate(ctx, W / 2 - tabW / 2, 26, tabW, 48, 16, '#557aa8', '#34507a');
  outlined(ctx, tab, W / 2, 60, 26, '#fff', 'center');

  // ── Headline: what happened (same words as the post), up to 2 lines ──
  const kind = outcome(r);
  const words = HEADLINES[kind].replace(/\p{Extended_Pictographic}/gu, '').trim().toUpperCase().split(/\s+/);
  const MAX = 1100;
  const width = (ws) => ctx.measureText(ws.join(' ')).width;
  // Two lines of similar length (no single word left alone on line 2)
  const balanced = () => {
    let best = null;
    for (let k = 1; k < words.length; k++) {
      const a = words.slice(0, k);
      const b = words.slice(k);
      const worst = Math.max(width(a), width(b));
      if (!best || worst < best.worst) best = { worst, lines: [a.join(' '), b.join(' ')] };
    }
    return best;
  };
  // Prefer one big line; otherwise two balanced lines, shrinking until they fit
  let size = 80;
  let lines = null;
  for (; size >= 64 && !lines; size -= 4) {
    ctx.font = `${size}px "Lilita One"`;
    if (width(words) <= MAX) lines = [words.join(' ')];
  }
  if (!lines) {
    for (size = 80; size >= 44; size -= 4) {
      ctx.font = `${size}px "Lilita One"`;
      const b = balanced();
      if (b && b.worst <= MAX) {
        lines = b.lines;
        break;
      }
    }
    if (!lines) lines = balanced()?.lines ?? [words.join(' ')]; // very long text: best effort
  } else size += 4; // undo the last step of the loop
  lines.forEach((line, k) => outlined(ctx, line, W / 2, 148 + k * size * 1.04, size, HEADLINE_COLORS[kind], 'center'));

  // ── Bottom-left: score + rank ──
  outlined(ctx, fmt(r.score), 48, H - 70, 84);
  ctx.font = '84px "Lilita One"';
  const scoreW = ctx.measureText(fmt(r.score)).width;
  ctx.font = '700 24px "Rubik"';
  ctx.fillStyle = '#b3c3d9';
  ctx.textAlign = 'left';
  ctx.fillText('POINTS', 48 + scoreW + 14, H - 76);
  ctx.font = '24px "Lilita One"';
  const rankW = ctx.measureText(r.rank.toUpperCase()).width + 36;
  plate(ctx, 48, H - 58, rankW, 40, 14, '#557aa8', '#34507a');
  outlined(ctx, r.rank.toUpperCase(), 48 + rankW / 2, H - 29, 24, '#fff', 'center');

  // ── Bottom-right: the challenge ──
  const cx = W - 48 - 220;
  plate(ctx, W - 48 - 440, H - 124, 440, 96, 22, '#7fd0ff', '#2f86e0');
  outlined(ctx, 'CAN YOU BEAT IT?', cx, H - 78, 40, '#fff', 'center');
  ctx.font = '700 20px "Rubik"';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(gameUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''), cx, H - 44);

  return canvas;
}

// ── Text for the post ────────────────────────────────────────

// The opening line of the post, one per outcome. Same words as the link
// preview titles (public/r/<outcome>/index.html), so the post reads as one.
// Color of the headline on the result image, per outcome
const HEADLINE_COLORS = { flawless: '#8ff59d', 'one-boom': '#ffd166', 'two-booms': '#ffb15c', meltdown: '#ff6b5e' };

const HEADLINES = {
  flawless: 'Flawless shift! I kept every pump alive 🛠️',
  'one-boom': 'Only one pump blew up on my watch 😅',
  'two-booms': 'Two pumps exploded… but the station survived!',
  meltdown: 'I blew up the whole station 💥',
};

// Short and human: what happened, the score, the challenge
export function shareText(r) {
  return [
    HEADLINES[outcome(r)],
    `${fmt(r.score)} points · ${r.rank}`,
    `Can you beat it? 👉 ${shareUrl(r)}`,
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

  // Phones: the phone's share sheet with the post TEXT (it includes the link,
  // so LinkedIn adds the link card by itself). Sharing image files from a web
  // page is unreliable on phones, so the image stays optional (⬇ button).
  // Nothing is awaited before share(): phones only allow it right after a tap.
  if (isPhone) {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return '✅ Shared! Tip: tap ⬇ to save the image for a bigger post.';
      } catch (e) {
        if (e.name === 'AbortError') return ''; // player closed the share sheet
        // sharing isn't allowed here: use LinkedIn in the browser instead
      }
    }
    window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
    return '✅ Your post is ready in LinkedIn. If the text is missing, paste it.';
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
  // The link in the text makes LinkedIn add the link card by itself, so the
  // post works as is. The image is an optional upgrade (LinkedIn then shows
  // the big image instead of the card; the link stays in the text).
  return [
    '✅ Your post is ready in LinkedIn, with the game link card.',
    'If the text box is empty, paste it with Ctrl+V.',
    `⭐ Want a bigger post? Add the image we saved (${imageName(r)}, in Downloads) with the photo icon.`,
  ].join('\n');
}
