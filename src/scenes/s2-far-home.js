// s2 "Far → Home" (6.5–16.8) — the film's peak.
// The band arrives from s1 at Kigali (6.8), its tail is dragged south to Cape Town, lifting off the
// continent (7.12–9.0), catches on the Cape Town needle (9.0), strains with a growing tremble and a
// tension spike (10.5), chokes dead straight and freezes (the breath, 12.8–14.0), then SNAPS home at
// 14.000: the released end races back to Kigali as a fat relaxed slug (onion-skinned), slams in at
// 14.10 (flare + shock), whips round the needle like a lasso and cinches into the coil (14.30), which
// vibrates out and is exactly SC3D.poses.kigaliCoil(t) from 15.0 on.
(() => {
  // Every beat of s2, in global seconds (the sound designer's cue list).
  const E = {
    own: 6.8, // band ownership from s1 (tail still arriving)
    land: 7.0, // the drag begins (the band arrived at rest from s1 at 6.8)
    dragEnd: 8.92, // far end overshoots the Cape Town needle
    catch: 9.0, // …and catches on it: twang; far copy fully in
    spikeRise: 10.4, // tension spike starts
    spike: 10.5, // spike peak (the number swells; "peaks at 200 ms" arrives on it)
    breath: 12.8, // dead straight, frozen
    antic: 13.93, // last hair of strain before the release
    snap: 14.0, // Cape Town pin pops; release
    home: 14.1, // band slams home at Kigali: flare + shock
    coil: 14.38, // lasso cinches into the coil
    canon: 15.0, // band == SC3D.poses.kigaliCoil(t) from here
  }

  SC.scene({
    id: 's2-far-home',
    start: 6.5,
    end: 16.8,
    z: 20,
    build(root, api) {
      const THREE = window.THREE
      const L = SC3D.layout
      const P = SC3D.props
      const group = SC3D.sceneGroup(root, 's2')

      // ---- Onion-skin ghosts of the recoiling band (additive violet light trails)
      const ghosts = [0.34, 0.22, 0.14, 0.08].map((opacity, index) => {
        const material = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#7C72FF'), transparent: true, opacity, blending: THREE.AdditiveBlending,
          depthWrite: false, toneMapped: false,
        })
        const band = SC3D.makeElasticBand({ material, segments: 90, radial: 8, name: `s2-ghost-${index}` })
        band.mesh.castShadow = false
        band.mesh.receiveShadow = false
        band.mesh.renderOrder = 9
        band.mesh.children.forEach((cap) => {
          cap.castShadow = false
          cap.receiveShadow = false
          cap.renderOrder = 9
        })
        group.add(band.mesh)
        return { band, material, opacity }
      })

      // ---- The band's hook loops round the two needles (same material as the band)
      const loopGeometry = new THREE.TorusGeometry(0.03, 0.0105, 10, 44)
      loopGeometry.rotateX(Math.PI / 2)
      const makeLoop = (name) => {
        const mesh = new THREE.Mesh(loopGeometry, P.band.mesh.material)
        mesh.name = name
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.visible = false
        group.add(mesh)
        return mesh
      }
      const kigaliLoop = makeLoop('s2-kigali-loop')
      const capeLoop = makeLoop('s2-cape-loop')

      // ---- 2D copy (Inter only; weight carries meaning: thin = far, heavy = close)
      const abs = (style) => ({ position: 'absolute', left: '0px', top: '0px', whiteSpace: 'nowrap', opacity: '0', willChange: 'transform, opacity', ...style })
      const block = (style) => ({ whiteSpace: 'nowrap', opacity: '0', willChange: 'transform, opacity', ...style })
      // City labels anchored to the pins (the overview's geography read)
      const shadow = '0 2px 18px rgba(6,5,12,0.75)'
      const kigaliLabel = api.el('div', { text: 'Kigali', style: abs({ font: '500 42px Inter', letterSpacing: '0.005em', color: '#D3CFFF', textShadow: shadow }) }, root)
      const capeLabel = api.el('div', { text: 'Cape Town', style: abs({ font: '400 42px Inter', letterSpacing: '0.005em', color: '#BDBAC8', textShadow: shadow }) }, root)

      // Far: lower left, beside the band's receding length (never against the Kigali pin)
      const far = api.el('div', { style: abs({ left: '118px', top: '574px', opacity: '1' }) }, root)
      const farKicker = api.el('div', { text: 'Cape Town · nearest hyperscaler region', style: block({ font: '400 40px Inter', color: '#BDBAC8', letterSpacing: '0.01em' }) }, far)
      const farNumber = api.el('div', { style: block({ font: '250 208px Inter', lineHeight: '1', color: '#F4F3FF', margin: '10px 0 0 -14px', transformOrigin: '0 55%' }) }, far)
      const farValue = api.el('span', { text: '~110' }, farNumber)
      api.el('span', { text: ' ms' }, farNumber)
      const farUnit = api.el('div', { text: 'per request', style: block({ font: '400 44px Inter', color: '#BDBAC8', marginTop: '14px' }) }, far)
      const farPeak = api.el('div', { text: 'peaks at 200 ms', style: block({ font: '500 44px Inter', color: '#CFCBDC', marginTop: '6px' }) }, far)

      // Home: upper left, level with the Kigali pin head
      const home = api.el('div', { style: abs({ left: '118px', top: '300px', opacity: '1' }) }, root)
      const homeKicker = api.el('div', { text: 'Strettch Cloud · Kigali-1', style: block({ font: '600 42px Inter', color: '#BDB8FF', letterSpacing: '0.005em', marginBottom: '8px' }) }, home)
      const homeNumber = api.el('div', { text: '10\u200A–\u200A30 ms', style: block({ font: '900 214px Inter', lineHeight: '1', color: '#F4F3FF', margin: '0 0 0 -12px', transformOrigin: '0 60%' }) }, home)
      const homeUnit = api.el('div', { text: 'per request', style: block({ font: '400 44px Inter', color: '#BDBAC8', marginTop: '16px' }) }, home)

      const state = { THREE, group, ghosts, kigaliLoop, capeLoop, kigaliLabel, capeLabel, far, farKicker, farNumber, farValue, farUnit, farPeak, home, homeNumber, homeKicker, homeUnit }

      // ---- Constant geometry
      const K0 = L.kigali.clone()
      const C0 = L.capeTown.clone()
      const dirKC = C0.clone().sub(K0).setY(0).normalize() // Kigali → Cape Town (on the floor)
      const dirCK = dirKC.clone().negate()
      const up = new THREE.Vector3(0, 1, 0)
      Object.assign(state, {
        K0, C0, dirKC, dirCK,
        axisK: new THREE.Vector3().crossVectors(up, dirKC).normalize(), // +lean tips the Kigali pin toward Cape Town
        axisC: new THREE.Vector3().crossVectors(up, dirCK).normalize(), // +lean tips the Cape Town pin toward Kigali
        side: new THREE.Vector3(-dirKC.z, 0, dirKC.x), // horizontal normal of the Kigali–Cape Town line
      })
      // The hand-off pose s1 delivers at 6.8 (its HANDOFF): at rest, straight from the Kigali needle
      // (head) to the arrival point WSW of it (tail), radius bandRadius(length, 2.0, 0.045).
      state.HOOK = new THREE.Vector3(K0.x, 0.22, K0.z)
      state.T1 = new THREE.Vector3(K0.x - 0.9, 0.2, K0.z + 0.5)
      state.R_HANDOFF = SC3D.bandRadius(state.HOOK.distanceTo(state.T1), 2.0, 0.045)
      return state
    },

    render(t, s, api) {
      const { THREE, K0, C0, dirKC } = s
      const P = SC3D.props
      const TAU = Math.PI * 2
      const DEG = Math.PI / 180
      const { clamp, lerp, progress } = api
      const smooth = (a, b, x) => {
        const v = progress(x, a, b)
        return v * v * (3 - 2 * v)
      }

      // =======================================================================================
      // Tension (0 slack … 1 max) and its shapes
      // =======================================================================================
      const spikeEnv = (time) => (time < E.spikeRise ? 0 : time < E.spike ? api.ease.outCubic(progress(time, E.spikeRise, E.spike)) : Math.exp(-(time - E.spike) / 0.32) * (1 - smooth(11.6, 12.4, time)))
      const antic = (time) => (time < E.antic || time >= E.snap ? 0 : api.ease.inQuad(progress(time, E.antic, E.snap)))
      const tension = (time) => {
        if (time < E.land) return 0
        if (time < E.dragEnd) return 0.42 * Math.pow(smooth(E.land, E.dragEnd, time), 1.6)
        if (time < E.catch) return lerp(0.42, 0.55, smooth(E.dragEnd, E.catch, time))
        if (time < E.snap) return 0.55 + 0.45 * smooth(E.catch, 12.55, time) + 0.25 * spikeEnv(time) + 0.06 * antic(time)
        return 0
      }
      // Standing-wave tremble: grows 9→12.2, the spike kicks it, then it chokes to zero as the band
      // pulls dead straight at 12.8 (higher pitch, smaller swing) and is gone in the breath.
      const trembleAmp = (time) => {
        if (time < E.catch || time >= E.breath) return 0
        const pluck = 0.05 * Math.exp(-(time - E.catch) / 0.22)
        const grow = 0.004 + 0.02 * smooth(9.3, 12.1, time)
        const spike = 0.05 * spikeEnv(time)
        return (pluck + grow + spike) * (1 - smooth(12.2, E.breath, time))
      }
      // phase of a frequency ramp 8 → 17 Hz across the strain (integrated, so it never chirps)
      const tremblePhase = (time) => {
        const x = clamp(time, E.catch, E.breath) - E.catch
        const span = E.breath - E.catch
        return TAU * (8 * x + (9 / (2 * span)) * x * x)
      }

      // =======================================================================================
      // Pins (pure functions of time)
      // =======================================================================================
      const pinScale = (time) => 1 + 0.5 * smooth(6.5, 7.3, time) - 0.5 * smooth(9.4, 11.4, time)
      const settleWindow = (time) => 1 - smooth(14.72, E.canon, time)
      const kigaliLean = (time) => {
        // degrees; + toward Cape Town
        if (time < E.snap) {
          const sway = trembleAmp(time) * 6 * Math.sin(tremblePhase(time) * 0.5 + 1.3)
          return 4.2 * tension(time) + sway + 1.6 * spikeEnv(time) + 0.5 * antic(time)
        }
        const release = (4.2 * 1.06 + 0.5) * Math.exp(-(time - E.snap) / 0.09) * Math.cos(TAU * 5 * (time - E.snap)) // = the strained lean at 14.0
        const impact = time >= E.home ? -7 * Math.exp(-(time - E.home) / 0.2) * Math.sin(TAU * 5.5 * (time - E.home)) : 0
        const cinch = time >= E.coil ? 1.6 * Math.exp(-(time - E.coil) / 0.14) * Math.sin(TAU * 7 * (time - E.coil)) : 0
        return (release + impact + cinch) * settleWindow(time)
      }
      const capeLean = (time) => {
        // degrees; + toward Kigali
        if (time >= E.snap) return 0
        const jolt = time >= E.catch ? 7 * Math.exp(-(time - E.catch) / 0.14) * Math.sin(TAU * 6 * (time - E.catch)) : 0
        const sway = trembleAmp(time) * 5 * Math.sin(tremblePhase(time) * 0.5 + 0.2)
        return 5 * tension(time) + jolt + sway + 1.2 * antic(time)
      }
      const kPose = (time) => ({ scale: time >= E.snap ? 1 : pinScale(time), lean: kigaliLean(time) * DEG })
      const cPose = (time) => ({ scale: pinScale(time), lean: capeLean(time) * DEG })
      const onKigali = (pose, local) => local.clone().multiplyScalar(pose.scale).applyAxisAngle(s.axisK, pose.lean).add(K0)
      const onCape = (pose, local) => local.clone().multiplyScalar(pose.scale).applyAxisAngle(s.axisC, pose.lean).add(C0)
      const ANCHOR = new THREE.Vector3(0.03, 0.07, 0) // = the canonical coil's first point (angle 0, y0)
      const CAPE_HOOK = new THREE.Vector3(dirKC.x * 0.03, 0.07, dirKC.z * 0.03) // far side of the Cape Town needle
      const anchorAt = (time) => onKigali(kPose(time), ANCHOR)
      const capeHookAt = (time) => onCape(cPose(time), CAPE_HOOK)

      // =======================================================================================
      // Band pose (pure function of time) → { points, radius, moving, tip }
      // =======================================================================================
      const RC = 0.03
      const Y0 = 0.07
      const Y1 = 0.19
      const THETA = 2.4 * TAU
      const COIL_R = 0.016
      const coilWobble = (time) => (time >= E.snap ? 0.35 * Math.exp(-Math.max(0, time - 14.3) / 0.55) : 0)
      const coilBounce = (time) => (time >= E.coil ? 0.045 * Math.exp(-(time - E.coil) / 0.16) * Math.sin(TAU * 6.5 * (time - E.coil) + 0.4) * settleWindow(time) : 0)
      const coilPoint = (pose, theta, time, bounce) => {
        const u = theta / THETA
        const r = RC * (1 + coilWobble(time) * Math.sin(TAU * 11 * time + u * 9))
        return onKigali(pose, new THREE.Vector3(Math.cos(theta) * r, Y0 + (Y1 + bounce - Y0) * u, Math.sin(theta) * r))
      }
      const coilArcPerRadian = Math.hypot(RC, (Y1 - Y0) / THETA)
      const strainLength = anchorAt(E.snap - 1e-4).distanceTo(capeHookAt(E.snap - 1e-4))

      const rDrag = (length) => clamp(0.042 * Math.sqrt(3.4 / Math.max(length, 0.1)), 0.0266, 0.04)
      const rStrain = (time) => lerp(0.0266, 0.0135, smooth(E.catch, 12.5, time)) * (1 - 0.2 * spikeEnv(time)) * (1 - 0.1 * antic(time))

      // Straight a→b with the strain tremble, an arch and a sag (points from Kigali to the far end)
      const strand = (a, b, time, { count = 56, sag = 0, arch = 0, amp = 0 } = {}) => {
        const pts = []
        const side = new THREE.Vector3(-(b.z - a.z), 0, b.x - a.x).normalize()
        const phase = tremblePhase(time)
        for (let i = 0; i <= count; i++) {
          const u = i / count
          const p = a.clone().lerp(b, u)
          p.y += (arch - sag) * 4 * u * (1 - u)
          if (amp) {
            let lateral = 0
            let vertical = 0
            for (let mode = 1; mode <= 3; mode++) {
              const shape = Math.sin(mode * Math.PI * u)
              const seed = api.hash(7, mode) * TAU
              lateral += (shape / mode) * Math.sin(phase * (1 + 0.37 * (mode - 1)) + seed)
              vertical += (shape / mode) * Math.sin(phase * 1.13 * (1 + 0.37 * (mode - 1)) + seed * 1.7)
            }
            p.addScaledVector(side, lateral * amp * 0.75)
            p.y += vertical * amp * 0.45
          }
          pts.push(p)
        }
        return pts
      }

      // The far end during the carry: arrival from s1 (6.8–7.12), drag south (7.12–8.92), catch (9.0)
      const dragTarget = () => capeHookAt(E.dragEnd).addScaledVector(dirKC, 0.17).setY(0.26)
      const dragEase = api.ease.cubicBezier(0.5, 0, 0.28, 1)
      const farEnd = (time) => {
        if (time < E.land) return s.T1.clone()
        if (time < E.dragEnd) {
          const k = dragEase(progress(time, E.land, E.dragEnd))
          const target = dragTarget()
          const p = s.T1.clone().lerp(target, k)
          p.addScaledVector(s.side, -0.55 * Math.sin(Math.PI * k)) // bows out as it swings south
          p.y = lerp(s.T1.y, target.y, k) + 0.85 * Math.pow(Math.sin(Math.PI * k), 1.15)
          return p
        }
        // pulled back onto the needle: hits it at 9.0 (the catch)
        const k = api.ease.inCubic(progress(time, E.dragEnd, E.catch))
        return dragTarget().lerp(capeHookAt(time), k)
      }

      const bandPose = (time) => {
        // ---- carry + drag
        if (time < E.catch) {
          // head: from s1's hook (needle centre) onto our loop on the needle
          const a = s.HOOK.clone().lerp(anchorAt(time), smooth(E.own, 7.15, time))
          const b = farEnd(time)
          const slack = 1 - clamp(tension(time) / 0.42)
          const pts = strand(a, b, time, { count: 40, sag: time >= E.land ? 0.05 * slack : 0 })
          if (time >= E.land) {
            // the far end is hauled, not glided: a slow wobble along the strand
            const wob = 0.012 * Math.sin(Math.PI * progress(time, E.land, E.dragEnd))
            pts.forEach((p, i) => {
              const u = i / (pts.length - 1)
              p.addScaledVector(s.side, wob * Math.sin(Math.PI * u) * Math.sin(TAU * 3.1 * time + u * 2))
            })
          }
          return { points: pts, radius: lerp(s.R_HANDOFF, rDrag(a.distanceTo(b)), smooth(E.own, 7.35, time)), tip: b }
        }
        // ---- strain + breath (frozen: tremble 0, pins still)
        if (time < E.snap) {
          const frozenT = Math.min(time, E.breath)
          return { points: strand(anchorAt(time), capeHookAt(time), frozenT, { amp: trembleAmp(frozenT) }), radius: rStrain(time), tip: capeHookAt(time) }
        }
        // ---- snap: release → race home → lasso round the needle → cinch
        if (time < E.canon) {
          const pose = kPose(time)
          const p1 = progress(time, E.snap, E.home) // the flight
          const p2 = progress(time, E.home, E.coil) // the wrap
          // the lasso: a slow, wide first swing past Kigali, spinning up as the needle eats the tail
          const thetaW = time < E.home ? 0 : THETA * (0.62 * p2 + 0.38 * Math.pow(p2, 2.4))
          const L1 = 0.9
          const Lt = time < E.home ? lerp(strainLength, L1, Math.pow(p1, 1.12)) : L1 * Math.pow(1 - thetaW / THETA, 1.15)
          const bounce = coilBounce(time)
          const coilCount = Math.max(1, Math.ceil((thetaW / TAU) * 34))
          const points = []
          for (let i = 0; i <= coilCount; i++) points.push(coilPoint(pose, (thetaW * i) / coilCount, time, bounce))
          const root = points[points.length - 1]
          if (time >= E.coil) return { points, radius: COIL_R, tip: root }
          // tail direction: straight at Cape Town during the flight, then the coil's tangent as it wraps
          const capeHook = capeHookAt(E.snap - 1e-4)
          const toCape = Math.atan2(capeHook.z - root.z, capeHook.x - root.x)
          const turnIn = smooth(E.home - 0.03, E.home + 0.05, time)
          const phiRoot = lerp(toCape, thetaW + Math.PI / 2, turnIn)
          const bend = 0.8 * Math.sin(Math.PI * clamp(p2 * 1.1)) * turnIn // the tip lags the swing
          const lift = time < E.home ? 0.22 * Math.sin(Math.PI * clamp(p1 * 1.08)) : 0.16 * Math.pow(1 - p2, 1.5) + 0.04 * Math.sin(Math.PI * p2)
          const tailCount = time < E.home ? 44 : 30
          const step = Lt / tailCount
          const tail = []
          let cursor = root.clone()
          for (let i = 1; i <= tailCount; i++) {
            const u = i / tailCount
            const phi = phiRoot - bend * Math.pow(u, 1.5)
            cursor = cursor.clone().add(new THREE.Vector3(Math.cos(phi) * step, 0, Math.sin(phi) * step))
            const q = cursor.clone()
            q.y = root.y + lift * Math.pow(u, 1.3)
            if (time < E.home) {
              // the whip: an S-wave running along the freed end
              const fromTip = Lt - u * Lt
              const slugLength = Math.min(Lt, 0.08 + 6.5 * (time - E.snap))
              const env = (1 - smooth(slugLength * 0.5, slugLength * 1.05, fromTip)) * Math.sin(Math.PI * clamp(p1 * 1.15)) * clamp(fromTip / 0.12)
              const wave = Math.sin(TAU * (fromTip / 0.62) - TAU * 11 * (time - E.snap))
              q.x += -Math.sin(phi) * 0.045 * env * wave
              q.z += Math.cos(phi) * 0.045 * env * wave
            }
            tail.push(q)
          }
          const coilArc = thetaW * coilArcPerRadian
          const total = coilArc + Lt
          // radius: coil 0.016 · still-taut remainder thin · relaxed slug near the tip fat
          const rTaut = lerp(rStrain(E.snap - 1e-4), COIL_R, 1 - Lt / strainLength)
          const rSlug = time < E.home ? 0.025 : lerp(0.024, COIL_R, api.ease.outQuad(p2))
          const slug = time < E.home ? Math.min(Lt, 0.08 + 6.5 * (time - E.snap)) : Lt + 1
          const radius = (u) => {
            const arc = u * total
            if (arc < coilArc) return COIL_R
            const blend = 1 - smooth(slug - 0.14, slug + 0.14, total - arc)
            return lerp(rTaut, rSlug, blend)
          }
          const movingFrom = time < E.home ? Math.max(0, tail.length - Math.ceil((Math.min(Lt, 1.6) / Lt) * tail.length)) : 0
          const moving = [root].concat(tail).slice(movingFrom)
          return { points: points.concat(tail), radius, moving, tip: tail[tail.length - 1], rSlug }
        }
        return null // canonical from here
      }

      // =======================================================================================
      // Continent: read as Africa (lit coast edge, top lifted off the floor)
      // =======================================================================================
      const edgeLight = 0.3 + 0.7 * (1 - smooth(9.3, 10.8, t))
      for (const slab of t < 16.5 ? [P.continent, P.rwanda] : [P.continent]) { // Rwanda is s3's from 16.5
        slab.userData.edge.emissive.set('#A89E96').multiplyScalar(0.34 * edgeLight)
        slab.userData.top.emissive.set('#211F27').multiplyScalar(0.9)
      }
      // pool: keep Africa lit, let the ocean floor fall away (overview only)
      const overview = 1 - smooth(9.6, 11.2, t)
      if (overview > 0.001) {
        const cam = SC3D.cameraAt(t)
        const d = cam.dist
        SC3D.light({ pool: { x: lerp(cam.subject.x, 1.2, overview), z: lerp(cam.subject.z, 1.5, overview), inner: lerp(d * 0.35, 8.5, overview), outer: lerp(d * 1.45, 17, overview), floor: lerp(0.12, 0.08, overview) } })
      }

      // =======================================================================================
      // Pins
      // =======================================================================================
      const kp = P.kigaliPin
      const cp = P.capeTownPin
      const kPoseNow = kPose(t)
      if (t < E.canon) {
        kp.position.copy(K0)
        kp.scale.setScalar(kPoseNow.scale)
        kp.quaternion.setFromAxisAngle(s.axisK, kPoseNow.lean)
      }
      // Cape Town pin: slate, never violet; pops at the snap (behind the camera)
      const cPoseNow = cPose(t)
      cp.position.copy(C0)
      cp.scale.setScalar(cPoseNow.scale)
      cp.quaternion.setFromAxisAngle(s.axisC, cPoseNow.lean)
      const capeHead = cp.userData.head
      capeHead.material.color.set('#46444D')
      capeHead.material.envMapIntensity = 0.3
      if (t >= E.snap) {
        // The pin fails: ripped out of the ground toward Kigali, spinning up and away. (From 11.5 on
        // the world camera sits ~1 u north of Cape Town, so this happens behind the lens: on screen
        // the pop reads through the band's freed end whipping in from the bottom of frame.)
        const x = t - E.snap
        cp.position.addScaledVector(s.dirCK, 4.5 * x * Math.exp(-x / 0.25)).add(new THREE.Vector3(0, 3.8 * x - 6 * x * x, 0))
        cp.quaternion.setFromAxisAngle(new THREE.Vector3(0.55, 0.25, -0.8).normalize(), 30 * x * Math.exp(-x / 0.6))
        cp.scale.setScalar(1)
        cp.visible = x < 0.5
      }

      // =======================================================================================
      // Band + loops + ghosts
      // =======================================================================================
      const band = P.band
      if (t >= E.own) {
        if (t < E.canon) {
          const pose = bandPose(t)
          let points = pose.points
          // s1 still driving the band in the ownership overlap: blend from its pose to ours
          if (t < 6.95 && band.touched && band.curve.points.length >= 2) {
            const k = smooth(E.own, 6.95, t)
            const theirs = band.curve.points
            const sample = (u) => {
              const f = u * (theirs.length - 1)
              const i = Math.min(theirs.length - 2, Math.floor(f))
              return theirs[i].clone().lerp(theirs[i + 1], f - i)
            }
            points = points.map((p, i) => sample(i / (points.length - 1)).lerp(p, k))
          }
          band.update(points, pose.radius)
        } else {
          // canonical coil (s3 lifts the pin from 16.5 and carries this coil up with it until 16.8)
          const pose = SC3D.poses.kigaliCoil(t)
          band.update(pose.points, pose.radius)
        }
      }
      // Hot band: emissive rises with tension, peaks in the breath, discharges on the snap
      const heat = t < E.snap ? 0.05 + 0.3 * smooth(E.own, 7.4, t) * (1 - smooth(9.2, 10.6, t)) + 0.2 * tension(t) + 0.25 * spikeEnv(t) + 0.3 * antic(t) : 0.5 * Math.exp(-(t - E.snap) / 0.18)
      band.mesh.material.emissive.set('#5A50FF').multiplyScalar(heat)

      // Hook loops
      s.kigaliLoop.visible = t >= E.own && t < E.home + 0.04
      if (s.kigaliLoop.visible) {
        s.kigaliLoop.position.copy(onKigali(kPoseNow, new THREE.Vector3(0, 0.07, 0)))
        s.kigaliLoop.quaternion.setFromAxisAngle(s.axisK, kPoseNow.lean)
        s.kigaliLoop.scale.setScalar(kPoseNow.scale)
      }
      s.capeLoop.visible = t >= E.catch - 0.03 && t < E.snap
      if (s.capeLoop.visible) {
        s.capeLoop.position.copy(onCape(cPoseNow, new THREE.Vector3(0, 0.07, 0)))
        s.capeLoop.quaternion.setFromAxisAngle(s.axisC, cPoseNow.lean)
        s.capeLoop.scale.setScalar(cPoseNow.scale)
      }

      // Onion skins of the moving part (14.0–14.34)
      const ghostEnv = t >= E.snap && t < E.coil + 0.04 ? smooth(E.snap, E.snap + 0.012, t) * (1 - smooth(E.coil - 0.08, E.coil + 0.04, t)) : 0
      if (ghostEnv > 0.001) {
        s.ghosts.forEach((ghost, index) => {
          const past = bandPose(t - (index + 1) * 0.0075)
          if (!past || !past.moving || past.moving.length < 2) return
          ghost.material.opacity = ghost.opacity * ghostEnv
          ghost.band.update(past.moving, (past.rSlug || 0.02) * (0.95 - index * 0.08))
        })
      }

      // =======================================================================================
      // Light, flare, shock, camera punch
      // =======================================================================================
      if (t >= 12.2 && t < E.snap) {
        const dip = smooth(12.2, E.breath, t)
        SC3D.light({ key: 1 - 0.14 * dip, env: 1 - 0.12 * dip, fill: 1 - 0.2 * dip, rim: 1 + 0.12 * dip })
      }
      if (t >= E.snap && t < E.home) {
        // the energy racing home: a violet comet riding the freed end
        SC3D.flash(bandPose(t).tip, { intensity: 0.75 * smooth(E.snap, E.snap + 0.02, t), size: 0.55, color: '#8C82FF' })
      }
      if (t >= E.home && t < E.home + 0.9) {
        const x = t - E.home
        SC3D.flash(new THREE.Vector3(K0.x, 0.3, K0.z), { intensity: 2.7 * Math.exp(-x / 0.055), size: 1.8, color: '#8A80FF' })
        SC3D.flash(new THREE.Vector3(K0.x, 0.26, K0.z), { intensity: 0.5 * Math.exp(-x / 0.3), size: 1.1, color: '#7C72FF', light: false })
        SC3D.shock(K0, { radius: 0.12 + x * 7, width: 0.45 + x * 1.6, intensity: 0.3 * Math.exp(-x / 0.4) })
        SC3D.light({ exposure: 1 + 0.3 * Math.exp(-x / 0.06) })
        SC3D.nudgeCamera({ roll: 0.9 * Math.exp(-x / 0.12) * Math.sin(TAU * 8 * x), pitch: 0.35 * Math.exp(-x / 0.1) * Math.sin(TAU * 10 * x + 1) })
        kp.userData.head.material.emissive.set('#6A60FF').multiplyScalar(0.9 * Math.exp(-x / 0.16))
      }
      if (t >= E.coil && t < E.coil + 0.5) {
        const x = t - E.coil
        SC3D.flash(new THREE.Vector3(K0.x, 0.24, K0.z), { intensity: 0.45 * Math.exp(-x / 0.08), size: 0.7, light: false })
      }
      if (t >= E.spikeRise && t < E.spike + 0.7) {
        const x = t - E.spikeRise
        SC3D.nudgeCamera({ roll: 0.22 * Math.exp(-Math.max(0, t - E.spike) / 0.18) * Math.sin(TAU * 7 * x) * smooth(E.spikeRise, E.spike, t) })
      }

      // =======================================================================================
      // Copy
      // =======================================================================================
      const setO = (node, value) => api.setStyle(node, { opacity: String(api.round(clamp(value), 3)) })
      const setT = (node, value) => api.setStyle(node, { transform: value })
      const r1 = (v) => api.round(v, 1)
      const r3 = (v) => api.round(v, 3)

      // City labels (anchored right of the pin heads)
      const headLocal = new THREE.Vector3(0, 0.5, 0)
      const labelAt = (node, pinPose, onPin, opacity, dx = 30) => {
        if (opacity <= 0.001) return setO(node, 0)
        const screen = SC3D.toScreen(onPin(pinPose, headLocal), t)
        setT(node, `translate(${r1(screen.x + dx * pinPose.scale)}px, ${r1(screen.y - 30)}px)`)
        setO(node, opacity)
      }
      const snapOut = 1 - smooth(E.snap, E.snap + 0.05, t)
      labelAt(s.kigaliLabel, kPoseNow, onKigali, smooth(7.25, 7.6, t) * snapOut)
      labelAt(s.capeLabel, cPoseNow, onCape, smooth(8.45, 8.8, t) * (1 - smooth(9.9, 10.25, t)))

      // Far copy: stretched in 8.52–9.0, strains wider to 12.8, frozen, collapses on the snap
      const farIn = smooth(8.62, 9.0, t)
      const strainWide = smooth(E.catch, E.breath, t)
      const swell = t < 10.4 ? 0 : t < 10.52 ? api.ease.outCubic(progress(t, 10.4, 10.52)) : t < 10.74 ? 1 : 1 - api.ease.inOutCubic(progress(t, 10.74, 11.0))
      // The number stays "~110": swapping it to "~200" under "per request" read as a false claim.
      // The spike is shown by the swell plus "peaks at 200 ms" arriving on it.
      const collapse = api.ease.inCubic(smooth(E.snap, E.snap + 0.075, t))
      const tracking = lerp(-0.04, 0.08, api.ease.outCubic(farIn)) + 0.04 * strainWide + 0.02 * swell - 0.3 * collapse
      api.setStyle(s.farNumber, {
        letterSpacing: `${r3(tracking)}em`,
        fontWeight: String(Math.round(250 - 60 * swell)),
        transform: `translateX(${r1(-40 * collapse)}px) scale(${r3((1 + 0.08 * swell) * (1 - 0.1 * collapse))})`,
      })
      setO(s.farNumber, farIn * (1 - collapse))
      const kickerIn = smooth(8.52, 8.86, t)
      setO(s.farKicker, kickerIn * snapOut)
      setT(s.farKicker, `translateY(${r1(14 * (1 - kickerIn))}px)`)
      const unitIn = smooth(8.72, 9.0, t)
      setO(s.farUnit, unitIn * snapOut)
      setT(s.farUnit, `translateY(${r1(12 * (1 - unitIn))}px)`)
      const peakIn = smooth(E.spikeRise, E.spike + 0.08, t)
      setO(s.farPeak, peakIn * snapOut)
      setT(s.farPeak, `translateY(${r1(12 * (1 - peakIn))}px)`)

      // Home copy: the number snaps in dense (14.30), then the SC kicker (never before the number)
      const homeOut = 1 - smooth(16.5, 16.72, t)
      const numIn = smooth(14.4, 14.5, t)
      const cinch = t < 14.4 ? 0 : 1 - api.ease.spring({ stiffness: 320, damping: 17, duration: 0.5 })(progress(t, 14.4, 14.9))
      api.setStyle(s.homeNumber, {
        letterSpacing: `${r3(-0.045 - 0.07 * cinch)}em`,
        transform: `translateY(${r1(-10 * (1 - homeOut))}px) scale(${r3(1 + 0.04 * cinch)})`,
      })
      setO(s.homeNumber, numIn * homeOut)
      const kIn = smooth(14.46, 14.6, t)
      setO(s.homeKicker, kIn * homeOut)
      setT(s.homeKicker, `translateY(${r1(12 * (1 - kIn) - 10 * (1 - homeOut))}px)`)
      const uIn = smooth(14.48, 14.6, t)
      setO(s.homeUnit, uIn * homeOut)
      setT(s.homeUnit, `translateY(${r1(12 * (1 - uIn) - 10 * (1 - homeOut))}px)`)
    },
  })
})()
