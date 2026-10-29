// 🍂 / ✂️ Dry/Trim rooms (user request 2026-10-29): the Room Manager's designations include Dry/Trim, and a DailyWizard
// chore in a Dry/Trim room is a drying chore, a trimming chore, or either. A drying chore shows while a lot in the room
// is drying; a trimming chore only once a lot has moved from drying to trimming (its ✂️ trim log has started).
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, withFloorManager, dwBuilding, dwUnlock, today } from './lib/helpers.mjs';

export const title = 'Dry/Trim rooms: drying chores while a lot dries, trimming chores once it has moved to trimming';

function dryTrimDb() {
    const db = withFloorManager(fixtureDb());
    db.rooms.R1DT = { name: 'Dry 1', description: null, createdDate: '2026-01-01', assignedLots: [], buildingId: 'B1', designation: 'Dry/Trim' };
    db.buildings.B1.assignedRooms.push('R1DT');
    const chore = (code, name, dryTrim) => ({ code, emoji: '🍂', name, minutes: 15, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], monthDays: [], steps: [], roomId: 'R1DT', ...(dryTrim ? { dryTrim } : {}) });
    db._DailyWizard.buildings.B1.tasks.push(chore('dry2', 'Check dry room humidity', 'drying'), chore('trm2', 'Clean the trim tables', 'trimming'), chore('any2', 'Sweep Dry 1'));
    return db;
}
// A daily page of a drying or trim log for L100, started on `start`
function addLog(db, sheetId, document, start) {
    const pw = db._PaperWizard || (db._PaperWizard = { sheets: {}, wizards: {}, entries: {} });
    pw.sheets[sheetId] = { name: sheetId, orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'daily-weekly', document, fields: [], signature: null };
    ((pw.entries.L100 ||= {})[sheetId] ||= { instances: {} }).instances[start] = { room: 'Dry 1', header: {}, days: { [start]: { note: 'ok' } }, signature: null, completedAt: null };
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, dryTrimDb());

    // ---- The Room Manager offers Dry/Trim ----
    check('the Room Manager\'s designations include Dry/Trim', await b.run(main, `return [...document.getElementById('roomDesignation').options].some(o => o.value === 'Dry/Trim');`));

    let dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    const listed = () => b.run(dw, `renderAll(); return [...document.querySelectorAll('#listContainer .task-row:not(.empty-room)')].map(r => r.textContent).join(' | ');`);
    const has = (txt, name) => txt.includes(name);
    const set = (code) => b.run(main, code + '; DB.ensureStructure();');

    // ---- Dry 1 empty ----
    let t = await listed();
    check('Dry 1 empty: none of its chores show', !has(t, 'Check dry room humidity') && !has(t, 'Clean the trim tables') && !has(t, 'Sweep Dry 1'), t.slice(0, 300));

    // ---- A lot moves into Dry 1 (no drying or trim log): it's drying ----
    await set(`DB.data.lots.L100.currentRoom = 'Dry 1'`);
    t = await listed();
    check('a lot in Dry 1: the drying chore and the either chore show, the trimming chore doesn\'t', has(t, 'Check dry room humidity') && has(t, 'Sweep Dry 1') && !has(t, 'Clean the trim tables'), t.slice(0, 400));
    check('…the rows say 🍂 Drying (and ✂️ Trimming once shown)', await b.run(dw, `const row = [...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Check dry room humidity'));
        return row?.querySelector('.chip-drytrim')?.textContent === '🍂 Drying';`));

    // ---- Its drying log ----
    const db = dryTrimDb();
    db.lots.L100.currentRoom = 'Dry 1';
    addLog(db, 'dlog', 'drying-log', today(-6));
    await b.run(main, `DB.data._PaperWizard = ${JSON.stringify(db._PaperWizard)}; DB.ensureStructure();`);
    t = await listed();
    check('its 🍂 drying log: still drying', has(t, 'Check dry room humidity') && !has(t, 'Clean the trim tables'), t.slice(0, 400));

    // ---- Then its trim log starts: moved to trimming ----
    addLog(db, 'tlog', 'trim-log', today(-1));
    await b.run(main, `DB.data._PaperWizard = ${JSON.stringify(db._PaperWizard)}; DB.ensureStructure();`);
    t = await listed();
    check('its ✂️ trim log started: the trimming chore shows, the drying chore doesn\'t, the either chore still does',
        has(t, 'Clean the trim tables') && !has(t, 'Check dry room humidity') && has(t, 'Sweep Dry 1'), t.slice(0, 400));
    check('…tagged ✂️ Trimming', await b.run(dw, `const row = [...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Clean the trim tables'));
        return row?.querySelector('.chip-drytrim')?.textContent === '✂️ Trimming';`));
    check('…and the 🚪 button offers the hidden drying chore', await b.run(dw, `return document.querySelector('.empty-room-toggle')?.textContent || '';`) === '🚪 Show 1 chore for an empty room');

    // ---- Two lots in the room: one drying, one trimming ----
    await set(`DB.data.lots.L200.currentRoom = 'Dry 1'`);
    t = await listed();
    check('a second lot drying beside it: both kinds show', has(t, 'Clean the trim tables') && has(t, 'Check dry room humidity'), t.slice(0, 400));
    await set(`DB.data.lots.L200.currentRoom = 'Grow A'`);

    // ---- The room no longer designated Dry/Trim: ordinary room chores ----
    await set(`DB.data.rooms.R1DT.designation = null`);
    t = await listed();
    check('Dry 1 no longer Dry/Trim: all three show as room chores, no 🍂 / ✂️ tag', has(t, 'Clean the trim tables') && has(t, 'Check dry room humidity') && has(t, 'Sweep Dry 1') &&
        !(await b.run(dw, `return !!document.querySelector('#listContainer .chip-drytrim');`)), t.slice(0, 400));
    await set(`DB.data.rooms.R1DT.designation = 'Dry/Trim'`);

    // ---- The task editor ----
    await dwUnlock(b, dw);
    await b.run(dw, `document.getElementById('addTaskBtn').click();`, { user: true });
    const field = () => b.run(dw, `const g = document.getElementById('taskDryTrimGroup'), s = document.getElementById('taskDryTrimSelect');
        return { shown: !g.hidden, options: [...s.options].map(o => o.value + '=' + o.textContent), label: g.querySelector('label').textContent };`);
    let f = await field();
    check('a new chore, whole building: no Drying or trimming choice', !f.shown, JSON.stringify(f));
    const room = (id) => b.run(dw, `const s = document.getElementById('taskRoomSelect'); s.value = ${JSON.stringify(id)}; s.dispatchEvent(new Event('change'));`);
    await room('R1DT');
    f = await field();
    check('Dry 1 picked: "Drying or trimming" — either, 🍂 drying or ✂️ trimming', f.shown && f.label === 'Drying or trimming' &&
        f.options.join('|') === '=Either — while any lot is in the room|drying=🍂 Drying — while a lot dries|trimming=✂️ Trimming — once a lot has moved to trimming', JSON.stringify(f));
    await room('R1G1');
    check('Grow 1 picked: hidden again', !(await field()).shown);
    await room('R1DT');
    await b.run(dw, `document.getElementById('taskNameInput').value = 'Bag the trim'; document.getElementById('taskDryTrimSelect').value = 'trimming';
        document.getElementById('editorSaveBtn').click();`, { user: true });
    const saved = () => b.run(dw, `const t = DB.dailyBuildings.B1.tasks.find(x => x.name === 'Bag the trim'); return t ? { roomId: t.roomId, dryTrim: t.dryTrim ?? null, code: t.code } : null;`);
    let s = await saved();
    check('saved as a trimming chore in Dry 1', s?.roomId === 'R1DT' && s.dryTrim === 'trimming', JSON.stringify(s));
    check('SitkaTools has it', await b.run(main, `return DB.data._DailyWizard.buildings.B1.tasks.find(x => x.name === 'Bag the trim')?.dryTrim === 'trimming';`));
    await b.run(dw, `openTaskEditor('B1', ${JSON.stringify(s.code)});`);
    f = await field();
    check('editing it: the choice shows ✂️ trimming', f.shown && await b.run(dw, `return document.getElementById('taskDryTrimSelect').value;`) === 'trimming', JSON.stringify(f));
    await room('R1G1');
    await b.run(dw, `document.getElementById('editorSaveBtn').click();`, { user: true });
    s = await saved();
    check('moved to Grow 1: no longer a drying or trimming chore', s?.roomId === 'R1G1' && s.dryTrim === null, JSON.stringify(s));
    await b.run(main, `Tools.close(); clearUnsaved();`);
    return results;
}
