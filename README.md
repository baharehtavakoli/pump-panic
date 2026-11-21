# Pump Panic

A 90-second night shift at a pump station, as a small browser game made with Three.js and Vite.
Pumps overheat, spike in pressure or clog. Each one shows the tool it needs (COOL, VENT or FIX).
Press the right button and do the gesture before it blows. Three explosions and the station goes down.

**Play:** https://baharehtavakoli.github.io/pump-panic/

- Tonight's shift: everyone gets the same sequence of problems each night (a new one every day), so scores are comparable.
- Share your result card on LinkedIn, or save it as an image.

## Run locally

```bash
npm install
npm run dev
```

## Files

| File | What it does |
|---|---|
| `src/config.js` | Every tuning number and text (difficulty, points, messages) |
| `src/main.js` | Game rules |
| `src/scene.js` | 3D station, pump visuals, explosions |
| `src/ui.js` | HUD, tool buttons, gestures, screens |
| `src/audio.js` | Sound effects, synthesized in code |
| `src/share.js` | Result card image and LinkedIn sharing |
| `src/random.js` | Daily challenge |

Pushing to `main` builds and publishes the game automatically (see `.github/workflows/deploy.yml`).
