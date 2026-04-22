package com.arabickids.shared.model

data class QuizOption(
    val label: String,
    val emoji: String? = null,
    val isCorrect: Boolean
)

data class QuizQuestion(
    val type: QuizType,
    val arabicText: String,
    val prompt: String? = null,
    val emoji: String? = null,
    val options: List<QuizOption>
)

enum class QuizType {
    LETTERS, WORDS, FORMS, AUDIO, CATEGORIES, PHRASES, MATCH
}

data class QuizSession(
    val type: QuizType,
    val questions: List<QuizQuestion>,
    var currentIndex: Int = 0,
    var selectedOption: Int? = null,
    val results: MutableList<Boolean> = mutableListOf(),
    var isDone: Boolean = false
) {
    val currentQuestion: QuizQuestion get() = questions[currentIndex]
    val isLastQuestion: Boolean get() = currentIndex == questions.size - 1

    fun answerCurrent(optionIndex: Int): Boolean {
        val correct = currentQuestion.options[optionIndex].isCorrect
        results.add(correct)
        return correct
    }

    fun advance() {
        if (!isLastQuestion) {
            currentIndex++
            selectedOption = null
        } else {
            isDone = true
        }
    }

    val score: Int get() = results.count { it }
    val total: Int get() = questions.size
    val percentage: Int get() = if (total > 0) (score * 100) / total else 0
    val isPerfect: Boolean get() = isDone && results.all { it }
}
