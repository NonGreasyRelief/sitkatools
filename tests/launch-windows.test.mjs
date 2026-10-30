// SitkaTools calendar: 🚀 Launch windows (user request 2026-10-29). The default recipe's 70-day cycle gives the facility
// 10 weekly windows to flip a crop in; the view shows them as rows, oldest crop in bloom first, the open ones marked 🚀.
// Checked: the rules on a fixed day (the example DB's three crops on 2026-10-29: the anchor, an overlap, the open Fridays,
// clone-cut days passed, 🏛️ holidays, free rooms), then the view itself with crops around today (the staircase, the
// room's next lot in the same row, projections taking a window, stale and superseded ones not, copies and missing lots
// left out, a flip with no harvest estimated, a long bloom held to 9 weeks back), every window for the next 12 months listed
// under the chart (taken by a lot or a projection, or open), the filters, a building device,
// Prev / Next / Today, a bar opening its task, the day rolling over, the figures matching CropLabourWizard's default
// recipe, and no sideways page scroll on a tablet.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, leave, splitFiles, openSplit, openTool } from './lib/helpers.mjs';

export const title = 'calendar 🚀 launch windows';

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const add = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n, 12)); };
const TODAY = iso(new Date());
const MONDAY = add(TODAY, -((new Date().getDay() + 6) % 7));   // this week's Monday
const fri = w => add(MONDAY, 7 * w + 4);                        // the Friday w weeks from this week
const tue = w => add(MONDAY, 7 * w + 1);

// The day the clock moves to: `days` from today (as tests/day-rollover.test.mjs does)
const launchDayDiff = (a, b) => (Date.parse(b + 'T00:00Z') - Date.parse(a + 'T00:00Z')) / 86400000;

const shiftClock = days => `if (!window.__RealDate) window.__RealDate = Date;
    const Real = window.__RealDate, r = new Real();
    const t = new Real(r.getFullYear(), r.getMonth(), r.getDate() + ${days}, 0, 5), shift = t - Real.now();
    window.Date = class extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + shift])); } static now() { return Real.now() + shift; } };
    window.dispatchEvent(new Event('focus'));
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');`;

function launchDb() {
    const db = fixtureDb();
    db.rooms.R1G2 = { name: 'Grow 2', description: null, createdDate: '2026-01-01', assignedLots: ['L300'], isFlowering: true, buildingId: 'B1' };
    db.buildings.B1.assignedRooms.push('R1G2');
    db.rooms.R1G1.assignedLots.push('L101');
    const lot = (id, room, strain) => ({ name: id, strain, stage: 'flower', createdDate: '2026-08-01', closedDate: null, destRoom: room, cloningRoom: 'Clone 1', vegRoom: null, currentRoom: room, plantCount: 50 });
    db.lots.L101 = { ...lot('L101', 'Grow 1', 'Test Kush'), stage: 'cloning', currentRoom: 'Clone 1' };
    db.lots.L300 = lot('L300', 'Grow 2', 'Green Test');
    db.lots.L500 = { ...lot('L500', 'Grow A', 'Blue Test'), stage: 'veg', currentRoom: 'Clone 1' };   // no schedule yet
    db.lots.M1 = { ...lot('M1', 'Grow 2', 'Mother Test'), stage: 'mother', _tool_CropLabourWizard: { kind: 'vegetative' } };
    const ev = (id, lotId, taskType, date, extra = {}) => ({ id, date, title: `${taskType} ${lotId}`, sourceTool: 'CropLabourWizard', lotId, taskType, roomPhase: 'flower', ...extra });
    db.calendarEvents.push(
        // The staircase: Grow A flipped 8 weeks ago, Grow 1 5 weeks ago, Grow 2 last week (on a Tuesday, with no harvest task)
        ev('ev_lw_f200', 'L200', 'flip', fri(-8)), ev('ev_lw_h200', 'L200', 'harvest', add(fri(-8), 63)),
        ev('ev_lw_f100', 'L100', 'flip', fri(-5)), ev('ev_lw_h100', 'L100', 'harvest', add(fri(-5), 63)),
        ev('ev_lw_f300', 'L300', 'flip', tue(-1)),
        // Grow 1's next lot, 70 days on
        ev('ev_lw_f101', 'L101', 'flip', fri(5)), ev('ev_lw_h101', 'L101', 'harvest', add(fri(5), 63)),
        // A 📋 copy of a flip, and a flip of a lot no longer in the DB: neither is a crop
        { ...ev('ev_lw_copy', 'L200', 'flip', fri(-4)), copyOf: 'ev_lw_f200' },
        ev('ev_lw_f999', 'L999', 'flip', fri(-6)), ev('ev_lw_h999', 'L999', 'harvest', add(fri(-6), 63)),
        // Projections: Grow A's next lot (takes its window), Grow 2's stale one, Grow 1's TBA-02 overlapping L101
        { id: 'ev_lw_pA1', date: fri(3), title: 'Flip R2G1-TBA-01', sourceTool: 'CropProjection', lotId: 'R2G1-TBA-01', roomId: 'R2G1', taskType: 'flip' },
        { id: 'ev_lw_pA1h', date: add(fri(3), 63), title: 'Harvest R2G1-TBA-01', sourceTool: 'CropProjection', lotId: 'R2G1-TBA-01', roomId: 'R2G1', taskType: 'harvest' },
        { id: 'ev_lw_p21', date: fri(-3), title: 'Flip R1G2-TBA-01', sourceTool: 'CropProjection', lotId: 'R1G2-TBA-01', roomId: 'R1G2', taskType: 'flip' },
        { id: 'ev_lw_p21h', date: add(fri(-3), 63), title: 'Harvest R1G2-TBA-01', sourceTool: 'CropProjection', lotId: 'R1G2-TBA-01', roomId: 'R1G2', taskType: 'harvest' },
        { id: 'ev_lw_p12', date: fri(5), title: 'Flip R1G1-TBA-02', sourceTool: 'CropProjection', lotId: 'R1G1-TBA-02', roomId: 'R1G1', taskType: 'flip' },
        { id: 'ev_lw_p12h', date: add(fri(5), 63), title: 'Harvest R1G1-TBA-02', sourceTool: 'CropProjection', lotId: 'R1G1-TBA-02', roomId: 'R1G1', taskType: 'harvest' });
    db._CropLabourWizard = { projectedLots: {
        'R2G1-TBA-01': { name: 'R2G1-TBA-01', roomId: 'R2G1', roomName: 'Grow A', strain: 'TBA', index: 1 },
        'R1G2-TBA-01': { name: 'R1G2-TBA-01', roomId: 'R1G2', roomName: 'Grow 2', strain: 'TBA', index: 1 },
        'R1G1-TBA-02': { name: 'R1G1-TBA-02', roomId: 'R1G1', roomName: 'Grow 1', strain: 'TBA', index: 2 } } };
    return db;
}

