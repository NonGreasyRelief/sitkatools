// The Android app (android/), its page side, run here in Firefox (user request 2026-10-29). The app's before-page script
// (android/app/src/main/assets/sitka-native-shim.js) is injected before the page loads, with a fake app at the other end
// of its message channel, as the app's WebView runs it: saving through the app's share sheet (navigator.share, the
// file sent over in pieces), and no folder mode. And the page's small hooks for the app: P2 (a page the app
// brought back restores its session by itself), P4 (an Android in-app browser that can't save says so instead of
// counting the save as done), P6 (sitkaPageState, which the app asks before it reloads the page).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';

export const title = 'the Android app\'s page side: its before-page script, and the page\'s hooks for it';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHIM = fs.readFileSync(path.join(HERE, '../android/app/src/main/assets/sitka-native-shim.js'), 'utf8');

// Before the page: a fake app answering every request (what it got kept in window.__appGot, the files it was sent in
// window.__appFiles), then the app's script. Its share sheet picks an app, or is dismissed (window.__appShare).
const withApp = cfg => `() => {
    window.__appGot = [];
    window.__appFiles = {};
    window.__appShare = 'pick';
    window.SitkaNativeBridge = {
        onmessage: null,
        postMessage(text) {
            const m = JSON.parse(text);
            window.__appGot.push(m);
            let answer = { id: m.id, ok: true, result: null };
            if (m.op === 'shareBegin') {
                const token = 'share-' + m.id;
                window.__appFiles[token] = { name: m.name, type: m.type, size: m.size, pieces: [] };
                answer.result = { token };
            } else if (m.op === 'shareChunk') window.__appFiles[m.token].pieces.push(m.data);
            else if (m.op === 'share' && window.__appShare === 'dismiss') answer = { id: m.id, ok: false, error: { name: 'AbortError', message: 'The share was cancelled.' } };
            setTimeout(() => this.onmessage && this.onmessage({ data: JSON.stringify(answer) }), 0);
        }
    };
    window.__sitkaNativeConfig = ${JSON.stringify(cfg)};
    ${SHIM}
}`;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    const preloads = [];
    const preload = async fn => { const r = await b.send('script.addPreloadScript', { functionDeclaration: fn, contexts: [main] }); preloads.push(r.script); };
    const unload = async () => { while (preloads.length) await b.send('script.removePreloadScript', { script: preloads.pop() }).catch(() => {}); };
    try {
        // ---- The app's script before the page ----
        await preload(withApp({ api: 1, resumed: false, role: 'B1', appVersion: '0.1.0' }));
        await openSitka(b, main, BASE, 'B1');
        await b.waitFor(main, `return (window.__appGot || []).some(m => m.op === 'boot');`, 8000).catch(() => {});
        const got = await b.run(main, `return { native: window.sitkaNative && { api: sitkaNative.api, platform: sitkaNative.platform, role: sitkaNative.role,
            resumed: sitkaNative.resumed, frozen: Object.isFrozen(sitkaNative) }, boot: (window.__appGot || []).find(m => m.op === 'boot') || null };`);
        check('the page has window.sitkaNative: api 1, android, its building, not resumed', got.native?.api === 1 && got.native.platform === 'android' &&
            got.native.role === 'B1' && got.native.resumed === false && got.native.frozen, JSON.stringify(got.native));
        check('…and reports to the app once it has started (boot ok, no page errors)', got.boot?.v === 1 && got.boot.ok === true && got.boot.errors?.length === 0, JSON.stringify(got.boot));
        const printed = await b.run(main, `window.__appGot.length = 0; const w = window.open('', '_blank');
            if (!w) return 'blocked'; w.document.write('<p>Print me</p>'); w.print(); await new Promise(r => setTimeout(r, 50)); w.close();
            return window.__appGot.map(m => m.op).join();`, { user: true });
        check('a print window\'s own print() asks the app to print it', printed === 'print', printed);
        const sh = await b.run(main, `const f = n => new File(['{}'], n, { type: 'application/json' });
            return { one: navigator.canShare({ files: [f('a.json')] }), none: navigator.canShare({ title: 'x' }), two: navigator.canShare({ files: [f('a.json'), f('b.json')] }),
                picker: typeof window.showDirectoryPicker, folder: DbFolder.supported };`);
        check('the app shares one file at a time (canShare), and offers no folder mode (it can\'t pick a folder yet)',
            sh.one === true && sh.none === false && sh.two === false && sh.picker === 'undefined' && sh.folder === false, JSON.stringify(sh));

        // ---- P6: what the app asks before it reloads the page ----
        let st = await b.run(main, `return sitkaPageState();`);
        check('sitkaPageState(): nothing unsaved, no tool open', st.unsaved === false && st.tool === null, JSON.stringify(st));
        await loadSingle(b, main, fixtureDb());
        await b.run(main, `DB.data.lots.L100.name = 'Changed in the app'; markUnsaved();`);
        await openTool(b, main, 'DailyWizard');
        st = await b.run(main, `return sitkaPageState();`);
        check('…unsaved work and the tool open (DailyWizard): the app won\'t reload it', st.unsaved === true && st.tool === 'DailyWizard', JSON.stringify(st));
        await b.waitFor(main, `const c = await WorkCopy.read(); return !!c?.unsaved && c.db?.lots?.L100?.name === 'Changed in the app';`, 6000).catch(() => {});

        // ---- P2: brought back by the app after Android stopped it: the session comes back by itself ----
        await b.run(main, `WorkCopy.wrote = false; window.onbeforeunload = null;`);   // as if the page was killed (no unload)
        await unload();
        await preload(withApp({ api: 1, resumed: true, role: 'B1', appVersion: '0.1.0' }));
        await b.navigate(main, `${BASE}/SitkaTools/SitkaTools.html?device=B1`);
        const back = await b.waitFor(main, `return typeof WorkCopy !== 'undefined' && WorkCopy.ready && DB.data?.lots?.L100?.name === 'Changed in the app';`, 8000)
            .then(() => true, () => false);
        const card = await b.run(main, `return !document.getElementById('restoreOverlay').classList.contains('hidden');`);
        check('resumed by the app: the session comes back with no question asked, unsaved, the tool open again', back && !card &&
            await b.run(main, `return hasUnsavedChanges && Tools.current === 'DailyWizard';`), JSON.stringify({ back, card }));
        await b.run(main, `Tools.close(); clearUnsaved();`);
        await unload();

        // ---- Saving on a tablet in the app: 💾 Save DB → Tap to save → the app's share sheet ----
        await preload(withApp({ api: 1, resumed: false, role: null, appVersion: '0.1.0' }));
        await preload(`() => {   // a touch screen, as a tablet's (the save link opens the share sheet)
            const real = window.matchMedia.bind(window);
            window.matchMedia = q => /pointer:\\s*coarse/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : real(q);
        }`);
        await openSitka(b, main, BASE);
        const big = fixtureDb();
        big.lots.L100._tool_Test = { notes: 'Grow note é ✂️ 🌿 '.repeat(20000) };   // ~400 KB: several pieces, and not only ASCII
        await loadSingle(b, main, big);
        const saveOnce = (mode) => b.run(main, `
            window.__appShare = ${JSON.stringify(mode)}; window.__appFiles = {}; window.__appGot.length = 0;
            DB.data.lots.L100.name = 'Saved from the app ' + Date.now(); markUnsaved();
            document.getElementById('exportBtn').click();
            const link = document.getElementById('saveLink');
            const label = link.textContent;
            link.click();
            for (let i = 0; i < 100 && (hasUnsavedChanges === (${JSON.stringify(mode)} === 'pick')); i++) await new Promise(r => setTimeout(r, 50));
            await new Promise(r => setTimeout(r, 200));
            const [token, f] = Object.entries(window.__appFiles)[0] || [];
            const bytes = f ? Uint8Array.from(f.pieces.map(p => atob(p)).join(''), c => c.charCodeAt(0)) : new Uint8Array();
            let saved = null;
            try { saved = JSON.parse(new TextDecoder().decode(bytes)); } catch (_) {}
            const ops = window.__appGot.map(m => m.op);
            return { label, unsaved: hasUnsavedChanges, name: f?.name, type: f?.type, size: f?.size, got: bytes.length, pieces: f?.pieces.length,
                notesKept: saved?.lots?.L100?._tool_Test?.notes === DB.data.lots.L100._tool_Test.notes, nameKept: saved?.lots?.L100?.name === DB.data.lots.L100.name,
                stamp: !!saved?._meta?.saveId, shareLast: ops[ops.length - 1] === 'share' && window.__appGot[ops.length - 1].token === token,
                toast: [...document.querySelectorAll('.sync-toast')].map(e => e.textContent).join(' ') };`, { user: true });
        const picked = await saveOnce('pick');
        check('Save DB on a tablet in the app: "Tap to save" sends the whole file to the app in pieces, named and typed as the page saves it',
            /Tap to save/.test(picked.label) && /^DB-\d\d-\d\d-\d\d\.json$/.test(picked.name || '') && picked.type === 'application/json' &&
            picked.got === picked.size && picked.pieces >= 2 && picked.notesKept && picked.nameKept && picked.stamp && picked.shareLast, JSON.stringify({ ...picked, toast: undefined }));
        check('…an app picked in the share sheet (OneDrive): saved', picked.unsaved === false, JSON.stringify({ unsaved: picked.unsaved }));
        const dismissed = await saveOnce('dismiss');
        check('…the share sheet dismissed: still unsaved, and it says the file wasn\'t saved', dismissed.unsaved === true &&
            /was not saved — the share was cancelled/.test(dismissed.toast), JSON.stringify({ unsaved: dismissed.unsaved, toast: dismissed.toast.slice(-160) }));
        const err = await b.run(main, `window.__appShare = 'dismiss';
            return navigator.share({ files: [new File(['{}'], 'a.json')] }).then(() => 'resolved', e => (e instanceof DOMException) + ' ' + e.name);`);
        check('…which navigator.share rejects with an AbortError, as a browser\'s does', err === 'true AbortError', err);
        await b.run(main, `clearUnsaved();`);
        await unload();

        // ---- P4: an Android in-app browser (Teams, Outlook…) with no share sheet can't save: it says so ----
        await preload(`() => {
            Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (Linux; Android 16; Pixel Tablet; wv) AppleWebKit/537.36 Chrome/133.0 Mobile Safari/537.36' });
            Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
            window.__alerts = []; window.alert = m => window.__alerts.push(m);
        }`);
        await openSitka(b, main, BASE);
        const r = await b.run(main, `const ok = await shareFile(new Blob(['{}'], { type: 'application/json' }), 'Building-B1.json'); return { ok, alerts: window.__alerts };`);
        check('in an Android in-app browser: not counted as saved, and it says why', r.ok === false &&
            /^Building-B1\.json was not saved: this app's built-in browser can't save files\. Open SitkaTools in Chrome/.test(r.alerts[0] || ''), JSON.stringify(r));
    } finally {
        await unload();
        await leave(b, main);
    }
    return results;
}
