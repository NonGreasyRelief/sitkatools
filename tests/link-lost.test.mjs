// A tool window that outlives SitkaTools (reloaded or closed) says so, instead of looking as if its changes were kept.
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, dwBuilding, logHours, newTab, leave } from './lib/helpers.mjs';

export const title = 'tool windows that lost their link to SitkaTools';

const cover = (b, ctx) => b.run(ctx, `const w = document.getElementById('linkLost');
    return w && w.style.display === 'flex' ? w.querySelector('[data-title]').textContent : null;`);

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today();

    // ---- SitkaTools reloaded while the DailyWizard popup stays open ----
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    const pop = await openTool(b, main, 'DailyWizard');
    await b.run(pop, 'LinkLost.check();');
    await b.sleep(400);
    check('linked popup: checking the link shows nothing', (await cover(b, pop)) === null);

    await openSitka(b, main, BASE);              // F5 on SitkaTools
    await loadSingle(b, main, fixtureDb());      // and the DB loaded again
    await b.run(pop, `window.dispatchEvent(new Event('focus'));`);   // the user comes back to the tool window
    await b.sleep(500);
    check('after a SitkaTools reload: coming back to the popup shows "lost its link"', (await cover(b, pop)) === 'This window lost its link to SitkaTools', await cover(b, pop));
    await b.run(pop, `document.querySelector('#linkLost [data-keep]').click();`);
    check('"Keep it open to look" hides the cover', (await cover(b, pop)) === null);
    await dwBuilding(b, pop, 'B1');
    await logHours(b, pop, 'Water plants', 'Blair', 1, 0);
    await b.sleep(500);
    check('…and a change made anyway says "didn\'t get your last change"', (await cover(b, pop)) === 'SitkaTools didn’t get your last change', await cover(b, pop));
    check('SitkaTools did not take a change from the stale window', (await b.run(main, `return (DB.data._DailyWizard.buildings.B1.labour?.['${T}']?.wat1 || []).length;`)) === 0);
    await leave(b, pop);
    await b.send('browsingContext.close', { context: pop });

    // ---- SitkaTools closed while the popup stays open ----
    const sitka2 = await newTab(b, `${BASE}/SitkaTools/SitkaTools.html`);
    await loadSingle(b, sitka2, fixtureDb());
    const pop2 = await openTool(b, sitka2, 'DailyWizard');
    await leave(b, sitka2);
    await b.send('browsingContext.close', { context: sitka2, promptUnload: false });
    await b.sleep(3500);
    check('after SitkaTools closes: the popup shows "lost its link" by itself', (await cover(b, pop2)) === 'This window lost its link to SitkaTools', await cover(b, pop2));
    await b.run(pop2, `document.querySelector('#linkLost [data-keep]').click();`);
    await dwBuilding(b, pop2, 'B1');
    const r = await logHours(b, pop2, 'Water plants', 'Casey', 0, 30);
    check('…and a change made there says it was not kept', (await cover(b, pop2)) === 'SitkaTools didn’t get your last change', `${r.toast} / ${await cover(b, pop2)}`);
    await leave(b, pop2);
    await b.send('browsingContext.close', { context: pop2 });

    // ---- Other tools get the same cover ----
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    const ew = await openTool(b, main, 'EmployeeWizard');
    const pw = await openTool(b, main, 'PaperWizard');
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    for (const [name, ctx] of [['EmployeeWizard', ew], ['PaperWizard', pw]]) {
        await b.run(ctx, `window.dispatchEvent(new Event('focus'));`);
        await b.sleep(400);
        check(`${name}: shows the cover after a SitkaTools reload`, (await cover(b, ctx)) === 'This window lost its link to SitkaTools');
        await leave(b, ctx);
        await b.send('browsingContext.close', { context: ctx });
    }
    await leave(b, main);
    return results;
}
