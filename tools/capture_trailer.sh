#!/usr/bin/env bash
# Capture raw clips for the Arabic Kids Play Store trailer.
#
# Records numbered scenes via `adb shell screenrecord`. The user interacts
# with the app live during each take; the script only handles timing,
# pulling, and naming. Edit/sequence the resulting clips in CapCut or
# DaVinci Resolve to produce the final 30-45s trailer.
#
# Usage:
#   tools/capture_trailer.sh             # record every missing scene
#   tools/capture_trailer.sh 04-quiz     # record only one scene
#   tools/capture_trailer.sh --list      # show planned scenes
#   FORCE=1 tools/capture_trailer.sh     # overwrite existing files

set -euo pipefail

OUT_DIR="play-store/trailer/raw"
PKG="com.hsrconsulting.arabickids"
DEVICE_TMP="/sdcard/ak_trailer_clip.mp4"
BITRATE_BPS=8000000  # 8 Mbps — sharp enough for 1080p, manageable file size

# Format: name|duration_sec|description
SCENES=(
  "01-hook|4|Welcome / language picker / tagline 'تعلّم العربية'"
  "02-dashboard|7|Dashboard stats + menu tiles, tap Alphabet at the end"
  "03-letter|8|Open a letter (e.g. م), tap audio button, show vocalized examples"
  "04-quiz|10|Run through 2-3 quiz cards with ✅ feedback"
  "05-tracing|10|Trace a letter, show result with stars + badge"
  "06-features|8|Toddler mode tile + language toggle 🇫🇷→🇬🇧→🇸🇦"
  "07-outro|3|Return to dashboard / logo / closing"
)

if ! command -v adb >/dev/null; then
  echo "❌ adb not found in PATH"; exit 1
fi

# --list: print plan and exit
if [[ "${1:-}" == "--list" ]]; then
  printf '%-14s  %4s  %s\n' "scene" "dur" "description"
  printf '%-14s  %4s  %s\n' "-----" "---" "-----------"
  total=0
  for s in "${SCENES[@]}"; do
    IFS='|' read -r name dur desc <<< "$s"
    printf '%-14s  %3ss  %s\n' "$name" "$dur" "$desc"
    total=$((total + dur))
  done
  printf '\nTotal raw footage: %ss\n' "$total"
  exit 0
fi

# Verify device
device_count=$(adb devices | awk 'NR>1 && $2=="device"' | wc -l)
if [[ "$device_count" -eq 0 ]]; then
  echo "❌ No device connected via adb"; exit 1
fi
if [[ "$device_count" -gt 1 ]]; then
  echo "⚠️  Multiple devices connected; recording will use the default. Set ANDROID_SERIAL to pick one."
fi

# Verify app installed
if ! adb shell pm list packages 2>/dev/null | grep -q "package:${PKG}$"; then
  echo "❌ App ${PKG} not installed on device. Run: adb install -r app/build/outputs/apk/release/app-release.apk"
  exit 1
fi

mkdir -p "$OUT_DIR"

record_scene() {
  local name="$1" duration="$2" desc="$3"
  local out="$OUT_DIR/${name}.mp4"

  if [[ -f "$out" && "${FORCE:-0}" != "1" ]]; then
    echo "⏭  $out exists — skip (FORCE=1 to overwrite)"
    return 0
  fi

  echo
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🎬 Scene: $name  (duration: ${duration}s)"
  echo "📋 $desc"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # First scene: relaunch the app cold for a clean splash
  if [[ "$name" == "01-hook" ]]; then
    echo "🔄 Relaunching app cold..."
    adb shell am force-stop "$PKG" >/dev/null
    sleep 1
    adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
    sleep 2
  fi

  read -rp "👉 Position the app on the right screen, then press Enter to start recording..."
  echo "🔴 Recording ${duration}s — interact now"

  # screenrecord auto-stops after --time-limit
  adb shell screenrecord --time-limit "$duration" --bit-rate "$BITRATE_BPS" "$DEVICE_TMP"

  echo "📥 Pulling clip..."
  adb pull "$DEVICE_TMP" "$out" >/dev/null
  adb shell rm "$DEVICE_TMP" >/dev/null
  size=$(du -h "$out" | cut -f1)
  echo "✅ Saved $out ($size)"
}

filter="${1:-}"
matched=0
for s in "${SCENES[@]}"; do
  IFS='|' read -r name dur desc <<< "$s"
  if [[ -n "$filter" && "$filter" != "$name" ]]; then
    continue
  fi
  matched=1
  record_scene "$name" "$dur" "$desc"
done

if [[ -n "$filter" && "$matched" -eq 0 ]]; then
  echo "❌ Unknown scene '$filter'. Run with --list to see available scenes."
  exit 1
fi

echo
echo "🎉 Done. Raw clips in $OUT_DIR/"
echo "Next: import into CapCut/DaVinci, trim, add background music + per-locale subtitles, export 1080p MP4, upload as unlisted YouTube, paste URL in Play Console > Store listing > Promo video."
