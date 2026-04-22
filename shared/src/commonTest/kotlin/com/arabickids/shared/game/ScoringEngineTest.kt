package com.arabickids.shared.game

import com.arabickids.shared.model.AppStateData
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ScoringEngineTest {

    // ── getLevelName ───────────────────────────────────────────────────────────

    @Test
    fun getLevelName_level1_returnsBeginner() {
        assertEquals("beginner", ScoringEngine.getLevelName(1))
    }

    @Test
    fun getLevelName_level2_returnsExplorer() {
        assertEquals("explorer", ScoringEngine.getLevelName(2))
    }

    @Test
    fun getLevelName_level4_returnsExplorer() {
        assertEquals("explorer", ScoringEngine.getLevelName(4))
    }

    @Test
    fun getLevelName_level5_returnsChampion() {
        assertEquals("champion", ScoringEngine.getLevelName(5))
    }

    @Test
    fun getLevelName_level9_returnsChampion() {
        assertEquals("champion", ScoringEngine.getLevelName(9))
    }

    @Test
    fun getLevelName_level10_returnsMaster() {
        assertEquals("master", ScoringEngine.getLevelName(10))
    }

    @Test
    fun getLevelName_level99_returnsMaster() {
        assertEquals("master", ScoringEngine.getLevelName(99))
    }

    // ── checkNewBadges — lesson badges ─────────────────────────────────────────

    @Test
    fun checkNewBadges_awardsFirstLesson_afterOneLessonCompleted() {
        val state = AppStateData(lessons = 1)
        val badges = ScoringEngine.checkNewBadges(state)
        assertTrue("first_lesson" in badges)
    }

    @Test
    fun checkNewBadges_doesNotAwardFirstLesson_whenAlreadyEarned() {
        val state = AppStateData(lessons = 5, earnedBadges = listOf("first_lesson"))
        val badges = ScoringEngine.checkNewBadges(state)
        assertFalse("first_lesson" in badges)
    }

    @Test
    fun checkNewBadges_awardsLessons10_atTenLessons() {
        val state = AppStateData(lessons = 10)
        val badges = ScoringEngine.checkNewBadges(state)
        assertTrue("lessons10" in badges)
    }

    @Test
    fun checkNewBadges_noLessons10_atNineLessons() {
        val state = AppStateData(lessons = 9)
        val badges = ScoringEngine.checkNewBadges(state)
        assertFalse("lessons10" in badges)
    }

    // ── checkNewBadges — quiz badges ───────────────────────────────────────────

    @Test
    fun checkNewBadges_awardsQuiz10_atTenQuizzes() {
        val state = AppStateData(quizzes = 10)
        val badges = ScoringEngine.checkNewBadges(state)
        assertTrue("quiz10" in badges)
    }

    @Test
    fun checkNewBadges_awardsQuiz25_atTwentyFiveQuizzes() {
        val state = AppStateData(quizzes = 25)
        val badges = ScoringEngine.checkNewBadges(state)
        assertTrue("quiz25" in badges)
    }

    @Test
    fun checkNewBadges_awardsQuiz50_atFiftyQuizzes() {
        val state = AppStateData(quizzes = 50)
        val badges = ScoringEngine.checkNewBadges(state)
        assertTrue("quiz50" in badges)
    }

    // ── checkNewBadges — alphabet badges ──────────────────────────────────────

    @Test
    fun checkNewBadges_awardsAlpha5_atFiveLetters() {
        val state = AppStateData(learnedLetters = listOf("أ","ب","ت","ث","ج"))
        val badges = ScoringEngine.checkNewBadges(state)
        assertTrue("alpha5" in badges)
    }

    @Test
    fun checkNewBadges_noAlpha5_atFourLetters() {
        val state = AppStateData(learnedLetters = listOf("أ","ب","ت","ث"))
        val badges = ScoringEngine.checkNewBadges(state)
        assertFalse("alpha5" in badges)
    }

    @Test
    fun checkNewBadges_awardsAlpha28_atAllLetters() {
        val allLetters = (1..28).map { it.toString() }
        val state = AppStateData(learnedLetters = allLetters)
        val badges = ScoringEngine.checkNewBadges(state)
        assertTrue("alpha28" in badges)
    }

    // ── checkNewBadges — score badges ─────────────────────────────────────────

    @Test
    fun checkNewBadges_awardsScore100_atHundredPoints() {
        val state = AppStateData(score = 100)
        val badges = ScoringEngine.checkNewBadges(state)
        assertTrue("score100" in badges)
    }

    @Test
    fun checkNewBadges_noScore100_atNinetyNinePoints() {
        val state = AppStateData(score = 99)
        val badges = ScoringEngine.checkNewBadges(state)
        assertFalse("score100" in badges)
    }

    @Test
    fun checkNewBadges_awardsScore500_atFiveHundred() {
        val state = AppStateData(score = 500)
        val badges = ScoringEngine.checkNewBadges(state)
        assertTrue("score500" in badges)
    }

    @Test
    fun checkNewBadges_awardsScore1000_atThousand() {
        val state = AppStateData(score = 1000)
        val badges = ScoringEngine.checkNewBadges(state)
        assertTrue("score1000" in badges)
    }

    // ── checkNewBadges — polyglot badge ───────────────────────────────────────

    @Test
    fun checkNewBadges_awardsPolyglot_atFiveCategories() {
        val state = AppStateData(visitedCategories = listOf("animals","colors","family","food","nature"))
        val badges = ScoringEngine.checkNewBadges(state)
        assertTrue("polyglot" in badges)
    }

    @Test
    fun checkNewBadges_noPolyglot_atFourCategories() {
        val state = AppStateData(visitedCategories = listOf("animals","colors","family","food"))
        val badges = ScoringEngine.checkNewBadges(state)
        assertFalse("polyglot" in badges)
    }

    // ── checkNewBadges — already earned ───────────────────────────────────────

    @Test
    fun checkNewBadges_returnsEmpty_whenAllAlreadyEarned() {
        val allBadges = listOf(
            "first_lesson","lessons10","lessons25",
            "quiz10","quiz25","quiz50",
            "alpha5","alpha14","alpha28",
            "score100","score500","score1000",
            "polyglot"
        )
        val state = AppStateData(
            lessons = 30,
            quizzes = 60,
            learnedLetters = (1..28).map { it.toString() },
            score = 2000,
            visitedCategories = (1..6).map { "cat$it" },
            earnedBadges = allBadges
        )
        val badges = ScoringEngine.checkNewBadges(state)
        assertTrue(badges.isEmpty())
    }

    // ── constants ──────────────────────────────────────────────────────────────

    @Test
    fun pointsPerLesson_is5() {
        assertEquals(5, ScoringEngine.POINTS_PER_LESSON)
    }

    @Test
    fun pointsPerCorrect_is10() {
        assertEquals(10, ScoringEngine.POINTS_PER_CORRECT)
    }

    @Test
    fun pointsPerMemoryMatch_is15() {
        assertEquals(15, ScoringEngine.POINTS_PER_MEMORY_MATCH)
    }
}
