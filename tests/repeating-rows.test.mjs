// PaperWizard repeating rows: a harvest log with two tables that take any number of entries — dry weights on page 2
// (Flower / Trim / Other checkboxes, bin, tare, net) and wet weights on page 3. Set up the rows in Configure Sheets,
// add / change / delete entries in each table's Entries step, save, print (each table's page prints again when its
// rows are full), and the Labour & Cost Wizard's Reports add up every entry.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave, today } from './lib/helpers.mjs';

export const title = 'PaperWizard repeating rows (wet and dry weight tables over several pages)';

const WET_ROWS = 5;   // rows of the wet-weight table on page 3
const DRY_ROWS = 3;   // rows of the dry-weight table on page 2

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    const pw = await openTool(b, main, 'PaperWizard');
    const T = today();

    // ---- Configure Sheets: a 3-page harvest log ----
    await b.run(pw, `
        switchTab('configure');
        const page = async (n) => {
            const c = document.createElement('canvas'); c.width = 85; c.height = 110;
            const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 85, 110);
            const blob = await new Promise(r => c.toBlob(r, 'image/webp'));
            return new File([blob], 'harv-p' + n + '.webp', { type: 'image/webp' });
        };
        await handlePageImport({ target: { files: [await page(1), await page(2), await page(3)], value: '' } });`);
    check('the 3 page images load', await b.run(pw, `return configSheetId === 'harv' && cfgPageCount === 3;`));

    await b.run(pw, `
        cfgCadence = 'event'; cfgName = 'Harvest Log'; cfgDocument = 'harvest';
        const q = (id, label, type, extra = {}) => ({ id, label, type, options: [], rowScoped: false, sameAsLast: false, mandatory: false, prefillFrom: null, ...extra });
        cfgWizard.questions = [
            q('plnt', 'Plants harvested', 'number'),
            q('tote', 'Tote #', 'text'),
            q('wetw', 'Wet weight (kg)', 'number', { mandatory: true, metric: 'harvest.wetWeight', metricUnit: 'kg' }),
            q('dtyp', 'Type', 'select', { options: ['Flower', 'Trim', 'Other'], sameAsLast: true, mandatory: true }),
            q('dbin', 'Bin #', 'text'),
            q('tare', 'Tare (g)', 'number'),
            q('dnet', 'Net (g)', 'number', { metric: 'harvest.dryWeight', metricUnit: 'g' })
        ];
        const box = (id, label, x, y, page, more = {}) => ({ id, label, x, y, w: 0.15, h: 0.03, page, fontSize: 10, align: 'left',
            source: null, questionId: null, day: 1, dayGroup: null, checkbox: false, checkValue: '', ...more });
        const cb = (id, x, value) => box(id, value, x, 0.2, 2, { w: 0.03, questionId: 'dtyp', checkbox: true, checkValue: value });
        cfgFields = [
            box('hp01', 'Plants', 0.1, 0.1, 1, { questionId: 'plnt' }),
            box('pgno', 'Page #', 0.8, 0.02, 3, { source: 'page.number' }),
            box('pgct', 'Of', 0.9, 0.02, 3, { source: 'page.count' }),
            // page 3: wet weights
            box('enum', '#', 0.05, 0.2, 3, { source: 'entry.number' }),
            box('tot1', 'Tote', 0.25, 0.2, 3, { questionId: 'tote' }),
            box('wet1', 'Wet', 0.5, 0.2, 3, { questionId: 'wetw' }),
            // page 2: dry weights — "Other" has a typo, fixed after grouping
            cb('cbfl', 0.05, 'Flower'), cb('cbtr', 0.10, 'Trim'), cb('cbot', 0.15, 'Othr'),
            box('bin1', 'Bin', 0.3, 0.2, 2, { questionId: 'dbin' }),
            box('tar1', 'Tare', 0.5, 0.2, 2, { questionId: 'tare' }),
            box('net1', 'Net', 0.7, 0.2, 2, { questionId: 'dnet' })
        ];
        renderConfigure();`);
    // Group each table's row 1 (as Shift-click would select it)
    const group = async (ids, rows) => {
        await b.run(pw, `cfgSelection = { kind: 'field', id: ${JSON.stringify(ids[0])} }; cfgMultiSel = new Set(${JSON.stringify(ids.slice(1))});
            refreshCfgOverlays(); window.prompt = () => '${rows}';`);
        await b.run(pw, `document.getElementById('fpRepeatBtn').click();`, { user: true });
    };
    check('an event sheet offers 🔁 Group as repeating rows, not daily entry',
        await b.run(pw, `cfgSelection = { kind: 'field', id: 'enum' }; cfgMultiSel = new Set(['tot1']); refreshCfgOverlays();
            return !!document.getElementById('fpRepeatBtn') && !document.getElementById('fpGroupBtn');`));
    await group(['enum', 'tot1', 'wet1'], WET_ROWS);
    await group(['cbfl', 'cbtr', 'cbot', 'bin1', 'tar1', 'net1'], DRY_ROWS);
    const grouped = await b.run(pw, `const g = cfgFields.filter(f => f.repeat);
        return { wet: g.filter(f => f.page === 3).length, dry: g.filter(f => f.page === 2).length, cbs: g.filter(f => f.checkbox && f.questionId === 'dtyp').length };`);
    check(`grouping makes ${WET_ROWS} wet rows and ${DRY_ROWS} dry rows, bindings and checkboxes copied down`,
        grouped.wet === WET_ROWS * 3 && grouped.dry === DRY_ROWS * 6 && grouped.cbs === DRY_ROWS * 3, JSON.stringify(grouped));
    check('row badges read R2…', await b.run(pw, `return [...document.querySelectorAll('.field-box .box-day')].some(x => x.textContent === 'R${WET_ROWS}');`));

    // Fix the "Other" checkbox on row 3 — the whole column follows
    const row3Other = await b.run(pw, `return cfgFields.find(f => f.checkbox && f.page === 2 && f.day === 3 && Math.abs(f.x - 0.15) < 0.001).id;`);
    await b.run(pw, `cfgMultiSel = new Set(); selectCfgItem('field', '${row3Other}');
        const el = document.getElementById('fpCheckValue'); el.value = 'Other'; el.dispatchEvent(new Event('change'));`, { user: true });
    check('a checkbox value edited on row 3 follows down the column',
        await b.run(pw, `const col = cfgFields.filter(f => f.checkbox && f.page === 2 && Math.abs(f.x - 0.15) < 0.001); return col.length === ${DRY_ROWS} && col.every(f => f.checkValue === 'Other');`));

    // Stacked boxes in one cell (the grow log's Core / Grow checkboxes) are separate columns: rebinding or
    // re-valuing one, through the panel, changes its own column only
    const stacked = await b.run(pw, `
        const saved = cfgFields;
        const box = (id, y, d, value, qid) => ({ id, label: value, x: 0.16, y: y + d * 0.1, w: 0.03, h: 0.02, page: 1, fontSize: 10, align: 'left',
            source: null, questionId: qid, dayGroup: 'g9', day: d, checkbox: true, checkValue: value });
        cfgFields = [];
        for (let d = 1; d <= 3; d++) cfgFields.push(box('c' + d, 0.29, d, 'Core', 'tote'), box('g' + d, 0.31, d, 'Grow', 'tote'));
        cfgMultiSel = new Set(); selectCfgItem('field', 'g2');
        const q = document.getElementById('fpQuestionLink'); q.value = 'dbin'; q.dispatchEvent(new Event('change'));
        selectCfgItem('field', 'g2');
        const v = document.getElementById('fpCheckValue'); v.value = 'Bloom'; v.dispatchEvent(new Event('change'));
        const out = cfgFields.map(f => f.id + ':' + f.questionId + ':' + f.checkValue).sort().join(' ');
        cfgFields = saved; cfgSelection = null; refreshCfgOverlays();
        return out;`, { user: true });
    check('rebinding a stacked box changes its own column only, not the box stacked with it',
        stacked === 'c1:tote:Core c2:tote:Core c3:tote:Core g1:dbin:Bloom g2:dbin:Bloom g3:dbin:Bloom', stacked);

    // Re-spacing a grouped day row (🔗 Group as daily entry on an existing group) keeps stacked boxes apart
    const respaced = await b.run(pw, `
        const saved = cfgFields, savedCadence = cfgCadence;
        const box = (id, y, d) => ({ id, label: id, x: 0.16, y, w: 0.03, h: 0.02, page: 1, fontSize: 10, align: 'left',
            source: null, questionId: null, dayGroup: 'g9', day: d, checkbox: true, checkValue: '' });
        cfgCadence = 'daily-weekly';
        cfgFields = [box('c1', 0.30, 1), box('g1', 0.32, 1), box('c2', 0.40, 2), box('g2', 0.42, 2), box('c3', 0.55, 3), box('g3', 0.57, 3)];
        cfgSelection = { kind: 'field', id: 'c1' }; cfgMultiSel = new Set(['g1', 'c2', 'g2', 'c3', 'g3']);
        refreshCfgOverlays();
        document.getElementById('fpGroupBtn').click();
        const out = cfgFields.map(f => f.id + '@' + f.y.toFixed(2)).join(' ');
        cfgFields = saved; cfgCadence = savedCadence; cfgSelection = null; cfgMultiSel = new Set(); refreshCfgOverlays();
        return out;`, { user: true });
    check('re-spacing day rows keeps stacked boxes at their own height', respaced === 'c1@0.30 g1@0.32 c2@0.40 g2@0.42 c3@0.50 g3@0.52', respaced);

    // Resizing a box in a day row resizes its whole column (pH over EC: only pH's column); Alt/⌥ just that box
    await b.run(pw, `window.__savedCfg = { fields: cfgFields, cadence: cfgCadence };
        const box = (id, y, d) => ({ id, label: id, x: 0.3, y, w: 0.1, h: 0.02, page: 1, fontSize: 10, align: 'left',
            source: null, questionId: null, dayGroup: 'g9', day: d, checkbox: false, checkValue: '' });
        cfgCadence = 'daily-weekly';
        cfgFields = [box('p1', 0.30, 1), box('e1', 0.33, 1), box('p2', 0.40, 2), box('e2', 0.43, 2), box('p3', 0.50, 3), box('e3', 0.53, 3)];
        cfgSelection = { kind: 'field', id: 'p1' }; cfgMultiSel = new Set(); refreshCfgOverlays();`);
    const geo = () => b.run(pw, `return Object.fromEntries(cfgFields.map(f => [f.id, { x: f.x, y: f.y, w: f.w, h: f.h }]));`);
    await b.drag(pw, '.form-page[data-page="1"] .field-box[data-id="p1"] .handle.s', [[0.5, 0.5], [0.5, 3], [0.5, 5]]);
    let gm = await geo();
    check('dragging day 1\'s bottom edge makes every day\'s box in that column taller, each in its own row',
        gm.p1.h > 0.021 && gm.p2.h === gm.p1.h && gm.p3.h === gm.p1.h && gm.p2.y === 0.40 && gm.p3.y === 0.50 && ['e1', 'e2', 'e3'].every(k => gm[k].h === 0.02), JSON.stringify(gm));
    await b.run(pw, `selectCfgItem('field', 'e2'); const el = document.getElementById('fpH'); el.value = '0.025'; el.dispatchEvent(new Event('change'));`);
    gm = await geo();
    check('typing a height in Field properties sets the whole column too (the box stacked under it)', ['e1', 'e2', 'e3'].every(k => gm[k].h === 0.025) && gm.p2.h === gm.p1.h && gm.p1.h !== 0.025, JSON.stringify(gm));
    await b.run(pw, `selectCfgItem('field', 'p2');`);
    const hb = await b.run(pw, `const r = document.querySelector('.form-page[data-page="1"] .field-box[data-id="p2"] .handle.e').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height };`);
    const at = (fx, fy) => ({ x: Math.round(hb.x + fx * hb.w), y: Math.round(hb.y + fy * hb.h) });
    await b.send('input.performActions', { context: pw, actions: [
        { type: 'key', id: 'kb', actions: [{ type: 'keyDown', value: '\uE00A' }, { type: 'pause' }, { type: 'pause' }, { type: 'pause' }, { type: 'keyUp', value: '\uE00A' }] },
        { type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: [
            { type: 'pointerMove', ...at(0.5, 0.5), duration: 0 }, { type: 'pointerDown', button: 0 }, { type: 'pointerMove', ...at(4, 0.5), duration: 30 },
            { type: 'pointerUp', button: 0 }, { type: 'pause' }] }] });
    await b.send('input.releaseActions', { context: pw });
    gm = await geo();
    check('Alt/⌥-dragging resizes just that one box', gm.p2.w > 0.101 && gm.p1.w === 0.1 && gm.p3.w === 0.1, JSON.stringify(gm));
    await b.run(pw, `cfgFields = window.__savedCfg.fields; cfgCadence = window.__savedCfg.cadence; cfgSelection = null; cfgMultiSel = new Set(); refreshCfgOverlays();`);

    // The Repeating tick on the table questions (real clicks)
    await b.run(pw, `refreshWizardBuilder();
        for (const id of ['tote', 'wetw', 'dtyp', 'dbin', 'tare', 'dnet']) document.querySelector('.q-card[data-qid="' + id + '"] .q-rep').click();`, { user: true });
    check('ticking 🔁 Repeating marks the questions', await b.run(pw, `return cfgWizard.questions.filter(q => q.repeating).length === 6;`));
    check('an event sheet hides "Row-scoped (per day)"', await b.run(pw, `return !document.querySelector('.q-card .q-row');`));
    const tables = await b.run(pw, `return repeatTables({ cadence: cfgCadence, fields: cfgFields }, cfgWizard).map(t => ({ qs: t.qs.map(q => q.id).join(), page: t.page, perPage: t.perPage, label: t.label }));`);
    check('two tables found from the bindings (wet on page 3, dry on page 2)',
        tables.length === 2 && tables[0].qs === 'tote,wetw' && tables[0].page === 3 && tables[0].perPage === WET_ROWS
        && tables[1].qs === 'dtyp,dbin,tare,dnet' && tables[1].page === 2 && tables[1].perPage === DRY_ROWS, JSON.stringify(tables));

    // A table can't span pages
    await b.run(pw, `window.__alerts = []; window.alert = m => window.__alerts.push(m);
        cfgFields.find(f => f.id === 'net1').page = 3; saveSheet(); cfgFields.find(f => f.id === 'net1').page = 2;`);
    check('Save refuses a table whose rows are on two pages', await b.run(pw, `return !DB.paperWizard.sheets.harv && window.__alerts.some(m => m.includes('pages 2 and 3'));`));
    await b.run(pw, `saveSheet();`, { user: true });
    check('the sheet saves with both tables', await b.run(pw, `const s = DB.paperWizard.sheets.harv; return !!s && s.fields.filter(f => f.repeat).length === ${WET_ROWS * 3 + DRY_ROWS * 6};`));

    // ---- Harvest day: wet weights ----
    await b.run(pw, `switchTab('cabinet'); await openRunner('L100', 'harv', '${T}');`);
    check('steps: plants, wet-weight entries, dry-weight entries', (await b.run(pw, `return runnerSteps('harv').map(s => s.type === 'entries' ? 'E:' + s.table.page : s.id).join();`)) === 'plnt,E:3,E:2');
    await b.run(pw, `const el = document.getElementById('wizCtl'); el.value = '42'; el.dispatchEvent(new Event('input')); document.getElementById('wizNextBtn').click();`, { user: true });
    check('step 2 is the page 3 Entries step', await b.run(pw, `return !!document.getElementById('entAddBtn') && document.querySelector('.ent-where').textContent === 'page 3';`));

    const set = (qid, v) => b.run(pw, `const el = document.querySelector('.ent-ctl[data-qid="${qid}"]'); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input'));`);
    const add = () => b.run(pw, `document.getElementById('entAddBtn').click();`, { user: true });
    const count = (key) => b.run(pw, `return runnerCtx.rep['${key}'].entries.length;`);
    const wet = async (tote, kg) => { await set('tote', tote); await set('wetw', kg); };

    await wet('T1', '');
    await add();
    check('an entry without its mandatory weight is not added', (await count('tote')) === 0);
    for (let i = 1; i <= 7; i++) { await wet('T' + i, String(10 + i)); await add(); }
    check('7 wet entries added', (await count('tote')) === 7);
    check('the step says page 3 will print twice', (await b.run(pw, `return document.querySelector('.ent-cap').textContent;`)).includes('page 3 prints 2×'));
    await wet('T8', '18');
    await b.run(pw, `document.querySelector('.ent-ctl[data-qid="wetw"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));`);
    check('Enter on the last box adds the entry', (await count('tote')) === 8);
    await b.run(pw, `document.querySelector('.ent-edit[data-i="1"]').click();`, { user: true });
    check('✎ loads the entry into the form', await b.run(pw, `return document.querySelector('.ent-ctl[data-qid="wetw"]').value === '12' && document.getElementById('entAddBtn').textContent.includes('Update');`));
    await wet('T2', '12.5');
    await add();
    await b.run(pw, `window.confirm = () => true; document.querySelector('.ent-del[data-i="7"]').click();`, { user: true });
    const draft = await b.run(pw, `return runnerCtx.rep.tote.entries.map(r => r.tote + '=' + r.wetw).join(' ');`);
    check('changed and deleted in place', draft === 'T1=11 T2=12.5 T3=13 T4=14 T5=15 T6=16 T7=17', draft);

    // A typed entry left in the form is added by Save (from the last step)
    await wet('T8', '9');
    await b.run(pw, `runnerGo(1);`);
    check('step 3 is the page 2 Entries step', (await b.run(pw, `return document.querySelector('.ent-where')?.textContent;`)) === 'page 2');
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await b.sleep(200);
    let inst = await b.run(pw, `return DB.paperWizard.entries.L100.harv.instances['${T}'];`);
    check('Save keeps every wet entry, the typed one too', inst?.rows?.length === 8 && inst.rows[7].tote === 'T8' && inst.rows[7].wetw === '9', JSON.stringify(inst?.rows));
    check('each entry has its own id', inst && new Set(inst.rows.map(r => r.id)).size === 8);
    check('header answer saved as before', inst?.header?.plnt === '42');
    check('not complete yet: the dry-weight table is empty', !inst?.completedAt
        && (await b.run(pw, `return signatureMissing('harv', '${T}', DB.paperWizard.entries.L100.harv.instances['${T}']).join();`)) === 'no entries yet (page 2)');

    // ---- After drying: dry weights, picked with tap buttons ----
    await b.run(pw, `await openRunner('L100', 'harv', '${T}'); runnerGo(1); runnerGo(1);`);
    check('the saved wet entries are back', (await count('tote')) === 8);
    check('Type shows as tap buttons', (await b.run(pw, `return [...document.querySelectorAll('.ent-choice[data-qid="dtyp"]')].map(x => x.textContent).join();`)) === 'Flower,Trim,Other');
    const tap = v => b.run(pw, `document.querySelector('.ent-choice[data-qid="dtyp"][data-v="${v}"]').click();`, { user: true });
    const dry = async (type, bin, tare, net) => { if (type) await tap(type); await set('dbin', bin); await set('tare', tare); await set('dnet', net); await add(); };
    await dry('Flower', 'B-1', '400', '2300');
    check('tapping a type picks it', (await b.run(pw, `return runnerCtx.rep.dtyp.entries[0].dtyp;`)) === 'Flower');
    check('the next entry starts on the same type (same-as-last)', await b.run(pw, `return document.querySelector('.ent-choice.on')?.dataset.v === 'Flower';`));
    await dry(null, 'B-2', '410', '2200');
    await dry('Trim', 'B-3', '390', '800');
    await tap('Other'); await tap('Other');
    check('tapping the picked type again clears it', await b.run(pw, `return !document.querySelector('.ent-choice.on') && runnerCtx.rep.dtyp.form.dtyp === '';`));
    await dry('Other', 'B-4', '300', '150');
    check('4 dry entries', (await count('dtyp')) === 4);
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await b.sleep(200);
    inst = await b.run(pw, `return DB.paperWizard.entries.L100.harv.instances['${T}'];`);
    check('both tables saved: 8 wet then 4 dry entries', inst?.rows?.length === 12 && inst.rows.slice(0, 8).every(r => 'tote' in r) && inst.rows.slice(8).every(r => r.dtyp), JSON.stringify(inst?.rows?.slice(8)));
    check('now the log counts as complete', !!inst?.completedAt);
    check('SitkaTools has the entries', (await b.run(main, `return DB.data._PaperWizard.entries.L100.harv.instances['${T}'].rows.length;`)) === 12);

    // ---- Print: 1, 2, 2, 3, 3 ----
    const before = new Set((await b.contexts()).map(c => c.context));
    await b.run(pw, `printDoc = { sheetId: 'harv', pages: loadedDoc.pages }; openPrintPopup('L100', 'harv', '${T}');`, { user: true });
    let pop = null;
    for (let i = 0; i < 40 && !pop; i++) { await b.sleep(100); pop = (await b.contexts()).find(c => !before.has(c.context))?.context || null; }
    const pages = pop ? await b.run(pop, `return [...document.querySelectorAll('.pp-page')].map(p => ({
        text: [...p.querySelectorAll('.ov')].map(s => s.textContent),
        ticked: [...p.querySelectorAll('.ov-cb.on')].map(s => Math.round(parseFloat(s.style.left)) + '@' + Math.round(parseFloat(s.style.top))) }));`) : [];
    check('5 pages print (1, 2, 2, 3, 3)', pages.length === 5, String(pages.length));
    const [, d1, d2, w1, w2] = pages.map(p => p || { text: [], ticked: [] });
    check('dry page holds entries 1–3, the copy entry 4', ['B-1', 'B-3', '2300', '800'].every(t => d1.text.includes(t)) && d2.text.includes('B-4') && !d2.text.includes('B-1'), `${d1.text} / ${d2.text}`);
    check('the right box is ticked on each row (Flower, Flower, Trim / Other)', d1.ticked.join() === '5@20,5@23,10@26' && d2.ticked.join() === '15@20', `${d1.ticked} / ${d2.ticked}`);
    check('wet page holds entries 1–5, its copy 6–8, numbered on', ['T1', '11', 'T5', '1', '5'].every(t => w1.text.includes(t)) && ['T6', 'T8', '9', '6', '8'].every(t => w2.text.includes(t)) && !w2.text.includes('T1'), `${w1.text} / ${w2.text}`);
    check('unused rows print blank', w2.text.filter(t => t === '').length >= 2 * 3 && !w2.text.includes('N/A') && d2.text.filter(t => t === '').length >= 2 * 3, w2.text.join('|'));
    check('page number / count follow the printout (4 of 5, 5 of 5)', w1.text[0] === '4' && w1.text[1] === '5' && w2.text[0] === '5' && w2.text[1] === '5', `${w1.text.slice(0, 2)} / ${w2.text.slice(0, 2)}`);
    if (pop) await b.send('browsingContext.close', { context: pop });

    // ---- Closing with unsaved entries asks first ----
    await b.run(pw, `await openRunner('L100', 'harv', '${T}'); runnerGo(1);`);
    await wet('T9', '20');
    await add();
    await b.run(pw, `window.confirm = () => false; document.getElementById('wizCloseBtn').click();`, { user: true });
    check('✕ with unsaved entries asks, and Cancel keeps the wizard open', await b.run(pw, `return !!runnerCtx && runnerCtx.rep.tote.entries.length === 9;`));
    await b.run(pw, `window.confirm = () => true; document.getElementById('wizCloseBtn').click();`, { user: true });
    check('confirming closes it, the saved log unchanged', await b.run(pw, `return !runnerCtx && DB.paperWizard.entries.L100.harv.instances['${T}'].rows.length === 12;`));
    await b.run(pw, `await openRunner('L100', 'harv', '${T}'); window.confirm = () => { window.__asked = true; return true; }; window.__asked = false; document.getElementById('wizCloseBtn').click();`, { user: true });
    check('closing with nothing changed doesn\'t ask', await b.run(pw, `return !runnerCtx && !window.__asked;`));

    // ---- Reports add up every entry ----
    const ew = await openTool(b, main, 'EmployeeWizard');
    const once = await b.run(ew, `return rptRollup(rptAnswers(DB.data._PaperWizard.entries.L100, rptQuestionMap())).once;`);
    check('Reports: wet weight = the sum of every wet entry (in g)', Math.round(once['harvest.wetWeight']) === (11 + 12.5 + 13 + 14 + 15 + 16 + 17 + 9) * 1000, String(once['harvest.wetWeight']));
    check('Reports: dry weight = the sum of every bin\'s net', Math.round(once['harvest.dryWeight']) === 2300 + 2200 + 800 + 150, String(once['harvest.dryWeight']));

    for (const c of [ew, pw]) { await leave(b, c); await b.send('browsingContext.close', { context: c }).catch(() => {}); }
    await leave(b, main);
    return results;
}
