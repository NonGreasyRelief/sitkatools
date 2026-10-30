// ✏️ DailyWizard's edit mode lists every task the building has (user report 2026-10-30: a task saved for Thursdays only
// vanished from the list on any other day, so it couldn't be found to edit). A task that doesn't run on the day shown is
// dimmed with 📅 its days, and has no tick box, ⏱ Log or timer for that day; it can still be opened, edited and moved.
// Out of edit mode the list is still the day's.
import { fixtureDb, withFloorManager, makeChecker, fresh, openSitka, loadSingle, openTool, dwBuilding, dwDate, dwUnlock, leave } from './lib/helpers.mjs';

export const title = 'DailyWizard edit mode lists tasks for other days too';

const MONDAY = '2026-11-02', THURSDAY = '2026-11-05';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, withFloorManager(fixtureDb()));
    const dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    await dwDate(b, dw, MONDAY);
    // The building's chores (rows with a task code), not 🧰 Misc or the day's crop and equipment tasks
    const rows = () => b.run(dw, `return [...document.querySelectorAll('#listContainer .task-row')].filter(r => r.querySelector('.chip-code')).map(r => ({
        name: r.querySelector('.task-name')?.textContent, off: r.classList.contains('off-day'), chip: r.querySelector('.chip-offday')?.textContent || '',
        tick: !!r.querySelector('.task-check'), log: !!r.querySelector('.hours-btn'), up: !!r.querySelector('.move-btn') }));`);

    // ---- A task for Thursdays only, saved in the editor on a Monday ----
    check('✏️ Edit tasks unlocks with the floor manager\'s PIN', await dwUnlock(b, dw));
    await b.run(dw, `openTaskEditor('B1', null);
        document.getElementById('taskNameInput').value = 'Check the CO2 tanks';
        document.querySelectorAll('#weekdayPills .pill').forEach(p => { if ((p.dataset.day === '4') !== p.classList.contains('on')) p.click(); });
        document.getElementById('editorSaveBtn').click();`, { user: true });
    const saved = await b.run(dw, `return DB.dailyBuildings.B1.tasks.find(t => t.name === 'Check the CO2 tanks')?.days || null;`);
    check('saved for Thursdays only', JSON.stringify(saved) === '[4]', JSON.stringify(saved));
    let r = await rows();
    let co2 = r.find(x => x.name === 'Check the CO2 tanks');
    check('on a Monday in edit mode it\'s listed, dimmed, "📅 Not today · Thu"', !!co2 && co2.off && co2.chip === '📅 Not today · Thu', JSON.stringify(r));
    check('…with no tick box, ⏱ Log or timer for the day, but ▲ ▼ to move it', co2 && !co2.tick && !co2.log && co2.up, JSON.stringify(co2));
    check('…the everyday chores as usual', r.filter(x => !x.off).every(x => x.tick && x.log) && r.filter(x => !x.off).length === 2, JSON.stringify(r));
    await b.run(dw, `[...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Check the CO2 tanks')).querySelector('.task-name').click();`, { user: true });
    check('tapping it opens its detail, to edit it', await b.run(dw, `return document.getElementById('detailOverlay').classList.contains('open') && getDetailTask()?.name === 'Check the CO2 tanks';`));
    await b.run(dw, `closeTaskDetail();`);
    // Moving it up past an everyday chore
    const before = await b.run(dw, `return DB.dailyBuildings.B1.tasks.map(t => t.code).join();`);
    await b.run(dw, `[...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Check the CO2 tanks')).querySelector('.move-btn').click();`, { user: true });
    const after = await b.run(dw, `return DB.dailyBuildings.B1.tasks.map(t => t.code).join();`);
    const [c1, c2, c3] = before.split(',');
    check('▲ moves it up past an everyday chore', after === [c1, c3, c2].join(), `${before} → ${after}`);

    // ---- Out of edit mode it's the day's list again ----
    await b.run(dw, `document.getElementById('doneEditingBtn').click();`, { user: true });
    r = await rows();
    check('✅ Done editing: on Monday it isn\'t listed', !r.some(x => x.name === 'Check the CO2 tanks') && r.length === 2, JSON.stringify(r));
    await dwDate(b, dw, THURSDAY);
    r = await rows();
    co2 = r.find(x => x.name === 'Check the CO2 tanks');
    check('on a Thursday it is, as an ordinary task: tick box and ⏱ Log', !!co2 && !co2.off && co2.tick && co2.log && !co2.chip, JSON.stringify(co2));

    await b.run(main, `Tools.close(); clearUnsaved();`);
    await leave(b, main);
    return results;
}
