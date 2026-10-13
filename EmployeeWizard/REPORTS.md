# EmployeeWizard Reports

_Built 2026-10-12 on branch `reports` (not merged into `Development`). This is both the spec and the guide for hooking up the harvest log._

EmployeeWizard's **📊 Reports** tab holds the labour, yield, quality, room and forecast reports a director or CEO wants. Every chart is drawn with hand-rolled SVG inside `EmployeeWizard.html`. There are no chart libraries, no network calls and no new browser storage.

**Mock-up** (made before the build; it shows the same charts with invented numbers): https://claude.ai/artifact/T6BTSHTmh641GbKdBkzMwN

---

## 1. What's built

Reports is the third tab (**Employees · Tasks · 📊 Reports**). It's office only: building devices don't get the tab. The existing **Labour Report — estimated vs. actual** table stays below all three tabs, unchanged.

- **Filter row:**
  - **Period:** last 3, 6, 12, 24 or 36 months, or year to date.
  - **Building, Flower room, Strain.**
  - Every tile compares against the **previous period of the same length**.
  - **Per:** plant (default), sq ft of canopy, gram of flower, or total. It changes hours by task, labour $ by phase, the strain scorecard, the weight cascade and the room trend. Every other card says it isn't affected. Per gram shows hours per kg, because hours per gram are too small to read.
- **⤢ Expand:** grows the popup to the full screen. Cards then lay out two to a row.
- **🖨️ Board pack:** opens the six report pages, with the current filters, in a print-ready window:
  - light theme, Letter landscape, one report page per sheet;
  - a tick box per page, and an optional **Data tables** toggle;
  - **Print / Save as PDF** uses the browser's own dialog. The same numbers and privacy rules apply.
- **Every card:**
  - The title is the question the card answers.
  - A chip says what data the card needs.
  - **⊞ Table** shows the same numbers as a table.
  - Hover any mark for details.
  - With no data, the card says exactly what's missing and where to add it.

