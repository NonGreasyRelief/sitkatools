// Builds the PaperWizard sheet configurations for CVS-CV-FRM-0026-011 (Harvesting, Drying, Curing and Trimming), issued
// 2026-10-22: five sheets, imported with Configure Sheets → 📥 Import (user request 2026-11-07).
//   harvest-log  form pages 1–3 (harvest day)        drying-log / trim-log  form page 4 (the same page image, saved twice)
//   curing-log   form pages 5–7                       lot-summary            form pages 8–9 (close-out)
// Page images: <sheet id>-p1.webp, -p2.webp … (curing-log-p1.webp is the form's page 5). Box positions are pixel
// measurements of the 2550 × 3300 page images (300 dpi Letter), turned into 0–1 fractions. A new form revision needs
// them measured again.
// Usage: node examples/harvest-pack/make-harvest-pack.mjs examples/harvest-pack
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
if (!OUT) throw new Error('usage: node make-harvest-pack.mjs <outDir>');
const W = 2550, H = 3300, DPI = 300;
const r4 = v => Math.round(v * 10000) / 10000;

// ---- building blocks ----
function sheetBuilder(sheetId, name, cadence, document, pageCount) {
    const fields = [];
    const questions = [];
    const ids = new Set();
    const uid = id => { if (ids.has(id)) throw new Error(`${sheetId}: duplicate id ${id}`); ids.add(id); return id; };
    const box = (id, page, label, x0, y0, x1, y1, more = {}) => {
        const f = { id: uid(id), label, x: r4(x0 / W), y: r4(y0 / H), w: r4((x1 - x0) / W), h: r4((y1 - y0) / H), page,
            fontSize: 11, align: 'left', source: null, questionId: null, day: 1, dayGroup: null, checkbox: false, checkValue: '', ...more };
        fields.push(f);
        return f;
    };
    // Text in a table cell: padded in from the cell's sides, the line centred in the cell's height
    const cell = (id, page, label, x0, y0, x1, y1, more = {}) => {
        const pt = more.fontSize ?? 11;
        const lineH = pt / 72 * DPI * 1.15;
        const top = y0 + Math.max(3, (y1 - y0 - lineH) / 2);
        return box(id, page, label, x0 + 12, top, x1 - 12, y1 - 3, more);
    };
    // A tick box over the form's printed box glyph (top-left and its size, in px)
    const tick = (id, page, label, gx, gy, size, more = {}) => box(id, page, label, gx, gy, gx + size, gy + size, { checkbox: true, ...more });
    const q = (id, label, type, more = {}) => {
        const o = { id: uid(id), label, type, options: [], rowScoped: false, sameAsLast: false, mandatory: false, prefillFrom: null, ...more };
        questions.push(o);
        return o;
    };
    const lotHeader = page => box(`b-lot-p${page}`, page, 'LOT # (header)', 1585, 182, 2155, 278, { source: 'lot.name', fontSize: 16 });
    const build = (signature = null) => ({
        format: 'paperwizard-sheet', version: 1, exportedAt: new Date().toISOString(), sheetId,
        sheet: { name, orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount, cadence, document, fields, signature },
        wizards: { [`wz-${sheetId}`]: { sheetId, name, questions } }
    });
    return { box, cell, tick, q, lotHeader, build, fields, questions };
}

const YESNO = ['Yes', 'No'];

