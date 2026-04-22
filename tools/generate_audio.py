#!/usr/bin/env python3
"""
Generate MP3 audio assets for Arabic Kids via Amazon Polly.

- Extracts every unique Arabic string from data.js that the app may speak
  (letters, letter names, letter example words, letter-form examples,
   category words, optionally story lines).
- Calls Polly (voice "Zeina" by default — MSA) once per string.
- Writes MP3 files to app/src/main/assets/audio/ using a stable filename
  derived from a short md5 hash of the Arabic text.
- Writes a JS manifest (audio_manifest.js) that data.js imports to resolve
  a given Arabic string to the MP3 file it should play.

Run from repo root:
    python3 tools/generate_audio.py              # first time: fetch voices and build everything
    python3 tools/generate_audio.py --dry-run    # list what would be generated
    python3 tools/generate_audio.py --voice Hala # use a different voice (neural, Gulf)
"""

from __future__ import annotations
import argparse
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_JS = REPO_ROOT / "app/src/main/assets/web/js/data.js"
OUT_DIR = REPO_ROOT / "app/src/main/assets/audio"
MANIFEST_JS = REPO_ROOT / "app/src/main/assets/web/js/audio_manifest.js"

TASHKEEL_RE = re.compile(r"[\u064B-\u0652\u0670]")
ARABIC_RE = re.compile(r"[\u0600-\u06FF]")


def short_id(ar: str) -> str:
    """Short stable filename from an Arabic string (md5 first 10 hex chars)."""
    return hashlib.md5(ar.encode("utf-8")).hexdigest()[:10]


def extract_strings() -> list[str]:
    """Pull every Arabic string the app may speak from data.js."""
    text = DATA_JS.read_text(encoding="utf-8")
    strings: set[str] = set()

    # Letter display char `l: "X"` (isolated letter)
    for m in re.finditer(r'\bl:\s*"([^"]+)"', text):
        if ARABIC_RE.search(m.group(1)):
            strings.add(m.group(1))

    # Letter name `na: "..."`
    for m in re.finditer(r'\bna:\s*"([^"]+)"', text):
        if ARABIC_RE.search(m.group(1)):
            strings.add(m.group(1))

    # Main example word `w: "..."`
    for m in re.finditer(r'\bw:\s*"([^"]+)"', text):
        if ARABIC_RE.search(m.group(1)):
            strings.add(m.group(1))

    # Form example words `ex: "..."`
    for m in re.finditer(r'\bex:\s*"([^"]+)"', text):
        if ARABIC_RE.search(m.group(1)):
            strings.add(m.group(1))

    # Category words `ar: "..."` (filter out non-Arabic translations)
    for m in re.finditer(r'\bar:\s*"([^"]+)"', text):
        if ARABIC_RE.search(m.group(1)):
            strings.add(m.group(1))

    # Strip trailing digits and whitespace (same cleanup speakArabic does)
    def clean(s: str) -> str:
        s = re.sub(r"[\u0660-\u0669\u06F0-\u06F9\d]", "", s)
        return re.sub(r"\s+$", "", s).strip()

    # Normalize: skip empties and near-duplicates
    out = set()
    for s in strings:
        c = clean(s)
        if c:
            out.add(s)  # keep the harakated form so Polly reads correctly
    return sorted(out)


def polly_client(region: str):
    try:
        import boto3  # type: ignore
    except ImportError:
        sys.exit("boto3 not installed. Run: pip install boto3")
    return boto3.client("polly", region_name=region)


def synthesize(client, text: str, voice: str, engine: str) -> bytes:
    resp = client.synthesize_speech(
        Engine=engine,
        VoiceId=voice,
        OutputFormat="mp3",
        SampleRate="22050",
        LanguageCode="arb",  # MSA. "arb" for standard; "ar-AE" for Gulf neural.
        Text=text,
        TextType="text",
    )
    return resp["AudioStream"].read()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="Zeina",
                    help="Polly voice. Zeina=MSA standard (default); Hala=Gulf neural female; Zayd=Gulf neural male")
    ap.add_argument("--engine", default="standard",
                    help="standard or neural (Hala/Zayd require neural)")
    ap.add_argument("--region", default="eu-west-1")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="cap number of strings (for testing)")
    ap.add_argument("--overwrite", action="store_true", help="regenerate even if MP3 exists")
    args = ap.parse_args()

    strings = extract_strings()
    if args.limit:
        strings = strings[: args.limit]

    print(f"Found {len(strings)} unique Arabic strings to synthesize")
    if args.dry_run:
        for s in strings[:20]:
            print(f"  {short_id(s)}.mp3  <-  {s}")
        if len(strings) > 20:
            print(f"  ... and {len(strings) - 20} more")
        print("\nManifest would be written to:", MANIFEST_JS)
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Auto-switch to neural engine for voices that require it
    if args.voice in ("Hala", "Zayd") and args.engine == "standard":
        print(f"Voice {args.voice} requires neural engine — switching.")
        args.engine = "neural"

    client = polly_client(args.region)
    manifest: dict[str, str] = {}
    generated = 0
    skipped = 0
    failed: list[str] = []

    for i, s in enumerate(strings, 1):
        file_id = short_id(s)
        out = OUT_DIR / f"{file_id}.mp3"
        manifest[s] = file_id
        if out.exists() and not args.overwrite:
            skipped += 1
            continue
        try:
            data = synthesize(client, s, args.voice, args.engine)
            out.write_bytes(data)
            generated += 1
            if i % 20 == 0:
                print(f"  [{i}/{len(strings)}] generated")
            time.sleep(0.02)  # gentle rate limit
        except Exception as e:
            failed.append(s)
            print(f"  FAIL  {s}: {e}", file=sys.stderr)

    # Write manifest as a JS file so data.js can `<script src>` it
    manifest_sorted = {k: manifest[k] for k in sorted(manifest)}
    MANIFEST_JS.write_text(
        "// Generated by tools/generate_audio.py — do not edit by hand.\n"
        f"// Voice: {args.voice} ({args.engine}). Regenerate to update.\n"
        "const _AUDIO_DICT = " + json.dumps(manifest_sorted, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )

    print(f"\nDone. generated={generated} skipped={skipped} failed={len(failed)}")
    print(f"Manifest: {MANIFEST_JS.relative_to(REPO_ROOT)}")
    print(f"Audio:    {OUT_DIR.relative_to(REPO_ROOT)}/*.mp3")
    if failed:
        print("\nFailures:")
        for f in failed[:20]:
            print("  -", f)


if __name__ == "__main__":
    main()
