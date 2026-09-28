/* ============================================================
   ARABIC KIDS - Main Application
   ============================================================ */

const AppState = {
  lang: null, screen: 'welcome', user: null, score: 0, level: 1,
  lessons: 0, quizzes: 0, learnedLetters: [], earnedBadges: [], visitedCategories: [], ratingDone: false,
  difficulty: 'normal', premium: false,
  streak: { current: 0, longest: 0, lastActive: null },
  dailyDone: null,
  letterStats: {}, // { "ب": {views, listens, huntWins}, ... } — per-letter mastery counters
  skillsDone: [],  // skill quizzes passed (learning path 'skill' steps)
  review: {},      // { "L:ب"|"W:بَاب": {b: box 0-3, due: yyyy-mm-dd} } — spaced review of mistakes
  selectedLetter: null, selectedCategory: null, quizData: null,
  save() {
    if (!this.user) return;
    var json = JSON.stringify({
      user:this.user,lang:this.lang,score:this.score,level:this.level,
      lessons:this.lessons,quizzes:this.quizzes,learnedLetters:this.learnedLetters,earnedBadges:this.earnedBadges,visitedCategories:this.visitedCategories,ratingDone:this.ratingDone,
      difficulty:this.difficulty, premium:this.premium,
      streak:this.streak, dailyDone:this.dailyDone,
      letterStats:this.letterStats, review:this.review, skillsDone:this.skillsDone,
      dailyReviewDay:this.dailyReviewDay, dailyIsReview:this.dailyIsReview
    });
    try { localStorage.setItem('ak_' + this.user.name, json); } catch(e) {}
    // Sync to cloud
    try { if (typeof Android !== 'undefined' && Android.cloudSave) Android.cloudSave(this.user.name, this.user.code, json); } catch(e) {}
  },
  load(name) {
    try { const r=localStorage.getItem('ak_'+name); if(r){_resetProgress();Object.assign(this,JSON.parse(r));return true;} } catch(e) {}
    return false;
  },
  get t() { return this.lang ? TRANSLATIONS[this.lang] : TRANSLATIONS.en; },
  detectLanguage() {
    // Try Android bridge first, then browser language
    let lang = null;
    try { if (typeof Android !== 'undefined') lang = Android.getDeviceLanguage(); } catch(e) {}
    if (!lang) lang = window.deviceLanguage;
    if (!lang) lang = (navigator.language || navigator.userLanguage || 'en').split('-')[0];
    // Check if supported, default to English
    if (SUPPORTED_LANGUAGES.includes(lang)) return lang;
    return 'en';
  }
};

let selectedAvatarEmoji = '🦁';

// ==================== ANALYTICS ====================
const Analytics = {
  enabled: true,
  log(eventName, params) {
    if (!this.enabled) return;
    var p = params || {};
    var json = JSON.stringify(p);
    try {
      if (typeof Android !== 'undefined' && Android.trackEvent) {
        Android.trackEvent(eventName, json);
      } else {
        console.log('[Analytics]', eventName, p);
      }
    } catch(e) {}
  },
  setUser(name, value) {
    try {
      if (typeof Android !== 'undefined' && Android.setUserProperty) {
        Android.setUserProperty(name, String(value));
      }
    } catch(e) {}
  },
  // Convenience helpers
  screenView(screen) { this.log('screen_view', { screen: screen }); },
  quizStart(type, difficulty) { this.log('quiz_start', { quiz_type: type, difficulty: difficulty }); },
  quizComplete(type, score, total) { this.log('quiz_complete', { quiz_type: type, score: score, total: total, percent: total>0?Math.round(score/total*100):0 }); },
  lessonComplete(letter) { this.log('lesson_complete', { letter: letter }); },
  letterLearned(letter) { this.log('letter_learned', { letter: letter }); },
  badgeEarned(badgeId) { this.log('badge_earned', { badge_id: badgeId }); },
  premiumPaywallShown() { this.log('paywall_shown', {}); },
  premiumSubscribe(plan) { this.log('subscribe_attempt', { plan: plan }); },
  premiumActive() { this.log('premium_active', {}); },
  langChange(lang) { this.log('language_change', { language: lang }); this.setUser('language', lang); },
  difficultyChange(diff) { this.log('difficulty_change', { difficulty: diff }); this.setUser('difficulty', diff); },
  register(avatar) { this.log('user_register', { avatar: avatar }); },
  login() { this.log('user_login', {}); }
};

// ==================== CORE FUNCTIONS ====================
function render() {
  const app = document.getElementById('root');
  const t = AppState.t;
  const renderers = {
    welcome: renderWelcome, register: renderRegister, login: renderLogin,
    dashboard: renderDashboard, alphabet: renderAlphabet, letterDetail: renderLetterDetail, letterCheck: renderLetterCheck,
    words: renderWords, wordList: renderWordList, quizL: renderQuizLetters,
    quizW: renderQuizWords, quizResults: renderQuizResults, memory: renderMemory, badges: renderBadges,
    quizForms: renderQuizForms, quizAudio: renderQuizAudio, quizCategories: renderQuizCategories,
    quizFirstLetter: renderQuizFirstLetter,
    quizPhrases: renderQuizPhrases, quizMatch: renderQuizMatch,
    difficulty: renderDifficulty, letterForms: renderLetterForms,
    letterTraceMenu: renderLetterTraceMenu, letterTraceLesson: renderLetterTraceLesson,
    subscription: renderSubscription, readingWords: renderReadingWords, readingText: renderReadingText,
    quizChrono: renderQuizChrono, quizSpelling: renderQuizSpelling, quizExpert: renderQuizExpert,
    quizHarakat: renderQuizHarakat,
    quizPositions: renderQuizPositions,
    quizListen: renderQuizListen,
    quizSyllables: renderSoundQuiz,
    quizLong: renderSoundQuiz,
    quizTanwin: renderSoundQuiz,
    quizSunMoon: renderQuizSunMoon,
    blend: renderBlend,
    quizTwins: renderQuizTwins,
    quizReview: renderQuizReview,
    path: renderPath,
    onboarding: renderOnboarding,
    storiesList: renderStoriesList,
    story: renderStory,
    storyQuiz: renderStoryQuiz,
    letterHunt: renderLetterHunt,
    quizzesList: renderQuizzesList,
    quizOddOneOut: renderQuizOddOneOut,
    quizCounting: renderQuizCounting,
    anagram: renderAnagram,
    fallingLetters: renderFallingLetters,
    parentDashboard: renderParentDashboard,
    parentChildDetail: renderParentChildDetail
  };
  const fn = renderers[AppState.screen] || renderWelcome;
  app.innerHTML = fn(t);
  // Floating "Complete daily challenge" button visible on any non-dashboard
  // screen entered via startDailyChallenge(). Removes itself on every render
  // and re-inserts when the flag is still set.
  var existing = document.getElementById('dailyFloat');
  if (existing) existing.remove();
  if (AppState._dailyOrigin && AppState.screen !== 'dashboard') {
    var btn = document.createElement('button');
    btn.id = 'dailyFloat';
    btn.className = 'daily-float';
    btn.innerHTML = '✅ ' + (t.completeDaily || 'Terminer le défi');
    btn.onclick = completeDailyChallenge;
    document.body.appendChild(btn);
  }
  // Streak-saved popup fires once when bumpStreak consumed a freeze.
  _maybeShowStreakSavedPopup();
}

// Ad pacing — parent-friendly:
//   • 90s warm-up after app launch (never interrupt the very first minute)
//   • 120s cool-down between two ads (no back-to-back even if triggers stack)
// _adPending stays true across gates, so the deferred trigger fires on the
// next eligible navigation rather than being lost.
var _adSessionStartAt = Date.now();
var _adLastShownAt = 0;
var AD_WARMUP_MS = 90 * 1000;
var AD_MIN_INTERVAL_MS = 120 * 1000;
// Interstitial display is paused. Flip to false to re-enable — triggers /
// pacing / counters are untouched so behavior resumes identically.
var INTERSTITIAL_HIDDEN = true;
function _tryShowPendingAd() {
  if (!_adPending) return;
  if (INTERSTITIAL_HIDDEN) { _adPending = false; return; }
  if (AppState.premium) { _adPending = false; return; }
  var now = Date.now();
  if (now - _adSessionStartAt < AD_WARMUP_MS) return; // warm-up, keep pending
  if (now - _adLastShownAt < AD_MIN_INTERVAL_MS) return; // cool-down, keep pending
  try {
    if (typeof Android === 'undefined') { _adPending = false; return; }
    var shown = Android.showInterstitial();
    console.log('[AD] tryShow → shown=' + shown + ' pending=' + _adPending);
    if (shown === true || shown === 'true') {
      _adPending = false;
      _adLastShownAt = now;
    }
  } catch (e) {
    _adPending = false;
  }
}

function navigate(s) {
  // Tear down the falling-letters game loop on any navigation away from it
  // (the 🏠 / nav buttons don't go through _fallingExit, so its 80ms interval
  // would otherwise keep ticking — battery drain + stray playSound).
  if (s !== 'fallingLetters' && fallingState) {
    if (fallingState.timerId) clearInterval(fallingState.timerId);
    fallingState = null;
  }
  // Show pending ad when leaving results screen, or when leaving a letter
  // detail / tracing lesson (so the 4th-letter ad fires as the child moves on).
  var leavingLearning = AppState.screen === 'letterDetail' || AppState.screen === 'letterTraceLesson';
  if (AppState.screen === 'quizResults' || (AppState.quizData && AppState.quizData.done) || leavingLearning) _tryShowPendingAd();
  AppState.screen = s; AudioSystem.playSound('click'); render();
  window.scrollTo(0, 0);
  // Privacy policy link is only shown on the home (dashboard) — hide on every other screen.
  var pf = document.getElementById('privacyFooter');
  if (pf) pf.style.display = (s === 'dashboard') ? 'block' : 'none';
  Analytics.screenView(s);
  // Track quiz starts
  if (AppState.quizData && AppState.quizData.type && !AppState.quizData.done && (AppState.quizData.current === 0 || AppState.quizData.current === undefined)) {
    var t = AppState.quizData.type;
    if (s.indexOf('quiz') === 0 || s === 'memory') Analytics.quizStart(t, AppState.difficulty);
  }
}
function sectionBack() {
  // When entered from the daily challenge, back returns straight to home.
  if (AppState._dailyOrigin && AppState.screen !== 'dashboard') {
    AppState._dailyOrigin = false;
    goHome();
    return;
  }
  // When entered from the guided path, the section's ← button returns there.
  if (AppState._pathOrigin && AppState.screen !== 'path') {
    AppState._pathOrigin = false;
    navigate('path');
    return;
  }
  var parents = {
    letterDetail: 'alphabet',
    letterCheck: 'letterDetail',
    wordList: 'words',
    letterTraceLesson: 'letterTraceMenu'
  };
  var p = parents[AppState.screen];
  if (p) navigate(p);
  else goHome();
}

function goHome() {
  if (AppState.screen === 'dashboard') return;
  _tryShowPendingAd();
  AppState.selectedLetter=null; AppState.selectedCategory=null; AppState.quizData=null;
  AppState._pathOrigin = false;
  AppState._dailyOrigin = false;
  navigate('dashboard');
}

// ==================== DAILY CHALLENGE ====================
// Deterministic daily pick so every user gets the same challenge on the same
// day — but different from yesterday. Completion is tracked per date so the
// card flips to "done" and the child isn't nagged twice.
function _todayStr() { return new Date().toISOString().slice(0, 10); }

function getDailyChallenge() {
  const day = _todayStr();
  // Mistakes due for review at the first look of the day win the day. The
  // choice is frozen for the day so the challenge never swaps mid-day.
  if (AppState.dailyReviewDay !== day) {
    AppState.dailyReviewDay = day;
    AppState.dailyIsReview = reviewDueCount() > 0;
    AppState.save();
  }
  if (AppState.dailyIsReview) return { id: 'review', type: 'review', emoji: '🔁', label: 'review' };
  // djb2-style hash of yyyy-mm-dd → deterministic per day
  let h = 5381;
  for (let i = 0; i < day.length; i++) h = ((h << 5) + h + day.charCodeAt(i)) >>> 0;
  const pick = h % 3;
  if (pick === 0) {
    const letter = ALPHABET[h % ALPHABET.length];
    return { id: 'letter_' + letter.l, type: 'letter', target: letter.l, emoji: '🔤', label: letter.l };
  }
  if (pick === 1) {
    const keys = Object.keys(WORD_CATEGORIES).filter(k => !WORD_CATEGORIES[k].hidden);
    const k = keys[h % keys.length];
    return { id: 'cat_' + k, type: 'category', target: k, emoji: WORD_CATEGORIES[k].emoji, label: k };
  }
  return { id: 'quiz_listen', type: 'quiz_listen', emoji: '👂', label: 'listen' };
}

function isDailyDone() { return AppState.dailyDone === _todayStr(); }

function markDailyDone() {
  AppState.dailyDone = _todayStr();
  addScore(15); // bonus reward for completing the daily challenge
  AudioSystem.playSound('badge');
  try { if (typeof Android !== 'undefined' && Android.setDailyDone) Android.setDailyDone(); } catch (e) {}
}

function startDailyChallenge() {
  if (isDailyDone()) return;
  AppState._dailyOrigin = true;
  const d = getDailyChallenge();
  if (d.type === 'letter') {
    const idx = ALPHABET.findIndex(l => l.l === d.target);
    if (idx >= 0) { AppState.selectedLetter = idx; navigate('letterDetail'); }
  } else if (d.type === 'category') {
    openCategory(d.target);
  } else if (d.type === 'quiz_listen') {
    startQuizListen();
  } else if (d.type === 'review') {
    startReview();
  }
}

function completeDailyChallenge() {
  markDailyDone();
  AppState._dailyOrigin = false;
  goHome();
}

function dailyAutoCheck() {
  if (isDailyDone()) return;
  const d = getDailyChallenge();
  let done = false;
  if (d.type === 'letter') done = (AppState.learnedLetters || []).includes(d.target);
  else if (d.type === 'category') done = (AppState.visitedCategories || []).includes(d.target);
  else if (d.type === 'quiz_listen') done = (AppState._lastQuizType === 'listen');
  else if (d.type === 'review') done = (AppState._lastQuizType === 'review');
  if (done) markDailyDone();
}

// Update the daily-activity streak. Idempotent within a day. Called from any
// progress hook (addScore, addLesson, addQuiz, markLetterLearned) via save().
//
// Streak freeze:
//   - The child banks +1 freeze every 7 consecutive days (cap 2).
//   - Missing exactly one day (lastActive == day-before-yesterday) consumes
//     one freeze instead of resetting the streak. Two missed days or more
//     still resets — freezes only forgive single-day slips.
//   - When a freeze is consumed, _streakSavedPending is raised so the next
//     render shows a celebratory popup once.
const MAX_FREEZES = 2;
function bumpStreak() {
  const today = new Date().toISOString().slice(0, 10);
  if (!AppState.streak) AppState.streak = { current: 0, longest: 0, lastActive: null, freezes: 0 };
  if (typeof AppState.streak.freezes !== 'number') AppState.streak.freezes = 0;
  if (AppState.streak.lastActive === today) return;
  const yesterday  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const dayBefore  = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  if (AppState.streak.lastActive === yesterday) {
    AppState.streak.current += 1;
  } else if (AppState.streak.lastActive === dayBefore && AppState.streak.freezes > 0) {
    AppState.streak.freezes -= 1;
    AppState.streak.current += 1;
    AppState._streakSavedPending = true;
  } else {
    AppState.streak.current = 1;
  }
  if (AppState.streak.current > (AppState.streak.longest || 0)) AppState.streak.longest = AppState.streak.current;
  AppState.streak.lastActive = today;
  // Reward: +1 freeze every 7 consecutive days, capped.
  if (AppState.streak.current > 0 && AppState.streak.current % 7 === 0 && AppState.streak.freezes < MAX_FREEZES) {
    AppState.streak.freezes += 1;
  }
  if (AppState.streak.current === 7 || AppState.streak.current === 30) {
    setTimeout(() => showBigConfetti(), 250);
  }
}

// Surfaces a one-shot ❄️ popup when bumpStreak consumed a freeze. Called from
// render() right after the screen is painted so it lands on top.
function _maybeShowStreakSavedPopup() {
  if (!AppState._streakSavedPending) return;
  AppState._streakSavedPending = false;
  const t = AppState.t;
  AudioSystem.playSound('badge');
  const ov = document.createElement('div'); ov.className = 'badge-overlay'; ov.id = 'sso';
  ov.onclick = function(){ ['sso','ssp'].forEach(id=>{const e=document.getElementById(id);if(e)e.remove();}); };
  const pp = document.createElement('div'); pp.className = 'badge-popup'; pp.id = 'ssp';
  pp.innerHTML = `<div class="badge-popup-emoji">❄️</div>
    <h2 style="margin-bottom:8px">${t.streakSavedTitle || 'Streak saved!'}</h2>
    <p style="font-size:0.95rem;color:#718096;margin-bottom:14px;line-height:1.4">${t.streakSavedMsg || 'You used a freeze ❄️ — your streak keeps going!'}</p>
    <button class="btn btn-primary" onclick="document.getElementById('sso').click()" style="min-width:140px">${t.go || 'OK'} 🎉</button>`;
  document.body.appendChild(ov); document.body.appendChild(pp);
}

function addScore(p) { AppState.score+=p; AppState.level=Math.floor(AppState.score/100)+1; checkBadges(); bumpStreak(); AppState.save(); }
function addLesson() {
  AppState.lessons++;
  if(AppState.lessons===1)awardBadge('first_lesson');
  if(AppState.lessons>=10)awardBadge('lessons10');
  if(AppState.lessons>=25)awardBadge('lessons25');
  AppState.save();
}
var _adPending = false;
// Session counters for ad cadence. Interstitials are queued on completion of
// a unit of learning and shown on the next navigation away, so the child is
// never interrupted mid-exercise. Thresholds combined with the 120s cool-down
// in _tryShowPendingAd cap real-world rate at ~3-4 ads per 30-min session.
var _lettersViewedCount = 0;   // letter detail opens       — every 6
var _lettersTracedCount = 0;   // tracing validated         — every 6
var _memoryWinsCount = 0;      // memory match game wins    — every 5
var _readingWordsCount = 0;    // word reading sessions     — every 4
var _readingTextsCount = 0;    // text reading sessions     — every 3

function _trackQuizComplete() {
  var qd = AppState.quizData;
  if (!qd) return;
  var correct = (qd.results || []).filter(function(r){return r;}).length;
  var total = qd.questions ? qd.questions.length : (qd.totalPairs || correct);
  Analytics.quizComplete(qd.type || 'unknown', correct, total);
}

function addQuiz() {
  AppState.quizzes++;
  if(AppState.quizzes>=10)awardBadge('quiz10');
  if(AppState.quizzes>=25)awardBadge('quiz25');
  if(AppState.quizzes>=50)awardBadge('quiz50');
  AppState._lastQuizType = AppState.quizData && AppState.quizData.type;
  dailyAutoCheck();
  AppState.save();
  _trackQuizComplete();
  if(AppState.quizzes===10&&!AppState.ratingDone)setTimeout(showRatingPopup,1800);
  // Mark ad as pending — will show when user leaves results screen
  if(AppState.quizzes%3===0) _adPending = true;
}

// Per-letter counters. Small, cheap, persisted via AppState.save().
function bumpLetterStat(letter, field) {
  if (!AppState.letterStats) AppState.letterStats = {};
  var s = AppState.letterStats[letter] || { views: 0, listens: 0, huntWins: 0 };
  s[field] = (s[field] || 0) + 1;
  AppState.letterStats[letter] = s;
}

function getLetterStats(letter) {
  return (AppState.letterStats && AppState.letterStats[letter]) || { views: 0, listens: 0, huntWins: 0 };
}

function markLetterLearned(l) {
  if(!AppState.learnedLetters.includes(l)){
    AppState.learnedLetters.push(l);
    if(AppState.learnedLetters.length>=5)awardBadge('alpha5');
    if(AppState.learnedLetters.length>=14)awardBadge('alpha14');
    if(AppState.learnedLetters.length>=28)awardBadge('alpha28');
    dailyAutoCheck();
    AppState.save();
    Analytics.letterLearned(l);
  }
}

function checkBadges() { if(AppState.score>=100)awardBadge('score100'); if(AppState.score>=500)awardBadge('score500'); if(AppState.score>=1000)awardBadge('score1000'); }

const _MEGA_BADGES = ['alpha28', 'score1000'];
function awardBadge(id) {
  if(!AppState.earnedBadges.includes(id)){
    AppState.earnedBadges.push(id);
    const b=BADGE_DEFINITIONS.find(x=>x.id===id);
    if(b){
      AudioSystem.playSound('badge');
      showBadgePopup(b);
      if(_MEGA_BADGES.includes(id)) showBigConfetti(); else showConfetti();
    }
    AppState.save();
    Analytics.badgeEarned(id);
  }
}

function showBadgePopup(badge) {
  const t=AppState.t;
  const ov=document.createElement('div');ov.className='badge-overlay';ov.id='bo';ov.onclick=closeBadgePopup;
  const pp=document.createElement('div');pp.className='badge-popup';pp.id='bp';
  pp.innerHTML=`<div class="badge-popup-emoji">${badge.emoji}</div><h2 style="margin-bottom:8px">${t.newBadge}</h2><p style="font-size:1.15rem;font-weight:600;color:#4A5568">${badge.name[AppState.lang]||badge.name.en}</p><button class="btn btn-primary" style="margin-top:18px" onclick="closeBadgePopup()">${t.wellDone} ✨</button>`;
  document.body.appendChild(ov);document.body.appendChild(pp);
}

function closeBadgePopup() { ['bo','bp'].forEach(id=>{const e=document.getElementById(id);if(e)e.remove();}); }

function showRatingPopup() {
  const t=AppState.t;
  const ov=document.createElement('div');ov.className='badge-overlay';ov.id='ro';ov.onclick=closeRatingPopup;
  const pp=document.createElement('div');pp.className='badge-popup rating-popup';pp.id='rp';
  pp.innerHTML=`<div class="rating-stars">⭐⭐⭐⭐⭐</div>
    <h2 style="margin-bottom:6px">${t.ratingTitle}</h2>
    <p style="font-size:0.95rem;color:#718096;margin-bottom:18px;line-height:1.4">${t.ratingMessage}</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
      <button class="btn btn-primary" onclick="submitRating()" style="flex:1;min-width:120px">${t.ratingYes} 💛</button>
      <button class="btn btn-ghost" onclick="dismissRating()" style="flex:1;min-width:120px">${t.ratingLater}</button>
    </div>`;
  document.body.appendChild(ov);document.body.appendChild(pp);
}
function closeRatingPopup() { ['ro','rp'].forEach(id=>{const e=document.getElementById(id);if(e)e.remove();}); }
function submitRating() {
  closeRatingPopup(); AppState.ratingDone=true; AppState.save();
  try { if(typeof Android!=='undefined') Android.showToast(AppState.t.ratingThanks); } catch(e) {}
  const pkg='com.hsrconsulting.arabickids';
  window.location.href='market://details?id='+pkg;
}
function dismissRating() { closeRatingPopup(); AppState.ratingDone=true; AppState.save(); }

function showConfetti() {
  const c=document.createElement('div');c.className='confetti-c';c.id='confetti';
  const cols=['#FF6B6B','#4ECDC4','#FFE66D','#A78BFA','#F472B6','#60A5FA','#34D399','#FB923C'];
  for(let i=0;i<45;i++){const p=document.createElement('div');p.className='conf';p.style.left=Math.random()*100+'%';p.style.backgroundColor=cols[Math.floor(Math.random()*cols.length)];p.style.width=(6+Math.random()*8)+'px';p.style.height=(6+Math.random()*8)+'px';p.style.animationDuration=(1.5+Math.random()*2)+'s';p.style.animationDelay=(Math.random()*2)+'s';c.appendChild(p);}
  document.body.appendChild(c);setTimeout(()=>{const e=document.getElementById('confetti');if(e)e.remove();},4000);
}

// "MEGA" celebration: 110 particles, mix of squares + rounds, longer fall,
// played with a complete-sound cue. Reserved for milestone moments — full
// alphabet learned, learning path completed, 7/30-day streak reached.
function showBigConfetti() {
  const c=document.createElement('div');c.className='confetti-c';c.id='confetti';
  const cols=['#FF6B6B','#4ECDC4','#FFE66D','#A78BFA','#F472B6','#60A5FA','#34D399','#FB923C','#FBBF24','#EC4899'];
  for(let i=0;i<110;i++){
    const p=document.createElement('div');
    p.className='conf'+(Math.random()<0.45?' conf-round':'');
    p.style.left=Math.random()*100+'%';
    p.style.backgroundColor=cols[Math.floor(Math.random()*cols.length)];
    const sz=6+Math.random()*14;
    p.style.width=sz+'px';p.style.height=sz+'px';
    p.style.animationDuration=(2.5+Math.random()*3)+'s';
    p.style.animationDelay=(Math.random()*1.5)+'s';
    c.appendChild(p);
  }
  document.body.appendChild(c);
  setTimeout(()=>{const e=document.getElementById('confetti');if(e)e.remove();},7000);
  try{AudioSystem.playSound('complete');}catch(e){}
}

function selectAvatar(el,emoji) { document.querySelectorAll('.av-opt').forEach(e=>e.classList.remove('sel')); el.classList.add('sel'); selectedAvatarEmoji=emoji; }

function showAuthError(id, msg) {
  const el=document.getElementById(id);
  if(el){el.textContent=msg;el.style.display='block';}
  setTimeout(()=>{if(el)el.style.display='none';},3000);
}

function doRegister() {
  const t=AppState.t;
  const n=document.getElementById('rn').value.trim(),c=document.getElementById('rc').value;
  if(!n){showAuthError('reg-err',t.nameTooShort);return;}
  if(c.length!==4){showAuthError('reg-err',t.codeRequired);return;}
  // Cap local profiles — only enforced for *new* names; re-registering an
  // existing name (overwriting their saved state) doesn't grow the list.
  try {
    const existing = listLocalProfiles();
    if (existing.length >= MAX_PROFILES && !existing.some(p=>p.name===n)) {
      showAuthError('reg-err', t.maxChildrenReached || '4 children max');
      return;
    }
  } catch(e) {}
  _resetProgress();
  AppState.user={name:n,avatar:selectedAvatarEmoji,code:c};AppState.score=0;AppState.level=1;AppState.lessons=0;AppState.quizzes=0;AppState.learnedLetters=[];AppState.earnedBadges=[];AppState.visitedCategories=[];AppState.difficulty='normal';AppState.premium=false;
  AppState._firstTime=true;
  try{localStorage.setItem('ak_lastUser',n);}catch(e){}
  AppState.save();
  Analytics.register(selectedAvatarEmoji);
  navigate('difficulty');
}

function doLogin() {
  const t=AppState.t;
  const n=document.getElementById('ln').value.trim(),c=document.getElementById('lc').value;
  if(!n){showAuthError('login-err',t.nameTooShort);return;}
  if(c.length!==4){showAuthError('login-err',t.codeRequired);return;}
  // Try local first
  if(AppState.load(n)&&AppState.user&&AppState.user.code===c){
    try{localStorage.setItem('ak_lastUser',n);}catch(e){}
    navigate('dashboard');return;
  }
  // Try cloud (async)
  try {
    if (typeof Android !== 'undefined' && Android.cloudLoad) {
      window._pendingLoginCode = c;
      window._pendingLoginName = n;
      Android.cloudLoad(n, c);
      return; // callback _onCloudLoad will handle the rest
    }
  } catch(e) {}
  showAuthError('login-err',t.noAccount);
}

// Callback from Android after Firebase load
function _onCloudLoad(json) {
  const t = AppState.t;
  if (json) {
    try {
      var data = typeof json === 'string' ? JSON.parse(json) : json;
      if (data && data.user && data.user.code === window._pendingLoginCode) {
        _resetProgress();
        Object.assign(AppState, data);
        try { localStorage.setItem('ak_' + data.user.name, json); } catch(e) {}
        try { localStorage.setItem('ak_lastUser', data.user.name); } catch(e) {}
        navigate('dashboard');
        return;
      }
    } catch(e) {}
  }
  showAuthError('login-err', t.noAccount || 'Account not found');
}

function tryAutoLogin() {
  try{
    const last=localStorage.getItem('ak_lastUser');
    if(last&&AppState.load(last)&&AppState.user){
      Analytics.login();
      navigate('dashboard');return true;
    }
  }catch(e){}
  return false;
}

// ==================== MULTI-PROFILE (max 4 per device) ====================
const MAX_PROFILES = 4;
const _RESERVED_KEYS = new Set(['ak_lastUser','ak_theme','ak_onboardingDone']);

// Enumerate ak_{name} entries (excluding reserved keys), parse each profile
// and return a thin descriptor for the picker. Sorted by best-effort recency
// — the lastUser comes first when present.
function listLocalProfiles() {
  const out = [];
  try {
    const last = localStorage.getItem('ak_lastUser');
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('ak_') || _RESERVED_KEYS.has(k)) continue;
      try {
        const data = JSON.parse(localStorage.getItem(k));
        if (data && data.user && data.user.name) {
          out.push({
            name: data.user.name,
            avatar: data.user.avatar || '👤',
            level: data.level || 1,
            score: data.score || 0,
            isLast: data.user.name === last
          });
        }
      } catch(e) {}
    }
  } catch(e) {}
  out.sort((a,b)=> (b.isLast?1:0) - (a.isLast?1:0));
  return out;
}

// Show 4-digit code popup for an existing local profile, then load + go to
// dashboard on match. Re-uses the badge-popup overlay styling.
function promptProfileCode(name) {
  const t = AppState.t;
  AudioSystem.playSound('click');
  const ov = document.createElement('div'); ov.className = 'badge-overlay'; ov.id = 'cpo'; ov.onclick = closeCodePrompt;
  const pp = document.createElement('div'); pp.className = 'badge-popup'; pp.id = 'cpp';
  const safeName = (name||'').replace(/'/g,"\\'");
  const label = (t.enterCodeFor || 'Code for {name}').replace('{name}', name);
  pp.innerHTML = `<div class="badge-popup-emoji">🔑</div>
    <h2 style="margin-bottom:8px">${label}</h2>
    <div class="inp-group" style="margin-top:8px"><input class="inp" type="password" id="cpc" placeholder="••••" maxlength="4" inputmode="numeric" autocomplete="off" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)" onkeydown="if(event.key==='Enter')submitCodePrompt('${safeName}')"></div>
    <div class="auth-error" id="cp-err" style="display:none;margin-bottom:10px"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
      <button class="btn btn-ghost" onclick="closeCodePrompt()" style="flex:1;min-width:110px">${t.back || 'Back'}</button>
      <button class="btn btn-primary" onclick="submitCodePrompt('${safeName}')" style="flex:1;min-width:110px">${t.go || 'Go'} 🚀</button>
    </div>`;
  document.body.appendChild(ov); document.body.appendChild(pp);
  setTimeout(()=>{ const i=document.getElementById('cpc'); if(i) i.focus(); }, 80);
}
function closeCodePrompt() { ['cpo','cpp'].forEach(id=>{ const e=document.getElementById(id); if(e) e.remove(); }); }
function submitCodePrompt(name) {
  const t = AppState.t;
  const input = document.getElementById('cpc');
  const c = input ? input.value : '';
  if (c.length !== 4) {
    const er = document.getElementById('cp-err'); if (er) { er.textContent = t.codeRequired || 'Code requis'; er.style.display = 'block'; }
    return;
  }
  if (AppState.load(name) && AppState.user && AppState.user.code === c) {
    try { localStorage.setItem('ak_lastUser', name); } catch(e) {}
    closeCodePrompt();
    Analytics.login();
    navigate('dashboard');
    return;
  }
  const er = document.getElementById('cp-err'); if (er) { er.textContent = t.wrongCode || 'Code incorrect'; er.style.display = 'block'; }
}

// Long-press / × button on a profile card. Pure local removal — the Firestore
// copy stays untouched so the child can be recovered from another device.
function askRemoveProfile(name) {
  const t = AppState.t;
  const msg = (t.removeProfileConfirm || 'Remove {name} from this device?').replace('{name}', name);
  _parentGate(msg, function(){ confirmRemoveProfile(name); });
}
function confirmRemoveProfile(name) {
  try { localStorage.removeItem('ak_' + name); } catch(e) {}
  try {
    const last = localStorage.getItem('ak_lastUser');
    if (last === name) localStorage.removeItem('ak_lastUser');
  } catch(e) {}
  render();
}

function showLogoutPopup() {
  if (!AppState.user) { logout(); return; }
  _parentGate(AppState.t.logoutTitle || 'Log out?', logout);
}
function closeLogoutPopup() { ['lo','lp'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }); }
function confirmLogout() { closeLogoutPopup(); logout(); }

