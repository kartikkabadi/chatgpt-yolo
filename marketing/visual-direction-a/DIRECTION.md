# Visual Direction A — "Instrument Panel"

Wave B creative exploration for the YOLO launch. One complete, self-consistent
visual direction. Independent proposal — not yet reconciled against Directions B/C.

## Concept summary

**YOLO shown as a calm instrument panel, not a hype product.** The whole system
is built directly from the extension's own UI: the real queue panel is the hero
object, rendered faithfully and placed on a warm off-white field with a faint
blueprint baseline grid. The grid and monospace command tokens signal *precise,
technical, inspectable* without any AI-hype vocabulary. The name "YOLO" reads as
reckless; every design choice here deliberately counterbalances it with order,
labelling, and visible bounded state.

The through-line across both assets is a **numbered, ordered queue with explicit
status** (`Sending` in green, `Queued` in graphite). Status is communicated by
small semantic dots reusing the product's exact state colors — green = running,
amber = paused, red reserved only for blocked/failed (and intentionally absent
here, because nothing is failing).

Two deliverables in this folder:

| File | Size | Purpose |
| --- | --- | --- |
| `social-preview-concept.png` | 1280×640 PNG, 194 KB | Link/social preview: mark, "Queue the next steps.", descriptor, product queue crop, trust line |
| `hero-concept.webp` | 1536×864 WebP, 62 KB | README hero: queue + ChatGPT context in one glance |

### Social preview composition
Left: YOLO mark + `for ChatGPT`, a `CHROME EXTENSION · MANIFEST V3` kicker, the
headline **"Queue the next steps."**, a one-line descriptor, and a pill reading
`Local-first · Open source · No telemetry`. Right: a faithful crop of the real
queue panel — Mode/queue-count strip, four ordered instructions with status, and
monospace command tags (`/review`, `/loop`, `/fix`, `/handoff`).

### Hero composition
Left: a restrained ChatGPT conversation surface showing the demonstration
coding scenario, an inline **delivery receipt** ("YOLO delivered next step"), and
a composer with a `/goal` YOLO action labelled `YOLO ACTION`. Right: the YOLO
panel docked, with an active **bounded workflow** (objective, `Turn 2 of 5`,
Pause/Edit/Stop) above the ordered queue. A small `Optional · GitHub app
connected to ChatGPT` chip preserves the product boundary — GitHub connects to
ChatGPT, not to YOLO.

## Typography and color treatment

**Typography.** System UI stack (`-apple-system, BlinkMacSystemFont, "SF Pro
Text", "Segoe UI"`) exactly as the extension ships — product-native, no webfont
dependency. Headline is heavy (800) with tight tracking (−0.035em) for
composure and density. Body/labels stay compact. Monospace
(`ui-monospace, SFMono-Regular, Menlo`) is used *only* for machine-meaningful
tokens: slash commands, the `⌘/Ctrl ↵` hint, delivery receipts, and the trust
line. Monospace = "this is a real, inspectable command," never decoration.

**Color.** Pulled verbatim from `styles.css` `:root` (light theme):

| Token | Value | Use |
| --- | --- | --- |
| `--canvas` | `#f6f6f4` | warm off-white field |
| `--surface` / `--surface-raised` | `#ffffff` / `#fbfbfa` | panels, cards |
| `--text` / `--text-soft` / `--text-faint` | `#181817` / `#55554f` / `#85847c` | near-black type ramp |
| `--border` / `--border-strong` | `#deded8` / `#c5c5bd` | quiet borders |
| `--primary` | `#181817` | mark, primary buttons, user bubble |
| `--success` | `#24784b` | running / sending |
| `--warning` | `#9b640d` | paused / caution |
| `--danger` | `#b33232` | blocked / failed only |

Shadows are restrained (soft, low-opacity, large-radius) and rounding is moderate
(9–20px), matching the product's `--radius-*` scale.

## Rationale

- **Product truth first.** The strongest, most honest asset YOLO has is its own
  UI. Reproducing the real queue at pixel fidelity earns technical credibility
  and guarantees consistency with what a user sees after install.
