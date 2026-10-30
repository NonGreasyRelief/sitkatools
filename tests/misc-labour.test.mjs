// DailyWizard's 🧰 Miscellaneous labour: a built-in row in every building's list (no tick box, ＋ Start task, ⏱ Log)
// for hours on anything that isn't on the list. Its hours need a note saying what was done; every other row takes an
// optional note. The Labour & Cost Wizard names the row and shows the notes.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, dwBuilding, logHours, leave, today } from './lib/helpers.mjs';

export const title = 'DailyWizard Miscellaneous labour, and notes on hours';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today();
    const db = fixtureDb();
    // A third building with no daily tasks at all
    db.buildings.B3 = { name: 'Building 3', description: null, createdDate: '2026-01-01', assignedRooms: ['R3G1'] };
    db.rooms.R3G1 = { name: 'Grow Z', description: null, createdDate: '2026-01-01', assignedLots: [], isFlowering: true, buildingId: 'B3' };
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db);
    const dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');

    const miscRow = (bid = null) => b.run(dw, `
        const rows = [...document.querySelectorAll('#listContainer .misc-row')];
        const r = rows[0];
        return r ? { n: rows.length, text: r.textContent, check: !!r.querySelector('.task-check input'), log: !!r.querySelector(':scope > .hours-btn'),
            timers: r.querySelectorAll('.signin-start').length } : null;`);
    let r = await miscRow();
    check('Building 1 lists 🧰 Miscellaneous labour', r?.text.includes('Miscellaneous labour'), JSON.stringify(r));
    check('…with ⏱ Log and ＋ Start task, and no tick box', r?.log && r.timers === 1 && !r.check, JSON.stringify(r));
    check('…first in the list, above the chores (it was at the bottom)', await b.run(dw, `return document.querySelector('#listContainer .task-row')?.classList.contains('misc-row') === true;`));
    check('opening it changes nothing', (await b.run(main, 'return hasUnsavedChanges;')) === false);
    check('it isn\'t one of the building\'s tasks', !(await b.run(dw, `return DB.dailyBuildings.B1.tasks.some(t => t.code === 'misc');`)));

    // A note is needed on Miscellaneous labour
    let res = await logHours(b, dw, 'Miscellaneous labour', 'Alex', 0, 30);
    check('Misc hours without a note are refused', !res.ok && res.toast === 'Say what you were doing', JSON.stringify(res));
    check('…and nothing is saved', !(await b.run(dw, `return DB.dailyBuildings.B1.labour?.['${T}']?.misc?.length || 0;`)));
    res = await logHours(b, dw, 'Miscellaneous labour', 'Alex', 0, 30, { note: '  Moved the   soil pallets ' });
    check('with a note, they\'re logged', res.ok, JSON.stringify(res));
    const misc = await b.run(dw, `return DB.dailyBuildings.B1.labour['${T}'].misc;`);
    check('saved under the building\'s labour as "misc", with the note (spaces tidied)', misc?.length === 1 && misc[0].employee === 'Alex' && misc[0].hours === 0.5 && misc[0].note === 'Moved the soil pallets', JSON.stringify(misc));
    const shown = await b.run(dw, `document.querySelector('#listContainer .misc-row .hours-btn').click(); const t = [...document.querySelectorAll('#hoursList .entry-note')].map(e => e.textContent);
        const lbl = document.getElementById('hoursCommentLbl').textContent; closeHours(); return { t, lbl };`, { user: true });
    check('the hours view shows the note, and asks "What were you doing?"', shown.t.join() === '📝 Moved the soil pallets' && shown.lbl.startsWith('What were you doing?'), JSON.stringify(shown));

    // Other rows: the note is optional
    res = await logHours(b, dw, 'Water plants', 'Blair', 0, 15, { note: 'Topped up the reservoir' });
    const water = await b.run(dw, `const code = DB.dailyBuildings.B1.tasks.find(t => t.name === 'Water plants').code; return DB.dailyBuildings.B1.labour['${T}'][code];`);
    check('a chore takes an optional note', res.ok && water?.[0]?.note === 'Topped up the reservoir', JSON.stringify(water));
    res = await logHours(b, dw, 'Scout rooms', 'Blair', 0, 10);
    check('…and logs without one', res.ok, JSON.stringify(res));
    check('a chore\'s note box says it\'s optional', (await b.run(dw, `const btn = [...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Scout rooms')).querySelector('.hours-btn');
        btn.click(); const l = document.getElementById('hoursCommentLbl').textContent; closeHours(); return l;`, { user: true })).startsWith('Note (optional)'));

    // A timer left on it from before sign-ins is kept like any chore's
    const kept = await b.run(dw, `const tm = DB.dailyBuildings.B1.timers || (DB.dailyBuildings.B1.timers = {}); tm.misc = { 1: { label: 'AB', ms: 60000 } }; timersChanged('B1'); return DB.dailyBuildings.B1.timers?.misc?.[1]?.ms;`);
    check('a timer on Miscellaneous labour isn\'t tidied away', kept === 60000, String(kept));

    // All Buildings: every building has the row; a building with no daily tasks too
    await dwBuilding(b, dw, 'ALL');
    r = await miscRow();
    check('All Buildings: one Miscellaneous labour row per building', r?.n === 3, JSON.stringify(r));
    await dwBuilding(b, dw, 'B3');
    r = await miscRow();
    check('a building with no daily tasks still lists it', r?.text.includes('Miscellaneous labour') && r.log, JSON.stringify(r));
    res = await logHours(b, dw, 'Miscellaneous labour', 'Casey', 1, 0, { note: 'Swept the loading bay' });
    const b3 = await b.run(dw, `return DB.dailyBuildings.B3;`);
    check('…and logging there makes its bare entry', res.ok && Array.isArray(b3?.tasks) && b3.tasks.length === 0 && b3.labour?.[T]?.misc?.[0]?.note === 'Swept the loading bay', JSON.stringify(b3));

    // 🌐 The row's name follows the language
    await dwBuilding(b, dw, 'B1');
    await b.run(dw, `const s = document.getElementById('langSelect'); s.value = 'es'; s.dispatchEvent(new Event('change'));`);
    check('in Spanish it reads "Trabajos varios"', (await miscRow())?.text.includes('Trabajos varios'));
    await b.run(dw, `const s = document.getElementById('langSelect'); s.value = 'en'; s.dispatchEvent(new Event('change'));`);
    await b.sleep(400);

    // ---- The Labour & Cost Wizard ----
    const ew = await openTool(b, main, 'EmployeeWizard');
    await b.run(ew, `document.getElementById('tabLog').click();`, { user: true });
    const rows = await b.run(ew, `return [...document.querySelectorAll('#logBody tbody tr')].map(tr => ({ text: tr.textContent, flags: [...tr.querySelectorAll('.log-flag')].map(f => f.textContent) }));`);
    const alex = rows.find(x => x.text.includes('Alex') && x.text.includes('Miscellaneous labour'));
    check('Labour Log: the Misc entry is named and shows its note', alex?.text.includes('🧰 Miscellaneous labour') && alex.flags.includes('📝 Moved the soil pallets'), JSON.stringify(alex));
    check('Labour Log: a chore\'s optional note shows too', rows.some(x => x.text.includes('Water plants') && x.flags.includes('📝 Topped up the reservoir')));
    const rpt = await b.run(ew, `return rptChoreLabour().filter(x => x.code === 'misc').map(x => ({ label: x.label, roomId: x.roomId, h: x.hours, b: x.buildingId }));`);
    check('Reports: Misc hours count as whole-building chore hours, named', rpt.length === 2 && rpt.every(x => x.label === '🧰 Miscellaneous labour' && !x.roomId) && rpt.some(x => x.b === 'B3' && x.h === 1), JSON.stringify(rpt));

    await leave(b, main);
    return results;
}
