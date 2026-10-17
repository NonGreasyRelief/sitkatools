// Example DB data — run by make-example-db.js after EmployeeWizard's own script, so the past crops are summarised by
// rptBuildCrop / rptSaveSummaries (the same path as Reports → Import archived lots) and every page is checked.
const SRC = JSON.parse(fs.readFileSync(path.join(ROOT, 'PaperWizard', 'Current.json'), 'utf8'));
const CLW_HTML = fs.readFileSync(path.join(ROOT, 'CropLabourWizard', 'CropLabourWizard.html'), 'utf8');
const TODAY = rToday();
let seed = 20261012;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const U = (a, b) => a + (b - a) * rnd();
const NRM = (m, sd) => m + sd * ((rnd() + rnd() + rnd() + rnd() - 2) * 1.2247);
const pick = a => a[Math.floor(rnd() * a.length)];
const ALPH = 'abcdefghjkmnpqrstuvwxyz23456789';
const rid = n => Array.from({ length: n }, () => ALPH[Math.floor(rnd() * ALPH.length)]).join('');
const evId = () => 'ev_' + rid(10);
const q4 = h => Math.max(0.25, Math.round(h * 4) / 4);
const r1 = (v, d = 1) => Number(v.toFixed(d));
const doy = s => { const d = parseISO(s); return Math.round((d - new Date(d.getFullYear(), 0, 0)) / 86400000); };

const db = JSON.parse(JSON.stringify(SRC));
delete db._meta;
const ROSTER = Object.keys(db._EmployeeWizard.employees);           // real names, real wages
// Floor managers (EmployeeWizard → Floor manager): who DailyWizard's ✅ Mark done offers, and who signed recent tasks off
const FLOOR_MANAGERS = ['Will', 'Kasia', 'Matt'].filter(n => db._EmployeeWizard.employees[n]);
for (const n of FLOOR_MANAGERS) db._EmployeeWizard.employees[n].floorManager = true;
// Made-up progress over the 3 years: 0 three years ago → 1 today. Yield, THC, terpenes and grade rise with it and
// labour per crop falls, so every trend reads as a business getting better.
const START = dMonths(TODAY, -36);
const prog = day => Math.min(1, Math.max(0, dDiff(START, day) / Math.max(1, dDiff(START, TODAY))));
const lift = p => 0.35 * p + 0.65 * p * p;   // the improvement builds: gentle at first, strongest in the last year
const INITIALS_STROKES = name => [[0.1, 0.7, 0.16, 0.25, 0.22, 0.7], [0.13, 0.5, 0.2, 0.5], [0.32, 0.7, 0.32, 0.25, 0.44, 0.45, 0.32, 0.5]].map(st => st.map((v, i) => i % 2 ? v : v + (name.charCodeAt(0) % 5) * 0.02));

// ---- 1. Rooms (Room Manager): lights, watts per light, canopy, light cycles; report settings ----
const ROOM_POWER = {   // [lights, watts per light, canopy sq ft]
    B66DG1: [72, 1000, 1150], B66DG2: [72, 1000, 1150], B6G2: [48, 1000, 800],
    B6VEG: [24, 630, null], B6CLONE: [12, 100, null], B6MOM: [8, 630, null]
};
for (const [id, [n, w, sq]] of Object.entries(ROOM_POWER)) {
    if (!db.rooms[id]) continue;
    Object.assign(db.rooms[id], { lightCount: n, lightWattage: w, vegLightHours: 18, bloomLightHours: 12, ...(sq ? { canopySqFt: sq } : {}) });
}
db._EmployeeWizard.settings = { shiftHours: 8 };

// ---- 2. A recipe with labour estimates (the built-in tasks + minutes × staff) ----
const EST = {
    clone_cut_prep: [3, 360], planting: [4, 420], clone_room_clean: [2, 180], ipm_spray_veg_early: [2, 120], topping: [3, 300],
    order_ipm: [1, 30], layout_coco_blocks: [3, 240], hydrate_coco_blocks: [2, 240], undercanopy_lights: [3, 360], transplant: [6, 480],
    ipm_spray_veg_second: [2, 120], veg_room_clean: [2, 240], deploy_ipm: [2, 120], prune: [5, 480], flip: [1, 60],
    ipm_spray_flower_start: [2, 120], trellis_layout: [4, 420], ipm_spray_flower_week2: [2, 120], leafpick_early: [5, 480],
    clone_cut: [3, 360], leafpick_late: [5, 480], harvest: [8, 480], room_clean: [3, 420], tank_irrigation_clean: [2, 300],
    tote_prep: [2, 180], bucking: [4, 480], lab_sample: [1, 60], trim_room_prep: [2, 120], trim: [8, 480], machine_trim: [2, 300],
    dry_room_clean: [2, 300], weigh_ship: [2, 240]
};
const recipeStart = CLW_HTML.indexOf("name: 'Sitka Standard (9-week bloom)'");
const recipeBlock = CLW_HTML.slice(recipeStart, CLW_HTML.indexOf('\n            ]', recipeStart));
const tasks = [];
for (const m of recipeBlock.matchAll(/\{ name: '([^']*)', emoji: '([^']*)', taskType: '([^']*)', reference: '([^']*)', defaultOffset: (-?\d+)([^}]*)\}/g)) {
    const [, name, emoji, taskType, reference, off, rest] = m;
    const t = { taskType, name, emoji, reference, defaultOffset: Number(off) };
    if (/hasToggle: true/.test(rest)) t.hasToggle = true;
    if (/defaultEnabled: false/.test(rest)) t.defaultEnabled = false;
    if (/isLocked: true/.test(rest)) t.isLocked = true;
    const e = EST[taskType] || [1, 60];
    t.staff = e[0]; t.minutes = e[1];
    tasks.push(t);
}
if (tasks.length !== 32) throw new Error('recipe parse: ' + tasks.length + ' tasks');
const RECIPE_ID = 'xmpe23';
// The price list (CropLabourWizard → recipe → 🧪 Inputs): fertilizers per litre, supplies per unit
const INPUTS = {
    inactv: { name: 'Activator', kind: 'fertilizer', unit: 'L', price: 48 }, incore: { name: 'Core', kind: 'fertilizer', unit: 'L', price: 36 },
    infade: { name: 'Fade', kind: 'fertilizer', unit: 'L', price: 38 }, ingrow: { name: 'Grow', kind: 'fertilizer', unit: 'L', price: 32 },
    inblom: { name: 'Bloom', kind: 'fertilizer', unit: 'L', price: 34 }, inphup: { name: 'pH Up', kind: 'fertilizer', unit: 'L', price: 20 },
    incoco: { name: 'Coco block', kind: 'supply', unit: 'block', price: 3.5 }, inpeat: { name: 'Peat puck', kind: 'supply', unit: 'puck', price: 0.22 },
    intrel: { name: 'Trellis netting', kind: 'supply', unit: 'ft', price: 0.15 }
};
db._CropLabourWizard.inputs = INPUTS;
const RECIPE_INPUTS = [['inpeat', 1, 'plant'], ['incoco', 1, 'plant'], ['intrel', 300, 'crop']]
    .map(([id, qty, per]) => ({ inputId: id, name: INPUTS[id].name, unit: INPUTS[id].unit, qty, per }));
