// SitkaTools calendar: ⏱ Man-hours (user request 2026-11-01). A button beside 🏛️ Holidays flips the Monthly and 7-Day
// views from each day's tasks to its estimated man-hours (the tasks' recipe estimates, estStaff × estMinutes per day,
// real and projected) and the people that is in 8-hour days. Checked: the rules (per day, multi-day tasks on each day,
// projected hours apart, equipment counted as no estimate, general events and time off left out), the month cells and
// their shading, the summary line, the day tooltip, the 7-Day view's cards and rows, the other views, flipping back,
// the filters, and no sideways scroll on a tablet.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, today } from './lib/helpers.mjs';

export const title = 'calendar ⏱ man-hours';

const T = today(), T1 = today(1), T3 = today(3);

function hoursDb() {
    const db = fixtureDb();
    db.calendarEvents.push(
        // Trim: 8 people × 8 h every day for 3 days from tomorrow = 64 h a day
        { id: 'ev_mh_trim', date: T1, endDate: T3, title: '✂️ Trim L100', sourceTool: 'CropLabourWizard', lotId: 'L100', taskType: 'trim', roomPhase: 'trim', estStaff: 8, estMinutes: 480 },
        // A projected task today: 2 × 1h 30m = 3 h
        { id: 'ev_mh_proj', date: T, title: 'Leaf pick R1G1-TBA-01', sourceTool: 'CropProjection', lotId: 'R1G1-TBA-01', roomId: 'R1G1', taskType: 'leafpick_1', estStaff: 2, estMinutes: 90 },
        // Time off today: not a work task
        { id: 'ev_mh_off', date: T, title: '🏖️ Time Off — Alex', sourceTool: 'EmployeeWizard' });
    db._CropLabourWizard = { projectedLots: { 'R1G1-TBA-01': { name: 'R1G1-TBA-01', roomId: 'R1G1', roomName: 'Grow 1', strain: 'TBA', index: 1 } } };
    return db;
}

