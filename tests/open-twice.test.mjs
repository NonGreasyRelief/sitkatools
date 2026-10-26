// The same tool open twice (review A9/A12, user decision 2026-10-26): two windows of one tool would each hold a copy
// of the database and undo each other's changes. SitkaTools' tool link switches to the window already open; a second
// window or tab of a tool covers itself ("already open in another window — close this one"), and the cover lifts if
// the other one closes.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, newTab, leave } from './lib/helpers.mjs';

export const title = 'a tool open twice: the second window says to use the first';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());

    // ---- SitkaTools: the link switches to the open window ----
    const dw = await openTool(b, main, 'DailyWizard');
    const before = (await b.contexts()).length;
    await b.run(main, `document.querySelector('a.module-link[href*="DailyWizard"]').click();`, { user: true });
    await b.sleep(800);
    const toast = await b.run(main, `return document.getElementById('syncToastText').textContent;`);
    check('clicking DailyWizard\'s link again opens no second window', (await b.contexts()).length === before, String((await b.contexts()).length - before));
    check('…and says to use the one already open', toast.includes('already open'), toast);
    const covered = ctx => b.run(ctx, `const w = document.getElementById('openTwice'); return !!w && w.style.display !== 'none';`);
    check('the open window isn\'t covered', !(await covered(dw)));
    await leave(b, dw); await b.send('browsingContext.close', { context: dw });

    // ---- Two tabs of the same tool (a tablet) ----
    await b.run(main, 'await WorkCopy.flush();');
    const t1 = await newTab(b, `${BASE}/PaperWizard/PaperWizard.html`);
    await b.sleep(500);
    const t2 = await newTab(b, `${BASE}/PaperWizard/PaperWizard.html`);
    await b.waitFor(t2, `const w = document.getElementById('openTwice'); return !!w && w.style.display !== 'none';`, 3000).catch(() => {});
    check('a second PaperWizard tab covers itself', await covered(t2));
    const text = await b.run(t2, `return document.getElementById('openTwice').textContent;`);
    check('…saying it\'s already open and to close this one', text.includes('PaperWizard is already open in another window') && text.includes('Close this one'), text);
    check('the first tab isn\'t covered', !(await covered(t1)));
    const other = await newTab(b, `${BASE}/DailyWizard/DailyWizard.html`);
    await b.sleep(800);
    check('another tool\'s tab isn\'t covered', !(await covered(other)));
    await leave(b, t1); await b.send('browsingContext.close', { context: t1, promptUnload: false });
    await b.waitFor(t2, `const w = document.getElementById('openTwice'); return !w || w.style.display === 'none';`, 3000).catch(() => {});
    check('when the first tab closes, the second one\'s cover lifts', !(await covered(t2)));
    for (const c of [t2, other]) { await leave(b, c); await b.send('browsingContext.close', { context: c, promptUnload: false }); }
    await leave(b, main);
    return results;
}
