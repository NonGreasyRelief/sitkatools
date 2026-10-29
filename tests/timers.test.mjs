// DailyWizard's second line on each row that takes hours: ＋ Start task (badge sign-ins, user decision 2026-10-28, which
// replaced the four ⏲ timers) — today only, in the buildings this device changes. A timer left from before sign-ins
// stays on its row until it's cleared: it keeps counting from its start time (through a reopen), ⏱ Log can still fill
// its hours from it (rounded to the nearest 5 minutes, without pausing or clearing it), and ✕ clears it, asking first.
import { today, fixtureDb, withFloorManager, answerPin, dwUnlock, makeChecker, fresh, openSitka, loadSingle, saveSingle, splitFiles, openSplit, saveSplit, openTool, dwBuilding, dwDate, leave } from './lib/helpers.mjs';

export const title = 'DailyWizard sign-in strip and timers left from before';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today(), Y = today(-1);
    const db = withFloorManager(fixtureDb());
    // Timers that were in use when sign-ins came: one paused with time on it, one running for 22 minutes
    db._DailyWizard.buildings.B1.timers = { wat1: { 2: { label: 'AB', ms: (23 * 60 + 41) * 1000 }, 4: { label: 'CK', ms: 0, since: new Date(Date.now() - 22 * 60000).toISOString() } } };
    let main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db);
    let dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');

    const rowJs = m => `[...document.querySelectorAll('#listContainer .task-row')].find(r => r.querySelector(':scope > .task-name')?.textContent.includes(${JSON.stringify(m)}))`;
    const slots = (m) => b.run(dw, `const row = ${rowJs(m)}; if (!row) return null;
        return [...row.querySelectorAll('.timer-slot')].map(s => ({ n: s.dataset.slot, cls: s.className.replace('timer-slot', '').replace('legacy', '').trim(), head: s.querySelector('.timer-head').textContent,
            time: s.querySelector('.timer-time').textContent, clear: !!s.querySelector('.timer-clear') }));`);
    const timers = (ctx, code) => b.run(ctx, `return DB.data._DailyWizard.buildings.B1.timers?.[${JSON.stringify(code)}] || null;`);

    // ---- Every row that takes hours has ＋ Start task; no new timers ----
    const shape = await b.run(dw, `const rows = [...document.querySelectorAll('#listContainer .task-row')];
        return rows.map(r => ({ name: r.querySelector('.task-name').textContent, hours: !!r.querySelector(':scope > .hours-btn'), start: r.querySelectorAll('.signin-start').length, go: r.querySelectorAll('.timer-go').length }));`);
    const withHours = shape.filter(r => r.hours);
    check('every row with ⏱ Log has ＋ Start task (chores, 🧰 Miscellaneous labour, crop and equipment tasks, Still open)', withHours.length === 6 && withHours.some(r => r.name === 'Miscellaneous labour') && withHours.every(r => r.start === 1), JSON.stringify(shape));
    check('rows without ⏱ Log (Upcoming, projections) have none', shape.filter(r => !r.hours).every(r => r.start === 0), JSON.stringify(shape.filter(r => !r.hours)));
    check('no row can start a timer any more', shape.every(r => r.go === 0));

    // ---- Timers left from before: on their row, counting ----
    let s = await slots('Water plants');
    check('the timers in use stay on their row, after ＋ Start task', s.length === 2 && s[0].head.includes('Timer 2 (AB)') && s[0].time === '23:41' && s[0].cls === 'paused' && s[1].cls === 'running' && /^22:0\d$/.test(s[1].time) && s.every(x => x.clear), JSON.stringify(s));
    check('rows with no timer have none', (await slots('Scout rooms')).length === 0);
    const t0 = s[1].time;
    for (let i = 0; i < 30; i++) { s = await slots('Water plants'); if (s[1].time !== t0) break; await b.sleep(100); }
    check('a running one keeps counting', s[1].time !== t0, `${t0} → ${s[1].time}`);

    // ---- ⏱ Log: fill the hours from one, rounded to 5 minutes; it stays as it was ----
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
    check('⏱ Log offers the row\'s timers and "None", with None picked', p.length === 3 && p[2].checked && p[2].text.startsWith('None'), JSON.stringify(p));
    check('a timer shows its label, its time and what it logs', p[0].text === 'Timer 2 (AB) 23:41 → 25m' && /^Timer 4 \(CK\) 22:\d\d → 20m$/.test(p[1].text), `${p[0].text} | ${p[1].text}`);
    let f = await pick(2);
    check('picking Timer 2 fills 0 h 25 min (23:41 to the nearest 5)', f.h === '0' && f.m === '25', JSON.stringify(f));
    let toast = await signAndAdd('Alex');
    await openLog('Water plants');
    f = await pick(2);
    toast += ' | ' + await signAndAdd('Blair');
    const logged = await b.run(dw, `return DB.data._DailyWizard.buildings.B1.labour['${T}'].wat1.map(e => [e.employee, e.hours]);`);
    check('two people log 25 min each from the same timer', JSON.stringify(logged) === '[["Alex",0.417],["Blair",0.417]]', JSON.stringify(logged) + ' — ' + toast);
    let t = await timers(dw, 'wat1');
    check('logging from a timer doesn\'t pause or clear it', t['2'].ms === 1421000 && t['2'].label === 'AB' && !!t['4'].since, JSON.stringify(t));
    check('after Add hours the pick goes back to None', (await picks())[2].checked);
    f = await pick(4);
    check('a running timer fills its time so far (22 min → 20 min)', f.h === '0' && f.m === '20', JSON.stringify(f));
    await b.run(dw, 'closeHours();');
    await openLog('Scout rooms');
    check('a row with no timer offers none in ⏱ Log', await b.run(dw, `return document.getElementById('hoursTimerGroup').hidden && !document.querySelector('#hoursTimerPicks input');`));
    await b.run(dw, 'closeHours();');
    const r = await b.run(dw, `return [timerLogMinutes(10000), timerLogMinutes(150000), timerLogMinutes(1349000), timerLogMinutes(3751000), fmtClock(3751000), fmtClock(83000)];`);
    check('rounding: 10 s → 5, 2:30 → 5, 22:29 → 20, 1:02:31 → 65 min; past an hour it reads H:MM:SS', JSON.stringify(r) === '[5,5,20,65,"1:02:31","01:23"]', JSON.stringify(r));

    // ---- ✕ asks first ----
    const clear = n => b.run(dw, `${rowJs('Water plants')}.querySelector('.timer-slot[data-slot="${n}"] .timer-clear').click();`, { user: true });
    await b.run(dw, `window.confirm = () => false;`);
    await clear(2);
    check('✕ answered No keeps the timer', !!(await timers(dw, 'wat1'))['2']);
    await b.run(dw, `window.__asked = ''; window.confirm = (q) => { window.__asked = q; return true; };`);
    await clear(2);
    t = await timers(dw, 'wat1');
    const asked = await b.run(dw, 'return window.__asked;');
    check('✕ answered Yes clears it (time and label)', !t['2'] && asked.includes('Timer 2 (AB)') && asked.includes('23:41'), asked);
    s = await slots('Water plants');
    check('…and it leaves the row', s.length === 1 && s[0].n === '4', JSON.stringify(s));

    // ---- Other days: no strip ----
    await dwDate(b, dw, Y);
    check('another day shows no ＋ Start task or timers', await b.run(dw, `return document.querySelectorAll('.timer-strip').length === 0;`));
    await openLog('Water plants');
    check('…and its ⏱ Log offers no timer', await b.run(dw, `return document.getElementById('hoursTimerGroup').hidden && !document.querySelector('#hoursTimerPicks input');`));
    await b.run(dw, 'closeHours();');
    await dwDate(b, dw, T);

    // ---- A deleted chore's timers are tidied away with the next timer change ----
    await b.run(dw, `DB.data._DailyWizard.buildings.B1.timers.scu1 = { 1: { label: 'Z', ms: 5000 } }; renderAll();`);
    check('Scout rooms has a timer', (await slots('Scout rooms'))[0]?.head.includes('Z'));
    await dwUnlock(b, dw);   // deleting a task: edit mode, then the floor manager's PIN again
    await b.run(dw, `openTaskDetail('B1', 'scu1'); document.getElementById('deleteTaskBtn').click();`, { user: true });
    await answerPin(b, dw);
    await b.run(dw, `DB.data._DailyWizard.buildings.B1.timers.wat1['1'] = { ms: 1000 }; window.confirm = () => true; renderAll();`);
    await clear(1);
    const all = await b.run(dw, 'return DB.data._DailyWizard.buildings.B1.timers;');
    check('the deleted chore\'s timers are gone', !all.scu1 && !!all.wat1['4'].since, JSON.stringify(Object.keys(all)));

    // ---- Spanish ----
    await b.run(dw, `const s = document.getElementById('langSelect'); s.value = 'es'; s.dispatchEvent(new Event('change'));`);
    const es = await b.run(dw, `return { start: document.querySelector('#listContainer .signin-start').textContent, timer: document.querySelector('#listContainer .timer-slot .timer-head').textContent };`);
    check('in Spanish: "＋ Empezar tarea", and the old timers are "Cronómetro"', es.start === '＋ Empezar tarea' && es.timer.includes('Cronómetro 4'), JSON.stringify(es));
    await b.run(dw, `const s = document.getElementById('langSelect'); s.value = 'en'; s.dispatchEvent(new Event('change'));`);

    // ---- Saved with the DB: a running timer keeps counting after a reopen ----
    await b.sleep(400);
    await b.run(main, `Tools.close();`);
    const saved = JSON.parse(await saveSingle(b, main));
    const st = saved._DailyWizard.buildings.B1.timers.wat1;
    check('the saved file keeps the timer that\'s left (start time, label)', st['4'].label === 'CK' && !!st['4'].since && !st['2'] && !st['1'], JSON.stringify(st));
    await openSitka(b, main, BASE);
    await loadSingle(b, main, saved);
    dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    s = await slots('Water plants');
    check('after reopening, Timer 4 (CK) is still running from its start time', s[0]?.head.includes('CK') && s[0].cls === 'running' && /^2[2-4]:\d\d$/.test(s[0].time), JSON.stringify(s));
    await b.run(main, `Tools.close();`);
    await leave(b, main);

    // ---- A building device: ＋ Start task on its own rows only ----
    main = await fresh(b);
    const files = await splitFiles(b, main, BASE, fixtureDb());
    await openSplit(b, main, BASE, 'B1', files);
    dw = await openTool(b, main, 'DailyWizard');
    check('building device: its own rows have ＋ Start task (Miscellaneous labour too)', await b.run(dw, `return document.querySelectorAll('.timer-strip .signin-start').length === 6;`));
    await dwBuilding(b, dw, 'B2');
    check('…another building\'s rows have none', await b.run(dw, `return document.querySelectorAll('.task-row').length > 0 && document.querySelectorAll('.timer-strip').length === 0;`));
    await dwBuilding(b, dw, 'ALL');
    const allView = await b.run(dw, `return [...document.querySelectorAll('.building-section')].map(s => s.querySelectorAll('.timer-strip').length);`);
    check('…and in All Buildings only its own section has them', allView[0] === 6 && allView.slice(1).every(n => n === 0), JSON.stringify(allView));
    await b.run(main, `Tools.close();`);
    await leave(b, main);
    return results;
}