// The scale verification table (form pages 2 and 5): one entry per scale, three test weights each.
// `blocks` = per scale: its top, its three sub-row tops, and the y of each glyph row (Floor, Bench, C/NC per sub-row,
// YES, NO). `cols` = the table's column edges.
function scaleTable(S, page, group, blocks, cols) {
    const { q, box, tick } = S;
    q('sv-date', 'Scale check — date', 'text', { repeating: true, prefillFrom: 'sheet.periodStart', sameAsLast: true });
    q('sv-id', 'Scale ID', 'text', { repeating: true, mandatory: true });
    q('sv-type', 'Scale type', 'select', { repeating: true, mandatory: true, options: ['Floor', 'Bench'] });
    q('sv-digit', 'Last digit of the scale (kg or g, e.g. 0.01)', 'number', { repeating: true, mandatory: true });
    for (const k of [1, 2, 3]) {
        q(`sv-w${k}`, `Weight used — test ${k}`, 'number', { repeating: true, mandatory: k === 1 });
        q(`sv-r${k}`, `Reading — test ${k}`, 'number', { repeating: true, mandatory: k === 1 });
        // Precision: floor scale = 3 × the last digit; bench scale = 0.05 % of the weight used
        q(`sv-p${k}`, `Precision — test ${k}`, 'number', { repeating: true,
            calc: `if({sv-w${k}} = "", "", if({sv-type} = "Floor", 3 * {sv-digit}, {sv-w${k}} * 0.0005))` });
        // Conforms when the reading is within the precision of the weight used
        q(`sv-c${k}`, `Precision conforms — test ${k} (C / NC)`, 'text', { repeating: true,
            calc: `if({sv-r${k}} = "", "", if(round(abs({sv-r${k}} - {sv-w${k}}), 4) <= round({sv-p${k}}, 4), "C", "NC"))` });
    }
    q('sv-level', 'Scale level, OK?', 'select', { repeating: true, mandatory: true, options: ['YES', 'NO'] });
    q('sv-ini', 'Initials', 'initials', { repeating: true, mandatory: true, sameAsLast: true });
    const [xDate, xId, xType, xDigit, xW, xR, xP, xC, xLvl, xIni, xEnd] = cols;
    blocks.forEach((b, i) => {
        const day = i + 1, m = { repeat: true, dayGroup: group, day };
        const r = day === 1 ? '' : `-r${day}`;
        box(`b-sv-date${r}`, page, 'Date', xDate + 8, b.top + 8, xId - 6, b.bottom - 8, { ...m, questionId: 'sv-date', fontSize: 9 });
        box(`b-sv-id${r}`, page, 'Scale ID', xId + 10, b.top + 8, xType - 8, b.bottom - 8, { ...m, questionId: 'sv-id', fontSize: 10 });
        tick(`b-sv-floor${r}`, page, 'Floor', xType + 23, b.floor, 22, { ...m, questionId: 'sv-type', checkValue: 'Floor' });
        tick(`b-sv-bench${r}`, page, 'Bench', xType + 23, b.bench, 22, { ...m, questionId: 'sv-type', checkValue: 'Bench' });
        box(`b-sv-digit${r}`, page, 'Last digit', xDigit + 10, b.top + 8, xW - 10, b.top + 60, { ...m, questionId: 'sv-digit', fontSize: 10, align: 'center' });
        b.subs.forEach((s, k) => {
            const n = k + 1, sub = (x0, x1, qid, label, more = {}) =>
                box(`b-sv-${qid.slice(3)}${r}`, page, label, x0 + 10, s + 14, x1 - 10, s + 70, { ...m, questionId: qid, fontSize: 10, align: 'right', ...more });
            sub(xW, xR, `sv-w${n}`, `Weight used ${n}`);
            sub(xR, xP, `sv-r${n}`, `Reading ${n}`);
            sub(xP, xC, `sv-p${n}`, `Precision ${n}`);
            tick(`b-sv-c${n}${r}`, page, `C ${n}`, 1756, b.conf[k], 22, { ...m, questionId: `sv-c${n}`, checkValue: 'C' });
            tick(`b-sv-nc${n}${r}`, page, `NC ${n}`, 1874, b.conf[k], 22, { ...m, questionId: `sv-c${n}`, checkValue: 'NC' });
        });
        tick(`b-sv-yes${r}`, page, 'Level YES', xLvl + 24, b.yes, 22, { ...m, questionId: 'sv-level', checkValue: 'YES' });
        tick(`b-sv-no${r}`, page, 'Level NO', xLvl + 24, b.no, 22, { ...m, questionId: 'sv-level', checkValue: 'NO' });
        box(`b-sv-ini${r}`, page, 'Initials', xIni + 8, b.top + 40, xEnd - 8, b.bottom - 40, { ...m, questionId: 'sv-ini' });
    });
}

const write = (obj) => {
    fs.mkdirSync(OUT, { recursive: true });
    const file = path.join(OUT, `${obj.sheetId}.json`);
    fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
    console.log('wrote', file, '—', obj.sheet.fields.length, 'boxes,', Object.values(obj.wizards)[0].questions.length, 'questions');
};

