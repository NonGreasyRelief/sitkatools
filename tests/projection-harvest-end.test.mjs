// Projections count from the previous lot's LAST harvest day (user report 2026-10-24). Lots scheduled before the 70-day
// built-ins harvest over two days, Thursday → Friday, and keep their "Cut Clones to Replace Lot" where the older recipe put
// it: 21 days before the harvest's first day (Thursday) or its last (Friday). Projections used to start on that day, so
// every projected lot moved in on a Saturday or Sunday. Now each one moves in the Monday after the previous harvest ends
// and flips that Friday — with Project Crop, again over projections made the old way, and with Reproject. While a real
// lot's own clone cut is on a different day from TBA-01's, both clone-cut tasks show a ⚠️ in CropLabourWizard and on
// the SitkaTools calendar, until the real lot's clone cut is moved to match.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool } from './lib/helpers.mjs';

export const title = 'projections: from the previous lot\'s last harvest day — Friday harvest end, Monday transplant, Friday flip';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekday = s => { const [y, m, d] = s.split('-').map(Number); return DAY[new Date(y, m - 1, d, 12).getDay()]; };
const daysBetween = (a, b) => { const p = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((p(b) - p(a)) / 86400000); };

// A real lot's stored schedule, the way an older recipe wrote it. `h` = [harvest first day, last day].
function schedule(id, s, { irr = true } = {}) {
    const ev = (taskType, date, endDate) => ({ id: `ev_${id}_${taskType}`, date, ...(endDate ? { endDate } : {}), title: `${id}, ${taskType}`, sourceTool: 'CropLabourWizard', lotId: id, taskType });
    return [
        ev('clone_cut_prep', s.day0), ev('planting', s.planting), ev('transplant', s.transplant), ev('flip', s.flip),
        ev('harvest', s.h[0], s.h[1]), ev('room_clean', s.roomClean), ...(irr ? [ev('tank_irrigation_clean', s.irr)] : []), ev('clone_cut', s.cut)
    ];
}
function addLot(d, id, roomId, created, s, opts) {
    d.lots[id] = { name: id, strain: 'Test Kush', stage: 'flower', createdDate: created, closedDate: null, type: 'new-lot', startPlantCount: 100,
        cloningRoom: 'Clone 1', vegRoom: null, destRoom: d.rooms[roomId].name, dryRoom: null, trimRoom: null, currentRoom: d.rooms[roomId].name, plantCount: 100,
        _tool_CropLabourWizard: { plantingDate: s.day0, recipeId: 'sitka-9week', trimDays: 7, harvestMultiDay: true, harvestDays: 2, taskCount: 8 } };
    d.rooms[roomId].assignedLots.push(id);
    d.calendarEvents.push(...schedule(id, s, opts));
}

// Grow 1: clone cut 21 days before the harvest's first day (Thursday). Grow A: 21 days before its last day (Friday).
const L500 = { day0: '2026-09-23', planting: '2026-10-07', transplant: '2026-10-19', flip: '2026-10-29', h: ['2026-12-31', '2027-01-01'], roomClean: '2027-01-02', irr: '2027-01-03', cut: '2026-12-10' };
const L600 = { day0: '2026-10-15', planting: '2026-10-29', transplant: '2026-11-08', flip: '2026-11-19', h: ['2027-01-21', '2027-01-22'], roomClean: '2027-01-23', irr: '2027-01-24', cut: '2027-01-01' };
// The lot that takes Grow 1's first projected slot, a week later than planned; its Tank & Irrigation Clean is off
const L700 = { day0: '2026-12-05', planting: '2026-12-19', transplant: '2027-01-04', flip: '2027-01-15', h: ['2027-03-18', '2027-03-19'], roomClean: '2027-03-20', cut: '2027-02-20' };

