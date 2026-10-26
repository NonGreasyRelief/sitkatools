// DailyWizard's tick boxes are saved per building and day (each new day starts blank): one tap, recording when and on
// which device. On crop / equipment rows a tick means "today's part is done"; ✅ Mark done still finishes the task.
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, saveSingle, splitFiles, openSplit, saveSplit, openTool, newTab,
    dwBuilding, dwDate, dwTick, dwTicked, leave } from './lib/helpers.mjs';

export const title = 'DailyWizard saved check-offs';

const checks = (b, ctx, bid) => b.run(ctx, `return DB.data._DailyWizard?.buildings?.[${JSON.stringify(bid)}]?.checks || null;`);
const status = (b, dw) => b.run(dw, `return document.getElementById('statusText').textContent;`);

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today(), Y = today(-1);
    let main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    let dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');

    check('ticking a chore', (await dwTick(b, dw, 'Water plants')) === true);
    check('ticking a crop task row (today\'s part)', (await dwTick(b, dw, 'Leaf Pick')) === true);
    await b.sleep(300);
    let c = await checks(b, main, 'B1');
    check('SitkaTools has both ticks for today, with time and device', !!c?.[T]?.wat1?.at && c[T].wat1.by === 'office' && !!c[T]['ev:ev_cropb1']?.at, JSON.stringify(c));
    check('a tick marks the DB unsaved', (await b.run(main, 'return hasUnsavedChanges;')) === true);
    check('the crop task is not finished by a tick (Mark done still offered)', (await b.run(main, `return DB.data.calendarEvents.find(e => e.id === 'ev_cropb1').completed !== true;`)));
    check('status bar counts the ticked chore', (await status(b, dw)).includes('✅ 1/2 done'), await status(b, dw));

    // Each day starts blank; other days keep their own ticks
    await dwDate(b, dw, Y);
    check('yesterday starts without today\'s ticks', (await dwTicked(b, dw, 'Water plants')) === false);
    await dwTick(b, dw, 'Scout rooms');
    await dwDate(b, dw, today(1));
    check('tomorrow starts blank', (await dwTicked(b, dw, 'Water plants')) === false && (await dwTicked(b, dw, 'Scout rooms')) === false);
    await dwDate(b, dw, T);
    check('back on today, its ticks are there', (await dwTicked(b, dw, 'Water plants')) === true && (await dwTicked(b, dw, 'Leaf Pick')) === true);
    c = await checks(b, main, 'B1');
    check('yesterday\'s tick saved under yesterday', !!c?.[Y]?.scu1 && !c?.[T]?.scu1);

    // Untick, and an event with no building (All Buildings → Unassigned) stays in the page only
    check('unticking a row', (await dwTick(b, dw, 'Leaf Pick')) === false);
    await b.sleep(200);
    c = await checks(b, main, 'B1');
    check('…removes its record', !c?.[T]?.['ev:ev_cropb1'] && !!c?.[T]?.wat1, JSON.stringify(c?.[T]));
    await dwBuilding(b, dw, 'ALL');
    const before = JSON.stringify(await b.run(main, 'return DB.data._DailyWizard;'));
    check('All Buildings: ticking an event with no building', (await dwTick(b, dw, 'Staff meeting')) === true);
    await b.sleep(200);
    check('…keeps it in the page only (no building file to save it in)', JSON.stringify(await b.run(main, 'return DB.data._DailyWizard;')) === before);

    // Saved file, reopened
    const saved = JSON.parse(await saveSingle(b, main));
    check('the saved file holds the ticks', !!saved._DailyWizard.buildings.B1.checks?.[T]?.wat1 && !!saved._DailyWizard.buildings.B1.checks?.[Y]?.scu1);
    await b.send('browsingContext.close', { context: dw });
    await openSitka(b, main, BASE);
    await loadSingle(b, main, saved);
    dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    check('after reopening, today\'s tick is still there', (await dwTicked(b, dw, 'Water plants')) === true && (await dwTicked(b, dw, 'Scout rooms')) === false);

    // Reset Day clears the day's saved ticks in the building shown
    await b.run(dw, `document.getElementById('resetDayBtn').click();`, { user: true });
    await b.sleep(200);
    c = await checks(b, main, 'B1');
    check('Reset Day clears today\'s ticks (and leaves other days)', !c?.[T] && !!c?.[Y]?.scu1, JSON.stringify(c));
    await leave(b, dw); await b.send('browsingContext.close', { context: dw });

    // Tablet tab: ticks reach SitkaTools through the shared working copy
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    // SitkaTools' start check (≈400 ms with a session left behind) comes first: a tab opened before it would load
    // the old session's copy, which SitkaTools rightly ignores
    await b.waitFor(main, 'return WorkCopy.ready;');
    await b.run(main, 'await WorkCopy.flush();');
    const tab = await newTab(b, `${BASE}/DailyWizard/DailyWizard.html`);
    await b.waitFor(tab, 'return typeof DB !== "undefined" && !!DB.data && Object.keys(DB.data.lots || {}).length > 0;');
    await dwBuilding(b, tab, 'B1');
    await dwTick(b, tab, 'Water plants');
    await b.sleep(1200);
    check('tablet tab: SitkaTools took the tick in', !!(await checks(b, main, 'B1'))?.[T]?.wat1);
    await leave(b, tab); await b.send('browsingContext.close', { context: tab });

    // Split files: a building device saves its ticks in its own file
    const files = await splitFiles(b, main, BASE, fixtureDb());
    await openSplit(b, main, BASE, 'B1', files);
    dw = await openTool(b, main, 'DailyWizard');
    await dwTick(b, dw, 'Water plants');
    await dwTick(b, dw, 'Clean fans');
    await b.sleep(300);
    const s = await saveSplit(b, main);
    const bf = JSON.parse(s['Building-B1.json'] || '{}');
    check('B1 device: saves only Building-B1.json, with the ticks', Object.keys(s).join() === 'Building-B1.json' &&
        bf._DailyWizard?.buildings?.B1?.checks?.[T]?.wat1?.by === 'B1' && !!bf._DailyWizard.buildings.B1.checks[T]['ev:ev_equipb1'], Object.keys(s).join());
    check('B1 device: no "can\'t be saved from this device" warning', !b.logs.some(l => l.includes("can't be saved")));
    await leave(b, dw);
    await openSplit(b, main, BASE, 'office', { ...files, ...s });
    dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    check('office sees Building 1\'s ticks', (await dwTicked(b, dw, 'Water plants')) === true && (await dwTicked(b, dw, 'Clean fans')) === true);
    check('opening them changes nothing by itself', (await b.run(main, 'return hasUnsavedChanges;')) === false);
    await leave(b, dw);
    await leave(b, main);
    return results;
}
