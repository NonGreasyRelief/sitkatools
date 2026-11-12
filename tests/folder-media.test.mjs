// 📁 Folder mode loads DailyWizard's step pictures and videos from the database folder's "Media" subfolder, and PaperWizard's
// form documents from its "Docs" subfolder, by themselves (user request 2026-11-11: laptops in the buildings open the
// database in folder mode). The folder is a real one, in the browser's private storage, picked through a stand-in
// showDirectoryPicker set before every page. Also the two looks asked for the same day: DailyWizard's hours note box dark
// blue like the other fields, and a white calendar button on date fields.
import { fixtureDb, makeChecker, fresh, openSitka, openTool, leave } from './lib/helpers.mjs';

export const title = 'folder mode: DailyWizard\'s Media and PaperWizard\'s Docs load by themselves';

const STANDIN = `() => {
    window.__folderPermission = 'granted';
    if (window.FileSystemHandle && !FileSystemHandle.prototype.queryPermission) {
        FileSystemHandle.prototype.queryPermission = async function () { return window.__folderPermission; };
        FileSystemHandle.prototype.requestPermission = async function () { return window.__folderPermission; };
    }
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(window.__pickFolder || 'Shared', { create: true });
}`;

// The folder's files in the page: dir(path) (made as needed), write(path, text | Blob), empty(name)
const FILES = `const root = await navigator.storage.getDirectory();
    const dir = async path => { let d = root; for (const part of path.split('/')) d = await d.getDirectoryHandle(part, { create: true }); return d; };
    const write = async (path, data) => { const parts = path.split('/'), name = parts.pop(); const d = await dir(parts.join('/'));
        const w = await (await d.getFileHandle(name, { create: true })).createWritable(); await w.write(data); await w.close(); };
    const empty = async name => { try { await root.removeEntry(name, { recursive: true }); } catch (_) {} };
    const webp = async () => { const c = document.createElement('canvas'); c.width = 85; c.height = 110; c.getContext('2d').fillRect(0, 0, 10, 10);
        return new Promise(r => c.toBlob(r, 'image/webp')); };`;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    const { script } = await b.send('script.addPreloadScript', { functionDeclaration: STANDIN, contexts: [main] });
    try {
        // A database with two PaperWizard sheets (glog: 2 pages, prop: 1) and a DailyWizard task with steps
        const db = fixtureDb();
        db._DailyWizard.buildings.B1.tasks[0].steps = [{ text: 'Fill the tank' }, { text: 'Water each row' }];
        const box = (id, x, y) => ({ id, label: id, x, y, w: 0.12, h: 0.03, page: 1, fontSize: 10, align: 'left', source: 'lot.strain', questionId: null, day: 1, dayGroup: null, checkbox: false, checkValue: '' });
        const sheet = (name, pageCount, document) => ({ name, orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount, cadence: 'one-shot', document, fields: [box('s1', 0.1, 0.1)], signature: null });
        db._PaperWizard = {
            sheets: { glog: sheet('Grow Log', 2, 'grow-log'), prop: sheet('Propagation', 1, 'propagation') },
            wizards: {
                wg: { sheetId: 'glog', name: 'Grow Log', questions: [{ id: 'q1', label: 'Note', type: 'text', options: [], rowScoped: false, sameAsLast: false, mandatory: false, prefillFrom: null }] },
                wp: { sheetId: 'prop', name: 'Propagation', questions: [{ id: 'q2', label: 'Note', type: 'text', options: [], rowScoped: false, sameAsLast: false, mandatory: false, prefillFrom: null }] }
            },
            entries: {}
        };

        // ---- The database folder: the DB file, Media (pictures, a video, a building's subfolder) and Docs (page sets) ----
        await openSitka(b, main, BASE);
        await b.run(main, `${FILES} await empty('MediaDocs');
            await write('MediaDocs/DB-26-11-10.json', ${JSON.stringify(JSON.stringify(db))});
            for (const f of ['wat1_1.jpg', 'es_wat1_1.jpg', 'Building 1/scu1_1.png', 'zzzz_1.jpg']) await write('MediaDocs/Media/' + f, 'picture ' + f);
            await write('MediaDocs/Media/wat1_2.mp4', 'video'); await write('MediaDocs/Media/readme.txt', 'not a picture');
            for (const f of ['glog-p1.webp', 'glog-p2.webp', 'prop-p1.webp', 'newform-p1.webp', 'broken-p2.webp']) await write('MediaDocs/docs/' + f, await webp());
            window.__pickFolder = 'MediaDocs'; await DbFolder.choose();`);
        let st = await b.run(main, `return { active: DbFolder.active, folder: DbFolder.handle?.name, sheets: Object.keys(DB.data._PaperWizard?.sheets || {}).join() };`);
        check('the database opens from its folder', st.active && st.folder === 'MediaDocs' && st.sheets === 'glog,prop', JSON.stringify(st));

        // ---- DailyWizard: the Media folder's pictures and videos load as it opens, subfolders included ----
        const dw = await openTool(b, main, 'DailyWizard');
        const kept = () => b.run(main, `return { pics: [...DailyWizardKept.pics.keys()].sort().join(), vids: [...DailyWizardKept.vids.keys()].sort().join(),
            url: DailyWizardKept.pics.get('wat1_1')?.url || null };`);
        await b.waitFor(main, `return DailyWizardKept.pics.size >= 4;`);
        st = await kept();
        check('DailyWizard loads the Media folder\'s pictures and video by itself (a building\'s subfolder too, a language version too)',
            st.pics === 'es_wat1_1,scu1_1,wat1_1,zzzz_1' && st.vids === 'wat1_2' && /^blob:/.test(st.url || ''), JSON.stringify(st));
        const toast = await b.run(dw, `return document.getElementById('toast').textContent;`);
        check('…and says so, with the names that fit no task and the files skipped', /📁 Media folder — pictures: 4, videos: 1/.test(toast) && /zzzz_1\.jpg/.test(toast) && /readme\.txt/.test(toast), toast);
        const note = await b.run(dw, `return getComputedStyle(document.getElementById('hoursComment')).backgroundColor;`);
        check('the hours screen\'s note box is dark blue, as the other fields', note === 'rgb(26, 26, 62)', note);

        // Opened again: the same files keep their links, and nothing is said
        await b.run(main, `Tools.close(); Tools.open('DailyWizard');`);
        await b.waitFor(main, `return Tools.current === 'DailyWizard';`);
        await b.sleep(400);
        const again = await kept();
        const toast2 = await b.run(dw, `return document.getElementById('toast').textContent;`);
        check('opened again: the files already loaded keep their links, and no toast', again.url === st.url && !/Media folder/.test(toast2), JSON.stringify({ same: again.url === st.url, toast2 }));

        // 🔄 Refresh images reads the folder again: a picture added since comes in
        await b.run(main, `${FILES} await write('MediaDocs/Media/wat1_2.jpg', 'a new picture');`);
        await b.run(dw, `openTaskDetail('B1', 'wat1'); document.getElementById('refreshImagesBtn').click();`);
        await b.waitFor(main, `return DailyWizardKept.pics.has('wat1_2');`);
        st = await kept();
        check('🔄 Refresh images brings in a picture added to the Media folder since', st.pics.includes('wat1_2') && st.url === again.url, st.pics);
        await b.run(dw, `closeTaskDetail();`);

        // ---- PaperWizard: every Docs page set named for a sheet is ready to print, all at once ----
        const pw = await openTool(b, main, 'PaperWizard');
        await b.waitFor(main, `return Tools.current === 'PaperWizard';`);
        st = await b.waitFor(pw, `return printDocs.size >= 2 ? { docs: [...printDocs.values()].map(d => d.sheetId + ':' + d.pages.length).sort().join(), from: [...printDocs.values()].every(d => d.from === 'Docs'),
            toast: document.getElementById('toast').textContent, glog: printBlockers('glog', 'k', null, 'L100'), chip: printDocsChip() } : null;`);
        check('PaperWizard loads the Docs folder\'s page sets for both sheets, every page, as it opens (a "docs" folder in small letters too)', st && st.docs === 'glog:2,prop:1' && st.from, JSON.stringify(st));
        check('…so a sheet\'s print waits only for its entry, not its document', st && st.glog.join() === 'No entry yet — fill it first', JSON.stringify(st?.glog));
        check('…a form not set up as a sheet and a page set missing its page 1 are named, not loaded',
            st && /2 documents ready to print · 1 not set up as a sheet yet · ⚠️ broken: Missing page 1/.test(st.toast), st?.toast);
        check('…and the cabinet\'s chip counts them', st && /📄 2 documents/.test(st.chip) && /glog · 2p/.test(st.chip), st?.chip);

        // Configure Sheets: a saved sheet opens with its pages from the folder
        st = await b.run(pw, `switchTab('configure'); openSavedSheet('prop'); await new Promise(r => setTimeout(r, 400));
            return { doc: loadedDoc?.baseName || null, pages: loadedDoc?.pages.length || 0, stage: document.querySelectorAll('#pageStage .form-page').length, toast: document.getElementById('toast').textContent };`);
        check('Configure Sheets: picking a saved sheet opens it with its pages from the Docs folder', st.doc === 'prop' && st.pages === 1 && st.stage === 1 && /pages from the Docs folder/.test(st.toast), JSON.stringify(st));

        // 📂 Load document by hand still works, and replaces only that sheet's document
        st = await b.run(pw, `${FILES} const blob = await webp(); await loadPrintDocument([new File([blob], 'glog-p1.webp', { type: 'image/webp' })]);
            return [...printDocs.values()].map(d => d.sheetId + ':' + d.pages.length + (d.from ? ':folder' : '')).sort().join();`);
        check('📂 Load document by hand replaces that sheet\'s document only', st === 'glog:1,prop:1:folder', st);
        await b.run(main, `Tools.close();`);

        // ---- Out of folder mode, nothing comes from the folder ----
        await b.run(main, `${FILES} await write('MediaDocs/Media/scu1_2.jpg', 'later'); DbFolder.deactivate(); Tools.open('DailyWizard');`);
        await b.waitFor(main, `return Tools.current === 'DailyWizard';`);
        await b.sleep(400);
        st = await kept();
        check('not in folder mode: the Media folder isn\'t read', !st.pics.includes('scu1_2'), st.pics);
        await b.run(main, `Tools.close(); Tools.open('PaperWizard');`);
        await b.waitFor(main, `return Tools.current === 'PaperWizard';`);
        await b.sleep(400);
        st = await b.run(pw, `return printDocs.size;`);
        check('…nor the Docs folder', st === 0, String(st));
        await b.run(main, `Tools.close();`);

        // ---- The calendar button on date fields: white, for Chrome and Edge (Firefox, running these tests, has no such button
        //      to style, so the rule is checked in the page's source) ----
        const css = await b.run(main, `return (await (await fetch(location.href)).text()).includes('::-webkit-calendar-picker-indicator { filter: invert(1);');`);
        check('date fields everywhere get a white calendar button (Chrome and Edge)', css === true);
    } finally {
        await b.run(main, `window.__pickFolder = null; if (typeof Tools !== 'undefined' && Tools.current) Tools.close();`).catch(() => {});
        await b.send('script.removePreloadScript', { script }).catch(() => {});
        await leave(b, main);
    }
    return results;
}
