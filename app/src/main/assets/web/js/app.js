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
  selectedLetter: null, selectedCategory: null, quizData: null,
  save() {
    if (!this.user) return;
    var json = JSON.stringify({
      user:this.user,lang:this.lang,score:this.score,level:this.level,
      lessons:this.lessons,quizzes:this.quizzes,learnedLetters:this.learnedLetters,earnedBadges:this.earnedBadges,visitedCategories:this.visitedCategories,ratingDone:this.ratingDone,
      difficulty:this.difficulty, premium:this.premium,
      streak:this.streak, dailyDone:this.dailyDone,
      letterStats:this.letterStats
    });
    try { localStorage.setItem('ak_' + this.user.name, json); } catch(e) {}
    // Sync to cloud
    try { if (typeof Android !== 'undefined' && Android.cloudSave) Android.cloudSave(this.user.name, this.user.code, json); } catch(e) {}
  },
  load(name) {
    try { const r=localStorage.getItem('ak_'+name); if(r){Object.assign(this,JSON.parse(r));return true;} } catch(e) {}
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
    dashboard: renderDashboard, alphabet: renderAlphabet, letterDetail: renderLetterDetail,
    words: renderWords, wordList: renderWordList, quizL: renderQuizLetters,
    quizW: renderQuizWords, quizResults: renderQuizResults, memory: renderMemory, badges: renderBadges,
    quizForms: renderQuizForms, quizAudio: renderQuizAudio, quizCategories: renderQuizCategories,
    quizPhrases: renderQuizPhrases, quizMatch: renderQuizMatch,
    difficulty: renderDifficulty, letterForms: renderLetterForms,
    letterTraceMenu: renderLetterTraceMenu, letterTraceLesson: renderLetterTraceLesson,
    subscription: renderSubscription, readingWords: renderReadingWords, readingText: renderReadingText,
    quizChrono: renderQuizChrono, quizSpelling: renderQuizSpelling, quizExpert: renderQuizExpert,
    quizHarakat: renderQuizHarakat,
    quizPositions: renderQuizPositions,
    quizListen: renderQuizListen,
    path: renderPath,
    onboarding: renderOnboarding,
    storiesList: renderStoriesList,
    story: renderStory,
    storyQuiz: renderStoryQuiz,
    letterHunt: renderLetterHunt
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
}

function _tryShowPendingAd() {
  if (!_adPending) return;
  try {
    if (typeof Android === 'undefined') { _adPending = false; return; }
    // showInterstitial() returns true only if the ad was ready and is being
    // displayed. If it returns false, Android already kicked off a reload;
    // keep _adPending=true so the next navigation retries automatically.
    var shown = Android.showInterstitial();
    console.log('[AD] tryShow → shown=' + shown + ' pending=' + _adPending);
    if (shown === true || shown === 'true') _adPending = false;
  } catch (e) {
    _adPending = false;
  }
}

