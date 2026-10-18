// 📂 Load DB with a Wages.json picked by itself: on the office, with the building files already open, its wages are
// added to what's open (nothing else changes, nothing is discarded). Anywhere else it is refused and nothing changes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fixtureDb, makeChecker, fresh, splitFiles, openSplit, saveSplit, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';

export const title = 'Load DB: a Wages.json by itself adds the wages';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitka-wages-'));
    let main = await fresh(b);
    const files = await splitFiles(b, main, BASE, fixtureDb());
    const noWages = { ...files };
    delete noWages['Wages.json'];
    // The file as OneDrive might have renamed it: it's recognised by what's in it
    const wagesPath = path.join(dir, 'Wages (1).json');
    fs.writeFileSync(wagesPath, files['Wages.json']);
    const dbPath = path.join(dir, 'DB-26-10-17.json');
    fs.writeFileSync(dbPath, JSON.stringify(fixtureDb()));

    // Pick files in 📂 Load DB's file input; alert / confirm are recorded (confirm answers `answer`)
    const watch = (ctx, answer = true) => b.run(ctx, `window.__alerts = []; window.__confirms = [];
        window.alert = m => window.__alerts.push(String(m));
        window.confirm = m => { window.__confirms.push(String(m)); return ${answer}; };`);
    const pick = async (ctx, p) => {
        const r = await b.send('script.evaluate', { expression: `document.getElementById('dbImportInput')`, target: { context: ctx }, awaitPromise: false });
        await b.send('input.setFiles', { context: ctx, element: { sharedId: r.result.sharedId }, files: [p] });
        await b.sleep(600);
    };
    const state = ctx => b.run(ctx, `return {
        lots: Object.keys(DB.data?.lots || {}).join(), events: (DB.data?.calendarEvents || []).length,
        wages: Object.fromEntries(Object.entries(DB.data?._EmployeeWizard?.employees || {}).map(([n, e]) => [n, e.wage ?? null])),
        haveWages: DbSplit.haveWages, unsaved: hasUnsavedChanges, fileName: DB.fileName,
        alerts: window.__alerts, confirms: window.__confirms, toast: document.getElementById('syncToastText').textContent };`);

    // ---- Office: Main + building files open, then Wages.json by itself ----
    check('office opened Main + building files without Wages.json', await openSplit(b, main, BASE, 'office', noWages));
    let s = await state(main);
    check('no wages yet', Object.values(s.wages).every(w => w === null) && !s.haveWages, JSON.stringify(s.wages));
    const ew = await openTool(b, main, 'EmployeeWizard');
    await watch(main);
    await pick(main, wagesPath);
    s = await state(main);
    check('the wages are added to the open employees', s.wages.Alex === 20 && s.wages.Blair === 21 && s.wages.Casey === 22 && s.wages.Drew === 23, JSON.stringify(s.wages));
    check('everything else is still open (lots, events)', s.lots === 'L100,L200' && s.events === fixtureDb().calendarEvents.length, `${s.lots} · ${s.events}`);
    check('no "discard unsaved changes" question and no alert', !s.confirms.length && !s.alerts.length, JSON.stringify([s.confirms, s.alerts]));
    check('nothing is unsaved: the wages are as on disk', s.unsaved === false && s.haveWages);
    check('the status bar says Wages is open', s.fileName === 'Main + Wages + 2 building files', s.fileName);
    check('a toast says the wages were added', s.toast.includes('Wages added: 4 employees'), s.toast);
    check('nothing to save', (await b.run(main, `return DbSplit.plan().toSave.length;`)) === 0);
    await b.sleep(400);
    check('an open EmployeeWizard gets the wages', (await b.run(ew, `return DB.data._EmployeeWizard.employees.Alex.wage;`)) === 20);
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });

    // ---- Office with unsaved changes: they stay, a wage changed here is kept, and it all saves ----
    await openSplit(b, main, BASE, 'office', noWages);
    await b.run(main, `DB.data._EmployeeWizard.employees.Blair.wage = 30; DB.data.lots.L100.plantCount = 95; markUnsaved();`);
    await watch(main);
    await pick(main, wagesPath);
    s = await state(main);
    check('with unsaved changes: no question, nothing discarded', !s.confirms.length && s.unsaved && (await b.run(main, `return DB.data.lots.L100.plantCount;`)) === 95);
    check('the wage changed here (Blair 30) is kept; the rest come from the file', s.wages.Blair === 30 && s.wages.Alex === 20, JSON.stringify(s.wages));
    check('the toast says one change made here was kept', s.toast.includes('1 change made here kept'), s.toast);
    const saved = await saveSplit(b, main);
    check('saving writes Main.json and Wages.json', Object.keys(saved).sort().join() === 'Main.json,Wages.json', Object.keys(saved).join(', '));
    const w = JSON.parse(saved['Wages.json'] || '{}');
    check('Wages.json has every wage, with Blair\'s change', JSON.stringify(w.wages) === JSON.stringify({ Alex: 20, Blair: 30, Casey: 22, Drew: 23 }), JSON.stringify(w.wages));
    check('Main.json has the plant count and no wages', (() => { const m = JSON.parse(saved['Main.json'] || '{}');
        return m.lots?.L100?.plantCount === 95 && Object.values(m._EmployeeWizard?.employees || {}).every(e => e.wage === undefined); })());
    check('nothing left unsaved, and no "can\'t be saved" warning', (await b.run(main, 'return hasUnsavedChanges;')) === false && !b.logs.some(l => l.includes("can't be saved")));

    // ---- Refused: a building device, a single-file DB, nothing open ----
    await openSplit(b, main, BASE, 'B1', noWages);
    await watch(main);
    await pick(main, wagesPath);
    s = await state(main);
    check('building device: refused with a message, nothing changed', s.alerts.length === 1 && s.alerts[0].includes('only on the office') && !s.haveWages && s.lots === 'L100,L200', JSON.stringify(s.alerts));

    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    await watch(main);
    await pick(main, wagesPath);
    s = await state(main);
    check('single-file DB: refused with a message, the DB stays open', s.alerts.length === 1 && s.alerts[0].includes('single file') && s.lots === 'L100,L200' && s.fileName === 'DB-26-10-13', JSON.stringify(s.alerts));

    // The start screen's own Load button hides the start screen while the file dialog is open
    await openSitka(b, main, BASE);
    await watch(main);
    await b.run(main, `hideOverlay(); fileDialogSource = 'overlay';`);
    await pick(main, wagesPath);
    s = await b.run(main, `return { lots: Object.keys(DB.data?.lots || {}).length, name: DB.fileName, alerts: window.__alerts, overlay: !document.getElementById('dbOverlay').classList.contains('hidden') };`);
    check('nothing open: refused with a message, back to the start screen', !s.lots && !s.name && s.alerts.length === 1 && s.alerts[0].includes("can't be opened by itself") && s.overlay, JSON.stringify(s));

    // ---- An ordinary DB file still asks before discarding unsaved changes ----
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    await b.run(main, `DB.data.lots.L100.plantCount = 77; markUnsaved();`);
    await watch(main, false);
    await pick(main, dbPath);
    s = await state(main);
    check('a database file with unsaved changes open: asked first; Cancel keeps them', s.confirms.length === 1 && s.confirms[0].includes('discard') &&
        (await b.run(main, `return DB.data.lots.L100.plantCount;`)) === 77, JSON.stringify(s.confirms));
    await watch(main, true);
    await pick(main, dbPath);
    check('… and OK loads the file', (await b.run(main, `return DB.fileName + ' ' + DB.data.lots.L100.plantCount;`)) === 'DB-26-10-17 100');

    await leave(b, main);
    fs.rmSync(dir, { recursive: true, force: true });
    return results;
}
