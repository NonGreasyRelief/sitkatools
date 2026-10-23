// Grow-log phase / room changes recorded on an edited day: the log is struck on that day and a new page starts that
// day — on the newest day, on an earlier day (re-paging the days after it), on a page's only day (it switches in
// place), and when a change is moved earlier, taken back (the pages rejoin), or re-paged up to a later change (which
// is never overwritten). Cancel at the correction pad puts every page back.
import { today, fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';

export const title = 'grow-log strike-outs when a day is edited to change the phase or room';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const D = n => today(-20 + n);   // D(0) … D(20) = today
    const q = (id, label, type, extra = {}) => ({ id, label, type, options: [], rowScoped: true, sameAsLast: false, mandatory: false, prefillFrom: null, ...extra });
    const box = (id, x, y, more = {}) => ({ id, label: id, x, y, w: 0.12, h: 0.03, page: 1, fontSize: 10, align: 'left',
        source: null, questionId: null, day: 1, dayGroup: null, checkbox: false, checkValue: '', ...more });
    const fields = [];
    for (let d = 1; d <= 7; d++) {
        const y = 0.2 + (d - 1) * 0.06, g = { dayGroup: 'gday', day: d };
        fields.push(box('ph' + d, 0.1, y, { ...g, questionId: 'phs' }), box('rm' + d, 0.3, y, { ...g, questionId: 'rmq' }), box('tp' + d, 0.5, y, { ...g, questionId: 'tmp' }));
    }
    const mkDb = () => {
        const db = fixtureDb();
        db.lots.L100.stage = 'veg';
        db.lots.L100.createdDate = D(0);
        db.rooms.R1VG = { name: 'Veg 1', createdDate: '2026-01-01', assignedLots: [], buildingId: 'B1' };
        db._PaperWizard = {
            sheets: { glog: { name: 'Grow Log', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'daily-weekly', document: 'grow-log', fields, signature: null } },
            wizards: { wg: { sheetId: 'glog', name: 'Grow Log', questions: [q('phs', 'Phase', 'phase'), q('rmq', 'Room', 'room'), q('tmp', 'Temp', 'number')] } },
            entries: {}
        };
        return db;
    };
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    const pw0 = { ctx: null };
    const reset = async () => {
        await loadSingle(b, main, mkDb());
        if (pw0.ctx) { await leave(b, pw0.ctx); await b.send('browsingContext.close', { context: pw0.ctx }).catch(() => {}); }
        pw0.ctx = await openTool(b, main, 'PaperWizard');
        await b.run(pw0.ctx, `window.confirm = () => true;`);
        return pw0.ctx;
    };
    let pw = await reset();
    // Save a day: the page holding it (or a new one), the given answers, then answer the strike pad if it opens
    const save = async (day, vals, { strike = true } = {}) => {
        await b.run(pw, `const chain = dailyChain('L100', 'glog');
            const holder = chain.filter(c => c.key <= '${day}' && '${day}' <= addDaysStr(c.key, 6) && !(c.inst.phaseChangeDate && '${day}' > c.inst.phaseChangeDate)).pop();
            const key = holder ? holder.key : '${day}';
            await openRunner('L100', 'glog', key, '${day}');
            Object.assign(runnerCtx.draft, ${JSON.stringify(vals)});
            runnerCtx.idx = runnerSteps('glog').length - 1; renderRunner();
            document.getElementById('wizSaveBtn').click();`, { user: true });
        await b.sleep(250);
        if (strike && await b.run(pw, `return !!document.getElementById('strikePad');`)) {
            await b.drag(pw, '#strikePad', [[0.2, 0.5], [0.8, 0.5]]);
            await b.run(pw, `document.getElementById('strikeName').value = 'AB'; document.getElementById('strikeOkBtn').click();`, { user: true });
            await b.sleep(250);
        }
        await b.run(pw, `if (runnerCtx) closeRunner(); document.querySelectorAll('.wiz-overlay, .strike-overlay').forEach(o => o.remove());`);
    };
    const pages = () => b.run(pw, `return dailyChain('L100', 'glog').map(c => ({ key: c.key, phase: c.inst.phase, room: c.inst.room, end: c.inst.phaseChangeDate,
        days: Object.keys(c.inst.days).sort().map(d => d.slice(5) + ':' + (c.inst.days[d].phs || '-') + '/' + (c.inst.days[d].rmq || '-')) }));`);
    const lot = () => b.run(pw, `return { stage: DB.lots.L100.stage, room: DB.lots.L100.currentRoom };`);
    const show = p => p.map(x => `${x.key.slice(5)}[${x.phase}/${x.room}${x.end ? ' ✂' + x.end.slice(5) : ''}] ${x.days.join(' ')}`).join(' ‖ ');
    const V = { phs: 'Vegetation', rmq: 'Grow 1', tmp: '24' }, B = { ...V, phs: 'Bloom' };

    // 1. A page's only day, saved, then reopened and changed to Bloom (normal path, not a backfill)
    await save(D(0), V);
    await save(D(0), B);
    let p = await pages();
    check('1. first day of a page, edited to Bloom: that page becomes Bloom from that day', p.length === 1 && p[0].phase === 'Bloom' && !p[0].end, show(p));

    // 2. Newest day mid-page edited (normal path)
    pw = await reset();
    for (const d of [0, 1, 2]) await save(D(d), V);
    await save(D(2), B);
    p = await pages();
    check('2. newest day edited to Bloom: page 1 struck on it, page 2 Bloom from it', p.length === 2 && p[0].end === D(2) && p[1].key === D(2) && p[1].phase === 'Bloom', show(p));

    // 3. Backfill: a middle day of the newest page
    pw = await reset();
    for (const d of [0, 1, 2, 3, 4]) await save(D(d), V);
    await save(D(2), B);
    p = await pages();
    check('3. middle day edited to Bloom: struck there, later days moved to a Bloom page', p.length === 2 && p[0].end === D(2) && p[1].key === D(2) && p[1].phase === 'Bloom' && p[1].days.length === 3, show(p));
    check('3. lot follows', (await lot()).stage === 'flower', JSON.stringify(await lot()));

    // 4. Backfill across weeks: page 1 full, page 2 started; edit a day on page 1
    pw = await reset();
    for (let d = 0; d <= 9; d++) await save(D(d), V);
    await save(D(4), B);
    p = await pages();
    check('4. day on an older full page edited to Bloom: struck there, days re-paged under Bloom', p[0].end === D(4) && p.slice(1).every(x => x.phase === 'Bloom') && p.slice(1).flatMap(x => x.days).length === 6, show(p));

    // 5. First day of a later week page, with later days, edited (backfill, day === key)
    pw = await reset();
    for (let d = 0; d <= 9; d++) await save(D(d), V);
    await save(D(7), B);
    p = await pages();
    check('5. first day of page 2 edited to Bloom: page 2 switches in place', p.length === 2 && !p[0].end && p[1].key === D(7) && p[1].phase === 'Bloom', show(p));

    // 6. Re-page that ends next to a later page with its own change (the boundary case)
    pw = await reset();
    for (let d = 0; d <= 11; d++) await save(D(d), V);
    await save(D(12), B);                          // Bloom from D12 (page 2 struck on D12)
    await save(D(12), B);                          // the double entry on the new page
    await save(D(13), B);
    let before = show(await pages());
    await save(D(5), { ...V, rmq: 'Veg 1' });       // room change recorded late on D5
    p = await pages();
    const bloom = p.find(x => x.phase === 'Bloom');
    check('6. a late room change re-pages up to the later phase change and keeps it', !!bloom && bloom.key === D(12) && bloom.days.length >= 2, `before: ${before}\nafter: ${show(p)}`);

    // 7. Room change via backfill
    pw = await reset();
    for (const d of [0, 1, 2, 3]) await save(D(d), V);
    await save(D(1), { ...V, rmq: 'Veg 1' });
    p = await pages();
    check('7. room change on an earlier day: struck there, later days in the new room', p.length === 2 && p[0].end === D(1) && p[1].room === 'Veg 1' && (await lot()).room === 'Veg 1', show(p));

    // 8. Move a change earlier: Bloom was recorded on D4, it really happened on D2
    pw = await reset();
    for (const d of [0, 1, 2, 3]) await save(D(d), V);
    await save(D(4), B); await save(D(4), B); await save(D(5), B);
    before = show(await pages());
    await save(D(2), B);
    p = await pages();
    check('8. change moved earlier (D4 → D2): one strike on D2, Bloom from D2 with every later day', p.length === 2 && p[0].end === D(2) && p[1].key === D(2) && p[1].days.length === 4 && p[1].days.every(x => x.includes('Bloom')), `before: ${before}\nafter: ${show(p)}`);

    // 9. Change to something other than the later page's value (Mother on D2, Bloom from D4): stops before it, no overlap
    pw = await reset();
    for (const d of [0, 1, 2, 3]) await save(D(d), V);
    await save(D(4), B); await save(D(4), B); await save(D(5), B);
    before = show(await pages());
    await save(D(2), { ...V, phs: 'Mother' });
    p = await pages();
    check('9. a different change before a later one: Mother D2–D4, Bloom page untouched', p.some(x => x.phase === 'Mother' && x.key === D(2) && x.end === D(4)) && p.some(x => x.phase === 'Bloom' && x.key === D(4) && x.days.length === 2), `before: ${before}\nafter: ${show(p)}`);

    // 10. Week-2 page with only its first day saved, reopened and changed (the same as 1 on a later page)
    pw = await reset();
    for (let d = 0; d <= 7; d++) await save(D(d), V);
    await save(D(7), B);
    p = await pages();
    check('10. week 2\'s only day edited to Bloom: week 2 becomes Bloom from that day', p.length === 2 && !p[0].end && p[1].key === D(7) && p[1].phase === 'Bloom' && p[1].days[0].includes('Bloom'), show(p));

    // 11. Undo: Bloom recorded on D2 by mistake, then the new page's D2 set back to Vegetation
    pw = await reset();
    for (const d of [0, 1]) await save(D(d), V);
    await save(D(2), B); await save(D(2), B);
    before = show(await pages());
    await save(D(2), V);
    p = await pages();
    check('11. undoing the change on the new page puts the log back to one Vegetation page', p.length === 1 && !p[0].end && p[0].phase === 'Vegetation', `before: ${before}\nafter: ${show(p)}`);

    // 12. An on-file day (initials drawn) re-paged, then Cancel at the correction pad: everything back as it was
    pw = await reset();
    await b.run(pw, `DB.paperWizard.wizards.wg.questions.push({ id: 'ini', label: 'Initials', type: 'initials', options: [], rowScoped: true, sameAsLast: false, mandatory: false, prefillFrom: null });`);
    const pen = { ini: { name: 'AB', strokes: [[0.2, 0.6, 0.5, 0.2]] } };
    for (const d of [0, 1, 2, 3]) await save(D(d), { ...V, ...pen });
    before = show(await pages());
    await b.run(pw, `const chain = dailyChain('L100', 'glog'); await openRunner('L100', 'glog', chain[0].key, '${D(1)}');
        Object.assign(runnerCtx.draft, ${JSON.stringify(B)}); runnerCtx.idx = runnerSteps('glog').length - 1; renderRunner();
        document.getElementById('wizSaveBtn').click();`, { user: true });
    await b.sleep(250);
    await b.drag(pw, '#strikePad', [[0.2, 0.5], [0.8, 0.5]]);
    await b.run(pw, `document.getElementById('strikeName').value = 'AB'; document.getElementById('strikeOkBtn').click();`, { user: true });
    await b.sleep(300);
    const padOpen = await b.run(pw, `return !!document.getElementById('corrOverlay');`);
    await b.run(pw, `document.getElementById('corrCancelBtn')?.click();`, { user: true });
    await b.sleep(250);
    await b.run(pw, `if (runnerCtx) closeRunner();`);
    p = await pages();
    check('12. Cancel at the correction pad after a re-page puts every page back', padOpen && show(p) === before && (await lot()).stage === 'veg', `pad: ${padOpen}\nbefore: ${before}\nafter: ${show(p)} ${JSON.stringify(await lot())}`);

    // 13. Undo on the re-page path: the new page has later days
    pw = await reset();
    for (const d of [0, 1]) await save(D(d), V);
    await save(D(2), B); await save(D(2), B); await save(D(3), B); await save(D(4), B);
    before = show(await pages());
    await save(D(2), V);
    p = await pages();
    check('13. undo with later days: one Vegetation page again, every day kept', p.length === 1 && !p[0].end && p[0].phase === 'Vegetation' && p[0].days.length === 5 && p[0].days.every(x => x.includes('Vegetation'))
        && (await lot()).stage === 'veg', `before: ${before}\nafter: ${show(p)} ${JSON.stringify(await lot())}`);

    // 14. Undo where the days run past the old page's 7 days
    pw = await reset();
    for (const d of [0, 1, 2, 3, 4]) await save(D(d), V);
    await save(D(5), B); await save(D(5), B); for (const d of [6, 7, 8, 9]) await save(D(d), B);
    before = show(await pages());
    await save(D(5), V);
    p = await pages();
    check('14. undo past 7 days: page 1 runs D0–D6 unstruck, the rest on a Vegetation page from D7', p.length === 2 && !p[0].end && p[0].days.length === 7 && p[1].key === D(7) && p[1].phase === 'Vegetation' && p[1].days.length === 3,
        `before: ${before}\nafter: ${show(p)}`);

    // 15. Room undo
    pw = await reset();
    for (const d of [0, 1]) await save(D(d), V);
    await save(D(2), { ...V, rmq: 'Veg 1' }); await save(D(2), { ...V, rmq: 'Veg 1' });
    await save(D(2), V);
    p = await pages();
    check('15. room change taken back: one page in Grow 1', p.length === 1 && !p[0].end && p[0].room === 'Grow 1' && (await lot()).room === 'Grow 1', show(p));

    // 16. Phase and room both changed on an earlier day
    pw = await reset();
    for (const d of [0, 1, 2, 3]) await save(D(d), V);
    await save(D(1), { ...B, rmq: 'Veg 1' });
    p = await pages();
    check('16. phase and room changed on an earlier day: one strike, the new page carries both', p.length === 2 && p[0].end === D(1) && p[1].phase === 'Bloom' && p[1].room === 'Veg 1'
        && p[1].days.every(x => x.includes('Bloom/Veg 1')) && JSON.stringify(await lot()) === '{"stage":"flower","room":"Veg 1"}', show(p));

    await leave(b, pw); await b.send('browsingContext.close', { context: pw }).catch(() => {});
    await leave(b, main);
    return results;
}
