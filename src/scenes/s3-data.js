// s3 "Data" (16.3–19.6) — Rwanda lifts out of the continent as its own slab with a lit violet
// edge; a violet elastic ring is laid round its border and cinches; glossy data spheres pop up
// round the Kigali pin; an off-screen force drags them east, the ring bulges into a slingshot
// pouch holding them, then SNAPS back through its rest line (17.500 hit) and flings them home,
// where they skid and settle with small hops. Copy "Data stays in-country." snaps from thin and
// stretched to tight Inter 800, still and legible 17.8–19.3. At the end the spheres sink into the
// slab (stored in-country) and Rwanda settles back flush, so the idle poses take over seamlessly.
//
// The ring + sphere physics is a real (deterministic) simulation run once in build() and sampled
// by render(t) — see simulate(). Everything else is a pure function of t.
(() => {
  'use strict'

  // ── Cue sheet (global seconds) ─────────────────────────────────────────────────────────────
  const T = {
    lift: 16.5, // Rwanda starts to rise out of the continent (spring, settles ~17.05)
    edge: 16.52, // its edge lights violet as it rises (to 16.86)
    ringRun: 16.64, // the ring is laid round the border: two ends from the north…
    ringClose: 16.92, // …meet at the south (front) and the ring cinches onto the border
    spill: 16.84, // first data sphere pops up at Kigali; one every 24 ms (last 17.01)
    escape: 17.11, // the off-screen force grabs them (east)
    release: 17.425, // max stretch — the force loses its grip
    snap: 17.5, // the ring slams back through its rest line: SNAP (camera shake configured)
    copyIn: 17.5, // copy snaps in 17.50–17.78, still and fully legible 17.8–19.3
    copyOut: 19.12, // clears before Rwanda settles (19.24) so the copy never fades across the moving slab
    sink: 19.18, // spheres sink into the slab 19.18–19.555 (staggered)
    down: 19.24, // Rwanda settles back flush 19.24–19.58
    flush: 19.58,
  }
  const LIFT = 0.17 // slab lift, u
  const RING_R = 0.0122 // ring tube radius while it works (canonical rest 0.011)
  const SIM_T0 = 16.8
  const SIM_T1 = 18.6 // everything has settled by ~18.2; later frames hold the last sample
  const SIM_RATE = 480
  const BALLS = [
    // r (u), pearl?, spawn angle (deg; 0 = east, 90 = south), spawn distance from the pin (u)
    { r: 0.024, pearl: false, angle: 215, dist: 0.11 },
    { r: 0.02, pearl: true, angle: 20, dist: 0.078 },
    { r: 0.026, pearl: false, angle: 100, dist: 0.086 },
    { r: 0.021, pearl: false, angle: 285, dist: 0.08 },
    { r: 0.023, pearl: true, angle: 140, dist: 0.105 },
    { r: 0.019, pearl: false, angle: 335, dist: 0.074 },
    { r: 0.022, pearl: true, angle: 245, dist: 0.09 },
    { r: 0.025, pearl: false, angle: 60, dist: 0.088 },
  ]

  const clamp01 = (x) => Math.min(1, Math.max(0, x))
  const smooth = (a, b, x) => {
    const s = clamp01((x - a) / (b - a))
    return s * s * (3 - 2 * s)
  }

  // ── Ring preparation ───────────────────────────────────────────────────────────────────────
  // `points` = the canonical rwandaRing pose at rest, as [[x, z], …] (closed loop). Returns the
  // simulation nodes (uniform arc spacing, lightly smoothed), each canonical point's position in
  // node units, and a heavily smoothed copy of the canonical points (a stretched band straightens).
  function prepareRing(points, nodeCount = 200) {
    const n = points.length
    const cum = [0]
    for (let i = 1; i <= n; i++) {
      const a = points[i - 1]
      const b = points[i % n]
      cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
    }
    const perimeter = cum[n]
    const at = (s) => {
      s = ((s % perimeter) + perimeter) % perimeter
      let lo = 0
      let hi = n
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (cum[mid] <= s) lo = mid
        else hi = mid
      }
      const a = points[lo]
      const b = points[(lo + 1) % n]
      const f = (s - cum[lo]) / Math.max(1e-9, cum[lo + 1] - cum[lo])
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
    }
    const average = (s, span, K) => {
      let sx = 0
      let sz = 0
      for (let k = -K; k <= K; k++) {
        const p = at(s + (k / K) * span)
        sx += p[0]
        sz += p[1]
      }
      return [sx / (2 * K + 1), sz / (2 * K + 1)]
    }
    const smoothed = points.map((_, i) => average(cum[i], 0.035, 14))
    // De-spiked copy: the offset border has ~40 hairpin reversals and near-duplicate points that
    // pinch the tube into dark inside-out bits. Replace every reversal/duplicate by its neighbours'
    // midpoint (until none are left), a light Taubin smooth, and once more.
    const cosAt = (q, i) => {
      const a = q[(i - 1 + n) % n]
      const b = q[i]
      const c = q[(i + 1) % n]
      const ux = b[0] - a[0]
      const uz = b[1] - a[1]
      const vx = c[0] - b[0]
      const vz = c[1] - b[1]
      return (ux * vx + uz * vz) / (Math.hypot(ux, uz) * Math.hypot(vx, vz) + 1e-12)
    }
    const despike = (q) => {
      for (let pass = 0; pass < 40; pass++) {
        let changed = 0
        for (let i = 0; i < n; i++) {
          const a = q[(i - 1 + n) % n]
          const c = q[(i + 1) % n]
          if (cosAt(q, i) < 0.3 || Math.hypot(q[i][0] - a[0], q[i][1] - a[1]) < 0.003) {
            q[i] = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]
            changed++
          }
        }
        if (!changed) break
      }
      return q
    }
    const relax = (q, f) => q.map((b, i) => {
      const a = q[(i - 1 + n) % n]
      const c = q[(i + 1) % n]
      return [b[0] + f * ((a[0] + c[0]) / 2 - b[0]), b[1] + f * ((a[1] + c[1]) / 2 - b[1])]
    })
    let light = despike(points.map((p) => p.slice()))
    for (let k = 0; k < 3; k++) light = relax(relax(light, 0.6), -0.62)
    light = despike(light)
    const nodes = []
    for (let i = 0; i < nodeCount; i++) nodes.push(average((i / nodeCount) * perimeter, 0.012, 6))
    const param = cum.slice(0, n).map((s) => (s / perimeter) * nodeCount)
    return { nodes, param, smoothed, light, perimeter, spacing: perimeter / nodeCount }
  }

  // ── The physics ────────────────────────────────────────────────────────────────────────────
  // 2D in the slab plane (x, z) plus a height channel for the spheres' hops. The ring is a loop of
  // nodes displaced from their rest positions on the border: tension along the loop (wave speed
  // `cw`) plus a saturating tack back to the border — stiff for small offsets, a constant pull-in
  // once peeled — so a push peels a stretch of band off the border into a rounded pouch with
  // slightly curved rubber legs, and the rest of the ring stays put. Spheres are heavy discs with
  // rolling drag, colliding with the ring's segments, each other and the Kigali needle. From
  // T.escape a force pulls every sphere toward a point off to the east; it grows as they strain
  // against the ring and lets go at T.release — the stored stretch snaps the ring back through its
  // rest line (at T.snap) and flings them home; hits from the ring add an upward hop.
  function simulate({ nodes, spacing, kigali, balls, t0 = SIM_T0, t1 = SIM_T1, rate = SIM_RATE, P = {} }) {
    const cfg = {
      cw: 6, // ring wave speed, u/s
      tack: 30000, // tack stiffness per unit mass for small offsets, 1/s²
      tackSat: 0.01, // offset where the tack saturates (peels), u
      ringDamp: 7, // 1/s
      density: 1, // ring mass per u
      ballDensity: 12000, // sphere mass = ballDensity · r³
      contact: 6000, // penalty stiffness
      contactDamp: 3.2,
      pull0: 12, // u/s² as the force grabs them
      pull1: 150, // u/s² at the moment it lets go
      pullTo: [0.5, 0.02], // where the force pulls toward, relative to Kigali (u)
      strainAt: 0.1, // s after T.escape when the pull starts to build
      strainPow: 1.4,
      grip: 2.4, // rolling drag while the force drags them, 1/s
      home: 16, // rolling drag once they are home, 1/s
      catchAt: 0.04, // s after the release when home drag starts to take over…
      catchIn: 0.1, // …over this long
      roll: 0.9, // rolling resistance, u/s²
      gravity: 9,
      bounce: 0.42,
      kick: 0.12, // share of the ring's snap impulse turned into an upward hop
      post: 0.005, // the Kigali needle, radius u (the coil sits above sphere height)
      dt: 1 / 3600,
      ...P,
    }
    const N = nodes.length
    const M = balls.length
    const dt = cfg.dt
    const steps = Math.ceil((t1 - t0) / dt)
    const every = Math.max(1, Math.round(1 / (rate * dt)))
    const count = Math.floor(steps / every) + 1
    const ringOut = new Float32Array(count * N * 2)
    const ballOut = new Float32Array(count * M * 3) // x, z, hop height
    const bulgeOut = new Float32Array(count)
    const dx = new Float64Array(N)
    const dz = new Float64Array(N)
    const vx = new Float64Array(N)
    const vz = new Float64Array(N)
    const fx = new Float64Array(N)
    const fz = new Float64Array(N)
    const nodeMass = cfg.density * spacing
    const lap = (cfg.cw * cfg.cw) / (spacing * spacing)
    const B = balls.map((b) => ({
      r: b.r, m: cfg.ballDensity * b.r * b.r * b.r, x: b.x, z: b.z, vx: 0, vz: 0, y: 0, vy: 0,
      born: false, spawn: b.spawn, v0: b.v0, hop: b.hop, fx: 0, fz: 0,
    }))
    const targetX = kigali[0] + cfg.pullTo[0]
    const targetZ = kigali[1] + cfg.pullTo[1]
    const pullAt = (t) => {
      if (t < T.escape || t >= T.release) return 0
      const grab = smooth(T.escape, T.escape + 0.07, t)
      const strain = Math.pow(clamp01((t - (T.escape + cfg.strainAt)) / (T.release - T.escape - cfg.strainAt)), cfg.strainPow)
      return grab * (cfg.pull0 + (cfg.pull1 - cfg.pull0) * strain)
    }
    const dragAt = (t) =>
      t < T.escape ? cfg.home : cfg.grip + (cfg.home - cfg.grip) * smooth(T.release + cfg.catchAt, T.release + cfg.catchAt + cfg.catchIn, t)
    let sample = 0
    for (let step = 0; step <= steps; step++) {
      const t = t0 + step * dt
      if (step % every === 0 && sample < count) {
        const ro = sample * N * 2
        let bulge = 0
        for (let i = 0; i < N; i++) {
          ringOut[ro + i * 2] = dx[i]
          ringOut[ro + i * 2 + 1] = dz[i]
          bulge = Math.max(bulge, Math.hypot(dx[i], dz[i]))
        }
        bulgeOut[sample] = bulge
        const bo = sample * M * 3
        B.forEach((b, j) => {
          ballOut[bo + j * 3] = b.x
          ballOut[bo + j * 3 + 1] = b.z
          ballOut[bo + j * 3 + 2] = b.y
        })
        sample++
      }
      // spawn: pop up with a little hop, rolling out from the pin
      for (const b of B) {
        if (!b.born && t >= b.spawn) {
          b.born = true
          const ox = b.x - kigali[0]
          const oz = b.z - kigali[1]
          const ol = Math.hypot(ox, oz) || 1
          b.vx = (ox / ol) * b.v0
          b.vz = (oz / ol) * b.v0
          b.vy = b.hop
        }
      }
      // ring: tension along the loop + saturating tack to the border + damping
      for (let i = 0; i < N; i++) {
        const a = (i + N - 1) % N
        const c = (i + 1) % N
        const tack = cfg.tack / (1 + Math.hypot(dx[i], dz[i]) / cfg.tackSat)
        fx[i] = nodeMass * (lap * (dx[a] + dx[c] - 2 * dx[i]) - tack * dx[i] - cfg.ringDamp * vx[i])
        fz[i] = nodeMass * (lap * (dz[a] + dz[c] - 2 * dz[i]) - tack * dz[i] - cfg.ringDamp * vz[i])
      }
      for (const b of B) {
        b.fx = 0
        b.fz = 0
      }
      const pull = pullAt(t)
      const drag = dragAt(t)
      for (const b of B) {
        if (!b.born) continue
        // sphere ↔ ring segments
        const reach = b.r + RING_R
        for (let i = 0; i < N; i++) {
          const j = i + 1 === N ? 0 : i + 1
          const ax = nodes[i][0] + dx[i]
          const az = nodes[i][1] + dz[i]
          const bx = nodes[j][0] + dx[j]
          const bz = nodes[j][1] + dz[j]
          if (Math.min(ax, bx) - reach > b.x || Math.max(ax, bx) + reach < b.x || Math.min(az, bz) - reach > b.z || Math.max(az, bz) + reach < b.z) continue
          const sx = bx - ax
          const sz = bz - az
          const ll = sx * sx + sz * sz
          const u = ll > 1e-12 ? clamp01(((b.x - ax) * sx + (b.z - az) * sz) / ll) : 0
          const ex = ax + sx * u - b.x
          const ez = az + sz * u - b.z
          const d = Math.hypot(ex, ez)
          if (d >= reach || d < 1e-9) continue
          const nx = ex / d
          const nz = ez / d
          const closing = (b.vx - (vx[i] * (1 - u) + vx[j] * u)) * nx + (b.vz - (vz[i] * (1 - u) + vz[j] * u)) * nz
          // segments share nodes: halve, so a sphere sitting on a node isn't pushed twice
          const f = 0.5 * Math.max(0, cfg.contact * (reach - d) + cfg.contactDamp * closing)
          fx[i] += f * nx * (1 - u)
          fz[i] += f * nz * (1 - u)
          fx[j] += f * nx * u
          fz[j] += f * nz * u
          b.fx -= f * nx
          b.fz -= f * nz
          if (t > T.release && b.y < 0.004) b.vy += (cfg.kick * f * dt) / b.m
        }
        // the Kigali needle
        const ex = b.x - kigali[0]
        const ez = b.z - kigali[1]
        const d = Math.hypot(ex, ez)
        const reachPost = b.r + cfg.post
        if (d < reachPost && d > 1e-9) {
          const closing = -(b.vx * ex + b.vz * ez) / d
          const f = Math.max(0, cfg.contact * (reachPost - d) + cfg.contactDamp * closing)
          b.fx += (f * ex) / d
          b.fz += (f * ez) / d
        }
      }
      // sphere ↔ sphere
      for (let p = 0; p < M; p++) {
        const a = B[p]
        if (!a.born) continue
        for (let q = p + 1; q < M; q++) {
          const c = B[q]
          if (!c.born) continue
          const ex = c.x - a.x
          const ez = c.z - a.z
          const reach = a.r + c.r
          if (Math.abs(ex) > reach || Math.abs(ez) > reach) continue
          const d = Math.hypot(ex, ez)
          if (d >= reach || d < 1e-9) continue
          const nx = ex / d
          const nz = ez / d
          const closing = (a.vx - c.vx) * nx + (a.vz - c.vz) * nz
          const f = Math.max(0, cfg.contact * (reach - d) + cfg.contactDamp * 0.5 * closing)
          a.fx -= f * nx
          a.fz -= f * nz
          c.fx += f * nx
          c.fz += f * nz
        }
      }
      // integrate (semi-implicit Euler)
      for (let i = 0; i < N; i++) {
        vx[i] += (fx[i] / nodeMass) * dt
        vz[i] += (fz[i] / nodeMass) * dt
        dx[i] += vx[i] * dt
        dz[i] += vz[i] * dt
      }
      for (const b of B) {
        if (!b.born) continue
        const tx = targetX - b.x
        const tz = targetZ - b.z
        const tl = Math.hypot(tx, tz) || 1
        let ax = b.fx / b.m + (pull * tx) / tl - drag * b.vx
        let az = b.fz / b.m + (pull * tz) / tl - drag * b.vz
        const speed = Math.hypot(b.vx, b.vz)
        if (b.y < 0.001 && speed > 1e-6) {
          const rr = Math.min(cfg.roll, speed / dt)
          ax -= (rr * b.vx) / speed
          az -= (rr * b.vz) / speed
        }
        b.vx += ax * dt
        b.vz += az * dt
        b.x += b.vx * dt
        b.z += b.vz * dt
        if (b.y > 0 || b.vy > 0) {
          b.vy -= cfg.gravity * dt
          b.y += b.vy * dt
          if (b.y <= 0) {
            b.y = 0
            b.vy = b.vy < -0.12 ? -b.vy * cfg.bounce : 0
          }
        }
      }
    }
    return { t0, rate, count, N, M, ring: ringOut, balls: ballOut, bulge: bulgeOut, cfg }
  }

  // Sphere spawn layout round the Kigali pin (shared by build and offline tuning)
  function ballSetup(kigali) {
    return BALLS.map((b, i) => {
      const a = (b.angle * Math.PI) / 180
      return {
        r: b.r,
        pearl: b.pearl,
        x: kigali[0] + Math.cos(a) * b.dist,
        z: kigali[1] + Math.sin(a) * b.dist,
        spawn: T.spill + i * 0.024,
        v0: 0.42 + (0.14 * ((i * 7) % 5)) / 4,
        hop: 0.42 + (0.1 * ((i * 3) % 4)) / 3,
      }
    })
  }

  // Motion-blur windows for the fast parts (render-only; read by render/render.mjs)
  SC.post.motionBlurWindows.push(
    { from: 16.62, to: 16.96, subframes: 16 }, // the ring being laid round the border
    { from: 17.2, to: 17.44, subframes: 16 }, // the escape
    { from: 17.44, to: 17.64, subframes: 24 }, // the snap and the fling home (up to ~75 px/frame)
    { from: 17.64, to: 17.8, subframes: 16 },
  )

  SC.scene({
    id: 's3-data',
    start: 16.3,
    end: 19.6,
    z: 30,
    // exposed for offline tuning (node) and debugging
    T,
    prepareRing,
    simulate,
    ballSetup,
    build(root, api) {
      const THREE = window.THREE
      const L = SC3D.layout
      const P = SC3D.props
      const group = SC3D.sceneGroup(root, 's3')

      // ── Simulation (once) — in the slab's rest frame
      const restPose = SC3D.poses.rwandaRing(T.lift) // Rwanda is at rest during build
      const rest = restPose.points.map((p) => [p.x, p.z])
      const ring = prepareRing(rest)
      const kigali = [L.kigali.x, L.kigali.z]
      const setup = ballSetup(kigali)
      const sim = simulate({ nodes: ring.nodes, spacing: ring.spacing, kigali, balls: setup })

      // Where the pouch forms (node of max stretch) and where the heads meet (southmost point)
      let pouchNode = 0
      {
        let best = -1
        for (let k = 0; k < sim.count; k++) {
          if (sim.bulge[k] > best) {
            best = sim.bulge[k]
            pouchNode = k
          }
        }
        const o = pouchNode * sim.N * 2
        let m = -1
        for (let i = 0; i < sim.N; i++) {
          const d = Math.hypot(sim.ring[o + i * 2], sim.ring[o + i * 2 + 1])
          if (d > m) {
            m = d
            pouchNode = i
          }
        }
      }
      let south = 0
      rest.forEach((p, i) => {
        if (p[1] > rest[south][1]) south = i
      })

      // ── Data spheres: glossy violet + pearl, each with a soft contact shadow
      const pearl = SC3D.materials.pearlSatin.clone()
      pearl.color.set('#E4E1F4')
      pearl.roughness = 0.2
      pearl.clearcoat = 1
      pearl.clearcoatRoughness = 0.03
      pearl.envMapIntensity = 1.7
      pearl.emissiveIntensity = 0
      const violet = SC3D.materials.violetGloss.clone()
      const sphereGeometry = new THREE.SphereGeometry(1, 32, 22)
      const balls = setup.map((b) => {
        const mesh = new THREE.Mesh(sphereGeometry, b.pearl ? pearl : violet)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.visible = false
        const shadow = SC3D.makeContactShadow({ width: 1, depth: 1, opacity: 0 })
        shadow.visible = false
        group.add(mesh, shadow)
        return { ...b, mesh, shadow }
      })

      // ── Copy
      const copy = api.el('div', {
        text: 'Data stays in-country.',
        style: {
          position: 'absolute', left: '120px', top: '812px', font: '800 104px Inter', lineHeight: '1',
          color: '#F4F3FF', whiteSpace: 'nowrap', opacity: '0', letterSpacing: '-0.025em', willChange: 'transform',
        },
      }, root)

      const center = L.rwanda.center
      return {
        THREE, sim, ring, rest, balls, copy, pouchNode, south,
        outline: L.rwanda.outline.map((p) => [p.x, p.z]),
        pivot: new THREE.Vector3(center.x, L.surfaceY, center.z),
        q: new THREE.Quaternion(),
        euler: new THREE.Euler(),
        flat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
        v: new THREE.Vector3(),
        w: new THREE.Vector3(),
        tmpColor: new THREE.Color(),
        colors: {
          top: new THREE.Color('#272350'),
          topGlow: new THREE.Color('#2A1F8A'),
          edge: new THREE.Color('#6B63FF'),
          edgeGlow: new THREE.Color('#5148FF'),
          ringGlow: new THREE.Color('#6A60FF'),
        },
        liftSpring: api.ease.spring({ stiffness: 140, damping: 15, duration: 0.62 }),
        cinch: api.ease.spring({ stiffness: 420, damping: 18, duration: 0.3 }),
        runEase: api.ease.cubicBezier(0.5, 0, 0.3, 1),
      }
    },

    render(t, s, api) {
      const { THREE } = s
      const P = SC3D.props
      const L = SC3D.layout
      const sim = s.sim

      // ── Sample the simulation at t (linear between 480 Hz samples; holds outside the range)
      const f = Math.min(sim.count - 1, Math.max(0, (t - sim.t0) * sim.rate))
      const k0 = Math.floor(f)
      const k1 = Math.min(sim.count - 1, k0 + 1)
      const kf = f - k0
      const bulge = sim.bulge[k0] + (sim.bulge[k1] - sim.bulge[k0]) * kf
      const snapT = t - T.snap

      // ── Rwanda: lift (spring) · drag tilt while the ring strains · recoil dip on the snap ·
      //    settle back flush at the end
      let lift = 0
      let tilt = 0
      let shift = 0
      if (t >= T.lift) {
        lift = LIFT * s.liftSpring(clamp01((t - T.lift) / 0.62))
        if (snapT > 0) lift -= 0.011 * Math.exp(-snapT / 0.1) * Math.sin(2 * Math.PI * 6 * snapT)
        lift *= 1 - api.ease.inOutCubic(clamp01((t - T.down) / (T.flush - T.down)))
        // the pouch drags the slab: its east side dips a touch and it slides east, then rocks back
        const strain = (bulge / 0.2) * (1 - smooth(T.snap - 0.03, T.snap + 0.03, t))
        tilt = 0.9 * strain
        shift = 0.008 * strain
        if (snapT > 0) {
          const env = Math.exp(-snapT / 0.14)
          tilt -= 0.55 * env * Math.sin(2 * Math.PI * 5.2 * snapT)
          shift -= 0.004 * env * Math.sin(2 * Math.PI * 5.2 * snapT)
        }
        // a small rock as it comes up (south edge first), settling level by ~17.1
        const rise = t - T.lift
        const rock = 1.1 * Math.exp(-rise / 0.2) * Math.sin(2 * Math.PI * 2.1 * rise) * smooth(0, 0.08, rise)
        s.q.setFromEuler(s.euler.set((rock * Math.PI) / 180, 0, (-tilt * Math.PI) / 180))
        s.v.copy(s.pivot).applyQuaternion(s.q)
        P.rwanda.quaternion.copy(s.q)
        P.rwanda.position.copy(s.pivot).sub(s.v)
        P.rwanda.position.x += shift
        P.rwanda.position.y += lift
        P.rwanda.updateMatrixWorld(true)
        // the Kigali pin rides on the slab
        P.kigaliPin.position.copy(L.kigali).applyMatrix4(P.rwanda.matrixWorld)
        P.kigaliPin.quaternion.copy(s.q)
        // hand-off from s2: until 16.8 s2 draws the coil round the un-lifted pin; carry it up
        if (t < 16.8 && P.band.touched) P.band.mesh.position.y += lift
      } else {
        s.q.identity()
      }
      const M = P.rwanda.matrixWorld

      // ── Materials: the slab turns deep indigo with a lit violet edge; flares on the snap
      const glow = smooth(T.edge, T.edge + 0.32, t) * (1 - smooth(T.down, T.flush, t))
      const flare = snapT > -0.004 ? Math.exp(-Math.max(0, snapT) / 0.09) : 0
      const strainGlow = t < T.snap ? clamp01(bulge / 0.2) : 0
      if (t >= T.lift) {
        // start from (and end on) whatever the continent looks like this frame — s2 lifts the
        // continent's top/edge with emissive until it lets go — so Rwanda never pops at a hand-off
        const top = P.rwanda.userData.top
        const edge = P.rwanda.userData.edge
        const land = P.continent.userData
        top.color.copy(land.top.color).lerp(s.colors.top, glow)
        top.emissive.copy(land.top.emissive).lerp(s.tmpColor.copy(s.colors.topGlow).multiplyScalar(0.06 + 0.2 * flare), glow)
        edge.color.copy(land.edge.color).lerp(s.colors.edge, glow)
        edge.emissive.copy(land.edge.emissive).lerp(s.tmpColor.copy(s.colors.edgeGlow).multiplyScalar(0.42 + 0.35 * flare), glow)
      }

      // ── The ring
      const ringFade = 1 - smooth(19.28, 19.55, t) // displacement (and de-kinking) → canonical pose by the end
      const ringR = RING_R + (0.011 - RING_R) * (1 - ringFade)
      if (t >= T.ringRun) {
        SC3D.claim('ring')
        const running = t < T.ringClose
        // offset: laid slightly loose, then cinched onto the border
        let offset = 0.012
        if (running) offset = 0.02
        else if (t < T.ringClose + 0.3) offset = 0.02 + (0.012 - 0.02) * s.cinch((t - T.ringClose) / 0.3)
        const pose = SC3D.poses.rwandaRing(t, { offset, lift: 0.012 })
        const pts = pose.points
        const n = pts.length
        const N = sim.N
        const ro0 = k0 * N * 2
        const ro1 = k1 * N * 2
        const radius = new Float32Array(n)
        for (let j = 0; j < n; j++) {
          const pj = s.ring.param[j]
          const i0 = Math.floor(pj) % N
          const i1 = (i0 + 1) % N
          const fj = pj - Math.floor(pj)
          const d = (i) => [
            sim.ring[ro0 + i * 2] + (sim.ring[ro1 + i * 2] - sim.ring[ro0 + i * 2]) * kf,
            sim.ring[ro0 + i * 2 + 1] + (sim.ring[ro1 + i * 2 + 1] - sim.ring[ro0 + i * 2 + 1]) * kf,
          ]
          const a = d(i0)
          const b = d(i1)
          const ddx = (a[0] + (b[0] - a[0]) * fj) * ringFade
          const ddz = (a[1] + (b[1] - a[1]) * fj) * ringFade
          const mag = Math.hypot(ddx, ddz)
          // where the band is peeled off and stretched it straightens (loses the border's jags)
          const straight = smooth(0.004, 0.03, mag)
          const lx = (s.ring.light[j][0] - s.rest[j][0]) * ringFade
          const lz = (s.ring.light[j][1] - s.rest[j][1]) * ringFade
          const sx = ddx + lx + (s.ring.smoothed[j][0] - s.rest[j][0] - lx) * straight
          const sz = ddz + lz + (s.ring.smoothed[j][1] - s.rest[j][1] - lz) * straight
          s.v.set(sx, 0, sz).applyQuaternion(s.q)
          pts[j].add(s.v)
          // thinner where stretched: r ∝ 1/√stretch (local node spacing vs rest)
          const c = d((i0 + 2) % N)
          const e = d((i0 + N - 1) % N)
          const nodes = s.ring.nodes
          const restLen = Math.hypot(nodes[(i0 + 2) % N][0] - nodes[(i0 + N - 1) % N][0], nodes[(i0 + 2) % N][1] - nodes[(i0 + N - 1) % N][1])
          const len = Math.hypot(nodes[(i0 + 2) % N][0] + c[0] * ringFade - nodes[(i0 + N - 1) % N][0] - e[0] * ringFade, nodes[(i0 + 2) % N][1] + c[1] * ringFade - nodes[(i0 + N - 1) % N][1] - e[1] * ringFade)
          radius[j] = ringR * Math.min(1.06, Math.max(0.55, Math.sqrt(restLen / Math.max(1e-6, len))))
        }
        if (running) {
          // two ends laid from the north, meeting at the south (front); the free ends ride a touch
          // high and taper, like a band being pressed into place
          const p = s.runEase(clamp01((t - T.ringRun) / (T.ringClose - T.ringRun)))
          const north = (s.south + Math.round(n / 2)) % n
          const half = p * (n / 2)
          const list = []
          const rad = []
          const first = -Math.floor(half)
          const last = Math.floor(half)
          for (let k = first; k <= last; k++) {
            const j = (north + k + n * 4) % n
            list.push(pts[j].clone())
            rad.push(radius[j])
          }
          if (list.length >= 3) {
            const len = list.length
            const grow = smooth(0, 0.05, t - T.ringRun)
            for (let k = 0; k < len; k++) {
              const fromEnd = Math.min(k, len - 1 - k)
              const raise = Math.max(0, 1 - fromEnd / 7)
              list[k].y += 0.014 * raise * raise * (1 - p)
            }
            P.ring.update(list, (u) => {
              const idx = Math.min(len - 1, Math.round(u * (len - 1)))
              const fromEnd = Math.min(idx, len - 1 - idx)
              const taper = 0.55 + 0.45 * Math.min(1, fromEnd / 6)
              return rad[idx] * grow * (taper + (1 - taper) * smooth(0.85, 1, p))
            }, { closed: false })
          }
        } else {
          // cinch: a quick thin → full pulse as it tightens
          const pulse = t < T.ringClose + 0.2 ? 1 - 0.18 * Math.sin(Math.PI * clamp01((t - T.ringClose) / 0.12)) : 1
          // radius lookup along the displayed loop's arc length
          const cum = new Float32Array(n + 1)
          for (let j = 1; j <= n; j++) cum[j] = cum[j - 1] + pts[j - 1].distanceTo(pts[j % n])
          const total = cum[n]
          let cursor = 0
          P.ring.update(pts, (u) => {
            const at = u * total
            if (cum[cursor] > at) cursor = 0
            while (cursor < n - 1 && cum[cursor + 1] < at) cursor++
            const g = clamp01((at - cum[cursor]) / Math.max(1e-9, cum[cursor + 1] - cum[cursor]))
            return (radius[cursor] + (radius[(cursor + 1) % n] - radius[cursor]) * g) * pulse
          }, { closed: true })
        }
        // stored energy glows a touch as it stretches; the snap flares it
        P.ring.mesh.material.emissive.copy(s.colors.ringGlow).multiplyScalar(0.12 * strainGlow + 0.75 * flare)
      }

      // ── Data spheres
      const bo0 = k0 * sim.M * 3
      const bo1 = k1 * sim.M * 3
      s.balls.forEach((b, j) => {
        const age = t - b.spawn
        const sink = api.ease.inCubic(clamp01((t - (T.sink + j * 0.025)) / 0.2))
        if (age < 0 || sink >= 1) {
          b.mesh.visible = false
          b.shadow.visible = false
          return
        }
        const x = sim.balls[bo0 + j * 3] + (sim.balls[bo1 + j * 3] - sim.balls[bo0 + j * 3]) * kf
        const z = sim.balls[bo0 + j * 3 + 1] + (sim.balls[bo1 + j * 3 + 1] - sim.balls[bo0 + j * 3 + 1]) * kf
        const hop = sim.balls[bo0 + j * 3 + 2] + (sim.balls[bo1 + j * 3 + 2] - sim.balls[bo0 + j * 3 + 2]) * kf
        const emerge = api.ease.outCubic(clamp01(age / 0.09))
        const scale = b.r * (0.5 + 0.5 * emerge)
        const y = L.surfaceY + b.r + hop - (1 - emerge) * 1.7 * b.r - sink * 2.3 * b.r
        b.mesh.visible = true
        b.mesh.position.set(x, y, z).applyMatrix4(M)
        b.mesh.scale.setScalar(scale)
        // contact shadow on the slab top (only while over the slab)
        const inside = pointInPolygon(x, z, s.outline) ? 1 : 0
        const opacity = 0.85 * emerge * (1 - sink) * inside * clamp01(1 - hop / 0.05)
        b.shadow.visible = opacity > 0.01
        if (b.shadow.visible) {
          b.shadow.position.set(x, L.surfaceY + 0.0015, z).applyMatrix4(M)
          b.shadow.quaternion.copy(s.q).multiply(s.flat)
          const spread = b.r * (2.5 + 14 * hop)
          b.shadow.scale.set(spread, spread, 1)
          b.shadow.material.opacity = opacity
        }
      })

      // ── The snap: impact light where the pouch slams back through the border
      if (snapT > -0.004 && snapT < 0.45) {
        // just inside the border and above it, so the light rakes the slab top rather than
        // blowing out the jagged wall
        const node = s.ring.nodes[s.pouchNode]
        const c = L.rwanda.center
        s.w.set(node[0] + (c.x - node[0]) * 0.18, L.surfaceY + 0.1, node[1] + (c.z - node[1]) * 0.18).applyMatrix4(M)
        SC3D.flash(s.w, { intensity: 0.8 * flare, size: 0.6 })
      }

      // ── Copy: snaps from thin + stretched (far) to tight Inter 800 (close); still 17.8–19.3
      const inT = t - T.copyIn
      if (inT < 0 || t >= T.copyOut + 0.2) {
        api.setStyle(s.copy, { opacity: '0' })
      } else {
        // tracking: wide → overshoots tight → lands (exactly, zero velocity) by 17.78
        const spacing = api.keyframes(inT, [[0, 0.26], [0.17, -0.04, 'outCubic'], [0.28, -0.025, 'smooth']])
        const weight = api.keyframes(inT, [[0, 300], [0.16, 800, 'outCubic']])
        // clears fast: the camera glide carries Rwanda under the copy from ~19.33
        const outK = api.ease.outQuad(clamp01((t - T.copyOut) / 0.12))
        const opacity = api.ease.outCubic(clamp01(inT / 0.1)) * (1 - outK)
        api.setStyle(s.copy, {
          opacity: String(api.round(opacity, 3)),
          fontWeight: String(Math.round(weight)),
          letterSpacing: `${api.round(spacing, 4)}em`,
          transform: `translateY(${api.round(-12 * outK, 2)}px)`,
        })
      }
    },
  })

  function pointInPolygon(x, z, poly) {
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i]
      const [xj, zj] = poly[j]
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
    }
    return inside
  }
})()
