package com.arabickids.shared.game

import com.arabickids.shared.model.DifficultyLevel
import com.arabickids.shared.model.QuizType
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class QuizEngineTest {

    // ── buildLetterQuiz ────────────────────────────────────────────────────────

    @Test
    fun buildLetterQuiz_beginner_returns5Questions() {
        val session = QuizEngine.buildLetterQuiz(DifficultyLevel.BEGINNER, "en")
        assertEquals(5, session.questions.size)
    }

    @Test
    fun buildLetterQuiz_normal_returns8Questions() {
        val session = QuizEngine.buildLetterQuiz(DifficultyLevel.NORMAL, "en")
        assertEquals(8, session.questions.size)
    }

    @Test
    fun buildLetterQuiz_advanced_returns10Questions() {
        val session = QuizEngine.buildLetterQuiz(DifficultyLevel.ADVANCED, "en")
        assertEquals(10, session.questions.size)
    }

    @Test
    fun buildLetterQuiz_beginner_has3Options() {
        val session = QuizEngine.buildLetterQuiz(DifficultyLevel.BEGINNER, "en")
        session.questions.forEach { q ->
            assertEquals(3, q.options.size)
        }
    }

    @Test
    fun buildLetterQuiz_normal_has4Options() {
        val session = QuizEngine.buildLetterQuiz(DifficultyLevel.NORMAL, "en")
        session.questions.forEach { q ->
            assertEquals(4, q.options.size)
        }
    }

    @Test
    fun buildLetterQuiz_eachQuestion_hasExactlyOneCorrectOption() {
        val session = QuizEngine.buildLetterQuiz(DifficultyLevel.NORMAL, "en")
        session.questions.forEach { q ->
            assertEquals(1, q.options.count { it.isCorrect })
        }
    }

    @Test
    fun buildLetterQuiz_typeIsLetters() {
        val session = QuizEngine.buildLetterQuiz(DifficultyLevel.NORMAL, "en")
        assertEquals(QuizType.LETTERS, session.type)
        session.questions.forEach { q ->
            assertEquals(QuizType.LETTERS, q.type)
        }
    }

    @Test
    fun buildLetterQuiz_arabicTextIsNotEmpty() {
        val session = QuizEngine.buildLetterQuiz(DifficultyLevel.NORMAL, "en")
        session.questions.forEach { q ->
            assertTrue(q.arabicText.isNotEmpty())
        }
    }

    // ── buildWordQuiz ──────────────────────────────────────────────────────────

    @Test
    fun buildWordQuiz_beginner_returns5Questions() {
        val session = QuizEngine.buildWordQuiz(DifficultyLevel.BEGINNER, "en")
        assertEquals(5, session.questions.size)
    }

    @Test
    fun buildWordQuiz_normal_returns8Questions() {
        val session = QuizEngine.buildWordQuiz(DifficultyLevel.NORMAL, "en")
        assertEquals(8, session.questions.size)
    }

    @Test
    fun buildWordQuiz_beginner_has3Options() {
        val session = QuizEngine.buildWordQuiz(DifficultyLevel.BEGINNER, "en")
        session.questions.forEach { q ->
            assertEquals(3, q.options.size)
        }
    }

    @Test
    fun buildWordQuiz_eachQuestion_hasExactlyOneCorrectOption() {
        val session = QuizEngine.buildWordQuiz(DifficultyLevel.NORMAL, "en")
        session.questions.forEach { q ->
            assertEquals(1, q.options.count { it.isCorrect })
        }
    }

    @Test
    fun buildWordQuiz_typeIsWords() {
        val session = QuizEngine.buildWordQuiz(DifficultyLevel.NORMAL, "en")
        assertEquals(QuizType.WORDS, session.type)
    }

    @Test
    fun buildWordQuiz_hasEmojis() {
        val session = QuizEngine.buildWordQuiz(DifficultyLevel.NORMAL, "en")
        session.questions.forEach { q ->
            assertTrue(q.emoji != null && q.emoji.isNotEmpty())
        }
    }

    @Test
    fun buildWordQuiz_french_usesLabelsInFrench() {
        val session = QuizEngine.buildWordQuiz(DifficultyLevel.NORMAL, "fr")
        val correctLabels = session.questions.map { q ->
            q.options.first { it.isCorrect }.label
        }
        // At least some labels should differ from the Arabic text (meaning they were translated)
        val anyTranslated = correctLabels.any { label ->
            session.questions.none { q -> q.arabicText == label }
        }
        assertTrue(anyTranslated, "Expected French translations, got Arabic text for all")
    }

    // ── buildFormsQuiz ─────────────────────────────────────────────────────────

    @Test
    fun buildFormsQuiz_beginner_returns5Questions() {
        val session = QuizEngine.buildFormsQuiz(DifficultyLevel.BEGINNER)
        assertEquals(5, session.questions.size)
    }

    @Test
    fun buildFormsQuiz_normal_returns8Questions() {
        val session = QuizEngine.buildFormsQuiz(DifficultyLevel.NORMAL)
        assertEquals(8, session.questions.size)
    }

    @Test
    fun buildFormsQuiz_typeIsForms() {
        val session = QuizEngine.buildFormsQuiz(DifficultyLevel.NORMAL)
        assertEquals(QuizType.FORMS, session.type)
    }

    @Test
    fun buildFormsQuiz_eachQuestion_hasPromptField() {
        val session = QuizEngine.buildFormsQuiz(DifficultyLevel.NORMAL)
        session.questions.forEach { q ->
            assertTrue(q.prompt != null && q.prompt.isNotEmpty())
            assertTrue(q.prompt in listOf("isolated", "initial", "medial", "final"))
        }
    }

    @Test
    fun buildFormsQuiz_eachQuestion_hasExactlyOneCorrect() {
        val session = QuizEngine.buildFormsQuiz(DifficultyLevel.NORMAL)
        session.questions.forEach { q ->
            assertEquals(1, q.options.count { it.isCorrect })
        }
    }

    // ── buildAudioQuiz ─────────────────────────────────────────────────────────

    @Test
    fun buildAudioQuiz_beginner_returns5Questions() {
        val session = QuizEngine.buildAudioQuiz(DifficultyLevel.BEGINNER, "en")
        assertEquals(5, session.questions.size)
    }

    @Test
    fun buildAudioQuiz_typeIsAudio() {
        val session = QuizEngine.buildAudioQuiz(DifficultyLevel.NORMAL, "en")
        assertEquals(QuizType.AUDIO, session.type)
    }

    @Test
    fun buildAudioQuiz_eachQuestion_hasExactlyOneCorrect() {
        val session = QuizEngine.buildAudioQuiz(DifficultyLevel.NORMAL, "en")
        session.questions.forEach { q ->
            assertEquals(1, q.options.count { it.isCorrect })
        }
    }

    @Test
    fun buildAudioQuiz_correctOptionLabelMatchesArabicText() {
        val session = QuizEngine.buildAudioQuiz(DifficultyLevel.NORMAL, "en")
        session.questions.forEach { q ->
            val correctLabel = q.options.first { it.isCorrect }.label
            assertEquals(q.arabicText, correctLabel)
        }
    }

    // ── session starts fresh ───────────────────────────────────────────────────

    @Test
    fun allQuizBuilders_startAtIndexZero() {
        listOf(
            QuizEngine.buildLetterQuiz(DifficultyLevel.NORMAL, "en"),
            QuizEngine.buildWordQuiz(DifficultyLevel.NORMAL, "en"),
            QuizEngine.buildFormsQuiz(DifficultyLevel.NORMAL),
            QuizEngine.buildAudioQuiz(DifficultyLevel.NORMAL, "en")
        ).forEach { session ->
            assertEquals(0, session.currentIndex)
            assertTrue(session.results.isEmpty())
            assertTrue(!session.isDone)
        }
    }
}
