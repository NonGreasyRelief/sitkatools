// CropLabourWizard closing with changed dates not saved (user request 2026-10-28): a lot with a saved schedule whose
// dates were changed (the green ones) and not overwritten asks "Close crop labour wizard without overwriting old
// values?" — a red Close and discard, and a teal Overwrite schedule then close — from Close Tool and from ✕ Close.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool } from './lib/helpers.mjs';

export const title = 'CropLabourWizard asks before closing with schedule changes not saved';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    await b.run(main, `window.confirm = () => true; window.alert = () => {};`);   // Generate's own questions: yes

    const isOpen = () => b.run(main, `return Tools.current === 'CropLabourWizard';`);
    const ask = (clw) => b.run(clw, `const d = document.getElementById('closeAsk'); if (d.hidden) return { open: false };
        const bg = id => getComputedStyle(document.getElementById(id)).backgroundColor;
        return { open: true, title: document.getElementById('closeAskTitle').textContent, text: document.getElementById('closeAskText').textContent,
            discard: document.getElementById('closeAskDiscard').textContent, overwrite: document.getElementById('closeAskOverwrite').textContent,
            red: bg('closeAskDiscard'), teal: bg('closeAskOverwrite'), green: bg('generateBtn') };`);
    const pick = (clw, lot) => b.run(clw, `const s = document.getElementById('activeLot'); s.value = ${JSON.stringify(lot)}; s.dispatchEvent(new Event('change'));`);
    const closeTool = (clw) => b.run(clw, `document.getElementById('closeToolBtn').click();`, { user: true }).then(() => b.sleep(150));
    const moveStart = (clw, days) => b.run(clw, `const i = document.getElementById('plantingDate'), d = new Date(i.value + 'T00:00'); d.setDate(d.getDate() + ${days});
        i.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        i.dispatchEvent(new Event('input')); return i.value;`);
    const saved = (clw) => b.run(clw, `return getScheduleConfig('L200')?.plantingDate || null;`);

    // ---- A lot with no saved schedule: nothing to ask ----
    let clw = await openTool(b, main, 'CropLabourWizard');
    await pick(clw, 'L200');
    await b.run(clw, `const i = document.getElementById('plantingDate'); i.value = '2026-11-02'; i.dispatchEvent(new Event('input'));`);
    await closeTool(clw);
    check('no saved schedule yet: Close Tool closes without asking', !(await isOpen()));

    // ---- Generate, then close with nothing changed ----
    clw = await openTool(b, main, 'CropLabourWizard');
    await pick(clw, 'L200');
    await b.run(clw, `const i = document.getElementById('plantingDate'); i.value = '2026-11-02'; i.dispatchEvent(new Event('input'));
        document.getElementById('scheduleForm').requestSubmit(document.getElementById('generateBtn'));`, { user: true });
    check('the schedule is saved', (await saved(clw)) === '2026-11-02', await saved(clw));
    await closeTool(clw);
    check('saved and unchanged: Close Tool closes without asking', !(await isOpen()));

    // ---- Picked new dates, not overwritten ----
    clw = await openTool(b, main, 'CropLabourWizard');
    await pick(clw, 'L200');
    const later = await moveStart(clw, 7);
    await closeTool(clw);
    let d = await ask(clw);
    check('a new start date, not overwritten: Close Tool asks', d.open && d.title === 'Close crop labour wizard without overwriting old values?' && await isOpen(), JSON.stringify(d));
    check('…with Close and discard and Overwrite schedule then close', d.discard === 'Close and discard' && d.overwrite === 'Overwrite schedule then close', JSON.stringify(d));
    check('…red, and the teal of the other confirms (Generate\'s)', d.red === 'rgb(231, 76, 60)' && d.teal === 'rgb(83, 216, 168)' && d.teal === d.green, `${d.red} ${d.teal} ${d.green}`);
    check('…naming the lot', d.text.startsWith('L200\'s saved schedule stays as it was'), d.text);
    await b.keys(main, '');   // Esc
    await b.sleep(150);
    check('Esc goes back to the tool, the change still there', !(await ask(clw)).open && await isOpen() && await b.run(clw, `return document.getElementById('plantingDate').value;`) === later);
    await b.run(main, `document.getElementById('toolBarClose').click();`, { user: true });
    await b.sleep(150);
    d = await ask(clw);
    check('✕ Close in the bar asks too', d.open && await isOpen(), JSON.stringify(d));
    await b.run(clw, `document.getElementById('closeAsk').click();`, { user: true });   // the backdrop
    check('a tap outside the box goes back to the tool', !(await ask(clw)).open && await isOpen());

    // ---- Close and discard ----
    await closeTool(clw);
    await b.run(clw, `document.getElementById('closeAskDiscard').click();`, { user: true });
    await b.sleep(150);
    check('Close and discard: closed, the saved schedule as it was', !(await isOpen()) && await b.run(main, `return DB.data.lots.L200._tool_CropLabourWizard?.plantingDate || null;`) === '2026-11-02');

    // ---- Overwrite schedule then close ----
    clw = await openTool(b, main, 'CropLabourWizard');
    await pick(clw, 'L200');
    const later2 = await moveStart(clw, 7);
    await closeTool(clw);
    await b.run(clw, `document.getElementById('closeAskOverwrite').click();`, { user: true });
    await b.sleep(200);
    check('Overwrite schedule then close: saved with the new date, then closed', !(await isOpen()) &&
        await b.run(main, `return DB.data.lots.L200._tool_CropLabourWizard?.plantingDate || null;`) === later2 && await b.run(main, `return hasUnsavedChanges;`), later2);

    // ---- Overwrite's own question cancelled: the tool stays open ----
    clw = await openTool(b, main, 'CropLabourWizard');
    await pick(clw, 'L200');
    // A task holding hours, switched off: Overwrite asks whether to drop its hours
    const off = await b.run(clw, `const box = [...document.querySelectorAll('input.task-enabled-check')].find(c => c.checked);
        const tt = taskOffsets[+box.dataset.idx].def.taskType, ev = DB.data.calendarEvents.find(e => e.lotId === 'L200' && e.taskType === tt);
        ev.labour_map = { [ev.date]: [{ employee: 'Alex', hours: 1 }] };
        box.checked = false; box.dispatchEvent(new Event('change', { bubbles: true })); return { tt, id: ev.id };`);
    await b.run(main, `window.__asked = []; window.confirm = m => { window.__asked.push(m); return false; };`);
    await closeTool(clw);
    check('a task switched off asks too', (await ask(clw)).open);
    await b.run(clw, `document.getElementById('closeAskOverwrite').click();`, { user: true });
    await b.sleep(200);
    const asked = await b.run(main, `return window.__asked;`);
    check('…Overwrite asks about the hours it would drop; No keeps the tool open, nothing saved', await isOpen() && !(await ask(clw)).open &&
        /with recorded work will be removed/.test(asked[0] || '') && await b.run(main, `return !!DB.data.calendarEvents.find(e => e.id === ${JSON.stringify(off.id)})?.labour_map;`), JSON.stringify(asked));
    await b.run(main, `window.confirm = () => true; Tools.close();`);
    check('a close from the hub itself (not ✕ Close) closes at once', !(await isOpen()));
    return results;
}
