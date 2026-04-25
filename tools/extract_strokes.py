#!/usr/bin/env python3
"""
Extract trace polylines for the 28 Arabic letters from a TrueType/OpenType
font (e.g. NotoNaskhArabic-Regular.ttf) and emit a TRACE_STROKES array
ready to paste into app/src/main/assets/web/js/data.js.

Each letter outputs N polyline contours: typically 1 (letter outline) plus
0-2 small contours that are the dots / inner counters. Tiny contours below
a configurable area threshold are emitted as `dots:[…]` and large ones as
`strokes:[[…]]`.

Caveats:
- Glyph contours follow the FONT outline, not the pedagogical writing
  order. To get clean stroke order (1, 2, 3) you may want to split the
  outline manually after this script runs.
- All 28 base shapes are extracted; if you also want positional forms
  (initial/medial/final), pass --form initial|medial|final along with the
  presentation-form Unicode codepoints (FE80-FEFC).

Usage:
    pip install fonttools
    python3 tools/extract_strokes.py /path/to/NotoNaskhArabic-Regular.ttf \\
            > /tmp/trace_strokes.js
    # → paste into data.js, replacing the existing TRACE_STROKES = [ … ]
"""

from __future__ import annotations
import argparse
import math
import sys
from pathlib import Path

try:
    from fontTools.ttLib import TTFont
    from fontTools.pens.basePen import BasePen
except ImportError:
    sys.exit("fontTools not installed. Run: pip install fonttools")

ARABIC_LETTERS = [
    "أ", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر",
    "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف",
    "ق", "ك", "ل", "م", "ن", "ه", "و", "ي",
]


class PolylinePen(BasePen):
    """Sample TrueType / OpenType outline into evenly-spaced polyline pts."""

    def __init__(self, glyph_set, step=20):
        super().__init__(glyph_set)
        self.step = step
        self.contours: list[list[tuple[float, float]]] = []
        self._current: list[tuple[float, float]] = []
        self._last = None

    def _moveTo(self, p):
        if self._current:
            self.contours.append(self._current)
        self._current = [p]
        self._last = p

    def _lineTo(self, p):
        x0, y0 = self._last
        x1, y1 = p
        d = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(d / self.step))
        for i in range(1, n + 1):
            t = i / n
            self._current.append((x0 + t * (x1 - x0), y0 + t * (y1 - y0)))
        self._last = p

    def _curveToOne(self, p1, p2, p3):
        x0, y0 = self._last
        x1, y1 = p1
        x2, y2 = p2
        x3, y3 = p3
        approx_len = math.hypot(x3 - x0, y3 - y0)
        n = max(6, int(approx_len / self.step))
        for i in range(1, n + 1):
            t = i / n
            mt = 1 - t
            x = mt ** 3 * x0 + 3 * mt ** 2 * t * x1 + 3 * mt * t ** 2 * x2 + t ** 3 * x3
            y = mt ** 3 * y0 + 3 * mt ** 2 * t * y1 + 3 * mt * t ** 2 * y2 + t ** 3 * y3
            self._current.append((x, y))
        self._last = p3

    def _qCurveToOne(self, p1, p2):
        x0, y0 = self._last
        x1, y1 = p1
        x2, y2 = p2
        approx_len = math.hypot(x2 - x0, y2 - y0)
        n = max(4, int(approx_len / self.step))
        for i in range(1, n + 1):
            t = i / n
            mt = 1 - t
            x = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2
            y = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2
            self._current.append((x, y))
        self._last = p2

    def _closePath(self):
        if self._current:
            # close ring: ensure last point ≈ first
            x0, y0 = self._current[0]
            xn, yn = self._current[-1]
            if math.hypot(xn - x0, yn - y0) > 1:
                self._current.append((x0, y0))
            self.contours.append(self._current)
            self._current = []
        self._last = None

    def _endPath(self):
        if self._current:
            self.contours.append(self._current)
            self._current = []
        self._last = None


