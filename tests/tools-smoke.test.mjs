// Every tool opens from SitkaTools, gets the DB, and runs without page errors.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';

export const title = 'every tool opens from SitkaTools';

const TOOLS = ['GeneralEvent', 'CropLabourWizard', 'EquipmentWizard', 'EmployeeWizard', 'DailyWizard', 'PaperWizard'];

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    for (const tool of TOOLS) {
        const before = b.logs.length;
        let ctx = null;
        try { ctx = await openTool(b, main, tool); } catch (_) { /* reported below */ }
        await b.sleep(600);
        const errors = b.logs.slice(before).filter(l => l.startsWith('[error]'));
        const linked = ctx ? await b.run(ctx, 'return WorkCopy.gotDb && !WorkCopy.inUse && !LinkLost.openerGone();') : false;
        check(`${tool}: opened with the DB, linked, no page errors`, ctx && linked && !errors.length, errors.join(' | '));
        if (ctx) { await leave(b, ctx); await b.send('browsingContext.close', { context: ctx }); }
    }
    await leave(b, main);
    return results;
}
