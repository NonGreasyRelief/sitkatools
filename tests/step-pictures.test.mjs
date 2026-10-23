// DailyWizard step pictures and videos: 📁 Upload image pack / 🖼 Upload images / videos read files named
// {code}_{n}.png|jpg|webp|mp4 into the window (never stored or saved) and show them on their steps ahead of pics/.
// A language prefix (es_j234_1.jpg) is that language's version; other languages fall back to the English file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, dwBuilding, leave } from './lib/helpers.mjs';

export const title = 'DailyWizard uploaded step pictures and videos';

// A 1×1 PNG (the browser sniffs the content, so the same bytes do for a .jpg name; the .mp4 only needs a name here)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitka-pics-'));
    const file = name => { const p = path.join(dir, name); fs.writeFileSync(p, PNG); return p; };
    const first = ['wat1_1.png', 'wat1_02.jpg', 'wat1_2.mp4', 'IMG_0001.png', 'zzzz_1.png'].map(file);

    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    const dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    // Three steps on "Water plants" (in this window only), then its steps view
    await b.run(dw, `const t = DB.dailyBuildings.B1.tasks.find(t => t.code === 'wat1');
        t.steps = [{ text: 'Check the drip lines' }, { text: 'Water G1' }, { text: 'Log dry spots' }];
        openTaskDetail('B1', 'wat1');`);
    const before = await b.run(dw, `return JSON.stringify(DB.data);`);

    check('the steps view has 📁 Upload image pack (a folder picker) and 🖼 Upload images / videos (mp4 allowed)',
        await b.run(dw, `return !!document.getElementById('uploadPackBtn') && !!document.getElementById('uploadImagesBtn') && document.getElementById('packInput').hasAttribute('webkitdirectory') && document.getElementById('imagesInput').multiple && document.getElementById('imagesInput').accept.includes('.mp4');`));

    const pick = async (inputId, files) => {
        const r = await b.send('script.evaluate', { expression: `document.getElementById(${JSON.stringify(inputId)})`, target: { context: dw }, awaitPromise: false });
        await b.send('input.setFiles', { context: dw, element: { sharedId: r.result.sharedId }, files });
        await b.sleep(400);
    };
    const srcs = () => b.run(dw, `return [...document.querySelectorAll('#stepsList .step-row')].map(r => r.querySelector('.step-img')?.getAttribute('src') || r.querySelector('.chip.missing')?.textContent || '');`);
    const vids = () => b.run(dw, `return [...document.querySelectorAll('#stepsList .step-row')].map(r => r.querySelector('.step-video')?.getAttribute('src') || '');`);

    await pick('imagesInput', first);
    await b.sleep(600);   // the pics/ probes for step 3 finish
    let s = await srcs(), v = await vids();
    check('steps 1 and 2 show the uploaded pictures (wat1_1.png, wat1_02.jpg)', s[0].startsWith('blob:') && s[1].startsWith('blob:'), JSON.stringify(s));
    check('step 2 also shows its uploaded video (wat1_2.mp4), with controls', v[1].startsWith('blob:') && await b.run(dw, `return document.querySelectorAll('#stepsList .step-row')[1].querySelector('.step-video').controls;`), JSON.stringify(v));
    check('step 1 has no video', !v[0], JSON.stringify(v));
    check('step 3 has no upload, looks in pics/ and says what to name the files', !s[2].startsWith('blob:') && !v[2] && s[2].includes('wat1_3.png / .mp4'), s[2]);
    const toast = await b.run(dw, `return document.getElementById('toast').textContent;`);
    check('the toast counts what loaded, what was skipped and what matches no task',
        toast.includes('pictures: 3') && toast.includes('videos: 1') && toast.includes('IMG_0001.png') && toast.includes('zzzz_1.png'), toast);
    const note = await b.run(dw, `const n = document.getElementById('uploadedNote'); return n.hidden ? '' : n.textContent;`);
    check('the steps view says how many uploaded pictures and videos are in use', note.includes('pictures: 3') && note.includes('videos: 1'), note);
    check('nothing is saved: the DB is unchanged', (await b.run(dw, `return JSON.stringify(DB.data);`)) === before);
    check('nothing is stored in the browser', await b.run(dw, `try { return localStorage.length === 0 && sessionStorage.length === 0; } catch (_) { return true; }`));

    // A later pick (here through the image pack button's input) replaces that step's picture
    const replaced = s[0];
    await pick('packInput', [file('wat1_1.webp')]).catch(async () => pick('imagesInput', [file('wat1_1.webp')]));
    s = await srcs();
    check('a later pick replaces the step\'s picture', s[0].startsWith('blob:') && s[0] !== replaced, JSON.stringify(s));

    // Spanish: the buttons are translated
    await b.run(dw, `const l = document.getElementById('langSelect'); l.value = 'es'; l.dispatchEvent(new Event('change'));`);
    const labels = await b.run(dw, `return document.getElementById('uploadPackBtn').textContent + ' | ' + document.getElementById('uploadImagesBtn').textContent;`);
    check('in Spanish the buttons are translated', labels.includes('Subir paquete de imágenes') && labels.includes('Subir imágenes / vídeos'), labels);

    // Language versions: an es_ file shows in Spanish; a language without its own file shows the English one
    const enPic = s[0], enVid = v[1];
    await b.sleep(600);
    let es = await srcs(), esV = await vids();
    check('in Spanish without Spanish files, the English picture and video show', es[0] === enPic && esV[1] === enVid, JSON.stringify([es, esV]));
    await pick('imagesInput', [file('es_wat1_1.png'), file('es_wat1_2.mp4')]);
    const esToast = await b.run(dw, `return document.getElementById('toast').textContent;`);
    es = await srcs(); esV = await vids();
    check('Spanish files (es_ prefix) replace the English ones in Spanish', es[0].startsWith('blob:') && es[0] !== enPic && esV[1].startsWith('blob:') && esV[1] !== enVid, JSON.stringify([es, esV]));
    check('they load as Spanish versions, not as a task called "es_w"', esToast.includes('1') && !esToast.includes('match no task'), esToast);
    await b.run(dw, `const l = document.getElementById('langSelect'); l.value = 'fr'; l.dispatchEvent(new Event('change'));`);
    await b.sleep(600);
    let fr = await srcs(), frV = await vids();
    check('in French (no French files) the English picture and video show', fr[0] === enPic && frV[1] === enVid, JSON.stringify([fr, frV]));
    await b.run(dw, `const l = document.getElementById('langSelect'); l.value = 'en'; l.dispatchEvent(new Event('change'));`);
    await b.sleep(300);
    check('back in English the English files show', (await srcs())[0] === enPic && (await vids())[1] === enVid);

    await b.run(dw, `closeTaskDetail();`);

    // ---- From the main screen: every building's pictures at once (a folder per building, or the files) ----
    const front = await b.run(dw, `const opened = [];
        for (const id of ['packInput', 'imagesInput']) document.getElementById(id).click = () => opened.push(id);
        document.getElementById('frontPackBtn').click(); document.getElementById('frontImagesBtn').click();
        delete document.getElementById('packInput').click; delete document.getElementById('imagesInput').click;
        return { opened, note: document.getElementById('picsNote').textContent, shown: !document.getElementById('picsNote').hidden };`, { user: true });
    check('the main screen has 📁 Picture folder and 🖼 Picture files (the same pickers)', front.opened.join() === 'packInput,imagesInput', JSON.stringify(front));
    check('…and says what is loaded in this window', front.shown && /^🖼 \d+ pictures · \d+ videos \(this window\)$/.test(front.note), front.note);
    await b.run(dw, `DB.dailyBuildings.B2.tasks[0].steps = [{ text: 'Check Grow A' }];`);
    await pick('imagesInput', [file('wat2_1.png')]);   // Building 2's chore, picked with no task open
    await dwBuilding(b, dw, 'B2');
    await b.run(dw, `openTaskDetail('B2', 'wat2');`);
    await b.sleep(300);
    check('a picture picked on the main screen shows on another building\'s task', (await srcs())[0]?.startsWith('blob:'), JSON.stringify(await srcs()));
    await b.run(dw, `closeTaskDetail();`);
    await leave(b, dw); await b.send('browsingContext.close', { context: dw });
    await leave(b, main);
    fs.rmSync(dir, { recursive: true, force: true });
    return results;
}