// ==================== PARENT GATE (code-protected actions) ====================
// Dedicated 4-digit parent code, stored device-wide in localStorage (key
// _PARENT_CODE_KEY). Distinct from the per-child login codes — those are
// known to the child, this one isn't. First trigger asks the parent to
// CREATE the code (new + confirm). Subsequent triggers ask to VERIFY it.
// If the parent ever forgets, only fix is to uninstall (CLAUDE.md notes it).
const _PARENT_CODE_KEY = 'ak_parentCode';
function _getParentCode() { try { return localStorage.getItem(_PARENT_CODE_KEY); } catch(e) { return null; } }
function _setParentCode(code) { try { localStorage.setItem(_PARENT_CODE_KEY, String(code)); } catch(e) {} }

function _parentGate(headline, actionFn) {
  const existing = _getParentCode();
  if (!existing) _showCreateParentCode(headline, actionFn);
  else           _showVerifyParentCode(headline, existing, actionFn);
}

function _showCreateParentCode(headline, actionFn) {
  const t = AppState.t;
  AudioSystem.playSound('click');
  const ov = document.createElement('div'); ov.className = 'badge-overlay'; ov.id = 'pgo'; ov.onclick = _closeParentGate;
  const pp = document.createElement('div'); pp.className = 'badge-popup'; pp.id = 'pgp';
  pp.innerHTML = `<div class="badge-popup-emoji">🔐</div>
    <h2 style="margin-bottom:6px">${t.parentCodeCreateTitle || 'Create parent code'}</h2>
    <p style="font-size:0.93rem;color:#718096;margin-bottom:14px;line-height:1.4">${t.parentCodeCreateDesc || '4 digits. Keep it secret from your child.'}</p>
    <div class="inp-group" style="margin:0 0 8px"><label style="font-size:0.85rem">${t.parentCodeNew || 'New code'}</label><input class="inp" type="password" id="pgc1" placeholder="••••" maxlength="4" inputmode="numeric" autocomplete="off" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)"></div>
    <div class="inp-group" style="margin:0 0 8px"><label style="font-size:0.85rem">${t.parentCodeConfirm || 'Confirm code'}</label><input class="inp" type="password" id="pgc2" placeholder="••••" maxlength="4" inputmode="numeric" autocomplete="off" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)" onkeydown="if(event.key==='Enter')_submitCreateParentCode()"></div>
    <div class="auth-error" id="pg-err" style="display:none;margin-bottom:10px"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
      <button class="btn btn-ghost" onclick="_closeParentGate()" style="flex:1;min-width:110px">${t.logoutCancel || 'Cancel'}</button>
      <button class="btn btn-primary" onclick="_submitCreateParentCode()" style="flex:1;min-width:110px">${t.parentCodeCreate || 'Create'} 🔐</button>
    </div>`;
  document.body.appendChild(ov); document.body.appendChild(pp);
  window._parentGateData = { mode: 'create', actionFn };
  setTimeout(()=>{ const i = document.getElementById('pgc1'); if (i) i.focus(); }, 80);
}

function _showVerifyParentCode(headline, expectedCode, actionFn) {
  const t = AppState.t;
  AudioSystem.playSound('click');
  const ov = document.createElement('div'); ov.className = 'badge-overlay'; ov.id = 'pgo'; ov.onclick = _closeParentGate;
  const pp = document.createElement('div'); pp.className = 'badge-popup'; pp.id = 'pgp';
  pp.innerHTML = `<div class="badge-popup-emoji">👪</div>
    <h2 style="margin-bottom:6px">${t.parentZone || 'Parent zone'}</h2>
    <p style="font-size:0.95rem;color:#718096;margin-bottom:14px;line-height:1.4">${headline || (t.parentZoneAsk || 'Ask a parent to type the code')}</p>
    <div class="inp-group" style="margin:0 0 8px"><input class="inp" type="password" id="pgc" placeholder="••••" maxlength="4" inputmode="numeric" autocomplete="off" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)" onkeydown="if(event.key==='Enter')_submitParentGate()"></div>
    <div class="auth-error" id="pg-err" style="display:none;margin-bottom:10px"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
      <button class="btn btn-ghost" onclick="_closeParentGate()" style="flex:1;min-width:110px">${t.logoutCancel || 'Cancel'}</button>
      <button class="btn btn-primary" onclick="_submitParentGate()" style="flex:1;min-width:110px">🔓 ${t.go || 'Go'}</button>
    </div>`;
  document.body.appendChild(ov); document.body.appendChild(pp);
  window._parentGateData = { mode: 'verify', expectedCode: String(expectedCode||''), actionFn };
  setTimeout(()=>{ const i = document.getElementById('pgc'); if (i) i.focus(); }, 80);
}

function _closeParentGate() { ['pgo','pgp'].forEach(id=>{const e=document.getElementById(id);if(e)e.remove();}); window._parentGateData=null; }

function _submitParentGate() {
  const t = AppState.t;
  const d = window._parentGateData; if (!d || d.mode !== 'verify') return;
  const input = document.getElementById('pgc'); const c = input ? input.value : '';
  if (c.length !== 4) {
    const er = document.getElementById('pg-err'); if (er) { er.textContent = t.codeRequired || 'Code requis'; er.style.display='block'; }
    return;
  }
  if (c === d.expectedCode) {
    const fn = d.actionFn; _closeParentGate();
    if (typeof fn === 'function') fn();
    return;
  }
  const er = document.getElementById('pg-err'); if (er) { er.textContent = t.wrongCode || 'Code incorrect'; er.style.display='block'; }
}

function _submitCreateParentCode() {
  const t = AppState.t;
  const d = window._parentGateData; if (!d || d.mode !== 'create') return;
  const c1 = (document.getElementById('pgc1')||{}).value || '';
  const c2 = (document.getElementById('pgc2')||{}).value || '';
  const er = document.getElementById('pg-err');
  if (c1.length !== 4) { if (er) { er.textContent = t.codeRequired || 'Code requis'; er.style.display='block'; } return; }
  if (c1 !== c2)       { if (er) { er.textContent = t.parentCodeMismatch || 'Codes do not match'; er.style.display='block'; } return; }
  _setParentCode(c1);
  const fn = d.actionFn; _closeParentGate();
  if (typeof fn === 'function') fn();
}

// Sensitive-action wrappers
function _openDifficulty() {
  if (!AppState.user) { navigate('difficulty'); return; }
  _parentGate(AppState.t.gateDifficulty || 'Change difficulty?', function(){ navigate('difficulty'); });
}

function logout() {
  try{localStorage.removeItem('ak_lastUser');}catch(e){}
  AppState.user=null;AppState.screen='welcome';render();
}

function setLanguage(lang) {
  AppState.lang=lang;
  if(AppState.user)AppState.save();
  Analytics.langChange(lang);
  render();
}

// ==================== SHARED RENDERERS ====================
function flLetters() {
  const ls=["أ","ب","ت","ج","ح","س","ش","ع","ف","ق","م","ن","و","ي"];
  let h='<div class="float-letters">';
  for(let i=0;i<12;i++){const l=ls[Math.floor(Math.random()*ls.length)];h+=`<div class="fl" style="left:${Math.random()*100}%;font-size:${30+Math.random()*55}px;animation-duration:${15+Math.random()*25}s;animation-delay:${Math.random()*20}s">${l}</div>`;}
  return h+'</div>';
}

function getDiffBadge(diff, t) {
  const map = {toddler:{e:'🧸',col:'#F472B6'}, beginner:{e:'🌱',col:'#34D399'}, normal:{e:'⭐',col:'#60A5FA'}, advanced:{e:'🔥',col:'#FB923C'}};
  const d = map[diff||'normal'];
  return `<span class="diff-badge" style="background:${d.col}20;color:${d.col};border:1.5px solid ${d.col}40" onclick="_openDifficulty()" title="${t.changeDifficulty||'Level'}">${d.e} ${t[diff||'normal']||diff||'Normal'}</span>`;
}

function navHTML(t) {
  const u = AppState.user;
  return `<div class="nav">
    <div class="nav-left">
      ${u?`<div class="nav-avatar" onclick="goHome()">${u.avatar}</div>`:''}
      <div class="nav-info">
        <div class="nav-name" onclick="goHome()">${u?u.name:'Arabic Kids'}</div>
        <div class="nav-level">${t.level} ${AppState.level} · ${getLevelName(AppState.level,t)} ${getDiffBadge(AppState.difficulty,t)}</div>
      </div>
    </div>
    <div class="nav-center">
      <div class="nav-score"><span class="nav-score-icon">⭐</span><span class="nav-score-val">${AppState.score}</span></div>
    </div>
    <div class="nav-right">
      <button class="nav-btn" onclick="goHome()" title="${t.home}">🏠</button>
      <button class="nav-btn" onclick="_toggleNavMenu(event)" title="${t.menu||'Menu'}" id="navMenuBtn">⋮</button>
      <div class="nav-menu" id="navMenu" style="display:none">
        <button class="nav-menu-item" onclick="AudioSystem.toggle();_closeNavMenu();render()"><span class="nav-menu-ico">${AudioSystem.enabled?'🔊':'🔇'}</span><span>${AudioSystem.enabled?(t.soundOn||'Sound on'):(t.soundOff||'Sound off')}</span></button>
        <button class="nav-menu-item" onclick="toggleTheme();_closeNavMenu()"><span class="nav-menu-ico">${AppState.theme==='dark'?'☀️':'🌙'}</span><span>${t.theme||'Theme'}</span></button>
        <button class="nav-menu-item" onclick="_closeNavMenu();openParentDashboard()"><span class="nav-menu-ico">👪</span><span>${t.parentDashTitle||t.parentZone||'Parents'}</span></button>
        <button class="nav-menu-item nav-menu-danger" onclick="_closeNavMenu();showLogoutPopup()"><span class="nav-menu-ico">🚪</span><span>${t.logoutTitle||'Log out'}</span></button>
      </div>
    </div>
  </div>`;
}

// Toggle overflow menu and wire a one-shot outside-click closer.
function _toggleNavMenu(e) {
  if (e) e.stopPropagation();
  const m = document.getElementById('navMenu'); if (!m) return;
  const open = m.style.display !== 'none';
  if (open) { _closeNavMenu(); return; }
  m.style.display = 'block';
  setTimeout(() => { document.addEventListener('click', _navMenuOutsideClick, { once: true }); }, 0);
}
function _closeNavMenu() {
  const m = document.getElementById('navMenu'); if (m) m.style.display = 'none';
  document.removeEventListener('click', _navMenuOutsideClick);
}
function _navMenuOutsideClick(e) {
  const m = document.getElementById('navMenu'); const btn = document.getElementById('navMenuBtn');
  if (!m) return;
  if (m.contains(e.target) || (btn && btn.contains(e.target))) {
    // Click inside menu or on toggle btn — re-attach the listener for the next click.
    document.addEventListener('click', _navMenuOutsideClick, { once: true });
    return;
  }
  _closeNavMenu();
}

function secH(t,title,back) { return `<div class="sec-header"><button class="back-btn" onclick="${back}"><span style="font-size:1.1rem">←</span> ${t.back}</button><h2>${title}</h2></div>`; }

// ==================== SCREEN RENDERERS ====================
function renderWelcome(t) {
  const langs=[{c:'fr',flag:'🇫🇷'},{c:'en',flag:'🇬🇧'},{c:'es',flag:'🇪🇸'},{c:'de',flag:'🇩🇪'},{c:'tr',flag:'🇹🇷'},{c:'hi',flag:'🇮🇳'},{c:'id',flag:'🇮🇩'},{c:'it',flag:'🇮🇹'},{c:'nl',flag:'🇳🇱'},{c:'pt',flag:'🇵🇹'}];
  const langBar = `<div class="lang-sel">${langs.map(l=>`<button class="lang-btn ${AppState.lang===l.c?'active':''}" onclick="setLanguage('${l.c}')">${l.flag}</button>`).join('')}</div>`;
  const profiles = listLocalProfiles();
  // Picker mode: at least one local profile exists. Show the profile cards +
  // 'Add child' tile (capped at MAX_PROFILES) + a small footer link to log in
  // with an existing account on another device (cloud recovery).
  if (profiles.length > 0) {
    const canAdd = profiles.length < MAX_PROFILES;
    const cards = profiles.map(p => {
      const safe = (p.name||'').replace(/'/g,"\\'");
      return `<div class="profile-card" onclick="promptProfileCode('${safe}')">
        <button class="profile-del" onclick="event.stopPropagation();askRemoveProfile('${safe}')" aria-label="Remove">×</button>
        <div class="profile-avatar">${p.avatar}</div>
        <div class="profile-name">${p.name}</div>
        <div class="profile-meta">${t.level} ${p.level} · ⭐ ${p.score}</div>
      </div>`;
    }).join('');
    const addTile = canAdd
      ? `<div class="profile-card profile-add" onclick="navigate('register')"><div class="profile-avatar">＋</div><div class="profile-name">${t.addChild || 'Add a child'}</div></div>`
      : `<div class="profile-cap-note">${t.maxChildrenReached || '4 children max'}</div>`;
    return `<div class="bg-deco"></div>${flLetters()}<div class="app"><div class="welcome page-in">
      <h1 class="w-title" style="margin-bottom:4px">Arabic Kids</h1>
      <p class="w-tagline" style="margin-bottom:18px">${t.chooseProfile || 'Who is learning today?'}</p>
      ${langBar}
      <div class="profile-grid">${cards}${addTile}</div>
      <button class="btn btn-ghost" style="margin-top:14px;font-size:0.95rem" onclick="navigate('login')">${t.useExistingAccount || 'Log in with an existing account'}</button>
    </div></div>`;
  }
  // First-launch mode: no profile yet — keep the original welcome screen.
  return `<div class="bg-deco"></div>${flLetters()}<div class="app"><div class="welcome page-in">
    <div class="w-chars"><span>🌟</span><span>📚</span><span>✨</span><span>🎮</span><span>🏆</span></div>
    <h1 class="w-title">Arabic Kids</h1><p class="w-arabic">تعلّم العربية</p>
    <p class="w-tagline">${t.tagline}</p>
    ${langBar}
    <div style="display:flex;gap:12px;margin-top:8px;width:100%;max-width:400px"><button class="btn btn-primary" onclick="navigate('register')" style="flex:1;font-size:1.1rem;padding:16px 0">${t.createAccount} ✨</button><button class="btn btn-secondary" onclick="navigate('login')" style="flex:1;font-size:1.1rem;padding:16px 0">${t.login} 👋</button></div>
  </div></div>`;
}

function renderRegister(t) {
  return `<div class="bg-deco"></div>${flLetters()}<div class="app"><div class="welcome page-in"><div class="auth-card">
    <h2>${t.createAccount} ✨</h2>
    <div class="inp-group"><label>${t.childName}</label><input class="inp" type="text" id="rn" placeholder="..." maxlength="20"></div>
    <div class="inp-group"><label>${t.chooseAvatar}</label><div class="avatar-grid">${AVATARS.map(a=>`<div class="av-opt ${a==='🦁'?'sel':''}" onclick="selectAvatar(this,'${a}')">${a}</div>`).join('')}</div></div>
    <div class="inp-group"><label>${t.code}</label><input class="inp" type="password" id="rc" placeholder="••••" maxlength="4" inputmode="numeric" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)"></div>
    <div class="auth-error" id="reg-err" style="display:none"></div>
    <div style="display:flex;gap:10px;margin-top:18px"><button class="btn btn-ghost" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;line-height:1.2" onclick="navigate('welcome')"><span style="font-size:0.85rem">${t.back}</span><span style="font-size:1.4rem">🔙</span></button><button class="btn btn-primary" style="flex:2" onclick="doRegister()">${t.go} 🚀</button></div>
  </div></div></div>`;
}

function renderLogin(t) {
  return `<div class="bg-deco"></div>${flLetters()}<div class="app"><div class="welcome page-in"><div class="auth-card">
    <h2>${t.login} 👋</h2>
    <div class="inp-group"><label>${t.childName}</label><input class="inp" type="text" id="ln" placeholder="..." maxlength="20"></div>
    <div class="inp-group"><label>${t.code}</label><input class="inp" type="password" id="lc" placeholder="••••" maxlength="4" inputmode="numeric" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)"></div>
    <div class="auth-error" id="login-err" style="display:none"></div>
    <div style="display:flex;gap:10px;margin-top:18px"><button class="btn btn-ghost" style="flex:1" onclick="navigate('welcome')">🔙 ${t.back}</button><button class="btn btn-primary" style="flex:2" onclick="doLogin()">${t.go} 🚀</button></div>
  </div></div></div>`;
}

function renderStreakBadge(t) {
  const s = AppState.streak; if (!s || !s.current) return '';
  const freezes = s.freezes || 0;
  const freezeBit = freezes > 0 ? ` · ❄️ ${freezes}` : '';
  return `<div class="streak-badge" title="${t.longestStreak||'Best'}: ${s.longest||s.current}${freezes?' — '+freezes+' freeze':''}">🔥 ${s.current} ${t.streakDays||'days'}${freezeBit}</div>`;
}

function renderDailyCard(t) {
  const d = getDailyChallenge();
  const done = isDailyDone();
  let headline;
  if (d.type === 'letter')        headline = `${t.stepLearn || 'Learn'} <span class="arabic" style="font-family:var(--font-arabic)">${d.label}</span>`;
  else if (d.type === 'category') headline = `${t.stepExplore || 'Explore'} ${t[d.target] || d.target}`;
  else if (d.type === 'review')   headline = (t.reviewDue || '{n} to review').replace('{n}', reviewDueCount() || '✓');
  else                            headline = t.quizListen || 'Listen';
  const cls = done ? 'daily-card daily-done' : 'daily-card';
  const action = done
    ? `<span class="daily-status">✅ ${t.doneToday || 'Terminé'}</span>`
    : `<button class="btn btn-primary btn-sm" onclick="startDailyChallenge()">▶ ${t.letsStart || 'Go'}</button>`;
  return `<div class="${cls}">
    <div class="daily-head">${d.emoji} <strong>${t.dailyChallenge || 'Daily challenge'}</strong></div>
    <div class="daily-body">${headline}</div>
    ${action}
  </div>`;
}

function renderDashboard(t) {
  const pct=Math.min((AppState.learnedLetters.length/28)*100,100);
  const greeting = AppState._firstTime ? (t.welcomeNew || t.welcomeBack) : t.welcomeBack;
  AppState._firstTime = false;
  return `<div class="bg-deco"></div>${flLetters()}<div class="app page-in">${navHTML(t)}
    <div class="dash-header"><h1>${greeting} ${AppState.user?.avatar||'👋'}</h1>${renderStreakBadge(t)}</div>
    ${renderDailyCard(t)}
    ${renderReviewCard(t)}
    <div class="stats-row">
      <div class="stat"><div class="stat-icon">⭐</div><div class="stat-val" style="color:var(--primary)">${AppState.score}</div><div class="stat-lbl">${t.totalScore}</div></div>
      <div class="stat"><div class="stat-icon">📖</div><div class="stat-val" style="color:var(--secondary)">${AppState.lessons}</div><div class="stat-lbl">${t.lessonsCompleted}</div></div>
      <div class="stat"><div class="stat-icon">🎯</div><div class="stat-val" style="color:var(--purple)">${AppState.quizzes}</div><div class="stat-lbl">${t.quizzesPassed}</div></div>
      <div class="stat"><div class="stat-icon">🔤</div><div class="stat-val" style="color:var(--orange)">${AppState.learnedLetters.length}/28</div><div class="stat-lbl">${t.alphabet}</div></div>
    </div>
    <div class="prog-container"><div class="prog-label"><span>${t.progress}</span><span>${Math.round(pct)}%</span></div><div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div></div>
    ${AppState.difficulty==='toddler' ? `
    <div class="menu-grid">
      <div class="menu-item menu-item-path" onclick="navigate('path')"><span class="menu-icon">🗺️</span><span class="menu-lbl">${t.learningPath||'Path'}</span></div>
      <div class="menu-item" onclick="navigate('alphabet')"><span class="menu-icon">🔤</span><span class="menu-lbl">${t.alphabet}</span></div>
      <div class="menu-item" onclick="navigate('words')"><span class="menu-icon">📝</span><span class="menu-lbl">${t.words}</span></div>
      <div class="menu-item" onclick="startQuizListen()"><span class="menu-icon">👂</span><span class="menu-lbl">${t.quizListen||'Listen'}</span></div>
      <div class="menu-item menu-item-stories" onclick="navigate('storiesList')"><span class="menu-icon">📖</span><span class="menu-lbl">${t.stories||'Stories'}</span></div>
      <div class="menu-item" onclick="startLetterHuntFromHome()"><span class="menu-icon">🔍</span><span class="menu-lbl">${t.letterHunt||'Hunt'}</span></div>
      <div class="menu-item" onclick="startMemory()"><span class="menu-icon">🃏</span><span class="menu-lbl">${t.memory}</span></div>
    </div>
    ` : `
    <div class="menu-grid">
      <div class="menu-item menu-item-path" onclick="navigate('path')"><span class="menu-icon">🗺️</span><span class="menu-lbl">${t.learningPath||'Path'}</span></div>
      <div class="menu-item" onclick="navigate('alphabet')"><span class="menu-icon">🔤</span><span class="menu-lbl">${t.alphabet}</span></div>
      <div class="menu-item" onclick="navigate('words')"><span class="menu-icon">📝</span><span class="menu-lbl">${t.words}</span></div>
      <div class="menu-item menu-item-quizzes" onclick="navigate('quizzesList')"><span class="menu-icon">🎯</span><span class="menu-lbl">${t.quizzesAll||'Quiz'}</span></div>
      <div class="menu-item menu-item-stories" onclick="navigate('storiesList')"><span class="menu-icon">📖</span><span class="menu-lbl">${t.stories||'Stories'}</span></div>
      <div class="menu-item menu-item-forms" onclick="navigate('letterForms')"><span class="menu-icon">✍️</span><span class="menu-lbl">${t.letterForms}</span></div>
      <div class="menu-item menu-item-trace" onclick="navigate('letterTraceMenu')"><span class="menu-icon">✏️</span><span class="menu-lbl">${t.tracing||'Écriture'}</span></div>
      <div class="menu-item menu-item-reading" onclick="startBlend()"><span class="menu-icon">🧱</span><span class="menu-lbl">${t.blendTitle||'Guided reading'}</span></div>
      <div class="menu-item menu-item-reading" onclick="startReadingWords()"><span class="menu-icon">🎙️</span><span class="menu-lbl">${t.readingWords||'Lecture'}</span></div>
      ${AppState.difficulty==='advanced'?`<div class="menu-item menu-item-reading" onclick="startReadingText()"><span class="menu-icon">📖</span><span class="menu-lbl">${t.readingText||'Textes'}</span></div>`:''}
      <div class="menu-item" onclick="startLetterHuntFromHome()"><span class="menu-icon">🔍</span><span class="menu-lbl">${t.letterHunt||'Hunt'}</span></div>
      <div class="menu-item" onclick="startMemory()"><span class="menu-icon">🃏</span><span class="menu-lbl">${t.memory}</span></div>
      <div class="menu-item" onclick="navigate('badges')"><span class="menu-icon">🏆</span><span class="menu-lbl">${t.badges}</span></div>
    </div>
    `}
    <!-- Premium section hidden for now
    <div class="premium-section">
      ...
    </div>
    -->
    <div style="text-align:center;margin:24px 0 8px">
      <button class="btn btn-ghost btn-sm" onclick="navigate('difficulty')" style="font-size:0.88rem;gap:6px">
        ⚙️ ${t.changeDifficulty||'Change level'} — <strong>${getDiffBadge(AppState.difficulty,t)}</strong>
      </button>
    </div>
    <div style="text-align:center;margin:0 0 16px">
      <button class="btn btn-ghost btn-sm" onclick="shareAppAction()" style="font-size:0.88rem;gap:6px">
        📤 ${t.shareApp||'Share the app'}
      </button>
    </div>
  </div>`;
}

// ==================== ALPHABET ====================
function renderAlphabet(t) {
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}${secH(t,'🔤 '+t.alphabet,'sectionBack()')}
    <div class="alpha-grid">${ALPHABET.map((item,i)=>`<div class="ltile ${AppState.learnedLetters.includes(item.l)?'learned':''}" style="background:linear-gradient(135deg,${item.c},${item.c}CC)" onclick="openLetter(${i})"><span class="al">${item.l}</span><span class="ln">${item.n}</span></div>`).join('')}</div></div>`;
}

function openLetter(i) {
  AppState.selectedLetter = i;
  AudioSystem.speakArabic(ALPHABET[i].l);
  navigate('letterDetail');
  // Queue an interstitial for every 6 letter consultations (shown on exit).
  _lettersViewedCount++;
  if (_lettersViewedCount % 6 === 0) _adPending = true;
}

// Diacritical marks (harakat)
var HARAKAT = [
  { mark: '\u064E', name: 'Fatha',   nameAr: 'فَتْحَة',  sound: 'a',  color: '#22c55e' },
  { mark: '\u064F', name: 'Damma',   nameAr: 'ضَمَّة',   sound: 'ou', color: '#3b82f6' },
  { mark: '\u0650', name: 'Kasra',   nameAr: 'كَسْرَة',  sound: 'i',  color: '#f59e0b' },
  { mark: '\u0652', name: 'Sukun',   nameAr: 'سُكُون',   sound: '',   color: '#6b7280' },
  { mark: '\u0651', name: 'Shadda',  nameAr: 'شَدَّة',   sound: 'x2', color: '#ef4444' },
  { mark: '\u064B', name: 'Tanwin Fath', nameAr: 'تَنْوِين فَتْح', sound: 'an', color: '#8b5cf6' },
  { mark: '\u064C', name: 'Tanwin Damm', nameAr: 'تَنْوِين ضَمّ', sound: 'oun', color: '#06b6d4' },
  { mark: '\u064D', name: 'Tanwin Kasr', nameAr: 'تَنْوِين كَسْر', sound: 'in', color: '#ec4899' }
];

// TTS misreads an isolated letter followed by tanwin/shadda/sukun (adds w/y
// glides). Build a properly-spelled syllable that also matches the IPA-forced
// MP3 keys from tools/generate_audio.py; the UI keeps showing letter+mark.
function harakaSpeakable(letter, mark) {
  switch (mark) {
    case '\u064B': return letter + '\u064E\u0646\u0652'; // tanwin fath -> Xan
    case '\u064C': return letter + '\u064F\u0646\u0652'; // tanwin damm -> Xoun
    case '\u064D': return letter + '\u0650\u0646\u0652'; // tanwin kasr -> Xin
    case '\u0651': return '\u0623\u064E' + letter + '\u0651\u064E'; // shadda -> aXXa
    case '\u0652': return '\u0623\u064E' + letter + '\u0652'; // sukun -> aX
    default: return letter + mark; // fatha/damma/kasra read fine as-is
  }
}

function renderLetterDetail(t) {
  var i=AppState.selectedLetter, d=ALPHABET[i];
  // Count this view (one per navigation, not per re-render — guard via a flag)
  if (AppState._lastViewedLetter !== d.l) {
    bumpLetterStat(d.l, 'views');
    AppState._lastViewedLetter = d.l;
    if (AppState.user) AppState.save();
  }
  var stats = getLetterStats(d.l);
  var _learned = AppState.learnedLetters.includes(d.l);
  // Soft pedagogical gate: outside toddler mode the child must validate the
  // letter (recognition check) before "Next" advances. Until then the button
  // launches the check instead of skipping ahead.
  var _gated = letterGateActive() && !_learned;
  var _nextLbl = _gated ? ('✅ ' + (t.letterValidateCta || 'I know it!'))
                        : (i < 27 ? t.next + ' →' : '✅ ' + t.wellDone);
  var formNames = ['isolated','initial','medial','final'];
  var formsHTML = d.forms ? formNames.map(function(fn) {
    var fm = d.forms[fn];
    if (!fm) return '<div class="lform-card disabled"><div class="lform-label">'+t[fn]+'</div><div class="lform-char">—</div></div>';
    return '<div class="lform-card" data-speak="'+fm.ex+'" style="cursor:pointer"><div class="lform-label">'+t[fn]+'</div><div class="lform-char" style="color:'+d.c+'">'+fm.f+'</div><div class="lform-ex"><div class="lform-ex-ar">'+fm.ex+'</div><div class="lform-ex-tr">'+fm.exm[AppState.lang]+'</div></div></div>';
  }).join('') : '';

  // Build harakat section — harakaSpeakable() gives TTS/MP3 a pronounceable
  // syllable; display stays the raw combined form.
  var harakatHTML = HARAKAT.map(function(h) {
    var combined = d.l + h.mark;
    var speak = harakaSpeakable(d.l, h.mark);
    return '<div class="haraka-card" data-speak="'+speak+'" style="border-color:'+h.color+'30;background:'+h.color+'08">' +
      '<div class="haraka-char" style="color:'+h.color+'">'+combined+'</div>' +
      '<div class="haraka-name">'+h.nameAr+'</div>' +
      '<div class="haraka-latin">'+h.name+(h.sound?' · '+d.n.charAt(0).toLowerCase()+h.sound:'')+'</div>' +
      '<div class="haraka-play" data-speak="'+speak+'">🔊</div>' +
    '</div>';
  }).join('');

  return '<div class="bg-deco"></div><div class="app page-in">'+navHTML(t)+'<div class="ldetail">' +
    secH(t,t.letterOf+' '+(i+1)+'/28',"sectionBack()") +
    '<div class="lbig" style="color:'+d.c+'" data-speak="'+d.l+'">'+d.l+'</div>' +
    '<div class="lname"><span class="arabic" style="font-size:1.2rem">'+d.na+'</span> — '+d.n+'</div>' +
    '<div class="lmastery">'+(_learned?'<span class="lc-learned">✓ '+(t.letterLearned||'Learned')+'</span> · ':'')+'👀 '+stats.views+' · 🔊 '+stats.listens+(stats.huntWins?' · 🔍 '+stats.huntWins:'')+'</div>' +
    '<button class="btn btn-secondary btn-sm" onclick="bumpLetterStat(\''+d.l+'\',\'listens\');if(AppState.user)AppState.save();AudioSystem.speakArabic(\''+d.l+'\')" style="margin:0 auto 14px;display:flex">🔊 '+t.listen+'</button>' +
    '<div class="lword-box"><div class="lword-emoji">'+d.e+'</div><div class="lword-ar" data-speak="'+d.w+'">'+d.w+'</div><div class="wphon" style="margin:-2px 0 4px">'+transliterate(d.w)+'</div><div class="lword-mean">'+d.wm[AppState.lang]+'</div><button class="listen-btn" data-speak="'+d.w+'" style="margin:10px auto 0;display:flex">🔊 '+t.listen+'</button></div>' +
    (d.extra && d.extra.length ? '<div class="lextra-grid">' + d.extra.map(function(x) {
      var tr = (x.tr && (x.tr[AppState.lang] || x.tr.en)) || '';
      return '<div class="lextra-card" data-speak="'+x.ar+'" style="cursor:pointer"><div class="lextra-emoji">'+(x.e||'🔤')+'</div><div class="lextra-ar">'+x.ar+'</div><div class="lextra-tr">'+tr+'</div></div>';
    }).join('') + '</div>' : '') +
    '<button class="btn btn-ghost btn-sm" onclick="startLetterHunt()" style="margin:0 auto 14px;display:flex;gap:6px">🔍 '+(t.letterHunt||'Chasse aux lettres')+'</button>' +
    '<div class="lforms-title">' + (t.diacritics||'التشكيل · Signes diacritiques') + '</div>' +
    '<div class="harakat-grid">'+harakatHTML+'</div>' +
    (d.forms?'<div class="lforms-title">✍️ '+t.letterForms+'</div><div class="lforms-grid">'+formsHTML+'</div>':'') +
    '<div class="lnav">' +
      '<button class="btn btn-sm btn-ghost" '+(i===0?'disabled':'')+' onclick="AppState.selectedLetter='+(i-1)+';AudioSystem.speakArabic(ALPHABET['+(i-1>=0?i-1:0)+'].l);render();window.scrollTo(0,0)">← '+t.previous+'</button>' +
      '<button class="btn btn-primary btn-sm" onclick="letterNext('+i+')">'+_nextLbl+'</button>' +
    '</div>' +
  '</div></div>';
}

function letterNext(i) {
  var l = ALPHABET[i].l;
  // Pedagogical gate (skipped in toddler mode): a letter must be validated via
  // the recognition check before it counts as learned and the child moves on.
  if (letterGateActive() && !AppState.learnedLetters.includes(l)) {
    startLetterCheck(i);
    return;
  }
  // Toddler mode (exempt) or an already-validated letter → mark + advance.
  // Score only in toddler mode here; for gated modes the points are awarded
  // once, on passing the check (prevents re-pressing "Next" to farm points).
  markLetterLearned(l);
  if (AppState.difficulty === 'toddler') { addLesson(); addScore(5); }
  AudioSystem.playSound('correct');
  _advanceFromLetter(i);
}

// Move on after a letter is done — to the next guided-path step if we came from
// the path (could be a quiz/category, not always the next letter), else to the
// next alphabet letter, else back to the grid. Extracted so both the "Next"
// button and the recognition check can reuse it.
function _advanceFromLetter(i) {
  if (AppState._pathOrigin) {
    var next = LEARNING_PATH[currentPathIndex()];
    if (next) { goToPathStep(next.id); window.scrollTo(0, 0); return; }
    AppState._pathOrigin = false;
    navigate('path');
    return;
  }
  if (i < 27) { AppState.selectedLetter = i + 1; AudioSystem.speakArabic(ALPHABET[i + 1].l); navigate('letterDetail'); window.scrollTo(0, 0); }
  else navigate('alphabet');
}

// ── Per-letter recognition gate ───────────────────────────────────────────
// Active outside toddler mode. To "learn" a letter the child must RECOGNISE it:
// hear its sound, then tap the right glyph among distractors. Passing a small
// number of rounds (1 beginner, 2 normal/advanced) marks it learned, scores it
// and unlocks the next step. This is the single source of `learnedLetters` in
// gated modes, so the green grid / path progress now reflect real acquisition.
function letterGateActive() { return AppState.difficulty !== 'toddler'; }

var _letterCheck = null;

function startLetterCheck(i) {
  var diff = DIFFICULTY[AppState.difficulty || 'normal'];
  var passRounds = (AppState.difficulty === 'beginner') ? 1 : 2;
  _letterCheck = { i: i, target: ALPHABET[i].l, optionCount: Math.max(2, diff.options), passRounds: passRounds, round: 0, done: false, options: [] };
  _buildLetterCheckRound();
  navigate('letterCheck');
  setTimeout(function() { AudioSystem.speakArabic(ALPHABET[i].l); }, 350);
}

function _buildLetterCheckRound() {
  var lc = _letterCheck; if (!lc) return;
  var others = ALPHABET.map(function(x) { return x.l; }).filter(function(l) { return l !== lc.target; });
  others = shuffle(others).slice(0, lc.optionCount - 1);
  lc.options = shuffle([lc.target].concat(others));
}

function renderLetterCheck(t) {
  var lc = _letterCheck;
  if (!lc) { setTimeout(function() { navigate('alphabet'); }, 0); return '<div class="app"></div>'; }
  var d = ALPHABET[lc.i];
  var dots = '';
  for (var r = 0; r < lc.passRounds; r++) dots += '<span class="lc-dot' + (r < lc.round ? ' on' : '') + '"></span>';
  return '<div class="bg-deco"></div><div class="app page-in"><div class="lcheck">' +
    secH(t, '🔤 ' + (t.letterValidateCta || 'I know it!'), "navigate('letterDetail')") +
    (lc.passRounds > 1 ? '<div class="lc-progress">' + dots + '</div>' : '') +
    '<div class="lc-q">' + (t.letterCheckQ || 'Tap the letter you hear') + '</div>' +
    '<button class="btn btn-secondary lc-replay" onclick="AudioSystem.speakArabic(\'' + lc.target + '\')">🔊</button>' +
    '<div class="lc-grid">' + lc.options.map(function(l) {
      return '<button class="lc-opt" style="color:' + d.c + '" onclick="_letterCheckAnswer(\'' + l + '\')">' + l + '</button>';
    }).join('') + '</div>' +
    '<div id="lcResult" class="lc-result"></div>' +
  '</div></div>';
}

function _letterCheckAnswer(l) {
  var lc = _letterCheck; if (!lc || lc.done) return;
  var t = AppState.t;
  var resEl = document.getElementById('lcResult');
  if (l !== lc.target) {
    AudioSystem.playSound('wrong'); AudioSystem.vibrate(40);
    if (resEl) resEl.innerHTML = '<div class="lc-msg bad">💪 ' + (t.traceRetryMsg || 'Try again!') + '</div>';
    setTimeout(function() { AudioSystem.speakArabic(lc.target); }, 250);
    return;
  }
  AudioSystem.playSound('correct');
  lc.round++;
  if (lc.round >= lc.passRounds) { lc.done = true; _letterCheckPass(); return; }
  _buildLetterCheckRound();
  render();
  setTimeout(function() { AudioSystem.speakArabic(lc.target); }, 300);
}

function _letterCheckPass() {
  var lc = _letterCheck; var i = lc.i, t = AppState.t;
  var diff = DIFFICULTY[AppState.difficulty || 'normal'];
  markLetterLearned(lc.target); addLesson(); addScore(diff.pts || 5);
  AudioSystem.playSound('correct'); showConfetti();
  var resEl = document.getElementById('lcResult');
  if (resEl) resEl.innerHTML = '<div class="lc-msg good">🎉 ' + (t.wellDone || 'Well done!') + '</div>' +
    '<button class="btn btn-primary" style="margin-top:14px" onclick="_letterCheckContinue()">' + (i < 27 ? (t.next + ' →') : ('✅ ' + t.wellDone)) + '</button>';
}

function _letterCheckContinue() {
  var lc = _letterCheck; var i = lc ? lc.i : AppState.selectedLetter;
  _letterCheck = null;
  _advanceFromLetter(i);
}

// ==================== QUIZZES LIST ====================
// Single entry point for all quizzes — keeps the dashboard uncluttered and
// lets the child see what kind of quiz they pick (letters / words / sounds).
// Premium quizzes (chrono/spelling/expert) are temporarily hidden from the
// hub — keep their start functions in place for when premium is re-enabled.
function renderQuizzesList(t) {
  const due = reviewDueCount();
  const sections = [
    { title: '🔁 ' + (t.reviewTitle || 'Review'), items: [
      { ico: '🔁', lbl: (t.reviewTitle || 'Review') + (due ? ' (' + due + ')' : ''), fn: 'startReview()' }
    ]},
    { title: '🔤 ' + (t.quizCatLetters || 'Lettres'), items: [
      { ico: '🎯',  lbl: t.quizLetters,                       fn: 'startQuizLetters()' },
      { ico: '🔡',  lbl: t.quizFirstLetter || 'First letter', fn: 'startQuizFirstLetter()' },
      { ico: '📍',  lbl: t.quizPositions   || 'Positions',    fn: 'startQuizPositions()' },
      { ico: '◌َ',  lbl: t.quizHarakat     || 'Harakat',      fn: 'startQuizHarakat()' },
      { ico: '👯', lbl: t.quizTwins       || 'Twin letters', fn: 'startQuizTwins()' },
      { ico: '🌞', lbl: t.quizSunMoon     || 'Sun & moon',   fn: 'startQuizSunMoon()' },
      { ico: '🅰️', lbl: t.quizAnagram     || 'Anagram',      fn: 'startAnagram()' }
    ]},
    { title: '📝 ' + (t.quizCatWords || 'Mots'), items: [
      { ico: '🧩', lbl: t.quizWords,                          fn: 'startQuizWords()' },
      { ico: '📂', lbl: t.quizCategories,                     fn: 'startQuizCategories()' },
      { ico: '💬', lbl: t.quizPhrases,                        fn: 'startQuizPhrases()' },
      { ico: '🆎', lbl: t.quizOddOneOut    || 'Odd one out',  fn: 'startQuizOddOneOut()' },
      { ico: '🧮', lbl: t.quizCounting     || 'Counting',     fn: 'startQuizCounting()' }
    ]},
    { title: '🔊 ' + (t.quizCatSound || 'Sons'), items: [
      { ico: '🎧', lbl: t.quizAudio,                          fn: 'startQuizAudio()' },
      { ico: '👂', lbl: t.quizListen      || 'Écoute',        fn: 'startQuizListen()' },
      { ico: '🗣️', lbl: t.quizSyllables   || 'Syllables',    fn: 'startQuizSyllables()' },
      { ico: '🐍', lbl: t.quizLong        || 'Long vowels',  fn: 'startQuizLong()' },
      { ico: '✨', lbl: t.quizTanwin      || 'Tanwin',       fn: 'startQuizTanwin()' }
    ]},
    { title: '📖 ' + (t.blendTitle || 'Reading'), items: [
      { ico: '🧱', lbl: t.blendTitle      || 'Guided reading', fn: 'startBlend()' }
    ]},
    { title: '🎮 ' + (t.quizCatGames || 'Jeux'), items: [
      { ico: '🔗', lbl: t.quizMatch,                          fn: 'startQuizMatch()' },
      { ico: '🎯', lbl: t.fallingLetters   || 'Falling',      fn: 'startFallingLetters()' }
    ]}
  ];
  const html = sections.map(s => `
    <div class="quizcat-title">${s.title}</div>
    <div class="quizcat-grid">${s.items.map(it => `
      <div class="menu-item ${it.premium && !AppState.premium ? 'menu-item-locked' : ''}" onclick="${it.fn}">
        <span class="menu-icon">${it.ico}</span>
        <span class="menu-lbl">${it.lbl}</span>
        ${it.premium && !AppState.premium ? '<span class="menu-lock">🔒</span>' : ''}
      </div>`).join('')}</div>`).join('');
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}
    ${secH(t, '🎯 ' + (t.quizzesAll || 'Quiz'), 'sectionBack()')}
    ${html}
  </div>`;
}

