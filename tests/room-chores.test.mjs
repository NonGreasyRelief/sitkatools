// 🚪 Room chores: a DailyWizard chore tied to a room gives its hours to the lots in that room that day, split by
// plants when lots share it; chores without a room (and room-chore hours on a day the room is empty) stay shared.
import { today, makeChecker, fresh, openSitka, loadSingle, openTool, dwBuilding, leave } from './lib/helpers.mjs';

export const title = 'room chores (hours go to the lots in the room)';

// D(n) = n days after D0 (120 days ago). L100 (100 plants) is in Grow 1 from D20 to D40, L300 (50 plants) from D30
// to D50, so they share it on D30–D40. Hours on "Water Grow 1" (room chore): D25 Alex 3 h (L100 alone), D35 Blair 3 h
// (shared 2 : 1), D60 Casey 1 h (no crop in the room). "Sweep hall" (no room): D35 Alex 2 h.
function choreDb() {
    const D = n => today(-120 + n);
    const ev = (id, lot, tt, n) => ({ id, date: D(n), title: `T ${tt}`, sourceTool: 'CropLabourWizard', lotId: lot, taskType: tt, completed: true });
    const entry = (id, who, h, n) => ({ id, employee: who, hours: h, initials: { name: who, strokes: [[0.2, 0.7, 0.3, 0.3]] }, at: `${D(n)}T15:00:00.000Z`, by: 'B1' });
    return {
        buildings: { B1: { name: 'Building 1', createdDate: '2026-01-01', assignedRooms: ['R1VG', 'R1G1', 'R1HL'] } },
        rooms: {
            R1VG: { name: 'Veg 1', createdDate: '2026-01-01', assignedLots: [], buildingId: 'B1' },
            R1G1: { name: 'Grow 1', createdDate: '2026-01-01', assignedLots: ['L100', 'L300'], buildingId: 'B1', isFlowering: true, lightCount: 20 },
            R1HL: { name: 'Hall 1', createdDate: '2026-01-01', assignedLots: [], buildingId: 'B1' }
        },
        lots: {
            L100: { name: 'L100', strain: 'Test Kush', createdDate: D(0), destRoom: 'Grow 1', currentRoom: 'Grow 1', plantCount: 100 },
            L300: { name: 'L300', strain: 'Blue Test', createdDate: D(10), destRoom: 'Grow 1', currentRoom: 'Grow 1', plantCount: 50 }
        },
        calendarEvents: [ev('ev_a0', 'L100', 'clone_cut_prep', 0), ev('ev_a1', 'L100', 'transplant', 20), ev('ev_a2', 'L100', 'harvest', 40),
            ev('ev_b0', 'L300', 'clone_cut_prep', 10), ev('ev_b1', 'L300', 'transplant', 30), ev('ev_b2', 'L300', 'harvest', 50)],
        _EmployeeWizard: { employees: {
            Alex: { wage: 20, workDays: [1, 2, 3, 4, 5], timeOff: [] }, Blair: { wage: 21, workDays: [1, 2, 3, 4, 5], timeOff: [] }, Casey: { wage: 22, workDays: [1, 2, 3, 4, 5], timeOff: [] }
        } },
        _DailyWizard: { buildings: { B1: {
            tasks: [
                { code: 'gr01', emoji: '💧', name: 'Water Grow 1', minutes: 30, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], monthDays: [], steps: [], roomId: 'R1G1' },
                { code: 'hal1', emoji: '🧹', name: 'Sweep hall', minutes: 20, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], monthDays: [], steps: [] }
            ],
            labour: {
                [D(25)]: { gr01: [entry('le_rc000025a', 'Alex', 3, 25)] },
                [D(35)]: { gr01: [entry('le_rc000035b', 'Blair', 3, 35)], hal1: [entry('le_rc000035h', 'Alex', 2, 35)] },
                [D(60)]: { gr01: [entry('le_rc000060c', 'Casey', 1, 60)] }
            }
        } } }
    };
}

