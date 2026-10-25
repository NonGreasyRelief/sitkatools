// "Day N of the plant's life" in CropLabourWizard (the clone-cut day is day 1; the life ends with the harvest's last day,
// and work after it is "day N after harvest"), in the recipe editor's Day column and the preview, and 🖨️ Print recipe.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool } from './lib/helpers.mjs';

export const title = 'recipe days: day N of the plant\'s life / after harvest, in the editor and preview; printing a recipe';

function db() {
    const d = fixtureDb();
    d.lots.L300 = { name: 'L300', strain: 'Test Kush', stage: 'clone', createdDate: '2026-10-21', closedDate: null, type: 'new-lot', startPlantCount: 100,
        cloningRoom: 'Clone 1', vegRoom: null, destRoom: 'Grow 1', dryRoom: null, trimRoom: null, currentRoom: 'Clone 1', plantCount: 100 };
    d.rooms.R1G1.assignedLots.push('L300');
    return d;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db());
    const clw = await openTool(b, main, 'CropLabourWizard');

    // ---- Recipe editor: the Day column ----
    const editorDays = () => b.run(clw, `return Object.fromEntries([...document.querySelectorAll('#recipeTaskBody tr')].map(tr => [tr.querySelector('input.t-type').value,
        [...tr.querySelectorAll('td.t-life span')].map(s => s.textContent).join(' ')]));`);
    await b.run(clw, `openRecipeManager(); duplicateRecipe(BUILTIN_RECIPE);`, { user: true });
    let ed = await editorDays();
    const want = { clone_cut_prep: "day 1 of the plant's life", planting: "day 15 of the plant's life", transplant: "day 31 of the plant's life",
        ipm_spray_veg_second: "day 32 of the plant's life", flip: "day 35 of the plant's life", leafpick_early: "days 52–53 of the plant's life",
        clone_cut: "day 71 of the plant's life", leafpick_late: "days 75–76 of the plant's life", harvest: "day 98 of the plant's life",
        room_clean: 'day 1 after harvest', tank_irrigation_clean: 'day 2 after harvest', trim: 'days 11–17 after harvest', weigh_ship: 'day 19 after harvest' };
    for (const [tt, w] of Object.entries(want)) check(`editor, default recipe: ${tt} on ${w}`, ed[tt] === w, ed[tt]);
    // Typing a new flip day moves everything after it, as you type
    await b.run(clw, `const tr = [...document.querySelectorAll('#recipeTaskBody tr')].find(r => r.querySelector('input.t-type').value === 'flip');
        const inp = tr.querySelector('input.t-offset'); inp.value = '21'; inp.dispatchEvent(new Event('input', { bubbles: true }));`);
    ed = await editorDays();
    check('typing flip +21 moves flip to day 36, the early leaf pick to 53–54 and harvest to 98 → 99; after harvest stays put',
        ed.flip === "day 36 of the plant's life" && ed.leafpick_early === "days 53–54 of the plant's life" && ed.harvest === "day 99 of the plant's life" && ed.room_clean === 'day 1 after harvest', JSON.stringify(ed));
    await b.run(clw, `document.getElementById('recipeEditorCancelBtn').click();`, { user: true });
    // A mother recipe: the life ends at Retire Mothers
    await b.run(clw, `document.getElementById('recipeNewVegBtn').click();`, { user: true });
    ed = await editorDays();
    check('a mother recipe: Prune Mothers from day 43, the replacement cut on day 167, Retire Mothers on day 195 of the plant\'s life',
        ed.mother_prune === "day 43 of the plant's life" && ed.clone_cut === "day 167 of the plant's life" && ed.retire === "day 195 of the plant's life", JSON.stringify(ed));
    await b.run(clw, `document.getElementById('recipeEditorCancelBtn').click(); closeRecipeManager();`, { user: true });

    // ---- Preview: the lot's own dates ----
    await b.run(clw, `const l = document.getElementById('activeLot'); l.value = 'L300'; l.dispatchEvent(new Event('change'));
        document.getElementById('plantingDate').value = '2026-10-24'; refreshPreview();`);
    const preview = () => b.run(clw, `const out = {}; taskOffsets.forEach((e, i) => { const row = document.querySelectorAll('#previewTaskList .preview-task-item')[i];
        out[e.def.taskType] = row?.querySelector('.preview-task-life')?.textContent; }); return { out, label: document.getElementById('anchorDateLabel').textContent };`);
    let pv = await preview();
    check('preview: the date reads "Cloning Date (day 1)"', pv.label === 'Cloning Date (day 1)', pv.label);
    check('preview: early leaf pick on days 52–53 of the plant\'s life, harvest on day 98, Grow-Room Clean on day 1 after harvest, Weigh & Ship day 19 after',
        pv.out.leafpick_early === "days 52–53 of the plant's life" && pv.out.harvest === "day 98 of the plant's life" && pv.out.room_clean === 'day 1 after harvest' && pv.out.weigh_ship === 'day 19 after harvest', JSON.stringify(pv.out));
    check('…a switched-off task still says where it would land (second veg spray, day 32)', pv.out.ipm_spray_veg_second === "day 32 of the plant's life", pv.out.ipm_spray_veg_second);
    await b.run(clw, `document.getElementById('harvestMultiCheck').click();`, { user: true });
    pv = await preview();
    check('a two-day harvest: days 98–99 of the plant\'s life; after harvest counts from its last day', pv.out.harvest === "days 98–99 of the plant's life" && pv.out.room_clean === 'day 1 after harvest', JSON.stringify([pv.out.harvest, pv.out.room_clean]));
    await b.run(clw, `const i = taskOffsets.findIndex(e => e.def.taskType === 'clone_cut_prep'); document.getElementById('check_' + i).click();`, { user: true });
    pv = await preview();
    check('clones off: "Planting Date (day 1)", and planting is day 1 of the plant\'s life', pv.label === 'Planting Date (day 1)' && pv.out.planting === "day 1 of the plant's life", JSON.stringify([pv.label, pv.out.planting]));

    // ---- 🖨️ Print recipe ----
    const printed = async fn => {
        const before = new Set((await b.contexts()).flatMap(c => [c.context, ...(c.children || []).map(x => x.context)]));
        await b.run(clw, fn, { user: true });
        await b.sleep(600);
        const pr = (await b.contexts()).find(c => !before.has(c.context));
        if (!pr) return null;
        const got = await b.run(pr.context, `const heads = [...document.querySelectorAll('table')[0].querySelectorAll('thead th')].map(th => th.textContent);
            const rows = [...document.querySelectorAll('table')[0].querySelectorAll('tbody tr')].map(tr => Object.fromEntries([...tr.cells].map((td, i) => [heads[i], td.innerText.replace(/\\s+/g, ' ').trim()])));
            return { heads, title: document.title, h1: document.querySelector('h1')?.textContent, facts: [...document.querySelectorAll('ul.facts li')].map(li => li.textContent), rows,
                btn: document.getElementById('printBtn')?.textContent, supplies: document.querySelectorAll('table')[1] ? [...document.querySelectorAll('table')[1].querySelectorAll('tbody tr')].map(tr => tr.innerText.replace(/\\s+/g, ' ').trim()) : [] };`);
        await b.send('browsingContext.close', { context: pr.context });
        return got;
    };
    await b.run(clw, `openRecipeManager();`, { user: true });
    const p = await printed(`[...document.querySelectorAll('#recipeList .recipe-row')].find(r => r.textContent.includes('20-day veg')).querySelector('.recipe-actions button:last-child').click();`);
    check('🖨️ Print on a recipe row opens a print window with a Print / Save as PDF button', p?.h1?.includes('Sitka Standard: 20-day veg, Saturday cuts') && p.btn === '🖨️ Print / Save as PDF', JSON.stringify(p && { h1: p.h1, btn: p.btn }));
    const facts = (p?.facts || []).join(' | ');
    check('…saying veg 20 / bloom 63 days, the plants live 98 days, the work after harvest runs to day 19, a new lot every 70 days',
        facts.includes('Veg 20 days') && facts.includes('bloom 63 days') && facts.includes('The plants live 98 days') && facts.includes('day 19 after harvest') && facts.includes('A new lot every 70 days'), facts);
    const row = name => p?.rows?.find(r => r.Task.includes(name)) || {};
    check('…every task in order, with when, its day, how long it runs and whether it\'s optional (no Repeats or Labour columns: no task has them)',
        p?.rows?.length === 32 && p.heads.join() === '#,Task,When,Day,Runs,Optional' && row('Harvest').When === '+63 days after Flip to Flower' && row('Harvest').Day === "day 98 of the plant's life"
        && row('Early Flower Leaf Pick').Day === "days 52–53 of the plant's life" && row('Early Flower Leaf Pick').Runs === '2 days'
        && row('Weigh Final').Day === 'day 19 after harvest' && row('Second veg IPM').Optional === 'yes · off by default' && row('Cutting Clones').When === 'On Cloning',
        JSON.stringify([row('Harvest'), row('Early Flower Leaf Pick'), row('Weigh Final'), row('Second veg IPM'), row('Cutting Clones')]));
    // A recipe with supplies prints them
    const p2 = await printed(`DB.data._CropLabourWizard.recipes.sup1 = Object.assign(cloneRecipeData(BUILTIN_RECIPE), { id: 'sup1', name: 'With supplies',
        inputs: [{ name: 'Coco block', unit: 'block', qty: 1, per: 'plant', at: 'transplant' }, { name: 'Trellis', unit: 'ft', qty: 120, per: 'crop' }] });
        renderRecipeList(); [...document.querySelectorAll('#recipeList .recipe-row')].find(r => r.textContent.includes('With supplies')).querySelector('.recipe-actions button[title="Print this recipe"]').click();`);
    check('…and a recipe\'s supplies, with quantity and per crop / per plant at a task', JSON.stringify(p2?.supplies) === JSON.stringify(['Coco block 1 block per plant at 🪴 Transplanting to Flower Room', 'Trellis 120 ft per crop']), JSON.stringify(p2?.supplies));

    // A mother recipe: its life ends at Retire Mothers, and its repeats get a column
    const p3 = await printed(`printRecipe(Object.assign(cloneRecipeData(VEG_STARTER_RECIPE), { id: 'mom1', name: 'Mothers 6 months' }));`);
    const f3 = (p3?.facts || []).join(' | '), prune = p3?.rows?.find(r => r.Task.includes('Prune Mothers')) || {};
    check('printing a mother recipe: the plants live 195 days to Retire Mothers, the replacement cut 28 days before; Prune Mothers every 14 days from day 43',
        f3.includes('the plants live 195 days') && f3.includes('Retire Mothers (day 195)') && f3.includes('28 days before the mothers retire') && p3.heads.includes('Repeats')
        && prune.Repeats === 'every 14 days' && prune.Day === "day 43 of the plant's life", JSON.stringify({ f3, prune }));

    return results;
}
