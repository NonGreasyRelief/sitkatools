# SitkaGit — Cannabis Cultivation Tracking Suite

Standalone single-file HTML tools for licensed cannabis cultivation. Every tool runs in the browser and works on one shared JSON database, and SitkaTools shows every tool's events on one calendar.

- **The hub's own details** (managers, calendar, folder mode, saving, the split-file internals, the shared working copy): `SitkaTools/CLAUDE.md`.
- **Multi-user plan:** read `ROADMAP.md` before changing how the DB is loaded, saved or split.
- **Past decisions**, dated, one line each: `DECISIONS.md` (not loaded by default).
- Each tool's own rules are in its folder's `CLAUDE.md`. `AGENTS.md` files are symlinks to them.

## Core Principles

- **Single-file tools:** one `<Tool>/<Tool>.html` each, CSS and JS inside. No build step, dependencies, frameworks, bundlers or npm packages.
- **Everything launches through SitkaTools:** tools open from it (a popup on laptops, a tab on phones and tablets), get the DB from it, and SitkaTools does all saving. A tool opened by itself only shows "Open this tool from SitkaTools".
- **Browser sandbox only:** runs from `file://` or GitHub Pages. No `fetch()` to other origins, no WebSocket, no server of our own.
- **Tools don't talk to each other directly.** Shared state goes through the DB, which SitkaTools relays live to every open tool.
- **No new browser storage** (localStorage, sessionStorage, IndexedDB, cookies) without the user's explicit OK. The approved exceptions are listed under "JavaScript".
- **Never replace an existing workflow with a "better" one**; add the new path alongside. For example, Save DB's right-click **Save Link As…** must stay.

## Shared Database

One file `DB-YY-MM-DD.json` (2-digit year in file names only; ISO `YYYY-MM-DD` dates inside), or the split files below. When exporting, always write the full DB, never a partial diff.

```js
{
  lots: { <LotID>: {
    name, strain, stage, createdDate, closedDate, parentLotId,
    destRoom, vegRoom, cloningRoom, dryRoom, trimRoom,  // room NAMES; only destRoom syncs to rooms.<id>.assignedLots
    currentRoom, plantCount,                            // live, kept up to date by PaperWizard's grow logs (only them, once a lot has one)
    type, plantsTransferred, startPlantCount,           // new-lot | sub-lot | split-lot; a split's plants; the count it started with
    receivedFrom,                                       // new lots: who the plants came from (optional)
    _tool_<Tool>: { … } } },
  rooms: { <RoomID>: {
    name, description, createdDate, assignedLots: [], buildingId,
    isFlowering, designation,                           // designation: Grow 1…4, Clone, Mother, Vegetation
    lightCount, lightWattage, canopySqFt,               // Reports: per light, per sq ft, power estimate
    vegLightHours /*18*/, bloomLightHours /*12*/ } },   // a Mother room's lights run every day
  buildings: { <BuildingID>: { name, description, createdDate, assignedRooms: [], monthlyPropertyCost } },
  calendarEvents: [ { id, lotId, date, endDate?, title, sourceTool, … } ],
  _<Tool>: { … },
  _meta: { schemaVersion, revision, savedAt, saveId, parentSaveId }   // save stamp, written by SitkaTools only
}
```

- A room's building is `room.buildingId` (the source of truth); `building.assignedRooms` mirrors it. A room is in at most one building.
- Renaming or deleting a room nulls the room-name fields on the lots that use it. Deleting a building nulls `buildingId` on its rooms.
- Dry rooms double as trim rooms: `dryRoom` and `trimRoom` may name the same room, but each has its own clean form.
- **Ownership:** a tool reads lots, rooms and buildings, and writes only its own keys (`_tool_<Tool>` on a lot, or top-level `_<Tool>`). The exceptions:
  - **The Labour & Cost Wizard's Reports and Labour Log may read every tool's data.** They write only `_EmployeeWizard.crops / .settings / .costs / .ctls`.
  - **PaperWizard may write exactly `lots.plantCount`, `.stage` and `.currentRoom`** when a log entry records a change. No other tool writes another tool's data.
  - **🔒 A lot with a grow log is locked to it** (any daily-weekly page in PaperWizard): its plant count, phase and room then change only through PaperWizard (the grow log, and the harvest log after it). SitkaTools shows them read-only, won't delete the lot, and won't delete or re-home a room it's in; the one other writer is a lot move's Accept (`currentRoom`). A changed count needs a reason, split by reason (`PaperWizard/CLAUDE.md` → "🌱 Why the Plant Count Changed"). Details: `SitkaTools/CLAUDE.md` → "Lot Manager".
  - **Event annotations:** labour tools and SitkaTools add fields to other tools' events in place (see "Event Annotations Survive Regeneration").
  - SitkaTools' deletion hook removes one projected lot (see "Crop Projection").
