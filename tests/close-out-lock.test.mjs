// Cost per gram audit, 2026-10-26 — costs locked at close-out (group E), on cost-per-gram.test.mjs's example (L100):
// - close-out is refused until the lot's crop summary is saved as the lot is now (a fingerprint of its lot record, tasks
//   and paperwork), its labour cost frozen with Wages.json and every hour priced, and — with power bills — a bill for
//   every day it used power;
// - once closed out, its costs are what its summary froze: a wage, price, rate or rent change doesn't move them, a part it
//   froze without stays missing, its summary can't be removed, and re-importing its archive only updates its plant history.
import { today, makeChecker, fresh, openSitka, loadSingle, splitFiles, openSplit, openTool, leave, saveSummaries } from './lib/helpers.mjs';
import { costDb } from './cost-per-gram.test.mjs';

export const title = 'cost per gram audit: close-out waits for an up-to-date summary, then the lot\'s costs are locked';
const D = n => today(-120 + n);

export function lockDb() {
    const db = costDb();
    db.lots.L100.plantCount = 0;   // no plants on record (it started with 100)
    db.lots.L100.startPlantCount = 100;
    const g = db._PaperWizard.entries.L100.growlog;
    g.paperBefore = D(30);         // its paperwork starts on D30 (no days missing)
    g.instances[D(30)].completedAt = new Date().toISOString();
    db.buildings.B1.monthlyPropertyCost = 3000;
    return db;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, lockDb());
    const blockers = () => b.run(main, `return closeOutBlockers('L100').join(' | ');`);

    let bl = await blockers();
    check('close-out is refused while the crop summary isn\'t saved', /Its crop summary isn't saved/.test(bl), bl);
    await saveSummaries(b, main, ['L100']);
    bl = await blockers();
    check('…and goes ahead once it is (saved as the lot is, with its labour cost)', bl === '', bl);
    let ew = await openTool(b, main, 'EmployeeWizard');
    const gap = await b.run(ew, `return { gap: rptCloseOutCostGap('L100'), setup: rptSetup(rptModel()) };`);
    check('the Labour & Cost Wizard says it\'s ready for close-out', gap.gap === '' && gap.setup.includes('🔒 ready for close-out'), gap.gap);
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });

    await b.run(main, `DB.data.calendarEvents.find(e => e.taskType === 'harvest').labour_map['${D(40)}'].push({ id: 'le_late000001', employee: 'Alex', hours: 1 }); markUnsaved();`);
    bl = await blockers();
    check('an hour logged after the summary was saved: refused until it\'s saved again', /changed since its crop summary was saved/.test(bl), bl);
    await saveSummaries(b, main, ['L100']);
    check('…saved again: it goes ahead', (await blockers()) === '');

    await b.run(main, `delete DB.data._EmployeeWizard.employees.Blair.wage; markUnsaved();`);
    await saveSummaries(b, main, ['L100']);
    bl = await blockers();
    check('hours with no wage (Blair\'s 10 h): refused until the wage is set and the summary saved again', /10 h of its labour have no wage/.test(bl), bl);
    await b.run(main, `DB.data._EmployeeWizard.employees.Blair.wage = 21; markUnsaved();`);
    await saveSummaries(b, main, ['L100']);

    await b.run(main, `DB.data._EmployeeWizard.costs.electricity = 'bills'; markUnsaved();`);
    await saveSummaries(b, main, ['L100']);
    bl = await blockers();
    check('power bills with days no bill covers: refused until the bills are in', /No power bill covers \d+ of its days/.test(bl), bl);
    await b.run(main, `DB.data._EmployeeWizard.costs.electricity = 'estimate'; markUnsaved();`);
    await saveSummaries(b, main, ['L100']);
    check('…estimated electricity: it goes ahead', (await blockers()) === '');

    // Split files: the labour cost is in Wages.json, so close-out needs it open
    const asDb = await b.run(main, `return JSON.parse(JSON.stringify(DB.data));`);
    const files = await splitFiles(b, main, BASE, asDb);
    await openSplit(b, main, BASE, 'office', Object.fromEntries(Object.entries(files).filter(([n]) => n !== 'Wages.json')));
    bl = await blockers();
    check('split files without Wages.json: refused (its labour cost is kept there)', /Open Wages\.json/.test(bl), bl);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, asDb);

    // ---- Close it out ----
    const archive = await b.run(main, `window.confirm = () => true; window.alert = () => {}; LotActions.render(); document.getElementById('lotActionSelect').value = 'L100'; await LotActions.closeOut();
        const a = document.getElementById('archiveLink'); const text = a ? await (await fetch(a.href)).text() : null;
        a?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); document.getElementById('savePopup')?.classList.add('hidden'); return text;`, { user: true });
    await b.sleep(300);
    check('closed out: the lot is gone, its summary stays', !!archive && await b.run(main, `return !DB.data.lots.L100 && !!DB.data._EmployeeWizard.crops.L100;`));
    const partsOf = async () => {
        const ew2 = await openTool(b, main, 'EmployeeWizard', { ready: 'return typeof DB !== "undefined" && !!DB.data?._EmployeeWizard?.crops?.L100;' });
        const r = await b.run(ew2, `const M = rptModel(), c = M.crops.find(x => x.lotId === 'L100'); return { closed: !!c?.closed, parts: rptCropCostParts(c, M), setup: rptSetup(M) };`);
        await leave(b, ew2); await b.send('browsingContext.close', { context: ew2 });
        return r;
    };
    const before = await partsOf();
    check('its costs are the frozen ones (labour $650 with Alex\'s late hour, power $759.60, water $2.50, fertilizer $13, supplies $43, property)',
        before.closed && Math.abs(before.parts.labour - 650) < 1e-6 && before.parts.power === 759.6 && before.parts.water === 2.5 && before.parts.fert === 13 && before.parts.supplies === 43 && before.parts.property > 0, JSON.stringify(before.parts));
    check('…its summary is locked: no remove button', before.setup.includes('🔒 Closed out') && !before.setup.includes('data-unsave'), '');
    // Everything changes afterwards: wages, prices, rates, rent
    await b.run(main, `const ew = DB.data._EmployeeWizard; ew.employees.Alex.wage = 50; ew.costs.kWhRate = 1; ew.costs.waterPer1000L = 100;
        DB.data._CropLabourWizard.inputs.inC.price = 100; DB.data.buildings.B1.monthlyPropertyCost = 9999; markUnsaved();`);
    const after = await partsOf();
    check('wage, price, rate and rent changes after close-out don\'t move its costs', JSON.stringify(after.parts) === JSON.stringify(before.parts), JSON.stringify(after.parts));
    // A part it froze without stays missing (never re-priced from today's figures)
    await b.run(main, `delete DB.data._EmployeeWizard.crops.L100.costs.property; delete DB.data._EmployeeWizard.cropCosts.L100; markUnsaved();`);
    const missing = await partsOf();
    check('a part its summary froze without stays missing: no labour cost frozen, no property — not today\'s', missing.parts.labour == null && missing.parts.property == null && missing.parts.power === before.parts.power, JSON.stringify(missing.parts));

    // ---- Re-importing its archive keeps the frozen costs and updates only its plant history ----
    const arch = JSON.parse(archive);
    arch.lot.startPlantCount = 120;
    ew = await openTool(b, main, 'EmployeeWizard', { ready: 'return typeof DB !== "undefined" && !!DB.data?._EmployeeWizard?.crops?.L100;' });
    const imp = await b.run(ew, `window.confirm = () => true; const was = JSON.stringify(DB.data._EmployeeWizard.crops.L100.costs);
        await rptImportArchives([new File([${JSON.stringify(JSON.stringify(arch))}], 'Lot-L100.json')]);
        const s = DB.data._EmployeeWizard.crops.L100; return { same: JSON.stringify(s.costs) === was, start: s.ctls?.start };`);
    check('re-importing its archive keeps its frozen costs, and updates its plant history (started with 120)', imp.same && imp.start === 120, JSON.stringify(imp));
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });

    await leave(b, main);
    return results;
}
