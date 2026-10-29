// 🪪 Badges and 👥 temp crews in the Labour & Cost Wizard: a badge is made (only its number and a hash are kept),
// printed on a sheet of 54 × 86 mm cards whose Code 128 bars read back as its 16 digits, replaced (the old one then
// says so), and a floor manager's badge signs off without a PIN. A temp crew has no work week or shifts.
import { fixtureDb, withFloorManager, makeChecker, fresh, openSitka, loadSingle, openTool, saveSingle, scanBadge } from './lib/helpers.mjs';

export const title = 'Badges and temp crews';

// Code 128 widths (values 0–102, Start A/B/C, Stop), to read the printed bars back independently of the page
const TABLE = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 ' +
    '123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 ' +
    '131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 ' +
    '213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 ' +
    '112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 ' +
    '421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112').split(' ');
// The bars of one card's SVG ({ total, bars: [[x, w], …] }) → its digits, or an error
function decode({ total, bars }) {
    const widths = [];
    let x = null;
    for (const [bx, bw] of bars) {
        if (x !== null) widths.push(bx - x);   // the space before this bar
        widths.push(bw);
        x = bx + bw;
    }
    const lead = bars[0][0], trail = total - x;
    if (lead < 10 || trail < 10) return { error: 'quiet zone too small' };
    const syms = [];
    for (let i = 0; i + 6 <= widths.length - 7; i += 6) syms.push(TABLE.indexOf(widths.slice(i, i + 6).join('')));
    const stop = widths.slice(-7).join('');
    if (stop !== TABLE[106]) return { error: 'no stop' };
    if (syms[0] !== 105) return { error: 'not set C' };
    const data = syms.slice(1, -1), check = syms[syms.length - 1];
    if (data.some(v => v < 0 || v > 99)) return { error: 'bad symbol' };
    if (data.reduce((s, v, i) => s + v * (i + 1), 105) % 103 !== check) return { error: 'bad checksum' };
    return { digits: data.map(v => String(v).padStart(2, '0')).join('') };
}

