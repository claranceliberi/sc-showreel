// Global post-processing config (see SC.post in engine.js). Times are global seconds.

// Impact frames: `intensity` = camera shake, `aberration` = RGB split. The split is capped low
// (and zero on the lockup hit) because at full strength it fringes the type and logo that land
// on the same beat — the first clean view of the mark must not be chromatically split.
SC.post.hits = [
  { time: 1.5, intensity: 0.6, aberration: 0.3 }, // the extra t lands
  { time: 6.5, intensity: 1.0, aberration: 0.3 }, // the route snaps home
  { time: 7.0, intensity: 0.3, aberration: 0.15 }, // logo slabs lock onto Kigali
  { time: 8.5, intensity: 0.4, aberration: 0.25 }, // Rwanda becomes the container
  { time: 12.5, intensity: 0.8, aberration: 0 }, // spec lines fuse into the mark
  { time: 13.25, intensity: 0.2, aberration: 0 }, // the extra t shoves the wordmark
]

// The vignette is tuned for the ink background; on flat brand violet it reads as a muddy oval.
// Dim it while s04's fly-through fills the frame with violet, restore it as s06's ink floods in.
SC.post.vignette = [
  [0, 1],
  [9.9, 1],
  [9.98, 0.15],
  [12.5, 0.15],
  [12.62, 1],
]

// Fast moves that strobe into discrete copies at the default sample count get denser motion
// blur. Render-only: read by render/render.mjs.
SC.post.motionBlurWindows = [
  { from: 1.25, to: 1.55, subframes: 32 }, // the tear and the extra-t impact
  { from: 2.95, to: 3.25, subframes: 32 }, // camera pull-back to "Africa-first"
  { from: 6.45, to: 7.15, subframes: 32 }, // the snap and the crash-zoom
  { from: 8.45, to: 8.72, subframes: 32 }, // Rwanda push and the glyph burst
  { from: 9.82, to: 10.02, subframes: 32 }, // fly-through into violet
  { from: 12.2, to: 12.72, subframes: 32 }, // fuse, ink flood, bars spring into the mark
  { from: 13.2, to: 13.45, subframes: 32 }, // the extra t drops and shoves
]
