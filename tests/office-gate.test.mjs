// 🔒 The office gate (user decision 2026-10-28): opening the split files as the office needs the badge or PIN of someone
// with 🏢 office access (ticked in the Labour & Cost Wizard's employee editor), once the roster has one. A floor manager's
// badge or PIN doesn't open the office. Every way in asks: the page link, 🏷️ Set this device… (a restored session too,
// which has no files to reopen), and an office session coming back. A building device and a single-file DB open as before.
import { fixtureDb, makeChecker, fresh, splitFiles, openSplit, openSitka, loadSingle, openTool, leave, answerPin, scanBadge,
    withFloorManager, withOfficeAccess, withBadge, withCrew, badgeOf, FM_PIN, OFFICE_PIN } from './lib/helpers.mjs';

export const title = 'the office opens only with the badge or PIN of someone with office access';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    let main = await fresh(b);

    const dialog = (ctx) => b.run(ctx, `const el = document.getElementById('floorPin');
        if (!el || el.hidden) return { open: false };
        return { open: true, title: el.querySelector('.fpin-title').textContent, why: el.querySelector('[data-fpin-why]').textContent,
            names: [...el.querySelector('[data-fpin-who]').options].map(o => o.value).filter(Boolean),
            scan: !el.querySelector('[data-fpin-scan]').hidden, err: el.querySelector('[data-fpin-err]').textContent };`);
    const waitDialog = (ctx) => b.waitFor(ctx, `const el = document.getElementById('floorPin'); return !!el && !el.hidden;`, 4000).then(() => dialog(ctx)).catch(() => dialog(ctx));
    const cancel = (ctx) => b.run(ctx, `document.querySelector('#floorPin [data-fpin-cancel]').click();`).then(() => b.sleep(200));
    const opened = (ctx) => b.waitFor(ctx, `return window.__opened !== undefined;`, 4000).then(() => b.run(ctx, `return window.__opened;`)).catch(() => undefined);
    const state = (ctx) => b.run(ctx, `return { active: DbSplit.active, role: DbSplit.role, wages: DbSplit.haveWages, file: DB.fileName || '', search: location.search };`);

    // ---- No one has office access yet: the office opens as before (a floor manager's PIN is no key) ----
    let db = withBadge(withFloorManager(fixtureDb()), 'Casey');
    let files = await splitFiles(b, main, BASE, db);
    await openSplit(b, main, BASE, 'office', files, { gate: null });
    let r = await opened(main);
    let d = await dialog(main);
    check('no one with office access: the office opens without asking', r === true && !d.open && (await state(main)).role === 'office', JSON.stringify({ r, d }));

    // ---- Drew has office access (a PIN and a badge); Casey is a floor manager only ----
    db = withBadge(withOfficeAccess(withBadge(withFloorManager(fixtureDb()), 'Casey')), 'Drew');
    main = await fresh(b);
    files = await splitFiles(b, main, BASE, db);

    await openSplit(b, main, BASE, 'B1', files, { gate: null });
    r = await opened(main);
    check('a building device opens without asking', r === true && !(await dialog(main)).open && (await state(main)).role === 'B1', JSON.stringify(await state(main)));

    await openSplit(b, main, BASE, 'office', files, { gate: null });
    d = await waitDialog(main);
    check('the office asks: 🔒 Office access, why, and a badge or PIN', d.open && d.title === '🔒 Office access' && d.scan &&
        d.why === 'Opening the files as the office needs office access: scan your badge, or pick your name and type your PIN.', JSON.stringify(d));
    check('…listing only the people with office access (Drew), not the floor manager', d.names.join() === 'Drew', d.names.join());
    check('…and nothing is open while it asks', !(await state(main)).active);
    await scanBadge(b, main, badgeOf('Casey'));
    d = await dialog(main);
    check('the floor manager\'s badge doesn\'t open the office', d.open && d.err === 'Only office staff can open the office — Casey doesn’t have office access' &&
        !(await state(main)).active, JSON.stringify(d));
    await answerPin(b, main, 'Drew', '0000');
    d = await dialog(main);
    check('a wrong PIN doesn\'t either', d.open && d.err === 'Wrong PIN — try again' && !(await state(main)).active, JSON.stringify(d));
    // (while the gate asks, its kit reads the Main.json being opened)
    const kit = await b.run(main, `const P = OfficeGate.kit().FloorPin;
        return { casey: await P.check('Casey', ${JSON.stringify(FM_PIN)}), drew: await P.check('Drew', ${JSON.stringify(OFFICE_PIN)}) };`);
    await cancel(main);
    r = await opened(main);
    let st = await state(main);
    check('Cancel: nothing opened, and the next open asks for the device again', r === false && !st.active && st.role === null, JSON.stringify({ r, st }));

    await openSplit(b, main, BASE, 'office', files, { gate: null });
    await waitDialog(main);
    await answerPin(b, main, 'Drew', OFFICE_PIN);
    r = await opened(main);
    st = await state(main);
    check('Drew\'s PIN opens the office, wages and all', r === true && !(await dialog(main)).open && st.active && st.role === 'office' && st.wages, JSON.stringify({ r, st }));

    await openSplit(b, main, BASE, 'office', files, { gate: null });
    await waitDialog(main);
    await scanBadge(b, main, badgeOf('Drew'));
    r = await opened(main);
    check('…and so does Drew\'s badge', r === true && !(await dialog(main)).open && (await state(main)).role === 'office');

    // The page's own key listener is up only while the gate asks
    check('the page listens for a badge only while the gate is up', await b.run(main, `return OfficeGate.kit().BadgeScan._on === null;`));

    // ---- 🏷️ Set this device… → Office from a building ----
    const switchTo = (ctx, role) => b.run(ctx, `
        window.__alerts = []; window.alert = m => window.__alerts.push(m); window.confirm = () => true;
        askDeviceRole = async () => ${JSON.stringify(role)};
        document.getElementById('changeRoleBtn').click();
        await new Promise(r => setTimeout(r, 400));`, { user: true });
    const afterSwitch = (ctx) => b.run(ctx, `document.getElementById('deviceLinkOverlay')?.remove();
        return { role: DbSplit.role, search: location.search, alerts: window.__alerts };`);

    await openSplit(b, main, BASE, 'B1', files);
    await switchTo(main, 'office');
    d = await waitDialog(main);
    check('Building 1 → Set this device… → Office asks for office access', d.open && d.names.join() === 'Drew', JSON.stringify(d));
    await cancel(main);
    await b.sleep(300);
    r = await afterSwitch(main);
    check('…Cancel: still Building 1, and so is the page\'s address', r.role === 'B1' && /device=B1/.test(r.search), JSON.stringify(r));
    await switchTo(main, 'office');
    await waitDialog(main);
    await answerPin(b, main, 'Drew', OFFICE_PIN);
    await b.sleep(400);
    r = await afterSwitch(main);
    check('…Drew\'s PIN: the files reopen as the office', r.role === 'office' && /device=office/.test(r.search) && (await state(main)).active, JSON.stringify(r));

    // ---- A restored building session (a tablet reloaded) has no files to reopen: it still asks ----
    await openSplit(b, main, BASE, 'B1', files);
    await b.run(main, `const s = DbSplit.exportState(); DbSplit.importState(s);`);
    await switchTo(main, 'office');
    d = await waitDialog(main);
    check('a restored Building 1 session → Office asks too', d.open && d.title === '🔒 Office access', JSON.stringify(d));
    await cancel(main);
    await b.sleep(300);
    r = await afterSwitch(main);
    check('…Cancel: still Building 1, the address unchanged, nothing said', r.role === 'B1' && /device=B1/.test(r.search) && r.alerts.length === 0, JSON.stringify(r));
    await switchTo(main, 'office');
    await waitDialog(main);
    await answerPin(b, main, 'Drew', OFFICE_PIN);
    await b.sleep(300);
    r = await afterSwitch(main);
    check('…Drew\'s PIN: the office, with the note to open the files again', r.role === 'office' && /device=office/.test(r.search) &&
        /This session was restored/.test(r.alerts[0] || ''), JSON.stringify(r));

    // ---- An office session closed without saving: Restore asks ----
    await openSplit(b, main, BASE, 'office', files);
    await b.run(main, `DB.data.lots.L100.name = 'Changed at the office'; markUnsaved();`);
    await b.waitFor(main, `const c = await WorkCopy.read(); return c?.unsaved && c.db.lots.L100.name === 'Changed at the office';`);
    await b.navigate(main, `${BASE}/SitkaTools/SitkaTools.html?device=office`);
    const restored = () => b.run(main, `return !!DB.fileName || !!DB.data?.lots?.L100;`);   // the start page holds an empty DB
    const cardUp = () => b.waitFor(main, `return !document.getElementById('restoreOverlay').classList.contains('hidden');`, 5000).then(() => true).catch(() => false);
    check('the next start offers the office session back', await cardUp());
    await b.run(main, `document.getElementById('restoreBtn').click();`, { user: true });
    d = await waitDialog(main);
    check('Restore asks for office access first', d.open && d.why === 'Bringing back the office session needs office access: scan your badge, or pick your name and type your PIN.' &&
        d.names.join() === 'Drew' && !(await restored()), JSON.stringify(d));
    await cancel(main);
    check('…Cancel: back to the card, nothing restored', await cardUp() && !(await restored()));
    await b.run(main, `document.getElementById('restoreBtn').click();`, { user: true });
    await waitDialog(main);
    await answerPin(b, main, 'Drew', OFFICE_PIN);
    await b.sleep(500);
    st = await b.run(main, `return { name: DB.data?.lots?.L100?.name, role: DbSplit.role, unsaved: hasUnsavedChanges };`);
    check('…Drew\'s PIN: the office session is back, unsaved', st.name === 'Changed at the office' && st.role === 'office' && st.unsaved, JSON.stringify(st));
    await leave(b, main);

    check('the office gate takes only an office person\'s PIN (Casey\'s floor manager PIN doesn\'t check out)', kit.casey === false && kit.drew === true, JSON.stringify(kit));

    // ---- The Labour & Cost Wizard: the 🏢 Office access tick ----
    main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, withCrew(withFloorManager(fixtureDb())));
    check('a single-file DB opens as before', await b.run(main, `return !!DB.data && !document.getElementById('floorPin')?.offsetParent;`));
    const ew = await openTool(b, main, 'EmployeeWizard');
    const editor = () => b.run(ew, `return { tick: !document.getElementById('empOfficeAccess').closest('label').hidden, pins: !document.getElementById('empPinRow').hidden,
        status: document.getElementById('empPinStatus').textContent, badge: document.getElementById('empBadgeStatus').textContent };`);
    await b.run(ew, `selectEmployee('Blair'); const o = document.getElementById('empOfficeAccess'); o.checked = true; o.dispatchEvent(new Event('change'));`);
    let e = await editor();
    check('ticking Office access shows the PIN fields (Blair isn\'t a floor manager)', e.tick && e.pins && e.status.startsWith('No PIN yet: they can open the office only with their badge'), JSON.stringify(e));
    check('…warns when they\'d be the only one who can open the office', e.status.includes('No one else has office access: tick a second person'), e.status);
    check('…and the badge line says their badge opens the office', e.badge.includes('and open the office'), e.badge);
    const save = (pin) => b.run(ew, `document.getElementById('empPinInput').value = ${JSON.stringify(pin)}; document.getElementById('empPin2Input').value = ${JSON.stringify(pin)};
        document.getElementById('saveEmpBtn').click(); await new Promise(r => setTimeout(r, 300));
        const emp = DB.data._EmployeeWizard.employees.Blair;
        return { toast: document.querySelector('.toast, #toast')?.textContent || '', office: emp.officeAccess === true, pin: !!emp.pin?.hash,
            tag: [...document.querySelectorAll('.emp-row')].find(r => r.querySelector('.emp-name').textContent === 'Blair')?.textContent.includes('🏢 office') };`);
    let s = await save('9753');
    check('saved: office access and a PIN (a hash only), tagged 🏢 office in the list', s.office && s.pin && s.tag && /^Saved Blair — PIN set · 🏢 office access: once Main\.json is saved/.test(s.toast), JSON.stringify(s));
    const kinds = await b.run(main, `const db = DB.data, floor = makeFloorPinKit(document, () => db).FloorPin, office = makeFloorPinKit(document, () => db, null, 'office').FloorPin;
        return { floor: floor.pinManagers().join(), office: office.pinManagers().join(), floorBlair: await floor.check('Blair', '9753'), officeBlair: await office.check('Blair', '9753'),
            floorCasey: await floor.check('Casey', ${JSON.stringify(FM_PIN)}), officeCasey: await office.check('Casey', ${JSON.stringify(FM_PIN)}) };`);
    check('an office PIN signs nothing off as floor manager, and a floor manager\'s PIN opens no office', kinds.floor === 'Casey' && kinds.office === 'Blair' &&
        !kinds.floorBlair && kinds.officeBlair && kinds.floorCasey && !kinds.officeCasey, JSON.stringify(kinds));
    await b.run(ew, `const o = document.getElementById('empOfficeAccess'); o.checked = false; o.dispatchEvent(new Event('change'));`);
    s = await save('');
    check('unticked: office access and the PIN are gone (not a floor manager)', !s.office && !s.pin && !s.tag && /🏢 office access removed/.test(s.toast), JSON.stringify(s));
    await b.run(ew, `selectEmployee('Crew A');`);
    e = await editor();
    check('a temp crew has no Office access tick', !e.tick && !e.pins, JSON.stringify(e));
    await leave(b, main);
    return results;
}