db._CropLabourWizard.recipes = { [RECIPE_ID]: { id: RECIPE_ID, name: 'Sitka Standard (9-week) — example labour estimates', version: 1, chain: { cloneCutBeforeHarvest: 21 }, tasks, inputs: RECIPE_INPUTS } };
for (const lot of Object.values(db.lots)) lot._tool_CropLabourWizard = { ...(lot._tool_CropLabourWizard || {}), recipeId: RECIPE_ID };
for (const p of Object.values(db._CropLabourWizard.projectedLots || {})) p.config = { ...(p.config || {}), recipeId: RECIPE_ID };
const estOf = tt => EST[tt] ? { staff: EST[tt][0], minutes: EST[tt][1] } : null;
for (const ev of db.calendarEvents) {
    if ((ev.sourceTool === 'CropLabourWizard' || ev.sourceTool === 'CropProjection') && estOf(ev.taskType)) { ev.estStaff = estOf(ev.taskType).staff; ev.estMinutes = estOf(ev.taskType).minutes; }
}

// ---- 3. Labour on a crop task: who worked each day, and for how long ----
const OVER = { trim: 1.2, leafpick_early: 1.26, leafpick_late: 1.14, harvest: 1.1, prune: 1.12, room_clean: 1.1, transplant: 0.93, planting: 0.9, undercanopy_lights: 0.9, bucking: 0.95, trellis_layout: 1.05 };
const TEMPY = new Set(['trim', 'harvest', 'bucking', 'leafpick_early', 'leafpick_late', 'machine_trim']);
function labourFor(ev, building, signedFrom) {
    const est = estOf(ev.taskType);
    if (!est) return null;
    const map = {};
    for (let d = ev.date; d <= (ev.endDate || ev.date) && d < TODAY; d = dAdd(d, 1)) {
        const total = est.staff * est.minutes / 60 * (OVER[ev.taskType] || 1) * (1.14 - 0.16 * prog(d)) * U(0.92, 1.08);
        const n = Math.max(1, Math.min(est.staff + (rnd() < 0.3 ? 1 : 0), 10));
        const staff = [...ROSTER].sort(() => rnd() - 0.5).slice(0, Math.min(n, TEMPY.has(ev.taskType) ? 3 : 5));
        const temps = TEMPY.has(ev.taskType) ? Array.from({ length: Math.max(0, n - staff.length) }, (_, i) => `Temp ${i + 1}`) : [];
        const people = staff.length + temps.length;
        const signed = signedFrom && d >= signedFrom;    // recent days: logged and signed on the building tablet
        const stamp = name => signed ? { initials: { name, strokes: INITIALS_STROKES(name) }, at: new Date(parseISO(d).getTime() + 15 * 3600000).toISOString(), by: building } : {};
        map[d] = [
            ...staff.map(name => ({ employee: name, hours: q4(total / people * U(0.85, 1.15)), ...stamp(name) })),
            ...temps.map(name => ({ temp: name, wage: 22, hours: q4(total / people * U(0.85, 1.15)), ...stamp(name) }))
        ];
    }
    return Object.keys(map).length ? map : null;
}

// ---- 4. Grow-log and harvest-log paperwork (answers to the tagged questions) ----
// Report metric tags on the real grow-log wizard (jrgt)
const GROW_TAGS = { smtv: ['env.temp', 'F'], '45nq': ['env.rh'], '9f7n': ['feed.ph'], gjaw: ['feed.ec'], a56r: ['env.co2'], huut: ['env.par'],
    k3v3: ['feed.nutrient'], nmgx: ['feed.nutrient'], wknf: ['feed.nutrient'], '7nws': ['water.total'], tvzw: ['water.perPlant'], z8cc: ['water.runoff'],
    pbcb: ['runoff.ec'], npbe: ['runoff.ec'], ruur: ['runoff.ph'], qz4q: ['runoff.ph'], zsfp: ['ipm.pests'], z8fw: ['ipm.disease'], af9s: ['ipm.herm'], u9ts: ['ipm.issue'] };
