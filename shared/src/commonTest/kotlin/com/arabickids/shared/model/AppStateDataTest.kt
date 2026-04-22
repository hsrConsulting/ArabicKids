package com.arabickids.shared.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AppStateDataTest {

    private val base = AppStateData()

    // ── withScore ──────────────────────────────────────────────────────────────

    @Test
    fun withScore_addsPoints() {
        val updated = base.withScore(50)
        assertEquals(50, updated.score)
    }

    @Test
    fun withScore_isImmutable_originalUnchanged() {
        base.withScore(100)
        assertEquals(0, base.score)
    }

    @Test
    fun withScore_levelBumpsAt100Points() {
        val atLevel2 = base.withScore(100)
        assertEquals(2, atLevel2.level)
    }

    @Test
    fun withScore_levelBumpsAt200Points() {
        val atLevel3 = base.withScore(200)
        assertEquals(3, atLevel3.level)
    }

    @Test
    fun withScore_startsAtLevel1() {
        assertEquals(1, base.level)
    }

    // ── withLearnedLetter ──────────────────────────────────────────────────────

    @Test
    fun withLearnedLetter_addsLetter() {
        val updated = base.withLearnedLetter("أ")
        assertTrue("أ" in updated.learnedLetters)
    }

    @Test
    fun withLearnedLetter_noDuplicates() {
        val once = base.withLearnedLetter("أ")
        val twice = once.withLearnedLetter("أ")
        assertEquals(1, twice.learnedLetters.size)
    }

    @Test
    fun withLearnedLetter_accumulates() {
        val updated = base.withLearnedLetter("أ").withLearnedLetter("ب").withLearnedLetter("ت")
        assertEquals(3, updated.learnedLetters.size)
    }

    // ── withBadge ──────────────────────────────────────────────────────────────

    @Test
    fun withBadge_addsBadge() {
        val updated = base.withBadge("first_lesson")
        assertTrue("first_lesson" in updated.earnedBadges)
    }

    @Test
    fun withBadge_noDuplicates() {
        val once = base.withBadge("first_lesson")
        val twice = once.withBadge("first_lesson")
        assertEquals(1, twice.earnedBadges.size)
    }

    // ── withVisitedCategory ────────────────────────────────────────────────────

    @Test
    fun withVisitedCategory_addsCategory() {
        val updated = base.withVisitedCategory("animals")
        assertTrue("animals" in updated.visitedCategories)
    }

    @Test
    fun withVisitedCategory_noDuplicates() {
        val once = base.withVisitedCategory("animals")
        val twice = once.withVisitedCategory("animals")
        assertEquals(1, twice.visitedCategories.size)
    }

    // ── difficultyLevel ────────────────────────────────────────────────────────

    @Test
    fun difficultyLevel_defaultIsNormal() {
        assertEquals(DifficultyLevel.NORMAL, base.difficultyLevel)
    }

    @Test
    fun difficultyLevel_parsesBeginnerCaseInsensitive() {
        val state = base.copy(difficulty = "BEGINNER")
        assertEquals(DifficultyLevel.BEGINNER, state.difficultyLevel)
    }

    @Test
    fun difficultyLevel_parsesAdvanced() {
        val state = base.copy(difficulty = "advanced")
        assertEquals(DifficultyLevel.ADVANCED, state.difficultyLevel)
    }

    @Test
    fun difficultyLevel_fallsBackToNormal_onUnknownValue() {
        val state = base.copy(difficulty = "unknown_level")
        assertEquals(DifficultyLevel.NORMAL, state.difficultyLevel)
    }
}
