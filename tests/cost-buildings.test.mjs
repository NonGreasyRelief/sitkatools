// Cost per gram audit, 2026-10-26 — cost by building and the nursery (group C), on cost-per-gram.test.mjs's example with
// a nursery: L100 is cut and cloned in Building 2's Clone N (D0–D9), then vegged (Veg 1) and flowered (Grow 1) in
// Building 1, where it ships from. Electricity at $0.10 / kWh; today = D120.
import { today, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';
import { costDb } from './cost-per-gram.test.mjs';

export const title = 'cost per gram audit: where the money was spent — by building, the nursery, each lot';
const D = n => today(-120 + n);
const near = (a, b, eps = 1e-6) => a != null && Math.abs(a - b) < eps;

function nurseryDb({ mother = false } = {}) {
    const db = costDb();
    db.buildings.B2 = { name: 'Nursery', createdDate: '2026-01-01', assignedRooms: ['R2CL', 'R2MO'] };
    db.rooms.R2CL = { name: 'Clone N', createdDate: '2026-01-01', assignedLots: [], buildingId: 'B2', lightCount: 10, lightWattage: 100, vegLightHours: 18, bloomLightHours: 12 };
    db.rooms.R2MO = { name: 'Mother N', createdDate: '2026-01-01', assignedLots: [], buildingId: 'B2', designation: 'Mother', lightCount: 4, lightWattage: 600, vegLightHours: 18 };
    db.lots.L100.cloningRoom = 'Clone N';
    // Cutting the clones in the nursery: 2 h by Alex ($20) on Day 0
    db.calendarEvents.find(e => e.taskType === 'clone_cut_prep').labour_map = { [D(0)]: [{ id: 'le_cut0000001', employee: 'Alex', hours: 2 }] };
    if (mother) {
        // A mother lot in Mother N since D-30 (transplant), retiring in the future; L100 was cut from it
        db.lots.M1 = { name: 'M1', strain: 'Test Kush', stage: 'mother', createdDate: D(-60), destRoom: 'Mother N', currentRoom: 'Mother N', plantCount: 4, startPlantCount: 4,
            _tool_CropLabourWizard: { kind: 'vegetative', recipeId: 'rvM' } };
        for (const [tt, n] of [['clone_cut_prep', -60], ['planting', -45], ['transplant', -30], ['retire', 200]])
            db.calendarEvents.push({ id: `ev_m1${tt}`, date: D(n), title: `T ${tt}`, sourceTool: 'CropLabourWizard', lotId: 'M1', taskType: tt });
        Object.assign(db.lots.L100, { type: 'sub-lot', parentLotId: 'M1', startPlantCount: 100 });
    }
    return db;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    const measure = async (db, code) => {
        await openSitka(b, main, BASE);
        await loadSingle(b, main, db);
        const ew = await openTool(b, main, 'EmployeeWizard');
        const r = await b.run(ew, `const M = rptModel(); const of = id => M.crops.find(c => c.lotId === id);
            const byB = id => Object.fromEntries([...rptCropSpendByBuilding(of(id), M)].map(([bid, o]) => [bid, o]));
            const fac = () => { const out = {}; for (const [key, parts] of rptFacilitySpend(M)) { const bid = key.split('|')[0]; const o = out[bid] || (out[bid] = {}); for (const [p, v] of Object.entries(parts)) o[p] = (o[p] || 0) + v; } return out; };
            ${code}`);
        await leave(b, ew); await b.send('browsingContext.close', { context: ew });
        return r;
    };

    let r = await measure(nurseryDb(), `return { b: byB('L100'), ship: rptCropBuilding(of('L100')), fac: fac(), page: rptCosts(M), parts: rptCropCostParts(of('L100'), M) };`);
    check('L100 ships from Building 1, where it flowered', r.ship === 'B1', r.ship);
    // In the nursery: the cutting (2 h × $20 = $40), Clone N's lights (1 kW × 18 h × 10 days × $0.10 = $18), and its supplies,
    // charged where it started ($25 peat pucks + $18 coco blocks)
    check('spent on L100 in the nursery: labour $40, electricity $18 (Clone N), supplies $43 (where it started)', near(r.b.B2?.labour, 40) && near(r.b.B2?.power, 18) && near(r.b.B2?.supplies, 43), JSON.stringify(r.b.B2));
    // In Building 1: its 30 h ($630), veg 900 + flower 5,040 kWh of lights, its dehumidifier 21 + 10 days (504 + 240) and the hall AC
    // on its 31 days (372): 7,056 kWh = $705.60, water $2.50, fertilizer $13
    check('spent on L100 in Building 1: labour $630, electricity $705.60, water $2.50, fertilizer $13', near(r.b.B1?.labour, 630) && near(r.b.B1?.power, 705.6) && near(r.b.B1?.water, 2.5) && near(r.b.B1?.fert, 13), JSON.stringify(r.b.B1));
    check('…and the two add up to its own costs', near(r.b.B1.labour + r.b.B2.labour, r.parts.labour) && near(r.b.B1.power + r.b.B2.power, r.parts.power) && near((r.b.B2.supplies || 0) + (r.b.B1.supplies || 0), r.parts.supplies), JSON.stringify(r.parts));
    // Building 1 runs its dehumidifier (24 kWh) and hall AC (12 kWh) every day D0–D120 (121 days) and its lights while L100 grows
    // there: 4,356 + 5,940 = 10,296 kWh — what Building 1 spent on electricity, idle days included
    check('Building 1 spent $1,029.60 on electricity: every kWh it used (L100\'s share and its idle days)', near(r.fac.B1?.power, 1029.6), JSON.stringify(r.fac.B1));
    check('the nursery spent $40 labour and $18 electricity (no lot there after D9, no equipment)', near(r.fac.B2?.labour, 40) && near(r.fac.B2?.power, 18), JSON.stringify(r.fac.B2));
    check('the Costs page draws the by-building, spend and nursery cards, no NaN/undefined',
        r.page.includes('What does a gram cost in each building?') && r.page.includes('What does each building cost to run?') && r.page.includes('Nursery and flowering: where was each lot') && !/NaN|undefined|Infinity/.test(r.page), '');

    // A mother lot in the nursery: L100's clones carry its cost; the nursery's spend has it
    r = await measure(nurseryDb({ mother: true }), `const ch = rptCloneCharge(of('L100'), M), mo = byB('M1');
        return { ch: ch.parts, mother: mo, fac: fac(), page: rptCosts(M) };`);
    // Mother N: 2.4 kW × 18 h a day while M1 is in it (D-30 to today, D120: 151 days) = 6,523.2 kWh = $652.32
    check('the mother lot\'s electricity is spent in the nursery (Mother N, 151 days: $652.32)', near(r.mother.B2?.power, 652.32), JSON.stringify(r.mother));
    check('…L100\'s 100 clones carry it (its only clones: $652.32)', near(r.ch.power, 652.32), JSON.stringify(r.ch));
    check('…and the nursery\'s spend includes it ($18 + $652.32)', near(r.fac.B2?.power, 18 + 652.32), JSON.stringify(r.fac.B2));
    check('…and the lot-by-lot split shows its clones', /Its clones \$\/g/.test(r.page), '');

    await leave(b, main);
    return results;
}