for (const q of db._PaperWizard.wizards.jrgt.questions) if (GROW_TAGS[q.id]) { q.metric = GROW_TAGS[q.id][0]; if (GROW_TAGS[q.id][1]) q.metricUnit = GROW_TAGS[q.id][1]; }
// Each fertilizer mL question's product: Activator always; Core / Fade and Grow / Bloom from the question before it
const PRODUCT_LINKS = { k3v3: { name: 'Activator' }, nmgx: { from: '6p8t' }, wknf: { from: 'qvds' } };
for (const q of db._PaperWizard.wizards.jrgt.questions) if (PRODUCT_LINKS[q.id]) q.metricProduct = PRODUCT_LINKS[q.id];
// A daily light % question (notes only — the paper form has no box for it yet), for the lighting power estimate
db._PaperWizard.wizards.jrgt.questions.push({ id: 'lt01', label: 'What % are the lights set to?', type: 'number', options: [], rowScoped: true, sameAsLast: true, mandatory: false, prefillFrom: null, metric: 'env.lightPct' });
// An example harvest log sheet (no page images — it exists to feed the reports), tagged with the harvest metrics
db._PaperWizard.sheets.harvestlog = { name: 'Harvest Log (example)', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'event', document: 'harvest', fields: [], signature: null };
const HQ = [['hw01', 'Wet weight in the drying room on harvest day (kg)', 'harvest.wetWeight', 'kg'], ['hw10', 'Plants harvested', 'harvest.plantsHarvested'],
    ['hw02', 'Dry weight, whole lot (kg)', 'harvest.dryWeight', 'kg'], ['hw03', 'Bigs (g)', 'harvest.bigs', 'g'], ['hw04', 'Mids (g)', 'harvest.mids', 'g'],
    ['hw05', 'Smalls (g)', 'harvest.smalls', 'g'], ['hw06', 'Popcorn (g)', 'harvest.popcorn', 'g'], ['hw07', 'Trim (g)', 'harvest.trim', 'g'],
    ['hw08', 'Total THC % (lab result)', 'harvest.potency'], ['hw09', 'Total terpenes % (lab result)', 'harvest.terpenes']];
db._PaperWizard.wizards.hv01 = { sheetId: 'harvestlog', name: 'Harvest Log Wizard (example)', questions: HQ.map(([id, label, metric, unit]) => ({ id, label, type: 'number', options: [], rowScoped: false, sameAsLast: false, mandatory: false, prefillFrom: null, metric, ...(unit ? { metricUnit: unit } : {}) })) };

