// Saves only count when the file really holds the work (review A6, A7, A8):
// - a change made after the save popup opened keeps the DB unsaved (single file; split files already did);
// - on a tablet, a cancelled share saves nothing (single file and split files);
// - a tool tab's update is ignored until the start check (restore or discard) is done, and Restore takes the copy as
//   it is when tapped.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, splitFiles, openSplit, saveSingle } from './lib/helpers.mjs';

export const title = 'SitkaTools: a save counts only when the file holds the work';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const URL = `${BASE}/SitkaTools/SitkaTools.html`;
    let main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());

    const unsaved = (ctx) => b.run(ctx, `return hasUnsavedChanges;`);
    const rename = (ctx, name) => b.run(ctx, `DB.data.lots.L100.name = ${JSON.stringify(name)}; markUnsaved();`);
    const lastToast = (ctx) => b.run(ctx, `return [...document.querySelectorAll('.sync-toast, #syncToast')].map(t => t.textContent).join(' | ');`);

    // ---- A7: changed while the popup was open ----
    await rename(main, 'Before the save');
    await b.run(main, `document.getElementById('exportBtn').click();`, { user: true });
    const inFile = await b.run(main, `return await (await fetch(document.getElementById('saveLink').href)).text();`);
    await rename(main, 'After the popup opened');
    await b.run(main, `document.getElementById('saveLink').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));`, { user: true });
    check('the file holds the DB as it was when the popup opened', JSON.parse(inFile).lots.L100.name === 'Before the save');
    check('a change made after the popup opened keeps the DB unsaved', await unsaved(main) === true);
    check('…and says so', /changes made after the save started/.test(await lastToast(main)), await lastToast(main));
    await saveSingle(b, main);
    check('saving again clears it', await unsaved(main) === false);
    await rename(main, 'Saved plainly');
    await saveSingle(b, main);
    check('a plain save still clears the flag', await unsaved(main) === false);

    // ---- A6: a tablet share cancelled or done ----
    const tablet = (ctx, outcome) => b.run(ctx, `
        const real = window.matchMedia.bind(window);
        window.matchMedia = q => q.includes('pointer: coarse') ? { matches: true, addEventListener() {}, removeEventListener() {} } : real(q);
        navigator.canShare = () => true;
        navigator.share = () => ${outcome === 'cancel' ? `Promise.reject(new DOMException('cancelled', 'AbortError'))` : `Promise.resolve()`};`);
    await tablet(main, 'cancel');
    await rename(main, 'Tablet change');
    await b.run(main, `document.getElementById('exportBtn').click(); document.getElementById('saveLink').click();`, { user: true });
    await b.sleep(300);
    check('single file: a cancelled share leaves the DB unsaved', await unsaved(main) === true);
    check('…and says the file was not saved', /was not saved — the share was cancelled/.test(await lastToast(main)), await lastToast(main));
    await tablet(main, 'share');
    await b.run(main, `document.getElementById('exportBtn').click(); document.getElementById('saveLink').click();`, { user: true });
    await b.sleep(300);
    check('single file: a completed share saves', await unsaved(main) === false);

    // Split files on a building tablet
    const files = await splitFiles(b, main, BASE, fixtureDb());
    await openSplit(b, main, BASE, 'B1', files);
    await tablet(main, 'cancel');
    await b.run(main, `DB.data._DailyWizard = DB.data._DailyWizard || {}; DB.data._DailyWizard.buildings = DB.data._DailyWizard.buildings || {};
        const bl = DB.data._DailyWizard.buildings.B1 = DB.data._DailyWizard.buildings.B1 || {}; bl.note = 'tablet work'; markUnsaved();`);
    const linkCount = await b.run(main, `document.getElementById('exportBtn').click();
        const links = [...document.querySelectorAll('#saveFileLinks a.save-link')]; links.forEach(a => a.click()); return links.map(a => a.dataset.file);`, { user: true });
    await b.sleep(300);
    check('split: the building tablet offers its own file', linkCount.join() === 'Building-B1.json', linkCount.join());
    check('split: a cancelled share leaves it unsaved, the link not marked saved',
        await unsaved(main) === true && await b.run(main, `return !document.querySelector('#saveFileLinks a.save-link.saved');`));
    await tablet(main, 'share');
    await b.run(main, `document.querySelectorAll('#saveFileLinks a.save-link').forEach(a => a.click());`, { user: true });
    await b.sleep(300);
    check('split: a completed share saves', await unsaved(main) === false);

    // ---- A8: a tool tab writing while SitkaTools starts up ----
    main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    await rename(main, 'Left unsaved');
    await b.waitFor(main, `const c = await WorkCopy.read(); return c?.unsaved && c.db.lots.L100.name === 'Left unsaved';`);
    await b.navigate(main, URL);   // the session is left behind
    await b.waitFor(main, `return !document.getElementById('restoreOverlay').classList.contains('hidden');`, 5000);
    // A tool tab still open from that session writes the copy, as its WorkCopy.write does, and says so
    await b.run(main, `const c = await WorkCopy.read(); c.db.lots.L100.name = 'Written by a tool tab'; c.from = 'PaperWizard';
        await FolderStore._tx('readwrite', s => s.put({ key: 'current', value: c }), 'work');
        WorkCopy.channel.postMessage({ type: 'db-updated', from: 'PaperWizard' });
        await takeToolCopy('PaperWizard');`);
    await b.sleep(300);
    check('while the restore card is up, a tool tab\'s update isn\'t taken in', await b.run(main, `return DB.data?.lots?.L100?.name !== 'Written by a tool tab' && !hasUnsavedChanges && !DB.fileName;`));
    await b.run(main, `document.getElementById('restoreBtn').click();`, { user: true });
    await b.sleep(500);
    const st = await b.run(main, `return { name: DB.data?.lots?.L100?.name, file: DB.fileName, unsaved: hasUnsavedChanges };`);
    check('Restore takes the copy as it is now, with the tool tab\'s change', st.name === 'Written by a tool tab' && st.file === 'DB-26-10-13' && st.unsaved, JSON.stringify(st));

    await b.run(main, `window.onbeforeunload = null; clearUnsaved();`);
    return results;
}
