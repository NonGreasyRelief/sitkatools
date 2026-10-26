// SitkaTools' 🌱 Lots — moves and close-out card (Data & Files) follows the DB without a reload: a new lot shows in its
// list, a redraw keeps the picked lot, and the moves on their way are listed (read only: no Send, no Accept), with
// building names that follow a rename.
import { fixtureDb, makeChecker, fresh, splitFiles, openSplit, leave } from './lib/helpers.mjs';

export const title = 'SitkaTools lot move lists follow new lots without a reload';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const db = fixtureDb();
    db.buildings.B3 = { name: 'Building 3', description: null, createdDate: '2026-01-01', assignedRooms: ['R3DR'] };
    db.rooms.R3DR = { name: 'Dry 3', description: null, createdDate: '2026-01-01', assignedLots: [], isFlowering: false, buildingId: 'B3' };
    // L200 has a page in Building 2's file, so moving it elsewhere puts it on its way there
    db._PaperWizard = { sheets: { prop: { name: 'Propagation', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'one-shot', document: 'propagation', fields: [], signature: null } },
        wizards: {}, entries: { L200: { prop: { instances: { single: { phase: null, room: 'Grow A', header: {}, days: {}, snapshots: {}, signature: null, completedAt: null, printedAt: null } } } } } };
    const main = await fresh(b);
    const files = await splitFiles(b, main, BASE, db);
    await openSplit(b, main, BASE, 'office', files);
    await b.run(main, `window.alert = () => {}; window.confirm = () => true;`);
    const lotOpts = () => b.run(main, `return [...document.getElementById('lotActionSelect').options].map(o => o.value);`);
    check('the move list starts with the DB\'s lots', (await lotOpts()).join() === 'L100,L200', JSON.stringify(await lotOpts()));

    // ---- A lot made in the Lot Manager shows straight away ----
    await b.run(main, `const v = (id, x) => { const el = document.getElementById(id); el.value = x; el.dispatchEvent(new Event('change', { bubbles: true })); };
        v('lotType', 'new-lot'); v('lotId', 'L300'); v('lotStrain', 'New Strain'); v('destRoom', 'Grow 1'); v('startRoom', 'flower');
        document.getElementById('lotForm').requestSubmit();`, { user: true });
    const made = await b.run(main, `return !!DB.lots.L300;`);
    check('a new lot shows in the move list without a reload', made && (await lotOpts()).includes('L300'), JSON.stringify(await lotOpts()));

    // ---- A redraw keeps the pick ----
    await b.run(main, `const s = document.getElementById('lotActionSelect'); s.value = 'L100'; s.dispatchEvent(new Event('change'));`);
    await b.run(main, `const st = document.querySelector('.lot-stage-select[data-lot-id="L300"]'); st.value = 'veg'; st.dispatchEvent(new Event('change'));`);
    const picks = await b.run(main, `return { lot: document.getElementById('lotActionSelect').value, where: document.getElementById('lotActionWhere').textContent,
        send: !!document.getElementById('sendLotBtn') || !!document.getElementById('sendLotTo') };`);
    check('another change redraws the card but keeps the picked lot; there\'s no Send', picks.lot === 'L100' && picks.where.includes('Grow 1') && !picks.send, JSON.stringify(picks));

    // ---- A move on its way is listed, read only, and follows a building rename ----
    // L200 (no grow log) is set to Building 3's Dry 3 in the Lot Manager: that's the move
    await b.run(main, `DB.data.lots.L200.dryRoom = 'Dry 3'; renderLotList();
        const sel = document.querySelector('.lot-currentroom-select[data-lot-id="L200"]'); sel.value = 'Dry 3'; sel.dispatchEvent(new Event('change', { bubbles: true }));
        window.__row = document.querySelector('.split-transfer[data-lot="L200"]');`, { user: true });
    let row = await b.run(main, `const r = window.__row; return r ? { text: r.textContent, buttons: r.querySelectorAll('button, input, select').length } : null;`);
    check('the move on its way is listed: lot, from → to (room), waiting for the receiver to pick it up — nothing to click',
        row?.text.includes('Lot L200: Building 2 → Building 3 (Dry 3)') && row.text.includes('waiting for Building 3 to pick it up') && row.buttons === 0, JSON.stringify(row));
    await b.run(main, `const st = document.querySelector('.lot-stage-select[data-lot-id="L300"]'); st.value = 'flower'; st.dispatchEvent(new Event('change'));`);
    check('another change doesn\'t rebuild the row', await b.run(main, `return document.querySelector('.split-transfer[data-lot="L200"]') === window.__row;`));
    await b.run(main, `DB.data.buildings.B3.name = 'Building Three'; BuildingManager.renderBuildingList();`);
    row = await b.run(main, `return document.querySelector('.split-transfer[data-lot="L200"]')?.textContent || '';`);
    check('a renamed building shows its new name', row.includes('Building 2 → Building Three'), row);
    await b.run(main, `const sel = document.querySelector('.lot-currentroom-select[data-lot-id="L200"]'); sel.value = 'Grow A'; sel.dispatchEvent(new Event('change', { bubbles: true })); LotActions.render();`, { user: true });
    check('the row goes when the lot is back in the building that has its pages', await b.run(main, `return !document.querySelector('.split-transfer');`));

    await leave(b, main);
    return results;
}
