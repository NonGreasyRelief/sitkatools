// 💾 Save DB with split files offers every file this device may save, changed or not (user request 2026-10-26),
// and the office may save again the building files its own split just made, until the files are reopened.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openSplit, saveSplit, leave } from './lib/helpers.mjs';

export const title = 'save without changes: every savable file is offered, the split\'s building files can be saved again';

// The popup's links after 💾 Save DB: [{ file, unchanged }], plus any note and alert
const popup = (b, ctx) => b.run(ctx, `
    window.__alerts = []; window.alert = m => window.__alerts.push(m);
    document.getElementById('exportBtn').click();
    return { links: [...document.querySelectorAll('#saveFileLinks a.save-link')].map(a => ({ file: a.dataset.file, unchanged: a.classList.contains('unchanged') })),
        note: document.querySelector('#saveFileLinks .save-note')?.textContent || '', none: /Nothing to save/.test(document.getElementById('saveFileLinks').textContent),
        folder: document.getElementById('saveToFolderBtn')?.textContent || '', alerts: window.__alerts, unsaved: hasUnsavedChanges };`, { user: true });
// Use one link (a right-click, as Save Link As… does) → the file's text
const useLink = (b, ctx, file) => b.run(ctx, `
    const a = [...document.querySelectorAll('#saveFileLinks a.save-link')].find(a => a.dataset.file === ${JSON.stringify(file)});
    const text = await (await fetch(a.href)).text();
    a.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    return text;`, { user: true });
