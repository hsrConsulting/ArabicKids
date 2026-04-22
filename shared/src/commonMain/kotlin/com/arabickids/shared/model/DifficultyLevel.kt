package com.arabickids.shared.model

enum class DifficultyLevel(
    val letterCount: Int,
    val questionCount: Int,
    val optionsCount: Int,
    val memoryPairs: Int,
    val restrictedCategoryKeys: List<String>?
) {
    BEGINNER(
        letterCount = 10,
        questionCount = 5,
        optionsCount = 3,
        memoryPairs = 4,
        restrictedCategoryKeys = listOf("animals", "colors", "family")
    ),
    NORMAL(
        letterCount = 28,
        questionCount = 8,
        optionsCount = 4,
        memoryPairs = 6,
        restrictedCategoryKeys = null
    ),
    ADVANCED(
        letterCount = 28,
        questionCount = 10,
        optionsCount = 4,
        memoryPairs = 8,
        restrictedCategoryKeys = null
    );

    companion object {
        fun fromString(value: String): DifficultyLevel =
            entries.firstOrNull { it.name.lowercase() == value.lowercase() } ?: NORMAL
    }
}