const STAFF_INITIALS = ROSTER;
function growLog(lot, lotId, d, started, harvested, flowerRoom, until, ipmPlan) {
    const start = d.planting, end = until;
    const instances = {};
    const n = Math.max(1, dDiff(start, d.harvestStart || end));
    let inst = null, instKey = null;
    const phaseOf = day => day < d.flip ? 'Vegetation' : 'Bloom';
    const roomOf = day => day < d.transplant ? (lot.vegRoom || 'Vegetation Room') : flowerRoom;
    for (let day = start, i = 0; day <= end; day = dAdd(day, 1), i++) {
        const room = roomOf(day), phase = phaseOf(day);
        const change = inst && (inst.room !== room || inst.phase !== phase);
        if (!inst || change || dDiff(instKey, day) >= 7) {
            if (inst && change) inst.phaseChangeDate = day;
            instKey = day;
            inst = instances[day] = { phase, room, header: { p842: `SL-${lotId}-${rid(3).toUpperCase()}` }, days: {}, phaseChangeDate: null, strikeInitials: null,
                snapshots: { 'lot.name': lotId, 'lot.strain': lot.strain, 'lot.stage': phase, 'lot.plantCount': String(harvested) }, signature: null, completedAt: null, printedAt: null };
        }
        const t = i / n, season = Math.sin(2 * Math.PI * (doy(day) - 110) / 365);    // +1 in late July, −1 in late January
        const flower = day >= d.flip, late = day >= dAdd(d.flip, 42);
        const spike = ipmPlan?.spike && day >= ipmPlan.spike && day <= dAdd(ipmPlan.spike, 3);
        const tempF = NRM(76.8 + 3.2 * season - (late ? 1.5 : 0) + (spike ? 1.4 : 0), 0.7);
        const rh = NRM((flower ? (late ? 49 : 56) : 63) + 2.5 * season + (spike ? 9 : 0), 1.6);
        const feedEc = flower ? (late ? 1.7 : 2.4) : 1.8, perPlant = flower ? 2.1 : 1.1;
        const plants = Math.round(started - (started - harvested) * Math.min(1, t * 1.15));
        const who = pick(STAFF_INITIALS);
        const yes = key => (ipmPlan?.[key] || []).includes(day) || rnd() < ({ pests: 0.012, disease: 0.006, herm: 0.003, issue: 0.02 })[key] ? 'YES' : 'NO';
        inst.days[day] = {
            '39kn': room, zka6: String(plants), exe3: phase,
            zsfp: yes('pests'), z8fw: yes('disease'), af9s: yes('herm'), u9ts: yes('issue'),
            smtv: r1(tempF), '45nq': String(Math.round(rh)), '9f7n': r1(NRM(5.95, 0.08), 2), gjaw: r1(NRM(feedEc, 0.08), 2),
            a56r: String(Math.round(NRM(flower ? 1150 : 850, 40))), huut: String(Math.round(NRM(flower ? (late ? 900 : 1000) : 600, 25))),
            qy8c: 'YES', k3v3: String(Math.round(NRM(500, 40))), '6p8t': late ? 'Fade' : flower ? 'Core' : 'No', nmgx: flower ? String(Math.round(NRM(650, 50))) : '0',
            lt01: String(Math.round(flower ? (late ? 90 : Math.min(100, 80 + (day >= dAdd(d.flip, 14) ? 20 : 10))) : 75)),
            qvds: flower ? 'Bloom' : 'Grow', wknf: String(Math.round(NRM(1000, 80))),
            '7nws': String(Math.round(plants * NRM(perPlant, 0.08))), tvzw: r1(NRM(perPlant, 0.08), 2), z8cc: String(Math.round(NRM(220, 30))),
            pbcb: r1(NRM(feedEc + 0.3 + 0.5 * t, 0.12), 2), ruur: r1(NRM(6.2, 0.1), 2), npbe: r1(NRM(feedEc + 0.35 + 0.5 * t, 0.12), 2), qz4q: r1(NRM(6.25, 0.1), 2),
            v5rk: 'Emitter', '9vjk': who, vkv4: { name: who.slice(0, 2).toUpperCase(), strokes: INITIALS_STROKES(who) }
        };
    }
    return { instances };
}
// Harvest numbers, from 1000 g wet per plant: strain, room, climate and luck move it
const STRAIN = {
    'White Hot Guava': { wet: 1.0, thc: 26.8, terp: 2.95 }, 'Chimera Junky': { wet: 0.99, thc: 27.3, terp: 2.75 },
    'Jealousy x Kush Mints': { wet: 1.02, thc: 27.1, terp: 3.05 }, 'Lemon Cherry Gelato': { wet: 0.98, thc: 26.5, terp: 2.8 }
};
// p: the crop's place in the 3-year improvement (prog of its harvest day). best: the newest harvest, at the top of the trend
function harvestNumbers(strain, plants, roomF, flowerTemp, p, best = false) {
    const s = STRAIN[strain], L = lift(p);
    const climate = 1 - 0.01 * Math.max(0, flowerTemp - 76.5);    // hot flower rooms cost a little yield
    const wet = plants * 1000 * s.wet * roomF * climate * (0.86 + 0.2 * L) * (best ? 1.012 : U(0.99, 1.01));
    const dry = wet * (0.228 + 0.012 * L) * U(0.995, 1.005), total = dry * (1 - U(0.125, 0.135)), trim = total * (0.19 - 0.03 * L) * U(0.98, 1.02), flower = total - trim;
    const g = { bigs: 0.40 + 0.09 * L + U(-0.01, 0.01), mids: U(0.28, 0.31), smalls: 0.18 - 0.04 * L + U(-0.008, 0.008) };
    g.popcorn = Math.max(0.04, 1 - g.bigs - g.mids - g.smalls);
    const sum = g.bigs + g.mids + g.smalls + g.popcorn;
    return { wet, dry, trim, flower, grades: Object.fromEntries(Object.entries(g).map(([k, v]) => [k, flower * v / sum])),
        thc: s.thc - 2.2 + 3.4 * L + (best ? 0.35 : NRM(0, 0.15)), terp: s.terp - 0.45 + 0.7 * L - 0.03 * Math.max(0, flowerTemp - 77) + (best ? 0.08 : NRM(0, 0.04)) };
}
function harvestLog(d, h, plants) {
    const instances = {};
    instances[d.harvestStart] = { phase: null, header: { hw01: r1(h.wet / 1000), hw10: String(plants) }, days: {} };
    instances[d.bucking || dAdd(d.harvestStart, 10)] = { phase: null, header: { hw02: r1(h.dry / 1000) }, days: {} };
    instances[d.ship || dAdd(d.harvestStart, 19)] = { phase: null, header: { hw03: String(Math.round(h.grades.bigs)), hw04: String(Math.round(h.grades.mids)), hw05: String(Math.round(h.grades.smalls)), hw06: String(Math.round(h.grades.popcorn)), hw07: String(Math.round(h.trim)) }, days: {} };
    const lab = dAdd(d.ship || dAdd(d.harvestStart, 19), 9);
    if (lab < TODAY) instances[lab] = { phase: null, header: { hw08: r1(h.thc), hw09: r1(h.terp, 2) }, days: {} };
    for (const inst of Object.values(instances)) Object.assign(inst, { phaseChangeDate: null, strikeInitials: null, snapshots: {}, signature: null, completedAt: null, printedAt: null });
    return { instances };
}
const flowerAvgTemp = (paper, d) => {
    const v = [];
    for (const inst of Object.values(paper.instances)) for (const [day, a] of Object.entries(inst.days)) if (day >= d.flip && day < d.harvestStart && a.smtv != null) v.push(Number(a.smtv));
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 77;
};

