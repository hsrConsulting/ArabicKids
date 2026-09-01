/* ============================================================
   ARABIC KIDS - Audio System (Android + Web fallback)
   ============================================================ */

const AudioSystem = {
  context: null,
  enabled: true,
  isAndroid: typeof Android !== 'undefined',
  _current: null, // currently playing HTMLAudioElement (for stopSpeech)
  _silentCount: 0, // consecutive speakArabic calls where no playback succeeded
  _hintTriggered: false, // one-shot guard for the missing-TTS popup

  getContext() {
    if (!this.context) {
      try { this.context = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    return this.context;
  },

  // Resolve an Arabic string to a bundled MP3 asset URL, if one was generated.
  // Looks up the exact harakated form first, then the bare (undiacriticized)
  // form — matches how tools/generate_audio.py produces the manifest.
  _audioUrl(text) {
    if (typeof _AUDIO_DICT === 'undefined' || !text) return null;
    // Exact match first \u2014 letters and letter+haraka syllables have their own
    // IPA-forced MP3s keyed by the exact string harakaSpeakable() produces.
    if (_AUDIO_DICT[text]) return 'audio/' + _AUDIO_DICT[text] + '.mp3';
    var bare = text.replace(/[\u064B-\u0652\u0670]/g, '');
    // No bare fallback for single letters: it would make every haraka of a
    // letter play the same bare-letter MP3. Let TTS handle unknown combos.
    if (bare.length <= 1) return null;
    if (bare !== text && _AUDIO_DICT[bare]) return 'audio/' + _AUDIO_DICT[bare] + '.mp3';
    return null;
  },

  _playRecorded(text, onError) {
    var url = this._audioUrl(text);
    if (!url) { onError(); return; }
    var self = this;
    // onerror AND play().catch can both fire for the same failure — guard so
    // the TTS fallback runs once (double speakArabic with QUEUE_FLUSH stutters).
    var failed = false;
    var fail = function() { if (!failed) { failed = true; onError(); } };
    try {
      if (this._current) { try { this._current.pause(); } catch(e) {} this._current = null; }
      var a = new Audio(url);
      this._current = a;
      a.onplay = function() { self._silentCount = 0; }; // playback started → success
      a.onerror = fail;
      a.play().catch(fail);
    } catch(e) { fail(); }
  },

  // Called when no audio path produced playback for a speakArabic() request.
  // After a few consecutive silent attempts, surface the TTS-missing popup
  // so the parent can install the Arabic voice or check the volume.
  _registerSilentAttempt() {
    this._silentCount++;
    if (this._silentCount >= 3 && !this._hintTriggered && typeof _showTtsMissingHint === 'function') {
      this._hintTriggered = true;
      try { _showTtsMissingHint(); } catch(e) {}
    }
  },

  playSound(type) {
    if (!this.enabled) return;
    if (typeof Android !== 'undefined') {
      try { Android.playSound(type); return; } catch(e) {}
    }
    // Web Audio API fallback
    try {
      const ctx = this.getContext(); if(!ctx) return;
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      switch(type) {
        case 'correct':
          o.frequency.setValueAtTime(523,ctx.currentTime);o.frequency.setValueAtTime(659,ctx.currentTime+0.1);o.frequency.setValueAtTime(784,ctx.currentTime+0.2);g.gain.setValueAtTime(0.3,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.4);o.start();o.stop(ctx.currentTime+0.4);break;
        case 'wrong':
          o.frequency.setValueAtTime(300,ctx.currentTime);o.frequency.setValueAtTime(200,ctx.currentTime+0.15);g.gain.setValueAtTime(0.2,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.3);o.start();o.stop(ctx.currentTime+0.3);break;
        case 'click':
          o.frequency.setValueAtTime(800,ctx.currentTime);g.gain.setValueAtTime(0.1,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.05);o.start();o.stop(ctx.currentTime+0.05);break;
        case 'badge':
          o.frequency.setValueAtTime(523,ctx.currentTime);o.frequency.setValueAtTime(659,ctx.currentTime+0.15);o.frequency.setValueAtTime(784,ctx.currentTime+0.3);o.frequency.setValueAtTime(1047,ctx.currentTime+0.45);g.gain.setValueAtTime(0.3,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.7);o.start();o.stop(ctx.currentTime+0.7);break;
        case 'flip':
          o.frequency.setValueAtTime(600,ctx.currentTime);o.frequency.setValueAtTime(900,ctx.currentTime+0.05);g.gain.setValueAtTime(0.15,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.08);o.start();o.stop(ctx.currentTime+0.08);break;
        case 'match':
          o.frequency.setValueAtTime(659,ctx.currentTime);o.frequency.setValueAtTime(988,ctx.currentTime+0.15);g.gain.setValueAtTime(0.25,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.35);o.start();o.stop(ctx.currentTime+0.35);break;
        case 'complete':
          o.frequency.setValueAtTime(523,ctx.currentTime);o.frequency.setValueAtTime(784,ctx.currentTime+0.2);o.frequency.setValueAtTime(1047,ctx.currentTime+0.4);g.gain.setValueAtTime(0.3,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.6);o.start();o.stop(ctx.currentTime+0.6);break;
      }
    } catch(e) {}
  },

  speakArabic(text) {
    if (!this.enabled) return;
    // Strip Arabic-Indic (٠-٩ U+0660-0669) and Eastern Arabic (۰-۹ U+06F0-06F9)
    // digits and trailing whitespace before speaking. Numbers like "وَاحِد ١"
    // would otherwise read the word AND the numeral, producing "wahed wahed".
    text = (text || '').replace(/[\u0660-\u0669\u06F0-\u06F9\d]/g, '').replace(/\s+$/,'').trim();
    if (!text) return;

    var self = this;
    // Prefer bundled MP3 if available for this word — much higher quality
    // and device-independent. Falls back to TTS if no MP3 or playback fails.
    this._playRecorded(text, function() { self._speakTts(text); });
  },

  _speakTts(text) {
    var hasAndroid = typeof Android !== 'undefined';
    if (hasAndroid) {
      try {
        var ok = Android.speakArabic(text);
        if (ok === true || ok === 'true') return;
        // Local TTS unavailable — try the online fallback. We can't observe
        // success from JS, so count this as silent. If online does play, the
        // user just sees a warning popup once after a few words and can ignore;
        // if online fails too, the popup is genuinely useful.
        Android.speakOnline(text);
        this._registerSilentAttempt();
        return;
      } catch(e) {
        console.log('Android bridge error:', e);
      }
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ar-SA'; u.rate = 0.7; u.pitch = 1.1;
      var voices = window.speechSynthesis.getVoices();
      var arVoice = voices.find(function(v) { return v.lang.startsWith('ar'); });
      if (arVoice) u.voice = arVoice;
      window.speechSynthesis.speak(u);
    }
  },

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  },

  vibrate(ms) {
    if (typeof Android !== 'undefined') {
      try { Android.vibrate(ms || 30); } catch(e) {}
    } else if (navigator.vibrate) {
      navigator.vibrate(ms || 30);
    }
  }
};

// Ensure voices are loaded
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

// Android back button handler — navigate to parent screen
function handleAndroidBack() {
  if (!AppState) return true;
  var s = AppState.screen;
  if (s === 'welcome' || s === 'dashboard') return true; // close app
  // When entered from the daily challenge, back returns to home.
  if (AppState._dailyOrigin && s !== 'dashboard') {
    AppState._dailyOrigin = false;
    if (typeof goHome === 'function') goHome();
    return false;
  }
  // When entered from the guided path, return there first.
  if (AppState._pathOrigin && s !== 'path') {
    AppState._pathOrigin = false;
    if (typeof navigate === 'function') navigate('path');
    return false;
  }
  // Parent screen mapping. Register/Login back to welcome — never to a
  // dashboard the user isn't authenticated to see.
  var parents = {
    letterDetail: 'alphabet',
    wordList: 'words',
    letterTraceLesson: 'letterTraceMenu',
    register: 'welcome',
    login: 'welcome'
  };
  // If the user isn't logged in, the only safe top-level is 'welcome'.
  var fallback = AppState.user ? 'dashboard' : 'welcome';
  var parent = parents[s] || fallback;
  if (typeof navigate === 'function') navigate(parent);
  else if (typeof goHome === 'function') goHome();
  return false;
}
