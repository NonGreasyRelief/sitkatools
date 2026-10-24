# Labour & Cost Wizard Reports (EmployeeWizard folder)

Spec for the **📊 Reports** tab, and the guide for hooking up the harvest log. Every chart is hand-rolled SVG inside `EmployeeWizard.html`: no chart libraries, no network calls, no new browser storage.

**Demo DB:** `node examples/make-example-db.js [out.json] [--today=YYYY-MM-DD]` builds `examples/Example-Reports-DB.json`. It starts from `PaperWizard/Current.json` and adds past crops (1000 g wet per plant), labour, grow and harvest logs, chore and equipment hours, time off and the cost inputs, dated relative to today. Load it with SitkaTools' 📂 Load DB; rerun it on the day of a demo. It is git-ignored because it holds real staff and lot names.

**Checking a change:** run every page against an empty DB, the sample DB (`PaperWizard/Current.json`) and the demo DB, also with no wages and with building and strain filters. `tests/cost-per-gram.test.mjs` checks a hand-worked cost per gram.

---

## 1. What's built

Reports is the last tab and office only (building devices don't get it). The **Labour Report — estimated vs. actual** table stays below the Employees, Tasks and Reports tabs.

- **Filter row:**
  - **Period:** last 3, 6, 12, 24 or 36 months, or year to date. Every tile compares against the **previous period of the same length**.
  - **Building, Flower room, Strain.**
  - **Per:** plant (default), sq ft of canopy, light, gram of flower, or total. It changes hours by task, labour $ by phase, the strain scorecard, the weight cascade and the room trend; every other card says it isn't affected. Per gram shows hours per kg (per gram is too small to read). Per light uses the flower room's `rooms.<id>.lightCount`.
- **⤢ Expand** grows the popup to the full screen; cards then go two to a row.
- **🖨️ Board pack:** the seven report pages with the current filters in a print-ready window — light theme, Letter landscape, one page per sheet, a tick box per page, an optional **Data tables** toggle. **Print / Save as PDF** uses the browser's dialog. Same numbers and privacy rules.
- **Every card:** its title is the question it answers; a chip says what data it needs; **⊞ Table** shows the same numbers as a table; hover any mark for details; with no data it says exactly what's missing and where to add it.

| Page | Cards | Needs |
|---|---|---|
| **Overview** | 8 KPI tiles (sparkline + change vs previous period): flower yield, g/plant, g/sq ft/year, potency, terpenes, **cost / g (all in)** with its six-part breakdown, labour hours, estimate accuracy. **Needs attention**, each line linking to its page: tasks over estimate, slipping rooms, weeks short of staff, idle flower rooms, past-due tasks, completed tasks with no hours, shipped lots with no weights or no summary, costs left out of the cost per gram. | mixed |
| **Crop Timeline** | **Crop labour Gantt** (one lot): tasks banded by phase, planned outline vs hours logged per day, ✓ done / ⚠ past due, estimate vs actual, a daily hours strip. **Room schedule Gantt**: every lot's stay in each room, 4 months back to 8 ahead; TBA lots hatched, idle flower-room days amber, BC holidays and today marked, % in use per flower room. | data exists today |
| **Labour** | **Where do the hours go?** (Pareto by task, estimate outlined). **Which tasks run over their estimate?** (dot per crop, median) + **suggested estimates** at 3+ crops. **What kind of work fills the period?** (crop / chores / equipment, temps' share, logged vs scheduled). **Labour $ per gram by phase** (waterfall). | today; $/g needs harvest numbers + Wages.json |
| **💲 Costs** | Always per gram of flower. **What does a gram of flower cost?** (this vs previous period, stacked by the six parts). **🌿 What does a clone cost?** (each mother lot's cost per clone so far, by part, and the clones cut in the period at their average price vs the previous period). **Cost per gram, crop by crop.** **How much electricity does a crop use?** (kWh: lights vs equipment & shared rooms). **What did the crops use?** (fertilizer by product, supplies — "Coco block · at 🪴 Transplanting…" when charged at a task — water, electricity, property crop-days, with $). **What's missing from the cost?** (no rate, rooms without watts, equipment without power, light % not logged, unpriced or unlinked fertilizer, recipes without supplies, supplies charged at a task with no plant count on or before it (counted from the start), bills not charged to any crop, buildings without a property cost, property cost on days with no crop in the building, lots cut from a mother lot with no cost per clone yet, mother lots with no Mother room or dates). | harvest numbers, Room Manager, EquipmentWizard power, grow-log tags, price list, ⚡ Power & Rates |
| **Yield & Quality** | **Strain scorecard**: yield (Per switch) vs potency → Keep / Potency play / Volume play / Review. **Potency & terpenes by strain** (strip plots). **Weight cascade**: wet → dry → stems & waste → total yield → trim → flower (stacked by grade). **Is any room slipping?** (Per switch). **What drives yield?** Any per-crop measure vs an outcome: dot per harvested crop, fitted line, r and n. | harvest numbers (+ grow-log tags for climate measures) |
| **Rooms & Environment** | **Climate for one lot**: temperature, RH, VPD vs target bands, IPM flag days marked. **Pest heat map**: rooms × last 16 weeks (days flagged), plus a hermaphrodite marker. | grow-log tags |
| **Forecast** | **Do we have enough people?** Estimated hours for the next 12 weeks (scheduled and projected crops, daily chores) vs roster capacity. **What will we harvest in the next 6 months?** Expected flower per harvest, best/worst range from past crops. | today; harvest forecast needs harvest numbers |
| **📋 CTLS month** | The month's cultivation numbers for Health Canada's monthly CTLS report, for the whole facility (no filters; see "CTLS month" below): a month picker (last month by default, 36 months back), five tiles, **Checks** (what could make the numbers wrong), **🌱 Plants** (every dated change with what happened, +/−, to / from whom and the initials, then the totals by reason from the opening to the closing count), **plants on hand at month end by lot** (room, phase, total; by phase), **💧 wet cannabis hanging to dry**, **🌾 dry flower sent out**, and **lots ready to close out** (save their plant history first). **🖨️ Print** and **📌 Mark as filed**. | grow logs with 🌱 plant counts, harvest-log weights tagged |
| **⚙️ Setup & data** | Canopy sq ft, lights and watts per light per flower room (read-only, from Room Manager). Shift length. **Crop summaries** (save / update / remove, 📂 Import archived lots). **Report metrics**: which question feeds each metric, and its answer count. | — |

---

## 2. Decisions

1. Reports may **read every tool's data**, read-only. They write only `_EmployeeWizard.crops`, `.settings`, `.cropCosts` (§4) and `.ctls` (filed CTLS months).
2. **Metric tags** are a drop-down on PaperWizard questions.
3. **Closed lots:** a per-lot summary stays in Main.json for **36 months**. Lots closed without one can be imported from their archive file.
4. **Yield:** flower yield = bigs + mids + smalls + popcorn sent to processing; total yield = flower + trim; **wet weight** = the weight in the drying room on harvest day; **dry weight** = the whole lot after drying.
5. Shifts are **8 h** by default. The Labour Report (estimated vs. actual) stays in place.
6. Canopy sq ft and light counts are set on the room in SitkaTools' Room Manager; Reports only shows them.
7. **Costs:** live lots use **today's wages**. Saving a crop summary while Wages.json is open freezes its labour cost (§4), so a later raise doesn't change a closed-out lot. Summaries hold hours per person, never $. Privacy rules: §7.

---

## 3. Hooking up the harvest log

Configuration only — the charts are already wired to these metrics.

1. **Set up the harvest sheet** in PaperWizard → Configure Sheets as usual, with its Document set to *Harvest Log*.
2. **Tag each number question** with the **Report metric** drop-down on its question card. Weights get **Answered in** (g / kg / lb), converted to grams.

   | Question on the form | Report metric | When it's filled |
   |---|---|---|
   | Wet weight in the drying room | `harvest.wetWeight` | harvest day |
   | Dry weight, whole lot | `harvest.dryWeight` | out of the dry room |
   | Bigs / Mids / Smalls / Popcorn | `harvest.bigs` / `.mids` / `.smalls` / `.popcorn` | weigh & send to processing |
   | Flower, all grades together (only if grades aren't weighed separately) | `harvest.flowerTotal` | weigh & send |
   | Trim | `harvest.trim` | weigh & send |
   | Total THC % | `harvest.potency` | lab result |
   | Total terpenes % | `harvest.terpenes` | lab result |
   | Plants harvested (optional) | `harvest.plantsHarvested` | harvest day |

   **Form design rules:**
   - **Weights add up.** Every answer to a weight metric on a lot is summed (daily trim weighings, a multi-day harvest, several bins), so a question must record **that entry's** weight, never a running total.
   - **Percentages and counts take the latest answer**, so a later re-test replaces the first.
   - Instance-level answers (the log header), per-day answers and 📌 constants are all read.
   - Tags can sit on any sheet: harvest, drying, trim or a separate lab-results sheet.
   - If grades are weighed, flower yield = the sum of the grades and `harvest.flowerTotal` is ignored.
3. **Check Setup & data → Report metrics:** each tagged metric's sheet, question and answer count. Untagged core harvest metrics show **Not tagged yet** (amber).
4. **Set canopy sq ft** per flower room in SitkaTools' Room Manager; g/sq ft and g/sq ft/year show "—" until then.
5. **Save crop summaries** before close-out (Setup & data → **Save N shipped**, or per lot). Lots already closed: **📂 Import archived lots** from their `Archive/Lot-*.json` files.
6. **Optional — tag the grow log** (temperature, RH, CO₂, PAR, pH/EC, nutrients, water, runoff, the four YES/NO IPM questions) for the climate chart, pest heat map and grow-log averages.

One harvested lot with weights fills the yield tiles, strain scorecard, weight cascade and room trend. The harvest forecast needs two harvested crops in a room, or two anywhere.

---

## 4. How it works

### Data sources (read on every render; nothing is cached)

| Source | Used for |
|---|---|
| CropLabourWizard events: `labour_map` (Tasks tab or DailyWizard), `estStaff` / `estMinutes`, `completed`, `taskType`, `roomPhase` | hours, estimates, the Gantts, schedule dates |
| CropProjection events | projected room stays, future labour demand, harvest forecast |
| Other events with a `labour_map` (EquipmentWizard, …) | "equipment & other" hours and cost |
| `_EmployeeWizard.employees`: `workDays`, `timeOff`, `wage` (only while Wages.json is open) | capacity, cost |
| `_PaperWizard.wizards[*].questions[*].metric` / `metricUnit` + `_PaperWizard.entries` | harvest numbers, grow-log series, plant counts (🌱 plant-count questions need no tag) |
| `_DailyWizard.buildings[*].tasks` (minutes × staff, recurrence) | chore hours in the demand forecast |
| `_DailyWizard.buildings[*].labour` | chore hours in the labour mix, labour hours, logged vs scheduled, the chores share of $ per gram. Entries the office removed are gone from it (kept only in `.adjustments`). |
| `_DailyWizard.buildings[*].tasks[].roomId` | 🚪 room chores: their hours go to the crops in that room that day (`rptApplyChores`) |
| `rooms.<id>` (Room Manager): canopy sq ft, `lightCount`, watts per light, veg / bloom light hours | Per sq ft / Per light (`lightCount` is saved on each summary), the electricity estimate |
| `buildings.<id>.monthlyPropertyCost` | rent and property fees, shared by room lights or plants (`costs.propertyShare`) |
| `_EquipmentWizard.rooms.<id>.equipment[].power` | watts × units × hours a day, for the electricity estimate |
| `_CropLabourWizard.inputs`, `recipes.<id>.inputs` | the price list (fertilizers per litre, supplies per unit) and each recipe's supplies |
| `_CropLabourWizard.taskTypes` | task names and order, and each task's cost phase |
| `_EmployeeWizard.crops` / `.settings` / `.costs` | closed-out lots / shift length (and the fallback canopy) / ⚡ Power & Rates |

### The crop object

`rptBuildCrop(lotId, lot, events, paperwork, qmap)` builds one crop's numbers, from the live DB or from an archive file's `lot` / `events` / `paperwork`. While a lot is in the DB, reports use its **live** numbers; its saved summary takes over only after close-out. "Save summary" stores this object (version 4, about 6–10 KB) in `_EmployeeWizard.crops[lotId]`, with its non-labour costs frozen in `costs`:

```js
{
  version: 4, lotId, strain, parentLotId, savedAt, recipeId,      // recipeId: the lot's CropLabourWizard recipe (its supplies)
  rooms: { cloning, veg, flower, dry, trim },                     // names, as on the lot
  flowerRoomId, buildingId, canopySqFt, lightCount,               // the flower room's canopy and lights (Room Manager)
  dates: { day0, planting, transplant, flip, harvestStart, harvestEnd, tankClean, bucking, trimStart, trimEnd, ship },
  labour: { est, act, temp, tempCost, tempNoWage,
            byPerson: { "<employee>": h, "temp:<name>": h },        // hours only — never wages
            byTask: { <taskType>: { date, est, act, temp, n, done, estStaff, estMinutes, roomId, days: { "YYYY-MM-DD": h },
                                    people?, tempCost?, tempNoWage? } },   // Cutting Clones only: hours by person, temps' $ (prices the cutting)
            chores: { "<building>:<code>": { name, roomId, act, temp, days: { "YYYY-MM-DD": h }, byPhase: { clone, veg, flower, post } } } },
                                                                    // the crop's share of room chores (version 3); act, byPerson and temps include it
  weights: { wet, dry, grades: { bigs, mids, smalls, popcorn }, flower, trim, total },   // grams
  lab: { potency, terpenes },                                       // %
  plants: { started, harvested },
  derived: { gpp, gsf, gsfy, heldDays, dryDown, trimOut },
  env: { veg: {…}, flower: { temp, rh, vpd, co2, par, feedEc, feedPh, runoffEc, runoffPh }, waterL, nutrientMl,
         nutrientByProduct: { "<product>": mL, "": mL not linked to a product }, lightPct },
  ipm: { flagDays, hermDays },
  mother: true,                                                     // 🌿 a mother lot (vegetative recipe); its dates add retire, cloneCut and end
  ctls: { v: 1, type, created, start, from, parent, dryRoom, room, stage, logged,   // version 4: the 📋 CTLS month's history
          counts: [[day, plants, room, phase]], moves: [{ date, kind, reason, n, to, by }], wet: [[day, g]], dry: [[day, g]] },
  costs: {                                                          // saved summaries only — frozen at save (rptFrozenCosts)
    power: { kWh, lights, equip, cost, source: 'bills' | 'estimate', pctMissingDays },
    water: { L, cost }, fert: { byProduct: { "<product>": { mL, cost } }, unpriced: [], cost },
    supplies: { items: [{ name, unit, qty, cost, at?: { task, label, plants, how, date } }], unpriced: [], cost },   // at: charged per plant at a task
    property: { days, cost }, savedAt                               // days: crop-days in a building with a property cost
  }
}
```

- **Retention:** every save drops summaries (and their frozen costs) whose harvest date, or save date, is over **36 months** old.
- **Frozen labour cost:** `_EmployeeWizard.cropCosts[lotId] = { cost, missingHours, savedAt }`, written by Save summary only while wages are open. SitkaTools' `DbSplit.split` puts it in Wages.json, and `DbSplit.merge` reads it back only when Wages.json is opened. A crop with `missingHours > 0` (someone had no wage) stays out of $ figures.
- **Frozen non-labour costs:** `costs`, written by Save summary and archive import, stays in Main.json with the summary, so a closed-out lot keeps it when rates, prices or bills change. Crops saved together are modelled together (they share rooms and bills).
- **Close-out:** SitkaTools' close-out doesn't touch `_EmployeeWizard`, so summaries stay after a lot is archived.
- **Up to date?** Setup & data marks a summary "out of date" when the live numbers differ. Frozen `costs` don't count (they move with rates and bills); summaries older than version 3 are always out of date.
- **Room chores** (`rptApplyChores`, run once per model): every chore entry whose chore has a room is split between the crops in that room that day (`rptRoomOccupancy`: `rptCropRoomDays` stays, by plants) and added to each live crop's `labour`. The row keeps only what no crop carries, so it isn't spread again as overhead. A closed-out crop's share is in its summary when it was saved as version 3; an older summary's share stays in the overhead. Archive imports get their share when saved (`rptSaveSummaries`).

### Main functions (EmployeeWizard.html, "📊 Reports tab")

| Function | Job |
|---|---|
| `REPORT_METRICS` | Metric vocabulary. **The same keys live in PaperWizard** (`REPORT_METRIC_GROUPS`); keep the two in step. |
| `rptQuestionMap` → `rptAnswers` → `rptRollup` | Tagged questions → answers (in base units) → per-lot values and daily series (plus air VPD) |
| `rptBuildCrop` / `rptCrops` | The crop object; live crops plus closed summaries |
| `rptHours`, `rptDoneTasks`, `rptAgg`, `rptCropCost`, `rptOtherCost`, `rptCapacity` | Hours by work date, completed tasks with estimates, headline numbers, costs at today's wages, roster capacity |
| `rptOtherLabour` / `rptChoreLabour` | Equipment and other events with a `labour_map`; DailyWizard chore hours |
| `rptRoomOccupancy`, `rptApplyChores` | Who was in a room on a day (by plants); room chore hours into those crops' labour |
| `rptOverview` … `rptSetup` | One function per page |
| `RPT_PER`, `rptPerDenom`, `rptPerHours`, `rptYieldOf` | The Per switch: each crop's divisor (plants harvested, canopy sq ft, flower-room lights, grams of flower) and unit labels |
| `rptExploreMeasures`, `RPT_OUTCOMES`, `rptExplorer` | What drives yield? (labour per plant and per task, flower days, density, survival, flower-phase climate and feed, water and nutrient per plant, IPM days). Least-squares line and Pearson r. |
| `rptBoardPack`, `RPT_PRINT_CSS` | The board pack window and its print theme |
| `ctlsLedger`, `ctlsLots`, `ctlsModel`, `rptCtls`, `ctlsPrint`, `ctlsFile` | 📋 CTLS month: a lot's dated plant and weight history, every lot (live and closed), the month's numbers and checks, the page, its print window, Mark as filed |
| `rCard`, `rSvg`, `rT`, `rRect`, `rNice`, `rLin` … | Chart kit |

### PaperWizard additions

- **Question fields:** `metric` (a key in §5) and `metricUnit` (`g` / `kg` / `lb` for weights, `F` / `C` for temperature), both optional, saved with the sheet.
- **Editor:** a **Report metric** drop-down on text, number and select questions, plus **Answered in** for weights and temperature. Changing a question's type clears its tag. PaperWizard itself never reads the tags.
- **Repeating entries:** a 🔁 Repeating question stores one answer per entry in the page's `rows`. `rptAnswers` reads them, dated by the page (event date), so a summed metric adds every entry. An entry marked `void` (deleted after it was on file, kept struck out) is skipped.

---

## 5. Metric vocabulary

| Key | Meaning | Unit stored | Combined |
|---|---|---|---|
| `harvest.wetWeight` | Wet weight, drying room, harvest day | g | sum of all answers |
| `harvest.dryWeight` | Dry weight, whole lot after drying | g | sum |
| `harvest.bigs` / `mids` / `smalls` / `popcorn` | Flower by grade | g | sum |
| `harvest.flowerTotal` | Flower, all grades (used only when no grade is weighed) | g | sum |
| `harvest.trim` | Trim sent to processing | g | sum |
| `harvest.potency` | Total THC % | % | latest |
| `harvest.terpenes` | Total terpenes % | % | latest |
| `harvest.plantsHarvested` | Plants harvested | count | latest |
| `env.temp` | Room temperature | °F | daily average |
| `env.rh`, `env.co2`, `env.par`, `feed.ph`, `feed.ec` | Humidity %, CO₂ ppm, PAR, feed pH and EC | as asked | daily average |
| `env.lightPct` | Light intensity — % the lights are set to (scales the lighting estimate day by day) | % | daily average |
| `feed.nutrient` | Nutrient used (several product questions). Each carries its product (`metricProduct`: a fixed name, or another question's answer that day) for per-product pricing | mL | daily sum, plus a crop total per product |
| `water.total` | Water used | L | daily sum |
| `water.perPlant`, `water.runoff`, `runoff.ec`, `runoff.ph` | Irrigation per plant, runoff volume / EC / pH | as asked | daily average |
| `ipm.pests`, `ipm.disease`, `ipm.herm`, `ipm.issue` | YES/NO flags | — | any YES that day |

Answers are parsed leniently (`"1,250"`, `"12 kg"`, `"24.0"` all read as numbers); blank or unreadable answers are skipped.

---

## 6. Definitions

| Term | Definition |
|---|---|
| **Day 0** | `clone_cut_prep` date |
| **Flower yield** | bigs + mids + smalls + popcorn (or `flowerTotal`) |
| **Total yield** | flower + trim |
| **Plants harvested** | `harvest.plantsHarvested`, else the last grow-log plant count on or before harvest day, else `lot.plantCount` |
| **g / plant** | flower ÷ plants harvested |
| **g / sq ft** | flower ÷ canopy sq ft of the flower room |
| **g / sq ft / year** | g/sq ft × 365 ÷ days the crop held the room (transplant → tank & irrigation clean) |
| **Dry-down** | dry ÷ wet |
| **Flower share of dry** | flower ÷ dry |
| **Estimated hours** | `estStaff × estMinutes × event days ÷ 60` |
| **Actual hours** | every `labour_map` entry, extra days included |
| **Estimate accuracy** | Σ actual ÷ Σ estimated, over completed tasks with both, planned in the period |
| **Suggested estimate** | the recipe's staff × (minutes × median actual/estimate ratio of the last 8 crops), rounded to 5 min. Shown once a task has 3+ crops. Recipes are changed in CropLabourWizard, never here. |
| **Labour cost** | staff hours × roster wage + temp hours × their own wage (its room chore share included), or a closed lot's frozen cost. A crop with any hours lacking a wage is left out of $ figures. |
| **Per (normalized)** | Plant / sq ft / light / gram use the crops **harvested in the period**: every hour (or $) on them ÷ Σ plants harvested, Σ canopy sq ft, Σ flower-room lights or Σ grams of flower. Hours read as minutes per plant or sq ft, hours per light, hours per kg. Total shows hours as logged by work date. |
| **r (What drives yield?)** | Pearson correlation over the period's harvested crops with both values. < 0.2 "no clear link", < 0.4 weak, < 0.6 moderate, else strong. Under 8 crops: "too few to tell". |
| **Labour $/g, direct** | Σ crop cost ÷ Σ flower, for harvested crops in the period |
| **Labour $/g, fully loaded** | direct + (equipment and whole-building chore cost in the period ÷ the same flower) |
| **Room chore** | a DailyWizard chore with a room. Each hour goes to the crops in that room that day (where a crop is: below), split by plants when crops share it, and is part of that crop's **direct** labour (hours, cost, Gantt, hours by task, cost by phase by the phase it was in). On a day the room held no crop it is shared like a whole-building chore (listed under "What's missing"). |
| **Where a crop is** | cloning room Day 0 → planting, veg room → transplant, flower room → end of harvest, dry room → bucking, trim room → ship (the lot's room names; `rptCropRoomDays`). A 🌿 mother lot: cloning room → planting, veg room → transplant, then its destination room (its Mother room) → its end: Retire Mothers, or the day its grow log reaches 0 plants, if sooner (`dates.end`) |
| **Electricity (estimated), per room per day** | lights: lights × watts per light × hours (the room's veg hours, or its bloom hours from the crop's flip) × that day's light % (`env.lightPct`; 100 % when not logged), on days the room holds a crop. Equipment: Σ watts × units × hours a day, every day from install. An empty room's lights are off, a Mother room's too; a Mother room holding a mother lot runs at its veg hours × the light % its grow log records (100 % when not logged). |
| **Electricity to a crop** | a room's kWh goes to the crops in it that day, split by plants: a Mother room holding a mother lot charges that lot. A room with no crop (hall, empty Mother or flower room) is dark and passes its equipment's kWh to the building's crops that day; with none, it's "not charged to any crop". Estimate mode: kWh × $/kWh. Bills mode: each bill spread evenly over its days, each day split across the meter's crops by estimated kWh (by plants when there's no estimate). |
| **Water $** | `water.total` L × water $ per 1,000 L ÷ 1,000 |
| **Fertilizer $** | `feed.nutrient` mL by product × the price-list $ per litre ÷ 1,000. Products match by name, case-insensitive; unlinked or unpriced mL is listed, not guessed. |
| **Supplies $** | the lot's recipe supplies: qty × plants × price, the plants being: none for "per crop" (× 1); the plants started for "per plant at the start"; for "per plant at a task" (`at`, e.g. coco blocks at Transplanting) the lowest count the grow logs recorded on that task's calendar days (`plantLows`, the lowest of each day — a move day holds two entries), else the last count before, else the plants started (noted in "What's missing"); today's count while the task is ahead; 0 when the lot's schedule has no such task (Cutting Clones off for bought clones) (`rptPlantsAtTask`) |
| **Property $** | `buildings.<id>.monthlyPropertyCost` spread evenly over each month's days. Each day's share is split between the building's rooms holding a crop (`rptCropRoomDays`) by **light count** (default) or **plants** (`costs.propertyShare`), then between a room's crops by plants. With lights, a room in use without a light count gets no share (listed under "What's missing"); a day when no room in use has one is shared by plants. A day with no crop in the building is "not charged to any crop". A summary frozen without a property cost works its share out from the buildings when shown. |
| **Cost per clone** (🌿) | a mother lot's costs so far — labour (its tasks and its share of room chores), electricity, water, fertilizer, supplies, property, and its own clones when it was cut from another mother — plus the cutting of the lots cut from it (their Cutting Clones hours at the wages of the people who logged them, temps at their own wage, and their supplies charged at Cutting Clones), ÷ the clones cut from it (the starting counts of its sub-lots, scheduled or not). By part, so each part's $ per clone is known (`rptCloneModel`) |
| **Clones in a crop's cost** | a lot cut on site from a mother lot (its sub-lot) carries clones × the mother's cost per clone in each part, and its own Cutting Clones labour and supplies are taken out (cutting is paid once, inside the clone price). If the clones' labour can't be priced, the crop stays out of labour $ figures. Bought clones (a new lot) keep the price-list price. A crop summary freezes the charge: `costs.clones = { n, mother, parts }` in Main.json, and `cropCosts[lot].cloneLabour` and `.cutLabour` (its cutting at the wages then) in Wages.json (`rptCloneCharge`, `rptCropLabour`, `rptCuttingLabour`). A summary saved before the cutters were kept prices its cutting at the lot's average $ per hour |
| **Cost per clone, the period** | the clones cut in the period, each at its mother lot's all-in cost per clone, averaged by clones |
| **Cost $/g by part** | each part's Σ $ ÷ Σ flower of the harvested crops that have that part (labour = fully loaded) |
| **Cost / g (all in)** | the sum of the parts that can be priced. A crop's own all-in (sparkline, crop-by-crop chart) uses its direct labour, not the overhead. |
| **Cost by phase** | each crop's average $/h × its hours per phase. Phase: cloning / veg by the room rules, then task registry order around `harvest`. |
| **Roster capacity** | per employee: shift hours on their work days, less booked time off (full or partial) and BC civic holidays |
| **Logged vs scheduled** | staff (non-temp) hours logged ÷ capacity, over the period up to today |
| **VPD (air)** | T °C = (°F − 32) × 5/9; SVP = 0.6108 × e^(17.27·T/(T + 237.3)); VPD = SVP × (1 − RH/100) |
| **Room yield slipping** | mean of the last 3 crops < 95 % of the 3 before (6+ crops in the room) |
| **Expected harvest** | plants × mean g/plant of past crops in the same room and strain (else the room, else the facility); range = best and worst of those crops |

**Default target bands** (`RPT_TARGETS`): temperature 70–82 °F, RH 40–65 %, VPD 0.8–1.6 kPa.

---

## 7. Privacy

1. Reports are office only.
2. **No $ figure per person** anywhere. Summaries store hours per person, never wages.
3. $ appears only while Wages.json is open.
4. A $ figure built from **fewer than 3 people** is hidden (`RPT_MIN_PEOPLE`), because cost ÷ hours would reveal a wage.

---

## 8. Chart kit

- **Series colours, in fixed order** (colour-blind safe on `#16213e`): blue, orange, aqua, yellow, magenta, green, violet, red.
  - **Strains:** the three most-grown keep blue, orange and aqua whatever the filters; others are grey "Other".
  - **Flower rooms:** magenta, yellow, violet, green, red, by room id.
  - **Phases:** cloning violet, veg green, flower magenta, harvest & post yellow.
  - **Magnitude** (heat map, grade stack): one blue ramp.
  - Over / under estimate: the existing amber / green, always with ▲ / ▼.
- **Marks:** thin bars with gaps, 2 px lines, solid hairline grids. Projections hatched with a dashed outline (the suite's projection style).
- **Never:** two y-scales on one chart, more than 3 slices in the donut, a number on every point.

---

## CTLS month

The cultivation side of Health Canada's monthly CTLS report (user decision 2026-10-22). It reads only the grow logs, the harvest log and the Lot Manager, and writes only filed months.

- **A lot's history** (`ctlsLedger`, stored as `ctls` on the crop summary, version 4):
  - **Counts:** each day's 🌱 plant count on any daily-weekly sheet (struck-out rows skipped). A move day is on two pages, and the newest page's count is the day's.
  - **Starting count:** `lots.startPlantCount` (set by SitkaTools at creation, and while the lot has no grow log). Older lots use their first logged count plus that day's removals.
  - **Changes:** the reasons on the day (`_removed` by reason, `_removedTo`, `_added`) and the initials of who recorded them. A change in the count with no reason on its day is `unexplained`.
  - **Weights:** `harvest.wetWeight` and `harvest.dryWeight` answers by date, in grams. A weight in a 📌 constant has no date and isn't counted.
- **Every lot** (`ctlsLots`): the DB's lots, plus closed-out lots' summaries that hold `ctls`. A summary saved before the history existed is flagged when its dates touch the month: import its archive again.
- **Plants:**
  - **Opening / closing:** every lot's count at the end of the day before the month / its last day. Before its creation date a lot holds nothing; with no grow log it holds its starting count.
  - **Additions:** new lots = received (`receivedFrom` shown as from), sub-lots = clones cut (produced).
  - **Reductions:** destroyed, culled, sampled (lab), sold / transferred (company), harvested (they become wet weight), other.
  - **Adjustments:** a higher count with a reason (recount), and counts changed with no reason.
  - **Between lots:** a split lot's creation and the parent's "moved" removal, or a "moved in" addition. They're shown greyed and net to 0.
  - Opening + every change = closing, by construction. A difference is an error line.
- **Wet cannabis:** a lot's wet weight counts as hanging from its date until the lot's first dry weight is recorded. Opening + harvested − dried (the wet weight of lots dried this month, with the drying loss) = closing. Wet weight dated after the lot's dry weight is flagged and not counted.
- **Dry flower sent out:** every dry weight recorded in the month, on its date.
- **Checks:**
  - lots in the month with no grow log;
  - days with plants and no grow-log count (days before today);
  - counts changed with no reason;
  - sales with no company;
  - harvested with no wet weight;
  - wet weight after dry;
  - undated weights;
  - closed lots without plant history;
  - the previous month's filing not matching this month's opening (CTLS rejects an opening more than 5 % off the last closing; the difference goes under "Other");
  - this month changed since it was filed.
- **📌 Mark as filed** (once the month is over): `_EmployeeWizard.ctls[YYYY-MM] = { filedAt, plants, wetG, dryG, openingPlants, openingWetG }`, in Main.json. **Remove filing** deletes it.
- **Lots ready to close out:** no plants and nothing hanging today. **💾 Save** stores the lot's crop summary (with its history) even when it has no schedule. SitkaTools' close-out warns when it's missing.

---

## 9. Not built yet

- **Lab results card:** only if potency and terpenes aren't on a controlled form (they can be tagged on any sheet, a lab-results sheet included).
- **Data Health page:** partly covered by Needs attention and the Setup & data tables.
