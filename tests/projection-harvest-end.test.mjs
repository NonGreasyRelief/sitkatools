// Projections count from the previous lot's LAST harvest day (user report 2026-10-24). Lots scheduled before the 70-day
// built-ins harvest over two days, Thursday → Friday, and keep their "Cut Clones to Replace Lot" where the older recipe put
// it: 21 days before the harvest's first day (Thursday) or its last (Friday). Projections used to start on that day, so
// every projected lot moved in on a Saturday or Sunday. Now each one moves in the Monday after the previous harvest ends
// and flips that Friday — with Project Crop, again over projections made the old way, and with Reproject.
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

    return results;
}