// What the month grid shows: the button, the note, and each day's hours block, shading and task chips
const READ = `const btn = document.getElementById('hoursModeBtn'), note = document.getElementById('hoursNote');
    const cell = d => document.querySelector('#calendarGrid .calendar-day[data-date="' + d + '"]');
    const day = d => { const c = cell(d); return c ? { lines: [...c.querySelectorAll('.day-hours > div')].map(x => x.textContent), load: c.style.getPropertyValue('--load'),
        tasks: c.querySelectorAll('.day-event:not(.holiday)').length } : null; };
    return { btn: { shown: getComputedStyle(btn).display !== 'none', pressed: btn.getAttribute('aria-pressed'), text: btn.textContent },
        note: note.classList.contains('hidden') ? null : note.textContent.replace(/\\s+/g, ' ').trim(),
        today: day('${T}'), trim: day('${T1}') };`;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);

    // ---- The rules ----
    const r = await b.run(main, `
        const ev = (o) => ({ date: '2026-11-02', title: 't', ...o });
        const m = manHours([ev({ sourceTool: 'CropLabourWizard', estStaff: 3, estMinutes: 120 }), ev({ sourceTool: 'CropLabourWizard', estMinutes: 30 }),
            ev({ sourceTool: 'CropProjection', estStaff: 2, estMinutes: 90 }), ev({ sourceTool: 'EquipmentWizard' }), ev({ sourceTool: 'CropLabourWizard' }),
            ev({ sourceTool: 'GeneralEvent' }), ev({ sourceTool: 'EmployeeWizard' })]);
        return { hours: m.hours, projected: m.projected, people: m.people, tasks: m.tasks, missing: m.missing.map(e => e.sourceTool),
            multi: taskDayHours({ date: '2026-11-02', endDate: '2026-11-05', estStaff: 8, estMinutes: 480 }), one: fmtPeople(1), many: fmtPeople(4.84), h: [fmtHours(38.5), fmtHours(6)], day: WORKDAY_HOURS };`);
    check('a day\'s hours: 3 × 2 h + 1 × 30 min (one person when no staff is set) + 2 × 1h 30m projected = 9.5 h', r.hours === 9.5 && r.projected === 3, JSON.stringify(r));
    check('…people = hours ÷ 8 (1.1875), in 8-hour days', r.people === 9.5 / 8 && r.day === 8, JSON.stringify(r));
    check('…an equipment task and a crop task with no estimate are counted as missing; a general event and time off aren\'t tasks', r.tasks === 5 && JSON.stringify(r.missing) === '["EquipmentWizard","CropLabourWizard"]', JSON.stringify(r));
    check('a multi-day task counts its estimate on each of its days (8 × 8 h = 64 h a day)', r.multi === 64, String(r.multi));
    check('"1 person", "4.8 people"; hours to one decimal, whole hours bare', r.one === '1 person' && r.many === '4.8 people' && r.h.join() === '38.5,6', JSON.stringify(r));

    // ---- The Monthly view ----
    await loadSingle(b, main, hoursDb());
    await b.run(main, `if (Calendar.viewMode !== 'month') document.getElementById('viewMonthBtn').click(); Calendar.currentYear = ${Number(T.slice(0, 4))}; Calendar.currentMonth = ${Number(T.slice(5, 7)) - 1}; Calendar.render();`, { user: true });
    let v = await b.run(main, READ);
    check('the ⏱ Man-hours button is beside 🏛️ Holidays in the Monthly view, off: the days show their tasks', v.btn.shown && v.btn.pressed === 'false' && v.btn.text === '⏱ Man-hours' && v.today.tasks > 0 && !v.note,
        JSON.stringify(v));

    await b.run(main, `document.getElementById('hoursModeBtn').click();`, { user: true });
    v = await b.run(main, READ);
    check('clicked: pressed, it now says "📅 Show tasks", and the days show hours instead of tasks', v.btn.pressed === 'true' && v.btn.text === '📅 Show tasks' && v.today.tasks === 0 && v.trim.tasks === 0, JSON.stringify(v));
    check('today: 1 h of L100\'s leaf pick + 3 h projected = "⏱ 4 h", "👥 0.5 people", "🔮 3 h projected", "⚠️ 2 tasks, no estimate" (the fan clean and L200\'s defoliation)',
        JSON.stringify(v.today.lines) === JSON.stringify(['⏱ 4 h', '👥 0.5 people', '🔮 3 h projected', '⚠️ 2 tasks, no estimate']), JSON.stringify(v.today.lines));
    check('the trim\'s first day: "⏱ 64 h", "👥 8 people", the busiest day shaded fullest', JSON.stringify(v.trim?.lines) === JSON.stringify(['⏱ 64 h', '👥 8 people']) && v.trim.load === '1.000',
        JSON.stringify(v.trim));
    check('…and today shaded by its share of that (4 ÷ 64)', v.today.load === '0.063', v.today.load);
    const trimDaysInMonth = [T1, today(2), T3].filter(d => d.slice(0, 7) === T.slice(0, 7)).length;
    const monthName = new Date(T + 'T12:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const total = 4 + 64 * trimDaysInMonth;
    check(`the line under the nav: "${monthName}: ${total} h" in eight-hour shifts, projected, busiest day, tasks with no estimate, and how it's worked out`,
        !!v.note && v.note.includes(`${monthName}: ${total} h of estimated work = ${Math.round(total / 8 * 10) / 10} eight-hour shifts`) && v.note.includes('🔮 3 h of it projected')
        && (trimDaysInMonth ? v.note.includes('64 h, 👥 8 people') : v.note.includes('4 h, 👥 0.5 people')) && /⚠️ \d+ tasks? with no estimate/.test(v.note) && v.note.includes('÷ an 8-hour day')
        && v.note.includes('daily tasks aren\'t counted: 📋 Daily tasks adds them'), v.note);

    // The day tooltip leads with the day's hours
    const tip = await b.run(main, `Calendar._showDayTooltip('${T}', 20, 20); const t = Calendar._getTooltipEl().textContent; Calendar._hideEventTooltip(); return t;`);
    check('the day\'s tooltip: "⏱ 4 h of estimated work ≈ 👥 0.5 people in 8-hour days (3 h projected) · ⚠️ 2 tasks with no estimate", then its tasks',
        tip.includes('⏱ 4 h of estimated work ≈ 👥 0.5 people in 8-hour days (3 h projected) · ⚠️ 2 tasks with no estimate') && tip.includes('Leaf Pick'), tip.slice(0, 300));

    // ---- Filters: only L100's tasks ----
    v = await b.run(main, `Calendar.filters = [{ key: 'lot', value: 'L100' }]; Calendar.render(); ${READ}`);
    check('a lot filter: today is only L100\'s 1 h leaf pick ("👥 0.1 people", nothing missing)', JSON.stringify(v.today.lines) === JSON.stringify(['⏱ 1 h', '👥 0.1 people']), JSON.stringify(v.today.lines));
    await b.run(main, `Calendar.filters = []; Calendar.render();`);

    // ---- The 7-Day view ----
    await b.run(main, `document.getElementById('viewWeekBtn').click(); Calendar.weekAnchorDate = '${T}'; Calendar.render();`, { user: true });
    const w = await b.run(main, `const card = d => document.querySelector('#weekView .week-day[data-date="' + d + '"]');
        const row = id => { const el = document.querySelector('#weekView .week-event[data-event-id="' + id + '"]'); return el ? el.querySelector('.week-hours')?.textContent ?? '' : null; };
        const btn = document.getElementById('hoursModeBtn'), note = document.getElementById('hoursNote');
        return { btn: getComputedStyle(btn).display !== 'none' && btn.getAttribute('aria-pressed') === 'true',
            today: card('${T}').querySelector('.week-count').textContent.replace(/\\s+/g, ' ').trim(), trim: card('${T1}').querySelector('.week-count').textContent.replace(/\\s+/g, ' ').trim(),
            rows: { leaf: row('ev_cropb1'), proj: row('ev_mh_proj'), fans: row('ev_equipb1'), meeting: row('ev_general'), off: row('ev_mh_off'), trim: row('ev_mh_trim') },
            note: note.classList.contains('hidden') ? null : note.textContent };`);
    check('the 7-Day view keeps it on; each card\'s header: "⏱ 4 h · 👥 0.5 people · 6 tasks", "⏱ 64 h · 👥 8 people · 1 task"',
        w.btn && w.today === '⏱ 4 h · 👥 0.5 people · 6 tasks' && w.trim === '⏱ 64 h · 👥 8 people · 1 task', JSON.stringify(w));
    check('…its rows keep the tasks, each with its hours that day: 1 h, 3 h, 64 h; "no estimate" for the fan clean; nothing on the meeting or time off',
        JSON.stringify(w.rows) === JSON.stringify({ leaf: '1 h', proj: '3 h', fans: 'no estimate', meeting: '', off: '', trim: '64 h' }), JSON.stringify(w.rows));
    check('…and the line totals these 7 days (4 + 3 × 64 = 196 h = 24.5 shifts)', !!w.note && w.note.includes('These 7 days: 196 h of estimated work = 24.5 eight-hour shifts'), w.note);

    // ---- 🚀 and 🌿: no man-hours there ----
    const other = await b.run(main, `const out = {};
        for (const id of ['viewLaunchBtn', 'viewMothersBtn']) { document.getElementById(id).click();
            out[id] = { btn: getComputedStyle(document.getElementById('hoursModeBtn')).display === 'none', note: document.getElementById('hoursNote').classList.contains('hidden') }; }
        return out;`, { user: true });
    check('🚀 Launch windows and 🌿 Mothers: the button and the line are hidden', Object.values(other).every(o => o.btn && o.note), JSON.stringify(other));

    // ---- Annual: each day's hours, digits only, in place of the emoji (user request 2026-11-01) ----
    const ann = await b.run(main, `document.getElementById('viewYearBtn').click(); Calendar.currentYear = ${Number(T.slice(0, 4))}; Calendar.render();
        const cell = d => document.querySelector('#annualGrid .annual-day[data-date="' + d + '"]');
        const shown = d => { const c = cell(d); return c ? { hours: c.querySelector('.annual-hours')?.textContent ?? null, dots: c.querySelectorAll('.annual-dot').length, badge: !!c.querySelector('.cluster-badge'),
            text: c.textContent.replace(/\\s+/g, ' ').trim() } : null; };
        const note = document.getElementById('hoursNote');
        return { btn: getComputedStyle(document.getElementById('hoursModeBtn')).display !== 'none', today: shown('${T}'), trim: shown('${T1}'), empty: shown('${T.slice(0, 4)}-${T.slice(5, 7) === '01' ? '02' : '01'}-15'),
            legend: document.getElementById('annualLegend').classList.contains('hidden'), note: note.classList.contains('hidden') ? null : note.textContent };`, { user: true });
    check('Annual: the button stays; today shows just "4" and the trim day "64": digits, no emoji', ann.btn && ann.today?.hours === '4' && ann.today.dots === 0 && ann.trim?.hours === '64' && ann.trim.dots === 0,
        JSON.stringify(ann));
    check('…nothing else in the cell but its day number; a day with no hours shows no number', ann.today.text === `${Number(T.slice(8))} 4` && !ann.today.badge && ann.empty?.hours === null, JSON.stringify(ann));
    check('…the emoji legend is put away, and the line totals the year', ann.legend && !!ann.note && ann.note.includes(`${T.slice(0, 4)}: `), JSON.stringify([ann.legend, ann.note?.slice(0, 120)]));

    // ---- Back to Monthly: still on for this session; 📅 Show tasks flips back ----
    await b.run(main, `document.getElementById('viewMonthBtn').click();`, { user: true });
    v = await b.run(main, READ);
    check('back to Monthly: still man-hours', v.btn.pressed === 'true' && v.today.tasks === 0 && v.today.lines[0] === '⏱ 4 h', JSON.stringify(v.today));

    // ---- 👥 People: the man-hours as people in 8-hour days first, the hours second (user request 2026-11-01) ----
    const people = () => b.run(main, `const p = document.getElementById('hoursPeopleBtn'), order = [...p.parentElement.children].map(c => c.id).filter(Boolean);
        return { shown: getComputedStyle(p).display !== 'none', pressed: p.getAttribute('aria-pressed'), text: p.textContent, after: order[order.indexOf('hoursPeopleBtn') - 1] };`);
    let pb = await people();
    check('👥 People beside ⏱ Man-hours while it\'s on, not pressed', pb.shown && pb.pressed === 'false' && pb.text === '👥 People' && pb.after === 'hoursModeBtn', JSON.stringify(pb));
    await b.run(main, `document.getElementById('hoursPeopleBtn').click();`, { user: true });
    v = await b.run(main, READ);
    pb = await people();
    check('pressed: each day shows its people first, the hours under them — today "👥 0.5 people", "⏱ 4 h", "🔮 0.4 people projected"; the trim "👥 8 people", "⏱ 64 h"',
        pb.pressed === 'true' && JSON.stringify(v.today.lines) === JSON.stringify(['👥 0.5 people', '⏱ 4 h', '🔮 0.4 people projected', '⚠️ 2 tasks, no estimate'])
        && JSON.stringify(v.trim?.lines) === JSON.stringify(['👥 8 people', '⏱ 64 h']) && v.trim.load === '1.000', JSON.stringify([v.today.lines, v.trim]));
    check('…the line leads with eight-hour shifts, then the hours; projected and the busiest day in people too',
        !!v.note && v.note.includes(`${monthName}: ${Math.round(total / 8 * 10) / 10} eight-hour shifts of estimated work = ${total} h`) && v.note.includes('🔮 0.4 shifts of it projected')
        && (trimDaysInMonth ? v.note.includes('👥 8 people, 64 h') : v.note.includes('👥 0.5 people, 4 h')), v.note);
    const ptip = await b.run(main, `Calendar._showDayTooltip('${T}', 20, 20); const t = Calendar._getTooltipEl().textContent; Calendar._hideEventTooltip(); return t;`);
    check('…the day\'s tooltip: "👥 0.5 people in 8-hour days ≈ ⏱ 4 h of estimated work (0.4 people projected)"', ptip.includes('👥 0.5 people in 8-hour days ≈ ⏱ 4 h of estimated work (0.4 people projected)'), ptip.slice(0, 200));
    const pw = await b.run(main, `document.getElementById('viewWeekBtn').click(); Calendar.weekAnchorDate = '${T}'; Calendar.render();
        const card = d => document.querySelector('#weekView .week-day[data-date="' + d + '"]');
        const row = id => document.querySelector('#weekView .week-event[data-event-id="' + id + '"] .week-hours')?.textContent ?? '';
        return { today: card('${T}').querySelector('.week-count').textContent.replace(/\\s+/g, ' ').trim(), rows: [row('ev_cropb1'), row('ev_mh_proj'), row('ev_equipb1'), row('ev_mh_trim')],
            shown: getComputedStyle(document.getElementById('hoursPeopleBtn')).display !== 'none' };`, { user: true });
    check('…the 7-Day view: "👥 0.5 people · ⏱ 4 h · 6 tasks", each task in people (0.1, 0.4, no estimate, 8)', pw.shown && pw.today === '👥 0.5 people · ⏱ 4 h · 6 tasks'
        && JSON.stringify(pw.rows) === JSON.stringify(['0.1 people', '0.4 people', 'no estimate', '8 people']), JSON.stringify(pw));
    const pa = await b.run(main, `document.getElementById('viewYearBtn').click(); Calendar.currentYear = ${Number(T.slice(0, 4))}; Calendar.render();
        const n = d => document.querySelector('#annualGrid .annual-day[data-date="' + d + '"] .annual-hours')?.textContent ?? null;
        return [n('${T}'), n('${T1}')];`, { user: true });
    check('…Annual: each day\'s people, digits only — today "0.5", the trim day "8"', JSON.stringify(pa) === '["0.5","8"]', JSON.stringify(pa));
    await b.run(main, `document.getElementById('viewMonthBtn').click(); document.getElementById('hoursPeopleBtn').click();`, { user: true });
    v = await b.run(main, READ);
    check('👥 People again: hours first as before', JSON.stringify(v.today.lines) === JSON.stringify(['⏱ 4 h', '👥 0.5 people', '🔮 3 h projected', '⚠️ 2 tasks, no estimate']) && (await people()).pressed === 'false', JSON.stringify(v.today.lines));
    await b.send('browsingContext.setViewport', { context: main, viewport: { width: 800, height: 1280 } });
    const wide = await b.run(main, `await new Promise(r => setTimeout(r, 100)); return { page: document.documentElement.scrollWidth, view: innerWidth };`);
    check('at 800 px the page doesn\'t scroll sideways', wide.page <= wide.view, JSON.stringify(wide));
    await b.send('browsingContext.setViewport', { context: main, viewport: null });
    await b.run(main, `document.getElementById('hoursModeBtn').click();`, { user: true });
    v = await b.run(main, READ);
    check('📅 Show tasks: the tasks are back, the line gone, the button says ⏱ Man-hours again', v.btn.pressed === 'false' && v.btn.text === '⏱ Man-hours' && v.today.tasks > 0 && v.today.lines.length === 0 && !v.note,
        JSON.stringify(v));

    await b.run(main, `clearUnsaved();`);
    return results;
}
