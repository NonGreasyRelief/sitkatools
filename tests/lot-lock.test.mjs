// 🔒 A lot with a grow log is locked to it: plant count, phase and room change only through PaperWizard. SitkaTools
// shows them read-only, won't delete the lot or remove its room, and closes it out only at 0 plants with finished
// grow logs. A changed count needs a reason (split by reason; added to the day's comments). A split lot takes only
// plants its parent's grow log recorded as moved. The harvest log records the phase and room after the grow log.
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, splitFiles, openSplit, openTool, answerCountReasons, leave } from './lib/helpers.mjs';

export const title = 'lots locked to their grow log (plant count, phase and room from PaperWizard)';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const D1 = today(-3), D2 = today(-2), D3 = today(-1), T = today();
    const db = fixtureDb();
    db.lots.L100.createdDate = D1;
    db.lots.L100.plantCount = 10;
    db.rooms.R1DR = { name: 'Dry 1', description: null, createdDate: '2026-01-01', assignedLots: [], isFlowering: false, buildingId: 'B1' };
    db.buildings.B1.assignedRooms.push('R1DR');
    const q = (id, label, type, extra = {}) => ({ id, label, type, options: [], rowScoped: false, sameAsLast: false, mandatory: false, prefillFrom: null, ...extra });
    const box = (id, x, y, more = {}) => ({ id, label: id, x, y, w: 0.12, h: 0.03, page: 1, fontSize: 10, align: 'left',
        source: null, questionId: null, day: 1, dayGroup: null, checkbox: false, checkValue: '', ...more });
    const dayFields = [];
    for (let d = 1; d <= 7; d++) {
        const y = 0.2 + (d - 1) * 0.06, g = { dayGroup: 'gday', day: d };
        dayFields.push(box('ct' + d, 0.1, y, { ...g, questionId: 'cnt' }), box('rm' + d, 0.25, y, { ...g, questionId: 'rmq' }),
            box('cm' + d, 0.4, y, { ...g, questionId: 'cmt', w: 0.3 }), box('in' + d, 0.75, y, { ...g, questionId: 'init', w: 0.15 }));
    }
    db._PaperWizard = {
        sheets: {
            glog: { name: 'Grow Log', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'daily-weekly', document: 'grow-log', fields: dayFields, signature: null },
            harv: { name: 'Harvest Log', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'event', document: 'harvest',
                fields: [box('h1', 0.1, 0.1, { questionId: 'hph1' }), box('h2', 0.1, 0.2, { questionId: 'hrm' }), box('h3', 0.1, 0.3, { questionId: 'hph2' })], signature: null }
        },
        wizards: {
            wg: { sheetId: 'glog', name: 'Grow Log', questions: [
                q('cnt', 'Plant count', 'plant-count', { rowScoped: true, prefillFrom: 'lot.plantCount' }),
                q('rmq', 'Room', 'room', { rowScoped: true }),
                q('cmt', 'Rationale / Comments', 'text', { rowScoped: true }),
                q('init', 'Initials', 'initials', { rowScoped: true })] },
            wh: { sheetId: 'harv', name: 'Harvest Log', questions: [q('hph1', 'Phase at harvest', 'phase'), q('hrm', 'Room', 'room'), q('hph2', 'Phase after trimming', 'phase')] }
        },
        entries: {}
    };
    let main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db);
    await b.run(main, `window.__alerts = []; window.alert = m => window.__alerts.push(m); window.confirm = () => true;`);
    const alerts = () => b.run(main, `const a = window.__alerts.slice(); window.__alerts = []; return a;`);
    const lotRow = (id) => b.run(main, `renderLotList(); const row = document.querySelector('.lot-item .lot-delete-btn[data-lot-id="${id}"]')?.closest('.lot-item');
        return { stage: !!row.querySelector('.lot-stage-select'), room: !!row.querySelector('.lot-currentroom-select'), count: !!row.querySelector('.plant-count-input'),
            chips: [...row.querySelectorAll('.lot-locked-chip')].map(c => c.textContent.trim()), del: row.querySelector('.lot-delete-btn').disabled,
            delTip: row.querySelector('.lot-delete-btn').title, planned: row.querySelectorAll('.lot-room-select').length };`);

    let r = await lotRow('L100');
    check('before a grow log: phase, current room and plant count are editable', r.stage && r.room && r.count && !r.chips.length && !r.del, JSON.stringify(r));

    // ---- PaperWizard: the first grow-log day locks the lot ----
    const pw = await openTool(b, main, 'PaperWizard');
    const pen = [[[0.2, 0.6], [0.5, 0.2], [0.8, 0.6]]];
    const day = async (d, vals) => {
        await b.run(pw, `await openRunner('L100', 'glog', '${D1}', '${d}'); Object.assign(runnerCtx.draft, ${JSON.stringify(vals)});
            runnerCtx.draft.init = { name: 'AB', strokes: ${JSON.stringify(pen)} }; runnerCtx.idx = runnerSteps('glog').length - 1; renderRunner();`);
        await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
        await b.sleep(150);
    };
    const reasonDlg = () => b.run(pw, `const ov = document.getElementById('countReasonOverlay'); return ov ? { title: ov.querySelector('.wiz-title').textContent, total: ov.querySelector('#reasonTotal')?.textContent || '' } : null;`);
    const page = () => b.run(pw, `return DB.paperWizard.entries.L100.glog.instances['${D1}'];`);
    await day(D1, { cnt: '10', rmq: 'Grow 1', cmt: '' });
    check('the first day at the lot\'s own count asks nothing', !(await reasonDlg()) && !!(await page())?.days?.[D1]);
    await b.sleep(400);
    r = await lotRow('L100');
    check('with a grow log, SitkaTools shows them read-only (🔒), not editable', !r.stage && !r.room && !r.count && r.chips.join(' | ') === '🔒 Flower | 🔒 📍 Grow 1 | 🔒 🌱 10', JSON.stringify(r));
    check('…its ✕ is off and says to close it out; the planned rooms stay editable', r.del && r.delTip.includes('Close it out') && r.planned === 5, JSON.stringify(r));
    r = await lotRow('L200');
    check('a lot with no grow log stays editable', r.stage && r.room && r.count && !r.del, JSON.stringify(r));

    // ---- Rooms holding a locked lot ----
    await b.run(main, `RoomManager.deleteRoom('R1G1');`);
    let al = await alerts();
    check('its room can\'t be deleted', al.length === 1 && al[0].includes('Room "Grow 1" can\'t be deleted') && (await b.run(main, `return !!DB.data.rooms.R1G1;`)), al.join());
    await b.run(main, `BuildingManager.assignRoomToBuilding('R1G1', 'B2');`);
    al = await alerts();
    check('…or moved to another building', al[0]?.includes('can\'t be moved to another building') && (await b.run(main, `return DB.data.rooms.R1G1.buildingId;`)) === 'B1', al.join());
    await b.run(main, `BuildingManager.deleteBuilding('B1');`);
    al = await alerts();
    check('…and its building can\'t be deleted', al[0]?.includes('taken out of its building') && (await b.run(main, `return !!DB.data.buildings.B1;`)), al.join());
    await b.run(main, `BuildingManager.assignRoomToBuilding('R1CL', 'B2'); BuildingManager.assignRoomToBuilding('R1CL', 'B1');`);
    check('a room with no locked lot still moves freely', !(await alerts()).length && (await b.run(main, `return DB.data.rooms.R1CL.buildingId;`)) === 'B1');

    // ---- A lower count asks how many left for each reason ----
    await day(D2, { cnt: '7', rmq: 'Grow 1', cmt: '' });
    let dl = await reasonDlg();
    check('a drop of 3 asks why, before anything is saved', dl?.title.startsWith('🌱 3 plants left the lot') && !(await page()).days[D2], JSON.stringify(dl));
    await b.run(pw, `const i = document.querySelector('.reason-n[data-r="culled"]'); i.value = '2'; i.dispatchEvent(new Event('input')); document.getElementById('reasonOk').click();`);
    dl = await reasonDlg();
    check('the reasons must add up to the drop', dl?.total === '2 of 3' && (await b.run(pw, `return document.getElementById('toast').textContent;`)) === 'The reasons must add up to 3', JSON.stringify(dl));
    await b.run(pw, `document.querySelector('.reason-name[data-r="sampled"]').click();`);
    dl = await reasonDlg();
    check('tapping a reason gives it the rest', dl?.total === '3 of 3', JSON.stringify(dl));
    await b.run(pw, `document.getElementById('reasonOk').click();`);
    await b.sleep(200);
    let pg = await page();
    check('saved: the reasons on the day and in its comments', JSON.stringify(pg.days[D2]._removed) === '{"culled":2,"sampled":1}' && pg.days[D2].cmt === '[Removed 3: 2 culled, 1 sampled]', JSON.stringify(pg.days[D2]));
    await b.sleep(400);
    check('SitkaTools follows the grow log (7 plants)', (await lotRow('L100')).chips.includes('🔒 🌱 7'));

    // Cancel saves nothing
    await day(D3, { cnt: '4', rmq: 'Grow 1', cmt: 'Thinned out' });
    await b.run(pw, `document.getElementById('reasonCancel').click();`);
    await b.sleep(150);
    check('Cancel saves nothing', !(await page()).days[D3] && (await b.run(pw, `return document.getElementById('toast').textContent;`)) === 'Nothing was saved — the change in plant count needs a reason');
    // Enter on the last answer saves; pressing it again while the dialog is up must not stack a second dialog
    await b.run(pw, `(document.getElementById('wizCtl') || document.getElementById('qInitName')).focus();`);
    await b.keys(pw, '\uE007');
    await b.sleep(250);
    await b.keys(pw, '\uE007');
    await b.sleep(250);
    const stack = await b.run(pw, `return { n: document.querySelectorAll('#countReasonOverlay').length, inDialog: !!document.activeElement?.closest('#countReasonOverlay') };`);
    check('Enter twice: one reasons dialog, and it has the keyboard (the screen no longer goes dark with a dead button)', stack.n === 1 && stack.inDialog, JSON.stringify(stack));
    await answerCountReasons(b, pw, { reason: 'moved' });
    pg = await page();
    check('3 plants moved to another lot, kept with the typed comment', pg.days[D3]._removed?.moved === 3 && pg.days[D3].cmt === 'Thinned out [Removed 3: 3 moved to another lot]', JSON.stringify(pg.days[D3]));
    await b.run(pw, `closeRunner();`);

    // ---- A split lot takes only plants the parent's grow log recorded as moved ----
    await b.sleep(400);
    const split = (id, n) => b.run(main, `const v = (el, x) => { const e = document.getElementById(el); e.value = x; e.dispatchEvent(new Event('change', { bubbles: true })); };
        v('lotType', 'split-lot'); v('parentLot', 'L100'); v('lotId', '${id}'); v('lotStrain', 'Test Kush'); v('destRoom', 'Grow 1'); v('startRoom', 'flower');
        document.getElementById('plantsTransferred').value = '${n}'; document.getElementById('plantCount').value = '${n}';
        document.getElementById('lotForm').requestSubmit(); return !!DB.data.lots['${id}'];`, { user: true });
    let made = await split('L101', 4);
    al = await alerts();
    check('a split of 4 is refused: the grow log recorded 3 moved', !made && al[0]?.includes('has 3 plants recorded as moved out'), al.join());
    made = await split('L101', 3);
    al = await alerts();
    check('a split of 3 is made', made && !al.some(a => a.includes('recorded as moved')), al.join());
    const rooms101 = await b.run(main, `const l = DB.data.lots.L101, p = DB.data.lots.L100; return { clone: l.cloningRoom, veg: l.vegRoom, pclone: p.cloningRoom, pveg: p.vegRoom };`);
    check('…with its parent\'s cloning and veg rooms (review E15)', rooms101.clone === rooms101.pclone && rooms101.veg === rooms101.pveg && !!rooms101.pclone, JSON.stringify(rooms101));
    made = await split('L102', 1);
    al = await alerts();
    check('…and then no more: those 3 are in the split', !made && al[0]?.includes('has 0 plants recorded as moved out'), al.join());

    // ---- A higher count asks why ----
    await b.run(pw, `await openRunner('L200', 'glog', '${D3}', '${D3}'); Object.assign(runnerCtx.draft, { cnt: '82', rmq: 'Grow A', cmt: '' });
        runnerCtx.draft.init = { name: 'AB', strokes: ${JSON.stringify(pen)} }; runnerCtx.idx = runnerSteps('glog').length - 1; renderRunner();`);
    await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
    dl = await reasonDlg();
    check('a higher count (80 → 82) asks why', dl?.title.startsWith('🌱 2 plants more than the last count (80 → 82)'), JSON.stringify(dl));
    await b.run(pw, `document.getElementById('reasonOk').click();`);
    check('…and needs a reason', !!(await reasonDlg()));
    await b.run(pw, `document.querySelector('.reason-chip').click(); document.getElementById('reasonOk').click();`);
    await b.sleep(200);
    const l200 = await b.run(pw, `return DB.paperWizard.entries.L200.glog.instances['${D3}'].days['${D3}'];`);
    check('saved with the reason, on the day and in its comments', l200._added?.n === 2 && l200.cmt === '[Added 2: recounted — the last count was wrong]', JSON.stringify(l200));

    // ---- Close out: not while plants are on record ----
    const closeOut = (id) => b.run(main, `const s = document.getElementById('lotActionSelect'); s.value = '${id}'; await LotActions.closeOut();
        return { archive: !!document.getElementById('archiveLink') };`, { user: true });
    let co = await closeOut('L100');
    al = await alerts();
    check('close-out is refused while 4 plants are on record, and the page isn\'t finished', !co.archive && al[0]?.includes('can\'t be closed out yet') && al[0].includes('🌱 4 plants are still on record') && al[0].includes('isn\'t complete'), al.join(' / '));

    // The last plants are harvested: the count goes to 0, the grow log ends (strike-out), the page is complete
    await day(T, { cnt: '0', rmq: 'Grow 1', cmt: '' });
    await answerCountReasons(b, pw, { reason: 'harvested' });
    await b.waitFor(pw, `return !!document.getElementById('strikePad');`);
    await b.drag(pw, '#strikePad', [[0.2, 0.5], [0.8, 0.5]]);
    await b.run(pw, `document.getElementById('strikeName').value = 'AB'; document.getElementById('strikeOkBtn').click();`, { user: true });
    await b.sleep(300);
    pg = await page();
    check('at 0 plants (4 harvested) the grow log ends and is complete', pg.days[T]._removed?.harvested === 4 && pg.phaseChangeDate === T && !!pg.completedAt, JSON.stringify({ end: pg.phaseChangeDate, done: pg.completedAt }));
    await b.run(pw, `closeRunner();`);

    // ---- The harvest log records the phase and room after the grow log ----
    const harvest = async (vals) => {
        await b.run(pw, `await openRunner('L100', 'harv', '${T}'); Object.assign(runnerCtx.draft, ${JSON.stringify(vals)}); runnerCtx.idx = runnerSteps('harv').length - 1; renderRunner();`);
        await b.run(pw, `document.getElementById('wizSaveBtn').click();`, { user: true });
        await b.sleep(250);
        return b.run(pw, `closeRunner(); return { stage: DB.lots.L100.stage, room: DB.lots.L100.currentRoom };`);
    };
    const phases = await b.run(pw, `await openRunner('L100', 'harv', '${T}'); runnerCtx.idx = 0; renderRunner();
        const o = [...document.querySelectorAll('#wizCtl option')].map(x => x.value).filter(Boolean); closeRunner(); return o;`);
    check('the harvest log\'s phase question offers Harvesting, Drying and Curing', phases.join() === 'Harvesting,Drying,Curing', phases.join());
    let lot = await harvest({ hph1: 'Drying', hrm: 'Dry 1', hph2: '' });
    check('the harvest log moves the lot to Drying, in Dry 1', lot.stage === 'drying' && lot.room === 'Dry 1', JSON.stringify(lot));
    lot = await harvest({ hph2: 'Curing' });
    check('…and its later page to Curing (the last phase answered)', lot.stage === 'curing' && lot.room === 'Dry 1', JSON.stringify(lot));
    await b.sleep(400);
    check('SitkaTools shows the lot in Dry 1, curing, 0 plants', (await lotRow('L100')).chips.join(' | ') === '🔒 Curing | 🔒 📍 Dry 1 | 🔒 🌱 0');

    // ---- Close out: at 0 plants with finished grow logs ----
    co = await closeOut('L100');
    al = await alerts();
    check('now close-out goes ahead (the archive link is offered)', co.archive && !al.some(a => a.includes('can\'t be closed out')), al.join(' / '));
    const single = await b.run(pw, `return pickableRoomNames(currentLotRoom('L200')).includes('Grow 1');`);
    check('one DB file: the office\'s Room question offers every building\'s rooms', single);
    await leave(b, pw); await b.send('browsingContext.close', { context: pw });
    await leave(b, main);

    // ---- Split files on the office: the Room question keeps a lot in its building ----
    main = await fresh(b);
    const files = await splitFiles(b, main, BASE, db);
    await openSplit(b, main, BASE, 'office', files);
    const pw2 = await openTool(b, main, 'PaperWizard');
    const rooms = await b.run(pw2, `const sheet = Object.keys(DB.paperWizard.sheets).find(id => DB.paperWizard.sheets[id].cadence === 'daily-weekly');
        return { split: DeviceView.split, b1: pickableRoomNames(currentLotRoom('L100')).sort(), b2: pickableRoomNames(currentLotRoom('L200')).sort(),
            groups: roomChoiceGroups(sheet, currentLotRoom('L100')).map(g => [g.label, g.names]) };`);
    check('with split files the office\'s Start on a chosen day lists only the lot\'s building\'s rooms',
        rooms.split && rooms.b1.join() === 'Clone 1,Dry 1,Grow 1' && rooms.b2.join() === 'Grow A', JSON.stringify(rooms));
    check('…and the grow log\'s Room question lists them first, then the other building\'s under "🚚 Move to Building 2" (a move)',
        JSON.stringify(rooms.groups) === JSON.stringify([[null, ['Clone 1', 'Dry 1', 'Grow 1']], ['🚚 Move to Building 2', ['Grow A']]]), JSON.stringify(rooms.groups));
    await leave(b, pw2); await b.send('browsingContext.close', { context: pw2 });
    await leave(b, main);
    return results;
}
