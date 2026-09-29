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
OUT_DIR = REPO_ROOT / "app/src/main/assets/web/audio"
MANIFEST_JS = REPO_ROOT / "app/src/main/assets/web/js/audio_manifest.js"

# Words Zeina mispronounces even when fully vocalized (e.g. imala turning
# maama into "meme"). Keyed by the vocalized form; value is full SSML using
# IPA phonemes to force the pronunciation.
SSML_OVERRIDES = {
    # Short words Zeina reads unclearly as plain text (whisper-verified)
    # Sun-letter words: make sure the swallowed lam + doubled letter is clear
    "\u0627\u0644\u062b\u064e\u0651\u0644\u0652\u062c":
        '<speak><phoneme alphabet="ipa" ph="\u0294a\u03b8\u03b8ald\u0292">'
        "\u0627\u0644\u062b\u0644\u062c</phoneme></speak>",
    "\u0627\u0644\u0633\u064e\u0651\u0627\u0639\u064e\u0629":
        '<speak><phoneme alphabet="ipa" ph="\u0294assa\u02d0\u0295a">'
        "\u0627\u0644\u0633\u0627\u0639\u0629</phoneme></speak>",
    "\u0623\u064f\u062e\u0652\u062a":
        '<speak><phoneme alphabet="ipa" ph="\u0294uxt">'
        "\u0623\u062e\u062a</phoneme></speak>",
    "\u062d\u0650\u0641\u0652\u0638":
        '<speak><phoneme alphabet="ipa" ph="\u0127if\u00f0\u02e4">'
        "\u062d\u0641\u0638</phoneme></speak>",
    "\u062f\u0650\u0645\u064e\u0627\u063a":
        '<speak><phoneme alphabet="ipa" ph="dima\u02d0\u0263">'
        "\u062f\u0645\u0627\u063a</phoneme></speak>",
    "\u0637\u064e\u0627\u0626\u0650\u0631\u064e\u0629":
        '<speak><phoneme alphabet="ipa" ph="t\u02e4a\u02d0\u0294ira">'
        "\u0637\u0627\u0626\u0631\u0629</phoneme></speak>",
    "\u0637\u064e\u0639\u064e\u0627\u0645":
        '<speak><phoneme alphabet="ipa" ph="t\u02e4a\u0295a\u02d0m">'
        "\u0637\u0639\u0627\u0645</phoneme></speak>",
    "\u0637\u0650\u0641\u0652\u0644":
        '<speak><phoneme alphabet="ipa" ph="t\u02e4ifl">'
        "\u0637\u0641\u0644</phoneme></speak>",
    "\u063a\u064e\u0632\u064e\u0627\u0644":
        '<speak><phoneme alphabet="ipa" ph="\u0263aza\u02d0l">'
        "\u063a\u0632\u0627\u0644</phoneme></speak>",
    "\u0641\u064e\u0645":
        '<speak><phoneme alphabet="ipa" ph="fam">'
        "\u0641\u0645</phoneme></speak>",
    "\u0641\u0650\u0636\u0650\u0651\u064a\u0651":
        '<speak><phoneme alphabet="ipa" ph="fid\u02e4d\u02e4i\u02d0j">'
        "\u0641\u0636\u064a</phoneme></speak>",
    "\u0642\u064f\u0646\u0652\u0641\u064f\u0630":
        '<speak><phoneme alphabet="ipa" ph="qunfu\u00f0">'
        "\u0642\u0646\u0641\u0630</phoneme></speak>",
    "\u0642\u0650\u0637\u0651":
        '<speak><phoneme alphabet="ipa" ph="qit\u02e4t\u02e4">'
        "\u0642\u0637</phoneme></speak>",
    "\u0647\u064e\u0648\u064e\u0627\u0621":
        '<speak><phoneme alphabet="ipa" ph="hawa\u02d0\u0294">'
        "\u0647\u0648\u0627\u0621</phoneme></speak>",
    # dalw (seau) — Zeina garbles the final "lw" cluster
    "\u062f\u064e\u0644\u0652\u0648":
        '<speak><phoneme alphabet="ipa" ph="dalw">'
        "\u062f\u0644\u0648</phoneme></speak>",
}

