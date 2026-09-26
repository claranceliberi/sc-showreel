// s4 "Money" (19.0–22.3) — see storyboard/v3/TREATMENT.md, beat 19.3–22.0.
//
// A black-glass phone swings in on a pendulum (it hangs at the far end of its swing as the camera
// arrives, winds up, swings through, overshoots and settles); its screen goes from "processing"
// to a drawn check + "Payment confirmed" + an RWF chip. A violet elastic loop lies stretched open
// on the floor round the phone's footprint, trembling; it tenses, leaps up and snaps round the
// phone's lower third at 20.000 (hit: squash of the band, jolt of the phone, flash). Copy
// "Pay in RWF, with Mobile Money." snaps in thin → heavy 20.08–20.40 and holds still to 22.0.
//
// Hand-off to s5 at 22.0: phone at layout.phone.position, rotation (−0.22, −0.35, 0) — dead still
// from 20.6; phoneBand = SC3D.poses.phoneBand(t) exactly from 20.6; the prop's screen canvas holds
// the final confirmed UI (drawn once in build, never touched again — s4 draws its animated UI on
// its own screen mesh, so no canvas state leaks between out-of-order frames).
(() => {
  // ---- Event times (global seconds) — also the sound designer's list
  const T = {
    windUp: [19.2, 19.47], //  phone tilts further out: the wind-up (anticipation)
    release: 19.47, //         swing starts — through upright ≈ 19.60, overshoot ≈ 19.67, settled ≈ 19.9
    swingZero: 19.98, //       residual swing forced to 0 here
    spinClose: [19.62, 19.73], // processing arc closes into a full ring
    fill: [19.73, 19.84], //   ring fills violet (pop)
    check: [19.78, 19.9], //   check mark draws
    line1: [19.83, 20.01], //  "Payment"
    line2: [19.86, 20.04], //  "confirmed"
    chip: [19.91, 20.08], //   RWF chip
    tense: [19.64, 19.9], //   band tenses: widens, rises off the floor round the phone's foot, trembles harder
    leap: 19.9, //             band released
    snap: 20.0, //             HIT: band grips the phone
    settled: 20.6, //          band + phone vibration fully out (canonical pose from here)
    copyIn: [20.08, 20.4], //  copy snaps in (fully legible 20.40–22.00)
    copyOut: [22.0, 22.2],
    handoff: 22.0,
  }
  // Fast motion gets more motion-blur samples (read by render/render.mjs).
  SC.post.motionBlurWindows.push(
    { from: 19.5, to: 19.68, subframes: 12 }, // swing through upright (≈ 40–60 px/frame)
    { from: 19.89, to: 20.06, subframes: 24 }, // band leap + snap (> 150 px/frame at contact)
    { from: 20.08, to: 20.24, subframes: 12 }, // copy tracking snap
  )

  const DEG = Math.PI / 180
  const REST_ROTATION = [-0.22, -0.35, 0] // phone rest pose (the s5 hand-off pose)
  // Swing: the phone springs upright about a pivot just below its base, in its own plane (≈ the
  // image plane): hangs tilted out as the camera finds it, winds further out, is released, swings
  // through upright, overshoots and settles.
  const SWING = { D: 0.62, hang: 23 * DEG, extreme: 32 * DEG, omega: 17.3, zeta: 0.42, twist: 0.6 }
  const BAND = {
    count: 28, // same parametrisation as SC3D.poses.phoneBand (so the grip lands exactly on it)
    restY: -0.16,
    restRadius: 0.012,
    floor: { w: 0.7, d: 0.44, p: 0.62 }, // stretched loop on the floor (phone-yaw frame)
  }
  const SCREEN_W = 510 // design px across the screen (canvas is 540 wide; compensates the UV stretch)
  const SCREEN_H = 1120

  let S = null // scene state, for the afterRender follow hook

  const smooth = (a, b, x) => {
    const s = SC.clamp((x - a) / (b - a))
    return s * s * (3 - 2 * s)
  }
  const outBack = SC.ease.cubicBezier(0.2, 0.9, 0.3, 1.25)
  const sineInOut = (x) => -(Math.cos(Math.PI * x) - 1) / 2
  const copyEase = SC.ease.cubicBezier(0.2, 0.75, 0.12, 1.12)

  // Damped pendulum angle: hangs, winds up, released from rest at T.release.
  function swingAngle(t) {
    if (t < T.release) return SC.lerp(SWING.hang, SWING.extreme, sineInOut(SC.progress(t, ...T.windUp)))
    const tau = t - T.release
    const { omega, zeta } = SWING
    const wd = omega * Math.sqrt(1 - zeta * zeta)
    const env = Math.exp(-zeta * omega * tau)
    const angle = SWING.extreme * env * (Math.cos(wd * tau) + ((zeta * omega) / wd) * Math.sin(wd * tau))
    return angle * (1 - smooth(19.8, T.swingZero, t))
  }

  // Impact response at the snap: a damped kick (0 at contact, peaks a frame or two later).
  const kick = (t, freq, decay, phase = 0) => {
    const tau = t - T.snap
    if (tau < 0) return 0
    return Math.exp(-tau / decay) * Math.sin(2 * Math.PI * freq * tau + phase) * (1 - smooth(20.35, T.settled, t))
  }

  // ------------------------------------------------------------------------------------------
  // Screen UI — drawn in a 510 × 1120 design space so circles stay round on the 0.452 × 0.992 u
  // screen. Everything sits above design y ≈ 660: the band grips at y ≈ 741.
  // ------------------------------------------------------------------------------------------
  const UI = { cx: SCREEN_W / 2, cy: 246, R: 86 }
  function uiState(t) {
    const P = SC.progress
    const spin = -Math.PI / 2 + (t - 19.0) * 2 * Math.PI * 1.25
    const close = SC.ease.inOutCubic(P(t, ...T.spinClose))
    return {
      a0: spin,
      arc: SC.lerp(0.55 * Math.PI, 2 * Math.PI, close),
      fill: P(t, ...T.fill),
      fillScale: outBack(P(t, ...T.fill)),
      check: SC.ease.outCubic(P(t, ...T.check)),
      l1: P(t, ...T.line1),
      l2: P(t, ...T.line2),
      chip: P(t, ...T.chip),
    }
  }
  const FINAL_UI = { a0: 0, arc: 2 * Math.PI, fill: 1, fillScale: 1, check: 1, l1: 1, l2: 1, chip: 1 }
  const uiKey = (u) => [u.fill >= 1 ? 0 : u.a0, u.arc, u.fill, u.fillScale, u.check, u.l1, u.l2, u.chip].map((v) => v.toFixed(4)).join(',')

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  function drawScreen(ctx, width, height, u) {
    const W = SCREEN_W
    const H = SCREEN_H
    const { cx, cy, R } = UI
    ctx.setTransform(width / W, 0, 0, height / H, 0, 0)
    // Background: deep ink with a violet bloom behind the check that swells on confirmation
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#15123A')
    bg.addColorStop(0.5, '#0C0A22')
    bg.addColorStop(1, '#06050F')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
    const bloomAlpha = 0.18 + 0.3 * SC.ease.outCubic(u.fill)
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, 360)
    bloom.addColorStop(0, `rgba(107,99,255,${bloomAlpha})`)
    bloom.addColorStop(0.4, `rgba(107,99,255,${bloomAlpha * 0.35})`)
    bloom.addColorStop(1, 'rgba(107,99,255,0)')
    ctx.fillStyle = bloom
    ctx.fillRect(0, 0, W, H)
    // Dynamic island + home indicator (the only chrome)
    ctx.fillStyle = '#000000'
    roundRect(ctx, cx - 58, 24, 116, 34, 17)
    ctx.fill()
    ctx.fillStyle = 'rgba(244,243,255,0.4)'
    roundRect(ctx, cx - 72, H - 34, 144, 10, 5)
    ctx.fill()

    // Processing arc → full ring → violet disc
    if (u.fill < 1) {
      ctx.lineWidth = 11
      ctx.strokeStyle = `rgba(244,243,255,${0.1 * (1 - u.fill)})`
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = '#8982FF'
      ctx.lineCap = 'round'
      ctx.beginPath()
      if (u.arc >= 2 * Math.PI - 1e-3) ctx.arc(cx, cy, R, 0, Math.PI * 2)
      else ctx.arc(cx, cy, R, u.a0, u.a0 + u.arc)
      ctx.stroke()
    }
    if (u.fill > 0) {
      const r = Math.max(0, (R + 5.5) * u.fillScale)
      const disc = ctx.createLinearGradient(cx, cy - r, cx, cy + r)
      disc.addColorStop(0, '#7B74FF')
      disc.addColorStop(1, '#5B53F0')
      ctx.fillStyle = disc
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
    }
    // Check mark, drawn along its length
    if (u.check > 0) {
      const points = [[cx - 36, cy + 3], [cx - 10, cy + 29], [cx + 39, cy - 25]]
      const lengths = [Math.hypot(26, 26), Math.hypot(49, 54)]
      let remaining = u.check * (lengths[0] + lengths[1])
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 15
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(...points[0])
      for (let i = 0; i < 2 && remaining > 0; i++) {
        const k = Math.min(1, remaining / lengths[i])
        ctx.lineTo(SC.lerp(points[i][0], points[i + 1][0], k), SC.lerp(points[i][1], points[i + 1][1], k))
        remaining -= lengths[i]
      }
      ctx.stroke()
    }
    // "Payment / confirmed" — rise + fade in
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.letterSpacing = '-1.5px'
    ctx.font = '700 70px Inter'
    for (const [text, p, y] of [['Payment', u.l1, 436], ['confirmed', u.l2, 510]]) {
      if (p <= 0) continue
      ctx.globalAlpha = SC.ease.outCubic(p)
      ctx.fillStyle = '#F4F3FF'
      ctx.fillText(text, cx, y + 26 * (1 - SC.ease.snappy(p)))
    }
    ctx.globalAlpha = 1
    // RWF chip
    if (u.chip > 0) {
      const p = SC.ease.snappy(u.chip)
      ctx.globalAlpha = SC.ease.outCubic(u.chip)
      ctx.save()
      ctx.translate(cx, 606 + 20 * (1 - p))
      ctx.scale(0.9 + 0.1 * p, 0.9 + 0.1 * p)
      ctx.font = '800 70px Inter'
      ctx.letterSpacing = '1px'
      const textWidth = ctx.measureText('RWF').width
      const chipW = textWidth + 78
      roundRect(ctx, -chipW / 2, -50, chipW, 100, 50)
      ctx.fillStyle = 'rgba(107,99,255,0.22)'
      ctx.fill()
      ctx.lineWidth = 2.5
      ctx.strokeStyle = 'rgba(155,149,255,0.7)'
      ctx.stroke()
      ctx.fillStyle = '#E4E2FF'
      ctx.textBaseline = 'middle'
      ctx.fillText('RWF', 0, 3)
      ctx.restore()
      ctx.globalAlpha = 1
    }
    ctx.letterSpacing = '0px'
  }

  // ------------------------------------------------------------------------------------------
  // Band loop points (same parametrisation as SC3D.poses.phoneBand: a superellipse)
  // ------------------------------------------------------------------------------------------
  function loopShape(i, w, d, p) {
    const a = (i / BAND.count) * Math.PI * 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    return { a, x: Math.sign(c) * Math.pow(Math.abs(c), p) * w, z: Math.sign(s) * Math.pow(Math.abs(s), p) * d }
  }
  // Outward in-plane normal of the superellipse at (x, z)
  function loopNormal(x, z, w, d, p) {
    const e = 1 / p - 1
    const nx = (Math.sign(x) * Math.pow(Math.abs(x / w), e)) / w
    const nz = (Math.sign(z) * Math.pow(Math.abs(z / d), e)) / d
    const len = Math.hypot(nx, nz) || 1
    return [nx / len, nz / len]
  }

  SC.scene({
    id: 's4-money',
    start: 19.0,
    end: 22.3,
    z: 40,
    build(root, api) {
      const THREE = window.THREE
      const P = SC3D.props
      const phone = P.phone
      const group = SC3D.sceneGroup(root, 's4')

      // The prop's own canvas gets the final UI once: whoever shows the prop screen after s4
      // (s5 from 22.0) sees exactly the frame s4 ends on.
      phone.redraw((ctx, w, h) => drawScreen(ctx, w, h, FINAL_UI))

      // s4's animated screen: own canvas + mesh on the prop's screen geometry
      const canvas = document.createElement('canvas')
      canvas.width = phone.canvas.width
      canvas.height = phone.canvas.height
      const ctx = canvas.getContext('2d')
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 4
      const screenMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
      const screen = new THREE.Mesh(phone.screen.geometry, screenMaterial)
      screen.name = 's4-screen'
      screen.matrixAutoUpdate = false
      // Cover glass over the screen: glossy black, added on top → pure reflections of the studio
      // (they slide across the glass as the phone swings), same response as the bezel glass.
      const glassMaterial = new THREE.MeshStandardMaterial({
        name: 's4-cover-glass', color: '#000000', roughness: 0.07, metalness: 0, envMapIntensity: 0.26,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      })
      const glass = new THREE.Mesh(phone.screen.geometry, glassMaterial)
      glass.name = 's4-glass'
      glass.matrixAutoUpdate = false
      glass.renderOrder = 6
      // Screen light on the floor: a soft additive pool in front of the phone
      const poolCanvas = document.createElement('canvas')
      poolCanvas.width = poolCanvas.height = 128
      const pctx = poolCanvas.getContext('2d')
      const gradient = pctx.createRadialGradient(64, 64, 0, 64, 64, 64)
      gradient.addColorStop(0, 'rgba(255,255,255,1)')
      gradient.addColorStop(0.3, 'rgba(255,255,255,0.55)')
      gradient.addColorStop(0.65, 'rgba(255,255,255,0.14)')
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      pctx.fillStyle = gradient
      pctx.fillRect(0, 0, 128, 128)
      const poolTexture = new THREE.CanvasTexture(poolCanvas)
      poolTexture.colorSpace = THREE.SRGBColorSpace
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: poolTexture, color: '#8F88FF', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
      )
      glow.name = 's4-screen-glow'
      glow.rotation.x = -Math.PI / 2
      glow.renderOrder = 3
      group.add(screen, glass, glow)

      // Copy: two lines, left; tracking/weight snap from thin+wide to heavy+tight
      const copy = api.el('div', {
        style: {
          position: 'absolute', left: '118px', top: '404px', color: '#F4F3FF', fontFamily: 'Inter, sans-serif',
          fontSize: '100px', lineHeight: '106px', whiteSpace: 'nowrap', fontKerning: 'normal',
        },
      }, root)
      const lines = ['Pay in RWF,', 'with Mobile Money.'].map((text) => api.el('div', { text, style: { opacity: '0' } }, copy))

      const rest = {
        position: SC3D.layout.phone.position.clone(),
        quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(...REST_ROTATION)),
      }
      // Floor frame for the stretched loop: under the phone's footprint, turned with the phone
      const floorCenter = new THREE.Vector3(0, -0.3, 0).applyQuaternion(rest.quaternion).add(rest.position)
      floorCenter.y = SC3D.layout.surfaceY
      const floorQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, REST_ROTATION[1], 0))
      // Rest perimeter of the gripping loop (for the thinner-when-stretched radius)
      let restLength = 0
      {
        const w = phone.width / 2 + 0.012
        const d = phone.depth / 2 + 0.012
        let prev = loopShape(BAND.count - 1, w, d, 0.25)
        for (let i = 0; i < BAND.count; i++) {
          const q = loopShape(i, w, d, 0.25)
          restLength += Math.hypot(q.x - prev.x, q.z - prev.z)
          prev = q
        }
      }
      S = {
        THREE, root, group, canvas, ctx, texture, screen, screenMaterial, glass, glassMaterial, glow, copy, lines, rest,
        floorCenter, floorQuaternion, restLength, lastKey: null,
        points: Array.from({ length: BAND.count }, () => new THREE.Vector3()),
        tmpV: new THREE.Vector3(), tmpQ: new THREE.Quaternion(), tmpE: new THREE.Euler(),
      }
      return S
    },

    render(t, s, api) {
      const { THREE } = s
      const P = SC3D.props
      const phone = P.phone
      const owns = t < T.handoff

      // ---- Screen UI (own canvas; redraw only when the drawn state changes)
      const ui = t >= 20.2 ? FINAL_UI : uiState(t)
      const key = uiKey(ui)
      if (key !== s.lastKey) {
        s.ctx.save()
        drawScreen(s.ctx, s.canvas.width, s.canvas.height, ui)
        s.ctx.restore()
        s.texture.needsUpdate = true
        s.lastKey = key
      }
      s.ui = ui

      // ---- Copy
      s.lines.forEach((line, i) => {
        const inStart = T.copyIn[0] + i * 0.05
        const pIn = SC.progress(t, inStart, inStart + 0.27)
        const eIn = copyEase(pIn)
        const pOut = SC.progress(t, ...T.copyOut)
        const eOut = SC.ease.inCubic(pOut)
        const tracking = SC.lerp(0.085, -0.022, eIn) + 0.08 * eOut
        const weight = SC.clamp(SC.lerp(240, 800, eIn) - 380 * eOut, 100, 900)
        const opacity = SC.ease.outQuad(SC.progress(t, inStart, inStart + 0.12)) * (1 - SC.ease.inQuad(pOut))
        api.setStyle(line, {
          opacity: String(api.round(opacity, 3)),
          letterSpacing: `${api.round(tracking, 4)}em`,
          fontWeight: String(Math.round(weight)),
        })
      })

      if (!owns) return // s5 drives phone + band from 22.0 (the follow hook keeps the glass on it)
      SC3D.claim('phone')
      SC3D.claim('phoneBand')

      // ---- Camera: a small pedestal-up + ease-back during the glide so the swinging phone isn't
      // cropped by the frame top (0 outside 19.15–19.9), and a small push reacting to the snap.
      const lift = smooth(19.15, 19.45, t) * (1 - smooth(19.45, 19.9, t))
      const tauHit = t - T.snap
      const react = tauHit > 0 ? Math.exp(-tauHit / 0.2) * (1 - Math.exp(-tauHit / 0.035)) : 0
      SC3D.nudgeCamera({ target: [0, 0.11 * lift, 0], dist: (1 + 0.07 * lift) * (1 - 0.022 * react) })

      // ---- Phone: pendulum swing-in, jolt at the snap, dead still from 20.6
      const theta = swingAngle(t)
      const dTheta = (swingAngle(t + 0.004) - swingAngle(t - 0.004)) / 0.008
      const g = phone.group
      g.visible = true
      const local = s.tmpV.set(-SWING.D * Math.sin(theta), -SWING.D * (1 - Math.cos(theta)) - 0.012 * kick(t, 7, 0.08), 0)
      g.position.copy(local.applyQuaternion(s.rest.quaternion)).add(s.rest.position)
      s.tmpE.set(
        -0.012 * dTheta + 0.9 * DEG * kick(t, 8, 0.1, 0.6), // lags back through the fast part; kick
        SWING.twist * theta, //                                 turns toward us as it swings through
        theta + 1.3 * DEG * kick(t, 9, 0.1), //                 leans out from the pivot; kick
      )
      g.quaternion.copy(s.rest.quaternion).multiply(s.tmpQ.setFromEuler(s.tmpE))
      g.updateMatrixWorld(true)
      phone.screen.visible = false // s4's own screen + glass replace it (see the follow hook)

      // ---- Band
      updateBand(t, s, phone)

      // ---- Snap flash (lights the floor, kicks the rim)
      if (t >= T.snap && t < T.snap + 0.45) {
        const at = new THREE.Vector3(0, BAND.restY, phone.depth / 2 + 0.02).applyMatrix4(g.matrixWorld)
        SC3D.flash(at, { intensity: 0.8 * Math.exp(-(t - T.snap) / 0.09), size: 1.05 })
      }
    },
  })

  function updateBand(t, s, phone) {
    const { THREE } = s
    const band = SC3D.props.phoneBand
    if (t >= T.settled) {
      const pose = SC3D.poses.phoneBand(t)
      band.update(pose.points, pose.radius)
      return
    }
    const gw = phone.width / 2 + 0.012
    const gd = phone.depth / 2 + 0.012
    const center = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    let w
    let d
    let p
    let squash = 1
    let tremble = 0
    let lift = 0
    let tenseAmount = 0
    const phoneQuaternion = phone.group.quaternion
    const gripCenter = new THREE.Vector3(0, BAND.restY, 0).applyMatrix4(phone.group.matrixWorld)
    if (t < T.snap) {
      // stretched on the floor → tensing → leap
      const tense = sineInOut(SC.progress(t, ...T.tense))
      tenseAmount = tense
      const widen = 1 + 0.07 * tense
      lift = 0.2 * tense
      tremble = 0.006 + 0.008 * tense
      const leap = SC.progress(t, T.leap, T.snap)
      const rise = Math.sin((leap * Math.PI) / 2) // fast off the floor, arrives level
      const close = leap * leap // accelerates into the grip
      center.copy(s.floorCenter)
      center.y += BAND.restRadius + lift
      center.lerp(gripCenter, rise)
      quaternion.copy(s.floorQuaternion).slerp(phoneQuaternion, rise)
      w = SC.lerp(BAND.floor.w * widen, gw, close)
      d = SC.lerp(BAND.floor.d * widen, gd, close)
      p = SC.lerp(BAND.floor.p, 0.25, close)
      tremble *= 1 - close
    } else {
      // gripping: fat squash, then the straight runs ring like plucked strings
      center.copy(gripCenter)
      quaternion.copy(phoneQuaternion)
      w = gw
      d = gd
      p = 0.25
      squash = 1 + 0.55 * kick(t, 8, 0.07, Math.PI / 2)
    }
    const tau = Math.max(0, t - T.snap)
    const settleWindow = 1 - smooth(20.35, T.settled, t)
    const ring = t >= T.snap ? Math.exp(-tau / 0.13) * settleWindow : 0
    const slap = t >= T.snap ? Math.exp(-tau / 0.06) * settleWindow : 0
    const bob = t >= T.snap ? 0.014 * Math.exp(-tau / 0.09) * Math.sin(2 * Math.PI * 6 * tau) * settleWindow : 0

    // radius: thinner when stretched (r ∝ 1/√stretch), squash on the grip
    const shapes = []
    let length = 0
    for (let i = 0; i < BAND.count; i++) shapes.push(loopShape(i, w, d, p))
    for (let i = 0; i < BAND.count; i++) {
      const a = shapes[i]
      const b = shapes[(i + 1) % BAND.count]
      length += Math.hypot(a.x - b.x, a.z - b.z)
    }
    const radius = BAND.restRadius * Math.sqrt(s.restLength / Math.max(length, s.restLength)) * squash
    // keep the tube touching (not piercing) the phone while it's fat
    const push = Math.max(0, radius - BAND.restRadius)

    const v = s.tmpV
    shapes.forEach((shape, i) => {
      let { x, z } = shape
      let y = 0
      const [nx, nz] = loopNormal(x, z, w, d, p)
      // stretched: standing waves round the loop (in-plane + vertical)
      if (tremble > 0) {
        let radial = 0
        let vertical = 0
        ;[[2, 7.3, 0.3], [3, 10.1, 1.9], [5, 13.7, 4.1]].forEach(([k, f, phase], m) => {
          const amp = 1 / Math.sqrt(k)
          radial += amp * Math.sin(k * shape.a + phase) * Math.sin(2 * Math.PI * f * t + phase * 1.7)
          vertical += amp * Math.sin(k * shape.a + phase * 2.3) * Math.sin(2 * Math.PI * f * 1.13 * t + phase)
        })
        x += nx * radial * tremble
        z += nz * radial * tremble
        y += vertical * tremble * 0.6 * (tenseAmount + 0.15)
      }
      if (t >= T.snap) {
        // the long runs across the glass (front and back): plucked-string ring + slap off the glass
        const run = Math.pow(Math.abs(Math.sin(shape.a)), 2) * Math.cos((Math.PI / 2) * SC.clamp(x / w, -1, 1))
        y += run * 0.018 * ring * Math.sin(2 * Math.PI * 15 * tau + (z > 0 ? 0 : 1.2)) + bob
        const out = run * 0.012 * slap * Math.abs(Math.sin(2 * Math.PI * 10 * tau)) + push
        x += nx * out
        z += nz * out
      }
      s.points[i].copy(v.set(x, y, z).applyQuaternion(quaternion).add(center))
    })
    SC3D.props.phoneBand.update(s.points, radius)
  }

  // After every scene has rendered (and before the 3D frame draws): s4's screen, cover glass and
  // floor glow follow the phone's final transform for the frame — also 22.0–22.3, when s5 moves
  // it (the glass fades out there; the prop screen shows the same final UI).
  SC.afterRender((t) => {
    const s = S
    if (!s) return
    const active = s.root.style.display !== 'none' && t >= 19.0 && t < 22.3
    const phone = SC3D.props.phone
    const shown = active && phone.group.visible
    s.screen.visible = shown && t < T.handoff
    s.glass.visible = shown
    s.glow.visible = shown
    if (!shown) return
    const { THREE } = s
    phone.group.updateMatrixWorld(true)
    const screenMatrix = phone.screen.matrixWorld
    s.screen.matrix.copy(screenMatrix)
    s.glass.matrix.copy(screenMatrix).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.0009))
    s.screen.matrixWorldNeedsUpdate = true
    s.glass.matrixWorldNeedsUpdate = true
    const fadeOut = 1 - smooth(T.handoff, 22.25, t)
    s.glassMaterial.opacity = fadeOut
    // Screen brightness falls off at grazing angles (real panels do); glow follows the content
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(screenMatrix)
    const phonePosition = new THREE.Vector3().setFromMatrixPosition(phone.group.matrixWorld)
    const toCamera = SC3D.cameraAt(t).position.clone().sub(phonePosition).normalize()
    const facing = normal.dot(toCamera)
    const ui = s.ui || FINAL_UI
    const snapBoost = t >= T.snap ? 0.22 * Math.exp(-(t - T.snap) / 0.1) : 0
    s.screenMaterial.color.setScalar(0.62 + 0.38 * smooth(0.15, 0.85, facing) + snapBoost)
    // Floor glow: in front of the screen, stronger when the screen is lit violet
    const forward = new THREE.Vector3(normal.x, 0, normal.z)
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1)
    forward.normalize()
    const height = Math.max(0.05, phonePosition.y - SC3D.layout.surfaceY)
    s.glow.position.set(phonePosition.x + forward.x * 0.1, SC3D.layout.surfaceY + 0.003, phonePosition.z + forward.z * 0.1)
    s.glow.rotation.set(-Math.PI / 2, 0, Math.atan2(forward.x, forward.z))
    s.glow.scale.set(1.5, 0.9, 1)
    s.glow.updateMatrix()
    const level = (0.22 + 0.4 * SC.ease.outCubic(ui.fill)) * SC.clamp(0.7 / height, 0.4, 1.2) * smooth(-0.2, 0.6, facing)
    s.glow.material.opacity = SC.clamp(level * fadeOut, 0, 1)
  })
})()
