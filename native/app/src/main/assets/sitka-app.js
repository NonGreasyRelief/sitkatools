// SitkaTools for Android (native/README.md): the script the app runs before the page, on the app's own address only.
// The page is the same SitkaTools.html as on every other device, with no code of its own for the app. This script
// fills in what Android's WebView lacks:
//  - saving: navigator.share({ files: [file] }) opens Android's share sheet (WebView has none), so 💾 Save DB →
//    Tap to save → OneDrive → Upload works as it does in Chrome; a download link the page didn't handle goes the same way;
//  - print windows: their own 🖨️ button prints through the app;
//  - no 📁 folder mode: the WebView claims showDirectoryPicker but can't pick a folder;
//  - a page the app reopened after Android stopped it (or its page crashed, or the folder changed) reads as
//    document.wasDiscarded, so the page brings its unsaved session back by itself, as Chrome does for a tab it put away.
// Messages go over SitkaApp, which only the app's own address can use: JSON { id, op, ... } to the app, and
// { id, ok, result | error: { name, message } } back. Nothing here talks to any other site.
(() => {
    'use strict';
    if (window !== window.top || window.__sitkaAppReady) return;
    const port = window.SitkaApp;
    if (!port) return;
    Object.defineProperty(window, '__sitkaAppReady', { value: true });
    const cfg = window.__sitkaApp || {};

    // ---- Reopened by the app: the page restores its session by itself (checkWorkCopyOnStart) ----
    if (cfg.resumed === true) {
        try { Object.defineProperty(document, 'wasDiscarded', { value: true, configurable: true }); } catch (_) { /* asks instead */ }
    }

    // ---- Requests to the app, each answered once ----
    let seq = 0;
    const waiting = new Map();
    port.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch (_) { return; }
        const w = m && waiting.get(m.id);
        if (!w) return;
        waiting.delete(m.id);
        if (m.ok) w.resolve(m.result);
        else w.reject(new DOMException(m.error?.message || 'The app could not do that.', m.error?.name || 'UnknownError'));
    };
    const call = (op, args = {}) => new Promise((resolve, reject) => {
        const id = ++seq;
        waiting.set(id, { resolve, reject });
        try { port.postMessage(JSON.stringify({ id, op, ...args })); }
        catch (err) { waiting.delete(id); reject(err); }
    });

    // ---- Print windows: the page writes each into a blank pop-up whose own 🖨️ button calls its print() ----
    const realOpen = window.open;
    window.open = function (...args) {
        const w = realOpen.apply(window, args);
        if (w) {
            try { Object.defineProperty(w, 'print', { configurable: true, writable: true, value: () => { call('print').catch(() => {}); } }); }
            catch (_) { /* the app's own 🖨️ Print button still works */ }
        }
        return w;
    };

    // ---- Saving: navigator.share through Android's share sheet ----
    // The file goes over in pieces (shareBegin, shareChunk), then share opens the sheet. It resolves once an app is
    // picked and rejects with AbortError when the sheet is dismissed, so the page counts the save only then. A step's
    // picture or video (j234_1.jpg) is also kept in the tablet's SitkaTools folder: it resolves once it's there.
    const CHUNK = 192 * 1024;   // bytes per piece (256 KB of base64)
    const base64 = (bytes) => {
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(s);
    };
    const oneFile = (data) => (data && Array.isArray(data.files) && data.files.length === 1 && data.files[0] instanceof Blob) ? data.files[0] : null;
    let sharing = false;
    const share = async (data) => {
        const file = oneFile(data);
        if (!file) throw new TypeError('The SitkaTools app shares one file at a time.');
        if (sharing) throw new DOMException('A share is already in progress.', 'InvalidStateError');
        sharing = true;
        try {
            const name = file.name || String(data.title || '') || 'SitkaTools file';
            const { token } = await call('shareBegin', { name, type: file.type || 'application/octet-stream', size: file.size });
            for (let at = 0; at < file.size; at += CHUNK) {
                const bytes = new Uint8Array(await file.slice(at, at + CHUNK).arrayBuffer());
                await call('shareChunk', { token, data: base64(bytes) });
            }
            await call('share', { token, title: String(data.title || name) });
        } finally {
            sharing = false;
        }
    };
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
    Object.defineProperty(navigator, 'canShare', { value: (data) => !!oneFile(data), configurable: true, writable: true });

    // A download link the page left to the browser (<a download href="blob:…">): the WebView would drop it, so it goes
    // to the share sheet too. Links the page handles itself (it calls preventDefault) are left alone.
    document.addEventListener('click', (e) => {
        const a = e.target instanceof Element ? e.target.closest('a[download]') : null;
        if (!a || e.defaultPrevented || !/^(blob|data):/.test(a.href)) return;
        e.preventDefault();
        const name = a.getAttribute('download') || 'SitkaTools file';
        fetch(a.href).then(r => r.blob())
            .then(blob => share({ files: [new File([blob], name, { type: blob.type || 'application/octet-stream' })], title: name }))
            .catch(err => { if (err?.name !== 'AbortError') alert(`${name} could not be saved from the app.`); });
    });

    // ---- 📁 Folder mode: not in the app (the WebView can't pick a folder); saving goes through the share sheet ----
    try { Object.defineProperty(window, 'showDirectoryPicker', { value: undefined, configurable: true, writable: true }); }
    catch (_) { /* the app's file chooser says folders can't be picked */ }
})();
