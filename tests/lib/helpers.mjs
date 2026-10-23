// Shared helpers for the browser tests: a made-up database (no real staff or lot names) and the steps a person
// takes in SitkaTools and DailyWizard, done with real clicks and real pen strokes.
import { createHash } from 'node:crypto';

export function today(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Two buildings, two lots, a roster, daily chores, and crop / equipment tasks today. One older crop task holds an
// entry typed in EmployeeWizard by an older build (no id), and one chore entry was logged a day late.
export function fixtureDb() {
    const T = today(), Y = today(-1), Y2 = today(-2);
    const stroke = [[0.2, 0.7, 0.3, 0.3, 0.4, 0.7]];
    return {
        buildings: {
            B1: { name: 'Building 1', description: null, createdDate: '2026-01-01', assignedRooms: ['R1G1', 'R1CL'] },
            B2: { name: 'Building 2', description: null, createdDate: '2026-01-01', assignedRooms: ['R2G1'] }
        },
        rooms: {
            R1G1: { name: 'Grow 1', description: null, createdDate: '2026-01-01', assignedLots: ['L100'], isFlowering: true, buildingId: 'B1' },
            R1CL: { name: 'Clone 1', description: null, createdDate: '2026-01-01', assignedLots: [], isFlowering: false, buildingId: 'B1' },
            R2G1: { name: 'Grow A', description: null, createdDate: '2026-01-01', assignedLots: ['L200'], isFlowering: true, buildingId: 'B2' }
        },
        lots: {
            L100: { name: 'L100', strain: 'Test Kush', stage: 'flower', createdDate: '2026-08-01', closedDate: null, destRoom: 'Grow 1', cloningRoom: 'Clone 1', vegRoom: null, currentRoom: 'Grow 1', plantCount: 100 },
            L200: { name: 'L200', strain: 'Blue Test', stage: 'flower', createdDate: '2026-08-05', closedDate: null, destRoom: 'Grow A', cloningRoom: null, vegRoom: null, currentRoom: 'Grow A', plantCount: 80 }
        },
        calendarEvents: [
            { id: 'ev_equipb1', date: T, title: '🌀 Clean fans — Grow 1', sourceTool: 'EquipmentWizard', roomId: 'R1G1', equipmentId: 'eq1', taskId: 't1' },
            { id: 'ev_cropb1', date: T, title: '🍂 R1G1-Test Kush#L100, Leaf Pick', sourceTool: 'CropLabourWizard', lotId: 'L100', taskType: 'late_leaf_pick', estStaff: 1, estMinutes: 60 },
            { id: 'ev_cropb2', date: T, title: '🌿 R2G1-Blue Test#L200, Defoliate', sourceTool: 'CropLabourWizard', lotId: 'L200', taskType: 'defoliation' },
            { id: 'ev_oldb1', date: Y, title: '🧹 R1G1-Test Kush#L100, Room Tidy', sourceTool: 'CropLabourWizard', lotId: 'L100', taskType: 'room_tidy',
              labour_map: { [Y]: [{ employee: 'Drew', hours: 3 }] } },
            { id: 'ev_doneb1', date: Y2, title: '🪴 R1G1-Test Kush#L100, Top Dress', sourceTool: 'CropLabourWizard', lotId: 'L100', taskType: 'top_dress', completed: true },
            { id: 'ev_oldb2', date: Y2, endDate: Y, title: '🌾 R2G1-Blue Test#L200, Strip Fans', sourceTool: 'CropLabourWizard', lotId: 'L200', taskType: 'strip_fans' },
            { id: 'ev_general', date: T, title: '📣 Staff meeting', sourceTool: 'GeneralEvent' }
        ],
        _EmployeeWizard: {
            employees: {
                Alex: { wage: 20, workDays: [1, 2, 3, 4, 5], timeOff: [] },
                Blair: { wage: 21, workDays: [1, 2, 3, 4, 5], timeOff: [] },
                Casey: { wage: 22, workDays: [0, 1, 2, 3, 4, 5, 6], timeOff: [] },
                Drew: { wage: 23, workDays: [1, 2, 3, 4, 5], timeOff: [] }
            }
        },
        _DailyWizard: {
            buildings: {
                B1: {
                    tasks: [
                        { code: 'wat1', emoji: '💧', name: 'Water plants', minutes: 30, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], monthDays: [], steps: [] },
                        { code: 'scu1', emoji: '🔎', name: 'Scout rooms', minutes: 20, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], monthDays: [], steps: [] }
                    ],
                    labour: {
                        [Y]: { scu1: [{ id: 'le_fixtureyy', employee: 'Blair', hours: 0.5, initials: { name: 'Blair', strokes: stroke }, at: `${Y}T15:00:00.000Z`, by: 'B1' }] },
                        [Y2]: { wat1: [{ id: 'le_fixturelt', employee: 'Alex', hours: 1, initials: { name: 'Alex', strokes: stroke }, at: `${Y}T16:00:00.000Z`, by: 'B1' }] }
                    }
                },
                B2: { tasks: [{ code: 'wat2', emoji: '💧', name: 'Water Grow A', minutes: 30, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], monthDays: [], steps: [] }] }
            }
        }
    };
}

