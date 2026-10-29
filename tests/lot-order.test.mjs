// The Lot Manager's list (user request 2026-10-29): the lots for flower rooms first, then the 🌿 mother lots under
// their own heading, each by lot number, lowest first. A mother lot is one scheduled with a 🌿 vegetative recipe; one
// with no schedule yet counts by its stage (Mother) or its destination (a room designated Mother).
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle } from './lib/helpers.mjs';

export const title = 'Lot Manager: lots for flower rooms by number, then the mother lots';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    const db = fixtureDb();
    const lot = (name, extra) => ({ name, strain: 'Test Kush', stage: 'flower', createdDate: '2026-09-01', closedDate: null, destRoom: 'Grow 1', cloningRoom: null, vegRoom: null, currentRoom: 'Grow 1', plantCount: 10, ...extra });
    db.rooms.R1MO = { name: 'Mother 1', description: null, createdDate: '2026-01-01', assignedLots: [], buildingId: 'B1', designation: 'Mother' };
    Object.assign(db.lots, {
        L99: lot('L99', { createdDate: '2026-10-20' }),                                   // newest, lowest number
        L1000: lot('L1000', { createdDate: '2026-01-02' }),
        M20: lot('M20', { stage: 'mother', destRoom: 'Mother 1' }),                       // no schedule: by stage
        M3: lot('M3', { stage: 'veg', destRoom: 'Mother 1' }),                            // no schedule: by its Mother room
        M7: lot('M7', { stage: 'veg', destRoom: 'Grow 1', _tool_CropLabourWizard: { recipeId: 'sitka-mother', kind: 'vegetative', plantingDate: '2026-09-01' } }),
        B5: lot('B5', { stage: 'mother', destRoom: 'Mother 1', _tool_CropLabourWizard: { recipeId: 'sitka-9week', plantingDate: '2026-09-01' } })   // a bloom schedule
    });
    await loadSingle(b, main, db);
    const list = () => b.run(main, `renderLotList(); return [...document.querySelectorAll('#lotList > *')].map(el =>
        el.classList.contains('lot-group-head') ? '# ' + el.textContent : el.querySelector('.lot-delete-btn')?.dataset.lotId || '?');`);
    const order = await list();
    check('the lots for flower rooms first, by number (L99 before L100 and L200, before L1000)', order.slice(0, 5).join() === 'B5,L99,L100,L200,L1000', order.join(' | '));
    check('…then "🌿 Mother lots (3)", and the mother lots by number', order.slice(5).join() === '# 🌿 Mother lots (3),M3,M7,M20', order.join(' | '));
    check('a mother lot: by its 🌿 schedule (M7), its stage (M20) or its Mother room (M3); a bloom schedule isn\'t one (B5)',
        order.indexOf('M7') > order.indexOf('# 🌿 Mother lots (3)') && order.indexOf('B5') < order.indexOf('# 🌿 Mother lots (3)'));
    // A new lot takes its place by number, not at the top
    await b.run(main, `DB.data.lots.L150 = ${JSON.stringify(lot('L150', { createdDate: '2026-10-29' }))};`);
    const after = await list();
    check('a lot made today goes in by its number', after.slice(0, 6).join() === 'B5,L99,L100,L150,L200,L1000', after.join(' | '));
    // No mother lots: no heading
    await b.run(main, `for (const id of ['M3', 'M7', 'M20']) delete DB.data.lots[id];`);
    check('no mother lots: no heading', !(await list()).some(x => x.startsWith('#')));
    await b.run(main, `clearUnsaved();`);
    return results;
}
