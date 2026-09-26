# Strettch Cloud — 15-second motion showreel

A 1920×1080, 60 fps motion-graphics piece about Strettch Cloud, built as a deterministic web
page and rendered frame-by-frame in headless Chromium (true motion blur via sub-frame
accumulation), with a synthesized sound-design track.

**Latest render:** [`renders/strettch-cloud-showreel-30s.mp4`](renders/strettch-cloud-showreel-30s.mp4)
— v3, "The Extra Push": 30 s · 1920×1080 · 60 fps · three.js 3D · H.264 13 Mbps + AAC 320 kbps,
−15.9 LUFS / −1.3 dBTP. Treatment: `storyboard/v3/TREATMENT.md`.
The earlier 15 s 2D cut is [`renders/strettch-cloud-showreel-15s-v2.mp4`](renders/strettch-cloud-showreel-15s-v2.mp4)
(source at commit `ae243e3`).

## Build

```bash
npm install
node tools/build-assets.mjs          # geo outlines, brand logo glyphs, fonts → src/data, assets/fonts
node tools/build-rwanda.mjs          # 10m Rwanda border + neighbour dot grid → src/data/rwanda-hires.js (~25 s)
node render/audio.mjs                # soundtrack → out/audio.wav
node render/render.mjs video --subframes 4 --audio out/audio.wav --out out/master.mp4   # ~1.5 h on 4 CPUs (software WebGL)
# delivery encode (the master is ~140 MB):
ffmpeg -i out/master.mp4 -c:v libx264 -preset slow -crf 22 -tune grain -pix_fmt yuv420p -movflags +faststart -c:a copy renders/strettch-cloud-showreel-30s.mp4
```

Open `index.html` through any static server (`npx serve .`) for a live preview with a scrubber.

## Render commands

| Command | What it does |
| --- | --- |
| `node render/render.mjs still --times 1.2,3.4 [--solo <scene-id>] [--outdir out/stills]` | Full-res PNGs at exact times |
| `node render/render.mjs sheet --from 2 --to 5 --count 12 [--solo <scene-id>] --out out/sheet.png` | Time-stamped contact sheet |
| `node render/render.mjs video [--from 0 --to 15] [--subframes 8] [--shutter 0.5] [--workers 3] [--no-windows 1]` | MP4 with motion blur; spans in `SC.post.motionBlurWindows` get more samples |

`--solo <scene-id>` renders one scene alone (still at global time) for isolated checks.

## Scene contract

Each scene is one file in `src/scenes/`, listed in `src/scenes/index.js`, that calls:

```js
SC.scene({
  id: 's02-map', start: 2.0, end: 5.25, z: 2,
  build(root, api) { /* create DOM/SVG/canvas once inside root (1920×1080); return state */ },
  render(t, state, api) { /* t = GLOBAL seconds; set every animated property from t */ },
})
```

Rules:

- **Pure function of time.** `render` must derive everything from `t`. No CSS transitions or
  animations, no `Date.now()`, no `Math.random()` (use `api.rng(seed)` in `build`, `api.hash()`
  / `api.noise()` in `render`), no state that accumulates between calls. Frames are rendered
  out of order in parallel pages.
- **Set, don't toggle.** Use `api.setStyle(node, {...})` / `api.setAttrs(node, {...})`; they skip
  unchanged values. Canvas scenes clear and redraw each call.
- **Units.** Stage is 1920×1080 px, origin top-left. CSS transforms on SVG children are in that
  SVG's user units (e.g. logo units where 32 units = the logo's rendered height), not screen px.
- **Performance.** Chromium here is CPU-rasterized. Avoid large-radius `filter: blur()` on
  big layers every frame and keep canvas particle counts in the low thousands.

`api` (see `src/engine.js`) provides easing (`api.ease.*`, springs, cubic-beziers), `tween`,
`keyframes`, `stagger`, deterministic `hash`/`rng`/`noise`, DOM helpers (`el`, `svg`,
`splitText`), geo helpers (`makeProjection`, `orthographic`, `ringsToPath`, `africaDots`),
brand `tokens`, the logo slab polygons (`logoSlabs`) and `createLogo()` which builds the real
brand mark and per-letter wordmark.

Global post-processing (camera shake + chromatic aberration on impact frames, film grain,
vignette) lives in the engine; impact times are in `src/post-config.js`.
