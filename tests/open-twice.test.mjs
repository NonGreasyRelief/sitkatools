// One tool at a time, one copy of it (review A9/A12): the tools open over SitkaTools in its page (root CLAUDE.md → "Tool
// Overlays"), so none can be open twice, opening another replaces it, and nothing opens a window or tab of its own. A tool's
// old address says where it went.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, newTab, dwBuilding, leave } from './lib/helpers.mjs';

export const title = 'one tool at a time: no tool open twice, no windows or tabs of their own';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    const contexts = (await b.contexts()).length;

    const dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    await b.run(main, `document.querySelector('a.module-link[href*="DailyWizard"]').click();`, { user: true });
    check('clicking the open tool\'s link again: the same DailyWizard, as it was (nothing opened twice, nothing reset)',
        (await b.run(main, `return Tools.current;`)) === 'DailyWizard' && (await b.run(dw, `return document.getElementById('buildingSelect').value;`)) === 'B1');

    await b.run(main, `document.querySelector('a.module-link[href*="PaperWizard"]').click();`, { user: true });
    check('opening another tool closes DailyWizard: one tool at a time', await b.run(main, `return Tools.current === 'PaperWizard'
        && document.querySelectorAll('.tool-overlay:not([hidden])').length === 1 && !document.getElementById('tool-PaperWizard').hidden;`));
    check('…and DailyWizard, closed, leaves nothing on the page', await b.run(main, `return document.querySelector('#tool-DailyWizard > .tool-root').children.length === 0;`));
    check('no window or tab was opened', (await b.contexts()).length === contexts, String((await b.contexts()).length - contexts));

    const old = await newTab(b, `${BASE}/DailyWizard/DailyWizard.html`);
    check('a tool\'s old address says it now lives inside SitkaTools, with a link there',
        await b.run(old, `return document.body.textContent.includes('This tool now lives inside SitkaTools') && !!document.querySelector('a[href="../SitkaTools/SitkaTools.html"]');`));
    await b.send('browsingContext.close', { context: old });
    await leave(b, main);
    return results;
}
