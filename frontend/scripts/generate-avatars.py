"""Writes the preset avatar SVGs to frontend/public/avatars.

    python3 frontend/scripts/generate-avatars.py frontend/public/avatars

Each avatar is a 96x96 square: a flat tint behind a front-facing animal. The
animals share one ink colour, eye size and line weight so the set reads as a
family, and each one gets its own character from three layers:

  face        eyes (dot, sparkle, happy, sleepy, wink, glance, heart) and a
              mouth (smile, w, open, tongue, smirk, grin, o)
  accessory   hats, scarves, glasses and so on, placed from the animal's own
              measurements (where its eyes, crown and chin are)
  pose        a tilt, peeking over a ledge, or paws holding something

The square is full bleed; the app rounds it.

Adding or renaming an animal? Update CHARACTERS below, PRESET_AVATARS in
frontend/src/lib/avatars.ts and PresetAvatars in backend/db/avatars.go.
"""
import math
import pathlib
import re
import sys

INK = "#1C1917"
WHITE = "#FFFFFF"
CREAM = "#FFF7ED"
BLUSH = "#F49AA9"
ROSE = "#E11D48"
TONGUE = "#F2899A"
GOLD = "#F2B33D"
LEAF = "#5FA36A"

BG = {
    "sky": "#D3E5F8",
    "butter": "#F9E8B5",
    "mint": "#CDEBDF",
    "rose": "#F8D5DD",
    "lilac": "#DFD7F4",
    "sage": "#DAE6CA",
    "peach": "#F9D8C6",
    "aqua": "#CAE8EE",
    "sand": "#EDDFCB",
    "periwinkle": "#D8DDF7",
    "pistachio": "#E4EEC6",
    "coral": "#F8D0CA",
}


# Drawing helpers --------------------------------------------------------

def f(n):
    return f"{round(n, 2):g}"


def circle(cx, cy, r, fill, extra=""):
    return f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{fill}"{extra}/>'


def ellipse(cx, cy, rx, ry, fill, rotate=None, extra=""):
    t = f' transform="rotate({f(rotate)} {f(cx)} {f(cy)})"' if rotate else ""
    return f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="{fill}"{t}{extra}/>'


def path(d, fill, extra=""):
    return f'<path d="{d}" fill="{fill}"{extra}/>'


def soft(points, fill, width=4):
    """A polygon with rounded corners."""
    return (
        f'<polygon points="{points}" fill="{fill}" stroke="{fill}" '
        f'stroke-width="{f(width)}" stroke-linejoin="round"/>'
    )


def line(d, color=INK, width=1.6, extra=""):
    return (
        f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{f(width)}" '
        f'stroke-linecap="round" stroke-linejoin="round"{extra}/>'
    )


def rect(x, y, w, h, fill, r=0, extra=""):
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx="{f(r)}" fill="{fill}"{extra}/>'


def mirror(d):
    """Mirrors a path around x=48 (absolute commands with plain numbers)."""
    out, expect_x = [], True
    for t in re.findall(r"[A-Za-z]|-?\d*\.?\d+", d):
        if t.isalpha():
            out.append(t)
            expect_x = True
            continue
        n = float(t)
        out.append(f(96 - n) if expect_x else f(n))
        expect_x = not expect_x
    return " ".join(out)


def both(d, fill):
    return path(d, fill) + path(mirror(d), fill)


def ring(cx, cy, radius, count, r, fill, start=0):
    return "".join(
        circle(
            cx + radius * math.cos(math.radians(start + i * 360 / count)),
            cy + radius * math.sin(math.radians(start + i * 360 / count)),
            r,
            fill,
        )
        for i in range(count)
    )


def heart(x, y, s, fill):
    return path(
        f"M{f(x)} {f(y + s * 0.9)} C{f(x - s * 1.7)} {f(y - s * 0.15)} {f(x - s * 0.7)} {f(y - s * 1.35)} "
        f"{f(x)} {f(y - s * 0.4)} C{f(x + s * 0.7)} {f(y - s * 1.35)} {f(x + s * 1.7)} {f(y - s * 0.15)} "
        f"{f(x)} {f(y + s * 0.9)} Z",
        fill,
    )


def group(content, tilt=0, dy=0, scale=1):
    if not (tilt or dy or scale != 1):
        return content
    return (
        f'<g transform="translate(48 {f(54 + dy)}) rotate({f(tilt)}) scale({f(scale)}) translate(-48 -54)">'
        f"{content}</g>"
    )


# Species ----------------------------------------------------------------
# Each animal draws its own layers and says where its features are, so the
# shared faces and accessories land in the right place on every head.

class Species:
    def __init__(self, layers, **anchors):
        self.layers = layers
        self.eye_y = 52
        self.eye_dx = 11
        self.eye_r = 3.4
        self.eye_fill = INK       # light for eyes drawn on a dark patch
        self.eye_line = INK       # colour of closed or happy eyes
        self.mouth_y = 66         # where the mouth starts, under the nose
        self.mouth_kind = "mammal"  # mammal, wide, beak or none
        self.mouth_w = 1.0
        self.mouth_color = INK
        self.top = 30             # crown of the head, for hats
        self.top_w = 22           # half width near the crown
        self.chin = 82
        self.neck_w = 17
        self.cheek_y = 64
        self.cheek_dx = 16
        self.side = 30            # half width at eye level, for headphones
        self.skin = "#999999"
        self.paw = "#999999"
        self.__dict__.update(anchors)


def fox_layers(c):
    o, d, tip = "#EE7A35", "#B9501F", "#4A2616"
    back = (
        soft("24,14 44,33 21,46", o) + soft("72,14 52,33 75,46", o)
        + soft("24,14 31,20 22,24", tip, 2) + soft("72,14 65,20 74,24", tip, 2)
        + soft("27,24 38,33 25,39", d, 2) + soft("69,24 58,33 71,39", d, 2)
    )
    head = (
        path("M18 47 C18 33 31 30 48 35 C65 30 78 33 78 47 C78 54 76 60 73 65 L79 64 L72 71 C66 78 58 82 48 84 C38 82 30 78 24 71 L17 64 L23 65 C20 60 18 54 18 47 Z", o)
        + path("M25 59 C34 56 42 60 48 68 C54 60 62 56 71 59 C69 73 59 82 48 84 C37 82 27 73 25 59 Z", CREAM)
        + line("M42 40 Q48 37 54 40", d, 1.4)
    )
    nose = ellipse(48, 71.5, 4.4, 3.2, INK) + circle(46.6, 70.4, 1, WHITE, ' opacity="0.6"')
    return {"back": back, "head": head, "nose": nose}


def cat_layers(c):
    g, light, pink, stripe = "#7F8A9C", "#C9D0DB", "#F2A9B6", "#667185"
    back = (
        soft("19,16 42,32 19,47", g) + soft("77,16 54,32 77,47", g)
        + soft("23,25 33,32 23,39", pink, 2) + soft("73,25 63,32 73,39", pink, 2)
    )
    head = (
        ellipse(48, 55, 30, 26, g)
        + line("M44 32 L45 38 M48 31 L48 38.5 M52 32 L51 38", stripe, 2.4)
        + line("M19 54 L25 55 M20 60 L25.5 59.5 M77 54 L71 55 M76 60 L70.5 59.5", stripe, 2.2)
        + ellipse(42.5, 64, 7, 5.5, light) + ellipse(53.5, 64, 7, 5.5, light)
    )
    nose = path("M44.8 59.4 Q48 58.4 51.2 59.4 L48 63 Z", pink)
    front = line("M31 62 L16 59 M31 66 L16 68.5 M65 62 L80 59 M65 66 L80 68.5", "#4B5563", 1.3)
    return {"back": back, "head": head, "nose": nose, "front": front}


def bear_layers(c):
    b, tan, inner = "#9A6A48", "#E3C3A0", "#C7966F"
    back = circle(25, 29, 11, b) + circle(71, 29, 11, b) + circle(25, 29, 5.5, inner) + circle(71, 29, 5.5, inner)
    head = circle(48, 55, 29, b) + ellipse(48, 65, 13, 10, tan) + ellipse(48, 37, 9, 3, "#A97A57")
    nose = ellipse(48, 61, 5, 3.6, INK) + ellipse(46.3, 59.9, 1.6, 1, WHITE, extra=' opacity="0.55"')
    return {"back": back, "head": head, "nose": nose}


def panda_layers(c):
    back = circle(25, 29, 11, INK) + circle(71, 29, 11, INK)
    head = (
        circle(48, 55, 29, WHITE)
        + ellipse(37, 53, 7.5, 9.5, INK, 32) + ellipse(59, 53, 7.5, 9.5, INK, -32)
    )
    nose = ellipse(48, 63, 4.2, 3, INK)
    return {"back": back, "head": head, "nose": nose}


