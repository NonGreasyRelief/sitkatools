# CropLabourWizard — Tool Context

## What This Tool Does

CropLabourWizard is a **crop schedule calculator** for licensed cannabis cultivation. Given a selected lot and an anchor date, it automatically computes and schedules every major cultivation task as calendar events based on editable day offsets from reference points. The user picks a lot, sets the anchor date, adjusts any task's day offset in the preview, and generates the entire grow-out timeline.

### Intended Use

- **Auto-schedule a full crop cycle:** Select a lot, enter the anchor date, and the tool calculates every downstream task — cloning, transplanting, topping, flipping to flower, pruning, leaf picks, clone cutting, harvest, bucking, trim, and room clean.
- **Preview & edit before committing:** See all computed tasks with their default dates, then adjust any task's day offset (including flip-to-flower, harvest timing, planting offset) before generating the final schedule.
- **Visualize labour demand:** All generated events appear on the shared calendar so the grower can see when tasks cluster across multiple lots.
- **Dynamic Day 0 anchor:** When Cutting Clones is enabled, the top date is the cloning date (Day 0) and planting offsets from it. When disabled, the top date becomes the planting date (Day 0). All downstream tasks cascade accordingly.

### Crop Schedule — Task Offsets from Reference Points

All dates cascade from reference points. The **Day 0 anchor** is dynamic:
- **Clones enabled:** Cloning date = Day 0, Planting offsets from cloning (default +14 days, editable)
- **Clones disabled:** Planting date = Day 0, Cutting Clones hidden

All day offsets are user-editable in the preview. Changing a reference point's offset (e.g., Flip to Flower or Harvest) cascades to all downstream tasks by the same delta.

| # | Task | Emoji | Reference Point | Default Offset | Editable? | Toggleable? |
|---|------|-------|-----------------|----------------|-----------|-------------|
| 0 | Cutting Clones | ✂️ | Cloning (Day 0) | Day 0 (locked) | No | **Yes** (enabled by default) |
| 1 | Planting Clones | 🌱 | Cloning (when clones on) / Planting (when clones off) | +14 from cloning / Day 0 (locked when clones off) | Yes (when clones on) | — |
| 2 | Topping | ✂️ | Planting | +3 days | Yes | — |
| 3 | Order Preventative Insects: Swirskii, Hypoaspis, Nematode, Atheta | 🐛 | Planting | +7 days | Yes | — |
| 4 | Transplanting to Flower Room | 🪴 | Planting | +14 days | Yes | — |
| 5 | Deploy IPM to Flower Room | 🛡️ | Planting | +15 days | Yes | — |
| 6 | Two-Node / Lollipop Prune | 🔪 | Planting | +20 days | Yes | — |
| 7 | Flip to Flower | 🌸 | Planting | +21 days | **Yes** (cascades to all bloom & harvest tasks) | — |
| 8 | Early Flower Leaf Pick | 🍃 | Flip | +21 days | Yes | — |
| 9 | Cutting Clones to Replace Lot | 🌿 | Flip | +42 days | Yes | — |
| 10 | Late Flower Leaf Pick | 🍂 | Flip | +42 days | Yes | — |
| 11 | Harvest | 🌾 | Flip | +56 days (8 weeks bloom) | **Yes** (cascades to all post-harvest tasks) | — |
| 12 | Grow-Room Clean | 🧹 | Harvest | +1 day | Yes | — |
| 13 | Dry Room Take-Down / Bucking | 📦 | Harvest | +10 days | Yes | — |
| 14 | Prepare Sample for Lab Testing | 🔬 | Harvest | +10 days | Yes | — |
| 15 | Trim | ✂️ | Harvest | +11 days → +7 days | Yes | — |

**Cascade behavior:** Adjusting the Flip to Flower offset shifts all flip-relative tasks (Early Leaf Pick, Clone Cut, Late Leaf Pick, Harvest) and all harvest-relative tasks (Room Clean, Bucking, Lab Sample, Trim) by the same delta. Similarly, adjusting the Harvest offset shifts all post-harvest tasks.

### Calendar Events Generated

CropLabourWizard appends events to the shared `calendarEvents` array using `"sourceTool": "CropLabourWizard"`. Each event has:

- **Title:** Emoji + task name + lot ID (e.g., `"🌸 Flip to Flower — LOT-001"`)
- **Date:** The computed date for the task (`YYYY-MM-DD`)
- **EndDate:** Set for multi-day events only (Trim). Omitted for single-day events.
- **SourceTool:** `"CropLabourWizard"`
- **LotId:** Always set to the selected lot ID — every event is scoped to a lot
- **TaskType:** A string identifier for the task (e.g., `"harvest"`, `"trim"`, `"flip"`) used during reconciliation to detect and replace stale schedules

### Schedule Reconciliation

When a user generates a schedule for a lot, the tool first **removes all existing CropLabourWizard events** for that lot from `calendarEvents` before inserting the new batch. This prevents duplicate or stale tasks when the planting date changes. The reconciliation logic matches on `sourceTool === 'CropLabourWizard'` AND `lotId === selectedLot`.

## BC Civic Holidays

