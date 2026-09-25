// s03-snap · 6.500–8.700 s · z 6 — THE HERO SNAP, then LOCAL.
// First frame = s02's exit state, drawn by the same shared functions. Two beats:
//   6.500 THE SNAP at Z ≈ 1.1 — the far end whips from the dragged Cape Town end home to Kigali on
//         an analytic spring (home 6.573, 35% overshoot peak 6.618), a slate → violet colour front
//         runs out along the lanes, Cape Town pops out, and the impact ripples through the continent.
//   6.750 CRASH ZOOM 1.1 → 20× (log scale) — the continent streaks past (per-dot jittered streak
//         phase, so the regular grid never moirés) and Rwanda re-samples 1 dot → 828 once Z ≥ 4.
// Then the three real logo slabs lock onto Kigali as the Kigali-1 pin (7.0625 / 7.094 / 7.125),
// the LED lights, the odometer rolls down to 10–30 ms with "Strettch Cloud · Kigali-1", and the
// hold breathes with heartbeat rings and ripples through lit Rwanda on 7.50 and 8.00.
// Everything on the map is gone at 8.495 (s04 cuts in there); only the HUD finishes sinking.
(() => {
  // The storyboard sank the HUD from 8.50–8.66, which left "10–30 ms" printed beside s04's bursting
  // "Data stays in-country." for ~6 frames. Starting 60 ms earlier with a shorter sink clears the
  // HUD by ~8.59, as s04's glyphs start to spread.
  const HUD_EXIT_START = 8.44
  const HUD_EXIT_DURATION = 0.1
  // Streak jitter buckets: each dot gets one (head delay, streak length) pair, so the streaks of the
  // regular 1° grid start and end at irregular radii instead of forming moiré rings.
  const BUCKETS = 32
  const STREAK_BASE = 0.0021 // s, the plain streak (identical to s02 when the camera is still)

  SC.scene({
    id: 's03-snap',
    start: 6.5,
    end: 8.7,
    z: 6,

    build(root, api) {
      const S = window.SC_SHARED
      const { COLOR, TIME } = S
      const { canvas, context } = S.createMapCanvas(root)
      const field = S.dotField()
      const fine = S.rwandaFineDots()
      // Per-dot streak bucket (coarse field and fine dots use different hash seeds).
      const coarseBucket = new Uint8Array(field.count)
      for (let index = 0; index < field.count; index++) coarseBucket[index] = Math.floor(api.hash(index, 71) * BUCKETS)
      const fineBucket = new Uint8Array(fine.count)
      for (let index = 0; index < fine.count; index++) fineBucket[index] = Math.floor(api.hash(index, 73) * BUCKETS)
      // Sideways jitter (unit perpendicular to each dot's ray from Kigali × a hashed −1…1): during
      // the fastest part of the zoom, dots that share a ray (the grid row and column through
      // Kigali, the diagonals) split into strands instead of drawing one hard crosshair.
      const perpX = new Float64Array(field.count)
      const perpY = new Float64Array(field.count)
      for (let index = 0; index < field.count; index++) {
        const d = field.distance[index] || 1
        const h = 2 * api.hash(index, 77) - 1
        perpX[index] = (-field.ry[index] / d) * h
        perpY[index] = (field.rx[index] / d) * h
      }
      const bucketDelay = new Float64Array(BUCKETS)
      const bucketLength = new Float64Array(BUCKETS)
      for (let bucket = 0; bucket < BUCKETS; bucket++) {
        bucketDelay[bucket] = 0.003 * api.hash(bucket, 81)
        bucketLength[bucket] = 0.0025 + 0.0045 * api.hash(bucket, 83)
      }
      // LOD by zoom: fine dot j grows (log-Z progress over a ×1.8 zoom range) from
      // Z_j = 4·(1 + 0.6·dist_j / dist_max), so Rwanda lights from Kigali outward.
      const fineLogStart = new Float64Array(fine.count)
      for (let index = 0; index < fine.count; index++) fineLogStart[index] = Math.log(TIME.lodZ * (1 + (0.6 * fine.distance[index]) / fine.maxDistance))

      // Pin: the real mark at u = 4 (height 128), nested in a full-frame SVG so it sits at exact
      // sub-pixel coordinates. Its LED hole centre (2.857, 28.977) lands exactly on Kigali.
      const pinSvg = api.svg('svg', { width: 1920, height: 1080, viewBox: '0 0 1920 1080' }, root)
      pinSvg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible'
      const logo = api.createLogo(pinSvg, { markOnly: true, height: 128 })
      api.setAttrs(logo.root, { x: 1548.57, y: 414.09 })
      // The LED disc sits UNDER the mark so it only shows through the evenodd hole.
      const ledDisc = api.svg('circle', { cx: 2.857, cy: 28.977, r: 3.5 / 4, fill: COLOR.violetLight })
      logo.root.insertBefore(ledDisc, logo.markGroup)
      // Slab flam in px (÷4 → logo units); centres are each slab's bbox centre. Each slides for
      // TIME.slabSlide and lands on TIME.slabLands[i]; exits reverse from the HUD exit.
      const slabs = [
        { name: 'bottom', land: TIME.slabLands[0], offset: [-170, 0], centre: [13.76, 28.977], exit: HUD_EXIT_START + 0.03 },
        { name: 'middle', land: TIME.slabLands[1], offset: [-158.8, 19.8], centre: [16.979, 18.86], exit: HUD_EXIT_START + 0.015 },
        { name: 'top', land: TIME.slabLands[2], offset: [153.5, -45.2], centre: [17, 7.921], exit: HUD_EXIT_START },
      ].map((slab) => ({ ...slab, start: slab.land - TIME.slabSlide, node: logo.slabs[slab.name], polygon: api.logoSlabs[slab.name] }))
      // LED halo: the pre-rendered sprite at r 22, above the mark. Additive, so it reads as light
      // on the violet slab (a plain 60% violetLight wash is nearly invisible on #6B63FF).
      const ledHalo = api.el('canvas', { attrs: { width: 88, height: 88 } }, root)
      ledHalo.style.cssText = 'position:absolute;left:0;top:0;width:44px;height:44px;transform:translate(1538px,508px);mix-blend-mode:plus-lighter'
      ledHalo.getContext('2d').drawImage(S.haloSprite(), 0, 0, 88, 88)

      // HUD: s02's HUD at identical positions, odometer in SLOT mode with 5 cells, plus the
      // local kicker and the slate comparison line.
      const strips = [
        S.slotStrip(0, '~', '1'),
        S.slotStrip(1, '1', '0'),
        S.slotStrip(2, '1', '–'),
        S.slotStrip(3, '0', '3'),
        S.slotStrip(4, '', '0'),
      ]
      const hud = S.buildHud(root, { id: 's03', strips, localKicker: true, compare: true })

      const capacity = field.count + fine.count + 8
      return {
        S, canvas, context, field, fine, fineLogStart, coarseBucket, fineBucket, bucketDelay, bucketLength, perpX, perpY,
        pinSvg, logo, ledDisc, ledHalo, slabs, hud,
        halo: S.haloSprite(),
        segs: new Float64Array(capacity * 4),
        radii: new Float64Array(capacity),
        headZ: new Float64Array(BUCKETS),
        tailZ: new Float64Array(BUCKETS),
      }
    },

    render(t, state, api) {
      const { S, hud } = state
      const { progress, tween, setAttrs, setStyle } = api
      const { COLOR, TIME } = S
      const worldOn = t < TIME.cut // map, pin and LED: gone on s04's first frame

      // ---------------------------------------------------------------------------------------
      // Pin: three-slab flam onto Kigali, exits reversed with the HUD (cut off at 8.495).
      // ---------------------------------------------------------------------------------------
      const slabStates = state.slabs.map((slab) => slabState(slab, t, S, api))

      setStyle(state.canvas, { display: worldOn ? 'block' : 'none' })
      setStyle(state.pinSvg, { display: worldOn ? 'block' : 'none' })
      if (worldOn) drawMap(t, state, api, slabOccluders(state.slabs, slabStates))

      state.slabs.forEach((slab, index) => {
        const { ox, oy, stretch, opacity } = slabStates[index]
        const [cx, cy] = slab.centre
        const transform = `translate(${api.round(ox, 4)} ${api.round(oy, 4)}) translate(${cx} ${cy}) scale(${api.round(stretch, 5)} 1) translate(${-cx} ${-cy})`
        setAttrs(slab.node, { transform, opacity: api.round(opacity, 4) })
        if (slab.name === 'bottom') setAttrs(state.ledDisc, { transform })
      })
      // LED: lights at TIME.lock (the packet has been sitting in the hole), blinks on the beats.
      const ledOn = t >= TIME.lock && worldOn
      setAttrs(state.ledDisc, { opacity: ledOn ? 1 : 0 })
      let ledAlpha = 0.6 + 0.4 * (1 - progress(t, TIME.lock, TIME.lock + 0.2)) // lock flash
      for (const beat of TIME.beats) {
        if (t >= beat && t < beat + 0.15) ledAlpha += 0.4 * Math.sin(Math.PI * progress(t, beat, beat + 0.15))
      }
      setStyle(state.ledHalo, { opacity: ledOn ? String(api.round(Math.min(1, ledAlpha), 4)) : '0' })

      // ---------------------------------------------------------------------------------------
      // HUD
      // ---------------------------------------------------------------------------------------
      const { ODOMETER: O, HUD } = S
      // "peaks at 200 ms" sinks with the snap; "per request" stays: it is the unit of both numbers.
      setAttrs(hud.peaksRise, { transform: S.translateY(S.sink(t, 6.5, 0.1, HUD.peaks.depth)) })
      setAttrs(hud.perRise, { transform: S.translateY(S.sink(t, HUD_EXIT_START + 0.03, HUD_EXIT_DURATION, HUD.perRequest.depth)) })
      // The comparison line rises into the peaks slot once 10–30 ms has thudded in.
      setAttrs(hud.compareRise, {
        transform: S.translateY(t < HUD_EXIT_START ? S.rise(t, TIME.compare, 0.1, HUD.peaks.depth) : S.sink(t, HUD_EXIT_START + 0.045, HUD_EXIT_DURATION, HUD.peaks.depth)),
      })
      // Kicker roll inside the 336–382 window. The label changes together with the number (both
      // start at TIME.lock), so "Strettch Cloud · Kigali-1" never sits above "~110".
      const roll = S.EASE.reveal(progress(t, TIME.lock, TIME.lock + 0.2))
      setAttrs(hud.kickerA, { transform: S.translateY(-HUD.kicker.depth * roll) })
      setAttrs(hud.kickerB, { transform: S.translateY(HUD.kicker.depth * (1 - roll) + S.sink(t, HUD_EXIT_START, HUD_EXIT_DURATION, HUD.kicker.depth)) })
      // Unit "ms" snaps slate → violetLight over two frames with the roll, then slides 703 → 715.
      const rollEnd = TIME.locks[TIME.locks.length - 1]
      const carry = S.EASE.carry(progress(t, TIME.lock, rollEnd))
      const unitX = HUD.unit.x + 12 * carry
      setAttrs(hud.unitText, { fill: S.mix(COLOR.slate, COLOR.violetLight, progress(t, TIME.lock, TIME.lock + 2 / 60)), x: api.round(unitX, 3) })
      // Odometer roll-down (SLOT mode): scaleX 1.15 → 0.94 and wght 300 → 800 (carry), then THUD.
      const scaleX = 1.15 + (0.94 - 1.15) * carry
      const scaleY = t < TIME.thud[0] ? 1 : tween(t, TIME.thud[0], TIME.thud[1], 0.93, 1, S.EASE.thud)
      setAttrs(hud.numberGroup, { transform: S.numberTransform(scaleX, scaleY) })
      setStyle(hud.numberGroup, { fontWeight: String(api.round(300 + 500 * carry, 1)) })
      TIME.locks.forEach((lock, index) => {
        setAttrs(hud.cells[index].roll, { transform: S.translateY(-S.slotOffset(t, TIME.lock, lock) * O.em) })
      })
      // The fifth cell only exists right of the others once the group has compressed: it is
      // clipped at the unit's left edge so a rolling digit never draws through "ms".
      const edgeLocal = O.x + (unitX - 4 - O.x) / scaleX
      setAttrs(hud.edgeRect, { x: -4000, width: api.round(edgeLocal + 4000, 3) })
      // Exit ahead of s04's burst: kicker, number, unit sink 15 ms apart (see HUD_EXIT_START).
      setAttrs(hud.numberRise, { transform: S.translateY(S.sink(t, HUD_EXIT_START + 0.015, HUD_EXIT_DURATION, O.riseDepth)) })
      setAttrs(hud.unitRise, { transform: S.translateY(S.sink(t, HUD_EXIT_START + 0.03, HUD_EXIT_DURATION, O.riseDepth)) })
    },
  })

  // Slab motion at t, in logo units: slide in along its vector (exit ease = violent end) while
  // stretching 1 → 1.06 along X with speed, thud 1.06 → 1 on lock, reverse the vector on exit.
  function slabState(slab, t, S, api) {
    const { progress, tween } = api
    let shift = 0
    let stretch = 1
    let opacity = 0
    if (t >= slab.start && t < slab.exit + 0.12 && t < S.TIME.cut) {
      if (t < slab.land) {
        const amount = S.EASE.exit(progress(t, slab.start, slab.land))
        shift = 1 - amount
        stretch = 1 + 0.06 * amount
        opacity = progress(t, slab.start, slab.start + 0.03)
      } else if (t < slab.exit) {
        stretch = tween(t, slab.land, slab.land + 0.3, 1.06, 1, S.EASE.thud)
        opacity = 1
      } else {
        const amount = progress(t, slab.exit, slab.exit + 0.12)
        const eased = S.EASE.exit(amount)
        shift = eased
        stretch = 1 + 0.06 * eased
        opacity = 1 - progress(amount, 0.65, 1)
      }
    }
    return { ox: (slab.offset[0] * shift) / 4, oy: (slab.offset[1] * shift) / 4, stretch, opacity }
  }

  // The pin clears its own footprint in the dot matrix: whole dots whose centre lies within
  // PIN_CLEARANCE px of a visible slab are not drawn (no half-cut dots, no keyline). Returns the
  // slabs as screen-space convex polygons with outward edge normals.
  const PIN_ORIGIN = [1548.57, 414.09]
  const PIN_UNIT = 4
  const PIN_CLEARANCE = 7
  function slabOccluders(slabs, states) {
    const occluders = []
    slabs.forEach((slab, index) => {
      const { ox, oy, stretch, opacity } = states[index]
      if (opacity < 0.35) return
      const [cx] = slab.centre
      const points = slab.polygon.map(([x, y]) => [
        PIN_ORIGIN[0] + PIN_UNIT * (cx + (x - cx) * stretch + ox),
        PIN_ORIGIN[1] + PIN_UNIT * (y + oy),
      ])
      let area = 0
      points.forEach(([x0, y0], k) => {
        const [x1, y1] = points[(k + 1) % points.length]
        area += x0 * y1 - x1 * y0
      })
      const sign = area > 0 ? 1 : -1
      const edges = points.map(([x0, y0], k) => {
        const [x1, y1] = points[(k + 1) % points.length]
        const length = Math.hypot(x1 - x0, y1 - y0)
        // Outward normal for a polygon with signed area `sign` (screen y down).
        const nx = (sign * (y1 - y0)) / length
        const ny = (sign * -(x1 - x0)) / length
        return [nx, ny, nx * x0 + ny * y0]
      })
      occluders.push(edges)
    })
    return occluders
  }
  const occluded = (occluders, x, y) => {
    for (const edges of occluders) {
      let inside = true
      for (const [nx, ny, d] of edges) {
        if (nx * x + ny * y - d > PIN_CLEARANCE) {
          inside = false
          break
        }
      }
      if (inside) return true
    }
    return false
  }

  // Heartbeat: a ring from the LED and a ripple crest travelling through lit Rwanda, radius R(t).
  const BEAT_LIFE = 0.55
  const BEAT_REACH = 380
  const beatRadius = (u) => 4 + BEAT_REACH * SC.ease.outCubic(u)

  // One state of the recoiling band at time `time`: both lanes (or only the out lane for a
  // ghost), coloured by the slate → violet front, widths fattening as the band contracts.
  function drawBand(context, S, api, time, alpha, ghostOnly) {
    const { K, COLOR, TIME } = S
    const { progress } = api
    const E = S.farEnd(time)
    const route = S.lanes(E)
    const contraction = api.clamp(1 - route.L / S.lanes(S.E_RELEASE).L)
    const base = S.laneWidths(time)
    const widths = { out: base.out + 3.3 * contraction, ret: base.ret + 2.5 * contraction }
    const front = progress(time, TIME.front[0], TIME.front[1])
    const out = { alpha: base.outAlpha }
    const ret = { alpha: base.retAlpha }
    const outPoints = S.laneSamples(route, 'out', 0, 1)
    const retPoints = ghostOnly ? null : S.laneSamples(route, 'ret', 0, 1)
    if (front <= 0 && !ghostOnly && alpha >= 1) {
      // Exactly s02's exit state.
      S.strokeLane(context, retPoints, COLOR.slate, widths.ret, ret.alpha)
      S.strokeLane(context, outPoints, COLOR.slate, widths.out, out.alpha)
      return
    }
    const frontPx = 1.25 * front * route.L
    const style = (violetAlpha, slateAlpha) => {
      if (front <= 0) return S.rgba(COLOR.slate, slateAlpha)
      if (route.L < 1 || frontPx - 12 >= route.L) return S.rgba(COLOR.violetLight, violetAlpha)
      const gradient = context.createLinearGradient(K.x, K.y, E.x, E.y)
      const a = api.clamp((frontPx - 12) / route.L)
      const b = api.clamp(frontPx / route.L)
      gradient.addColorStop(0, S.rgba(COLOR.violetLight, violetAlpha))
      gradient.addColorStop(a, S.rgba(COLOR.violetLight, violetAlpha))
      gradient.addColorStop(b, S.rgba(COLOR.slate, slateAlpha))
      gradient.addColorStop(1, S.rgba(COLOR.slate, slateAlpha))
      return gradient
    }
    if (!ghostOnly) S.strokeLane(context, retPoints, style(0.8, ret.alpha), widths.ret, alpha)
    S.strokeLane(context, outPoints, style(1, out.alpha), widths.out, alpha)
  }

  // Dots and streaks with energy-conserving brightness: a still dot is opaque, a streak dims
  // with its length (to 55%), like a real exposure — so overlapping long streaks in the early
  // crash zoom do not pile up into a hatched sheet. Five alpha buckets, one batched path each.
  const STREAK_LEVELS = [1, 0.86, 0.74, 0.64, 0.55]
  const streakBuckets = STREAK_LEVELS.map(() => ({ segs: new Float64Array(4 * 4096), n: 0 }))
  function paintStreaks(context, S, color, segs, rs, n, commonRadius) {
    if (!n) return
    context.globalAlpha = 1
    context.fillStyle = color
    context.beginPath()
    for (const bucket of streakBuckets) bucket.n = 0
    const others = []
    for (let index = 0; index < n; index++) {
      const r = rs[index]
      if (r <= 0) continue
      const offset = index * 4
      const dx = segs[offset + 2] - segs[offset]
      const dy = segs[offset + 3] - segs[offset + 1]
      const length2 = dx * dx + dy * dy
      if (length2 < 0.09) {
        context.moveTo(segs[offset + 2] + r, segs[offset + 3])
        context.arc(segs[offset + 2], segs[offset + 3], r, 0, S.TAU)
        continue
      }
      if (r !== commonRadius) {
        others.push(index)
        continue
      }
      const alpha = 0.5 + (0.5 * 12) / (Math.sqrt(length2) + 6)
      let level = 0
      while (level < STREAK_LEVELS.length - 1 && alpha < (STREAK_LEVELS[level] + STREAK_LEVELS[level + 1]) / 2) level++
      const bucket = streakBuckets[level]
      if (bucket.n < 4096) {
        bucket.segs.set(segs.subarray(offset, offset + 4), bucket.n * 4)
        bucket.n++
      }
    }
    context.fill()
    streakBuckets.forEach((bucket, level) => {
      if (!bucket.n) return
      context.globalAlpha = STREAK_LEVELS[level]
      S.strokeCapsules(context, color, commonRadius * 2, bucket.segs, bucket.n)
    })
    context.globalAlpha = 1
    if (others.length) {
      const otherSegs = new Float64Array(others.length * 4)
      const otherRadii = new Float64Array(others.length)
      others.forEach((index, k) => {
        otherSegs.set(segs.subarray(index * 4, index * 4 + 4), k * 4)
        otherRadii[k] = rs[index]
      })
      S.fillCapsules(context, color, otherSegs, otherRadii, others.length)
    }
  }

  // Map canvas for s03: dots (with jittered streaks) under the crash zoom, the snap shockwave,
  // LOD Rwanda with heartbeat ripples, the recoiling lanes, the packet, Kigali and Cape Town.
  function drawMap(t, state, api, occluders) {
    const { S, context, field, fine, fineLogStart, coarseBucket, fineBucket, bucketDelay, bucketLength, perpX, perpY, segs, radii, halo, headZ, tailZ } = state
    const { K, COLOR, TIME } = S
    const { progress, tween, ease } = api
    const W = api.WIDTH
    const H = api.HEIGHT
    S.resetContext(context)

    const Z = S.zoomZ(t)
    const logZ = Math.log(Z)
    // Streak endpoints per bucket. Outside the crash zoom every bucket is the plain
    // (t − 0.0021 → t) streak, so the 6.500 frame is s02's field to the pixel.
    const jitter = S.crashActive(t)
    for (let bucket = 0; bucket < BUCKETS; bucket++) {
      const head = t - jitter * bucketDelay[bucket]
      headZ[bucket] = jitter ? S.zoomZ(head) : Z
      tailZ[bucket] = S.zoomZ(head - (jitter ? bucketLength[bucket] : STREAK_BASE))
    }

    // THE SNAP's landing (TIME.home) sends a shockwave out through the dim continent: dots are
    // shoved up to 12 px outward (and swell a little) as a 60 px-wide crest passes at 2600 px/s.
    const shockAge = t - TIME.home
    const shockOn = shockAge > 0 && shockAge < 0.4
    const shockR = 2600 * shockAge
    const shockAmp = shockOn ? 12 * Math.pow(1 - shockAge / 0.4, 1.5) : 0

    // Zoom speed (d ln Z / dt) → 0…1 weight for the sideways strand jitter (up to 12 px).
    const zoomRate = (logZ - Math.log(S.zoomZ(t - 1 / 240))) * 240
    const strand = jitter ? 12 * api.clamp((zoomRate - 2) / 14) : 0

    // Adds a dot as a capsule from its tail to its head position; culls it when off-screen.
    let n = 0
    let sideX = 0
    let sideY = 0
    const push = (rx, ry, radius, bucket, distance) => {
      let zh = headZ[bucket]
      let zt = tailZ[bucket]
      let r = radius
      if (shockOn) {
        const screenDistance = distance * Z
        const crest = Math.exp(-(((screenDistance - shockR) / 60) ** 2))
        if (crest > 0.01 && screenDistance > 1) {
          const scale = 1 + (shockAmp * crest) / screenDistance
          zh *= scale
          zt *= scale
          r += 0.1 * shockAmp * crest
        }
      }
      const x = K.x + rx * zh + sideX
      const y = K.y + ry * zh + sideY
      const xp = K.x + rx * zt + sideX
      const yp = K.y + ry * zt + sideY
      if (Math.max(x, xp) < -r || Math.min(x, xp) > W + r || Math.max(y, yp) < -r || Math.min(y, yp) > H + r) return
      if (occluders.length && occluded(occluders, x, y)) return
      const offset = n * 4
      segs[offset] = xp
      segs[offset + 1] = yp
      segs[offset + 2] = x
      segs[offset + 3] = y
      radii[n] = r
      n++
    }

    // Coarse dot field (dotDim r 2.6), all of Africa: it streaks past during the crash zoom.
    for (let index = 0; index < field.count; index++) {
      if (index === field.rwandaIndex) continue
      if (strand > 0) {
        const reach = strand * Math.min(1, (field.distance[index] * Z) / 300)
        sideX = perpX[index] * reach
        sideY = perpY[index] * reach
      }
      push(field.rx[index], field.ry[index], field.radius, coarseBucket[index], field.distance[index])
    }
    sideX = 0
    sideY = 0
    paintStreaks(context, S, COLOR.dotDim, segs, radii, n, field.radius)

    // The coarse Rwanda dot hands over to the fine dots as Z passes 4 → 6.
    const lod = progress(logZ, Math.log(TIME.lodZ), Math.log(TIME.lodZ * 1.5))
    const coarseRadius = field.rwandaRadius * (1 - lod)
    if (coarseRadius > 0) {
      n = 0
      push(field.rx[field.rwandaIndex], field.ry[field.rwandaIndex], coarseRadius, coarseBucket[field.rwandaIndex], field.distance[field.rwandaIndex])
      if (n === 1 && segs[0] === segs[2] && segs[1] === segs[3]) S.fillDisc(context, COLOR.violetLight, segs[2], segs[3], radii[0])
      else S.fillCapsules(context, COLOR.violetLight, segs, radii, n)
    }

    // LOD re-sample by ZOOM: 828 fine Rwanda dots light from Kigali outward between Z 4 and
    // ~11.5; their radius tracks the grid pitch (0.6·Z px) up to 3.0 px, so Rwanda first reads
    // as a lit patch and resolves into a dot matrix as the camera lands.
    if (logZ > Math.log(TIME.lodZ)) {
      const pitchRadius = Math.min(3, Math.max(1.1, 0.18 * Z))
      const growSpan = Math.log(1.8)
      n = 0
      for (let index = 0; index < fine.count; index++) {
        const amount = (logZ - fineLogStart[index]) / growSpan
        if (amount <= 0) continue
        push(fine.rx[index], fine.ry[index], amount >= 1 ? pitchRadius : pitchRadius * ease.outBack(amount), fineBucket[index], fine.distance[index])
      }
      paintStreaks(context, S, COLOR.violetLight, segs, radii, n, pitchRadius)

      // Heartbeat ripples (7.50, 8.00): the crest brightens the dots it passes to lavender.
      for (const beat of TIME.beats) {
        const u = (t - beat) / BEAT_LIFE
        if (u <= 0 || u >= 1) continue
        const R = beatRadius(u)
        const strength = Math.pow(1 - u, 0.7)
        for (let index = 0; index < fine.count; index++) {
          const d = fine.distance[index] * Z
          const crest = Math.exp(-(((d - R) / 30) ** 2)) * strength
          if (crest < 0.04) continue
          const x = K.x + fine.rx[index] * Z
          const y = K.y + fine.ry[index] * Z
          if (occluders.length && occluded(occluders, x, y)) continue
          S.fillDisc(context, COLOR.lavender, x, y, pitchRadius + 1.6 * crest, crest)
        }
      }
    }

    // Rings, all from Kigali / the LED: the snap's landing, the LED lock, the heartbeats.
    const homeAge = t - TIME.home
    if (homeAge > 0 && homeAge < 0.35) {
      const u = homeAge / 0.35
      S.strokeRing(context, COLOR.violetLight, K.x, K.y, 9 + 110 * ease.outCubic(u), 3 * (1 - 0.5 * u), 0.9 * (1 - u))
    }
    const lockAge = t - TIME.lock
    if (lockAge > 0 && lockAge < 0.3) {
      const u = lockAge / 0.3
      S.strokeRing(context, COLOR.violetLight, K.x, K.y, 4 + 90 * ease.outCubic(u), 2, 0.9 * (1 - u))
    }
    for (const beat of TIME.beats) {
      const u = (t - beat) / BEAT_LIFE
      if (u <= 0 || u >= 1) continue
      S.strokeRing(context, COLOR.violetLight, K.x, K.y, beatRadius(u), 2.5, 0.85 * Math.pow(1 - u, 2.4))
    }

    // THE SNAP: lanes(E(t)) in screen space, recoiling into Kigali; fatter as they contract. Four
    // onion-skin ghosts of the out lane (9 ms apart) trace the whip's sweep during 6.50–6.70.
    if (t < TIME.lanesOut[1]) {
      const fade = 1 - progress(t, TIME.lanesOut[0], TIME.lanesOut[1])
      const ghostFade = 1 - progress(t, 6.62, 6.7)
      for (let k = 4; k >= 1 && ghostFade > 0; k--) {
        const ghostTime = t - 0.009 * k
        if (ghostTime < TIME.snap - 0.02) continue
        drawBand(context, S, api, ghostTime, 0.34 * (1 - k / 5) * ghostFade, true)
      }
      drawBand(context, S, api, t, fade, false)
    }

    // Kigali dot: r 9 (+ halo 27 @ 35%); punches to 15 as the band lands home, and gives way to
    // the pin as the bottom slab (which carries the LED hole) lands.
    const punch = Math.sin(Math.PI * progress(t, TIME.home, TIME.home + 0.14))
    const kigaliRadius = t < TIME.slabLands[0] ? 9 + 6 * punch : tween(t, TIME.slabLands[0], TIME.slabLands[0] + 0.05, 9, 0, S.EASE.exit)
    S.drawKigali(context, halo, kigaliRadius)
    if (punch > 0) S.drawSprite(context, halo, K.x, K.y, 3 * kigaliRadius, 0.45 * punch)

    // Packet (+ trail): rides the whip, is drawn into Kigali, sits in the LED hole until TIME.lock.
    if (t < TIME.lock + 0.1) S.drawPacket(context, t)

    // Cape Town: the node pops out where the band let go of it (1 → 0, inBack) with six slate
    // sparks, world-anchored so it also rides the zoom; the on-map label drops away with it.
    if (t < 6.62) {
      const zoom = Z / S.zoomZ(TIME.snap)
      const node = { x: K.x + (S.E_RELEASE.x - K.x) * zoom, y: K.y + (S.E_RELEASE.y - K.y) * zoom }
      S.drawCapeTownNode(context, node.x, node.y, 1 - ease.inBack(progress(t, 6.5, 6.58)))
      const gone = progress(t, 6.5, 6.6)
      S.drawCapeTownLabel(context, node, 9, 1 - gone, 14 * ease.inQuad(gone))
      const amount = progress(t, 6.5, 6.62)
      if (amount > 0 && amount < 1) {
        context.globalAlpha = 1 - amount
        context.strokeStyle = COLOR.slate
        context.lineWidth = 2
        context.lineCap = 'round'
        context.beginPath()
        for (let spark = 0; spark < 6; spark++) {
          const angle = ((spark + 0.5) / 6) * S.TAU + (api.hash(spark, 5) - 0.5) * 0.4
          const inner = 11 + 30 * ease.outCubic(amount)
          const outer = inner + 14 * (1 - amount)
          context.moveTo(node.x + Math.cos(angle) * inner, node.y + Math.sin(angle) * inner)
          context.lineTo(node.x + Math.cos(angle) * outer, node.y + Math.sin(angle) * outer)
        }
        context.stroke()
        context.globalAlpha = 1
      }
    }
  }
})()
