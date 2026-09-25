// s04-in-country · 8.500–10.000 · z 4 — SOVEREIGNTY.
//
// Rwanda becomes a container. On the 8.50 downbeat the fine dots of s03 are replaced by a solid,
// smoothed silhouette on the same projection, and a crash push brings it to container framing.
// "Data stays in-country." bursts out of the centre, the outer glyphs slam into the border and
// rebound, the line settles and holds, then the camera flies into the violet fill.
//
// Everything is a pure function of global t. The glyph physics (burst spring + wall + neighbour
// contacts) is simulated ONCE in build() with a fixed step into a lookup table; render() only
// interpolates that table and evaluates closed-form squash / border-dent responses to the
// impacts that simulation recorded. Fast camera moves and the glyph burst also draw analytic
// streaks (design_system motion_blur) so the 8-subframe accumulation never strobes.
(() => {
  const ID = 's04-in-country'
  const START = 8.5
  const END = 10.0

  // --- Storyboard numbers -------------------------------------------------------------------
  const KIGALI = [30.0619, -1.9441] // projection anchor (lon, lat)
  const PX_PER_DEG = 12 // at Z = 1
  const K_ENTRY = [1560, 530] // s03's Kigali screen position (Z 21.0 at 8.500)
  const Z_ENTRY = 21
  const K_C = [1061.27, 544.75] // container framing (authored space)
  const Z_C = 44
  const PUSH = [8.5, 8.58]

  const FONT = '800 130px Inter'
  const FONT_SIZE = 130
  const LINES = [
    { text: 'Data stays', baseline: 505 },
    { text: 'in-country.', baseline: 640 },
  ]
  const LINE_CENTRE_X = 1035
  const X_HEIGHT = 0.547 // Inter, em (design_system metrics)
  const BURST_ORIGIN = [1035, 548]
  const BURST_T0 = 8.56
  const BURST_DUR = 0.5
  const BURST = { stiffness: 1600, damping: 24, mass: 1, duration: BURST_DUR } // ω 40, ζ 0.3
  const SCALE_FROM = 0.35
  const RESTITUTION_WALL = 0.4
  const RESTITUTION_GLYPH = 0.3

  const BREATHS = [[8.64, 0.12], [9.0, 0.2], [9.5, 0.2]] // [start, duration] of the 1 → 1.012 → 1 bump
  const BREATH_AMP = 0.012
  const BREATH_PIVOT = [960, 540]

  const FLY = [9.875, 10.0]
  const FLY_PIVOT = [710, 850]
  const FLY_ZOOM = 18

  // --- Craft layer on top of the storyboard (physics-driven, closed-form after build) ---------
  const SIM_DT = 1 / 2400
  const SIM_ITERATIONS = 6
  const SDF_CELL = 2 // px
  const SETTLE_BLEND = [8.94, 9.06] // sim residual → exactly home, so the hold is dead still
  const HARD_HIT = 1000 // px/s: impacts at least this fast squash the glyph and dent the wall
  const SQUASH = { stiffness: 900, damping: 21, mass: 1, duration: 0.3 } // design_system squashBack
  const SQUASH_PER_SPEED = 0.13 / 5000
  const SQUASH_MAX = 0.15
  const DENT_SIGMA = 64 // px, Gaussian footprint of the border's local give
  const DENT_PER_SPEED = 11 / 5000 // px of outward give per px/s of impact
  const DENT_MAX = 12
  const DENT_OMEGA = 2 * Math.PI * 6 // membrane rings at 6 Hz …
  const DENT_ZETA = 0.35 // … and is dead in ~0.4 s
  const DENT_LIFE = 0.45
  const STROKE_OPACITY = 0.8
  const SMEAR_WINDOW = 0.0021 // s, trailing streak window (design_system motion_blur)
  const SMEAR_STEP = 6 // px between streak copies
  const SMEAR_MAX_COPIES = 12
  const GLYPH_STREAK_COPIES = 6

  // --- Small helpers ------------------------------------------------------------------------
  const r2 = (v) => Math.round(v * 100) / 100
  const r4 = (v) => Math.round(v * 10000) / 10000
  const smoothstep = (x) => x * x * (3 - 2 * x)

  // Container-framing projection (Z 44): lon/lat → authored px.
  const project = ([lon, lat]) => [
    K_C[0] + (lon - KIGALI[0]) * PX_PER_DEG * Z_C,
    K_C[1] - (lat - KIGALI[1]) * PX_PER_DEG * Z_C,
  ]

  // Centripetal Catmull–Rom (α = 0.5) through a closed ring → cubic Bézier segments.
  function catmullRomBeziers(points, alpha = 0.5) {
    const n = points.length
    const segments = []
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n]
      const p1 = points[i]
      const p2 = points[(i + 1) % n]
      const p3 = points[(i + 2) % n]
      const d1 = Math.max(1e-6, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) ** alpha)
      const d2 = Math.max(1e-6, Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) ** alpha)
      const d3 = Math.max(1e-6, Math.hypot(p3[0] - p2[0], p3[1] - p2[1]) ** alpha)
      const c1 = [0, 1].map((k) => (d1 * d1 * p2[k] - d2 * d2 * p0[k] + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1[k]) / (3 * d1 * (d1 + d2)))
      const c2 = [0, 1].map((k) => (d3 * d3 * p1[k] - d2 * d2 * p3[k] + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2[k]) / (3 * d3 * (d3 + d2)))
      segments.push([p1, c1, c2, p2])
    }
    return segments
  }
  const bezierPoint = ([p0, c1, c2, p3], t) => {
    const u = 1 - t
    return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * p3[k])
  }
  const segmentsToPath = (segments) => {
    let d = `M${r2(segments[0][0][0])},${r2(segments[0][0][1])}`
    for (const [, c1, c2, p] of segments) d += `C${r2(c1[0])},${r2(c1[1])} ${r2(c2[0])},${r2(c2[1])} ${r2(p[0])},${r2(p[1])}`
    return `${d}Z`
  }

  // Light Taubin (λ|μ) smoothing on a closed ring: removes the 0.01° quantisation stair-steps of
  // the 50 m outline at 528 px/deg without shrinking the shape.
  function taubin(points, iterations, lambda = 0.5, mu = -0.53) {
    let ring = points.map((p) => p.slice())
    const n = ring.length
    const pass = (factor) => {
      ring = ring.map((p, i) => {
        const a = ring[(i - 1 + n) % n]
        const b = ring[(i + 1) % n]
        return [p[0] + factor * ((a[0] + b[0]) / 2 - p[0]), p[1] + factor * ((a[1] + b[1]) / 2 - p[1])]
      })
    }
    for (let i = 0; i < iterations; i++) {
      pass(lambda)
      pass(mu)
    }
    return ring
  }

  // Exact 1-D squared Euclidean distance transform (Felzenszwalb & Huttenlocher).
  function distanceTransform1d(f, n, d, v, z) {
    let k = 0
    v[0] = 0
    z[0] = -1e20
    z[1] = 1e20
    for (let q = 1; q < n; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
      while (s <= z[k]) {
        k--
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
      }
      k++
      v[k] = q
      z[k] = s
      z[k + 1] = 1e20
    }
    k = 0
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
    }
  }
  // In place: grid holds 0 on target cells and 1e20 elsewhere → squared distance to the nearest target.
  function distanceTransform2d(grid, width, height) {
    const n = Math.max(width, height)
    const f = new Float64Array(n)
    const d = new Float64Array(n)
    const v = new Int32Array(n)
    const z = new Float64Array(n + 1)
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) f[y] = grid[y * width + x]
      distanceTransform1d(f, height, d, v, z)
      for (let y = 0; y < height; y++) grid[y * width + x] = d[y]
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) f[x] = grid[y * width + x]
      distanceTransform1d(f, width, d, v, z)
      for (let x = 0; x < width; x++) grid[y * width + x] = d[x]
    }
  }
  // Signed distance (px, positive inside) to the outline of an SVG path, on a `cell`-px grid
  // over `bounds`, with bilinear sampling and an inward unit normal from its gradient.
  function signedDistanceField(pathData, [x0, y0, x1, y1], cell) {
    const width = Math.ceil((x1 - x0) / cell)
    const height = Math.ceil((y1 - y0) / cell)
    const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    context.canvas.width = width
    context.canvas.height = height
    context.setTransform(1 / cell, 0, 0, 1 / cell, -x0 / cell, -y0 / cell)
    context.fill(new Path2D(pathData))
    const alpha = context.getImageData(0, 0, width, height).data
    const toOutside = new Float64Array(width * height)
    const toInside = new Float64Array(width * height)
    for (let i = 0; i < width * height; i++) {
      const inside = alpha[i * 4 + 3] >= 128
      toOutside[i] = inside ? 1e20 : 0
      toInside[i] = inside ? 0 : 1e20
    }
    distanceTransform2d(toOutside, width, height)
    distanceTransform2d(toInside, width, height)
    const field = new Float32Array(width * height)
    for (let i = 0; i < width * height; i++) {
      field[i] = toInside[i] === 0 ? (Math.sqrt(toOutside[i]) - 0.5) * cell : -(Math.sqrt(toInside[i]) - 0.5) * cell
    }
    const sample = (x, y) => {
      const gx = (x - x0) / cell - 0.5
      const gy = (y - y0) / cell - 0.5
      if (gx < 0 || gy < 0 || gx >= width - 1 || gy >= height - 1) return -1000
      const ix = Math.floor(gx)
      const iy = Math.floor(gy)
      const fx = gx - ix
      const fy = gy - iy
      const i = iy * width + ix
      const top = field[i] + (field[i + 1] - field[i]) * fx
      const bottom = field[i + width] + (field[i + width + 1] - field[i + width]) * fx
      return top + (bottom - top) * fy
    }
    const normal = (x, y) => {
      const gx = sample(x + cell, y) - sample(x - cell, y)
      const gy = sample(x, y + cell) - sample(x, y - cell)
      const length = Math.hypot(gx, gy) || 1
      return [gx / length, gy / length]
    }
    return { sample, normal }
  }

  // Convex hull (monotone chain) of [x, y] points.
  function convexHull(points) {
    const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    const lower = []
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
      lower.push(p)
    }
    const upper = []
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i]
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
      upper.push(p)
    }
    upper.pop()
    lower.pop()
    return lower.concat(upper)
  }

  // Rasterise one glyph and return its ink hull relative to the pen origin (x right, y down).
  function glyphInkHull(context, character) {
    const pad = 40
    context.font = FONT
    const width = Math.ceil(context.measureText(character).width) + pad * 2
    const height = FONT_SIZE * 2
    const baseline = Math.round(FONT_SIZE * 1.4)
    context.canvas.width = width
    context.canvas.height = height
    context.font = FONT
    context.fillStyle = '#000'
    context.clearRect(0, 0, width, height)
    context.fillText(character, pad, baseline)
    const { data } = context.getImageData(0, 0, width, height)
    const edge = []
    for (let y = 0; y < height; y++) {
      let first = -1
      let last = -1
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] >= 128) {
          if (first < 0) first = x
          last = x
        }
      }
      if (first >= 0) {
        edge.push([first - pad, y - baseline], [first - pad, y + 1 - baseline])
        edge.push([last + 1 - pad, y - baseline], [last + 1 - pad, y + 1 - baseline])
      }
    }
    return convexHull(edge)
  }

  // The one camera: [scale, tx, ty] such that screen = scale · authored + (tx, ty).
  function cameraAt(t, api) {
    if (t < PUSH[1]) {
      // 8.50–8.58 crash push: K_s (1560, 530) → K_c and Z 21 → 44 in log space, both with reveal.
      const p = api.ease.snappy(api.progress(t, PUSH[0], PUSH[1]))
      const zoom = Math.exp(api.lerp(Math.log(Z_ENTRY), Math.log(Z_C), p)) / Z_C
      return [zoom, api.lerp(K_ENTRY[0], K_C[0], p) - zoom * K_C[0], api.lerp(K_ENTRY[1], K_C[1], p) - zoom * K_C[1]]
    }
    if (t >= FLY[0]) {
      // 9.875–10.00 fly-through about F: Z_mult = 18^inCubic(p).
      const zoom = Math.pow(FLY_ZOOM, api.ease.inCubic(api.progress(t, FLY[0], FLY[1])))
      return [zoom, FLY_PIVOT[0] * (1 - zoom), FLY_PIVOT[1] * (1 - zoom)]
    }
    return [1, 0, 0]
  }

  function build(root, api) {
    const { svg, tokens } = api

    // ---- Rwanda: projected, de-stepped, Catmull–Rom smoothed -------------------------------
    const rwanda = window.SC_GEO.africa.find((country) => country.name === 'Rwanda')
    const rawRing = rwanda.polygons[0][0].slice(0, -1).map(project) // 82 unique points (83 with closure)
    const ring = taubin(rawRing, 5)
    const segments = catmullRomBeziers(ring)
    const pathData = segmentsToPath(segments)
    // A 3×-denser control ring on the same curve, with outward normals, for the local dents.
    const dentRing = []
    for (const segment of segments) for (let i = 0; i < 3; i++) dentRing.push(bezierPoint(segment, i / 3))
    const dentNormals = dentRing.map((p, i) => {
      const a = dentRing[(i - 1 + dentRing.length) % dentRing.length]
      const b = dentRing[(i + 1) % dentRing.length]
      const tx = b[0] - a[0]
      const ty = b[1] - a[1]
      const length = Math.hypot(tx, ty) || 1
      return [ty / length, -tx / length]
    })
    const rightmost = dentRing.reduce((best, p, i) => (p[0] > dentRing[best][0] ? i : best), 0)
    if (dentNormals[rightmost][0] < 0) for (const normal of dentNormals) { normal[0] *= -1; normal[1] *= -1 }

    // ---- Glyph layout: canvas cumulative advances, centred on x 1035 ----------------------
    const measure = document.createElement('canvas').getContext('2d')
    measure.font = FONT
    const raster = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    const glyphs = []
    LINES.forEach((line) => {
      const lineWidth = measure.measureText(line.text).width
      const x0 = LINE_CENTRE_X - lineWidth / 2
      ;[...line.text].forEach((character, index) => {
        if (character === ' ') return
        const penX = x0 + measure.measureText(line.text.slice(0, index)).width
        const spaceBefore = line.text[index - 1] === ' ' ? measure.measureText(' ').width : 0
        const hull = glyphInkHull(raster, character).map(([x, y]) => [penX + x, line.baseline + y])
        const xs = hull.map((p) => p[0])
        const ys = hull.map((p) => p[1])
        const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
        // The glyph "centre" (burst target and scale pivot): its ink centre in x, and the line's
        // x-height middle in y for every glyph of the line, so the burst keeps each baseline
        // straight instead of every letter drifting by its own ink height.
        const centre = [(box[0] + box[2]) / 2, line.baseline - (X_HEIGHT * FONT_SIZE) / 2]
        glyphs.push({
          character, penX, baseline: line.baseline, centre, box, spaceBefore,
          hullRel: hull.map(([x, y]) => [x - centre[0], y - centre[1]]),
          hit: null,
        })
      })
    })

    // ---- The wall: a signed distance field of exactly the drawn (smoothed) border ------------
    const field = signedDistanceField(pathData, [380, 30, 1540, 1050], SDF_CELL)

    // ---- Physics, simulated once into a table ----------------------------------------------
    // Each glyph is a rigid ink hull on an isotropic burst spring to its home. Unconstrained,
    // that is exactly the analytic burst (a straight line from B). Glyph boxes collide with each
    // other (restitution 0.3; pairs arm once they have first separated, since every glyph is born
    // at B), and hulls collide with the border SDF (restitution 0.4).
    const burstEase = api.ease.spring(BURST)
    const scaleAt = (t) => api.tween(t, BURST_T0, BURST_T0 + BURST_DUR, SCALE_FROM, 1, burstEase)
    const omega = Math.sqrt(BURST.stiffness / BURST.mass)
    const zeta = BURST.damping / (2 * Math.sqrt(BURST.stiffness * BURST.mass))
    const decay = zeta * omega
    const omegaD = omega * Math.sqrt(1 - zeta * zeta)
    const envelope = Math.exp(-decay * SIM_DT)
    const cosStep = Math.cos(omegaD * SIM_DT)
    const sinStep = Math.sin(omegaD * SIM_DT)
    const springStep = (x0, v0) => [
      envelope * (x0 * cosStep + ((v0 + decay * x0) / omegaD) * sinStep),
      envelope * (v0 * cosStep - ((decay * v0 + omega * omega * x0) / omegaD) * sinStep),
    ]
    const steps = Math.round(BURST_DUR / SIM_DT)
    const count = glyphs.length
    const pos = glyphs.map(() => BURST_ORIGIN.slice())
    const vel = glyphs.map(() => [0, 0])
    const tableX = glyphs.map(() => new Float32Array(steps + 1))
    const tableY = glyphs.map(() => new Float32Array(steps + 1))
    for (const glyph of glyphs) {
      glyph.extent = [glyph.centre[0] - glyph.box[0], glyph.centre[1] - glyph.box[1], glyph.box[2] - glyph.centre[0], glyph.box[3] - glyph.centre[1]]
      glyph.radius = Math.max(...glyph.hullRel.map(([x, y]) => Math.hypot(x, y)))
      // Hull edges subdivided to ≤ 4 px so no wall feature slips between two hull vertices.
      glyph.hullDense = []
      glyph.hullRel.forEach((a, index) => {
        const b = glyph.hullRel[(index + 1) % glyph.hullRel.length]
        const pieces = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4))
        for (let piece = 0; piece < pieces; piece++) glyph.hullDense.push([a[0] + ((b[0] - a[0]) * piece) / pieces, a[1] + ((b[1] - a[1]) * piece) / pieces])
      })
    }
    const boxOf = (i, k) => {
      const [left, top, right, bottom] = glyphs[i].extent
      return [pos[i][0] - left * k, pos[i][1] - top * k, pos[i][0] + right * k, pos[i][1] + bottom * k]
    }
    const pairs = []
    for (let a = 0; a < count; a++) {
      for (let b = a + 1; b < count; b++) {
        const A = glyphs[a].box
        const B = glyphs[b].box
        const overlapAtHome = Math.min(A[2], B[2]) > Math.max(A[0], B[0]) && Math.min(A[3], B[3]) > Math.max(A[1], B[1])
        // The word space is a body too: across it the pair keeps at least one space advance, so
        // each word jostles as a unit and "Data stays" never closes up into one word.
        const pad = b === a + 1 && glyphs[b].spaceBefore > 0 && glyphs[b].baseline === glyphs[a].baseline ? glyphs[b].spaceBefore : 0
        if (!overlapAtHome) pairs.push({ a, b, pad, armed: false })
      }
    }
    const inContact = glyphs.map(() => false)
    const record = (step) => {
      for (let i = 0; i < count; i++) {
        tableX[i][step] = pos[i][0]
        tableY[i][step] = pos[i][1]
      }
    }
    record(0)
    for (let step = 1; step <= steps; step++) {
      const time = BURST_T0 + step * SIM_DT
      for (let i = 0; i < count; i++) {
        for (let axis = 0; axis < 2; axis++) {
          const [x, v] = springStep(pos[i][axis] - glyphs[i].centre[axis], vel[i][axis])
          pos[i][axis] = glyphs[i].centre[axis] + x
          vel[i][axis] = v
        }
      }
      const k = scaleAt(time)
      for (let iteration = 0; iteration < SIM_ITERATIONS; iteration++) {
        const last = iteration === SIM_ITERATIONS - 1
        for (const pair of pairs) {
          const A = boxOf(pair.a, k)
          const B = boxOf(pair.b, k)
          A[2] += pair.pad * k
          const overlapX = Math.min(A[2], B[2]) - Math.max(A[0], B[0])
          const overlapY = Math.min(A[3], B[3]) - Math.max(A[1], B[1])
          const overlapping = overlapX > 0 && overlapY > 0
          if (!pair.armed) {
            if (!overlapping) pair.armed = true
            continue
          }
          if (!overlapping) continue
          const axis = overlapX < overlapY ? 0 : 1
          const depth = axis === 0 ? overlapX : overlapY
          const direction = pos[pair.b][axis] >= pos[pair.a][axis] ? 1 : -1
          pos[pair.a][axis] -= (direction * depth) / 2
          pos[pair.b][axis] += (direction * depth) / 2
          const approach = (vel[pair.a][axis] - vel[pair.b][axis]) * direction
          if (approach > 0) {
            const impulse = ((1 + RESTITUTION_GLYPH) * approach) / 2
            vel[pair.a][axis] -= impulse * direction
            vel[pair.b][axis] += impulse * direction
          }
        }
        for (let i = 0; i < count; i++) {
          const glyph = glyphs[i]
          if (field.sample(pos[i][0], pos[i][1]) > glyph.radius * k + 4) {
            if (last) inContact[i] = false
            continue
          }
          let deepest = 0
          let contactRel = null
          let contactPoint = null
          for (const rel of glyph.hullDense) {
            const qx = pos[i][0] + rel[0] * k
            const qy = pos[i][1] + rel[1] * k
            const distance = field.sample(qx, qy)
            if (distance < deepest) {
              deepest = distance
              contactRel = rel
              contactPoint = [qx, qy]
            }
          }
          if (!contactRel) {
            if (last) inContact[i] = false
            continue
          }
          const inward = field.normal(contactPoint[0], contactPoint[1])
          // The lines only ever meet the border's flanks, so it acts as a side wall: it stops and
          // returns the horizontal motion only. Each line keeps expanding and settling vertically
          // as one piece (no letter knocked off its baseline), and a sloped flank cannot shove
          // the D down into the line below. Top/bottom contact (never reached) falls back to the
          // full normal response.
          const side = Math.abs(inward[0]) >= 0.5
          const axis = side ? [Math.sign(inward[0]), 0] : inward
          const push = side ? -deepest / Math.abs(inward[0]) : -deepest
          pos[i][0] += axis[0] * push
          pos[i][1] += axis[1] * push
          const normalSpeed = vel[i][0] * axis[0] + vel[i][1] * axis[1]
          if (normalSpeed < 0) {
            const speed = -normalSpeed
            if (!inContact[i] && !glyph.hit && speed >= HARD_HIT) {
              glyph.hit = {
                time, speed, hullPoint: contactRel,
                wallPoint: [contactPoint[0] + axis[0] * push, contactPoint[1] + axis[1] * push],
                axis: side ? 0 : 90, // squash across the wall: horizontal for a flank
              }
            }
            vel[i][0] -= (1 + RESTITUTION_WALL) * normalSpeed * axis[0]
            vel[i][1] -= (1 + RESTITUTION_WALL) * normalSpeed * axis[1]
          }
          inContact[i] = true
        }
      }
      record(step)
    }

    // ---- Border dents: each hard hit pushes the wall out locally (Gaussian footprint), and the
    // membrane rings back as a damped sine. Weights are precomputed; render sums closed forms.
    const dents = glyphs.filter((glyph) => glyph.hit).map((glyph) => {
      const { time, speed, wallPoint } = glyph.hit
      const weights = []
      dentRing.forEach((p, index) => {
        const d2 = (p[0] - wallPoint[0]) ** 2 + (p[1] - wallPoint[1]) ** 2
        const weight = Math.exp(-d2 / (2 * DENT_SIGMA * DENT_SIGMA))
        if (weight > 0.004) weights.push([index, weight])
      })
      return { time, amplitude: Math.min(DENT_MAX, speed * DENT_PER_SPEED), weights }
    })
    const dentOmegaD = DENT_OMEGA * Math.sqrt(1 - DENT_ZETA * DENT_ZETA)
    const dentPeakTime = Math.atan(dentOmegaD / (DENT_ZETA * DENT_OMEGA)) / dentOmegaD
    const dentPeak = Math.exp(-DENT_ZETA * DENT_OMEGA * dentPeakTime) * Math.sin(dentOmegaD * dentPeakTime)
    const dentResponse = (tau) => (tau <= 0 || tau >= DENT_LIFE ? 0 : Math.exp(-DENT_ZETA * DENT_OMEGA * tau) * Math.sin(dentOmegaD * tau) / dentPeak)
    const dentWindow = dents.length
      ? [Math.min(...dents.map((d) => d.time)), Math.max(...dents.map((d) => d.time)) + DENT_LIFE]
      : [Infinity, -Infinity]

    // ---- DOM ------------------------------------------------------------------------------
    // The world (outline, type, wall line) lives in <defs> and is drawn through <use> copies that
    // each carry a camera transform: normally one copy, several across the trailing streak window
    // while the camera is moving violently (see render).
    const stage = svg('svg', { width: api.WIDTH, height: api.HEIGHT, viewBox: `0 0 ${api.WIDTH} ${api.HEIGHT}`, overflow: 'visible' }, root)
    stage.style.position = 'absolute'
    stage.style.left = '0'
    stage.style.top = '0'
    const defs = svg('defs', {}, stage)
    const clip = svg('clipPath', { id: `${ID}-clip`, clipPathUnits: 'userSpaceOnUse' }, defs)
    const clipShape = svg('path', { d: pathData }, clip)
    const outline = svg('path', { id: `${ID}-outline`, d: pathData, 'vector-effect': 'non-scaling-stroke' }, defs)
    const textGroup = svg('g', { id: `${ID}-type`, 'clip-path': `url(#${ID}-clip)` }, defs)
    for (const glyph of glyphs) {
      // Copy 0 is the glyph; 1… are its streak copies while it moves fast (see render).
      glyph.nodes = Array.from({ length: GLYPH_STREAK_COPIES }, () => {
        const node = svg('text', {
          x: r2(glyph.penX), y: glyph.baseline, fill: tokens.ink,
          'font-family': 'Inter', 'font-weight': 800, 'font-size': FONT_SIZE,
        }, textGroup)
        node.textContent = glyph.character
        return node
      })
    }
    const layer = (attrs, href) => {
      const group = svg('g', attrs, stage)
      return Array.from({ length: SMEAR_MAX_COPIES }, () => svg('use', { href: `#${href}` }, group))
    }
    const fillCopies = layer({ fill: tokens.violet }, `${ID}-outline`)
    const typeCopies = layer({}, `${ID}-type`)
    // The wall line sits above the type, so a glyph slamming into it meets the line itself.
    const strokeCopies = layer({
      fill: 'none', stroke: tokens.violetLight, 'stroke-width': 2, 'stroke-linejoin': 'round',
    }, `${ID}-outline`)

    // Streak probes: the silhouette's bounding-box corners (the fastest points on screen).
    const xs = dentRing.map((p) => p[0])
    const ys = dentRing.map((p) => p[1])
    const smearProbes = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.min(...ys)], [Math.min(...xs), Math.max(...ys)], [Math.max(...xs), Math.max(...ys)]]

    return {
      outline, clipShape, textGroup, fillCopies, typeCopies, strokeCopies, glyphs, tableX, tableY, steps, scaleAt,
      pathData, dentRing, dentNormals, dents, dentResponse, dentWindow, smearProbes,
      squashEase: api.ease.spring(SQUASH),
    }
  }

  function render(t, state, api) {
    const { setAttrs, setStyle, progress } = api

    // ---- Camera: crash push (8.50–8.58), then container framing, then the fly-through ------
    // camera(t) → [scale, tx, ty] with screen = scale·world + t. When it moves more than a few px
    // inside the trailing streak window, the world is drawn several times across that window
    // (the design system's analytic streaks) so the 8-subframe accumulation reads as continuous
    // blur instead of stepped copies.
    const now = cameraAt(t, api)
    const before = cameraAt(t - SMEAR_WINDOW, api)
    let travel = 0
    for (const [x, y] of state.smearProbes) {
      travel = Math.max(travel, Math.hypot(now[0] * x + now[1] - (before[0] * x + before[1]), now[0] * y + now[2] - (before[0] * y + before[2])))
    }
    const copies = travel < 1.5 ? 1 : Math.min(SMEAR_MAX_COPIES, 1 + Math.ceil(travel / SMEAR_STEP))
    for (let c = 0; c < SMEAR_MAX_COPIES; c++) {
      const used = c < copies
      let transform = ''
      if (used) {
        const [scale, tx, ty] = c === 0 ? now : cameraAt(t - (SMEAR_WINDOW * c) / (copies - 1), api)
        if (scale !== 1 || tx !== 0 || ty !== 0) transform = `matrix(${r4(scale)},0,0,${r4(scale)},${r4(tx)},${r4(ty)})`
      }
      for (const copy of [state.fillCopies[c], state.typeCopies[c], state.strokeCopies[c]]) {
        setStyle(copy, { display: used ? 'inline' : 'none' })
        if (used) setAttrs(copy, { transform })
      }
      if (!used) continue
      // "Over"-compositing weights 1/(h+1−e) (e = copies from the nearer end, h = middle index)
      // make a pixel crossed by the first m copies land at m/(h+1): the streak is solid in the
      // middle and ramps off at both ends, so the 8 accumulated subframes sum without steps.
      // The thin wall line is shared out 1/K per copy: a faint band, as a real shutter gives.
      const middle = Math.floor((copies - 1) / 2)
      const fromEnd = Math.min(c, copies - 1 - c)
      const weight = copies === 1 ? 1 : 1 / (middle + 1 - Math.min(fromEnd, middle))
      setAttrs(state.fillCopies[c], { opacity: r4(weight) })
      setAttrs(state.typeCopies[c], { opacity: r4(weight) })
      setAttrs(state.strokeCopies[c], { 'stroke-opacity': r4(STROKE_OPACITY / copies) })
    }

    // ---- Border breath: 1 → 1.012 → 1 sine bumps on the hit and on the 9.00 / 9.50 beats ----
    let breath = 1
    for (const [start, duration] of BREATHS) {
      if (t >= start && t <= start + duration) breath += BREATH_AMP * Math.sin(Math.PI * progress(t, start, start + duration))
    }
    const breathTransform = breath === 1 ? '' : `translate(${BREATH_PIVOT[0]},${BREATH_PIVOT[1]}) scale(${r4(breath)}) translate(${-BREATH_PIVOT[0]},${-BREATH_PIVOT[1]})`
    setAttrs(state.outline, { transform: breathTransform })
    setAttrs(state.clipShape, { transform: breathTransform })

    // ---- Border dents (local give where the glyphs hit) --------------------------------------
    let pathData = state.pathData
    if (t > state.dentWindow[0] && t < state.dentWindow[1]) {
      const offsets = new Float64Array(state.dentRing.length)
      for (const dent of state.dents) {
        const response = dent.amplitude * state.dentResponse(t - dent.time)
        if (response === 0) continue
        for (const [index, weight] of dent.weights) offsets[index] += response * weight
      }
      const ring = state.dentRing.map((p, i) => [p[0] + state.dentNormals[i][0] * offsets[i], p[1] + state.dentNormals[i][1] * offsets[i]])
      pathData = segmentsToPath(catmullRomBeziers(ring))
    }
    setAttrs(state.outline, { d: pathData })
    setAttrs(state.clipShape, { d: pathData })

    // ---- Glyphs --------------------------------------------------------------------------
    const visible = t >= BURST_T0
    setStyle(state.textGroup, { display: visible ? 'inline' : 'none' })
    if (!visible) return
    for (let i = 0; i < state.glyphs.length; i++) {
      const glyph = state.glyphs[i]
      const pose = glyphPose(state, i, t, api)
      // Streak copies across the same trailing window when the glyph itself moves fast (the
      // burst peaks near 155 px/frame), weighted like the camera streak.
      const past = t - SMEAR_WINDOW >= BURST_T0 ? glyphPose(state, i, t - SMEAR_WINDOW, api) : pose
      const travel = Math.hypot(pose.x - past.x, pose.y - past.y) + Math.abs(pose.scale - past.scale) * glyph.radius
      const copies = travel < 1.5 ? 1 : Math.min(GLYPH_STREAK_COPIES, 1 + Math.ceil(travel / SMEAR_STEP))
      const middle = Math.floor((copies - 1) / 2)
      for (let c = 0; c < GLYPH_STREAK_COPIES; c++) {
        const node = glyph.nodes[c]
        const time = copies === 1 ? t : t - (SMEAR_WINDOW * c) / (copies - 1)
        const used = c < copies && time >= BURST_T0
        setStyle(node, { display: used ? 'inline' : 'none' })
        if (!used) continue
        const fromEnd = Math.min(c, copies - 1 - c)
        setAttrs(node, {
          transform: glyphTransform(glyph, c === 0 ? pose : glyphPose(state, i, time, api)),
          opacity: copies === 1 ? 1 : r4(1 / (middle + 1 - Math.min(fromEnd, middle))),
        })
      }
    }
  }

  // Pose of glyph i at time t: centre (from the physics table), uniform scale and wall squash.
  function glyphPose(state, i, t, api) {
    const glyph = state.glyphs[i]
    if (t >= BURST_T0 + BURST_DUR) return { x: glyph.centre[0], y: glyph.centre[1], scale: 1, squash: 0 }
    const f = api.clamp((t - BURST_T0) / (BURST_DUR / state.steps), 0, state.steps)
    const j = Math.min(state.steps - 1, Math.floor(f))
    const frac = f - j
    const blend = 1 - smoothstep(api.progress(t, SETTLE_BLEND[0], SETTLE_BLEND[1]))
    const x = glyph.centre[0] + (api.lerp(state.tableX[i][j], state.tableX[i][j + 1], frac) - glyph.centre[0]) * blend
    const y = glyph.centre[1] + (api.lerp(state.tableY[i][j], state.tableY[i][j + 1], frac) - glyph.centre[1]) * blend
    const scale = 1 + (state.scaleAt(t) - 1) * blend
    let squash = 0
    const hit = glyph.hit
    if (hit && t >= hit.time && t < hit.time + SQUASH.duration) {
      // Flatten against the wall about the touching point, then spring back (squashBack).
      squash = Math.min(SQUASH_MAX, hit.speed * SQUASH_PER_SPEED) * (1 - state.squashEase(api.progress(t, hit.time, hit.time + SQUASH.duration))) * blend
    }
    return { x, y, scale, squash }
  }

  function glyphTransform(glyph, { x, y, scale, squash }) {
    if (scale === 1 && squash === 0 && x === glyph.centre[0] && y === glyph.centre[1]) return ''
    let squashTransform = ''
    if (squash !== 0) {
      // Pivot on the touching side, standing on the baseline: the glyph flattens against the
      // wall and grows upward without leaving its line.
      const qx = glyph.hit.hullPoint[0] * scale
      const qy = (glyph.hit.axis === 0 ? glyph.baseline - glyph.centre[1] : glyph.hit.hullPoint[1]) * scale
      const [sx, sy] = glyph.hit.axis === 0 ? [1 - squash, 1 + 0.6 * squash] : [1 + 0.6 * squash, 1 - squash]
      squashTransform = ` translate(${r4(qx)},${r4(qy)}) scale(${r4(sx)},${r4(sy)}) translate(${r4(-qx)},${r4(-qy)})`
    }
    return `translate(${r4(x)},${r4(y)})${squashTransform} scale(${r4(scale)}) translate(${r4(-glyph.centre[0])},${r4(-glyph.centre[1])})`
  }

  SC.scene({ id: ID, start: START, end: END, z: 4, build, render })
})()
