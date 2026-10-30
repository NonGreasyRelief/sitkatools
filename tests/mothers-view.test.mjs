// SitkaTools calendar: 🌿 Mothers (user request 2026-10-30), the 5th view beside 🚀 Launch windows. Each mother lot, real
// and projected (CropLabourWizard's 🌿 mothers from clones), is a bar by Mother room from its move-in to Retire Mothers,
// solid from the day its mothers are mature (the recipe's 🌿 Mature from, flagged motherMature on its event; the
// built-in's Second leaf pick for lots generated before). Below it, the clone cuts ahead with the mothers mature on each
// one's day. Checked: the rules on a fixed day, then the view (rows, bars, summary, the cuts table and its ⚠️, Check
// these, a bar opening its task), filters, Prev / Next / Today shared with 🚀, the day rolling over, a building device,
// no sideways scroll on a tablet, and the hub's fallback matching CropLabourWizard's built-in mother recipe.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, leave, splitFiles, openSplit, openTool } from './lib/helpers.mjs';

export const title = 'calendar 🌿 mothers: when which mothers are mature';

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const add = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n, 12)); };
const TODAY = iso(new Date());
const MONDAY = add(TODAY, -((new Date().getDay() + 6) % 7));   // this week's Monday
const t = n => add(TODAY, n);

const shiftClock = days => `if (!window.__RealDate) window.__RealDate = Date;
    const Real = window.__RealDate, r = new Real();
    const t = new Real(r.getFullYear(), r.getMonth(), r.getDate() + ${days}, 0, 5), shift = t - Real.now();
    window.Date = class extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + shift])); } static now() { return Real.now() + shift; } };
    window.dispatchEvent(new Event('focus'));
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');`;

