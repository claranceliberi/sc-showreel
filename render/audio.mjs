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
  pullPeak: 2.5,
  tLands: 3.0,
  annotation: 3.6,
  bandZips: 5.2,
  continentOverview: 7.0,
  farCopy: 9.0,
  spike200: 10.5,
  breathStart: 12.8,
  snap: 14.0,
  homeCopy: 14.6,
  dataStart: 16.5,
  dataSnap: 17.5,
  moneyStart: 19.3,
  moneyConfirm: 19.8,
  moneySnap: 20.0,
  bandsFly: [22.2, 22.6, 23.0],
  markLocks: 24.0,
  wordmarkRises: 24.2,
  tCallback: 25.0,
  tagline: 26.2,
  silenceBy: 30.0,
}

const music = createBus(DURATION) // pads + bass: ducked under impacts
const drums = createBus(DURATION) // groove
const effects = createBus(DURATION) // picture-synced sound design
const reverbSend = createBus(DURATION)

// --- Act I: the name (0–7) --------------------------------------------------------------------
riser(effects, CUES.lightUp, CUES.pullStart, { intensity: 0.12, fromFrequency: 120, toFrequency: 900, seed: 3 }) // light rakes up
widePad(music, CUES.lightUp + 0.2, CUES.tLands - 0.2, [45, 52, 60], { intensity: 0.1, attack: 1.2, release: 0.2, cutoffFrom: 250, cutoffTo: 900 })
bowedTension(effects, CUES.pullStart, CUES.pullPeak, { fromNote: 50, toNote: 62, tremoloFrom: 6, tremoloTo: 18, intensity: 0.1, pan: 0.3 }) // band stretches
riser(effects, CUES.pullStart + 0.3, CUES.pullPeak, { intensity: 0.25, fromFrequency: 300, toFrequency: 4000, seed: 5 }) // creak
whoosh(effects, CUES.tLands - 0.02, { duration: 0.3, intensity: 0.3, panFrom: 0, panTo: 0, brightness: 1.2, seed: 7 }) // the t falls
subHit(effects, CUES.tLands, { intensity: 0.7, length: 0.9 })
tok(effects, CUES.tLands, { pitch: 180, intensity: 0.4, decay: 0.05 })
twang(effects, CUES.tLands, { from: 262, to: 220, bendTime: 0.08, duration: 1.6, intensity: 0.35, pan: -0.15, seed: 31 }) // motif: C4 → A3
twang(reverbSend, CUES.tLands, { from: 262, to: 220, bendTime: 0.08, duration: 1.6, intensity: 0.25, seed: 33 })
widePad(music, CUES.tLands, 4.0, [45, 52, 57, 64], { intensity: 0.12, attack: 0.4, release: 0.6, cutoffFrom: 700, cutoffTo: 1600 }) // A minor
bell(effects, CUES.annotation, 81, { duration: 1.2, intensity: 0.06, pan: 0.4 }) // "the extra push."
whoosh(effects, CUES.bandZips + 0.35, { duration: 0.6, intensity: 0.35, panFrom: -0.9, panTo: 0.9, brightness: 1.1, seed: 11 }) // band zips away
riser(effects, CUES.bandZips, CUES.continentOverview, { intensity: 0.22, fromFrequency: 200, toFrequency: 3000, seed: 13 }) // crane up
subHit(effects, CUES.continentOverview, { intensity: 0.35, length: 0.6, startFrequency: 90, endFrequency: 40 })

// --- Act II: far vs home (7–16.5) -----------------------------------------------------------------
widePad(music, CUES.continentOverview, CUES.breathStart - CUES.continentOverview, [45, 52, 59, 60], { intensity: 0.13, attack: 1.0, release: 0.05, cutoffFrom: 400, cutoffTo: 1300 })
for (let time = CUES.continentOverview; time < CUES.breathStart - 0.01; time += 1.0) { // heartbeat
  subHit(drums, time, { intensity: 0.28, length: 0.3, startFrequency: 80, endFrequency: 45 })
  subHit(drums, time + 0.18, { intensity: 0.16, length: 0.25, startFrequency: 80, endFrequency: 45 })
}
bowedTension(effects, CUES.continentOverview + 0.3, CUES.breathStart, { fromNote: 45, toNote: 60, tremoloFrom: 4, tremoloTo: 17, intensity: 0.14, pan: -0.2 }) // the far band
bowedTension(effects, CUES.continentOverview + 0.3, CUES.breathStart, { fromNote: 52.05, toNote: 67.05, tremoloFrom: 4.3, tremoloTo: 17.5, intensity: 0.1, pan: 0.35 })
riser(effects, CUES.spike200 - 0.3, CUES.spike200 + 0.1, { intensity: 0.2, fromFrequency: 800, toFrequency: 6000, seed: 17 }) // 200 ms spike
pluck(effects, CUES.spike200 + 0.1, { frequency: 82, duration: 1.2, intensity: 0.2, brightness: 0.35, seed: 37 })
riser(effects, CUES.farCopy + 1.5, CUES.breathStart, { intensity: 0.3, fromFrequency: 200, toFrequency: 7000, seed: 19 }) // long build, cut at the breath
// The breath (12.8–14.0): everything above cuts; only a thin high tone remains, fading to nothing.
chirp(effects, CUES.breathStart, { from: 3520, to: 3500, length: CUES.snap - CUES.breathStart - 0.15, intensity: 0.015 })