// ==================== LETTER HUNT ====================
// Show a string built from words containing the current letter; the child
// taps each occurrence. Matches on base Arabic codepoint (ignoring harakat
// and, for alif, hamza variants). When all targets are found, award +huntWins.

const _HUNT_ALIF_VARIANTS = { 'أ': 1, 'إ': 1, 'آ': 1, 'ا': 1 };

function _huntMatches(char, target) {
  if (char === target) return true;
  if (_HUNT_ALIF_VARIANTS[target] && _HUNT_ALIF_VARIANTS[char]) return true;
  return false;
}

function _huntBuildText(letter, data) {
  // Take main word + all extras + a few category words containing the letter.
  var words = [data.w];
  (data.extra || []).forEach(function (x) { if (x.ar) words.push(x.ar); });
  // Top up with category words containing the letter (bare form check).
  var bare = letter.replace(/[\u064B-\u0652\u0670]/g, '');
  Object.keys(WORD_CATEGORIES).filter(function (k) { return !WORD_CATEGORIES[k].hidden; }).some(function (k) {
    WORD_CATEGORIES[k].words.forEach(function (w) {
      if (words.length >= 6 || !w.ar) return;
      var wb = w.ar.replace(/[\u064B-\u0652\u0670]/g, '');
      if (wb.indexOf(bare) >= 0 && words.indexOf(w.ar) < 0) words.push(w.ar);
    });
    return words.length >= 6;
  });
  return words.join(' · ');
}

// Launch hunt from the dashboard (no letter selected yet). Picks a random
// letter — preferring letters the child has already seen — so the activity
// reinforces known material rather than throwing a stranger at them.
function startLetterHuntFromHome() {
  var diff = DIFFICULTY[AppState.difficulty || 'normal'];
  var pool = (AppState.learnedLetters && AppState.learnedLetters.length)
    ? ALPHABET.filter(function (a) { return AppState.learnedLetters.indexOf(a.l) >= 0; })
    : ALPHABET.slice(0, diff.letterCount);
  var picked = pool[Math.floor(Math.random() * pool.length)];
  AppState.selectedLetter = ALPHABET.indexOf(picked);
  startLetterHunt();
}

function startLetterHunt() {
  var i = AppState.selectedLetter;
  if (i == null) return;
  var d = ALPHABET[i];
  var text = _huntBuildText(d.l, d);
  // Count target occurrences in the built text for the win condition.
  var target = d.l;
  var total = 0;
  for (var k = 0; k < text.length; k++) if (_huntMatches(text[k], target)) total++;
  AppState._hunt = { target: target, text: text, total: total, found: 0, wrong: 0, taps: {} };
  navigate('letterHunt');
}

function renderLetterHunt(t) {
  var h = AppState._hunt;
  if (!h) return renderLetterDetail(t);
  var d = ALPHABET[AppState.selectedLetter];
  // Render each character as a tappable span. Harakat (combining marks) are
  // rendered but NOT tappable so they attach to the previous base char.
  var chars = '';
  for (var k = 0; k < h.text.length; k++) {
    var ch = h.text[k];
    var code = ch.charCodeAt(0);
    if (code >= 0x064B && code <= 0x0652 || code === 0x0670) {
      chars += '<span class="hunt-mark">' + ch + '</span>';
    } else if (ch === ' ' || ch === '·') {
      chars += '<span class="hunt-sep">' + ch + '</span>';
    } else {
      var state = h.taps[k];
      var cls = 'hunt-char' + (state === 'ok' ? ' hunt-ok' : state === 'bad' ? ' hunt-bad' : '');
      chars += '<span class="'+cls+'" onclick="huntTap('+k+')">' + ch + '</span>';
    }
  }
  var done = h.found >= h.total;
  return '<div class="bg-deco"></div><div class="app page-in">' + navHTML(t) +
    secH(t, '🔍 ' + (t.letterHunt || 'Chasse aux lettres'), 'sectionBack()') +
    '<p style="text-align:center;margin-bottom:6px;color:var(--text-light)">' +
      (t.huntTapAll || 'Touche toutes les occurrences de') +
      ' <span class="arabic" style="font-family:var(--font-arabic);font-size:1.8rem;color:'+d.c+';font-weight:700">' + d.l + '</span></p>' +
    '<div class="hunt-progress">' + h.found + ' / ' + h.total + '</div>' +
    '<div class="hunt-text" dir="rtl">' + chars + '</div>' +
    (done ? '<div class="hunt-done">🎉 ' + (t.wellDone||'Bravo') + ' !</div>' +
            '<button class="btn btn-primary" onclick="sectionBack()" style="margin:16px auto;display:flex">← ' + (t.back||'Retour') + '</button>'
          : '<button class="btn btn-ghost btn-sm" onclick="startLetterHunt()" style="margin:14px auto;display:flex">🔄 ' + (t.replay||'Rejouer') + '</button>') +
    '</div>';
}

function huntTap(idx) {
  var h = AppState._hunt; if (!h) return;
  if (h.taps[idx]) return; // already tapped
  var ch = h.text[idx];
  if (_huntMatches(ch, h.target)) {
    h.taps[idx] = 'ok';
    h.found++;
    AudioSystem.playSound('correct');
    if (h.found >= h.total) {
      AudioSystem.playSound('complete');
      bumpLetterStat(h.target, 'huntWins');
      addScore(10);
      showConfetti();
    }
  } else {
    h.taps[idx] = 'bad';
    h.wrong++;
    AudioSystem.playSound('wrong');
    setTimeout(function () { if (h.taps[idx] === 'bad') { delete h.taps[idx]; render(); } }, 500);
  }
  render();
}

// ==================== ONBOARDING ====================
// Slide layout:
//   0  cinematic splash — particles assemble into ا → burst → logo
//   1  interactive hook — tap ب, hear it, harakat appear + confetti
//   2  🚀 ready-to-start CTA
function renderOnboarding(t) {
  const slide = AppState._onbSlide || 0;
  if (slide === 0) return renderCinematicSplash(t);
  if (slide === 1) return renderHookSlide(t);
  const desc = t.letsStart || "C'est parti !";
  return `<div class="onboard-wrap">
    <button class="onboard-skip" onclick="finishOnboarding()">${t.skip || 'Passer'} ›</button>
    <div class="onboard-content">
      <div class="onboard-emoji">🚀</div>
      <h1 class="onboard-title">${t.onbSlide3 || 'Prêt à commencer ?'}</h1>
      <p class="onboard-desc">${desc}</p>
    </div>
    <div class="onboard-dots"><span class="onboard-dot"></span><span class="onboard-dot"></span><span class="onboard-dot active"></span></div>
    <button class="btn btn-primary onboard-cta" onclick="finishOnboarding()">
      ${t.start || 'Commencer'} →
    </button>
  </div>`;
}

// Cinematic splash — phase timeline:
//   0.0-1.2s  particles assemble toward center
//   1.2-2.0s  letter ا appears with gradient + glow
//   2.0-2.8s  letter bursts into colored stars radiating outward
//   2.4-3.6s  logo + arabic tagline fade in
//   3.0s+     bottom tagline pulse
//   4.0s      auto-advance to hook slide (interruptible via tap)
let _splashAdvanceTimer = null;
function _clearSplashAdvance() {
  if (_splashAdvanceTimer) { clearTimeout(_splashAdvanceTimer); _splashAdvanceTimer = null; }
}
function _scheduleSplashAdvance() {
  _clearSplashAdvance();
  _splashAdvanceTimer = setTimeout(() => {
    _splashAdvanceTimer = null;
    if (AppState.screen === 'onboarding' && (AppState._onbSlide || 0) === 0) {
      nextOnboardingSlide();
    }
  }, 4000);
}
function finishSplashEarly() {
  _clearSplashAdvance();
  nextOnboardingSlide();
}
function renderCinematicSplash(t) {
  _scheduleSplashAdvance();
  let particles = '';
  for (let i = 0; i < 42; i++) {
    const x = ((Math.random() - 0.5) * 80).toFixed(1);
    const y = ((Math.random() - 0.5) * 80).toFixed(1);
    const d = (Math.random() * 0.6).toFixed(2);
    particles += `<span class="sp-particle" style="--x:${x}vw;--y:${y}vh;--d:${d}s"></span>`;
  }
  let stars = '';
  for (let i = 0; i < 30; i++) {
    const angle = (i / 30) * 360 + Math.random() * 8;
    const dist = (28 + Math.random() * 22).toFixed(1);
    const hue = Math.floor(Math.random() * 360);
    stars += `<span class="sp-star" style="--angle:${angle.toFixed(1)}deg;--dist:${dist}vmin;--hue:${hue}"></span>`;
  }
  return `<div class="splash-cine" onclick="finishSplashEarly()">
    <div class="splash-particles">${particles}</div>
    <div class="splash-letter">ا</div>
    <div class="splash-burst">${stars}</div>
    <div class="splash-logo">
      <h1 class="splash-title">Arabic Kids</h1>
      <p class="splash-arabic-tagline">تَعَلَّمْ العَرَبِيَّة</p>
    </div>
    <p class="splash-bottom-tagline">${t.splashJourney || 'Le voyage commence…'} ✨</p>
  </div>`;
}

// "Show, don't tell": the hook screen replaces a marketing slide with a
// 5-second interaction. Child taps ب, hears it pronounced, sees the harakat
// materialize, gets a burst of confetti. Demonstrates the whole value of
// the app in a single tap before they've even registered.
function renderHookSlide(t) {
  const tapped = !!AppState._hookTapped;
  const dots = `<span class="onboard-dot"></span><span class="onboard-dot active"></span><span class="onboard-dot"></span>`;
  return `<div class="onboard-wrap onboard-hook">
    <button class="onboard-skip" onclick="finishOnboarding()">${t.skip || 'Passer'} ›</button>
    <div class="onboard-content">
      <p class="hook-prompt ${tapped ? 'fade-out' : ''}">
        ${t.hookPrompt || "Touche la lettre pour l'entendre"} <span class="hook-prompt-emoji">👇</span>
      </p>
      <div class="hook-stage" onclick="onHookTap()">
        <div class="hook-letter ${tapped ? 'tapped' : ''}">${tapped ? 'بَ' : 'ب'}</div>
        <div class="hook-finger ${tapped ? 'fade-out' : ''}">👆</div>
      </div>
      <p class="hook-success ${tapped ? 'show' : ''}">
        ${t.hookSuccess || "Magnifique ! Voilà comment fonctionne Arabic Kids."}
      </p>
    </div>
    <div class="onboard-dots">${dots}</div>
    <button class="btn btn-primary onboard-cta hook-cta ${tapped ? 'show' : ''}" onclick="nextOnboardingSlide()">
      ${t.next || 'Continuer'} →
    </button>
  </div>`;
}

function onHookTap() {
  if (AppState._hookTapped) return;
  AppState._hookTapped = true;
  try { AudioSystem.speakArabic('بَ'); } catch (e) {}
  showConfetti();
  render();
}

function nextOnboardingSlide() {
  _clearSplashAdvance();
  AppState._onbSlide = (AppState._onbSlide || 0) + 1;
  render();
}

function finishOnboarding() {
  _clearSplashAdvance();
  try { localStorage.setItem('ak_onboardingDone', '1'); } catch(e) {}
  AppState._onbSlide = 0;
  AppState._hookTapped = false;
  AppState.screen = 'welcome';
  render();
}

// ==================== THEME ====================
function applyTheme() {
  const dark = AppState.theme === 'dark';
  document.body.classList.toggle('theme-dark', dark);
  document.body.classList.toggle('mode-toddler', AppState.difficulty === 'toddler');
}

function toggleTheme() {
  AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('ak_theme', AppState.theme); } catch(e) {}
  if (AppState.user) AppState.save();
  applyTheme();
  render();
}

function shareAppAction() {
  const t = AppState.t;
  const url = 'https://play.google.com/store/apps/details?id=com.hsrconsulting.arabickids';
  const msg = (t.shareMessage || 'Check out Arabic Kids!') + '\n\n' + url;
  Analytics.log('share_app', { source: 'dashboard' });
  try {
    if (typeof Android !== 'undefined' && Android.shareApp) {
      Android.shareApp(msg);
      return;
    }
  } catch (e) {}
  // Browser/dev fallback: copy to clipboard
  try { navigator.clipboard?.writeText(msg); } catch (e) {}
}

// ==================== STORIES ====================
function renderStoriesList(t) {
  // Cap story difficulty by user's difficulty: toddler/beginner → lvl 1,
  // normal → 1-2, advanced → all levels (unlocks richer stories).
  const diff = AppState.difficulty || 'normal';
  const maxLevel = diff === 'advanced' ? 99 : diff === 'normal' ? 2 : 1;
  const visible = STORIES.filter(s => (s.level || 1) <= maxLevel);
  const cards = visible.map(s => `
    <div class="story-card" onclick="openStory('${s.id}')">
      <div class="story-emoji">${s.emoji}</div>
      <div class="story-title">${(s.title && s.title[AppState.lang]) || s.title.en}</div>
      ${s.interactive ? '<div class="story-badge story-badge-interactive">🔀 ' + (t.interactiveLabel || 'Interactive') + '</div>' : ''}
      ${(s.level || 1) >= 3 ? '<div class="story-badge">🔥 ' + (t.advanced || 'Advanced') + '</div>' : ''}
    </div>`).join('');
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}
    ${secH(t, '📖 ' + (t.stories || 'Stories'), 'sectionBack()')}
    <div class="story-grid">${cards}</div>
  </div>`;
}

function openStory(id) {
  AppState.selectedStory = id;
  AppState._storyNode = 'start'; // reset interactive position when (re)entering
  navigate('story');
}

function renderStory(t) {
  const s = STORIES.find(x => x.id === AppState.selectedStory);
  if (!s) return renderStoriesList(t);
  if (s.interactive) return renderInteractiveStory(t, s);
  const body = s.lines.map(l => `<p class="story-line" data-speak="${l}">${l}</p>`).join('');
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}
    ${secH(t, s.emoji + ' ' + ((s.title && s.title[AppState.lang]) || s.title.en), 'sectionBack()')}
    <div class="story-body" dir="rtl">${body}</div>
    <button class="btn btn-secondary btn-sm" data-speak="${s.lines.join(' ')}" style="margin:10px auto;display:flex">🔊 ${t.listen}</button>
    <button class="btn btn-primary" onclick="startStoryQuiz()" style="margin:16px auto 0;display:flex">${t.comprehension || 'Questions'} →</button>
  </div></div>`;
}

