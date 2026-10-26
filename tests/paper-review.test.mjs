// PaperWizard fixes from the 2026-10-25 review:
// - D1: a page's values are taken once (a later save doesn't re-read today's lot into an older page);
// - D2: re-saving the harvest log doesn't move the lot back to what the page said;
// - D3: only daily logs write the lot's plant count;
// - D5: "Start on a chosen day" is only for a lot's first daily log;
// - D12: a day added to a page that was already signed is on record ("changed after signing");
// - D13: an imported sheet configuration is checked before it's used.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave, today, answerCountReasons } from './lib/helpers.mjs';

export const title = 'PaperWizard review fixes: snapshots, write-backs, signed pages, sheet import';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today(), Y = today(-1), Y2 = today(-2);
    const db = fixtureDb();
    const q = (id, label, type, extra = {}) => ({ id, label, type, options: [], rowScoped: false, sameAsLast: false, mandatory: false, prefillFrom: null, ...extra });
    const box = (id, x, y, more = {}) => ({ id, label: id, x, y, w: 0.12, h: 0.03, page: 1, fontSize: 10, align: 'left',
        source: null, questionId: null, day: 1, dayGroup: null, checkbox: false, checkValue: '', ...more });
    const sheet = (name, cadence, document, fields) => ({ name, orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence, document, fields, signature: null });
    db._PaperWizard = {
        sheets: {
            glog: sheet('Grow Log', 'daily-weekly', 'grow-log', [box('strn', 0.1, 0.05, { source: 'lot.strain' }), box('stg', 0.4, 0.05, { source: 'lot.stage' }),
                ...[1, 2, 3, 4, 5, 6, 7].flatMap(d => [box('tp' + d, 0.1, 0.2 + (d - 1) * 0.06, { dayGroup: 'gday', day: d, questionId: 'temp' }),
                    box('ct' + d, 0.3, 0.2 + (d - 1) * 0.06, { dayGroup: 'gday', day: d, questionId: 'cnt' })])]),
            dlog: sheet('Drying Log', 'daily-weekly', 'drying-log', [1, 2, 3, 4, 5, 6, 7].map(d => box('dt' + d, 0.1, 0.2 + (d - 1) * 0.06, { dayGroup: 'dday', day: d, questionId: 'dtmp' }))),
            prop: sheet('Propagation', 'one-shot', 'propagation', [box('pcb', 0.1, 0.1, { questionId: 'pc' }), box('pcs', 0.4, 0.1, { source: 'lot.plantCount' })]),
            harv: sheet('Harvest Log', 'event', 'harvest', [box('hp', 0.1, 0.1, { questionId: 'hph' }), box('dw', 0.4, 0.1, { questionId: 'dwt' })])
        },
        wizards: {
            wg: { sheetId: 'glog', name: 'Grow Log', questions: [q('temp', 'Temp', 'number', { rowScoped: true }), q('cnt', 'Plant count', 'plant-count', { rowScoped: true })] },
            wd: { sheetId: 'dlog', name: 'Drying Log', questions: [q('dtmp', 'Temp', 'number', { rowScoped: true })] },
            wp: { sheetId: 'prop', name: 'Propagation', questions: [q('pc', 'Clones taken', 'plant-count')] },
            wh: { sheetId: 'harv', name: 'Harvest Log', questions: [q('hph', 'Phase', 'phase'), q('dwt', 'Dry weight (g)', 'number')] }
        },
        entries: {}
    };
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db);
    const pw = await openTool(b, main, 'PaperWizard');
    const save = async (lotId, sheetId, key, day, answers) => {
        await b.run(pw, `switchTab('cabinet'); await openRunner(${JSON.stringify(lotId)}, ${JSON.stringify(sheetId)}, ${JSON.stringify(key)}, ${JSON.stringify(day)});
            Object.assign(runnerCtx.draft, ${JSON.stringify(answers)}); saveRunnerEntry();`);
        await b.sleep(300);
    };
    const lot = id => b.run(main, `return DB.data.lots[${JSON.stringify(id)}];`);
    const inst = (sheetId, key) => b.run(pw, `return DB.paperWizard.entries.L100?.[${JSON.stringify(sheetId)}]?.instances?.[${JSON.stringify(key)}] || null;`);

    // ---- D1: snapshot once ----
    await save('L100', 'glog', Y2, Y2, { temp: '24', cnt: '100' });
    let g = await inst('glog', Y2);
    check('the grow log page took the strain and phase when it was made', g?.snapshots?.['lot.strain'] === 'Test Kush' && g.snapshots['lot.stage'] === 'Bloom', JSON.stringify(g?.snapshots));
    await b.run(main, `DB.data.lots.L100.strain = 'Renamed Kush'; markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    await save('L100', 'glog', Y2, Y, { temp: '25', cnt: '100' });
    g = await inst('glog', Y2);
    check('a later save on the same page keeps what the page was made with', !!g?.days?.[Y] && g.snapshots['lot.strain'] === 'Test Kush', JSON.stringify(g?.snapshots));

    // ---- D3: a plant count on another sheet is only recorded ----
    await save('L100', 'prop', 'single', null, { pc: '90' });
    const p = await inst('prop', 'single');
    check('the propagation sheet records its count', p?.header?.pc === '90', JSON.stringify(p?.header));
    check('…but doesn\'t change the lot\'s plant count (only daily logs do)', (await lot('L100')).plantCount === 100, (await lot('L100')).plantCount);

    // ---- D5: Start on a chosen day only for a lot's first daily log ----
    const startLeaves = (id) => b.run(pw, `activeLotId = ${JSON.stringify(id)}; renderCabinet(); return [...document.querySelectorAll('[data-startlog]')].map(el => el.dataset.sheet);`);
    check('a lot with no daily log is offered "Start on a chosen day"', (await startLeaves('L200')).includes('glog'), JSON.stringify(await startLeaves('L200')));
    check('a lot with a grow log isn\'t, on its drying log either', (await startLeaves('L100')).length === 0, JSON.stringify(await startLeaves('L100')));
    const refused = await b.run(pw, `openStartLogModal('L100', 'dlog'); return { toast: document.querySelector('.toast, #toast')?.textContent || '', open: !!document.getElementById('startLogDate') };`);
    check('…and its dialog refuses', !refused.open && refused.toast.includes('already has a daily log'), JSON.stringify(refused));

    // ---- D6: an earlier day's count changed "this day only": the next day's reasons are asked again ----
    const save200 = async (key, day, answers, { reasons = false } = {}) => {
        await b.run(pw, `switchTab('cabinet'); await openRunner('L200', 'glog', '${Y2}', ${JSON.stringify(day)}); Object.assign(runnerCtx.draft, ${JSON.stringify(answers)}); saveRunnerEntry();`);
        if (reasons) await answerCountReasons(b, pw, { reason: 'culled' });
        await b.sleep(300);
    };
    await save200(Y2, Y2, { temp: '24', cnt: '80' });
    await save200(Y2, Y, { temp: '24', cnt: '78' }, { reasons: true });
    await save200(Y2, T, { temp: '24', cnt: '78' });
    const g2 = () => b.run(pw, `return DB.paperWizard.entries.L200.glog.instances['${Y2}'];`);
    check('L200: 2 culled on the second day', JSON.stringify((await g2()).days[Y]._removed) === '{"culled":2}', JSON.stringify((await g2()).days[Y]));
    await b.run(pw, `window.__confirm = window.confirm; window.confirm = () => false; switchTab('cabinet'); await openRunner('L200', 'glog', '${Y2}', '${Y2}'); Object.assign(runnerCtx.draft, { cnt: '82' }); saveRunnerEntry();`);
    const asked = await answerCountReasons(b, pw, { reason: 'culled' });
    check('counting 82 on the first day, this day only: the next day\'s drop (82 → 78) asks its reasons again', asked);
    const corr = await b.waitFor(pw, `return !!document.getElementById('corrOverlay');`, 3000).then(() => true).catch(() => false);
    if (corr) {
        await b.run(pw, `[...document.querySelectorAll('.corr-reason')][0]?.click(); document.getElementById('corrName').value = 'WT';`, { user: true });
        await b.drag(pw, '#corrPad', [[0.2, 0.7], [0.3, 0.2], [0.4, 0.7]]);
        await b.run(pw, `document.getElementById('corrOkBtn').click();`, { user: true });
        await b.sleep(300);
    }
    await b.run(pw, `window.confirm = window.__confirm;`);
    const after2 = await g2();
    check('…and keeps them: 4 culled on the second day, the first day 82', after2.days[Y2].cnt === '82' && JSON.stringify(after2.days[Y]._removed) === '{"culled":4}', JSON.stringify({ d1: after2.days[Y2].cnt, d2: after2.days[Y]._removed }));

    // ---- D2: the harvest log moves the lot only when its answer changes ----
    await save('L100', 'harv', T, null, { hph: 'Harvesting', dwt: '' });
    check('the harvest log moved the lot to Harvesting', (await lot('L100')).stage === 'harvest', (await lot('L100')).stage);
    await b.run(main, `DB.data.lots.L100.stage = 'drying'; markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    await save('L100', 'harv', T, null, { hph: 'Harvesting', dwt: '850' });
    check('re-saving it to add the dry weight leaves the lot where it is now (Drying)', (await lot('L100')).stage === 'drying' && (await inst('harv', T))?.header?.dwt === '850', (await lot('L100')).stage);

    // ---- D12: a day added to a signed page is on record ----
    await b.run(pw, `const i = DB.paperWizard.entries.L100.glog.instances['${Y2}']; i.signature = { name: 'Master', strokes: [[0.1, 0.5, 0.9, 0.5]], date: '${Y}', at: new Date(Date.now() - 60000).toISOString() }; notifySitkaTools();`);
    await b.sleep(300);
    await b.run(pw, `switchTab('cabinet'); await openRunner('L100', 'glog', '${Y2}', '${T}'); Object.assign(runnerCtx.draft, { temp: '26', cnt: '100' }); saveRunnerEntry();`);
    const padUp = await b.waitFor(pw, `return !!document.getElementById('corrOverlay');`, 3000).then(() => true).catch(() => false);
    const padText = padUp ? await b.run(pw, `return document.getElementById('corrList').textContent;`) : '';
    check('adding a day to a signed page asks for initials and a reason', padUp && padText.includes('added after the page was signed'), padText);
    if (padUp) {
        await b.run(pw, `[...document.querySelectorAll('.corr-reason')][0]?.click(); document.getElementById('corrName').value = 'WT';`, { user: true });
        await b.drag(pw, '#corrPad', [[0.2, 0.7], [0.3, 0.2], [0.4, 0.7]]);
        await b.run(pw, `document.getElementById('corrOkBtn').click();`, { user: true });
        await b.sleep(300);
    }
    g = await inst('glog', Y2);
    const chip = await b.run(pw, `activeLotId = 'L100'; renderCabinet(); return [...document.querySelectorAll('.cab-changes')].map(c => c.textContent).join(' | ');`);
    check('…and the page shows "changed after signing"', !!g?.days?.[T] && (g.changes || []).some(c => c.kind === 'added' && c.day === T) && chip.includes('changed after signing'), chip);

    // ---- D13: an imported sheet configuration is checked ----
    const imp = await b.run(pw, `
        const bad = cleanSheetImport('grow', { cadence: 'event', fields: [{ id: 'ab"><img src=x>', x: 0, y: 0, w: 1, h: 1 }] }, {});
        const odd = cleanSheetImport('grow', { cadence: 'event', fields: [{ id: 'ab12', x: 3, y: -1, w: 'x', h: 0.1, align: 'left;background:url(x)', fontSize: 900 }] }, {});
        const badQ = cleanSheetImport('grow', { cadence: 'event', fields: [] }, { w1: { sheetId: 'grow', questions: [{ id: 'q1', type: 'script', label: 'x' }] } });
        const ok = cleanSheetImport('glog', DB.paperWizard.sheets.glog, { wg: DB.paperWizard.wizards.wg });
        return { bad: bad.error || null, odd: odd.sheet?.fields?.[0] || odd.error, badQ: badQ.error || null, ok: !ok.error && ok.sheet.fields.length === DB.paperWizard.sheets.glog.fields.length };`);
    check('an id with HTML in it is refused', /unusual id/.test(imp.bad || ''), imp.bad);
    check('positions, size and alignment are brought into range', imp.odd?.x === 1 && imp.odd.y === 0 && imp.odd.w === 0 && imp.odd.align === 'left' && imp.odd.fontSize === 72, JSON.stringify(imp.odd));
    check('a question of an unknown type is refused', /type PaperWizard doesn't know/.test(imp.badQ || ''), imp.badQ);
    check('a real sheet passes unchanged in shape', imp.ok === true);

    await leave(b, pw); await b.send('browsingContext.close', { context: pw });
    await leave(b, main);
    return results;
}