// ===================================================================================================
// 1. harvest-log — form pages 1–3, filled on harvest day
// ===================================================================================================
{
    const S = sheetBuilder('harvest-log', 'Harvest Log — pp. 1–3 (harvest day)', 'event', 'harvest', 3);
    const { box, cell, tick, q, lotHeader } = S;
    // ---- questions, in the order the wizard asks them ----
    q('pest', 'Any type of pesticide used during cultivation? (Yes: include form SB6-CV-FRM-0003 Pest Record Management)', 'select', { options: YESNO, mandatory: true });
    q('hdate', 'Harvest date (first day)', 'text', { prefillFrom: 'sheet.periodStart', mandatory: true });
    q('ck-totes', 'Totes and bins are dry and clean?', 'select', { options: YESNO, mandatory: true });
    q('ck-sciss', 'Scissors and shears are dry and clean?', 'select', { options: YESNO, mandatory: true });
    q('ck-waste', 'All waste, materials and tools from previous activities have been removed from the room?', 'select', { options: YESNO, mandatory: true });
    q('dry-meth', 'Drying method', 'select', { options: ['Hang Dry', 'Tray Dry'], mandatory: true });
    q('buck-meth', 'Bucking method', 'select', { options: ['Hand Bucked', 'Machine Bucked'], mandatory: true });
    q('buck-sn', 'Bucking machine serial # (type N/A if hand bucked)', 'text', { mandatory: true });
    q('trim-wd', 'Wet or dry trim', 'select', { options: ['Wet Trim', 'Dry Trim'], mandatory: true });
    q('trim-hm', 'Hand or machine trim', 'select', { options: ['Hand Trim', 'Machine Trim'], mandatory: true });
    q('trim-sn', 'Trimming machine serial # (type N/A if hand trimmed)', 'text', { mandatory: true });
    q('dryroom', 'Drying room (moves the lot there)', 'room', { prefillFrom: 'lot.dryRoom', mandatory: true });
    q('phase', 'Lot\'s phase now — pick Drying (not printed: sets the lot\'s phase in SitkaTools)', 'phase', { prefillFrom: 'lot.stage' });
    q('dstart', 'Drying start date', 'text', { prefillFrom: 'sheet.periodStart', mandatory: true });
    q('ck-clean', 'A room clean has been completed?', 'select', { options: YESNO, mandatory: true });
    q('cleandate', 'Date of last room clean', 'text', { mandatory: true });
    q('ck-remove', 'All waste, materials and tools from previous operations have been removed from the room?', 'select', { options: YESNO, mandatory: true });
    q('ck-tools', 'All tools & equipment for current operations are clean?', 'select', { options: YESNO, mandatory: true });
    q('ck-scale', 'Scale verification was performed?', 'select', { options: YESNO, mandatory: true });
    // page 2: scale verification table (4 scales)
    scaleTable(S, 2, 'g-scale', [
        { top: 1466, bottom: 1699, subs: [1466, 1544, 1622], floor: 1489, bench: 1530, conf: [1489, 1567, 1645], yes: 1489, no: 1542 },
        { top: 1700, bottom: 1933, subs: [1700, 1778, 1856], floor: 1722, bench: 1764, conf: [1723, 1801, 1879], yes: 1723, no: 1776 },
        { top: 1934, bottom: 2177, subs: [1934, 2015, 2097], floor: 1956, bench: 1997, conf: [1957, 2038, 2119], yes: 1957, no: 2010 },
        { top: 2178, bottom: 2421, subs: [2178, 2259, 2340], floor: 2200, bench: 2241, conf: [2200, 2282, 2363], yes: 2200, no: 2253 }
    ], [226, 405, 633, 815, 1023, 1259, 1466, 1732, 1998, 2147, 2324]);
    // page 3: start of drying — one entry per bin
    q('bin', 'Bin #', 'text', { repeating: true, mandatory: true });
    q('wet', 'Fresh harvest cannabis weight (g)', 'number', { repeating: true, mandatory: true, metric: 'harvest.wetWeight', metricUnit: 'g' });
    q('waste', 'Fresh waste weight (g) — waste buds and leaves', 'number', { repeating: true });
    q('wini', 'Initials', 'initials', { repeating: true, mandatory: true, sameAsLast: true });
    q('dend', 'Drying end date (fill in when drying ends)', 'text');

    // ---- page 1: Harvesting ----
    lotHeader(1);
    cell('b-lot1', 1, 'LOT #', 757, 522, 1142, 594, { source: 'lot.name' });
    cell('b-strain1', 1, 'Strain Name', 1534, 522, 2323, 594, { source: 'lot.strain' });
    cell('b-room1', 1, 'Grow Room #', 757, 595, 1142, 657, { source: 'lot.destRoom' });
    for (const [x, v] of [[1558, 'B6'], [1694, 'B54D'], [1945, 'B66D'], [2140, 'B54A']])
        tick(`b-bld1-${v}`, 1, `Building ${v}`, x, 610, 33, { source: 'calc', calc: 'building(lot.destRoom)', checkValue: v });
    tick('b-pest-y', 1, 'Pesticide Yes', 1095, 715, 30, { questionId: 'pest', checkValue: 'Yes' });
    tick('b-pest-n', 1, 'Pesticide No', 1302, 715, 30, { questionId: 'pest', checkValue: 'No' });
    cell('b-hdate', 1, 'Harvest Date', 1083, 816, 1494, 887, { questionId: 'hdate' });
    tick('b-ck-totes', 1, 'Totes and bins clean', 301, 1010, 33, { questionId: 'ck-totes', checkValue: 'Yes' });
    tick('b-ck-sciss', 1, 'Scissors and sheers clean', 301, 1066, 33, { questionId: 'ck-sciss', checkValue: 'Yes' });
    tick('b-ck-waste', 1, 'Waste removed', 301, 1122, 33, { questionId: 'ck-waste', checkValue: 'Yes' });
    tick('b-hang', 1, 'Hang Dry', 755, 1341, 34, { questionId: 'dry-meth', checkValue: 'Hang Dry' });
    tick('b-tray', 1, 'Tray Dry', 1198, 1341, 34, { questionId: 'dry-meth', checkValue: 'Tray Dry' });
    tick('b-handbuck', 1, 'Hand Bucked', 755, 1414, 34, { questionId: 'buck-meth', checkValue: 'Hand Bucked' });
    tick('b-machbuck', 1, 'Machine Bucked', 1199, 1414, 34, { questionId: 'buck-meth', checkValue: 'Machine Bucked' });
    cell('b-buck-sn', 1, 'Bucking machine serial #', 1930, 1395, 2323, 1467, { questionId: 'buck-sn', fontSize: 10 });
    tick('b-wettrim', 1, 'Wet Trim', 755, 1487, 34, { questionId: 'trim-wd', checkValue: 'Wet Trim' });
    tick('b-drytrim', 1, 'Dry Trim', 1198, 1487, 34, { questionId: 'trim-wd', checkValue: 'Dry Trim' });
    tick('b-handtrim', 1, 'Hand Trim', 765, 1560, 34, { questionId: 'trim-hm', checkValue: 'Hand Trim' });
    tick('b-machtrim', 1, 'Machine Trim', 1199, 1560, 34, { questionId: 'trim-hm', checkValue: 'Machine Trim' });
    cell('b-trim-sn', 1, 'Trimming machine serial #', 1868, 1541, 2323, 1613, { questionId: 'trim-sn', fontSize: 10 });

    // ---- page 2: Drying ----
    lotHeader(2);
    cell('b-lot2', 2, 'Lot #', 646, 522, 1080, 594, { source: 'lot.name' });
    cell('b-strain2', 2, 'Strain Name', 1495, 522, 2323, 594, { source: 'lot.strain' });
    cell('b-dryroom', 2, 'Drying Room', 646, 595, 1080, 667, { questionId: 'dryroom' });
    // The form prints "B6DD" for building B66D
    for (const [x, v] of [[1519, 'B6'], [1644, 'B66D'], [1874, 'B54D'], [2051, 'B54A']])
        tick(`b-bld2-${v}`, 2, `Building ${v}`, x, 616, 30, { source: 'calc', calc: 'building({dryroom})', checkValue: v });
    // over the form's grey YYYY-MM-DD placeholder (the cell has no room beside it)
    cell('b-dstart', 2, 'Drying Start Date', 655, 668, 1080, 740, { questionId: 'dstart' });
    cell('b-dend', 2, 'Drying End Date', 1495, 668, 2323, 740, { questionId: 'dend', align: 'right' });
    box('b-cleandate', 2, 'Date of last room clean', 1500, 988, 2040, 1032, { questionId: 'cleandate' });
    for (const [y, id] of [[1000, 'ck-clean'], [1056, 'ck-remove'], [1112, 'ck-tools'], [1168, 'ck-scale']])
        tick(`b-${id}`, 2, id, 228, y, 34, { questionId: id, checkValue: 'Yes' });

    // ---- page 3: Start of drying ----
    lotHeader(3);
    const lines3 = [752, 831, 910, 989, 1068, 1147, 1226, 1305, 1384, 1463, 1542, 1621, 1700, 1779, 1858, 1937, 2015, 2094, 2173, 2252, 2331, 2410, 2489, 2568, 2647, 2727];
    for (let r = 1; r <= 25; r++) {
        const y0 = lines3[r - 1] + 2, y1 = lines3[r] - 1, m = { repeat: true, dayGroup: 'g-bins', day: r };
        const s = r === 1 ? '' : `-r${r}`;
        cell(`b-bin${s}`, 3, 'Bin #', 226, y0, 579, y1, { ...m, questionId: 'bin' });
        cell(`b-wet${s}`, 3, 'Fresh harvest weight (g)', 580, y0, 1079, y1, { ...m, questionId: 'wet', align: 'right' });
        cell(`b-run${s}`, 3, 'Subtotal on this page so far (g)', 1082, y0, 1612, y1, { ...m, source: 'calc', calc: 'pagerunsum({wet})', fontSize: 10 });
        cell(`b-waste${s}`, 3, 'Fresh waste (g)', 1615, y0, 2130, y1, { ...m, questionId: 'waste', align: 'right' });
        box(`b-wini${s}`, 3, 'Initials', 2138, y0 + 6, 2262, y1 - 6, { ...m, questionId: 'wini' });
    }
    cell('b-sub-a', 3, '(a) Subtotal for drying, this page', 1160, 2729, 1612, 2808, { source: 'calc', calc: 'pagesum({wet})', align: 'right', fontSize: 12 });
    cell('b-sub-b', 3, '(b) Fresh waste, this page', 1690, 2729, 2130, 2808, { source: 'calc', calc: 'pagesum({waste})', align: 'right', fontSize: 12 });
    box('b-copy', 3, 'Start of Drying Page', 1751, 2858, 1996, 2910, { source: 'copy.number', align: 'center', fontSize: 12 });
    box('b-copies', 3, 'Of', 2142, 2858, 2324, 2910, { source: 'copy.count', align: 'center', fontSize: 12 });
    write(S.build());
}

