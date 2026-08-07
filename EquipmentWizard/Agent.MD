# EquipmentWizard — Tool Context

## What This Tool Does

EquipmentWizard is a **cyclical equipment maintenance scheduler** for licensed cannabis cultivation facilities. It automatically populates the shared calendar with recurring maintenance events for grow-room equipment, infrastructure, and systems on a per-room basis.

### Intended Use

- **Track equipment per room:** Assign equipment items (dehumidifiers, air conditioners, plumbing systems, irrigation layouts, drip lines, tables, etc.) to specific grow rooms. Each room maintains its own independent equipment inventory.
- **Define sub-tasks with intervals:** Under each equipment item, create maintenance sub-tasks (e.g., "replace filter", "clean drain pan", "tighten connections") with a configurable recurrence interval — measured in either **days** or **months**.
- **Auto-populate the calendar:** When a schedule is generated (or regenerated), the tool computes every occurrence of each sub-task over a **12-month forward window** from today and writes them as individual calendar events. This gives the grower full visibility into upcoming maintenance demand.
- **Retroactive scheduling:** When adding equipment mid-cycle, the user can set a "start date" in the past (retroactively). The tool will back-fill any occurrences from that start date up to today, then continue projecting forward 12 months. This ensures the schedule reflects the true maintenance cadence even if tracking starts late.
- **Regenerate on demand:** The user can regenerate the schedule at any time — the tool purges all existing EquipmentWizard events for the selected room and recomputes from scratch. This keeps the calendar clean when intervals change or equipment is removed.

### Equipment & Maintenance Model

The data model has three levels:

1. **Room** — a grow room from `DB.rooms` (e.g., "Flower Room A", "Clone Room B"). Equipment is scoped to rooms, not lots.
2. **Equipment** — an item or system installed in a room. Each equipment entry has:
   - A name (free text) or a type selected from a dropdown of common types
   - A unique ID for tracking
   - An optional "installed date" for reference
3. **Maintenance Sub-Task** — a recurring task under an equipment item. Each sub-task has:
   - A name (e.g., "Replace Filter", "Clean Drain Pan")
   - An interval value (number) and unit (`days` or `months`)
   - A start date (the first occurrence; can be in the past for retroactive scheduling)
   - An emoji icon for calendar display

### Common Equipment Types (Dropdown)

The tool provides a dropdown of pre-defined equipment types for quick selection, but also allows free-text entry for custom types:

| Category | Examples |
|----------|----------|
| **Dehumidifier** | Dehumidifier — Filter Replacement, Dehumidifier — Drain Cleaning, Dehumidifier — Annual Performance Measurement, Dehumidifier — Coil Cleaning |
| **Air Conditioner** | AC — Filter Replacement, AC — Condenser Cleaning, AC — Drain Line Cleaning, AC — Refrigerant Check |
| **Plumbing** | Plumbing — Tighten Connections, Plumbing — Leak Inspection, Plumbing — Valve Service |
| **Irrigation** | Irrigation — Dripper Replacement, Irrigation — Layout Inspection, Irrigation — Line Flush, Irrigation — Timer Calibration |
| **Infrastructure** | Table — Leak Check, Table — Level Adjustment, HVAC — General Inspection |

### Calendar Events Generated

EquipmentWizard appends events to the shared `calendarEvents` array using `"sourceTool": "EquipmentWizard"`. Each event has:

- **Title:** Emoji + sub-task name + equipment name + room name (e.g., `"🔧 Replace Filter — Dehumidifier #1 — Flower Room A"`)
- **Date:** The computed date for this maintenance occurrence (`YYYY-MM-DD`)
- **SourceTool:** `"EquipmentWizard"`
- **RoomId:** Always set to the room ID — every event is scoped to a room
- **EquipmentId:** The ID of the parent equipment item, used during reconciliation
- **TaskType:** `"equipment_maintenance"` — used during reconciliation to detect and replace stale schedules

### Schedule Reconciliation

When a user generates (or regenerates) a schedule for a room, the tool first **removes all existing EquipmentWizard events** for that room from `calendarEvents` before inserting the new batch. This prevents duplicate or stale events when intervals change, equipment is removed, or the 12-month window rolls forward. The reconciliation logic matches on `sourceTool === 'EquipmentWizard'` AND `roomId === selectedRoom`.

### Scheduling Algorithm

