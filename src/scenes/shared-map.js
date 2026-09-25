// Shared map / route / odometer formulas for s02-far and s03-snap.
//
// Implements storyboard/master.json → design_system.shared_components exactly once, so the two
// scenes that hand off at 6.500 draw the same pixels from the same code: map_projection,
// dot_field, lanes(E), the packet timeline, odometer, halo_sprite and mask_rise. It also owns the
// canvas draw primitives and the HUD layout both scenes use, because "re-create s02's exit state
// exactly" is only trustworthy when both frames come out of one function.
//
// Loaded before the scenes (src/scenes/index.js). Pure functions of t only; never calls SC.scene.
window.SC_SHARED = (() => {
  const SC = window.SC
  const { tokens, ease, clamp, lerp, progress, tween } = SC
  const TAU = Math.PI * 2

  // ------------------------------------------------------------------------------------------
  // Palette (design_system.palette)
  // ------------------------------------------------------------------------------------------
  const COLOR = {
    ink: tokens.ink,
    dotDim: '#2E2A66',
    slate: '#8C89A8',
    violet: tokens.violet,
    violetLight: tokens.violetLight,
    paper: tokens.paper,
    white: tokens.white,
  }
  const hexToRgb = (hex) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
  const rgba = (hex, alpha = 1) => {
    const [r, g, b] = hexToRgb(hex)
    return `rgba(${r},${g},${b},${alpha})`
  }
  // Colour tween on one object (allowed by the transition grammar). Returns the hex string at the
  // endpoints so the handoff frames use the exact same fill strings as a plain colour.
  function mix(from, to, amount) {
    const k = clamp(amount)
    if (k <= 0) return from
    if (k >= 1) return to
    const a = hexToRgb(from)
    const b = hexToRgb(to)
    return `rgb(${a.map((value, index) => Math.round(lerp(value, b[index], k))).join(',')})`
  }

  // ------------------------------------------------------------------------------------------
  // Eases (design_system.easing_vocabulary) — built once
  // ------------------------------------------------------------------------------------------
  const EASE = {
    reveal: ease.snappy,
    exit: ease.swift,
    carry: ease.inOutCubic,
    shuttle: ease.cubicBezier(0.37, 0, 0.63, 1),
    thud: ease.spring({ stiffness: 600, damping: 40, mass: 1, duration: 0.3 }),
    snapBack: ease.spring({ stiffness: 484, damping: 13.2, mass: 1, duration: 0.8 }),
  }
  const smoothstep = (x) => {
    const k = clamp(x)
    return k * k * (3 - 2 * k)
  }

  // ------------------------------------------------------------------------------------------
  // map_projection: equirectangular, 12 px per degree at Z = 1, anchored on Kigali.
  // screen = K_s + ((lon − 30.0619)·12·Z, −(lat + 1.9441)·12·Z)
  // ------------------------------------------------------------------------------------------
  const KIGALI = [30.0619, -1.9441]
  const CAPE_TOWN = [18.4241, -33.9249]
  const PX_PER_DEGREE = 12
  const K = { x: 1560, y: 530 } // Kigali's screen position in s02/s03
  const relX = (lon) => (lon - KIGALI[0]) * PX_PER_DEGREE // offset from K at Z = 1
  const relY = (lat) => -(lat - KIGALI[1]) * PX_PER_DEGREE
  function projectToScreen(lon, lat, Z = 1, Ks = K) {
    return { x: Ks.x + relX(lon) * Z, y: Ks.y + relY(lat) * Z }
  }
  const C = projectToScreen(CAPE_TOWN[0], CAPE_TOWN[1]) // (1420.35, 913.77)

  // ------------------------------------------------------------------------------------------
  // lanes(E): two quadratic Béziers K → E, offset ±6 px along n̂, bulging h = 90·L/408.39.
  // Both lanes are the centre curve (K, M + h·n̂, E) shifted by ±6·n̂, so the projection of a
  // lane point onto the K→E chord is exactly s·L — the colour-front gradient relies on that.
  // ------------------------------------------------------------------------------------------
  const LANE_OFFSET = 6
  function lanes(E) {
    const dx = E.x - K.x
    const dy = E.y - K.y
    const L = Math.hypot(dx, dy)
    const ux = L > 1e-9 ? dx / L : 0
    const uy = L > 1e-9 ? dy / L : 0
    const nx = -uy
    const ny = ux
    const h = (90 * L) / 408.39
    const M = { x: (K.x + E.x) / 2, y: (K.y + E.y) / 2 }
    const at = (point, amount) => ({ x: point.x + nx * amount, y: point.y + ny * amount })
    return {
      K, E, L, h, M,
      u: { x: ux, y: uy },
      n: { x: nx, y: ny },
      out: [at(K, LANE_OFFSET), at(M, h + LANE_OFFSET), at(E, LANE_OFFSET)],
      ret: [at(K, -LANE_OFFSET), at(M, h - LANE_OFFSET), at(E, -LANE_OFFSET)],
      centre: [K, at(M, h), E],
    }
  }
  const REST = lanes(C) // the route at rest, E = Cape Town
  function quadratic(P, s) {
    const a = (1 - s) * (1 - s)
    const b = 2 * s * (1 - s)
    const c = s * s
    return { x: a * P[0].x + b * P[1].x + c * P[2].x, y: a * P[0].y + b * P[1].y + c * P[2].y }
  }

  // ------------------------------------------------------------------------------------------
  // s02 route dynamics: the 5.25 pluck and the 5.50–6.50 tremble, displacement along n̂.
  // Both freeze to exactly 0 at 6.50 (the pluck is multiplied by the same 6.40–6.50 freeze as
  // the tremble; its residual there is < 0.4 px) so the handoff is lanes(C) to the pixel.
  // ------------------------------------------------------------------------------------------
  function routeAmplitude(t) {
    if (t < 5.25 || t >= 6.5) return 0
    const freeze = 1 - progress(t, 6.4, 6.5)
    const tau = t - 5.25
    let amplitude = 22 * Math.exp(-3.5 * tau) * Math.sin(TAU * 9 * tau)
    if (t >= 5.5) amplitude += (1.5 + 6.5 * progress(t, 5.5, 6.4) ** 2) * SC.noise(t * 24, 7)
    return amplitude * freeze
  }
  const displacement = (amplitude, s) => (amplitude === 0 ? 0 : Math.sin(Math.PI * s) * amplitude)

  // ------------------------------------------------------------------------------------------
  // Packet timeline (s02 legs + s03 snap ride), one function of t for both scenes so the
  // 8-ghost trail at 6.500 (ghosts at 6.488 … 6.404) is identical in s02 and s03.
  // ------------------------------------------------------------------------------------------
  const LEGS = [
    [4.0, 4.5, 1], // out:    s 0 → 1 on the out lane
    [4.5, 5.0, -1], // back:  s 1 → 0 on the return lane
    [5.0, 5.5, 1],
    [5.5, 6.0, -1],
    [6.0, 6.5, 1], // arrives at A2 exactly at 6.500
  ]
  // Lane side σ: +1 out lane, −1 return lane. At each turnaround the packet (whose s-velocity is
  // 0 there under the shuttle ease) crosses the 12 px between lanes over ±35 ms instead of
  // teleporting — it reads as a U-turn inside the node ring / under the Kigali dot.
  const TURN_HALF = 0.035
  function laneSide(t) {
    let side = 1
    for (let index = 1; index < LEGS.length; index++) {
      const turn = LEGS[index][0]
      side += (LEGS[index][2] - LEGS[index - 1][2]) * smoothstep(progress(t, turn - TURN_HALF, turn + TURN_HALF))
    }
    return side
  }
  function packetS(t) {
    if (t <= LEGS[0][0]) return 0
    for (const [start, end, direction] of LEGS) {
      if (t < end) {
        const amount = EASE.shuttle(progress(t, start, end))
        return direction > 0 ? amount : 1 - amount
      }
    }
    return 1
  }
  // Far end of the route during THE SNAP: E(t) = C + (K − C)·snapBack(progress(t, 6.5, 7.3)).
  function snapE(t) {
    const amount = t <= 6.5 ? 0 : EASE.snapBack(progress(t, 6.5, 7.3))
    return { x: C.x + (K.x - C.x) * amount, y: C.y + (K.y - C.y) * amount }
  }
  function packetPos(t) {
    if (t < 6.5) {
      const s = packetS(t)
      const point = quadratic(REST.centre, s)
      const offset = LANE_OFFSET * laneSide(t) + displacement(routeAmplitude(t), s)
      return { x: point.x + REST.n.x * offset, y: point.y + REST.n.y * offset }
    }
    // s03: rides the out-lane far end A2(E(t)); from 6.85 it is drawn into Kigali.
    const far = lanes(snapE(t)).out[2]
    const pull = smoothstep(progress(t, 6.85, 7.0))
    return { x: lerp(far.x, K.x, pull), y: lerp(far.y, K.y, pull) }
  }
  // Scale: emerges from the Kigali dot 4.00–4.06, absorbed into the LED at 7.000.
  const packetScale = (t) => (t < 4.0 || t >= 7.0 ? 0 : tween(t, 4.0, 4.06, 0, 1, EASE.reveal))
  // Paper, turning violetLight as the s03 colour front passes it (6.58, two frames).
  const packetColor = (t) => mix(COLOR.paper, COLOR.violetLight, progress(t, 6.58, 6.58 + 2 / 60))

  // ------------------------------------------------------------------------------------------
  // Camera for s03: crash zoom (outExpo on log scale) then a slow creep. Z = 1 before 6.5.
  // ------------------------------------------------------------------------------------------
  function zoomZ(t) {
    if (t <= 6.5) return 1
    if (t < 7.1) return Math.pow(20, ease.outExpo(progress(t, 6.5, 7.1)))
    return 20 + (Math.min(t, 8.5) - 7.1) / 1.4
  }

  // ------------------------------------------------------------------------------------------
  // dot_field: api.africaDots(1) — 2,553 dots, all of them. Cached offsets from K at Z = 1.
  // ------------------------------------------------------------------------------------------
  let dotFieldCache = null
  function dotField() {
    if (dotFieldCache) return dotFieldCache
    const dots = SC.africaDots(1)
    const count = dots.length
    const rx = new Float64Array(count)
    const ry = new Float64Array(count)
    const distance = new Float64Array(count)
    let rwandaIndex = -1
    dots.forEach((dot, index) => {
      rx[index] = relX(dot.lon)
      ry[index] = relY(dot.lat)
      distance[index] = Math.hypot(rx[index], ry[index])
      if (dot.lon === 30 && dot.lat === -2) rwandaIndex = index // the single Rwanda grid dot
    })
    dotFieldCache = { count, rx, ry, distance, rwandaIndex, radius: 2.6, rwandaRadius: 3.2 }
    return dotFieldCache
  }

  // Level-of-detail Rwanda: 0.05° grid over lon 28.85–30.90, lat −1.00…−2.85, kept when inside the
  // Rwanda polygon. Grid coordinates are rounded to 0.01° (float drift would drop one point) → 828.
  let fineCache = null
  function rwandaFineDots() {
    if (fineCache) return fineCache
    const rwanda = window.SC_GEO.africa.find((country) => country.name === 'Rwanda').polygons
    const points = []
    for (let row = 0; row <= 37; row++) {
      const lat = Math.round((-1.0 - 0.05 * row) * 100) / 100
      for (let column = 0; column <= 41; column++) {
        const lon = Math.round((28.85 + 0.05 * column) * 100) / 100
        if (SC.pointInPolygons([lon, lat], rwanda)) points.push([lon, lat])
      }
    }
    const count = points.length
    const rx = new Float64Array(count)
    const ry = new Float64Array(count)
    const distance = new Float64Array(count)
    let maxDistance = 0
    points.forEach(([lon, lat], index) => {
      rx[index] = relX(lon)
      ry[index] = relY(lat)
      distance[index] = Math.hypot(rx[index], ry[index])
      maxDistance = Math.max(maxDistance, distance[index])
    })
    fineCache = { count, rx, ry, distance, maxDistance }
    return fineCache
  }

  // ------------------------------------------------------------------------------------------
  // halo_sprite: 128×128, #8982FF alpha 1 at the centre → 0 at the edge. Pre-rendered once.
  // ------------------------------------------------------------------------------------------
  let haloCache = null
  function haloSprite() {
    if (haloCache) return haloCache
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
    // A soft (1 − r)^1.6 falloff: alpha 1 at the centre, 0 at the edge, no visible cone tip.
    for (let stop = 0; stop <= 8; stop++) {
      const radius = stop / 8
      gradient.addColorStop(radius, rgba(COLOR.violetLight, Math.pow(1 - radius, 1.6)))
    }
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)
    haloCache = canvas
    return canvas
  }

  // ------------------------------------------------------------------------------------------
  // Canvas primitives shared by both scenes (identical code path = identical pixels at 6.500)
  // ------------------------------------------------------------------------------------------
  function createMapCanvas(root) {
    const canvas = SC.el('canvas', { attrs: { width: SC.WIDTH, height: SC.HEIGHT } }, root)
    canvas.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px'
    return { canvas, context: canvas.getContext('2d') }
  }
  function resetContext(context) {
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.globalAlpha = 1
    context.globalCompositeOperation = 'source-over'
    context.clearRect(0, 0, SC.WIDTH, SC.HEIGHT)
  }
  function fillDisc(context, color, x, y, r, alpha = 1) {
    if (r <= 0 || alpha <= 0) return
    context.globalAlpha = alpha
    context.fillStyle = color
    context.beginPath()
    context.arc(x, y, r, 0, TAU)
    context.fill()
    context.globalAlpha = 1
  }
  function strokeRing(context, color, x, y, r, width, alpha = 1) {
    if (r <= 0 || width <= 0 || alpha <= 0) return
    context.globalAlpha = alpha
    context.strokeStyle = color
    context.lineWidth = width
    context.beginPath()
    context.arc(x, y, r, 0, TAU)
    context.stroke()
    context.globalAlpha = 1
  }
  // Dots and their motion streaks as ONE filled path: capsule k runs from (segs[4k], segs[4k+1])
  // (position at t − 0.0021) to (segs[4k+2], segs[4k+3]) (position at t), radius rs[k]. A capsule
  // shorter than 0.3 px is drawn as a plain disc, so a still dot field is byte-identical whichever
  // scene draws it. All sub-paths wind clockwise, so overlaps stay filled under nonzero.
  function fillCapsules(context, color, segs, rs, n) {
    if (!n) return
    context.globalAlpha = 1
    context.fillStyle = color
    context.beginPath()
    for (let index = 0; index < n; index++) {
      const r = rs[index]
      if (r <= 0) continue
      const offset = index * 4
      const x0 = segs[offset]
      const y0 = segs[offset + 1]
      const x1 = segs[offset + 2]
      const y1 = segs[offset + 3]
      const dx = x1 - x0
      const dy = y1 - y0
      if (dx * dx + dy * dy < 0.09) {
        context.moveTo(x1 + r, y1)
        context.arc(x1, y1, r, 0, TAU)
        continue
      }
      const angle = Math.atan2(dy, dx)
      const half = Math.PI / 2
      context.moveTo(x1 + r * Math.cos(angle - half), y1 + r * Math.sin(angle - half))
      context.arc(x1, y1, r, angle - half, angle + half)
      context.arc(x0, y0, r, angle + half, angle + 3 * half)
      context.closePath()
    }
    context.fill()
  }
  // Same picture as fillCapsules, cheaper to rasterise during the crash zoom: still dots go into
  // one disc path (identical to fillCapsules), moving dots of the common radius are stroked as
  // round-capped segments (lineWidth 2r) in one batch; any other moving dot falls back to a
  // filled capsule outline.
  const movingSegs = new Float64Array(4 * 4096)
  const otherSegs = new Float64Array(4 * 4096)
  const otherRadii = new Float64Array(4096)
  function paintDots(context, color, segs, rs, n, commonRadius) {
    if (!n) return
    context.globalAlpha = 1
    context.fillStyle = color
    context.beginPath()
    let moving = 0
    let other = 0
    for (let index = 0; index < n; index++) {
      const r = rs[index]
      if (r <= 0) continue
      const offset = index * 4
      const dx = segs[offset + 2] - segs[offset]
      const dy = segs[offset + 3] - segs[offset + 1]
      if (dx * dx + dy * dy < 0.09) {
        context.moveTo(segs[offset + 2] + r, segs[offset + 3])
        context.arc(segs[offset + 2], segs[offset + 3], r, 0, TAU)
      } else if (r === commonRadius && moving < 4096) {
        movingSegs.set(segs.subarray(offset, offset + 4), moving * 4)
        moving++
      } else if (other < 4096) {
        otherSegs.set(segs.subarray(offset, offset + 4), other * 4)
        otherRadii[other] = r
        other++
      }
    }
    context.fill()
    if (moving) strokeCapsules(context, color, commonRadius * 2, movingSegs, moving)
    if (other) fillCapsules(context, color, otherSegs, otherRadii, other)
  }
  // Round-capped capsules (streaks) of equal width, batched: segs = [x0, y0, x1, y1, ...].
  function strokeCapsules(context, color, width, segs, n) {
    if (!n) return
    context.strokeStyle = color
    context.lineWidth = width
    context.lineCap = 'round'
    context.beginPath()
    for (let index = 0; index < n; index++) {
      const offset = index * 4
      context.moveTo(segs[offset], segs[offset + 1])
      context.lineTo(segs[offset + 2], segs[offset + 3])
    }
    context.stroke()
  }
  function drawSprite(context, sprite, x, y, radius, alpha) {
    if (radius <= 0 || alpha <= 0) return
    context.globalAlpha = alpha
    context.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2)
    context.globalAlpha = 1
  }
  // A lane as a 48-point polyline from s0 to s1, displaced along n̂ by sin(π·s)·amplitude.
  const LANE_SAMPLES = 48
  function laneSamples(route, which, s0, s1, amplitude = 0) {
    const P = which === 'out' ? route.out : route.ret
    const points = new Float64Array(LANE_SAMPLES * 2)
    for (let index = 0; index < LANE_SAMPLES; index++) {
      const s = s0 + ((s1 - s0) * index) / (LANE_SAMPLES - 1)
      const point = quadratic(P, s)
      const offset = displacement(amplitude, s)
      points[index * 2] = point.x + route.n.x * offset
      points[index * 2 + 1] = point.y + route.n.y * offset
    }
    return points
  }
  function strokeLane(context, points, style, width, alpha = 1) {
    context.globalAlpha = alpha
    context.strokeStyle = style
    context.lineWidth = width
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()
    context.moveTo(points[0], points[1])
    for (let index = 2; index < points.length; index += 2) context.lineTo(points[index], points[index + 1])
    context.stroke()
    context.globalAlpha = 1
  }
  // Lane styles at rest (s02): slate, out 2.5 px @ 85%, return 2 px @ 60%.
  const LANE_STYLE = { out: { width: 2.5, alpha: 0.85 }, ret: { width: 2, alpha: 0.6 } }

  // The packet: 8 ghosts at t − 0.012·k, then the head as a capsule pos(t − 0.0021) → pos(t).
  const PACKET_RADIUS = 7
  function drawPacket(context, t) {
    for (let k = 8; k >= 1; k--) {
      const ghostTime = t - 0.012 * k
      const scale = packetScale(ghostTime)
      if (scale <= 0) continue
      const pos = packetPos(ghostTime)
      fillDisc(context, packetColor(ghostTime), pos.x, pos.y, PACKET_RADIUS * (1 - k / 10) * scale, 0.5 * (1 - k / 9))
    }
    const scale = packetScale(t)
    if (scale <= 0) return
    const head = packetPos(t)
    const tail = packetPos(t - 0.0021)
    const color = packetColor(t)
    const radius = PACKET_RADIUS * scale
    if (Math.hypot(head.x - tail.x, head.y - tail.y) > 0.25) {
      context.globalAlpha = 1
      strokeCapsules(context, color, radius * 2, [tail.x, tail.y, head.x, head.y], 1)
    }
    fillDisc(context, color, head.x, head.y, radius)
  }
  // Kigali: halo sprite at 3·r (35 %) under a violet disc of radius r.
  function drawKigali(context, sprite, radius) {
    if (radius <= 0) return
    drawSprite(context, sprite, K.x, K.y, radius * 3, 0.35)
    fillDisc(context, COLOR.violet, K.x, K.y, radius)
  }
  // Cape Town node: a slate ring r 9, 2.5 px stroke (scaled as a whole by `scale`).
  function drawCapeTownNode(context, x, y, scale) {
    if (scale <= 0) return
    strokeRing(context, COLOR.slate, x, y, 9 * scale, 2.5 * scale, 1)
  }

  // ------------------------------------------------------------------------------------------
  // mask_rise: translateY from depth → 0 (reveal) / 0 → depth (exit) inside a clip whose bottom
  // edge is the mask edge.
  // ------------------------------------------------------------------------------------------
  const rise = (t, t0, duration, depth) => tween(t, t0, t0 + duration, depth, 0, EASE.reveal)
  const sink = (t, t0, duration, depth) => tween(t, t0, t0 + duration, 0, depth, EASE.exit)

  // ------------------------------------------------------------------------------------------
  // odometer: one component, three truths. Cells at a natural pitch of 0.6 em; each cell is a
  // vertical strip of glyphs (line-height 1 em) inside a clip window exactly 1.0 em tall whose
  // top is baseline − 0.80 em; it rolls by translateY. Offsets below are in em.
  // ------------------------------------------------------------------------------------------
  const ODOMETER = {
    x: 131,
    baseline: 544.4,
    em: 200,
    pitch: 120, // 0.6 em — JetBrains Mono advance
    maskEdge: 548.76,
    riseDepth: 170,
  }
  const DIGIT_STRIP = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
  // COUNT mode: continuous strip offsets for hundreds / tens / ones of value v.
  function countOffsets(v) {
    const ones = ((v % 10) + 10) % 10
    const tens = (Math.floor(v / 10) % 10) + clamp((v % 10) - 9, 0, 1)
    const hundreds = Math.floor(v / 100) + clamp((v % 100) - 99, 0, 1)
    return [hundreds, tens, ones]
  }
  // SLOT mode: [from, 3 seeded digits (api.hash(cell, k)), to]; offset 0 → −(n−1) em with outCubic.
  const slotStrip = (cell, from, to) => [from, ...[1, 2, 3].map((k) => String(Math.floor(SC.hash(cell, k) * 10))), to]
  const slotOffset = (t, start, lock, length = 5) => (length - 1) * ease.outCubic(progress(t, start, lock))

  // ------------------------------------------------------------------------------------------
  // HUD (SVG, so every string sits on its exact baseline). Both scenes build it with this one
  // function; s03 passes 5 slot strips and the second kicker line.
  // ------------------------------------------------------------------------------------------
  const MONO = "'JetBrains Mono', monospace"
  const INTER = "'Inter', sans-serif"
  const HUD = {
    kicker: { x: 131, baseline: 372, size: 34, window: [336, 382], depth: 44 },
    unit: { x: 703, baseline: 544.4, size: 72 },
    perRequest: { x: 131, baseline: 612, size: 40, edge: 620, depth: 48 },
    peaks: { x: 131, baseline: 668, size: 36, edge: 676, depth: 44 },
  }
  const KICKER_FAR = 'Cape Town · nearest hyperscaler region'
  const KICKER_LOCAL = 'Strettch Cloud · Kigali-1'

  function buildHud(root, { id, strips, dimFirst = [], localKicker = false }) {
    const s = SC.svg
    const hud = s('svg', { width: 1920, height: 1080, viewBox: '0 0 1920 1080' }, root)
    hud.style.cssText = 'position:absolute;left:0;top:0;overflow:hidden'
    hud.setAttribute('text-rendering', 'geometricPrecision')
    const defs = s('defs', {}, hud)
    const clip = (name, x, y, width, height) => {
      const clipPath = s('clipPath', { id: `${id}-${name}`, clipPathUnits: 'userSpaceOnUse' }, defs)
      return { url: `url(#${id}-${name})`, rect: s('rect', { x, y, width, height }, clipPath) }
    }
    const text = (parent, content, attrs) => {
      const node = s('text', attrs, parent)
      node.textContent = content
      return node
    }
    const { kicker, unit, perRequest, peaks } = HUD
    const O = ODOMETER

    // Kicker window (y 336–382). Line A = far kicker (typed on in s02), line B = local kicker.
    const kickerClip = clip('kicker', 96, kicker.window[0], 1728, kicker.window[1] - kicker.window[0])
    const kickerWindow = s('g', { 'clip-path': kickerClip.url }, hud)
    const kickerFont = { 'font-family': MONO, 'font-size': kicker.size, 'font-weight': 500 }
    const kickerA = s('g', {}, kickerWindow)
    const kickerAText = text(kickerA, KICKER_FAR, { x: kicker.x, y: kicker.baseline, fill: COLOR.slate, ...kickerFont })
    let kickerB = null
    if (localKicker) {
      kickerB = s('g', {}, kickerWindow)
      text(kickerB, KICKER_LOCAL, { x: kicker.x, y: kicker.baseline, fill: COLOR.violetLight, ...kickerFont })
    }

    // Odometer + unit, both inside the rise mask whose bottom edge is screen y 548.76.
    const odometerClip = clip('odometer', 0, 0, 1920, O.maskEdge)
    const cellClip = clip('cell', O.x - 40, O.baseline - 0.8 * O.em, O.pitch + 80, O.em) // 1.0 em window
    const edgeClip = clip('edge', -4000, 0, 8000, 1080) // optional right edge for the last cell
    const odometerMask = s('g', { 'clip-path': odometerClip.url }, hud)
    const numberRise = s('g', {}, odometerMask)
    const numberGroup = s('g', { 'font-family': MONO, 'font-size': O.em, fill: COLOR.paper }, numberRise)
    numberGroup.style.fontWeight = '300'
    const cells = strips.map((strip, index) => {
      const holder = index === strips.length - 1 && strips.length > 4 ? s('g', { 'clip-path': edgeClip.url }, numberGroup) : numberGroup
      const cell = s('g', { transform: `translate(${O.pitch * index} 0)`, 'clip-path': cellClip.url }, holder)
      const roll = s('g', {}, cell)
      const glyphs = strip.map((glyph, k) => {
        const node = text(roll, glyph, { x: O.x, y: O.baseline + k * O.em })
        if (dimFirst[index] && k === 0) node.setAttribute('fill-opacity', '0.3')
        return node
      })
      return { cell, roll, glyphs }
    })
    const unitRise = s('g', {}, odometerMask)
    const unitText = text(unitRise, 'ms', { x: unit.x, y: unit.baseline, fill: COLOR.slate, 'font-family': MONO, 'font-size': unit.size, 'font-weight': 500 })

    // "per request" (mask edge 620) and "peaks at 200 ms" (mask edge 676).
    const perClip = clip('per', 96, perRequest.edge - 64, 1728, 64)
    const perRise = s('g', {}, s('g', { 'clip-path': perClip.url }, hud))
    text(perRise, 'per request', {
      x: perRequest.x, y: perRequest.baseline, fill: COLOR.paper, 'fill-opacity': 0.8,
      'font-family': INTER, 'font-size': perRequest.size, 'font-weight': 500,
    })
    const peaksClip = clip('peaks', 96, peaks.edge - 56, 1728, 56)
    const peaksRise = s('g', {}, s('g', { 'clip-path': peaksClip.url }, hud))
    text(peaksRise, 'peaks at 200 ms', {
      x: peaks.x, y: peaks.baseline, fill: COLOR.slate,
      'font-family': MONO, 'font-size': peaks.size, 'font-weight': 600,
    })

    return { svg: hud, kickerA, kickerAText, kickerB, numberRise, numberGroup, cells, edgeRect: edgeClip.rect, unitRise, unitText, perRise, peaksRise }
  }
  // Group transform for the number: scale (sx, sy) about (x 131, baseline 544.4).
  function numberTransform(sx, sy) {
    const O = ODOMETER
    const r = (value) => SC.round(value, 4)
    return `translate(${O.x} ${O.baseline}) scale(${r(sx)} ${r(sy)}) translate(${-O.x} ${-O.baseline})`
  }
  const translateY = (y) => `translate(0 ${SC.round(y, 3)})`

  return {
    COLOR, EASE, TAU, K, C, KIGALI, CAPE_TOWN, PX_PER_DEGREE, LANE_OFFSET, REST, LANE_STYLE, ODOMETER, HUD, DIGIT_STRIP,
    KICKER_FAR, KICKER_LOCAL, PACKET_RADIUS,
    rgba, mix, smoothstep,
    projectToScreen, relX, relY, lanes, quadratic, routeAmplitude, displacement,
    packetS, laneSide, packetPos, packetScale, packetColor, snapE, zoomZ,
    dotField, rwandaFineDots, haloSprite,
    createMapCanvas, resetContext, fillCapsules, paintDots, fillDisc, strokeRing, strokeCapsules, drawSprite,
    laneSamples, strokeLane, drawPacket, drawKigali, drawCapeTownNode,
    rise, sink, countOffsets, slotStrip, slotOffset,
    buildHud, numberTransform, translateY,
  }
})()
