package com.sitkatools.app

import android.content.Context
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import android.util.Log
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit

/**
 * The tablet's SitkaTools folder: picked once with Android's folder picker (the app keeps that grant), it holds
 * SitkaTools.html and the training pictures and videos. The app serves it at its own address, so the page finds
 * pics/j234_1.jpg the way it does next to its pics/ folder on a PC. Step pictures and videos may be anywhere in the
 * folder: next to SitkaTools.html, in pics/, in "Pictures and Videos", or in subfolders of those. A step's new picture
 * or video from the page's 📷 / 🎥 is written into the folder (saveStepMedia). Nothing else on the tablet is read.
 */
class TabletFolder(context: Context, val tree: Uri) {

    companion object {
        private const val TAG = "SitkaTools"
        const val PAGE_NAME = "SitkaTools.html"
        private const val MAX_DEPTH = 4            // subfolders looked through below the folder
        private const val MAX_FILES = 20000
        private val PAGE = Regex("^SitkaTools.*\\.html?$", RegexOption.IGNORE_CASE)   // SitkaTools (1).html too
        // A step's picture or video, named as the page's 🖼 Picture files takes them: [lang_]code_n.ext
        private val MEDIA = Regex("^(?:(fr|es|vi|zh)_)?([a-z0-9]{4})_0*(\\d+)\\.(png|jpe?g|webp|mp4)$", RegexOption.IGNORE_CASE)
        private val RANGE = Regex("^bytes=(\\d*)-(\\d*)$")
        private val TYPES = mapOf(
            "html" to "text/html", "htm" to "text/html", "png" to "image/png", "jpg" to "image/jpeg", "jpeg" to "image/jpeg",
            "webp" to "image/webp", "gif" to "image/gif", "svg" to "image/svg+xml", "mp4" to "video/mp4", "webm" to "video/webm",
            "json" to "application/json", "pdf" to "application/pdf", "txt" to "text/plain", "css" to "text/css", "js" to "text/javascript"
        )

        /** The page's name for a step's file — es_j234_1.jpg for Es_J234_01.JPEG — or null when it isn't one */
        fun mediaKey(name: String): String? {
            val m = MEDIA.matchEntire(name) ?: return null
            val (lang, code, n, ext) = m.destructured
            val e = ext.lowercase().let { if (it == "jpeg") "jpg" else it }
            return "${if (lang.isEmpty()) "" else lang.lowercase() + "_"}${code.lowercase()}_${n.trimStart('0').ifEmpty { "0" }}.$e"
        }

        fun typeOf(name: String) = TYPES[name.substringAfterLast('.', "").lowercase()]
    }

    /** One file in the folder; path is from the folder (pics/j234_1.jpg) */
    class Entry(val path: String, val parentId: String, val docId: String, val name: String, val size: Long, val modified: Long)

    /** What the folder held when it was last read: the page, every file by path, and each step's file by its name */
    class Index(val page: Entry?, val files: Map<String, Entry>, val media: Map<String, Entry>, val truncated: Boolean)

    private val resolver = context.contentResolver
    private val rootId: String = DocumentsContract.getTreeDocumentId(tree)
    private val worker = Executors.newSingleThreadExecutor()   // reading and writing the folder, one at a time
    @Volatile private var current: Future<Index?>? = null

    /** Where the folder is, as the Files app shows it (Download/SitkaTools) */
    val label: String = rootId.substringAfter(':').trim('/').ifBlank { "the tablet's storage" }

    /** Reads the folder again; requests wait for it. `then` gets what was read (null: the folder can't be read). */
    fun refresh(then: ((Index?) -> Unit)? = null): Future<Index?> {
        val task = FutureTask {
            val idx = try { scan() } catch (e: Exception) { Log.w(TAG, "can't read $label", e); null }
            then?.invoke(idx)
            idx
        }
        current = task
        worker.execute(task)
        return task
    }

    private fun index(): Index? = try { (current ?: refresh()).get(20, TimeUnit.SECONDS) } catch (_: Exception) { null }

    private fun docUri(id: String): Uri = DocumentsContract.buildDocumentUriUsingTree(tree, id)