// ---- 5. Past crops (closed out, kept as crop summaries) — 76-day cadence back from each room's real lots ----
DB.data = db; DB.ensureStructure();
const byLotEv = {};
for (const ev of db.calendarEvents) if (ev.sourceTool === 'CropLabourWizard') (byLotEv[ev.lotId] || (byLotEv[ev.lotId] = [])).push(ev);
const T1179 = byLotEv['1179'], H1179 = T1179.find(e => e.taskType === 'harvest').date;
const TEMPLATE = T1179.map(e => ({ taskType: e.taskType, title: e.title, off: dDiff(H1179, e.date), len: e.endDate ? dDiff(e.date, e.endDate) : 0 }));
const datesFrom = evs => { const g = tt => evs.find(e => e.taskType === tt); return {
    day0: g('clone_cut_prep')?.date, planting: g('planting')?.date, transplant: g('transplant')?.date, flip: g('flip')?.date,
    harvestStart: g('harvest')?.date, bucking: g('bucking')?.date, ship: g('weigh_ship')?.date }; };
const ANCHOR = { B66DG1: datesFrom(byLotEv['1171']).harvestStart, B66DG2: datesFrom(byLotEv['1137']).harvestStart, B6G2: H1179 };
const [WHG, CJ, JX, LCG] = Object.keys(STRAIN);
const ROT = {
    B66DG1: [CJ, WHG, CJ, JX, CJ, WHG, CJ, LCG, CJ, LCG, WHG, CJ, JX, CJ, WHG, CJ],
    B66DG2: [WHG, CJ, WHG, JX, WHG, CJ, WHG, LCG, JX, WHG, LCG, CJ, WHG, JX, CJ, WHG],
    B6G2: [JX, JX, WHG, JX, CJ, JX, JX, LCG, JX, WHG, JX, LCG, JX, CJ, JX, WHG]
};
const cutoff = dAdd(dMonths(TODAY, -36), 10);   // 3 years, inside the reports' 36-month summary window
const past = [];
for (const room of Object.keys(ANCHOR)) {
    let h = ANCHOR[room];
    for (let k = 1; k <= ROT[room].length; k++) {
        h = dAdd(h, -76 - (k > 1 && rnd() < 0.2 ? Math.round(U(3, 9)) : 0));   // now and then a slow turnaround
        if (h < cutoff) break;
        past.push({ room, k, strain: ROT[room][k - 1], harvest: h });
    }
}
past.sort((a, b) => a.harvest.localeCompare(b.harvest));
const pastCrops = [];
past.forEach((p, i) => {
    const lotId = String(1001 + i * 3);   // stays below the real lots' numbers
    const roomName = db.rooms[p.room].name;
    const plants = p.room === 'B6G2' ? Math.round(NRM(380, 4)) : Math.round(NRM(540, 6));
    const started = Math.round(plants / U(0.93, 0.985));
    const events = TEMPLATE.map(t => {
        const date = dAdd(p.harvest, t.off);
        const title = t.title.replace(/#1179/, '#' + lotId).replace('Jealousy x Kush Mints', p.strain).replace(/^(\S+ )B6G2/, `$1${p.room}`);
        const ev = { id: evId(), lotId, date, ...(t.len ? { endDate: dAdd(date, t.len) } : {}), title, sourceTool: 'CropLabourWizard', taskType: t.taskType, completed: true };
        if (estOf(t.taskType)) { ev.estStaff = estOf(t.taskType).staff; ev.estMinutes = estOf(t.taskType).minutes; }
        const lm = labourFor(ev, db.rooms[p.room].buildingId, null);
        if (lm) ev.labour_map = lm;
        return ev;
    });
    const d = datesFrom(events);
    const lot = { name: lotId, strain: p.strain, stage: 'shipped', createdDate: d.day0, closedDate: d.ship, destRoom: roomName, vegRoom: 'Vegetation Room', cloningRoom: 'Clone Room', currentRoom: roomName, plantCount: plants, parentLotId: null, type: 'new-lot', _tool_CropLabourWizard: { recipeId: RECIPE_ID } };
    const ipm = rnd() < 0.25 ? { spike: dAdd(d.flip, Math.round(U(20, 40))) } : null;
    if (ipm) { ipm.pests = [dAdd(ipm.spike, 1), dAdd(ipm.spike, 2)]; if (rnd() < 0.4) ipm.herm = [dAdd(ipm.spike, 3)]; }
    const grow = growLog(lot, lotId, d, started, plants, roomName, dAdd(d.harvestStart, -1), ipm);
    const roomF = { B66DG1: 1.0, B66DG2: 1.0, B6G2: 1.01 }[p.room];
    const h = harvestNumbers(p.strain, plants, roomF, flowerAvgTemp(grow, d), prog(p.harvest));
    const paper = { growlog: grow, harvestlog: harvestLog(d, h, plants) };
    pastCrops.push(rptBuildCrop(lotId, lot, events, paper, rptQuestionMap()));
});

// ---- 6. Live lots: labour so far, grow logs, and the harvest log of the lot that has shipped ----
// Yesterday's Grow 2 harvest is left open (hours logged, not signed off), so DailyWizard's ⏰ Still open has one
const overdue = new Set([byLotEv['1179'].find(e => e.taskType === 'harvest')?.id]);
const noHours = new Set();   // every finished task has its hours (no "completed task with no hours" note in the demo)
for (const [lotId, evs] of Object.entries(byLotEv)) {
    const lot = db.lots[lotId];
    if (!lot) continue;
    const building = db.rooms[rptRoomIdByName(lot.destRoom)]?.buildingId || null;
    for (const ev of evs) {
        if ((ev.endDate || ev.date) >= TODAY) continue;
        if (!noHours.has(ev.id)) { const lm = labourFor(ev, building, dAdd(TODAY, -14)); if (lm) ev.labour_map = lm; }
        if (!overdue.has(ev.id)) ev.completed = true;
    }
}
for (const lotId of ['1137', '1171', '1179', '1190']) {
    const lot = db.lots[lotId], d = datesFrom(byLotEv[lotId]);
    const until = [dAdd(TODAY, -1), d.harvestStart && dAdd(d.harvestStart, -1)].filter(Boolean).sort()[0];
    const ipm = lotId === '1179' ? { spike: '2026-09-18', pests: ['2026-09-19'], herm: ['2026-09-17'] } : lotId === '1171' ? { pests: ['2026-10-02', '2026-10-03'] } : null;
    const harvested = Number(lot.plantCount);
    const grow = growLog(lot, lotId, d, Math.round(harvested / 0.965), harvested, lot.destRoom, until, ipm);
    const entries = db._PaperWizard.entries[lotId] || (db._PaperWizard.entries[lotId] = {});
    entries.growlog = { ...(entries.growlog || {}), instances: { ...grow.instances, ...(entries.growlog?.instances || {}) }, constants: entries.growlog?.constants || {} };
    if (lotId === '1137') entries.harvestlog = harvestLog(d, harvestNumbers(lot.strain, harvested, 1.0, flowerAvgTemp(grow, d), prog(d.harvestStart), true), harvested);
}

// ---- 7. Daily chores and the hours logged on them (DailyWizard) ----
const daily = db._DailyWizard.buildings;
daily.B66D = daily.B66D || { tasks: [] };
if (!daily.B66D.tasks.length) daily.B66D.tasks = [
    { code: 'w6ap', emoji: '💧', name: 'Water plants — Albatross 1 & 2', minutes: 45, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], monthDays: [], steps: [] },
    { code: 'k7sc', emoji: '🔍', name: 'Scout rooms for pests', minutes: 20, staff: 1, days: [1, 2, 3, 4, 5], monthDays: [], steps: [] },
    { code: 'f3mx', emoji: '🧪', name: 'Check fertilizer mix', minutes: 10, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], monthDays: [], steps: [] },
    { code: 'g9st', emoji: '🧤', name: 'Stock gloves and paper towels', minutes: 15, staff: 1, days: [1], monthDays: [], steps: [] },
    { code: 'd4lt', emoji: '💡', name: 'Turn off lights and pull doors', minutes: 5, staff: 1, days: [0, 1, 2, 3, 4, 5, 6], monthDays: [], steps: [] }
];
for (const [bid, b] of Object.entries(daily)) {
    if (!db.buildings[bid]) continue;
    b.labour = {};
    for (let d = dAdd(TODAY, -120); d < TODAY; d = dAdd(d, 1)) {
        const dt = parseISO(d);
        for (const t of b.tasks || []) {
            if (!((t.days || []).includes(dt.getDay()) || (t.monthDays || []).includes(dt.getDate())) || rnd() < 0.08) continue;
            const who = pick(ROSTER);
            ((b.labour[d] || (b.labour[d] = {}))[t.code] || (b.labour[d][t.code] = [])).push({
                employee: who, hours: Math.max(0.083, Math.round(t.minutes * (t.staff || 1) * U(1.0, 1.45) / 5) * 5 / 60),
                initials: { name: who, strokes: INITIALS_STROKES(who) }, at: new Date(dt.getTime() + 16 * 3600000).toISOString(), by: bid
            });
        }
    }
}

