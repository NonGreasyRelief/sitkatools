// PaperWizard facility and building paperwork (no lot): a facility form (a destruction log with an entries table) and
// a building form (a sanitation form), picked from the Active Lot dropdown, filled and printed. With split files a
// building form is saved in its building's file. A facility form is one record in Main.json that every building adds to
// at once: what a building device adds waits in its own file's queue, the office merges every building's additions into
// Main (new entries by id, never removing or changing what's on file), and a building drops its queue once Main has it.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, splitFiles, openSplit, saveSplit, openTool, leave, today } from './lib/helpers.mjs';

export const title = 'PaperWizard facility & building paperwork, and buildings adding to facility forms at once';

const sheet = (name, document, fields) => ({ name, orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1,
    cadence: 'event', document, fields, signature: null });
const box = (id, label, y, more = {}) => ({ id, label, x: 0.1, y, w: 0.4, h: 0.03, page: 1, fontSize: 10, align: 'left',
    source: null, questionId: null, day: 1, dayGroup: null, checkbox: false, checkValue: '', ...more });
const q = (id, label, type = 'text', more = {}) => ({ id, label, type, options: [], rowScoped: false, sameAsLast: false, mandatory: false, prefillFrom: null, ...more });
// The destruction log's entries table: three rows of Material / kg
const tableRows = () => [1, 2, 3].flatMap(n => [
    box(`tm${n}`, 'Material', 0.4 + n * 0.05, { questionId: 'mat', repeat: true, dayGroup: 'tb01', day: n }),
    box(`tk${n}`, 'kg', 0.4 + n * 0.05, { x: 0.6, w: 0.2, questionId: 'kg', repeat: true, dayGroup: 'tb01', day: n })
]);

