#!/usr/bin/env python3
"""Rough wireframe frame sketches for Motion Storyboard B ("The Control Rail").

These are low-fidelity layout guides for the video implementation agent, not
final renders. They visualize the persistent left queue rail + right ChatGPT
panel composition and the lower-third caption band used throughout the piece.

Usage: python3 make_frames.py
Output: scene-1.png ... scene-7.png (1920x1080)
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
OUT = os.path.dirname(os.path.abspath(__file__))

# Dark editorial palette
BG = (14, 16, 20)
PANEL = (22, 25, 31)
RAIL = (18, 20, 26)
STROKE = (52, 58, 70)
TEXT = (232, 236, 242)
MUTED = (150, 158, 172)
ACCENT = (96, 165, 250)      # controlled blue for YOLO chrome / progress
GOOD = (74, 201, 155)        # done / safe state
WARN = (240, 189, 90)        # paused / ambiguous state
CAPTION_BG = (9, 10, 13)


def font(size: int, bold: bool = False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


F_CAP = font(58, bold=True)
F_SUB = font(34)
F_H = font(30, bold=True)
F_ITEM = font(26)
F_SMALL = font(22)
F_TAG = font(20, bold=True)


def rr(d, box, radius, fill=None, outline=None, width=2):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def base(scene_no: str):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # scene marker (guide only, not in final render)
    d.text((28, 24), f"SKETCH — Storyboard B — {scene_no}", font=F_SMALL, fill=MUTED)
    return img, d


def rail(d, active_send=None, title="YOLO · Queue", count="3 queued"):
    """Persistent left queue rail occupying left third."""
    rr(d, (60, 96, 620, 900), 22, fill=RAIL, outline=STROKE)
    d.text((92, 128), title, font=F_H, fill=TEXT)
    d.text((92, 168), count, font=F_SMALL, fill=ACCENT)
    items = [
        ("1", "Implement the smallest complete fix", "queued"),
        ("2", "Review the changes for regressions", "queued"),
        ("3", "Run the relevant validation", "queued"),
    ]
    y = 220
    for idx, (n, label, state) in enumerate(items):
        box = (92, y, 588, y + 150)
        border = ACCENT if (active_send == idx) else STROKE
        rr(d, box, 16, fill=PANEL, outline=border, width=3 if active_send == idx else 2)
        d.ellipse((112, y + 20, 148, y + 56), fill=None, outline=ACCENT, width=3)
        d.text((124, y + 26), n, font=F_SMALL, fill=ACCENT)
        # wrapped label
        words, line, ly = label.split(), "", y + 20
        for w in words:
            test = (line + " " + w).strip()
            if d.textlength(test, font=F_ITEM) > 400:
                d.text((168, ly), line, font=F_ITEM, fill=TEXT)
                ly += 34
                line = w
            else:
                line = test
        d.text((168, ly), line, font=F_ITEM, fill=TEXT)
        tag = "SENDING" if active_send == idx else state.upper()
        tcol = ACCENT if active_send == idx else MUTED
        d.text((112, y + 108), tag, font=F_TAG, fill=tcol)
        y += 172


def conversation(d, x0=680):
    """Right ChatGPT conversation panel (two-thirds)."""
    rr(d, (x0, 96, W - 60, 760), 22, fill=PANEL, outline=STROKE)
    d.text((x0 + 32, 124), "ChatGPT", font=F_H, fill=MUTED)
    # a long assistant response block
    rr(d, (x0 + 32, 176, W - 100, 470), 14, fill=(28, 32, 40), outline=STROKE, width=1)
    for i, ln in enumerate([
        "Here is the completed analysis of the",
        "repository issue and the proposed",
        "change set, with rationale ...",
    ]):
        d.text((x0 + 56, 206 + i * 40), ln, font=F_SMALL, fill=MUTED)


def composer(d, x0=680, text="/", ghost="Message ChatGPT"):
    rr(d, (x0, 800, W - 60, 900), 18, fill=(28, 32, 40), outline=ACCENT, width=2)
    d.text((x0 + 32, 832), text if text else "", font=F_SUB, fill=TEXT)
    if not text:
        d.text((x0 + 32, 832), ghost, font=F_SUB, fill=MUTED)


def caption(d, main, sub=None):
    """Lower-third caption band — never covers primary UI."""
    d.rectangle((0, 920, W, H), fill=CAPTION_BG)
    d.rectangle((0, 920, W, 926), fill=ACCENT)
    tw = d.textlength(main, font=F_CAP)
    d.text(((W - tw) / 2, 948), main, font=F_CAP, fill=TEXT)
    if sub:
        sw = d.textlength(sub, font=F_SUB)
        d.text(((W - sw) / 2, 1020), sub, font=F_SUB, fill=MUTED)


def save(img, name):
    p = os.path.join(OUT, name)
    img.save(p)
    print("wrote", p)


# Scene 1 — Problem
img, d = base("Scene 1 · 0:00-0:04 · Problem")
conversation(d, x0=680)
# dim / greyed rail to show queue is not yet doing the work
rr(d, (60, 96, 620, 900), 22, fill=(16, 18, 22), outline=(34, 38, 46))
d.text((92, 128), "You keep coming back", font=F_H, fill=MUTED)
d.text((92, 168), "just to say \u201ccontinue\u201d", font=F_SMALL, fill=MUTED)
composer(d, text="", ghost="continue")
caption(d, "Stop babysitting long ChatGPT tasks.")
save(img, "scene-1.png")

# Scene 2 — Queue
img, d = base("Scene 2 · 0:04-0:12 · Queue")
rail(d, count="3 queued \u00b7 in order")
conversation(d)
caption(d, "Queue what should happen next.")
save(img, "scene-2.png")

# Scene 3 — Composer actions (palette)
img, d = base("Scene 3 · 0:12-0:19 · Composer actions")
rail(d)
conversation(d)
# palette popover above composer
rr(d, (680, 470, 1360, 900), 18, fill=(24, 28, 36), outline=ACCENT, width=2)
d.text((712, 494), "YOLO actions", font=F_H, fill=TEXT)
pal = [("/goal", "Bounded persistent objective"),
       ("/loop", "Bounded iterations"),
       ("/review", "Adversarial review prompt"),
       ("/continue", "Continue the current task")]
for i, (c, desc) in enumerate(pal):
    yy = 544 + i * 80
    rr(d, (712, yy, 1330, yy + 64), 12, fill=PANEL, outline=STROKE, width=1)
    d.text((736, yy + 18), c, font=F_H, fill=ACCENT)
    d.text((900, yy + 20), desc, font=F_SMALL, fill=MUTED)
caption(d, "Start from the composer.")
save(img, "scene-3.png")

# Scene 4 — Bounded workflow
img, d = base("Scene 4 · 0:19-0:28 · Bounded workflow")
rail(d, title="YOLO · /loop 4", count="Turn 2 of 4")
conversation(d)
# progress segments + controls in right panel header area
seg_x = 712
for i in range(4):
    col = GOOD if i < 2 else STROKE
    rr(d, (seg_x + i * 150, 600, seg_x + i * 150 + 130, 626), 8, fill=col)
d.text((712, 560), "Turn 2 of 4", font=F_H, fill=TEXT)
for i, (label, col) in enumerate([("Pause", ACCENT), ("Edit", ACCENT), ("Stop", WARN)]):
    bx = 712 + i * 200
    rr(d, (bx, 660, bx + 170, 724), 12, fill=PANEL, outline=col, width=2)
    d.text((bx + 24, 678), label, font=F_H, fill=col)
caption(d, "Bounded workflows. Visible state. Your controls.")
save(img, "scene-4.png")

# Scene 5 — Optional GitHub setup
img, d = base("Scene 5 · 0:28-0:35 · Optional GitHub")
# queue shows coding sequence
rr(d, (60, 96, 620, 900), 22, fill=RAIL, outline=STROKE)
d.text((92, 128), "YOLO · Queue", font=F_H, fill=TEXT)
d.text((92, 168), "coding sequence", font=F_SMALL, fill=ACCENT)
seq = ["inspect", "implement", "validate", "review", "summarize"]
for i, s in enumerate(seq):
    yy = 214 + i * 128
    rr(d, (92, yy, 588, yy + 104), 14, fill=PANEL, outline=STROKE)
    d.ellipse((112, yy + 18, 144, yy + 50), outline=ACCENT, width=3)
    d.text((122, yy + 22), str(i + 1), font=F_SMALL, fill=ACCENT)
    d.text((168, yy + 32), s, font=F_H, fill=TEXT)
conversation(d)
# Optional GitHub app label chip in the conversation panel
rr(d, (712, 176, 1360, 236), 14, fill=(24, 30, 40), outline=ACCENT, width=2)
d.ellipse((730, 190, 762, 222), outline=TEXT, width=2)
d.text((776, 190), "Optional GitHub app \u00b7 Connected directly to ChatGPT",
       font=F_SMALL, fill=TEXT)
caption(d, "Connect GitHub to ChatGPT.", "YOLO keeps the next steps moving.")
save(img, "scene-5.png")

# Scene 6 — Reliability
img, d = base("Scene 6 · 0:35-0:40 · Reliability")
rail(d)
conversation(d)
# three product-state chips stacked over right panel
chips = [("Draft protected.", GOOD, "composer text preserved"),
         ("Ambiguous? It pauses.", WARN, "fail-closed \u00b7 no double send"),
         ("Local by default.", ACCENT, "chrome.storage.local \u00b7 no telemetry")]
for i, (label, col, sub) in enumerate(chips):
    yy = 200 + i * 150
    rr(d, (712, yy, 1360, yy + 118), 16, fill=(24, 28, 36), outline=col, width=3)
    d.text((744, yy + 22), label, font=F_H, fill=TEXT)
    d.text((744, yy + 66), sub, font=F_SMALL, fill=MUTED)
caption(d, "Built to stay in control.")
save(img, "scene-6.png")

# Scene 7 — End card
img, d = base("Scene 7 · 0:40-0:45 · End card")
# centered, rail resolves into a mark
d.rectangle((0, 0, W, H), fill=BG)
title = "YOLO for ChatGPT"
tw = d.textlength(title, font=font(96, bold=True))
d.text(((W - tw) / 2, 300), title, font=font(96, bold=True), fill=TEXT)
line = "Queue the next steps. Stay in control."
lw = d.textlength(line, font=F_CAP)
d.text(((W - lw) / 2, 430), line, font=F_CAP, fill=MUTED)
sup = "Local-first \u00b7 Open source \u00b7 No telemetry"
sw = d.textlength(sup, font=F_SUB)
d.text(((W - sw) / 2, 520), sup, font=F_SUB, fill=ACCENT)
cta = "github.com/kartikkabadi/chatgpt-yolo"
cw = d.textlength(cta, font=F_H)
d.text(((W - cw) / 2, 600), cta, font=F_H, fill=TEXT)
sec = "Sponsor development"
scw = d.textlength(sec, font=F_SUB)
d.text(((W - scw) / 2, 656), sec, font=F_SUB, fill=MUTED)
legal = "Independent project. Not affiliated with OpenAI."
lgw = d.textlength(legal, font=F_SMALL)
d.text(((W - lgw) / 2, 940), legal, font=F_SMALL, fill=MUTED)
save(img, "scene-7.png")

print("done")
