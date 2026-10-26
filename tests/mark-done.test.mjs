// DailyWizard: "⏰ Still open" lists a building's past crop / equipment tasks not yet done, hours can still be logged on
// them, and the floor manager signs tasks off with "✍️ Mark done" (name + drawn initials).
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, saveSingle, splitFiles, openSplit, saveSplit, openTool,
    dwBuilding, dwDate, logHours, markDone, dwStillOpen, dwDoneButton, evNames, leave } from './lib/helpers.mjs';

export const title = 'DailyWizard Still open + floor-manager Mark done';

const ev = (b, ctx, id) => b.run(ctx, `return DB.data.calendarEvents.find(e => e.id === ${JSON.stringify(id)}) || null;`);

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today(), Y = today(-1), Y2 = today(-2);
    let main = await fresh(b);
    await openSitka(b, main, BASE);
    const db = fixtureDb();
    db.calendarEvents.find(e => e.id === 'ev_doneb1').completedBy = { name: 'Drew', initials: { name: 'Drew', strokes: [[0.1, 0.5, 0.9, 0.5]] }, at: `${Y2}T18:00:00.000Z`, by: 'B1', day: Y2 };
    await loadSingle(b, main, db);
    let dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');

    // ⏰ Still open
    let open = await dwStillOpen(b, dw);
    check('Still open: the overdue Room Tidy, nothing done, nothing from Building 2', open.length === 1 && open[0].includes('Room Tidy') && open[0].includes('1 day overdue'), JSON.stringify(open));
    const r1 = await logHours(b, dw, 'Room Tidy', 'Casey', 1, 0);
    check('hours logged on an overdue task go on today', r1.ok && evNames(await b.run(main, 'return DB.data;'), 'ev_oldb1', T).join() === 'Casey', r1.toast);
    check('…and its earlier hours stay on their own day', evNames(await b.run(main, 'return DB.data;'), 'ev_oldb1', Y).join() === 'Drew');
    await dwBuilding(b, dw, 'ALL');
    const byBuilding = await b.run(dw, `return [...document.querySelectorAll('#listContainer .building-section')].map(sec => {
        const out = []; let inOpen = false;
        for (const el of sec.children) {
            if (el.classList.contains('section-divider')) { inOpen = el.classList.contains('overdue'); continue; }
            if (inOpen && el.classList.contains('task-row')) out.push(el.textContent);
        }
        return out; });`);
    check('All Buildings: each building\'s section has its own Still open (Room Tidy in B1, Strip Fans in B2)',
        byBuilding[0]?.length === 1 && byBuilding[0][0].includes('Room Tidy') && byBuilding[1]?.length === 1 && byBuilding[1][0].includes('Strip Fans'), JSON.stringify(byBuilding));
    await dwBuilding(b, dw, 'B1');

    // ✍️ Mark done — checks first
    const noName = await markDone(b, dw, 'Room Tidy', '');
    check('Mark done needs the floor manager\'s name', noName.toast === 'Pick the floor manager', noName.toast);
    check('no floor managers set yet: everyone on the roster is offered', noName.options.join() === 'Alex,Blair,Casey,Drew', noName.options.join());
    const noSign = await markDone(b, dw, 'Room Tidy', 'Blair', { sign: false });
    check('Mark done needs their drawn initials', noSign.toast.startsWith('The floor manager draws their initials'), noSign.toast);
    const d1 = await markDone(b, dw, 'Room Tidy', 'Blair');
    check('the floor manager signed Room Tidy off', d1.ok, d1.toast);
    open = await dwStillOpen(b, dw);
    check('…and it left Still open', open.length === 0, JSON.stringify(open));
    const e1 = await ev(b, main, 'ev_oldb1');
    check('SitkaTools has completed + the sign-off (name, initials, time, device, day)', e1.completed === true && e1.completedBy?.name === 'Blair' &&
        e1.completedBy.initials?.strokes?.length === 1 && !!e1.completedBy.at && e1.completedBy.by === 'office' && e1.completedBy.day === T, JSON.stringify(e1.completedBy && { ...e1.completedBy, initials: '…' }));
    const d2 = await markDone(b, dw, 'Leaf Pick', 'Alex');
    check('a task due today can be signed off too', d2.ok && (await dwDoneButton(b, dw, 'Leaf Pick')) === '✅ Done', d2.toast);
    await b.run(main, `Calendar.selectEvent(DB.data.calendarEvents.find(e => e.id === 'ev_cropb1'));`);
    const label = await b.run(main, `return document.getElementById('completedLabel')?.textContent || '';`);
    check('SitkaTools\' event panel shows who signed it off', label.startsWith('Completed — signed off by Alex'), label);
    const saved = JSON.parse(await saveSingle(b, main));
    check('the saved file holds the sign-off', saved.calendarEvents.find(e => e.id === 'ev_cropb1').completedBy?.name === 'Alex');

    // Reopen the same day (no record), and after its day (kept on record)
    await b.run(dw, `[...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Leaf Pick')).querySelector('.done-btn').click();`, { user: true });
    await b.run(dw, `document.getElementById('doneReopenBtn').click();`, { user: true });
    await b.run(dw, 'closeDone();');
    const e2 = await ev(b, main, 'ev_cropb1');
    check('office reopened today\'s sign-off: not done, sign-off gone, nothing on record', e2.completed === false && !e2.completedBy &&
        !(await b.run(main, `return (DB.data._DailyWizard.buildings.B1.adjustments || []).length;`)), JSON.stringify({ completed: e2.completed, by: e2.completedBy }));
    await dwDate(b, dw, Y2);
    check('an older sign-off shows ✅ Done on its day', (await dwDoneButton(b, dw, 'Top Dress')) === '✅ Done');
    await b.run(dw, `[...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Top Dress')).querySelector('.done-btn').click();`, { user: true });
    await b.run(dw, `document.getElementById('doneReopenBtn').click();`, { user: true });
    await b.run(dw, 'closeDone();');
    const adj = await b.run(main, `return DB.data._DailyWizard.adjustments || [];`);
    check('office reopened an older sign-off: kept on record in Main (the office never writes a building\'s file)', adj.length === 1 && adj[0].eventId === 'ev_doneb1' && adj[0].reopened?.name === 'Drew' && !adj[0].entry
        && !(await b.run(main, `return (DB.data._DailyWizard.buildings.B1.adjustments || []).length;`)), JSON.stringify(adj));
    await dwDate(b, dw, T);
    open = await dwStillOpen(b, dw);
    check('…and the reopened task is back in Still open', open.some(t => t.includes('Top Dress')), JSON.stringify(open));
    await b.run(dw, `[...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Top Dress')).querySelector('.hours-btn').click();`, { user: true });
    check('the reopen record doesn\'t show as an hours entry', (await b.run(dw, `return document.querySelectorAll('#hoursList .hours-entry').length;`)) === 0);
    await b.run(dw, 'closeHours();');

    // Floor managers set in EmployeeWizard
    const ew = await openTool(b, main, 'EmployeeWizard');
    await b.run(ew, `selectEmployee('Casey'); document.getElementById('empFloorManager').click(); document.getElementById('saveEmpBtn').click();`, { user: true });
    await b.sleep(400);
    check('EmployeeWizard: Casey ticked as floor manager', (await b.run(main, `return DB.data._EmployeeWizard.employees.Casey.floorManager;`)) === true);
    const d3 = await markDone(b, dw, 'Leaf Pick', 'Casey');
    check('Mark done offers only the floor managers', d3.options.join() === 'Casey' && d3.ok, d3.options.join());
    // Reopening elsewhere clears the sign-off
    await b.run(ew, `document.getElementById('tabTasks').click(); const l = document.getElementById('activeLot'); l.value = 'L100'; l.dispatchEvent(new Event('change'));
        TASK.selectedKey = 'ev_cropb1'; TASK.editDate = '${T}'; renderTasksTab(); document.getElementById('teCompleteBtn').click();`, { user: true });
    await b.sleep(300);
    const e3 = await ev(b, main, 'ev_cropb1');
    check('reopening in EmployeeWizard\'s Tasks tab clears the sign-off', e3.completed === false && !e3.completedBy);
    await markDone(b, dw, 'Leaf Pick', 'Casey');
    await b.run(main, `Calendar.selectEvent(DB.data.calendarEvents.find(e => e.id === 'ev_cropb1')); document.getElementById('completedCheckbox').click();`);
    const e4 = await ev(b, main, 'ev_cropb1');
    check('un-ticking Completed in SitkaTools clears the sign-off', e4.completed === false && !e4.completedBy);

    // Regenerating a schedule keeps the sign-off (CropLabourWizard / EquipmentWizard carry it over)
    for (const tool of ['CropLabourWizard', 'EquipmentWizard']) {
        const ctx = await openTool(b, main, tool);
        const kept = await b.run(ctx, `const prev = [{ taskType: 'x', completed: true, completedBy: { name: 'Casey' } }], fresh = [{ taskType: 'x' }];
            carryOverAnnotations(prev, fresh, e => e.taskType); return fresh[0].completedBy?.name || null;`);
        check(`${tool}: regenerating keeps the sign-off`, kept === 'Casey', String(kept));
        await leave(b, ctx);
        await b.send('browsingContext.close', { context: ctx });
    }
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });
    await leave(b, dw); await b.send('browsingContext.close', { context: dw });

    // ---- Split files: a building device signs off and saves it in its own file ----
    const files = await splitFiles(b, main, BASE, fixtureDb());
    await openSplit(b, main, BASE, 'office', files);
    dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    await markDone(b, dw, 'Room Tidy', 'Blair');
    await b.sleep(300);
    const disk = { ...files, ...(await saveSplit(b, main)) };
    await leave(b, dw);
    await openSplit(b, main, BASE, 'B1', disk);
    dw = await openTool(b, main, 'DailyWizard');
    await dwDate(b, dw, T);
    const d4 = await markDone(b, dw, 'Leaf Pick', 'Casey');
    check('B1 device: signed Leaf Pick off', d4.ok, d4.toast);
    await b.run(dw, `[...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Leaf Pick')).querySelector('.done-btn').click();`, { user: true });
    check('B1 device: may reopen its own sign-off today', await b.run(dw, `return !!document.getElementById('doneReopenBtn');`));
    await b.run(dw, 'closeDone();');
    await dwDate(b, dw, Y);
    await b.run(dw, `[...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Room Tidy')).querySelector('.done-btn').click();`, { user: true });
    check('B1 device: may not reopen the office\'s sign-off', await b.run(dw, `return document.getElementById('doneOverlay').classList.contains('open') && !document.getElementById('doneReopenBtn');`));
    await b.run(dw, 'closeDone();');
    await b.sleep(300);
    const s = await saveSplit(b, main);
    const ov = JSON.parse(s['Building-B1.json'] || '{}')._overlays?.events?.ev_cropb1;
    check('B1 device: saves only its own file, with completed + the sign-off', Object.keys(s).join() === 'Building-B1.json' && ov?.completed?.value === true && ov?.completedBy?.value?.name === 'Casey', Object.keys(s).join());
    check('B1 device: no "can\'t be saved from this device" warning', !b.logs.some(l => l.includes("can't be saved")));
    await leave(b, dw);
    await openSplit(b, main, BASE, 'office', { ...disk, ...s });
    const e5 = await ev(b, main, 'ev_cropb1'), e6 = await ev(b, main, 'ev_oldb1');
    check('office sees both sign-offs', e5.completedBy?.name === 'Casey' && e6.completedBy?.name === 'Blair' && e5.completed && e6.completed);
    await leave(b, main);
    return results;
}
