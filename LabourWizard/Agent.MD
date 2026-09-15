# LabourWizard — Tool Context

## What This Tool Does

LabourWizard is a **labour tracking and cost-reporting tool** for licensed cannabis cultivation. It sorts by lot to track the labour that goes into each task: who worked it, for how long, at what wage, and on which days. It manages a global roster of employees (regular work days + secret wages), books time-off as real calendar events, records daily man-hours against the tasks that other Labour wizards schedule onto the shared calendar, and (eventually) generates labour cost reports normalized **per plant** so lots of different room sizes can be compared.

### Intended Use

- **Manage an employee roster:** Keep a global list of employees with their ongoing weekly work schedule (which days of the week they normally work) and their wage. Wages are "secret" — stored in the main JSON DB but never shown on dashboards or other tools.
- **Book time off:** Give any employee booked-off absences — single-day, multi-day, or partial (a specific window of the day, e.g., 08:00–13:00). Booked-off days become real calendar events on the shared calendar so every tool can see them. Ongoing regular shifts do **not** create calendar events — only booked time off does.
- **Track daily labour per task:** For the selected lot, read the tasks that Labour wizards (currently CropLabourWizard) have placed on the calendar and record, day by day, which employees (or temp workers) worked how many hours on each task.
- **Report on labour cost:** Generate reports per crop, per day/week across all crops, and per task — always with a "per plant" normalization so different room sizes are comparable. (Reporting is the last implementation phase and may remain a stub for now.)

## Layout Overview

The tool has **two main tabs** — **Employees** and **Tasks** — plus a persistent **Labour Report** section below both panels. Each tab uses the same two-panel layout: a scrolling list on the left and an editor panel on the right whose contents depend on which tab is open and what is highlighted.

```
┌──────────────────────────────────────────────────────────────┐
│  Header: 👷 Labour Wizard            [ Active Lot ▾ ]        │
├──────────────────────────────────────────────────────────────┤
│  Status bar (DB load state)                                  │
├──────────────────────────────────────────────────────────────┤
│  [ Employees ]  [ Tasks ]          ← main tabs               │
├───────────────────────────┬──────────────────────────────────┤
│  Scrolling list           │  Editor panel                    │
│  (employees | tasks)      │  (depends on tab + selection)    │
│                           │                                  │
├───────────────────────────┴──────────────────────────────────┤
│  Labour Report section (spans full width, below both panels) │
└──────────────────────────────────────────────────────────────┘
```

- **Employees tab** — left: scrolling employee roster; right: week calendar (nothing selected) or the highlighted employee's editor / time-off view.
- **Tasks tab** — left: scrolling task list for the selected lot; right: the highlighted task's labour-map editor.
- **Labour Report** — always visible below the two panels, regardless of active tab.

## Employees Tab

### Left Panel — Employee Roster

- A scrolling list of all employees (global roster, not scoped to a lot).
- Each row shows the employee's name and a small red **✕** button to delete that employee, after a confirmation prompt.
- Clicking a row highlights it and loads that employee into the right editor panel.

### Right Panel — Week Calendar (no employee highlighted)

A generic **Mon–Sun "every week"** recurring-schedule overview. It does **not** represent any specific calendar week — no dates, no week navigation.

- A 7-column work-week calendar (Monday … Sunday).
- Under each day, the names of the employees whose ongoing `workDays` schedule includes that day.
- This is a "who works which days, every week" overview based purely on current recurring schedules. It does **not** show booked time off or any specific dates.

### Right Panel — Employee Editor (an employee is highlighted)

Top to bottom:

1. **Work-day toggles:** 7 buttons in a row (one per day, Mon–Sun). Each toggles **green** (works that day, ongoing) or **red** (off that day). This sets the employee's regular recurring schedule.
2. **Fields:** three inputs — **Name**, **Wage**, and **Confirm Wage**. The wage field defaults to **$20/hour**. There is only **one** secret wage; **Confirm Wage** exists purely as a re-type validation (it must match Wage before saving) so the value isn't set by accident. The wage is never displayed anywhere — it only lives in the JSON DB and is used for cost math.
3. **Actions:** two buttons — **Save Changes** (persists the employee) and **Request Time Off** (switches the panel to the Time-off view).

### Right Panel — Time-off View (entered via "Request Time Off")

- A calendar for creating **book-off events**. These become real calendar events on the shared calendar. They can be single-day, multi-day, or **partial — a specific window of the day** (e.g., 08:00–13:00). Partial bookings use start/end **time-of-day** fields, not an AM/PM toggle.
- The calendar visually distinguishes the employee's regular work days from booked-off days.
- Below the calendar: a list of that employee's existing time-off events (showing date range and, for partials, the time window), each with a small **✕** to delete it (which also removes the corresponding calendar event).