// The print window opened by `click` (code run in the tool), its cards read
async function printed(b, ew, click) {
    const before = new Set((await b.contexts()).flatMap(c => [c.context, ...(c.children || []).map(x => x.context)]));
    await b.run(ew, click, { user: true });
    await b.sleep(1200);
    const pr = (await b.contexts()).find(c => !before.has(c.context));
    if (!pr) return null;
    const out = await b.run(pr.context, `return {
        title: document.title,
        sheets: document.querySelectorAll('.sheet').length,
        cards: [...document.querySelectorAll('.card')].map(c => {
            const r = c.getBoundingClientRect(), svg = c.querySelector('svg.bc');
            return { no: c.dataset.badge, w: r.width, h: r.height, name: c.querySelector('.name').textContent, band: c.querySelector('.band').textContent,
                num: c.querySelector('.no').textContent,
                svg: { total: Number(svg.getAttribute('viewBox').split(' ')[2]), bars: [...svg.querySelectorAll('g rect')].map(x => [Number(x.getAttribute('x')), Number(x.getAttribute('width'))]) } };
        }) };`);
    await b.send('browsingContext.close', { context: pr.context });
    return out;
}

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, withFloorManager(fixtureDb()));
    const ew = await openTool(b, main, 'EmployeeWizard');
    const emp = name => b.run(ew, `return DB.data._EmployeeWizard.employees[${JSON.stringify(name)}];`);
    const codeOf = name => b.run(ew, `return EMP.badgeCodes[${JSON.stringify(name)}] || null;`);

    // ---- One badge, from the employee editor ----
    await b.run(ew, `selectEmployee('Alex'); document.getElementById('empBadgeMake').click();`, { user: true });
    await b.waitFor(ew, `return !!DB.data._EmployeeWizard.employees.Alex.badge;`);
    const alex = await emp('Alex'), alexCode = await codeOf('Alex');
    check('Make badge keeps only its number and a salted hash', /^\d{4}$/.test(alex.badge.no) && alex.badge.salt && /^[0-9a-f]{64}$/.test(alex.badge.hash) && !JSON.stringify(alex).includes(alexCode.slice(4)), JSON.stringify(alex.badge));
    check('…its 16-digit code is kept only in the open tool, starting with the number', /^\d{16}$/.test(alexCode) && alexCode.startsWith(alex.badge.no));
    const ed = await b.run(ew, `return { print: !document.getElementById('empBadgePrint').hidden, make: document.getElementById('empBadgeMake').textContent,
        row: [...document.querySelectorAll('#empList .emp-row')].find(r => r.textContent.includes('Alex'))?.textContent || '' };`);
    check('the editor offers 🖨️ Print badge and 🔄 Replace badge; the roster shows 🪪 and the number', ed.print && ed.make.includes('Replace') && ed.row.includes('🪪 ' + alex.badge.no), JSON.stringify(ed));
    check('the badge is recognized', (await b.run(ew, `return await FloorPin.verifyBadge(${JSON.stringify(alexCode)});`))?.name === 'Alex');
    check('…but not with one digit wrong', (await b.run(ew, `return await FloorPin.verifyBadge(${JSON.stringify(alexCode.slice(0, 15) + ((Number(alexCode[15]) + 1) % 10))});`))?.error === 'unknown');

    let p = await printed(b, ew, `document.getElementById('empBadgePrint').click();`);
    const mm = px => px * 25.4 / 96;
    check('🖨️ Print badge opens a sheet with Alex\'s card', p?.cards?.length === 1 && p.cards[0].name === 'Alex' && p.cards[0].num === '#' + alex.badge.no, JSON.stringify(p?.cards?.map(c => c.name)));
    check('…a CR80 card, portrait: 54 × 86 mm', p && Math.abs(mm(p.cards[0].w) - 54) < 0.6 && Math.abs(mm(p.cards[0].h) - 86) < 0.6, p ? `${mm(p.cards[0].w).toFixed(1)} × ${mm(p.cards[0].h).toFixed(1)} mm` : '');
    const dec = p ? decode(p.cards[0].svg) : {};
    check('…whose Code 128 bars read back as the badge\'s 16 digits', dec.digits === alexCode, JSON.stringify(dec));

    // ---- 🪪 Badges…: everyone without one, made and printed together ----
    await b.run(ew, `document.getElementById('badgesBtn').click();`, { user: true });
    const ticks = await b.run(ew, `return Object.fromEntries([...document.querySelectorAll('#badgesDialog .badges-list input')].map(x => [x.dataset.name, x.checked]));`);
    check('🪪 Badges ticks everyone without a badge', ticks.Alex === false && ticks.Blair && ticks.Casey && ticks.Drew, JSON.stringify(ticks));
    p = await printed(b, ew, `document.querySelector('#badgesDialog [data-act="make"]').click();`);
    const codes = { Blair: await codeOf('Blair'), Casey: await codeOf('Casey'), Drew: await codeOf('Drew') };
    check('Make & print makes three badges and prints them on one sheet', p?.sheets === 1 && p.cards.length === 3 && Object.values(codes).every(c => /^\d{16}$/.test(c || '')), JSON.stringify(p?.cards?.map(c => c.name)));
    check('…every card reads back as its own code', p && p.cards.every(c => decode(c.svg).digits === codes[c.name]));
    check('…Casey\'s card carries the Floor manager band', p?.cards.find(c => c.name === 'Casey')?.band === 'Floor manager');
    const nos = [alex.badge.no, ...(await Promise.all(['Blair', 'Casey', 'Drew'].map(async n => (await emp(n)).badge.no)))];
    check('every badge has its own number', new Set(nos).size === 4, nos.join(' '));

    // ---- Replacing a badge: the old one says so ----
    await b.run(ew, `window.confirm = () => true; selectEmployee('Alex'); if (EMP.selectedName !== 'Alex') selectEmployee('Alex'); document.getElementById('empBadgeMake').click();`, { user: true });
    await b.waitFor(ew, `return DB.data._EmployeeWizard.employees.Alex.badge.no !== ${JSON.stringify(alex.badge.no)};`);
    const alex2 = await emp('Alex'), alexCode2 = await codeOf('Alex');
    check('🔄 Replace badge makes a new number and keeps the old one as replaced', alex2.badge.no !== alex.badge.no && alex2.badgeRetired?.[0]?.no === alex.badge.no, JSON.stringify(alex2.badgeRetired));
    const old = await b.run(ew, `return await FloorPin.verifyBadge(${JSON.stringify(alexCode)});`);
    check('…the old badge is "replaced", the new one works', old?.error === 'replaced' && old.name === 'Alex' && (await b.run(ew, `return (await FloorPin.verifyBadge(${JSON.stringify(alexCode2)})).name;`)) === 'Alex', JSON.stringify(old));

    // ---- A floor manager's badge signs off without a PIN (the shared FloorPin dialog) ----
    const ask = (why, opts = '{}') => b.run(ew, `window.__res = undefined; FloorPin.ask(${JSON.stringify(why)}, ${opts}).then(r => { window.__res = r; });`);
    const res = () => b.run(ew, `return window.__res;`);
    await ask('Approve', '{ initials: true }');
    const dlg = await b.run(ew, `const el = document.getElementById('floorPin'); return { open: !el.hidden, scan: !el.querySelector('[data-fpin-scan]').hidden && el.querySelector('[data-fpin-scan]').textContent };`);
    check('the sign-off dialog says a floor manager can scan their badge', dlg.open && /Scan your badge/.test(dlg.scan || ''), JSON.stringify(dlg));
    await scanBadge(b, ew, codes.Blair);
    let err = await b.run(ew, `return document.querySelector('#floorPin [data-fpin-err]').textContent;`);
    check('a badge that isn\'t a floor manager\'s can\'t approve', (await res()) == null && /Blair isn’t one/.test(err), err);
    await scanBadge(b, ew, '9999' + codes.Blair.slice(4));
    err = await b.run(ew, `return document.querySelector('#floorPin [data-fpin-err]').textContent;`);
    check('an unknown badge is "not recognized"', (await res()) == null && /not recognized/.test(err), err);
    // Typing the digits by hand, slowly, is not a scan
    await b.run(ew, `document.querySelector('#floorPin [data-fpin-pin]').blur(); document.querySelector('#floorPin .fpin-card').focus?.();`);
    for (const ch of codes.Casey) { await b.keys(ew, ch); await b.sleep(130); }
    await b.keys(ew, '');
    await b.sleep(300);
    check('typing the 16 digits slowly isn\'t taken for a scan', (await res()) == null);
    // Scanned into the PIN box: the digits come back out and Casey signs off
    await b.run(ew, `const p = document.querySelector('#floorPin [data-fpin-pin]'); p.value = ''; p.focus();`);
    await scanBadge(b, ew, codes.Casey);
    let r = await res();
    check('Casey\'s badge signs off at once — no PIN, no initials drawn', r?.name === 'Casey' && r.badge === codes.Casey.slice(0, 4) && r.initials?.badge === r.badge && !r.initials.strokes, JSON.stringify(r));
    check('…the scan into the PIN box was taken back out of it', await b.run(ew, `return document.querySelector('#floorPin [data-fpin-pin]').value === '' && document.getElementById('floorPin').hidden;`));
    await ask('Approve (PIN only)');
    await scanBadge(b, ew, codes.Casey);
    r = await res();
    check('a PIN-only approval takes the badge too ({ name, badge })', r?.name === 'Casey' && r.badge && !r.initials, JSON.stringify(r));
    await ask('Old badge');
    await scanBadge(b, ew, alexCode);
    err = await b.run(ew, `return document.querySelector('#floorPin [data-fpin-err]').textContent;`);
    check('a replaced badge says so', /replaced/.test(err), err);
    await b.run(ew, `document.querySelector('#floorPin [data-fpin-cancel]').click();`);

    // ---- 👥 A temp crew ----
    await b.run(ew, `document.getElementById('addEmpBtn').click(); document.getElementById('newEmpName').value = 'Crew A'; document.getElementById('newEmpCrew').checked = true;
        document.getElementById('addEmpForm').dispatchEvent(new Event('submit', { cancelable: true }));`, { user: true });
    const crew = await emp('Crew A');
    check('+ Add with 👥 Temp crew makes a crew with no work week', crew?.crew === true && Array.isArray(crew.workDays) && !crew.workDays.length, JSON.stringify(crew));
    const ce = await b.run(ew, `return { wage: document.getElementById('empWageLabel').textContent, fm: document.getElementById('empFloorManager').closest('label').hidden,
        days: document.getElementById('dayToggleRow').hidden, off: document.getElementById('requestTimeOffBtn').hidden, note: !document.getElementById('empCrewNote').hidden,
        row: [...document.querySelectorAll('#empList .emp-row')].find(r => r.textContent.includes('Crew A'))?.textContent || '' };`);
    check('…its editor asks a rate per person, with no floor manager box, work days or time off', /per person/.test(ce.wage) && ce.fm && ce.days && ce.off && ce.note && ce.row.includes('👥 crew'), JSON.stringify(ce));
    await b.run(ew, `document.getElementById('empWageInput').value = '18'; document.getElementById('saveEmpBtn').click();`, { user: true });
    await b.sleep(300);
    check('…its rate is saved as its wage', (await emp('Crew A')).wage === 18);
    await b.run(ew, `selectEmployee('Crew A'); setViewMode('workweek');`);
    check('…it isn\'t in the work week', !(await b.run(ew, `return document.getElementById('workweekGrid').textContent;`)).includes('Crew A'));
    check('…and has no shifts in the Reports\' roster capacity', await b.run(ew, `const T = localDateStr(new Date()); const a = rptCapacity(T, T)[T] || 0;
        DB.data._EmployeeWizard.employees['Crew A'].workDays = [0,1,2,3,4,5,6]; const c = rptCapacity(T, T)[T] || 0; DB.data._EmployeeWizard.employees['Crew A'].workDays = []; return a === c;`));
    await b.run(ew, `selectEmployee('Crew A'); document.getElementById('empBadgeMake').click();`, { user: true });
    await b.waitFor(ew, `return !!DB.data._EmployeeWizard.employees['Crew A'].badge;`);
    const crewCode = await codeOf('Crew A');
    const cv = await b.run(ew, `return await FloorPin.verifyBadge(${JSON.stringify(crewCode)});`);
    check('a crew badge is recognized as a crew, never as a floor manager', cv?.name === 'Crew A' && cv.crew === true && cv.floorManager === false, JSON.stringify(cv));
    p = await printed(b, ew, `document.getElementById('empBadgePrint').click();`);
    check('…its card carries the 👥 Temp crew band', p?.cards?.[0]?.band === '👥 Temp crew' && decode(p.cards[0].svg).digits === crewCode);

    // ---- 👥 A crew's hours typed in the Tasks tab, signed off with a floor manager's badge ----
    const T0 = await b.run(ew, `return localDateStr(new Date());`);
    await b.run(ew, `
        document.getElementById('tabTasks').click();
        const lot = document.getElementById('activeLot'); lot.value = 'L100'; lot.dispatchEvent(new Event('change'));
        TASK.selectedKey = 'ev_cropb1'; TASK.editDate = ${JSON.stringify(T0)}; renderTasksTab();
        const sel = document.getElementById('lfEmpSelect'); sel.value = 'Crew A'; sel.dispatchEvent(new Event('change'));`, { user: true });
    check('the Tasks tab asks a crew\'s size', await b.run(ew, `return !document.getElementById('lfCrewGroup').hidden;`));
    await b.run(ew, `document.getElementById('lfCrewSize').value = '3'; document.getElementById('lfHours').value = '2'; document.getElementById('lfMinutes').value = '0';
        document.getElementById('lfAddBtn').click();`, { user: true });
    await b.waitFor(ew, `return !document.getElementById('floorPin').hidden;`, 3000).catch(() => {});
    await scanBadge(b, ew, codes.Casey);
    const te = await b.run(ew, `return (DB.data.calendarEvents.find(e => e.id === 'ev_cropb1').labour_map?.[${JSON.stringify(T0)}] || []).find(e => e.employee === 'Crew A') || null;`);
    check('…2h each for 3 is saved as 6 person-hours, signed off with Casey\'s badge', te?.crewSize === 3 && Math.abs(te.hours - 6) < 0.001 && te.enteredBy?.name === 'Casey' && te.enteredBy.badge === codes.Casey.slice(0, 4), JSON.stringify(te));
    const tags = await b.run(ew, `return document.getElementById('teEntryList').textContent;`);
    check('…tagged with the crew size and the badge sign-off', tags.includes('👥 × 3') && tags.includes('🪪 Casey'), tags.replace(/\s+/g, ' ').slice(0, 160));

    // ---- Saved: hashes only ----
    await b.run(main, `Tools.close();`);
    const text = await saveSingle(b, main);
    const saved = JSON.parse(text);
    const allCodes = [alexCode, alexCode2, crewCode, ...Object.values(codes)];
    check('the saved DB holds each badge\'s number and hash, never a code', ['Alex', 'Blair', 'Casey', 'Drew', 'Crew A'].every(n => saved._EmployeeWizard.employees[n].badge?.hash)
        && allCodes.every(c => !text.includes(c.slice(4))));
    return results;
}