// ---- 8. Equipment maintenance (EquipmentWizard) — same dates its resync computes, so history carries over ----
const EQW = db._EquipmentWizard.rooms;
const addEquipment = (roomId, name, list) => { const eq = { id: 'ex' + rid(12), type: '', name, emoji: '🔧', installedDate: list[0].start, tasks: [], additionalMaintenance: [] }; EQW[roomId].equipment.push(eq); return eq; };
const g2 = EQW.B6G2.equipment;
const setTasks = (eq, list) => { eq.tasks = list.map(t => ({ id: 'tk' + rid(10), name: t.name, intervalValue: t.every, intervalUnit: 'days', startDate: t.start, emoji: t.emoji || '🔧' })); };
if (g2[0]) setTasks(g2[0], [{ name: 'Clean filters and drain pans', every: 14, start: '2026-08-17', emoji: '🧽' }]);
if (g2[1]) setTasks(g2[1], [{ name: 'Clean coils and check refrigerant', every: 30, start: '2026-08-20', emoji: '❄️' }]);
if (g2[2]) setTasks(g2[2], [{ name: 'Clean fan blades and guards', every: 30, start: '2026-08-25', emoji: '🌀' }]);
for (const r of ['B66DG1', 'B66DG2']) {
    const room = db.rooms[r].name;
    setTasks(addEquipment(r, `Dehumidifiers / ${room}`, [{ start: '2025-11-03' }]), [{ name: 'Clean filters and drain pans', every: 14, start: '2025-11-03', emoji: '🧽' }]);
    setTasks(addEquipment(r, `ACs / ${room}`, [{ start: '2025-11-10' }]), [{ name: 'Clean coils and check refrigerant', every: 30, start: '2025-11-10', emoji: '❄️' }]);
}
const endEq = dMonths(TODAY, 12);
for (const [roomId, r] of Object.entries(EQW)) {
    for (const eq of r.equipment || []) for (const t of eq.tasks || []) {
        for (let d = t.startDate; d <= endEq; d = dAdd(d, t.intervalValue)) {
            const ev = { id: evId(), date: d, title: `${t.emoji || '🔧'} ${t.name} — ${eq.name} — ${db.rooms[roomId]?.name || roomId}`, sourceTool: 'EquipmentWizard', roomId, equipmentId: eq.id, taskId: t.id, taskType: 'equipment_maintenance' };
            if (d < TODAY) {
                ev.completed = true;
                const n = rnd() < 0.6 ? 1 : 2;
                ev.labour_map = { [d]: [...ROSTER].sort(() => rnd() - 0.5).slice(0, n).map(name => ({ employee: name, hours: q4(U(0.5, 1.75)) })) };
            }
            db.calendarEvents.push(ev);
        }
    }
}