def rabbit_layers(c):
    fur, pink = "#FCF8F2", "#F2A9B6"
    back = (
        ellipse(37, 26, 7.5, 19, fur, -10) + ellipse(59, 26, 7.5, 19, fur, 10)
        + ellipse(37, 28, 3.6, 13, pink, -10) + ellipse(59, 28, 3.6, 13, pink, 10)
    )
    head = ellipse(48, 61, 26, 23, fur) + ellipse(48, 68, 9, 6, "#F3ECE2")
    nose = path("M45.2 64.4 Q48 63.4 50.8 64.4 L48 67.4 Z", pink)
    return {"back": back, "head": head, "nose": nose}


def owl_layers(c):
    b, disc, beak, belly, tuft = "#8B6244", "#F3E4CF", "#F0A23A", "#C29A74", "#6E4B33"
    open_beak = c.mouth in ("open", "grin")
    head = (
        path("M19 42 Q17 21 33 27 L48 33 L63 27 Q79 21 77 42 L77 66 Q77 88 48 88 Q19 88 19 66 Z", b)
        + path("M19 42 Q17 21 33 27 L30 33 Q22 32 19 42 Z", tuft) + path(mirror("M19 42 Q17 21 33 27 L30 33 Q22 32 19 42 Z"), tuft)
        + circle(37.5, 51, 12.5, disc) + circle(58.5, 51, 12.5, disc)
        + line("M25 51 Q37.5 37 50 51 M46 51 Q58.5 37 71 51", "#E3CDB0", 1.2)
        + line("M40 75 Q44 78 48 75 Q52 78 56 75", belly, 2.2)
        + line("M43 81.5 Q45.5 84 48 81.5 Q50.5 84 53 81.5", belly, 2.2)
    )
    if open_beak:
        nose = soft("44,59 52,59 48,63.5", beak, 2) + soft("45,64.5 51,64.5 48,69", "#D9852A", 2) + path("M45.5 63.6 L50.5 63.6 L48 65.2 Z", "#6B2B1C")
    else:
        nose = soft("44.5,60 51.5,60 48,67", beak, 2)
    return {"head": head, "nose": nose}


def frog_layers(c):
    g, belly = "#5EA66B", "#8DC891"
    head = (
        circle(31, 36, 12.5, g) + circle(65, 36, 12.5, g)
        + ellipse(48, 59, 33, 22, g)
        + ellipse(48, 74, 18, 6, belly)
        + circle(31, 36, 7.5, WHITE) + circle(65, 36, 7.5, WHITE)
        + circle(37, 47, 1.4, "#4C8D58") + circle(60, 46, 1.8, "#4C8D58") + circle(57, 50, 1.1, "#4C8D58")
    )
    nose = circle(44.5, 52, 1.3, INK) + circle(51.5, 52, 1.3, INK)
    return {"head": head, "nose": nose}


def penguin_layers(c):
    navy, beak = "#24313F", "#F5A524"
    open_beak = c.mouth in ("open", "grin")
    head = (
        circle(48, 54, 31, navy)
        + circle(38.5, 57, 13.5, WHITE) + circle(57.5, 57, 13.5, WHITE)
        + ellipse(48, 67, 19, 14, WHITE)
    )
    if open_beak:
        nose = path("M42.5 61 Q48 57 53.5 61 Q48 63.5 42.5 61 Z", beak) + path("M43.5 62.5 Q48 64 52.5 62.5 Q48 70 43.5 62.5 Z", "#E08E14") + path("M44.5 62.4 Q48 63.5 51.5 62.4 Q48 64.6 44.5 62.4 Z", "#7A2E1B")
    else:
        nose = path("M42.5 62 Q48 58 53.5 62 Q48 70 42.5 62 Z", beak) + line("M43.5 62.6 Q48 64 52.5 62.6", "#D88714", 1)
    return {"head": head, "nose": nose}


def koala_layers(c):
    g, inner, nose = "#99A2AE", "#EDE6EA", "#3A3844"
    back = circle(21, 40, 15, g) + circle(75, 40, 15, g) + ring(21, 40, 8, 7, 3.5, inner, 10) + ring(75, 40, 8, 7, 3.5, inner, 10) + circle(21, 40, 7, inner) + circle(75, 40, 7, inner)
    head = ellipse(48, 57, 27, 26, g) + ellipse(48, 74, 13, 6, "#AEB6C0")
    n = (
        path("M48 52 C53.5 52 55 56 55 61 C55 67 52 70 48 70 C44 70 41 67 41 61 C41 56 42.5 52 48 52 Z", nose)
        + ellipse(46, 56.5, 1.6, 2.6, WHITE, extra=' opacity="0.35"')
    )
    return {"back": back, "head": head, "nose": n}


def lion_layers(c):
    mane, mane2, face, muz, nose = "#C8692B", "#A9531F", "#F2B550", "#FCE5BC", "#5A3421"
    back = circle(48, 53, 30, mane) + ring(48, 53, 29, 12, 9, mane, 15) + ring(48, 53, 24, 12, 5, mane2, 0)
    head = (
        circle(32, 34, 6.5, face) + circle(64, 34, 6.5, face)
        + circle(32, 34, 3.2, mane) + circle(64, 34, 3.2, mane)
        + circle(48, 55, 22, face)
        + ellipse(43.5, 64, 6.5, 5.2, muz) + ellipse(52.5, 64, 6.5, 5.2, muz)
        + circle(41, 64, 0.8, "#C8862F") + circle(39, 66, 0.8, "#C8862F") + circle(55, 64, 0.8, "#C8862F") + circle(57, 66, 0.8, "#C8862F")
    )
    n = path("M44.6 59 Q48 57.8 51.4 59 L48 62.4 Z", nose)
    return {"back": back, "head": head, "nose": n}


def dog_layers(c):
    tan, ear, muz, patch = "#D9A066", "#8A593A", "#FFF3E2", "#B87D4B"
    head = (
        ellipse(48, 53, 25, 26, tan)
        + ellipse(58.5, 48, 7.5, 8.5, patch)
        + both("M27 31 Q13 33 15 57 Q16 67 25 64 Q30 50 31 37 Z", ear)
        + ellipse(48, 66, 13.5, 10, muz)
    )
    nose = ellipse(48, 61.5, 5.2, 3.8, INK) + ellipse(46.2, 60.3, 1.7, 1, WHITE, extra=' opacity="0.55"')
    return {"head": head, "nose": nose}


def mouse_layers(c):
    g, pink = "#B3B3BF", "#F2A9B6"
    back = circle(25, 33, 15.5, g) + circle(71, 33, 15.5, g) + circle(25, 33, 9.5, pink) + circle(71, 33, 9.5, pink)
    head = ellipse(48, 59, 24, 22, g) + ellipse(48, 70, 11, 7, "#C6C6D0")
    nose = circle(48, 65.5, 3.6, "#E8899A") + circle(47, 64.5, 1, WHITE, ' opacity="0.6"')
    front = line("M34 64 L21 61 M34 67.5 L21 69.5 M62 64 L75 61 M62 67.5 L75 69.5", "#6B6B78", 1.3)
    return {"back": back, "head": head, "nose": nose, "front": front}


def pig_layers(c):
    p, d, snout, nostril = "#F4A6B6", "#E07F96", "#F8C6D0", "#C25E78"
    back = soft("21,24 40,31 27,45", d) + soft("75,24 56,31 69,45", d)
    head = circle(48, 56, 28, p)
    nose = (
        ellipse(48, 64, 11.5, 8.5, snout)
        + ellipse(44.3, 64, 1.9, 2.8, nostril) + ellipse(51.7, 64, 1.9, 2.8, nostril)
    )
    return {"back": back, "head": head, "nose": nose}


def raccoon_layers(c):
    g, d, w = "#8C9099", "#2E3036", "#F5F4F1"
    back = soft("21,20 40,30 25,45", g) + soft("75,20 56,30 71,45", g) + soft("25,27 34,31 26,38", d, 2) + soft("71,27 62,31 70,38", d, 2)
    head = (
        ellipse(48, 56, 30, 26, g)
        + path("M24 54 Q30 40 48 45 Q66 40 72 54 Q70 74 48 80 Q26 74 24 54 Z", w)
        + path("M44 31 Q48 29 52 31 L50 46 Q48 47 46 46 Z", "#6F737C")
        + path("M22 51 Q35 41 48 50 Q61 41 74 51 Q70 62 58 59.5 Q48 56 38 59.5 Q26 62 22 51 Z", d)
    )
    nose = ellipse(48, 64.5, 4.4, 3.2, INK)
    return {"back": back, "head": head, "nose": nose}


def tiger_layers(c):
    o, w, s = "#F08A33", "#FFF5E8", "#2B2320"
    back = circle(26, 31, 10, o) + circle(70, 31, 10, o) + circle(26, 31, 5, w) + circle(70, 31, 5, w)
    head = (
        ellipse(48, 56, 30, 26, o)
        + line("M44 33 L45.5 40 M48 32 L48 41 M52 33 L50.5 40", s, 2.6)
        + line("M18.5 52 L27 54 M19 59.5 L27 59 M77.5 52 L69 54 M77 59.5 L69 59", s, 2.6)
        + ellipse(42.5, 65, 8, 6.5, w) + ellipse(53.5, 65, 8, 6.5, w) + ellipse(48, 71, 7, 5, w)
        + ellipse(37, 45, 3, 1.6, w, -15) + ellipse(59, 45, 3, 1.6, w, 15)
    )
    nose = path("M44.6 60.4 Q48 59.2 51.4 60.4 L48 64 Z", "#B9473A")
    return {"back": back, "head": head, "nose": nose}


