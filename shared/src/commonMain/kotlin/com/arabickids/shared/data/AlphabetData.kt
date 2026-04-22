package com.arabickids.shared.data

data class LetterForm(
    val char: String,
    val example: String,
    val meaning: Map<String, String>
)

data class LetterForms(
    val isolated: LetterForm?,
    val initial: LetterForm?,
    val medial: LetterForm?,
    val final: LetterForm?
)

data class AlphabetLetter(
    val letter: String,
    val nameEn: String,
    val nameAr: String,
    val word: String,
    val wordMeaning: Map<String, String>,
    val emoji: String,
    val color: String,
    val forms: LetterForms
)

object AlphabetData {
    val ALPHABET: List<AlphabetLetter> = listOf(
        AlphabetLetter(
            letter = "أ", nameEn = "Alif", nameAr = "ألف",
            word = "أرنب", wordMeaning = mapOf("fr" to "Lapin", "en" to "Rabbit", "es" to "Conejo", "de" to "Kaninchen", "tr" to "Tavşan", "hi" to "खरगोश", "id" to "Kelinci", "it" to "Coniglio"),
            emoji = "🐰", color = "#FF6B6B",
            forms = LetterForms(
                isolated = LetterForm("ا", "أنا", mapOf("fr" to "Moi", "en" to "Me", "es" to "Yo", "de" to "Ich")),
                initial  = LetterForm("أ", "أرنب", mapOf("fr" to "Lapin", "en" to "Rabbit")),
                medial   = LetterForm("ـا", "كتاب", mapOf("fr" to "Livre", "en" to "Book")),
                final    = LetterForm("ـا", "ماما", mapOf("fr" to "Maman", "en" to "Mom"))
            )
        ),
        AlphabetLetter(
            letter = "ب", nameEn = "Ba", nameAr = "باء",
            word = "بطة", wordMeaning = mapOf("fr" to "Canard", "en" to "Duck", "es" to "Pato", "de" to "Ente", "tr" to "Ördek", "hi" to "बत्तख", "id" to "Bebek", "it" to "Anatra"),
            emoji = "🦆", color = "#4ECDC4",
            forms = LetterForms(
                isolated = LetterForm("ب", "باب", mapOf("fr" to "Porte", "en" to "Door")),
                initial  = LetterForm("بـ", "بيت", mapOf("fr" to "Maison", "en" to "House")),
                medial   = LetterForm("ـبـ", "كبير", mapOf("fr" to "Grand", "en" to "Big")),
                final    = LetterForm("ـب", "كلب", mapOf("fr" to "Chien", "en" to "Dog"))
            )
        ),
        AlphabetLetter(
            letter = "ت", nameEn = "Ta", nameAr = "تاء",
            word = "تفاحة", wordMeaning = mapOf("fr" to "Pomme", "en" to "Apple", "es" to "Manzana", "de" to "Apfel", "tr" to "Elma", "hi" to "सेब", "id" to "Apel", "it" to "Mela"),
            emoji = "🍎", color = "#45B7D1",
            forms = LetterForms(
                isolated = LetterForm("ت", "تمر", mapOf("fr" to "Dattes", "en" to "Dates")),
                initial  = LetterForm("تـ", "تفاحة", mapOf("fr" to "Pomme", "en" to "Apple")),
                medial   = LetterForm("ـتـ", "كتاب", mapOf("fr" to "Livre", "en" to "Book")),
                final    = LetterForm("ـت", "بيت", mapOf("fr" to "Maison", "en" to "House"))
            )
        ),
        AlphabetLetter(
            letter = "ث", nameEn = "Tha", nameAr = "ثاء",
            word = "ثعلب", wordMeaning = mapOf("fr" to "Renard", "en" to "Fox", "es" to "Zorro", "de" to "Fuchs", "tr" to "Tilki", "hi" to "लोमड़ी", "id" to "Rubah", "it" to "Volpe"),
            emoji = "🦊", color = "#F7DC6F",
            forms = LetterForms(
                isolated = LetterForm("ث", "ثوب", mapOf("fr" to "Robe", "en" to "Dress")),
                initial  = LetterForm("ثـ", "ثعلب", mapOf("fr" to "Renard", "en" to "Fox")),
                medial   = LetterForm("ـثـ", "مثلث", mapOf("fr" to "Triangle", "en" to "Triangle")),
                final    = LetterForm("ـث", "ثلث", mapOf("fr" to "Tiers", "en" to "Third"))
            )
        ),
        AlphabetLetter(
            letter = "ج", nameEn = "Jim", nameAr = "جيم",
            word = "جمل", wordMeaning = mapOf("fr" to "Chameau", "en" to "Camel", "es" to "Camello", "de" to "Kamel", "tr" to "Deve", "hi" to "ऊँट", "id" to "Unta", "it" to "Cammello"),
            emoji = "🐪", color = "#BB8FCE",
            forms = LetterForms(
                isolated = LetterForm("ج", "جبل", mapOf("fr" to "Montagne", "en" to "Mountain")),
                initial  = LetterForm("جـ", "جمل", mapOf("fr" to "Chameau", "en" to "Camel")),
                medial   = LetterForm("ـجـ", "رجل", mapOf("fr" to "Homme", "en" to "Man")),
                final    = LetterForm("ـج", "ثلج", mapOf("fr" to "Neige", "en" to "Snow"))
            )
        ),
        AlphabetLetter(
            letter = "ح", nameEn = "Ha", nameAr = "حاء",
            word = "حصان", wordMeaning = mapOf("fr" to "Cheval", "en" to "Horse", "es" to "Caballo", "de" to "Pferd", "tr" to "At", "hi" to "घोड़ा", "id" to "Kuda", "it" to "Cavallo"),
            emoji = "🐴", color = "#F1948A",
            forms = LetterForms(
                isolated = LetterForm("ح", "حب", mapOf("fr" to "Amour", "en" to "Love")),
                initial  = LetterForm("حـ", "حليب", mapOf("fr" to "Lait", "en" to "Milk")),
                medial   = LetterForm("ـحـ", "بحر", mapOf("fr" to "Mer", "en" to "Sea")),
                final    = LetterForm("ـح", "صباح", mapOf("fr" to "Matin", "en" to "Morning"))
            )
        ),
        AlphabetLetter(
            letter = "خ", nameEn = "Kha", nameAr = "خاء",
            word = "خروف", wordMeaning = mapOf("fr" to "Mouton", "en" to "Sheep", "es" to "Oveja", "de" to "Schaf", "tr" to "Koyun", "hi" to "भेड़", "id" to "Domba", "it" to "Pecora"),
            emoji = "🐑", color = "#82E0AA",
            forms = LetterForms(
                isolated = LetterForm("خ", "خبز", mapOf("fr" to "Pain", "en" to "Bread")),
                initial  = LetterForm("خـ", "خروف", mapOf("fr" to "Mouton", "en" to "Sheep")),
                medial   = LetterForm("ـخـ", "نخلة", mapOf("fr" to "Palmier", "en" to "Palm tree")),
                final    = LetterForm("ـخ", "مطبخ", mapOf("fr" to "Cuisine", "en" to "Kitchen"))
            )
        ),
        AlphabetLetter(
            letter = "د", nameEn = "Dal", nameAr = "دال",
            word = "ديك", wordMeaning = mapOf("fr" to "Coq", "en" to "Rooster", "es" to "Gallo", "de" to "Hahn", "tr" to "Horoz", "hi" to "मुर्गा", "id" to "Ayam jantan", "it" to "Gallo"),
            emoji = "🐓", color = "#F8C471",
            forms = LetterForms(
                isolated = LetterForm("د", "دب", mapOf("fr" to "Ours", "en" to "Bear")),
                initial  = LetterForm("د", "ديك", mapOf("fr" to "Coq", "en" to "Rooster")),
                medial   = null,
                final    = LetterForm("ـد", "ولد", mapOf("fr" to "Garçon", "en" to "Boy"))
            )
        ),
        AlphabetLetter(
            letter = "ذ", nameEn = "Dhal", nameAr = "ذال",
            word = "ذئب", wordMeaning = mapOf("fr" to "Loup", "en" to "Wolf", "es" to "Lobo", "de" to "Wolf", "tr" to "Kurt", "hi" to "भेड़िया", "id" to "Serigala", "it" to "Lupo"),
            emoji = "🐺", color = "#85C1E9",
            forms = LetterForms(
                isolated = LetterForm("ذ", "ذهب", mapOf("fr" to "Or", "en" to "Gold")),
                initial  = LetterForm("ذ", "ذئب", mapOf("fr" to "Loup", "en" to "Wolf")),
                medial   = null,
                final    = LetterForm("ـذ", "تلميذ", mapOf("fr" to "Élève", "en" to "Student"))
            )
        ),
        AlphabetLetter(
            letter = "ر", nameEn = "Ra", nameAr = "راء",
            word = "رمان", wordMeaning = mapOf("fr" to "Grenade", "en" to "Pomegranate", "es" to "Granada", "de" to "Granatapfel", "tr" to "Nar", "hi" to "अनार", "id" to "Delima", "it" to "Melograno"),
            emoji = "🥭", color = "#E74C3C",
            forms = LetterForms(
                isolated = LetterForm("ر", "رجل", mapOf("fr" to "Homme", "en" to "Man")),
                initial  = LetterForm("ر", "رمان", mapOf("fr" to "Grenade", "en" to "Pomegranate")),
                medial   = null,
                final    = LetterForm("ـر", "بحر", mapOf("fr" to "Mer", "en" to "Sea"))
            )
        ),
        AlphabetLetter(
            letter = "ز", nameEn = "Zay", nameAr = "زاي",
            word = "زهرة", wordMeaning = mapOf("fr" to "Fleur", "en" to "Flower", "es" to "Flor", "de" to "Blume", "tr" to "Çiçek", "hi" to "फूल", "id" to "Bunga", "it" to "Fiore"),
            emoji = "🌸", color = "#FF69B4",
            forms = LetterForms(
                isolated = LetterForm("ز", "زيت", mapOf("fr" to "Huile", "en" to "Oil")),
                initial  = LetterForm("ز", "زهرة", mapOf("fr" to "Fleur", "en" to "Flower")),
                medial   = null,
                final    = LetterForm("ـز", "خبز", mapOf("fr" to "Pain", "en" to "Bread"))
            )
        ),
        AlphabetLetter(
            letter = "س", nameEn = "Sin", nameAr = "سين",
            word = "سمكة", wordMeaning = mapOf("fr" to "Poisson", "en" to "Fish", "es" to "Pez", "de" to "Fisch", "tr" to "Balık", "hi" to "मछली", "id" to "Ikan", "it" to "Pesce"),
            emoji = "🐟", color = "#3498DB",
            forms = LetterForms(
                isolated = LetterForm("س", "سلام", mapOf("fr" to "Paix", "en" to "Peace")),
                initial  = LetterForm("سـ", "سمكة", mapOf("fr" to "Poisson", "en" to "Fish")),
                medial   = LetterForm("ـسـ", "مسجد", mapOf("fr" to "Mosquée", "en" to "Mosque")),
                final    = LetterForm("ـس", "شمس", mapOf("fr" to "Soleil", "en" to "Sun"))
            )
        ),
        AlphabetLetter(
            letter = "ش", nameEn = "Shin", nameAr = "شين",
            word = "شمس", wordMeaning = mapOf("fr" to "Soleil", "en" to "Sun", "es" to "Sol", "de" to "Sonne", "tr" to "Güneş", "hi" to "सूरज", "id" to "Matahari", "it" to "Sole"),
            emoji = "☀️", color = "#F4D03F",
            forms = LetterForms(
                isolated = LetterForm("ش", "شجرة", mapOf("fr" to "Arbre", "en" to "Tree")),
                initial  = LetterForm("شـ", "شمس", mapOf("fr" to "Soleil", "en" to "Sun")),
                medial   = LetterForm("ـشـ", "مشمش", mapOf("fr" to "Abricot", "en" to "Apricot")),
                final    = LetterForm("ـش", "عش", mapOf("fr" to "Nid", "en" to "Nest"))
            )
        ),
        AlphabetLetter(
            letter = "ص", nameEn = "Sad", nameAr = "صاد",
            word = "صقر", wordMeaning = mapOf("fr" to "Faucon", "en" to "Falcon", "es" to "Halcón", "de" to "Falke", "tr" to "Şahin", "hi" to "बाज़", "id" to "Elang", "it" to "Falco"),
            emoji = "🦅", color = "#935116",
            forms = LetterForms(
                isolated = LetterForm("ص", "صوت", mapOf("fr" to "Son", "en" to "Sound")),
                initial  = LetterForm("صـ", "صقر", mapOf("fr" to "Faucon", "en" to "Falcon")),
                medial   = LetterForm("ـصـ", "عصفور", mapOf("fr" to "Moineau", "en" to "Sparrow")),
                final    = LetterForm("ـص", "قفص", mapOf("fr" to "Cage", "en" to "Cage"))
            )
        ),
        AlphabetLetter(
            letter = "ض", nameEn = "Dad", nameAr = "ضاد",
            word = "ضفدع", wordMeaning = mapOf("fr" to "Grenouille", "en" to "Frog", "es" to "Rana", "de" to "Frosch", "tr" to "Kurbağa", "hi" to "मेंढक", "id" to "Katak", "it" to "Rana"),
            emoji = "🐸", color = "#27AE60",
            forms = LetterForms(
                isolated = LetterForm("ض", "ضوء", mapOf("fr" to "Lumière", "en" to "Light")),
                initial  = LetterForm("ضـ", "ضفدع", mapOf("fr" to "Grenouille", "en" to "Frog")),
                medial   = LetterForm("ـضـ", "رمضان", mapOf("fr" to "Ramadan", "en" to "Ramadan")),
                final    = LetterForm("ـض", "أبيض", mapOf("fr" to "Blanc", "en" to "White"))
            )
        ),
        AlphabetLetter(
            letter = "ط", nameEn = "Taa", nameAr = "طاء",
            word = "طائر", wordMeaning = mapOf("fr" to "Oiseau", "en" to "Bird", "es" to "Pájaro", "de" to "Vogel", "tr" to "Kuş", "hi" to "पक्षी", "id" to "Burung", "it" to "Uccello"),
            emoji = "🐦", color = "#2980B9",
            forms = LetterForms(
                isolated = LetterForm("ط", "طبل", mapOf("fr" to "Tambour", "en" to "Drum")),
                initial  = LetterForm("طـ", "طائر", mapOf("fr" to "Oiseau", "en" to "Bird")),
                medial   = LetterForm("ـطـ", "مطر", mapOf("fr" to "Pluie", "en" to "Rain")),
                final    = LetterForm("ـط", "قط", mapOf("fr" to "Chat", "en" to "Cat"))
            )
        ),
        AlphabetLetter(
            letter = "ظ", nameEn = "Dhaa", nameAr = "ظاء",
            word = "ظرف", wordMeaning = mapOf("fr" to "Enveloppe", "en" to "Envelope", "es" to "Sobre", "de" to "Umschlag", "tr" to "Zarf", "hi" to "लिफ़ाफ़ा", "id" to "Amplop", "it" to "Busta"),
            emoji = "✉️", color = "#8E44AD",
            forms = LetterForms(
                isolated = LetterForm("ظ", "ظل", mapOf("fr" to "Ombre", "en" to "Shadow")),
                initial  = LetterForm("ظـ", "ظرف", mapOf("fr" to "Enveloppe", "en" to "Envelope")),
                medial   = LetterForm("ـظـ", "نظر", mapOf("fr" to "Regard", "en" to "Look")),
                final    = LetterForm("ـظ", "حفظ", mapOf("fr" to "Mémoriser", "en" to "Memorize"))
            )
        ),
        AlphabetLetter(
            letter = "ع", nameEn = "Ayn", nameAr = "عين",
            word = "عنب", wordMeaning = mapOf("fr" to "Raisin", "en" to "Grape", "es" to "Uva", "de" to "Traube", "tr" to "Üzüm", "hi" to "अंगूर", "id" to "Anggur", "it" to "Uva"),
            emoji = "🍇", color = "#6C3483",
            forms = LetterForms(
                isolated = LetterForm("ع", "عين", mapOf("fr" to "Œil", "en" to "Eye")),
                initial  = LetterForm("عـ", "عنب", mapOf("fr" to "Raisin", "en" to "Grape")),
                medial   = LetterForm("ـعـ", "معلم", mapOf("fr" to "Professeur", "en" to "Teacher")),
                final    = LetterForm("ـع", "ربيع", mapOf("fr" to "Printemps", "en" to "Spring"))
            )
        ),
        AlphabetLetter(
            letter = "غ", nameEn = "Ghayn", nameAr = "غين",
            word = "غزال", wordMeaning = mapOf("fr" to "Gazelle", "en" to "Gazelle", "es" to "Gacela", "de" to "Gazelle", "tr" to "Ceylan", "hi" to "हिरण", "id" to "Kijang", "it" to "Gazzella"),
            emoji = "🦌", color = "#D4AC0D",
            forms = LetterForms(
                isolated = LetterForm("غ", "غابة", mapOf("fr" to "Forêt", "en" to "Forest")),
                initial  = LetterForm("غـ", "غزال", mapOf("fr" to "Gazelle", "en" to "Gazelle")),
                medial   = LetterForm("ـغـ", "صغير", mapOf("fr" to "Petit", "en" to "Small")),
                final    = LetterForm("ـغ", "دماغ", mapOf("fr" to "Cerveau", "en" to "Brain"))
            )
        ),
        AlphabetLetter(
            letter = "ف", nameEn = "Fa", nameAr = "فاء",
            word = "فيل", wordMeaning = mapOf("fr" to "Éléphant", "en" to "Elephant", "es" to "Elefante", "de" to "Elefant", "tr" to "Fil", "hi" to "हाथी", "id" to "Gajah", "it" to "Elefante"),
            emoji = "🐘", color = "#7F8C8D",
            forms = LetterForms(
                isolated = LetterForm("ف", "فم", mapOf("fr" to "Bouche", "en" to "Mouth")),
                initial  = LetterForm("فـ", "فيل", mapOf("fr" to "Éléphant", "en" to "Elephant")),
                medial   = LetterForm("ـفـ", "نفر", mapOf("fr" to "Personne", "en" to "Person")),
                final    = LetterForm("ـف", "أنف", mapOf("fr" to "Nez", "en" to "Nose"))
            )
        ),
        AlphabetLetter(
            letter = "ق", nameEn = "Qaf", nameAr = "قاف",
            word = "قطة", wordMeaning = mapOf("fr" to "Chat", "en" to "Cat", "es" to "Gato", "de" to "Katze", "tr" to "Kedi", "hi" to "बिल्ली", "id" to "Kucing", "it" to "Gatto"),
            emoji = "🐱", color = "#E67E22",
            forms = LetterForms(
                isolated = LetterForm("ق", "قمر", mapOf("fr" to "Lune", "en" to "Moon")),
                initial  = LetterForm("قـ", "قطة", mapOf("fr" to "Chat", "en" to "Cat")),
                medial   = LetterForm("ـقـ", "عقل", mapOf("fr" to "Esprit", "en" to "Mind")),
                final    = LetterForm("ـق", "طريق", mapOf("fr" to "Route", "en" to "Road"))
            )
        ),
        AlphabetLetter(
            letter = "ك", nameEn = "Kaf", nameAr = "كاف",
            word = "كلب", wordMeaning = mapOf("fr" to "Chien", "en" to "Dog", "es" to "Perro", "de" to "Hund", "tr" to "Köpek", "hi" to "कुत्ता", "id" to "Anjing", "it" to "Cane"),
            emoji = "🐶", color = "#1ABC9C",
            forms = LetterForms(
                isolated = LetterForm("ك", "كتاب", mapOf("fr" to "Livre", "en" to "Book")),
                initial  = LetterForm("كـ", "كلب", mapOf("fr" to "Chien", "en" to "Dog")),
                medial   = LetterForm("ـكـ", "مكتب", mapOf("fr" to "Bureau", "en" to "Desk")),
                final    = LetterForm("ـك", "سمك", mapOf("fr" to "Poisson", "en" to "Fish"))
            )
        ),
        AlphabetLetter(
            letter = "ل", nameEn = "Lam", nameAr = "لام",
            word = "ليمون", wordMeaning = mapOf("fr" to "Citron", "en" to "Lemon", "es" to "Limón", "de" to "Zitrone", "tr" to "Limon", "hi" to "नींबू", "id" to "Jeruk nipis", "it" to "Limone"),
            emoji = "🍋", color = "#F39C12",
            forms = LetterForms(
                isolated = LetterForm("ل", "ليل", mapOf("fr" to "Nuit", "en" to "Night")),
                initial  = LetterForm("لـ", "ليمون", mapOf("fr" to "Citron", "en" to "Lemon")),
                medial   = LetterForm("ـلـ", "قلم", mapOf("fr" to "Stylo", "en" to "Pen")),
                final    = LetterForm("ـل", "جمل", mapOf("fr" to "Chameau", "en" to "Camel"))
            )
        ),
        AlphabetLetter(
            letter = "م", nameEn = "Mim", nameAr = "ميم",
            word = "موز", wordMeaning = mapOf("fr" to "Banane", "en" to "Banana", "es" to "Plátano", "de" to "Banane", "tr" to "Muz", "hi" to "केला", "id" to "Pisang", "it" to "Banana"),
            emoji = "🍌", color = "#8E44AD",
            forms = LetterForms(
                isolated = LetterForm("م", "ماء", mapOf("fr" to "Eau", "en" to "Water")),
                initial  = LetterForm("مـ", "موز", mapOf("fr" to "Banane", "en" to "Banana")),
                medial   = LetterForm("ـمـ", "قمر", mapOf("fr" to "Lune", "en" to "Moon")),
                final    = LetterForm("ـم", "قلم", mapOf("fr" to "Stylo", "en" to "Pen"))
            )
        ),
        AlphabetLetter(
            letter = "ن", nameEn = "Nun", nameAr = "نون",
            word = "نمر", wordMeaning = mapOf("fr" to "Tigre", "en" to "Tiger", "es" to "Tigre", "de" to "Tiger", "tr" to "Kaplan", "hi" to "बाघ", "id" to "Harimau", "it" to "Tigre"),
            emoji = "🐯", color = "#2ECC71",
            forms = LetterForms(
                isolated = LetterForm("ن", "نور", mapOf("fr" to "Lumière", "en" to "Light")),
                initial  = LetterForm("نـ", "نمر", mapOf("fr" to "Tigre", "en" to "Tiger")),
                medial   = LetterForm("ـنـ", "منزل", mapOf("fr" to "Maison", "en" to "House")),
                final    = LetterForm("ـن", "لسان", mapOf("fr" to "Langue", "en" to "Tongue"))
            )
        ),
        AlphabetLetter(
            letter = "ه", nameEn = "Ha", nameAr = "هاء",
            word = "هرة", wordMeaning = mapOf("fr" to "Chatte", "en" to "Female cat", "es" to "Gata", "de" to "Katze", "tr" to "Kedi", "hi" to "बिल्ली", "id" to "Kucing betina", "it" to "Gatta"),
            emoji = "🐈", color = "#E91E63",
            forms = LetterForms(
                isolated = LetterForm("ه", "هواء", mapOf("fr" to "Air", "en" to "Air")),
                initial  = LetterForm("هـ", "هرة", mapOf("fr" to "Chatte", "en" to "Female cat")),
                medial   = LetterForm("ـهـ", "نهر", mapOf("fr" to "Rivière", "en" to "River")),
                final    = LetterForm("ـه", "وجه", mapOf("fr" to "Visage", "en" to "Face"))
            )
        ),
        AlphabetLetter(
            letter = "و", nameEn = "Waw", nameAr = "واو",
            word = "وردة", wordMeaning = mapOf("fr" to "Rose", "en" to "Rose", "es" to "Rosa", "de" to "Rose", "tr" to "Gül", "hi" to "गुलाब", "id" to "Mawar", "it" to "Rosa"),
            emoji = "🌹", color = "#C0392B",
            forms = LetterForms(
                isolated = LetterForm("و", "ولد", mapOf("fr" to "Garçon", "en" to "Boy")),
                initial  = LetterForm("و", "وردة", mapOf("fr" to "Rose", "en" to "Rose")),
                medial   = null,
                final    = LetterForm("ـو", "نحو", mapOf("fr" to "Vers", "en" to "Towards"))
            )
        ),
        AlphabetLetter(
            letter = "ي", nameEn = "Ya", nameAr = "ياء",
            word = "يد", wordMeaning = mapOf("fr" to "Main", "en" to "Hand", "es" to "Mano", "de" to "Hand", "tr" to "El", "hi" to "हाथ", "id" to "Tangan", "it" to "Mano"),
            emoji = "✋", color = "#9B59B6",
            forms = LetterForms(
                isolated = LetterForm("ي", "يوم", mapOf("fr" to "Jour", "en" to "Day")),
                initial  = LetterForm("يـ", "يد", mapOf("fr" to "Main", "en" to "Hand")),
                medial   = LetterForm("ـيـ", "بيت", mapOf("fr" to "Maison", "en" to "House")),
                final    = LetterForm("ـي", "كرسي", mapOf("fr" to "Chaise", "en" to "Chair"))
            )
        )
    )
}
