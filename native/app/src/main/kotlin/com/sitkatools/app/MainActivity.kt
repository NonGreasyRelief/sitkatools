package com.sitkatools.app

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Message
import android.print.PrintAttributes
import android.print.PrintManager
import android.util.Log
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.ScriptHandler
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File

/**
 * SitkaTools for Android (native/README.md): one screen holding one WebView, which runs the SitkaTools.html in the
 * tablet's SitkaTools folder (TabletFolder) from the app's own address, https://appassets.androidplatform.net (a name
 * kept for apps that never reaches the network). The folder's training pictures and videos are served beside it. The
 * app has no internet access: the database comes from SharePoint through Android's file picker (OneDrive) and goes
 * back through the share sheet (OneDrive → Upload). It fills in what the WebView lacks: the share sheet, the file
 * picker and the camera, dialogs, print windows, full-screen video, and the page brought back when Android stops it.
 */
class MainActivity : ComponentActivity() {

    companion object {
        private const val TAG = "SitkaTools"
        const val HOST = "appassets.androidplatform.net"
        const val ORIGIN = "https://$HOST"
        const val PAGE_PATH = "/" + TabletFolder.PAGE_NAME
        private const val MIN_WEBVIEW = 118   // the page's styles use CSS @scope
        private const val PREFS = "sitka"
        private const val KEY_FOLDER = "folder"
        private const val KEY_DEVICE = "device"
        const val ACTION_CHANGE_FOLDER = "com.sitkatools.app.CHANGE_FOLDER"
        private const val ACTION_SHARE_CHOSEN = "com.sitkatools.app.SHARE_CHOSEN"
        private const val FOLDER_GRANT = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        private const val DIALOG = android.R.style.Theme_DeviceDefault_Dialog_Alert
        private val BG = Color.parseColor("#1A1A2E")
    }

    private lateinit var content: FrameLayout      // the page (or the folder screen), and print windows over it
    private var web: WebView? = null
    private var screen: View? = null               // the folder screen, while there's no page
    private var resumeScript: ScriptHandler? = null   // the before-page script while it still says "reopened"
    private var folder: TabletFolder? = null
    private val children = ArrayDeque<ChildWindow>()
    private var fullscreen: Pair<View, WebChromeClient.CustomViewCallback>? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val prefs by lazy { getSharedPreferences(PREFS, MODE_PRIVATE) }
    private val files by lazy { SharedFiles(this) }
    private val shim by lazy { assets.open("sitka-app.js").bufferedReader().use { it.readText() } }

    // ---- The tablet's SitkaTools folder, picked once (the app keeps the grant) ----
    private val pickFolder = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { tookFolder(it) }