// What the view shows: the summary, each row's open / taken, its bars (event id + classes) and ghost, the tables
const READ = `const v = document.getElementById('launchView');
    return { shown: !v.classList.contains('hidden'), summary: v.querySelector('.launch-summary')?.textContent.replace(/\\s+/g, ' ').trim() || '',
        rows: [...v.querySelectorAll('.launch-row:not(.launch-axis)')].map(r => ({ open: r.classList.contains('open'), label: r.querySelector('.launch-label').textContent.replace(/\\s+/g, ' ').trim(),
            bars: [...r.querySelectorAll('.launch-bar')].map(b => ({ id: b.dataset.eventId, cls: b.className, text: b.textContent })), ghost: r.querySelector('.launch-ghost')?.textContent || null })),
        ghosts: [...v.querySelectorAll('.launch-ghost')].map(g => g.dataset.flip),
        windows: [...v.querySelectorAll('.launch-table tbody tr.launch-window')].map(tr => ({ flip: tr.dataset.flip, open: tr.classList.contains('open'), projected: tr.classList.contains('projected'),
            cells: [...tr.cells].map(td => td.textContent.replace(/\\s+/g, ' ').trim()) })),
        months: [...v.querySelectorAll('.launch-table tbody tr.launch-month-row')].map(tr => tr.textContent.trim()),
        sub: v.querySelector('.launch-year .launch-sub')?.textContent.replace(/\\s+/g, ' ').trim() || '',
        checks: [...v.querySelectorAll('.launch-panel.warn li')].map(li => li.textContent.replace(/\\s+/g, ' ').trim()),
        note: v.querySelector('.launch-note')?.textContent || null, title: document.getElementById('calendarTitle').textContent };`;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);

    // ---- The rules on a fixed day: the example DB's crops as of Thursday 2026-10-29 ----
    const m = await b.run(main, `
        const data = { lots: { 1137: {}, 1171: {}, 1179: {}, 1190: {} }, rooms: { G1: { name: 'Albatross 1', isFlowering: true }, G2: { name: 'Albatross 2', isFlowering: true }, H2: { name: 'Heron 2', isFlowering: true } } };
        const room = { 1137: 'G2', 1171: 'G1', 1179: 'H2', 1190: 'G2' };
        const evs = [['1137', '2026-06-16', '2026-08-18'], ['1171', '2026-09-03', '2026-11-05'], ['1179', '2026-08-25', '2026-10-27'], ['1190', '2026-08-31', '2026-11-02']]
            .flatMap(([lot, f, h]) => [{ id: 'f' + lot, sourceTool: 'CropLabourWizard', lotId: lot, taskType: 'flip', date: f }, { id: 'h' + lot, sourceTool: 'CropLabourWizard', lotId: lot, taskType: 'harvest', date: h }]);
        const crops = launchCrops(data, evs, evs, ev => room[ev.lotId], '2026-10-29');
        const M = launchModel(crops, { asOf: '2026-10-26', today: '2026-10-29', rooms: Object.entries(data.rooms).map(([id, r]) => ({ id, name: r.name })) });
        return { from: M.from, taken: M.taken, open: M.open, row1: M.rows[0].items.map(i => i.crop.lotId + '@' + i.lane), row10: M.rows[9].items.map(i => i.crop.lotId), row10open: !M.rows[9].taken,
            overlaps: M.overlaps.map(o => o.monday + ':' + o.crops.map(c => c.lotId).join('+')),
            windows: M.windows.map(w => ({ flip: w.flip, cut: w.cut, harvest: w.harvest, cutPassed: w.cutPassed, taken: w.taken, row: w.k + 1, free: w.freeRooms.map(x => x.name), hol: w.holidays.map(h => h.what + ':' + h.holiday.name) })) };`);
    check('row 1 is the week the oldest crop in bloom flipped (Mon Aug 31)', m.from === '2026-08-31', m.from);
    check('1190 (Mon) and 1171 (Thu) flipped the same week: one row, two lanes', JSON.stringify(m.row1) === JSON.stringify(['1190@0', '1171@1']), JSON.stringify(m.row1));
    check('…and harvest the same week: ⚠️ one overlap, the week of Nov 2', JSON.stringify(m.overlaps) === JSON.stringify(['2026-11-02:1190+1171']), JSON.stringify(m.overlaps));
    check('1179 (harvested Oct 27) is drawn in row 10, which is open', JSON.stringify(m.row10) === '["1179"]' && m.row10open, JSON.stringify(m.row10));
    check('1 of 10 taken, 9 open', m.taken === 1 && m.open === 9, `${m.taken} / ${m.open}`);
    // The next 12 months: a window every Friday from this week's
    const flips = m.windows.map(w => w.flip);
    check('52 weekly windows listed, every Friday from Oct 30 to Oct 22, 2027', flips.length === 52 && flips[0] === '2026-10-30' && flips[51] === '2027-10-22'
        && flips.every((f, i) => !i || launchDayDiff(flips[i - 1], f) === 7), JSON.stringify([flips.length, flips[0], flips[51]]));
    check('nothing flips from today on: all 52 open', m.windows.every(x => !x.taken), JSON.stringify(m.windows.filter(x => x.taken).map(x => x.flip)));
    const w = Object.fromEntries(m.windows.map(x => [x.flip, x]));
    check('each window keeps its row: Oct 30 is Wk 9, and Nov 13 Wk 1 again', w['2026-10-30'].row === 9 && w['2026-11-06'].row === 10 && w['2026-11-13'].row === 1 && w['2027-01-22'].row === 1,
        JSON.stringify([w['2026-10-30'].row, w['2026-11-06'].row, w['2026-11-13'].row, w['2027-01-22'].row]));
    check('clones are cut 34 days before (a Saturday), harvest 63 days after (a Friday)', m.windows.every(x => new Date(x.cut + 'T12:00').getDay() === 6 && new Date(x.harvest + 'T12:00').getDay() === 5)
        && w['2026-12-04'].cut === '2026-10-31' && w['2026-12-04'].harvest === '2027-02-05', JSON.stringify(w['2026-12-04']));
    check('the clone-cut day has passed for the windows through Nov 27, not from Dec 4', m.windows.every(x => x.cutPassed === (x.flip <= '2026-11-27')), JSON.stringify(m.windows.map(x => x.flip + ':' + x.cutPassed)));
    check('🏛️ Christmas, New Year\'s Day and Good Friday flips, and the Oct 30 window\'s New Year\'s harvest', JSON.stringify(w['2026-12-25'].hol) === '["Flip:Christmas Day"]'
        && JSON.stringify(w['2027-01-01'].hol) === '["Flip:New Year\'s Day"]' && JSON.stringify(w['2026-10-30'].hol) === '["Harvest:New Year\'s Day"]'
        && JSON.stringify(w['2027-03-26'].hol) === '["Flip:Good Friday"]',
        JSON.stringify([w['2026-12-25'].hol, w['2027-01-01'].hol, w['2026-10-30'].hol, w['2027-03-26'].hol]));
    check('free rooms: none for Oct 30 (Heron 2 harvests Oct 27), Heron 2 for Nov 6, all three from Nov 13 (the Albatross crops harvest the week before)',
        JSON.stringify(w['2026-10-30'].free) === '[]' && JSON.stringify(w['2026-11-06'].free) === '["Heron 2"]' && w['2026-11-13'].free.length === 3 && w['2026-11-20'].free.length === 3,
        JSON.stringify([w['2026-10-30'].free, w['2026-11-06'].free, w['2026-11-13'].free]));

    // A long bloom (flipped 11 weeks ago, still in bloom): row 1 goes back no further than 9 weeks, every 🚀 stays in range
    const long = await b.run(main, `
        const today = localDate(), mon = launchMonday(launchWeekOf(today));
        const f = launchAdd(mon, -77 + 4), evs = [{ id: 'f', sourceTool: 'CropLabourWizard', lotId: 'X', taskType: 'flip', date: f }, { id: 'h', sourceTool: 'CropLabourWizard', lotId: 'X', taskType: 'harvest', date: launchAdd(today, 14) }];
        const M = launchModel(launchCrops({ lots: { X: {} }, rooms: {} }, evs, evs, () => null, today), { asOf: mon, today });
        return { back: (launchDay(mon) - launchDay(M.from)) / 7, inRange: M.rows.every(r => r.next.flip >= M.from && r.next.flip <= M.to), taken: M.taken };`);
    check('a long bloom: row 1 is 9 weeks back, not 11, and every next window is in range', long.back === 9 && long.inRange && long.taken === 1, JSON.stringify(long));

    // The timeline runs out to the last crop's harvest, projections included (user request 2026-10-30), at most 3 years
    const far = await b.run(main, `
        const today = localDate(), mon = launchMonday(launchWeekOf(today)), rooms = { G: { name: 'G' } };
        const lot = (id, flip, p) => [{ id: 'f' + id, sourceTool: p ? 'CropProjection' : 'CropLabourWizard', lotId: id, roomId: 'G', taskType: 'flip', date: flip },
            { id: 'h' + id, sourceTool: p ? 'CropProjection' : 'CropLabourWizard', lotId: id, roomId: 'G', taskType: 'harvest', date: launchAdd(flip, 63) }];
        const model = evs => launchModel(launchCrops({ lots: { X: {} }, rooms }, evs, evs, () => 'G', today), { asOf: mon, today });
        const near = model(lot('X', launchAdd(mon, 4)));
        const out = model([...lot('X', launchAdd(mon, 4)), ...lot('G-TBA-05', launchAdd(mon, 7 * 40 + 4), true)]);
        const bogus = model([...lot('X', launchAdd(mon, 4)), ...lot('G-TBA-09', launchAdd(mon, 7 * 400 + 4), true)]);
        return { near: near.weeks, nearTo: near.to, out: out.weeks, outTo: out.to, harvest: launchAdd(launchAdd(mon, 7 * 40 + 4), 63), bogus: bogus.weeks };`);
    check('with nothing far out, two cycles from this week (20 weeks, row 1 this week)', far.near === 20, JSON.stringify(far));
    check('a projection flipping in 40 weeks: the timeline runs to the end of its harvest week', far.out === 50 && far.outTo >= far.harvest && launchDayDiff(far.harvest, far.outTo) < 7, JSON.stringify(far));
    check('…never more than 3 years (a date 8 years out doesn\'t stretch it)', far.bogus === 156, JSON.stringify(far));

    // The 12-month list: a window is taken by the crops flipping that week (real or projected; a stale or superseded
    // projection doesn't count), open otherwise; an open one notes a crop already harvesting the week it would
    const year = await b.run(main, `
        const today = localDate(), mon = launchMonday(launchWeekOf(today)), T = launchWeekOf(today), rooms = { G: { name: 'G' }, H: { name: 'H' } };
        const lot = (id, room, flip, bloom, p) => [{ id: 'f' + id, sourceTool: p ? 'CropProjection' : 'CropLabourWizard', lotId: id, roomId: room, taskType: 'flip', date: flip },
            { id: 'h' + id, sourceTool: p ? 'CropProjection' : 'CropLabourWizard', lotId: id, roomId: room, taskType: 'harvest', date: launchAdd(flip, bloom) }];
        const fri = n => launchFriday(T + n), room = { X: 'G', Y: 'H', Z: 'G' };
        const evs = [...lot('X', 'G', fri(2), 70), ...lot('Y', 'H', fri(2), 63), ...lot('G-TBA-01', 'G', fri(13), 63, true), ...lot('G-TBA-02', 'G', fri(6), 63, true)];
        const M = launchModel(launchCrops({ lots: { X: {}, Y: {} }, rooms }, evs, evs, ev => ev.roomId, today), { asOf: mon, today });
        const at = n => M.windows.find(w => w.week === T + n);
        const o = n => ({ by: at(n).by.map(c => c.lotId), taken: at(n).taken, projected: at(n).projected, shared: at(n).sharedHarvest.map(c => c.lotId) });
        return { first: M.windows[0].week - T, two: o(2), proj: o(13), superseded: o(6), shared: o(3), plain: o(4) };`);
    check('two crops flipping the same week both take it (a real one: not "projected")', JSON.stringify(year.two) === JSON.stringify({ by: ['X', 'Y'], taken: true, projected: false, shared: [] }), JSON.stringify(year.two));
    check('…a projection takes its week, marked projected; one overlapping a real lot in its room doesn\'t',
        year.proj.taken && year.proj.projected && JSON.stringify(year.proj.by) === '["G-TBA-01"]' && !year.superseded.taken, JSON.stringify([year.proj, year.superseded]));
    check('…an open window whose harvest week another crop already harvests in names it (X\'s 10-week bloom)', !year.shared.taken && JSON.stringify(year.shared.shared) === '["X"]'
        && JSON.stringify(year.plain.shared) === '[]', JSON.stringify([year.shared, year.plain]));

    // ---- The view ----
    await loadSingle(b, main, launchDb());
    await b.run(main, `document.getElementById('viewLaunchBtn').click();`, { user: true });
    let v = await b.run(main, READ);
    const views = await b.run(main, `return { active: document.getElementById('viewLaunchBtn').classList.contains('active'),
        others: ['annualView', 'weekView', 'mothersView'].every(id => document.getElementById(id).classList.contains('hidden')) && document.getElementById('calendarGrid').closest('.calendar-grid-wrapper').classList.contains('hidden'),
        print: document.getElementById('printYearBtn').classList.contains('hidden') };`);
    check('🚀 Launch windows is the active view; the month grid, 7-day, annual and 🌿 mothers views are hidden; no 🖨️', v.shown && views.active && views.others && views.print, JSON.stringify(views));
    const [y, mo, d] = MONDAY.split('-').map(Number);
    const weekOf = new Date(y, mo - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    check('title: "🚀 Launch Windows — week of <this Monday>"', v.title === `🚀 Launch Windows — week of ${weekOf}`, v.title);
    check('10 rows', v.rows.length === 10, String(v.rows.length));
    const ids = r => v.rows[r].bars.map(x => x.id);
    check('row 1: Grow A\'s lot, flipped 8 weeks ago', JSON.stringify(ids(0)) === '["ev_lw_f200"]', JSON.stringify(ids(0)));
    check('row 2: Grow A\'s projected next lot, dashed, taking its window', JSON.stringify(ids(1)) === '["ev_lw_pA1"]' && v.rows[1].bars[0].cls.includes('projection') && !v.rows[1].open, JSON.stringify(v.rows[1]));
    check('row 4: Grow 1\'s lot and, 70 days on, its next lot in the same lane (plus the superseded TBA-02)',
        JSON.stringify(ids(3)) === '["ev_lw_f100","ev_lw_f101","ev_lw_p12"]' && v.rows[3].bars[2].cls.includes('superseded'), JSON.stringify(v.rows[3].bars));
    check('row 8: Grow 2\'s Tuesday flip, its harvest estimated (no harvest task)', JSON.stringify(ids(7)) === '["ev_lw_f300"]' && v.rows[7].bars[0].cls.includes('estimated') && v.rows[7].bars[0].text.includes('est.'), JSON.stringify(v.rows[7]));
    check('row 6: the stale projection is drawn but leaves its window open', JSON.stringify(ids(5)) === '["ev_lw_p21"]' && v.rows[5].bars[0].cls.includes('stale') && v.rows[5].open, JSON.stringify(v.rows[5]));
    check('the 📋 copy and the lot no longer in the DB aren\'t drawn', !v.rows.some(r => r.bars.some(x => x.id === 'ev_lw_copy' || x.id === 'ev_lw_f999')));
    check('4 of 10 taken · 6 open, no overlap', v.summary.startsWith('4 of 10 windows taken · 6 open') && !v.summary.includes('overlap'), v.summary);
    const openFlips = new Set(v.windows.filter(x => x.open).map(x => x.flip));
    check('every open row has a 🚀, and its Friday is an open window in the 12-month list', v.rows.filter(r => r.open).every(r => r.ghost?.startsWith('🚀')) && v.ghosts.length === 6
        && v.ghosts.every(f => openFlips.has(f)), JSON.stringify([v.ghosts, [...openFlips].slice(0, 8)]));
    const wk = Math.floor((Date.parse(TODAY) - Date.parse(fri(-5))) / 86400000 / 7) + 1;
    check('the bars name the lot, room and bloom week', v.rows[3].bars[0].text.includes(`L100 · Grow 1 · wk ${wk}/9`), v.rows[3].bars[0].text);
    check('⚠️ Check these: Grow 1\'s projections to reproject, the stale one, and L500 with no flip (not the mother M1)',
        v.checks.some(t => t.includes('Grow 1') && t.includes('Reproject')) && v.checks.some(t => t.includes('R1G2-TBA-01') && t.includes('passed'))
        && v.checks.some(t => t.includes('Lot L500') && t.includes('no flip')) && !v.checks.some(t => t.includes('M1')), JSON.stringify(v.checks));

    // A bar opens its Flip to Flower task in the event panel
    await b.run(main, `document.querySelector('#launchView .launch-bar[data-event-id="ev_lw_f100"]').click();`, { user: true });
    const sel = await b.run(main, `return { id: Calendar.selectedEvent?.id, selected: !!document.querySelector('#launchView .launch-bar.selected[data-event-id="ev_lw_f100"]'), panel: document.getElementById('eventPanelBody').textContent };`);
    check('clicking a bar selects its flip task (event panel, bar outlined)', sel.id === 'ev_lw_f100' && sel.selected && sel.panel.includes('flip L100'), JSON.stringify(sel).slice(0, 200));

    // ---- Filters: building B2 only; a task-type filter changes nothing; a lot filter ----
    v = await b.run(main, `Calendar.filters = [{ key: 'building', value: 'Building 2 (B2)' }]; Calendar.render(); ${READ}`);
    const allIds = x => x.rows.flatMap(r => r.bars.map(b => b.id)).sort();
    check('building filter B2: only Grow A\'s crops; Grow A the only room offered', JSON.stringify(allIds(v)) === '["ev_lw_f200","ev_lw_pA1"]' && v.windows.every(x => x.open ? (x.cells[5] === 'Grow A' || x.cells[5] === 'none free') : x.cells[5] === '—'), JSON.stringify([allIds(v), v.windows.map(x => x.cells[5])]));
    v = await b.run(main, `Calendar.filters = [{ key: 'taskType', value: 'equipment_maintenance' }]; Calendar.render(); ${READ}`);
    check('a task-type filter doesn\'t empty the view, and says it doesn\'t apply', allIds(v).length === 7 && /don't apply/.test(v.note || ''), JSON.stringify([allIds(v), v.note]));
    v = await b.run(main, `Calendar.filters = [{ key: 'lot', value: 'L100' }]; Calendar.render(); ${READ}`);
    check('a lot filter: only L100, which is row 1 now', JSON.stringify(allIds(v)) === '["ev_lw_f100"]' && v.rows[0].bars[0]?.id === 'ev_lw_f100' && v.summary.startsWith('1 of 10'), JSON.stringify([allIds(v), v.summary]));
    await b.run(main, `Calendar.filters = []; Calendar.render();`);

    // ---- 🚀 Every launch window for the next 12 months (user request 2026-10-30) ----
    const heads = await b.run(main, `return [...document.querySelectorAll('#launchView .launch-year .launch-table thead th')].map(th => th.textContent.trim());`);
    check('the table under the chart lists every window: Wk, Flip, Cut clones, Harvest, Window, Flower rooms free, Notes',
        JSON.stringify(heads) === JSON.stringify(['Wk', 'Flip', 'Cut clones*', 'Harvest', 'Window', 'Flower rooms free', 'Notes']), JSON.stringify(heads));
    v = await b.run(main, READ);
    const first = TODAY > fri(0) ? 1 : 0;   // this Friday, unless it has passed
    const win = f => v.windows.find(x => x.flip === f);
    check('52 windows, a Friday a week from this one (or next week\'s once it has passed)', v.windows.length === 52 && v.windows[0].flip === fri(first) && v.windows[51].flip === fri(first + 51),
        JSON.stringify([v.windows.length, v.windows[0]?.flip, v.windows[51]?.flip]));
    check('…under a heading for each month', v.months.length === new Set(v.windows.map(x => x.flip.slice(0, 7))).size
        && v.months[0] === new Date(fri(first) + 'T12:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), JSON.stringify(v.months));
    check('Grow A\'s projected lot takes its week: "🔮 TBA-01 · Grow A · projected", no rooms offered', win(fri(3))?.projected && win(fri(3)).cells[4] === '🔮 TBA-01 · Grow A · projected' && win(fri(3)).cells[5] === '—',
        JSON.stringify(win(fri(3))));
    check('L101 takes its week; Grow 1\'s superseded TBA-02 flipping then isn\'t listed', !win(fri(5))?.open && !win(fri(5)).projected && win(fri(5)).cells[4].includes('L101 · Grow 1') && !win(fri(5)).cells[4].includes('TBA-02'),
        JSON.stringify(win(fri(5))));
    check('the open ones say 🚀 open with the rooms free, and the summary counts them: 1 taken by lots · 1 projected · 50 open',
        v.windows.filter(x => x.open).length === 50 && v.windows.filter(x => x.open).every(x => x.cells[4] === '🚀 open' && x.cells[5] !== '—') && v.sub.includes('1 taken by lots · 1 projected · 50 🚀 open'),
        JSON.stringify([v.sub, v.windows.filter(x => x.open).length]));
    check('…each keeps its row in the chart: a window and the one 10 weeks on share their Wk', v.windows.every((x, i) => i < 10 || x.cells[0] === v.windows[i - 10].cells[0]), JSON.stringify(v.windows.slice(0, 12).map(x => x.cells[0])));
    // Grow 2's TBA-02 flipping in row 6 a cycle after its next window: that week is taken, the chart's row 6 stays open
    const projFlip = fri(17);
    await b.run(main, `DB.data._CropLabourWizard.projectedLots['R1G2-TBA-02'] = { name: 'R1G2-TBA-02', roomId: 'R1G2', roomName: 'Grow 2', strain: 'TBA', index: 2 };
        DB.data.calendarEvents.push({ id: 'ev_lw_p22', date: '${projFlip}', title: 'Flip R1G2-TBA-02', sourceTool: 'CropProjection', lotId: 'R1G2-TBA-02', roomId: 'R1G2', taskType: 'flip' },
            { id: 'ev_lw_p22h', date: '${add(projFlip, 63)}', title: 'Harvest R1G2-TBA-02', sourceTool: 'CropProjection', lotId: 'R1G2-TBA-02', roomId: 'R1G2', taskType: 'harvest' });
        Calendar.onDbChanged(); Calendar.render();`);
    v = await b.run(main, READ);
    check('a projection a cycle after an open window: its week is taken ("🔮 TBA-02 · Grow 2 · projected"), in the same Wk as that window',
        win(projFlip)?.projected && win(projFlip).cells[4] === '🔮 TBA-02 · Grow 2 · projected' && win(projFlip).cells[0] === 'Wk 6' && win(fri(7))?.open && win(fri(7)).cells[0] === 'Wk 6',
        JSON.stringify([win(projFlip), win(fri(7))]));
    check('…the chart still has 6 open and the list 2 projected', v.summary.startsWith('4 of 10 windows taken · 6 open') && v.sub.includes('1 taken by lots · 2 projected · 49 🚀 open'), JSON.stringify([v.summary, v.sub]));
    await b.run(main, `DB.data.calendarEvents = DB.data.calendarEvents.filter(e => !e.id.startsWith('ev_lw_p22')); delete DB.data._CropLabourWizard.projectedLots['R1G2-TBA-02'];
        Calendar.onDbChanged(); Calendar.render();`);

    // ---- Scrolling sideways out to the last projection ----
    const farFlip = fri(45);
    await b.run(main, `DB.data._CropLabourWizard.projectedLots['R2G1-TBA-05'] = { name: 'R2G1-TBA-05', roomId: 'R2G1', roomName: 'Grow A', strain: 'TBA', index: 5 };
        DB.data.calendarEvents.push({ id: 'ev_lw_far', date: '${farFlip}', title: 'Flip R2G1-TBA-05', sourceTool: 'CropProjection', lotId: 'R2G1-TBA-05', roomId: 'R2G1', taskType: 'flip' },
            { id: 'ev_lw_farh', date: '${add(farFlip, 63)}', title: 'Harvest R2G1-TBA-05', sourceTool: 'CropProjection', lotId: 'R2G1-TBA-05', roomId: 'R2G1', taskType: 'harvest' });
        Calendar.onDbChanged(); Calendar.render();`);
    const sc = await b.run(main, `const v = document.getElementById('launchView'), box = v.querySelector('.launch-scroll'), chart = v.querySelector('.launch-chart');
        const bar = v.querySelector('.launch-bar[data-event-id="ev_lw_far"]'), label = v.querySelector('.launch-row:not(.launch-axis) .launch-label');
        const before = { scroll: box.scrollWidth, box: box.clientWidth, weeks: chart.style.getPropertyValue('--weeks'), sticky: getComputedStyle(label).position };
        box.scrollLeft = box.scrollWidth;
        await new Promise(r => setTimeout(r, 50));
        const b2 = box.getBoundingClientRect(), br = bar?.getBoundingClientRect(), lr = label.getBoundingClientRect();
        return { ...before, bar: !!bar, barShown: !!br && br.left >= b2.left && br.left < b2.right, labelAtLeft: Math.abs(lr.left - b2.left) < 3,
            months: [...v.querySelectorAll('.launch-axis .launch-month')].map(m => m.textContent).slice(-2), intro: v.querySelector('.launch-intro').textContent };`);
    check('a projection flipping in 45 weeks is drawn, and the timeline runs out to it (row 1 8 weeks back: 63 weeks)', sc.bar && sc.weeks === '63', JSON.stringify(sc));
    check('…the chart scrolls sideways inside its box; scrolled to the end, that projection is in view', sc.scroll > sc.box * 2.5 && sc.barShown, JSON.stringify(sc));
    check('…and each row\'s label stays at the left edge while it scrolls', sc.sticky === 'sticky' && sc.labelAtLeft, JSON.stringify(sc));
    check('…the intro says how far it goes', sc.intro.includes('Scroll sideways'), sc.intro);
    v = await b.run(main, READ);
    check('…the far projection doesn\'t take a window this week, and is listed in its own week', v.summary.startsWith('4 of 10 windows taken · 6 open')
        && v.windows.find(x => x.flip === farFlip)?.cells[4] === '🔮 TBA-05 · Grow A · projected', JSON.stringify([v.summary, v.windows.find(x => x.flip === farFlip)]));
    await b.run(main, `DB.data.calendarEvents = DB.data.calendarEvents.filter(e => !e.id.startsWith('ev_lw_far')); delete DB.data._CropLabourWizard.projectedLots['R2G1-TBA-05'];
        Calendar.onDbChanged(); Calendar.render();`);

    // ---- Prev / Next / Today ----
    const nav = await b.run(main, `const out = [];
        document.getElementById('nextMonthBtn').click(); out.push(Calendar.launchWeek);
        document.getElementById('prevMonthBtn').click(); document.getElementById('prevMonthBtn').click(); out.push(Calendar.launchWeek);
        document.getElementById('todayBtn').click(); out.push(Calendar.launchWeek, Calendar.viewMode);
        return out;`, { user: true });
    check('Next / Prev move a week, Today comes back to this week', JSON.stringify(nav) === JSON.stringify([add(MONDAY, 7), add(MONDAY, -7), MONDAY, 'launch']), JSON.stringify(nav));
    const back = await b.run(main, `document.getElementById('viewMonthBtn').click(); return { launch: document.getElementById('launchView').classList.contains('hidden'), grid: !document.getElementById('calendarGrid').closest('.calendar-grid-wrapper').classList.contains('hidden') };`, { user: true });
    check('back to 📆 Monthly hides the launch windows', back.launch && back.grid, JSON.stringify(back));
    await b.run(main, `document.getElementById('viewLaunchBtn').click();`, { user: true });

    // ---- No sideways page scroll on a tablet ----
    await b.send('browsingContext.setViewport', { context: main, viewport: { width: 800, height: 1280 } });
    const wide = await b.run(main, `await new Promise(r => setTimeout(r, 100)); return { page: document.documentElement.scrollWidth, view: innerWidth };`);
    check('at 800 px the page doesn\'t scroll sideways', wide.page <= wide.view, JSON.stringify(wide));
    await b.send('browsingContext.setViewport', { context: main, viewport: null });

    // ---- The day rolling over: shown as of this week, it follows; a week picked by hand stays ----
    const roll1 = await b.run(main, shiftClock(7));
    let lw = await b.run(main, `return Calendar.launchWeek;`);
    check('a week later the view follows to the new week', lw === add(MONDAY, 7) && add(roll1, -((new Date(roll1 + 'T12:00').getDay() + 6) % 7)) === lw, `${lw} (${roll1})`);
    await b.run(main, `document.getElementById('prevMonthBtn').click();`, { user: true });
    await b.run(main, shiftClock(14));
    lw = await b.run(main, `return Calendar.launchWeek;`);
    check('a week picked by hand stays put when the day rolls over', lw === MONDAY, lw);
    await b.run(main, `window.Date = window.__RealDate;`);

    // ---- The figures match CropLabourWizard's default recipe ----
    const hub = await b.run(main, `return LAUNCH;`);
    const clw = await openTool(b, main, 'CropLabourWizard');
    const rec = await b.run(clw, `const o = freshLotDay0Offsets(BUILTIN_RECIPE); return { id: BUILTIN_RECIPE.id, lead: o.flip, bloom: o.harvestEnd - o.flip, cycle: recipeTurnaround(BUILTIN_RECIPE)?.cycle };`);
    check('LAUNCH matches sitka-9week: Day 1 → flip 34, flip → harvest 63, a new lot every 70 days',
        rec.id === 'sitka-9week' && rec.lead === hub.LEAD && rec.bloom === hub.BLOOM && rec.cycle === hub.CYCLE && hub.CYCLE === hub.SLOTS * 7, JSON.stringify({ hub, rec }));
    await b.run(main, `Tools.close();`);

    // ---- A building device: only the crops flowering in its building ----
    const files = await splitFiles(b, main, BASE, launchDb());
    const dev = await fresh(b);
    await openSplit(b, dev, BASE, 'B1', files);
    await b.run(dev, `document.getElementById('viewLaunchBtn').click();`, { user: true });
    v = await b.run(dev, READ);
    check('on Building 1\'s tablet: Grow 1 and Grow 2 only (not Grow A\'s lot or projection)',
        JSON.stringify(allIds(v)) === JSON.stringify(['ev_lw_f100', 'ev_lw_f101', 'ev_lw_f300', 'ev_lw_p12', 'ev_lw_p21']), JSON.stringify(allIds(v)));
    check('…and only its rooms are offered or listed', v.windows.every(x => !x.cells[4].includes('Grow A') && !x.cells[5].includes('Grow A')), JSON.stringify(v.windows.map(x => x.cells[5])));

    await leave(b, dev);
    await leave(b, main);
    return results;
}
