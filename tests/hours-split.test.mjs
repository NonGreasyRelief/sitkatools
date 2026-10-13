// Split files: a building device logs hours and saves only its own file; the office reopens everything and sees them.
// A tablet tab (no popup) hands its hours to SitkaTools through the shared working copy.
import { today, fixtureDb, makeChecker, fresh, splitFiles, openSplit, saveSplit, saveSingle, openSitka, loadSingle, openTool, newTab, dwBuilding, logHours, evNames, choreNames, leave } from './lib/helpers.mjs';

export const title = 'building device + split files, and a tablet tab';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today();
    let main = await fresh(b);
    const files = await splitFiles(b, main, BASE, fixtureDb());
    check('split files made', ['Main.json', 'Wages.json', 'Building-B1.json', 'Building-B2.json'].every(n => files[n]), Object.keys(files).join(', '));

    // ---- Building 1's device ----
    check('B1 device opened Main + building files', await openSplit(b, main, BASE, 'B1', files));
    const dw = await openTool(b, main, 'DailyWizard');
    check('DailyWizard is locked to Building 1', (await b.run(dw, `return document.getElementById('buildingSelect').value;`)) === 'B1');
    const r = [await logHours(b, dw, 'Water plants', 'Alex', 1, 15), await logHours(b, dw, 'Clean fans', 'Blair', 0, 45), await logHours(b, dw, 'Leaf Pick', 'Casey', 2, 0)];
    check('B1 logged chore, equipment and crop hours', r.every(x => x.ok), r.map(x => x.toast).join(' | '));
    check('entries are stamped by: "B1"', (await b.run(dw, `return DB.data._DailyWizard.buildings.B1.labour['${T}'].wat1[0].by;`)) === 'B1');
    await b.sleep(400);
    const s1 = await saveSplit(b, main);
    check('B1 saves only Building-B1.json', Object.keys(s1).join() === 'Building-B1.json', Object.keys(s1).join(', '));
    check('no "can\'t be saved from this device" warning', !b.logs.some(l => l.includes("can't be saved")));
    const bf = JSON.parse(s1['Building-B1.json']);
    check('Building-B1.json: chore hours with initials', bf._DailyWizard.buildings.B1.labour[T].wat1[0].initials.strokes.length === 2);
    const ovCrop = bf._overlays.events.ev_cropb1?.labour_map;
    const cropId = ovCrop?.value?.[T]?.[0]?.id;
    check('Building-B1.json: crop hours as an entry-by-entry update', !!cropId && ovCrop.entries?.[cropId] > 0 && ovCrop.removed && Object.keys(ovCrop.removed).length === 0, JSON.stringify(ovCrop?.entries));
    check('Building-B1.json: equipment hours as an update', bf._overlays.events.ev_equipb1?.labour_map?.value?.[T]?.[0]?.employee === 'Blair');
    check('B1: nothing left unsaved', (await b.run(main, 'return hasUnsavedChanges;')) === false);
    await b.send('browsingContext.close', { context: dw });

    // ---- The office reopens everything ----
    const files2 = { ...files, ...s1 };
    check('office opened all files', await openSplit(b, main, BASE, 'office', files2));
    const off = await b.run(main, 'return DB.data;');
    check('office sees B1 chore hours', choreNames(off, 'B1', 'wat1', T).join() === 'Alex');
    check('office sees B1 equipment hours', evNames(off, 'ev_equipb1', T).join() === 'Blair');
    check('office sees B1 crop hours', evNames(off, 'ev_cropb1', T).join() === 'Casey');
    check('opening changes nothing (no unsaved changes)', (await b.run(main, 'return hasUnsavedChanges;')) === false);
    await leave(b, main);

    // ---- Tablet tab: DailyWizard as a tab of its own, through the shared working copy ----
    main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    await b.run(main, 'await WorkCopy.flush();');
    const tab = await newTab(b, `${BASE}/DailyWizard/DailyWizard.html`);
    await b.waitFor(tab, 'return typeof DB !== "undefined" && !!DB.data && Object.keys(DB.data.lots || {}).length > 0;');
    check('tablet tab: DailyWizard loaded the shared copy', await b.run(tab, 'return WorkCopy.inUse && !!document.getElementById("workCopyBanner");'));
    await dwBuilding(b, tab, 'B1');
    const t1 = await logHours(b, tab, 'Water plants', 'Alex', 0, 50);
    check('tablet tab: logged Alex 50m', t1.ok, t1.toast);
    await b.sleep(1200);
    const st = await b.run(main, `return { names: (DB.data._DailyWizard.buildings.B1.labour?.['${T}']?.wat1 || []).map(e => e.employee), unsaved: hasUnsavedChanges };`);
    check('tablet tab: SitkaTools took the hours in and marked unsaved', st.names.join() === 'Alex' && st.unsaved, JSON.stringify(st));
    await b.run(tab, 'LinkLost.check();');
    await b.sleep(300);
    check('tablet tab: never shows the "lost link" cover', !(await b.run(tab, `return document.getElementById('linkLost')?.style.display === 'flex';`)));
    await b.run(tab, `document.getElementById('workCopyGoBack').click();`, { user: true });
    await b.sleep(1000);
    check('tablet tab: "Go back to SitkaTools to save" asks for a save', await b.run(main, `return document.body.innerText.includes('Save before you continue');`));
    const saved = JSON.parse(await saveSingle(b, main));
    check('tablet tab: the saved file holds the entry', saved._DailyWizard.buildings.B1.labour[T].wat1[0].employee === 'Alex');
    await leave(b, tab);
    await leave(b, main);
    return results;
}