// ===================================================================================================
// 2 & 3. drying-log and trim-log — form page 4 (the same page image saved twice), one daily log each
// ===================================================================================================
{
    const S = sheetBuilder('drying-log', 'Daily Drying Log — p. 4', 'daily-weekly', 'drying-log', 1);
    const { box, cell, tick, q, lotHeader } = S;
    q('temp', 'Room temp (°F) — keep 60–65 °F', 'number', { rowScoped: true, mandatory: true, sameAsLast: true });
    q('rh', 'RH % — keep 40–60 %', 'number', { rowScoped: true, mandatory: true, sameAsLast: true });
    q('hygro', 'Hydrometer reading', 'number', { rowScoped: true, mandatory: true });
    q('moist', 'Bud moisture % — 8–14 %', 'number', { rowScoped: true, mandatory: true });
    q('equip', 'Equipment running (fans and dehumidifier)?', 'select', { rowScoped: true, mandatory: true, sameAsLast: true, options: YESNO });
    q('ini', 'Initials', 'initials', { rowScoped: true, mandatory: true });
    lotHeader(1);
    // 7 day rows (a page is a 7-day window): rows 8–10 of the form stay blank
    const tops = [733, 818, 902, 987, 1072, 1157, 1242], bottoms = [816, 901, 986, 1071, 1155, 1241, 1325], ticks = [760, 844, 929, 1014, 1099, 1184, 1268];
    for (let d = 1; d <= 7; d++) {
        const y0 = tops[d - 1], y1 = bottoms[d - 1], m = { dayGroup: 'g-dry', day: d }, s = d === 1 ? '' : `-d${d}`;
        cell(`b-date${s}`, 1, 'Date', 226, y0, 461, y1, { ...m, source: 'day.date', align: 'center' });
        cell(`b-temp${s}`, 1, 'Room Temp', 462, y0, 727, y1, { ...m, questionId: 'temp', align: 'center' });
        cell(`b-rh${s}`, 1, 'RH %', 728, y0, 992, y1, { ...m, questionId: 'rh', align: 'center' });
        cell(`b-hygro${s}`, 1, 'Hydrometer Reading', 993, y0, 1343, y1, { ...m, questionId: 'hygro', align: 'center' });
        cell(`b-moist${s}`, 1, 'Bud Moisture', 1344, y0, 1665, y1, { ...m, questionId: 'moist', align: 'center' });
        tick(`b-eq-y${s}`, 1, 'Equipment Yes', 1761, ticks[d - 1], 30, { ...m, questionId: 'equip', checkValue: 'Yes' });
        tick(`b-eq-n${s}`, 1, 'Equipment No', 1913, ticks[d - 1], 30, { ...m, questionId: 'equip', checkValue: 'No' });
        box(`b-ini${s}`, 1, 'Initials', 2115, y0 + 8, 2288, y1 - 8, { ...m, questionId: 'ini' });
    }
    write(S.build());
}
{
    const S = sheetBuilder('trim-log', 'Daily Trimming Log — p. 4', 'daily-weekly', 'trim-log', 1);
    const { box, cell, tick, q, lotHeader } = S;
    q('temp', 'Room temp (°F) — keep 60–65 °F', 'number', { rowScoped: true, mandatory: true, sameAsLast: true });
    q('rh', 'RH % — keep 40–60 %', 'number', { rowScoped: true, mandatory: true, sameAsLast: true });
    q('hygro', 'Hydrometer reading', 'number', { rowScoped: true, mandatory: true });
    q('clean', 'Method of cleaning conducted (dry: sweeping, air dusting, wiping · wet: 70 % IPA, chloro 2–5 %, PAA 70–300 ppm)', 'select', { rowScoped: true, mandatory: true, sameAsLast: true, options: ['Dry', 'Wet'] });
    q('ini', 'Initials', 'initials', { rowScoped: true, mandatory: true });
    lotHeader(1);
    const tops = [1880, 1965, 2049, 2134, 2219, 2304, 2389], bottoms = [1964, 2048, 2133, 2218, 2303, 2388, 2472], ticks = [1907, 1978, 2063, 2148, 2233, 2317, 2402];
    for (let d = 1; d <= 7; d++) {
        const y0 = tops[d - 1], y1 = bottoms[d - 1], m = { dayGroup: 'g-trim', day: d }, s = d === 1 ? '' : `-d${d}`;
        cell(`b-date${s}`, 1, 'Date', 226, y0, 581, y1, { ...m, source: 'day.date', align: 'center' });
        cell(`b-temp${s}`, 1, 'Room Temp', 582, y0, 881, y1, { ...m, questionId: 'temp', align: 'center' });
        cell(`b-rh${s}`, 1, 'RH %', 882, y0, 1181, y1, { ...m, questionId: 'rh', align: 'center' });
        cell(`b-hygro${s}`, 1, 'Hydrometer Reading', 1182, y0, 1613, y1, { ...m, questionId: 'hygro', align: 'center' });
        tick(`b-cl-dry${s}`, 1, 'Dry cleaning', 1722, ticks[d - 1], 30, { ...m, questionId: 'clean', checkValue: 'Dry' });
        tick(`b-cl-wet${s}`, 1, 'Wet cleaning', 1870, ticks[d - 1], 30, { ...m, questionId: 'clean', checkValue: 'Wet' });
        box(`b-ini${s}`, 1, 'Initials', 2108, y0 + 8, 2316, y1 - 8, { ...m, questionId: 'ini' });
    }
    write(S.build());
}