This tool must be aware of British Columbia's **11 civic (statutory) holidays**. The canonical spec lives in the root `Agent.MD` ("BC Civic Holidays"); the full rules are reproduced below so this tool can be implemented from its own directory alone. Every holiday date is a pure function of its year — no external data, no network calls.

### Calculation Helpers

All date math must use **local-time** `Date` constructors (`new Date(y, m, d)`) — never UTC variants — to avoid off-by-one-day errors from time zones. Month indices are 0-based (`0`=Jan … `11`=Dec); weekday numbers follow `Date.getDay()` (`0`=Sun … `6`=Sat).

```js
// Add/subtract days (returns a new Date)
function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Nth occurrence of a weekday in a month (n is 1-based)
function nthWeekday(y, m, weekday, n) {
    const first = new Date(y, m, 1).getDay();
    return new Date(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
}

// Victoria Day — the last Monday strictly before May 25 (per BC ESA).
// Start from May 24 and walk back to the previous Monday.
function victoriaDay(y) {
    const d = new Date(y, 4, 24);
    while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
    return d;
}

// Observed-date shift — applies ONLY to fixed-date holidays:
// if the nominal date falls on Saturday or Sunday, the holiday is observed on the following Monday.
function observed(d) {
    const dow = d.getDay();
    if (dow === 6) return addDays(d, 2); // Sat → Mon
    if (dow === 0) return addDays(d, 1); // Sun → Mon
    return d;
}

// Easter Sunday — Gregorian computus (Anonymous / Meeus–Jones–Butcher algorithm)
function easterSunday(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
    return new Date(y, month - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
```

### The 11 Holidays and Their Rules

| # | Holiday | Rule | Calculation (JS) |
|---|---------|------|------------------|
| 1 | New Year's Day | Jan 1; observed on the following Monday if it falls on a weekend | `observed(new Date(y, 0, 1))` |
| 2 | Family Day | Third Monday in February | `nthWeekday(y, 1, 1, 3)` |
| 3 | Good Friday | Two days before Easter Sunday | `addDays(easterSunday(y), -2)` |
| 4 | Victoria Day | Last Monday strictly before May 25 | `victoriaDay(y)` |
| 5 | Canada Day | Jul 1; observed on the following Monday if it falls on a weekend | `observed(new Date(y, 6, 1))` |
| 6 | BC Day (Civic Holiday) | First Monday in August | `nthWeekday(y, 7, 1, 1)` |
| 7 | Labour Day | First Monday in September | `nthWeekday(y, 8, 1, 1)` |
| 8 | National Day for Truth and Reconciliation | Sep 30; observed on the following Monday if it falls on a weekend | `observed(new Date(y, 8, 30))` |
| 9 | Thanksgiving | Second Monday in October | `nthWeekday(y, 9, 1, 2)` |
| 10 | Remembrance Day | Nov 11; observed on the following Monday if it falls on a weekend | `observed(new Date(y, 10, 11))` |
| 11 | Christmas Day | Dec 25; observed on the following Monday if it falls on a weekend | `observed(new Date(y, 11, 25))` |