def chick_layers(c):
    y, beak, wing = "#F7C948", "#F08A33", "#E9B42A"
    open_beak = c.mouth in ("open", "grin")
    head = (
        path("M44 31 Q40 19 48 24 Q56 19 52 31 Z", y)
        + circle(48, 56, 28, y)
        + ellipse(22, 63, 5, 9, wing, 20) + ellipse(74, 63, 5, 9, wing, -20)
    )
    if open_beak:
        nose = soft("42.5,58.5 53.5,58.5 48,62.5", beak, 2) + soft("44,63.5 52,63.5 48,67.5", "#D9741F", 2) + path("M44.5 62.4 L51.5 62.4 L48 64.4 Z", "#7A2E1B")
    else:
        nose = soft("42.5,59 53.5,59 48,66", beak, 2)
    return {"head": head, "nose": nose}


def monkey_layers(c):
    b, face = "#8C5A3B", "#EBC7A3"
    back = circle(19, 53, 10.5, b) + circle(77, 53, 10.5, b) + circle(19, 53, 5.5, face) + circle(77, 53, 5.5, face)
    head = (
        circle(48, 52, 28, b)
        + path("M40 26 Q44 20 48 25 Q52 19 56 26", b)
        + circle(40, 50, 10.5, face) + circle(56, 50, 10.5, face) + ellipse(48, 63, 17, 13, face)
    )
    nose = circle(46, 60, 1.2, INK) + circle(50, 60, 1.2, INK)
    return {"back": back, "head": head, "nose": nose}


def sheep_layers(c):
    wool, face, shade = "#FFFFFF", "#3B3437", "#EFEAF3"
    back = circle(48, 48, 23, wool) + ring(48, 48, 21, 8, 12, wool, 22.5) + ring(48, 48, 25, 8, 4, shade, 0)
    head = (
        ellipse(32, 55, 7.5, 4, face, 40) + ellipse(64, 55, 7.5, 4, face, -40)
        + ellipse(48, 60, 13, 17.5, face)
        + circle(42, 44, 6.5, wool) + circle(48, 41.5, 7, wool) + circle(54, 44, 6.5, wool)
    )
    return {"back": back, "head": head}


def deer_layers(c):
    fur, muz, antler, inner = "#B97A4D", "#F3DFC8", "#7A4F33", "#E9B79C"
    back = (
        line("M40 36 L36 22 L30 16 M36 22 L40 13 M37.5 27 L31 26", antler, 3.6)
        + line("M56 36 L60 22 L66 16 M60 22 L56 13 M58.5 27 L65 26", antler, 3.6)
        + ellipse(23, 46, 11, 5.5, fur, -25) + ellipse(73, 46, 11, 5.5, fur, 25)
        + ellipse(23, 46, 7, 3, inner, -25) + ellipse(73, 46, 7, 3, inner, 25)
    )
    head = (
        ellipse(48, 58, 22, 25, fur)
        + ellipse(48, 71, 11.5, 9, muz)
        + circle(43, 40, 1.8, CREAM) + circle(49.5, 38, 1.5, CREAM) + circle(53, 42.5, 1.6, CREAM)
    )
    nose = ellipse(48, 67.5, 4.6, 3.3, INK) + ellipse(46.4, 66.6, 1.4, 0.8, WHITE, extra=' opacity="0.55"')
    return {"back": back, "head": head, "nose": nose}


def elephant_layers(c):
    g, ear, inner, wrinkle = "#A7B0BE", "#B8C0CC", "#EEC7D0", "#8E98A8"
    back = ellipse(21, 50, 15, 19, ear, -8) + ellipse(75, 50, 15, 19, ear, 8) + ellipse(22, 51, 9, 13, inner, -8) + ellipse(74, 51, 9, 13, inner, 8)
    head = (
        circle(48, 50, 23, g)
        + line("M48 58 C47 70 43 77 49 81 C53 83.5 58 81 57.5 76", g, 10)
        + line("M44 66 L48.5 66.5 M43.5 71 L48 72 M45 76 L49 77.5", wrinkle, 1.3)
        + path("M40 62 Q41 67 44 68 L42.5 63 Z", CREAM) + path(mirror("M40 62 Q41 67 44 68 L42.5 63 Z"), CREAM)
    )
    return {"back": back, "head": head}


def hedgehog_layers(c):
    spike, spike2, face, inner = "#6B4E3D", "#8C6A54", "#F1D9BC", "#F2A9B6"
    pts = []
    for i in range(23):
        a = math.radians(160 + i * 220 / 22)
        r = 37 if i % 2 == 0 else 28
        pts.append(f"{f(48 + r * math.cos(a))},{f(54 + r * math.sin(a))}")
    pts += ["66,70", "30,70"]
    pts2 = []
    for i in range(21):
        a = math.radians(166 + i * 208 / 20)
        r = 30 if i % 2 == 0 else 23
        pts2.append(f"{f(48 + r * math.cos(a))},{f(56 + r * math.sin(a))}")
    pts2 += ["64,70", "32,70"]
    back = soft(" ".join(pts), spike, 2) + soft(" ".join(pts2), spike2, 2)
    head = (
        circle(33, 44, 5, face) + circle(63, 44, 5, face) + circle(33, 44, 2.6, inner) + circle(63, 44, 2.6, inner)
        + ellipse(48, 58, 20, 18, face)
        + ellipse(48, 65, 7, 5, "#F7E6D0")
    )
    nose = circle(48, 64.4, 2.6, INK) + circle(47.2, 63.6, 0.8, WHITE, ' opacity="0.6"')
    return {"back": back, "head": head, "nose": nose}


def otter_layers(c):
    b, light, nose = "#8A6046", "#D7B48F", "#2F2420"
    back = circle(25, 38, 6.5, b) + circle(71, 38, 6.5, b) + circle(25, 38, 3.2, light) + circle(71, 38, 3.2, light)
    head = (
        ellipse(48, 56, 27, 24, b)
        + ellipse(48, 67, 18, 12.5, light)
        + ellipse(37, 45, 5, 3, light, -10) + ellipse(59, 45, 5, 3, light, 10)
    )
    n = path("M43 59.5 Q48 58 53 59.5 Q52 64 48 65 Q44 64 43 59.5 Z", nose)
    front = (
        circle(40, 66, 0.9, "#8E6A4C") + circle(37.5, 68.5, 0.9, "#8E6A4C") + circle(56, 66, 0.9, "#8E6A4C") + circle(58.5, 68.5, 0.9, "#8E6A4C")
        + line("M35 65 L23 62.5 M35 68 L23 70 M61 65 L73 62.5 M61 68 L73 70", "#5C4434", 1.2)
    )
    return {"back": back, "head": head, "nose": n, "front": front}


def sloth_layers(c):
    fur, face, patch = "#B19A84", "#EAD8C2", "#7A5F4B"
    head = (
        circle(48, 54, 28, fur)
        + path("M40 27 Q44 23 48 27 Q52 23 56 27 L52 31 L44 31 Z", "#9E8670")
        + ellipse(48, 57, 21, 18, face)
        + ellipse(38, 54.5, 7.5, 4.2, patch, 20) + ellipse(58, 54.5, 7.5, 4.2, patch, -20)
    )
    nose = ellipse(48, 62, 4.2, 3, "#3B2A20")
    return {"head": head, "nose": nose}


def giraffe_layers(c):
    y, spot, muz, horn, knob = "#F2C14E", "#C9802E", "#F8DDA0", "#B3742D", "#7E4A1E"
    back = (
        rect(39, 66, 18, 32, y)
        + path("M41 80 q4 -3 7 0 q-1 4 -4 4 q-3 0 -3 -4 Z", spot) + path("M50 90 q4 -2 6 1 q-1 4 -4 3 q-3 -1 -2 -4 Z", spot)
        + line("M42 31 L39.5 17 M54 31 L56.5 17", horn, 4) + circle(39.5, 16, 4, knob) + circle(56.5, 16, 4, knob)
        + ellipse(25, 40, 10, 4.6, y, -28) + ellipse(71, 40, 10, 4.6, y, 28)
        + ellipse(25, 40, 6, 2.4, "#E9A17D", -28) + ellipse(71, 40, 6, 2.4, "#E9A17D", 28)
    )
    head = (
        ellipse(48, 52, 20, 23, y)
        + path("M33 39 q3 -4 7 -2 q1 4 -2 6 q-4 1 -5 -4 Z", spot) + path("M56 36 q4 -2 6 1 q0 4 -3 5 q-4 0 -3 -6 Z", spot)
        + ellipse(31.5, 55, 2.6, 3.4, spot) + ellipse(64.5, 56, 2.4, 3, spot)
        + ellipse(48, 67, 15, 11, muz)
    )
    nose = ellipse(43.5, 66, 1.6, 1.2, "#8A5A2B") + ellipse(52.5, 66, 1.6, 1.2, "#8A5A2B")
    return {"back": back, "head": head, "nose": nose}


