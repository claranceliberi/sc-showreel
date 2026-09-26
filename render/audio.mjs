// v3 soundtrack — "The Extra Push", 30 s, scored to picture (storyboard/v3/TREATMENT.md).
// 120 BPM, downbeats on even seconds. The sonic logo is an elastic twang; the three proof snaps
// climb C → E → G and the final callback resolves to C. One peak (the snap at 14.0), preceded by
// the film's only near-silence (the breath). Everything decays to silence at 30.000 s.
//
//   node render/audio.mjs            → out/audio.wav
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SAMPLE_RATE, createBus, mixInto, applyReverb, softClip, peak, scaleBus, writeWav, limit, noteFrequency,
} from './synth.mjs'
import {
  subHit, riser, whoosh, tick, pluck, bell, pulse, hat, snare, crash, snap, tok, chirp, tickTrain,
  twang, widePad, bowedTension, glassTap,
} from './instruments.mjs'

const DURATION = 30
const BEAT = 0.5
const SIXTEENTH = BEAT / 4

// Every picture-sync time in one place, so retiming to the animation is a one-line change.
const CUES = {
  lightUp: 0.0,
  pullStart: 1.0,
  pullSlips: [1.42, 1.78, 2.1, 2.34], // "stret" stick-slips with a glint along the band
  pullPeak: 2.4,
  tLands: 3.0,
  chClacks: 3.1,
  annotation: 3.26,
  bandZips: 5.2,
  tailWhip: 5.3,
  bandHooksKigali: 6.64,
  continentOverview: 7.0,
  farCatch: 9.0, // the band catches on the Cape Town needle
  spike200: 10.5,
  breathStart: 12.8,
  snap: 14.0, // Cape Town lets go
  snapLands: 14.1, // the band slams into Kigali: flare, shock — the film's peak
  coilCinch: 14.38,
  homeCopy: 14.45,
  dataStart: 16.5,
  dataSpheres: 16.84, // 8 spheres pop up 24 ms apart
  ringClicks: 16.92,
  dataEscape: 17.11,
  dataSnap: 17.5,
  moneyStart: 19.27,
  phoneUpright: 19.6,
  moneyConfirm: 19.8,
  moneyRelease: 19.9,
  moneySnap: 20.0,
  bandsFly: [22.2, 22.6, 23.0], // phone band, Rwanda ring, Kigali band are plucked
  bandsTaut: [22.5, 22.84, 23.2],
  bandsLaunch: [23.0, 23.12, 23.22],
  slabClicks: [23.75, 23.875],
  markLocks: 24.0,
  wordmarkRises: 24.04,
  chSlides: 24.75,
  tCallback: 25.0,
  tagline: 25.8,
  silenceBy: 30.0,
}

const music = createBus(DURATION) // pads + bass: ducked under impacts
const drums = createBus(DURATION) // groove
const effects = createBus(DURATION) // picture-synced sound design
const reverbSend = createBus(DURATION)

