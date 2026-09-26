// Global post-processing config (see SC.post in engine.js). Times are global seconds and follow
// storyboard/v3/TREATMENT.md.

// Impact frames that shake the camera (a damped multi-axis oscillation).
SC.post.hits = [
  { time: 3.0, intensity: 0.45 }, // the extra t lands in "stretch"
  { time: 14.0, intensity: 0.5 }, // THE SNAP — Cape Town lets go
  { time: 14.1, intensity: 1.0 }, // the band slams into Kigali — the film's single peak
  { time: 17.5, intensity: 0.3 }, // the Rwanda ring snaps the data back
  { time: 20.0, intensity: 0.3 }, // the band snaps around the phone
  { time: 24.0, intensity: 0.6 }, // the three slabs lock into the mark
  { time: 25.0, intensity: 0.25 }, // the extra t callback lands in the wordmark
]

// Vignette opacity keyframes [[time, opacity], ...]: the dark studio keeps it throughout.
SC.post.vignette = [[0, 1]]

// Spans needing denser motion blur than the default (render-only). Set once the motion exists.
SC.post.motionBlurWindows = []
