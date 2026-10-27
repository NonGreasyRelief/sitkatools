// 🏷️ Set this device… with split files open reopens the files as the device picked (user request 2026-10-26), as its
// link would: a lot moved to it is picked up and it saves its own file. Unsaved changes are asked about first.
// A restored session has no copy of the files, so it says to open them with 📂 Load DB (user decision 2026-10-26).
import { fixtureDb, makeChecker, fresh, splitFiles, openSplit, saveSplit, leave, today, openSitka, loadSingle } from './lib/helpers.mjs';

export const title = 'setting the device reopens the files as it: a lot moved there is picked up and saved in its file';

function moveDb() {
    const db = fixtureDb();
    const Y2 = today(-2), Y = today(-1);
    const page = (room, days) => ({ phase: 'Bloom', room, header: {}, days: Object.fromEntries(days.map(d => [d, { note: 'watered' }])), phaseChangeDate: null,
        strikeInitials: null, snapshots: {}, signature: null, completedAt: null, printedAt: null });
    db._PaperWizard = {
        sheets: { glog: { name: 'Grow Log', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'daily-weekly', document: 'grow-log', fields: [], signature: null } },
        wizards: { wg01: { id: 'wg01', sheetId: 'glog', name: 'Grow', questions: [
            { id: 'note', label: 'Notes', type: 'text', options: [], rowScoped: true, sameAsLast: false, mandatory: false, prefillFrom: null }] } },
        entries: { L100: { glog: { instances: { [Y2]: page('Grow 1', [Y2, Y]) } } } }
    };
    return db;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    let main = await fresh(b);
    const files = await splitFiles(b, main, BASE, moveDb());
    // Pick a device in the role picker; answer the unsaved-changes question
    const switchTo = (role, { ok = true } = {}) => b.run(main, `
        window.__asked = []; window.__alerts = [];
        window.confirm = m => { window.__asked.push(m); return ${ok}; }; window.alert = m => window.__alerts.push(m);
        askDeviceRole = async () => ${JSON.stringify(role)};
        document.getElementById('changeRoleBtn').click();
        await new Promise(r => setTimeout(r, 400));
        document.getElementById('deviceLinkOverlay')?.remove();
        return { role: DbSplit.role, asked: window.__asked, alerts: window.__alerts, unsaved: hasUnsavedChanges, search: location.search };`, { user: true });

    // ---- Building 1 moves L100 to Building 2's Grow A and saves ----
    await openSplit(b, main, BASE, 'B1', files);
    await b.run(main, `DB.data.lots.L100.currentRoom = 'Grow A'; markUnsaved();`);
    const b1 = (await saveSplit(b, main))['Building-B1.json'];
    await b.run(main, `closeSavePopup();`);
    check('Building 1 saved the move in its file', JSON.parse(b1)._overlays?.lots?.L100?.currentRoom?.value === 'Grow A');

    // ---- Unsaved changes: asked first ----
    await b.run(main, `DB.data._DailyWizard.buildings.B1.note = 'not saved'; markUnsaved();`);
    let r = await switchTo('B2', { ok: false });
    check('with unsaved changes it asks first; Cancel stays on Building 1 and keeps them', r.role === 'B1' && /Building 1 has changes that aren't saved/.test(r.asked[0] || '') &&
        r.unsaved && await b.run(main, `return DB.data._DailyWizard.buildings.B1.note === 'not saved';`), JSON.stringify(r));
    r = await switchTo('B2');
    check('switching anyway: the device is Building 2', r.role === 'B2', JSON.stringify(r));
    check('…the page\'s address says so (a reload stays on it)', /device=B2/.test(r.search), r.search);
    check('…the files were reopened from what was saved: the unsaved change is gone, the saved move is there', await b.run(main,
        `return DB.data._DailyWizard.buildings.B1.note === undefined && DB.data.lots.L100.currentRoom === 'Grow A';`));
    const picked = await b.run(main, `return Object.values(DB.data._LotTransfers || {}).filter(t => t.lotId === 'L100' && t.to === 'B2' && t.acceptedAt).length;`);
    check('…and Building 2 picked the lot up', picked === 1, picked);
    check('…which is to be saved', r.unsaved === true);
    const saved = await saveSplit(b, main);
    check('Building 2 saves its own file (nothing it can\'t save)', Object.keys(saved).join() === 'Building-B2.json' && r.alerts.length === 0, Object.keys(saved).join() + ' ' + r.alerts.join(' | '));
    const b2 = JSON.parse(saved['Building-B2.json']);
    check('…holding the pickup and the lot\'s grow log', Object.values(b2._LotTransfers || {}).some(t => t.lotId === 'L100') && !!b2._PaperWizard?.entries?.L100?.glog,
        JSON.stringify(Object.keys(b2._PaperWizard?.entries || {})));
    await b.run(main, `closeSavePopup();`);
    r = await switchTo('B2');
    check('picking the same device again reopens nothing', r.role === 'B2' && !r.unsaved && r.asked.length === 0);

    // ---- The office: wages stay with the office ----
    await openSplit(b, main, BASE, 'office', files);
    check('the office has wages', await b.run(main, `return DbSplit.haveWages && DB.data._EmployeeWizard.employees.Alex.wage === 20;`));
    r = await switchTo('B1');
    check('office → Building 1: no wages on a building', r.role === 'B1' && await b.run(main, `return !DbSplit.haveWages && DB.data._EmployeeWizard.employees.Alex.wage == null;`), JSON.stringify(r));
    r = await switchTo('office');
    const back = await b.run(main, `const p = DbSplit.plan(); return { wages: DbSplit.haveWages, offered: [...p.toSave, ...p.unchanged].join() };`);
    check('…back to the office: Wages.json has to be loaded again', r.role === 'office' && !back.wages && back.offered === 'Main.json', JSON.stringify(back));

    // ---- A session restored after a crash keeps no copy of the files ----
    await b.run(main, `const s = DbSplit.exportState(); DbSplit.importState(s);`);
    r = await switchTo('B2');
    check('a restored session says why it can\'t reopen the files, and to open them with 📂 Load DB',
        r.role === 'B2' && /^This session was restored, so its files aren't in memory\. To finish switching to Building 2, open them again with 📂 Load DB\.$/.test(r.alerts[0] || '') &&
        /device=B2/.test(r.search), JSON.stringify(r));

    // ---- …and after a restore the office saved only Main: still no full copy, so nothing is reopened without the building files ----
    await openSplit(b, main, BASE, 'office', files);
    await b.run(main, `const s = DbSplit.exportState(); DbSplit.importState(s); DB.data.lots.L100.name = 'Renamed'; markUnsaved();`);
    const officeSaved = await saveSplit(b, main);
    await b.run(main, `closeSavePopup();`);
    r = await switchTo('B1');
    check('a restored office that saved Main says to open the files…', Object.keys(officeSaved).join() === 'Main.json' && r.role === 'B1' &&
        /This session was restored/.test(r.alerts[0] || ''), Object.keys(officeSaved).join() + ' ' + JSON.stringify(r));
    check('…and keeps the building files\' paperwork (not reopened from Main alone)', await b.run(main, `return !!DB.data._PaperWizard?.entries?.L100?.glog;`));

    // ---- Right after the split, before its files are saved: nothing to reopen, so it stays the office ----
    main = await fresh(b);
    await openSitka(b, main, BASE, 'office');
    await loadSingle(b, main, fixtureDb());
    await b.run(main, `window.alert = () => {}; window.confirm = () => true; await DbSplit.splitLegacy(); closeSavePopup();`, { user: true });
    r = await switchTo('B1');
    check('the split\'s files not saved yet: refused, still the office, nothing asked',
        r.role === 'office' && r.asked.length === 0 && /aren't saved yet, so the files can't be reopened as Building 1\.\n\n💾 Save DB first/.test(r.alerts[0] || '') &&
        !/device=B1/.test(r.search), JSON.stringify(r));
    await leave(b, main);
    return results;
}
