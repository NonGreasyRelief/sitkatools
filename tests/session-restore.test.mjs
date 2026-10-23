// ⚠️ Session closed without saving: SitkaTools keeps the open session in the browser (the shared working copy) and,
// after a flat battery or a closed browser, offers it back on the next start, however old, until it's restored or
// discarded. A save forgets it. Restoring brings back the device and its split files, so a building tablet carries on
// saving its own file. Another SitkaTools tab on the device never offers (or deletes) a session that's open elsewhere.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, saveSingle, splitFiles, openSplit, saveSplit, newTab, leave } from './lib/helpers.mjs';

export const title = 'SitkaTools restores a session closed without saving';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const URL = `${BASE}/SitkaTools/SitkaTools.html`;
    let main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());

    const card = (ctx) => b.run(ctx, `const o = document.getElementById('restoreOverlay');
        return { open: !o.classList.contains('hidden'), title: document.getElementById('restoreTitle').textContent,
            desc: document.getElementById('restoreDesc').textContent,
            offer: !document.getElementById('restoreBtn').classList.contains('hidden') && !document.getElementById('restoreDiscardBtn').classList.contains('hidden'),
            ok: !document.getElementById('restoreOkBtn').classList.contains('hidden') };`);
    const waitCard = (ctx) => b.waitFor(ctx, `return !document.getElementById('restoreOverlay').classList.contains('hidden');`, 5000).then(() => card(ctx)).catch(() => card(ctx));
    const settle = () => b.sleep(1200);   // the start check: read the copy, ask other tabs (400 ms)
    const stored = (ctx) => b.run(ctx, `const c = await WorkCopy.read(); return c ? { unsaved: c.unsaved, at: c.at, name: c.db?.lots?.L100?.name || null, role: c.split?.role || null } : null;`);
    const change = (ctx, name) => b.run(ctx, `DB.data.lots.L100.name = ${JSON.stringify(name)}; markUnsaved();`)
        .then(() => b.waitFor(ctx, `const c = await WorkCopy.read(); return c?.unsaved && c.db.lots.L100.name === ${JSON.stringify(name)};`));
    const stampOf = (t) => { const d = new Date(t), p = v => String(v).padStart(2, '0'); return `${p(d.getMonth() + 1)}/${p(d.getDate())} at ${p(d.getHours())}:${p(d.getMinutes())}`; };
    const setAt = (ctx, at) => b.run(ctx, `const c = await WorkCopy.read(); c.at = ${at}; await FolderStore._tx('readwrite', s => s.put({ key: 'current', value: c }), 'work');`);

    // ---- A browser closed with unsaved work ----
    await change(main, 'Changed once');
    const before = await stored(main);
    check('every change is kept in the browser, marked unsaved', before?.unsaved === true && before.name === 'Changed once', JSON.stringify(before));
    await b.navigate(main, URL);   // closing the page flushes the copy (no save)
    let c = await waitCard(main);
    let at = (await stored(main)).at;
    check('the next start shows "Session closed without saving on MM/DD at HH:MM. Restore session?"',
        c.open && c.offer && c.title === `Session closed without saving on ${stampOf(at)}. Restore session?`, c.title);
    check('…naming the file it came from', c.desc === 'DB-26-10-13', c.desc);
    check('…drawn as a yellow triangle with a black mark', await b.run(main, `const s = document.querySelector('#restoreOverlay .restore-icon');
        return !!s && s.querySelector('path').getAttribute('fill') === '#f5c518' && s.querySelector('rect').getAttribute('fill') === '#111';`));
    await b.run(main, `await WorkCopy.flush();`);
    check('while it asks, nothing writes over the stored session', (await stored(main)).name === 'Changed once');

    // Leaving without answering keeps it for next time
    await b.navigate(main, URL);
    c = await waitCard(main);
    check('closing the page without answering keeps it: offered again', c.open && c.offer && (await stored(main))?.name === 'Changed once', c.title);

    // ---- However old ----
    const old = Date.now() - 3 * 86400000;
    await setAt(main, old);
    await b.navigate(main, URL);
    c = await waitCard(main);
    check('a session from 3 days ago is still offered, with its own date', c.open && c.title.includes(stampOf(old)), c.title);

    // ---- Restore ----
    await b.run(main, `document.getElementById('restoreBtn').click();`, { user: true });
    await b.sleep(500);
    let st = await b.run(main, `return { name: DB.data.lots.L100?.name, unsaved: hasUnsavedChanges, file: DB.fileName,
        card: !document.getElementById('restoreOverlay').classList.contains('hidden'), start: !document.getElementById('dbOverlay').classList.contains('hidden') };`);
    check('Restore brings the session back, unsaved, under its file name', st.name === 'Changed once' && st.unsaved && st.file === 'DB-26-10-13' && !st.card && !st.start, JSON.stringify(st));
    check('…and this tab keeps it in the browser from then on', (await stored(main))?.name === 'Changed once' && (await stored(main)).at > old);

    // ---- A flat battery: nothing runs as the page goes ----
    await change(main, 'Changed twice');
    const lastWrite = (await stored(main)).at;
    await b.run(main, `WorkCopy.wrote = false; window.onbeforeunload = null;`);   // no unload handler gets to run
    await b.sleep(1100);
    await b.navigate(main, URL);
    c = await waitCard(main);
    check('after a flat battery the time shown is the last change', c.open && c.title.includes(stampOf(lastWrite)) && (await stored(main)).name === 'Changed twice', c.title);

    // ---- Discard ----
    await b.run(main, `window.__asked = ''; window.confirm = (q) => { window.__asked = q; return false; };`);
    await b.run(main, `document.getElementById('restoreDiscardBtn').click();`, { user: true });
    const asked = await b.run(main, 'return window.__asked;');
    c = await card(main);
    check('Discard asks first; No keeps the question up', c.open && asked.startsWith(`Discard the session from ${stampOf(lastWrite)}?`), asked);
    await b.run(main, `window.confirm = () => true; document.getElementById('restoreDiscardBtn').click();`, { user: true });
    await b.sleep(300);
    st = await b.run(main, `return { card: !document.getElementById('restoreOverlay').classList.contains('hidden'), start: !document.getElementById('dbOverlay').classList.contains('hidden') };`);
    check('Yes forgets it and leaves the start screen', !st.card && st.start && (await stored(main)) === null, JSON.stringify(st));
    await b.navigate(main, URL);
    await settle();
    check('…and nothing is offered next time', !(await card(main)).open);

    // ---- A save forgets the session ----
    await loadSingle(b, main, fixtureDb());
    await change(main, 'Saved change');
    await saveSingle(b, main);
    check('after a save the copy is marked saved', (await stored(main))?.unsaved === false);
    await b.navigate(main, URL);
    await settle();
    check('closing after a save: nothing offered, and the copy is gone', !(await card(main)).open && (await stored(main)) === null);

    // ---- A tool tab takes a copy however old ----
    await loadSingle(b, main, fixtureDb());
    await change(main, 'Tab copy');
    await setAt(main, Date.now() - 2 * 86400000);
    const tab = await newTab(b, `${BASE}/DailyWizard/DailyWizard.html`);
    await b.waitFor(tab, `return typeof WorkCopy !== 'undefined' && WorkCopy.inUse && !!DB.data?.lots?.L100;`, 6000).catch(() => {});
    check('a DailyWizard tab loads a 2-day-old copy (no 12-hour limit)', await b.run(tab, `return WorkCopy.inUse && DB.data.lots.L100.name === 'Tab copy' && !document.getElementById('openFromSitka');`));
    await b.send('browsingContext.close', { context: tab, promptUnload: false });

    // ---- A second SitkaTools tab on the same device ----
    const second = await newTab(b, URL);
    c = await waitCard(second);
    check('a second SitkaTools tab says it\'s already open elsewhere, and offers nothing', c.open && !c.offer && c.ok && c.title === 'SitkaTools is already open in another tab', JSON.stringify(c));
    await b.run(second, `document.getElementById('restoreOkBtn').click();`, { user: true });
    await b.send('browsingContext.close', { context: second, promptUnload: false });
    await b.sleep(300);
    check('closing that tab doesn\'t delete the first tab\'s session', (await stored(main))?.name === 'Tab copy');

    // Two tabs both asking: restoring in one turns the other's question into "already open"
    await b.run(main, `WorkCopy.wrote = false; window.onbeforeunload = null;`);
    await b.navigate(main, URL);
    await waitCard(main);
    const other = await newTab(b, URL);
    c = await waitCard(other);
    check('two tabs starting together both ask', c.open && c.offer);
    await b.run(main, `document.getElementById('restoreBtn').click();`, { user: true });
    await b.sleep(400);
    c = await card(other);
    check('restoring in one turns the other into "already open in another tab"', c.open && !c.offer && c.title === 'SitkaTools is already open in another tab', c.title);
    await b.send('browsingContext.close', { context: other, promptUnload: false });
    await leave(b, main);

    // ---- A building tablet: restored with its device and files, saves its own file ----
    main = await fresh(b);
    const files = await splitFiles(b, main, BASE, fixtureDb());
    await openSplit(b, main, BASE, 'B1', files);
    await b.run(main, `DB.data._DailyWizard.buildings.B1.tasks[0].name = 'Water plants (restored)'; markUnsaved();`);
    // Written once the start check is done (it waits for other tabs to answer)
    await b.waitFor(main, `const c = await WorkCopy.read(); return c?.unsaved && c.db._DailyWizard.buildings.B1.tasks[0].name === 'Water plants (restored)';`);
    await b.run(main, `WorkCopy.wrote = false; window.onbeforeunload = null;`);
    await b.navigate(main, `${URL}?device=office`);
    c = await waitCard(main);
    check('on a page linked to another device, the card says the session stays Building 1\'s',
        c.open && c.desc === 'Building 1 · Main + 2 building files. This page\'s link is for Office; restoring keeps it as Building 1.', c.desc);
    await b.navigate(main, `${URL}?device=B1`);
    c = await waitCard(main);
    check('the building tablet\'s card names its device and files', c.open && c.desc === 'Building 1 · Main + 2 building files', c.desc);
    await b.run(main, `document.getElementById('restoreBtn').click();`, { user: true });
    await b.sleep(500);
    st = await b.run(main, `return { role: DbSplit.role, active: DbSplit.active, view: DeviceView.building, body: document.body.classList.contains('building-device'),
        name: DB.data._DailyWizard.buildings.B1.tasks[0].name, unsaved: hasUnsavedChanges };`);
    check('restored as Building 1 with its split files', st.role === 'B1' && st.active && st.view === 'B1' && st.body && st.name === 'Water plants (restored)' && st.unsaved, JSON.stringify(st));
    const out = await saveSplit(b, main);
    const bf = JSON.parse(out['Building-B1.json'] || '{}');
    check('it saves its own file with the restored change, and nothing else', Object.keys(out).join() === 'Building-B1.json' && bf._DailyWizard?.buildings?.B1?.tasks?.[0]?.name === 'Water plants (restored)', Object.keys(out).join());
    check('…and the save marks the session saved', (await stored(main))?.unsaved === false);
    await leave(b, main);
    return results;
}
