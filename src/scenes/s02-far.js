// s02-far · 3.250–6.500 s · z 5 — PROBLEM, THE TENSION.
// The continent assembles as a shockwave out of Kigali (the period). A request travels to the
// nearest hyperscaler region in Cape Town (labelled on the map) and back while the odometer
// counts to ~110 ms. At 5.25 the route is plucked and the count spikes to 200 ("peaks at 200 ms")
// and relaxes. Then the band visibly strains under the riser: the camera pushes in (Z 1 → 1.08),
// the Cape Town end is dragged ~64 px further out while the lanes thin 2.5 → 1.2 px, and a
// standing wave (1–2 nodes, 6 → 16 Hz, up to ~46 px) trembles along it — until it freezes at
// 6.48, one held breath before s03-snap releases it. All shared formulas live in shared-map.js
// (TIME holds every event time), so s03's first frame is this scene's exit state.
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
    const { K, C, COLOR, TIME } = S
    const { progress, tween, ease } = api

    // ---------------------------------------------------------------------------------------
    // Map canvas
    // ---------------------------------------------------------------------------------------
    S.resetContext(context)
    // Camera: Z = 1 until the 5.00 push-in (→ 1.08 at 6.500, about Kigali).
    const Z = S.zoomZ(t)

    // Dots: shockwave assembly out of Kigali. Radius 0 → 2.6 (outBack), position from
    // K + 0.85·(P − K) to P (outCubic), each over 0.220 s from its own start time.
    let visible = 0
    for (let index = 0; index < field.count; index++) {
      if (index === field.rwandaIndex) continue
      const amount = progress(t, startTime[index], startTime[index] + 0.22)
      if (amount <= 0) continue
      const reach = (amount >= 1 ? 1 : 0.85 + 0.15 * ease.outCubic(amount)) * Z
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
        const reach = (amount >= 1 ? 1 : 0.85 + 0.15 * ease.outCubic(amount)) * Z
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

    // Lanes draw behind the packet (out 4.00–4.50, return 4.50–5.00), then stay. From 5.25 the
    // band is plucked, dragged further out (thinning 2.5 → 1.2 px) and trembles as a standing
    // wave with rising frequency; all of it frozen to exactly lanes(E_RELEASE) by 6.48.
    const node = S.preEnd(t) // the Cape Town node rides the band's far end
    if (t >= 4.0) {
      const route = S.routeAt(t)
      const wave = S.routeWave(t)
      const widths = S.laneWidths(t)
      const packetS = S.packetS(t)
      if (t >= 4.5) {
        const from = t < 5.0 ? packetS : 0
        if (from < 1) S.strokeLane(context, S.laneSamples(route, 'ret', from, 1, wave), COLOR.slate, widths.ret, widths.retAlpha)
      }
      const to = t < 4.5 ? packetS : 1
      S.strokeLane(context, S.laneSamples(route, 'out', 0, to, wave), COLOR.slate, widths.out, widths.outAlpha)
    }

    // Packet with its 8-ghost trail and streak.
    S.drawPacket(context, t)

    // Kigali dot + halo (3·r at 35%).
    S.drawKigali(context, halo, kigaliRadius)

    // Cape Town node pops on the 4.50 downbeat; impact rings at 4.50 and 5.50. The on-map
    // "Cape Town" label types on with it and rides the node as the band drags it south.
    if (t >= 4.5) {
      S.drawCapeTownNode(context, node.x, node.y, ease.outBack(progress(t, 4.5, 4.65)))
      for (const hit of [4.5, 5.5]) {
        if (t < hit || t >= hit + 0.25) continue
        const amount = (t - hit) / 0.25
        S.strokeRing(context, COLOR.slate, node.x, node.y, 9 + 25 * ease.outCubic(amount), 2, 0.7 * (1 - amount))
      }
      S.drawCapeTownLabel(context, node, S.labelTyped(t))
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
    // THE PLUCK (5.25) is the 200 ms spike made visible: the count whips up to 200 in 60 ms,
    // holds for 3 frames as "peaks at 200 ms" rises, and relaxes back to ~110 by 5.60.
    const spike = t < TIME.pluck
      ? 0
      : t < TIME.pluck + 0.06
        ? ease.outCubic(progress(t, TIME.pluck, TIME.pluck + 0.06))
        : 1 - ease.inOutCubic(progress(t, TIME.pluck + 0.11, TIME.pluck + 0.35))
    const value = 110 * ease.inOutQuad(progress(t, 4.0, 5.0)) + 90 * spike
    S.countOffsets(value).forEach((offset, index) => {
      api.setAttrs(hud.cells[index + 1].roll, { transform: S.translateY(-offset * S.ODOMETER.em) })
    })
    // LOCK at ~110 (and the 200 peak): the digits flash #FFFFFF for two frames.
    const flash = (t >= 5.0 && t < 5.0 + 2 / 60) || (t >= TIME.pluck + 0.06 && t < TIME.pluck + 0.06 + 2 / 60)
    for (let index = 1; index <= 3; index++) api.setAttrs(hud.cells[index].cell, { fill: flash ? COLOR.white : COLOR.paper })

    api.setAttrs(hud.perRise, { transform: S.translateY(S.rise(t, 5.0, 0.1, S.HUD.perRequest.depth)) })
    api.setAttrs(hud.peaksRise, { transform: S.translateY(S.rise(t, 5.25, 0.1, S.HUD.peaks.depth)) })
  },
})
