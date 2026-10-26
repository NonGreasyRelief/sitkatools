// Closing out a lot with split files: the office archives the lot and saves only Main.json, which records the
// close-out with a fingerprint of what each building file held of the lot. It never rewrites a building's file. Every
// device ignores what's left of the lot there, and each building drops it from its own file with its next save — unless
// its file got something for the lot after the archive was made: that's kept, shown, and both sides are told. Closing
// out needs every building's file open. A single-file DB just loses the lot, as before.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, splitFiles, openSplit, saveSplit, leave, today } from './lib/helpers.mjs';

export const title = 'close-out with split files: each building drops the lot from its own file';

function closeDb() {
    const db = fixtureDb();
    const T = today();
    db.lots.L100.plantCount = 0;   // close-out needs no plants on record
    db._PaperWizard = {
        sheets: { note: { name: 'Lot note', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'event', document: 'ipm', fields: [], signature: null } },
        wizards: { wn01: { id: 'wn01', sheetId: 'note', name: 'Note', questions: [{ id: 'txt', label: 'Note', type: 'text', options: [], rowScoped: false, sameAsLast: false, mandatory: false, prefillFrom: null }] } },
        entries: { L100: { note: { instances: { [T]: { phase: null, room: 'Grow 1', header: { txt: 'done' }, days: {}, snapshots: {}, signature: null, completedAt: null, printedAt: null } } } } }
    };
    return db;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const db = closeDb();
    const main = await fresh(b);
    const files = await splitFiles(b, main, BASE, db);
    // Building 1's file also holds a move of L100 it accepted and a floor update for it
    const b1 = JSON.parse(files['Building-B1.json']);
    b1._LotTransfers = { 'L100@2026-09-01T00:00:00.000Z': { lotId: 'L100', from: 'B2', to: 'B1', sentAt: '2026-09-01T00:00:00.000Z', sentBy: 'Building 2', acceptedAt: '2026-09-02T00:00:00.000Z', acceptedBy: 'XY', room: 'Grow 1' } };
    b1._overlays.lots.L100 = { plantCount: { value: 0, at: 1 } };
    files['Building-B1.json'] = JSON.stringify(b1, null, 2);
    check('Building 1\'s file holds L100\'s page, a move and a floor update', !!b1._PaperWizard.entries.L100);

    const holds = (text) => { const p = JSON.parse(text); return { page: !!p._PaperWizard?.entries?.L100, move: Object.values(p._LotTransfers || {}).some(t => t.lotId === 'L100'), overlay: !!p._overlays?.lots?.L100 }; };
    const plan = () => b.run(main, `const p = DbSplit.plan(); return { save: p.toSave, b1: JSON.stringify(p.parts['Building-B1.json']), main: p.parts['Main.json']._closedLots || null };`);
    const panel = () => b.run(main, `LotActions.render(); return { btn: !!document.getElementById('clearClosedBtn'), note: document.getElementById('closedNote').textContent };`);
    const closeOut = async (lotId) => {
        await b.run(main, `window.confirm = () => true; window.alert = () => {}; LotActions.render(); document.getElementById('lotActionSelect').value = '${lotId}'; await LotActions.closeOut();`, { user: true });
        await b.run(main, `document.getElementById('archiveLink')?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); document.getElementById('savePopup')?.classList.add('hidden');`);
        await b.sleep(200);
    };

    // ---- Close-out needs every building's file open ----
    const noB1 = Object.fromEntries(Object.entries(files).filter(([n]) => n !== 'Building-B1.json'));
    check('office opened without Building 1\'s file', await openSplit(b, main, BASE, 'office', noB1));
    const refused = await b.run(main, `let m = ''; window.alert = x => { m = x; }; window.confirm = () => true; LotActions.render(); document.getElementById('lotActionSelect').value = 'L100';
        await LotActions.closeOut(); return { m, lot: !!DB.data.lots.L100 };`, { user: true });
    check('close-out is refused while a building\'s file isn\'t open', refused.lot && refused.m.includes('Open every building') && refused.m.includes('Building-B1.json'), JSON.stringify(refused));

    // ---- The office closes L100 out ----
    check('office opened', await openSplit(b, main, BASE, 'office', files));
    await closeOut('L100');
    let st = await b.run(main, `return { lot: !!DB.data.lots.L100, notice: DB.data._closedLots?.L100 || null, page: !!DB.data._PaperWizard?.entries?.L100 };`);
    check('L100 is archived and removed; Main records the close-out, with a fingerprint per building file', !st.lot && !st.page && st.notice?.archive?.startsWith('Archive/Lot-L100-') && st.notice.by === 'Office'
        && typeof st.notice.files?.B1 === 'string' && typeof st.notice.files?.B2 === 'string', JSON.stringify(st));
    let p = await plan();
    check('the office saves Main.json only — Building 1\'s file is left as it is', p.save.join() === 'Main.json' && !!p.main?.L100 && holds(p.b1).page && holds(p.b1).move && holds(p.b1).overlay, JSON.stringify({ save: p.save, b1: holds(p.b1) }));
    let pn = await panel();
    check('the close-out panel says Building 1 still holds it (no 🧹: the office never writes a building\'s file)', !pn.btn && pn.note.includes('Building 1 (L100)') && pn.note.includes('next save'), JSON.stringify(pn));
    const s1 = await saveSplit(b, main);
    check('saved: Main.json only', Object.keys(s1).join() === 'Main.json', Object.keys(s1).join());
    const f2 = { ...files, ...s1 };

    // ---- Reopened, the office ignores what's left of L100 in Building 1's file ----
    check('office reopened', await openSplit(b, main, BASE, 'office', f2));
    st = await b.run(main, `return { page: !!DB.data._PaperWizard?.entries?.L100, move: Object.values(DB.data._LotTransfers || {}).some(t => t.lotId === 'L100'), unsaved: hasUnsavedChanges };`);
    check('office: L100\'s page and move don\'t come back, nothing to save', !st.page && !st.move && !st.unsaved, JSON.stringify(st));
    check('a closed-out lot\'s id isn\'t used again', await b.run(main, `let msg = ''; window.alert = (m) => { msg = m; };
        const v = (id, x) => { const el = document.getElementById(id); el.value = x; el.dispatchEvent(new Event('change', { bubbles: true })); };
        v('lotType', 'new-lot'); v('lotId', 'L100'); v('lotStrain', 'Again'); v('destRoom', 'Grow 1'); v('startRoom', 'flower');
        document.getElementById('lotForm').requestSubmit(); return !DB.data.lots.L100 && msg.includes('was closed out');`, { user: true }));

    // ---- Building 1 sees the close-out and drops L100 from its own file ----
    check('B1 opened', await openSplit(b, main, BASE, 'B1', f2));
    st = await b.run(main, `return { toast: syncToastText.textContent, page: !!DB.data._PaperWizard?.entries?.L100 };`);
    check('B1: told the office closed out L100; it isn\'t in the merged DB', st.toast.includes('🗄️ The office closed out lot L100') && !st.page, JSON.stringify(st));
    const s2 = await saveSplit(b, main);
    const h2 = holds(s2['Building-B1.json'] || '{}');
    check('B1: its next save drops L100\'s page, move and floor update from its own file — and writes nothing else',
        Object.keys(s2).join() === 'Building-B1.json' && !h2.page && !h2.move && !h2.overlay, JSON.stringify({ files: Object.keys(s2), h2 }));
    check('office reopened after B1 saved', await openSplit(b, main, BASE, 'office', { ...f2, ...s2 }));
    pn = await panel();
    check('office: nothing left in the building files', !pn.note.includes('L100'), JSON.stringify(pn));

    // ---- Building 1 saved something for L100 after the office opened the files: it's kept, not dropped ----
    const late = JSON.parse(files['Building-B1.json']);
    const lateKey = Object.keys(late._PaperWizard.entries.L100.note.instances)[0];
    late._PaperWizard.entries.L100.note.instances[lateKey].header.txt = 'signed off late';
    const f3 = { ...f2, 'Building-B1.json': JSON.stringify(late, null, 2) };
    check('B1 opened with a page changed after the archive was made', await openSplit(b, main, BASE, 'B1', { ...f3 }));
    st = await b.run(main, `return { late: DbSplit.closedParts('B1').late, drop: DbSplit.closedIn('B1'), page: DB.data._PaperWizard?.entries?.L100?.note?.instances?.['${lateKey}']?.header?.txt || null };`);
    check('B1: L100 is "late" there — not dropped, and its page shows in the merged DB', st.late.join() === 'L100' && !st.drop.length && st.page === 'signed off late', JSON.stringify(st));
    const s4 = await saveSplit(b, main);
    const keep = s4['Building-B1.json'] ? holds(s4['Building-B1.json']) : holds(f3['Building-B1.json']);
    check('B1: its saves keep the late page', keep.page, JSON.stringify({ files: Object.keys(s4), keep }));
    check('office reopened', await openSplit(b, main, BASE, 'office', f3));
    pn = await panel();
    check('office: told Building 1 has paperwork for closed-out L100 saved after the archive', pn.note.includes('Building 1 has paperwork or hours for closed-out lot L100'), JSON.stringify(pn));
    await leave(b, main);

    // ---- A single-file DB just loses the lot ----
    await openSitka(b, main, BASE);
    await loadSingle(b, main, closeDb());
    await closeOut('L100');
    st = await b.run(main, `return { lot: !!DB.data.lots.L100, notice: DB.data._closedLots || null, page: !!DB.data._PaperWizard?.entries?.L100 };`);
    check('single file: the lot and its paperwork are gone, no close-out notice', !st.lot && !st.page && !st.notice, JSON.stringify(st));

    await leave(b, main);
    return results;
}
