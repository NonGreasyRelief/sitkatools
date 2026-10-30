// The built-in bloom recipe: the agreed Sitka Standard (user decision 2026-10-30; it replaced the 20-, 19- and 18-day-veg
// built-ins): 20-day veg, clones cut on a Saturday, every room harvesting on a Friday, the next lot transplanting the Monday after
// (the day after Tank & Irrigation Clean) and flipping on the Friday, a new lot every 70 days; two one-day early leaf picks
// (bloom days 13 and 22) and the team's labour estimates. Plus the built-in 🌿 mother recipe (the user's own, 2026-10-27):
// mothers retired 110 days after planting, every task once, the replacement cut off by default.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool } from './lib/helpers.mjs';

export const title = 'built-in recipes: the agreed Sitka Standard (harvest Friday, transplant Monday, every 70 days, two early leaf picks, labour); the Sitka Default mother recipe';

const AGREED = 'Sitka Standard: 20-day veg, Saturday Cuts Weekend Leaf Pick';
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
    // A Mother room with a mother lot in it, for the built-in mother recipe
    d.rooms.R1MO = { name: 'Mother 1', description: null, createdDate: '2026-01-01', assignedLots: ['M500'], isFlowering: false, buildingId: 'B1', designation: 'Mother' };
    d.buildings.B1.assignedRooms.push('R1MO');
    d.lots.M500 = { name: 'M500', strain: 'Test Kush', stage: 'mother', createdDate: '2026-10-19', closedDate: null, type: 'new-lot', startPlantCount: 12,
        cloningRoom: 'Clone 1', vegRoom: null, destRoom: 'Mother 1', dryRoom: null, trimRoom: null, currentRoom: 'Clone 1', plantCount: 12 };
    return d;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db());
    const clw = await openTool(b, main, 'CropLabourWizard');
    const pickLot = id => b.run(clw, `const l = document.getElementById('activeLot'); l.value = '${id}'; l.dispatchEvent(new Event('change'));`);

    // ---- Where it shows ----
    await pickLot('L300');
    const sel = await b.run(clw, `const o = s => [...document.getElementById(s).options].map(x => [x.value, x.textContent]);
        return { form: o('recipeSelect'), formValue: document.getElementById('recipeSelect').value, proj: o('projectionRecipeSelect'), projValue: document.getElementById('projectionRecipeSelect').value };`);
    check('the Task Recipe dropdown lists the agreed recipe first, the only bloom built-in, under the old default\'s id',
        JSON.stringify(sel.form[0]) === JSON.stringify(['sitka-9week', `${AGREED} (built-in)`]) && !sel.form.some(x => /19veg|18veg/.test(x[0])), JSON.stringify(sel.form));
    check('…then the built-in mother recipe, marked 🌿', JSON.stringify(sel.form[1]) === JSON.stringify(['sitka-mother', '🌿 Sitka Default mother recipe (built-in)']), JSON.stringify(sel.form));
    check('…and a lot with no schedule starts on it', sel.formValue === 'sitka-9week', sel.formValue);
    check('the projection recipe dropdown offers it (not the mother recipe), picked',
        sel.projValue === 'sitka-9week' && sel.proj.filter(x => x[1].endsWith('(built-in)')).length === 1 && !sel.proj.some(x => x[0] === 'sitka-mother'), JSON.stringify(sel.proj));
    await b.run(clw, `openRecipeManager();`, { user: true });
    const rows = await b.run(clw, `return [...document.querySelectorAll('#recipeList .recipe-row')].map(r => ({ name: r.querySelector('.recipe-row-name').textContent, btns: [...r.querySelectorAll('.recipe-actions button')].map(x => x.textContent) }));`);
    const builtinRows = rows.filter(r => r.name.includes('built-in'));
    check('the Recipe Manager shows two built-ins (it and the mother recipe), each with only Duplicate, Export and Print', builtinRows.length === 2 && builtinRows.some(r => r.name.includes(AGREED)) && builtinRows.some(r => r.name.includes('Sitka Default mother recipe')) && builtinRows.every(r => r.btns.join() === '⧉ Duplicate,⬇️ Export,🖨️ Print'), JSON.stringify(rows));
    await b.run(clw, `closeRecipeManager();`);

    // ---- The recipe: its room turnaround, its 33 tasks, the two early leaf picks and the labour ----
    const turn = await b.run(clw, `return BUILTIN_RECIPES.filter(r => !isVegRecipe(r)).map(r => { const t = recipeTurnaround(r); return [r.id, t.cutBefore, t.plantAfter, t.transplantAfter, t.spare, t.cycle]; });`);
    check('clones cut 27 days before harvest, planted 13 before, transplanted 3 days after, the day after Tank & Irrigation Clean, every 70 days',
        JSON.stringify(turn) === JSON.stringify([['sitka-9week', 27, -13, 3, 0, 70]]), JSON.stringify(turn));
    const r = await b.run(clw, `const r = getRecipeById('sitka-9week'); const t = tt => r.tasks.find(x => x.taskType === tt);
        return { n: r.tasks.length, valid: validateRecipe(r).length, old: !!t('leafpick_early'), p1: t('leafpick_early1'), p2: t('leafpick_early2'), late: t('leafpick_late'),
            est: r.tasks.filter(x => x.minutes).map(x => x.taskType + ' ' + x.staff + '×' + x.minutes).join(', '), none: r.tasks.filter(x => !x.minutes).map(x => x.taskType).join() };`);
    check('33 tasks, valid; the one early leaf pick is now two one-day picks, flip + 13 and flip + 22; the late one flip + 40 for 2 days',
        r.n === 33 && r.valid === 0 && !r.old && r.p1?.reference === 'flip' && r.p1.defaultOffset === 13 && !r.p1.days && r.p2?.defaultOffset === 22 && !r.p2.days &&
        r.late?.defaultOffset === 40 && r.late.days === 2, JSON.stringify({ p1: r.p1, p2: r.p2, late: r.late }));
    check('…with the team\'s labour: leaf pick 1 4 people × 6 h, leaf pick 2 8 people × 8 h, and the rest from labourhours.json',
        r.est === 'clone_cut_prep 3×360, planting 2×120, clone_room_clean 2×60, topping 2×90, layout_coco_blocks 2×180, undercanopy_lights 2×240, transplant 4×300, ' +
            'veg_room_clean 2×90, deploy_ipm 3×90, prune 3×360, trellis_layout 2×240, leafpick_early1 4×360, leafpick_early2 8×480, leafpick_late 6×960, harvest 10×480, ' +
            'tank_irrigation_clean 1×240, tote_prep 2×120, bucking 3×480, trim_room_prep 1×60, trim 8×2400, machine_trim 1×240, dry_room_clean 2×120, weigh_ship 1×60' &&
        r.none === 'ipm_spray_veg_early,order_ipm,hydrate_coco_blocks,ipm_spray_veg_second,flip,ipm_spray_flower_start,ipm_spray_flower_week2,clone_cut,room_clean,lab_sample', JSON.stringify(r));

    // ---- Generate with it, clones cut on a Saturday ----
    const gen = async (lot, recipeId, day0) => {
        await pickLot(lot);
        await b.run(clw, `const r = document.getElementById('recipeSelect'); r.value = '${recipeId}'; r.dispatchEvent(new Event('change'));
            document.getElementById('plantingDate').value = '${day0}'; refreshPreview();`);
        await b.run(clw, `window.confirm = () => true; document.getElementById('generateBtn').click();`, { user: true });
        await b.sleep(200);
        const evs = await b.run(main, `return DB.data.calendarEvents.filter(e => e.lotId === '${lot}').map(e => [e.taskType, e.date, e.endDate || null, e.estStaff || null, e.estMinutes || null]);`);
        return { on: Object.fromEntries(evs.map(e => [e[0], e[1]])), end: Object.fromEntries(evs.map(e => [e[0], e[2]])), est: Object.fromEntries(evs.map(e => [e[0], e[3] && `${e[3]}×${e[4]}`])),
            cfg: await b.run(main, `return DB.data.lots['${lot}']._tool_CropLabourWizard;`) };
    };
    const days = (on, types) => types.map(t => `${t} ${on[t] ? weekday(on[t]) : '—'}`).join(', ');
    const want = (types, d) => types.map(t => `${t} ${d}`).join(', ');
    const a = await gen('L300', 'sitka-9week', '2026-10-24');
    check('it saves its id on the lot', a.cfg?.recipeId === 'sitka-9week', JSON.stringify(a.cfg));
    const plan = [[['clone_cut_prep', 'planting'], 'Sat'], [['layout_coco_blocks', 'hydrate_coco_blocks', 'undercanopy_lights'], 'Sun'], [['transplant'], 'Mon'],
        [['veg_room_clean', 'deploy_ipm'], 'Tue'], [['prune', 'flip', 'harvest'], 'Fri'], [['leafpick_early1'], 'Thu'], [['leafpick_early2'], 'Sat'], [['room_clean'], 'Sat'],
        [['tank_irrigation_clean'], 'Sun'], [['clone_cut'], 'Sat'], [['tote_prep'], 'Thu'], [['bucking', 'lab_sample', 'trim_room_prep'], 'Wed'], [['trim'], 'Thu'], [['weigh_ship'], 'Fri']];
    for (const [types, d] of plan) check(`20-day veg, cut Saturday: ${types.join(', ')} on ${d}`, days(a.on, types) === want(types, d), days(a.on, types));
    check('…planting Day 0 + 14, transplant planting + 16, flip + 20, harvest 9 weeks after flip',
        daysBetween('2026-10-24', a.on.planting) === 14 && daysBetween(a.on.planting, a.on.transplant) === 16 && daysBetween(a.on.planting, a.on.flip) === 20 && daysBetween(a.on.flip, a.on.harvest) === 63, JSON.stringify(a.on));
    check('…totes prepared 6 days after harvest, in case the crop dries early', daysBetween(a.on.harvest, a.on.tote_prep) === 6, JSON.stringify([a.on.harvest, a.on.tote_prep]));
    check('…12 days drying: Bucking 12 days after harvest, Trim from day 13 (7 days), Weigh & Ship 21 days after harvest',
        daysBetween(a.on.harvest, a.on.bucking) === 12 && daysBetween(a.on.harvest, a.on.trim) === 13 && daysBetween(a.on.trim, a.end.trim) === 6 && daysBetween(a.on.harvest, a.on.weigh_ship) === 21, JSON.stringify([a.on.harvest, a.on.bucking, a.on.trim, a.end.trim, a.on.weigh_ship]));
    const pick = (l, t) => [daysBetween(l.on.flip, l.on[t]), l.end[t] && daysBetween(l.on.flip, l.end[t]), weekday(l.on[t]), l.end[t] && weekday(l.end[t])].filter(x => x !== null).join(' ');
    check('…leaf picks, flip day = day 0: early 1 on bloom day 13 (Thu), early 2 on day 22 (Sat), one day each; late on days 40–41 (Wed–Thu)',
        pick(a, 'leafpick_early1') === '13 Thu' && pick(a, 'leafpick_early2') === '22 Sat' && pick(a, 'leafpick_late') === '40 41 Wed Thu' && !a.on.leafpick_early,
        `${pick(a, 'leafpick_early1')} | ${pick(a, 'leafpick_early2')} | ${pick(a, 'leafpick_late')}`);
    check('…each task carries its labour estimate (leaf pick 1: 4 × 360 min, leaf pick 2: 8 × 480, transplant 4 × 300)',
        a.est.leafpick_early1 === '4×360' && a.est.leafpick_early2 === '8×480' && a.est.transplant === '4×300' && !a.est.flip, JSON.stringify(a.est));
    check('…the off-by-default IPM sprays aren\'t generated', !a.on.ipm_spray_veg_second && !a.on.ipm_spray_flower_start, JSON.stringify(Object.keys(a.on)));
    // The next lot: Day 0 = this lot's clone cut, transplanted planting + 16 later
    const nextTransplant = daysBetween(a.on.harvest, a.on.clone_cut) + 14 + 16;
    check('…the next lot (cut on the clone-cut day) transplants 3 days after this harvest, the day after Tank & Irrigation Clean',
        nextTransplant === 3 && daysBetween(a.on.tank_irrigation_clean, a.on.harvest) === -2, `${nextTransplant}`);

    // ---- A lot scheduled with a removed built-in (the 19-day recipe) opens on the agreed recipe ----
    await b.run(main, `DB.data.lots.L400._tool_CropLabourWizard = { plantingDate: '2026-10-25', recipeId: 'sitka-9week-19veg', trimDays: 7, harvestMultiDay: false, harvestDays: 1 };`);
    await pickLot('L400');
    check('a lot scheduled with the removed 19-day built-in shows the agreed recipe (its fallback)', await b.run(clw, `return document.getElementById('recipeSelect').value + '|' + getRecipeById('sitka-9week-19veg').id;`) === 'sitka-9week|sitka-9week');
    await pickLot('L300');
    check('picking the first lot again shows its recipe', await b.run(clw, `return document.getElementById('recipeSelect').value;`) === 'sitka-9week');

    // ---- Project Crop from the newest lot (L300): 5 lots, each Friday harvest followed by a Monday transplant ----
    await b.run(main, `delete DB.data.lots.L400._tool_CropLabourWizard;`);
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
    const exported = await b.run(clw, `return JSON.stringify(BUILTIN_RECIPES[0]);`);
    await b.run(clw, `const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(exported)}], 'recipe-sitka-9week.json', { type: 'application/json' }));
        const inp = document.getElementById('recipeImportInput'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));`);
    await b.sleep(400);
    const imp = await b.run(main, `return Object.values(DB.data._CropLabourWizard.recipes || {}).map(r => [r.id, r.name]);`);
    const toast = await b.run(clw, `return document.getElementById('toast')?.textContent || document.querySelector('.toast')?.textContent || '';`);
    check('importing an exported built-in saves it under a new id, so the built-in doesn\'t hide it',
        imp.length === 1 && imp[0][0] !== 'sitka-9week' && imp[0][1] === AGREED && toast.includes('copy of the built-in'), JSON.stringify(imp) + ' ' + toast);
    check('…and the built-in is still the built-in', await b.run(clw, `return getRecipeById('sitka-9week') === BUILTIN_RECIPES[0] && [...document.getElementById('recipeSelect').options].filter(o => o.textContent.startsWith(${JSON.stringify(AGREED)})).length === 2;`));

    // ---- 🌿 The built-in mother recipe (the user's own, 2026-10-27) ----
    const mr = await b.run(clw, `const r = getRecipeById('sitka-mother'); return { builtin: isBuiltinRecipe(r), kind: r.kind, errs: validateRecipe(r),
        tasks: r.tasks.map(t => [t.taskType, t.emoji, t.reference, t.defaultOffset, t.every || 0]), cut: r.tasks.find(t => t.taskType === 'clone_cut') };`);
    check('the mother recipe is a valid built-in 🌿 vegetative recipe', mr.builtin && mr.kind === 'vegetative' && mr.errs.length === 0, JSON.stringify(mr));
    check('…with the user\'s 11 tasks in date order, each once, 🍃 and 🪣 for the leaf pick and up-pots',
        JSON.stringify(mr.tasks) === JSON.stringify([['clone_cut_prep', '✂️', 'cloning', 0, 0], ['planting', '🌱', 'cloning', 14, 0], ['clone_room_clean', '🧼', 'planting', 1, 0],
            ['transplant', '🪴', 'planting', 16, 0], ['mother_top', '✂️', 'planting', 21, 0], ['mother_pick1', '🌿', 'planting', 37, 0], ['mother_uppot1', '🪣', 'planting', 46, 0],
            ['mother_pick2', '🍃', 'planting', 56, 0], ['mother_uppot2', '🪣', 'planting', 75, 0], ['clone_cut', '🌿', 'retire', -27, 0], ['retire', '🍂', 'planting', 110, 0]]), JSON.stringify(mr.tasks));
    check('…the replacement cut (the next mothers\' Day 0, 27 days before retiring) can be switched on, and is off by default', mr.cut?.hasToggle === true && mr.cut.defaultEnabled === false, JSON.stringify(mr.cut));
    // 🌿 New Mother Recipe starts from it
    await b.run(clw, `openRecipeManager(); document.getElementById('recipeNewVegBtn').click();`, { user: true });
    const nm = await b.run(clw, `return { name: document.getElementById('recipeNameInput').value, id: editorRecipe.id, kind: editorRecipe.kind,
        types: [...document.querySelectorAll('#recipeTaskBody tr')].map(tr => tr.querySelector('input.t-type').value) };`);
    check('🌿 New Mother Recipe opens a copy of it, under a new id', nm.name === 'New Mother Recipe' && nm.id !== 'sitka-mother' && nm.kind === 'vegetative' &&
        nm.types.join() === mr.tasks.map(t => t[0]).join(), JSON.stringify(nm));
    await b.run(clw, `document.getElementById('recipeFooterBackBtn').click(); closeRecipeManager();`, { user: true });
    // A DB whose task-type list still has the placeholder 📋 for these types (a user recipe saved them so): Generate puts the recipe's in
    await b.run(clw, `for (const t of ['mother_pick2', 'mother_uppot1', 'mother_uppot2']) DB.data._CropLabourWizard.taskTypes[t] = { name: t, emoji: '📋', roomPhase: null };`);
    await pickLot('M500');
    await b.run(clw, `const r = document.getElementById('recipeSelect'); r.value = 'sitka-mother'; r.dispatchEvent(new Event('change'));
        document.getElementById('plantingDate').value = '2026-10-24'; refreshPreview(); window.confirm = () => true; document.getElementById('generateBtn').click();`, { user: true });
    await b.sleep(200);
    const mev = await b.run(main, `return DB.data.calendarEvents.filter(e => e.lotId === 'M500').map(e => [e.taskType, e.date, e.repeat || 0]);`);
    const mcfg = await b.run(main, `return DB.data.lots.M500._tool_CropLabourWizard;`);
    const from = (t) => mev.filter(e => e[0] === t).map(e => daysBetween('2026-11-07', e[1]));
    check('generated for a mother lot: saved as a mother lot with its recipe', mcfg?.recipeId === 'sitka-mother' && mcfg.kind === 'vegetative', JSON.stringify(mcfg));
    check('…planting Day 0 + 14, clone room cleaned the day after, transplanted planting + 16, mothers retired planting + 110',
        mev.find(e => e[0] === 'planting')?.[1] === '2026-11-07' && from('clone_room_clean').join() === '1' && from('transplant').join() === '16' && from('retire').join() === '110', JSON.stringify(mev));
    check('…each task once on its day: topped planting + 21, leaves picked + 37 and + 56, up-pots + 46 and + 75; no repeats',
        !mev.some(e => e[2]) && from('mother_top').join() === '21' && from('mother_pick1').join() === '37' && from('mother_uppot1').join() === '46' && from('mother_uppot2').join() === '75' && from('mother_pick2').join() === '56',
        JSON.stringify({ top: from('mother_top'), pick1: from('mother_pick1') }));
    check('…the replacement cut is off, so not generated; no flip, harvest or trim', !mev.some(e => ['flip', 'harvest', 'trim', 'clone_cut'].includes(e[0])), JSON.stringify(mev));
    const reg = await b.run(main, `const t = DB.data._CropLabourWizard.taskTypes; return ['mother_pick2', 'mother_uppot1', 'mother_uppot2', 'mother_top'].map(k => t[k]?.emoji);`);
    check('…and the task-type list has the recipe\'s emoji, so the calendar dots match the titles', reg.join() === '🍃,🪣,🪣,✂️', reg.join());
    check('Project Crop is offered for the Mother room', (await b.run(clw, `return resolveProjectionRoom('M500').disabledReason;`)) === null);
    // With the cut off, the next mothers start 27 days before the retire day (planting + 83)
    await b.run(clw, `window.confirm = () => true; generateProjectionsForRoom('R1MO');`);
    await b.sleep(200);
    const tba1 = await b.run(main, `return DB.data._CropLabourWizard.projectedLots['R1MO-TBA-01']?.config?.plantingDate || null;`);
    check('…with the cut off, the next mothers\' Day 0 is 27 days before Retire Mothers', tba1 && daysBetween('2026-11-07', tba1) === 83, String(tba1));
    // Switched on and moved to line up with a flowering lot's cut (3 days later): generated there, and the next mothers follow it
    await pickLot('M500');
    await b.run(clw, `const i = taskOffsets.findIndex(e => e.def.taskType === 'clone_cut'); document.getElementById('check_' + i).click();`, { user: true });
    await b.run(clw, `const e = taskOffsets.find(e => e.def.taskType === 'clone_cut'); e.offset = -24; refreshPreview(); window.confirm = () => true; document.getElementById('generateBtn').click();`, { user: true });
    await b.sleep(200);
    const cutOn = await b.run(main, `return DB.data.calendarEvents.filter(e => e.lotId === 'M500' && e.taskType === 'clone_cut').map(e => e.date);`);
    check('…switched on and moved 3 days later, the cut is generated on its day (planting + 86)', cutOn.length === 1 && daysBetween('2026-11-07', cutOn[0]) === 86, JSON.stringify(cutOn));
    await b.run(clw, `window.confirm = () => true; generateProjectionsForRoom('R1MO');`);
    await b.sleep(200);
    const tba1b = await b.run(main, `return DB.data._CropLabourWizard.projectedLots['R1MO-TBA-01']?.config?.plantingDate || null;`);
    check('…and Project Crop starts the next mothers on it', tba1b === cutOn[0], `${tba1b} vs ${cutOn[0]}`);

    return results;
}
