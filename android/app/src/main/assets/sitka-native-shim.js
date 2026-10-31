// SitkaTools for Android — the script that runs before the page (document start), on the app's own address only.
// It is the page's side of the app: window.sitkaNative (the page's sign that it runs in the app), a boot report so
// the app knows the page started, print windows' own 🖨️ buttons reaching the app's printing, saving through Android's
// share sheet (navigator.share, which WebView lacks), and no 📁 folder mode until the app has its own. Messages go over
// SitkaNativeBridge, which only the app's own address can use; each is JSON { v: 1, id, op, ... } and the app answers
// { id, ok, result | error: { name, message } } (android/BRIDGE.md). The page itself still makes no request to any other
// site; this script only talks to the app.
(() => {
    'use strict';
    if (window !== window.top || window.sitkaNative) return;
    const cfg = window.__sitkaNativeConfig || {};
    const port = window.SitkaNativeBridge;
    if (!port) return;

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
        try { port.postMessage(JSON.stringify({ v: 1, id, op, ...args })); }
        catch (err) { waiting.delete(id); reject(err); }
    });

    Object.defineProperty(window, 'sitkaNative', {
        value: Object.freeze({
            api: 1,
            platform: 'android',
            appVersion: String(cfg.appVersion || ''),
            role: cfg.role || null,
            resumed: cfg.resumed === true,   // the app brought the page back after Android stopped it (P2)
            call
        }),
        writable: false, configurable: false
    });

    // ---- Print windows: their own 🖨️ button prints through the app (Android's print service) ----
    // The page writes each print window into a blank pop-up and its button calls that window's print(). The pop-up is
    // a child view the app made; its print() is pointed at the app here, right after it opens.
    const realOpen = window.open;
    window.open = function (...args) {
        const w = realOpen.apply(window, args);
        if (w) {
            try { Object.defineProperty(w, 'print', { configurable: true, writable: true, value: () => { call('print').catch(() => {}); } }); }
            catch (_) { /* the app's own Print button still works */ }
        }
        return w;
    };

    // ---- Saving: navigator.share through Android's share sheet ----
    // Every save on a tablet goes through navigator.share({ files: [file] }) (shareFile, a recipe's export, a step's
    // 📤 Save), as in Chrome, where OneDrive's Upload in the share sheet puts the file in the SharePoint folder. WebView
    // has no share sheet, so the app shows Android's: the file goes over in pieces (shareBegin, shareChunk), then
    // share opens the sheet. It resolves once an app is picked, and rejects with AbortError when the sheet is
    // dismissed, so the page counts the save only then. One file at a time; nothing else is offered.
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

    // ---- 📁 Folder mode: not offered until the app opens the SharePoint folder itself (phase B) ----
    // Android's WebView has showDirectoryPicker, but it can't pick a folder. Without it the page shows no folder
    // buttons, as in a browser without folder mode, and saves through the share sheet.
    try { Object.defineProperty(window, 'showDirectoryPicker', { value: undefined, configurable: true, writable: true }); }
    catch (_) { /* the app's file chooser still says folders can't be picked */ }

    // ---- Boot report: the app falls back to its last good page if this never says ok (Phase E) ----
    const errors = [];
    window.addEventListener('error', (e) => { if (errors.length < 5) errors.push(String(e.message || e.error || 'error')); });
    window.addEventListener('load', () => {
        call('boot', { ok: typeof window.checkWorkCopyOnStart === 'function', errors }).catch(() => {});
    });
})();
