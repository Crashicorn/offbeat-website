#!/usr/bin/env python3
"""Generate Offbeat's hand-drawn (code-drawn) product schematics.

These are honest technical illustrations in the house style of
assets/img/products/*.svg: dark chassis, violet/cyan accents, labelled
brand + model. They are schematics for orientation, never photographs.
Layout references: each manufacturer's public product page top-panel
layout (positions of jogs, pads, faders, screens), simplified.

Only writes the models listed in PRODUCTS below (the newer additions);
the original hand-written SVGs in assets/img/products/ are untouched.
Safe to re-run: output is deterministic.
"""
import os

OUT = "assets/img/products"

VIOLET = "#8b5cf6"
CYAN = "#38bdf8"
GREEN = "#34d399"
AMBER = "#fbbf24"


def esc(s):
    return s.replace("&", "&amp;")


def chassis(w, h, accent=VIOLET, rx=16, gid="b"):
    return (
        f'<defs><linearGradient id="{gid}body" x1="0%" y1="0%" x2="0%" y2="100%">'
        f'<stop offset="0%" stop-color="#1e1e28"/><stop offset="100%" stop-color="#12121c"/></linearGradient>'
        f'<radialGradient id="{gid}jog" cx="50%" cy="50%" r="50%">'
        f'<stop offset="0%" stop-color="#2a2a3c"/><stop offset="70%" stop-color="#14141e"/>'
        f'<stop offset="85%" stop-color="#222230"/><stop offset="100%" stop-color="#0c0c12"/></radialGradient></defs>'
        f'<rect x="10" y="10" width="{w-20}" height="{h-20}" rx="{rx}" fill="url(#{gid}body)" stroke="rgba(139,92,246,0.4)" stroke-width="2"/>'
        f'<rect x="20" y="20" width="{w-40}" height="{h-40}" rx="{max(rx-4,6)}" fill="#14141f" stroke="rgba(255,255,255,0.06)"/>'
    )


def jog(cx, cy, r, gid="b", accent=VIOLET, display=False):
    s = [
        f'<circle cx="{cx}" cy="{cy}" r="{r+6}" fill="#0a0a10" stroke="rgba(139,92,246,0.5)" stroke-width="2"/>',
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#{gid}jog)" stroke="#333"/>',
    ]
    if display:
        s.append(f'<circle cx="{cx}" cy="{cy}" r="{r*0.42:.0f}" fill="#0c1a24" stroke="{accent}" stroke-width="2"/>')
        s.append(f'<circle cx="{cx}" cy="{cy}" r="{r*0.14:.0f}" fill="{accent}"/>')
    else:
        s.append(f'<circle cx="{cx}" cy="{cy}" r="{r*0.36:.0f}" fill="#181824" stroke="rgba(255,255,255,0.1)"/>')
        s.append(f'<circle cx="{cx}" cy="{cy}" r="{r*0.15:.0f}" fill="{accent}"/>')
    s.append(f'<line x1="{cx}" y1="{cy-r+2}" x2="{cx}" y2="{cy-r+16}" stroke="{CYAN}" stroke-width="3" stroke-linecap="round"/>')
    return "".join(s)


def platter(cx, cy, r, accent=VIOLET):
    """Motorized turntable-style platter (RANE ONE)."""
    rings = "".join(
        f'<circle cx="{cx}" cy="{cy}" r="{r-frac*r:.0f}" fill="none" stroke="rgba(255,255,255,0.07)"/>'
        for frac in (0.15, 0.3, 0.45, 0.6)
    )
    return (
        f'<circle cx="{cx}" cy="{cy}" r="{r+7}" fill="#0a0a10" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>'
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#101018" stroke="#3a3a4a" stroke-width="2"/>'
        + rings
        + f'<circle cx="{cx}" cy="{cy}" r="{r*0.3:.0f}" fill="#181824" stroke="rgba(255,255,255,0.15)"/>'
        + f'<circle cx="{cx}" cy="{cy}" r="5" fill="#ddd"/>'
        + f'<line x1="{cx}" y1="{cy-r+4}" x2="{cx}" y2="{cy-r+20}" stroke="{accent}" stroke-width="3" stroke-linecap="round"/>'
    )


