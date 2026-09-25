// Small offline synthesis toolkit for the showreel soundtrack — no dependencies.
// Everything renders into stereo Float32Array buses at SAMPLE_RATE and is deterministic
// (seeded noise), so re-running the build produces a bit-identical WAV.
import { writeFileSync } from 'node:fs'

export const SAMPLE_RATE = 48000

export function createBus(seconds) {
  const length = Math.ceil(seconds * SAMPLE_RATE)
  return { left: new Float32Array(length), right: new Float32Array(length), length }
}

// Equal-power pan: -1 = hard left, 0 = centre, 1 = hard right.
export function panGains(pan) {
  const angle = ((pan + 1) / 2) * (Math.PI / 2)
  return [Math.cos(angle), Math.sin(angle)]
}

// Adds a mono voice into a bus at `startTime`. `sampleAt(index)` returns the voice's sample for
// its own local sample index; `panAt(index)` optionally moves it across the stereo field.
export function addVoice(bus, startTime, durationSeconds, sampleAt, { gain = 1, pan = 0, panAt = null } = {}) {
  const startIndex = Math.round(startTime * SAMPLE_RATE)
  const voiceLength = Math.round(durationSeconds * SAMPLE_RATE)
  for (let index = 0; index < voiceLength; index++) {
    const busIndex = startIndex + index
    if (busIndex < 0) continue
    if (busIndex >= bus.length) break
    const sample = sampleAt(index) * gain
    const [leftGain, rightGain] = panGains(panAt ? panAt(index) : pan)
    bus.left[busIndex] += sample * leftGain
    bus.right[busIndex] += sample * rightGain
  }
}

export function mixInto(target, source, gain = 1) {
  for (let index = 0; index < target.length; index++) {
    target.left[index] += source.left[index] * gain
    target.right[index] += source.right[index] * gain
  }
}

// --- Sources ---------------------------------------------------------------------------------
export function seededNoise(seed = 1) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return (((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296) * 2 - 1
  }
}

// Band-limited sawtooth (PolyBLEP) — tames the aliasing a naive saw has at 48 kHz.
export function createSaw() {
  let phase = 0
  return (frequency) => {
    const increment = frequency / SAMPLE_RATE
    phase += increment
    if (phase >= 1) phase -= 1
    let value = 2 * phase - 1
    if (phase < increment) {
      const t = phase / increment
      value -= t + t - t * t - 1
    } else if (phase > 1 - increment) {
      const t = (phase - 1) / increment
      value -= t * t + t + t + 1
    }
    return value
  }
}

export function createSine(startPhase = 0) {
  let phase = startPhase
  return (frequency) => {
    phase += (2 * Math.PI * frequency) / SAMPLE_RATE
    if (phase > 2 * Math.PI) phase -= 2 * Math.PI
    return Math.sin(phase)
  }
}

export const noteFrequency = (midiNote) => 440 * Math.pow(2, (midiNote - 69) / 12)

// --- Envelopes -------------------------------------------------------------------------------
// Attack/decay/sustain/release in seconds, evaluated at local time `time` for a note of `length`.
export function adsr(time, length, { attack = 0.01, decay = 0.1, sustain = 0.7, release = 0.2 }) {
  if (time < 0) return 0
  if (time < attack) return time / attack
  if (time < attack + decay) return 1 - (1 - sustain) * ((time - attack) / decay)
  if (time < length) return sustain
  const releaseTime = time - length
  return releaseTime < release ? sustain * (1 - releaseTime / release) : 0
}
export const expDecay = (time, halfLife) => Math.pow(0.5, time / halfLife)

// --- Filters ---------------------------------------------------------------------------------
// RBJ biquad whose cutoff can change every sample (coefficients recomputed on demand).
export function createBiquad(type) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  let b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0
  let lastFrequency = -1
  let lastQ = -1
  function update(frequency, q) {
    const omega = (2 * Math.PI * Math.min(frequency, SAMPLE_RATE * 0.45)) / SAMPLE_RATE
    const alpha = Math.sin(omega) / (2 * q)
    const cosOmega = Math.cos(omega)
    let a0
    if (type === 'lowpass') {
      b0 = (1 - cosOmega) / 2; b1 = 1 - cosOmega; b2 = (1 - cosOmega) / 2
    } else if (type === 'highpass') {
      b0 = (1 + cosOmega) / 2; b1 = -(1 + cosOmega); b2 = (1 + cosOmega) / 2
    } else {
      // Constant 0 dB peak-gain bandpass.
      b0 = alpha; b1 = 0; b2 = -alpha
    }
    a0 = 1 + alpha
    a1 = (-2 * cosOmega) / a0
    a2 = (1 - alpha) / a0
    b0 /= a0; b1 /= a0; b2 /= a0
    lastFrequency = frequency
    lastQ = q
  }
  return (input, frequency, q = 0.707) => {
    if (frequency !== lastFrequency || q !== lastQ) update(frequency, q)
    const output = b0 * input + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1; x1 = input
    y2 = y1; y1 = output
    return output
  }
}