// 🔒 A floor manager with a PIN, stored the way the tools store it (salted SHA-256, never the PIN itself)
export const FM_PIN = '2468';
export function withFloorManager(db, name = 'Casey', pin = FM_PIN) {
    const salt = `fixture${name.toLowerCase()}`;
    const emp = db._EmployeeWizard.employees[name];
    emp.floorManager = true;
    emp.pin = { salt, hash: createHash('sha256').update(`${salt}:${pin}`).digest('hex'), setAt: '2026-10-01' };
    return db;
}

// Answer the open floor manager PIN dialog; resolves once it has closed (or the wrong PIN left it open)
export async function answerPin(b, ctx, name = 'Casey', pin = FM_PIN) {
    await b.waitFor(ctx, `return document.getElementById('floorPin') && !document.getElementById('floorPin').hidden;`, 3000).catch(() => {});
    await b.run(ctx, `const el = document.getElementById('floorPin'); if (!el || el.hidden) return;
        const w = el.querySelector('[data-fpin-who]'); if ([...w.options].some(o => o.value === ${JSON.stringify(name)})) w.value = ${JSON.stringify(name)};
        el.querySelector('[data-fpin-pin]').value = ${JSON.stringify(pin)}; el.querySelector('[data-fpin-ok]').click();`);
    await b.waitFor(ctx, `return document.getElementById('floorPin').hidden;`, 1500).catch(() => {});
    await b.sleep(100);
}

// DailyWizard: ✏️ Edit tasks, unlocked with a floor manager's PIN
export async function dwUnlock(b, dw, name = 'Casey', pin = FM_PIN) {
    await b.run(dw, `document.getElementById('editTasksBtn').click();`, { user: true });
    await answerPin(b, dw, name, pin);
    return b.run(dw, 'return EditMode.on();');
}

export function makeChecker() {
    const results = [];
    const check = (name, ok, detail = '') => {
        results.push({ name, ok: !!ok, detail });
        console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
        return !!ok;
    };
    return { results, check };
}

// Close every window but one and blank it; return its context. The shared working copy is deleted too, so a session
// a test left unsaved isn't offered back ("Session closed without saving") to the next test.
export async function fresh(b) {
    const ctxs = await b.contexts();
    for (const c of ctxs.slice(1)) await b.send('browsingContext.close', { context: c.context, promptUnload: false }).catch(() => {});
    await b.run(ctxs[0].context, 'window.onbeforeunload = null; if (typeof clearUnsaved === "function") clearUnsaved();').catch(() => {});
    await forgetWorkCopy(b, ctxs[0].context);
    await b.navigate(ctxs[0].context, 'about:blank').catch(() => {});
    return ctxs[0].context;
}

// Delete the shared working copy (IndexedDB 'sitkatools' → 'work' → 'current') from a page of the site, and stop
// that page writing it again as it's left. A page of another origin (about:blank) has none to delete.
export async function forgetWorkCopy(b, ctx) {
    await b.run(ctx, `
        if (typeof WorkCopy !== 'undefined' && 'wrote' in WorkCopy) { WorkCopy.wrote = false; WorkCopy.ready = false; clearTimeout(WorkCopy._timer); }
        await new Promise(res => {
            try {
                const r = indexedDB.open('sitkatools', 3);
                r.onupgradeneeded = () => { for (const n of ['folders', 'settings', 'work']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n, { keyPath: 'key' }); };
                r.onsuccess = () => {
                    try {
                        const tx = r.result.transaction('work', 'readwrite');
                        tx.objectStore('work').delete('current');
                        tx.oncomplete = tx.onerror = () => { r.result.close(); res(); };
                    } catch (_) { r.result.close(); res(); }
                };
                r.onerror = () => res();
            } catch (_) { res(); }
        });`).catch(() => {});
}