- `calendarEvents` are append-only per tool; `sourceTool` names the tool that made each one.
- **`_meta`:** built when the user saves and committed only once the save link is used, so a cancelled save changes nothing. Two files with the same `parentSaveId` were edited from the same copy. No tool reads it for logic; tools carry it through untouched.
- PaperWizard's grow logs are the source of truth for a lot's plant count, phase and room once it has one, with every removal's reason (destroyed, culled, sampled, harvested, moved, sold). Long term they also become the source for the rest of a lot's lifecycle (sub-lots), and the lot manager will handle only external lots.

### Event IDs

- New events get `newEventId()`: `ev_` + 10 characters from `CODE_ALPHABET` (`abcdefghjkmnpqrstuvwxyz23456789`).
- An event without an `id` gets one hashed from `sourceTool|lotId|roomId|equipmentId|taskType|date|endDate|title` the first time `ensureStructure()` runs. Every device and tool derives the same id. A duplicate is re-keyed `-2`, `-3`….
- Tools that create or match events (SitkaTools, GeneralEvent, CropLabourWizard, EquipmentWizard, EmployeeWizard) include `newEventId` / `contentHash` / `ensureEventIds` as function declarations (usable before any `const` initialises) and call `ensureEventIds(this.data.calendarEvents)` in `DB.ensureStructure()`.
- A duplicated event or an imported ICS event gets a new id.

### Event Annotations Survive Regeneration

