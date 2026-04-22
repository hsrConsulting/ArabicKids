package com.arabickids.shared.platform

import platform.Foundation.NSUserDefaults
import platform.UIKit.UIDevice

actual class PlatformInfo actual constructor() {
    actual val name: String = "iOS ${UIDevice.currentDevice.systemVersion}"
    actual val isAndroid: Boolean = false
    actual val isIos: Boolean = true
}

actual class Storage actual constructor(context: Any?) {
    private val defaults = NSUserDefaults.standardUserDefaults

    actual fun getString(key: String): String? = defaults.stringForKey(key)

    actual fun putString(key: String, value: String) {
        defaults.setObject(value, forKey = key)
    }

    actual fun remove(key: String) {
        defaults.removeObjectForKey(key)
    }
}

actual class AudioPlayer actual constructor(context: Any?) {
    // iOS: AVSpeechSynthesizer for TTS, AVAudioPlayer for sounds
    actual fun speakArabic(text: String) {
        // TODO: implement with AVSpeechSynthesizer
    }
    actual fun playSound(soundName: String) {
        // TODO: implement with AVAudioPlayer
    }
    actual fun vibrate(ms: Int) {
        // TODO: implement with UIImpactFeedbackGenerator
    }
    actual fun stopSpeech() {}
    actual fun release() {}
}
