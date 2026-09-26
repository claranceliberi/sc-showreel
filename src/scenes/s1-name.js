// s1 "Name" (0.0–7.0 s) — the brand letters on the violet elastic, the pull, the extra t (3.000),
// the ¾ arc with "the extra push.", then the band slips free and zips east to Kigali.
//
// Staging: pearl-satin letters stand on the satin floor; the violet band is threaded straight
// through their feet at baseline height (it never crosses the x-height) and hitched round two
// violet pins. The pull drags "ch" + the right pin east; "stret" stick-slips and leans back; the
// free span thins (SC3D.bandRadius) and trembles higher as it tightens. The t's shadow grows in the
// gap, the t drops, squashes at 3.000 and the band releases: "ch" slams home against it. At 5.2 the
// band is yanked off the right pin, its tail whips back through the weave, and it runs along the
// floor like a flicked rubber band, onto the continent, and hooks the Kigali needle — arriving in
// exactly the pose s2 takes it in (HANDOFF below) at 6.8.
//
// Determinism: every value is a pure function of global t. The spring responses (letter leans, pin
// tilts) are integrated ONCE in build() on a fixed 1/480 s grid from fixed initial conditions and
// looked up by t in render(); nothing is carried between frames.
(() => {
  'use strict'
  const SC = window.SC
  const DEG = Math.PI / 180
  const { clamp, lerp } = SC
  const bez = SC.ease.cubicBezier
  const seg = (t, a, b) => clamp((t - a) / (b - a))
  const smoothstep = (a, b, x) => {
    const s = seg(x, a, b)
    return s * s * (3 - 2 * s)
  }
  const decay = (x, tau) => (x < 0 ? 0 : Math.exp(-x / tau))
  const ring = (x, tau, hz) => (x < 0 ? 0 : Math.exp(-x / tau) * Math.sin(2 * Math.PI * hz * x))

  // ── Beat clock (global seconds) — also the sound designer's cue sheet ──────────────────────
  const BEAT = {
    tug: 0.8, // anticipation: the right anchor twitches
    pull: 1.0, // the off-screen force starts dragging the right anchor east
    slips: [1.42, 1.78, 2.1, 2.34], // "stret" stick-slips (creaks of light along the band)
    pullStop: 2.4, // the drag stops (overshoot, recoil 2.4–2.62) → max strain, strained hold
    shadow: 2.4, // the t's shadow starts to grow in the gap
    drop: 2.58, // the t falls (enters frame ≈ 2.83)
    hit: 3.0, // the t lands — squash
    clack: 3.1, // "ch" slams home against the t
    labelIn: 3.22, // leader line draws; words 3.26–3.6
    labelOut: 5.2,
    free: 5.2, // the band is yanked off the right pin
    tailFree: 5.3, // the tail slips off the left pin and whips back through the letters
    hook: 6.64, // the head catches the Kigali needle
    handoff: 6.8, // SC3D.owner('band') → s2
  }

  // ── Look / geometry constants ───────────────────────────────────────────────────────────
  const BASELINE = 22.45 // wordmark baseline in logo units (world3d)
  const DEPTH = 3.6
  const BEVEL = 0.55
  const R0 = 0.02 // band rest radius at the letters
  const Y0 = 0.034 // band centre height through the letters' feet
  const LOOP_R = 0.028 // hitch radius round a pin needle; the band runs tangent to its front
  const BAND_Z = LOOP_R // band line, in front of the letters' mid-depth (still inside their feet)
  const LOOP_RISE = 0.045
  const PIN_GAP = 0.11
  const STRAIN_WEIGHT = [0.3, 0.45, 0.62, 0.8, 1, 0, 1, 1]
  const SKID = 0.055 // how far "stret" is dragged (t4, at full strain)
  const EXTRA = 0.9 // how far "ch" is dragged beyond its final spot
  const LEAN = 9 * DEG // max resisting lean of "stret"
  const GAP_REST = 0.34 // effective rest length of the free span (bandRadius law)
  const T_HEIGHT = 2.2 // drop height of the t

  // Motion-blur windows for the fast moves (render only). Measured peaks: the falling t ≈ 83 px/frame,
  // "ch" snapping home ≈ 97, the tail whipping out through the letters ≈ 115; the zip itself stays
  // under ≈ 30 px/frame (default sampling is enough).
  SC.post.motionBlurWindows.push(
    { from: 2.8, to: 3.01, subframes: 16 }, // the t falls
    { from: 3.01, to: 3.16, subframes: 24 }, // "ch" snaps home
    { from: 5.3, to: 5.62, subframes: 24 }, // the tail whips back through the letters and off the pins
  )

  // Pull progress of the right anchor + "ch": 0 at rest, 1 at full stretch (overshoot & recoil).
  const easeIO = bez(0.45, 0, 0.55, 1)
  const PULL_KEYS = [
    [0.0, 0],
    [BEAT.tug, 0],
    [0.9, 0.028, bez(0.2, 0.7, 0.4, 1)],
    [BEAT.pull, 0.01, easeIO],
    [BEAT.pullStop, 1.035, bez(0.5, 0, 0.12, 1)],
    [2.62, 0.982, easeIO],
    [2.86, 1.0, easeIO],
  ]
  const pullAt = (t) => SC.keyframes(t, PULL_KEYS)
  // Tension 0..1 (released at the hit)
  const strainAt = (t) => Math.pow(clamp(pullAt(t), 0, 1.05), 1.4) * (t < BEAT.hit ? 1 : decay(t - BEAT.hit, 0.03))

  // "stret" stick-slip: a staircase of short jolts, rippling outward from the gap; released at the hit.
  const SLIP_SIZE = [0.2, 0.26, 0.24, 0.3]
  const slipEase = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : SC.ease.outBack(x, 2.4))
  const releaseEase = SC.ease.spring({ stiffness: 420, damping: 17, duration: 0.5 })
  function stretSkid(t, i) {
    const lag = (4 - i) * 0.016
    let s = 0.12 * smoothstep(BEAT.pull, BEAT.pullStop, t - lag) // slow creep under the slips
    for (let k = 0; k < SLIP_SIZE.length; k++) s += SLIP_SIZE[k] * 0.88 * slipEase((t - BEAT.slips[k] - lag) / 0.06)
    const lagRelease = (4 - i) * 0.018
    return s * (1 - releaseEase(seg(t, BEAT.hit + lagRelease, BEAT.hit + lagRelease + 0.5)))
  }
  // "ch" after the hit: elastic recoil (max speed at contact), bounce off the t.
  const SNAP_TIME = BEAT.clack - BEAT.hit
  function chOffset(t, lag = 0) {
    if (t < BEAT.hit) return pullAt(t)
    const tau = t - BEAT.hit - lag
    if (tau <= 0) return pullAt(BEAT.hit)
    const x = Math.min(tau / SNAP_TIME, 1)
    const recoil = Math.cos((Math.PI / 2) * x) // 1 → 0, fastest at contact (the band's pull is max at full stretch)
    const bounce = tau > SNAP_TIME ? (0.016 / EXTRA) * ring(tau - SNAP_TIME, 0.05, 7.5) : 0
    return recoil + bounce
  }
  // The t: free fall from T_HEIGHT, landing at exactly BEAT.hit.
  const fallAt = (t) => seg(t, BEAT.drop, BEAT.hit) // 0..1
  const tHeightAt = (t) => (t < BEAT.hit ? T_HEIGHT * (1 - Math.pow(fallAt(t), 2)) : 0)
  // Landing squash: damped oscillator from the falling stretch with a hard downward velocity.
  function squashAt(t) {
    if (t < BEAT.hit) return 0.15 * Math.pow(fallAt(t), 3) // stretched by speed
    const tau = t - BEAT.hit
    const w = 2 * Math.PI * 6.8
    const z = 0.32
    const wd = w * Math.sqrt(1 - z * z)
    const e0 = 0.15
    const v0 = -21
    return Math.exp(-z * w * tau) * (e0 * Math.cos(wd * tau) + ((v0 + z * w * e0) / wd) * Math.sin(wd * tau))
  }

  // Monotone cubic Hermite through [t, value, slope?] keys (Fritsch–Carlson); holds outside.
  function hermiteTrack(keys) {
    const n = keys.length
    const d = []
    for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]))
    const m = keys.map((key, i) => {
      if (key[2] !== undefined) return key[2]
      if (i === 0) return d[0]
      if (i === n - 1) return d[n - 2]
      if (d[i - 1] * d[i] <= 0) return 0
      const w1 = 2 * (keys[i + 1][0] - keys[i][0]) + (keys[i][0] - keys[i - 1][0])
      const w2 = (keys[i + 1][0] - keys[i][0]) + 2 * (keys[i][0] - keys[i - 1][0])
      return (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
    })
    return (t) => {
      if (t <= keys[0][0]) return keys[0][1]
      if (t >= keys[n - 1][0]) return keys[n - 1][1]
      let i = 0
      while (t > keys[i + 1][0]) i++
      const h = keys[i + 1][0] - keys[i][0]
      const s = (t - keys[i][0]) / h
      const s2 = s * s
      const s3 = s2 * s
      return (2 * s3 - 3 * s2 + 1) * keys[i][1] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * keys[i + 1][1] + (s3 - s2) * h * m[i + 1]
    }
  }

  // Precomputed damped-spring response on a fixed grid (a pure function of t once built).
  const GRID = 1 / 480
  function springTable({ t0, t1, hz, zeta, target, base = null, kappa = 0 }) {
    const w = 2 * Math.PI * hz
    const count = Math.ceil((t1 - t0) / GRID) + 1
    const values = new Float32Array(count)
    let x = target(t0)
    let v = 0
    let bPrev = base ? base(t0 - GRID) : 0
    let bCur = base ? base(t0) : 0
    for (let i = 0; i < count; i++) {
      values[i] = x
      const time = t0 + i * GRID
      let accel = 0
      if (base) {
        const bNext = base(time + GRID)
        accel = (bNext - 2 * bCur + bPrev) / (GRID * GRID)
        bPrev = bCur
        bCur = bNext
      }
      const a = w * w * (target(time) - x) - 2 * zeta * w * v + kappa * accel
      v += a * GRID
      x += v * GRID
    }
    return (t) => {
      const f = clamp((t - t0) / GRID, 0, count - 1)
      const i = Math.min(Math.floor(f), count - 2)
      return lerp(values[i], values[i + 1], f - i)
    }
  }

  SC.scene({
    id: 's1-name',
    start: 0,
    end: 7.0,
    z: 10,
    build(root, api) {
      const THREE = window.THREE
      const V = (x, y, z) => new THREE.Vector3(x, y, z)
      const LL = SC3D.layout.letters
      const scale = LL.scale
      const zc = LL.center.z
      const group = SC3D.sceneGroup(root, 's1')

      // ── Materials: warm pearl satin letters, glossy violet t (own clones: we animate them)
      const pearl = SC3D.materials.pearlSatin.clone()
      pearl.name = 's1-pearl'
      pearl.color.set('#E4DED5')
      pearl.roughness = 0.26
      pearl.clearcoat = 1
      pearl.clearcoatRoughness = 0.05
      pearl.envMapIntensity = 1.6
      pearl.emissive.set('#FFF3E6')
      const violet = SC3D.materials.violetGloss.clone()
      violet.name = 's1-violet'
      const base = {
        pearl: { color: pearl.color.clone(), env: pearl.envMapIntensity },
        violet: { color: violet.color.clone(), env: violet.envMapIntensity },
      }

      // ── Letter base extents at band height (logo units → world, relative to the glyph centre)
      const loader = new window.THREE_ADDONS.SVGLoader()
      function baseSpan(glyph) {
        const letter = window.SC_LOGO.letters[glyph]
        const data = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${letter.d}"/></svg>`)
        const polys = []
        for (const path of data.paths) for (const sub of path.subPaths) polys.push(sub.getPoints(16))
        let lo = Infinity
        let hi = -Infinity
        for (let k = 0; k <= 8; k++) {
          const ySvg = BASELINE - lerp(0.3, 1.9, k / 8)
          for (const poly of polys) {
            for (let i = 0; i < poly.length; i++) {
              const a = poly[i]
              const b = poly[(i + 1) % poly.length]
              if (a.y > ySvg !== b.y > ySvg) {
                const x = a.x + ((ySvg - a.y) / (b.y - a.y)) * (b.x - a.x)
                lo = Math.min(lo, x)
                hi = Math.max(hi, x)
              }
            }
          }
        }
        const cx = (letter.box.x0 + letter.box.x1) / 2
        return [(lo - cx) * scale, (hi - cx) * scale]
      }

      // ── Letters: final "strettch"; "stretch" = same meshes with the extra t's gap closed
      const finalLayout = SC3D.wordLayout('strettch')
      const shortLayout = SC3D.wordLayout('stretch')
      const align = finalLayout[0].x - shortLayout[0].x
      // The wordmark's 2D spacing is tuned for flat letters; extruded and bevelled, neighbours
      // collided in the close-up (the extra t's crossbar ran through the t and the c). Open the
      // tracking a little, keeping the word centred.
      const TRACK = 3.4 // logo units per letter
      const trackOffset = (index, count) => (index - (count - 1) / 2) * TRACK
      const letters = finalLayout.map((item, index) => {
        const isExtra = item.glyph === 5
        const mesh = SC3D.makeLetter(item.glyph, { scale, depth: DEPTH, bevel: BEVEL, material: isExtra ? violet : pearl })
        group.add(mesh)
        const shortIndex = index < 5 ? index : index - 1
        const finalX = LL.center.x + (item.x + trackOffset(index, 8)) * scale
        const [spanL, spanR] = baseSpan(item.glyph)
        const shadow = SC3D.makeContactShadow({ width: mesh.userData.width * 1.25, depth: 0.2, opacity: 0.4 })
        group.add(shadow)
        return {
          mesh, shadow, index, glyph: item.glyph, isExtra, role: isExtra ? 'extra' : index >= 6 ? 'ch' : 'stret',
          finalX,
          shortX: isExtra ? finalX : LL.center.x + (shortLayout[shortIndex].x + align + trackOffset(shortIndex, 7)) * scale,
          spanL, spanR, width: mesh.userData.width, height: mesh.userData.height,
          weight: STRAIN_WEIGHT[index],
        }
      })
      const T4 = letters[4]
      const TX = letters[5]
      const C = letters[6]
      const H = letters[7]

      // Base x of every letter as a function of t (before the unthreading jiggle)
      const shoveStart = BEAT.clack - 0.012
      const xOf = (letter, t) => {
        if (letter.role === 'stret') return letter.finalX + SKID * letter.weight * stretSkid(t, letter.index)
        if (letter.role === 'ch') {
          const p = chOffset(t)
          return t < BEAT.hit ? letter.shortX + p * (letter.finalX - letter.shortX + EXTRA) : letter.finalX + p * EXTRA
        }
        // the extra t lands next to the dragged t4, then the slamming c shoves it home
        const landOffset = SKID * T4.weight * stretSkid(BEAT.hit, 4)
        return TX.finalX + landOffset * (1 - (t < shoveStart ? 0 : SC.ease.outBack(seg(t, shoveStart, shoveStart + 0.13), 1.3)))
      }

      // Leans (+ = top toward −x, i.e. leaning back against the pull): springs driven by the
      // strain (target) and by the base acceleration (inertia).
      const leanTables = letters.map((letter) => {
        if (letter.isExtra) {
          return springTable({ t0: 2.9, t1: 4.4, hz: 5, zeta: 0.3, target: () => 0, base: (t) => xOf(letter, t), kappa: 0.9 })
        }
        const resist = letter.role === 'stret' ? LEAN * letter.weight : 4.5 * DEG
        return springTable({
          t0: 0.6, t1: 4.4, hz: letter.role === 'stret' ? 4.6 : 3.8, zeta: 0.32,
          target: (t) => resist * Math.pow(strainAt(t), 1.2) * (t < BEAT.hit ? 1 : 0),
          base: (t) => xOf(letter, t),
          kappa: letter.role === 'stret' ? 1.1 : 0.07,
        })
      })

      // ── Pins (own material clones so they can sink into the dark at the end)
      const makeAnchor = () => {
        const pin = SC3D.makePin(violet, { height: 0.34, headRadius: 0.042 })
        pin.traverse((node) => {
          if (node.material) node.material = node.material.clone()
        })
        group.add(pin)
        return pin
      }
      const pinL = makeAnchor()
      const pinR = makeAnchor()
      const pinMaterials = []
      for (const pin of [pinL, pinR]) pin.traverse((node) => node.material && pinMaterials.push({ material: node.material, color: node.material.color.clone(), env: node.material.envMapIntensity }))
      const pinLX = letters[0].finalX + letters[0].spanL - PIN_GAP
      const pinRX = (t) => xOf(H, t) + H.spanR + PIN_GAP
      const pinShadows = [0, 1].map(() => {
        const s = SC3D.makeContactShadow({ width: 0.12, depth: 0.08, opacity: 0.45 })
        group.add(s)
        return s
      })
      const tiltL = springTable({ t0: 0.6, t1: 4.4, hz: 3.2, zeta: 0.22, target: (t) => -4 * DEG * strainAt(t) })
      const tiltR = springTable({
        t0: 0.6, t1: 4.4, hz: 3.0, zeta: 0.25,
        target: (t) => -7 * DEG * clamp(pullAt(t), 0, 1) * (t < BEAT.hit ? 1 : 0),
        base: pinRX, kappa: -0.35,
      })

      // ── The band through the letters: control points → dense polyline with arclength
      const loopPoints = (cx, fromDeg, toDeg, y0, y1, steps) => {
        const pts = []
        for (let k = 0; k <= steps; k++) {
          const u = k / steps
          const phi = lerp(fromDeg, toDeg, u) * DEG
          pts.push(V(cx + LOOP_R * Math.cos(phi), lerp(y0, y1, u), zc + LOOP_R * Math.sin(phi)))
        }
        return pts
      }
      const SAMPLES_PER_SEGMENT = 8
      // xs[i]: current base x of letter i; withExtra: the landed t is threaded too
      function letterPath(xs, rightPinX, withExtra) {
        const ctrl = loopPoints(pinLX, 540, 90, Y0 + LOOP_RISE, Y0, 10) // 1¼ turns, tail tucked
        const marks = { letters: [] }
        const z = zc + BAND_Z
        for (const letter of letters) {
          if (letter.isExtra && !withExtra) continue
          const x = xs[letter.index]
          const first = ctrl.length
          ctrl.push(V(x + letter.spanL - 0.004, Y0, z), V(x + (letter.spanL + letter.spanR) / 2, Y0, z), V(x + letter.spanR + 0.004, Y0, z))
          marks.letters[letter.index] = first + 1
          if (letter === T4 || letter === TX) marks.gapA = first + 2 // the free span starts after t4 (after the t once it has landed)
          if (letter === C) marks.gapB = first
        }
        // right pin: approach the needle front, one rising turn, exit heading east
        marks.rightLoop = ctrl.length
        ctrl.push(...loopPoints(rightPinX, 90, -270, Y0, Y0 + LOOP_RISE, 8))
        const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal')
        const n = (ctrl.length - 1) * SAMPLES_PER_SEGMENT
        const pts = curve.getPoints(n)
        const s = new Float32Array(pts.length)
        for (let i = 1; i < pts.length; i++) s[i] = s[i - 1] + pts[i].distanceTo(pts[i - 1])
        const at = (k) => s[k * SAMPLES_PER_SEGMENT]
        return {
          pts, s, length: s[s.length - 1],
          gapA: at(marks.gapA), gapB: at(marks.gapB),
          letterS: letters.map((l) => (marks.letters[l.index] === undefined ? null : at(marks.letters[l.index]))),
          leftLoopEnd: at(10), rightLoopStart: at(marks.rightLoop),
        }
      }

      // Final layout path (static from ≈3.7 s on): used for the hold, the unthreading and the zip.
      const finalXs = letters.map((l) => l.finalX)
      const restPath = letterPath(finalXs, H.finalX + H.spanR + PIN_GAP, true)

      // ── The route to Kigali, on the floor, climbing onto the continent (built once)
      const kigali = SC3D.layout.kigali
      const HANDOFF = {
        hook: V(kigali.x, 0.22, kigali.z), // = s2's kigaliHook (head end)
        arrival: V(kigali.x - 0.9, 0.2, kigali.z + 0.5), // = s2's arrival (tail end) at 6.8
      }
      HANDOFF.length = HANDOFF.hook.distanceTo(HANDOFF.arrival)
      const dir = HANDOFF.hook.clone().sub(HANDOFF.arrival).setY(0).normalize()
      const exit = restPath.pts[restPath.pts.length - 1]
      const arr = HANDOFF.arrival
      const routeCurve = new THREE.CatmullRomCurve3([
        V(exit.x, 0, exit.z), V(exit.x + 0.4, 0, exit.z + 0.03), V(-6.6, 0, 3.4), V(-4.9, 0, 3.52), V(-3.1, 0, 3.36),
        V(-1.3, 0, 2.84), V(0.35, 0, 2.18), V(arr.x - dir.x * 0.9, 0, arr.z - dir.z * 0.9), V(arr.x - dir.x * 0.45, 0, arr.z - dir.z * 0.45), V(arr.x, 0, arr.z),
      ], false, 'centripetal')
      const routeCount = Math.ceil(routeCurve.getLength() / 0.02)
      const routePts = routeCurve.getSpacedPoints(routeCount)
      const straightCount = Math.ceil((HANDOFF.length + 0.3) / 0.02)
      for (let i = 1; i <= straightCount; i++) {
        const d = (i / straightCount) * (HANDOFF.length + 0.3)
        routePts.push(V(arr.x + dir.x * d, 0, arr.z + dir.z * d))
      }
      const routeS = new Float32Array(routePts.length)
      for (let i = 1; i < routePts.length; i++) routeS[i] = routeS[i - 1] + routePts[i].distanceTo(routePts[i - 1])
      const routeArrivalS = routeS[routeCount]
      const routeHookS = routeArrivalS + HANDOFF.length
      // land mask (Africa) → surface height, dilated so the band lifts before the coast wall
      const countries = window.SC_GEO.africa
      const land = routePts.map((p) => {
        const [lon, lat] = SC3D.unproject(p.x, p.z)
        return countries.some((c) => api.pointInPolygons([lon, lat], c.polygons)) ? 1 : 0
      })
      const routeSurface = new Float32Array(routePts.length)
      for (let i = 0; i < routePts.length; i++) {
        let m = 0
        for (let k = Math.max(0, i - 40); k <= Math.min(routePts.length - 1, i + 40); k++) {
          if (!land[k]) continue
          m = Math.max(m, 1 - smoothstep(0.02, 0.75, Math.abs(routeS[k] - routeS[i])))
        }
        routeSurface[i] = SC3D.layout.surfaceY * m
      }
      const routeFixedY = Array.from(routeS, (s) => (s <= routeArrivalS ? 0.2 : lerp(0.2, 0.22, clamp((s - routeArrivalS) / HANDOFF.length))))
      const routeEndBlend = Array.from(routeS, (s) => smoothstep(routeArrivalS - 0.9, routeArrivalS, s))

      // Rope timing along [letters path + route]: arclength of the head and of the tail.
      const SR = restPath.length // end of the right loop = start of the route
      const routeLen = routeHookS
      const S_HOOK = SR + routeHookS
      const S_TAIL_END = S_HOOK - HANDOFF.length
      const headTrack = hermiteTrack([
        [BEAT.free, 0, 0], [5.3, 0.018], [5.6, 0.12], [6.0, 0.4], [6.4, 0.77], [BEAT.hook, 1, 0.55],
      ])
      const HEAD_V = 0.55 * routeLen // head speed at the hook (u/s) — becomes the overshoot
      const headS = (t) => {
        if (t < BEAT.free) return SR
        if (t < BEAT.hook) return SR + routeLen * headTrack(t)
        const w = 2 * Math.PI * 5.5
        const over = (HEAD_V / w) * Math.exp(-(t - BEAT.hook) / 0.05) * Math.sin(w * (t - BEAT.hook))
        return S_HOOK + over * (1 - smoothstep(6.72, BEAT.handoff, t))
      }
      const tailTrack = hermiteTrack([
        [BEAT.tailFree, 0, 0], [5.4, 0.55], [5.5, 2.1], [5.6, SR + 0.1],
        [6.0, SR + routeLen * 0.4 - 1.9], [6.4, SR + routeLen * 0.77 - 1.85], [BEAT.handoff, S_TAIL_END, 0],
      ])
      const tailS = (t) => (t < BEAT.tailFree ? 0 : tailTrack(t))
      // when the tail passes each letter / pin (unthreading jiggles)
      const passTime = (sv) => {
        let lo = BEAT.tailFree
        let hi = 6.2
        for (let k = 0; k < 40; k++) {
          const mid = (lo + hi) / 2
          if (tailS(mid) < sv) lo = mid
          else hi = mid
        }
        return (lo + hi) / 2
      }
      const passTimes = restPath.letterS.map((sv) => (sv === null ? null : passTime(sv)))
      const pinPassL = passTime(restPath.leftLoopEnd)
      const pinPassR = passTime(restPath.rightLoopStart + 0.1)

      // ── Glints: creaks of light along the stretched span
      const glints = [0, 1].map(() => {
        const g = SC3D.makeGlow({ color: '#E2DEFF', size: 0.12, opacity: 0 })
        g.material.depthTest = false // it rides the exposed span only; the tube itself would occlude its core
        g.renderOrder = 12
        g.visible = false
        group.add(g)
        return g
      })
      const extraShadow = SC3D.makeContactShadow({ width: 1, depth: 1, opacity: 0 })
      group.add(extraShadow)

      // ── 2D annotation: "the extra push." + a fine leader line to the t
      const label = api.el('div', {
        style: {
          position: 'absolute', left: '0px', top: '0px', font: 'italic 400 84px "Instrument Serif"', color: '#F4F3FF',
          whiteSpace: 'nowrap', lineHeight: '1', letterSpacing: '0.004em',
        },
      }, root)
      const words = ['the', 'extra', 'push.'].map((text, i) => api.el('span', {
        text, style: { display: 'inline-block', marginRight: i < 2 ? '0.24em' : '0', opacity: '0' },
      }, label))
      const overlay = api.svg('svg', { width: 1920, height: 1080, viewBox: '0 0 1920 1080', style: 'position:absolute;left:0;top:0;overflow:visible' }, root)
      const leader = api.svg('line', { stroke: '#F4F3FF', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0 }, overlay)
      const dot = api.svg('circle', { r: 4, fill: '#F4F3FF', opacity: 0 }, overlay)

      return {
        THREE, V, zc, letters, TX, xOf, leanTables, pinL, pinR, pinLX, pinRX, tiltL, tiltR, pinShadows, pinMaterials,
        letterPath, restPath, routePts, routeS, routeSurface, routeFixedY, routeEndBlend, SR, headS, tailS,
        passTimes, pinPassL, pinPassR, glints, extraShadow, pearl, violet, base, label, words, leader, dot,
      }
    },

    render(t, s, api) {
      const { THREE, V, zc, letters, TX } = s
      const band = SC3D.props.band
      const drivesBand = SC3D.owner('band', t) === 's1'
      const strain = strainAt(t)
      const lightUp = SC.keyframes(t, [[0, 0], [0.12, 0.06], [1.1, 1, 'outCubic']]) // = the world's light-up
      const dim = smoothstep(5.85, 6.8, t) // the studio light leaves the letters as the camera cranes away
      // ... and, already out of the light in the frame's corner, they are lowered through the floor
      // so nothing is left to vanish when the scene ends at 7.0.
      const sink = -0.52 * SC.ease.inQuad(seg(t, 6.2, 6.95))

      // Rim: let the violet rim catch the pearl bevels. A touch more fog while the camera is still
      // low as it starts to crane (the far coastline would otherwise read as a ragged sliver).
      SC3D.light({
        rim: lerp(1.35, 1.1, smoothstep(5.2, 6.4, t)),
        fog: 1 + 0.35 * smoothstep(4.9, 5.25, t) * (1 - smoothstep(5.75, 6.15, t)),
      })
      // Camera: during the strained hold it creeps in and rises (the floor opens up so the t's
      // shadow reads), then hands the height back slowly, into the world's own rise to the ¾ view
      // (total pitch stays ≈ flat 3.0–4.0, then climbs: no bob).
      const lookDown = smoothstep(2.3, 2.97, t) * (1 - smoothstep(3.2, 4.8, t))
      const creep = smoothstep(2.3, 2.97, t) * (1 - bez(0.4, 0, 0.2, 1)(seg(t, BEAT.hit + 0.02, BEAT.hit + 0.5)))
      if (lookDown > 0) SC3D.nudgeCamera({ pitch: 5 * lookDown, dist: 1 - 0.04 * creep })

      // Tremble: amplitude grows with tension; pitch rises with it (integrated phase, no chirp)
      const slipKick = BEAT.slips.reduce((sum, time) => sum + decay(t - time, 0.09), 0)
      const tremble = t < BEAT.hit ? 0.016 * Math.pow(strain, 1.5) + 0.006 * slipKick * strain : 0
      let phase = 0
      if (tremble > 0) {
        const t0 = BEAT.tug
        const steps = Math.max(1, Math.ceil((t - t0) * 120))
        const h = Math.max(0, t - t0) / steps
        for (let i = 0; i < steps; i++) phase += (7 + 7 * strainAt(t0 + (i + 0.5) * h)) * h
      }

      // ── Letters
      const xs = letters.map((letter) => s.xOf(letter, t))
      letters.forEach((letter) => {
        const m = letter.mesh
        const x = xs[letter.index]
        let lean = s.leanTables[letter.index](t)
        let yLift = 0
        let rotY = 0
        if (letter.isExtra) {
          m.visible = t >= BEAT.drop
          const p = fallAt(t)
          yLift = tHeightAt(t)
          const sy = 1 + squashAt(t)
          const sxz = 1 / Math.sqrt(sy)
          m.scale.set(sxz, sy, sxz)
          rotY = t < BEAT.hit ? 16 * DEG * Math.pow(1 - p, 2) : 0
          lean += t < BEAT.hit ? -5 * DEG * Math.pow(1 - p, 2) : 0
          // impact: violet flash at the foot + the t's own glow
          const k = decay(t - BEAT.hit, 0.075)
          if (t >= BEAT.hit && k > 0.01) SC3D.flash(V(x, 0.06, zc + 0.06), { intensity: 0.85 * k, size: 1.0 })
          s.violet.emissive.set('#6B63FF').multiplyScalar(0.55 * k + (t >= BEAT.clack ? 0.35 * decay(t - BEAT.clack, 0.06) : 0))
        } else {
          m.visible = true
          m.scale.set(1, 1, 1)
          lean += 0.45 * DEG * letter.weight * (tremble / 0.016) * Math.sin(2 * Math.PI * 13.5 * t + letter.index * 1.7)
        }
        // unthreading jiggle as the tail whips through
        const pass = s.passTimes[letter.index]
        if (pass !== null && t >= pass) {
          rotY += 4 * DEG * ring(t - pass, 0.11, 6.5)
          lean += 1.6 * DEG * ring(t - pass - 0.01, 0.1, 6.5)
        }
        // lean about the heel (lean > 0) or the toe (lean < 0) so the letter never sinks
        const pivotX = lean >= 0 ? x + letter.spanL * 0.92 : x + letter.spanR * 0.92
        const dx = x - pivotX
        m.position.set(pivotX + dx * Math.cos(lean), dx * Math.sin(lean) + yLift + sink, zc)
        m.rotation.set(0, rotY, lean)
        const sh = letter.shadow
        sh.position.set(x, 0.002, zc)
        sh.visible = !letter.isExtra || t >= BEAT.hit
        sh.material.opacity = 0.4 * (1 - dim) * lightUp
      })
      // the t's anticipation shadow: a soft blob that tightens and darkens as it falls
      {
        const h = tHeightAt(t)
        const sh = s.extraShadow
        sh.visible = t >= BEAT.shadow && t < BEAT.hit
        const spread = 1 + h * 0.7
        sh.position.set(xs[TX.index], 0.0025, zc + 0.02)
        sh.scale.set(TX.width * 1.7 * spread, 0.34 * spread, 1)
        sh.material.opacity = (0.85 * smoothstep(BEAT.shadow, BEAT.hit - 0.05, t)) / (1 + 0.45 * h)
      }

      // ── Pins
      const pinRx = s.pinRX(t)
      const freeKickR = 9 * DEG * ring(t - BEAT.free, 0.14, 4.2) + 6 * DEG * ring(t - s.pinPassR, 0.12, 4.5)
      const freeKickL = -8 * DEG * ring(t - s.pinPassL, 0.13, 4.4)
      s.pinL.position.set(s.pinLX, sink, zc)
      s.pinL.rotation.set(0, 0, s.tiltL(t) + freeKickL + 0.3 * DEG * (tremble / 0.016) * Math.sin(2 * Math.PI * 11 * t))
      s.pinR.position.set(pinRx, sink, zc)
      s.pinR.rotation.set(0, 0, s.tiltR(t) - freeKickR)
      s.pinShadows[0].position.set(s.pinLX, 0.002, zc)
      s.pinShadows[1].position.set(pinRx, 0.002, zc)
      for (const sh of s.pinShadows) sh.material.opacity = 0.45 * (1 - dim) * lightUp

      // ── Dimming as the camera cranes away (the key follows the band east)
      // ... and at the very start the letters rise out of the dark with the key.
      const keep = (1 - 0.97 * dim) * lerp(0.3, 1, lightUp)
      const keepEnv = (1 - dim) * lerp(0.15, 1, lightUp * lightUp)
      const specular = Math.max(0.02, 1 - dim)
      for (const [mat, ref] of [[s.pearl, s.base.pearl], [s.violet, s.base.violet], ...s.pinMaterials.map((pm) => [pm.material, pm])]) {
        mat.color.copy(ref.color).multiplyScalar(keep)
        mat.envMapIntensity = ref.env * keepEnv
        if (mat.isMeshPhysicalMaterial) {
          mat.clearcoat = specular // stays > 0: no shader recompile
          mat.specularIntensity = specular
        }
      }
      s.pearl.emissiveIntensity = 0.015 * lightUp * (1 - dim)

      // ── The band
      s.glints.forEach((g) => (g.visible = false))
      if (drivesBand) {
        const bandMat = band.mesh.material
        let points
        let radiusAt
        if (t < BEAT.free) {
          const path = t >= 3.7 ? s.restPath : s.letterPath(xs, pinRx, t >= BEAT.hit)
          const pts = path.pts.map((p) => p.clone())
          const { gapA, gapB } = path
          const gapLen = Math.max(0.01, gapB - gapA)
          // the ripple kicked out along the band by the landing
          let sT = null
          if (t >= BEAT.hit && t < BEAT.hit + 0.9) {
            let best = Infinity
            const xT = xs[TX.index]
            path.pts.forEach((p, i) => {
              const d = Math.abs(p.x - xT) + Math.abs(p.z - zc) * 0.3
              if (d < best) {
                best = d
                sT = path.s[i]
              }
            })
          }
          const phi = 2 * Math.PI * phase
          for (let i = 0; i < pts.length; i++) {
            const si = path.s[i]
            const p = pts[i]
            if (tremble > 0 && si > gapA && si < gapB) {
              // standing-wave tremble on the free span
              const u = (si - gapA) / gapLen
              let up = 0
              let side = 0
              for (let mode = 1; mode <= 3; mode++) {
                const shape = Math.sin(mode * Math.PI * u) / mode
                up += shape * Math.sin(phi * (1 + 0.41 * (mode - 1)) + mode * 1.3)
                side += shape * Math.sin(phi * 1.13 * (1 + 0.37 * (mode - 1)) + mode * 2.1)
              }
              p.y += up * tremble
              p.z += side * tremble * 0.8
            }
            if (sT !== null) {
              const tau = t - BEAT.hit
              const d = Math.abs(si - sT)
              if (d < 3.6 * tau) {
                const w = Math.exp(-tau / 0.16) * Math.exp(-d / 0.9)
                const arg = 2 * Math.PI * (11 * tau - d / 0.33)
                p.y += 0.016 * w * Math.sin(arg)
                p.z += 0.01 * w * Math.cos(arg)
              }
            }
          }
          // radius: the free span thins by the world's law; it bulges as it snaps back
          const rGapStretch = SC3D.bandRadius(gapLen, GAP_REST, R0)
          const snapBulge = t >= BEAT.hit ? 0.18 * ring(t - BEAT.clack, 0.07, 6) : 0
          const rGap = Math.min(R0, rGapStretch) * (1 + snapBulge)
          const total = path.length
          const radiusAtS = (si) => {
            const inside = smoothstep(gapA - 0.02, gapA + 0.1, si) * (1 - smoothstep(gapB - 0.1, gapB + 0.02, si))
            return lerp(R0, rGap, inside)
          }
          radiusAt = (u) => radiusAtS(u * total)
          for (let i = 0; i < pts.length; i++) {
            const r = radiusAtS(path.s[i])
            if (pts[i].y < r + 0.002) pts[i].y = r + 0.002 // never through the floor
          }
          points = resample(pts, path.s, 0, total, 150)
          // creaks of light: a glint runs along the free span at each slip
          if (t < BEAT.hit) {
            s.glints.forEach((g, k) => {
              const time = BEAT.slips[k + (t > BEAT.slips[2] - 0.05 ? 2 : 0)]
              const p = seg(t, time, time + 0.16)
              if (p <= 0 || p >= 1) return
              g.visible = true
              g.position.copy(pointAt(pts, path.s, lerp(gapB, gapA, bez(0.2, 0.6, 0.4, 1)(p))))
              g.material.opacity = 0.95 * Math.sin(Math.PI * p) * (0.35 + 0.65 * strain)
              g.scale.set(0.34, 0.06, 1)
            })
          }
          // tension glow: the band warms as it strains, flickers on each slip, flares on the hit
          const glow = 0.05 + 0.3 * strain * strain + 0.25 * slipKick * strain + (t >= BEAT.hit ? 0.35 * decay(t - BEAT.hit, 0.08) : 0)
          bandMat.emissive.set('#6B63FF').multiplyScalar(glow * lightUp)
        } else {
          // ── Free: a rope pulled along [letters path + route]
          const head = s.headS(t)
          const tail = s.tailS(t)
          const length = Math.max(0.05, head - tail)
          // radius: from the letters' law to s2's law (exact at the hand-off)
          // (a thin fast streak in flight; it gathers and thickens as it contracts onto the hook)
          const r = lerp(SC3D.bandRadius(length, s.restPath.length, R0), SC3D.bandRadius(length, 2.0, 0.045), smoothstep(5.8, 6.78, t))
          const { pts, sAll } = composePath(s, r)
          points = resample(pts, sAll, tail, head, 150)
          // it flies: the free span lifts a little off the floor (its shadow separates), then lands
          const lift = 0.06 * smoothstep(5.45, 5.75, t) * (1 - smoothstep(6.25, 6.6, t))
          if (lift > 0) points.forEach((p, i) => (p.y += lift * Math.sin((Math.PI * i) / (points.length - 1))))
          radiusAt = r
          bandMat.emissive.set('#6B63FF').multiplyScalar(0.05 + 0.2 * decay(t - BEAT.free, 0.12))
        }
        band.update(points, radiusAt)
      }

      // ── Annotation: tracks the t through the ¾ arc
      const anchor = SC3D.toScreen(V(xs[TX.index], TX.height + 0.05, zc), t)
      const draw = bez(0.2, 0.8, 0.3, 1)(seg(t, BEAT.labelIn, BEAT.labelIn + 0.28)) * (1 - bez(0.6, 0, 0.9, 0.5)(seg(t, BEAT.labelOut, BEAT.labelOut + 0.18)))
      const end = { x: anchor.x + 118, y: anchor.y - 196 }
      api.setAttrs(s.leader, {
        x1: api.round(anchor.x, 1), y1: api.round(anchor.y, 1),
        x2: api.round(lerp(anchor.x, end.x, draw), 1), y2: api.round(lerp(anchor.y, end.y, draw), 1),
        opacity: api.round(0.78 * Math.min(1, draw * 4), 3),
      })
      const dotIn = seg(t, BEAT.labelIn - 0.02, BEAT.labelIn + 0.08) * (1 - seg(t, BEAT.labelOut + 0.14, BEAT.labelOut + 0.22))
      api.setAttrs(s.dot, { cx: api.round(anchor.x, 1), cy: api.round(anchor.y, 1), opacity: api.round(0.9 * dotIn, 3), r: api.round(4 * (0.6 + 0.4 * dotIn), 2) })
      api.setStyle(s.label, { transform: `translate(${api.round(end.x + 16, 1)}px, ${api.round(end.y - 64, 1)}px)` })
      s.words.forEach((word, i) => {
        const start = BEAT.labelIn + 0.04 + i * 0.05
        const inP = seg(t, start, start + 0.26)
        const outP = seg(t, BEAT.labelOut + i * 0.03, BEAT.labelOut + 0.16 + i * 0.03)
        const opacity = SC.ease.outCubic(inP) * (1 - SC.ease.inCubic(outP))
        const y = 22 * (1 - bez(0.16, 1, 0.3, 1)(inP)) - 12 * SC.ease.inCubic(outP)
        api.setStyle(word, { opacity: String(api.round(opacity, 3)), transform: `translateY(${api.round(y, 2)}px)` })
      })

      function pointAt(pts, sArr, sv) {
        let i = 1
        while (i < sArr.length - 1 && sArr[i] < sv) i++
        const a = sArr[i - 1]
        const b = sArr[i]
        return pts[i - 1].clone().lerp(pts[i], b > a ? clamp((sv - a) / (b - a)) : 0)
      }
      function resample(pts, sArr, from, to, count) {
        const out = []
        let i = 1
        for (let k = 0; k < count; k++) {
          const sv = lerp(from, to, k / (count - 1))
          while (i < sArr.length - 1 && sArr[i] < sv) i++
          const a = sArr[i - 1]
          const b = sArr[i]
          out.push(pts[i - 1].clone().lerp(pts[i], b > a ? clamp((sv - a) / (b - a)) : 0))
        }
        return out
      }
      function composePath(state, r) {
        const letterPts = state.restPath.pts
        const pts = letterPts.slice()
        const sAll = Array.from(state.restPath.s)
        const { routePts, routeS, routeSurface, routeFixedY, routeEndBlend, SR } = state
        const startY = letterPts[letterPts.length - 1].y
        for (let i = 1; i < routePts.length; i++) {
          const p = routePts[i]
          const free = lerp(startY, routeSurface[i] + r + 0.003, smoothstep(0, 0.45, routeS[i]))
          pts.push(new THREE.Vector3(p.x, lerp(free, routeFixedY[i], routeEndBlend[i]), p.z))
          sAll.push(SR + routeS[i])
        }
        return { pts, sAll }
      }
    },
  })
})()
