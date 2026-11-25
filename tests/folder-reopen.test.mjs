// 📁 The start screen's 📁 Open "<folder>" (the remembered folder) and Choose a different folder… (user bug 2026-11-25: in
// Edge the first did nothing while the second worked). A remembered folder opens through DbFolder.reopen: the start screen
// is put away before the browser is asked for the folder, and a folder the browser won't hand back says why and goes on
// to the folder picker instead of failing silently. The folder is a real one in the browser's private storage, picked
// through a stand-in showDirectoryPicker, its permission a stand-in too (window.__folderPermission: 'granted', 'prompt'
// until asked, or 'throw' once when asked).
import { fixtureDb, makeChecker, fresh, openSitka, leave } from './lib/helpers.mjs';

export const title = 'folder mode: the start screen\'s 📁 Open "<folder>" opens the remembered folder, or says why not';

const STANDIN = `() => {
    window.__folderPermission = 'granted';
    window.__asked = 0;
    if (window.FileSystemHandle) {
        FileSystemHandle.prototype.queryPermission = async function () { return window.__folderPermission === 'granted' ? 'granted' : 'prompt'; };
        FileSystemHandle.prototype.requestPermission = async function () {
            window.__asked++;
            window.__startScreenUpWhenAsked = !document.getElementById('dbOverlay').classList.contains('hidden');
            const p = window.__folderPermission;
            window.__folderPermission = 'granted';
            if (p === 'throw') throw new DOMException('User activation is required to request permissions.', 'SecurityError');
            return 'granted';
        };
    }
    window.showDirectoryPicker = async (opts) => { window.__picked = (window.__picked || 0) + 1; window.__pickedStartIn = opts?.startIn?.name || null;
        return (await navigator.storage.getDirectory()).getDirectoryHandle('Reopen', { create: true }); };
}`;
const state = `return { active: DbFolder.active, folder: DbFolder.handle?.name, file: DB.fileName, asked: window.__asked, picked: window.__picked || 0, startIn: window.__pickedStartIn,
    upWhenAsked: window.__startScreenUpWhenAsked, startScreen: !document.getElementById('dbOverlay').classList.contains('hidden'),
    toast: document.getElementById('syncToastText').textContent };`;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    const { script } = await b.send('script.addPreloadScript', { functionDeclaration: STANDIN, contexts: [main] });
    const startScreen = () => b.waitFor(main, `const btn = document.getElementById('overlayOpenRecentBtn');
        return btn && !document.getElementById('dbOverlay').classList.contains('hidden') ? btn.textContent : null;`);
    const opened = () => b.waitFor(main, `return DbFolder.active && DB.fileName ? true : null;`);
    try {
        // A folder with one DB file, opened once with the picker so it's remembered
        await openSitka(b, main, BASE);
        await b.run(main, `const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('Reopen', { create: true });
            for await (const e of d.values()) await d.removeEntry(e.name, { recursive: true });
            const w = await (await d.getFileHandle('DB-26-10-13.json', { create: true })).createWritable();
            await w.write(${JSON.stringify(JSON.stringify(fixtureDb()))}); await w.close();
            await DbFolder.choose();`);
        check('the folder opens with the picker and is remembered', (await b.run(main, state)).active);

        // A new visit: the browser asks before the page may use the folder again
        await openSitka(b, main, BASE);
        check('the start screen offers the remembered folder first', await startScreen() === '📁 Open "Reopen"');
        await b.run(main, `window.__folderPermission = 'prompt'; document.getElementById('overlayOpenRecentBtn').click();`, { user: true });
        await opened();
        let st = await b.run(main, state);
        check('📁 Open "Reopen": the browser is asked for the folder, and its newest DB opens', st.active && st.folder === 'Reopen' && st.file === 'DB-26-10-13' && st.asked === 1 && !st.startScreen, JSON.stringify(st));
        check('…with the start screen put away before the browser is asked (as the folder picker has it)', st.upWhenAsked === false, JSON.stringify(st));
        check('…and no folder picker', st.picked === 0, String(st.picked));

        // The browser won't hand the remembered folder back: it says so and goes on to the picker, started at that folder
        await openSitka(b, main, BASE);
        await startScreen();
        await b.run(main, `window.__folderPermission = 'throw'; document.getElementById('overlayOpenRecentBtn').click();`, { user: true });
        await opened();
        st = await b.run(main, state);
        check('a folder the browser won\'t hand back: the folder picker opens instead, started at that folder', st.picked === 1 && st.startIn === 'Reopen' && st.active && !st.startScreen, JSON.stringify(st));

        // …and it's never silent
        await openSitka(b, main, BASE);
        await startScreen();
        await b.run(main, `window.__folderPermission = 'throw';
            window.showDirectoryPicker = async () => { throw new DOMException('The user aborted a request.', 'AbortError'); };
            document.getElementById('overlayOpenRecentBtn').click();`, { user: true });
        st = await b.waitFor(main, `return window.__asked ? (() => { ${state} })() : null;`);
        await b.waitFor(main, `return !document.getElementById('dbOverlay').classList.contains('hidden') || null;`);
        st = await b.run(main, state);
        check('…it says why, and with the picker cancelled the start screen is back', /Couldn't reopen "Reopen" by itself \(User activation is required/.test(st.toast) && st.startScreen && !st.active, JSON.stringify(st));
    } finally {
        await b.send('script.removePreloadScript', { script }).catch(() => {});
        await leave(b, main);
    }
    return results;
}