// --- Reverb (Freeverb topology) --------------------------------------------------------------
export function applyReverb(bus, { roomSize = 0.86, damping = 0.35, wet = 1 } = {}) {
  const combTunings = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
  const allpassTunings = [556, 441, 341, 225]
  const scale = SAMPLE_RATE / 44100
  const output = createBus(bus.length / SAMPLE_RATE)
  for (const [channel, spread] of [['left', 0], ['right', 23]]) {
    const input = bus[channel]
    const combs = combTunings.map((tuning) => ({ buffer: new Float32Array(Math.round((tuning + spread) * scale)), index: 0, filterStore: 0 }))
    const allpasses = allpassTunings.map((tuning) => ({ buffer: new Float32Array(Math.round((tuning + spread) * scale)), index: 0 }))
    const target = output[channel]
    for (let sampleIndex = 0; sampleIndex < bus.length; sampleIndex++) {
      const dry = input[sampleIndex] * 0.015
      let sum = 0
      for (const comb of combs) {
        const delayed = comb.buffer[comb.index]
        sum += delayed
        comb.filterStore = delayed * (1 - damping) + comb.filterStore * damping
        comb.buffer[comb.index] = dry + comb.filterStore * roomSize
        comb.index = (comb.index + 1) % comb.buffer.length
      }
      for (const allpass of allpasses) {
        const delayed = allpass.buffer[allpass.index]
        const value = -sum + delayed
        allpass.buffer[allpass.index] = sum + delayed * 0.5
        allpass.index = (allpass.index + 1) % allpass.buffer.length
        sum = value
      }
      target[sampleIndex] = sum * wet
    }
  }
  return output
}

// --- Master ----------------------------------------------------------------------------------
// Gentle tanh saturation above `threshold` so transients round off instead of clipping.
export function softClip(bus, threshold = 0.8) {
  const shape = (value) => {
    const magnitude = Math.abs(value)
    if (magnitude <= threshold) return value
    const over = (magnitude - threshold) / (1 - threshold)
    return Math.sign(value) * (threshold + (1 - threshold) * Math.tanh(over))
  }
  for (let index = 0; index < bus.length; index++) {
    bus.left[index] = shape(bus.left[index])
    bus.right[index] = shape(bus.right[index])
  }
}

export function peak(bus) {
  let maximum = 0
  for (let index = 0; index < bus.length; index++) maximum = Math.max(maximum, Math.abs(bus.left[index]), Math.abs(bus.right[index]))
  return maximum
}

export function scaleBus(bus, gain) {
  for (let index = 0; index < bus.length; index++) {
    bus.left[index] *= gain
    bus.right[index] *= gain
  }
}

export function writeWav(path, bus) {
  const bytesPerSample = 2
  const dataSize = bus.length * 2 * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(2, 22) // stereo
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * 2 * bytesPerSample, 28)
  buffer.writeUInt16LE(2 * bytesPerSample, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  let offset = 44
  for (let index = 0; index < bus.length; index++) {
    for (const channel of [bus.left, bus.right]) {
      const clamped = Math.max(-1, Math.min(1, channel[index]))
      buffer.writeInt16LE(Math.round(clamped * 32767), offset)
      offset += 2
    }
  }
  writeFileSync(path, buffer)
}

// Look-ahead peak limiter: gain reduction starts `attackSeconds` before a peak arrives (so
// transients are never clipped) and recovers exponentially over `releaseSeconds`.
export function limit(bus, { ceiling = 0.89, attackSeconds = 0.002, releaseSeconds = 0.09 } = {}) {
  const attackSamples = Math.max(1, Math.round(attackSeconds * SAMPLE_RATE))
  const releaseCoefficient = Math.exp(-1 / (releaseSeconds * SAMPLE_RATE))
  const required = new Float32Array(bus.length)
  for (let index = 0; index < bus.length; index++) {
    const level = Math.max(Math.abs(bus.left[index]), Math.abs(bus.right[index]))
    required[index] = level > ceiling ? ceiling / level : 1
  }
  // Backward pass: ramp the gain down linearly across the look-ahead window before each peak.
  const gain = new Float32Array(bus.length).fill(1)
  for (let index = bus.length - 1; index >= 0; index--) {
    const next = index + 1 < bus.length ? gain[index + 1] : 1
    gain[index] = Math.min(required[index], next + (1 - next) / attackSamples)
  }
  // Forward pass: never recover faster than the release allows.
  let smoothed = 1
  for (let index = 0; index < bus.length; index++) {
    smoothed = Math.min(gain[index], 1 - (1 - smoothed) * releaseCoefficient) // gain[index] is a hard cap
    bus.left[index] *= smoothed
    bus.right[index] *= smoothed
  }
}