def cow_layers(c):
    w, spot, muz, nostril, horn, inner = "#FFFFFF", "#2E2A28", "#F4B8C2", "#C77A88", "#EFE3C8", "#F2A9B6"
    back = (
        path("M30 36 Q24 30 26 20 Q30 27 36 30 Z", horn) + path(mirror("M30 36 Q24 30 26 20 Q30 27 36 30 Z"), horn)
        + ellipse(22, 47, 10, 5, w, 20) + ellipse(74, 47, 10, 5, w, -20)
        + ellipse(22, 47, 6, 2.6, inner, 20) + ellipse(74, 47, 6, 2.6, inner, -20)
    )
    head = (
        ellipse(48, 52, 24, 23, w)
        + path("M25.5 41 Q26 31 37 29.5 Q43 31 41.5 37 Q38 43 30.5 44.5 Q26 44 25.5 41 Z", spot)
        + ellipse(66, 57, 4.5, 6, spot, 15)
        + path("M44 31 Q46 27 48 31 Q50 27 52 31", "#8A5A3B")
        + ellipse(48, 68, 18, 11, muz)
    )
    nose = ellipse(42, 66.5, 2.2, 3, nostril) + ellipse(54, 66.5, 2.2, 3, nostril)
    return {"back": back, "head": head, "nose": nose}


def hamster_layers(c):
    g, w, inner = "#E9A869", "#FFF3E4", "#F2A9B6"
    back = circle(28, 38, 7, g) + circle(68, 38, 7, g) + circle(28, 38, 4, inner) + circle(68, 38, 4, inner)
    head = (
        ellipse(48, 58, 30, 24, g)
        + path("M44 35 Q48 33 52 35 L50.5 48 Q48 49 45.5 48 Z", w)
        + ellipse(31, 66, 12.5, 10.5, w) + ellipse(65, 66, 12.5, 10.5, w)
        + ellipse(48, 66, 9, 7, w)
    )
    nose = circle(48, 61.5, 2.2, "#E8899A")
    return {"back": back, "head": head, "nose": nose}


def unicorn_layers(c):
    w, muz, nostril, inner = "#FFFDF9", "#FBE3EA", "#D98BA2", "#F7C6D4"
    mane = ["#F7A8C4", "#C9B6F2", "#9FD8E0", "#F7A8C4", "#C9B6F2", "#9FD8E0"]
    manes = "".join(circle(x, y, r, mane[i]) for i, (x, y, r) in enumerate([(56, 30, 7), (63, 34, 7.5), (68, 42, 7.5), (71, 51, 7.5), (71.5, 60, 7), (70, 68, 6)]))
    back = (
        soft("30,26 41,36 30,42", w) + soft("66,26 55,36 66,42", w)
        + soft("32,31 38,36 32,39", inner, 1.5) + soft("64,31 58,36 64,39", inner, 1.5)
        + manes
    )
    head = (
        ellipse(48, 56, 21, 25, w)
        + circle(42, 34, 6, mane[0]) + circle(37, 39, 5, mane[1])
        + ellipse(48, 70, 13, 9.5, muz)
    )
    horn = soft("44.5,33 51.5,33 48,11", "#F6D27A", 2) + line("M45.2 28 L50.6 26 M46.2 22 L49.8 20.5 M47 16.5 L48.9 15.8", "#E3B04B", 1.3)
    nose = ellipse(44, 70, 1.6, 1.3, nostril) + ellipse(52, 70, 1.6, 1.3, nostril)
    return {"back": back, "head": head + horn, "nose": nose}


def dinosaur_layers(c):
    t, belly, spike, spot = "#4FB3A9", "#9ADBD2", "#F2C14E", "#3E9A90"
    back = soft("38,31 43,19 48,30", spike, 2) + soft("44,29 50,15 56,29", spike, 2) + soft("50,30 55,19 60,31", spike, 2)
    head = (
        path("M22 52 Q22 28 48 28 Q74 28 74 52 L74 66 Q74 82 48 82 Q22 82 22 66 Z", t)
        + path("M30 68 Q48 84 66 68 Q66 80 48 82 Q30 80 30 68 Z", belly)
        + circle(29, 40, 2.4, spot) + circle(34, 35, 1.6, spot) + circle(67, 41, 2.2, spot) + circle(63, 35.5, 1.4, spot)
    )
    nose = circle(43.5, 58, 1.4, "#2E7C74") + circle(52.5, 58, 1.4, "#2E7C74")
    return {"back": back, "head": head, "nose": nose}


def axolotl_layers(c):
    p, gill, gill2 = "#F7B2C4", "#E57A9A", "#F09AB3"
    gills = ""
    for sign in (-1, 1):
        for (x2, y2) in ((10, 40), (7, 56), (11, 72)):
            x1, y1 = 48 + sign * 24, 50 + (y2 - 40) * 0.35
            xe = 48 + sign * (48 - x2)
            gills += line(f"M{f(x1)} {f(y1)} L{f(xe)} {f(y2)}", gill, 4)
            for k in (0.35, 0.6, 0.85):
                cx, cy = x1 + (xe - x1) * k, y1 + (y2 - y1) * k
                gills += circle(cx, cy - 2.6, 2.2, gill2) + circle(cx, cy + 2.6, 2.2, gill2)
    head = ellipse(48, 58, 28, 21, p) + ellipse(48, 71, 16, 6, "#F9C6D3")
    return {"back": gills, "head": head}


def redpanda_layers(c):
    r, w, d = "#D2642E", "#FFF6EC", "#6B2E16"
    back = soft("20,24 40,30 26,46", r) + soft("76,24 56,30 70,46", r) + soft("24,30 35,32 27,41", w, 2) + soft("72,30 61,32 69,41", w, 2)
    head = (
        ellipse(48, 56, 28, 24, r)
        + ellipse(27, 63, 7.5, 8.5, w) + ellipse(69, 63, 7.5, 8.5, w)
        + ellipse(37, 44, 5, 3.4, w) + ellipse(59, 44, 5, 3.4, w)
        + line("M37 57 L40.5 67 M59 57 L55.5 67", d, 3.6)
        + ellipse(48, 68, 14, 10, w)
    )
    nose = ellipse(48, 64.5, 4.2, 3, INK)
    return {"back": back, "head": head, "nose": nose}


