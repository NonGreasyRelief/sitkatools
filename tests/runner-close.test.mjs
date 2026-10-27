// PaperWizard's wizard closes only by its ✕: a click beside the card or Escape leaves it open (the day's entry used to
// be lost to a stray tap), and the ✕ asks first when anything entered would be lost. Switching days with unsaved
// answers asks too. Prefills that follow a live update aren't anyone's typing.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave, today } from './lib/helpers.mjs';

export const title = 'PaperWizard: the wizard closes only by its ✕, asking before anything is lost';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today(), Y = today(-1);
    const db = fixtureDb();
    const q = (id, label, type, extra = {}) => ({ id, label, type, options: [], rowScoped: true, sameAsLast: false, mandatory: false, prefillFrom: null, ...extra });
    const box = (id, d, qid) => ({ id, label: id, x: 0.1, y: 0.2 + (d - 1) * 0.06, w: 0.12, h: 0.03, page: 1, fontSize: 10, align: 'left', source: null, questionId: qid, day: d, dayGroup: 'gday', checkbox: false, checkValue: '' });
    db._PaperWizard = {
        sheets: { glog: { name: 'Grow Log', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'daily-weekly', document: 'grow-log',
            fields: [1, 2, 3, 4, 5, 6, 7].flatMap(d => [box('t' + d, d, 'tmp'), box('c' + d, d, 'cnt')]), signature: null } },
        wizards: { wg: { sheetId: 'glog', name: 'Grow Log', questions: [q('tmp', 'Temp', 'number'), q('cnt', 'Plant count', 'plant-count', { prefillFrom: 'lot.plantCount' })] } },
        entries: { L100: { glog: { instances: { [Y]: { phase: 'Bloom', room: 'Grow 1', header: {}, days: { [Y]: { tmp: '24', cnt: '100' } }, phaseChangeDate: null, strikeInitials: null, snapshots: {}, signature: null, completedAt: null, printedAt: null } } } } }
    };
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db);
    const pw = await openTool(b, main, 'PaperWizard');
    const open = () => b.run(pw, `return !!runnerCtx && !!document.getElementById('wizOverlay');`);
    const asked = (answer) => b.run(pw, `window.__asked = ''; window.confirm = (m) => { window.__asked = m; return ${answer}; };`);
    await b.run(pw, `switchTab('cabinet'); await openRunner('L100', 'glog', '${Y}', '${T}');`);

    // ---- Nothing typed: a tap beside the card and Escape leave it open; the ✕ closes without asking ----
    await asked(true);
    await b.run(pw, `const ov = document.getElementById('wizOverlay'); ov.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));`);
    check('a tap beside the card leaves the wizard open and says how to close it', await open() && (await b.run(pw, `return document.getElementById('toast').textContent;`)) === 'Use the ✕ to close the wizard');
    await b.run(pw, `document.getElementById('wizCtl')?.focus();`);
    await b.keys(pw, '');   // Escape
    check('Escape leaves it open', await open());
    await b.run(pw, `document.getElementById('wizCloseBtn').click();`, { user: true });
    check('the ✕ with nothing typed closes it without asking', !(await open()) && !(await b.run(pw, 'return window.__asked;')));

    // ---- Something typed: the ✕ asks; No keeps it, Yes closes ----
    await b.run(pw, `await openRunner('L100', 'glog', '${Y}', '${T}'); const el = document.getElementById('wizCtl'); el.value = '25'; el.dispatchEvent(new Event('input'));`);
    await asked(false);
    await b.run(pw, `document.getElementById('wizCloseBtn').click();`, { user: true });
    const msg = await b.run(pw, 'return window.__asked;');
    check('with an answer typed, the ✕ asks first', msg.startsWith('Close this wizard without saving?') && msg.includes('Everything you entered in it will be lost'), msg);
    check('No keeps the wizard and the answer', await open() && (await b.run(pw, `return runnerCtx.draft.tmp;`)) === '25');

    // Switching days with unsaved answers asks too
    await b.run(pw, `document.querySelector('.day-chip[data-day="${Y}"]').click();`, { user: true });
    const dayMsg = await b.run(pw, 'return window.__asked;');
    check('switching day with unsaved answers asks, and No stays on the day', dayMsg.startsWith(`Switch to`) && (await b.run(pw, 'return runnerCtx.day;')) === T, dayMsg);
    await asked(true);
    await b.run(pw, `document.getElementById('wizCloseBtn').click();`, { user: true });
    check('Yes closes it', !(await open()));

    // ---- A live update that moves a prefill isn't typing ----
    await b.run(pw, `await openRunner('L100', 'glog', '${Y}', '${T}');`);
    await b.run(main, `DB.data.lots.L100.plantCount = 95; markUnsaved(); Tools.push();`);
    await b.waitFor(pw, `return DB.lots.L100.plantCount === 95;`);
    check('the live update reached the open wizard and moved its prefilled count', (await b.run(pw, `return runnerCtx.draft.cnt;`)) === '95');
    await asked(true);
    await b.run(pw, `document.getElementById('wizCloseBtn').click();`, { user: true });
    check('after a live update moved the prefilled count, the ✕ still closes without asking', !(await open()) && !(await b.run(pw, 'return window.__asked;')));

    await leave(b, pw); await b.send('browsingContext.close', { context: pw });
    await leave(b, main);
    return results;
}
