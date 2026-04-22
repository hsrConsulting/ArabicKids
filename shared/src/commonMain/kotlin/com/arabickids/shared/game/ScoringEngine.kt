package com.arabickids.shared.game

import com.arabickids.shared.model.AppStateData

object ScoringEngine {

    private val BADGE_RULES: List<Pair<String, (AppStateData) -> Boolean>> = listOf(
        "first_lesson"  to { it.lessons >= 1 },
        "lessons10"     to { it.lessons >= 10 },
        "lessons25"     to { it.lessons >= 25 },
        "quiz10"        to { it.quizzes >= 10 },
        "quiz25"        to { it.quizzes >= 25 },
        "quiz50"        to { it.quizzes >= 50 },
        "alpha5"        to { it.learnedLetters.size >= 5 },
        "alpha14"       to { it.learnedLetters.size >= 14 },
        "alpha28"       to { it.learnedLetters.size >= 28 },
        "score100"      to { it.score >= 100 },
        "score500"      to { it.score >= 500 },
        "score1000"     to { it.score >= 1000 },
        "polyglot"      to { it.visitedCategories.size >= 5 }
    )

    fun checkNewBadges(state: AppStateData): List<String> =
        BADGE_RULES
            .filter { (id, condition) -> id !in state.earnedBadges && condition(state) }
            .map { (id, _) -> id }

    fun getLevelName(level: Int): String = when {
        level >= 10 -> "master"
        level >= 5  -> "champion"
        level >= 2  -> "explorer"
        else        -> "beginner"
    }

    const val POINTS_PER_LESSON = 5
    const val POINTS_PER_CORRECT = 10
    const val POINTS_PER_MEMORY_MATCH = 15
}
