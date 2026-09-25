// s06-lockup · 12.500–15.000 · z 8 — BRAND.
// Ink floods the gaps, the three fused bars spring into the exact logo slabs, the period rides
// the bottom bar and punches the LED hole (one halo flash + one thin ring). On that punch the real
// wordmark rises, reading "stretch cloud", while the slabs settle; the extra t drops in, and as its
// foot enters the x-height it shoves "ch cloud" over. The URL types on, one 16.4° sheen passes,
// and from 14.500 the frame is dead still (only the engine grain moves).
//
// Event times (global s): 12.750 LED punch + wordmark rise starts (last letter settles 13.135) ·
// 13.000 t drop starts · 13.217 shove starts · 13.250 t lands (squash, engine hit) · URL types
// 13.250–13.433, caret off 13.450 · 13.500–14.500 push-in · 14.000–14.400 sheen, LED blink to
// 14.250 · 14.500 dead still.
//
// Everything below is a closed-form function of global t. Screen-space layers use stage px; the
// createLogo() lockup (height 224 → u = 7 px per logo unit) and its sheen overlay use logo units.
;(() => {
  const START = 12.5
  const END = 15.0

  // Lockup placement: createLogo({height: 224}) at left 309 (storyboard) and top 416 — the
  // storyboard's top 428 lifted 12 px. The URL hangs 24 px under the mark, so the whole lockup
  // (mark peak → URL baseline) spans y 416–664 before the push-in: its bbox is centred on the
  // frame (540) and its luminance centroid sits ~3 px above centre, the optical centre (the mark's
  // peak is a point, the base is flat and carries the URL). Horizontally the ink runs 309–1610.7
  // (centre 959.9). Every s06 position below (slab targets, LED, mask edge, URL, sheen) is derived
  // from LOGO_X / LOGO_Y.
  const U = 7
  const LOGO_X = 309
  const OPTICAL_LIFT = 12
  const LOGO_Y = 428 - OPTICAL_LIFT
  const toScreen = ([x, y]) => [LOGO_X + U * x, LOGO_Y + U * y]

  // Slab corners in logo units, TL / TR / BR / BL, read straight off window.SC_LOGO.markSlabs so
  // the morph polygons land exactly on the real paths (api.logoSlabs is rounded to 3 decimals).
  const SLAB_UNITS = {
    top: [[0, 9.99776], [34, 0], [33.9252, 11.5172], [0, 15.8417]],
    middle: [[0, 18.0271], [33.9575, 13.8486], [33.83, 23.871], [0, 23.871]],
    bottom: [[0, 26.0547], [27.5195, 26.0547], [27.5195, 31.8984], [0, 31.8984]],
  }
  // The evenodd LED hole in the bottom slab (bounds 2.17773–3.53809 × 28.3613–29.5918).
  const LED = { cx: 2.85791, cy: 28.97655, rx: 0.68018, ry: 0.61525 }
  const LED_PX = toScreen([LED.cx, LED.cy]) // (329.005, 618.836)

  // s05 exit rects (x0, y0, x1, y1) → slab, each with its own spring start.
  const BARS = [
    { rect: [180, 283, 1740, 330], slab: 'top', start: 12.54 },
    { rect: [180, 449, 1740, 610], slab: 'middle', start: 12.56 },
    { rect: [180, 762, 1442.7, 850], slab: 'bottom', start: 12.58 },
  ]
  const SPRING_WINDOW = 0.5 // slabSpring duration; residual at the end is < 0.07 px

  // The period (s05's ink dot) as a bilinear parameter on the B3 → bottom-slab quad.
  const DOT_FROM = { x: 1430.7, y: 838, r: 12 }

  // Wordmark choreography.
  const RISE_DEPTH = 130 / U // units
  const RISE_SKEW = -7.1
  const RISE_DURATION = 0.22
  // The rise fires on the LED punch (12.750, half-beat) so the word comes up while the slabs are
  // still settling: no empty-frame stall between the mark and the name. Letter n starts at
  // 12.750 + 0.015·n (n = 0..11); the last one settles at 13.135.
  const RISE_START = 12.75
  const RISE_EACH = 0.015
  const MASK_EDGE_UNITS = (593 - 428) / U // 23.571 u: the storyboard's y 593 edge, 5 px under the round bottoms
  const PRE_OFFSET = -60.34 / U // letters 6–12 start where the missing t would be: "stretch cloud"
  const DROP_START = 13.0
  const DROP_LAND = 13.25 // locked: the audio hit and the engine shake sit on this frame
  const DROP_HEIGHT = -600 / U // starts fully above the frame (see deviation notes)
  const SQUASH_END = DROP_LAND + 2 / 60
  // The falling t's foot crosses the x-height line (11.21 u) at 13.233, one frame before it lands.
  // The shove starts on the frame before that contact (13.217, frame 793) with an impulse (initial
  // velocity 40/s), so "ch cloud" is already 93% of the way over on the landing frame (the squashed
  // t clears the c by ~6 px) instead of starting from rest on it, which printed the t over the c
  // for three frames. zeta 0.66: +12 px overshoot at 13.283, < 2 px/frame from 13.383, < 1e-6 px
  // by 14.22.
  const SHOVE_START = 13 + 13 / 60
  const SHOVE_SPRING = { stiffness: 1000, damping: 42, mass: 1, velocity: 40 }
  const TAIL = 1.0 // springs evaluated for 1 s of real time so they settle to < 0.001 px before 14.5

  // LED punch (12.750): one restrained halo flash and one thin ring, both riding the live hole
  // while the bottom slab finishes its spring.
  const PUNCH = 12.75
  const PUNCH_HALO_RADIUS = 22
  const PUNCH_HALO_PEAK = 0.55
  const PUNCH_HALO_END = 13.0
  const PUNCH_RING_FROM = 6.5 // px: just outside the 4.8 × 4.3 px hole
  const PUNCH_RING_TO = 30
  const PUNCH_RING_WIDTH = 1.5
  const PUNCH_RING_PEAK = 0.75
  const PUNCH_RING_END = 13.0

  // URL: JetBrains Mono 500 at 44 px, natural tracking (0.6 em = 26.4 px advance), ink flush with
  // the wordmark's s. It hangs from the mark: its x-height line sits on the mark's bottom edge, so
  // the lowercase body starts exactly where the mark ends.
  const URL_TEXT = 'cloud.strettch.com'
  const URL_SIZE = 44
  const URL_TRACKING = 0 // em
  const URL_X_HEIGHT = 0.55 * URL_SIZE // JetBrains Mono x-height 550/1000 em
  const MARK_BOTTOM = LOGO_Y + U * 31.8984
  const URL_BASELINE = MARK_BOTTOM + URL_X_HEIGHT
  const URL_INK_LEFT = LOGO_X + U * 42.68 // the wordmark's s
  const URL_START = 13.25
  const URL_EACH = 0.01
  const CARET_OFF = 13.45
  const FPS = 60 // typing and caret are quantised to whole frames so motion-blur sub-samples agree

  // Sheen + LED.
  const SHEEN_START = 14.0
  const SHEEN_END = 14.4
  const SHEEN_FROM = 200
  const SHEEN_TO = 1700
  const SHEEN_WIDTH = 140 / U
  const SHEEN_ANGLE = 16.4
  const LED_GLOW_END = 14.25

  // Push-in.
  const PUSH_START = 13.5
  const PUSH_END = 14.5
  const PUSH_SCALE = 1.012

  const COLORS = {
    ink: '#07061A',
    violet: '#6B63FF',
    violetLight: '#8982FF',
    paper: '#F4F3FF',
    white: '#FFFFFF',
  }

  const hexToRgb = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16))
  const mixColor = (from, to, amount) => {
    const a = hexToRgb(from)
    const b = hexToRgb(to)
    return `rgb(${a.map((value, index) => Math.round(value + (b[index] - value) * amount)).join(',')})`
  }
  const quadPath = (points) => `M${points.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join('L')}Z`
  const bilinear = ([tl, tr, br, bl], u, v) => {
    const top = [tl[0] + (tr[0] - tl[0]) * u, tl[1] + (tr[1] - tl[1]) * u]
    const bottom = [bl[0] + (br[0] - bl[0]) * u, bl[1] + (br[1] - bl[1]) * u]
    return [top[0] + (bottom[0] - top[0]) * v, top[1] + (bottom[1] - top[1]) * v]
  }
  // Inverse of bilinear() for a quad whose left and right edges are vertical (B3 and the slab).
  const rectParam = ([tl, tr, br, bl], [x, y]) => {
    const u = (x - tl[0]) / (tr[0] - tl[0])
    const top = tl[1] + (tr[1] - tl[1]) * u
    const bottom = bl[1] + (br[1] - bl[1]) * u
    return [u, (y - top) / (bottom - top)]
  }

  SC.scene({
    id: 's06-lockup',
    start: START,
    end: END,
    z: 8,

    build(root, api) {
      const { el, svg, tokens } = api

      // One container so the whole scene can take the push-in without touching the engine root.
      const world = el('div', { style: { position: 'absolute', left: '0px', top: '0px', width: '1920px', height: '1080px', transformOrigin: '960px 540px' } }, root)
      const place = (node, left, top) => {
        node.style.position = 'absolute'
        node.style.left = `${left}px`
        node.style.top = `${top}px`
        node.style.overflow = 'visible'
        return node
      }

      // ---- Back layer (stage px): violet halos, construction lines, morph polygons, the period.
      const back = place(svg('svg', { width: 1920, height: 1080, viewBox: '0 0 1920 1080' }, world), 0, 0)
      const bars = BARS.map((bar) => {
        const [x0, y0, x1, y1] = bar.rect
        const from = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
        const to = SLAB_UNITS[bar.slab].map(toScreen)
        return { ...bar, from, to }
      })
      const halos = bars.map(() =>
        svg('path', { fill: COLORS.violet, stroke: COLORS.violet, 'stroke-linejoin': 'miter', 'stroke-miterlimit': 10 }, back))
      const constructionGroup = svg('g', { stroke: COLORS.violetLight, 'stroke-opacity': 0.25, 'stroke-width': 1, fill: 'none' }, back)
      const polygons = bars.map(() => svg('path', { fill: COLORS.paper }, back))
      const dotStreak = svg('line', { stroke: COLORS.ink, 'stroke-linecap': 'round' }, back)
      const dot = svg('ellipse', { fill: COLORS.ink }, back)

      // Construction lines: the top slab's upper edge (16.4°) and the middle slab's upper edge
      // (7.1°), extended from the slab corners to the frame edges in both directions.
      const extendToFrame = ([ax, ay], [dx, dy]) => {
        let reach = Infinity
        if (dx > 0) reach = Math.min(reach, (1920 - ax) / dx)
        if (dx < 0) reach = Math.min(reach, -ax / dx)
        if (dy > 0) reach = Math.min(reach, (1080 - ay) / dy)
        if (dy < 0) reach = Math.min(reach, -ay / dy)
        return [ax + dx * reach, ay + dy * reach]
      }
      const constructionLines = []
      for (const slab of ['top', 'middle']) {
        const [tl, tr] = SLAB_UNITS[slab].map(toScreen)
        const length = Math.hypot(tr[0] - tl[0], tr[1] - tl[1])
        const direction = [(tr[0] - tl[0]) / length, (tr[1] - tl[1]) / length]
        constructionLines.push({ anchor: tr, end: extendToFrame(tr, direction), node: svg('line', {}, constructionGroup) })
        constructionLines.push({ anchor: tl, end: extendToFrame(tl, [-direction[0], -direction[1]]), node: svg('line', {}, constructionGroup) })
      }

      // Bilinear parameters of the period: s05's dot on B3 → the LED hole centre on the bottom slab.
      const b3 = bars[2]
      const dotFrom = rectParam(b3.from, [DOT_FROM.x, DOT_FROM.y])
      const dotTo = rectParam(b3.to, LED_PX)

      // ---- The real lockup (logo units).
      const logo = api.createLogo(world, { height: 224 })
      place(logo.root, LOGO_X, LOGO_Y)
      const defs = svg('defs', {}, logo.root)
      const riseClip = svg('clipPath', { id: 's06-rise-clip', clipPathUnits: 'userSpaceOnUse' }, defs)
      svg('rect', { x: -80, y: -300, width: 400, height: 300 + MASK_EDGE_UNITS }, riseClip)
      logo.wordmarkGroup.setAttribute('clip-path', 'url(#s06-rise-clip)')
      // The LED disc sits UNDER the slabs: it only ever shows through the real evenodd hole.
      const ledDisc = svg('ellipse', { cx: LED.cx, cy: LED.cy, rx: LED.rx + 0.08, ry: LED.ry + 0.08, fill: COLORS.violetLight })
      logo.root.insertBefore(ledDisc, logo.markGroup)
      // The extra t lives outside the masked group: it drops from above and is never clipped.
      const extraT = logo.letters[5]
      const dropGroup = svg('g', {}, logo.root)
      dropGroup.appendChild(extraT.path)
      for (const letter of logo.letters) {
        letter.path.style.transformBox = 'fill-box'
        letter.path.style.transformOrigin = '50% 50%'
      }
      // Stretch and squash are anchored on the t's foot so it never leaves the baseline.
      extraT.path.style.transformOrigin = '50% 100%'

      // ---- Sheen overlay: same viewBox and size as the logo, clipped to copies of every path.
      const sheen = place(svg('svg', { width: logo.root.getAttribute('width'), height: 224, viewBox: '0 0 186 32' }, world), LOGO_X, LOGO_Y)
      const sheenDefs = svg('defs', {}, sheen)
      const gradient = svg('linearGradient', { id: 's06-sheen-grad', x1: 0, y1: 0, x2: 1, y2: 0 }, sheenDefs)
      // A soft bell profile rather than a linear tent: reads as light, not as a stripe.
      const profile = [[0, 0], [0.15, 0.04], [0.3, 0.17], [0.42, 0.37], [0.5, 0.45], [0.58, 0.37], [0.7, 0.17], [0.85, 0.04], [1, 0]]
      for (const [offset, opacity] of profile) svg('stop', { offset, 'stop-color': COLORS.white, 'stop-opacity': opacity }, gradient)
      const sheenClip = svg('clipPath', { id: 's06-sheen-clip', clipPathUnits: 'userSpaceOnUse' }, sheenDefs)
      const logoData = window.SC_LOGO
      svg('path', { d: logoData.markSlabs.top }, sheenClip)
      svg('path', { d: logoData.markSlabs.middle }, sheenClip)
      svg('path', { d: logoData.markSlabs.bottom, 'clip-rule': 'evenodd' }, sheenClip)
      for (const letter of logoData.letters) svg('path', { d: letter.d }, sheenClip)
      const sheenGroup = svg('g', { 'clip-path': 'url(#s06-sheen-clip)' }, sheen)
      const sheenBand = svg('rect', { x: -SHEEN_WIDTH / 2, y: -40, width: SHEEN_WIDTH, height: 80, fill: 'url(#s06-sheen-grad)' }, sheenGroup)

      // ---- Light layer (stage px, screen-blended so light always ADDS): punch halo, punch ring and
      // the LED halo read brighter than the violet slab they sit on instead of dissolving into it.
      const glowLayer = el('div', { style: { position: 'absolute', left: '0px', top: '0px', width: '1920px', height: '1080px', mixBlendMode: 'screen' } }, world)
      const glow = place(svg('svg', { width: 1920, height: 1080, viewBox: '0 0 1920 1080' }, glowLayer), 0, 0)

      // ---- Front layer (stage px): URL and caret.
      const front = place(svg('svg', { width: 1920, height: 1080, viewBox: '0 0 1920 1080' }, world), 0, 0)

      // Pre-baked halo sprite (#8982FF, alpha 1 → 0). Each halo is its own canvas painted once here
      // (synchronously — no async image decode that a parallel render page could miss).
      const sprite = document.createElement('canvas')
      sprite.width = 128
      sprite.height = 128
      const spriteContext = sprite.getContext('2d')
      const radial = spriteContext.createRadialGradient(64, 64, 0, 64, 64, 64)
      for (let step = 0; step <= 8; step++) {
        const position = step / 8
        const alpha = Math.pow(1 - position * position, 2) // smooth falloff, zero slope at the rim
        radial.addColorStop(position, `rgba(137,130,255,${alpha.toFixed(4)})`)
      }
      spriteContext.fillStyle = radial
      spriteContext.fillRect(0, 0, 128, 128)
      const makeHalo = () => {
        const canvas = el('canvas', { attrs: { width: 128, height: 128 }, style: { position: 'absolute', left: '0px', top: '0px', width: '128px', height: '128px', transformOrigin: '0 0' } }, glowLayer)
        canvas.getContext('2d').drawImage(sprite, 0, 0)
        return canvas
      }
      const punchHalo = makeHalo()
      const ledHalo = makeHalo()
      const punchRing = svg('circle', { fill: 'none', stroke: COLORS.violetLight }, glow)

      // URL: one <text> per character on the natural mono grid (so it can type on cell by cell),
      // with the first glyph's INK (not its advance box) flush with the wordmark's s.
      const measure = document.createElement('canvas').getContext('2d')
      measure.font = `500 ${URL_SIZE}px ${tokens.fonts.mono}`
      const firstInkOffset = -measure.measureText(URL_TEXT[0]).actualBoundingBoxLeft
      const naturalAdvance = measure.measureText(URL_TEXT).width / URL_TEXT.length
      const advance = naturalAdvance + URL_TRACKING * URL_SIZE
      const urlOrigin = URL_INK_LEFT - firstInkOffset
      const urlGroup = svg('g', { fill: COLORS.violetLight, 'font-family': tokens.fonts.mono, 'font-weight': 500, 'font-size': URL_SIZE }, front)
      const urlGlyphs = [...URL_TEXT].map((character, index) => {
        const node = svg('text', { x: (urlOrigin + advance * index).toFixed(3), y: URL_BASELINE }, urlGroup)
        node.textContent = character
        return node
      })
      const caret = svg('rect', { width: 26, height: 32, y: URL_BASELINE - 32, fill: COLORS.violetLight }, front)

      return {
        world, bars, halos, polygons, dot, dotStreak, dotFrom, dotTo, constructionLines,
        logo, extraT, ledDisc, sheenBand, punchHalo, ledHalo, punchRing,
        urlGlyphs, urlOrigin, advance, caret,
      }
    },

    render(t, state, api) {
      const { ease, progress, tween, setStyle, setAttrs, round } = api
      const carry = ease.inOutCubic
      const slabSpring = ease.spring({ stiffness: 600, damping: 34, mass: 1, duration: SPRING_WINDOW })
      const shove = ease.spring({ ...SHOVE_SPRING, duration: TAIL })
      const squashBack = ease.spring({ stiffness: 900, damping: 21, mass: 1, duration: TAIL })
      const show = (node, visible) => setStyle(node, { display: visible ? 'inline' : 'none' })

      // ---- Push-in (13.50–14.50), frozen from 14.50.
      const push = tween(t, PUSH_START, PUSH_END, 1, PUSH_SCALE, ease.smooth)
      setStyle(state.world, { transform: push === 1 ? 'none' : `scale(${round(push, 6)})` })

      // ---- Bars → slabs, with the ink flood carved around them.
      const barVertices = (bar, time) => {
        const amount = tween(time, bar.start, bar.start + SPRING_WINDOW, 0, 1, slabSpring)
        return bar.from.map((point, index) => [
          point[0] + (bar.to[index][0] - point[0]) * amount,
          point[1] + (bar.to[index][1] - point[1]) * amount,
        ])
      }
      const morphing = t < 13.1
      // m starts at 480 (not 400) so the expanded bars still cover the whole frame at 12.500.
      const margin = 480 * (1 - ease.inQuad(progress(t, 12.5, 12.62)))
      const barFill = mixColor(COLORS.paper, COLORS.violet, carry(progress(t, 12.6, 12.85)))
      state.bars.forEach((bar, index) => {
        const d = quadPath(barVertices(bar, t))
        const halo = state.halos[index]
        show(halo, margin > 0.05)
        if (margin > 0.05) setAttrs(halo, { d, 'stroke-width': round(margin * 2, 3) })
        const polygon = state.polygons[index]
        show(polygon, morphing)
        if (morphing) setAttrs(polygon, { d, fill: barFill })
      })

      // ---- The period rides the bar and becomes the LED hole.
      const dotAt = (time) => {
        const amount = carry(progress(time, 12.5, 12.75))
        const u = state.dotFrom[0] + (state.dotTo[0] - state.dotFrom[0]) * amount
        const v = state.dotFrom[1] + (state.dotTo[1] - state.dotFrom[1]) * amount
        return { position: bilinear(barVertices(state.bars[2], time), u, v), amount }
      }
      show(state.dot, morphing)
      let streakVisible = false
      if (morphing) {
        const { position, amount } = dotAt(t)
        const rx = DOT_FROM.r + (LED.rx * U - DOT_FROM.r) * amount
        const ry = DOT_FROM.r + (LED.ry * U - DOT_FROM.r) * amount
        setAttrs(state.dot, { cx: round(position[0], 3), cy: round(position[1], 3), rx: round(rx, 3), ry: round(ry, 3) })
        // Analytic streak (pos(t − 0.0021) → pos(t)) so the fast slide never strobes.
        const previous = dotAt(t - 0.0021).position
        streakVisible = t > 12.5 && Math.hypot(position[0] - previous[0], position[1] - previous[1]) > 0.5
        if (streakVisible) {
          setAttrs(state.dotStreak, {
            x1: round(previous[0], 3), y1: round(previous[1], 3), x2: round(position[0], 3), y2: round(position[1], 3),
            'stroke-width': round(Math.min(rx, ry) * 2, 3),
          })
        }
      }
      show(state.dotStreak, streakVisible)

      // ---- 12.750 PUNCH: one halo flash and one thin expanding ring. The bottom slab is still
      // settling (~9 px of spring overshoot left), so both ride the live hole and stay concentric.
      const holeNow = morphing ? dotAt(t).position : LED_PX
      const setHalo = (node, [x, y], radius, opacity) => {
        const visible = opacity > 0.001
        setStyle(node, { display: visible ? 'block' : 'none' })
        if (!visible) return
        setStyle(node, {
          transform: `translate(${round(x - radius, 3)}px, ${round(y - radius, 3)}px) scale(${round((radius * 2) / 128, 5)})`,
          opacity: round(opacity, 4),
        })
      }
      const haloFade = 1 - progress(t, PUNCH, PUNCH_HALO_END)
      setHalo(state.punchHalo, holeNow, PUNCH_HALO_RADIUS, t >= PUNCH ? PUNCH_HALO_PEAK * haloFade * haloFade : 0)
      const ringProgress = progress(t, PUNCH, PUNCH_RING_END)
      const ringLive = t >= PUNCH && ringProgress < 1
      show(state.punchRing, ringLive)
      if (ringLive) {
        setAttrs(state.punchRing, {
          cx: round(holeNow[0], 3), cy: round(holeNow[1], 3),
          r: round(PUNCH_RING_FROM + (PUNCH_RING_TO - PUNCH_RING_FROM) * ease.outCubic(ringProgress), 3),
          'stroke-width': round(PUNCH_RING_WIDTH * (1 - 0.5 * ringProgress), 3),
          'stroke-opacity': round(PUNCH_RING_PEAK * Math.pow(1 - ringProgress, 1.5), 4),
        })
      }

      // ---- 13.100: the real slabs take over from the morph polygons.
      setStyle(state.logo.markGroup, { visibility: morphing ? 'hidden' : 'visible' })

      // ---- Construction lines: draw 13.05–13.20, retract 13.30–13.45.
      const reach = t < 13.3 ? ease.snappy(progress(t, 13.05, 13.2)) : 1 - ease.swift(progress(t, 13.3, 13.45))
      for (const line of state.constructionLines) {
        show(line.node, reach > 0.001)
        if (reach <= 0.001) continue
        const [ax, ay] = line.anchor
        setAttrs(line.node, {
          x1: round(ax, 3), y1: round(ay, 3),
          x2: round(ax + (line.end[0] - ax) * reach, 3), y2: round(ay + (line.end[1] - ay) * reach, 3),
        })
      }

      // ---- Wordmark rises through the mask edge (storyboard y 593, lifted with the lockup) from
      // 12.750, reading "stretch cloud" at first.
      const shoveAmount = tween(t, SHOVE_START, SHOVE_START + TAIL, 0, 1, shove)
      state.logo.letters.forEach((letter, index) => {
        if (index === 5) return
        const order = index < 5 ? index : index - 1
        const riseStart = RISE_START + RISE_EACH * order
        const rise = ease.snappy(progress(t, riseStart, riseStart + RISE_DURATION))
        const x = index >= 6 ? PRE_OFFSET * (1 - shoveAmount) : 0
        const y = RISE_DEPTH * (1 - rise)
        const skew = RISE_SKEW * (1 - rise)
        const settled = rise === 1 && x === 0
        setStyle(letter.path, {
          visibility: t >= riseStart ? 'visible' : 'hidden',
          transform: settled ? 'none' : `translate(${round(x, 5)}px, ${round(y, 5)}px) skewX(${round(skew, 4)}deg)`,
        })
      })

      // ---- The extra t: gravity drop, squash on landing, violet → white.
      const t5 = state.extraT.path
      let dropY = 0
      let scaleX = 1
      let scaleY = 1
      if (t < DROP_LAND) {
        const fall = progress(t, DROP_START, DROP_LAND)
        dropY = DROP_HEIGHT * (1 - ease.inQuad(fall))
        scaleY = 1 + 0.15 * fall // stretches with speed
        scaleX = 1 - 0.06 * fall
      } else if (t < SQUASH_END) {
        scaleY = 0.82
        scaleX = 1.15
      } else {
        const recovery = tween(t, SQUASH_END, SQUASH_END + TAIL, 0, 1, squashBack)
        scaleY = 0.82 + 0.18 * recovery
        scaleX = 1.15 - 0.15 * recovery
      }
      const t5Settled = dropY === 0 && scaleX === 1 && scaleY === 1
      setStyle(t5, {
        visibility: t >= DROP_START ? 'visible' : 'hidden',
        transform: t5Settled ? 'none' : `translate(0px, ${round(dropY, 5)}px) scale(${round(scaleX, 5)}, ${round(scaleY, 5)})`,
      })
      setAttrs(t5, { fill: mixColor(COLORS.violet, COLORS.white, carry(progress(t, 13.25, 13.6))) })

      // ---- URL types on (10 ms per character) with a block caret until 13.450. Count and caret
      // come from the frame index, not raw t: every motion-blur sub-sample of a frame then agrees
      // on the same cell, so the caret can no longer smear across two cells as a double caret.
      const frame = Math.round(t * FPS)
      const firstFrame = Math.round(URL_START * FPS)
      const typed = frame < firstFrame ? 0 : Math.min(URL_TEXT.length, Math.floor((frame - firstFrame) / (FPS * URL_EACH) + 1e-6) + 1)
      state.urlGlyphs.forEach((node, index) => setStyle(node, { visibility: index < typed ? 'visible' : 'hidden' }))
      const caretLive = frame >= firstFrame && frame < Math.round(CARET_OFF * FPS)
      show(state.caret, caretLive)
      if (caretLive) setAttrs(state.caret, { x: round(state.urlOrigin + state.advance * typed + (state.advance - 26) / 2, 3) })

      // ---- Sheen (14.00–14.40) and the LED blink (14.00–14.25).
      const sheenLive = t >= SHEEN_START && t < SHEEN_END
      show(state.sheenBand, sheenLive)
      if (sheenLive) {
        const centre = (tween(t, SHEEN_START, SHEEN_END, SHEEN_FROM, SHEEN_TO, carry) - LOGO_X) / U
        setAttrs(state.sheenBand, { transform: `translate(${round(centre, 4)} 16) rotate(${SHEEN_ANGLE})` })
      }
      // The lit LED is violetLight at full strength (brighter than the slab); its halo is additive.
      const ledLevel = t >= SHEEN_START && t < LED_GLOW_END ? 1 - progress(t, SHEEN_START, LED_GLOW_END) : 0
      show(state.ledDisc, ledLevel > 0.001)
      setStyle(state.ledDisc, { opacity: round(ledLevel, 4) })
      setHalo(state.ledHalo, LED_PX, 20, 0.7 * ledLevel)
    },
  })
})()
