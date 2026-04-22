package com.arabickids.shared.game

import com.arabickids.shared.data.AlphabetData
import com.arabickids.shared.data.WordData
import com.arabickids.shared.model.*

object QuizEngine {

    private fun <T> List<T>.shuffled(): List<T> = toMutableList().also { it.shuffle() }

    fun buildLetterQuiz(difficulty: DifficultyLevel, lang: String): QuizSession {
        val pool = AlphabetData.ALPHABET.take(difficulty.letterCount)
        val picked = pool.shuffled().take(difficulty.questionCount)
        val questions = picked.map { correct ->
            val others = pool.filter { it.letter != correct.letter }
                .shuffled().take(difficulty.optionsCount - 1)
            QuizQuestion(
                type = QuizType.LETTERS,
                arabicText = correct.letter,
                options = (listOf(QuizOption(correct.nameEn, isCorrect = true)) +
                        others.map { QuizOption(it.nameEn, isCorrect = false) }).shuffled()
            )
        }
        return QuizSession(type = QuizType.LETTERS, questions = questions)
    }

    fun buildWordQuiz(difficulty: DifficultyLevel, lang: String): QuizSession {
        val all = if (difficulty.restrictedCategoryKeys != null)
            difficulty.restrictedCategoryKeys.flatMap { WordData.CATEGORIES[it]?.words ?: emptyList() }
        else WordData.getAllWords()

        val picked = all.shuffled().take(difficulty.questionCount)
        val questions = picked.map { correct ->
            val others = all.filter { it.arabic != correct.arabic }
                .shuffled().take(difficulty.optionsCount - 1)
            val label = correct.translations[lang] ?: correct.translations["en"] ?: correct.arabic
            QuizQuestion(
                type = QuizType.WORDS,
                arabicText = correct.arabic,
                emoji = correct.emoji,
                options = (listOf(QuizOption(label, correct.emoji, isCorrect = true)) +
                        others.map { w ->
                            val wLabel = w.translations[lang] ?: w.translations["en"] ?: w.arabic
                            QuizOption(wLabel, w.emoji, isCorrect = false)
                        }).shuffled()
            )
        }
        return QuizSession(type = QuizType.WORDS, questions = questions)
    }

    fun buildFormsQuiz(difficulty: DifficultyLevel): QuizSession {
        val pool = AlphabetData.ALPHABET.take(difficulty.letterCount).filter { it.forms.isolated != null }
        val picked = pool.shuffled().take(difficulty.questionCount)
        val formNames = listOf("isolated", "initial", "medial", "final")

        val questions = picked.map { letter ->
            val availableForms = buildList {
                letter.forms.isolated?.let { add("isolated" to it) }
                letter.forms.initial?.let { add("initial" to it) }
                letter.forms.medial?.let { add("medial" to it) }
                letter.forms.final?.let { add("final" to it) }
            }
            val (targetName, targetForm) = availableForms.random()
            val correctChar = targetForm.char

            val others = pool.filter { it.letter != letter.letter }.shuffled()
                .take(difficulty.optionsCount - 1)
                .map { other ->
                    val otherForms = buildList {
                        other.forms.isolated?.let { add(it) }
                        other.forms.initial?.let { add(it) }
                        other.forms.medial?.let { add(it) }
                        other.forms.final?.let { add(it) }
                    }
                    otherForms.random().char
                }

            QuizQuestion(
                type = QuizType.FORMS,
                arabicText = letter.letter,
                prompt = targetName,
                options = (listOf(QuizOption(correctChar, isCorrect = true)) +
                        others.map { QuizOption(it, isCorrect = false) }).shuffled()
            )
        }
        return QuizSession(type = QuizType.FORMS, questions = questions)
    }

    fun buildAudioQuiz(difficulty: DifficultyLevel, lang: String): QuizSession {
        val all = if (difficulty.restrictedCategoryKeys != null)
            difficulty.restrictedCategoryKeys.flatMap { WordData.CATEGORIES[it]?.words ?: emptyList() }
        else WordData.getAllWords()

        val picked = all.shuffled().take(difficulty.questionCount)
        val questions = picked.map { correct ->
            val others = all.filter { it.arabic != correct.arabic }
                .shuffled().take(difficulty.optionsCount - 1)
            QuizQuestion(
                type = QuizType.AUDIO,
                arabicText = correct.arabic,
                emoji = correct.emoji,
                options = (listOf(QuizOption(correct.arabic, isCorrect = true)) +
                        others.map { QuizOption(it.arabic, isCorrect = false) }).shuffled()
            )
        }
        return QuizSession(type = QuizType.AUDIO, questions = questions)
    }
}
