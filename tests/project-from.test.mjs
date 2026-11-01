// 📍 Project Crop from a TBA lot (user request 2026-11-01): "if we are on TBA-03 and we decided to do stuff earlier, TBA-04
// and beyond follow the pattern, but we don't want to clear TBA-01 and TBA-02". The 📍 From dropdown beside 🔮 Project Crop
// picks the whole chain or a TBA lot, and follows the selected lot (a TBA lot picks itself). From TBA-03, TBA-01…03 and their
// 🌿 mothers stay exactly as they are and TBA-04…10 are placed from TBA-03's harvest by the same rules (the room-ready
// rule included, asked first, Cancel = no change). And the chain is 10 lots now, about 2 years (it was 5, about 12 months):
// a chain made with 5 grows to 10 from its TBA-05, or with Reproject.
import { today, makeChecker, fresh, openSitka, loadSingle, openTool } from './lib/helpers.mjs';
import { motherDb, addDaysIso } from './mothers.test.mjs';

export const title = '📍 Project Crop from a TBA lot, and 10 projected lots (about 2 years)';

const daysBetween = (a, b) => { const p = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((p(b) - p(a)) / 86400000); };
const pad = i => String(i).padStart(2, '0');

// A real lot's schedule as the default built-in writes it, from its clone-cut day
function scheduleOf(id, day0) {
    const at = n => addDaysIso(day0, n);
    const ev = (taskType, n) => ({ id: `ev_${id}_${taskType}`, date: at(n), title: `${id}, ${taskType}`, sourceTool: 'CropLabourWizard', lotId: id, taskType });
    return [ev('clone_cut_prep', 0), ev('planting', 14), ev('transplant', 30), ev('flip', 34), ev('clone_cut', 70), ev('harvest', 97), ev('room_clean', 98), ev('tank_irrigation_clean', 99)];
}
function realLot(id, room, created, day0) {
    return { name: id, strain: 'Test Kush', stage: 'veg', createdDate: created, closedDate: null, type: 'new-lot', startPlantCount: 100,
        cloningRoom: 'Clone 1', vegRoom: null, destRoom: room, dryRoom: null, trimRoom: null, currentRoom: 'Clone 1', plantCount: 100,
        _tool_CropLabourWizard: { plantingDate: day0, recipeId: 'sitka-9week', trimDays: 7, harvestMultiDay: false, harvestDays: 2, taskCount: 8 } };
}

