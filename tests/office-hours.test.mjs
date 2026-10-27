// Hours typed in the Labour & Cost Wizard's Tasks tab (not on the floor in DailyWizard, the usual way) need a floor
// manager's sign-off: their name, PIN and drawn initials, for adds and changes alike. The entry keeps who and when,
// and the Labour Log and DailyWizard's hours view show it.
import { today, fixtureDb, withFloorManager, makeChecker, fresh, openSitka, loadSingle, openTool, dwBuilding, answerSignoff, leave, FM_PIN } from './lib/helpers.mjs';

export const title = 'Tasks tab hours: a floor manager signs them off (name, PIN, initials)';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, withFloorManager(fixtureDb()));
    const ew = await openTool(b, main, 'EmployeeWizard');
    const dlg = () => b.run(ew, `const el = document.getElementById('floorPin'); return el && !el.hidden ? { title: el.querySelector('.fpin-title').textContent, why: el.querySelector('[data-fpin-why]').textContent,
        pad: !el.querySelector('[data-fpin-sign]').hidden, err: el.querySelector('[data-fpin-err]').textContent } : null;`);
    const entry = (name) => b.run(ew, `return (DB.data.calendarEvents.find(e => e.id === 'ev_cropb1').labour_map?.['${T}'] || []).find(en => en.employee === ${JSON.stringify(name)} || en.temp === ${JSON.stringify(name)}) || null;`);
    const fill = (name, h, m) => b.run(ew, `
        document.getElementById('tabTasks').click();
        const lot = document.getElementById('activeLot'); lot.value = 'L100'; lot.dispatchEvent(new Event('change'));
        TASK.selectedKey = 'ev_cropb1'; TASK.editDate = '${T}'; renderTasksTab();
        document.getElementById('lfEmpSelect').value = ${JSON.stringify(name)};
        document.getElementById('lfHours').value = '${h}'; document.getElementById('lfMinutes').value = '${m}';
        document.getElementById('lfAddBtn').click();`, { user: true });
    const toast = () => b.run(ew, `return document.getElementById('toast')?.textContent || '';`);

    // ---- Adding hours asks first; Cancel adds nothing ----
    await fill('Alex', 1, 30);
    let d = await dlg();
    check('adding hours opens the floor manager sign-off, with the initials pad', d?.title === '✍️ Floor manager sign-off' && d.pad && d.why.startsWith('Add 1h 30m for Alex on ') && d.why.includes('Leaf Pick'), JSON.stringify(d));
    await b.run(ew, `document.querySelector('#floorPin [data-fpin-cancel]').click();`);
    check('Cancel adds nothing', !(await entry('Alex')) && !(await dlg()));

    // ---- Initials and the right PIN are both needed ----
    await fill('Alex', 1, 30);
    await b.run(ew, `const el = document.getElementById('floorPin'); el.querySelector('[data-fpin-who]').value = 'Casey'; el.querySelector('[data-fpin-pin]').value = '${FM_PIN}'; el.querySelector('[data-fpin-ok]').click();`);
    await b.sleep(150);
    d = await dlg();
    check('with no initials drawn it says so and adds nothing', d?.err === 'Draw your initials' && !(await entry('Alex')), JSON.stringify(d));
    await b.drag(ew, '#floorPin .fpin-pad', [[0.2, 0.7], [0.3, 0.3], [0.4, 0.7]]);
    await b.run(ew, `const el = document.getElementById('floorPin'); el.querySelector('[data-fpin-pin]').value = '0000'; el.querySelector('[data-fpin-ok]').click();`);
    await b.sleep(250);
    d = await dlg();
    check('a wrong PIN adds nothing', d?.err === 'Wrong PIN — try again' && !(await entry('Alex')), JSON.stringify(d));
    await b.run(ew, `const el = document.getElementById('floorPin'); el.querySelector('[data-fpin-pin]').value = '${FM_PIN}'; el.querySelector('[data-fpin-ok]').click();`);
    await b.sleep(300);
    let en = await entry('Alex');
    check('name, PIN and initials: the hours are added, signed by the floor manager, with when and where',
        en?.hours === 1.5 && en.enteredBy?.name === 'Casey' && en.enteredBy.strokes?.length === 1 && en.enteredBy.strokes[0].length >= 4 && en.by === 'office' && !!en.at && !en.initials, JSON.stringify(en));
    check('…and the toast says who signed', (await toast()) === 'Added Alex — 1h 30m · signed by Casey', await toast());
    const main1 = await b.run(main, `return (DB.data.calendarEvents.find(e => e.id === 'ev_cropb1').labour_map?.['${T}'] || []).find(x => x.employee === 'Alex')?.enteredBy?.name;`);
    check('SitkaTools has the sign-off to save', main1 === 'Casey', main1);
    const tag = await b.run(ew, `return document.getElementById('teEntryList').innerText;`);
    check('the Tasks tab tags the entry with the floor manager who signed it', tag.includes('✍️ Casey'), tag);

    // ---- The same hours again change nothing and don't ask ----
    await fill('Alex', 1, 30);
    check('the same hours again: no dialog, nothing changes', !(await dlg()) && (await toast()) === 'Alex already has 1h 30m on this day');

    // ---- Changing the hours asks too, and keeps what was signed ----
    await fill('Alex', 2, 0);
    d = await dlg();
    check('changing hours asks again, saying from what to what', d?.pad && d.why.startsWith('Change Alex\'s hours: 1h 30m → 2h'), JSON.stringify(d));
    await answerSignoff(b, ew);
    en = await entry('Alex');
    check('the change keeps the hours as signed, when it changed and who approved it', en?.hours === 2 && en.signedHours === 1.5 && en.editedSignoff?.name === 'Casey' && en.editedSignoff.strokes?.length > 0 && !!en.editedAt && en.enteredBy?.name === 'Casey', JSON.stringify(en));

    // ---- A temp worker's hours too ----
    await b.run(ew, `document.getElementById('lfTempName').value = 'Temp Tess'; document.getElementById('lfTempWage').value = '22';
        document.getElementById('lfTempHours').value = '0'; document.getElementById('lfTempMinutes').value = '45'; document.getElementById('lfAddTempBtn').click();`, { user: true });
    d = await dlg();
    check('a temp\'s hours ask the same', d?.why.startsWith('Add 0h 45m for temp Temp Tess'), JSON.stringify(d));
    await answerSignoff(b, ew);
    en = await entry('Temp Tess');
    check('…and are signed by the floor manager', en?.hours === 0.75 && en.wage === 22 && en.enteredBy?.name === 'Casey', JSON.stringify(en));

    // ---- The Labour Log shows the floor manager's initials and the change ----
    await b.run(ew, `document.getElementById('tabLog').click(); LOG.from = ''; LOG.to = ''; renderLabourLog();`, { user: true });
    const log = await b.run(ew, `const tr = [...document.querySelectorAll('#logBody tr')].find(r => r.textContent.includes('Alex') && r.textContent.includes('Leaf Pick'));
        return tr ? { svg: !!tr.querySelector('.log-sig svg polyline'), text: tr.innerText, flags: [...tr.querySelectorAll('.log-flag')].map(f => f.textContent) } : null;`);
    check('the Labour Log shows the floor manager\'s initials, marked as the office', log?.svg && log.text.includes('Casey · office'), JSON.stringify(log));
    check('…says who entered it, and the change with who approved it', log?.flags.includes('🏢 entered in the Tasks tab by Casey (floor manager)')
        && log.flags.some(f => f.startsWith('✏️ signed for 1h 30m, changed in the Tasks tab') && f.endsWith('· approved by Casey')) && !log.flags.some(f => f.includes('not signed')), JSON.stringify(log?.flags));

    // ---- DailyWizard's hours view says it was entered in the office, by whom ----
    const dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    await b.run(dw, `[...document.querySelectorAll('#listContainer *')].filter(el => el.querySelector(':scope > .hours-btn')).find(r => r.textContent.includes('Leaf Pick')).querySelector(':scope > .hours-btn').click();`, { user: true });
    const dwText = await b.run(dw, `return document.getElementById('hoursOverlay').innerText;`);
    check('DailyWizard\'s hours view says who entered the hours in the Labour & Cost Wizard, and who approved the change',
        dwText.includes('Entered in the Labour & Cost Wizard by Casey') && dwText.includes('change approved by Casey'), dwText.slice(0, 400));
    const dwSvg = await b.run(dw, `return [...document.querySelectorAll('#hoursOverlay .hours-entry')].filter(r => r.textContent.includes('Alex') && r.querySelector('svg')).length;`);
    check('…with the floor manager\'s initials', dwSvg === 1, dwSvg);
    await b.run(dw, 'closeHours();');
    await leave(b, dw); await b.send('browsingContext.close', { context: dw });

    // ---- Removing hours still asks only for the PIN ----
    // Back in the Labour & Cost Wizard (one tool at a time: it opens afresh), on the same task
    await b.run(ew, `document.getElementById('tabTasks').click();
        const lot = document.getElementById('activeLot'); lot.value = 'L100'; lot.dispatchEvent(new Event('change'));
        TASK.selectedKey = 'ev_cropb1'; TASK.editDate = '${T}'; renderTasksTab(); document.querySelector('#teEntryList .emp-del').click();`, { user: true });
    d = await dlg();
    check('removing hours asks for the PIN only (no initials pad)', d?.title === '🔒 Floor manager PIN' && !d.pad, JSON.stringify(d));
    await b.run(ew, `document.querySelector('#floorPin [data-fpin-cancel]').click();`);

    // ---- No floor manager with a PIN: hours can't be added here ----
    await b.run(main, `delete DB.data._EmployeeWizard.employees.Casey.pin; markUnsaved(); broadcastToSubtools();`);
    await b.waitFor(ew, `return !DB.data._EmployeeWizard.employees.Casey.pin;`);
    await fill('Blair', 1, 0);
    d = await b.run(ew, `const el = document.getElementById('floorPin'); return { none: !el.querySelector('[data-fpin-none]').hidden, pad: !el.querySelector('[data-fpin-sign]').hidden, text: el.querySelector('[data-fpin-none]').textContent };`);
    check('with no floor manager PIN set, it says where to set one, and adds nothing', d.none && !d.pad && d.text.startsWith('No floor manager has a PIN yet'), JSON.stringify(d));
    await b.run(ew, `document.querySelector('#floorPin [data-fpin-cancel]').click();`);
    check('…nothing was added', !(await entry('Blair')));

    await leave(b, ew); await b.send('browsingContext.close', { context: ew });
    await leave(b, main);
    return results;
}
