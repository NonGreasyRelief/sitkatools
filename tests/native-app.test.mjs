// The Android app (native/), its page side, run here in Firefox. The page has no code of its own for the app: the app's
// before-page script (native/app/src/main/assets/sitka-app.js) fills in what Android's WebView lacks. It's injected
// before the page loads, with a fake app at the other end of its message channel, as the app's WebView runs it:
// saving through the app's share sheet (navigator.share, the file sent over in pieces; a download link the page didn't
// handle goes the same way), print windows printing through the app, no folder mode, and a page the app reopened after
// Android stopped it restoring its session by itself (document.wasDiscarded, which the page already reads).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';

export const title = 'the Android app\'s page side: its before-page script';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHIM = fs.readFileSync(path.join(HERE, '../native/app/src/main/assets/sitka-app.js'), 'utf8');

// Before the page: a fake app answering every request (what it got kept in window.__appGot, the files it was sent in
// window.__appFiles), then the app's script. Its share sheet picks an app, or is dismissed (window.__appShare).
const withApp = cfg => `() => {
    window.__appGot = [];
    window.__appFiles = {};
    window.__appShare = 'pick';
    window.SitkaApp = {
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
    window.__sitkaApp = ${JSON.stringify(cfg)};
    ${SHIM}
}`;

// A touch screen, as a tablet's (the save link opens the share sheet)
const touch = `() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = q => /pointer:\\s*coarse/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : real(q);
}`;