// Grow 1: L500 cut its clones 10 days ago (its transplant is ahead, so its mothers are projected too). Grow A: L600, 3 weeks later.
function db() {
    const d = motherDb();
    d.lots.L500 = realLot('L500', 'Grow 1', today(-10), today(-10));
    d.rooms.R1G1.assignedLots.push('L500');
    d.calendarEvents.push(...scheduleOf('L500', today(-10)));
    d.lots.L600 = realLot('L600', 'Grow A', today(11), today(11));
    d.rooms.R2G1.assignedLots.push('L600');
    d.calendarEvents.push(...scheduleOf('L600', today(11)));
    return d;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db());
    const clw = await openTool(b, main, 'CropLabourWizard');
    const pick = lotId => b.run(clw, `const l = document.getElementById('activeLot'); l.value = '${lotId}'; l.dispatchEvent(new Event('change'));`);
    const ui = () => b.run(clw, `const f = document.getElementById('projectFromSelect'), p = document.getElementById('generateProjectionsBtn');
        return { from: f.value, fromDisabled: f.disabled, fromTitle: f.title, options: [...f.options].map(o => [o.value, o.textContent]), btn: p.textContent, btnDisabled: p.disabled, title: p.title };`);
    // Click 🔮 with the 🌿 dropdown at `mothers` and 📍 From at `from` (null: as it is); `answer` = the room-ready confirm's
    const click = ({ mothers = null, from = null, answer = true } = {}) => b.run(clw, `window.__asked = []; window.__alert = null;
        window.confirm = m => { window.__asked.push(m); return ${answer}; }; window.alert = m => { window.__alert = m; };
        ${mothers === null ? '' : `const m = document.getElementById('motherRecipeSelect'); m.value = '${mothers}'; m.dispatchEvent(new Event('change'));`}
        ${from === null ? '' : `const f = document.getElementById('projectFromSelect'); f.value = '${from}'; f.dispatchEvent(new Event('change'));`}
        document.getElementById('generateProjectionsBtn').click();
        return { asked: window.__asked, alert: window.__alert, toast: document.getElementById('toast').textContent };`, { user: true });
    // A room's projected lots, oldest first: { id, transplant, flip, harvest (last day), irr, ids (event ids), evs (the events) }
    const lots = roomId => b.run(clw, `const by = {};
        for (const e of DB.data.calendarEvents.filter(e => e.sourceTool === 'CropProjection' && e.roomId === '${roomId}' && !e.lotId.includes('TBAMOM'))) {
            const l = by[e.lotId] ||= { id: e.lotId, ids: [], evs: [] };
            l.ids.push(e.id); l.evs.push(e);
            if (e.taskType === 'transplant') l.transplant = e.date;
            if (e.taskType === 'flip') l.flip = e.date;
            if (e.taskType === 'harvest') l.harvest = e.endDate || e.date;
            if (e.taskType === 'tank_irrigation_clean') l.irr = e.date;
        }
        for (const l of Object.values(by)) { l.ids.sort(); l.evs = JSON.stringify(l.evs.sort((a, b) => a.id.localeCompare(b.id))); l.cfg = JSON.stringify(getProjectedLots()[l.id]?.config || null); }
        return Object.values(by).sort((a, b) => a.id.localeCompare(b.id));`);
    const moms = () => b.run(clw, `const ev = DB.data.calendarEvents.filter(e => e.sourceTool === 'CropProjection');
        const tp = id => ev.find(e => e.lotId === id && e.taskType === 'transplant')?.date || DB.data.calendarEvents.find(e => e.lotId === id && e.taskType === 'transplant')?.date;
        return Object.keys(getProjectedLots()).filter(id => id.startsWith('R1G1-TBAMOM-')).sort().map(id => ({ id, src: getProjectedLots()[id].sourceLotId, tp: tp(id), srcTp: tp(getProjectedLots()[id].sourceLotId),
            evs: JSON.stringify(ev.filter(e => e.lotId === id).sort((a, b) => a.id.localeCompare(b.id))) }));`);
    // Each lot moves in N days after the previous lot's harvest ends, and harvests M days after it: 'N M' (the built-in: '3 70')
    const rhythm = (prevHarvest, ls) => ls.map((l, i) => `${daysBetween(i ? ls[i - 1].harvest : prevHarvest, l.transplant)} ${daysBetween(i ? ls[i - 1].harvest : prevHarvest, l.harvest)}`);
    const L500harvest = addDaysIso(today(-10), 97), L600harvest = addDaysIso(today(11), 97);

    // ---- Before any projection: 📍 From has nothing to start from but the whole chain ----
    await pick('L500');
    let u = await ui();
    check('📍 From beside 🔮 Project Crop: "Whole chain" only, disabled until the chain is projected', u.from === '' && u.fromDisabled && JSON.stringify(u.options) === '[["","Whole chain"]]' && u.btn === '🔮 Project Crop', JSON.stringify(u));
    check('…Project Crop says it makes the 10-lot chain, about 2 years', u.title.startsWith('Generate the 10-lot projection chain (about 2 years)'), u.title);
    const order = await b.run(clw, `return [...document.querySelector('.header-right').children].map(c => c.querySelector('select')?.id || c.id);`);
    check('…between 🌿 Mothers from clones and 🔮 Project Crop', order.join().startsWith('projectionRecipeSelect,motherRecipeSelect,projectFromSelect,generateProjectionsBtn,clearProjectionsBtn,activeLot'), order.join());

    // ---- 🔮 Project Crop: 10 lots, about 2 years ----
    let r = await click({ mothers: 'sitka-mother' });
    let g = await lots('R1G1');
    check('Project Crop: 10 projected lots, TBA-01…TBA-10', g.map(l => l.id).join() === Array.from({ length: 10 }, (_, i) => `R1G1-TBA-${pad(i + 1)}`).join() && !r.alert, (r.alert || '') + g.map(l => l.id).join());
    check('…every one 70 days after the one before, moving in 3 days after its harvest: 700 days, about 2 years, past the real lot\'s harvest',
        rhythm(L500harvest, g).every(x => x === '3 70') && daysBetween(L500harvest, g[9].harvest) === 700, rhythm(L500harvest, g).join(' | '));
    check('…the toast says 10 lots', r.toast.startsWith('🔮 Projections generated — 10 lots for Grow 1'), r.toast);
    let M = await moms();
    check('…and their 🌿 mothers, R1G1-TBAMOM-00…10, each transplanting with its lot', M.length === 11 && M.every(x => x.tp === x.srcTp), JSON.stringify(M.map(x => [x.id, x.tp, x.srcTp])));

    // ---- 📍 From follows the selected lot ----
    await pick('L500');
    u = await ui();
    check('the real lot selected: From shows "Whole chain", with TBA-01…TBA-09 to pick (TBA-10 has nothing after it)',
        u.from === '' && !u.fromDisabled && JSON.stringify(u.options) === JSON.stringify([['', 'Whole chain'], ...Array.from({ length: 9 }, (_, i) => [String(i + 1), `TBA-${pad(i + 1)}`])]) && u.btn === '🔮 Project Crop', JSON.stringify(u));
    await pick('R1G1-TBA-03');
    u = await ui();
    check('TBA-03 selected: From is TBA-03 by itself, and the button reads "🔮 Project from TBA-03"', u.from === '3' && u.btn === '🔮 Project from TBA-03' && !u.btnDisabled, JSON.stringify(u));
    check('…its tooltip: TBA-01…03 kept, TBA-04…10 from TBA-03\'s harvest, and the 🌿 mothers', u.title === 'Keep TBA-01…TBA-03 as they are, and project TBA-04…TBA-10 from TBA-03\'s harvest, and the 🌿 mothers each lot\'s kept-back plants become', u.title);
    await pick('R1G1-TBA-10');
    u = await ui();
    check('TBA-10 selected: "Whole chain" (no lot after it)', u.from === '' && u.btn === '🔮 Project Crop', JSON.stringify(u));
    await pick('R1G1-TBAMOM-03');
    u = await ui();
    check('a 🌿 TBAMOM selected: "Whole chain" (it\'s mothers, not a TBA lot)', u.from === '' && u.btn === '🔮 Project Crop', JSON.stringify(u));
    await pick('L600');
    u = await ui();
    check('Grow A\'s lot (nothing projected there): From is "Whole chain" only again', u.from === '' && u.fromDisabled && u.options.length === 1, JSON.stringify(u));

    // ---- TBA-03 done earlier: a 56-day bloom, so its harvest is a week sooner ----
    await b.run(clw, `reAnchorProjectedLot('R1G1', 3, getProjectedLots()['R1G1-TBA-03'].config.plantingDate, 56);`);
    const before = await lots('R1G1'), Mbefore = await moms();
    check('(set-up: TBA-03 harvests a week sooner, TBA-04 still where it was: 10 days after)', daysBetween(g[2].harvest, before[2].harvest) === -7 && daysBetween(before[2].harvest, before[3].transplant) === 10, JSON.stringify([before[2].harvest, before[3].transplant]));

    await pick('R1G1-TBA-03');
    r = await click();
    let after = await lots('R1G1');
    check('📍 Project from TBA-03: TBA-01 and TBA-02 exactly as they were (every event, every date, their configs)',
        [0, 1].every(i => after[i].evs === before[i].evs && after[i].cfg === before[i].cfg), JSON.stringify([after[0].evs === before[0].evs, after[1].evs === before[1].evs]));
    check('…TBA-03 as it was too, its 56-day bloom kept', after[2].evs === before[2].evs && daysBetween(after[2].flip, after[2].harvest) === 56, JSON.stringify([after[2].flip, after[2].harvest]));
    check('…TBA-04…10 follow it: TBA-04 moves in 3 days after TBA-03\'s harvest, every lot 70 days after the one before',
        rhythm(after[2].harvest, after.slice(3)).every(x => x === '3 70'), rhythm(after[2].harvest, after.slice(3)).join(' | '));
    check('…a week earlier than before, the same events moved (not rebuilt)', after.slice(3).every((l, i) => daysBetween(before[i + 3].transplant, l.transplant) === -7 && l.ids.join() === before[i + 3].ids.join()),
        JSON.stringify(after.slice(3).map((l, i) => daysBetween(before[i + 3].transplant, l.transplant))));
    check('…nothing to ask (no room clean is late), and the toast says what it did', r.asked.length === 0 && r.toast.startsWith('🔮 Projected from TBA-03 — TBA-04…TBA-10 follow it, TBA-01…TBA-03 kept (Grow 1'), JSON.stringify(r));
    M = await moms();
    check('…🌿 TBAMOM-00…03 untouched, TBAMOM-04…10 moved with their lots', M.slice(0, 4).every((x, i) => x.evs === Mbefore[i].evs) && M.slice(4).every(x => x.tp === x.srcTp) && M.slice(4).every((x, i) => daysBetween(Mbefore[i + 4].tp, x.tp) === -7),
        JSON.stringify(M.map(x => [x.id, x.tp, x.srcTp])));
    u = await ui();
    check('…From stays on TBA-03', u.from === '3' && u.btn === '🔮 Project from TBA-03', JSON.stringify(u));

    // ---- The room-ready rule: TBA-03's Tank & Irrigation Clean 5 days later, so TBA-04 would move in too soon ----
    await b.run(clw, `const e = DB.data.calendarEvents.find(e => e.lotId === 'R1G1-TBA-03' && e.taskType === 'tank_irrigation_clean'); e.date = computeTaskDate(e.date, 5);`);
    const pre = await lots('R1G1');
    r = await click({ answer: false });
    let now = await lots('R1G1');
    check('Project from TBA-03 with TBA-03\'s room clean late: it asks first, TBA-04 pushed back 5 days', r.asked.length === 1 && /TBA-04: \+5d/.test(r.asked[0]) && !/TBA-0[123]:/.test(r.asked[0]), r.asked[0] || '(not asked)');
    check('…Cancel: nothing changed', now.every((l, i) => l.evs === pre[i].evs), '');
    r = await click({ answer: true });
    now = await lots('R1G1');
    check('…OK: TBA-04 moves in the day after TBA-03\'s room clean, the lots after it follow, TBA-01…03 still as they were',
        daysBetween(now[2].irr, now[3].transplant) === 1 && rhythm(now[3].harvest, now.slice(4)).every(x => x === '3 70') && [0, 1, 2].every(i => now[i].evs === pre[i].evs),
        JSON.stringify([now[2].irr, now[3].transplant, rhythm(now[3].harvest, now.slice(4))]));

    // ---- "Whole chain" while on TBA-03: as before, every lot from the real lot (TBA-03 back to the recipe's bloom) ----
    await b.run(clw, `const e = DB.data.calendarEvents.find(e => e.lotId === 'R1G1-TBA-03' && e.taskType === 'tank_irrigation_clean'); e.date = computeTaskDate(e.date, -5);`);
    r = await click({ from: '' });
    now = await lots('R1G1');
    check('From "Whole chain" with TBA-03 selected: the whole chain from L500 again, as Project Crop always did',
        rhythm(L500harvest, now).every(x => x === '3 70') && now[2].harvest === g[2].harvest && r.toast.startsWith('🔮 Projections generated — 10 lots'), rhythm(L500harvest, now).join(' | ') + ' ' + r.toast);

    // ---- "— No mothers —" from TBA-05: only the mothers after it go ----
    r = await click({ mothers: '', from: '5' });
    M = await moms();
    check('Project from TBA-05 with "— No mothers —": TBAMOM-06…10 removed, TBAMOM-00…05 kept', M.map(x => x.id).join() === Array.from({ length: 6 }, (_, i) => `R1G1-TBAMOM-${pad(i)}`).join() && r.toast.includes('🌿 5 projected mother lots removed'), M.map(x => x.id).join() + ' ' + r.toast);

    // ---- What it can't start from ----
    const refused = await b.run(clw, `const snap = JSON.stringify(DB.data.calendarEvents); generateProjectionsForRoom('R1G1', undefined, { from: 10 });
        return { toast: document.getElementById('toast').textContent, same: JSON.stringify(DB.data.calendarEvents) === snap };`);
    check('from TBA-10 (the last): refused, nothing changed', refused.same && refused.toast.includes('There\'s no lot after TBA-10'), refused.toast);
    await b.run(clw, `DB.data.calendarEvents = DB.data.calendarEvents.filter(e => e.lotId !== 'R1G1-TBA-06');`);
    await pick('R1G1-TBA-06');
    u = await ui();
    check('a TBA lot with no schedule (stale) isn\'t offered: From is "Whole chain" with TBA-06 selected', u.from === '' && !u.options.some(o => o[0] === '6'), JSON.stringify(u.options));
    await b.run(clw, `delete getProjectedLots()['R1G1-TBA-01']; DB.data.calendarEvents = DB.data.calendarEvents.filter(e => e.lotId !== 'R1G1-TBA-01');`);
    await pick('R1G1-TBA-03');
    u = await ui();
    check('a room waiting for Reproject: From disabled ("🔁 Reproject it first"), the button is 🔁 Reproject', u.fromDisabled && u.from === '' && u.fromTitle.includes('Reproject it first') && u.btn === '🔁 Reproject', JSON.stringify(u));

    // ---- A chain made when it had 5 lots grows to 10: from its TBA-05 ----
    await b.run(clw, `window.confirm = () => true; generateProjectionsForRoom('R2G1', null);
        const gone = new Set(['06', '07', '08', '09', '10'].map(n => 'R2G1-TBA-' + n));
        for (const id of gone) delete getProjectedLots()[id];
        DB.data.calendarEvents = DB.data.calendarEvents.filter(e => !gone.has(e.lotId));`);
    const five = await lots('R2G1');
    check('(set-up: Grow A has a 5-lot chain, as Project Crop made before)', five.length === 5, String(five.length));
    await pick('R2G1-TBA-05');
    u = await ui();
    check('Grow A\'s TBA-05 selected: From TBA-05, "🔮 Project from TBA-05"', u.from === '5' && u.btn === '🔮 Project from TBA-05', JSON.stringify(u));
    r = await click({ mothers: '' });
    let ga = await lots('R2G1');
    check('…TBA-06…10 added after it, on the same rhythm; TBA-01…05 as they were', ga.length === 10 && rhythm(five[4].harvest, ga.slice(5)).every(x => x === '3 70') && five.every((l, i) => ga[i].evs === l.evs),
        ga.length + ' ' + rhythm(five[4].harvest, ga.slice(5)).join(' | '));

    // ---- …or with Reproject: a real lot takes TBA-01, the 4 lots after it shift down, 6 fresh ones fill up to TBA-10 ----
    await b.run(clw, `const gone = new Set(['06', '07', '08', '09', '10'].map(n => 'R2G1-TBA-' + n));
        for (const id of gone) delete getProjectedLots()[id];
        DB.data.calendarEvents = DB.data.calendarEvents.filter(e => !gone.has(e.lotId));
        const day0 = getProjectedLots()['R2G1-TBA-01'].config.plantingDate;
        delete getProjectedLots()['R2G1-TBA-01'];
        DB.data.calendarEvents = DB.data.calendarEvents.filter(e => e.lotId !== 'R2G1-TBA-01');
        DB.data.lots.L700 = ${JSON.stringify(realLot('L700', 'Grow A', '__D__', '__D__'))};
        DB.data.lots.L700.createdDate = day0; DB.data.lots.L700._tool_CropLabourWizard.plantingDate = day0;
        DB.data.rooms.R2G1.assignedLots.push('L700');
        const at = n => computeTaskDate(day0, n), ev = (t, n) => ({ id: 'ev_L700_' + t, date: at(n), title: 'L700, ' + t, sourceTool: 'CropLabourWizard', lotId: 'L700', taskType: t });
        DB.data.calendarEvents.push(ev('clone_cut_prep', 0), ev('planting', 14), ev('transplant', 30), ev('flip', 34), ev('clone_cut', 70), ev('harvest', 97), ev('room_clean', 98), ev('tank_irrigation_clean', 99));
        populateLotSelector();`);
    const kept = (await lots('R2G1')).map(l => l.ids.join());
    await pick('L700');
    u = await ui();
    check('(set-up: L700 took Grow A\'s TBA-01: the room waits for 🔁 Reproject)', u.btn === '🔁 Reproject' && !u.btnDisabled, JSON.stringify(u));
    r = await click({ mothers: '' });
    ga = await lots('R2G1');
    const l700harvest = await b.run(clw, `return DB.data.calendarEvents.find(e => e.lotId === 'L700' && e.taskType === 'harvest').date;`);
    check('Reproject: 10 lots again — TBA-01…04 were TBA-02…05 (their events kept), TBA-05…10 fresh, all on the rhythm after L700\'s harvest',
        ga.length === 10 && ga.slice(0, 4).every((l, i) => l.ids.join() === kept[i]) && rhythm(l700harvest, ga).every(x => x === '3 70'),
        ga.length + ' ' + rhythm(l700harvest, ga).join(' | '));
    check('…the toast names the 6 fresh lots', r.toast.includes('6 fresh lots added (TBA-05, TBA-06, TBA-07, TBA-08, TBA-09, TBA-10)'), r.toast);

    await b.run(main, `clearUnsaved();`);
    return results;
}
