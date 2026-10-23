// Supplies charged per plant at a recipe task: clone cubes at Cutting Clones, 4″ rockwool at Planting Clones (the
// up-pot), coco blocks at Transplanting. Each counts the lowest plant count the grow log recorded on that task's
// calendar day, so plants culled before it aren't charged; a lot without the task (bought clones: Cutting Clones off)
// isn't charged for it. Set up in CropLabourWizard's recipe editor, worked out in the Labour & Cost Wizard's Reports.
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';

export const title = 'supplies charged per plant at a recipe task';

const near = (a, b, eps = 1e-6) => a != null && Math.abs(a - b) < eps;

function taskDb() {
    const D = n => today(-120 + n), R = n => today(n);   // D: the older crops; R: from today (a crop still in veg)
    const ev = (id, lot, tt, date, more = {}) => ({ id, date, title: `T ${tt}`, sourceTool: 'CropLabourWizard', lotId: lot, taskType: tt, ...more });
    const events = [
        // L100: clones cut D0, up-potted D14, transplanted over D24–D25, harvested D50
        ev('a0', 'L100', 'clone_cut_prep', D(0)), ev('a1', 'L100', 'planting', D(14)), ev('a2', 'L100', 'transplant', D(24), { endDate: D(25) }), ev('a3', 'L100', 'flip', D(34)), ev('a4', 'L100', 'harvest', D(50)),
        // L200: bought clones (no Cutting Clones), planted D14, transplanted D24 (no count that day)
        ev('b1', 'L200', 'planting', D(14)), ev('b2', 'L200', 'transplant', D(24)), ev('b3', 'L200', 'flip', D(34)), ev('b4', 'L200', 'harvest', D(50)),
        // L300: a schedule but no grow log at all
        ev('c0', 'L300', 'clone_cut_prep', D(0)), ev('c1', 'L300', 'planting', D(14)), ev('c2', 'L300', 'transplant', D(24)), ev('c4', 'L300', 'harvest', D(50)),
        // L400: still in veg — transplant is ahead
        ev('d0', 'L400', 'clone_cut_prep', R(-20)), ev('d1', 'L400', 'planting', R(-6)), ev('d2', 'L400', 'transplant', R(4)), ev('d4', 'L400', 'harvest', R(40))
    ];
    const pg = (days, more = {}) => ({ phase: 'Vegetation', room: 'Veg 1', header: {}, days: Object.fromEntries(Object.entries(days).map(([d, n]) => [d, { pc01: String(n) }])), ...more });
    const db = fixtureDb();
    const lot = (id, n) => ({ name: id, strain: 'Test', createdDate: D(0), cloningRoom: 'Clone 1', vegRoom: 'Grow 1', destRoom: 'Grow 1', currentRoom: 'Grow 1', plantCount: n, _tool_CropLabourWizard: { recipeId: 'rcpT' } });
    db.lots = { L100: lot('L100', 470), L200: lot('L200', 290), L300: lot('L300', 100), L400: lot('L400', 170) };
    db.calendarEvents = events;
    db._CropLabourWizard = {
        inputs: { inK: { name: 'Clone cube', kind: 'supply', unit: 'cube', price: 0.1 }, inR: { name: 'Rockwool 4in', kind: 'supply', unit: 'block', price: 0.3 },
            inC: { name: 'Coco block', kind: 'supply', unit: 'block', price: 2 }, inT: { name: 'Trellis', kind: 'supply', unit: 'ft', price: 0.5 } },
        recipes: { rcpT: { id: 'rcpT', name: 'Test', version: 1, tasks: [{ taskType: 'clone_cut_prep', name: 'Cutting Clones', emoji: '✂️' },
            { taskType: 'planting', name: 'Planting Clones', emoji: '🌱' }, { taskType: 'transplant', name: 'Transplanting to Flower Room', emoji: '🪴' }], inputs: [
            { inputId: 'inK', name: 'Clone cube', unit: 'cube', qty: 1, per: 'plant', at: 'clone_cut_prep' },
            { inputId: 'inR', name: 'Rockwool 4in', unit: 'block', qty: 1, per: 'plant', at: 'planting' },
            { inputId: 'inC', name: 'Coco block', unit: 'block', qty: 1, per: 'plant', at: 'transplant' },
            { inputId: 'inT', name: 'Trellis', unit: 'ft', qty: 10, per: 'crop' }] } }
    };
    db._PaperWizard = {
        sheets: { growlog: { name: 'Grow log', cadence: 'daily-weekly', fields: [] } },
        wizards: { wz01: { sheetId: 'growlog', name: 'Grow', questions: [{ id: 'pc01', label: 'Plants', type: 'plant-count', options: [], rowScoped: true }] } },
        entries: {
            // D14 is on both pages (the up-pot culled 80: 600 on the old page, 520 on the new)
            L100: { growlog: { instances: { [D(0)]: pg({ [D(0)]: 600, [D(3)]: 600, [D(14)]: 600 }, { phaseChangeDate: D(14) }), [D(14)]: pg({ [D(14)]: 520, [D(20)]: 500, [D(25)]: 480, [D(30)]: 470 }) } } },
            L200: { growlog: { instances: { [D(14)]: pg({ [D(14)]: 300, [D(20)]: 290 }) } } },
            L400: { growlog: { instances: { [R(-20)]: pg({ [R(-20)]: 200, [R(-6)]: 180, [R(-1)]: 170 }) } } }
        }
    };
    return db;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);

    // ---- CropLabourWizard: the recipe editor offers "per plant at <task>" ----
    await loadSingle(b, main, fixtureDb());
    const clw = await openTool(b, main, 'CropLabourWizard');
    await b.run(clw, `openRecipeManager(); document.getElementById('recipeNewBtn').click();`, { user: true });
    await b.run(clw, `document.getElementById('recipeNameInput').value = 'Task Inputs'; document.querySelector('.editor-tab[data-tab="inputs"]').click();`, { user: true });
    for (const [name, unit, price] of [['Coco block', 'block', 2], ['Clone cube', 'cube', 0.1]]) {
        await b.run(clw, `document.getElementById('addInputBtn').click();`, { user: true });
        await b.run(clw, `const tr = [...document.querySelectorAll('#inputCatalogBody tr[data-id]')].pop();
            tr.querySelector('.in-name').value = ${JSON.stringify(name)}; tr.querySelector('.in-unit').value = ${JSON.stringify(unit)};
            tr.querySelector('.in-price').value = '${price}'; tr.querySelector('.in-price').dispatchEvent(new Event('change', { bubbles: true }));`);
    }
    for (const [name, per] of [['Coco block', 'plant@transplant'], ['Clone cube', 'plant@clone_cut_prep']]) {
        await b.run(clw, `document.getElementById('addRecipeInputBtn').click();`, { user: true });
        await b.run(clw, `const tr = [...document.querySelectorAll('#recipeInputsBody tr[data-i]')].pop();
            tr.querySelector('.ri-input').value = [...tr.querySelector('.ri-input').options].find(o => o.textContent.startsWith(${JSON.stringify(name)})).value;
            tr.querySelector('.ri-qty').value = '1'; tr.querySelector('.ri-per').value = '${per}';
            tr.querySelector('.ri-per').dispatchEvent(new Event('change', { bubbles: true }));`);
    }
    const opts = await b.run(clw, `return [...document.querySelector('#recipeInputsBody tr[data-i="0"] .ri-per').options].map(o => o.textContent);`);
    check('Per offers per crop, per plant at the start, and per plant at each of the recipe\'s tasks', opts[0] === 'per crop' && opts[1] === 'per plant at the start'
        && opts.includes('per plant at ✂️ Cutting Clones') && opts.includes('per plant at 🌱 Planting Clones') && opts.includes('per plant at 🪴 Transplanting to Flower Room'), opts.slice(0, 6).join(' | '));
    const cost = await b.run(clw, `return document.querySelector('#recipeInputsBody tr[data-i="0"] .ri-cost').textContent;`);
    check('the row says what it costs and when', cost === '≈ $2.00 per plant at 🪴 Transplanting to Flower Room', cost);
    await b.run(clw, `document.getElementById('recipeEditorSaveBtn').click();`, { user: true });
    await b.sleep(300);
    const rec = await b.run(main, `return Object.values(DB.data._CropLabourWizard.recipes).find(r => r.name === 'Task Inputs');`);
    check('saved as per plant, at the task', JSON.stringify(rec?.inputs?.map(x => [x.name, x.per, x.at])) === JSON.stringify([['Coco block', 'plant', 'transplant'], ['Clone cube', 'plant', 'clone_cut_prep']]), JSON.stringify(rec?.inputs));
    const bad = await b.run(clw, `const r = JSON.parse(JSON.stringify(Object.values(DB.data._CropLabourWizard.recipes).find(r => r.name === 'Task Inputs')));
        r.inputs[0].at = 'no_such_task'; return validateRecipe(r).errors || validateRecipe(r);`);
    check('a recipe charging at a task it doesn\'t have is refused', [].concat(bad).some(e => String(e).includes('charged at task "no_such_task", which isn\'t in this recipe')), JSON.stringify(bad));
    await leave(b, clw); await b.send('browsingContext.close', { context: clw });

    // ---- Reports: the plants on each task's day ----
    await loadSingle(b, main, taskDb());
    const ew = await openTool(b, main, 'EmployeeWizard');
    const items = (lot) => b.run(ew, `const M = rptModel(), c = M.crops.find(c => c.lotId === '${lot}');
        return rptCropInputCost(c, M).supplies.items.map(x => ({ name: x.name, qty: x.qty, cost: x.cost, how: x.at?.how || null }));`);
    const by = (list, name) => list.find(x => x.name === name) || {};
    let l = await items('L100');
    check('cut clones: 600 clone cubes (the count on Cutting Clones day) = $60', by(l, 'Clone cube').qty === 600 && near(by(l, 'Clone cube').cost, 60), JSON.stringify(by(l, 'Clone cube')));
    check('the up-pot: 520 rockwool blocks (the lowest count that day, after culling 80) = $156', by(l, 'Rockwool 4in').qty === 520 && near(by(l, 'Rockwool 4in').cost, 156), JSON.stringify(by(l, 'Rockwool 4in')));
    check('transplant over two days: 480 coco blocks (the lowest count on those days) = $960', by(l, 'Coco block').qty === 480 && near(by(l, 'Coco block').cost, 960), JSON.stringify(by(l, 'Coco block')));
    check('a per-crop supply is unchanged: 10 ft of trellis = $5', by(l, 'Trellis').qty === 10 && near(by(l, 'Trellis').cost, 5), JSON.stringify(by(l, 'Trellis')));
    l = await items('L200');
    check('bought clones (no Cutting Clones): no clone cubes charged', by(l, 'Clone cube').qty === 0 && by(l, 'Clone cube').how === 'none', JSON.stringify(by(l, 'Clone cube')));
    check('no count on transplant day: the last count before it (290 coco blocks)', by(l, 'Coco block').qty === 290 && by(l, 'Coco block').how === 'before', JSON.stringify(by(l, 'Coco block')));
    l = await items('L300');
    check('no grow log at all: counted from the plants at the start (100), and said so', by(l, 'Coco block').qty === 100 && by(l, 'Coco block').how === 'start', JSON.stringify(by(l, 'Coco block')));
    l = await items('L400');
    check('a transplant still ahead: today\'s count (170), as an estimate', by(l, 'Coco block').qty === 170 && by(l, 'Coco block').how === 'estimate' && by(l, 'Rockwool 4in').qty === 180, JSON.stringify(l));

    // ---- The Costs page ----
    await b.run(ew, `document.getElementById('tabReports').click();`, { user: true });
    await b.run(ew, `const p = document.getElementById('rptPeriod'); p.value = '12m'; p.dispatchEvent(new Event('change'));`);
    await b.run(ew, `document.querySelector('#rptPages button[data-page="costs"]').click();`, { user: true });
    const page = await b.run(ew, `return document.getElementById('rptBody').innerText;`);
    check('"What did the crops use?" names the task each supply was counted at', page.includes('Coco block · at 🪴 Transplanting to Flower Room') && page.includes('Clone cube · at ✂️ Cutting Clones'), page.slice(page.lastIndexOf('What did the crops use?'), page.lastIndexOf('What did the crops use?') + 700));
    check('"What\'s missing" lists the crop counted from the start', page.includes('counted from the plants at the start') && page.includes('lot L300'), '');
    check('no NaN / undefined on the page', !/NaN|undefined|Infinity/.test(page));
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });
    await leave(b, main);
    return results;
}
