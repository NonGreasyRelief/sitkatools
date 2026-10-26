# Labour & Cost Wizard (EmployeeWizard) — Tool Context

Shown everywhere as **"👥 Labour & Cost Wizard"**. The folder, file, `_EmployeeWizard` DB key, `sourceTool: 'EmployeeWizard'` and `WorkCopy.TOOL` keep the old name so old files, links and other tools keep working. SitkaTools maps the id to the new name in its toasts (`toolDisplayName`).

It holds the employee roster and work weeks, books time off as shared calendar events, records daily labour hours on Labour-wizard tasks, and produces labour and cost reports.

## UI Layout

Five tabs: **Employees, Tasks, 📜 Labour Log, ⚡ Power & Rates, 📊 Reports**. Employees and Tasks have a scrolling list on the left and an editor on the right; the other three are full width. The **Labour Report** section sits below the tabs, hidden on the Labour Log and Power & Rates tabs and on building devices.

Header: tool name on the left, **Active Lot** dropdown on the right (Tasks is lot-scoped; Employees is global). Footer, theme and toasts follow root `CLAUDE.md` → "UI Standards".

### Employees Tab

- **List:** every employee. A red ✕ deletes after confirmation, and the same confirm step removes their time-off calendar events (see "Time off"). When they have hours logged, the confirmation says those stay on record under their name with no wage, so their cost shows as missing (review C9).
- **No employee selected → Work Week:** Mon–Sun columns, current week only (no navigation), with the names of who works each day.
- **Employee selected → editor:**
  - 7 day buttons, green (works) / red (off): the ongoing work week.
  - **Name** and **Wage** ($/h). Blank (placeholder "not set") leaves the wage unset or clears it. A first wage covers all their hours; **changing** a wage asks **Applies from** (today by default, never later): hours worked before that day keep the old wage (price by date, user decision 2026-10-26). The history is in `_EmployeeWizard.wageHistory[name]` (Wages.json), shown under the box; it follows a rename and goes with a delete.
  - **Floor manager** checkbox: floor managers sign crop and equipment tasks off (DailyWizard's ✅ Mark done, the Tasks tab's Mark completed) with their PIN and drawn initials.
  - **🔒 Floor manager PIN** (shown when Floor manager is ticked): 4–8 digits, typed twice; blank keeps the PIN they have, and a note says when it was set or that there's none yet. Saved only as a salted SHA-256 hash (`pin`). Unticking Floor manager removes the PIN. Each floor manager's PIN unlocks DailyWizard's ✏️ edit mode and approves deletions there and in the Tasks tab (`DailyWizard/CLAUDE.md` → "🔒 Edit Mode and Floor Manager PINs").
  - **Save Changes** and **Request Time Off**.
- **Time-off view** (Request Time Off): a month calendar showing regular days on and booked-off days (partial days shaded). Bookings can be multi-day or partial (hour ranges per day). Below, the employee's bookings, each with an ✕. Only booked time off creates calendar events, never ongoing shifts.

### Tasks Tab

