// DailyWizard on a building device: it opens on its own building, and can also look at every other building and at
// All Buildings, view only — no ticks, hours, sign-offs or task changes there. Its own rows still work in All
// Buildings, and saving touches only its own file. All Buildings shows every building's ⏰ Still open.
import { today, fixtureDb, withFloorManager, makeChecker, fresh, splitFiles, openSplit, saveSplit, openTool, dwBuilding, dwUnlock, leave } from './lib/helpers.mjs';

export const title = 'DailyWizard: other buildings view only on a building device';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const T = today();
    const db = withFloorManager(fixtureDb());
    // Building 2's chore has a step, and was ticked today in Building 2
    db._DailyWizard.buildings.B2.tasks[0].steps = [{ text: 'Check the Grow A drip lines' }];
    db._DailyWizard.buildings.B2.checks = { [T]: { wat2: { at: `${T}T15:00:00.000Z`, by: 'B2' } } };
    let main = await fresh(b);
    const files = await splitFiles(b, main, BASE, db);

    check('B1 device opened the files', await openSplit(b, main, BASE, 'B1', files));
    const dw = await openTool(b, main, 'DailyWizard');
    check('a floor manager unlocks ✏️ edit mode on the device\'s own building', await dwUnlock(b, dw));
    const sel = () => b.run(dw, `const s = document.getElementById('buildingSelect');
        return { disabled: s.disabled, value: s.value, options: [...s.options].map(o => o.value + '=' + o.textContent) };`);
    let s = await sel();
    check('the Building selector is open and starts on the device\'s own building', !s.disabled && s.value === 'B1', JSON.stringify(s));
    check('it offers All Buildings and Building 2, marked 👀 view only (not Building 1)',
        s.options.map(o => o.split('=')[0]).join() === 'ALL,B1,B2' && s.options[2].includes('👀') && !s.options[1].includes('👀'), JSON.stringify(s.options));
    const view = () => b.run(dw, `const L = document.getElementById('listContainer');
        return { note: L.querySelector('.view-only-note')?.textContent || '', add: !!L.querySelector('.add-task-bar'),
            checks: [...L.querySelectorAll('.task-check input')].map(i => i.disabled), hours: [...L.querySelectorAll('.hours-btn')].map(x => x.disabled),
            done: [...L.querySelectorAll('.done-btn')].map(x => x.disabled), move: L.querySelectorAll('.move-btns').length };`);
    let v = await view();
    check('own building: + Add Task, ticks, hours and ▲ ▼ work, no view-only note', v.add && !v.note && v.checks.every(d => !d) && v.move > 0, JSON.stringify(v));

    // ---- Building 2: view only ----
    await dwBuilding(b, dw, 'B2');
    v = await view();
    check('Building 2: a "👀 Viewing Building 2 — view only" note with a way back', v.note.includes('Viewing Building 2') && v.note.includes('Back to Building 1'), v.note);
    check('Building 2: no + Add Task and no ▲ ▼', !v.add && v.move === 0, JSON.stringify(v));
    check('Building 2: every tick, ⏱ Log and ✍️ Mark done is off', v.checks.length > 0 && v.checks.every(d => d) && v.hours.every(d => d) && v.done.length > 0 && v.done.every(d => d), JSON.stringify(v));
    check('Building 2: its tick from today shows', await b.run(dw, `return document.querySelector('#listContainer .task-check input').checked;`));
    check('Building 2: its ⏰ Still open (Strip Fans) shows', (await b.run(dw, `return document.getElementById('listContainer').innerText;`)).includes('Strip Fans'));
    await b.run(dw, `document.querySelector('#listContainer .task-check input').click(); document.querySelector('#listContainer .hours-btn').click(); openTaskEditor('B2', 'wat2');`, { user: true });
    check('tapping a tick, ⏱ Log or opening the editor changes nothing',
        (await b.run(dw, `return !!DB.data._DailyWizard.buildings.B2.checks['${T}'].wat2 && !document.getElementById('hoursOverlay').classList.contains('open') && !document.getElementById('editorOverlay').classList.contains('open');`)));

    // The chore's steps: to read, not to change
    await b.run(dw, `[...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Water Grow A')).querySelector('.task-name').click();`, { user: true });
    const detail = () => b.run(dw, `return { open: document.getElementById('detailOverlay').classList.contains('open'),
        steps: document.getElementById('stepsList').innerText, stepBtns: document.querySelectorAll('#stepsList .step-btn').length,
        addStep: [...document.querySelectorAll('#stepsList button')].some(x => x.textContent.includes('Add Step')),
        edit: getComputedStyle(document.getElementById('editTaskBtn')).display, del: getComputedStyle(document.getElementById('deleteTaskBtn')).display,
        summary: document.getElementById('detailSummary').innerText };`);
    let d = await detail();
    check('the task opens with its steps', d.open && d.steps.includes('Check the Grow A drip lines'), JSON.stringify(d));
    check('no Edit Task, Delete Task, ▲ ▼ 🗑 or + Add Step; it says view only', d.edit === 'none' && d.del === 'none' && d.stepBtns === 0 && !d.addStep && d.summary.includes('View only'), JSON.stringify(d));
    await b.run(dw, `document.querySelector('#stepsList .step-text').click();`, { user: true });
    check('tapping a step doesn\'t open it for editing', !(await b.run(dw, `return !!document.querySelector('#stepsList .step-text-input');`)));
    await b.run(dw, `closeTaskDetail();`);

    // A live update from SitkaTools keeps the building being looked at
    await b.run(main, `DB.data.lots.L100.plantCount = 99; markUnsaved();`);
    await b.sleep(800);
    check('a live DB update keeps Building 2 on screen', (await sel()).value === 'B2');

    // ---- Back to Building 1 ----
    await b.run(dw, `document.querySelector('#listContainer .view-only-note button').click();`, { user: true });
    v = await view();
    check('Back to Building 1: its own list, + Add Task back', (await sel()).value === 'B1' && v.add && !v.note, JSON.stringify(v));
    const ownEdit = await b.run(dw, `[...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Water plants')).querySelector('.task-name').click();
        const ok = getComputedStyle(document.getElementById('editTaskBtn')).display !== 'none'; closeTaskDetail(); return ok;`, { user: true });
    check('own building: Edit Task is there', ownEdit);

    // ---- All Buildings: own rows work, the rest are view only; every building's Still open shows ----
    await dwBuilding(b, dw, 'ALL');
    const all = await b.run(dw, `return { note: document.querySelector('#listContainer .view-only-note')?.textContent || '',
        sections: [...document.querySelectorAll('#listContainer .building-section')].map(sec => ({
            head: sec.querySelector('.building-section-header')?.textContent || '',
            checks: [...sec.querySelectorAll('.task-check input')].map(i => i.disabled),
            text: sec.innerText })) };`);
    check('All Buildings: a note says only Building 1 can be changed here', all.note.includes('only Building 1 can be changed'), all.note);
    const [s1, s2] = all.sections;
    check('Building 1\'s rows can be ticked; Building 2\'s section is marked 👀 and its ticks are off',
        s1.checks.length && s1.checks.every(x => !x) && s2.head.includes('👀') && s2.checks.length && s2.checks.every(x => x), JSON.stringify(all.sections.map(x => [x.head, x.checks])));
    check('each building\'s ⏰ Still open shows in its section', /still open/i.test(s1.text) && s1.text.includes('Room Tidy') && /still open/i.test(s2.text) && s2.text.includes('Strip Fans'));
    await b.run(dw, `[...document.querySelectorAll('#listContainer .building-section')][0].querySelector('.task-check input').click();`, { user: true });
    check('ticking Building 1\'s chore in All Buildings works', await b.run(dw, `return !!DB.data._DailyWizard.buildings.B1.checks?.['${T}']?.wat1;`));
    await b.sleep(400);

    // Saving: only Building 1's file
    const saved = await saveSplit(b, main);
    check('saving writes only Building-B1.json, with no "can\'t be saved" warning', Object.keys(saved).join() === 'Building-B1.json' && !b.logs.some(l => l.includes("can't be saved")), Object.keys(saved).join(', '));
    await leave(b, dw); await b.send('browsingContext.close', { context: dw });

    // ---- The office with building files: the daily lists are view only (only a building's own device saves its file),
    // crop and equipment tasks still take hours and sign-offs (they're the events', in Main); All Buildings shows every Still open ----
    await openSplit(b, main, BASE, 'office', files);
    const ow = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, ow, 'ALL');
    const off = await b.run(ow, `return { note: document.querySelector('#listContainer .view-only-note')?.textContent || '', marked: [...document.getElementById('buildingSelect').options].filter(o => o.textContent.includes('👀 daily list view only')).length,
        checks: [...document.querySelectorAll('#listContainer .task-check input')].map(i => i.disabled), done: [...document.querySelectorAll('#listContainer .done-btn')].map(x => x.disabled),
        hours: [...document.querySelectorAll('#listContainer .task-row')].filter(r => r.querySelector('.done-btn')).map(r => r.querySelector('.hours-btn')?.disabled), text: document.getElementById('listContainer').innerText };`);
    check('office: the daily lists are view only — a note, both buildings marked, their ticks off (only the general event\'s tick, kept in the page, works)',
        off.note.includes('view only on the office') && off.marked === 2 && off.checks.slice(0, -1).every(x => x) && off.checks[off.checks.length - 1] === false, JSON.stringify(off));
    check('office: crop and equipment tasks still take hours and ✍️ Mark done', off.done.length > 0 && off.done.every(x => !x) && off.hours.every(x => !x), JSON.stringify({ done: off.done, hours: off.hours }));
    check('office: All Buildings shows Still open for both buildings', off.text.includes('Room Tidy') && off.text.includes('Strip Fans'));
    await leave(b, ow); await b.send('browsingContext.close', { context: ow });
    await leave(b, main);
    return results;
}
