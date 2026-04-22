# 🌟 Arabic Kids - Application Android
## تعلّم العربية - Apprends l'arabe en t'amusant !

---

## 📱 Application Android native (Smartphone + Tablette)

### Prérequis pour compiler

- **Android Studio** Hedgehog (2023.1) ou plus récent
- **JDK 17** ou supérieur
- **Android SDK 34** (API 34)
- **Gradle 8.2**

### Comment ouvrir le projet

1. Ouvrez **Android Studio**
2. Cliquez sur **"Open"** (pas "New Project")
3. Sélectionnez le dossier `ArabicKids/`
4. Attendez que Gradle synchronise les dépendances
5. Cliquez sur ▶️ **Run** pour lancer sur émulateur ou appareil

### Comment compiler l'APK

```bash
# Debug APK
./gradlew assembleDebug

# L'APK sera dans : app/build/outputs/apk/debug/app-debug.apk

# Release APK (nécessite une clé de signature)
./gradlew assembleRelease
```

---

## 📁 Structure du projet

```
ArabicKids/
├── build.gradle                    ← Configuration Gradle racine
├── settings.gradle                 ← Paramètres du projet
├── gradle.properties               ← Propriétés Gradle
├── gradle/wrapper/                 ← Wrapper Gradle
│
├── app/
│   ├── build.gradle                ← Dépendances et config de l'app
│   ├── proguard-rules.pro          ← Règles ProGuard
│   │
│   └── src/main/
│       ├── AndroidManifest.xml     ← Manifest Android
│       │
│       ├── java/com/arabickids/app/
│       │   ├── SplashActivity.java ← Écran de démarrage animé
│       │   └── MainActivity.java   ← Activité principale (WebView + ponts natifs)
│       │
│       ├── res/
│       │   ├── layout/
│       │   │   ├── activity_splash.xml  ← Layout splash screen
│       │   │   └── activity_main.xml    ← Layout WebView
│       │   ├── values/
│       │   │   ├── strings.xml          ← Textes
│       │   │   ├── colors.xml           ← Couleurs
│       │   │   └── themes.xml           ← Thèmes Material Design
│       │   ├── drawable/
│       │   │   ├── ic_launcher_foreground.xml  ← Icône vectorielle
│       │   │   ├── circle_teal.xml             ← Forme décorative
│       │   │   └── circle_red.xml              ← Forme décorative
│       │   ├── mipmap-*/
│       │   │   ├── ic_launcher.xml      ← Icône adaptive
│       │   │   └── ic_launcher_round.xml
│       │   └── raw/
│       │       ├── correct.wav   ← Son bonne réponse
│       │       ├── wrong.wav     ← Son mauvaise réponse
│       │       ├── click.wav     ← Son de clic
│       │       ├── badge.wav     ← Son nouveau badge
│       │       ├── flip.wav      ← Son retournement carte
│       │       ├── match.wav     ← Son paire trouvée
│       │       └── complete.wav  ← Son victoire
│       │
│       └── assets/web/              ← Application web embarquée
│           ├── index.html           ← Page principale (adaptée mobile)
│           ├── css/
│           │   └── style.css        ← Styles complets
│           └── js/
│               ├── audio.js         ← Audio (pont natif Android + fallback web)
│               ├── data.js          ← Données (alphabet, mots, traductions)
│               └── app.js           ← Logique applicative
```

---

## 🏗️ Architecture technique

### Approche hybride (WebView + Ponts natifs)

L'application utilise une **architecture hybride** :

| Composant | Technologie | Pourquoi |
|-----------|------------|----------|
| Interface utilisateur | HTML/CSS/JS dans WebView | Réutilisation du code web, animations fluides |
| Synthèse vocale arabe | Android TTS natif | Meilleure qualité que Web Speech API |
| Effets sonores | Android SoundPool | Latence minimale, fichiers WAV natifs |
| Vibration | Android Vibrator | Feedback haptique natif |
| Stockage | localStorage (WebView) | Persistance automatique |
| Splash screen | Activity native | Démarrage instantané |

### Pont JavaScript ↔ Android

Le fichier `audio.js` détecte automatiquement l'environnement :

```javascript
// Si Android natif disponible → utilise les APIs natives
if (typeof Android !== 'undefined') {
    Android.speakArabic("مرحبا");     // TTS natif
    Android.playSound("correct");      // SoundPool natif
    Android.vibrate(30);               // Vibration native
}
// Sinon → fallback Web Audio API + Web Speech API
```

---

## 📱 Compatibilité

| Appareil | Support |
|----------|---------|
| Smartphones Android | ✅ API 24+ (Android 7.0+) |
| Tablettes Android 7" | ✅ Layout adaptatif |
| Tablettes Android 10" | ✅ Layout optimisé large écran |
| Orientation Portrait | ✅ |
| Orientation Paysage | ✅ |
| Écrans avec encoche | ✅ Safe area insets |
| Navigation gestuelle | ✅ Bouton retour géré |

---

## 🎵 Fichiers audio

Les 7 fichiers audio sont générés en **WAV 22050Hz mono** :

| Fichier | Usage | Durée |
|---------|-------|-------|
| `correct.wav` | Bonne réponse (C5→E5→G5) | ~0.4s |
| `wrong.wav` | Mauvaise réponse (descendant) | ~0.35s |
| `click.wav` | Clic navigation | ~0.04s |
| `badge.wav` | Nouveau badge (fanfare) | ~0.75s |
| `flip.wav` | Retourner une carte Memory | ~0.07s |
| `match.wav` | Paire trouvée | ~0.32s |
| `complete.wav` | Quiz/jeu terminé (victoire) | ~0.75s |

---

## 🔒 Sécurité

- ✅ Aucune permission sensible requise
- ✅ Pas de publicité
- ✅ Données stockées uniquement en local sur l'appareil
- ✅ Pas d'accès réseau requis (sauf Google Fonts au 1er lancement)
- ✅ URLs externes bloquées dans la WebView
- ✅ Conforme RGPD

---

*Arabic Kids — تعلّم العربية 🌟*
