// 🌿 Mother crops: a vegetative recipe in CropLabourWizard (no flip, harvest or trim; mothers retired on a planned day;
// a replacement clone cut that starts the next mother lot; tasks that repeat every N days), generated for a mother lot
// whose destination room is the Mother room.
import { today, fixtureDb, withFloorManager, makeChecker, fresh, openSitka, loadSingle, openTool, dwBuilding, dwUnlock, leave } from './lib/helpers.mjs';

export const title = 'mother crops: vegetative recipes, repeating tasks, room chores only while a lot is in the room';

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

    // ---- DailyWizard: a room chore shows only while a lot is in the room ----
    const dwDb = withFloorManager(motherDb());
    const chore = (code, name, roomId) => ({ code, emoji: '🚪', name, minutes: 15, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], monthDays: [], steps: [], ...(roomId ? { roomId } : {}) });
    dwDb._DailyWizard.buildings.B1.tasks.push(chore('mom1', 'Water mothers', 'R1MO'), chore('cln1', 'Check clone domes', 'R1CL'), chore('veg1', 'Water veg room', 'R1VG'), chore('gr01', 'Water Grow 1', 'R1G1'));
    const m2 = await fresh(b);
    await openSitka(b, m2, BASE);
    await loadSingle(b, m2, dwDb);
    const dw = await openTool(b, m2, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    const listed = () => b.run(dw, `return [...document.querySelectorAll('#listContainer .task-row')].map(r => r.textContent).join(' | ');`);
    let txt = await listed();
    check('rooms holding a lot keep their chores (the Mother room, Grow 1); whole-building chores stay', txt.includes('Water mothers') && txt.includes('Water Grow 1') && txt.includes('Water plants'), txt.slice(0, 300));
    check('the empty clone and veg rooms\' chores are hidden', !txt.includes('Check clone domes') && !txt.includes('Water veg room'), txt.slice(0, 300));
    const tog = await b.run(dw, `return document.querySelector('.empty-room-toggle')?.textContent || '';`);
    check('…with a button to show them', tog === '🚪 Show 2 chores for empty rooms', tog);
    const status = await b.run(dw, `return document.getElementById('statusText').textContent;`);
    await b.run(dw, `document.querySelector('.empty-room-toggle').click();`, { user: true });
    txt = await listed();
    check('the button shows them, dimmed, and hides them again', txt.includes('Check clone domes') && (await b.run(dw, `return document.querySelectorAll('.task-row.empty-room').length;`)) === 2
        && (await b.run(dw, `return document.querySelector('.empty-room-toggle').textContent;`)) === 'Hide the chores for empty rooms (2)', txt.slice(0, 300));
    await b.run(dw, `document.querySelector('.empty-room-toggle').click();`, { user: true });
    // A lot moving into the clone room brings its chore back
    await b.run(m2, `DB.data.lots.L200.currentRoom = 'Clone 1'; markUnsaved(); broadcastToSubtools();`);
    await b.waitFor(dw, `return DB.lots.L200.currentRoom === 'Clone 1';`);
    txt = await listed();
    check('a lot moving into the room brings its chore back', txt.includes('Check clone domes') && !txt.includes('Water veg room'), txt.slice(0, 300));
    // A chore already done today stays, even when its room empties
    await b.run(dw, `const row = [...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Check clone domes')); row.querySelector('input[type=checkbox]').click();`, { user: true });
    await b.run(m2, `DB.data.lots.L200.currentRoom = 'Grow A'; markUnsaved(); broadcastToSubtools();`);
    await b.waitFor(dw, `return DB.lots.L200.currentRoom === 'Grow A';`);
    txt = await listed();
    check('a chore ticked today stays even after its room empties', txt.includes('Check clone domes'), txt.slice(0, 300));
    check('the status bar counts only the chores shown', /\d+\/\d+/.test(status) && !status.includes('/7'), status);
    await dwUnlock(b, dw);
    txt = await listed();
    check('edit mode lists every chore, so the floor manager can still edit them', txt.includes('Water veg room') && !(await b.run(dw, `return !!document.querySelector('.empty-room-toggle');`)), txt.slice(0, 300));
    await leave(b, dw); await b.send('browsingContext.close', { context: dw });
    await leave(b, m2);

    // ---- Reports: cost per clone, and a bloom lot cut on site pays for its clones once ----
    const T = today();
    const rdb = motherDb();
    const ev = (id, lot, tt, date, more = {}) => ({ id, date, title: `T ${tt}`, sourceTool: 'CropLabourWizard', lotId: lot, taskType: tt, ...more });
    rdb.calendarEvents = [
        ev('m0', 'M100', 'clone_cut_prep', today(-100)), ev('m1', 'M100', 'planting', today(-86)), ev('m2', 'M100', 'transplant', today(-72)), ev('m9', 'M100', 'retire', today(94)),
        ev('m3', 'M100', 'mother_prune', today(-30), { repeat: 1, labour_map: { [today(-30)]: [{ id: 'le_mprune1', employee: 'Alex', hours: 2 }] } }),
        ev('k0', 'K1', 'clone_cut_prep', today(-40), { labour_map: { [today(-40)]: [{ id: 'le_kcut1', employee: 'Blair', hours: 3 }] } }), ev('k1', 'K1', 'planting', today(-26))
    ];
    rdb.lots.M100._tool_CropLabourWizard = { plantingDate: today(-100), recipeId: 'rvM', kind: 'vegetative' };
    rdb.lots.K1 = { name: 'K1', strain: 'Test Kush', stage: 'veg', createdDate: today(-40), closedDate: null, type: 'sub-lot', parentLotId: 'M100', startPlantCount: 100, plantCount: 100,
        cloningRoom: 'Clone 1', vegRoom: 'Veg 1', destRoom: 'Grow 1', currentRoom: 'Veg 1', _tool_CropLabourWizard: { plantingDate: today(-40), recipeId: 'rcpK' } };
    rdb.lots.K2 = { name: 'K2', strain: 'Test Kush', stage: 'cloning', createdDate: today(-5), closedDate: null, type: 'sub-lot', parentLotId: 'M100', startPlantCount: 50, plantCount: 50,
        cloningRoom: 'Clone 1', currentRoom: 'Clone 1' };
    rdb._CropLabourWizard = {
        inputs: { inK: { name: 'Clone cube', kind: 'supply', unit: 'cube', price: 0.1 } },
        recipes: {
            rvM: { id: 'rvM', name: 'Mothers', kind: 'vegetative', version: 1, tasks: [{ taskType: 'planting', name: 'Planting', emoji: '🌱', reference: 'cloning', defaultOffset: 14 }, { taskType: 'retire', name: 'Retire Mothers', emoji: '🍂', reference: 'planting', defaultOffset: 180 }] },
            rcpK: { id: 'rcpK', name: 'Bloom', version: 1, tasks: [{ taskType: 'clone_cut_prep', name: 'Cutting Clones', emoji: '✂️' }, { taskType: 'planting', name: 'Planting', emoji: '🌱' }],
                inputs: [{ inputId: 'inK', name: 'Clone cube', unit: 'cube', qty: 1, per: 'plant', at: 'clone_cut_prep' }] }
        }
    };
    rdb._EmployeeWizard.costs = { electricity: 'estimate', kWhRate: 0.1, bills: [] };
    const m3 = await fresh(b);
    await openSitka(b, m3, BASE);
    await loadSingle(b, m3, rdb);
    const ew = await openTool(b, m3, 'EmployeeWizard');
    const near = (a, x, eps = 0.005) => a != null && Math.abs(a - x) < eps;
    const R = await b.run(ew, `const M = rptModel(), CM = rptCloneModel(M), pr = CM.priceOf('M100'), k1 = M.crops.find(c => c.lotId === 'K1'), mom = M.crops.find(c => c.lotId === 'M100');
        return { mother: !!mom.mother, stays: rptCropRoomDays(mom).map(st => [st.roomId, st.phase, st.from, st.to]), clones: pr.clones, kids: pr.kids.map(k => [k.lotId, k.n]),
            own: pr.own, cut: pr.cut, per: pr.perClone, charge: rptCloneCharge(k1, M), parts: rptCropCostParts(k1, M), k1raw: rptCropCost(k1).cost };`);
    check('a mother lot is a crop living in its Mother room from the transplant to its retire day', R.mother && R.stays.some(st => st[0] === 'R1MO' && st[1] === 'mother' && st[2] === today(-72) && st[3] === today(94)), JSON.stringify(R.stays));
    check('its clones: the lots cut from it, scheduled or not (100 + 50)', R.clones === 150 && JSON.stringify(R.kids) === JSON.stringify([['K1', 100], ['K2', 50]]), JSON.stringify(R.kids));
    // Its Mother room's lights (2 kW × 18 h × $0.10 = $3.60 a day): 73 days while it's in there, and the 28 days before,
    // when the room held no tracked mothers — its lights still run and the building's crops (only M100 then) share them
    check('its own costs: 2 h at $20, and its Mother room\'s lights over 101 days ($363.60)', near(R.own.labour, 40) && near(R.own.power, 363.6), JSON.stringify(R.own));
    check('the cutting of K1 goes into it: 3 h at $21 and 100 clone cubes at $0.10', near(R.cut.labour, 63) && near(R.cut.supplies, 10) && R.cut.hours === 3, JSON.stringify(R.cut));
    check('cost per clone: labour $103 ÷ 150, power $363.60 ÷ 150, supplies $10 ÷ 150', near(R.per.labour, 103 / 150, 1e-6) && near(R.per.power, 2.424, 1e-6) && near(R.per.supplies, 10 / 150, 1e-6) && R.per.water == null, JSON.stringify(R.per));
    check('K1 pays for its 100 clones at that price', R.charge.n === 100 && R.charge.mother === 'M100' && near(R.charge.parts.labour, 68.6667) && near(R.charge.parts.power, 242.4), JSON.stringify(R.charge));
    check('…and its own cutting isn\'t counted again: labour $63 − $63 + $68.67, supplies $10 − $10 + $6.67, power $242.40',
        near(R.k1raw, 63) && near(R.parts.labour, 68.6667) && near(R.parts.supplies, 6.6667) && near(R.parts.power, 242.4), JSON.stringify(R.parts));
    // The Costs page
    await b.run(ew, `document.getElementById('tabReports').click(); RPT.page = 'costs'; renderReports();`, { user: true });
    const page = await b.run(ew, `return document.getElementById('rptBody').innerText;`);
    check('the 💲 Costs page shows each mother lot\'s cost per clone', page.includes('What does a clone cost?') && /M100[\s\S]*150[\s\S]*\$3\.177/.test(page), page.slice(page.indexOf('What does a clone cost?'), page.indexOf('What does a clone cost?') + 500));
    // Saving K1's summary freezes the charge; closed out, it keeps it when the mother's costs change
    await b.run(ew, `rptSaveSummaries([rptModel().crops.find(c => c.lotId === 'K1')]);`);
    const fz = await b.run(m3, `return { c: DB.data._EmployeeWizard.crops.K1?.costs?.clones, l: DB.data._EmployeeWizard.cropCosts?.K1 };`);
    check('a crop summary freezes the clone charge (labour with the wages, the rest in Main.json)', fz.c?.n === 100 && fz.c.mother === 'M100' && near(fz.c.parts.power, 242.4) && near(fz.l?.cloneLabour, 68.67) && near(fz.l?.cost, 63), JSON.stringify(fz));
    await b.run(m3, `delete DB.data.lots.K1; DB.data.calendarEvents = DB.data.calendarEvents.filter(e => e.lotId !== 'K1');
        DB.data.calendarEvents.find(e => e.id === 'm3').labour_map[DB.data.calendarEvents.find(e => e.id === 'm3').date][0].hours = 20; markUnsaved(); broadcastToSubtools();`);
    await b.waitFor(ew, `return !DB.lots.K1;`);
    const after = await b.run(ew, `const M = rptModel(), k1 = M.crops.find(c => c.lotId === 'K1'); return { closed: !!k1?.closed, parts: rptCropCostParts(k1, M), per: rptCloneModel(M).priceOf('M100').perClone };`);
    check('closed out, K1 keeps its frozen clone charge though the mother\'s costs changed', after.closed && near(after.parts.labour, 68.67) && near(after.parts.power, 242.4) && !near(after.per.labour, 103 / 150), JSON.stringify(after));
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });
    await leave(b, m3);
    return results;
}
