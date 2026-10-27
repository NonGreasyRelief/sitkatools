// A tool can never wipe SitkaTools' database (cost audit 2026-10-26: a tool once sent back an empty database before its own
// had arrived, and SitkaTools took it). The tools now work on SitkaTools' own DB.data in its page (root CLAUDE.md → "Tool
// Overlays"), and what counts is what they change in it:
// - nothing counts before a tool has the database;
// - a tool that swaps in a database of its own (an empty one) changes nothing of SitkaTools': it isn't SitkaTools' database;
// - a change of its own is SitkaTools' change, unsaved; a notify that leaves the database as it was isn't a change.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, saveSingle, openTool, leave } from './lib/helpers.mjs';

export const title = 'a tool can never wipe SitkaTools\' database (no database yet, an empty one of its own, a notify with no change)';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    const lots = () => b.run(main, `return Object.keys(DB.data.lots).sort().join();`);
    const unsaved = () => b.run(main, 'return hasUnsavedChanges;');

    await b.run(main, `Tools.changed('EmployeeWizard'); return null;`);
    check('a tool that hasn\'t got the database (not open) changes nothing', !(await unsaved()) && (await lots()) === 'L100,L200');

    const ew = await openTool(b, main, 'EmployeeWizard');
    check('opening a tool changes nothing by itself', !(await unsaved()));
    check('the tool works on SitkaTools\' own database, not a copy', await b.run(main, `return Tools.defs.EmployeeWizard.run.data === DB.data;`));

    // The old bug: a tool with an empty database of its own says it changed something
    await b.run(ew, `DB.data = { lots: {}, rooms: {}, buildings: {}, calendarEvents: [] }; notifySitkaTools();`);
    check('a tool that swaps in an empty database of its own wipes nothing: lots, rooms and events kept, nothing unsaved',
        (await lots()) === 'L100,L200' && await b.run(main, `return Object.keys(DB.data.rooms).length === 3 && DB.data.calendarEvents.length > 0 && !hasUnsavedChanges;`));

    // Opened again it works on SitkaTools' database, and its change counts
    await b.send('browsingContext.close', { context: ew });
    await b.run(ew, `DB.data._EmployeeWizard.settings = { ...(DB.data._EmployeeWizard.settings || {}), shiftHours: 9 }; notifySitkaTools();`);
    check('a change of its own is SitkaTools\' change, unsaved', await b.run(main, `return DB.data._EmployeeWizard?.settings?.shiftHours === 9 && hasUnsavedChanges;`));

    // Saved: a notify that leaves the database as it was isn't a change
    await saveSingle(b, main);
    const ge = await openTool(b, main, 'GeneralEvent');
    await b.run(ge, `notifySitkaTools();`);
    check('a notify that leaves the database as it was isn\'t a change', !(await unsaved()));
    await leave(b, main);
    return results;
}