// Mother 1 (B1): M100 mature now (flagged), M150 mature in 20 days (generated before the flag: its Second leaf pick),
// M160 with no mature day, the projected mothers R1G1-TBAMOM-01 (moving in in 10 days) and R1G1-TBAMOM-02 (its move-in
// passed: stale). Mother 2 (B2): R2G1-TBAMOM-01, moving in today, mature in 10 days. M170 is a mother lot with no schedule. Clone cuts:
// L100 in 3 days (M100 mature), L200 in 46 (none mature), the projected R1G1-TBA-01 in 50 (R1G1-TBAMOM-01 mature).
function db() {
    const d = fixtureDb();
    d.rooms.R1MO = { name: 'Mother 1', description: null, createdDate: '2026-01-01', assignedLots: ['M100', 'M150', 'M160', 'M170'], isFlowering: false, buildingId: 'B1', designation: 'Mother' };
    d.rooms.R2MO = { name: 'Mother 2', description: null, createdDate: '2026-01-01', assignedLots: [], isFlowering: false, buildingId: 'B2', designation: 'Mother' };
    d.buildings.B1.assignedRooms.push('R1MO');
    d.buildings.B2.assignedRooms.push('R2MO');
    const mlot = id => ({ name: id, strain: 'Test Kush', stage: 'mother', createdDate: t(-80), closedDate: null, type: 'new-lot', startPlantCount: 10,
        cloningRoom: 'Clone 1', vegRoom: null, destRoom: 'Mother 1', dryRoom: null, trimRoom: null, currentRoom: 'Mother 1', plantCount: 10,
        _tool_CropLabourWizard: { kind: 'vegetative', recipeId: 'sitka-mother', plantingDate: t(-80) } });
    for (const id of ['M100', 'M150', 'M160', 'M170']) d.lots[id] = mlot(id);
    const real = (id, taskType, n, extra = {}) => ({ id: `ev_mv_${id}_${taskType}`, date: t(n), title: `Mother 1#${id}, ${taskType}`, sourceTool: 'CropLabourWizard', lotId: id, taskType, roomPhase: 'flower', ...extra });
    const proj = (id, room, taskType, n, extra = {}) => ({ id: `ev_mv_${id}_${taskType}`, date: t(n), title: `${id}, ${taskType}`, sourceTool: 'CropProjection', lotId: id, roomId: room, taskType, ...extra });
    d.calendarEvents.push(
        real('M100', 'transplant', -50), real('M100', 'mother_pick2', -10, { motherMature: true }), real('M100', 'retire', 44),
        { ...real('M100', 'retire', 70), id: 'ev_mv_copy', copyOf: 'ev_mv_M100_retire', title: 'Mother 1#M100, retire (copy)' },
        real('M150', 'transplant', -20), real('M150', 'mother_pick2', 20), real('M150', 'retire', 45),
        real('M160', 'clone_cut_prep', 5, { roomPhase: 'cloning' }), real('M160', 'transplant', -5), real('M160', 'retire', 89),
        proj('R1G1-TBAMOM-01', 'R1MO', 'transplant', 10), proj('R1G1-TBAMOM-01', 'R1MO', 'mother_pick2', 50, { motherMature: true }), proj('R1G1-TBAMOM-01', 'R1MO', 'retire', 104),
        proj('R1G1-TBAMOM-02', 'R1MO', 'transplant', -3), proj('R1G1-TBAMOM-02', 'R1MO', 'mother_pick2', 37, { motherMature: true }), proj('R1G1-TBAMOM-02', 'R1MO', 'retire', 91),
        proj('R2G1-TBAMOM-01', 'R2MO', 'transplant', 0), proj('R2G1-TBAMOM-01', 'R2MO', 'mother_pick2', 10, { motherMature: true }), proj('R2G1-TBAMOM-01', 'R2MO', 'retire', 40),
        { id: 'ev_mv_L100_cut', date: t(3), title: 'R1CL-Test Kush#L100, Cutting Clones', sourceTool: 'CropLabourWizard', lotId: 'L100', taskType: 'clone_cut_prep', roomPhase: 'cloning' },
        { id: 'ev_mv_L100_flip', date: t(37), title: 'R1G1-Test Kush#L100, Flip', sourceTool: 'CropLabourWizard', lotId: 'L100', taskType: 'flip', roomPhase: 'flower' },
        { id: 'ev_mv_L200_cut', date: t(46), title: 'Blue Test#L200, Cutting Clones', sourceTool: 'CropLabourWizard', lotId: 'L200', taskType: 'clone_cut_prep', roomPhase: 'cloning' },
        { id: 'ev_mv_L200_flip', date: t(80), title: 'R2G1-Blue Test#L200, Flip', sourceTool: 'CropLabourWizard', lotId: 'L200', taskType: 'flip', roomPhase: 'flower' },
        proj('R1G1-TBA-01', 'R1G1', 'clone_cut_prep', 50), proj('R1G1-TBA-01', 'R1G1', 'flip', 84));
    const entry = (id, room, src, srcRoom) => ({ name: id, roomId: room, roomName: d.rooms[room].name, sourceRoomId: srcRoom, sourceLotId: src, strain: 'TBA', index: 1, recipeId: 'sitka-mother' });
    d._CropLabourWizard = { projectedLots: {
        'R1G1-TBA-01': { name: 'R1G1-TBA-01', roomId: 'R1G1', roomName: 'Grow 1', strain: 'TBA', index: 1 },
        'R1G1-TBAMOM-01': entry('R1G1-TBAMOM-01', 'R1MO', 'R1G1-TBA-01', 'R1G1'),
        'R1G1-TBAMOM-02': { ...entry('R1G1-TBAMOM-02', 'R1MO', 'R1G1-TBA-02', 'R1G1'), index: 2 },
        'R2G1-TBAMOM-01': entry('R2G1-TBAMOM-01', 'R2MO', 'R2G1-TBA-01', 'R2G1') } };
    return d;
}

