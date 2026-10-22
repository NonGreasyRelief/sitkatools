// SitkaTools' 🌱 Lots — move or close out card (Data & Files) follows the DB without a reload: a new lot shows in its
// list, building names follow, and a redraw keeps the picked lot, the picked destination and typed Accept initials.
import { fixtureDb, makeChecker, fresh, splitFiles, openSplit, leave } from './lib/helpers.mjs';

export const title = 'SitkaTools lot move lists follow new lots without a reload';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const db = fixtureDb();
    db.buildings.B3 = { name: 'Building 3', description: null, createdDate: '2026-01-01', assignedRooms: ['R3DR'] };
    db.rooms.R3DR = { name: 'Dry 3', description: null, createdDate: '2026-01-01', assignedLots: [], isFlowering: false, buildingId: 'B3' };
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

    // ---- A redraw keeps the picks ----
    await b.run(main, `const s = document.getElementById('lotActionSelect'); s.value = 'L100'; s.dispatchEvent(new Event('change'));
        document.getElementById('sendLotTo').value = 'B3';`);
    await b.run(main, `const st = document.querySelector('.lot-stage-select[data-lot-id="L300"]'); st.value = 'veg'; st.dispatchEvent(new Event('change'));`);
    const picks = await b.run(main, `return { lot: document.getElementById('lotActionSelect').value, to: document.getElementById('sendLotTo').value,
        where: document.getElementById('lotActionWhere').textContent, tos: [...document.getElementById('sendLotTo').options].map(o => o.value) };`);
    check('another change redraws the card but keeps the picked lot and destination', picks.lot === 'L100' && picks.to === 'B3' && picks.tos.join() === 'B2,B3'
        && picks.where.includes('Grow 1'), JSON.stringify(picks));
    await b.run(main, `DB.data.buildings.B3.name = 'Building Three'; BuildingManager.renderBuildingList();`);
    check('a renamed building shows its new name in "send to"', await b.run(main, `return [...document.getElementById('sendLotTo').options].some(o => o.textContent === 'to Building Three') && document.getElementById('sendLotTo').value === 'B3';`));

    // ---- Typed Accept initials survive a redraw ----
    await b.run(main, `DB.data._LotTransfers = { 'L200@x': { lotId: 'L200', from: 'B2', to: 'B1', sentAt: new Date().toISOString(), sentBy: 'Office' } }; LotActions.render();
        const row = document.querySelector('.split-transfer[data-transfer="L200@x"]'); row.querySelector('input').value = 'AB';
        row.querySelector('select').value = 'Clone 1'; window.__row = row;`);
    await b.run(main, `const st = document.querySelector('.lot-stage-select[data-lot-id="L300"]'); st.value = 'flower'; st.dispatchEvent(new Event('change'));`);
    const acc = await b.run(main, `const row = document.querySelector('.split-transfer[data-transfer="L200@x"]');
        return { same: row === window.__row, ini: row.querySelector('input').value, room: row.querySelector('select').value };`);
    check('typed initials and the picked room survive a redraw (the row isn\'t rebuilt)', acc.same && acc.ini === 'AB' && acc.room === 'Clone 1', JSON.stringify(acc));
    await b.run(main, `delete DB.data._LotTransfers['L200@x']; LotActions.render();`);
    check('the Accept row goes when its transfer does', await b.run(main, `return !document.querySelector('.split-transfer');`));

    await leave(b, main);
    return results;
}
