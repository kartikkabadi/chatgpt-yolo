# Visual Direction B — "Precision Blueprint / Control Rail"

Wave B, Visual direction B. Produced independently, without reference to the
other visual directions.

## Files

| File | Spec | Actual |
| --- | --- | --- |
| `social-preview-concept.png` | 1280×640, PNG, < 1 MB | 1280×640, ~180 KB |
| `hero-concept.webp` | 1536×864 (or 1600×900), optimized WebP | 1536×864, ~58 KB |

Both are rendered from HTML/CSS at 2× device scale and downsampled for crisp
edges. The queue/workflow UI shown is a **staged concept** built from the real
product's tokens and states — it is not a live capture. Any production asset
derived from this direction must use real product captures per brief §10.

## Concept summary

The name "YOLO" reads as reckless; the brief requires the visual system to
counterbalance that with **discipline and control**. Direction B answers this
literally by borrowing the language of **engineering blueprints and control
schematics**:

- A faint two-tier measurement grid (36 px fine / 180 px bold) and a thin
  registration frame with corner crosshairs sit under everything, giving the
  composition the feel of a technical drawing that has been measured and
  checked.
- Monospace annotations at the frame edges (title slug, `1280 × 640`, panel
  labels) act as drafting callouts rather than decoration.
- The queue is presented on a literal **control rail**: a vertical spine with
  numbered nodes whose fill maps to run state (solid green = sending, hollow =
  queued). The rail is the memorable signature of the direction and the visual
  metaphor for "a controlled sequence, not an uncontrolled loop."
- The real product card (queue + bounded `/goal` workflow with `Turn 2 of 4`
  and Pause/Edit/Stop) is the hero subject. Nothing floats or glows; the card
  is squared to the grid.

The hero extends the same scene into product context: a neutral, abstracted
ChatGPT conversation surface with the YOLO command palette (`/goal`, `/loop`,
`/review`, `/continue`) opening from the composer, and the YOLO queue card
beside it — communicating "queue + ChatGPT context in one glance." The
conversation surface is deliberately generic (no OpenAI marks, placeholder
assistant text) and carries a small `Optional GitHub app · connected to
ChatGPT` label to preserve the product boundary.

### What makes it distinct

The distinguishing signature is the **drafting/blueprint substrate + the
numbered control rail**. Where a "clean floating product screenshot on canvas"
treatment relies on soft shadow and whitespace, this direction relies on
measured structure: grid, frame, ticks, monospace callouts, and a state-mapped
rail. It stays inside the identity (calm, near-black on warm off-white) but has
its own unmistakable formal system.

## Typography and color treatment

**Type**
- Display / UI: **Inter** (proxy for the product's system stack:
  `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI"`). Headlines
  are tight (letter-spacing −0.03 to −0.035em, weight 800) to feel engineered,
  not shouty.
- Monospace: **JetBrains Mono** (proxy for the product's
  `ui-monospace, SFMono-Regular, Menlo`). Used for every "technical" role:
  drafting callouts, the `/goal` command, `Turn 2 of 4`, `Ctrl ⇧ Y`, queue
  index numbers (`01`–`04`), and the footer trust line.
- Hierarchy: one big near-black headline, one softened continuation line in
  `--text-faint`, one `--text-soft` support paragraph. No competing weights.

**Color** — used verbatim from `styles.css`, no new hues introduced:
- `--canvas #f6f6f4` field, `--surface #ffffff` cards, `--surface-raised
  #fbfbfa` insets, `--surface-hover #f0f0ed` chips.
- `--text #181817` / `--text-soft #55554f` / `--text-faint #85847c` for the
  three-level text ramp and the grid/annotation lines (near-black at very low
  opacity).
- `--border #deded8` / `--border-strong #c5c5bd` for the frame, ticks, rail,
  and card edges.
- State colors used **only** semantically: `--success #24784b` (running /
  sending, progress fill, rail active node), `--warning #9b640d` (paused),
  `--danger #b33232` (Stop only). No decorative color.

This is the same palette the extension ships, so the marketing reads as
"product-native" and passes the "consistency with real UI" score.

## Rationale

