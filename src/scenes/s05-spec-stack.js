// s05-spec-stack · 10.000–12.500 s · z 7 — PROOF.
//
// Inside Rwanda's violet fill three spec lines land on consecutive beats. Each line is
// force-justified so its INK (not its advance box) spans its logo slab exactly — the slab ratio
// 34 : 34 : 27.5 → 1560 / 1560 / 1262.7 px from x 180 — then the lines fuse into the three
// paper bars that s06 springs into the mark.
//
// Everything is one SVG in stage px. Every glyph is placed absolutely from canvas measurements
// taken in build() (fonts are loaded before build), masks are clipPath rects, and render() is a
// pure function of the global time t.
;(() => {
  // --- Timing (global seconds, from storyboard/master.json) ----------------------------------
  const TYPE_START = 10.0
  const TYPE_EACH = 0.0077 // line 1: one character every 7.7 ms
  const CARET_OFF = 10.5
  const FROM_RISE = [10.5, 0.15]
  const NUM_RISE = [10.5, 0.1]
  const ROLL_START = 10.5
  const LOCKS = [10.625, 10.6875, 10.75, 10.8125] // drum locks on 32nds: 3, 9, 9, 9
  const RWF_SLIDE = [10.625, 0.3]
  const RWF_WIPE = 0.18
  const MONTH_RISE = [10.6875, 0.15]
  const PAY_RISE = [11.0, 0.15]
  const MM_RISE = [11.0, 0.12]
  const WAVE = { start: 11.0, each: 0.012, duration: 0.08 }
  const BUZZ = { from: 11.03, to: 11.22, amplitude: 14, hz: 16 }
  const DOT_POP = [11.25, 0.12]
  const FUSES = [[12.25, 12.4], [12.3, 12.45], [12.4, 12.48]]
  const INK_TO_PAPER = 0.03

  // --- Handoff geometry (exit_state → s06 entry_state). These numbers are the contract. -------
  const BARS = [
    { x: 180, y: 283, width: 1560, height: 47 },
    { x: 180, y: 449, width: 1560, height: 161 },
    { x: 180, y: 762, width: 1262.7, height: 88 },
  ]
  const DOT = { cx: 1430.7, cy: 838, r: 12 }

  const MASK_OFFSET = 8 // rise masks sit 8 px under the baseline (618 / 858)
  const DRUM_STRIP = 12 // SLOT mode: 12-glyph strips, translateY 0 → −11 em
  const SMEAR_SECONDS = 0.5 / 60 / 7 // one subframe step of the final render (8 subframes, 0.5 shutter)
  const SMEAR_GHOSTS = [0.6, 0.42, 0.26] // trailing ghost strips, nearest first

  const hexToRgb = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16))
  const mixColor = (from, to, amount) => {
    const a = hexToRgb(from)
    const b = hexToRgb(to)
    return `rgb(${a.map((value, index) => Math.round(value + (b[index] - value) * amount)).join(',')})`
  }

  SC.scene({
    id: 's05-spec-stack',
    start: 10.0,
    end: 12.5,
    z: 7,

    build(root, api) {
      const { svg, tokens, hash } = api
      const VIOLET = tokens.violet
      const PAPER = tokens.paper
      const INK = tokens.ink
      const FONT = {
        deploy: { family: tokens.fonts.mono, weight: 700, size: 64 },
        serif: { family: tokens.fonts.serif, weight: 400, style: 'italic', size: 110 },
        price: { family: tokens.fonts.mono, weight: 800, size: 220 },
        unit: { family: tokens.fonts.mono, weight: 700, size: 120 },
        money: { family: tokens.fonts.text, weight: 800, size: 120 },
      }

      // ---- Measurement. `measure` gives advances (with kerning) and the font's glyph boxes;
      // `scan` rasterises the string at 4× and reads the TRUE ink (canvas glyph boxes are control
      // point boxes and overshoot curves by ~1 px), plus a per-row ink profile for optical spacing.
      const fontString = (font, weight, size) => `${font.style || 'normal'} ${weight} ${size}px ${font.family}`
      const context = document.createElement('canvas').getContext('2d')
      const measure = (text, font, weight = font.weight) => {
        const scale = Math.max(1, Math.floor(1600 / font.size))
        context.font = fontString(font, weight, font.size * scale)
        const metrics = context.measureText(text)
        return {
          advance: metrics.width / scale,
          left: -metrics.actualBoundingBoxLeft / scale, // ink left, + = right of the origin
          right: metrics.actualBoundingBoxRight / scale,
          ascent: metrics.actualBoundingBoxAscent / scale,
          descent: metrics.actualBoundingBoxDescent / scale,
        }
      }
      const SCAN = 4
      const scan = (text, font, weight = font.weight) => {
        const box = measure(text, font, weight)
        const pad = 6
        const left0 = Math.floor(Math.min(0, box.left)) - pad
        const top0 = -Math.ceil(box.ascent) - pad
        const width = Math.ceil(Math.max(box.advance, box.right) + pad) - left0
        const height = Math.ceil(box.descent) + pad - top0
        const canvas = document.createElement('canvas')
        canvas.width = width * SCAN
        canvas.height = height * SCAN
        const scanContext = canvas.getContext('2d', { willReadFrequently: true })
        scanContext.font = fontString(font, weight, font.size * SCAN)
        scanContext.fillStyle = '#000'
        scanContext.fillText(text, -left0 * SCAN, -top0 * SCAN)
        const alpha = scanContext.getImageData(0, 0, canvas.width, canvas.height).data
        const columnMax = new Float32Array(canvas.width)
        const rows = [] // rows[y - top0] = [inkLeft, inkRight] of stage-px row y (baseline-relative)
        let top = Infinity
        let bottom = -Infinity
        for (let row = 0; row < height; row++) {
          let rowLeft = Infinity
          let rowRight = -Infinity
          for (let sub = 0; sub < SCAN; sub++) {
            const offset = (row * SCAN + sub) * canvas.width
            for (let column = 0; column < canvas.width; column++) {
              const value = alpha[(offset + column) * 4 + 3]
              if (value === 0) continue
              if (value > columnMax[column]) columnMax[column] = value
              if (value >= 128) {
                if (column < rowLeft) rowLeft = column
                if (column > rowRight) rowRight = column
              }
            }
          }
          if (rowRight >= 0) {
            rows[row] = [rowLeft / SCAN + left0, (rowRight + 1) / SCAN + left0]
            top = Math.min(top, row + top0)
            bottom = Math.max(bottom, row + top0 + 1)
          }
        }
        let first = 0
        while (first < canvas.width && columnMax[first] === 0) first++
        let last = canvas.width - 1
        while (last > 0 && columnMax[last] === 0) last--
        return {
          advance: box.advance,
          left: (first + 1 - columnMax[first] / 255) / SCAN + left0,
          right: (last + columnMax[last] / 255) / SCAN + left0,
          ascent: -top,
          descent: bottom,
          rowAt: (y) => rows[Math.floor(y) - top0] || null,
        }
      }
      // Optical indent of one side of an ink shape over the band [−bandHeight, 0] above the
      // baseline: the mean distance from the side's extreme to the ink, capped at `depth` so open
      // shapes (the 3's waist, F's arms, the italic slash) count as partly open space, as the eye
      // reads them. Equalising extreme-gap + indents gives optically even word spacing.
      const indent = (shape, side, bandHeight, depth) => {
        let sum = 0
        const rowsInBand = Math.round(bandHeight)
        for (let y = -rowsInBand; y < 0; y++) {
          const row = shape.rowAt(y)
          const distance = !row ? depth : side === 'left' ? row[0] - shape.left : shape.right - row[1]
          sum += Math.min(depth, Math.max(0, distance))
        }
        return sum / rowsInBand
      }
      const OPTICAL_DEPTH = 0.2 // of the band height

      // ---- SVG scaffolding
      const stage = svg('svg', { width: 1920, height: 1080, viewBox: '0 0 1920 1080', 'text-rendering': 'geometricPrecision' }, root)
      Object.assign(stage.style, { position: 'absolute', left: '0px', top: '0px', display: 'block' })
      const defs = svg('defs', {}, stage)
      let clipCount = 0
      const clipRect = (attrs) => {
        const id = `s05-clip-${clipCount++}`
        const clipPath = svg('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, defs)
        return { url: `url(#${id})`, rect: svg('rect', attrs, clipPath) }
      }
      const text = (content, font, attrs, parent, weight = font.weight) => {
        const node = svg('text', {
          'font-family': font.family, 'font-size': font.size, 'font-weight': weight, 'font-style': font.style || 'normal',
          ...attrs,
        }, parent)
        node.textContent = content
        return node
      }
      // A rise mask: a clip whose bottom edge is the line's baseline machine. Its rect is updated
      // per frame; the child group carries the translate.
      const riser = (parent, info) => {
        const clip = clipRect({ x: -200, y: -200, width: 2320, height: 200 + info.edge })
        const holder = svg('g', { 'clip-path': clip.url }, parent)
        const mover = svg('g', {}, holder)
        return { ...info, clip, holder, mover }
      }
      // Line = band group (fusion clip + inherited stroke width) + its bar rect on top.
      const makeLine = (index, size) => {
        const bar = BARS[index]
        const baseline = bar.y + bar.height
        const group = svg('g', {}, stage)
        const band = clipRect({ x: bar.x, y: baseline - 1.3 * size, width: bar.width, height: 1.7 * size })
        const glyphs = svg('g', { 'clip-path': band.url, 'stroke-width': 0, 'stroke-linejoin': 'round' }, group)
        const barRect = svg('rect', { x: bar.x, y: baseline - bar.height / 2, width: bar.width, height: 0, fill: PAPER }, group)
        return { index, size, baseline, cap: bar.height, x0: bar.x, x1: bar.x + bar.width, group, band, glyphs, barRect }
      }

      svg('rect', { x: -40, y: -40, width: 2000, height: 1160, fill: VIOLET }, stage)

      // =========================================================================================
      // LINE 1 — "Deploy your first compute in 2 minutes." JetBrains Mono 700 / 64, typed.
      // Force-justified by tracking: the D's ink starts at x 180, the period's ink ends at 1740.
      // =========================================================================================
      const line1 = makeLine(0, 64)
      const deployText = 'Deploy your first compute in 2 minutes.'
      const deployChars = [...deployText]
      const firstInk = scan(deployChars[0], FONT.deploy)
      const lastInk = scan(deployChars[deployChars.length - 1], FONT.deploy)
      const deployOrigin = line1.x0 - firstInk.left
      const deployPitch = (line1.x1 - lastInk.right - deployOrigin) / (deployChars.length - 1)
      line1.chars = deployChars.map((character, index) =>
        character === ' ' ? null : text(character, FONT.deploy, { x: deployOrigin + deployPitch * index, y: line1.baseline, fill: PAPER, stroke: PAPER }, line1.glyphs))
      line1.origin = deployOrigin
      line1.pitch = deployPitch
      const deployAdvance = measure('D', FONT.deploy).advance
      line1.caret = svg('rect', { x: 0, y: line1.baseline - line1.cap / 2 - 25, width: 38, height: 50, fill: PAPER }, line1.group)
      line1.caretInset = (deployAdvance - 38) / 2

      // =========================================================================================
      // LINE 2 — "from 3,999 RWF / month". Serif italic 110 (ink) · Mono 800 220 (paper, drums)
      // · Mono 700 120 (paper) · serif italic 110 (ink). The outer ink edges sit exactly on
      // x 180 / 1740; the three inner gaps are optically equal (and line 3's single gap matches).
      // =========================================================================================
      const line2 = makeLine(1, 220)
      const edge2 = line2.baseline + MASK_OFFSET
      const fromInk = scan('from', FONT.serif)
      const priceChars = ['3', ',', '9', '9', '9']
      const pricePitch = measure('0', FONT.price).advance // 132 = 0.6 em, the odometer's natural pitch
      const priceInk = priceChars.map((character) => scan(character, FONT.price))
      const priceInkLeft = priceInk[0].left
      const priceInkRight = pricePitch * (priceChars.length - 1) + priceInk[priceInk.length - 1].right
      const unitInk = scan('RWF', FONT.unit)
      const monthInk = scan('/ month', FONT.serif)
      const payInk = scan('pay with', FONT.serif)
      const moneyText = 'Mobile Money'
      const moneyInk = scan(moneyText, FONT.money)
      const capOf = (font) => scan('H', font).ascent
      const cap = { serif: capOf(FONT.serif), price: capOf(FONT.price), unit: capOf(FONT.unit), money: capOf(FONT.money) }
      const junction = (leftShape, rightShape, bandHeight) =>
        indent(leftShape, 'right', bandHeight, OPTICAL_DEPTH * bandHeight) + indent(rightShape, 'left', bandHeight, OPTICAL_DEPTH * bandHeight)
      const indents = [
        junction(fromInk, priceInk[0], Math.min(cap.serif, cap.price)),
        junction(priceInk[priceInk.length - 1], unitInk, Math.min(cap.price, cap.unit)),
        junction(unitInk, monthInk, Math.min(cap.unit, cap.serif)),
      ]
      const inkWidths = [fromInk.right - fromInk.left, priceInkRight - priceInkLeft, unitInk.right - unitInk.left, monthInk.right - monthInk.left]
      const opticalGap = (line2.x1 - line2.x0 - inkWidths.reduce((sum, width) => sum + width, 0) + indents.reduce((sum, value) => sum + value, 0)) / 3
      const inkGaps = indents.map((value) => opticalGap - value)
      let cursor = line2.x0
      const inkStarts = inkWidths.map((width, index) => { const start = cursor; cursor += width + (inkGaps[index] || 0); return start })
      const fromOrigin = inkStarts[0] - fromInk.left
      const priceOrigin = inkStarts[1] - priceInkLeft
      const unitOrigin = inkStarts[2] - unitInk.left
      const monthOrigin = inkStarts[3] - monthInk.left

      const maxDescent = (...items) => Math.max(...items.map((item) => item.descent))
      const maxAscent = (...items) => Math.max(...items.map((item) => item.ascent))
      // Descender allowance: the mask edge eases down by this much as the rise lands so the comma
      // tail, the slash and the p/y descenders are never cropped at rest.
      const allowance = (descent) => Math.max(0, descent + 4 - MASK_OFFSET)

      line2.from = riser(line2.glyphs, { t0: FROM_RISE[0], duration: FROM_RISE[1], edge: edge2, depth: Math.ceil(fromInk.ascent + MASK_OFFSET + 6), allow: allowance(fromInk.descent) })
      line2.from.node = text('from', FONT.serif, { x: fromOrigin, y: line2.baseline, fill: INK, stroke: INK }, line2.from.mover)

      const digitMetrics = '0123456789'.split('').map((digit) => measure(digit, FONT.price))
      line2.price = riser(line2.glyphs, {
        t0: NUM_RISE[0], duration: NUM_RISE[1], edge: edge2,
        depth: Math.ceil(maxAscent(...digitMetrics) + MASK_OFFSET + 6), allow: allowance(maxDescent(...priceInk, ...digitMetrics)),
      })
      const em = FONT.price.size
      line2.drums = []
      priceChars.forEach((character, cell) => {
        const x = priceOrigin + pricePitch * cell
        if (character === ',') {
          text(',', FONT.price, { x, y: line2.baseline, fill: PAPER, stroke: PAPER }, line2.price.mover)
          return
        }
        // Clip window: the cell, exactly 1.0 em tall with its top at baseline − 0.80 em.
        const drumWindow = clipRect({ x, y: line2.baseline - 0.8 * em, width: pricePitch, height: em })
        const holder = svg('g', { 'clip-path': drumWindow.url }, line2.price.mover)
        const strip = svg('g', {}, holder)
        const drumIndex = line2.drums.length
        const digits = []
        for (let slot = 0; slot < DRUM_STRIP - 1; slot++) {
          let digit = Math.floor(hash(cell + 5, slot + 1) * 10)
          if (slot > 0 && digit === digits[slot - 1]) digit = (digit + 3) % 10
          if (slot === DRUM_STRIP - 2 && digit === Number(character)) digit = (digit + 5) % 10
          digits.push(digit)
        }
        // Analytic smear: at full spin a drum moves ~970 px per frame, far past what 8-subframe
        // accumulation can blend (it strobes into stripes), so each drum also draws a short
        // trail of fading ghost strips behind the real one. They collapse under it as it locks.
        const ghosts = SMEAR_GHOSTS.map((opacity) => {
          const ghost = svg('g', { 'fill-opacity': opacity }, holder)
          digits.forEach((digit, slot) => text(String(digit), FONT.price, { x, y: line2.baseline + em * slot, fill: PAPER }, ghost))
          text(character, FONT.price, { x, y: line2.baseline + em * (DRUM_STRIP - 1), fill: PAPER }, ghost)
          return ghost
        })
        holder.appendChild(strip)
        // Slots 0–10 spin past; slot 11 is the locked digit. Once a drum locks, its spinners are
        // hidden and its window released, so the fusion stroke can swell past the window freely.
        const spinners = svg('g', {}, strip)
        digits.forEach((digit, slot) => text(String(digit), FONT.price, { x, y: line2.baseline + em * slot, fill: PAPER, stroke: PAPER }, spinners))
        text(character, FONT.price, { x, y: line2.baseline + em * (DRUM_STRIP - 1), fill: PAPER, stroke: PAPER }, strip)
        line2.drums.push({ holder, clipUrl: drumWindow.url, strip, spinners, ghosts, lock: LOCKS[drumIndex] })
      })

      // RWF slides in from +80 px (thud) while a left-to-right wipe opens, so it never pops on.
      const unitHomeLeft = unitOrigin + unitInk.left
      line2.unit = {
        clip: clipRect({ x: unitHomeLeft - 10, y: 0, width: 0, height: 1080 }),
        homeLeft: unitHomeLeft,
        width: unitInk.right - unitInk.left,
      }
      line2.unit.holder = svg('g', { 'clip-path': line2.unit.clip.url }, line2.glyphs)
      line2.unit.mover = svg('g', {}, line2.unit.holder)
      text('RWF', FONT.unit, { x: unitOrigin, y: line2.baseline, fill: PAPER, stroke: PAPER }, line2.unit.mover)

      line2.month = riser(line2.glyphs, { t0: MONTH_RISE[0], duration: MONTH_RISE[1], edge: edge2, depth: Math.ceil(monthInk.ascent + MASK_OFFSET + 6), allow: allowance(monthInk.descent) })
      line2.month.node = text('/ month', FONT.serif, { x: monthOrigin, y: line2.baseline, fill: INK, stroke: INK }, line2.month.mover)
      line2.inkNodes = [line2.from.node, line2.month.node]

      // =========================================================================================
      // LINE 3 — "pay with Mobile Money." Serif italic 110 (ink) · Inter 120 (paper, 300 → 800
      // wave, centres fixed at their 800 positions) · the ink period (a circle; it becomes the LED).
      // Same ink gap as line 2; Inter's tracking is solved so the y ends where Inter would set the
      // period, whose ink is the handoff dot at (1430.7, 838) r 12.
      // =========================================================================================
      const line3 = makeLine(2, 120)
      const edge3 = line3.baseline + MASK_OFFSET
      const payOrigin = line3.x0 - payInk.left
      const payInkRight = payOrigin + payInk.right
      const moneyChars = [...moneyText]
      const periodInk = scan('.', FONT.money)
      const periodOriginInContext = measure(`${moneyText}.`, FONT.money).advance - periodInk.advance
      const naturalPeriodGap = periodOriginInContext + periodInk.left - moneyInk.right
      const moneyGap = opticalGap - junction(payInk, moneyInk, Math.min(cap.serif, cap.money))
      const moneyInkLeft = payInkRight + moneyGap
      const moneyInkRight = DOT.cx - DOT.r - naturalPeriodGap
      const tracking = (moneyInkRight - moneyInkLeft - (moneyInk.right - moneyInk.left)) / (moneyChars.length - 1)
      const moneyOrigin = moneyInkLeft - moneyInk.left

      line3.pay = riser(line3.glyphs, { t0: PAY_RISE[0], duration: PAY_RISE[1], edge: edge3, depth: Math.ceil(payInk.ascent + MASK_OFFSET + 6), allow: allowance(payInk.descent) })
      line3.pay.node = text('pay with', FONT.serif, { x: payOrigin, y: line3.baseline, fill: INK, stroke: INK }, line3.pay.mover)

      const moneyLight = measure(moneyText, FONT.money, 300)
      line3.money = riser(line3.glyphs, {
        t0: MM_RISE[0], duration: MM_RISE[1], edge: edge3,
        depth: Math.ceil(Math.max(moneyInk.ascent, moneyLight.ascent) + MASK_OFFSET + 6), allow: allowance(moneyInk.descent),
      })
      line3.moneyGlyphs = moneyChars.map((character, index) => {
        if (character === ' ') return null
        const left = moneyOrigin + measure(moneyText.slice(0, index), FONT.money).advance + tracking * index
        const centre = left + measure(character, FONT.money).advance / 2
        return { index, node: text(character, FONT.money, { x: centre, y: line3.baseline, 'text-anchor': 'middle', fill: PAPER, stroke: PAPER }, line3.money.mover, 300) }
      }).filter(Boolean)
      line3.inkNodes = [line3.pay.node]
      // The ink period sits above the bar: it is excluded from the fuse and handed to s06.
      line3.dot = svg('circle', { cx: DOT.cx, cy: DOT.cy, r: 0, fill: INK }, line3.group)

      // The solved justification, exposed for verification scripts (read-only, never used by render).
      root.__layout = {
        line1: { origin: deployOrigin, pitch: deployPitch, tracking: deployPitch - deployAdvance, inkLeft: deployOrigin + firstInk.left, inkRight: deployOrigin + deployPitch * (deployChars.length - 1) + lastInk.right },
        line2: { opticalGap, inkGaps, indents, fromOrigin, priceOrigin, unitOrigin, monthOrigin, inkStarts, inkWidths, inkRight: monthOrigin + monthInk.right },
        line3: { payOrigin, payInkRight, moneyGap, moneyInkLeft, moneyInkRight, moneyOrigin, tracking, naturalPeriodGap },
        cap,
      }

      return {
        PAPER, INK, lines: [line1, line2, line3], line1, line2, line3,
        thud: api.ease.spring({ stiffness: 600, damping: 40, mass: 1, duration: 0.3 }),
      }
    },

    render(t, state, api) {
      const { progress, ease, lerp, setAttrs, round } = api
      const { line1, line2, line3, PAPER, INK } = state

      // A rise through the line's baseline machine: translateY depth → 0 (reveal), the mask edge
      // easing down by the element's descender allowance as it lands.
      const rise = (item, x = 0) => {
        const amount = ease.snappy(progress(t, item.t0, item.t0 + item.duration))
        setAttrs(item.holder, { visibility: t >= item.t0 ? 'visible' : 'hidden' })
        setAttrs(item.mover, { transform: `translate(${round(x, 3)} ${round(item.depth * (1 - amount), 3)})` })
        setAttrs(item.clip.rect, { height: round(200 + item.edge + item.allow * amount, 3) })
      }

      // ---- LINE 1: typing + caret
      const typed = t < TYPE_START ? 0 : Math.min(line1.chars.length, Math.floor((t - TYPE_START) / TYPE_EACH + 1e-6) + 1)
      line1.chars.forEach((node, index) => { if (node) setAttrs(node, { visibility: index < typed ? 'visible' : 'hidden' }) })
      setAttrs(line1.caret, {
        visibility: t < CARET_OFF ? 'visible' : 'hidden',
        x: round(line1.origin + line1.pitch * typed + line1.caretInset, 3),
      })

      // ---- LINE 2: from / drums / RWF / month
      rise(line2.from)
      rise(line2.price)
      for (const drum of line2.drums) {
        const amount = progress(t, ROLL_START, drum.lock)
        const travel = (DRUM_STRIP - 1) * 220
        const offset = -travel * ease.outCubic(amount)
        const locked = t >= drum.lock
        // outCubic velocity (px/s) → trail length covering one subframe step of the 0.5 shutter.
        const trail = locked ? 0 : (3 * travel * (1 - amount) ** 2) / (drum.lock - ROLL_START) * SMEAR_SECONDS
        drum.ghosts.forEach((ghost, index) => setAttrs(ghost, {
          visibility: trail > 0.5 ? 'visible' : 'hidden',
          transform: `translate(0 ${round(offset + (trail * (index + 1)) / SMEAR_GHOSTS.length, 3)})`,
        }))
        setAttrs(drum.strip, { transform: `translate(0 ${round(offset, 3)})` })
        setAttrs(drum.spinners, { visibility: locked ? 'hidden' : 'visible' })
        setAttrs(drum.holder, { 'clip-path': locked ? 'none' : drum.clipUrl })
      }
      const unit = line2.unit
      const slide = 80 * (1 - state.thud(progress(t, RWF_SLIDE[0], RWF_SLIDE[0] + RWF_SLIDE[1])))
      const wipe = ease.snappy(progress(t, RWF_SLIDE[0], RWF_SLIDE[0] + RWF_WIPE))
      setAttrs(unit.holder, { visibility: t >= RWF_SLIDE[0] ? 'visible' : 'hidden' })
      setAttrs(unit.mover, { transform: `translate(${round(slide, 3)} 0)` })
      setAttrs(unit.clip.rect, { width: round(Math.max(0, 10 + slide + wipe * (unit.width + 20)), 3) })
      rise(line2.month)

      // ---- LINE 3: pay with / Mobile Money (weight wave + phone buzz) / ink period
      rise(line3.pay)
      const buzz = BUZZ.amplitude * Math.sin(2 * Math.PI * BUZZ.hz * (t - BUZZ.from)) * (1 - progress(t, BUZZ.from, BUZZ.to))
      rise(line3.money, buzz)
      for (const glyph of line3.moneyGlyphs) {
        const waveStart = WAVE.start + WAVE.each * glyph.index
        const weight = lerp(300, 800, ease.inOutCubic(progress(t, waveStart, waveStart + WAVE.duration)))
        setAttrs(glyph.node, { 'font-weight': round(weight, 1) })
      }
      const dotRadius = 12 * ease.outBack(progress(t, DOT_POP[0], DOT_POP[0] + DOT_POP[1]))
      setAttrs(line3.dot, { r: round(Math.max(0, dotRadius), 3), visibility: t >= DOT_POP[0] ? 'visible' : 'hidden' })

      // ---- FUSE: stroke swells, the clip band closes onto the cap band, the bar grows from the
      // band's midline (inQuad). Each line ends as its exact handoff rect.
      state.lines.forEach((line, index) => {
        const [fuseStart, fuseEnd] = FUSES[index]
        const amount = progress(t, fuseStart, fuseEnd)
        setAttrs(line.glyphs, {
          'stroke-width': round(0.45 * line.cap * ease.outQuad(amount), 3),
          display: amount >= 1 ? 'none' : 'inline',
        })
        const bandAmount = ease.inOutCubic(amount)
        const top = lerp(line.baseline - 1.3 * line.size, line.baseline - line.cap, bandAmount)
        const bottom = lerp(line.baseline + 0.4 * line.size, line.baseline, bandAmount)
        setAttrs(line.band.rect, { y: round(top, 3), height: round(bottom - top, 3) })
        const barHeight = line.cap * ease.inQuad(amount)
        setAttrs(line.barRect, {
          y: round(line.baseline - line.cap / 2 - barHeight / 2, 3),
          height: round(barHeight, 3),
          visibility: amount > 0 ? 'visible' : 'hidden',
        })
        if (line.inkNodes) {
          const color = mixColor(INK, PAPER, ease.outQuart(progress(t, fuseStart, fuseStart + INK_TO_PAPER)))
          for (const node of line.inkNodes) setAttrs(node, { fill: color, stroke: color })
        }
      })
    },
  })
})()