**Rules & edge cases:**
- BC does **not** observe Easter Sunday, Easter Monday, or Boxing Day (Dec 26) — per the BC government, these are not statutory holidays.
- Weekday-anchored holidays never need an observed-date shift: Family Day, Victoria Day, BC Day, Labour Day, and Thanksgiving are always Mondays; Good Friday is always a Friday. Only the five fixed-date holidays (New Year's Day, Canada Day, Truth & Reconciliation, Remembrance Day, Christmas Day) can shift to the following Monday.
- When a holiday shifts to its observed date, use the **observed** date for calendar display and for holiday checks — that is the day off.
- Holiday checks are always performed against the year of the event date being checked.

### Verification Table — Known Dates

Any implementation must reproduce this table exactly:

| Holiday | 2026 | 2027 |
|---------|------|------|
| New Year's Day | Jan 1 (Thu) | Jan 1 (Fri) |
| Family Day | Feb 16 (Mon) | Feb 15 (Mon) |
| Good Friday | Apr 3 (Fri) | Mar 26 (Fri) |
| Victoria Day | May 18 (Mon) | May 24 (Mon) |
| Canada Day | Jul 1 (Wed) | Jul 1 (Thu) |
| BC Day | Aug 3 (Mon) | Aug 2 (Mon) |
| Labour Day | Sep 7 (Mon) | Sep 6 (Mon) |
| Truth & Reconciliation | Sep 30 (Wed) | Sep 30 (Thu) |
| Thanksgiving | Oct 12 (Mon) | Oct 11 (Mon) |
| Christmas Day | Dec 25 (Fri) | **Dec 27 (Mon)** — observed; Dec 25 falls on a Saturday |
Remembrance Day | Nov 11 (Wed) | Nov 11 (Thu) |
| 
### Holiday-Awareness Behavior for CropLabourWizard

CropLabourWizard is holiday-aware in three places, all computed live from the year (no stored data):

1. **Task preview:** Each task row shows a small amber "🏛️ Holiday" chip next to its computed date when any day of the task falls on an observed BC civic holiday (multi-day tasks like Trim are checked across their full `[date, endDate]` range). The chip's tooltip names the holiday and, for shifted fixed-date holidays, notes the nominal date.
2. **Conflict banner:** When one or more tasks land on a holiday, a warning banner below the preview list enumerates each affected task with its date and holiday (e.g., "🌾 Harvest — 2026-12-25 falls on Christmas Day").
3. **Generate toast:** After generating a schedule, the confirmation toast appends "· ⚠️ N on a BC civic holiday" when any generated event conflicts.

The saved schedule list also shows the flag chip next to each task's date. The tool does **not** auto-reschedule or skip tasks — it only notifies. Holiday checks always use the observed date and the year of the task date being checked. The SitkaTools calendar renders the holidays themselves as if they were events.

## Relationship to SitkaTools

This tool is part of the SitkaGit suite. It operates as a standalone single-file HTML application with no communication to other tools. All shared state flows through the common JSON database file (`DB-YY-MM-DD.json`).

### How Data Fits Into the Database

CropLabourWizard reads and writes its own keys within the shared database, following the suite's decoupled convention:

**Per-lot data** (inside `lots.<LotID>`):
```
_tool_CropLabourWizard: { ... }
```
Stores the lot's schedule configuration: anchor date, task count, and trim days. Trim is fixed at 7 days. This lets the tool re-render its UI from stored state and detect stale schedules during reconciliation.

**Top-level data** (root of database):
```
_CropLabourWizard: { ... }
```
Tool-wide metadata — e.g., a count of lots with active schedules, or a global log of schedule generations for audit purposes.

**Calendar events:**
When the user generates a schedule, CropLabourWizard first purges all existing `CropLabourWizard` events for that lot from `calendarEvents`, then appends the new batch. Each event records `sourceTool: "CropLabourWizard"` and `lotId`. The main SitkaTools calendar view will render these alongside events from all other tools.

### Full Database Context

For reference, the complete database structure is defined in the root `Agent.MD`. Key points:
- Database file naming: `DB-YY-MM-DD.json`
- File I/O is user-managed via import (`<input type="file">`) and export (`URL.createObjectURL` + download)
- Tools never communicate with each other — only through the JSON file on disk
- Dates in data use ISO format (`YYYY-MM-DD`); filenames use 2-digit year (`YY`)

### Database Import on Open — postMessage Convention

CropLabourWizard receives its database from SitkaTools via `postMessage`, following the convention defined in the root `Agent.MD`.

**How it works:**
1. When SitkaTools.html launches CropLabourWizard, it opens the subtool in a new window then sends the current DB via `postMessage` with type `sitkaGit_db`.
2. On page load, CropLabourWizard listens for this message — no overlay, no file dialog, no manual import step.
3. After receiving the DB, CropLabourWizard acknowledges with `{ type: 'sitkaGit_ready' }` so SitkaTools stops retrying.
4. After every mutation (generate schedule / delete schedule), CropLabourWizard calls `notifySitkaTools()` which sends the updated DB back via `postMessage` with type `sitkaGit_db_update`.
5. The main app auto-refreshes all views and shows a toast notification that auto-dismisses after 3 seconds.
6. On init, CropLabourWizard calls `populateLotSelector()` to fill the Active Lot dropdown from `DB.lots`, then renders any existing schedules from `_tool_CropLabourWizard`.

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
        renderScheduleList();
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

- **Selector type:** Active Lot (lot-focused tool — labour hours are tracked per lot)
- **Popup size:** Opens from SitkaTools.html at half the main app's viewport width and 83% of the viewport height
- **Header:** Tool name "👷 Crop Labour Wizard" on the left, Active Lot dropdown on the right
- **Footer:** Close Tool button only (no Save DB — changes auto-sync to SitkaTools via postMessage)
- **Theme:** Uses shared CSS custom properties from root UI Standards

### Header Pattern

```html
<header class="header">
    <div class="header-left">
        <span class="logo">👷 Crop Labour Wizard</span>
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

```css
.footer {
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: sticky;
    bottom: 0;
    z-index: 100;
}
```

### Toast Pattern

Identical to GeneralEvent — centered bottom toast with accent border, auto-dismisses after 2.5 seconds:

```html
<div class="toast" id="toast"></div>
```

```css
.toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: var(--bg-card);
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 10px 24px;
    border-radius: var(--radius);
    font-size: 0.9rem;
    font-weight: 600;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s ease;
    z-index: 300;
}

.toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}
```

### Status Bar Pattern

Identical to GeneralEvent — top card showing database load status and event counts:

```html
<div class="status-bar" id="statusBar">
    <span id="statusText">No database loaded. Import a DB file or open from SitkaTools.</span>
</div>
```

```css
.status-bar {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 10px 16px;
    margin-bottom: 20px;
    font-size: 0.85rem;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.status-bar.loaded { border-color: var(--accent); }
```

## Constraints

- Single `.html` file, no build step, no external dependencies
- Runs in browser sandbox (`file://` protocol)
- Vanilla HTML/CSS/JavaScript only
- No network calls of any kind
- No localStorage, sessionStorage, IndexedDB, or cookies — all cross-window state via postMessage
