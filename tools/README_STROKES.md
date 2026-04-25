# Extracting tracing data from a font

`tools/extract_strokes.py` reads an Arabic TrueType / OpenType font and
emits a `TRACE_STROKES` array compatible with `data.js`. It does so by
sampling the glyph outline (Bézier curves) into evenly-spaced polyline
points in a normalized 0-100 coordinate space.

## 1. Install dependency

```bash
pip install fonttools
```

## 2. Get a font

The app already uses **Noto Naskh Arabic** in CSS. Download the TTF:

```bash
mkdir -p /tmp/fonts
curl -L -o /tmp/fonts/NotoNaskhArabic-Regular.ttf \
  https://github.com/notofonts/arabic/raw/main/fonts/NotoNaskhArabic/full/ttf/NotoNaskhArabic-Regular.ttf
```

Other good candidates:
- Noto Sans Arabic (cleaner, more modern)
- Cairo / Tajawal (rounder, kid-friendly look)
- Amiri (classical Arabic for advanced kids)

## 3. Run

```bash
python3 tools/extract_strokes.py /tmp/fonts/NotoNaskhArabic-Regular.ttf \
  > /tmp/trace_strokes.js
```

Tunable flags:
- `--step 25` — Bézier sampling step in font units. Lower = more points.
- `--max-points 35` — cap points per stroke after even decimation.
- `--dot-threshold 0.07` — small contours below this area-ratio are
  treated as `dots` (the diacritical dots of ب ت ث ج خ ذ ز ش …).
- `--padding 10` — margin around the glyph in the 0-100 frame.

## 4. Paste into `data.js`

Open `app/src/main/assets/web/js/data.js`, find the existing
`const TRACE_STROKES = [ … ]` block, and replace its contents with the
generated output.

## 5. Pedagogical refinement (optional)

The generated outlines follow the **closed glyph contour**, not the
order in which a child would write the letter (1ʳᵉ trait, 2ᵉ trait, …).
For a learning app you typically want to:

1. Inspect each letter's `strokes:[[…]]` (often one big contour).
2. Manually split it into 1-3 strokes corresponding to the natural
   writing order. Usually the rule is:
   - Single-stroke letters (د، ر، و، ا): keep one stroke, trim points
     so the path doesn't loop back.
   - Two-stroke letters (ب، ت، ل، ك): main body first, then dots /
     extension afterwards.
   - Hamza on top (أ): base alif first, then the small hamza.

3. The `dots: […]` array is the centroid of each diacritical dot —
   already correctly split by the script when their bbox area is below
   `--dot-threshold` of the largest contour.

## 6. Test in the app

After pasting, rebuild and test the letter trace screen. The animated
guide will trace the new outline. Adjust `--step` if there are visible
straight segments where curves should be (lower the step), or if the
animation drags (increase the step).
