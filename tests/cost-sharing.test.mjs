// Cost per gram audit, 2026-10-26 — the sharing rules (group B), worked by hand on cost-per-gram.test.mjs's example
// (L100 in Building 1: Grow 1 D20–D40, 10,000 g, 30 h at $20–22 = $630, Weigh & Ship on D50; today = D120):
// - a building's rent is shared by floor area (the default), by lights when a room in use has none, or by plants;
// - costs count on the ship day (Weigh & Ship signed off done), with all the crop's grams;
// - shared labour is spread over the grams shipped, each building's over its own; a building that shipped nothing in the
//   period (the nursery) passes its share to every gram, so the buildings add up to the org;
// - the building, room and strain filters keep the building's shared labour per gram.
import { today, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';
import { costDb } from './cost-per-gram.test.mjs';

export const title = 'cost per gram audit: rent by floor area, ship day, shared costs by building and org';
const D = n => today(-120 + n);
const near = (a, b, eps = 1e-6) => a != null && Math.abs(a - b) < eps;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    const measure = async (db, code) => {
        await openSitka(b, main, BASE);
        await loadSingle(b, main, db);
        const ew = await openTool(b, main, 'EmployeeWizard');
        const r = await b.run(ew, `const M = rptModel(); const of = id => M.crops.find(c => c.lotId === id);
            const agg = (filter = {}) => { Object.assign(RPT, { building: '', room: '', strain: '' }, filter); const x = rptCostAgg(M, '2000-01-01', '2100-01-01');
                Object.assign(RPT, { building: '', room: '', strain: '' }); return { labour: x.costPG.labour, direct: x.direct, n: x.n, crops: x.crops.map(c => c.lotId).join() }; };
            ${code}`);
        await leave(b, ew); await b.send('browsingContext.close', { context: ew });
        return r;
    };
    // The days of D[from..to] at $monthly a month
    const span = (from, to, monthly, f = v => v) => { let t = 0; for (let n = from; n <= to; n++) { const [y, m] = D(n).split('-').map(Number); t += f(monthly / new Date(y, m, 0).getDate()); } return t; };

    // ---- Rent by floor area: L300 in Veg 1 on D20–D40 while L100 is in Grow 1 ----
    const area = () => {
        const db = costDb();
        db.buildings.B1.monthlyPropertyCost = 3000;
        db.lots.L300 = { name: 'L300', strain: 'Test Kush', createdDate: D(20), vegRoom: 'Veg 1', destRoom: 'Grow 1', currentRoom: 'Veg 1', plantCount: 50 };
        db.calendarEvents.push({ id: 'ev_l3p', date: D(20), title: 'T planting', sourceTool: 'CropLabourWizard', lotId: 'L300', taskType: 'planting' },
            { id: 'ev_l3t', date: D(41), title: 'T transplant', sourceTool: 'CropLabourWizard', lotId: 'L300', taskType: 'transplant' });
        db.rooms.R1G1.floorSqFt = 2000; db.rooms.R1VG.floorSqFt = 500; db.rooms.R1CL.floorSqFt = 300;
        db._EmployeeWizard.costs.propertyShare = 'area';
        return db;
    };
    const rent = `const pm = rptPropertyModel(M.crops); return { L100: pm.byCrop.get('L100').cost, L300: pm.byCrop.get('L300').cost, noArea: [...pm.noArea], share: pm.share, miss: rptCosts(M) };`;
    let r = await measure(area(), rent);
    check('floor area, when picked in Power & Rates', r.share === 'area', r.share);
    check('Grow 1 (2,000 sq ft) carries 4/5 of the days it shares with Veg 1 (500 sq ft)',
        near(r.L100, span(0, 19, 3000) + span(20, 40, 3000, v => v * 0.8)) && near(r.L300, span(20, 40, 3000, v => v * 0.2)), JSON.stringify({ L100: r.L100, L300: r.L300 }));
    const noVegArea = area(); delete noVegArea.rooms.R1VG.floorSqFt;
    r = await measure(noVegArea, rent);
    check('a day when a room in use has no floor area is split by lights (Grow 1 20 lights, Veg 1 10: 2/3)',
        near(r.L100, span(0, 19, 3000) + span(20, 40, 3000, v => v * 2 / 3)) && r.noArea.includes('R1VG'), JSON.stringify({ L100: r.L100, noArea: r.noArea }));
    check('…and What\'s missing names the room', /Veg 1 has no floor area, so on days it’s in use its building’s rent is split by lights/.test(r.miss), '');

    // ---- The ship day ----
    const unsigned = costDb();
    unsigned.calendarEvents.find(e => e.taskType === 'weigh_ship').completed = false;
    r = await measure(unsigned, `return { ship: rptShipDay(of('L100')), all: agg(), attn: rptAttention(M).map(x => x.text).join(' | '), miss: rptCosts(M) };`);
    check('weighed, but Weigh & Ship not signed off: not shipped, so not in the cost per gram', r.ship === null && r.all.n === 0, JSON.stringify(r.all));
    check('…and Needs attention and What\'s missing say so', /Lot L100 is weighed out, but Weigh & Ship isn’t signed off done/.test(r.attn) && /Weighed out, but Weigh (&amp;|&) Ship isn’t signed off done/.test(r.miss), r.attn);
    const signed = costDb();
    Object.assign(signed.calendarEvents.find(e => e.taskType === 'weigh_ship'), { completed: true, completedBy: { name: 'Casey', day: today(-5), at: new Date().toISOString(), by: 'B1' } });
    r = await measure(signed, `return { ship: rptShipDay(of('L100')), last30: rptCostAgg(M, '${today(-30)}', '${today()}').n, harvested30: rptHarvested(M, '${today(-30)}', '${today()}').length };`);
    check('signed off 5 days ago: its costs count in the last 30 days (its harvest, D40, was before them)', r.ship === today(-5) && r.last30 === 1 && r.harvested30 === 0, JSON.stringify(r));

    // ---- Shared labour by building, and the org ----
    // Building 1 (flowering): 🧰 5 h by Blair at $21 = $105. Building 2 (the nursery, ships nothing): 🧰 10 h by Alex at $20 = $200.
    const twoBuildings = () => {
        const db = costDb();
        db.buildings.B2 = { name: 'Nursery', createdDate: '2026-01-01', assignedRooms: ['R2MO'] };
        db.rooms.R2MO = { name: 'Mother 2', createdDate: '2026-01-01', assignedLots: [], buildingId: 'B2', designation: 'Mother' };
        db._DailyWizard = { buildings: {
            B1: { tasks: [], labour: { [D(45)]: { misc: [{ id: 'le_misc00001', employee: 'Blair', hours: 5, note: 'tidy' }] } } },
            B2: { tasks: [], labour: { [D(45)]: { misc: [{ id: 'le_misc00002', employee: 'Alex', hours: 10, note: 'clean' }] } } } } };
        return db;
    };
    const facility = `return { all: agg(), b1: agg({ building: 'B1' }), room: agg({ room: 'R1G1' }), strain: agg({ strain: 'Test Kush' }) };`;
    r = await measure(twoBuildings(), facility);
    // L100's own $630 / 10,000 g = .063, + Building 1's $105 / its 10,000 g + the nursery's $200 over every gram (10,000)
    check('the nursery shipped nothing, so its shared labour goes over every gram: .063 + .0105 + .02 = $0.0935 a gram', near(r.all.labour, 0.0935), JSON.stringify(r.all));
    check('…and Building 1\'s figure carries the same (the nursery\'s share included)', near(r.b1.labour, 0.0935), JSON.stringify(r.b1));
    check('the room and strain filters keep the shared labour per gram (they used to drop it)', near(r.room.labour, 0.0935) && near(r.strain.labour, 0.0935), JSON.stringify({ room: r.room, strain: r.strain }));
    // A second lot ships from the nursery building (Grow B): 5,000 g, 10 h by Alex = $200 of its own
    const three = twoBuildings();
    three.rooms.R2GB = { name: 'Grow B', createdDate: '2026-01-01', assignedLots: ['L500'], buildingId: 'B2', isFlowering: true, lightCount: 10, lightWattage: 1000 };
    three.buildings.B2.assignedRooms.push('R2GB');
    three.lots.L500 = { name: 'L500', strain: 'Blue Test', createdDate: D(0), destRoom: 'Grow B', currentRoom: 'Grow B', plantCount: 50, startPlantCount: 50 };
    for (const [tt, n] of [['clone_cut_prep', 0], ['planting', 10], ['transplant', 20], ['flip', 30], ['harvest', 40], ['weigh_ship', 50]])
        three.calendarEvents.push({ id: `ev_l5${tt}`, date: D(n), title: `T ${tt}`, sourceTool: 'CropLabourWizard', lotId: 'L500', taskType: tt, completed: true,
            ...(tt === 'harvest' ? { labour_map: { [D(40)]: [{ employee: 'Alex', hours: 10 }] } } : {}) });
    three._PaperWizard.entries.L500 = { harvestlog: { instances: { [D(40)]: { header: { fw01: '5000' }, days: {} } } } };
    r = await measure(three, `return { all: agg(), b1: agg({ building: 'B1' }), b2: agg({ building: 'B2' }) };`);
    // Building 1: .063 + $105 / 10,000 = .0735 · Building 2: $200 / 5,000 + $200 / 5,000 = .08 · the org: ($830 + $305) / 15,000
    check('each building carries its own shared labour: Building 1 $0.0735, Building 2 $0.08 a gram', near(r.b1.labour, 0.0735) && near(r.b2.labour, 0.08), JSON.stringify({ b1: r.b1, b2: r.b2 }));
    check('…and the buildings add up to the org: ($830 + $105 + $200) / 15,000 g = $0.075667', near(r.all.labour, 1135 / 15000) && near((10000 * r.b1.labour + 5000 * r.b2.labour) / 15000, r.all.labour), JSON.stringify(r.all));

    // SitkaTools' Room Manager: every room has a floor area, in its detail panel
    await openSitka(b, main, BASE);
    await loadSingle(b, main, costDb());
    const floor = await b.run(main, `RoomManager.renderRoomList?.(); const inp = document.querySelector('.room-floor[data-room-id="R1VG"]');
        if (!inp) return 'no field'; inp.value = '640'; inp.dispatchEvent(new Event('change')); return DB.data.rooms.R1VG.floorSqFt;`);
    check('SitkaTools\' room detail panel saves a room\'s floor area (sq ft)', floor === 640, floor);

    await leave(b, main);
    return results;
}
