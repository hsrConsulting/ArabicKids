package com.hsrconsulting.arabickids

import com.arabickids.shared.data.AlphabetData
import com.arabickids.shared.data.WordData
import com.arabickids.shared.game.QuizEngine
import com.arabickids.shared.game.ScoringEngine
import com.arabickids.shared.model.AppStateData
import com.arabickids.shared.model.DifficultyLevel
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Local JVM tests validating that the shared module's data and logic
 * integrate correctly with assumptions made by the Android app layer.
 */
class SharedIntegrationTest {

    // ── Alphabet pool covers all difficulty letter counts ──────────────────────

    @Test
    fun alphabetSize_coversBeginnerLetterCount() {
        assertTrue(AlphabetData.ALPHABET.size >= DifficultyLevel.BEGINNER.letterCount)
    }

    @Test
    fun alphabetSize_coversNormalLetterCount() {
        assertTrue(AlphabetData.ALPHABET.size >= DifficultyLevel.NORMAL.letterCount)
    }

    @Test
    fun alphabetSize_coversAdvancedLetterCount() {
        assertTrue(AlphabetData.ALPHABET.size >= DifficultyLevel.ADVANCED.letterCount)
    }

    // ── Word pools are large enough for quiz question counts ──────────────────

    @Test
    fun beginnerWordPool_hasEnoughWordsForQuiz() {
        val beginnerKeys = DifficultyLevel.BEGINNER.restrictedCategoryKeys!!
        val pool = beginnerKeys.flatMap { WordData.CATEGORIES[it]?.words ?: emptyList() }
        assertTrue(pool.size >= DifficultyLevel.BEGINNER.questionCount,
            "Beginner word pool (${pool.size}) < questionCount (${DifficultyLevel.BEGINNER.questionCount})")
    }

    @Test
    fun allWordsPool_hasEnoughForNormalQuiz() {
        assertTrue(WordData.getAllWords().size >= DifficultyLevel.NORMAL.questionCount)
    }

    @Test
    fun allWordsPool_hasEnoughForAdvancedQuiz() {
        assertTrue(WordData.getAllWords().size >= DifficultyLevel.ADVANCED.questionCount)
    }

    // ── Option pools are large enough ─────────────────────────────────────────

    @Test
    fun beginnerLetterPool_hasEnoughForOptionsCount() {
        val poolSize = DifficultyLevel.BEGINNER.letterCount
        assertTrue(poolSize >= DifficultyLevel.BEGINNER.optionsCount,
            "Pool ($poolSize) < options (${DifficultyLevel.BEGINNER.optionsCount})")
    }

    @Test
    fun beginnerWordPool_hasEnoughForOptionsCount() {
        val beginnerKeys = DifficultyLevel.BEGINNER.restrictedCategoryKeys!!
        val pool = beginnerKeys.flatMap { WordData.CATEGORIES[it]?.words ?: emptyList() }
        assertTrue(pool.size >= DifficultyLevel.BEGINNER.optionsCount,
            "Beginner word pool (${pool.size}) < options (${DifficultyLevel.BEGINNER.optionsCount})")
    }

    // ── Full quiz flow simulation ─────────────────────────────────────────────

    @Test
    fun fullQuizFlow_allCorrect_givesPerfectScore() {
        val session = QuizEngine.buildLetterQuiz(DifficultyLevel.NORMAL, "en")
        while (!session.isDone) {
            val correctIdx = session.currentQuestion.options.indexOfFirst { it.isCorrect }
            session.answerCurrent(correctIdx)
            session.advance()
        }
        assertTrue(session.isPerfect)
        assertEquals(100, session.percentage)
    }

    @Test
    fun fullQuizFlow_allWrong_givesZeroScore() {
        val session = QuizEngine.buildLetterQuiz(DifficultyLevel.NORMAL, "en")
        while (!session.isDone) {
            val wrongIdx = session.currentQuestion.options.indexOfFirst { !it.isCorrect }
            session.answerCurrent(wrongIdx)
            session.advance()
        }
        assertEquals(0, session.score)
        assertEquals(0, session.percentage)
    }

    // ── Badge progression simulation ──────────────────────────────────────────

    @Test
    fun badgeProgression_firstLesson_thenScore100() {
        var state = AppStateData(lessons = 1, score = 0)
        val badges1 = ScoringEngine.checkNewBadges(state)
        assertTrue("first_lesson" in badges1)

        state = state.copy(earnedBadges = state.earnedBadges + badges1, score = 100)
        val badges2 = ScoringEngine.checkNewBadges(state)
        assertTrue("score100" in badges2)
        assertFalse("first_lesson" in badges2) // already earned
    }

    @Test
    fun appState_scoreAccumulation_levelsUp() {
        var state = AppStateData()
        assertEquals(1, state.level)

        state = state.withScore(50)
        assertEquals(1, state.level) // not yet 100

        state = state.withScore(60) // 110 total
        assertEquals(2, state.level)

        state = state.withScore(190) // 300 total
        assertEquals(4, state.level)
    }

    // ── Quiz builders across all difficulties don't crash ─────────────────────

    @Test
    fun allQuizTypes_buildSuccessfully_forAllDifficulties() {
        DifficultyLevel.entries.forEach { diff ->
            val letterQuiz = QuizEngine.buildLetterQuiz(diff, "fr")
            assertTrue(letterQuiz.questions.isNotEmpty(), "Empty letter quiz for $diff")

            val wordQuiz = QuizEngine.buildWordQuiz(diff, "fr")
            assertTrue(wordQuiz.questions.isNotEmpty(), "Empty word quiz for $diff")

            val formsQuiz = QuizEngine.buildFormsQuiz(diff)
            assertTrue(formsQuiz.questions.isNotEmpty(), "Empty forms quiz for $diff")

            val audioQuiz = QuizEngine.buildAudioQuiz(diff, "fr")
            assertTrue(audioQuiz.questions.isNotEmpty(), "Empty audio quiz for $diff")
        }
    }

    // ── Multi-language quiz builds don't crash ────────────────────────────────

    @Test
    fun wordQuiz_buildsSuccessfully_forAllLanguages() {
        val languages = listOf("fr", "en", "es", "de", "tr", "hi", "id", "it")
        languages.forEach { lang ->
            val session = QuizEngine.buildWordQuiz(DifficultyLevel.NORMAL, lang)
            assertTrue(session.questions.isNotEmpty(), "Empty word quiz for lang=$lang")
            session.questions.forEach { q ->
                assertEquals(1, q.options.count { it.isCorrect }, "No correct option for lang=$lang")
            }
        }
    }
}