// --- Act I: the name (0–7) --------------------------------------------------------------------
riser(effects, CUES.lightUp, CUES.pullStart, { intensity: 0.12, fromFrequency: 120, toFrequency: 900, seed: 3 }) // light rakes up
widePad(music, CUES.lightUp + 0.2, CUES.tLands - 0.2, [45, 52, 60], { intensity: 0.1, attack: 1.2, release: 0.2, cutoffFrom: 250, cutoffTo: 900 })
bowedTension(effects, CUES.pullStart, CUES.tLands - 0.03, { fromNote: 50, toNote: 63, tremoloFrom: 6, tremoloTo: 18, intensity: 0.1, pan: 0.3 }) // band stretches, strained hold to the drop
CUES.pullSlips.forEach((time, index) => tok(effects, time, { pitch: 240 + index * 30, intensity: 0.14, decay: 0.03, pan: -0.3 })) // stick-slips
riser(effects, CUES.pullStart + 0.3, CUES.pullPeak, { intensity: 0.25, fromFrequency: 300, toFrequency: 4000, seed: 5 }) // creak
whoosh(effects, CUES.tLands - 0.02, { duration: 0.3, intensity: 0.3, panFrom: 0, panTo: 0, brightness: 1.2, seed: 7 }) // the t falls
subHit(effects, CUES.tLands, { intensity: 0.7, length: 0.9 })
tok(effects, CUES.tLands, { pitch: 180, intensity: 0.4, decay: 0.05 })
tok(effects, CUES.chClacks, { pitch: 420, intensity: 0.22, decay: 0.015, pan: 0.3 }) // "ch" clacks into the t
twang(effects, CUES.tLands, { from: 262, to: 220, bendTime: 0.08, duration: 1.6, intensity: 0.35, pan: -0.15, seed: 31 }) // motif: C4 → A3
twang(reverbSend, CUES.tLands, { from: 262, to: 220, bendTime: 0.08, duration: 1.6, intensity: 0.25, seed: 33 })
widePad(music, CUES.tLands, 4.0, [45, 52, 57, 64], { intensity: 0.12, attack: 0.4, release: 0.6, cutoffFrom: 700, cutoffTo: 1600 }) // A minor
bell(effects, CUES.annotation, 81, { duration: 1.2, intensity: 0.06, pan: 0.4 }) // "the extra push."
whoosh(effects, CUES.tailWhip + 0.19, { duration: 0.32, intensity: 0.3, panFrom: 0.6, panTo: -0.6, brightness: 1.5, seed: 9 }) // tail whips through the letters
whoosh(effects, CUES.bandZips + 0.95, { duration: 1.0, intensity: 0.3, panFrom: -0.9, panTo: 0.9, brightness: 1.0, seed: 11 }) // band zips across the floor
riser(effects, CUES.bandZips, CUES.bandHooksKigali, { intensity: 0.22, fromFrequency: 200, toFrequency: 3000, seed: 13 }) // crane up
tok(effects, CUES.bandHooksKigali, { pitch: 300, intensity: 0.3, decay: 0.03 }) // hooks the Kigali needle
subHit(effects, CUES.continentOverview, { intensity: 0.35, length: 0.6, startFrequency: 90, endFrequency: 40 })

// --- Act II: far vs home (7–16.5) -----------------------------------------------------------------
widePad(music, CUES.continentOverview, CUES.breathStart - CUES.continentOverview, [45, 52, 59, 60], { intensity: 0.13, attack: 1.0, release: 0.05, cutoffFrom: 400, cutoffTo: 1300 })
for (let time = CUES.continentOverview; time < CUES.breathStart - 0.01; time += 1.0) { // heartbeat
  subHit(drums, time, { intensity: 0.28, length: 0.3, startFrequency: 80, endFrequency: 45 })
  subHit(drums, time + 0.18, { intensity: 0.16, length: 0.25, startFrequency: 80, endFrequency: 45 })
}
bowedTension(effects, CUES.continentOverview + 0.3, CUES.breathStart, { fromNote: 45, toNote: 60, tremoloFrom: 4, tremoloTo: 17, intensity: 0.14, pan: -0.2 }) // the far band
bowedTension(effects, CUES.continentOverview + 0.3, CUES.breathStart, { fromNote: 52.05, toNote: 67.05, tremoloFrom: 4.3, tremoloTo: 17.5, intensity: 0.1, pan: 0.35 })
twang(effects, CUES.farCatch, { from: 98, to: 82, bendTime: 0.1, duration: 1.2, intensity: 0.22, pan: -0.3, seed: 35 }) // catches on Cape Town (slate, low)
riser(effects, CUES.spike200 - 0.3, CUES.spike200 + 0.1, { intensity: 0.2, fromFrequency: 800, toFrequency: 6000, seed: 17 }) // 200 ms spike
pluck(effects, CUES.spike200 + 0.1, { frequency: 82, duration: 1.2, intensity: 0.2, brightness: 0.35, seed: 37 })
riser(effects, CUES.farCopy + 1.5, CUES.breathStart, { intensity: 0.3, fromFrequency: 200, toFrequency: 7000, seed: 19 }) // long build, cut at the breath
// The breath (12.8–14.0): everything above cuts; only a thin high tone remains, fading to nothing.
chirp(effects, CUES.breathStart, { from: 3520, to: 3500, length: CUES.snap - CUES.breathStart - 0.15, intensity: 0.015 })