| Page | Cards | Needs |
|---|---|---|
| **Overview** | 8 KPI tiles, each with a sparkline and a change vs the previous period: flower yield, g/plant, g/sq ft/year, potency, terpenes, labour $/g, labour hours, estimate accuracy. Then **Needs attention**: tasks running over estimate, rooms whose yield is slipping, weeks short of staff, idle flower rooms, past-due tasks, completed tasks with no hours, shipped lots with no weights or no saved summary. Each line jumps to its page. | mixed |
| **Crop Timeline** | **Crop labour Gantt** for one lot: tasks banded by phase, planned outline against hours logged per day, ✓ done / ⚠ past due, estimate vs actual per task, and a strip of hours per day. **Room schedule Gantt**: every lot's stay in each room, 4 months back to 8 months ahead. Projected TBA lots are hatched; idle flower-room days are amber; BC holidays and today are marked; % in use per flower room. | data exists today |
| **Labour** | **Where do the hours go?** (Pareto by task, with the estimate as an outline). **Which tasks run over their estimate?** (one dot per crop, the median marked) plus **suggested estimates** once a task has 3+ crops. **What kind of work fills the period?** (crop / chores / equipment, temps' share, logged vs scheduled shift hours). **Labour $ per gram by phase** (waterfall). | today; $/g needs harvest numbers + Wages.json |
| **Yield & Quality** | **Strain scorecard**: yield (per the Per switch) against potency, split into Keep / Potency play / Volume play / Review. **Potency & terpenes by strain** (strip plots). **Weight cascade**: wet → dry → stems & waste → total yield → trim → flower, with flower stacked by grade. **Is any room slipping?** (per the Per switch; per sq ft needs canopy area). **What drives yield?** Pick any per-crop measure against an outcome; one dot per harvested crop, a fitted line, r and n, and "too few crops to tell" below 8. | harvest numbers (+ grow-log tags for the climate measures) |
| **Rooms & Environment** | **Climate for one lot**: temperature, RH and VPD against target bands, with IPM flag days marked. **Pest heat map**: rooms × last 16 weeks, days flagged, plus a hermaphrodite marker. | grow-log tags |
| **Forecast** | **Do we have enough people?** Estimated hours for the next 12 weeks (scheduled crops, projected crops, daily chores) against roster capacity. **What will we harvest in the next 6 months?** Expected flower per harvest with a best/worst range from past crops. | today; harvest forecast needs harvest numbers |
| **⚙️ Setup & data** | Canopy sq ft per flower room. Shift length. **Crop summaries** (save / update / remove, 📂 Import archived lots). **Report metrics** table: which paperwork question feeds each metric, and how many answers it holds. | — |

Tested on 2026-10-12, before any harvest log existed. Every page was run against an empty DB, the sample DB (`PaperWizard/Current.json`, as-is) and a generated DB with hours, estimates, tagged grow logs, a tagged harvest sheet and closed-lot summaries. It was also run with no wages and with building and strain filters. All pages render with no errors. On the sample DB as-is, the yield and climate cards show their "needs tags" states and the Gantts draw from the real schedule.

---

## 2. Decisions (user, 2026-10-12)

1. **Reports may read every tool's data**, read-only. They write only `_EmployeeWizard.crops` and `_EmployeeWizard.settings`.
2. **Metric tags** are a drop-down on PaperWizard questions, so the harvest sheet can be configured next week.
3. **Closed lots:** a per-lot summary stays in Main.json for **36 months**. Lots closed without one can be imported from their archive file.
4. **Yield:**
   - **Flower yield** = bigs + mids + smalls + popcorn sent to processing.
   - **Total yield** = flower + trim.
   - **Wet weight** = the weight in the drying room on harvest day.
   - **Dry weight** = the whole lot after drying.

Recommendations from the first draft that were built that way:
- No $ figure per person.
- $ hidden for groups of fewer than 3 people.
- 8 h shifts by default.
- The existing Labour Report kept in place.

Changed while building:
- **Canopy sq ft** lives in `_EmployeeWizard.settings`, not on the room record. Nothing in SitkaTools changes, and each tool still writes only its own key.
- **Costs:** live lots use **today's wages**. Saving a crop summary while Wages.json is open also **freezes its labour cost** in `_EmployeeWizard.cropCosts[lotId]`. SitkaTools' split keeps that key in **Wages.json** (office only), never in Main.json. A closed-out lot then uses its frozen cost, so a later raise doesn't change it. Summaries still hold hours per person, never $.

---

## 3. Hooking up the harvest log (next week)

The charts are already wired to these metrics. Each step below is configuration, not code.

1. **Configure the harvest sheet in PaperWizard → Configure Sheets** as usual (load pages, place fields, build the wizard). Set its Document to *Harvest Log*.
2. **Tag each number question** with the **Report metric** drop-down on its question card. Weights get an **Answered in** picker (g / kg / lb); answers are converted to grams.

   | Question on the form | Report metric | When it's filled |
   |---|---|---|
   | Wet weight in the drying room | `harvest.wetWeight` | harvest day |
   | Dry weight, whole lot | `harvest.dryWeight` | when it comes out of the dry room |
   | Bigs / Mids / Smalls / Popcorn | `harvest.bigs` / `.mids` / `.smalls` / `.popcorn` | weigh & send to processing |
   | Flower, all grades together (only if grades aren't weighed separately) | `harvest.flowerTotal` | weigh & send |
   | Trim | `harvest.trim` | weigh & send |
   | Total THC % | `harvest.potency` | when the lab result comes back |
   | Total terpenes % | `harvest.terpenes` | when the lab result comes back |
   | Plants harvested (optional) | `harvest.plantsHarvested` | harvest day |

   **Rules that matter when designing the form:**
   - **Weights add up.** Every answer to a weight metric on a lot is summed: daily trim-log weighings, a multi-day harvest, several bins. So a question must record **that entry's** weight, never a running total.
   - **Percentages and counts take the latest answer**, so a re-test that's entered later replaces the first one.
   - Answers can be instance-level (the harvest-log header), per day (a daily drying or trim log), or a 📌 constant. All three are read.
   - Tags can sit on any sheet: harvest log, drying log, trim log, or a separate lab-results sheet.
   - If grades are weighed, flower yield = the sum of the grades, and `harvest.flowerTotal` is ignored.
3. **Check Reports → ⚙️ Setup & data → Report metrics.** Each tagged metric shows its sheet, question and answer count. The core harvest metrics show **Not tagged yet** in amber until they're tagged.
4. **Enter canopy sq ft** for each flower room on the same page. g/sq ft and g/sq ft/year stay "—" until it's set.
5. **Save crop summaries** before closing lots out (Setup & data → **Save N shipped**, or per lot). For lots already closed out, use **📂 Import archived lots** and pick their `Archive/Lot-*.json` files.
6. **Optional — tag the grow log:** temperature, RH, CO₂, PAR, pH/EC, nutrients, water, runoff and the four YES/NO IPM questions. That turns on the climate chart, the pest heat map and the per-crop grow-log averages in summaries.

Once one harvested lot has its weights, the yield tiles, strain scorecard, weight cascade and room trend fill in. The 6-month harvest forecast needs two harvested crops in a room, or two anywhere, to project from.

---

## 4. How it works

### Data sources (read on every render; nothing is cached)

| Source | Used for |
|---|---|
| CropLabourWizard events: `labour_map`, `estStaff` / `estMinutes`, `completed`, `taskType`, `roomPhase` | hours, estimates, the Gantts, schedule dates |
| CropProjection events | projected room stays, future labour demand, harvest forecast |
| Other events with a `labour_map` (EquipmentWizard, …) | "equipment & other" hours and cost |
| `_EmployeeWizard.employees`: `workDays`, `timeOff`, `wage` (wages only while Wages.json is open) | capacity, cost |
| `_PaperWizard.wizards[*].questions[*].metric` / `metricUnit` + `_PaperWizard.entries` | harvest numbers, grow-log series, plant counts (🌱 plant-count questions need no tag) |
| `_DailyWizard.buildings[*].tasks` (minutes × staff, recurrence) | chore hours in the demand forecast |
| `_EmployeeWizard.crops` | closed-out lots |
| `_EmployeeWizard.settings` | canopy sq ft, shift length |
| `_CropLabourWizard.taskTypes` | task names and order, and the cost phase of each task |

### The crop object

`rptBuildCrop(lotId, lot, events, paperwork, qmap)` builds one crop's numbers. It works on the live DB, or on an archive file's `lot` / `events` / `paperwork`. While a lot is in the DB, the reports use its **live** numbers. Its saved summary only takes over after close-out. "Save summary" stores this object (version 1) in `_EmployeeWizard.crops[lotId]`, about 5 KB:

```js
{
  version: 1, lotId, strain, parentLotId, savedAt,
  rooms: { cloning, veg, flower, dry, trim },            // names, as on the lot
  flowerRoomId, buildingId, canopySqFt,
  dates: { day0, planting, transplant, flip, harvestStart, harvestEnd, tankClean, bucking, trimStart, trimEnd, ship },
  labour: { est, act, temp, tempCost, tempNoWage,
            byPerson: { "<employee>": h, "temp:<name>": h },        // hours only — never wages
            byTask: { <taskType>: { date, est, act, temp, n, done, estStaff, estMinutes, roomId, days: { "YYYY-MM-DD": h } } } },
  weights: { wet, dry, grades: { bigs, mids, smalls, popcorn }, flower, trim, total },   // grams
  lab: { potency, terpenes },                                       // %
  plants: { started, harvested },
  derived: { gpp, gsf, gsfy, heldDays, dryDown, trimOut },
  env: { veg: {…}, flower: { temp, rh, vpd, co2, par, feedEc, feedPh, runoffEc, runoffPh }, waterL, nutrientMl },
  ipm: { flagDays, hermDays }
}
```

- **Retention:** every save drops summaries, and their frozen costs, whose harvest date (or save date) is more than **36 months** old.
- **Frozen cost:** `_EmployeeWizard.cropCosts[lotId] = { cost, missingHours, savedAt }`, written by Save summary only while wages are open.
  - SitkaTools' `DbSplit.split` moves `cropCosts` into Wages.json; `DbSplit.merge` reads it back only when Wages.json is opened.
  - A crop with `missingHours > 0` (someone had no wage) stays out of $ figures.
- **Close-out:** SitkaTools' close-out doesn't touch `_EmployeeWizard`, so saved summaries stay in Main.json after a lot is archived.
- **Up to date?** Setup & data marks a summary "out of date" when the live numbers differ from it.

### Main functions (EmployeeWizard.html, "📊 Reports tab")

| Function | Job |
|---|---|
| `REPORT_METRICS` | Metric vocabulary. **The same keys live in PaperWizard** (`REPORT_METRIC_GROUPS`); keep the two in step. |
| `rptQuestionMap` → `rptAnswers` → `rptRollup` | Tagged questions → answers (converted to base units) → per-lot values and daily series (plus air VPD) |
| `rptBuildCrop` / `rptCrops` | The crop object; live crops plus closed summaries |
| `rptHours`, `rptDoneTasks`, `rptAgg`, `rptCropCost`, `rptOtherCost`, `rptCapacity` | Labour hours by work date, completed tasks with estimates, headline numbers, costs with today's wages, roster capacity |
| `rptOtherLabour` / **`rptChoreLabour`** | Non-crop labour. `rptChoreLabour` returns `[]` until DailyWizard records chore hours. Fill it in then (see the comment on it) and every labour chart picks chores up. |
| `rptOverview` … `rptSetup` | One function per page |
| `RPT_PER`, `rptPerDenom`, `rptPerHours`, `rptYieldOf` | The Per switch: each crop's divisor (plants harvested, canopy sq ft, grams of flower) and the unit labels |
| `rptExploreMeasures`, `RPT_OUTCOMES`, `rptExplorer` | What drives yield? Measures include labour per plant and per task, flower days, density, survival, flower-phase climate and feed averages, water and nutrient per plant, and IPM days. Least-squares line and Pearson r. |
| `rptBoardPack`, `RPT_PRINT_CSS` | The board pack window and its light print theme |
| `rCard`, `rSvg`, `rT`, `rRect`, `rNice`, `rLin` … | Chart kit |

### PaperWizard additions

- **Question fields:** `metric` (a key above) and `metricUnit` (`g` / `kg` / `lb` for weights, `F` / `C` for temperature). Both are optional and saved with the sheet.
- **Editor:** a **Report metric** drop-down on text, number and select questions, plus an **Answered in** picker for weights and temperature. Changing a question to another type clears its tag.
- PaperWizard itself never reads the tags.

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
| `feed.nutrient` | Nutrient used (several product questions) | mL | daily sum |
| `water.total` | Water used | L | daily sum |
| `water.perPlant`, `water.runoff`, `runoff.ec`, `runoff.ph` | Irrigation per plant, runoff volume / EC / pH (several tests) | as asked | daily average |
| `ipm.pests`, `ipm.disease`, `ipm.herm`, `ipm.issue` | YES/NO flags | — | any YES that day |

Answers are parsed leniently: `"1,250"`, `"12 kg"` and `"24.0"` all read as numbers. A blank or unreadable answer is skipped.

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
| **Estimate accuracy** | Σ actual ÷ Σ estimated, over completed tasks that have both, planned in the period |
| **Suggested estimate** | the recipe's staff × (minutes × median actual/estimate ratio of the last 8 crops), rounded to 5 min. Shown once a task has 3+ crops. Recipes are changed in CropLabourWizard, never here. |
| **Labour cost** | staff hours × roster wage + temp hours × their own wage, or a closed lot's frozen cost. A crop with any hours that have no wage is left out of $ figures. |
| **Per (normalized)** | Plant / sq ft / gram use the crops **harvested in the period**: every hour (or $) on those crops ÷ Σ plants harvested, Σ canopy sq ft or Σ grams of flower. Total shows hours as logged by work date. |
| **r (What drives yield?)** | Pearson correlation over harvested crops in the period with both values. Below 0.2 it reads "no clear link", below 0.4 weak, below 0.6 moderate, otherwise strong. Under 8 crops it reads "too few to tell". |
| **Labour $/g, direct** | Σ crop cost ÷ Σ flower, for harvested crops in the period |
| **Labour $/g, fully loaded** | direct + (equipment and chore cost in the period ÷ the same flower) |
| **Cost by phase** | each crop's average $/h × its hours per phase. Phase: cloning / veg by the room rules, then the task registry order around `harvest`. |
| **Roster capacity** | per employee: shift hours on their work days, less booked time off (full or partial) and BC civic holidays |
| **Logged vs scheduled** | staff (non-temp) hours logged ÷ capacity, over the period up to today |
| **VPD (air)** | T °C = (°F − 32) × 5/9; SVP = 0.6108 × e^(17.27·T/(T + 237.3)); VPD = SVP × (1 − RH/100) |
| **Room yield slipping** | mean of the last 3 crops < 95 % of the 3 before (6+ crops in the room) |
| **Expected harvest** | plants × mean g/plant of past crops in the same room and strain (else the room, else the facility). The range is the best and worst of those crops. |

**Default target bands:** temperature 70–82 °F, RH 40–65 %, VPD 0.8–1.6 kPa (`RPT_TARGETS`).

---

## 7. Privacy

1. Reports are office only.
2. **No $ figure per person** anywhere. Summaries store hours per person, never wages.
3. $ appears only while Wages.json is open.
4. A $ figure built from **fewer than 3 people** is hidden (`RPT_MIN_PEOPLE`), because cost ÷ hours would reveal a wage.

---

## 8. Chart kit

- **Series colours, in fixed order** (validated for colour-blind separation on `#16213e`): blue, orange, aqua, yellow, magenta, green, violet, red.
  - **Strains:** the three most-grown strains keep blue, orange and aqua whatever the filters. Others are grey "Other".
  - **Flower rooms:** magenta, yellow, violet, green, red, by room id.
  - **Phases:** cloning violet, veg green, flower magenta, harvest & post yellow.
  - **Magnitude** (heat map, grade stack): one blue ramp.
  - Over / under estimate uses the existing amber / green, always with ▲ / ▼.
- **Marks:** thin bars with gaps, 2 px lines, solid hairline grids. Projections are hatched with a dashed outline, the suite's projection style.
- **Never:** two y-scales on one chart, more than 3 slices in the donut, a number on every point.

---

## 9. Not built yet

- **Chore hours:** fill in `rptChoreLabour` once DailyWizard records labour (ROADMAP Phase 1).
- **Lab results card:** only if potency and terpenes aren't on a controlled form. They can also be tagged on any sheet, a lab-results sheet included.
- **Data Health page:** partly covered today by Needs attention and the Setup & data tables.