# Words Zeina cannot get right even with IPA: her /a/ after m drifts to "è"
# (مَامَا heard as "mème" by French kids, whisper-fr: "Meme"). Synthesized
# with another voice instead: key -> (voice, engine, language, text, text_type).
VOICE_OVERRIDES = {
    "\u0645\u064e\u0627\u0645\u064e\u0627":   # maama (maman) — whisper-fr: "Maman"
        ("Hala", "neural", "ar-AE", "\u0645\u064e\u0627\u0645\u064e\u0627", "text"),
    # bataata (pomme de terre) — Zeina garbles it (whisper-ar: بطلطة)
    "\u0628\u064e\u0637\u064e\u0627\u0637\u064e\u0627":
        ("Hala", "neural", "ar-AE",
         '<speak><phoneme alphabet="ipa" ph="bat\u02e4a\u02d0t\u02e4a\u02d0">'
         "\u0628\u0637\u0627\u0637\u0627</phoneme></speak>", "ssml"),
    # laban (yaourt) — /a/ drifts to "é" (heard "Le bin"/"Liban"); open ɑ
    # keeps both vowels short and is heard "Laban" (fr/es)
    "\u0644\u064e\u0628\u064e\u0646":
        ("Hala", "neural", "ar-AE",
         '<speak><phoneme alphabet="ipa" ph="\u02c8l\u0251b\u0251n">'
         "\u0644\u0628\u0646</phoneme></speak>", "ssml"),
}

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

    # Normalize: strip digits (speakArabic does the same), skip empties and
    # single letters (letters + letter/haraka combos go through TTS, not MP3).
    out = set()
    for s in strings:
        c = clean(s)
        if c and len(re.sub(r"[ً-ْٰـ]", "", c)) > 1:
            out.add(c)
    return sorted(out)


def load_harakat_dict() -> dict[str, str]:
    """Parse _HARAKAT_DICT from data.js — the same whole-string lookup the
    app's IIFE applies at runtime. Synthesizing the vocalized form is what
    makes Polly pronounce ambiguous words correctly (كتاب → كِتَاب)."""
    text = DATA_JS.read_text(encoding="utf-8")
    m = re.search(r"const _HARAKAT_DICT = \{(.*?)\n\};", text, re.S)
    if not m:
        return {}
    return dict(re.findall(r"'([^']+)'\s*:\s*'([^']+)'", m.group(1)))


# IPA per alphabet letter — used to build deterministic syllable MP3s
# (letter + haraka). Device TTS misreads these tiny syllables (fin -> vin,
# joun -> woun); Polly with an explicit IPA phoneme cannot.
LETTER_IPA = {
    "\u0623": "\u0294",        # alif/hamza
    "\u0628": "b", "\u062a": "t", "\u062b": "\u03b8",
    "\u062c": "d\u0292", "\u062d": "\u0127", "\u062e": "x",
    "\u062f": "d", "\u0630": "\u00f0", "\u0631": "r", "\u0632": "z",
    "\u0633": "s", "\u0634": "\u0283", "\u0635": "s\u02e4",
    "\u0636": "d\u02e4", "\u0637": "t\u02e4", "\u0638": "\u00f0\u02e4",
    "\u0639": "\u0295", "\u063a": "\u0263", "\u0641": "f",
    "\u0642": "q", "\u0643": "k", "\u0644": "l", "\u0645": "m",
    "\u0646": "n", "\u0647": "h", "\u0648": "w", "\u064a": "j",
}

# IPA of each letter NAME (alif, baa, ...) keyed by bare letter — plain-text
# synthesis lets Zeina drift on some names (waw read as "eww").
NAME_IPA = {
    "\u0623": "\u0294alif",
    "\u0628": "ba\u02d0\u0294", "\u062a": "ta\u02d0\u0294",
    "\u062b": "\u03b8a\u02d0\u0294", "\u062c": "d\u0292i\u02d0m",
    "\u062d": "\u0127a\u02d0\u0294", "\u062e": "xa\u02d0\u0294",
    "\u062f": "da\u02d0l", "\u0630": "\u00f0a\u02d0l",
    "\u0631": "ra\u02d0\u0294", "\u0632": "za\u02d0j",
    "\u0633": "si\u02d0n", "\u0634": "\u0283i\u02d0n",
    "\u0635": "s\u02e4a\u02d0d", "\u0636": "d\u02e4a\u02d0d",
    "\u0637": "t\u02e4a\u02d0\u0294", "\u0638": "\u00f0\u02e4a\u02d0\u0294",
    "\u0639": "\u0295ajn", "\u063a": "\u0263ajn",
    "\u0641": "fa\u02d0\u0294", "\u0642": "qa\u02d0f",
    "\u0643": "ka\u02d0f", "\u0644": "la\u02d0m",
    "\u0645": "mi\u02d0m", "\u0646": "nu\u02d0n",
    "\u0647": "ha\u02d0\u0294", "\u0648": "wa\u02d0w",
    "\u064a": "ja\u02d0\u0294",
}

