# Visual Direction C — "Control Line"

A blueprint / engineering-drawing treatment for YOLO. Where a screenshot-led
direction shows the product and a typographic direction shouts the message, this
direction *diagrams* the product's core idea: the instruction queue rendered as
an ordered, numbered **control line** — a vertical spine of connected steps with
explicit state and an explicit bound. It is calm, technical, and semantic:
every mark on the canvas means something.

## Deliverables

| File | Size | Format |
| --- | --- | --- |
| `social-preview-concept.png` | 1280×640 | PNG, opaque, 140 KB (< 1 MB) |
| `hero-concept.webp` | 1536×864 | WebP, opaque, ~52 KB (< 500 KB) |

Both are generated deterministically from the HTML sources in this folder via
`render.sh` (headless Chromium at 2× supersample → LANCZOS downscale). Re-running
the script reproduces byte-comparable output.

## Concept summary

The queue is the product, so the queue is the picture. Direction C draws the
"queue the next steps" promise literally: a spine (`.rail`) threads five numbered
instruction nodes, each a compact product-native card with a state chip. One node
is **running** (green), one is **paused** (amber), the rest are neutral **queued**
or dimmed **done**. A right-side bracket labelled `/loop · bounded` visualises the
"bounded workflow" claim as a measured extent — an engineering bound, not an
open-ended loop.

The whole scene sits on a faint 40–48 px technical grid with corner registration
ticks, evoking a spec sheet or CAD drawing. This directly counterbalances the
recklessness the name "YOLO" implies: the imagery reads as *disciplined,
inspectable, controlled*.

- **Social preview**: left rail carries the lockup, the `Queue the next steps.`
  hook, the category descriptor, and the `Local-first · Open source · No telemetry`
  microline; the right shows the control-line queue panel.
- **Hero**: the real YOLO panel (mark, `On · running`, slash-command palette with
  `/review /goal /loop /continue`, the numbered spine, and `Pause / Edit / Stop`
  controls with a `loop 2 / 5 · bounded` readout) sits in front of an abstract
  "long conversation" column tagged `Optional GitHub app · connected to ChatGPT`,
  keeping the product boundary explicit.

## Typography and color treatment

- **Type system** — dual voice, mirroring the real UI:
  - *Headline / product copy*: the product's system sans stack
    (`-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", …`), heavy
    weight (~680), tight tracking (−0.035em). Confident but not shouty.
  - *Everything semantic*: monospace (`ui-monospace, SFMono-Regular, Menlo`) for
    step indices, state chips, slash commands, the bound label, the queue count,
    and the microline. Monospace is the "this is a precise, inspectable system"
    signal and it is already a native accent in the extension.
- **Color** — strictly the shipped `styles.css` light-mode tokens, no additions:
  - canvas `#f6f6f4`, surfaces `#ffffff` / `#fbfbfa`, hover `#f0f0ed`
  - text `#181817` / `#55554f` / `#85847c`, borders `#deded8` / `#c5c5bd`
  - **state color used only for state**: success green `#24784b` (+`#e9f6ee` soft)
    for the running node, warning amber `#9b640d` (+`#fff4dd`) for paused, danger
    red `#b33232` reserved for the `Stop` control only.
  - No gradients, no glow, no neon, no purple. The grid is near-black at ~2.6%
    opacity — present but never loud.

## Rationale

- **Product truth first.** The composition is a faithful abstraction of what the
  extension actually does — persistent queue, per-item state, bounded `/loop`,
  Pause/Edit/Stop, composer-native slash actions. Nothing implies an AI model,
  autonomous agent, or GitHub access inside YOLO. The GitHub app is shown as
  *connected to ChatGPT*, separate from YOLO.
- **Immediate comprehension.** A viewer parses "ordered steps, one is running,
  the run is bounded" in well under the 15-second bar, even at link-preview size.
- **Technical credibility & distinctiveness.** The blueprint framing is unusual
  in this category (which defaults to hero screenshots or bold type), so it stands
  apart from likely Directions A and B while reinforcing "reliable / precise /
  inspectable." It is a *semantic* diagram, not decoration — every particle earns
  its place, satisfying the identity brief's ban on meaningless particles.
- **Consistency with real UI.** Radii (16/12/9), border colors, shadows, chip and
  switch styling are lifted from `styles.css`, so the concept is visually
  continuous with the installed product.

## Motion extensibility

The static frame is already a storyboard keyframe; motion is derived, never bolted on.

1. **Line draws in** — the spine `.rail` strokes top→bottom (SVG dash offset),
   nodes settling onto it in sequence. Communicates "queue the next steps."
2. **Node hand-off** — as step 1 → `done`, its chip fades to neutral; step 2's
   index fills green and its card gains the running ring (`box-shadow` to
   `success-soft`). A single, calm pulse — no bounce, no blur.
3. **Bound snap** — the `/loop · bounded` bracket snaps to its extent to punctuate
   "bounded, not infinite."
4. **State moment** — one deliberate beat on the amber `paused` node to show
   control ("stay visibly in control").
5. **Grid parallax** — the technical grid drifts a few pixels behind the panel for
   depth without distraction.

All of this is expressible with transform/opacity transitions on the existing DOM,
so it maps cleanly onto either candidate video framework (Remotion or HyperFrames)
and to responsive 16:9 / 1:1 recompositions — the spine simply relayouts.

## Risk assessment

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Blueprint/flowchart look reads as "automation platform" or "agent orchestrator" | Med | Ground every node in real product copy and product-native chrome; keep the grid quiet; show explicit `bounded` + Pause/Stop so it reads *controlled*, not autonomous. |
| Vertical `/loop · bounded` label clips at very small sizes | Low | Label is decorative reinforcement, not load-bearing; the bracket alone carries meaning. Can be dropped in the ≤600 px crop. |
| Diagram feels abstract vs. "show the real product" (§11) | Low–Med | The hero embeds the actual YOLO panel (palette + spine + controls); the social preview uses real state labels and queue copy. Direction can swap the schematic spine for a captured queue screenshot once §10 capture lands, with zero layout change. |
| State-color overload if more states are added | Low | Palette is capped at the three semantic colors; neutral is the default. |
| Grid + monospace could feel "cold" | Low | Warm off-white canvas and rounded product cards keep it approachable rather than clinical. |

## Production feasibility

- **Toolchain**: plain HTML + CSS, one inline SVG mark, no fonts to license
  (system + `ui-monospace`), no external assets, no JS. Rendered headless with the
  bundled Chromium; PNG/WebP written by Pillow.
- **Determinism**: fixed viewport, fixed 2× scale, fixed LANCZOS downscale →
  reproducible bytes. Nothing network- or time-dependent.
- **Cost / speed**: sub-second render per asset; regenerating both is one
  `./render.sh`.
- **Size budget**: PNG 140 KB (limit 1 MB), WebP ~52 KB (limit 500 KB) with wide
  headroom; the script auto-steps WebP quality down if a future variant exceeds
  500 KB.
- **Scalability**: the same source generates the required 1:1 and other aspect
  ratios by changing the viewport and grid column, and the exact tokens mean it
  drops straight into the README/hero and social-preview slots without a color or
  radius audit.

## Source files

- `social-preview.html` — 1280×640 concept source
- `hero.html` — 1536×864 concept source
- `render.sh` — deterministic HTML → PNG/WebP renderer (set `CHROME_BIN` to
  override the Chromium path)
