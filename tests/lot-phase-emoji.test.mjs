// The phase emoji in front of every lot dropdown (lotPhaseEmoji, one function every tool calls): ✂️ for a lot whose
// current daily log is its trim log, 🍂 for its drying log, 🍂 when its current room is designated Dry/Trim (user request
// 2026-10-29: a lot in the dry room still staged "flower" showed 🌸), else by its stage.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool } from './lib/helpers.mjs';

export const title = 'lot dropdowns: 🍂 for a lot in a Dry/Trim room';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    const db = fixtureDb();
    db.rooms.R1DT = { name: 'Dry 1', description: null, createdDate: '2026-01-01', assignedLots: [], buildingId: 'B1', designation: 'Dry/Trim' };
    db.buildings.B1.assignedRooms.push('R1DT');
    db.lots.L100.currentRoom = 'Dry 1';   // moved into the dry room, still staged "flower"
    await loadSingle(b, main, db);
    const clw = await openTool(b, main, 'CropLabourWizard');
    const option = (id) => b.run(clw, `return [...document.getElementById('activeLot').options].find(o => o.value === ${JSON.stringify(id)})?.textContent || '';`);
    check('CropLabourWizard: a lot in a Dry/Trim room shows 🍂, though its stage is "flower"', (await option('L100')).startsWith('🍂 L100'), await option('L100'));
    check('…a lot in a flower room still shows 🌸', (await option('L200')).startsWith('🌸 L200'), await option('L200'));
    const emoji = (code) => b.run(main, code + `; return lotPhaseEmoji('L100');`);
    check('its trim log started: ✂️ (the trim log comes first)', await emoji(`DB.data._PaperWizard = { sheets: { tlog: { name: 'Trim Log', cadence: 'daily-weekly', document: 'trim-log', fields: [] } }, wizards: {},
        entries: { L100: { tlog: { instances: { '2026-10-28': { room: 'Dry 1', header: {}, days: { '2026-10-28': {} } } } } } } }`) === '✂️');
    check('the room no longer Dry/Trim (and no logs): back to its stage, 🌸', await emoji(`DB.data._PaperWizard = { sheets: {}, wizards: {}, entries: {} }; DB.data.rooms.R1DT.designation = null`) === '🌸');
    check('…a room name matches whatever its case or spaces', await emoji(`DB.data.rooms.R1DT.designation = 'Dry/Trim'; DB.data.lots.L100.currentRoom = '  dry 1 '`) === '🍂');
    await b.run(main, `Tools.close(); clearUnsaved();`);
    return results;
}