// Let a page be left without the unsaved-changes prompt
export const leave = (b, ctx) => b.run(ctx, 'window.onbeforeunload = null; if (typeof clearUnsaved === "function") clearUnsaved();').catch(() => {});

export async function openSitka(b, ctx, base, device = null) {
    await leave(b, ctx);
    await b.navigate(ctx, `${base}/SitkaTools/SitkaTools.html${device ? `?device=${device}` : ''}`);
}

// A single-file DB, loaded the way 📂 Load DB does
export async function loadSingle(b, ctx, db) {
    return b.run(ctx, `return loadDbFromText(${JSON.stringify(JSON.stringify(db))}, 'DB-26-10-13.json');`);
}

// The split files for a DB (what "Split into building files" writes)
export async function splitFiles(b, ctx, base, db) {
    await openSitka(b, ctx, base);
    await loadSingle(b, ctx, db);
    const files = await b.run(ctx, `
        const out = {};
        for (const [n, p] of Object.entries(DbSplit.split(DB.data))) out[n] = JSON.stringify(p, null, 2);
        clearUnsaved();
        return out;`);
    return files;
}

// Open a split set on a device (from the page link ?device=…), the way 📂 Load DB does with several files
export async function openSplit(b, ctx, base, device, files) {
    await openSitka(b, ctx, base, device);
    const set = {
        main: { name: 'Main.json', text: files['Main.json'] },
        wages: files['Wages.json'] ? { name: 'Wages.json', text: files['Wages.json'] } : null,
        buildings: Object.entries(files).filter(([n]) => n.startsWith('Building-')).map(([name, text]) => ({ name, text })),
        folder: null
    };
    return b.run(ctx, `return await DbSplit.open(${JSON.stringify(set)});`);
}

// 💾 Save DB with split files → the text of every offered file (each right-click link used)
export async function saveSplit(b, ctx) {
    return b.run(ctx, `
        document.getElementById('exportBtn').click();
        const out = {};
        for (const a of document.querySelectorAll('#saveFileLinks a.save-link')) {
            out[a.dataset.file] = await (await fetch(a.href)).text();
            a.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
        }
        return out;`, { user: true });
}

// 💾 Save DB with a single file → its text (the right-click link used)
export async function saveSingle(b, ctx) {
    return b.run(ctx, `
        document.getElementById('exportBtn').click();
        const a = document.getElementById('saveLink');
        const text = await (await fetch(a.href)).text();
        a.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
        return text;`, { user: true });
}

// Open a module from SitkaTools (its module link) and wait for the new window to have the DB
export async function openTool(b, sitka, tool, { ready = 'return typeof DB !== "undefined" && !!DB.data && Object.keys(DB.data.lots || {}).length > 0;' } = {}) {
    const before = new Set((await b.contexts()).map(c => c.context));
    await b.run(sitka, `document.querySelector('a.module-link[href*="${tool}"]').click();`, { user: true });
    let ctx = null;
    for (let i = 0; i < 60 && !ctx; i++) {
        await b.sleep(100);
        ctx = (await b.contexts()).find(c => !before.has(c.context) && c.url.includes(tool))?.context || null;
    }
    if (!ctx) throw new Error('tool window did not open: ' + tool);
    await b.waitFor(ctx, ready);
    return ctx;
}

export async function newTab(b, url) {
    const r = await b.send('browsingContext.create', { type: 'tab' });
    await b.navigate(r.context, url);
    return r.context;
}

export async function dwBuilding(b, dw, id) {
    await b.run(dw, `const s = document.getElementById('buildingSelect'); if (!s.disabled) { s.value = ${JSON.stringify(id)}; s.dispatchEvent(new Event('change')); }`);
}

export async function dwDate(b, dw, day) {
    await b.run(dw, `const d = document.getElementById('dateInput'); d.value = ${JSON.stringify(day)}; d.dispatchEvent(new Event('change')); d.dispatchEvent(new Event('input'));`);
}