SPECIES = {
    "fox": Species(fox_layers, eye_y=52, mouth_y=74.5, top=35, top_w=20, chin=84, cheek_y=65, skin="#EE7A35", paw="#3A2A22", side=29),
    "cat": Species(cat_layers, eye_y=51, mouth_y=63, top=31, chin=81, cheek_dx=17, skin="#7F8A9C", paw="#C9D0DB"),
    "bear": Species(bear_layers, eye_y=50, mouth_y=64.6, top=27, chin=84, cheek_y=62, cheek_dx=19, skin="#9A6A48", paw="#7E5539"),
    "panda": Species(panda_layers, eye_y=52, eye_dx=11, eye_r=3, eye_fill=WHITE, eye_line=WHITE, mouth_y=66, top=27, chin=84, cheek_y=65, cheek_dx=17, skin=WHITE, paw=INK),
    "rabbit": Species(rabbit_layers, eye_y=58, eye_dx=10, eye_r=3.2, mouth_y=67.4, top=39, top_w=18, chin=84, cheek_y=68, cheek_dx=14, skin="#FCF8F2", paw="#FCF8F2", side=26),
    "owl": Species(owl_layers, eye_y=51, eye_dx=10.5, eye_r=6.2, mouth_kind="beak", top=27, chin=86, cheek_y=0, skin="#8B6244", paw="#8B6244"),
    "frog": Species(frog_layers, eye_y=37, eye_dx=17, eye_r=4, mouth_kind="wide", mouth_y=60, mouth_w=1.4, top=38, top_w=14, chin=81, cheek_y=63, cheek_dx=24, skin="#5EA66B", paw="#5EA66B", side=33),
    "penguin": Species(penguin_layers, eye_y=56, eye_dx=9.5, eye_r=3.2, mouth_kind="beak", top=24, top_w=24, chin=85, cheek_y=66, cheek_dx=17, skin="#24313F", paw="#24313F", side=31),
    "koala": Species(koala_layers, eye_y=50, eye_dx=13, eye_r=3.1, mouth_y=70.5, top=32, chin=83, cheek_y=63, cheek_dx=18, skin="#99A2AE", paw="#99A2AE", side=27),
    "lion": Species(lion_layers, eye_y=51, eye_dx=8.5, eye_r=3, mouth_y=62.4, top=22, top_w=24, chin=86, cheek_y=60, cheek_dx=13, skin="#F2B550", paw="#F2B550", side=33),
    "dog": Species(dog_layers, eye_y=48, eye_dx=10.5, eye_r=3.2, mouth_y=65.3, top=28, top_w=18, chin=79, cheek_y=60, skin="#D9A066", paw="#D9A066", side=27),
    "mouse": Species(mouse_layers, eye_y=56, eye_dx=9, eye_r=3.1, mouth_y=69.1, top=38, top_w=16, chin=81, cheek_y=66, cheek_dx=15, skin="#B3B3BF", paw="#C6C6D0", side=24),
    "pig": Species(pig_layers, eye_y=51, eye_dx=11.5, eye_r=3.2, mouth_y=73.5, top=29, top_w=20, chin=84, cheek_y=62, cheek_dx=19, skin="#F4A6B6", paw="#F4A6B6"),
    "raccoon": Species(raccoon_layers, eye_y=52.5, eye_dx=11, eye_r=3, eye_fill=WHITE, eye_line=WHITE, mouth_y=67.7, top=31, chin=82, cheek_y=68, cheek_dx=15, skin="#8C9099", paw="#2E3036"),
    "tiger": Species(tiger_layers, eye_y=51, eye_dx=11, eye_r=3.3, mouth_y=64, top=31, chin=82, cheek_y=0, skin="#F08A33", paw="#F08A33"),
    "chick": Species(chick_layers, eye_y=52, eye_dx=9.5, eye_r=3.3, mouth_kind="beak", top=28, top_w=20, chin=84, cheek_y=62, cheek_dx=15, skin="#F7C948", paw="#E9B42A", side=28),
    "monkey": Species(monkey_layers, eye_y=50, eye_dx=8, eye_r=3, mouth_y=64, top=25, chin=80, cheek_y=58, cheek_dx=14, skin="#8C5A3B", paw="#EBC7A3", side=28),
    "sheep": Species(sheep_layers, eye_y=58, eye_dx=4.8, eye_r=2.7, eye_fill=WHITE, eye_line="#F5EDE6", mouth_y=67, mouth_color="#F5EDE6", mouth_w=0.8, top=26, top_w=20, chin=77, cheek_y=64.5, cheek_dx=9, skin="#3B3437", paw="#3B3437", side=14),
    "deer": Species(deer_layers, eye_y=55, eye_dx=10, eye_r=3.2, mouth_y=70.8, top=33, top_w=16, chin=83, cheek_y=64, cheek_dx=15, skin="#B97A4D", paw="#B97A4D", side=22),
    "elephant": Species(elephant_layers, eye_y=47, eye_dx=10, eye_r=3, mouth_kind="none", top=27, chin=74, cheek_y=57, cheek_dx=15, skin="#A7B0BE", paw="#A7B0BE", side=23),
    "hedgehog": Species(hedgehog_layers, eye_y=56, eye_dx=8, eye_r=3, mouth_y=67, top=19, top_w=18, chin=76, cheek_y=62, cheek_dx=13, skin="#F1D9BC", paw="#F1D9BC", side=20),
    "otter": Species(otter_layers, eye_y=51, eye_dx=12, eye_r=3.2, mouth_y=65, top=32, chin=80, cheek_y=63, cheek_dx=17, skin="#8A6046", paw="#8A6046", side=27),
    "sloth": Species(sloth_layers, eye_y=54.5, eye_dx=10, eye_r=2.8, mouth_y=65, top=26, chin=82, cheek_y=63, cheek_dx=16, skin="#B19A84", paw="#B19A84"),
    "giraffe": Species(giraffe_layers, eye_y=49, eye_dx=10, eye_r=3.2, mouth_y=72.5, top=29, top_w=16, chin=80, neck_w=10, cheek_y=60, cheek_dx=15, skin="#F2C14E", paw="#F2C14E", side=20),
    "cow": Species(cow_layers, eye_y=49, eye_dx=10, eye_r=3.2, mouth_y=72.5, top=29, chin=79, cheek_y=0, skin=WHITE, paw=WHITE, side=24),
    "hamster": Species(hamster_layers, eye_y=54, eye_dx=10, eye_r=3.2, mouth_y=63.7, mouth_w=0.8, top=34, chin=82, cheek_y=64, cheek_dx=18, skin="#E9A869", paw="#F4C9A0"),
    "unicorn": Species(unicorn_layers, eye_y=52, eye_dx=9.5, eye_r=3.2, mouth_y=74.5, top=31, top_w=16, chin=81, cheek_y=63, cheek_dx=14, skin="#FFFDF9", paw="#FFFDF9", side=21),
    "dinosaur": Species(dinosaur_layers, eye_y=47, eye_dx=12, eye_r=3.4, mouth_kind="wide", mouth_y=66, mouth_w=1.15, top=28, top_w=22, chin=82, cheek_y=60, cheek_dx=19, skin="#4FB3A9", paw="#4FB3A9", side=26),
    "axolotl": Species(axolotl_layers, eye_y=56, eye_dx=15, eye_r=2.8, mouth_kind="wide", mouth_y=63, mouth_w=0.65, top=37, top_w=20, chin=79, cheek_y=63, cheek_dx=21, skin="#F7B2C4", paw="#F7B2C4", side=28),
    "redpanda": Species(redpanda_layers, eye_y=52, eye_dx=11, eye_r=3.2, mouth_y=67.5, top=32, chin=80, cheek_y=0, skin="#D2642E", paw="#3B2016"),
}


# Faces ------------------------------------------------------------------

def eyes(sp, style, lashes=False):
    out = ""
    r = sp.eye_r
    light = sp.eye_fill != INK
    w = max(1.7, r * 0.55)
    for i, x in enumerate((48 - sp.eye_dx, 48 + sp.eye_dx)):
        y = sp.eye_y
        kind = style
        if style == "wink":
            kind = "dot" if i == 0 else "happy"
        if kind == "dot":
            out += circle(x, y, r, sp.eye_fill)
            if light:
                out += circle(x + r * 0.12, y + r * 0.12, r * 0.56, INK)
            out += circle(x + r * 0.32, y - r * 0.36, r * 0.3, WHITE)
        elif kind == "sparkle":
            rr = r * 1.18
            out += circle(x, y, rr, sp.eye_fill)
            if light:
                out += circle(x, y + rr * 0.08, rr * 0.66, INK)
            out += circle(x + rr * 0.3, y - rr * 0.34, rr * 0.36, WHITE)
            out += circle(x - rr * 0.34, y + rr * 0.34, rr * 0.17, WHITE)
        elif kind == "happy":
            out += line(f"M{f(x - r * 1.05)} {f(y + r * 0.4)} Q{f(x)} {f(y - r * 1.05)} {f(x + r * 1.05)} {f(y + r * 0.4)}", sp.eye_line, w)
        elif kind == "sleepy":
            out += line(f"M{f(x - r * 1.05)} {f(y - r * 0.2)} Q{f(x)} {f(y + r * 0.95)} {f(x + r * 1.05)} {f(y - r * 0.2)}", sp.eye_line, w)
        elif kind == "glance":
            # Half-closed, looking to the side.
            out += path(f"M{f(x - r * 1.05)} {f(y - r * 0.1)} L{f(x + r * 1.05)} {f(y - r * 0.1)} A{f(r * 1.05)} {f(r * 0.85)} 0 0 1 {f(x - r * 1.05)} {f(y - r * 0.1)} Z", sp.eye_fill)
            if light:
                out += circle(x + r * 0.45, y + r * 0.2, r * 0.5, INK)
            out += line(f"M{f(x - r * 1.3)} {f(y - r * 0.25)} L{f(x + r * 1.3)} {f(y - r * 0.45)}", sp.eye_line, w * 0.85)
        elif kind == "heart":
            out += heart(x, y, r * 1.05, ROSE)
            out += circle(x - r * 0.45, y - r * 0.45, r * 0.25, WHITE, ' opacity="0.8"')
        if lashes and kind not in ("heart",):
            sgn = -1 if i == 0 else 1
            ox = x + sgn * r * 0.95
            out += line(f"M{f(ox)} {f(y - r * 0.55)} L{f(ox + sgn * r * 0.7)} {f(y - r * 1.15)} M{f(x + sgn * r * 0.35)} {f(y - r * 1.05)} L{f(x + sgn * r * 0.55)} {f(y - r * 1.75)}", sp.eye_line, 1.3)
    return out


