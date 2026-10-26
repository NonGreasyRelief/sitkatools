// Cost per gram audit, 2026-10-26 — the fixes that make wrong numbers right (group A), on the hand-worked example of
// cost-per-gram.test.mjs (L100: clone room days 0–9, veg room 10–19, Grow 1 20–40, harvest day 40, today = day 120):
// - every lot takes its share of its rooms, scheduled or not;
// - a grow log that never records the harvest (0 plants) stops at the scheduled harvest, not today;
// - partial = missing: one unpriced fertilizer or supply, or a room with no watts, leaves that part out;
// - supplies per plant at the start use the lot's starting count;
// - a lot drying doesn't light its room;
// - a building's property cost may be $0; one not set leaves its lots' property out;
// - a crop left out of labour $ is named, with who and how many hours.
import { today, makeChecker, fresh, openSitka, loadSingle, openTool, leave } from './lib/helpers.mjs';
import { costDb } from './cost-per-gram.test.mjs';

export const title = 'cost per gram audit: every lot shares its rooms, open grow logs end, partial = missing';
const D = n => today(-120 + n);
const near = (a, b, eps = 1e-6) => a != null && Math.abs(a - b) < eps;

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    // Load a DB, open the Labour & Cost Wizard, run `code` against its report model, close it
    const measure = async (db, code) => {
        await openSitka(b, main, BASE);
        await loadSingle(b, main, db);
        const ew = await openTool(b, main, 'EmployeeWizard');
        const r = await b.run(ew, `const M = rptModel(); const of = id => M.crops.find(c => c.lotId === id);
            const k = id => rptCropInputCost(of(id), M); ${code}`);
        await leave(b, ew); await b.send('browsingContext.close', { context: ew });
        return r;
    };
    const withRent = () => { const db = costDb(); db.buildings.B1.monthlyPropertyCost = 3000; return db; };
    const plantCountQ = db => db._PaperWizard.wizards.wz01.questions.push({ id: 'pc01', label: 'Plants', type: 'plant-count', options: [], rowScoped: true });

    // ---- A lot with no schedule shares Grow 1 (days 20–40, 100 plants, the same as L100) ----
    const s1 = withRent();
    plantCountQ(s1);
    s1.lots.L200 = { name: 'L200', strain: 'Other', createdDate: D(20), destRoom: 'Grow 1', currentRoom: 'Grow 1', plantCount: 100, startPlantCount: 100 };
    const d200 = {}; for (let n = 20; n <= 39; n++) d200[D(n)] = { pc01: '100' };
    d200[D(40)] = { pc01: '0' };   // harvested on day 40, with L100
    s1._PaperWizard.entries.L200 = { growlog: { instances: { [D(20)]: { phase: 'Bloom', room: 'Grow 1', header: {}, days: d200 } } } };
    let r = await measure(s1, `return { l100: k('L100').power, l200: k('L200').power, p100: k('L100').property, p200: k('L200').property, crops: M.crops.map(c => c.lotId),
        miss: rptCosts(M) };`);
    check('a lot with no CropLabourWizard schedule is a crop in the report model', r.crops.includes('L200'), r.crops.join());
    // Both lots hold 100 plants in Grow 1 on days 20–40, so they split its lights evenly; L100's clone and veg rooms are its own
    check('…and takes half of Grow 1\'s lights while they share it (L100: clone 180 + veg 900 + the same as L200)', r.l200.lights > 0 && near(r.l100.lights, 180 + 900 + r.l200.lights, 1e-3), `L100 ${r.l100.lights} · L200 ${r.l200.lights}`);
    check('…and its share of the rent (L100 no longer pays for both)', r.p200.cost > 0 && r.p100.cost < 3977.42 - 1, `L100 ${r.p100.cost} · L200 ${r.p200.cost}`);
    check('What\'s missing says it has no schedule, so its costs reach no gram', /Lot L200 has no CropLabourWizard schedule/.test(r.miss), '');

    // ---- A grow log that never records the harvest: 100 plants days 20–39, harvest scheduled on day 40 ----
    const s2 = withRent();
    plantCountQ(s2);
    const g = s2._PaperWizard.entries.L100.growlog.instances[D(30)].days, d2 = {};
    for (let n = 20; n <= 39; n++) d2[D(n)] = { ...(g[D(n)] || {}), pc01: '100' };
    s2._PaperWizard.entries.L100.growlog.instances = { [D(20)]: { phase: 'Bloom', room: 'Grow 1', header: {}, days: d2 } };
    s2.lots.L100.startPlantCount = 100;
    const ended = JSON.parse(JSON.stringify(s2));
    ended._PaperWizard.entries.L100.growlog.instances[D(20)].days[D(40)] = { pc01: '0' };
    const stays = `return { stays: rptCropRoomDays(of('L100')).map(st => [st.roomId, st.to]), power: k('L100').power, rent: k('L100').property.cost,
        attn: rptAttention(M).map(x => x.text).join(' | '), miss: rptCosts(M) };`;
    const open = await measure(s2, stays), zero = await measure(ended, stays);
    check('a grow log that never records 0 plants stops at the scheduled harvest (day 40), not today', JSON.stringify(open.stays.find(st => st[0] === 'R1G1')) === JSON.stringify(['R1G1', D(40)]), JSON.stringify(open.stays));
    check('…so the lot costs what it would with the harvest recorded (power, rent)', near(open.power.kWh, zero.power.kWh, 1e-6) && near(open.rent, zero.rent, 1e-6), `${open.power.kWh} vs ${zero.power.kWh} kWh · $${open.rent} vs $${zero.rent}`);
    check('…and Needs attention and What\'s missing name it', /L100’s grow log stops without recording the harvest/.test(open.attn) && /Lot L100’s grow log stops on/.test(open.miss) && !/grow log stops/.test(zero.attn), open.attn);
    // A lot still growing (harvest ahead): its last logged room carries on to today
    const growing = JSON.parse(JSON.stringify(s2));
    for (const e of growing.calendarEvents) if (['harvest', 'bucking', 'weigh_ship'].includes(e.taskType)) e.date = today(10);
    r = await measure(growing, stays);
    check('a lot still growing (harvest ahead) stays in its last logged room until today', JSON.stringify(r.stays.find(st => st[0] === 'R1G1')) === JSON.stringify(['R1G1', today()]) && !/grow log stops/.test(r.attn), JSON.stringify(r.stays));

    // ---- Partial = missing ----
    const s3 = withRent();
    s3._PaperWizard.entries.L100.growlog.instances[D(30)].days[D(31)].pr01 = 'Fade';   // 20 mL of Fade, which has no price
    s3._CropLabourWizard.recipes.rcp1.inputs.push({ inputId: 'inT', name: 'Trellis', unit: 'ft', qty: 50, per: 'crop' });   // not on the price list
    r = await measure(s3, `const x = k('L100'); return { fert: x.fert, sup: x.supplies, parts: rptCropCostParts(of('L100'), M), miss: rptCosts(M) };`);
    check('one fertilizer product with no price leaves the lot\'s fertilizer out (Activator and Core still shown priced)', r.fert.cost == null && r.fert.byProduct.Activator.cost > 0 && r.fert.byProduct.Fade.cost == null, JSON.stringify(r.fert));
    check('one supply with no price leaves the lot\'s supplies out', r.sup.cost == null && r.parts.supplies == null, JSON.stringify(r.sup));
    check('…and What\'s missing says those lots have no figure until they\'re priced', /Fertilizer without a price: Fade — the lots that used it have no fertilizer figure/.test(r.miss) && /Supplies without a price: Trellis — the lots/.test(r.miss), '');
    const s4 = withRent();
    delete s4.rooms.R1VG.lightWattage;   // Veg 1 has 10 lights but no watts
    r = await measure(s4, `return { power: k('L100').power, miss: rptCosts(M) };`);
    check('a room with lights but no watts per light leaves its lots\' electricity out', r.power.cost == null && r.power.noWattsDays === 10, JSON.stringify(r.power));
    check('…and What\'s missing says so', /Veg 1 has no light count or watts per light, so the lots grown in it have no electricity figure/.test(r.miss), '');

    // ---- Supplies per plant at the start: the lot's starting count, not the first grow-log count ----
    const s5 = withRent();
    plantCountQ(s5);
    s5.lots.L100.startPlantCount = 120;
    for (const day of Object.values(s5._PaperWizard.entries.L100.growlog.instances[D(30)].days)) day.pc01 = '100';   // logged from day 30, after culls
    r = await measure(s5, `return k('L100').supplies.items.find(x => x.name === 'Peat puck');`);
    check('supplies per plant at the start: 1 peat puck × the 120 plants it started with (the first logged count was 100)', r.qty === 120 && near(r.cost, 30), JSON.stringify(r));

    // ---- A lot drying doesn't light its room ----
    const s6 = withRent();
    s6.rooms.R1DR = { name: 'Dry 1', createdDate: '2026-01-01', assignedLots: [], buildingId: 'B1', lightCount: 4, lightWattage: 600 };
    s6.buildings.B1.assignedRooms.push('R1DR');
    s6.lots.L100.dryRoom = 'Dry 1';
    r = await measure(s6, `return { power: k('L100').power, dry: rptCropRoomDays(of('L100')).find(st => st.roomId === 'R1DR') };`);
    check('the lot is in Dry 1 from the day after harvest to ship', r.dry && r.dry.phase === 'dry' && r.dry.to === D(50), JSON.stringify(r.dry));
    check('…and Dry 1\'s lights stay off while it dries (lights 6,120 kWh, as with no dry room)', near(r.power.lights, 6120, 1e-6), r.power.lights);

    // ---- Property: $0 is a figure; not set leaves the part out ----
    const s7 = costDb();
    s7.buildings.B1.monthlyPropertyCost = 0;
    r = await measure(s7, `return k('L100').property;`);
    check('a building with $0 property cost (no rent) prices the lot\'s property at $0', r.cost === 0 && r.days === 41, JSON.stringify(r));
    const s8 = withRent();
    s8.buildings.B2 = { name: 'Building 2', createdDate: '2026-01-01', assignedRooms: ['R2CL'] };
    s8.rooms.R2CL = { name: 'Clone 2', createdDate: '2026-01-01', assignedLots: [], buildingId: 'B2', lightCount: 10, lightWattage: 100, vegLightHours: 18, bloomLightHours: 12 };
    s8.lots.L100.cloningRoom = 'Clone 2';   // its clone days are in Building 2, which has no property cost
    r = await measure(s8, `return { prop: k('L100').property, miss: rptCosts(M) };`);
    check('days in a building with no property cost set leave the lot\'s property out', r.prop.cost == null && r.prop.noRentDays === 10, JSON.stringify(r.prop));
    check('…and What\'s missing says so ($0 for a building with no rent)', /Building 2 has no monthly property cost \(rent and fees\), so its lots have no property figure/.test(r.miss), '');

    // SitkaTools' building editor keeps $0 (no rent) and blank (not set) apart
    await openSitka(b, main, BASE);
    await loadSingle(b, main, costDb());
    const rent = await b.run(main, `BuildingManager.renderBuildingList();
        const set = v => { const inp = document.querySelector('.building-property-cost[data-building-id="B1"]'); inp.value = v; inp.dispatchEvent(new Event('change')); return DB.data.buildings.B1.monthlyPropertyCost; };
        return { zero: set('0'), blank: set(''), some: set('2500') };`);
    check('SitkaTools keeps a $0 property cost, and blank as not set', rent.zero === 0 && rent.blank === null && rent.some === 2500, JSON.stringify(rent));

    // ---- A crop left out of labour $ is named ----
    const s9 = withRent();
    s9.calendarEvents.find(e => e.taskType === 'harvest').labour_map[D(40)].push({ employee: 'Drew', hours: 2 }, { temp: 'Tess', hours: 1.5 });
    s9._EmployeeWizard.employees.Drew = { workDays: [1, 2, 3, 4, 5], timeOff: [] };   // no wage
    r = await measure(s9, `return { miss: rptCosts(M), attn: rptAttention(M).map(x => x.text).join(' | '), pg: rptAgg(M, rptHarvested(M, M.per.from, M.per.to), M.per.from, M.per.to).costPG.labour };`);
    check('a crop with hours that have no wage is named, with who and how much', /Lot L100 is left out of labour \$: Drew 2 h \(no wage\), temps 1\.5 h \(no wage typed on their hours\)/.test(r.miss), (r.miss.match(/Lot L100 is left out[^<]*/) || [''])[0]);
    check('…in Needs attention too, and it has no labour figure', /1 harvested crop is left out of labour \$/.test(r.attn) && r.pg == null, r.attn);

    await leave(b, main);
    return results;
}
