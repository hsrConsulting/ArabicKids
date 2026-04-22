package com.arabickids.shared.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class DifficultyLevelTest {

    // ── fromString ─────────────────────────────────────────────────────────────

    @Test
    fun fromString_parsesBeginnerLowercase() {
        assertEquals(DifficultyLevel.BEGINNER, DifficultyLevel.fromString("beginner"))
    }

    @Test
    fun fromString_parsesNormalLowercase() {
        assertEquals(DifficultyLevel.NORMAL, DifficultyLevel.fromString("normal"))
    }

    @Test
    fun fromString_parsesAdvancedLowercase() {
        assertEquals(DifficultyLevel.ADVANCED, DifficultyLevel.fromString("advanced"))
    }

    @Test
    fun fromString_isCaseInsensitive() {
        assertEquals(DifficultyLevel.BEGINNER, DifficultyLevel.fromString("BEGINNER"))
        assertEquals(DifficultyLevel.NORMAL,   DifficultyLevel.fromString("Normal"))
        assertEquals(DifficultyLevel.ADVANCED, DifficultyLevel.fromString("ADVANCED"))
    }

    @Test
    fun fromString_fallsBackToNormal_onEmptyString() {
        assertEquals(DifficultyLevel.NORMAL, DifficultyLevel.fromString(""))
    }

    @Test
    fun fromString_fallsBackToNormal_onGarbage() {
        assertEquals(DifficultyLevel.NORMAL, DifficultyLevel.fromString("xyz"))
    }

    // ── config values ──────────────────────────────────────────────────────────

    @Test
    fun beginner_has10Letters() {
        assertEquals(10, DifficultyLevel.BEGINNER.letterCount)
    }

    @Test
    fun beginner_has5Questions() {
        assertEquals(5, DifficultyLevel.BEGINNER.questionCount)
    }

    @Test
    fun beginner_has3Options() {
        assertEquals(3, DifficultyLevel.BEGINNER.optionsCount)
    }

    @Test
    fun beginner_restrictsToThreeCategories() {
        val keys = DifficultyLevel.BEGINNER.restrictedCategoryKeys
        assertNotNull(keys)
        assertEquals(listOf("animals", "colors", "family"), keys)
    }

    @Test
    fun normal_has28Letters() {
        assertEquals(28, DifficultyLevel.NORMAL.letterCount)
    }

    @Test
    fun normal_has4Options() {
        assertEquals(4, DifficultyLevel.NORMAL.optionsCount)
    }

    @Test
    fun normal_hasNoCategoryRestriction() {
        assertNull(DifficultyLevel.NORMAL.restrictedCategoryKeys)
    }

    @Test
    fun advanced_has10Questions() {
        assertEquals(10, DifficultyLevel.ADVANCED.questionCount)
    }

    @Test
    fun advanced_has8MemoryPairs() {
        assertEquals(8, DifficultyLevel.ADVANCED.memoryPairs)
    }

    @Test
    fun advanced_hasNoCategoryRestriction() {
        assertNull(DifficultyLevel.ADVANCED.restrictedCategoryKeys)
    }

    // ── ordering ───────────────────────────────────────────────────────────────

    @Test
    fun questionCount_increasesWithDifficulty() {
        assertTrue(DifficultyLevel.BEGINNER.questionCount < DifficultyLevel.NORMAL.questionCount)
        assertTrue(DifficultyLevel.NORMAL.questionCount  < DifficultyLevel.ADVANCED.questionCount)
    }

    @Test
    fun memoryPairs_increasesWithDifficulty() {
        assertTrue(DifficultyLevel.BEGINNER.memoryPairs < DifficultyLevel.NORMAL.memoryPairs)
        assertTrue(DifficultyLevel.NORMAL.memoryPairs   < DifficultyLevel.ADVANCED.memoryPairs)
    }
}

private fun assertTrue(value: Boolean) = kotlin.test.assertTrue(value)
