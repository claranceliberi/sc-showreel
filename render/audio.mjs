// The showreel soundtrack, scored to picture from the storyboard's audio cue sheet
// (storyboard/master.json → audio_cues). 120 BPM; downbeats at 0.5, 2.5, 4.5 … 14.5 with a
// one-beat pickup. Everything decays to silence exactly at 15.000 s.
//
//   node render/audio.mjs            → out/audio.wav
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SAMPLE_RATE, createBus, addVoice, mixInto, applyReverb, softClip, peak, scaleBus, writeWav, limit,
  createBiquad, createSine, createSaw, seededNoise, expDecay, noteFrequency,
} from './synth.mjs'
import { subHit, riser, whoosh, tick, click, glitch, pluck, pad, bell, pulse } from './instruments.mjs'

const DURATION = 15
const BEAT = 0.5
const SIXTEENTH = BEAT / 4
const THIRTY_SECOND = BEAT / 8

const music = createBus(DURATION) // pads + bass: ducked under impacts
const drums = createBus(DURATION) // groove kick/hats
const effects = createBus(DURATION) // picture-synced sound design
const reverbSend = createBus(DURATION)

// --- Extra voices this score needs beyond instruments.mjs -------------------------------------
function hat(bus, time, { intensity = 0.08, open = false, pan = 0.15 } = {}) {
  const noise = seededNoise(Math.round(time * 7919))
  const highpass = createBiquad('highpass')
  addVoice(bus, time, open ? 0.2 : 0.04, (index) =>
    highpass(noise(), 7500, 0.8) * expDecay(index / SAMPLE_RATE, open ? 0.06 : 0.008), { gain: intensity, pan })
}
function snare(bus, time, { intensity = 0.4, tail = 0.08 } = {}) {
  const noise = seededNoise(Math.round(time * 104729))
  const bandpass = createBiquad('bandpass')
  const body = createSine()
  addVoice(bus, time, tail * 4, (index) => {
    const localTime = index / SAMPLE_RATE
    return bandpass(noise(), 1900, 0.8) * 2.2 * expDecay(localTime, tail * 0.35) + body(190) * expDecay(localTime, 0.02) * 0.5
  }, { gain: intensity })
}
function crash(bus, time, { intensity = 0.3, length = 1.6 } = {}) {
  const noise = seededNoise(99)
  const highpass = createBiquad('highpass')
  addVoice(bus, time, length, (index) =>
    highpass(noise(), 5200, 0.6) * expDecay(index / SAMPLE_RATE, 0.32) * Math.min(1, index / 40), { gain: intensity, panAt: (index) => 0.3 * Math.sin(index / 9000) })
}
// Pitched-down snap: a saw whose pitch falls fast, through a closing filter — the band letting go.
function snap(bus, time, { from = 330, to = 80, intensity = 0.5 } = {}) {
  const saw = createSaw()
  const lowpass = createBiquad('lowpass')
  addVoice(bus, time, 0.8, (index) => {
    const localTime = index / SAMPLE_RATE
    const frequency = to + (from - to) * Math.exp(-localTime * 18)
    return lowpass(saw(frequency), 400 + 5000 * expDecay(localTime, 0.05), 2) * expDecay(localTime, 0.14)
  }, { gain: intensity })
}
// Short tonal "tok" / tom blip.
function tok(bus, time, { pitch = 600, intensity = 0.4, decay = 0.02, pan = 0 } = {}) {
  const sine = createSine()
  addVoice(bus, time, decay * 8, (index) => {
    const localTime = index / SAMPLE_RATE
    return sine(pitch * (1 + 0.6 * Math.exp(-localTime * 120))) * expDecay(localTime, decay) * Math.min(1, index / 24)
  }, { gain: intensity, pan })
}
function chirp(bus, time, { from = 2000, to = 4200, length = 0.05, intensity = 0.2 } = {}) {
  const sine = createSine()
  addVoice(bus, time, length, (index) => {
    const progress = index / (length * SAMPLE_RATE)
    return sine(from * Math.pow(to / from, progress)) * Math.sin(Math.PI * progress)
  }, { gain: intensity })
}
function subPulse(bus, time, { frequency = 58, length = 0.045, intensity = 0.5 } = {}) {
  const sine = createSine()
  addVoice(bus, time, length, (index) => sine(frequency) * Math.sin((Math.PI * index) / (length * SAMPLE_RATE)), { gain: intensity })
}
// A tick train: `count` ticks from `start`, `spacing` apart, pitch gliding from→to.
function tickTrain(bus, start, count, spacing, { from = 2600, to = 3600, intensity = 0.18, pan = 0, jitterSeed = 1 } = {}) {
  for (let index = 0; index < count; index++) {
    const progress = count === 1 ? 0 : index / (count - 1)
    const pitch = from * Math.pow(to / from, progress) * (1 + 0.04 * (seededNoise(jitterSeed + index)()))
    tick(bus, start + index * spacing, { pitch, intensity, pan, seed: jitterSeed + index })
  }
}