// ---- 8b. The floor: sign-offs, today's check-offs, and the Labour Log's flags ----
// Tasks finished in the last two weeks were signed off by a floor manager (DailyWizard ✅ Mark done), and the hours on
// equipment visits then were logged and signed on the building tablet
const SIGN_FROM = dAdd(TODAY, -14);
const eventBuilding = ev => db.rooms[taskRoomId(ev)]?.buildingId || null;
for (const ev of db.calendarEvents) {
    if (ev.completed !== true || !['CropLabourWizard', 'EquipmentWizard'].includes(ev.sourceTool)) continue;
    const end = ev.endDate || ev.date, bid = eventBuilding(ev);
    if (end < SIGN_FROM || end >= TODAY) continue;
    const name = pick(FLOOR_MANAGERS);
    ev.completedBy = { name, initials: { name, strokes: INITIALS_STROKES(name) }, at: new Date(parseISO(end).getTime() + 17.5 * 3600000).toISOString(), by: bid || 'office', day: end };
    if (ev.sourceTool !== 'EquipmentWizard') continue;
    for (const [d, list] of Object.entries(ev.labour_map || {})) {
        for (const en of list) Object.assign(en, { initials: { name: en.employee, strokes: INITIALS_STROKES(en.employee) }, at: new Date(parseISO(d).getTime() + 14 * 3600000).toISOString(), by: bid || 'office' });
    }
}
// This morning's check-offs (DailyWizard, saved per day): about half of today's chores done before the demo
for (const [bid, b] of Object.entries(daily)) {
    if (!db.buildings[bid]) continue;
    const dt = parseISO(TODAY);
    const todays = (b.tasks || []).filter(t => (t.days || []).includes(dt.getDay()) || (t.monthDays || []).includes(dt.getDate()));
    todays.forEach((t, i) => {
        if (i % 2) return;
        ((b.checks || (b.checks = {}))[TODAY] || (b.checks[TODAY] = {}))[t.code] = { at: new Date(dt.getTime() + (6.5 + i * 0.15) * 3600000).toISOString(), by: bid };
    });
}
// The Labour Log's accountability flags: one chore entry logged the next morning, and one signed crop entry the office
// corrected in EmployeeWizard's Tasks tab
{
    const day = dAdd(TODAY, -3), list = Object.values(daily.B66D?.labour?.[day] || {})[0];
    if (list?.[0]) list[0].at = new Date(parseISO(dAdd(day, 1)).getTime() + 8.2 * 3600000).toISOString();
    const ev = db.calendarEvents.find(e => e.sourceTool === 'CropLabourWizard' && e.labour_map?.[dAdd(TODAY, -2)]?.some(x => x.initials));
    const en = ev?.labour_map[dAdd(TODAY, -2)].find(x => x.initials);
    if (en) Object.assign(en, { signedHours: en.hours, hours: en.hours + 0.5, editedAt: new Date(parseISO(dAdd(TODAY, -1)).getTime() + 10 * 3600000).toISOString(), editedBy: 'office' });
}

