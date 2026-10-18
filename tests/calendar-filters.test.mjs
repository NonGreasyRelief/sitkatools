// SitkaTools calendar filters: the one-click "🔧 Equipment maintenance" combination shows every EquipmentWizard
// event (including one saved without a taskType) and nothing else; a second click clears it.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, leave } from './lib/helpers.mjs';

export const title = 'calendar filters (Equipment maintenance)';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    const db = fixtureDb();
    // A second equipment event that does carry the task type, and one in another room
    db.calendarEvents.push({ id: 'ev_equipb9', date: db.calendarEvents[0].date, title: '❄️ Clean coils — Grow 1', sourceTool: 'EquipmentWizard',
        roomId: 'R1G1', equipmentId: 'eq2', taskId: 't2', taskType: 'equipment_maintenance' });
    await loadSingle(b, main, db);

    const ewIds = db.calendarEvents.filter(e => e.sourceTool === 'EquipmentWizard').map(e => e.id).sort();
    check('the fixture has an equipment event without a taskType', db.calendarEvents.some(e => e.sourceTool === 'EquipmentWizard' && !e.taskType));

    const clickPreset = () => b.run(main, `
        Calendar.openFilterMenu();
        const el = document.querySelector('#filterMenu .filter-preset[data-preset="equipment-maintenance"]');
        if (!el) return 'missing';
        el.click();
        return 'ok';`, { user: true });

    const label = await b.run(main, `Calendar.openFilterMenu(); return document.querySelector('#filterMenu .filter-preset[data-preset="equipment-maintenance"]')?.innerText || null;`);
    check('the menu offers "Equipment maintenance" under Useful Combinations', !!label && label.includes('Equipment maintenance'), label);

    check('clicking it applies the filter', (await clickPreset()) === 'ok');
    const shown = await b.run(main, `return Calendar.filteredEvents().map(e => e.id).sort();`);
    check('it shows every EquipmentWizard event and nothing else', JSON.stringify(shown) === JSON.stringify(ewIds), JSON.stringify(shown));
    const pills = await b.run(main, `return Calendar.filters.map(f => f.key + ':' + f.value);`);
    check('one Task Type pill: Equipment Maintenance', JSON.stringify(pills) === JSON.stringify(['taskType:equipment_maintenance']), JSON.stringify(pills));

    await clickPreset();
    check('a second click clears it', (await b.run(main, `return Calendar.filters.length;`)) === 0);
    await b.run(main, `Calendar.closeFilterMenu();`);
    await leave(b, main);
    return results;
}