// What the fake app was sent: the bytes of its one file, decoded
const sentFile = `const [token, f] = Object.entries(window.__appFiles)[0] || [];
    const bytes = f ? Uint8Array.from(f.pieces.map(p => atob(p)).join(''), c => c.charCodeAt(0)) : new Uint8Array();
    const ops = window.__appGot.map(m => m.op);`;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    const preloads = [];
    const preload = async fn => { const r = await b.send('script.addPreloadScript', { functionDeclaration: fn, contexts: [main] }); preloads.push(r.script); };
    const unload = async () => { while (preloads.length) await b.send('script.removePreloadScript', { script: preloads.pop() }).catch(() => {}); };
    try {
        // ---- The app's script before the page ----
        await preload(withApp({ resumed: false, appVersion: '0.2.0' }));
        await openSitka(b, main, BASE, 'B1');
        const sh = await b.run(main, `const f = n => new File(['{}'], n, { type: 'application/json' });
            return { one: navigator.canShare({ files: [f('a.json')] }), none: navigator.canShare({ title: 'x' }), two: navigator.canShare({ files: [f('a.json'), f('b.json')] }),
                picker: typeof window.showDirectoryPicker, folder: DbFolder.supported, discarded: document.wasDiscarded === true, errors: window.__pageErrors?.length || 0 };`);
        check('the app shares one file at a time (canShare), and there\'s no folder mode (the WebView can\'t pick a folder)',
            sh.one === true && sh.none === false && sh.two === false && sh.picker === 'undefined' && sh.folder === false, JSON.stringify(sh));
        check('…a page the app opened as usual isn\'t marked reopened', sh.discarded === false, JSON.stringify(sh));
        const printed = await b.run(main, `window.__appGot.length = 0; const w = window.open('', '_blank');
            if (!w) return 'blocked'; w.document.write('<p>Print me</p>'); w.print(); await new Promise(r => setTimeout(r, 50)); w.close();
            return window.__appGot.map(m => m.op).join();`, { user: true });
        check('a print window\'s own print() asks the app to print it', printed === 'print', printed);

        // ---- Reopened by the app after Android stopped it: the session comes back by itself ----
        await loadSingle(b, main, fixtureDb());
        await b.run(main, `DB.data.lots.L100.name = 'Changed in the app'; markUnsaved();`);
        await openTool(b, main, 'DailyWizard');
        await b.waitFor(main, `const c = await WorkCopy.read(); return !!c?.unsaved && c.db?.lots?.L100?.name === 'Changed in the app' && c.tool === 'DailyWizard';`, 6000).catch(() => {});
        await b.run(main, `WorkCopy.wrote = false; window.onbeforeunload = null;`);   // as if the page was killed (no unload)
        await b.navigate(main, `${BASE}/SitkaTools/SitkaTools.html?device=B1`);
        const asked = await b.waitFor(main, `return !document.getElementById('restoreOverlay').classList.contains('hidden');`, 8000).then(() => true, () => false);
        check('opened again as usual (the app started anew): the page asks whether to restore the session', asked);
        await unload();
        await preload(withApp({ resumed: true, appVersion: '0.2.0' }));
        await b.run(main, `window.onbeforeunload = null;`);
        await b.navigate(main, `${BASE}/SitkaTools/SitkaTools.html?device=B1`);
        const back = await b.waitFor(main, `return typeof WorkCopy !== 'undefined' && WorkCopy.ready && DB.data?.lots?.L100?.name === 'Changed in the app';`, 8000)
            .then(() => true, () => false);
        const card = await b.run(main, `return !document.getElementById('restoreOverlay').classList.contains('hidden');`);
        check('reopened by the app (document.wasDiscarded): the session comes back with no question, unsaved, the tool open again', back && !card &&
            await b.run(main, `return document.wasDiscarded === true && hasUnsavedChanges && Tools.current === 'DailyWizard';`), JSON.stringify({ back, card }));
        await b.run(main, `Tools.close(); clearUnsaved();`);
        await unload();

        // ---- Saving on a tablet in the app: 💾 Save DB → Tap to save → the app's share sheet ----
        await preload(withApp({ resumed: false, appVersion: '0.2.0' }));
        await preload(touch);
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
            await new Promise(r => setTimeout(r, 300));
            ${sentFile}
            let saved = null;
            try { saved = JSON.parse(new TextDecoder().decode(bytes)); } catch (_) {}
            return { label, unsaved: hasUnsavedChanges, name: f?.name, type: f?.type, size: f?.size, got: bytes.length, pieces: f?.pieces.length,
                notesKept: saved?.lots?.L100?._tool_Test?.notes === DB.data.lots.L100._tool_Test.notes, nameKept: saved?.lots?.L100?.name === DB.data.lots.L100.name,
                stamp: !!saved?._meta?.saveId, shares: ops.filter(o => o === 'shareBegin').length, shareLast: ops[ops.length - 1] === 'share' && window.__appGot[ops.length - 1].token === token,
                toast: [...document.querySelectorAll('.sync-toast')].map(e => e.textContent).join(' ') };`, { user: true });
        const picked = await saveOnce('pick');
        check('Save DB on a tablet in the app: "Tap to save" sends the whole file to the app in pieces, named and typed as the page saves it, once',
            /Tap to save/.test(picked.label) && /^DB-\d\d-\d\d-\d\d\.json$/.test(picked.name || '') && picked.type === 'application/json' &&
            picked.got === picked.size && picked.pieces >= 2 && picked.notesKept && picked.nameKept && picked.stamp && picked.shares === 1 && picked.shareLast,
            JSON.stringify({ ...picked, toast: undefined }));
        check('…an app picked in the share sheet (OneDrive): saved', picked.unsaved === false, JSON.stringify({ unsaved: picked.unsaved }));
        const dismissed = await saveOnce('dismiss');
        check('…the share sheet dismissed: still unsaved, and it says the file wasn\'t saved', dismissed.unsaved === true &&
            /was not saved — the share was cancelled/.test(dismissed.toast), JSON.stringify({ unsaved: dismissed.unsaved, toast: dismissed.toast.slice(-160) }));
        const err = await b.run(main, `window.__appShare = 'dismiss';
            return navigator.share({ files: [new File(['{}'], 'a.json')] }).then(() => 'resolved', e => (e instanceof DOMException) + ' ' + e.name);`);
        check('…which navigator.share rejects with an AbortError, as a browser\'s does', err === 'true AbortError', err);

        // ---- A download link the page leaves to the browser: the share sheet too ----
        const dl = await b.run(main, `window.__appShare = 'pick'; window.__appFiles = {}; window.__appGot.length = 0;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob(['BEGIN:VCALENDAR'], { type: 'text/calendar' }));
            a.download = 'SitkaCalendar-261029.ics';
            document.body.appendChild(a); a.click(); a.remove();
            for (let i = 0; i < 40 && !window.__appGot.some(m => m.op === 'share'); i++) await new Promise(r => setTimeout(r, 50));
            ${sentFile}
            return { name: f?.name, type: f?.type, text: new TextDecoder().decode(bytes), ops: ops.join() };`, { user: true });
        check('a download link the page didn\'t handle (an .ics file) goes to the app\'s share sheet, whole', dl.name === 'SitkaCalendar-261029.ics' &&
            dl.type === 'text/calendar' && dl.text === 'BEGIN:VCALENDAR' && dl.ops === 'shareBegin,shareChunk,share', JSON.stringify(dl));
        await b.run(main, `clearUnsaved();`);
    } finally {
        await unload();
        await leave(b, main);
    }
    return results;
}
