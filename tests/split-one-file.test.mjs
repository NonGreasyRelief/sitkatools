// 📂 Load DB, one file at a time (user request 2026-10-29): a tablet picks its split files from OneDrive or SharePoint
// one by one. Main.json or a building's file picked by itself is added to the open split files (replacing the copy of
// it that's open); a building file picked before Main.json waits for it. The building then saves only its own file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fixtureDb, withOfficeAccess, makeChecker, fresh, splitFiles, openSplit, saveSplit, openSitka, leave } from './lib/helpers.mjs';

export const title = 'Load DB: split files one at a time';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitka-onefile-'));
    const ctx = await fresh(b);
    const files = await splitFiles(b, ctx, BASE, fixtureDb());
    const put = (name, text) => { const p = path.join(dir, name); fs.writeFileSync(p, text); return p; };
    const mainP = put('Main.json', files['Main.json']);
    const mainRenamed = put('Main (1).json', files['Main.json']);          // as OneDrive may name a downloaded copy
    const b1P = put('Building-B1.json', files['Building-B1.json']);
    const b2Renamed = put('Building-B2 1.json', files['Building-B2.json']);
    const dbP = put('DB-26-10-17.json', JSON.stringify(fixtureDb()));

    const watch = (answer = true) => b.run(ctx, `window.__alerts = []; window.__confirms = [];
        window.alert = m => window.__alerts.push(String(m));
        window.confirm = m => { window.__confirms.push(String(m)); return ${answer}; };`);
    const pick = async (...paths) => {
        const r = await b.send('script.evaluate', { expression: `document.getElementById('dbImportInput')`, target: { context: ctx }, awaitPromise: false });
        await b.send('input.setFiles', { context: ctx, element: { sharedId: r.result.sharedId }, files: paths });
        await b.sleep(900);
    };
    const state = () => b.run(ctx, `return {
        name: DB.fileName || '', role: DbSplit.role, loaded: [...DbSplit.loaded].sort().join(), pending: DbSplit.pending.map(p => p.name).join(),
        haveWages: DbSplit.haveWages, plants: DB.data?.lots?.L100?.plantCount, unsaved: hasUnsavedChanges,
        overlay: !document.getElementById('dbOverlay').classList.contains('hidden'),
        alerts: window.__alerts, confirms: window.__confirms, toast: document.getElementById('syncToastText').textContent };`);
    let s;

    // ---- A tablet (B1): its building's file first, then Main.json ----
    await openSitka(b, ctx, BASE, 'B1');
    await watch();
    await pick(b1P);
    s = await state();
    check('a building file picked before Main.json waits for it: nothing opened, and a toast says to load Main.json next',
        !s.name && s.pending === 'Building-B1.json' && /Building-B1\.json is ready — now load Main\.json/.test(s.toast) && !s.alerts.length, JSON.stringify(s));
    await pick(mainP);
    s = await state();
    check('…then Main.json: both open, as the building (B1)', s.name === 'Main + 1 building file' && s.loaded === 'Building-B1.json,Main.json' &&
        s.role === 'B1' && !s.pending && !s.unsaved && !s.confirms.length, JSON.stringify(s));
    check('…and no "now load" hint: its own file is open', !/Now load/.test(s.toast), s.toast);

    // ---- It saves only its own file ----
    await b.run(ctx, `DB.data.lots.L100.plantCount = 95; markUnsaved();`);
    const saved = await saveSplit(b, ctx);
    const links = await b.run(ctx, `return [...document.querySelectorAll('#saveFileLinks a.save-link')].map(a => a.dataset.file).join();`);
    check('💾 Save DB offers one file, the building\'s own', links === 'Building-B1.json' && Object.keys(saved).join() === 'Building-B1.json', `${links} · ${Object.keys(saved).join()}`);
    check('…holding the change (the plant count, as the building\'s update)',
        JSON.parse(saved['Building-B1.json'] || '{}')._overlays?.lots?.L100?.plantCount?.value === 95, (saved['Building-B1.json'] || '').slice(0, 200));

    // ---- Another building's file, renamed by OneDrive: added; what was saved here stays ----
    await watch();
    await pick(b2Renamed);
    s = await state();
    check('another building\'s file (named "Building-B2 1.json") is added by what\'s in it, with no question', s.name === 'Main + 2 building files' &&
        s.loaded === 'Building-B1.json,Building-B2.json,Main.json' && !s.confirms.length && !s.alerts.length, JSON.stringify(s));
    check('…the files reopen as this session last saved them (the plant count saved here is still 95)', s.plants === 95 && !s.unsaved, JSON.stringify(s));

    // ---- A file picked again replaces the open copy; with unsaved changes it asks first ----
    await b.run(ctx, `DB.data.lots.L100.plantCount = 90; markUnsaved();`);
    await watch(false);
    await pick(b1P);
    s = await state();
    check('with unsaved changes: asked first; Cancel keeps them', s.confirms.length === 1 && /Adding Building-B1\.json reopens the open files/.test(s.confirms[0]) &&
        s.plants === 90 && s.unsaved, JSON.stringify(s));
    await watch(true);
    await pick(b1P);
    s = await state();
    check('…OK: the picked Building-B1.json replaces the open copy (its plant count, 100), the other files stay',
        s.plants === 100 && !s.unsaved && s.name === 'Main + 2 building files', JSON.stringify(s));

    // ---- Main.json first (renamed by OneDrive), then the building's file ----
    await openSitka(b, ctx, BASE, 'B1');
    await watch();
    await pick(mainRenamed);
    s = await state();
    check('"Main (1).json" picked by itself opens as Main.json', s.name === 'Main + 0 building files' && s.loaded === 'Main.json', JSON.stringify(s));
    check('…and a toast says to load this building\'s file next', /Now load Building-B1\.json with 📂 Load DB/.test(s.toast), s.toast);
    const note = await b.run(ctx, `document.getElementById('exportBtn').click(); await new Promise(r => setTimeout(r, 200));
        const t = document.getElementById('savePopup').textContent; document.getElementById('saveCloseBtn').click(); return t;`, { user: true });
    check('…the save popup says so too', /Building-B1\.json wasn't opened — load it with 📂 Load DB/.test(note), note.replace(/\s+/g, ' ').slice(0, 300));
    await pick(b1P, b2Renamed);
    s = await state();
    check('building files picked together without Main.json are added to it', s.name === 'Main + 2 building files' &&
        s.loaded === 'Building-B1.json,Building-B2.json,Main.json' && !s.alerts.length, JSON.stringify(s));

    // ---- A whole database still opens as before, and drops a building file that was waiting ----
    await openSitka(b, ctx, BASE, 'B1');
    await watch();
    await pick(b1P);
    await pick(dbP);
    s = await state();
    check('a whole database (DB-26-10-17.json) opens as a single file; the waiting building file is dropped', s.name === 'DB-26-10-17' && !s.pending && !s.loaded, JSON.stringify(s));

    // ---- The office: adding a file doesn't ask for office access again, and keeps the wages ----
    const office = await splitFiles(b, ctx, BASE, withOfficeAccess(fixtureDb()));
    const ob2 = put('Building-B2 (office).json', office['Building-B2.json']);
    const opened = await openSplit(b, ctx, BASE, 'office', { 'Main.json': office['Main.json'], 'Wages.json': office['Wages.json'], 'Building-B1.json': office['Building-B1.json'] });
    check('the office opened Main + Wages + B1, with its badge or PIN', opened === true);
    await watch();
    await pick(ob2);
    s = await state();
    const gate = await b.run(ctx, `const el = document.getElementById('floorPin'); return !!el && !el.hidden;`);
    check('the office adds Building-B2 by itself: no office access asked again, the wages still open',
        !gate && s.name === 'Main + Wages + 2 building files' && s.role === 'office' && s.haveWages, JSON.stringify({ gate, ...s }));

    await b.run(ctx, `clearUnsaved();`);
    await leave(b, ctx);
    fs.rmSync(dir, { recursive: true, force: true });
    return results;
}