const near = (a, b, eps = 1e-6) => a != null && Math.abs(a - b) < eps;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const D = n => today(-120 + n);
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, choreDb());
    const ew = await openTool(b, main, 'EmployeeWizard');
    const model = () => b.run(ew, `const M = rptModel(), get = id => M.crops.find(c => c.lotId === id);
        const pool = M.other.filter(r => r.kind === 'chore');
        return { L100: get('L100')?.labour, L300: get('L300')?.labour, pool: pool.map(r => ({ code: r.code, date: r.date, hours: r.hours })),
            hours: rptHours(M, '2000-01-01', '2100-01-01'), cost100: rptCropCost(get('L100'))?.cost, cost300: rptCropCost(get('L300'))?.cost,
            other: rptOtherCost(M, '2000-01-01', '2100-01-01')?.cost };`);
    const poolHours = (r, code, n) => r.pool.filter(x => x.code === code && x.date === D(n)).reduce((t, x) => t + x.hours, 0);

    // ---- Live lots ----
    let r = await model();
    check('L100 gets 3 h (alone in Grow 1) + 2 h (two thirds of the shared day) of the room chore', near(r.L100?.chores?.['B1:gr01']?.act, 5) && near(r.L100.chores['B1:gr01'].days[D(35)], 2), JSON.stringify(r.L100?.chores));
    check('L300 gets 1 h (its third of the shared day, by plants)', near(r.L300?.chores?.['B1:gr01']?.act, 1), JSON.stringify(r.L300?.chores));
    check('…as their own labour: hours by person', near(r.L100.act, 5) && near(r.L100.byPerson.Alex, 3) && near(r.L100.byPerson.Blair, 2) && near(r.L300.byPerson.Blair, 1), JSON.stringify(r.L100.byPerson));
    check('…and labour cost: L100 3 × $20 + 2 × $21 = $102, L300 1 × $21', near(r.cost100, 102) && near(r.cost300, 21), `${r.cost100} / ${r.cost300}`);
    check('the shared pool keeps only the empty-room day (1 h) and the whole-building chore (2 h)',
        near(poolHours(r, 'gr01', 25), 0) && near(poolHours(r, 'gr01', 35), 0) && near(poolHours(r, 'gr01', 60), 1) && near(poolHours(r, 'hal1', 35), 2), JSON.stringify(r.pool));
    check('overhead cost: 1 × $22 + 2 × $20 = $62', near(r.other, 62), r.other);
    check('chore hours counted once in the labour mix (9 h)', near(r.hours.chore, 9) && near(r.hours.crop, 0), JSON.stringify({ chore: r.hours.chore, crop: r.hours.crop }));

    // ---- The pages ----
    await b.run(ew, `document.getElementById('tabReports').click();`, { user: true });
    await b.run(ew, `const p = document.getElementById('rptPeriod'); p.value = '12m'; p.dispatchEvent(new Event('change'));`);
    await b.run(ew, `document.querySelector('#rptPages button[data-page="labour"]').click();`, { user: true });
    const labour = await b.run(ew, `return document.getElementById('rptBody').innerText + ' ' + [...document.querySelectorAll('#rptBody [data-tip]')].map(x => x.dataset.tip).join(' ');`);
    check('Labour page: the room chore is a bar in "Where do the labour hours go?"', labour.includes('Water Grow 1 (room chore)') && !/NaN|undefined|Infinity/.test(labour));
    await b.run(ew, `document.querySelector('#rptPages button[data-page="costs"]').click();`, { user: true });
    const costs = await b.run(ew, `return document.getElementById('rptBody').innerText;`);
    check('Costs page: notes the room-chore hours on a day with no crop in the room', costs.includes('1.0 h of room chores fell on days with no crop scheduled in the room') && !/NaN|undefined|Infinity/.test(costs));
    await b.run(ew, `document.querySelector('#rptPages button[data-page="timeline"]').click(); const s = document.getElementById('rptGanttLot'); if (s) { s.value = 'L100'; s.dispatchEvent(new Event('change')); }`, { user: true });
    const gantt = await b.run(ew, `return [...document.querySelectorAll('#rptBody svg text')].map(t => t.textContent).join(' | ');`);
    check('Crop labour Gantt: a "Room chores" row for the lot', gantt.includes('🚪 Room chores (its share)'), gantt.slice(0, 200));

    // ---- Labour Log: where each room-chore entry went ----
    await b.run(ew, `document.getElementById('tabLog').click(); const f = document.getElementById('logFrom'); f.value = '2000-01-01'; f.dispatchEvent(new Event('change'));`, { user: true });
    const log = await b.run(ew, `return [...document.querySelectorAll('#logBody tbody tr')].map(tr => tr.textContent);`);
    const logRow = (who, what) => log.find(t => t.includes(who) && t.includes(what)) || '';
    check('Labour Log: the shared day names both lots and their shares', logRow('Blair', 'Water Grow 1').includes('Lot L100 67 % · Lot L300 33 % (by plants)'), logRow('Blair', 'Water Grow 1'));
    check('…a day with one lot names it', logRow('Alex', 'Water Grow 1').includes('🚪 → Lot L100') && logRow('Alex', 'Water Grow 1').includes('Grow 1'), logRow('Alex', 'Water Grow 1'));
    check('…an empty-room day says so', logRow('Casey', 'Water Grow 1').includes('no crop in the room that day'), logRow('Casey', 'Water Grow 1'));
    check('…a whole-building chore has no room note', logRow('Alex', 'Sweep hall') && !logRow('Alex', 'Sweep hall').includes('🚪'), logRow('Alex', 'Sweep hall'));

    // ---- Closed out: a version 3 summary carries its share; an older one leaves it in the pool ----
    await b.run(ew, `rptSaveSummaries([rptModel().crops.find(c => c.lotId === 'L100')]);`);
    await b.sleep(300);
    const saved = await b.run(main, `return DB.data._EmployeeWizard.crops.L100;`);
    check('the saved summary (version 3) keeps the room chore share', saved?.version === 3 && near(saved.labour?.chores?.['B1:gr01']?.act, 5) && near(saved.labour.act, 5), JSON.stringify(saved?.labour?.chores));
    await b.run(main, `delete DB.data.lots.L100; DB.data.calendarEvents = DB.data.calendarEvents.filter(e => e.lotId !== 'L100'); markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    r = await model();
    check('after close-out the pool still leaves out L100\'s share, and L300 keeps its third', near(poolHours(r, 'gr01', 35), 0) && near(poolHours(r, 'gr01', 25), 0) && near(r.L300?.chores?.['B1:gr01']?.act, 1), JSON.stringify(r.pool));
    await b.run(main, `DB.data._EmployeeWizard.crops.L100.version = 2; markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    r = await model();
    check('an older summary\'s share goes back to the pool (3 h on D25, 2 h on D35)', near(poolHours(r, 'gr01', 25), 3) && near(poolHours(r, 'gr01', 35), 2) && near(r.L300?.chores?.['B1:gr01']?.act, 1), JSON.stringify(r.pool));
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });

    // ---- DailyWizard: the Room field ----
    const dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    const list = await b.run(dw, `return document.getElementById('listContainer').innerText;`);
    check('a room chore shows its room on the row', list.includes('🚪 Grow 1'), list.slice(0, 200));
    const opts = await b.run(dw, `openTaskEditor('B1', 'hal1'); return [...document.getElementById('taskRoomSelect').options].map(o => o.value + '=' + o.textContent);`);
    check('the editor offers whole building, then the building\'s rooms', opts[0] === '=— Whole building (no room) —' && opts.includes('R1G1=R1G1 — Grow 1') && opts.includes('R1HL=R1HL — Hall 1') && opts.length === 4, opts.join(' | '));
    await b.run(dw, `const s = document.getElementById('taskRoomSelect'); s.value = 'R1HL'; saveTaskFromEditor();`);
    await b.sleep(300);
    let task = await b.run(main, `return DB.data._DailyWizard.buildings.B1.tasks.find(t => t.code === 'hal1');`);
    check('saving with a room sets roomId (and SitkaTools gets it)', task?.roomId === 'R1HL', JSON.stringify(task));
    await b.run(dw, `openTaskEditor('B1', 'hal1'); document.getElementById('taskRoomSelect').value = ''; saveTaskFromEditor();`);
    await b.sleep(300);
    task = await b.run(main, `return DB.data._DailyWizard.buildings.B1.tasks.find(t => t.code === 'hal1');`);
    check('saving with "Whole building" removes roomId', task && !('roomId' in task), JSON.stringify(task));
    // A room that leaves the building: flagged, and the Reports treat the chore as whole-building
    await b.run(main, `DB.data.rooms.R1G1.buildingId = null; markUnsaved(); await WorkCopy.flush(); broadcastToSubtools();`);
    await b.sleep(600);
    const chip = await b.run(dw, `renderAll(); return document.querySelector('#listContainer .chip-room')?.textContent || '';`);
    check('a room no longer in the building shows ⚠️ on the chip', chip === '🚪 ⚠️ Grow 1', chip);
    await leave(b, dw); await b.send('browsingContext.close', { context: dw });
    await leave(b, main);
    return results;
}
