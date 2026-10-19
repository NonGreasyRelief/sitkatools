// PaperWizard number answers take digits and one decimal point only (plant counts: digits only), in the
// wizard's own steps and on the repeating-table Entries form. Typed with real key presses.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave, today } from './lib/helpers.mjs';

export const title = 'PaperWizard number answers: digits and one decimal point';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today();
    const HOME = '', ENTER = '';
    const db = fixtureDb();
    const q = (id, label, type, extra = {}) => ({ id, label, type, options: [], rowScoped: false, sameAsLast: false, mandatory: false, prefillFrom: null, ...extra });
    const box = (id, x, y, more = {}) => ({ id, label: id, x, y, w: 0.12, h: 0.03, page: 1, fontSize: 10, align: 'left',
        source: null, questionId: null, day: 1, dayGroup: null, checkbox: false, checkValue: '', ...more });
    db._PaperWizard = {
        sheets: {
            glog: { name: 'Grow Log', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'daily-weekly', document: 'grow-log',
                fields: [1, 2, 3, 4, 5, 6, 7].flatMap(d => [box('tp' + d, 0.1, 0.2 + (d - 1) * 0.06, { dayGroup: 'gday', day: d, questionId: 'temp' }),
                    box('ct' + d, 0.3, 0.2 + (d - 1) * 0.06, { dayGroup: 'gday', day: d, questionId: 'cnt' })]),
                signature: null },
            harv: { name: 'Harvest Log', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'event', document: 'harvest',
                fields: [1, 2, 3].flatMap(d => [box('to' + d, 0.2, 0.3 + (d - 1) * 0.05, { repeat: true, dayGroup: 'rw', day: d, questionId: 'tote' }),
                    box('we' + d, 0.5, 0.3 + (d - 1) * 0.05, { repeat: true, dayGroup: 'rw', day: d, questionId: 'wetw' })]),
                signature: null }
        },
        wizards: {
            wg: { sheetId: 'glog', name: 'Grow Log', questions: [
                q('temp', 'Temp', 'number', { rowScoped: true }),
                q('cnt', 'Plant count', 'plant-count', { rowScoped: true })] },
            wh: { sheetId: 'harv', name: 'Harvest Log', questions: [
                q('tote', 'Tote #', 'text', { repeating: true }),
                q('wetw', 'Wet weight (kg)', 'number', { repeating: true })] }
        },
        entries: {}
    };
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db);
    const pw = await openTool(b, main, 'PaperWizard');

    // ---- The wizard's number step ----
    await b.run(pw, `switchTab('cabinet'); await openRunner('L100', 'glog', '${T}', '${T}');`);
    const ctl = () => b.run(pw, `const el = document.getElementById('wizCtl'); return { v: el.value, draft: runnerCtx.draft[runnerSteps('glog')[runnerCtx.idx].id] ?? '', mode: el.inputMode, focused: document.activeElement === el };`);
    const clear = () => b.run(pw, `const el = document.getElementById('wizCtl'); el.value = ''; el.dispatchEvent(new Event('input')); el.focus();`);
    let c = await ctl();
    check('a number question shows a decimal keypad box', c.mode === 'decimal' && c.focused, JSON.stringify(c));
    await b.keys(pw, '2a4 .5.3x');
    c = await ctl();
    check('letters, spaces and a second decimal point are not taken', c.v === '24.53' && c.draft === '24.53', JSON.stringify(c));
    await clear();
    await b.keys(pw, '1.5' + HOME + '.2');
    c = await ctl();
    check('a point typed before the one already there is not taken; the caret stays put', c.v === '21.5' && c.draft === '21.5', JSON.stringify(c));
    await b.run(pw, `const el = document.getElementById('wizCtl'); el.value = ' 6.5 pH '; el.dispatchEvent(new Event('input'));`);
    c = await ctl();
    check('pasted text keeps only the number', c.v === '6.5' && c.draft === '6.5', JSON.stringify(c));
    await clear();
    await b.keys(pw, '.5');
    await b.run(pw, `document.getElementById('wizCtl').blur();`);
    c = await ctl();
    check('".5" reads "0.5" once you leave the box', c.v === '0.5' && c.draft === '0.5', JSON.stringify(c));
    await b.run(pw, `document.getElementById('wizCtl').focus();`);
    await clear();
    await b.keys(pw, '7.' + ENTER);
    const after = await b.run(pw, `return { temp: runnerCtx.draft.temp, step: runnerSteps('glog')[runnerCtx.idx].id };`);
    check('Enter drops a trailing point and moves on', after.temp === '7' && after.step === 'cnt', JSON.stringify(after));

    // ---- Plant count: whole numbers ----
    c = await ctl();
    check('a plant count shows a number keypad box', c.mode === 'numeric' && c.focused, JSON.stringify(c));
    await b.keys(pw, '12.5 plants');
    c = await ctl();
    check('a plant count takes digits only', c.v === '125' && c.draft === '125', JSON.stringify(c));
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await b.sleep(150);
    const day = await b.run(pw, `return DB.paperWizard.entries.L100?.glog?.instances?.['${T}']?.days?.['${T}'] || null;`);
    check('the day saves the cleaned answers', day?.temp === '7' && day?.cnt === '125', JSON.stringify(day));

    // ---- Repeating-table Entries form ----
    await b.run(pw, `await openRunner('L100', 'harv', '${T}');`);
    const wet = () => b.run(pw, `const el = document.querySelector('.ent-ctl[data-qid="wetw"]'); return { v: el.value, form: runnerCtx.rep.tote.form.wetw ?? '', mode: el.inputMode };`);
    await b.run(pw, `const t = document.querySelector('.ent-ctl[data-qid="tote"]'); t.value = 'T1'; t.dispatchEvent(new Event('input'));
        document.querySelector('.ent-ctl[data-qid="wetw"]').focus();`);
    await b.keys(pw, '1..2 kg');
    let w = await wet();
    check('an Entries number box takes digits and one point', w.v === '1.2' && w.form === '1.2' && w.mode === 'decimal', JSON.stringify(w));
    await b.run(pw, `const el = document.querySelector('.ent-ctl[data-qid="wetw"]'); el.value = ''; el.dispatchEvent(new Event('input')); el.focus();`);
    await b.keys(pw, '3.' + ENTER);
    const rows = await b.run(pw, `return runnerCtx.rep.tote.entries.map(r => r.wetw);`);
    check('Enter on the last box adds the entry without the trailing point', rows.length === 1 && rows[0] === '3', JSON.stringify(rows));
    await b.run(pw, `closeRunner();`);

    await leave(b, pw); await b.send('browsingContext.close', { context: pw }).catch(() => {});
    await leave(b, main);
    return results;
}
