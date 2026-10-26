// 🔍 Cost ledger (Reports, user request 2026-10-26): where each lot's costs came from, day by day, and the arithmetic
// behind each line. The cost models write the lines themselves, from the same numbers they add up, so a lot's lines
// always add up to its figures on the 💲 Costs page. Electricity and property here, on cost-sharing's lights example
// (L100 in Building 1: Clone 1 D0–D9, Veg 1 D10–D19, Grow 1 D20–D40, Dry 1 D41–D50; L200 in Grow 1 from D41), and
// every lot of the round-number demo DB (examples/make-tens-db.js), in four cost setups.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { today, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';
import { costDb } from './cost-per-gram.test.mjs';

export const title = 'cost ledger: every lot\'s electricity and property, day by day, add up to the Costs page';
const D = n => today(-120 + n);

function ledgerDb({ bills = false, next = true, bill = null } = {}) {
    const db = costDb();
    db.buildings.B1.monthlyPropertyCost = 3000;
    db.rooms.R1DR = { name: 'Dry 1', createdDate: '2026-01-01', assignedLots: [], buildingId: 'B1' };
    db.buildings.B1.assignedRooms.push('R1DR');
    Object.assign(db.lots.L100, { dryRoom: 'Dry 1', trimRoom: 'Dry 1' });
    if (next) db.lots.L200 = { name: 'L200', strain: 'Test Kush', stage: 'flower', createdDate: D(41), currentRoom: 'Grow 1', destRoom: 'Grow 1', plantCount: 80, startPlantCount: 80 };
    // A room chore in Grow 1 on D45, shared by L200 (80 plants) and L400 (20): Alex 5 h → 4 h and 1 h
    if (next) {
        db.lots.L400 = { name: 'L400', strain: 'Test Kush', stage: 'flower', createdDate: D(41), currentRoom: 'Grow 1', destRoom: 'Grow 1', plantCount: 20, startPlantCount: 20 };
        db._DailyWizard = { buildings: { B1: { tasks: [{ code: 'gr01', emoji: '🧽', name: 'Wipe Grow 1', minutes: 30, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], monthDays: [], steps: [], roomId: 'R1G1' }],
            labour: { [D(45)]: { gr01: [{ id: 'le_rc00000045', employee: 'Alex', hours: 5 }] } } } } };
    }
    // A power bill for D25–D35 only: $1,100 over 11 days = $100 a day
    if (bills) Object.assign(db._EmployeeWizard.costs, { electricity: 'bills', bills: [bill || { id: 'pb1', buildingId: 'B1', from: D(25), to: D(35), kWh: 2000, amount: 1100 }] });
    return db;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    const open = async db => {
        await openSitka(b, main, BASE);
        await loadSingle(b, main, db);
        return openTool(b, main, 'EmployeeWizard');
    };
    const close = async ew => { await leave(b, ew); await b.send('browsingContext.close', { context: ew }); };
    const pw = x => x.t.find(t => t.p === 'power');
    const totals = `const M = rptModel(); const out = {};
        for (const c of M.crops) { const { lines } = rptLedger(M, c.lotId); const k = rptCropInputCost(c, M);
            out[c.lotId] = { lines: lines.length, t: rptLedgerTotals(c, M, lines).map(t => ({ p: t.p, adds: t.adds, sum: t.sum, page: t.page })), power: k.power.cost, property: k.property.cost }; }
        return out;`;

    // ---- Estimated electricity ----
    let ew = await open(ledgerDb());
    let r = await b.run(ew, totals);
    check('every part of L100\'s lines adds up to the 💲 Costs page: labour, electricity, water, fertilizer, supplies, property',
        r.L100.t.length === 6 && r.L100.t.every(t => t.adds && t.page != null && Math.abs(t.sum - t.page) < 0.005), JSON.stringify(r.L100));
    check('…and every lot\'s lines add up to what the cost code worked out (L200, L400 have no water, fertilizer or supplies: nothing to add)',
        ['L200', 'L400'].every(id => r[id].t.every(t => t.adds !== false)) && ['L200', 'L400'].every(id => r[id].t.filter(t => ['power', 'property', 'labour'].includes(t.p)).every(t => t.adds)), JSON.stringify([r.L200, r.L400]));
    const line = (id, d, part) => b.run(ew, `const M = rptModel(); return rptLedger(M, '${id}').lines.find(l => l.d === '${d}' && l.part === '${part}') || null;`);
    let l = await line('L100', D(30), 'power');
    check('a flower day\'s electricity, written out: Grow 1\'s lights at the grow log\'s 50 %, its dehumidifier, the hall\'s AC, × $0.10',
        l && l.how.includes('Grow 1 lights: 20 × 1,000 W × 12 h (bloom) × 50 % (grow log) = 120 kWh') && l.how.includes('Grow 1 equipment: Dehu 1,000 W × 1 × 24 h = 24 kWh')
        && l.how.includes('empty rooms\' equipment in Building 1: Hall 1 (AC 500 W × 1 × 24 h) = 12 kWh, × its 100 of the 100 plants in the building = 12 kWh')
        && l.how.includes('156 kWh × $0.10 per kWh = $15.60') && Math.abs(l.cost - 15.6) < 1e-9, l?.how);
    l = await line('L100', D(40), 'labour');
    check('a task\'s labour, person by person at their wage: the harvest\'s 30 h = $630',
        l && l.how === 'T harvest: Alex 10 h × $20.00/h = $200.00 · Blair 10 h × $21.00/h = $210.00 · Casey 10 h × $22.00/h = $220.00 · $630.00 in all' && l.cost === 630, l?.how);
    l = await line('L200', D(45), 'labour');
    check('a room chore shared by plants: Alex\'s 5 h in Grow 1 × L200\'s 80 of the 100 plants = 4 h × $20 = $80',
        l && l.how === '🧽 Wipe Grow 1 in Grow 1: Alex 5 h × its 80 of the 100 plants in the room = 4 h × $20.00/h = $80.00' && Math.abs(l.cost - 80) < 1e-9, l?.how);
    l = await line('L100', D(30), 'water');
    check('a grow-log day\'s water: 100 L × $2.50 per 1,000 L = $0.25', l && l.how === 'grow log: 100 L × $2.50 per 1,000 L ÷ 1,000 = $0.2500' && Math.abs(l.cost - 0.25) < 1e-12, l?.how);
    const fert = await b.run(ew, `const M = rptModel(); return rptLedger(M, 'L100').lines.filter(l => l.d === '${D(30)}' && l.part === 'fert').map(l => l.how);`);
    check('…its fertilizer, product by product: Activator 10 mL × $50/L, Core 20 mL × $40/L',
        fert.includes('grow log: Activator 10 mL × $50.00 per L ÷ 1,000 = $0.5000') && fert.includes('grow log: Core 20 mL × $40.00 per L ÷ 1,000 = $0.8000'), fert.join(' | '));
    const sup = await b.run(ew, `const M = rptModel(); return rptLedger(M, 'L100').lines.filter(l => l.part === 'supplies').map(l => l.how);`);
    check('…and its recipe\'s supplies: a peat puck per plant at the start, 6 coco blocks per crop',
        sup.includes('recipe: Peat puck, 1 puck per plant × its 100 plants at the start × $0.25 = $25.00') && sup.includes('recipe: Coco block, 6 block per crop × $3.00 = $18.00'), sup.join(' | '));
    l = await line('L100', D(30), 'property');
    const day = n => { const [y, m] = D(n).split('-').map(Number); return new Date(y, m, 0).getDate(); };
    check('a growing day\'s rent, written out: the month ÷ its days, by the lights of the rooms with a lot growing',
        l && l.how.startsWith(`Building 1: $3,000.00 a month ÷ ${day(30)} days = $${(3000 / day(30)).toFixed(2)} today · by lights: Grow 1 20 = 20 lights → Grow 1 20 of 20 = $${(3000 / day(30)).toFixed(2)}`)
        && Math.abs(l.cost - 3000 / day(30)) < 1e-9, l?.how);
    l = await line('L100', D(45), 'property');
    check('a drying day: no rent, and the line says why', l && l.cost === 0 && l.how.includes('drying or trimming in Dry 1: no rent (by lights, only the rooms with a lot growing share it)'), l?.how);
    l = await line('L200', D(45), 'property');
    check('…the lots growing in Grow 1 that day carry the building, by plants: L200 80 of the 100', l && Math.abs(l.cost - 3000 / day(45) * 0.8) < 1e-9 && l.how.includes('→ Grow 1 20 of 20') && l.how.includes('× its 80 of the 100 plants in the room'), l?.how);

    // The page: picked from the 💲 Costs page's crop-by-crop card
    await b.run(ew, `document.getElementById('tabReports').click(); RPT.page = 'costs'; RPT.period = '12m'; renderReports();`, { user: true });
    await b.run(ew, `document.querySelector('[data-ledger="L100"]').click();`, { user: true });
    let page = await b.run(ew, `return { page: RPT.page, lot: document.getElementById('rptLedgerLot')?.value, html: document.getElementById('rptBody').innerHTML,
        text: document.getElementById('rptBody').innerText, csv: document.getElementById('rptLedgerCsv') ? await (await fetch(document.getElementById('rptLedgerCsv').href)).text() : '',
        name: document.getElementById('rptLedgerCsv')?.getAttribute('download'), active: document.querySelector('#rptPages button.active')?.dataset.page };`);
    check('🔍 on the Costs page opens the ledger for that lot', page.page === 'ledger' && page.lot === 'L100' && page.active === 'ledger', JSON.stringify({ page: page.page, lot: page.lot }));
    check('…the summary says each of the six parts adds up, with no NaN or undefined', (page.text.match(/✓ adds up/g) || []).length === 6 && !/NaN|undefined/.test(page.html), page.text.slice(0, 400));
    const csvRows = page.csv.replace(/^﻿/, '').trim().split('\r\n');
    check('…⬇ CSV has every line, with the arithmetic', page.name === `Ledger-L100-${today()}.csv` && csvRows[0] === 'Lot,Date,Part,Building,Rooms,Amount,Unit,$,How it was worked out'
        && csvRows.length - 1 === r.L100.lines && csvRows.some(x => x.includes('156 kWh × $0.10 per kWh')), `${csvRows.length} rows`);
    await b.run(ew, `const s = document.getElementById('rptLedgerPart'); s.value = 'property'; s.dispatchEvent(new Event('change'));`, { user: true });
    page = await b.run(ew, `return [...document.querySelectorAll('.rpt-ledger tbody tr')].map(tr => tr.cells[1].textContent);`);
    check('…picking a part shows only its lines', page.length > 0 && page.every(x => x === '🏠 Property'), page.slice(0, 3).join());
    await close(ew);

    // ---- Power bills: each bill shared by kWh over all its days (user decision 2026-10-26); days no bill covers are missing ----
    // D25–D35 (11 days): L100 in Grow 1, alone in Building 1. D25–D29 veg: 20 lights × 1 kW × 18 h + dehumidifier 24 + the
    // hall's AC 12 = 396 kWh a day; D30–D35 bloom at 50 %: 120 + 24 + 12 = 156. 5 × 396 + 6 × 156 = 2,916 kWh → $1,100 ÷ 2,916
    ew = await open(ledgerDb({ bills: true }));
    r = await b.run(ew, totals);
    check('with bills: the lines add up to the billed days, and the page says the rest is missing', r.L100.power === null && pw(r.L100).adds
        && Math.abs(pw(r.L100).sum - 1100) < 1e-6, JSON.stringify(r.L100));
    l = await line('L100', D(30), 'power');
    check('…a billed day, written out: the bill ÷ the building\'s kWh over the bill × the lot\'s kWh that day (156 × $1,100 ÷ 2,916)',
        l && l.how.includes(`Building 1 power bill $1,100.00 for ${D(25)} → ${D(35)} ÷ the 2,916 kWh estimated for Building 1 over those days = $0.3772 per kWh; its 156 kWh today × $0.3772 = $58.85`)
        && Math.abs(l.cost - 156 * 1100 / 2916) < 1e-9, l?.how);
    l = await line('L100', D(26), 'power');
    check('…a veg day uses more, so it carries more: 396 kWh × $1,100 ÷ 2,916', l && Math.abs(l.cost - 396 * 1100 / 2916) < 1e-9, l?.how);
    l = await line('L100', D(20), 'power');
    check('…a day no bill covers says so', l && l.how.includes('no power bill covers today in Building 1, so this lot\'s electricity is missing until that bill is added'), l?.how);
    await close(ew);

    // A drying lot doesn't pay like a flower room: bill $2,100 for D30–D50. L100 flowers D30–D40 (D30–D39 156 kWh, D40
    // harvest day 240 + 24 + 12 = 276), then dries alone (Grow 1 empty: its dehumidifier and the hall's AC, 36 kWh a day
    // to the only lot in the building). 1,560 + 276 + 360 = 2,196 kWh; a drying day carries 36 of them, not 1/21 of the bill
    const dryBill = { id: 'pb2', buildingId: 'B1', from: D(30), to: D(50), amount: 2100 };
    ew = await open(ledgerDb({ bills: true, next: false, bill: dryBill }));
    l = await line('L100', D(45), 'power');
    check('a drying day alone in the building: its 36 kWh × $2,100 ÷ 2,196 kWh = $34.43, not $100 (1/21 of the bill)',
        l && Math.abs(l.cost - 36 * 2100 / 2196) < 1e-9 && l.how.includes('÷ the 2,196 kWh estimated for Building 1 over those days'), l?.how);
    r = await b.run(ew, totals);
    check('…and the lot still carries the whole bill: $2,100', Math.abs(pw(r.L100).sum - 2100) < 1e-6, JSON.stringify(pw(r.L100)));
    await close(ew);
    // With L200 growing in Grow 1 from D41: every line of the bill's days is at the same $ per kWh
    ew = await open(ledgerDb({ bills: true, bill: dryBill }));
    const perKwh = await b.run(ew, `const M = rptModel(); return ['L100', 'L200'].flatMap(id => rptLedger(M, id).lines.filter(l => l.part === 'power' && l.d >= '${D(30)}' && l.d <= '${D(50)}' && l.kWh > 0).map(l => [id, l.d, l.cost / l.kWh]));`);
    const rates = [...new Set(perKwh.map(([, , x]) => x.toFixed(9)))];
    check('two lots on one bill: one $ per kWh on every day of it (drying or flowering)', perKwh.length > 20 && rates.length === 1, rates.slice(0, 4).join(', '));
    r = await b.run(ew, totals);
    check('…and the lots add up to the bill (L100, L200 and L400)', Math.abs(pw(r.L100).sum + pw(r.L200).sum + pw(r.L400).sum - 2100) < 1e-6, JSON.stringify([pw(r.L100).sum, pw(r.L200).sum, pw(r.L400).sum]));
    await close(ew);

    // ---- The round-number demo DB: every lot, four cost setups ----
    const dir = mkdtempSync(join(tmpdir(), 'tens-'));
    try {
        const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'examples', 'make-tens-db.js');
        execFileSync(process.execPath, [script, join(dir, 'Tens.json')], { stdio: 'ignore' });
        const tens = JSON.parse(readFileSync(join(dir, 'Tens.json'), 'utf8'));
        for (const setup of ['estimate', 'bills', 'plants', 'area']) {
            const db = JSON.parse(JSON.stringify(tens)), c = db._EmployeeWizard.costs;
            if (setup === 'bills') {
                c.electricity = 'bills';
                c.bills = [];
                for (let i = -12; i <= 1; i++) {
                    const t = new Date(); const f = new Date(t.getFullYear(), t.getMonth() + i, 1), e = new Date(t.getFullYear(), t.getMonth() + i + 1, 0);
                    const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
                    c.bills.push({ id: `b1${i}`, buildingId: 'B1', from: iso(f), to: iso(e), amount: 9000 + i * 100 });
                    if (i % 3) c.bills.push({ id: `b2${i}`, buildingId: 'B2', from: iso(f), to: iso(e), amount: 7000 });
                }
            }
            if (setup === 'plants' || setup === 'area') c.propertyShare = setup;
            ew = await open(db);
            r = await b.run(ew, totals);
            const bad = Object.entries(r).flatMap(([id, x]) => x.t.filter(t => t.adds !== true).map(t => `${id} ${t.p}`));
            check(`demo DB (${setup}): every part of all ${Object.keys(r).length} lots' lines adds up, clones included (${Object.values(r).reduce((t, x) => t + x.lines, 0)} lines)`,
                Object.keys(r).length === 11 && Object.values(r).every(x => x.t.length === 6) && !bad.length, bad.join(', '));
            await close(ew);
        }
    } finally { rmSync(dir, { recursive: true, force: true }); }

    await leave(b, main);
    return results;
}
