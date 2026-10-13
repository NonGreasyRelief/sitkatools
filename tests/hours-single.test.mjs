// Laptop, one DB file: hours logged in a DailyWizard popup reach SitkaTools, the saved file, and come back on reload.
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, saveSingle, openTool, dwBuilding, dwButton, logHours, evNames, choreNames } from './lib/helpers.mjs';

export const title = 'laptop popup, single DB file';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today(), Y = today(-1);
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());

    // Older entries get an id derived from their content: the same on every load
    const id1 = await b.run(main, `return DB.data.calendarEvents.find(e => e.id === 'ev_oldb1').labour_map['${Y}'][0].id;`);
    await loadSingle(b, main, fixtureDb());
    const id2 = await b.run(main, `return DB.data.calendarEvents.find(e => e.id === 'ev_oldb1').labour_map['${Y}'][0].id;`);
    check('an older entry without an id gets the same derived id on every load', /^le_/.test(id1) && id1 === id2, `${id1} / ${id2}`);

    const dw = await openTool(b, main, 'DailyWizard');
    check('DailyWizard got the DB by postMessage', await b.run(dw, 'return WorkCopy.gotDb && !WorkCopy.inUse;'));
    await dwBuilding(b, dw, 'B1');
    const r = [
        await logHours(b, dw, 'Water plants', 'Alex', 1, 15),
        await logHours(b, dw, 'Clean fans', 'Blair', 0, 45),
        await logHours(b, dw, 'Leaf Pick', 'Casey', 2, 0),
        await logHours(b, dw, 'Water plants', null, 0, 30, { temp: 'Temp Tess' })
    ];
    check('logged a chore, an equipment task, a crop task and a temp', r.every(x => x.ok), r.map(x => x.toast).join(' | '));
    const dwIds = await b.run(dw, `return DB.data._DailyWizard.buildings.B1.labour['${T}'].wat1.map(e => e.id);`);
    check('new entries carry an id', dwIds.every(id => /^le_[a-z0-9]{10}$/.test(id)), dwIds.join(', '));
    await b.sleep(400);

    const st = await b.run(main, 'return { db: DB.data, unsaved: hasUnsavedChanges };');
    check('SitkaTools received the chore hours', choreNames(st.db, 'B1', 'wat1', T).join() === 'Alex,Temp Tess');
    check('SitkaTools received the equipment hours', evNames(st.db, 'ev_equipb1', T).join() === 'Blair');
    check('SitkaTools received the crop hours', evNames(st.db, 'ev_cropb1', T).join() === 'Casey');
    check('SitkaTools marked the DB unsaved', st.unsaved === true);
    check('no "lost link" cover on a working popup', !(await b.run(dw, `return document.getElementById('linkLost')?.style.display === 'flex';`)));

    const saved = JSON.parse(await saveSingle(b, main));
    const chores = saved._DailyWizard.buildings.B1.labour[T].wat1;
    check('saved file: chore entries with initials, time, device and id', chores.length === 2 && chores.every(e => e.initials?.strokes?.length === 2 && e.at && e.by === 'office' && e.id));
    check('saved file: equipment hours', saved.calendarEvents.find(e => e.id === 'ev_equipb1').labour_map[T][0].hours === 0.75);
    check('saved file: crop hours', saved.calendarEvents.find(e => e.id === 'ev_cropb1').labour_map[T][0].hours === 2);
    check('unsaved flag cleared once the save link is used', (await b.run(main, 'return hasUnsavedChanges;')) === false);

    await b.send('browsingContext.close', { context: dw });
    await openSitka(b, main, BASE);
    await loadSingle(b, main, saved);
    const dw2 = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw2, 'B1');
    check('after reopening: Water plants shows 1h 45m', (await dwButton(b, dw2, 'Water plants')) === '⏱ 1h 45m');
    check('after reopening: Clean fans shows 45m', (await dwButton(b, dw2, 'Clean fans')) === '⏱ 45m');
    check('after reopening: Leaf Pick shows 2h', (await dwButton(b, dw2, 'Leaf Pick')) === '⏱ 2h');
    await b.send('browsingContext.close', { context: dw2 });
    return results;
}