- **Counters the name.** Numbered ordering, explicit status, bounded turn state,
  and Pause/Edit/Stop controls read as *disciplined and controlled* — the exact
  antidote to "YOLO = reckless."
- **Comprehension in one glance.** The hero pairs cause (a long ChatGPT
  conversation) with mechanism (an ordered, bounded queue) side by side, so the
  value lands without reading copy.
- **Trust as proof, not hook.** `Local-first · Open source · No telemetry` is
  present but secondary to the queue story, matching the positioning hierarchy.
- **Small-size legible.** High contrast, few elements, one dominant object — the
  social preview survives compression to a link thumbnail.

## Motion extensibility

The static frame is already a motion keyframe:

1. **Queue advance.** Item 01 completes → its dot fades green→graphite, the list
   shifts up one row, a new item slides in at the bottom. This is the core loop
   and maps directly to real product behaviour.
2. **Status transitions.** Dot color animates green↔amber↔graphite on
   send/pause; the bounded-workflow bar fills one segment per turn (`2/5 → 3/5`).
3. **Delivery receipt.** The "YOLO delivered next step" divider wipes in left→
   right between conversation turns — a satisfying, honest beat.
4. **Camera.** Gentle mask/crop moves between the conversation column and the
   docked panel; no 3D, no parallax gimmicks, no motion blur.

All motion is discrete and state-driven (ease 120–160ms, mirroring the CSS
transitions in `styles.css`), so it respects `prefers-reduced-motion` and stays
calm. The blueprint grid can drift 1–2px as a near-static backing layer.

## Risk assessment

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Depicting a ChatGPT conversation could imply OpenAI endorsement | Med | No OpenAI logo; neutral `C` glyph + small text label; `Optional · GitHub app connected to ChatGPT` chip; `YOLO ACTION` label keeps slash commands non-native | 
| Slash tokens read as native ChatGPT commands | Med | Explicit `YOLO action` label on the composer; tokens shown inside the YOLO panel context |
| Blueprint grid drifting toward "cyberpunk/tech-y" cliché | Low | Kept at ~2.5% opacity, warm neutral, purely structural |
| GitHub reference blurring the product boundary | Med | Chip states GitHub connects *to ChatGPT*; no fake GitHub UI, no repo chrome |
| Faithful-but-staged UI mistaken for a live capture | Low | This is a labelled concept; Wave C should regenerate from real deterministic capture before publish |
| Off-white + subtle borders washing out on some displays | Low | Contrast ratios verified against near-black type; borders reinforced with `--border-strong` where needed |

Avoided by construction: neon/AI gradients, robots, brains, sparkles, cyberpunk,
code rain, giant OpenAI logos, fake GitHub UI, glassmorphism, 3D cubes, meme
branding, "unlimited autonomy" imagery.

## Production feasibility

**Very high.** Both assets are pure HTML/CSS reusing the extension's own tokens,
rendered headless and supersampled 2× then downscaled with Lanczos for
retina-grade edges.

- **Toolchain:** static HTML + inline CSS → headless Chromium (via CDP /
  Playwright) at `device_scale_factor=2` → Pillow downscale → PNG (`optimize`) and
  WebP (`quality=90, method=6`).
- **Reproducible & parametric:** copy edits, queue contents, and status states are
  plain markup — trivial to regenerate for the final approved direction, other
  aspect ratios (1600×900, 1080×1080), or localized variants.
- **No heavy dependencies:** no Figma export, no webfonts, no raster editing. The
  same HTML doubles as the first video keyframe, keeping static and motion assets
  visually identical.
- **Budgets met:** social preview 1280×640 PNG at 194 KB (< 1 MB, opaque);
  hero 1536×864 WebP at 62 KB (< 500 KB, retina-capable).

If selected, Wave C should re-render the queue/conversation from a real
deterministic capture harness (per brief §10) so the shipped hero uses authentic
product states rather than this faithful staged reconstruction.
