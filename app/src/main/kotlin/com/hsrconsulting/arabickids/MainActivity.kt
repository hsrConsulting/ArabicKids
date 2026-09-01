package com.hsrconsulting.arabickids

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.SoundPool
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.hsrconsulting.arabickids.databinding.ActivityMainBinding
import com.google.firebase.FirebaseApp
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.analytics.ktx.analytics
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.remoteconfig.ktx.remoteConfig
import com.google.firebase.remoteconfig.ktx.remoteConfigSettings
import com.google.firebase.ktx.Firebase
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.RequestConfiguration
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "ArabicKids"
        // TODO: Replace with your actual Play Console product IDs before publishing
        private const val PRODUCT_MONTHLY = "arabickids_premium_monthly"
        private const val PRODUCT_YEARLY  = "arabickids_premium_yearly"
        private const val REQUEST_RECORD_AUDIO = 100
    }

    private lateinit var binding: ActivityMainBinding
    private lateinit var tts: TextToSpeech
    private lateinit var soundPool: SoundPool
    private lateinit var billingClient: BillingClient

    private var ttsReady = false
    private var interstitialAd: InterstitialAd? = null
    private lateinit var consentInformation: ConsentInformation
    private val mobileAdsInitialized = AtomicBoolean(false)
    private val productDetailsCache = mutableMapOf<String, ProductDetails>()
    private var speechRecognizer: SpeechRecognizer? = null
    private var onlinePlayer: MediaPlayer? = null
    private val analytics by lazy { Firebase.analytics }
    private val firestore by lazy { Firebase.firestore }
    private val firebaseAuth by lazy { Firebase.auth }
    private val remoteConfig by lazy { Firebase.remoteConfig }

    // Sound effect IDs
    private var sndCorrect = 0
    private var sndWrong   = 0
    private var sndClick   = 0
    private var sndBadge   = 0
    private var sndFlip    = 0
    private var sndMatch   = 0
    private var sndComplete = 0

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Defensive: FirebaseInitProvider sometimes fails to auto-init when
        // WebView is the first View inflated (race during the same onCreate).
        // initializeApp() is idempotent — returns the existing instance if
        // it was already attached, otherwise reads google-services resources.
        try { FirebaseApp.initializeApp(this) } catch (e: Exception) { Log.e(TAG, "Firebase init failed: ${e.message}") }
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Designed for Families / COPPA: tag all requests as child-directed,
        // under age of consent, and restrict ad content to rating G before init.
        MobileAds.setRequestConfiguration(
            RequestConfiguration.Builder()
                .setTagForChildDirectedTreatment(RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE)
                .setTagForUnderAgeOfConsent(RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE)
                .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_G)
                .build()
        )

        requestConsentThenInitAds()

        initTts()
        initBilling()
        initFirebaseAuth()
        initRemoteConfig()
        setupWebView()

        // Daily reminder: create channel + schedule once, request POST_NOTIFICATIONS
        // on Android 13+. Declined permission is fine — scheduling still runs so
        // the alarm fires, it just can't post a visible notification.
        DailyReminder.ensureChannel(this)
        DailyReminder.schedule(this)
        StreakReminder.ensureChannel(this)
        StreakReminder.schedule(this)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this, arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 101
            )
        }
        setupBackNavigation()
        initSoundPool()

        binding.webView.loadUrl("file:///android_asset/web/index.html")
    }

    // ── UMP Consent (EEA/GDPR) ────────────────────────────────────────────────
    //
    // Flow for a Designed-for-Families app:
    //  - TagForUnderAgeOfConsent=true → UMP treats the user as under age of
    //    consent; a consent form is not shown to the child, and ad requests
    //    will be non-personalized regardless of the user's EEA region.
    //  - We still must call the UMP SDK so the AdMob backend knows consent
    //    has been addressed (mandatory for EEA traffic).
    //  - If UMP fails or times out, we fall back to initializing AdMob so the
    //    app still works (ads will be non-personalized due to the kids tags).

    private fun requestConsentThenInitAds() {
        val params = ConsentRequestParameters.Builder()
            .setTagForUnderAgeOfConsent(true)
            .build()

        consentInformation = UserMessagingPlatform.getConsentInformation(this)
        consentInformation.requestConsentInfoUpdate(
            this,
            params,
            {
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(this) { formError ->
                    if (formError != null) {
                        Log.w(TAG, "UMP form error ${formError.errorCode}: ${formError.message}")
                    }
                    // Whether the form showed, was dismissed, or wasn't required,
                    // AdMob may now initialize.
                    initializeMobileAdsOnce()
                }
            },
            { requestError ->
                Log.w(TAG, "UMP consent info update failed ${requestError.errorCode}: ${requestError.message}")
                // Never block the app on UMP failures — ads remain non-personalized
                // thanks to the child-directed RequestConfiguration set above.
                initializeMobileAdsOnce()
            }
        )
    }

    private fun initializeMobileAdsOnce() {
        if (!mobileAdsInitialized.compareAndSet(false, true)) return
        MobileAds.initialize(this) {
            Log.i(TAG, "AdMob initialized (child-directed, non-personalized)")
            loadInterstitialAd()
            loadBannerAd()
        }
    }

    private fun loadBannerAd() {
        try {
            binding.adView.loadAd(AdRequest.Builder().build())
            Log.i(TAG, "Banner ad: load() called")
        } catch (e: Exception) {
            Log.e(TAG, "Banner ad: load failed — ${e.message}")
        }
    }

    // ── AdMob ─────────────────────────────────────────────────────────────────

    private fun loadInterstitialAd() {
        Log.i(TAG, "Interstitial ad: load() called")
        val request = AdRequest.Builder().build()
        InterstitialAd.load(this, getString(R.string.admob_interstitial_id), request,
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    interstitialAd = ad
                    Log.i(TAG, "Interstitial ad: LOADED, ready to show")
                    ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                        override fun onAdDismissedFullScreenContent() {
                            Log.i(TAG, "Interstitial ad: dismissed, reloading")
                            interstitialAd = null
                            loadInterstitialAd()
                        }
                        override fun onAdFailedToShowFullScreenContent(error: com.google.android.gms.ads.AdError) {
                            Log.e(TAG, "Interstitial ad: failed to show — ${error.message}")
                            interstitialAd = null
                            loadInterstitialAd()
                        }
                    }
                }
                override fun onAdFailedToLoad(error: LoadAdError) {
                    Log.e(TAG, "Interstitial ad: failed to load (code=${error.code}) — ${error.message}")
                    interstitialAd = null
                }
            })
    }

    private fun showInterstitialAd(): Boolean {
        val ready = interstitialAd != null
        Log.i(TAG, "Interstitial ad: show() requested — ready=$ready")
        if (ready) {
            runOnUiThread { interstitialAd?.show(this) }
        } else {
            loadInterstitialAd()
        }
        return ready
    }

    // ── Google Play Billing ───────────────────────────────────────────────────

    private fun initBilling() {
        billingClient = BillingClient.newBuilder(this)
            .setListener(purchasesUpdatedListener)
            .enablePendingPurchases()
            .build()

        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    Log.d(TAG, "Billing client connected")
                    queryProductDetails()
                    checkExistingPurchases()
                } else {
                    Log.e(TAG, "Billing setup failed: ${result.debugMessage}")
                }
            }
            override fun onBillingServiceDisconnected() {
                Log.w(TAG, "Billing service disconnected")
            }
        })
    }

    private val purchasesUpdatedListener = PurchasesUpdatedListener { result, purchases ->
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                purchases?.forEach { handlePurchase(it) }
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> {
                Log.d(TAG, "Purchase cancelled by user")
            }
            else -> {
                Log.e(TAG, "Purchase error: ${result.debugMessage}")
            }
        }
    }

    private fun queryProductDetails() {
        val products = listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT_MONTHLY)
                .setProductType(BillingClient.ProductType.SUBS)
                .build(),
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT_YEARLY)
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        )
        val params = QueryProductDetailsParams.newBuilder().setProductList(products).build()
        billingClient.queryProductDetailsAsync(params) { _, detailsList ->
            detailsList.forEach { productDetailsCache[it.productId] = it }
            Log.d(TAG, "Product details loaded: ${detailsList.size} products")
        }
    }

    private fun checkExistingPurchases() {
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        billingClient.queryPurchasesAsync(params) { result, purchases ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                val active = purchases.any { it.purchaseState == Purchase.PurchaseState.PURCHASED }
                if (active) {
                    Log.d(TAG, "Active subscription found on startup")
                    grantPremiumAccess()
                }
            }
        }
    }

    private fun handlePurchase(purchase: Purchase) {
        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
            if (!purchase.isAcknowledged) {
                val params = AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(purchase.purchaseToken)
                    .build()
                billingClient.acknowledgePurchase(params) { result ->
                    if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                        Log.d(TAG, "Purchase acknowledged")
                        grantPremiumAccess()
                    }
                }
            } else {
                grantPremiumAccess()
            }
        }
    }

    private fun grantPremiumAccess() {
        runOnUiThread {
            binding.webView.evaluateJavascript("setPremiumStatus(true)", null)
            Log.d(TAG, "Premium access granted")
        }
    }

    private fun launchBillingFlow(productId: String) {
        val details = productDetailsCache[productId]
        if (details == null) {
            Log.w(TAG, "Product details not cached yet for $productId, re-querying")
            queryProductDetails()
            runOnUiThread {
                Toast.makeText(this, "Veuillez réessayer dans quelques secondes", Toast.LENGTH_SHORT).show()
            }
            return
        }

        val offerToken = details.subscriptionOfferDetails?.firstOrNull()?.offerToken ?: run {
            Log.e(TAG, "No offer token for $productId")
            return
        }

        val productDetailsParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(details)
            .setOfferToken(offerToken)
            .build()

        val flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(productDetailsParams))
            .build()

        billingClient.launchBillingFlow(this, flowParams)
    }

    // ��─ Speech Recognition ──────────────────────────────────────��─────────────

    // ── Firebase (anonymous auth + Firestore) ────────────────────────────────
    // Users sign in anonymously on first launch so the Firestore security rules
    // can enforce `request.auth != null` without the child ever seeing a login.
    // Profiles are keyed by a deterministic hash of (name, code) so the same
    // tuple resolves to the same document across devices — no email needed.

    private fun initFirebaseAuth() {
        if (firebaseAuth.currentUser == null) {
            firebaseAuth.signInAnonymously()
                .addOnSuccessListener { Log.d(TAG, "Firebase anonymous auth OK uid=${it.user?.uid}") }
                .addOnFailureListener { Log.w(TAG, "Firebase auth failed: ${it.message}") }
        }
    }

    // ── Remote Config ─────────────────────────────────────────────────────────
    // Server-driven parameters so we can tune behaviour (ad pacing, defaults)
    // without shipping a new version. Defaults below mirror the hard-coded
    // values so the app behaves identically until a Firebase Console override
    // is published. Fetch interval is 1h in prod — Firebase Console can flip
    // a setting in minutes once devices reach back.
    private fun initRemoteConfig() {
        val settings = remoteConfigSettings { minimumFetchIntervalInSeconds = 3600 }
        remoteConfig.setConfigSettingsAsync(settings)
        remoteConfig.setDefaultsAsync(
            mapOf(
                "ad_warmup_seconds" to 90L,
                "ad_cooldown_seconds" to 120L,
                "quiz_options_normal" to 4L,
                "daily_emphasis" to "balanced",
                "interstitial_hidden" to true
            )
        )
        remoteConfig.fetchAndActivate()
            .addOnSuccessListener {
                Log.d(TAG, "Remote Config activated")
                runOnUiThread {
                    try {
                        binding.webView.evaluateJavascript(
                            "if(typeof _onRemoteConfigReady==='function')_onRemoteConfigReady()", null
                        )
                    } catch (e: Exception) { /* webview may not be ready yet */ }
                }
            }
            .addOnFailureListener { Log.w(TAG, "Remote Config fetch failed: ${it.message}") }
    }

    private fun userKey(name: String, code: String): String {
        val raw = "${name.trim().lowercase()}_$code"
        return raw.toByteArray().fold(0L) { acc, b -> acc * 31 + b.toLong() }
            .let { kotlin.math.abs(it).toString(36) }
    }

    private fun firestoreSave(name: String, code: String, json: String) {
        val uid = firebaseAuth.currentUser?.uid
        if (uid == null) {
            Log.w(TAG, "Firestore save skipped — no auth user yet")
            return
        }
        val key = userKey(name, code)
        // seenBy is an arrayUnion of every anonymous uid that has saved this
        // profile. Lets a device that re-installs the app (new uid) bootstrap
        // its profile list from Firestore via cloudListSeenProfiles().
        firestore.collection("profiles").document(key)
            .set(
                mapOf(
                    "state" to json,
                    "updatedAt" to System.currentTimeMillis(),
                    "seenBy" to FieldValue.arrayUnion(uid)
                ),
                SetOptions.merge()
            )
            .addOnSuccessListener { Log.d(TAG, "Firestore save OK key=$key") }
            .addOnFailureListener { Log.w(TAG, "Firestore save failed: ${it.message}") }
    }

    private fun firestoreLoad(name: String, code: String, callback: (String?) -> Unit) {
        if (firebaseAuth.currentUser == null) {
            Log.w(TAG, "Firestore load skipped — no auth user yet")
            callback(null); return
        }
        val key = userKey(name, code)
        firestore.collection("profiles").document(key).get()
            .addOnSuccessListener { snapshot ->
                callback(snapshot.getString("state"))
            }
            .addOnFailureListener {
                Log.w(TAG, "Firestore load failed: ${it.message}")
                callback(null)
            }
    }

    // ── Speech Recognition ───────────────────────────────────────────────────

    private fun hasAudioPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    private fun requestAudioPermission() {
        ActivityCompat.requestPermissions(this, arrayOf(android.Manifest.permission.RECORD_AUDIO), REQUEST_RECORD_AUDIO)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_RECORD_AUDIO) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "RECORD_AUDIO permission granted")
            } else {
                jsCallback("if(typeof onSpeechResult==='function')onSpeechResult('','0','permission_denied')")
            }
        }
    }

    private fun jsCallback(js: String) {
        runOnUiThread { binding.webView.evaluateJavascript(js, null) }
    }

    private fun startSpeechRecognition(extended: Boolean = false) {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            jsCallback("if(typeof onSpeechResult==='function')onSpeechResult('','0','not_available')")
            return
        }

        speechRecognizer?.destroy()
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    jsCallback("if(typeof onSpeechReady==='function')onSpeechReady()")
                }
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {
                    jsCallback("if(typeof onSpeechEnd==='function')onSpeechEnd()")
                }
                override fun onError(error: Int) {
                    val errName = when (error) {
                        SpeechRecognizer.ERROR_NO_MATCH -> "no_match"
                        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "timeout"
                        SpeechRecognizer.ERROR_AUDIO -> "audio_error"
                        else -> "error_$error"
                    }
                    jsCallback("if(typeof onSpeechResult==='function')onSpeechResult('','0','$errName')")
                }
                override fun onResults(results: Bundle?) {
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val scores = results?.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)
                    val text = matches?.firstOrNull()?.replace("'", "\\'") ?: ""
                    val confidence = scores?.firstOrNull()?.toString() ?: "0"
                    jsCallback("if(typeof onSpeechResult==='function')onSpeechResult('$text','$confidence','')")
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    val partial = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val text = partial?.firstOrNull()?.replace("'", "\\'") ?: ""
                    if (text.isNotEmpty()) {
                        jsCallback("if(typeof onSpeechPartial==='function')onSpeechPartial('$text')")
                    }
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar")
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ar")
                putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, "ar")
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                // Reading-text mode: give the child much more breathing room
                // between words. Single-word reading keeps the snappy defaults.
                if (extended) {
                    putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 4000L)
                    putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 6000L)
                    putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L)
                }
            }
            startListening(intent)
        }
    }

    // ── Text-to-Speech ────────────────────────────────────────────────────────

    private var ttsArabicAvailable = false

    private fun initTts() {
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                // Try "ar", then "ar_SA", then any Arabic variant
                val locales = listOf(Locale("ar"), Locale("ar", "SA"), Locale("ar", "EG"))
                var langOk = false
                for (loc in locales) {
                    val r = tts.setLanguage(loc)
                    if (r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED) {
                        langOk = true
                        Log.d(TAG, "Arabic TTS set with locale: $loc")
                        break
                    }
                }

                ttsArabicAvailable = langOk
                tts.setSpeechRate(0.7f)
                tts.setPitch(1.1f)
                ttsReady = true
                Log.d(TAG, "TTS initialized: arabicAvailable=$langOk")

                if (!langOk) {
                    Log.w(TAG, "Arabic TTS not available — online fallback will be used")
                }
            } else {
                Log.e(TAG, "TTS initialization failed with status: $status")
            }
        }
    }

    // ── SoundPool ─────────────────────────────────────────────────────────────

    private var soundPoolReady = false
    private var soundPoolLoadCount = 0
    private val soundPoolExpected = 7

    private fun initSoundPool() {
        try {
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            soundPool = SoundPool.Builder()
                .setMaxStreams(3)
                .setAudioAttributes(attrs)
                .build()

            soundPool.setOnLoadCompleteListener { _, sampleId, status ->
                if (status == 0) {
                    soundPoolLoadCount++
                    if (soundPoolLoadCount >= soundPoolExpected) {
                        soundPoolReady = true
                        Log.d(TAG, "SoundPool: all $soundPoolExpected sounds loaded OK")
                    } else {
                        soundPoolReady = true
                    }
                } else {
                    Log.w(TAG, "SoundPool load failed for sampleId=$sampleId (status=$status)")
                }
            }

            sndCorrect  = soundPool.load(this, R.raw.correct,  1)
            sndWrong    = soundPool.load(this, R.raw.wrong,    1)
            sndClick    = soundPool.load(this, R.raw.click,    1)
            sndBadge    = soundPool.load(this, R.raw.badge,    1)
            sndFlip     = soundPool.load(this, R.raw.flip,     1)
            sndMatch    = soundPool.load(this, R.raw.match,    1)
            sndComplete = soundPool.load(this, R.raw.complete, 1)
        } catch (e: Exception) {
            Log.e(TAG, "SoundPool init failed: ${e.message}")
            soundPoolReady = false
        }
    }

    // ── WebView ───────────────────────────────────────────────────────────────

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        with(binding.webView.settings) {
            javaScriptEnabled    = true
            domStorageEnabled    = true
            setSupportZoom(false)
            builtInZoomControls  = false
            useWideViewPort      = false
            loadWithOverviewMode = false
            cacheMode            = WebSettings.LOAD_DEFAULT
            databaseEnabled      = true
            // file:///android_asset stays accessible without these flags;
            // keep them off so no arbitrary file:// / content:// URI can be loaded.
            allowFileAccess      = false
            allowContentAccess   = false
            mediaPlaybackRequiresUserGesture = false
            textZoom             = 100
            mixedContentMode     = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }

        binding.webView.addJavascriptInterface(WebBridge(this), "Android")
        binding.webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        binding.webView.setBackgroundColor(0xFFFFF8F0.toInt())

        binding.webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                binding.progressBar.visibility = View.GONE
                val deviceLang = Locale.getDefault().language
                view.evaluateJavascript(
                    "window.isAndroidApp = true; " +
                    "window.deviceLanguage = '$deviceLang'; " +
                    "if(typeof onAndroidReady === 'function') onAndroidReady();",
                    null
                )
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (url.startsWith("file:///android_asset")) return false
                // Route http(s) links (e.g. privacy policy) to the system browser so
                // the embedded WebView never navigates away from bundled assets.
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, request.url).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        })
                    } catch (e: Exception) {
                        Log.w(TAG, "Cannot open external URL $url: ${e.message}")
                    }
                }
                return true
            }
        }

        binding.webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                binding.progressBar.visibility = if (newProgress < 100) View.VISIBLE else View.GONE
                binding.progressBar.progress   = newProgress
            }
            override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
                consoleMessage?.let {
                    Log.d(TAG, "JS: ${it.message()} [${it.sourceId()}:${it.lineNumber()}]")
                }
                return true
            }
        }
    }

    // ── Back navigation ───────────────────────────────────────────────────────

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (binding.webView.canGoBack()) {
                    binding.webView.goBack()
                } else {
                    binding.webView.evaluateJavascript(
                        "if(typeof handleAndroidBack === 'function') handleAndroidBack(); else true;"
                    ) { result ->
                        if (result == "true") {
                            isEnabled = false
                            onBackPressedDispatcher.onBackPressed()
                        }
                    }
                }
            }
        })
    }

    // ── JavaScript Bridge ─────────────────────────────────────────────────────

    inner class WebBridge(private val context: Context) {

        @JavascriptInterface
        fun speakArabic(text: String): Boolean {
            if (ttsReady && ttsArabicAvailable) {
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "arabic_speech")
                return true
            }
            return false
        }

        @JavascriptInterface
        fun openTtsSettings() {
            runOnUiThread {
                try {
                    // Open TTS settings directly
                    val intent = Intent("com.android.settings.TTS_SETTINGS")
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    startActivity(intent)
                } catch (e: Exception) {
                    try {
                        // Fallback: open general settings
                        val intent = Intent(android.provider.Settings.ACTION_SETTINGS)
                        startActivity(intent)
                    } catch (e2: Exception) {
                        Toast.makeText(context, "Ouvre Paramètres > Langue > Synthèse vocale", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        @JavascriptInterface
        fun isTtsArabicAvailable(): Boolean = ttsArabicAvailable

        @JavascriptInterface
        fun speakOnline(text: String) {
            Thread {
                try {
                    val encoded = java.net.URLEncoder.encode(text, "UTF-8")
                    val url = "https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=$encoded"
                    val conn = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0")
                    conn.setRequestProperty("Referer", "https://translate.google.com/")
                    conn.connectTimeout = 5000
                    conn.readTimeout = 5000
                    conn.connect()

                    if (conn.responseCode == 200) {
                        val tmpFile = java.io.File.createTempFile("tts_", ".mp3", cacheDir)
                        conn.inputStream.use { input ->
                            java.io.FileOutputStream(tmpFile).use { output ->
                                input.copyTo(output)
                            }
                        }
                        runOnUiThread {
                            try {
                                onlinePlayer?.release()
                                onlinePlayer = MediaPlayer().apply {
                                    setAudioAttributes(
                                        AudioAttributes.Builder()
                                            .setUsage(AudioAttributes.USAGE_MEDIA)
                                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                            .build()
                                    )
                                    setDataSource(tmpFile.absolutePath)
                                    setOnCompletionListener { it.release(); tmpFile.delete() }
                                    setOnErrorListener { mp, _, _ -> mp.release(); tmpFile.delete(); true }
                                    prepare()
                                    start()
                                }
                            } catch (e: Exception) {
                                Log.w(TAG, "Online TTS playback failed: ${e.message}")
                                tmpFile.delete()
                            }
                        }
                    } else {
                        Log.w(TAG, "Online TTS HTTP ${conn.responseCode}")
                    }
                    conn.disconnect()
                } catch (e: Exception) {
                    Log.w(TAG, "Online TTS download failed: ${e.message}")
                }
            }.start()
        }

        @JavascriptInterface
        fun stopSpeech() {
            if (::tts.isInitialized && tts.isSpeaking) tts.stop()
            try { onlinePlayer?.stop(); onlinePlayer?.release(); onlinePlayer = null } catch (_: Exception) {}
        }

        @JavascriptInterface
        fun playSound(type: String) {
            if (!soundPoolReady) return
            try {
                val vol = 0.8f
                val low = 0.5f
                when (type) {
                    "correct"  -> soundPool.play(sndCorrect,  vol, vol, 1, 0, 1f)
                    "wrong"    -> soundPool.play(sndWrong,    vol, vol, 1, 0, 1f)
                    "click"    -> soundPool.play(sndClick,    low, low, 1, 0, 1f)
                    "badge"    -> soundPool.play(sndBadge,    vol, vol, 1, 0, 1f)
                    "flip"     -> soundPool.play(sndFlip,     low, low, 1, 0, 1f)
                    "match"    -> soundPool.play(sndMatch,    vol, vol, 1, 0, 1f)
                    "complete" -> soundPool.play(sndComplete, vol, vol, 1, 0, 1f)
                }
            } catch (e: Exception) {
                Log.w(TAG, "playSound failed: ${e.message}")
                soundPoolReady = false
            }
        }

        @JavascriptInterface
        fun vibrate(ms: Int) {
            @Suppress("DEPRECATION")
            val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            vibrator?.takeIf { it.hasVibrator() }?.let {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    it.vibrate(VibrationEffect.createOneShot(ms.toLong(), VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    it.vibrate(ms.toLong())
                }
            }
        }

        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread { Toast.makeText(context, message, Toast.LENGTH_SHORT).show() }
        }

        @JavascriptInterface
        fun setDailyDone() {
            StreakReminder.markDoneToday(context)
        }

        @JavascriptInterface
        fun shareApp(text: String) {
            runOnUiThread {
                try {
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, text)
                        putExtra(Intent.EXTRA_SUBJECT, getString(R.string.app_name))
                    }
                    startActivity(Intent.createChooser(intent, null))
                } catch (e: Exception) {
                    Log.e(TAG, "shareApp failed: ${e.message}")
                }
            }
        }

        @JavascriptInterface
        fun isTTSReady(): Boolean = ttsReady

        @JavascriptInterface
        fun getDeviceType(): String {
            val isTablet = context.resources.configuration.smallestScreenWidthDp >= 600
            return if (isTablet) "tablet" else "phone"
        }

        @JavascriptInterface
        fun getDeviceLanguage(): String = Locale.getDefault().language

        @JavascriptInterface
        fun showInterstitial(): Boolean = showInterstitialAd()

        @JavascriptInterface
        fun startListening(extended: Boolean) {
            runOnUiThread {
                if (!hasAudioPermission()) {
                    requestAudioPermission()
                    jsCallback("if(typeof onSpeechResult==='function')onSpeechResult('','0','permission_denied')")
                    return@runOnUiThread
                }
                // Stop TTS if speaking before starting recognition
                if (::tts.isInitialized && tts.isSpeaking) tts.stop()
                startSpeechRecognition(extended)
            }
        }

        @JavascriptInterface
        fun stopListening() {
            runOnUiThread { speechRecognizer?.stopListening() }
        }

        @JavascriptInterface
        fun purchaseSubscription(plan: String) {
            val productId = when (plan) {
                "monthly" -> PRODUCT_MONTHLY
                "yearly"  -> PRODUCT_YEARLY
                else      -> PRODUCT_MONTHLY
            }
            runOnUiThread { launchBillingFlow(productId) }
        }

        @JavascriptInterface
        fun restorePurchases() {
            val params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
            billingClient.queryPurchasesAsync(params) { result, purchases ->
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    val active = purchases.any { it.purchaseState == Purchase.PurchaseState.PURCHASED }
                    if (active) {
                        grantPremiumAccess()
                    } else {
                        runOnUiThread {
                            Toast.makeText(context, "Aucun abonnement actif trouvé", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            }
        }

        @JavascriptInterface
        fun cloudSave(name: String, code: String, json: String) {
            firestoreSave(name, code, json)
        }

        @JavascriptInterface
        fun cloudLoad(name: String, code: String) {
            firestoreLoad(name, code) { json ->
                runOnUiThread {
                    val arg = if (json == null) "null"
                    else "'${json.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")}'"
                    binding.webView.evaluateJavascript(
                        "if(typeof _onCloudLoad==='function')_onCloudLoad($arg)", null
                    )
                }
            }
        }

        @JavascriptInterface
        fun isCloudAvailable(): Boolean = firebaseAuth.currentUser != null

        // ── Remote Config accessors ──────────────────────────────────────────
        @JavascriptInterface
        fun rcGetString(key: String): String = remoteConfig.getString(key)

        @JavascriptInterface
        fun rcGetLong(key: String): Long = remoteConfig.getLong(key)

        @JavascriptInterface
        fun rcGetBoolean(key: String): Boolean = remoteConfig.getBoolean(key)

        // Query every profile this device's anonymous uid has ever saved.
        // Returns a JSON array of {state: "<json>"} via `_onCloudListSeen`.
        // Used at boot to detect profiles in the cloud that aren't on this
        // device yet (re-install scenario or new device).
        @JavascriptInterface
        fun cloudListSeenProfiles() {
            val uid = firebaseAuth.currentUser?.uid
            if (uid == null) {
                runOnUiThread {
                    binding.webView.evaluateJavascript(
                        "if(typeof _onCloudListSeen==='function')_onCloudListSeen(null)", null
                    )
                }
                return
            }
            firestore.collection("profiles")
                .whereArrayContains("seenBy", uid)
                .get()
                .addOnSuccessListener { snap ->
                    val results = org.json.JSONArray()
                    for (doc in snap.documents) {
                        val state = doc.getString("state") ?: continue
                        results.put(org.json.JSONObject().put("state", state))
                    }
                    val payload = results.toString()
                        .replace("\\", "\\\\")
                        .replace("'", "\\'")
                        .replace("\n", "\\n")
                    runOnUiThread {
                        binding.webView.evaluateJavascript(
                            "if(typeof _onCloudListSeen==='function')_onCloudListSeen('$payload')", null
                        )
                    }
                }
                .addOnFailureListener {
                    Log.w(TAG, "Firestore listSeen failed: ${it.message}")
                    runOnUiThread {
                        binding.webView.evaluateJavascript(
                            "if(typeof _onCloudListSeen==='function')_onCloudListSeen(null)", null
                        )
                    }
                }
        }

        // ── Analytics ─────────────────────────────────────────────────────────
        @JavascriptInterface
        fun trackEvent(eventName: String, paramsJson: String) {
            try {
                Log.d(TAG, "[ANALYTICS] $eventName $paramsJson")
                val bundle = Bundle()
                val obj = org.json.JSONObject(paramsJson)
                val keys = obj.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    val v = obj.opt(k)
                    when (v) {
                        is Int    -> bundle.putLong(k, v.toLong())
                        is Long   -> bundle.putLong(k, v)
                        is Double -> bundle.putDouble(k, v)
                        is Boolean -> bundle.putString(k, v.toString())
                        else      -> bundle.putString(k, v?.toString() ?: "")
                    }
                }
                analytics.logEvent(eventName, bundle)
            } catch (e: Exception) {
                Log.w(TAG, "trackEvent failed: ${e.message}")
            }
        }

        @JavascriptInterface
        fun setUserProperty(name: String, value: String) {
            try {
                Log.d(TAG, "[ANALYTICS] setUserProperty $name=$value")
                analytics.setUserProperty(name, value)
            } catch (e: Exception) {
                Log.w(TAG, "setUserProperty failed: ${e.message}")
            }
        }
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onPause() {
        super.onPause()
        binding.webView.onPause()
        try { binding.adView.pause() } catch (_: Exception) {}
        if (::tts.isInitialized && tts.isSpeaking) tts.stop()
        try { onlinePlayer?.stop(); onlinePlayer?.release(); onlinePlayer = null } catch (_: Exception) {}
        speechRecognizer?.stopListening()
    }

    override fun onResume() {
        super.onResume()
        binding.webView.onResume()
        try { binding.adView.resume() } catch (_: Exception) {}
    }

    override fun onDestroy() {
        if (::tts.isInitialized) { tts.stop(); tts.shutdown() }
        if (::soundPool.isInitialized) try { soundPool.release() } catch (_: Exception) {}
        try { onlinePlayer?.release(); onlinePlayer = null } catch (_: Exception) {}
        if (::billingClient.isInitialized) billingClient.endConnection()
        speechRecognizer?.destroy(); speechRecognizer = null
        try { binding.adView.destroy() } catch (_: Exception) {}
        binding.webView.destroy()
        super.onDestroy()
    }
}
