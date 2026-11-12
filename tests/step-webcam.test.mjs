// 📷 Take picture / 🎥 Take video on a laptop (user request 2026-11-11): DailyWizard opens the webcam itself — a live view,
// 📸 Snap, or ⏺ Record and ⏹ Stop — and in folder mode 💾 Save to Media writes the step's picture or video straight into the
// database folder's Media folder (which OneDrive syncs to SharePoint), in place of the step's old versions there.
// The folder is a real one in the browser's private storage (a stand-in showDirectoryPicker before every page). The webcam
// is a drawn canvas's stream, and the recorder a stand-in that makes an MP4 (headless Firefox has neither a webcam nor MP4
// recording; Chrome and Edge record MP4 themselves).
import { fixtureDb, withFloorManager, makeChecker, fresh, openSitka, openTool, dwBuilding, dwUnlock, leave } from './lib/helpers.mjs';

export const title = 'DailyWizard: a step\'s picture or video from the laptop\'s webcam, saved straight into the Media folder';

const STANDIN = `() => {
    window.__folderPermission = 'granted';
    if (window.FileSystemHandle && !FileSystemHandle.prototype.queryPermission) {
        FileSystemHandle.prototype.queryPermission = async function () { return window.__folderPermission; };
        FileSystemHandle.prototype.requestPermission = async function () { return window.__folderPermission; };
    }
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(window.__pickFolder || 'Shared', { create: true });
}`;

// The webcam (a canvas drawn 20 times a second) and an MP4 recorder, in the page
const CAMERA = `window.__streams = [];
    navigator.mediaDevices.getUserMedia = async () => {
        if (window.__camRefuse) throw new DOMException('Permission denied', 'NotAllowedError');
        const c = document.createElement('canvas'); c.width = 640; c.height = 360; c.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(c);
        const x = c.getContext('2d'); let i = 0;
        setInterval(() => { x.fillStyle = i++ % 2 ? '#3a6' : '#3a7'; x.fillRect(0, 0, 640, 360); }, 50);
        const s = c.captureStream(20); window.__streams.push(s); return s;
    };
    window.MediaRecorder = class {
        static isTypeSupported(t) { return window.__mp4 !== false && /^video\\/mp4/.test(t); }
        constructor(stream, o) { this.mimeType = o?.mimeType; this.state = 'inactive'; }
        start() { this.state = 'recording'; }
        stop() { this.state = 'inactive'; setTimeout(() => { this.ondataavailable?.({ data: new Blob(['fake mp4 video data'], { type: 'video/mp4' }) }); this.onstop?.(); }, 10); }
    };`;