# Letter names where Zeina renders the IPA badly — speak the fully vocalized
# Arabic name as plain text instead (these are ordinary words she reads well).
NAME_TEXT = {
    "\u0623": "\u0623\u064e\u0644\u0650\u0641",          # alif
    "\u0642": "\u0642\u064e\u0627\u0641",                # qaf
}

FATHA, DAMMA, KASRA = "\u064e", "\u064f", "\u0650"
SHADDA, SUKUN = "\u0651", "\u0652"
NOON, ALIF_FATHA = "\u0646", "\u0623\u064e"


def syllable_tasks() -> list[tuple[str, str, str]]:
    """(manifest_key, synth_text, text_type) for letters + harakat combos.
    Keys mirror exactly what app.js harakaSpeakable() passes to speakArabic;
    bare-letter keys speak the letter NAME (na field)."""
    text = DATA_JS.read_text(encoding="utf-8")
    tasks: list[tuple[str, str, str]] = []
    for m in re.finditer(r'l:\s*"([^"]{1,2})",\s*n:\s*"[^"]*",\s*na:\s*"([^"]*)"', text):
        letter, name = m.group(1), m.group(2)
        # ha is stored with a tatweel ("هـ") for display — drop it for IPA
        ipa = LETTER_IPA.get(letter.replace("\u0640", ""))
        if not ipa:
            continue
        # Tapping the bare letter speaks its name — IPA-forced, except the
        # few names Zeina renders badly in IPA (plain vocalized text wins).
        bare_letter = letter.replace("\u0640", "")
        name_ph = NAME_IPA.get(bare_letter)
        if bare_letter in NAME_TEXT:
            tasks.append((letter, NAME_TEXT[bare_letter], "text"))
        elif name_ph:
            tasks.append((letter,
                          '<speak><phoneme alphabet="ipa" ph="' + name_ph
                          + '">' + name + "</phoneme></speak>", "ssml"))
        else:
            tasks.append((letter, name, "text"))

        def ssml(ph: str, shown: str) -> str:
            return ('<speak><phoneme alphabet="ipa" ph="' + ph + '">'
                    + shown + "</phoneme></speak>")

        combos = [
            (letter + FATHA,              ipa + "a"),
            (letter + DAMMA,              ipa + "u"),
            (letter + KASRA,              ipa + "i"),
            (letter + FATHA + NOON + SUKUN, ipa + "an"),   # tanwin fath
            (letter + DAMMA + NOON + SUKUN, ipa + "un"),   # tanwin damm
            (letter + KASRA + NOON + SUKUN, ipa + "in"),   # tanwin kasr
            (ALIF_FATHA + letter + SHADDA + FATHA, "\u0294a" + ipa + ipa + "a"),  # shadda
            (ALIF_FATHA + letter + SUKUN,          "\u0294a" + ipa),              # sukun
        ]
        # Long vowels (madd): baa / buu / bii — app.js startQuizLong keys.
        # Not for alif: أَا is spelled آ and never quizzed.
        if bare_letter != "\u0623":
            combos += [
                (letter + FATHA + "\u0627", ipa + "a\u02d0"),
                (letter + DAMMA + "\u0648", ipa + "u\u02d0"),
                (letter + KASRA + "\u064a", ipa + "i\u02d0"),
            ]
        for key, ph in combos:
            tasks.append((key, ssml(ph, key), "ssml"))
    return tasks


VOWEL_IPA = {FATHA: "a", DAMMA: "u", KASRA: "i", SUKUN: ""}
MADD = {("a", "\u0627"), ("u", "\u0648"), ("i", "\u064a")}


