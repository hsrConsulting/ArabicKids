/**
 * ArabicKids - JavaScript Unit Tests
 * Run in browser console or Node.js after loading data.js + app.js
 *
 * Usage (browser): open index.html, paste this in DevTools console
 * Usage (Node):    requires DOM stubs — primarily for browser-based validation
 */

(function() {
  'use strict';

  let passed = 0, failed = 0;
  const errors = [];

  function assert(condition, msg) {
    if (condition) { passed++; }
    else { failed++; errors.push('FAIL: ' + msg); console.error('FAIL:', msg); }
  }

  function assertEqual(a, b, msg) {
    assert(a === b, msg + ' — expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
  }

  function assertTrue(val, msg) { assert(!!val, msg); }
  function assertFalse(val, msg) { assert(!val, msg); }

  console.log('=== ArabicKids JS Tests ===');

  // ── TRANSLATIONS ─────────────────────────────────────────────────────────

  const expectedLangs = ['fr','en','es','de','tr','hi','id','it','nl','pt'];
  expectedLangs.forEach(function(lang) {
    assertTrue(TRANSLATIONS[lang], 'TRANSLATIONS has language: ' + lang);
    assertTrue(TRANSLATIONS[lang].welcome, lang + ' has "welcome" key');
    assertTrue(TRANSLATIONS[lang].alphabet, lang + ' has "alphabet" key');
    assertTrue(TRANSLATIONS[lang].quizLetters, lang + ' has "quizLetters" key');
  });

  // Premium translation keys present in all languages
  var premiumKeys = ['premium','premiumQuizzes','premiumTitle','quizChrono','quizSpelling','quizExpert','locked'];
  expectedLangs.forEach(function(lang) {
    premiumKeys.forEach(function(key) {
      assertTrue(TRANSLATIONS[lang][key], lang + ' has premium key: ' + key);
    });
  });

  // Tracing translation keys present in all languages
  var traceKeys = ['tracing','tracingTitle','tracingInstruct','tracingGuide','tracingClear','tracingCheck','tracingNext'];
  expectedLangs.forEach(function(lang) {
    traceKeys.forEach(function(key) {
      assertTrue(TRANSLATIONS[lang][key], lang + ' has tracing key: ' + key);
    });
  });

  // ── ALPHABET ────────────────────────────────────────────────────────────

  assertEqual(ALPHABET.length, 28, 'ALPHABET has 28 letters');

  var letterSet = new Set(ALPHABET.map(function(l) { return l.letter; }));
  assertEqual(letterSet.size, 28, 'All 28 letters are unique');

  ALPHABET.forEach(function(l, i) {
    assertTrue(l.letter, 'Letter ' + i + ' has .letter');
    assertTrue(l.name, 'Letter ' + i + ' has .name');
    assertTrue(l.word, 'Letter ' + i + ' has .word');
    assertTrue(l.emoji, 'Letter ' + i + ' has .emoji');
    assertTrue(l.color, 'Letter ' + i + ' has .color');
  });

  assertEqual(ALPHABET[0].name, 'Alif', 'First letter is Alif');
  assertEqual(ALPHABET[27].name, 'Ya', 'Last letter is Ya');

  // ── LETTER FORMS ────────────────────────────────────────────────────────

  ALPHABET.forEach(function(l, i) {
    assertTrue(l.forms, 'Letter ' + l.letter + ' has .forms');
    assertTrue(l.forms.isolated, 'Letter ' + l.letter + ' has isolated form');
    assertTrue(l.forms.initial, 'Letter ' + l.letter + ' has initial form');
    assertTrue(l.forms.final, 'Letter ' + l.letter + ' has final form');
  });

  // ── TRACE_STROKES ───────────────────────────────────────────────────────

  if (typeof TRACE_STROKES !== 'undefined') {
    assertEqual(TRACE_STROKES.length, 28, 'TRACE_STROKES has 28 entries');

    TRACE_STROKES.forEach(function(ts, i) {
      assertTrue(ts.strokes, 'TRACE_STROKES[' + i + '] has .strokes');
      assertTrue(Array.isArray(ts.strokes), 'strokes is array at index ' + i);
      assertTrue(ts.strokes.length >= 1, 'At least 1 stroke at index ' + i);

      ts.strokes.forEach(function(stroke, si) {
        assertTrue(stroke.length >= 2, 'Stroke ' + si + ' of letter ' + i + ' has >=2 waypoints');
        stroke.forEach(function(pt) {
          assertTrue(typeof pt.x === 'number', 'Waypoint has numeric x');
          assertTrue(typeof pt.y === 'number', 'Waypoint has numeric y');
          assertTrue(pt.x >= 0 && pt.x <= 100, 'x in 0-100 range');
          assertTrue(pt.y >= 0 && pt.y <= 100, 'y in 0-100 range');
        });
      });

      assertTrue(Array.isArray(ts.dots), 'dots is array at index ' + i);
    });
  } else {
    console.warn('TRACE_STROKES not found — skipping tracing tests');
  }

  // ── DIFFICULTY ──────────────────────────────────────────────────────────

  assertTrue(DIFFICULTY, 'DIFFICULTY config exists');
  assertTrue(DIFFICULTY.beginner, 'DIFFICULTY.beginner exists');
  assertTrue(DIFFICULTY.normal, 'DIFFICULTY.normal exists');
  assertTrue(DIFFICULTY.advanced, 'DIFFICULTY.advanced exists');

  assertTrue(DIFFICULTY.beginner.letterCount < DIFFICULTY.normal.letterCount,
    'Beginner has fewer letters than normal');
  assertTrue(DIFFICULTY.beginner.questionCount < DIFFICULTY.normal.questionCount,
    'Beginner has fewer questions than normal');
  assertTrue(DIFFICULTY.normal.questionCount < DIFFICULTY.advanced.questionCount,
    'Normal has fewer questions than advanced');

  assertTrue(DIFFICULTY.beginner.pts > 0, 'Beginner pts > 0');
  assertTrue(DIFFICULTY.normal.pts > DIFFICULTY.beginner.pts, 'Normal pts > beginner pts');
  assertTrue(DIFFICULTY.advanced.pts > DIFFICULTY.normal.pts, 'Advanced pts > normal pts');

  assertEqual(DIFFICULTY.beginner.options, 3, 'Beginner has 3 options');
  assertEqual(DIFFICULTY.normal.options, 4, 'Normal has 4 options');

  assertTrue(DIFFICULTY.beginner.catKeys, 'Beginner has catKeys restriction');
  assertEqual(DIFFICULTY.normal.catKeys, null, 'Normal has no catKeys restriction');

  // ── WORD CATEGORIES ────────────────────────────────────────────────────

  assertTrue(WORD_CATEGORIES, 'WORD_CATEGORIES exists');
  var catKeys = Object.keys(WORD_CATEGORIES);
  assertTrue(catKeys.length >= 4, 'At least 4 word categories');

  catKeys.forEach(function(key) {
    var cat = WORD_CATEGORIES[key];
    assertTrue(cat.emoji, 'Category ' + key + ' has emoji');
    assertTrue(Array.isArray(cat.words), 'Category ' + key + ' has words array');
    assertTrue(cat.words.length >= 4, 'Category ' + key + ' has >=4 words');

    cat.words.forEach(function(w) {
      assertTrue(w.arabic, 'Word has arabic in category ' + key);
      assertTrue(w.emoji, 'Word has emoji in category ' + key);
      assertTrue(w.fr || w.en, 'Word has translation in category ' + key);
    });
  });

  // ── BADGES ──────────────────────────────────────────────────────────────

  assertTrue(typeof BADGES !== 'undefined', 'BADGES exists');
  var badgeKeys = Object.keys(BADGES);
  assertTrue(badgeKeys.length >= 10, 'At least 10 badges defined');

  badgeKeys.forEach(function(id) {
    assertTrue(BADGES[id].icon, 'Badge ' + id + ' has icon');
  });

  // ── AppState ────────────────────────────────────────────────────────────

  if (typeof AppState !== 'undefined') {
    assertTrue('premium' in AppState, 'AppState has premium field');
    assertTrue('difficulty' in AppState, 'AppState has difficulty field');
    assertTrue('score' in AppState, 'AppState has score field');
    assertTrue('level' in AppState, 'AppState has level field');
    assertTrue('learnedLetters' in AppState, 'AppState has learnedLetters field');
    assertTrue('earnedBadges' in AppState, 'AppState has earnedBadges field');
  }

  // ── Renderers map ──────────────────────────────────────────────────────

  if (typeof RENDERERS !== 'undefined') {
    var expectedScreens = [
      'dashboard','letterList','letterLesson','wordCategories','wordList',
      'quizLetters','quizWords','quizResults','quizForms','quizAudio',
      'progress','badges','settings','difficulty','letterForms',
      'letterTraceMenu','letterTraceLesson','subscription',
      'quizChrono','quizSpelling','quizExpert'
    ];
    expectedScreens.forEach(function(s) {
      assertTrue(RENDERERS[s], 'RENDERERS has screen: ' + s);
    });
  }

  // ── Report ──────────────────────────────────────────────────────────────

  console.log('');
  console.log('=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  if (errors.length) {
    console.log('Failures:');
    errors.forEach(function(e) { console.log('  ' + e); });
  }

  if (typeof window !== 'undefined') {
    window._testResults = { passed: passed, failed: failed, errors: errors };
  }
})();
