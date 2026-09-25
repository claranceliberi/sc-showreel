// s01-stretch · 0.000–4.750 · z 10
//
// NAME, then WHAT IT IS. The dictionary word "stretch" (Inter var) rises, slams to Black on the
// downbeat and is pulled until it tears. The extra violet t (the real wordmark letter 5) drops
// into the gap, and on impact the word re-sets as the REAL strettch wordmark, recoiling shut.
// "the extra push." annotates it, "cloud" bounces up, and on a camera pull-back "strettch"
// swaps out for "Africa-first" so the line reads "Africa-first cloud." — whose period (drawn
// by s02 from 3.250) becomes Kigali. The line then sinks and the hairline reels into Kigali.
//
// Layers (bottom → top):
//   hairline  screen-space SVG polyline (never scaled by the camera)
//   plane     1920×1080 div, transform-origin 0 0; its transform animates only 3.00–3.25
//     ├ Inter "stretch" glyphs          (clipped to plane y < 606)
//     ├ createLogo wordmark + extrusion (clipped to plane y < 606)
//     ├ annotation: leader + serif line
//     └ Inter 800 "Africa-first" glyphs (clipped to plane y < 606)
//
// Ownership: s01 never draws the period / Kigali dot (s02 owns it from 3.250).
// The storyboard exits "Africa-first cloud" at 4.50, but with the slow-start swift ease it stayed
// printed over s02's rising "~110" odometer (same baseline) until ~4.70. Exiting from 4.38 clears
// the baseline by ~4.57 and still leaves the line >1 s of settled reading time (3.30–4.38).
const EXIT_START = 4.38
const EXIT_STAGGER = 0.003
const EXIT_DURATION = 0.14

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
    // with the right edge of the word at plane x 1057.57 (the h's right edge) → left ≈ −179.0.
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
    // ANCHOR SWAP chase (deviation, see report): an incoming glyph never rises over an outgoing
    // strettch letter that is still standing. Glyph i starts at max(3.100 + 0.010·i, the moment
    // every strettch letter under it is 70% through its sink, i.e. already falling fast), so the
    // swap reads as one clean L→R domino wave behind the camera pull-back instead of a double
    // exposure. The last glyph starts at 3.210 and is settled (< 2 px/frame) by 3.300.
    const outgoing = logo.letters.slice(0, 8).map((letter, index) => ({
      x0: letter.box.x0 * U + LOGO_LEFT, x1: letter.box.x1 * U + LOGO_LEFT, clear: 3.0 + 0.015 * index + 0.7 * 0.15,
    }))
    africaGlyphs.forEach((glyph, index) => {
      glyph.riseStart = 3.1 + 0.01 * index
      for (const letter of outgoing) {
        if (Math.min(glyph.right, letter.x1) - Math.max(glyph.x, letter.x0) > 2) glyph.riseStart = Math.max(glyph.riseStart, letter.clear)
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
    const { snappy, swift } = ease
    const { U } = s
    const BASELINE = 600
    const DEPTH = 175 // rise / sink depth, plane px
    const rise = (start, duration) => tween(t, start, start + duration, DEPTH, 0, snappy)
    const sink = (start, duration) => tween(t, start, start + duration, 0, DEPTH, swift)
    const show = (node, visible) => setAttrs(node, { display: visible ? 'inline' : 'none' })
    const r3 = (value) => round(value, 3)
    // The 1.50 impact is a hard state change (Inter → wordmark, squash, extrusion). It flips a
    // hair before 1.500 so that under the renderer's centred 180° shutter (±¼ frame) frame 1.500
    // is entirely post-impact and 1.483 entirely pre-impact: a clean cut, never a one-frame
    // blend of the two type states. Every continuous motion still starts at exactly 1.500.
    const IMPACT = 1.5 - 0.3 / 60
    const SQUASH_END = 1.5 + 2 / 60 // squash holds frames 1.500 and 1.517
    const EXTRUSION_END = 1.5 + 1.7 / 60 // the 2-frame extrusion (frames 1.500, 1.517)

    // ---- Camera pull-back 3.00–3.25: scales about (958.8, 396.1) down to u = 8 ----------------
    const camera = snappy(progress(t, 3.0, 3.25))
    setStyle(s.plane, {
      transform: t < 3.0 ? 'none' : `translate(${r3(261.5 * camera)}px, ${r3(108.04 * camera)}px) scale(${round(1 - (3 / 11) * camera, 5)})`,
    })

    // ---- Hairline ------------------------------------------------------------------------------
    {
      let left = 96
      let right = 1824
      if (t < 0.2) {
        const grow = snappy(progress(t, 0, 0.2))
        left = 960 - 864 * grow
        right = 960 + 864 * grow
      }
      if (t >= 3.0) {
        left = lerp(96, 111.2, camera)
        right = lerp(1824, 1545.6, camera)
      }
      if (t >= 4.5) left = lerp(111.2, 1545.6, ease.inCubic(progress(t, 4.5, 4.7)))
      const y = 600 - 55.6 * camera
      let points
      if (t >= 1.5 && t < 2.2) {
        // Plucked on the impact: a decaying 7 Hz standing wave, 97-point polyline.
        const tau = t - 1.5
        const amplitude = 10 * Math.exp(-6 * tau) * Math.sin(2 * Math.PI * 7 * tau)
        const list = []
        for (let index = 0; index <= 96; index++) {
          const x = 96 + index * 18
          list.push(`${x},${round(600 + amplitude * Math.sin((Math.PI * (x - 96)) / 1728), 2)}`)
        }
        points = list.join(' ')
      } else {
        points = `${r3(left)},${r3(y)} ${r3(right)},${r3(y)}`
      }
      setAttrs(s.hairline, { points, display: t < 4.7 && right - left > 0.05 ? 'inline' : 'none' })
    }

    // ---- (a) Inter "stretch" 0.20–1.50 ---------------------------------------------------------
    const REST = [620, 728, 820, 935, 1045, 1156, 1293]
    const PULLED = [185, 290, 385, 505, 640, 1590, 1735]
    const LAG = [0, 0.03, 0.06, 0.08, 0.1, 0.03, 0]
    {
      const visible = t >= 0.2 && t < IMPACT
      const slam = ease.outExpo(progress(t, 0.5, 0.68))
      s.stretchGlyphs.forEach((node, index) => {
        show(node, visible)
        if (!visible) return
        const pull = ease.inCubic(progress(t, 1.0 + LAG[index], 1.4))
        let x = lerp(REST[index], PULLED[index], pull)
        if (t >= 1.4) x += 1.5 * noise(t * 40, index) // taut: held under tension
        const y = BASELINE + rise(0.2 + 0.02 * index, 0.2)
        const weight = lerp(lerp(100, 900, slam), 300, pull)
        const scaleX = lerp(1, 1.25, pull)
        setAttrs(node, { transform: `translate(${r3(x)} ${r3(y)}) scale(${r3(scaleX)} 1)` })
        setStyle(node, { fontWeight: String(round(weight, 1)) })
      })
    }

    // ---- (b) Wordmark letters ------------------------------------------------------------------
    // Pulled centre of each strettch letter (the violet t, index 5, falls in at home instead).
    const pulledFor = (index) => (index < 5 ? PULLED[index] : PULLED[index - 1])
    const recoilAmount = s.springs.recoil(progress(t, 1.5, 1.95))
    const transforms = []
    s.letters.forEach((letter, index) => {
      let visible
      let dx = 0
      let dy = 0
      let scaleX = 1
      let scaleY = 1
      if (index === 5) {
        // THE EXTRA T: gravity drop #1, lands on the 1.50 impact.
        visible = t >= 1.25 && t < 3.0 + 0.015 * 5 + 0.15
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
        dy += sink(3.0 + 0.015 * 5, 0.15)
      } else if (index < 8) {
        visible = t >= IMPACT && t < 3.0 + 0.015 * index + 0.15
        dx = (pulledFor(index) - letter.home) * (1 - recoilAmount)
        // Impact shockwave travelling outward from the t.
        const tau = t - 1.5 - 0.025 * Math.abs(index - 5)
        if (tau >= 0 && tau <= 0.12) dy -= 14 * Math.sin((Math.PI * tau) / 0.12)
        dy += sink(3.0 + 0.015 * index, 0.15)
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

    // ---- (e) "Africa-first" 3.00–4.73 (rise starts: see the chase in build) --------------------
    s.africaGlyphs.forEach(({ node, x, riseStart }, index) => {
      const visible = t >= riseStart && t < EXIT_START + EXIT_STAGGER * index + EXIT_DURATION
      show(node, visible)
      if (!visible) return
      const y = BASELINE + rise(riseStart, 0.16) + sink(EXIT_START + EXIT_STAGGER * index, EXIT_DURATION)
      setAttrs(node, { transform: `translate(${r3(x)} ${r3(y)})` })
    })
  },
})
