// SitkaTools, DailyWizard or PaperWizard left open overnight moves to the new day by itself (checked each minute, when the tab is
// shown and on focus): whatever showed today follows it, and anything picked by hand stays put. The page's clock is
// moved forward to test it, to 00:05 on days counted from the 1st of next month (built from local dates, so a
// daylight-saving change in between doesn't matter).
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';

export const title = 'the calendar, DailyWizard and PaperWizard roll over to the new day';

// Set the page's clock to 00:05 on a day worked out in the page from its real today `r` — by default the 1st of the
// month after r's plus (`day` − 1) days, or with `fromToday` r plus `day` days — and return that date (YYYY-MM-DD).
// Every `new Date()` / `Date.now()` in the page then reads from it; `event` ('focus' / 'visibilitychange') is fired.
const setClock = (months, day, event = 'focus', fromToday = false) => `if (!window.__RealDate) window.__RealDate = Date;
    const Real = window.__RealDate, r = new Real();
    const t = ${fromToday ? `new Real(r.getFullYear(), r.getMonth(), r.getDate() + ${day}, 0, 5)` : `new Real(r.getFullYear(), r.getMonth() + ${months}, ${day}, 0, 5)`}, shift = t - Real.now();
    window.Date = class extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + shift])); } static now() { return Real.now() + shift; } };
    (${event === 'focus' ? 'window' : 'document'}).dispatchEvent(new Event('${event}'));
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');`;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    const cal = () => b.run(main, `return { today: document.querySelector('.calendar-day.today')?.dataset.date || null, month: Calendar.currentMonth, year: Calendar.currentYear,
        anchor: Calendar.weekAnchorDate, lotDate: document.getElementById('lotDate').value, title: document.getElementById('calendarTitle').textContent };`);
    let c = await cal();
    check('the calendar starts on today', c.today === today() && c.lotDate === today(), JSON.stringify(c));

    // ---- Past midnight into the next month: the month shown, Today and the new-lot date follow ----
    const first = await b.run(main, setClock(1, 1));
    c = await cal();
    check('past midnight on the 1st: the calendar moves to the new month, with Today on the 1st', `${c.year}-${String(c.month + 1).padStart(2, '0')}-01` === first && c.today === first, `${first}: ${JSON.stringify(c)}`);
    check('…and the new-lot form\'s date follows', c.lotDate === first, c.lotDate);

    // A month picked by hand stays
    await b.run(main, `Calendar.navigateMonth(-1);`);
    const second = await b.run(main, setClock(1, 2, 'visibilitychange'));
    c = await cal();
    const realMonth = await b.run(main, `const r = new window.__RealDate(); return [r.getMonth(), r.getFullYear()];`);
    check('a month picked by hand stays put the next day (tab shown again)', c.month === realMonth[0] && c.year === realMonth[1] && c.lotDate === second, JSON.stringify(c));
    await b.run(main, `Calendar.goToToday();`);

    // ---- The 7-day view: a window starting this week's Sunday, or today, follows ----
    await b.run(main, `document.getElementById('viewWeekBtn').click();`, { user: true });
    const anchor0 = (await cal()).anchor;
    const later = await b.run(main, setClock(1, 9));
    const sunday = await b.run(main, `return DayRollover.sundayOf('${later}');`);
    c = await cal();
    check('a week later the 7-day window starts on the new week\'s Sunday', c.anchor === sunday && c.anchor !== anchor0, `${anchor0} → ${c.anchor} (expected ${sunday})`);
    await b.run(main, `Calendar.goToToday();`);
    const day10 = await b.run(main, setClock(1, 10));
    check('a window started on Today moves to the new today', (await cal()).anchor === day10, `${(await cal()).anchor} / ${day10}`);
    await b.run(main, `window.Date = window.__RealDate;`);

    // ---- DailyWizard ----
    const dw = await openTool(b, main, 'DailyWizard');
    const dwDate = () => b.run(dw, `return { date: document.getElementById('dateInput').value, status: document.getElementById('statusText').textContent };`);
    check('DailyWizard starts on today', (await dwDate()).date === today());
    const next = await b.run(dw, setClock(0, 1, 'focus', true));
    let d = await dwDate();
    check('past midnight DailyWizard moves to the new day', d.date === next, JSON.stringify(d));
    const after = await b.run(dw, setClock(0, 2, 'visibilitychange', true));
    check('…and again the next day (tab shown again)', (await dwDate()).date === after);
    await b.run(dw, `const el = document.getElementById('dateInput'); el.value = '${today(-3)}'; el.dispatchEvent(new Event('change'));`);
    await b.run(dw, setClock(0, 3, 'focus', true));
    check('a date picked by hand stays put', (await dwDate()).date === today(-3));
    await leave(b, dw); await b.send('browsingContext.close', { context: dw });
    await b.run(main, `window.Date = window.__RealDate;`);   // the tools share the page's clock: back to the real one
    // A tick made just past midnight, before the once-a-minute check ran, doesn't land on yesterday (review H3)
    const dw2 = await openTool(b, main, 'DailyWizard');
    await b.run(dw2, `const s = document.getElementById('buildingSelect'); s.value = 'B1'; s.dispatchEvent(new Event('change'));`);
    const newDay = await b.run(dw2, setClock(0, 1, 'x-no-check', true));
    check('past midnight, before the check: yesterday\'s list is still up', (await b.run(dw2, `return document.getElementById('dateInput').value;`)) === today());
    await b.run(dw2, `const row = [...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Water plants')); row.querySelector('input[type=checkbox]').click();`, { user: true });
    await b.sleep(200);
    const h3 = await b.run(dw2, `return { date: document.getElementById('dateInput').value, toast: document.getElementById('toast').textContent,
        old: !!DB.data._DailyWizard.buildings.B1?.checks?.['${today()}']?.wat1 };`);
    check('…a tick then rolls the list over to the new day instead of ticking yesterday', h3.date === newDay && h3.toast.includes("new day") && !h3.old, JSON.stringify(h3));
    await leave(b, dw2); await b.send('browsingContext.close', { context: dw2 });

    // ---- PaperWizard: a grow-log page whose 7 days end today; tomorrow the cabinet offers the next week ----
    const db = fixtureDb();
    const box = (id, d) => ({ id, label: id, x: 0.1, y: 0.2 + (d - 1) * 0.06, w: 0.12, h: 0.03, page: 1, fontSize: 10, align: 'left',
        source: null, questionId: 'tmp', day: d, dayGroup: 'gday', checkbox: false, checkValue: '' });
    db._PaperWizard = {
        sheets: { glog: { name: 'Grow Log', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'daily-weekly', document: 'grow-log',
            fields: [1, 2, 3, 4, 5, 6, 7].map(d => box('t' + d, d)), signature: null } },
        wizards: { wg: { sheetId: 'glog', name: 'Grow Log', questions: [{ id: 'tmp', label: 'Temp', type: 'number', options: [], rowScoped: true, sameAsLast: false, mandatory: false, prefillFrom: null }] } },
        entries: { L100: { glog: { instances: { [today(-6)]: { phase: 'Bloom', room: 'Grow 1', header: {}, days: { [today(-6)]: { tmp: '24' } }, phaseChangeDate: null, strikeInitials: null, snapshots: {}, signature: null, completedAt: null, printedAt: null } } } } }
    };
    await loadSingle(b, main, db);
    const pw = await openTool(b, main, 'PaperWizard');
    await b.run(pw, `switchTab('cabinet'); const s = document.getElementById('lotSelect'); s.value = 'L100'; s.dispatchEvent(new Event('change'));`);
    const startWeek = () => b.run(pw, `return document.getElementById('cabinetPanel').textContent.includes('Start new week');`);
    check('PaperWizard: today is still inside the page\'s 7 days (no "Start new week")', !(await startWeek()));
    await b.run(pw, setClock(0, 1, 'focus', true));
    check('past midnight PaperWizard\'s cabinet offers "📅 Start new week" by itself', await startWeek());
    await leave(b, pw); await b.send('browsingContext.close', { context: pw });
    await leave(b, main);
    return results;
}
