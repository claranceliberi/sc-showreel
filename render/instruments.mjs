// Sound-design instruments built on synth.mjs. Each adds itself into a bus at an absolute time.
import {
  SAMPLE_RATE, addVoice, createBiquad, createSaw, createSine, seededNoise, expDecay, adsr, noteFrequency,
} from './synth.mjs'

// Sub-bass impact: sine with a fast downward pitch sweep (the "boom") plus a short noise click
// for definition on small speakers.
export function subHit(bus, time, { intensity = 1, startFrequency = 140, endFrequency = 42, length = 0.9 } = {}) {
  const sine = createSine()
  const noise = seededNoise(Math.round(time * 1000) + 7)
  const clickFilter = createBiquad('highpass')
  addVoice(bus, time, length, (index) => {
    const localTime = index / SAMPLE_RATE
    const frequency = endFrequency + (startFrequency - endFrequency) * Math.exp(-localTime * 28)
    const body = sine(frequency) * expDecay(localTime, 0.16) * Math.min(1, localTime / 0.002)
    const click = clickFilter(noise(), 2500, 0.7) * expDecay(localTime, 0.006) * 0.5
    return Math.tanh((body + click) * 1.6) * 0.85
  }, { gain: intensity })
}

// Filtered-noise riser that builds into `peakTime` and cuts dead on it (the impact takes over).
export function riser(bus, startTime, peakTime, { intensity = 1, fromFrequency = 250, toFrequency = 7000, seed = 3 } = {}) {
  const duration = peakTime - startTime
  const noise = seededNoise(seed)
  const bandpass = createBiquad('bandpass')
  const tone = createSine()
  addVoice(bus, startTime, duration, (index) => {
    const progress = index / (duration * SAMPLE_RATE)
    const curve = progress * progress
    const cutoff = fromFrequency * Math.pow(toFrequency / fromFrequency, curve)
    const swell = Math.pow(progress, 2.2)
    const tail = Math.min(1, (1 - progress) * duration / 0.004) // 4 ms de-click at the cut
    const air = bandpass(noise(), cutoff, 1.4) * 2.2
    const pitch = tone(110 * Math.pow(4, curve)) * 0.12
    return (air + pitch) * swell * tail
  }, { gain: intensity, panAt: (index) => Math.sin(index / SAMPLE_RATE * 5) * 0.25 })
}

// Whoosh for whips / wipes: band-passed noise that sweeps up then down while panning across.
export function whoosh(bus, time, { duration = 0.35, intensity = 1, panFrom = -0.7, panTo = 0.7, seed = 11, brightness = 1 } = {}) {
  const noise = seededNoise(seed)
  const bandpass = createBiquad('bandpass')
  const lowpass = createBiquad('lowpass')
  addVoice(bus, time - duration * 0.6, duration, (index) => {
    const progress = index / (duration * SAMPLE_RATE)
    const envelope = Math.sin(Math.PI * Math.pow(progress, 0.8)) ** 2
    const cutoff = (400 + 3200 * brightness * Math.sin(Math.PI * progress))
    return lowpass(bandpass(noise(), cutoff, 0.9), 9000, 0.7) * envelope * 2.4
  }, { gain: intensity, panAt: (index) => panFrom + (panTo - panFrom) * (index / (duration * SAMPLE_RATE)) })
}

// Mechanical tick for odometer / split-flap digits: tiny noise burst + resonant ping.
export function tick(bus, time, { intensity = 0.5, pitch = 3200, pan = 0, seed = 5 } = {}) {
  const noise = seededNoise(seed + Math.round(time * 997))
  const resonator = createBiquad('bandpass')
  const ping = createSine()
  addVoice(bus, time, 0.05, (index) => {
    const localTime = index / SAMPLE_RATE
    return resonator(noise(), pitch, 6) * expDecay(localTime, 0.004) * 3 + ping(pitch * 1.5) * expDecay(localTime, 0.008) * 0.25
  }, { gain: intensity, pan })
}

// Soft UI click — a short sine blip with a fast pitch drop.
export function click(bus, time, { intensity = 0.4, pitch = 1800, pan = 0 } = {}) {
  const sine = createSine()
  addVoice(bus, time, 0.04, (index) => {
    const localTime = index / SAMPLE_RATE
    return sine(pitch * (1 + 2 * Math.exp(-localTime * 400))) * expDecay(localTime, 0.006)
  }, { gain: intensity, pan })
}

