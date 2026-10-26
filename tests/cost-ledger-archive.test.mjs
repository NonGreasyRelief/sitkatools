// 🔍 Cost ledger kept on file (user decision 2026-10-26): a finished lot's ledger is saved with its crop summary — the labour
// lines (they name wages) in Wages.json, the rest in Main.json — and SitkaTools' close-out puts it in the lot's archive,
// then drops the copies. And 🧾 Every dollar accounted for: each power bill and each building's month of rent adds back up
// to what the lots carry plus the idle days. On close-out-lock.test.mjs's example (L100, finished, rent $3,000 a month).
import { today, makeChecker, fresh, openSitka, loadSingle, splitFiles, openTool, leave, saveSummaries } from './lib/helpers.mjs';
import { costDb } from './cost-per-gram.test.mjs';

export const title = 'cost ledger on file: saved with a finished lot\'s summary, into its archive at close-out; every bill and month of rent adds up';
const D = n => today(-120 + n);

function finishedDb({ bills = false } = {}) {
    const db = costDb();
    db.lots.L100.plantCount = 0;
    db.lots.L100.startPlantCount = 100;
    const g = db._PaperWizard.entries.L100.growlog;
    g.paperBefore = D(30);
    g.instances[D(30)].completedAt = new Date().toISOString();
    db.buildings.B1.monthlyPropertyCost = 3000;
    if (bills) Object.assign(db._EmployeeWizard.costs, { electricity: 'bills', bills: [{ id: 'pb1', buildingId: 'B1', from: D(0), to: D(60), amount: 6100 }] });
    return db;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    const close = async ew => { await leave(b, ew); await b.send('browsingContext.close', { context: ew }); };
    const sums = lines => lines.reduce((t, l) => { t[l.part] = (t[l.part] || 0) + (l.cost || 0); return t; }, {});

    // ---- 🧾 Every dollar accounted for (bills: $6,100 for D0–D60; L100 is the only lot, in Building 1 D0–D40) ----
    await openSitka(b, main, BASE);
    await loadSingle(b, main, finishedDb({ bills: true }));
    let ew = await openTool(b, main, 'EmployeeWizard');
    let r = await b.run(ew, `const M = rptModel(), pm = rptPowerModel(M.crops), pr = rptPropertyModel(M.crops);
        const bill = pm.billSplit[0], lots = [...bill.lots.values()].reduce((t, v) => t + v, 0);
        const months = [...pr.rentSplit.values()].map(x => ({ ym: x.ym, rent: x.rent, lots: [...x.lots.values()].reduce((t, v) => t + v, 0), idle: x.idle }));
        RPT.page = 'ledger'; RPT.ledgerLot = 'L100'; document.getElementById('tabReports').click(); renderReports();
        const text = document.getElementById('rptBody').innerText;
        return { amount: bill.amount, lots, idle: bill.idle, l100: bill.lots.get('L100'), months, text, rows: (text.match(/✓ adds up/g) || []).length };`, { user: true });
    check('a power bill splits into its lots and idle days, adding back up to the bill ($6,100)', Math.abs(r.lots + r.idle - 6100) < 1e-6 && r.amount === 6100 && r.l100 > 0 && r.idle > 0, JSON.stringify({ lots: r.lots, idle: r.idle }));
    check('…every month of rent adds back up too (lots + idle days = the rent)', r.months.length >= 3 && r.months.every(m => Math.abs(m.lots + m.idle - m.rent) < 1e-6), JSON.stringify(r.months));
    check('…and the ledger page shows them, each with ✓ adds up', r.text.includes('🧾 Every dollar accounted for') && r.text.includes('⚡ Power bills') && r.text.includes('🏠 Rent and fees, by month')
        && r.rows >= 6 + 1 + r.months.length, `${r.rows} ✓`);
    await close(ew);

    // ---- A finished lot's ledger is saved with its summary ----
    await openSitka(b, main, BASE);
    await loadSingle(b, main, finishedDb());
    await saveSummaries(b, main, ['L100']);
    r = await b.run(main, `const ew = DB.data._EmployeeWizard; return { kept: ew.crops.L100.costs.ledger, labour: ew.cropCosts.L100.ledger, costs: ew.crops.L100.costs, cost: ew.cropCosts.L100.cost };`);
    check('saved with the summary: the lines in the summary, none of them labour', r.kept?.lines?.length > 50 && r.kept.lines.every(l => l.part !== 'labour') && r.kept.savedAt, `${r.kept?.lines?.length} lines`);
    check('…the labour lines (they name wages) with the labour cost', r.labour?.lines?.length > 0 && r.labour.lines.every(l => l.part === 'labour')
        && r.labour.lines.some(l => l.how.includes('Alex 10 h × $20.00/h = $200.00')), JSON.stringify(r.labour?.lines?.map(l => l.how)));
    const kept = sums([...r.kept.lines, ...r.labour.lines]);
    check('…and they add up to the costs frozen with it', Math.abs(kept.power - r.costs.power.cost) < 0.01 && Math.abs(kept.property - r.costs.property.cost) < 0.01
        && Math.abs(kept.water - r.costs.water.cost) < 0.01 && Math.abs(kept.fert - r.costs.fert.cost) < 0.01 && Math.abs(kept.supplies - r.costs.supplies.cost) < 0.01 && Math.abs(kept.labour - r.cost) < 0.01, JSON.stringify(kept));

    // With split files: the labour lines go to Wages.json, never to Main.json (building devices open Main)
    const asDb = await b.run(main, `return JSON.parse(JSON.stringify(DB.data));`);
    const files = await splitFiles(b, main, BASE, asDb);
    const mainJ = JSON.parse(files['Main.json']), wagesJ = JSON.parse(files['Wages.json']);
    check('split files: Main.json keeps the summary\'s lines, Wages.json the labour lines, and Main.json names no wage',
        mainJ._EmployeeWizard.crops.L100.costs.ledger.lines.length === r.kept.lines.length && wagesJ.cropCosts.L100.ledger.lines.length === r.labour.lines.length
        && !/\/h\b/.test(files['Main.json']) && !files['Main.json'].includes('$20.00'), Object.keys(wagesJ).join());

    // ---- Close-out puts it in the archive and drops the copies ----
    await openSitka(b, main, BASE);
    await loadSingle(b, main, asDb);
    const archive = await b.run(main, `window.confirm = () => true; window.alert = () => {}; LotActions.render(); document.getElementById('lotActionSelect').value = 'L100'; await LotActions.closeOut();
        const a = document.getElementById('archiveLink'); const text = a ? await (await fetch(a.href)).text() : null;
        a?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); document.getElementById('savePopup')?.classList.add('hidden'); return text;`, { user: true });
    await b.sleep(300);
    const arch = JSON.parse(archive || '{}');
    check('the archive holds the lot\'s ledger: every line, labour included', arch.ledger?.lines?.length === r.kept.lines.length + r.labour.lines.length && arch.ledger.savedAt === r.kept.savedAt,
        `${arch.ledger?.lines?.length} lines`);
    const inArch = sums(arch.ledger?.lines || []);
    check('…adding up to its frozen costs', Math.abs(inArch.power - r.costs.power.cost) < 0.01 && Math.abs(inArch.labour - r.cost) < 0.01, JSON.stringify(inArch));
    r = await b.run(main, `const ew = DB.data._EmployeeWizard; return { lot: !!DB.data.lots.L100, sum: !!ew.crops.L100, kept: !!ew.crops.L100?.costs?.ledger, labour: !!ew.cropCosts?.L100?.ledger, cost: ew.cropCosts?.L100?.cost };`);
    check('…and once closed out, the copies beside its summary go (the summary and its frozen costs stay)', !r.lot && r.sum && !r.kept && !r.labour && r.cost > 0, JSON.stringify(r));

    await leave(b, main);
    return results;
}
