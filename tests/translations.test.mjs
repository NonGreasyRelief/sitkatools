// DailyWizard's 🌐 language picker: the screen's own text in French, Spanish, Vietnamese and Chinese, and translated
// task names and steps that sit next to the English (the master) without changing it.
import { fixtureDb, withFloorManager, makeChecker, fresh, openSitka, loadSingle, openTool, dwBuilding, dwUnlock, leave } from './lib/helpers.mjs';

export const title = 'DailyWizard translations';

const lang = (b, dw, code) => b.run(dw, `const s = document.getElementById('langSelect'); s.value = ${JSON.stringify(code)}; s.dispatchEvent(new Event('change'));`);
const text = (b, dw, id) => b.run(dw, `return document.getElementById(${JSON.stringify(id)}).innerText;`);
const task = (b, ctx, code) => b.run(ctx, `return DB.data._DailyWizard.buildings.B1.tasks.find(t => t.code === ${JSON.stringify(code)});`);
// Tap a step's text, type, and finish the edit (blur commits it)
const editStep = (b, dw, i, value) => b.run(dw, `
    document.querySelectorAll('#stepsList .step-row')[${i}].querySelector('.step-text').click();
    const input = document.querySelector('#stepsList .step-text-input');
    input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new Event('blur'));`);

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, withFloorManager(fixtureDb()));
    const dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');

    const langs = await b.run(dw, `return [...document.getElementById('langSelect').options].map(o => o.value).join(',');`);
    check('the picker offers English, French, Spanish, Vietnamese and Chinese (English first)', langs === 'en,fr,es,vi,zh', langs);
    check('English by default', (await text(b, dw, 'listContainer')).includes('⏱ Log'));
    await dwUnlock(b, dw);   // ✏️ Edit tasks: writing steps and translations needs a floor manager's PIN

    // A step written in English (the master)
    await b.run(dw, `openTaskDetail('B1', 'wat1'); [...document.querySelectorAll('#stepsList button')].find(x => x.textContent.includes('Add Step')).click();`);
    await b.run(dw, `const input = document.querySelector('#stepsList .step-text-input'); input.value = 'Check the drip lines'; input.dispatchEvent(new Event('blur')); closeTaskDetail();`);

    // ---- Spanish: the screen's text, and the English shown with an EN tag where nothing is translated yet ----
    await lang(b, dw, 'es');
    check('the footer and status bar switch to Spanish', (await text(b, dw, 'resetDayBtn')) === 'Reiniciar el día' && (await text(b, dw, 'statusText')).includes('hoy'));
    let list = await text(b, dw, 'listContainer');
    check('an untranslated chore shows its English name, tagged EN', list.includes('Water plants') && list.includes('EN') && list.includes('⏱ Registrar'), list.slice(0, 200));

    // Name: the editor's extra field writes the Spanish name; the English name stays
    await b.run(dw, `openTaskEditor('B1', 'wat1'); document.getElementById('taskNameTrInput').value = 'Regar las plantas'; saveTaskFromEditor();`);
    let t = await task(b, dw, 'wat1');
    check('the Spanish name is saved next to the English', t.name === 'Water plants' && t.translations?.es === 'Regar las plantas', JSON.stringify(t.translations));
    list = await text(b, dw, 'listContainer');
    check('the row shows the Spanish name', list.includes('Regar las plantas') && !list.includes('Water plants'));

    // Step: tapping it in Spanish edits the Spanish; new steps are added in English only
    await b.run(dw, `openTaskDetail('B1', 'wat1');`);
    check('in Spanish, + Add Step is off (new steps are written in English)', await b.run(dw, `return [...document.querySelectorAll('#stepsList button')].find(x => x.textContent.includes('Añadir paso')).disabled;`));
    const blankStep = () => b.run(dw, `return !!document.querySelector('#stepsList .step-text.blank') && !document.querySelector('#stepsList .chip-en');`);
    let steps = await text(b, dw, 'stepsList');
    check('in Spanish, a step with no translation shows blank (no English, no EN tag)', !steps.includes('Check the drip lines') && await blankStep(), steps.slice(0, 160));
    await editStep(b, dw, 0, 'Revise las líneas de goteo');
    t = await task(b, dw, 'wat1');
    check('the Spanish step is saved next to the English', t.steps[0].text === 'Check the drip lines' && t.steps[0].translations?.es === 'Revise las líneas de goteo', JSON.stringify(t.steps[0]));
    check('the detail view shows the Spanish step', (await text(b, dw, 'stepsList')).includes('Revise las líneas de goteo'));
    // Switching language with the steps open: each language shows only its own steps
    await lang(b, dw, 'fr');
    steps = await text(b, dw, 'stepsList');
    check('in French (not translated yet) the step is blank — no English, no Spanish', !steps.includes('Check the drip lines') && !steps.includes('Revise') && await blankStep(), steps.slice(0, 160));
    await lang(b, dw, 'en');
    steps = await text(b, dw, 'stepsList');
    check('in English the step shows the English', steps.includes('Check the drip lines') && !steps.includes('Revise'));
    await lang(b, dw, 'es');
    check('back in Spanish the Spanish step is there', (await text(b, dw, 'stepsList')).includes('Revise las líneas de goteo'));
    await b.run(dw, `closeTaskDetail();`);
    await b.sleep(400);
    t = await task(b, main, 'wat1');
    check('SitkaTools gets the translations', t.translations?.es === 'Regar las plantas' && t.steps[0].translations?.es === 'Revise las líneas de goteo');

    // ---- 🗣️ Talk: shown in another language, opens Google Translate set to English ⇄ that language ----
    await b.run(dw, `window.__opened = [];
        window.open = (u, t, f) => { window.__opened.push([u, t, f]); return window.__win = { closed: false, focused: 0, focus() { this.focused++; }, opener: window, location: {} }; };`);
    const talk = () => b.run(dw, `const t = document.getElementById('talkBtn'); return { hidden: t.hidden, text: t.textContent };`);
    const tk = await talk();
    check('in Spanish the 🗣️ Hablar button shows', !tk.hidden && tk.text.includes('Hablar'), JSON.stringify(tk));
    await b.run(dw, `document.getElementById('talkBtn').click();`, { user: true });
    const talkState = () => b.run(dw, `return { opened: window.__opened, href: window.__win?.location.href, opener: window.__win?.opener === null, focused: window.__win?.focused };`);
    let ts = await talkState();
    check('it opens Google Translate set to English → Spanish, in a window of its own (width and height given)',
        ts.opened.length === 1 && ts.opened[0][1] === 'sitkaTalk' && /width=\d+,height=\d+/.test(ts.opened[0][2]) && ts.href === 'https://translate.google.com/?sl=en&tl=es&op=translate', JSON.stringify(ts));
    check('Google\'s page gets no link back to DailyWizard', ts.opener, JSON.stringify(ts));
    await b.run(dw, `document.getElementById('talkBtn').click();`, { user: true });
    ts = await talkState();
    check('tapping Talk again brings the same window forward, no second window', ts.opened.length === 1 && ts.focused === 1, JSON.stringify(ts));
    await lang(b, dw, 'zh');
    await b.run(dw, `document.getElementById('talkBtn').click();`, { user: true });
    ts = await talkState();
    check('in Chinese the same window switches to English → Simplified Chinese (zh-CN)', ts.opened.length === 1 && !!ts.href?.includes('tl=zh-CN'), JSON.stringify(ts));
    await b.run(dw, `window.__win.closed = true; document.getElementById('talkBtn').click();`, { user: true });
    ts = await talkState();
    check('once that window is closed, Talk opens a new one', ts.opened.length === 2 && !!ts.href?.includes('tl=zh-CN'), JSON.stringify(ts));
    await b.run(dw, `window.__win.closed = true; window.open = () => null; document.getElementById('talkBtn').click();`, { user: true });
    check('blocked pop-ups: a toast says to allow them', (await b.run(dw, `return document.getElementById('toast')?.textContent || '';`)).includes('弹出窗口'));
    await lang(b, dw, 'en');
    check('in English the Talk button is hidden', (await talk()).hidden);

    // ---- Every language draws without unfilled placeholders; English comes back unchanged ----
    for (const code of ['fr', 'vi', 'zh']) {
        await lang(b, dw, code);
        const all = (await text(b, dw, 'listContainer')) + (await text(b, dw, 'statusText'));
        check(`${code}: the day list has no unfilled {placeholders} and no English buttons`, !/[{}]|undefined|NaN/.test(all) && !all.includes('⏱ Log'), all.slice(0, 160));
    }
    await lang(b, dw, 'en');
    list = await text(b, dw, 'listContainer');
    check('back in English: the English name and buttons', list.includes('Water plants') && list.includes('⏱ Log') && !list.includes('Regar'));
    await leave(b, dw); await b.send('browsingContext.close', { context: dw });
    await leave(b, main);
    return results;
}
