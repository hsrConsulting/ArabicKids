package com.arabickids.shared.data

data class ArabicWord(
    val arabic: String,
    val emoji: String,
    val translations: Map<String, String>
)

data class WordCategory(
    val emoji: String,
    val words: List<ArabicWord>
)

object WordData {
    val CATEGORIES: Map<String, WordCategory> = mapOf(
        "animals" to WordCategory("🐾", listOf(
            ArabicWord("قطة", "🐱", mapOf("fr" to "Chat", "en" to "Cat", "es" to "Gato", "de" to "Katze")),
            ArabicWord("كلب", "🐶", mapOf("fr" to "Chien", "en" to "Dog", "es" to "Perro", "de" to "Hund")),
            ArabicWord("أرنب", "🐰", mapOf("fr" to "Lapin", "en" to "Rabbit", "es" to "Conejo", "de" to "Kaninchen")),
            ArabicWord("حصان", "🐴", mapOf("fr" to "Cheval", "en" to "Horse", "es" to "Caballo", "de" to "Pferd")),
            ArabicWord("فيل", "🐘", mapOf("fr" to "Éléphant", "en" to "Elephant", "es" to "Elefante", "de" to "Elefant")),
            ArabicWord("أسد", "🦁", mapOf("fr" to "Lion", "en" to "Lion", "es" to "León", "de" to "Löwe")),
            ArabicWord("نمر", "🐯", mapOf("fr" to "Tigre", "en" to "Tiger", "es" to "Tigre", "de" to "Tiger")),
            ArabicWord("دب", "🐻", mapOf("fr" to "Ours", "en" to "Bear", "es" to "Oso", "de" to "Bär"))
        )),
        "family" to WordCategory("👨‍👩‍👧‍👦", listOf(
            ArabicWord("أم", "👩", mapOf("fr" to "Mère", "en" to "Mother", "es" to "Madre", "de" to "Mutter")),
            ArabicWord("أب", "👨", mapOf("fr" to "Père", "en" to "Father", "es" to "Padre", "de" to "Vater")),
            ArabicWord("أخ", "👦", mapOf("fr" to "Frère", "en" to "Brother", "es" to "Hermano", "de" to "Bruder")),
            ArabicWord("أخت", "👧", mapOf("fr" to "Sœur", "en" to "Sister", "es" to "Hermana", "de" to "Schwester")),
            ArabicWord("جد", "👴", mapOf("fr" to "Grand-père", "en" to "Grandfather", "es" to "Abuelo", "de" to "Großvater")),
            ArabicWord("جدة", "👵", mapOf("fr" to "Grand-mère", "en" to "Grandmother", "es" to "Abuela", "de" to "Großmutter")),
            ArabicWord("عم", "👨‍💼", mapOf("fr" to "Oncle", "en" to "Uncle", "es" to "Tío", "de" to "Onkel")),
            ArabicWord("عمة", "👩‍💼", mapOf("fr" to "Tante", "en" to "Aunt", "es" to "Tía", "de" to "Tante"))
        )),
        "colors" to WordCategory("🎨", listOf(
            ArabicWord("أحمر", "🔴", mapOf("fr" to "Rouge", "en" to "Red", "es" to "Rojo", "de" to "Rot")),
            ArabicWord("أزرق", "🔵", mapOf("fr" to "Bleu", "en" to "Blue", "es" to "Azul", "de" to "Blau")),
            ArabicWord("أخضر", "🟢", mapOf("fr" to "Vert", "en" to "Green", "es" to "Verde", "de" to "Grün")),
            ArabicWord("أصفر", "🟡", mapOf("fr" to "Jaune", "en" to "Yellow", "es" to "Amarillo", "de" to "Gelb")),
            ArabicWord("أبيض", "⚪", mapOf("fr" to "Blanc", "en" to "White", "es" to "Blanco", "de" to "Weiß")),
            ArabicWord("أسود", "⚫", mapOf("fr" to "Noir", "en" to "Black", "es" to "Negro", "de" to "Schwarz")),
            ArabicWord("برتقالي", "🟠", mapOf("fr" to "Orange", "en" to "Orange", "es" to "Naranja", "de" to "Orange")),
            ArabicWord("بنفسجي", "🟣", mapOf("fr" to "Violet", "en" to "Purple", "es" to "Morado", "de" to "Lila"))
        )),
        "numbers" to WordCategory("🔢", listOf(
            ArabicWord("واحد", "1️⃣", mapOf("fr" to "Un", "en" to "One", "es" to "Uno", "de" to "Eins")),
            ArabicWord("اثنان", "2️⃣", mapOf("fr" to "Deux", "en" to "Two", "es" to "Dos", "de" to "Zwei")),
            ArabicWord("ثلاثة", "3️⃣", mapOf("fr" to "Trois", "en" to "Three", "es" to "Tres", "de" to "Drei")),
            ArabicWord("أربعة", "4️⃣", mapOf("fr" to "Quatre", "en" to "Four", "es" to "Cuatro", "de" to "Vier")),
            ArabicWord("خمسة", "5️⃣", mapOf("fr" to "Cinq", "en" to "Five", "es" to "Cinco", "de" to "Fünf")),
            ArabicWord("ستة", "6️⃣", mapOf("fr" to "Six", "en" to "Six", "es" to "Seis", "de" to "Sechs")),
            ArabicWord("سبعة", "7️⃣", mapOf("fr" to "Sept", "en" to "Seven", "es" to "Siete", "de" to "Sieben")),
            ArabicWord("ثمانية", "8️⃣", mapOf("fr" to "Huit", "en" to "Eight", "es" to "Ocho", "de" to "Acht"))
        ))
    )

    fun getAllWords(): List<ArabicWord> = CATEGORIES.values.flatMap { it.words }

    fun getCategoryForWord(arabicWord: String): String? =
        CATEGORIES.entries.firstOrNull { (_, cat) -> cat.words.any { it.arabic == arabicWord } }?.key
}
