#!/usr/bin/env node
// make-tens-db.js — builds a demo database of round numbers, for checking the total cost per gram by hand.
//
//   node examples/make-tens-db.js [output.json] [--today=YYYY-MM-DD]
//
// Writes examples/Tens-DB-YY-MM-DD.json (load it with SitkaTools' 📂 Load DB) and, next to it,
// Tens-DB-YY-MM-DD-answer-key.md: what every cost should come to, worked out here from the inputs below — on its own,
// without the Labour & Cost Wizard's code — so the Reports page can be checked against it. Nothing is made to come out
// round: the inputs are round, and the answer key shows how they split.
//
// The facility (every input a 10 or a 1):
//   • Building 1 (Nursery): Mother Room, Clone Room, Veg Room, Grow 1, Grow 2, Dry Room 1. Building 2 (Flower): Grow 3,
//     Grow 4, Dry Room 2. Each building $10,000 a month. Every room with lights has 10 lights × 1,000 W (18 h veg,
//     12 h bloom). Each dry room has one 1,000 W dehumidifier running 10 h a day. Electricity $10 per kWh, water $10 per
//     1,000 L, fertilizer "Grow A" $10 per L.
//   • One mother lot (M100, 100 plants) in the Mother Room. Ten bloom lots (L101–L110), 1,000 clones each, cut from it,
//     on CropLabourWizard's default recipe (20-day veg, 9-week bloom) with a 10-day trim: 10 days drying, 10 days
//     trimming. The nursery feeds all four grow rooms, each turning every 70 days; lots dry in their own building.
//   • Grow log every day: 1 L of water, 100 mL of Grow A and 1 L of runoff per plant, light at 100 %.
//   • 10 employees at $10/h; every day of every task gets 5 h. Every lot yields 100,000 g of flower.
//   • Supplies: a clone cube per plant at Cutting Clones ($1), a coco block per plant at Transplanting ($10), 10 trellis
//     nets per crop ($10 each); the mothers a pot each at the start ($10).
// The last lot ships today, so rebuild it on the day you use it.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const ARGS = process.argv.slice(2);
const pad = n => String(n).padStart(2, '0');
const isoOf = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
const TODAY = ARGS.find(a => a.startsWith('--today='))?.slice(8) || isoOf(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(TODAY)) throw new Error('--today wants YYYY-MM-DD');
const OUT = ARGS.find(a => !a.startsWith('--')) || path.join(__dirname, `Tens-DB-${TODAY.slice(2)}.json`);
const KEY_OUT = OUT.replace(/\.json$/i, '') + '-answer-key.md';