// --- 0.00–2.50  s01: the name ------------------------------------------------------------------
whoosh(effects, 0.15, { duration: 0.25, intensity: 0.25, panFrom: 0, panTo: 0, brightness: 0.6 }) // air intake
tickTrain(effects, 0.2, 7, 0.02, { from: 2400, to: 3800, intensity: 0.12, jitterSeed: 10 }) // "stretch" rises
subHit(effects, 0.5, { intensity: 0.8 }) // weight slam
tok(effects, 0.5, { pitch: 150, intensity: 0.35, decay: 0.05 })
riser(effects, 0.75, 1.5, { intensity: 0.45, fromFrequency: 300, toFrequency: 5000, seed: 21 }) // rubber-band creak (pull 0.75)
pluck(effects, 1.4, { frequency: 147, duration: 0.25, intensity: 0.12, brightness: 0.7, seed: 19 }) // band goes taut
whoosh(effects, 1.45, { duration: 0.25, intensity: 0.35, panFrom: 0, panTo: 0, brightness: 1.3 }) // the falling t
subHit(effects, 1.5, { intensity: 1.0 })
snare(effects, 1.5, { intensity: 0.45, tail: 0.1 })
snare(reverbSend, 1.5, { intensity: 0.3, tail: 0.1 })
pluck(effects, 1.5, { frequency: 98, duration: 1.2, intensity: 0.4, brightness: 0.5 })
whoosh(effects, 1.64, { duration: 0.15, intensity: 0.22, panFrom: -0.1, panTo: -0.5, brightness: 1.6 }) // ink swipe
tickTrain(effects, 1.75, 5, 0.02, { from: 900, to: 1300, intensity: 0.2, jitterSeed: 30 }) // "cloud" bounces

// --- 2.50–6.50  s01→s02: tension bed ------------------------------------------------------------
const TENSION_END = 6.483 // everything but the riser drops one frame before the snap
pad(music, 2.5, TENSION_END - 2.5, [45, 52, 59, 60], { intensity: 0.2, attack: 0.9, release: 0.02, cutoffFrom: 380, cutoffTo: 1500 }) // A minor add9
for (let time = 2.5; time < TENSION_END - 0.01; time += BEAT / 2) {
  pulse(music, time, 33, { intensity: 0.2, length: 0.2 }) // A1 on 8ths
}
for (let time = 2.5; time < TENSION_END - 0.01; time += SIXTEENTH) {
  const onBeat = Math.abs((time - 2.5) / BEAT - Math.round((time - 2.5) / BEAT)) < 1e-6
  hat(drums, time, { intensity: onBeat ? 0.05 : 0.03 })
}
for (let time = 2.5; time < TENSION_END - 0.01; time += 2 * BEAT) subHit(drums, time, { intensity: 0.35, length: 0.35, startFrequency: 110, endFrequency: 48 })