def pads(x, y, cols=4, rows=2, pw=34, ph=22, gapx=6, gapy=6, accents=(CYAN, VIOLET)):
    out = []
    for r in range(rows):
        for c in range(cols):
            out.append(
                f'<rect x="{x + c*(pw+gapx)}" y="{y + r*(ph+gapy)}" width="{pw}" height="{ph}" rx="4" '
                f'fill="#222" stroke="{accents[r % len(accents)]}" stroke-width="1.5"/>'
            )
    return "".join(out)


def knob(cx, cy, r=10, stroke="#888"):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#2a2a3c" stroke="{stroke}"/>'


def fader_v(x, y, length=55, cap="#bbb"):
    return (
        f'<rect x="{x-3}" y="{y}" width="6" height="{length}" rx="2" fill="#0a0a10"/>'
        f'<rect x="{x-12}" y="{y+length//3}" width="24" height="12" rx="2" fill="{cap}"/>'
    )


def fader_h(x, y, length=80, cap="#ddd"):
    return (
        f'<rect x="{x}" y="{y-3}" width="{length}" height="6" rx="2" fill="#0a0a10"/>'
        f'<rect x="{x+length//2-6}" y="{y-11}" width="12" height="22" rx="2" fill="{cap}"/>'
    )


def pitch(x, y, length=110):
    return (
        f'<rect x="{x}" y="{y}" width="10" height="{length}" rx="3" fill="#0c0c14" stroke="#333"/>'
        f'<rect x="{x-5}" y="{y+length//2-7}" width="20" height="14" rx="2" fill="#555" stroke="#fff" stroke-width="0.5"/>'
    )


def cue_play(x, y, scale=1.0):
    r = int(14 * scale)
    return (
        f'<circle cx="{x}" cy="{y}" r="{r}" fill="#222" stroke="{GREEN}" stroke-width="2"/>'
        f'<text x="{x}" y="{y+4}" fill="{GREEN}" font-size="{int(9*scale)}" font-family="sans-serif" font-weight="bold" text-anchor="middle">CUE</text>'
        f'<circle cx="{x}" cy="{y + int(36*scale)}" r="{r}" fill="#222" stroke="{CYAN}" stroke-width="2"/>'
        f'<polygon points="{x-4},{y + int(29*scale)} {x+7},{y + int(36*scale)} {x-4},{y + int(43*scale)}" fill="{CYAN}"/>'
    )


def screen(x, y, w, h, accent=CYAN, label=""):
    mid = y + h // 2
    wave = f'M{x+10} {mid} Q {x+w*0.2:.0f} {mid-16}, {x+w*0.38:.0f} {mid+8} T {x+w*0.62:.0f} {mid-10} T {x+w-10} {mid+4}'
    out = (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="#08080f" stroke="{accent}" stroke-width="2"/>'
        f'<rect x="{x+7}" y="{y+7}" width="{w-14}" height="{h-24}" rx="4" fill="#0c1a24"/>'
        f'<path d="{wave}" fill="none" stroke="{accent}" stroke-width="2.5"/>'
        f'<line x1="{x+w//2}" y1="{y+8}" x2="{x+w//2}" y2="{y+h-18}" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>'
    )
    if label:
        out += f'<text x="{x+w//2}" y="{y+h-6}" fill="{accent}" font-size="8" font-weight="bold" font-family="sans-serif" text-anchor="middle">{esc(label)}</text>'
    return out


def brand(x, y, brand, model, anchor="middle", bsize=10, msize=9):
    return (
        f'<text x="{x}" y="{y}" fill="#fff" font-size="{bsize}" font-family="sans-serif" font-weight="bold" text-anchor="{anchor}" letter-spacing="1">{esc(brand)}</text>'
        f'<text x="{x}" y="{y+14}" fill="#a78bfa" font-size="{msize}" font-family="sans-serif" font-weight="bold" text-anchor="{anchor}">{esc(model)}</text>'
    )


def channel_strip(x, y_top):
    parts = [knob(x, y_top), knob(x, y_top + 33), knob(x, y_top + 66), knob(x, y_top + 99)]
    parts.append(fader_v(x, y_top + 130, 55))
    return "".join(parts)


