// 📷 Take picture / 🎥 Record training video (user request 2026-10-29): in ✏️ edit mode each step of a DailyWizard task
// opens the tablet's camera. What it takes shows on the step at once (this window), and is offered to save under the
// step's name ({code}_{n}.jpg / .mp4), with the instruction to put it in the "Pictures and Videos" folder on SharePoint.
// (The camera itself can't be driven headless: the test hands the file input what the camera would.)
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, withFloorManager, dwBuilding, dwUnlock } from './lib/helpers.mjs';

export const title = 'DailyWizard: a step\'s picture or training video from the tablet\'s camera, saved under its name';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    const db = withFloorManager(fixtureDb());
    db._DailyWizard.buildings.B1.tasks.find(t => t.code === 'wat1').steps = [{ text: 'Check the drip lines' }, { text: 'Water each table' }];
    await loadSingle(b, main, db);
    const dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    // The camera's file input: kept instead of opened, so the test can give it a file
    await b.run(main, `const click = HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click = function () { if (this.classList.contains('capture-input')) { window.__capIn = this; return; } return click.call(this); };`);
    const buttons = () => b.run(dw, `return [...document.querySelectorAll('#stepsList .step-row')].map(r => [...r.querySelectorAll('.capture-btn')].map(x => x.textContent));`);
    await b.run(dw, `openTaskDetail('B1', 'wat1');`);
    let btns = await buttons();
    check('locked: no camera buttons on the steps', btns.length === 2 && btns.every(r => r.length === 0), JSON.stringify(btns));
    await dwUnlock(b, dw);
    btns = await buttons();
    check('edit mode: every step has 📷 Take picture and 🎥 Record training video', btns.length === 2 && btns.every(r => r.join() === '📷 Take picture,🎥 Record training video'), JSON.stringify(btns));

    const tap = (step, kind) => b.run(dw, `window.__capIn = null;
        document.querySelectorAll('#stepsList .step-row')[${step - 1}].querySelector('.capture-btn[data-kind="${kind}"]').click();`, { user: true })
        .then(() => b.run(main, `const i = window.__capIn; return i ? { accept: i.accept, capture: i.getAttribute('capture') } : null;`));
    const give = (makeFile) => b.run(main, `const f = await (${makeFile})(); const dt = new DataTransfer(); dt.items.add(f);
        window.__capIn.files = dt.files; window.__capIn.dispatchEvent(new Event('change'));`)
        .then(() => b.waitFor(dw, `return !document.getElementById('captureAsk').hidden;`, 15000).catch(() => {}));
    const dialog = () => b.run(dw, `const d = document.getElementById('captureAsk'), a = document.getElementById('captureSaveLink');
        return { open: !d.hidden, title: document.getElementById('captureTitle').textContent, text: document.getElementById('captureText').textContent,
            warn: document.getElementById('captureWarn').hidden ? '' : document.getElementById('captureWarn').textContent, file: a.download, href: a.getAttribute('href'),
            save: a.textContent, lang: !document.getElementById('captureLangRow').hidden };`);

    // ---- 📷 A picture for step 2 ----
    let input = await tap(2, 'pic');
    check('📷 opens the back camera for a picture', input?.accept === 'image/*' && input.capture === 'environment', JSON.stringify(input));
    await give(`async () => { const c = document.createElement('canvas'); c.width = 2000; c.height = 1000; const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 2000, 1000);
        const blob = await new Promise(r => c.toBlob(r, 'image/png')); return new File([blob], 'IMG_0001.png', { type: 'image/png' }); }`);
    let d = await dialog();
    check('…a dialog: "📷 Step 2’s picture", to save as wat1_2.jpg', d.open && d.title === '📷 Step 2’s picture' && d.file === 'wat1_2.jpg' && d.save === '📤 Save wat1_2.jpg' && /^blob:/.test(d.href), JSON.stringify(d));
    check('…telling them to put it in "Pictures and Videos" on SharePoint, next to the database folder',
        d.text === 'It shows on this step in this window now. To keep it for every tablet, save it as wat1_2.jpg and put it in the “Pictures and Videos” folder on SharePoint, next to the database folder.', d.text);
    const img = await b.run(dw, `const blob = await (await fetch(document.getElementById('captureSaveLink').href)).blob(); const bm = await createImageBitmap(blob);
        return { type: blob.type, w: bm.width, h: bm.height };`);
    check('…made a JPEG of at most 1280 px', img.type === 'image/jpeg' && img.w === 1280 && img.h === 640, JSON.stringify(img));
    check('…and shown on step 2 straight away (this window)', await b.run(dw, `const row = document.querySelectorAll('#stepsList .step-row')[1];
        return row.querySelector('.step-img')?.getAttribute('src') === document.getElementById('captureSaveLink').getAttribute('href') && uploadedPics.get('wat1_2')?.file === 'wat1_2.jpg';`));
    await b.run(dw, `const a = document.getElementById('captureSaveLink'); const stop = e => e.preventDefault(); window.addEventListener('click', stop, true);
        a.click(); window.removeEventListener('click', stop, true);`, { user: true });
    check('📤 Save (a PC: the download) says where to put it', await b.run(dw, `return document.getElementById('toast').textContent;`) === 'Saved wat1_2.jpg — now put it in “Pictures and Videos” on SharePoint');
    await b.run(dw, `document.getElementById('captureDoneBtn').click();`, { user: true });
    check('Done closes it; the picture stays on the step', await b.run(dw, `return document.getElementById('captureAsk').hidden && !!document.querySelectorAll('#stepsList .step-row')[1].querySelector('.step-img');`));

    // ---- 🎥 A training video for step 1 ----
    input = await tap(1, 'vid');
    check('🎥 opens the back camera for a video', input?.accept === 'video/*' && input.capture === 'environment', JSON.stringify(input));
    await give(`async () => new File([new Uint8Array(2 * 1048576).fill(7)], 'VID_0001.mp4', { type: 'video/mp4' })`);
    d = await dialog();
    check('…"🎥 Step 1’s training video", to save as wat1_1.mp4, with its size', d.open && d.title === '🎥 Step 1’s training video' && d.file === 'wat1_1.mp4' &&
        d.text.endsWith('2.0 MB — keep training videos short: every tablet loads them.'), JSON.stringify(d));
    check('…a video this device can\'t play is flagged', d.warn.startsWith('⚠️ This device can’t play this video. DailyWizard plays MP4 (H.264)'), d.warn);
    check('…and it\'s in this window\'s videos', await b.run(dw, `return uploadedVids.get('wat1_1')?.file === 'wat1_1.mp4';`));
    await b.keys(main, '');   // Esc
    await b.sleep(150);
    check('Esc closes the dialog', await b.run(dw, `return document.getElementById('captureAsk').hidden;`));

    // ---- In Spanish: it may be the Spanish version ----
    await b.run(dw, `const s = document.getElementById('langSelect'); s.value = 'es'; s.dispatchEvent(new Event('change'));`);
    await tap(2, 'pic');
    await give(`async () => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; c.getContext('2d').fillRect(0, 0, 800, 600);
        return new File([await new Promise(r => c.toBlob(r, 'image/jpeg'))], 'IMG_0002.jpg', { type: 'image/jpeg' }); }`);
    d = await dialog();
    check('in Spanish: the dialog speaks Spanish, the English name by default', d.open && d.title === '📷 Foto del paso 2' && d.file === 'wat1_2.jpg' && d.lang, JSON.stringify(d));
    await b.run(dw, `const c = document.getElementById('captureLang'); c.checked = true; c.dispatchEvent(new Event('change'));`);
    d = await dialog();
    const keys = await b.run(dw, `return [...uploadedPics.keys()];`);
    check('"This is the Spanish version": saved as es_wat1_2.jpg, and shown as the Spanish version', d.file === 'es_wat1_2.jpg' && keys.includes('es_wat1_2') && keys.includes('wat1_2'), JSON.stringify({ file: d.file, keys }));
    await b.run(dw, `document.getElementById('captureDoneBtn').click();`, { user: true });
    await b.run(main, `Tools.close(); clearUnsaved();`);
    return results;
}
