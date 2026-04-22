package com.arabickids.shared.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class AlphabetDataTest {

    // ── completeness ───────────────────────────────────────────────────────────

    @Test
    fun alphabet_has28Letters() {
        assertEquals(28, AlphabetData.ALPHABET.size)
    }

    @Test
    fun allLetters_haveUniqueArabicCharacters() {
        val letters = AlphabetData.ALPHABET.map { it.letter }
        assertEquals(letters.size, letters.toSet().size, "Duplicate Arabic letters found")
    }

    @Test
    fun allLetters_haveUniqueEnglishNames() {
        val names = AlphabetData.ALPHABET.map { it.nameEn }
        assertEquals(names.size, names.toSet().size, "Duplicate English names found")
    }

    // ── fields not empty ──────────────────────────────────────────────────────

    @Test
    fun allLetters_haveNonEmptyLetter() {
        AlphabetData.ALPHABET.forEach { letter ->
            assertTrue(letter.letter.isNotEmpty(), "Empty letter field for ${letter.nameEn}")
        }
    }

    @Test
    fun allLetters_haveNonEmptyNameEn() {
        AlphabetData.ALPHABET.forEach { letter ->
            assertTrue(letter.nameEn.isNotEmpty(), "Empty nameEn for letter ${letter.letter}")
        }
    }

    @Test
    fun allLetters_haveNonEmptyNameAr() {
        AlphabetData.ALPHABET.forEach { letter ->
            assertTrue(letter.nameAr.isNotEmpty(), "Empty nameAr for letter ${letter.letter}")
        }
    }

    @Test
    fun allLetters_haveNonEmptyWord() {
        AlphabetData.ALPHABET.forEach { letter ->
            assertTrue(letter.word.isNotEmpty(), "Empty word for letter ${letter.letter}")
        }
    }

    @Test
    fun allLetters_haveNonEmptyEmoji() {
        AlphabetData.ALPHABET.forEach { letter ->
            assertTrue(letter.emoji.isNotEmpty(), "Empty emoji for letter ${letter.letter}")
        }
    }

    @Test
    fun allLetters_haveNonEmptyColor() {
        AlphabetData.ALPHABET.forEach { letter ->
            assertTrue(letter.color.startsWith("#"), "Color should start with # for ${letter.letter}")
        }
    }

    // ── forms ─────────────────────────────────────────────────────────────────

    @Test
    fun allLetters_haveIsolatedForm() {
        AlphabetData.ALPHABET.forEach { letter ->
            assertNotNull(letter.forms.isolated, "Missing isolated form for ${letter.letter}")
        }
    }

    @Test
    fun allLetters_haveInitialForm() {
        AlphabetData.ALPHABET.forEach { letter ->
            assertNotNull(letter.forms.initial, "Missing initial form for ${letter.letter}")
        }
    }

    @Test
    fun allLetters_haveFinalForm() {
        AlphabetData.ALPHABET.forEach { letter ->
            assertNotNull(letter.forms.final, "Missing final form for ${letter.letter}")
        }
    }

    @Test
    fun formChars_areNotEmpty() {
        AlphabetData.ALPHABET.forEach { letter ->
            letter.forms.isolated?.let { assertTrue(it.char.isNotEmpty()) }
            letter.forms.initial?.let { assertTrue(it.char.isNotEmpty()) }
            letter.forms.medial?.let { assertTrue(it.char.isNotEmpty()) }
            letter.forms.final?.let { assertTrue(it.char.isNotEmpty()) }
        }
    }

    // ── translations ──────────────────────────────────────────────────────────

    @Test
    fun allLetters_haveWordMeaning_inFrench() {
        AlphabetData.ALPHABET.forEach { letter ->
            assertTrue("fr" in letter.wordMeaning, "Missing French wordMeaning for ${letter.letter}")
        }
    }

    @Test
    fun allLetters_haveWordMeaning_inEnglish() {
        AlphabetData.ALPHABET.forEach { letter ->
            assertTrue("en" in letter.wordMeaning, "Missing English wordMeaning for ${letter.letter}")
        }
    }

    // ── specific letters ──────────────────────────────────────────────────────

    @Test
    fun firstLetter_isAlif() {
        val first = AlphabetData.ALPHABET.first()
        assertEquals("أ", first.letter)
        assertEquals("Alif", first.nameEn)
    }

    @Test
    fun lastLetter_isYa() {
        val last = AlphabetData.ALPHABET.last()
        assertEquals("ي", last.letter)
        assertEquals("Ya", last.nameEn)
    }

    // ── non-connecting letters have no medial form ────────────────────────────

    @Test
    fun nonConnectingLetters_haveNoMedialForm() {
        val nonConnecting = listOf("د", "ذ", "ر", "ز", "و")
        AlphabetData.ALPHABET
            .filter { it.letter in nonConnecting }
            .forEach { letter ->
                assertEquals(null, letter.forms.medial,
                    "${letter.letter} (${letter.nameEn}) should not have a medial form")
            }
    }
}