const dAdd = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return isoOf(new Date(y, m - 1, d + n, 12)); };
const dDiff = (a, b) => { const p = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((p(b) - p(a)) / 86400000); };
const daysIn = iso => { const [y, m] = iso.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const eachDay = (from, to, fn) => { for (let d = from; d <= to; d = dAdd(d, 1)) fn(d); };

// ---- The inputs ----
const IN = {
    lights: 10, watts: 1000, vegHours: 18, bloomHours: 12,
    kWhRate: 10, waterPer1000L: 10, fertPerL: 10, rent: 10000,
    dehuWatts: 1000, dehuHours: 10,
    wage: 10, hoursPerTaskDay: 5, employees: 10,
    plants: 1000, mothers: 100,
    waterL: 1, runoffL: 1, fertMl: 100, lightPct: 100,
    flower: 100000, trim: 10000, wet: 1000000, dry: 110000, thc: 10, terpenes: 1,
    dryDays: 10, trimDays: 10, cube: 1, coco: 10, trellisQty: 10, trellis: 10, pot: 10
};
// Day numbers: day 0 is the first bloom lot's Cutting Clones; today is day 276 (the last lot's ship day)
const T_REL = 276, M0_REL = -60;
const rel = n => dAdd(TODAY, n - T_REL);
// The ten bloom lots: Cutting Clones day and grow room. Cuts 17–18 days apart, so no two lots share the clone or veg
// room; each grow room turns every 70 days; Grow 1/2 (and 3/4) are 35 days apart, so their lots never share a dry room.
const PLAN = [[0, 'B1G1'], [17, 'B2G3'], [35, 'B1G2'], [52, 'B2G4'], [70, 'B1G1'], [87, 'B2G3'], [105, 'B1G2'], [122, 'B2G4'], [140, 'B1G1'], [157, 'B2G3']];

// ---- Seeded randomness, so every run gives the same ids ----
let seed = 0x7e115;
Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
const rid = (prefix, n = 10) => prefix + Array.from({ length: n }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

// ---- CropLabourWizard's own schedule code, run outside a browser (a do-nothing page) ----
const mk = () => { const el = { value: '', options: [], dataset: {}, style: {}, hidden: false, checked: false, disabled: false, innerHTML: '', textContent: '', children: [],
  classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, addEventListener() {}, removeEventListener() {}, appendChild() {}, insertBefore() {}, remove() {},
  querySelector: () => mk(), querySelectorAll: () => [], closest: () => null, focus() {}, blur() {}, click() {}, getBoundingClientRect: () => ({ width: 10, height: 10, left: 0, top: 0 }),
  setAttribute() {}, getAttribute: () => null, removeAttribute() {}, scrollIntoView() {} }; return el; };
const els = {};
globalThis.document = { getElementById: id => els[id] || (els[id] = mk()), querySelector: () => mk(), querySelectorAll: () => [], createElement: () => mk(), body: mk(), head: mk(), documentElement: mk(), addEventListener() {}, activeElement: null, visibilityState: 'visible', hasFocus: () => true };
globalThis.window = globalThis; window.opener = null; globalThis.addEventListener = () => {};
globalThis.location = { protocol: 'file:', origin: 'null', search: '', href: 'file:///CropLabourWizard.html' };
globalThis.indexedDB = { open: () => ({}) };
globalThis.BroadcastChannel = class { postMessage() {} close() {} addEventListener() {} };
globalThis.innerWidth = 1400; globalThis.innerHeight = 900; globalThis.screen = { availWidth: 1400, availHeight: 900 };
globalThis.alert = () => {}; globalThis.confirm = () => true;
const realTimers = { setInterval: globalThis.setInterval, setTimeout: globalThis.setTimeout };
globalThis.setInterval = () => 0; globalThis.setTimeout = () => 0;
const clwHtml = fs.readFileSync(path.join(ROOT, 'CropLabourWizard', 'CropLabourWizard.html'), 'utf8');
let clwScript = clwHtml.slice(clwHtml.indexOf('<script>') + 8, clwHtml.lastIndexOf('</script>'));
const initAt = clwScript.lastIndexOf('init();');
clwScript = clwScript.slice(0, initAt) + clwScript.slice(initAt + 'init();'.length);
const CLW = new Function(clwScript + '\nreturn { DB, BUILTIN_RECIPE, generateLotSchedule, defaultOffsetsSnapshot, mergeTaskTypeRegistry, validateRecipe };')();
Object.assign(globalThis, realTimers);

// ---- Rooms and buildings ----
const LIT = { lightCount: IN.lights, lightWattage: IN.watts, vegLightHours: IN.vegHours, bloomLightHours: IN.bloomHours };
const room = (name, buildingId, extra = {}) => ({ name, description: null, createdDate: rel(-120), assignedLots: [], isFlowering: false, buildingId, floorSqFt: 1000, ...extra });
const rooms = {
    B1MOM: room('Mother Room', 'B1', { designation: 'Mother', ...LIT }),
    B1CLN: room('Clone Room', 'B1', { designation: 'Clone', ...LIT }),
    B1VEG: room('Veg Room', 'B1', { designation: 'Vegetation', ...LIT }),
    B1G1: room('Grow 1', 'B1', { designation: 'Grow 1', isFlowering: true, canopySqFt: 1000, ...LIT }),
    B1G2: room('Grow 2', 'B1', { designation: 'Grow 2', isFlowering: true, canopySqFt: 1000, ...LIT }),
    B1DRY: room('Dry Room 1', 'B1', { description: 'Drying and trimming' }),
    B2G3: room('Grow 3', 'B2', { designation: 'Grow 3', isFlowering: true, canopySqFt: 1000, ...LIT }),
    B2G4: room('Grow 4', 'B2', { designation: 'Grow 4', isFlowering: true, canopySqFt: 1000, ...LIT }),
    B2DRY: room('Dry Room 2', 'B2', { description: 'Drying and trimming' })
};
const buildings = {
    B1: { name: 'Building 1 (Nursery)', description: 'Mothers, clones and veg for every grow room, plus Grow 1 and 2', createdDate: rel(-120), monthlyPropertyCost: IN.rent, assignedRooms: Object.keys(rooms).filter(id => rooms[id].buildingId === 'B1') },
    B2: { name: 'Building 2 (Flower)', description: 'Grow 3 and 4, fed by the nursery', createdDate: rel(-120), monthlyPropertyCost: IN.rent, assignedRooms: Object.keys(rooms).filter(id => rooms[id].buildingId === 'B2') }
};
const roomIdByName = name => Object.keys(rooms).find(id => rooms[id].name === name) || null;
const dryOf = growId => rooms[growId].buildingId === 'B1' ? 'Dry Room 1' : 'Dry Room 2';

// ---- Roster ----
const EMP = Array.from({ length: IN.employees }, (_, i) => `Employee ${pad(i + 1)}`);
const employees = Object.fromEntries(EMP.map(n => [n, { wage: IN.wage, workDays: [1, 2, 3, 4, 5], timeOff: [] }]));
const FM = EMP[0], salt = 'demo-tens';
Object.assign(employees[FM], { floorManager: true, pin: { salt, hash: crypto.createHash('sha256').update(`${salt}:1010`).digest('hex'), setAt: rel(-120) } });
const STROKE = [[[0.2, 0.7], [0.3, 0.3], [0.4, 0.7]]];
const initialsOf = name => ({ name, strokes: STROKE });

// ---- Price list and recipes ----
const inputs = {
    inGA: { name: 'Grow A', kind: 'fertilizer', unit: 'L', price: IN.fertPerL },
    inCC: { name: 'Clone cube', kind: 'supply', unit: 'cube', price: IN.cube },
    inCB: { name: 'Coco block', kind: 'supply', unit: 'block', price: IN.coco },
    inTN: { name: 'Trellis net', kind: 'supply', unit: 'net', price: IN.trellis },
    inMP: { name: 'Mother pot', kind: 'supply', unit: 'pot', price: IN.pot }
};
// The default recipe's tasks, plus an estimate of 1 person × 5 h a day and the supplies. Drying is set to 10 days
// (Bucking 10 days after Harvest, Trim the day after): the tasks from Clean and Prepare Totes to Trim move together.
const est = t => ({ ...t, staff: 1, minutes: IN.hoursPerTaskDay * 60 });
const DRY_SHIFT = CLW.BUILTIN_RECIPE.tasks.find(t => t.taskType === 'bucking').defaultOffset - IN.dryDays;
const DRY_MOVES = ['tote_prep', 'bucking', 'lab_sample', 'trim_room_prep', 'trim'];
const bloomRecipe = {
    id: 'demo-tens', name: 'Sitka Standard (demo: 10-day dry, 5 h a task day, with supplies)', version: 1,
    chain: { ...CLW.BUILTIN_RECIPE.chain },
    tasks: CLW.BUILTIN_RECIPE.tasks.map(t => est(DRY_MOVES.includes(t.taskType) ? { ...t, defaultOffset: t.defaultOffset - DRY_SHIFT } : t)),
    inputs: [
        { inputId: 'inCC', name: 'Clone cube', unit: 'cube', qty: 1, per: 'plant', at: 'clone_cut_prep' },
        { inputId: 'inCB', name: 'Coco block', unit: 'block', qty: 1, per: 'plant', at: 'transplant' },
        { inputId: 'inTN', name: 'Trellis net', unit: 'net', qty: IN.trellisQty, per: 'crop' }
    ]
};
// Mothers: the generic starter CropLabourWizard's 🌿 New Mother Recipe opened until 2026-10-27 (it now copies the built-in
// mother recipe), kept here so the demo and its answer key stay the same; retired a year after planting
const MOTHER_STARTER = {
    kind: 'vegetative',
    version: 1,
    tasks: [
        { name: 'Cutting Clones', emoji: '✂️', taskType: 'clone_cut_prep', reference: 'cloning', defaultOffset: 0, hasToggle: true, isLocked: true },
        { name: 'Planting Clones', emoji: '🌱', taskType: 'planting', reference: 'cloning', defaultOffset: 14 },
        { name: 'Clean Clone Room and used cloning supplies', emoji: '🧼', taskType: 'clone_room_clean', reference: 'planting', defaultOffset: 1 },
        { name: 'Transplanting to Mother Room', emoji: '🪴', taskType: 'transplant', reference: 'planting', defaultOffset: 14 },
        { name: 'Prune Mothers', emoji: '✂️', taskType: 'mother_prune', reference: 'planting', defaultOffset: 28, every: 14 },
        { name: 'Top-dress Mothers', emoji: '🧪', taskType: 'mother_topdress', reference: 'planting', defaultOffset: 42, every: 28 },
        { name: 'Cut Clones to Replace Mothers', emoji: '🌿', taskType: 'clone_cut', reference: 'retire', defaultOffset: -28 },
        { name: 'Retire Mothers', emoji: '🍂', taskType: 'retire', reference: 'planting', defaultOffset: 180 }
    ]
};
const motherRecipe = {
    ...MOTHER_STARTER, id: 'demo-tens-mothers', name: 'Demo mothers (retired after a year)',
    tasks: MOTHER_STARTER.tasks.map(t => est(t.taskType === 'retire' ? { ...t, defaultOffset: 365 } : t)),
    inputs: [{ inputId: 'inMP', name: 'Mother pot', unit: 'pot', qty: 1, per: 'plant' }]
};
for (const r of [bloomRecipe, motherRecipe]) {
    const errors = CLW.validateRecipe(r);
    if (errors?.length) throw new Error(`${r.id}: ${errors.join('; ')}`);
}

// ---- Lots ----
const STRAIN = 'Demo Kush';
const M0 = rel(M0_REL);
const lots = {
    M100: { name: 'M100', strain: STRAIN, stage: 'mother', createdDate: M0, closedDate: null, parentLotId: null, type: 'new-lot', receivedFrom: 'Demo Genetics Ltd.',
        startPlantCount: IN.mothers, plantCount: IN.mothers, cloningRoom: 'Clone Room', vegRoom: 'Veg Room', destRoom: 'Mother Room', dryRoom: null, trimRoom: null, currentRoom: 'Mother Room' }
};
const bloom = PLAN.map(([day, growId], i) => {
    const id = `L${101 + i}`, day0 = rel(day), dry = dryOf(growId);
    lots[id] = { name: id, strain: STRAIN, stage: 'drying', createdDate: day0, closedDate: null, parentLotId: 'M100', type: 'sub-lot',
        startPlantCount: IN.plants, plantCount: 0, cloningRoom: 'Clone Room', vegRoom: 'Veg Room', destRoom: rooms[growId].name, dryRoom: dry, trimRoom: dry, currentRoom: dry };
    return { id, day, day0, growId, grow: rooms[growId].name, dry, building: rooms[growId].buildingId };
});
for (const [id, l] of Object.entries(lots)) rooms[roomIdByName(l.destRoom)].assignedLots.push(id);

// ---- The DB, and the schedules generated by CropLabourWizard ----
const db = {
    lots, rooms, buildings, calendarEvents: [],
    _CropLabourWizard: { generations: [], recipes: { [bloomRecipe.id]: bloomRecipe, [motherRecipe.id]: motherRecipe }, inputs },
    _EmployeeWizard: { employees, settings: { shiftHours: 10 }, costs: { electricity: 'estimate', kWhRate: IN.kWhRate, waterPer1000L: IN.waterPer1000L, propertyShare: 'lights', bills: [] } },
    _EquipmentWizard: { rooms: Object.fromEntries(['B1DRY', 'B2DRY'].map(id => [id, { equipment: [{ id: `eq${id}`, type: 'Dehumidifier', name: `Dehumidifier — ${rooms[id].name}`,
        installedDate: rel(-120), power: { watts: IN.dehuWatts, units: 1, hoursPerDay: IN.dehuHours }, tasks: [], additionalMaintenance: [] }] }])) },
    _DailyWizard: { buildings: { B1: { tasks: [] }, B2: { tasks: [] } } },
    _PaperWizard: { sheets: {}, wizards: {}, entries: {} }
};
CLW.DB.data = db;
db._CropLabourWizard.taskTypes = {};
CLW.mergeTaskTypeRegistry(bloomRecipe);
CLW.mergeTaskTypeRegistry(motherRecipe);
CLW.generateLotSchedule('M100', M0, CLW.defaultOffsetsSnapshot(63, motherRecipe), { trimDays: 7, harvestMultiDay: false, harvestDays: 2 }, motherRecipe);
for (const b of bloom) CLW.generateLotSchedule(b.id, b.day0, CLW.defaultOffsetsSnapshot(63, bloomRecipe), { trimDays: IN.trimDays, harvestMultiDay: false, harvestDays: 2 }, bloomRecipe);
const evOf = (lotId, tt) => db.calendarEvents.find(e => e.lotId === lotId && e.taskType === tt);
for (const b of bloom) {
    b.planting = evOf(b.id, 'planting').date; b.transplant = evOf(b.id, 'transplant').date; b.flip = evOf(b.id, 'flip').date;
    b.harvest = evOf(b.id, 'harvest').date; b.bucking = evOf(b.id, 'bucking').date; b.ship = evOf(b.id, 'weigh_ship').date;
}
const mom = { planting: evOf('M100', 'planting').date, transplant: evOf('M100', 'transplant').date, retire: evOf('M100', 'retire').date };
if (bloom[bloom.length - 1].ship !== TODAY) throw new Error(`the last lot should ship today, not ${bloom[bloom.length - 1].ship}`);

// ---- Hours: 5 h on every day of every task up to today, by the ten employees in turn; done tasks signed off ----
const PHASE_ROOM = { cloning: 'cloningRoom', veg: 'vegRoom', flower: 'destRoom', dry: 'dryRoom', trim: 'trimRoom' };
let turn = 0;
for (const ev of db.calendarEvents) {
    const lot = lots[ev.lotId], end = ev.endDate || ev.date;
    const bid = rooms[roomIdByName(lot[PHASE_ROOM[ev.roomPhase]] || lot.destRoom)]?.buildingId || 'B1';
    if (ev.date > TODAY) continue;
    ev.labour_map = {};
    eachDay(ev.date, end < TODAY ? end : TODAY, d => {
        const who = EMP[turn++ % EMP.length];
        ev.labour_map[d] = [{ id: rid('le_'), employee: who, hours: IN.hoursPerTaskDay, initials: initialsOf(who), at: `${d}T21:00:00.000Z`, by: bid }];
    });
    if (end <= TODAY) { ev.completed = true; ev.completedBy = { name: FM, initials: initialsOf(FM), at: `${end}T22:00:00.000Z`, by: bid, day: end }; }
}

// ---- PaperWizard: a grow log (daily) and a harvest log (by event), tagged for the Reports ----
const Q = (id, label, type, extra = {}) => ({ id, label, type, options: [], rowScoped: true, ...extra });
db._PaperWizard.sheets = {
    'grow-log': { name: 'Grow log', orientation: 'landscape', pageWidthIn: 11, pageHeightIn: 8.5, pageCount: 1, cadence: 'daily-weekly', document: 'grow-log', fields: [], signature: null },
    'harvest-log': { name: 'Harvest log', orientation: 'portrait', pageWidthIn: 8.5, pageHeightIn: 11, pageCount: 1, cadence: 'event', document: 'harvest-log', fields: [], signature: null }
};
db._PaperWizard.wizards = {
    wzGrow: { sheetId: 'grow-log', name: 'Grow log', questions: [
        Q('q_room', 'What room are the plants in today?', 'room', { sameAsLast: true, prefillFrom: 'lot.currentRoom' }),
        Q('q_plants', 'How many plants are in the room?', 'plant-count', { sameAsLast: true, prefillFrom: 'lot.plantCount' }),
        Q('q_phase', 'What phase are the plants in today?', 'phase', { sameAsLast: true, prefillFrom: 'instance.phase' }),
        Q('q_water', 'Total water used today (L)', 'number', { metric: 'water.total' }),
        Q('q_perplant', 'Water per plant (L)', 'number', { metric: 'water.perPlant' }),
        Q('q_runoff', 'Runoff per plant (L)', 'number', { metric: 'water.runoff' }),
        Q('q_fert', 'Grow A used today (mL)', 'number', { metric: 'feed.nutrient', metricProduct: { name: 'Grow A' } }),
        Q('q_light', 'Light intensity (%)', 'number', { metric: 'env.lightPct' }),
        Q('q_notes', 'Rationale / Comments', 'text'),
        Q('q_init', 'Initials of employee filling out the log', 'initials')
    ] },
    wzHarvest: { sheetId: 'harvest-log', name: 'Harvest log', questions: [
        Q('h_wet', 'Wet weight in the drying room', 'number', { rowScoped: false, metric: 'harvest.wetWeight', metricUnit: 'g' }),
        Q('h_plants', 'Plants harvested', 'number', { rowScoped: false, metric: 'harvest.plantsHarvested' }),
        Q('h_dry', 'Dry weight, whole lot', 'number', { rowScoped: false, metric: 'harvest.dryWeight', metricUnit: 'g' }),
        Q('h_flower', 'Flower, all grades', 'number', { rowScoped: false, metric: 'harvest.flowerTotal', metricUnit: 'g' }),
        Q('h_trim', 'Trim', 'number', { rowScoped: false, metric: 'harvest.trim', metricUnit: 'g' }),
        Q('h_thc', 'Total THC %', 'number', { rowScoped: false, metric: 'harvest.potency' }),
        Q('h_terp', 'Total terpenes %', 'number', { rowScoped: false, metric: 'harvest.terpenes' }),
        Q('h_init', 'Initials', 'initials', { rowScoped: false })
    ] }
};
const page = (phase, roomName) => ({ phase, room: roomName, header: {}, days: {}, phaseChangeDate: null, strikeInitials: null, snapshots: {}, signature: null, completedAt: null, printedAt: null });
const dayRow = (roomName, phase, plants, d) => {
    const who = EMP[dDiff(rel(0), d) % EMP.length < 0 ? 0 : dDiff(rel(0), d) % EMP.length];
    return { q_room: roomName, q_plants: String(plants), q_phase: phase, q_water: String(IN.waterL * plants), q_perplant: String(IN.waterL), q_runoff: String(IN.runoffL),
        q_fert: String(IN.fertMl * plants), q_light: String(IN.lightPct), q_notes: '', q_init: initialsOf(who) };
};
// A lot's grow log from its stays, paged as PaperWizard pages it: rolling 7-day pages; a phase or room change inside a
// page saves that day on the old page too (the "double entry": the old page's row keeps the old room or phase and holds the
// day's water and fertilizer; the old page is struck that day), then a fresh page starts on the change day, where the
// receiving side fills the row in again but leaves water and fertilizer blank (user, 2026-10-26: they don't enter them
// on their side). Plants to 0 strike the page that day.
function growLog(segments, plants, harvestDay) {
    const instances = {};
    let open = null, secondEntry = null;
    for (const [s, seg] of segments.entries()) {
        for (let d = seg.from; d <= seg.to; d = dAdd(d, 1)) {
            if (!open || dDiff(open.key, d) >= 7) { open = { key: d, inst: page(seg.phase, seg.room) }; instances[d] = open.inst; }
            const harvest = d === harvestDay;
            const row = dayRow(seg.room, seg.phase, harvest ? 0 : plants, d);
            if (d === secondEntry) Object.assign(row, { q_water: '', q_perplant: '', q_runoff: '', q_fert: '' });
            if (harvest) {
                Object.assign(row, { q_water: '', q_perplant: '', q_runoff: '', q_fert: '', q_notes: `[Removed ${plants}: ${plants} harvested]`, _removed: { harvested: plants } });
                open.inst.phaseChangeDate = d; open.inst.strikeInitials = initialsOf(FM);
            }
            open.inst.days[d] = row;
        }
        const next = segments[s + 1];
        if (next && open && dDiff(open.key, next.from) < 7) {
            // The change day inside an open page: the double entry
            const changed = next.room !== seg.room ? 'q_room' : 'q_phase';
            const row = dayRow(next.room, next.phase, plants, next.from);
            row[changed] = changed === 'q_room' ? seg.room : seg.phase;
            open.inst.days[next.from] = row;
            open.inst.phaseChangeDate = next.from; open.inst.strikeInitials = initialsOf(FM);
            open = null; secondEntry = next.from;
        } else open = null;
    }
    return { instances };
}
const entries = db._PaperWizard.entries;
entries.M100 = { 'grow-log': growLog([
    { from: M0, to: dAdd(mom.planting, -1), room: 'Clone Room', phase: 'Cloning' },
    { from: mom.planting, to: dAdd(mom.transplant, -1), room: 'Veg Room', phase: 'Vegetation' },
    { from: mom.transplant, to: TODAY, room: 'Mother Room', phase: 'Mother' }
], IN.mothers, null) };
for (const b of bloom) {
    entries[b.id] = {
        'grow-log': growLog([
            { from: b.day0, to: dAdd(b.planting, -1), room: 'Clone Room', phase: 'Cloning' },
            { from: b.planting, to: dAdd(b.transplant, -1), room: 'Veg Room', phase: 'Vegetation' },
            { from: b.transplant, to: dAdd(b.flip, -1), room: b.grow, phase: 'Vegetation' },
            { from: b.flip, to: b.harvest, room: b.grow, phase: 'Bloom' }
        ], IN.plants, b.harvest),
        'harvest-log': { instances: {
            [b.harvest]: { header: { h_wet: String(IN.wet), h_plants: String(IN.plants), h_init: initialsOf(FM) }, days: {}, signature: null },
            [b.bucking]: { header: { h_dry: String(IN.dry), h_init: initialsOf(FM) }, days: {}, signature: null },
            [b.ship]: { header: { h_flower: String(IN.flower), h_trim: String(IN.trim), h_thc: String(IN.thc), h_terp: String(IN.terpenes), h_init: initialsOf(FM) }, days: {}, signature: null }
        } }
    };
}

fs.writeFileSync(OUT, JSON.stringify(db, null, 1));

// =====================================================================================================================
// The answer key — worked out from the plan above, on its own (none of the Labour & Cost Wizard's code). Where each lot
// is: Clone Room Day 0 → the day before Planting, Veg Room → the day before Transplanting, its grow room Transplanting →
// Harvest (veg light hours until Flip, bloom hours from Flip), its dry room the day after Harvest → Weigh & Ship. Every
// grow-log day is counted once.
// =====================================================================================================================
const stays = [];   // { lot, roomId, from, to, phase, plants }
stays.push({ lot: 'M100', roomId: 'B1CLN', from: M0, to: dAdd(mom.planting, -1), phase: 'veg', plants: IN.mothers });
stays.push({ lot: 'M100', roomId: 'B1VEG', from: mom.planting, to: dAdd(mom.transplant, -1), phase: 'veg', plants: IN.mothers });
stays.push({ lot: 'M100', roomId: 'B1MOM', from: mom.transplant, to: TODAY, phase: 'veg', plants: IN.mothers });
for (const b of bloom) {
    stays.push({ lot: b.id, roomId: 'B1CLN', from: b.day0, to: dAdd(b.planting, -1), phase: 'veg', plants: IN.plants });
    stays.push({ lot: b.id, roomId: 'B1VEG', from: b.planting, to: dAdd(b.transplant, -1), phase: 'veg', plants: IN.plants });
    stays.push({ lot: b.id, roomId: b.growId, from: b.transplant, to: dAdd(b.flip, -1), phase: 'veg', plants: IN.plants });
    stays.push({ lot: b.id, roomId: b.growId, from: b.flip, to: b.harvest, phase: 'bloom', plants: IN.plants });
    stays.push({ lot: b.id, roomId: roomIdByName(b.dry), from: dAdd(b.harvest, 1), to: b.ship, phase: 'dry', plants: IN.plants });
}
const LOTS = ['M100', ...bloom.map(b => b.id)];
const K = Object.fromEntries(LOTS.map(id => [id, { lightKwh: 0, equipKwh: 0, rent: 0, rentDays: 0, waterL: 0, fertMl: 0, hours: 0, taskDays: 0, supplies: 0, supplyLines: [], nights: {} }]));
// days: no crop in the building (its rent and dehumidifier are idle); rentDays: no lot growing in it (its rent is idle)
const idle = { B1: { rent: 0, kWh: 0, days: [], rentDays: [] }, B2: { rent: 0, kWh: 0, days: [], rentDays: [] } };
const START = M0;
// Where the money was spent: building → 'YYYY-MM' → part → $ (every $ in the building, whoever carries it)
const SPEND = { B1: {}, B2: {} }, SPEND_DAYS = { B1: {}, B2: {} };
const zero = () => ({ labour: 0, power: 0, water: 0, fert: 0, supplies: 0, property: 0 });
const spend = (bid, d, part, v) => {
    (SPEND[bid][d.slice(0, 7)] || (SPEND[bid][d.slice(0, 7)] = zero()))[part] += v;
    (SPEND_DAYS[bid][d] || (SPEND_DAYS[bid][d] = zero()))[part] += v;
};
// A period's spend, only its own days: building → month → part
const spendIn = from => Object.fromEntries(['B1', 'B2'].map(bid => {
    const out = {};
    for (const [d, parts] of Object.entries(SPEND_DAYS[bid])) if (d >= from && d <= TODAY) { const m = out[d.slice(0, 7)] || (out[d.slice(0, 7)] = zero()); for (const p of Object.keys(parts)) m[p] += parts[p]; }
    return [bid, out];
}));
const lightKw = IN.lights * IN.watts / 1000, dehuKwh = IN.dehuWatts * IN.dehuHours / 1000;
eachDay(START, TODAY, d => {
    const here = stays.filter(s => s.from <= d && d <= s.to);
    for (const bid of ['B1', 'B2']) {
        const inB = here.filter(s => rooms[s.roomId].buildingId === bid);
        const plants = inB.reduce((t, s) => t + s.plants, 0);
        const rentToday = IN.rent / daysIn(d);
        // Electricity: each lit room's lights go to the lot growing in it (one lot per room in this plan)
        for (const s of inB) {
            if (s.phase !== 'dry' && rooms[s.roomId].lightCount) {
                const kWh = lightKw * (s.phase === 'bloom' ? IN.bloomHours : IN.vegHours) * IN.lightPct / 100;
                K[s.lot].lightKwh += kWh; spend(bid, d, 'power', kWh * IN.kWhRate);
            }
            K[s.lot].nights[s.roomId] = (K[s.lot].nights[s.roomId] || 0) + 1;
        }
        // The dehumidifier: to the lot in the dry room; an empty dry room's to the building's lots by plants; none → idle
        const dryId = bid === 'B1' ? 'B1DRY' : 'B2DRY', inDry = inB.filter(s => s.roomId === dryId);
        if (inDry.length) inDry.forEach(s => { K[s.lot].equipKwh += dehuKwh * s.plants / inDry.reduce((t, x) => t + x.plants, 0); });
        else if (plants) inB.forEach(s => { K[s.lot].equipKwh += dehuKwh * s.plants / plants; });
        else { idle[bid].kWh += dehuKwh; idle[bid].days.push(d); }
        spend(bid, d, 'power', dehuKwh * IN.kWhRate);
        spend(bid, d, 'property', rentToday);
        // Rent (by lights, the default): the day's share of the month, between the rooms holding a growing lot by their
        // lights, then between a room's lots by plants. A lot drying pays none; no lot growing in the building → idle
        const growing = inB.filter(s => s.phase !== 'dry');
        const lightsIn = [...new Set(growing.map(s => s.roomId))].reduce((t, id) => t + (rooms[id].lightCount || 0), 0);
        if (lightsIn) growing.forEach(s => {
            const roomPlants = growing.filter(x => x.roomId === s.roomId).reduce((t, x) => t + x.plants, 0);
            K[s.lot].rent += rentToday * (rooms[s.roomId].lightCount || 0) / lightsIn * s.plants / roomPlants; K[s.lot].rentDays++;
        });
        else { idle[bid].rent += rentToday; idle[bid].rentDays.push(d); }
    }
    // Water and fertilizer: every grow-log day with plants (not the harvest day: plants go to 0 that day)
    for (const s of here) {
        if (s.phase === 'dry') continue;
        const b = bloom.find(x => x.id === s.lot);
        if (b && d === b.harvest) continue;
        K[s.lot].waterL += IN.waterL * s.plants; K[s.lot].fertMl += IN.fertMl * s.plants;
        const sb = rooms[s.roomId].buildingId;
        spend(sb, d, 'water', IN.waterL * s.plants / 1000 * IN.waterPer1000L); spend(sb, d, 'fert', IN.fertMl * s.plants / 1000 * IN.fertPerL);
    }
});
// Labour: 5 h on every task day up to today
for (const ev of db.calendarEvents) for (const [d, list] of Object.entries(ev.labour_map || {})) for (const e of list) {
    K[ev.lotId].hours += e.hours; K[ev.lotId].taskDays++;
    const lot = lots[ev.lotId], taskBuilding = rooms[roomIdByName(lot[PHASE_ROOM[ev.roomPhase]] || lot.dryRoom || lot.destRoom)].buildingId;
    spend(taskBuilding, d, 'labour', e.hours * IN.wage);
}
// Supplies
for (const b of bloom) {
    K[b.id].supplyLines = [['Clone cube × 1,000 plants at Cutting Clones', IN.plants * IN.cube], ['Coco block × 1,000 plants at Transplanting', IN.plants * IN.coco], [`Trellis net × ${IN.trellisQty} per crop`, IN.trellisQty * IN.trellis]];
    K[b.id].supplies = K[b.id].supplyLines.reduce((t, [, v]) => t + v, 0);
    spend('B1', b.day0, 'supplies', IN.plants * IN.cube + IN.trellisQty * IN.trellis);   // at Cutting Clones, and per crop where it started
    spend(b.building, b.transplant, 'supplies', IN.plants * IN.coco);                    // at Transplanting, in its grow room
}
spend('B1', M0, 'supplies', IN.mothers * IN.pot);
K.M100.supplyLines = [['Mother pot × 100 plants at the start', IN.mothers * IN.pot]];
K.M100.supplies = IN.mothers * IN.pot;
const PARTS = ['labour', 'power', 'water', 'fert', 'supplies', 'property'];
const PART_NAMES = { labour: 'Labour', power: 'Electricity', water: 'Water', fert: 'Fertilizer', supplies: 'Supplies', property: 'Property' };
const own = id => { const k = K[id]; return { labour: k.hours * IN.wage, power: (k.lightKwh + k.equipKwh) * IN.kWhRate, water: k.waterL / 1000 * IN.waterPer1000L, fert: k.fertMl / 1000 * IN.fertPerL, supplies: k.supplies, property: k.rent }; };
const momOwn = own('M100'), clonesCut = bloom.length * IN.plants;
const perClone = Object.fromEntries(PARTS.map(p => [p, momOwn[p] / clonesCut]));
const lotCost = Object.fromEntries(bloom.map(b => { const o = own(b.id); return [b.id, { own: o, clones: Object.fromEntries(PARTS.map(p => [p, perClone[p] * IN.plants])), total: Object.fromEntries(PARTS.map(p => [p, o[p] + perClone[p] * IN.plants])) }]; }));

// A period's cost per gram: the lots shipped in it, plus each building's idle days in it (over that building's grams)
const monthsBack = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const last = new Date(y, m - 1 - n + 1, 0).getDate(); return isoOf(new Date(y, m - 1 - n, Math.min(d, last), 12)); };
function period(months) {
    const from = dAdd(monthsBack(TODAY, months), 1);
    const shipped = bloom.filter(b => b.ship >= from && b.ship <= TODAY);
    const grams = shipped.length * IN.flower;
    const sum = p => shipped.reduce((t, b) => t + lotCost[b.id].total[p], 0);
    const idleIn = bid => ({ rent: idle[bid].rentDays.filter(d => d >= from).reduce((t, d) => t + IN.rent / daysIn(d), 0),
        kWh: dehuKwh * idle[bid].days.filter(d => d >= from).length, days: idle[bid].days.filter(d => d >= from).length,
        rentDays: idle[bid].rentDays.filter(d => d >= from).length });
    const idleB = { B1: idleIn('B1'), B2: idleIn('B2') };
    const perB = bid => {
        const list = shipped.filter(b => b.building === bid), g = list.length * IN.flower;
        const parts = Object.fromEntries(PARTS.map(p => [p, list.reduce((t, b) => t + lotCost[b.id].total[p], 0)]));
        parts.power += idleB[bid].kWh * IN.kWhRate; parts.property += idleB[bid].rent;
        return { lots: list.map(b => b.id), grams: g, parts, perGram: Object.fromEntries(PARTS.map(p => [p, g ? parts[p] / g : null])) };
    };
    const parts = Object.fromEntries(PARTS.map(p => [p, sum(p)]));
    const idlePower = (idleB.B1.kWh + idleB.B2.kWh) * IN.kWhRate, idleRent = idleB.B1.rent + idleB.B2.rent;
    const pg = Object.fromEntries(PARTS.map(p => [p, grams ? (parts[p] + (p === 'power' ? idlePower : p === 'property' ? idleRent : 0)) / grams : null]));
    return { months, from, shipped, grams, parts, idleB, idlePower, idleRent, pg, allIn: PARTS.reduce((t, p) => t + (pg[p] || 0), 0), B1: perB('B1'), B2: perB('B2') };
}
const P6 = period(6), P12 = period(12);

// ---- Write it out ----
const $ = v => v == null ? '—' : '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const $g = v => v == null ? '—' : '$' + v.toFixed(4);
const n0 = v => Math.round(v).toLocaleString('en-US');
const L = [];
L.push(`# Tens demo DB — answer key (built ${TODAY})`, '');
L.push(`DB file: \`${path.basename(OUT)}\`. Load it with SitkaTools' 📂 Load DB and open 👥 Labour & Cost Wizard → 📊 Reports → 💲 Costs.`);
L.push('These numbers are worked out from the inputs by this script on its own, not by the Labour & Cost Wizard. If the page differs, one of them splits something differently.', '');
L.push('## Inputs', '');
L.push('| What | Value |', '|---|---|');
for (const [k, v] of [['Buildings', 'Building 1 (Nursery): Mother Room, Clone Room, Veg Room, Grow 1, Grow 2, Dry Room 1 · Building 2 (Flower): Grow 3, Grow 4, Dry Room 2'],
    ['Rent', `$${n0(IN.rent)} a month per building, spread over each month's days, shared by the lights of the rooms with a lot growing (a lot drying pays none)`],
    ['Lights', `${IN.lights} lights × ${n0(IN.watts)} W in every room except the dry rooms = ${lightKw} kW → ${lightKw * IN.vegHours} kWh a veg day (${IN.vegHours} h), ${lightKw * IN.bloomHours} kWh a bloom day (${IN.bloomHours} h)`],
    ['Dehumidifier', `1 in each dry room, ${n0(IN.dehuWatts)} W × ${IN.dehuHours} h = ${dehuKwh} kWh a day`],
    ['Electricity', `$${IN.kWhRate} per kWh (estimated usage)`], ['Water', `$${IN.waterPer1000L} per 1,000 L`], ['Fertilizer', `Grow A, $${IN.fertPerL} per L`],
    ['Grow log, per plant per day', `${IN.waterL} L water, ${IN.fertMl} mL Grow A, ${IN.runoffL} L runoff, light ${IN.lightPct} %`],
    ['Mother lot', `M100: ${IN.mothers} plants, Day 0 ${M0}, Mother Room from ${mom.transplant}, retires ${mom.retire} (still growing today)`],
    ['Bloom lots', `L101–L110: ${n0(IN.plants)} clones each from M100, default recipe's tasks (20-day veg, 63-day bloom), ${IN.dryDays} days drying (Bucking ${IN.dryDays} days after Harvest; the built-in now dries 12), ${IN.trimDays} days trimming`],
    ['Labour', `${IN.employees} employees × $${IN.wage}/h; every day of every task gets ${IN.hoursPerTaskDay} h`],
    ['Yield', `${n0(IN.flower)} g flower per lot (wet ${n0(IN.wet)} g, dry ${n0(IN.dry)} g, trim ${n0(IN.trim)} g)`],
    ['Supplies', `clone cube $${IN.cube} per plant at Cutting Clones · coco block $${IN.coco} per plant at Transplanting · ${IN.trellisQty} trellis nets × $${IN.trellis} per crop · mother pot $${IN.pot} per mother plant`]])
    L.push(`| ${k} | ${v} |`);
L.push('', '## One bloom lot, day by day', '');
const b0 = bloom[0];
L.push(`Every bloom lot runs the same ${dDiff(b0.day0, b0.ship) + 1} days (L101: ${b0.day0} → ${b0.ship}):`, '');
L.push('| Where | Days | Lights | kWh |', '|---|---|---|---|');
L.push(`| Clone Room (Day 0 → day before Planting) | ${dDiff(b0.day0, b0.planting)} | ${IN.vegHours} h | ${n0(dDiff(b0.day0, b0.planting) * lightKw * IN.vegHours)} |`);
L.push(`| Veg Room (Planting → day before Transplanting) | ${dDiff(b0.planting, b0.transplant)} | ${IN.vegHours} h | ${n0(dDiff(b0.planting, b0.transplant) * lightKw * IN.vegHours)} |`);
L.push(`| Grow room before Flip | ${dDiff(b0.transplant, b0.flip)} | ${IN.vegHours} h | ${n0(dDiff(b0.transplant, b0.flip) * lightKw * IN.vegHours)} |`);
L.push(`| Grow room Flip → Harvest | ${dDiff(b0.flip, b0.harvest) + 1} | ${IN.bloomHours} h | ${n0((dDiff(b0.flip, b0.harvest) + 1) * lightKw * IN.bloomHours)} |`);
L.push(`| Dry room (day after Harvest → Weigh & Ship) | ${dDiff(b0.harvest, b0.ship)} | dark | dehumidifier ${dehuKwh}/day = ${n0(dDiff(b0.harvest, b0.ship) * dehuKwh)} |`);
const lights0 = dDiff(b0.day0, b0.flip) * lightKw * IN.vegHours + (dDiff(b0.flip, b0.harvest) + 1) * lightKw * IN.bloomHours;
L.push('', `- **Lights:** ${n0(lights0)} kWh × $${IN.kWhRate} = **${$(lights0 * IN.kWhRate)}**. Plus the dry room's dehumidifier while drying (${n0(dDiff(b0.harvest, b0.ship) * dehuKwh)} kWh = ${$(dDiff(b0.harvest, b0.ship) * dehuKwh * IN.kWhRate)}), plus a share of an empty dry room's dehumidifier on other days (by plants).`);
L.push(`- **Water:** ${dDiff(b0.day0, b0.harvest)} grow-log days with plants × ${n0(IN.waterL * IN.plants)} L = ${n0(K[b0.id].waterL)} L × $${IN.waterPer1000L}/1,000 L = **${$(own(b0.id).water)}**.`);
L.push(`- **Fertilizer:** ${dDiff(b0.day0, b0.harvest)} days × ${n0(IN.fertMl * IN.plants / 1000)} L = ${n0(K[b0.id].fertMl / 1000)} L × $${IN.fertPerL} = **${$(own(b0.id).fert)}**.`);
L.push(`- **Labour:** ${K[b0.id].taskDays} task days × ${IN.hoursPerTaskDay} h = ${K[b0.id].hours} h × $${IN.wage} = **${$(own(b0.id).labour)}**.`);
L.push(`- **Supplies:** ${K[b0.id].supplyLines.map(([t, v]) => `${t} = ${$(v)}`).join(' · ')} → **${$(K[b0.id].supplies)}**.`);
L.push(`- **Property:** each day it grows, its building's rent for that day (monthly ÷ days in the month) × its room's lights ÷ the lights of every room with a lot growing in the building that day (by plants when two lots share a room). Drying days pay none. It changes lot by lot with how many rooms are growing that day.`);
L.push(`- **Double entries:** PaperWizard saves a phase or room change day on two pages. Transplanting (room change) and Flip (phase change) are on two pages in this DB, as PaperWizard stores them: the old page's row has the day's water and fertilizer, the new page's row leaves them blank (the receiving side doesn't enter them). So each day's water counts once.`);
L.push('', '## The mothers and the cost per clone', '');
L.push(`M100 has ${IN.mothers} plants from ${M0} to today (${dDiff(M0, TODAY) + 1} days). Ten lots × ${n0(IN.plants)} clones = **${n0(clonesCut)} clones** cut from it. Cost per clone = everything spent on the mothers so far ÷ ${n0(clonesCut)}.`, '');
L.push('| Part | Mothers so far | How | Per clone | Per lot (× 1,000 clones) |', '|---|---|---|---|---|');
const kM = K.M100;
const momHow = {
    labour: `${kM.taskDays} task days × ${IN.hoursPerTaskDay} h × $${IN.wage}`,
    power: `lights ${n0(kM.lightKwh)} kWh (${dDiff(M0, TODAY) + 1} days × ${lightKw * IN.vegHours} kWh) + dehumidifier share ${kM.equipKwh.toFixed(1)} kWh, × $${IN.kWhRate}`,
    water: `${n0(kM.waterL)} L`, fert: `${n0(kM.fertMl / 1000)} L Grow A`, supplies: kM.supplyLines.map(([t]) => t).join(', '),
    property: `share of Building 1's rent by lights over ${kM.rentDays} days`
};
for (const p of PARTS) L.push(`| ${PART_NAMES[p]} | ${$(momOwn[p])} | ${momHow[p]} | ${$g(perClone[p])} | ${$(perClone[p] * IN.plants)} |`);
L.push(`| **All in** | **${$(PARTS.reduce((t, p) => t + momOwn[p], 0))}** | | **${$g(PARTS.reduce((t, p) => t + perClone[p], 0))}** | **${$(PARTS.reduce((t, p) => t + perClone[p] * IN.plants, 0))}** |`);
L.push('', 'The mothers keep costing until they retire, so the cost per clone grows each day until more lots are cut. Each lot also pays its own cutting (its ✂️ Cutting Clones hours and clone cubes), already in its own labour and supplies.');
L.push('', '## Every bloom lot', '');
L.push('Own costs, then the clones (at the cost per clone above). Property and the dehumidifier share differ lot by lot; the rest is the same for every lot.', '');
L.push('| Lot | Room | Ships | Labour | Electricity (kWh) | Water | Fertilizer | Supplies | Property (rent days) | Own total | + Clones | **All in** | **$/g** |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const b of bloom) {
    const c = lotCost[b.id], k = K[b.id], ownT = PARTS.reduce((t, p) => t + c.own[p], 0), cl = PARTS.reduce((t, p) => t + c.clones[p], 0);
    L.push(`| ${b.id} | ${b.grow} | ${b.ship} | ${$(c.own.labour)} | ${$(c.own.power)} (${n0(k.lightKwh + k.equipKwh)}) | ${$(c.own.water)} | ${$(c.own.fert)} | ${$(c.own.supplies)} | ${$(c.own.property)} (${k.rentDays}) | ${$(ownT)} | ${$(cl)} | **${$(ownT + cl)}** | **${$g((ownT + cl) / IN.flower)}** |`);
}
for (const P of [P6, P12]) {
    L.push('', `## 💲 Cost per gram — Period: Last ${P.months} months (${P.from} → ${TODAY})`, '');
    L.push(`Lots shipped (✅ Weigh & Ship signed off) in the period: ${P.shipped.length} → ${n0(P.grams)} g of flower.`);
    const idleText = bid => { const x = P.idleB[bid], dryOnly = x.rentDays - x.days;
        return x.rentDays ? `${buildings[bid].name} had no lot growing on ${x.rentDays} days of the period${dryOnly ? ` (${x.days} with no crop at all, ${dryOnly} with only a lot drying)` : ''}: rent ${$(x.rent)}${x.days ? ` + its dehumidifier on the ${x.days} days with no crop, ${n0(x.kWh)} kWh = ${$(x.kWh * IN.kWhRate)}` : ''}, spread over the grams it shipped.`
            : `${buildings[bid].name} had a lot growing every day of the period: no idle days.`; };
    L.push(`- ${idleText('B1')}`, `- ${idleText('B2')}`, '- No daily chores or equipment hours: shared labour is $0, so labour direct = fully loaded.', '');
    L.push('| Part | $ (the lots + their clones) | + idle building days | ÷ grams | **$ per gram** |', '|---|---|---|---|---|');
    for (const p of PARTS) {
        const extra = p === 'power' ? P.idlePower : p === 'property' ? P.idleRent : 0;
        L.push(`| ${PART_NAMES[p]} | ${$(P.parts[p])} | ${extra ? $(extra) : '—'} | ${n0(P.grams)} | **${$g(P.pg[p])}** |`);
    }
    L.push(`| **Cost / g (all in)** | | | | **${$g(P.allIn)}** |`);
    L.push('', '**🏢 By building** (each building\'s lots, plus its own idle days):', '');
    L.push('| Building | Lots | Grams | ' + PARTS.map(p => PART_NAMES[p]).join(' | ') + ' | **All in** |', '|---|---|---|' + PARTS.map(() => '---').join('|') + '|---|');
    for (const bid of ['B1', 'B2']) {
        const x = P[bid];
        L.push(`| ${buildings[bid].name} | ${x.lots.join(', ') || '—'} | ${n0(x.grams)} | ${PARTS.map(p => $g(x.perGram[p])).join(' | ')} | **${$g(PARTS.reduce((t, p) => t + (x.perGram[p] || 0), 0))}** |`);
    }
    const SI = spendIn(P.from), firstYm = P.from.slice(0, 7);
    L.push('', `**🏢 What each building cost to run in the period** (only ${P.from} → ${TODAY}: ${firstYm} counts from the ${Number(P.from.slice(8))}th):`, '');
    L.push('| Building | ' + PARTS.map(p => PART_NAMES[p]).join(' | ') + ` | **Total** | ${firstYm} only |`, '|---|' + PARTS.map(() => '---').join('|') + '|---|---|');
    for (const bid of ['B1', 'B2']) {
        const tot = zero();
        for (const m of Object.values(SI[bid])) for (const p of PARTS) tot[p] += m[p];
        const first = SI[bid][firstYm];
        L.push(`| ${buildings[bid].name} | ${PARTS.map(p => $(tot[p])).join(' | ')} | **${$(PARTS.reduce((t, p) => t + tot[p], 0))}** | ${first ? $(PARTS.reduce((t, p) => t + first[p], 0)) : '—'} |`);
    }
}
L.push('', '## 🏢 What each building costs to run, by month', '');
L.push('Every $ spent in the building, whoever carries it (lots, mothers, idle days). Rent is the building\'s whole $10,000 every full month. These are whole months; the page counts only the period\'s days, so a month the period starts partway through shows only those days (see each period above).', '');
L.push('| Month | Building | Labour | Electricity | Water | Fertilizer | Supplies | Property | **Total** |', '|---|---|---|---|---|---|---|---|---|');
for (const ym of [...new Set([...Object.keys(SPEND.B1), ...Object.keys(SPEND.B2)])].sort()) for (const bid of ['B1', 'B2']) {
    const m = SPEND[bid][ym]; if (!m) continue;
    L.push(`| ${ym} | ${buildings[bid].name} | ${PARTS.map(p => $(m[p])).join(' | ')} | **${$(PARTS.reduce((t, p) => t + m[p], 0))}** |`);
}
L.push('', '## Days to watch', '');
L.push(`- **Building 2 before its first crop:** the mothers start ${M0} (the first day anything is costed), and Building 2 gets its first lot on ${bloom[1].transplant} (L102 transplanted to Grow 3). Those ${idle.B2.days.filter(d => d < bloom[1].transplant).length} days are idle: in the 12-month view they add Building 2's rent and dehumidifier to its grams; the 6-month view starts after them.`);
L.push(`- **Empty dry rooms:** on days no lot is drying, the dehumidifier's ${dehuKwh} kWh goes to the building's other lots by plants (the mothers included, in Building 1).`);
L.push(`- **Rent split by lights:** every room with lights has ${IN.lights}, so each day a building's rent is shared equally by its rooms with a lot growing: in Building 1 the Mother Room always, plus the Clone, Veg and grow rooms in use that day. A lot drying pays none.`);
L.push(`- **Only a lot drying:** ${idle.B2.rentDays.filter(d => d >= bloom[1].transplant).length ? `Building 2 had only a lot drying (nothing growing) on ${idle.B2.rentDays.filter(d => d >= bloom[1].transplant).length} days after its first crop; those days' rent is idle, spread over its grams.` : 'Building 2 always had a lot growing after its first crop.'} Building 1 always has the mothers growing.`);
L.push(`- Switch ⚡ Power & Rates → Property to **Plants** (each lot by its plants, drying lots included) or **Floor area** (every room 1,000 sq ft) to see the other splits.`);
L.push(`- **Double entries:** Transplanting and Flip days are on two grow-log pages (as PaperWizard does); water and fertilizer are only on the old page's row.`);
fs.writeFileSync(KEY_OUT, L.join('\n') + '\n');
// The same numbers as data, for checking the page's figures by script
const kwh = id => K[id].lightKwh + K[id].equipKwh;
const periodData = P => ({ from: P.from, shipped: P.shipped.map(b => b.id), grams: P.grams, perGram: P.pg, allIn: P.allIn, idle: P.idleB,
    byBuilding: { B1: P.B1.perGram, B2: P.B2.perGram }, spendIn: spendIn(P.from) });
fs.writeFileSync(KEY_OUT.replace(/\.md$/, '.json'), JSON.stringify({ today: TODAY, mother: { own: momOwn, kWh: kwh('M100'), perClone, clones: clonesCut },
    lots: Object.fromEntries(bloom.map(b => [b.id, { ...lotCost[b.id], kWh: kwh(b.id), waterL: K[b.id].waterL, fertMl: K[b.id].fertMl, hours: K[b.id].hours, ship: b.ship, building: b.building }])),
    periods: { '6m': periodData(P6), '12m': periodData(P12) }, spend: SPEND }, null, 1));

console.log(`Wrote ${OUT}`);
console.log(`Wrote ${KEY_OUT}`);
console.log(`Last 6 months: ${P6.shipped.length} lots, all in ${$g(P6.allIn)}/g · Last 12 months: ${P12.shipped.length} lots, all in ${$g(P12.allIn)}/g`);
process.exit(0);