// THE SNAP — the film's single peak: the release crack at 14.0, the landing at 14.1.
snap(effects, CUES.snap, { intensity: 0.55 }) // Cape Town lets go
twang(effects, CUES.snap, { from: 440, to: 110, bendTime: 0.18, duration: 2.2, intensity: 0.45, pan: 0, seed: 41 }) // motif, big bend down
twang(reverbSend, CUES.snap, { from: 440, to: 110, bendTime: 0.18, duration: 2.2, intensity: 0.35, seed: 43 })
whoosh(effects, CUES.snap + 0.06, { duration: 0.1, intensity: 0.5, panFrom: 0.95, panTo: -0.2, brightness: 1.8, seed: 23 }) // the band whips home
subHit(effects, CUES.snapLands, { intensity: 1.5, length: 1.6, startFrequency: 180, endFrequency: 32 })
subHit(effects, CUES.snapLands + 0.09, { intensity: 0.35, length: 0.6, startFrequency: 160, endFrequency: 38 }) // slapback
crash(effects, CUES.snapLands, { intensity: 0.2, length: 2.0 })
crash(reverbSend, CUES.snapLands, { intensity: 0.2, length: 2.0 })
whoosh(effects, CUES.snapLands + 0.12, { duration: 0.28, intensity: 0.3, panFrom: -0.6, panTo: 0.8, brightness: 1.2, seed: 25 }) // lasso past Kigali
chirp(effects, CUES.coilCinch, { from: 1800, to: 3600, length: 0.06, intensity: 0.08 }) // coil cinches (glint)
tok(effects, CUES.homeCopy, { pitch: 130, intensity: 0.4, decay: 0.05 }) // "10–30 ms" lands

// Release groove from the snap to the mark lock: C major, kick on the beat, bass on 8ths, hats.
const GROOVE_START = CUES.snap + BEAT
const GROOVE_END = CUES.bandsFly[0]
widePad(music, CUES.snap, CUES.markLocks - CUES.snap, [48, 55, 62, 64], { intensity: 0.13, attack: 0.3, release: 0.3, cutoffFrom: 900, cutoffTo: 2600 })
for (let time = GROOVE_START; time < GROOVE_END - 0.01; time += BEAT) {
  if ([CUES.dataSnap, CUES.moneySnap].some((hit) => Math.abs(time - hit) < 1e-6)) continue // those beats get their own hit
  subHit(drums, time, { intensity: 0.4, length: 0.32, startFrequency: 120, endFrequency: 46 })
}
for (let time = GROOVE_START; time < GROOVE_END - 0.01; time += BEAT / 2) {
  pulse(music, time + 0.0001, 36, { intensity: 0.18, length: 0.18, pan: -0.25 }) // C2
}
for (let time = GROOVE_START; time < GROOVE_END - 0.01; time += SIXTEENTH) {
  const step = Math.round((time - GROOVE_START) / SIXTEENTH) % 4
  hat(drums, time, { intensity: step === 2 ? 0.06 : 0.028, pan: step % 2 ? 0.45 : 0.25 })
}

