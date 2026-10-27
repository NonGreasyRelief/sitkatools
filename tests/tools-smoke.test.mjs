// Every tool opens from SitkaTools, gets the DB, and runs without page errors.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave, today } from './lib/helpers.mjs';

export const title = 'every tool opens from SitkaTools';

const TOOLS = ['GeneralEvent', 'CropLabourWizard', 'EquipmentWizard', 'EmployeeWizard', 'DailyWizard', 'PaperWizard'];

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    const db = fixtureDb();
    // Two more general events: one yesterday, one added after the fixture's "Staff meeting" today
    db.calendarEvents.push({ id: 'ev_ge_second', date: today(), title: '📌 Second today', sourceTool: 'GeneralEvent' },
        { id: 'ev_ge_yday', date: today(-1), title: '📌 Yesterday', sourceTool: 'GeneralEvent' });
    await loadSingle(b, main, db);
    for (const tool of TOOLS) {
        const before = b.logs.length;
        let ctx = null;
        try { ctx = await openTool(b, main, tool); } catch (_) { /* reported below */ }
        await b.sleep(600);
        const errors = b.logs.slice(before).filter(l => l.startsWith('[error]'));
        // A tool inside SitkaTools.html (a handle) is open over it; a window is linked to the SitkaTools that opened it
        const linked = !ctx ? false : typeof ctx === 'object' ? await b.run(ctx, 'return Hub.open && !!DB.data;')
            : await b.run(ctx, 'return WorkCopy.gotDb && !WorkCopy.inUse && !LinkLost.openerGone();');
        check(`${tool}: opened with the DB, linked, no page errors`, ctx && linked && !errors.length, errors.join(' | '));
        if (ctx && tool === 'GeneralEvent') {
            const order = await b.run(ctx, `return [...document.querySelectorAll('.event-item')].map(e => e.textContent.replace(/\\s+/g, ' ').trim());`);
            const at = s => order.findIndex(t => t.includes(s));
            check('GeneralEvent: events listed by date, then in the order they were added', at('Yesterday') === 0 && at('Staff meeting') === 1 && at('Second today') === 2, JSON.stringify(order));
        }
        if (ctx) { await leave(b, ctx); await b.send('browsingContext.close', { context: ctx }); }
    }
    await leave(b, main);
    return results;
}
