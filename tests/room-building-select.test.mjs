// The Room Manager's "Building (assign on day 1)" dropdown lists the buildings of the database that's open. It's
// filled as the page starts, before any database is open, so every database that opens fills it again.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, splitFiles, openSplit } from './lib/helpers.mjs';

export const title = 'the room form\'s Building dropdown lists the open database\'s buildings';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    const options = () => b.run(main, `return [...document.getElementById('roomBuildingId').options].map(o => o.value + '=' + o.textContent);`);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    let o = await options();
    check('a single-file DB: both buildings, after "— No building assigned —"', o.join('|') === '=— No building assigned —|B1=Building 1 (B1)|B2=Building 2 (B2)', o.join(' | '));

    // Another DB with other buildings replaces them
    const other = fixtureDb();
    other.buildings = { B9: { name: 'Nursery', description: null, createdDate: '2026-01-01', assignedRooms: [] } };
    for (const r of Object.values(other.rooms)) r.buildingId = null;
    await loadSingle(b, main, other);
    o = await options();
    check('another DB: its buildings only', o.join('|') === '=— No building assigned —|B9=Nursery (B9)', o.join(' | '));

    // Split files opened as the office
    const files = await splitFiles(b, main, BASE, fixtureDb());
    await openSplit(b, main, BASE, 'office', files);
    o = await options();
    check('split files at the office: both buildings', o.map(x => x.split('=')[0]).join() === ',B1,B2', o.join(' | '));

    // Opening the Room Manager tab keeps them (and a building made since)
    await b.run(main, `DB.data.buildings.B3 = { name: 'Building 3', description: null, createdDate: '2026-10-29', assignedRooms: [] };
        document.querySelector('[data-target="room-management"], .tab[data-tab="room-management"]')?.click();`, { user: true });
    o = await options();
    check('the Room Manager tab opened: up to date', o.map(x => x.split('=')[0]).join() === ',B1,B2,B3', o.join(' | '));
    await b.run(main, `clearUnsaved();`);
    return results;
}
