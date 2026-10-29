// ⏰ Closing times for forgotten sign-ins (Labour & Cost Wizard → 📜 Labour Log → ⏰ Still signed in): a floor manager
// sets when the person stopped, signed off with their badge or their PIN and initials. With one file, or on the
// sign-in's own building device, it's filed as hours at once. From the office it's kept in Main.json and shown (never
// saved as hours) until that building's device opens the files and files it; then the office lets the closing go. A
// worker who signed out on the tablet first keeps their own time.
import { today, fixtureDb, withFloorManager, withBadge, badgeOf, scanBadge, answerSignoff, makeChecker, fresh, openSitka, loadSingle,
    splitFiles, openSplit, saveSplit, openTool } from './lib/helpers.mjs';

export const title = 'Closing times for forgotten sign-ins';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const Y = today(-1);
    const makeDb = () => {
        const db = withBadge(withFloorManager(fixtureDb()), 'Casey');
        db._DailyWizard.buildings.B1.signIns = {
            si_alexforgot: { item: 'wat1', title: '💧 Water plants', employee: 'Alex', since: `${Y}T08:00:00`, by: 'B1', badge: '1001' },
            si_blairforgot: { item: 'ev:ev_cropb1', title: '🍂 Leaf Pick', employee: 'Blair', since: `${Y}T08:30:00`, by: 'B1', badge: '1002' },
            si_drewforgot: { item: 'scu1', title: '🔎 Scout rooms', employee: 'Drew', since: `${Y}T09:00:00`, by: 'B1', badge: '1004' }
        };
        return db;
    };
    const openLog = async (ew) => { await b.run(ew, `document.getElementById('tabLog').click();`, { user: true }); await b.sleep(150); };
    const card = ew => b.run(ew, `return [...document.querySelectorAll('#logOpen tbody tr')].map(tr => tr.textContent.replace(/\\s+/g, ' ').trim());`);
    // Set a closing time in the card: the row for `who`, then the day and time
    const setClosing = async (ew, who, time, day = Y) => {
        await b.run(ew, `[...document.querySelectorAll('#logOpen tbody tr')].find(tr => tr.textContent.includes(${JSON.stringify(who)}))?.querySelector('[data-closing]')?.click();`, { user: true });
        await b.run(ew, `const d = document.getElementById('closingDialog'); d.querySelector('.cl-day').value = ${JSON.stringify(day)}; d.querySelector('.cl-time').value = ${JSON.stringify(time)};
            d.querySelector('.cl-time').dispatchEvent(new Event('input', { bubbles: true }));`);
        return b.run(ew, `return document.querySelector('#closingDialog .closing-hours').textContent;`);
    };
    const save = ew => b.run(ew, `document.querySelector('#closingDialog [data-act="ok"]').click();`, { user: true });

    // ---- One file: filed at once ----
    let main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, makeDb());
    let ew = await openTool(b, main, 'EmployeeWizard');
    await openLog(ew);
    let rows = await card(ew);
    check('⏰ Still signed in lists the three sign-ins left open overnight', rows.length === 3 && rows.every(r => r.includes('forgot to sign out')), JSON.stringify(rows));
    let said = await setClosing(ew, 'Alex', '07:30');
    check('a closing time before they signed in is refused', /before they signed in/.test(said), said);
    said = await setClosing(ew, 'Alex', '10:30');
    check('…10:30 makes 2h 30m', said === '→ 2h 30m', said);
    await save(ew);
    await b.waitFor(ew, `return !document.getElementById('floorPin').hidden;`, 3000).catch(() => {});
    await scanBadge(b, ew, badgeOf('Casey'));
    await b.sleep(300);
    const expectId = await b.run(main, `return SignIns.entryId('si_alexforgot');`);
    let st = await b.run(ew, `return { s: DB.data._DailyWizard.buildings.B1.signIns.si_alexforgot || null, closings: DB.data._EmployeeWizard.closings || null,
        e: (DB.data._DailyWizard.buildings.B1.labour?.[${JSON.stringify(Y)}]?.wat1 || []).find(x => x.employee === 'Alex' && x.scan) || null };`);
    check('Casey\'s badge signs it off, and with one file it\'s filed at once: the sign-in goes, 2h 30m on Water plants',
        !st.s && !st.closings && st.e && Math.abs(st.e.hours - 2.5) < 0.001 && st.e.id === expectId && st.e.closedBy?.name === 'Casey' && st.e.closedBy.badge === '1003' && !st.e._pending, JSON.stringify(st));
    let log = await b.run(ew, `return document.getElementById('logBody').textContent;`);
    check('the Labour Log says the closing time was set by the floor manager', /forgot to sign out — closing time set by Casey/.test(log) && log.includes('🪪'));
    rows = await card(ew);
    check('…and the card has the other two left', rows.length === 2 && !rows.some(r => r.includes('Alex')));
    await b.run(main, `Tools.close();`);

    // ---- Split files: the office sets two closing times ----
    const office = await fresh(b);
    const files = await splitFiles(b, office, BASE, makeDb());
    await openSplit(b, office, BASE, 'office', files);
    ew = await openTool(b, office, 'EmployeeWizard');
    await openLog(ew);
    await setClosing(ew, 'Blair', '11:00');
    await save(ew);
    await answerSignoff(b, ew);   // Casey's PIN and drawn initials
    await setClosing(ew, 'Drew', '10:00');
    await save(ew);
    await b.waitFor(ew, `return !document.getElementById('floorPin').hidden;`, 3000).catch(() => {});
    await scanBadge(b, ew, badgeOf('Casey'));
    await b.sleep(300);
    st = await b.run(ew, `return { closings: Object.keys(DB.data._EmployeeWizard.closings || {}).sort(), signIns: Object.keys(DB.data._DailyWizard.buildings.B1.signIns || {}).sort(),
        ev: (DB.data.calendarEvents.find(e => e.id === 'ev_cropb1').labour_map?.[${JSON.stringify(Y)}] || []).filter(e => e.employee === 'Blair') };`);
    check('on the office both closings are kept, the sign-ins stay in Building 1\'s list', st.closings.join() === 'si_blairforgot,si_drewforgot' && st.signIns.length === 3, JSON.stringify(st));
    check('…and Blair\'s 2h 30m show on Leaf Pick as waiting to be filed', st.ev.length === 1 && st.ev[0]._pending === true && Math.abs(st.ev[0].hours - 2.5) < 0.001, JSON.stringify(st.ev));
    log = await b.run(ew, `return document.getElementById('logBody').textContent + ' | ' + document.getElementById('logOpen').textContent;`);
    check('the log flags them ⏳ (Building 1\'s device files them) and the card says the closing time is set', /Building 1's device files these hours/.test(log) && /closing time .* set by Casey/.test(log), log.slice(0, 200));
    await b.run(office, `Tools.close();`);
    const s1 = await saveSplit(b, office);
    const m1 = JSON.parse(s1['Main.json'] || '{}');
    check('the office saves only Main.json: the closings, with no hours of its own for them', Object.keys(s1).join() === 'Main.json' && Object.keys(m1._EmployeeWizard?.closings || {}).length === 2 &&
        !s1['Main.json'].includes('_pending') && !(m1.calendarEvents.find(e => e.id === 'ev_cropb1').labour_map?.[Y] || []).length, Object.keys(s1).join());
    check('…Blair\'s closing keeps who signed it off: Casey, drawn initials', m1._EmployeeWizard.closings.si_blairforgot?.setBy?.name === 'Casey' && m1._EmployeeWizard.closings.si_blairforgot.setBy.strokes?.length > 0);

    // Meanwhile Drew signed out on Building 1's tablet himself (his file no longer holds the sign-in; it logged his own time)
    const b1 = JSON.parse(files['Building-B1.json']);
    const bl = b1._DailyWizard.buildings.B1;
    delete bl.signIns.si_drewforgot;
    ((bl.labour[Y] || (bl.labour[Y] = {})).scu1 || (bl.labour[Y].scu1 = [])).push({ id: 'le_drewowntime', employee: 'Drew', hours: 0.75, initials: { name: 'Drew', badge: '1004' },
        scan: { in: `${Y}T09:00:00`, out: `${Y}T09:45:00` }, at: `${Y}T09:45:00`, by: 'B1' });
    const files2 = { ...files, 'Main.json': s1['Main.json'], 'Building-B1.json': JSON.stringify(b1) };

    // ---- Building 1's device opens the files: it files Blair's ----
    const tablet = await fresh(b);
    await openSplit(b, tablet, BASE, 'B1', files2);
    await b.sleep(300);
    st = await b.run(tablet, `return { unsaved: hasUnsavedChanges, signIns: Object.keys(DB.data._DailyWizard.buildings.B1.signIns || {}).sort(),
        ev: (DB.data.calendarEvents.find(e => e.id === 'ev_cropb1').labour_map?.[${JSON.stringify(Y)}] || []).filter(e => e.employee === 'Blair'),
        drew: (DB.data._DailyWizard.buildings.B1.labour?.[${JSON.stringify(Y)}]?.scu1 || []).filter(e => e.employee === 'Drew').map(e => e.id), cannot: DbSplit.plan().cannot };`);
    check('Building 1\'s device files Blair\'s hours from the office\'s closing time (unsaved until saved)', st.unsaved && st.signIns.join() === 'si_alexforgot' &&
        st.ev.length === 1 && !st.ev[0]._pending && st.ev[0].id === await b.run(tablet, `return SignIns.entryId('si_blairforgot');`), JSON.stringify(st));
    check('…Drew signed out himself first: his own 45m stand, nothing added', JSON.stringify(st.drew) === '["le_drewowntime"]', JSON.stringify(st.drew));
    check('…and it has nothing it can\'t save (the office\'s closings stay in Main)', !st.cannot.length, JSON.stringify(st.cannot));
    const s2 = await saveSplit(b, tablet);
    const b2 = JSON.parse(s2['Building-B1.json'] || '{}');
    check('it saves Building-B1.json: the sign-in gone, Blair\'s hours as its update to Leaf Pick', Object.keys(s2).join() === 'Building-B1.json' && !b2._DailyWizard.buildings.B1.signIns?.si_blairforgot &&
        Object.keys(b2._overlays?.events?.ev_cropb1?.labour_map?.entries || {}).includes(st.ev[0].id), Object.keys(s2).join());

    // ---- The office opens the files again: the hours are Building 1's, and the closings go ----
    await openSplit(b, tablet, BASE, 'office', { ...files2, ...s2 });   // the same window, as the office now
    st = await b.run(tablet, `return { closings: DB.data._EmployeeWizard.closings || null, pending: SignIns.hasPending(DB.data),
        ev: (DB.data.calendarEvents.find(e => e.id === 'ev_cropb1').labour_map?.[${JSON.stringify(Y)}] || []).filter(e => e.employee === 'Blair').length };`);
    check('the office now has Blair\'s hours from Building 1, nothing waiting, and lets both closings go', !st.closings && !st.pending && st.ev === 1, JSON.stringify(st));
    const s3 = await saveSplit(b, tablet);
    check('…its next save drops them from Main.json', !JSON.parse(s3['Main.json'] || '{}')._EmployeeWizard?.closings, Object.keys(s3).join());

    // ---- A building's own device sets a closing time: filed at once, in its own file ----
    const own = await fresh(b);
    await openSplit(b, own, BASE, 'B1', files);
    ew = await openTool(b, own, 'EmployeeWizard');
    await openLog(ew);
    rows = await card(ew);
    check('on Building 1\'s device the card lists its own sign-ins', rows.length === 3, JSON.stringify(rows));
    said = await setClosing(ew, 'Alex', '00:30', today());   // 16½ hours after 8:00 yesterday
    check('more than 16 hours after signing in is refused', /more than 16 hours|later than now/.test(said), said);
    await setClosing(ew, 'Alex', '09:15');
    await save(ew);
    await b.waitFor(ew, `return !document.getElementById('floorPin').hidden;`, 3000).catch(() => {});
    await scanBadge(b, ew, badgeOf('Casey'));
    await b.sleep(300);
    st = await b.run(ew, `return { s: !!DB.data._DailyWizard.buildings.B1.signIns?.si_alexforgot, closings: DB.data._EmployeeWizard.closings || null,
        e: (DB.data._DailyWizard.buildings.B1.labour?.[${JSON.stringify(Y)}]?.wat1 || []).find(x => x.employee === 'Alex' && x.closedBy) || null };`);
    check('…filed at once: 1h 15m on Water plants, no closing left to keep', !st.s && !st.closings && st.e && Math.abs(st.e.hours - 1.25) < 0.001, JSON.stringify(st));
    await b.run(own, `Tools.close();`);
    const s4 = await saveSplit(b, own);
    check('…saved in Building-B1.json only, with nothing it can\'t save', Object.keys(s4).join() === 'Building-B1.json' && !(await b.run(own, `return DbSplit.plan().cannot.length;`)), Object.keys(s4).join());
    return results;
}
