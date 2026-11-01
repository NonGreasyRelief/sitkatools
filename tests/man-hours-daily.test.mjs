// SitkaTools calendar: ⏱ Man-hours with 📋 Daily tasks, and CSV→ (user requests 2026-11-01). 📋 Daily tasks adds
// DailyWizard's chores (staff × minutes, on their weekdays or days of the month) to each day's hours; a room's chores count
// only on days a lot is in the room: today where the lots are now (as DailyWizard lists them), other days by the lots'
// schedules (cloning room, veg room, flower room, drying in the dry room, the trim days in the trim room), a lot with no
// schedule where it is now. CSV→ offers the man-hours shown as a file, with the right-click Save Link As… link.
// Checked: the rules on a hand-made facility, the Monthly, 7-Day and Annual views with daily tasks, the filters, a
// building device, and the CSV (its link, file name, rows and totals, with and without daily tasks).
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, splitFiles, openSplit, leave, today } from './lib/helpers.mjs';

export const title = 'calendar ⏱ man-hours: 📋 daily tasks and CSV→';

const T = today();

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);

    // ---- The rules, on a hand-made facility (dates fixed; "today" is 2026-11-02, a Monday) ----
    const r = await b.run(main, `
        const D = n => { const d = new Date(2026, 10, 2 + n); return localDate(d); };   // day n from Mon 2026-11-02
        const data = {
            buildings: { B1: { name: 'Building 1' } },
            rooms: { C: { name: 'Clone A', buildingId: 'B1' }, V: { name: 'Veg A', buildingId: 'B1' }, G: { name: 'Flower A', buildingId: 'B1', isFlowering: true },
                     X: { name: 'Dry A', buildingId: 'B1', designation: 'Dry/Trim' }, E: { name: 'Empty A', buildingId: 'B1' }, U: { name: 'Mother A', buildingId: 'B1', designation: 'Mother' } },
            lots: { L1: { cloningRoom: 'Clone A', vegRoom: 'Veg A', destRoom: 'Flower A', dryRoom: 'Dry A', trimRoom: null, currentRoom: 'Clone A' },
                    L2: { destRoom: 'Mother A', currentRoom: 'Mother A' } },   // no schedule: stays in Mother A
            calendarEvents: [['clone_cut_prep', 0], ['planting', 10], ['transplant', 20], ['flip', 30], ['harvest', 60], ['trim', 70, 72], ['weigh_ship', 80]]
                .map(([tt, n, e]) => ({ sourceTool: 'CropLabourWizard', lotId: 'L1', taskType: tt, date: D(n), ...(e ? { endDate: D(e) } : {}) })),
            _DailyWizard: { buildings: { B1: { tasks: [
                { code: 'all1', name: 'Whole building', minutes: 60, staff: 2, days: [0, 1, 2, 3, 4, 5, 6] },          // 2 h every day
                { code: 'mon1', name: 'Mondays', minutes: 30, staff: 1, days: [1], monthDays: [15] },                // 0.5 h Mondays and the 15th
                { code: 'cl1', name: 'Clone room', minutes: 30, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], roomId: 'C' },
                { code: 've1', name: 'Veg room', minutes: 30, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], roomId: 'V' },
                { code: 'fl1', name: 'Flower room', minutes: 60, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], roomId: 'G' },
                { code: 'dr1', name: 'Drying', minutes: 30, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], roomId: 'X', dryTrim: 'drying' },
                { code: 'tr1', name: 'Trimming', minutes: 30, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], roomId: 'X', dryTrim: 'trimming' },
                { code: 'em1', name: 'Empty room', minutes: 30, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], roomId: 'E' },
                { code: 'mo1', name: 'Mother room', minutes: 30, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], roomId: 'U' },
                { code: 'go1', name: 'Room gone', minutes: 30, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], roomId: 'ZZ' },
                { code: 'nm1', name: 'No minutes', staff: 1, days: [0, 1, 2, 3, 4, 5, 6] }],
                checks: { [D(5)]: { em1: { at: 'x' } } } } } }
        };
        const places = choreRoomStays(data, data.calendarEvents);
        const on = (n, opts = {}) => { const o = dailyChoreHours(data, D(n), { places, today: D(0), ...opts }); return { h: o.hours, codes: o.chores.map(c => c.task.code).sort().join(), missing: o.missing }; };
        return { d0: on(0), d5: on(5), d12: on(12), d25: on(25), d61: on(61), d71: on(71), d90: on(90), d13: on(13),
            b2: on(0, { buildingOk: () => false }).h, room: on(0, { roomOk: id => id === 'C' }).codes,
            stays: Object.fromEntries([...places.stays].map(([k, v]) => [k, v.map(s => s.from.slice(5) + '..' + s.to.slice(5) + (s.kind ? ':' + s.kind : ''))])) };`);
    check('L1\'s schedule puts it in Clone A from its cut, Veg A from planting, Flower A from transplant to harvest, Dry A drying until trim and trimming for the trim days',
        JSON.stringify(r.stays) === JSON.stringify({ C: ['11-02..11-11'], V: ['11-12..11-21'], G: ['11-22..01-01'], X: ['01-01..01-10:drying', '01-11..01-13:trimming'] }), JSON.stringify(r.stays));
    check('today: the whole-building chore (2 h), Mondays\' (0.5 h), Clone A\'s, Mother A\'s (L2 has no schedule: where it is now) and the gone room\'s; no minutes = no estimate',
        r.d0.codes === 'all1,cl1,go1,mo1,mon1' && r.d0.h === 4 && r.d0.missing === 1, JSON.stringify(r.d0));
    check('a chore ticked that day counts even though its room is empty (Empty A on day 5)', r.d5.codes.includes('em1') && !r.d0.codes.includes('em1'), JSON.stringify(r.d5));
    check('day 12: Veg A, not Clone A; day 25: Flower A', r.d12.codes === 'all1,go1,mo1,ve1' && r.d25.codes === 'all1,fl1,go1,mo1', JSON.stringify([r.d12, r.d25]));
    check('the 15th of the month: the month-day chore too', r.d13.codes === 'all1,go1,mo1,mon1,ve1', JSON.stringify(r.d13));
    check('Dry A (Dry/Trim): the drying chore while L1 dries, the trimming chore on its trim days, neither after', r.d61.codes.includes('dr1') && !r.d61.codes.includes('tr1')
        && r.d71.codes.includes('tr1') && !r.d71.codes.includes('dr1') && !r.d90.codes.includes('dr1') && !r.d90.codes.includes('tr1'), JSON.stringify([r.d61, r.d71, r.d90]));
    check('another building only: nothing; a room filter on Clone A: only its chore', r.b2 === 0 && r.room === 'cl1', JSON.stringify([r.b2, r.room]));

    // ---- The views, on the fixture: Building 1 waters and scouts every day (0.5 + 0.33 h), Building 2 waters Grow A (0.5 h) ----
    const db = fixtureDb();
    db.calendarEvents.push({ id: 'ev_dt_trim', date: T, title: '✂️ Trim L100', sourceTool: 'CropLabourWizard', lotId: 'L100', taskType: 'trim', roomPhase: 'trim', estStaff: 8, estMinutes: 480 });
    db._DailyWizard.buildings.B1.tasks.push({ code: 'gr1', emoji: '🚿', name: 'Wash Grow 1', minutes: 60, staff: 2, days: [0, 1, 2, 3, 4, 5, 6], monthDays: [], steps: [], roomId: 'R1G1' });
    await loadSingle(b, main, db);
    await b.run(main, `if (Calendar.viewMode !== 'month') document.getElementById('viewMonthBtn').click(); Calendar.currentYear = ${Number(T.slice(0, 4))}; Calendar.currentMonth = ${Number(T.slice(5, 7)) - 1}; Calendar.render();`, { user: true });
    const shown = id => `getComputedStyle(document.getElementById('${id}')).display !== 'none'`;
    let v = await b.run(main, `return { daily: ${shown('hoursChoresBtn')}, csv: ${shown('hoursCsvWrap')} };`);
    check('📋 Daily tasks and CSV→ are hidden while the days show tasks', !v.daily && !v.csv, JSON.stringify(v));
    const cellLines = `[...document.querySelectorAll('#calendarGrid .calendar-day[data-date="${T}"] .day-hours > div')].map(x => x.textContent)`;
    v = await b.run(main, `document.getElementById('hoursModeBtn').click(); return { daily: ${shown('hoursChoresBtn')}, csv: ${shown('hoursCsvWrap')}, pressed: document.getElementById('hoursChoresBtn').getAttribute('aria-pressed'), lines: ${cellLines} };`, { user: true });
    check('⏱ Man-hours on: 📋 Daily tasks (off) and CSV→ beside it; today is the tasks alone: 1 h + 64 h trim = 65 h', v.daily && v.csv && v.pressed === 'false' && v.lines[0] === '⏱ 65 h', JSON.stringify(v));
    v = await b.run(main, `document.getElementById('hoursChoresBtn').click(); return { pressed: document.getElementById('hoursChoresBtn').getAttribute('aria-pressed'), lines: ${cellLines}, note: document.getElementById('hoursNote').textContent };`, { user: true });
    // Today's chores: water 0.5 + scout 0.33 + wash Grow 1 (L100 is in it now) 2 h, Building 2's water Grow A 0.5 h = 3.33 h
    check('📋 Daily tasks on: today adds 3.3 h of chores (both buildings, Grow 1\'s room chore as L100 is in it): "⏱ 68.3 h", "👥 8.5 people", "📋 3.3 h daily tasks"',
        v.pressed === 'true' && JSON.stringify(v.lines.slice(0, 3)) === JSON.stringify(['⏱ 68.3 h', '👥 8.5 people', '📋 3.3 h daily tasks']), JSON.stringify(v.lines));
    check('…the line says how much of the month is daily tasks and how they\'re counted', /📋 [\d.]+ h of it daily tasks/.test(v.note) && v.note.includes('only on days a lot is in the room'), v.note);
    const tip = await b.run(main, `Calendar._showDayTooltip('${T}', 20, 20); const t = Calendar._getTooltipEl().textContent; Calendar._hideEventTooltip(); return t;`);
    check('the day\'s tooltip lists the daily tasks with their hours', tip.includes('📋 3.3 h daily tasks') && tip.includes('Wash Grow 1 2 h') && tip.includes('Water plants 0.5 h'), tip.slice(0, 300));

    // Filters: a building narrows the chores; a lot filter hides them (a chore has no lot)
    v = await b.run(main, `Calendar.filters = [{ key: 'building', value: 'Building 2 (B2)' }]; Calendar.render(); return ${cellLines};`);
    check('a building filter (Building 2): only its chore, 0.5 h', v[0] === '⏱ 0.5 h' && v.includes('📋 0.5 h daily tasks'), JSON.stringify(v));
    v = await b.run(main, `Calendar.filters = [{ key: 'lot', value: 'L100' }]; Calendar.render(); return ${cellLines};`);
    check('a lot filter: no chores (they have no lot), L100\'s tasks only', v[0] === '⏱ 65 h' && !v.some(x => x.includes('daily tasks')), JSON.stringify(v));
    await b.run(main, `Calendar.filters = []; Calendar.render();`);

    // 7-Day: a row per building for its daily tasks
    const w = await b.run(main, `document.getElementById('viewWeekBtn').click(); Calendar.weekAnchorDate = '${T}'; Calendar.render();
        const card = document.querySelector('#weekView .week-day[data-date="${T}"]');
        return { head: card.querySelector('.week-count').textContent.replace(/\\s+/g, ' ').trim(),
            rows: [...card.querySelectorAll('.week-chores')].map(el => ({ text: el.textContent.replace(/\\s+/g, ' ').trim(), tip: el.title })) };`, { user: true });
    check('7-Day: the header counts the daily tasks in ("⏱ 68.3 h · 👥 8.5 people"), and a 📋 row per building with its hours and its chores in the tooltip',
        w.head.startsWith('⏱ 68.3 h · 👥 8.5 people') && w.rows.length === 2 && w.rows[0].text === '📋 Daily tasks · Building 1 — 3 tasks2.8 h' && w.rows[1].text === '📋 Daily tasks · Building 2 — 1 task0.5 h'
        && w.rows[0].tip.includes('🚿 Wash Grow 1 — 👥 2 × 60m = 2 h'), JSON.stringify(w));

    // Annual: the digits include the daily tasks
    const ann = await b.run(main, `document.getElementById('viewYearBtn').click(); return document.querySelector('#annualGrid .annual-day[data-date="${T}"] .annual-hours')?.textContent;`, { user: true });
    check('Annual: today\'s digits include them: "68"', ann === '68', ann);

    // ---- CSV→: the month shown, with the daily tasks ----
    const csvRead = `document.getElementById('hoursCsvBtn').click();
        const link = document.getElementById('hoursCsvLink'), popup = document.getElementById('hoursCsvPopup');
        const text = link.href.startsWith('blob:') ? await (await fetch(link.href)).text() : null;
        return { open: !popup.classList.contains('hidden'), label: link.textContent, download: link.download, text };`;
    let c = await b.run(main, `document.getElementById('viewMonthBtn').click(); ${csvRead}`, { user: true });
    const ym = T.slice(0, 7), lines = (c.text || '').trim().split('\r\n');
    const daysInMonth = new Date(Number(T.slice(0, 4)), Number(T.slice(5, 7)), 0).getDate();
    check(`CSV→ opens a popup with the file's link: "📄 ManHours-${ym}-with-daily-tasks.csv — Right-click → Save Link As…"`,
        c.open && c.label === `📄 ManHours-${ym}-with-daily-tasks.csv — Right-click → Save Link As…` && c.download === `ManHours-${ym}-with-daily-tasks.csv`, JSON.stringify({ ...c, text: undefined }));
    check('…the file: a header, a row a day of the month, and a Total row', lines[0] === 'Date,Day,Task hours,Projected hours,Tasks,Tasks with no estimate,Daily task hours,Daily tasks,Total hours,People (8-hour day)'
        && lines.length === daysInMonth + 2 && lines[lines.length - 1].startsWith('Total,,'), JSON.stringify([lines[0], lines.length]));
    const todayRow = lines.find(l => l.startsWith(T + ','));
    check('…today\'s row: 65 h of tasks (none projected), 4 tasks, 2 with no estimate, 3.33 h of 4 daily tasks, 68.33 h, 8.54 people',
        !!todayRow && todayRow.split(',').slice(2).join() === '65,0,4,2,3.33,4,68.33,8.54', todayRow);
    const sums = lines.slice(1, -1).map(l => Number(l.split(',')[8])).reduce((a, x) => a + x, 0);
    check('…the Total row adds the days up (each day rounded to 2 decimals)', Math.abs(Number(lines[lines.length - 1].split(',')[8]) - sums) < 0.005 * daysInMonth, `${lines[lines.length - 1]} vs ${sums}`);
    v = await b.run(main, `document.body.click(); return document.getElementById('hoursCsvPopup').classList.contains('hidden');`, { user: true });
    check('a click elsewhere closes the popup', v === true);

    // Without daily tasks, the 7 days shown
    c = await b.run(main, `document.getElementById('hoursChoresBtn').click(); document.getElementById('viewWeekBtn').click(); Calendar.weekAnchorDate = '${T}'; Calendar.render(); ${csvRead}`, { user: true });
    const wl = (c.text || '').trim().split('\r\n');
    check('7-Day, daily tasks off: "ManHours-<first>-to-<last>.csv", no daily-task columns, 7 days and a Total',
        c.download === `ManHours-${T}-to-${today(6)}.csv` && wl[0] === 'Date,Day,Task hours,Projected hours,Tasks,Tasks with no estimate,Total hours,People (8-hour day)' && wl.length === 9
        && wl[1].startsWith(`${T},`) && wl[1].split(',').slice(2).join() === '65,0,4,2,65,8.13', JSON.stringify(wl.slice(0, 2)));
    await b.run(main, `document.getElementById('hoursCsvClose').click(); document.getElementById('hoursModeBtn').click(); clearUnsaved();`, { user: true });

    // ---- A building device: only its own building's chores ----
    const files = await splitFiles(b, main, BASE, db);
    const dev = await fresh(b);
    await openSplit(b, dev, BASE, 'B2', files);
    const bd = await b.run(dev, `document.getElementById('viewMonthBtn').click(); Calendar.currentYear = ${Number(T.slice(0, 4))}; Calendar.currentMonth = ${Number(T.slice(5, 7)) - 1};
        document.getElementById('hoursModeBtn').click(); document.getElementById('hoursChoresBtn').click(); return ${cellLines};`, { user: true });
    check('Building 2\'s tablet: only its own chore (0.5 h) and its own tasks', bd.includes('📋 0.5 h daily tasks') && !bd.some(x => x.includes('3.3 h')), JSON.stringify(bd));
    await leave(b, dev);
    await leave(b, main);
    return results;
}
