// Money fixes from the 2026-10-25 review, on the cost-per-gram worked example:
// - C1: shared labour per gram is spread over every gram harvested, not only the crops whose hours are all priced;
// - C2: with power bills, days no bill covers make a crop's electricity missing, not $0; a closed-out lot frozen that
//   way takes a bill added later;
// - Q6 / C4: no hiding of $ built from fewer than 3 people (money is office only);
// - C5: no made-up $20/h — a missing wage shows as missing.
import { today, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';
import { costDb } from './cost-per-gram.test.mjs';

export const title = 'review fixes: shared labour over every gram, unbilled power days, no made-up wage';

const near = (a, b, eps = 1e-6) => a != null && Math.abs(a - b) < eps;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const D = n => today(-120 + n);
    const db = costDb();
    // A second crop, L200, harvested the same day with 10,000 g, whose one hour is a temp with no wage
    db.lots.L200 = { name: 'L200', strain: 'Test Kush', createdDate: D(0), cloningRoom: 'Clone 1', vegRoom: 'Veg 1', destRoom: 'Grow 1', currentRoom: 'Grow 1', plantCount: 100 };
    for (const [tt, n] of [['planting', 10], ['transplant', 20], ['flip', 30], ['harvest', 40], ['bucking', 45], ['weigh_ship', 50]])
        db.calendarEvents.push({ id: `ev_d${n}`, date: D(n), title: `T ${tt}`, sourceTool: 'CropLabourWizard', lotId: 'L200', taskType: tt, completed: true });
    db.calendarEvents.find(e => e.id === 'ev_d40').labour_map = { [D(40)]: [{ id: 'le_tmp0000001', temp: 'Pat', hours: 1 }] };
    db._PaperWizard.entries.L200 = { harvestlog: { instances: { [D(40)]: { header: { fw01: '10000' }, days: {} } } } };
    // Shared labour in the period: 10 h of equipment work by Alex ($20/h) = $200
    db.calendarEvents.push({ id: 'ev_eq1', date: D(35), title: '🔧 Filter change', sourceTool: 'EquipmentWizard', roomId: 'R1HL', taskType: 'equipment_maintenance',
        labour_map: { [D(35)]: [{ id: 'le_eq00000001', employee: 'Alex', hours: 10 }] } });

    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db);
    const ew = await openTool(b, main, 'EmployeeWizard');
    const agg = () => b.run(ew, `const M = rptModel(), cs = M.crops.filter(c => ['L100', 'L200'].includes(c.lotId));
        const a = rptAgg(M, cs, '2000-01-01', '2100-01-01');
        return { direct: a.direct, loaded: a.loaded, other: rptOtherCost(M, '2000-01-01', '2100-01-01'), n: cs.length };`);

    // ---- C1 ----
    let r = await agg();
    check('both crops are in the report', r.n === 2, r.n);
    check('direct labour: L100 only (L200 has an hour with no wage): $630 ÷ 10,000 g', near(r.direct, 0.063), r.direct);
    check('shared labour: $200, and the temp on L200 isn\'t shared labour', near(r.other?.cost, 200) && r.other.missing === 0, JSON.stringify(r.other));
    check('fully loaded: the $200 over all 20,000 g harvested ($0.073), not over L100\'s 10,000 g ($0.083)', near(r.loaded, 0.073), r.loaded);

    // A temp with no wage on the shared work (added before the Reports open: opening them freezes finished months)
    await b.run(main, `DB.data.calendarEvents.find(e => e.id === 'ev_eq1').labour_map['${D(35)}'].push({ id: 'le_eq00000002', temp: 'Sam', hours: 2 }); markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    r = await agg();
    check('shared hours with no wage are counted as missing, not priced', near(r.other?.cost, 200) && near(r.other.missing, 2), JSON.stringify(r.other));

    // ---- Q6 / C4: a cost from one person isn't hidden any more ----
    await b.run(main, `const e = DB.data.calendarEvents.find(e => e.lotId === 'L100' && e.taskType === 'harvest');
        e.labour_map[Object.keys(e.labour_map)[0]] = [{ id: 'le_one00000001', employee: 'Alex', hours: 30 }]; markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    r = await agg();
    check('one person\'s hours still give a labour $ on the office (30 h × $20 ÷ 10,000 g)', near(r.direct, 0.06), r.direct);
    await b.run(ew, `document.getElementById('tabReports').click();`, { user: true });
    await b.run(ew, `const p = document.getElementById('rptPeriod'); p.value = '12m'; p.dispatchEvent(new Event('change'));`);
    await b.run(ew, `document.querySelector('#rptPages button[data-page="labour"]').click();`, { user: true });
    const labourPage = await b.run(ew, `return document.getElementById('rptBody').innerText;`);
    check('the Labour page no longer hides the cost by phase for fewer than 3 people', !labourPage.includes('fewer than 3 people') && /fully loaded/.test(labourPage), labourPage.slice(0, 200));

    // ---- Shared hours with no wage are listed under What's missing ----
    await b.run(ew, `document.querySelector('#rptPages button[data-page="costs"]').click();`, { user: true });
    let page = await b.run(ew, `return document.getElementById('rptBody').innerText;`);
    check('What\'s missing: 2 h of shared labour with no wage', /\b2(\.0)? h of shared labour \(whole-building chores, equipment and other tasks\) have no wage/.test(page), page.match(/[^\n]*shared labour[^\n]*/)?.[0]);

    // ---- C2: power bills that don't cover every day ----
    // L100 and L200 are in Building 1 from D0 to D40 (41 days); the bill covers D0–D30 only
    await b.run(main, `const c = DB.data._EmployeeWizard.costs; c.electricity = 'bills';
        c.bills = [{ id: 'b1', buildingId: 'B1', from: '${D(0)}', to: '${D(30)}', amount: 3100 }]; markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    const power = (id) => b.run(ew, `const M = rptModel(), c = M.crops.find(c => c.lotId === '${id}'); return c ? rptCropInputCost(c, M).power : null;`);
    let p = await power('L100');
    const frozenBilled = p.billedCost;
    check('a crop with 10 days no bill covers: its electricity is missing, not the $ of the days billed', p.cost === null && p.unbilledDays === 10 && p.billedCost > 0, JSON.stringify({ cost: p.cost, un: p.unbilledDays, billed: p.billedCost }));
    await b.run(ew, `document.querySelector('#rptPages button[data-page="costs"]').click();`, { user: true });
    page = await b.run(ew, `return document.getElementById('rptBody').innerText;`);
    check('What\'s missing names the crops and the days with no bill', /No power bill covers some days of L100 \(10 days\), L200 \(10 days\)/.test(page), page.match(/[^\n]*No power bill covers[^\n]*/)?.[0]);
    check('…and the page has no NaN/undefined', !/NaN|undefined|Infinity/.test(page));

    // ---- C13: a live update never freezes overhead (a tool never answers one) ----
    await b.run(main, `delete DB.data._EmployeeWizard.overheadCosts; markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(800);
    check('a live update while the Reports are open freezes nothing', await b.run(main, `return !DB.data._EmployeeWizard.overheadCosts;`) && await b.run(ew, `return !DB.data._EmployeeWizard.overheadCosts;`));
    await b.run(ew, `document.querySelector('#rptPages button[data-page="overview"]').click();`, { user: true });
    await b.sleep(400);
    check('…the office\'s own redraw does, and tells SitkaTools', await b.run(main, `return !!DB.data._EmployeeWizard.overheadCosts && Object.keys(DB.data._EmployeeWizard.overheadCosts).length > 0;`));

    // Closed out while unbilled: frozen as missing; the bill added later reaches it
    await b.run(ew, `rptSaveSummaries([rptModel().crops.find(c => c.lotId === 'L100')]);`);
    await b.sleep(300);
    const frozen = await b.run(main, `return DB.data._EmployeeWizard.crops.L100.costs.power;`);
    check('with wages open, the labour cost is frozen with the summary (same save time)', await b.run(main, `const e = DB.data._EmployeeWizard; return !!e.cropCosts?.L100 && e.cropCosts.L100.savedAt === e.crops.L100.savedAt;`));
    check('the summary freezes the electricity as missing, with its unbilled days', frozen.cost === null && frozen.unbilledDays === 10, JSON.stringify(frozen));
    await b.run(main, `delete DB.data.lots.L100; DB.data.calendarEvents = DB.data.calendarEvents.filter(e => e.lotId !== 'L100');
        DB.data._EmployeeWizard.costs.bills.push({ id: 'b2', buildingId: 'B1', from: '${D(31)}', to: '${D(40)}', amount: 1000 }); markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    // C11: the summary saved again later without Wages.json (newer hours, newer savedAt): the old frozen cost doesn't count
    const lab = () => b.run(ew, `const M = rptModel(), c = M.crops.find(c => c.lotId === 'L100'); const k = rptCropCost(c); return k && { cost: k.cost, frozen: !!k.frozen };`);
    check('closed out: labour uses the frozen cost', (await lab())?.frozen === true, JSON.stringify(await lab()));
    await b.run(main, `DB.data._EmployeeWizard.crops.L100.savedAt = new Date(Date.now() + 60000).toISOString(); markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    check('a summary saved again without wages: the older frozen cost isn\'t used against its hours', (await lab())?.frozen === false, JSON.stringify(await lab()));
    p = await power('L100');
    check('closed out, the bill added later is charged to it (shared with L200, which is in the building those days)', p.cost != null && p.cost > frozenBilled + 1 && p.cost < frozenBilled + 999 && !p.unbilledDays, JSON.stringify({ cost: p.cost, un: p.unbilledDays, before: frozenBilled }));

    // ---- C5: no made-up wage in the Tasks tab ----
    await b.run(main, `delete DB.data._EmployeeWizard.employees.Blair.wage;
        DB.data.calendarEvents.find(e => e.id === 'ev_d40').labour_map['${D(40)}'] = [{ id: 'le_bl00000001', employee: 'Blair', hours: 2 }]; markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    await b.run(ew, `document.getElementById('tabTasks').click();`, { user: true });
    await b.run(ew, `const s = document.getElementById('activeLot'); s.value = 'L200'; s.dispatchEvent(new Event('change'));`);
    await b.sleep(200);
    await b.run(ew, `const old = document.getElementById('showOldTasksChk'); if (old && !old.checked) old.click();`, { user: true });
    await b.sleep(200);
    await b.run(ew, `const row = [...document.querySelectorAll('.task-line[data-key]')].find(r => r.dataset.key === 'ev_d40'); row?.click();`, { user: true });
    await b.sleep(300);
    const totals = await b.run(ew, `return (document.getElementById('teTaskTotal')?.textContent || '') + ' | ' + (document.getElementById('lfTempWage')?.value ?? 'none');`);
    check('a total with a wage missing shows hours and "$ — a wage is missing", never $40 at a made-up $20/h', totals.includes('2h') && totals.includes('a wage is missing') && !totals.includes('$40'), totals);
    check('the temp wage box starts blank', totals.endsWith('| '), totals);

    // ---- C9: a renamed employee keeps their old name, so hours logged under it elsewhere keep their wage ----
    await b.run(main, `const bl = DB.data._DailyWizard = DB.data._DailyWizard || {}; bl.buildings = bl.buildings || {};
        const b1 = bl.buildings.B1 = bl.buildings.B1 || { tasks: [] }; b1.labour = { '${D(36)}': { misc: [{ id: 'le_dw00000001', employee: 'Alex', hours: 3, note: 'sweeping' }] } };
        markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    await b.run(ew, `document.getElementById('tabEmployees').click(); selectEmployee('Alex'); document.getElementById('empNameInput').value = 'Alexandra';
        document.getElementById('saveEmpBtn').click(); await new Promise(r => setTimeout(r, 300));`, { user: true });
    const emp = await b.run(main, `return DB.data._EmployeeWizard.employees.Alexandra || null;`);
    check('renaming keeps the former name', emp?.formerNames?.join() === 'Alex' && !(await b.run(main, `return !!DB.data._EmployeeWizard.employees.Alex;`)), JSON.stringify(emp));
    const misc = await b.run(ew, `const M = rptModel(); return M.otherAll.filter(r => r.date === '${D(36)}' && r.person === 'Alex').map(r => Number(employeeByName(r.person)?.wage));`);
    check('DailyWizard hours logged as "Alex" still find the wage ($20)', misc.join() === '20', JSON.stringify(misc));
    await b.run(ew, `document.getElementById('newEmpName').value = 'Alex'; document.getElementById('addEmpForm').dispatchEvent(new Event('submit', { cancelable: true }));`);
    check('a new employee can\'t take someone\'s former name', !(await b.run(main, `return !!DB.data._EmployeeWizard.employees.Alex;`)));
    const dlg = await b.run(ew, `let msg = ''; const c = window.confirm; window.confirm = m => { msg = m; return false; }; deleteEmployee('Alexandra'); window.confirm = c; return msg;`);
    check('deleting an employee with hours says they stay on record with no wage', /has \d+h( \d+m)? of hours logged\. They stay on record under their name, but with no wage/.test(dlg), dlg);

    // ---- C6: a room chore logged after a closed-out lot's summary was saved isn't lost ----
    // Grow 1 gets a room chore, and 4 h on it on D25 (L200 is there; so was L100, closed out before these hours came in)
    await b.run(main, `const b1 = DB.data._DailyWizard.buildings.B1; b1.tasks = [{ code: 'gr1c', emoji: '🧽', name: 'Wipe Grow 1', minutes: 30, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], monthDays: [], steps: [], roomId: 'R1G1' }];
        b1.labour['${D(25)}'] = { gr1c: [{ id: 'le_gr00000001', employee: 'Blair', hours: 4 }] }; markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    const ch = await b.run(ew, `const M = rptModel(), r = M.otherAll.find(r => r.entryKey === 'le_gr00000001'); const l2 = M.crops.find(c => c.lotId === 'L200');
        return { shared: r ? r.hours : null, l200: l2?.labour?.chores?.['B1:gr1c']?.act ?? null, l100carries: M.crops.find(c => c.lotId === 'L100')?.labour?.choreEntries };`);
    check('the closed-out lot\'s summary lists the room-chore entries it carries (none)', Array.isArray(ch.l100carries) && ch.l100carries.length === 0, JSON.stringify(ch));
    check('L200 gets its half; L100\'s half stays in the shared labour instead of vanishing', ch.l200 === 2 && ch.shared === 2, JSON.stringify(ch));

    // ---- C7: that month frozen when nobody was in Grow 1 that day (all 4 h shared, $80); now L200 carries 2 h ----
    const ov = await b.run(main, `const ym = '${D(25)}'.slice(0, 7), oc = DB.data._EmployeeWizard.overheadCosts || (DB.data._EmployeeWizard.overheadCosts = {});
        oc[ym] = { frozenAt: new Date().toISOString(), rows: [['${D(25)}', 'B1', 'R1G1', 'chore', 4, 80, 0]] }; markUnsaved(); await WorkCopy.flush(); return ym;`);
    await b.sleep(600);
    const oc = await b.run(ew, `const M = rptModel(); return rptOtherCost(M, '${D(25)}', '${D(25)}');`);
    check('a frozen room chore that a crop now carries counts only for the hours still shared ($80 × 2 h / 4 h), not twice', Math.abs(oc.cost - 40) < 1e-6, JSON.stringify(oc));

    // ---- C12: the Forecast counts a room chore only on days its room is planned to hold a crop ----
    let wks = await b.run(ew, `return rptDemandWeeks(rptModel()).map(w => w.chores);`);
    check('Forecast: Wipe Grow 1 isn\'t counted while Grow 1 is empty', wks.every(h => h === 0), JSON.stringify(wks));
    // A projected lot is in its room from its transplant to its harvest's last day (rptProjectedStays, as the room Gantt draws it)
    await b.run(main, `DB.data.calendarEvents.push({ id: 'ev_proj0', date: '${today(14)}', title: 'Projected', sourceTool: 'CropProjection', lotId: 'R1G1-TBA-01', roomId: 'R1G1', taskType: 'transplant' },
        { id: 'ev_proj1', date: '${today(26)}', endDate: '${today(27)}', title: 'Projected', sourceTool: 'CropProjection', lotId: 'R1G1-TBA-01', roomId: 'R1G1', taskType: 'harvest' });
        markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    wks = await b.run(ew, `return rptDemandWeeks(rptModel()).map(w => w.chores);`);
    check('…and is, half an hour a day, while a projected lot is planned there (14 days)', Math.abs(wks.reduce((t, h) => t + h, 0) - 7) < 1e-9, JSON.stringify(wks));

    // ---- C12: one "where a lot is": the room Gantt and g / sq ft / year use the stays the costs use ----
    // A crop scheduled into Grow 1 on day 20, whose grow log kept it in Veg 1 to day 22, then Grow 2, then Grow 1 from day 40
    const g12 = await b.run(ew, `DB.data.rooms.R1G2 = { name: 'Grow 2', createdDate: '2026-01-01', assignedLots: [], buildingId: 'B1', isFlowering: true };
        const D = n => dAdd('${D(0)}', n);
        const c = { lotId: 'LX', strain: 'S', dates: { day0: D(0), planting: D(10), transplant: D(20), flip: D(24), harvestStart: D(60), harvestEnd: D(60), tankClean: D(62) },
            rooms: { cloning: 'Clone 1', veg: 'Veg 1', flower: 'Grow 1' },
            ctls: { logged: true, start: 100, counts: [[D(20), 100, 'Veg 1', 'Vegetation'], [D(23), 100, 'Grow 2', 'Bloom'], [D(40), 100, 'Grow 1', 'Bloom'], [D(60), 0, 'Grow 1', 'Harvesting']] } };
        const costs = rptCropRoomDays(c).map(st => st.roomId + ':' + daysBetween(D(0), st.from) + '-' + daysBetween(D(0), st.to) + ':' + st.phase).join(' ');
        const gantt = rptStays({ crops: [c] }).filter(st => st.lotId === 'LX').map(st => st.room + ':' + daysBetween(D(0), st.from) + '-' + daysBetween(D(0), st.to) + ':' + st.ph).join(' ');
        const gaps = rptFlowerGaps(rptStays({ crops: [c] }).filter(st => st.lotId === 'LX')).length;
        const held = rptFlowerHeldDays(c);
        delete DB.data.rooms.R1G2;
        return { costs, gantt, gaps, held };
        function daysBetween(a, b) { return dDiff(a, b); }`);
    check('C12: the room Gantt draws a crop where the costs put it (the grow log\'s rooms)', g12.gantt === g12.costs && g12.gantt === 'R1CL:0-9:clone R1VG:10-19:veg R1VG:20-22:veg R1G2:23-39:flower R1G1:40-60:flower', JSON.stringify(g12));
    check('…the room it moved out of isn\'t held until the clean, so no gap is drawn', g12.gaps === 0, JSON.stringify(g12));
    check('…and g / sq ft / year counts the days it held a flower room: 17 in Grow 2 + 21 in Grow 1 + 2 to clean (not 43 from the schedule)', g12.held === 40, JSON.stringify(g12));

    // ---- C15: a month back from the 31st stays in the month ----
    check('Mar 31 − 1 month is Feb 28 (periods start on the 1st, not the 4th)', await b.run(ew, `return dMonths('2026-03-31', -1) + ' ' + dMonths('2026-05-31', -3);`) === '2026-02-28 2026-02-28');

    // ---- C3 / C15: the CTLS month flags closed-out lots it can't count right ----
    const ym = today().slice(0, 7), M0 = `${ym}-01`;
    const day = n => { const [y, m] = ym.split('-').map(Number); return `${ym}-${String(n).padStart(2, '0')}`; };
    await b.run(main, `const crops = DB.data._EmployeeWizard.crops = DB.data._EmployeeWizard.crops || {};
        // Saved while it still had 50 plants, then closed out
        crops.LS = { version: 4, savedAt: '${D(0)}T12:00:00.000Z', strain: 'Stale Kush', dates: {}, ctls: { v: 1, type: 'new-lot', created: '${D(0)}', start: 50, counts: [['${D(0)}', 50, 'Grow 1', 'Bloom']], moves: [], wet: [], dry: [] } };
        // Wet 100 g, dry 10 g, then 50 g more wet after the dry weight, all this month
        crops.LW = { version: 4, savedAt: new Date().toISOString(), strain: 'Wet Kush', dates: {}, ctls: { v: 1, type: 'new-lot', created: '${D(0)}', start: 0, counts: [], moves: [], wet: [['${M0}', 100], ['${day(3)}', 50]], dry: [['${day(2)}', 10]] } };
        DB.data._closedLots = { LN: { closedAt: new Date().toISOString(), archive: 'Archive/Lot-LN.json', by: 'office' } };
        markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    const C = await b.run(ew, `const C = ctlsModel('${ym}'); return { checks: C.checks.map(c => c.text), wetIn: C.wetIn.filter(r => r.lotId === 'LW').map(r => r.g), out: C.wetOut.filter(r => r.lotId === 'LW').map(r => r.wet) };`);
    check('CTLS flags a closed-out lot whose saved history still has plants', C.checks.some(t => /Closed-out lot .*LS \(50 plants\).* still ha(s|ve) plants or wet weight/.test(t)), C.checks.join(' / '));
    check('…and a closed-out lot with no summary at all', C.checks.some(t => t.includes('Closed-out lot LN has no saved summary')), C.checks.join(' / '));
    check('wet weight after the dry weight in the same month isn\'t counted in or out', C.wetIn.join() === '100' && C.out.join() === '100' && C.checks.some(t => t.includes('Wet weight recorded after the lot\'s dry weight (not counted): lot LW')), JSON.stringify(C));
    check('…and the month still adds up', !C.checks.some(t => t.includes("don't add up")), C.checks.join(' / '));

    await leave(b, ew); await b.send('browsingContext.close', { context: ew });
    await leave(b, main);
    return results;
}