## Tasks Tab

### Left Panel — Task List (for the selected lot)

- A scrolling list of tasks related to the **selected lot** (from the header's Active Lot selector).
- Tasks are read from `calendarEvents` on that lot and identified **by source tool**: events whose `sourceTool` is a known labour-scheduling tool. For now that set is **`CropLabourWizard`** and **`EquipmentWizard`**. Events from other tools (e.g., GeneralEvent) are **not** tasks. The set of task source tools is a small constant in the code so more can be added later.
- The list is a simple terminal-style list that **defaults to today**. Completed/old tasks are hidden unless a **"Show completed"** checkbox is selected. When old tasks are shown, the list still defaults to "today" and you scroll up to reach older entries.

### Right Panel — Task Editor (a task is highlighted)

- Shows the task's details (title, date range, source tool).
- A **labour map** editor: assign employees to today's labour map, or modify previous days.
  - Pick an **existing employee** and enter time in **hours and minutes**, or
  - Fill in a **Temp employee** field (name + wage) — temps are assigned by name below where a regular employee would be selected.
- A control to **mark the task as completed** when it is finished.

**Temp workers:** Temps are **ephemeral** — they live only inside the task's `labourMap` entry and are never promoted into the global roster. Their hours **do** count toward labour reports; in any report a temp is displayed simply as **"Contractor"** (their inline name/wage stay in the DB for cost math).

## Labour Report Section (below both tabs)

Generate labour reports:

- Per crop (total recorded)
- Per day / week across all crops
- Per task (average across crops, per plant / individual events)
- Any other report a director might want

Reports provide insightful graphs on cost per task and cost trends by crop, strain, or room.

**Per-plant normalization:** When tracking how much a task costs or how long it took, always be able to figure out **per plant**, because different lots are for different-size rooms.

The plant count comes from the lot's existing **`plantCount`** field:

- If the lot has a **flower-room destination** and the report date is on/after the lot went into bloom, use the `plantCount` value tied to that bloom transition (the count as of bloom).
- Otherwise, use the lot's current `plantCount` at the time the report is generated.
- Dated plant-count tracking (recording how plant count changes over time) does **not** exist yet — this is future work. Until then, reports use the single `plantCount` value per the rules above.

> This section is implemented last and may remain a dummy stub in the initial build.

## Data Model (proposed)

All of LabourWizard's own state lives under its own keys in the main JSON DB. It never modifies other tools' data.

### Top-level — `_LabourWizard`

```json
{
  "_LabourWizard": {
    "defaultWage": 20,
    "employees": {
      "<employeeId>": {
        "name": "string",
        "workDays": [1, 2, 3, 4, 5],
        "wage": 20.0,
        "timeOff": [
          {
            "id": "string",
            "date": "YYYY-MM-DD",
            "endDate": "YYYY-MM-DD | null",
            "startTime": "HH:MM | null",
            "endTime": "HH:MM | null"
          }
        ]
      }
    }
  }
}
```

- `workDays` uses `Date.getDay()` numbers (`0`=Sun … `6`=Sat).
- `wage` is the **secret** wage — stored in the DB, used for cost math, but never rendered on any dashboard or other tool.
- `timeOff` entries mirror the calendar events created for them (kept in sync so the tool can list/delete an employee's absences).
- `startTime` / `endTime` are **null** for a full-day absence and set to `"HH:MM"` (24-hour) for a partial booking (e.g., `08:00`–`13:00`). A partial always applies to the first day of the range (`date`); multi-day ranges with a partial first day are allowed.

### Per-lot — `_tool_LabourWizard` (inside `lots.<LotID>`)

```json
{
  "_tool_LabourWizard": {
    "tasks": {
      "<calendarEventId>": {
        "completed": false,
        "labourMap": {
          "YYYY-MM-DD": [
            { "type": "employee", "employeeId": "string", "hours": 8, "minutes": 0 },
            { "type": "temp", "name": "string", "wage": 22.5, "hours": 4, "minutes": 30 }
          ]
        }
      }
    }
  }
}
```

- `labourMap` is keyed by individual day; each day maps to a list of entries (employee or temp) with hours worked.
- Regular employees resolve their wage from the global roster at report time; temps carry an inline wage.

### Calendar events — `calendarEvents` (append-only)

LabourWizard appends **time-off** events only (ongoing shifts never create events):

```json
{
  "lotId": null,
  "date": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD | null",
  "title": "🏖️ Time Off — <Employee Name>",
  "sourceTool": "LabourWizard",
  "taskType": "time_off",
  "employeeId": "string",
  "startTime": "HH:MM | null",
  "endTime": "HH:MM | null"
}
```

- `endDate` is set only for multi-day absences (omitted when equal to `date`).
- `startTime` / `endTime` are present only for partial bookings (a window of the day, e.g., `08:00`–`13:00`); omitted or null for full days. For a partial, the title may append the window (e.g., "🏖️ Time Off — Alex (08:00–13:00)").
- Deleting a time-off event removes both the roster entry and the calendar event.

## Implementation Order

1. **Popup shell + DB sync:** Make the app's popup consistent with the other tools; get the DB through postMessage following the standards in the root `Agent.MD`.
2. **Blank dummies:** Dummy of the Employees tab, dummy of the Tasks tab, and a blank dummy of the labour report at the bottom.
3. **Employees tab — fully functional.**
4. **Tasks tab — fully functional.**
5. **Labour reporting — last; may be left as a dummy stub.**

## Relationship to SitkaTools

This tool is part of the SitkaGit suite. It operates as a standalone single-file HTML application with no communication to other tools. All shared state flows through the common JSON database file (`DB-YY-MM-DD.json`).

### How Data Fits Into the Database

- **Top-level:** `_LabourWizard` — global employee roster, default wage, and tool-wide metadata.
- **Per-lot:** `_tool_LabourWizard` inside `lots.<LotID>` — per-task labour maps and completion flags for that lot's tasks.
- **Calendar events:** Time-off absences are appended to `calendarEvents` with `sourceTool: "LabourWizard"`. The main SitkaTools calendar renders these alongside events from all other tools.

### Full Database Context

For reference, the complete database structure is defined in the root `Agent.MD`. Key points:
- Database file naming: `DB-YY-MM-DD.json`
- File I/O is user-managed via import (`<input type="file">`) and export (`URL.createObjectURL` + download)
- Tools never communicate with each other — only through the JSON file on disk
- Dates in data use ISO format (`YYYY-MM-DD`); filenames use 2-digit year (`YY`)

### Database Import on Open — postMessage Convention

LabourWizard receives its database from SitkaTools via `postMessage`, following the convention defined in the root `Agent.MD`.

**How it works:**
1. When SitkaTools.html launches LabourWizard, it opens the subtool in a new window then sends the current DB via `postMessage` with type `sitkaGit_db`.
2. On page load, LabourWizard listens for this message — no overlay, no file dialog, no manual import step.
3. After receiving the DB, LabourWizard acknowledges with `{ type: 'sitkaGit_ready' }` so SitkaTools stops retrying.
4. After every mutation (add/edit/delete employee, book/delete time off, record labour, mark task complete), LabourWizard calls `notifySitkaTools()` which sends the updated DB back via `postMessage` with type `sitkaGit_db_update`.
5. The main app auto-refreshes all views and shows a toast notification that auto-dismisses after 3 seconds.
6. On init, LabourWizard populates the Active Lot selector from `DB.lots`, then renders the roster and any existing labour maps from its own keys.

**Implementation:**
```js
// ---- postMessage Convention — receive DB from SitkaTools, send updates back ----
DB.ensureStructure();

// Notify SitkaTools of changes via postMessage
function notifySitkaTools() {
    if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
            type: 'sitkaGit_db_update',
            payload: DB.data
        }, '*');
    }
}

// Listen for DB from SitkaTools via postMessage
window.addEventListener('message', (e) => {
    if (e.data?.type === 'sitkaGit_db' && e.data.payload) {
        DB.data = e.data.payload;
        DB.ensureStructure();

        // Acknowledge receipt so SitkaTools stops retrying
        if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'sitkaGit_ready' }, '*');
        }

        // Reconcile and render with fresh data
        populateLotSelector();
        renderEmployeeList();
        renderTaskList();
        updateStatusBar();
        showToast('Database loaded from SitkaTools');
    }
});

// After every mutation:
notifySitkaTools();
```

This tool uses **no localStorage, sessionStorage, IndexedDB, cookies, or any browser storage APIs**. All cross-window state flows through postMessage.

## UI Convention

This tool follows the shared UI Standards defined in the root `Agent.MD`. Key specifics for this tool:

- **Selector type:** Active Lot (lot-focused tool — tasks and labour are tracked per lot; the employee roster is global).
- **Popup size:** Opens from SitkaTools.html at half the main app's viewport width and 83% of the viewport height.
- **Header:** Tool name "👷 Labour Wizard" on the left, Active Lot dropdown on the right.
- **Footer:** Close Tool button only (no Save DB — changes auto-sync to SitkaTools via postMessage).
- **Theme:** Uses shared CSS custom properties from root UI Standards.

### Header Pattern

```html
<header class="header">
    <div class="header-left">
        <span class="logo">👷 Labour Wizard</span>
    </div>
    <div class="header-right">
        <div class="form-group">
            <label for="activeLot">Active Lot</label>
            <select id="activeLot">
                <option value="">— Select a lot —</option>
            </select>
        </div>
    </div>
</header>
```

### Footer Pattern

Identical to all other subtools:

```html
<footer class="footer">
    <button class="btn btn-secondary" id="closeToolBtn">Close Tool</button>
</footer>
```

### Toast Pattern

Centered bottom toast with accent border, auto-dismisses after 2.5 seconds:

```html
<div class="toast" id="toast"></div>
```

### Status Bar Pattern

Top card showing database load state and roster/task counts:

```html
<div class="status-bar" id="statusBar">
    <span id="statusText">No database loaded. Open from SitkaTools.</span>
</div>
```

## BC Civic Holidays

This tool must be aware of British Columbia's **11 civic (statutory) holidays**. The canonical spec lives in the root `Agent.MD` ("BC Civic Holidays"); the full rules, calculation helpers, and verification table are reproduced there so this tool can be implemented from its own directory alone. Every holiday date is a pure function of its year — no external data, no network calls.

### Holiday-Awareness Behavior for LabourWizard

LabourWizard is holiday-aware where it creates dated calendar events:

- **Time-off booking:** When a booked-off day (any day in a multi-day range) falls on an observed BC civic holiday, notify the user that the absence overlaps a holiday (e.g., "🏖️ Time Off — Alex falls on Labour Day (Sep 7)"). The tool does **not** auto-reschedule or block the booking — it only notifies.
- Holiday checks always use the **observed** date and the year of the event date being checked. The SitkaTools calendar renders the holidays themselves as if they were events.

## Constraints

- Single `.html` file, no build step, no external dependencies
- Runs in browser sandbox (`file://` protocol)
- Vanilla HTML/CSS/JavaScript only
- No network calls of any kind
- No localStorage, sessionStorage, IndexedDB, or cookies — all cross-window state via postMessage
- Wages are secret: stored and used for cost math, but never displayed on dashboards or in other tools

## Design Decisions

### Confirmed by user (final)

1. **Employee scope:** The roster is **global** across all lots.
2. **Week calendar behavior:** The no-selection week calendar is a generic **Mon–Sun "every week"** recurring-schedule overview — not tied to any current week, no dates, no navigation. It shows only ongoing schedules and does **not** concern itself with days off or booked time off.
3. **"Partial" time off:** A partial booking means the employee books off a **specific window of the day** (e.g., 08:00–13:00). Data model uses `startTime` / `endTime` (`HH:MM`, 24-hour) fields — not an AM/PM toggle.
4. **Wage fields:** There is **one secret wage**. The Confirm Wage field is purely a **re-type validation** (must match before saving) so the wage isn't set by accident. Wages are never displayed anywhere — they only exist in the JSON DB and drive cost math.
5. **Temp employees:** Temps are **not promoted** to the global roster — they live only in the task's `labourMap`. Their hours **do count** toward reports; in reports a temp is shown as **"Contractor"**.
6. **Task identification:** Tasks are identified **by source tool**. For now, events with `sourceTool` of **`CropLabourWizard`** or **`EquipmentWizard`** count as tasks (both create uniquely-tagged task events; they are not general events). GeneralEvent and other tools are excluded. The set is a code constant so it can grow.
7. **Per-plant count:** Uses the lot's existing **`plantCount`** field. If the lot has a flower-room destination, use the plant count tied to the lot going into bloom (for report dates on/after bloom); otherwise use the current `plantCount` at report time. Dated plant-count tracking is future work — not implemented now.

### Still open (defaults apply unless user says otherwise)

8. **Task completion storage:** The `completed` flag lives in `_tool_LabourWizard.tasks.<calendarEventId>` (per-lot), not on the calendar event. Marking complete only sets the flag — no calendar event is created or modified.
9. **Report scope (v1):** Reporting is the last phase and may remain a stub. When built: cost per task, cost trend over time, per crop/strain/room; no CSV export in v1.
10. **Multi-day time off:** One multi-day event with `endDate` (omitted when single day). Title format: "🏖️ Time Off — <Name>" (partial bookings may append the time window).
11. **Deleting an employee:** Their existing labour-map entries are **kept as historical cost data** (orphaned references remain; name/wage snapshots stay in the labour map).
12. **Time-off and lot scope:** Time-off events use `lotId: null` — absences are facility-wide, not tied to a lot.
