package com.sitkalegends.sitkatools

import android.content.res.AssetManager
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream

/**
 * Serves the app's own address (https://appassets.androidplatform.net, a name reserved for apps, never the network):
 * the page itself, and later pics/ from SharePoint (Phase C). Everything else on it is a 404, and every other site is
 * refused: the page makes no requests of its own to other sites, and the app keeps it that way.
 */
class PageRouter(private val assets: AssetManager) {

    companion object {
        const val HOST = "appassets.androidplatform.net"
        const val ORIGIN = "https://$HOST"
        const val PAGE_PATH = "/SitkaTools/SitkaTools.html"
        const val PAGE_URL = "$ORIGIN$PAGE_PATH"
        private const val BUNDLED_PAGE = "SitkaTools/SitkaTools.html"   // copied from the repo at build time
    }

    fun serve(request: WebResourceRequest): WebResourceResponse {
        val url: Uri = request.url
        if (url.scheme != "https" || url.host != HOST) return refused()
        return when (url.path) {
            PAGE_PATH -> page()
            else -> notFound()
        }
    }

    private fun page(): WebResourceResponse {
        val headers = mapOf(
            "Cache-Control" to "no-store",
            "X-Content-Type-Options" to "nosniff",
            "Referrer-Policy" to "no-referrer"
        )
        return WebResourceResponse("text/html", "utf-8", 200, "OK", headers, assets.open(BUNDLED_PAGE))
    }

    private fun notFound() = empty(404, "Not Found")

    /** Another site: never fetched (the page has no business there) */
    fun refused() = empty(403, "Forbidden")

    private fun empty(code: Int, reason: String) =
        WebResourceResponse("text/plain", "utf-8", code, reason, mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(ByteArray(0)))
}
