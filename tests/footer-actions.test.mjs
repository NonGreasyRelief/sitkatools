// The footer actions (user request 2026-10-28): CropLabourWizard's Clear / Generate Schedule, the recipe editor's Save
// Recipe and PaperWizard's sheet editor's Delete / Save sheet sit in the tool's footer — delete or clear on the left,
// Close Tool (or ‹ Back) in the middle, the main action on the right — all the same shape. DailyWizard's edit mode too
// (user request 2026-10-29): ✅ Done editing on the left, + Add Task on the right.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, withFloorManager, dwBuilding, dwUnlock } from './lib/helpers.mjs';

export const title = 'Footer actions';

// Where each footer button is, and its size
const footer = (b, ctx, sel) => b.run(ctx, `const f = document.querySelector(${JSON.stringify(sel)}), fr = f.getBoundingClientRect();
    return [...f.querySelectorAll('button')].filter(x => x.offsetParent).map(x => { const r = x.getBoundingClientRect();
        return { id: x.id, text: x.textContent.trim(), side: r.right < fr.left + fr.width / 3 ? 'left' : r.left > fr.left + fr.width * 2 / 3 ? 'right' : 'middle', w: Math.round(r.width), h: Math.round(r.height) }; });`);

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await b.send('browsingContext.setViewport', { context: main, viewport: { width: 1280, height: 800 } });
    await openSitka(b, main, BASE);
    await loadSingle(b, main, withFloorManager(fixtureDb()));

    // ---- CropLabourWizard ----
    const clw = await openTool(b, main, 'CropLabourWizard');
    const main1 = await footer(b, clw, '.tool-root > footer');
    const by = (list, id) => list.find(x => x.id === id) || {};
    check('CropLabourWizard: Clear Schedule on the left, Close Tool in the middle, Generate Schedule on the right of the footer',
        by(main1, 'clearFormBtn').side === 'left' && by(main1, 'closeToolBtn').side === 'middle' && by(main1, 'generateBtn').side === 'right', JSON.stringify(main1));
    check('…not under the task list any more', await b.run(clw, `return !document.querySelector('#previewCard #generateBtn, #previewCard #clearFormBtn');`));
    await b.run(clw, `const s = document.getElementById('activeLot'); s.value = 'L100'; s.dispatchEvent(new Event('change'));`);
    check('…Generate Schedule still generates from the footer (the form\'s submit)', await b.run(clw, `let sent = false; const f = document.getElementById('scheduleForm');
        const h = e => { sent = true; e.preventDefault(); e.stopImmediatePropagation(); }; f.addEventListener('submit', h, true);
        document.getElementById('generateBtn').click(); f.removeEventListener('submit', h, true); return sent;`, { user: true }));
    await b.run(clw, `openRecipeManager(); document.getElementById('recipeNewBtn').click();`, { user: true });
    const recipe = await footer(b, clw, '.recipe-footer');
    check('the recipe editor: ‹ Back in the middle, Save Recipe on the right', by(recipe, 'recipeFooterBackBtn').side === 'middle' && by(recipe, 'recipeEditorSaveBtn').side === 'right', JSON.stringify(recipe));
    await b.run(main, `Tools.close();`);

    // ---- PaperWizard ----
    const pw = await openTool(b, main, 'PaperWizard');
    let pf = await footer(b, pw, '.tool-root > footer');
    check('PaperWizard\'s Filing Cabinet: only Close Tool in the footer', pf.length === 1 && pf[0].id === 'closeToolBtn', JSON.stringify(pf));
    await b.run(pw, `document.getElementById('tabConfigureBtn').click();`, { user: true });
    pf = await footer(b, pw, '.tool-root > footer');
    check('Configure Sheets: 🗑 Delete sheet on the left, Close Tool in the middle, 💾 Save sheet on the right',
        by(pf, 'deleteSheetBtn').side === 'left' && by(pf, 'closeToolBtn').side === 'middle' && by(pf, 'saveSheetBtn').side === 'right', JSON.stringify(pf));
    check('…not under the sheet editor any more, and off until a document is loaded', await b.run(pw, `return !document.querySelector('#configurePanel #saveSheetBtn')
        && document.getElementById('saveSheetBtn').disabled && document.getElementById('deleteSheetBtn').disabled;`));

    await b.run(main, `Tools.close();`);

    // ---- DailyWizard's edit mode ----
    const dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    let df = await footer(b, dw, '.tool-root > footer');
    check('DailyWizard locked: only Close Tool in the footer', df.length === 1 && df[0].id === 'closeToolBtn', JSON.stringify(df));
    check('…✏️ Edit tasks stays above the list', await b.run(dw, `return !!document.querySelector('#listContainer #editTasksBtn');`));
    await dwUnlock(b, dw);
    df = await footer(b, dw, '.tool-root > footer');
    check('editing: ✅ Done editing on the left, Close Tool in the middle, + Add Task on the right of the footer',
        by(df, 'doneEditingBtn').side === 'left' && by(df, 'closeToolBtn').side === 'middle' && by(df, 'addTaskBtn').side === 'right' &&
        by(df, 'addTaskBtn').text === '+ Add Task' && by(df, 'doneEditingBtn').text === '✅ Done editing', JSON.stringify(df));
    check('…not above the list any more; who is editing still is', await b.run(dw, `const L = document.getElementById('listContainer');
        return !L.querySelector('#addTaskBtn, #doneEditingBtn') && L.querySelector('.edit-mode-note')?.textContent === '✏️ Editing as Casey';`));
    await b.run(dw, `document.getElementById('addTaskBtn').click();`, { user: true });
    check('+ Add Task opens the task editor for the building shown', await b.run(dw, `return document.getElementById('editorOverlay').classList.contains('open') && editorBuildingId === 'B1' && !editorTaskCode;`));
    await b.run(dw, `closeTaskEditor();`);
    await dwBuilding(b, dw, 'ALL');
    df = await footer(b, dw, '.tool-root > footer');
    check('All Buildings: no + Add Task, ✅ Done editing still there', !by(df, 'addTaskBtn').id && by(df, 'doneEditingBtn').side === 'left', JSON.stringify(df));
    await dwBuilding(b, dw, 'B1');
    const dwActions = await footer(b, dw, '.tool-root > footer');
    await b.run(dw, `document.getElementById('doneEditingBtn').click();`, { user: true });
    df = await footer(b, dw, '.tool-root > footer');
    check('✅ Done editing locks it: only Close Tool again', df.length === 1 && !(await b.run(dw, 'return EditMode.on();')), JSON.stringify(df));
    await b.run(main, `Tools.close();`);

    // ---- One shape ----
    const actions = [by(main1, 'clearFormBtn'), by(main1, 'generateBtn'), by(recipe, 'recipeEditorSaveBtn'), by(pf, 'deleteSheetBtn'), by(pf, 'saveSheetBtn'),
        by(dwActions, 'doneEditingBtn'), by(dwActions, 'addTaskBtn')];
    const mids = [by(main1, 'closeToolBtn'), by(recipe, 'recipeFooterBackBtn'), by(pf, 'closeToolBtn'), by(dwActions, 'closeToolBtn')];
    check('every footer action is the same size in all four', actions.every(a => a.w === actions[0].w && a.h === actions[0].h) && actions[0].h > 30, JSON.stringify(actions.map(a => [a.w, a.h])));
    check('…and Close Tool / ‹ Back the same height', mids.every(m => m.h === actions[0].h), JSON.stringify(mids.map(m => [m.w, m.h])));
    return results;
}
