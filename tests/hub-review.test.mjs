// SitkaTools editing fixes from the 2026-10-25 review:
// - Q2 / E1: 📋 Duplicate makes a clean crop-task copy, which CropLabourWizard keeps on Generate;
// - Q4 / E2: an event with hours or a sign-off isn't deleted;
// - E3: the Lot Manager's ✕ refuses a lot with recorded work, and otherwise removes what's only its own;
// - E5: a close-out archive stays on offer in the save popup until the save;
// - E6: the event panel writes only what changed, never blanks the date, and leaves the title and lot alone;
// - E7: dragging a multi-day task by a later day moves it by the distance dragged;
// - E8: a room with projected lots isn't deleted; E9: closed-out split lots keep their claim;
// - E10: events with no task type never cluster; E12: re-importing our own ICS adds nothing; E13: a lot stays locked
//   to its grow log when the sheet is deleted.
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, saveSingle, openTool, leave } from './lib/helpers.mjs';

export const title = 'SitkaTools review fixes: duplicate, delete, panel, drag, rooms, ICS';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today(), Y = today(-1);
    const db = fixtureDb();
    db.calendarEvents.find(e => e.id === 'ev_cropb1').labour_map = { [T]: [{ id: 'le_hub0000001', employee: 'Casey', hours: 2 }] };
    db.calendarEvents.find(e => e.id === 'ev_cropb1').completed = true;
    db.calendarEvents.find(e => e.id === 'ev_cropb1').completedBy = { name: 'Casey', at: new Date().toISOString(), by: 'office', day: T };
    db.calendarEvents.push({ id: 'ev_multi', date: today(2), endDate: today(5), title: '✂️ Trim', sourceTool: 'CropLabourWizard', lotId: 'L200', taskType: 'trim' });
    db.lots.L300 = { name: 'L300', strain: 'Fresh', stage: 'veg', createdDate: T, destRoom: 'Grow 1', currentRoom: 'Clone 1', plantCount: 0 };
    db.calendarEvents.push({ id: 'ev_l300', date: today(3), title: 'Plant', sourceTool: 'CropLabourWizard', lotId: 'L300', taskType: 'planting' });
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db);
    const run = (js) => b.run(main, js);
    const alerts = async (fn) => run(`window.__alerts = []; window.__a = window.alert; window.alert = m => window.__alerts.push(String(m)); window.__c = window.confirm; window.confirm = () => true;
        try { ${fn} } finally { window.alert = window.__a; window.confirm = window.__c; } return window.__alerts;`);
    const ev = id => run(`return DB.data.calendarEvents.find(e => e.id === ${JSON.stringify(id)}) || null;`);

    // ---- E1: a clean copy ----
    await run(`Calendar.selectEvent(DB.data.calendarEvents.find(e => e.id === 'ev_cropb1')); Calendar.duplicateEvent();`);
    const copy = await run(`return DB.data.calendarEvents.find(e => e.copyOf === 'ev_cropb1') || null;`);
    check('📋 Duplicate: same task type, marked as a copy, with no hours, done mark or sign-off', copy && copy.taskType === 'late_leaf_pick' && copy.id !== 'ev_cropb1'
        && !copy.labour_map && !copy.completed && !copy.completedBy && copy.lotId === 'L100', JSON.stringify(copy));
    const clw = await openTool(b, main, 'CropLabourWizard');
    const kept = await b.run(clw, `reconcileLotSchedule('L100', { keepCopies: true }); return DB.data.calendarEvents.filter(e => e.lotId === 'L100' && e.sourceTool === 'CropLabourWizard').map(e => e.copyOf ? 'copy' : e.id);`);
    check('CropLabourWizard keeps the copy when it regenerates the lot', kept.join() === 'copy', kept.join());
    await leave(b, clw); await b.send('browsingContext.close', { context: clw });
    await loadSingle(b, main, db);   // back to the fixture

    // ---- E2: no deleting the record of work ----
    let a = await alerts(`Calendar.selectEvent(DB.data.calendarEvents.find(e => e.id === 'ev_cropb1')); Calendar.deleteEvent();`);
    check('an event with hours can\'t be deleted, and says why', !!(await ev('ev_cropb1')) && /2 h of labour logged on it/.test(a[0] || ''), a[0]);
    await run(`const e = DB.data.calendarEvents.find(e => e.id === 'ev_cropb1'); delete e.labour_map;`);
    a = await alerts(`Calendar.selectEvent(DB.data.calendarEvents.find(e => e.id === 'ev_cropb1')); Calendar.deleteEvent();`);
    check('…nor one a floor manager signed off', !!(await ev('ev_cropb1')) && /a sign-off by Casey/.test(a[0] || ''), a[0]);
    a = await alerts(`Calendar.selectEvent(DB.data.calendarEvents.find(e => e.id === 'ev_general')); Calendar.deleteEvent();`);
    check('a plain event still deletes', !(await ev('ev_general')) && !a.length, JSON.stringify(a));

    // ---- E3: the Lot Manager's ✕ ----
    await run(`document.querySelector('.tab[data-tab="lot-manager"]')?.click(); renderLotList();`);
    const del = id => alerts(`document.querySelector('.lot-delete-btn[data-lot-id="${id}"]').click();`);
    await run(`DB.data.calendarEvents.find(e => e.id === 'ev_oldb1').labour_map = { '${Y}': [{ employee: 'Drew', hours: 3 }] }; renderLotList();`);
    a = await del('L100');
    check('a lot with tasks that hold hours can\'t be deleted (close it out instead)', !!(await run(`return DB.data.lots.L100 || null;`)) && /can't be deleted\. Close it out instead/.test(a[0] || ''), a[0]);
    a = await del('L300');
    check('a lot with no records goes, with its scheduled tasks', !(await run(`return DB.data.lots.L300 || null;`)) && !(await ev('ev_l300')), JSON.stringify(a));

    // ---- E6: the event panel ----
    await run(`Calendar.selectEvent(DB.data.calendarEvents.find(e => e.id === 'ev_cropb2'));`);
    const fields = await run(`return [...document.querySelectorAll('#eventPanelBody .event-detail-input')].map(i => i.dataset.field);`);
    check('the panel doesn\'t offer the title or the lot for editing', !fields.includes('title') && !fields.includes('lotId') && fields.includes('date'), fields.join());
    await run(`const d = document.querySelector('#eventPanelBody .event-detail-input[data-field="date"]'); d.value = ''; d.dispatchEvent(new Event('change'));`);
    const e6 = await ev('ev_cropb2');
    check('a blanked start date is refused (the event doesn\'t vanish)', e6.date === T, e6.date);
    check('saving writes no empty fields onto the event', !('notes' in e6) && !('status' in e6) && !('assignedTo' in e6) && !('startTime' in e6), JSON.stringify(Object.keys(e6)));

    // ---- E7: dragging by a later day ----
    await run(`Calendar.moveEvent('ev_multi', '${today(6)}', '${today(4)}');`);
    const m = await ev('ev_multi');
    check('a 4-day task dragged by its third day 2 days on moves 2 days, length kept', m.date === today(4) && m.endDate === today(7), `${m.date} → ${m.endDate}`);

    // ---- E8: a room with projected lots ----
    await run(`DB.data._CropLabourWizard = { projectedLots: { 'R1CL-TBA-01': { name: 'R1CL-TBA-01', roomId: 'R1CL', index: 1 } } };`);
    a = await alerts(`RoomManager.deleteRoom('R1CL');`);
    check('a room with projected lots isn\'t deleted', !!(await run(`return DB.data.rooms.R1CL || null;`)) && /projected lots/.test(a[0] || ''), a[0]);

    // ---- E9: a closed-out split lot keeps its claim ----
    const claim = await run(`DB.data._PaperWizard = { sheets: { gl: { name: 'Grow', cadence: 'daily-weekly', fields: [] } }, wizards: {}, entries: { L100: { gl: { instances: { '${Y}': { days: { '${Y}': { _removed: { moved: 10 } } } } } } } } };
        DB.data._EmployeeWizard.crops = { S1: { version: 4, ctls: { v: 1, type: 'split-lot', parent: 'L100', start: 6, counts: [], moves: [], wet: [], dry: [] } } };
        return movedOutUnclaimed('L100');`);
    check('10 moved out, 6 of them in a split lot since closed out: 4 left to split off', claim === 4, claim);

    // ---- E13: locked to its grow log even when the sheet is deleted ----
    check('a lot stays locked to its grow log when the grow-log sheet is deleted', await run(`delete DB.data._PaperWizard.sheets.gl; return lotLocked('L100');`));

    // ---- E10: no clusters of events with no task type ----
    const cl = await run(`DB.data.calendarEvents.push({ id: 'ev_to1', date: '${today(10)}', title: '🏖️ Time Off — A', sourceTool: 'EmployeeWizard' }, { id: 'ev_to2', date: '${today(10)}', title: '🏖️ Time Off — B', sourceTool: 'EmployeeWizard' });
        Calendar.render(); return Calendar._annualClusters().has('${today(10)}');`);
    check('two time-off events on a day are no cluster', cl === false);

    // ---- E12: our own ICS back in adds nothing ----
    const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:sitka-ev_multi@sitkatools.local', `DTSTART;VALUE=DATE:${today(1).replace(/-/g, '')}`, 'SUMMARY:✂️ Trim (moved on another calendar)', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const before = await run(`return DB.data.calendarEvents.length;`);
    await run(`CalendarIO.importICS({ target: { files: [new File([${JSON.stringify(ics)}], 'cal.ics')], value: '' } }); await new Promise(r => setTimeout(r, 300));`);
    check('re-importing our own exported event (moved since) adds nothing', (await run(`return DB.data.calendarEvents.length;`)) === before);

    // ---- E5: the archive stays on offer until the save ----
    await loadSingle(b, main, fixtureDb());
    await run(`DB.data.lots.L200.plantCount = 0; LotActions.render(); document.getElementById('lotActionSelect').value = 'L200';`);
    await alerts(`await LotActions.closeOut();`);
    const arch = await run(`const a = document.getElementById('archiveLink'); if (!a) return null; a.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); return a.dataset.file;`, { user: true });
    check('close-out offered the archive and removed the lot', !!arch && !(await run(`return DB.data.lots.L200 || null;`)), String(arch));
    await run(`document.getElementById('saveCloseBtn').click();`);
    const offered = await run(`document.getElementById('exportBtn').click(); return [...document.querySelectorAll('#saveFileLinks a.archive-again')].map(a => a.dataset.archive);`, { user: true });
    check('the save popup offers the archive again, in case its Save As was cancelled', offered.join() === arch, offered.join());
    await run(`document.getElementById('saveCloseBtn').click();`);
    await saveSingle(b, main);
    const after = await run(`document.getElementById('exportBtn').click(); const n = document.querySelectorAll('#saveFileLinks a.archive-again').length; document.getElementById('saveCloseBtn').click(); return n;`, { user: true });
    check('…until the save that records the close-out', after === 0, after);

    // ---- I1: typed text is shown as text, never run as HTML ----
    const bad = '<img src=x onerror="window.__xss=1">';
    const x = fixtureDb();
    x.lots['L<9>'] = { name: 'L9', strain: bad, stage: 'veg', createdDate: today(), destRoom: 'Grow 1', currentRoom: 'Grow 1', plantCount: 5, parentLotId: bad };
    x.rooms['R<x>'] = { name: 'Odd room', description: bad, createdDate: today(), assignedLots: ['L<9>'], isFlowering: true, buildingId: 'B1' };
    x.buildings.B1.assignedRooms.push('R<x>');
    await loadSingle(b, main, x);
    await run(`document.querySelector('.tab[data-tab="room-manager"]')?.click(); renderLotList(); RoomManager.renderRoomList(); BuildingManager.renderBuildingList();
        document.querySelector('.room-expand-btn[data-room-id="R<x>"]')?.click();`);
    await b.sleep(300);
    const xs = await run(`return { ran: !!window.__xss, imgs: document.querySelectorAll('#lotList img, #roomList img, .lot-item img, .room-item img').length,
        shown: document.body.textContent.includes('<img src=x') };`);
    check('a strain, parent lot, room id and description typed as HTML show as text and don\'t run', !xs.ran && xs.imgs === 0 && xs.shown, JSON.stringify(xs));

    // ---- Q3 / F1: trim happens in the dry / trim room, in every tool ----
    const f1 = fixtureDb();
    f1.lots.L100.dryRoom = 'Grow A';   // its dry room is in Building 2
    await loadSingle(b, main, f1);
    const clw2 = await openTool(b, main, 'CropLabourWizard');
    const gen = await b.run(clw2, `const r = BUILTIN_RECIPE; const { events } = generateLotSchedule('L100', '${today(-60)}', defaultOffsetsSnapshot(63, r), { trimDays: 7, harvestMultiDay: false, harvestDays: 1 }, r);
        const by = tt => events.find(e => e.taskType === tt); return { trim: by('trim'), dry: by('dry_room_clean'), harvest: by('harvest'), all: events.every(e => !!e.roomPhase) };`);
    check('CropLabourWizard writes the room phase on every task', gen.all, JSON.stringify(gen.harvest));
    check('…Trim in the trim room (the dry room here), Clean Dry Room in the dry room, Harvest in the flower room',
        gen.trim?.roomPhase === 'trim' && gen.dry?.roomPhase === 'dry' && gen.harvest?.roomPhase === 'flower' && /R2G1/.test(gen.trim.title) && /R1G1/.test(gen.harvest.title), `${gen.trim?.title} / ${gen.harvest?.title}`);
    await leave(b, clw2); await b.send('browsingContext.close', { context: clw2 });
    const trimNew = { id: 'ev_tr1', date: T, title: 'Trim', sourceTool: 'CropLabourWizard', lotId: 'L100', taskType: 'trim', roomPhase: 'trim' };
    const trimOld = { id: 'ev_tr2', date: T, title: 'Trim', sourceTool: 'CropLabourWizard', lotId: 'L100', taskType: 'trim' };
    await run(`DB.data.calendarEvents.push(${JSON.stringify(trimNew)}, ${JSON.stringify(trimOld)}); markUnsaved(); await WorkCopy.flush();`);
    const hubRoom = await run(`return [Calendar._resolveEventValues(DB.data.calendarEvents.find(e => e.id === 'ev_tr1')).room, Calendar._resolveEventValues(DB.data.calendarEvents.find(e => e.id === 'ev_tr2')).room];`);
    check('SitkaTools: Trim\'s room is the dry room (with or without the room phase)', hubRoom.every(r => /R2G1/.test(r || '')), JSON.stringify(hubRoom));
    const dw = await openTool(b, main, 'DailyWizard');
    const dwB = await b.run(dw, `return [buildingForEvent(DB.calendarEvents.find(e => e.id === 'ev_tr1')), buildingForEvent(DB.calendarEvents.find(e => e.id === 'ev_tr2'))];`);
    check('DailyWizard lists Trim in the dry room\'s building', dwB.join() === 'B2,B2', dwB.join());
    await leave(b, dw); await b.send('browsingContext.close', { context: dw });
    const ew = await openTool(b, main, 'EmployeeWizard');
    const ewR = await b.run(ew, `return [taskRoomId(DB.data.calendarEvents.find(e => e.id === 'ev_tr1')), taskRoomId(DB.data.calendarEvents.find(e => e.id === 'ev_tr2'))];`);
    check('the Labour & Cost Wizard puts Trim\'s hours in the dry room', ewR.join() === 'R2G1,R2G1', ewR.join());
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });

    await leave(b, main);
    return results;
}