// What the view shows
const READ = `const v = document.getElementById('mothersView');
    return { shown: !v.classList.contains('hidden'), summary: v.querySelector('.launch-summary')?.textContent.replace(/\\s+/g, ' ').trim() || '',
        rows: [...v.querySelectorAll('.launch-row:not(.launch-axis)')].map(r => ({ label: r.querySelector('.launch-label').textContent.replace(/\\s+/g, ' ').trim(),
            bars: [...r.querySelectorAll('.launch-bar')].map(b => ({ lot: b.dataset.lot, id: b.dataset.eventId, cls: b.className, text: b.textContent, m: b.style.getPropertyValue('--m') })) })),
        cuts: [...v.querySelectorAll('.mothers-table tbody tr')].map(tr => [...tr.cells].map(td => td.textContent.replace(/\\s+/g, ' ').trim())),
        checks: [...v.querySelectorAll('.launch-panel.warn li')].map(li => li.textContent.replace(/\\s+/g, ' ').trim()),
        note: v.querySelector('.launch-note')?.textContent || null, title: document.getElementById('calendarTitle').textContent };`;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);

    // ---- The rules on a fixed day: Wednesday 2026-11-04, the week of Monday Nov 2 ----
    const r = await b.run(main, `
        const data = { lots: { M1: {} }, rooms: { MO: { name: 'Mother' } }, _CropLabourWizard: { projectedLots: { 'G-TBAMOM-01': { sourceRoomId: 'G', sourceLotId: 'G-TBA-01' } } } };
        const ev = (lotId, taskType, date, x = {}) => ({ id: lotId + taskType, lotId, taskType, date, sourceTool: x.p ? 'CropProjection' : 'CropLabourWizard', roomId: 'MO', ...(x.m ? { motherMature: true } : {}) });
        const events = [ev('M1', 'planting', '2026-08-01'), ev('M1', 'mother_pick2', '2026-09-20'), ev('M1', 'retire', '2026-11-20'),
            ev('G-TBAMOM-01', 'transplant', '2026-11-01', { p: 1 }), ev('G-TBAMOM-01', 'mother_top', '2026-11-30', { p: 1, m: 1 }), ev('G-TBAMOM-01', 'retire', '2027-02-03', { p: 1 })];
        const crops = motherCrops(data, events.filter(e => e.taskType === 'retire'), events, e => e.roomId, '2026-11-04');
        const M = mothersModel(crops, [{ date: '2026-11-07' }, { date: '2026-11-25' }, { date: '2026-12-01' }, { date: '2027-03-01' }], { asOf: '2026-11-02', today: '2026-11-04' });
        return { crops: crops.map(c => [c.lotId, c.moveIn, c.mature, c.retire, c.stale, c.from?.lotId || null]), from: M.from, to: M.to, day: M.day,
            inWeek: M.inWeek.map(c => c.lotId), mature: M.mature.map(c => c.lotId), soon: M.soon.map(c => c.lotId), cuts: M.cuts.map(c => [c.date, c.mothers.map(m => m.lotId)]) };`);
    check('a real mother lot moves in at Planting (no Transplanting) and is mature from its Second leaf pick when nothing is flagged',
        JSON.stringify(r.crops[0]) === JSON.stringify(['M1', '2026-08-01', '2026-09-20', '2026-11-20', false, null]), JSON.stringify(r.crops[0]));
    check('a projection: mature from the task flagged motherMature, stale once its move-in has passed, from its flower lot',
        JSON.stringify(r.crops[1]) === JSON.stringify(['G-TBAMOM-01', '2026-11-01', '2026-11-30', '2027-02-03', true, 'G-TBA-01']), JSON.stringify(r.crops[1]));
    check('26 weeks drawn, from 8 weeks before the week shown; the as-of day is today in this week', r.from === '2026-09-07' && r.to === '2027-03-07' && r.day === '2026-11-04', JSON.stringify([r.from, r.to, r.day]));
    check('this week: M1 there and mature, the stale projection counts for nothing', r.inWeek.join() === 'M1' && r.mature.join() === 'M1' && r.soon.length === 0, JSON.stringify(r));
    check('the clone cuts of the next 10 weeks, each with the mothers mature that day (none after M1 retires)',
        JSON.stringify(r.cuts) === JSON.stringify([['2026-11-07', ['M1']], ['2026-11-25', []], ['2026-12-01', []]]), JSON.stringify(r.cuts));

    // ---- The view ----
    await loadSingle(b, main, db());
    await b.run(main, `document.getElementById('viewMothersBtn').click();`, { user: true });
    let v = await b.run(main, READ);
    const views = await b.run(main, `return { active: document.getElementById('viewMothersBtn').classList.contains('active'),
        others: ['annualView', 'weekView', 'launchView'].every(id => document.getElementById(id).classList.contains('hidden')) && document.getElementById('calendarGrid').closest('.calendar-grid-wrapper').classList.contains('hidden'),
        print: document.getElementById('printYearBtn').classList.contains('hidden') };`);
    check('🌿 Mothers is the active view; the month grid, 7-day, annual and launch views are hidden; no 🖨️', v.shown && views.active && views.others && views.print, JSON.stringify(views));
    const [y, mo, dd] = MONDAY.split('-').map(Number);
    const weekOf = new Date(y, mo - 1, dd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    check('title: "🌿 Mothers — week of <this Monday>"', v.title === `🌿 Mothers — week of ${weekOf}`, v.title);
    check('one row per Mother room, by name', v.rows.map(x => x.label.split(' ')[0] + ' ' + x.label.split(' ')[1]).join() === 'Mother 1,Mother 2', JSON.stringify(v.rows.map(x => x.label)));
    const lots = i => v.rows[i].bars.map(x => x.lot).sort();
    check('Mother 1: M100, M150, M160 and both projected mothers (not the 📋 copy, nor M170 with no schedule)',
        JSON.stringify(lots(0)) === JSON.stringify(['M100', 'M150', 'M160', 'R1G1-TBAMOM-01', 'R1G1-TBAMOM-02']) && !v.rows[0].bars.some(x => x.id === 'ev_mv_copy'), JSON.stringify(lots(0)));
    check('…its label counts its lots and the ones mature now', v.rows[0].label.includes('5 lots · 1 mature'), v.rows[0].label);
    const bar = id => v.rows.flatMap(x => x.bars).find(x => x.lot === id);
    check('M100: solid from its mature day, 40 of its 95 days in (--m 42.11%), "mature · retires …"', bar('M100').m === '42.11%' && bar('M100').text.includes('mature · retires'), JSON.stringify(bar('M100')));
    const m150 = await b.run(main, `return document.querySelector('#mothersView .launch-bar[data-lot="M150"]').title;`);
    check('M150 (no flag): mature from its Second leaf pick, in 20 days', bar('M150').text.includes('· mature ') && !bar('M150').text.includes('retires') && m150.includes('Mature in 20 days'), bar('M150').text + ' | ' + m150);
    check('M160: no mature day (marked)', bar('M160').cls.includes('nomature') && bar('M160').text.includes('no mature day'), JSON.stringify(bar('M160')));
    check('projected mothers dashed; the one whose move-in passed hatched ⚠️', bar('R1G1-TBAMOM-01').cls.includes('projection') && bar('R1G1-TBAMOM-02').cls.includes('stale') && bar('R1G1-TBAMOM-02').text.startsWith('⚠️'), JSON.stringify([bar('R1G1-TBAMOM-01').cls, bar('R1G1-TBAMOM-02').cls]));
    check('summary: 4 mother lots this week · 1 mature · 2 coming of age in 4 weeks · ⚠️ 1 clone cut with no mothers mature',
        v.summary === '4 mother lots this week · 1 mature · 2 coming of age in the next 4 weeks · ⚠️ 1 clone cut with no mothers mature', v.summary);
    check('✂️ Clone cuts ahead: L100 (M100 mature), L200 (⚠️ none), the projected R1G1-TBA-01 (R1G1-TBAMOM-01); not the mother lot M160\'s',
        v.cuts.length === 3 && v.cuts[0][1] === 'L100' && v.cuts[0][3].startsWith('M100') && v.cuts[1][1] === 'L200' && v.cuts[1][3].includes('No mothers mature')
        && v.cuts[2][1].startsWith('R1G1-TBA-01') && v.cuts[2][1].includes('projected') && v.cuts[2][3].startsWith('R1G1-TBAMOM-01'), JSON.stringify(v.cuts));
    check('⚠️ Check these: M160 with no mature day, R1G1-TBAMOM-02 never made, M170 with no schedule',
        v.checks.some(x => x.includes('M160') && x.includes('Mature from')) && v.checks.some(x => x.includes('R1G1-TBAMOM-02') && x.includes('passed'))
        && v.checks.some(x => x.includes('Lot M170') && x.includes('no Retire Mothers')) && v.checks.length === 3, JSON.stringify(v.checks));

    // A bar opens its Mature from task
    await b.run(main, `document.querySelector('#mothersView .launch-bar[data-lot="M100"]').click();`, { user: true });
    const sel = await b.run(main, `return { id: Calendar.selectedEvent?.id, selected: !!document.querySelector('#mothersView .launch-bar.selected[data-lot="M100"]') };`);
    check('clicking a bar selects its Mature from task (bar outlined)', sel.id === 'ev_mv_M100_mother_pick2' && sel.selected, JSON.stringify(sel));

    // ---- Filters ----
    const allLots = x => x.rows.flatMap(r => r.bars.map(b => b.lot)).sort();
    v = await b.run(main, `Calendar.filters = [{ key: 'room', value: 'Mother 2 (R2MO)' }]; Calendar.render(); ${READ}`);
    check('a room filter on Mother 2: only its mothers; the clone cuts are still listed (a cut is in a cloning room)', JSON.stringify(allLots(v)) === '["R2G1-TBAMOM-01"]' && v.cuts.length === 3, JSON.stringify([allLots(v), v.cuts.length]));
    v = await b.run(main, `Calendar.filters = [{ key: 'taskType', value: 'equipment_maintenance' }]; Calendar.render(); ${READ}`);
    check('a task-type filter doesn\'t empty the view, and says it doesn\'t apply', allLots(v).length === 6 && /don't apply/.test(v.note || ''), JSON.stringify([allLots(v), v.note]));
    await b.run(main, `Calendar.filters = []; Calendar.render();`);

    // ---- Prev / Next / Today, the week shared with 🚀 ----
    const nav = await b.run(main, `const out = [];
        document.getElementById('nextMonthBtn').click(); out.push(Calendar.launchWeek, document.getElementById('calendarTitle').textContent.startsWith('🌿 Mothers'));
        document.getElementById('viewLaunchBtn').click(); out.push(Calendar.launchWeek);
        document.getElementById('viewMothersBtn').click(); document.getElementById('todayBtn').click(); out.push(Calendar.launchWeek, Calendar.viewMode);
        return out;`, { user: true });
    check('Next moves a week, 🚀 Launch windows opens on the same week, Today comes back', JSON.stringify(nav) === JSON.stringify([add(MONDAY, 7), true, add(MONDAY, 7), MONDAY, 'mothers']), JSON.stringify(nav));

    // ---- No sideways page scroll on a tablet ----
    await b.send('browsingContext.setViewport', { context: main, viewport: { width: 800, height: 1280 } });
    const wide = await b.run(main, `await new Promise(r => setTimeout(r, 100)); return { page: document.documentElement.scrollWidth, view: innerWidth };`);
    check('at 800 px the page doesn\'t scroll sideways', wide.page <= wide.view, JSON.stringify(wide));
    await b.send('browsingContext.setViewport', { context: main, viewport: null });

    // ---- The day rolling over: shown as of this week, it follows ----
    await b.run(main, shiftClock(7));
    const lw = await b.run(main, `return [Calendar.launchWeek, Calendar.viewMode];`);
    check('a week later the view follows to the new week', lw[0] === add(MONDAY, 7) && lw[1] === 'mothers', JSON.stringify(lw));
    await b.run(main, `window.Date = window.__RealDate; Calendar.goToToday();`);

    // ---- The hub's fallback matches CropLabourWizard's built-in mother recipe ----
    const hub = await b.run(main, `return MOTHERS.MATURE_TASK;`);
    const clw = await openTool(b, main, 'CropLabourWizard');
    const builtin = await b.run(clw, `return SITKA_MOTHER_RECIPE.matureTask;`);
    check('MOTHERS.MATURE_TASK is the built-in mother recipe\'s 🌿 Mature from', hub === builtin && hub === 'mother_pick2', JSON.stringify([hub, builtin]));
    await b.run(main, `Tools.close();`);

    // ---- A building device: only its building's Mother rooms ----
    const files = await splitFiles(b, main, BASE, db());
    const dev = await fresh(b);
    await openSplit(b, dev, BASE, 'B2', files);
    await b.run(dev, `document.getElementById('viewMothersBtn').click();`, { user: true });
    v = await b.run(dev, READ);
    check('on Building 2\'s tablet: Mother 2\'s mothers only', JSON.stringify(allLots(v)) === '["R2G1-TBAMOM-01"]' && v.rows.length === 1, JSON.stringify([allLots(v), v.rows.map(x => x.label)]));

    await leave(b, dev);
    await leave(b, main);
    return results;
}
