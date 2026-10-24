// Costs follow what the grow log recorded, day by day (user decision 2026-10-23): the room a lot was really in, and its
// plant count that day, share a room's electricity, its chores and the building's property. Lot A reached Grow 1 three
// days after its plan and lost half its plants 3 days ago; lot B (no grow log) was in Grow 1 throughout.
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';

export const title = 'costs follow the grow log: rooms and plant counts day by day';

function iso(dt) { return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; }
const dayList = (a, b) => { const out = []; for (let n = a; n <= b; n++) out.push(today(n)); return out; };

export function actualDb() {
    const D = n => today(n);
    const db = fixtureDb();
    db.rooms.R1VG = { name: 'Veg 1', description: null, createdDate: '2026-01-01', assignedLots: [], isFlowering: false, buildingId: 'B1' };
    db.buildings.B1.assignedRooms.push('R1VG');
    Object.assign(db.rooms.R1G1, { lightCount: 2, lightWattage: 500, vegLightHours: 18, bloomLightHours: 12, assignedLots: ['A100', 'B200'] });
    db.buildings.B1.monthlyPropertyCost = 3100;
    const lot = (id, more) => ({ name: id, strain: 'Test Kush', stage: 'flower', closedDate: null, cloningRoom: 'Clone 1', vegRoom: 'Veg 1', destRoom: 'Grow 1', currentRoom: 'Grow 1', ...more });
    db.lots = { A100: lot('A100', { createdDate: D(-40), startPlantCount: 100, plantCount: 50, type: 'new-lot' }), B200: lot('B200', { createdDate: D(-30), startPlantCount: 100, plantCount: 100, type: 'new-lot' }) };
    const ev = (id, lotId, tt, date) => ({ id, date, title: `T ${tt}`, sourceTool: 'CropLabourWizard', lotId, taskType: tt });
    db.calendarEvents = [ev('a0', 'A100', 'clone_cut_prep', D(-40)), ev('a1', 'A100', 'planting', D(-26)), ev('a2', 'A100', 'transplant', D(-16)), ev('a3', 'A100', 'flip', D(-6)), ev('a4', 'A100', 'harvest', D(50)),
        ev('b2', 'B200', 'transplant', D(-30)), ev('b3', 'B200', 'flip', D(-20)), ev('b4', 'B200', 'harvest', D(40))];
    // A room chore in Grow 1, with hours on a day only B was there and on a day both were
    db._DailyWizard.buildings.B1.tasks.push({ code: 'gr01', emoji: '💧', name: 'Water Grow 1', minutes: 30, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], monthDays: [], steps: [], roomId: 'R1G1' });
    db._DailyWizard.buildings.B1.labour = { ...(db._DailyWizard.buildings.B1.labour || {}),
        [D(-15)]: { gr01: [{ id: 'le_actual1', employee: 'Alex', hours: 2 }] }, [D(-2)]: { gr01: [{ id: 'le_actual2', employee: 'Alex', hours: 3 }] } };
    // A's grow log: in Veg 1 until 14 days ago, Grow 1 from 13 days ago (3 days after its plan), Bloom from 6 days ago,
    // 50 plants culled 3 days ago
    const page = (room, phase, from, to, count) => ({ phase, room, header: {}, days: Object.fromEntries(dayList(from, to).map(d => [d, { cnt: String(count(d)) }])),
        phaseChangeDate: null, strikeInitials: null, snapshots: {}, signature: null, completedAt: null, printedAt: null });
    const p3 = page('Grow 1', 'Bloom', -6, -1, d => d < D(-3) ? 100 : 50);
    p3.days[D(-3)]._removed = { culled: 50 };
    db._PaperWizard = {
        sheets: { glog: { name: 'Grow Log', cadence: 'daily-weekly', document: 'grow-log', fields: [] } },
        wizards: { wg: { sheetId: 'glog', name: 'Grow Log', questions: [{ id: 'cnt', label: 'Plants', type: 'plant-count', options: [], rowScoped: true }] } },
        entries: { A100: { glog: { instances: { [D(-26)]: page('Veg 1', 'Vegetation', -26, -14, () => 100), [D(-13)]: page('Grow 1', 'Vegetation', -13, -7, () => 100), [D(-6)]: p3 } } } }
    };
    db._EmployeeWizard.costs = { electricity: 'estimate', kWhRate: 0.1, propertyShare: 'plants', bills: [] };
    return db;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, actualDb());
    const ew = await openTool(b, main, 'EmployeeWizard');
    const near = (a, x, eps = 0.005) => a != null && Math.abs(a - x) < eps;
    const R = await b.run(ew, `const M = rptModel(), A = M.crops.find(c => c.lotId === 'A100'), B = M.crops.find(c => c.lotId === 'B200');
        const pw = rptPowerModel(M.crops), pr = rptPropertyModel(M.crops);
        return { stays: rptCropRoomDays(A).map(st => [st.roomId, st.phase, st.from, st.to, !!st.fromLog]),
            plants: ['${today(-30)}', '${today(-4)}', '${today(-3)}', '${today()}'].map(d => rptPlantsOn(A, d)), bPlants: rptPlantsOn(B, '${today(-2)}'),
            power: { A: pw.byCrop.get('A100').cost, B: pw.byCrop.get('B200').cost }, prop: { A: pr.byCrop.get('A100').cost, B: pr.byCrop.get('B200').cost },
            chores: { A: A.labour.chores?.['B1:gr01']?.act || 0, B: B.labour.chores?.['B1:gr01']?.act || 0 } };`);
    const want = [['R1CL', 'clone', today(-40), today(-27), false], ['R1VG', 'veg', today(-26), today(-14), true], ['R1G1', 'veg', today(-13), today(-7), true], ['R1G1', 'flower', today(-6), today(), true], ['R1G1', 'flower', today(1), today(50), false]];
    check('A is where its grow log put it: Veg 1 until 14 days ago, Grow 1 from 13 days ago (not its planned 16), in Bloom from 6 days ago; the plan before and after',
        JSON.stringify(R.stays) === JSON.stringify(want), JSON.stringify(R.stays));
    check('its plants each day: 100 at the start and until the cull, 50 from 3 days ago; B (no grow log) keeps its starting 100',
        JSON.stringify(R.plants) === '[100,100,50,50]' && R.bPlants === 100, JSON.stringify([R.plants, R.bPlants]));
    // Grow 1's lights, 1 kW at $0.10: B alone 30–21 days ago at 18 h ($18.00) and 20–14 days ago at 12 h ($8.40); both
    // from 13 days ago at 12 h, halves while they each had 100 plants (10 days: $6.00 each), then A 50 / B 100 for 4 days
    check('Grow 1\'s lights go by who was really there and their plants that day: A $7.60, B $35.60', near(R.power.A, 7.6) && near(R.power.B, 35.6), JSON.stringify(R.power));
    check('a room chore goes the same way: 2 h when only B was there all to B; 3 h with A at 50 and B at 100 split 1 : 2', near(R.chores.A, 1) && near(R.chores.B, 4), JSON.stringify(R.chores));
    // Property: $3,100 a month over the month's days, shared in Building 1 by plants that day
    const amt = n => { const [y, m] = today(n).split('-').map(Number); return 3100 / new Date(y, m, 0).getDate(); };
    let pa = 0, pb = 0;
    for (let n = -40; n <= 0; n++) {
        const a = n <= -31 ? 1 : n <= -4 ? 0.5 : 1 / 3;
        pa += amt(n) * a;
        if (n >= -30) pb += amt(n) * (1 - a);
    }
    check('property is shared by the plants in the building each day (A alone, then half, then a third)', near(R.prop.A, pa, 0.01) && near(R.prop.B, pb, 0.01), JSON.stringify([R.prop, pa, pb]));
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });
    await leave(b, main);
    return results;
}