function navigate(s) {
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
  // djb2-style hash of yyyy-mm-dd → deterministic per day
  let h = 5381;
  for (let i = 0; i < day.length; i++) h = ((h << 5) + h + day.charCodeAt(i)) >>> 0;
  const pick = h % 3;
  if (pick === 0) {
    const letter = ALPHABET[h % ALPHABET.length];
    return { id: 'letter_' + letter.l, type: 'letter', target: letter.l, emoji: '🔤', label: letter.l };
  }
  if (pick === 1) {
    const keys = Object.keys(WORD_CATEGORIES);
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
  if (done) markDailyDone();
}

// Update the daily-activity streak. Idempotent within a day. Called from any
// progress hook (addScore, addLesson, addQuiz, markLetterLearned) via save().
function bumpStreak() {
  const today = new Date().toISOString().slice(0, 10);
  if (!AppState.streak) AppState.streak = { current: 0, longest: 0, lastActive: null };
  if (AppState.streak.lastActive === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  AppState.streak.current = (AppState.streak.lastActive === yesterday) ? AppState.streak.current + 1 : 1;
  if (AppState.streak.current > (AppState.streak.longest || 0)) AppState.streak.longest = AppState.streak.current;
  AppState.streak.lastActive = today;
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
// never interrupted mid-exercise. Cadences tuned for kids: never more than
// ~4-5 ads/hour during intensive use (Designed for Families compliant).
var _lettersViewedCount = 0;   // letter detail opens       — every 4
var _lettersTracedCount = 0;   // tracing validated         — every 4
var _memoryWinsCount = 0;      // memory match game wins    — every 3
var _readingWordsCount = 0;    // word reading sessions     — every 3
var _readingTextsCount = 0;    // text reading sessions     — every 2

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
  if(AppState.quizzes%2===0) _adPending = true;
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

function awardBadge(id) {
  if(!AppState.earnedBadges.includes(id)){
    AppState.earnedBadges.push(id);
    const b=BADGE_DEFINITIONS.find(x=>x.id===id);
    if(b){AudioSystem.playSound('badge');showBadgePopup(b);showConfetti();}
    AppState.save();
    Analytics.badgeEarned(id);
  }
}

function showBadgePopup(badge) {
  const t=AppState.t;
  const ov=document.createElement('div');ov.className='badge-overlay';ov.id='bo';ov.onclick=closeBadgePopup;
  const pp=document.createElement('div');pp.className='badge-popup';pp.id='bp';
  pp.innerHTML=`<div class="badge-popup-emoji">${badge.emoji}</div><h2 style="margin-bottom:8px">${t.newBadge}</h2><p style="font-size:1.15rem;font-weight:600;color:#4A5568">${badge.name[AppState.lang]}</p><button class="btn btn-primary" style="margin-top:18px" onclick="closeBadgePopup()">${t.wellDone} ✨</button>`;
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
  return `<span class="diff-badge" style="background:${d.col}20;color:${d.col};border:1.5px solid ${d.col}40" onclick="navigate('difficulty')" title="${t.changeDifficulty||'Level'}">${d.e} ${t[diff||'normal']||diff||'Normal'}</span>`;
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
      <button class="nav-btn" onclick="AudioSystem.toggle();this.textContent=AudioSystem.enabled?'🔊':'🔇'" title="${AudioSystem.enabled?t.soundOn:t.soundOff}">🔊</button>
      <button class="nav-btn" onclick="toggleTheme()" title="${t.theme||'Theme'}">${AppState.theme==='dark'?'☀️':'🌙'}</button>
      <button class="nav-btn" onclick="goHome()" title="${t.home}">🏠</button>
      <button class="nav-btn" onclick="logout()" title="Logout">🚪</button>
    </div>
  </div>`;
}

function secH(t,title,back) { return `<div class="sec-header"><button class="back-btn" onclick="${back}"><span style="font-size:1.1rem">←</span> ${t.back}</button><h2>${title}</h2></div>`; }

// ==================== SCREEN RENDERERS ====================
function renderWelcome(t) {
  const langs=[{c:'fr',flag:'🇫🇷'},{c:'en',flag:'🇬🇧'},{c:'es',flag:'🇪🇸'},{c:'de',flag:'🇩🇪'},{c:'tr',flag:'🇹🇷'},{c:'hi',flag:'🇮🇳'},{c:'id',flag:'🇮🇩'},{c:'it',flag:'🇮🇹'},{c:'nl',flag:'🇳🇱'},{c:'pt',flag:'🇵🇹'}];
  return `<div class="bg-deco"></div>${flLetters()}<div class="app"><div class="welcome page-in">
    <div class="w-chars"><span>🌟</span><span>📚</span><span>✨</span><span>🎮</span><span>🏆</span></div>
    <h1 class="w-title">Arabic Kids</h1><p class="w-arabic">تعلّم العربية</p>
    <p class="w-tagline">${t.tagline}</p>
    <div class="lang-sel">${langs.map(l=>`<button class="lang-btn ${AppState.lang===l.c?'active':''}" onclick="setLanguage('${l.c}')">${l.flag}</button>`).join('')}</div>
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
  return `<div class="streak-badge" title="${t.longestStreak||'Best'}: ${s.longest||s.current}">🔥 ${s.current} ${t.streakDays||'days'}</div>`;
}

function renderDailyCard(t) {
  const d = getDailyChallenge();
  const done = isDailyDone();
  let headline;
  if (d.type === 'letter')        headline = `${t.stepLearn || 'Learn'} <span class="arabic" style="font-family:var(--font-arabic)">${d.label}</span>`;
  else if (d.type === 'category') headline = `${t.stepExplore || 'Explore'} ${t[d.target] || d.target}`;
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
      <div class="menu-item menu-item-forms" onclick="navigate('letterForms')"><span class="menu-icon">✍️</span><span class="menu-lbl">${t.letterForms}</span></div>
      <div class="menu-item menu-item-trace" onclick="navigate('letterTraceMenu')"><span class="menu-icon">✏️</span><span class="menu-lbl">${t.tracing||'Écriture'}</span></div>
      <div class="menu-item menu-item-reading" onclick="startReadingWords()"><span class="menu-icon">🎙️</span><span class="menu-lbl">${t.readingWords||'Lecture'}</span></div>
      ${AppState.difficulty==='advanced'?`<div class="menu-item menu-item-reading" onclick="startReadingText()"><span class="menu-icon">📖</span><span class="menu-lbl">${t.readingText||'Textes'}</span></div>`:''}
      <div class="menu-item" onclick="startQuizLetters()"><span class="menu-icon">🎯</span><span class="menu-lbl">${t.quizLetters}</span></div>
      <div class="menu-item" onclick="startQuizWords()"><span class="menu-icon">🧩</span><span class="menu-lbl">${t.quizWords}</span></div>
      <div class="menu-item" onclick="startQuizForms()"><span class="menu-icon">🖊️</span><span class="menu-lbl">${t.quizForms}</span></div>
      <div class="menu-item" onclick="startQuizPositions()"><span class="menu-icon">📍</span><span class="menu-lbl">${t.quizPositions||'Positions'}</span></div>
      <div class="menu-item" onclick="startQuizAudio()"><span class="menu-icon">🎧</span><span class="menu-lbl">${t.quizAudio}</span></div>
      <div class="menu-item" onclick="startQuizListen()"><span class="menu-icon">👂</span><span class="menu-lbl">${t.quizListen||'Listen'}</span></div>
      <div class="menu-item menu-item-stories" onclick="navigate('storiesList')"><span class="menu-icon">📖</span><span class="menu-lbl">${t.stories||'Stories'}</span></div>
      <div class="menu-item" onclick="startLetterHuntFromHome()"><span class="menu-icon">🔍</span><span class="menu-lbl">${t.letterHunt||'Hunt'}</span></div>
      <div class="menu-item" onclick="startQuizHarakat()"><span class="menu-icon">◌َ</span><span class="menu-lbl">${t.quizHarakat||'Quiz Harakat'}</span></div>
      <div class="menu-item" onclick="startQuizCategories()"><span class="menu-icon">📂</span><span class="menu-lbl">${t.quizCategories}</span></div>
      <div class="menu-item" onclick="startQuizPhrases()"><span class="menu-icon">💬</span><span class="menu-lbl">${t.quizPhrases}</span></div>
      <div class="menu-item" onclick="startQuizMatch()"><span class="menu-icon">🔗</span><span class="menu-lbl">${t.quizMatch}</span></div>
      <div class="menu-item" onclick="startMemory()"><span class="menu-icon">🃏</span><span class="menu-lbl">${t.memory}</span></div>
      <div class="menu-item" onclick="navigate('badges')"><span class="menu-icon">🏆</span><span class="menu-lbl">${t.badges}</span></div>
    </div>
    `}
    <!-- Premium section hidden for now
    <div class="premium-section">
      ...
    </div>
    -->
    <div style="text-align:center;margin:24px 0 16px">
      <button class="btn btn-ghost btn-sm" onclick="navigate('difficulty')" style="font-size:0.88rem;gap:6px">
        ⚙️ ${t.changeDifficulty||'Change level'} — <strong>${getDiffBadge(AppState.difficulty,t)}</strong>
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
  // Queue an interstitial for every 4 letter consultations (shown on exit).
  _lettersViewedCount++;
  if (_lettersViewedCount % 4 === 0) _adPending = true;
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

function renderLetterDetail(t) {
  var i=AppState.selectedLetter, d=ALPHABET[i];
  // Count this view (one per navigation, not per re-render — guard via a flag)
  if (AppState._lastViewedLetter !== d.l) {
    bumpLetterStat(d.l, 'views');
    AppState._lastViewedLetter = d.l;
    if (AppState.user) AppState.save();
  }
  var stats = getLetterStats(d.l);
  var formNames = ['isolated','initial','medial','final'];
  var formsHTML = d.forms ? formNames.map(function(fn) {
    var fm = d.forms[fn];
    if (!fm) return '<div class="lform-card disabled"><div class="lform-label">'+t[fn]+'</div><div class="lform-char">—</div></div>';
    return '<div class="lform-card" data-speak="'+fm.ex+'" style="cursor:pointer"><div class="lform-label">'+t[fn]+'</div><div class="lform-char" style="color:'+d.c+'">'+fm.f+'</div><div class="lform-ex"><div class="lform-ex-ar">'+fm.ex+'</div><div class="lform-ex-tr">'+fm.exm[AppState.lang]+'</div></div></div>';
  }).join('') : '';

  // Build harakat section. Sukun and Shadda are unvoiceable alone, so the
  // text passed to TTS gets a helper vowel (alif-fatha prefix for sukun,
  // fatha suffix for shadda) — display stays the raw combined form.
  var harakatHTML = HARAKAT.map(function(h) {
    var combined = d.l + h.mark;
    var speak = combined;
    if (h.mark === '\u0652') speak = (d.l === 'أ' || d.l === 'ا') ? 'أَا' : 'أَ' + d.l + '\u0652';
    else if (h.mark === '\u0651') speak = d.l + '\u0651\u064E';
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
    '<div class="lmastery">👀 '+stats.views+' · 🔊 '+stats.listens+(stats.huntWins?' · 🔍 '+stats.huntWins:'')+'</div>' +
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
      '<button class="btn btn-primary btn-sm" onclick="letterNext('+i+')">'+(i<27?t.next+' →':'✅ '+t.wellDone)+'</button>' +
    '</div>' +
  '</div></div>';
}

function letterNext(i) {
  markLetterLearned(ALPHABET[i].l); addLesson(); addScore(5); AudioSystem.playSound('correct');
  // From the guided path, advance to the NEXT path step (could be a quiz or
  // category, not always the next alphabet letter) so the child doesn't skip
  // milestones by hitting "next" repeatedly.
  if (AppState._pathOrigin) {
    const next = LEARNING_PATH[currentPathIndex()];
    if (next) { goToPathStep(next.id); window.scrollTo(0, 0); return; }
    AppState._pathOrigin = false;
    navigate('path');
    return;
  }
  if(i<27){AppState.selectedLetter=i+1;AudioSystem.speakArabic(ALPHABET[i+1].l);render();window.scrollTo(0,0);}
  else navigate('alphabet');
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
  Object.keys(WORD_CATEGORIES).some(function (k) {
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
function renderOnboarding(t) {
  const slide = AppState._onbSlide || 0;
  const slides = [
    { emoji: '✨', title: t.appName, desc: t.tagline },
    { emoji: '📚', title: `${t.alphabet} · ${t.words} · ${t.quizLetters}`, desc: t.onbSlide2 || 'Apprends à ton rythme avec des jeux' },
    { emoji: '🚀', title: t.onbSlide3 || 'Prêt à commencer ?', desc: t.letsStart || "C'est parti !" }
  ];
  const s = slides[Math.min(slide, slides.length - 1)];
  const isLast = slide >= slides.length - 1;
  const dots = slides.map((_, i) => `<span class="onboard-dot ${i === slide ? 'active' : ''}"></span>`).join('');
  return `<div class="onboard-wrap">
    <button class="onboard-skip" onclick="finishOnboarding()">${t.skip || 'Passer'} ›</button>
    <div class="onboard-content">
      <div class="onboard-emoji">${s.emoji}</div>
      <h1 class="onboard-title">${s.title}</h1>
      <p class="onboard-desc">${s.desc}</p>
    </div>
    <div class="onboard-dots">${dots}</div>
    <button class="btn btn-primary onboard-cta" onclick="${isLast ? 'finishOnboarding()' : 'nextOnboardingSlide()'}">
      ${isLast ? (t.start || 'Commencer') : (t.next || 'Next')} →
    </button>
  </div>`;
}

function nextOnboardingSlide() {
  AppState._onbSlide = (AppState._onbSlide || 0) + 1;
  render();
}

function finishOnboarding() {
  try { localStorage.setItem('ak_onboardingDone', '1'); } catch(e) {}
  AppState._onbSlide = 0;
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
      ${(s.level || 1) >= 3 ? '<div class="story-badge">🔥 ' + (t.advanced || 'Advanced') + '</div>' : ''}
    </div>`).join('');
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}
    ${secH(t, '📖 ' + (t.stories || 'Stories'), 'sectionBack()')}
    <div class="story-grid">${cards}</div>
  </div>`;
}

function openStory(id) {
  AppState.selectedStory = id;
  navigate('story');
}

function renderStory(t) {
  const s = STORIES.find(x => x.id === AppState.selectedStory);
  if (!s) return renderStoriesList(t);
  const body = s.lines.map(l => `<p class="story-line" data-speak="${l}">${l}</p>`).join('');
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}
    ${secH(t, s.emoji + ' ' + ((s.title && s.title[AppState.lang]) || s.title.en), 'sectionBack()')}
    <div class="story-body" dir="rtl">${body}</div>
    <button class="btn btn-secondary btn-sm" data-speak="${s.lines.join(' ')}" style="margin:10px auto;display:flex">🔊 ${t.listen}</button>
    <button class="btn btn-primary" onclick="startStoryQuiz()" style="margin:16px auto 0;display:flex">${t.comprehension || 'Questions'} →</button>
  </div></div>`;
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
    <div class="qoptions">${q.options.map((o, i) => `<button class="qopt ${qd.selected === i ? (o.correct ? 'correct' : 'incorrect') : (qd.selected !== null ? 'dis' : '')}" onclick="quizAnswer(${i})"><span style="font-size:2rem;display:block">${o.emoji}</span><span class="arabic" style="font-family:var(--font-arabic);font-size:1.25rem">${o.label}</span></button>`).join('')}</div>
    ${qd.selected !== null ? `<div class="qfeedback ${q.options[qd.selected].correct ? 'correct' : 'incorrect'}">${q.options[qd.selected].correct ? t.correct : t.incorrect}</div>` : ''}
  </div></div>`;
}

// ==================== QUIZ LISTEN & CHOOSE ====================
// Variant of quizAudio where options are emoji-only (easier for pre-readers).
// The child hears an Arabic word and picks the matching picture.
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
    <div class="qoptions qoptions-emoji">${q.options.map((o, i) => `<button class="qopt ${qd.selected === i ? (o.correct ? 'correct' : 'incorrect') : (qd.selected !== null ? 'dis' : '')}" style="font-size:3rem;padding:20px" onclick="quizAnswer(${i})">${o.emoji}</button>`).join('')}</div>
    ${qd.selected !== null ? `<div class="qfeedback ${q.options[qd.selected].correct ? 'correct' : 'incorrect'}">${q.options[qd.selected].correct ? t.correct : t.incorrect}</div>` : ''}
  </div></div>`;
}

// ==================== LEARNING PATH ====================
function isPathStepDone(step) {
  if (!step) return false;
  if (step.type === 'letter')   return (AppState.learnedLetters || []).includes(step.target);
  if (step.type === 'category') return (AppState.visitedCategories || []).includes(step.target);
  if (step.type === 'quiz')     return (AppState.quizzes || 0) >= step.target;
  return false;
}

function currentPathIndex() {
  for (let i = 0; i < LEARNING_PATH.length; i++) {
    if (!isPathStepDone(LEARNING_PATH[i])) return i;
  }
  return LEARNING_PATH.length;
}

function pathStepLabel(step, t) {
  if (step.type === 'letter')   return `${t.stepLearn || 'Learn'} <span class="arabic" style="font-family:var(--font-arabic);font-size:1.4rem">${step.target}</span>`;
  if (step.type === 'category') return `${t.stepExplore || 'Explore'} ${WORD_CATEGORIES[step.target]?.emoji||''} ${t[step.target] || step.target}`;
  if (step.type === 'quiz')     return `${t.stepPassQuiz || 'Pass'} ${step.target} ${t.quizzesPassed || 'quiz'}`;
  return step.id;
}

function renderPath(t) {
  const current = currentPathIndex();
  const total = LEARNING_PATH.length;
  const pct = Math.round((current / total) * 100);
  const items = LEARNING_PATH.map((step, i) => {
    const done = i < current;
    const isCurrent = i === current;
    const locked = i > current;
    const icon = done ? '✅' : isCurrent ? '🟢' : '🔒';
    const cls = done ? 'path-done' : isCurrent ? 'path-current' : 'path-locked';
    const onclick = locked ? '' : `onclick="goToPathStep('${step.id}')"`;
    return `<div class="path-item ${cls}" ${onclick}>
      <span class="path-icon">${icon}</span>
      <span class="path-label">${pathStepLabel(step, t)}</span>
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
  } else if (step.type === 'quiz') {
    const learned = AppState.learnedLetters || [];
    const pool = ALPHABET.filter(l => learned.includes(l.l));
    startQuizLetters(pool);
  }
}

// ==================== WORDS ====================
function renderWords(t) {
  return `<div class="bg-deco"></div><div class="app page-in">${navHTML(t)}${secH(t,'📝 '+t.words,'sectionBack()')}
    <div class="cat-grid">${Object.entries(WORD_CATEGORIES).map(([k,v])=>`<div class="cat-card" onclick="openCategory('${k}')"><div class="cat-emoji">${v.emoji}</div><div class="cat-name">${t[k]}</div></div>`).join('')}</div></div>`;
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
      AudioSystem.speakArabic(cat.words[idx].ar);
    }
    return;
  }
});

// ==================== QUIZ LETTERS ====================
function startQuizLetters(poolOverride) {
  const diff=DIFFICULTY[AppState.difficulty||'normal'];
  let pool = (Array.isArray(poolOverride) && poolOverride.length)
    ? poolOverride.slice()
    : ALPHABET.slice(0, diff.letterCount);
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
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${qd.selected===i?(o.correct?'correct':'incorrect'):(qd.selected!==null?'dis':'')}" ${optStyle} onclick="quizAnswer(${i})">${o.label}</button>`).join('')}</div>
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
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${qd.selected===i?(o.correct?'correct':'incorrect'):(qd.selected!==null?'dis':'')}" onclick="quizAnswer(${i})">${qd.hideEmoji?'':o.emoji+' '}${o.label}</button>`).join('')}</div>
    ${qd.selected!==null?`<div class="qfeedback ${q.options[qd.selected].correct?'correct':'incorrect'}">${q.options[qd.selected].correct?t.correct:t.incorrect}</div>`:''}
  </div></div>`;
}

function quizAnswer(i) {
  const qd=AppState.quizData; if(qd.selected!==null)return;
  qd.selected=i; const q=qd.questions[qd.current]; const ok=q.options[i].correct;
  if(ok){AudioSystem.playSound('correct');addScore(qd.pts||10);}else AudioSystem.playSound('wrong');
  qd.results.push(ok); render();
  setTimeout(()=>{
    if(qd.current<qd.questions.length-1){
      qd.current++;qd.selected=null;render();
      if(qd.type==='audio')setTimeout(()=>AudioSystem.speakArabic(qd.questions[qd.current].arabic),400);
      if(qd.type==='harakat')setTimeout(()=>AudioSystem.speakArabic(qd.questions[qd.current].combined),400);
    }
    else{qd.done=true;addQuiz();if(qd.results.every(r=>r))awardBadge('perfectQuiz');showConfetti();render();}
  },1200);
}

function renderQuizResults(t) {
  const qd=AppState.quizData; if(!qd)return renderDashboard(t);
  const total=qd.questions?qd.questions.length:(qd.totalPairs||8);
  const correct=qd.results.filter(r=>r).length;
  const pct=Math.round((correct/total)*100);
  const msg=pct===100?t.perfect:pct>=75?t.great:pct>=50?t.good:t.keepGoing;
  const icons={letters:'🎯',words:'🧩',forms:'✍️',audio:'🎧',categories:'📂',phrases:'💬',match:'🔗',harakat:'◌َ',positions:'📍',story:'📖',listen:'👂'};
  const icon=icons[qd.type]||'🎯';
  const replays={letters:'startQuizLetters()',words:'startQuizWords()',forms:'startQuizForms()',audio:'startQuizAudio()',categories:'startQuizCategories()',phrases:'startQuizPhrases()',match:'startQuizMatch()',harakat:'startQuizHarakat()',positions:'startQuizPositions()',story:'startStoryQuiz()',listen:'startQuizListen()'};
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
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${qd.selected===i?(o.correct?'correct':'incorrect'):(qd.selected!==null?'dis':'')}" style="font-family:var(--font-arabic);font-size:1.8rem" onclick="quizAnswer(${i})">${o.label}</button>`).join('')}</div>
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
  const pool = ALPHABET.slice(0, diff.letterCount).filter(a => a.forms);
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
    <div class="qoptions">${q.options.map((o, i) => `<button class="qopt ${qd.selected === i ? (o.correct ? 'correct' : 'incorrect') : (qd.selected !== null ? 'dis' : '')}" style="font-family:var(--font-arabic);font-size:2.3rem" onclick="quizAnswer(${i})">${o.label}</button>`).join('')}</div>
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
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${qd.selected===i?(o.correct?'correct':'incorrect'):(qd.selected!==null?'dis':'')}" style="font-family:var(--font-arabic);font-size:1.4rem" onclick="quizAnswer(${i})">${o.label}</button>`).join('')}</div>
    ${qd.selected!==null?`<div class="qfeedback ${q.options[qd.selected].correct?'correct':'incorrect'}">${q.options[qd.selected].correct?t.correct:t.incorrect}</div>`:''}
  </div></div>`;
}

// ==================== QUIZ CATEGORIES ====================
function startQuizCategories() {
  const diff=DIFFICULTY[AppState.difficulty||'normal'];
  const catKeys=diff.catKeys||Object.keys(WORD_CATEGORIES);
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
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${qd.selected===i?(o.correct?'correct':'incorrect'):(qd.selected!==null?'dis':'')}" onclick="quizAnswer(${i})">${WORD_CATEGORIES[o.label].emoji} ${t[o.label]}</button>`).join('')}</div>
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
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${qd.selected===i?(o.correct?'correct':'incorrect'):(qd.selected!==null?'dis':'')}" style="font-family:var(--font-arabic);font-size:1.3rem" onclick="quizAnswer(${i})">${o.label}</button>`).join('')}</div>
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
      <div class="match-col">${leftItems.map(item=>`<div class="match-item match-left" data-idx="${item.idx}" onclick="quizMatchSelect('left',${item.idx})"><span class="arabic" style="font-family:var(--font-arabic);font-size:1.3rem">${item.ar}</span></div>`).join('')}</div>
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
        if(memoryCards.every(function(x){return x.matched;})){memoryDone=true;addQuiz();_memoryWinsCount++;if(_memoryWinsCount%3===0)_adPending=true;showConfetti();AudioSystem.playSound('complete');render();}
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
      return `<div class="badge ${earned?'earned':'locked'}"><div class="badge-emoji">${b.emoji}</div><div class="badge-name">${b.name[AppState.lang]}</div>${earned?'<div style="color:var(--green);font-weight:700;font-size:0.78rem;margin-top:3px">✓</div>':''}</div>`;
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
  return `<div class="bg-deco"></div>${flLetters()}<div class="app page-in">${navHTML(t)}${secH(t,'🔐 '+t.premiumTitle,'sectionBack()')}
    <div class="sub-page">
      <div class="sub-hero">🌟</div>
      <h2 style="text-align:center;margin:0 0 8px">${t.premiumTitle||'Premium'}</h2>
      <p style="text-align:center;color:var(--text-light);font-size:0.92rem;margin-bottom:20px">${t.premiumBenefits||''}</p>
      <div class="sub-features">
        <div class="sub-feature"><span class="sub-feat-icon">⏱️</span><div><strong>${t.quizChrono}</strong><div class="sub-feat-desc">${t.chronoInstruct}</div></div></div>
        <div class="sub-feature"><span class="sub-feat-icon">🔤</span><div><strong>${t.quizSpelling}</strong><div class="sub-feat-desc">${t.spellInstruct}</div></div></div>
        <div class="sub-feature"><span class="sub-feat-icon">🧠</span><div><strong>${t.quizExpert}</strong><div class="sub-feat-desc">${t.expertInstruct}</div></div></div>
      </div>
      ${AppState.premium
        ? `<div class="sub-active"><span style="font-size:2rem">✅</span><div>${t.alreadySubscribed||'Abonnement actif'}</div></div>`
        : `<div class="sub-plans">
            <button class="btn btn-primary sub-plan-btn" onclick="triggerSubscription('monthly')">
              <div class="sub-plan-label">${t.subscribeMonthly||'1,99€/mois'}</div>
              <div class="sub-plan-sub">${t.subscribeBtn||"S'abonner"}</div>
            </button>
            <button class="btn btn-secondary sub-plan-btn" onclick="triggerSubscription('yearly')">
              <div class="sub-plan-label">${t.subscribeYearly||'14,99€/an'}</div>
              <div class="sub-plan-sub" style="color:rgba(255,255,255,0.8)">💰 Économise 37%</div>
            </button>
          </div>
          <button class="btn btn-ghost" style="width:100%;font-size:0.85rem;margin-top:8px" onclick="restorePurchasesAction()">${t.restorePurchases}</button>`
      }
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
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${qd.selected===i?(o.correct?'correct':'incorrect'):(qd.selected!==null?'dis':'')}" style="font-family:var(--font-arabic);font-size:1.6rem;direction:rtl" onclick="quizAnswer(${i})">${o.label}</button>`).join('')}</div>
    ${qd.selected!==null?`<div class="qfeedback ${q.options[qd.selected].correct?'correct':'incorrect'}">${q.options[qd.selected].correct?t.correct:t.incorrect} <span style="font-family:var(--font-arabic);font-size:1.1rem">${q.correct}</span></div>`:''}
  </div></div>`;
}

// ==================== QUIZ HARAKAT ====================

function startQuizHarakat() {
  var diff = DIFFICULTY[AppState.difficulty || 'normal'];
  var pool = ALPHABET.slice(0, diff.letterCount);
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
  setTimeout(function() { AudioSystem.speakArabic(AppState.quizData.questions[0].combined); }, 400);
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
    '<div class="qprompt" style="font-size:5rem;direction:rtl;font-family:var(--font-arabic)" data-speak="' + q.combined + '">' + q.combined + '</div>' +
    '<button class="btn btn-secondary btn-sm" data-speak="' + q.combined + '" style="margin:0 auto 12px;display:flex">🔊 ' + t.listen + '</button>' +
    '<div class="qoptions">' + q.options.map(function(o, i) {
      return '<button class="qopt ' + (qd.selected === i ? (o.correct ? 'correct' : 'incorrect') : (qd.selected !== null ? 'dis' : '')) +
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
    <div class="qoptions">${q.options.map((o,i)=>`<button class="qopt ${qd.selected===i?(o.correct?'correct':'incorrect'):(qd.selected!==null?'dis':'')}" style="font-family:var(--font-arabic);font-size:1.8rem;flex-direction:column;gap:2px" onclick="quizAnswer(${i})"><span>${o.label}</span><span style="font-size:0.65rem;font-family:inherit;opacity:0.7">${o.name}</span></button>`).join('')}</div>
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

function _initTraceCanvas() {
  const gc = document.getElementById('traceGuide');
  const uc = document.getElementById('traceUser');
  if (!gc || !uc) return;
  _traceGuideCtx = gc.getContext('2d');
  _traceCtx = uc.getContext('2d');
  _tracePath = [];
  _traceDrawing = _traceCompleted = _traceGuideRunning = false;
  if (_traceAnimTimer) { clearTimeout(_traceAnimTimer); _traceAnimTimer = null; }
  const i = AppState.selectedLetter || 0;
  _drawTraceTemplate(i);
  _setupTraceEvents(uc);
  _traceAnimTimer = setTimeout(() => _runTraceGuide(), 600);
}

function _drawTraceTemplate(idx) {
  if (!_traceGuideCtx) return;
  var ctx = _traceGuideCtx, W = _TRACE_W, H = _TRACE_W, S = W / 100;
  ctx.clearRect(0, 0, W, H);
  var item = ALPHABET[idx];

  // Big faded letter background — use Arabic font, centered
  ctx.save();
  ctx.font = '180px "Noto Naskh Arabic", serif';
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
    var sx = canvas.width / r.width, sy = canvas.height / r.height;
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
    _traceCtx.beginPath();
    _traceCtx.moveTo(p.x, p.y);
  }
  function onMove(e) {
    e.preventDefault();
    if (!_traceDrawing || _traceCompleted) return;
    var p = pos(e);
    _tracePath.push(p);
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

function _checkTrace() {
  var t = AppState.t;
  if (_tracePath.length < 6) {
    var ov = document.getElementById('traceOverlay');
    if (ov) ov.style.display = 'flex';
    AudioSystem.playSound('wrong');
    return;
  }
  _traceCompleted = true; _traceGuideRunning = false;
  if (_traceAnimTimer) { clearTimeout(_traceAnimTimer); _traceAnimTimer = null; }
  // Queue an interstitial for every 4 successful tracings (shown on exit).
  _lettersTracedCount++;
  if (_lettersTracedCount % 4 === 0) _adPending = true;
  var i = AppState.selectedLetter || 0;
  var sd = TRACE_STROKES[i], S = _TRACE_W / 100, R = 45; // generous radius for kids
  var wps = [];
  sd.strokes.forEach(function(pts) { pts.forEach(function(p) { wps.push({ x: p.x*S, y: p.y*S }); }); });
  sd.dots.forEach(function(d) { wps.push({ x: d.x*S, y: d.y*S }); });
  var hit = 0;
  for (var w = 0; w < wps.length; w++) {
    for (var p = 0; p < _tracePath.length; p++) {
      var dx = _tracePath[p].x - wps[w].x, dy = _tracePath[p].y - wps[w].y;
      if (dx*dx + dy*dy <= R*R) { hit++; break; }
    }
  }
  var pct = wps.length > 0 ? Math.round((hit / wps.length) * 100) : 0;
  // Very generous scoring for kids
  var stars = pct >= 55 ? 3 : pct >= 30 ? 2 : 1;
  var pts = stars * 5;
  addScore(pts); markLetterLearned(ALPHABET[i].l); addLesson();
  if (stars === 3) { AudioSystem.playSound('correct'); showConfetti(); }
  else if (stars === 2) AudioSystem.playSound('correct');
  else AudioSystem.playSound('wrong');
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
  try {
    if (typeof Android !== 'undefined' && Android.startListening) {
      Android.startListening();
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
    // Queue an interstitial by reading type: every 3 word sessions, every 2 text sessions.
    if (_readingState.type === 'text') {
      _readingTextsCount++;
      if (_readingTextsCount % 2 === 0) _adPending = true;
    } else {
      _readingWordsCount++;
      if (_readingWordsCount % 3 === 0) _adPending = true;
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

// Called from Android when TTS init detects missing Arabic
window.onTtsStatus = function(available) {
  if (!available && AppState.screen === 'dashboard') {
    setTimeout(_showTtsMissingHint, 1500);
  }
};

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
});
