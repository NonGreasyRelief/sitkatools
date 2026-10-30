package com.sitkatools.app

import android.content.Context
import android.net.Uri
import android.util.Base64
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/** A request the app turns down, with the DOMException name the page's promise rejects with */
class BridgeError(val name: String, message: String) : Exception(message)

/**
 * The app's two cache folders that another app may see, one file at a time, through FileProvider (res/xml/file_paths.xml):
 *  - share/: a file the page saves through the share sheet (a database file, a recipe, a step's picture or video),
 *    sent over by the page in pieces, then handed to the app picked in the share sheet (OneDrive: Upload); a step's
 *    picture or video is also copied from here into the tablet's SitkaTools folder (TabletFolder);
 *  - capture/: what the camera app takes for the page's 📷 / 🎥 buttons.
 * Nothing else on the tablet is shared. Both empty themselves: capture/ when the app starts (the page that used the
 * pictures is gone), shared files an hour after they were made (the app they went to has read them by then).
 */
class SharedFiles(private val context: Context) {

    companion object {
        const val MAX_BYTES = 1L shl 30                  // 1 GB: a database is a few MB, a training video should be short
        private const val SPARE_BYTES = 64L shl 20       // left free on the tablet after a file is written
        private const val KEEP_MS = 60 * 60 * 1000L
        private val UNSAFE = Regex("[\\\\/:*?\"<>|\\p{Cntrl}]")
        private val MIME = Regex("^[a-z0-9.+-]+/[a-z0-9.+-]+$")
    }

    private val authority = "${context.packageName}.files"
    private val shareDir get() = File(context.cacheDir, "share")
    private val captureDir get() = File(context.cacheDir, "capture")

    /** A file on its way from the page: written piece by piece until it has all its bytes */
    class Outgoing(val file: File, val type: String, val size: Long) { var written = 0L }
    private val outgoing = HashMap<String, Outgoing>()

    fun tidy() {
        captureDir.deleteRecursively()
        tidyShares()
    }

    private fun tidyShares() {
        val now = System.currentTimeMillis()
        shareDir.listFiles()?.filter { now - it.lastModified() > KEEP_MS }?.forEach { it.deleteRecursively() }
    }

    fun uri(f: File): Uri = FileProvider.getUriForFile(context, authority, f)

    // ---- Sharing: begin (name, type, size) → pieces → finish → the share sheet ----
    fun begin(name: String, type: String, size: Long): String {
        if (size < 0) throw BridgeError("DataError", "The file's size is missing.")
        if (size > MAX_BYTES) throw BridgeError("NotAllowedError", "That file is too big to save from the app (over 1 GB).")
        tidyShares()
        if (context.cacheDir.usableSpace < size + SPARE_BYTES) throw BridgeError("QuotaExceededError", "The tablet is too full to save that file.")
        val token = UUID.randomUUID().toString()
        val dir = File(shareDir, token).apply { mkdirs() }
        val file = File(dir, safeName(name)).apply { writeBytes(ByteArray(0)) }
        outgoing[token] = Outgoing(file, cleanType(type), size)
        return token
    }

    fun append(token: String, base64: String) {
        val o = outgoing[token] ?: throw BridgeError("InvalidStateError", "That file isn't being saved.")
        val bytes = try { Base64.decode(base64, Base64.DEFAULT) } catch (_: IllegalArgumentException) {
            drop(token); throw BridgeError("DataError", "Part of the file arrived damaged.")
        }
        if (o.written + bytes.size > o.size) { drop(token); throw BridgeError("DataError", "More of the file arrived than its size.") }
        FileOutputStream(o.file, true).use { it.write(bytes) }
        o.written += bytes.size
    }

    fun finish(token: String): Outgoing {
        val o = outgoing.remove(token) ?: throw BridgeError("InvalidStateError", "That file isn't being saved.")
        if (o.written != o.size || o.file.length() != o.size) {
            o.file.parentFile?.deleteRecursively()
            throw BridgeError("DataError", "The file didn't arrive whole.")
        }
        return o
    }

    private fun drop(token: String) { outgoing.remove(token)?.file?.parentFile?.deleteRecursively() }

    /** The name the receiving app shows and saves under: the page's own (Building-B6.json), without path characters */
    private fun safeName(raw: String): String =
        raw.replace(UNSAFE, "_").trim().trimStart('.').take(120).ifBlank { "SitkaTools file" }

    private fun cleanType(raw: String): String =
        raw.lowercase().substringBefore(';').trim().takeIf { MIME.matches(it) } ?: "application/octet-stream"

    // ---- The camera: a new, empty file for the camera app to write into ----
    fun newCapture(ext: String): File {
        captureDir.mkdirs()
        return File(captureDir, "SitkaTools-${System.currentTimeMillis()}.$ext")
    }
}
