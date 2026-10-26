// Cost inputs: room canopy / light wattage / light cycles, building property cost, equipment power, CropLabourWizard's price list and recipe
// supplies, PaperWizard's light % metric and fertilizer product link, and the Labour & Cost Wizard's Power & Rates tab.
import { fixtureDb, makeChecker, fresh, openSitka, loadSingle, splitFiles, openSplit, openTool, leave } from './lib/helpers.mjs';

export const title = 'cost inputs (rooms, equipment, recipe inputs, light %, power & rates)';

const set = (b, ctx, sel, value, ev = 'change') => b.run(ctx, `const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('${ev}', { bubbles: true }));`);

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, fixtureDb());

    // ---- Room Manager: a new room with power, canopy and light cycles; then edits in its detail panel ----
    await b.run(main, `
        document.getElementById('roomId').value = 'R2VG'; document.getElementById('roomName').value = 'Veg A';
        document.getElementById('roomLightCount').value = '20'; document.getElementById('roomLightWattage').value = '630';
        document.getElementById('roomCanopySqFt').value = '400';
        document.getElementById('roomVegLightHours').value = '24';
        RoomManager.createRoom();`, { user: true });
    let room = await b.run(main, `return DB.data.rooms.R2VG;`);
    check('new room keeps lights, watts, canopy and cycles (veg 24/0 picked, bloom 12/12 default)',
        room?.lightCount === 20 && room.lightWattage === 630 && room.canopySqFt === 400 && room.vegLightHours === 24 && room.bloomLightHours === 12, JSON.stringify(room));
    await b.run(main, `RoomManager.expandedRoomId = 'R1G1'; RoomManager.renderRoomList();`);
    await set(b, main, '.room-light-watts[data-room-id="R1G1"]', '1000');
    await set(b, main, '.room-canopy[data-room-id="R1G1"]', '1150');
    await set(b, main, '.room-light-hours[data-room-id="R1G1"][data-field="bloomLightHours"]', '12');
    await set(b, main, '.room-light-hours[data-room-id="R1G1"][data-field="vegLightHours"]', '18');
    room = await b.run(main, `return DB.data.rooms.R1G1;`);
    check('detail panel edits save on the room', room.lightWattage === 1000 && room.canopySqFt === 1150 && room.vegLightHours === 18 && room.bloomLightHours === 12, JSON.stringify(room));
    check('a room edit marks the DB unsaved', await b.run(main, 'return hasUnsavedChanges;'));

    // ---- Building Manager: property cost a month (rent + fees) on a new building, then edited in its detail panel ----
    await b.run(main, `
        document.getElementById('buildingId').value = 'B3'; document.getElementById('buildingName').value = 'Building 3';
        document.getElementById('buildingPropertyCost').value = '7250.50';
        BuildingManager.createBuilding();`, { user: true });
    check('new building keeps its monthly property cost', (await b.run(main, `return DB.data.buildings.B3?.monthlyPropertyCost;`)) === 7250.5);
    await b.run(main, `BuildingManager.expandedBuildingId = 'B1'; BuildingManager.renderBuildingList();`);
    await set(b, main, '.building-property-cost[data-building-id="B1"]', '12500');
    check('detail panel edit saves the property cost', (await b.run(main, `return DB.data.buildings.B1.monthlyPropertyCost;`)) === 12500);
    check('…and the building list shows it', (await b.run(main, `return document.querySelector('#buildingList .room-item[data-building-id="B1"] .lot-meta').textContent;`)).includes('$12,500.00 / month'));
    await set(b, main, '.building-property-cost[data-building-id="B3"]', '');
    check('clearing it leaves no property cost', (await b.run(main, `return DB.data.buildings.B3.monthlyPropertyCost;`)) === null);

    // ---- EquipmentWizard: power on a new item, then edited on its card ----
    const eq = await openTool(b, main, 'EquipmentWizard');
    const evBefore = await b.run(main, `return JSON.stringify(DB.data.calendarEvents.filter(e => e.sourceTool === 'EquipmentWizard').map(e => e.id).sort());`);
    await b.run(eq, `const r = document.getElementById('activeRoom'); r.value = 'R1G1'; r.dispatchEvent(new Event('change'));
        document.getElementById('equipmentType').value = 'Dehumidifier'; document.getElementById('equipmentType').dispatchEvent(new Event('change'));
        document.getElementById('equipmentName').value = 'Dehu #1';
        document.getElementById('equipmentWatts').value = '900'; document.getElementById('equipmentUnits').value = '2'; document.getElementById('equipmentHours').value = '16';
        document.getElementById('equipmentForm').requestSubmit();`, { user: true });
    await b.sleep(300);
    let item = await b.run(main, `return (DB.data._EquipmentWizard.rooms.R1G1?.equipment || []).find(e => e.name === 'Dehu #1') || null;`);
    check('new equipment keeps its power (watts × units, hours a day)', item?.power?.watts === 900 && item.power.units === 2 && item.power.hoursPerDay === 16, JSON.stringify(item?.power));
    const idx = await b.run(eq, `return getRoomEquipment('R1G1').findIndex(e => e.name === 'Dehu #1');`);
    await set(b, eq, `.power-edit[data-idx="${idx}"] .eq-watts`, '1100');
    await b.sleep(300);
    item = await b.run(main, `return DB.data._EquipmentWizard.rooms.R1G1.equipment.find(e => e.name === 'Dehu #1');`);
    check('power edited on the card is saved', item.power.watts === 1100 && item.power.units === 2);
    check('the card shows the daily use', (await b.run(eq, `return document.getElementById('eqPower_${idx}').textContent;`)).includes('35.2 kWh/day'));
    const evAfter = await b.run(main, `return JSON.stringify(DB.data.calendarEvents.filter(e => e.sourceTool === 'EquipmentWizard').map(e => e.id).sort());`);
    check('a power edit leaves the maintenance events alone', evBefore === evAfter);
    await leave(b, eq); await b.send('browsingContext.close', { context: eq });

    // ---- CropLabourWizard: price list + supplies on a recipe ----
    const clw = await openTool(b, main, 'CropLabourWizard');
    await b.run(clw, `openRecipeManager(); document.getElementById('recipeNewBtn').click();`, { user: true });
    await b.run(clw, `document.getElementById('recipeNameInput').value = 'Test Recipe'; document.querySelector('.editor-tab[data-tab="inputs"]').click();`, { user: true });
    const addInput = async (name, kind, unit, price) => {
        await b.run(clw, `document.getElementById('addInputBtn').click();`, { user: true });
        await b.run(clw, `const tr = [...document.querySelectorAll('#inputCatalogBody tr[data-id]')].pop();
            tr.querySelector('.in-name').value = ${JSON.stringify(name)};
            tr.querySelector('.in-kind').value = ${JSON.stringify(kind)}; tr.querySelector('.in-kind').dispatchEvent(new Event('change', { bubbles: true }));
            if (!tr.querySelector('.in-unit').disabled) tr.querySelector('.in-unit').value = ${JSON.stringify(unit)};
            tr.querySelector('.in-price').value = ${JSON.stringify(String(price))}; tr.querySelector('.in-price').dispatchEvent(new Event('change', { bubbles: true }));`);
    };
    await addInput('Core', 'fertilizer', '', 40);
    await addInput('Coco block', 'supply', 'block', 3);
    await addInput('Peat puck', 'supply', 'puck', 0.25);
    check('a fertilizer is priced per litre', (await b.run(clw, `return [...document.querySelectorAll('#inputCatalogBody tr[data-id]')][0].querySelector('.in-unit').value;`)) === 'L');
    await b.run(clw, `document.getElementById('addRecipeInputBtn').click();`, { user: true });
    await b.run(clw, `const tr = document.querySelector('#recipeInputsBody tr[data-i="0"]');
        tr.querySelector('.ri-input').value = [...tr.querySelector('.ri-input').options].find(o => o.textContent.startsWith('Peat puck')).value;
        tr.querySelector('.ri-qty').value = '1'; tr.querySelector('.ri-per').value = 'plant';
        tr.querySelector('.ri-qty').dispatchEvent(new Event('change', { bubbles: true }));`);
    await b.run(clw, `document.getElementById('addRecipeInputBtn').click();`, { user: true });
    await b.run(clw, `const tr = document.querySelector('#recipeInputsBody tr[data-i="1"]');
        tr.querySelector('.ri-input').value = [...tr.querySelector('.ri-input').options].find(o => o.textContent.startsWith('Coco block')).value;
        tr.querySelector('.ri-qty').value = '6'; tr.querySelector('.ri-qty').dispatchEvent(new Event('change', { bubbles: true }));`);
    check('the recipe row shows the cost', (await b.run(clw, `return document.querySelector('#recipeInputsBody tr[data-i="1"] .ri-cost').textContent;`)) === '≈ $18.00 per crop');
    await b.run(clw, `document.getElementById('recipeEditorSaveBtn').click();`, { user: true });
    await b.sleep(300);
    const clwData = await b.run(main, `return DB.data._CropLabourWizard;`);
    const rec = Object.values(clwData.recipes || {}).find(r => r.name === 'Test Recipe');
    const cat = Object.values(clwData.inputs || {});
    check('Save Recipe saves the price list', cat.length === 3 && cat.find(x => x.name === 'Core')?.kind === 'fertilizer' && cat.find(x => x.name === 'Core').unit === 'L' && cat.find(x => x.name === 'Coco block')?.price === 3, JSON.stringify(cat));
    check('…and the recipe\'s supplies (qty, per crop / per plant)', JSON.stringify(rec?.inputs?.map(x => [x.name, x.qty, x.per])) === JSON.stringify([['Peat puck', 1, 'plant'], ['Coco block', 6, 'crop']]), JSON.stringify(rec?.inputs));
    // Import a recipe that names a supply the price list doesn't have, and one it has
    const imported = { id: 'imprt1', name: 'Imported', version: 1, tasks: rec.tasks, inputs: [{ name: 'coco BLOCK', unit: 'block', qty: 4, per: 'crop' }, { name: 'Trellis', unit: 'ft', qty: 120, per: 'crop' }] };
    await b.run(clw, `const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(JSON.stringify(imported))}], 'recipe-imprt1.json', { type: 'application/json' }));
        const inp = document.getElementById('recipeImportInput'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));`);
    await b.sleep(500);
    const after = await b.run(main, `return DB.data._CropLabourWizard;`);
    const impRec = after.recipes.imprt1, cocoId = Object.entries(after.inputs).find(([, x]) => x.name === 'Coco block')?.[0];
    const trellis = Object.entries(after.inputs).find(([, x]) => x.name === 'Trellis');
    check('import matches an existing supply by name', impRec?.inputs?.[0]?.inputId === cocoId);
    check('…and adds a new one to the price list without a price', trellis && trellis[1].price == null && trellis[1].unit === 'ft' && impRec.inputs[1].inputId === trellis[0]);
    // Day offsets out of range come in clamped to −30…+365 (the clone cut, counted back from harvest, down to −200)
    const wild = { id: 'wild1', name: 'Wild offsets', version: 1, tasks: rec.tasks.map(t => ({ ...t,
        defaultOffset: t.taskType === 'harvest' ? 400 : t.taskType === 'topping' ? -50 : t.taskType === 'clone_cut' ? -150 : t.defaultOffset })) };
    await b.run(clw, `const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(JSON.stringify(wild))}], 'recipe-wild1.json', { type: 'application/json' }));
        const inp = document.getElementById('recipeImportInput'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));`);
    await b.sleep(500);
    const wildRec = (await b.run(main, `return DB.data._CropLabourWizard.recipes.wild1;`))?.tasks || [];
    const off = tt => wildRec.find(t => t.taskType === tt)?.defaultOffset;
    check('importing a recipe keeps day offsets to −30…+365 (clone cut down to −200)', off('harvest') === 365 && off('topping') === -30 && off('clone_cut') === -150,
        JSON.stringify([off('harvest'), off('topping'), off('clone_cut')]));
    check('…and says so', (await b.run(clw, `return document.getElementById('toast')?.textContent || document.querySelector('.toast')?.textContent || '';`)).includes('brought into range'));
    // Delete an input used by another recipe (asks first — accepted)
    await b.run(clw, `openRecipeManager(); showRecipeEditor(cloneRecipeData(DB.data._CropLabourWizard.recipes.imprt1)); document.querySelector('.editor-tab[data-tab="inputs"]').click();`, { user: true });
    await b.run(clw, `[...document.querySelectorAll('#inputCatalogBody tr[data-id]')].find(tr => tr.querySelector('.in-name').value === 'Coco block').querySelector('[data-act="del-input"]').click();`, { user: true });
    await b.run(clw, `document.getElementById('recipeEditorSaveBtn').click();`, { user: true });
    await b.sleep(300);
    const after2 = await b.run(main, `return DB.data._CropLabourWizard;`);
    check('deleting a price-list input removes it from every recipe', !Object.values(after2.inputs).some(x => x.name === 'Coco block') &&
        !Object.values(after2.recipes).some(r => (r.inputs || []).some(x => x.name === 'Coco block')), JSON.stringify(Object.values(after2.recipes).map(r => r.inputs)));
    check('…and keeps the rest of each recipe\'s supplies', JSON.stringify(after2.recipes.imprt1.inputs?.map(x => x.name)) === '["Trellis"]' &&
        JSON.stringify(after2.recipes[rec.id].inputs?.map(x => x.name)) === '["Peat puck"]', JSON.stringify([after2.recipes.imprt1.inputs, after2.recipes[rec.id].inputs]));
    // Re-opening a recipe shows its supplies (and saving it untouched keeps them)
    await b.run(clw, `openRecipeManager(); showRecipeEditor(cloneRecipeData(DB.data._CropLabourWizard.recipes[${JSON.stringify(rec.id)}]));`, { user: true });
    await b.run(clw, `document.getElementById('recipeEditorSaveBtn').click();`, { user: true });
    await b.sleep(200);
    check('opening and saving a recipe keeps its supplies', JSON.stringify((await b.run(main, `return DB.data._CropLabourWizard.recipes[${JSON.stringify(rec.id)}].inputs;`))?.map(x => x.name)) === '["Peat puck"]');
    await leave(b, clw); await b.send('browsingContext.close', { context: clw });

    // ---- PaperWizard: light % metric + fertilizer product link on the question card ----
    const pw = await openTool(b, main, 'PaperWizard');
    check('PaperWizard offers the Light intensity (%) metric', (await b.run(pw, `return REPORT_METRIC_KIND['env.lightPct'];`)) === 'number');
    const card = await b.run(pw, `cfgWizard = { questions: [{ id: 'cf01', label: 'Core or Fade?', type: 'select', options: ['Core', 'Fade', 'No'] }, { id: 'ml01', label: 'mL?', type: 'number', options: [], metric: 'feed.nutrient', metricProduct: { from: 'cf01' } }] };
        return { from: productControlsHtml(cfgWizard.questions[1]), none: productControlsHtml({ id: 'x', metric: 'water.total' }) };`);
    check('a fertilizer mL question offers its product link', card.from.includes('The answer to another question') && card.from.includes('Core or Fade?') && card.none === '');
    await leave(b, pw); await b.send('browsingContext.close', { context: pw });

    // ---- Labour & Cost Wizard: Power & Rates ----
    const ew = await openTool(b, main, 'EmployeeWizard');
    check('renamed: Labour & Cost Wizard', (await b.run(ew, `return document.querySelector('.logo').textContent + ' | ' + document.title;`)) === '👥 Labour & Cost Wizard | Labour & Cost Wizard');
    await b.run(ew, `document.getElementById('tabPower').click();`, { user: true });
    await b.run(ew, `document.querySelector('input[name="powerSource"][value="bills"]').click();`, { user: true });
    await set(b, ew, '#pwRate', '0.12');
    await set(b, ew, '#pwWater', '2.5');
    await b.run(ew, `document.getElementById('pwBillBuilding').value = 'B1'; document.getElementById('pwBillFrom').value = '2026-09-01'; document.getElementById('pwBillTo').value = '2026-09-30';
        document.getElementById('pwBillKwh').value = '30000'; document.getElementById('pwBillAmount').value = '3600'; document.getElementById('pwBillAddBtn').click();`, { user: true });
    await b.run(ew, `document.getElementById('pwBillFrom').value = '2026-08-01'; document.getElementById('pwBillTo').value = '2026-08-31'; document.getElementById('pwBillAmount').value = '3300'; document.getElementById('pwBillAddBtn').click();`, { user: true });
    await b.sleep(300);
    let costs = await b.run(main, `return DB.data._EmployeeWizard.costs;`);
    check('property is shared by floor area by default (user decision 2026-10-26)', (await b.run(ew, `return document.querySelector('input[name="propertyShare"]:checked')?.value;`)) === 'area');
    await b.run(ew, `document.querySelector('input[name="propertyShare"][value="plants"]').click();`, { user: true });
    await b.sleep(200);
    check('…and picking plants is saved', (await b.run(main, `return DB.data._EmployeeWizard.costs.propertyShare;`)) === 'plants');
    check('Power & Rates saves the source, rates and bills', costs?.electricity === 'bills' && costs.kWhRate === 0.12 && costs.waterPer1000L === 2.5 && costs.bills.length === 2 && costs.bills[0].kWh === 30000 && costs.bills[0].buildingId === 'B1', JSON.stringify(costs));
    check('the bills table lists them with $ per kWh', (await b.run(ew, `return document.getElementById('pwBillTable').innerText;`)).includes('$0.12'));
    await b.run(ew, `document.querySelectorAll('#pwBillTable [data-bill]')[1].click();`, { user: true });
    await b.sleep(200);
    costs = await b.run(main, `return DB.data._EmployeeWizard.costs;`);
    check('a bill can be deleted', costs.bills.length === 1 && costs.bills[0].from === '2026-09-01');
    await leave(b, ew); await b.send('browsingContext.close', { context: ew });

    // ---- Split files: everything lands in Main.json; a building device doesn't get the Power & Rates tab ----
    const db = await b.run(main, 'return DB.data;');
    const files = await splitFiles(b, main, BASE, db);
    const m = JSON.parse(files['Main.json']);
    check('Main.json holds the building property cost', m.buildings.B1.monthlyPropertyCost === 12500);
    check('Main.json holds room, equipment, price list and costs', m.rooms.R1G1.lightWattage === 1000 && m.rooms.R1G1.canopySqFt === 1150 &&
        m._EquipmentWizard.rooms.R1G1.equipment.some(e => e.power?.watts === 1100) && Object.keys(m._CropLabourWizard.inputs).length >= 3 && m._EmployeeWizard.costs.bills.length === 1);
    await openSplit(b, main, BASE, 'B1', files);
    const ewB = await openTool(b, main, 'EmployeeWizard');
    check('building device: no Power & Rates tab', (await b.run(ewB, `return document.getElementById('tabPower').style.display;`)) === 'none');
    await leave(b, ewB); await b.send('browsingContext.close', { context: ewB });
    await leave(b, main);
    return results;
}
