// EmployeeWizard's 📜 Labour Log: every hours entry with who, what, when, how long and the drawn initials.
// The office sees every building; a building device sees only the work done in its own building.
import { today, fixtureDb, makeChecker, fresh, splitFiles, openSplit, saveSplit, openTool, dwBuilding, dwDate, logHours, removeHoursOf, ewSetHours, leave } from './lib/helpers.mjs';

export const title = 'EmployeeWizard Labour Log';

// The log as the page shows it: sections and rows
const readLog = (b, ew) => b.run(ew, `
    return [...document.querySelectorAll('#logBody .log-section')].map(sec => ({
        title: sec.querySelector('h4')?.firstChild?.textContent || '',
        rows: [...sec.querySelectorAll('tbody tr')].map(tr => ({
            text: tr.textContent, removed: tr.classList.contains('removed'), sig: !!tr.querySelector('.log-sig svg polyline'),
            flags: [...tr.querySelectorAll('.log-flag')].map(f => f.textContent)
        }))
    }));`);
const entryRows = log => log.filter(s => s.title !== 'Hours by person').flatMap(s => s.rows);
const setFilter = (b, ew, id, value) => b.run(ew, `const el = document.getElementById('${id}'); if (el.type === 'checkbox') el.checked = ${JSON.stringify(value)}; else el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('change'));`);

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today(), Y = today(-1);
    const office = await fresh(b);
    const files = await splitFiles(b, office, BASE, fixtureDb());
    await openSplit(b, office, BASE, 'office', files);

    // Hours on both buildings, and an office removal of an older entry (kept on record)
    const dw = await openTool(b, office, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    await logHours(b, dw, 'Water plants', 'Alex', 1, 0);
    await logHours(b, dw, 'Leaf Pick', 'Casey', 2, 0);
    await dwBuilding(b, dw, 'B2');
    await logHours(b, dw, 'Water Grow A', 'Blair', 0, 30);
    await dwBuilding(b, dw, 'B1');
    await dwDate(b, dw, Y);
    const rm = await removeHoursOf(b, dw, 'Scout rooms', 'Blair');
    check('office removed yesterday\'s entry (kept on record)', rm.includes('kept on record'), rm);
    await b.sleep(300);

    const ew = await openTool(b, office, 'EmployeeWizard');
    await b.run(ew, `document.getElementById('tabLog').click();`, { user: true });
    let log = await readLog(b, ew);
    let rows = entryRows(log);
    check('office: the log lists every entry of the last 7 days (6, one removed)', rows.length === 6 && rows.filter(r => r.removed).length === 1, `${rows.length} rows`);
    check('office: grouped by day, newest first, with "Hours by person"', log[0].title === 'Hours by person' && log.length === 4, log.map(s => s.title).join(' | '));
    check('office: drawn initials shown for every signed entry', rows.filter(r => r.sig).length === 5);
    const row = m => rows.find(r => r.text.includes(m.who) && r.text.includes(m.what));
    check('entry typed in the Tasks tab is flagged "not signed"', row({ who: 'Drew', what: 'Room Tidy' })?.flags.some(f => f.includes('not signed')));
    check('entry removed by the office is struck through and says so', (() => { const r = row({ who: 'Blair', what: 'Scout rooms' }); return r?.removed && r.flags.some(f => f.startsWith('🗑️ removed by the office')); })());
    check('entry logged a day late is flagged', row({ who: 'Alex', what: 'Water plants' }) && rows.filter(r => r.text.includes('Alex')).some(r => r.flags.includes('⏰ logged 1 day later')));
    check('task day over its estimate is flagged', row({ who: 'Casey', what: 'Leaf Pick' })?.flags.some(f => f.startsWith('📈 2h on this task this day — estimate 1h')));
    check('each row says where (building) and when it was logged, on which device', row({ who: 'Blair', what: 'Water Grow A' })?.text.includes('Building 2') && row({ who: 'Casey', what: 'Leaf Pick' })?.text.includes('on the office'));
    const chips = await b.run(ew, `return [...document.querySelectorAll('#logBody .log-chip')].map(c => c.textContent);`);
    check('summary: 5 entries, 1 not signed, 1 late, 1 removed', ['Entries 5', '⌨️ Not signed 1', '⏰ Logged late 1', '🗑️ Removed 1'].every(c => chips.includes(c)), chips.join(' | '));

    // Filters and grouping
    await setFilter(b, ew, 'logPerson', 'Alex');
    check('filter by person', entryRows(await readLog(b, ew)).length === 2);
    await setFilter(b, ew, 'logPerson', '');
    await setFilter(b, ew, 'logBuilding', 'B2');
    check('filter by building', entryRows(await readLog(b, ew)).length === 1);
    await setFilter(b, ew, 'logBuilding', '');
    await setFilter(b, ew, 'logKind', 'crop');
    check('filter by kind of work (crop tasks)', entryRows(await readLog(b, ew)).length === 2);
    await setFilter(b, ew, 'logKind', '');
    await setFilter(b, ew, 'logRemoved', false);
    check('hide removed entries', entryRows(await readLog(b, ew)).length === 5);
    await setFilter(b, ew, 'logRemoved', true);
    await setFilter(b, ew, 'logGroup', 'person');
    log = await readLog(b, ew);
    check('group by person', log.map(s => s.title).join() === 'Alex,Blair,Casey,Drew', log.map(s => s.title).join());
    await setFilter(b, ew, 'logGroup', 'day');
    await setFilter(b, ew, 'logFrom', T);
    check('date range', entryRows(await readLog(b, ew)).length === 3);
    await setFilter(b, ew, 'logFrom', today(-6));

    // Initials, larger; print
    await b.run(ew, `document.querySelector('#logBody .log-sig').click();`, { user: true });
    check('tapping initials shows them larger', await b.run(ew, `return !document.getElementById('logSigOverlay').hidden && !!document.querySelector('#logSigBig polyline');`));
    await b.run(ew, `document.getElementById('logSigClose').click();`);
    const before = new Set((await b.contexts()).flatMap(c => [c.context, ...(c.children || []).map(x => x.context)]));
    await b.run(ew, `document.getElementById('logPrintBtn').click();`, { user: true });
    await b.sleep(800);
    const pr = (await b.contexts()).find(c => !before.has(c.context));
    const printed = pr ? await b.run(pr.context, `return { h1: document.querySelector('h1')?.textContent, rows: document.querySelectorAll('.log-table tbody tr').length };`) : null;
    check('🖨️ Print opens the log in a print window', printed?.h1 === 'SitkaTools — Labour Log' && printed.rows >= 6, JSON.stringify(printed));
    if (pr) await b.send('browsingContext.close', { context: pr.context });

    // A correction in the Tasks tab shows in the log
    await ewSetHours(b, ew, 'L100', 'ev_cropb1', T, 'Casey', 1, 30);
    await b.run(ew, `document.getElementById('tabLog').click();`, { user: true });
    rows = entryRows(await readLog(b, ew));
    check('a signed entry changed in the Tasks tab says so', rows.find(r => r.text.includes('Casey'))?.flags.some(f => f.startsWith('✏️ signed for 2h, changed in the Tasks tab')));
    await b.sleep(300);
    const saved = await saveSplit(b, office);
    await b.send('browsingContext.close', { context: ew });
    await b.send('browsingContext.close', { context: dw });

    // ---- Building 1's device: only its own building's work ----
    await openSplit(b, office, BASE, 'B1', { ...files, ...saved });
    const ewB = await openTool(b, office, 'EmployeeWizard');
    const tabs = await b.run(ewB, `return ['tabEmployees', 'tabTasks', 'tabLog', 'tabReports'].filter(id => document.getElementById(id).style.display !== 'none');`);
    check('building device: Tasks and Labour Log tabs only', tabs.join() === 'tabTasks,tabLog', tabs.join());
    await b.run(ewB, `document.getElementById('tabLog').click();`, { user: true });
    rows = entryRows(await readLog(b, ewB));
    check('building device: only Building 1\'s entries (no Building 2)', rows.length === 5 && !rows.some(r => r.text.includes('Water Grow A')), `${rows.length} rows`);
    check('building device: the building filter is locked to it', await b.run(ewB, `const s = document.getElementById('logBuilding'); return s.disabled && s.value === 'B1' && s.options.length === 1;`));
    await leave(b, ewB);
    await b.send('browsingContext.close', { context: ewB });
    await leave(b, office);
    return results;
}