// Branching story renderer. Reads AppState._storyNode (default 'start') and
// shows the current node's Arabic line + translation, then either choice
// buttons (advance with _storyChoose) or an ending screen (restart only).
function renderInteractiveStory(t, s) {
  const nodeId = AppState._storyNode || 'start';
  const node = (s.nodes && s.nodes[nodeId]) || s.nodes.start;
  const tr = (node.tr && node.tr[AppState.lang]) || (node.tr && node.tr.en) || '';
  let choiceHtml = '';
  if (node.choice) {
    const q = (node.choice.q && node.choice.q[AppState.lang]) || (node.choice.q && node.choice.q.en) || '';
    const opts = node.choice.options.map(o => {
      const lbl = (o.label && o.label[AppState.lang]) || (o.label && o.label.en) || '';
      const safeNext = (o.next||'').replace(/'/g,"\\'");
      return `<button class="qopt" style="flex-direction:column;padding:14px 10px;display:flex;align-items:center;gap:4px" onclick="_storyChoose('${safeNext}')">
        <span style="font-size:2rem;line-height:1">${o.emoji||'•'}</span>
        <span style="font-size:0.95rem">${lbl}</span>
      </button>`;
    }).join('');
    choiceHtml = `
      <p style="color:var(--text-light);text-align:center;margin:18px 0 10px;font-weight:600">${q}</p>
      <div class="qoptions" style="grid-template-columns:repeat(2,1fr);display:grid;gap:10px">${opts}</div>`;
  } else if (node.ending) {
    choiceHtml = `
      <div style="text-align:center;margin-top:24px">
        <div style="font-size:2.6rem">🎉</div>
        <h3 style="margin:6px 0 14px">${t.theEnd || 'The end!'}</h3>
        <button class="btn btn-primary" onclick="_restartInteractiveStory()">🔁 ${t.restartStory || 'Restart'}</button>
      </div>`;
  }
  // Auto-speak the current node's line shortly after paint (let DOM settle).
  setTimeout(() => { try { AudioSystem.speakArabic(node.ar); } catch(e) {} }, 400);
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t, s.emoji + ' ' + ((s.title && s.title[AppState.lang]) || s.title.en), 'sectionBack()')}
    <p class="story-line" dir="rtl" style="font-size:1.5rem;text-align:center;font-family:var(--font-arabic);margin:14px 0">${node.ar}</p>
    <p style="color:var(--text-light);text-align:center;font-style:italic;font-size:0.95rem">${tr}</p>
    <div style="text-align:center;margin:8px 0"><button class="btn btn-secondary btn-sm" onclick="AudioSystem.speakArabic('${(node.ar||'').replace(/'/g,"\\'")}')">🔊 ${t.listen}</button></div>
    ${choiceHtml}
  </div></div>`;
}

function _storyChoose(nextId) {
  AppState._storyNode = nextId;
  AudioSystem.playSound('click');
  render();
}
function _restartInteractiveStory() {
  AppState._storyNode = 'start';
  AudioSystem.playSound('click');
  render();
}

function startStoryQuiz() {
  const s = STORIES.find(x => x.id === AppState.selectedStory);
  if (!s || !s.questions || !s.questions.length) return;
  const diff = DIFFICULTY[AppState.difficulty || 'normal'];
  AppState.quizData = {
    type: 'story', pts: diff.pts,
    storyId: s.id,
    questions: s.questions.map(q => ({
      prompt: (q.q && q.q[AppState.lang]) || q.q.en,
      options: shuffle(q.options.map(o => ({ label: o.ar, emoji: o.emoji, correct: !!o.correct })))
    })),
    current: 0, selected: null, results: [], done: false
  };
  navigate('storyQuiz');
}

function renderStoryQuiz(t) {
  const qd = AppState.quizData; if (!qd) return renderDashboard(t);
  if (qd.done) return renderQuizResults(t);
  const q = qd.questions[qd.current];
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t, '📖 ' + (t.comprehension || 'Questions'), 'sectionBack()')}
    <div class="quiz-dots">${qd.questions.map((_, i) => `<div class="qdot ${i === qd.current ? 'active' : i < qd.current ? (qd.results[i] ? 'done' : 'wrong') : ''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${qd.current + 1} ${t.of} ${qd.questions.length}</p>
    <div class="qprompt" style="font-size:1.2rem">${q.prompt}</div>
    <div class="qoptions">${q.options.map((o, i) => `<button class="qopt ${_optCls(qd,o,i)}" onclick="quizAnswer(${i})"><span style="font-size:2rem;display:block">${o.emoji}</span><span class="arabic" style="font-family:var(--font-arabic);font-size:1.25rem">${o.label}</span></button>`).join('')}</div>
    ${qd.selected !== null ? `<div class="qfeedback ${q.options[qd.selected].correct ? 'correct' : 'incorrect'}">${q.options[qd.selected].correct ? t.correct : t.incorrect}</div>` : ''}
  </div></div>`;
}

// ==================== QUIZ LISTEN & CHOOSE ====================
// Variant of quizAudio where options are emoji-only (easier for pre-readers).
// The child hears an Arabic word and picks the matching picture.
// First-letter quiz: show emoji + audio + Arabic word, child taps the
// letter the word starts with (among 4 options). Strips harakat from the
// first character and normalizes alif variants to match ALPHABET keys.
function _firstBaseLetter(ar) {
  if (!ar) return '';
  const stripped = ar.replace(/[ً-ْٰ]/g, '');
  if (!stripped) return '';
  let c = stripped.charAt(0);
  if ('أإآا'.includes(c)) c = 'أ';
  return c;
}

function startQuizFirstLetter() {
  const diff = DIFFICULTY[AppState.difficulty || 'normal'];
  const pool = (diff.catKeys ? diff.catKeys.flatMap(k => WORD_CATEGORIES[k].words) : getAllWords())
    .filter(w => w && w.emoji && w.ar);
  const candidates = [];
  pool.forEach(w => {
    const first = _firstBaseLetter(w.ar);
    if (first && ALPHABET.some(a => a.l === first)) {
      candidates.push({ ar: w.ar, emoji: w.emoji, first: first });
    }
  });
  if (!candidates.length) { startQuizLetters(); return; }
  const picked = shuffle(candidates).slice(0, diff.questionCount);
  AppState.quizData = {
    type: 'firstLetter', pts: diff.pts,
    questions: picked.map(w => {
      const distractors = shuffle(ALPHABET.filter(a => a.l !== w.first)).slice(0, diff.options - 1);
      return {
        arabic: w.ar, emoji: w.emoji,
        options: shuffle([
          { letter: w.first, correct: true },
          ...distractors.map(d => ({ letter: d.l, correct: false }))
        ])
      };
    }),
    current: 0, selected: null, results: [], done: false
  };
  Analytics.quizStart('firstLetter', AppState.difficulty);
  navigate('quizFirstLetter');
  setTimeout(() => AudioSystem.speakArabic(AppState.quizData.questions[0].arabic), 500);
}

function renderQuizFirstLetter(t) {
  const qd = AppState.quizData; if (!qd) return renderDashboard(t);
  if (qd.done) return renderQuizResults(t);
  const q = qd.questions[qd.current];
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t, '🔡 ' + (t.quizFirstLetter || 'First letter'), 'sectionBack()')}
    <div class="quiz-dots">${qd.questions.map((_, i) => `<div class="qdot ${i === qd.current ? 'active' : i < qd.current ? (qd.results[i] ? 'done' : 'wrong') : ''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${qd.current + 1} ${t.of} ${qd.questions.length}</p>
    <p style="color:var(--text-light);margin-bottom:6px">${t.tapFirstLetter || 'Which letter does this word start with?'}</p>
    <div style="text-align:center;margin:10px 0 6px">
      <div style="font-size:5rem;line-height:1">${q.emoji}</div>
      <div class="arabic" data-speak="${q.arabic}" style="font-size:2.2rem;font-weight:700;margin-top:8px;cursor:pointer">${q.arabic}</div>
    </div>
    <button class="btn btn-secondary btn-sm" data-speak="${q.arabic}" style="margin:0 auto 16px;display:flex">🔊 ${t.listen}</button>
    <div class="qoptions">${q.options.map((o, i) => `<button class="qopt ${_optCls(qd,o,i)}" style="font-family:var(--font-arabic);font-size:2.2rem;font-weight:600;padding:18px" onclick="quizAnswer(${i})">${o.letter}</button>`).join('')}</div>
    ${qd.selected !== null ? `<div class="qfeedback ${q.options[qd.selected].correct ? 'correct' : 'incorrect'}">${q.options[qd.selected].correct ? t.correct : t.incorrect}</div>` : ''}
  </div></div>`;
}

function startQuizListen() {
  const diff = DIFFICULTY[AppState.difficulty || 'normal'];
  const all = (diff.catKeys ? diff.catKeys.flatMap(k => WORD_CATEGORIES[k].words) : getAllWords())
    .filter(w => w && w.emoji);
  const picked = shuffle(all).slice(0, diff.questionCount);
  AppState.quizData = {
    type: 'listen', pts: diff.pts,
    questions: picked.map(w => {
      // Dedupe distractor candidates by emoji so two options never share the
      // same picture — and exclude any candidate sharing the correct emoji.
      const seen = new Set([w.emoji]);
      const others = [];
      for (const c of shuffle(all.filter(x => x.ar !== w.ar))) {
        if (seen.has(c.emoji)) continue;
        seen.add(c.emoji); others.push(c);
        if (others.length >= diff.options - 1) break;
      }
      return {
        arabic: w.ar, emoji: w.emoji,
        options: shuffle([{ emoji: w.emoji, correct: true }, ...others.map(o => ({ emoji: o.emoji, correct: false }))])
      };
    }),
    current: 0, selected: null, results: [], done: false
  };
  navigate('quizListen');
  setTimeout(() => AudioSystem.speakArabic(AppState.quizData.questions[0].arabic), 500);
}

function renderQuizListen(t) {
  const qd = AppState.quizData; if (!qd) return renderDashboard(t);
  if (qd.done) return renderQuizResults(t);
  const q = qd.questions[qd.current];
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t, '👂 ' + (t.quizListen || 'Listen & choose'), 'sectionBack()')}
    <div class="quiz-dots">${qd.questions.map((_, i) => `<div class="qdot ${i === qd.current ? 'active' : i < qd.current ? (qd.results[i] ? 'done' : 'wrong') : ''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${qd.current + 1} ${t.of} ${qd.questions.length}</p>
    <p style="color:var(--text-light);margin-bottom:4px">${t.tapToHear || 'Tap 🔊 to hear'}</p>
    <div class="quiz-audio-icon" data-speak="${q.arabic}" style="font-size:3rem;text-align:center;margin:12px 0;cursor:pointer">🔊</div>
    <button class="btn btn-secondary btn-sm" data-speak="${q.arabic}" style="margin:0 auto 16px;display:flex">🔊 ${t.listen}</button>
    <div class="qoptions qoptions-emoji">${q.options.map((o, i) => `<button class="qopt ${_optCls(qd,o,i)}" style="font-size:3rem;padding:20px" onclick="quizAnswer(${i})">${o.emoji}</button>`).join('')}</div>
    ${qd.selected !== null ? `<div class="qfeedback ${q.options[qd.selected].correct ? 'correct' : 'incorrect'}">${q.options[qd.selected].correct ? t.correct : t.incorrect}</div>` : ''}
  </div></div>`;
}

// ==================== LEARNING PATH ====================
function isPathStepDone(step) {
  if (!step) return false;
  if (step.type === 'letter')   return (AppState.learnedLetters || []).includes(step.target);
  if (step.type === 'category') return (AppState.visitedCategories || []).includes(step.target);
  if (step.type === 'quiz')     return (AppState.quizzes || 0) >= step.target;
  if (step.type === 'skill')    return (AppState.skillsDone || []).includes(step.target);
  return false;
}

// A skill step left behind by a child who already progressed past it (skill
// steps were added after launch, and letters can be learned out of order) is a
// "catch-up": shown and playable, but it never blocks or pulls the child back.
function isPathCatchUp(i) {
  const step = LEARNING_PATH[i];
  if (step.type !== 'skill' || isPathStepDone(step)) return false;
  for (let j = i + 1; j < LEARNING_PATH.length; j++) if (isPathStepDone(LEARNING_PATH[j])) return true;
  return false;
}

function currentPathIndex() {
  for (let i = 0; i < LEARNING_PATH.length; i++) {
    if (!isPathStepDone(LEARNING_PATH[i]) && !isPathCatchUp(i)) return i;
  }
  return LEARNING_PATH.length;
}

function pathStepLabel(step, t) {
  if (step.type === 'letter')   return `${t.stepLearn || 'Learn'} <span class="arabic" style="font-family:var(--font-arabic);font-size:1.4rem">${step.target}</span>`;
  if (step.type === 'category') return `${t.stepExplore || 'Explore'} ${WORD_CATEGORIES[step.target]?.emoji||''} ${t[step.target] || step.target}`;
  if (step.type === 'quiz')     return `${t.stepPassQuiz || 'Pass'} ${step.target} ${t.quizzesPassed || 'quiz'}`;
  if (step.type === 'skill')    { const sk = SKILLS[step.target]; return `${t.stepPractice || 'Practice'} ${sk.icon} ${t[sk.title] || step.target}`; }
  return step.id;
}

function renderPath(t) {
  const current = currentPathIndex();
  const total = LEARNING_PATH.length;
  const doneCount = LEARNING_PATH.filter(isPathStepDone).length;
  const pct = Math.round((doneCount / total) * 100);
  if (doneCount === total && !AppState._pathCompletedShown) {
    AppState._pathCompletedShown = true; AppState.save();
    setTimeout(() => showBigConfetti(), 400);
  }
  const items = LEARNING_PATH.map((step, i) => {
    const catchUp = i < current && isPathCatchUp(i);
    const done = i < current && !catchUp;
    const isCurrent = i === current;
    const locked = i > current;
    const icon = catchUp ? '⭐' : done ? '✅' : isCurrent ? '🟢' : '🔒';
    const cls = catchUp ? 'path-catchup' : done ? 'path-done' : isCurrent ? 'path-current' : 'path-locked';
    const onclick = locked ? '' : `onclick="goToPathStep('${step.id}')"`;
    return `<div class="path-item ${cls}" ${onclick}>
      <span class="path-icon">${icon}</span>
      <span class="path-label">${pathStepLabel(step, t)}${catchUp ? ` <small class="path-catchup-tag">${t.catchUp || 'To catch up'}</small>` : ''}</span>
    </div>`;
  }).join('');
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}
    ${secH(t, '🗺️ ' + (t.learningPath || 'Path'), 'goHome()')}
    <div class="prog-container"><div class="prog-label"><span>${t.progress}</span><span>${pct}%</span></div><div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div></div>
    <div class="path-list">${items}</div>
  </div>`;
}

function goToPathStep(id) {
  const step = LEARNING_PATH.find(s => s.id === id);
  if (!step) return;
  AudioSystem.playSound('click');
  AppState._pathOrigin = true;
  if (step.type === 'letter') {
    const idx = ALPHABET.findIndex(l => l.l === step.target);
    if (idx >= 0) {
      AppState.selectedLetter = idx;
      navigate('letterDetail');
    }
  } else if (step.type === 'category') {
    openCategory(step.target);
  } else if (step.type === 'skill') {
    window[SKILLS[step.target].start]();
  } else if (step.type === 'quiz') {
    const learned = AppState.learnedLetters || [];
    const pool = ALPHABET.filter(l => learned.includes(l.l));
    startQuizLetters(pool);
  }
}

// ==================== WORDS ====================
function renderWords(t) {
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}${secH(t,'📝 '+t.words,'sectionBack()')}
    <div class="cat-grid">${Object.entries(WORD_CATEGORIES).filter(([,v])=>!v.hidden).map(([k,v])=>`<div class="cat-card" onclick="openCategory('${k}')"><div class="cat-emoji">${v.emoji}</div><div class="cat-name">${t[k]}</div></div>`).join('')}</div></div>`;
}

function openCategory(k) {
  AppState.selectedCategory=k;
  if(!AppState.visitedCategories)AppState.visitedCategories=[];
  if(!AppState.visitedCategories.includes(k)){AppState.visitedCategories.push(k);AppState.save();}
  if(AppState.visitedCategories.length>=5)awardBadge('polyglot');
  addLesson(); dailyAutoCheck(); navigate('wordList');
}

function _esc(s) { return s.replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

function renderWordList(t) {
  const k=AppState.selectedCategory, cat=WORD_CATEGORIES[k];
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}${secH(t,cat.emoji+' '+t[k],"sectionBack()")}
    <div class="word-grid" id="wordGrid">${cat.words.map((w,i)=>`<div class="wcard" data-idx="${i}"><div class="wemoji">${w.emoji}</div><div class="war">${w.ar}</div><div class="wphon">${transliterate(w.ar)}</div><div class="wtr">${w[AppState.lang]}</div><button class="listen-btn" data-idx="${i}">🔊 ${t.listen}</button></div>`).join('')}</div></div>`;
}

// Append tanwīn ḍamm (ـٌ) to a single Arabic word for TTS, so the word is read
// as the standard nominative indefinite ("kalamun" instead of bare "kalam").
// - skip multi-word strings (no iḍāfa heuristic) and digits-formatted entries
// - skip if already ends with any tanwīn (ـً ـٌ ـٍ) or sukun
// - skip if last char isn't an Arabic letter / hamza / tāʾ marbūṭa
function _withTanwinDhamm(text) {
  if (!text) return text;
  // Strip Arabic-Indic digits + trailing space first (numbers like "وَاحِد ١").
  var t = text.replace(/[\u0660-\u0669\u06F0-\u06F9\d]/g, '').replace(/\s+$/, '');
  if (!t || t.indexOf(' ') >= 0) return text; // multi-word → leave as-is
  var last = t.charCodeAt(t.length - 1);
  // Already vocalized at the end (any tanwīn or sukun) → leave it
  if (last === 0x064B || last === 0x064C || last === 0x064D || last === 0x0652) return t;
  // Last must be a base Arabic letter/hamza/tāʾ marbūṭa to take tanwīn.
  var isArabicLetter = (last >= 0x0621 && last <= 0x064A) || last === 0x0670;
  if (!isArabicLetter) return t;
  return t + '\u064C'; // tanwīn ḍamm
}

// Global event delegation — avoids inline onclick with Arabic text (broken on some WebViews)
document.addEventListener('click', function(e) {
  // Any element with data-speak attribute → speak that text
  const speakEl = e.target.closest('[data-speak]');
  if (speakEl) {
    e.stopPropagation();
    AudioSystem.speakArabic(speakEl.dataset.speak);
    return;
  }
  // Listen button or word card with data-idx
  const btn = e.target.closest('.listen-btn[data-idx]');
  const card = !btn ? e.target.closest('.wcard[data-idx]') : null;
  const el = btn || card;
  if (el) {
    e.stopPropagation();
    const idx = parseInt(el.dataset.idx);
    const cat = WORD_CATEGORIES[AppState.selectedCategory];
    if (cat && cat.words[idx]) {
      AudioSystem.speakArabic(_withTanwinDhamm(cat.words[idx].ar));
    }
    return;
  }
});

// ==================== QUIZ LETTERS ====================
function startQuizLetters(poolOverride) {
  const diff=DIFFICULTY[AppState.difficulty||'normal'];
  let pool = (Array.isArray(poolOverride) && poolOverride.length)
    ? poolOverride.slice()
    : _practiceLetters(diff.options);
  // Guarantee enough letters for option distractors.
  if (pool.length < diff.options) {
    const extras = ALPHABET.filter(l => !pool.includes(l));
    while (pool.length < diff.options && extras.length) pool.push(extras.shift());
  }
  const count=Math.min(diff.questionCount,pool.length);
  const indices=shuffle(Array.from({length:pool.length},(_,i)=>i)).slice(0,count);
  const reversed=AppState.difficulty==='advanced'; // advanced: show name → pick letter
  AppState.quizData={type:'letters',pts:diff.pts,reversed,questions:indices.map(idx=>{
    const correct=pool[idx];
    const others=shuffle(pool.filter((_,i)=>i!==idx)).slice(0,diff.options-1);
    if(reversed){
      return {letter:correct.l,name:correct.n,options:shuffle([{label:correct.l,correct:true},...others.map(o=>({label:o.l,correct:false}))])};
    }
    return {letter:correct.l,name:correct.n,options:shuffle([{label:correct.n,correct:true},...others.map(o=>({label:o.n,correct:false}))])};
  }),current:0,selected:null,results:[],done:false};
  navigate('quizL');
}

function renderQuizLetters(t) {
  const qd=AppState.quizData; if(!qd)return renderDashboard(t);
  if(qd.done)return renderQuizResults(t);
  const q=qd.questions[qd.current];
  const rev=qd.reversed;
  const promptHTML=rev
    ?`<div class="qprompt" style="font-size:2rem;font-family:inherit;letter-spacing:1px">${q.name}</div>`
    :`<div class="qprompt" data-speak="${q.letter}">${q.letter}</div>`;
  const listenBtn=rev?'':`<button class="btn btn-secondary btn-sm" data-speak="${q.letter}" style="margin:0 auto 12px;display:flex">🔊 ${t.listen}</button>`;
  const optStyle=rev?'style="font-family:var(--font-arabic);font-size:1.9rem"':'';
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t,'🎯 '+t.quizLetters,'sectionBack()')}
    <div class="quiz-dots">${qd.questions.map((_,i)=>`<div class="qdot ${i===qd.current?'active':i<qd.current?(qd.results[i]?'done':'wrong'):''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${qd.current+1} ${t.of} ${qd.questions.length} ${getDiffBadge(AppState.difficulty,t)}</p>
    <p style="color:var(--light);margin-bottom:4px">${t.selectAnswer}</p>
    ${promptHTML}
    ${listenBtn}
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${_optCls(qd,o,i)}" ${optStyle} onclick="quizAnswer(${i})">${o.label}</button>`).join('')}</div>
    ${qd.selected!==null?`<div class="qfeedback ${q.options[qd.selected].correct?'correct':'incorrect'}">${q.options[qd.selected].correct?t.correct:t.incorrect}</div>`:''}
  </div></div>`;
}

// ==================== QUIZ WORDS ====================
function startQuizWords() {
  const diff=DIFFICULTY[AppState.difficulty||'normal'];
  const all=diff.catKeys?diff.catKeys.flatMap(k=>WORD_CATEGORIES[k].words):getAllWords();
  const picked=shuffle(all).slice(0,diff.questionCount);
  const hideEmoji=true; // text-only prompts and options across all difficulties
  AppState.quizData={type:'words',pts:diff.pts,hideEmoji,questions:picked.map(w=>{
    const others=shuffle(all.filter(x=>x.ar!==w.ar)).slice(0,diff.options-1);
    return {arabic:w.ar,emoji:w.emoji,options:shuffle([{label:w[AppState.lang],emoji:w.emoji,correct:true},...others.map(o=>({label:o[AppState.lang],emoji:o.emoji,correct:false}))])};
  }),current:0,selected:null,results:[],done:false};
  navigate('quizW');
}

function renderQuizWords(t) {
  const qd=AppState.quizData; if(!qd)return renderDashboard(t);
  if(qd.done)return renderQuizResults(t);
  const q=qd.questions[qd.current];
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t,'🧩 '+t.quizWords,'sectionBack()')}
    <div class="quiz-dots">${qd.questions.map((_,i)=>`<div class="qdot ${i===qd.current?'active':i<qd.current?(qd.results[i]?'done':'wrong'):''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${qd.current+1} ${t.of} ${qd.questions.length} ${getDiffBadge(AppState.difficulty,t)}</p>
    <p style="color:var(--light);margin-bottom:4px">${t.matchImage}</p>
    <div class="qprompt" data-speak="${q.arabic}">${qd.hideEmoji?'':q.emoji+' '}${q.arabic}</div>
    <button class="btn btn-secondary btn-sm" data-speak="${q.arabic}" style="margin:0 auto 12px;display:flex">🔊 ${t.listen}</button>
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${_optCls(qd,o,i)}" onclick="quizAnswer(${i})">${qd.hideEmoji?'':o.emoji+' '}${o.label}</button>`).join('')}</div>
    ${qd.selected!==null?`<div class="qfeedback ${q.options[qd.selected].correct?'correct':'incorrect'}">${q.options[qd.selected].correct?t.correct:t.incorrect}</div>`:''}
  </div></div>`;
}

function quizAnswer(i) {
  const qd=AppState.quizData; if(qd.selected!==null)return;
  qd.selected=i; const q=qd.questions[qd.current]; const ok=q.options[i].correct;
  if(ok){AudioSystem.playSound('correct');addScore(qd.pts||10);}
  else{
    AudioSystem.playSound('wrong');
    // Corrective feedback: the right option is revealed (_optCls) and the
    // prompt is replayed so the child pairs the sound with the right answer.
    const say=q.speak||q.arabic||q.letter;
    if(say)setTimeout(()=>AudioSystem.speakArabic(say),600);
  }
  _reviewRecord(_reviewKey(qd,q),ok);
  qd.results.push(ok); render();
  setTimeout(()=>{
    if(qd.current<qd.questions.length-1){
      qd.current++;qd.selected=null;render();
      if(qd.type==='audio')setTimeout(()=>AudioSystem.speakArabic(qd.questions[qd.current].arabic),400);
      if(qd.type==='harakat'||qd.autoSpeak)setTimeout(()=>AudioSystem.speakArabic(qd.questions[qd.current].speak),400);
    }
    else{qd.done=true;_markSkillDone(qd);addQuiz();if(qd.results.every(r=>r))awardBadge('perfectQuiz');if(qd.type==='oddOneOut')awardBadge('first_intruder');if(qd.type==='counting')awardBadge('first_counting');showConfetti();render();}
  },ok?1200:2600);
}

function renderQuizResults(t) {
  const qd=AppState.quizData; if(!qd)return renderDashboard(t);
  const total=qd.questions?qd.questions.length:(qd.totalPairs||8);
  const correct=qd.results.filter(r=>r).length;
  const pct=Math.round((correct/total)*100);
  const msg=pct===100?t.perfect:pct>=75?t.great:pct>=50?t.good:t.keepGoing;
  const icons={letters:'🎯',words:'🧩',forms:'✍️',audio:'🎧',categories:'📂',phrases:'💬',match:'🔗',harakat:'◌َ',positions:'📍',story:'📖',listen:'👂',oddOneOut:'🆎',counting:'🧮',anagram:'🅰️',fallingLetters:'🎯',firstLetter:'🔡',syllables:'🗣️',twins:'👯',review:'🔁',long:'🐍',tanwin:'✨',sunmoon:'🌞',blend:'🧱'};
  const icon=icons[qd.type]||'🎯';
  const replays={letters:'startQuizLetters()',words:'startQuizWords()',forms:'startQuizForms()',audio:'startQuizAudio()',categories:'startQuizCategories()',phrases:'startQuizPhrases()',match:'startQuizMatch()',harakat:'startQuizHarakat()',positions:'startQuizPositions()',story:'startStoryQuiz()',listen:'startQuizListen()',firstLetter:'startQuizFirstLetter()',oddOneOut:'startQuizOddOneOut()',counting:'startQuizCounting()',anagram:'startAnagram()',fallingLetters:'startFallingLetters()',syllables:'startQuizSyllables()',twins:'startQuizTwins()',review:'startReview()',long:'startQuizLong()',tanwin:'startQuizTanwin()',sunmoon:'startQuizSunMoon()',blend:'startBlend()'};
  const replay=replays[qd.type]||'goHome()';
  const pts=qd.pts||10;
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t,icon+' '+t.results,'sectionBack()')}
    <div class="results"><div class="results-score">${correct}/${total}</div><div class="results-msg">${msg}</div>
    <p style="color:var(--light);margin-bottom:6px">+${correct*pts} ${t.points}</p>
    <div style="margin-bottom:16px">${getDiffBadge(AppState.difficulty,t)}</div>
    <div style="display:flex;gap:10px;justify-content:center">
      <button class="btn btn-ghost" onclick="goHome()">🏠 ${t.home}</button>
      <button class="btn btn-primary" onclick="${replay}">🔄 ${t.replay}</button>
    </div></div>
  </div></div>`;
}

// ==================== QUIZ FORMS ====================
function startQuizForms() {
  const diff=DIFFICULTY[AppState.difficulty||'normal'];
  const pool=ALPHABET.slice(0,diff.letterCount);
  const withForms=pool.filter(a=>a.forms);
  const picked=shuffle(withForms).slice(0,diff.questionCount);
  const formNames=['isolated','initial','medial','final'];
  AppState.quizData={type:'forms',questions:picked.map(letter=>{
    const available=formNames.filter(fn=>letter.forms[fn]);
    const targetForm=available[Math.floor(Math.random()*available.length)];
    const correctChar=letter.forms[targetForm].f;
    const otherChars=shuffle(withForms.filter(a=>a.l!==letter.l)).slice(0,diff.options-1).map(a=>{
      const af=formNames.filter(fn=>a.forms[fn]);
      const rf=af[Math.floor(Math.random()*af.length)];
      return a.forms[rf].f;
    });
    return {letter:letter.l,formName:targetForm,options:shuffle([{label:correctChar,correct:true},...otherChars.map(c=>({label:c,correct:false}))])};
  }),pts:diff.pts,current:0,selected:null,results:[],done:false};
  navigate('quizForms');
}

function renderQuizForms(t) {
  const qd=AppState.quizData; if(!qd)return renderDashboard(t);
  if(qd.done)return renderQuizResults(t);
  const q=qd.questions[qd.current];
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t,'✍️ '+t.quizForms,'sectionBack()')}
    <div class="quiz-dots">${qd.questions.map((_,i)=>`<div class="qdot ${i===qd.current?'active':i<qd.current?(qd.results[i]?'done':'wrong'):''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${qd.current+1} ${t.of} ${qd.questions.length}</p>
    <p style="color:var(--text-light);margin-bottom:4px">${t.selectForm}</p>
    <div class="qprompt" data-speak="${q.letter}">${q.letter}</div>
    <p style="font-weight:700;font-size:1.1rem;color:var(--purple);margin-bottom:12px">${t[q.formName]}</p>
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${_optCls(qd,o,i)}" style="font-family:var(--font-arabic);font-size:1.8rem" onclick="quizAnswer(${i})">${o.label}</button>`).join('')}</div>
    ${qd.selected!==null?`<div class="qfeedback ${q.options[qd.selected].correct?'correct':'incorrect'}">${q.options[qd.selected].correct?t.correct:t.incorrect}</div>`:''}
  </div></div>`;
}

// ==================== QUIZ POSITIONS ====================
// For a given letter, show its 4 positional forms (isolated / initial /
// medial / final) and ask the child to pick the one matching a target
// position. Distractors are the OTHER positions of the SAME letter —
// unlike quizForms which uses different letters as distractors.
function startQuizPositions() {
  const diff = DIFFICULTY[AppState.difficulty || 'normal'];
  const formNames = ['isolated', 'initial', 'medial', 'final'];
  // Non-connector letters (د ذ ر ز و ا) repeat the same glyph across two
  // positions — we build a per-letter list of positions with a UNIQUE glyph
  // to avoid showing two visually identical options with different "correct"
  // labels. A letter is usable only if it has at least 2 distinct glyphs.
  function distinctPositions(letter) {
    const seen = new Set();
    return formNames.filter(n => {
      const fm = letter.forms && letter.forms[n];
      if (!fm || seen.has(fm.f)) return false;
      seen.add(fm.f);
      return true;
    });
  }
  const pool = _practiceLetters(3).filter(a => a.forms);
  const rich = pool.filter(a => distinctPositions(a).length >= 2);
  if (!rich.length) { startQuizForms(); return; }
  const picked = shuffle(rich).slice(0, diff.questionCount);
  AppState.quizData = {
    type: 'positions', pts: diff.pts,
    questions: picked.map(letter => {
      const avail = distinctPositions(letter);
      const targetForm = avail[Math.floor(Math.random() * avail.length)];
      const options = avail.map(n => ({ label: letter.forms[n].f, correct: n === targetForm }));
      return { letter: letter.l, letterName: letter.n, formName: targetForm, options: shuffle(options) };
    }),
    current: 0, selected: null, results: [], done: false
  };
  navigate('quizPositions');
}

function renderQuizPositions(t) {
  const qd = AppState.quizData; if (!qd) return renderDashboard(t);
  if (qd.done) return renderQuizResults(t);
  const q = qd.questions[qd.current];
  const posLabel = t[q.formName] || q.formName;
  const prompt = (t.selectPosition || 'Find the {pos} form of {letter}')
    .replace('{pos}', '<strong>' + posLabel + '</strong>')
    .replace('{letter}', '<span class="arabic" style="font-family:var(--font-arabic);font-size:1.6rem">' + q.letter + '</span>');
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t, '📍 ' + (t.quizPositions || 'Positions'), 'sectionBack()')}
    <div class="quiz-dots">${qd.questions.map((_, i) => `<div class="qdot ${i === qd.current ? 'active' : i < qd.current ? (qd.results[i] ? 'done' : 'wrong') : ''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${qd.current + 1} ${t.of} ${qd.questions.length}</p>
    <div class="qprompt" style="font-size:1.15rem;line-height:1.5">${prompt}</div>
    <div class="qoptions">${q.options.map((o, i) => `<button class="qopt ${_optCls(qd,o,i)}" style="font-family:var(--font-arabic);font-size:2.3rem" onclick="quizAnswer(${i})">${o.label}</button>`).join('')}</div>
    ${qd.selected !== null ? `<div class="qfeedback ${q.options[qd.selected].correct ? 'correct' : 'incorrect'}">${q.options[qd.selected].correct ? t.correct : t.incorrect}</div>` : ''}
  </div></div>`;
}

// ==================== QUIZ AUDIO ====================
function startQuizAudio() {
  const diff=DIFFICULTY[AppState.difficulty||'normal'];
  const all=diff.catKeys?diff.catKeys.flatMap(k=>WORD_CATEGORIES[k].words):getAllWords();
  const picked=shuffle(all).slice(0,diff.questionCount);
  AppState.quizData={type:'audio',questions:picked.map(w=>{
    const others=shuffle(all.filter(x=>x.ar!==w.ar)).slice(0,diff.options-1);
    return {arabic:w.ar,emoji:w.emoji,options:shuffle([{label:w.ar,correct:true},...others.map(o=>({label:o.ar,correct:false}))])};
  }),pts:diff.pts,current:0,selected:null,results:[],done:false};
  navigate('quizAudio');
  setTimeout(()=>AudioSystem.speakArabic(AppState.quizData.questions[0].arabic),500);
}

function renderQuizAudio(t) {
  const qd=AppState.quizData; if(!qd)return renderDashboard(t);
  if(qd.done)return renderQuizResults(t);
  const q=qd.questions[qd.current];
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t,'🎧 '+t.quizAudio,'sectionBack()')}
    <div class="quiz-dots">${qd.questions.map((_,i)=>`<div class="qdot ${i===qd.current?'active':i<qd.current?(qd.results[i]?'done':'wrong'):''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${qd.current+1} ${t.of} ${qd.questions.length}</p>
    <p style="color:var(--text-light);margin-bottom:4px">${t.listenAndChoose}</p>
    <div class="quiz-audio-icon" data-speak="${q.arabic}">🔊</div>
    <button class="btn btn-secondary btn-sm" data-speak="${q.arabic}" style="margin:0 auto 12px;display:flex">🔊 ${t.listen}</button>
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${_optCls(qd,o,i)}" style="font-family:var(--font-arabic);font-size:1.4rem" onclick="quizAnswer(${i})">${o.label}</button>`).join('')}</div>
    ${qd.selected!==null?`<div class="qfeedback ${q.options[qd.selected].correct?'correct':'incorrect'}">${q.options[qd.selected].correct?t.correct:t.incorrect}</div>`:''}
  </div></div>`;
}

// ==================== QUIZ CATEGORIES ====================
function startQuizCategories() {
  const diff=DIFFICULTY[AppState.difficulty||'normal'];
  const catKeys=diff.catKeys||Object.keys(WORD_CATEGORIES).filter(k=>!WORD_CATEGORIES[k].hidden);
  const all=diff.catKeys?diff.catKeys.flatMap(k=>WORD_CATEGORIES[k].words):getAllWords();
  const picked=shuffle(all).slice(0,diff.questionCount);
  AppState.quizData={type:'categories',questions:picked.map(w=>{
    const correctCat=catKeys.find(k=>WORD_CATEGORIES[k].words.some(x=>x.ar===w.ar));
    const otherCats=shuffle(catKeys.filter(k=>k!==correctCat)).slice(0,diff.options-1);
    return {arabic:w.ar,emoji:w.emoji,correctCat:correctCat,options:shuffle([{label:correctCat,correct:true},...otherCats.map(c=>({label:c,correct:false}))])};
  }),pts:diff.pts,current:0,selected:null,results:[],done:false};
  navigate('quizCategories');
}

function renderQuizCategories(t) {
  const qd=AppState.quizData; if(!qd)return renderDashboard(t);
  if(qd.done)return renderQuizResults(t);
  const q=qd.questions[qd.current];
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t,'📂 '+t.quizCategories,'sectionBack()')}
    <div class="quiz-dots">${qd.questions.map((_,i)=>`<div class="qdot ${i===qd.current?'active':i<qd.current?(qd.results[i]?'done':'wrong'):''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${qd.current+1} ${t.of} ${qd.questions.length}</p>
    <p style="color:var(--text-light);margin-bottom:4px">${t.whichCategory}</p>
    <div style="margin:16px 0"><span style="font-size:2.5rem">${q.emoji}</span><div class="qprompt" style="font-size:2.5rem;margin:8px 0" data-speak="${q.arabic}">${q.arabic}</div></div>
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${_optCls(qd,o,i)}" onclick="quizAnswer(${i})">${WORD_CATEGORIES[o.label].emoji} ${t[o.label]}</button>`).join('')}</div>
    ${qd.selected!==null?`<div class="qfeedback ${q.options[qd.selected].correct?'correct':'incorrect'}">${q.options[qd.selected].correct?t.correct:t.incorrect}</div>`:''}
  </div></div>`;
}

// ==================== QUIZ PHRASES ====================
function startQuizPhrases() {
  const diff=DIFFICULTY[AppState.difficulty||'normal'];
  const picked=shuffle(SIMPLE_PHRASES).slice(0,diff.questionCount);
  AppState.quizData={type:'phrases',pts:diff.pts,questions:picked.map(p=>{
    // Slice options to diff.options (beginner gets 3, normal/advanced get 4)
    const allOpts=shuffle(p.options.map(o=>({label:o,correct:o===p.answer})));
    // Always keep the correct answer in the slice
    const correctOpt=allOpts.find(o=>o.correct);
    const others=allOpts.filter(o=>!o.correct).slice(0,diff.options-1);
    return {phrase:p.phrase,answer:p.answer,translation:p.translation[AppState.lang]||p.translation.en,options:shuffle([correctOpt,...others])};
  }),current:0,selected:null,results:[],done:false};
  navigate('quizPhrases');
}

function renderQuizPhrases(t) {
  const qd=AppState.quizData; if(!qd)return renderDashboard(t);
  if(qd.done)return renderQuizResults(t);
  const q=qd.questions[qd.current];
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t,'💬 '+t.quizPhrases,'sectionBack()')}
    <div class="quiz-dots">${qd.questions.map((_,i)=>`<div class="qdot ${i===qd.current?'active':i<qd.current?(qd.results[i]?'done':'wrong'):''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${qd.current+1} ${t.of} ${qd.questions.length}</p>
    <p style="color:var(--text-light);margin-bottom:4px">${t.completeSentence}</p>
    <div class="phrase-text" dir="rtl">${q.phrase.replace('___','<span class="phrase-blank">___</span>')}</div>
    <p style="color:var(--text-light);font-size:0.9rem;margin-bottom:12px;font-style:italic">${q.translation}</p>
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${_optCls(qd,o,i)}" style="font-family:var(--font-arabic);font-size:1.3rem" onclick="quizAnswer(${i})">${o.label}</button>`).join('')}</div>
    ${qd.selected!==null?`<div class="qfeedback ${q.options[qd.selected].correct?'correct':'incorrect'}">${q.options[qd.selected].correct?t.correct:t.incorrect}</div>`:''}
  </div></div>`;
}

// ==================== QUIZ MATCH (Drag & Drop / Tap) ====================
let matchState = { leftSelected: null, matched: [], wrong: null, round: 0, pairs: [], results: [] };

function startQuizMatch() {
  const diff=DIFFICULTY[AppState.difficulty||'normal'];
  const all=diff.catKeys?diff.catKeys.flatMap(k=>WORD_CATEGORIES[k].words):getAllWords();
  const rounds=diff.matchRounds, perRound=diff.matchPerRound;
  matchState = { firstSide: null, firstIdx: null, matched: [], wrong: null, round: 0, pairs: [], results: [], totalRounds: rounds, perRound };
  const picked=shuffle(all).slice(0,rounds*perRound);
  matchState.allPairs=picked;
  matchState.pairs=picked.slice(0,perRound);
  matchState.rightOrder=shuffle(Array.from({length:perRound},(_,i)=>i));
  AppState.quizData={type:'match',pts:diff.pts,totalPairs:picked.length,results:[],done:false};
  navigate('quizMatch');
}

function renderQuizMatch(t) {
  const qd=AppState.quizData; if(!qd)return renderDashboard(t);
  if(qd.done)return renderQuizResults(t);
  const ms=matchState;
  const leftItems=ms.pairs.map((p,i)=>({ar:p.ar,idx:i}));
  const rightItems=ms.rightOrder.map(i=>({tr:ms.pairs[i][AppState.lang],idx:i}));
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t,'🔗 '+t.quizMatch,'sectionBack()')}
    <p class="qq">${t.round} ${ms.round+1} ${t.of} ${ms.totalRounds||2}</p>
    <p style="color:var(--text-light);margin-bottom:14px">${t.tapToMatch}</p>
    <div class="match-container">
      <div class="match-col">${leftItems.map(item=>`<div class="match-item match-left" data-idx="${item.idx}" onclick="quizMatchSelect('left',${item.idx})"><span class="arabic">${item.ar}</span></div>`).join('')}</div>
      <div class="match-col">${rightItems.map(item=>`<div class="match-item match-right" data-idx="${item.idx}" onclick="quizMatchSelect('right',${item.idx})"><span>${item.tr}</span></div>`).join('')}</div>
    </div>
  </div></div>`;
}

