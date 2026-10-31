package com.sitkalegends.sitkatools

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
import android.text.InputType
import android.util.Log
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
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
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.io.File

/**
 * SitkaTools for Android: one screen holding one WebView, which runs the same SitkaTools.html as the office PCs from the
 * app's own address (PageRouter). The building this tablet is (the page's ?device= role) is kept by the app, never by
 * the page. The native side gives the page what Android's WebView lacks: dialogs, print windows, file picking, the
 * camera, the share sheet (saving), full screen video, and recovery when Android stops the page.
 */
class MainActivity : ComponentActivity() {

    companion object {
        private const val TAG = "SitkaTools"
        const val MIN_WEBVIEW = 118   // the page's styles use CSS @scope
        private const val PREFS = "sitka"
        private const val KEY_ROLE = "role"
        private const val ACTION_SHARE_CHOSEN = "com.sitkalegends.sitkatools.SHARE_CHOSEN"
    }

    private lateinit var content: FrameLayout      // the WebView, and print windows over it
    private lateinit var strip: TextView           // the line under the page: building, app version
    private lateinit var router: PageRouter
    private var web: WebView? = null
    private val children = ArrayDeque<ChildWindow>()
    private var fullscreen: Pair<View, WebChromeClient.CustomViewCallback>? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val prefs by lazy { getSharedPreferences(PREFS, MODE_PRIVATE) }
    private val pin by lazy { OfficePin(prefs) }
    private val files by lazy { SharedFiles(this) }
    private fun role(): String? = prefs.getString(KEY_ROLE, null)?.takeIf { it.isNotBlank() }

