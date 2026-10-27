// 😴 A tablet tab that sleeps or is discarded loses nothing (user request 2026-10-27: DailyWizard stays in front all day on a
// tablet). The tools live in SitkaTools' page (root CLAUDE.md → "Tool Overlays"): one tab, one database, nothing to keep in
// step between tabs. What's left to check:
// - the working copy follows a change made in a tool at once, and says which tool is open;
// - SitkaTools reloaded in the same tab (the browser putting it away to save memory and bringing it back, a pull-to-refresh)
//   restores its session by itself, with the tool that was open;
// - saved, a reload offers nothing and opens no database.
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, saveSingle, openTool, dwBuilding, logHours, leave } from './lib/helpers.mjs';

export const title = 'a tablet tab that sleeps or is discarded loses nothing: the working copy follows the tools, a reload restores the tool too';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today();
    const main = await fresh(b);
    await b.send('browsingContext.setViewport', { context: main, viewport: { width: 800, height: 1280 } });
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    const until = (ctx, body, t = 6000) => b.waitFor(ctx, body, t).then(() => true, () => false);
    const alexIn = db => `(${db}._DailyWizard.buildings.B1.labour?.['${T}']?.wat1 || []).some(e => e.employee === 'Alex')`;

    // DailyWizard in front, hours logged: the working copy has them at once, and says DailyWizard is open
    const dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    const r = await logHours(b, dw, 'Water plants', 'Alex', 0, 40);
    check('hours logged in DailyWizard', r.ok, r.toast);
    check('the working copy has them at once, unsaved, and says DailyWizard is open',
        await until(main, `const c = await WorkCopy.read(); return !!c && c.unsaved && c.tool === 'DailyWizard' && ${alexIn('c.db')};`));

    // Android discards the tab, or someone pulls to refresh: the same tab, reloaded, restores the session by itself
    await b.send('browsingContext.reload', { context: main, wait: 'complete' });
    check('reloaded: the session comes back with no question asked, DailyWizard open again, the hours unsaved',
        await until(main, `return typeof Tools !== 'undefined' && WorkCopy.ready && Tools.current === 'DailyWizard' && hasUnsavedChanges && ${alexIn('DB.data')}
            && document.getElementById('restoreOverlay').classList.contains('hidden');`));
    check('…and DailyWizard works on the restored database', await b.run({ context: main, tool: 'DailyWizard' }, `return ${alexIn('DB.data')};`));

    // Saved: a reload offers nothing and opens no database
    const saved = JSON.parse(await saveSingle(b, main));
    check('the save holds the hours', saved._DailyWizard.buildings.B1.labour[T].wat1.some(e => e.employee === 'Alex'));
    check('…and the working copy says it\'s saved', await until(main, `const c = await WorkCopy.read(); return !!c && c.unsaved === false;`));
    await b.send('browsingContext.reload', { context: main, wait: 'complete' });
    check('saved, then reloaded: nothing offered, no database open, the copy gone', await until(main, `return typeof WorkCopy !== 'undefined' && WorkCopy.ready && !DB.fileName
        && !Tools.current && document.getElementById('restoreOverlay').classList.contains('hidden') && !(await WorkCopy.read());`));
    await b.send('browsingContext.setViewport', { context: main, viewport: null });
    await leave(b, main);
    return results;
}
