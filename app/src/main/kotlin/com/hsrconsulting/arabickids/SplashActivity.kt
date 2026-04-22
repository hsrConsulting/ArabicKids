package com.hsrconsulting.arabickids

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.animation.*
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.hsrconsulting.arabickids.databinding.ActivitySplashBinding

class SplashActivity : AppCompatActivity() {

    companion object {
        private const val SPLASH_DURATION = 3000L
    }

    private lateinit var binding: ActivitySplashBinding
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(binding.root)

        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
            View.SYSTEM_UI_FLAG_FULLSCREEN

        animateSplash()

        handler.postDelayed({
            startActivity(Intent(this, MainActivity::class.java))
            @Suppress("DEPRECATION")
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
            finish()
        }, SPLASH_DURATION)
    }

    private fun animateSplash() {
        // Logo background
        binding.splashLogoBg.startAnimation(buildScaleFadeAnim(
            duration = 700, offset = 0, overshoot = 1.5f
        ))

        // Ring
        binding.splashRing.startAnimation(buildScaleFadeAnim(
            duration = 800, offset = 100, overshoot = 1.2f
        ))

        // Logo emoji
        binding.splashLogo.startAnimation(buildScaleFadeAnim(
            duration = 600, offset = 200, overshoot = 2.0f
        ))

        // Sparkles
        animateSparkle(binding.splashSparkle1, 500)
        animateSparkle(binding.splashSparkle2, 650)

        // Title slide up
        binding.splashTitle.startAnimation(buildSlideUpFadeAnim(duration = 500, offset = 600))

        // Arabic text slide up
        binding.splashArabic.startAnimation(buildSlideUpFadeAnim(duration = 500, offset = 800))

        // Tagline pill scale
        binding.splashTagline.startAnimation(buildScaleFadeAnim(
            duration = 500, offset = 1100, overshoot = 1.3f
        ))

        // Floating letters
        animateFloatingLetter(binding.splashFloat1, 300, -15f)
        animateFloatingLetter(binding.splashFloat2, 500,  12f)
        animateFloatingLetter(binding.splashFloat3, 700, -10f)
        animateFloatingLetter(binding.splashFloat4, 900,  18f)

        // Loading dots
        animateDot(binding.dot1, 1200)
        animateDot(binding.dot2, 1400)
        animateDot(binding.dot3, 1600)
    }

    private fun buildScaleFadeAnim(duration: Long, offset: Long, overshoot: Float): AnimationSet {
        val scale = ScaleAnimation(
            0f, 1f, 0f, 1f,
            Animation.RELATIVE_TO_SELF, 0.5f,
            Animation.RELATIVE_TO_SELF, 0.5f
        ).apply { this.duration = duration }

        val fade = AlphaAnimation(0f, 1f).apply { this.duration = duration - 100 }

        return AnimationSet(true).apply {
            interpolator = OvershootInterpolator(overshoot)
            startOffset = offset
            fillAfter = true
            addAnimation(scale)
            addAnimation(fade)
        }
    }

    private fun buildSlideUpFadeAnim(duration: Long, offset: Long): AnimationSet {
        val slide = TranslateAnimation(0f, 0f, 60f, 0f).apply { this.duration = duration }
        val fade  = AlphaAnimation(0f, 1f).apply { this.duration = duration }
        return AnimationSet(true).apply {
            interpolator = AccelerateDecelerateInterpolator()
            startOffset = offset
            fillAfter = true
            addAnimation(slide)
            addAnimation(fade)
        }
    }

    private fun animateSparkle(view: View, delay: Int) {
        val scale  = ScaleAnimation(0f, 1f, 0f, 1f,
            Animation.RELATIVE_TO_SELF, 0.5f, Animation.RELATIVE_TO_SELF, 0.5f
        ).apply { duration = 400 }
        val fade   = AlphaAnimation(0f, 1f).apply { duration = 300 }
        val rotate = RotateAnimation(0f, 20f,
            Animation.RELATIVE_TO_SELF, 0.5f, Animation.RELATIVE_TO_SELF, 0.5f
        ).apply { duration = 400 }

        AnimationSet(true).apply {
            interpolator = OvershootInterpolator(3f)
            startOffset = delay.toLong()
            fillAfter = true
            addAnimation(scale)
            addAnimation(fade)
            addAnimation(rotate)
        }.also { view.startAnimation(it) }
    }

    private fun animateFloatingLetter(view: View, delay: Int, rotation: Float) {
        val fade = AlphaAnimation(0f, 0.12f).apply {
            duration = 800; startOffset = delay.toLong(); fillAfter = true
        }
        val float = TranslateAnimation(0f, 0f, 0f, -20f).apply {
            duration = 2000; startOffset = delay.toLong()
            repeatCount = Animation.INFINITE; repeatMode = Animation.REVERSE
            interpolator = AccelerateDecelerateInterpolator()
        }
        val rot = RotateAnimation(0f, rotation,
            Animation.RELATIVE_TO_SELF, 0.5f, Animation.RELATIVE_TO_SELF, 0.5f
        ).apply { duration = 800; startOffset = delay.toLong(); fillAfter = true }

        AnimationSet(false).apply {
            addAnimation(fade); addAnimation(float); addAnimation(rot)
        }.also { view.startAnimation(it) }
    }

    private fun animateDot(view: View, delay: Int) {
        handler.postDelayed({
            val pulse = ScaleAnimation(
                1f, 1.5f, 1f, 1.5f,
                Animation.RELATIVE_TO_SELF, 0.5f, Animation.RELATIVE_TO_SELF, 0.5f
            ).apply {
                duration = 400
                repeatCount = Animation.INFINITE
                repeatMode  = Animation.REVERSE
                interpolator = AccelerateDecelerateInterpolator()
            }
            val fade = AlphaAnimation(0.3f, 1f).apply {
                duration = 400
                repeatCount = Animation.INFINITE
                repeatMode  = Animation.REVERSE
            }
            AnimationSet(true).apply {
                addAnimation(pulse); addAnimation(fade)
            }.also { view.startAnimation(it) }
        }, delay.toLong())
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
