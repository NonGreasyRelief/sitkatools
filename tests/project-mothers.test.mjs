// 🌿 Mothers from clones (user request 2026-10-30): every flowering lot keeps extra plants back at its Transplanting, and
// they become mothers. With a 🌿 mother recipe picked beside Project Crop, each lot of a flowering room's chain gets its
// projected mothers, {room}-TBAMOM-NN (00 = the room's newest real lot's, 01…05 = its TBA lots'), in the Mother room, moved
// there on that lot's transplant day, with no tasks of their own before it. Reproject, Generate and Clear keep them in step;
// a real mother lot made from a lot takes its projection's place in SitkaTools. The mother recipe's 🌿 Mature from.
import { today, makeChecker, fresh, openSitka, loadSingle, openTool } from './lib/helpers.mjs';
import { motherDb, addDaysIso } from './mothers.test.mjs';

export const title = 'mothers from clones: 🌿 TBAMOM lots projected from each flower lot\'s transplant, and 🌿 Mature from';

const daysBetween = (a, b) => { const p = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((p(b) - p(a)) / 86400000); };

// A real lot's schedule as the default built-in writes it, from its clone-cut day
function scheduleOf(id, day0) {
    const at = n => addDaysIso(day0, n);
    const ev = (taskType, n) => ({ id: `ev_${id}_${taskType}`, date: at(n), title: `R1G1-Test Kush#${id}, ${taskType}`, sourceTool: 'CropLabourWizard', lotId: id, taskType });
    return [ev('clone_cut_prep', 0), ev('planting', 14), ev('transplant', 30), ev('flip', 34), ev('clone_cut', 70), ev('harvest', 97), ev('room_clean', 98), ev('tank_irrigation_clean', 99)];
}
function realLot(id, created, day0) {
    return { name: id, strain: 'Test Kush', stage: 'veg', createdDate: created, closedDate: null, type: 'new-lot', startPlantCount: 100,
        cloningRoom: 'Clone 1', vegRoom: null, destRoom: 'Grow 1', dryRoom: null, trimRoom: null, currentRoom: 'Clone 1', plantCount: 100,
        _tool_CropLabourWizard: { plantingDate: day0, recipeId: 'sitka-9week', trimDays: 7, harvestMultiDay: false, harvestDays: 2, taskCount: 8 } };
}

// Grow 1's newest real lot, L500, cut its clones 10 days ago: its transplant (day 31) is still ahead. Mother 1 (B1) has its
// own projected mother lot, R1MO-TBA-01.
function db() {
    const d = motherDb();
    const day0 = today(-10);
    d.lots.L500 = realLot('L500', day0, day0);
    d.rooms.R1G1.assignedLots.push('L500');
    d.calendarEvents.push(...scheduleOf('L500', day0));
    d._CropLabourWizard = { projectedLots: { 'R1MO-TBA-01': { name: 'R1MO-TBA-01', roomId: 'R1MO', roomName: 'Mother 1', strain: 'TBA', index: 1, config: { plantingDate: today(5), recipeId: 'sitka-mother', kind: 'vegetative' } } } };
    d.calendarEvents.push({ id: 'ev_motba1', date: today(130), title: '🍂 R1MO-TBA-01, Retire Mothers', sourceTool: 'CropProjection', lotId: 'R1MO-TBA-01', roomId: 'R1MO', taskType: 'retire' });
    return d;
}

