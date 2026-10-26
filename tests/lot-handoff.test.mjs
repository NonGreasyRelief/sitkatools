// A lot moving between buildings with split files, file by file: every device opens every building's file, but each
// saves only its own. Building 1 sends a lot (its file), Building 2 accepts it (its file: the record, the lot's
// unsigned grow-log pages copied over, the new room) and is offered the new building's grow log; the office opens
// everything and rewrites no building's file; Building 1 tidies its own file on its next save. The office can also
// move a lot for a building, which saves in that building's file.
import { fixtureDb, makeChecker, fresh, splitFiles, openSplit, saveSplit, openTool, leave, today } from './lib/helpers.mjs';

export const title = 'lot moves between buildings: who reads and who writes which file';

function moveDb() {
    const db = fixtureDb();
    const Y = today(-1);
    const page = room => ({ phase: 'Bloom', room, header: {}, days: { [Y]: { note: 'watered', rm: room } }, phaseChangeDate: null, strikeInitials: null,
        snapshots: {}, signature: null, completedAt: null, printedAt: null });
    db._PaperWizard = {
        sheets: { glog: { name: 'Grow Log', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'daily-weekly', document: 'grow-log', fields: [], signature: null } },
        wizards: { wg01: { id: 'wg01', sheetId: 'glog', name: 'Grow', questions: [
            { id: 'note', label: 'Notes', type: 'text', options: [], rowScoped: true, sameAsLast: false, mandatory: false, prefillFrom: null },
            { id: 'rm', label: 'Room', type: 'room', options: [], rowScoped: true, sameAsLast: false, mandatory: false, prefillFrom: null }] } },
        entries: { L100: { glog: { instances: { [Y]: page('Grow 1') } } }, L200: { glog: { instances: { [Y]: page('Grow A') } } } }
    };
    return { db, Y };
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const { db, Y } = moveDb();
    const main = await fresh(b);
    const files = await splitFiles(b, main, BASE, db);
    check('split: each lot\'s grow log is in its own building\'s file', !!JSON.parse(files['Building-B1.json'])._PaperWizard.entries.L100 && !!JSON.parse(files['Building-B2.json'])._PaperWizard.entries.L200);

    const send = (lotId, to) => b.run(main, `window.confirm = () => true; LotActions.render(); document.getElementById('lotActionSelect').value = '${lotId}'; LotActions.render();
        document.getElementById('sendLotTo').value = '${to}'; LotActions.send(); return Object.values(DB.data._LotTransfers || {}).filter(t => t.lotId === '${lotId}' && !t.acceptedAt).length;`);
    const accept = (lotId, room) => b.run(main, `const t = Object.entries(DB.data._LotTransfers || {}).find(([, t]) => t.lotId === '${lotId}' && !t.acceptedAt);
        if (!t) return false; LotActions.accept(t[0], '${room}', 'XY'); return DB.data.lots['${lotId}'].currentRoom;`);
    const plan = () => b.run(main, `const p = DbSplit.plan(); return { save: p.toSave, cannot: p.cannot, parts: Object.fromEntries(Object.entries(p.parts).map(([n, x]) => [n, x])) };`);
    // The grow log asks "Lot is now in …" when it's opened in the new room (answered No here: we only check it's offered)
    const offered = async (lotId) => {
        const pw = await openTool(b, main, 'PaperWizard');
        const msg = await b.run(pw, `let m = ''; window.confirm = (x) => { m = x; return false; }; await openRunner('${lotId}', 'glog', '${Y}'); closeRunner(); return m;`);
        await b.send('browsingContext.close', { context: pw });
        return msg;
    };

    // ---- Building 1 sends L100 ----
    check('B1 opened', await openSplit(b, main, BASE, 'B1', files));
    check('B1 sends L100 to Building 2', (await send('L100', 'B2')) === 1);
    const s1 = await saveSplit(b, main);
    check('B1 saves only its own file, with the pending move', Object.keys(s1).join() === 'Building-B1.json' &&
        Object.values(JSON.parse(s1['Building-B1.json'])._LotTransfers).some(t => t.lotId === 'L100' && !t.acceptedAt), Object.keys(s1).join());

    // ---- Building 2 sees it (it opens Building 1's file), accepts, and starts its own grow log ----
    const f2 = { ...files, ...s1 };
    check('B2 opened', await openSplit(b, main, BASE, 'B2', f2));
    check('B2 sees the lot coming (read from Building 1\'s file)', await b.run(main, `return !!document.querySelector('.split-transfer [class*="btn"]') || Object.values(DB.data._LotTransfers).some(t => t.lotId === 'L100' && t.to === 'B2');`));
    check('B2 accepts it into Grow A', (await accept('L100', 'Grow A')) === 'Grow A');
    const s2 = await saveSplit(b, main);
    const b2 = JSON.parse(s2['Building-B2.json'] || '{}');
    check('B2 saves only its own file', Object.keys(s2).join() === 'Building-B2.json', Object.keys(s2).join());
    check('…holding the accepted move, the new room, and a copy of L100\'s unsigned grow-log page',
        Object.values(b2._LotTransfers || {}).some(t => t.lotId === 'L100' && t.acceptedAt) && b2._overlays?.lots?.L100?.currentRoom?.value === 'Grow A' && !!b2._PaperWizard?.entries?.L100?.glog?.instances?.[Y],
        JSON.stringify({ t: b2._LotTransfers, o: b2._overlays?.lots }));
    const m2 = await offered('L100');
    check('B2: opening L100\'s grow log offers to close the old page and start one in Grow A', m2.startsWith('Lot is now in Grow A') && m2.includes('starts a fresh log for Grow A'), m2);

    // ---- The office opens everything: it sees the move and rewrites no building's file ----
    const f3 = { ...f2, ...s2 };
    check('office opened', await openSplit(b, main, BASE, 'office', f3));
    const off = await b.run(main, `return { room: DB.data.lots.L100.currentRoom, unsaved: hasUnsavedChanges, toast: syncToastText.textContent };`);
    check('office: L100 is in Grow A (read from Building 2\'s file)', off.room === 'Grow A', JSON.stringify(off));
    check('office: nothing to save — it doesn\'t tidy Building 1\'s file', !off.unsaved && !off.toast.includes('tidy') && (await plan()).save.length === 0, JSON.stringify(off));

    // ---- Building 1 tidies its own file on its next save ----
    check('B1 reopened', await openSplit(b, main, BASE, 'B1', f3));
    let p = await plan();
    const own = p.parts['Building-B1.json'];
    check('B1: its next save drops its leftover copy of L100\'s pages and the pending move', p.save.includes('Building-B1.json') &&
        !own._PaperWizard.entries.L100 && !Object.values(own._LotTransfers || {}).some(t => t.lotId === 'L100'), JSON.stringify({ save: p.save, e: Object.keys(own._PaperWizard.entries), t: own._LotTransfers }));
    check('B1: and it writes nothing else', p.save.join() === 'Building-B1.json' && !p.cannot.length, JSON.stringify(p.save));

    // ---- The office moves L200 for the buildings: saved in the receiver's file, the sender's left alone ----
    check('office reopened', await openSplit(b, main, BASE, 'office', f3));
    check('office sends L200 from Building 2 to Building 1', (await send('L200', 'B1')) === 1);
    check('office accepts it into Grow 1', (await accept('L200', 'Grow 1')) === 'Grow 1');
    p = await plan();
    const r1 = p.parts['Building-B1.json'];
    check('office: saves Main (the lot) and Building-B1.json (the accepted move and L200\'s page) — not Building-B2.json',
        p.save.slice().sort().join() === 'Building-B1.json,Main.json' && Object.values(r1._LotTransfers).some(t => t.lotId === 'L200' && t.acceptedAt) && !!r1._PaperWizard.entries.L200?.glog,
        JSON.stringify(p.save));
    const m4 = await offered('L200');
    check('office: opening L200\'s grow log offers the first day in Grow 1 too', m4.startsWith('Lot is now in Grow 1'), m4);

    await leave(b, main);
    return results;
}