- **Product truth first.** The hero subject is the actual mechanic — an ordered
  queue and a bounded, visibly-limited workflow — not an abstraction. `Turn 2
  of 4` + a segmented progress bar makes "bounded" literal and rebuts the
  "endless loop" reading of the name.
- **Counter-positions the name.** Blueprint structure, measurement marks, and a
  fail-closed label convert "YOLO" from reckless to *deliberate*.
- **Immediate comprehension.** In ~15 s a viewer sees: it's a Chrome extension,
  it queues next steps, workflows are bounded with real controls, it's ChatGPT,
  and it's local-first / open source / no telemetry.
- **Small-size readability.** The social preview keeps one large headline, one
  legible card, and a single trust line — no tiny feature list — so it survives
  link-preview downscaling.
- **Boundary safety.** No OpenAI logos, no fake GitHub UI; the GitHub app is
  labeled optional and "connected to ChatGPT."

## Motion extensibility

The static system is built from elements that animate cleanly and meaningfully,
directly supporting the launch-video motion language (brief §13):

- **Rail as timeline.** Nodes fill top-to-bottom as items send — a natural,
  semantic progress motion (queue-item state change), not decorative movement.
- **Queue-item insertion.** New rows slide/measure into the list along the rail;
  index numbers count up. Maps to Scene 2 (Queue).
- **Palette reveal.** The command palette rises from the composer for Scene 3
  (composer actions) — already composed in the hero.
- **Bounded progress.** The segmented bar advances one segment per turn and
  visibly **stops/pauses** at the bound for Scene 4 — never implies an endless
  loop.
- **Blueprint framing as transitions.** The grid + registration frame supports
  clean masked wipes and controlled crop/zoom transitions between scenes;
  dimension lines can "measure in" a callout. All restrained easing, no 3D,
  no parallax, no motion blur — consistent with the brief's motion "avoid" list.
- **Responsive.** Grid, frame, and rail scale to 1:1 (square secondary video)
  and to README/mobile widths without redraw.

## Risk assessment

- **Grid can feel busy / "developer wireframe."** *Mitigation:* grid opacity is
  ~3–5% of near-black; it should read as texture, not lines. If it competes with
  the card at final sizes, drop the bold grid tier and keep only the frame +
  crosshairs.
- **Blueprint = "unfinished/technical" connotation.** *Mitigation:* the polished
  product card and finished typography keep it reading as "precise," not
  "draft."
- **Annotations risk clutter.** Kept to frame-edge slugs only; no leader lines
  over content in the finals.
- **Staged UI risk.** The card is a concept mock. *Mitigation:* every state
  shown is real and reachable; production must swap in real captures and label
  staged states, per §10. No fabricated capability is depicted.
- **Boundary risk.** The neutral conversation panel must never gain OpenAI
  marks or a literal GitHub UI; keep the "Optional GitHub app" label if reused.
- **Font substitution.** Renders use Inter / JetBrains Mono as proxies for the
  product's system stack; final assets should confirm the intended stack.

## Production feasibility

- **Toolchain:** pure HTML/CSS rendered headless (Chromium via `playwright-core`
  at 2× DSF), downsampled with ImageMagick, WebP via `cwebp -q 90`. No design
  binary, no proprietary format — fully reproducible in CI and diffable in git.
- **Weight:** social PNG ~180 KB (< 1 MB budget), hero WebP ~58 KB (< 500 KB
  budget). Comfortable headroom.
- **Reuse:** the same CSS token block and components (card, rail, palette, grid)
  become the source for screenshots, the demo poster, and the video's HTML
  layers — one system, many outputs.
- **Effort to production:** low. Swap staged card content for real captures,
  confirm the font stack, and re-render. The rail/grid/palette are already
  parameterized.

## Handoff / recommended next action

If Direction B is selected: (1) capture the real popup + composer palette states
listed in §10, (2) drop them into these same layouts replacing the staged card,
(3) re-render `docs/assets/social-preview.png` and `docs/assets/hero.webp` from
this system, (4) hand the CSS component set to the motion agent as the video's
layer source. If not selected, the rail + bounded-progress motifs are still
recommended as reusable, product-true motion primitives.
