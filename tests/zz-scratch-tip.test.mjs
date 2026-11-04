import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, today } from './lib/helpers.mjs';
import { writeFileSync } from 'node:fs';
export const title = 'scratch: launch tooltip look';
const OUT = '/private/tmp/claude-501/-Users-willt-sitkatools/f3a95312-d50a-48f8-9007-a5e3ccf026ba/scratchpad';
export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    await b.send('browsingContext.setViewport', { context: main, viewport: { width: 1400, height: 900 } });
    const clw = await openTool(b, main, 'CropLabourWizard');
    await b.run(clw, `window.confirm = () => true; const l = document.getElementById('activeLot'); l.value = 'L100'; l.dispatchEvent(new Event('change'));
        const d = document.getElementById('plantingDate'); d.value = '${today(-50)}'; d.dispatchEvent(new Event('change'));
        document.getElementById('scheduleForm').requestSubmit();`, { user: true });
    await b.sleep(300);
    await b.run(clw, `window.confirm = () => true; generateProjectionsForRoom('R1G1');`);
    await b.run(main, `Tools.close(); document.getElementById('viewLaunchBtn').click();`, { user: true });
    await b.sleep(300);
    const bars = await b.run(main, `return [...document.querySelectorAll('#launchView .launch-bar')].map(e => [e.textContent, e.dataset.eventId, e.title]);`);
    check('bars', true, JSON.stringify(bars));
    let i = 0;
    for (const sel of ['#launchView .launch-bar:not(.projection)', '#launchView .launch-bar.projection']) {
        const box = await b.run(main, `const el = document.querySelector(${JSON.stringify(sel)}); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + Math.min(40, r.width / 2), y: r.top + r.height / 2 };`);
        await b.send('input.performActions', { context: main.context || main, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: [{ type: 'pointerMove', x: 5, y: 5, duration: 0 }, { type: 'pointerMove', x: Math.round(box.x), y: Math.round(box.y), duration: 50 }] }] });
        await b.sleep(600);
        const tip = await b.run(main, `const t = document.querySelector('.event-tooltip'); return t ? { vis: t.classList.contains('visible'), cls: t.className, text: t.innerText } : null;`);
        check('tip ' + i, true, JSON.stringify(tip));
        const shot = await b.send('browsingContext.captureScreenshot', { context: main.context || main });
        writeFileSync(`${OUT}/launch-tip-${i++}.png`, Buffer.from(shot.data, 'base64'));
    }
    await b.send('browsingContext.setViewport', { context: main, viewport: null });
    return results;
}
