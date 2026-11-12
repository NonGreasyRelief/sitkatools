// PaperWizard 🧮 formulas (user request 2026-11-07): boxes worked out when the page prints (a running subtotal that
// starts again on each copy of a page, the page's subtotal, a total from another sheet, days between two dates, the
// building of a room ticked by itself), questions worked out instead of asked (a bin's net weight = gross − tare, shown
// as it's typed; the flower total, kept for Reports), the copy number of a repeating page, the new lot values (plants
// harvested and destroyed from the grow log, clones cut, the starting count, the Veg start), and the harvest pack's
// five sheets in examples/harvest-pack importing and checking out.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave, today } from './lib/helpers.mjs';

export const title = 'PaperWizard formulas (totals, subtotals per page, worked-out answers, cross-sheet values)';

const ROWS = 3;   // rows of the bin table on the test form

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today(), D = today;
    const db = fixtureDb();
    db.lots.L100.startPlantCount = 120;
    db.lots.L101 = { name: 'L101', strain: 'Test Kush', stage: 'cloning', createdDate: '2026-09-01', destRoom: 'Grow A', currentRoom: 'Grow A', plantCount: 30, startPlantCount: 30, parentLotId: 'L100', type: 'sub-lot' };
    // A grow log: its Vegetation page, and a page where 2 plants were destroyed, 3 culled and 95 harvested
    db._PaperWizard = {
        sheets: { glog: { name: 'Grow Log', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'daily-weekly', document: 'grow-log', fields: [], signature: null } },
        wizards: { wzgl: { sheetId: 'glog', name: 'Grow Log', questions: [{ id: 'pc', label: 'Plants', type: 'plant-count', rowScoped: true, options: [] }] } },
        entries: { L100: { glog: { instances: {
            '2026-08-10': { phase: 'Vegetation', room: 'Clone 1', header: {}, days: { '2026-08-12': { pc: '100' } } },
            [D(-3)]: { phase: 'Bloom', room: 'Grow 1', header: {}, phaseChangeDate: D(-2), days: {
                [D(-3)]: { pc: '95', _removed: { destroyed: 2, culled: 3 } }, [D(-2)]: { pc: '0', _removed: { harvested: 95 } } } } } } } }
    };
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db);
    await b.send('browsingContext.setViewport', { context: main, viewport: { width: 900, height: 900 } });
    const pw = await openTool(b, main, 'PaperWizard');
    await b.run(pw, `window.__alerts = []; window.alert = m => window.__alerts.push(String(m)); window.confirm = () => true;`);
    const alerts = () => b.run(pw, `return window.__alerts.splice(0).join(' | ');`);

    // ---- A sheet that totals another one: imported, formula and all (cleanSheetImport keeps it as text) ----
    const other = {
        format: 'paperwizard-sheet', version: 1, sheetId: 'wets',
        sheet: { name: 'Wet weights', orientation: 'portrait', pageCount: 1, cadence: 'event', document: 'harvest', signature: null, fields: [
            { id: 'w1', label: 'Wet', x: 0.5, y: 0.2, w: 0.2, h: 0.03, page: 1, questionId: 'wet', repeat: true, dayGroup: 'gw', day: 1 },
            { id: 'w2', label: 'Wet', x: 0.5, y: 0.25, w: 0.2, h: 0.03, page: 1, questionId: 'wet', repeat: true, dayGroup: 'gw', day: 2 },
            { id: 'evil', label: 'x', x: 0.1, y: 0.9, w: 0.3, h: 0.03, page: 1, source: 'calc', calc: '<img src=x onerror="window.__pwned=1">' }] },
        wizards: { wzw: { sheetId: 'wets', name: 'Wet weights', questions: [{ id: 'wet', label: 'Wet (g)', type: 'number', repeating: true, options: [] }] } }
    };
    await b.run(pw, `switchTab('configure');
        handleSheetImport({ target: { files: [new File([${JSON.stringify(JSON.stringify(other))}], 'wets.json')], value: '' } });
        await new Promise(r => setTimeout(r, 200));`);
    check('a sheet with a formula imports', await b.run(pw, `return DB.paperWizard.sheets.wets?.fields.find(f => f.id === 'evil')?.calc === '<img src=x onerror="window.__pwned=1">';`), await alerts());
    await b.run(pw, `const s = pageStore('L100', true); s.wets = { instances: { '${D(-2)}': { header: {}, days: {}, rows: [{ id: 'r1', wet: '1500' }, { id: 'r2', wet: '2,500' }, { id: 'r3', wet: '' }] } } };`);

    // ---- Configure Sheets: the bin table and its formulas ----
    await b.run(pw, `
        const files = [];
        for (let i = 1; i <= 2; i++) { const c = document.createElement('canvas'); c.width = 85; c.height = 110; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 85, 110);
            files.push(new File([await new Promise(r => c.toBlob(r, 'image/webp'))], 'cure-p' + i + '.webp', { type: 'image/webp' })); }
        await handlePageImport({ target: { files, value: '' } });
        cfgCadence = 'event'; cfgName = 'Curing'; cfgDocument = 'harvest';
        const q = (id, label, type, extra = {}) => ({ id, label, type, options: [], rowScoped: false, sameAsLast: false, mandatory: false, prefillFrom: null, ...extra });
        cfgWizard.questions = [
            q('bin', 'Bin #', 'text', { repeating: true, mandatory: true }),
            q('typ', 'Type', 'select', { repeating: true, options: ['Flower', 'Trim'], mandatory: true }),
            q('tare', 'Tare (g)', 'number', { repeating: true, mandatory: true }),
            q('gross', 'Gross (g)', 'number', { repeating: true, mandatory: true }),
            q('net', 'Net (g)', 'number', { repeating: true, metric: 'harvest.dryWeight', metricUnit: 'g' }),
            q('tot', 'Flower total (g)', 'number', { metric: 'harvest.flowerTotal', metricUnit: 'g' }),
            q('start', 'Start date', 'text', { prefillFrom: 'sheet.periodStart' }),
            q('end', 'End date', 'text')
        ];
        const box = (id, label, x, y, page, more = {}) => ({ id, label, x, y, w: 0.12, h: 0.03, page, fontSize: 10, align: 'left',
            source: null, questionId: null, day: 1, dayGroup: null, checkbox: false, checkValue: '', ...more });
        cfgFields = [
            box('bn1', 'Bin', 0.05, 0.2, 1, { questionId: 'bin' }), box('ta1', 'Tare', 0.2, 0.2, 1, { questionId: 'tare' }),
            box('gr1', 'Gross', 0.35, 0.2, 1, { questionId: 'gross' }), box('nt1', 'Net', 0.5, 0.2, 1, { questionId: 'net' }),
            box('rs1', 'Page so far', 0.65, 0.2, 1, { source: 'calc', calc: 'pagerunsum({net})' }),
            box('fl1', 'Flower', 0.8, 0.2, 1, { questionId: 'typ', checkbox: true, checkValue: 'Flower', w: 0.03 }),
            box('sub', 'Page subtotal', 0.5, 0.6, 1, { source: 'calc', calc: 'pagesum({net})' }),
            box('cpn', 'Copy', 0.7, 0.9, 1, { source: 'copy.number' }), box('cpc', 'Of', 0.8, 0.9, 1, { source: 'copy.count' }),
            box('bld', 'B1', 0.05, 0.05, 1, { source: 'calc', calc: 'building(lot.destRoom)', checkbox: true, checkValue: 'B1', w: 0.03 }),
            box('tt2', 'Flower total', 0.5, 0.1, 2),
            box('wt2', 'Wet total', 0.5, 0.15, 2, { source: 'calc', calc: 'sum({wets/wet})' }),
            box('ls2', 'Loss', 0.5, 0.2, 2, { source: 'calc', calc: '{wt2} - {tt2}' }),
            box('dy2', 'Days', 0.5, 0.25, 2, { source: 'calc', calc: 'days({start}, {end})' }),
            box('hv2', 'Harvested', 0.5, 0.3, 2, { source: 'log.plantsHarvested' }), box('ds2', 'Destroyed', 0.5, 0.35, 2, { source: 'log.plantsDestroyed' }),
            box('cl2', 'Clones', 0.5, 0.4, 2, { source: 'lot.clonesProduced' }), box('sp2', 'Started', 0.5, 0.45, 2, { source: 'lot.startPlantCount' }),
            box('vg2', 'Veg start', 0.5, 0.5, 2, { source: 'log.vegStart' }), box('ev2', 'Evil', 0.5, 0.55, 2, { source: 'calc', calc: '{wets/evil}' })
        ];
        cfgSelection = { kind: 'field', id: 'bn1' }; cfgMultiSel = new Set(['ta1', 'gr1', 'nt1', 'rs1', 'fl1']);
        renderConfigure(); window.prompt = () => '${ROWS}';`);
    await b.run(pw, `document.getElementById('fpRepeatBtn').click();`, { user: true });
    check('the row-1 boxes, a formula box among them, group into repeating rows', await b.run(pw, `return cfgFields.filter(f => f.dayGroup && f.source === 'calc' && f.calc === 'pagerunsum({net})').length === ${ROWS};`));

    // The Flower-total box gets its question; the Net question is ticked 🧮 Worked out (real clicks)
    await b.run(pw, `cfgFields.find(f => f.id === 'tt2').questionId = 'tot'; refreshWizardBuilder();
        document.querySelector('.q-card[data-qid="net"] .q-calc-on').click();`, { user: true });
    check('ticking 🧮 Worked out shows its formula editor', await b.run(pw, `return !!document.getElementById('qCalc_net') && cfgWizard.questions.find(q => q.id === 'net').calc === '';`));
    await b.run(pw, `document.getElementById('qCalc_net').focus();`, { user: true });
    await b.keys(pw, '{gross} - {tare}');
    check('typing the formula keeps it on the question, and it reads with the questions\' labels',
        await b.run(pw, `return cfgWizard.questions.find(q => q.id === 'net').calc === '{gross} - {tare}'
            && document.querySelector('.fx-reads[data-for="qCalc_net"]').textContent === '= «Gross (g)» - «Tare (g)»';`),
        await b.run(pw, `return document.querySelector('.fx-reads[data-for="qCalc_net"]')?.textContent;`));
    await b.run(pw, `document.querySelector('.q-card[data-qid="tot"] .q-calc-on').click();`, { user: true });
    await b.run(pw, `const ta = document.getElementById('qCalc_tot'); ta.focus(); ta.setSelectionRange(0, 0);`, { user: true });
    await b.keys(pw, 'sum(');
    await b.run(pw, `const s = document.querySelector('.fx-insert[data-for="qCalc_tot"]'); s.value = '{net}'; s.dispatchEvent(new Event('change'));`, { user: true });
    await b.keys(pw, ', {typ} = "Flower")');
    check('the Insert picker puts a reference at the cursor', (await b.run(pw, `return cfgWizard.questions.find(q => q.id === 'tot').calc;`)) === 'sum({net}, {typ} = "Flower")');

    // A box's formula through Field properties: an unknown reference is an error, and Save refuses it
    await b.run(pw, `selectCfgItem('field', 'ls2');`, { user: true });
    check('a formula box shows its formula in Field properties', await b.run(pw, `return document.getElementById('fpSource').value === 'calc' && document.getElementById('fpCalc').value === '{wt2} - {tt2}';`));
    await b.run(pw, `const ta = document.getElementById('fpCalc'); ta.value = '{wt2} - {nope}'; ta.dispatchEvent(new Event('input'));`, { user: true });
    check('an unknown reference shows as an error', (await b.run(pw, `return document.querySelector('.fx-probs[data-for="fpCalc"]').textContent;`)).includes('no box or question "nope"'));
    await b.run(pw, `saveSheet();`);
    check('Save refuses a formula that can\'t be worked out', !(await b.run(pw, `return !!DB.paperWizard.sheets.cure;`)) && (await alerts()).includes('nope'));
    await b.run(pw, `const ta = document.getElementById('fpCalc'); ta.value = '{wt2} - {tt2}'; ta.dispatchEvent(new Event('input'));`, { user: true });
    check('a per-entry answer outside sum() is flagged', (await b.run(pw, `return fxProblems('{net} + 1', 'cure', { f: cfgFields.find(f => f.id === 'sub') }).warnings.join();`)).includes('sum({net})'));
    await b.run(pw, `saveSheet();`, { user: true });
    check('the sheet saves', await b.run(pw, `return !!DB.paperWizard.sheets.cure && isCalcQ(wizardForSheet('cure').questions.find(q => q.id === 'net'));`), await alerts());

    // ---- The wizard: Net worked out as the bin is typed, the flower total shown, both kept on Save ----
    await b.run(pw, `switchTab('cabinet'); await openRunner('L100', 'cure', '${T}');`);
    check('worked-out questions aren\'t asked: entries, then the two dates', (await b.run(pw, `return runnerSteps('cure').map(s => s.type === 'entries' ? 'E' : s.id).join();`)) === 'E,start,end');
    const set = (qid, v) => b.run(pw, `const el = document.querySelector('.ent-ctl[data-qid="${qid}"]'); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input'));`);
    const tap = v => b.run(pw, `document.querySelector('.ent-choice[data-qid="typ"][data-v="${v}"]').click();`, { user: true });
    const add = () => b.run(pw, `document.getElementById('entAddBtn').click();`, { user: true });
    const shown = () => b.run(pw, `return document.querySelector('.ent-calc[data-qid="net"]').textContent;`);
    check('Net shows — before anything is typed', (await shown()) === '—');
    await set('bin', 'C-1'); await tap('Flower'); await set('gross', '1200');
    await set('tare', '200');
    check('Net = Gross − Tare as it\'s typed', (await shown()) === '1000');
    await add();
    for (const [bin, type, tare, gross] of [['C-2', 'Flower', '200', '1150.5'], ['C-3', 'Trim', '150', '650'], ['C-4', 'Flower', '200', '900']]) {
        await set('bin', bin); await tap(type); await set('tare', tare); await set('gross', gross); await add();
    }
    check('the entries keep their worked-out Net', (await b.run(pw, `return runnerCtx.rep.bin.entries.map(r => r.net).join();`)) === '1000,950.5,500,700');
    check('the page\'s worked-out total shows on the Entries step', (await b.run(pw, `return document.querySelector('.ent-calc-sum').textContent;`)).includes('2650.5'));
    await b.run(pw, `runnerGo(1); runnerGo(1); const el = document.getElementById('wizCtl'); el.value = '${D(9)}'; el.dispatchEvent(new Event('input'));`);
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await b.sleep(250);
    let inst = await b.run(pw, `return DB.paperWizard.entries.L100.cure.instances['${T}'];`);
    check('Save keeps the worked-out answers: each Net and the flower total', inst?.header?.tot === '2650.5' && inst.rows.map(r => r.net).join() === '1000,950.5,500,700', JSON.stringify(inst?.header));
    check('the page counts as complete without anyone answering the worked-out ones', !!inst?.completedAt);

    // ---- Print: subtotals per copy, the running subtotal starting again, the copy number, cross-sheet values ----
    const printTexts = async () => {
        const before = new Set((await b.contexts()).map(c => c.context));
        await b.run(pw, `printDocs.set('cure', { sheetId: 'cure', pages: loadedDoc.pages }); openPrintPopup('L100', 'cure', '${T}');`, { user: true });
        let pop = null;
        for (let i = 0; i < 40 && !pop; i++) { await b.sleep(100); pop = (await b.contexts()).find(c => !before.has(c.context))?.context || null; }
        const out = pop ? await b.run(pop, `return [...document.querySelectorAll('.pp-page')].map(p => ({
            v: Object.fromEntries([...p.querySelectorAll('.ov')].map(s => [s.dataset.fid, s.textContent])),
            on: [...p.querySelectorAll('.ov-cb.on')].map(s => s.dataset.fid),
            struck: [...p.querySelectorAll('.ov-corr s')].map(s => s.textContent), pwned: !!window.__pwned || !!p.querySelector('img:not([data-pg])') }));`) : [];
        if (pop) await b.send('browsingContext.close', { context: pop });
        return out;
    };
    let pp = await printTexts();
    check('page 1 prints twice (4 bins, 3 rows), then page 2', pp.length === 3, String(pp.length));
    const col = (pg, base) => Object.entries(pg?.v || {}).filter(([k]) => k === base || k.startsWith(base)).map(([, v]) => v);
    check('each copy\'s subtotal is its own entries (pagesum)', pp[0]?.v.sub === '2450.5' && pp[1]?.v.sub === '700', `${pp[0]?.v.sub} / ${pp[1]?.v.sub}`);
    check('the running subtotal starts again on the second copy (pagerunsum)', pp[0] && Object.values(pp[0].v).includes('1950.5') && Object.values(pp[0].v).includes('2450.5') && pp[1] && Object.values(pp[1].v).includes('700') && !Object.values(pp[1].v).includes('3150.5'),
        `${col(pp[0], 'rs')} / ${col(pp[1], 'rs')}`);
    check('copy number and count: 1 of 2, 2 of 2', pp[0]?.v.cpn === '1' && pp[0]?.v.cpc === '2' && pp[1]?.v.cpn === '2' && pp[1]?.v.cpc === '2');
    check('a formula tick box ticks the lot\'s building (building(lot.destRoom) = B1)', pp[0]?.on.includes('bld') && pp[1]?.on.includes('bld'));
    const p2 = pp[2]?.v || {};
    check('page 2: the worked-out total, the other sheet\'s total ("2,500" read as 2500), their difference, days', p2.tt2 === '2650.5' && p2.wt2 === '4000' && p2.ls2 === '1349.5' && p2.dy2 === '9', JSON.stringify(p2));
    check('page 2: plants harvested 95 and destroyed 5 (2 + 3 culled) from the grow log, clones cut 30, started with 120, Veg start',
        p2.hv2 === '95' && p2.ds2 === '5' && p2.cl2 === '30' && p2.sp2 === '120' && p2.vg2 === '2026-08-12', JSON.stringify(p2));
    check('a formula that isn\'t one prints N/A, and nothing in it runs', p2.ev2 === 'N/A' && !pp.some(p => p.pwned));

    // ---- A correction: the Net and the total it changes are carried forward, struck out on the page ----
    await b.run(pw, `await openRunner('L100', 'cure', '${T}'); document.querySelector('.ent-edit[data-i="0"]').click();`, { user: true });
    await set('gross', '1300');
    check('changing an entry on file shows its new Net', (await shown()) === '1100');
    await b.run(pw, `document.getElementById('entAddBtn').click(); runnerGo(1); runnerGo(1); document.getElementById('wizSaveBtn').click();`, { user: true });
    await b.waitFor(pw, `return !!document.getElementById('corrOverlay');`);
    const listed = await b.run(pw, `return document.querySelector('#corrOverlay').textContent;`);
    check('the correction pad lists the gross, and the Net and total as carried forward',
        /Gross \(g\).*1200.*1300/.test(listed) && /Net \(g\).*1000.*1100.*carried forward/.test(listed) && /Flower total \(g\).*2650\.5.*2750\.5.*carried forward/.test(listed), listed.slice(0, 400));
    await b.run(pw, `[...document.querySelectorAll('.corr-reason')].find(x => x.dataset.r === 'Typing error')?.click(); document.getElementById('corrName').value = 'WT';`, { user: true });
    await b.drag(pw, '#corrPad', [[0.2, 0.7], [0.3, 0.2], [0.4, 0.7]]);
    await b.run(pw, `document.getElementById('corrOkBtn').click();`, { user: true });
    await b.sleep(250);
    inst = await b.run(pw, `return DB.paperWizard.entries.L100.cure.instances['${T}'];`);
    check('saved: the new Net and total, the changes on record (worked-out ones as carried)', inst.header.tot === '2750.5' && inst.rows[0].net === '1100'
        && inst.changes.filter(c => c.kind === 'carried').map(c => c.q).sort().join() === 'net,tot' && inst.changes.some(c => c.kind === 'edit' && c.q === 'gross'), JSON.stringify(inst.changes?.map(c => [c.kind, c.q])));
    pp = await printTexts();
    check('the page prints the corrected subtotal; the old total is struck out beside the new one', pp[0]?.v.sub === '2550.5' && pp[2]?.struck.includes('2650.5'), `${pp[0]?.v.sub} / ${pp[2]?.struck}`);

    // ---- Reports count the worked-out answers ----
    const ew = await openTool(b, main, 'EmployeeWizard');
    const once = await b.run(ew, `return rptRollup(rptAnswers(DB.data._PaperWizard.entries.L100, rptQuestionMap())).once;`);
    check('Reports: dry weight = every bin\'s worked-out Net, flower = the worked-out total', Math.round(once['harvest.dryWeight']) === Math.round(1100 + 950.5 + 500 + 700) && once['harvest.flowerTotal'] === 2750.5, JSON.stringify(once));

    // ---- The harvest pack (examples/harvest-pack): every sheet imports, saves and its formulas check out ----
    const pw2 = await openTool(b, main, 'PaperWizard');
    await b.run(pw2, `window.__alerts = []; window.alert = m => window.__alerts.push(String(m)); window.confirm = () => true; switchTab('configure');`);
    const PACK = { 'harvest-log': [3, 'page 2: 4 rows · page 3: 25 rows'], 'drying-log': [1, ''], 'trim-log': [1, ''],
        'curing-log': [3, 'page 1 · table 1: 4 rows · page 1 · table 2: 2 rows · page 2: 21 rows'], 'lot-summary': [2, ''] };
    for (const [sid, [n, tables]] of Object.entries(PACK)) {
        const res = await b.run(pw2, `
            const txt = await (await fetch('${BASE}/examples/harvest-pack/${sid}.json')).text();
            handleSheetImport({ target: { files: [new File([txt], '${sid}.json')], value: '' } });
            await new Promise(r => setTimeout(r, 200));
            const files = [];
            for (let i = 1; i <= ${n}; i++) { const c = document.createElement('canvas'); c.width = 85; c.height = 110; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 85, 110);
                files.push(new File([await new Promise(r => c.toBlob(r, 'image/webp'))], '${sid}-p' + i + '.webp', { type: 'image/webp' })); }
            await handlePageImport({ target: { files, value: '' } });
            saveSheet();
            const probs = [];
            for (const q of cfgWizard.questions) if (isCalcQ(q)) { const p = fxProblems(q.calc, '${sid}', { q }); probs.push(...p.errors, ...p.warnings); }
            for (const f of cfgFields) if (f.source === 'calc') { const p = fxProblems(f.calc, '${sid}', { f }); probs.push(...p.errors, ...p.warnings); }
            const s = DB.paperWizard.sheets['${sid}'];
            return { saved: !!s, alerts: window.__alerts.splice(0), probs, tables: repeatTables(s, wizardForSheet('${sid}')).map(t => t.label + ': ' + t.perPage + ' rows').join(' · ') };`);
        check(`harvest pack: ${sid} imports and saves, its formulas check out`, res.saved && !res.alerts.length && !res.probs.length && res.tables === tables, JSON.stringify(res));
    }

    for (const c of [ew, pw, pw2]) await b.send('browsingContext.close', { context: c }).catch(() => {});
    await leave(b, main);
    return results;
}
