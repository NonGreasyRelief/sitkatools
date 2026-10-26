// A lot moving between buildings with split files, file by file (user decisions 2026-10-25: no Send or Accept; only a
// building's own device writes its file). Building 1's tablet records the move in the lot's grow log (the Room question
// lists Building 2's rooms): the page is struck, the next page starts blank on the move day, and Building 1's file keeps
// the lot's pages. Nothing else records the move: the lot's room is in Building 2 while its pages are in Building 1's
// file. Building 2's tablet picks it up by itself when it opens the files (its file: the pickup, a copy of the lot's
// unsigned pages), fills the new page, and can correct days from before the move. The office views the lot's paperwork
// but doesn't fill it, and writes no building's file; Building 1 drops its copy with its own next save. A lot with no
// grow log moves when the office sets its room in the Lot Manager.
import { fixtureDb, makeChecker, fresh, splitFiles, openSplit, saveSplit, openTool, leave, today } from './lib/helpers.mjs';

export const title = 'lot moves between buildings: recorded by the grow log, picked up by the receiving building';

function moveDb() {
    const db = fixtureDb();
    const Y2 = today(-2), Y = today(-1), T = today();
    const page = (room, days) => ({ phase: 'Bloom', room, header: {}, days: Object.fromEntries(days.map(d => [d, { note: 'watered', rm: room }])), phaseChangeDate: null,
        strikeInitials: null, snapshots: {}, signature: null, completedAt: null, printedAt: null });
    db._PaperWizard = {
        sheets: { glog: { name: 'Grow Log', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'daily-weekly', document: 'grow-log', fields: [], signature: null } },
        wizards: { wg01: { id: 'wg01', sheetId: 'glog', name: 'Grow', questions: [
            { id: 'note', label: 'Notes', type: 'text', options: [], rowScoped: true, sameAsLast: false, mandatory: false, prefillFrom: null },
            { id: 'rm', label: 'Room', type: 'room', options: [], rowScoped: true, sameAsLast: false, mandatory: false, prefillFrom: null }] } },
        entries: { L100: { glog: { instances: { [Y2]: page('Grow 1', [Y2, Y]) } } }, L200: { glog: { instances: { [Y]: page('Grow A', [Y]) } } } }
    };
    // A lot with no grow log yet, in Building 2, planned to go back to Building 1's Clone 1 (the Lot Manager offers a lot's
    // planned rooms); its propagation sheet is in Building 2's file
    db.lots.L300 = { name: 'L300', strain: 'Blue Test', stage: 'veg', createdDate: Y2, closedDate: null, destRoom: 'Grow A', cloningRoom: 'Clone 1', vegRoom: null, currentRoom: 'Grow A', plantCount: 40 };
    db.rooms.R2G1.assignedLots.push('L300');
    db._PaperWizard.sheets.prop = { name: 'Propagation', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'one-shot', document: 'propagation', fields: [], signature: null };
    db._PaperWizard.entries.L300 = { prop: { instances: { single: { phase: null, room: 'Grow A', header: { note: 'started' }, days: {}, snapshots: {}, signature: null, completedAt: null, printedAt: null } } } };
    return { db, Y2, Y, T };
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const { db, Y2, Y, T } = moveDb();
    const main = await fresh(b);
    const files = await splitFiles(b, main, BASE, db);
    check('split: each lot\'s grow log is in its own building\'s file', !!JSON.parse(files['Building-B1.json'])._PaperWizard.entries.L100 && !!JSON.parse(files['Building-B2.json'])._PaperWizard.entries.L200);

    const plan = () => b.run(main, `const p = DbSplit.plan(); return { save: p.toSave, cannot: p.cannot, parts: Object.fromEntries(Object.entries(p.parts).map(([n, x]) => [n, x])) };`);
    const moves = () => b.run(main, `return Object.values(DB.data._LotTransfers || {}).map(t => ({ lotId: t.lotId, from: t.from, to: t.to, room: t.room, picked: !!t.acceptedAt }));`);
    const card = () => b.run(main, `LotActions.render(); return { rows: [...document.querySelectorAll('#incomingTransfers .split-transfer')].map(r => r.textContent),
        send: !!document.getElementById('sendLotBtn'), accept: !!document.querySelector('#incomingTransfers button') };`);
    // Fill a day of L100's grow log in PaperWizard: the page holding it, the answers, Save, and the strike pad when it opens
    const fill = async (pw, day, vals) => {
        await b.run(pw, `window.__asked = []; window.confirm = m => { window.__asked.push(m); return false; };
            const holder = dailyChain('L100', 'glog').filter(c => c.key <= '${day}' && '${day}' <= addDaysStr(c.key, 6) && !(c.inst.phaseChangeDate && '${day}' > c.inst.phaseChangeDate)).pop();
            await openRunner('L100', 'glog', holder ? holder.key : '${day}', '${day}');
            Object.assign(runnerCtx.draft, ${JSON.stringify(vals)});
            runnerCtx.idx = runnerSteps('glog').length - 1; renderRunner();
            document.getElementById('wizSaveBtn').click();`, { user: true });
        await b.sleep(300);
        let struck = false;
        if (await b.run(pw, `return !!document.getElementById('strikePad');`)) {
            struck = true;
            await b.drag(pw, '#strikePad', [[0.2, 0.5], [0.8, 0.5]]);
            await b.run(pw, `document.getElementById('strikeName').value = 'AB'; document.getElementById('strikeOkBtn').click();`, { user: true });
            await b.sleep(400);
        }
        const toast = await b.run(pw, `return document.getElementById('toast')?.textContent || '';`);
        await b.run(pw, `if (runnerCtx) closeRunner(); document.querySelectorAll('.wiz-overlay, .strike-overlay').forEach(o => o.remove());`);
        return { struck, toast, asked: await b.run(pw, `return window.__asked;`) };
    };

    // ---- Building 1 records the move in L100's grow log ----
    check('B1 opened', await openSplit(b, main, BASE, 'B1', files));
    const pw1 = await openTool(b, main, 'PaperWizard');
    const groups = await b.run(pw1, `await openRunner('L100', 'glog', '${Y2}', '${T}'); runnerCtx.idx = runnerSteps('glog').findIndex(s => s.q?.id === 'rm' || s.qs?.some?.(q => q.id === 'rm'));
        if (runnerCtx.idx < 0) runnerCtx.idx = runnerSteps('glog').length - 1; renderRunner();
        const sel = document.getElementById('wizCtl');
        const out = { own: [...sel.querySelectorAll(':scope > option')].map(o => o.value).filter(Boolean), groups: [...sel.querySelectorAll('optgroup')].map(g => [g.label, [...g.querySelectorAll('option')].map(o => o.value)]) };
        closeRunner(); return out;`);
    check('the Room question lists Building 1\'s rooms, then Building 2\'s under "🚚 Move to Building 2"',
        groups.own.join() === 'Clone 1,Grow 1' && JSON.stringify(groups.groups) === JSON.stringify([['🚚 Move to Building 2', ['Grow A']]]), JSON.stringify(groups));
    let r = await fill(pw1, Y2, { note: 'watered', rm: 'Grow A' });
    check('a move to another building on an earlier day (later entries on file) is refused: nothing saved, no strike pad',
        !r.struck && r.toast.includes('goes on the newest day of the log') && (await moves()).length === 0 && await b.run(pw1, `return DB.lots.L100.currentRoom;`) === 'Grow 1', JSON.stringify(r));
    r = await fill(pw1, T, { note: 'moved out', rm: 'Grow A' });
    await b.sleep(400);
    const pages1 = await b.run(pw1, `return dailyChain('L100', 'glog').map(c => ({ key: c.key, room: c.inst.room, end: c.inst.phaseChangeDate, days: Object.keys(c.inst.days || {}) }));`);
    check('the newest day records it: the page is struck that day, and the next page starts blank on the move day in Grow A',
        r.struck && JSON.stringify(pages1) === JSON.stringify([{ key: Y2, room: 'Grow 1', end: T, days: [Y2, Y, T] }, { key: T, room: 'Grow A', end: null, days: [] }]), JSON.stringify(pages1));
    check('…without offering to fill the new page here, and the toast says Building 2 picks it up',
        !r.asked.some(m => m.includes('Start filling')) && r.toast.includes('moved to Grow A (Building 2)') && r.toast.includes('picks it up'), JSON.stringify(r));
    const way = await b.run(main, `return DbSplit.movesOnTheWay();`);
    check('the move needs no record: L100 is on its way from Building 1 to Building 2 (Grow A), read from the lot itself',
        JSON.stringify(way) === JSON.stringify([{ lotId: 'L100', from: 'B1', to: 'B2', room: 'Grow A' }]) && (await moves()).length === 0, JSON.stringify({ way, moves: await moves() }));
    const banner = await b.run(pw1, `return lotElsewhere('L100')?.banner || '';`);
    check('…and PaperWizard shows L100 read-only here: in Grow A (Building 2), this file keeps its pages until Building 2 picks it up', banner.includes('in Grow A (Building 2)') && banner.includes('picks it up'), banner);
    const c1 = await card();
    check('Data & Files lists the move on its way; there\'s no Send button and no Accept', c1.rows.length === 1 && c1.rows[0].includes('Lot L100: Building 1 → Building 2 (Grow A)') && c1.rows[0].includes('waiting for Building 2 to pick it up') && !c1.send && !c1.accept, JSON.stringify(c1));
    await leave(b, pw1); await b.send('browsingContext.close', { context: pw1 });
    const s1 = await saveSplit(b, main);
    const f1 = JSON.parse(s1['Building-B1.json'] || '{}');
    check('B1 saves only its own file: both pages and the lot\'s new room', Object.keys(s1).join() === 'Building-B1.json'
        && !Object.keys(f1._LotTransfers || {}).length && Object.keys(f1._PaperWizard?.entries?.L100?.glog?.instances || {}).sort().join() === [Y2, T].sort().join()
        && f1._overlays?.lots?.L100?.currentRoom?.value === 'Grow A', Object.keys(s1).join());

    // ---- Building 2 opens the files: it picks L100 up by itself, saves, and fills the new page ----
    const f2 = { ...files, ...s1 };
    check('B2 opened', await openSplit(b, main, BASE, 'B2', f2));
    const got = await b.run(main, `return { toast: syncToastText.textContent, unsaved: hasUnsavedChanges };`);
    check('B2 picks it up when it opens the files ("🚚 Lot L100 arrived from Building 1 (Grow A) — 💾 Save DB to pick it up")',
        got.toast.includes('Lot L100 arrived from Building 1 (Grow A)') && got.toast.includes('Save DB to pick it up') && got.unsaved && (await moves()).every(m => m.picked), JSON.stringify(got));
    const s2 = await saveSplit(b, main);
    const f2b = JSON.parse(s2['Building-B2.json'] || '{}');
    check('B2 saves only its own file: the picked-up move and a copy of L100\'s unsigned pages', Object.keys(s2).join() === 'Building-B2.json'
        && Object.values(f2b._LotTransfers || {}).some(t => t.lotId === 'L100' && t.acceptedAt && t.acceptedBy === 'Building 2')
        && Object.keys(f2b._PaperWizard?.entries?.L100?.glog?.instances || {}).sort().join() === [Y2, T].sort().join(), Object.keys(s2).join());
    const pw2 = await openTool(b, main, 'PaperWizard');
    check('B2 can fill L100\'s paperwork', await b.run(pw2, `return lotElsewhere('L100') === null;`));
    r = await fill(pw2, T, { note: 'arrived', rm: 'Grow A' });
    check('…and fills the move day on the new page, with no "Lot is now in …" prompt and no strike-out', !r.struck && !r.asked.some(m => m.startsWith('Lot is now in'))
        && await b.run(pw2, `return Object.keys(pageStore('L100').glog.instances['${T}'].days || {}).join();`) === T, JSON.stringify(r));
    // A day from before the move, corrected in Building 2 (its page came over with the pickup): no "move" refusal
    r = await fill(pw2, Y, { note: 'watered (corrected)', rm: 'Grow 1' });
    check('B2 can correct a day from before the move (it still says Grow 1): saved, not refused as a move',
        !r.toast.includes('goes on the newest day') && await b.run(pw2, `return pageStore('L100').glog.instances['${Y2}'].days['${Y}'].note;`) === 'watered (corrected)', JSON.stringify(r));
    await leave(b, pw2); await b.send('browsingContext.close', { context: pw2 });
    const s2b = await saveSplit(b, main);
    check('…saved in Building 2\'s file', Object.keys(s2b).join() === 'Building-B2.json' && !!JSON.parse(s2b['Building-B2.json'])._PaperWizard.entries.L100.glog.instances[T].days[T], Object.keys(s2b).join());

    // ---- The office opens everything: it sees the move done and rewrites no building's file ----
    const f3 = { ...f2, ...s2, ...s2b };
    check('office opened', await openSplit(b, main, BASE, 'office', f3));
    const off = await b.run(main, `return { room: DB.data.lots.L100.currentRoom, unsaved: hasUnsavedChanges, toast: syncToastText.textContent };`);
    check('office: L100 is in Grow A, and its moves are all picked up', off.room === 'Grow A' && (await card()).rows.length === 0, JSON.stringify(off));
    check('office: nothing to save — it doesn\'t pick up or tidy for a building', !off.unsaved && (await plan()).save.length === 0, JSON.stringify(off));
    const pwo = await openTool(b, main, 'PaperWizard');
    const ro = await b.run(pwo, `const e = lotElsewhere('L100'); let t = ''; const orig = showToast; showToast = m => { t = m; }; await openRunner('L100', 'glog', '${T}'); showToast = orig;
        return { banner: e?.banner || '', opened: !!runnerCtx, toast: t, facility: lotElsewhere('@facility') };`);
    check('office with building files: L100\'s paperwork is view and print only ("open SitkaTools as Building 2"); facility forms still fill',
        ro.banner.includes('Read only on the office') && ro.banner.includes('Open SitkaTools as Building 2') && !ro.opened && ro.toast.includes('open SitkaTools as Building 2') && ro.facility === null, JSON.stringify(ro));
    await leave(b, pwo); await b.send('browsingContext.close', { context: pwo });

    // ---- Building 1 drops its copy on its next save ----
    check('B1 reopened', await openSplit(b, main, BASE, 'B1', f3));
    let p = await plan();
    const own = p.parts['Building-B1.json'];
    check('B1: its next save drops its copy of L100\'s pages and the move', p.save.includes('Building-B1.json') &&
        !own._PaperWizard.entries.L100 && !Object.values(own._LotTransfers || {}).some(t => t.lotId === 'L100'), JSON.stringify({ save: p.save, e: Object.keys(own._PaperWizard.entries), t: own._LotTransfers }));
    check('B1: and it writes nothing else', p.save.join() === 'Building-B1.json' && !p.cannot.length, JSON.stringify(p.save));
    const s4 = await saveSplit(b, main);

    // ---- The office moves L300 (no grow log) in the Lot Manager: Main only; Building 1 picks it up ----
    const f4 = { ...f3, ...s4 };
    check('office reopened', await openSplit(b, main, BASE, 'office', f4));
    const wayOf = () => b.run(main, `return DbSplit.movesOnTheWay().filter(m => m.lotId === 'L300');`);
    await b.run(main, `const sel = document.querySelector('.lot-currentroom-select[data-lot-id="L300"]'); sel.value = 'Clone 1'; sel.dispatchEvent(new Event('change', { bubbles: true }));`, { user: true });
    check('setting L300\'s current room to Clone 1 (Building 1) puts it on its way there (its page is in Building 2\'s file)', JSON.stringify(await wayOf()) === JSON.stringify([{ lotId: 'L300', from: 'B2', to: 'B1', room: 'Clone 1' }]), JSON.stringify(await wayOf()));
    await b.run(main, `const sel = document.querySelector('.lot-currentroom-select[data-lot-id="L300"]'); sel.value = 'Grow A'; sel.dispatchEvent(new Event('change', { bubbles: true }));`, { user: true });
    check('…and setting it back means no move', !(await wayOf()).length, JSON.stringify(await wayOf()));
    await b.run(main, `const sel = document.querySelector('.lot-currentroom-select[data-lot-id="L300"]'); sel.value = 'Clone 1'; sel.dispatchEvent(new Event('change', { bubbles: true }));`, { user: true });
    p = await plan();
    check('office: saves only Main.json (the lot\'s room) — never a building\'s file', p.save.join() === 'Main.json' && !p.cannot.length, JSON.stringify({ save: p.save, cannot: p.cannot }));
    const s5 = await saveSplit(b, main);
    check('B1 opened again', await openSplit(b, main, BASE, 'B1', { ...f4, ...s5 }));
    const got2 = await b.run(main, `return { toast: syncToastText.textContent, room: DB.data.lots.L300.currentRoom };`);
    const s6 = await saveSplit(b, main);
    const f6 = JSON.parse(s6['Building-B1.json'] || '{}');
    check('B1 picks L300 up: its file has the pickup and a copy of L300\'s propagation page', got2.toast.includes('Lot L300 arrived from Building 2 (Clone 1)') && got2.room === 'Clone 1'
        && Object.keys(s6).join() === 'Building-B1.json' && Object.values(f6._LotTransfers || {}).some(t => t.lotId === 'L300' && t.acceptedAt) && !!f6._PaperWizard?.entries?.L300?.prop, JSON.stringify({ got2, files: Object.keys(s6) }));

    await leave(b, main);
    return results;
}