For each sub-task in a room:
1. Start from the sub-task's `startDate`
2. Compute occurrences by adding the interval (days or months) repeatedly
3. Collect all occurrences that fall within `[startDate, today + 12 months]`
4. Each occurrence becomes a calendar event

Month-based intervals use calendar-month arithmetic (e.g., Jan 15 + 3 months = Apr 15). Day-based intervals use simple day addition.

## Relationship to SitkaTools

This tool is part of the SitkaGit suite. It operates as a standalone single-file HTML application with no communication to other tools. All shared state flows through the common JSON database file (`DB-YY-MM-DD.json`).

### How Data Fits Into the Database

EquipmentWizard reads and writes its own keys within the shared database, following the suite's decoupled convention:

**Per-lot data** (inside `lots.<LotID>`):
```
_tool_EquipmentWizard: { ... }
```
Each lot can have its own equipment-related dictionary. The tool writes only to this key and does not touch other keys in the lot entry or other lots.

**Top-level data** (root of database):
```
_EquipmentWizard: { ... }
```
Tool-wide state that isn't scoped to a specific lot lives under this top-level key.

**Calendar events:**
When EquipmentWizard generates reminders (e.g., "scheduled maintenance", "equipment inspection due"), it appends events to the shared `calendarEvents` array using `"sourceTool": "EquipmentWizard"`. The main SitkaTools calendar view will render these alongside events from all other tools.

### Full Database Context

For reference, the complete database structure is defined in the root `Agent.MD`. Key points:
- Database file naming: `DB-YY-MM-DD.json`
- File I/O is user-managed via import (`<input type="file">`) and export (`URL.createObjectURL` + download)
- Tools never communicate with each other — only through the JSON file on disk
- Dates in data use ISO format (`YYYY-MM-DD`); filenames use 2-digit year (`YY`)

### Database Import on Open — postMessage Convention

EquipmentWizard receives its database from SitkaTools via `postMessage`, following the convention defined in the root `Agent.MD`.

**How it works:**
1. When SitkaTools.html launches EquipmentWizard, it opens the subtool in a new window then sends the current DB via `postMessage` with type `sitkaGit_db`.
2. On page load, EquipmentWizard listens for this message — no overlay, no file dialog, no manual import step.
3. After receiving the DB, EquipmentWizard acknowledges with `{ type: 'sitkaGit_ready' }` so SitkaTools stops retrying.
4. After every mutation (add/delete/edit), EquipmentWizard calls `notifySitkaTools()` which sends the updated DB back via `postMessage` with type `sitkaGit_db_update`.
5. The main app auto-refreshes all views and shows a toast notification that auto-dismisses after 3 seconds.
6. On init, EquipmentWizard calls `populateRoomSelector()` to fill the Active Room dropdown from `DB.rooms`, then renders its UI.

**Implementation:**
```js
// ---- postMessage Convention ----
DB.ensureStructure();

function notifySitkaTools() {
    if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
            type: 'sitkaGit_db_update',
            payload: DB.data
        }, '*');
    }
}

window.addEventListener('message', (e) => {
    if (e.data?.type === 'sitkaGit_db' && e.data.payload) {
        DB.data = e.data.payload;
        DB.ensureStructure();
        if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'sitkaGit_ready' }, '*');
        }
        populateRoomSelector();
        showToast('Database loaded from SitkaTools');
    }
});

// After every mutation:
notifySitkaTools();
```

This tool uses **no localStorage, sessionStorage, IndexedDB, cookies, or any browser storage APIs**. All cross-window state flows through postMessage.

## UI Convention

This tool follows the shared UI Standards defined in the root `Agent.MD`. Key specifics for this tool:

- **Selector type:** Active Room (room-focused tool — equipment maintenance is tracked per room)
- **Popup size:** Opens from SitkaTools.html at half the main app's viewport width and 83% of the viewport height
- **Header:** Tool name "🔧 EquipmentWizard" on the left, Active Room dropdown on the right
- **Footer:** Close Tool button only (no Save DB — changes auto-sync to SitkaTools via postMessage)
- **Theme:** Uses shared CSS custom properties from root UI Standards

**Footer implementation:**
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
    justify-content: space-between;
    position: sticky;
    bottom: 0;
    z-index: 100;
}
```
```js
// ---- Close Tool ----
$('closeToolBtn').addEventListener('click', () => window.close());
```

## Constraints

- Single `.html` file, no build step, no external dependencies
- Runs in browser sandbox (`file://` protocol)
- Vanilla HTML/CSS/JavaScript only
- No network calls of any kind
