package com.arabickids.shared.platform

import android.content.Context
import android.content.SharedPreferences

actual class PlatformInfo actual constructor() {
    actual val name: String = "Android ${android.os.Build.VERSION.RELEASE}"
    actual val isAndroid: Boolean = true
    actual val isIos: Boolean = false
}

actual class Storage actual constructor(context: Any?) {
    private val prefs: SharedPreferences? =
        (context as? Context)?.getSharedPreferences("arabic_kids_prefs", Context.MODE_PRIVATE)

    actual fun getString(key: String): String? = prefs?.getString(key, null)

    actual fun putString(key: String, value: String) {
        prefs?.edit()?.putString(key, value)?.apply()
    }

    actual fun remove(key: String) {
        prefs?.edit()?.remove(key)?.apply()
    }
}

actual class AudioPlayer actual constructor(context: Any?) {
    // On Android the WebView bridge handles audio — this is a stub for shared module
    actual fun speakArabic(text: String) {}
    actual fun playSound(soundName: String) {}
    actual fun vibrate(ms: Int) {}
    actual fun stopSpeech() {}
    actual fun release() {}
}