// Digital glitch: sample-and-hold stutter of detuned saw + noise, gated at 32nds.
export function glitch(bus, time, { duration = 0.2, intensity = 0.4, seed = 17 } = {}) {
  const noise = seededNoise(seed)
  const saw = createSaw()
  let held = 0
  addVoice(bus, time, duration, (index) => {
    if (index % 96 === 0) held = saw(220 + 660 * Math.abs(noise())) * 0.6 + noise() * 0.4
    const gate = Math.floor(index / (SAMPLE_RATE / 64)) % 2 === 0 ? 1 : 0.2
    return held * gate * (1 - index / (duration * SAMPLE_RATE))
  }, { gain: intensity })
}

// Plucked string "twang" — Karplus–Strong, for the stretched route snapping.
export function pluck(bus, time, { frequency = 98, duration = 1.2, intensity = 0.6, brightness = 0.5, seed = 23 } = {}) {
  const period = Math.round(SAMPLE_RATE / frequency)
  const delay = new Float32Array(period)
  const noise = seededNoise(seed)
  for (let index = 0; index < period; index++) delay[index] = noise()
  let pointer = 0
  let previous = 0
  addVoice(bus, time, duration, () => {
    const current = delay[pointer]
    const averaged = (current * (0.5 + brightness * 0.5) + previous * (0.5 - brightness * 0.5)) * 0.996
    delay[pointer] = averaged
    previous = current
    pointer = (pointer + 1) % period
    return current
  }, { gain: intensity })
}

// Warm pad: three detuned saws per note through a slowly opening low-pass.
export function pad(bus, startTime, duration, midiNotes, { intensity = 0.15, attack = 0.6, release = 0.8, cutoffFrom = 500, cutoffTo = 2200, pan = 0 } = {}) {
  const voices = midiNotes.flatMap((note, noteIndex) => [-7, 0, 7].map((cents) => ({
    saw: createSaw(), frequency: noteFrequency(note) * Math.pow(2, cents / 1200), noteIndex,
  })))
  const filters = [createBiquad('lowpass'), createBiquad('lowpass')]
  addVoice(bus, startTime, duration + release, (index) => {
    const localTime = index / SAMPLE_RATE
    let sum = 0
    for (const voice of voices) sum += voice.saw(voice.frequency)
    sum /= voices.length
    const cutoff = cutoffFrom + (cutoffTo - cutoffFrom) * Math.min(1, localTime / Math.max(duration, 0.001))
    const filtered = filters[1](filters[0](sum, cutoff, 0.6), cutoff, 0.6)
    return filtered * adsr(localTime, duration, { attack, decay: 0.2, sustain: 1, release })
  }, { gain: intensity, pan })
}

// Bell / FM tone for the final sting sparkle.
export function bell(bus, time, midiNote, { duration = 2.5, intensity = 0.25, pan = 0 } = {}) {
  const carrier = createSine()
  const modulator = createSine()
  const frequency = noteFrequency(midiNote)
  addVoice(bus, time, duration, (index) => {
    const localTime = index / SAMPLE_RATE
    const modulationDepth = 2.2 * expDecay(localTime, 0.35)
    return carrier(frequency + modulator(frequency * 3.5) * frequency * modulationDepth) * expDecay(localTime, 0.6) * Math.min(1, localTime / 0.002)
  }, { gain: intensity, pan })
}

// Short muted pluck for a rhythmic bed (sine + saw through a closing filter).
export function pulse(bus, time, midiNote, { intensity = 0.12, length = 0.18, pan = 0 } = {}) {
  const saw = createSaw()
  const sine = createSine()
  const lowpass = createBiquad('lowpass')
  const frequency = noteFrequency(midiNote)
  addVoice(bus, time, length, (index) => {
    const localTime = index / SAMPLE_RATE
    const cutoff = 300 + 2600 * expDecay(localTime, 0.03)
    return lowpass(saw(frequency) * 0.6 + sine(frequency) * 0.4, cutoff, 1.2) * expDecay(localTime, 0.06) * Math.min(1, localTime / 0.002)
  }, { gain: intensity, pan })
}
