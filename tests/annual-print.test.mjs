// 🖨️ Print year (SitkaTools, Annual view only): the year's tasks on one landscape page for a black-and-white printer,
// with a letter code per task type and a legend, and only the events the filters let through.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, leave } from './lib/helpers.mjs';

export const title = 'the annual calendar prints in black and white with the filters on';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const db = fixtureDb();
    const Y = 2027;
    db.calendarEvents.push(
        { id: 'ev_h1', date: `${Y}-03-05`, title: '🌾 Harvest A', sourceTool: 'CropLabourWizard', lotId: 'L100', taskType: 'harvest' },
        { id: 'ev_h2', date: `${Y}-03-05`, title: '🌾 Harvest B', sourceTool: 'CropLabourWizard', lotId: 'L200', taskType: 'harvest' },
        { id: 'ev_f1', date: `${Y}-02-01`, endDate: `${Y}-02-03`, title: '🌸 Flip', sourceTool: 'CropLabourWizard', lotId: 'L100', taskType: 'flip' },
        { id: 'ev_f2', date: `${Y}-05-10`, title: '🌸 Flip done', sourceTool: 'CropLabourWizard', lotId: 'L200', taskType: 'flip', completed: true },
        { id: 'ev_p1', date: `${Y}-04-02`, title: '🌾 Harvest (TBA)', sourceTool: 'CropProjection', lotId: 'R1G1-TBA-01', roomId: 'R1G1', taskType: 'harvest' },
        { id: 'ev_c1', date: `${Y}-06-01`, title: '🍂 Late pick', sourceTool: 'CropLabourWizard', lotId: 'L100', taskType: 'late_leaf_pick' },
        { id: 'ev_g1', date: `${Y}-06-02`, title: '📣 Meeting', sourceTool: 'GeneralEvent' },
        { id: 'ev_e1', date: `${Y}-06-03`, title: '🌀 Fans', sourceTool: 'EquipmentWizard', roomId: 'R1G1', equipmentId: 'eq1', taskId: 't2' }
    );
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, db);

    const hidden = () => b.run(main, `return document.getElementById('printYearBtn').classList.contains('hidden');`);
    check('🖨️ Print year is hidden in the Monthly view', await hidden());
    await b.run(main, `document.getElementById('viewWeekBtn').click();`);
    check('…and in the 7-Day view', await hidden());
    await b.run(main, `document.getElementById('viewYearBtn').click(); Calendar.currentYear = ${Y}; Calendar.render();`);
    check('…and shown in the Annual view', !(await hidden()));

    const print = async () => {
        const before = new Set((await b.contexts()).map(c => c.context));
        await b.run(main, `document.getElementById('printYearBtn').click();`, { user: true });
        let pop = null;
        for (let i = 0; i < 40 && !pop; i++) { await b.sleep(100); pop = (await b.contexts()).find(c => !before.has(c.context))?.context || null; }
        if (pop) await b.waitFor(pop, `return document.readyState === 'complete' && !!document.querySelector('.grid');`);
        return pop;
    };
    const read = (pop) => b.run(pop, `
        const day = ds => { const el = document.querySelector('.d[data-date="' + ds + '"]'); return el ? { text: el.textContent.replace(/\\s+/g, ' ').trim(), cl: el.classList.contains('cl'), hol: el.classList.contains('hol'), struck: [...el.querySelectorAll('s')].map(s => s.textContent) } : null; };
        const grey = c => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return true; const [r, g, bl, a] = m[1].split(',').map(Number); return a === 0 || (r === g && g === bl); };
        const colours = [...document.querySelectorAll('body, body *')].filter(el => !el.closest('.toolbar')).flatMap(el => { const s = getComputedStyle(el); return [s.color, s.backgroundColor, s.borderTopColor]; }).filter(c => !grey(c));
        return {
            title: document.querySelector('h1').textContent, filters: document.querySelector('.filters').textContent,
            legend: [...document.querySelectorAll('.li')].map(l => l.textContent.replace(/\\s+/g, ' ').trim()),
            codes: [...document.querySelectorAll('.li')].map(l => l.dataset.code).filter(Boolean),
            months: document.querySelectorAll('.m').length, cells: [...document.querySelectorAll('.mg')].map(g => g.querySelectorAll('.d').length),
            h: day('${Y}-03-05'), f1: day('${Y}-02-01'), f2: day('${Y}-02-02'), f3: day('${Y}-02-03'), f4: day('${Y}-02-04'),
            p: day('${Y}-04-02'), done: day('${Y}-05-10'), xmas: day('${Y}-12-27'), xmas25: day('${Y}-12-25'),
            c1: day('${Y}-06-01'), g1: day('${Y}-06-02'), e1: day('${Y}-06-03'), colours };`);

    // ---- With task-type filters on ----
    await b.run(main, `Calendar.filters = [{ key: 'taskType', value: 'harvest' }, { key: 'taskType', value: 'flip' }]; Calendar.render();`);
    let pop = await print();
    check('the print opens in its own window', !!pop);
    let r = await read(pop);
    check('title names the year', r.title.includes(String(Y)), r.title);
    check('the filter line names the filters', r.filters === 'Filters: Task Type: Harvest or Flip to Flower', r.filters);
    check('12 months, each six week rows', r.months === 12 && r.cells.every(n => n === 42), JSON.stringify(r.cells));
    check('the legend lists only the filtered types, with their counts', r.codes.join() === 'FL,HV' && r.legend.join(' | ') === 'FL Flip to Flower (2) | HV Harvest (3)', r.legend.join(' | '));
    check('two harvests on one day: HV×2 and a thick border', r.h?.text.includes('HV×2') && r.h.cl, JSON.stringify(r.h));
    check('a multi-day flip shows on every day of its range, and not after', [r.f1, r.f2, r.f3].every(d => d?.text.includes('FL')) && !r.f4?.text.includes('FL'), JSON.stringify([r.f1, r.f2, r.f3, r.f4]));
    check('a projected harvest prints in parentheses', r.p?.text.includes('(HV)'), JSON.stringify(r.p));
    check('a completed flip prints struck through', r.done?.struck.join() === 'FL', JSON.stringify(r.done));
    check('filtered-out tasks are left off', !r.c1?.text.match(/[A-Z]{2}|L2/) && !r.g1?.text.includes('OT') && !r.e1?.text.includes('EQ'), JSON.stringify([r.c1, r.g1, r.e1]));
    check('Christmas observed on Monday Dec 27 is underlined (holiday), Dec 25 isn\'t', r.xmas?.hol && !r.xmas25?.hol, JSON.stringify([r.xmas, r.xmas25]));
    check('black, white and grey only (no colour)', r.colours.length === 0, r.colours.slice(0, 5).join(', '));
    await b.send('browsingContext.close', { context: pop });

    // ---- No filters: every type, custom types get their own code ----
    await b.run(main, `Calendar.filters = []; Calendar.render();`);
    pop = await print();
    r = await read(pop);
    check('no filters: "All tasks (no filters)"', r.filters === 'All tasks (no filters)', r.filters);
    check('a custom task type gets a code of its own (L2, since LL is Late Flower Leaf Pick)', r.c1?.text.includes('L2') && r.codes.includes('L2'), JSON.stringify(r.c1));
    check('an event with no task type prints as OT (Other)', r.g1?.text.includes('OT') && r.legend.some(l => l.startsWith('OT Other')), JSON.stringify(r.g1));
    check('an EquipmentWizard event with no task type prints as EQ', r.e1?.text.includes('EQ') && r.legend.some(l => l.startsWith('EQ Equipment Maintenance')), JSON.stringify(r.e1));
    await b.send('browsingContext.close', { context: pop });

    await leave(b, main);
    return results;
}
