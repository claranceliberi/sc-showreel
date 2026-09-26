// s5 "Mark" (21.8–30.0) — the payoff (storyboard/v3/TREATMENT.md, beats 22.0–30.0).
//
// The three violet bands are plucked off their objects one by one — the phone band rolls up and
// off the phone, the Rwanda ring peels off the border, the hero Kigali band unspools off its pin —
// and each twangs into a taut, trembling line (three strings). They fly up toward camera in a
// volley, dock as a fan at the mark's angles, and snap home: each taut line retracts toward its
// slot's left wall and inflates into its bevelled satin slab (ONE continuous morphing sweep mesh,
// tube → stadium → bevelled prism, handed to the real extruded slab when identical — no
// cross-fade), unrolling a small pre-roll so its bevels sweep the key light, and clicks in like a
// server blade: tick 23.750 · tick 23.875 · LOCK 24.000 (the hero band makes the bottom slab and
// lights its LED). The wordmark rises out of its baseline reading "stretch cloud"; "ch cloud"
// steps aside, the violet t drops into the gap (25.000), squashes and shoves "ch cloud" home →
// "strettch cloud", then cools to the wordmark's pearl. Frontal lockup over a soft floor
// reflection of the mark; copy from 26.2; pixel-still from 27.0 (grain only).
//
// Every value is a pure function of t. Cue sheet (global s; also the sound designer's list):
//   22.20 phone band starts rolling up the phone      22.36 pops off the top (phone recoils)
//   22.50 phone band twangs taut                      22.60 Rwanda ring peels off the border
//   22.84 ring twangs taut                            23.00 hero band unspools off the Kigali pin
//   23.20 hero band twangs taut                       23.00/23.12/23.22 launches (whoosh up)
//   23.60/23.70/23.82 docked (fan)                    snaps 23.625→23.750 · 23.750→23.875 · 23.875→24.000
//   23.750 top slab CLICK · 23.875 middle CLICK · 24.000 LOCK (bottom slab, LED on, flash, shake)
//   24.04→24.26 letters start rising (settled ≈24.62)  24.10→24.78 camera pulls back (reveal)
//   24.75→24.90 "ch cloud" steps aside               24.72 t falls (in frame ≈24.82) → 25.000 lands
//   25.000→25.033 squash + shove · rebound 25.12 · settled 25.35
//   25.45→26.25 t cools violet → pearl               25.80→26.20 copy in (legible from 26.20)
//   27.00 camera + everything still
(() => {
  'use strict'
  const CUE = {
    phoneLift: 22.2, phonePop: 22.36, phoneTaut: 22.5,
    ringLift: 22.6, ringTaut: 22.84,
    coilLift: 23.0, coilTaut: 23.2,
    flyTop: [23.0, 23.6], flyMiddle: [23.12, 23.7], flyBottom: [23.22, 23.82], // the volley into the slots
    clickTop: 23.75, clickMiddle: 23.875, lock: 24.0, // each snap = SNAP s of retraction ending on its click
    wordRise: [24.04, 24.62],
    gapOpen: [24.75, 24.9],
    tFall: 24.72, tLand: 25.0,
    tToPearl: [25.45, 26.25],
    copyIn: [25.8, 26.2],
  }
  const SNAP = 0.125
  // Fast moves get dense motion-blur sampling (read by render/render.mjs).
  SC.post.motionBlurWindows.push({ from: 22.9, to: 24.1, subframes: 16 }) // flights, crane, snaps, lock
  SC.post.motionBlurWindows.push({ from: 24.78, to: 25.1, subframes: 24 }) // the t's fall + shove

  // Logo-space slab outlines (34×32 mark space, y down): wall x-extents and the top/bottom edge y
  // at the left and right walls. box = the centring box SC3D.makeMark uses for each slab.
  const SLABS = {
    top: { x0: 0, x1: 33.9626, top: [9.99776, 0], bot: [15.8417, 11.5077], box: { x0: 0, x1: 34, y0: 0, y1: 15.8417 } },
    middle: { x0: 0, x1: 33.894, top: [18.0271, 13.8486], bot: [23.871, 23.871], box: { x0: 0, x1: 33.9575, y0: 13.8486, y1: 23.871 } },
    bottom: { x0: 0, x1: 27.5195, top: [26.0547, 26.0547], bot: [31.8984, 31.8984], box: { x0: 0, x1: 27.5195, y0: 26.0547, y1: 31.8984 } },
  }
  const MARK_DEPTH = 5 // makeMark defaults (logo units)
  const MARK_BEVEL = 0.8

  // ------------------------------------------------------------------------------------------
  // Morph bar: one sweep mesh that is a glossy tube (or a flattened double strand) at m = 0 and
  // the bevelled extruded slab at m = 1. Rings are vertical slices (local y–z) along the slab's
  // long axis, each a rectangle with elliptical corners (circle → stadium → bevelled rectangle);
  // end rings make hemispherical caps (tube) or the slab's end bevel + flat wall (slab). Flat
  // sides own their vertices so faces shade flat like the real extrusion.
  // ------------------------------------------------------------------------------------------
  function makeMorphBar(THREE, material, name) {
    const A = 6
    const ARC = A + 1
    const STRIDE = ARC + 2
    const PER_RING = 4 * STRIDE
    const BODY = 30
    const ENDS = 6
    const RINGS = BODY + 1 + 2 * ENDS
    const CAP = PER_RING + 1
    const capBase = RINGS * PER_RING
    const positions = new Float32Array((capBase + 2 * CAP) * 3)
    const index = []
    const quad = (i, j0, j1) => {
      const a = i * PER_RING + j0
      const b = i * PER_RING + j1
      const c = (i + 1) * PER_RING + j0
      const d = (i + 1) * PER_RING + j1
      index.push(a, b, c, b, d, c)
    }
    for (let i = 0; i < RINGS - 1; i++) {
      for (let q = 0; q < 4; q++) {
        const arc0 = q * STRIDE
        for (let j = 0; j < A; j++) quad(i, arc0 + j, arc0 + j + 1)
        quad(i, arc0 + ARC, arc0 + ARC + 1)
      }
    }
    for (let side = 0; side < 2; side++) {
      const base = capBase + side * CAP
      const center = base + PER_RING
      for (let j = 0; j < PER_RING; j++) {
        const j1 = (j + 1) % PER_RING
        if (side === 1) index.push(center, base + j, base + j1)
        else index.push(center, base + j1, base + j)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setIndex(index)
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(positions.length), 3).setUsage(THREE.DynamicDrawUsage))
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.frustumCulled = false
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.visible = false
    const ringX = new Float32Array(RINGS)
    let ring = 0
    const writeRing = (x, cy, hy, hz, ry, rz) => {
      ry = Math.min(ry, hy)
      rz = Math.min(rz, hz)
      const base = ring * PER_RING * 3
      let k = base
      for (let q = 0; q < 4; q++) {
        const sy = q === 0 || q === 3 ? 1 : -1
        const sz = q < 2 ? 1 : -1
        const cyq = cy + sy * (hy - ry)
        const czq = sz * (hz - rz)
        for (let j = 0; j <= A; j++) {
          const psi = ((q + j / A) * Math.PI) / 2
          positions[k] = x
          positions[k + 1] = cyq + ry * Math.cos(psi)
          positions[k + 2] = czq + rz * Math.sin(psi)
          k += 3
        }
        k += 6 // flat side: two vertices, filled below
      }
      for (let q = 0; q < 4; q++) {
        const sideFirst = base + (q * STRIDE + ARC) * 3
        const arcLast = sideFirst - 3
        const nextArc = base + ((q + 1) % 4) * STRIDE * 3
        for (let c = 0; c < 3; c++) {
          positions[sideFirst + c] = positions[arcLast + c]
          positions[sideFirst + 3 + c] = positions[nextArc + c]
        }
      }
      ringX[ring] = x
      ring++
    }
    const lerp = (a, b, s) => a + (b - a) * s
    return {
      mesh,
      // p: { xL, L, slope, cyL, hL, hR, HZ, bev, m, r, hy0, tremble(u) → local dy }
      update(p) {
        const { xL, L, slope, cyL, hL, hR, HZ, bev, m, r, hy0 } = p
        const hz0 = r
        const e = lerp(hy0, bev, m)
        const xa = xL + e
        const xb = xL + L - e
        const hsAt = (x) => lerp(hL, hR, Math.min(1, Math.max(0, (x - xL) / L)))
        const cyAt = (x) => cyL + slope * (x - xL)
        ring = 0
        const endRing = (x, c) => writeRing(x, cyAt(x), lerp(hy0 * c, hsAt(x), m), lerp(hz0 * c, HZ - bev + bev * c, m), lerp(r * c, bev, m), lerp(r * c, bev * c, m))
        for (let k = ENDS; k >= 1; k--) {
          const phi = ((k / ENDS) * Math.PI) / 2
          endRing(xa - e * Math.sin(phi), Math.cos(phi))
        }
        for (let i = 0; i <= BODY; i++) {
          const u = i / BODY
          const x = xa + (xb - xa) * u
          const dy = p.tremble ? p.tremble(u) : 0
          writeRing(x, cyAt(x) + dy, lerp(hy0, hsAt(x), m), lerp(hz0, HZ, m), lerp(r, bev, m), lerp(r, bev, m))
        }
        for (let k = 1; k <= ENDS; k++) {
          const phi = ((k / ENDS) * Math.PI) / 2
          endRing(xb + e * Math.sin(phi), Math.cos(phi))
        }
        for (let side = 0; side < 2; side++) {
          const tip = side === 0 ? 0 : RINGS - 1
          const src = tip * PER_RING * 3
          const dst = (capBase + side * CAP) * 3
          positions.copyWithin(dst, src, src + PER_RING * 3)
          const c = dst + PER_RING * 3
          positions[c] = ringX[tip]
          positions[c + 1] = cyAt(ringX[tip])
          positions[c + 2] = 0
        }
        geometry.attributes.position.needsUpdate = true
        geometry.computeVertexNormals()
        mesh.visible = true
      },
    }
  }

  // ------------------------------------------------------------------------------------------
  // Band-phase helpers (loops and the coil as point lists for the shared ElasticBand props)
  // ------------------------------------------------------------------------------------------
  function resample(THREE, points, count, closed) {
    const pts = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2])))
    const segs = closed ? pts.length : pts.length - 1
    const lengths = [0]
    for (let i = 0; i < segs; i++) lengths.push(lengths[i] + pts[i].distanceTo(pts[(i + 1) % pts.length]))
    const total = lengths[segs]
    const n = closed ? count : count - 1
    const out = []
    let seg = 0
    for (let j = 0; j < count; j++) {
      const s = (j / n) * total
      while (seg < segs - 1 && lengths[seg + 1] < s) seg++
      const f = (s - lengths[seg]) / Math.max(1e-9, lengths[seg + 1] - lengths[seg])
      out.push(pts[seg].clone().lerp(pts[(seg + 1) % pts.length], Math.min(1, Math.max(0, f))))
    }
    return out
  }
  // Stadium centreline (straight half-length aS, U-turn radius b) in the (dir, up) plane: `count`
  // points from the right U-turn's bottom, counter-clockwise (toward +up first).
  function stadium(center, dir, up, aS, b, count, turn) {
    const straight = count / 2 - turn
    const out = []
    const at = (x, y) => center.clone().addScaledVector(dir, x).addScaledVector(up, y)
    for (let j = 0; j < turn; j++) {
      const phi = -Math.PI / 2 + (Math.PI * (j + 0.5)) / turn
      out.push(at(aS + b * Math.cos(phi), b * Math.sin(phi)))
    }
    for (let j = 0; j < straight; j++) out.push(at(aS - (2 * aS * (j + 0.5)) / straight, b))
    for (let j = 0; j < turn; j++) {
      const phi = Math.PI / 2 + (Math.PI * (j + 0.5)) / turn
      out.push(at(-aS + b * Math.cos(phi), b * Math.sin(phi)))
    }
    for (let j = 0; j < straight; j++) out.push(at(-aS + (2 * aS * (j + 0.5)) / straight, -b))
    return out
  }
  // Re-order a closed loop so index 0 sits where the stadium's index 0 sits, winding the same way
  // (the loop's `side` edge becomes the stadium's top strand).
  function alignLoop(loop, center, dir, side, turn) {
    const n = loop.length
    let sign = 0
    for (let i = 0; i < n; i++) {
      const a = loop[i].clone().sub(center)
      const b = loop[(i + 1) % n].clone().sub(center)
      sign += a.dot(dir) * b.dot(side) - a.dot(side) * b.dot(dir)
    }
    const ordered = sign >= 0 ? loop : loop.slice().reverse()
    let best = 0
    let bestValue = -Infinity
    ordered.forEach((p, i) => {
      const v = p.clone().sub(center).dot(dir)
      if (v > bestValue) {
        bestValue = v
        best = i
      }
    })
    const start = (best - Math.floor(turn / 2) + n) % n
    return ordered.slice(start).concat(ordered.slice(0, start))
  }

  // C1 Hermite keys in world3d's conventions: [tx, ty, tz, yaw, pitch, ln dist, fov, roll, sx, sy]
  function hermiteTrack(keys) {
    keys.forEach((key, i) => {
      const prev = keys[i - 1]
      const next = keys[i + 1]
      key.tangent = key.values.map((value, c) =>
        !prev || !next || key.flow === 0 ? 0 : (key.flow * (next.values[c] - prev.values[c])) / (next.t - prev.t),
      )
    })
    return (t) => {
      if (t <= keys[0].t) return keys[0].values.slice()
      if (t >= keys[keys.length - 1].t) return keys[keys.length - 1].values.slice()
      let i = 0
      while (i < keys.length - 2 && t >= keys[i + 1].t) i++
      const a = keys[i]
      const b = keys[i + 1]
      const h = b.t - a.t
      const s = (t - a.t) / h
      if (b.ease) {
        const e = b.ease(s)
        return a.values.map((value, c) => value + (b.values[c] - value) * e)
      }
      const s2 = s * s
      const s3 = s2 * s
      return a.values.map((value, c) => (2 * s3 - 3 * s2 + 1) * value + (s3 - 2 * s2 + s) * h * a.tangent[c] + (-2 * s3 + 3 * s2) * b.values[c] + (s3 - s2) * h * b.tangent[c])
    }
  }

  SC.scene({
    id: 's5-mark',
    start: 21.8,
    end: 30.0,
    z: 50,
    build(root, api) {
      const THREE = window.THREE
      const group = SC3D.sceneGroup(root, 's5')
      const L = SC3D.layout
      const S = L.lockup.scale
      const M = SC3D.materials
      const V = (x, y, z) => new THREE.Vector3(x, y, z)

      // ---- Lockup (real geometry: final slabs with the LED + the 13 wordmark glyphs)
      const slabMaterial = M.violetSatin.clone()
      const letterMaterial = M.pearlSatin.clone()
      const lockup = SC3D.makeLockup({ scale: S, material: slabMaterial, letterMaterial })
      lockup.group.position.copy(L.lockup.position)
      group.add(lockup.group)
      const mark = lockup.mark
      const extraT = lockup.letters[5].mesh
      const tMaterial = M.violetGloss.clone()
      extraT.material = tMaterial
      const snapshot = (m) => ({ color: m.color.clone(), roughness: m.roughness, clearcoat: m.clearcoat, clearcoatRoughness: m.clearcoatRoughness, env: m.envMapIntensity, emissive: m.emissive ? m.emissive.clone().multiplyScalar(m.emissiveIntensity) : null })
      const gloss = snapshot(M.violetGloss)
      const satin = snapshot(M.violetSatin)
      const pearl = snapshot(letterMaterial)

      // ---- Morph bars, one per slab (local frame = the slab's own centring frame)
      const markWorld = L.lockup.position.clone().add(mark.group.position)
      const bars = {}
      for (const key of ['top', 'middle', 'bottom']) {
        const spec = SLABS[key]
        const box = spec.box
        const cx = (box.x0 + box.x1) / 2
        const cy = (box.y0 + box.y1) / 2
        const X = (x) => (x - cx) * S
        const Y = (y) => (cy - y) * S
        const yTopL = Y(spec.top[0])
        const yTopR = Y(spec.top[1])
        const yBotL = Y(spec.bot[0])
        const yBotR = Y(spec.bot[1])
        const xL = X(spec.x0)
        const xR = X(spec.x1)
        const material = M.violetGloss.clone()
        const morph = makeMorphBar(THREE, material, `s5-morph-${key}`)
        group.add(morph.mesh)
        bars[key] = {
          key,
          morph,
          material,
          slab: mark[key],
          center: markWorld.clone().add(mark[key].userData.home.position),
          profile: {
            xL,
            slabL: xR - xL,
            cyL: (yTopL + yBotL) / 2,
            slope: ((yTopR + yBotR) / 2 - (yTopL + yBotL) / 2) / (xR - xL),
            hL: (yTopL - yBotL) / 2,
            hR: (yTopR - yBotR) / 2,
            HZ: (MARK_DEPTH / 2 + MARK_BEVEL) * S,
            bev: MARK_BEVEL * S,
          },
        }
      }
      // Choreography. hover: taut-line centre (world) + yaw; L = tip-to-tip length; r = strand
      // radius; bHover = strand half-separation of a stretched loop in r (null = single strand).
      Object.assign(bars.top, {
        source: 'phoneBand', lift: CUE.phoneLift, taut: CUE.phoneTaut, fly: CUE.flyTop, click: CUE.clickTop,
        hover: V(4.95, 1.42, 0.85), hoverYaw: -0.35, drift: V(-0.25, 0.3, 0.2), hoverL: 1.16, dockL: 1.06, r: 0.0095, bHover: 1.7,
        launch: V(-0.45, 0.45, 0.18), approach: V(0.5, 0.06, 0.32), roll: 0.35, dockRoll: 0.3, seed: 3,
      })
      Object.assign(bars.middle, {
        source: 'ring', lift: CUE.ringLift, taut: CUE.ringTaut, fly: CUE.flyMiddle, click: CUE.clickMiddle,
        hover: V(3.5, 1.12, 1.02), hoverYaw: 0.12, drift: V(0.0, 0.3, 0.15), hoverL: 1.06, dockL: 0.98, r: 0.009, bHover: 1.7,
        launch: V(-0.1, 0.6, 0.25), approach: V(0.5, 0.04, 0.35), roll: -0.3, dockRoll: -0.26, seed: 5,
      })
      Object.assign(bars.bottom, {
        source: 'band', lift: CUE.coilLift, taut: CUE.coilTaut, fly: CUE.flyBottom, click: CUE.lock,
        hover: V(3.42, 0.86, 1.12), hoverYaw: -0.12, drift: V(0.0, 0.3, 0.1), hoverL: 1.0, dockL: 0.9, r: 0.0105, bHover: null,
        launch: V(-0.05, 0.65, 0.25), approach: V(0.46, 0.0, 0.35), roll: 0.4, dockRoll: 0.32, seed: 7,
      })
      for (const bar of Object.values(bars)) {
        bar.swap = bar.fly[0] + 0.1
        bar.snap = bar.click - SNAP
        bar.hoverQ = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), bar.hoverYaw)
          .multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), -Math.atan(bar.profile.slope)))
      }

      // ---- Floor reflection: mirrored clones of the lockup under an invisible glossy floor at the
      // mark's foot, fading with depth below the floor (alpha by world y in the shader).
      const mirrorY = L.lockup.position.y - 16 * S - 0.004
      const reflectUniforms = { uScMirrorY: { value: mirrorY }, uScFade: { value: 0.19 }, uScStrength: { value: 0 }, uScClipY: { value: -1e3 } }
      // Shader decoration (world-y varying): `clip` hides everything below uScClipY (the letters
      // rise out of the baseline); `reflect` fades with depth below the floor and mirrors the clip.
      const baseCompile = THREE.MeshStandardMaterial.prototype.onBeforeCompile
      const decorate = (material, { clip = false, reflect = false }) => {
        material.onBeforeCompile = function (shader, renderer) {
          baseCompile.call(this, shader, renderer)
          Object.assign(shader.uniforms, reflectUniforms)
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying float vScWorldY;')
            .replace('#include <project_vertex>', '#include <project_vertex>\nvScWorldY = (modelMatrix * vec4(transformed, 1.0)).y;')
          const discard = clip ? 'if (vScWorldY < uScClipY) discard;' : ''
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying float vScWorldY;\nuniform float uScMirrorY;\nuniform float uScFade;\nuniform float uScStrength;\nuniform float uScClipY;')
            .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${discard}`)
            .replace('#include <opaque_fragment>', reflect
              ? '#include <opaque_fragment>\n{ float scD = clamp((uScMirrorY - vScWorldY) / uScFade, 0.0, 1.0); gl_FragColor.a *= uScStrength * (1.0 - scD) * (1.0 - scD); }'
              : '#include <opaque_fragment>')
        }
        material.customProgramCacheKey = () => `sc-s5-${clip ? 'clip' : ''}-${reflect ? 'reflect' : ''}`
        return material
      }
      const reflective = (source) => {
        const material = source.clone()
        material.transparent = true
        material.side = THREE.FrontSide
        return decorate(material, { reflect: true })
      }
      // letters rise out of the baseline: clipped, double-sided so the cut reads solid
      letterMaterial.side = THREE.DoubleSide
      decorate(letterMaterial, { clip: true })
      const mirror = new THREE.Group()
      mirror.name = 's5-mirror'
      mirror.position.y = 2 * mirrorY
      mirror.scale.y = -1
      group.add(mirror)
      const mLockup = new THREE.Group()
      mirror.add(mLockup)
      const mMark = new THREE.Group()
      mLockup.add(mMark)
      const reflSlab = reflective(slabMaterial)
      const mirrorPairs = []
      for (const key of ['top', 'middle', 'bottom']) {
        const clone = new THREE.Mesh(mark[key].geometry, reflSlab)
        clone.renderOrder = 3
        mMark.add(clone)
        mirrorPairs.push([mark[key], clone])
      }
      // the LED's glow, reflected (child of the bottom slab's clone)
      const mLedGlow = SC3D.makeGlow({ color: '#8C84FF', size: mark.ledGlow.scale.x, opacity: 0 })
      mLedGlow.position.copy(mark.ledGlow.position)
      const bottomClone = mirrorPairs[2][1]
      bottomClone.add(mLedGlow)

      // ---- Copy (2D overlay, Inter only)
      const tagline = api.el('div', {
        text: 'Africa-first cloud.',
        style: { position: 'absolute', left: '0', width: '1920px', top: '628px', textAlign: 'center', font: '500 56px Inter', letterSpacing: '-0.012em', lineHeight: '68px', color: '#F4F3FF', opacity: '0', whiteSpace: 'nowrap' },
      }, root)
      const url = api.el('div', {
        text: 'cloud.strettch.com',
        style: { position: 'absolute', left: '0', width: '1920px', top: '712px', textAlign: 'center', font: '600 44px Inter', letterSpacing: '0.005em', lineHeight: '54px', color: '#A7A1FF', opacity: '0', whiteSpace: 'nowrap' },
      }, root)

      // ---- Camera keys (applied as nudges on the world track; blends in over 22.0–22.8)
      const k = (t, target, yaw, pitch, dist, fov, roll, sx, sy, flow = 1, ease) => ({ t, values: [...target, yaw, pitch, Math.log(dist), fov, roll, sx, sy], flow, ease })
      const w22 = SC3D.cameraAt(22.0)
      const reveal = SC.ease.cubicBezier(0.45, 0, 0.18, 1)
      const cameraTrack = hermiteTrack([
        k(22.0, w22.subject.toArray(), w22.yaw, w22.pitch, w22.dist, w22.fov, w22.roll, w22.sx, w22.sy, 0),
        k(22.75, [4.2, 0.92, 0.82], -10, 9.5, 5.3, 28, 0, 0, -0.04, 0.6),
        k(23.0, [4.1, 1.1, 0.86], -11.3, 8.6, 5.4, 28, 0, 0, -0.04, 0),
        k(23.4, [3.3, 2.12, 0.62], -13, 6.6, 5.3, 27.6, 0, -0.08, 0, 0.9),
        k(23.8, [2.26, 2.96, 0.3], -15, 5, 3.72, 27, 0, -0.2, 0.02, 0),
        k(24.1, [2.25, 2.96, 0.3], -14.2, 4.6, 3.6, 27, 0, -0.2, 0.02, 0),
        k(24.78, [3.49, 3.0, 0.3], -3.2, 1.2, 7.12, 26, 0, 0, 0.215, 0.45, reveal),
        k(27.0, [3.55, 3.0, 0.3], 0, 0, 6.9, 26, 0, 0, 0.23, 0),
        k(30.0, [3.55, 3.0, 0.3], 0, 0, 6.9, 26, 0, 0, 0.23, 0),
      ])

      // Warm up the reflection/morph programs now (a first-frame compile would blow the budget).
      try {
        for (const bar of Object.values(bars)) bar.morph.update({ ...bar.profile, L: bar.profile.slabL, m: 1, r: 0.01, hy0: 0.01 })
        SC3D.renderer.compile(group, SC3D.camera, SC3D.scene)
      } catch (error) {
        // optimisation only
      }
      for (const bar of Object.values(bars)) bar.morph.mesh.visible = false

      const state = {
        THREE, lockup, mark, extraT, tMaterial, gloss, satin, pearl, bars,
        ADV: SC_LOGO.letters[6].box.x0 - SC_LOGO.letters[5].box.x0,
        tBox: SC_LOGO.letters[5].box,
        cBox: SC_LOGO.letters[6].box,
        wordOrder: [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12],
        mirror, mLockup, mMark, mirrorPairs, reflectUniforms, mLedGlow, tagline, url, cameraTrack,
        phoneEuler: new THREE.Euler(-0.22, -0.35, 0),
      }
      Object.defineProperty(root, '__s5', { value: state }) // debug handle for probes
      return state
    },

    render(t, s, api) {
      if (t < 22.0) {
        s.lockup.group.visible = false
        s.mirror.visible = false
        for (const bar of Object.values(s.bars)) bar.morph.mesh.visible = false
        api.setStyle(s.tagline, { opacity: '0' })
        api.setStyle(s.url, { opacity: '0' })
        return
      }
      const { THREE } = s
      const P = SC3D.props
      const L = SC3D.layout
      const S = L.lockup.scale
      const V = (x, y, z) => new THREE.Vector3(x, y, z)

      applyCamera(t, s, api)

      // ---- Sources. The phone holds its s4 end pose and recoils when its band pops off.
      SC3D.claim('phone')
      const phone = P.phone
      phone.group.visible = t < 24.3
      phone.group.position.copy(L.phone.position)
      const pop = t >= CUE.phonePop ? Math.exp(-(t - CUE.phonePop) / 0.16) * Math.sin(2 * Math.PI * 5.5 * (t - CUE.phonePop)) : 0
      phone.group.rotation.set(s.phoneEuler.x - 0.035 * pop, s.phoneEuler.y, 0.02 * pop)
      phone.group.position.y -= 0.012 * pop
      phone.group.updateMatrixWorld(true)
      // the map sinks into darkness (and flat into the floor: no coast glints in the lockup's
      // horizon) as the camera leaves it; the pins go once they're out of frame
      const dim = 1 - 0.7 * api.tween(t, 23.4, 24.6, 0, 1, 'inOutCubic')
      const flatten = 1 - 0.98 * api.tween(t, 23.9, 24.6, 0, 1, 'inOutCubic')
      for (const slab of [P.continent, P.rwanda]) {
        for (const material of slab.material) material.color.multiplyScalar(dim)
        slab.scale.y *= flatten
      }
      P.rwanda.visible = t < 24.6
      P.kigaliPin.visible = t < 24.0
      P.capeTownPin.visible = t < 24.0

      // ---- Bands → bars → slabs
      for (const bar of Object.values(s.bars)) renderBar(t, s, api, bar)

      // ---- Lockup
      const { mark } = s
      s.lockup.group.visible = t >= CUE.clickTop
      s.lockup.group.position.copy(L.lockup.position)
      mark.group.position.set((17 - 93) * S, 0, 0)
      mark.group.scale.setScalar(1)
      if (t >= CUE.lock) {
        // the lock: the whole mark seats with a short clamp
        const u = t - CUE.lock
        const clampPulse = Math.exp(-u / 0.07) * Math.sin(2 * Math.PI * 7 * u)
        mark.group.position.z -= 0.014 * clampPulse
        mark.group.scale.setScalar(1 - 0.012 * clampPulse)
      }
      for (const bar of Object.values(s.bars)) {
        const slab = bar.slab
        slab.visible = t >= bar.click
        slab.position.copy(slab.userData.home.position)
        slab.quaternion.copy(slab.userData.home.quaternion)
        if (t >= bar.click) {
          // mechanical click: momentum carries the slab a hair into its slot, stiff spring back
          const u = t - bar.click
          slab.position.x -= 0.0045 * Math.exp(-u / 0.03) * Math.sin(2 * Math.PI * 13 * u + 0.6) / Math.sin(0.6)
        }
      }
      s.lockup.group.updateMatrixWorld(true)
      // LED lights at the lock
      const ledOn = api.keyframes(t, [[CUE.lock, 0], [CUE.lock + 0.035, 1.35, 'outQuad'], [CUE.lock + 0.3, 1, 'inOutQuad']])
      mark.led.material.color.set('#9C95FF').multiplyScalar(0.35 + 2.4 * ledOn)
      mark.ledGlow.material.opacity = 0.85 * ledOn
      if (t >= CUE.lock && t < CUE.lock + 0.6) {
        const u = t - CUE.lock
        const ledWorld = mark.led.getWorldPosition(new THREE.Vector3())
        SC3D.flash(ledWorld.add(V(0.05, 0.06, 0.12)), { intensity: 1.05 * Math.exp(-u / 0.11), size: 1.5 })
      }
      for (const bar of [s.bars.top, s.bars.middle]) {
        if (t < bar.click || t > bar.click + 0.3) continue
        const u = t - bar.click
        const pr = bar.profile
        const tip = bar.center.clone().add(V(pr.xL + pr.slabL, pr.cyL + pr.slope * pr.slabL, 0.07))
        SC3D.flash(tip, { intensity: 0.4 * Math.exp(-u / 0.06), size: 0.34, light: false })
      }

      // ---- Wordmark + the t callback
      renderWordmark(t, s, api)

      // ---- Reflection mirrors the lockup
      const reflect = api.tween(t, 24.15, 25.6, 0, 1, 'inOutCubic')
      s.reflectUniforms.uScStrength.value = 0.4 * reflect
      s.mirror.visible = reflect > 0.001 && s.lockup.group.visible
      if (s.mirror.visible) {
        s.mLockup.position.copy(s.lockup.group.position)
        s.mMark.position.copy(mark.group.position)
        s.mMark.scale.copy(mark.group.scale)
        for (const [real, clone] of s.mirrorPairs) {
          clone.position.copy(real.position)
          clone.quaternion.copy(real.quaternion)
          clone.scale.copy(real.scale)
          clone.visible = real.visible
        }
        s.mLedGlow.material.opacity = mark.ledGlow.material.opacity * 0.5 * reflect
      }

      // ---- Light resolves on the lockup
      const resolve = api.tween(t, 25.2, 26.8, 0, 1, 'inOutCubic')
      SC3D.light({ key: 1 + 0.06 * resolve, rim: 1 - 0.12 * resolve, fill: 1 + 0.25 * resolve })

      // ---- Copy
      const tagIn = api.tween(t, CUE.copyIn[0], CUE.copyIn[1] - 0.05, 0, 1, 'outCubic')
      const urlIn = api.tween(t, CUE.copyIn[0] + 0.1, CUE.copyIn[1], 0, 1, 'outCubic')
      api.setStyle(s.tagline, { opacity: String(api.round(tagIn, 3)), transform: `translateY(${api.round((1 - tagIn) * 14, 2)}px)` })
      api.setStyle(s.url, { opacity: String(api.round(urlIn, 3)), transform: `translateY(${api.round((1 - urlIn) * 12, 2)}px)` })
    },
  })

  // ------------------------------------------------------------------------------------------
  // Camera: world track until 22.0, blended into this scene's keys over 22.0–22.8, applied as
  // nudges that reproduce the wanted orbit exactly (the world's breathing is replaced by ours).
  // ------------------------------------------------------------------------------------------
  function applyCamera(t, s, api) {
    const THREE = s.THREE
    const DEG = Math.PI / 180
    const base = SC3D.cameraAt(t)
    const mine = s.cameraTrack(t)
    const w = api.tween(t, 22.0, 22.8, 0, 1, 'smooth')
    const world = [base.subject.x, base.subject.y, base.subject.z, base.yaw, base.pitch, Math.log(base.dist), base.fov, base.roll, base.sx, base.sy]
    let [tx, ty, tz, yaw, pitch, logDist, fov, roll, sx, sy] = world.map((value, i) => value + (mine[i] - value) * w)
    const breath = api.keyframes(t, [[22.0, 0], [22.6, 0.7], [24.2, 0.5], [25.6, 0.25], [26.6, 0]]) * w
    yaw += breath * 0.3 * api.noise(t * 0.5, 31)
    pitch += breath * 0.18 * api.noise(t * 0.42, 32)
    roll += breath * 0.12 * api.noise(t * 0.35, 33)
    const dist = Math.exp(logDist)
    const cp = Math.cos(pitch * DEG)
    const offset = new THREE.Vector3(Math.sin(yaw * DEG) * cp, Math.sin(pitch * DEG), Math.cos(yaw * DEG) * cp)
    const forward = offset.negate().normalize()
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
    const up = new THREE.Vector3().crossVectors(right, forward).normalize()
    up.applyAxisAngle(forward, -roll * DEG)
    right.applyAxisAngle(forward, -roll * DEG)
    const halfHeight = dist * Math.tan((fov * DEG) / 2)
    const aspect = SC.WIDTH / SC.HEIGHT
    // the world applies its own sx/sy truck; compensate so ours lands
    const target = new THREE.Vector3(tx, ty, tz)
      .addScaledVector(right, -(sx - base.sx) * halfHeight * aspect)
      .addScaledVector(up, -(sy - base.sy) * halfHeight)
    SC3D.nudgeCamera({
      target: [target.x - base.subject.x, target.y - base.subject.y, target.z - base.subject.z],
      yaw: yaw - base.yaw,
      pitch: pitch - base.pitch,
      roll: roll - base.roll,
      fov: fov - base.fov,
      dist: dist / base.dist,
    })
  }

  // ------------------------------------------------------------------------------------------
  // One band → taut line → bar → slab
  // ------------------------------------------------------------------------------------------
  const FLY_EASE = SC.ease.cubicBezier(0.36, 0, 0.24, 1.03)
  const X_AXIS = new window.THREE.Vector3(1, 0, 0)
  function linePose(t, s, api, bar) {
    // → { P: world position of the slab-local origin, Q, L: tip-to-tip length }
    const THREE = s.THREE
    const pr = bar.profile
    const localCenter = (length) => new THREE.Vector3(pr.xL + length / 2, pr.cyL + (pr.slope * length) / 2, 0)
    const hoverCenter = (time) => bar.hover.clone().addScaledVector(bar.drift, Math.max(0, time - bar.taut))
    let center
    let Q
    let L
    if (t < bar.fly[0]) {
      center = hoverCenter(t)
      Q = bar.hoverQ.clone()
      L = bar.hoverL
    } else {
      const u = api.progress(t, bar.fly[0], bar.fly[1])
      const e = FLY_EASE(u)
      const c0 = hoverCenter(bar.fly[0])
      const c3 = bar.center.clone().add(localCenter(bar.dockL).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(X_AXIS, bar.dockRoll)))
      const c1 = c0.clone().add(bar.launch)
      const c2 = c3.clone().add(bar.approach)
      const k = 1 - e
      center = c0.clone().multiplyScalar(k * k * k)
        .addScaledVector(c1, 3 * k * k * e)
        .addScaledVector(c2, 3 * k * e * e)
        .addScaledVector(c3, e * e * e)
      const turn = api.ease.inOutCubic(api.clamp(u * 1.15))
      // docks pre-rolled about its long axis (unwound by the snap: the bevels sweep the key light)
      Q = bar.hoverQ.clone().slerp(new THREE.Quaternion().setFromAxisAngle(X_AXIS, bar.dockRoll), turn)
      Q.multiply(new THREE.Quaternion().setFromAxisAngle(X_AXIS, Math.sin(Math.PI * api.clamp(u * 1.1)) * bar.roll))
      L = bar.hoverL + (bar.dockL - bar.hoverL) * e
    }
    // P = the slab-local origin; the left tip (local xL) stays put through the snap
    const P = center.clone().sub(localCenter(L).applyQuaternion(Q))
    if (t >= bar.snap) {
      // the snap: a breath of extra tension, then the retraction to the slab length (hard stop)
      // while the roll unwinds into the slab's exact orientation
      const u = api.progress(t, bar.snap, bar.click)
      const tension = u < 0.35 ? Math.sin((Math.PI * u) / 0.35) * 0.035 : 0
      const k = Math.pow(api.clamp((u - 0.18) / 0.82), 3)
      L = bar.dockL * (1 + tension) - (bar.dockL - pr.slabL) * k
      Q = new THREE.Quaternion().setFromAxisAngle(X_AXIS, bar.dockRoll * (1 - Math.pow(u, 2.2)))
    }
    return { P, Q, L }
  }

  function trembleAmp(t, bar) {
    if (t < bar.taut) return 0
    const pluck = 0.022 * Math.exp(-(t - bar.taut) / 0.16)
    const sustain = t >= bar.fly[0] && t < bar.fly[1] ? 0.0014 : 0.0028
    const release = t >= bar.snap ? Math.max(0, 1 - (t - bar.snap) / (SNAP * 0.5)) : 1
    return (pluck + sustain) * release
  }
  function trembleShape(u, t, bar, amp) {
    const f = 11 + bar.seed * 0.4
    return amp * (Math.sin(Math.PI * u) * Math.sin(2 * Math.PI * f * t + bar.seed) + 0.35 * Math.sin(2 * Math.PI * u) * Math.sin(2 * Math.PI * f * 1.63 * t + bar.seed * 2.1))
  }

  function renderBar(t, s, api, bar) {
    const THREE = s.THREE
    const P = SC3D.props
    const band = P[bar.source]
    const pr = bar.profile
    const morph = bar.morph
    morph.mesh.visible = false
    if (t >= bar.click) return // the real slab has taken over
    if (t < bar.lift) {
      // canonical rest pose (continuity with s2/s3/s4)
      const pose = bar.source === 'band' ? SC3D.poses.kigaliCoil(t) : bar.source === 'ring' ? SC3D.poses.rwandaRing(t) : SC3D.poses.phoneBand(t)
      band.update(pose.points, pose.radius)
      return
    }
    const line = linePose(t, s, api, bar)
    const amp = trembleAmp(t, bar)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(line.Q)
    const tip0 = line.P.clone().add(new THREE.Vector3(pr.xL, pr.cyL, 0).applyQuaternion(line.Q))
    const tip1 = line.P.clone().add(new THREE.Vector3(pr.xL + line.L, pr.cyL + pr.slope * line.L, 0).applyQuaternion(line.Q))
    const dir = tip1.clone().sub(tip0).normalize()
    const halfLength = tip0.distanceTo(tip1) / 2
    const center = tip0.clone().add(tip1).multiplyScalar(0.5)
    const r = bar.r
    // strand half-separation: a visible double strand while hovering, merged by the swap
    const bNow = bar.bHover === null ? 0 : r * (bar.bHover + (0.5 - bar.bHover) * api.tween(t, bar.fly[0] - 0.02, bar.swap, 0, 1, 'inOutQuad'))

    if (t < bar.swap) {
      // ---- band phase: lift, pull taut, hover/launch as a trembling line (the shared prop)
      if (bar.source === 'band') {
        const coil = SC3D.poses.kigaliCoil(t)
        const src = resample(THREE, coil.points, 64, false)
        const a = tip0.clone().addScaledVector(dir, r)
        const b = tip1.clone().addScaledVector(dir, -r)
        const s01 = api.progress(t, bar.lift, bar.taut)
        const points = src.map((p, i) => {
          const u = i / (src.length - 1)
          const e = api.ease.outCubic(api.clamp((s01 - (1 - u) * 0.45) / 0.55))
          const target = a.clone().lerp(b, u).addScaledVector(up, trembleShape(u, t, bar, amp))
          const out = p.clone().lerp(target, e)
          out.y += Math.sin(Math.PI * e) * 0.08
          return out
        })
        band.update(points, coil.radius + (r - coil.radius) * api.ease.inOutQuad(s01))
        return
      }
      let source
      let sourceRadius
      if (bar.source === 'phoneBand') {
        const pose = SC3D.poses.phoneBand(t)
        const phoneUp = new THREE.Vector3(0, 1, 0).applyQuaternion(P.phone.group.quaternion)
        const slide = 0.72 * api.ease.inQuad(api.progress(t, bar.lift, CUE.phonePop))
        source = pose.points.map((p) => p.clone().addScaledVector(phoneUp, slide))
        sourceRadius = pose.radius
        if (t < CUE.phonePop) {
          band.update(source, sourceRadius)
          return
        }
      } else {
        const pose = SC3D.poses.rwandaRing(t)
        source = pose.points
        sourceRadius = pose.radius
      }
      const N = 72
      const TURN = 8
      const loop = resample(THREE, source, N, true)
      const loopCenter = loop.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / N)
      const ordered = alignLoop(loop, loopCenter, dir, new THREE.Vector3(0, 0, 1), TURN)
      const target = stadium(center, dir, up, Math.max(0.001, halfLength - r - bNow), Math.max(bNow, 0.0001), N, TURN)
      const start = bar.source === 'phoneBand' ? CUE.phonePop : bar.lift
      const s01 = api.progress(t, start, bar.taut)
      // pulled taut with an elastic overshoot, then it trembles
      const e = api.ease.spring({ stiffness: 260, damping: 19, duration: bar.taut - start })(s01)
      const lift = bar.source === 'ring' ? 0.12 : 0.06
      const points = ordered.map((p, i) => {
        const tg = target[i]
        const u = api.clamp(tg.clone().sub(center).dot(dir) / (2 * halfLength) + 0.5)
        tg.addScaledVector(up, trembleShape(u, t, bar, amp))
        const out = p.clone().lerp(tg, Math.min(1.08, e))
        out.y += Math.sin(Math.PI * api.clamp(e)) * lift
        return out
      })
      band.update(points, sourceRadius + (r - sourceRadius) * api.clamp(e), { closed: true })
      return
    }

    // ---- morph phase: the taut bar flies in, docks, and snaps into the slab
    const m = t < bar.snap ? 0 : Math.pow(api.progress(t, bar.snap, bar.click), 1.6)
    morph.mesh.position.copy(line.P)
    morph.mesh.quaternion.copy(line.Q)
    morph.update({
      ...pr,
      L: line.L,
      m,
      r,
      hy0: bar.bHover === null ? r : bNow + r,
      tremble: amp > 0 ? (u) => trembleShape(u, t, bar, amp) : null,
    })
    const mat = bar.material
    mat.color.copy(s.gloss.color).lerp(s.satin.color, m)
    mat.roughness = s.gloss.roughness + (s.satin.roughness - s.gloss.roughness) * m
    mat.clearcoat = s.gloss.clearcoat + (s.satin.clearcoat - s.gloss.clearcoat) * m
    mat.clearcoatRoughness = s.gloss.clearcoatRoughness + (s.satin.clearcoatRoughness - s.gloss.clearcoatRoughness) * m
    mat.envMapIntensity = s.gloss.env + (s.satin.env - s.gloss.env) * m
  }

  // ------------------------------------------------------------------------------------------
  // Wordmark ("stretch cloud" stands up) + the t callback
  // ------------------------------------------------------------------------------------------
  const RISE = SC.ease.spring({ stiffness: 210, damping: 23, duration: 0.4 })
  const RISE_DEPTH = 0.34 // world u below the baseline each letter starts (fully clipped)
  const SHOVE = SC.ease.spring({ stiffness: 320, damping: 15, duration: 0.4 })
  const GAP = 6.6 // logo units "ch cloud" steps aside before the t lands (the t's advance is 9.23)
  function renderWordmark(t, s, api) {
    const S = SC3D.layout.lockup.scale
    const { lockup, ADV, tBox, cBox } = s
    const gap = GAP * api.ease.snappy(api.progress(t, CUE.gapOpen[0], CUE.gapOpen[1]))
    // letters rise out of the baseline (clip plane just under the glyphs' round overshoots)
    s.reflectUniforms.uScClipY.value = t < CUE.wordRise[1] + 0.2 ? SC3D.layout.lockup.position.y + (16 - 22.45) * S - 0.009 : -1e3
    // the t: falls from above the frame (stretched with speed), squashes on landing
    const fallT = CUE.tLand - CUE.tFall
    const Y0 = 70 // start height of the t's foot above the baseline, logo units (above frame)
    const vEnd = 1.62 * (Y0 / fallT)
    const v0 = 2 * (Y0 / fallT) - vEnd
    const acc = (vEnd - v0) / fallT
    let tY = 0
    let tSX
    let tSY
    let tLeft
    if (t < CUE.tLand) {
      const u = Math.max(0, t - CUE.tFall)
      tY = Y0 - (v0 * u + 0.5 * acc * u * u)
      const speed = (v0 + acc * u) / vEnd
      tSX = 1 - 0.3 * speed
      tSY = 1 + 0.16 * speed
      tLeft = tBox.x0 - 0.45 + 0.1 * speed
    } else {
      const land = CUE.tLand
      tSX = api.keyframes(t, [[land, 0.7], [land + 0.033, 1.24, 'outQuad'], [land + 0.12, 0.95, 'inOutQuad'], [land + 0.21, 1.02, 'inOutQuad'], [land + 0.3, 1, 'inOutQuad']])
      tSY = api.keyframes(t, [[land, 1.16], [land + 0.033, 0.75, 'outQuad'], [land + 0.12, 1.06, 'inOutQuad'], [land + 0.21, 0.985, 'inOutQuad'], [land + 0.3, 1, 'inOutQuad']])
      tLeft = api.keyframes(t, [[land, tBox.x0 - 0.35], [land + 0.033, tBox.x0, 'outQuad']])
    }
    const tWidth = (tBox.x1 - tBox.x0) * tSX
    const tRight = tLeft + tWidth
    const tLow = t >= CUE.tLand || tY < 13 // the t's foot is down among the letters
    const spacing = cBox.x0 - tBox.x1
    for (const { mesh, glyph } of lockup.letters) {
      const home = mesh.userData.home.position
      mesh.position.copy(home)
      mesh.rotation.set(0, 0, 0)
      mesh.scale.set(1, 1, 1)
      if (glyph === 5) {
        mesh.visible = t >= CUE.tFall
        mesh.position.x = home.x + (tLeft + tWidth / 2 - (tBox.x0 + tBox.x1) / 2) * S
        mesh.position.y = home.y + Math.max(0, tY) * S
        mesh.scale.set(tSX, tSY, 1 + 0.5 * (1 - tSX))
        continue
      }
      const order = s.wordOrder.indexOf(glyph)
      const start = CUE.wordRise[0] + order * 0.02
      mesh.visible = t >= start
      const rise = RISE(api.progress(t, start, start + 0.4))
      mesh.position.y = home.y - RISE_DEPTH * (1 - rise)
      mesh.rotation.x = -0.38 * (1 - rise)
      if (glyph >= 6) {
        // "ch cloud": closed up, steps aside, then is shoved home by the landing t (spring)
        const delay = (glyph - 6) * 0.008
        const pushed = t >= CUE.tLand ? GAP + (ADV - GAP) * SHOVE(api.progress(t, CUE.tLand + delay, CUE.tLand + delay + 0.4)) : gap
        const needed = tLow ? tRight + spacing - cBox.x0 + ADV : 0
        mesh.position.x = home.x + (Math.max(pushed, needed) - ADV) * S
      }
    }
    // landing flash at the t's foot
    if (t >= CUE.tLand && t < CUE.tLand + 0.4) {
      lockup.group.updateMatrixWorld(true)
      const foot = s.extraT.getWorldPosition(new s.THREE.Vector3())
      foot.z += 0.08
      foot.y += 0.03
      SC3D.flash(foot, { intensity: 0.55 * Math.exp(-(t - CUE.tLand) / 0.08), size: 0.7 })
    }
    // the t cools from violet gloss to the wordmark's pearl satin
    const k = api.tween(t, CUE.tToPearl[0], CUE.tToPearl[1], 0, 1, 'inOutCubic')
    const mat = s.tMaterial
    mat.color.copy(s.gloss.color).lerp(s.pearl.color, k)
    mat.roughness = s.gloss.roughness + (s.pearl.roughness - s.gloss.roughness) * k
    mat.clearcoat = s.gloss.clearcoat + (s.pearl.clearcoat - s.gloss.clearcoat) * k
    mat.clearcoatRoughness = s.gloss.clearcoatRoughness + (s.pearl.clearcoatRoughness - s.gloss.clearcoatRoughness) * k
    mat.envMapIntensity = s.gloss.env + (s.pearl.env - s.gloss.env) * k
    mat.emissive.copy(s.pearl.emissive).multiplyScalar(k)
    mat.emissiveIntensity = 1
  }
})()