    // ---- Picking files for the page's file boxes (📂 Load DB, imports, picture files) ----
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
        override fun onReceive(context: Context, intent: Intent) {
            Log.i(TAG, "shared to ${intent.getParcelableExtraCompat(Intent.EXTRA_CHOSEN_COMPONENT)}")
            endShare(chosen = true)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        router = PageRouter(assets)
        files.tidy()
        ContextCompat.registerReceiver(this, shareChosen, IntentFilter(ACTION_SHARE_CHOSEN), ContextCompat.RECEIVER_NOT_EXPORTED)
        buildLayout()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = onBack()
        })
        webViewProblem()?.let { showProblem(it); return }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        // Recreated after Android stopped the app: the page brings its session back by itself
        val resumed = savedInstanceState != null
        // First run: which building this is, then the office PIN that guards changing it
        val start = { if (pin.isSet) startPage(resumed) else setPin { startPage(resumed) } }
        if (role() == null) askRole(start) else start()
    }

    // ---- Layout: the page fills the screen, a thin strip under it ----
    private fun buildLayout() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#1A1A2E"))
        }
        content = FrameLayout(this)
        root.addView(content, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        strip = TextView(this).apply {
            setTextColor(Color.parseColor("#A8A8B8"))
            setBackgroundColor(Color.parseColor("#16213E"))
            textSize = 12f
            setPadding(dp(12), dp(4), dp(12), dp(4))
            setOnLongClickListener { changeRole(); true }
        }
        root.addView(strip, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        setContentView(root)
        // Android draws edge to edge: keep the page clear of the system bars and the keyboard
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val b = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            v.setPadding(b.left, b.top, b.right, b.bottom)
            WindowInsetsCompat.CONSUMED
        }
        updateStrip()
    }

    private fun updateStrip() {
        val who = role()?.let { if (it == "office") "Office" else "Building $it" } ?: "No building set"
        strip.text = "SitkaTools ${BuildConfig.VERSION_NAME} · $who · hold here to change"
    }

    // ---- The WebView must be new enough for the page, and able to run the app's script before it ----
    private fun webViewProblem(): String? {
        val pkg = WebViewCompat.getCurrentWebViewPackage(this)
            ?: return "Android System WebView isn't available on this tablet."
        val major = pkg.versionName?.substringBefore('.')?.toIntOrNull() ?: 0
        if (major < MIN_WEBVIEW) {
            return "SitkaTools needs Android System WebView $MIN_WEBVIEW or newer; this tablet has ${pkg.versionName}. " +
                "Update \"Android System WebView\" in the Play Store, then open SitkaTools again."
        }
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            return "This tablet's Android System WebView is missing features SitkaTools needs. Update it in the Play Store."
        }
        return null
    }

    private fun showProblem(text: String) {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(32), dp(32), dp(32), dp(32))
        }
        box.addView(TextView(this).apply { this.text = text; textSize = 18f; setTextColor(Color.WHITE) })
        box.addView(Button(this).apply {
            this.text = "Open the Play Store"
            setOnClickListener { openExternally(Uri.parse("market://details?id=com.google.android.webview")) }
        })
        content.addView(box)
    }

    // ---- Which building this tablet is (asked once; kept by the app, sent to the page as ?device=) ----
    private fun askRole(then: () -> Unit) {
        val input = EditText(this).apply {
            hint = "e.g. B6, or office"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            setText(role() ?: "")
        }
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle("Which building is this tablet?")
            .setMessage("Type the building's id as it is in SitkaTools (for example B6), or \"office\".")
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("OK") { _, _ ->
                val value = input.text.toString().trim()
                prefs.edit().putString(KEY_ROLE, value.ifBlank { null }).apply()
                updateStrip()
                then()
            }
            .show()
    }

    /** Holding the strip: the office PIN, then the building. It reloads the page, so not with unsaved work or a tool open. */
    private fun changeRole() {
        val w = web ?: return askPin { askRole { startPage(false) } }
        w.evaluateJavascript("typeof sitkaPageState === 'function' ? JSON.stringify(sitkaPageState()) : 'null'") { r ->
            // evaluateJavascript hands back the script's value as JSON: here a string holding sitkaPageState()'s JSON
            val text = runCatching { org.json.JSONTokener(r).nextValue() as? String }.getOrNull()
            val state = text?.let { runCatching { JSONObject(it) }.getOrNull() }
            when {
                state?.optBoolean("unsaved") == true -> toast("Save first (💾 Save DB): changing the building reloads SitkaTools.")
                state != null && !state.isNull("tool") -> toast("Close the tool first: changing the building reloads SitkaTools.")
                else -> askPin { askRole { startPage(false) } }
            }
        }
    }

    // ---- The office PIN (OfficePin): set once at first run, asked before any setting changes ----
    private fun pinField(hint: String) = EditText(this).apply {
        this.hint = hint
        inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
    }

    private fun setPin(then: () -> Unit) {
        val first = pinField("New office PIN (4–8 digits)")
        val again = pinField("The same PIN again")
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(8), dp(20), 0)
            addView(first)
            addView(again)
        }
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle("Set the office PIN")
            .setMessage("The office PIN is asked before anyone changes this tablet's settings (its building). Keep it from the floor staff.")
            .setView(box)
            .setCancelable(false)
            .setPositiveButton("OK") { _, _ ->
                val a = first.text.toString(); val b = again.text.toString()
                when {
                    !OfficePin.FORMAT.matches(a) -> { toast("The PIN must be 4 to 8 digits."); setPin(then) }
                    a != b -> { toast("The two PINs don't match."); setPin(then) }
                    else -> { pin.set(a); toast("Office PIN set."); then() }
                }
            }
            .show()
    }

    private fun askPin(then: () -> Unit) {
        if (!pin.isSet) return setPin(then)
        val field = pinField("Office PIN")
        val box = FrameLayout(this).apply { setPadding(dp(20), dp(8), dp(20), 0); addView(field) }
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle("🔒 Office PIN")
            .setMessage("Changing this tablet's settings needs the office PIN.")
            .setView(box)
            .setPositiveButton("OK") { _, _ ->
                val why = pin.check(field.text.toString())
                if (why == null) then() else toast(why)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // ---- The page ----
    private fun pageUrl(): String {
        val r = role()
        return if (r == null) PageRouter.PAGE_URL else "${PageRouter.PAGE_URL}?device=${Uri.encode(r)}"
    }

    private fun startPage(resumed: Boolean) {
        closeAllChildren()
        shareAnswer = null   // a share sheet's answer would go to the page being replaced
        web?.let { content.removeView(it); it.destroy() }
        val w = WebView(this)
        configure(w)
        installBridge(w, resumed)
        content.addView(w, 0, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        web = w
        w.loadUrl(pageUrl())
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configure(w: WebView, child: Boolean = false) {
        w.setBackgroundColor(Color.parseColor("#1A1A2E"))
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
        w.webViewClient = if (child) ChildClient() else MainClient()
        w.webChromeClient = Chrome()
    }

    // ---- The app's script before the page, and the message channel only the app's own address can use ----
    private fun installBridge(w: WebView, resumed: Boolean) {
        val cfg = JSONObject()
            .put("api", 1)
            .put("resumed", resumed)
            .put("role", role() ?: JSONObject.NULL)
            .put("appVersion", BuildConfig.VERSION_NAME)
        val shim = assets.open("sitka-native-shim.js").bufferedReader().use { it.readText() }
        WebViewCompat.addDocumentStartJavaScript(w, "window.__sitkaNativeConfig = $cfg;\n$shim", setOf(PageRouter.ORIGIN))
        WebViewCompat.addWebMessageListener(w, "SitkaNativeBridge", setOf(PageRouter.ORIGIN)) { _, message, sourceOrigin, isMainFrame, proxy ->
            if (!isMainFrame || sourceOrigin.toString().trimEnd('/') != PageRouter.ORIGIN) return@addWebMessageListener
            val req = runCatching { JSONObject(message.data ?: "") }.getOrNull() ?: return@addWebMessageListener
            val reply = Reply(proxy, req.optInt("id"))
            try { handle(req, reply) }
            catch (e: BridgeError) { reply.fail(e.name, e.message ?: "") }
            catch (e: Exception) { Log.w(TAG, "request ${req.optString("op")} failed", e); reply.fail("UnknownError", "The app couldn't do that.") }
        }
    }

    /** One answer to one request from the page ({ id, ok, result | error }, android/BRIDGE.md) */
    private class Reply(private val proxy: JavaScriptReplyProxy, private val id: Int) {
        private var sent = false
        fun ok(result: Any? = null) = send(JSONObject().put("id", id).put("ok", true).put("result", result ?: JSONObject.NULL))
        fun fail(name: String, message: String) =
            send(JSONObject().put("id", id).put("ok", false).put("error", JSONObject().put("name", name).put("message", message)))
        private fun send(m: JSONObject) {
            if (sent) return
            sent = true
            runCatching { proxy.postMessage(m.toString()) }   // the page may be gone by now
        }
    }

    private fun handle(req: JSONObject, reply: Reply) {
        when (req.optString("op")) {
            "boot" -> {
                Log.i(TAG, "page boot ok=${req.optBoolean("ok")} errors=${req.optJSONArray("errors")}")
                reply.ok()
            }
            "print" -> {
                val top = children.lastOrNull() ?: throw BridgeError("InvalidStateError", "No print window is open.")
                print(top)
                reply.ok()
            }
            "shareBegin" -> reply.ok(JSONObject().put("token",
                files.begin(req.optString("name"), req.optString("type"), req.optLong("size", -1))))
            "shareChunk" -> { files.append(req.optString("token"), req.optString("data")); reply.ok() }
            "share" -> share(files.finish(req.optString("token")), req.optString("title"), reply)
            else -> throw BridgeError("NotSupportedError", "The app doesn't know that request.")
        }
    }

    // ---- Saving a file: Android's share sheet, as Chrome's navigator.share does on a tablet (OneDrive → Upload) ----
    private fun share(o: SharedFiles.Outgoing, title: String, reply: Reply) {
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
            if (chosen) reply.ok()
            else { discard(); reply.fail("AbortError", "The share was cancelled.") }
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

    @Suppress("DEPRECATION")
    private fun Intent.getParcelableExtraCompat(name: String): Any? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) getParcelableExtra(name, android.content.ComponentName::class.java)
        else getParcelableExtra(name)

    private inner class MainClient : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            val u = request.url
            return when (u.scheme) {
                "https", "http" -> router.serve(request)
                else -> null   // blob:, data: — the page's own
            }
        }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val u = request.url
            if (u.scheme == "https" && u.host == PageRouter.HOST) return false
            leaveForOutside(u)
            return true
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
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

    /** Talk's Google Translate (the page's only other site) opens outside the app; anything else is refused */
    private fun leaveForOutside(u: Uri) {
        if (u.scheme == "https" && u.host == "translate.google.com") openExternally(u)
        else toast("SitkaTools only opens its own pages.")
    }

    private fun openExternally(u: Uri) {
        try { startActivity(Intent(Intent.ACTION_VIEW, u)) } catch (_: ActivityNotFoundException) { toast("No app on this tablet can open that.") }
    }

    // ---- Print windows (window.open + document.write): a child view with 🖨️ Print and ✕ Close ----
    private inner class ChildClient : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            val u = request.url
            return if (u.scheme == "https" || u.scheme == "http") router.serve(request) else null
        }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val u = request.url
            if (u.scheme == "about" || u.scheme == "blob" || u.scheme == "data") return false
            if (u.scheme == "https" && u.host == PageRouter.HOST) return false
            leaveForOutside(u)
            children.firstOrNull { it.web == view }?.let { closeChild(it) }
            return true
        }

        // The page process is gone (it's shared with SitkaTools' own page, whose handler brings that back): the print
        // window goes with it. Unhandled, Android would close the whole app.
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            children.firstOrNull { it.web == view }?.let { closeChild(it) }
            return true
        }
    }

    private inner class ChildWindow(val frame: View, val web: WebView)

    private fun openChild(resultMsg: Message): Boolean {
        val child = WebView(this)
        configure(child, child = true)
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.parseColor("#16213E"))
            setPadding(dp(8), dp(4), dp(8), dp(4))
        }
        val frame = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.WHITE)
            isClickable = true
        }
        val holder = ChildWindow(frame, child)
        bar.addView(TextView(this).apply {
            text = "SitkaTools"
            setTextColor(Color.parseColor("#53D8A8"))
            textSize = 16f
        }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        bar.addView(Button(this).apply { text = "🖨️ Print"; setOnClickListener { print(holder) } })
        bar.addView(Button(this).apply { text = "✕ Close"; setOnClickListener { closeChild(holder) } })
        frame.addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        frame.addView(child, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        content.addView(frame, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        children.addLast(holder)
        val transport = resultMsg.obj as WebView.WebViewTransport
        transport.webView = child
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
        val name = (c.web.title?.takeIf { it.isNotBlank() } ?: "SitkaTools")
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
            AlertDialog.Builder(this@MainActivity, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                .setMessage(message)
                .setView(input)
                .setPositiveButton("OK") { _, _ -> if (!answered) { answered = true; result.confirm(input.text.toString()) } }
                .setNegativeButton("Cancel") { _, _ -> if (!answered) { answered = true; result.cancel() } }
                .setOnCancelListener { if (!answered) { answered = true; result.cancel() } }
                .show()
            return true
        }

        override fun onJsBeforeUnload(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
            ask("Leave SitkaTools? Changes that aren't saved may be lost.", cancel = "Stay", onOk = { result.confirm() }, onCancel = { result.cancel() })
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
                toast("Folders can't be picked here: pick the files instead.")
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
        val b = AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
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
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
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
