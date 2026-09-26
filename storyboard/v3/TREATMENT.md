# Strettch Cloud — "The Extra Push" · 30 s · v3 treatment

**Audience:** prospective Strettch Cloud customers (developers and businesses in Africa).
**Goal:** a modern, premium 3D product film that stuns, and leaves one idea: *Strettch Cloud is close — so it's fast, your data stays home, and you pay locally.*
**Why v3:** the v2 cut was judged "a template with some authored transitions" (4/10): stock SaaS kit
(dot map, arcs, counters, cursor, warp zoom, radar rings, logo shine), a feature list instead of
an argument, flat 2D at one depth, the best idea dropped after 1.6 s. v3 fixes the concept, not the polish.

## The idea
The brand's own idea — **stretch** and the extra push — becomes the physics of the whole film.
Everything that is *far* is a glossy violet elastic band pulled thin and trembling. Strettch Cloud
is the **snap home**. Three snaps = three proofs of "close" = the **three slabs of the logo**.

## Format
30.000 s · 1920×1080 · 60 fps · 120 BPM (bar = 2 s, downbeats on even seconds).
**One peak** at **14.000** (the snap), preceded by the film's only **breath** (12.8–14.0 stillness).
Real 3D (three.js, WebGL2) for every object; a 2D overlay only for copy. **One continuous camera — no cuts.**

## Beat sheet
| Time | Beat | What we see | Copy (fully legible window) |
|---|---|---|---|
| 0.0–1.0 | Light up | Dark studio. A key light rakes up across a satin floor. Macro, low camera: the 3D brand letters **s t r e t c h** (extruded from the real wordmark glyphs, ink-satin) threaded on a glossy violet elastic band, anchored by two violet pins. | — |
| 1.0–2.5 | Pull | An off-screen force drags the right anchor away. "ch" slides out, "stret" resists, the band stretches and **thins**, trembling; letters lean with strain. | — |
| 3.0 | **The extra t** | A glossy **violet t** (the only violet letter) drops from above into the gap, squashes on landing; the band snaps taut: **strettch**. Hit. | — |
| 3.2–5.2 | Name | Camera arcs to a clean ¾ view. | *the extra push.* (Instrument Serif italic, with a fine leader line to the t) 3.6–5.2 |
| 5.2–7.0 | Carry | The violet band slips free and zips away across the floor; the camera cranes up and follows it to the continent. Physical transition — no cut. | — |
| 7.0–9.0 | Far | **Africa** as a large extruded matte slab on the studio floor. **Kigali:** glossy violet pin. **Cape Town:** matte slate pin. The band is hooked at Kigali and dragged south to Cape Town, lifting off the surface, thin, casting a moving shadow. | kicker *Cape Town · nearest hyperscaler region* · **~110 ms** (Inter ~250 weight, stretched wide = far) · *per request* — from 9.0 |
| 9.0–12.8 | Strain | Tremble grows. At 10.5 the tension spikes: the number swells to 200 and back. Camera: **slow** push along the band toward Kigali, lowering to a dramatic low angle — the film's one slow move. | adds *peaks at 200 ms* — from 11.0 |
| 12.8–14.0 | **Breath** | Everything freezes at max tension. Near silence. | (holds) |
| **14.0** | **SNAP** | Cape Town's pin pops. The band recoils home to Kigali with overshoot; the camera whips with it and crash-pushes into Kigali; a shock ripples out across the continent; violet light flares at impact. **Biggest hit of the film.** | far copy clears on the snap |
| 14.3–16.5 | Home | Close on Kigali: the band coils tight around the pin, vibrating out. | kicker *Strettch Cloud · Kigali-1* · **10–30 ms** (Inter 900, dense) · *per request* — 14.6–16.5 |
| 16.5–19.3 | Data | **Rwanda** (10m border) lifts out of the continent as its own slab with a lit violet edge. A violet elastic ring runs its border. Glossy data spheres try to fly out; the ring stretches outward and **snaps them back** (17.5 hit). | **Data stays in-country.** 17.8–19.3 |
| 19.3–22.0 | Money | A sleek 3D phone (black glass, violet edge light) swings in; its screen confirms a payment in **RWF** (no amount, no operator branding). A violet band **snaps** around it (20.0 hit). | **Pay in RWF, with Mobile Money.** 20.4–22.0 |
| 22.0–24.0 | Assemble | The three bands (Kigali, Rwanda ring, phone) fly up toward camera, straighten into glossy bars and snap into the **three logo slabs** (extruded, bevelled, violet satin; angles 16.4° / 7.1°). Lock on **24.0** (hit). The bottom slab's LED hole glows. | — |
| 24.0–25.0 | Wordmark | The real wordmark, extruded in 3D, rises beside the mark reading **stretch cloud**. | — |
| 25.0 | **Callback** | The violet t drops into the gap (echo of 3.0), squashes and shoves "ch cloud" over → **strettch cloud**; it then takes the wordmark's material. Hit. | — |
| 25.5–27.0 | Lockup | Camera settles to a perfect frontal lockup; light resolves. | *Africa-first cloud.* · **cloud.strettch.com** — from 26.2 |
| 27.0–30.0 | Hold | Dead still from 28.0 (grain only). Final chord decays to silence at 30.0. | (holds) |

~33 words on screen. Every figure and claim is verified in the Strettch Cloud docs.

## Look
- **Studio:** seamless cyclorama, near-black warm background (#0B0A10), satin floor, fog hides the horizon. Key light top-left (warm white), violet rim light, soft shadows, filmic tone mapping, environment reflections, restrained bloom on violet highlights only.
- **Materials:** `violetGloss` (#6B63FF, clearcoat — the elastic, the t, pins), `violetSatin` (logo slabs), `inkSatin` (letters, continent), `slateMatte` (#6E6A80 — anything *far*), black glass (phone).
- **Type (2D overlay):** Inter variable only (weight carries meaning: thin = far/stretched, heavy = close/snapped), plus the single Instrument Serif annotation. No monospace. No HUD/dashboard layouts. Nothing under 40 px; key numbers ≥ 200 px.
- **Colour rule:** violet = Strettch Cloud / close; slate = far. Only Rwanda/Kigali are ever violet on the map.

## Banned (from the v2 critique)
Dot-matrix maps · arcs with travelling packets · rolling/slot counters · typing cursors · warp/starfield zooms · radar/pulse rings · logo shine sweeps · background dot grids · chromatic aberration · glitch effects · monospace · third-party logos or brand colours.

## Craft rules
- One peak (14.0), one breath (12.8–14.0), one slow move (9.0–12.8). Everything else is subordinate. No move→hold→move monotony: vary hold lengths.
- Camera is a camera: eased starts, overshoot-and-settle stops, damped multi-axis shake only on hits.
- Every transition is physical (bands, snaps, objects carried) — no dissolves, no cuts.
- Anything moving faster than ~40 px/frame gets a high-sample motion-blur window.
- Deterministic: every frame a pure function of t.
