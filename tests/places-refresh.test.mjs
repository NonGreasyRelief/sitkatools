// Every room and building dropdown follows a change at once, on every tab, with no reload (user bug 2026-10-30: a room
// made, then a building made and the room put in it, wasn't offered to the lots in the Lot Manager until the database
// was loaded again). Walked through with the real forms and buttons: a room made, a building made, the room assigned
// to it from the building's panel, a lot given the room in the Lot Manager; then a lot assigned from a room's panel, a
// building and a room deleted, and the Lot Manager tab redrawing what changed behind it.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle } from './lib/helpers.mjs';

export const title = 'room and building dropdowns follow every change, with no reload';

// What every dropdown offers now: the lot form's five room dropdowns, each lot's room dropdowns in the Lot Manager,
// the room form's Building dropdown, each room's Building dropdown, each building's room picker, each room's lot picker
const READ = `const opts = sel => sel ? [...sel.options].map(o => o.value).filter(Boolean) : null;
    const lotRoom = (lot, field) => document.querySelector('.lot-room-select[data-lot-id="' + lot + '"][data-room-field="' + field + '"]');
    return {
        form: Object.fromEntries(['destRoom', 'vegRoom', 'cloningRoom', 'dryRoom', 'trimRoom'].map(id => [id, opts(document.getElementById(id))])),
        lotDest: { L100: opts(lotRoom('L100', 'destRoom')), L200: opts(lotRoom('L200', 'destRoom')) },
        lotDestValue: { L100: lotRoom('L100', 'destRoom')?.value ?? null, L200: lotRoom('L200', 'destRoom')?.value ?? null },
        lotDry: opts(lotRoom('L100', 'dryRoom')),
        roomFormBuilding: opts(document.getElementById('roomBuildingId')),
        roomBuilding: Object.fromEntries([...document.querySelectorAll('.room-building')].map(s => [s.dataset.roomId, { value: s.value, options: opts(s) }])),
        buildingPicker: Object.fromEntries([...document.querySelectorAll('[id^="unassigned-room-select-"]')].map(s => [s.id.replace('unassigned-room-select-', ''), opts(s)])),
        buildingList: document.getElementById('buildingList')?.textContent.replace(/\\s+/g, ' ') || '',
        roomList: document.getElementById('roomList')?.textContent.replace(/\\s+/g, ' ') || ''
    };`;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    const tab = id => b.run(main, `document.querySelector('.tab[data-tab="${id}"]').click();`, { user: true });
    const quiet = `window.__alerts = []; window.alert = m => window.__alerts.push(m); window.confirm = () => true;`;
    const has = (list, v) => Array.isArray(list) && list.includes(v);

    // ---- 1. A room made in the Room Manager, with no building ----
    await tab('room-management');
    await b.run(main, `${quiet}
        const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input')); };
        set('roomId', 'R3G1'); set('roomName', 'Grow 9');
        document.getElementById('createRoomBtn').click();`, { user: true });
    let v = await b.run(main, READ);
    check('the room is made, with no building', await b.run(main, `return !!DB.data.rooms.R3G1 && !DB.data.rooms.R3G1.buildingId;`));
    check('…the new-lot form\'s five room dropdowns offer it', Object.values(v.form).every(o => has(o, 'Grow 9')), JSON.stringify(v.form));
    check('…and each lot\'s room dropdowns in the Lot Manager, with no reload', has(v.lotDest.L100, 'Grow 9') && has(v.lotDest.L200, 'Grow 9') && has(v.lotDry, 'Grow 9'), JSON.stringify([v.lotDest, v.lotDry]));
    check('…and each building\'s room picker', has(v.buildingPicker.B1, 'R3G1') && has(v.buildingPicker.B2, 'R3G1'), JSON.stringify(v.buildingPicker));

    // ---- 2. A building made in the Building Manager ----
    await b.run(main, `${quiet}
        const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input')); };
        set('buildingId', 'B3'); set('buildingName', 'Building 3');
        document.getElementById('createBuildingBtn').click();`, { user: true });
    v = await b.run(main, READ);
    check('the building is made', await b.run(main, `return !!DB.data.buildings.B3;`));
    check('…the room form\'s Building dropdown offers it', has(v.roomFormBuilding, 'B3'), JSON.stringify(v.roomFormBuilding));
    check('…and every room\'s own Building dropdown, the new room\'s included', ['R1G1', 'R1CL', 'R2G1', 'R3G1'].every(id => has(v.roomBuilding[id]?.options, 'B3')), JSON.stringify(v.roomBuilding));
    check('…and it has a room picker offering the new room', has(v.buildingPicker.B3, 'R3G1'), JSON.stringify(v.buildingPicker));

    // ---- 3. The room assigned to it from the building's panel ----
    await b.run(main, `${quiet} const sel = document.getElementById('unassigned-room-select-B3'); sel.value = 'R3G1';
        document.getElementById('assign-room-btn-B3').click();`, { user: true });
    v = await b.run(main, READ);
    check('the room is in Building 3 (the room and the building both say so)', await b.run(main, `return DB.data.rooms.R3G1.buildingId === 'B3' && DB.data.buildings.B3.assignedRooms.includes('R3G1');`));
    check('…the room\'s own Building dropdown shows Building 3', v.roomBuilding.R3G1?.value === 'B3', JSON.stringify(v.roomBuilding.R3G1));
    check('…no building\'s picker offers it any more', !Object.values(v.buildingPicker).some(o => has(o, 'R3G1')), JSON.stringify(v.buildingPicker));

    // ---- 4. The Lot Manager: a lot given the new room, which puts it in Building 3 ----
    await tab('lot-management');
    v = await b.run(main, READ);
    check('the Lot Manager offers the room to every lot', has(v.lotDest.L100, 'Grow 9') && has(v.lotDest.L200, 'Grow 9'), JSON.stringify(v.lotDest));
    await b.run(main, `${quiet} const sel = document.querySelector('.lot-room-select[data-lot-id="L100"][data-room-field="destRoom"]'); sel.value = 'Grow 9'; sel.dispatchEvent(new Event('change'));`, { user: true });
    v = await b.run(main, READ);
    const lot = await b.run(main, `return { dest: DB.data.lots.L100.destRoom, inR3: DB.data.rooms.R3G1.assignedLots.includes('L100'), inR1: DB.data.rooms.R1G1.assignedLots.includes('L100'),
        building: Calendar._resolveEventValues(DB.data.calendarEvents.find(e => e.id === 'ev_cropb1')).building };`);
    check('L100 is given Grow 9: its flower room, in the room\'s lots, out of Grow 1', lot.dest === 'Grow 9' && lot.inR3 && !lot.inR1 && v.lotDestValue.L100 === 'Grow 9', JSON.stringify([lot, v.lotDestValue]));
    check('…the Room Manager lists it in Grow 9 at once', /Grow 9[^]*L100/.test(v.roomList), v.roomList.slice(0, 300));
    check('…and the calendar puts its tasks in Building 3', lot.building === 'Building 3 (B3)', JSON.stringify(lot));

    // ---- 5. A lot assigned from a room's panel: the Lot Manager follows ----
    await b.run(main, `${quiet} RoomManager.assignLotToRoom('L200', 'R3G1');`);
    v = await b.run(main, READ);
    check('L200 assigned to Grow 9 from the Room Manager: its Lot Manager dropdown shows Grow 9', v.lotDestValue.L200 === 'Grow 9', JSON.stringify(v.lotDestValue));

    // ---- 6. A building deleted: every Building dropdown loses it ----
    await tab('room-management');
    await b.run(main, `${quiet} BuildingManager.deleteBuilding('B3');`);
    v = await b.run(main, READ);
    check('Building 3 deleted: gone from the room form and every room\'s Building dropdown, Grow 9 shows no building',
        !has(v.roomFormBuilding, 'B3') && !Object.values(v.roomBuilding).some(x => has(x.options, 'B3')) && v.roomBuilding.R3G1?.value === '', JSON.stringify([v.roomFormBuilding, v.roomBuilding.R3G1]));
    check('…and Grow 9 is offered to the other buildings again', has(v.buildingPicker.B1, 'R3G1') && has(v.buildingPicker.B2, 'R3G1'), JSON.stringify(v.buildingPicker));

    // ---- 7. A room deleted: the lots that used it lose it, in the Lot Manager too ----
    await b.run(main, `${quiet} RoomManager.deleteRoom('R3G1');`);
    v = await b.run(main, READ);
    check('Grow 9 deleted: no dropdown offers it, and L100 and L200 show no flower room',
        !Object.values(v.form).some(o => has(o, 'Grow 9')) && !has(v.lotDest.L100, 'Grow 9') && v.lotDestValue.L100 === '' && v.lotDestValue.L200 === '', JSON.stringify([v.lotDest, v.lotDestValue]));

    // ---- 8. Opening the Lot Manager tab redraws its dropdowns from the rooms as they are ----
    await b.run(main, `DB.data.rooms.R9 = { name: 'Spare', description: null, createdDate: '2026-10-30', assignedLots: [], buildingId: 'B1' };`);
    await tab('lot-management');
    v = await b.run(main, READ);
    check('a room added behind the Lot Manager\'s back is offered once its tab opens', has(v.form.destRoom, 'Spare') && has(v.lotDest.L100, 'Spare'), JSON.stringify([v.form.destRoom, v.lotDest.L100]));

    await b.run(main, `clearUnsaved();`);
    return results;
}