// ---- 8c. Power: equipment ratings (EquipmentWizard), monthly power bills and rates (⚡ Power & Rates) ----
// Individual dehumidifiers carry their own watts; the AC and fan groups carry theirs (a group plus its members would
// count twice). The demo dates all equipment from mid-2023 so the 3 years of crops share the same rooms' power.
const DEHU_W = [[/506/, 4800], [/Dual 225/, 1700], [/Dual 205/, 1300], [/Dual 105/, 900], [/Anden|Cannadri/, 1000]];
for (const [roomId, r] of Object.entries(EQW)) {
    for (const eq of r.equipment || []) {
        eq.installedDate = '2023-06-01';
        if (eq.type === 'Dehumidifier') { const w = DEHU_W.find(([re]) => re.test(eq.name))?.[1]; if (w) eq.power = { watts: w, units: 1, hoursPerDay: 14 }; }
        else if (/^All ACs/.test(eq.name)) eq.power = { watts: roomId === 'B6MOM' ? 3500 : 5000, units: roomId === 'B6MOM' ? 1 : 2, hoursPerDay: 12 };
        else if (/^All Fans/.test(eq.name)) eq.power = { watts: 150, units: 12, hoursPerDay: 24 };
        else if (/^Dehumidifiers \//.test(eq.name)) eq.power = { watts: 1500, units: 4, hoursPerDay: 14 };
        else if (/^ACs \//.test(eq.name)) eq.power = { watts: 5000, units: 2, hoursPerDay: 12 };
    }
}
// Monthly bills per building: roughly the rooms' lights at ~13 h plus the equipment, at $0.11 per kWh
const KWH_RATE = 0.11;
const buildingKwhDay = bid => Object.entries(db.rooms).filter(([, r]) => r.buildingId === bid).reduce((t, [id, r]) =>
    t + (r.lightCount || 0) * (r.lightWattage || 0) / 1000 * (r.isFlowering ? 13 : 18)
      + (EQW[id]?.equipment || []).reduce((u, e) => u + (e.power ? e.power.watts * e.power.units * e.power.hoursPerDay / 1000 : 0), 0), 0);
const bills = [];
for (let m = START.slice(0, 7) + '-01'; dMonths(m, 1) <= TODAY; m = dMonths(m, 1)) {
    const to = dAdd(dMonths(m, 1), -1), days = dDiff(m, to) + 1;
    for (const bid of Object.keys(db.buildings)) {
        const kWh = Math.round(buildingKwhDay(bid) * days * U(0.95, 1.06));
        bills.push({ id: 'pb' + rid(8), buildingId: bid, from: m, to, kWh, amount: Math.round(kWh * KWH_RATE * U(0.99, 1.03) * 100) / 100 });
    }
}
db._EmployeeWizard.costs = { electricity: 'bills', kWhRate: KWH_RATE, waterPer1000L: 2.4, bills };

// ---- 9. Booked time off (EmployeeWizard) — shows as dips in roster capacity ----
for (const [name, from, to] of [['Kasia', '2026-12-21', '2027-01-01'], ['Liam', '2026-11-02', '2026-11-06']]) {
    const calEventId = evId();
    db._EmployeeWizard.employees[name].timeOff = [...(db._EmployeeWizard.employees[name].timeOff || []), { id: 'to-' + rid(8), date: from, endDate: to, calEventId }];
    db.calendarEvents.push({ id: calEventId, date: from, endDate: to, title: `🏖️ Time Off — ${name}`, sourceTool: 'EmployeeWizard' });
}

// ---- 10. Save the past crops' summaries (and their frozen labour cost) the way Setup & data does ----
DB.data = db; DB.ensureStructure();
// …and the live lot that has already shipped (1137), as the office would before closing it out
const shipped = rptModel().crops.filter(c => !c.closed && c.dates?.ship && c.dates.ship < TODAY && c.weights?.flower != null);
const dropped = rptSaveSummaries([...pastCrops, ...shipped]);

// ---- 11. Check every page: what's drawn and what's still empty ----
const pages = { overview: rptOverview, timeline: rptTimeline, labour: rptLabour, costs: rptCosts, yield: rptYield, rooms: rptRooms, forecast: rptForecast, settings: rptSetup };
const report = [];
for (const per of ['plant', 'light', 'total']) {
    RPT.per = per; RPT.period = '12m'; RPT.ganttLot = ''; RPT.envLot = '';
    for (const [name, fn] of Object.entries(pages)) {
        const h = fn(rptModel());
        if (/NaN|undefined|Infinity/.test(h)) report.push(`BAD ${per} ${name}`);
        const empties = [...h.matchAll(/rpt-empty"><b>([^<]*)/g)].map(m => m[1]);
        if (per === 'plant' || empties.length) report.push(`${per.padEnd(5)} ${name.padEnd(9)} svgs ${(h.match(/<svg/g) || []).length}${empties.length ? ' · EMPTY: ' + empties.join(' / ') : ''}`);
    }
}
RPT.per = 'plant';
const M = rptModel(), A = rptAgg(M, rptHarvested(M, M.per.from, M.per.to), M.per.from, M.per.to);
report.push(`KPIs (12 mo): ${A.n} crops · flower ${rN(A.flower / 1000, 1)} kg · ${rN(A.gpp, 0)} g/plant · ${rN(A.gsfy, 0)} g/sqft/yr · THC ${rN(A.potency, 1)} % · terps ${rN(A.terpenes, 2)} % · $${rN(A.loaded, 2)}/g · ${rN(A.hours.total, 0)} h (chores ${rN(A.hours.chore, 0)}, equipment ${rN(A.hours.equipment, 0)}) · accuracy ${rN(A.acc * 100, 0)} %`);
report.push('Needs attention: ' + rptAttention(M).map(x => x.text).join(' || '));
// The made-up improvement, year by year (each line: the 12 months ending that many years ago)
for (const back of [2, 1, 0]) {
    const to = dMonths(TODAY, -12 * back), from = dMonths(to, -12), Y = rptAgg(M, rptHarvested(M, from, to), from, to);
    const pg = Y.costPG, part = k => pg[k] != null ? rN(pg[k], 3) : '—';
    report.push(`year to ${to}: ${Y.n} crops · ${rN(Y.gpp, 0)} g/plant · ${rN(Y.gsfy, 0)} g/sqft/yr · THC ${rN(Y.potency, 1)} % · terps ${rN(Y.terpenes, 2)} % · ${rN(Y.hours.total, 0)} h`);
    report.push(`    $/g all in ${part('allIn')} = labour ${part('labour')} + power ${part('power')} + water ${part('water')} + fert ${part('fert')} + supplies ${part('supplies')}`);
}
report.push(`past crops ${pastCrops.length} (${past[0].harvest} → ${past[past.length - 1].harvest}) · summaries ${Object.keys(db._EmployeeWizard.crops).length} · frozen costs ${Object.keys(db._EmployeeWizard.cropCosts || {}).length} · dropped ${dropped}`);
report.push(`events ${db.calendarEvents.length} · equipment events ${db.calendarEvents.filter(e => e.sourceTool === 'EquipmentWizard').length}`);
fs.writeFileSync(OUT, JSON.stringify(db));
report.push(`wrote ${OUT} · ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB`);
console.log(report.join('\n'));