def bbox_area(pts):
    if not pts:
        return 0.0
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return (max(xs) - min(xs)) * (max(ys) - min(ys))


def normalize_to_0_100(contours, padding=10):
    """Scale + flip Y (font Y points up, canvas Y points down) into 0-100."""
    all_pts = [pt for c in contours for pt in c]
    if not all_pts:
        return []
    xs = [p[0] for p in all_pts]
    ys = [p[1] for p in all_pts]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    w = maxx - minx
    h = maxy - miny
    s = max(w, h) or 1
    scale = (100 - 2 * padding) / s
    out = []
    for c in contours:
        nc = []
        for x, y in c:
            nx = padding + (x - minx) * scale
            ny = padding + (maxy - y) * scale  # flip Y
            nc.append({"x": round(nx, 1), "y": round(ny, 1)})
        out.append(nc)
    return out


def decimate(pts, max_points):
    if max_points <= 0 or len(pts) <= max_points:
        return pts
    step = len(pts) / max_points
    return [pts[int(i * step)] for i in range(max_points)]


def emit_letter(letter, font, glyph_set, cmap, args, out):
    cp = ord(letter)
    gname = cmap.get(cp)
    out.write(f"  // {letter}\n")
    if not gname:
        out.write("  { strokes: [], dots: [] },\n")
        return

    pen = PolylinePen(glyph_set, step=args.step)
    glyph_set[gname].draw(pen)
    if not pen.contours:
        out.write("  { strokes: [], dots: [] },\n")
        return

    # Classify: small contour = dot (consume only its centroid), big = stroke.
    largest_area = max(bbox_area(c) for c in pen.contours) or 1
    strokes_raw = []
    dots_raw = []
    for c in pen.contours:
        ratio = bbox_area(c) / largest_area
        if ratio < args.dot_threshold:
            cx = sum(p[0] for p in c) / len(c)
            cy = sum(p[1] for p in c) / len(c)
            dots_raw.append([(cx, cy)])
        else:
            strokes_raw.append(c)

    # Normalize all contours together so coordinates share one frame.
    all_norm = normalize_to_0_100(strokes_raw + dots_raw, padding=args.padding)
    n_strokes = len(strokes_raw)
    strokes = [decimate(c, args.max_points) for c in all_norm[:n_strokes]]
    dots = [c[0] for c in all_norm[n_strokes:]]

    out.write("  { strokes: [\n")
    for s in strokes:
        line = ", ".join(f"{{x:{p['x']},y:{p['y']}}}" for p in s)
        out.write(f"    [{line}],\n")
    out.write("  ],\n")
    if dots:
        ds = ", ".join(f"{{x:{d['x']},y:{d['y']}}}" for d in dots)
        out.write(f"    dots: [{ds}] }},\n")
    else:
        out.write("    dots: [] },\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("font", type=Path)
    ap.add_argument("--step", type=int, default=25,
                    help="Bézier sampling step in font units (smaller = more points)")
    ap.add_argument("--max-points", type=int, default=35,
                    help="Cap points per stroke (decimated evenly if exceeded)")
    ap.add_argument("--dot-threshold", type=float, default=0.07,
                    help="Bbox-area ratio below which a contour is treated as a dot (0-1)")
    ap.add_argument("--padding", type=int, default=10,
                    help="Padding around the glyph in 0-100 frame")
    args = ap.parse_args()

    if not args.font.exists():
        sys.exit(f"Font not found: {args.font}")

    font = TTFont(str(args.font))
    cmap = font.getBestCmap()
    glyph_set = font.getGlyphSet()

    out = sys.stdout
    out.write(f"// Auto-generated by tools/extract_strokes.py from {args.font.name}\n")
    out.write("// Each glyph is rendered as one or more polyline contours plus dots.\n")
    out.write("// Re-split the strokes into pedagogical writing order if needed.\n")
    out.write("const TRACE_STROKES = [\n")
    for letter in ARABIC_LETTERS:
        emit_letter(letter, font, glyph_set, cmap, args, out)
    out.write("];\n")


if __name__ == "__main__":
    main()
