// 📋 CTLS month — dried cannabis on hand and what ships out (cost audit 2026-10-26): a lot's dry weight is on hand from the
// day it's recorded until its ✅ Weigh & Ship is signed off, when its flower and trim go out (on that day) and the rest is
// stems & waste. Wet weight stays by calendar month. A lot with no Weigh & Ship task ships its dry weight on its day, as before
// (ctls.test.mjs), and a month filed before ships were kept is compared with the old rule.
//
// S100: harvested Sep 20 (10,000 g wet), dry weight Sep 30 (2,000 g), weighed out 1,000 g bigs + 300 g smalls + 400 g trim,
// Weigh & Ship signed off Oct 8.
import { makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';
import { ctlsDb } from './ctls.test.mjs';

export const title = 'CTLS month: dried cannabis on hand until Weigh & Ship, flower + trim shipped on its day';

const q = (id, label, type, extra = {}) => ({ id, label, type, options: [], rowScoped: false, sameAsLast: false, mandatory: false, prefillFrom: null, ...extra });

function shipDb({ signed = true } = {}) {
    const db = ctlsDb();
    db.lots.S100 = { name: 'S100', strain: 'Ship Kush', stage: 'drying', createdDate: '2026-07-15', closedDate: null, destRoom: 'Grow 1', dryRoom: 'Dry 1', trimRoom: 'Dry 1',
        currentRoom: 'Dry 1', plantCount: 0, type: 'new-lot', startPlantCount: 30 };
    db.calendarEvents.push(
        { id: 'ev_s1', date: '2026-09-20', title: 'Harvest', sourceTool: 'CropLabourWizard', lotId: 'S100', taskType: 'harvest', completed: true },
        { id: 'ev_s2', date: '2026-10-05', title: 'Weigh & Ship', sourceTool: 'CropLabourWizard', lotId: 'S100', taskType: 'weigh_ship',
            ...(signed ? { completed: true, completedBy: { name: 'Casey', initials: { name: 'Casey', strokes: [] }, at: '2026-10-08T22:00:00.000Z', by: 'B1', day: '2026-10-08' } } : {}) });
    const w = db._PaperWizard.wizards.wh.questions;
    w.push(q('big', 'Bigs', 'number', { metric: 'harvest.bigs', metricUnit: 'g' }), q('sml', 'Smalls', 'number', { metric: 'harvest.smalls', metricUnit: 'g' }), q('trm', 'Trim', 'number', { metric: 'harvest.trim', metricUnit: 'g' }));
    const page = (key, header) => ({ [key]: { phase: 'Harvesting', room: 'Dry 1', header, days: {}, rows: [], snapshots: {}, signature: null, completedAt: null, printedAt: null } });
    db._PaperWizard.entries.S100 = { harv: { instances: { ...page('2026-09-20', {}), ...page('2026-09-30', { dry: '2' }), ...page('2026-10-08', { big: '1000', sml: '300', trm: '400' }) } } };
    db._PaperWizard.entries.S100.harv.instances['2026-09-20'].rows = [{ id: 'rs', wet: '10000' }];
    return db;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    const model = async (db, code) => {
        await openSitka(b, main, BASE);
        await loadSingle(b, main, db);
        const ew = await openTool(b, main, 'EmployeeWizard');
        const r = await b.run(ew, code);
        await leave(b, ew); await b.send('browsingContext.close', { context: ew });
        return r;
    };
    const both = `const s = ym => { const C = ctlsModel(ym); return { wet: C.wet, dried: C.dried, ship: C.shippedOut.filter(r => r.lotId === 'S100').map(r => [r.date, r.flower, r.trim, r.g, r.waste]),
        hand: C.onHand.filter(o => o.lotId === 'S100').map(o => o.g), checks: C.checks.map(c => c.text).join(' | '), page: ctlsBody(C, true) }; };`;
    let r = await model(shipDb(), `${both} return { sep: s('2026-09'), oct: s('2026-10') };`);
    // September: the wet weight in and out (dried on the 30th), and the dry weight on hand at the month end
    check('September: 2,000 g dried, still on hand at the month end (nothing shipped yet)', r.sep.dried.in >= 2000 && r.sep.hand.join() === '2000' && !r.sep.ship.length, JSON.stringify(r.sep));
    check('October: on hand at the start, shipped on Oct 8 (the sign-off day): 1,300 g flower + 400 g trim = 1,700 g, 300 g stems & waste',
        JSON.stringify(r.oct.ship) === JSON.stringify([['2026-10-08', 1300, 400, 1700, 300]]) && !r.oct.hand.length, JSON.stringify(r.oct));
    check('…and the month adds up: opening + dried − shipped − stems & waste = closing', Math.abs(r.oct.dried.opening + r.oct.dried.in - r.oct.dried.shipped - r.oct.dried.waste - r.oct.dried.closing) < 1e-6 && !/don't add up/.test(r.oct.checks), JSON.stringify(r.oct.dried));
    check('the page shows dried cannabis on hand and what shipped out', r.oct.page.includes('Dried cannabis on hand') && r.oct.page.includes('Shipped out — flower and trim') && r.oct.page.includes('stems &amp; waste') && !/NaN|undefined/.test(r.oct.page), '');

    // Weighed out but Weigh & Ship not signed off: still on hand, and the checks say so
    r = await model(shipDb({ signed: false }), `${both} return { oct: s('2026-10') };`);
    check('not signed off yet: nothing shipped, still 2,000 g on hand at the end of October', !r.oct.ship.length && r.oct.hand.join() === '2000', JSON.stringify(r.oct));
    check('…and the checks say it\'s weighed out but not signed off', /Weighed out, but Weigh & Ship isn't signed off/.test(r.oct.checks), r.oct.checks);

    // Filing: October's opening is checked against September's dried on hand; a month filed before ships were kept isn't flagged
    r = await model(shipDb(), `ctlsFile('2026-09'); window.confirm = () => true;
        const f = DB.data._EmployeeWizard.ctls['2026-09']; const oct = ctlsModel('2026-10').checks.map(c => c.text).join(' | ');
        DB.data._EmployeeWizard.ctls['2026-09'] = { filedAt: f.filedAt, plants: f.plants, wetG: f.wetG, dryG: ctlsModel('2026-09').dryRecorded, openingPlants: f.openingPlants, openingWetG: f.openingWetG };
        const sepOld = ctlsModel('2026-09').checks.map(c => c.text).join(' | ');
        return { f, oct, sepOld };`.replace("ctlsFile('2026-09'); window.confirm = () => true;", "window.confirm = () => true; ctlsFile('2026-09');"));
    check('Mark as filed keeps the dried cannabis on hand and what shipped (rule 2)', r.f.rule === 2 && r.f.driedG >= 2000 && r.f.shippedG === 700, JSON.stringify(r.f));
    check('…October\'s opening matches it: nothing to say', !/was filed with different closing numbers/.test(r.oct), r.oct);
    check('a month filed before ships were kept is compared with the old rule (dry weights), not flagged as changed', !/Changed since it was filed/.test(r.sepOld), r.sepOld);

    await leave(b, main);
    return results;
}
