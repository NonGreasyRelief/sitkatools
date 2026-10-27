// Hours on one task from two devices between saves: the office's and a building's entries merge one by one.
// Removals stay removed, the newer edit wins, a building's updates shrink once Main holds them, and files saved
// by the previous build (whole-list updates, entries without ids) still open the way they did.
import { today, fixtureDb, withFloorManager, makeChecker, fresh, splitFiles, openSplit, saveSplit, openTool, dwBuilding, logHours, removeHoursOf, ewSetHours, evNames, leave } from './lib/helpers.mjs';

export const title = 'office + building hours on the same task (entry-by-entry merge)';

export async function run(b, BASE) {
    // Two SitkaTools pages in one browser stand in for the office and Building 1. A page opened while the other is open says
    // "SitkaTools is already open in another tab", and that card covers its tool overlay: OK it, as a person would
    const openFiles = async (b, ctx, ...args) => {
        const out = await openSplit(b, ctx, ...args);
        await b.waitFor(ctx, `return WorkCopy.ready;`);
        await b.run(ctx, `if (!document.getElementById('restoreOverlay').classList.contains('hidden')) document.getElementById('restoreOkBtn').click(); return null;`, { user: true });
        return out;
    };
    const { results, check } = makeChecker();
    const T = today();
    const office = await fresh(b);
    const files = await splitFiles(b, office, BASE, withFloorManager(fixtureDb()));   // Casey approves removals with her PIN
    const cropOn = async (ctx) => evNames(await b.run(ctx, 'return DB.data;'), 'ev_cropb1', T).sort().join(',');
    const entryOf = async (ctx, name) => b.run(ctx, `return (DB.data.calendarEvents.find(e => e.id === 'ev_cropb1').labour_map?.['${T}'] || []).find(e => e.employee === ${JSON.stringify(name)}) || null;`);
    let disk = { ...files };   // the files in the shared folder

    // A. The office has the files open; Building 1 logs and saves first; then the office logs on the same task and saves
    await openFiles(b, office, BASE, 'office', disk);
    let dwO = await openTool(b, office, 'DailyWizard');
    await dwBuilding(b, dwO, 'B1');
    const b1 = (await b.send('browsingContext.create', { type: 'window' })).context;
    await openFiles(b, b1, BASE, 'B1', disk);
    let dwB = await openTool(b, b1, 'DailyWizard');
    await logHours(b, dwB, 'Leaf Pick', 'Casey', 2, 0);
    await b.sleep(300);
    Object.assign(disk, await saveSplit(b, b1));
    await logHours(b, dwO, 'Leaf Pick', 'Drew', 1, 0);
    await b.sleep(300);
    const s2 = await saveSplit(b, office);
    check('A. office saves Main.json', !!s2['Main.json'], Object.keys(s2).join(', '));
    Object.assign(disk, s2);
    await openFiles(b, office, BASE, 'office', disk);
    check('A. both entries kept: Casey (Building 1) and Drew (office)', (await cropOn(office)) === 'Casey,Drew', await cropOn(office));

    // B. The office removes Building 1's entry; Building 1's still-open session then logs more and saves
    dwO = await openTool(b, office, 'DailyWizard');
    await dwBuilding(b, dwO, 'B1');
    const rm = await removeHoursOf(b, dwO, 'Leaf Pick', 'Casey');
    check('B. office removed Casey\'s entry', rm.startsWith('Entry removed'), rm);
    await b.sleep(300);
    const s3 = await saveSplit(b, office);
    Object.assign(disk, s3);
    const stamps = JSON.parse(disk['Main.json'])._fieldStamps;
    check('B. Main.json records the removal', Object.keys(stamps.labourRemoved?.ev_cropb1 || {}).length === 1, JSON.stringify(stamps.labourRemoved));
    await logHours(b, dwB, 'Leaf Pick', 'Alex', 0, 30);   // Building 1 never reopened: it still has Casey
    await b.sleep(300);
    Object.assign(disk, await saveSplit(b, b1));
    await openFiles(b, office, BASE, 'office', disk);
    check('B. Casey stays removed; Alex (Building 1, later) is added', (await cropOn(office)) === 'Alex,Drew', await cropOn(office));

    // C. The office corrects Building 1's signed entry in EmployeeWizard; Building 1's old session saves again
    const ew = await openTool(b, office, 'EmployeeWizard');
    const toast = await ewSetHours(b, ew, 'L100', 'ev_cropb1', T, 'Alex', 0, 45);
    check('C. EmployeeWizard updated Alex to 45m', toast.startsWith('Updated Alex'), toast);
    await b.sleep(300);
    const alexO = await entryOf(office, 'Alex');
    check('C. the signed entry keeps a record of the hours as signed', alexO?.hours === 0.75 && alexO.signedHours === 0.5 && !!alexO.editedAt && alexO.initials?.strokes?.length === 2, JSON.stringify(alexO && { hours: alexO.hours, signedHours: alexO.signedHours, editedAt: alexO.editedAt }));
    Object.assign(disk, await saveSplit(b, office));
    await b.send('browsingContext.close', { context: ew });
    await logHours(b, dwB, 'Water plants', 'Blair', 1, 0);   // any change, from the old session (Alex still 30m there)
    await b.sleep(300);
    Object.assign(disk, await saveSplit(b, b1));
    await openFiles(b, office, BASE, 'office', disk);
    const alex2 = await entryOf(office, 'Alex');
    check('C. the office\'s newer correction wins over the old session\'s copy', alex2?.hours === 0.75, JSON.stringify(alex2?.hours));

    // D. Building 1 reopens and removes its own entry the same day (Main already holds it)
    await leave(b, dwB);
    await openFiles(b, b1, BASE, 'B1', disk);
    dwB = await openTool(b, b1, 'DailyWizard');
    const rm2 = await removeHoursOf(b, dwB, 'Leaf Pick', 'Alex');
    check('D. Building 1 removed its own entry (same day)', rm2.startsWith('Entry removed'), rm2);
    await b.sleep(300);
    const s7 = await saveSplit(b, b1);
    Object.assign(disk, s7);
    const ov7 = JSON.parse(s7['Building-B1.json'])._overlays.events.ev_cropb1?.labour_map;
    check('D. Building-B1.json records the removal', Object.keys(ov7?.removed || {}).length === 1, JSON.stringify(ov7?.removed));
    await openFiles(b, office, BASE, 'office', disk);
    check('D. the office no longer sees Alex', (await cropOn(office)) === 'Drew', await cropOn(office));

    // E. Once Main holds the result, Building 1's update for the task shrinks away
    dwO = await openTool(b, office, 'DailyWizard');
    await dwBuilding(b, dwO, 'B2');
    await logHours(b, dwO, 'Defoliate', 'Drew', 0, 15);   // an office change, so Main is saved
    await b.sleep(300);
    Object.assign(disk, await saveSplit(b, office));
    await leave(b, dwB);
    await openFiles(b, b1, BASE, 'B1', disk);
    dwB = await openTool(b, b1, 'DailyWizard');
    await logHours(b, dwB, 'Scout rooms', 'Casey', 0, 20);
    await b.sleep(300);
    const s9 = await saveSplit(b, b1);
    Object.assign(disk, s9);
    const ov9 = JSON.parse(s9['Building-B1.json'])._overlays.events;
    check('E. Building-B1.json no longer carries an update for the task', !ov9.ev_cropb1?.labour_map, JSON.stringify(ov9.ev_cropb1));
    await openFiles(b, office, BASE, 'office', disk);
    check('E. the office still sees just Drew', (await cropOn(office)) === 'Drew', await cropOn(office));
    await leave(b, dwB);
    await b.send('browsingContext.close', { context: b1, promptUnload: false });

    // F. Files saved by the previous build: whole-list updates, entries without ids
    const main = JSON.parse(files['Main.json']);
    const bf = JSON.parse(files['Building-B2.json']);
    main.calendarEvents.find(e => e.id === 'ev_cropb2').labour_map = { [T]: [{ employee: 'Drew', hours: 1 }] };
    const old = { value: { [T]: [{ employee: 'Blair', hours: 2, at: `${T}T15:00:00.000Z`, by: 'B2', initials: { name: 'Blair', strokes: [[0.1, 0.1, 0.5, 0.5]] } }] }, at: 2000 };
    bf._overlays.events.ev_cropb2 = { labour_map: old };
    const open = async (officeStamp) => {
        main._fieldStamps = { lots: {}, events: { ev_cropb2: { labour_map: officeStamp } } };
        await openFiles(b, office, BASE, 'office', { ...files, 'Main.json': JSON.stringify(main), 'Building-B2.json': JSON.stringify(bf) });
        return evNames(await b.run(office, 'return DB.data;'), 'ev_cropb2', T).sort().join(',');
    };
    check('F. an older update newer than the office\'s edit: both lists kept', (await open(1000)) === 'Blair,Drew', await open(1000));
    check('F. an older update the office has edited since: the office\'s list (as before)', (await open(3000)) === 'Drew', await open(3000));
    check('F. entries without ids get them on opening', await b.run(office, `return DB.data.calendarEvents.find(e => e.id === 'ev_cropb2').labour_map['${T}'].every(e => /^le_/.test(e.id));`));
    check('F. opening older files changes nothing by itself', (await b.run(office, 'return hasUnsavedChanges;')) === false);
    await leave(b, office);
    return results;
}
