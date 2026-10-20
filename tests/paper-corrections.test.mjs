// PaperWizard corrections (QAP traceability): once a day, page or entry is on file, changing it asks for a name,
// drawn initials and a reason; the printed page shows the new value at full size, then a small stack beside it: the old
// value struck out, over the date with the drawn initials on it; and every change is in the change log. Also: "Start on a chosen
// day" defaults to the date the lot was created.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave, today } from './lib/helpers.mjs';

export const title = 'PaperWizard corrections: struck-out values, initials, change log';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today(), D1 = today(-5), D2 = today(-4), D3 = today(-3), D4 = today(-2);
    const ymd = s => s.replaceAll('-', '/');
    const md = s => s.slice(5).replace('-', '/');
    const db = fixtureDb();
    db.lots.L100.createdDate = D1;
    const q = (id, label, type, extra = {}) => ({ id, label, type, options: [], rowScoped: false, sameAsLast: false, mandatory: false, prefillFrom: null, ...extra });
    const box = (id, x, y, more = {}) => ({ id, label: id, x, y, w: 0.12, h: 0.03, page: 1, fontSize: 10, align: 'left',
        source: null, questionId: null, day: 1, dayGroup: null, checkbox: false, checkValue: '', ...more });
    const dayFields = [];
    for (let d = 1; d <= 7; d++) {
        const y = 0.2 + (d - 1) * 0.06, g = { dayGroup: 'gday', day: d };
        dayFields.push(box('dt' + d, 0.02, y, { ...g, source: 'day.date', w: 0.06 }), box('tp' + d, 0.1, y, { ...g, questionId: 'temp' }),
            box('ct' + d, 0.25, y, { ...g, questionId: 'cnt' }), box('ok' + d, 0.4, y, { ...g, questionId: 'okq', checkbox: true, checkValue: 'Yes', w: 0.02, h: 0.02 }),
            box('in' + d, 0.5, y, { ...g, questionId: 'init', w: 0.15 }),
            // pH over EC in one cell, each box sized to half the cell so a correction has room
            box('ph' + d, 0.7, y, { ...g, questionId: 'phq', w: 0.05, h: 0.026 }), box('ec' + d, 0.7, y + 0.028, { ...g, questionId: 'ecq', w: 0.05, h: 0.026 }));
    }
    db._PaperWizard = {
        sheets: {
            glog: { name: 'Grow Log', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'daily-weekly', document: 'grow-log',
                fields: [box('subl', 0.6, 0.05, { questionId: 'subq', constant: true, w: 0.3 }), ...dayFields],
                signature: { x: 0.6, y: 0.9, w: 0.3, h: 0.05, label: 'Master grower' } },
            glog2: { name: 'Bloom Log', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'daily-weekly', document: 'grow-log',
                fields: [1, 2, 3, 4, 5, 6, 7].flatMap(d => [box('bt' + d, 0.1, 0.2 + (d - 1) * 0.06, { dayGroup: 'g2', day: d, questionId: 'temp2' }),
                    box('bp' + d, 0.3, 0.2 + (d - 1) * 0.06, { dayGroup: 'g2', day: d, questionId: 'phs2' }),
                    box('bi' + d, 0.5, 0.2 + (d - 1) * 0.06, { dayGroup: 'g2', day: d, questionId: 'ini2' })]),
                signature: null },
            harv: { name: 'Harvest Log', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'event', document: 'harvest',
                fields: [box('hpl', 0.1, 0.1, { questionId: 'plnt' }),
                    ...[1, 2, 3].flatMap(d => [box('en' + d, 0.05, 0.3 + (d - 1) * 0.05, { repeat: true, dayGroup: 'rw', day: d, source: 'entry.number', w: 0.05 }),
                        box('to' + d, 0.2, 0.3 + (d - 1) * 0.05, { repeat: true, dayGroup: 'rw', day: d, questionId: 'tote' }),
                        box('we' + d, 0.5, 0.3 + (d - 1) * 0.05, { repeat: true, dayGroup: 'rw', day: d, questionId: 'wetw' })])],
                signature: null }
        },
        wizards: {
            wg: { sheetId: 'glog', name: 'Grow Log', questions: [
                q('subq', 'Substrate lot', 'text'),
                q('temp', 'Temp', 'number', { rowScoped: true }),
                q('cnt', 'Plant count', 'plant-count', { rowScoped: true, prefillFrom: 'lot.plantCount' }),
                q('okq', 'Crop OK?', 'select', { rowScoped: true, options: ['Yes', 'No'] }),
                q('phq', 'pH', 'number', { rowScoped: true }),
                q('ecq', 'EC', 'number', { rowScoped: true }),
                q('init', 'Initials', 'initials', { rowScoped: true })] },
            wb: { sheetId: 'glog2', name: 'Bloom Log', questions: [
                q('temp2', 'Temp', 'number', { rowScoped: true }),
                q('phs2', 'Phase', 'phase', { rowScoped: true }),
                q('ini2', 'Initials', 'initials', { rowScoped: true })] },
            wh: { sheetId: 'harv', name: 'Harvest Log', questions: [
                q('plnt', 'Plants harvested', 'number'),
                q('tote', 'Tote #', 'text', { repeating: true }),
                q('wetw', 'Wet weight (kg)', 'number', { repeating: true, metric: 'harvest.wetWeight', metricUnit: 'kg' })] }
        },
        entries: {}
    };
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db);
    const pw = await openTool(b, main, 'PaperWizard');
    await b.run(pw, `switchTab('cabinet'); document.getElementById('lotSelect').value = 'L100'; document.getElementById('lotSelect').dispatchEvent(new Event('change'));`);

    // ---- Start on a chosen day: the date the lot was created ----
    const startDefault = () => b.run(pw, `document.getElementById('startLogOverlay')?.remove();
        document.querySelector('[data-startlog][data-sheet="glog"] .cab-fill').click();
        return document.getElementById('startLogDate').value;`, { user: true });
    check('📅 Start on a chosen day opens on the date the lot was created', (await startDefault()) === D1, D1);
    await b.run(pw, `DB.lots.L100.createdDate = '${today(3)}';`);
    check('… or today, when that date is still ahead', (await startDefault()) === T);
    await b.run(pw, `DB.lots.L100.createdDate = '${D1}';`);
    await startDefault();
    await b.run(pw, `document.getElementById('startLogOk').click();`, { user: true });
    await b.sleep(200);
    check('the log starts on that day', await b.run(pw, `return !!DB.paperWizard.entries.L100.glog.instances['${D1}'] && runnerCtx?.day === '${D1}';`));
    await b.run(pw, `closeRunner();`);

    // ---- Fill four days: three with initials (on file), the fourth without (still being filled) ----
    const pen = [[[0.2, 0.6], [0.5, 0.2], [0.8, 0.6]]];
    const fillDay = async (day, vals, initials = true) => {
        await b.run(pw, `await openRunner('L100', 'glog', '${D1}', '${day}');
            Object.assign(runnerCtx.draft, ${JSON.stringify(vals)});
            ${initials ? `runnerCtx.draft.init = { name: 'AB', strokes: ${JSON.stringify(pen)} };` : ''}
            runnerCtx.idx = runnerSteps('glog').length - 1; renderRunner();`);
        await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
        await b.sleep(150);
    };
    const pad = () => b.run(pw, `return !!document.getElementById('corrOverlay');`);
    const signPad = async ({ reason = 'Typing error', name = 'WT' } = {}) => {
        await b.waitFor(pw, `return !!document.getElementById('corrOverlay');`);
        await b.run(pw, `[...document.querySelectorAll('.corr-reason')].find(x => x.dataset.r === ${JSON.stringify(reason)})?.click();
            document.getElementById('corrName').value = ${JSON.stringify(name)};`, { user: true });
        await b.drag(pw, '#corrPad', [[0.2, 0.7], [0.3, 0.2], [0.4, 0.7]]);
        await b.drag(pw, '#corrPad', [[0.6, 0.2], [0.6, 0.8]]);
        await b.run(pw, `document.getElementById('corrOkBtn').click();`, { user: true });
        await b.sleep(250);
    };
    await fillDay(D1, { temp: '24.5', cnt: '100', okq: 'Yes' });
    await fillDay(D2, { temp: '25.0', cnt: '99', okq: 'Yes' });
    await fillDay(D3, { temp: '25.5', cnt: '98', okq: 'Yes', phq: '5.8', ecq: '1.2' });
    await fillDay(D4, { temp: '26', cnt: '97', okq: 'Yes' }, false);
    const page = () => b.run(pw, `return DB.paperWizard.entries.L100.glog.instances['${D1}'];`);
    let inst = await page();
    check('filling days in asks for no correction', !(await pad()) && !inst.changes && inst.days[D3].temp === '25.5' && inst.days[D4].temp === '26');

    // ---- Day 1 is on file: the runner says so, keeps its initials, and Save asks for a correction ----
    await b.run(pw, `await openRunner('L100', 'glog', '${D1}', '${D1}');`);
    check('opening a day on file says it is on file', (await b.run(pw, `return document.querySelector('.wiz-onfile')?.textContent || '';`)).includes('This day is on file'));
    await b.run(pw, `const el = document.getElementById('wizCtl'); el.value = '25'; el.dispatchEvent(new Event('input'));`);
    check('a changed answer shows what is on file', (await b.run(pw, `return document.getElementById('wizWas').textContent;`)).includes('On file as 24.5'));
    await b.run(pw, `runnerGo(1); runnerGo(1); runnerGo(1); runnerGo(1); runnerGo(1);`);
    check('the day\'s drawn initials are shown, not redrawn', await b.run(pw, `return !!document.querySelector('.ini-view polyline') && !document.getElementById('qInitPad');`));
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await b.waitFor(pw, `return !!document.getElementById('corrOverlay');`);
    const padText = await b.run(pw, `return document.getElementById('corrList').textContent;`);
    check('Save opens the correction pad listing the change', padText.includes('Temp') && padText.includes('24.5') && padText.includes('25'), padText);
    await b.run(pw, `document.getElementById('corrCancelBtn').click();`, { user: true });
    await b.sleep(150);
    inst = await page();
    check('Cancel: nothing saved, the runner stays open with the change typed', !(await pad()) && inst.days[D1].temp === '24.5' && !inst.changes
        && (await b.run(pw, `return !!runnerCtx && runnerCtx.draft.temp === '25';`)));
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await b.waitFor(pw, `return !!document.getElementById('corrOverlay');`);
    await b.run(pw, `document.getElementById('corrName').value = 'WT'; document.getElementById('corrOkBtn').click();`, { user: true });
    check('a reason is required', (await pad()) && (await b.run(pw, `return document.querySelector('.toast, #toast')?.textContent || '';`)).includes('reason'));
    await b.run(pw, `document.getElementById('corrCancelBtn').click();`, { user: true });
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await signPad();
    inst = await page();
    const c1 = inst.changes?.[0];
    check('the correction is saved with who, when, why and the drawn initials',
        inst.days[D1].temp === '25' && inst.changes?.length === 1 && c1.kind === 'edit' && c1.day === D1 && c1.q === 'temp' && c1.from === '24.5' && c1.to === '25'
        && c1.reason === 'Typing error' && c1.by?.name === 'WT' && c1.by.strokes.length === 2 && c1.date === T, JSON.stringify(c1));
    check('the day\'s own initials are unchanged', JSON.stringify(inst.days[D1].init.strokes) === JSON.stringify(pen));
    check('SitkaTools has the correction', (await b.run(main, `return DB.data._PaperWizard.entries.L100.glog.instances['${D1}'].changes?.length;`)) === 1);

    // A second correction on the same day, a checkbox answer too
    await b.run(pw, `await openRunner('L100', 'glog', '${D1}', '${D1}'); Object.assign(runnerCtx.draft, { temp: '26', okq: 'No' });
        runnerCtx.idx = runnerSteps('glog').length - 1; renderRunner();`);
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await b.waitFor(pw, `return !!document.getElementById('corrOverlay');`);
    check('for a tick-box answer the pad says its initials and date go in the change log', (await b.run(pw, `return document.querySelector('#corrOverlay .strike-sub').textContent;`)).includes('Tick boxes show only the old ✕ struck out'));
    await signPad({ reason: 'Wrong reading', name: 'JD' });
    inst = await page();
    check('a second correction adds two more changes (temp, Crop OK?)', inst.changes.length === 3 && inst.days[D1].okq === 'No' && inst.changes[2].from === 'Yes', JSON.stringify(inst.changes.map(c => c.q + ':' + c.from + '→' + c.to)));

    // A day still being filled (no initials yet) changes freely
    await fillDay(D4, { temp: '27' }, false);
    inst = await page();
    check('a day not on file yet changes with no correction', !(await pad()) && inst.days[D4].temp === '27' && inst.changes.length === 3);

    // ---- A backfilled plant count: the later days it shifts are corrected too ----
    await b.run(pw, `window.confirm = () => true; await openRunner('L100', 'glog', '${D1}', '${D1}'); runnerCtx.draft.cnt = '90';
        runnerCtx.idx = runnerSteps('glog').length - 1; renderRunner();`);
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await b.waitFor(pw, `return !!document.getElementById('corrOverlay');`);
    const carriedText = await b.run(pw, `return document.getElementById('corrList').textContent;`);
    check('the pad lists the day changed and the later days on file it carries to', carriedText.includes('100') && carriedText.includes('99') && carriedText.includes('98')
        && (carriedText.match(/carried forward/g) || []).length === 2 && !carriedText.includes('97'), carriedText);
    await signPad({ reason: 'Wrong reading' });
    inst = await page();
    const carried = inst.changes.filter(c => c.kind === 'carried');
    check('later counts shifted; the two on file are recorded as carried forward from day 1',
        inst.days[D2].cnt === '89' && inst.days[D3].cnt === '88' && inst.days[D4].cnt === '87' && carried.length === 2 && carried.every(c => c.via === D1)
        && carried.map(c => c.day).join() === `${D2},${D3}`, JSON.stringify(carried));

    // ---- Constants: changing one that was set is a correction ----
    const setConstant = async (v) => {
        await b.run(pw, `openInitQuiz('L100'); runnerCtx.draft.subq = '${v}'; renderRunner();`);
        await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
        await b.sleep(150);
    };
    await setConstant('SL-1');
    check('setting a constant for the first time is no correction', !(await pad()) && (await b.run(pw, `return DB.paperWizard.entries.L100.glog.constants.subq;`)) === 'SL-1');
    await setConstant('SL-2');
    await signPad();
    check('changing it is', (await b.run(pw, `const sd = DB.paperWizard.entries.L100.glog; return sd.constants.subq === 'SL-2' && sd.constantChanges?.length === 1 && sd.constantChanges[0].from === 'SL-1';`)));

    // ---- Signed, then changed: flagged; signing again is logged and clears the flag ----
    const sign = async (pts) => {
        await b.run(pw, `openSignatureModal('L100', 'glog', '${D1}');`);
        await b.drag(pw, '#sigPad2', pts);
        await b.run(pw, `document.getElementById('sigModalSaveBtn').click();`, { user: true });
        await b.sleep(150);
    };
    await sign([[0.1, 0.5], [0.5, 0.2], [0.9, 0.6]]);
    check('signing stamps the time', !!(await page()).signature?.at);
    await b.sleep(20);
    await b.run(pw, `await openRunner('L100', 'glog', '${D1}', '${D2}'); runnerCtx.draft.temp = '25.2'; runnerCtx.idx = runnerSteps('glog').length - 1; renderRunner();`);
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await signPad();
    const chip = () => b.run(pw, `renderCabinet(); const c = document.querySelector('.cab-changes[data-sheet="glog"]'); return c ? { text: c.textContent, after: c.classList.contains('after-sign') } : null;`);
    let ch = await chip();
    check('the page shows ✏️ N · changed after signing', ch?.after && ch.text.includes('changed after signing') && ch.text.includes('✏️ 8'), JSON.stringify(ch));
    await sign([[0.2, 0.8], [0.8, 0.8]]);
    inst = await page();
    ch = await chip();
    check('signing again is in the change log, and the flag clears', inst.changes.at(-1).kind === 'signature' && ch && !ch.after, JSON.stringify(ch));

    // ---- The printed page ----
    // The form: a row line above each day row, and a grey block over the pH / EC column — neither may change
    // where a correction prints (only its box does)
    const loadGlogDoc = () => b.run(pw, `const c = document.createElement('canvas'); c.width = 850; c.height = 1100; const g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, 850, 1100); g.fillStyle = '#000';
        for (let d = 1; d <= 8; d++) g.fillRect(0, Math.round((0.19 + (d - 1) * 0.06) * 1100), 850, 2);
        g.fillStyle = '#777'; g.fillRect(Math.round(0.69 * 850), Math.round(0.19 * 1100), Math.round(0.07 * 850), Math.round(0.42 * 1100));
        const blob = await new Promise(r => c.toBlob(r, 'image/webp')); await loadPrintDocument([new File([blob], 'glog-p1.webp', { type: 'image/webp' })]);`);
    await loadGlogDoc();
    const popup = async (sheetId, key) => {
        const before = new Set((await b.contexts()).map(c => c.context));
        await b.run(pw, `openPrintPopup('L100', '${sheetId}', '${key}');`, { user: true });
        let pop = null;
        for (let i = 0; i < 40 && !pop; i++) { await b.sleep(100); pop = (await b.contexts()).find(c => !before.has(c.context))?.context || null; }
        return pop;
    };
    let pop = await popup('glog', D1);
    const read = (fid) => b.run(pop, `const el = document.querySelector('.ov[data-fid="${fid}"]'); if (!el) return null;
        return { corr: el.classList.contains('ov-corr'), lines: [...el.querySelectorAll('.cr, .cn')].map(l => l.textContent.replace(/\\s+/g, ' ').trim()), struck: [...el.querySelectorAll('s')].map(s => s.textContent),
            ini: el.querySelectorAll('.ci polyline').length, fs: parseFloat(getComputedStyle(el).fontSize), fits: el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1,
            nowFs: el.querySelector('.cn') ? parseFloat(getComputedStyle(el.querySelector('.cn')).fontSize) : null,
            oldFs: Math.max(0, ...[...el.querySelectorAll('.cr')].map(c => parseFloat(getComputedStyle(c).fontSize))),
            fitted: el.classList.contains('fitted'), text: el.textContent };`);
    const t1 = await read('tp1');
    check('day 1 Temp, changed twice: the current value first, then only the latest old value struck out', t1?.corr && t1.lines.length === 2 && t1.lines[0] === '26' && t1.struck.join() === '25', JSON.stringify(t1));
    check('the struck value carries drawn initials and the date (mm/dd, no year)', t1?.ini > 0 && t1.lines[1].endsWith(md(T)) && !t1.lines[1].includes(ymd(T)), JSON.stringify(t1?.lines));
    check('the current value keeps the box\'s full size; the old values print small', t1?.fitted && Math.abs(t1.fs - 13.33) < 0.05 && t1.nowFs === t1.fs && t1.oldFs > 0 && t1.oldFs <= t1.fs * 0.56, JSON.stringify(t1));
    const c1b = await read('ct1'), c2b = await read('ct2'), c4b = await read('ct4');
    check('plant counts: day 1 corrected, day 2 carried forward, day 4 (not on file) just prints', c1b?.struck.join() === '100' && c1b.lines[0] === '90'
        && c2b?.struck.join() === '99' && c2b.lines[0] === '89' && !c4b?.corr && c4b?.text === '87', JSON.stringify([c1b?.lines, c2b?.lines, c4b?.text]));
    const cb = await b.run(pop, `const struck = [...document.querySelectorAll('.ov-cb.struck')];
        return { struck: struck.length, top: struck[0] ? Math.round(parseFloat(struck[0].style.top)) : null, text: struck[0]?.textContent, beside: document.querySelectorAll('.ov-cbn').length };`);
    check('Crop OK? box: the old ✕ struck out inside the box, nothing printed beside it', cb.struck === 1 && cb.top === 20 && cb.text === '✕' && cb.beside === 0, JSON.stringify(cb));
    const sub = await read('subl');
    check('the constant prints the new value, then the old one struck out', sub?.struck.join() === 'SL-1' && sub.lines[0] === 'SL-2', JSON.stringify(sub));
    check('the toolbar notes the changes on file (not printed)', (await b.run(pop, `return document.querySelector('.pp-corr')?.textContent || '';`)).includes('changes on file'));
    await b.send('browsingContext.close', { context: pop });

    // ---- The change log ----
    await b.run(pw, `renderCabinet(); document.getElementById('cabChangeLogBtn').click();`, { user: true });
    const log = await b.run(pw, `return { rows: [...document.querySelectorAll('#chgOverlay tbody tr')].map(r => [...r.cells].map(c => c.textContent.trim())),
        ini: document.querySelectorAll('#chgOverlay .chg-ini polyline').length, btn: document.getElementById('cabChangeLogBtn').textContent };`);
    check('📝 Change log lists every change, newest first (9)', log.rows.length === 9 && log.btn.includes('(9)') && log.rows[0][3].includes('Master grower signature'), JSON.stringify(log.rows.map(r => r[3])));
    const d1Short = await b.run(pw, `return fmtShort('${D1}');`);
    check('each row has when, where, what, who (with initials) and why', log.rows.some(r => r[2] === d1Short && r[3].includes('Temp') && r[3].includes('24.5') && r[4].includes('WT') && r[5] === 'Typing error') && log.ini > 0);
    check('both of day 1 Temp\'s changes are in it (only the latest prints)', log.rows.filter(r => r[2] === d1Short && r[3].includes('Temp')).length === 2, JSON.stringify(log.rows.filter(r => r[2] === d1Short).map(r => r[3])));
    check('carried-forward and constant changes say so', log.rows.some(r => r[3].includes('carried forward from')) && log.rows.some(r => r[2].includes('Every page')));
    const before = new Set((await b.contexts()).map(c => c.context));
    await b.run(pw, `document.getElementById('chgPrintBtn').click();`, { user: true });
    pop = null;
    for (let i = 0; i < 40 && !pop; i++) { await b.sleep(100); pop = (await b.contexts()).find(c => !before.has(c.context))?.context || null; }
    check('🖨️ Print change log opens a print-ready table', pop && (await b.run(pop, `return document.querySelectorAll('tbody tr').length === 9 && !!document.querySelector('.pi polyline');`)));
    if (pop) await b.send('browsingContext.close', { context: pop });
    await b.run(pw, `closeChangeLog();`);

    // ---- Harvest log: the page's own answer and its entries ----
    const entSet = (qid, v) => `{ const el = document.querySelector('.ent-ctl[data-qid="${qid}"]'); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input')); }`;
    const hinst = () => b.run(pw, `return DB.paperWizard.entries.L100.harv.instances['${T}'];`);
    await b.run(pw, `await openRunner('L100', 'harv', '${T}'); runnerCtx.draft.plnt = '42'; runnerGo(1);
        ${entSet('tote', 'T1')} ${entSet('wetw', '10')} document.getElementById('entAddBtn').click();
        ${entSet('tote', 'T2')} ${entSet('wetw', '20')} document.getElementById('entAddBtn').click();`, { user: true });
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await b.sleep(150);
    check('a new harvest log saves with no correction', !(await pad()) && (await hinst())?.rows?.length === 2);
    await b.run(pw, `await openRunner('L100', 'harv', '${T}');`);
    check('reopened: the page is on file', (await b.run(pw, `return document.querySelector('.wiz-onfile')?.textContent || '';`)).includes('This page is on file'));
    await b.run(pw, `const el = document.getElementById('wizCtl'); el.value = '40'; el.dispatchEvent(new Event('input')); runnerGo(1);`);
    check('the Entries step says saved entries are on file', (await b.run(pw, `return document.querySelector('.wiz-onfile')?.textContent || '';`)).includes('Saved entries are on file'));
    await b.run(pw, `document.querySelector('.ent-edit[data-i="0"]').click();`, { user: true });
    check('changing a saved entry says it is a correction', (await b.run(pw, `return document.querySelector('.ent-form-title').textContent;`)).includes('on file'));
    await b.run(pw, `${entSet('wetw', '11')} document.getElementById('entAddBtn').click();`, { user: true });
    await b.run(pw, `window.__confirms = []; window.confirm = m => { window.__confirms.push(m); return true; }; document.querySelector('.ent-del[data-i="1"]').click();`, { user: true });
    const del = await b.run(pw, `return { msg: window.__confirms[0] || '', tag: [...document.querySelectorAll('.ent-row.void .ent-tag')].map(t => t.textContent).join(), n: runnerCtx.rep.tote.entries.length };`);
    check('deleting a saved entry keeps it, struck out, "deleted on Save"', del.msg.includes('is on file') && del.tag === 'deleted on Save' && del.n === 2, JSON.stringify(del));
    await b.run(pw, `document.querySelector('.ent-undo').click();`, { user: true });
    check('↩ puts it back', await b.run(pw, `return !document.querySelector('.ent-row.void') && !runnerCtx.rep.tote.entries[1].void;`));
    await b.run(pw, `document.querySelector('.ent-del[data-i="1"]').click(); ${entSet('tote', 'T3')} ${entSet('wetw', '30')} document.getElementById('entAddBtn').click();`, { user: true });
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await b.waitFor(pw, `return !!document.getElementById('corrOverlay');`);
    const hText = await b.run(pw, `return document.getElementById('corrList').textContent;`);
    check('the pad lists the page answer, the changed entry and the deleted one (not the new entry)', hText.includes('Plants harvested') && hText.includes('42') && hText.includes('Entry 1')
        && hText.includes('Entry 2') && hText.includes('deleted') && !hText.includes('T3'), hText);
    await signPad();
    let h = await hinst();
    check('saved: entry 2 stays, marked deleted; entry 1 and the page answer corrected', h.rows.length === 3 && !!h.rows[1].void && h.rows[1].tote === 'T2' && h.rows[0].wetw === '11'
        && h.header.plnt === '40' && h.changes.map(c => c.kind).sort().join() === 'edit,edit,void', JSON.stringify(h.changes?.map(c => c.kind + ':' + c.label)));
    check('the log still counts as complete', !!h.completedAt);
    const ew = await openTool(b, main, 'EmployeeWizard');
    const wet = await b.run(ew, `return rptRollup(rptAnswers(DB.data._PaperWizard.entries.L100, rptQuestionMap())).once['harvest.wetWeight'];`);
    check('Reports leave the deleted entry out (11 + 30 kg)', Math.round(wet) === 41000, String(wet));
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });

    await b.run(pw, `const c = document.createElement('canvas'); c.width = 85; c.height = 110; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 85, 110);
        const blob = await new Promise(r => c.toBlob(r, 'image/webp')); await loadPrintDocument([new File([blob], 'harv-p1.webp', { type: 'image/webp' })]);`);
    pop = await popup('harv', T);
    const [hp, w1, t2, w2, t3] = [await read('hpl'), await read('we1'), await read('to2'), await read('we2'), await read('to3')];
    check('page answer: 40, then 42 struck out', hp?.struck.join() === '42' && hp.lines[0] === '40', JSON.stringify(hp?.lines));
    check('entry 1: 11, then 10 struck out', w1?.struck.join() === '10' && w1.lines[0] === '11', JSON.stringify(w1?.lines));
    check('deleted entry 2: every value struck out, initials and date once at the end of the row', t2?.struck.join() === 'T2' && t2.ini === 0 && t2.lines.length === 1
        && w2?.struck.join() === '20' && w2.ini > 0 && w2.lines.length === 2 && w2.lines[0] === '20' && w2.lines[1].includes(md(T)), JSON.stringify([t2, w2]));
    check('entry 3 prints in the next row as usual', !t3?.corr && t3?.text === 'T3');
    await b.send('browsingContext.close', { context: pop });

    // ---- A backfilled phase change re-pages the log: each day's change history goes with it ----
    await b.run(pw, `const ini = { name: 'AB', strokes: ${JSON.stringify(pen)} };
        DB.paperWizard.entries.L200 = { glog2: { instances: { '${D1}': { phase: 'Bloom', room: 'Grow A', header: {}, phaseChangeDate: null, strikeInitials: null,
            snapshots: {}, signature: null, completedAt: null, printedAt: null, days: {
                '${D1}': { temp2: '20', phs2: 'Bloom', ini2: ini }, '${D2}': { temp2: '21', phs2: 'Bloom', ini2: ini }, '${D3}': { temp2: '22', phs2: 'Bloom', ini2: ini } } } } } };
        notifySitkaTools();`);
    const fix2 = async (day, vals) => {
        await b.run(pw, `await openRunner('L200', 'glog2', '${D1}', '${day}'); Object.assign(runnerCtx.draft, ${JSON.stringify(vals)});
            runnerCtx.idx = runnerSteps('glog2').length - 1; renderRunner();`);
        await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    };
    await fix2(D1, { temp2: '20.5' });
    await signPad();
    await fix2(D3, { temp2: '22.5' });
    await signPad();
    await b.run(pw, `window.confirm = () => true;`);
    await fix2(D2, { phs2: 'Harvesting' });
    await b.waitFor(pw, `return !!document.getElementById('strikePad');`);
    await b.drag(pw, '#strikePad', [[0.2, 0.5], [0.8, 0.5]]);
    await b.run(pw, `document.getElementById('strikeOkBtn').click();`, { user: true });
    check('the strike-out pad needs the initials typed as well as drawn', await b.run(pw, `return !!document.getElementById('strikePad') && document.getElementById('toast').textContent.includes('Type your initials');`));
    await b.run(pw, `document.getElementById('strikeName').value = 'RV'; document.getElementById('strikeOkBtn').click();`, { user: true });
    await b.waitFor(pw, `return !!document.getElementById('corrOverlay');`);
    const rpText = await b.run(pw, `return document.getElementById('corrList').textContent;`);
    check('re-paging: the pad lists the later day on file whose phase it changes', rpText.includes('Phase') && rpText.includes('Bloom') && rpText.includes('Harvesting') && rpText.includes('carried forward'), rpText);
    await signPad({ reason: 'Entered on the wrong day' });
    const rp = await b.run(pw, `const i = DB.paperWizard.entries.L200.glog2.instances; return Object.fromEntries(Object.entries(i).map(([k, v]) => [k,
        { days: Object.keys(v.days).sort(), pc: v.phaseChangeDate, d2: v.days['${D2}']?.phs2, changes: (v.changes || []).map(c => c.kind + ':' + c.q + ':' + c.day + ':' + c.from + '→' + c.to) }]));`);
    const [o, nw] = [rp[D1], rp[D2]];
    check('the log is struck out on day 2 and a new page starts that day', o?.pc === D2 && o.days.join() === `${D1},${D2}` && o.d2 === 'Bloom' && nw?.days.join() === `${D2},${D3}`, JSON.stringify(rp));
    check('day 1\'s correction stays on the old page; day 3\'s moves to the new page with it, plus the phase carried forward',
        o?.changes.join() === `edit:temp2:${D1}:20→20.5` && nw?.changes.includes(`edit:temp2:${D3}:22→22.5`) && nw?.changes.includes(`carried:phs2:${D3}:Bloom→Harvesting`) && nw.changes.length === 2,
        JSON.stringify([o?.changes, nw?.changes]));

    // ---- pH over EC in one cell: each prints in its own box, the current value at full size ----
    await b.run(pw, `await openRunner('L100', 'glog', '${D1}', '${D3}'); Object.assign(runnerCtx.draft, { phq: '6.0', ecq: '1.4' });
        runnerCtx.idx = runnerSteps('glog').length - 1; renderRunner();`);
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await signPad();
    await loadGlogDoc();
    pop = await popup('glog', D1);
    const cell = await b.run(pop, `const g = id => { const el = document.querySelector('.ov[data-fid="' + id + '"]'); const r = el.getBoundingClientRect();
            return { top: parseFloat(el.style.top), bot: parseFloat(el.style.top) + parseFloat(el.style.height), px: { top: r.top, bot: r.bottom }, fs: parseFloat(getComputedStyle(el).fontSize),
                fits: el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1, struck: [...el.querySelectorAll('s')].map(s => s.textContent),
                now: el.querySelector('.cn')?.textContent, nowFs: parseFloat(getComputedStyle(el.querySelector('.cn')).fontSize), oldFs: parseFloat(getComputedStyle(el.querySelector('.cv')).fontSize),
                oldAfter: el.querySelector('.cv').getBoundingClientRect().left > el.querySelector('.cn').getBoundingClientRect().right
                    || el.querySelector('.cv').getBoundingClientRect().top > el.querySelector('.cn').getBoundingClientRect().top + 5,
                over: (() => { const d = el.querySelector('.cdt').getBoundingClientRect(), i = el.querySelector('.ci').getBoundingClientRect(), v = el.querySelector('.cv').getBoundingClientRect();
                    return i.left < d.right && i.right > d.left && i.top < d.bottom && i.bottom > d.top && d.top >= v.bottom - 1 && Math.abs(d.left - v.left) < 1; })(),
                stackH: el.querySelector('.cr').getBoundingClientRect().height,
                under: (() => { const d = el.querySelector('.cdt').getBoundingClientRect();
                    const top = document.elementFromPoint(d.left + d.width / 2, d.top + d.height / 2);
                    return getComputedStyle(el.querySelector('.ci polyline')).stroke === 'rgb(102, 102, 102)' && !!top?.closest('.cdt'); })() }; };
        document.querySelector('.ov[data-fid="ph3"]').scrollIntoView({ block: 'center' });
        return { ph: g('ph3'), ec: g('ec3') };`);
    const { ph, ec } = cell;
    check('pH and EC each print the old value struck out and the new one', ph.struck.join() === '5.8' && ph.now === '6.0' && ec.struck.join() === '1.2' && ec.now === '1.4', JSON.stringify(cell));
    check('after the new value: the old value struck out, stacked over the date with the drawn initials on it',
        ph.oldAfter && ec.oldAfter && ph.over && ec.over, JSON.stringify(cell));
    check('the initials are drawn in dark grey, under the date', ph.under && ec.under, JSON.stringify([ph.under, ec.under]));
    check('the stack is about as tall as the new value (within its line)', [ph, ec].every(x => x.stackH >= x.fs * 0.8 && x.stackH <= x.fs * 1.15), JSON.stringify([ph.stackH, ec.stackH, ph.fs]));
    check('each prints exactly in its own box, whatever lines or grey blocks the form has',
        Math.abs(ph.top - 32) < 0.01 && Math.abs(ph.bot - 34.6) < 0.01 && Math.abs(ec.top - 34.8) < 0.01 && Math.abs(ec.bot - 37.4) < 0.01 && ph.px.bot <= ec.px.top + 0.5, JSON.stringify(cell));
    check('both fit their box: the new values at full size, the old ones small but no less than 5 pt', ph.fits && ec.fits && ph.nowFs === ph.fs && ec.nowFs === ec.fs
        && ph.oldFs < ph.fs * 0.6 && ec.oldFs < ec.fs * 0.6 && ph.oldFs >= 6.6 && ec.oldFs >= 6.6, JSON.stringify(cell));
    await b.send('browsingContext.close', { context: pop });

    // ---- Drawn initials need the typed initials too ----
    await b.run(pw, `await openRunner('L100', 'glog', '${D1}', '${today(-1)}'); runnerCtx.idx = runnerSteps('glog').length - 1; renderRunner();`);
    await b.drag(pw, '#qInitPad', [[0.2, 0.6], [0.5, 0.2], [0.8, 0.6]]);
    const gate = await b.run(pw, `return { hint: document.getElementById('wizFootSlot').textContent, save: !!document.getElementById('wizSaveBtn') };`);
    check('initials drawn but not typed: no Save, it asks for them', !gate.save && gate.hint.includes('Type your initials'), JSON.stringify(gate));
    await b.run(pw, `const n = document.getElementById('qInitName'); n.value = 'CD'; n.dispatchEvent(new Event('input'));`);
    check('typing them brings Save back', await b.run(pw, `return !!document.getElementById('wizSaveBtn');`));
    await b.run(pw, `closeRunner();`);

    await leave(b, pw); await b.send('browsingContext.close', { context: pw }).catch(() => {});
    await leave(b, main);
    return results;
}