// The folder's files: dir(path), write(path, data), list(path) → every file under it ('sub/name'), read(path)
const FILES = `const root = await navigator.storage.getDirectory();
    const dir = async path => { let d = root; for (const part of path.split('/')) d = await d.getDirectoryHandle(part, { create: true }); return d; };
    const write = async (path, data) => { const parts = path.split('/'), name = parts.pop(); const d = await dir(parts.join('/'));
        const w = await (await d.getFileHandle(name, { create: true })).createWritable(); await w.write(data); await w.close(); };
    const list = async path => { const out = []; const walk = async (d, pre) => { for await (const e of d.values()) { if (e.kind === 'file') out.push(pre + e.name); else await walk(e, pre + e.name + '/'); } };
        await walk(await dir(path), ''); return out.sort(); };
    const read = async path => { const parts = path.split('/'), name = parts.pop(); return (await (await dir(parts.join('/'))).getFileHandle(name)).getFile(); };`;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    const { script } = await b.send('script.addPreloadScript', { functionDeclaration: STANDIN, contexts: [main] });
    try {
        const db = withFloorManager(fixtureDb());
        db._DailyWizard.buildings.B1.tasks.find(t => t.code === 'wat1').steps = [{ text: 'Check the drip lines' }, { text: 'Water each table' }];
        await openSitka(b, main, BASE);
        await b.run(main, `${FILES} try { await root.removeEntry('Webcam', { recursive: true }); } catch (_) {}
            await write('Webcam/DB-26-11-10.json', ${JSON.stringify(JSON.stringify(db))});
            for (const f of ['Building 1/wat1_2.png', 'wat1_02.jpg', 'es_wat1_2.jpg', 'scu1_1.jpg']) await write('Webcam/Media/' + f, 'old picture');
            await write('Webcam/Media/wat1_1.mp4', 'old video');
            window.__pickFolder = 'Webcam'; await DbFolder.choose(); ${CAMERA}`);
        const dw = await openTool(b, main, 'DailyWizard');
        await dwBuilding(b, dw, 'B1');
        await dwUnlock(b, dw);
        await b.run(dw, `openTaskDetail('B1', 'wat1');`);
        const take = (step, act, kind) => b.run(dw, `document.querySelectorAll('#stepsList .step-row')[${step - 1}].querySelector('.capture-btn[data-act="${act}"][data-kind="${kind}"]').click();`, { user: true });
        const camReady = () => b.waitFor(dw, `const v = document.getElementById('camLive'); return !document.getElementById('camAsk').hidden && !document.getElementById('camShotBtn').disabled && v.videoWidth > 0;`, 10000);
        const dialog = () => b.run(dw, `const a = document.getElementById('captureSaveLink'), f = document.getElementById('captureFolderBtn'), r = document.getElementById('captureRetakeBtn');
            return { open: !document.getElementById('captureAsk').hidden, title: document.getElementById('captureTitle').textContent, text: document.getElementById('captureText').textContent,
                folder: f.hidden ? null : f.textContent, retake: r.hidden ? null : r.textContent, link: a.className, file: a.download };`);
        const streamsEnded = () => b.run(main, `return window.__streams.map(s => s.getTracks().every(t => t.readyState === 'ended'));`);

        // ---- 📷 Take picture: the webcam, 📸 Snap ----
        await take(2, 'take', 'pic');
        await camReady();
        let st = await b.run(dw, `return { title: document.getElementById('camTitle').textContent, status: document.getElementById('camStatus').textContent, shot: document.getElementById('camShotBtn').textContent };`);
        check('📷 Take picture on a laptop opens the webcam here: a live view and 📸 Snap', st.title === '📷 Step 2’s picture' && st.shot === '📸 Snap' && st.status === 'Frame the step, then 📸 Snap.', JSON.stringify(st));
        await b.run(dw, `document.getElementById('camShotBtn').click();`, { user: true });
        await b.waitFor(dw, `return !document.getElementById('captureAsk').hidden;`, 10000);
        let d = await dialog();
        check('📸 Snap: the picture, to save as wat1_2.jpg, with 💾 Save to Media and ↺ Retake (folder mode)', d.open && d.file === 'wat1_2.jpg' && d.folder === '💾 Save to Media' && d.retake === '↺ Retake' && /btn-secondary/.test(d.link), JSON.stringify(d));
        check('…saying where it goes', d.text === 'It shows on this step in this window now. 💾 Save to Media puts it in “Webcam/Media” as wat1_2.jpg, in place of the step’s old one there, and OneDrive takes it to SharePoint for every laptop.', d.text);
        check('…and the webcam is let go', (await streamsEnded()).join() === 'true');
        const jpg = await b.run(dw, `const bm = await createImageBitmap(await (await fetch(document.getElementById('captureSaveLink').href)).blob()); return [bm.width, bm.height];`);
        check('…the frame as the camera gave it (640 × 360), a JPEG', jpg.join() === '640,360', jpg.join());

        await b.run(dw, `document.getElementById('captureFolderBtn').click();`, { user: true });
        await b.waitFor(dw, `return document.getElementById('captureAsk').hidden;`);
        st = await b.run(main, `${FILES} const f = await read('Webcam/Media/wat1_2.jpg'); const head = new Uint8Array(await f.slice(0, 2).arrayBuffer());
            return { files: await list('Webcam/Media'), jpeg: head[0] === 0xFF && head[1] === 0xD8 };`);
        const toast = await b.run(dw, `return document.getElementById('toast').textContent;`);
        check('💾 Save to Media writes Media/wat1_2.jpg into the database folder', st.jpeg && st.files.includes('wat1_2.jpg'), JSON.stringify(st));
        check('…in place of the step\'s old pictures (another type, leading zeros, a building\'s subfolder); the Spanish version and the other steps stay',
            st.files.join() === 'es_wat1_2.jpg,scu1_1.jpg,wat1_1.mp4,wat1_2.jpg', st.files.join());
        check('…and says so', /^✅ Saved Media\/wat1_2\.jpg — OneDrive takes it to SharePoint · replaced /.test(toast) && /Media\/Building 1\/wat1_2\.png/.test(toast) && /Media\/wat1_02\.jpg/.test(toast), toast);
        check('…the picture showing on step 2', await b.run(dw, `return !!document.querySelectorAll('#stepsList .step-row')[1].querySelector('.step-img');`));

        // ---- ↺ Retake: the snap is dropped and the webcam opens again; Cancel lets it go, nothing saved ----
        await take(1, 'take', 'pic');
        await camReady();
        await b.run(dw, `document.getElementById('camShotBtn').click();`, { user: true });
        await b.waitFor(dw, `return !document.getElementById('captureAsk').hidden;`, 10000);
        await b.run(dw, `document.getElementById('captureRetakeBtn').click();`, { user: true });
        await camReady();
        st = await b.run(dw, `return { ask: !document.getElementById('captureAsk').hidden, onStep: uploadedPics.has('wat1_1') };`);
        check('↺ Retake: the snap is dropped from the step and the webcam opens again', !st.ask && !st.onStep, JSON.stringify(st));
        await b.run(dw, `document.getElementById('camCancelBtn').click();`, { user: true });
        st = await b.run(main, `${FILES} return { files: await list('Webcam/Media') };`);
        check('…Cancel closes it and lets the webcam go; nothing is saved', (await streamsEnded()).every(Boolean) && !st.files.includes('wat1_1.jpg') &&
            await b.run(dw, `return document.getElementById('camAsk').hidden;`), JSON.stringify(st.files));

        // ---- 🎥 Take video: ⏺ Record, ⏹ Stop, 💾 Save to Media in place of the old video ----
        await take(1, 'take', 'vid');
        await camReady();
        await b.run(dw, `document.getElementById('camShotBtn').click();`, { user: true });
        st = await b.run(dw, `return { shot: document.getElementById('camShotBtn').textContent, status: document.getElementById('camStatus').textContent };`);
        check('🎥 Take video: ⏺ Record starts it, with a running time and ⏹ Stop', st.shot === '⏹ Stop' && /^⏺ Recording 0:0\d$/.test(st.status), JSON.stringify(st));
        await b.run(dw, `document.getElementById('camShotBtn').click();`, { user: true });
        await b.waitFor(dw, `return !document.getElementById('captureAsk').hidden;`, 10000);
        d = await dialog();
        check('⏹ Stop: the video, to save as wat1_1.mp4', d.open && d.title === '🎥 Step 1’s training video' && d.file === 'wat1_1.mp4' && d.folder === '💾 Save to Media', JSON.stringify(d));
        await b.run(dw, `document.getElementById('captureFolderBtn').click();`, { user: true });
        await b.waitFor(dw, `return document.getElementById('captureAsk').hidden;`);
        st = await b.run(main, `${FILES} return { files: await list('Webcam/Media'), video: await (await read('Webcam/Media/wat1_1.mp4')).text() };`);
        check('💾 Save to Media replaces the step\'s video', st.video === 'fake mp4 video data' && st.files.join() === 'es_wat1_2.jpg,scu1_1.jpg,wat1_1.mp4,wat1_2.jpg', JSON.stringify(st));

        // ---- A browser that can't record MP4, and a camera refused ----
        await b.run(main, `window.__mp4 = false;`);
        await take(1, 'take', 'vid');
        await b.sleep(200);
        st = await b.run(dw, `return { cam: !document.getElementById('camAsk').hidden, toast: document.getElementById('toast').textContent };`);
        check('a browser that can\'t record MP4: no webcam, and it says to use Chrome or Edge, or 🎞 Upload video',
            !st.cam && st.toast === 'This browser can’t record MP4 video, which DailyWizard plays — use Chrome or Edge, or 🎞 Upload video', JSON.stringify(st));
        await b.run(main, `window.__mp4 = true; window.__camRefuse = true;`);
        await take(1, 'take', 'pic');
        st = await b.waitFor(dw, `const s = document.getElementById('camStatus').textContent; return /Couldn’t/.test(s) ? { s, shot: document.getElementById('camShotBtn').disabled } : null;`);
        check('the camera refused: it says so, with Upload to use instead', st && st.shot && st.s === 'Couldn’t start the camera (Permission denied). Allow the camera for this page, or use 🖼 / 🎞 Upload.', JSON.stringify(st));
        await b.run(dw, `document.getElementById('camCancelBtn').click();`, { user: true });
        await b.run(main, `window.__camRefuse = false;`);

        // ---- Closing DailyWizard with the webcam on lets it go ----
        await take(2, 'take', 'pic');
        await camReady();
        await b.run(main, `Tools.close();`);
        check('closing DailyWizard with the webcam on lets the webcam go', (await streamsEnded()).every(Boolean));

        // ---- Out of folder mode: no 💾 Save to Media, the 📤 link as before ----
        await b.run(main, `DbFolder.deactivate(); Tools.open('DailyWizard');`);
        await dwBuilding(b, dw, 'B1');
        await dwUnlock(b, dw);
        await b.run(dw, `openTaskDetail('B1', 'wat1');`);
        await take(1, 'take', 'pic');
        await camReady();
        await b.run(dw, `document.getElementById('camShotBtn').click();`, { user: true });
        await b.waitFor(dw, `return !document.getElementById('captureAsk').hidden;`, 10000);
        d = await dialog();
        check('out of folder mode: no 💾 Save to Media; the 📤 Save link, and the words, as before', d.folder === null && /btn-primary/.test(d.link) &&
            d.text === 'It shows on this step in this window now. To keep it for every tablet, save it as wat1_1.jpg and put it in the database folder’s “Media” folder on SharePoint.', JSON.stringify(d));
        await b.run(dw, `document.getElementById('captureDoneBtn').click();`, { user: true });
        await b.run(main, `Tools.close(); clearUnsaved();`);
    } finally {
        await b.run(main, `window.__pickFolder = null; if (typeof Tools !== 'undefined' && Tools.current) Tools.close();`).catch(() => {});
        await b.send('script.removePreloadScript', { script }).catch(() => {});
        await leave(b, main);
    }
    return results;
}