    private class Row(val docId: String, val name: String, val dir: Boolean, val size: Long, val modified: Long)

    private fun children(parentId: String): List<Row> {
        val cols = arrayOf(Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME, Document.COLUMN_MIME_TYPE,
            Document.COLUMN_SIZE, Document.COLUMN_LAST_MODIFIED)
        val out = ArrayList<Row>()
        resolver.query(DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentId), cols, null, null, null)?.use { c ->
            while (c.moveToNext()) {
                val id = c.getString(0) ?: continue
                val name = c.getString(1) ?: continue
                out += Row(id, name, c.getString(2) == Document.MIME_TYPE_DIR,
                    if (c.isNull(3)) -1 else c.getLong(3), if (c.isNull(4)) 0 else c.getLong(4))
            }
        } ?: throw IOException("the folder can't be listed")
        return out
    }

    /** Lists the folder and its subfolders (hidden ones skipped). Where a step has the same file twice, the newest counts. */
    private fun scan(): Index {
        val files = HashMap<String, Entry>()
        val media = HashMap<String, Entry>()
        var truncated = false
        fun walk(parentId: String, prefix: String, depth: Int) {
            for (row in children(parentId)) {
                if (truncated) return
                if (row.name.startsWith(".")) continue
                if (row.dir) {
                    if (depth < MAX_DEPTH) walk(row.docId, "$prefix${row.name}/", depth + 1)
                    continue
                }
                if (files.size >= MAX_FILES) { truncated = true; return }
                val e = Entry("$prefix${row.name}", parentId, row.docId, row.name, row.size, row.modified)
                files[e.path.lowercase()] = e
                mediaKey(row.name)?.let { k -> if ((media[k]?.modified ?: Long.MIN_VALUE) < e.modified) media[k] = e }
            }
        }
        walk(rootId, "", 0)
        // The page: SitkaTools.html beside everything else; a newer copy saved as "SitkaTools (1).html" wins
        val page = files.values.filter { '/' !in it.path && PAGE.matches(it.name) }
            .maxWithOrNull(compareBy<Entry>({ it.modified }, { it.name.equals(PAGE_NAME, ignoreCase = true) }))
        if (truncated) Log.w(TAG, "$label has over $MAX_FILES files: only the first are served")
        return Index(page, files, media, truncated)
    }

    // ---- Serving: /SitkaTools.html is the page, /pics/<name> a step's file wherever it is, anything else by its path ----
    fun serve(path: String, headers: Map<String, String>): WebResourceResponse {
        val idx = index() ?: return status(503, "Service Unavailable")
        val rel = path.trimStart('/')
        val inPics = rel.startsWith("pics/", ignoreCase = true) && '/' !in rel.substring(5)
        val e = when {
            rel.equals(PAGE_NAME, ignoreCase = true) -> idx.page
            inPics -> mediaKey(rel.substring(5))?.let { idx.media[it] } ?: idx.files[rel.lowercase()]
            else -> idx.files[rel.lowercase()]
        } ?: return status(404, "Not Found")
        return try { file(e, headers) } catch (x: Exception) {
            Log.w(TAG, "can't read ${e.path}", x)
            status(404, "Not Found")
        }
    }

    /** A file, whole or the byte range asked for (a video seeking, or reading its index at the end) */
    private fun file(e: Entry, headers: Map<String, String>): WebResourceResponse {
        val pfd = resolver.openFileDescriptor(docUri(e.docId), "r") ?: throw IOException("can't open ${e.path}")
        val stream = ParcelFileDescriptor.AutoCloseInputStream(pfd)
        val size = pfd.statSize.takeIf { it >= 0 } ?: e.size
        val type = typeOf(e.name) ?: "application/octet-stream"
        val charset = if (type.startsWith("text/") || type == "application/json") "utf-8" else null
        val out = mutableMapOf("Cache-Control" to "no-store", "X-Content-Type-Options" to "nosniff", "Accept-Ranges" to "bytes")
        val m = headers.entries.firstOrNull { it.key.equals("Range", ignoreCase = true) }?.value?.trim()?.let { RANGE.matchEntire(it) }
        if (m != null && size > 0) {
            val (a, b) = m.destructured
            val start: Long
            val end: Long
            if (a.isEmpty()) {   // bytes=-500: the last 500
                start = (size - (b.toLongOrNull() ?: 0)).coerceAtLeast(0)
                end = size - 1
            } else {
                start = a.toLongOrNull() ?: size
                end = (b.toLongOrNull() ?: (size - 1)).coerceAtMost(size - 1)
            }
            if (start >= size || start > end) {
                stream.close()
                return status(416, "Range Not Satisfiable", mapOf("Content-Range" to "bytes */$size"))
            }
            stream.channel.position(start)
            out["Content-Range"] = "bytes $start-$end/$size"
            out["Content-Length"] = (end - start + 1).toString()
            return WebResourceResponse(type, charset, 206, "Partial Content", out, Bounded(stream, end - start + 1))
        }
        if (size >= 0) out["Content-Length"] = size.toString()
        return WebResourceResponse(type, charset, 200, "OK", out, stream)
    }

    private class Bounded(private val inner: InputStream, private var left: Long) : InputStream() {
        override fun read(): Int {
            if (left <= 0) return -1
            val c = inner.read()
            if (c >= 0) left--
            return c
        }
        override fun read(b: ByteArray, off: Int, len: Int): Int {
            if (left <= 0) return -1
            val n = inner.read(b, off, minOf(len.toLong(), left).toInt())
            if (n > 0) left -= n
            return n
        }
        override fun available() = minOf(inner.available().toLong(), left).toInt()
        override fun close() = inner.close()
    }

    fun status(code: Int, reason: String, headers: Map<String, String> = emptyMap()) =
        WebResourceResponse("text/plain", "utf-8", code, reason, mapOf("Cache-Control" to "no-store") + headers, ByteArrayInputStream(ByteArray(0)))

    // ---- Writing: a step's new picture or video, from the page's 📷 / 🎥 ----
    /**
     * Puts the file in the folder under its step's name: beside the step's file it replaces, else next to
     * SitkaTools.html. Nothing is deleted: the step's earlier picture (png, jpg or webp: the page would show a png
     * first) or video is renamed "j234_1 (replaced 2026-10-29 14.05).png", a name no step uses. `done` gets where it
     * went (Download/SitkaTools/pics), or the error, on the folder's own thread.
     */
    fun saveStepMedia(name: String, source: File, done: (Result<String>) -> Unit) {
        worker.execute {
            val r = runCatching {
                val key = mediaKey(name) ?: throw IOException("$name isn't a step's picture or video")
                val idx = scan()
                val stem = key.substringBeforeLast('.')
                val video = key.endsWith(".mp4")
                val old = idx.files.values.filter { f ->
                    val k = mediaKey(f.name)
                    k != null && k.substringBeforeLast('.') == stem && k.endsWith(".mp4") == video
                }
                val home = old.maxByOrNull { it.modified }
                val stamp = SimpleDateFormat("yyyy-MM-dd HH.mm", Locale.ROOT).format(Date())
                for (f in old) {
                    val ext = f.name.substringAfterLast('.', "")
                    DocumentsContract.renameDocument(resolver, docUri(f.docId), "${f.name.substringBeforeLast('.')} (replaced $stamp).$ext")
                        ?: throw IOException("${f.path} couldn't be renamed")
                }
                val made = DocumentsContract.createDocument(resolver, docUri(home?.parentId ?: rootId),
                    typeOf(name) ?: "application/octet-stream", name) ?: throw IOException("$name couldn't be made")
                resolver.openOutputStream(made, "w")?.use { o -> source.inputStream().use { it.copyTo(o) } }
                    ?: throw IOException("$name couldn't be written")
                home?.path?.substringBeforeLast('/', "")?.takeIf { it.isNotEmpty() }?.let { "$label/$it" } ?: label
            }
            // Read the folder again, so the page finds the new file
            current = CompletableFuture.completedFuture(try { scan() } catch (_: Exception) { null })
            done(r)
        }
    }
}
