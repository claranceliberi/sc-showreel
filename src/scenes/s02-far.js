// s02-far · 3.250–6.500 s · z 5 — PROBLEM, THE TENSION.
// The continent assembles as a shockwave out of Kigali (the period). A request travels to the
// nearest hyperscaler region in Cape Town and back while the odometer counts to ~110 ms. The
// route is plucked on the 200 ms spike and trembles under a riser, then freezes at 6.500 into the
// exact state s03-snap re-creates (all shared formulas live in shared-map.js).
SC.scene({
  id: 's02-far',
  start: 3.25,
  end: 6.5,
  z: 5,

  build(root, api) {
    const S = window.SC_SHARED
    const { canvas, context } = S.createMapCanvas(root)
    const field = S.dotField()
    const count = field.count
    // Shockwave: dot i starts at 3.250 + 0.600·(d_i / 740).
    const startTime = new Float64Array(count)
    for (let index = 0; index < count; index++) startTime[index] = 3.25 + (0.6 * field.distance[index]) / 740
    const hundreds = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
    const hud = S.buildHud(root, {
      id: 's02',
      strips: [['~'], hundreds, S.DIGIT_STRIP, S.DIGIT_STRIP],
      dimFirst: [false, true, false, false], // the leading hundreds zero is a dim placeholder
    })
    api.setAttrs(hud.numberGroup, { transform: S.numberTransform(1.15, 1) })
    return {
      S, canvas, context, field, startTime, hud,
      halo: S.haloSprite(),
      segs: new Float64Array(count * 4),
      radii: new Float64Array(count),
    }
  },

  render(t, state, api) {
    const { S, context, field, startTime, hud, halo, segs, radii } = state
    const { K, C, COLOR, REST } = S
    const { progress, tween, ease } = api

    // ---------------------------------------------------------------------------------------
    // Map canvas
    // ---------------------------------------------------------------------------------------
    S.resetContext(context)

    // Dots: shockwave assembly out of Kigali. Radius 0 → 2.6 (outBack), position from
    // K + 0.85·(P − K) to P (outCubic), each over 0.220 s from its own start time.
    let visible = 0
    for (let index = 0; index < field.count; index++) {
      if (index === field.rwandaIndex) continue
      const amount = progress(t, startTime[index], startTime[index] + 0.22)
      if (amount <= 0) continue
      const reach = amount >= 1 ? 1 : 0.85 + 0.15 * ease.outCubic(amount)
      const x = K.x + field.rx[index] * reach
      const y = K.y + field.ry[index] * reach
      const offset = visible * 4
      segs[offset] = x
      segs[offset + 1] = y
      segs[offset + 2] = x
      segs[offset + 3] = y
      radii[visible] = amount >= 1 ? field.radius : field.radius * ease.outBack(amount)
      visible++
    }
    S.fillCapsules(context, COLOR.dotDim, segs, radii, visible)
    // The single Rwanda grid dot (30, −2): violetLight r 3.2, under the Kigali dot.
    {
      const index = field.rwandaIndex
      const amount = progress(t, startTime[index], startTime[index] + 0.22)
      if (amount > 0) {
        const reach = amount >= 1 ? 1 : 0.85 + 0.15 * ease.outCubic(amount)
        const radius = amount >= 1 ? field.rwandaRadius : field.rwandaRadius * ease.outBack(amount)
        S.fillDisc(context, COLOR.violetLight, K.x + field.rx[index] * reach, K.y + field.ry[index] * reach, radius)
      }
    }

    // Kigali dot radius: pop r 0 → 14.4 (outBack, 3.25–3.40), settle to 9 (reveal, 4.50–4.70).
    const kigaliRadius = t < 3.4
      ? 14.4 * ease.outBack(progress(t, 3.25, 3.4))
      : tween(t, 4.5, 4.7, 14.4, 9, S.EASE.reveal)

    // Heartbeat rings: r (dot radius) → 64, outCubic 0.45 s, 2 px violetLight, 0.8 → 0.
    for (const beat of [3.5, 4.0, 4.5, 5.0, 5.5, 6.0]) {
      if (t < beat || t >= beat + 0.45) continue
      const amount = (t - beat) / 0.45
      const radius = kigaliRadius + (64 - kigaliRadius) * ease.outCubic(amount)
      S.strokeRing(context, COLOR.violetLight, K.x, K.y, radius, 2, 0.8 * (1 - amount))
    }

    // Lanes draw behind the packet (out 4.00–4.50, return 4.50–5.00), then stay; the pluck and
    // the tremble displace them along n̂.
    if (t >= 4.0) {
      const amplitude = S.routeAmplitude(t)
      const packetS = S.packetS(t)
      if (t >= 4.5) {
        const from = t < 5.0 ? packetS : 0
        if (from < 1) S.strokeLane(context, S.laneSamples(REST, 'ret', from, 1, amplitude), COLOR.slate, S.LANE_STYLE.ret.width, S.LANE_STYLE.ret.alpha)
      }
      const to = t < 4.5 ? packetS : 1
      S.strokeLane(context, S.laneSamples(REST, 'out', 0, to, amplitude), COLOR.slate, S.LANE_STYLE.out.width, S.LANE_STYLE.out.alpha)
    }

    // Packet with its 8-ghost trail and streak.
    S.drawPacket(context, t)

    // Kigali dot + halo (3·r at 35%).
    S.drawKigali(context, halo, kigaliRadius)

    // Cape Town node pops on the 4.50 downbeat; impact rings at 4.50 and 5.50.
    if (t >= 4.5) {
      S.drawCapeTownNode(context, C.x, C.y, ease.outBack(progress(t, 4.5, 4.65)))
      for (const hit of [4.5, 5.5]) {
        if (t < hit || t >= hit + 0.25) continue
        const amount = (t - hit) / 0.25
        S.strokeRing(context, COLOR.slate, C.x, C.y, 9 + 25 * ease.outCubic(amount), 2, 0.7 * (1 - amount))
      }
    }

    // ---------------------------------------------------------------------------------------
    // HUD
    // ---------------------------------------------------------------------------------------
    // Kicker types on: character k appears at 4.500 + 0.005·k.
    const typed = t < 4.5 ? 0 : Math.min(S.KICKER_FAR.length, Math.floor((t - 4.5) / 0.005 + 1e-6) + 1)
    if (hud.kickerAText.__typed !== typed) {
      hud.kickerAText.__typed = typed
      hud.kickerAText.textContent = S.KICKER_FAR.slice(0, typed)
    }

    // Odometer rises through the 548.76 edge (4.55–4.75) while counting v = 110·inOutQuad.
    const riseY = S.rise(t, 4.55, 0.2, S.ODOMETER.riseDepth)
    api.setAttrs(hud.numberRise, { transform: S.translateY(riseY) })
    api.setAttrs(hud.unitRise, { transform: S.translateY(riseY) })
    const value = 110 * ease.inOutQuad(progress(t, 4.0, 5.0))
    S.countOffsets(value).forEach((offset, index) => {
      api.setAttrs(hud.cells[index + 1].roll, { transform: S.translateY(-offset * S.ODOMETER.em) })
    })
    // LOCK at ~110: the digits flash #FFFFFF for two frames.
    const flash = t >= 5.0 && t < 5.0 + 2 / 60
    for (let index = 1; index <= 3; index++) api.setAttrs(hud.cells[index].cell, { fill: flash ? COLOR.white : COLOR.paper })

    api.setAttrs(hud.perRise, { transform: S.translateY(S.rise(t, 5.0, 0.1, S.HUD.perRequest.depth)) })
    api.setAttrs(hud.peaksRise, { transform: S.translateY(S.rise(t, 5.25, 0.1, S.HUD.peaks.depth)) })
  },
})
