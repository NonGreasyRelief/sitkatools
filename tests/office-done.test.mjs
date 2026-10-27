// Marking a task done in SitkaTools is the office's (user request 2026-10-27): on a building device the event panel's
// Completed and the task list's ✓ / ○ only show it, the past-due ✓ is hidden, and a note says where it's done instead
// (DailyWizard's ✅ Mark done or the Labour & Cost Wizard's Mark completed, with a floor manager's PIN). The event panel
// has no Notes or Assigned To any more.
import { fixtureDb, makeChecker, fresh, openSitka, splitFiles, openSplit, loadSingle } from './lib/helpers.mjs';

export const title = 'marking done in SitkaTools: the office only; no Notes or Assigned To';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    const state = () => b.run(main, `const e = DB.data.calendarEvents.find(x => x.id === 'ev_cropb1');
        Calendar.selectEvent(e);
        const row = document.getElementById('completedToggleRow');
        document.getElementById('completedCheckbox').click();
        const afterPanel = e.completed === true;
        Calendar.render();
        const check = document.querySelector('.terminal-check[data-event-id="ev_cropb1"]');
        check?.click();
        const labels = [...document.querySelectorAll('.event-detail-label')].map(l => l.textContent);
        return { panel: afterPanel, list: e.completed === true, readonly: row.classList.contains('readonly'), note: document.querySelector('.completed-elsewhere')?.textContent || '',
            checkReadonly: !!check?.classList.contains('readonly'), labels };`);

    // ---- A building device ----
    const files = await splitFiles(b, main, BASE, fixtureDb());
    await openSplit(b, main, BASE, 'B1', files);
    let s = await state();
    check('a building device: clicking Completed in the event panel changes nothing', !s.panel && s.readonly, JSON.stringify(s));
    check('…nor the task list\'s ○', !s.list && s.checkReadonly, JSON.stringify(s));
    check('…and the panel says where it\'s done', s.note.includes('DailyWizard') && s.note.includes('Labour & Cost Wizard') && s.note.includes('PIN'), s.note);
    check('the event panel has no Notes, Assigned To, Status or Est. Hours', !s.labels.some(l => /Notes|Assigned|Status|Estimated/.test(l)), s.labels.join(', '));

    // ---- The office ----
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());
    s = await state();
    check('the office: Completed in the event panel marks it done, and the task list\'s ✓ undoes it', s.panel && !s.list && !s.readonly && !s.note, JSON.stringify(s));
    return results;
}
