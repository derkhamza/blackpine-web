"""
Generate the Blackpine Cabinet WEB logo: a simple, figurative stethoscope
on the brand blue-gradient rounded tile. Outputs public/icon.png.

Figurative form (no closed ring):
  • two ear-tips spread at the top,
  • two binaural tubes curving down and inward to a yoke,
  • a single tube sweeping down to a round chest-piece (gold diaphragm).

Smooth strokes are produced by stamping round dots along bezier paths,
rendered at 4x then downscaled (LANCZOS) for clean anti-aliasing.

Run: python gen_web_logo.py
"""

from PIL import Image, ImageDraw
import math, os

BRAND = (24, 144, 197)   # #1890C5
DARK  = (10,  78, 126)   # #0A4E7E
GOLD  = (212, 150,  42)  # #D4962A
WHITE = (255, 255, 255)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(HERE, "public", "icon.png")


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def quad_bezier(p0, c, p1, n=240):
    pts = []
    for i in range(n + 1):
        t = i / n
        mt = 1 - t
        x = mt * mt * p0[0] + 2 * mt * t * c[0] + t * t * p1[0]
        y = mt * mt * p0[1] + 2 * mt * t * c[1] + t * t * p1[1]
        pts.append((x, y))
    return pts


def stamp(draw, pts, w, color):
    """Stroke a polyline by stamping discs (round caps + joins)."""
    r = w / 2
    for x, y in pts:
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)


def disc(draw, cx, cy, r, color):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)


def make_icon(size=1024, ss=4):
    S = size * ss
    img = Image.new("RGB", (S, S), DARK)
    draw = ImageDraw.Draw(img)

    # full-bleed vertical gradient (brand → dark), matches app tile
    for y in range(S):
        draw.line([(0, y), (S, y)], fill=lerp(BRAND, DARK, y / (S - 1)))

    cx = S // 2
    cy = int(S * 0.47)
    R  = S * 0.30
    tube = R * 0.115            # tube thickness

    # key points
    earL = (cx - 0.60 * R, cy - 0.86 * R)
    earR = (cx + 0.60 * R, cy - 0.86 * R)
    yoke = (cx,            cy - 0.02 * R)
    cp   = (cx + 0.05 * R, cy + 0.98 * R)   # chest-piece centre

    # binaural tubes: ear-tips → yoke (gentle inward curve)
    left  = quad_bezier(earL, (cx - 0.52 * R, cy - 0.20 * R), yoke)
    right = quad_bezier(earR, (cx + 0.52 * R, cy - 0.20 * R), yoke)
    # main tube: yoke → chest-piece (soft S, slight right belly)
    main  = quad_bezier(yoke, (cx + 0.42 * R, cy + 0.46 * R),
                        (cp[0], cp[1] - 0.20 * R))

    stamp(draw, left,  tube, WHITE)
    stamp(draw, right, tube, WHITE)
    stamp(draw, main,  tube, WHITE)

    # ear-tips: rounded knobs at the top of each binaural
    knob = tube * 1.18
    for tip in (earL, earR):
        disc(draw, tip[0], tip[1], knob, WHITE)

    # chest-piece: white bell ring + gold diaphragm face
    cp_r = R * 0.225
    # short stem already covered by main-tube end; draw the bell
    disc(draw, cp[0], cp[1], cp_r, WHITE)
    disc(draw, cp[0], cp[1], cp_r - tube * 1.05, GOLD)

    img = img.resize((size, size), Image.LANCZOS)
    img.save(OUT)
    print(f"OK  {OUT}  ({size}x{size})")


if __name__ == "__main__":
    make_icon()
