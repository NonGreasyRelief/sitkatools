// CropLabourWizard's cloning date typed by hand (user bug 2026-11-07: the digits went in out of order). Chrome and Edge
// change the box with every digit, a year passing through 0002, 0020 and 0202; the preview used to redraw on each.
// Now, while the date is typed, the preview waits for a whole date and a short pause, or for the box to be left; a
// date picked from the calendar redraws it at once; a half-typed year is never drawn or generated.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool } from './lib/helpers.mjs';

export const title = 'CropLabourWizard: typing the cloning date';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    await b.run(main, `window.__alerts = []; window.alert = m => window.__alerts.push(String(m)); window.confirm = () => true;`);
    const clw = await openTool(b, main, 'CropLabourWizard');
    await b.run(clw, `const s = document.getElementById('activeLot'); s.value = 'L200'; s.dispatchEvent(new Event('change'));`);

    const value = () => b.run(clw, `return document.getElementById('plantingDate').value;`);
    const firstDate = () => b.run(clw, `return document.querySelector('#previewTaskList .preview-computed-date')?.textContent.slice(0, 10) || null;`);
    const preview = () => b.run(clw, `return document.getElementById('previewTaskList').textContent.replace(/\\s+/g, ' ').trim().slice(0, 120);`);
    // A mark in the preview that any redraw wipes out
    const mark = () => b.run(clw, `const m = document.createElement('i'); m.id = 'redrawMark'; document.getElementById('previewTaskList').appendChild(m);`);
    const redrawn = () => b.run(clw, `return !document.getElementById('redrawMark');`);
    const clickBox = async () => {
        const box = await b.run(clw, `const i = document.getElementById('plantingDate'); i.scrollIntoView({ block: 'center' });
            const r = i.getBoundingClientRect(); return { x: r.left, y: r.top, h: r.height };`);
        await b.send('input.performActions', { context: main, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: [
            { type: 'pointerMove', x: Math.round(box.x + 12), y: Math.round(box.y + box.h / 2) }, { type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 }] }] });
        await b.send('input.releaseActions', { context: main });
    };
    const blur = () => b.run(clw, `document.getElementById('plantingDate').blur();`);

    // ---- Real keys: the whole date typed in, in order, and the preview follows once typing stops ----
    const order = await b.run(clw, `return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date(2026, 10, 7)).filter(p => p.type !== 'literal').map(p => p.type);`);
    const digits = order.map(t => ({ year: '2027', month: '03', day: '15' })[t]).join('');
    await clickBox();
    check('a click puts the cursor in the date box', await b.run(clw, `return document.getElementById('plantingDate').matches(':focus');`));
    await mark();
    await b.keys(main, digits);
    check(`typed ${digits} (${order.join('-')}): the box reads 2027-03-15`, (await value()) === '2027-03-15', await value());
    check('the preview waits while the date is typed', !(await redrawn()));
    await b.sleep(1100);
    check('a moment after the last key the preview follows', await redrawn() && (await firstDate()) === '2027-03-15', await firstDate());

    // ---- Chrome and Edge: every digit of the year changes the box (0002, 0020, 0202, then 2026) ----
    const typeAs = (v) => b.run(clw, `const i = document.getElementById('plantingDate'); i.focus();
        i.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true })); i.value = ${JSON.stringify(v)};
        i.dispatchEvent(new Event('input', { bubbles: true })); return i.value;`);
    await mark();
    for (const v of ['0002-11-07', '0020-11-07', '0202-11-07']) await typeAs(v);
    await b.sleep(1100);
    check('a year still being typed (0002 → 0202) never redraws the preview, even after a pause', !(await redrawn()));
    await typeAs('2026-11-07');
    check('the whole date: still no redraw mid-typing', !(await redrawn()));
    await b.sleep(1100);
    check('…then the preview follows it', await redrawn() && (await firstDate()) === '2026-11-07', await firstDate());

    // ---- Leaving the box redraws at once ----
    await mark();
    await typeAs('2026-12-01');
    await blur();
    check('leaving the box redraws the preview at once', await redrawn() && (await firstDate()) === '2026-12-01', await firstDate());

    // ---- Left half-typed: the preview says so, and Generate refuses ----
    await typeAs('0202-12-01');
    await blur();
    check('a half-typed year left in the box: the preview asks to finish it', /Finish typing the date/.test(await preview()), await preview());
    const eventsBefore = await b.run(main, `return DB.data.calendarEvents.filter(e => e.lotId === 'L200').length;`);
    await b.run(clw, `document.getElementById('scheduleForm').requestSubmit(document.getElementById('generateBtn'));`, { user: true });
    const alerts = await b.run(main, `return window.__alerts;`);
    check('Generate refuses a half-typed year and says why', alerts.some(a => /finish typing the date: its year reads 0202/i.test(a)), JSON.stringify(alerts));
    check('…and nothing is scheduled', (await b.run(main, `return DB.data.calendarEvents.filter(e => e.lotId === 'L200').length;`)) === eventsBefore);

    // ---- A date picked from the calendar (no key pressed) redraws at once, as before ----
    await b.sleep(300);
    await mark();
    await b.run(clw, `const i = document.getElementById('plantingDate'); i.focus(); i.value = '2026-10-05'; i.dispatchEvent(new Event('input', { bubbles: true }));`);
    check('a date picked from the calendar redraws the preview at once', await redrawn() && (await firstDate()) === '2026-10-05', await firstDate());
    await blur();

    return results;
}
