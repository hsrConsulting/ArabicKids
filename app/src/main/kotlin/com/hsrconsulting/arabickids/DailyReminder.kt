package com.hsrconsulting.arabickids

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import java.util.Calendar

// Daily reminder infrastructure.
// - DailyReminder.schedule() is called once from MainActivity to arm an
//   inexact daily alarm at REMINDER_HOUR local time.
// - DailyReminderReceiver fires at that time and posts the notification
//   only if the child hasn't already played today (flag written by JS via
//   ak_streak_lastActive → persisted in WebView localStorage; since we can't
//   read that from native, we rely on a SharedPreferences mirror updated by
//   MainActivity on each save). For simplicity V1, we always show the
//   reminder — the text is a soft nudge, not guilt-tripping.
// - BootReceiver re-arms the alarm after device reboot (alarms are dropped
//   when the device reboots).

object DailyReminder {
    const val CHANNEL_ID = "daily_reminder"
    private const val REQUEST_CODE = 42
    private const val REMINDER_HOUR = 17 // 5 PM local time
    private const val REMINDER_MINUTE = 0

    fun schedule(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val intent = Intent(context, DailyReminderReceiver::class.java)
        val pending = PendingIntent.getBroadcast(
            context, REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, REMINDER_HOUR)
            set(Calendar.MINUTE, REMINDER_MINUTE)
            set(Calendar.SECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
        }
        alarmManager.setInexactRepeating(
            AlarmManager.RTC_WAKEUP,
            cal.timeInMillis,
            AlarmManager.INTERVAL_DAY,
            pending
        )
        Log.d("ArabicKids", "Daily reminder scheduled at ${cal.time}")
    }

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                val ch = NotificationChannel(CHANNEL_ID, "Daily reminder", NotificationManager.IMPORTANCE_DEFAULT)
                    .apply { description = "Soft daily nudge to come back and learn Arabic" }
                nm.createNotificationChannel(ch)
            }
        }
    }
}

class DailyReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        DailyReminder.ensureChannel(context)
        val launch = Intent(context, SplashActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val contentPending = PendingIntent.getActivity(
            context, 0, launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val title = "Arabic Kids"
        val body = "\uD83D\uDD25 5 minutes d'arabe aujourd'hui ?"
        val notif = NotificationCompat.Builder(context, DailyReminder.CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(contentPending)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(1, notif)
    }
}

// Streak nudge: fires at 19h only if the child has not completed today's
// daily challenge. Status is mirrored from JS to SharedPreferences via the
// Android.setDailyDone() bridge call inside markDailyDone().
object StreakReminder {
    const val CHANNEL_ID = "streak_reminder"
    private const val PREFS_NAME = "arabickids_prefs"
    private const val KEY_LAST_DAILY_DONE = "last_daily_done"
    private const val REQUEST_CODE = 43
    private const val REMINDER_HOUR = 19
    private const val REMINDER_MINUTE = 0

    fun schedule(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val intent = Intent(context, StreakReminderReceiver::class.java)
        val pending = PendingIntent.getBroadcast(
            context, REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, REMINDER_HOUR)
            set(Calendar.MINUTE, REMINDER_MINUTE)
            set(Calendar.SECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
        }
        alarmManager.setInexactRepeating(
            AlarmManager.RTC_WAKEUP,
            cal.timeInMillis,
            AlarmManager.INTERVAL_DAY,
            pending
        )
        Log.d("ArabicKids", "Streak reminder scheduled at ${cal.time}")
    }

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                val ch = NotificationChannel(CHANNEL_ID, "Streak reminder", NotificationManager.IMPORTANCE_DEFAULT)
                    .apply { description = "Reminds the child if today's challenge isn't done yet" }
                nm.createNotificationChannel(ch)
            }
        }
    }

    fun markDoneToday(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(KEY_LAST_DAILY_DONE, todayIso()).apply()
    }

    fun isDoneToday(context: Context): Boolean {
        val stored = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_LAST_DAILY_DONE, null) ?: return false
        return stored == todayIso()
    }

    private fun todayIso(): String {
        val cal = Calendar.getInstance()
        return "%04d-%02d-%02d".format(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH))
    }
}

class StreakReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (StreakReminder.isDoneToday(context)) {
            Log.d("ArabicKids", "Streak reminder skipped — daily challenge already done today")
            return
        }
        StreakReminder.ensureChannel(context)
        val launch = Intent(context, SplashActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val contentPending = PendingIntent.getActivity(
            context, 1, launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val title = "Arabic Kids"
        val body = "🔥 Ta série va s'éteindre — fais ton défi du jour !"
        val notif = NotificationCompat.Builder(context, StreakReminder.CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(contentPending)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(2, notif)
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            DailyReminder.schedule(context)
            StreakReminder.schedule(context)
        }
    }
}
