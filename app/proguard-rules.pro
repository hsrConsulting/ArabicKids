# ============================================================
# ArabicKids — ProGuard rules for release builds
# ============================================================

# Keep all WebView JavaScript interface methods
-keepattributes JavascriptInterface
-keepattributes Signature
-keepattributes *Annotation*

# Keep the WebBridge inner class and all its @JavascriptInterface methods
-keep class com.arabickids.app.MainActivity$WebBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class com.arabickids.app.MainActivity$WebBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep activities (referenced from manifest)
-keep class com.arabickids.app.MainActivity { *; }
-keep class com.arabickids.app.SplashActivity { *; }

# Google Mobile Ads SDK
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.** { *; }
-dontwarn com.google.android.gms.ads.**

# Google Play Billing
-keep class com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**

# Firebase Analytics
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Material Components
-keep class com.google.android.material.** { *; }
-dontwarn com.google.android.material.**

# AndroidX
-keep class androidx.** { *; }
-dontwarn androidx.**

# Kotlin
-dontwarn kotlin.**
-keepclassmembers class kotlin.Metadata { *; }

# WebView
-keep class android.webkit.** { *; }

# Speech recognition
-keep class android.speech.** { *; }

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelables
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

# Keep view binding generated classes
-keep class com.arabickids.app.databinding.** { *; }

# Strip verbose Log calls in release builds
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
}

# Keep line numbers for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