def syllable_ipa(syl: str) -> str:
    """IPA of one written syllable (بَ, تَاب, رِير, ثَعْ, جَة, مَاء…)."""
    out, last_vowel = [], ""
    chars = list(syl)
    for i, ch in enumerate(chars):
        nxt = chars[i + 1] if i + 1 < len(chars) else ""
        if ch in VOWEL_IPA:
            out.append(VOWEL_IPA[ch])
            last_vowel = VOWEL_IPA[ch]
        elif ch == "\u0629":            # ta marbuta, pausal: the fatha carries the "a"
            continue
        elif (last_vowel, ch) in MADD and nxt not in VOWEL_IPA:
            out.append("\u02d0")        # madd letter lengthens the vowel
            last_vowel = ""
        elif ch == "\u0621":
            out.append("\u0294")
        else:
            out.append(LETTER_IPA[ch])
            last_vowel = ""
    return "".join(out)


def blend_syllable_tasks() -> list[tuple[str, str, str]]:
    """Syllables of BLEND_WORDS (guided reading), IPA-forced like harakat."""
    text = DATA_JS.read_text(encoding="utf-8")
    m = re.search(r"const BLEND_WORDS = \[(.*?)\n\];", text, re.S)
    if not m:
        return []
    tasks, seen = [], set()
    for arr in re.findall(r"syl:\s*\[([^\]]*)\]", m.group(1)):
        for syl in re.findall(r'"([^"]+)"', arr):
            if syl in seen:
                continue
            seen.add(syl)
            ph = syllable_ipa(syl)
            tasks.append((syl, '<speak><phoneme alphabet="ipa" ph="' + ph + '">'
                          + syl + "</phoneme></speak>", "ssml"))
    return tasks


def polly_client(region: str):
    try:
        import boto3  # type: ignore
    except ImportError:
        sys.exit("boto3 not installed. Run: pip install boto3")
    return boto3.client("polly", region_name=region)


def synthesize(client, text: str, voice: str, engine: str,
               text_type: str = "text", language: str = "arb") -> bytes:
    resp = client.synthesize_speech(
        Engine=engine,
        VoiceId=voice,
        OutputFormat="mp3",
        SampleRate="22050",
        LanguageCode=language,  # MSA. "arb" for standard; "ar-AE" for Gulf neural.
        Text=text,
        TextType=text_type,
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
    harakat = load_harakat_dict()
    manifest: dict[str, str] = {}
    generated = 0
    skipped = 0
    failed: list[str] = []

    for i, s in enumerate(strings, 1):
        # Speak (and key) the vocalized form — matches what the app speaks
        # after data.js's IIFE applies _HARAKAT_DICT at runtime.
        speak = harakat.get(s, s)
        file_id = short_id(speak)
        out = OUT_DIR / f"{file_id}.mp3"
        manifest[speak] = file_id
        # Also key the bare source form: words the runtime IIFE leaves
        # unvocalized (e.g. numbers with digits) are spoken bare.
        if s != speak:
            manifest[s] = file_id
        if out.exists() and not args.overwrite:
            skipped += 1
            continue
        try:
            ssml = SSML_OVERRIDES.get(speak)
            vo = VOICE_OVERRIDES.get(speak)
            if vo:
                data = synthesize(client, vo[3], vo[0], vo[1], vo[4], vo[2])
            elif ssml:
                data = synthesize(client, ssml, args.voice, args.engine, "ssml")
            else:
                data = synthesize(client, speak, args.voice, args.engine)
            out.write_bytes(data)
            generated += 1
            if i % 20 == 0:
                print(f"  [{i}/{len(strings)}] generated")
            time.sleep(0.02)  # gentle rate limit
        except Exception as e:
            failed.append(s)
            print(f"  FAIL  {s}: {e}", file=sys.stderr)

    # Letter names + harakat syllables (IPA-forced, device-TTS-free)
    for key, synth_text, ttype in syllable_tasks() + blend_syllable_tasks():
        file_id = short_id(key)
        out = OUT_DIR / f"{file_id}.mp3"
        manifest[key] = file_id
        if out.exists() and not args.overwrite:
            skipped += 1
            continue
        try:
            data = synthesize(client, synth_text, args.voice, args.engine, ttype)
            out.write_bytes(data)
            generated += 1
            time.sleep(0.02)
        except Exception as e:
            failed.append(key)
            print(f"  FAIL  {key}: {e}", file=sys.stderr)

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