// Every projected mother lot: its entry and events
const READ = `const map = getProjectedLots(), ev = DB.data.calendarEvents.filter(e => e.sourceTool === 'CropProjection');
    const tp = id => (isProjectedLot(id) ? ev : DB.data.calendarEvents.filter(e => e.sourceTool === 'CropLabourWizard')).find(e => e.lotId === id && e.taskType === 'transplant')?.date || null;
    return Object.keys(map).filter(id => id.includes('-TBAMOM-')).sort().map(id => { const p = map[id], mine = ev.filter(e => e.lotId === id);
        return { id, room: p.roomId, srcRoom: p.sourceRoomId, src: p.sourceLotId, recipe: p.recipeId, day0: p.config?.plantingDate, tp: tp(id), srcTp: tp(p.sourceLotId),
            types: mine.map(e => e.taskType), evRooms: [...new Set(mine.map(e => e.roomId))], ids: mine.map(e => e.id).sort(),
            mature: mine.filter(e => e.motherMature).map(e => [e.taskType, e.date]), retire: mine.find(e => e.taskType === 'retire')?.date,
            titlesOk: mine.every(e => e.title.includes(id)) }; });`;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db());
    let clw = await openTool(b, main, 'CropLabourWizard');
    const pick = (lotId) => b.run(clw, `const l = document.getElementById('activeLot'); l.value = '${lotId}'; l.dispatchEvent(new Event('change'));`);
    const mom = () => b.run(clw, `const m = document.getElementById('motherRecipeSelect'); return { value: m.value, disabled: m.disabled, options: [...m.options].map(o => [o.value, o.textContent]) };`);
    const project = (recipeId) => b.run(clw, `window.__alert = null; window.alert = m => { window.__alert = m; }; window.confirm = () => true;
        const m = document.getElementById('motherRecipeSelect'); m.value = '${recipeId}'; m.dispatchEvent(new Event('change'));
        document.getElementById('generateProjectionsBtn').click(); return window.__alert;`, { user: true });
    const mothers = () => b.run(clw, READ);

    // ---- The 🌿 dropdown ----
    let m = await mom();
    check('🌿 Mothers from clones: "— No mothers —", then the 🌿 recipes with a Transplanting', JSON.stringify(m.options) === JSON.stringify([['', '— No mothers —'], ['sitka-mother', '🌿 Sitka Default mother recipe (built-in)']]), JSON.stringify(m.options));
    await pick('L500');
    m = await mom();
    check('…a flowering room\'s lot with no mothers shows "— No mothers —", ready to pick', m.value === '' && !m.disabled, JSON.stringify(m));
    await pick('M100');
    check('…disabled for a Mother room\'s lot (its next mothers follow its own recipe)', (await mom()).disabled);

    // ---- 🔮 Project Crop with the built-in mother recipe ----
    await pick('L500');
    let alerted = await project('sitka-mother');
    let M = await mothers();
    check('Project Crop gives the real lot and each TBA lot its mothers: R1G1-TBAMOM-00…05', !alerted && M.map(x => x.id).join() === [0, 1, 2, 3, 4, 5].map(i => `R1G1-TBAMOM-0${i}`).join(), (alerted || '') + JSON.stringify(M.map(x => x.id)));
    check('…00 from the real lot L500, 01…05 from R1G1-TBA-01…05, all with the built-in mother recipe', M[0]?.src === 'L500' && M.slice(1).every((x, i) => x.src === `R1G1-TBA-0${i + 1}`) && M.every(x => x.srcRoom === 'R1G1' && x.recipe === 'sitka-mother'), JSON.stringify(M.map(x => [x.src, x.recipe])));
    check('…in Mother 1 (the Mother room in Grow 1\'s building), events and all', M.every(x => x.room === 'R1MO' && x.evRooms.join() === 'R1MO'), JSON.stringify(M.map(x => [x.room, x.evRooms])));
    check('…each one moves to the Mother room on its flower lot\'s transplant day', M.every(x => x.tp && x.tp === x.srcTp), JSON.stringify(M.map(x => [x.id, x.tp, x.srcTp])));
    check('…with no Cutting Clones, Planting or Clean Clone Room of its own (they\'re the flower lot\'s clones until then)',
        M.every(x => !x.types.some(t => ['clone_cut_prep', 'planting', 'clone_room_clean'].includes(t)) && x.types.includes('transplant') && x.types.includes('retire')), JSON.stringify(M[1]?.types));
    check('…mature from the Second leaf pick, 40 days after the transplant: day 71 of the plants\' life', M.every(x => x.mature.length === 1 && x.mature[0][0] === 'mother_pick2'
        && daysBetween(x.tp, x.mature[0][1]) === 40 && daysBetween(x.day0, x.mature[0][1]) + 1 === 71), JSON.stringify(M.map(x => [x.day0, x.mature])));
    check('…retired 94 days after the transplant (Retire Mothers, planting + 110)', M.every(x => daysBetween(x.tp, x.retire) === 94), JSON.stringify(M.map(x => [x.tp, x.retire])));
    check('…titled with their own ids', M.every(x => x.titlesOk));
    const room2 = await b.run(clw, `return motherRoomFor('R2G1');`);
    check('Grow A (Building 2, no Mother room of its own) would use the facility\'s first Mother room, Mother 1', room2 === 'R1MO', room2);
    const status = await b.run(clw, `return statusLine();`);
    check('the opening toast counts them apart from the TBA lots', status.includes('🔮 6 projected') && status.includes('🌿 6 mothers from clones'), status);

    // Re-running keeps the same events
    const idsBefore = M.map(x => x.ids.join());
    await project('sitka-mother');
    M = await mothers();
    check('Project Crop again: the same mother lots, the same events (shifted, not rebuilt)', JSON.stringify(M.map(x => x.ids.join())) === JSON.stringify(idsBefore));

    // ---- The lot list and a selected TBAMOM ----
    const opts = await b.run(clw, `return [...document.getElementById('activeLot').options].map(o => [o.value, o.textContent]);`);
    const at = id => opts.findIndex(o => o[0] === id);
    check('the Active Lot list shows them under Grow 1, after its TBA lots: "🔮🌿 R1G1-TBAMOM-03 → Mother 1"',
        opts[at('R1G1-TBAMOM-03')]?.[1] === '🔮🌿 R1G1-TBAMOM-03 → Mother 1' && at('R1G1-TBAMOM-00') > at('R1G1-TBA-05') && at('R1G1-TBA-05') > at('L500'), JSON.stringify(opts));
    await pick('R1G1-TBA-02');
    check('the dropdown follows the room: a Grow 1 lot shows its mothers\' recipe', (await mom()).value === 'sitka-mother');
    await pick('L200');
    check('…a lot in Grow A (no mothers) shows "— No mothers —"', (await mom()).value === '');
    await pick('R1G1-TBAMOM-03');
    const sel = await b.run(clw, `const g = document.getElementById('generateBtn'), list = document.getElementById('previewTaskList').textContent;
        window.__alert = null; window.alert = x => { window.__alert = x; }; const before = JSON.stringify(DB.data.calendarEvents.length);
        document.getElementById('scheduleForm').requestSubmit();
        return { disabled: g.disabled, title: g.title, cut: list.includes('Cutting Clones'), planting: list.includes('Planting Clones'), transplant: list.includes('Transplanting to Mother Room'),
            mature: list.includes('🌿 mothers mature from here'), alert: window.__alert, same: before === JSON.stringify(DB.data.calendarEvents.length), recipe: document.getElementById('recipeSelect').value,
            project: document.getElementById('generateProjectionsBtn').textContent, momDisabled: document.getElementById('motherRecipeSelect').disabled };`);
    check('a selected TBAMOM: Generate is disabled, saying they follow R1G1-TBA-03\'s Transplanting', sel.disabled && sel.title.includes('R1G1-TBA-03'), sel.title);
    check('…and refused if submitted anyway, nothing changed', (sel.alert || '').includes('Nothing was changed') && sel.same, sel.alert);
    check('…its preview shows its own tasks from Transplanting on, with "🌿 mothers mature from here", and its 🌿 recipe',
        !sel.cut && !sel.planting && sel.transplant && sel.mature && sel.recipe === 'sitka-mother', JSON.stringify(sel));
    check('…Project Crop and the 🌿 dropdown act on its flower room, Grow 1', sel.project === '🔮 Project Crop' && !sel.momDisabled, JSON.stringify(sel));

    // ---- Generate on TBA-02 a week later: its mothers (and any lot it pushes) follow ----
    await pick('R1G1-TBA-02');
    await b.run(clw, `window.confirm = () => true; const d = document.getElementById('plantingDate'); d.value = computeTaskDate(d.value, 7); d.dispatchEvent(new Event('change'));
        document.getElementById('scheduleForm').requestSubmit();`, { user: true });
    const M2 = await mothers();
    const moved = daysBetween(M.find(x => x.id === 'R1G1-TBAMOM-02').tp, M2.find(x => x.id === 'R1G1-TBAMOM-02').tp);
    check('Generate on R1G1-TBA-02 a week later: R1G1-TBAMOM-02 moves with it, and every mother lot still transplants with its flower lot',
        moved === 7 && M2.every(x => x.tp === x.srcTp), JSON.stringify(M2.map(x => [x.id, x.tp, x.srcTp])));

    // ---- Clear Projections in the Mother room: its own chain only ----
    await b.run(clw, `clearAllProjectionsForRoom('R1MO');`);
    let left = await b.run(clw, `return { own: !!getProjectedLots()['R1MO-TBA-01'], ownEv: DB.data.calendarEvents.some(e => e.lotId === 'R1MO-TBA-01'), moms: Object.keys(getProjectedLots()).filter(id => id.includes('TBAMOM')).length,
        momEv: DB.data.calendarEvents.filter(e => e.sourceTool === 'CropProjection' && e.lotId.includes('TBAMOM')).length };`);
    check('Clear Projections in Mother 1 clears its own chain and leaves the mothers from clones living there', !left.own && !left.ownEv && left.moms === 6 && left.momEv > 0, JSON.stringify(left));
    await b.run(main, `Tools.close();`);

    // ---- SitkaTools: L500's mothers made as a lot in Mother 1 take their projection's place ----
    await b.run(main, `DB.data._CropLabourWizard.projectedLots['R1MO-TBA-01'] = { name: 'R1MO-TBA-01', roomId: 'R1MO', roomName: 'Mother 1', strain: 'TBA', index: 1 };
        DB.data.calendarEvents.push({ id: 'ev_motba1b', date: '${today(130)}', title: '🍂 R1MO-TBA-01, Retire Mothers', sourceTool: 'CropProjection', lotId: 'R1MO-TBA-01', roomId: 'R1MO', taskType: 'retire' });
        window.__msg = ''; window.alert = x => { window.__msg += x; }; const t = document.getElementById('lotType'); t.value = 'sub-lot'; t.dispatchEvent(new Event('change'));
        document.getElementById('parentLot').value = 'L500'; document.getElementById('parentLot').dispatchEvent(new Event('change'));
        document.getElementById('lotId').value = 'M500'; document.getElementById('lotStrain').value = 'Test Kush'; document.getElementById('plantCount').value = '6';
        document.getElementById('destRoom').value = 'Mother 1'; document.getElementById('lotStage').value = 'mother'; document.getElementById('lotForm').requestSubmit();`, { user: true });
    const hook = await b.run(main, `const map = DB.data._CropLabourWizard.projectedLots; return { lot: DB.lots.M500?.parentLotId, m00: !!map['R1G1-TBAMOM-00'], m00ev: DB.data.calendarEvents.some(e => e.lotId === 'R1G1-TBAMOM-00'),
        m01: !!map['R1G1-TBAMOM-01'], tba1: !!map['R1MO-TBA-01'], msg: window.__msg };`);
    check('a lot made from L500 in Mother 1 takes R1G1-TBAMOM-00\'s place (entry and events gone), and says so',
        hook.lot === 'L500' && !hook.m00 && !hook.m00ev && hook.m01 && hook.msg.includes('R1G1-TBAMOM-00'), JSON.stringify(hook));
    check('…leaving Mother 1\'s own TBA-01 alone (these mothers came from clones, not from its chain)', hook.tba1, JSON.stringify(hook));
    const refuse = await b.run(main, `window.__msg = ''; window.confirm = () => true; RoomManager.deleteRoom('R1MO'); return { msg: window.__msg, still: !!DB.data.rooms.R1MO };`);
    check('deleting Mother 1 is refused while mothers from Grow 1 live there, saying where to clear them', refuse.still && refuse.msg.includes('projected lots') && refuse.msg.includes('come from Grow 1'), refuse.msg);

    // ---- A new real lot takes TBA-01; Reproject moves the mothers down with the chain ----
    const tba1Day0 = await b.run(main, `return DB.data._CropLabourWizard.projectedLots['R1G1-TBA-01'].config.plantingDate;`);
    const oldIds01 = (await b.run(main, `return DB.data.calendarEvents.filter(e => e.lotId === 'R1G1-TBAMOM-01').map(e => e.id).sort();`));
    await b.run(main, `window.alert = () => {}; const t = document.getElementById('lotType'); t.value = 'new-lot'; t.dispatchEvent(new Event('change'));
        document.getElementById('lotId').value = 'L700'; document.getElementById('lotStrain').value = 'Test Kush'; document.getElementById('plantCount').value = '100';
        document.getElementById('destRoom').value = 'Grow 1'; document.getElementById('lotForm').requestSubmit();`, { user: true });
    // L700 scheduled where TBA-01 was planned
    await b.run(main, `DB.lots.L700._tool_CropLabourWizard = { plantingDate: '${tba1Day0}', recipeId: 'sitka-9week', trimDays: 7, harvestMultiDay: false, harvestDays: 2, taskCount: 8 };
        DB.data.calendarEvents.push(...${JSON.stringify(scheduleOf('L700', tba1Day0))});`);
    clw = await openTool(b, main, 'CropLabourWizard');
    await pick('L700');
    const pend = await b.run(clw, `return { btn: document.getElementById('generateProjectionsBtn').textContent, mom: document.getElementById('motherRecipeSelect').value, tba1: !!getProjectedLots()['R1G1-TBA-01'] };`);
    check('a new real lot in Grow 1 took TBA-01: the room waits for Reproject, its mothers still on the dropdown', pend.btn === '🔁 Reproject' && pend.mom === 'sitka-mother' && !pend.tba1, JSON.stringify(pend));
    await project('sitka-mother');
    M = await mothers();
    check('Reproject: the mothers move down with their lots, 00…05 again', M.map(x => x.id).join() === [0, 1, 2, 3, 4, 5].map(i => `R1G1-TBAMOM-0${i}`).join(), JSON.stringify(M.map(x => x.id)));
    check('…00 now follows the new real lot L700, keeping the events of the old 01 (renamed, ids and titles)', M[0]?.src === 'L700' && M[0].ids.join() === oldIds01.join() && M[0].titlesOk,
        JSON.stringify([M[0]?.src, M[0]?.ids.length, oldIds01.length]));
    check('…01…05 follow R1G1-TBA-01…05 (a fresh 05), each transplanting with its lot', M.slice(1).every((x, i) => x.src === `R1G1-TBA-0${i + 1}`) && M.every(x => x.tp === x.srcTp && x.titlesOk),
        JSON.stringify(M.map(x => [x.id, x.src, x.tp, x.srcTp])));

    // ---- No Mother room: refused, nothing changed ----
    const snap = await b.run(clw, `return JSON.stringify([DB.data.calendarEvents.length, Object.keys(getProjectedLots()).sort()]);`);
    await b.run(clw, `DB.data.rooms.R1MO.designation = 'Vegetation';`);
    alerted = await project('sitka-mother');
    const after = await b.run(clw, `const s = JSON.stringify([DB.data.calendarEvents.length, Object.keys(getProjectedLots()).sort()]); DB.data.rooms.R1MO.designation = 'Mother'; return s;`);
    check('with no Mother room anywhere, Project Crop with mothers is refused and nothing changes', (alerted || '').includes('no Mother room') && after === snap, alerted);

    // ---- "— No mothers —" removes them; Clear Projections on Grow 1 too ----
    alerted = await project('');
    left = await b.run(clw, `return Object.keys(getProjectedLots()).filter(id => id.includes('TBAMOM')).length + DB.data.calendarEvents.filter(e => (e.lotId || '').includes('TBAMOM')).length;`);
    check('Project Crop with "— No mothers —" removes Grow 1\'s mothers (lots and events), the chain stays', !alerted && left === 0 && await b.run(clw, `return !!getProjectedLots()['R1G1-TBA-05'];`));
    await project('sitka-mother');
    await b.run(clw, `window.confirm = () => true; document.getElementById('clearProjectionsBtn').click();`, { user: true });
    left = await b.run(clw, `return Object.keys(getProjectedLots()).filter(id => id.startsWith('R1G1-')).length + DB.data.calendarEvents.filter(e => e.sourceTool === 'CropProjection' && (e.lotId || '').startsWith('R1G1-')).length;`);
    check('Clear Projections on Grow 1 clears its chain and its mothers', left === 0, String(left));

    // ---- 🌿 Mature from: validation, the editor, the recipe list and the print ----
    const v = await b.run(clw, `const base = cloneRecipeData(SITKA_MOTHER_RECIPE); const with_ = t => validateRecipe(Object.assign(cloneRecipeData(base), { matureTask: t })).join(' ');
        return { builtin: validateRecipe(base).join(' '), mature: base.matureTask, before: with_('planting'), retire: with_('retire'), none: with_('nope'),
            bloom: validateRecipe(Object.assign(cloneRecipeData(BUILTIN_RECIPE), { matureTask: 'flip' })).join(' ') };`);
    check('the built-in mother recipe is mature from its Second leaf pick, and validates', v.mature === 'mother_pick2' && v.builtin === '', JSON.stringify(v));
    check('Mature from must be a task of the recipe, after Transplanting, not Retire Mothers, and only on a mother recipe',
        v.before.includes('before Transplanting') && v.retire.includes('Retire Mothers') && v.none.includes("isn't a task") && v.bloom.includes('only a vegetative'), JSON.stringify(v));
    await b.run(clw, `openRecipeManager(); showRecipeEditor(Object.assign(cloneRecipeData(SITKA_MOTHER_RECIPE), { id: 'mymoms', name: 'My moms' }));`);
    const ed = await b.run(clw, `const s = document.getElementById('recipeMatureSelect'); return { shown: document.getElementById('recipeMatureGroup').style.display !== 'none', value: s.value,
        opts: [...s.options].map(o => o.value), box: document.getElementById('recipeTurnaround').textContent };`);
    check('the editor\'s 🌿 Mature from: the tasks after Transplanting (not Retire), Second leaf pick picked, "Mature from day 71" in the readout',
        ed.shown && ed.value === 'mother_pick2' && !ed.opts.includes('planting') && !ed.opts.includes('retire') && !ed.opts.includes('transplant') && ed.opts.includes('mother_top') && ed.box.includes('Mature from day 71'), JSON.stringify(ed));
    const saved = await b.run(clw, `const s = document.getElementById('recipeMatureSelect'); s.value = 'mother_uppot1'; s.dispatchEvent(new Event('change'));
        const box = document.getElementById('recipeTurnaround').textContent; await saveRecipeFromEditor();
        return { box, saved: DB.data._CropLabourWizard.recipes.mymoms?.matureTask, dropdown: [...document.getElementById('motherRecipeSelect').options].some(o => o.value === 'mymoms'),
            row: [...document.querySelectorAll('#recipeList .recipe-row')].find(r => r.textContent.includes('Sitka Default mother recipe'))?.textContent || '' };`);
    check('…picking Up-Pot to 5-7 Gal reads day 61, and saving keeps it; the recipe joins the 🌿 dropdown', saved.box.includes('Mature from day 61') && saved.saved === 'mother_uppot1' && saved.dropdown, JSON.stringify(saved));
    check('the recipe list says what the built-in is mature from', saved.row.includes('mature from 🍃 Second leaf pick'), saved.row);
    const bloomEd = await b.run(clw, `showRecipeEditor(cloneRecipeData(BUILTIN_RECIPE)); return document.getElementById('recipeMatureGroup').style.display;`);
    check('…a bloom recipe has no Mature from', bloomEd === 'none', bloomEd);
    const before = new Set((await b.contexts()).flatMap(c => [c.context, ...(c.children || []).map(x => x.context)]));
    await b.run(clw, `printRecipe(getRecipeById('sitka-mother'));`, { user: true });
    await b.sleep(600);
    const pr = (await b.contexts()).find(c => !before.has(c.context));
    const facts = pr ? await b.run(pr.context, `return [...document.querySelectorAll('ul.facts li')].map(li => li.textContent);`) : [];
    if (pr) await b.send('browsingContext.close', { context: pr.context });
    check('the printed mother recipe says when its mothers are mature', facts.some(f => f.includes("Mothers are mature from 🍃 Second leaf pick (Mothers), day 71 of the plant's life.")), JSON.stringify(facts));

    await b.run(main, `Tools.close();`);
    return results;
}
