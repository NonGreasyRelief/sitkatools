// Total cost per gram on a hand-worked example: one crop through a clone room, a veg room and a flower room, with
// known lights, watts, light cycles, light %, equipment, water, fertilizer, supplies and labour.
import { today, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';

export const title = 'total cost per gram (worked example)';

// D0 = 120 days ago. Clone room D0..+9, veg room +10..+19, flower room +20..+40 (flip at +30, harvest at +40).
export function costDb() {
    const D = n => today(-120 + n);
    const T = ['clone_cut_prep', 0, 'planting', 10, 'transplant', 20, 'flip', 30, 'harvest', 40, 'bucking', 45, 'weigh_ship', 50];
    const events = [];
    for (let i = 0; i < T.length; i += 2) events.push({ id: `ev_c${i}`, date: D(T[i + 1]), title: `T ${T[i]}`, sourceTool: 'CropLabourWizard', lotId: 'L100', taskType: T[i], completed: true });
    events.find(e => e.taskType === 'harvest').labour_map = { [D(40)]: [{ employee: 'Alex', hours: 10 }, { employee: 'Blair', hours: 10 }, { employee: 'Casey', hours: 10 }] };
    // Grow log: flip day and the 9 after it — light at 50 %, 100 L of water, 10 mL Activator, 20 mL of "Core" (from the select)
    const days = {};
    for (let n = 30; n <= 39; n++) days[D(n)] = { lp01: '50', wt01: '100', ml01: '10', pr01: 'Core', ml02: '20' };
    return {
        buildings: { B1: { name: 'Building 1', createdDate: '2026-01-01', assignedRooms: ['R1CL', 'R1VG', 'R1G1', 'R1HL'] } },
        rooms: {
            R1CL: { name: 'Clone 1', createdDate: '2026-01-01', assignedLots: [], buildingId: 'B1', lightCount: 10, lightWattage: 100, vegLightHours: 18, bloomLightHours: 12 },
            R1VG: { name: 'Veg 1', createdDate: '2026-01-01', assignedLots: [], buildingId: 'B1', lightCount: 10, lightWattage: 500, vegLightHours: 18, bloomLightHours: 12 },
            R1G1: { name: 'Grow 1', createdDate: '2026-01-01', assignedLots: ['L100'], buildingId: 'B1', isFlowering: true, lightCount: 20, lightWattage: 1000, vegLightHours: 18, bloomLightHours: 12, canopySqFt: 400 },
            R1HL: { name: 'Hall 1', createdDate: '2026-01-01', assignedLots: [], buildingId: 'B1' }
        },
        lots: { L100: { name: 'L100', strain: 'Test Kush', createdDate: D(0), cloningRoom: 'Clone 1', vegRoom: 'Veg 1', destRoom: 'Grow 1', currentRoom: 'Grow 1', plantCount: 100, _tool_CropLabourWizard: { recipeId: 'rcp1' } } },
        calendarEvents: events,
        _EquipmentWizard: { rooms: {
            R1G1: { equipment: [{ id: 'eq1', type: 'Dehumidifier', name: 'Dehu', installedDate: '2020-01-01', power: { watts: 1000, units: 1, hoursPerDay: 24 }, tasks: [], additionalMaintenance: [] }] },
            R1HL: { equipment: [{ id: 'eq2', type: 'Air Conditioner', name: 'AC', installedDate: '2020-01-01', power: { watts: 500, units: 1, hoursPerDay: 24 }, tasks: [], additionalMaintenance: [] }] }
        } },
        _CropLabourWizard: {
            inputs: {
                inA: { name: 'Activator', kind: 'fertilizer', unit: 'L', price: 50 }, inC: { name: 'Core', kind: 'fertilizer', unit: 'L', price: 40 },
                inP: { name: 'Peat puck', kind: 'supply', unit: 'puck', price: 0.25 }, inB: { name: 'Coco block', kind: 'supply', unit: 'block', price: 3 }
            },
            recipes: { rcp1: { id: 'rcp1', name: 'Test', version: 1, tasks: [], inputs: [{ inputId: 'inP', name: 'Peat puck', unit: 'puck', qty: 1, per: 'plant' }, { inputId: 'inB', name: 'Coco block', unit: 'block', qty: 6, per: 'crop' }] } }
        },
        _EmployeeWizard: {
            employees: { Alex: { wage: 20, workDays: [1, 2, 3, 4, 5], timeOff: [] }, Blair: { wage: 21, workDays: [1, 2, 3, 4, 5], timeOff: [] }, Casey: { wage: 22, workDays: [1, 2, 3, 4, 5], timeOff: [] } },
            costs: { electricity: 'estimate', kWhRate: 0.1, waterPer1000L: 2.5, bills: [] }
        },
        _PaperWizard: {
            sheets: { growlog: { name: 'Grow log', cadence: 'daily-weekly', fields: [] }, harvestlog: { name: 'Harvest log', cadence: 'event', fields: [] } },
            wizards: {
                wz01: { sheetId: 'growlog', name: 'Grow', questions: [
                    { id: 'lp01', label: 'Light %', type: 'number', options: [], rowScoped: true, metric: 'env.lightPct' },
                    { id: 'wt01', label: 'Water L', type: 'number', options: [], rowScoped: true, metric: 'water.total' },
                    { id: 'ml01', label: 'Activator mL', type: 'number', options: [], rowScoped: true, metric: 'feed.nutrient', metricProduct: { name: 'Activator' } },
                    { id: 'pr01', label: 'Core or Fade?', type: 'select', options: ['Core', 'Fade', 'No'], rowScoped: true },
                    { id: 'ml02', label: 'Core/Fade mL', type: 'number', options: [], rowScoped: true, metric: 'feed.nutrient', metricProduct: { from: 'pr01' } }] },
                wz02: { sheetId: 'harvestlog', name: 'Harvest', questions: [{ id: 'fw01', label: 'Flower g', type: 'number', options: [], rowScoped: false, metric: 'harvest.flowerTotal', metricUnit: 'g' }] }
            },
            entries: { L100: {
                growlog: { instances: { [D(30)]: { phase: 'Bloom', room: 'Grow 1', header: {}, days } } },
                harvestlog: { instances: { [D(40)]: { header: { fw01: '10000' }, days: {} } } }
            } }
        }
    };
}

const near = (a, b, eps = 1e-6) => a != null && Math.abs(a - b) < eps;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, costDb());
    const ew = await openTool(b, main, 'EmployeeWizard');
    const costs = () => b.run(ew, `const M = rptModel(), c = M.crops.find(c => c.lotId === 'L100');
        return { k: rptCropInputCost(c, M), parts: rptCropCostParts(c, M), pg: rptCostAgg(M, '2000-01-01', '2100-01-01').costPG,
            flower: c.weights.flower, una: (M.power || rptPowerModel(M.crops)).unallocated,
            propIdle: Object.values((M.property || rptPropertyModel(M.crops)).unallocated).reduce((t, v) => t + v, 0) };`);

    // ---- Estimated usage at $0.10 / kWh ----
    let r = await costs();
    // lights: clone 1 kW × 18 h × 10 d = 180 · veg 5 kW × 18 h × 10 d = 900 · flower 20 kW × (18 h × 10 d + 12 h × 50 % × 10 d + 12 h × 1 d) = 5040
    check('lights: 6,120 kWh (clone 180 + veg 900 + flower 5,040, light % applied on the logged days)', near(r.k.power.lights, 6120), r.k.power.lights);
    // equipment: dehumidifier 24 kWh/d while the crop is in Grow 1 (21 d) + while Grow 1 is empty and the crop is elsewhere
    // in the building (20 d) · the hall AC 12 kWh/d on every day the crop is in the building (41 d)
    check('equipment & shared: 1,476 kWh (504 + 480 + 492)', near(r.k.power.equip, 1476), r.k.power.equip);
    check('electricity at the rate: $759.60', near(r.k.power.cost, 759.6), r.k.power.cost);
    check('light % missing on 31 crop-days (counted as 100 %)', r.k.power.pctMissingDays === 31, r.k.power.pctMissingDays);
    check('days with no crop in the building are left unallocated', r.una.kWh > 0);
    check('water: 1,000 L × $2.50 / 1,000 L = $2.50', near(r.k.water.L, 1000) && near(r.k.water.cost, 2.5), JSON.stringify(r.k.water));
    check('fertilizer by product: Activator 100 mL ($5), Core 200 mL ($8)', near(r.k.fert.byProduct.Activator?.mL, 100) && near(r.k.fert.byProduct.Activator.cost, 5) &&
        near(r.k.fert.byProduct.Core?.mL, 200) && near(r.k.fert.byProduct.Core.cost, 8) && near(r.k.fert.cost, 13), JSON.stringify(r.k.fert));
    check('supplies: 100 peat pucks ($25) + 6 coco blocks ($18) = $43', near(r.k.supplies.cost, 43) && r.k.supplies.items.find(x => x.name === 'Peat puck')?.qty === 100, JSON.stringify(r.k.supplies));
    check('labour: 30 h at $20/$21/$22 = $630', near(r.parts.labour, 630), r.parts.labour);
    check('flower: 10,000 g', r.flower === 10000);
    // Idle days go into the grams (user decision 2026-10-26): after the crop leaves (D41) until today (D120) Building 1 holds
    // no crop, and its dehumidifier (24 kWh/d) and hall AC (12 kWh/d) run on: 80 days × 36 kWh × $0.10 = $288
    check('idle building days\' power: 80 days × 36 kWh × $0.10 = $288, spread over the grams shipped', near(r.una.kWh, 2880) && near(r.una.cost, 288), JSON.stringify(r.una));
    check('cost per gram by part (labour .063, power (759.60 + 288) / 10,000 = .10476, water .00025, fertilizer .0013, supplies .0043)',
        near(r.pg.labour, 0.063) && near(r.pg.power, 0.10476) && near(r.pg.water, 0.00025) && near(r.pg.fert, 0.0013) && near(r.pg.supplies, 0.0043), JSON.stringify(r.pg));
    check('all in: $0.17361 per gram', near(r.pg.allIn, 0.17361), r.pg.allIn);

    // ---- Power bills: $4,100 over the crop's 41 days in the building, $500 after it left ----
    await b.run(main, `const c = DB.data._EmployeeWizard.costs; c.electricity = 'bills';
        c.bills = [{ id: 'b1', buildingId: 'B1', from: '${today(-120)}', to: '${today(-80)}', kWh: 41000, amount: 4100 }, { id: 'b2', buildingId: 'B1', from: '${today(-79)}', to: '${today(-70)}', amount: 500 }];
        markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    r = await costs();
    check('bills: the crop carries the $4,100 bill', near(r.k.power.cost, 4100), r.k.power.cost);
    check('bills: the $500 after it left is an idle day\'s: no crop carries it…', near(r.una.cost, 500), r.una.cost);
    check('…so it\'s spread over the grams shipped: electricity ($4,100 + $500) / 10,000 = $0.46 a gram', near(r.pg.power, 0.46), r.pg.power);
    check('bills: kWh still estimated (7,596)', near(r.k.power.kWh, 7596), r.k.power.kWh);

    // ---- The pages draw ----
    await b.run(ew, `document.getElementById('tabReports').click();`, { user: true });
    await b.run(ew, `const p = document.getElementById('rptPeriod'); p.value = '12m'; p.dispatchEvent(new Event('change'));`);
    const tile = await b.run(ew, `return [...document.querySelectorAll('.rpt-kpi')].find(k => k.textContent.includes('Cost / g'))?.innerText.replace(/\\s+/g, ' ') || null;`);
    // bills mode: labour .063 + electricity .46 + water .00025 + fertilizer .0013 + supplies .0043 = $0.52885
    check('overview: the all-in Cost / g tile ($0.53 with the bills)', /cost \/ g \(all in\)/i.test(tile || '') && tile.includes('$0.53') && tile.includes('electricity $0.46') && tile.includes('fertilizer $0.001'), tile);
    await b.run(ew, `document.querySelector('#rptPages button[data-page="costs"]').click();`, { user: true });
    const page = await b.run(ew, `return document.getElementById('rptBody').innerText;`);
    check('💲 Costs page draws its cards, no NaN/undefined', page.includes('What does a gram of flower cost?') && page.includes('What did the crops use?') && !/NaN|undefined|Infinity/.test(page));
    check('…lists inputs used (Activator, Core, Peat puck, water, electricity)', ['Activator', 'Core', 'Peat puck', 'Water', 'Electricity'].every(w => page.includes(w)));
    check('…and notes the missing light %', page.includes('Light % wasn’t logged on 31 crop-days'));
    check('…and that Building 1 has no property cost yet', page.includes('Building 1 has no monthly property cost'));

    // ---- Property: $3,000 a month for Building 1, shared by the crops in its rooms that day ----
    // The crop is in Building 1 from Day 0 (clone room) to the end of harvest (D40): 41 days, each $3,000 ÷ its month's days
    const propFor = monthly => { let t = 0; for (let n = 0; n <= 40; n++) { const [y, m] = today(-120 + n).split('-').map(Number); t += monthly / new Date(y, m, 0).getDate(); } return t; };
    const expProp = propFor(3000), allInBefore = r.pg.allIn;
    // …and D41 to today (D120) the building holds no crop: idle days, spread over the grams shipped
    let idleProp = 0; for (let n = 41; n <= 120; n++) { const [y, m] = today(-120 + n).split('-').map(Number); idleProp += 3000 / new Date(y, m, 0).getDate(); }
    await b.run(main, `DB.data.buildings.B1.monthlyPropertyCost = 3000; markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    r = await costs();
    check(`property: 41 days of $3,000 a month ($${expProp.toFixed(2)})`, near(r.k.property.cost, expProp) && r.k.property.days === 41, JSON.stringify(r.k.property));
    check('property per gram (its 41 days + the 80 idle days), and in the all-in', near(r.pg.property, (expProp + idleProp) / 10000) && near(r.pg.allIn, allInBefore + (expProp + idleProp) / 10000), JSON.stringify({ p: r.pg.property, all: r.pg.allIn }));
    check('property on days with no crop in the building: no crop carries it, the grams do', near(r.propIdle, idleProp), r.propIdle);
    await b.run(ew, `document.querySelector('#rptPages button[data-page="costs"]').click();`, { user: true });
    const page2 = await b.run(ew, `return document.getElementById('rptBody').innerText;`);
    check('💲 Costs page lists property, no NaN/undefined', page2.includes('Property (rent & fees)') && page2.includes('41 crop-days') && !page2.includes('Building 1 has no monthly property cost') && !/NaN|undefined|Infinity/.test(page2));
    check('…and notes the property cost of idle days, spread over the grams', page2.includes('of property cost fell on days with no crop growing in the building (empty, or only lots drying or trimming); it’s spread over the grams shipped in the period'));

    // ---- Closed out: the summary keeps its costs even when the rates change ----
    await b.run(ew, `rptSaveSummaries([rptModel().crops.find(c => c.lotId === 'L100')]);`);
    await b.sleep(300);
    const frozen = await b.run(main, `return DB.data._EmployeeWizard.crops.L100.costs;`);
    check('the summary freezes the costs (power $4,100, water $2.50, fertilizer $13, supplies $43, property)', frozen?.power?.cost === 4100 && frozen.water.cost === 2.5 && frozen.fert.cost === 13 && frozen.supplies.cost === 43 &&
        near(frozen.property?.cost, Math.round(expProp * 100) / 100) && frozen.property.days === 41, JSON.stringify(frozen && { p: frozen.power, w: frozen.water, pr: frozen.property }));
    await b.run(main, `delete DB.data.lots.L100; DB.data.calendarEvents = DB.data.calendarEvents.filter(e => e.lotId !== 'L100');
        DB.data._EmployeeWizard.costs.electricity = 'estimate'; DB.data._EmployeeWizard.costs.waterPer1000L = 10; DB.data.buildings.B1.monthlyPropertyCost = 5000; markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    r = await costs();
    check('a closed-out lot keeps its frozen costs after the rates change', near(r.k.power.cost, 4100) && near(r.k.water.cost, 2.5) && near(r.k.property.cost, Math.round(expProp * 100) / 100), JSON.stringify({ p: r.k.power.cost, w: r.k.water.cost, pr: r.k.property }));
    // 🔒 A summary frozen before property costs existed is never re-priced (cost audit 2026-10-26): its property is missing
    await b.run(main, `delete DB.data._EmployeeWizard.crops.L100.costs.property; markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    r = await costs();
    check('an older summary (no frozen property) isn\'t re-priced from today\'s buildings: its property is missing', r.k.property.cost == null, JSON.stringify(r.k.property));

    // ---- Two crops in Building 1: shared by lights, or by plants (the default) ----
    // L300 is in Veg 1 (10 lights) on D20–D40 while L100 is in Grow 1 (20 lights), so L100 carries 2/3 of those days
    await b.run(main, `DB.data._EmployeeWizard.costs.propertyShare = 'lights';
        DB.data.lots.L300 = { name: 'L300', strain: 'Test Kush', createdDate: '${today(-100)}', vegRoom: 'Veg 1', destRoom: 'Grow 1', currentRoom: 'Veg 1', plantCount: 50 };
        DB.data.calendarEvents.push({ id: 'ev_l3p', date: '${today(-100)}', title: 'T planting', sourceTool: 'CropLabourWizard', lotId: 'L300', taskType: 'planting' },
            { id: 'ev_l3t', date: '${today(-79)}', title: 'T transplant', sourceTool: 'CropLabourWizard', lotId: 'L300', taskType: 'transplant' });
        markUnsaved(); await WorkCopy.flush();`);
    await b.sleep(600);
    const shares = () => b.run(ew, `const M = rptModel(), pm = rptPropertyModel(M.crops), get = id => M.crops.find(c => c.lotId === id);
        return { L100: pm.byCrop.get('L100'), L300: pm.byCrop.get('L300'), p100: rptCropPlants(get('L100')), p300: rptCropPlants(get('L300')) };`);
    const span = (from, to, f) => { let t = 0; for (let n = from; n <= to; n++) { const [y, m] = today(-120 + n).split('-').map(Number); t += f(5000 / new Date(y, m, 0).getDate()); } return t; };
    let sh = await shares();
    check('lights: L100 in Grow 1 (20 lights) carries 2/3 of the days it shares with L300 in Veg 1 (10 lights)',
        near(sh.L100?.cost, span(0, 19, v => v) + span(20, 40, v => v * 2 / 3)) && near(sh.L300?.cost, span(20, 40, v => v / 3)) && sh.L300.days === 21, JSON.stringify(sh));
    await b.run(ew, `document.getElementById('tabPower').click(); document.querySelector('input[name="propertyShare"][value="plants"]').click();`, { user: true });
    await b.sleep(300);
    check('Power & Rates saves the property share', (await b.run(main, `return DB.data._EmployeeWizard.costs.propertyShare;`)) === 'plants');
    sh = await shares();
    const f100 = sh.p100 / (sh.p100 + sh.p300);
    check('plants: the shared days split by plants', near(sh.L100?.cost, span(0, 19, v => v) + span(20, 40, v => v * f100)) && near(sh.L300?.cost, span(20, 40, v => v * (1 - f100))), JSON.stringify(sh));
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });
    await leave(b, main);
    return results;
}
