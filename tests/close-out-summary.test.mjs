// Close-out saves the lot's crop summary itself (user request 2026-10-27): when the only thing missing is the summary (not
// saved, or out of date), the confirmation says it's saved first; OK saves it in the Labour & Cost Wizard (run without
// showing it, Tools.call) and closes the lot out; Cancel saves nothing. Something only the summary shows (hours with no
// wage) still stops the close-out, with the summary left saved.
import { makeChecker, fresh, openSitka, loadSingle } from './lib/helpers.mjs';
import { lockDb } from './close-out-lock.test.mjs';

export const title = 'close-out saves the crop summary itself when that is all it needs';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    const closeOut = (answer) => b.run(main, `const said = { confirm: '', alert: '' };
        window.confirm = m => { said.confirm = m; return ${answer}; }; window.alert = m => { said.alert = m; };
        LotActions.render(); document.getElementById('lotActionSelect').value = 'L100'; await LotActions.closeOut();
        const a = document.getElementById('archiveLink'); const text = a ? await (await fetch(a.href)).text() : null;
        a?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); document.getElementById('savePopup')?.classList.add('hidden');
        return { ...said, archive: text, lot: !!DB.data.lots.L100, sum: DB.data._EmployeeWizard?.crops?.L100 || null,
            fresh: DB.data._EmployeeWizard?.crops?.L100?.sourceHash === lotFingerprint(DB.data, 'L100'), tool: Tools.current,
            shown: !document.getElementById('toolHost').hidden };`, { user: true });

    // ---- No crop summary yet, everything else ready ----
    await openSitka(b, main, BASE);
    await loadSingle(b, main, lockDb());
    check('the lot has no crop summary to start with', await b.run(main, `return !DB.data._EmployeeWizard?.crops?.L100 && /crop summary isn't saved/.test(closeOutBlockers('L100').join(' '));`));
    let r = await closeOut(false);
    check('the confirmation says its crop summary is saved first', /crop summary is saved first/.test(r.confirm), r.confirm);
    check('Cancel saves nothing: no summary, the lot stays', !r.sum && r.lot && !r.archive, JSON.stringify({ sum: !!r.sum, lot: r.lot }));
    r = await closeOut(true);
    check('OK saves the summary (as the lot is now, with its labour cost) and closes the lot out', !!r.archive && !r.lot && !!r.sum && !r.alert,
        JSON.stringify({ alert: r.alert, lot: r.lot, sum: !!r.sum }));
    const arc = JSON.parse(r.archive || '{}');
    check('…its archive carries the cost ledger the summary saved', Array.isArray(arc.ledger?.lines) && arc.ledger.lines.length > 0, JSON.stringify(arc.ledger || null).slice(0, 120));
    check('…and no tool was shown or left open', !r.tool && !r.shown);

    // ---- An out-of-date summary is saved again ----
    const db2 = lockDb();
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db2);
    await b.run(main, `Tools.call('EmployeeWizard', 'saveCropSummary', 'L100'); DB.data.lots.L100.name = 'Renamed'; return null;`);
    check('a summary saved before the lot changed is out of date', /changed since its crop summary was saved/.test(await b.run(main, `return closeOutBlockers('L100').join(' ');`)));
    r = await closeOut(true);
    check('close-out saves it again and goes ahead', !!r.archive && !r.lot && !r.alert, r.alert);

    // ---- Hours with no wage: the summary is saved, the close-out still waits ----
    const db3 = lockDb();
    const harvest = db3.calendarEvents.find(e => e.lotId === 'L100' && e.taskType === 'harvest');
    const day = Object.keys(harvest.labour_map)[0];
    harvest.labour_map[day].push({ temp: 'Visitor', hours: 2 });
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db3);
    r = await closeOut(true);
    check('hours with no wage: the summary is saved, and close-out says what\'s left', r.lot && !r.archive && r.fresh && /no wage/.test(r.alert), r.alert);
    return results;
}