// --- Act III: closer, twice (16.5–22) ---------------------------------------------------------------
riser(effects, CUES.dataStart - 0.1, CUES.dataStart + 0.34, { intensity: 0.1, fromFrequency: 150, toFrequency: 1200, seed: 45 }) // Rwanda lifts
for (let index = 0; index < 8; index++) { // glossy data spheres pop up, scattered in stereo
  glassTap(effects, CUES.dataSpheres + index * 0.024, { pitch: 1800 + (index * 337) % 1400, intensity: 0.06, pan: ((index * 0.37) % 1.6) - 0.8 })
}
tick(effects, CUES.ringClicks, { pitch: 2600, intensity: 0.14, seed: 91 }) // ring ends meet
whoosh(effects, CUES.dataEscape + 0.17, { duration: 0.28, intensity: 0.16, panFrom: -0.2, panTo: 0.8, brightness: 0.9, seed: 93 }) // spheres pulled east
;[17.49, 17.506, 17.523, 17.538, 17.55, 17.577, 17.583, 17.61].forEach((time, index) => { // settle bounces
  glassTap(effects, time + 0.02, { pitch: 2200 + index * 180, intensity: 0.035, pan: ((index * 0.53) % 1.4) - 0.7 })
})
bowedTension(effects, CUES.dataEscape, CUES.dataSnap - 0.075, { fromNote: 55, toNote: 62, tremoloFrom: 8, tremoloTo: 20, intensity: 0.1, pan: -0.35 }) // ring stretches
subHit(effects, CUES.dataSnap, { intensity: 0.5, length: 0.6, startFrequency: 130, endFrequency: 45 })
twang(effects, CUES.dataSnap, { from: 294, to: 131, bendTime: 0.09, duration: 1.3, intensity: 0.32, pan: -0.4, seed: 47 }) // motif → C3
twang(reverbSend, CUES.dataSnap, { from: 294, to: 131, bendTime: 0.09, duration: 1.3, intensity: 0.2, seed: 49 })
whoosh(effects, CUES.phoneUpright - 0.02, { duration: 0.35, intensity: 0.3, panFrom: 0.8, panTo: 0.1, brightness: 1.0, seed: 51 }) // phone swings upright
tok(effects, CUES.phoneUpright, { pitch: 160, intensity: 0.25, decay: 0.04, pan: 0.3 })
bowedTension(effects, CUES.moneyRelease - 0.26, CUES.moneyRelease, { fromNote: 60, toNote: 66, tremoloFrom: 10, tremoloTo: 20, intensity: 0.08, pan: 0.35 }) // band tenses
bell(effects, CUES.moneyConfirm, 84, { duration: 0.6, intensity: 0.08, pan: 0.35 }) // payment confirmed
bell(effects, CUES.moneyConfirm + 0.08, 88, { duration: 0.6, intensity: 0.06, pan: 0.45 })
subHit(effects, CUES.moneySnap, { intensity: 0.5, length: 0.6, startFrequency: 130, endFrequency: 45 })
twang(effects, CUES.moneySnap, { from: 370, to: 165, bendTime: 0.09, duration: 1.3, intensity: 0.32, pan: 0.4, seed: 53 }) // motif → E3
twang(reverbSend, CUES.moneySnap, { from: 370, to: 165, bendTime: 0.09, duration: 1.3, intensity: 0.2, seed: 55 })

// --- Act IV: the mark (22–30) ---------------------------------------------------------------------
CUES.bandsFly.forEach((time, index) => { // three bands plucked, twang taut, then launch: rising C–E–G
  pluck(effects, time, { frequency: [131, 165, 196][index], duration: 0.8, intensity: 0.2, brightness: 0.7, seed: 61 + index })
  twang(effects, CUES.bandsTaut[index], { from: [131, 165, 196][index] * 1.06, to: [131, 165, 196][index], bendTime: 0.05, duration: 0.6, intensity: 0.1, pan: [0.5, -0.5, 0][index], seed: 65 + index })
  whoosh(effects, CUES.bandsLaunch[index] + 0.15, { duration: 0.25, intensity: 0.18, panFrom: [0.7, -0.7, 0][index], panTo: 0, brightness: 1.3, seed: 63 + index })
})
CUES.slabClicks.forEach((time, index) => tok(effects, time, { pitch: 260 + index * 40, intensity: 0.3, decay: 0.025 })) // slabs click in
riser(effects, CUES.bandsFly[0], CUES.markLocks, { intensity: 0.3, fromFrequency: 300, toFrequency: 8000, seed: 67 })
subHit(effects, CUES.markLocks, { intensity: 0.9, length: 1.2, startFrequency: 150, endFrequency: 40 })
tok(effects, CUES.markLocks, { pitch: 320, intensity: 0.35, decay: 0.03 })
twang(effects, CUES.markLocks, { from: 392, to: 196, bendTime: 0.07, duration: 1.4, intensity: 0.3, pan: 0.15, seed: 71 }) // motif → G3
crash(reverbSend, CUES.markLocks, { intensity: 0.15, length: 1.8 })
widePad(music, CUES.markLocks, DURATION - CUES.markLocks - 1.2, [48, 55, 64, 67], { intensity: 0.14, attack: 0.1, release: 1.1, cutoffFrom: 2600, cutoffTo: 1400 }) // C major add G
whoosh(effects, CUES.wordmarkRises + 0.21, { duration: 0.35, intensity: 0.18, panFrom: -0.3, panTo: 0.3, brightness: 0.9, seed: 73 }) // wordmark rises
whoosh(effects, CUES.chSlides + 0.09, { duration: 0.15, intensity: 0.12, panFrom: 0, panTo: 0.5, brightness: 1.2, seed: 77 }) // "ch cloud" slides aside
whoosh(effects, CUES.tCallback - 0.1, { duration: 0.28, intensity: 0.2, panFrom: 0, panTo: 0, brightness: 1.4, seed: 75 }) // t falls from 24.72
subHit(effects, CUES.tCallback, { intensity: 0.45, length: 0.7 })
twang(effects, CUES.tCallback, { from: 587, to: 523, bendTime: 0.08, duration: 2.4, intensity: 0.3, pan: 0, seed: 79 }) // motif resolves → C5
twang(reverbSend, CUES.tCallback, { from: 587, to: 523, bendTime: 0.08, duration: 2.4, intensity: 0.3, seed: 81 })
bell(effects, CUES.tagline, 72, { duration: 2.5, intensity: 0.12 })
bell(effects, CUES.tagline + 0.04, 79, { duration: 2.2, intensity: 0.06, pan: -0.5 })
bell(effects, CUES.tagline + 0.08, 84, { duration: 2.0, intensity: 0.05, pan: 0.5 })
bell(reverbSend, CUES.tagline, 72, { duration: 2.5, intensity: 0.2 })