function db() {
    const d = fixtureDb();
    addLot(d, 'L500', 'R1G1', '2026-09-23', L500);
    addLot(d, 'L600', 'R2G1', '2026-10-15', L600);
    return d;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db());
    const clw = await openTool(b, main, 'CropLabourWizard');

    // The room's projected lots, oldest first: { id, transplant, flip, harvest (last day) }
    const projected = roomId => b.run(clw, `const by = {};
        for (const e of DB.data.calendarEvents.filter(e => e.sourceTool === 'CropProjection' && e.roomId === '${roomId}')) {
            const l = by[e.lotId] ||= { id: e.lotId };
            if (e.taskType === 'transplant') l.transplant = e.date;
            if (e.taskType === 'flip') l.flip = e.date;
            if (e.taskType === 'harvest') l.harvest = e.endDate || e.date;
        }
        return Object.values(by).sort((a, b) => a.id.localeCompare(b.id));`);
    const project = roomId => b.run(clw, `window.__asked = []; window.confirm = m => { window.__asked.push(m); return true; }; generateProjectionsForRoom('${roomId}'); return window.__asked;`);
    // Each projected lot moves in N days after the previous lot's harvest ends: [days, transplant weekday, flip weekday, harvest weekday]
    const chainOf = (prevHarvestEnd, lots) => lots.map((l, i) => [daysBetween(i ? lots[i - 1].harvest : prevHarvestEnd, l.transplant), weekday(l.transplant), daysBetween(l.transplant, l.flip), weekday(l.flip), weekday(l.harvest)].join(' '));
    const tight = n => Array(n).fill('3 Mon 4 Fri Fri').join(' | ');

    // ---- Project Crop: the first projected lot follows the real lot's harvest END, not its old clone-cut day ----
    let asked = await project('R1G1');
    let g1 = await projected('R1G1');
    check('Grow 1 (clone cut counted from the harvest\'s first day): TBA-01 transplants Monday Jan 4, the Monday after the harvest ends on Friday Jan 1, and flips Friday Jan 8',
        g1[0]?.transplant === '2027-01-04' && g1[0]?.flip === '2027-01-08', JSON.stringify(g1[0]));
    check('…all 5 projected lots move in the Monday 3 days after the previous harvest ends, flip that Friday and harvest on a Friday, nothing pushed back',
        g1.length === 5 && chainOf(L500.h[1], g1).join(' | ') === tight(5) && asked.length === 0, chainOf(L500.h[1], g1).join(' | ') + ` · asked ${asked.length}`);
    const cfg1 = await b.run(clw, `return getProjectedLots()['R1G1-TBA-01'].config.plantingDate;`);
    check('…TBA-01\'s clones are cut Saturday Dec 5, 27 days before the harvest ends (the real lot\'s own clone cut, Thursday Dec 10, isn\'t used)',
        cfg1 === '2026-12-05', cfg1);

    asked = await project('R2G1');
    const ga = await projected('R2G1');
    check('Grow A (clone cut counted from the harvest\'s last day, 21 days before): TBA-01 transplants Monday Jan 25 and flips Friday Jan 29',
        ga[0]?.transplant === '2027-01-25' && ga[0]?.flip === '2027-01-29', JSON.stringify(ga[0]));
    check('…and the rest of the chain follows the same Monday / Friday rhythm', ga.length === 5 && chainOf(L600.h[1], ga).join(' | ') === tight(5) && asked.length === 0, chainOf(L600.h[1], ga).join(' | '));

    // ---- ⚠️ The real lot's own clone cut doesn't match TBA-01's: both clone-cut tasks say so ----
    const WARN = 'Does not match projection schedule. Adjust in real lot to match distance from harvest to projections.';
    const pickLot = id => b.run(clw, `const l = document.getElementById('activeLot'); l.value = '${id}'; l.dispatchEvent(new Event('change'));`);
    const cwNotes = () => b.run(clw, `return [...document.querySelectorAll('.cut-mismatch-note')].map(n => [n.closest('#previewTaskList') ? 'preview' : 'saved',
        n.closest('.preview-task-item, .task-item').querySelector('.preview-task-name, .task-name').textContent, n.textContent]);`);
    await pickLot('L500');
    let notes = await cwNotes();
    check('CropLabourWizard: L500\'s Cut Clones to Replace Lot says it doesn\'t match, in the preview and the saved schedule, with the days from harvest end',
        notes.length === 2 && notes.every(n => n[2].includes(WARN) && n[2].includes('Lot L500 cuts clones Thu Dec 10, 22 days before its harvest ends (Fri Jan 1)') && n[2].includes('Sat Dec 5, 27 days before'))
        && notes[0][0] === 'preview' && notes[0][1] === 'Cut Clones to Replace Lot' && notes[1][0] === 'saved', JSON.stringify(notes));
    await pickLot('R1G1-TBA-01');
    notes = await cwNotes();
    check('…and so does TBA-01\'s Cutting Clones', notes.length === 2 && notes[0][1] === 'Cutting Clones' && notes.every(n => n[2].includes(WARN)), JSON.stringify(notes));
    await pickLot('R1G1-TBA-02');
    check('…but no other lot or task', (await cwNotes()).length === 0);
    await b.sleep(300);
    const bars = () => b.run(main, `Calendar.viewMode = 'month'; Calendar.currentYear = 2026; Calendar.currentMonth = 11; Calendar.render();
        return [...document.querySelectorAll('.day-event.cut-mismatch')].map(c => c.textContent).sort();`);
    let flagged = await bars();
    check('SitkaTools: ⚠️ on the bars of both clone cuts in each room (L500 and TBA-01, L600 and TBA-01), nothing else',
        flagged.length === 4 && flagged.every(t => t.startsWith('⚠️ ')) && ['L500, clone_cut', 'L600, clone_cut', 'R1G1-TBA-01', 'R2G1-TBA-01'].every(s => flagged.some(t => t.includes(s))), JSON.stringify(flagged));
    const panel = await b.run(main, `const ev = DB.data.calendarEvents.find(e => e.lotId === 'L600' && e.taskType === 'clone_cut');
        Calendar.selectEvent(ev);
        return { banner: document.querySelector('#eventPanelBody .cut-mismatch-banner')?.textContent || '', tip: Calendar._eventTooltipHtml(ev) };`);
    check('…the event panel and tooltip give the sentence and the days', panel.banner.includes(WARN) && panel.banner.includes('Lot L600 cuts clones Fri Jan 1, 21 days before its harvest ends (Fri Jan 22). The projections cut them Sat Dec 26, 27 days before.')
        && panel.tip.includes(WARN), JSON.stringify(panel));
    // Fixed in the real lot: 27 days before harvest end, as you type it, then generated
    await pickLot('L500');
    await b.run(clw, `const row = [...document.querySelectorAll('#previewTaskList .preview-task-item')].find(r => r.querySelector('.preview-task-name').textContent === 'Cut Clones to Replace Lot');
        const inp = row.querySelector('input[type=number]'); inp.value = '-27'; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));`);
    notes = await cwNotes();
    check('moving L500\'s clone cut to −27 clears the preview\'s warning at once (the saved schedule keeps it until Generate)', notes.length === 1 && notes[0][0] === 'saved', JSON.stringify(notes));
    await b.run(clw, `window.confirm = () => true; document.getElementById('generateBtn').click();`, { user: true });
    await b.sleep(400);
    notes = await cwNotes();
    const cut500 = await b.run(main, `return DB.data.calendarEvents.find(e => e.lotId === 'L500' && e.taskType === 'clone_cut').date;`);
    flagged = await bars();
    check('…after Generate L500 cuts Sat Dec 5, TBA-01\'s day, and only Grow A\'s two bars still have the ⚠️',
        cut500 === '2026-12-05' && notes.length === 0 && flagged.length === 2 && flagged.every(t => t.includes('L600') || t.includes('R2G1-TBA-01')), JSON.stringify({ cut500, notes, flagged }));
    g1 = await projected('R1G1');
    check('…and Grow 1\'s projections didn\'t move', chainOf(L500.h[1], g1).join(' | ') === tight(5) && g1[0].transplant === '2027-01-04', chainOf(L500.h[1], g1).join(' | '));

    // ---- Projections made the old way (6 days late: Sunday transplants, Thursday flips) are put right by Project Crop ----
    await b.run(clw, `
        for (const e of DB.data.calendarEvents.filter(e => e.sourceTool === 'CropProjection' && e.roomId === 'R2G1')) { e.date = computeTaskDate(e.date, 6); if (e.endDate) e.endDate = computeTaskDate(e.endDate, 6); }
        for (const p of Object.values(getProjectedLots()).filter(p => p.roomId === 'R2G1')) p.config.plantingDate = computeTaskDate(p.config.plantingDate, 6);`);
    const late = await projected('R2G1');
    check('(set-up: Grow A\'s projections moved 6 days later, as the old start day put them: Sunday transplants)', late.every(l => weekday(l.transplant) === 'Sun'), late.map(l => l.transplant).join(' '));
    asked = await project('R2G1');
    const again = await projected('R2G1');
    check('Project Crop again brings them back: TBA-01 transplants Monday Jan 25, every lot on the Monday / Friday rhythm, nothing asked',
        again[0]?.transplant === '2027-01-25' && chainOf(L600.h[1], again).join(' | ') === tight(5) && asked.length === 0, chainOf(L600.h[1], again).join(' | '));

    // ---- Reproject: a real lot takes Grow 1's first slot (SitkaTools' hook removes TBA-01) and harvests a week late ----
    await b.run(clw, `
        DB.data.lots.L700 = { name: 'L700', strain: 'Test Kush', stage: 'clone', createdDate: '2026-12-05', closedDate: null, type: 'new-lot', startPlantCount: 100,
            cloningRoom: 'Clone 1', vegRoom: null, destRoom: 'Grow 1', dryRoom: null, trimRoom: null, currentRoom: 'Clone 1', plantCount: 100,
            _tool_CropLabourWizard: { plantingDate: '${L700.day0}', recipeId: 'sitka-9week', trimDays: 7, harvestMultiDay: true, harvestDays: 2, taskCount: 7 } };
        DB.data.rooms.R1G1.assignedLots.push('L700');
        delete DB.data._CropLabourWizard.projectedLots['R1G1-TBA-01'];
        DB.data.calendarEvents = DB.data.calendarEvents.filter(e => !(e.sourceTool === 'CropProjection' && e.lotId === 'R1G1-TBA-01'));
        DB.data.calendarEvents.push(...${JSON.stringify(schedule('L700', L700, { irr: false }))});`);
    const pending = await b.run(clw, `return isPendingReprojection('R1G1');`);
    check('(set-up: Grow 1 is waiting for Reproject)', pending === true, String(pending));
    asked = await b.run(clw, `window.__asked = []; window.confirm = m => { window.__asked.push(m); return true; }; reprojectRoom('R1G1'); return window.__asked;`);
    const re = await projected('R1G1');
    check('Reproject: the next lot moves in Monday Mar 22, the Monday after the new lot\'s two-day harvest ends on Friday Mar 19 (no Tank & Irrigation Clean: harvest end + 2), and flips Friday Mar 26',
        re[0]?.transplant === '2027-03-22' && re[0]?.flip === '2027-03-26', JSON.stringify(re[0]));
    check('…5 projected lots again, every one moving in the Monday after the previous harvest ends and flipping that Friday, the fresh TBA-05 too',
        re.length === 5 && chainOf(L700.h[1], re).join(' | ') === tight(5), chainOf(L700.h[1], re).join(' | '));
    check('…it asked first, listing TBA-01 pushed back a week', asked.length === 1 && /TBA-01: \+7d \(Mar 15 → Mar 22\)/.test(asked[0] || ''), asked[0] || '(not asked)');

    // ---- Unticking Multi-day: L600's Thursday–Friday harvest becomes one day on the Friday, nothing else moves ----
    await pickLot('L600');
    const multi = await b.run(clw, `
        const rowDate = n => [...document.querySelectorAll('#previewTaskList .preview-task-item')].find(r => r.querySelector('.preview-task-name').textContent === n).querySelector('.preview-computed-date').textContent;
        const snap = () => ['Harvest', 'Grow-Room Clean', 'Tank and Irrigation Line Clean', 'Cut Clones to Replace Lot', 'Trim'].map(rowDate);
        const cb = document.getElementById('harvestMultiCheck'), wasChecked = cb.checked, before = snap();
        cb.checked = false; cb.dispatchEvent(new Event('change'));
        return { wasChecked, before, after: snap(), toast: document.getElementById('toast')?.textContent || '' };`);
    check('unticking Multi-day makes the harvest one day on its last day (Fri Jan 22), with a toast',
        multi.wasChecked && multi.before[0] === '2027-01-21 (Thu) → 2027-01-22 (Fri)' && multi.after[0] === '2027-01-22 · Fri' && multi.toast.includes('2027-01-22'), JSON.stringify(multi));
    check('…clean-up, tank clean, clone cut and trim stay on their days', JSON.stringify(multi.after.slice(1)) === JSON.stringify(multi.before.slice(1)), JSON.stringify(multi));
    asked = await b.run(clw, `window.__asked = []; window.confirm = m => { window.__asked.push(m); return true; }; document.getElementById('generateBtn').click(); return window.__asked;`, { user: true });
    await b.sleep(400);
    const h600 = await b.run(main, `const e = DB.data.calendarEvents.find(e => e.lotId === 'L600' && e.taskType === 'harvest'); return { date: e.date, endDate: e.endDate || null, multi: DB.data.lots.L600._tool_CropLabourWizard.harvestMultiDay };`);
    const ga2 = await projected('R2G1');
    check('…Generate saves it as a one-day Friday event, and Grow A\'s projections stay put with nothing asked',
        h600.date === '2027-01-22' && !h600.endDate && h600.multi === false && ga2[0]?.transplant === '2027-01-25' && asked.length === 0, JSON.stringify({ h600, tba1: ga2[0], asked }));

    return results;
}