// ===================================================================================================
// 4. curing-log — form pages 5–7: curing, the bins moved to curing, the dried totals
// ===================================================================================================
{
    const S = sheetBuilder('curing-log', 'Curing — pp. 5–7', 'event', 'harvest', 3);
    const { box, cell, tick, q, lotHeader } = S;
    q('loc', 'Curing location', 'text', { prefillFrom: 'lot.currentRoom', mandatory: true });
    q('phase', 'Lot\'s phase now — pick Curing (not printed: sets the lot\'s phase in SitkaTools)', 'phase', { prefillFrom: 'lot.stage' });
    q('cstart', 'Curing start date', 'text', { prefillFrom: 'sheet.periodStart', mandatory: true });
    q('ck-clean', 'Trimming/drying room cleaning has been completed?', 'select', { options: YESNO, mandatory: true });
    q('cleandate', 'Date of last room clean', 'text', { mandatory: true });
    q('ck-tools', 'All tools & equipment for current operations are clean?', 'select', { options: YESNO, mandatory: true });
    q('analyzer', 'Moisture analyzer #', 'text', { mandatory: true });
    // page 5: moisture readings, one entry per reading (the form's four Date / % columns)
    q('m-date', 'Moisture reading — date', 'text', { repeating: true, prefillFrom: 'today.date', mandatory: true });
    q('m-pct', 'Moisture %', 'number', { repeating: true, mandatory: true });
    // page 5: scale verification (2 scales)
    scaleTable(S, 1, 'g-scale', [
        { top: 2380, bottom: 2612, subs: [2380, 2458, 2535], floor: 2402, bench: 2443, conf: [2402, 2480, 2558], yes: 2402, no: 2455 },
        { top: 2613, bottom: 2846, subs: [2613, 2691, 2769], floor: 2636, bench: 2677, conf: [2636, 2714, 2792], yes: 2636, no: 2689 }
    ], [224, 403, 631, 814, 1022, 1258, 1465, 1731, 1997, 2146, 2324]);
    // page 6: start of curing — one entry per bin
    q('cbin', 'Bin #', 'text', { repeating: true, mandatory: true });
    q('ctype', 'Type of product', 'select', { repeating: true, mandatory: true, sameAsLast: true, options: ['Flower', 'Trim', 'Other'] });
    q('tare', 'Tare weight (g) — bag and bin', 'number', { repeating: true, mandatory: true, sameAsLast: true });
    q('gross', 'Gross weight (g)', 'number', { repeating: true, mandatory: true });
    q('net', 'Net weight (g) — product only', 'number', { repeating: true, calc: '{gross} - {tare}', metric: 'harvest.dryWeight', metricUnit: 'g' });
    q('cini', 'Initials', 'initials', { repeating: true, mandatory: true, sameAsLast: true });
    // page 7: totals
    q('tot-c', '(c) Dried flower net weight (g)', 'number', { calc: 'sum({net}, {ctype} = "Flower")', metric: 'harvest.flowerTotal', metricUnit: 'g' });
    q('tot-d', '(d) Trim net weight (g)', 'number', { calc: 'sum({net}, {ctype} = "Trim")', metric: 'harvest.trim', metricUnit: 'g' });
    q('tot-e', '(e) Total dried flower net weight (g) = (c) + (d)', 'number', { calc: '{tot-c} + {tot-d}' });
    q('tot-f', '(f) Dried waste (g) — bud & leaves and trimmed leaves', 'number', { mandatory: true });
    q('tot-ini', 'Initials for the totals (c) to (f)', 'initials', { mandatory: true });
    q('notes', 'Notes (type N/A if none)', 'text', { mandatory: true });
    q('cend', 'Curing end date (fill in when curing ends)', 'text');

    // ---- page 1 of the sheet = form page 5: Curing ----
    lotHeader(1);
    cell('b-lot', 1, 'Lot #', 639, 593, 1087, 677, { source: 'lot.name' });
    cell('b-strain', 1, 'Strain Name', 1395, 593, 2323, 677, { source: 'lot.strain' });
    cell('b-loc', 1, 'Curing Location', 639, 678, 1525, 791, { questionId: 'loc' });
    for (const [x, y, v] of [[1785, 692, 'B6'], [1992, 692, 'B66D'], [1785, 748, 'B54A'], [2170, 720, 'B54D']])
        tick(`b-bld-${v}`, 1, `Building ${v}`, x, y, 30, { source: 'calc', calc: 'first(building({loc}), building(lot.currentRoom))', checkValue: v });
    // over the form's grey YYYY-MM-DD placeholders
    cell('b-cstart', 1, 'Curing Start Date', 743, 792, 1022, 876, { questionId: 'cstart' });
    cell('b-cend', 1, 'Curing End Date', 1483, 792, 1772, 876, { questionId: 'cend' });
    cell('b-cdays', 1, 'Days of Curing', 2146, 792, 2324, 876, { source: 'calc', calc: 'days({cstart}, {cend})', align: 'center' });
    tick('b-ck-clean', 1, 'Room cleaning completed', 227, 971, 30, { questionId: 'ck-clean', checkValue: 'Yes' });
    tick('b-ck-tools', 1, 'Tools clean', 227, 1039, 30, { questionId: 'ck-tools', checkValue: 'Yes' });
    box('b-cleandate', 1, 'Date of last room clean', 1938, 958, 2320, 1002, { questionId: 'cleandate' });
    box('b-analyzer', 1, 'Moisture Analyzer #', 635, 1714, 1230, 1760, { questionId: 'analyzer' });
    const mcols = [[226, 750], [751, 1274], [1275, 1799], [1800, 2324]];
    mcols.forEach(([x0, x1], i) => {
        const m = { repeat: true, dayGroup: 'g-moist', day: i + 1 }, s = i === 0 ? '' : `-r${i + 1}`;
        cell(`b-mdate${s}`, 1, 'Date', x0 + 140, 1825, x1, 1908, { ...m, questionId: 'm-date' });
        cell(`b-mpct${s}`, 1, '%', x0 + 10, 1910, x1 - 70, 1993, { ...m, questionId: 'm-pct', align: 'right' });
    });

    // ---- page 2 of the sheet = form page 6: Start of curing ----
    lotHeader(2);
    const lines6 = [757, 861, 965, 1069, 1173, 1277, 1381, 1485, 1589, 1693, 1797, 1901, 2005, 2109, 2213, 2317, 2421, 2525, 2629, 2733, 2837, 2941];
    for (let r = 1; r <= 21; r++) {
        const y0 = lines6[r - 1] + 2, y1 = lines6[r] - 1, m = { repeat: true, dayGroup: 'g-cure', day: r }, s = r === 1 ? '' : `-r${r}`;
        cell(`b-cbin${s}`, 2, 'Bin #', 226, y0, 438, y1, { ...m, questionId: 'cbin', fontSize: 12 });
        tick(`b-flower${s}`, 2, 'Flower', 455, y0 + 11, 36, { ...m, questionId: 'ctype', checkValue: 'Flower' });
        tick(`b-trim${s}`, 2, 'Trim', 641, y0 + 35, 36, { ...m, questionId: 'ctype', checkValue: 'Trim' });
        tick(`b-other${s}`, 2, 'Other', 827, y0 + 11, 36, { ...m, questionId: 'ctype', checkValue: 'Other' });
        cell(`b-tare${s}`, 2, 'Tare Weight (g)', 999, y0, 1346, y1, { ...m, questionId: 'tare', align: 'right', fontSize: 12 });
        cell(`b-gross${s}`, 2, 'Gross Weight (g)', 1347, y0, 1747, y1, { ...m, questionId: 'gross', align: 'right', fontSize: 12 });
        cell(`b-net${s}`, 2, 'Net Weight (g)', 1748, y0, 2148, y1, { ...m, questionId: 'net', align: 'right', fontSize: 12 });
        box(`b-cini${s}`, 2, 'Initials', 2157, y0 + 10, 2290, y1 - 10, { ...m, questionId: 'cini' });
    }

    // ---- page 3 of the sheet = form page 7: totals (its 15 bin rows stay blank: a table's rows can't span two pages) ----
    lotHeader(3);
    for (const [id, qid, y0, y1] of [['c', 'tot-c', 2115, 2252], ['d', 'tot-d', 2254, 2335], ['e', 'tot-e', 2337, 2477], ['f', 'tot-f', 2479, 2672]]) {
        cell(`b-tot-${id}`, 3, `(${id}) net weight`, 1750, y0, 2147, y1, { questionId: qid, align: 'right', fontSize: 12 });
        box(`b-tot-${id}-ini`, 3, `(${id}) initials`, 2158, y0 + 12, 2316, y1 - 12, { questionId: 'tot-ini' });
    }
    box('b-notes', 3, 'Notes', 425, 2770, 2320, 2940, { questionId: 'notes' });
    write(S.build());
}

