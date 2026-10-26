// Cost per gram audit, 2026-10-26 — price by date (group D): every cost at the figure in force on its day, on
// cost-per-gram.test.mjs's example (L100: clone room D0–D9, veg D10–D19, Grow 1 D20–D40, flip D30, harvest D40 with
// Alex, Blair and Casey 10 h each at $20 / $21 / $22; grow log D30–D39: 100 L water, 10 mL Activator, 20 mL Core a day).
// A change asks "Applies from" (today by default, never later): the days before keep the old figure.
import { today, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';
import { costDb } from './cost-per-gram.test.mjs';

export const title = 'cost per gram audit: price by date — wages, prices, rent and rates by the day';
const D = n => today(-120 + n);
const near = (a, b, eps = 1e-6) => a != null && Math.abs(a - b) < eps;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    const measure = async (db, code) => {
        await openSitka(b, main, BASE);
        await loadSingle(b, main, db);
        const ew = await openTool(b, main, 'EmployeeWizard');
        const r = await b.run(ew, `const M = rptModel(); const c = M.crops.find(x => x.lotId === 'L100'); const k = rptCropInputCost(c, M); ${code}`);
        await leave(b, ew); await b.send('browsingContext.close', { context: ew });
        return r;
    };
    const span = (from, to, monthly) => { let t = 0; for (let n = from; n <= to; n++) { const [y, m] = D(n).split('-').map(Number); t += monthly / new Date(y, m, 0).getDate(); } return t; };

    // ---- The engine: each figure on its day ----
    const db = costDb();
    db._EmployeeWizard.wageHistory = { Alex: [{ from: '', wage: 20 }, { from: D(40), wage: 30 }] };   // Alex: $30 from harvest day
    db._EmployeeWizard.employees.Alex.wage = 30;
    db._CropLabourWizard.inputs.inC.priceHistory = [{ from: '', price: 40 }, { from: D(35), price: 60 }];   // Core: $60/L from D35
    db._CropLabourWizard.inputs.inC.price = 60;
    db._CropLabourWizard.inputs.inB.priceHistory = [{ from: '', price: 3 }, { from: D(0), price: 4 }];      // coco blocks: $4 from D0
    db._CropLabourWizard.inputs.inB.price = 4;
    db._CropLabourWizard.inputs.inP.priceHistory = [{ from: '', price: 0.25 }, { from: D(5), price: 0.5 }];  // peat pucks: $0.50 from D5
    db._CropLabourWizard.inputs.inP.price = 0.5;
    Object.assign(db._EmployeeWizard.costs, { kWhRate: 0.2, kWhRateHistory: [{ from: '', rate: 0.1 }, { from: D(30), rate: 0.2 }],   // $0.20/kWh from D30
        waterPer1000L: 5, waterPer1000LHistory: [{ from: '', rate: 2.5 }, { from: D(35), rate: 5 }] });                                // water $5 from D35
    db.buildings.B1.monthlyPropertyCost = 6000;
    db.buildings.B1.propertyCostHistory = [{ from: '', cost: 3000 }, { from: D(20), cost: 6000 }];   // rent $6,000 a month from D20
    let r = await measure(db, `return { labour: rptCropCost(c).cost, power: k.power.cost, kWh: k.power.kWh, water: k.water.cost, fert: k.fert, sup: k.supplies.items, prop: k.property.cost };`);
    check('labour: Alex\'s 10 h on harvest day at his new $30 (from that day) + Blair $210 + Casey $220 = $730', near(r.labour, 730), r.labour);
    // kWh a day: clone 54 (D0–9), veg 126 (D10–19), Grow 1 396 (D20–29), 156 at 50 % in bloom (D30–39), 276 on D40 = 7,596
    check('electricity: 5,760 kWh before D30 at $0.10 + 1,836 kWh from D30 at $0.20 = $943.20', near(r.kWh, 7596) && near(r.power, 943.2), `${r.kWh} kWh · $${r.power}`);
    check('water: 500 L before D35 at $2.50 + 500 L from D35 at $5 = $3.75', near(r.water, 3.75), r.water);
    check('fertilizer: Core 100 mL at $40 + 100 mL at $60 = $10, Activator $5', near(r.fert.byProduct.Core.cost, 10) && near(r.fert.cost, 15), JSON.stringify(r.fert.byProduct));
    const puck = r.sup.find(x => x.name === 'Peat puck'), coco = r.sup.find(x => x.name === 'Coco block');
    check('supplies at their price on the day the lot started (D0): peat pucks still $0.25 ($25), coco blocks $4 ($24)', near(puck.cost, 25) && near(coco.cost, 24), JSON.stringify(r.sup));
    check('property: D0–D19 at $3,000 a month + D20–D40 at $6,000', near(r.prop, span(0, 19, 3000) + span(20, 40, 6000)), r.prop);
    const noHist = costDb();
    r = await measure(noHist, `return { labour: rptCropCost(c).cost, power: k.power.cost, water: k.water.cost, fert: k.fert.cost };`);
    check('with no history, every figure is the one set (as before: $630, $759.60, $2.50, $13)', near(r.labour, 630) && near(r.power, 759.6) && near(r.water, 2.5) && near(r.fert, 13), JSON.stringify(r));

    // ---- Changing a wage asks which day it applies from ----
    await openSitka(b, main, BASE);
    await loadSingle(b, main, costDb());
    let ew = await openTool(b, main, 'EmployeeWizard');
    const setWage = async (v, day, ok = true) => {
        await b.run(ew, `selectEmployee('Alex'); document.getElementById('empWageInput').value = ${JSON.stringify(v)}; document.getElementById('saveEmpBtn').click();`, { user: true });
        await b.waitFor(ew, `return !!document.querySelector('.applies-overlay');`);
        const asked = await b.run(ew, `return { title: document.querySelector('.applies-title').textContent, day: document.querySelector('.applies-date').value, max: document.querySelector('.applies-date').max };`);
        await b.run(ew, `document.querySelector('.applies-date').value = ${JSON.stringify(day)}; document.querySelector('[data-act="${ok ? 'ok' : 'cancel'}"]').click();`, { user: true });
        await b.sleep(300);
        return asked;
    };
    let asked = await setWage('25', D(40), false);
    check('a changed wage asks which day it applies from (today, and never later)', /Alex's wage: \$20\/h → \$25\/h/.test(asked.title) && asked.day === today() && asked.max === today(), JSON.stringify(asked));
    check('…Cancel saves nothing', (await b.run(main, `return DB.data._EmployeeWizard.employees.Alex.wage;`)) === 20);
    await b.run(ew, `EMP.selectedName = null;`);
    await setWage('25', D(40));
    const hist = await b.run(main, `return { wage: DB.data._EmployeeWizard.employees.Alex.wage, h: DB.data._EmployeeWizard.wageHistory?.Alex };`);
    check('…Save keeps the history: $20 from the start, $25 from harvest day', hist.wage === 25 && JSON.stringify(hist.h) === JSON.stringify([{ from: '', wage: 20 }, { from: D(40), wage: 25 }]), JSON.stringify(hist));
    const cost = await b.run(ew, `const M = rptModel(); return rptCropCost(M.crops.find(x => x.lotId === 'L100')).cost;`);
    check('…and the harvest is priced at it: 10 h × $25 + $210 + $220 = $680', near(cost, 680), cost);
    check('the employee editor shows the wage history', /\$20\/h from the start · \$25\/h from/.test(await b.run(ew, `selectEmployee('Blair'); selectEmployee('Alex'); return document.getElementById('empWageHistory').textContent;`)));
    // Power & Rates: the electricity rate
    await b.run(ew, `document.getElementById('tabPower').click();`, { user: true });
    await b.run(ew, `const i = document.getElementById('pwRate'); i.value = '0.2'; i.dispatchEvent(new Event('change'));`, { user: true });
    await b.waitFor(ew, `return !!document.querySelector('.applies-overlay');`);
    await b.run(ew, `document.querySelector('.applies-date').value = '${D(30)}'; document.querySelector('[data-act="ok"]').click();`, { user: true });
    await b.sleep(300);
    const rate = await b.run(main, `return DB.data._EmployeeWizard.costs;`);
    check('a changed electricity rate keeps its history ($0.10 from the start, $0.20 from D30)', rate.kWhRate === 0.2 && JSON.stringify(rate.kWhRateHistory) === JSON.stringify([{ from: '', rate: 0.1 }, { from: D(30), rate: 0.2 }]), JSON.stringify(rate));
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });

    // CropLabourWizard: a changed price
    const clw = await openTool(b, main, 'CropLabourWizard');
    // (the price list is shared by every recipe: edit it from a copy of the built-in, which passes the recipe checks)
    await b.run(clw, `openRecipeManager(); showRecipeEditor({ ...cloneRecipeData(BUILTIN_RECIPE), id: 'rcpT', name: 'Test copy' }); document.querySelector('.editor-tab[data-tab="inputs"]').click();`, { user: true });
    await b.run(clw, `const tr = document.querySelector('#inputCatalogBody tr[data-id="inC"]'); tr.querySelector('.in-price').value = '60'; tr.querySelector('.in-price').dispatchEvent(new Event('change', { bubbles: true }));
        document.getElementById('recipeEditorSaveBtn').click();`, { user: true });
    await b.waitFor(clw, `return !!document.querySelector('.applies-overlay');`);
    const priceAsk = await b.run(clw, `return document.querySelector('.applies-title').textContent;`);
    await b.run(clw, `document.querySelector('.applies-date').value = '${D(35)}'; document.querySelector('[data-act="ok"]').click();`, { user: true });
    await b.sleep(400);
    const core = await b.run(main, `return DB.data._CropLabourWizard.inputs.inC;`);
    check('a changed price asks which day (Core: $40.00 → $60.00) and keeps the history', /Core: \$40\.00 → \$60\.00/.test(priceAsk) && core.price === 60 &&
        JSON.stringify(core.priceHistory) === JSON.stringify([{ from: '', price: 40 }, { from: D(35), price: 60 }]), JSON.stringify({ priceAsk, core }));
    await leave(b, clw); await b.send('browsingContext.close', { context: clw });

    // SitkaTools: a changed property cost (the 1st of this month by default)
    await b.run(main, `DB.data.buildings.B1.monthlyPropertyCost = 3000; BuildingManager.renderBuildingList();
        const inp = document.querySelector('.building-property-cost[data-building-id="B1"]'); inp.value = '6000'; inp.dispatchEvent(new Event('change'));`, { user: true });
    await b.waitFor(main, `return !!document.getElementById('appliesFromOverlay');`);
    const rentAsk = await b.run(main, `return document.getElementById('appliesFromDate').value;`);
    const first = (() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1); })();
    check('a changed property cost asks which day, the 1st of this month by default', rentAsk === `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`, rentAsk);
    await b.run(main, `document.getElementById('appliesFromDate').value = '${D(20)}'; document.querySelector('#appliesFromOverlay [data-act="ok"]').click();`, { user: true });
    await b.sleep(200);
    const bld = await b.run(main, `return DB.data.buildings.B1;`);
    check('…and keeps the history ($3,000 from the start, $6,000 from D20)', bld.monthlyPropertyCost === 6000 && JSON.stringify(bld.propertyCostHistory) === JSON.stringify([{ from: '', cost: 3000 }, { from: D(20), cost: 6000 }]), JSON.stringify(bld));
    // Split files: the wage history is money — it goes in Wages.json, never Main.json
    const parts = await b.run(main, `const p = DbSplit.split(DB.data); return { wages: !!p['Wages.json'].wageHistory?.Alex, main: !!p['Main.json']._EmployeeWizard?.wageHistory };`);
    check('split files: the wage history is saved in Wages.json, not Main.json', parts.wages && !parts.main, JSON.stringify(parts));

    await leave(b, main);
    return results;
}