- **List (terminal style):** `calendarEvents` with `lotId === Active Lot` and `sourceTool` in `LABOUR_TOOLS` (currently `CropLabourWizard`). It starts at today. Completed/old tasks are hidden until "show old/completed tasks" is ticked; the list still anchors at today, with older tasks above.
- Tasks are identified by the event `id` (`taskKey`), so a selection survives date or title changes made elsewhere.
- **Editor:**
  - A day selector across the event's days (today when in range). Per day, add a roster employee with hours + minutes, or a **Temp employee** (name + wage, below the employee picker; the wage may be left blank, never filled in for you). Previous days stay editable.
  - **Adding or changing hours needs a floor manager's sign-off** (user decision 2026-10-22): hours are meant to be logged on the floor in DailyWizard, so hours typed here ask for a floor manager's name, PIN and drawn initials (the shared `FloorPin` dialog with `{ initials: true }`), for adds and changes alike, on every device. Cancel, no initials or a wrong PIN changes nothing; the same hours again ask nothing. With no floor manager PIN set, hours can't be added here. The entry keeps `enteredBy`, `at` and `by`; a change keeps `editedSignoff` (see "Task labour map").
  - **+ Add day:** a calendar popover adds a work day as a `labour_map` key. The event's `date`/`endDate` are not changed, and the task keeps its due state until completed. An added day shows ✕ while it has no entries.
  - Day and task totals (see "Man-Hour Tracking").
  - **Removing an entry (✕)** asks for a floor manager's PIN (the shared `FloorPin` dialog) and goes on record in `_EmployeeWizard.labourRemovals`. Office only: on a building device the ✕ isn't shown, and a note points to DailyWizard's ⏱ hours view, which records removals in the building's own file.
  - **✍️ Mark task completed / reopen** (review C10, user decision 2026-10-25): completing asks for a floor manager's PIN and drawn initials (`FloorPin` with `{ initials: true }`) and records `completedBy = { name, initials, at, by, day }`, as DailyWizard's Mark done does. Reopening asks for a floor manager's PIN and clears it. A building device may reopen only a sign-off it made today; the office any, and one reopened after its day is kept in `_EmployeeWizard.signoffReopens`.
  - **Estimate:** when the event has `estStaff` / `estMinutes` (root `CLAUDE.md` → "Event Contract"), the meta line shows e.g. `⏱ Est. 👥 8 × 8h/day ≈ 448.0 h` and the task total adds `· estimated 448h`. It covers the event's own `[date, endDate]` days only, not added days.

### Labour Report Section

Estimated vs. actual hours (`renderLabourReport`). Office only. Hours only, no $.

- **Scope:** the Active Lot, or every lot when none is selected (header "Lot LOT-001" / "All lots"). With a lot selected, the empty option reads "— No lot / Global report —" (otherwise "— Select a lot —").
- **Counted:** `LABOUR_TOOLS` events with a lot and an estimate or recorded hours; no projections. **From / To** filter the start `date` (blank = no limit). **Completed tasks only** is on by default, because open tasks have only part of their hours.
- **Group by:** Task (task-type registry order = recipe order), Lot (oldest first), Room or Building. The room is where the task happens (`taskRoomId`, CropLabourWizard's phase rules): the event's `roomId`, else the lot's cloning / veg / flower / dry / trim room by `roomPhase` (`clwRoomPhase`: CropLabourWizard writes it on every task; older events by task type, trim and Clean Dry Room in the dry / trim room), else the lot's only room. Unresolved tasks go under "No room" / "No building".
- **Columns:** Tasks (with "(N no est.)"); Estimated (`estStaff × estMinutes × event days ÷ 60`); Actual (all `labour_map` hours, every day); Difference (with %, amber over, green under); Per plant (actual minutes ÷ current `plantCount`, lots that have one); a bar pair (outline = estimated, filled = actual, scaled to the largest row); a **Total** row.
- Notes under the table count tasks with no estimate (actual only) and tasks with an estimate but no hours.
- Redrawn with the Tasks tab (`renderTasksTab`): every labour entry, completion, lot change and DB load/update.

### Labour Log Tab (📜)

The accountability page: who did what, on which day, for how long, when and on which device it was logged, and the initials they drew. **Read-only: it writes nothing.** The office sees every entry; a building device sees only entries whose building is its own, with the Building filter locked to it.

- **Rows** (`logCollect`), one per entry:
  - DailyWizard chore hours: `_DailyWizard.buildings[<id>].labour[<day>][<task code>]`;
  - every event's `labour_map[<day>]`, from DailyWizard or the Tasks tab (crop, equipment or any other event);
  - removed entries, struck through, with the floor manager who approved each: DailyWizard's `_DailyWizard.buildings[<id>].adjustments` and `_DailyWizard.adjustments` (the office's removals of crop and equipment hours), and the Tasks tab's `_EmployeeWizard.labourRemovals`.
