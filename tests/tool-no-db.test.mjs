// A tool can never wipe SitkaTools' database (cost audit 2026-10-26: found when a tool saved before its DB arrived and sent
// an empty one back, and SitkaTools took it):
// - a tool sends nothing back until it has its database (notifySitkaTools, the same in every tool);
// - SitkaTools ignores updates from a tool window that hasn't said it got the database (sitkaGit_ready);
// - refuses an update — by postMessage or the shared working copy — with none of its lots, rooms, buildings or events,
//   sending the tool the current database instead;
// - and when a tool's copy is a moment behind (a lot made in SitkaTools it hasn't seen yet), takes its change and keeps
//   the lot: tools never remove lots, rooms or buildings.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, newTab, leave } from './lib/helpers.mjs';

export const title = 'a tool can never wipe SitkaTools\' database (no DB yet, not ready, or missing lots)';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    const lots = () => b.run(main, `return Object.keys(DB.data.lots).sort().join();`);
    const toast = () => b.run(main, `return document.getElementById('syncToast')?.textContent || '';`);

    // ---- A tool sends nothing back before its database arrives ----
    const ew = await openTool(b, main, 'EmployeeWizard');
    const sent = await b.run(ew, `const keep = { got: WorkCopy.gotDb, inUse: WorkCopy.inUse, data: DB.data };
        WorkCopy.gotDb = false; WorkCopy.inUse = false; DB.data = { lots: {}, rooms: {}, buildings: {}, calendarEvents: [] };
        let posted = 0; const real = window.opener.postMessage.bind(window.opener); window.opener.postMessage = (...a) => { posted++; return real(...a); };
        notifySitkaTools();
        window.opener.postMessage = real; Object.assign(WorkCopy, { gotDb: keep.got, inUse: keep.inUse }); DB.data = keep.data;
        return posted;`);
    await b.sleep(300);
    check('a tool that hasn\'t got its database sends nothing back', sent === 0 && (await lots()) === 'L100,L200', `${sent} sent · lots ${await lots()}`);

    // ---- SitkaTools refuses an update that would remove lots, rooms or buildings ----
    await b.run(ew, `window.opener.postMessage({ type: 'sitkaGit_db_update', payload: { lots: {}, rooms: {}, buildings: {}, calendarEvents: [] } }, '*');`);
    await b.sleep(400);
    check('an update without the lots, rooms and buildings is refused: nothing is lost', (await lots()) === 'L100,L200' && await b.run(main, `return Object.keys(DB.data.rooms).length === 3 && !hasUnsavedChanges;`), await lots());
    check('…SitkaTools says so', /was ignored: it had none of the database's lots, rooms, buildings or events/.test(await toast()), await toast());
    check('…and the tool is sent the current database', await b.waitFor(ew, `return Object.keys(DB.data.lots || {}).length === 2;`).then(() => true, () => false));
    // One lot short (its copy a moment behind a lot made in SitkaTools): its change is taken, and the lot kept
    await b.run(ew, `const d = JSON.parse(JSON.stringify(DB.data)); delete d.lots.L200; d._EmployeeWizard.settings = { ...(d._EmployeeWizard.settings || {}), shiftHours: 7 };
        window.opener.postMessage({ type: 'sitkaGit_db_update', payload: d }, '*');`);
    await b.sleep(400);
    check('an update one lot short (a copy a moment behind): its change is taken and the lot kept', (await lots()) === 'L100,L200' && await b.run(main, `return DB.data._EmployeeWizard.settings.shiftHours === 7;`), await lots());
    check('…and the tool gets the lot back', await b.waitFor(ew, `return !!DB.data.lots?.L200 && DB.data._EmployeeWizard.settings.shiftHours === 7;`).then(() => true, () => false));
    // A normal update still goes through
    await b.run(ew, `DB.data._EmployeeWizard.settings = { ...(DB.data._EmployeeWizard.settings || {}), shiftHours: 9 }; notifySitkaTools();`);
    check('a normal update still goes through', await b.waitFor(main, `return DB.data._EmployeeWizard?.settings?.shiftHours === 9;`).then(() => true, () => false));

    // ---- SitkaTools ignores updates from a window that hasn't said it got the database ----
    await b.run(main, `openSubtools.forEach(w => { w.ready = false; });`);
    await b.run(ew, `DB.data._EmployeeWizard.settings.shiftHours = 10; notifySitkaTools();`);
    await b.sleep(400);
    check('an update from a window that hasn\'t acknowledged the database is ignored', await b.run(main, `return DB.data._EmployeeWizard.settings.shiftHours === 9;`));
    await b.run(main, `openSubtools.forEach(w => { w.ready = true; });`);
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });

    // ---- The shared working copy (a tablet tab): refused too, and the copy put back ----
    await b.run(main, `await WorkCopy.flush();`);
    const tab = await newTab(b, `${BASE}/EmployeeWizard/EmployeeWizard.html`);
    await b.waitFor(tab, `return typeof DB !== "undefined" && WorkCopy.inUse && Object.keys(DB.data?.lots || {}).length === 2;`);
    await b.run(tab, `DB.data = { lots: {}, rooms: {}, buildings: {}, calendarEvents: [] }; notifySitkaTools();`);
    await b.sleep(800);
    check('a tablet tab\'s empty copy is refused: nothing is lost', (await lots()) === 'L100,L200' && await b.run(main, `return DB.data.calendarEvents.length > 0;`), await lots());
    check('…and the tab gets the current database back', await b.waitFor(tab, `return Object.keys(DB.data?.lots || {}).length === 2;`).then(() => true, () => false));
    await leave(b, tab); await b.send('browsingContext.close', { context: tab });

    await leave(b, main);
    return results;
}
