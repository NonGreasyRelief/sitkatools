// 🔒 Floor manager PINs: each floor manager's own PIN, set by the office in the Labour & Cost Wizard and kept only as a
// salted hash. DailyWizard asks for one to go into ✏️ edit mode (tasks, steps, order) and for every deletion; the
// Tasks tab asks for one to remove hours. Every removal is kept on record with who approved it, in the file it's
// saved in, and shows in the hours view and the Labour Log.
import { today, fixtureDb, withFloorManager, answerPin, dwUnlock, makeChecker, fresh, openSitka, loadSingle, splitFiles, openSplit, saveSplit,
    openTool, dwBuilding, dwDate, logHours, removeHoursOf, ewSetHours, leave, FM_PIN } from './lib/helpers.mjs';

export const title = 'floor manager PINs: edit mode and recorded deletions';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today(), Y = today(-1);
    let main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());   // no floor manager has a PIN yet

    const dialog = (ctx) => b.run(ctx, `const el = document.getElementById('floorPin'); if (!el) return { open: false };
        return { open: !el.hidden, why: el.querySelector('[data-fpin-why]').textContent, none: !el.querySelector('[data-fpin-none]').hidden,
            names: [...el.querySelectorAll('[data-fpin-who] option')].map(o => o.value).filter(Boolean), err: el.querySelector('[data-fpin-err]').textContent,
            ok: !el.querySelector('[data-fpin-ok]').hidden, cancel: el.querySelector('[data-fpin-cancel]').textContent };`);
    const typePin = (ctx, pin) => b.run(ctx, `const el = document.getElementById('floorPin'); el.querySelector('[data-fpin-pin]').value = ${JSON.stringify(pin)};
        el.querySelector('[data-fpin-ok]').click(); await new Promise(r => setTimeout(r, 150));`);
    const cancelPin = (ctx) => b.run(ctx, `document.querySelector('#floorPin [data-fpin-cancel]').click();`);
    const bar = (dw) => b.run(dw, `const L = document.getElementById('listContainer');
        return { edit: !!document.getElementById('editTasksBtn'), add: !!document.getElementById('addTaskBtn'), done: !!document.getElementById('doneEditingBtn'),
            move: L.querySelectorAll('.move-btns').length, note: L.querySelector('.edit-mode-note')?.textContent || '' };`);

    // ---- No PIN yet: nothing can be unlocked ----
    let dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    let v = await bar(dw);
    check('locked: ✏️ Edit tasks, no + Add Task and no ▲ ▼', v.edit && !v.add && v.move === 0, JSON.stringify(v));
    await b.run(dw, `document.getElementById('editTasksBtn').click();`, { user: true });
    let d = await dialog(dw);
    check('with no floor manager PIN, the dialog says the office sets them, and offers only Close', d.open && d.none && !d.ok && d.cancel === 'Close', JSON.stringify(d));
    await cancelPin(dw);

    // ---- The office sets Casey's PIN in the Labour & Cost Wizard ----
    const ew = await openTool(b, main, 'EmployeeWizard');
    await b.run(ew, `selectEmployee('Casey'); const fm = document.getElementById('empFloorManager'); fm.checked = true; fm.dispatchEvent(new Event('change'));`);
    const row = () => b.run(ew, `return { shown: !document.getElementById('empPinRow').hidden, status: document.getElementById('empPinStatus').textContent };`);
    let r = await row();
    check('ticking Floor manager shows the PIN fields', r.shown && r.status.startsWith('No PIN yet'), JSON.stringify(r));
    const savePin = (a, b2) => b.run(ew, `document.getElementById('empPinInput').value = '${a}'; document.getElementById('empPin2Input').value = '${b2}';
        document.getElementById('saveEmpBtn').click(); await new Promise(r => setTimeout(r, 300));
        return { toast: document.querySelector('.toast, #toast')?.textContent || '', pin: DB.data._EmployeeWizard.employees.Casey.pin || null };`);
    let s = await savePin('12', '12');
    check('a PIN must be 4 to 8 digits', s.toast === 'The PIN must be 4 to 8 digits' && !s.pin, s.toast);
    s = await savePin('1357', '1358');
    check('the two PINs must match', s.toast === 'The two PINs don’t match' && !s.pin, s.toast);
    s = await savePin(FM_PIN, FM_PIN);
    const json = await b.run(ew, 'return JSON.stringify(DB.data);');
    check('saved: a salt and a hash, never the PIN itself', /^[0-9a-f]{16}$/.test(s.pin?.salt) && /^[0-9a-f]{64}$/.test(s.pin?.hash) && !json.includes(`"${FM_PIN}"`) && s.toast === 'Saved Casey — PIN set', JSON.stringify(s));
    r = await row();
    check('the editor then says the PIN is set, and blank keeps it', r.status.startsWith('PIN set') && r.status.includes('leave blank to keep it'), r.status);
    const hashes = await b.run(ew, `const long = 'x'.repeat(130) + 'é';
        const sub = async t => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))), x => x.toString(16).padStart(2, '0')).join('');
        return { abc: FloorPin.sha256('abc'), same: FloorPin.sha256(long) === await sub(long) && FloorPin.sha256('') === await sub('') };`);
    check('the built-in SHA-256 (for pages without Web Crypto) matches', hashes.abc === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' && hashes.same, JSON.stringify(hashes));
    await b.sleep(500);
    check('SitkaTools has the PIN record', (await b.run(main, `return DB.data._EmployeeWizard.employees.Casey.pin?.hash || null;`)) === s.pin.hash);

    // ---- DailyWizard: locked until a floor manager unlocks it ----
    await dwBuilding(b, dw, 'B1');   // back in DailyWizard (one tool at a time: it opens afresh), on Building 1 again
    await b.run(dw, `openTaskEditor('B1', 'wat1');`);
    check('locked: the task editor doesn\'t open', !(await b.run(dw, `return document.getElementById('editorOverlay').classList.contains('open');`)));
    const det = () => b.run(dw, `openTaskDetail('B1', 'wat1'); const r = { edit: getComputedStyle(document.getElementById('editTaskBtn')).display !== 'none',
        del: getComputedStyle(document.getElementById('deleteTaskBtn')).display !== 'none', addStep: [...document.querySelectorAll('#stepsList button')].some(x => x.textContent.includes('Add Step')),
        summary: document.getElementById('detailSummary').innerText }; closeTaskDetail(); return r;`);
    let dt = await det();
    check('locked: the task\'s detail has no Edit, Delete or + Add Step, and says how to unlock', !dt.edit && !dt.del && !dt.addStep && dt.summary.includes('tap ✏️ Edit tasks'), JSON.stringify(dt));
    await b.run(dw, `document.getElementById('editTasksBtn').click();`, { user: true });
    d = await dialog(dw);
    check('✏️ Edit tasks asks a floor manager for their PIN (Casey, the only one)', d.open && !d.none && d.names.join() === 'Casey' && d.why === 'Unlock editing of the daily tasks', JSON.stringify(d));
    await typePin(dw, '0000');
    d = await dialog(dw);
    check('a wrong PIN is refused and stays locked', d.open && d.err === 'Wrong PIN — try again' && !(await b.run(dw, 'return EditMode.on();')), JSON.stringify(d));
    await typePin(dw, FM_PIN);
    v = await bar(dw);
    check('the right PIN unlocks: + Add Task, ✅ Done editing, ▲ ▼ and who is editing', !(await dialog(dw)).open && v.add && v.done && v.move > 0 && v.note === '✏️ Editing as Casey', JSON.stringify(v));
    dt = await det();
    check('…and the detail has Edit Task, Delete Task and + Add Step', dt.edit && dt.del && dt.addStep, JSON.stringify(dt));
    await b.run(dw, `document.getElementById('doneEditingBtn').click();`, { user: true });
    v = await bar(dw);
    check('✅ Done editing locks it again', v.edit && !v.add && v.move === 0, JSON.stringify(v));

    // 10 minutes without an edit locks it, but not while the editor is open
    await dwUnlock(b, dw);
    await b.run(dw, `openTaskEditor('B1', 'wat1'); EditMode.last = Date.now() - 11 * 60000; EditMode.tick();`);
    check('idle with the task editor open: still unlocked', await b.run(dw, 'return EditMode.on();'));
    await b.run(dw, `closeTaskEditor(); EditMode.last = Date.now() - 11 * 60000; EditMode.tick();`);
    check('idle 10 minutes: locked again, and says so', !(await b.run(dw, 'return EditMode.on();')) &&
        (await b.run(dw, `return document.getElementById('toast').textContent;`)) === '🔒 Editing locked after 10 minutes without changes');

    // Five wrong PINs in a row: a one-minute wait
    await b.run(dw, `document.getElementById('editTasksBtn').click();`, { user: true });
    for (let i = 0; i < 5; i++) await typePin(dw, '9999');
    await typePin(dw, FM_PIN);
    d = await dialog(dw);
    check('after 5 wrong PINs even the right one waits a minute', d.open && d.err.startsWith('Too many wrong PINs') && !(await b.run(dw, 'return EditMode.on();')), d.err);
    await b.run(dw, `FloorPin._waitUntil = 0;`);
    await typePin(dw, FM_PIN);
    check('…then it works again', await b.run(dw, 'return EditMode.on();'));

    // ---- Deleting a task asks again, and is kept on record ----
    await b.run(dw, `openTaskDetail('B1', 'scu1'); document.getElementById('deleteTaskBtn').click();`, { user: true });
    d = await dialog(dw);
    check('Delete Task asks for a PIN even in edit mode', d.open && d.why === 'Delete the task "Scout rooms" (scu1)', d.why);
    await cancelPin(dw);
    check('Cancel keeps the task', await b.run(dw, `return DB.data._DailyWizard.buildings.B1.tasks.some(t => t.code === 'scu1');`));
    await b.run(dw, `document.getElementById('deleteTaskBtn').click();`, { user: true });
    await answerPin(b, dw);
    const adj = () => b.run(dw, `return DB.data._DailyWizard.buildings.B1.adjustments || [];`);
    let a = await adj();
    check('with the PIN the task goes, on record with who approved it', !(await b.run(dw, `return DB.data._DailyWizard.buildings.B1.tasks.some(t => t.code === 'scu1');`))
        && a.some(x => x.code === 'scu1' && x.deletedTask?.name === 'Scout rooms' && x.approvedBy === 'Casey'), JSON.stringify(a.map(x => x.code)));
    await b.run(dw, `EditMode.end();`);

    // ---- Removing hours: a PIN every time, any entry, always on record ----
    await logHours(b, dw, 'Water plants', 'Alex', 1, 0);
    await logHours(b, dw, 'Leaf Pick', 'Blair', 0, 45);
    await b.run(dw, `[...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Water plants')).querySelector(':scope > .hours-btn').click();`, { user: true });
    check('the hours view says removing needs a PIN', (await b.run(dw, `return document.getElementById('hoursNote').textContent;`)) === 'Removing an entry needs a floor manager’s PIN. Removed entries stay on record.');
    await b.run(dw, `document.querySelector('#hoursList .hours-del').click();`, { user: true });
    d = await dialog(dw);
    check('✕ asks for a floor manager\'s PIN, naming the entry', d.open && d.why.startsWith('Remove 1h logged by Alex on '), d.why);
    await cancelPin(dw);
    check('Cancel keeps the entry', (await b.run(dw, `return DB.data._DailyWizard.buildings.B1.labour['${T}'].wat1.length;`)) === 1);
    await b.run(dw, 'closeHours();');
    let toast = await removeHoursOf(b, dw, 'Water plants', 'Alex');
    a = await adj();
    check('with the PIN the chore entry goes, on record in the building with who approved it', toast === 'Entry removed — kept on record'
        && !(await b.run(dw, `return DB.data._DailyWizard.buildings.B1.labour?.['${T}']?.wat1 || null;`)) && a.some(x => x.code === 'wat1' && x.entry?.employee === 'Alex' && x.approvedBy === 'Casey'), toast);
    await b.run(dw, `[...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Water plants')).querySelector(':scope > .hours-btn').click();`, { user: true });
    const struck = await b.run(dw, `const e = document.querySelector('#hoursList .hours-entry.removed'); return e ? e.querySelector('.when').textContent : '';`);
    check('the hours view keeps it, struck through, with who approved it', struck.includes('approved by Casey'), struck);
    await b.run(dw, 'closeHours();');
    await removeHoursOf(b, dw, 'Leaf Pick', 'Blair');
    const mainAdj = await b.run(dw, `return DB.data._DailyWizard.adjustments || [];`);
    check('the office\'s removal from a crop task is on record in Main (_DailyWizard.adjustments)', mainAdj.some(x => x.eventId === 'ev_cropb1' && x.entry?.employee === 'Blair' && x.approvedBy === 'Casey'), JSON.stringify(mainAdj));

    // ---- The Tasks tab: a PIN to remove hours, on record ----
    await ewSetHours(b, ew, 'L100', 'ev_cropb1', T, 'Drew', 0, 30);
    await b.run(ew, `document.querySelector('#teEntryList .emp-del').click();`, { user: true });
    d = await dialog(ew);
    check('the Tasks tab\'s ✕ asks for a floor manager\'s PIN', d.open && d.why.startsWith('Remove 0h 30m logged by Drew'), d.why);
    await answerPin(b, ew);
    const rem = await b.run(ew, `return { left: (DB.data.calendarEvents.find(e => e.id === 'ev_cropb1').labour_map?.['${T}'] || []).map(e => e.employee), rec: DB.data._EmployeeWizard.labourRemovals || [] };`);
    check('…removes the entry and keeps it on record (_EmployeeWizard.labourRemovals)', !rem.left.includes('Drew') && rem.rec.some(x => x.eventId === 'ev_cropb1' && x.entry?.employee === 'Drew' && x.approvedBy === 'Casey'), JSON.stringify(rem));
    await b.run(ew, `document.getElementById('tabLog').click();`, { user: true });
    const flags = await b.run(ew, `return [...document.querySelectorAll('#logBody tr.removed')].map(tr => tr.textContent);`);
    check('the Labour Log shows all three removals, struck through, with who approved them',
        ['Alex', 'Blair', 'Drew'].every(n => flags.some(t => t.includes(n) && t.includes('approved by Casey'))), JSON.stringify(flags.map(t => t.slice(0, 60))));
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });
    await leave(b, dw); await b.send('browsingContext.close', { context: dw });
    await leave(b, main);

    // ---- A building tablet: the office's PIN works there; any entry in its building; recorded in its own file ----
    main = await fresh(b);
    const files = await splitFiles(b, main, BASE, withFloorManager(fixtureDb()));
    check('the PIN record is in Main.json', !!JSON.parse(files['Main.json'])._EmployeeWizard.employees.Casey.pin?.hash);
    await openSplit(b, main, BASE, 'B1', files);
    dw = await openTool(b, main, 'DailyWizard');
    check('on the tablet, Casey unlocks edit mode with her PIN', await dwUnlock(b, dw));
    await b.run(dw, `EditMode.end();`);
    await dwDate(b, dw, Y);
    toast = await removeHoursOf(b, dw, 'Scout rooms', 'Blair');   // yesterday's entry
    check('the tablet removes yesterday\'s entry with the PIN', toast === 'Entry removed — kept on record', toast);
    await b.sleep(400);
    const out = await saveSplit(b, main);
    const bf = JSON.parse(out['Building-B1.json'] || '{}');
    check('the record saves in Building-B1.json', (bf._DailyWizard?.buildings?.B1?.adjustments || []).some(x => x.code === 'scu1' && x.entry?.employee === 'Blair' && x.approvedBy === 'Casey' && x.by === 'B1'), Object.keys(out).join());
    const ewB = await openTool(b, main, 'EmployeeWizard');
    await b.run(ewB, `document.getElementById('tabTasks').click(); const lot = document.getElementById('activeLot'); lot.value = 'L100'; lot.dispatchEvent(new Event('change'));
        TASK.selectedKey = 'ev_oldb1'; TASK.editDate = '${Y}'; renderTasksTab();`, { user: true });
    const tb = await b.run(ewB, `const L = document.getElementById('teEntryList'); return { del: L.querySelectorAll('.emp-del').length, note: L.textContent };`);
    check('on the tablet the Tasks tab has no ✕ and points to DailyWizard', tb.del === 0 && tb.note.includes('use the task’s ⏱ in DailyWizard'), JSON.stringify(tb));
    await leave(b, ewB); await leave(b, dw); await leave(b, main);
    return results;
}
