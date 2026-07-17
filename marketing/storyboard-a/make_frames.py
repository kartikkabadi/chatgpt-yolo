#!/usr/bin/env python3
"""Generate rough wireframe frame sketches for Storyboard A.

Composition/safe-area sketches only -- NOT final visual design.
Renders 1920x1080 PNGs into ./frames using Pillow.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
OUT = Path(__file__).resolve().parent / "frames"
OUT.mkdir(parents=True, exist_ok=True)

# Product-inherited palette (approximate)
OFFWHITE = (245, 244, 240)
NEARBLACK = (24, 24, 27)
GRAPHITE = (39, 39, 42)
ZINC = (63, 63, 70)
BORDER = (82, 82, 91)
MUTED = (161, 161, 170)
GREEN = (34, 197, 94)
AMBER = (245, 158, 11)
RED = (239, 68, 68)


def font(size, bold=False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for c in candidates:
        if Path(c).exists():
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def mono(size):
    for c in ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"]:
        if Path(c).exists():
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def safe_area(d):
    m = int(W * 0.07)
    d.rectangle([m, m, W - m, H - m], outline=(90, 90, 96), width=2)
    # bottom 12% no-critical-text band
    d.rectangle([0, int(H * 0.88), W, H], outline=(70, 70, 76), width=1)
    d.text((m + 8, int(H * 0.88) + 6), "no critical text (X player controls)",
           font=font(20), fill=(110, 110, 116))


def rounded(d, box, radius, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def base(bg):
    img = Image.new("RGB", (W, H), bg)
    return img, ImageDraw.Draw(img)


def tag(d, x, y, text, fg=MUTED, bg=GRAPHITE):
    f = font(22)
    tw = d.textlength(text, font=f)
    rounded(d, [x, y, x + tw + 28, y + 40], 20, fill=bg, outline=BORDER, width=1)
    d.text((x + 14, y + 8), text, font=f, fill=fg)
    return tw + 28


# ---------- Frame 1: Problem / poster ----------
def frame_problem():
    img, d = base(OFFWHITE)
    # fake ChatGPT conversation column
    col_x0, col_x1 = int(W * 0.22), int(W * 0.78)
    for i, y in enumerate(range(140, 620, 150)):
        w = col_x1 - col_x0 if i % 2 else int((col_x1 - col_x0) * 0.7)
        rounded(d, [col_x0, y, col_x0 + w, y + 110], 16,
                fill=(236, 235, 231), outline=(220, 219, 214), width=1)
        for j, ly in enumerate(range(y + 20, y + 100, 26)):
            lw = w - 40 if j < 2 else int(w * 0.5)
            d.line([col_x0 + 20, ly, col_x0 + lw, ly], fill=(205, 204, 199), width=8)
    # empty composer
    comp_y = 700
    rounded(d, [col_x0, comp_y, col_x1, comp_y + 90], 18,
            fill=(255, 255, 255), outline=(210, 209, 204), width=2)
    d.text((col_x0 + 24, comp_y + 30), "Message ChatGPT",
           font=font(26), fill=(170, 169, 164))
    # blinking cursor hint
    d.line([col_x0 + 240, comp_y + 24, col_x0 + 240, comp_y + 66], fill=NEARBLACK, width=3)
    d.text((col_x0 + 24, comp_y - 44), "you return just to type \u201ccontinue\u201d\u2026",
           font=font(22), fill=(150, 149, 144))
    # headline scrim lower-left
    sx, sy = 110, 800
    scrim = Image.new("RGBA", (int(W * 0.62), 150), (24, 24, 27, 150))
    img.paste(Image.alpha_composite(
        img.crop((sx, sy, sx + scrim.width, sy + scrim.height)).convert("RGBA"), scrim
    ).convert("RGB"), (sx, sy))
    d.text((140, 812), "Stop babysitting long", font=font(58, True), fill=(255, 255, 255))
    d.text((140, 878), "ChatGPT tasks.", font=font(58, True), fill=(255, 255, 255))
    safe_area(d)
    d.text((int(W * 0.07) + 8, int(W * 0.07) - 34),
           "Scene 1 \u00b7 00:00 \u00b7 Problem / poster (rough sketch)",
           font=font(24), fill=(120, 120, 126))
    img.save(OUT / "frame-01-problem.png")


# ---------- Frame 4: Bounded workflow (paused) ----------
def frame_transition():
    img, d = base(OFFWHITE)
    col_x0, col_x1 = int(W * 0.20), int(W * 0.66)
    # composer
    rounded(d, [col_x0, 150, col_x1, 240], 18, fill=(255, 255, 255),
            outline=(210, 209, 204), width=2)
    d.text((col_x0 + 24, 178), "/loop 4 audit reliability gaps",
           font=mono(30), fill=NEARBLACK)
    # workflow card
    wx0, wy0, wx1, wy1 = col_x0, 300, col_x1, 560
    rounded(d, [wx0, wy0, wx1, wy1], 20, fill=GRAPHITE, outline=BORDER, width=2)
    tag(d, wx0 + 24, wy0 + 24, "loop", fg=(240, 240, 245), bg=ZINC)
    d.text((wx0 + 120, wy0 + 28), "Audit reliability gaps",
           font=font(32, True), fill=(244, 244, 245))
    d.text((wx0 + 24, wy0 + 84), "paused \u00b7 iteration 2/4",
           font=font(26), fill=AMBER)
    # progress segments 2/4 filled
    seg_y0, seg_y1 = wy0 + 130, wy0 + 150
    seg_w = (wx1 - wx0 - 48 - 30) / 4
    for i in range(4):
        sx = wx0 + 24 + i * (seg_w + 10)
        fill = GREEN if i < 2 else ZINC
        rounded(d, [sx, seg_y0, sx + seg_w, seg_y1], 8, fill=fill)
    # controls
    bx = wx0 + 24
    for label, col in [("Resume", ZINC), ("Edit", ZINC), ("Stop", ZINC)]:
        f = font(26)
        tw = d.textlength(label, font=f)
        rounded(d, [bx, wy0 + 180, bx + tw + 44, wy0 + 230], 12,
                fill=col, outline=BORDER, width=1)
        d.text((bx + 22, wy0 + 192), label, font=f, fill=(240, 240, 245))
        bx += tw + 64
    # YOLO popup (right)
    px0, px1 = int(W * 0.70), int(W * 0.93)
    rounded(d, [px0, 150, px1, 620], 22, fill=NEARBLACK, outline=BORDER, width=2)
    rounded(d, [px0 + 20, 172, px0 + 60, 212], 10, fill=ZINC)
    d.text((px0 + 30, 180), "Y", font=font(26, True), fill=OFFWHITE)
    d.text((px0 + 74, 176), "YOLO", font=font(26, True), fill=OFFWHITE)
    tag(d, px0 + 160, 174, "Paused", fg=(255, 244, 214), bg=(120, 78, 8))
    d.text((px0 + 20, 232), "3 queued \u00b7 Balanced", font=font(22), fill=MUTED)
    for i, t in enumerate(["Review implementation\u2026", "Run validation suite", "Fix failures"]):
        qy = 276 + i * 70
        rounded(d, [px0 + 20, qy, px1 - 20, qy + 56], 12,
                fill=GRAPHITE, outline=BORDER, width=1)
        d.text((px0 + 34, qy + 14), t, font=font(22), fill=(228, 228, 232))
    d.text((px0 + 20, 590), "Local-only automation", font=font(20), fill=MUTED)
    # headline
    d.text((140, 780), "Bounded workflows.",
           font=font(60, True), fill=NEARBLACK)
    d.text((140, 855), "Visible state. Your controls.",
           font=font(60, True), fill=NEARBLACK)
    safe_area(d)
    d.text((int(W * 0.07) + 8, int(W * 0.07) - 34),
           "Scene 4 \u00b7 00:24 \u00b7 Bounded workflow, paused at 2/4 (rough sketch)",
           font=font(24), fill=(120, 120, 126))
    img.save(OUT / "frame-04-transition.png")


# ---------- Frame 7: End card ----------
def frame_endcard():
    img, d = base(OFFWHITE)
    cx = W // 2
    # mark
    rounded(d, [cx - 70, 250, cx + 70, 390], 28, fill=NEARBLACK)
    f = font(96, True)
    d.text((cx - d.textlength("Y", font=f) / 2, 275), "Y", font=f, fill=OFFWHITE)

    def center(text, y, fnt, fill):
        d.text((cx - d.textlength(text, font=fnt) / 2, y), text, font=fnt, fill=fill)

    center("YOLO for ChatGPT", 440, font(76, True), NEARBLACK)
    center("Queue the next steps. Stay in control.", 545, font(44), ZINC)
    center("Local-first \u00b7 Open source \u00b7 No telemetry", 620, font(34), MUTED)
    center("github.com/kartikkabadi/chatgpt-yolo", 715, mono(38), NEARBLACK)
    # sponsor chip
    label = "Sponsor development"
    fs = font(30)
    lw = d.textlength(label, font=fs)
    rounded(d, [cx - lw / 2 - 24, 785, cx + lw / 2 + 24, 845], 16,
            fill=(255, 255, 255), outline=BORDER, width=2)
    center(label, 798, fs, NEARBLACK)
    center("Independent project. Not affiliated with OpenAI.", 900, font(26), MUTED)
    safe_area(d)
    d.text((int(W * 0.07) + 8, int(W * 0.07) - 34),
           "Scene 7 \u00b7 00:40+ \u00b7 End card, held \u2265 3.4 s (rough sketch)",
           font=font(24), fill=(120, 120, 126))
    img.save(OUT / "frame-07-endcard.png")


if __name__ == "__main__":
    frame_problem()
    frame_transition()
    frame_endcard()
    print("wrote:", *[p.name for p in sorted(OUT.glob('*.png'))])
