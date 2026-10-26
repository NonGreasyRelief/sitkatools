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

    // 📅 What each building cost to run counts only the period's own days (user decision 2026-10-26), not every calendar
    // month the period touches. Building 1 pays $3,000 a month (spread over each month's days) on every day. The period
    // starts D30 (D31 when D30 is the 1st, so it starts partway through a month)
    const F = D(30).endsWith('-01') ? 31 : 30, FROM = D(F);
    // (the nursery's rent is $0, set, so L100's property is priced: partial = missing)
    const rentDb = () => { const db = nurseryDb(); db.buildings.B1.monthlyPropertyCost = 3000; db.buildings.B2.monthlyPropertyCost = 0; return db; };
    const rentFrom = n0 => { let t = 0; for (let n = n0; n <= 120; n++) { const [y, m] = D(n).split('-').map(Number); t += 3000 / new Date(y, m, 0).getDate(); } return t; };
    const inPeriod = `const sumB = map => { const o = {}; for (const [key, parts] of map) { const bid = key.split('|')[0]; const x = o[bid] || (o[bid] = {}); for (const [p, v] of Object.entries(parts)) x[p] = (x[p] || 0) + v; } return o; };
        const P = sumB(rptFacilitySpendIn(M, '${FROM}', M.today));`;
    r = await measure(rentDb(), `${inPeriod} return { P, all: fac() };`);
    check(`a period from D${F} counts Building 1's rent on its own days (D${F}–D120), not the whole month it starts in`,
        near(r.P.B1?.property, rentFrom(F), 1e-4) && near(r.all.B1?.property, rentFrom(0), 1e-4), JSON.stringify({ got: r.P.B1?.property, want: rentFrom(F) }));
    // From D30: the dehumidifier and hall AC (36 kWh a day) every day to D120, and Grow 1's lights while L100 flowered:
    // 120 kWh a day at 50 % light to D39, 240 kWh on harvest day (D40)
    const kWhFrom = (121 - F) * 36 + (40 - F) * 120 + 240;
    check(`…and Building 1's electricity on those days: ${kWhFrom.toLocaleString()} kWh × $0.10`, near(r.P.B1?.power, kWhFrom * 0.1, 1e-4), r.P.B1?.power);

    // A closed-out lot's locked costs are month totals: the month the period starts in counts the share of the lot's days
    // in Building 1 that month (it was there D10–D40) that fall in the period
    await openSitka(b, main, BASE);
    await loadSingle(b, main, rentDb());
    const ew = await openTool(b, main, 'EmployeeWizard');
    await b.run(ew, `rptSaveSummaries([rptModel().crops.find(c => c.lotId === 'L100')]);`);
    await b.sleep(300);
    await b.run(main, `delete DB.data.lots.L100; DB.data.calendarEvents = DB.data.calendarEvents.filter(e => e.lotId !== 'L100'); markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    r = await b.run(ew, `const M = rptModel(); ${inPeriod}
        const c = M.crops.find(x => x.lotId === 'L100'), from = '${FROM}', ym0 = from.slice(0, 7);
        const days = (a, z) => a > z ? 0 : dDiff(a, z) + 1, mEnd = localDateStr(new Date(+ym0.slice(0, 4), +ym0.slice(5, 7), 0));
        const lo = '${D(10)}' > ym0 + '-01' ? '${D(10)}' : ym0 + '-01', hi = '${D(40)}' < mEnd ? '${D(40)}' : mEnd;
        const share = days(lo > from ? lo : from, hi) / days(lo, hi);
        let want = 0;
        for (const [key, parts] of Object.entries(c.costs?.spend || {})) { const [bid, ym] = key.split('|'); if (bid === 'B1' && ym >= ym0) want += (parts.property || 0) * (ym === ym0 ? share : 1); }
        const idle = Object.entries(M.property.idleBy.B1 || {}).filter(([d]) => d >= from).reduce((t, [, v]) => t + v, 0);
        return { closed: !!c?.closed, got: P.B1?.property, want: want + idle, share };`);
    check('a closed-out lot\'s locked month totals: the month the period starts in counts the share of its days there inside the period',
        r.closed && near(r.got, r.want, 0.02) && r.share > 0 && r.share < 1, JSON.stringify(r));
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });

    // The labels: a $/g bar keeps its cents, a money axis the decimals of its step (a $1.50 tick never reads "$2"), and a
    // month the period starts partway through says so
    r = await measure(rentDb(), `RPT.period = '3m'; DB.data._EmployeeWizard.costs.kWhRate = 100; const M3 = rptModel();
        return { ticks: [rMoneyTick(1.5, 0.5), rMoneyTick(2, 1), rMoneyTick(0.025, 0.025), rMoneyTick(5, 2.5)], page: rptCosts(M3), from: M3.per.from, fromLabel: dFmt(M3.per.from) };`);
    check('money axis ticks: $1.50, $2, $0.025, $5.00', r.ticks.join() === '$1.50,$2,$0.025,$5.00', r.ticks.join());
    check('the by-building $/g bars show cents to 3 places above $1 (not "$72")', /class="rv-val"[^>]*>\$\d[\d,]*\.\d{3}</.test(r.page), (r.page.match(/class="rv-val"[^>]*>[^<]*</g) || []).join(' '));
    check('the month the period starts in is marked "(from …)"', r.from.endsWith('-01') || r.page.includes(`(from ${r.fromLabel})`), r.from);

    await leave(b, main);
    return results;
}