def svg_doc(w, h, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="100%" height="100%">{body}</svg>\n'


# ---------------------------------------------------------------- models

def cdj3000():
    w, h = 600, 430
    b = [chassis(w, h, gid="cdj")]
    # 9in touchscreen top centre-right
    b.append(screen(215, 34, 300, 130, CYAN, "WAVEFORM · BROWSE"))
    b.append(knob(540, 100, 16))  # browse encoder
    # big jog
    b.append(jog(180, 255, 95, gid="cdj", display=True))
    # tempo fader right
    b.append('<text x="530" y="205" fill="#9a9ab0" font-size="8" font-family="sans-serif" text-anchor="middle">TEMPO</text>')
    b.append(pitch(525, 215, 150))
    # 8 hot cues as a 4x2 block, clear of the screen and jog
    b.append(pads(46, 96, cols=4, rows=2, pw=26, ph=16, gapx=5, gapy=5, accents=(GREEN, AMBER)))
    # play/cue big buttons bottom-left
    b.append(cue_play(70, 330, 1.2))
    # loop / call controls
    b.append(pads(330, 330, cols=3, rows=1, pw=40, ph=20, accents=(CYAN,)))
    b.append(brand(300, 408, "Pioneer DJ", "CDJ-3000"))
    return svg_doc(w, h, "".join(b))


def sc6000():
    w, h = 600, 430
    b = [chassis(w, h, gid="sc")]
    b.append(screen(170, 34, 320, 125, GREEN, "ENGINE DJ · DUAL LAYER"))
    b.append(knob(535, 95, 15))
    b.append(jog(185, 265, 92, gid="sc", accent=GREEN, display=True))
    b.append('<text x="530" y="200" fill="#9a9ab0" font-size="8" font-family="sans-serif" text-anchor="middle">PITCH</text>')
    b.append(pitch(525, 210, 145))
    # performance pads bottom centre
    b.append(pads(320, 250, cols=4, rows=2, pw=38, ph=24, accents=(GREEN, CYAN)))
    b.append(cue_play(65, 320, 1.2))
    b.append(brand(300, 408, "Denon DJ", "SC6000 PRIME"))
    return svg_doc(w, h, "".join(b))


def rane_one():
    w, h = 620, 370
    b = [chassis(w, h, gid="r1")]
    b.append(platter(130, 150, 88))
    b.append(platter(490, 150, 88))
    # start/stop under each platter
    for x in (130, 490):
        b.append(f'<rect x="{x-16}" y="292" width="32" height="20" rx="4" fill="#222" stroke="#eee" stroke-width="1.5"/>')
    # mixer centre
    b.append(f'<rect x="245" y="30" width="130" height="276" rx="8" fill="#181826" stroke="rgba(255,255,255,0.08)"/>')
    b.append(channel_strip(282, 52))
    b.append(channel_strip(338, 52))
    b.append(fader_h(270, 286, 80))
    b.append(pads(48, 256, cols=4, rows=1, pw=30, ph=20, accents=(CYAN,)))
    b.append(pads(406, 256, cols=4, rows=1, pw=30, ph=20, accents=(CYAN,)))
    b.append(pitch(212, 60, 80))
    b.append(pitch(398, 60, 80))
    b.append(brand(310, 330, "RANE", "ONE"))
    return svg_doc(w, h, "".join(b))


def numark_scratch():
    w, h = 420, 460
    b = [chassis(w, h, gid="ns")]
    # two deeper channel strips (trim, 3-band EQ, filter, fader)
    for x in (110, 310):
        for i in range(5):
            b.append(knob(x, 84 + i * 38, 13))
        b.append(fader_v(x, 292, 64))
    # centre column: browse/load, master + level meters
    b.append(knob(210, 96, 15))
    for i in range(7):
        for sx in (196, 218):
            b.append(f'<rect x="{sx}" y="{140 + i*11}" width="6" height="7" fill="{GREEN if i > 1 else "#f87171"}"/>')
    b.append(knob(210, 252, 13))
    # FX paddles (signature)
    for x in (58, 336):
        b.append(f'<rect x="{x}" y="246" width="28" height="11" rx="5" fill="#333" stroke="{CYAN}" stroke-width="1.5"/>')
    # pads
    b.append(pads(48, 312, cols=2, rows=2, pw=38, ph=24, accents=(VIOLET, CYAN)))
    b.append(pads(290, 312, cols=2, rows=2, pw=38, ph=24, accents=(VIOLET, CYAN)))
    # crossfader
    b.append(fader_h(140, 414, 140))
    b.append(brand(210, 48, "Numark", "SCRATCH"))
    return svg_doc(w, h, "".join(b))


def roland_707m():
    w, h = 640, 380
    b = [chassis(w, h, gid="r7")]
    # TR drum machine strip, top centre (signature)
    steps = "".join(
        f'<rect x="{216 + i*13}" y="30" width="10" height="16" rx="2" fill="#222" stroke="{AMBER if i % 4 == 0 else "#666"}" stroke-width="1"/>'
        for i in range(16)
    )
    b.append(steps)
    b.append('<text x="320" y="62" fill="#fbbf24" font-size="8" font-family="sans-serif" font-weight="bold" text-anchor="middle">TR DRUMS · STEP SEQUENCER</text>')
    b.append(jog(115, 165, 72, gid="r7"))
    b.append(jog(525, 165, 72, gid="r7"))
    b.append(pads(40, 268, accents=(CYAN, VIOLET)))
    b.append(pads(446, 268, accents=(CYAN, VIOLET)))
    # 4-channel mixer
    b.append(f'<rect x="215" y="75" width="210" height="270" rx="8" fill="#181826" stroke="rgba(255,255,255,0.08)"/>')
    for i, x in enumerate((245, 290, 350, 395)):
        b.append(channel_strip(x, 92))
    b.append(fader_h(280, 330, 80))
    b.append(cue_play(42, 70))
    b.append(cue_play(598, 70))
    b.append(brand(320, 368, "Roland", "DJ-707M"))
    return svg_doc(w, h, "".join(b))


def xdj_az():
    w, h = 640, 380
    b = [chassis(w, h, gid="az")]
    b.append(screen(212, 30, 216, 118, CYAN, "10.1in TOUCHSCREEN"))
    b.append(jog(112, 185, 78, gid="az", display=True))
    b.append(jog(528, 185, 78, gid="az", display=True))
    b.append(pads(36, 296, accents=(GREEN, AMBER)))
    b.append(pads(452, 296, accents=(GREEN, AMBER)))
    b.append(pitch(30, 60, 95))
    b.append(pitch(600, 60, 95))
    # 4ch mixer under screen
    for x in (246, 292, 348, 394):
        b.append(channel_strip(x, 158))
    b.append(fader_h(280, 336, 80))
    b.append(brand(320, 356, "AlphaTheta", "XDJ-AZ"))
    return svg_doc(w, h, "".join(b))


def _controller_2ch(w, h, gid, brand_name, model, jog_r=80, merge_fx=False, meters=False):
    b = [chassis(w, h, gid=gid)]
    cx = w // 2
    jl, jr = int(w * 0.2), int(w * 0.8)
    b.append(jog(jl, 140, jog_r, gid=gid))
    b.append(jog(jr, 140, jog_r, gid=gid))
    b.append(pads(jl - 76, 245))
    b.append(pads(jr - 76, 245))
    b.append(cue_play(45, 50))
    b.append(cue_play(w - 45, 50))
    b.append(pitch(jl + jog_r + 6, 70, 110))
    b.append(pitch(jr - jog_r - 16, 70, 110))
    # mixer
    mw = 150 if not merge_fx else 200
    b.append(f'<rect x="{cx-mw//2}" y="30" width="{mw}" height="{h-60}" rx="8" fill="#181826" stroke="rgba(255,255,255,0.08)"/>')
    if merge_fx:
        b.append(knob(cx, 52, 14, stroke=AMBER))
        b.append(f'<text x="{cx}" y="78" fill="{AMBER}" font-size="8" font-family="sans-serif" font-weight="bold" text-anchor="middle">MERGE FX</text>')
        b.append(channel_strip(cx - 62, 92))
        b.append(channel_strip(cx - 21, 92))
        b.append(channel_strip(cx + 21, 92))
        b.append(channel_strip(cx + 62, 92))
    else:
        b.append(channel_strip(cx - 30, 55))
        b.append(channel_strip(cx + 30, 55))
        if meters:
            for i in range(6):
                for sx in (cx - 5, cx + 2):
                    b.append(f'<rect x="{sx}" y="{52 + i*9}" width="5" height="6" fill="{GREEN if i > 1 else "#f87171"}"/>')
    b.append(fader_h(cx - 40, h - 68, 80))
    b.append(brand(cx, h - 30, brand_name, model))
    return svg_doc(w, h, "".join(b))


def flx6():
    return _controller_2ch(640, 370, "fx6", "Pioneer DJ", "DDJ-FLX6", jog_r=78, merge_fx=True)


def ddj400():
    return _controller_2ch(600, 360, "d400", "Pioneer DJ", "DDJ-400", jog_r=80, meters=True)


def ddj200():
    w, h = 560, 320
    b = [chassis(w, h, gid="d200")]
    b.append(jog(112, 125, 62, gid="d200"))
    b.append(jog(448, 125, 62, gid="d200"))
    b.append(pads(48, 212, cols=4, rows=2, pw=30, ph=20))
    b.append(pads(384, 212, cols=4, rows=2, pw=30, ph=20))
    b.append(cue_play(40, 48, 0.9))
    b.append(cue_play(520, 48, 0.9))
    b.append(channel_strip(252, 58))
    b.append(channel_strip(308, 58))
    # Transition FX lever (signature)
    b.append(fader_h(240, 258, 80))
    b.append('<text x="280" y="282" fill="#38bdf8" font-size="8" font-family="sans-serif" font-weight="bold" text-anchor="middle">TRANSITION FX</text>')
    b.append(brand(280, 38, "Pioneer DJ", "DDJ-200"))
    return svg_doc(w, h, "".join(b))


# ------------------------------------------------------------- batch 2

def turntable(w, h, gid, brand_name, model, arm="s"):
    b = [chassis(w, h, gid=gid, rx=10)]
    cx, cy, r = int(w * 0.36), int(h * 0.52), int(h * 0.36)
    # platter with strobe dots
    b.append(f'<circle cx="{cx}" cy="{cy}" r="{r+8}" fill="#0a0a10" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>')
    b.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#101018" stroke="#3a3a4a" stroke-width="2"/>')
    dots = []
    import math
    for i in range(24):
        a = i * math.pi / 12
        dots.append(f'<circle cx="{cx + (r-10)*math.cos(a):.0f}" cy="{cy + (r-10)*math.sin(a):.0f}" r="2.2" fill="rgba(255,255,255,0.35)"/>')
    b.append("".join(dots))
    b.append(f'<circle cx="{cx}" cy="{cy}" r="{r*0.32:.0f}" fill="#181824" stroke="rgba(255,255,255,0.12)"/>')
    b.append(f'<circle cx="{cx}" cy="{cy}" r="5" fill="#ddd"/>')
    # tonearm: pivot top-right, arm reaching toward platter edge
    px, py = int(w * 0.86), int(h * 0.16)
    b.append(f'<circle cx="{px}" cy="{py}" r="22" fill="#14141f" stroke="#555" stroke-width="2"/>')
    ex, ey = cx + int(r * 0.62), cy - int(r * 0.55)
    if arm == "s":
        b.append(f'<path d="M{px} {py} C {px-70} {py+30}, {ex+80} {ey-40}, {ex} {ey}" fill="none" stroke="#9a9ab0" stroke-width="5" stroke-linecap="round"/>')
    else:
        b.append(f'<line x1="{px}" y1="{py}" x2="{ex}" y2="{ey}" stroke="#9a9ab0" stroke-width="5" stroke-linecap="round"/>')
    b.append(f'<rect x="{ex-8}" y="{ey-4}" width="22" height="9" rx="3" fill="{CYAN}" transform="rotate(-24 {ex} {ey})"/>')
    # start/stop + speeds + pitch
    b.append(f'<rect x="36" y="{h-56}" width="52" height="26" rx="5" fill="#222" stroke="{GREEN}" stroke-width="2"/>')
    b.append(f'<text x="62" y="{h-38}" fill="{GREEN}" font-size="9" font-family="sans-serif" font-weight="bold" text-anchor="middle">START</text>')
    for i, s in enumerate(("33", "45")):
        b.append(f'<circle cx="{46 + i*30}" cy="46" r="11" fill="#222" stroke="#888"/>')
        b.append(f'<text x="{46 + i*30}" y="50" fill="#ccc" font-size="8" font-family="sans-serif" text-anchor="middle">{s}</text>')
    b.append(f'<rect x="{w-52}" y="{int(h*0.34)}" width="12" height="{int(h*0.4)}" rx="4" fill="#0c0c14" stroke="#333"/>')
    b.append(f'<rect x="{w-58}" y="{int(h*0.5)}" width="24" height="13" rx="2" fill="#555" stroke="#fff" stroke-width="0.5"/>')
    b.append(f'<text x="{w-46}" y="{int(h*0.3)}" fill="#9a9ab0" font-size="8" font-family="sans-serif" text-anchor="middle">PITCH</text>')
    b.append(brand(int(w * 0.36), h - 16, brand_name, model))
    return svg_doc(w, h, "".join(b))


def mixer(w, h, gid, brand_name, model, channels=4, screens=0, paddles=False, fx_lever=False, pad_sides=False, big_filters=False):
    b = [chassis(w, h, gid=gid, rx=12)]
    top = 96 if screens else 74
    if screens:
        sw = 130
        b.append(screen(w // 2 - sw - 14, 30, sw, 62, CYAN))
        b.append(screen(w // 2 + 14, 30, sw, 62, CYAN))
    span = w - 120
    step = span // channels
    for i in range(channels):
        x = 60 + step // 2 + i * step
        for j in range(4):
            b.append(knob(x, top + j * 40, 13 if channels <= 4 else 11))
        if big_filters and i in (1, channels - 2):
            b.append(knob(x, top + 172, 17, stroke=CYAN))
        b.append(fader_v(x, top + 196, 62))
    ybase = top + 196
    if pad_sides:
        b.append(pads(28, ybase - 150, cols=1, rows=4, pw=26, ph=20, accents=(VIOLET, CYAN)))
        b.append(pads(w - 54, ybase - 150, cols=1, rows=4, pw=26, ph=20, accents=(VIOLET, CYAN)))
    if paddles:
        for x in (40, w - 68):
            b.append(f'<rect x="{x}" y="{ybase + 6}" width="28" height="11" rx="5" fill="#333" stroke="{CYAN}" stroke-width="1.5"/>')
    if fx_lever:
        b.append(f'<rect x="{w-64}" y="{ybase - 130}" width="30" height="110" rx="6" fill="#14141f" stroke="{AMBER}"/>')
        b.append(f'<rect x="{w-58}" y="{ybase - 90}" width="18" height="26" rx="3" fill="{AMBER}"/>')
        b.append(f'<text x="{w-49}" y="{ybase - 138}" fill="{AMBER}" font-size="8" font-family="sans-serif" font-weight="bold" text-anchor="middle">BEAT FX</text>')
    b.append(fader_h(w // 2 - 70, h - 52, 140))
    b.append(brand(w // 2, 42 if not screens else 108, brand_name, model))
    return svg_doc(w, h, "".join(b))


def technics_1200():
    return turntable(560, 440, "t12", "Technics", "SL-1200MK7", arm="s")


def plx500():
    return turntable(560, 440, "plx", "Pioneer DJ", "PLX-500", arm="straight")


def lp120x():
    return turntable(560, 440, "lp", "Audio-Technica", "AT-LP120X", arm="straight")


def djm900():
    return mixer(480, 520, "dj9", "Pioneer DJ", "DJM-900NXS2", channels=4, fx_lever=True)


def xone96():
    return mixer(560, 470, "x96", "Allen & Heath", "Xone:96", channels=6, big_filters=True)


def seventy_two():
    return mixer(440, 500, "s72", "RANE", "SEVENTY-TWO MKII", channels=2, screens=2, paddles=True, pad_sides=True)


def djm250():
    return mixer(380, 460, "d25", "Pioneer DJ", "DJM-250MK2", channels=2)


def xone23():
    return mixer(360, 440, "x23", "Allen & Heath", "Xone:23", channels=2, big_filters=True)


def push3():
    w, h = 620, 380
    b = [chassis(w, h, gid="p3")]
    b.append(screen(190, 44, 240, 62, CYAN, "LIVE · SESSION"))
    for i in range(8):
        b.append(knob(70 + i * 16, 68, 6))
        b.append(knob(492 + i * 16, 68, 6))
    # 8x8 pad grid (drawn as 8 cols x 4 rows for legibility)
    for r in range(4):
        for c in range(8):
            col = CYAN if r < 2 else VIOLET
            b.append(f'<rect x="{86 + c*56}" y="{130 + r*52}" width="46" height="42" rx="6" fill="#1c1c2a" stroke="{col}" stroke-width="1.4"/>')
    b.append(brand(310, 28, "Ableton", "Push 3"))
    return svg_doc(w, h, "".join(b))


def mpk_mini():
    w, h = 600, 340
    b = [chassis(w, h, gid="mpk")]
    # pads left
    b.append(pads(36, 46, cols=4, rows=2, pw=36, ph=30, accents=("#f87171", AMBER)))
    for i in range(4):
        b.append(knob(240 + i * 34, 62, 11))
        b.append(knob(240 + i * 34, 102, 11))
    b.append(screen(420, 46, 120, 56, CYAN))
    # mini keys
    kw = 36
    for i in range(15):
        b.append(f'<rect x="{30 + i*kw}" y="150" width="{kw-3}" height="150" rx="4" fill="#e8e8ee" stroke="#555"/>')
    black_after = {0, 1, 3, 4, 5, 7, 8, 10, 11, 12}
    for i in range(14):
        if i in black_after:
            b.append(f'<rect x="{30 + (i+1)*kw - 13}" y="150" width="22" height="92" rx="3" fill="#14141c" stroke="#333"/>')
    b.append(brand(480, 320, "Akai Professional", "MPK Mini MK3"))
    return svg_doc(w, h, "".join(b))


def eris():
    w, h = 440, 340
    def cab(x):
        return (
            f'<rect x="{x}" y="40" width="150" height="260" rx="10" fill="#12111c" stroke="rgba(255,255,255,0.14)" stroke-width="2"/>'
            f'<circle cx="{x+75}" cy="105" r="20" fill="#08080c" stroke="#3a3a4a" stroke-width="2"/>'
            f'<circle cx="{x+75}" cy="105" r="8" fill="#222"/>'
            f'<circle cx="{x+75}" cy="205" r="46" fill="#0a0a10" stroke="#3a3a4a" stroke-width="2"/>'
            f'<circle cx="{x+75}" cy="205" r="34" fill="#141420"/>'
            f'<circle cx="{x+75}" cy="205" r="13" fill="#1e1e2c"/>'
            f'<rect x="{x+15}" y="270" width="120" height="10" rx="5" fill="#0a0a10"/>'
            f'<circle cx="{x+75}" cy="292" r="3" fill="{CYAN}"/>'
        )
    body = cab(45) + cab(245) + brand(220, 24, "PreSonus", "Eris Series")
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="100%" height="100%">{body}</svg>\n'


def rane_performer():
    w, h = 640, 380
    b = [chassis(w, h, gid="rp")]
    # motorized platters with centre displays
    for cx in (120, 520):
        b.append(platter(cx, 155, 84, accent=CYAN))
        b.append(f'<circle cx="{cx}" cy="155" r="26" fill="#0c1a24" stroke="{CYAN}" stroke-width="2"/>')
    # mixer centre, 4 strips
    b.append(f'<rect x="225" y="30" width="190" height="290" rx="8" fill="#181826" stroke="rgba(255,255,255,0.08)"/>')
    for x in (255, 298, 342, 385):
        b.append(channel_strip(x, 46))
    b.append(fader_h(280, 300, 80))
    b.append(pads(36, 268, cols=4, rows=1, pw=32, ph=20, accents=(CYAN,)))
    b.append(pads(440, 268, cols=4, rows=1, pw=32, ph=20, accents=(CYAN,)))
    b.append(pitch(206, 56, 80))
    b.append(pitch(424, 56, 80))
    b.append(brand(320, 348, "RANE", "PERFORMER"))
    return svg_doc(w, h, "".join(b))


PRODUCTS = {
    "technics-sl-1200mk7.svg": technics_1200,
    "pioneer-plx-500.svg": plx500,
    "audiotechnica-at-lp120x.svg": lp120x,
    "pioneer-djm-900nxs2.svg": djm900,
    "allen-heath-xone96.svg": xone96,
    "rane-seventy-two-mkii.svg": seventy_two,
    "pioneer-djm-250mk2.svg": djm250,
    "allen-heath-xone23.svg": xone23,
    "ableton-push-3.svg": push3,
    "akai-mpk-mini-mk3.svg": mpk_mini,
    "presonus-eris.svg": eris,
    "rane-performer.svg": rane_performer,
    "pioneer-cdj-3000.svg": cdj3000,
    "denon-sc6000.svg": sc6000,
    "rane-one.svg": rane_one,
    "numark-scratch.svg": numark_scratch,
    "roland-dj-707m.svg": roland_707m,
    "alphatheta-xdj-az.svg": xdj_az,
    "pioneer-ddj-flx6.svg": flx6,
    "pioneer-ddj-400.svg": ddj400,
    "pioneer-ddj-200.svg": ddj200,
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, fn in PRODUCTS.items():
        path = os.path.join(OUT, name)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(fn())
        print("wrote", path)


if __name__ == "__main__":
    main()