// Patch CSS classes directly on the already-rendered match items, instead of
// triggering a full render() on every tap — keeps the grid silky on slow
// WebViews and avoids the flicker when the child is quickly pairing items.
function _paintMatch() {
  const ms = matchState;
  document.querySelectorAll('.match-item').forEach(el => {
    const side = el.classList.contains('match-left') ? 'left' : 'right';
    const idx = parseInt(el.dataset.idx, 10);
    el.classList.toggle('matched',  ms.matched.includes(idx));
    el.classList.toggle('selected', ms.firstSide === side && ms.firstIdx === idx);
    el.classList.toggle('wrong',    ms.wrong === idx);
  });
}

function quizMatchSelect(side, idx) {
  const ms = matchState;
  if (ms.matched.includes(idx)) return;

  // First tap (either side) — just remember it.
  if (ms.firstSide === null) {
    ms.firstSide = side; ms.firstIdx = idx; ms.wrong = null;
    _paintMatch(); return;
  }

  // Tap again on the same side — change the current selection.
  if (ms.firstSide === side) {
    ms.firstIdx = idx; ms.wrong = null;
    _paintMatch(); return;
  }

  // Second tap on the opposite side — this is the pair attempt.
  const firstIdx = ms.firstIdx;
  if (idx === firstIdx) {
    ms.matched.push(idx); AudioSystem.playSound('match');
    addScore(AppState.quizData.pts || 10);
    AppState.quizData.results.push(true);
    ms.firstSide = null; ms.firstIdx = null; ms.wrong = null;
    _paintMatch();
    const pr = ms.perRound || 4;
    if (ms.matched.length === pr) {
      setTimeout(() => {
        const totalRounds = ms.totalRounds || 2;
        if (ms.round < totalRounds - 1) {
          ms.round++; ms.matched = []; ms.firstSide = null; ms.firstIdx = null; ms.wrong = null;
          ms.pairs = ms.allPairs.slice(ms.round * pr, (ms.round + 1) * pr);
          ms.rightOrder = shuffle(Array.from({ length: ms.pairs.length }, (_, i) => i));
          render(); // new round → full redraw to refresh both columns
        } else {
          AppState.quizData.done = true; addQuiz();
          if (AppState.quizData.results.every(r => r)) awardBadge('perfectQuiz');
          showConfetti(); render();
        }
      }, 600);
    }
  } else {
    ms.wrong = firstIdx; AudioSystem.playSound('wrong');
    AppState.quizData.results.push(false);
    ms.firstSide = null; ms.firstIdx = null;
    _paintMatch();
    setTimeout(() => { ms.wrong = null; _paintMatch(); }, 600);
  }
}

// ==================== MEMORY GAME ====================
let memoryCards=[], memoryFlipped=[], memoryMoves=0, memoryDone=false;

function startMemory() {
  const diff=DIFFICULTY[AppState.difficulty||'normal'];
  const pool=ALPHABET.slice(0,diff.letterCount);
  const picked=shuffle(pool).slice(0,diff.memoryPairs);
  memoryCards=shuffle(picked.flatMap(item=>[
    {pair:item.l,content:item.l,type:'arabic',flipped:false,matched:false},
    {pair:item.l,content:item.e,type:'emoji',flipped:false,matched:false}
  ]));
  memoryFlipped=[];memoryMoves=0;memoryDone=false;navigate('memory');
}

function renderMemory(t) {
  if(memoryDone){
    return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
      ${secH(t,'🃏 '+t.results,'sectionBack()')}
      <div class="results"><div class="results-score">🎉</div><div class="results-msg">${t.wellDone}</div>
      <p style="color:var(--light);margin-bottom:18px">${memoryMoves} ${t.moves||'moves'} • +90 ${t.points}</p>
      <div style="display:flex;gap:10px;justify-content:center"><button class="btn btn-ghost" onclick="goHome()">🏠 ${t.home}</button><button class="btn btn-primary" onclick="startMemory()">🔄 ${t.replay}</button></div></div></div></div>`;
  }
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t,'🃏 '+t.memory,'sectionBack()')}
    <p style="color:var(--light);margin-bottom:14px;font-weight:600">${t.moves||'Moves'}: <span id="memMoves">${memoryMoves}</span></p>
    <div class="mem-grid">${memoryCards.map((c,i)=>`<div class="mcard ${c.flipped||c.matched?'flipped':''} ${c.matched?'matched':''}" data-mi="${i}" onclick="memFlip(${i})"><div class="mcard-inner"><div class="mcard-front">❓</div><div class="mcard-back ${c.type==='arabic'?'arabic-text':''}">${c.content}</div></div></div>`).join('')}</div>
  </div></div>`;
}

function _memUpdateCard(idx) {
  var el = document.querySelector('.mcard[data-mi="'+idx+'"]');
  if (!el) return;
  var c = memoryCards[idx];
  el.className = 'mcard' + (c.flipped||c.matched?' flipped':'') + (c.matched?' matched':'');
}

function _memUpdateMoves() {
  var el = document.getElementById('memMoves');
  if (el) el.textContent = memoryMoves;
}

function memFlip(i) {
  if(memoryFlipped.length>=2)return;
  var c=memoryCards[i]; if(c.flipped||c.matched)return;
  c.flipped=true; AudioSystem.playSound('flip'); memoryFlipped.push(i);
  _memUpdateCard(i);
  if(memoryFlipped.length===2){
    memoryMoves++;
    _memUpdateMoves();
    var a=memoryFlipped[0], b=memoryFlipped[1];
    if(memoryCards[a].pair===memoryCards[b].pair){
      AudioSystem.playSound('match');
      setTimeout(function(){
        memoryCards[a].matched=true;memoryCards[b].matched=true;memoryFlipped=[];addScore(15);
        _memUpdateCard(a); _memUpdateCard(b);
        if(memoryCards.every(function(x){return x.matched;})){memoryDone=true;addQuiz();_memoryWinsCount++;if(_memoryWinsCount%5===0)_adPending=true;showConfetti();AudioSystem.playSound('complete');render();}
      },500);
    } else {
      AudioSystem.playSound('wrong');
      setTimeout(function(){
        memoryCards[a].flipped=false;memoryCards[b].flipped=false;memoryFlipped=[];
        _memUpdateCard(a); _memUpdateCard(b);
      },800);
    }
  }
}

// ==================== BADGES ====================
function renderBadges(t) {
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}${secH(t,'🏆 '+t.badges,'sectionBack()')}
    <div class="badge-grid">${BADGE_DEFINITIONS.map(b=>{
      const earned=AppState.earnedBadges.includes(b.id);
      return `<div class="badge ${earned?'earned':'locked'}"><div class="badge-emoji">${b.emoji}</div><div class="badge-name">${b.name[AppState.lang]||b.name.en}</div>${earned?'<div style="color:var(--green);font-weight:700;font-size:0.78rem;margin-top:3px">✓</div>':''}</div>`;
    }).join('')}</div></div>`;
}

// ==================== DIFFICULTY ====================
function setDifficulty(d) {
  AppState.difficulty=d; AppState.save(); Analytics.difficultyChange(d); AudioSystem.playSound('correct');
  applyTheme(); navigate('dashboard');
}

function renderDifficulty(t) {
  const diffs=[
    {key:'toddler', emoji:'🧸',col:'#F472B6',dark:'#DB2777'},
    {key:'beginner',emoji:'🌱',col:'#34D399',dark:'#059669'},
    {key:'normal',  emoji:'⭐',col:'#60A5FA',dark:'#2563EB'},
    {key:'advanced',emoji:'🔥',col:'#FB923C',dark:'#EA580C'}
  ];
  const fromReg=!AppState.score&&!AppState.lessons;
  return `<div class="bg-deco"></div>${flLetters()}<div class="app"><div class="welcome page-in" style="padding-top:40px">
    <div class="auth-card" style="max-width:500px;width:100%">
      <div style="font-size:2.5rem;text-align:center;margin-bottom:8px">🎯</div>
      <h2 style="text-align:center;margin-bottom:6px">${t.difficultyTitle}</h2>
      ${fromReg?`<p style="text-align:center;color:var(--text-light);font-size:0.95rem;margin-bottom:20px">${t.tagline||''}</p>`:''}
      <div class="diff-grid">${diffs.map(d=>`
        <div class="diff-card ${AppState.difficulty===d.key?'diff-active':''}" onclick="setDifficulty('${d.key}')"
             style="--dc:${d.col};--dcd:${d.dark}">
          <div class="diff-top">
            <span class="diff-emoji">${d.emoji}</span>
            ${AppState.difficulty===d.key?'<span class="diff-check">✓</span>':''}
          </div>
          <div class="diff-name">${t[d.key]||d.key}</div>
          <div class="diff-desc">${t['difficultyDesc_'+d.key]||''}</div>
        </div>`).join('')}
      </div>
      ${!fromReg?`<button class="btn btn-ghost" style="width:100%;margin-top:12px" onclick="goHome()">← ${t.back}</button>`:''}
    </div>
  </div></div>`;
}

// ==================== LETTER FORMS SCREEN ====================
function renderLetterForms(t) {
  const formNames=['isolated','initial','medial','final'];
  const formLabels={'isolated':t.isolated,'initial':t.initial,'medial':t.medial,'final':t.final};
  const formColors={'isolated':'#A78BFA','initial':'#34D399','medial':'#60A5FA','final':'#FB923C'};
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}${secH(t,'✍️ '+t.letterForms,'sectionBack()')}
    <p style="color:var(--text-light);font-size:0.92rem;text-align:center;margin:-10px 0 16px">${t.initial} · ${t.medial} · ${t.final}</p>
    <div class="forms-header-row">
      <div class="forms-hcell" style="width:60px"></div>
      ${formNames.map(fn=>`<div class="forms-hcell" style="color:${formColors[fn]}">${formLabels[fn]}</div>`).join('')}
    </div>
    <div class="forms-list">${ALPHABET.map((item,i)=>`
      <div class="form-row-item" onclick="openLetter(${i})">
        <div class="form-main-letter" style="color:${item.c}">${item.l}<span class="form-main-name">${item.n}</span></div>
        ${formNames.map(fn=>{
          const fm=item.forms&&item.forms[fn];
          return `<div class="form-cell-item ${!fm?'form-cell-na':''}">
            <div class="form-cell-char" style="color:${fm?item.c:'#CBD5E0'}">${fm?fm.f:'—'}</div>
            ${fm?`<div class="form-cell-ex" data-speak="${fm.ex}">${fm.ex}</div>`:''}
          </div>`;
        }).join('')}
      </div>`).join('')}
    </div>
  </div>`;
}

// ==================== PREMIUM / SUBSCRIPTION ====================

function showPaywall() {
  Analytics.premiumPaywallShown();
  const t=AppState.t;
  const ov=document.createElement('div');ov.className='badge-overlay';ov.id='pwov';ov.onclick=closePaywall;
  const pp=document.createElement('div');pp.className='badge-popup paywall-popup';pp.id='pwpp';
  pp.innerHTML=`
    <div style="font-size:2.8rem;margin-bottom:6px">🔐</div>
    <h2 style="margin:0 0 6px">${t.premiumTitle||'Premium'}</h2>
    <p style="color:var(--text-light);font-size:0.88rem;margin-bottom:16px;line-height:1.4">${t.premiumBenefits||''}</p>
    <div class="paywall-benefits">
      <div class="paywall-benefit"><span>⏱️</span> ${t.quizChrono||'Quiz Chrono'}</div>
      <div class="paywall-benefit"><span>🔤</span> ${t.quizSpelling||'Épellation'}</div>
      <div class="paywall-benefit"><span>🧠</span> ${t.quizExpert||'Quiz Expert'}</div>
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:16px;margin-bottom:8px" onclick="triggerSubscription('monthly')">${t.subscribeBtn||"S'abonner"} — ${t.subscribeMonthly||'1,99€/mois'}</button>
    <button class="btn btn-secondary" style="width:100%;margin-bottom:10px" onclick="triggerSubscription('yearly')">${t.subscribeYearly||'14,99€/an'}</button>
    <button class="btn btn-ghost" style="width:100%;font-size:0.82rem;margin-bottom:6px" onclick="restorePurchasesAction()">${t.restorePurchases||'Restaurer'}</button>
    <button style="background:none;border:none;color:var(--text-light);font-size:0.82rem;cursor:pointer;padding:4px" onclick="closePaywall()">✕ ${t.back||'Fermer'}</button>`;
  document.body.appendChild(ov); document.body.appendChild(pp);
}

function closePaywall() { ['pwov','pwpp'].forEach(id=>{const e=document.getElementById(id);if(e)e.remove();}); }

function triggerSubscription(plan) {
  Analytics.premiumSubscribe(plan);
  closePaywall();
  try {
    if(typeof Android!=='undefined') Android.purchaseSubscription(plan);
    else setPremiumStatus(true); // browser/dev fallback
  } catch(e) { setPremiumStatus(true); }
}

function restorePurchasesAction() {
  closePaywall();
  try {
    if(typeof Android!=='undefined') Android.restorePurchases();
    else { const t=AppState.t; try{if(typeof Android!=='undefined')Android.showToast(t.alreadySubscribed||'');}catch(e){} }
  } catch(e) {}
}

// Called from Android after purchase verification
function setPremiumStatus(status) {
  AppState.premium=!!status;
  if(AppState.user) AppState.save();
  if(status) Analytics.premiumActive();
  if(status) {
    AudioSystem.playSound('badge'); showConfetti();
    const t=AppState.t;
    try{if(typeof Android!=='undefined')Android.showToast(t.alreadySubscribed||'Premium activé !');}catch(e){}
  }
  render();
}

function renderSubscription(t) {
  // Clear side-by-side comparison — each row tells a parent *why* to pay.
  // Free column highlights the limits; Premium column highlights what they
  // actually get. Rows are ordered by emotional impact (no-ads first).
  const rows = [
    { icon: '🚫', label: t.feat_noAds        || 'Zero ads',              free: '📱 '+(t.feat_withAds||'With ads'), prem: '✨' },
    { icon: '📖', label: t.feat_allStories   || 'All stories',           free: '3',                                prem: '✨ '+(t.feat_premStories||'+ advanced') },
    { icon: '⏱️', label: t.feat_expertQuiz   || 'Expert quizzes',        free: '❌',                                prem: '✅' },
    { icon: '🧠', label: t.feat_adaptLearn   || 'Adaptive learning',     free: '❌',                                prem: '✅' },
    { icon: '👨‍👩‍👧', label: t.feat_multikid || 'Up to 4 children',      free: '1',                                prem: '✅ 4' },
    { icon: '📊', label: t.feat_parentDash   || 'Parent dashboard',      free: '❌',                                prem: '✅' },
    { icon: '🏆', label: t.feat_certif       || 'PDF certificates',      free: '❌',                                prem: '✅' }
  ];
  const activeCard = `<div class="sub-active"><span style="font-size:2.2rem">👑</span><div><strong>${t.alreadySubscribed||'Premium active'}</strong><div style="font-size:0.85rem;opacity:0.85">${t.feat_thanks||'Thanks for your support!'}</div></div></div>`;
  const plansBlock = `
    <div class="sub-plans-v2">
      <button class="sub-plan-card sub-plan-monthly" onclick="triggerSubscription('monthly')">
        <div class="sub-plan-badge-empty"></div>
        <div class="sub-plan-period">${t.monthly||'Monthly'}</div>
        <div class="sub-plan-price">${t.subscribeMonthly||'€4.99/mo'}</div>
        <div class="sub-plan-cta">${t.subscribeBtn||"Subscribe"}</div>
      </button>
      <button class="sub-plan-card sub-plan-yearly" onclick="triggerSubscription('yearly')">
        <div class="sub-plan-badge">⭐ ${t.bestValue||'Best value'}</div>
        <div class="sub-plan-period">${t.yearly||'Yearly'}</div>
        <div class="sub-plan-price">${t.subscribeYearly||'€29.99/yr'}</div>
        <div class="sub-plan-save">${t.feat_save||'Save 50%'}</div>
        <div class="sub-plan-cta">${t.subscribeBtn||"Subscribe"}</div>
      </button>
    </div>
    <div class="sub-trust">🔒 ${t.feat_cancel||'Cancel anytime on Google Play'}</div>
    <button class="btn btn-ghost" style="width:100%;font-size:0.85rem;margin-top:6px" onclick="restorePurchasesAction()">${t.restorePurchases}</button>
  `;
  return `<div class="bg-deco"></div>${flLetters()}<div class="app page-in">${navHTML(t)}${secH(t,'👑 '+(t.premiumTitle||'Premium'),'sectionBack()')}
    <div class="sub-page">
      <div class="sub-hero-v2">
        <div class="sub-hero-emoji">👑</div>
        <h2 class="sub-hero-title">${t.feat_unlock||'Unlock the full Arabic Kids'}</h2>
        <p class="sub-hero-sub">${t.feat_tagline||'No ads · all content · the whole family'}</p>
      </div>
      <div class="sub-compare">
        <div class="sub-compare-head">
          <div></div>
          <div class="sub-col-head sub-col-free">${t.feat_free||'Gratuit'}</div>
          <div class="sub-col-head sub-col-prem">👑 Premium</div>
        </div>
        ${rows.map(r => `<div class="sub-compare-row">
          <div class="sub-cell-label"><span class="sub-cell-ico">${r.icon}</span>${r.label}</div>
          <div class="sub-cell-free">${r.free}</div>
          <div class="sub-cell-prem">${r.prem}</div>
        </div>`).join('')}
      </div>
      ${AppState.premium ? activeCard : plansBlock}
    </div>
  </div>`;
}

// ==================== QUIZ CHRONO ====================

let _chronoTimer=null, _chronoTimeLeft=30, _chronoActive=false;

function startQuizChrono() {
  if(!AppState.premium){showPaywall();return;}
  if(_chronoTimer){clearInterval(_chronoTimer);_chronoTimer=null;}
  _chronoTimeLeft=30; _chronoActive=false;
  AppState.quizData={type:'chrono',pts:DIFFICULTY[AppState.difficulty||'normal'].pts,correct:0,total:0,question:null,done:false};
  navigate('quizChrono');
  setTimeout(()=>{_nextChronoQ();_chronoActive=true;render();_startChronoTimer();},200);
}

function _nextChronoQ() {
  const diff=DIFFICULTY[AppState.difficulty||'normal'];
  const pool=ALPHABET.slice(0,diff.letterCount);
  const all=diff.catKeys?diff.catKeys.flatMap(k=>WORD_CATEGORIES[k].words):getAllWords();
  if(Math.random()<0.5){
    const idx=Math.floor(Math.random()*pool.length), correct=pool[idx];
    const others=shuffle(pool.filter((_,i)=>i!==idx)).slice(0,diff.options-1);
    AppState.quizData.question={kind:'letter',prompt:correct.l,arabic:correct.l,options:shuffle([{label:correct.n,correct:true},...others.map(o=>({label:o.n,correct:false}))])};
  } else {
    const w=all[Math.floor(Math.random()*all.length)];
    const others=shuffle(all.filter(x=>x.ar!==w.ar)).slice(0,diff.options-1);
    AppState.quizData.question={kind:'word',prompt:w.ar,emoji:w.emoji,arabic:w.ar,options:shuffle([{label:w[AppState.lang],correct:true},...others.map(o=>({label:o[AppState.lang],correct:false}))])};
  }
}

function _startChronoTimer() {
  if(_chronoTimer) clearInterval(_chronoTimer);
  _chronoTimer=setInterval(()=>{
    _chronoTimeLeft--;
    const bar=document.getElementById('chronoBar'),time=document.getElementById('chronoTime');
    if(bar) bar.style.width=(_chronoTimeLeft/30*100)+'%';
    if(time) time.textContent=_chronoTimeLeft+'s';
    if(bar) bar.style.background=_chronoTimeLeft>15?'var(--secondary)':_chronoTimeLeft>8?'var(--orange)':'var(--primary)';
    if(_chronoTimeLeft<=0){
      clearInterval(_chronoTimer);_chronoTimer=null;_chronoActive=false;
      AppState.quizData.done=true;
      addScore(AppState.quizData.correct*(AppState.quizData.pts||10));
      addQuiz(); showConfetti(); render();
    }
  },1000);
}

function chronoAnswer(i) {
  if(!_chronoActive||!AppState.quizData||!AppState.quizData.question)return;
  const q=AppState.quizData.question, ok=q.options[i].correct;
  AppState.quizData.total++;
  if(ok){AudioSystem.playSound('correct');AppState.quizData.correct++;}
  else AudioSystem.playSound('wrong');
  const scoreEl=document.getElementById('chronoScore');
  if(scoreEl) scoreEl.textContent='✅ '+AppState.quizData.correct;
  // Flash button then move to next question
  const btn=document.querySelectorAll('.qopt')[i];
  if(btn) btn.classList.add(ok?'correct':'incorrect');
  setTimeout(()=>{
    if(!_chronoActive||!AppState.quizData)return;
    _nextChronoQ();
    const qEl=document.getElementById('chronoPrompt'),optsEl=document.getElementById('chronoOpts');
    if(qEl&&optsEl){
      const q2=AppState.quizData.question;
      qEl.textContent=(q2.kind==='word'&&q2.emoji?q2.emoji+' ':'')+q2.prompt;
      optsEl.innerHTML=q2.options.map((o,i)=>`<button class="qopt" onclick="chronoAnswer(${i})">${o.label}</button>`).join('');
    } else render();
  },ok?350:600);
}

function renderQuizChrono(t) {
  const qd=AppState.quizData; if(!qd)return renderDashboard(t);
  if(qd.done){
    if(_chronoTimer){clearInterval(_chronoTimer);_chronoTimer=null;}
    const pct=qd.total>0?Math.round(qd.correct/qd.total*100):0;
    const msg=pct>=80?t.perfect:pct>=50?t.great:t.keepGoing;
    return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
      ${secH(t,'⏱️ '+(t.quizChrono||'Chrono'),'sectionBack()')}
      <div class="results">
        <div style="font-size:3.5rem">⏱️</div>
        <div class="results-score" style="font-size:3rem;color:var(--primary)">${qd.correct}</div>
        <div class="results-msg">${t.correct||'Bonnes réponses'}</div>
        <p style="color:var(--text-light);margin:6px 0 4px">${qd.correct}/${qd.total} · +${qd.correct*(qd.pts||10)} ${t.points}</p>
        <div style="margin-bottom:16px">${getDiffBadge(AppState.difficulty,t)}</div>
        <p class="results-msg" style="font-size:1rem">${msg}</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="btn btn-ghost" onclick="goHome()">🏠 ${t.home}</button>
          <button class="btn btn-primary" onclick="startQuizChrono()">🔄 ${t.replay}</button>
        </div>
      </div>
    </div></div>`;
  }
  const q=qd.question;
  if(!q) return `<div class="app">${navHTML(t)}</div>`;
  const pct=_chronoTimeLeft/30*100;
  const barColor=pct>50?'var(--secondary)':pct>25?'var(--orange)':'var(--primary)';
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t,'⏱️ '+(t.quizChrono||'Chrono'),'sectionBack()')}
    <div class="chrono-header">
      <div class="chrono-score-live" id="chronoScore">✅ ${qd.correct}</div>
      <div class="chrono-timer-wrap">
        <div class="chrono-bar-bg"><div class="chrono-bar" id="chronoBar" style="width:${pct}%;background:${barColor}"></div></div>
        <div class="chrono-time" id="chronoTime">${_chronoTimeLeft}s</div>
      </div>
    </div>
    <p style="color:var(--text-light);font-size:0.85rem;margin-bottom:8px">${t.chronoInstruct||'Réponds vite !'}</p>
    <div class="qprompt" id="chronoPrompt" data-speak="${q.arabic}">${q.kind==='word'&&q.emoji?q.emoji+' ':''}${q.prompt}</div>
    <div class="qoptions" id="chronoOpts">${q.options.map((o,i)=>`<button class="qopt" onclick="chronoAnswer(${i})">${o.label}</button>`).join('')}</div>
  </div></div>`;
}

// ==================== QUIZ SPELLING ====================

function _makeSpellingDistractors(word, count) {
  const chars=[...word]; // split into Unicode grapheme clusters
  if(chars.length<2) return [];
  const seen=new Set([word]); const out=[];
  for(let att=0;att<60&&out.length<count;att++){
    const d=[...chars];
    const a=Math.floor(Math.random()*d.length);
    let b; do{b=Math.floor(Math.random()*d.length);}while(b===a);
    [d[a],d[b]]=[d[b],d[a]];
    const s=d.join('');
    if(!seen.has(s)){seen.add(s);out.push(s);}
  }
  return out;
}

function startQuizSpelling() {
  if(!AppState.premium){showPaywall();return;}
  const diff=DIFFICULTY[AppState.difficulty||'normal'];
  const all=diff.catKeys?diff.catKeys.flatMap(k=>WORD_CATEGORIES[k].words):getAllWords();
  const eligible=all.filter(w=>[...w.ar].length>=3);
  const picked=shuffle(eligible).slice(0,diff.questionCount);
  AppState.quizData={type:'spelling',pts:diff.pts,questions:picked.map(w=>{
    let distractors=_makeSpellingDistractors(w.ar,diff.options-1);
    const extra=shuffle(all.filter(x=>x.ar!==w.ar)).map(x=>x.ar);
    while(distractors.length<diff.options-1&&extra.length) distractors.push(extra.shift());
    return {emoji:w.emoji,translation:w[AppState.lang]||w.en,correct:w.ar,
      options:shuffle([{label:w.ar,correct:true},...distractors.slice(0,diff.options-1).map(d=>({label:d,correct:false}))])};
  }),current:0,selected:null,results:[],done:false};
  navigate('quizSpelling');
}

function renderQuizSpelling(t) {
  const qd=AppState.quizData; if(!qd)return renderDashboard(t);
  if(qd.done)return renderQuizResults(t);
  const q=qd.questions[qd.current];
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t,'🔤 '+(t.quizSpelling||'Épellation'),'sectionBack()')}
    <div class="quiz-dots">${qd.questions.map((_,i)=>`<div class="qdot ${i===qd.current?'active':i<qd.current?(qd.results[i]?'done':'wrong'):''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${qd.current+1} ${t.of} ${qd.questions.length} ${getDiffBadge(AppState.difficulty,t)}</p>
    <p style="color:var(--text-light);margin-bottom:6px">${t.spellInstruct||'Choisis la bonne orthographe'}</p>
    <div class="qprompt" style="font-size:3rem;line-height:1.1">${q.emoji}</div>
    <div style="font-size:1.1rem;font-weight:600;color:var(--text);margin:6px 0 14px">${q.translation}</div>
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${_optCls(qd,o,i)}" style="font-family:var(--font-arabic);font-size:1.6rem;direction:rtl" onclick="quizAnswer(${i})">${o.label}</button>`).join('')}</div>
    ${qd.selected!==null?`<div class="qfeedback ${q.options[qd.selected].correct?'correct':'incorrect'}">${q.options[qd.selected].correct?t.correct:t.incorrect} <span style="font-family:var(--font-arabic);font-size:1.1rem">${q.correct}</span></div>`:''}
  </div></div>`;
}

// ==================== QUIZ HARAKAT ====================

function startQuizHarakat() {
  var diff = DIFFICULTY[AppState.difficulty || 'normal'];
  var pool = _practiceLetters(3);
  // Use only main harakat for beginner (Fatha, Damma, Kasra), all for others
  var harakatPool = AppState.difficulty === 'beginner' ? HARAKAT.slice(0, 3) : HARAKAT.slice(0, 5);
  var picked = shuffle(pool).slice(0, diff.questionCount);

  AppState.quizData = {
    type: 'harakat', pts: diff.pts,
    questions: picked.map(function(letter) {
      var correctH = harakatPool[Math.floor(Math.random() * harakatPool.length)];
      var combined = letter.l + correctH.mark;
      var others = shuffle(harakatPool.filter(function(h) { return h.mark !== correctH.mark; })).slice(0, diff.options - 1);
      return {
        letter: letter.l, combined: combined, correctMark: correctH.mark,
        speak: harakaSpeakable(letter.l, correctH.mark),
        correctName: correctH.nameAr, correctLatin: correctH.name,
        options: shuffle([
          { label: correctH.nameAr, latin: correctH.name, correct: true }
        ].concat(others.map(function(h) {
          return { label: h.nameAr, latin: h.name, correct: false };
        })))
      };
    }),
    current: 0, selected: null, results: [], done: false
  };
  navigate('quizHarakat');
  setTimeout(function() { AudioSystem.speakArabic(AppState.quizData.questions[0].speak); }, 400);
}

function renderQuizHarakat(t) {
  var qd = AppState.quizData; if (!qd) return renderDashboard(t);
  if (qd.done) return renderQuizResults(t);
  var q = qd.questions[qd.current];
  return '<div class="bg-deco"></div><div class="app page-in">' + navHTML(t) + '<div class="quiz-c">' +
    secH(t, '◌َ ' + (t.quizHarakat || 'Quiz Harakat'), 'sectionBack()') +
    '<div class="quiz-dots">' + qd.questions.map(function(_, i) {
      return '<div class="qdot ' + (i === qd.current ? 'active' : i < qd.current ? (qd.results[i] ? 'done' : 'wrong') : '') + '"></div>';
    }).join('') + '</div>' +
    '<p class="qq">' + t.questionOf + ' ' + (qd.current + 1) + ' ' + t.of + ' ' + qd.questions.length + ' ' + getDiffBadge(AppState.difficulty, t) + '</p>' +
    '<p style="color:var(--text-light);margin-bottom:4px">' + (t.identifyHaraka || 'Quel est le signe diacritique ?') + '</p>' +
    '<div class="qprompt" style="font-size:5rem;direction:rtl;font-family:var(--font-arabic)" data-speak="' + q.speak + '">' + q.combined + '</div>' +
    '<button class="btn btn-secondary btn-sm" data-speak="' + q.speak + '" style="margin:0 auto 12px;display:flex">🔊 ' + t.listen + '</button>' +
    '<div class="qoptions">' + q.options.map(function(o, i) {
      return '<button class="qopt ' + _optCls(qd, o, i) +
        '" style="flex-direction:column;gap:2px" onclick="quizAnswer(' + i + ')"><span style="font-family:var(--font-arabic);font-size:1.2rem">' +
        o.label + '</span><span style="font-size:0.7rem;opacity:0.7">' + o.latin + '</span></button>';
    }).join('') + '</div>' +
    (qd.selected !== null ? '<div class="qfeedback ' + (q.options[qd.selected].correct ? 'correct' : 'incorrect') + '">' +
      (q.options[qd.selected].correct ? t.correct : t.incorrect) +
      ' <span style="font-family:var(--font-arabic)">' + q.combined + '</span> · ' + q.correctName + '</div>' : '') +
  '</div></div>';
}

// ==================== QUIZ EXPERT ====================

function startQuizExpert() {
  if(!AppState.premium){showPaywall();return;}
  const diff=DIFFICULTY[AppState.difficulty||'normal'];
  const pool=ALPHABET.slice(0,diff.letterCount).filter(a=>a.forms);
  const nonIsolated=['initial','medial','final'];
  const picked=shuffle(pool).slice(0,diff.questionCount);
  AppState.quizData={type:'expert',pts:diff.pts,questions:picked.map(letter=>{
    const avail=nonIsolated.filter(fn=>letter.forms[fn]);
    const tf=avail[Math.floor(Math.random()*avail.length)];
    const formChar=letter.forms[tf].f;
    const others=shuffle(pool.filter(a=>a.l!==letter.l)).slice(0,diff.options-1);
    return {formChar,formName:tf,correctLetter:letter.l,correctName:letter.n,
      options:shuffle([{label:letter.l,name:letter.n,correct:true},...others.map(o=>({label:o.l,name:o.n,correct:false}))])};
  }),current:0,selected:null,results:[],done:false};
  navigate('quizExpert');
}

function renderQuizExpert(t) {
  const qd=AppState.quizData; if(!qd)return renderDashboard(t);
  if(qd.done)return renderQuizResults(t);
  const q=qd.questions[qd.current];
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t,'🧠 '+(t.quizExpert||'Expert'),'sectionBack()')}
    <div class="quiz-dots">${qd.questions.map((_,i)=>`<div class="qdot ${i===qd.current?'active':i<qd.current?(qd.results[i]?'done':'wrong'):''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${qd.current+1} ${t.of} ${qd.questions.length} ${getDiffBadge(AppState.difficulty,t)}</p>
    <p style="color:var(--text-light);margin-bottom:4px">${t.expertInstruct||'Identifie la lettre'}</p>
    <div class="qprompt" style="font-size:3.8rem;direction:rtl;font-family:var(--font-arabic)">${q.formChar}</div>
    <p style="color:var(--purple);font-weight:700;font-size:0.88rem;margin-bottom:14px">— ${t[q.formName]||q.formName} —</p>
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${_optCls(qd,o,i)}" style="font-family:var(--font-arabic);font-size:1.8rem;flex-direction:column;gap:2px" onclick="quizAnswer(${i})"><span>${o.label}</span><span style="font-size:0.65rem;font-family:inherit;opacity:0.7">${o.name}</span></button>`).join('')}</div>
    ${qd.selected!==null?`<div class="qfeedback ${q.options[qd.selected].correct?'correct':'incorrect'}">${q.options[qd.selected].correct?t.correct:t.incorrect} <span style="font-family:var(--font-arabic)">${q.correctLetter}</span> · ${q.correctName}</div>`:''}
  </div></div>`;
}

// ==================== LETTER TRACING ====================

let _traceCtx = null, _traceGuideCtx = null;
let _tracePath = []; // points drawn by user
let _traceDrawing = false, _traceCompleted = false, _traceGuideRunning = false;
let _traceAnimTimer = null;

function openTraceLesson(i) {
  AppState.selectedLetter = i;
  navigate('letterTraceLesson');
  requestAnimationFrame(() => _initTraceCanvas());
}

function renderLetterTraceMenu(t) {
  const diff = DIFFICULTY[AppState.difficulty || 'normal'];
  const letters = ALPHABET.slice(0, diff.letterCount);
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}${secH(t,'✏️ ' + (t.tracing||'Écriture'), "sectionBack()")}
    <p style="color:var(--text-light);font-size:0.92rem;text-align:center;margin:-10px 0 16px">${t.tracingTitle||'Choisis une lettre'}</p>
    <div class="trace-letter-grid">
      ${letters.map((item,i) => `
        <div class="trace-letter-card" onclick="openTraceLesson(${i})" style="border-color:${item.c}55;background:${item.c}0D">
          <div class="trace-letter-char" style="color:${item.c}">${item.l}</div>
          <div class="trace-letter-name">${item.n}</div>
        </div>`).join('')}
    </div>
  </div>`;
}