def mouth(sp, style):
    if sp.mouth_kind in ("beak", "none") or style == "none":
        return ""
    c, y, k = sp.mouth_color, sp.mouth_y, sp.mouth_w
    if sp.mouth_kind == "wide":
        hw = 14 * k
        if style in ("open", "grin"):
            d = f"M{f(48 - hw)} {f(y)} Q48 {f(y + 2)} {f(48 + hw)} {f(y)} Q{f(48 + hw * 0.8)} {f(y + 11 * k)} 48 {f(y + 11 * k)} Q{f(48 - hw * 0.8)} {f(y + 11 * k)} {f(48 - hw)} {f(y)} Z"
            out = path(d, "#5C1E24")
            if style == "open":
                out += ellipse(48, y + 8 * k, hw * 0.45, 3 * k, TONGUE)
            else:
                for i in range(4):
                    tx = 48 - hw * 0.6 + i * hw * 0.4
                    out += soft(f"{f(tx - 1.6)},{f(y + 1.2)} {f(tx + 1.6)},{f(y + 1.2)} {f(tx)},{f(y + 4)}", WHITE, 0.8)
            return out
        return line(f"M{f(48 - hw)} {f(y)} Q48 {f(y + 9 * k)} {f(48 + hw)} {f(y)}", c, 2.2)
    sx = lambda dx: f(48 + dx * k)
    if style == "smile":
        return line(f"M48 {f(y)} L48 {f(y + 1.6)} M{sx(-4)} {f(y + 1.8)} Q48 {f(y + 4.8)} {sx(4)} {f(y + 1.8)}", c, 1.6)
    if style == "w":
        return line(f"M48 {f(y)} Q{sx(-1.4)} {f(y + 3)} {sx(-4)} {f(y + 2.4)} M48 {f(y)} Q{sx(1.4)} {f(y + 3)} {sx(4)} {f(y + 2.4)}", c, 1.5)
    if style == "smirk":
        return line(f"M48 {f(y)} L48 {f(y + 1.4)} M{sx(-3.5)} {f(y + 2.8)} Q{sx(0.5)} {f(y + 4)} {sx(4.5)} {f(y + 1)}", c, 1.6)
    if style == "o":
        return line(f"M48 {f(y)} L48 {f(y + 1.2)}", c, 1.5) + ellipse(48, y + 4, 2.2 * k, 2.6 * k, c)
    if style in ("open", "grin", "tongue"):
        top = y + 1.2
        d = f"M{sx(-5)} {f(top)} Q48 {f(top + 1)} {sx(5)} {f(top)} Q{sx(4.5)} {f(top + 7)} 48 {f(top + 7)} Q{sx(-4.5)} {f(top + 7)} {sx(-5)} {f(top)} Z"
        out = line(f"M48 {f(y)} L48 {f(top + 0.4)}", c, 1.5)
        if style == "tongue":
            out = line(f"M48 {f(y)} L48 {f(y + 1.6)} M{sx(-4.5)} {f(y + 1.8)} Q48 {f(y + 4.6)} {sx(4.5)} {f(y + 1.8)}", c, 1.6)
            out += path(f"M{sx(-2.8)} {f(y + 3.4)} L{sx(2.8)} {f(y + 3.4)} L{sx(2.8)} {f(y + 7.5)} Q48 {f(y + 10.5)} {sx(-2.8)} {f(y + 7.5)} Z", TONGUE)
            out += line(f"M48 {f(y + 4)} L48 {f(y + 7.6)}", "#D96C80", 1)
            return out
        out += path(d, "#5C1E24")
        out += ellipse(48, top + 5.2, 2.8 * k, 1.8, TONGUE)
        if style == "grin":
            out += soft(f"{sx(-3.8)},{f(top + 0.6)} {sx(-1.6)},{f(top + 0.6)} {sx(-2.7)},{f(top + 3)}", WHITE, 0.6)
            out += soft(f"{sx(1.6)},{f(top + 0.6)} {sx(3.8)},{f(top + 0.6)} {sx(2.7)},{f(top + 3)}", WHITE, 0.6)
        return out
    return ""


def blush(sp, color=BLUSH, opacity=0.55):
    if not sp.cheek_y:
        return ""
    return "".join(circle(48 + s * sp.cheek_dx, sp.cheek_y, 3.8, color, f' opacity="{opacity}"') for s in (-1, 1))


# Accessories --------------------------------------------------------------
# Each returns SVG drawn on top of the head, inside the head's own tilt.

def party_hat(sp, color=ROSE, trim=CREAM):
    t = sp.top
    return (
        f'<g transform="rotate(-14 48 {f(t)})">'
        + path(f"M37 {f(t + 2)} L48 {f(t - 24)} L59 {f(t + 2)} Q48 {f(t + 6)} 37 {f(t + 2)} Z", color)
        + line(f"M41.4 {f(t - 8)} L54.6 {f(t - 8)}", trim, 2.2) + line(f"M44.4 {f(t - 16)} L51.6 {f(t - 16)}", trim, 2.2)
        + path(f"M37 {f(t + 2)} Q48 {f(t + 6)} 59 {f(t + 2)} L59 {f(t + 4)} Q48 {f(t + 8.5)} 37 {f(t + 4)} Z", trim)
        + circle(48, t - 25, 3.8, "#FDE68A")
        + "</g>"
    )


def crown(sp):
    t = sp.top
    return (
        path(f"M37 {f(t + 3)} L36 {f(t - 9)} L42.5 {f(t - 2)} L48 {f(t - 13)} L53.5 {f(t - 2)} L60 {f(t - 9)} L59 {f(t + 3)} Q48 {f(t + 5.5)} 37 {f(t + 3)} Z", GOLD)
        + path(f"M37 {f(t + 0.5)} Q48 {f(t + 3)} 59 {f(t + 0.5)} L59 {f(t + 3)} Q48 {f(t + 5.5)} 37 {f(t + 3)} Z", "#D9952A")
        + circle(36, t - 9.5, 1.8, GOLD) + circle(48, t - 13.5, 2, GOLD) + circle(60, t - 9.5, 1.8, GOLD)
        + circle(48, t - 2, 2, ROSE) + circle(41.5, t - 1, 1.3, "#60A5FA") + circle(54.5, t - 1, 1.3, "#60A5FA")
    )


def beanie(sp, color="#2F6FB0", band="#24588C", pom=CREAM):
    t, w = sp.top, sp.top_w + 2
    ribs = "".join(line(f"M{f(48 - w + 3 + i * (2 * w - 6) / 9)} {f(t + 11)} L{f(48 - w + 3 + i * (2 * w - 6) / 9)} {f(t + 17)}", color, 1.1) for i in range(10))
    return (
        path(f"M{f(48 - w)} {f(t + 13)} C{f(48 - w)} {f(t - 7)} {f(48 + w)} {f(t - 7)} {f(48 + w)} {f(t + 13)} Z", color)
        + line(f"M{f(48 - w * 0.5)} {f(t + 2)} Q48 {f(t - 4)} {f(48 + w * 0.5)} {f(t + 2)}", band, 1.4)
        + rect(48 - w - 1.5, t + 10, 2 * w + 3, 8, band, 4)
        + ribs
        + ring(48, t - 7.5, 3.2, 6, 2.6, pom, 0) + circle(48, t - 7.5, 3.4, pom)
    )


def earmuffs(sp, color="#F49AA9", band="#C9476A"):
    t, w = sp.top, sp.side - 2
    y = sp.eye_y - 6
    return (
        line(f"M{f(48 - w)} {f(y)} Q{f(48 - w)} {f(t - 10)} 48 {f(t - 10)} Q{f(48 + w)} {f(t - 10)} {f(48 + w)} {f(y)}", band, 3.4)
        + ring(48 - w, y, 5.2, 8, 3, color) + circle(48 - w, y, 6, color)
        + ring(48 + w, y, 5.2, 8, 3, color) + circle(48 + w, y, 6, color)
    )


def headphones(sp, cup=ROSE, band="#2B2B30"):
    t, w = sp.top, sp.side + 1
    y = sp.eye_y + 2
    return (
        line(f"M{f(48 - w)} {f(y - 4)} Q{f(48 - w)} {f(t - 6)} 48 {f(t - 6)} Q{f(48 + w)} {f(t - 6)} {f(48 + w)} {f(y - 4)}", band, 3.6)
        + rect(48 - w - 4.5, y - 7, 9, 15, cup, 4) + rect(48 + w - 4.5, y - 7, 9, 15, cup, 4)
        + rect(48 - w - 2, y - 5, 3, 11, "#FFFFFF", 1.5, ' opacity="0.25"') + rect(48 + w + 0.5, y - 5, 3, 11, "#FFFFFF", 1.5, ' opacity="0.25"')
    )


