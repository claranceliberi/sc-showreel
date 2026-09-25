// s03-snap · 6.500–8.700 s · z 6 — THE HERO SNAP, then LOCAL.
// First frame = s02's exit state, drawn by the same shared functions. On the 6.50 downbeat the
// route's far end whips home on an analytic spring while a colour front drains slate to violet;
// the camera crash-zooms 20× into Rwanda (1 dot → 828); the three real logo slabs lock onto
// Kigali as the Kigali-1 pin, the packet lights the LED, and the odometer rolls down to 10–30 ms.
(() => {
  // The storyboard sank the HUD from 8.50–8.66, which left "10–30 ms" printed beside s04's bursting
  // "Data stays in-country." for ~6 frames. Starting 60 ms earlier with a shorter sink clears the
  // HUD (and the slab pin) by ~8.59, as s04's glyphs start to spread.
  const HUD_EXIT_START = 8.44
  const HUD_EXIT_DURATION = 0.1

  SC.scene({
    id: 's03-snap',
    start: 6.5,
    end: 8.7,
    z: 6,


    build(root, api) {
      const S = window.SC_SHARED
      const { COLOR } = S
      const { canvas, context } = S.createMapCanvas(root)
      const field = S.dotField()
      const fine = S.rwandaFineDots()
      // LOD re-sample: fine dot j grows at t_j = 6.75 + 0.15·(dist_j / dist_max).
      const fineStart = new Float64Array(fine.count)
      for (let index = 0; index < fine.count; index++) fineStart[index] = 6.75 + (0.15 * fine.distance[index]) / fine.maxDistance

      // Pin: the real mark at u = 4 (height 128), nested in a full-frame SVG so it sits at exact
      // sub-pixel coordinates. Its LED hole centre (2.857, 28.977) lands exactly on Kigali.
      const pinSvg = api.svg('svg', { width: 1920, height: 1080, viewBox: '0 0 1920 1080' }, root)
      pinSvg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible'
      const logo = api.createLogo(pinSvg, { markOnly: true, height: 128 })
      api.setAttrs(logo.root, { x: 1548.57, y: 414.09 })
      // The LED disc sits UNDER the mark so it only shows through the evenodd hole.
      const ledDisc = api.svg('circle', { cx: 2.857, cy: 28.977, r: 3.5 / 4, fill: COLOR.violetLight })
      logo.root.insertBefore(ledDisc, logo.markGroup)
      // Slab choreography in px (÷4 → logo units); centres are each slab's bbox centre.
      const slabs = [
        { name: 'bottom', start: 6.81, offset: [-170, 0], centre: [13.76, 28.977], exit: HUD_EXIT_START + 0.03 },
        { name: 'middle', start: 6.845, offset: [-158.8, 19.8], centre: [16.979, 18.86], exit: HUD_EXIT_START + 0.015 },
        { name: 'top', start: 6.88, offset: [153.5, -45.2], centre: [17, 7.921], exit: HUD_EXIT_START },
      ].map((slab) => ({ ...slab, node: logo.slabs[slab.name], polygon: api.logoSlabs[slab.name] }))
      // LED halo: the pre-rendered sprite at r 22, above the mark. Additive, so it reads as light
      // on the violet slab (a plain 60% violetLight wash is nearly invisible on #6B63FF).
      const ledHalo = api.el('canvas', { attrs: { width: 88, height: 88 } }, root)
      ledHalo.style.cssText = 'position:absolute;left:0;top:0;width:44px;height:44px;transform:translate(1538px,508px);mix-blend-mode:plus-lighter'
      ledHalo.getContext('2d').drawImage(S.haloSprite(), 0, 0, 88, 88)

      // HUD: s02's HUD at identical positions, odometer in SLOT mode with 5 cells.
      const strips = [
        S.slotStrip(0, '~', '1'),
        S.slotStrip(1, '1', '0'),
        S.slotStrip(2, '1', '–'),
        S.slotStrip(3, '0', '3'),
        S.slotStrip(4, '', '0'),
      ]
      const hud = S.buildHud(root, { id: 's03', strips, localKicker: true })

      const capacity = field.count + fine.count + 8
      return {
        S, canvas, context, field, fine, fineStart, logo, ledDisc, ledHalo, slabs, hud,
        halo: S.haloSprite(),
        segs: new Float64Array(capacity * 4),
        radii: new Float64Array(capacity),
        locks: [7.0625, 7.109, 7.156, 7.203, 7.25],
      }
    },

    render(t, state, api) {
      const { S, hud } = state
      const { progress, tween, setAttrs, setStyle } = api
      const { COLOR } = S

      // ---------------------------------------------------------------------------------------
      // Pin: three-slab flam onto Kigali (6.81 / 6.845 / 6.88), exits reversed with the HUD.
      // ---------------------------------------------------------------------------------------
      const slabStates = state.slabs.map((slab) => slabState(slab, t, S, api))

      // ---------------------------------------------------------------------------------------
      // Map canvas — renders only for t < 8.500 (s04's silhouette takes the world there).
      // ---------------------------------------------------------------------------------------
      const mapOn = t < 8.5
      setStyle(state.canvas, { display: mapOn ? 'block' : 'none' })
      if (mapOn) drawMap(t, state, api, slabOccluders(state.slabs, slabStates))

      state.slabs.forEach((slab, index) => {
        const { ox, oy, stretch, opacity } = slabStates[index]
        const [cx, cy] = slab.centre
        const transform = `translate(${api.round(ox, 4)} ${api.round(oy, 4)}) translate(${cx} ${cy}) scale(${api.round(stretch, 5)} 1) translate(${-cx} ${-cy})`
        setAttrs(slab.node, { transform, opacity: api.round(opacity, 4) })
        if (slab.name === 'bottom') setAttrs(state.ledDisc, { transform })
      })
      // LED: lights at 7.000 (the packet arrives), blinks at 7.50 and 8.00, off at 8.500.
      const ledOn = t >= 7.0 && t < 8.5
      setAttrs(state.ledDisc, { opacity: ledOn ? 1 : 0 })
      let ledAlpha = 0.6
      for (const blink of [7.5, 8.0]) {
        if (t >= blink && t < blink + 0.15) ledAlpha += 0.4 * Math.sin(Math.PI * progress(t, blink, blink + 0.15))
      }
      setStyle(state.ledHalo, { opacity: ledOn ? String(api.round(ledAlpha, 4)) : '0' })

      // ---------------------------------------------------------------------------------------
      // HUD
      // ---------------------------------------------------------------------------------------
      const { ODOMETER: O, HUD } = S
      // "per request" and "peaks at 200 ms" sink (6.50–6.60).
      setAttrs(hud.perRise, { transform: S.translateY(S.sink(t, 6.5, 0.1, HUD.perRequest.depth)) })
      setAttrs(hud.peaksRise, { transform: S.translateY(S.sink(t, 6.5, 0.1, HUD.peaks.depth)) })
      // Kicker roll inside the 336–382 window, local kicker sinks out with the HUD exit.
      // The storyboard rolled it at 6.55–6.75, but then "Strettch Cloud · Kigali-1" sat above the
      // still-unrolled "~110 ms" for half a second — attributing the far region's latency to SC.
      // The label now changes together with the number (odometer roll-down starts at 7.00).
      const KICKER_ROLL_START = 7.0
      const roll = S.EASE.reveal(progress(t, KICKER_ROLL_START, KICKER_ROLL_START + 0.2))
      setAttrs(hud.kickerA, { transform: S.translateY(-HUD.kicker.depth * roll) })
      setAttrs(hud.kickerB, { transform: S.translateY(HUD.kicker.depth * (1 - roll) + S.sink(t, HUD_EXIT_START, HUD_EXIT_DURATION, HUD.kicker.depth)) })
      // Unit "ms" snaps slate → violetLight over two frames with the kicker roll, then slides 703 → 715.
      const carry = S.EASE.carry(progress(t, 7.0, 7.25))
      const unitX = HUD.unit.x + 12 * carry
      setAttrs(hud.unitText, { fill: S.mix(COLOR.slate, COLOR.violetLight, progress(t, KICKER_ROLL_START, KICKER_ROLL_START + 2 / 60)), x: api.round(unitX, 3) })
      // Odometer roll-down (SLOT mode): scaleX 1.15 → 0.94 and wght 300 → 800 (carry), then THUD.
      const scaleX = 1.15 + (0.94 - 1.15) * carry
      const scaleY = t < 7.25 ? 1 : tween(t, 7.25, 7.55, 0.93, 1, S.EASE.thud)
      setAttrs(hud.numberGroup, { transform: S.numberTransform(scaleX, scaleY) })
      setStyle(hud.numberGroup, { fontWeight: String(api.round(300 + 500 * carry, 1)) })
      state.locks.forEach((lock, index) => {
        setAttrs(hud.cells[index].roll, { transform: S.translateY(-S.slotOffset(t, 7.0, lock) * O.em) })
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
    const slideEnd = slab.start + 0.12
    let shift = 0
    let stretch = 1
    let opacity = 0
    if (t >= slab.start && t < slab.exit + 0.12) {
      if (t < slideEnd) {
        const amount = S.EASE.exit(progress(t, slab.start, slideEnd))
        shift = 1 - amount
        stretch = 1 + 0.06 * amount
        opacity = progress(t, slab.start, slab.start + 0.03)
      } else if (t < slab.exit) {
        stretch = tween(t, slideEnd, slideEnd + 0.3, 1.06, 1, S.EASE.thud)
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

  // Map canvas for s03: dots (with streaks) under the crash zoom, LOD Rwanda, the snapping lanes,
  // the packet, Kigali and the Cape Town node pop.
  function drawMap(t, state, api, occluders) {
    const { S, context, field, fine, fineStart, segs, radii, halo } = state
    const { K, C, COLOR } = S
    const { progress, tween, ease } = api
    const W = api.WIDTH
    const H = api.HEIGHT
    S.resetContext(context)

    const Z = S.zoomZ(t)
    const Zprev = S.zoomZ(t - 0.0021)
    // Adds dot k as a capsule from its position at t − 0.0021 to t; culls it when off-screen.
    let n = 0
    const push = (rx, ry, radius) => {
      const x = K.x + rx * Z
      const y = K.y + ry * Z
      const xp = K.x + rx * Zprev
      const yp = K.y + ry * Zprev
      if (Math.max(x, xp) < -radius || Math.min(x, xp) > W + radius || Math.max(y, yp) < -radius || Math.min(y, yp) > H + radius) return
      if (occluders.length && occluded(occluders, x, y)) return
      const offset = n * 4
      segs[offset] = xp
      segs[offset + 1] = yp
      segs[offset + 2] = x
      segs[offset + 3] = y
      radii[n] = radius
      n++
    }

    // Coarse dot field (dotDim r 2.6).
    for (let index = 0; index < field.count; index++) {
      if (index !== field.rwandaIndex) push(field.rx[index], field.ry[index], field.radius)
    }
    S.paintDots(context, COLOR.dotDim, segs, radii, n, field.radius)

    // The coarse Rwanda dot, shrinking to 0 over 6.80–6.93.
    n = 0
    const coarseRadius = t < 6.8 ? field.rwandaRadius : tween(t, 6.8, 6.93, field.rwandaRadius, 0, S.EASE.exit)
    if (coarseRadius > 0) {
      push(field.rx[field.rwandaIndex], field.ry[field.rwandaIndex], coarseRadius)
      if (n === 1 && segs[0] === segs[2] && segs[1] === segs[3]) S.fillDisc(context, COLOR.violetLight, segs[2], segs[3], coarseRadius)
      else S.fillCapsules(context, COLOR.violetLight, segs, radii, n)
    }

    // LOD re-sample: 828 fine Rwanda dots grow r 0 → 3.0 (outBack, 0.15 s).
    if (t >= 6.75) {
      n = 0
      for (let index = 0; index < fine.count; index++) {
        const amount = progress(t, fineStart[index], fineStart[index] + 0.15)
        if (amount <= 0) continue
        push(fine.rx[index], fine.ry[index], amount >= 1 ? 3 : 3 * ease.outBack(amount))
      }
      S.paintDots(context, COLOR.violetLight, segs, radii, n, 3)
    }

    // THE SNAP: lanes(E(t)) with the colour front; hidden from 7.000.
    if (t < 7.0) {
      const E = S.snapE(t)
      const route = S.lanes(E)
      const front = progress(t, 6.5, 6.62)
      const outPoints = S.laneSamples(route, 'out', 0, 1)
      const retPoints = S.laneSamples(route, 'ret', 0, 1)
      const { out, ret } = S.LANE_STYLE
      if (front <= 0) {
        // Exactly s02's exit state.
        S.strokeLane(context, retPoints, COLOR.slate, ret.width, ret.alpha)
        S.strokeLane(context, outPoints, COLOR.slate, out.width, out.alpha)
      } else {
        const frontPx = 1.25 * front * route.L
        const style = (violetAlpha, slateAlpha) => {
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
        S.strokeLane(context, retPoints, style(0.8, ret.alpha), ret.width + 0.5 * front, 1)
        S.strokeLane(context, outPoints, style(1, out.alpha), out.width + 0.5 * front, 1)
      }
    }

    // Packet (+ trail draining into the LED until 7.096).
    if (t < 7.1) S.drawPacket(context, t)

    // Kigali dot: r 9 (+ halo 27 @ 35%), shrinking to 0 over 6.80–6.93 as the pin takes over.
    S.drawKigali(context, halo, t < 6.8 ? 9 : tween(t, 6.8, 6.93, 9, 0, S.EASE.exit))

    // Cape Town node: world-anchored (flies off with the zoom), pops out 1 → 0 (inBack) with
    // six slate sparks.
    if (t < 6.62) {
      const node = { x: K.x + (C.x - K.x) * Z, y: K.y + (C.y - K.y) * Z }
      S.drawCapeTownNode(context, node.x, node.y, 1 - ease.inBack(progress(t, 6.5, 6.58)))
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
