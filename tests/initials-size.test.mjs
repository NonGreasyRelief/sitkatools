// Drawn initials are stored smaller (review H2, user decision 2026-10-26): when the pen lifts, the points that don't
// change the line's shape are dropped, so a long, straight-ish stroke keeps only its corners. DailyWizard's pads, the
// shared floor-manager PIN dialog and PaperWizard's pad all do it.
import { fixtureDb, withFloorManager, makeChecker, fresh, openSitka, loadSingle, openTool, dwBuilding, FM_PIN, leave } from './lib/helpers.mjs';

export const title = 'drawn initials are stored with fewer points';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, withFloorManager(fixtureDb()));
    const dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');

    // An L drawn with 60 pointer moves: down, then across
    const L = [];
    for (let i = 0; i <= 30; i++) L.push([0.2, 0.15 + i * 0.023]);
    for (let i = 1; i <= 30; i++) L.push([0.2 + i * 0.02, 0.84]);
    const opened = await b.run(dw, `const row = [...document.querySelectorAll('#listContainer .task-row')].find(r => r.textContent.includes('Room Tidy'));
        row.querySelector('.done-btn').click(); return document.getElementById('doneOverlay').classList.contains('open');`, { user: true });
    check('Mark done opens', opened);
    await b.run(dw, `document.getElementById('doneWho').value = 'Casey';`);
    await b.drag(dw, '#donePad', L);
    await b.run(dw, `document.getElementById('donePin').value = '${FM_PIN}'; document.getElementById('doneBtn').click();`, { user: true });
    await b.sleep(300);
    const st = await b.run(main, `return DB.data.calendarEvents.find(e => e.id === 'ev_oldb1').completedBy?.initials?.strokes || null;`);
    const pts = st?.[0] || [];
    check('the sign-off is saved', Array.isArray(st) && st.length === 1, JSON.stringify(st));
    check('a 61-point L is kept as a handful of points (its ends and the corner)', pts.length >= 6 && pts.length <= 12, `${pts.length / 2} points: ${JSON.stringify(pts)}`);
    const corner = [];
    for (let i = 0; i < pts.length; i += 2) corner.push([pts[i], pts[i + 1]]);
    check('…the corner is still there', corner.some(([x, y]) => Math.abs(x - corner[0][0]) < 0.02 && Math.abs(y - corner[corner.length - 1][1]) < 0.02), JSON.stringify(corner));

    // The same rule in the PIN dialog's code and PaperWizard's pad (points as [x, y], rounded to 3 decimals)
    const fp = await b.run(dw, `const line = []; for (let i = 0; i <= 50; i++) line.push(0.1 + i * 0.016, 0.5 + (i % 2) * 0.0005); return FloorPin.slimStroke(line).length / 2;`);
    check('the PIN dialog\'s simplifier keeps a near-straight line as its two ends', fp === 2, fp);
    await b.send('browsingContext.close', { context: dw });
    const pw = await openTool(b, main, 'PaperWizard');
    const ps = await b.run(pw, `const s = []; for (let i = 0; i <= 50; i++) s.push([0.1 + i * 0.0161234567, 0.3 + i * 0.0098765432]); s.push([0.95, 0.1]);
        const out = slimStroke(s); return { n: out.length, rounded: out.every(([x, y]) => String(x).length <= 5 && String(y).length <= 5) };`);
    check('PaperWizard\'s pad keeps a straight run and its turn (3 points), rounded to 3 decimals', ps.n === 3 && ps.rounded, JSON.stringify(ps));
    await leave(b, pw); await b.send('browsingContext.close', { context: pw });
    await leave(b, main);
    return results;
}
