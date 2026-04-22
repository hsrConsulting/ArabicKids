package com.arabickids.shared.model

import kotlinx.serialization.Serializable

@Serializable
data class UserProfile(
    val name: String,
    val avatar: String,
    val code: String
)

@Serializable
data class AppStateData(
    val user: UserProfile? = null,
    val lang: String = "en",
    val score: Int = 0,
    val level: Int = 1,
    val lessons: Int = 0,
    val quizzes: Int = 0,
    val learnedLetters: List<String> = emptyList(),
    val earnedBadges: List<String> = emptyList(),
    val visitedCategories: List<String> = emptyList(),
    val ratingDone: Boolean = false,
    val difficulty: String = "normal"
) {
    val difficultyLevel: DifficultyLevel get() = DifficultyLevel.fromString(difficulty)

    fun withScore(added: Int): AppStateData = copy(
        score = score + added,
        level = (score + added) / 100 + 1
    )

    fun withLearnedLetter(letter: String): AppStateData =
        if (letter in learnedLetters) this
        else copy(learnedLetters = learnedLetters + letter)

    fun withBadge(badgeId: String): AppStateData =
        if (badgeId in earnedBadges) this
        else copy(earnedBadges = earnedBadges + badgeId)

    fun withVisitedCategory(categoryKey: String): AppStateData =
        if (categoryKey in visitedCategories) this
        else copy(visitedCategories = visitedCategories + categoryKey)
}
