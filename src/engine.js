// Strettch Cloud showreel — deterministic motion engine.
//
// The one rule every scene must follow: what is on screen is a pure function of the global
// time `t` (seconds). No CSS transitions/animations, no Date.now(), no Math.random(), no
// requestAnimationFrame-driven state. The renderer seeks to arbitrary sub-frame times in any
// order (and in parallel browser pages), so any hidden state between frames breaks the video.
window.SC = (() => {
  const WIDTH = 1920
  const HEIGHT = 1080
  const FPS = 60
  const DURATION = 15

  // ------------------------------------------------------------------------------------------
  // Math
  // ------------------------------------------------------------------------------------------
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
  const lerp = (from, to, progress) => from + (to - from) * progress
  // Progress 0..1 of `value` between `start` and `end`, clamped.
  const progress = (value, start, end) => (end === start ? (value >= end ? 1 : 0) : clamp((value - start) / (end - start)))
  const mapRange = (value, inStart, inEnd, outStart, outEnd, easing = ease.linear) =>
    lerp(outStart, outEnd, easing(progress(value, inStart, inEnd)))
  const lerpArray = (from, to, amount) => from.map((value, index) => lerp(value, to[index], amount))

  // ------------------------------------------------------------------------------------------
  // Easing — every function maps 0..1 → 0..1 (overshooting ones may leave the range mid-way)
  // ------------------------------------------------------------------------------------------
  // CSS-compatible cubic-bezier, solved with Newton–Raphson then bisection fallback.
  function cubicBezier(x1, y1, x2, y2) {
    const sampleCurve = (a1, a2, tt) => ((1 - 3 * a2 + 3 * a1) * tt + (3 * a2 - 6 * a1)) * tt * tt + 3 * a1 * tt
    const sampleDerivative = (a1, a2, tt) => 3 * (1 - 3 * a2 + 3 * a1) * tt * tt + 2 * (3 * a2 - 6 * a1) * tt + 3 * a1
    function solveCurveX(x) {
      let guess = x
      for (let iteration = 0; iteration < 8; iteration++) {
        const error = sampleCurve(x1, x2, guess) - x
        if (Math.abs(error) < 1e-6) return guess
        const slope = sampleDerivative(x1, x2, guess)
        if (Math.abs(slope) < 1e-6) break
        guess -= error / slope
      }
      let low = 0
      let high = 1
      guess = x
      while (low < high) {
        const value = sampleCurve(x1, x2, guess)
        if (Math.abs(value - x) < 1e-6) return guess
        if (x > value) low = guess
        else high = guess
        guess = (high - low) / 2 + low
        if (high - low < 1e-7) break
      }
      return guess
    }
    return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleCurve(y1, y2, solveCurveX(x)))
  }

  // Closed-form damped spring settling from 0 to 1. `stiffness`/`damping`/`mass` behave like
  // the usual UI spring parameters; `duration` is how many seconds of spring time map onto
  // progress 0..1 (so springs can be used inside tween()).
  function spring({ stiffness = 170, damping = 26, mass = 1, velocity = 0, duration = 1 } = {}) {
    const omega = Math.sqrt(stiffness / mass)
    const zeta = damping / (2 * Math.sqrt(stiffness * mass))
    return (x) => {
      if (x <= 0) return 0
      if (x >= 1) return 1
      const time = x * duration
      if (zeta < 1) {
        const dampedOmega = omega * Math.sqrt(1 - zeta * zeta)
        const envelope = Math.exp(-zeta * omega * time)
        return 1 - envelope * (Math.cos(dampedOmega * time) + ((zeta * omega - velocity) / dampedOmega) * Math.sin(dampedOmega * time))
      }
      const envelope = Math.exp(-omega * time)
      return 1 - envelope * (1 + (omega - velocity) * time)
    }
  }

  const ease = {
    linear: (x) => x,
    inQuad: (x) => x * x,
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
    inCubic: (x) => x * x * x,
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    inQuart: (x) => x * x * x * x,
    outQuart: (x) => 1 - Math.pow(1 - x, 4),
    inOutQuart: (x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),
    inQuint: (x) => x * x * x * x * x,
    outQuint: (x) => 1 - Math.pow(1 - x, 5),
    inOutQuint: (x) => (x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2),
    inExpo: (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
    outExpo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inOutExpo: (x) => (x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
    inCirc: (x) => 1 - Math.sqrt(1 - x * x),
    outCirc: (x) => Math.sqrt(1 - Math.pow(x - 1, 2)),
    outBack: (x, overshoot = 1.70158) => 1 + (overshoot + 1) * Math.pow(x - 1, 3) + overshoot * Math.pow(x - 1, 2),
    inBack: (x, overshoot = 1.70158) => (overshoot + 1) * x * x * x - overshoot * x * x,
    outElastic: (x) => (x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
    // Motion-design staples expressed as CSS beziers.
    snappy: cubicBezier(0.16, 1, 0.3, 1), // fast out, long settle — default for entrances
    swift: cubicBezier(0.7, 0, 0.84, 0), // slow start, violent end — default for exits
    whip: cubicBezier(0.87, 0, 0.13, 1), // whip-pan / hard in-out
    smooth: cubicBezier(0.45, 0, 0.55, 1),
    cubicBezier,
    spring,
  }
  // Named ease lookup that also accepts a function, a bezier array or a spring config object.
  const resolveEase = (easing) => {
    if (!easing) return ease.inOutCubic
    if (typeof easing === 'function') return easing
    if (typeof easing === 'string') {
      if (!ease[easing]) throw new Error(`Unknown ease "${easing}"`)
      return ease[easing]
    }
    if (Array.isArray(easing)) return cubicBezier(...easing)
    return spring(easing)
  }

  // ------------------------------------------------------------------------------------------
  // Tweening
  // ------------------------------------------------------------------------------------------
  // Value of a single tween at time t. Numbers or equal-length arrays.
  function tween(time, startTime, endTime, from, to, easing) {
    const amount = resolveEase(easing)(progress(time, startTime, endTime))
    return Array.isArray(from) ? lerpArray(from, to, amount) : lerp(from, to, amount)
  }

  // Keyframe track: [[time, value], [time, value, easeIntoThisKey], ...]. Holds the first value
  // before the first key and the last value after the last key.
  function keyframes(time, keys) {
    if (time <= keys[0][0]) return keys[0][1]
    for (let index = 1; index < keys.length; index++) {
      const [keyTime, keyValue, keyEase] = keys[index]
      if (time <= keyTime) {
        const [previousTime, previousValue] = keys[index - 1]
        return tween(time, previousTime, keyTime, previousValue, keyValue, keyEase)
      }
    }
    return keys[keys.length - 1][1]
  }

  // Start time for item `index` of `count` staggered across `spread` seconds, optionally from
  // the centre or the end, with an easing on the distribution itself.
  function stagger(index, count, { start = 0, each = 0.03, from = 'start', easing = 'linear' } = {}) {
    if (count <= 1) return start
    let position
    if (from === 'center') position = Math.abs(index - (count - 1) / 2) / ((count - 1) / 2)
    else if (from === 'end') position = (count - 1 - index) / (count - 1)
    else position = index / (count - 1)
    return start + resolveEase(easing)(position) * each * (count - 1)
  }

  // ------------------------------------------------------------------------------------------
  // Deterministic randomness
  // ------------------------------------------------------------------------------------------
  // Integer hash → 0..1. Same inputs always give the same output across pages and runs.
  function hash(...values) {
    let state = 2166136261
    for (const value of values) {
      state ^= Math.floor(value * 1000) | 0
      state = Math.imul(state, 16777619)
      state ^= state >>> 13
      state = Math.imul(state, 0x5bd1e995)
      state ^= state >>> 15
    }
    return (state >>> 0) / 4294967296
  }
  // Seeded PRNG for building static layouts at build() time (particle start positions etc).
  function rng(seed) {
    let state = seed >>> 0
    return () => {
      state = (state + 0x6d2b79f5) >>> 0
      let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
      mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
    }
  }
  // Smooth 1-D value noise in -1..1 — use for organic jitter/wobble driven by time.
  function noise(x, seed = 0) {
    const cell = Math.floor(x)
    const fraction = x - cell
    const smoothed = fraction * fraction * (3 - 2 * fraction)
    return lerp(hash(cell, seed) * 2 - 1, hash(cell + 1, seed) * 2 - 1, smoothed)
  }

  // ------------------------------------------------------------------------------------------
  // DOM helpers
  // ------------------------------------------------------------------------------------------
  const SVG_NS = 'http://www.w3.org/2000/svg'
  function applyProps(node, { className, style, text, attrs } = {}) {
    if (className) node.setAttribute('class', className)
    if (style) Object.assign(node.style, style)
    if (text !== undefined) node.textContent = text
    if (attrs) for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value)
    return node
  }
  const el = (tag, props, parent) => {
    const node = applyProps(document.createElement(tag), props)
    if (parent) parent.appendChild(node)
    return node
  }
  const svg = (tag, attrs, parent) => {
    const node = document.createElementNS(SVG_NS, tag)
    if (attrs) for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value)
    if (parent) parent.appendChild(node)
    return node
  }
  // Splits text into one inline-block <span> per character (spaces kept as fixed-width spans) so
  // each glyph can be transformed independently. Returns the glyph spans in reading order.
  function splitText(parent, text, { className = 'glyph' } = {}) {
    return [...text].map((character) => {
      const span = el('span', { className, text: character === ' ' ? ' ' : character }, parent)
      span.style.display = 'inline-block'
      span.style.whiteSpace = 'pre'
      return span
    })
  }
  // Only touches the DOM when the value actually changed — keeps style recalcs cheap.
  function setStyle(node, styles) {
    const cache = node.__styleCache || (node.__styleCache = {})
    for (const property in styles) {
      const value = styles[property]
      if (cache[property] !== value) {
        cache[property] = value
        if (property.startsWith('--')) node.style.setProperty(property, value)
        else node.style[property] = value
      }
    }
  }
  function setAttrs(node, attrs) {
    const cache = node.__attrCache || (node.__attrCache = {})
    for (const name in attrs) {
      const value = String(attrs[name])
      if (cache[name] !== value) {
        cache[name] = value
        node.setAttribute(name, value)
      }
    }
  }
  const px = (value) => `${value}px`
  const round = (value, decimals = 3) => Math.round(value * 10 ** decimals) / 10 ** decimals

  // ------------------------------------------------------------------------------------------
  // Geo helpers (data in window.SC_GEO, built by tools/build-assets.mjs)
  // ------------------------------------------------------------------------------------------
  const toRadians = (degrees) => (degrees * Math.PI) / 180
  // Plain equirectangular-ish projection with cos(lat0) correction; fine at continent scale.
  // `bounds` = [west, south, east, north]; fits into the box {x, y, width, height}.
  function makeProjection(bounds, box) {
    const [west, south, east, north] = bounds
    const latitudeScale = Math.cos(toRadians((south + north) / 2))
    const spanX = (east - west) * latitudeScale
    const spanY = north - south
    const scale = Math.min(box.width / spanX, box.height / spanY)
    const offsetX = box.x + (box.width - spanX * scale) / 2
    const offsetY = box.y + (box.height - spanY * scale) / 2
    const project = ([lon, lat]) => [offsetX + (lon - west) * latitudeScale * scale, offsetY + (north - lat) * scale]
    project.scale = scale
    return project
  }
  // Orthographic globe projection centred on [lon0, lat0]; returns null for back-facing points.
  function orthographic(center, radius, cx, cy) {
    const lambda0 = toRadians(center[0])
    const phi0 = toRadians(center[1])
    return ([lon, lat]) => {
      const lambda = toRadians(lon)
      const phi = toRadians(lat)
      const cosC = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda - lambda0)
      if (cosC < 0) return null
      return [
        cx + radius * Math.cos(phi) * Math.sin(lambda - lambda0),
        cy - radius * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lambda - lambda0)),
      ]
    }
  }
  function ringsToPath(polygons, project) {
    let path = ''
    for (const polygon of polygons) {
      for (const ring of polygon) {
        ring.forEach((point, index) => {
          const [x, y] = project(point)
          path += `${index === 0 ? 'M' : 'L'}${round(x, 1)},${round(y, 1)}`
        })
        path += 'Z'
      }
    }
    return path
  }
  function pointInRing([lon, lat], ring) {
    let inside = false
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      const [xi, yi] = ring[index]
      const [xj, yj] = ring[previous]
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
  const pointInPolygons = (point, polygons) =>
    polygons.some((polygon) => pointInRing(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(point, hole)))
  // Grid of lon/lat points (every `step` degrees) that fall on African land. Each item also
  // carries the country name so scenes can highlight Rwanda.
  function africaDots(step = 1) {
    const dots = []
    for (let lat = 38; lat >= -36; lat -= step) {
      for (let lon = -19; lon <= 52; lon += step) {
        const country = window.SC_GEO.africa.find((candidate) => pointInPolygons([lon, lat], candidate.polygons))
        if (country) dots.push({ lon, lat, country: country.name })
      }
    }
    return dots
  }

  // ------------------------------------------------------------------------------------------
  // Brand
  // ------------------------------------------------------------------------------------------
  const tokens = {
    violet: '#6B63FF',
    violetLight: '#8982FF',
    violetDark: '#4C46B5',
    ink: '#07061A', // background — near-black with a violet cast
    inkRaised: '#0F0D2B',
    inkLine: '#27245C',
    lavender: '#D1CFFF',
    paper: '#F4F3FF',
    white: '#FFFFFF',
    signalGreen: '#3DDC97', // "Running" / healthy
    alertRed: '#FF5C7A', // the slow, far-away 110 ms
    fonts: {
      display: "'Space Grotesk', 'Inter', sans-serif",
      text: "'Inter', sans-serif",
      mono: "'JetBrains Mono', monospace",
      serif: "'Instrument Serif', serif",
    },
  }
  // The three logo slabs as polygons in the 34×32 logo unit space (from logo-dark.svg).
  const logoSlabs = {
    top: [[0, 9.998], [34, 0], [33.925, 11.517], [0, 15.842]],
    middle: [[0, 18.027], [33.958, 13.849], [33.83, 23.871], [0, 23.871]],
    bottom: [[0, 26.055], [27.52, 26.055], [27.52, 31.898], [0, 31.898]],
  }
  // Builds the real brand lockup as SVG: the three-slab mark + the "strettch cloud" wordmark,
  // with every wordmark letter as its own <path> so scenes can animate glyphs individually.
  // Logo units: the mark occupies x 0–34, the wordmark x 42.7–186, all within y 0–32.
  // `height` is the rendered px height of the 32-unit-tall box (so 1 unit = height/32 px).
  // Returns { root, markGroup, slabs: {top, middle, bottom}, wordmarkGroup, letters: [{char, word, path, box}] }.
  function createLogo(parent, { height = 64, markOnly = false } = {}) {
    const logo = window.SC_LOGO
    const viewWidth = markOnly ? 34 : logo.viewBox[2]
    const root = svg('svg', { viewBox: `0 0 ${viewWidth} 32`, width: (viewWidth / 32) * height, height, overflow: 'visible' }, parent)
    const markGroup = svg('g', {}, root)
    const slabs = {
      top: svg('path', { d: logo.markSlabs.top, fill: logo.colors.mark }, markGroup),
      middle: svg('path', { d: logo.markSlabs.middle, fill: logo.colors.mark }, markGroup),
      // The bottom slab carries the small "server LED" hole — evenodd keeps it punched out.
      bottom: svg('path', { d: logo.markSlabs.bottom, fill: logo.colors.mark, 'fill-rule': 'evenodd' }, markGroup),
    }
    if (markOnly) return { root, markGroup, slabs }
    const wordmarkGroup = svg('g', {}, root)
    const letters = logo.letters.map((letter) => ({
      ...letter,
      path: svg('path', { d: letter.d, fill: logo.colors.wordmark, 'transform-box': 'fill-box', 'transform-origin': 'center' }, wordmarkGroup),
    }))
    return { root, markGroup, slabs, wordmarkGroup, letters }
  }

  // ------------------------------------------------------------------------------------------
  // Scenes
  // ------------------------------------------------------------------------------------------
  const scenes = []
  // def: { id, start, end, z, build(root, api) → state, render(t, state, api) }
  // `t` passed to render is GLOBAL time in seconds. The scene root is a 1920×1080 absolutely
  // positioned div, shown only while start <= t < end.
  function scene(def) {
    if (!def.id || typeof def.start !== 'number' || typeof def.end !== 'number') throw new Error('scene needs id/start/end')
    scenes.push({ z: 0, ...def })
  }

  // ------------------------------------------------------------------------------------------
  // Global post: camera shake + chromatic aberration hits, grain, vignette
  // ------------------------------------------------------------------------------------------
  const post = {
    // [{ time, intensity 0..1, aberration 0..1 }] — filled in by src/post-config.js. `intensity`
    // drives camera shake; `aberration` drives the RGB split separately, because a split strong
    // enough to feel like an impact also fringes any logo or type that lands on the same beat.
    hits: [],
    shakeDecay: 0.35, // seconds until a hit's shake has mostly died out
    grainOpacity: 0.07,
    // Keyframes [[time, opacity], ...] for the vignette. It is tuned for the ink background and
    // turns flat brand violet muddy, so post-config dims it over the violet sections.
    vignette: [[0, 1]],
    // Render-only: spans that need more motion-blur samples than the default (read by
    // render/render.mjs). [{ from, to, subframes }] in global seconds.
    motionBlurWindows: [],
  }
  function hitEnvelope(time, field) {
    let strongest = 0
    for (const hit of post.hits) {
      if (time < hit.time) continue
      const elapsed = time - hit.time
      const amount = field === 'aberration' ? hit.aberration ?? hit.intensity : hit.intensity
      strongest = Math.max(strongest, amount * Math.exp(-elapsed / (post.shakeDecay / 3)))
    }
    return strongest
  }

  let stage
  let grainCanvas
  let grainTiles = []
  let caFilterOffsets
  let vignette
  let soloId = null

  function buildGrainTiles() {
    const random = rng(1234)
    const size = 256
    grainTiles = Array.from({ length: 6 }, () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      const image = context.createImageData(size, size)
      for (let index = 0; index < image.data.length; index += 4) {
        const value = random() * 255
        image.data[index] = value
        image.data[index + 1] = value
        image.data[index + 2] = value
        image.data[index + 3] = 255
      }
      context.putImageData(image, 0, 0)
      return canvas
    })
  }

  function renderPost(time) {
    const frameIndex = Math.floor(time * FPS)
    // Shake: two noise channels per axis, scaled by the decaying hit envelope.
    const envelope = hitEnvelope(time, 'intensity')
    const shakeX = noise(time * 38, 11) * 14 * envelope
    const shakeY = noise(time * 41, 23) * 10 * envelope
    const shakeRotate = noise(time * 29, 37) * 0.35 * envelope
    // Overscan while shaking so the displaced stage never exposes the frame edge (a flickering
    // black border on full-bleed violet): 3% covers 14 px + 0.35° at full intensity.
    const overscan = 1 + 0.03 * envelope
    setStyle(stage, { transform: `translate(${round(shakeX, 2)}px, ${round(shakeY, 2)}px) rotate(${round(shakeRotate, 3)}deg) scale(${round(overscan, 4)})` })
    // Chromatic aberration: split R and B channels horizontally while a hit is fresh.
    const aberrationEnvelope = hitEnvelope(time, 'aberration')
    const aberration = aberrationEnvelope > 0.03 ? aberrationEnvelope * 9 : 0
    if (aberration > 0) {
      caFilterOffsets.red.setAttribute('dx', round(aberration, 2))
      caFilterOffsets.blue.setAttribute('dx', round(-aberration, 2))
      setStyle(stage, { filter: 'url(#sc-chromatic)' })
    } else {
      setStyle(stage, { filter: 'none' })
    }
    setStyle(vignette, { opacity: String(round(keyframes(time, post.vignette), 3)) })
    // Grain: pick a tile per frame and jitter its offset so the texture boils at 60 fps.
    const context = grainCanvas.getContext('2d')
    const tile = grainTiles[frameIndex % grainTiles.length]
    const offsetX = Math.floor(hash(frameIndex, 1) * 256)
    const offsetY = Math.floor(hash(frameIndex, 2) * 256)
    context.clearRect(0, 0, WIDTH, HEIGHT)
    for (let y = -offsetY; y < HEIGHT; y += 256) for (let x = -offsetX; x < WIDTH; x += 256) context.drawImage(tile, x, y)
  }

  function buildPostLayers(frame) {
    const defs = svg('svg', { width: 0, height: 0, style: 'position:absolute' }, document.body)
    defs.innerHTML = `
      <filter id="sc-chromatic" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>
        <feOffset in="red" dx="0" dy="0" result="redShifted"/>
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"/>
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"/>
        <feOffset in="blue" dx="0" dy="0" result="blueShifted"/>
        <feBlend in="redShifted" in2="green" mode="screen" result="redGreen"/>
        <feBlend in="redGreen" in2="blueShifted" mode="screen"/>
      </filter>`
    const offsets = defs.querySelectorAll('feOffset')
    caFilterOffsets = { red: offsets[0], blue: offsets[1] }
    vignette = el('div', { className: 'sc-vignette' }, frame)
    grainCanvas = el('canvas', { className: 'sc-grain', attrs: { width: WIDTH, height: HEIGHT } }, frame)
    grainCanvas.style.opacity = post.grainOpacity
    buildGrainTiles()
  }

  // ------------------------------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------------------------------
  const api = {} // filled below; handed to every scene's build/render
  let ready = false
  let currentTime = 0

  async function init() {
    const params = new URLSearchParams(location.search)
    soloId = params.get('solo')
    // Load every face we use before building anything that measures text.
    const faces = [
      '400 64px Inter', '700 64px Inter', '900 64px Inter', '300 64px Inter',
      '400 64px "Space Grotesk"', '700 64px "Space Grotesk"', '300 64px "Space Grotesk"',
      '400 64px "JetBrains Mono"', '700 64px "JetBrains Mono"',
      '400 64px "Instrument Serif"', 'italic 400 64px "Instrument Serif"',
    ]
    await Promise.all(faces.map((face) => document.fonts.load(face)))
    await document.fonts.ready

    const frame = document.getElementById('frame')
    stage = el('div', { className: 'sc-stage' }, frame)
    buildPostLayers(frame)

    scenes.sort((a, b) => a.z - b.z)
    for (const definition of scenes) {
      if (soloId && definition.id !== soloId) continue
      definition.root = el('div', { className: 'sc-scene', attrs: { 'data-scene': definition.id } }, stage)
      definition.root.style.zIndex = definition.z
      definition.root.style.display = 'none'
      definition.state = definition.build ? definition.build(definition.root, api) || {} : {}
    }
    ready = true
    seek(0)
  }

  function seek(time) {
    currentTime = clamp(time, 0, DURATION - 1e-6)
    for (const definition of scenes) {
      if (!definition.root) continue
      const visible = currentTime >= definition.start && currentTime < definition.end
      setStyle(definition.root, { display: visible ? 'block' : 'none' })
      if (visible && definition.render) definition.render(currentTime, definition.state, api)
    }
    renderPost(currentTime)
  }

  Object.assign(api, {
    WIDTH, HEIGHT, FPS, DURATION,
    clamp, lerp, progress, mapRange, lerpArray, round, px,
    ease, resolveEase, tween, keyframes, stagger,
    hash, rng, noise,
    el, svg, splitText, setStyle, setAttrs,
    makeProjection, orthographic, ringsToPath, pointInPolygons, africaDots,
    tokens, logoSlabs, createLogo,
    post,
    scene, init, seek,
    get ready() { return ready },
    get time() { return currentTime },
  })
  return api
})()