- **Each row:** who (flagged when not on the roster); the work (chore or task title, kind, building, room, lot; DailyWizard's built-in `misc` code reads "🧰 Miscellaneous labour", `DW_MISC`); the worker's note, first in Notes ("📝 …", DailyWizard's optional note, always there on Miscellaneous labour); for a room chore, a note naming the lots its hours went to that day (with % when they shared the room by plants) or "no crop in the room that day"; hours; drawn initials (tap to enlarge): the worker's own, or the floor manager's for hours entered in the Tasks tab ("Casey · office"), else "not signed"; logged `at` / `by` (Tasks-tab entries from before the sign-off have no time).
- **Flags:** entered in the Tasks tab by a floor manager ("🏢 entered in the Tasks tab by Casey (floor manager)"), or typed there before the sign-off (not signed); logged after the day worked ("⏰ logged 2 days later"); an entry changed in the Tasks tab ("✏️ signed for 1h 15m, changed … · approved by Casey", from `signedHours` / `editedAt` / `editedSignoff`); removed by the office; a person with more than 12 h in a day (`LOG_LONG_DAY`); a task's day total over 1.5× its estimate (`LOG_OVER_EST`; chores: staff × minutes, crop tasks: `estStaff × estMinutes`).
- **Summary chips:** entries, hours, people, signed, not signed, logged late, changed after signing, days over 12 h, removed. Then an **Hours by person** table (days, entries, hours, not signed), except when grouped by person.
- **Filters** (session-only): From / To (last 7 days by default), person, building, kind of work (daily chores, crop tasks, equipment, other), Group by (day newest first / person / task), Show removed entries.
- **An entry's building:** a chore's building; an event's room (`taskRoomId`) → its building; else the building it was logged on (`by`); else "No building known".
- **🖨️ Print:** the log with the current filters in a light print-ready window, like the board pack.
- Hours only, no wages or $. Redrawn on tab switch, DB load and live updates while open.

### ⚡ Power & Rates Tab (office only)

Inputs for the total cost per gram (root `CLAUDE.md` → "Total Cost per Gram"; definitions in `REPORTS.md` §6). Stored in `_EmployeeWizard.costs`, saved in Main.json.

- **Electricity cost comes from** (radio, `costs.electricity`): **Power bills** (each bill spread over its days, each day split between the building's crops by estimated use) or **Estimated usage** (estimated kWh × the rate).
- **Property cost is shared by** (radio, `costs.propertyShare`): **Lights in use** (default, user decision 2026-10-26 evening: between the rooms with a lot growing by their light count; a lot drying or trimming pays none, since the dry room is timed to be free for the flower rooms it serves, and a day with only lots drying or trimming in the building is an idle day), **Floor area** (a day when a room in use has no floor area is split by lights) or **Plants** (every lot in the building that day by its plants, the lot in the dry/trim room included, by the plants it harvested). Each day a building's monthly cost (SitkaTools' Building Manager) is split between its rooms by light count, floor area or plants, then between a room's lots by plants, so four equal running rooms carry a quarter each. The note lists each building's monthly cost.
- **$ per kWh:** used for the estimate; with bills, the note shows the bills' average $/kWh. **Water $ per 1,000 L:** prices the grow logs' water. Changing either asks **Applies from** (price by date): `costs.kWhRateHistory` / `costs.waterPer1000LHistory`, listed in the note.
- **🧾 Power bills:** meter (a building, or "Whole site" = `buildingId: null`), from, to, kWh (optional), amount. Each row shows days and $/kWh and has an ✕ (asks first). A bill overlapping another on the same meter asks before it's added. A strip shows which of the last 12 months each meter's bills cover (full / part / none).
- Every change calls `notifySitkaTools()`; live updates redraw it while open.

### Reports Tab (📊, office only)

Full spec, metrics, definitions and the harvest-log hook-up steps: `EmployeeWizard/REPORTS.md`. The essentials:

- **Pages:** Overview (8 KPI tiles incl. **Cost / g (all in)**, and Needs attention) · 💲 Costs · Crop Timeline (crop labour and room schedule Gantts) · Labour · Yield & Quality (incl. **What drives yield?**) · Rooms & Environment · Forecast · 📋 CTLS month · ⚙️ Setup & data.
- **🏢 By building** (💲 Costs page, cost audit 2026-10-26): each building's cost per gram and all buildings together (they add up), what each building costs to run (every $ spent in it, by part and month — the nursery included — on the period's own days), and each lot's costs split between the building it ships from, the nursery and its clones (`REPORTS.md` §6).
- **🌿 Cost per clone** (💲 Costs page), broken down like the cost per gram: growing the mothers, per clone, by part, for the clones cut in the period, and mother lot by mother lot. A lot cut on site from a mother lot carries its clones at that price in its cost per gram, and pays its own cutting (`REPORTS.md` §6).
- **📋 CTLS month:** the cultivation numbers for Health Canada's monthly CTLS report, for the whole facility. It covers plants (opening, every dated change with the reason and who they went to, closing, by lot), wet cannabis hanging to dry, dried cannabis on hand, and what shipped out (flower and trim, on the day Weigh & Ship is signed off), plus checks, 🖨️ Print and 📌 Mark as filed (`REPORTS.md` → "CTLS month").
- **Filter row** (period, building, flower room, strain, **Per** plant / sq ft / light / gram / total) scopes every page. Comparisons are always against the previous period of the same length. **🖨️ Board pack** prints the pages.
- **Reads every tool's data, read-only.** It writes only `_EmployeeWizard.crops`, `.settings`, (Save summary with wages open) `.cropCosts`, (Mark as filed) `.ctls` and (automatically, each finished month, with wages) `.overheadCosts`.
- **🔒 Overhead frozen by month** (⚙️ Setup & data): once a month is over, its shared labour's $ is frozen the first time the office opens the Reports with wages, and the cost per gram uses it. The card compares each frozen month with today's figure; "Use today's numbers" re-freezes a changed month and keeps the earlier copy (`REPORTS.md` → "Overhead frozen by month").
- **Crop summaries** keep closed-out lots in the trends for 36 months. A lot still in the DB always uses its live numbers. **🔒 Locked at close-out** (user decision 2026-10-26): SitkaTools closes a lot out only once its summary is saved as it is now, with its labour cost (Wages.json) and every power bill; a closed-out lot's summary is never re-priced or removed, and re-importing its archive only updates its plant history (`REPORTS.md` §4).
- **Privacy:** $ only on the office (user decision 2026-10-25: this replaced hiding $ for groups of fewer than 3 people); no $ per person; labour $ only while Wages.json is open. Live lots use today's wages; closed lots use the cost frozen with their summary.
- **Redraws** only while the tab is open: tab switch, DB load, live update (not while a Setup input is being typed in) and Active Lot change (which picks the lot for the Gantt and climate charts).
- **Charts:** hand-rolled SVG, no chart libraries, one shared tooltip, a ⊞ Table twin on every card.
- **Holidays:** BC civic holidays come out of roster capacity and are marked on the room schedule Gantt and the demand chart (`rptHolidays`). Otherwise the tool is not holiday-aware: it checks and notifies nothing (time-off dates are the user's choice).

## Data Model — Database Keys

EmployeeWizard owns `_EmployeeWizard`:

```jsonc
"_EmployeeWizard": {
  "employees": { "<name>": { "wage": 20, "workDays": [1, 3, 5], "floorManager": true, "pin": { "salt": "…", "hash": "…", "setAt": "2026-10-22" }, "timeOff": [] } },
  "labourRemovals": [{ "at": "<ISO>", "by": "office", "date": "2026-10-22", "eventId": "ev_…", "title": "…", "entry": { "…": "the removed entry" }, "approvedBy": "Kasia" }],
  "crops":     { "<lotId>": { "version": 4, "savedAt": "…", "costs": { /* frozen non-labour costs */ }, "ctls": { /* plant history */ } /* … REPORTS.md §4 */ } },
  "settings":  { "shiftHours": 8 },
  "costs":     { "electricity": "bills", "kWhRate": 0.11, "waterPer1000L": 2.4, "propertyShare": "lights",
                 "bills": [{ "id": "pb…", "buildingId": "B6", "from": "2026-09-01", "to": "2026-09-30", "kWh": 41774, "amount": 4558 }] },
  "cropCosts": { "<lotId>": { "cost": 20358.4, "missingHours": 0, "savedAt": "…", "cloneLabour": 312.5 } },   // cloneLabour: a lot cut from a mother, its clones' share of the mother's labour
  "wageHistory": { "<name>": [{ "from": "", "wage": 20 }, { "from": "2026-10-01", "wage": 22 }] },   // in Wages.json: each wage change and the day it applies from
  "ctls":      { "2026-09": { "filedAt": "<ISO>", "plants": 1240, "wetG": 8400.5, "dryG": 700, "openingPlants": 1185, "openingWetG": 3000 } },
  "overheadCosts": { "2026-09": { "frozenAt": "<ISO>", "rows": [["2026-09-14", "B1", "", "chore", 2, 40, 0]], "history": [] } }   // in Wages.json
}
```

- **Split files** (root `CLAUDE.md` → "Split Database"): all of it lives in Main.json except wages, `cropCosts` and `overheadCosts`, which are money and go to Wages.json (office only).
- **`employees`** is keyed by name. The name is the identity (labour maps reference it), so a duplicate name is rejected.
  - **Rename** re-points the task labour maps and keeps the old name in `formerNames` (review C9): hours logged under it in other tools' data (DailyWizard's chore hours, crop summaries, removal records) still find the employee and their wage (`employeeByName`), and the Labour Log tags them "renamed — now …". A new employee can't take someone's former name.
  - `wage` — $/h, optional, **no default**. New employees get no `wage` key, and a blank wage (e.g. Wages.json not opened) stays unset. Never invent one: it would become a fake $ figure or a wage change SitkaTools can't save. Editable in the employee editor, but never shown per person on any dash or report; used only for cost math.
  - `workDays` — `Date.getDay()` numbers (`0` = Sun … `6` = Sat), shown Monday-first. New employees default to Mon–Fri `[1, 2, 3, 4, 5]`.
  - `floorManager` — `true` for people who sign tasks off (absent otherwise). Mark done lists only floor managers with a PIN; nobody can sign off until one has a PIN.
  - `pin` — a floor manager's PIN as `{ salt, hash, setAt }`: SHA-256 of `<salt>:<PIN>`, never the PIN itself.
- **`labourRemovals`** — hours removed in the Tasks tab, with who approved it (floor manager PIN). Read by the Labour Log.
- **`signoffReopens`** — sign-offs the office reopened in the Tasks tab after their day: `{ at, by, date, eventId, title, reopened: completedBy, approvedBy }`.
- **`crops`** — saved crop summaries (Reports → Setup & data, or 📋 CTLS month → Lots ready to close out). Hours per person, never wages; the lot's dated plant and weight history (`ctls`); dropped after 36 months; created on the first save.
- **`settings`** — `shiftHours`, the shift length for roster capacity (default 8). Canopy is set on the room (`rooms.<id>.canopySqFt`, Room Manager); `settings.canopySqFt` is read only as a fallback. Created on the first change.
- **`costs`** — ⚡ Power & Rates (above).
- **`cropCosts`** — labour cost frozen when a crop summary is saved with wages open. Closed-out lots use it, so later raises don't restate them. A lot cut from a mother lot also freezes its clones' labour (`cloneLabour`).
- **`overheadCosts`** — each finished month's shared labour, frozen: rows `[day, buildingId, roomId, kind, hours, $, hours with no wage]`, `frozenAt`, and `history` (earlier copies, kept when a month is re-frozen).
- **`ctls`** — months marked as filed on the 📋 CTLS month page, with their closing (and opening) numbers. Next month's opening is checked against them.

### Time off

Each booking in `employees[name].timeOff` is mirrored to one calendar event:

```json
{ "id": "string", "date": "YYYY-MM-DD", "endDate": "YYYY-MM-DD | null", "hoursOff": [{ "date": "YYYY-MM-DD", "start": "HH:MM", "end": "HH:MM" }], "calEventId": "ev_…" }
```

- `hoursOff` only for partial book-offs; a day with no entry is off all day.
- The calendar event: title `"🏖️ Time Off — <Name>"`, `date`, `endDate` only when multi-day, `sourceTool: "EmployeeWizard"`, no `lotId`.
- `calEventId` links the event, so deleting a booking removes exactly that event (two blocks on one day stay separate). A booking without one is matched by title + dates (first match), else by an orphaned time-off event with the same dates (titled for a name not on the roster, and not linked by any booking's `calEventId`), used only when exactly one fits.
- **Deleting an employee** removes their bookings' events (by id and that lookup) plus any event with their time-off title. **Renaming** retitles their time-off events and links older bookings to their event by id. The lookup changes the DB only on the user's delete or rename, never on load or render.

### Task labour map

The tool writes `labour_map` and `completed` directly onto Labour-wizard events (in-place annotation):

```json
"labour_map": {
  "2026-09-14": [
    { "id": "le_…", "employee": "Jane Doe", "hours": 7.5 },
    { "id": "le_…", "temp": "Bob", "wage": 25, "hours": 4 }
  ]
},
"completed": true
```

- Keys are ISO dates and may fall outside the event's `[date, endDate]` (+ Add day). Task hour and cost totals span **all** recorded days.
- Roster entries reference the name (wage looked up at report time); temp entries carry their own name + wage.
- **Entry ids:** `le_` + 10 characters (`newLabourId()`) on every new entry, here and in DailyWizard. SitkaTools merges the office's and a building's hours by them (root `CLAUDE.md` → "Split Database").
- **DailyWizard entries** also carry `initials` (`{ name, strokes }`), `at` and `by`; a DailyWizard temp may have no `wage`. The Tasks tab tags them **✍️ signed** (and "no wage"), and edits or deletes them like any entry.
- **Tasks-tab entries** carry `enteredBy` (`{ name, strokes }`: the floor manager who signed them off), `at` and `by` (`office` or the building id). The Tasks tab tags them "✍️ <floor manager>". Older ones have none of these.
- **Changing an entry's hours** ("Add (or update)", signed off like an add) records `signedHours` (the hours as first signed, for an entry with `initials` or `enteredBy`, set the first time), `editedAt` (ISO time), `editedBy` (`office` or the building id) and `editedSignoff` (`{ name, strokes }`, the floor manager who approved the latest change). The tag reads "✍️ signed · changed", and the Labour Log and DailyWizard's hours view show the change. Deleting an entry needs a floor manager's PIN and is recorded in `labourRemovals` (see "Tasks Tab").
- `completed` — set by Mark completed here or by DailyWizard's ✅ Mark done; both record `completedBy` (the floor manager's sign-off). Reopening here deletes it (floor manager PIN; see "Tasks Tab").
- CropLabourWizard carries `labour_map` and `completed` over when it regenerates a schedule (root `CLAUDE.md` → "Event Annotations Survive Regeneration").

## Man-Hour Tracking

- **Cost per task-day** = Σ (hours × wage): the roster wage for employees, the entry's own wage for temps.
- **No wages → hours only:** on a building device, or when no roster employee has a `wage`, day and task totals show hours only — never a $ figure built on a made-up wage. A total where someone with hours has no wage (a roster employee without one, a temp left blank) shows "$ — a wage is missing" (`entryWage` returns null; review C5).
- **Per plant:** total hours ÷ the lot's `plantCount` (`lots.<id>.plantCount`). A lot without one gets totals only.

## Relationship to SitkaTools

A standard subtool: root `CLAUDE.md` → "Cross-Window Database Workflow", "Shared Working Copy" and "Building Device View".

- **Live updates** (`WorkCopy.LIVE: true`): on `sitkaGit_db_update` it redraws the roster, work week / time-off calendar and task list, keeping the selected lot and task. No form field is reset, and it never calls `notifySitkaTools()` in response.
- **Building devices:** only the Tasks tab (its Active Lot list holds only that building's lots) and the Labour Log of work done in that building. Labour and completion are floor fields, saved in the building's own file. The roster, wages, time off, the Labour Report, Power & Rates and Reports are hidden.

## Constraints

Root `CLAUDE.md` → "Core Principles" and "JavaScript" apply: one HTML file, vanilla JS, no network calls, no browser storage beyond the shared working copy. Charts and reports are hand-rolled SVG/canvas — no chart libraries.
