# Labour & Cost Wizard Reports

Spec for the **📊 Reports** tab, and the guide for hooking up the harvest log. Every chart is hand-rolled SVG in the Labour & Cost Wizard's code (`SitkaTools/SitkaTools.html`, `═══ TOOL EmployeeWizard`): no chart libraries, no network calls, no new browser storage.

**Demo DB:** `node examples/make-tens-db.js [out.json] [--today=YYYY-MM-DD]` builds `examples/Tens-DB-YY-MM-DD.json`, a facility of round numbers with crops, labour, grow and harvest logs, chore and equipment hours and the cost inputs, dated relative to today, and an answer key (`…-answer-key.md`) worked out on its own to check the Reports against. Load it with SitkaTools' 📂 Load DB; rerun it on the day of a demo. It is git-ignored.

**Checking a change:** run every page against an empty DB, the sample DB (`local/Current.json`) and the demo DB, also with no wages and with building and strain filters. `tests/cost-per-gram.test.mjs` checks a hand-worked cost per gram.

---

## 1. What's built

Reports is the last tab and office only (building devices don't get it). The **Labour Report — estimated vs. actual** table stays below the Employees, Tasks and Reports tabs.

- **Filter row:**
  - **Period:** last 3, 6, 12, 24 or 36 months, or year to date. Every tile compares against the **previous period of the same length**.
  - **Building, Flower room, Strain.**
  - **Per:** plant (default), sq ft of canopy, light, gram of flower, or total. It changes hours by task, labour $ by phase, the strain scorecard, the weight cascade and the room trend; every other card says it isn't affected. Per gram shows hours per kg (per gram is too small to read). Per light uses the flower room's `rooms.<id>.lightCount`.
- **🖨️ Board pack:** the seven report pages with the current filters in a print-ready window — light theme, Letter landscape, one page per sheet, a tick box per page, an optional **Data tables** toggle. **Print / Save as PDF** uses the browser's dialog. Same numbers and privacy rules.
- **Every card:** its title is the question it answers; a chip says what data it needs; **⊞ Table** shows the same numbers as a table; hover any mark for details; with no data it says exactly what's missing and where to add it.

| Page | Cards | Needs |
|---|---|---|
| **Overview** | 8 KPI tiles (sparkline + change vs previous period): flower yield, g/plant, g/sq ft/year, potency, terpenes, **cost / g (all in)** with its six-part breakdown, labour hours, estimate accuracy. **Needs attention**, each line linking to its page: tasks over estimate, slipping rooms, weeks short of staff, idle flower rooms, past-due tasks, completed tasks with no hours, shipped lots with no weights or no summary, costs left out of the cost per gram. | mixed |
| **Crop Timeline** | **Crop labour Gantt** (one lot): tasks banded by phase, planned outline vs hours logged per day, ✓ done / ⚠ past due, estimate vs actual, a daily hours strip. **Room schedule Gantt**: every lot's stay in each room, 4 months back to 8 ahead, by the same stays the costs use ("Where a crop is", so a room change its grow log recorded shows; a closed-out lot shows only its flower or mother stay; review C12); TBA lots hatched (transplant → the harvest's last day); idle flower-room days amber (a flower room is busy until the crop's Tank & Irrigation Clean); BC holidays and today marked, % in use per flower room. | data exists today |
| **Labour** | **Where do the hours go?** (Pareto by task, estimate outlined). **Which tasks run over their estimate?** (dot per crop, median) + **suggested estimates** at 3+ crops. **What kind of work fills the period?** (crop / chores / equipment, temps' share, logged vs scheduled). **Labour $ per gram by phase** (waterfall). | today; $/g needs harvest numbers + Wages.json |
| **💲 Costs** | Always per gram of flower. **What does a gram of flower cost?** (this vs previous period, stacked by the six parts, with what shared labour and idle building days add). **🏢 What does a gram cost in each building?** (each building's crops shipped in the period and its shared costs, plus all buildings; they add up). **🏢 What does each building cost to run?** (every $ spent in each building by part, the nursery included, and by calendar month — only the period's own days, so a month the period starts partway through counts from that day). **🌱 Nursery and flowering: where was each lot's money spent?** (per gram: in the building it ships from, in other buildings — its nursery days — and its clones). **🌿 What does a clone cost?** (broken down like the gram: the clones cut in the period, this vs previous period, stacked by the six parts, with the bloom lots' own cutting per clone beside it). **Cost per clone, mother lot by mother lot** (each one so far, stacked by part). **Cost per gram, crop by crop.** **How much electricity does a crop use?** (kWh: lights vs equipment & shared rooms). **What did the crops use?** (fertilizer by product, supplies — "Coco block · at 🪴 Transplanting…" when charged at a task — water, electricity, property crop-days, with $). **What's missing from the cost?** (no rate, rooms without watts, equipment without power, light % not logged, unpriced or unlinked fertilizer, recipes without supplies, supplies charged at a task with no plant count on or before it (counted from the start), bills not charged to any crop, crops with days no bill covers, closed-out lots frozen before a bill changed, shared labour hours with no wage, buildings without a property cost, property cost on days with no crop in the building, lots cut from a mother lot with no cost per clone yet, mother lots with no Mother room or dates). | harvest numbers, Room Manager, EquipmentWizard power, grow-log tags, price list, ⚡ Power & Rates |
| **Yield & Quality** | **Strain scorecard**: yield (Per switch) vs potency → Keep / Potency play / Volume play / Review. **Potency & terpenes by strain** (strip plots). **Weight cascade**: wet → dry → stems & waste → total yield → trim → flower (stacked by grade). **Is any room slipping?** (Per switch). **What drives yield?** Any per-crop measure vs an outcome: dot per harvested crop, fitted line, r and n. | harvest numbers (+ grow-log tags for climate measures) |
| **Rooms & Environment** | **Climate for one lot**: temperature, RH, VPD vs target bands, IPM flag days marked. **Pest heat map**: rooms × last 16 weeks (days flagged), plus a hermaphrodite marker. | grow-log tags |
| **Forecast** | **Do we have enough people?** Estimated hours for the next 12 weeks (scheduled and projected crops, daily chores — a room chore only on days its room is planned to hold a crop, as DailyWizard lists it) vs roster capacity. **What will we harvest in the next 6 months?** Expected flower per harvest, best/worst range from past crops. | today; harvest forecast needs harvest numbers |
| **📋 CTLS month** | The month's cultivation numbers for Health Canada's monthly CTLS report, for the whole facility (no filters; see "CTLS month" below): a month picker (last month by default, 36 months back), five tiles, **Checks** (what could make the numbers wrong), **🌱 Plants** (every dated change with what happened, +/−, to / from whom and the initials, then the totals by reason from the opening to the closing count), **plants on hand at month end by lot** (room, phase, total; by phase), **💧 wet cannabis hanging to dry**, **🗄️ dried cannabis on hand**, **📦 shipped out — flower and trim** (on the Weigh & Ship day), and **lots ready to close out** (save their plant history first). **🖨️ Print** and **📌 Mark as filed**. | grow logs with 🌱 plant counts, harvest-log weights tagged |
| **⚙️ Setup & data** | Canopy sq ft, lights and watts per light per flower room (read-only, from Room Manager). Shift length. **Crop summaries** (save / update / remove, 📂 Import archived lots). **Report metrics**: which question feeds each metric, and its answer count. | — |

---

## 2. Decisions

1. Reports may **read every tool's data**, read-only. They write only `_EmployeeWizard.crops`, `.settings`, `.cropCosts` (§4), `.ctls` (filed CTLS months) and `.overheadCosts` (overhead frozen by month).
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
| 👥 Temp crews (`employees[name].crew`) and an entry's `crewSize` | a crew's entry holds person-hours (each person's time × the crew size, user decision 2026-10-28), costed at the crew's wage, its rate per person, like any roster employee; a crew has no shifts in capacity |
| Hours shown for a closing time not filed yet (`_pending`, from `_EmployeeWizard.closings`) | counted like any hours entry while they wait for their building's device (root `CLAUDE.md` → "Split Database") |
| `_PaperWizard.wizards[*].questions[*].metric` / `metricUnit` + `_PaperWizard.entries` | harvest numbers, grow-log series, plant counts (🌱 plant-count questions need no tag) |
| `_DailyWizard.buildings[*].tasks` (minutes × staff, recurrence) | chore hours in the demand forecast |
| `_DailyWizard.buildings[*].labour` | chore hours in the labour mix, labour hours, logged vs scheduled, the chores share of $ per gram. Entries the office removed are gone from it (kept only in `.adjustments`). |
| `_DailyWizard.buildings[*].tasks[].roomId` | 🚪 room chores: their hours go to the crops in that room that day (`rptApplyChores`) |
| `rooms.<id>` (Room Manager): canopy sq ft, `lightCount`, watts per light, veg / bloom light hours | Per sq ft / Per light (`lightCount` is saved on each summary), the electricity estimate |
| `buildings.<id>.monthlyPropertyCost` | rent and property fees, shared by room lights (default), floor area or plants (`costs.propertyShare`) |
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
            byBuilding: { "<building>": { "YYYY-MM-DD": { people: { "<employee>": h }, tempCost, tempNoWage } } },   // where and when the hours were worked: priced at each day's wage (cost audit 2026-10-26)
            byTask: { <taskType>: { date, est, act, temp, n, done, estStaff, estMinutes, roomId, days: { "YYYY-MM-DD": h },
                                    people?, tempCost?, tempNoWage? } },   // Cutting Clones only: hours by person, temps' $ (prices the cutting shown beside the clone price)
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
    power: { kWh, lights, equip, cost, source: 'bills' | 'estimate', pctMissingDays, unbilledDays? },   // cost null while days had no bill
    water: { L, cost }, fert: { byProduct: { "<product>": { mL, cost } }, unpriced: [], cost },
    supplies: { items: [{ name, unit, qty, cost, at?: { task, label, plants, how, date } }], unpriced: [], cost },   // at: charged per plant at a task
    property: { days, cost },                                       // days: crop-days in a building with a property cost
    spend: { "<building>|YYYY-MM": { power, water, fert, supplies, property } }, savedAt   // where it was spent (labour: by its hours)
  }
}
```

- **Retention:** every save drops summaries (and their frozen costs) whose harvest date, or save date, is over **36 months** old.
- **Frozen labour cost:** `_EmployeeWizard.cropCosts[lotId] = { cost, missingHours, savedAt }`, written by Save summary only while wages are open. SitkaTools' `DbSplit.split` puts it in Wages.json, and `DbSplit.merge` reads it back only when Wages.json is opened. A crop with `missingHours > 0` (someone had no wage) stays out of $ figures. It counts only while its `savedAt` matches the summary's (`rptFrozenLabour`): a summary saved again without Wages.json has newer hours, so the older cost is ignored (review C11) — a live lot then uses its hours priced by date, a closed-out lot has no labour figure (🔒, below).
- **Frozen non-labour costs:** `costs`, written by Save summary and archive import, stays in Main.json with the summary, so a closed-out lot keeps it when rates, prices or bills change. Crops saved together are modelled together (they share rooms and bills).
- **Close-out:** SitkaTools' close-out doesn't touch `_EmployeeWizard`, so summaries stay after a lot is archived.
- **🔒 Locked at close-out** (user decision 2026-10-26): SitkaTools closes a lot out only once its summary was saved as the lot is now (`sourceHash` = `lotFingerprint`, kept by `rptSaveSummaries`), its labour cost frozen with every hour priced and, with bills, no day without a bill — Setup & data says "🔒 ready for close-out" and the 📋 CTLS page's "Lots ready to close out" names what's missing (`rptCloseOutCostGap`). After close-out the lot is never re-priced: its frozen costs only, a part it froze without (no `costs.property`, no frozen labour) stays missing (`rptCropInputCostNow`, `rptCropCost`), its summary has no remove button (it leaves after 36 months), and 📂 Import archived lots keeps its costs and updates only its plant history (`ctls`); a lot closed without a summary is imported whole.
- **Up to date?** Setup & data marks a summary "out of date" when the live numbers differ. Frozen `costs` don't count (they move with rates and bills); summaries older than version 3 are always out of date.
- **Room chores** (`rptApplyChores`, run once per model): every chore entry whose chore has a room is split between the crops in that room that day (`rptRoomOccupancy`: `rptCropRoomDays` stays, by their plants that day) and added to each live crop's `labour`. The row keeps only what no crop carries, so it isn't spread again as overhead. A closed-out crop's share is in its summary when it was saved as version 3 — for the entries it lists in `labour.choreEntries` (each entry's id; review C6): hours that synced in after it was saved, or a chore tied to a room later, stay in the overhead. A summary saved before the list existed is taken to carry them all; an older summary's share stays in the overhead. Archive imports get their share when saved (`rptSaveSummaries`).

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
| **g / sq ft / year** | g/sq ft × 365 ÷ days the crop held a flower room: its flower stays ("Where a crop is", the grow log's rooms first), plus the days after the last one until Tank & Irrigation Clean (review C12) |
| **Dry-down** | dry ÷ wet |
| **Flower share of dry** | flower ÷ dry |
| **Estimated hours** | `estStaff × estMinutes × event days ÷ 60` |
| **Actual hours** | every `labour_map` entry, extra days included |
| **Estimate accuracy** | Σ actual ÷ Σ estimated, over completed tasks with both, planned in the period |
| **Suggested estimate** | the recipe's staff × (minutes × median actual/estimate ratio of the last 8 crops), rounded to 5 min. Shown once a task has 3+ crops. Recipes are changed in CropLabourWizard, never here. |
| **Labour cost** | staff hours × roster wage + temp hours × their own wage (its room chore share included), or a closed lot's frozen cost. A crop with any hours lacking a wage is left out of $ figures, and "What's missing" and "Needs attention" name it with who and how many hours (`rptLabourGaps`; cost audit 2026-10-26). |
| **Per (normalized)** | Plant / sq ft / light / gram use the crops **harvested in the period**: every hour (or $) on them ÷ Σ plants harvested, Σ canopy sq ft, Σ flower-room lights or Σ grams of flower. Hours read as minutes per plant or sq ft, hours per light, hours per kg. Total shows hours as logged by work date. |
| **r (What drives yield?)** | Pearson correlation over the period's harvested crops with both values. < 0.2 "no clear link", < 0.4 weak, < 0.6 moderate, else strong. Under 8 crops: "too few to tell". |
| **Labour $/g, direct** | Σ crop cost ÷ Σ flower, for the crops **shipped** in the period (below) whose hours all have a wage |
| **Labour $/g, fully loaded** | direct + the crops' share of **shared labour** (whole-building chores, 🧰 Miscellaneous, equipment and other tasks, room chores on a day their room held no crop), spread over the grams shipped in the period: each building's shared labour over the grams that building shipped; labour tied to no building, and a building that shipped nothing in the period (a nursery), over every gram shipped (`rptSharedRates`; user decision 2026-10-26). So the buildings add up to the org, and a filtered view (a building, a flower room, a strain) carries its building's share per gram. Shared hours with no wage cost nothing and are listed under "What's missing". A finished month's shared labour is its frozen figure (`overheadCosts`); days not frozen are priced at today's wages |
| **Room chore** | a DailyWizard chore with a room. Each hour goes to the crops in that room that day (where a crop is: below), split by their plants that day when crops share it, and is part of that crop's **direct** labour (hours, cost, Gantt, hours by task, cost by phase by the phase it was in). On a day the room held no crop it is shared like a whole-building chore (listed under "What's missing"). |
| **Plants that day** | the grow log's count that day (`rptPlantsOn`); before the lot's first count, the count it started with; after its plants reach 0 (dry and trim rooms), the last count it had. A lot with no grow log: its starting count every day. Used to share rooms, their chores and the building's property |
| **Where a crop is** | **Every lot in the DB**, scheduled or not (cost audit 2026-10-26: a lot with no CropLabourWizard schedule takes its share of its rooms too, but has no harvest, so its costs reach no gram; "What's missing" names it). **The grow log first** (user decision 2026-10-23): from its first logged day until its plants reach 0, the room and phase it recorded each day (the page's room). A log that hasn't recorded 0 plants carries its last room on to today while the lot is still growing; once its scheduled harvest (a mother lot: its retire day) is past, it ends at its last logged day, or at that scheduled day if the log stops before it (`rptOpenLogEnd`; "Needs attention" names the lot); before that, the schedule; after the plants reach 0, only the planned dry and trim rooms. A lot with no grow log follows its schedule: cloning room Day 0 → planting, veg room → transplant, flower room → end of harvest, dry room → bucking, trim room → ship (the lot's room names; `rptCropRoomDays`). A 🌿 mother lot: cloning room → planting, veg room → transplant, then its destination room (its Mother room) → its end: Retire Mothers, or the day its grow log reaches 0 plants, if sooner (`dates.end`). A lot with no schedule and no grow log: its current room, from its created day to today (`rptCurrentRoomStay`) |
| **Electricity (estimated), per room per day** | lights: lights × watts per light × hours (the room's veg hours, or its bloom hours from the crop's flip) × that day's light % (`env.lightPct`; 100 % when not logged), on days the room holds a growing crop: a lot drying or trimming doesn't light it (cost audit 2026-10-26), so only the growing lots share the lights. A lot growing in a room with lights but no watts per light (or a flowering room with no lights set) has no electricity figure (`noWattsDays`). Equipment: Σ watts × units × hours a day, every day from install. An empty room's lights are off, a Mother room's too; a Mother room holding a mother lot runs at its veg hours × the light % its grow log records (100 % when not logged). |
| **Electricity to a crop** | a room's kWh goes to the crops in it that day, split by their plants that day (`rptPlantsOn`): a Mother room holding a mother lot charges that lot. A room with no crop (hall, empty Mother or flower room) is dark and passes its equipment's kWh to the building's crops that day; with none, it's "not charged to any crop". Estimate mode: kWh × $/kWh. Bills mode (user decision 2026-10-26): each bill is shared by kWh over all its days, not day by day — its $ per kWh = the bill ÷ the kWh estimated on its meter (a building, or the whole site) over its days, its lots' and its empty rooms' alike, and each lot pays its own kWh that day × that, where it used them. A quiet day (a lot drying alone, the grow rooms dark) carries only what it used; empty rooms' kWh in a building with no lot go to its idle days. A bill running past today charges the days so far their share of its days. With no kWh estimated on its meter over the whole bill (no watts set), each day's even share is split by plants (none: idle). A crop with a day in a building no bill covers (its building's meter or the whole site) has its electricity **missing**, not the $ of its billed days (`unbilledDays`, review C2), until that bill is added; a summary frozen that way keeps `unbilledDays` and takes the bills as they are now. Bloom hours: the grow log says Bloom that day, or (planned days) the crop has flipped. |
| **Water $** | `water.total` L × water $ per 1,000 L ÷ 1,000 |
| **Fertilizer $** | `feed.nutrient` mL by product × the price-list $ per litre ÷ 1,000. Products match by name, case-insensitive. One product with no price, or mL not linked to a product, leaves the lot's fertilizer out of the cost per gram until it's priced (partial = missing, below); it's listed, never guessed. |
| **Supplies $** | the lot's recipe supplies: qty × plants × price, the plants being: none for "per crop" (× 1); the lot's starting count (Lot Manager, `rptStartPlants` — not the first grow-log count, which may come after culls) for "per plant at the start"; for "per plant at a task" (`at`, e.g. coco blocks at Transplanting) the lowest count the grow logs recorded on that task's calendar days (`plantLows`, the lowest of each day — a move day holds two entries), else the last count before, else the plants started (noted in "What's missing"); today's count while the task is ahead; 0 when the lot's schedule has no such task (Cutting Clones off for bought clones) (`rptPlantsAtTask`). One supply with no price leaves the lot's supplies out (partial = missing) |
| **Property $** | `buildings.<id>.monthlyPropertyCost` (set: $0 is a figure, for a building with no rent; not set: the lot's days in that building leave its property out, `noRentDays`) spread evenly over each month's days. Each day's share is split between the building's rooms holding a crop (`rptCropRoomDays`) by **light count** (default, user decision 2026-10-26 evening: only the rooms with a lot growing, and only their growing lots — a lot drying or trimming pays no rent, since the dry room is timed to be free for the flower rooms it serves; a day with only lots drying or trimming in the building is an idle day), **floor area** (`rooms.<id>.floorSqFt`, SitkaTools' Room Manager; a day when a room in use has none is split by lights) or **plants** (every lot in the building by its plants that day, the lot in the dry/trim room included) (`costs.propertyShare`), then between a room's lots by their plants that day (evenly when none has a count). With lights, a room with a growing lot but no light count gets no share (listed under "What's missing"); a day when no such room has one is shared by plants. A day with no crop in the building is an idle day: spread over the period's grams (above). A summary frozen without a property cost works its share out from the buildings when shown. |
| **Cost per clone** (🌿) | growing the mothers: a mother lot's costs so far — labour (its tasks and its share of room chores), electricity, water, fertilizer, supplies, property, and its own clones when it was cut from another mother — ÷ the clones cut from it (the starting counts of its sub-lots, scheduled or not). By part (`rptCloneModel`). No overhead and no cutting in it |
| **Clones in a crop's cost** | a lot cut on site from a mother lot (its sub-lot) carries clones × the mother's cost per clone in each part. Its own cutting (its Cutting Clones hours and the supplies charged at Cutting Clones) stays in its own costs: each bloom lot pays its own cutting (user decision 2026-10-23). If the clones' labour can't be priced, the crop stays out of labour $ figures. A part the lot can't price itself, or its clones can't be priced in, is missing for the lot (partial = missing). Bought clones (a new lot) keep the price-list price. A crop summary freezes the charge: `costs.clones = { n, mother, parts }` in Main.json and `cropCosts[lot].cloneLabour` in Wages.json (`rptCloneCharge`, `rptCropLabour`). The mother keeps costing while it lives, so the lots not frozen yet carry what's left — the mother's cost less the frozen charges — over the clones not charged yet, and the charges add up to what the mother cost (review C8; a part a frozen lot has no figure for stays at the average) |
| **Cost per clone, the period** | the clones cut in the period, each part over the clones its mother lot can price it for (as the gram's parts are over the crops that have them), averaged by clones; all in = the sum |
| **Cutting per clone** (shown, not charged) | the lots cut in the period: their Cutting Clones hours at the wages of the people who logged them (temps at their own wage) + their supplies charged at Cutting Clones, ÷ their clones (`rptCuttingCost`). A summary saved before the cutters were kept uses the lot's average $ per hour |
| **Cost $/g by part** | each part's Σ $ ÷ Σ flower of the crops shipped in the period that have that part (labour = fully loaded). Electricity and property also carry the period's **idle building days** — rent and power on days a building held no crop (its equipment's estimated kWh, or a bill no crop carries, bills from before the first crop included) — spread over the grams shipped like shared labour (user decision 2026-10-26) |
| **Ship day** | the day a crop's costs count (user decision 2026-10-26): its ✅ Weigh & Ship task signed off done (the day the floor manager signed for; `dates.shipped`), with all its grams. Weighed but not signed off: not counted yet ("Needs attention" says so). A schedule with no Weigh & Ship task: its harvest day (the first wet weight, else the scheduled harvest). A summary saved before the ship day was kept: its scheduled ship day. Yield, quality and labour-hour pages stay on the harvest date |
| **A crop's building** | the building of the room it flowered in last (the grow log's rooms first), else its planned flower room's: the building it ships from. A lot cut or grown in the nursery and moved counts there, with all its costs (`rptCropBuilding`) |
| **Spend by building** | every $ spent in a building, by part and calendar month (`rptFacilitySpend`; a period's own days, `rptFacilitySpendIn`: user decision 2026-10-26): each lot's own costs where they were spent — labour where its hours were worked (a crop task's room, a room chore's room; at today's wages, a closed-out lot's frozen cost shared out by its hours), electricity and property its share of each room day by day, water and fertilizer where its grow log had it that day, supplies at their task's building or where it started — plus each building's shared labour and idle days. Clones aren't spend there: the mother lots' costs already are. So a building's electricity is every kWh it used. **A period counts only its own days:** what's known by the day (open lots' costs, every lot's labour, shared labour, idle days) on its day; a closed-out lot's locked costs are month totals, so a month the period starts partway through takes the share of the lot's days in that building that month inside the period (`rptMonthShare`) |
| **Nursery and flowering split** | a lot's own costs by the building they were spent in (`rptCropSpendByBuilding`): the building it ships from, other buildings (its nursery days), and its clones (the mother lot's cost per clone). Its own costs only; shared labour and idle days stay with the building figures |
| **Partial = missing** | user decision 2026-10-26: a lot's part counts only when all of it can be priced — every fertilizer product, every supply, every room it grew in with watts per light, every building it was in with a property cost, and its clones in that part (a mother lot with no figure for a part leaves its clones' lots without it too). Otherwise the part is missing for that lot (it leaves that part's average) and "What's missing" says why; it is never counted low |
| **Price by date** | user decision 2026-10-26: every cost at the figure in force on its day (`figureOnDay`): an hour at the wage of the day it was worked (`wageOn`, from `_EmployeeWizard.wageHistory`, a crop's hours by building and day in `labour.byBuilding`), estimated kWh at each day's $/kWh, water at the day's rate, fertilizer mL at the product's price that day (mL with no day at today's), a supply at its price on its task's day (else the lot's Day 0), each day's rent. A history is `[{ from: '' (from the start) \| 'YYYY-MM-DD', <figure> }]`; a day takes the latest entry on or before it (before the first dated one, the earliest). With no history, the figure set. A change asks **Applies from** (today by default, never later). Bills are dated already |
| **🔍 Cost ledger** | a lot's own costs line by line, one per day and part (labour, electricity, water, fertilizer, supplies, property) plus a line per part for its clones, each with the arithmetic that gave it (`rptLedger`): the cost code writes a line for the traced lot at the moment it gives it its share, so the lines add up to the lot's figures on the 💲 Costs page, clones included (checked on the page: "✓ adds up"). Labour lines name each person, their hours and their wage that day. A finished lot's ledger is kept with its summary (`costs.ledger` in Main.json without labour lines; `cropCosts[lot].ledger` in Wages.json with them) and goes into its archive at close-out. **🧾 Every dollar accounted for**: each bill = what its lots carry + its idle days; each building's month of rent = its lots + its idle days (`billSplit`, `rentSplit`). A part that's missing for the lot shows its priced days' lines and says why. Closed-out lots show their frozen totals |
| **Cost / g (all in)** | the sum of the parts that can be priced. A crop's own all-in on the crop-by-crop chart is its own costs per gram plus its building's shared rates for the period; the tile's sparkline is each crop's own costs only. |
| **Cost by phase** | each crop's average $/h × its hours per phase. Phase: cloning / veg by the room rules, then task registry order around `harvest`. A lot cut from a mother lot shows its clones' share of the mothers' labour as its own step ("Mothers (the clones)"), so the total matches the Costs page's labour. |
| **Roster capacity** | per employee: shift hours on their work days, less booked time off (full or partial) and BC civic holidays |
| **Logged vs scheduled** | staff (non-temp) hours logged ÷ capacity, over the period up to today |
| **VPD (air)** | T °C = (°F − 32) × 5/9; SVP = 0.6108 × e^(17.27·T/(T + 237.3)); VPD = SVP × (1 − RH/100) |
| **Room yield slipping** | mean of the last 3 crops < 95 % of the 3 before (6+ crops in the room) |
| **Expected harvest** | plants × mean g/plant of past crops in the same room and strain (else the room, else the facility); range = best and worst of those crops |

**Default target bands** (`RPT_TARGETS`): temperature 70–82 °F, RH 40–65 %, VPD 0.8–1.6 kPa.

---

## 7. Privacy

1. Reports are office only, and so is every $ figure in the tool (user decision 2026-10-25, review Q6: this replaced the rule hiding $ built from fewer than 3 people).
2. **No $ figure per person** anywhere. Summaries store hours per person, never wages.
3. Labour $ appears only while Wages.json is open.

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
- **Wet cannabis:** a lot's wet weight counts as hanging from its date until the lot's first dry weight is recorded. Opening + harvested − dried (the wet weight of lots dried this month, with the drying loss) = closing. Wet weight dated after the lot's dry weight (in the same month too) is flagged and not counted in, out or hanging.
- **Dried cannabis on hand** (user decision 2026-10-26): a lot's dry weight is on hand from the day it's recorded until the lot ships (`ctlsDried`). Opening + dried (dry weights recorded in the month) − shipped out − stems & waste = closing.
- **Shipped out — flower and trim:** a lot ships on the day its ✅ Weigh & Ship is signed off done (`completedBy.day`; its history keeps `ship: { day, how: 'signed' }` and `out: { flower, trim }`, version 2). What goes out is its weigh-out: flower (bigs + mids + smalls + popcorn, or `harvest.flowerTotal`) + trim; the rest of its dry weight is stems & waste. No weigh-out recorded: its dry weight is counted (a check says so). Weighed out but not signed off: still on hand (a note says so). A lot whose schedule has no Weigh & Ship task (or no schedule), or a history saved before ships were kept, ships each dry weight on the day it's recorded, as before (`how: 'dry'`). A dry weight recorded after the lot shipped isn't counted (a check says so).
- **Checks:**
  - lots in the month with no grow log;
  - days with plants and no grow-log count (days before today);
  - counts changed with no reason;
  - sales with no company;
  - harvested with no wet weight;
  - wet weight after dry;
  - undated weights;
  - closed lots without plant history;
  - closed-out lots whose saved history still holds plants or wet weight after it was saved (saved before the lot ended, so counted in every month since; review C3): import the archive again;
  - lots closed out with split files (SitkaTools' `_closedLots` notice) that have no summary at all, in the months up to their close-out;
  - the previous month's filing not matching this month's opening (CTLS rejects an opening more than 5 % off the last closing; the difference goes under "Other");
  - this month changed since it was filed.
- **📌 Mark as filed** (once the month is over): `_EmployeeWizard.ctls[YYYY-MM] = { filedAt, plants, wetG, dryG, openingPlants, openingWetG }`, in Main.json. **Remove filing** deletes it. Filed from 2026-10-26 on (`rule: 2`) it also keeps `driedG`, `shippedG` and `openingDriedG`, and next month's opening is checked for dried cannabis too; a month filed before that keeps `dryG` and is compared with the old rule (dry weights recorded in it).
- **Lots ready to close out:** no plants and nothing hanging today. **💾 Save** stores the lot's crop summary (with its history) even when it has no schedule. SitkaTools' close-out warns when it's missing.

---

## Overhead frozen by month

User decision 2026-10-23. Shared labour (overhead) — whole-building chores, equipment and other events' hours, room chores on a day their room held no lot — is priced at the wages of the day, so a raise would change a past period's fully loaded labour.

- **Frozen automatically:** the first time the office opens the Reports with wages after a month ends, that month's overhead is frozen (`rptFreezeOverhead`; on the office's own redraw, never inside a live update, which a tool never answers; review C13): `_EmployeeWizard.overheadCosts[YYYY-MM] = { frozenAt, rows: [[day, buildingId, roomId, kind, hours, $, hours with no wage]] }`, day by day, building and room, so the filters and part-month periods still work. A toast says so; Save DB keeps it. A frozen room chore's hours that a crop carries now (its grow log, filled in late, puts it in the room that day) aren't counted again: the frozen $ keeps its rate for only the hours still shared (review C7).
- **Kept in Wages.json** (money), beside `cropCosts`. SitkaTools splits, merges and adds it like them (`WAGES_MONEY_KEYS`).
- **Used:** `rptOtherCost` takes a frozen month's rows, and prices only days not frozen at today's wages.
- **Compared:** the live figure is still worked out (`rptOverheadCompare`). ⚙️ Setup & data → **🔒 Overhead frozen by month** lists each month, frozen hours and $ against now; a changed month is marked, and the Costs page's "What's missing" names it. **Use today's numbers** re-freezes it and keeps the earlier copy in `history`.
- Building devices and sessions without wages never freeze.

---

## 9. Not built yet

- **Lab results card:** only if potency and terpenes aren't on a controlled form (they can be tagged on any sheet, a lab-results sheet included).
- **Data Health page:** partly covered by Needs attention and the Setup & data tables.