// The ⏱ button text on the DailyWizard row whose text includes `rowMatch`
export async function dwButton(b, dw, rowMatch) {
    return b.run(dw, `
        const rows = [...document.querySelectorAll('#listContainer *')].filter(el => el.querySelector(':scope > .hours-btn'));
        return rows.find(r => r.textContent.includes(${JSON.stringify(rowMatch)}))?.querySelector(':scope > .hours-btn')?.textContent || null;`);
}

// In DailyWizard: open a row's hours view, fill it in, draw initials with the pointer, press Add hours
export async function logHours(b, dw, rowMatch, who, h, m, { temp = null } = {}) {
    const opened = await b.run(dw, `
        const rows = [...document.querySelectorAll('#listContainer *')].filter(el => el.querySelector(':scope > .hours-btn'));
        const row = rows.find(r => r.textContent.includes(${JSON.stringify(rowMatch)}));
        if (!row) return 'no row';
        const btn = row.querySelector(':scope > .hours-btn');
        if (btn.disabled) return 'disabled';
        btn.click();
        return document.getElementById('hoursOverlay').classList.contains('open') ? 'open' : 'not open';`, { user: true });
    if (opened !== 'open') return { ok: false, toast: opened, strokes: 0 };
    await b.run(dw, `
        const who = document.getElementById('hoursWho');
        who.value = ${JSON.stringify(temp ? '__other' : who)};
        who.dispatchEvent(new Event('change', { bubbles: true }));
        ${temp ? `document.getElementById('hoursOther').value = ${JSON.stringify(temp)};` : ''}
        document.getElementById('hoursH').value = '${h}';
        document.getElementById('hoursM').value = '${m}';`);
    await b.drag(dw, '#hoursPad', [[0.2, 0.7], [0.25, 0.3], [0.3, 0.7], [0.35, 0.3]]);
    await b.drag(dw, '#hoursPad', [[0.5, 0.3], [0.5, 0.7]]);
    const strokes = await b.run(dw, 'return padStrokes.length;');
    await b.run(dw, `document.getElementById('hoursAddBtn').click();`, { user: true });
    const toast = await b.run(dw, `return document.querySelector('.toast, #toast')?.textContent || '';`);
    await b.run(dw, 'closeHours();');
    return { ok: strokes === 2 && toast.startsWith('Logged'), toast, strokes };
}

// In DailyWizard: remove entry `index` from a row's hours view, approved with a floor manager's PIN
export async function removeHoursEntry(b, dw, rowMatch, index, { fm = 'Casey', pin = FM_PIN } = {}) {
    await b.run(dw, `
        const rows = [...document.querySelectorAll('#listContainer *')].filter(el => el.querySelector(':scope > .hours-btn'));
        rows.find(r => r.textContent.includes(${JSON.stringify(rowMatch)})).querySelector(':scope > .hours-btn').click();`, { user: true });
    const res = await b.run(dw, `
        const dels = document.querySelectorAll('#hoursList .hours-del');
        if (!dels[${index}]) return 'no remove button';
        dels[${index}].click();
        return '';`, { user: true });
    if (res) { await b.run(dw, 'closeHours();'); return res; }
    await answerPin(b, dw, fm, pin);
    const toast = await b.run(dw, `return document.querySelector('.toast, #toast')?.textContent || '';`);
    await b.run(dw, 'closeHours();');
    return toast;
}

// Labour entries on an event / a chore, by name
export const evNames = (db, evId, day) => (db.calendarEvents.find(e => e.id === evId)?.labour_map?.[day] || []).map(e => e.employee || e.temp);
export const choreNames = (db, bid, code, day) => (db._DailyWizard?.buildings?.[bid]?.labour?.[day]?.[code] || []).map(e => e.employee || e.temp);

// In DailyWizard: remove the entry of `name` from a row's hours view, approved with a floor manager's PIN
export async function removeHoursOf(b, dw, rowMatch, name, { fm = 'Casey', pin = FM_PIN } = {}) {
    await b.run(dw, `
        const rows = [...document.querySelectorAll('#listContainer *')].filter(el => el.querySelector(':scope > .hours-btn'));
        rows.find(r => r.textContent.includes(${JSON.stringify(rowMatch)})).querySelector(':scope > .hours-btn').click();`, { user: true });
    const res = await b.run(dw, `
        const row = [...document.querySelectorAll('#hoursList .hours-entry')].find(r => !r.classList.contains('removed') && r.querySelector('.who')?.textContent.startsWith(${JSON.stringify(name)}));
        const del = row?.querySelector('.hours-del');
        if (!del) return 'no remove button';
        del.click();
        return '';`, { user: true });
    if (res) { await b.run(dw, 'closeHours();'); return res; }
    await answerPin(b, dw, fm, pin);
    const toast = await b.run(dw, `return document.querySelector('.toast, #toast')?.textContent || '';`);
    await b.run(dw, 'closeHours();');
    return toast;
}

