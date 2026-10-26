// Schedule tasks move only in CropLabourWizard (user decision 2026-10-26): the anchors (Cutting Clones, Planting, Flip,
// Harvest, Trim, Retire Mothers), the transplant, both clone cuts and the room-ready cleans (Grow-Room Clean, Tank and
// Irrigation Line Clean), on real and projected lots. On the SitkaTools calendar they can't be dragged, ↻ Reschedule
// refuses them, and the event panel shows their dates read-only — each saying "Tasks that change the schedule of crops
// must be moved using crop labour wizard". Other tasks, and 📋 Duplicate copies of schedule tasks, still move.
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, leave } from './lib/helpers.mjs';

export const title = 'Schedule tasks move only in CropLabourWizard';

const TEXT = 'Tasks that change the schedule of crops must be moved using crop labour wizard';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today(), D3 = today(-3);
    const db = fixtureDb();
    const crop = (id, date, taskType, title, extra = {}) => ({ id, date, title, sourceTool: 'CropLabourWizard', lotId: 'L100', taskType, ...extra });
    db.calendarEvents.push(
        crop('ev_harv', T, 'harvest', '🌾 R1G1-Test Kush#L100, Harvest'),
        crop('ev_trim', T, 'trim', '✂️ R1G1-Test Kush#L100, Trim', { endDate: today(6) }),
        crop('ev_copy', T, 'harvest', '🌾 R1G1-Test Kush#L100, Harvest (copy)', { copyOf: 'ev_harv' }),
        crop('ev_clean_due', D3, 'room_clean', '🧹 R1G1-Test Kush#L100, Grow-Room Clean'),
        crop('ev_pick_due', D3, 'leafpick_early', '🍃 R1G1-Test Kush#L100, Early Flower Leaf Pick'),
        { id: 'ev_tba', date: T, title: '🌾 R1G1-TBA-01, Harvest', sourceTool: 'CropProjection', lotId: 'R1G1-TBA-01', roomId: 'R1G1', taskType: 'harvest' }
    );
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db);
    const run = (js, o) => b.run(main, js, o);
    const ev = id => run(`return DB.data.calendarEvents.find(e => e.id === ${JSON.stringify(id)}) || null;`);
    const toast = () => run(`const t = document.getElementById('syncToast');
        return { shown: !t.classList.contains('hidden'), warn: t.classList.contains('warn'), text: document.getElementById('syncToastText').textContent };`);
    const resetToast = () => run(`document.getElementById('syncToast').classList.add('hidden'); document.getElementById('syncToastText').textContent = '';`);

    // ---- Which tasks ----
    const locked = await run(`return ['clone_cut_prep', 'planting', 'transplant', 'flip', 'harvest', 'trim', 'retire', 'clone_cut', 'room_clean', 'tank_irrigation_clean', 'leafpick_early', 'topping']
        .filter(t => isScheduleTask({ sourceTool: 'CropLabourWizard', taskType: t }));`);
    check('the ten schedule tasks are locked, other crop tasks aren\'t', locked.join() === 'clone_cut_prep,planting,transplant,flip,harvest,trim,retire,clone_cut,room_clean,tank_irrigation_clean', locked.join());
    check('…only CropLabourWizard\'s and projected lots\' tasks', await run(`return isScheduleTask({ sourceTool: 'CropProjection', taskType: 'harvest' })
        && !isScheduleTask({ sourceTool: 'GeneralEvent', taskType: 'harvest' }) && !isScheduleTask({ sourceTool: 'CropLabourWizard', taskType: 'harvest', copyOf: null });`));

    // ---- Dragging on the month calendar ----
    // A drag from the task's chip onto another day: dragstart on the chip, then drop on the day (what the browser fires)
    const drag = (id) => run(`
        const chip = [...document.querySelectorAll('.day-event')].find(el => el.dataset.eventId === ${JSON.stringify(id)});
        if (!chip) return { missing: true };
        const from = chip.closest('.calendar-day').dataset.date;
        const target = [...document.querySelectorAll('.calendar-day[data-date]')].find(c => c.dataset.date !== from && c.dataset.date.slice(0, 7) === from.slice(0, 7));
        const dt = new DataTransfer();
        const started = chip.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
        if (started) {
            target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
            target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
        }
        chip.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
        await new Promise(r => setTimeout(r, 150));
        return { started, to: target.dataset.date };`);

    for (const [id, what] of [['ev_harv', 'a Harvest'], ['ev_trim', 'a multi-day Trim'], ['ev_tba', 'a projected lot\'s Harvest']]) {
        await resetToast();
        const before = await ev(id);
        const d = await drag(id);
        const after = await ev(id);
        const t = await toast();
        check(`${what} can't be dragged: the drag is cancelled as it starts`, !d.missing && d.started === false, JSON.stringify(d));
        check(`…it stays on its day${before.endDate ? ', end date too' : ''}`, after.date === before.date && after.endDate === before.endDate, `${after.date} → ${after.endDate}`);
        check('…and the amber warning says why', t.shown && t.warn && t.text === TEXT, JSON.stringify(t));
    }

    await resetToast();
    let d = await drag('ev_cropb2');
    check('another crop task still drags to a new day', d.started && (await ev('ev_cropb2')).date === d.to, JSON.stringify(d));
    const t0 = await toast();
    check('…with the usual (green) moved toast', t0.shown && !t0.warn && /moved from/.test(t0.text), JSON.stringify(t0));
    d = await drag('ev_copy');
    check('a 📋 Duplicate copy of a Harvest still drags (it isn\'t part of the schedule)', d.started && (await ev('ev_copy')).date === d.to, JSON.stringify(d));

    // The move itself refuses too (a drop that didn't start on the chip)
    await resetToast();
    await run(`Calendar.moveEvent('ev_harv', '${today(1)}');`);
    check('moving a schedule task by any other way is refused too', (await ev('ev_harv')).date === T && (await toast()).text === TEXT);

    // ---- ↻ Reschedule in the terminal list (shown on overdue tasks) ----
    const reschedule = id => run(`document.querySelector('.terminal-reschedule-btn[data-event-id="${id}"]')?.click(); await new Promise(r => setTimeout(r, 50));
        return { picker: !!document.querySelector('.terminal-reschedule-picker') };`, { user: true });
    await resetToast();
    const shown = await run(`return !!document.querySelector('.terminal-reschedule-btn[data-event-id="ev_clean_due"]') && !!document.querySelector('.terminal-complete-btn[data-event-id="ev_clean_due"]');`);
    check('an overdue Grow-Room Clean still shows ✓ and ↻ Reschedule', shown);
    const r1 = await reschedule('ev_clean_due');
    const t1 = await toast();
    check('↻ Reschedule on a Grow-Room Clean opens no date picker…', !r1.picker, JSON.stringify(r1));
    check('…shows the warning instead', t1.shown && t1.warn && t1.text === TEXT, JSON.stringify(t1));
    check('…and the task keeps its day', (await ev('ev_clean_due')).date === D3);
    const r2 = await reschedule('ev_pick_due');
    check('↻ Reschedule on another overdue crop task opens the date picker', r2.picker, JSON.stringify(r2));
    await run(`document.getElementById('rescheduleDateInput').value = '${T}'; document.getElementById('rescheduleConfirmBtn').click();`, { user: true });
    check('…and moves it', (await ev('ev_pick_due')).date === T);
    await run(`document.querySelector('.terminal-complete-btn[data-event-id="ev_clean_due"]')?.click();`, { user: true });
    check('✓ next to it still marks the Grow-Room Clean done', (await ev('ev_clean_due')).completed === true);

    // ---- The event panel ----
    const panel = id => run(`Calendar.selectEvent(DB.data.calendarEvents.find(e => e.id === ${JSON.stringify(id)}));
        const body = document.getElementById('eventPanelBody');
        const groups = [...body.querySelectorAll('.event-detail-grid > *')].map(g => g.classList.contains('schedule-lock-note') ? 'NOTE' : g.querySelector('.event-detail-label')?.textContent);
        return { inputs: [...body.querySelectorAll('.event-detail-input')].map(i => i.dataset.field), groups,
            note: body.querySelector('.schedule-lock-note')?.textContent || null,
            values: [...body.querySelectorAll('.event-detail-group')].filter(g => !g.querySelector('.event-detail-input')).map(g => g.querySelector('.event-detail-value')?.textContent) };`);
    let p = await panel('ev_harv');
    check('the panel shows a Harvest\'s date as text, not a date box', !p.inputs.includes('date') && !p.inputs.includes('endDate') && p.values.includes(T), JSON.stringify(p));
    check('…with the warning under it', p.note === `⚠️ ${TEXT}` && p.groups[0] === 'Date' && p.groups[1] === 'NOTE', p.groups.join(' | '));
    check('…and the rest still editable (times, notes, status, assigned to, hours)', ['startTime', 'endTime', 'notes', 'status', 'assignedTo', 'estimatedHours'].every(f => p.inputs.includes(f)), p.inputs.join());
    p = await panel('ev_trim');
    check('a multi-day Trim shows both dates as text, the warning under the end date', !p.inputs.includes('date') && !p.inputs.includes('endDate')
        && p.groups.slice(0, 3).join() === 'Date,End Date,NOTE' && p.values.includes(today(6)), p.groups.join(' | '));
    p = await panel('ev_tba');
    check('a projected lot\'s Harvest is read-only in the panel too', !p.inputs.includes('date') && !!p.note, JSON.stringify(p.inputs));
    await run(`const n = document.querySelector('#eventPanelBody .event-detail-input[data-field="notes"]'); n.value = 'Bring the bins'; n.dispatchEvent(new Event('change'));`);
    check('…its notes still save', (await ev('ev_tba')).notes === 'Bring the bins' && (await ev('ev_tba')).date === T);
    p = await panel('ev_copy');
    check('a copy\'s dates stay editable, with no warning', p.inputs.includes('date') && p.inputs.includes('endDate') && !p.note, JSON.stringify(p.inputs));
    p = await panel('ev_cropb2');
    check('another crop task\'s dates stay editable', p.inputs.includes('date') && !p.note);

    await leave(b, main);
    return results;
}
