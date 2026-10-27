// The tools live in SitkaTools' page as overlays (one file, user decision 2026-10-27; root CLAUDE.md → "Tool Overlays"):
// - the hub's styles and each tool's stay apart (the hub keeps its theme; the bar over a tool is solid);
// - a tool's `document` finds its own elements, SitkaTools' finds its own, even where the ids are the same;
// - a tool works on SitkaTools' database: an event added in GeneralEvent is in it at once, marked unsaved, and on the
//   calendar once ✕ closes the tool (its Close Tool button closes it too);
// - each open starts afresh (nothing typed is left over), and a closed tool does nothing (its timers stop).
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';

export const title = 'tool overlays: scoped styles and lookups, the hub\'s own database, a fresh start on each open, nothing running once closed';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());

    const look = await b.run(main, `const html = getComputedStyle(document.documentElement);
        return { accent: html.getPropertyValue('--accent').trim(), bg: getComputedStyle(document.body).backgroundColor };`);
    check('the hub keeps its theme inside its @scope: its colours on the page, a dark page', look.accent === '#53d8a8' && look.bg === 'rgb(26, 26, 46)', JSON.stringify(look));

    const ge = await openTool(b, main, 'GeneralEvent');
    const bar = await b.run(main, `const bar = document.querySelector('.tool-bar'); return { bg: getComputedStyle(bar).backgroundColor, name: document.getElementById('toolBarName').textContent };`);
    check('the bar over the tool is solid and names it', bar.bg === 'rgb(22, 33, 62)' && bar.name === '📅 General Event', JSON.stringify(bar));
    check('the tool\'s own styles reach it (its text colour on its root)', (await b.run(ge, `return getComputedStyle(document.body).color;`)) === 'rgb(232, 232, 232)');

    const ids = await b.run(ge, `return { tool: !!document.getElementById('statusBar')?.closest('#tool-GeneralEvent'), page: !window.document.getElementById('statusBar')?.closest('.tool-overlay') };`);
    check('a tool\'s document finds its own #statusBar; the page\'s finds SitkaTools\'', ids.tool && ids.page, JSON.stringify(ids));

    const before = await b.run(main, `return DB.data.calendarEvents.length;`);
    await b.run(ge, `document.getElementById('eventText').value = 'Overlay check'; document.getElementById('eventDate').value = '${today(1)}';
        document.getElementById('eventForm').requestSubmit();`, { user: true });
    check('an event added in GeneralEvent is in SitkaTools\' database at once, unsaved',
        await b.run(main, `return DB.data.calendarEvents.length === ${before + 1} && DB.data.calendarEvents.some(e => e.title === '📌 Overlay check') && hasUnsavedChanges;`));
    await b.run(main, `document.getElementById('toolBarClose').click();`, { user: true });
    check('✕ closes it, and the calendar shows the event', await b.run(main, `return document.getElementById('toolHost').hidden && !Tools.current
        && [...document.querySelectorAll('.day-event')].some(e => e.textContent.includes('Overlay check'));`));

    await b.run(ge, `document.getElementById('eventText').value = 'half typed'; return null;`);
    await b.run(ge, `document.getElementById('closeToolBtn').click();`, { user: true });
    check('its own Close Tool button closes it too', await b.run(main, `return !Tools.current;`));
    check('each open starts afresh: nothing typed is left over', (await b.run(ge, `return document.getElementById('eventText').value;`)) === '');

    await b.run(ge, `window.__ticks = 0; setInterval(() => { window.__ticks++; }, 40); return null;`);
    await b.sleep(200);
    await b.run(main, `Tools.close(); window.__closedAt = window.__ticks; return null;`);
    await b.sleep(300);
    const ticks = await b.run(main, `return { at: window.__closedAt, now: window.__ticks };`);
    check('a closed tool does nothing: its timers stop', ticks.at > 0 && ticks.now === ticks.at, JSON.stringify(ticks));
    await leave(b, main);
    return results;
}
