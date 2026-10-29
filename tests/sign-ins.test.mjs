// 🪪 DailyWizard's ＋ Start task: a badge scan signs a person (or a temp crew, with how many are on it) in to a row, and
// a scan anywhere signs them out, logging the hours to the minute with the badge as their signature. One task at a time;
// a sign-in forgotten overnight waits for a floor manager's closing time; a floor manager's badge signs off, unlocks
// editing and approves removals; ⏱ Log takes a badge in place of drawn initials. Timers left from before still show.
import { today, fixtureDb, withFloorManager, withBadge, withCrew, badgeOf, scanBadge, makeChecker, fresh, openSitka, loadSingle, saveSingle,
    splitFiles, openSplit, saveSplit, openTool, dwBuilding } from './lib/helpers.mjs';

export const title = 'DailyWizard sign-ins (badge scans)';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today(), Y = today(-1);
    const db = withCrew(withBadge(withBadge(withBadge(withBadge(withFloorManager(fixtureDb()), 'Alex'), 'Blair'), 'Casey'), 'Drew'));
    db._DailyWizard.buildings.B1.timers = { wat1: { 2: { label: 'KN', ms: 120000 } } };   // a timer from before sign-ins
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db);
    const dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');

    const row = match => `[...document.querySelectorAll('#listContainer .task-row')].find(r => r.querySelector('.task-name')?.textContent.includes(${JSON.stringify(match)}))`;
    const startOn = match => b.run(dw, `${row(match)}.querySelector('.signin-start').click();`, { user: true });
    const chips = match => b.run(dw, `return [...(${row(match)}?.querySelectorAll('.signin-chip') || [])].map(c => ({ who: c.querySelector('.sc-who').textContent, forgot: c.classList.contains('forgot'), time: c.querySelector('.sc-time').textContent }));`);
    const signIns = () => b.run(dw, `return Object.values(DB.data._DailyWizard.buildings.B1.signIns || {});`);
    const backdate = (name, min) => b.run(dw, `for (const s of Object.values(DB.data._DailyWizard.buildings.B1.signIns || {})) if (s.employee === ${JSON.stringify(name)}) s.since = new Date(Date.now() - ${min} * 60000 - 5000).toISOString(); renderAll();`);
    const dlg = () => b.run(dw, `const d = document.getElementById('scanDialog'); return { open: !d.hidden, msg: document.getElementById('scanMsg').textContent, sub: document.getElementById('scanSub').textContent,
        err: document.getElementById('scanErr').textContent, ok: document.getElementById('scanOk').hidden ? '' : document.getElementById('scanOk').textContent };`);
    const toast = () => b.run(dw, `return document.getElementById('toast').textContent;`);
    const chore = (code, day = T) => b.run(dw, `return DB.data._DailyWizard.buildings.B1.labour?.[${JSON.stringify(day)}]?.[${JSON.stringify(code)}] || [];`);
    const evHours = (id, day = T) => b.run(dw, `return DB.calendarEvents.find(e => e.id === ${JSON.stringify(id)})?.labour_map?.[${JSON.stringify(day)}] || [];`);

    // ---- The row: ＋ Start task where the timers were; a timer from before still shows ----
    const strip = await b.run(dw, `const r = ${row('Water plants')}; return { start: r.querySelector('.signin-start')?.textContent, slots: r.querySelectorAll('.timer-slot').length,
        legacy: r.querySelector('.timer-slot.legacy .timer-head')?.textContent || '', clear: !!r.querySelector('.timer-slot.legacy .timer-clear'), go: !!r.querySelector('.timer-go') };`);
    check('every row that takes hours has ＋ Start task where the four timers were', strip.start === '＋ Start task' && !strip.go && await b.run(dw, `return document.querySelectorAll('#listContainer .signin-start').length >= 4;`), JSON.stringify(strip));
    check('a timer left from before still shows, with ✕ to clear it', strip.slots === 1 && strip.legacy.includes('KN') && strip.clear, JSON.stringify(strip));

    // ---- ＋ Start task, then a scan ----
    await startOn('Water plants');
    let d = await dlg();
    check('＋ Start task asks for a badge scan', d.open && /Scan your badge/.test(d.msg), JSON.stringify(d));
    await scanBadge(b, dw, '9999' + badgeOf('Alex').slice(4));
    check('an unknown badge is "not recognized" (and points to ⏱ Log)', /not recognized/.test((await dlg()).err) && (await dlg()).open);
    await scanBadge(b, dw, badgeOf('Alex'));
    let si = await signIns();
    check('Alex\'s badge signs him in to Water plants', !(await dlg()).open && si.length === 1 && si[0].employee === 'Alex' && si[0].item === 'wat1' && si[0].badge === '1001' && Date.now() - Date.parse(si[0].since) < 20000, JSON.stringify(si));
    let c = await chips('Water plants');
    check('…and his name and running time show on the row', c.length === 1 && c[0].who === 'Alex' && !c[0].forgot && /^\d\d:\d\d$/.test(c[0].time), JSON.stringify(c));

    // ---- One task at a time: starting another signs him out of the first, to the minute ----
    await backdate('Alex', 65);
    await startOn('Scout rooms');
    await scanBadge(b, dw, badgeOf('Alex'));
    let w = await chore('wat1');
    const alexEntry = w.find(e => e.employee === 'Alex' && e.scan);
    check('signing in to Scout rooms signs Alex out of Water plants: 1h 05m logged', alexEntry && Math.abs(alexEntry.hours - 65 / 60) < 0.001 && alexEntry.initials?.badge === '1001' && !alexEntry.initials.strokes && alexEntry.scan.in && alexEntry.scan.out && alexEntry.id?.startsWith('le_'), JSON.stringify(alexEntry));
    check('…the toast says so', /1h 5m logged — now on/.test(await toast()) || /1h 05m logged/.test(await toast()), await toast());
    si = await signIns();
    check('…and he\'s on Scout rooms only', si.length === 1 && si[0].item === 'scu1');

    // ---- A scan anywhere signs out: by itself after 5 s ----
    await backdate('Alex', 30);
    await scanBadge(b, dw, badgeOf('Alex'));
    d = await dlg();
    check('scanning Alex\'s badge on the list asks to sign him out of Scout rooms, counting down', d.open && /Sign Alex out/.test(d.msg) && /Signing out in [45] s/.test(d.sub) && d.ok.includes('Sign out'), JSON.stringify(d));
    await b.sleep(5600);
    w = await chore('scu1');
    check('…and signs him out after 5 s: 30m logged', !(await dlg()).open && w.some(e => e.employee === 'Alex' && Math.abs(e.hours - 0.5) < 0.001) && !(await signIns()).length, JSON.stringify(w.map(e => [e.employee, e.hours])));

    // ---- …or at once with ⏹ Sign out; under a minute logs nothing ----
    await startOn('Water plants');
    await scanBadge(b, dw, badgeOf('Blair'));
    await scanBadge(b, dw, badgeOf('Blair'));
    await b.run(dw, `document.getElementById('scanOk').click();`, { user: true });
    check('under a minute logs nothing', /Under a minute/.test(await toast()) && !(await chore('wat1')).some(e => e.employee === 'Blair' && e.scan) && !(await signIns()).length, await toast());

    // ---- Tapping a name, then scanning their own badge ----
    await startOn('Leaf Pick');
    await scanBadge(b, dw, badgeOf('Casey'));
    await backdate('Casey', 20);
    await b.run(dw, `${row('Leaf Pick')}.querySelector('.signin-chip').click();`, { user: true });
    d = await dlg();
    check('tapping Casey\'s chip waits for her badge', d.open && /Scan Casey’s badge to sign out/.test(d.msg), JSON.stringify(d));
    await scanBadge(b, dw, badgeOf('Blair'));
    check('…someone else\'s badge doesn\'t sign her out', /Blair’s badge/.test((await dlg()).err) && (await signIns()).length === 1);
    await scanBadge(b, dw, badgeOf('Casey'));
    const leaf = await evHours('ev_cropb1');
    check('…hers does: 20m on the crop task\'s labour_map', !(await dlg()).open && leaf.some(e => e.employee === 'Casey' && Math.abs(e.hours - 20 / 60) < 0.001 && e.scan), JSON.stringify(leaf));

    // ---- Already on the task: ＋ Start task offers to sign out ----
    await startOn('Water plants');
    await scanBadge(b, dw, badgeOf('Drew'));
    await startOn('Water plants');
    await scanBadge(b, dw, badgeOf('Drew'));
    d = await dlg();
    check('scanning in again to the task he\'s on offers to sign him out (no countdown)', d.open && /Sign Drew out/.test(d.msg) && !/Signing out in/.test(d.sub), JSON.stringify(d));
    await b.run(dw, `document.getElementById('scanCancel').click();`);
    check('…Stay signed in leaves him on it', (await signIns()).filter(s => s.employee === 'Drew').length === 1);

    // ---- A badge that isn't signed in to anything ----
    await scanBadge(b, dw, badgeOf('Blair'));
    check('a scan of someone not signed in says to tap ＋ Start task', /Blair isn’t signed in/.test(await toast()) && !(await dlg()).open, await toast());

    // ---- 👥 A temp crew: how many, filled in the next time ----
    await startOn('Scout rooms');
    await scanBadge(b, dw, badgeOf('Crew A'));
    d = await dlg();
    check('a crew badge asks how many are on the crew', d.open && /How many on Crew A/.test(d.msg) && d.ok.includes('Start'), JSON.stringify(d));
    await b.run(dw, `document.getElementById('scanCrewSize').value = ''; document.getElementById('scanOk').click();`, { user: true });
    check('…it needs a number', /how many/.test((await dlg()).err));
    await b.run(dw, `document.getElementById('scanCrewSize').value = '4'; document.getElementById('scanCrewPlus').click(); document.getElementById('scanOk').click();`, { user: true });
    c = await chips('Scout rooms');
    check('…5 of them signed in (+ added one)', c.some(x => x.who === '👥 Crew A × 5') && (await signIns()).some(s => s.employee === 'Crew A' && s.crewSize === 5), JSON.stringify(c));
    await backdate('Crew A', 60);
    await scanBadge(b, dw, badgeOf('Crew A'));
    await b.run(dw, `document.getElementById('scanOk').click();`, { user: true });
    const crewEntry = (await chore('scu1')).find(e => e.employee === 'Crew A');
    check('signing the crew out logs person-hours: 1h × 5 = 5h, with its size', crewEntry && crewEntry.crewSize === 5 && Math.abs(crewEntry.hours - 5) < 0.001 && /1h each/.test(await toast()), JSON.stringify(crewEntry) + ' ' + await toast());
    await startOn('Water plants');
    await scanBadge(b, dw, badgeOf('Crew A'));
    check('the next sign-in today fills in 5', await b.run(dw, `return document.getElementById('scanCrewSize').value;`) === '5');
    await b.run(dw, `document.getElementById('scanCancel').click();`);

    // ---- 🧰 Miscellaneous labour: what it's for, asked at sign-in ----
    await startOn('Miscellaneous labour');
    await scanBadge(b, dw, badgeOf('Blair'));
    d = await dlg();
    check('🧰 Misc asks what they\'re working on', d.open && /What are you working on/.test(d.msg), JSON.stringify(d));
    await b.run(dw, `document.getElementById('scanOk').click();`, { user: true });
    check('…it\'s needed', /Say what you were doing/.test((await dlg()).err));
    await b.run(dw, `document.getElementById('scanNote').value = 'unloaded the soil'; document.getElementById('scanOk').click();`, { user: true });
    await backdate('Blair', 15);
    await scanBadge(b, dw, badgeOf('Blair'));
    await b.run(dw, `document.getElementById('scanOk').click();`, { user: true });
    const misc = (await chore('misc')).find(e => e.employee === 'Blair');
    check('…and its hours carry the note', misc && misc.note === 'unloaded the soil' && Math.abs(misc.hours - 0.25) < 0.001, JSON.stringify(misc));

    // ---- ⏰ Forgotten overnight ----
    await b.run(dw, `for (const s of Object.values(DB.data._DailyWizard.buildings.B1.signIns || {})) if (s.employee === 'Drew') s.since = ${JSON.stringify(Y + 'T15:00:00')}; renderAll();`);
    c = await chips('Water plants');
    check('a sign-in from yesterday shows as forgotten', c.some(x => x.who === 'Drew' && x.forgot && /forgot to sign out/.test(x.time)), JSON.stringify(c));
    await scanBadge(b, dw, badgeOf('Drew'));
    check('…his own badge can\'t close it: a floor manager sets the closing time', /floor manager sets the closing time/.test(await toast()) && !(await dlg()).open && (await signIns()).some(s => s.employee === 'Drew'), await toast());
    await startOn('Scout rooms');
    await scanBadge(b, dw, badgeOf('Drew'));
    si = await signIns();
    check('…he can still start a new task; the forgotten one stays for its closing time', si.filter(s => s.employee === 'Drew').length === 2 && si.some(s => s.employee === 'Drew' && s.item === 'scu1'));

    // ---- ⏱ Log by hand, signed with a badge ----
    await b.run(dw, `openHours({ kind: 'chore', buildingId: 'B1', code: 'wat1', date: ${JSON.stringify(T)} });`);
    await scanBadge(b, dw, badgeOf('Blair'));
    const hv = await b.run(dw, `return { who: document.getElementById('hoursWho').value, note: !document.getElementById('hoursBadgeNote').hidden && document.getElementById('hoursBadgeText').textContent, pad: document.getElementById('hoursPadGroup').hidden };`);
    check('in ⏱ Log a badge fills in Who and signs in place of the initials pad', hv.who === 'Blair' && /Badge #1002 scanned/.test(hv.note || '') && hv.pad, JSON.stringify(hv));
    await b.run(dw, `document.getElementById('hoursH').value = '0'; document.getElementById('hoursM').value = '45'; addHours();`, { user: true });
    const typed = (await chore('wat1')).find(e => e.employee === 'Blair' && !e.scan);
    check('…the entry is signed with the badge', typed && typed.initials?.badge === '1002' && !typed.initials.strokes && Math.abs(typed.hours - 0.75) < 0.001, JSON.stringify(typed));
    await scanBadge(b, dw, badgeOf('Crew A'));
    check('…a crew badge asks the crew size, filled in with today\'s', await b.run(dw, `return !document.getElementById('hoursCrewGroup').hidden && document.getElementById('hoursCrew').value === '5';`));
    await b.run(dw, `document.getElementById('hoursH').value = '2'; document.getElementById('hoursM').value = '0'; addHours();`, { user: true });
    const typedCrew = (await chore('wat1')).find(e => e.employee === 'Crew A' && !e.scan);
    check('…and its 2h each count 10 person-hours', typedCrew?.crewSize === 5 && Math.abs(typedCrew.hours - 10) < 0.001, JSON.stringify(typedCrew));
    const listed = await b.run(dw, `return document.getElementById('hoursList').textContent;`);
    check('…the hours view shows the crew, each person\'s time, and the badge', listed.includes('👥 Crew A × 5') && listed.includes('2h each') && listed.includes('🪪'), listed.slice(0, 300));

    // ---- Removing hours, approved by a floor manager's badge ----
    const nBefore = (await chore('wat1')).length;
    await b.run(dw, `[...document.querySelectorAll('#hoursList .hours-entry')].find(r => r.textContent.includes('Crew A'))?.querySelector('.hours-del')?.click();`, { user: true });
    await b.waitFor(dw, `return !document.getElementById('floorPin').hidden;`, 3000).catch(() => {});
    await scanBadge(b, dw, badgeOf('Blair'));
    check('a badge that isn\'t a floor manager\'s can\'t approve a removal', (await chore('wat1')).length === nBefore && !(await b.run(dw, `return document.getElementById('floorPin').hidden;`)));
    await scanBadge(b, dw, badgeOf('Casey'));
    await b.sleep(300);
    const adj = await b.run(dw, `return (DB.data._DailyWizard.buildings.B1.adjustments || []).slice(-1)[0];`);
    check('Casey\'s badge approves it: kept on record as approved with her badge', (await chore('wat1')).length === nBefore - 1 && adj?.approvedBy === 'Casey' && adj.approvedWith === 'badge', JSON.stringify(adj));
    await b.run(dw, `closeHours();`);

    // ---- ✅ Mark done by badge, signing out whoever is still on it ----
    await startOn('Leaf Pick');
    await scanBadge(b, dw, badgeOf('Alex'));
    await backdate('Alex', 10);
    await b.run(dw, `window.__asked = ''; window.confirm = m => { window.__asked = m; return true; }; openDone('ev_cropb1', 'B1');`);
    await scanBadge(b, dw, badgeOf('Drew'));
    check('only a floor manager\'s badge signs a task off', !(await b.run(dw, `return DB.calendarEvents.find(e => e.id === 'ev_cropb1').completed === true;`)) && /Drew isn’t one/.test(await toast()), await toast());
    await scanBadge(b, dw, badgeOf('Casey'));
    const done = await b.run(dw, `const ev = DB.calendarEvents.find(e => e.id === 'ev_cropb1'); return { completed: ev.completed, by: ev.completedBy, asked: window.__asked, hours: ev.labour_map?.[${JSON.stringify(T)}] || [] };`);
    check('Casey\'s badge marks Leaf Pick done, signed with her badge', done.completed === true && done.by?.name === 'Casey' && done.by.initials?.badge === '1003' && !done.by.initials.strokes, JSON.stringify(done.by));
    check('…after asking to sign Alex out of it, whose 10m are logged', /Alex is still signed in/.test(done.asked) && done.hours.some(e => e.employee === 'Alex' && Math.abs(e.hours - 10 / 60) < 0.001) && !(await signIns()).some(s => s.employee === 'Alex'), done.asked);

    // ---- ✏️ Edit tasks by badge ----
    await b.run(dw, `document.getElementById('editTasksBtn').click();`, { user: true });
    await b.waitFor(dw, `return !document.getElementById('floorPin').hidden;`, 3000).catch(() => {});
    await scanBadge(b, dw, badgeOf('Casey'));
    check('a floor manager\'s badge unlocks ✏️ edit mode', await b.run(dw, `return EditMode.on();`));

    // ---- A scan never changes a focused list ----
    await b.run(dw, `document.getElementById('buildingSelect').focus();`);
    await scanBadge(b, dw, badgeOf('Blair'));
    check('a scan with the building list focused leaves it alone', await b.run(dw, `return document.getElementById('buildingSelect').value;`) === 'B1');

    // ---- Saved with the building's list ----
    await b.run(main, `Tools.close();`);
    const saved = JSON.parse(await saveSingle(b, main));
    const kept = Object.values(saved._DailyWizard.buildings.B1.signIns || {});
    check('sign-ins are saved with the building\'s list (start time, badge, crew size)', kept.length === 2 && kept.every(s => s.employee === 'Drew' && s.badge === '1004' && s.since), JSON.stringify(kept));

    // ---- Split files: a building's sign-ins save in its own file only ----
    const office = await fresh(b);
    const files = await splitFiles(b, office, BASE, withBadge(withFloorManager(fixtureDb()), 'Alex'));
    await openSplit(b, office, BASE, 'B1', files);
    const tab = await openTool(b, office, 'DailyWizard');
    await b.run(tab, `${row('Water plants')}.querySelector('.signin-start').click();`, { user: true });
    await scanBadge(b, tab, badgeOf('Alex'));
    check('on Building 1\'s device Alex signs in', await b.run(tab, `return Object.values(DB.data._DailyWizard.buildings.B1.signIns || {}).some(s => s.employee === 'Alex');`));
    await b.run(office, `Tools.close();`);
    const out = await saveSplit(b, office);
    check('…saved in Building-B1.json, Main.json untouched', Object.keys(out).join() === 'Building-B1.json' && Object.values(JSON.parse(out['Building-B1.json'])._DailyWizard.buildings.B1.signIns || {}).length === 1, Object.keys(out).join());
    await openSplit(b, office, BASE, 'office', { ...files, ...out });
    const offTab = await openTool(b, office, 'DailyWizard');
    await dwBuilding(b, offTab, 'B1');
    check('the office (split files) shows no ＋ Start task: Building 1\'s list is its own', await b.run(offTab, `return document.querySelectorAll('#listContainer .signin-start').length === 0;`));
    await b.run(office, `Tools.close();`);
    return results;
}
