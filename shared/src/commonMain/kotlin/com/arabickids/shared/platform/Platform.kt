package com.arabickids.shared.platform

/** Platform-specific information */
expect class PlatformInfo() {
    val name: String
    val isAndroid: Boolean
    val isIos: Boolean
}

/** Platform-specific key-value storage */
expect class Storage(context: Any?) {
    fun getString(key: String): String?
    fun putString(key: String, value: String)
    fun remove(key: String)
}

/** Platform-specific audio */
expect class AudioPlayer(context: Any?) {
    fun speakArabic(text: String)
    fun playSound(soundName: String)
    fun vibrate(ms: Int)
    fun stopSpeech()
    fun release()
}
