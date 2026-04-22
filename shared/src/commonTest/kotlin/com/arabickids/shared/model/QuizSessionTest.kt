package com.arabickids.shared.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class QuizSessionTest {

    private fun makeOption(label: String, correct: Boolean) = QuizOption(label, isCorrect = correct)

    private fun makeQuestion(vararg options: QuizOption) = QuizQuestion(
        type = QuizType.LETTERS,
        arabicText = "أ",
        options = options.toList()
    )

    private fun makeSession(questionCount: Int = 3): QuizSession {
        val questions = (1..questionCount).map { i ->
            makeQuestion(
                makeOption("correct$i", true),
                makeOption("wrong${i}a", false),
                makeOption("wrong${i}b", false)
            )
        }
        return QuizSession(type = QuizType.LETTERS, questions = questions)
    }

    // ── answerCurrent ──────────────────────────────────────────────────────────

    @Test
    fun answerCurrent_returnsTrue_whenCorrectOptionSelected() {
        val session = makeSession()
        val correctIdx = session.currentQuestion.options.indexOfFirst { it.isCorrect }
        assertTrue(session.answerCurrent(correctIdx))
    }

    @Test
    fun answerCurrent_returnsFalse_whenWrongOptionSelected() {
        val session = makeSession()
        val wrongIdx = session.currentQuestion.options.indexOfFirst { !it.isCorrect }
        assertFalse(session.answerCurrent(wrongIdx))
    }

    @Test
    fun answerCurrent_appendsResultToList() {
        val session = makeSession()
        assertEquals(0, session.results.size)
        session.answerCurrent(0)
        assertEquals(1, session.results.size)
    }

    // ── advance ────────────────────────────────────────────────────────────────

    @Test
    fun advance_incrementsCurrentIndex() {
        val session = makeSession(3)
        assertEquals(0, session.currentIndex)
        session.advance()
        assertEquals(1, session.currentIndex)
    }

    @Test
    fun advance_setsIsDone_onLastQuestion() {
        val session = makeSession(1)
        assertFalse(session.isDone)
        session.advance()
        assertTrue(session.isDone)
    }

    @Test
    fun advance_doesNotIncrementBeyondLast() {
        val session = makeSession(2)
        session.advance() // index -> 1 (last)
        session.advance() // should mark done, not increment further
        assertTrue(session.isDone)
        assertEquals(1, session.currentIndex)
    }

    // ── score / total / percentage ─────────────────────────────────────────────

    @Test
    fun score_countsOnlyCorrectResults() {
        val session = makeSession(3)
        session.results.addAll(listOf(true, false, true))
        assertEquals(2, session.score)
    }

    @Test
    fun total_matchesQuestionListSize() {
        val session = makeSession(5)
        assertEquals(5, session.total)
    }

    @Test
    fun percentage_calculatesCorrectly() {
        val session = makeSession(4)
        session.results.addAll(listOf(true, true, false, false))
        assertEquals(50, session.percentage)
    }

    @Test
    fun percentage_returnsZero_whenNoQuestions() {
        val session = QuizSession(type = QuizType.LETTERS, questions = emptyList())
        assertEquals(0, session.percentage)
    }

    // ── isPerfect ──────────────────────────────────────────────────────────────

    @Test
    fun isPerfect_trueWhenAllCorrectAndDone() {
        val session = makeSession(2)
        session.results.addAll(listOf(true, true))
        session.isDone = true
        assertTrue(session.isPerfect)
    }

    @Test
    fun isPerfect_falseWhenNotDone() {
        val session = makeSession(2)
        session.results.addAll(listOf(true, true))
        assertFalse(session.isPerfect)
    }

    @Test
    fun isPerfect_falseWhenOneWrong() {
        val session = makeSession(2)
        session.results.addAll(listOf(true, false))
        session.isDone = true
        assertFalse(session.isPerfect)
    }

    // ── isLastQuestion ─────────────────────────────────────────────────────────

    @Test
    fun isLastQuestion_trueWhenOnlyOneQuestion() {
        val session = makeSession(1)
        assertTrue(session.isLastQuestion)
    }

    @Test
    fun isLastQuestion_falseWhenNotAtEnd() {
        val session = makeSession(3)
        assertFalse(session.isLastQuestion)
    }
}
