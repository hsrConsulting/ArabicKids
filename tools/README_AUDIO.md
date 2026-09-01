# Generating Arabic audio with Amazon Polly

The app ships with a hybrid audio pipeline: if a bundled MP3 exists for a
given Arabic word it is played directly, otherwise the code falls back to
on-device TTS. This script produces the MP3s.

## 1. AWS account setup (once)

1. Create an AWS account — https://aws.amazon.com/
2. In the AWS console, go to **IAM → Users → Create user** (e.g. `polly-cli`)
3. Attach policy **AmazonPollyFullAccess**
4. Create access key → "Application running outside AWS" → download CSV
5. On your laptop:
   ```bash
   pip install boto3 awscli
   aws configure
   # paste: Access key ID, Secret access key, default region (eu-west-1), format (json)
   ```

## 2. Voice choice

Pass `--voice` to switch. The free tier covers the first 5 M standard
characters / 1 M neural characters for 12 months — plenty for our ~10 k
characters.

| Voice  | Engine   | Language      | Notes                                |
|--------|----------|---------------|--------------------------------------|
| Zeina  | standard | arb (MSA)     | Default, female, neutral classical   |
| Hala   | neural   | ar-AE (Gulf)  | Female, natural                      |
| Zayd   | neural   | ar-AE (Gulf)  | Male, natural                        |

For a kids app teaching classical Arabic, **Zeina** is the best fit.

## 3. Run it

From the repo root:

```bash
# dry run: list what will be generated
python3 tools/generate_audio.py --dry-run

# full generation (writes ~280 MP3s to app/src/main/assets/web/audio/)
python3 tools/generate_audio.py

# re-run after adding new words — skips files already on disk
python3 tools/generate_audio.py

# regenerate everything with a different voice
python3 tools/generate_audio.py --voice Hala --overwrite
```

## 4. What it produces

- `app/src/main/assets/web/audio/<hash>.mp3` — one short MP3 per Arabic string.
  Hash is first 10 chars of md5(ar) so regenerations are idempotent.
- `app/src/main/assets/web/js/audio_manifest.js` — auto-included by
  `index.html`. Maps each Arabic string (with and without harakat) to its
  MP3 id. Playback is handled transparently by `AudioSystem.speakArabic`.

## 5. Ship it

```bash
./gradlew :app:assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

The APK grows by whatever the MP3 bundle size is (~10–25 MB expected).
