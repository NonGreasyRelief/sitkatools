// The Room Manager's "Building (assign on day 1)" dropdown lists the buildings of the database that's open. It's
// filled as the page starts, before any database is open, so every database that opens fills it again. A room's own
// detail panel has a Building dropdown too, to assign, move or take it out after the fact (user request 2026-10-29).
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

    // ---- A room's building, changed after the fact in its detail panel (user request 2026-10-29) ----
    await openSitka(b, main, BASE);
    const db = fixtureDb();
    db.rooms.R9 = { name: 'Spare', description: null, createdDate: '2026-10-29', assignedLots: [], buildingId: null };
    await loadSingle(b, main, db);
    const panel = (roomId) => b.run(main, `RoomManager.expandedRoomId = ${JSON.stringify(roomId)}; RoomManager.renderRoomList();
        const sel = document.querySelector('.room-building[data-room-id="${roomId}"]');
        return sel ? { value: sel.value, options: [...sel.options].map(o => o.value) } : null;`);
    const pick = (roomId, bid) => b.run(main, `window.__alerts = []; window.alert = m => window.__alerts.push(m);
        const sel = document.querySelector('.room-building[data-room-id="${roomId}"]'); sel.value = ${JSON.stringify(bid)}; sel.dispatchEvent(new Event('change'));
        const r = DB.data.rooms[${JSON.stringify(roomId)}], after = document.querySelector('.room-building[data-room-id="${roomId}"]');
        return { buildingId: r.buildingId || '', b1: DB.data.buildings.B1.assignedRooms.includes(${JSON.stringify(roomId)}), b2: DB.data.buildings.B2.assignedRooms.includes(${JSON.stringify(roomId)}),
            shown: after?.value ?? null, alerts: window.__alerts, unsaved: hasUnsavedChanges };`);
    let p = await panel('R9');
    check('a room with no building: its panel has a Building dropdown, "— No building assigned —" picked', p?.value === '' && p.options.join() === ',B1,B2', JSON.stringify(p));
    await b.run(main, `clearUnsaved();`);
    let r = await pick('R9', 'B2');
    check('picking Building 2 assigns it (the room and the building both say so), unsaved', r.buildingId === 'B2' && r.b2 && !r.b1 && r.shown === 'B2' && r.unsaved, JSON.stringify(r));
    check('…the Building Manager lists it under Building 2', await b.run(main, `return document.getElementById('buildingList')?.textContent.includes('Spare') ?? true;`));
    r = await pick('R9', 'B1');
    check('picking Building 1 moves it: out of Building 2', r.buildingId === 'B1' && r.b1 && !r.b2, JSON.stringify(r));
    r = await pick('R9', '');
    check('"— No building assigned —" takes it out', r.buildingId === '' && !r.b1 && !r.b2 && r.shown === '', JSON.stringify(r));

    // A room holding a lot locked to its grow log can't change building
    await b.run(main, `DB.data._PaperWizard = { sheets: { glog: { name: 'Grow Log', cadence: 'daily-weekly', document: 'grow-log', fields: [] } }, wizards: {},
        entries: { L100: { glog: { instances: { '2026-10-20': { room: 'Grow 1', header: {}, days: { '2026-10-20': {} } } } } } } }; DB.ensureStructure();`);
    r = await pick('R1G1', 'B2');
    check('a room holding a lot with a grow log: refused, saying why, and the dropdown stays on its building', r.buildingId === 'B1' && r.shown === 'B1' && r.b1 && !r.b2 &&
        /can't be moved to another building: lot L100 is in it, with grow logs/.test(r.alerts[0] || ''), JSON.stringify(r));
    await b.run(main, `clearUnsaved();`);
    return results;
}