def scarf(sp, color="#2F6FB0", stripe="#F8FAFC"):
    c, w = sp.chin, sp.neck_w
    tail = path(f"M{f(48 + w * 0.35)} {f(c + 2)} L{f(48 + w * 0.35 + 9)} {f(c + 2)} L{f(48 + w * 0.35 + 11)} {f(c + 18)} L{f(48 + w * 0.35 + 2)} {f(c + 18)} Z", color)
    fringe = line(f"M{f(48 + w * 0.35 + 3)} {f(c + 18)} L{f(48 + w * 0.35 + 3)} {f(c + 21)} M{f(48 + w * 0.35 + 6)} {f(c + 18)} L{f(48 + w * 0.35 + 6)} {f(c + 21)} M{f(48 + w * 0.35 + 9)} {f(c + 18)} L{f(48 + w * 0.35 + 9)} {f(c + 21)}", color, 1.4)
    return (
        tail + fringe
        + line(f"M{f(48 + w * 0.35 + 1)} {f(c + 9)} L{f(48 + w * 0.35 + 10)} {f(c + 9)} M{f(48 + w * 0.35 + 1.5)} {f(c + 13)} L{f(48 + w * 0.35 + 10.5)} {f(c + 13)}", stripe, 1.6)
        + path(f"M{f(48 - w)} {f(c - 5)} Q48 {f(c + 3)} {f(48 + w)} {f(c - 5)} L{f(48 + w + 1)} {f(c + 3)} Q48 {f(c + 11)} {f(48 - w - 1)} {f(c + 3)} Z", color)
        + line(f"M{f(48 - w * 0.55)} {f(c - 1)} L{f(48 - w * 0.55)} {f(c + 6)} M{f(48 + w * 0.05)} {f(c + 1)} L{f(48 + w * 0.05)} {f(c + 8)} M{f(48 + w * 0.6)} {f(c - 1)} L{f(48 + w * 0.6)} {f(c + 6)}", stripe, 1.6)
    )


def bowtie(sp, color=ROSE):
    c = sp.chin + 1
    return (
        soft(f"48,{f(c)} 39,{f(c - 5.5)} 39,{f(c + 5.5)}", color, 3) + soft(f"48,{f(c)} 57,{f(c - 5.5)} 57,{f(c + 5.5)}", color, 3)
        + rect(45.5, c - 3, 5, 6, "#B5123A", 2)
    )


def bandana(sp, color=ROSE):
    c, w = sp.chin, sp.neck_w
    dots = "".join(circle(x, y, 1.1, CREAM) for x, y in ((42, c + 1.5), (48, c + 4), (54, c + 1.5), (45, c + 7.5), (51, c + 7.5)))
    return path(f"M{f(48 - w)} {f(c - 4)} Q48 {f(c + 1)} {f(48 + w)} {f(c - 4)} L48 {f(c + 13)} Z", color) + dots


def bell(sp):
    c, w = sp.chin, sp.neck_w
    return (
        path(f"M{f(48 - w)} {f(c - 4)} Q48 {f(c + 2)} {f(48 + w)} {f(c - 4)} L{f(48 + w)} {f(c)} Q48 {f(c + 6)} {f(48 - w)} {f(c)} Z", "#8A3B2A")
        + path(f"M42.5 {f(c + 10)} Q42.5 {f(c + 1.5)} 48 {f(c + 1.5)} Q53.5 {f(c + 1.5)} 53.5 {f(c + 10)} Z", GOLD)
        + rect(41.5, c + 9, 13, 2.6, "#D9952A", 1.3) + circle(48, c + 12, 1.6, "#9C6A1F")
        + ellipse(45.8, c + 5, 1, 2, WHITE, extra=' opacity="0.6"')
    )


def glasses(sp, color=INK):
    r = sp.eye_r * 2.2
    y = sp.eye_y
    l, rr = 48 - sp.eye_dx, 48 + sp.eye_dx
    return (
        circle(l, y, r, "#FFFFFF", ' opacity="0.25"') + circle(rr, y, r, "#FFFFFF", ' opacity="0.25"')
        + f'<circle cx="{f(l)}" cy="{f(y)}" r="{f(r)}" fill="none" stroke="{color}" stroke-width="2"/>'
        + f'<circle cx="{f(rr)}" cy="{f(y)}" r="{f(r)}" fill="none" stroke="{color}" stroke-width="2"/>'
        + line(f"M{f(l + r)} {f(y - 0.5)} Q48 {f(y - 3)} {f(rr - r)} {f(y - 0.5)}", color, 2)
        + line(f"M{f(l - r)} {f(y - 1)} L{f(l - r - 5)} {f(y - 3)} M{f(rr + r)} {f(y - 1)} L{f(rr + r + 5)} {f(y - 3)}", color, 2)
    )


def flower(x, y, petal="#FFFFFF", center="#F6C445", size=1.0):
    return ring(x, y, 3.6 * size, 5, 3 * size, petal, -90) + circle(x, y, 2.3 * size, center)


def gift_bow(x, y, color=ROSE, dark="#B5123A", size=1.0):
    s = size
    return (
        path(f"M{f(x)} {f(y)} L{f(x - 4 * s)} {f(y + 9 * s)} L{f(x - 1 * s)} {f(y + 8 * s)} Z", dark)
        + path(f"M{f(x)} {f(y)} L{f(x + 4 * s)} {f(y + 9 * s)} L{f(x + 1 * s)} {f(y + 8 * s)} Z", dark)
        + ellipse(x - 5.5 * s, y - 2.5 * s, 6 * s, 3.8 * s, color, -25) + ellipse(x + 5.5 * s, y - 2.5 * s, 6 * s, 3.8 * s, color, 25)
        + ellipse(x - 5.5 * s, y - 2.5 * s, 2.6 * s, 1.5 * s, dark, -25) + ellipse(x + 5.5 * s, y - 2.5 * s, 2.6 * s, 1.5 * s, dark, 25)
        + circle(x, y, 2.6 * s, color)
    )


def mortarboard(sp):
    t = sp.top
    return (
        path(f"M38 {f(t - 6)} L38 {f(t + 1)} Q48 {f(t + 5)} 58 {f(t + 1)} L58 {f(t - 6)} Z", "#2A2A30")
        + soft(f"48,{f(t - 15)} 68,{f(t - 8)} 48,{f(t - 1)} 28,{f(t - 8)}", INK, 2)
        + circle(48, t - 8, 1.4, GOLD)
        + line(f"M48 {f(t - 8)} L63 {f(t - 6)} L63 {f(t + 3)}", GOLD, 1.3)
        + rect(61.4, t + 2.5, 3.2, 5, GOLD, 1)
    )


def leaf_sprig(x, y, rotate=0):
    return (
        f'<g transform="rotate({f(rotate)} {f(x)} {f(y)})">'
        + line(f"M{f(x)} {f(y)} Q{f(x + 2)} {f(y - 7)} {f(x + 1)} {f(y - 12)}", "#3F7D4A", 1.5)
        + ellipse(x - 3.5, y - 7, 4, 2.2, LEAF, -35) + ellipse(x + 5, y - 9.5, 4.2, 2.3, LEAF, 30) + ellipse(x + 0.5, y - 14, 3.2, 2, "#74B97E", -80)
        + "</g>"
    )


def apple(x, y):
    return (
        circle(x - 3.4, y, 6.6, "#E0443F") + circle(x + 3.4, y, 6.6, "#E0443F")
        + ellipse(x - 3, y - 2.5, 1.8, 2.8, WHITE, -20, ' opacity="0.45"')
        + line(f"M{f(x)} {f(y - 5)} Q{f(x + 1)} {f(y - 9)} {f(x + 2.5)} {f(y - 10)}", "#6B4423", 1.6)
        + ellipse(x + 5, y - 9, 3.6, 1.9, LEAF, -20)
    )


def bamboo(sp):
    y = sp.mouth_y + 3
    return (
        line(f"M52 {f(y)} L80 {f(y - 14)}", "#7DB65A", 4.2)
        + line(f"M60.5 {f(y - 5.2)} L61.8 {f(y - 2.6)} M70 {f(y - 9.8)} L71.3 {f(y - 7.2)}", "#4E8A35", 1.6)
        + ellipse(76, y - 19, 5.5, 2.4, LEAF, -60) + ellipse(82, y - 12, 5.5, 2.4, "#74B97E", 15)
    )


def zzz():
    return (
        line("M66 14 L72 14 L66 20.5 L72 20.5", "#55607A", 1.8)
        + line("M75 7 L79.5 7 L75 11.8 L79.5 11.8", "#55607A", 1.5)
        + line("M81.5 1.5 L84.5 1.5 L81.5 4.8 L84.5 4.8", "#55607A", 1.2)
    )


# Poses: things held in front of the chin --------------------------------

def paws(color, y=86, dx=13, toe="#00000022"):
    out = ""
    for x in (48 - dx, 48 + dx):
        out += ellipse(x, y, 6.2, 7, color)
        out += line(f"M{f(x - 2)} {f(y - 4.5)} L{f(x - 2)} {f(y - 2)} M{f(x + 2)} {f(y - 4.5)} L{f(x + 2)} {f(y - 2)}", "#1C191733", 1.2)
    return out


def held_gift(sp):
    return (
        rect(35, 76, 26, 20, ROSE, 3) + rect(35, 76, 26, 5, "#C8103A", 2)
        + rect(45.5, 76, 5, 20, CREAM) + rect(35, 82, 26, 4, CREAM)
        + gift_bow(48, 76, "#FDE68A", "#E2B53A", 0.9)
        + paws(sp.paw)
    )