function paperDb() {
    const db = fixtureDb();
    db._PaperWizard = {
        sheets: {
            destr: sheet('Destruction Log', 'facility', [box('dw1', 'Supervisor', 0.1, { questionId: 'what' }), box('dl1', 'Lot', 0.2, { source: 'lot.name' }),
                box('db1', 'Started at', 0.3, { source: 'building.name' }), ...tableRows()]),
            sanit: sheet('Sanitation Form', 'building', [box('so1', 'OK', 0.1, { questionId: 'okq' }), box('sb1', 'Building', 0.2, { source: 'building.name' })]),
            glog: { ...sheet('Grow Log', null, []), cadence: 'daily-weekly' }
        },
        wizards: {
            wd01: { id: 'wd01', sheetId: 'destr', name: 'Destruction', questions: [q('what', 'Supervisor'), q('mat', 'Material', 'text', { repeating: true }), q('kg', 'kg', 'number', { repeating: true })] },
            ws01: { id: 'ws01', sheetId: 'sanit', name: 'Sanitation', questions: [q('okq', 'All surfaces clean?')] },
            wg01: { id: 'wg01', sheetId: 'glog', name: 'Grow', questions: [q('cnt', 'Plant count', 'plant-count', { rowScoped: true })] }
        },
        entries: {}
    };
    return db;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today();
    let main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, paperDb());
    let pw = await openTool(b, main, 'PaperWizard');

    const options = (ctx) => b.run(ctx, `return [...document.getElementById('lotSelect').options].map(o => o.value || o.textContent);`);
    let opts = await options(pw);
    check('the dropdown lists 🏭 Facility and 🏢 each building above the lots', opts.slice(0, 4).join() === '↓ Facility & buildings,@facility,@building:B1,@building:B2' && opts.includes('L100'), opts.join(' | '));
    check('a facility or building form is not in a lot\'s cabinet', await b.run(pw, `document.getElementById('lotSelect').value = 'L100'; document.getElementById('lotSelect').dispatchEvent(new Event('change'));
        const t = document.getElementById('cabinetPanel').textContent; return !t.includes('Destruction Log') && !t.includes('Sanitation Form');`));

    // ---- Configure Sheets: the two Document values; a form with a plant-count question can't become one ----
    const docOpts = await b.run(pw, `switchTab('configure'); openSavedSheet('glog'); renderConfigure();
        return [...document.getElementById('sheetDocSelect').options].map(o => o.value);`);
    check('Document offers 🏭 Facility form and 🏢 Building form', docOpts.includes('facility') && docOpts.includes('building'), docOpts.join());
    const refused = await b.run(pw, `const s = document.getElementById('sheetDocSelect'); s.value = 'facility'; s.dispatchEvent(new Event('change'));
        return { doc: DB.paperWizard.sheets.glog.document, toast: document.getElementById('toast').textContent };`);
    check('a form asking the plant count can\'t be made a facility form', !refused.doc && refused.toast.includes('Plant count'), JSON.stringify(refused));
    check('a facility form\'s wizard builder offers no plant count / phase / room', await b.run(pw, `openSavedSheet('destr'); renderConfigure();
        const types = [...document.querySelectorAll('.q-type option')].map(o => o.value); return types.length > 0 && !types.some(t => ['plant-count', 'phase', 'room'].includes(t));`));
    await b.run(pw, `switchTab('cabinet');`);

    // Fill a page: header answers into the draft, entries through the Entries step's form, then Save
    const pick = (ctx, v) => b.run(ctx, `const s = document.getElementById('lotSelect'); s.value = '${v}'; s.dispatchEvent(new Event('change'));`);
    const fill = async (ctx, cab, sheetId, { header = null, entries = [] } = {}) => {
        await b.run(ctx, `await openRunner('${cab}', '${sheetId}', '${T}');`);
        if (!(await b.run(ctx, `return !!runnerCtx;`))) return false;
        if (header) await b.run(ctx, `Object.assign(runnerCtx.draft, ${JSON.stringify(header)});`);
        const ei = await b.run(ctx, `return runnerSteps('${sheetId}').findIndex(s => s.type === 'entries');`);
        if (ei >= 0) {
            await b.run(ctx, `runnerCtx.idx = ${ei}; renderRunner();`);
            for (const e of entries) {
                for (const [qid, v] of Object.entries(e)) await b.run(ctx, `const el = document.querySelector('.ent-ctl[data-qid="${qid}"]'); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input'));`);
                await b.run(ctx, `document.getElementById('entAddBtn').click();`, { user: true });
            }
        }
        await b.run(ctx, `runnerCtx.idx = runnerSteps('${sheetId}').length - 1; renderRunner();`);
        await b.run(ctx, `document.getElementById('wizSaveBtn').click();`, { user: true });
        await b.sleep(250);
        return true;
    };
    const page = (ctx) => b.run(ctx, `return DB.data?._PaperWizard?.facilityEntries?.destr?.instances?.['${T}'] || null;`);
    const mats = p => (p?.rows || []).map(r => r.mat + (r.void ? ' (void)' : ''));

    // ---- Single file (the office): a facility page and a Building 1 page ----
    await pick(pw, '@facility');
    check('the facility cabinet offers a New entry for the destruction log', await b.run(pw, `return [...document.querySelectorAll('#cabinetPanel .cab-leaf')].some(l => l.textContent.includes('📅 New entry · Destruction Log') && l.querySelector('.cab-fill'));`));
    await fill(pw, '@facility', 'destr', { header: { what: 'Casey' }, entries: [{ mat: 'Stems', kg: '2' }] });
    await pick(pw, '@building:B1');
    await fill(pw, '@building:B1', 'sanit', { header: { okq: 'Yes' } });
    await b.sleep(400);
    let st = await b.run(main, `const p = DB.data._PaperWizard; const f = p.facilityEntries?.destr?.instances?.['${T}'];
        return { what: f?.header?.what, rows: f?.rows, by: f?.by, bl: p.buildingEntries?.B1?.sanit?.instances?.['${T}']?.header?.okq, lots: Object.keys(p.entries || {}).length, unsaved: hasUnsavedChanges };`);
    check('single file: one shared facility page (facilityEntries.destr), the building page under buildingEntries.B1', st.what === 'Casey' && st.bl === 'Yes' && st.lots === 0 && st.unsaved, JSON.stringify(st));
    check('the page says where it was started, and its entry when and where it was added', st.by === 'office' && st.rows?.length === 1 && st.rows[0].mat === 'Stems' && st.rows[0].by === 'office' && !!st.rows[0].at, JSON.stringify(st.rows));
    check('the status bar names the cabinet', (await b.run(pw, `return document.getElementById('statusText').textContent;`)).includes('🏢 Building 1 paperwork'));

    // Print: building.name prints the building (where the facility page was started), a lot binding prints N/A
    const loadDoc = (id) => b.run(pw, `const c = document.createElement('canvas'); c.width = 85; c.height = 110; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 85, 110);
        const blob = await new Promise(r => c.toBlob(r, 'image/webp')); await loadPrintDocument([new File([blob], '${id}-p1.webp', { type: 'image/webp' })]);`);
    const popup = async (cab, sheetId) => {
        const before = new Set((await b.contexts()).map(c => c.context));
        await b.run(pw, `openPrintPopup('${cab}', '${sheetId}', '${T}');`, { user: true });
        let pop = null;
        for (let i = 0; i < 40 && !pop; i++) { await b.sleep(100); pop = (await b.contexts()).find(c => !before.has(c.context))?.context || null; }
        return pop;
    };
    const ov = (pop, fid) => b.run(pop, `return document.querySelector('.ov[data-fid="${fid}"]')?.textContent ?? null;`);
    await loadDoc('sanit');
    let pop = await popup('@building:B1', 'sanit');
    check('a building form prints, with building.name = its building', pop && (await ov(pop, 'so1')) === 'Yes' && (await ov(pop, 'sb1')) === 'Building 1');
    if (pop) await b.send('browsingContext.close', { context: pop });
    await loadDoc('destr');
    pop = await popup('@facility', 'destr');
    check('a facility form prints its entries; a lot binding prints N/A, building.name "Office"', pop && (await ov(pop, 'dw1')) === 'Casey' && (await ov(pop, 'tm1')) === 'Stems' && (await ov(pop, 'dl1')) === 'N/A' && (await ov(pop, 'db1')) === 'Office');
    if (pop) await b.send('browsingContext.close', { context: pop });

    // A correction cancelled at the pad leaves everything as it was
    const before = await b.run(pw, `return JSON.stringify(DB.paperWizard);`);
    await b.run(pw, `await openRunner('@facility', 'destr', '${T}'); runnerCtx.draft.what = 'Drew'; runnerCtx.idx = runnerSteps('destr').length - 1; renderRunner();`);
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await b.waitFor(pw, `return !!document.getElementById('corrOverlay');`);
    await b.run(pw, `document.getElementById('corrCancelBtn').click();`, { user: true });
    await b.sleep(200);
    check('a cancelled correction on a facility page changes nothing', (await b.run(pw, `return JSON.stringify(DB.paperWizard);`)) === before);
    await b.run(pw, `closeRunner();`);

    // ---- Split files ----
    const db1 = await b.run(main, `return DB.data;`);
    await b.send('browsingContext.close', { context: pw });
    const files = await splitFiles(b, main, BASE, db1);
    const m0 = JSON.parse(files['Main.json']), b0 = JSON.parse(files['Building-B1.json']);
    check('split: the facility form stays in Main.json, the building page goes to Building-B1.json',
        m0._PaperWizard.facilityEntries?.destr?.instances?.[T] && !m0._PaperWizard.buildingEntries && b0._PaperWizard.buildingEntries?.B1?.sanit && !JSON.parse(files['Building-B2.json'])._PaperWizard.buildingEntries);

    // ---- Building 1's device adds an entry to the office's page ----
    check('B1 device opened the files', await openSplit(b, main, BASE, 'B1', files));
    pw = await openTool(b, main, 'PaperWizard');
    opts = await options(pw);
    check('B1 device: the dropdown lists Facility and Building 1 only', opts.includes('@facility') && opts.includes('@building:B1') && !opts.includes('@building:B2'), opts.join(' | '));
    await pick(pw, '@facility');
    const leaves = await b.run(pw, `return [...document.querySelectorAll('#cabinetPanel .cab-leaf')].map(l => ({ t: l.textContent.replace(/\\s+/g, ' ').trim(), fill: !!l.querySelector('.cab-fill') }));`);
    check('B1 device: today\'s facility page can be added to (and there\'s no second page for today)', leaves.length === 1 && leaves[0].fill, JSON.stringify(leaves));
    const locks = await b.run(pw, `await openRunner('@facility', 'destr', '${T}'); runnerCtx.idx = 0; renderRunner(); const ctl = document.getElementById('wizCtl').disabled;
        runnerCtx.idx = runnerSteps('destr').findIndex(s => s.type === 'entries'); renderRunner();
        const r = { ctl, onFile: document.querySelector('.ent-row .ent-tag')?.textContent || '', edit: document.querySelectorAll('.ent-edit, .ent-del').length }; closeRunner(); return r;`);
    check('B1 device: what\'s on file is locked (the answer, and the entry: no ✎ or 🗑)', locks.ctl && locks.onFile.includes('on file') && locks.edit === 0, JSON.stringify(locks));
    await b.run(pw, `await openRunner('@facility', 'destr', '${T}'); runnerCtx.draft.what = 'Someone else'; runnerCtx.idx = runnerSteps('destr').length - 1; renderRunner();`);
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await b.sleep(250);
    st = await b.run(pw, `return { toast: document.getElementById('toast').textContent, what: DB.data._PaperWizard.facilityEntries.destr.instances['${T}'].header.what, pad: !!document.getElementById('corrOverlay') };`);
    check('B1 device: changing an answer on file is refused, nothing saved', st.what === 'Casey' && !st.pad && st.toast.includes('buildings add to facility forms'), JSON.stringify(st));
    await b.run(pw, `closeRunner();`);
    await fill(pw, '@facility', 'destr', { entries: [{ mat: 'Leaves', kg: '1.5' }] });
    check('B1 device: its entry is added after the office\'s', mats(await page(pw)).join() === 'Stems,Leaves', JSON.stringify(mats(await page(pw))));
    await b.sleep(400);
    const s1 = await saveSplit(b, main);
    check('B1 saves only Building-B1.json', Object.keys(s1).join() === 'Building-B1.json', Object.keys(s1).join(', '));
    check('no "can\'t be saved from this device" warning', !b.logs.some(l => l.includes("can't be saved")));
    const q1 = JSON.parse(s1['Building-B1.json'])._PaperWizard.facilityQueue || {};
    check('Building-B1.json queues the page with its entry', mats(q1[`destr|${T}`]?.inst).join() === 'Stems,Leaves' && q1[`destr|${T}`].inst.rows[1].by === 'B1', JSON.stringify(q1));
    await b.send('browsingContext.close', { context: pw });

    // ---- Building 2's device, at the same time, from the same files: adds its own entry ----
    check('B2 device opened the files (as they were before B1 saved)', await openSplit(b, main, BASE, 'B2', files));
    pw = await openTool(b, main, 'PaperWizard');
    await pick(pw, '@facility');
    await fill(pw, '@facility', 'destr', { entries: [{ mat: 'Roots', kg: '3' }] });
    await b.sleep(400);
    const s2 = await saveSplit(b, main);
    check('B2 saves only Building-B2.json, with its entry queued', Object.keys(s2).join() === 'Building-B2.json' &&
        mats(JSON.parse(s2['Building-B2.json'])._PaperWizard.facilityQueue?.[`destr|${T}`]?.inst).join() === 'Stems,Roots', Object.keys(s2).join(', '));
    await b.send('browsingContext.close', { context: pw });

    // ---- The office opens: both buildings' entries come in, in the order they were added ----
    const files2 = { ...files, ...s1, ...s2 };
    check('office opened all files', await openSplit(b, main, BASE, 'office', files2));
    st = await b.run(main, `return { unsaved: hasUnsavedChanges, toast: syncToastText.textContent };`);
    check('office: both buildings\' entries are merged into the one page, nothing lost or doubled', mats(await page(main)).join() === 'Stems,Leaves,Roots', JSON.stringify(mats(await page(main))));
    check('office: marked unsaved, with a 📥 toast naming both buildings', st.unsaved && st.toast.includes('📥 Facility forms: additions from Building 1, Building 2'), JSON.stringify(st));
    const s3 = await saveSplit(b, main);
    check('office saves Main.json only (the buildings\' queues untouched)', Object.keys(s3).join() === 'Main.json', Object.keys(s3).join(', '));
    check('Main.json now holds all three entries', mats(JSON.parse(s3['Main.json'])._PaperWizard.facilityEntries.destr.instances[T]).join() === 'Stems,Leaves,Roots');

    // The office strikes out B1's entry; B1's old queue (still in its file) doesn't bring it back
    await b.run(main, `DB.data._PaperWizard.facilityEntries.destr.instances['${T}'].rows[1].void = { at: new Date().toISOString(), by: { name: 'CA', strokes: [[0.2, 0.2, 0.8, 0.8]] } }; markUnsaved();`);
    const s4 = await saveSplit(b, main);
    const files4 = { ...files2, ...s3, ...s4 };
    check('office reopens with the buildings\' old queues still in their files', await openSplit(b, main, BASE, 'office', files4));
    st = await b.run(main, `return hasUnsavedChanges;`);
    check('…the struck-out entry stays struck out, nothing to take in', mats(await page(main)).join() === 'Stems,Leaves (void),Roots' && st === false, JSON.stringify([mats(await page(main)), st]));

    // ---- Each building, reopening with the new Main, lets its queue go ----
    for (const bid of ['B1', 'B2']) {
        check(`${bid} reopened`, await openSplit(b, main, BASE, bid, files4));
        check(`${bid}: sees the merged page`, mats(await page(main)).join() === 'Stems,Leaves (void),Roots');
        const plan = await b.run(main, `const p = DbSplit.plan(); return { save: p.toSave, q: p.parts['Building-${bid}.json']._PaperWizard.facilityQueue || null };`);
        check(`${bid}: Main has everything it added, so its queue is released`, plan.save.includes(`Building-${bid}.json`) && !plan.q, JSON.stringify(plan));
    }

    // The merge rule itself: blanks are filled, nothing on file is changed or removed, entries matched by id
    const u = await b.run(main, `return DbSplit.unionFacilityPage(
        { header: { a: 'on file', b: '' }, days: { d1: { x: '1', y: '' } }, rows: [{ id: 'r1', m: 'kept' }, { id: 'r2', m: 'struck', void: { at: 't' } }], signature: null },
        { header: { a: 'changed', b: 'filled', c: 'new' }, days: { d1: { x: '9', y: '2' }, d2: { x: '3' } }, rows: [{ id: 'r1', m: 'edited' }, { id: 'r2', m: 'struck' }, { id: 'r3', m: 'added' }], signature: { name: 'AB' } });`);
    check('merge rule: answers on file stay, blanks are filled, new days and entries are added, struck entries stay struck',
        u.header.a === 'on file' && u.header.b === 'filled' && u.header.c === 'new' && u.days.d1.x === '1' && u.days.d1.y === '2' && u.days.d2.x === '3' &&
        u.rows.map(r => r.m).join() === 'kept,struck,added' && !!u.rows[1].void && u.signature?.name === 'AB', JSON.stringify(u));

    await leave(b, main);
    return results;
}
