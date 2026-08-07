# CropLabourWizard — Tool Context

## What This Tool Does

CropLabourWizard is a **crop schedule calculator** for licensed cannabis cultivation. Given a selected lot and a desired planting date, it automatically computes and schedules every major cultivation task as calendar events based on fixed offsets from the anchor date. The user picks a lot, sets the planting date, configures a few variables (bloom duration, trim length), and the tool generates the entire grow-out timeline.

### Intended Use

- **Auto-schedule a full crop cycle:** Select a lot, enter the planting date, and the tool calculates every downstream task — transplanting, topping, flipping to flower, pruning, leaf picks, clone cutting, harvest, bucking, trim, and room clean.
- **Visualize labour demand:** All generated events appear on the shared calendar so the grower can see when tasks cluster across multiple lots.
- **Adjust per-lot variables:** Bloom duration (8 or 9 weeks) and trim length are configurable per lot since they vary by strain and yield.

### Crop Schedule — Task Offsets from Planting Date

All dates are computed from the user-provided **planting date** (Day 0). The vegetative period is fixed at 21 days (transplant at day 14, flip at day 21). Bloom events are offset from the flip-to-flower date. Post-harvest events are offset from the harvest date.

| # | Task | Emoji | Offset From | Computed Date | Multi-Day? |
|---|------|-------|-------------|---------------|------------|
| 1 | Planting clones | 🌱 | — | User-set anchor date | No |
| 2 | Topping | ✂️ | 3 days after planting clones | Day 3 | No |
| 3 | Order Preventative Insects: Swirskii, Hypoaspis, Nematode, Atheta | 🐛 | 7 days after planting | Day 7 | No |
| 4 | Transplanting to Flower Room | 🪴 | +14 days from planting | Day 14 | No |
| 5 | Deploy IPM to Flower Room | 🛡️ | Day after transplant to flower room | Day 15 | No |
| 6 | Flip to Flower | 🌸 | +7 days from transplanting (= +21 days from planting) | Day 21 | No |
| 7 | Two-Node / Lollipop Prune | 🔪 | 1 day before flip to flower | Day 20 | No |
| 8 | Early Flower Leaf Pick | 🍃 | 3 weeks into bloom (= +21 days from flip) | Day 42 | No |
| 9 | Cutting Clones to Replace Lot | 🌿 | Start of week 6 of bloom (= +28 days from flip) | Day 49 | No |
| 10 | Late Flower Leaf Pick | 🍂 | 6 weeks into bloom (= +42 days from flip) | Day 63 | No |
| 11 | Harvest | 🌾 | User-selectable: 8 or 9 weeks into bloom (= +56 or +63 days from flip) | Day 77 or 84 | No |
| 12 | Grow-Room Clean | 🧹 | Day after harvest starts | Harvest + 1 day | No |
| 13 | Dry Room Take-Down / Bucking | 📦 | 10 days after harvest start date | Harvest + 10 days | No |
| 14 | Trim | ✂️ | Starts the day after bucking ends; duration set by user (range: 2–5 days, default 3) | Bucking + 1 day → +N days | **Yes** (multi-day event) |

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

## Relationship to SitkaTools

This tool is part of the SitkaGit suite. It operates as a standalone single-file HTML application with no communication to other tools. All shared state flows through the common JSON database file (`DB-YY-MM-DD.json`).

### How Data Fits Into the Database

CropLabourWizard reads and writes its own keys within the shared database, following the suite's decoupled convention:

**Per-lot data** (inside `lots.<LotID>`):
```
_tool_CropLabourWizard: { ... }
```
Stores the lot's schedule configuration: planting date, bloom duration (8 or 9 weeks), trim days range, and a list of generated task IDs. This lets the tool re-render its UI from stored state and detect stale schedules during reconciliation.

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
