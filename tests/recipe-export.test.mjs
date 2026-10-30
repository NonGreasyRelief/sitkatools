// CropLabourWizard's recipe ⬇️ Export (user report 2026-10-29: it appeared broken): the recipe file is offered as a link
// in a dialog — click it to download, or right-click → Save Link As… — like 💾 Save DB, instead of a download started by
// the code, which PCs that block downloads dropped while the toast said it was saved.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool } from './lib/helpers.mjs';

export const title = 'recipe ⬇️ Export offers the file as a link to click or Save Link As…';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    const clw = await openTool(b, main, 'CropLabourWizard');
    await b.run(clw, `openRecipeManager();`, { user: true });
    const dialog = () => b.run(clw, `const d = document.getElementById('recipeSaveAsk'), a = document.getElementById('recipeSaveLink');
        return { open: !d.hidden, link: a.textContent, file: a.download, href: a.getAttribute('href') || '', text: document.getElementById('recipeSaveText').textContent };`);

    // The toolbar's ⬇️ Export: the recipe picked on the main screen
    await b.run(clw, `document.getElementById('exportRecipeBtn').click();`, { user: true });
    let d = await dialog();
    check('⬇️ Export opens a dialog with the file as a link', d.open && d.link === '💾 recipe-sitka-9week.json' && d.file === 'recipe-sitka-9week.json' && /^blob:/.test(d.href), JSON.stringify(d));
    const json = await b.run(clw, `return JSON.parse(await (await fetch(document.getElementById('recipeSaveLink').href)).text());`);
    check('…the link holds the whole recipe', json?.id === 'sitka-9week' && Array.isArray(json.tasks) && json.tasks.length === 33, JSON.stringify({ id: json?.id, tasks: json?.tasks?.length }));
    check('…nothing is downloaded until the link is used', await b.run(clw, `return !document.getElementById('toast').classList.contains('show') || !/saved as/.test(document.getElementById('toast').textContent);`));
    await b.run(clw, `const stop = e => e.preventDefault(); window.addEventListener('click', stop, true); document.getElementById('recipeSaveLink').click(); window.removeEventListener('click', stop, true);`, { user: true });
    check('clicking the link downloads it and says so', await b.run(clw, `return document.getElementById('toast').textContent;`) === 'Recipe saved as recipe-sitka-9week.json');
    await b.run(clw, `document.getElementById('recipeSaveClose').click();`, { user: true });
    d = await dialog();
    check('Close: the dialog goes, and its file with it', !d.open && !d.href, JSON.stringify(d));

    // A row's ⬇️ Export
    await b.run(clw, `[...document.querySelectorAll('#recipeList .recipe-row, #recipeList > *')].find(r => r.textContent.includes('Sitka Default'))
        ?.querySelector('button[title="Download as .json"]').click();`, { user: true });
    d = await dialog();
    check('a recipe row\'s ⬇️ Export: that recipe', d.open && d.file === 'recipe-sitka-mother.json', JSON.stringify(d));
    await b.keys(clw, '');   // Esc
    await b.sleep(150);
    check('Esc closes the dialog, and only the dialog', !(await dialog()).open && await b.run(clw, `return document.getElementById('recipeManagerOverlay').classList.contains('open');`));
    await b.run(main, `Tools.close(); clearUnsaved();`);
    return results;
}