whoosh(effects, 2.8, { duration: 0.12, intensity: 0.15, panFrom: 0.3, panTo: -0.2, brightness: 1.2 }) // annotation retracts
whoosh(effects, 2.745, { duration: 0.18, intensity: 0.12, panFrom: 0.3, panTo: 0, brightness: 0.5 }) // anticipation intake, stops dead 2.76
whoosh(effects, 2.934, { duration: 0.29, intensity: 0.35, panFrom: -0.8, panTo: 0.8 }) // camera pull-back 2.76–3.05
tok(effects, 3.02, { pitch: 150, intensity: 0.3, decay: 0.03 }) // "strettch" drops out as one word
tickTrain(effects, 3.095, 12, 0.008, { from: 1600, to: 3400, intensity: 0.09, pan: 0.2, jitterSeed: 60 }) // "Africa-first" rises
tok(effects, 3.25, { pitch: 520, intensity: 0.45, decay: 0.015 }) // the period pops
// Granular shimmer as the continent assembles outward from Kigali.
whoosh(effects, 3.75, { duration: 0.8, intensity: 0.2, panFrom: -0.4, panTo: 0.4, brightness: 2 })
for (let grain = 0; grain < 22; grain++) {
  const random = seededNoise(500 + grain)
  tick(effects, 3.25 + grain * 0.035 + random() * 0.01, { pitch: 3000 + random() * 2500, intensity: 0.05 * (1 - grain / 26), pan: random() * 0.8, seed: 700 + grain })
}
for (const time of [3.5, 4.0, 4.5, 5.0, 5.5, 6.0]) { // Kigali heartbeat
  const sine = createSine()
  addVoice(effects, time, 0.12, (index) => sine(880) * expDecay(index / SAMPLE_RATE, 0.025), { gain: 0.1, pan: 0.35 })
}
whoosh(effects, 4.3, { duration: 0.5, intensity: 0.3, panFrom: 0.1, panTo: 0.6, brightness: 0.8 }) // packet launch
whoosh(effects, 4.476, { duration: 0.16, intensity: 0.12, panFrom: -0.6, panTo: 0.5, brightness: 1.4 }) // hairline reels into Kigali 4.38–4.54
tok(effects, 4.5, { pitch: 900, intensity: 0.3, decay: 0.01, pan: 0.4 }) // packet hits Cape Town
tickTrain(effects, 4.5, 19, 0.01, { from: 3000, to: 3000, intensity: 0.05, pan: -0.3, jitterSeed: 80 }) // kicker types on
tickTrain(effects, 4.5625, 8, THIRTY_SECOND, { from: 1800, to: 2400, intensity: 0.14, pan: -0.25, jitterSeed: 100 }) // odometer
bell(effects, 5.0, 88, { duration: 0.4, intensity: 0.12, pan: -0.25 }) // odometer locks at ~110
tok(effects, 5.0, { pitch: 1400, intensity: 0.2, decay: 0.01, pan: -0.25 })
pluck(effects, 5.25, { frequency: 82, duration: 1.2, intensity: 0.35, brightness: 0.35, seed: 31 }) // route plucked
pluck(effects, 5.25, { frequency: 82.9, duration: 1.2, intensity: 0.25, brightness: 0.35, seed: 37 })
glitch(effects, 5.25, { duration: 0.2, intensity: 0.2 })
riser(effects, 5.5, 6.5, { intensity: 0.6, fromFrequency: 200, toFrequency: 9000, seed: 41 }) // tension riser
chirp(effects, 5.5, { from: 600, to: 1800, length: 1.0, intensity: 0.05 }) // string-tension whine

// --- 6.50–8.50  s03: THE SNAP and the release groove --------------------------------------------
subHit(effects, 6.5, { intensity: 1.45, length: 1.4, startFrequency: 170, endFrequency: 34 }) // the film's biggest low end
subHit(effects, 6.59, { intensity: 0.35, length: 0.6, startFrequency: 160, endFrequency: 38 }) // slapback
snap(effects, 6.5, { intensity: 0.45 })
whoosh(effects, 6.62, { duration: 0.6, intensity: 0.5, panFrom: -0.9, panTo: 0.9, brightness: 1.5 }) // crash-zoom
crash(reverbSend, 6.5, { intensity: 0.12, length: 1.2 })
tok(effects, 6.93, { pitch: 180, intensity: 0.4, decay: 0.03 }) // slab 1
tok(effects, 6.965, { pitch: 240, intensity: 0.4, decay: 0.03 }) // slab 2
tok(effects, 7.0, { pitch: 320, intensity: 0.45, decay: 0.035 }) // slab 3
chirp(effects, 7.0, { from: 2000, to: 4200, length: 0.05, intensity: 0.12 }) // LED chirp
tickTrain(effects, 7.0, 8, THIRTY_SECOND / 1.0, { from: 3200, to: 1500, intensity: 0.12, jitterSeed: 120 }) // roll-down
tok(effects, 7.25, { pitch: 140, intensity: 0.45, decay: 0.04 }) // "10–30 ms" lock thud

