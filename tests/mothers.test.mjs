// 🌿 Mother crops: a vegetative recipe in CropLabourWizard (no flip, harvest or trim; mothers retired on a planned day;
// a replacement clone cut that starts the next mother lot; tasks that repeat every N days), generated for a mother lot
// whose destination room is the Mother room.
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';

export const title = 'mother crops: vegetative recipes, repeating tasks';

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export function addDaysIso(s, n) {
    const [y, m, d] = s.split('-').map(Number), dt = new Date(y, m - 1, d, 12);
    dt.setDate(dt.getDate() + n);
    return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

// The fixture with a veg room and a Mother room in Building 1, and a mother lot living in it
export function motherDb() {
    const db = fixtureDb();
    db.rooms.R1VG = { name: 'Veg 1', description: null, createdDate: '2026-01-01', assignedLots: [], isFlowering: false, buildingId: 'B1', designation: 'Vegetation' };
    db.rooms.R1MO = { name: 'Mother 1', description: null, createdDate: '2026-01-01', assignedLots: ['M100'], isFlowering: false, buildingId: 'B1', designation: 'Mother', lightCount: 4, lightWattage: 500 };
    db.buildings.B1.assignedRooms.push('R1VG', 'R1MO');
    db.lots.M100 = { name: 'M100', strain: 'Test Kush', stage: 'mother', createdDate: today(-60), closedDate: null, type: 'new-lot', startPlantCount: 12,
        cloningRoom: 'Clone 1', vegRoom: 'Veg 1', destRoom: 'Mother 1', dryRoom: null, trimRoom: null, currentRoom: 'Mother 1', plantCount: 12 };
    return db;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, motherDb());
    const clw = await openTool(b, main, 'CropLabourWizard');

    // ---- 🌿 New Mother Recipe: a vegetative starter ----
    await b.run(clw, `openRecipeManager(); document.getElementById('recipeNewVegBtn').click();`, { user: true });
    const ed = await b.run(clw, `return { kind: document.getElementById('recipeKindLabel').textContent, refs: [...document.querySelector('#recipeTaskBody select.t-ref').options].map(o => o.value),
        rows: [...document.querySelectorAll('#recipeTaskBody tr')].map(tr => [tr.querySelector('input.t-type').value, tr.querySelector('input.t-every').value, tr.querySelector('input.t-every').disabled]),
        box: document.getElementById('recipeTurnaround').textContent };`);
    check('🌿 New Mother Recipe opens a vegetative recipe: anchors cloning / planting / retire only', ed.kind.includes('Vegetative') && ed.refs.join() === 'cloning,planting,retire', JSON.stringify(ed.refs));
    check('…with Prune every 14 days and Top-dress every 28; anchors and clone cuts can\'t repeat',
        JSON.stringify(ed.rows.find(r => r[0] === 'mother_prune')) === '["mother_prune","14",false]' && ed.rows.find(r => r[0] === 'retire')[2] && ed.rows.find(r => r[0] === 'clone_cut')[2], JSON.stringify(ed.rows));
    check('…and says the mothers are retired 180 days after planting, the replacement cut 28 days before', ed.box.includes('180 days') && ed.box.includes('28 days'), ed.box);
    await b.run(clw, `document.getElementById('recipeNameInput').value = 'Mothers 6 months'; document.getElementById('recipeEditorSaveBtn').click();`, { user: true });
    const rid = await b.run(clw, `return Object.values(DB.data._CropLabourWizard.recipes).find(r => r.name === 'Mothers 6 months')?.id;`);
    const saved = await b.run(clw, `return DB.data._CropLabourWizard.recipes['${rid}'];`);
    check('saved as kind "vegetative", with its repeats', saved?.kind === 'vegetative' && saved.tasks.find(t => t.taskType === 'mother_prune')?.every === 14, JSON.stringify(saved?.tasks?.map(t => t.taskType + ':' + (t.every || ''))));
    check('it shows as 🌿 in the recipe list, and isn\'t offered for flowering-room projections', await b.run(clw, `return [...document.getElementById('recipeSelect').options].some(o => o.textContent === '🌿 Mothers 6 months')
        && ![...document.getElementById('projectionRecipeSelect').options].some(o => o.value === '${rid}');`));

    // ---- Validation ----
    const errs = await b.run(clw, `const r = JSON.parse(JSON.stringify(DB.data._CropLabourWizard.recipes['${rid}']));
        const flip = JSON.parse(JSON.stringify(r)); flip.tasks.push({ name: 'Flip', emoji: '🌸', taskType: 'flip', reference: 'planting', defaultOffset: 20 });
        const noRetire = JSON.parse(JSON.stringify(r)); noRetire.tasks = noRetire.tasks.filter(t => t.taskType !== 'retire' && t.taskType !== 'clone_cut');
        const badEvery = JSON.parse(JSON.stringify(r)); badEvery.tasks.find(t => t.taskType === 'planting').every = 7;
        const bloomRetire = JSON.parse(JSON.stringify(BUILTIN_RECIPE)); bloomRetire.tasks.push({ name: 'Retire', emoji: '🍂', taskType: 'retire', reference: 'planting', defaultOffset: 90 });
        return { ok: validateRecipe(r), flip: validateRecipe(flip).join(' | '), noRetire: validateRecipe(noRetire).join(' | '), badEvery: validateRecipe(badEvery).join(' | '), bloomRetire: validateRecipe(bloomRetire).join(' | ') };`);
    check('validation: the mother recipe passes; flip, a missing retire, a repeating planting and a bloom "retire" are refused',
        errs.ok.length === 0 && errs.flip.includes('no flip, harvest or trim') && errs.noRetire.includes('"retire"') && errs.badEvery.includes("can't repeat") && errs.bloomRetire.includes('vegetative recipe'), JSON.stringify(errs));

    // ---- Generate for the mother lot ----
    const D0 = today(-60);
    await b.run(clw, `closeRecipeManager(); const l = document.getElementById('activeLot'); l.value = 'M100'; l.dispatchEvent(new Event('change'));
        const r = document.getElementById('recipeSelect'); r.value = '${rid}'; r.dispatchEvent(new Event('change'));
        document.getElementById('plantingDate').value = '${D0}'; refreshPreview();`);
    const prev = await b.run(clw, `return document.getElementById('previewTaskList').innerText;`);
    const plant = addDaysIso(D0, 14), retire = addDaysIso(plant, 180), cut = addDaysIso(retire, -28);
    const prunes = []; for (let d = addDaysIso(plant, 28); d <= retire; d = addDaysIso(d, 14)) prunes.push(d);
    check('the preview shows each repeat\'s count and last date, and the next mothers', prev.includes(`↻ every 14 days · ${prunes.length}× to ${prunes[prunes.length - 1]}`) && prev.includes('Next mothers') && prev.includes(`Replacement clones cut ${cut}`), prev.slice(0, 600));
    await b.run(clw, `window.confirm = () => true; document.getElementById('generateBtn').click();`, { user: true });
    await b.sleep(200);
    const evs = await b.run(main, `return DB.data.calendarEvents.filter(e => e.lotId === 'M100').map(e => ({ t: e.taskType, d: e.date, r: e.repeat || 0, title: e.title }));`);
    const one = tt => evs.filter(e => e.t === tt);
    check('generated: planting Day 0 + 14, Retire Mothers 180 days later, the replacement cut 28 days before',
        one('planting')[0]?.d === plant && one('retire')[0]?.d === retire && one('clone_cut')[0]?.d === cut, JSON.stringify(evs.filter(e => ['planting', 'retire', 'clone_cut'].includes(e.t))));
    const pr = one('mother_prune');
    check('a task that repeats every 14 days: one event per repeat, numbered, up to the retire day',
        pr.length === prunes.length && pr.every((e, i) => e.d === prunes[i] && e.r === i + 1 && e.title.endsWith(`Prune Mothers (${i + 1}/${prunes.length})`)), JSON.stringify(pr.slice(0, 3)));
    check('no flip, harvest or trim on a mother lot', !evs.some(e => ['flip', 'harvest', 'trim'].includes(e.t)));
    check('rooms: before transplant in the veg room, from the transplant on in the Mother room',
        one('clone_room_clean')[0]?.title.includes('R1CL') && one('transplant')[0]?.title.includes('R1VG') === false && one('transplant')[0]?.title.includes('R1MO') && pr[0].title.includes('R1MO'), JSON.stringify(evs.map(e => e.title).slice(0, 6)));
    check('the lot\'s schedule says it is a mother lot', (await b.run(main, `return DB.lots.M100._tool_CropLabourWizard?.kind;`)) === 'vegetative');

    // ---- Regenerating keeps each repeat's hours ----
    await b.run(main, `const e = DB.data.calendarEvents.find(e => e.lotId === 'M100' && e.taskType === 'mother_prune' && e.repeat === 2);
        e.labour_map = { [e.date]: [{ id: 'le_testprune2', employee: 'Alex', hours: 1.5 }] }; e.completed = true; markUnsaved(); broadcastToSubtools();`);
    await b.waitFor(clw, `return DB.data.calendarEvents.some(e => e.lotId === 'M100' && e.repeat === 2 && e.completed);`);
    await b.run(clw, `const l = document.getElementById('activeLot'); l.dispatchEvent(new Event('change'));`);
    const restored = await b.run(clw, `return taskOffsets.find(e => e.def.taskType === 'mother_prune').offset;`);
    check('reopening the lot reads each task\'s offset from its first repeat', restored === 28, String(restored));
    await b.run(clw, `window.confirm = () => true; document.getElementById('generateBtn').click();`, { user: true });
    await b.sleep(200);
    const kept = await b.run(main, `return DB.data.calendarEvents.filter(e => e.lotId === 'M100' && e.taskType === 'mother_prune').map(e => [e.repeat, !!e.completed, e.labour_map ? 1 : 0]);`);
    check('regenerating keeps repeat 2\'s hours and completion on repeat 2 only', kept.length === prunes.length && JSON.stringify(kept[1]) === '[2,true,1]' && kept.filter(k => k[1]).length === 1, JSON.stringify(kept.slice(0, 3)));
    // A shorter life drops later repeats: work on them is asked about first
    await b.run(main, `const e = DB.data.calendarEvents.find(e => e.lotId === 'M100' && e.taskType === 'mother_prune' && e.repeat === ${prunes.length});
        e.completed = true; markUnsaved(); broadcastToSubtools();`);
    await b.waitFor(clw, `return DB.data.calendarEvents.some(e => e.lotId === 'M100' && e.repeat === ${prunes.length} && e.completed);`);
    await b.run(clw, `window.__asked = ''; window.confirm = m => { window.__asked = m; return false; };
        taskOffsets.find(e => e.def.taskType === 'retire').offset = 90; refreshPreview(); document.getElementById('generateBtn').click();`, { user: true });
    const asked = await b.run(clw, 'return window.__asked;');
    check('retiring the mothers sooner asks before dropping a later repeat that holds work', asked.includes('with recorded work will be removed') && asked.includes(`Prune Mothers (${prunes.length}/${prunes.length})`), asked.slice(0, 200));

    await leave(b, clw); await b.send('browsingContext.close', { context: clw });
    await leave(b, main);
    return results;
}