// ===================================================================================================
// 5. lot-summary — form pages 8–9: the weights summary and the lot cultivation summary (close-out)
// ===================================================================================================
{
    const S = sheetBuilder('lot-summary', 'Weights & Lot Summary — pp. 8–9', 'event', 'harvest', 2);
    const { box, cell, tick, q, lotHeader } = S;
    q('gwaste', '(g) Trim dried waste weight (g) — all trimmed waste after curing, before bulk packaging', 'number', { mandatory: true });
    q('altname', 'Alternate name (type N/A if none)', 'text', { mandatory: true });
    q('seeds', 'Weight of seeds produced (g) (type N/A if none)', 'text', { mandatory: true });
    const records = [['rec-pest', 'Pesticide in Use Form'], ['rec-dtc', 'Drying/Trimming/Curing Log'], ['rec-grow', 'Grow/Fertilizer Log'],
        ['rec-growclean', 'Grow Room Cleaning Form'], ['rec-cultclean', 'Cultivation Rooms Cleaning Form'], ['rec-prop', 'Propagation Worksheet'],
        ['rec-irr', 'Irrigation Lines Cleaning & Disinfection Form'], ['rec-tank', 'Tank Cleaning and Disinfection Form']];
    for (const [id, name] of records) q(id, `Records attached — ${name}?`, 'select', { options: YESNO, mandatory: true });
    q('qa', 'Approved by QA — signature', 'initials', { mandatory: true });
    q('qadate', 'Approved by QA — date', 'text', { prefillFrom: 'today.date', mandatory: true });

    // ---- page 1 of the sheet = form page 8: Drying and curing weights summary ----
    lotHeader(1);
    const v8 = (id, label, y0, y1, calc, more = {}) => cell(id, 1, label, 1526, y0, 2324, y1, { source: calc ? 'calc' : null, calc, align: 'right', fontSize: 13, ...more });
    v8('b-a', '(a) Total fresh harvest weight (g)', 621, 728, 'sum({harvest-log/wet})');
    v8('b-b', '(b) Total fresh waste weight (g)', 729, 836, 'sum({harvest-log/waste})');
    v8('b-e', '(e) Total dried flower net weight (g)', 946, 1059, '{curing-log/tot-e}');
    v8('b-f', '(f) Dried waste weight (g)', 1060, 1228, '{curing-log/tot-f}');
    v8('b-g', '(g) Trim dried waste weight (g)', 1338, 1476, null, { questionId: 'gwaste' });
    // The master grower's ✍️ signature (signed on page 9) again here, and its date
    box('b-mg8', 1, 'Reviewed by Master Grower (✍️ Sign)', 240, 1600, 1620, 1712, { source: 'signature.strokes' });
    cell('b-mg8date', 1, 'Date', 1640, 1600, 2318, 1712, { source: 'signature.date', fontSize: 13 });

    // ---- page 2 of the sheet = form page 9: Lot cultivation summary ----
    lotHeader(2);
    const v9 = (id, label, y0, y1, more) => cell(id, 2, label, 994, y0, 2324, y1, more);
    v9('b-prop', 'Propagation Date', 522, 594, { source: 'lot.createdDate' });
    v9('b-veg', 'Vegetative Start Date', 595, 667, { source: 'log.vegStart' });
    for (const [x, v] of [[1194, 'B6'], [1372, 'B66D'], [1616, 'B54D'], [1860, 'B54A']])
        tick(`b-bld-${v}`, 2, `Building ${v}`, x, 689, 30, { source: 'calc', calc: 'building(lot.destRoom)', checkValue: v });
    v9('b-room', 'Grow Room #', 741, 813, { source: 'lot.destRoom' });
    v9('b-lotno', 'Lot Number', 814, 886, { source: 'lot.name' });
    v9('b-strain', 'Strain Type', 887, 959, { source: 'lot.strain' });
    v9('b-alt', 'Alternate Name', 960, 1032, { questionId: 'altname' });
    const g9 = (id, label, y0, y1, more) => cell(id, 2, label, 1633, y0, 2324, y1, { align: 'right', ...more });
    g9('b-planted', 'Seeds planted (g) or clones planted', 1091, 1163, { source: 'lot.startPlantCount' });
    g9('b-hdate', 'Harvest Date', 1164, 1235, { source: 'calc', calc: '{harvest-log/hdate}' });
    g9('b-source', 'Lot# of Seed / Clone Source', 1236, 1308, { source: 'lot.parentLotId' });
    g9('b-seeds', 'Weight of Seeds Produced (g)', 1309, 1381, { questionId: 'seeds' });
    g9('b-clones', 'Number of Clones Produced', 1382, 1454, { source: 'lot.clonesProduced' });
    g9('b-harv', 'Number of Plants Harvested', 1455, 1527, { source: 'log.plantsHarvested' });
    g9('b-destr', 'Number of Plants Destroyed', 1528, 1600, { source: 'log.plantsDestroyed' });
    g9('b-a9', '(a) Total Fresh Harvest Weight (g)', 1601, 1714, { source: 'calc', calc: '{b-a}' });
    g9('b-e9', '(e) Total Dried Flower Net Weight (g)', 1715, 1787, { source: 'calc', calc: '{b-e}' });
    g9('b-loss', 'Loss in Drying (g) = (a) − (e)', 1788, 1860, { source: 'calc', calc: '{b-a} - {b-e}' });
    g9('b-totwaste', 'Total Fresh/Dried Waste (g) = (b) + (f) + (g)', 1861, 1974, { source: 'calc', calc: '{b-b} + {b-f} + {gwaste}' });
    cell('b-mg9date', 2, 'Date', 1640, 2028, 2318, 2138, { source: 'signature.date', fontSize: 13 });
    const recY = [2263, 2327, 2392, 2456, 2520, 2585, 2649, 2714];
    records.forEach(([id], i) => tick(`b-${id}`, 2, id, 244, recY[i] - 3, 40, { questionId: id, checkValue: 'Yes' }));
    box('b-qa', 2, 'Approved by QA, Signature', 240, 2822, 1850, 2898, { questionId: 'qa' });
    cell('b-qadate', 2, 'QA Date', 1876, 2822, 2318, 2898, { questionId: 'qadate', fontSize: 13 });
    write(S.build({ id: 'sig9', label: 'Reviewed by Master Grower, Signature', x: r4(240 / W), y: r4(2028 / H), w: r4((1620 - 240) / W), h: r4((2138 - 2028) / H), page: 2 }));
}
