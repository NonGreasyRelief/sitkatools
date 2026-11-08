// 🕓 Folder mode saves at 8:30, 12:30 and 4:30, brings in the other devices' saves 15 minutes later (and with a save by hand,
// and every 10 minutes while nothing here is unsaved), and reloads at 6:00 AM, by itself (user requests 2026-11-07: building
// laptops and the office in Chrome or Edge, in folder mode on the OneDrive-synced SharePoint folder). The folder here is a real one, in the browser's private
// storage (navigator.storage.getDirectory()), picked through a stand-in showDirectoryPicker set before every page; its
// handle is remembered in IndexedDB as a picked folder is. The page's clock is moved to test it, and the 6:00 AM reload
// really reloads the page, which then opens the folder and the tool again by itself.
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, splitFiles, leave } from './lib/helpers.mjs';

export const title = 'folder mode: saved at 8:30, 12:30 and 4:30, the others\' saves brought in, reloaded at 6:00 AM'

// Before every page: the picker opens a folder of the browser's private storage (window.__pickFolder, else "Shared"),
// and the folder's permission is window.__folderPermission (Firefox has no permission methods for these folders)
const STANDIN = `() => {
    window.__folderPermission = 'granted';
    if (window.FileSystemHandle && !FileSystemHandle.prototype.queryPermission) {
        FileSystemHandle.prototype.queryPermission = async function () { return window.__folderPermission; };
        FileSystemHandle.prototype.requestPermission = async function () { return window.__folderPermission; };
    }
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(window.__pickFolder || 'Shared', { create: true });
}`;

// Set the page's clock to h:m, `day` days from today; every new Date() / Date.now() in the page reads from it
const at = (h, m, day = 0) => `{ if (!window.__RealDate) window.__RealDate = Date;
    const Real = window.__RealDate, r = new Real();
    const t = new Real(r.getFullYear(), r.getMonth(), r.getDate() + ${day}, ${h}, ${m}), shift = t - Real.now();
    window.Date = class extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + shift])); } static now() { return Real.now() + shift; } }; }`;
// …and the clock's checks go on from there, whatever the real time of day
const from = (h, m, day = 0) => `${at(h, m, day)} FolderClock.last = Date.now();`;

// The folder's files in the page: dir(name), read(dir, file) → text or null, list(dir) → names, write(dir, file, text), empty(dir)
const FILES = `const root = await navigator.storage.getDirectory();
    const dir = n => root.getDirectoryHandle(n, { create: true });
    const read = async (d, n) => { try { return await (await (await d.getFileHandle(n)).getFile()).text(); } catch (_) { return null; } };
    const list = async d => { const out = []; for await (const e of d.values()) out.push(e.name); return out.sort(); };
    const write = async (d, n, text) => { const w = await (await d.getFileHandle(n, { create: true })).createWritable(); await w.write(text); await w.close(); };
    const empty = async d => { for (const n of await list(d)) await d.removeEntry(n, { recursive: true }); };`;

