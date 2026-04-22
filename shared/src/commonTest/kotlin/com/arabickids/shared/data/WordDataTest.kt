package com.arabickids.shared.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class WordDataTest {

    // ── categories ─────────────────────────────────────────────────────────────

    @Test
    fun categories_containsAnimals() {
        assertTrue("animals" in WordData.CATEGORIES)
    }

    @Test
    fun categories_containsFamily() {
        assertTrue("family" in WordData.CATEGORIES)
    }

    @Test
    fun categories_containsColors() {
        assertTrue("colors" in WordData.CATEGORIES)
    }

    @Test
    fun categories_containsNumbers() {
        assertTrue("numbers" in WordData.CATEGORIES)
    }

    @Test
    fun eachCategory_hasAtLeast4Words() {
        WordData.CATEGORIES.forEach { (key, cat) ->
            assertTrue(cat.words.size >= 4, "Category $key has too few words: ${cat.words.size}")
        }
    }

    @Test
    fun eachCategory_hasEmoji() {
        WordData.CATEGORIES.forEach { (key, cat) ->
            assertTrue(cat.emoji.isNotEmpty(), "Category $key has no emoji")
        }
    }

    // ── word integrity ─────────────────────────────────────────────────────────

    @Test
    fun allWords_haveNonEmptyArabic() {
        WordData.getAllWords().forEach { word ->
            assertTrue(word.arabic.isNotEmpty(), "Empty arabic field found")
        }
    }

    @Test
    fun allWords_haveNonEmptyEmoji() {
        WordData.getAllWords().forEach { word ->
            assertTrue(word.emoji.isNotEmpty(), "Empty emoji for word ${word.arabic}")
        }
    }

    @Test
    fun allWords_haveEnglishTranslation() {
        WordData.getAllWords().forEach { word ->
            assertTrue("en" in word.translations, "Missing English translation for ${word.arabic}")
        }
    }

    @Test
    fun allWords_haveFrenchTranslation() {
        WordData.getAllWords().forEach { word ->
            assertTrue("fr" in word.translations, "Missing French translation for ${word.arabic}")
        }
    }

    @Test
    fun allWords_haveUniqueArabicText() {
        val all = WordData.getAllWords().map { it.arabic }
        assertEquals(all.size, all.toSet().size, "Duplicate Arabic words found")
    }

    // ── getAllWords ─────────────────────────────────────────────────────────────

    @Test
    fun getAllWords_returnsAllWordsFromAllCategories() {
        val expected = WordData.CATEGORIES.values.sumOf { it.words.size }
        assertEquals(expected, WordData.getAllWords().size)
    }

    @Test
    fun getAllWords_isNotEmpty() {
        assertTrue(WordData.getAllWords().isNotEmpty())
    }

    // ── getCategoryForWord ─────────────────────────────────────────────────────

    @Test
    fun getCategoryForWord_findsAnimalCategory() {
        val cat = WordData.getCategoryForWord("قطة")
        assertEquals("animals", cat)
    }

    @Test
    fun getCategoryForWord_findsFamilyCategory() {
        val cat = WordData.getCategoryForWord("أم")
        assertEquals("family", cat)
    }

    @Test
    fun getCategoryForWord_returnsNull_forUnknownWord() {
        val cat = WordData.getCategoryForWord("كلمة_غير_موجودة")
        assertNull(cat)
    }

    // ── beginner category keys exist ──────────────────────────────────────────

    @Test
    fun beginnerCategories_allExist() {
        val beginnerKeys = listOf("animals", "colors", "family")
        beginnerKeys.forEach { key ->
            assertNotNull(WordData.CATEGORIES[key], "Beginner category '$key' missing from WordData")
        }
    }
}
