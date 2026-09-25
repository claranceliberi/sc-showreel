// s01-stretch · 0.000–4.750 · z 10
//
// NAME, then WHAT IT IS. The dictionary word "stretch" (Inter var) rises, slams to Black on the
// downbeat and is pulled until it tears. The extra violet t (the real wordmark letter 5) drops
// into the gap, and on impact the word re-sets as the REAL strettch wordmark, recoiling shut.
// "the extra push." annotates it, "cloud" bounces up, the camera leans in and pulls back, then
// "strettch" drops out and "Africa-first" rises in its place so the line reads
// "Africa-first cloud." — whose period (drawn by s02 from 3.250) becomes Kigali. The line then
// sinks and the hairline reels into Kigali.
//
// Layers (bottom → top):
//   hairline  screen-space SVG polyline (stroke never scaled by the camera; ends and y follow it)
//   plane     1920×1080 div, transform-origin 0 0, driven by camera(t)
//     ├ Inter "stretch" glyphs          (clipped to plane y < 606)
//     ├ createLogo wordmark + extrusion (clipped to plane y < 606)
//     ├ annotation: leader + serif line
//     └ Inter 800 "Africa-first" glyphs (clipped to plane y < 606)
//
// Ownership: s01 never draws the period / Kigali dot (s02 owns it from 3.250).
//
// Revision 2 event times (sound sync):
//   0.750        the pull starts (strain: thinning, lag, growing tremble); taut at 1.400 (twang)
//   1.250–1.500  the extra t falls; impact at 1.500 (unchanged, locked to the audio hit + shake)
//   1.95–2.58    hold drift: camera pushes in 1.35 % about (958.8, 396.1), ≤ 0.4 px/frame
//   2.58–2.76    anticipation: the push leans in a further 1.3 %, then stops dead at 2.76
//   2.76–3.05    camera pull-back to u = 8 (quintic in-out, peak 25 px/frame at 2.905)
//   3.000–3.104  "strettch" drops out as one word (inCubic, 0.002 s L→R stagger)
//   3.095–3.343  "Africa-first" rises, glyph i from 3.095 + 0.008·i (reads settled by ~3.26)
//   3.05–4.60    hold drift: the line pushes in 1 % about Kigali (the period stays attached)
//   4.380–4.540  the line sinks; the hairline reels into Kigali and is gone from 4.540
const EXIT_START = 4.38
const EXIT_STAGGER = 0.003
const EXIT_DURATION = 0.14
const HAIRLINE_REEL = 0.16 // hairline gone at EXIT_START + 0.16 = 4.540, before s02's odometer rises (4.55)

// The swap: strettch leaves as a whole word before any "Africa-first" glyph rises over it.
const SWAP_OUT = 3.0
const SWAP_OUT_STAGGER = 0.002
const SWAP_OUT_DURATION = 0.09
const SWAP_IN = 3.095
const SWAP_IN_STAGGER = 0.008
const SWAP_IN_DURATION = 0.16

// The pull.
const PULL_START = 0.75
const PULL_END = 1.4

// Camera. Zoom about P for the push / lean / pull-back, then a slow push about K (Kigali, the
// period s02 draws) so the period never detaches from "cloud".
const CAMERA_PIVOT = { x: 958.8, y: 396.1 }
const KIGALI = { x: 1560, y: 530 }
const PULLED_SCALE = 8 / 11
const LEAN_PEAK = 2.76
const PULL_BACK_END = 3.05
const smootherstep = (u) => u * u * u * (u * (u * 6 - 15) + 10)
// [time, scale, slope (1/s)] cubic-Hermite keys (C1), the last segment eased with smootherstep.
const CAMERA_KEYS = [
  [1.95, 1, 0],
  [2.58, 1.0135, 0.03], // hold drift (edges ≤ 0.4 px/frame)
  [LEAN_PEAK, 1.0265, 0], // anticipation: lean in, stop
  [PULL_BACK_END, PULLED_SCALE, 0, smootherstep], // pull back to u = 8
]
const SECOND_DRIFT = 0.01 // ≤ 0.25 px/frame; "Africa-first" ends ~13 px left of s02's x-131 HUD grid

