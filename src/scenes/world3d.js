// =============================================================================================
// world3d.js — the shared 3D world of "The Extra Push" (v3). Look-dev / TD owned.
// This header is the brief for the five scene engineers. Read it before touching 3D.
// =============================================================================================
// Not a scene: it owns the WebGL renderer, studio, light rig, materials, geometry builders,
// shared props and the ONE continuous camera, and draws the 3D frame once per frame after every
// scene has updated (SC.afterRender). Scenes animate 3D objects in their render(t) and put 2D copy
// in their DOM root, which sits above the canvas (z-index 0, inside the stage, so SC.post's shake
// moves it too).
//
// ── RULES ────────────────────────────────────────────────────────────────────────────────────
//  • window.SC3D exists when this file loads; renderer/scene/props/layout exist from SC.init's
//    onInit hook on, i.e. inside every scene's build()/render(). Use SC3D only there.
//  • Frame order: scenes render(t) (by z) → SC3D applies idle poses, camera, rig → draws → RESETS.
//    The reset restores every shared prop (SC3D.props.*) to its rest transform, visibility and
//    material colour/emissive/opacity, and clears every per-frame request. So set what you need
//    EVERY frame from t, never rely on a previous frame, never reparent props (copy transforms).
//  • Your own objects go in SC3D.sceneGroup(root) (root = your scene's DOM root): shown only while
//    your scene is active. Don't add objects to SC3D.scene directly.
//  • Never add/remove lights, toggle castShadow, or change a material's type/maps/defines per frame
//    (shader recompiles cost 100s of ms in SwiftShader). Toggle visible, change colours/opacity.
//  • Budget: ~420 ms per 1080p capture on average today (peaks ~520 on macro/close-ups). Every
//    full-screen layer costs ~140 ms to rasterise in SwiftShader: no big transparent planes, no
//    extra passes. Keep new meshes indexed and modest (< ~10k triangles each).
//
// ── UNITS & AXES ─────────────────────────────────────────────────────────────────────────────
//  1 world unit ("u"). Floor = plane y = 0, +Y up, map north = −Z, east = +X.
//  SC3D.project(lon, lat, y = 0) → Vector3 (sinusoidal, K = 0.25 u per degree, centred 17°E 1°N);
//  SC3D.unproject(x, z) → [lon, lat]. Africa spans x ≈ −8.4…8.4, z ≈ −9.1…9.0.
//  Brand glyphs/slabs are built in logo units (the 186×32 space of SC_LOGO) × a scale.
//
// ── LAYOUT (SC3D.layout) ─────────────────────────────────────────────────────────────────────
//  surfaceY = 0.1               top of the continent / Rwanda slab (stand things on it)
//  letters.center (−9.2,0,3.2)  "stretch" stands on the floor in the dark ocean west of Angola,
//    .right = +X, .scale 0.032  facing +Z (toward the camera), reading west→east. x-height ≈ 0.37 u,
//                               "stretch" ≈ 2.3 u. Pull the "ch" toward +X (toward Africa).
//  kigali ≈ (3.26,0.1,0.74)     pin tips on the surface (SC_GEO.cities)
//  capeTown ≈ (0.30,0.1,8.73)
//  rwanda.center, .outline      centroid / world-space 10m border points (on the surface)
//  phone.position (5.15,0.8,0.75) phone centre, hovering east of Rwanda (Kigali stays out of the
//                               phone shot's copy side)
//  lockup.position (3.55,3,0.3) centre of the final mark + wordmark, facing +Z; .scale 0.02 (≈3.7 u
//                               wide). Floats high so the frontal lockup has only studio behind it.
//
// ── SHARED PROPS (SC3D.props) ────────────────────────────────────────────────────────────────
//  continent  Mesh, Africa (110m coast union, Rwanda cut out). material[0] = flat top
//             (flat-lit, see below), material[1] = bevelled coast walls; aliases userData.top/.edge
//  rwanda     Mesh, the 10m Rwanda slab flush in that hole (same two materials). Lift: position.y
//  kigaliPin  Group, violetGloss pin; origin = needle tip; userData.head / .headTop / .height
//  capeTownPin Group, slateMatte pin
//  band       ElasticBand, the hero violet elastic (s1 letters → carried to Kigali → coil)
//  ring       ElasticBand (closed), the violet ring on Rwanda's border
//  phone      Phone (see makePhone); rest = hidden, idle = shown from 19.3 at layout.phone
//  phoneBand  ElasticBand (closed), the band that snaps round the phone
//  Props own their material clones (recolouring one never leaks). Ownership by global time —
//  SC3D.owner(name, t) → 's1'…'s5' | 'idle' (scene ids: s1-name, s2-far-home, s3-data,
//  s4-money, s5-mark):
//    band        s1 [0,6.8) · s2 [6.8,16.8) · idle [16.8,22) · s5 [22,30)
//    ring        idle · s3 [16.3,19.6) · idle [19.6,22) · s5 [22,30)
//    phone, phoneBand   idle · s4 [19,22) · s5 [22,30)
//    continent, capeTownPin   s2 [6.5,16.8) · s5 [22,30)      rwanda, kigaliPin   s2 · s3 [16.5,19.6) · s5
//  "idle" frames draw the canonical pose (SC3D.poses.*) unless someone updated/claimed the prop.
//  Bands hide in any frame where nobody calls band.update(). Canonical poses — use them at your
//  hand-off edges so the film is continuous:
//    poses.kigaliCoil(t) → { points, radius }   band coiled round the Kigali needle (vibration
//                                                decays from 14.3; follows the pin if it moves)
//    poses.rwandaRing(t, { offset, lift }) → { points, radius }   ring on the (lifted) border
//    poses.phoneBand(t) → { points, radius }     loop round the phone body (follows the phone)
//
// ── MATERIALS (SC3D.materials; shared — .clone() before animating colour/opacity) ────────────
//  violetGloss  #6B63FF clearcoat rubber: elastic bands, the extra t, violet pins
//  violetSatin  deep-violet satin (renders ≈ brand violet under ACES): logo slabs
//  inkSatin     black-ink lacquer: the s1 brand letters
//  pearlSatin   white satin: the lockup wordmark (the brand wordmark is white on dark)
//  slateMatte   #6E6A80: anything "far" (Cape Town pin)      paper  #F4F3FF matte
//  blackGlass / frameMetal: phone     chrome: pin needles     ledGlow: unlit LED
//  continentInk: coast walls (matte, pooled)
//  makeFlatLitMaterial({ color, emissive, pool, sheen, sheenPower }) — for large HORIZONTAL
//    surfaces only (floor, map tops): constant rig lighting, soft 8-tap shadow, light pool, satin
//    sheen + reflection, fog, local impact light, shock wave. ~5× cheaper than Standard. Has
//    .color / .emissive / .emissiveIntensity like a standard material.
//  Studio reflections: every MeshStandard/Physical material (yours too) automatically gets the
//  baked studio as its IBL (camera-locked matcap atlas, 7 roughness levels + irradiance; strength
//  = material.envMapIntensity). Don't assign envMap unless you want the slow true PMREM path
//  (SC3D.envMap).
//
// ── BUILDERS ─────────────────────────────────────────────────────────────────────────────────
//  makeElasticBand({ material, segments=160, radial=14, closed=false, caps=true }) →
//    { mesh, update(points, radius, { closed }?) , length }  points: Vector3s | [x,y,z]; radius:
//    number | (u 0..1) => number. Rebuilds a glossy tube along a centripetal Catmull-Rom each call
//    (~0.3 ms, fixed buffers). Call every frame the band should be visible.
//  bandPath(a, b, { count=32, lift, sag, tremble, t, seed, freq=7 }) → Vector3[]  a→b with arch,
//    sag and a deterministic standing-wave tremble (amplitude in u; freeze by passing a fixed t)
//  bandRadius(length, restLength, restRadius=0.026) — "thinner when stretched": r ∝ 1/√stretch
//  coilPoints(center, { radius, turns, y0, y1, count, wobble, t, phase }) → helix points
//  makeLetter(glyph, { scale=0.032, depth=3.6, bevel=0.5, material }) → Mesh. glyph = index into
//    SC_LOGO.letters (5 = the extra t). Origin = bottom-centre on the baseline, centred in x and
//    depth (y = 0 stands it on the floor; scale.y squashes from the base). Faces +Z.
//    userData { char, glyph, scale, width, height }
//  wordLayout(text) → [{ char, glyph, x }]  x = glyph centre in logo units from the word centre,
//    spaced like the real wordmark ("stretch" closes the extra t's gap; "strettch cloud" = lockup)
//  makeWord(text, { scale, material, depth, bevel }) → { group, letters: [{ mesh, char, glyph, x }] }
//  makeMark({ scale=0.02, depth=5, bevel=0.8, material }) → { group, top, middle, bottom, led,
//    ledGlow }  slabs centred on their own centroids at their logo positions (group origin = mark
//    centre); userData.home { position, quaternion }. led = emissive pill in the LED hole (animate
//    led.material.color), ledGlow = additive sprite (opacity).
//  makeLockup({ scale, material, letterMaterial }) → { group, mark, letters: [{ mesh, char, glyph }] }
//    mark + all 13 wordmark glyphs at their real lockup positions; userData.home on each.
//  makePin(material, { height=0.56, headRadius=0.075 }) → Group (origin = tip)
//  makePhone({ width=0.5, height=1.04, depth=0.05 }) → { group, body, screen, canvas (540×1120),
//    ctx, texture, redraw((ctx, w, h) => …) }  portrait, screen faces +Z. Redraw only on change.
//  makeContactShadow({ width, depth, opacity }) → soft blob Mesh (grounding); y = 0.002
//  makeGlow({ color, size, opacity }) → additive Sprite
//  sceneGroup(root, name) → Group auto-shown only while your scene is active
//
// ── PER-FRAME REQUESTS (call in render(t); cleared after the frame) ──────────────────────────
//  flash(position, { intensity=1, color, size=1.2, light=true })  impact: glow sprite + a local
//    violet light on the flat surfaces + a rim kick (the strongest flash of the frame lights)
//  shock(center, { radius, width, intensity, color })  soft light wavefront across the map/floor
//  light({ key, fill, rim, env, exposure, sheen, reflect, fog, pool })  multipliers on the rig
//    (1 = default; fill = hemisphere; pool = { x, z, inner, outer, floor } overrides the pool)
//  nudgeCamera({ target:[dx,dy,dz], yaw, pitch, roll, fov (degrees), dist (multiplier) })
//  claim(name)  "I drive this prop this frame" (suppresses its idle pose)
//
// ── CAMERA ───────────────────────────────────────────────────────────────────────────────────
//  SC3D.camera; SC3D.cameraAt(t) → { position, target (look-at), subject, up, fov, roll, yaw,
//  pitch, dist, sx, sy }; SC3D.toScreen(vec3, t) → { x, y, behind } in stage px (anchor copy and
//  leader lines to 3D). Orbit rig around a subject: yaw (0 = camera south looking north, −90 =
//  west looking east), pitch (+ = looking down), dist (interpolated in ln), fov, roll, and sx/sy
//  = where the subject sits on screen (−1…1 of the half frame). C1 Hermite keys; overshoot-and-
//  settle eases on stops; faint handheld breathing, frozen in the breath and dead from 27.2.
//  Copy side: subject sits right of centre whenever copy is on screen (copy lives left).
//    0.0–2.55  macro, low (pitch 2.5–3°, fov 26, dist 4.2→4.85): the word, then widening and
//              trucking right to hold the stretched "stret … ch"
//    2.55–3.0  strained hold · 3.0–3.45 quick push-in with overshoot reacting to the t's hit
//    3.45–5.2  arc to ¾ from the south-west (yaw −36, pitch 13, dist 4.6) — flows into:
//    5.2–7.2   crane up + back following the band east (dist 4.6 → 20)
//    7.2–9.0   ¾ high on Africa (yaw ≈ −26, pitch ≈ 37, dist ≈ 19; Africa right of centre)
//    9.0–12.8  THE slow move: push along the band toward Kigali, lowering to a low dutch
//              (pitch 7.5, dist 5.2, roll 2°) from above Cape Town
//    12.8–14.0 frozen (the breath)
//    14.0–14.9 whip + crash-push into Kigali (spring; fastest move, 24-subframe blur window)
//    14.9–16.0 close on Kigali, slow orbit (pin right of centre, copy left)
//    16.0–19.0 glide up to the Rwanda macro (pitch 50, dist 2.4; Rwanda upper right), drift
//    19.0–22.0 glide to the phone (pitch 6, dist 3.3; phone right third, a touch high), drift
//    22.0–24.2 pull back + rise to the mark assembly · 24.2–26.0 settle to the perfect frontal
//              lockup (yaw/pitch/roll 0, dist 7.8, lockup just above centre) · hold to 30.0
//
// ── LOOK ─────────────────────────────────────────────────────────────────────────────────────
//  ACES filmic, sRGB. Near-black warm studio #0B0A10; linear fog from just behind the subject
//  (1.15–3.6 × camera distance), so the horizon always dissolves. Rig (3 lights, follows the
//  subject): warm spot key front-left/high at 1× camera distance (real falloff pool + soft 8-tap
//  shadows), violet directional rim from behind, dim neutral hemi; plus the baked studio
//  reflections. Satin floor/map: key sheen + a blurred planar reflection on the beats that need
//  it. Per-beat art direction lives in the LOOK track (key angle/level, rim, exposure, reflect,
//  mirror plane) in onInit. Debug URL params: ?aa=0, ?taps=1|4|8, ?reflect=0; set
//  window.__scTiming = [] to collect per-frame { mirror, main } GPU ms.
// =============================================================================================
(() => {
  'use strict'
  const THREE = window.THREE
  const { SVGLoader, BufferGeometryUtils } = window.THREE_ADDONS
  const SC = window.SC
  const DEG = Math.PI / 180
  const { clamp, lerp } = SC

  const WORLD = {
    K: 0.25,
    LON0: 17,
    LAT0: 1,
    SURFACE: 0.1,
    LETTER_SCALE: 0.032,
    LOCKUP_SCALE: 0.02,
    BG: '#0B0A10',
  }

  const SC3D = (window.SC3D = {
    WORLD,
    materials: {},
    props: {},
    layout: {},
    poses: {},
  })

  const toV3 = (p) => (p && p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2]))
  const smoothstep = (a, b, x) => {
    const s = clamp((x - a) / (b - a))
    return s * s * (3 - 2 * s)
  }

  // ------------------------------------------------------------------------------------------
  // Projection
  // ------------------------------------------------------------------------------------------
  function project(lon, lat, y = 0) {
    return new THREE.Vector3((lon - WORLD.LON0) * Math.cos(lat * DEG) * WORLD.K, y, -(lat - WORLD.LAT0) * WORLD.K)
  }
  function unproject(x, z) {
    const lat = WORLD.LAT0 - z / WORLD.K
    return [WORLD.LON0 + x / (WORLD.K * Math.cos(lat * DEG)), lat]
  }
  SC3D.project = project
  SC3D.unproject = unproject

  // ------------------------------------------------------------------------------------------
  // Geo: Africa as one outline (drop every edge shared by two countries), Rwanda 10m ring
  // ------------------------------------------------------------------------------------------
  function simplify(points, tolerance) {
    // Douglas–Peucker on a closed ring (array of [x, y]).
    if (points.length < 8) return points
    const keep = new Uint8Array(points.length)
    keep[0] = 1
    keep[points.length - 1] = 1
    const stack = [[0, points.length - 1]]
    while (stack.length) {
      const [first, last] = stack.pop()
      const [ax, ay] = points[first]
      const [bx, by] = points[last]
      const dx = bx - ax
      const dy = by - ay
      const length = Math.hypot(dx, dy) || 1e-9
      let maxDistance = 0
      let index = -1
      for (let i = first + 1; i < last; i++) {
        const distance = Math.abs((points[i][0] - ax) * dy - (points[i][1] - ay) * dx) / length
        if (distance > maxDistance) {
          maxDistance = distance
          index = i
        }
      }
      if (maxDistance > tolerance && index > 0) {
        keep[index] = 1
        stack.push([first, index], [index, last])
      }
    }
    return points.filter((_, i) => keep[i])
  }
  const ringArea = (ring) => {
    let sum = 0
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      sum += a[0] * b[1] - b[0] * a[1]
    }
    return sum / 2
  }
  function africaOutline() {
    const key = (p) => `${p[0]},${p[1]}`
    const edges = new Map()
    for (const country of window.SC_GEO.africa) {
      for (const polygon of country.polygons) {
        for (const ring of polygon) {
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i]
            const b = ring[(i + 1) % ring.length]
            if (key(a) === key(b)) continue
            const reverse = `${key(b)}>${key(a)}`
            if (edges.has(reverse)) edges.delete(reverse)
            else edges.set(`${key(a)}>${key(b)}`, [a, b])
          }
        }
      }
    }
    const byStart = new Map()
    for (const [id, [a, b]] of edges) {
      if (!byStart.has(key(a))) byStart.set(key(a), [])
      byStart.get(key(a)).push([id, b])
    }
    const used = new Set()
    const rings = []
    for (const [id, [a, b]] of edges) {
      if (used.has(id)) continue
      used.add(id)
      const ring = [a]
      let current = b
      for (let guard = 0; key(current) !== key(a) && guard < 50000; guard++) {
        ring.push(current)
        const next = (byStart.get(key(current)) || []).find(([candidate]) => !used.has(candidate))
        if (!next) break
        used.add(next[0])
        current = next[1]
      }
      rings.push(ring)
    }
    // Mainland + Madagascar (drop specks under 0.5 square degrees).
    return rings.filter((ring) => Math.abs(ringArea(ring)) > 0.5).map((ring) => simplify(ring, 0.05))
  }
  function rwandaRing() {
    const flat = window.SC_RWANDA_HIRES.ring
    const ring = []
    for (let i = 0; i < flat.length; i += 2) ring.push([flat[i], flat[i + 1]])
    if (key2(ring[0]) === key2(ring[ring.length - 1])) ring.pop()
    return simplify(ring, 0.0035)
  }
  const key2 = (p) => `${p[0]},${p[1]}`

  // ------------------------------------------------------------------------------------------
  // Geometry helpers
  // ------------------------------------------------------------------------------------------
  const svgLoader = new SVGLoader()
  // Wordmark contours self-intersect (the h's outline backtracks into its stem; the e's crossbar
  // edges cut through its counter). SVG's fill rule resolves that; earcut can't. So resolve the
  // fill rule ourselves: split every edge at every crossing, keep the edges whose two sides differ
  // in inside-ness (winding ≠ 0 for nonzero, odd for evenodd), chain them into clean rings, and
  // classify outers (CCW) and holes (CW). O(E²) per glyph — build time only.
  function resolveFill(contours, fillRule = 'nonzero') {
    const edges = []
    for (const ring of contours) {
      const pts = ring.slice()
      if (pts.length > 2 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-7) pts.pop()
      for (let i = 0; i < pts.length; i++) edges.push({ a: pts[i], b: pts[(i + 1) % pts.length], cuts: [] })
    }
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i]
      for (let j = i + 1; j < edges.length; j++) {
        const f = edges[j]
        const rx = e.b.x - e.a.x
        const ry = e.b.y - e.a.y
        const qx = f.b.x - f.a.x
        const qy = f.b.y - f.a.y
        const denom = rx * qy - ry * qx
        if (Math.abs(denom) < 1e-12) continue
        const t = ((f.a.x - e.a.x) * qy - (f.a.y - e.a.y) * qx) / denom
        const u = ((f.a.x - e.a.x) * ry - (f.a.y - e.a.y) * rx) / denom
        if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) continue
        const hit = new THREE.Vector2(e.a.x + rx * t, e.a.y + ry * t)
        e.cuts.push([t, hit])
        f.cuts.push([u, hit])
      }
    }
    const pieces = []
    for (const e of edges) {
      e.cuts.sort((p, q) => p[0] - q[0])
      let from = e.a
      for (const [, hit] of e.cuts) {
        pieces.push([from, hit])
        from = hit
      }
      pieces.push([from, e.b])
    }
    const winding = (x, y) => {
      let w = 0
      for (const { a, b } of edges) {
        if (a.y <= y) {
          if (b.y > y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) > 0) w++
        } else if (b.y <= y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) < 0) w--
      }
      return w
    }
    const inside = (x, y) => (fillRule === 'evenodd' ? Math.abs(winding(x, y)) % 2 === 1 : winding(x, y) !== 0)
    const key = (p) => `${Math.round(p.x * 1e5)},${Math.round(p.y * 1e5)}`
    const kept = []
    for (const [a, b] of pieces) {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const length = Math.hypot(dx, dy)
      if (length < 1e-9) continue
      const eps = 1e-4
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const left = inside(mx - (dy / length) * eps, my + (dx / length) * eps)
      const right = inside(mx + (dy / length) * eps, my - (dx / length) * eps)
      if (left === right) continue
      kept.push(left ? { a, b } : { a: b, b: a }) // inside on the left ⇒ outers CCW, holes CW
    }
    const byStart = new Map()
    for (const edge of kept) {
      const k = key(edge.a)
      if (!byStart.has(k)) byStart.set(k, [])
      byStart.get(k).push(edge)
    }
    const used = new Set()
    const rings = []
    for (const edge of kept) {
      if (used.has(edge)) continue
      const ring = []
      let current = edge
      for (let guard = 0; current && !used.has(current) && guard < 100000; guard++) {
        used.add(current)
        ring.push(current.a)
        current = (byStart.get(key(current.b)) || []).find((candidate) => !used.has(candidate))
      }
      if (ring.length >= 3) rings.push(ring)
    }
    const signedArea = (ring) => {
      let sum = 0
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]
        const b = ring[(i + 1) % ring.length]
        sum += a.x * b.y - b.x * a.y
      }
      return sum / 2
    }
    const outers = rings.filter((ring) => signedArea(ring) > 1e-9)
    const holes = rings.filter((ring) => signedArea(ring) < -1e-9)
    const contains = (ring, p) => {
      let hit = false
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        if (ring[i].y > p.y !== ring[j].y > p.y && p.x < ((ring[j].x - ring[i].x) * (p.y - ring[i].y)) / (ring[j].y - ring[i].y) + ring[i].x) hit = !hit
      }
      return hit
    }
    return outers.map((outer) => ({ outer, holes: holes.filter((hole) => contains(outer, hole[0])) }))
  }
  // SVG path data → THREE.Shapes with y flipped to y-up and the fill rule resolved (see above).
  function shapesFromPath(d, { fillRule = 'nonzero', divisions = 10 } = {}) {
    const data = svgLoader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`)
    const contours = []
    for (const path of data.paths) {
      for (const subPath of path.subPaths) contours.push(subPath.getPoints(divisions).map((p) => new THREE.Vector2(p.x, -p.y)))
    }
    return resolveFill(contours, fillRule).map(({ outer, holes }) => {
      const shape = new THREE.Shape(outer)
      for (const hole of holes) shape.holes.push(new THREE.Path(hole))
      return shape
    })
  }
  // Crease-smoothed normals blur long cap triangles into the bevel (visible streaks on glossy
  // faces): force every cap triangle (face normal ≈ ±axis) back to its exact face normal.
  function flatCaps(geometry, axis = 2) {
    const position = geometry.attributes.position
    const normal = geometry.attributes.normal
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    const face = new THREE.Vector3()
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i)
      b.fromBufferAttribute(position, i + 1)
      c.fromBufferAttribute(position, i + 2)
      face.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize()
      if (Math.abs(face.getComponent(axis)) > 0.9995) for (let k = 0; k < 3; k++) normal.setXYZ(i + k, face.x, face.y, face.z)
    }
    normal.needsUpdate = true
    return geometry
  }
  // Extrude along +Z, centred in depth; smooth the bevel, keep the face/side crease.
  function extrude(shapes, { depth, bevel, bevelSegments = 3, crease = 38 }) {
    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelOffset: -bevel,
      bevelSegments,
      curveSegments: 1,
      steps: 1,
    })
    geometry.translate(0, 0, -depth / 2)
    const creased = flatCaps(BufferGeometryUtils.toCreasedNormals(geometry, crease * DEG), 2)
    geometry.dispose()
    return indexed(creased)
  }
  // toCreasedNormals returns non-indexed triangles (3 unique vertices each); SwiftShader shades
  // every vertex in every pass (shadow, mirror, main), so weld identical position+normal pairs.
  function indexed(geometry) {
    geometry.deleteAttribute('uv')
    const merged = BufferGeometryUtils.mergeVertices(geometry, 1e-5)
    geometry.dispose()
    return merged
  }
  function roundedRectShape(width, height, radius) {
    const shape = new THREE.Shape()
    const x = -width / 2
    const y = -height / 2
    shape.moveTo(x + radius, y)
    shape.lineTo(x + width - radius, y)
    shape.absarc(x + width - radius, y + radius, radius, -Math.PI / 2, 0, false)
    shape.lineTo(x + width, y + height - radius)
    shape.absarc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2, false)
    shape.lineTo(x + radius, y + height)
    shape.absarc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI, false)
    shape.lineTo(x, y + radius)
    shape.absarc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5, false)
    return shape
  }
  function canvasTexture(size, draw) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    draw(canvas.getContext('2d'), size)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }
  const radialTexture = (stops) =>
    canvasTexture(128, (ctx, size) => {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      for (const [offset, color] of stops) gradient.addColorStop(offset, color)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)
    })
  const setShadows = (object, cast = true, receive = true) =>
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = cast
        child.receiveShadow = receive
      }
    })

  // ------------------------------------------------------------------------------------------
  // Materials
  // ------------------------------------------------------------------------------------------
  function buildMaterials() {
    const m = SC3D.materials
    m.violetGloss = new THREE.MeshPhysicalMaterial({
      name: 'violetGloss', color: '#6B63FF', roughness: 0.32, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.1,
    })
    m.violetSatin = new THREE.MeshPhysicalMaterial({
      name: 'violetSatin', color: '#4F46F0', roughness: 0.46, metalness: 0,
      clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 0.5,
    })
    m.inkSatin = new THREE.MeshPhysicalMaterial({
      name: 'inkSatin', color: '#211F33', roughness: 0.3, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.09, envMapIntensity: 1.0,
    })
    // The lockup wordmark: the brand's white wordmark as a pearl satin.
    m.pearlSatin = new THREE.MeshPhysicalMaterial({
      name: 'pearlSatin', color: '#FFFFFF', roughness: 0.4, metalness: 0,
      clearcoat: 0.6, clearcoatRoughness: 0.14, envMapIntensity: 1.5, emissive: '#FFFFFF', emissiveIntensity: 0.06,
    })
    m.continentInk = addPool(new THREE.MeshStandardMaterial({
      name: 'continentInk', color: '#2F2D35', roughness: 0.42, metalness: 0,
    }), 'sc-pool-continent', 1)
    m.continentInk.userData.noEnv = true
    m.slateMatte = new THREE.MeshStandardMaterial({ name: 'slateMatte', color: '#6E6A80', roughness: 0.78, metalness: 0 })
    m.blackGlass = new THREE.MeshPhysicalMaterial({
      name: 'blackGlass', color: '#050508', roughness: 0.05, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6,
    })
    m.frameMetal = new THREE.MeshStandardMaterial({ name: 'frameMetal', color: '#4A4758', metalness: 1, roughness: 0.28 })
    m.chrome = new THREE.MeshStandardMaterial({ name: 'chrome', color: '#D6D3E4', metalness: 1, roughness: 0.16 })
    m.paper = new THREE.MeshStandardMaterial({ name: 'paper', color: '#F4F3FF', roughness: 0.62, metalness: 0 })
    m.ledGlow = new THREE.MeshBasicMaterial({ name: 'ledGlow', color: new THREE.Color('#9C95FF').multiplyScalar(3) })
    return m
  }

  // ------------------------------------------------------------------------------------------
  // Studio environment (reflections): softboxes in a black room → PMREM
  // ------------------------------------------------------------------------------------------
  function buildEnvironment(renderer) {
    const env = new THREE.Scene()
    env.add(new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.MeshBasicMaterial({ color: '#030305', side: THREE.BackSide })))
    const panel = (width, height, color, intensity, position) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
      )
      mesh.position.set(...position)
      mesh.lookAt(0, 0, 0)
      env.add(mesh)
    }
    // The camera mostly looks north: south = behind the camera, north = behind the subjects.
    panel(34, 20, '#FFF0DF', 11, [-30, 30, 14]) // key softbox: warm, high, west-south-west
    panel(60, 19, '#FFF6EE', 2.6, [4, 7.5, 46]) // front softbox behind camera, −3°–21° up (front-face gradients)
    panel(8, 30, '#FFF3E6', 3.0, [-26, 14, 38]) // tall strip south-west (a soft vertical reflection)
    // The lit studio floor, as vertical faces see it (a dim warm disc under the room)
    const floorDisc = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#2A2630').multiplyScalar(1.4) }))
    floorDisc.rotation.x = -Math.PI / 2
    floorDisc.position.y = -3
    env.add(floorDisc)
    panel(44, 44, '#E8E6FF', 0.45, [0, 50, 0]) // overhead diffuser
    panel(6, 46, '#CAD6FF', 3.0, [40, 12, 4]) // cool strip, east
    panel(56, 5, '#7466FF', 4.0, [0, 7, -46]) // violet strip, north (rim reflections)
    panel(5, 34, '#8A7EFF', 2.0, [-42, 9, -18]) // violet strip, north-west
    const pmrem = new THREE.PMREMGenerator(renderer)
    const target = pmrem.fromScene(env, 0.015)
    pmrem.dispose()
    env.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose()
        child.material.dispose()
      }
    })
    return target.texture
  }

  // ------------------------------------------------------------------------------------------
  // Floor: satin, with a soft light pool that follows the camera target
  // ------------------------------------------------------------------------------------------
  const poolUniforms = {
    uPoolCenter: { value: new THREE.Vector2(0, 0) },
    uPoolRadius: { value: new THREE.Vector2(2, 8) },
    uPoolFloor: { value: 0.18 },
  }
  // Injects the light pool into a lit material: outgoing light fades to uPoolFloor away from the
  // pool centre (the camera target), so the studio falls off into darkness around the subject.
  function addPool(material, cacheKey, strength = 1, directSpecular = 1) {
    material.onBeforeCompile = (shader) => {
      injectStudio(shader, material)
      if (directSpecular !== 1) {
        shader.fragmentShader = shader.fragmentShader.replace(
          'vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;',
          `vec3 totalSpecular = reflectedLight.directSpecular * ${directSpecular.toFixed(3)} + reflectedLight.indirectSpecular;`,
        )
      }
      Object.assign(shader.uniforms, poolUniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPoolWorld;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPoolWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPoolWorld;\nuniform vec2 uPoolCenter;\nuniform vec2 uPoolRadius;\nuniform float uPoolFloor;')
        .replace(
          '#include <opaque_fragment>',
          `float poolD = distance(vPoolWorld.xz, uPoolCenter);
          float pool = 1.0 - smoothstep(uPoolRadius.x, uPoolRadius.y, poolD);
          outgoingLight *= mix(mix(1.0, uPoolFloor, ${strength.toFixed(3)}), 1.0, pool * pool);
          #include <opaque_fragment>`,
        )
    }
    material.customProgramCacheKey = () => cacheKey
    // Material.clone() drops onBeforeCompile — re-inject the pool on clones.
    material.clone = () => addPool(Object.getPrototypeOf(material).clone.call(material), cacheKey, strength, directSpecular)
    return material
  }
  // Flat-lit material: for large horizontal surfaces (floor, continent/Rwanda tops). Their normal
  // is +Y, so direct lighting is constant: the rig's irradiance comes in as shared uniforms set
  // once per frame, plus one shadow-map lookup, the pool, a broad satin sheen of the key and fog.
  // ~5× cheaper than MeshStandardMaterial over the whole screen in SwiftShader.
  // `.color`, `.emissive`, `.emissiveIntensity` behave like a standard material's.
  const rigUniforms = {
    uAmbient: { value: new THREE.Color(0, 0, 0) }, // unshadowed irradiance on an up-facing plane (hemi sky + rim)
    uKeyPos: { value: new THREE.Vector3(0, 10, 0) },
    uKeyAxis: { value: new THREE.Vector3(0, -1, 0) }, // direction the key spot points
    uKeyColor: { value: new THREE.Color(0, 0, 0) }, // colour × intensity (candela)
    uKeyCone: { value: new THREE.Vector2(0.7, 0.9) }, // cos(outer), cos(inner)
    uKeyRange: { value: new THREE.Vector2(0, 2) }, // cutoff distance, decay
    uKeySpecular: { value: 0.02 },
    uFlashPos: { value: new THREE.Vector3(0, -100, 0) }, // local impact light (strongest flash of the frame)
    uFlashColor: { value: new THREE.Color(0, 0, 0) },
    uShockCenter: { value: new THREE.Vector3(0, 0, 0) }, // soft light wavefront across flat surfaces
    uShock: { value: new THREE.Vector4(0, 0.3, 0, 0) }, // radius, width, intensity, unused
    uShockColor: { value: new THREE.Color('#7A70FF') },
    uMirror: { value: null }, // half-res planar reflection (objects only), linear radiance
    uMirrorMatrix: { value: new THREE.Matrix4() },
    uMirrorStrength: { value: 0 },
    uMirrorTexel: { value: new THREE.Vector2(1 / 960, 1 / 540) },
  }
  const FLAT_TAPS = Number(new URLSearchParams(location.search).get('taps') || 8)
  const DEBUG_REFLECT = Number(new URLSearchParams(location.search).get('reflect') ?? 1)
  const MIRROR_TAPS = Number(new URLSearchParams(location.search).get('mtaps') || 1)
  const shadowSoftness = { value: 3 } // flat-lit shadow blur radius, in shadow-map texels (set per frame)
  const FLAT_VERTEX = `
    #include <common>
    #include <fog_pars_vertex>
    #include <shadowmap_pars_vertex>
    varying vec3 vFlatWorld;
    void main() {
      #include <beginnormal_vertex>
      #include <defaultnormal_vertex>
      #include <begin_vertex>
      #include <project_vertex>
      vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
      vFlatWorld = worldPosition.xyz;
      #include <shadowmap_vertex>
      #include <fog_vertex>
    }`
  const FLAT_FRAGMENT = `
    uniform vec3 uColor;
    uniform vec3 uEmissive;
    uniform float uEmissiveIntensity;
    uniform float uPoolStrength;
    uniform float uSheenScale;
    uniform float uSheenPower;
    uniform vec3 uAmbient;
    uniform vec3 uKeyPos;
    uniform vec3 uKeyAxis;
    uniform vec3 uKeyColor;
    uniform vec2 uKeyCone;
    uniform vec2 uKeyRange;
    uniform float uKeySpecular;
    uniform vec3 uFlashPos;
    uniform vec3 uFlashColor;
    uniform vec3 uShockCenter;
    uniform vec4 uShock;
    uniform vec3 uShockColor;
    uniform sampler2D uMirror;
    uniform mat4 uMirrorMatrix;
    uniform float uMirrorStrength;
    uniform vec2 uMirrorTexel;
    uniform vec2 uPoolCenter;
    uniform vec2 uPoolRadius;
    uniform float uPoolFloor;
    uniform float uShadowSoftness;
    varying vec3 vFlatWorld;
    #include <common>
    #include <packing>
    #include <fog_pars_fragment>
    #include <bsdfs>
    #include <lights_pars_begin>
    #include <shadowmap_pars_fragment>
    // Soft shadow from the key spot's map: 8-tap Poisson disc rotated per pixel (interleaved
    // gradient noise; the film grain hides the dither), 4-tap bilinear, or 1 tap (?taps=).
    float flatShadow() {
      #if defined(USE_SHADOWMAP) && NUM_SPOT_LIGHT_SHADOWS > 0
        SpotLightShadow ls = spotLightShadows[0];
        vec4 sc = vSpotLightCoord[0];
        sc.xyz /= sc.w;
        sc.z += ls.shadowBias;
        if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
        vec2 texel = 1.0 / ls.shadowMapSize;
        #if FLAT_SHADOW_TAPS == 1
          float s = texture2DCompare(spotShadowMap[0], sc.xy, sc.z);
        #elif FLAT_SHADOW_TAPS == 4
          vec2 st = sc.xy * ls.shadowMapSize - 0.5;
          vec2 f = fract(st);
          vec2 uv = (floor(st) + 0.5) * texel;
          float s = mix(
            mix(texture2DCompare(spotShadowMap[0], uv, sc.z), texture2DCompare(spotShadowMap[0], uv + vec2(texel.x, 0.0), sc.z), f.x),
            mix(texture2DCompare(spotShadowMap[0], uv + vec2(0.0, texel.y), sc.z), texture2DCompare(spotShadowMap[0], uv + texel, sc.z), f.x),
            f.y);
        #else
          // per-pixel rotation from interleaved gradient noise, without trig
          float n1 = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          float n2 = fract(n1 * 7.13 + 0.37);
          vec2 cs = normalize(vec2(n1 - 0.5, n2 - 0.5) + vec2(1e-4));
          mat2 rot = mat2(cs.x, cs.y, -cs.y, cs.x);
          vec2 r = texel * uShadowSoftness;
          float s = 0.0;
          s += texture2DCompare(spotShadowMap[0], sc.xy + rot * vec2(-0.613, 0.617) * r, sc.z);
          s += texture2DCompare(spotShadowMap[0], sc.xy + rot * vec2(0.170, -0.040) * r, sc.z);
          s += texture2DCompare(spotShadowMap[0], sc.xy + rot * vec2(-0.299, -0.792) * r, sc.z);
          s += texture2DCompare(spotShadowMap[0], sc.xy + rot * vec2(0.645, 0.493) * r, sc.z);
          s += texture2DCompare(spotShadowMap[0], sc.xy + rot * vec2(-0.651, 0.018) * r, sc.z);
          s += texture2DCompare(spotShadowMap[0], sc.xy + rot * vec2(0.422, -0.664) * r, sc.z);
          s += texture2DCompare(spotShadowMap[0], sc.xy + rot * vec2(-0.082, 0.955) * r, sc.z);
          s += texture2DCompare(spotShadowMap[0], sc.xy + rot * vec2(0.953, -0.194) * r, sc.z);
          s *= 0.125;
        #endif
        return mix(1.0, s, ls.shadowIntensity);
      #else
        return 1.0;
      #endif
    }
    void main() {
      float shadow = flatShadow();
      vec3 toKey = uKeyPos - vFlatWorld;
      float keyDistance = length(toKey);
      vec3 L = toKey / keyDistance;
      float falloff = 1.0 / max(pow(keyDistance, uKeyRange.y), 0.01);
      if (uKeyRange.x > 0.0) falloff *= pow2(saturate(1.0 - pow4(keyDistance / uKeyRange.x)));
      float cone = smoothstep(uKeyCone.x, uKeyCone.y, dot(-L, uKeyAxis));
      vec3 keyIrradiance = uKeyColor * falloff * cone * max(L.y, 0.0) * shadow;
      vec3 toFlash = uFlashPos - vFlatWorld;
      float flashDistance2 = dot(toFlash, toFlash);
      vec3 flashIrradiance = uFlashColor * max(toFlash.y, 0.0) * inversesqrt(flashDistance2) / max(flashDistance2, 0.01);
      vec3 color = uColor * RECIPROCAL_PI * (uAmbient + keyIrradiance + flashIrradiance);
      vec3 viewDir = normalize(cameraPosition - vFlatWorld);
      vec3 halfDir = normalize(viewDir + L);
      color += keyIrradiance * uKeySpecular * uSheenScale * pow(max(halfDir.y, 0.0), uSheenPower);
      #ifdef FLAT_MIRROR
      {
        // satin reflection: low-res planar mirror (the bilinear upsample is the blur) + a 4-tap
        // box, Schlick fresnel toward grazing
        vec4 mc = uMirrorMatrix * vec4(vFlatWorld, 1.0);
        vec2 muv = mc.xy / mc.w * 0.5 + 0.5;
        #if FLAT_MIRROR_TAPS == 1
          vec3 mirror = texture2D(uMirror, muv).rgb;
        #else
          vec2 blur = uMirrorTexel * 0.6;
          vec3 mirror = 0.25 * (texture2D(uMirror, muv + blur).rgb + texture2D(uMirror, muv - blur).rgb
            + texture2D(uMirror, muv + vec2(blur.x, -blur.y)).rgb + texture2D(uMirror, muv + vec2(-blur.x, blur.y)).rgb);
        #endif
        mirror = min(mirror, vec3(0.8)); // clamp specular fireflies
        float fresnel = 0.06 + 0.94 * pow(1.0 - max(viewDir.y, 0.0), 5.0);
        color += mirror * fresnel * uMirrorStrength * uSheenScale;
      }
      #endif
      float pool = 1.0 - smoothstep(uPoolRadius.x, uPoolRadius.y, distance(vFlatWorld.xz, uPoolCenter));
      color *= mix(mix(1.0, uPoolFloor, uPoolStrength), 1.0, pool * pool);
      color += uEmissive * uEmissiveIntensity;
      if (uShock.z > 0.0) {
        float front = (distance(vFlatWorld.xz, uShockCenter.xz) - uShock.x) / uShock.y;
        color += uShockColor * uShock.z * exp(-front * front) * (0.35 + 0.65 * smoothstep(-2.5, 0.0, front));
      }
      gl_FragColor = vec4(color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`
  function makeFlatLitMaterial({ name = 'flatLit', color = '#15131B', emissive = '#000000', emissiveIntensity = 1, pool = 1, sheen = 1, sheenPower = 10 } = {}) {
    const material = new THREE.ShaderMaterial({
      name,
      lights: true,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog, {
        uColor: { value: new THREE.Color(color) },
        uEmissive: { value: new THREE.Color(emissive) },
        uEmissiveIntensity: { value: emissiveIntensity },
        uPoolStrength: { value: pool },
        uSheenScale: { value: sheen },
        uSheenPower: { value: sheenPower },
      }]),
      vertexShader: FLAT_VERTEX,
      fragmentShader: FLAT_FRAGMENT,
      defines: { FLAT_SHADOW_TAPS: FLAT_TAPS, FLAT_MIRROR_TAPS: MIRROR_TAPS },
    })
    material.uniforms.uShadowSoftness = shadowSoftness
    Object.assign(material.uniforms, poolUniforms, rigUniforms) // shared per-frame uniforms
    material.color = material.uniforms.uColor.value
    material.emissive = material.uniforms.uEmissive.value
    Object.defineProperty(material, 'emissiveIntensity', {
      get: () => material.uniforms.uEmissiveIntensity.value,
      set: (value) => { material.uniforms.uEmissiveIntensity.value = value },
    })
    material.userData.flatLit = true
    allFlat.push(material)
    material.clone = () => makeFlatLitMaterial({
      name, color: material.color.clone(), emissive: material.emissive.clone(), emissiveIntensity: material.emissiveIntensity,
      pool: material.uniforms.uPoolStrength.value, sheen: material.uniforms.uSheenScale.value, sheenPower: material.uniforms.uSheenPower.value,
    })
    return material
  }
  SC3D.makeFlatLitMaterial = makeFlatLitMaterial
  const allFlat = []
  let flatMirrorOn = false
  function setFlatMirror(on) {
    if (on === flatMirrorOn) return
    flatMirrorOn = on
    for (const material of allFlat) {
      if (on) material.defines.FLAT_MIRROR = 1
      else delete material.defines.FLAT_MIRROR
      material.needsUpdate = true
    }
  }
  // The floor has Africa cut out of it (`holes` = continent outline rings in shape space x/−z):
  // in SwiftShader rasterising a hidden full-screen layer costs ~140 ms even when depth-rejected.
  function buildFloor(holes = []) {
    const square = new THREE.Shape([new THREE.Vector2(-300, -300), new THREE.Vector2(300, -300), new THREE.Vector2(300, 300), new THREE.Vector2(-300, 300)])
    for (const hole of holes) square.holes.push(new THREE.Path(hole))
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(square, 1), makeFlatLitMaterial({ name: 'floor', color: '#1D1B21', sheen: 1, sheenPower: 8 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    floor.name = 'floor'
    floor.renderOrder = 2 // big surfaces draw last among opaques: early-z rejects hidden pixels
    return floor
  }

  // ------------------------------------------------------------------------------------------
  // Elastic band — a glossy tube rebuilt from points every frame (fixed buffers, no allocation
  // of GPU objects). Hidden in any frame where update() isn't called.
  // ------------------------------------------------------------------------------------------
  const allBands = []
  function makeElasticBand({ material, segments = 160, radial = 14, closed = false, caps = true, name = 'band' } = {}) {
    const ringSize = radial + 1
    const vertexCount = (segments + 1) * ringSize
    const positions = new Float32Array(vertexCount * 3)
    const normals = new Float32Array(vertexCount * 3)
    const indices = []
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * ringSize + j
        const b = (i + 1) * ringSize + j
        indices.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setIndex(indices)
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage))
    const mesh = new THREE.Mesh(geometry, material || SC3D.materials.violetGloss)
    mesh.name = name
    mesh.frustumCulled = false
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.visible = false
    const capGeometry = new THREE.SphereGeometry(1, 20, 14)
    const capA = new THREE.Mesh(capGeometry, mesh.material)
    const capB = new THREE.Mesh(capGeometry, mesh.material)
    for (const cap of [capA, capB]) {
      cap.castShadow = true
      cap.receiveShadow = true
      mesh.add(cap)
    }
    const curve = new THREE.CatmullRomCurve3([], closed, 'centripetal')
    const point = new THREE.Vector3()
    const normal = new THREE.Vector3()
    const band = {
      mesh,
      curve,
      closed,
      touched: false,
      length: 0,
      update(points, radius = 0.026, options = {}) {
        const isClosed = options.closed ?? closed
        if (!points || points.length < 2) {
          mesh.visible = false
          return band
        }
        curve.points = points.map(toV3)
        curve.closed = isClosed
        curve.updateArcLengths()
        band.length = curve.getLength()
        const frames = curve.computeFrenetFrames(segments, isClosed)
        const radiusAt = typeof radius === 'function' ? radius : () => radius
        for (let i = 0; i <= segments; i++) {
          const u = i / segments
          curve.getPointAt(isClosed && i === segments ? 0 : u, point)
          const r = radiusAt(u)
          const N = frames.normals[i]
          const B = frames.binormals[i]
          for (let j = 0; j <= radial; j++) {
            const v = (j / radial) * Math.PI * 2
            const sin = Math.sin(v)
            const cos = -Math.cos(v)
            normal.set(cos * N.x + sin * B.x, cos * N.y + sin * B.y, cos * N.z + sin * B.z).normalize()
            const k = (i * ringSize + j) * 3
            normals[k] = normal.x
            normals[k + 1] = normal.y
            normals[k + 2] = normal.z
            positions[k] = point.x + r * normal.x
            positions[k + 1] = point.y + r * normal.y
            positions[k + 2] = point.z + r * normal.z
          }
        }
        geometry.attributes.position.needsUpdate = true
        geometry.attributes.normal.needsUpdate = true
        const showCaps = caps && !isClosed
        capA.visible = showCaps
        capB.visible = showCaps
        if (showCaps) {
          curve.getPointAt(0, capA.position)
          capA.scale.setScalar(radiusAt(0))
          curve.getPointAt(1, capB.position)
          capB.scale.setScalar(radiusAt(1))
        }
        mesh.visible = true
        band.touched = true
        return band
      },
    }
    allBands.push(band)
    return band
  }

  // Straight a→b with an arch, a sag and a deterministic standing-wave tremble.
  function bandPath(a, b, { count = 32, lift = 0, sag = 0, tremble = 0, t = 0, seed = 0, freq = 7 } = {}) {
    const A = toV3(a)
    const B = toV3(b)
    const along = B.clone().sub(A)
    const side = new THREE.Vector3(-along.z, 0, along.x).normalize()
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0)
    const up = new THREE.Vector3(0, 1, 0)
    const points = []
    for (let i = 0; i <= count; i++) {
      const u = i / count
      const p = A.clone().lerp(B, u)
      const arch = 4 * u * (1 - u)
      p.y += (lift - sag) * arch
      if (tremble) {
        let lateral = 0
        let vertical = 0
        for (let mode = 1; mode <= 3; mode++) {
          const shape = Math.sin(mode * Math.PI * u)
          const phase = SC.hash(seed, mode) * 6.283
          const speed = freq * (1 + 0.37 * (mode - 1))
          lateral += (shape / mode) * Math.sin(2 * Math.PI * speed * t + phase)
          vertical += (shape / mode) * Math.sin(2 * Math.PI * speed * 1.13 * t + phase * 1.7)
        }
        p.addScaledVector(side, lateral * tremble * 0.7)
        p.addScaledVector(up, vertical * tremble * 0.5)
      }
      points.push(p)
    }
    return points
  }
  const bandRadius = (length, restLength, restRadius = 0.026) => restRadius * Math.sqrt(restLength / Math.max(length, restLength * 0.15))
  function coilPoints(center, { radius = 0.035, turns = 2.6, y0 = 0.05, y1 = 0.2, count = 90, wobble = 0, t = 0, phase = 0 } = {}) {
    const c = toV3(center)
    const points = []
    for (let i = 0; i <= count; i++) {
      const u = i / count
      const angle = phase + u * turns * Math.PI * 2
      const r = radius * (1 + wobble * Math.sin(2 * Math.PI * 11 * t + u * 9))
      points.push(new THREE.Vector3(c.x + Math.cos(angle) * r, c.y + lerp(y0, y1, u), c.z + Math.sin(angle) * r))
    }
    return points
  }
  Object.assign(SC3D, { makeElasticBand, bandPath, bandRadius, coilPoints })

  // ------------------------------------------------------------------------------------------
  // Brand glyphs
  // ------------------------------------------------------------------------------------------
  const BASELINE = 22.45 // wordmark baseline in logo units (flat-bottomed letters sit on it)
  const glyphCache = new Map()
  function glyphGeometry(glyph, { scale, depth = 3.6, bevel = 0.5 }) {
    const cacheKey = `${glyph}|${scale}|${depth}|${bevel}`
    if (glyphCache.has(cacheKey)) return glyphCache.get(cacheKey)
    const letter = window.SC_LOGO.letters[glyph]
    const geometry = extrude(shapesFromPath(letter.d), { depth, bevel, bevelSegments: 3 })
    geometry.translate(-(letter.box.x0 + letter.box.x1) / 2, BASELINE, 0)
    geometry.scale(scale, scale, scale)
    geometry.computeBoundingBox()
    glyphCache.set(cacheKey, geometry)
    return geometry
  }
  function makeLetter(glyph, { scale = WORLD.LETTER_SCALE, depth = 3.6, bevel = 0.5, material } = {}) {
    const letter = window.SC_LOGO.letters[glyph]
    const mesh = new THREE.Mesh(glyphGeometry(glyph, { scale, depth, bevel }), material || SC3D.materials.inkSatin)
    mesh.name = `glyph-${glyph}-${letter.char}`
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData = {
      char: letter.char,
      glyph,
      scale,
      width: (letter.box.x1 - letter.box.x0) * scale,
      height: (BASELINE - letter.box.y0) * scale,
    }
    return mesh
  }
  // Greedy match of `text` onto the wordmark glyph sequence; skipped glyphs close their advance.
  function wordLayout(text) {
    const letters = window.SC_LOGO.letters
    const advance = (index) => (index < letters.length - 1 ? letters[index + 1].box.x0 - letters[index].box.x0 : 0)
    const result = []
    let cursor = 0
    let shift = 0
    for (const char of text) {
      if (char === ' ') continue
      let found = -1
      for (let index = cursor; index < letters.length; index++) {
        if (letters[index].char === char) {
          found = index
          break
        }
        shift += advance(index)
      }
      if (found < 0) throw new Error(`wordLayout: "${char}" not available in the wordmark after glyph ${cursor}`)
      const box = letters[found].box
      result.push({ char, glyph: found, x: (box.x0 + box.x1) / 2 - shift })
      cursor = found + 1
    }
    const halfWidth = (item) => (letters[item.glyph].box.x1 - letters[item.glyph].box.x0) / 2
    const first = result[0]
    const last = result[result.length - 1]
    const center = (first.x - halfWidth(first) + last.x + halfWidth(last)) / 2
    for (const item of result) item.x -= center
    return result
  }
  function makeWord(text, { scale = WORLD.LETTER_SCALE, material, depth, bevel } = {}) {
    const group = new THREE.Group()
    group.name = `word-${text}`
    const letters = wordLayout(text).map((item) => {
      const mesh = makeLetter(item.glyph, { scale, material, depth, bevel })
      mesh.position.x = item.x * scale
      mesh.userData.home = { position: mesh.position.clone(), quaternion: mesh.quaternion.clone() }
      group.add(mesh)
      return { mesh, ...item }
    })
    return { group, letters }
  }

  // ------------------------------------------------------------------------------------------
  // Logo mark
  // ------------------------------------------------------------------------------------------
  const SLAB_BOXES = {
    top: { x0: 0, x1: 34, y0: 0, y1: 15.8417 },
    middle: { x0: 0, x1: 33.9575, y0: 13.8486, y1: 23.871 },
    bottom: { x0: 0, x1: 27.5195, y0: 26.0547, y1: 31.8984 },
  }
  const LED = { x: 2.8576, y: 28.9766, rx: 0.68, ry: 0.615 }
  const slabCache = new Map()
  function slabGeometry(name, { scale, depth, bevel }) {
    const cacheKey = `${name}|${scale}|${depth}|${bevel}`
    if (slabCache.has(cacheKey)) return slabCache.get(cacheKey)
    const box = SLAB_BOXES[name]
    const shapes = shapesFromPath(window.SC_LOGO.markSlabs[name], { fillRule: name === 'bottom' ? 'evenodd' : 'nonzero', divisions: 16 })
    const geometry = extrude(shapes, { depth, bevel, bevelSegments: 3, crease: 40 })
    geometry.translate(-(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, 0)
    geometry.scale(scale, scale, scale)
    slabCache.set(cacheKey, geometry)
    return geometry
  }
  function makeMark({ scale = WORLD.LOCKUP_SCALE, depth = 5, bevel = 0.8, material } = {}) {
    const group = new THREE.Group()
    group.name = 'mark'
    const result = { group }
    for (const name of ['top', 'middle', 'bottom']) {
      const box = SLAB_BOXES[name]
      const mesh = new THREE.Mesh(slabGeometry(name, { scale, depth, bevel }), material || SC3D.materials.violetSatin)
      mesh.name = `slab-${name}`
      mesh.position.set(((box.x0 + box.x1) / 2 - 17) * scale, (16 - (box.y0 + box.y1) / 2) * scale, 0)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData.home = { position: mesh.position.clone(), quaternion: mesh.quaternion.clone() }
      group.add(mesh)
      result[name] = mesh
    }
    // The server LED: an emissive pill recessed in the bottom slab's hole, plus a soft glow.
    const bottomBox = SLAB_BOXES.bottom
    const ledLocal = new THREE.Vector3((LED.x - (bottomBox.x0 + bottomBox.x1) / 2) * scale, -(LED.y - (bottomBox.y0 + bottomBox.y1) / 2) * scale, 0)
    const led = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24), SC3D.materials.ledGlow.clone())
    led.rotation.x = Math.PI / 2
    led.scale.set(LED.rx * scale * 0.92, depth * scale * 0.8, LED.ry * scale * 0.92)
    led.position.copy(ledLocal)
    led.name = 'led'
    result.bottom.add(led)
    const ledGlow = makeGlow({ color: '#8C84FF', size: 5 * scale, opacity: 0 })
    ledGlow.position.copy(ledLocal).add(new THREE.Vector3(0, 0, (depth / 2 + 0.6) * scale))
    result.bottom.add(ledGlow)
    result.led = led
    result.ledGlow = ledGlow
    return result
  }
  function makeLockup({ scale = WORLD.LOCKUP_SCALE, material, letterMaterial } = {}) {
    const group = new THREE.Group()
    group.name = 'lockup'
    const center = { x: 93, y: 16 } // centre of the 186×32 lockup box
    const mark = makeMark({ scale, material })
    mark.group.position.set((17 - center.x) * scale, 0, 0)
    group.add(mark.group)
    const letters = window.SC_LOGO.letters.map((letter, glyph) => {
      const mesh = makeLetter(glyph, { scale, depth: 4, bevel: 0.55, material: letterMaterial || SC3D.materials.pearlSatin })
      mesh.position.set(((letter.box.x0 + letter.box.x1) / 2 - center.x) * scale, (center.y - BASELINE) * scale, 0)
      mesh.userData.home = { position: mesh.position.clone(), quaternion: mesh.quaternion.clone() }
      group.add(mesh)
      return { mesh, char: letter.char, glyph }
    })
    return { group, mark, letters }
  }

  // ------------------------------------------------------------------------------------------
  // Pins, phone, glows, contact shadows
  // ------------------------------------------------------------------------------------------
  function makePin(material, { height = 0.56, headRadius = 0.075 } = {}) {
    const group = new THREE.Group()
    group.name = 'pin'
    const needleLength = height - headRadius
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.002, needleLength, 12, 1), SC3D.materials.chrome)
    needle.position.y = needleLength / 2
    const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 40, 28), material || SC3D.materials.violetGloss)
    head.position.y = height - headRadius * 0.85
    group.add(needle, head)
    setShadows(group)
    group.userData = { head, needle, headTop: height + headRadius * 0.15, headRadius, height }
    return group
  }
  function makePhone({ width = 0.5, height = 1.04, depth = 0.05, radius = 0.075 } = {}) {
    const group = new THREE.Group()
    group.name = 'phone'
    const bevel = 0.012
    const bodyGeometry = new THREE.ExtrudeGeometry(roundedRectShape(width - bevel * 2, height - bevel * 2, radius - bevel), {
      depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 12,
    })
    bodyGeometry.translate(0, 0, -(depth - bevel * 2) / 2)
    const body = new THREE.Mesh(bodyGeometry, [SC3D.materials.blackGlass.clone(), SC3D.materials.frameMetal.clone()])
    body.castShadow = true
    body.receiveShadow = true
    group.add(body)
    const canvas = document.createElement('canvas')
    canvas.width = 540
    canvas.height = 1120
    const ctx = canvas.getContext('2d')
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    const inset = 0.024
    const screenGeometry = new THREE.ShapeGeometry(roundedRectShape(width - inset * 2, height - inset * 2, radius - inset), 12)
    const uv = screenGeometry.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / (width - inset * 2) + 0.5, uv.getY(i) / (height - inset * 2) + 0.5)
    const screen = new THREE.Mesh(screenGeometry, new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: false }))
    screen.position.z = depth / 2 + 0.0012
    screen.name = 'screen'
    group.add(screen)
    const phone = {
      group, body, screen, canvas, ctx, texture, width, height, depth,
      redraw(draw) {
        ctx.save()
        draw(ctx, canvas.width, canvas.height)
        ctx.restore()
        texture.needsUpdate = true
      },
    }
    phone.redraw((c, w, h) => {
      c.fillStyle = '#05050A'
      c.fillRect(0, 0, w, h)
    })
    return phone
  }
  const glowTexture = () =>
    SC3D._glowTexture ||
    (SC3D._glowTexture = radialTexture([
      [0, 'rgba(255,255,255,1)'],
      [0.12, 'rgba(255,255,255,0.55)'],
      [0.35, 'rgba(255,255,255,0.16)'],
      [0.7, 'rgba(255,255,255,0.03)'],
      [1, 'rgba(255,255,255,0)'],
    ]))
  function makeGlow({ color = '#8A80FF', size = 1, opacity = 1 } = {}) {
    const material = new THREE.SpriteMaterial({
      map: glowTexture(), color: new THREE.Color(color), transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
    })
    const sprite = new THREE.Sprite(material)
    sprite.scale.setScalar(size)
    sprite.renderOrder = 10
    sprite.name = 'glow'
    return sprite
  }
  const shadowTexture = () =>
    SC3D._shadowTexture ||
    (SC3D._shadowTexture = radialTexture([
      [0, 'rgba(0,0,0,0.85)'],
      [0.35, 'rgba(0,0,0,0.5)'],
      [0.7, 'rgba(0,0,0,0.12)'],
      [1, 'rgba(0,0,0,0)'],
    ]))
  function makeContactShadow({ width = 1, depth = 1, opacity = 0.6 } = {}) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity, depthWrite: false, toneMapped: false }),
    )
    mesh.rotation.x = -Math.PI / 2
    mesh.scale.set(width, depth, 1)
    mesh.position.y = 0.002
    mesh.renderOrder = 1
    mesh.name = 'contact-shadow'
    return mesh
  }
  Object.assign(SC3D, { makeLetter, makeWord, wordLayout, makeMark, makeLockup, makePin, makePhone, makeGlow, makeContactShadow })

  // ------------------------------------------------------------------------------------------
  // Camera track — orbit rig keys. yaw: camera azimuth around the target (0 = camera south of
  // the target looking north, −90 = west looking east). pitch: elevation (+ = looking down).
  // flow: tangent scale through the key (0 = the camera stops on it). ease: the segment INTO
  // this key uses lerp+ease instead of Hermite (for whips / overshoot-settles; ends at rest).
  // ------------------------------------------------------------------------------------------
  const whipCrash = SC.ease.spring({ stiffness: 190, damping: 17, duration: 0.9 })
  const settleEase = SC.ease.cubicBezier(0.42, 0, 0.18, 1.06)
  const glideEase = SC.ease.cubicBezier(0.5, 0, 0.2, 1.03)
  let cameraKeys = null
  function buildCameraKeys() {
    const L = SC3D.layout
    const lx = L.letters.center.x
    const lz = L.letters.center.z
    const kigali = L.kigali
    const rwanda = L.rwanda.center
    const phone = L.phone.position
    const lockup = L.lockup.position
    // k(time, subject [x,y,z], yaw°, pitch°, dist, fov°, roll°, { sx, sy, flow, ease })
    // sx/sy: where the subject sits on screen (−1…1 of the half-frame; +sx = right, +sy = up) —
    // a truck of the whole camera, so copy gets its side of the frame.
    const k = (t, target, yaw, pitch, dist, fov, roll = 0, extra = {}) => ({ t, target, yaw, pitch, dist, fov, roll, sx: 0, sy: 0, flow: 1, ...extra })
    cameraKeys = [
      // 0.0–3.2 macro, low on the letters; drift right with the pull, settle on "strettch"
      k(0.0, [lx - 0.02, 0.19, lz], -5, 2.4, 4.2, 26, -1.0, { flow: 0 }),
      k(1.0, [lx + 0.02, 0.19, lz], -4, 2.6, 4.15, 26, -0.9, { flow: 0.5 }),
      k(2.55, [lx + 0.62, 0.2, lz], 1.0, 3.2, 4.85, 26, -0.4, { flow: 0 }),
      k(3.0, [lx + 0.63, 0.2, lz], 1.1, 3.25, 4.83, 26, -0.4, { flow: 0 }), // strained hold
      k(3.45, [lx + 0.12, 0.21, lz], 0.5, 4.0, 4.3, 26, 0, { flow: 0, ease: settleEase }), // reacts to the hit
      // 3.2–5.2 arc to ¾ (flows straight into the crane); the t sits left of centre for the label
      k(5.2, [lx + 0.15, 0.22, lz - 0.05], -36, 13, 4.6, 28, 0.5, { sx: -0.08, flow: 0.55 }),
      // 5.2–7.0 crane up following the band east to the continent
      k(7.2, [1.6, 0.0, 3.93], -28.5, 38.5, 20.2, 30, 0, { sx: 0.25, flow: 0.6 }),
      // 7.0–9.0 ¾ high on Africa, slow drift (Africa right of centre: copy lives left)
      k(9.0, [1.8, 0.02, 4.05], -25, 36, 18.5, 30, 0, { sx: 0.28, flow: 0.45 }),
      // 9.0–12.8 the slow push along the band toward Kigali, lowering to a low dutch
      k(12.8, [2.55, 0.2, 2.75], -17, 7.5, 5.2, 32, 2.0, { sx: 0.22, flow: 0 }),
      // 12.8–14.0 the breath: frozen
      k(14.0, [2.55, 0.2, 2.75], -17, 7.5, 5.2, 32, 2.0, { sx: 0.22, flow: 0 }),
      // 14.0 whip + crash-push into Kigali (spring overshoot, settles by ~14.9)
      k(14.9, [kigali.x, 0.4, kigali.z], 14, 15, 1.75, 28, -1.0, { sx: 0.2, flow: 0, ease: whipCrash }),
      // 14.9–16.0 close on Kigali, slow orbit
      k(16.0, [kigali.x, 0.39, kigali.z], 21, 17, 1.6, 28, -0.6, { sx: 0.2, flow: 0.5 }),
      // 16.0–16.9 glide to the Rwanda macro (Rwanda upper right; copy lower left), drift
      k(16.9, [rwanda.x, 0.3, rwanda.z], 2, 50, 2.4, 30, 0, { sx: 0.2, sy: 0.12, flow: 0.35 }),
      k(19.0, [rwanda.x + 0.05, 0.32, rwanda.z], 8, 47, 2.25, 30, 0, { sx: 0.2, sy: 0.12, flow: 0.5 }),
      // 19.0–19.9 glide to the phone (phone right of centre), drift
      k(19.9, [phone.x, phone.y, phone.z], -24, 6, 3.35, 28, 0, { sx: 0.42, sy: 0.1, flow: 0.3 }),
      k(22.0, [phone.x - 0.03, phone.y, phone.z], -18, 5, 3.15, 28, 0, { sx: 0.42, sy: 0.1, flow: 0.4 }),
      // 22.0–24.2 pull back + rise to frame the mark assembly
      k(24.2, [lockup.x, lockup.y, lockup.z], -6, 3, 8.6, 26, 0, { sy: 0.17, flow: 0.5 }),
      // 24.2–26.0 settle into the perfect frontal lockup (lockup just above centre); hold
      k(26.0, [lockup.x, lockup.y, lockup.z], 0, 0, 7.8, 26, 0, { sy: 0.17, flow: 0 }),
      k(30.0, [lockup.x, lockup.y, lockup.z], 0, 0, 7.8, 26, 0, { sy: 0.17, flow: 0 }),
    ]
    const channels = (key) => [key.target[0], key.target[1], key.target[2], key.yaw, key.pitch, Math.log(key.dist), key.fov, key.roll, key.sx, key.sy]
    for (const key of cameraKeys) key.values = channels(key)
    cameraKeys.forEach((key, i) => {
      const prev = cameraKeys[i - 1]
      const next = cameraKeys[i + 1]
      key.tangent = key.values.map((value, c) =>
        !prev || !next || key.flow === 0 ? 0 : (key.flow * (next.values[c] - prev.values[c])) / (next.t - prev.t),
      )
    })
  }
  function evalTrack(t) {
    const keys = cameraKeys
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
    const h00 = 2 * s3 - 3 * s2 + 1
    const h10 = s3 - 2 * s2 + s
    const h01 = -2 * s3 + 3 * s2
    const h11 = s3 - s2
    return a.values.map((value, c) => h00 * value + h10 * h * a.tangent[c] + h01 * b.values[c] + h11 * h * b.tangent[c])
  }
  // Faint handheld breathing; zero in the breath and in the final hold.
  const BREATHING = [[0, 0.7], [12.4, 1], [12.8, 0], [14.0, 0], [14.9, 0.4], [15.4, 1], [24.5, 0.6], [26.5, 0.25], [27.2, 0]]
  function cameraAt(t, nudge) {
    const [tx, ty, tz, yaw0, pitch0, logDist, fov0, roll0, sx, sy] = evalTrack(t)
    const amp = SC.keyframes(t, BREATHING)
    let yaw = yaw0 + amp * 0.35 * SC.noise(t * 0.45, 11)
    let pitch = pitch0 + amp * 0.22 * SC.noise(t * 0.38, 12)
    let roll = roll0 + amp * 0.18 * SC.noise(t * 0.31, 13)
    let dist = Math.exp(logDist)
    let fov = fov0
    const target = new THREE.Vector3(tx, ty, tz)
    if (nudge) {
      if (nudge.target) target.add(toV3(nudge.target))
      yaw += nudge.yaw || 0
      pitch += nudge.pitch || 0
      roll += nudge.roll || 0
      fov += nudge.fov || 0
      dist *= nudge.dist || 1
    }
    const cp = Math.cos(pitch * DEG)
    const position = new THREE.Vector3(
      target.x + dist * Math.sin(yaw * DEG) * cp,
      target.y + dist * Math.sin(pitch * DEG),
      target.z + dist * Math.cos(yaw * DEG) * cp,
    )
    const forward = target.clone().sub(position).normalize()
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
    const up = new THREE.Vector3().crossVectors(right, forward).normalize()
    up.applyAxisAngle(forward, -roll * DEG)
    right.applyAxisAngle(forward, -roll * DEG)
    // Framing shift: truck camera + look-at so the subject lands at (sx, sy) on screen
    const halfHeight = dist * Math.tan((fov * DEG) / 2)
    const shift = right.clone().multiplyScalar(-sx * halfHeight * (SC.WIDTH / SC.HEIGHT)).addScaledVector(up, -sy * halfHeight)
    const subject = target.clone()
    position.add(shift)
    target.add(shift)
    return { position, target, subject, up, fov, roll, yaw, pitch, dist, sx, sy }
  }
  SC3D.cameraAt = (t) => cameraAt(t, null)
  // Motion-blur windows for the camera's fast moves (read by render/render.mjs).
  SC.post.motionBlurWindows.push({ from: 13.98, to: 14.55, subframes: 24 })

  // ------------------------------------------------------------------------------------------
  // Per-frame requests
  // ------------------------------------------------------------------------------------------
  const frame = { nudge: null, lights: {}, flashes: [], claims: new Set(), cameraT: null }
  SC3D.nudgeCamera = (nudge) => {
    const n = frame.nudge || (frame.nudge = { target: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, fov: 0, dist: 1 })
    if (nudge.target) for (let i = 0; i < 3; i++) n.target[i] += nudge.target[i] || 0
    n.yaw += nudge.yaw || 0
    n.pitch += nudge.pitch || 0
    n.roll += nudge.roll || 0
    n.fov += nudge.fov || 0
    n.dist *= nudge.dist || 1
    frame.cameraT = null
  }
  SC3D.light = (multipliers) => {
    for (const [name, value] of Object.entries(multipliers)) {
      if (name === 'pool') frame.lights.pool = value
      else frame.lights[name] = (frame.lights[name] ?? 1) * value
    }
  }
  SC3D.flash = (position, { intensity = 1, color = '#8A80FF', size = 1.2, light = true } = {}) => {
    if (intensity > 0.001) frame.flashes.push({ position: toV3(position).clone(), intensity, color, size, light })
  }
  SC3D.claim = (name) => frame.claims.add(name)
  // A soft wavefront of light travelling across the flat surfaces (continent, floor). One per
  // frame (last call wins). radius/width in u; intensity ~0.05–0.3.
  SC3D.shock = (center, { radius = 1, width = 0.4, intensity = 0.15, color = '#7A70FF' } = {}) => {
    frame.shock = { center: toV3(center).clone(), radius, width, intensity, color }
  }
  const OWNERS = {
    band: [[0, 's1'], [6.8, 's2'], [16.8, 'idle'], [22, 's5']],
    ring: [[0, 'idle'], [16.3, 's3'], [19.6, 'idle'], [22, 's5']],
    phone: [[0, 'idle'], [19.0, 's4'], [22, 's5']],
    phoneBand: [[0, 'idle'], [19.0, 's4'], [22, 's5']],
    continent: [[0, 'idle'], [6.5, 's2'], [16.8, 'idle'], [22, 's5']],
    capeTownPin: [[0, 'idle'], [6.5, 's2'], [16.8, 'idle'], [22, 's5']],
    rwanda: [[0, 'idle'], [6.5, 's2'], [16.5, 's3'], [19.6, 'idle'], [22, 's5']],
    kigaliPin: [[0, 'idle'], [6.5, 's2'], [16.5, 's3'], [19.6, 'idle'], [22, 's5']],
  }
  SC3D.owner = (name, t) => {
    const schedule = OWNERS[name]
    if (!schedule) return null
    let owner = schedule[0][1]
    for (const [time, id] of schedule) if (t >= time) owner = id
    return owner
  }
  // Camera for time t including this frame's nudges so far (cached per t).
  let cachedCamera = null
  function frameCamera(t) {
    if (frame.cameraT !== t || !cachedCamera) {
      cachedCamera = cameraAt(t, frame.nudge)
      frame.cameraT = t
    }
    return cachedCamera
  }
  const projector = new THREE.PerspectiveCamera(30, 16 / 9, 0.02, 400)
  SC3D.toScreen = (point, t = SC.time) => {
    const cam = frameCamera(t)
    projector.fov = cam.fov
    projector.position.copy(cam.position)
    projector.up.copy(cam.up)
    projector.lookAt(cam.target)
    projector.updateProjectionMatrix()
    projector.updateMatrixWorld(true)
    const v = toV3(point).clone().project(projector)
    return { x: (v.x * 0.5 + 0.5) * SC.WIDTH, y: (-v.y * 0.5 + 0.5) * SC.HEIGHT, behind: v.z > 1 }
  }

  // ------------------------------------------------------------------------------------------
  // Prop reset: snapshot rest state after build; restore after every frame
  // ------------------------------------------------------------------------------------------
  const restSnapshots = []
  function snapshot(object) {
    const entries = []
    object.traverse((node) => {
      const materials = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []
      entries.push({
        node,
        position: node.position.clone(),
        quaternion: node.quaternion.clone(),
        scale: node.scale.clone(),
        visible: node.visible,
        materials: materials.map((material) => ({
          material,
          color: material.color ? material.color.clone() : null,
          emissive: material.emissive ? material.emissive.clone() : null,
          emissiveIntensity: material.emissiveIntensity,
          opacity: material.opacity,
          envMapIntensity: material.envMapIntensity,
        })),
      })
    })
    restSnapshots.push(entries)
  }
  function restoreAll() {
    for (const entries of restSnapshots) {
      for (const entry of entries) {
        entry.node.position.copy(entry.position)
        entry.node.quaternion.copy(entry.quaternion)
        entry.node.scale.copy(entry.scale)
        entry.node.visible = entry.visible
        for (const m of entry.materials) {
          if (m.color) m.material.color.copy(m.color)
          if (m.emissive) m.material.emissive.copy(m.emissive)
          m.material.emissiveIntensity = m.emissiveIntensity
          m.material.opacity = m.opacity
          if (m.envMapIntensity !== undefined) m.material.envMapIntensity = m.envMapIntensity
        }
      }
    }
  }
  const cloneMaterials = (object) =>
    object.traverse((node) => {
      if (node.material) node.material = Array.isArray(node.material) ? node.material.map((m) => m.clone()) : node.material.clone()
    })

  // ------------------------------------------------------------------------------------------
  // Build the world (onInit)
  // ------------------------------------------------------------------------------------------
  const sceneGroups = []
  SC3D.sceneGroup = (root, name = 'scene') => {
    const group = new THREE.Group()
    group.name = name
    SC3D.world.add(group)
    sceneGroups.push({ group, root })
    return group
  }

  // ------------------------------------------------------------------------------------------
  // Studio reflections without cube-UV lookups. PMREM sampling costs ~200 ms/frame in SwiftShader
  // on letter-heavy shots, so the PMREM studio is baked once into a view-space "matcap" atlas:
  // 7 roughness levels (a white metal sphere) + 1 irradiance level (a white rough sphere), and
  // every MeshStandard/Physical material reads it (2–5 plain fetches) as its IBL radiance,
  // irradiance and clearcoat radiance — three's own BRDF/Fresnel still applies. The studio is
  // baked as seen by a camera looking north, and stays locked to the camera (like a rig that
  // travels with it). Materials with an explicit `envMap` keep the regular PMREM path.
  // Intensity = material.envMapIntensity × the global studio factor (light-up, SC3D.light({env})).
  // ------------------------------------------------------------------------------------------
  const MATCAP_LEVELS = [0.04, 0.12, 0.22, 0.34, 0.48, 0.65, 0.85]
  const studio = { atlas: null, factor: 1 }
  function bakeStudioAtlas(renderer, envTexture) {
    const size = 256
    const levels = MATCAP_LEVELS.length + 1
    const atlas = new THREE.WebGLRenderTarget(size, size * levels, { type: THREE.HalfFloatType, depthBuffer: true })
    atlas.texture.minFilter = THREE.LinearFilter
    atlas.texture.magFilter = THREE.LinearFilter
    atlas.texture.generateMipmaps = false
    const bakeScene = new THREE.Scene()
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96))
    bakeScene.add(sphere)
    const bakeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    bakeCamera.position.set(0, 0, 4)
    bakeCamera.lookAt(0, 0, 0)
    const previousTarget = renderer.getRenderTarget()
    const previousColor = renderer.getClearColor(new THREE.Color())
    const previousAlpha = renderer.getClearAlpha()
    renderer.setClearColor(0x000000, 1)
    for (let level = 0; level < levels; level++) {
      const irradiance = level === MATCAP_LEVELS.length
      sphere.material = new THREE.MeshStandardMaterial({
        color: 0xffffff, metalness: irradiance ? 0 : 1, roughness: irradiance ? 1 : MATCAP_LEVELS[level], envMap: envTexture,
      })
      atlas.viewport.set(0, level * size, size, size)
      atlas.scissor.set(0, level * size, size, size)
      atlas.scissorTest = true
      renderer.setRenderTarget(atlas)
      renderer.clear()
      renderer.render(bakeScene, bakeCamera)
      sphere.material.dispose()
    }
    atlas.scissorTest = false
    renderer.setRenderTarget(previousTarget)
    renderer.setClearColor(previousColor, previousAlpha)
    sphere.geometry.dispose()
    studio.atlas = atlas.texture
  }
  const STUDIO_PARS = `
    uniform sampler2D scStudio;
    uniform float scStudioIntensity;
    vec2 scStudioUv( vec3 normal, vec3 viewDir ) {
      vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
      vec3 y = cross( viewDir, x );
      return vec2( dot( x, normal ), dot( y, normal ) ) * 0.49 + 0.5;
    }
    vec3 scStudioLevel( vec2 uv, float level ) {
      return texture2D( scStudio, vec2( uv.x, ( uv.y + level ) / ${MATCAP_LEVELS.length + 1}.0 ) ).rgb;
    }
    vec3 scStudioRadiance( vec2 uv, float roughness ) {
      float r = clamp( roughness, ${MATCAP_LEVELS[0].toFixed(2)}, ${MATCAP_LEVELS[MATCAP_LEVELS.length - 1].toFixed(2)} );
      float level = 0.0;
      ${MATCAP_LEVELS.slice(1).map((value, i) => `if ( r > ${MATCAP_LEVELS[i].toFixed(2)} ) level = ${i}.0 + ( r - ${MATCAP_LEVELS[i].toFixed(2)} ) / ${(value - MATCAP_LEVELS[i]).toFixed(2)};`).join(' ')}
      float lower = floor( level );
      return mix( scStudioLevel( uv, lower ), scStudioLevel( uv, min( lower + 1.0, ${MATCAP_LEVELS.length - 1}.0 ) ), level - lower );
    }`
  const STUDIO_MAPS = `
    #if !defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
    {
      vec3 scView = normalize( vViewPosition );
      vec2 scUv = scStudioUv( geometryNormal, scView );
      radiance += scStudioRadiance( scUv, material.roughness ) * scStudioIntensity;
      iblIrradiance += scStudioLevel( scUv, ${MATCAP_LEVELS.length}.0 ) * PI * scStudioIntensity;
      #ifdef USE_CLEARCOAT
        clearcoatRadiance += scStudioRadiance( scStudioUv( geometryClearcoatNormal, scView ), material.clearcoatRoughness ) * scStudioIntensity;
      #endif
    }
    #endif`
  function injectStudio(shader, material) {
    if (!studio.atlas || !shader.fragmentShader.includes('#include <lights_fragment_maps>')) return
    shader.uniforms.scStudio = { value: studio.atlas }
    shader.uniforms.scStudioIntensity = { get value() { return material.envMapIntensity * studio.factor } }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_physical_pars_fragment>', `#include <lights_physical_pars_fragment>\n${STUDIO_PARS}`)
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>\n${STUDIO_MAPS}`)
  }
  THREE.MeshStandardMaterial.prototype.onBeforeCompile = function (shader) { injectStudio(shader, this) }
  SC3D.studio = studio

  // Cheaper soft shadows for every built-in material: replace three's 16-fetch PCFSoft kernel
  // with a 4-fetch bilinear PCF (smooth 1-texel penumbra; the objects' shadows are small on screen).
  // The big flat surfaces use their own wider 8-tap sampler (flat-lit material).
  function patchShadowChunk() {
    const chunk = THREE.ShaderChunk.shadowmap_pars_fragment
    const start = chunk.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )')
    const end = chunk.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )')
    if (start < 0 || end < 0) return
    const bilinear = `#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			vec2 st = shadowCoord.xy * shadowMapSize - 0.5;
			vec2 f = fract( st );
			vec2 uv = ( floor( st ) + 0.5 ) * texelSize;
			shadow = mix(
				mix( texture2DCompare( shadowMap, uv, shadowCoord.z ), texture2DCompare( shadowMap, uv + vec2( texelSize.x, 0.0 ), shadowCoord.z ), f.x ),
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, texelSize.y ), shadowCoord.z ), texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ), f.x ),
				f.y );
		`
    THREE.ShaderChunk.shadowmap_pars_fragment = chunk.slice(0, start) + bilinear + chunk.slice(end)
  }
  patchShadowChunk()

  SC.onInit(async (stage) => {
    const canvas = document.createElement('canvas')
    canvas.className = 'sc-webgl'
    canvas.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px;z-index:0;display:block'
    stage.prepend(canvas)
    const debug = new URLSearchParams(location.search)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: debug.get('aa') !== '0', preserveDrawingBuffer: true, stencil: false, powerPreference: 'high-performance' })
    const pixelRatio = clamp(window.devicePixelRatio || 1, 0.25, 2)
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(SC.WIDTH, SC.HEIGHT, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setClearColor(WORLD.BG, 1)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(WORLD.BG)
    scene.fog = new THREE.Fog(WORLD.BG, 10, 40) // linear; starts just behind the subject (set per frame)
    const camera = new THREE.PerspectiveCamera(30, SC.WIDTH / SC.HEIGHT, 0.03, 400)
    const world = new THREE.Group()
    world.name = 'world'
    scene.add(world)
    Object.assign(SC3D, { renderer, scene, camera, world, canvas })

    buildMaterials()
    // IBL only on the hero materials (small screen area): PMREM lookups are the most expensive
    // thing in SwiftShader (~430 ms/frame if the floor and continent use them too).
    const envTexture = buildEnvironment(renderer)
    SC3D.envMap = envTexture // the PMREM studio (assign as material.envMap only if you need true IBL)
    bakeStudioAtlas(renderer, envTexture)
    SC3D.materials.continentInk.envMapIntensity = 0 // matte map edges: no studio reflections

    // Studio floor

    // Light rig: 3 lights, constant count (each light costs ~35 ms/frame in SwiftShader; only
    // intensities/positions change per frame). The cool fill lives in the hemi + the IBL.
    const hemi = new THREE.HemisphereLight('#8A8698', '#0B0A10', 0.35)
    // The key is a spot placed relative to the shot size: a real falloff pool + gradients across
    // flat faces (a directional key lights every face flat).
    const key = new THREE.SpotLight('#FFF1E0', 10, 0, 38 * DEG, 0.85, 2)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.bias = -0.00025
    key.shadow.normalBias = 0.008
    key.shadow.focus = 1
    const rim = new THREE.DirectionalLight('#7466FF', 2.2)
    scene.add(hemi, key, key.target, rim, rim.target)
    const flashSprites = Array.from({ length: 6 }, () => {
      const sprite = makeGlow({ opacity: 0 })
      sprite.visible = false
      scene.add(sprite)
      return sprite
    })
    SC3D.lights = { hemi, key, rim }
    // quarter-res: the bilinear upsample is part of the satin blur (and it's ~4× cheaper)
    // Quarter res, 8-bit sRGB (hardware-decoded; half-float sampling is slow in SwiftShader),
    // blurred in place by a separable Gaussian so the big surfaces need a single bilinear tap.
    const mirrorScale = Number(new URLSearchParams(location.search).get('mirrorScale') || 0.25)
    const mirrorSize = [Math.round(SC.WIDTH * pixelRatio * mirrorScale), Math.round(SC.HEIGHT * pixelRatio * mirrorScale)]
    const mirrorTarget = new THREE.WebGLRenderTarget(mirrorSize[0], mirrorSize[1], { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace })
    const mirrorBlurTarget = new THREE.WebGLRenderTarget(mirrorSize[0], mirrorSize[1], { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, depthBuffer: false })
    const blurMaterial = new THREE.ShaderMaterial({
      uniforms: { uSource: { value: null }, uStep: { value: new THREE.Vector2() } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D uSource; uniform vec2 uStep; varying vec2 vUv;
        void main() {
          vec3 c = texture2D(uSource, vUv).rgb * 0.2270;
          c += (texture2D(uSource, vUv + uStep * 1.3846).rgb + texture2D(uSource, vUv - uStep * 1.3846).rgb) * 0.3162;
          c += (texture2D(uSource, vUv + uStep * 3.2308).rgb + texture2D(uSource, vUv - uStep * 3.2308).rgb) * 0.0703;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    const blurQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMaterial)
    blurQuad.frustumCulled = false
    const blurScene = new THREE.Scene()
    blurScene.add(blurQuad)
    const blurCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const blurMirror = () => {
      blurMaterial.uniforms.uSource.value = mirrorTarget.texture
      blurMaterial.uniforms.uStep.value.set(0.5 / mirrorSize[0], 0)
      renderer.setRenderTarget(mirrorBlurTarget)
      renderer.render(blurScene, blurCamera)
      blurMaterial.uniforms.uSource.value = mirrorBlurTarget.texture
      blurMaterial.uniforms.uStep.value.set(0, 0.5 / mirrorSize[1])
      renderer.setRenderTarget(mirrorTarget)
      renderer.render(blurScene, blurCamera)
    }
    const mirrorCamera = new THREE.PerspectiveCamera()
    rigUniforms.uMirror.value = mirrorTarget.texture
    rigUniforms.uMirrorTexel.value.set(1 / mirrorTarget.width, 1 / mirrorTarget.height)

    // ---- Layout
    const L = SC3D.layout
    L.surfaceY = WORLD.SURFACE
    L.letters = { center: new THREE.Vector3(-9.2, 0, 3.2), right: new THREE.Vector3(1, 0, 0), scale: WORLD.LETTER_SCALE }
    L.kigali = project(...window.SC_GEO.cities.kigali, WORLD.SURFACE)
    L.capeTown = project(...window.SC_GEO.cities.capeTown, WORLD.SURFACE)
    const rwandaLonLat = rwandaRing()
    const rwandaWorld = rwandaLonLat.map(([lon, lat]) => project(lon, lat, WORLD.SURFACE))
    const rwandaCenter = rwandaWorld.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / rwandaWorld.length)
    L.rwanda = { center: rwandaCenter, outline: rwandaWorld }
    L.phone = { position: new THREE.Vector3(5.15, 0.8, 0.75) }
    L.lockup = { position: new THREE.Vector3(3.55, 3.0, 0.3), scale: WORLD.LOCKUP_SCALE }

    // ---- Continent (one slab, Rwanda cut out) + Rwanda slab
    const toShapePoint = ([lon, lat]) => {
      const p = project(lon, lat)
      return new THREE.Vector2(p.x, -p.z)
    }
    const outline = africaOutline()
    const shapes = outline.map((ring) => new THREE.Shape(ring.map(toShapePoint)))
    const rwandaPath = new THREE.Path(rwandaLonLat.map(toShapePoint))
    shapes[0].holes.push(rwandaPath)
    const slabBevel = 0.018
    const slabOptions = (depth) => ({
      depth, bevelEnabled: true, bevelThickness: slabBevel, bevelSize: slabBevel, bevelOffset: -slabBevel, bevelSegments: 2, curveSegments: 1, steps: 1,
    })
    const flatten = (geometry) => {
      geometry.rotateX(-Math.PI / 2)
      geometry.translate(0, slabBevel, 0)
      // toCreasedNormals hashes positions at 0.01 precision: crease in a ×100 space.
      geometry.scale(100, 100, 100)
      const creased = flatCaps(BufferGeometryUtils.toCreasedNormals(geometry, 40 * DEG), 1)
      creased.scale(0.01, 0.01, 0.01)
      geometry.dispose()
      return indexed(creased)
    }
    // material[0] = the flat top (flat-lit, cheap), material[1] = the bevelled coast walls (Standard)
    const slabMaterials = () => [makeFlatLitMaterial({ name: 'continentTop', color: '#3A3840', pool: 0.8, sheen: 1.4, sheenPower: 12 }), SC3D.materials.continentInk.clone()]
    const continent = new THREE.Mesh(flatten(new THREE.ExtrudeGeometry(shapes, slabOptions(WORLD.SURFACE - slabBevel * 2))), slabMaterials())
    continent.name = 'continent'
    continent.receiveShadow = true
    continent.castShadow = false // a 0.1 u slab's shadow is invisible; casting it fills the whole shadow map
    continent.renderOrder = 1
    const rwandaGeometry = flatten(new THREE.ExtrudeGeometry(new THREE.Shape(rwandaLonLat.map(toShapePoint)), slabOptions(WORLD.SURFACE - slabBevel * 2)))
    const rwanda = new THREE.Mesh(rwandaGeometry, slabMaterials())
    rwanda.name = 'rwanda'
    rwanda.castShadow = true
    rwanda.receiveShadow = true
    world.add(continent, rwanda)
    // Floor with the continent cut out, plus a floor patch at the bottom of the Rwanda hole
    const floor = buildFloor(outline.map((ring) => ring.map(toShapePoint)))
    const rwandaFloor = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(rwandaLonLat.map(toShapePoint)), 1), floor.material)
    rwandaFloor.rotation.x = -Math.PI / 2
    rwandaFloor.position.y = 0.0005
    rwandaFloor.receiveShadow = true
    world.add(floor, rwandaFloor)

    // ---- Pins
    const kigaliPin = makePin(SC3D.materials.violetGloss)
    kigaliPin.position.copy(L.kigali)
    const capeTownPin = makePin(SC3D.materials.slateMatte)
    capeTownPin.position.copy(L.capeTown)
    world.add(kigaliPin, capeTownPin)

    // ---- Bands and phone
    const band = makeElasticBand({ name: 'hero-band' })
    const ring = makeElasticBand({ name: 'rwanda-ring', closed: true, segments: 220, radial: 10 })
    const phone = makePhone()
    phone.group.position.copy(L.phone.position)
    phone.group.visible = false
    const phoneBand = makeElasticBand({ name: 'phone-band', closed: true, segments: 120, radial: 10 })
    world.add(band.mesh, ring.mesh, phone.group, phoneBand.mesh)

    const props = SC3D.props
    Object.assign(props, { continent, rwanda, kigaliPin, capeTownPin, band, ring, phone, phoneBand })
    for (const object of [continent, rwanda, kigaliPin, capeTownPin, phone.group]) {
      cloneMaterials(object)
      snapshot(object)
    }
    for (const slab of [continent, rwanda]) {
      slab.userData.top = slab.material[0]
      slab.userData.edge = slab.material[1]
    }
    for (const b of [band, ring, phoneBand]) b.mesh.material = SC3D.materials.violetGloss.clone()
    for (const b of [band, ring, phoneBand]) b.mesh.children.forEach((cap) => (cap.material = b.mesh.material))
    for (const b of [band, ring, phoneBand]) snapshot(b.mesh)

    // ---- Canonical poses (continuity between scenes)
    const tmp = new THREE.Vector3()
    SC3D.poses.kigaliCoil = (t) => {
      kigaliPin.updateMatrixWorld(true)
      const base = kigaliPin.getWorldPosition(tmp).clone()
      const settle = Math.exp(-Math.max(0, t - 14.3) / 0.55)
      return {
        points: coilPoints(base, { radius: 0.03, turns: 2.4, y0: 0.07, y1: 0.19, count: 80, wobble: 0.35 * settle * (t >= 14.0 ? 1 : 0), t }),
        radius: 0.016,
      }
    }
    SC3D.poses.rwandaRing = (t, { offset = 0.012, lift = 0.012 } = {}) => {
      rwanda.updateMatrixWorld(true)
      const outlinePoints = L.rwanda.outline
      const count = outlinePoints.length
      let area = 0
      for (let i = 0; i < count; i++) {
        const a = outlinePoints[i]
        const b = outlinePoints[(i + 1) % count]
        area += a.x * b.z - b.x * a.z
      }
      const sign = area > 0 ? -1 : 1
      const points = []
      const step = Math.max(1, Math.floor(count / 110))
      for (let i = 0; i < count; i += step) {
        const p = outlinePoints[i]
        const prev = outlinePoints[(i - step + count) % count]
        const next = outlinePoints[(i + step) % count]
        const tangent = next.clone().sub(prev)
        const outward = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize().multiplyScalar(sign)
        const local = p.clone().addScaledVector(outward, offset)
        local.y = WORLD.SURFACE + lift
        points.push(local.applyMatrix4(rwanda.matrixWorld))
      }
      return { points, radius: 0.011 }
    }
    SC3D.poses.phoneBand = (t) => {
      phone.group.updateMatrixWorld(true)
      const w = phone.width / 2 + 0.012
      const d = phone.depth / 2 + 0.012
      const y = -0.16
      const points = []
      const corners = 28
      for (let i = 0; i < corners; i++) {
        const angle = (i / corners) * Math.PI * 2
        const x = Math.sign(Math.cos(angle)) * Math.pow(Math.abs(Math.cos(angle)), 0.25) * w
        const z = Math.sign(Math.sin(angle)) * Math.pow(Math.abs(Math.sin(angle)), 0.25) * d
        points.push(new THREE.Vector3(x, y, z).applyMatrix4(phone.group.matrixWorld))
      }
      return { points, radius: 0.012 }
    }
    const idle = {
      band: (t) => {
        if (t >= 14.3) {
          const pose = SC3D.poses.kigaliCoil(t)
          band.update(pose.points, pose.radius)
        }
      },
      ring: (t) => {
        if (t >= 17.0) {
          const pose = SC3D.poses.rwandaRing(t)
          ring.update(pose.points, pose.radius)
        }
      },
      phone: (t) => {
        phone.group.visible = t >= 19.3
      },
      phoneBand: (t) => {
        if (t >= 20.0) {
          const pose = SC3D.poses.phoneBand(t)
          phoneBand.update(pose.points, pose.radius)
        }
      },
    }
    SC3D._idle = idle

    // ---- Per-frame draw
    const LIGHT_UP = [[0, 0], [0.12, 0.06], [1.1, 1, 'outCubic']]
    // LOOK track — per-beat art direction of the rig. az/el: key azimuth (relative to 0.7 × camera
    // yaw) and elevation in degrees; key: illuminance at the target; rim, hemi: multipliers;
    // exposure: tone-mapping exposure.
    const LOOK = [
      // reflect: satin-floor reflection strength (0 skips the mirror pass); mirrorY: mirror plane
      [0.0, { az: -42, el: 9, key: 4.6, rim: 1.0, hemi: 1.0, exposure: 1.0, reflect: 0.28, mirrorY: 0 }],
      [1.4, { az: -42, el: 42, key: 4.6, rim: 1.0, hemi: 1.0, exposure: 1.0, reflect: 0.28, mirrorY: 0 }, 'outCubic'],
      [5.2, { az: -45, el: 45, key: 4.4, rim: 1.0, hemi: 1.0, exposure: 1.0, reflect: 0.28, mirrorY: 0 }],
      [6.4, { az: -50, el: 50, key: 4.6, rim: 1.05, hemi: 1.05, exposure: 1.03, reflect: 0, mirrorY: 0.1 }],
      [7.0, { az: -40, el: 64, key: 5.0, rim: 1.1, hemi: 1.1, exposure: 1.05, reflect: 0, mirrorY: 0.1 }],
      [9.0, { az: -44, el: 60, key: 5.0, rim: 1.1, hemi: 1.1, exposure: 1.05, reflect: 0, mirrorY: 0.1 }],
      [11.0, { az: -60, el: 40, key: 4.7, rim: 1.25, hemi: 1.0, exposure: 1.02, reflect: 0.16, mirrorY: 0.1 }],
      [12.8, { az: -64, el: 34, key: 4.6, rim: 1.35, hemi: 0.9, exposure: 1.0, reflect: 0.18, mirrorY: 0.1 }], // low raking key for the push
      [14.0, { az: -64, el: 34, key: 4.6, rim: 1.35, hemi: 0.9, exposure: 1.0, reflect: 0.18, mirrorY: 0.1 }],
      [14.9, { az: -46, el: 46, key: 4.4, rim: 1.2, hemi: 1.0, exposure: 1.0, reflect: 0.18, mirrorY: 0.1 }],
      [16.4, { az: -42, el: 52, key: 4.4, rim: 1.12, hemi: 1.0, exposure: 1.0, reflect: 0, mirrorY: 0.1 }],
      [16.9, { az: -40, el: 55, key: 4.4, rim: 1.1, hemi: 1.0, exposure: 1.0, reflect: 0, mirrorY: 0.1 }],
      [19.2, { az: -39, el: 45, key: 4.3, rim: 1.15, hemi: 1.0, exposure: 1.0, reflect: 0, mirrorY: 0.1 }],
      [19.9, { az: -38, el: 36, key: 4.2, rim: 1.2, hemi: 1.0, exposure: 1.0, reflect: 0.2, mirrorY: 0.1 }],
      [22.0, { az: -38, el: 36, key: 4.2, rim: 1.2, hemi: 1.0, exposure: 1.0, reflect: 0.18, mirrorY: 0.1 }],
      [23.6, { az: -36, el: 35, key: 3.8, rim: 1.4, hemi: 0.85, exposure: 1.0, reflect: 0, mirrorY: 0.1 }],
      [25.0, { az: -34, el: 34, key: 3.6, rim: 1.5, hemi: 0.8, exposure: 1.0, reflect: 0, mirrorY: 0.1 }],
      [26.5, { az: -32, el: 32, key: 3.6, rim: 1.6, hemi: 0.75, exposure: 1.0, reflect: 0, mirrorY: 0.1 }],
    ]
    const LOOK_FIELDS = Object.keys(LOOK[0][1])
    const lookTracks = Object.fromEntries(LOOK_FIELDS.map((field) => [field, LOOK.map(([time, values, ease]) => (ease ? [time, values[field], ease] : [time, values[field], 'inOutCubic']))]))
    const lookAt = (t) => Object.fromEntries(LOOK_FIELDS.map((field) => [field, SC.keyframes(t, lookTracks[field])]))
    SC3D.lookAt = lookAt
    SC.afterRender((t) => {
      // Idle poses for unclaimed props
      for (const name of Object.keys(idle)) {
        const owner = SC3D.owner(name, t)
        const bandLike = props[name] && props[name].update
        const driven = frame.claims.has(name) || (bandLike && props[name].touched)
        if (!driven && (owner === 'idle' || !soloActive(owner))) idle[name](t)
      }
      // Scene groups follow their scene's visibility
      for (const { group, root } of sceneGroups) group.visible = root.style.display !== 'none'
      // Bands not updated this frame are hidden
      for (const b of allBands) if (!b.touched) b.mesh.visible = false

      // Camera
      const cam = frameCamera(t)
      camera.fov = cam.fov
      camera.position.copy(cam.position)
      camera.up.copy(cam.up)
      camera.lookAt(cam.target)
      camera.updateProjectionMatrix()

      // Light rig follows the camera target; directions follow the camera yaw (70%).
      const m = frame.lights
      const lightUp = SC.keyframes(t, LIGHT_UP)
      const look = lookAt(t)
      const focus = cam.subject
      const rigYaw = cam.yaw * 0.7
      const dist = cam.dist
      // Flash boost: the strongest impact of the frame kicks the rim and lifts the key a touch.
      const flashBoost = frame.flashes.reduce((max, f) => Math.max(max, f.light ? f.intensity : 0), 0)
      // Key: warm spot, front-left and high; rakes up from a grazing angle in the first second.
      const keyElevation = look.el * DEG
      const keyAzimuth = (rigYaw + look.az) * DEG
      const keyDir = new THREE.Vector3(Math.sin(keyAzimuth) * Math.cos(keyElevation), Math.sin(keyElevation), Math.cos(keyAzimuth) * Math.cos(keyElevation))
      const keyDistance = clamp(dist * 1.0, 2.4, 26)
      key.position.copy(focus).addScaledVector(keyDir, keyDistance)
      key.target.position.copy(focus)
      key.distance = keyDistance * 4
      const keyIlluminance = look.key * lightUp * (m.key ?? 1) * (1 + 0.25 * flashBoost)
      key.intensity = keyIlluminance * keyDistance * keyDistance
      key.shadow.camera.near = keyDistance * 0.25
      // Flat-lit shadow blur: ~0.02 u at macro growing with shot size, expressed in texels
      const texelWorld = (2 * keyDistance * Math.tan(key.angle)) / key.shadow.mapSize.x
      shadowSoftness.value = clamp((0.01 + 0.0032 * dist) / texelWorld, 1.2, 9)

      const rimAzimuth = (cam.yaw + 180 + 24) * DEG
      const rimElevation = 22 * DEG
      rim.position.copy(focus).add(new THREE.Vector3(Math.sin(rimAzimuth) * Math.cos(rimElevation), Math.sin(rimElevation), Math.cos(rimAzimuth) * Math.cos(rimElevation)).multiplyScalar(10))
      rim.target.position.copy(focus)
      rim.intensity = 2.2 * look.rim * SC.keyframes(t, [[0, 0.2], [0.7, 1, 'inOutCubic']]) * (m.rim ?? 1) * (1 + 1.2 * flashBoost)

      hemi.intensity = 0.35 * look.hemi * (0.3 + 0.7 * lightUp) * (m.fill ?? 1)
      // Flat-lit surfaces: constant irradiance from the rig (normal +Y)
      rigUniforms.uAmbient.value.copy(hemi.color).multiplyScalar(hemi.intensity)
        .add(rim.color.clone().multiplyScalar(rim.intensity * Math.sin(rimElevation)))
      rigUniforms.uKeyPos.value.copy(key.position)
      rigUniforms.uKeyAxis.value.copy(focus).sub(key.position).normalize()
      rigUniforms.uKeyColor.value.copy(key.color).multiplyScalar(key.intensity)
      rigUniforms.uKeyCone.value.set(Math.cos(key.angle), Math.cos(key.angle * (1 - key.penumbra)))
      rigUniforms.uKeyRange.value.set(key.distance, key.decay)
      rigUniforms.uKeySpecular.value = 0.03 * (m.sheen ?? 1)
      const strongestFlash = frame.flashes.reduce((best, f) => (f.light && (!best || f.intensity > best.intensity) ? f : best), null)
      if (strongestFlash) {
        rigUniforms.uFlashPos.value.copy(strongestFlash.position)
        rigUniforms.uFlashPos.value.y = Math.max(rigUniforms.uFlashPos.value.y, WORLD.SURFACE + 0.12)
        rigUniforms.uFlashColor.value.set(strongestFlash.color).multiplyScalar(2.2 * strongestFlash.intensity * strongestFlash.size * strongestFlash.size)
      } else rigUniforms.uFlashColor.value.setRGB(0, 0, 0)
      const shock = frame.shock
      rigUniforms.uShock.value.set(shock ? shock.radius : 0, shock ? Math.max(0.01, shock.width) : 0.3, shock ? shock.intensity : 0, 0)
      if (shock) {
        rigUniforms.uShockCenter.value.copy(shock.center)
        rigUniforms.uShockColor.value.set(shock.color)
      }
      studio.factor = (0.3 + 0.7 * lightUp) * (m.env ?? 1)
      renderer.toneMappingExposure = look.exposure * (m.exposure ?? 1)

      // Floor pool
      const pool = m.pool || {}
      poolUniforms.uPoolCenter.value.set(pool.x ?? focus.x, pool.z ?? focus.z)
      poolUniforms.uPoolRadius.value.set((pool.inner ?? dist * 0.35) * lerp(0.4, 1, lightUp), pool.outer ?? dist * 1.45)
      poolUniforms.uPoolFloor.value = pool.floor ?? 0.12

      // Fog starts just behind the subject and scales with shot size, so the subject stays clean
      // and the horizon (and anything far behind) dissolves into the studio black.
      const fogScale = m.fog ?? 1
      scene.fog.near = dist * 1.15 / fogScale
      scene.fog.far = dist * 3.6 / fogScale

      // Flashes
      frame.flashes.sort((a, b) => b.intensity - a.intensity)
      flashSprites.forEach((sprite, index) => {
        const f = frame.flashes[index]
        sprite.visible = !!f
        if (!f) return
        sprite.position.copy(f.position)
        sprite.scale.setScalar(f.size)
        sprite.material.color.set(f.color)
        sprite.material.opacity = clamp(f.intensity, 0, 2)
      })

      // Satin reflection: half-res mirror pass of the objects (flat-lit surfaces hidden), reusing
      // the shadow map for the main pass. Skipped when the LOOK track's reflect is 0.
      const timing = window.__scTiming
      const sync = () => { if (timing) { const px = new Uint8Array(4); const gl = renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return performance.now() } return 0 }
      const t0 = sync()
      const reflectStrength = look.reflect * (m.reflect ?? 1) * DEBUG_REFLECT
      rigUniforms.uMirrorStrength.value = reflectStrength
      setFlatMirror(reflectStrength > 0.001)
      if (reflectStrength > 0.001) {
        const planeY = look.mirrorY
        mirrorCamera.copy(camera)
        mirrorCamera.position.y = 2 * planeY - camera.position.y
        const mirroredTarget = cam.target.clone()
        mirroredTarget.y = 2 * planeY - mirroredTarget.y
        mirrorCamera.up.set(cam.up.x, -cam.up.y, cam.up.z)
        mirrorCamera.lookAt(mirroredTarget)
        mirrorCamera.updateMatrixWorld(true)
        mirrorCamera.updateProjectionMatrix()
        rigUniforms.uMirrorMatrix.value.multiplyMatrices(mirrorCamera.projectionMatrix, mirrorCamera.matrixWorldInverse)
        const hidden = []
        scene.traverseVisible((node) => {
          if (node.isMesh && (node.material?.userData?.flatLit || (Array.isArray(node.material) && node.material[0]?.userData?.flatLit))) hidden.push(node)
        })
        for (const node of hidden) node.visible = false
        for (const sprite of flashSprites) sprite.visible = false
        const savedFog = scene.fog
        scene.fog = null
        renderer.setRenderTarget(mirrorTarget)
        renderer.render(scene, mirrorCamera)
        blurMirror()
        renderer.setRenderTarget(null)
        scene.fog = savedFog
        for (const node of hidden) node.visible = true
        flashSprites.forEach((sprite, index) => (sprite.visible = !!frame.flashes[index]))
        renderer.shadowMap.autoUpdate = false
        renderer.shadowMap.needsUpdate = false
      }
      const t1 = sync()
      renderer.render(scene, camera)
      renderer.shadowMap.autoUpdate = true
      const t2 = sync()
      if (timing) timing.push({ t, mirror: t1 - t0, main: t2 - t1 })

      // Reset for the next frame (frames are rendered out of order)
      restoreAll()
      for (const b of allBands) b.touched = false
      frame.nudge = null
      frame.lights = {}
      frame.flashes = []
      frame.shock = null
      frame.claims.clear()
      frame.cameraT = null
    })

    buildCameraKeys()
  })

  // In --solo renders only one scene builds; props owned by absent scenes fall back to idle.
  const soloId = new URLSearchParams(location.search).get('solo')
  const SCENE_IDS = { s1: 's1-name', s2: 's2-far-home', s3: 's3-data', s4: 's4-money', s5: 's5-mark' }
  function soloActive(owner) {
    if (!soloId || !owner || owner === 'idle') return true
    return SCENE_IDS[owner] === soloId
  }
})()