// --- Mix ------------------------------------------------------------------------------------------
// Sidechain: duck the music under each impact so the hits breathe.
const ducks = [[CUES.tLands, 0.5], [CUES.snap, 0.95], [CUES.dataSnap, 0.4], [CUES.moneySnap, 0.4], [CUES.markLocks, 0.7], [CUES.tCallback, 0.35]]
for (let time = GROOVE_START; time < GROOVE_END; time += BEAT) ducks.push([time, 0.22])
for (let index = 0; index < music.length; index++) {
  const time = index / SAMPLE_RATE
  let gain = 1
  for (const [duckTime, depth] of ducks) {
    if (time >= duckTime && time < duckTime + 0.6) gain = Math.min(gain, 1 - depth * Math.exp(-(time - duckTime) / 0.09))
  }
  // The breath: the bed drops out entirely so the snap lands out of near-silence.
  if (time >= CUES.breathStart && time < CUES.snap) gain *= Math.max(0, 1 - (time - CUES.breathStart) / 0.12)
  music.left[index] *= gain
  music.right[index] *= gain
}

const master = createBus(DURATION)
mixInto(master, music, 1.8)
mixInto(master, drums, 1.3)
mixInto(master, effects, 1)
mixInto(reverbSend, music, 0.35)
mixInto(reverbSend, effects, 0.2)
mixInto(master, applyReverb(reverbSend, { roomSize: 0.9, damping: 0.35 }), 0.65)

// Tail: guarantee silence at exactly 30.000 s (the picture is dead still from 28.0).
const fadeStart = CUES.silenceBy - 1.2
for (let index = 0; index < master.length; index++) {
  const time = index / SAMPLE_RATE
  const fade = time < fadeStart ? 1 : Math.pow(Math.max(0, (CUES.silenceBy - time) / (CUES.silenceBy - fadeStart)), 2)
  master.left[index] *= fade
  master.right[index] *= fade
}

// Loudness: push into the limiter so the bed sits up with the hits (~−14 LUFS integrated),
// soft-clip the last fraction of a dB, and leave true-peak headroom for the AAC encode.
const MASTER_DRIVE = Number(process.env.MASTER_DRIVE || 3.0)
scaleBus(master, MASTER_DRIVE * 0.9 / peak(master))
limit(master, { ceiling: 0.95, attackSeconds: 0.002, releaseSeconds: 0.08 })
softClip(master, 0.9)
scaleBus(master, 0.74 / peak(master)) // sample peak ≈ −2.6 dBFS keeps true peak under −1 dBTP
const output = join(dirname(fileURLToPath(import.meta.url)), '../out/audio.wav')
mkdirSync(dirname(output), { recursive: true })
writeWav(output, master)
console.log(`${output} (${DURATION}s @ ${SAMPLE_RATE} Hz, tuned to A4 = ${noteFrequency(69)} Hz)`)
