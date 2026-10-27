// The three built-in recipes (Sitka Standard, 9-week bloom): 20-day veg with Saturday cuts (the default), 19-day with Sunday
// cuts, 18-day with Monday cuts. Every room harvests on a Friday, the next lot transplants the Monday after (the day after
// Tank & Irrigation Clean) and flips on the Friday, a new lot every 70 days.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool } from './lib/helpers.mjs';

export const title = 'built-in recipes: three Sitka Standard recipes, harvest Friday, transplant Monday, every 70 days';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekday = s => { const [y, m, d] = s.split('-').map(Number); return DAY[new Date(y, m - 1, d, 12).getDay()]; };
const daysBetween = (a, b) => { const p = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((p(b) - p(a)) / 86400000); };

function db() {
    const d = fixtureDb();
    for (const [id, created] of [['L300', '2026-10-21'], ['L400', '2026-10-20']]) {
        d.lots[id] = { name: id, strain: 'Test Kush', stage: 'clone', createdDate: created, closedDate: null, type: 'new-lot', startPlantCount: 100,
            cloningRoom: 'Clone 1', vegRoom: null, destRoom: 'Grow 1', dryRoom: null, trimRoom: null, currentRoom: 'Clone 1', plantCount: 100 };
        d.rooms.R1G1.assignedLots.push(id);
    }
    return d;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db());
    const clw = await openTool(b, main, 'CropLabourWizard');
    const pickLot = id => b.run(clw, `const l = document.getElementById('activeLot'); l.value = '${id}'; l.dispatchEvent(new Event('change'));`);

    // ---- Where they show ----
    await pickLot('L300');
    const sel = await b.run(clw, `const o = s => [...document.getElementById(s).options].map(x => [x.value, x.textContent]);
        return { form: o('recipeSelect'), formValue: document.getElementById('recipeSelect').value, proj: o('projectionRecipeSelect'), projValue: document.getElementById('projectionRecipeSelect').value };`);
    check('the Task Recipe dropdown lists the three built-ins first, the 20-day Saturday-cut recipe on top',
        JSON.stringify(sel.form.slice(0, 3)) === JSON.stringify([['sitka-9week', 'Sitka Standard: 20-day veg, Saturday cuts (built-in)'],
            ['sitka-9week-19veg', 'Sitka Standard: 19-day veg, Sunday cuts (built-in)'], ['sitka-9week-18veg', 'Sitka Standard: 18-day veg, Monday cuts (built-in)']]), JSON.stringify(sel.form));
    check('…and a lot with no schedule starts on the default', sel.formValue === 'sitka-9week', sel.formValue);
    check('the projection recipe dropdown offers all three, the default picked', sel.projValue === 'sitka-9week' && sel.proj.filter(x => x[1].endsWith('(built-in)')).length === 3, JSON.stringify(sel.proj));
    await b.run(clw, `openRecipeManager();`, { user: true });
    const rows = await b.run(clw, `return [...document.querySelectorAll('#recipeList .recipe-row')].map(r => ({ name: r.querySelector('.recipe-row-name').textContent, btns: [...r.querySelectorAll('.recipe-actions button')].map(x => x.textContent) }));`);
    const builtinRows = rows.filter(r => r.name.includes('built-in'));
    check('the Recipe Manager shows three built-ins, each with only Duplicate, Export and Print', builtinRows.length === 3 && builtinRows.every(r => r.btns.join() === '⧉ Duplicate,⬇️ Export,🖨️ Print'), JSON.stringify(rows));
    await b.run(clw, `closeRecipeManager();`);

    // ---- The room turnaround each one gives ----
    const turn = await b.run(clw, `return BUILTIN_RECIPES.map(r => { const t = recipeTurnaround(r); return [r.id, t.cutBefore, t.plantAfter, t.transplantAfter, t.spare, t.cycle]; });`);
    check('clones cut 27 / 26 / 25 days before harvest, planted 13 / 12 / 11 before, transplanted 3 days after, the day after Tank & Irrigation Clean, every 70 days',
        JSON.stringify(turn) === JSON.stringify([['sitka-9week', 27, -13, 3, 0, 70], ['sitka-9week-19veg', 26, -12, 3, 0, 70], ['sitka-9week-18veg', 25, -11, 3, 0, 70]]), JSON.stringify(turn));
    const same = await b.run(clw, `const [a, ...rest] = BUILTIN_RECIPES; const differ = new Set();
        for (const r of rest) r.tasks.forEach((t, i) => { const s = a.tasks[i]; if (t.taskType !== s.taskType || t.name !== s.name || t.reference !== s.reference) differ.add('shape:' + t.taskType); else if (t.defaultOffset !== s.defaultOffset) differ.add(t.taskType); });
        return { n: BUILTIN_RECIPES.map(r => r.tasks.length), differ: [...differ].sort(), valid: BUILTIN_RECIPES.map(r => validateRecipe(r).length) };`);
    check('all three have the same 32 tasks and pass validation; only the transplant-, flip- and clone-cut days differ',
        same.n.join() === '32,32,32' && same.valid.join() === '0,0,0' && same.differ.join() === 'clone_cut,deploy_ipm,flip,hydrate_coco_blocks,ipm_spray_veg_second,layout_coco_blocks,prune,transplant,undercanopy_lights,veg_room_clean', JSON.stringify(same));

    // ---- Generate with the default, clones cut on a Saturday ----
    const gen = async (lot, recipeId, day0) => {
        await pickLot(lot);
        await b.run(clw, `const r = document.getElementById('recipeSelect'); r.value = '${recipeId}'; r.dispatchEvent(new Event('change'));
            document.getElementById('plantingDate').value = '${day0}'; refreshPreview();`);
        await b.run(clw, `window.confirm = () => true; document.getElementById('generateBtn').click();`, { user: true });
        await b.sleep(200);
        const evs = await b.run(main, `return DB.data.calendarEvents.filter(e => e.lotId === '${lot}').map(e => [e.taskType, e.date, e.endDate || null]);`);
        return { on: Object.fromEntries(evs.map(e => [e[0], e[1]])), end: Object.fromEntries(evs.map(e => [e[0], e[2]])), cfg: await b.run(main, `return DB.data.lots['${lot}']._tool_CropLabourWizard;`) };
    };
    const days = (on, types) => types.map(t => `${t} ${on[t] ? weekday(on[t]) : '—'}`).join(', ');
    const want = (types, d) => types.map(t => `${t} ${d}`).join(', ');
    const a = await gen('L300', 'sitka-9week', '2026-10-24');
    check('the default saves its id on the lot', a.cfg?.recipeId === 'sitka-9week', JSON.stringify(a.cfg));
    const plan = [[['clone_cut_prep', 'planting'], 'Sat'], [['layout_coco_blocks', 'hydrate_coco_blocks', 'undercanopy_lights'], 'Sun'], [['transplant'], 'Mon'],
        [['veg_room_clean', 'deploy_ipm'], 'Tue'], [['prune', 'flip', 'harvest'], 'Fri'], [['room_clean'], 'Sat'], [['tank_irrigation_clean'], 'Sun'], [['clone_cut'], 'Sat'],
        [['tote_prep'], 'Thu'], [['bucking', 'lab_sample', 'trim_room_prep'], 'Wed'], [['trim'], 'Thu'], [['weigh_ship'], 'Fri']];
    for (const [types, d] of plan) check(`20-day veg, cut Saturday: ${types.join(', ')} on ${d}`, days(a.on, types) === want(types, d), days(a.on, types));
    check('…planting Day 0 + 14, transplant planting + 16, flip + 20, harvest 9 weeks after flip',
        daysBetween('2026-10-24', a.on.planting) === 14 && daysBetween(a.on.planting, a.on.transplant) === 16 && daysBetween(a.on.planting, a.on.flip) === 20 && daysBetween(a.on.flip, a.on.harvest) === 63, JSON.stringify(a.on));
    check('…totes prepared 6 days after harvest, in case the crop dries early', daysBetween(a.on.harvest, a.on.tote_prep) === 6, JSON.stringify([a.on.harvest, a.on.tote_prep]));
    check('…12 days drying: Bucking 12 days after harvest, Trim from day 13 (7 days), Weigh & Ship 21 days after harvest',
        daysBetween(a.on.harvest, a.on.bucking) === 12 && daysBetween(a.on.harvest, a.on.trim) === 13 && daysBetween(a.on.trim, a.end.trim) === 6 && daysBetween(a.on.harvest, a.on.weigh_ship) === 21, JSON.stringify([a.on.harvest, a.on.bucking, a.on.trim, a.end.trim, a.on.weigh_ship]));
    const pick = (l, t) => [daysBetween(l.on.flip, l.on[t]), l.end[t] && daysBetween(l.on.flip, l.end[t]), weekday(l.on[t]), l.end[t] && weekday(l.end[t])].join(' ');
    check('…leaf picks, two days each: early on bloom days 17–18 (Mon–Tue), late on days 40–41 (Wed–Thu), flip day = day 0',
        pick(a, 'leafpick_early') === '17 18 Mon Tue' && pick(a, 'leafpick_late') === '40 41 Wed Thu', `${pick(a, 'leafpick_early')} | ${pick(a, 'leafpick_late')}`);
    check('…the off-by-default IPM sprays aren\'t generated', !a.on.ipm_spray_veg_second && !a.on.ipm_spray_flower_start, JSON.stringify(Object.keys(a.on)));
    // The next lot: Day 0 = this lot's clone cut, transplanted planting + 16 later
    const nextTransplant = daysBetween(a.on.harvest, a.on.clone_cut) + 14 + 16;
    check('…the next lot (cut on the clone-cut day) transplants 3 days after this harvest, the day after Tank & Irrigation Clean',
        nextTransplant === 3 && daysBetween(a.on.tank_irrigation_clean, a.on.harvest) === -2, `${nextTransplant}`);

    // ---- The 19-day recipe, clones cut on a Sunday ----
    const c = await gen('L400', 'sitka-9week-19veg', '2026-10-25');
    check('the 19-day recipe saves its own id on the lot', c.cfg?.recipeId === 'sitka-9week-19veg', JSON.stringify(c.cfg));
    const plan19 = [[['clone_cut_prep', 'planting', 'clone_cut'], 'Sun'], [['layout_coco_blocks', 'hydrate_coco_blocks', 'undercanopy_lights'], 'Sun'], [['transplant'], 'Mon'],
        [['veg_room_clean', 'deploy_ipm'], 'Tue'], [['prune', 'flip', 'harvest'], 'Fri']];
    for (const [types, d] of plan19) check(`19-day veg, cut Sunday: ${types.join(', ')} on ${d}`, days(c.on, types) === want(types, d), days(c.on, types));
    check('…the same leaf-pick days as the default', pick(c, 'leafpick_early') === '17 18 Mon Tue' && pick(c, 'leafpick_late') === '40 41 Wed Thu', `${pick(c, 'leafpick_early')} | ${pick(c, 'leafpick_late')}`);
    check('…the same harvest and transplant days as the default lot cut the day before', c.on.harvest === a.on.harvest && c.on.transplant === a.on.transplant, `${c.on.harvest} ${a.on.harvest}`);
    await pickLot('L300');
    check('picking the first lot again shows its recipe', await b.run(clw, `return document.getElementById('recipeSelect').value;`) === 'sitka-9week');

    // ---- Project Crop from the newest lot (L300, the default): 5 lots, each Friday harvest followed by a Monday transplant ----
    await b.run(clw, `window.__asked = []; window.confirm = m => { window.__asked.push(m); return true; }; generateProjectionsForRoom('R1G1');`);
    await b.sleep(200);
    const proj = await b.run(main, `const by = {}; for (const e of DB.data.calendarEvents.filter(e => e.sourceTool === 'CropProjection' && e.roomId === 'R1G1')) (by[e.lotId] ||= {})[e.taskType] = e.date; return by;`);
    const asked = await b.run(clw, `return window.__asked;`);
    const ids = Object.keys(proj).sort();
    const chain = [a.on, ...ids.map(id => proj[id])];
    const gaps = chain.slice(1).map((l, i) => daysBetween(chain[i].harvest, l.harvest));
    const moveIn = chain.slice(1).map((l, i) => daysBetween(chain[i].harvest, l.transplant));
    check('Project Crop: 5 lots, harvests 70 days apart, every one on a Friday', ids.length === 5 && gaps.every(g => g === 70) && chain.every(l => weekday(l.harvest) === 'Fri'), JSON.stringify({ ids, gaps }));
    check('…each moves in the Monday 3 days after the previous harvest, with nothing pushed back', moveIn.every(g => g === 3) && chain.every(l => weekday(l.transplant) === 'Mon') && asked.length === 0, JSON.stringify({ moveIn, asked }));

    // ---- An exported built-in, imported again, comes back as a copy ----
    const exported = await b.run(clw, `return JSON.stringify(BUILTIN_RECIPES[2]);`);
    await b.run(clw, `const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(exported)}], 'recipe-sitka-9week-18veg.json', { type: 'application/json' }));
        const inp = document.getElementById('recipeImportInput'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));`);
    await b.sleep(400);
    const imp = await b.run(main, `return Object.values(DB.data._CropLabourWizard.recipes || {}).map(r => [r.id, r.name]);`);
    const toast = await b.run(clw, `return document.getElementById('toast')?.textContent || document.querySelector('.toast')?.textContent || '';`);
    check('importing an exported built-in saves it under a new id, so the built-in doesn\'t hide it',
        imp.length === 1 && imp[0][0] !== 'sitka-9week-18veg' && imp[0][1] === 'Sitka Standard: 18-day veg, Monday cuts' && toast.includes('copy of the built-in'), JSON.stringify(imp) + ' ' + toast);
    check('…and the built-in is still the built-in', await b.run(clw, `return getRecipeById('sitka-9week-18veg') === BUILTIN_RECIPES[2] && [...document.getElementById('recipeSelect').options].filter(o => o.textContent.startsWith('Sitka Standard: 18-day')).length === 2;`));

    return results;
}
