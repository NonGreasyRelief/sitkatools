// 📅 The recipe editor shows the weekday each task lands on (user request 2026-10-29), from the weekday picked for day
// 1 (the day the clones are cut). It opens on the weekday that puts the harvest on a Friday, as the built-ins are made:
// Saturday cuts with 20 days of veg, Sunday with 19, Monday with 18. A guide only: nothing is saved with the recipe.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool } from './lib/helpers.mjs';

export const title = 'the recipe editor shows each task\'s weekday from day 1\'s';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    const clw = await openTool(b, main, 'CropLabourWizard');
    // A copy of a built-in in the editor (＋ New Recipe starts from the default, 20 days of veg)
    const openCopyOf = (id) => b.run(clw, `openRecipeManager(); showRecipeEditor({ ...JSON.parse(JSON.stringify(getRecipeById(${JSON.stringify(id)}))), id: 'zz' + Math.random().toString(36).slice(2, 6), builtin: false });`, { user: true });
    const rows = () => b.run(clw, `return Object.fromEntries([...document.querySelectorAll('#recipeTaskBody tr')].map(tr => [
        tr.querySelector('input.t-type')?.value || '', { day: tr.querySelector('.t-life-num')?.textContent, wd: tr.querySelector('.t-life-wd')?.textContent }]));`);
    const day1 = () => b.run(clw, `return document.getElementById('recipeDay1Weekday').value;`);

    await openCopyOf('sitka-9week');
    let r = await rows();
    check('20 days of veg: day 1 starts on Saturday, so the harvest is a Friday', await day1() === '6' && r.harvest?.wd === 'Fri', JSON.stringify({ day1: await day1(), harvest: r.harvest }));
    check('…every task shows its weekday: Cutting Clones Sat, Transplanting Mon, Flip Fri', r.clone_cut_prep?.wd === 'Sat' && r.transplant?.wd === 'Mon' && r.flip?.wd === 'Fri',
        JSON.stringify({ clone: r.clone_cut_prep, transplant: r.transplant, flip: r.flip }));
    check('…a multi-day task shows where it starts and ends (the 7-day trim)', /^[A-Z][a-z]{2}–[A-Z][a-z]{2}$/.test(r.trim?.wd || ''), JSON.stringify(r.trim));
    check('…under its day of the plant\'s life', r.harvest?.day === 'day 98', JSON.stringify(r.harvest));

    // Picking another weekday moves every weekday, not the days
    await b.run(clw, `const s = document.getElementById('recipeDay1Weekday'); s.value = '1'; s.dispatchEvent(new Event('change'));`);
    r = await rows();
    check('day 1 a Monday: Cutting Clones Mon, the harvest (day 98, 97 days on) a Sunday', r.clone_cut_prep?.wd === 'Mon' && r.harvest?.wd === 'Sun' && r.harvest?.day === 'day 98', JSON.stringify({ clone: r.clone_cut_prep, harvest: r.harvest }));

    // Editing an offset moves that task's weekday as you type (day 1 back on Saturday)
    await b.run(clw, `const s = document.getElementById('recipeDay1Weekday'); s.value = '6'; s.dispatchEvent(new Event('change'));`);
    await b.run(clw, `const tr = [...document.querySelectorAll('#recipeTaskBody tr')].find(t => t.querySelector('input.t-type')?.value === 'flip');
        const off = tr.querySelector('input.t-offset'); off.value = String(Number(off.value) + 1); off.dispatchEvent(new Event('input', { bubbles: true }));`);
    r = await rows();
    check('one more day of veg (flip +1): the flip moves to Sat, and the harvest with it (Sat)', r.flip?.wd === 'Sat' && r.flip?.day === 'day 36' && r.harvest?.wd === 'Sat', JSON.stringify({ flip: r.flip, harvest: r.harvest }));

    // The 18-day and 19-day built-ins open on their own cut days
    await openCopyOf('sitka-9week-19veg');
    check('19 days of veg: opens on Sunday (harvest Friday)', await day1() === '0' && (await rows()).harvest?.wd === 'Fri');
    await openCopyOf('sitka-9week-18veg');
    check('18 days of veg: opens on Monday (harvest Friday)', await day1() === '1' && (await rows()).harvest?.wd === 'Fri');

    // Nothing of it is saved with the recipe
    check('the weekday isn\'t part of the recipe', await b.run(clw, `return !JSON.stringify(readTaskTable()).includes('Fri') && !('day1Weekday' in editorRecipe);`));
    await b.run(main, `Tools.close(); clearUnsaved();`);
    return results;
}