const GROOVE_START = 7.0
const GROOVE_END = 12.5
pad(music, 7.0, 3.0, [48, 55, 62, 64], { intensity: 0.2, attack: 0.25, release: 0.15, cutoffFrom: 900, cutoffTo: 2400 }) // C major add9
for (let time = GROOVE_START; time < GROOVE_END - 0.01; time += BEAT) {
  // The 8.5 cut has its own sub whomp; a groove kick on top beats against it (a doubled
  // "whomp-WHOMP"), so the groove rests on that beat.
  if (Math.abs(time - 8.5) < 1e-6) continue
  subHit(drums, time, { intensity: 0.45, length: 0.35, startFrequency: 120, endFrequency: 46 })
}
for (let time = GROOVE_START; time < GROOVE_END - 0.01; time += BEAT / 2) {
  pulse(music, time + 0.0001, 36, { intensity: 0.22, length: 0.18 }) // C2 on 8ths
}
for (let time = GROOVE_START; time < GROOVE_END - 0.01; time += SIXTEENTH) {
  const beatPosition = Math.round((time - GROOVE_START) / SIXTEENTH) % 4
  hat(drums, time, { intensity: beatPosition === 2 ? 0.07 : 0.035, open: beatPosition === 2 && Math.round((time - GROOVE_START) / BEAT) % 2 === 1 })
}

// --- 8.50–10.00  s04: in-country -----------------------------------------------------------------
subHit(effects, 8.5, { intensity: 0.5, length: 0.8, startFrequency: 110, endFrequency: 40 }) // whomp
// The four outer glyphs hit Rwanda's border within 5 ms (8.621–8.626): a tight flam, not a roll.
for (let bump = 0; bump < 4; bump++) {
  tok(effects, 8.621 + bump * 0.0017, { pitch: 210 - bump * 18, intensity: 0.22, decay: 0.03, pan: [-0.5, 0.45, -0.2, 0.3][bump] })
}
riser(effects, 9.75, 10.0, { intensity: 0.4, fromFrequency: 1500, toFrequency: 12000, seed: 51 }) // reverse cymbal
whoosh(effects, 9.965, { duration: 0.15, intensity: 0.35, panFrom: 0, panTo: 0, brightness: 1.8 }) // fly-through

// --- 10.00–12.50  s05: spec stack ----------------------------------------------------------------
pad(music, 10.0, 2.5, [53, 57, 60, 64], { intensity: 0.2, attack: 0.08, release: 0.1, cutoffFrom: 1400, cutoffTo: 3000 }) // F major 7
tickTrain(effects, 10.0, 39, 0.0077, { from: 3400, to: 3400, intensity: 0.05, jitterSeed: 200 }) // teletype
subHit(effects, 10.5, { intensity: 0.4, length: 0.5 })
;[10.625, 10.688, 10.75, 10.812].forEach((time, index) => {
  tok(effects, time, { pitch: 700 * Math.pow(2, -index / 12), intensity: 0.3, decay: 0.012 }) // drum locks 3-9-9-9
  tick(effects, time, { pitch: 2600 * Math.pow(2, -index / 12), intensity: 0.2, seed: 300 + index })
})
;[11.0625, 11.125, 11.1875].forEach((time) => subPulse(effects, time, { intensity: 0.25 })) // Mobile Money buzz
tok(effects, 11.25, { pitch: 520, intensity: 0.4, decay: 0.015 }) // period pops
for (let time = 11.5; time < 12.5 - 0.01;) { // snare roll 16ths → 32nds
  const progress = (time - 11.5) / 1.0
  snare(effects, time, { intensity: 0.08 + 0.2 * progress * progress, tail: 0.05 })
  time += progress < 0.5 ? SIXTEENTH : THIRTY_SECOND
}
riser(effects, 11.5, 12.5, { intensity: 0.4, fromFrequency: 300, toFrequency: 8000, seed: 61 })
glitch(effects, 12.25, { duration: 0.25, intensity: 0.22, seed: 71 })