// THE SNAP — the film's single peak.
subHit(effects, CUES.snap, { intensity: 1.5, length: 1.6, startFrequency: 180, endFrequency: 32 })
subHit(effects, CUES.snap + 0.09, { intensity: 0.35, length: 0.6, startFrequency: 160, endFrequency: 38 }) // slapback
snap(effects, CUES.snap, { intensity: 0.5 })
twang(effects, CUES.snap, { from: 440, to: 110, bendTime: 0.18, duration: 2.2, intensity: 0.45, pan: 0, seed: 41 }) // motif, big bend down
twang(reverbSend, CUES.snap, { from: 440, to: 110, bendTime: 0.18, duration: 2.2, intensity: 0.35, seed: 43 })
whoosh(effects, CUES.snap + 0.25, { duration: 0.45, intensity: 0.55, panFrom: 0.95, panTo: -0.95, brightness: 1.6, seed: 23 }) // camera whip
crash(effects, CUES.snap, { intensity: 0.2, length: 2.0 })
crash(reverbSend, CUES.snap, { intensity: 0.2, length: 2.0 })
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
for (let index = 0; index < 14; index++) { // glossy data spheres touching, scattered in stereo
  const time = CUES.dataStart + 0.15 + index * 0.06 + (index % 3) * 0.013
  glassTap(effects, time, { pitch: 1800 + (index * 337) % 1400, intensity: 0.05, pan: ((index * 0.37) % 1.6) - 0.8 })
}
bowedTension(effects, CUES.dataSnap - 0.5, CUES.dataSnap, { fromNote: 55, toNote: 62, tremoloFrom: 8, tremoloTo: 20, intensity: 0.1, pan: -0.35 }) // ring stretches
subHit(effects, CUES.dataSnap, { intensity: 0.5, length: 0.6, startFrequency: 130, endFrequency: 45 })
twang(effects, CUES.dataSnap, { from: 294, to: 131, bendTime: 0.09, duration: 1.3, intensity: 0.32, pan: -0.4, seed: 47 }) // motif → C3
twang(reverbSend, CUES.dataSnap, { from: 294, to: 131, bendTime: 0.09, duration: 1.3, intensity: 0.2, seed: 49 })
whoosh(effects, CUES.moneyStart + 0.2, { duration: 0.35, intensity: 0.3, panFrom: 0.8, panTo: 0.1, brightness: 1.0, seed: 51 }) // phone swings in
bell(effects, CUES.moneyConfirm, 84, { duration: 0.6, intensity: 0.08, pan: 0.35 }) // payment confirmed
bell(effects, CUES.moneyConfirm + 0.08, 88, { duration: 0.6, intensity: 0.06, pan: 0.45 })
subHit(effects, CUES.moneySnap, { intensity: 0.5, length: 0.6, startFrequency: 130, endFrequency: 45 })
twang(effects, CUES.moneySnap, { from: 370, to: 165, bendTime: 0.09, duration: 1.3, intensity: 0.32, pan: 0.4, seed: 53 }) // motif → E3
twang(reverbSend, CUES.moneySnap, { from: 370, to: 165, bendTime: 0.09, duration: 1.3, intensity: 0.2, seed: 55 })

// --- Act IV: the mark (22–30) ---------------------------------------------------------------------
CUES.bandsFly.forEach((time, index) => { // three bands lift and straighten: rising plucks
  pluck(effects, time, { frequency: [131, 165, 196][index], duration: 0.8, intensity: 0.2, brightness: 0.7, seed: 61 + index })
  whoosh(effects, time + 0.15, { duration: 0.25, intensity: 0.18, panFrom: [-0.7, 0.7, 0][index], panTo: 0, brightness: 1.3, seed: 63 + index })
})
riser(effects, CUES.bandsFly[0], CUES.markLocks, { intensity: 0.3, fromFrequency: 300, toFrequency: 8000, seed: 67 })
subHit(effects, CUES.markLocks, { intensity: 0.9, length: 1.2, startFrequency: 150, endFrequency: 40 })
tok(effects, CUES.markLocks, { pitch: 320, intensity: 0.35, decay: 0.03 })
twang(effects, CUES.markLocks, { from: 392, to: 196, bendTime: 0.07, duration: 1.4, intensity: 0.3, pan: 0.15, seed: 71 }) // motif → G3
crash(reverbSend, CUES.markLocks, { intensity: 0.15, length: 1.8 })
widePad(music, CUES.markLocks, DURATION - CUES.markLocks - 1.2, [48, 55, 64, 67], { intensity: 0.14, attack: 0.1, release: 1.1, cutoffFrom: 2600, cutoffTo: 1400 }) // C major add G
whoosh(effects, CUES.wordmarkRises + 0.2, { duration: 0.35, intensity: 0.18, panFrom: -0.3, panTo: 0.3, brightness: 0.9, seed: 73 })
whoosh(effects, CUES.tCallback - 0.03, { duration: 0.25, intensity: 0.2, panFrom: 0, panTo: 0, brightness: 1.4, seed: 75 }) // t falls
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
scaleBus(master, 0.78 / peak(master)) // sample peak ≈ −2.2 dBFS keeps true peak under −1 dBTP
const output = join(dirname(fileURLToPath(import.meta.url)), '../out/audio.wav')
mkdirSync(dirname(output), { recursive: true })
writeWav(output, master)
console.log(`${output} (${DURATION}s @ ${SAMPLE_RATE} Hz, tuned to A4 = ${noteFrequency(69)} Hz)`)