def held_cheese(sp):
    return (
        path("M28 96 L66 96 L66 74 Z", "#F7C948") + path("M28 96 L66 74 L66 78 L33 97 Z", "#E9B42A")
        + circle(57, 87, 3.2, "#E3A928") + circle(47, 92, 2, "#E3A928") + circle(61.5, 81.5, 1.7, "#E3A928") + circle(60, 93, 1.4, "#E3A928")
        + paws(sp.paw, 87, 16)
    )


def held_shell(sp):
    ridges = "".join(line(f"M48 94 L{f(48 + 11 * math.cos(math.radians(a)))} {f(87 - 10 * math.sin(math.radians(a)))}", "#E58E7A", 1.2) for a in (20, 50, 80, 110, 140, 160))
    return path("M36 90 Q36 76 48 76 Q60 76 60 90 L48 95 Z", "#F7B7A3") + ridges + paws(sp.paw, 87, 14)


def held_acorn(sp):
    return (
        path("M39 82 Q39 96 48 96 Q57 96 57 82 Z", "#D9944E") + ellipse(44, 87, 1.6, 4, "#F0B878", extra=' opacity="0.7"')
        + path("M37.5 83 Q37.5 74 48 74 Q58.5 74 58.5 83 Z", "#8A5A34")
        + line("M41 76.5 L44 82.5 M46 75 L49 82.5 M51 75 L54 82.5 M56 77 L57.5 80.5 M40 80.5 L55 76", "#6E4426", 1)
        + line("M48 74 Q48.5 70 51 69", "#6E4426", 1.8)
        + paws(sp.paw, 87, 11)
    )


def ledge(sp):
    return rect(0, 86, 96, 10, "#00000014") + paws(sp.paw, 87, 16)


def eggshell():
    return (
        path("M14 70 L22 64 L28 72 L36 63 L44 71 L52 62 L60 71 L68 63 L74 71 L82 66 L84 96 L12 96 Z", "#FFFBF2")
        + path("M14 70 L22 64 L28 72 L36 63 L44 71 L52 62 L60 71 L68 63 L74 71 L82 66 L82.4 70 L74 75 L68 67 L60 75 L52 66 L44 75 L36 67 L28 76 L22 68 L14 73 Z", "#EFE6D5")
        + ellipse(30, 86, 3, 2, "#F2C9B8") + ellipse(64, 82, 2.4, 1.8, "#C9E2EE") + ellipse(52, 90, 2, 1.5, "#F6DFA0")
    )


def confetti():
    bits = [(12, 14, ROSE, 20), (82, 20, "#60A5FA", -30), (16, 78, GOLD, 45), (84, 74, "#34D399", 10), (24, 30, "#F59E0B", -15), (72, 8, "#A78BFA", 35)]
    return "".join(f'<rect x="{f(x - 2.4)}" y="{f(y - 1.2)}" width="4.8" height="2.4" rx="1.2" fill="{c}" transform="rotate({a} {x} {y})"/>' for x, y, c, a in bits)


def stars():
    pts = [(14, 16, 2.4), (80, 24, 1.8), (20, 80, 1.6), (84, 70, 2.2)]
    return "".join(
        path(f"M{f(x)} {f(y - s * 1.6)} Q{f(x + s * 0.3)} {f(y - s * 0.3)} {f(x + s * 1.6)} {f(y)} Q{f(x + s * 0.3)} {f(y + s * 0.3)} {f(x)} {f(y + s * 1.6)} Q{f(x - s * 0.3)} {f(y + s * 0.3)} {f(x - s * 1.6)} {f(y)} Q{f(x - s * 0.3)} {f(y - s * 0.3)} {f(x)} {f(y - s * 1.6)} Z", "#FFFFFF", ' opacity="0.9"')
        for x, y, s in pts
    )


# Characters -------------------------------------------------------------

class Character:
    def __init__(self, name, bg, eyes="dot", mouth="smile", blush=True, lashes=False,
                 over=(), below=None, behind=None, tilt=0, dy=0, scale=1, extra=None):
        self.name, self.bg = name, bg
        self.eyes, self.mouth, self.blush, self.lashes = eyes, mouth, blush, lashes
        self.over, self.below, self.behind, self.extra = over, below, behind, extra
        self.tilt, self.dy, self.scale = tilt, dy, scale


HOLD = dict(scale=0.84, dy=-9)

CHARACTERS = [
    # The first 18 keep the order they've always had, so nobody's default changes.
    Character("fox", "sky", eyes="wink", mouth="smile", tilt=-6, over=[lambda s: scarf(s, "#2F6FB0", "#F8FAFC")]),
    Character("cat", "butter", eyes="dot", mouth="w", tilt=5, over=[glasses]),
    Character("bear", "mint", eyes="happy", mouth="open", below=held_gift, **HOLD),
    Character("panda", "rose", eyes="happy", mouth="smile", over=[bamboo]),
    Character("rabbit", "lilac", eyes="sparkle", mouth="w", tilt=8, over=[lambda s: flower(31, 34, "#FFFFFF", "#F6C445", 1.1) + flower(39, 30, "#F7A8C4", "#FDE68A", 0.85)]),
    Character("owl", "sage", eyes="sparkle", mouth="smile", blush=False, over=[mortarboard]),
    Character("frog", "peach", eyes="happy", mouth="open", over=[lambda s: party_hat(s, "#7C5CD6", "#FDE68A")], extra=confetti),
    Character("penguin", "aqua", eyes="dot", mouth="smile", over=[earmuffs, lambda s: scarf(s, ROSE, CREAM)]),
    Character("koala", "sand", eyes="sleepy", mouth="smile", over=[lambda s: leaf_sprig(36, 30, -20)], extra=zzz),
    Character("lion", "aqua", eyes="happy", mouth="grin", over=[crown]),
    Character("dog", "sand", eyes="dot", mouth="tongue", tilt=-10, over=[bandana]),
    Character("mouse", "rose", eyes="sparkle", mouth="w", below=held_cheese, **HOLD),
    Character("pig", "sage", eyes="happy", mouth="smile", tilt=6, over=[lambda s: gift_bow(36, s.top + 2, ROSE, "#B5123A", 1.05)]),
    Character("raccoon", "butter", eyes="glance", mouth="smirk", blush=False, dy=12, below=ledge),
    Character("tiger", "mint", eyes="dot", mouth="grin", tilt=4, over=[headphones]),
    Character("chick", "sky", eyes="sparkle", mouth="open", dy=-6, below=lambda s: eggshell()),
    Character("monkey", "peach", eyes="happy", mouth="open", over=[lambda s: beanie(s, "#F59E0B", "#D97F06", CREAM)]),
    Character("sheep", "lilac", eyes="sleepy", mouth="smile", extra=lambda: stars() + zzz()),
    # Added with the bigger set.
    Character("deer", "pistachio", eyes="sparkle", mouth="smile", lashes=True, tilt=-5, over=[lambda s: flower(59.5, 22, "#F7A8C4", "#FDE68A", 0.9)]),
    Character("elephant", "periwinkle", eyes="heart", mouth="none", tilt=4),
    Character("hedgehog", "coral", eyes="dot", mouth="smile", over=[lambda s: apple(48, s.top - 1)]),
    Character("otter", "aqua", eyes="happy", mouth="open", below=held_shell, **HOLD),
    Character("sloth", "pistachio", eyes="sleepy", mouth="smile", tilt=12),
    Character("giraffe", "sky", eyes="dot", mouth="smile", lashes=True, over=[bowtie]),
    Character("cow", "pistachio", eyes="dot", mouth="smile", blush=False, over=[bell]),
    Character("hamster", "periwinkle", eyes="sparkle", mouth="w", below=held_acorn, **HOLD),
    Character("unicorn", "lilac", eyes="happy", mouth="smile", lashes=True, tilt=6),
    Character("dinosaur", "butter", eyes="dot", mouth="grin", over=[lambda s: party_hat(s, ROSE, CREAM)], extra=confetti),
    Character("axolotl", "periwinkle", eyes="happy", mouth="smile"),
    Character("redpanda", "sage", eyes="dot", mouth="open", tilt=-8, over=[lambda s: beanie(s, "#2F6FB0", "#24588C", CREAM)]),
]


def render(ch):
    sp = SPECIES[ch.name]
    L = sp.layers(ch)
    head = (
        L.get("back", "") + L.get("head", "")
        + (blush(sp) if ch.blush else "")
        + eyes(sp, ch.eyes, ch.lashes)
        + mouth(sp, ch.mouth)
        + L.get("nose", "") + L.get("front", "")
        + "".join(a(sp) for a in ch.over)
    )
    body = group(head, ch.tilt, ch.dy, ch.scale)
    held = ch.below(sp) if ch.below else ""
    extra = ch.extra() if ch.extra else ""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">'
        f'<rect width="96" height="96" fill="{BG[ch.bg]}"/>'
        f"{extra}{body}{held}</svg>\n"
    )


if __name__ == "__main__":
    out = pathlib.Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    for ch in CHARACTERS:
        (out / f"{ch.name}.svg").write_text(render(ch))
    print(" ".join(ch.name for ch in CHARACTERS))
