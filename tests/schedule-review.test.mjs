// Scheduling fixes from the 2026-10-25 review:
// - G2: an anchor task always counts from its fixed reference (an edited or imported recipe is pinned back);
// - G3: a schedule's trim length is its own, not the preview's;
// - G7: dates are local, never UTC;
// - G9: EquipmentWizard: a done visit covers its period after an interval change (no overdue second visit);
// - G10: an interval of 0 doesn't loop forever; G11: missing lists are filled in.
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';

export const title = 'scheduling review fixes: anchors, trim length, local dates, equipment periods';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const db = fixtureDb();
    db._CropLabourWizard = { recipes: {} };   // no generations list (G11)
    db._EquipmentWizard = { rooms: { R1G1: { equipment: [{ id: 'eq1', type: 'Dehumidifier', name: 'Dehu', installedDate: '2026-01-01',
        tasks: [{ id: 't1', name: 'Filter', intervalValue: 30, intervalUnit: 'days', startDate: today(-60), emoji: '🔧' }], additionalMaintenance: [] }] } } };
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db);

    // ---- CropLabourWizard ----
    const clw = await openTool(b, main, 'CropLabourWizard');
    check('G11: a missing generations list is filled in', await b.run(clw, `return Array.isArray(DB.data._CropLabourWizard.generations);`));
    const g2 = await b.run(clw, `const r = JSON.parse(JSON.stringify(BUILTIN_RECIPE)); r.id = 'pin1';
        r.tasks.find(t => t.taskType === 'flip').reference = 'harvest'; r.tasks.find(t => t.taskType === 'harvest').reference = 'harvest';
        normalizeCloneCut(r); return { flip: r.tasks.find(t => t.taskType === 'flip').reference, harvest: r.tasks.find(t => t.taskType === 'harvest').reference };`);
    check('G2: an anchor\'s reference is pinned back (flip from planting, harvest from flip; never from itself)', g2.flip === 'planting' && g2.harvest === 'flip', JSON.stringify(g2));
    const g3 = await b.run(clw, `const day0 = '2026-01-01', d = { trimDays: 7, harvestMultiDay: false, harvestDays: 1 };
        const ship = () => scheduleOccurrences(day0, defaultOffsetsSnapshot(63, BUILTIN_RECIPE), d, BUILTIN_RECIPE).find(o => o.def.taskType === 'weigh_ship').start;
        const keep = trimDays; trimDays = 7; const a = ship(); trimDays = 12; const c = ship(); trimDays = keep; return { a, c };`);
    check('G3: a 7-day-trim schedule\'s ship day doesn\'t follow the preview\'s 12-day trim', g3.a === g3.c, JSON.stringify(g3));
    const i3 = await b.run(clw, `const r = JSON.parse(JSON.stringify(BUILTIN_RECIPE)); r.id = 'xss1'; r.tasks[0].emoji = '<img src=x onerror=1>'; return validateRecipe(r).join(' | ');`);
    check('I3: a recipe whose emoji is markup is refused', /emoji must be a short emoji/.test(i3), i3);
    const g7 = await b.run(clw, `return [computeTaskDate('2026-03-07', 1), computeTaskDate('2026-10-31', 2), computeTaskDate('2026-12-31', 1)];`);
    check('G7: day arithmetic stays on local days (across DST and the year end)', g7.join() === '2026-03-08,2026-11-02,2027-01-01', g7.join());
    await leave(b, clw); await b.send('browsingContext.close', { context: clw });

    // ---- EquipmentWizard ----
    const eq = await openTool(b, main, 'EquipmentWizard');
    await b.sleep(400);
    const visits = () => b.run(main, `return DB.data.calendarEvents.filter(e => e.equipmentId === 'eq1').map(e => ({ d: e.date, done: !!e.completed })).sort((a, b) => a.d.localeCompare(b.d));`);
    let v = await visits();
    check('equipment: every 30 days from 60 days ago', v.slice(0, 3).map(x => x.d).join() === [today(-60), today(-30), today()].join(), JSON.stringify(v.slice(0, 3)));
    await b.run(main, `const e = DB.data.calendarEvents.find(e => e.equipmentId === 'eq1' && e.date === '${today(-30)}'); e.completed = true;
        e.labour_map = { '${today(-30)}': [{ id: 'le_eq0000001', employee: 'Alex', hours: 1 }] }; markUnsaved(); broadcastToSubtools();`);
    await b.waitFor(eq, `return DB.data.calendarEvents.some(e => e.equipmentId === 'eq1' && e.completed);`);
    await b.run(eq, `DB.data._EquipmentWizard.rooms.R1G1.equipment[0].tasks[0].intervalValue = 20; autoSyncCalendar('R1G1');`);
    await b.sleep(300);
    v = await visits();
    check('G9: every 20 days now — the done visit stays on its day', v.some(x => x.d === today(-30) && x.done), JSON.stringify(v.slice(0, 5)));
    check('…and covers its period: no second, overdue visit 40 days ago', !v.some(x => x.d === today(-40)) && v.some(x => x.d === today(-20)), JSON.stringify(v.slice(0, 5)));
    const i2 = await b.run(eq, `const eqs = DB.data._EquipmentWizard.rooms.R1G1.equipment; eqs[0].name = '<img src=x onerror="window.__xss=1">'; eqs[0].tasks[0].name = '<b>bold</b>';
        const sel = document.getElementById('activeRoom'); sel.value = 'R1G1'; sel.dispatchEvent(new Event('change')); renderEquipmentList(); await new Promise(r => setTimeout(r, 100)); return { ran: !!window.__xss, imgs: document.querySelectorAll('.equipment-name img, .subtask-name b').length, text: document.querySelector('.equipment-name')?.textContent || '' };`);
    check('I2: equipment and task names typed as HTML show as text', !i2.ran && i2.imgs === 0 && i2.text.includes('<img'), JSON.stringify(i2));
    const g10 = await b.run(eq, `return computeEquipmentEvents({ id: 'eqz', name: 'Odd', tasks: [{ id: 'tz', name: 'X', intervalValue: 0, intervalUnit: 'days', startDate: '${today()}' }] }, 'R1G1').length;`);
    check('G10: an interval of 0 gives one visit instead of looping forever', g10 === 1, g10);
    await leave(b, eq); await b.send('browsingContext.close', { context: eq });
    await leave(b, main);
    return results;
}