// In EmployeeWizard's Tasks tab: set a roster employee's hours on a task day ("Add (or update)")
export async function ewSetHours(b, ew, lotId, evId, day, name, h, m) {
    return b.run(ew, `
        document.getElementById('tabTasks').click();
        const lot = document.getElementById('activeLot'); lot.value = ${JSON.stringify(lotId)}; lot.dispatchEvent(new Event('change'));
        TASK.selectedKey = ${JSON.stringify(evId)}; TASK.editDate = ${JSON.stringify(day)}; renderTasksTab();
        document.getElementById('lfEmpSelect').value = ${JSON.stringify(name)};
        document.getElementById('lfHours').value = '${h}'; document.getElementById('lfMinutes').value = '${m}';
        document.getElementById('lfAddBtn').click();
        return document.querySelector('.toast, #toast')?.textContent || '';`, { user: true });
}

// In DailyWizard: press ✍️ Mark done on a row, pick the floor manager, draw initials (unless `sign` is false), confirm
export async function markDone(b, dw, rowMatch, name, { sign = true } = {}) {
    const opened = await b.run(dw, `
        const rows = [...document.querySelectorAll('#listContainer *')].filter(el => el.querySelector(':scope > .done-btn'));
        const btn = rows.find(r => r.textContent.includes(${JSON.stringify(rowMatch)}))?.querySelector(':scope > .done-btn');
        if (!btn) return 'no row';
        if (btn.disabled) return 'disabled';
        btn.click();
        return document.getElementById('doneOverlay').classList.contains('open') ? 'open' : 'not open';`, { user: true });
    if (opened !== 'open') return { ok: false, toast: opened };
    const options = await b.run(dw, `const w = document.getElementById('doneWho'); w.value = ${JSON.stringify(name || '')}; return [...w.options].map(o => o.value).filter(Boolean);`);
    if (sign) await b.drag(dw, '#donePad', [[0.2, 0.3], [0.3, 0.7], [0.4, 0.3]]);
    await b.run(dw, `document.getElementById('doneBtn').click();`, { user: true });
    const toast = await b.run(dw, `return document.querySelector('.toast, #toast')?.textContent || '';`);
    const stillOpen = await b.run(dw, `return document.getElementById('doneOverlay').classList.contains('open');`);
    if (stillOpen) await b.run(dw, 'closeDone();');
    return { ok: toast.startsWith('Marked done'), toast, options };
}

// DailyWizard rows: the text of each row in the "⏰ Still open" section
export const dwStillOpen = (b, dw) => b.run(dw, `
    const out = []; let inOpen = false;
    for (const el of document.getElementById('listContainer').children) {
        if (el.classList.contains('section-divider')) { inOpen = el.classList.contains('overdue'); continue; }
        if (inOpen && el.classList.contains('task-row')) out.push(el.textContent);
    }
    return out;`);

// The ✅ / ✍️ button text on a DailyWizard row
export const dwDoneButton = (b, dw, rowMatch) => b.run(dw, `
    const rows = [...document.querySelectorAll('#listContainer *')].filter(el => el.querySelector(':scope > .done-btn'));
    return rows.find(r => r.textContent.includes(${JSON.stringify(rowMatch)}))?.querySelector(':scope > .done-btn')?.textContent || null;`);

// In DailyWizard: tap the tick box on the row whose text includes `rowMatch`; returns whether it's now ticked
export const dwTick = (b, dw, rowMatch) => b.run(dw, `
    const row = [...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes(${JSON.stringify(rowMatch)}));
    const cb = row?.querySelector('.task-check input');
    if (!cb) return null;
    cb.click();
    const again = [...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes(${JSON.stringify(rowMatch)}));
    return again.querySelector('.task-check input').checked;`, { user: true });
export const dwTicked = (b, dw, rowMatch) => b.run(dw, `
    const row = [...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes(${JSON.stringify(rowMatch)}));
    return row ? row.querySelector('.task-check input')?.checked === true && row.classList.contains('done') : null;`);
