// s04-in-country · 8.495–10.000 · z 4 — SOVEREIGNTY.
//
// Rwanda becomes a container. On the 8.50 downbeat s03's fine dots are replaced by the solid
// country (Natural Earth 1:10m border, lightly de-stepped, crisp 2 px rim) on the same
// projection, while the neighbouring land resolves around it as a dim dot field. A crash push
// brings it to container framing. "Data stays in-country." bursts out of the centre; the outer
// glyphs slam into the border, which gives way (the rim wraps the letters and dents out 25–40 px,
// then springs back and rings out) while the glyphs squash against it and rebound. The line is
// dead still from 8.88 and holds under a slow push that accelerates straight into the dive
// through the violet fill.
//
// Everything is a pure function of global t. The glyph + wall physics is simulated ONCE in
// build() with a fixed step into lookup tables; render() only interpolates those tables and
// wraps the rim around each letter's current ink hull. No clip path: the rim contains the type.
// No analytic streak copies either: the final render's 32-sample motion blur (8.45–8.72,
// 9.82–10.02) is smooth on its own, and extra copies doubled it up.
(() => {
  const ID = 's04-in-country'
  // s03 stops drawing its map at t >= 8.495, so the centred motion-blur shutter of the 8.500
  // frame (8.4958–8.5042) sees only this scene: no double exposure across the cut.
  const START = 8.495
  const END = 10.0

  // --- Projection & camera --------------------------------------------------------------------
  const KIGALI = [30.0619, -1.9441] // projection anchor (lon, lat)
  const PX_PER_DEG = 12 // at Z = 1
  const K_ENTRY = [1560, 530] // s03's Kigali screen position
  const K_C = [1061.27, 544.75] // container framing (authored space)
  const Z_C = 44
  const entryZ = (t) => 20 + (Math.min(t, 8.5) - 7.1) / 1.4 // s03's map creep, 21.0 at 8.500
  // The crash push starts one half-frame after the downbeat, so the 8.500 frame is one clean
  // exposure of the solid country exactly on s03's footprint before it launches.
  const PUSH = [8.5042, 8.59]
  // Read push: 1 → 1.04 about the text block, accelerating (inQuad) so it hands its speed on to
  // the dive. The farthest ink is ~375 px from the pivot → ≤ 0.5 px/frame until the dive.
  const READ_PUSH = { from: 8.9, ref: 9.875, pivot: [1035, 558], log: Math.log(1.04) }
  // Dive: log-scale inCubic about F (inside the country, below the text). It takes over from the
  // push at ~9.84 (the read: still from 8.88, ≤ 0.6 px/frame until 9.84 = 0.96 s); by 9.97 the
  // frame is 100% violet, well before the 9.983 frame's first shutter sample (9.979).
  const DIVE = { from: 9.83, to: 10.0, pivot: [710, 850], log: Math.log(18) }

  // --- Type ----------------------------------------------------------------------------------
  const FONT = '800 130px Inter'
  const FONT_SIZE = 130
  const LINES = [
    { text: 'Data stays', baseline: 505 },
    { text: 'in-country.', baseline: 640 },
  ]
  const LINE_CENTRE_X = 1035
  const X_HEIGHT = 0.547 // Inter, em
  const BURST_ORIGIN = [1035, 548]
  const BURST_T0 = 8.572
  const SCALE_FROM = 0.35
  const LAUNCH = 20 // initial outward speed, px/s per px of the glyph's distance from B
  const SCALE_SPRING = { stiffness: 1600, damping: 40, mass: 1, velocity: 18, duration: 0.5 } // ω 40, ζ 0.5, launched with the glyphs

  // --- Physics (simulated once in build) -----------------------------------------------------
  const SIM_DT = 1 / 2400
  const SETTLE = [8.8, 8.88] // sub-2 px residual → exactly home; the line is dead still from 8.88
  const SIM_END = SETTLE[1]
  const OMEGA_B = 32 // burst spring (rad/s)
  const ZETA = { early: 0.28, late: 1.0, ramp: [8.645, 8.7] } // lively burst, then a firm settle
  const RESTITUTION_GLYPH = 0.3
  const GLYPH_ITERATIONS = 4
  const SDF_CELL = 2 // px
  const WALL_INSET = 3 // px: ink meets the inside edge of the 2 px rim, never overlaps it
  // The border is a rubber membrane. While a letter presses past the rest border by p it pushes
  // back (stiffening spring + damping while driven in) and the rim is carried by the letter's
  // face; once the letter pulls away faster than the rim can follow, the rim is a free damped
  // oscillator (8 Hz) that keeps its release velocity, overshoots inward and rings out.
  const WALL = { stiffness: 1500, stiffen: 26, damping: 16, omega: 2 * Math.PI * 8, zeta: 0.3 }
  const HARD_HIT = 700 // px/s: slower touches are jostles, not hits
  const SQUASH = { omega: 120, zeta: 0.42, perPx: 0.15 / 28, max: 0.15, stretch: 0.6 }
  const NODE_SPACING = 5 // px between rim nodes (the spline is resampled this fine)
  const DENT_TENSION = 0.7 // px of give lost per px along the rim away from the letter

  // --- Look ----------------------------------------------------------------------------------
  const RIM = { color: '#8982FF', width: 2 }
  const NEIGHBOUR_DOT = '#3A3580'
  const DOT_DIM = '#2E2A66' // s03's coarse map dots
  const BREATHS = [[9.0, 0.2], [9.5, 0.2]] // the border (not the text) breathes on the beats
  const BREATH_AMP = 0.008
  const BREATH_PIVOT = [960, 540]

  // --- Small helpers ------------------------------------------------------------------------
  const r2 = (v) => Math.round(v * 100) / 100
  const r4 = (v) => Math.round(v * 10000) / 10000
  const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
  const inQuad = (x) => x * x

  // Container-framing projection (Z 44): lon/lat → authored px.
  const project = (lon, lat) => [
    K_C[0] + (lon - KIGALI[0]) * PX_PER_DEG * Z_C,
    K_C[1] - (lat - KIGALI[1]) * PX_PER_DEG * Z_C,
  ]

  // Centripetal Catmull–Rom (α = 0.5) through a closed ring: the cubic Bézier controls of the
  // segment p1 → p2. It passes through every border vertex, so it only rounds the joins.
  function catmullRom(p0, p1, p2, p3) {
    const d1 = Math.max(1e-6, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) ** 0.5)
    const d2 = Math.max(1e-6, Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) ** 0.5)
    const d3 = Math.max(1e-6, Math.hypot(p3[0] - p2[0], p3[1] - p2[1]) ** 0.5)
    const a = 2 * d1 * d1 + 3 * d1 * d2 + d2 * d2
    const b = 2 * d3 * d3 + 3 * d3 * d2 + d2 * d2
    return [
      [(d1 * d1 * p2[0] - d2 * d2 * p0[0] + a * p1[0]) / (3 * d1 * (d1 + d2)), (d1 * d1 * p2[1] - d2 * d2 * p0[1] + a * p1[1]) / (3 * d1 * (d1 + d2))],
      [(d3 * d3 * p1[0] - d2 * d2 * p3[0] + b * p2[0]) / (3 * d3 * (d3 + d2)), (d3 * d3 * p1[1] - d2 * d2 * p3[1] + b * p2[1]) / (3 * d3 * (d3 + d2))],
    ]
  }
  function ringToPath(points) {
    const n = points.length
    let d = `M${r2(points[0][0])},${r2(points[0][1])}`
    for (let i = 0; i < n; i++) {
      const p2 = points[(i + 1) % n]
      const [c1, c2] = catmullRom(points[(i - 1 + n) % n], points[i], p2, points[(i + 2) % n])
      d += `C${r2(c1[0])},${r2(c1[1])} ${r2(c2[0])},${r2(c2[1])} ${r2(p2[0])},${r2(p2[1])}`
    }
    return `${d}Z`
  }
  // Resample the spline to nodes ≤ `step` px apart, so a dent can bend the rim anywhere (the
  // 10m border has straight runs of 40+ px) while the drawn curve stays the same.
  function densify(points, step) {
    const n = points.length
    const out = []
    for (let i = 0; i < n; i++) {
      const p1 = points[i]
      const p2 = points[(i + 1) % n]
      const [c1, c2] = catmullRom(points[(i - 1 + n) % n], p1, p2, points[(i + 2) % n])
      const pieces = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
      for (let k = 0; k < pieces; k++) {
        const u = k / pieces
        const v = 1 - u
        out.push([0, 1].map((axis) => v * v * v * p1[axis] + 3 * v * v * u * c1[axis] + 3 * v * u * u * c2[axis] + u * u * u * p2[axis]))
      }
    }
    return out
  }

  // Light de-stepping only: one Taubin (λ|μ) pass takes out the ~2 px TopoJSON quantisation
  // stairs of the 10m border at 528 px/deg without rounding off its bends.
  function destep(points, iterations = 1, lambda = 0.5, mu = -0.53) {
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
  // Signed distance (px, positive inside) to the outline of an SVG path, on a `cell`-px grid,
  // with bilinear sampling and an inward unit normal from its gradient.
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

  // --- Camera: [scale, tx, ty] with screen = scale · authored + (tx, ty) -----------------------
  function cameraAt(t, api) {
    if (t < PUSH[1]) {
      // Entry on s03's projection (Kigali at (1560, 530), Z = s03's creep), then the crash push
      // to container framing: Kigali's screen position and log Z both eased with reveal.
      const p = api.ease.snappy(api.progress(t, PUSH[0], PUSH[1]))
      const zoom = Math.exp(api.lerp(Math.log(entryZ(t)), Math.log(Z_C), p)) / Z_C
      return [zoom, api.lerp(K_ENTRY[0], K_C[0], p) - zoom * K_C[0], api.lerp(K_ENTRY[1], K_C[1], p) - zoom * K_C[1]]
    }
    // Read push about the text, then the dive about F on top of it (one continuous move).
    const lp = t <= READ_PUSH.from ? 0 : READ_PUSH.log * inQuad((t - READ_PUSH.from) / (READ_PUSH.ref - READ_PUSH.from))
    const ld = t <= DIVE.from ? 0 : DIVE.log * api.ease.inCubic(api.progress(t, DIVE.from, DIVE.to))
    const sp = Math.exp(lp)
    const sd = Math.exp(ld)
    const [px, py] = READ_PUSH.pivot
    const [fx, fy] = DIVE.pivot
    return [sp * sd, sd * px * (1 - sp) + fx * (1 - sd), sd * py * (1 - sp) + fy * (1 - sd)]
  }

  function build(root, api) {
    const { svg, tokens } = api
    const S = window.SC_SHARED
    const HI = window.SC_RWANDA_HIRES

    // ---- Rwanda: 10m border, projected, lightly de-stepped ---------------------------------
    const rawRing = []
    for (let i = 0; i < HI.ring.length; i += 2) rawRing.push(project(HI.ring[i], HI.ring[i + 1]))
    const ring = densify(destep(rawRing, 1), NODE_SPACING)
    const pathData = ringToPath(ring)

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
        // Centre = ink centre in x, the line's x-height middle in y (keeps every baseline straight).
        const centre = [(box[0] + box[2]) / 2, line.baseline - (X_HEIGHT * FONT_SIZE) / 2]
        glyphs.push({
          character, penX, baseline: line.baseline, centre, box, spaceBefore,
          hullRel: hull.map(([x, y]) => [x - centre[0], y - centre[1]]),
          hit: null,
        })
      })
    })

    // ---- The wall: signed distance field of the rest border --------------------------------
    const field = signedDistanceField(pathData, [360, 20, 1560, 1060], SDF_CELL)

    // ---- Physics ----------------------------------------------------------------------------
    const scaleEase = api.ease.spring(SCALE_SPRING)
    const scaleAt = (t) => api.tween(t, BURST_T0, BURST_T0 + SCALE_SPRING.duration, SCALE_FROM, 1, scaleEase)
    const zetaAt = (t) => api.lerp(ZETA.early, ZETA.late, smoothstep(api.progress(t, ZETA.ramp[0], ZETA.ramp[1])))
    const steps = Math.round((SIM_END - BURST_T0) / SIM_DT)
    const count = glyphs.length
    // Every glyph starts on the same ray from B as its home, as a SCALE_FROM miniature of the
    // finished line (no ink blot at B), and is launched outward along that ray.
    const pos = glyphs.map((glyph) => [0, 1].map((axis) => BURST_ORIGIN[axis] + SCALE_FROM * (glyph.centre[axis] - BURST_ORIGIN[axis])))
    const vel = glyphs.map((glyph) => [0, 1].map((axis) => LAUNCH * (glyph.centre[axis] - BURST_ORIGIN[axis])))
    const table = { x: [], y: [], squash: [], wall: [], patchY: [] }
    for (let i = 0; i < count; i++) for (const key in table) table[key].push(new Float32Array(steps + 1))
    for (const glyph of glyphs) {
      glyph.extent = [glyph.centre[0] - glyph.box[0], glyph.centre[1] - glyph.box[1], glyph.box[2] - glyph.centre[0], glyph.box[3] - glyph.centre[1]]
      glyph.radius = Math.max(...glyph.hullRel.map(([x, y]) => Math.hypot(x, y)))
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
        // The word space is a body too, so "Data stays" never closes up into one word.
        const pad = b === a + 1 && glyphs[b].spaceBefore > 0 && glyphs[b].baseline === glyphs[a].baseline ? glyphs[b].spaceBefore : 0
        if (!overlapAtHome) pairs.push({ a, b, pad, armed: false })
      }
    }
    // Wall patch per glyph (created on its first touch): the glyph's penetration p past the
    // rest border, and the membrane m, a damped oscillator driven by p. The rim is drawn at
    // max(p, m): it wraps the pressing face while the glyph is in, then — having inertia — trails
    // the retreating glyph, overshoots inward and rings out.
    const W = WALL
    const patches = glyphs.map(() => null)
    const squash = glyphs.map(() => ({ value: 0, rate: 0 }))

    const record = (step) => {
      for (let i = 0; i < count; i++) {
        const patch = patches[i]
        table.x[i][step] = pos[i][0]
        table.y[i][step] = pos[i][1]
        table.squash[i][step] = squash[i].value
        table.wall[i][step] = patch ? patch.m : 0
        table.patchY[i][step] = patch ? patch.y : 0
      }
    }
    record(0)
    for (let step = 1; step <= steps; step++) {
      const time = BURST_T0 + step * SIM_DT
      const zeta = zetaAt(time)
      // 1. Burst springs + the wall's push-back (semi-implicit Euler; isotropic, so a free glyph
      // flies a straight line from B).
      for (let i = 0; i < count; i++) {
        const patch = patches[i]
        for (let axis = 0; axis < 2; axis++) {
          const x = pos[i][axis] - glyphs[i].centre[axis]
          let acceleration = -OMEGA_B * OMEGA_B * x - 2 * zeta * OMEGA_B * vel[i][axis]
          if (axis === 0 && patch && patch.p > 0) {
            // The rim pushes back along the flank's inward side: a stiffening spring on the depth
            // (so a hard hit can't punch through), plus damping while the glyph is still driving
            // in (the "thud" that eats some of the rebound).
            const into = -patch.side * vel[i][0]
            acceleration += patch.side * (W.stiffness * patch.p * (1 + (patch.p / W.stiffen) ** 2) + (into > 0 ? W.damping * into : 0))
          }
          vel[i][axis] += acceleration * SIM_DT
          pos[i][axis] += vel[i][axis] * SIM_DT
        }
      }
      const k = scaleAt(time)
      // 2. Glyph–glyph contacts.
      for (let iteration = 0; iteration < GLYPH_ITERATIONS; iteration++) {
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
      }
      // 3. Penetration into the rest border. The text only ever meets the border's flanks, so the
      // wall acts horizontally: each line keeps its baseline while its letters hit and rebound.
      for (let i = 0; i < count; i++) {
        const glyph = glyphs[i]
        let patch = patches[i]
        let deepest = -Infinity
        let contact = null
        let side = 0
        if (field.sample(pos[i][0], pos[i][1]) <= glyph.radius * k + WALL_INSET + 60) {
          for (const rel of glyph.hullDense) {
            const qx = pos[i][0] + rel[0] * k
            const qy = pos[i][1] + rel[1] * k
            const distance = field.sample(qx, qy)
            if (distance > WALL_INSET + 60) continue
            const inward = field.normal(qx, qy)
            if (Math.abs(inward[0]) < 0.35) continue
            const penetration = (WALL_INSET - distance) / Math.abs(inward[0]) // horizontal
            if (penetration > deepest) {
              deepest = penetration
              contact = [rel[0] * k, rel[1] * k]
              side = Math.sign(inward[0]) // +1: wall on the glyph's left, pushes right
            }
          }
        }
        if (!patch && contact && deepest > 0) {
          patch = patches[i] = { p: 0, m: 0, v: 0, side, y: pos[i][1] + contact[1], relY: contact[1] }
          const into = -side * vel[i][0]
          if (into >= HARD_HIT) glyph.hit = { time, speed: into, side }
        }
        if (!patch) continue
        patch.p = contact && side === patch.side ? deepest : -60
        if (patch.p > 0) patch.y = pos[i][1] + patch.relY
        // Membrane: carried by the pressing face (it can never be inside the glyph), then free —
        // a damped spring back to rest that keeps the velocity it was released with.
        if (patch.p >= patch.m) {
          patch.v = Math.max(0, -patch.side * vel[i][0]) // moving with the glyph's face
          patch.m = patch.p
        } else {
          patch.v += (-W.omega * W.omega * patch.m - 2 * W.zeta * W.omega * patch.v) * SIM_DT
          patch.m = Math.max(patch.p, patch.m + patch.v * SIM_DT)
        }
      }
      // 4. Squash follows the push while touching, then springs back (and over into a stretch).
      for (let i = 0; i < count; i++) {
        const s = squash[i]
        const patch = patches[i]
        const target = patch && patch.p > 0 ? Math.min(SQUASH.max, patch.p * SQUASH.perPx) : 0
        s.rate += (SQUASH.omega * SQUASH.omega * (target - s.value) - 2 * SQUASH.zeta * SQUASH.omega * s.rate) * SIM_DT
        s.value = Math.max(-0.08, Math.min(SQUASH.max, s.value + s.rate * SIM_DT))
      }
      record(step)
    }

    // ---- Dent geometry --------------------------------------------------------------------
    // The rim is a rubber band: where a letter presses past the rest border it wraps the letter's
    // face, and either side it runs back to the border at the band's tension slope (a tent, which
    // the Catmull–Rom path rounds). Once the letter has gone, the band keeps the shape it had at
    // its deepest and rings out with the membrane amplitude m(t) from the sim.
    let perimeter = 0
    const arc = ring.map((p, index) => {
      const here = perimeter
      const next = ring[(index + 1) % ring.length]
      perimeter += Math.hypot(next[0] - p[0], next[1] - p[1])
      return here
    })
    const dentPatches = []
    glyphs.forEach((glyph, i) => {
      if (!patches[i]) return
      const side = patches[i].side
      let peak = 0
      let peakStep = 0
      for (let step = 0; step <= steps; step++) {
        if (table.wall[i][step] > peak) {
          peak = table.wall[i][step]
          peakStep = step
        }
      }
      const yRef = table.patchY[i][peakStep]
      const reach = (glyph.extent[1] + glyph.extent[3]) / 2 + peak / DENT_TENSION + 40
      const nodes = []
      ring.forEach((p, index) => {
        if (-side * p[0] > -side * LINE_CENTRE_X && Math.abs(p[1] - yRef) < reach) nodes.push(index)
      })
      const patch = { glyph: i, side, nodes, peak, peakTime: BURST_T0 + peakStep * SIM_DT, shape: null }
      const pose = { x: table.x[i][peakStep], y: table.y[i][peakStep], scale: scaleAt(BURST_T0 + peakStep * SIM_DT), squash: table.squash[i][peakStep] }
      const envelope = bandEnvelope(patch, glyph, pose, ring, arc, perimeter)
      const top = Math.max(...envelope)
      patch.shape = envelope.map((value) => (top > 0 ? Math.max(0, value) / top : 0))
      dentPatches.push(patch)
    })

    // ---- DOM ------------------------------------------------------------------------------
    // Neighbouring land: one canvas of dim dots under the country (screen-constant radius, the
    // map's dot language), redrawn each frame through the camera.
    const dotCanvas = api.el('canvas', { attrs: { width: api.WIDTH, height: api.HEIGHT } }, root)
    dotCanvas.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px'
    const dotContext = dotCanvas.getContext('2d')
    const lattice = HI.lattice
    const cells = lattice.cells
    const dotCount = cells.length / 3
    const dotX = new Float32Array(dotCount)
    const dotY = new Float32Array(dotCount)
    const dotD = new Float32Array(dotCount)
    const dotLevel = new Uint8Array(dotCount)
    let kept = 0
    for (let n = 0; n < dotCount; n++) {
      const i = cells[n * 3]
      const j = cells[n * 3 + 1]
      const [x, y] = project(lattice.lon0 + i * lattice.step, lattice.lat0 - j * lattice.step)
      dotX[kept] = x
      dotY[kept] = y
      dotD[kept] = cells[n * 3 + 2] / 1000
      dotLevel[kept] = i % 2 === 0 && j % 2 === 0 ? 0 : 1
      kept++
    }
    // s03's 1° map field, carried across the cut (same dots, same place) and zoomed away.
    const coarse = S.dotField()
    const coarseX = new Float32Array(coarse.count)
    const coarseY = new Float32Array(coarse.count)
    for (let n = 0; n < coarse.count; n++) {
      coarseX[n] = K_C[0] + coarse.rx[n] * Z_C
      coarseY[n] = K_C[1] + coarse.ry[n] * Z_C
    }

    const stage = svg('svg', { width: api.WIDTH, height: api.HEIGHT, viewBox: `0 0 ${api.WIDTH} ${api.HEIGHT}`, overflow: 'visible' }, root)
    stage.style.position = 'absolute'
    stage.style.left = '0'
    stage.style.top = '0'
    const world = svg('g', {}, stage)
    const fill = svg('path', { d: pathData, fill: tokens.violet }, world)
    const textGroup = svg('g', {}, world)
    for (const glyph of glyphs) {
      glyph.node = svg('text', {
        x: r2(glyph.penX), y: glyph.baseline, fill: tokens.ink,
        'font-family': 'Inter', 'font-weight': 800, 'font-size': FONT_SIZE,
      }, textGroup)
      glyph.node.textContent = glyph.character
    }
    const rim = svg('path', {
      d: pathData, fill: 'none', stroke: RIM.color, 'stroke-width': RIM.width,
      'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke',
    }, world)

    const state = {
      world, fill, rim, textGroup, glyphs, table, steps, scaleAt, ring, arc, perimeter, pathData, dentPatches,
      dotContext, dotX, dotY, dotD, dotLevel, dotKept: kept, coarse, coarseX, coarseY, field,
    }
    if (new URLSearchParams(location.search).has('s04debug')) window.__s04 = Object.assign(state, { debug: { bandEnvelope, poseHull, glyphPose, cameraAt } })
    return state
  }

  function render(t, state, api) {
    const { setAttrs, setStyle, progress } = api
    const camera = cameraAt(t, api)
    const [scale, tx, ty] = camera
    setAttrs(state.world, { transform: scale === 1 && tx === 0 && ty === 0 ? '' : `matrix(${r4(scale)},0,0,${r4(scale)},${r4(tx)},${r4(ty)})` })

    drawDots(t, state, api, camera)

    // ---- Border: rest shape + membrane dents + beat breaths ----------------------------------
    let breath = 1
    for (const [start, duration] of BREATHS) {
      if (t >= start && t <= start + duration) breath += BREATH_AMP * Math.sin(Math.PI * progress(t, start, start + duration))
    }
    let pathData = state.pathData
    const sample = sampler(t)
    if (sample) {
      // Letters pressing the same stretch of rim: the band takes the furthest push; the rings
      // after release superpose.
      const push = new Map()
      const ring = new Map()
      for (const patch of state.dentPatches) {
        const m = lerpTable(state.table.wall[patch.glyph], sample)
        const envelope = bandEnvelope(patch, state.glyphs[patch.glyph], glyphPose(state, patch.glyph, t, api), state.ring, state.arc, state.perimeter)
        patch.nodes.forEach((index, k) => {
          const u = -patch.side * Math.max(envelope[k], m * patch.shape[k]) // signed x offset
          if (Math.abs(u) < 0.02) return
          const outward = u * -patch.side > 0
          if (outward) push.set(index, Math.abs(u) > Math.abs(push.get(index) || 0) ? u : push.get(index))
          else ring.set(index, (ring.get(index) || 0) + u)
        })
      }
      if (push.size || ring.size) {
        const dented = state.ring.map((p) => p.slice())
        for (const [index, u] of push) dented[index][0] += u
        for (const [index, u] of ring) dented[index][0] += u
        pathData = ringToPath(dented)
      }
    }
    const breathTransform = breath === 1 ? '' : `translate(${BREATH_PIVOT[0]},${BREATH_PIVOT[1]}) scale(${r4(breath)}) translate(${-BREATH_PIVOT[0]},${-BREATH_PIVOT[1]})`
    setAttrs(state.fill, { d: pathData, transform: breathTransform })
    setAttrs(state.rim, { d: pathData, transform: breathTransform })

    // ---- Glyphs ----------------------------------------------------------------------------
    const visible = t >= BURST_T0
    setStyle(state.textGroup, { display: visible ? 'inline' : 'none' })
    if (!visible) return
    for (let i = 0; i < state.glyphs.length; i++) {
      const glyph = state.glyphs[i]
      setAttrs(glyph.node, { transform: glyphTransform(glyph, glyphPose(state, i, t, api)) })
    }
  }

  // The glyph's ink hull at a pose, in authored px (same maths as glyphTransform).
  function poseHull(glyph, { x, y, scale, squash }) {
    const faceX = (glyph.hit && glyph.hit.side < 0 ? glyph.extent[2] : -glyph.extent[0]) * scale
    const sx = 1 - squash
    const sy = 1 + SQUASH.stretch * squash
    return glyph.hullRel.map(([hx, hy]) => {
      const px = hx * scale
      const py = hy * scale
      return glyph.hit ? [x + faceX + (px - faceX) * sx, y + py * sy] : [x + px, y + py]
    })
  }
  // Rubber-band offsets (px, outward, one per patch node): how far the letter's face at each
  // node's height reaches past the rest border (+ the ink gap), spread by the band tension.
  function bandEnvelope(patch, glyph, pose, ring, arc, perimeter) {
    const hull = poseHull(glyph, pose)
    const contact = patch.nodes.map((index) => {
      const [nx, ny] = ring[index]
      let face = null
      const reach = (x) => {
        face = face === null ? x : patch.side > 0 ? Math.min(face, x) : Math.max(face, x)
      }
      for (let e = 0; e < hull.length; e++) {
        const [ax, ay] = hull[e]
        const [bx, by] = hull[(e + 1) % hull.length]
        // Corners within half a node spacing count too, so a flat top can't slip between nodes.
        if (Math.abs(ay - ny) <= NODE_SPACING) reach(ax)
        if ((ay > ny) !== (by > ny)) reach(ax + ((ny - ay) / (by - ay)) * (bx - ax))
      }
      return face === null ? -Infinity : patch.side * (nx - face) + WALL_INSET
    })
    return patch.nodes.map((index) => {
      let best = -Infinity
      patch.nodes.forEach((other, j) => {
        if (contact[j] <= 0) return
        let distance = Math.abs(arc[index] - arc[other])
        distance = Math.min(distance, perimeter - distance)
        best = Math.max(best, contact[j] - DENT_TENSION * distance)
      })
      return best
    })
  }

  // Table lookup position for time t (null outside the simulated window).
  function sampler(t) {
    if (t < BURST_T0 || t >= SIM_END) return null
    const f = (t - BURST_T0) / SIM_DT
    const steps = Math.round((SIM_END - BURST_T0) / SIM_DT)
    const j = Math.min(steps - 1, Math.max(0, Math.floor(f)))
    const blend = 1 - smoothstep((t - SETTLE[0]) / (SETTLE[1] - SETTLE[0]))
    return { j, frac: Math.min(1, f - j), blend }
  }
  const lerpTable = (array, { j, frac, blend }, blended = true) => (array[j] + (array[j + 1] - array[j]) * frac) * (blended ? blend : 1)

  // Pose of glyph i at time t: centre (physics table), uniform scale and wall squash.
  function glyphPose(state, i, t, api) {
    const glyph = state.glyphs[i]
    const sample = sampler(t)
    if (!sample) return { x: glyph.centre[0], y: glyph.centre[1], scale: 1, squash: 0 }
    const { table } = state
    const x = glyph.centre[0] + (lerpTable(table.x[i], sample, false) - glyph.centre[0]) * sample.blend
    const y = glyph.centre[1] + (lerpTable(table.y[i], sample, false) - glyph.centre[1]) * sample.blend
    const scale = 1 + (state.scaleAt(t) - 1) * sample.blend
    return { x, y, scale, squash: lerpTable(table.squash[i], sample) }
  }

  function glyphTransform(glyph, { x, y, scale, squash }) {
    if (scale === 1 && squash === 0 && x === glyph.centre[0] && y === glyph.centre[1]) return ''
    let squashTransform = ''
    if (squash !== 0 && glyph.hit) {
      // Flatten against the wall about the pressing face (the ink edge on the wall side), and
      // bulge perpendicular about the line's x-height middle.
      const faceX = (glyph.hit.side > 0 ? -glyph.extent[0] : glyph.extent[2]) * scale
      squashTransform = ` translate(${r4(faceX)},0) scale(${r4(1 - squash)},${r4(1 + SQUASH.stretch * squash)}) translate(${r4(-faceX)},0)`
    }
    return `translate(${r4(x)},${r4(y)})${squashTransform} scale(${r4(scale)}) translate(${r4(-glyph.centre[0])},${r4(-glyph.centre[1])})`
  }

  // Neighbouring land as dim dots: s03's 1° grid carried across the cut, then the 0.05° grid
  // (s03's own LOD lattice) and its 0.025° midpoints resolve outward from the border as the
  // camera lands, like s03's LOD re-sample. Radii are screen-constant and thin with distance
  // from Rwanda, so the eye stays on the country.
  function drawDots(t, state, api, [scale, tx, ty]) {
    const context = state.dotContext
    const W = api.WIDTH
    const H = api.HEIGHT
    const TAU = Math.PI * 2
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, W, H)
    // Coarse 1° field (only while it is still on screen).
    const coarseFade = 1 - api.progress(t, 8.56, 8.66)
    if (coarseFade > 0) {
      const r = 2.6
      context.fillStyle = DOT_DIM
      context.globalAlpha = coarseFade
      context.beginPath()
      for (let n = 0; n < state.coarse.count; n++) {
        if (n === state.coarse.rwandaIndex) continue
        const x = scale * state.coarseX[n] + tx
        const y = scale * state.coarseY[n] + ty
        if (x < -r || x > W + r || y < -r || y > H + r) continue
        context.moveTo(x + r, y)
        context.arc(x, y, r, 0, TAU)
      }
      context.fill()
      context.globalAlpha = 1
    }
    // Fine neighbour field.
    context.fillStyle = NEIGHBOUR_DOT
    context.beginPath()
    for (let n = 0; n < state.dotKept; n++) {
      const d = state.dotD[n]
      if (d < 0.016) continue // a clean ink gutter along the rim
      const start = (state.dotLevel[n] === 0 ? 8.5042 : 8.545) + 0.16 * Math.min(1, d / 1.3)
      const grow = api.progress(t, start, start + 0.14)
      if (grow <= 0) continue
      const x = scale * state.dotX[n] + tx
      const y = scale * state.dotY[n] + ty
      const r = 2.5 * (1 - 0.45 * smoothstep((d - 0.3) / 1.0)) * (grow >= 1 ? 1 : api.ease.outBack(grow))
      if (r <= 0.05 || x < -r || x > W + r || y < -r || y > H + r) continue
      context.moveTo(x + r, y)
      context.arc(x, y, r, 0, TAU)
    }
    context.fill()
  }

  SC.scene({ id: ID, start: START, end: END, z: 4, build, render })
})()
