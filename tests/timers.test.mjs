// DailyWizard ⏲ timers: four pausable stopwatches on every row that takes hours (today only). Starting a cleared
// timer asks for initials or a label; ⏱ Log fills its hours from one, rounded to the nearest 5 minutes, without
// pausing or clearing it, so several people log from one timer. Timers keep their start time in the DB, so a running
// one keeps counting through a reopen, and on a building device they save in its own file.
import { today, fixtureDb, withFloorManager, answerPin, dwUnlock, makeChecker, fresh, openSitka, loadSingle, saveSingle, splitFiles, openSplit, saveSplit, openTool, dwBuilding, dwDate, leave } from './lib/helpers.mjs';

export const title = 'DailyWizard timers';

const ENTER = '';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today(), Y = today(-1);
    let main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, withFloorManager(fixtureDb()));
    let dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    await b.run(dw, `window.confirm = () => true;`);

    const rowJs = m => `[...document.querySelectorAll('#listContainer .task-row')].find(r => r.querySelector(':scope > .task-name')?.textContent.includes(${JSON.stringify(m)}))`;
    const slots = (m) => b.run(dw, `const row = ${rowJs(m)}; if (!row) return null;
        return [...row.querySelectorAll('.timer-slot')].map(s => ({ cls: s.className.replace('timer-slot', '').trim(), label: s.querySelector('.timer-name').textContent,
            time: s.querySelector('.timer-time').textContent, go: s.querySelector('.timer-go').textContent, clear: !s.querySelector('.timer-clear').disabled }));`);
    const tap = (m, n, which) => b.run(dw, `${rowJs(m)}.querySelector('.timer-slot[data-slot="${n}"] .timer-${which}').click();`, { user: true });
    const dialog = () => b.run(dw, `const d = document.getElementById('timerDialog');
        return { open: !d.hidden, title: document.getElementById('timerDialogTitle').textContent, ok: document.getElementById('timerDialogOk').textContent,
            focused: document.activeElement === document.getElementById('timerLabelInput'), value: document.getElementById('timerLabelInput').value };`);
    const timers = (ctx, code) => b.run(ctx, `return DB.data._DailyWizard.buildings.B1.timers?.[${JSON.stringify(code)}] || null;`);

    // ---- Every row that takes hours has four timers ----
    const shape = await b.run(dw, `const rows = [...document.querySelectorAll('#listContainer .task-row')];
        return rows.map(r => ({ name: r.querySelector('.task-name').textContent, hours: !!r.querySelector(':scope > .hours-btn'), timers: r.querySelectorAll('.timer-slot').length }));`);
    const withHours = shape.filter(r => r.hours);
    check('every row with ⏱ Log has four timers (chores, 🧰 Miscellaneous labour, crop and equipment tasks, Still open)', withHours.length === 6 && withHours.some(r => r.name === 'Miscellaneous labour') && withHours.every(r => r.timers === 4), JSON.stringify(shape));
    check('rows without ⏱ Log (Upcoming, projections) have none', shape.filter(r => !r.hours).every(r => r.timers === 0), JSON.stringify(shape.filter(r => !r.hours)));
    let s = await slots('Water plants');
    check('a fresh timer reads 00:00 with ▶ and no ✕', s.every(x => x.time === '00:00' && x.go === '▶' && !x.clear && !x.label), JSON.stringify(s));

    // ---- ▶ on a cleared timer asks for initials; Enter starts it ----
    await tap('Water plants', 2, 'go');
    let d = await dialog();
    check('▶ on a cleared timer asks for initials or a label', d.open && d.focused && d.title.includes('Timer 2') && d.title.includes('Water plants') && d.ok === '▶ Start', JSON.stringify(d));
    await b.keys(dw, 'AB' + ENTER);
    s = await slots('Water plants');
    let t = await timers(dw, 'wat1');
    check('Enter starts it, labelled', !(await dialog()).open && s[1].label === 'AB' && s[1].go === '⏸' && s[1].cls === 'running' && s[1].clear, JSON.stringify(s[1]));
    check('the DB keeps the label and the time it started', t?.['2']?.label === 'AB' && t['2'].ms === 0 && Math.abs(Date.now() - Date.parse(t['2'].since)) < 10000, JSON.stringify(t));
    await b.sleep(400);
    const inMain = await b.run(main, `return { t: DB.data._DailyWizard.buildings.B1.timers?.wat1?.['2'] || null, unsaved: hasUnsavedChanges };`);
    check('SitkaTools got it and has it unsaved', inMain.t?.since === t['2'].since && inMain.unsaved, JSON.stringify(inMain));
    await b.sleep(1300);
    s = await slots('Water plants');
    check('it counts up on the row', /^00:0[1-3]$/.test(s[1].time), s[1].time);

    // ---- ⏸ banks the run; ▶ resumes without asking ----
    await tap('Water plants', 2, 'go');
    t = await timers(dw, 'wat1');
    s = await slots('Water plants');
    check('⏸ pauses: the run is banked and the start time goes', !t['2'].since && t['2'].ms >= 1000 && s[1].cls === 'paused' && s[1].go === '▶', JSON.stringify(t['2']));
    const pausedAt = s[1].time;
    await b.sleep(1200);
    check('a paused timer stands still', (await slots('Water plants'))[1].time === pausedAt, pausedAt);
    await tap('Water plants', 2, 'go');
    t = await timers(dw, 'wat1');
    check('▶ resumes without asking again, keeping the banked time', !(await dialog()).open && !!t['2'].since && t['2'].ms >= 1000 && t['2'].label === 'AB', JSON.stringify(t['2']));

    // ---- Cancel starts nothing; a blank label starts an unlabelled timer; tapping a label renames ----
    await tap('Water plants', 3, 'go');
    await b.run(dw, `document.getElementById('timerDialogCancel').click();`);
    check('Cancel starts nothing', !(await timers(dw, 'wat1'))['3'] && !(await dialog()).open);
    await tap('Water plants', 4, 'go');
    await b.run(dw, `document.getElementById('timerDialogOk').click();`);
    t = await timers(dw, 'wat1');
    check('a blank label still starts it', !!t['4']?.since && !('label' in t['4']), JSON.stringify(t['4']));
    await tap('Water plants', 4, 'label');
    d = await dialog();
    check('tapping a timer\'s label asks for a new one', d.open && d.ok === 'Save' && d.value === '', JSON.stringify(d));
    await b.keys(dw, 'CK' + ENTER);
    t = await timers(dw, 'wat1');
    check('…and saves it without stopping the timer', t['4'].label === 'CK' && !!t['4'].since, JSON.stringify(t['4']));

    // ---- ⏱ Log: pick a timer to fill the hours, rounded to 5 minutes; it stays as it was ----
    await b.run(dw, `const tm = DB.data._DailyWizard.buildings.B1.timers.wat1;
        tm['2'] = { label: 'AB', ms: (23 * 60 + 41) * 1000 };
        tm['4'] = { label: 'CK', ms: 0, since: new Date(Date.now() - 22 * 60000).toISOString() };
        notifySitkaTools(); renderAll();`);
    s = await slots('Water plants');
    check('the row shows each timer\'s time', s[1].time === '23:41' && /^22:0\d$/.test(s[3].time), JSON.stringify(s.map(x => x.time)));
    const picks = () => b.run(dw, `return [...document.querySelectorAll('#hoursTimerPicks .timer-pick')].map(l => ({ text: l.innerText.replace(/\\s+/g, ' ').trim(),
        disabled: l.querySelector('input').disabled, checked: l.querySelector('input').checked }));`);
    const openLog = (m) => b.run(dw, `${rowJs(m)}.querySelector(':scope > .hours-btn').click();`, { user: true });
    const pick = (n) => b.run(dw, `document.querySelector('#hoursTimerPicks input[value="${n}"]').closest('label').click();
        return { h: document.getElementById('hoursH').value, m: document.getElementById('hoursM').value };`);
    const signAndAdd = async (who) => {
        await b.run(dw, `const w = document.getElementById('hoursWho'); w.value = ${JSON.stringify(who)}; w.dispatchEvent(new Event('change'));`);
        await b.drag(dw, '#hoursPad', [[0.2, 0.7], [0.3, 0.3], [0.4, 0.7]]);
        await b.run(dw, `document.getElementById('hoursAddBtn').click();`, { user: true });
        return b.run(dw, `return document.getElementById('toast').textContent;`);
    };
    await openLog('Water plants');
    let p = await picks();
    check('⏱ Log offers the four timers and "None", with None picked', p.length === 5 && p[4].checked && p[4].text.startsWith('None'), JSON.stringify(p));
    check('timers with no time are greyed out', p[0].disabled && p[2].disabled && !p[1].disabled && !p[3].disabled, JSON.stringify(p.map(x => x.disabled)));
    check('a timer shows its label, its time and what it logs', p[1].text === 'Timer 2 (AB) 23:41 → 25m' && /^Timer 4 \(CK\) 22:0\d → 20m$/.test(p[3].text), `${p[1].text} | ${p[3].text}`);
    let f = await pick(2);
    check('picking Timer 2 fills 0 h 25 min (23:41 to the nearest 5)', f.h === '0' && f.m === '25', JSON.stringify(f));
    let toast = await signAndAdd('Alex');
    await openLog('Water plants');
    f = await pick(2);
    toast += ' | ' + await signAndAdd('Blair');
    const logged = await b.run(dw, `return DB.data._DailyWizard.buildings.B1.labour['${T}'].wat1.map(e => [e.employee, e.hours]);`);
    check('two people log 25 min each from the same timer', JSON.stringify(logged) === '[["Alex",0.417],["Blair",0.417]]', JSON.stringify(logged) + ' — ' + toast);
    t = await timers(dw, 'wat1');
    check('logging from a timer doesn\'t pause or clear it', t['2'].ms === 1421000 && t['2'].label === 'AB' && !!t['4'].since, JSON.stringify(t));
    check('after Add hours the pick goes back to None', (await picks())[4].checked);
    f = await pick(4);
    check('a running timer fills its time so far (22 min → 20 min)', f.h === '0' && f.m === '20', JSON.stringify(f));
    await b.run(dw, 'closeHours();');
    const r = await b.run(dw, `return [timerLogMinutes(10000), timerLogMinutes(150000), timerLogMinutes(1349000), timerLogMinutes(3751000), fmtClock(3751000), fmtClock(83000)];`);
    check('rounding: 10 s → 5, 2:30 → 5, 22:29 → 20, 1:02:31 → 65 min; past an hour it reads H:MM:SS', JSON.stringify(r) === '[5,5,20,65,"1:02:31","01:23"]', JSON.stringify(r));

    // ---- ✕ asks first ----
    await b.run(dw, `window.confirm = () => false;`);
    await tap('Water plants', 2, 'clear');
    check('✕ answered No keeps the timer', !!(await timers(dw, 'wat1'))['2']);
    await b.run(dw, `window.__asked = ''; window.confirm = (q) => { window.__asked = q; return true; };`);
    await tap('Water plants', 2, 'clear');
    t = await timers(dw, 'wat1');
    const asked = await b.run(dw, 'return window.__asked;');
    check('✕ answered Yes clears it (time and label)', !t['2'] && asked.includes('Timer 2 (AB)') && asked.includes('23:41'), asked);
    s = await slots('Water plants');
    check('the cleared timer reads 00:00 again', s[1].time === '00:00' && !s[1].label && !s[1].clear, JSON.stringify(s[1]));

    // ---- Other days: no timers on the rows or in ⏱ Log ----
    await dwDate(b, dw, Y);
    check('another day shows no timers', await b.run(dw, `return document.querySelectorAll('.timer-strip').length === 0;`));
    await openLog('Water plants');
    check('…and its ⏱ Log offers none', await b.run(dw, `return document.getElementById('hoursTimerGroup').hidden && !document.querySelector('#hoursTimerPicks input');`));
    await b.run(dw, 'closeHours();');
    await dwDate(b, dw, T);

    // ---- A deleted chore's timers are tidied away with the next timer change ----
    await b.run(dw, `DB.data._DailyWizard.buildings.B1.timers.scu1 = { 1: { label: 'Z', ms: 5000 } }; renderAll();`);
    check('Scout rooms has a timer', (await slots('Scout rooms'))[0].label === 'Z');
    await dwUnlock(b, dw);   // deleting a task: edit mode, then the floor manager's PIN again
    await b.run(dw, `openTaskDetail('B1', 'scu1'); document.getElementById('deleteTaskBtn').click();`, { user: true });
    await answerPin(b, dw);
    await tap('Water plants', 1, 'go');
    await b.run(dw, `document.getElementById('timerDialogOk').click();`);
    const all = await b.run(dw, 'return DB.data._DailyWizard.buildings.B1.timers;');
    check('the deleted chore\'s timers are gone', !all.scu1 && !!all.wat1['1'].since, JSON.stringify(Object.keys(all)));

    // ---- Spanish ----
    await b.run(dw, `const s = document.getElementById('langSelect'); s.value = 'es'; s.dispatchEvent(new Event('change'));`);
    await openLog('Water plants');
    const es = await b.run(dw, `return { lbl: document.getElementById('hoursTimerLbl').textContent, first: document.querySelector('#hoursTimerPicks .tp-name').textContent };`);
    check('in Spanish the timers are "Cronómetro"', es.lbl === 'Tiempo de un cronómetro' && es.first === 'Cronómetro 1', JSON.stringify(es));
    await b.run(dw, `closeHours(); const s = document.getElementById('langSelect'); s.value = 'en'; s.dispatchEvent(new Event('change'));`);

    // ---- Saved with the DB: a running timer keeps counting after a reopen ----
    await b.sleep(400);
    const saved = JSON.parse(await saveSingle(b, main));
    const st = saved._DailyWizard.buildings.B1.timers.wat1;
    check('the saved file has the timers (start times, labels, banked time)', !!st['1'].since && st['4'].label === 'CK' && !!st['4'].since && !st['2'], JSON.stringify(st));
    await b.send('browsingContext.close', { context: dw });
    await openSitka(b, main, BASE);
    await loadSingle(b, main, saved);
    dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    s = await slots('Water plants');
    check('after reopening, Timer 4 (CK) is still running from its start time', s[3].label === 'CK' && s[3].cls === 'running' && /^2[2-4]:\d\d$/.test(s[3].time), JSON.stringify(s[3]));
    await b.send('browsingContext.close', { context: dw });
    await leave(b, main);

    // ---- A building device: timers on its own rows only, saved in its own file ----
    main = await fresh(b);
    const files = await splitFiles(b, main, BASE, fixtureDb());
    await openSplit(b, main, BASE, 'B1', files);
    dw = await openTool(b, main, 'DailyWizard');
    check('building device: its own rows have timers (Miscellaneous labour too)', await b.run(dw, `return document.querySelectorAll('.timer-strip').length === 6;`));
    await tap('Water plants', 1, 'go');
    await b.keys(dw, 'EF' + ENTER);
    await dwBuilding(b, dw, 'B2');
    check('…another building\'s rows have none', await b.run(dw, `return document.querySelectorAll('.task-row').length > 0 && document.querySelectorAll('.timer-strip').length === 0;`));
    await dwBuilding(b, dw, 'ALL');
    const allView = await b.run(dw, `return [...document.querySelectorAll('.building-section')].map(s => s.querySelectorAll('.timer-strip').length);`);
    check('…and in All Buildings only its own section has them', allView[0] === 6 && allView.slice(1).every(n => n === 0), JSON.stringify(allView));
    await b.sleep(400);
    const out = await saveSplit(b, main);
    const bf = JSON.parse(out['Building-B1.json'] || '{}');
    check('the timer saves in Building-B1.json, and Main.json isn\'t touched', bf._DailyWizard?.buildings?.B1?.timers?.wat1?.['1']?.label === 'EF' && !out['Main.json'], Object.keys(out).join());
    await b.send('browsingContext.close', { context: dw });
    await leave(b, main);
    return results;
}