const toast = `document.getElementById('syncToastText').textContent`;
const yymmdd = d => `DB-${d.slice(2, 4)}-${d.slice(5, 7)}-${d.slice(8, 10)}.json`;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    const { script } = await b.send('script.addPreloadScript', { functionDeclaration: STANDIN, contexts: [main] });
    // The page the reload opened, once it shows `tool` (the old page's window.__marker is gone)
    const reloaded = (tool) => b.waitFor(main, `return !window.__marker && typeof Tools !== 'undefined' && Tools.current === ${JSON.stringify(tool)} && DbFolder.active
        ? { search: location.search, tool: Tools.current, unsaved: hasUnsavedChanges } : null;`, 15000);
    try {
        // ---- Split files on a building laptop (?device=B1), the folder holding Main.json and Building-B1.json ----
        const files = await splitFiles(b, main, BASE, fixtureDb());
        await openSitka(b, main, BASE, 'B1');
        await b.run(main, `${FILES} const d = await dir('Shared'); await empty(d);
            await write(d, 'Main.json', ${JSON.stringify(files['Main.json'])}); await write(d, 'Building-B1.json', ${JSON.stringify(files['Building-B1.json'])});
            await write(d, 'Building-B2.json', ${JSON.stringify(files['Building-B2.json'])});
            await DbFolder.choose();`);
        let st = await b.run(main, `return { active: DbFolder.active, role: DbSplit.role, folder: DbFolder.handle?.name };`);
        check('a building laptop opens the folder\'s split files as B1', st.active && st.role === 'B1' && st.folder === 'Shared', JSON.stringify(st));

        // Before 4:30 nothing is saved
        const b1Before = await b.run(main, `${FILES} return read(await dir('Shared'), 'Building-B1.json');`);
        await b.run(main, `${from(16, 20)} DB.data._DailyWizard.buildings.B1.note = 'afternoon'; markUnsaved(); ${at(16, 29)} await FolderClock.check();`);
        st = await b.run(main, `${FILES} return { b1: await read(await dir('Shared'), 'Building-B1.json'), unsaved: hasUnsavedChanges };`);
        check('at 4:29 nothing is saved yet', st.b1 === b1Before && st.unsaved, `unsaved ${st.unsaved}`);

        // 4:30: the building's own file is saved into the folder, Main.json isn't touched
        await b.run(main, `${at(16, 31)} await FolderClock.check();`);
        st = await b.run(main, `${FILES} const d = await dir('Shared'); return { b1: JSON.parse(await read(d, 'Building-B1.json')), main: await read(d, 'Main.json'), unsaved: hasUnsavedChanges, toast: ${toast}, files: await list(d) };`);
        check('4:30 PM: Building-B1.json is saved into the folder by itself, with the change', st.b1._DailyWizard?.buildings?.B1?.note === 'afternoon' && !st.unsaved, JSON.stringify({ unsaved: st.unsaved, files: st.files }));
        check('…Main.json (the office\'s) is left as it was, and no other file is written', st.main === files['Main.json'] && st.files.join() === 'Building-B1.json,Building-B2.json,Main.json', st.files.join());
        check('…and it says so', /Saved by itself at 4:30 PM: Building-B1\.json to "Shared"/.test(st.toast), st.toast);

        // With nothing changed, the next 4:30 writes nothing
        const b1Saved = await b.run(main, `${FILES} return read(await dir('Shared'), 'Building-B1.json');`);
        await b.run(main, `${from(16, 29)} ${at(16, 31)} await FolderClock.check();`);
        st = await b.run(main, `${FILES} return read(await dir('Shared'), 'Building-B1.json');`);
        check('nothing unsaved: 4:30 writes nothing', st === b1Saved);

        // ---- 12:30 and 12:45: saved, then Building 2's 12:30 save brought in, in place, once no one has used the laptop
        //      for 2 minutes; sign-ins made meanwhile are saved first and stay ----
        const b2Write = note => `{ ${FILES} const d = await dir('Shared'); const b2 = JSON.parse(await read(d, 'Building-B2.json'));
            b2._DailyWizard = b2._DailyWizard || { buildings: {} }; b2._DailyWizard.buildings.B2 = { tasks: [], ...(b2._DailyWizard.buildings.B2 || {}), note: ${JSON.stringify(note)} };
            await write(d, 'Building-B2.json', JSON.stringify(b2, null, 2)); }`;
        const signIn = (id, who) => `DB.data._DailyWizard.buildings.B1.signIns = { ...(DB.data._DailyWizard.buildings.B1.signIns || {}),
            ${id}: { item: 'misc', title: 'Miscellaneous labour', employee: '${who}', since: new Date().toISOString(), by: 'B1', badge: '' } }; markUnsaved();`;
        await b.run(main, `Tools.open('DailyWizard');`);
        await b.waitFor(main, `return Tools.current === 'DailyWizard';`);
        await b.run(main, `${from(12, 20)} ${signIn('si_noon1', 'Alex')} ${at(12, 31)} await FolderClock.check(); ${b2Write('b2 at 12:30')}
            ${at(12, 40)} ${signIn('si_noon2', 'Blair')} window.__marker = 5; ${at(12, 45)} FolderClock.input = Date.now(); ${at(12, 46)} await FolderClock.check();`);
        st = await b.run(main, `return { b2: DB.data._DailyWizard.buildings.B2?.note || null, due: FolderClock.takeInDue, unsaved: hasUnsavedChanges };`);
        check('12:46 with the laptop used a minute ago: nothing brought in yet', st.b2 === null && !!st.due && st.unsaved, JSON.stringify(st));
        await b.run(main, `${at(12, 47)} await FolderClock.check();`);
        st = await b.run(main, `${FILES} const d = await dir('Shared'), file = JSON.parse(await read(d, 'Building-B1.json'));
            return { b2: DB.data._DailyWizard.buildings.B2?.note || null, signIns: Object.keys(DB.data._DailyWizard.buildings.B1.signIns || {}).sort().join(),
                fileSignIns: Object.keys(file._DailyWizard.buildings.B1.signIns || {}).sort().join(), unsaved: hasUnsavedChanges, marker: window.__marker,
                tool: Tools.current, toolHasIt: Tools.defs.DailyWizard.run.data === DB.data, toast: ${toast} };`);
        check('12:47: Building 2\'s 12:30 save is brought in', st.b2 === 'b2 at 12:30' && /Updated at 12:45 PM with the newest Building-B2\.json from "Shared"/.test(st.toast), JSON.stringify(st));
        check('…both sign-ins (one before 12:30, one after) are in the DB and in this building\'s file: nobody is signed out', st.signIns === 'si_noon1,si_noon2' && st.fileSignIns === 'si_noon1,si_noon2' && !st.unsaved, JSON.stringify(st));
        check('…in place: no reload, DailyWizard still open and holding the new DB', st.marker === 5 && st.tool === 'DailyWizard' && st.toolHasIt, JSON.stringify(st));

        // A badge scan while the files are being read calls the take-in off: the scan stays, and comes in with the next one
        st = await b.run(main, `${b2Write('b2 later')} const p = FolderClock.takeIn('test');
            DB.data._DailyWizard.buildings.B1.note = 'scanned meanwhile'; markUnsaved(); const r = await p;
            return { r, note: DB.data._DailyWizard.buildings.B1.note, b2: DB.data._DailyWizard.buildings.B2?.note };`);
        check('a change while the files are read: the take-in is called off, and the change stays', st.r === 'retry' && st.note === 'scanned meanwhile' && st.b2 === 'b2 at 12:30', JSON.stringify(st));

        // 💾 Save to folder by hand brings the others' new files in too, and the open tool has the new DB at once
        await b.run(main, `document.getElementById('exportBtn').click(); document.getElementById('saveToFolderBtn').click();`, { user: true });
        st = await b.waitFor(main, `return DB.data._DailyWizard.buildings.B2?.note === 'b2 later' ? { note: DB.data._DailyWizard.buildings.B1.note, unsaved: hasUnsavedChanges,
            toolHasIt: Tools.defs.DailyWizard.run.data === DB.data, toast: ${toast} } : null;`);
        check('💾 Save to folder by hand saves this building and brings in Building 2\'s newest', st && st.note === 'scanned meanwhile' && !st.unsaved && st.toolHasIt &&
            /Updated with the newest Building-B2\.json/.test(st.toast), JSON.stringify(st));

        // Every 10 minutes, with nothing unsaved here: another device's save comes in, and nothing is saved for it
        const b1Now = await b.run(main, `${FILES} return read(await dir('Shared'), 'Building-B1.json');`);
        await b.run(main, `${b2Write('b2 at 1:10')} FolderClock.input = 0; ${from(13, 0)} FolderClock.peeked = Date.now(); ${at(13, 5)} await FolderClock.check();`);
        st = await b.run(main, `return DB.data._DailyWizard.buildings.B2?.note;`);
        check('the 10-minute look: not before 10 minutes', st === 'b2 later', st);
        await b.run(main, `${at(13, 11)} await FolderClock.check();`);
        st = await b.run(main, `${FILES} return { b2: DB.data._DailyWizard.buildings.B2?.note, b1: await read(await dir('Shared'), 'Building-B1.json'), unsaved: hasUnsavedChanges };`);
        check('…after 10 minutes, with nothing unsaved here, Building 2\'s save comes in, and this building\'s file isn\'t written', st.b2 === 'b2 at 1:10' && st.b1 === b1Now && !st.unsaved, JSON.stringify({ b2: st.b2, unsaved: st.unsaved }));

        // A file caught while OneDrive writes it (half a file): skipped with no alert, brought in the next time
        await b.run(main, `${FILES} window.__alerts = []; window.alert = m => window.__alerts.push(m); await write(await dir('Shared'), 'Building-B2.json', '{"_building": "B2", "_Dai');
            ${at(13, 22)} await FolderClock.check();`);
        st = await b.run(main, `return { b2: DB.data._DailyWizard.buildings.B2?.note, alerts: window.__alerts };`);
        check('a file caught half-written: nothing changes and nothing pops up', st.b2 === 'b2 at 1:10' && st.alerts.length === 0, JSON.stringify(st));
        await b.run(main, `${FILES} await write(await dir('Shared'), 'Building-B2.json', ${JSON.stringify(files['Building-B2.json'])}); ${b2Write('b2 whole again')} ${at(13, 33)} await FolderClock.check();`);
        st = await b.run(main, `return DB.data._DailyWizard.buildings.B2?.note;`);
        check('…and it comes in once it\'s whole', st === 'b2 whole again', st);
        await b.run(main, `Tools.close();`);

        // ---- 6:00 AM: waits while someone uses the page, saves what came in after 4:30 PM, reloads, opens the folder and the tool again ----
        await b.run(main, `Tools.open('DailyWizard');`);
        await b.waitFor(main, `return Tools.current === 'DailyWizard';`);
        await b.run(main, `${from(17, 0)} DB.data._DailyWizard.buildings.B1.note = 'evening'; markUnsaved(); window.__marker = 1;
            ${at(6, 0, 1)} FolderClock.input = Date.now() + 30000; ${at(6, 1, 1)} await FolderClock.check();`);
        st = await b.run(main, `${FILES} return { marker: window.__marker, due: FolderClock.reloadDue, unsaved: hasUnsavedChanges, b1: JSON.parse(await read(await dir('Shared'), 'Building-B1.json'))._DailyWizard.buildings.B1.note };`);
        check('6:01 AM with someone using the page a minute ago: no reload yet, nothing saved yet', st.marker === 1 && st.due && st.unsaved && st.b1 !== 'evening', JSON.stringify(st));
        await b.run(main, `${at(6, 3, 1)} FolderClock.check(); return true;`);
        const after = await reloaded('DailyWizard');
        check('after 2 minutes idle the page reloads, opens the folder again by itself, and DailyWizard again', !!after && !after.unsaved, JSON.stringify(after));
        check('…the page link keeps its device and drops the reload\'s note', after?.search === '?device=B1', after?.search);
        st = await b.run(main, `${FILES} return { note: DB.data._DailyWizard.buildings.B1.note, file: JSON.parse(await read(await dir('Shared'), 'Building-B1.json'))._DailyWizard.buildings.B1.note,
            role: DbSplit.role };`);
        check('…the change made after 4:30 PM was saved before the reload, and is what opened again', st.note === 'evening' && st.file === 'evening' && st.role === 'B1', JSON.stringify(st));

        // ---- A file saved from another device since it was opened: a separate copy, no question, and no reload that day ----
        await b.run(main, `Tools.close();`);
        await b.run(main, `${FILES} const d = await dir('Shared'); const other = JSON.parse(await read(d, 'Building-B1.json'));
            other._DailyWizard.buildings.B1.note = 'from another laptop'; await write(d, 'Building-B1.json', JSON.stringify(other, null, 2));
            window.__asked = 0; window.confirm = () => { window.__asked++; return true; }; window.__alerts = []; window.alert = m => window.__alerts.push(m);
            ${from(16, 20)} DB.data._DailyWizard.buildings.B1.note = 'mine'; markUnsaved();
            ${at(16, 31)} await FolderClock.check();`);
        st = await b.run(main, `${FILES} const d = await dir('Shared'); return { files: await list(d), b1: JSON.parse(await read(d, 'Building-B1.json'))._DailyWizard.buildings.B1.note,
            copy: JSON.parse(await read(d, 'Building-B1-conflict-1631.json') || '{}')._DailyWizard?.buildings?.B1?.note, asked: window.__asked, alerts: window.__alerts, unsaved: hasUnsavedChanges, toast: ${toast}, trouble: FolderClock.trouble };`);
        check('saved elsewhere since opening: this device\'s version goes into Building-B1-conflict-1631.json, the other is untouched', st.copy === 'mine' && st.b1 === 'from another laptop', JSON.stringify(st.files));
        check('…with no question or alert, and it stays unsaved', st.asked === 0 && st.alerts.length === 0 && st.unsaved, JSON.stringify({ asked: st.asked, alerts: st.alerts }));
        check('…and it says why', /Not saved by itself at 4:30 PM: Building-B1\.json had been saved from another device.*Building-B1-conflict-1631\.json/.test(st.toast), st.toast);
        await b.run(main, `window.__marker = 2; FolderClock.input = 0; ${at(6, 10, 1)} await FolderClock.check();`);
        st = await b.run(main, `return { marker: window.__marker, due: FolderClock.reloadDue, toast: ${toast} };`);
        check('…so 6:00 AM doesn\'t reload, and says why', st.marker === 2 && !st.due && /Not reloaded at 6:00 AM: Building-B1\.json had been saved from another device/.test(st.toast), JSON.stringify(st));

        // Opening the folder again by hand lets the automatic saves go on
        st = await b.run(main, `window.confirm = () => true; await DbFolder.open(DbFolder.handle); return { trouble: FolderClock.trouble, note: DB.data._DailyWizard.buildings.B1.note };`);
        check('…until the folder is opened again by hand', st.trouble === null && st.note === 'from another laptop', JSON.stringify(st));

        // ---- The browser no longer lets the page use the folder: nothing written, it says to click Save DB ----
        await b.run(main, `${FILES} window.__folderPermission = 'prompt'; window.__before = (await list(await dir('Shared'))).join();
            DB.data._DailyWizard.buildings.B1.note = 'no permission'; markUnsaved();
            ${from(16, 29)} ${at(16, 32)} await FolderClock.check();`);
        st = await b.run(main, `${FILES} return { files: (await list(await dir('Shared'))).join(), before: window.__before, unsaved: hasUnsavedChanges, toast: ${toast} };`);
        check('no permission any more: nothing is written, and it says to click 💾 Save DB', st.files === st.before && st.unsaved &&
            /Not saved by itself at 4:30 PM: SitkaTools may no longer save in "Shared" by itself — click 💾 Save DB/.test(st.toast), JSON.stringify(st));
        await b.run(main, `window.__folderPermission = 'granted'; clearUnsaved();`);

        // ---- The office on the same schedule: 12:30 saves Main.json only; 12:45 brings in Building 1's 12:30 save ----
        await openSitka(b, main, BASE, 'office');
        await b.run(main, `window.__pickFolder = 'Shared'; await DbFolder.choose();`);
        await b.waitFor(main, `return DbFolder.active && DbSplit.role === 'office';`);
        const disk = await b.run(main, `${FILES} const d = await dir('Shared'); return { b1: await read(d, 'Building-B1.json'), b2: await read(d, 'Building-B2.json') };`);
        await b.run(main, `${from(12, 20)} DB.data.lots.L100.name = 'Planned at the office'; markUnsaved(); FolderClock.input = 0; ${at(12, 31)} await FolderClock.check();`);
        st = await b.run(main, `${FILES} const d = await dir('Shared'); return { main: JSON.parse(await read(d, 'Main.json')).lots.L100.name, b1: await read(d, 'Building-B1.json'),
            b2: await read(d, 'Building-B2.json'), unsaved: hasUnsavedChanges, toast: ${toast} };`);
        check('the office at 12:30: Main.json is saved by itself, and no building\'s file is written', st.main === 'Planned at the office' && st.b1 === disk.b1 && st.b2 === disk.b2 && !st.unsaved &&
            /Saved by itself at 12:30 PM: Main\.json to "Shared"/.test(st.toast), JSON.stringify({ main: st.main, unsaved: st.unsaved, toast: st.toast }));
        await b.run(main, `${FILES} const d = await dir('Shared'); const b1 = JSON.parse(await read(d, 'Building-B1.json'));
            b1._DailyWizard.buildings.B1.note = 'B1 at 12:30'; await write(d, 'Building-B1.json', JSON.stringify(b1, null, 2)); ${at(12, 46)} await FolderClock.check();`);
        st = await b.run(main, `return { note: DB.data._DailyWizard.buildings.B1.note, name: DB.data.lots.L100.name, toast: ${toast} };`);
        check('…and at 12:45 brings in Building 1\'s 12:30 save, keeping its own', st.note === 'B1 at 12:30' && st.name === 'Planned at the office' && /Updated at 12:45 PM with the newest Building-B1\.json/.test(st.toast), JSON.stringify(st));
        await b.run(main, `clearUnsaved();`);

        // ---- One DB file: a laptop that slept through 4:30 PM and 6:00 AM catches up as it wakes; the reload waits for
        //      CropLabourWizard's schedule changes not saved yet ----
        const T = today(1);   // the save happens the next morning: that day's DB file
        await openSitka(b, main, BASE);
        await loadSingle(b, main, fixtureDb());
        await b.run(main, `${FILES} await empty(await dir('Single')); window.__pickFolder = 'Single'; await DbFolder.choose();
            Tools.open('CropLabourWizard');`);
        // The folder is remembered as the most recent (before the clock moves: in a test the clock goes back to 3 PM)
        await b.waitFor(main, `return (await FolderStore.list())[0]?.name === 'Single';`);
        await b.waitFor(main, `return Tools.current === 'CropLabourWizard' && !!Tools.defs.CropLabourWizard.run?.api?.pending;`);
        await b.run(main, `window.__pending = true; Tools.defs.CropLabourWizard.run.api.pending = () => window.__pending;
            ${from(15, 0)} DB.data.lots.L100.name = 'Night crop'; markUnsaved(); window.__marker = 3; FolderClock.input = 0;
            ${at(7, 0, 1)} await FolderClock.check();`);
        st = await b.run(main, `${FILES} const d = await dir('Single'); return { files: await list(d), name: JSON.parse(await read(d, ${JSON.stringify(yymmdd(T))}) || '{}').lots?.L100?.name,
            unsaved: hasUnsavedChanges, marker: window.__marker, due: FolderClock.reloadDue };`);
        check('woken at 7 AM the next day: the 4:30 PM save happens then, as that day\'s DB file', st.name === 'Night crop' && !st.unsaved && st.files.join() === yymmdd(T), JSON.stringify(st));
        check('…and the reload waits while CropLabourWizard holds schedule changes not saved', st.marker === 3 && st.due, JSON.stringify(st));
        await b.run(main, `window.__pending = false; ${at(7, 1, 1)} FolderClock.check(); return true;`);
        const after2 = await reloaded('CropLabourWizard');
        check('…once they\'re saved or dropped it reloads, with the folder\'s newest DB file and CropLabourWizard open again', !!after2 && after2.search === '', JSON.stringify(after2));
        st = await b.run(main, `return { name: DB.data.lots.L100.name, file: DB.fileName };`);
        check('…which holds the day\'s change', st.name === 'Night crop' && st.file === yymmdd(T).replace('.json', ''), JSON.stringify(st));

        // ---- Out of folder mode nothing happens ----
        await b.run(main, `Tools.close(); DbFolder.deactivate(); DB.data.lots.L100.name = 'Not saved'; markUnsaved(); window.__marker = 4; FolderClock.input = 0;
            ${from(16, 0)} ${at(6, 30, 1)} await FolderClock.check();`);
        st = await b.run(main, `${FILES} return { name: JSON.parse(await read(await dir('Single'), ${JSON.stringify(yymmdd(T))})).lots.L100.name, marker: window.__marker, unsaved: hasUnsavedChanges };`);
        check('not in folder mode: no save at 4:30 PM and no reload at 6:00 AM', st.name === 'Night crop' && st.marker === 4 && st.unsaved, JSON.stringify(st));
        await b.run(main, `clearUnsaved();`);

        // ---- The reloaded page without the folder's permission: one click on the start screen opens it ----
        await openSitka(b, main, BASE);
        await b.run(main, `window.__folderPermission = 'prompt'; history.replaceState(null, '', location.pathname + '?reopen=DailyWizard'); await FolderClock.resume();`);
        st = await b.run(main, `return { active: DbFolder.active, tool: Tools.current, search: location.search, toast: ${toast}, button: document.getElementById('overlayOpenRecentBtn')?.textContent || '' };`);
        check('no permission after the reload: nothing opens, and it says to click 📁 Open on the start screen', !st.active && !st.tool && st.search === '' &&
            /click 📁 Open "Single" to open them/.test(st.toast) && st.button === '📁 Open "Single"', JSON.stringify(st));
        await b.run(main, `window.__folderPermission = 'granted'; history.replaceState(null, '', location.pathname + '?reopen=DailyWizard'); await FolderClock.resume();`);
        st = await b.run(main, `return { active: DbFolder.active, folder: DbFolder.handle?.name, tool: Tools.current, search: location.search };`);
        check('with it, the folder and the tool open by themselves', st.active && st.folder === 'Single' && st.tool === 'DailyWizard' && st.search === '', JSON.stringify(st));
        await b.run(main, `Tools.close();`);
    } finally {
        await b.run(main, `if (window.__RealDate) window.Date = window.__RealDate; window.__pickFolder = null;`).catch(() => {});
        await b.send('script.removePreloadScript', { script }).catch(() => {});
        await leave(b, main);
    }
    return results;
}