function renderLetterTraceLesson(t) {
  const i = AppState.selectedLetter || 0;
  const item = ALPHABET[i];
  const diff = DIFFICULTY[AppState.difficulty || 'normal'];
  const maxIdx = Math.min(diff.letterCount, ALPHABET.length) - 1;
  const prev = i > 0 ? i - 1 : maxIdx;
  const next = i < maxIdx ? i + 1 : 0;
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}${secH(t,'✏️ ' + item.n, "sectionBack()")}
    <div class="trace-lesson">
      <div class="trace-letter-display" style="color:${item.c}">
        ${item.l}
        <div class="trace-letter-sub">${item.na} · ${item.n}</div>
      </div>
      <div class="trace-canvas-wrap" id="traceWrap">
        <canvas id="traceGuide" width="320" height="320" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:1"></canvas>
        <canvas id="traceUser"  width="320" height="320" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;touch-action:none"></canvas>
        <div class="trace-overlay" id="traceOverlay">
          <div class="trace-overlay-inner">
            <div style="font-size:2.8rem;margin-bottom:8px">👆</div>
            <div style="font-size:1.1rem">${t.tracingInstruct||'Trace la lettre avec ton doigt'}</div>
          </div>
        </div>
        <div class="trace-result" id="traceResult" style="display:none"></div>
      </div>
      <div class="trace-controls">
        <button class="btn btn-ghost trace-btn" onclick="_runTraceGuide()" id="btnGuide">👁 ${t.tracingGuide||'Guide'}</button>
        <button class="btn btn-ghost trace-btn" onclick="_clearTrace()" id="btnClear">🗑 ${t.tracingClear||'Effacer'}</button>
        <button class="btn btn-primary trace-btn" onclick="_checkTrace()" id="btnCheck">✓ ${t.tracingCheck||'Vérifier'}</button>
      </div>
      <div class="trace-nav" id="traceNav" style="display:none">
        <button class="btn btn-ghost" onclick="openTraceLesson(${prev})">← ${t.previous||'Précédent'}</button>
        <button class="btn btn-primary" onclick="openTraceLesson(${next})">${t.tracingNext||'Suivant'} →</button>
      </div>
    </div>
  </div>`;
}

var _TRACE_W = 320;
var _traceWaypoints = [];    // live guide points, lit up as the child passes them
var _traceAutoDone = false;  // one-shot guard for auto-validation

function _initTraceCanvas() {
  const gc = document.getElementById('traceGuide');
  const uc = document.getElementById('traceUser');
  if (!gc || !uc) return;
  // Render at devicePixelRatio for crisp strokes on high-density screens;
  // all drawing keeps using logical 320x320 coordinates via ctx.scale.
  var dpr = Math.min(window.devicePixelRatio || 1, 3);
  [gc, uc].forEach(function(c) { c.width = _TRACE_W * dpr; c.height = _TRACE_W * dpr; });
  _traceGuideCtx = gc.getContext('2d'); _traceGuideCtx.scale(dpr, dpr);
  _traceCtx = uc.getContext('2d'); _traceCtx.scale(dpr, dpr);
  _tracePath = [];
  _traceDrawing = _traceCompleted = _traceGuideRunning = false;
  if (_traceAnimTimer) { clearTimeout(_traceAnimTimer); _traceAnimTimer = null; }
  const i = AppState.selectedLetter || 0;
  _resetTraceWaypoints(i);
  _drawTraceTemplate(i);
  _setupTraceEvents(uc);
  // Canvas text does not trigger @font-face loading — make sure the bundled
  // Arabic face is in, then redraw so guide, glyph and scorer all share it.
  if (document.fonts && document.fonts.load) {
    document.fonts.load('180px "AK Naskh"').then(function() {
      if (AppState.screen === 'letterTraceLesson' && !_traceCompleted) _drawTraceTemplate(AppState.selectedLetter || 0);
    }).catch(function() {});
  }
  _traceAnimTimer = setTimeout(() => _runTraceGuide(), 600);
}

function _resetTraceWaypoints(idx) {
  var sd = TRACE_STROKES[idx], S = _TRACE_W / 100;
  _traceWaypoints = [];
  _traceAutoDone = false;
  if (!sd) return;
  sd.strokes.forEach(function(pts) {
    pts.forEach(function(p) { _traceWaypoints.push({ x: p.x * S, y: p.y * S, hit: false }); });
  });
  sd.dots.forEach(function(d) { _traceWaypoints.push({ x: d.x * S, y: d.y * S, hit: false }); });
}

// Light up guide waypoints the finger passes over; when the whole letter is
// covered, validate automatically — small kids don't need the Check button.
function _markTraceWaypoints(p) {
  if (_traceCompleted || !_traceWaypoints.length) return;
  var tol = document.body.classList.contains('mode-toddler') ? 30 : 22;
  var tolSq = tol * tol, allHit = true;
  for (var k = 0; k < _traceWaypoints.length; k++) {
    var w = _traceWaypoints[k];
    if (!w.hit) {
      var dx = p.x - w.x, dy = p.y - w.y;
      if (dx * dx + dy * dy <= tolSq) {
        w.hit = true;
        if (_traceGuideCtx) {
          _traceGuideCtx.beginPath();
          _traceGuideCtx.arc(w.x, w.y, 6, 0, Math.PI * 2);
          _traceGuideCtx.fillStyle = '#22c55e';
          _traceGuideCtx.fill();
        }
      }
    }
    if (!w.hit) allHit = false;
  }
  if (allHit && !_traceAutoDone) {
    _traceAutoDone = true;
    setTimeout(function() { if (!_traceCompleted) _checkTrace(); }, 250);
  }
}

function _drawTraceTemplate(idx) {
  if (!_traceGuideCtx) return;
  var ctx = _traceGuideCtx, W = _TRACE_W, H = _TRACE_W, S = W / 100;
  ctx.clearRect(0, 0, W, H);
  var item = ALPHABET[idx];

  // Big faded letter background — use Arabic font, centered
  ctx.save();
  ctx.font = '180px "AK Naskh", "Noto Naskh Arabic", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillStyle = 'rgba(140,140,170,0.13)';
  ctx.fillText(item.l, W / 2, H / 2 + 10);
  ctx.restore();

  // Dashed guide paths — thick, clear for kids
  var sd = TRACE_STROKES[idx];
  sd.strokes.forEach(function(pts, si) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(99,102,241,0.35)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    pts.forEach(function(p, pi) { if (pi === 0) ctx.moveTo(p.x * S, p.y * S); else ctx.lineTo(p.x * S, p.y * S); });
    ctx.stroke();
    ctx.setLineDash([]);

    // Big green START circle with number
    var sp = pts[0];
    ctx.beginPath();
    ctx.arc(sp.x * S, sp.y * S, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e';
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(si + 1, sp.x * S, sp.y * S);

    // Small red END circle
    var ep = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(ep.x * S, ep.y * S, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    // Direction arrows along the path
    if (pts.length >= 3) {
      var mid = Math.floor(pts.length / 2);
      var p1 = pts[mid - 1], p2 = pts[mid];
      var angle = Math.atan2((p2.y - p1.y) * S, (p2.x - p1.x) * S);
      ctx.save();
      ctx.translate(p2.x * S, p2.y * S);
      ctx.rotate(angle);
      ctx.fillStyle = 'rgba(99,102,241,0.6)';
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-4, -5);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });

  // Dot guide circles — bigger, with orange fill
  sd.dots.forEach(function(d) {
    ctx.beginPath();
    ctx.arc(d.x * S, d.y * S, 9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251,146,60,0.45)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(251,146,60,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function _setupTraceEvents(canvas) {
  var overlay = document.getElementById('traceOverlay');
  function pos(e) {
    var r = canvas.getBoundingClientRect();
    // Logical 320x320 coordinates — canvas.width is scaled by dpr, don't use it.
    var sx = _TRACE_W / r.width, sy = _TRACE_W / r.height;
    var src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * sx, y: (src.clientY - r.top) * sy };
  }
  function onStart(e) {
    e.preventDefault();
    if (_traceCompleted) return;
    if (overlay) overlay.style.display = 'none';
    _traceDrawing = true;
    var p = pos(e);
    _tracePath.push(p);
    _markTraceWaypoints(p);
    _traceCtx.beginPath();
    _traceCtx.moveTo(p.x, p.y);
  }
  function onMove(e) {
    e.preventDefault();
    if (!_traceDrawing || _traceCompleted) return;
    var p = pos(e);
    _tracePath.push(p);
    _markTraceWaypoints(p);
    _traceCtx.lineTo(p.x, p.y);
    _traceCtx.strokeStyle = '#6366F1';
    _traceCtx.lineWidth = 14;  // thick line for kids
    _traceCtx.lineCap = 'round';
    _traceCtx.lineJoin = 'round';
    _traceCtx.stroke();
    _traceCtx.beginPath();
    _traceCtx.moveTo(p.x, p.y);
  }
  function onEnd(e) { e.preventDefault(); _traceDrawing = false; }
  canvas.addEventListener('touchstart', onStart, { passive: false });
  canvas.addEventListener('touchmove',  onMove,  { passive: false });
  canvas.addEventListener('touchend',   onEnd,   { passive: false });
  canvas.addEventListener('mousedown',  onStart);
  canvas.addEventListener('mousemove',  onMove);
  canvas.addEventListener('mouseup',    onEnd);
}

function _clearTrace() {
  if (!_traceCtx) return;
  _traceCtx.clearRect(0, 0, _TRACE_W, _TRACE_W);
  _tracePath = [];
  _traceCompleted = false;
  _traceGuideRunning = false;
  if (_traceAnimTimer) { clearTimeout(_traceAnimTimer); _traceAnimTimer = null; }
  _resetTraceWaypoints(AppState.selectedLetter || 0);
  _drawTraceTemplate(AppState.selectedLetter || 0);
  var res = document.getElementById('traceResult'), nav = document.getElementById('traceNav'), ov = document.getElementById('traceOverlay');
  if (res) res.style.display = 'none';
  if (nav) nav.style.display = 'none';
  if (ov) ov.style.display = 'flex';
  AudioSystem.playSound('click');
}

function _runTraceGuide() {
  if (_traceGuideRunning) return;
  if (_traceAnimTimer) { clearTimeout(_traceAnimTimer); _traceAnimTimer = null; }
  if (_traceCtx) _traceCtx.clearRect(0, 0, _TRACE_W, _TRACE_W);
  _tracePath = []; _traceCompleted = false;
  _resetTraceWaypoints(AppState.selectedLetter || 0);
  var ov = document.getElementById('traceOverlay'), res = document.getElementById('traceResult'), nav = document.getElementById('traceNav');
  if (ov) ov.style.display = 'none';
  if (res) res.style.display = 'none';
  if (nav) nav.style.display = 'none';
  _traceGuideRunning = true;
  var i = AppState.selectedLetter || 0;
  var sd = TRACE_STROKES[i], S = _TRACE_W / 100;

  // Build animation sequence — strokes then dots
  var seq = [];
  sd.strokes.forEach(function(pts, si) {
    pts.forEach(function(p, pi) { seq.push({ x: p.x*S, y: p.y*S, ns: pi===0, dot: false }); });
    for (var k = 0; k < 6; k++) seq.push(null); // longer pause between strokes
  });
  sd.dots.forEach(function(d) {
    var cx = d.x*S, cy = d.y*S, r = 9;
    for (var a = 0; a <= 300; a += 50) seq.push({ x: cx + r*Math.cos(a*Math.PI/180), y: cy + r*Math.sin(a*Math.PI/180), ns: a===0, dot: true });
    for (var k = 0; k < 6; k++) seq.push(null);
  });

  var idx = 0;
  var drawn = [];
  var ctx = _traceGuideCtx;

  function step() {
    if (!document.getElementById('traceGuide') || AppState.screen !== 'letterTraceLesson') { _traceGuideRunning = false; return; }
    if (idx >= seq.length) {
      _traceGuideRunning = false;
      _drawTraceTemplate(i);
      return;
    }
    var curr = seq[idx++];
    if (curr) drawn.push(curr);

    // Redraw template + animated path
    _drawTraceTemplate(i);
    var lineStarted = false;
    drawn.forEach(function(p, pi) {
      if (p.ns || pi === 0) {
        if (lineStarted) ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.strokeStyle = p.dot ? '#FB923C' : '#6366F1';
        ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        lineStarted = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
      if (pi === drawn.length - 1 && lineStarted) ctx.stroke();
    });

    // Big animated finger/pencil ball
    if (curr) {
      ctx.save();
      ctx.beginPath(); ctx.arc(curr.x, curr.y, 18, 0, Math.PI*2);
      ctx.fillStyle = '#FBBF24';
      ctx.shadowColor = 'rgba(251,191,36,0.7)';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☝️', curr.x, curr.y);
      ctx.restore();
    }
    _traceAnimTimer = setTimeout(step, curr ? 55 : 180); // slower = easier to follow
  }
  AudioSystem.playSound('click');
  _traceAnimTimer = setTimeout(step, 100);
}

// Glyph-mask scoring: render the actual font letter on a hidden canvas, build
// the alpha mask, then score the user's trace by (a) coverage = % of letter
// pixels they touched and (b) hit rate = % of their tap points that landed
// on the letter. The combined score is what we display. Auto-adapts to any
// letter without per-letter waypoint maintenance.
function _scoreTraceByGlyph(letter) {
  var W = _TRACE_W;
  if (!W || _tracePath.length === 0) return 0;
  var c = document.createElement('canvas');
  c.width = W; c.height = W;
  var cx = c.getContext('2d');
  cx.font = '180px "AK Naskh", "Noto Naskh Arabic", serif';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.direction = 'rtl';
  cx.fillStyle = '#000';
  cx.fillText(letter, W / 2, W / 2 + 10);
  var data = cx.getImageData(0, 0, W, W).data;

  // Letter pixels sampled at a 5-px grid for coverage check.
  var lp = [];
  for (var y = 0; y < W; y += 5) {
    for (var x = 0; x < W; x += 5) {
      if (data[(y * W + x) * 4 + 3] > 50) lp.push(x, y);
    }
  }
  if (lp.length === 0) return 0;

  // Wider tolerance for toddler mode — little fingers, big strokes.
  var TOL = document.body.classList.contains('mode-toddler') ? 32 : 24, TOL_SQ = TOL * TOL;

  // Coverage: how much of the letter the user drew over.
  var covered = 0;
  for (var k = 0; k < lp.length; k += 2) {
    var lx = lp[k], ly = lp[k + 1];
    for (var p = 0; p < _tracePath.length; p++) {
      var dx = _tracePath[p].x - lx, dy = _tracePath[p].y - ly;
      if (dx * dx + dy * dy <= TOL_SQ) { covered++; break; }
    }
  }
  var coverage = covered / (lp.length / 2);

  // Hit rate: how much of the user's path was on/near the letter (penalises
  // wild scribbles that miss).
  var hits = 0;
  for (var pi = 0; pi < _tracePath.length; pi++) {
    var px = _tracePath[pi].x | 0, py = _tracePath[pi].y | 0;
    var found = false;
    for (var dy2 = -8; dy2 <= 8 && !found; dy2 += 4) {
      for (var dx2 = -8; dx2 <= 8 && !found; dx2 += 4) {
        var nx = px + dx2, ny = py + dy2;
        if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
        if (data[(ny * W + nx) * 4 + 3] > 50) found = true;
      }
    }
    if (found) hits++;
  }
  var hitRate = hits / _tracePath.length;

  // Weighted: coverage matters most, hit rate keeps off-shape scribbles down.
  var score = Math.round((coverage * 0.7 + hitRate * 0.3) * 100);
  if (hitRate < 0.4) score = Math.min(score, Math.round(hitRate * 100));
  return score;
}

function _checkTrace() {
  var t = AppState.t;
  if (_tracePath.length < 6) {
    var ov = document.getElementById('traceOverlay');
    if (ov) ov.style.display = 'flex';
    AudioSystem.playSound('wrong');
    return;
  }
  var i = AppState.selectedLetter || 0;
  var pct = _scoreTraceByGlyph(ALPHABET[i].l);

  // Minimum threshold — below this, nothing is awarded. Kid gets an
  // encouragement message and can redo the tracing from scratch.
  var MIN_PCT = document.body.classList.contains('mode-toddler') ? 20 : 30;
  if (pct < MIN_PCT) {
    AudioSystem.playSound('wrong');
    var resElLo = document.getElementById('traceResult');
    if (resElLo) {
      resElLo.style.display = 'flex';
      resElLo.innerHTML = '<div class="trace-result-inner"><div class="trace-stars" style="font-size:2.6rem">💪</div>'+
        '<div class="trace-msg">' + (t.traceRetryMsg || 'Essaie encore ! Suis bien le modèle.') + '</div>'+
        '<button class="btn btn-primary btn-sm" onclick="_clearTrace()" style="margin-top:12px">🔄 ' + (t.replay || 'Réessayer') + '</button></div>';
    }
    return; // no score, no learned flag, user retries
  }

  _traceCompleted = true; _traceGuideRunning = false;
  if (_traceAnimTimer) { clearTimeout(_traceAnimTimer); _traceAnimTimer = null; }
  // Queue an interstitial for every 6 successful tracings (shown on exit).
  _lettersTracedCount++;
  if (_lettersTracedCount % 6 === 0) _adPending = true;
  var stars = pct >= 70 ? 3 : pct >= 50 ? 2 : 1;
  var pts = stars * 5;
  // Reinforce: say the letter's name on success (IPA-forced MP3).
  setTimeout(function() { AudioSystem.speakArabic(ALPHABET[i].l); }, 600);
  // Tracing is production practice (scored), but acquisition is proven by the
  // recognition check — so a trace no longer flips the "learned" flag on its
  // own. The letter still turns green only once its check is passed.
  addScore(pts); addLesson();
  if (stars === 3) { AudioSystem.playSound('correct'); showConfetti(); }
  else AudioSystem.playSound('correct');
  var msgs = [t.keepGoing||'Continue !', t.good||'Bien !', t.perfect||'Parfait ! 🌟'];
  var starStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
  var resEl = document.getElementById('traceResult');
  if (resEl) {
    resEl.style.display = 'flex';
    resEl.innerHTML = '<div class="trace-result-inner"><div class="trace-stars">' + starStr + '</div><div class="trace-msg">' + msgs[stars-1] + '</div><div class="trace-pts">+' + pts + ' pts</div></div>';
  }
  var navEl = document.getElementById('traceNav');
  if (navEl) navEl.style.display = 'flex';
}

// ==================== READING / SPEECH RECOGNITION ====================

let _readingState = { items: [], current: 0, results: [], listening: false, done: false, partial: '' };

function _normalizeArabic(text) {
  // Strip tashkeel (diacritics), normalize whitespace, lowercase
  return text.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').replace(/\s+/g, ' ').trim();
}

function _levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = a[i-1] === b[j-1] ? d[i-1][j-1] : 1 + Math.min(d[i-1][j], d[i][j-1], d[i-1][j-1]);
    }
  }
  return d[m][n];
}

function compareArabicText(expected, recognized) {
  const a = _normalizeArabic(expected), b = _normalizeArabic(recognized);
  if (!a || !b) return 0;
  if (a === b) return 1;
  // For short texts, use character-level Levenshtein
  const dist = _levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return Math.max(0, 1 - dist / maxLen);
}

function startReadingWords() {
  const diff = DIFFICULTY[AppState.difficulty || 'normal'];
  const all = diff.catKeys ? diff.catKeys.flatMap(k => WORD_CATEGORIES[k].words) : getAllWords();
  const count = Math.min(diff.questionCount, all.length);
  const picked = shuffle(all).slice(0, count);
  _readingState = {
    type: 'words',
    items: picked.map(w => ({ ar: w.ar, translation: w[AppState.lang] || w.en, emoji: w.emoji })),
    current: 0, results: [], listening: false, done: false, partial: ''
  };
  navigate('readingWords');
}

function startReadingText() {
  const maxLevel = AppState.difficulty === 'beginner' ? 1 : AppState.difficulty === 'normal' ? 2 : 3;
  const pool = READING_TEXTS.filter(t => t.level <= maxLevel);
  const picked = shuffle(pool).slice(0, 5);
  _readingState = {
    type: 'text',
    items: picked.map(t => ({ ar: t.ar, translation: t.translation[AppState.lang] || t.translation.en })),
    current: 0, results: [], listening: false, done: false, partial: ''
  };
  navigate('readingText');
}

function _startListening() {
  _readingState.listening = true;
  _readingState.partial = '';
  render();
  // Reading a full text needs much longer silence tolerance than a single
  // word — pass the flag so Android extends the SpeechRecognizer timeouts.
  const extended = _readingState.type === 'text';
  try {
    if (typeof Android !== 'undefined' && Android.startListening) {
      Android.startListening(extended);
    } else {
      // Web Speech API fallback for browser testing
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const rec = new SR();
        rec.lang = 'ar';
        rec.continuous = false;
        rec.interimResults = true;
        rec.onresult = function(e) {
          const r = e.results[e.results.length - 1];
          if (r.isFinal) {
            onSpeechResult(r[0].transcript, String(r[0].confidence), '');
          } else {
            onSpeechPartial(r[0].transcript);
          }
        };
        rec.onerror = function(e) { onSpeechResult('', '0', e.error || 'error'); };
        rec.onend = function() { if (_readingState.listening) { _readingState.listening = false; render(); } };
        rec.start();
      } else {
        _readingState.listening = false;
        render();
        try { if (typeof Android !== 'undefined') Android.showToast(AppState.t.speechNotAvailable); } catch(e) {}
      }
    }
  } catch(e) {
    _readingState.listening = false;
    render();
  }
}

// Callbacks from Android SpeechRecognizer
window.onSpeechReady = function() {
  _readingState.listening = true;
  const mic = document.getElementById('micBtn');
  if (mic) mic.classList.add('listening');
};

window.onSpeechEnd = function() {
  const mic = document.getElementById('micBtn');
  if (mic) mic.classList.remove('listening');
};

window.onSpeechPartial = function(text) {
  _readingState.partial = text;
  const el = document.getElementById('partialText');
  if (el) el.textContent = text;
};

window.onSpeechResult = function(resultText, confidence, error) {
  _readingState.listening = false;
  const t = AppState.t;

  if (error) {
    if (error === 'permission_denied') {
      try { if (typeof Android !== 'undefined') Android.showToast(t.permissionNeeded || 'Permission needed'); } catch(e) {}
    } else if (error === 'no_match' || error === 'timeout') {
      try { if (typeof Android !== 'undefined') Android.showToast(t.keepPracticing || 'Try again'); } catch(e) {}
    } else if (error === 'not_available') {
      try { if (typeof Android !== 'undefined') Android.showToast(t.speechNotAvailable || 'Not available'); } catch(e) {}
    }
    render();
    return;
  }

  const item = _readingState.items[_readingState.current];
  const score = compareArabicText(item.ar, resultText);
  _readingState.results.push({ expected: item.ar, recognized: resultText, score: score, confidence: parseFloat(confidence) || 0 });

  if (score >= 0.8) { AudioSystem.playSound('correct'); addScore(score >= 0.95 ? 15 : 10); }
  else if (score >= 0.5) { AudioSystem.playSound('click'); addScore(5); }
  else { AudioSystem.playSound('wrong'); }

  render();
};

function _readingNext() {
  if (_readingState.current < _readingState.items.length - 1) {
    _readingState.current++;
    render();
  } else {
    _readingState.done = true;
    addQuiz();
    // Queue an interstitial by reading type: every 4 word sessions, every 3 text sessions.
    if (_readingState.type === 'text') {
      _readingTextsCount++;
      if (_readingTextsCount % 3 === 0) _adPending = true;
    } else {
      _readingWordsCount++;
      if (_readingWordsCount % 4 === 0) _adPending = true;
    }
    const goodCount = _readingState.results.filter(r => r.score >= 0.8).length;
    if (goodCount === _readingState.results.length) { awardBadge('perfectQuiz'); }
    showConfetti();
    render();
  }
}

function _readingRetry() {
  // Remove last result and allow retry
  if (_readingState.results.length > _readingState.current) {
    _readingState.results.pop();
  }
  render();
}

function _getReadingFeedback(score, t) {
  if (score >= 0.9) return { cls: 'good', msg: t.excellentReading || 'Excellent!', stars: '⭐⭐⭐' };
  if (score >= 0.7) return { cls: 'ok', msg: t.almostPerfect || 'Almost!', stars: '⭐⭐☆' };
  return { cls: 'poor', msg: t.keepPracticing || 'Keep going!', stars: '⭐☆☆' };
}

function renderReadingWords(t) {
  const rs = _readingState;
  if (rs.done) {
    const good = rs.results.filter(r => r.score >= 0.8).length;
    const total = rs.results.length;
    const pct = total > 0 ? Math.round(good / total * 100) : 0;
    const msg = pct === 100 ? t.perfect : pct >= 75 ? t.great : pct >= 50 ? t.good : t.keepGoing;
    return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
      ${secH(t, '🎙️ ' + (t.readingComplete || 'Done'), 'sectionBack()')}
      <div class="results">
        <div style="font-size:3.5rem">🎙️</div>
        <div class="results-score">${good}/${total}</div>
        <div class="results-msg">${msg}</div>
        <p style="color:var(--text-light);margin:6px 0 16px">${t.similarity||'Similarity'}: ${pct}%</p>
        <div style="display:flex;gap:10px;justify-content:center">
          <button class="btn btn-ghost" onclick="goHome()">🏠 ${t.home}</button>
          <button class="btn btn-primary" onclick="startReadingWords()">🔄 ${t.replay}</button>
        </div>
      </div>
    </div></div>`;
  }

  const item = rs.items[rs.current];
  const hasResult = rs.results.length > rs.current;
  const result = hasResult ? rs.results[rs.current] : null;
  const fb = result ? _getReadingFeedback(result.score, t) : null;

  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t, '🎙️ ' + (t.readingWords || 'Reading'), 'sectionBack()')}
    <div class="quiz-dots">${rs.items.map((_, i) => `<div class="qdot ${i === rs.current ? 'active' : i < rs.current ? (rs.results[i] && rs.results[i].score >= 0.8 ? 'done' : 'wrong') : ''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${rs.current + 1} ${t.of} ${rs.items.length} ${getDiffBadge(AppState.difficulty, t)}</p>
    <p style="color:var(--text-light);margin-bottom:4px">${t.readAloud || 'Read aloud'}</p>
    ${item.emoji ? `<div style="font-size:3rem;text-align:center;margin:8px 0">${item.emoji}</div>` : ''}
    <div class="reading-text-block" data-speak="${item.ar}">${item.ar}</div>
    <p class="reading-translation">${item.translation}</p>
    <button class="btn btn-secondary btn-sm" data-speak="${item.ar}" style="margin:0 auto 16px;display:flex">🔊 ${t.listenFirst || 'Listen'}</button>
    ${!hasResult ? `
      <button class="mic-btn ${rs.listening ? 'listening' : ''}" id="micBtn" onclick="${rs.listening ? '' : '_startListening()'}">
        ${rs.listening ? '<span class="mic-waves">🎙️</span>' : '🎤'}
      </button>
      <p class="mic-hint">${rs.listening ? (t.listening || 'Listening...') : (t.tapMicToStart || 'Tap the mic')}</p>
      <div id="partialText" class="reading-partial">${rs.partial || ''}</div>
    ` : `
      <div class="speech-result ${fb.cls}">
        <div class="speech-result-stars">${fb.stars}</div>
        <div class="speech-result-score">${Math.round(result.score * 100)}%</div>
        <div class="speech-result-msg">${fb.msg}</div>
        ${result.recognized ? `<div class="speech-result-label">${t.yourPronunciation || 'You said'}:</div><div class="speech-result-text">${result.recognized}</div>` : ''}
      </div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:14px">
        <button class="btn btn-ghost btn-sm" onclick="_readingRetry()">🔄 ${t.replay || 'Retry'}</button>
        <button class="btn btn-primary btn-sm" onclick="_readingNext()">${rs.current < rs.items.length - 1 ? (t.nextWord || 'Next') + ' →' : '✅ ' + (t.wellDone || 'Done')}</button>
      </div>
    `}
  </div></div>`;
}

function renderReadingText(t) {
  const rs = _readingState;
  if (rs.done) {
    const good = rs.results.filter(r => r.score >= 0.6).length;
    const total = rs.results.length;
    const avgScore = total > 0 ? Math.round(rs.results.reduce((s, r) => s + r.score, 0) / total * 100) : 0;
    const msg = avgScore >= 90 ? t.perfect : avgScore >= 70 ? t.great : avgScore >= 50 ? t.good : t.keepGoing;
    return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
      ${secH(t, '📖 ' + (t.readingComplete || 'Done'), 'sectionBack()')}
      <div class="results">
        <div style="font-size:3.5rem">📖</div>
        <div class="results-score">${good}/${total}</div>
        <div class="results-msg">${msg}</div>
        <p style="color:var(--text-light);margin:6px 0 16px">${t.similarity || 'Similarity'}: ${avgScore}%</p>
        <div style="display:flex;gap:10px;justify-content:center">
          <button class="btn btn-ghost" onclick="goHome()">🏠 ${t.home}</button>
          <button class="btn btn-primary" onclick="startReadingText()">🔄 ${t.replay}</button>
        </div>
      </div>
    </div></div>`;
  }

  const item = rs.items[rs.current];
  const hasResult = rs.results.length > rs.current;
  const result = hasResult ? rs.results[rs.current] : null;
  const fb = result ? _getReadingFeedback(result.score, t) : null;

  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t, '📖 ' + (t.readingText || 'Reading'), 'sectionBack()')}
    <div class="quiz-dots">${rs.items.map((_, i) => `<div class="qdot ${i === rs.current ? 'active' : i < rs.current ? (rs.results[i] && rs.results[i].score >= 0.6 ? 'done' : 'wrong') : ''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${rs.current + 1} ${t.of} ${rs.items.length} ${getDiffBadge(AppState.difficulty, t)}</p>
    <p style="color:var(--text-light);margin-bottom:4px">${t.readAloud || 'Read aloud'}</p>
    <div class="reading-text-block" data-speak="${item.ar}">${item.ar}</div>
    <p class="reading-translation">${item.translation}</p>
    <button class="btn btn-secondary btn-sm" data-speak="${item.ar}" style="margin:0 auto 16px;display:flex">🔊 ${t.listenFirst || 'Listen'}</button>
    ${!hasResult ? `
      <button class="mic-btn ${rs.listening ? 'listening' : ''}" id="micBtn" onclick="${rs.listening ? '' : '_startListening()'}">
        ${rs.listening ? '<span class="mic-waves">🎙️</span>' : '🎤'}
      </button>
      <p class="mic-hint">${rs.listening ? (t.listening || 'Listening...') : (t.tapMicToStart || 'Tap the mic')}</p>
      <div id="partialText" class="reading-partial">${rs.partial || ''}</div>
    ` : `
      <div class="speech-result ${fb.cls}">
        <div class="speech-result-stars">${fb.stars}</div>
        <div class="speech-result-score">${Math.round(result.score * 100)}%</div>
        <div class="speech-result-msg">${fb.msg}</div>
        ${result.recognized ? `<div class="speech-result-label">${t.yourPronunciation || 'You said'}:</div><div class="speech-result-text">${result.recognized}</div>` : ''}
      </div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:14px">
        <button class="btn btn-ghost btn-sm" onclick="_readingRetry()">🔄 ${t.replay || 'Retry'}</button>
        <button class="btn btn-primary btn-sm" onclick="_readingNext()">${rs.current < rs.items.length - 1 ? (t.nextText || 'Next') + ' →' : '✅ ' + (t.wellDone || 'Done')}</button>
      </div>
    `}
  </div></div>`;
}

// ==================== TTS MISSING HANDLER ====================

let _ttsMissingShown = false;

function _showTtsMissingHint() {
  if (_ttsMissingShown) return;
  _ttsMissingShown = true;
  const t = AppState.t;
  const ov = document.createElement('div'); ov.className = 'badge-overlay'; ov.id = 'ttsov';
  const pp = document.createElement('div'); pp.className = 'badge-popup'; pp.id = 'ttspp';
  pp.innerHTML = `
    <div style="font-size:2.5rem;margin-bottom:8px">🔇</div>
    <h2 style="margin-bottom:8px">${t.speechNotAvailable || 'Voix arabe non disponible'}</h2>
    <p style="color:var(--text-light);font-size:0.9rem;line-height:1.5;margin-bottom:16px">
      ${AppState.lang === 'fr' ? 'La voix arabe n\'est pas installée sur cet appareil. Installe le pack vocal arabe dans les paramètres.' :
        AppState.lang === 'es' ? 'La voz árabe no está instalada. Instala el paquete de voz árabe en ajustes.' :
        AppState.lang === 'de' ? 'Arabische Stimme nicht installiert. Installiere das arabische Sprachpaket in den Einstellungen.' :
        'Arabic voice is not installed on this device. Install the Arabic voice pack in your settings.'}
    </p>
    <button class="btn btn-primary" style="width:100%;margin-bottom:8px" onclick="_openTtsSettings()">
      ⚙️ ${AppState.lang === 'fr' ? 'Ouvrir les paramètres' : AppState.lang === 'es' ? 'Abrir ajustes' : AppState.lang === 'de' ? 'Einstellungen öffnen' : 'Open Settings'}
    </button>
    <button class="btn btn-ghost" style="width:100%" onclick="_closeTtsHint()">
      ${t.back || 'OK'}
    </button>`;
  document.body.appendChild(ov); document.body.appendChild(pp);
  ov.onclick = _closeTtsHint;
}

function _closeTtsHint() {
  ['ttsov', 'ttspp'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
}

function _openTtsSettings() {
  _closeTtsHint();
  try { if (typeof Android !== 'undefined') Android.openTtsSettings(); } catch(e) {}
}

// Called from Android when TTS init detects missing Arabic. Fires on any
// screen, with a small delay so cinematic/splash slides have time to play.
window.onTtsStatus = function(available) {
  if (!available) {
    setTimeout(_showTtsMissingHint, 2500);
  }
};

// ==================== QUIZ ODD-ONE-OUT (🆎 Trouve l'intrus) ====================
function startQuizOddOneOut() {
  const diff = DIFFICULTY[AppState.difficulty || 'normal'];
  const catKeys = (diff.catKeys || Object.keys(WORD_CATEGORIES).filter(k => !WORD_CATEGORIES[k].hidden))
    .filter(k => WORD_CATEGORIES[k].words.length >= 3);
  if (catKeys.length < 2) return;
  const questions = [];
  for (let i = 0; i < diff.questionCount; i++) {
    const mainCat = catKeys[Math.floor(Math.random() * catKeys.length)];
    const otherPool = catKeys.filter(c => c !== mainCat);
    const otherCat = otherPool[Math.floor(Math.random() * otherPool.length)];
    const mainWords = shuffle(WORD_CATEGORIES[mainCat].words.slice()).slice(0, 3);
    const intruder = shuffle(WORD_CATEGORIES[otherCat].words.slice())[0];
    const options = shuffle([
      ...mainWords.map(w => ({ label: w.ar, emoji: w.emoji, tr: w[AppState.lang] || w.en, correct: false })),
      { label: intruder.ar, emoji: intruder.emoji, tr: intruder[AppState.lang] || intruder.en, correct: true }
    ]);
    questions.push({ mainCat, options });
  }
  AppState.quizData = { type: 'oddOneOut', questions, pts: diff.pts, current: 0, selected: null, results: [], done: false };
  navigate('quizOddOneOut');
}

function renderQuizOddOneOut(t) {
  const qd = AppState.quizData; if (!qd) return renderDashboard(t);
  if (qd.done) return renderQuizResults(t);
  const q = qd.questions[qd.current];
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t, '🆎 ' + (t.quizOddOneOut || 'Odd one out'), 'sectionBack()')}
    <div class="quiz-dots">${qd.questions.map((_,i)=>`<div class="qdot ${i===qd.current?'active':i<qd.current?(qd.results[i]?'done':'wrong'):''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${qd.current+1} ${t.of} ${qd.questions.length}</p>
    <p style="color:var(--text-light);margin-bottom:14px">${t.findTheIntruder || 'Find the odd one out'}</p>
    <div class="qoptions" style="grid-template-columns:repeat(2,1fr);display:grid;gap:10px">
      ${q.options.map((o,i)=>`<button class="qopt ${_optCls(qd,o,i)}" style="flex-direction:column;padding:14px 8px;display:flex;align-items:center;gap:4px" onclick="quizAnswer(${i})">
        <span style="font-size:2.2rem;line-height:1">${o.emoji||'•'}</span>
        <span style="font-family:var(--font-arabic);font-size:1.2rem">${o.label}</span>
      </button>`).join('')}
    </div>
    ${qd.selected!==null?`<div class="qfeedback ${q.options[qd.selected].correct?'correct':'incorrect'}">${q.options[qd.selected].correct?t.correct:t.incorrect}</div>`:''}
  </div></div>`;
}

// ==================== QUIZ COUNTING (🧮 Compter) ====================
function startQuizCounting() {
  const diff = DIFFICULTY[AppState.difficulty || 'normal'];
  const nums = WORD_CATEGORIES.numbers.words.slice(0, 10); // 1..10
  const visualEmojis = ['⭐','🍎','🍌','🐝','🌸','🐠','🍓','🎈','🌟','🦋'];
  const maxN = (AppState.difficulty === 'toddler') ? 5 : 10;
  const questions = [];
  for (let i = 0; i < diff.questionCount; i++) {
    const n = 1 + Math.floor(Math.random() * maxN);
    const correctWord = nums[n - 1];
    const visual = visualEmojis[Math.floor(Math.random() * visualEmojis.length)];
    const wrongs = shuffle(nums.filter((_, idx) => idx !== (n - 1))).slice(0, diff.options - 1);
    const options = shuffle([
      { label: correctWord.ar, correct: true },
      ...wrongs.map(w => ({ label: w.ar, correct: false }))
    ]);
    questions.push({ n, visual, arabic: correctWord.ar, options });
  }
  AppState.quizData = { type: 'counting', questions, pts: diff.pts, current: 0, selected: null, results: [], done: false };
  navigate('quizCounting');
}

function renderQuizCounting(t) {
  const qd = AppState.quizData; if (!qd) return renderDashboard(t);
  if (qd.done) return renderQuizResults(t);
  const q = qd.questions[qd.current];
  const visualsHtml = Array.from({length: q.n}, () => `<span style="font-size:1.8rem;margin:2px;display:inline-block">${q.visual}</span>`).join('');
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t, '🧮 ' + (t.quizCounting || 'Counting'), 'sectionBack()')}
    <div class="quiz-dots">${qd.questions.map((_,i)=>`<div class="qdot ${i===qd.current?'active':i<qd.current?(qd.results[i]?'done':'wrong'):''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${qd.current+1} ${t.of} ${qd.questions.length}</p>
    <p style="color:var(--text-light);margin-bottom:8px">${t.howMany || 'How many?'}</p>
    <div style="background:rgba(0,0,0,0.04);border-radius:14px;padding:18px;margin-bottom:14px;text-align:center;line-height:1.7">${visualsHtml}</div>
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${_optCls(qd,o,i)}" style="font-family:var(--font-arabic);font-size:1.3rem" onclick="quizAnswer(${i})">${o.label}</button>`).join('')}</div>
    ${qd.selected!==null?`<div class="qfeedback ${q.options[qd.selected].correct?'correct':'incorrect'}">${q.options[qd.selected].correct?t.correct:t.incorrect}</div>`:''}
  </div></div>`;
}

// ==================== ANAGRAM (🅰️ Anagramme) ====================
function startAnagram() {
  const diff = DIFFICULTY[AppState.difficulty || 'normal'];
  const stripH = s => (s||'').replace(/[ً-ْٰ]/g, '');
  const sourceWords = diff.catKeys ? diff.catKeys.flatMap(k => WORD_CATEGORIES[k].words) : getAllWords();
  const candidates = sourceWords.filter(w => {
    const bare = stripH(w.ar).replace(/\s/g, '');
    return bare.length >= 3 && bare.length <= 6;
  });
  if (!candidates.length) return;
  const picked = shuffle(candidates.slice()).slice(0, diff.questionCount);
  const questions = picked.map(w => {
    const bare = stripH(w.ar).replace(/\s/g, '');
    const letters = bare.split('');
    let shuffled = shuffle(letters.slice());
    if (shuffled.join('') === bare && letters.length > 1) shuffled.reverse();
    return { word: bare, letters, shuffled, emoji: w.emoji, tr: w[AppState.lang] || w.en, ar: w.ar };
  });
  AppState.quizData = { type: 'anagram', questions, pts: diff.pts, current: 0, picked: [], results: [], done: false };
  navigate('anagram');
}

function anagramTap(i) {
  const qd = AppState.quizData; if (!qd || qd.done) return;
  if (qd.results.length > qd.current) return; // current already evaluated
  if (qd.picked.indexOf(i) >= 0) return;
  qd.picked.push(i);
  AudioSystem.playSound('click');
  const q = qd.questions[qd.current];
  if (qd.picked.length === q.letters.length) {
    const built = qd.picked.map(idx => q.shuffled[idx]).join('');
    const ok = built === q.word;
    qd.results.push(ok);
    if (ok) { AudioSystem.playSound('correct'); addScore(qd.pts||10); setTimeout(()=>AudioSystem.speakArabic(q.ar), 200); }
    else AudioSystem.playSound('wrong');
    render();
    setTimeout(() => {
      if (qd.current < qd.questions.length - 1) { qd.current++; qd.picked = []; render(); }
      else { qd.done = true; addQuiz(); if (qd.results.every(r=>r)) awardBadge('perfectQuiz'); awardBadge('first_anagram'); showConfetti(); render(); }
    }, 1500);
  } else { render(); }
}

function anagramUndo() {
  const qd = AppState.quizData;
  if (qd && qd.picked.length > 0 && qd.results.length === qd.current) { qd.picked.pop(); render(); }
}

function renderAnagram(t) {
  const qd = AppState.quizData; if (!qd) return renderDashboard(t);
  if (qd.done) return renderQuizResults(t);
  const q = qd.questions[qd.current];
  const builtChars = qd.picked.map(idx => q.shuffled[idx]).join('');
  const isFull = qd.picked.length === q.letters.length;
  const ok = isFull && builtChars === q.word;
  const builtColor = isFull ? (ok ? 'color:#34D399' : 'color:#FB7185') : '';
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t, '🅰️ ' + (t.quizAnagram || 'Anagram'), 'sectionBack()')}
    <div class="quiz-dots">${qd.questions.map((_,i)=>`<div class="qdot ${i===qd.current?'active':i<qd.current?(qd.results[i]?'done':'wrong'):''}"></div>`).join('')}</div>
    <p class="qq">${t.questionOf} ${qd.current+1} ${t.of} ${qd.questions.length}</p>
    <div style="text-align:center;margin:10px 0 16px">
      <div style="font-size:3.2rem;line-height:1">${q.emoji||'❓'}</div>
      <div style="color:var(--text-light);font-size:0.95rem;margin-top:4px">${q.tr}</div>
    </div>
    <div dir="rtl" style="background:rgba(0,0,0,0.05);border-radius:14px;padding:18px;margin-bottom:14px;min-height:64px;font-family:var(--font-arabic);font-size:2rem;letter-spacing:8px;text-align:center;${builtColor}">${builtChars||'<span style="opacity:0.3">'+q.shuffled.map(()=>'·').join(' ')+'</span>'}</div>
    <div dir="rtl" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:14px">
      ${q.shuffled.map((c,i)=>`<button class="qopt ${qd.picked.indexOf(i)>=0?'dis':''}" style="font-family:var(--font-arabic);font-size:1.8rem;padding:8px 14px;min-width:54px" onclick="anagramTap(${i})" ${qd.picked.indexOf(i)>=0?'disabled':''}>${c}</button>`).join('')}
    </div>
    <div style="text-align:center"><button class="btn btn-ghost btn-sm" onclick="anagramUndo()" ${qd.picked.length===0||isFull?'disabled style="opacity:0.4"':''}>← ${t.anagramUndo || 'Undo'}</button></div>
  </div></div>`;
}

// ==================== FALLING LETTERS (🎯 mini-jeu) ====================
// Game loop: spawns a new letter every spawnInterval ms, falls top→bottom in
// fallDuration ms. The audio prompt names one specific "target" letter on
// screen. Tap the right one before it hits the bottom: score++. Wrong tap or
// letting the target hit bottom: life--. Game ends at 0 lives.
var fallingState = null;
function startFallingLetters() {
  if (fallingState && fallingState.timerId) clearInterval(fallingState.timerId);
  const diff = DIFFICULTY[AppState.difficulty || 'normal'];
  const pool = ALPHABET.slice(0, diff.letterCount).map(L => L.l);
  fallingState = {
    pool, active: [], lastSpawn: 0,
    spawnInterval: 1700, fallDuration: 5200,
    target: null, hits: 0, misses: 0, lives: 3,
    streak: 0, // consecutive hits (resets on any miss) — feeds falling_streak badge
    timerId: null, done: false
  };
  AppState.quizData = { type: 'fallingLetters', pts: diff.pts, results: [], done: false };
  navigate('fallingLetters');
  // Kick off the loop after DOM is in place.
  setTimeout(function(){
    if (!fallingState) return;
    fallingState.timerId = setInterval(_fallingTick, 80);
    _fallingTick();
  }, 80);
}

function _fallingTick() {
  const fs = fallingState; if (!fs || fs.done) return;
  const now = Date.now();
  // Spawn
  if (now - fs.lastSpawn > fs.spawnInterval && fs.active.length < 4) {
    const letter = fs.pool[Math.floor(Math.random() * fs.pool.length)];
    const x = 8 + Math.random() * 78;
    fs.active.push({ id: now + Math.random(), letter, x, spawnAt: now });
    fs.lastSpawn = now;
  }
  // Despawn (bottom)
  const survivors = [];
  fs.active.forEach(a => {
    const pct = (now - a.spawnAt) / fs.fallDuration;
    if (pct >= 1) {
      if (fs.target && a.id === fs.target.id) {
        fs.lives--; fs.misses++; fs.streak = 0; AudioSystem.playSound('wrong'); fs.target = null;
      }
    } else { survivors.push(a); }
  });
  fs.active = survivors;
  if (!fs.target && fs.active.length > 0) _fallingPickTarget();
  if (fs.lives <= 0) { _fallingEnd(); return; }
  _fallingRenderActive();
}

function _fallingPickTarget() {
  const fs = fallingState; if (!fs) return;
  // Prefer letters in the upper 60% of their fall (room to react).
  const now = Date.now();
  const fresh = fs.active.filter(a => (now - a.spawnAt) / fs.fallDuration < 0.55);
  fs.target = fresh.length ? fresh[Math.floor(Math.random()*fresh.length)]
                           : fs.active[Math.floor(Math.random()*fs.active.length)];
  if (fs.target) setTimeout(() => { if (fallingState && fallingState.target && fallingState.target.id === fs.target.id) AudioSystem.speakArabic(fs.target.letter); }, 150);
}

function fallingTap(id) {
  const fs = fallingState; if (!fs || fs.done) return;
  const a = fs.active.find(x => x.id === id); if (!a) return;
  if (fs.target && fs.target.id === id) {
    fs.hits++; fs.streak++; addScore(AppState.quizData.pts || 10);
    if (fs.streak === 10) awardBadge('falling_streak');
    AudioSystem.playSound('correct');
    fs.active = fs.active.filter(x => x.id !== id);
    fs.target = null;
    _fallingPickTarget();
  } else {
    fs.misses++; fs.lives--; fs.streak = 0;
    AudioSystem.playSound('wrong');
    if (fs.lives <= 0) { _fallingEnd(); return; }
  }
  _fallingRenderActive();
}

function _fallingRenderActive() {
  const fs = fallingState; if (!fs) return;
  const cont = document.getElementById('fallingArea'); if (!cont) return;
  const now = Date.now();
  const lives = document.getElementById('fallingLives'); if (lives) lives.textContent = '❤️'.repeat(Math.max(0, fs.lives));
  const score = document.getElementById('fallingScore'); if (score) score.textContent = fs.hits;
  cont.innerHTML = fs.active.map(a => {
    const pct = Math.min(0.96, (now - a.spawnAt) / fs.fallDuration);
    const top = pct * 100;
    const isTarget = fs.target && fs.target.id === a.id;
    return `<button class="falling-letter ${isTarget?'falling-target':''}" style="left:${a.x}%;top:${top}%" onclick="fallingTap(${a.id})">${a.letter}</button>`;
  }).join('');
}

function _fallingEnd() {
  const fs = fallingState; if (!fs) return;
  fs.done = true;
  if (fs.timerId) { clearInterval(fs.timerId); fs.timerId = null; }
  AppState.quizData.done = true;
  // Fake a results array so renderQuizResults can compute pct: hits=correct.
  const total = Math.max(1, fs.hits + fs.misses);
  AppState.quizData.results = Array.from({length: total}, (_,i) => i < fs.hits);
  addQuiz();
  if (fs.hits >= 10) showConfetti();
  render();
}

function renderFallingLetters(t) {
  const fs = fallingState;
  if (fs && fs.done) return renderQuizResults(t);
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}<div class="quiz-c">
    ${secH(t, '🎯 ' + (t.fallingLetters || 'Falling letters'), '_fallingExit()')}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:1.05rem">
      <div id="fallingLives">❤️❤️❤️</div>
      <div style="color:var(--text-light)">${t.score} : <span id="fallingScore" style="color:var(--primary);font-weight:700">0</span></div>
    </div>
    <p style="color:var(--text-light);text-align:center;margin-bottom:8px;font-size:0.95rem">${t.fallingPrompt || 'Tap the letter you hear'}</p>
    <div id="fallingArea" class="falling-area"></div>
  </div></div>`;
}

function _fallingExit() {
  if (fallingState && fallingState.timerId) { clearInterval(fallingState.timerId); fallingState.timerId = null; }
  fallingState = null;
  sectionBack();
}

// ==================== PARENT DASHBOARD ====================
// Read-only summary view across all local children. Code-gated entry via the
// 👪 nav button → _parentGate (code of the active child) → renders stat cards
// per profile. Tap a card to drill into per-letter mastery, visited categories
// and unlocked badges. The active session is left untouched.
function openParentDashboard() {
  if (!AppState.user) { AppState._parentProfile = null; navigate('parentDashboard'); return; }
  _parentGate(AppState.t.parentDashTitle || 'Parent dashboard', function() {
    AppState._parentProfile = null;
    navigate('parentDashboard');
  });
}

function _readProfile(name) {
  try { const raw = localStorage.getItem('ak_' + name); if (raw) return JSON.parse(raw); } catch(e) {}
  return null;
}

function _formatLastActive(ts, t) {
  if (!ts) return '—';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return t.parentToday || 'today';
  if (days === 1) return t.parentYesterday || 'yesterday';
  return (t.parentDaysAgo || '{n} days ago').replace('{n}', days);
}

function _openChildDetail(name) { AppState._parentProfile = name; navigate('parentChildDetail'); }
function _backToParentDash() { AppState._parentProfile = null; navigate('parentDashboard'); }

function renderParentDashboard(t) {
  const profiles = listLocalProfiles();
  if (!profiles.length) {
    return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}
      ${secH(t, '👪 ' + (t.parentDashTitle || 'Parent dashboard'), 'goHome()')}
      <p style="text-align:center;color:var(--text-light);margin-top:40px">${t.parentNoProfiles || 'No profiles on this device'}</p>
    </div>`;
  }
  const cards = profiles.map(p => {
    const data = _readProfile(p.name) || {};
    const lettersLearned = (data.learnedLetters || []).length;
    const badges = (data.earnedBadges || []).length;
    const cats = (data.visitedCategories || []).length;
    const streak = data.streak ? (data.streak.current || 0) : 0;
    const last = data.streak ? data.streak.lastActive : null;
    const safe = (p.name||'').replace(/'/g,"\\'");
    return `<div class="parent-card" onclick="_openChildDetail('${safe}')">
      <div class="parent-card-head">
        <div class="parent-avatar">${p.avatar}</div>
        <div>
          <div class="parent-name">${p.name}</div>
          <div class="parent-meta">${t.level} ${p.level||1} · ⭐ ${p.score||0}</div>
        </div>
      </div>
      <div class="parent-stats-grid">
        <div class="ps"><div class="ps-val">${data.lessons||0}</div><div class="ps-lbl">${t.lessonsCompleted}</div></div>
        <div class="ps"><div class="ps-val">${data.quizzes||0}</div><div class="ps-lbl">${t.quizzesPassed}</div></div>
        <div class="ps"><div class="ps-val">${lettersLearned}/28</div><div class="ps-lbl">${t.alphabet}</div></div>
        <div class="ps"><div class="ps-val">🔥 ${streak}</div><div class="ps-lbl">${t.streakDays||'days'}</div></div>
        <div class="ps"><div class="ps-val">${badges}</div><div class="ps-lbl">${t.badges}</div></div>
        <div class="ps"><div class="ps-val">${cats}</div><div class="ps-lbl">${t.parentCategories||'Cats'}</div></div>
      </div>
      <div class="parent-last">${t.parentLastActive||'Last active'} : ${_formatLastActive(last, t)}</div>
    </div>`;
  }).join('');
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}
    ${secH(t, '👪 ' + (t.parentDashTitle || 'Parent dashboard'), 'goHome()')}
    <p style="text-align:center;color:var(--text-light);margin-bottom:14px;font-size:0.92rem">${t.parentTapForDetails || 'Tap a card for details'}</p>
    <div class="parent-grid">${cards}</div>
  </div>`;
}

function renderParentChildDetail(t) {
  const name = AppState._parentProfile;
  if (!name) return renderParentDashboard(t);
  const data = _readProfile(name);
  if (!data) return renderParentDashboard(t);
  const avatar = (data.user && data.user.avatar) || '👶';
  const stats = data.learnedLetters || [];
  const ls = data.letterStats || {};
  // Star rule: total interactions per letter (views + listens + huntWins).
  // 1+ → ⭐, 5+ → ⭐⭐, 10+ → ⭐⭐⭐ — cheap mastery proxy without timestamps.
  const letterRows = stats.length ? stats.map(L => {
    const s = ls[L] || {};
    const total = (s.views||0) + (s.listens||0) + (s.huntWins||0);
    const stars = total >= 10 ? '⭐⭐⭐' : total >= 5 ? '⭐⭐' : total >= 1 ? '⭐' : '☆';
    return `<div class="parent-letter-row"><span class="plr-l">${L}</span><span class="plr-s">${stars}</span><span class="plr-c">${total}</span></div>`;
  }).join('') : `<p style="color:var(--text-light);text-align:center;padding:14px">${t.parentNoLetters || 'No letters yet'}</p>`;
  const cats = (data.visitedCategories || []).map(c => `<span class="parent-cat-chip">${(WORD_CATEGORIES[c]||{}).emoji||'•'} ${t[c]||c}</span>`).join(' ') || '<span style="color:var(--text-light)">—</span>';
  const badges = (data.earnedBadges || []).map(id => {
    const b = BADGE_DEFINITIONS.find(x => x.id === id);
    return b ? `<span class="parent-badge-chip" title="${(b.name[AppState.lang]||b.name.en||id).replace(/"/g,'&quot;')}">${b.emoji}</span>` : '';
  }).join(' ') || '<span style="color:var(--text-light)">—</span>';
  const streak = data.streak || {};
  // Items the child got wrong and hasn't yet re-mastered (spaced review deck).
  const weak = Object.keys(data.review || {}).map(k => k.slice(2));
  const weakRow = weak.length
    ? weak.map(x => `<span class="parent-cat-chip" style="font-family:var(--font-arabic);font-size:1.1rem">${x}</span>`).join(' ')
    : '<span style="color:var(--text-light)">—</span>';
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}
    ${secH(t, avatar+' '+name, '_backToParentDash()')}
    <div class="parent-section">
      <h3 class="parent-section-title">🔁 ${t.reviewTitle || 'Review'} (${weak.length})</h3>
      <div class="parent-cats-row">${weakRow}</div>
    </div>
    <div class="parent-section">
      <h3 class="parent-section-title">🔥 ${t.streakDays || 'Streak'}</h3>
      <div class="parent-section-body">${(t.streakDays||'Days')} ${streak.current||0} · ${t.longestStreak||'Best'} ${streak.longest||0} · ❄️ ${streak.freezes||0} · ${t.parentLastActive||'Last'} : ${_formatLastActive(streak.lastActive, t)}</div>
    </div>
    <div class="parent-section">
      <h3 class="parent-section-title">${t.alphabet} (${stats.length}/28)</h3>
      <div class="parent-letters-list">${letterRows}</div>
    </div>
    <div class="parent-section">
      <h3 class="parent-section-title">${t.parentCategories || 'Categories'} (${(data.visitedCategories||[]).length})</h3>
      <div class="parent-cats-row">${cats}</div>
    </div>
    <div class="parent-section">
      <h3 class="parent-section-title">${t.badges} (${(data.earnedBadges||[]).length})</h3>
      <div class="parent-badges-row">${badges}</div>
    </div>
  </div>`;
}

// ==================== REMOTE CONFIG (server-driven flags) ====================
// Defaults mirror the hard-coded values in this file. Whenever Firebase Console
// publishes a new Remote Config snapshot, Android calls _onRemoteConfigReady()
// and the new values flow into the runtime — no app update needed.
// Keys currently consumed:
//   - ad_warmup_seconds (long)   → AD_WARMUP_MS
//   - ad_cooldown_seconds (long) → AD_MIN_INTERVAL_MS
//   - interstitial_hidden (bool) → INTERSTITIAL_HIDDEN
//   - quiz_options_normal (long) → read on-demand inside start*Quiz()
//   - daily_emphasis (string)    → read on-demand inside getDailyChallenge()
window._rcReady = false;
function _rc(key, def) {
  if (typeof Android === 'undefined' || !window._rcReady) return def;
  try {
    if (typeof def === 'boolean') return Android.rcGetBoolean(key);
    if (typeof def === 'number')  return Android.rcGetLong(key);
    return Android.rcGetString(key) || def;
  } catch(e) { return def; }
}
window._onRemoteConfigReady = function() {
  window._rcReady = true;
  try {
    AD_WARMUP_MS       = _rc('ad_warmup_seconds', 90) * 1000;
    AD_MIN_INTERVAL_MS = _rc('ad_cooldown_seconds', 120) * 1000;
    INTERSTITIAL_HIDDEN = _rc('interstitial_hidden', true);
    console.log('[RC] applied. warmup=' + AD_WARMUP_MS + ' cooldown=' + AD_MIN_INTERVAL_MS + ' hidden=' + INTERSTITIAL_HIDDEN);
  } catch(e) {}
};

// ==================== CLOUD RECOVERY (auto-discover saved profiles) ====================
// Ask Android for every cloud profile this device's uid has ever saved.
// Anything cloud-side that's missing locally is offered as a one-tap recover.
// Skipped automatically when the user has already responded or when nothing
// is missing — never shown twice per session.
function _maybeOfferCloudRecover() {
  if (window._cloudRecoverChecked) return;
  window._cloudRecoverChecked = true;
  try {
    if (typeof Android !== 'undefined' && Android.cloudListSeenProfiles) {
      // Defer a bit so the initial render is on screen first.
      setTimeout(() => { try { Android.cloudListSeenProfiles(); } catch(e) {} }, 1200);
    }
  } catch(e) {}
}

function _onCloudListSeen(json) {
  if (!json) return;
  let arr; try { arr = JSON.parse(json); } catch(e) { return; }
  if (!arr || !arr.length) return;
  const localNames = listLocalProfiles().map(p => p.name);
  const missing = [];
  for (const item of arr) {
    try {
      const data = JSON.parse(item.state);
      if (data && data.user && data.user.name && localNames.indexOf(data.user.name) < 0) {
        missing.push({ name: data.user.name, avatar: data.user.avatar || '👤', json: item.state });
      }
    } catch(e) {}
  }
  if (!missing.length) return;
  _showCloudRecoverDialog(missing);
}

function _showCloudRecoverDialog(missing) {
  const t = AppState.t;
  AudioSystem.playSound('badge');
  const ov = document.createElement('div'); ov.className = 'badge-overlay'; ov.id = 'cro'; ov.onclick = _closeCloudRecover;
  const pp = document.createElement('div'); pp.className = 'badge-popup'; pp.id = 'crp';
  const list = missing.map((m,i) => `<div class="cloud-rec-item"><span style="font-size:1.6rem">${m.avatar}</span><span style="font-weight:600">${m.name}</span></div>`).join('');
  const headline = (t.cloudRecoverHeadline || 'Found {n} profile(s) in the cloud').replace('{n}', missing.length);
  pp.innerHTML = `<div class="badge-popup-emoji">☁️</div>
    <h2 style="margin-bottom:6px">${t.cloudRecoverTitle || 'Recover profiles?'}</h2>
    <p style="font-size:0.95rem;color:#718096;margin-bottom:10px;line-height:1.4">${headline}</p>
    <div class="cloud-rec-list">${list}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:14px">
      <button class="btn btn-ghost" onclick="_closeCloudRecover()" style="flex:1;min-width:110px">${t.logoutCancel || 'Cancel'}</button>
      <button class="btn btn-primary" onclick="_acceptCloudRecover()" style="flex:1;min-width:110px">⬇️ ${t.cloudRecoverAccept || 'Recover all'}</button>
    </div>`;
  document.body.appendChild(ov); document.body.appendChild(pp);
  window._cloudMissing = missing;
}
function _closeCloudRecover() { ['cro','crp'].forEach(id=>{const e=document.getElementById(id);if(e)e.remove();}); window._cloudMissing=null; }
function _acceptCloudRecover() {
  const list = window._cloudMissing || [];
  for (const m of list) {
    try { localStorage.setItem('ak_' + m.name, m.json); } catch(e) {}
  }
  _closeCloudRecover();
  // If we're on the welcome picker, refresh it so the new profiles appear.
  if (AppState.screen === 'welcome') render();
}

// ==================== PROFILE RESET ====================
// Clear per-child progress before loading / creating a profile. Without this,
// fields missing from an older saved profile (streak, letterStats, review…)
// silently inherit the previously active child's values.
function _resetProgress() {
  Object.assign(AppState, {
    score: 0, level: 1, lessons: 0, quizzes: 0,
    learnedLetters: [], earnedBadges: [], visitedCategories: [], ratingDone: false,
    difficulty: 'normal', premium: false,
    streak: { current: 0, longest: 0, lastActive: null, freezes: 0 },
    dailyDone: null, letterStats: {}, review: {}, skillsDone: [], _pathCompletedShown: false,
    dailyReviewDay: null, dailyIsReview: false
  });
}

// ==================== SPACED REVIEW (Leitner) ====================
// Every wrong answer on a letter or word enters the review deck (box 0, due
// today). Answering it right once it is due moves it up a box and pushes the
// next review further out; after the last box the item leaves the deck.
// Correct answers before the due date don't count — spacing is the point.
var _REVIEW_GAPS = [1, 3, 7];                 // days before the next review, per box reached
var _REVIEW_LETTER_TYPES = { letters: 1, positions: 1, forms: 1, twins: 1, syllables: 1 };
var _REVIEW_WORD_TYPES = { words: 1, audio: 1, listen: 1, categories: 1, firstLetter: 1, blend: 1 };

function _reviewKey(qd, q) {
  if (q.reviewKey) return q.reviewKey;
  if (_REVIEW_LETTER_TYPES[qd.type] && q.letter) return 'L:' + q.letter;
  if (_REVIEW_WORD_TYPES[qd.type] && q.arabic) return 'W:' + q.arabic;
  return null;
}

function _addDays(n) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); }

function _reviewRecord(key, ok) {
  if (!key) return;
  if (!AppState.review) AppState.review = {};
  var r = AppState.review[key];
  if (!ok) { AppState.review[key] = { b: 0, due: _todayStr() }; return; }
  if (!r || r.due > _todayStr()) return;
  if (r.b >= _REVIEW_GAPS.length) { delete AppState.review[key]; return; }
  AppState.review[key] = { b: r.b + 1, due: _addDays(_REVIEW_GAPS[r.b]) };
}

function _reviewItem(key) {
  var v = key.slice(2);
  if (key[0] === 'L') { var l = ALPHABET.find(function(a) { return a.l === v; }); return l ? { kind: 'L', letter: l } : null; }
  var w = getAllWords().find(function(x) { return x.ar === v; });
  return w ? { kind: 'W', word: w } : null;
}

function reviewDueKeys() {
  var today = _todayStr(), rv = AppState.review || {};
  return Object.keys(rv)
    .filter(function(k) { return rv[k].due <= today && _reviewItem(k); })
    .sort(function(a, b) { return rv[a].b - rv[b].b || (rv[a].due < rv[b].due ? -1 : 1); });
}
function reviewDueCount() { return reviewDueKeys().length; }

function renderReviewCard(t) {
  var n = reviewDueCount();
  if (!n || getDailyChallenge().type === 'review') return '';
  return '<div class="daily-card review-card">' +
    '<div class="daily-head">🔁 <strong>' + (t.reviewTitle || 'Review') + '</strong></div>' +
    '<div class="daily-body">' + (t.reviewDue || '{n} to review').replace('{n}', n) + '</div>' +
    '<button class="btn btn-primary btn-sm" onclick="startReview()">▶ ' + (t.letsStart || 'Go') + '</button>' +
  '</div>';
}

function startReview() {
  var diff = DIFFICULTY[AppState.difficulty || 'normal'];
  var keys = reviewDueKeys().slice(0, Math.max(diff.questionCount, 5));
  if (!keys.length) { _showReviewEmpty(); return; }
  var lang = AppState.lang;
  var questions = keys.map(function(k) {
    var it = _reviewItem(k);
    if (it.kind === 'L') {
      var others = shuffle(ALPHABET.filter(function(a) { return a.l !== it.letter.l; })).slice(0, diff.options - 1);
      return { reviewKey: k, kind: 'L', letter: it.letter.l, speak: it.letter.l,
        options: shuffle([{ label: it.letter.n, correct: true }].concat(others.map(function(o) { return { label: o.n, correct: false }; }))) };
    }
    var w = it.word, all = getAllWords(), seen = {}, opts = [];
    seen[w.emoji] = 1;
    shuffle(all.filter(function(x) { return x.ar !== w.ar; })).forEach(function(x) {
      if (opts.length < diff.options - 1 && !seen[x.emoji]) { seen[x.emoji] = 1; opts.push(x); }
    });
    return { reviewKey: k, kind: 'W', arabic: w.ar, speak: w.ar,
      options: shuffle([{ label: w[lang], emoji: w.emoji, correct: true }].concat(opts.map(function(o) { return { label: o[lang], emoji: o.emoji, correct: false }; }))) };
  });
  AppState.quizData = { type: 'review', pts: diff.pts, autoSpeak: true, questions: questions, current: 0, selected: null, results: [], done: false };
  navigate('quizReview');
  setTimeout(function() { AudioSystem.speakArabic(questions[0].speak); }, 400);
}

function _showReviewEmpty() {
  var t = AppState.t;
  document.body.insertAdjacentHTML('beforeend',
    '<div class="badge-overlay" id="rvo" onclick="_closeReviewEmpty()"></div>' +
    '<div class="badge-popup" id="rvp"><div class="badge-popup-emoji">🎉</div>' +
    '<p style="font-size:1.1rem;font-weight:600;margin:8px 0 16px">' + (t.reviewEmpty || 'Nothing to review — great job!') + '</p>' +
    '<button class="btn btn-primary" onclick="_closeReviewEmpty()">OK</button></div>');
}
function _closeReviewEmpty() { ['rvo', 'rvp'].forEach(function(id) { var e = document.getElementById(id); if (e) e.remove(); }); }

function _quizDots(qd) {
  return '<div class="quiz-dots">' + qd.questions.map(function(_, i) {
    return '<div class="qdot ' + (i === qd.current ? 'active' : i < qd.current ? (qd.results[i] ? 'done' : 'wrong') : '') + '"></div>';
  }).join('') + '</div>';
}

function _quizFeedback(qd, q, t, extra) {
  if (qd.selected === null) return '';
  var ok = q.options[qd.selected].correct;
  return '<div class="qfeedback ' + (ok ? 'correct' : 'incorrect') + '">' + (ok ? t.correct : t.incorrect) + (extra || '') + '</div>';
}

function renderQuizReview(t) {
  var qd = AppState.quizData; if (!qd) return renderDashboard(t);
  if (qd.done) return renderQuizResults(t);
  var q = qd.questions[qd.current];
  var prompt = q.kind === 'L'
    ? '<div class="qprompt" data-speak="' + q.speak + '">' + q.letter + '</div>'
    : '<div class="qprompt" data-speak="' + q.speak + '">' + q.arabic + '</div>';
  return '<div class="bg-deco"></div><div class="app page-in">' + navHTML(t) + '<div class="quiz-c">' +
    secH(t, '🔁 ' + (t.reviewTitle || 'Review'), 'sectionBack()') + _quizDots(qd) +
    '<p class="qq">' + t.questionOf + ' ' + (qd.current + 1) + ' ' + t.of + ' ' + qd.questions.length + '</p>' +
    prompt +
    '<button class="btn btn-secondary btn-sm" data-speak="' + q.speak + '" style="margin:0 auto 12px;display:flex">🔊 ' + t.listen + '</button>' +
    '<div class="qoptions">' + q.options.map(function(o, i) {
      return '<button class="qopt ' + _optCls(qd, o, i) + '" onclick="quizAnswer(' + i + ')">' + (o.emoji ? o.emoji + ' ' : '') + o.label + '</button>';
    }).join('') + '</div>' + _quizFeedback(qd, q, t) +
  '</div></div>';
}

// Option state after an answer: the tapped one turns green/red and, on a
// mistake, the right answer is revealed so the child learns from the error.
function _optCls(qd, o, i) {
  if (qd.selected === null) return '';
  if (qd.selected === i) return o.correct ? 'correct' : 'incorrect';
  return o.correct ? 'dis reveal' : 'dis';
}

// Letters the child has validated (plus letters pending review), or the
// difficulty's default slice when too few are known to build a quiz — quizzes
// test what was taught instead of all 28 letters.
function _practiceLetters(min) {
  var diff = DIFFICULTY[AppState.difficulty || 'normal'];
  var rv = AppState.review || {};
  var learned = ALPHABET.filter(function(a) { return (AppState.learnedLetters || []).includes(a.l) || rv['L:' + a.l]; });
  return learned.length >= min ? learned : ALPHABET.slice(0, diff.letterCount);
}

// ==================== QUIZ TWIN LETTERS ====================
// Look-alike letters that differ only by dots (ب ت ث ن) or by a sound close
// to another (س ش). Hear one, pick it among its family — trains attention to
// dots, the #1 reading confusion for young learners.
var TWIN_FAMILIES = [
  ['ب', 'ت', 'ث', 'ن'], ['ج', 'ح', 'خ'], ['د', 'ذ'], ['ر', 'ز'], ['س', 'ش'],
  ['ص', 'ض'], ['ط', 'ظ'], ['ع', 'غ'], ['ف', 'ق']
];
function _twinFamily(l) {
  return TWIN_FAMILIES.find(function(f) { return f.indexOf(l) >= 0; }) || [];
}

function startQuizTwins() {
  var diff = DIFFICULTY[AppState.difficulty || 'normal'];
  var allowed = ALPHABET.slice(0, diff.letterCount).map(function(a) { return a.l; });
  var fams = TWIN_FAMILIES
    .map(function(f) { return f.filter(function(l) { return allowed.indexOf(l) >= 0; }).slice(0, Math.max(diff.options, 2)); })
    .filter(function(f) { return f.length >= 2; });
  var learned = AppState.learnedLetters || [];
  // Favour families containing letters the child has already learned.
  var ordered = shuffle(fams).sort(function(a, b) {
    return b.filter(function(l) { return learned.includes(l); }).length - a.filter(function(l) { return learned.includes(l); }).length;
  });
  var questions = [];
  for (var i = 0; i < diff.questionCount; i++) {
    var fam = ordered[i % ordered.length];
    var target = fam[Math.floor(Math.random() * fam.length)];
    var info = ALPHABET.find(function(a) { return a.l === target; });
    questions.push({ letter: target, speak: target, name: info.na + ' — ' + info.n,
      options: shuffle(fam.map(function(l) { return { label: l, correct: l === target }; })) });
  }
  AppState.quizData = { type: 'twins', pts: diff.pts, autoSpeak: true, questions: shuffle(questions), current: 0, selected: null, results: [], done: false };
  navigate('quizTwins');
  setTimeout(function() { AudioSystem.speakArabic(AppState.quizData.questions[0].speak); }, 400);
}

function renderQuizTwins(t) {
  var qd = AppState.quizData; if (!qd) return renderDashboard(t);
  if (qd.done) return renderQuizResults(t);
  var q = qd.questions[qd.current];
  return '<div class="bg-deco"></div><div class="app page-in">' + navHTML(t) + '<div class="quiz-c">' +
    secH(t, '👯 ' + (t.quizTwins || 'Twin letters'), 'sectionBack()') + _quizDots(qd) +
    '<p class="qq">' + t.questionOf + ' ' + (qd.current + 1) + ' ' + t.of + ' ' + qd.questions.length + ' ' + getDiffBadge(AppState.difficulty, t) + '</p>' +
    '<p style="color:var(--light);margin-bottom:8px">' + (t.twinsPrompt || 'Look at the dots! Tap the letter you hear') + '</p>' +
    '<button class="btn btn-primary" data-speak="' + q.speak + '" style="margin:0 auto 16px;display:flex;font-size:2rem;padding:14px 28px">🔊</button>' +
    '<div class="qoptions">' + q.options.map(function(o, i) {
      return '<button class="qopt ' + _optCls(qd, o, i) + '" style="font-family:var(--font-arabic);font-size:3rem" onclick="quizAnswer(' + i + ')">' + o.label + '</button>';
    }).join('') + '</div>' +
    _quizFeedback(qd, q, t, ' <span style="font-family:var(--font-arabic)">' + q.name + '</span>') +
  '</div></div>';
}

// ==================== SOUND QUIZZES (decoding) ====================
// One engine for "hear a sound, tap how it is written": short-vowel syllables,
// long vowels (madd) and tanwin. Each builder returns the correct {label, speak}
// and distractor labels for one letter; the engine dedupes and shuffles.
var _SHORT_VOWELS = ['َ', 'ُ', 'ِ'];
var _TANWINS = ['ً', 'ٌ', 'ٍ'];
var _MADD = { 'َ': 'ا', 'ُ': 'و', 'ِ': 'ي' };
function _longSyl(l, v) { return l + v + _MADD[v]; }
function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

var SOUND_QUIZZES = {
  // Even questions: vowel discrimination (بَ / بُ / بِ). Odd: consonant
  // discrimination with the same vowel, look-alike letters first (بَ / تَ / ثَ).
  syllables: { screen: 'quizSyllables', icon: '🗣️', title: 'quizSyllables', prompt: 'syllablesPrompt',
    build: function(l, qi) {
      var v = _pick(_SHORT_VOWELS);
      if (qi % 2 === 0) return { label: l + v, speak: l + v, others: _SHORT_VOWELS.filter(function(x) { return x !== v; }).map(function(x) { return l + x; }) };
      var fam = _twinFamily(l);
      var cands = shuffle(ALPHABET.filter(function(a) { return a.l !== l && a.l !== 'أ'; }));
      cands.sort(function(a, b) { return (fam.indexOf(b.l) >= 0) - (fam.indexOf(a.l) >= 0); });
      return { label: l + v, speak: l + v, others: cands.map(function(a) { return a.l + v; }) };
    } },
  // Short vs long of the same vowel first (بَ / بَا), then the three longs (بَا / بُو / بِي).
  long: { screen: 'quizLong', icon: '🐍', title: 'quizLong', prompt: 'longPrompt',
    build: function(l, qi) {
      var v = _pick(_SHORT_VOWELS);
      var isLong = qi % 2 === 0 || Math.random() < 0.5;
      if (qi % 2 === 0) {
        var shortS = l + v, longS = _longSyl(l, v);
        var other = _longSyl(l, _pick(_SHORT_VOWELS.filter(function(x) { return x !== v; })));
        return isLong ? { label: longS, speak: longS, others: [shortS, other] }
                      : { label: shortS, speak: shortS, others: [longS, other] };
      }
      return { label: _longSyl(l, v), speak: _longSyl(l, v),
        others: _SHORT_VOWELS.filter(function(x) { return x !== v; }).map(function(x) { return _longSyl(l, x); }) };
    } },
  // The three tanwins (بً / بٌ / بٍ), or a tanwin against its plain vowel (بُ / بٌ).
  tanwin: { screen: 'quizTanwin', icon: '✨', title: 'quizTanwin', prompt: 'tanwinPrompt',
    build: function(l, qi) {
      var k = Math.floor(Math.random() * 3), tw = _TANWINS[k], sv = _SHORT_VOWELS[k];
      var target = { label: l + tw, speak: harakaSpeakable(l, tw) };
      if (qi % 2 === 0) target.others = _TANWINS.filter(function(x) { return x !== tw; }).map(function(x) { return l + x; });
      else if (Math.random() < 0.5) target.others = [l + sv, l + _TANWINS[(k + 1) % 3]];
      else return { label: l + sv, speak: l + sv, others: [l + tw, l + _SHORT_VOWELS[(k + 1) % 3]] };
      return target;
    } }
};

function _startSoundQuiz(type) {
  var cfg = SOUND_QUIZZES[type];
  var diff = DIFFICULTY[AppState.difficulty || 'normal'];
  var pool = _practiceLetters(3).filter(function(a) { return a.l !== 'أ'; });
  if (pool.length < 3) pool = ALPHABET.slice(1, 11);
  var nOpts = Math.min(diff.options, 3);
  var picked = shuffle(pool).slice(0, diff.questionCount);
  while (picked.length < diff.questionCount) picked.push(_pick(pool));
  var questions = picked.map(function(letter, qi) {
    var b = cfg.build(letter.l, qi);
    var others = [];
    b.others.forEach(function(o) { if (o !== b.label && others.indexOf(o) < 0 && others.length < nOpts - 1) others.push(o); });
    return { letter: letter.l, combined: b.label, speak: b.speak,
      options: shuffle([{ label: b.label, correct: true }].concat(others.map(function(o) { return { label: o, correct: false }; }))) };
  });
  AppState.quizData = { type: type, pts: diff.pts, autoSpeak: true, questions: questions, current: 0, selected: null, results: [], done: false };
  navigate(cfg.screen);
  setTimeout(function() { AudioSystem.speakArabic(questions[0].speak); }, 400);
}
function startQuizSyllables() { _startSoundQuiz('syllables'); }
function startQuizLong() { _startSoundQuiz('long'); }
function startQuizTanwin() { _startSoundQuiz('tanwin'); }

function renderSoundQuiz(t) {
  var qd = AppState.quizData; if (!qd) return renderDashboard(t);
  if (qd.done) return renderQuizResults(t);
  var cfg = SOUND_QUIZZES[qd.type];
  var q = qd.questions[qd.current];
  return '<div class="bg-deco"></div><div class="app page-in">' + navHTML(t) + '<div class="quiz-c">' +
    secH(t, cfg.icon + ' ' + (t[cfg.title] || qd.type), 'sectionBack()') + _quizDots(qd) +
    '<p class="qq">' + t.questionOf + ' ' + (qd.current + 1) + ' ' + t.of + ' ' + qd.questions.length + ' ' + getDiffBadge(AppState.difficulty, t) + '</p>' +
    '<p style="color:var(--light);margin-bottom:8px">' + (t[cfg.prompt] || '') + '</p>' +
    '<button class="btn btn-primary" data-speak="' + q.speak + '" style="margin:0 auto 16px;display:flex;font-size:2rem;padding:14px 28px">🔊</button>' +
    '<div class="qoptions">' + q.options.map(function(o, i) {
      return '<button class="qopt ' + _optCls(qd, o, i) + '" style="font-family:var(--font-arabic);font-size:2.6rem;direction:rtl" onclick="quizAnswer(' + i + ')">' + o.label + '</button>';
    }).join('') + '</div>' +
    _quizFeedback(qd, q, t, ' <span style="font-family:var(--font-arabic);font-size:1.3rem">' + q.combined + '</span>') +
  '</div></div>';
}

// ==================== GUIDED READING (blending) ====================
// The child taps each syllable in reading order (right → left) and hears it,
// then the syllables merge into the whole word, which is spoken; finally the
// child picks the matching picture — decoding first, then meaning.
function startBlend() {
  var diff = DIFFICULTY[AppState.difficulty || 'normal'];
  var words = getAllWords();
  var source = AppState.difficulty === 'beginner' || AppState.difficulty === 'toddler' ? BLEND_WORDS.slice(0, 11) : BLEND_WORDS;
  var picked = shuffle(source).slice(0, Math.min(diff.questionCount, 5));
  var questions = picked.map(function(b) {
    var w = words.find(function(x) { return x.ar === b.ar; });
    var seen = {}, opts = [];
    seen[w.emoji] = 1;
    shuffle(words.filter(function(x) { return x.emoji && x.ar !== w.ar; })).forEach(function(x) {
      if (opts.length < Math.min(diff.options, 3) - 1 && !seen[x.emoji]) { seen[x.emoji] = 1; opts.push(x); }
    });
    return { arabic: w.ar, speak: w.ar, syl: b.syl, tapped: 0, label: w[AppState.lang] || w.en, emoji: w.emoji,
      options: shuffle([{ emoji: w.emoji, correct: true }].concat(opts.map(function(o) { return { emoji: o.emoji, correct: false }; }))) };
  });
  AppState.quizData = { type: 'blend', pts: diff.pts, questions: questions, current: 0, selected: null, results: [], done: false };
  navigate('blend');
}

function blendTap(i) {
  var qd = AppState.quizData, q = qd.questions[qd.current];
  if (i !== q.tapped) { AudioSystem.playSound('wrong'); return; }
  AudioSystem.speakArabic(q.syl[i]);
  q.tapped++;
  render();
  if (q.tapped === q.syl.length) setTimeout(function() { AudioSystem.speakArabic(q.arabic); }, 900);
}

function renderBlend(t) {
  var qd = AppState.quizData; if (!qd) return renderDashboard(t);
  if (qd.done) return renderQuizResults(t);
  var q = qd.questions[qd.current];
  var complete = q.tapped >= q.syl.length;
  var tiles = q.syl.map(function(s, i) {
    var st = i < q.tapped ? 'done' : i === q.tapped ? 'next' : '';
    return '<button class="blend-tile ' + st + '" onclick="blendTap(' + i + ')">' + s + '</button>';
  }).join('<span class="blend-plus">+</span>');
  var body = complete
    ? '<div class="blend-word" data-speak="' + q.arabic + '">= ' + q.arabic + '</div>' +
      '<p style="color:var(--light);margin:4px 0 8px">' + (t.blendPick || 'What is it?') + '</p>' +
      '<div class="qoptions qoptions-emoji">' + q.options.map(function(o, i) {
        return '<button class="qopt ' + _optCls(qd, o, i) + '" style="font-size:3rem;padding:18px" onclick="quizAnswer(' + i + ')">' + o.emoji + '</button>';
      }).join('') + '</div>' +
      _quizFeedback(qd, q, t, ' ' + q.emoji + ' ' + q.label)
    : '<p style="color:var(--light);margin-top:12px">' + (t.blendPrompt || 'Tap each syllable in order') + '</p>';
  return '<div class="bg-deco"></div><div class="app page-in">' + navHTML(t) + '<div class="quiz-c">' +
    secH(t, '🧱 ' + (t.blendTitle || 'Guided reading'), 'sectionBack()') + _quizDots(qd) +
    '<p class="qq">' + t.questionOf + ' ' + (qd.current + 1) + ' ' + t.of + ' ' + qd.questions.length + '</p>' +
    '<div class="blend-row">' + tiles + '</div>' + body +
  '</div></div>';
}

// ==================== SUN & MOON LETTERS ====================
// Hear "al + word": is the ل pronounced (moon, الْقَمَر) or swallowed with a
// doubled first letter (sun, الشَّمْس)? After the answer the ل is greyed or
// highlighted to show why.
function startQuizSunMoon() {
  var diff = DIFFICULTY[AppState.difficulty || 'normal'];
  var words = getAllWords();
  var sun = shuffle(SUN_MOON_WORDS.filter(function(w) { return w.sun; }));
  var moon = shuffle(SUN_MOON_WORDS.filter(function(w) { return !w.sun; }));
  var picked = [];
  for (var i = 0; picked.length < diff.questionCount; i++) picked.push(i % 2 ? moon[i >> 1] : sun[i >> 1]);
  var questions = shuffle(picked).map(function(w) {
    var base = words.find(function(x) { return x.ar === w.base; }) || {};
    return { arabic: w.ar, speak: w.ar, sun: w.sun, emoji: base.emoji || '', first: w.base.charAt(0),
      options: [{ label: '🌞 ' + (AppState.t.sunLabel || 'Sun'), correct: w.sun }, { label: '🌙 ' + (AppState.t.moonLabel || 'Moon'), correct: !w.sun }] };
  });
  AppState.quizData = { type: 'sunmoon', pts: diff.pts, autoSpeak: true, questions: questions, current: 0, selected: null, results: [], done: false };
  navigate('quizSunMoon');
  setTimeout(function() { AudioSystem.speakArabic(questions[0].speak); }, 400);
}

function renderQuizSunMoon(t) {
  var qd = AppState.quizData; if (!qd) return renderDashboard(t);
  if (qd.done) return renderQuizResults(t);
  var q = qd.questions[qd.current];
  var answered = qd.selected !== null;
  // Split "ال" from the rest so the ل can be styled once the child has answered.
  var word = answered
    ? 'ا<span class="' + (q.sun ? 'lam-silent' : 'lam-spoken') + '">ل' + (q.sun ? '' : 'ْ') + '</span>' + q.arabic.slice(q.sun ? 2 : 3)
    : q.arabic;
  var explain = (q.sun ? (t.sunExplain || '{l}: sun letter, the ل is silent') : (t.moonExplain || '{l}: moon letter, the ل is heard'))
    .replace('{l}', '<span style="font-family:var(--font-arabic)">' + q.first + '</span>');
  return '<div class="bg-deco"></div><div class="app page-in">' + navHTML(t) + '<div class="quiz-c">' +
    secH(t, '🌞 ' + (t.quizSunMoon || 'Sun & moon letters'), 'sectionBack()') + _quizDots(qd) +
    '<p class="qq">' + t.questionOf + ' ' + (qd.current + 1) + ' ' + t.of + ' ' + qd.questions.length + '</p>' +
    '<p style="color:var(--light);margin-bottom:4px">' + (t.sunMoonPrompt || 'Is the ل of ال pronounced?') + '</p>' +
    '<div class="qprompt" data-speak="' + q.speak + '">' + (q.emoji ? q.emoji + ' ' : '') + word + '</div>' +
    '<button class="btn btn-secondary btn-sm" data-speak="' + q.speak + '" style="margin:0 auto 12px;display:flex">🔊 ' + t.listen + '</button>' +
    '<div class="qoptions">' + q.options.map(function(o, i) {
      return '<button class="qopt ' + _optCls(qd, o, i) + '" onclick="quizAnswer(' + i + ')">' + o.label + '</button>';
    }).join('') + '</div>' +
    _quizFeedback(qd, q, t, '<br><small>' + explain + '</small>') +
  '</div></div>';
}

// ==================== SKILLS (learning path) ====================
var SKILLS = {
  syllables: { icon: '🗣️', title: 'quizSyllables', start: 'startQuizSyllables' },
  twins:     { icon: '👯', title: 'quizTwins',     start: 'startQuizTwins' },
  long:      { icon: '🐍', title: 'quizLong',      start: 'startQuizLong' },
  blend:     { icon: '🧱', title: 'blendTitle',    start: 'startBlend' },
  tanwin:    { icon: '✨', title: 'quizTanwin',    start: 'startQuizTanwin' },
  sunmoon:   { icon: '🌞', title: 'quizSunMoon',   start: 'startQuizSunMoon' }
};
// A skill counts as done once its quiz is finished with at least half right.
function _markSkillDone(qd) {
  if (!SKILLS[qd.type]) return;
  var ok = qd.results.filter(function(r) { return r; }).length;
  if (ok * 2 < qd.results.length) return;
  if (!AppState.skillsDone) AppState.skillsDone = [];
  if (AppState.skillsDone.indexOf(qd.type) < 0) { AppState.skillsDone.push(qd.type); AppState.save(); }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', function() {
  // Auto-detect device language
  AppState.lang = AppState.detectLanguage();
  // Restore theme preference
  try { AppState.theme = localStorage.getItem('ak_theme') || 'light'; } catch(e) { AppState.theme = 'light'; }
  applyTheme();
  // First-launch onboarding — skip when a returning user auto-logs in.
  let onbDone = '1';
  try { onbDone = localStorage.getItem('ak_onboardingDone'); } catch(e) {}
  if (!onbDone && !tryAutoLogin()) {
    AppState.screen = 'onboarding';
    AppState._onbSlide = 0;
    render();
    return;
  }
  if (!tryAutoLogin()) render();
  // Once first paint is in place, query the cloud for any profiles this device
  // has previously saved but which are no longer on disk (re-install / new
  // device case). Auth is anonymous so it takes a moment to be ready.
  setTimeout(_maybeOfferCloudRecover, 2500);
});