CropLabourWizard (on Generate) and EquipmentWizard (on every resync) rebuild their events from scratch. `carryOverAnnotations(previous, fresh, keyOf)` copies these onto the replacement: `id`, `completed`, `completedBy` (DailyWizard's floor-manager sign-off), `labour_map` (hours), and the SitkaTools event-panel fields `startTime`, `endTime`, `notes`, `status`, `assignedTo`, `estimatedHours`.

- Matching: CropLabourWizard by `taskType` (and `repeat`) within the lot; EquipmentWizard by `equipmentId + taskId + date` (falling back to `equipmentId + title + date`).
- Unmatched work records (`completed`, or a non-empty `labour_map`) are never dropped silently. CropLabourWizard asks before Generate, Clear or Delete Schedule would delete them (Cancel changes nothing). EquipmentWizard keeps them on the calendar as maintenance history while their equipment and room exist.

### Multi-Day Events

`endDate` is optional; set it only when it differs from `date`. The event shows on every day of `[date, endDate]`, a drag keeps its length, the event panel edits both dates, and the terminal list shows `start → end`.

## Cross-Window Database Workflow (postMessage)

A tool opens as a centred popup, half the main window's width and 83% of its height (design for that size). On phones it opens as a tab and uses the shared working copy instead.

```js
{ type: 'sitkaGit_db', payload, view: { building, split } }  // SitkaTools → tool on open; retried 5× at 200 ms until ready
{ type: 'sitkaGit_ready' }                                   // tool → SitkaTools: got it
{ type: 'sitkaGit_db_update', payload }                      // tool → SitkaTools after every change
{ type: 'sitkaGit_db_update', payload, view: { building, split } }  // SitkaTools → every open tool whenever its DB changes
{ type: 'sitkaGit_ping' }                                    // tool → SitkaTools on focus: still linked?
{ type: 'sitkaGit_not_linked', about }                       // SitkaTools → a window it didn't open
```

1. **Origin:** every message targets `SITKA_MSG_ORIGIN`, which is `'*'` only under `file://` (opaque origins). SitkaTools accepts updates only from windows in its `openSubtools` list; a tool accepts messages only from `window.opener`.
   ```js
   const SITKA_MSG_ORIGIN = (location.protocol === 'file:' || location.origin === 'null') ? '*' : location.origin;
   ```
2. **A tool calls `notifySitkaTools()` after every change.** SitkaTools takes the DB, keeps its own `_meta`, marks it unsaved only if something really changed, re-renders, and shows a 3-second sync toast.
3. **SitkaTools pushes every change to every open tool** (`broadcastToSubtools`), or a tool window would later write its old copy back over newer work. A tool handles the push like `sitkaGit_db` but **never replies** to it (no ready, no notify, no toast), and keeps half-typed input and open drafts. EquipmentWizard doesn't resync on it.
4. **Lost link:** a popup that outlives a SitkaTools reload can't save any more. Every tool has the same `LinkLost` snippet. `notifySitkaTools()` starts with `if (typeof LinkLost !== 'undefined' && !LinkLost.canSend()) return;`, which shows a cover ("SitkaTools didn't get your last change": Close this window / Keep it open to look). The tool pings on focus and checks every 3 s whether its opener closed. This applies only to postMessage windows (`WorkCopy.gotDb && !WorkCopy.inUse`); tablet tabs save through the shared copy.
5. **Message handler:** starts with `if (e.isTrusted && (!window.opener || e.source !== window.opener)) return;` (untrusted events are the tool's own shared-copy loader). It then replaces `DB.data`, calls `DB.ensureStructure()`, returns early if `DeviceView.take(e.data)` says so, and re-renders. Copy the snippets (`notifySitkaTools`, the handler, `WorkCopy`, `DeviceView`, `LinkLost`) from an existing tool; they must stay identical across tools.

## Split Database — Main, Wages and Building Files

The DB can live in fixed-name files in the OneDrive-synced SharePoint folder (SharePoint's version history replaces dated copies). A single `DB-YY-MM-DD.json` still opens and saves as before. Implementation: `SitkaTools/CLAUDE.md` → "Split Files — How They Work".

| File | Saved by | Holds |
|---|---|---|
| `Main.json` | office | lots and schedules, rooms and buildings, the roster **without wages** (with floor managers' PIN hashes), crop summaries and report settings, power bills and rates, recipes and the input price list, equipment, general events, paperwork templates, the office's records of removed hours, `_fieldStamps` |
| `Wages.json` | office only, never opened on building devices | `{ wages: { name: $/h }, cropCosts?: { lotId: { cost, missingHours, savedAt } } }` |
| `Building-<ID>.json` | that building (the office may too) | `_DailyWizard.buildings[<ID>]`, the `_PaperWizard.entries` pages filled there, `_LotTransfers`, and `_overlays` (that building's updates to office records) |
| `Archive/Lot-<id>-<date>.json` | office, at close-out | everything about a closed lot |

- **Every device opens all the files and saves only its own.** SitkaTools merges them into the usual one-DB shape (`DbSplit.merge`), so every tool works unchanged, and splits them back on save (`DbSplit.split`).
- **Device role** (`office` or a building id) comes from the page link: `SitkaTools.html?device=office` or `?device=<building id>`. Without one, opening the files asks once per page session. The role is never stored in the browser.
- **Overlays:** a building can't save Main, so its edits to the floor fields `lots.plantCount / stage / currentRoom` and `calendarEvents[].completed / completedBy / labour_map` go in its own file as `{ value, at }` overlays. For each field, the newest of the office's stamped edit (`Main._fieldStamps`) and every building's overlay wins.
- **Labour hours merge entry by entry:** every `labour_map` entry has an `id` (`le_` + 10 characters; older entries get one hashed from their content). The office and a building can both add hours to the same task between saves, and neither side's entries are lost.
- **Paperwork routing:** a page stays in the building file it was opened from. A new one goes in the building device's own file, or else follows its room → building. Signed pages never move.
- **What a device may save:** the office saves Main, Wages (only if Wages.json was opened) and any building file; a building device saves only its own building file. A file is overwritten only if it was opened this session, or in folder mode doesn't exist yet. Changes a device can't save are listed in a warning and stay unsaved.
- **Saving:** 💾 Save DB shows one right-click **Save Link As…** link per changed file, plus **Save to "<folder>"** when a folder is open. A folder save writes `<name>-conflict-HHMM.json` instead of overwriting a file saved elsewhere since opening.
- **Wages.json loaded by itself** in 📂 Load DB (recognised by its content, so `Wages (1).json` works) is added to the open split files on the office. It's refused, with nothing changed, on a building device, with a single-file DB open, or with nothing open.
- **One-time split:** 🏢 Building Files card → **Split into building files** (office; every room must belong to a building).
- **Lot move:** the lot's building (or the office) **Sends** it: a pending `_LotTransfers` record in the sender's file. The receiving building **Accepts** it (picks one of its rooms, enters initials), which sets `lots.currentRoom`.
- **Lot hand-off:** Send freezes the lot's paperwork on the sender (PaperWizard shows it read-only). Accept moves the lot's **unsigned** pages and its lot-level paperwork values to the receiver's file; signed pages stay where they are. The old copies are tidied away by the next save that may rewrite that file.
- **Lot close-out** (office only in split mode) needs a plant count of 0 and, for a lot with grow logs, every daily page complete with no grow-log days missing (a harvest log isn't required: not every lot is harvested). Then the lot, its events with labour, its schedule history, its paperwork from every building and its transfers go to `Archive/Lot-<id>-<date>.json`. The lot leaves the DB only once the archive is written or its link used. Its crop summary stays, so it stays in the report trends for 36 months.

### Shared Working Copy (tablets)

All tools are served from one site, so they share browser storage. SitkaTools mirrors the open DB (plus split bookkeeping and the device view) into IndexedDB `sitkatools` → `work` (key `current`) and announces changes on `BroadcastChannel('sitkatools-db')`. Every tool has the same `WorkCopy` snippet.

- A tool with no opener (a tablet tab), or whose `sitkaGit_db` doesn't arrive within 1.5 s, loads the shared copy and shows **Go back to SitkaTools to save**. It feeds the DB to its own message handler as a synthetic, untrusted `message` event.
- `notifySitkaTools()` also writes the shared copy when the tool uses it; SitkaTools takes it in like any tool update.
- **Go back to SitkaTools to save:** writes the copy, broadcasts `save-request`, focuses the opener. SitkaTools covers itself with "Save before you continue" until the save happens.
- The copy deletes itself when SitkaTools closes with everything saved (a save marks it saved at once).
- **⚠️ Session closed without saving:** unsaved work left behind (a flat battery, the browser closed) is kept however old it gets. The next SitkaTools start offers it back, "Session closed without saving on MM/DD at HH:MM. Restore session?", until someone restores or discards it. Restoring brings back the device and the split bookkeeping, so the device saves its own files with no reload. Details: `SitkaTools/CLAUDE.md` → "Shared Working Copy — Details".
- Tools take the copy however old it is.
- IndexedDB version is **3** everywhere (`folders`, `settings`, `work`); every copy of the open/upgrade code must match.

### Building Device View

A building device sees only its own building and only what it can save. It applies when split files are open and the device's role is a building (`DeviceView.building`). The office, or a single-file DB, sees everything. **It only changes what's shown:** the DB still holds everything, and every building file is still opened, because a lot's moves and paper trail span files.

- **What belongs to a building:** its rooms (`buildingId`); lots whose `currentRoom` **or** `destRoom` is one of them; events tied to one of those lots (`lotId`) or rooms (`roomId`). Events tied to no lot and no room (general events, time off) show everywhere. Events of a removed lot or room show nowhere.
- **SitkaTools:** see `SitkaTools/CLAUDE.md` → "On a Building Device".
- **Tools get the view with the DB** (`view: { building, split }` on every message, and in the shared copy; `split` = split files are open). Every tool has the same `DeviceView` snippet (`take(msg)`, `lotVisible`, `roomVisible`); only `OFFICE_ONLY` differs.
  - **Office-only tools** (CropLabourWizard, EquipmentWizard, GeneralEvent) show "Office only" and stop before loading.
  - **DailyWizard** lists a chore tied to a room only while a lot's current room is that room (`DailyWizard/CLAUDE.md` → "🚪 Room Chores"). It opens on its own building; other buildings and All Buildings can be viewed but not changed (`DailyWizard/CLAUDE.md` → "Other Buildings on a Building Device"). Its floor manager signs tasks off with ✅ Mark done, and unlocks task editing and approves deletions with their own PIN, on every device (`DailyWizard/CLAUDE.md` → "🔒 Edit Mode and Floor Manager PINs").
  - **PaperWizard** lists only the building's lots, hides Configure Sheets, offers only the building's rooms, and shows some lots read-only (`lotElsewhere`, see `PaperWizard/CLAUDE.md`).
  - **The Labour & Cost Wizard** shows only the Tasks tab and the 📜 Labour Log, limited to work in the building.

## Crop Projection

CropLabourWizard plans future crops in flowering rooms (`isFlowering`) as **projected lots**: a 5-lot chain per room, ids `{roomId}-TBA-01`…`-05`. They live in `_CropLabourWizard.projectedLots` (owned by CropLabourWizard), never in `DB.lots`, and their events carry `sourceTool: 'CropProjection'`, `lotId`, and always a `roomId`. Chain rules, reprojection and push-backs: `CropLabourWizard/CLAUDE.md` → "Crop Projection".

- SitkaTools draws projection events dashed and muted (`.day-event.projection`); ICS export adds " (projected)" to their titles.

### Deletion Hook — SitkaTools

When a real lot is created in, or moved into, a flowering room, SitkaTools:
1. deletes `projectedLots["{roomId}-TBA-01"]` (the only entry SitkaTools may ever touch) and its `CropProjection` events;
2. leaves TBA-02…05 alone, so the room is now *pending reprojection*;
3. says so in its confirmation, telling the user to run **Reproject** in CropLabourWizard once the new lot has a schedule.

It is a no-op when the room has no TBA-01. No tool regenerates or reprojects automatically.

## Task Recipes

CropLabourWizard's tasks come from recipes: the built-in `sitka-9week` in code, plus user recipes in `_CropLabourWizard.recipes`. Recipe schema, validation, inputs and labour estimates: `CropLabourWizard/CLAUDE.md` → "Task Recipes (Recipe Manager)". What other tools rely on:

- **🌿 Mother lots:** a recipe with `kind: 'vegetative'` schedules mother plants (no flip, harvest or trim; retired on a planned day). A lot scheduled with one is a mother lot, and its `_tool_CropLabourWizard.kind` is `'vegetative'`. Its destination room (`destRoom`) is its Mother room. Nothing else flags mothers.
- **Repeating tasks:** a recipe task may repeat every N days; each repeat is its own event with `repeat: 1, 2, …`.
- **`taskType` ids are stable** (32 built-in). SitkaTools and DailyWizard map labels and emoji from hard-coded maps first, then `_CropLabourWizard.taskTypes` (a registry merged on every recipe save and import), then the raw id. Calendar filters work on any `taskType`.
- **Task order against `transplant` is load-bearing:** it decides the room a task happens in (before transplant → cloning or veg room, after → flower room) in CropLabourWizard and SitkaTools (`_CLW_TASK_ORDER`). An unknown type falls back to the flower room.
- Recipe files are `recipe-<id>.json`, imported only through a file picker; nothing is ever fetched.

### Event Contract

CropLabourWizard events: `{ id, date, endDate?, title, sourceTool: 'CropLabourWizard', lotId, taskType, repeat?, roomId?, roomPhase?, estStaff?, estMinutes? }`. `repeat` numbers a repeating task's events; annotations carry over by `taskType` + `repeat`.

- `roomPhase` (`cloning` | `veg` | `flower`) is present only when the recipe task sets it, and overrides the order-based room choice.
- `estStaff` / `estMinutes` are the recipe's labour estimate **per day**: estimated person-hours = `estStaff × estMinutes × days in [date, endDate] ÷ 60`. Shown by CropLabourWizard, DailyWizard, the SitkaTools tooltip and the Labour & Cost Wizard. Not carried over on regeneration (they come from the recipe). They're separate from the event panel's typed `estimatedHours`.

## Total Cost per Gram

The CEO's key number, shown in the Labour & Cost Wizard's Reports (overview tile **Cost / g (all in)**, the **💲 Costs** page). Definitions: `EmployeeWizard/REPORTS.md`.

| Part | Comes from | Priced with |
|---|---|---|
| Labour | hours on crop tasks, chores and equipment (a room chore's hours go to the lots in its room that day) | wages (Wages.json) |
| Electricity | rooms' lights, watts and light cycles; the grow log's daily light % (100% when not logged); equipment power | ⚡ Power & Rates: power bills (split by estimated use) **or** estimated kWh × $/kWh |
| Water | grow log water (L) | $ per 1,000 L |
| Fertilizer | grow log mL by product (PaperWizard's product link) | price list, $/L (CropLabourWizard → 🧪 Inputs) |
| Supplies | the recipe's supplies: per crop, per plant at the start, or per plant at a task (the plants on that task's day: coco blocks at Transplanting, rockwool at Planting, clone cubes at Cutting Clones) | price list, $ per unit |
| Property | days each crop spends in a building's rooms | the building's monthly rent + fees, shared by the rooms holding a crop (by lights or plants) |

- Electricity is worked out room by room, day by day. An empty room, or a Mother room, passes its kWh to the building's crops that day.
- **Room chores:** a DailyWizard chore can be tied to one of its building's rooms (`task.roomId`). Its hours go into the labour of the lots scheduled in that room that day (the same room stays electricity uses), split by plants when lots share the room; they count as that lot's own labour cost. Chores without a room, and room-chore hours on a day the room held no crop, are shared over the crops harvested in the period, by grams (the "fully loaded" labour). Nothing is written to the lots: Reports work the split out when they draw, and a crop summary keeps its share.
- Each part's $/g uses only the crops that part can price; Costs → "What's missing from the cost?" lists the gaps.
- Prices, rates and bills live in Main.json. Closed lots keep their non-labour costs frozen in their crop summary; labour cost is frozen in Wages.json.

## Monthly CTLS Numbers

The Labour & Cost Wizard's **📋 CTLS month** (Reports) gives the cultivation numbers for Health Canada's monthly CTLS report, for the whole facility. Definitions: `EmployeeWizard/REPORTS.md` → "CTLS month".

- **Plants:**
  - **In:** only from the Lot Manager. New lots are received (with `receivedFrom`), sub-lots are clones cut.
  - **Out:** only from the grow-log reasons (`days[day]._removed`: destroyed, culled, sampled, harvested, sold). Sold plants name the company and samples may name the lab (`._removedTo`).
  - **Between lots:** split lots and plants "moved" between lots are shown but not counted.
  - **On hand:** each lot's last grow-log count.
- **Wet cannabis** is the harvest log's wet weight, hanging until the lot's dry weight is recorded. **Dry flower sent out** is the dry weight, on the day it's recorded.
- **Closed-out lots** count from the dated history saved with their crop summary (`_EmployeeWizard.crops[lot].ctls`). SitkaTools' close-out warns when it's missing.
- **📌 Mark as filed** keeps a month's closing numbers (`_EmployeeWizard.ctls[YYYY-MM]`). The next month's opening is checked against them, because CTLS rejects an opening more than 5 % off the last closing.

## BC Civic Holidays

The calendar knows BC's 11 statutory holidays, computed from the year (never stored, no network). Use **local-time** dates (`new Date(y, m, d)`, months 0-based), never UTC. Only fixed-date holidays shift: one on a Saturday or Sunday is observed the following Monday, and the observed date is what counts. BC does **not** observe Easter Sunday, Easter Monday or Boxing Day.

| Holiday | Rule | 2026 | 2027 |
|---|---|---|---|
| New Year's Day | Jan 1, observed | Jan 1 | Jan 1 |
| Family Day | 3rd Monday of Feb | Feb 16 | Feb 15 |
| Good Friday | Easter Sunday − 2 (Gregorian computus) | Apr 3 | Mar 26 |
| Victoria Day | last Monday before May 25 | May 18 | May 24 |
| Canada Day | Jul 1, observed | Jul 1 | Jul 1 |
| BC Day | 1st Monday of Aug | Aug 3 | Aug 2 |
| Labour Day | 1st Monday of Sep | Sep 7 | Sep 6 |
| Truth & Reconciliation | Sep 30, observed | Sep 30 | Sep 30 |
| Thanksgiving | 2nd Monday of Oct | Oct 12 | Oct 11 |
| Remembrance Day | Nov 11, observed | Nov 11 | Nov 11 |
| Christmas Day | Dec 25, observed | Dec 25 | **Dec 27** (Dec 25 is a Saturday) |

Any implementation must reproduce this table. Where holidays are used:
- **SitkaTools:** amber, read-only holiday chips on the calendar, with a 🏛️ Holidays toggle (on by default). The detail panel notes the nominal date when it shifted.
- **CropLabourWizard:** a 🏛️ Holiday chip on tasks that fall on one, a conflict banner, and a note in the Generate toast. Notify only, never reschedule.
- **Planned:** GeneralEvent and EquipmentWizard should warn the same way.
- The Labour & Cost Wizard uses them only to take holidays out of roster capacity in Reports.

## Tool Registry

| Tool | Directory | What it does |
|---|---|---|
| SitkaTools | `SitkaTools/` | Hub: lots, rooms, buildings, the calendar, load and save |
| GeneralEvent | `GeneralEvent/` | Standalone calendar events (text, date, emoji) |
| CropLabourWizard | `CropLabourWizard/` | Crop schedules from task recipes, projections, labour estimates, input price list |
| EquipmentWizard | `EquipmentWizard/` | Equipment maintenance schedules and equipment power |
| Labour & Cost Wizard | `EmployeeWizard/` | Roster, time off, hours on tasks, 📜 Labour Log, ⚡ Power & Rates, 📊 Reports, total cost per gram and the monthly CTLS numbers |
| DailyWizard | `DailyWizard/` | Per-building daily lists with check-offs, ⏲ timers, ⏱ hours, ⏰ Still open and ✅ Mark done, translations, step pictures and videos |
| PaperWizard | `PaperWizard/` | Fills controlled paperwork through wizards, prints it over the form's page images, and keeps corrections traceable (struck-out values, initials, 📝 Change log) |

Don't add details, APIs or schemas for a planned tool until asked.

## UI Standards — All Tools

- **Theme:** copy these variables into every tool.
  ```css
  :root {
      --bg-primary: #1a1a2e; --bg-secondary: #16213e; --bg-card: #0f3460;
      --accent: #53d8a8; --accent-hover: #3fb98b;
      --text-primary: #e8e8e8; --text-secondary: #a8a8b8; --border: #2a2a4a;
      --danger: #e74c3c; --danger-hover: #c0392b; --warning: #f39c12;
      --input-bg: #1a1a3e; --radius: 8px; --shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  ```
- **Layout, top to bottom:** a sticky header (the tool's name on the left; an **Active Lot** or **Active Room** dropdown on the right, or nothing for a tool not scoped to lots or rooms), the tool's content, and a sticky footer holding only **Close Tool** (changes sync on their own).
- Lot dropdown: "— Select a lot —" first, then `id — name (strain)`. Room dropdown: "— Select a room —", then `id — name`.
- Shared component styles (`.form-group`, `.btn`, `.btn-secondary`, `.db-btn`, toasts) and the `DB` object pattern (`data`, `lots`/`rooms`/`buildings` getters, `ensureStructure()`, `sync()`) are the same in every tool: copy them from an existing one.
- Layouts must work on tablets in grow rooms: high contrast, large tap targets, Grid / Flexbox.

## Development Conventions

### HTML
- Self-contained; semantic HTML5 where it fits. A header comment names the tool, its purpose and its DB keys.
- **Cultivation Modules card** (bottom of SitkaTools.html): one `module-link` per tool with a relative `../<Tool>/<Tool>.html` path (never absolute or `file://`), an emoji, the name and a one-line description matching the Tool Registry.

### JavaScript
- `type="module"` scripts are fine. No `async`/`await` on network calls (there are none).
- **Browser storage** is used only by the user-approved IndexedDB `sitkatools` (v3): remembered DB folder handles (`folders`) and the self-deleting shared working copy (`work`). The `settings` store exists only so older stored data can be deleted; store nothing new there. Everything works without IndexedDB except folder memory and the tablet hand-off.
- File I/O: `<input type="file">` to read, `URL.createObjectURL()` + `<a download>` to export. **Save DB always shows its popup with the right-click Save Link As… link** (Edge users save under custom names that way, and it works on PCs that block downloads). Never replace it with `showSaveFilePicker` or a direct download. The unsaved flag clears when the link is used (clicked, right-clicked or tapped), not when the popup opens.

### JSON
- ISO `YYYY-MM-DD` dates in data; stable string ids.

### Tests
- `node tests/run.mjs [filter]` runs every `tests/*.test.mjs` in headless Firefox over WebDriver BiDi, with the repo served on 127.0.0.1: real clicks, real pen strokes, real right-click save links. Needs Node 22+ and Firefox (`FIREFOX=/path/to/firefox` if it isn't on the PATH). No npm packages.
- Tests use the made-up DB in `tests/lib/helpers.mjs` (`fixtureDb()`) and never touch real DB files.
- They cover saving and merging (single file, split files, tablet tabs, the office and a building on the same task, lost links, Wages.json added later, restoring a session closed without saving), every tool's main flows, the cost inputs (supplies charged at a task included) and a hand-worked cost per gram, a hand-worked CTLS month (filing and who plants went to included), PaperWizard's repeating tables, corrections, number answers, grow-log changes on edited days and closing the wizard only by its ✕, DailyWizard's timers, floor manager PINs (and their sign-off for hours typed in the Tasks tab), lots locked to their grow log, the day rolling over, and every tool opening without page errors.
- Run them before any change to saving, merging or the postMessage protocol goes out.
