// 😴 A tablet tab that sleeps in the background loses nothing (user request 2026-10-27: DailyWizard stays in front all day
// while SitkaTools sleeps behind it). Android freezes background tabs, and a tab that slept may never hear a change another
// tab announced on the channel. Here the announcement is simply left out, and:
// - SitkaTools takes in a tool tab's newer copy when it wakes, and before a save (the popup redrawn with it);
// - SitkaTools never writes over a tool's newer copy: a change made in SitkaTools meanwhile is merged with it;
// - a tool tab takes in SitkaTools' changes when it wakes, and its own write merges with a newer copy instead of replacing it;
//   where both changed the same thing the newer one is kept, and the tool says so;
// - "Go back to SitkaTools to save" is kept in the copy too and resent until SitkaTools answers;
// - SitkaTools reloaded (the browser putting a tab away and bringing it back, a pull-to-refresh) restores its session itself;
// - ♻️ a window that lost SitkaTools hands its changes over: to a SitkaTools still in its window, or to a new one, which
//   restores the whole session (SitkaTools keeps its saved copy while tool windows are open), or, with no session left, adds
//   them to the database once it's opened.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, saveSingle, openTool, newTab, leave } from './lib/helpers.mjs';

export const title = 'a tab that sleeps in the background loses nothing: catch-up, merge, save requests, reload, ♻️ hand-over';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    const until = (ctx, body, t = 6000) => b.waitFor(ctx, body, t).then(() => true, () => false);
    // Wake a tab the way a tablet does: show it again (and give it the focus)
    const wake = async ctx => { await b.send('browsingContext.activate', { context: ctx }).catch(() => {}); await b.run(ctx, `window.dispatchEvent(new Event('focus'));`); };
    // A tool tab writes the shared copy and the news never reaches SitkaTools (its tab was asleep)
    const silentToolWrite = (tab, code) => b.run(tab, `${code}; const ch = WorkCopy.channel; WorkCopy.channel = null; await WorkCopy.write(DB.data); WorkCopy.channel = ch;`);
    // SitkaTools writes the copy and the news never reaches the tool tab
    const silentHubWrite = code => b.run(main, `${code}; markUnsaved(); clearTimeout(WorkCopy._timer); const ch = WorkCopy.channel; WorkCopy.channel = null; await WorkCopy.flush(); WorkCopy.channel = ch;`);
    const dw = (ctx, key) => b.run(ctx, `return DB.data._DailyWizard?.probe?.${key} ?? null;`);

    // ---- The merge itself ----
    const m = await b.run(main, `const base = { a: 1, b: { x: 1, y: 1 }, ev: [{ id: 'e1', n: 1 }, { id: 'e2', n: 1 }], gone: { k: 1 }, tags: ['p'] };
        const mine = { a: 2, b: { x: 2, y: 1 }, ev: [{ id: 'e1', n: 2 }, { id: 'e2', n: 1 }, { id: 'e4', n: 1 }], gone: { k: 2 }, tags: ['p', 'q'] };
        const theirs = { a: 1, b: { x: 1, y: 3 }, ev: [{ id: 'e1', n: 1 }, { id: 'e3', n: 1 }], c: 5, tags: ['r'] };
        return WorkCopy.merge(base, mine, theirs);`);
    check('the merge keeps what each side changed: our a and b.x, their b.y and new c',
        m.db.a === 2 && m.db.b.x === 2 && m.db.b.y === 3 && m.db.c === 5, JSON.stringify(m.db));
    check('…records with an id, one by one: our change to e1 and our new e4, their removal of e2 and their new e3',
        JSON.stringify(m.db.ev) === JSON.stringify([{ id: 'e1', n: 2 }, { id: 'e3', n: 1 }, { id: 'e4', n: 1 }]), JSON.stringify(m.db.ev));
    check('…a removal never wins over a change (they removed `gone`, we changed it: kept), and both changing one value keeps theirs, named',
        m.db.gone?.k === 2 && JSON.stringify(m.db.tags) === '["r"]' && m.clash.slice().sort().join() === 'gone,tags', JSON.stringify({ gone: m.db.gone, tags: m.db.tags, clash: m.clash }));

    // ---- A DailyWizard tab on the shared copy (a tablet) ----
    await b.run(main, `await WorkCopy.flush();`);
    const tab = await newTab(b, `${BASE}/EmployeeWizard/EmployeeWizard.html`);
    check('EmployeeWizard opens as a tab on the shared copy', await until(tab, `return typeof DB !== "undefined" && WorkCopy.inUse && Object.keys(DB.data?.lots || {}).length === 2;`));

    // SitkaTools slept through a tool's change: it takes it in when it wakes
    await silentToolWrite(tab, `DB.data._DailyWizard = { ...(DB.data._DailyWizard || {}), probe: { a: 'ticked while SitkaTools slept' } }`);
    check('the news never came: SitkaTools doesn\'t have the change yet', (await dw(main, 'a')) === null);
    await wake(main);
    check('woken, SitkaTools takes the tool\'s change in (and it\'s unsaved)', await until(main, `return DB.data._DailyWizard?.probe?.a === 'ticked while SitkaTools slept' && hasUnsavedChanges;`));

    // …and before a save: the save popup is redrawn with it
    await silentToolWrite(tab, `DB.data._DailyWizard.probe.b = 'logged just before the save'`);
    await b.run(main, `document.getElementById('exportBtn').click();`, { user: true });
    const saved = await until(main, `const a = document.getElementById('saveLink'); return !!a?.href && (await (await fetch(a.href)).text()).includes('logged just before the save');`);
    check('💾 Save DB takes in a change it slept through before a link is used (the popup is redrawn with it)', saved);
    await b.run(main, `document.getElementById('savePopup').classList.add('hidden');`);

    // SitkaTools never writes over a tool's newer copy: its own change meanwhile is merged with it
    await silentToolWrite(tab, `DB.data._DailyWizard.probe.c = 'hours logged in DailyWizard'`);
    await b.run(main, `DB.data.lots.L200.name = 'Renamed in SitkaTools'; markUnsaved();`);
    check('a change made in SitkaTools while it slept through the tool\'s: both kept, in SitkaTools and in the shared copy',
        await until(main, `const c = await WorkCopy.read(); return DB.data._DailyWizard?.probe?.c === 'hours logged in DailyWizard' && DB.data.lots.L200.name === 'Renamed in SitkaTools'
            && c.db._DailyWizard?.probe?.c === 'hours logged in DailyWizard' && c.db.lots.L200.name === 'Renamed in SitkaTools';`));
    check('…and the tool tab gets SitkaTools\' change too', await until(tab, `return DB.data.lots.L200.name === 'Renamed in SitkaTools';`));

    // The tool tab slept through SitkaTools' change: it takes it in when it wakes
    await silentHubWrite(`DB.data.lots.L200.receivedFrom = 'Nursery while DailyWizard slept'`);
    check('the news never came: DailyWizard doesn\'t have SitkaTools\' change yet', (await b.run(tab, `return DB.data.lots.L200.receivedFrom ?? null;`)) !== 'Nursery while DailyWizard slept');
    await wake(tab);
    check('woken, DailyWizard takes SitkaTools\' change in', await until(tab, `return DB.data.lots.L200.receivedFrom === 'Nursery while DailyWizard slept';`));

    // A tool tab that didn't catch up (its write races SitkaTools'): its write merges, never replaces
    await silentHubWrite(`DB.data.lots.L100.receivedFrom = 'Set in SitkaTools'`);
    await b.run(tab, `DB.data._DailyWizard.probe.e = 'ticked on the stale tab'; await WorkCopy.write(DB.data);`);
    check('a tool tab writing over an older view merges: SitkaTools\' change and the tool\'s both in the copy, and in the tab',
        await until(tab, `const c = await WorkCopy.read(); return c.db.lots.L100.receivedFrom === 'Set in SitkaTools' && c.db._DailyWizard.probe.e === 'ticked on the stale tab'
            && DB.data.lots.L100.receivedFrom === 'Set in SitkaTools';`));
    check('…and SitkaTools has both', await until(main, `return DB.data._DailyWizard?.probe?.e === 'ticked on the stale tab' && DB.data.lots.L100.receivedFrom === 'Set in SitkaTools';`));
    // Both changing the same thing: the newer copy's is kept, and the tool says so
    await b.run(tab, `window.__toasts = []; const t = showToast; showToast = (msg, ...r) => { window.__toasts.push(msg); return t(msg, ...r); };`);
    await silentHubWrite(`DB.data._DailyWizard.probe.f = 'SitkaTools said this'`);
    await b.run(tab, `DB.data._DailyWizard.probe.f = 'DailyWizard said that'; await WorkCopy.write(DB.data);`);
    const clash = await b.run(tab, `return { f: DB.data._DailyWizard.probe.f, toasts: window.__toasts };`);
    check('both changed the same thing: the newer copy\'s is kept and the tool says to check its last change',
        clash.f === 'SitkaTools said this' && clash.toasts.some(t => /changed the same thing as this one at the same moment/.test(t)), JSON.stringify(clash));

    // ---- Go back to SitkaTools to save: kept in the copy too, and resent until SitkaTools answers ----
    await b.run(tab, `const ch = WorkCopy.channel; WorkCopy.channel = null; await WorkCopy.goBackToSave(); WorkCopy.channel = ch;`, { user: true });
    check('the save request is written into the shared copy', await b.run(tab, `const c = await WorkCopy.read(); return !!c.saveRequest && c.saveRequest.from === 'EmployeeWizard' && WorkCopy.saveAsk > 0;`));
    await wake(main);
    check('SitkaTools slept through the request: woken, it finds it in the copy and asks for the save',
        await until(main, `return !document.getElementById('saveRequired')?.classList.contains('hidden') && /Labour & Cost Wizard sent you back to save/.test(document.getElementById('saveRequiredText')?.textContent || '');`));
    await b.run(tab, `WorkCopy.askToSave();`);
    check('…and the tool\'s resent request is answered: it stops asking', await until(tab, `return WorkCopy.saveAsk === 0;`));
    await b.run(main, `SaveRequired.hide();`);
    await leave(b, tab); await b.send('browsingContext.close', { context: tab });

    // ---- Reloaded (the browser putting the tab away to save memory and bringing it back): the session comes back by itself ----
    await b.run(main, `DB.data.lots.L100.name = 'Before the reload'; markUnsaved(); await WorkCopy.flush();`);
    await b.send('browsingContext.reload', { context: main, wait: 'complete' });
    check('reloaded with unsaved changes: the session is restored with no question asked',
        await until(main, `return typeof DB !== 'undefined' && DB.data?.lots?.L100?.name === 'Before the reload' && hasUnsavedChanges && document.getElementById('restoreOverlay')?.classList.contains('hidden') !== false;`));

    // ---- ♻️ A window that lost SitkaTools hands its changes over ----
    let ew = await openTool(b, main, 'EmployeeWizard');
    await b.send('browsingContext.reload', { context: main, wait: 'complete' });   // SitkaTools reloaded under the popup
    await until(main, `return typeof DB !== 'undefined' && !!DB.data && WorkCopy.ready;`);
    await b.run(ew, `DB.data._DailyWizard = { ...(DB.data._DailyWizard || {}), probe: { ...(DB.data._DailyWizard?.probe || {}), g: 'made after SitkaTools reloaded' } }; notifySitkaTools();`);
    check('the popup\'s change can\'t reach the reloaded SitkaTools: the cover offers ♻️ Reopen SitkaTools',
        await until(ew, `const w = document.getElementById('linkLost'); return !!w && w.style.display === 'flex' && !!w.querySelector('[data-reopen]');`));
    await b.run(ew, `document.querySelector('#linkLost [data-reopen]').click();`, { user: true });
    check('♻️ with SitkaTools still in its window: it takes the change in', await until(main, `return DB.data._DailyWizard?.probe?.g === 'made after SitkaTools reloaded' && hasUnsavedChanges;`));
    check('…and the window carries on on the shared copy, cover gone', await until(ew, `return WorkCopy.inUse && document.getElementById('linkLost').style.display === 'none' && !!document.getElementById('workCopyBanner');`));
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });

    // SitkaTools closed with everything saved while the tool window stays open (the user's report, 2026-10-27): it keeps its
    // copy for that window, so ♻️ brings the whole session back in a new SitkaTools — the same file, with the window's change
    const reopen = async () => {
        const before = new Set((await b.contexts()).map(c => c.context));
        await b.run(ew, `document.querySelector('#linkLost [data-reopen]').click();`, { user: true });
        let ctx = null;
        for (let i = 0; i < 50 && !ctx; i++) { await b.sleep(100); ctx = (await b.contexts()).find(c => !before.has(c.context) && c.url.includes('SitkaTools.html'))?.context || null; }
        return ctx;
    };
    let savedText = await saveSingle(b, main);
    ew = await openTool(b, main, 'EmployeeWizard');
    await b.send('browsingContext.close', { context: main });
    check('SitkaTools closed with everything saved and a tool window open: its copy is kept, marked saved, with its file name',
        await until(ew, `const c = await WorkCopy.read(); return !!c && c.unsaved === false && c.from === 'SitkaTools' && c.fileName === 'DB-26-10-13';`),
        JSON.stringify(await b.run(ew, `const c = await WorkCopy.read(); return c && { unsaved: c.unsaved, from: c.from, file: c.fileName };`)));
    await b.run(ew, `DB.data._DailyWizard.probe.h = 'made after SitkaTools closed'; notifySitkaTools();`);
    check('SitkaTools closed: the cover offers ♻️ Reopen SitkaTools', await until(ew, `return document.getElementById('linkLost')?.style.display === 'flex';`));
    let hub = await reopen();
    check('♻️ with SitkaTools closed: a new SitkaTools opens', !!hub);
    if (!hub) return results;
    check('…and restores the whole session by itself: the same file and its lots, with the window\'s change, marked unsaved',
        await until(hub, `return typeof WorkCopy !== 'undefined' && WorkCopy.ready && DB.fileName === 'DB-26-10-13' && Object.keys(DB.data.lots).length === 2 &&
            DB.data._DailyWizard?.probe?.h === 'made after SitkaTools closed' && DB.data._DailyWizard.probe.g === 'made after SitkaTools reloaded' &&
            hasUnsavedChanges && !WorkCopy.pendingHandover && document.getElementById('restoreOverlay').classList.contains('hidden');`),
        JSON.stringify(await b.run(hub, `return { ready: WorkCopy.ready, pending: !!WorkCopy.pendingHandover, file: DB.fileName || null, lots: Object.keys(DB.data?.lots || {}).length, h: DB.data?._DailyWizard?.probe?.h || null };`)));
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });

    // No session left: a SitkaTools that didn't open the window (reloaded since, its window list empty) closes with everything
    // saved and forgets its copy. A new SitkaTools adds the window's changes to the database once it's opened (asked first)
    savedText = await saveSingle(b, hub);
    ew = await openTool(b, hub, 'EmployeeWizard');
    await b.run(hub, `openSubtools = []; window.onbeforeunload = null;`);
    await b.send('browsingContext.close', { context: hub });
    check('…a SitkaTools closed with everything saved and no tool window of its own open still forgets its copy',
        await until(ew, `return (await WorkCopy.read()) === null;`));
    await b.run(ew, `DB.data._DailyWizard.probe.i = 'made after a SitkaTools that had lost this window closed'; notifySitkaTools();`);
    check('…the cover offers ♻️ Reopen SitkaTools', await until(ew, `return document.getElementById('linkLost')?.style.display === 'flex';`));
    hub = await reopen();
    check('♻️ with no session left: a new SitkaTools opens', !!hub);
    if (hub) {
        const st = await until(hub, `return typeof WorkCopy !== 'undefined' && WorkCopy.ready && !!WorkCopy.pendingHandover && !DB.fileName;`);
        check('…which has no session to restore, so it says to open the database (the changes are kept for it)', st,
            JSON.stringify(await b.run(hub, `return { ready: WorkCopy.ready, pending: !!WorkCopy.pendingHandover, file: DB.fileName || null, data: !!DB.data, hash: location.hash };`)));
        await b.run(hub, `window.confirm = () => true;`);
        await b.run(hub, `return loadDbFromText(${JSON.stringify(savedText)}, 'DB-26-10-27.json');`);
        check('…opened, it adds them to the database (asked first), marked unsaved',
            await until(hub, `return DB.data._DailyWizard?.probe?.i === 'made after a SitkaTools that had lost this window closed' && DB.data._DailyWizard.probe.h === 'made after SitkaTools closed' && hasUnsavedChanges && !WorkCopy.pendingHandover;`));
        await leave(b, hub);
    }
    await leave(b, ew);
    return results;
}
