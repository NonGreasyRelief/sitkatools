package com.sitkalegends.sitkatools

import android.content.SharedPreferences
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * The office PIN in front of the app's settings (the tablet's building, later its SharePoint folders), so staff on the
 * floor can't change them. Kept only as a salted PBKDF2 hash in the app's own preferences, never the PIN itself.
 * Five wrong tries in a row wait a minute.
 */
class OfficePin(private val prefs: SharedPreferences) {

    companion object {
        private const val KEY_SALT = "pinSalt"
        private const val KEY_HASH = "pinHash"
        private const val ROUNDS = 120_000
        private const val WAIT_AFTER = 5
        private const val WAIT_MS = 60_000L
        val FORMAT = Regex("^\\d{4,8}$")
    }

    private var fails = 0
    private var waitUntil = 0L

    val isSet: Boolean get() = prefs.contains(KEY_HASH)

    fun set(pin: String) {
        require(FORMAT.matches(pin))
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        prefs.edit().putString(KEY_SALT, salt.hex()).putString(KEY_HASH, hash(pin, salt).hex()).apply()
    }

    /** null when right; otherwise why not */
    fun check(pin: String): String? {
        val now = System.currentTimeMillis()
        if (now < waitUntil) return "Too many wrong PINs — wait a minute, then try again."
        val salt = prefs.getString(KEY_SALT, null)?.unhex() ?: return "No office PIN is set."
        val want = prefs.getString(KEY_HASH, null)?.unhex() ?: return "No office PIN is set."
        if (FORMAT.matches(pin) && MessageDigest.isEqual(hash(pin, salt), want)) { fails = 0; return null }
        if (++fails >= WAIT_AFTER) { fails = 0; waitUntil = now + WAIT_MS; return "Too many wrong PINs — wait a minute, then try again." }
        return "Wrong PIN."
    }

    private fun hash(pin: String, salt: ByteArray): ByteArray =
        SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(PBEKeySpec(pin.toCharArray(), salt, ROUNDS, 256)).encoded

    private fun ByteArray.hex() = joinToString("") { "%02x".format(it) }
    private fun String.unhex() = chunked(2).map { it.toInt(16).toByte() }.toByteArray()
}
