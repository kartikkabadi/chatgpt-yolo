# YOLO brand direction — launch package

## Selection

**Selected visual direction:** Direction A — "Instrument Panel"  
**Selected motion storyboard:** Storyboard A — "Calm product-native screen tour"  
**Rationale:** Direction A is the calmest, most product-native treatment. It reproduces the real YOLO / ChatGPT UI using the extension's own design tokens, so the hero and screenshots are immediately credible and consistent with what a user sees after install. Storyboard A follows the same principle: the camera stays inside the real product surface, using direct-manipulation motion (queue items sliding, the palette opening, the workflow bound advancing) rather than abstract graphics. Together they counterbalance the playful "YOLO" name with disciplined, controlled, inspectable design.

## Core identity

- **Calm, technical, controlled, reliable, local-first, precise, inspectable, open source.**
- Warm off-white canvas (`#f6f6f4`) with near-black type (`#181817`).
- Graphite and zinc surfaces (`#ffffff`, `#fbfbfa`) with quiet borders (`#deded8`, `#c5c5bd`).
- Compact system typography with monospace accents for slash commands, status, and code-like tokens.
- Moderate rounded corners, restrained shadows.
- Semantic color only:
  - **green** (`#24784b`) = running / success / sending
  - **amber** (`#9b640d`) = paused / caution
  - **red** (`#b33232`) = blocked / failed only

## What to avoid

Neon AI gradients, generic purple SaaS visuals, robots, brains, sparkles, cyberpunk effects, fake code rain, random terminal windows, stock illustrations, giant OpenAI logos, fake GitHub UI, excessive glassmorphism, 3D floating cubes, particles with no semantic purpose, aggressive motion blur, meme branding, and "unlimited autonomy" imagery.

## Motion language

- Layout motion and queue-item insertion are the hero moves.
- Direct manipulation (cursor drag, click `Send next`, `Pause`).
- Clean masking and clip reveals from the real UI position (right third popup, above composer palette).
- Controlled zooms ≤ 6%, subtle crop transitions, progress segments.
- Restrained easing (ease-out, no spring overshoot).
- Muted-first: every message is legible without audio.

## Deliverables using this direction

- `docs/assets/hero.webp` — README hero
- `docs/assets/social-preview.png` — GitHub Open Graph / social preview
- `docs/assets/screenshot-*.webp` — product screenshots
- `docs/assets/demo-poster.webp` — first video frame, X thumbnail, README demo cover
- `marketing/video/` — selected video source and renders
