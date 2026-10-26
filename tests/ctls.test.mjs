// 📋 CTLS month (Labour & Cost Wizard → Reports): a hand-worked September with every kind of change — a new lot, a
// sub-lot (clones cut), a split lot, culls, samples sent to a lab, a sale to another company, a harvest, a recount, a
// count changed with no reason, a lot closed out mid-month (from its saved plant history), wet weight hanging over the
// month end and dry flower sent out. Then Mark as filed, a change after filing, PaperWizard's "To whom?" box, and
// SitkaTools' Received from, starting count and close-out warning.
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';

export const title = 'CTLS month: plants, wet and dry cannabis, filing, and who plants went to';

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
function daysFrom(a, b) {
    const out = [], [y, m, d] = a.split('-').map(Number), dt = new Date(y, m - 1, d, 12);
    for (;;) { const s = iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()); if (s > b) break; out.push(s); dt.setDate(dt.getDate() + 1); }
    return out;
}
const q = (id, label, type, extra = {}) => ({ id, label, type, options: [], rowScoped: false, sameAsLast: false, mandatory: false, prefillFrom: null, ...extra });

export function ctlsDb() {
    const db = fixtureDb();
    db.rooms.R1DR = { name: 'Dry 1', description: null, createdDate: '2026-01-01', assignedLots: [], isFlowering: false, buildingId: 'B1' };
    db.buildings.B1.assignedRooms.push('R1DR');
    const lot = (id, created, n, more = {}) => ({ name: id, strain: 'Test Kush', stage: 'flower', createdDate: created, closedDate: null, destRoom: 'Grow 1', cloningRoom: 'Clone 1',
        vegRoom: null, dryRoom: 'Dry 1', trimRoom: 'Dry 1', currentRoom: 'Grow 1', plantCount: n, ...more });
    db.lots = {
        A100: lot('A100', '2026-08-20', 0, { type: 'new-lot', startPlantCount: 100, receivedFrom: 'Green Nursery Ltd' }),
        B200: lot('B200', '2026-09-15', 12, { type: 'split-lot', parentLotId: 'A100', plantsTransferred: 10, startPlantCount: 10 }),
        C300: lot('C300', '2026-09-08', 50, { type: 'sub-lot', parentLotId: 'A100', startPlantCount: 50, currentRoom: 'Clone 1', stage: 'cloning' }),
        D400: lot('D400', '2026-07-01', 0, { type: 'new-lot', startPlantCount: 40 }),
        E500: lot('E500', '2026-08-15', 28)   // an older lot: no type, no starting count
    };
    db.calendarEvents = [];
    // One page per lot is enough here: the report reads days, whatever page they're on
    const page = (first, last, count, extra = {}) => {
        const days = {};
        for (const d of daysFrom(first, last)) days[d] = { cnt: String(count(d)), init: { name: 'KT', strokes: [] }, ...(extra[d] || {}) };
        return { [first]: { phase: 'Bloom', room: 'Grow 1', header: {}, days, phaseChangeDate: null, strikeInitials: null, snapshots: {}, signature: null, completedAt: null, printedAt: null } };
    };
    const ev = (key, more) => ({ [key]: { phase: 'Harvesting', room: 'Dry 1', header: {}, days: {}, rows: [], snapshots: {}, signature: null, completedAt: null, printedAt: null, ...more } });
    db._PaperWizard = {
        sheets: { glog: { name: 'Grow Log', cadence: 'daily-weekly', document: 'grow-log', fields: [] }, harv: { name: 'Harvest Log', cadence: 'event', document: 'harvest', fields: [] } },
        wizards: {
            wg: { sheetId: 'glog', name: 'Grow Log', questions: [q('cnt', 'Plant count', 'plant-count', { rowScoped: true }), q('cmt', 'Comments', 'text', { rowScoped: true }), q('init', 'Initials', 'initials', { rowScoped: true })] },
            wh: { sheetId: 'harv', name: 'Harvest Log', questions: [q('wet', 'Wet weight', 'number', { repeating: true, metric: 'harvest.wetWeight', metricUnit: 'g' }),
                q('dry', 'Dry weight', 'number', { metric: 'harvest.dryWeight', metricUnit: 'kg' })] }
        },
        entries: {
            A100: {
                glog: { instances: page('2026-08-20', '2026-09-20', d => d < '2026-09-05' ? 100 : d < '2026-09-10' ? 97 : d < '2026-09-15' ? 94 : d < '2026-09-20' ? 84 : 0, {
                    '2026-09-05': { _removed: { culled: 2, sampled: 1 }, _removedTo: { sampled: 'Lab North' } },
                    '2026-09-10': { _removed: { sold: 3 }, _removedTo: { sold: 'Acme Cannabis Inc.' } },
                    '2026-09-15': { _removed: { moved: 10 } },
                    '2026-09-20': { _removed: { harvested: 84 } } }) },
                harv: { instances: ev('2026-09-20', { rows: [{ id: 'r1', wet: '5000' }, { id: 'r2', wet: '3400.5' }] }) }
            },
            B200: { glog: { instances: page('2026-09-15', '2026-09-30', d => d < '2026-09-25' ? 10 : 12, { '2026-09-25': { _added: { n: 2, reason: 'recounted — the last count was wrong' } } }) } },
            D400: {
                glog: { instances: page('2026-07-01', '2026-08-25', d => d < '2026-08-25' ? 40 : 0, { '2026-08-25': { _removed: { harvested: 40 } } }) },
                harv: { instances: { ...ev('2026-08-25', { rows: [{ id: 'r3', wet: '3000' }] }), ...ev('2026-09-12', { header: { dry: '0.7' } }) } }
            },
            E500: { glog: { instances: page('2026-09-01', '2026-09-30', d => d < '2026-09-18' ? 30 : 28) } }
        }
    };
    // Closed out: F600 with its plant history saved (destroyed Sep 3), G700 saved before the history existed
    const summary = (lotId, dates, ctls) => ({ version: ctls ? 4 : 3, lotId, strain: 'Old Haze', savedAt: '2026-09-10T00:00:00.000Z', parentLotId: null,
        rooms: { cloning: null, veg: null, flower: 'Grow 1', dry: null, trim: null }, flowerRoomId: 'R1G1', buildingId: 'B1', canopySqFt: null, lightCount: null,
        dates: { day0: null, planting: null, transplant: null, flip: null, harvestStart: null, harvestEnd: null, tankClean: null, bucking: null, trimStart: null, trimEnd: null, ship: null, ...dates },
        labour: { est: 0, act: 0, temp: 0, tempCost: 0, tempNoWage: 0, byPerson: {}, byTask: {}, chores: {} },
        weights: { wet: null, dry: null, grades: {}, flower: null, trim: null, total: null }, lab: { potency: null, terpenes: null }, plants: { started: 20, harvested: null },
        derived: {}, env: { veg: {}, flower: {}, waterL: null, nutrientMl: null, nutrientByProduct: {}, lightPct: null }, recipeId: null, ipm: { flagDays: 0, hermDays: 0 },
        ...(ctls ? { ctls } : {}) });
    db._EmployeeWizard.crops = {
        F600: summary('F600', { day0: '2026-08-01' }, { v: 1, type: 'new-lot', created: '2026-08-01', start: 20, from: null, parent: null, dryRoom: null, room: 'Grow 1', stage: 'flower', logged: true,
            counts: [['2026-08-01', 20, 'Grow 1', 'Bloom'], ['2026-09-03', 0, 'Grow 1', 'Bloom']], moves: [{ date: '2026-09-03', kind: 'removed', reason: 'destroyed', n: 20, by: 'KT' }], wet: [], dry: [] }),
        G700: summary('G700', { day0: '2026-07-01', harvestStart: '2026-09-05', ship: '2026-09-25' }, null)
    };
    return db;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    let main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, ctlsDb());
    const ew = await openTool(b, main, 'EmployeeWizard');
    await b.run(ew, `window.confirm = () => true; document.getElementById('tabReports').click();`, { user: true });
    await b.run(ew, `document.querySelector('#rptPages button[data-page="ctls"]').click();`, { user: true });
    check('📋 CTLS month opens on last month, with no filters (it is the whole facility)', await b.run(ew, `return RPT.ctlsMonth === ctlsDefaultMonth() && getComputedStyle(document.getElementById('rptPeriod').closest('.form-group')).display === 'none' && !!document.getElementById('ctlsMonth');`));
    await b.run(ew, `RPT.ctlsMonth = '2026-09'; renderReports();`);

    // ---- Plants ----
    const C = await b.run(ew, `const C = ctlsModel('2026-09'); return { opening: C.opening, closing: C.closing, tot: C.tot, rows: C.rows.map(r => [r.date, r.lotId, r.bucket, r.delta, r.party, r.by]),
        atEnd: C.atEnd.map(o => [o.lotId, o.n, o.room, o.phase]), wet: C.wet, hanging: C.hanging.map(h => [h.lotId, h.g, h.room]), dry: C.shippedOut.map(d => [d.date, d.lotId, d.g, d.how]), dryTotal: C.shippedTotal, dried: C.dried,
        checks: C.checks.map(c => c.text) };`);
    check('opening: the plants on hand on Aug 31 (100 + 30 + 20 from the closed-out lot)', C.opening === 150, C.opening);
    check('closing: the plants on hand on Sep 30 (12 + 50 + 28)', C.closing === 90, C.closing);
    const T = C.tot;
    check('totals by reason: clones cut +50, destroyed −20, culled −2, sampled −1, sold −3, harvested −84, recount +2, no reason −2',
        T.produced === 50 && T.destroyed === -20 && T.culled === -2 && T.sampled === -1 && T.sold === -3 && T.harvested === -84 && T.adjust === 2 && T.unexplained === -2 && !T.received, JSON.stringify(T));
    check('a split lot and the plants moved into it are shown, net 0 (not a facility change)', T.internal === 0 && C.rows.filter(r => r[2] === 'internal').length === 2, JSON.stringify(C.rows.filter(r => r[2] === 'internal')));
    check('opening + every change = closing', C.opening + Object.values(T).reduce((a, v) => a + v, 0) === C.closing);
    const row = (lot, bucket) => C.rows.find(r => r[1] === lot && r[2] === bucket);
    check('the sale names the company, the sample its lab, and the initials of who recorded them', row('A100', 'sold')?.[4] === 'Acme Cannabis Inc.' && row('A100', 'sampled')?.[4] === 'Lab North' && row('A100', 'sold')?.[5] === 'KT', JSON.stringify(C.rows));
    check('a lot closed out mid-month counts from its saved plant history', row('F600', 'destroyed')?.[0] === '2026-09-03' && row('F600', 'destroyed')?.[3] === -20);
    check('an older lot\'s count dropping with no reason is listed as such, on its day', JSON.stringify(row('E500', 'unexplained')) === JSON.stringify(['2026-09-18', 'E500', 'unexplained', -2, '', '']), JSON.stringify(row('E500', 'unexplained')));
    check('the month-end table lists every lot with plants, its room and phase', JSON.stringify(C.atEnd) === JSON.stringify([['B200', 12, 'Grow 1', 'Bloom'], ['C300', 50, 'Clone 1', 'Cloning'], ['E500', 28, 'Grow 1', 'Bloom']]), JSON.stringify(C.atEnd));

    // ---- Wet hanging, dry sent out ----
    check('wet: 3,000 g hanging on Aug 31, 8,400.5 g harvested, 3,000 g dried, 8,400.5 g hanging on Sep 30',
        C.wet.opening === 3000 && C.wet.in === 8400.5 && C.wet.out === 3000 && C.wet.closing === 8400.5 && JSON.stringify(C.hanging) === JSON.stringify([['A100', 8400.5, 'Dry 1']]), JSON.stringify([C.wet, C.hanging]));
    // D400 has no Weigh & Ship task: its dry weight ships on the day it's recorded, as before (cost audit 2026-10-26)
    check('shipped out: 0.7 kg answered in kg, 700 g on the day it was recorded (no Weigh & Ship task)', JSON.stringify(C.dry) === JSON.stringify([['2026-09-12', 'D400', 700, 'dry']]) && C.dryTotal === 700 && C.dried.closing === 0, JSON.stringify([C.dry, C.dried]));

    // ---- Checks ----
    check('checks: the sub-lot with no grow log, the count with no reason, the lot closed without its plant history', C.checks.length === 3
        && C.checks.some(t => t.startsWith('Lot C300 has no grow log yet')) && C.checks.some(t => t.includes('lot E500 on Sep 18 (−2)')) && C.checks.some(t => t.includes('G700') && t.includes('Import the archive')), C.checks.join(' | '));

    // ---- The page and its print ----
    const text = await b.run(ew, `return document.getElementById('rptBody').innerText;`);
    check('the page shows the month, its totals and kilograms to 3 decimals', text.includes('CTLS monthly numbers — September 2026') && /Closing: plants on hand at the end of Sep 30\s+90/.test(text)
        && text.includes('8,400.5 g · 8.401 kg') && text.includes('0.700 kg') && text.includes('Acme Cannabis Inc.'), text.slice(0, 300));
    const before = (await b.contexts()).length;
    await b.run(ew, `document.getElementById('ctlsPrint').click();`, { user: true });
    await b.sleep(400);
    const ctxs = await b.contexts(), pr = ctxs.length > before ? ctxs[ctxs.length - 1].context : null;
    const printText = pr ? await b.run(pr, `return document.body.innerText;`) : '';
    check('🖨️ Print opens it in a light window to print', printText.includes('CTLS monthly numbers, September 2026') && printText.includes('Plants on hand at the end of Sep 30'), printText.slice(0, 200));
    if (pr) await b.send('browsingContext.close', { context: pr });

    // ---- Mark as filed, then a change after filing ----
    await b.run(ew, `document.getElementById('ctlsFile').click();`, { user: true });
    await b.sleep(300);
    const filed = await b.run(main, `return DB.data._EmployeeWizard.ctls?.['2026-09'];`);
    check('Mark as filed keeps September\'s closing numbers, and SitkaTools has them to save', filed?.plants === 90 && filed.wetG === 8400.5 && filed.shippedG === 700 && filed.driedG === 0 && filed.rule === 2 && !!filed.filedAt, JSON.stringify(filed));
    let octChecks = await b.run(ew, `return ctlsModel('2026-10').checks.map(c => c.text);`);
    check('October\'s opening matches September\'s filing: nothing to say', !octChecks.some(t => t.includes('was filed with different closing numbers')), octChecks.join(' | '));
    await b.run(main, `const d = DB.data._PaperWizard.entries.E500.glog.instances['2026-09-01'].days['2026-09-30']; d.cnt = '27'; d._removed = { destroyed: 1 }; markUnsaved(); broadcastToSubtools();`);
    await b.waitFor(ew, `return DB.data._PaperWizard.entries.E500.glog.instances['2026-09-01'].days['2026-09-30'].cnt === '27';`);
    octChecks = await b.run(ew, `return ctlsModel('2026-10').checks.map(c => c.text);`);
    check('a September day changed after filing: October says the opening no longer matches what was filed', octChecks.some(t => t.startsWith('September 2026 was filed with different closing numbers') && t.includes('90 plants → 89 (−1)')), octChecks.join(' | '));
    const sepChecks = await b.run(ew, `return ctlsModel('2026-09').checks.map(c => c.text);`);
    check('…and September says it changed since it was filed', sepChecks.some(t => t.startsWith('Changed since it was filed')), sepChecks.join(' | '));

    // ---- Lots ready to close out: save their plant history ----
    // (D400's last grow-log page is signed off first: close-out needs its summary saved as the lot is then)
    await b.run(main, `DB.data._PaperWizard.entries.D400.glog.instances['2026-07-01'].completedAt = '2026-08-26T00:00:00.000Z'; markUnsaved(); broadcastToSubtools();`);
    await b.waitFor(ew, `return !!DB.data._PaperWizard.entries.D400.glog.instances['2026-07-01'].completedAt;`);
    const ready = await b.run(ew, `return ctlsModel('2026-09').ready;`);
    check('lots with no plants and nothing hanging are offered for close-out, with their history not saved yet', JSON.stringify(ready.map(r => [r.lotId, r.state])) === JSON.stringify([['D400', 'none']]), JSON.stringify(ready));
    await b.run(ew, `document.querySelector('[data-ctls-keep="D400"]').click();`, { user: true });
    await b.sleep(300);
    const kept = await b.run(main, `const s = DB.data._EmployeeWizard.crops.D400; return s ? { v: s.version, ctls: s.ctls } : null;`);
    check('💾 Save keeps the lot\'s plant and weight history with its crop summary', kept?.v === 4 && kept.ctls?.start === 40 && kept.ctls.moves.some(m => m.reason === 'harvested' && m.n === 40) && kept.ctls.dry[0]?.[1] === 700, JSON.stringify(kept));
    check('…and it shows as saved', (await b.run(ew, `return ctlsModel('2026-09').ready.find(r => r.lotId === 'D400')?.state;`)) === 'ok');

    // ---- SitkaTools: close-out is refused while the crop summary isn't saved (🔒 cost audit 2026-10-26) ----
    await b.run(main, `window.__msgs = []; window.confirm = m => { window.__msgs.push(m); return false; }; window.alert = m => window.__msgs.push('ALERT ' + m);
        DB.data.lots.C300.plantCount = 0;
        document.getElementById('lotActionSelect').innerHTML = '<option value="C300">C300</option><option value="D400">D400</option>';`);
    await b.run(main, `document.getElementById('lotActionSelect').value = 'C300'; await LotActions.closeOut(); document.getElementById('lotActionSelect').value = 'D400'; await LotActions.closeOut();`);
    const msgs = await b.run(main, `return window.__msgs;`);
    check('close-out is refused while a lot\'s crop summary isn\'t saved, and goes ahead when it is', msgs.length === 2 && msgs[0].startsWith('ALERT Lot C300 can\'t be closed out yet') && msgs[0].includes('crop summary isn\'t saved') && msgs[1].startsWith('Close out lot D400?'), msgs.map(m => m.slice(0, 120)).join(' | '));
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });
    await leave(b, main);

    // ---- SitkaTools: a new lot records who its plants came from, and the count it started with ----
    main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    await b.run(main, `const t = document.getElementById('lotType'); t.value = 'new-lot'; t.dispatchEvent(new Event('change'));`);
    const shown = await b.run(main, `return getComputedStyle(document.getElementById('receivedFromGroup')).display !== 'none';`);
    await b.run(main, `document.getElementById('lotId').value = 'N900'; document.getElementById('lotStrain').value = 'Gift'; document.getElementById('plantCount').value = '64';
        document.getElementById('receivedFrom').value = '  Sunny Clones Ltd '; document.getElementById('lotForm').requestSubmit();`, { user: true });
    let nl = await b.run(main, `return DB.lots.N900 ? { from: DB.lots.N900.receivedFrom, start: DB.lots.N900.startPlantCount, n: DB.lots.N900.plantCount } : null;`);
    check('New Lot asks who the plants came from (optional) and keeps it with the starting count', shown && nl?.from === 'Sunny Clones Ltd' && nl.start === 64 && nl.n === 64, JSON.stringify(nl));
    await b.run(main, `renderLotList(); const i = document.querySelector('.plant-count-input[data-lot-id="N900"]'); i.value = '60'; i.dispatchEvent(new Event('change'));
        const f = document.querySelector('.lot-from-input[data-lot-id="N900"]'); f.value = 'Sunny Clones Inc.'; f.dispatchEvent(new Event('change'));`);
    nl = await b.run(main, `return { from: DB.lots.N900.receivedFrom, start: DB.lots.N900.startPlantCount, n: DB.lots.N900.plantCount };`);
    check('before a grow log, a count changed in the Lot Manager is still its starting count; Received from can be changed in the list', nl.from === 'Sunny Clones Inc.' && nl.start === 60 && nl.n === 60, JSON.stringify(nl));
    await b.run(main, `const t = document.getElementById('lotType'); t.value = 'sub-lot'; t.dispatchEvent(new Event('change'));`);
    check('sub-lots and split lots don\'t ask (their plants come from the parent)', await b.run(main, `return getComputedStyle(document.getElementById('receivedFromGroup')).display === 'none';`));
    await leave(b, main);

    // ---- PaperWizard: plants sold need the company; samples may name the lab ----
    main = await fresh(b);
    await openSitka(b, main, BASE);
    const D1 = today(-2), D2 = today(-1);
    const db = fixtureDb();
    db.lots.L100.createdDate = D1;
    db.lots.L100.plantCount = 10;
    const box = (id, d, qid, x) => ({ id, label: id, x, y: 0.2 + (d - 1) * 0.06, w: 0.12, h: 0.03, page: 1, fontSize: 10, align: 'left', source: null, questionId: qid, day: d, dayGroup: 'gday', checkbox: false, checkValue: '' });
    db._PaperWizard = {
        sheets: { glog: { name: 'Grow Log', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'daily-weekly', document: 'grow-log',
            fields: [1, 2, 3, 4, 5, 6, 7].flatMap(d => [box('c' + d, d, 'cnt', 0.1), box('m' + d, d, 'cmt', 0.3), box('i' + d, d, 'init', 0.7)]), signature: null } },
        wizards: { wg: { sheetId: 'glog', name: 'Grow Log', questions: [q('cnt', 'Plant count', 'plant-count', { rowScoped: true, prefillFrom: 'lot.plantCount' }), q('cmt', 'Comments', 'text', { rowScoped: true }), q('init', 'Initials', 'initials', { rowScoped: true })] } },
        entries: { L100: { glog: { instances: { [D1]: { phase: 'Bloom', room: 'Grow 1', header: {}, days: { [D1]: { cnt: '10', cmt: '', init: { name: 'AB', strokes: [[[0.2, 0.5], [0.8, 0.5]]] } } }, phaseChangeDate: null, strikeInitials: null, snapshots: {}, signature: null, completedAt: null, printedAt: null } } } } }
    };
    db.lots.L100._tool_CropLabourWizard = undefined;
    await loadSingle(b, main, db);
    const pw = await openTool(b, main, 'PaperWizard');
    await b.run(pw, `switchTab('cabinet'); await openRunner('L100', 'glog', '${D1}', '${D2}'); Object.assign(runnerCtx.draft, { cnt: '6', cmt: 'busy day' });
        runnerCtx.draft.init = { name: 'AB', strokes: [[[0.2, 0.6], [0.5, 0.2], [0.8, 0.6]]] }; runnerCtx.idx = runnerSteps('glog').length - 1; renderRunner();`);
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await b.sleep(200);
    const toBoxes = () => b.run(pw, `return [...document.querySelectorAll('#countReasonOverlay .reason-to')].filter(x => !x.hidden).map(x => x.dataset.to);`);
    check('no "to whom" box until plants are sold or sampled', JSON.stringify(await toBoxes()) === '[]');
    await b.run(pw, `for (const [r, n] of [['sold', 3], ['sampled', 1]]) { const i = document.querySelector('.reason-n[data-r="' + r + '"]'); i.value = String(n); i.dispatchEvent(new Event('input')); }`);
    check('selling or sampling plants asks who they went to', JSON.stringify(await toBoxes()) === JSON.stringify(['sold', 'sampled']));
    await b.run(pw, `document.getElementById('reasonOk').click();`);
    check('the company is required for a sale', (await b.run(pw, `return !!document.getElementById('countReasonOverlay') && document.getElementById('toast').textContent === 'Type the company the plants went to' && document.activeElement?.id === 'reasonTo_sold';`)));
    await b.run(pw, `document.getElementById('reasonTo_sold').value = 'Acme [Cannabis] Inc.'; document.getElementById('reasonOk').click();`);
    await b.sleep(300);
    const d2 = await b.run(pw, `return DB.paperWizard.entries.L100.glog.instances['${D1}'].days['${D2}'];`);
    check('saved with the day: the counts, the company (the lab is optional) and the note in the comments',
        JSON.stringify(d2?._removed) === JSON.stringify({ sampled: 1, sold: 3 }) && JSON.stringify(d2._removedTo) === JSON.stringify({ sold: 'Acme Cannabis Inc.' })
        && d2.cmt === 'busy day [Removed 4: 1 sampled, 3 sold / transferred to another company (Acme Cannabis Inc.)]', JSON.stringify(d2));
    // Earlier names are offered as taps next time
    await b.run(pw, `await openRunner('L100', 'glog', '${D1}', '${today()}'); Object.assign(runnerCtx.draft, { cnt: '5', cmt: '' });
        runnerCtx.draft.init = { name: 'AB', strokes: [[[0.2, 0.6], [0.5, 0.2], [0.8, 0.6]]] }; runnerCtx.idx = runnerSteps('glog').length - 1; renderRunner();`);
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    await b.sleep(200);
    await b.run(pw, `const i = document.querySelector('.reason-n[data-r="sold"]'); i.value = '1'; i.dispatchEvent(new Event('input')); document.querySelector('[data-to-chip="sold"]').click(); document.getElementById('reasonOk').click();`);
    await b.sleep(300);
    const d3 = await b.run(pw, `return DB.paperWizard.entries.L100.glog.instances['${D1}'].days['${today()}']?._removedTo;`);
    check('a company named before is one tap away', d3?.sold === 'Acme Cannabis Inc.', JSON.stringify(d3));
    await leave(b, pw); await b.send('browsingContext.close', { context: pw });
    await leave(b, main);
    return results;
}