// --- 12.50–15.00  s06: lockup and resolve ----------------------------------------------------------
subHit(effects, 12.5, { intensity: 1.0, length: 1.2, startFrequency: 150, endFrequency: 40 })
snare(effects, 12.5, { intensity: 0.35, tail: 0.1 })
crash(effects, 12.5, { intensity: 0.22, length: 1.8 })
crash(reverbSend, 12.5, { intensity: 0.2, length: 1.8 })
pad(music, 12.5, 2.0, [48, 55, 64], { intensity: 0.22, attack: 0.05, release: 0.45, cutoffFrom: 3000, cutoffTo: 1600 }) // open C major
click(effects, 12.75, { intensity: 0.35, pitch: 2400 }) // LED punch
bell(effects, 12.755, 96, { duration: 0.4, intensity: 0.05 }) // halo flash + ring off the LED
whoosh(effects, 12.9, { duration: 0.25, intensity: 0.2, panFrom: -0.2, panTo: 0.2, brightness: 0.9 }) // wordmark rises from 12.75
pluck(effects, 13.25, { frequency: 196, duration: 0.6, intensity: 0.22, brightness: 0.55, seed: 43 }) // callback, octave up
tok(effects, 13.25, { pitch: 520, intensity: 0.3, decay: 0.015 })
tickTrain(effects, 13.25, 18, 0.01, { from: 3600, to: 3600, intensity: 0.05, jitterSeed: 400 }) // URL types
bell(effects, 14.0, 76, { duration: 1.0, intensity: 0.22 }) // sting E5
bell(reverbSend, 14.0, 76, { duration: 1.0, intensity: 0.25 })
bell(effects, 14.03, 83, { duration: 0.9, intensity: 0.06, pan: 0.4 }) // shimmer
bell(effects, 14.06, 88, { duration: 0.8, intensity: 0.04, pan: -0.4 })
pad(music, 14.5, 0.1, [72], { intensity: 0.08, attack: 0.02, release: 0.4, cutoffFrom: 2400, cutoffTo: 2400 }) // final C5

// --- Mix ---------------------------------------------------------------------------------------
// Sidechain: duck the music under each impact so the hits breathe (deeper for the big ones).
const ducks = [[0.5, 0.5], [1.5, 0.7], [6.5, 0.9], [8.5, 0.5], [10.5, 0.3], [12.5, 0.8]]
for (let time = GROOVE_START; time < GROOVE_END; time += BEAT) ducks.push([time, 0.25])
for (let index = 0; index < music.length; index++) {
  const time = index / SAMPLE_RATE
  let gain = 1
  for (const [duckTime, depth] of ducks) {
    if (time >= duckTime && time < duckTime + 0.6) gain = Math.min(gain, 1 - depth * Math.exp(-(time - duckTime) / 0.09))
  }
  music.left[index] *= gain
  music.right[index] *= gain
}

const master = createBus(DURATION)
mixInto(master, music, 1.9)
mixInto(master, drums, 1.4)
mixInto(master, effects, 1)
// Reverb sends: a little of everything plus the dedicated sends.
mixInto(reverbSend, music, 0.35)
mixInto(reverbSend, effects, 0.2)
mixInto(master, applyReverb(reverbSend, { roomSize: 0.88, damping: 0.4 }), 0.6)

// Tail: guarantee silence at exactly 15.000 s (the picture is dead still from 14.5).
for (let index = 0; index < master.length; index++) {
  const time = index / SAMPLE_RATE
  const fade = time < 14.55 ? 1 : Math.pow(Math.max(0, (DURATION - time) / (DURATION - 14.55)), 2)
  master.left[index] *= fade
  master.right[index] *= fade
}

// Loudness: push into the limiter so the bed sits up with the hits (~−14 LUFS integrated),
// then soft-clip the last fraction of a dB and leave true-peak headroom for the AAC encode.
const MASTER_DRIVE = Number(process.env.MASTER_DRIVE || 2.15)
scaleBus(master, MASTER_DRIVE * 0.9 / peak(master))
limit(master, { ceiling: 0.95, attackSeconds: 0.002, releaseSeconds: 0.08 })
softClip(master, 0.9)
scaleBus(master, 0.78 / peak(master)) // sample peak ≈ −2.2 dBFS keeps true peak under −1 dBTP
const output = join(dirname(fileURLToPath(import.meta.url)), '../out/audio.wav')
mkdirSync(dirname(output), { recursive: true })
writeWav(output, master)
console.log(`${output} (${DURATION}s @ ${SAMPLE_RATE} Hz, ${noteFrequency(69)} Hz tuning)`)