    // ---- Picking files for the page's file boxes (📂 Load DB from OneDrive, imports, picture files) ----
    private val pickMany = registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        answerFiles(uris.takeIf { it.isNotEmpty() }?.toTypedArray())
    }
    private val pickOne = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        answerFiles(uri?.let { arrayOf(it) })
    }

    // ---- The camera, for the page's 📷 / 🎥 buttons (a file box with `capture`): the camera app writes into capture/ ----
    private var captureFile: File? = null
    private val takePicture = registerForActivityResult(ActivityResultContracts.TakePicture()) { tookCapture(it) }
    private val takeVideo = registerForActivityResult(ActivityResultContracts.CaptureVideo()) { tookCapture(it) }

    // ---- The share sheet, for the page's saves (navigator.share): answered once an app is picked, or the sheet closed ----
    private var shareAnswer: ((Boolean) -> Unit)? = null
    private val shareSheet = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        // The sheet is gone (or the app it opened is done). A pick was answered already, by shareChosen; give its
        // broadcast a moment in case it comes after this, then it was dismissed (unless another share began meanwhile).
        val waiting = shareAnswer ?: return@registerForActivityResult
        content.postDelayed({ if (shareAnswer === waiting) endShare(chosen = false) }, 400)
    }
    private val shareChosen = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) = endShare(chosen = true)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        files.tidy()
        ContextCompat.registerReceiver(this, shareChosen, IntentFilter(ACTION_SHARE_CHOSEN), ContextCompat.RECEIVER_NOT_EXPORTED)
        content = FrameLayout(this).apply { setBackgroundColor(BG) }
        setContentView(content)
        // Android draws edge to edge: keep the page clear of the system bars and the keyboard
        ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
            val b = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            v.setPadding(b.left, b.top, b.right, b.bottom)
            WindowInsetsCompat.CONSUMED
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = onBack()
        })
        webViewProblem()?.let { problem ->
            showScreen(problem, "Open the Play Store" to { openOutside(Uri.parse("market://details?id=com.google.android.webview")) })
            return
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        folder = prefs.getString(KEY_FOLDER, null)?.let { runCatching { TabletFolder(this, Uri.parse(it)) }.getOrNull() }
        // Recreated after Android stopped the app: the page brings its session back by itself
        startPage(resumed = savedInstanceState != null)
        if (intent?.action == ACTION_CHANGE_FOLDER) changeFolder()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.action == ACTION_CHANGE_FOLDER) changeFolder()
    }

    // ---- The WebView must be new enough for the page, and able to run the app's script before it ----
    private fun webViewProblem(): String? {
        val pkg = WebViewCompat.getCurrentWebViewPackage(this) ?: return "Android System WebView isn't available on this tablet."
        val major = pkg.versionName?.substringBefore('.')?.toIntOrNull() ?: 0
        if (major < MIN_WEBVIEW || !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            return "SitkaTools needs Android System WebView $MIN_WEBVIEW or newer; this tablet has ${pkg.versionName}. " +
                "Update \"Android System WebView\" in the Play Store, then open SitkaTools again."
        }
        return null
    }

    // ---- The folder screen: what to do when there's no page to show ----
    private fun showScreen(message: String, vararg actions: Pair<String, () -> Unit>) {
        dropPage()
        screen?.let { content.removeView(it) }
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(32), dp(32), dp(32), dp(32))
        }
        box.addView(TextView(this).apply {
            text = "SitkaTools"; textSize = 28f; gravity = Gravity.CENTER; setTextColor(Color.parseColor("#53D8A8"))
        })
        box.addView(TextView(this).apply {
            text = message; textSize = 18f; gravity = Gravity.CENTER; setTextColor(Color.parseColor("#E8E8E8"))
            setPadding(0, dp(16), 0, dp(24))
        })
        for ((label, act) in actions) box.addView(Button(this).apply { text = label; textSize = 18f; setOnClickListener { act() } })
        content.addView(box, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        screen = box
    }

    private val pickAction get() = "📁 Pick the SitkaTools folder" to { pickFolder.launch(folder?.tree) }

    // ---- The page: read the folder, then open its SitkaTools.html ----
    private fun startPage(resumed: Boolean) {
        val f = folder ?: return showScreen("Pick the folder on this tablet that holds SitkaTools.html and the training " +
            "pictures and videos (for example Download/SitkaTools). You pick it once.", pickAction)
        f.refresh { idx ->
            runOnUiThread {
                if (isDestroyed || folder !== f) return@runOnUiThread
                when {
                    idx == null -> showScreen("SitkaTools can't open ${f.label} any more: was it moved, renamed or deleted? " +
                        "Pick the folder again.", "Try again" to { startPage(false) }, pickAction)
                    idx.page == null -> showScreen("There's no SitkaTools.html in ${f.label}. Copy it there, with the training " +
                        "pictures and videos, then tap Try again.", "Try again" to { startPage(false) }, pickAction)
                    else -> openPage(f, idx, resumed)
                }
            }
        }
    }

    private fun openPage(f: TabletFolder, idx: TabletFolder.Index, resumed: Boolean) {
        dropPage()
        screen?.let { content.removeView(it) }
        screen = null
        val w = WebView(this)
        configure(w)
        installBridge(w, resumed)
        content.addView(w, 0, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        web = w
        idx.page?.name?.takeUnless { it.equals(TabletFolder.PAGE_NAME, ignoreCase = true) }?.let {
            toast("Opened $it, the newest SitkaTools page in ${f.label}")
        }
        if (idx.truncated) toast("${f.label} holds too many files: some pictures may not show. Keep only SitkaTools' files in it.")
        w.loadUrl(pageUrl())
    }

    /** The page's address, with the device it was last set to (🏷️ Set this device… puts ?device= in it), as a bookmark would */
    private fun pageUrl(): String {
        val device = prefs.getString(KEY_DEVICE, null)
        return ORIGIN + PAGE_PATH + (device?.let { "?device=" + Uri.encode(it) } ?: "")
    }

    private fun rememberDevice(url: String?) {
        val u = url?.let(Uri::parse) ?: return
        if (u.scheme != "https" || u.host != HOST || u.path != PAGE_PATH) return
        prefs.edit().putString(KEY_DEVICE, u.getQueryParameter("device")?.trim()?.ifEmpty { null }).apply()
    }

    private fun dropPage() {
        closeAllChildren()
        fullscreen?.let { content.removeView(it.first) }
        fullscreen = null
        shareAnswer = null   // a share sheet's answer would go to the page being replaced
        answerFiles(null)
        web?.let { rememberDevice(it.url); content.removeView(it); it.destroy() }
        web = null
        resumeScript = null
    }

    // ---- 📁 Change folder (holding the app's icon) ----
    private fun changeFolder() {
        val f = folder
        if (web == null || f == null) { pickFolder.launch(f?.tree); return }
        AlertDialog.Builder(this, DIALOG)
            .setTitle("📁 Change folder")
            .setMessage("SitkaTools opens from ${f.label}. Pick another folder? SitkaTools reopens from it, and work that " +
                "isn't saved comes back by itself.")
            .setPositiveButton("Pick folder") { _, _ -> pickFolder.launch(f.tree) }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun tookFolder(uri: Uri?) {
        uri ?: return   // cancelled: nothing changes
        try { contentResolver.takePersistableUriPermission(uri, FOLDER_GRANT) }
        catch (_: SecurityException) { toast("SitkaTools can't keep that folder. Pick a folder inside Download or Documents."); return }
        val f = TabletFolder(this, uri)
        f.refresh { idx ->
            runOnUiThread {
                if (isDestroyed) return@runOnUiThread
                val why = when {
                    idx == null -> "SitkaTools can't read ${f.label}."
                    idx.page == null -> "There's no SitkaTools.html in ${f.label}."
                    else -> null
                }
                val open = web != null
                if (why != null && open) {   // the page stays open from the folder it came from
                    if (uri != folder?.tree) runCatching { contentResolver.releasePersistableUriPermission(uri, FOLDER_GRANT) }
                    ask("$why SitkaTools stays open from ${folder?.label}.", cancel = null, onOk = {}, onCancel = {})
                    return@runOnUiThread
                }
                // The folder it uses now: the grant for any other one is let go
                contentResolver.persistedUriPermissions.filter { it.uri != uri }
                    .forEach { runCatching { contentResolver.releasePersistableUriPermission(it.uri, FOLDER_GRANT) } }
                prefs.edit().putString(KEY_FOLDER, uri.toString()).apply()
                folder = f
                if (why != null) showScreen("$why Copy it there, with the training pictures and videos, then tap Try again.",
                    "Try again" to { startPage(false) }, pickAction)
                else openPage(f, idx!!, resumed = open)
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configure(w: WebView, child: Boolean = false) {
        w.setBackgroundColor(BG)
        with(w.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            textZoom = 100
            setSupportMultipleWindows(!child)
            javaScriptCanOpenWindowsAutomatically = !child
            userAgentString = "$userAgentString SitkaToolsApp/${BuildConfig.VERSION_NAME}"
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(w.settings, false)
        }
        w.webViewClient = Client(child)
        w.webChromeClient = Chrome()
    }

    // ---- The app's script before the page (sitka-app.js), and the channel only the app's own address can use ----
    private fun beforePage(resumed: Boolean): String {
        val cfg = JSONObject().put("resumed", resumed).put("appVersion", BuildConfig.VERSION_NAME)
        return "window.__sitkaApp = $cfg;\n$shim"
    }

    @SuppressLint("RequiresFeature")   // both features are checked as the app starts (webViewProblem)
    private fun installBridge(w: WebView, resumed: Boolean) {
        val script = WebViewCompat.addDocumentStartJavaScript(w, beforePage(resumed), setOf(ORIGIN))
        resumeScript = if (resumed) script else null
        WebViewCompat.addWebMessageListener(w, "SitkaApp", setOf(ORIGIN)) { _, message, sourceOrigin, isMainFrame, proxy ->
            if (!isMainFrame || sourceOrigin.toString().trimEnd('/') != ORIGIN) return@addWebMessageListener
            val req = runCatching { JSONObject(message.data ?: "") }.getOrNull() ?: return@addWebMessageListener
            val reply = Reply(proxy, req.optInt("id"))
            try { handle(req, reply) }
            catch (e: BridgeError) { reply.fail(e.name, e.message ?: "") }
            catch (e: Exception) { Log.w(TAG, "request ${req.optString("op")} failed", e); reply.fail("UnknownError", "The app couldn't do that.") }
        }
    }

    /** One answer to one request from the page: { id, ok, result | error } */
    private class Reply(private val proxy: JavaScriptReplyProxy, private val id: Int) {
        private var sent = false
        fun ok(result: Any? = null) = send(JSONObject().put("id", id).put("ok", true).put("result", result ?: JSONObject.NULL))
        fun fail(name: String, message: String) =
            send(JSONObject().put("id", id).put("ok", false).put("error", JSONObject().put("name", name).put("message", message)))
        @SuppressLint("RequiresFeature")
        private fun send(m: JSONObject) {
            if (sent) return
            sent = true
            runCatching { proxy.postMessage(m.toString()) }   // the page may be gone by now
        }
    }

    private fun handle(req: JSONObject, reply: Reply) {
        when (req.optString("op")) {
            "print" -> {
                val top = children.lastOrNull() ?: throw BridgeError("InvalidStateError", "No print window is open.")
                print(top)
                reply.ok()
            }
            "shareBegin" -> reply.ok(JSONObject().put("token",
                files.begin(req.optString("name"), req.optString("type"), req.optLong("size", -1))))
            "shareChunk" -> { files.append(req.optString("token"), req.optString("data")); reply.ok() }
            "share" -> {
                val o = files.finish(req.optString("token"))
                val f = folder
                if (f != null && TabletFolder.mediaKey(o.file.name) != null) keepOnTablet(f, o, req.optString("title"), reply)
                else share(o, req.optString("title"), reply)
            }
            else -> throw BridgeError("NotSupportedError", "The app doesn't know that request.")
        }
    }

    // ---- A step's picture or video (📷 / 🎥 → 📤 Save): kept in the tablet's folder, then the share sheet for SharePoint ----
    private fun keepOnTablet(f: TabletFolder, o: SharedFiles.Outgoing, title: String, reply: Reply) {
        f.saveStepMedia(o.file.name, o.file) { r ->
            runOnUiThread {
                if (isDestroyed) return@runOnUiThread
                r.onSuccess { where ->
                    reply.ok()   // it's on this tablet: saved, whatever the share sheet does next
                    toast("${o.file.name} is saved in $where. For the other tablets, pick OneDrive and put it in “Pictures and Videos” on SharePoint.")
                    try { share(o, title, null) } catch (_: BridgeError) { o.file.parentFile?.deleteRecursively() }
                }.onFailure { e ->
                    Log.w(TAG, "couldn't keep ${o.file.name} in ${f.label}", e)
                    toast("${o.file.name} couldn't be saved in ${f.label}: ${e.message}. Share it instead.")
                    try { share(o, title, reply) } catch (b: BridgeError) { reply.fail(b.name, b.message ?: "") }
                }
            }
        }
    }

    // ---- Saving a file: Android's share sheet, as Chrome's navigator.share does on a tablet (OneDrive → Upload) ----
    private fun share(o: SharedFiles.Outgoing, title: String, reply: Reply?) {
        if (shareAnswer != null) throw BridgeError("InvalidStateError", "A share sheet is already open.")
        val uri = files.uri(o.file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = o.type
            putExtra(Intent.EXTRA_STREAM, uri)
            clipData = ClipData.newRawUri(o.file.name, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        // Android fills in the app picked and sends it here (shareChosen): that's when the page counts it as saved
        val mutable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
        val picked = PendingIntent.getBroadcast(this, 0, Intent(ACTION_SHARE_CHOSEN).setPackage(packageName),
            PendingIntent.FLAG_UPDATE_CURRENT or mutable)
        // Not shared: no app has the file, so its copy goes now (a shared one stays an hour for the app reading it)
        val discard = { o.file.parentFile?.deleteRecursively() }
        shareAnswer = { chosen ->
            if (!chosen) discard()
            if (chosen) reply?.ok() else reply?.fail("AbortError", "The share was cancelled.")
        }
        try {
            shareSheet.launch(Intent.createChooser(send, title.ifBlank { o.file.name }, picked.intentSender))
        } catch (_: ActivityNotFoundException) {
            shareAnswer = null
            discard()
            throw BridgeError("NotAllowedError", "No app on this tablet can take the file.")
        }
    }

    private fun endShare(chosen: Boolean) {
        val answer = shareAnswer ?: return
        shareAnswer = null
        answer(chosen)
    }

    // ---- Requests: the app's own address is the tablet's folder; every other site is refused ----
    private fun serve(request: WebResourceRequest): WebResourceResponse {
        val u = request.url
        val f = folder
        if (u.scheme != "https" || u.host != HOST || f == null) return refused()
        return f.serve(u.path ?: "/", request.requestHeaders ?: emptyMap())
    }

    private fun refused() = WebResourceResponse("text/plain", "utf-8", 403, "Forbidden",
        mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(ByteArray(0)))

    private inner class Client(private val child: Boolean) : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
            when (request.url.scheme) {
                "https", "http" -> serve(request)
                else -> null   // blob:, data:, about: — the page's own
            }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val u = request.url
            if (u.scheme == "https" && u.host == HOST) return false
            if (child && (u.scheme == "about" || u.scheme == "blob" || u.scheme == "data")) return false
            // Talk's Google Translate (the page's only other site) opens outside the app; anything else is refused
            if (u.scheme == "https" && u.host == "translate.google.com") openOutside(u)
            else toast("SitkaTools only opens its own pages.")
            if (child) children.firstOrNull { it.web == view }?.let { closeChild(it) }
            return true
        }

        // 🏷️ Set this device… changes the page's address (?device=): the app opens it that way next time
        override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
            if (!child && view == web) rememberDevice(url)
        }

        // Reopened: the first page load said so; a later reload in the same view is the page's own
        @SuppressLint("RequiresFeature")
        override fun onPageFinished(view: WebView, url: String?) {
            if (child || view != web) return
            resumeScript?.let {
                it.remove()
                WebViewCompat.addDocumentStartJavaScript(view, beforePage(false), setOf(ORIGIN))
                resumeScript = null
            }
        }

        // The page's process is gone (crashed, or Android took it back): the page comes back with its session. A print
        // window goes with it. Unhandled, Android would close the whole app.
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            if (child) { children.firstOrNull { it.web == view }?.let { closeChild(it) }; return true }
            Log.w(TAG, "page process gone (crash=${detail.didCrash()}); bringing the page back")
            if (view == web) {
                web = null
                content.removeView(view)
                view.destroy()
                startPage(resumed = true)
            }
            return true
        }
    }

    private fun openOutside(u: Uri) {
        try { startActivity(Intent(Intent.ACTION_VIEW, u)) } catch (_: ActivityNotFoundException) { toast("No app on this tablet can open that.") }
    }

    // ---- Print windows (window.open + document.write): a child view with 🖨️ Print and ✕ Close ----
    private inner class ChildWindow(val frame: View, val web: WebView)

    private fun openChild(resultMsg: Message): Boolean {
        val child = WebView(this)
        configure(child, child = true)
        val frame = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.WHITE)
            isClickable = true
        }
        val holder = ChildWindow(frame, child)
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.parseColor("#16213E"))
            setPadding(dp(8), dp(4), dp(8), dp(4))
        }
        bar.addView(TextView(this).apply { text = "SitkaTools"; setTextColor(Color.parseColor("#53D8A8")); textSize = 16f },
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        bar.addView(Button(this).apply { text = "🖨️ Print"; setOnClickListener { print(holder) } })
        bar.addView(Button(this).apply { text = "✕ Close"; setOnClickListener { closeChild(holder) } })
        frame.addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        frame.addView(child, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        content.addView(frame, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        children.addLast(holder)
        (resultMsg.obj as WebView.WebViewTransport).webView = child
        resultMsg.sendToTarget()
        return true
    }

    private fun closeChild(c: ChildWindow) {
        if (!children.remove(c)) return
        content.removeView(c.frame)
        c.web.destroy()
    }

    private fun closeAllChildren() { while (children.isNotEmpty()) closeChild(children.last()) }

    private fun print(c: ChildWindow) {
        val pm = getSystemService(PRINT_SERVICE) as PrintManager
        val name = c.web.title?.takeIf { it.isNotBlank() } ?: "SitkaTools"
        pm.print(name, c.web.createPrintDocumentAdapter(name),
            PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.NA_LETTER).build())
    }

    // ---- Dialogs, file picking, full-screen video, pop-ups ----
    private inner class Chrome : WebChromeClient() {
        override fun onJsAlert(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
            ask(message, cancel = null, onOk = { result.confirm() }, onCancel = { result.confirm() })
            return true
        }

        override fun onJsConfirm(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
            ask(message, cancel = "Cancel", onOk = { result.confirm() }, onCancel = { result.cancel() })
            return true
        }

        override fun onJsPrompt(view: WebView, url: String?, message: String?, defaultValue: String?, result: JsPromptResult): Boolean {
            val input = EditText(this@MainActivity).apply { setText(defaultValue ?: "") }
            var answered = false
            AlertDialog.Builder(this@MainActivity, DIALOG)
                .setMessage(message)
                .setView(input)
                .setPositiveButton("OK") { _, _ -> if (!answered) { answered = true; result.confirm(input.text.toString()) } }
                .setNegativeButton("Cancel") { _, _ -> if (!answered) { answered = true; result.cancel() } }
                .setOnCancelListener { if (!answered) { answered = true; result.cancel() } }
                .show()
            return true
        }

        override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean =
            if (view == web) openChild(resultMsg) else false

        override fun onCloseWindow(window: WebView) {
            children.firstOrNull { it.web == window }?.let { closeChild(it) }
        }

        override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
            fileCallback?.onReceiveValue(null)   // a chooser never answered: answer it (empty) before the next
            fileCallback = callback
            if (params.mode == FileChooserParams.MODE_OPEN_FOLDER) {
                toast("No need here: the app shows the step pictures and videos in ${folder?.label ?: "the SitkaTools folder"}.")
                answerFiles(null)
                return true
            }
            val types = mimeTypes(params.acceptTypes)
            // 📷 / 🎥 (accept image/* or video/*, with capture): straight to the camera app
            val media = types.firstOrNull()?.substringBefore('/')
            if (params.isCaptureEnabled && (media == "image" || media == "video") && types.all { it.startsWith("$media/") }) {
                if (startCamera(video = media == "video")) return true
                toast("No camera app on this tablet: pick a file instead.")
            }
            try {
                if (params.mode == FileChooserParams.MODE_OPEN_MULTIPLE) pickMany.launch(types) else pickOne.launch(types)
            } catch (_: ActivityNotFoundException) {
                toast("No file picker on this tablet.")
                answerFiles(null)
            }
            return true
        }

        override fun onShowCustomView(view: View, callback: CustomViewCallback) {
            fullscreen?.second?.onCustomViewHidden()
            fullscreen = view to callback
            content.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }

        override fun onHideCustomView() {
            fullscreen?.let { content.removeView(it.first) }
            fullscreen = null
        }

        override fun onPermissionRequest(request: PermissionRequest) = request.deny()
    }

    /** One answer per dialog, whichever way it's closed */
    private fun ask(message: String?, cancel: String?, onOk: () -> Unit, onCancel: () -> Unit) {
        var answered = false
        val b = AlertDialog.Builder(this, DIALOG)
            .setMessage(message)
            .setPositiveButton("OK") { _, _ -> if (!answered) { answered = true; onOk() } }
            .setOnCancelListener { if (!answered) { answered = true; onCancel() } }
        if (cancel != null) b.setNegativeButton(cancel) { _, _ -> if (!answered) { answered = true; onCancel() } }
        b.show()
    }

    /** The page's accept list (".json", "image/png", …) as types Android's picker understands */
    private fun mimeTypes(accept: Array<String>?): Array<String> {
        val list = accept.orEmpty().flatMap { it.split(',') }.map { it.trim().lowercase() }.filter { it.isNotEmpty() }
        val media = list.filter { it.startsWith("image/") || it.startsWith("video/") }
        // Cloud folders rarely label .json or .ics files with their type: anything else opens the whole picker
        return if (list.isNotEmpty() && media.size == list.size) media.toTypedArray() else arrayOf("*/*")
    }

    private fun startCamera(video: Boolean): Boolean {
        val f = files.newCapture(if (video) "mp4" else "jpg")
        captureFile = f
        return try {
            if (video) takeVideo.launch(files.uri(f)) else takePicture.launch(files.uri(f))
            true
        } catch (_: ActivityNotFoundException) {
            captureFile = null
            false
        }
    }

    /** The camera app is done: its picture or video goes to the page, or nothing (cancelled) */
    private fun tookCapture(ok: Boolean) {
        val f = captureFile
        captureFile = null
        when {
            f == null -> answerFiles(null)
            ok && f.length() > 0 -> answerFiles(arrayOf(files.uri(f)))
            else -> {
                if (ok) toast("The camera app didn't hand back the picture or video. Try again.")
                f.delete()
                answerFiles(null)
            }
        }
    }

    private fun answerFiles(uris: Array<Uri>?) {
        val cb = fileCallback ?: return
        fileCallback = null
        cb.onReceiveValue(uris)
    }

    // ---- Back: closes a print window or full-screen video, else is Escape for the page; never leaves the app ----
    private fun onBack() {
        fullscreen?.let { it.second.onCustomViewHidden(); return }
        children.lastOrNull()?.let { closeChild(it); return }
        web?.let {
            it.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ESCAPE))
            it.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ESCAPE))
        }
    }

    override fun onResume() {
        super.onResume()
        if (web != null) folder?.refresh()   // pictures and videos copied into the folder meanwhile
    }

    override fun onPause() {
        rememberDevice(web?.url)
        super.onPause()
    }

    override fun onDestroy() {
        unregisterReceiver(shareChosen)
        closeAllChildren()
        web?.destroy()
        web = null
        super.onDestroy()
    }

    private fun toast(text: String) = Toast.makeText(this, text, Toast.LENGTH_LONG).show()
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
}