SC.scene({
  id: 's01-stretch',
  start: 0.0,
  end: 4.75,
  z: 10,

  build(root, api) {
    const { el, svg, tokens, createLogo } = api
    const PAPER = tokens.paper
    const VIOLET = tokens.violet
    const VIOLET_LIGHT = tokens.violetLight
    const VIOLET_DARK = tokens.violetDark

    // ---- Geometry (storyboard px) ----------------------------------------------------------
    const MASK_EDGE = 606 // plane y; every glyph layer is clipped above it
    const U = 11 // logo units → px inside the plane (createLogo height 352)
    const LOGO_LEFT = -297.52
    const LOGO_TOP = 353.05

    // A full-plane SVG layer whose content may spill outside the 1920×1080 box.
    const makeLayer = (parent) => {
      const layer = svg('svg', { width: 1920, height: 1080, viewBox: '0 0 1920 1080', overflow: 'visible' }, parent)
      Object.assign(layer.style, { position: 'absolute', left: '0px', top: '0px', overflow: 'visible' })
      return layer
    }
    // Clip region "everything above edgeY" (unbounded in practice on the other three sides).
    const makeClipAbove = (layer, id, edgeY) => {
      const defs = svg('defs', {}, layer)
      const clip = svg('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, defs)
      svg('rect', { x: -10000, y: -10000, width: 20000, height: 10000 + edgeY }, clip)
      return `url(#${id})`
    }

    // ---- Hairline (screen space, under the plane) ------------------------------------------
    const hairlineLayer = makeLayer(root)
    const hairline = svg('polyline', {
      points: '960,600 960,600',
      fill: 'none',
      stroke: VIOLET_LIGHT,
      'stroke-width': 2,
      'stroke-opacity': 0.7,
      'stroke-linecap': 'butt',
      'stroke-linejoin': 'round',
      display: 'none',
    }, hairlineLayer)

    // ---- Type plane --------------------------------------------------------------------------
    const plane = el('div', {
      style: { position: 'absolute', left: '0px', top: '0px', width: '1920px', height: '1080px', transformOrigin: '0 0', overflow: 'visible' },
    }, root)

    // (a) Inter "stretch": 7 single-glyph <text>, text-anchor middle, placed by transform so the
    // centres never move with weight (the width lock).
    const stretchLayer = makeLayer(plane)
    const stretchGroup = svg('g', { 'clip-path': makeClipAbove(stretchLayer, 's01-clip-stretch', MASK_EDGE) }, stretchLayer)
    const stretchGlyphs = [...'stretch'].map((character) => {
      const node = svg('text', {
        x: 0, y: 0, 'text-anchor': 'middle', fill: PAPER, 'font-family': 'Inter', 'font-size': 220, display: 'none',
      }, stretchGroup)
      node.textContent = character
      return node
    })

    // (b) The real wordmark at u = 11: the s starts at x 171.96 and the baseline sits on y 600.
    const logo = createLogo(plane, { height: 352 })
    Object.assign(logo.root.style, { position: 'absolute', left: `${LOGO_LEFT}px`, top: `${LOGO_TOP}px`, overflow: 'visible' })
    logo.markGroup.setAttribute('display', 'none')
    // Mask edge in logo units: (606 − 353.05) / 11.
    const clipGroup = svg('g', { 'clip-path': makeClipAbove(logo.root, 's01-clip-logo', (MASK_EDGE - LOGO_TOP) / U) }, logo.root)
    // (c) The impact extrusion sits behind the letters: stacked violetDark copies of letters 0–7
    // stepping out to (+9, +9) px, so it reads as a solid slab of depth rather than a shadow.
    const extrusionGroup = svg('g', { display: 'none' }, clipGroup)
    clipGroup.appendChild(logo.wordmarkGroup)
    const letters = logo.letters.map((letter, index) => {
      const path = letter.path
      path.setAttribute('fill', index === 5 ? VIOLET : PAPER)
      path.setAttribute('display', 'none')
      path.style.transformBox = 'fill-box'
      path.style.transformOrigin = index === 5 ? '50% 100%' : '50% 50%'
      const home = ((letter.box.x0 + letter.box.x1) / 2) * U + LOGO_LEFT
      return { path, home }
    })
    const EXTRUSION_STEPS = 6
    const extrusion = []
    for (let step = EXTRUSION_STEPS; step >= 1; step--) {
      for (let index = 0; index < 8; index++) {
        const copy = svg('path', { d: logo.letters[index].d, fill: VIOLET_DARK }, extrusionGroup)
        copy.style.transformBox = 'fill-box'
        copy.style.transformOrigin = index === 5 ? '50% 100%' : '50% 50%'
        extrusion.push({ path: copy, index, depth: (9 * step) / EXTRUSION_STEPS })
      }
    }

    // (d) Annotation: leader from the violet t + "the extra push." (Instrument Serif italic 64).
    const noteLayer = makeLayer(plane)
    const noteClip = svg('clipPath', { id: 's01-clip-note', clipPathUnits: 'userSpaceOnUse' }, svg('defs', {}, noteLayer))
    const noteClipRect = svg('rect', { x: 570, y: 640, width: 0, height: 120 }, noteClip)
    const leader = svg('line', {
      x1: 746.27, y1: 612, x2: 746.27, y2: 612, stroke: VIOLET_LIGHT, 'stroke-width': 2, 'stroke-linecap': 'butt', display: 'none',
    }, noteLayer)
    const note = svg('text', {
      x: 746.27, y: 718, 'text-anchor': 'middle', fill: VIOLET_LIGHT,
      'font-family': 'Instrument Serif', 'font-style': 'italic', 'font-weight': 400, 'font-size': 64,
      'clip-path': 'url(#s01-clip-note)', display: 'none',
    }, noteLayer)
    note.textContent = 'the extra push.'

    // (e) "Africa-first", Inter 800 at 220.2 px, placed by cumulative (kerned) canvas advances
    // with the right edge of the word at plane x 1057.57 (the h's right edge) → left ≈ −177.4.
    const AFRICA = 'Africa-first'
    const AFRICA_SIZE = 220.2
    const measure = document.createElement('canvas').getContext('2d')
    measure.font = `800 ${AFRICA_SIZE}px Inter`
    const africaLeft = 1057.57 - measure.measureText(AFRICA).width
    const africaLayer = makeLayer(plane)
    const africaGroup = svg('g', { 'clip-path': makeClipAbove(africaLayer, 's01-clip-africa', MASK_EDGE) }, africaLayer)
    const africaGlyphs = [...AFRICA].map((character, index) => {
      const node = svg('text', {
        x: 0, y: 0, fill: PAPER, 'font-family': 'Inter', 'font-weight': 800, 'font-size': AFRICA_SIZE, display: 'none',
      }, africaGroup)
      node.textContent = character
      const x = africaLeft + measure.measureText(AFRICA.slice(0, index)).width
      const right = africaLeft + measure.measureText(AFRICA.slice(0, index + 1)).width
      return { node, x, right }
    })
    // WHOLE-WORD SWAP guard: an incoming glyph never starts rising until every strettch letter
    // under it (± 8 px of ink overhang) has fully sunk through the mask, plus a quarter-frame for
    // the renderer's shutter. With the timings above the guard never binds (the first glyph that
    // overlaps strettch, the i, starts at 3.119; the s under it is gone at 3.090), but it keeps the
    // swap clean if anyone retimes it.
    const outgoing = logo.letters.slice(0, 8).map((letter, index) => ({
      x0: letter.box.x0 * U + LOGO_LEFT - 8,
      x1: letter.box.x1 * U + LOGO_LEFT + 8,
      clear: SWAP_OUT + SWAP_OUT_STAGGER * index + SWAP_OUT_DURATION + 0.005,
    }))
    africaGlyphs.forEach((glyph, index) => {
      glyph.riseStart = SWAP_IN + SWAP_IN_STAGGER * index
      for (const letter of outgoing) {
        if (Math.min(glyph.right, letter.x1) - Math.max(glyph.x, letter.x0) > 0) glyph.riseStart = Math.max(glyph.riseStart, letter.clear)
      }
    })

    // ---- Springs (window = spring duration, so spring time is real seconds) ------------------
    const { spring } = api.ease
    const springs = {
      recoil: spring({ stiffness: 520, damping: 36.5, mass: 1, duration: 0.45 }),
      lightBounce: spring({ stiffness: 900, damping: 21, mass: 1, duration: 0.5 }),
      squashBack: spring({ stiffness: 900, damping: 21, mass: 1, duration: 0.3 }),
    }

    return { U, hairline, plane, stretchGlyphs, letters, extrusionGroup, extrusion, leader, note, noteClipRect, africaGlyphs, springs }
  },

  render(t, s, api) {
    const { ease, tween, progress, lerp, noise, setStyle, setAttrs, round } = api
    const { snappy } = ease
    const { U } = s
    const BASELINE = 600
    const DEPTH = 175 // rise / sink depth, plane px
    const rise = (start, duration) => tween(t, start, start + duration, DEPTH, 0, snappy)
    const sink = (start, duration, easing = ease.swift) => tween(t, start, start + duration, 0, DEPTH, easing)
    const show = (node, visible) => setAttrs(node, { display: visible ? 'inline' : 'none' })
    const r3 = (value) => round(value, 3)
    // The 1.50 impact is a hard state change (Inter → wordmark, squash, extrusion). It flips a
    // hair before 1.500 so that under the renderer's centred 180° shutter (±¼ frame) frame 1.500
    // is entirely post-impact and 1.483 entirely pre-impact: a clean cut, never a one-frame
    // blend of the two type states. Every continuous motion still starts at exactly 1.500.
    const IMPACT = 1.5 - 0.3 / 60
    const SQUASH_END = 1.5 + 2 / 60 // squash holds frames 1.500 and 1.517
    const EXTRUSION_END = 1.5 + 1.7 / 60 // the 2-frame extrusion (frames 1.500, 1.517)

    // ---- Camera --------------------------------------------------------------------------------
    // Stage 1 (≤ 3.05): scale about P through CAMERA_KEYS — identity until 1.95, a slow push-in
    // through the "strettch cloud" hold, a small lean-in (anticipation) that stops at 2.76, then
    // a quintic pull-back to u = 8 landing at 3.05 (the storyboard's end framing, exactly).
    // Stage 2 (≥ 3.05): a 1 % push about Kigali while "Africa-first cloud." reads, so the frame
    // never freezes and the period (s02's Kigali dot, at the pivot) stays glued to the line.
    const camera = (() => {
      let scale = CAMERA_KEYS[0][1]
      if (t >= CAMERA_KEYS[CAMERA_KEYS.length - 1][0]) scale = CAMERA_KEYS[CAMERA_KEYS.length - 1][1]
      else {
        for (let index = 1; index < CAMERA_KEYS.length; index++) {
          const [t1, v1, m1, easing] = CAMERA_KEYS[index]
          if (t > t1) continue
          const [t0, v0, m0] = CAMERA_KEYS[index - 1]
          if (t <= t0) break
          const h = t1 - t0
          const u = (t - t0) / h
          if (easing) scale = lerp(v0, v1, easing(u))
          else {
            const u2 = u * u
            const u3 = u2 * u
            scale = (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * h * m0 + (3 * u2 - 2 * u3) * v1 + (u3 - u2) * h * m1
          }
          break
        }
      }
      const push = 1 + SECOND_DRIFT * ease.smooth(progress(t, PULL_BACK_END, 4.6))
      const tx = CAMERA_PIVOT.x * (1 - scale)
      const ty = CAMERA_PIVOT.y * (1 - scale)
      return {
        scale: push * scale,
        tx: KIGALI.x + push * (tx - KIGALI.x),
        ty: KIGALI.y + push * (ty - KIGALI.y),
        // 0 → 1 across the pull-back only (drives the hairline's retracting ends).
        pull: smootherstep(progress(t, LEAN_PEAK, PULL_BACK_END)),
      }
    })()
    setStyle(s.plane, {
      transform: t < CAMERA_KEYS[0][0] ? 'none' : `translate(${r3(camera.tx)}px, ${r3(camera.ty)}px) scale(${round(camera.scale, 6)})`,
    })

    // ---- Hairline ------------------------------------------------------------------------------
    // Its ends are plane points (they retract from x 96 / 1824 to −206.6 / 1765.6 during the
    // pull-back, i.e. screen 111.2 / 1545.6 at u = 8, the Kigali dot's left edge) mapped through
    // the camera; y is the camera-mapped baseline so the rule always sits exactly under the type.
    {
      let planeLeft = lerp(96, -206.6, camera.pull)
      let planeRight = lerp(1824, 1765.6, camera.pull)
      if (t < 0.2) {
        const grow = snappy(progress(t, 0, 0.2))
        planeLeft = 960 - 864 * grow
        planeRight = 960 + 864 * grow
      }
      let left = camera.tx + camera.scale * planeLeft
      const right = camera.tx + camera.scale * planeRight
      const y = camera.ty + camera.scale * BASELINE
      // Reels into Kigali as the line sinks; gone before s02's odometer rises under it (4.55).
      if (t >= EXIT_START) left = lerp(left, right, ease.inCubic(progress(t, EXIT_START, EXIT_START + HAIRLINE_REEL)))
      let points
      if (t >= 1.5 && t < 2.2) {
        // Plucked on the impact: a decaying 7 Hz standing wave, 97-point polyline.
        const tau = t - 1.5
        const amplitude = 10 * Math.exp(-6 * tau) * Math.sin(2 * Math.PI * 7 * tau)
        const list = []
        for (let index = 0; index <= 96; index++) {
          const x = lerp(left, right, index / 96)
          list.push(`${round(x, 2)},${round(y + amplitude * Math.sin((Math.PI * index) / 96), 2)}`)
        }
        points = list.join(' ')
      } else {
        points = `${r3(left)},${r3(y)} ${r3(right)},${r3(y)}`
      }
      setAttrs(s.hairline, { points, display: t < EXIT_START + HAIRLINE_REEL && right - left > 0.05 ? 'inline' : 'none' })
    }

    // ---- (a) Inter "stretch" 0.20–1.50 ---------------------------------------------------------
    // The pull runs 0.75–1.40: the ends lead and the inner glyphs lag (LAG), the type thins
    // (wght 900 → 300) and stretches (scaleX, strongest either side of the tear) ahead of the
    // travel, and a tremble grows with the tension. At 1.40 the band goes taut: the glyphs twang
    // outward once and hold, trembling, until the 1.500 impact.
    const REST = [620, 728, 820, 935, 1045, 1156, 1293]
    const PULLED = [185, 290, 385, 505, 640, 1590, 1735]
    const LAG = [0, 0.05, 0.1, 0.13, 0.16, 0.05, 0]
    const STRAIN = [0.85, 0.9, 1.0, 1.1, 1.3, 1.3, 1.05]
    {
      const visible = t >= 0.2 && t < IMPACT
      const slam = ease.outExpo(progress(t, 0.5, 0.68))
      const tension = Math.pow(progress(t, 0.72, PULL_END), 1.3)
      s.stretchGlyphs.forEach((node, index) => {
        show(node, visible)
        if (!visible) return
        const amount = progress(t, PULL_START + LAG[index], PULL_END)
        const pull = amount * amount // constant force: visible from the first frames, then gives
        const thin = Math.pow(amount, 1.25) // the stroke thins ahead of the travel
        let x = lerp(REST[index], PULLED[index], pull) + 2.4 * tension * noise(t * 42, index)
        if (t >= PULL_END) {
          const tau = t - PULL_END
          x += Math.sign(PULLED[index] - REST[index]) * 7 * Math.exp(-tau / 0.035) * Math.sin(2 * Math.PI * 14 * tau)
        }
        const y = BASELINE + rise(0.2 + 0.02 * index, 0.2) + 0.8 * tension * noise(t * 37, index + 20)
        const weight = lerp(lerp(100, 900, slam), 300, thin)
        const scaleX = 1 + 0.25 * STRAIN[index] * thin
        const scaleY = 1 - 0.035 * thin
        setAttrs(node, { transform: `translate(${r3(x)} ${r3(y)}) scale(${r3(scaleX)} ${r3(scaleY)})` })
        setStyle(node, { fontWeight: String(round(weight, 1)) })
      })
    }

    // ---- (b) Wordmark letters ------------------------------------------------------------------
    // Pulled centre of each strettch letter (the violet t, index 5, falls in at home instead).
    const pulledFor = (index) => (index < 5 ? PULLED[index] : PULLED[index - 1])
    const recoilAmount = s.springs.recoil(progress(t, 1.5, 1.95))
    const swapOutStart = (index) => SWAP_OUT + SWAP_OUT_STAGGER * index
    const swapOutEnd = (index) => swapOutStart(index) + SWAP_OUT_DURATION
    const transforms = []
    s.letters.forEach((letter, index) => {
      let visible
      let dx = 0
      let dy = 0
      let scaleX = 1
      let scaleY = 1
      if (index === 5) {
        // THE EXTRA T: gravity drop #1, lands on the 1.50 impact.
        visible = t >= 1.25 && t < swapOutEnd(5)
        if (t < IMPACT) {
          const fall = progress(t, 1.25, 1.5)
          dy = tween(t, 1.25, 1.5, -640, 0, 'inQuad')
          scaleY = 1 + 0.22 * fall // stretches as it accelerates
          scaleX = 1 - 0.1 * fall
        } else if (t < SQUASH_END) {
          scaleY = 0.72
          scaleX = 1.28
        } else {
          const back = s.springs.squashBack(progress(t, SQUASH_END, SQUASH_END + 0.3))
          scaleY = lerp(0.72, 1, back)
          scaleX = lerp(1.28, 1, back)
        }
        dy += sink(swapOutStart(5), SWAP_OUT_DURATION, ease.inCubic)
      } else if (index < 8) {
        visible = t >= IMPACT && t < swapOutEnd(index)
        dx = (pulledFor(index) - letter.home) * (1 - recoilAmount)
        // Impact shockwave travelling outward from the t.
        const tau = t - 1.5 - 0.025 * Math.abs(index - 5)
        if (tau >= 0 && tau <= 0.12) dy -= 14 * Math.sin((Math.PI * tau) / 0.12)
        // The whole word drops out together (inCubic: it visibly starts moving at 3.00).
        dy += sink(swapOutStart(index), SWAP_OUT_DURATION, ease.inCubic)
      } else {
        // "cloud" bounces up (light glyphs), then sinks with "Africa-first" at EXIT_START.
        const order = 12 + (index - 8)
        visible = t >= 1.75 && t < EXIT_START + EXIT_STAGGER * order + EXIT_DURATION
        const start = 1.75 + 0.02 * (index - 8)
        dy = tween(t, start, start + 0.5, DEPTH, 0, s.springs.lightBounce) + sink(EXIT_START + EXIT_STAGGER * order, EXIT_DURATION)
      }
      transforms[index] = { dx, dy, scaleX, scaleY }
      show(letter.path, visible)
      if (visible) {
        setStyle(letter.path, { transform: `translate(${r3(dx / U)}px, ${r3(dy / U)}px) scale(${r3(scaleX)}, ${r3(scaleY)})` })
      }
    })

    // ---- (c) Impact extrusion: 2 frames --------------------------------------------------------
    {
      const visible = t >= IMPACT && t < EXTRUSION_END
      show(s.extrusionGroup, visible)
      if (visible) {
        for (const { path, index, depth } of s.extrusion) {
          const { dx, dy, scaleX, scaleY } = transforms[index]
          setStyle(path, { transform: `translate(${r3((dx + depth) / U)}px, ${r3((dy + depth) / U)}px) scale(${r3(scaleX)}, ${r3(scaleY)})` })
        }
      }
    }

    // ---- (d) Annotation ------------------------------------------------------------------------
    {
      const draw = ease.outCubic(progress(t, 1.52, 1.6))
      const retract = ease.inCubic(progress(t, 2.79, 2.85))
      const leaderEnd = 612 + 48 * (draw - retract)
      setAttrs(s.leader, { y2: r3(leaderEnd), display: leaderEnd - 612 > 0.05 ? 'inline' : 'none' })
      // Wipes on left → right (reveal) and off right → left (inCubic). The clip spans the italic.
      const on = snappy(progress(t, 1.58, 1.72))
      const off = ease.inCubic(progress(t, 2.75, 2.82))
      const width = 352 * on * (1 - off)
      setAttrs(s.noteClipRect, { width: r3(width) })
      show(s.note, width > 0.05)
    }

    // ---- (e) "Africa-first" 3.09–4.73 (rise starts: see the swap guard in build) ---------------
    s.africaGlyphs.forEach(({ node, x, riseStart }, index) => {
      const visible = t >= riseStart && t < EXIT_START + EXIT_STAGGER * index + EXIT_DURATION
      show(node, visible)
      if (!visible) return
      const y = BASELINE + rise(riseStart, SWAP_IN_DURATION) + sink(EXIT_START + EXIT_STAGGER * index, EXIT_DURATION)
      setAttrs(node, { transform: `translate(${r3(x)} ${r3(y)})` })
    })
  },
})