const names = p => p.links.map(l => l.file + (l.unchanged ? ' (no changes)' : '')).join(', ');

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE, 'office');
    await loadSingle(b, main, fixtureDb());

    // ---- The first split: only Main and Wages saved from its popup ----
    const files = await b.run(main, `
        window.alert = () => {}; window.confirm = () => true;
        await DbSplit.splitLegacy();
        const out = {};
        for (const a of document.querySelectorAll('#saveFileLinks a.save-link')) out[a.dataset.file] = await (await fetch(a.href)).text();
        return out;`, { user: true });
    check('the split offers all four files', Object.keys(files).sort().join() === 'Building-B1.json,Building-B2.json,Main.json,Wages.json', Object.keys(files).join());
    await useLink(b, main, 'Main.json');
    await useLink(b, main, 'Wages.json');
    await b.run(main, `closeSavePopup();`);
    let p = await popup(b, main);
    check('Save DB again: the building files the split made are still offered to the office', names(p) === 'Building-B1.json, Building-B2.json, Main.json (no changes), Wages.json (no changes)', names(p));
    check('…with nothing said to be lost', p.alerts.length === 0, p.alerts.join(' | '));
    check('…and still unsaved until they are saved', p.unsaved === true);
    const b1 = await useLink(b, main, 'Building-B1.json');
    await useLink(b, main, 'Building-B2.json');
    let state = await b.run(main, `return { unsaved: hasUnsavedChanges };`);
    check('saving the two building files leaves nothing unsaved', state.unsaved === false);
    check('…and the file holds the building\'s task list', JSON.parse(b1)._DailyWizard?.buildings?.B1?.tasks?.length === 2);
    await b.run(main, `closeSavePopup();`);
    p = await popup(b, main);
    check('a Save As that went wrong can be done again: every file, no changes', names(p) === 'Main.json (no changes), Wages.json (no changes), Building-B1.json (no changes), Building-B2.json (no changes)', names(p));
    const again = JSON.parse(await useLink(b, main, 'Main.json'));
    check('…the same Main.json, one revision on', again._meta.revision === JSON.parse(files['Main.json'])._meta.revision + 1 &&
        JSON.stringify({ ...again, _meta: 0 }) === JSON.stringify({ ...JSON.parse(files['Main.json']), _meta: 0 }), JSON.stringify(again._meta));
    state = await b.run(main, `closeSavePopup(); return { unsaved: hasUnsavedChanges, ws: JSON.stringify(DbSplit.exportState().madeHere) };`);
    check('…and saving it again marks nothing unsaved', state.unsaved === false);
    check('the split\'s building files travel with the shared copy (restoring a session keeps them)', state.ws === '["Building-B1.json","Building-B2.json"]', state.ws);
    const restored = await b.run(main, `const s = DbSplit.exportState(); delete s.madeHere; s.loaded = [...s.loaded]; const h = { ...s.hashes }; delete h['Building-B2.json']; s.hashes = h;
        DbSplit.importState(s); return [...DbSplit.madeHere].join();`);
    check('…and a copy from before this change counts the building files it never saved', restored === 'Building-B2.json', restored);

    // ---- Reopened on the office: building files go back to their own devices ----
    const disk = { 'Main.json': files['Main.json'], 'Wages.json': files['Wages.json'], 'Building-B1.json': b1, 'Building-B2.json': files['Building-B2.json'] };
    const set = { main: { name: 'Main.json', text: disk['Main.json'] }, wages: { name: 'Wages.json', text: disk['Wages.json'] },
        buildings: ['Building-B1.json', 'Building-B2.json'].map(name => ({ name, text: disk[name] })), folder: null };
    await b.run(main, `closeSavePopup(); await DbSplit.open(${JSON.stringify(set)});`);
    p = await popup(b, main);
    check('reopened in the same page: the office is offered Main and Wages, not the building files', names(p) === 'Main.json (no changes), Wages.json (no changes)', names(p));
    await b.run(main, `closeSavePopup();`);
    await openSplit(b, main, BASE, 'office', disk);
    p = await popup(b, main);
    check('reopened with no changes: the office is offered Main and Wages, not the building files', names(p) === 'Main.json (no changes), Wages.json (no changes)' && !p.none, names(p));
    await b.run(main, `closeSavePopup(); DB.data.lots.L100.name = 'Renamed'; markUnsaved();`);
    p = await popup(b, main);
    check('a change: Main comes first, Wages is still offered', names(p) === 'Main.json, Wages.json (no changes)', names(p));
    await useLink(b, main, 'Main.json');
    state = await b.run(main, `return { unsaved: hasUnsavedChanges };`);
    check('…and saving only the changed file is the whole save', state.unsaved === false);
    await b.run(main, `closeSavePopup();`);
    await openSplit(b, main, BASE, 'office', { 'Main.json': files['Main.json'] });
    p = await popup(b, main);
    check('without Wages.json open, only Main.json is offered', names(p) === 'Main.json (no changes)', names(p));
    await b.run(main, `closeSavePopup();`);

    // ---- Folder mode: with nothing changed, the folder button saves every file again ----
    await openSplit(b, main, BASE, 'office', disk);
    const folder = await b.run(main, `
        const written = [];
        DbFolder.active = true; DbFolder.handle = { name: 'Shared', getFileHandle: async () => { throw new Error('none'); } };
        DbFolder.ensurePermission = async () => true; DbFolder.writeFile = async (dir, name) => { written.push(name); };
        document.getElementById('exportBtn').click();
        const label = document.getElementById('saveToFolderBtn').textContent;
        document.getElementById('saveToFolderBtn').click();
        await new Promise(r => setTimeout(r, 300));
        DbFolder.active = false; DbFolder.handle = null;
        return { label, written };`, { user: true });
    check('folder: with no changes the button saves Main and Wages again', /Save 2 files to "Shared" \(no changes\)/.test(folder.label) && folder.written.join() === 'Main.json,Wages.json', JSON.stringify(folder));

    // ---- A building device ----
    await openSplit(b, main, BASE, 'B1', { 'Main.json': files['Main.json'], 'Building-B1.json': b1 });
    p = await popup(b, main);
    check('a building with no changes is offered its own file', names(p) === 'Building-B1.json (no changes)' && !p.note, names(p));
    await b.run(main, `closeSavePopup();`);
    await openSplit(b, main, BASE, 'B1', { 'Main.json': files['Main.json'] });
    p = await popup(b, main);
    check('a building that opened Main.json without its file is told to open it', p.links.length === 0 && /Building-B1\.json wasn't opened — open it together with Main\.json/.test(p.note), JSON.stringify(p));
    await b.run(main, `closeSavePopup();`);

    // The tests' save helper takes only the changed files
    await openSplit(b, main, BASE, 'B1', { 'Main.json': files['Main.json'], 'Building-B1.json': b1 });
    let saved = await saveSplit(b, main);
    check('the tests\' save helper: nothing changed, nothing taken', Object.keys(saved).length === 0, Object.keys(saved).join());
    await b.run(main, `closeSavePopup(); DB.data._DailyWizard.buildings.B1.note = 'tablet work'; markUnsaved();`);
    saved = await saveSplit(b, main);
    check('…a change: the building saves only its own file', Object.keys(saved).join() === 'Building-B1.json', Object.keys(saved).join());
    await leave(b, main);
    return results;
}
