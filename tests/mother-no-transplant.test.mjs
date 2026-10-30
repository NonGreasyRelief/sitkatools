// 🌿 The built-in mother recipe's Transplanting to Mother Room is optional while the lot's clones are off (user request
// 2026-10-30): mothers from bought or received plants can be planted straight in the Mother room. With the clones on it
// stays on, as before. A lot generated without it has its planting in the Mother room, and the recipe editor keeps the
// flag ("No ✂️") on a copy of the recipe.
import { makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';
import { motherDb } from './mothers.test.mjs';

export const title = 'mother recipe: Transplanting optional while the clones are off';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, motherDb());
    const clw = await openTool(b, main, 'CropLabourWizard');
    const pickLot = id => b.run(clw, `const l = document.getElementById('activeLot'); l.value = '${id}'; l.dispatchEvent(new Event('change'));`);
    const box = tt => `document.getElementById('check_' + taskOffsets.findIndex(e => e.def.taskType === '${tt}'))`;
    const rows = () => b.run(clw, `const row = tt => { const i = taskOffsets.findIndex(e => e.def.taskType === tt), c = document.getElementById('check_' + i);
            return { box: !!c, checked: !!c?.checked, title: c?.title || '', off: document.querySelectorAll('.preview-task-item')[i]?.classList.contains('disabled') }; };
        return { clones: row('clone_cut_prep'), transplant: row('transplant'), unsaved: scheduleChangesUnsaved() };`);
    const generate = () => b.run(clw, `window.confirm = () => true; document.getElementById('generateBtn').click();`, { user: true }).then(() => b.sleep(200));
    const events = () => b.run(main, `return Object.fromEntries(DB.data.calendarEvents.filter(e => e.lotId === 'M100').map(e => [e.taskType, { date: e.date, phase: e.roomPhase, title: e.title }]));`);

    // ---- Clones on (the default): Transplanting can't be switched off ----
    await pickLot('M100');
    await b.run(clw, `const r = document.getElementById('recipeSelect'); r.value = 'sitka-mother'; r.dispatchEvent(new Event('change'));
        document.getElementById('plantingDate').value = '2026-10-24'; refreshPreview();`);
    let r = await rows();
    check('with the clones on, Transplanting to Mother Room has no checkbox: it\'s always on', r.clones.box && r.clones.checked && !r.transplant.box && !r.transplant.off, JSON.stringify(r));

    // ---- Clones off: it gets a checkbox, on to start with ----
    await b.run(clw, `${box('clone_cut_prep')}.click();`, { user: true });
    r = await rows();
    check('Cutting Clones unticked: Transplanting gets a checkbox, ticked, saying it\'s optional while the clones are off',
        !r.clones.checked && r.transplant.box && r.transplant.checked && !r.transplant.off && /Optional while the clones are off/.test(r.transplant.title), JSON.stringify(r));
    await b.run(clw, `${box('transplant')}.click();`, { user: true });
    r = await rows();
    check('…unticked: the row is switched off', r.transplant.box && !r.transplant.checked && r.transplant.off, JSON.stringify(r));
    await generate();
    let ev = await events();
    check('Generate without it: no Transplanting task, the rest as before (planting, retire)', !ev.transplant && !ev.clone_cut_prep && ev.planting?.date === '2026-10-24' && !!ev.retire,
        JSON.stringify(Object.keys(ev)));
    check('…the planting is in the Mother room (nothing moves rooms), with the room in its title',
        ev.planting?.phase === 'flower' && /R1MO/.test(ev.planting?.title || '') && ev.mother_top?.phase === 'flower', JSON.stringify({ planting: ev.planting, top: ev.mother_top }));
    check('…the clone room clean stays in the cloning room', ev.clone_room_clean?.phase === 'cloning', JSON.stringify(ev.clone_room_clean));

    // ---- The saved schedule comes back as it was generated ----
    await pickLot('L100');
    await pickLot('M100');
    r = await rows();
    check('picking the lot again: clones off and Transplanting unticked, as generated, nothing changed', !r.clones.checked && r.transplant.box && !r.transplant.checked && !r.unsaved, JSON.stringify(r));

    // ---- Clones back on: Transplanting is on again, and in the schedule ----
    await b.run(clw, `${box('clone_cut_prep')}.click();`, { user: true });
    r = await rows();
    check('Cutting Clones ticked again: Transplanting\'s checkbox goes and it\'s on', r.clones.checked && !r.transplant.box && !r.transplant.off && r.unsaved, JSON.stringify(r));
    await generate();
    ev = await events();
    check('…generated with it: transplanted planting + 16, the planting back in the veg room', !!ev.transplant && ev.planting?.phase === 'veg' && ev.transplant.phase === 'flower',
        JSON.stringify({ planting: ev.planting, transplant: ev.transplant }));
    await b.run(clw, `${box('clone_cut_prep')}.click();`, { user: true });
    r = await rows();
    check('…and clones off once more: its checkbox is back, ticked (on unless unticked)', r.transplant.box && r.transplant.checked, JSON.stringify(r));

    // ---- A bloom recipe's Transplanting to Flower Room isn't optional, clones or not ----
    await pickLot('L100');
    await b.run(clw, `const r = document.getElementById('recipeSelect'); r.value = 'sitka-9week'; r.dispatchEvent(new Event('change')); refreshPreview();`);
    await b.run(clw, `if (${box('clone_cut_prep')}.checked) ${box('clone_cut_prep')}.click();`, { user: true });
    r = await rows();
    check('a bloom lot with its clones off: Transplanting to Flower Room still has no checkbox', !r.clones.checked && !r.transplant.box, JSON.stringify(r));

    // ---- The recipe: the flag, the editor's "No ✂️" column, a copy keeping it, the print ----
    const flag = await b.run(clw, `const r = getRecipeById('sitka-mother'); return { t: r.tasks.find(t => t.taskType === 'transplant').optionalWithoutClones === true,
        others: r.tasks.filter(t => t.optionalWithoutClones).length, errs: validateRecipe(r).length };`);
    check('the built-in mother recipe: only Transplanting is optional without clones, and it\'s still a valid recipe', flag.t && flag.others === 1 && flag.errs === 0, JSON.stringify(flag));
    await b.run(clw, `openRecipeManager(); document.getElementById('recipeNewVegBtn').click();`, { user: true });
    const ed = await b.run(clw, `const tr = tt => [...document.querySelectorAll('#recipeTaskBody tr')].find(r => r.querySelector('input.t-type').value === tt);
        const t = tr('transplant'), c = tr('clone_room_clean');
        const before = { checked: t.querySelector('.t-noclones').checked, disabled: t.querySelector('.t-noclones').disabled, other: c.querySelector('.t-noclones').checked,
            cutDisabled: tr('clone_cut').querySelector('.t-noclones').disabled };
        const kept = readTaskTable().find(x => x.taskType === 'transplant');
        t.querySelector('.t-toggle').click();
        const tgl = { disabled: t.querySelector('.t-noclones').disabled, read: readTaskTable().find(x => x.taskType === 'transplant') };
        t.querySelector('.t-toggle').click();
        return { before, kept: kept.optionalWithoutClones === true && !kept.hasToggle, tgl, head: [...document.querySelectorAll('#recipeTaskTable thead th')].some(th => th.textContent.trim() === 'No ✂️') };`, { user: true });
    check('🌿 New Mother Recipe\'s copy: its Transplanting row has "No ✂️" ticked (not the others), and keeps it when read back',
        ed.head && ed.before.checked && !ed.before.disabled && !ed.before.other && ed.before.cutDisabled && ed.kept, JSON.stringify(ed));
    check('…ticking Tgl (always optional) greys "No ✂️" out and saves a plain toggle', ed.tgl.disabled && ed.tgl.read.hasToggle === true && !ed.tgl.read.optionalWithoutClones,
        JSON.stringify(ed.tgl));
    await b.run(clw, `document.getElementById('recipeFooterBackBtn').click(); closeRecipeManager();`, { user: true });

    await b.run(main, `clearUnsaved();`);
    await leave(b, main);
    return results;
}
