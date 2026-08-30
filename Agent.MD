# SitkaGit — Cannabis Cultivation Tracking Suite

## Project Overview

A collection of standalone, single-file HTML tools for tracking licensed cannabis cultivation. Each tool lives in its own directory and operates entirely client-side (browser sandbox, no server required). All tools contribute data to a shared JSON database that feeds a unified calendar view.

### Core Principles

- **Single-file tools:** Every tool is a single `.html` file with embedded CSS and JavaScript — no build step, no dependencies, no server.
- **Browser sandbox only:** Tools run by opening the HTML file directly in a browser (`file://` protocol). No `fetch()` to external origins, no WebSocket, no server communication.
- **Modular & decoupled:** Tools do NOT communicate with each other. Shared state is mediated exclusively through the JSON database file on disk.
- **No frameworks:** Vanilla HTML/CSS/JavaScript only. No bundlers, no npm packages, no transpilers.

## Architecture

### Directory Structure

```
SitkaGit/
├── Agent.MD                  # This file — project instructions for LLMs
├── SitkaTools/
│   └── SitkaTools.html       # Main hub: lot management + calendar viewer
├── <ToolName>/
│   └── <ToolName>.html       # Individual tool (pattern for all future tools)
└── ...                       # Additional tool directories
```

Each tool gets its own directory containing exactly one `.html` file named after the directory.

### Shared Database Format

All tools read from and write to a shared JSON database file with the naming convention:

```
DB-YY-MM-DD.json
```

- `YY` = 2-digit year (e.g., `26`)
- `MM` = 2-digit month (e.g., `01`)
- `DD` = 2-digit day (e.g., `15`)
- Example: `DB-26-08-03.json`

The main tool (`SitkaTools.html`) provides a file import UI so the user can load the current database. Individual tools may export/write updates to this same format.

#### Database Schema (Conceptual)

```json
{
  "lots": {
    "<LotID>": {
      "name": "string",
      "strain": "string",
      "stage": "string",
      "createdDate": "YYYY-MM-DD",
      "closedDate": "YYYY-MM-DD | null",
      "destRoom": "string | null",   // flower room name (also tracked in rooms.<roomId>.assignedLots)
      "vegRoom": "string | null",    // vegetating room name (set at lot creation, new lots only)
      "cloningRoom": "string | null",// cloning room name (set at lot creation, new lots only)
      "_tool_<ToolName>": { ... }
    }
  },
  "calendarEvents": [
    {
      "lotId": "string",
      "date": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD | null",
      "title": "string",
      "sourceTool": "string"
    }
  ],
  "_<ToolName>": { ... }
}
```

- Each tool writes its own key under `_tool_<ToolName>` within a lot, or at the top level as `_<ToolName>`.
- Tools only read/write their own keys — they do not modify other tools' data.
- Calendar events are append-only; each event records which tool generated it via `sourceTool`.

#### Multi-Day Events

Calendar events support an optional `endDate` field for events that span consecutive days:

- **`date`** (required): The start date of the event (`YYYY-MM-DD`).
- **`endDate`** (optional): The end date of the event (`YYYY-MM-DD`). If omitted or equal to `date`, the event is a single-day event.
- **Calendar rendering:** The calendar grid displays the event on every day within the `[date, endDate]` range (inclusive). Multi-day events receive visual styling: the start day has a left border and bold text, the end day has a right border, and intermediate days have no rounded corners.
- **Drag-and-drop:** When a multi-day event is dragged to a new date, the duration (offset between `date` and `endDate`) is preserved.
- **Event panel:** The event detail panel exposes both `date` and `endDate` as modifiable date inputs.
- **Terminal view:** Multi-day events display as `start → end` in the terminal list.
- **Subtools:** When creating a multi-day event, only set `endDate` if it differs from `date`. Tools like GeneralEvent provide an optional "End Date" input for this purpose.

### Cross-Window Database Workflow — postMessage Convention

**Mechanism:** Subtools open as new browser windows via `window.open()`. The main app sends the current database to the subtool via `postMessage` immediately after opening. The subtool receives the DB, acknowledges with a ready message, and sends updates back via `postMessage` after every mutation. The main app auto-refreshes all views when it receives an update — no manual sync needed.

**Why postMessage instead of localStorage:** On `file://` protocol, browsers (especially Firefox) give each file path a unique origin sandbox, so localStorage at `/SitkaTools/SitkaTools.html` cannot be read from `/GeneralEvent/GeneralEvent.html`. The `storage` event also never fires across different origins. `postMessage` works reliably across `file://` windows.

**Message protocol (all tools use these exact message types):**
```js
// SitkaTools → Subtool: Send database on open
{ type: 'sitkaGit_db', payload: DB.data }

// Subtool → SitkaTools: Acknowledge receipt
{ type: 'sitkaGit_ready' }

// Subtool → SitkaTools: Send database after mutation
{ type: 'sitkaGit_db_update', payload: DB.data }
```

#### Rules

1. **postMessage is the primary cross-window data channel.** SitkaTools sends the full DB payload when opening a subtool; subtools receive it via a `message` event listener and acknowledge with `sitkaGit_ready`.
2. **Subtools open as new windows.** Use `window.open(url, '_blank')` — keep a reference to the returned window object for sending messages.
3. **Main app auto-refreshes on updates.** When SitkaTools receives a `sitkaGit_db_update` message, it replaces its DB data and re-renders all views automatically. A toast appears confirming the sync (auto-dismisses after 3 seconds).
4. **Subtools notify after every mutation.** After adding/deleting/editing data, call `notifySitkaTools()` which posts the updated DB back to the opener window.
5. **Retry mechanism for initial DB delivery.** SitkaTools retries sending the DB up to 5 times at 200ms intervals until the subtool acknowledges with `sitkaGit_ready`.
6. **No localStorage, sessionStorage, IndexedDB, or cookies in subtools.** All cross-window state flows through postMessage.

#### SitkaTools Module Link Handler Pattern

In SitkaTools.html, when a module link is clicked:

```js
// ---- Module Link Handlers — postMessage Convention ----
let openSubtools = [];

document.querySelectorAll('.module-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        openModuleInTab(link.href);
    });
});

function openModuleInTab(url) {
    const newWindow = window.open(url, '_blank');
    if (!newWindow) return;

    openSubtools.push(newWindow);

    // Track close with interval fallback (close event unreliable on file://)
    const closeCheck = setInterval(() => {
        if (newWindow.closed) {
            openSubtools = openSubtools.filter(w => w !== newWindow);
            clearInterval(closeCheck);
        }
    }, 1000);

    // Send DB via postMessage with retry mechanism
    const dbPayload = DB.data || { lots: {}, rooms: {}, calendarEvents: [] };
    let attempts = 0, acknowledged = false;

    function trySend() {
        if (acknowledged || newWindow.closed || attempts >= 5) return;
        attempts++;
        newWindow.postMessage({ type: 'sitkaGit_db', payload: dbPayload }, '*');
    }

    // Listen for acknowledgment from subtool
    const ackHandler = (e) => {
        if (e.source === newWindow && e.data?.type === 'sitkaGit_ready') {
            acknowledged = true;
            window.removeEventListener('message', ackHandler);
        }
    };
    window.addEventListener('message', ackHandler);

    // Initial send + retry at 200ms intervals
    trySend();
    const retryTimer = setInterval(() => {
        if (acknowledged || newWindow.closed) clearInterval(retryTimer);
        else trySend();
    }, 200);
}
```

#### SitkaTools Sync Toast Pattern

In SitkaTools.html, listen for subtool updates via postMessage:

```html
<!-- Sync Toast — appears when a subtool updates the database (auto-synced) -->
<div class="sync-toast hidden" id="syncToast">
    <span class="sync-toast-icon">🔄</span>
    <span class="sync-toast-text" id="syncToastText">Subtool has updated data — views refreshed automatically</span>
</div>
```

```js
const syncToast = $('syncToast');
const syncToastText = $('syncToastText');

// Listen for subtool updates via postMessage
window.addEventListener('message', (e) => {
    if (e.data?.type !== 'sitkaGit_db_update' || !e.data.payload) return;

    DB.data = e.data.payload;
    DB.ensureStructure();

    // Re-render all views with fresh data
    updateStatusBar();
    renderLotList();
    updateLotIdSuggestion();
    RoomManager.renderRoomList();
    updateRoomStatusBar();
    RoomManager.updateRoomDatalist();
    Calendar.render();
    updateCalendarStatusBar();

    syncToastText.textContent = 'Subtool has updated data — views refreshed automatically';
    syncToast.classList.remove('hidden');
    // Auto-dismiss after 3 seconds
    setTimeout(() => syncToast.classList.add('hidden'), 3000);
});
```

#### Subtool postMessage Pattern

Every subtool includes this pattern at the top of its script block:

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

        // Reconcile and render with fresh data (tool-specific calls vary by subtool)
        updateStatusBar();
        showToast('Database loaded from SitkaTools');
    }
});
```

**After every mutation (add/delete/edit), call:**
```js
notifySitkaTools();
```

This tool uses **no localStorage, sessionStorage, IndexedDB, cookies, or any browser storage APIs**. All cross-window state flows through postMessage.

#### Sync Toast CSS (Shared Across All Tools)

Include these styles in SitkaTools.html:

```css
.sync-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--bg-secondary);
    border: 2px solid var(--accent);
    border-radius: 10px;
    padding: 16px 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 16px;
    animation: slideInToast 0.3s ease-out;
}

.sync-toast.hidden { display: none; }

@keyframes slideInToast {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

.sync-toast-icon { font-size: 1.5rem; }

.sync-toast-text { color: var(--text-primary); font-size: 0.9rem; }
```

#### Why This Workflow Is Preferred

- **Zero manual steps** — no overlays, no file dialogs, no "Save Link As" popups for data transfer
- **Real-time awareness** — main app auto-refreshes all views when subtool sends postMessage update
- **Auto-dismiss toast** — confirmation toast appears and disappears after 3 seconds
- **postMessage works on `file://` protocol** — reliable cross-window communication even in browser sandbox
- **Retry mechanism** ensures DB delivery to subtool even if it loads slowly

### Main Tool — SitkaTools.html

The central hub with two modes:

1. **Lot Management:** Create new cultivation lots and close out completed lots. Each lot gets a unique ID tracked in the database.
2. **Calendar View:** Import the `DB-YY-MM-DD.json` file and render all calendar events from all tools in a unified calendar interface.

### Subtools — Popup Window Convention

All subtools (GeneralEvent, CropLabourWizard, EquipmentWizard) open as centered popup windows from SitkaTools.html. They launch at **half the main app's viewport width** and **83% of the viewport height**. Each subtool's UI should be designed to fit comfortably within this window size.

## BC Civic Holidays

The calendar must be aware of British Columbia's **11 civic (statutory) holidays**, per the BC Employment Standards Act. Every holiday date is a pure function of its year — no external data, no network calls, consistent with the suite's browser-sandbox constraints. The final implementation will render holidays on the calendar as if they were calendar events, and tools that generate dated events will notify the user when an event falls on a holiday (see "Planned Holiday-Awareness Behavior" below).

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
### Holiday-Awareness Behavior

- **Calendar (SitkaTools) — implemented:** Each of the 11 holidays is rendered on the calendar grid by default, visually distinct from tool-generated events (amber holiday chips). Holidays are computed per year and are read-only — they are not stored in the database. Clicking a holiday chip opens a read-only detail panel; when a fixed-date holiday shifts to its observed date, the panel notes the nominal date. A "🏛️ Holidays" toggle in the calendar nav (on by default) hides/shows all holiday chips.
- **CropLabourWizard — implemented:** Each task's computed date is checked against the 11 holidays for that year (observed dates; multi-day tasks are checked across their full range). Conflicting tasks get a small amber "🏛️ Holiday" chip next to their date in both the preview and saved schedule lists, plus a conflict banner listing all affected tasks. The generate toast notes how many tasks fall on holidays. Notify only — no auto-rescheduling.
- **Tools that generate dated events — planned (GeneralEvent, EquipmentWizard):** When an event's date matches a holiday (nominal or observed), notify the user that the event falls on a BC civic holiday. Tools do not auto-reschedule — they only notify.

## Tool Registry

| Tool | Directory | Status | Description |
|------|-----------|--------|-------------|
| SitkaTools | `SitkaTools/` | Core | Lot management + unified calendar viewer |
| GeneralEvent | `GeneralEvent/` | Active | Create standalone calendar events with text, date, and emoji |
| CropLabourWizard | `CropLabourWizard/` | Active | Crop labour hour and task tracking |
| EquipmentWizard | `EquipmentWizard/` | Starting | Equipment maintenance scheduling and tracking |

> **Note:** Planned tools have no implementation or design yet. Do not add speculative details, APIs, or schemas for planned tools until explicitly requested.

## UI Standards — All Tools

Every tool in the suite shares a common visual theme and structural conventions. These standards ensure consistency across all tool UIs and must be followed when creating or updating any tool.

### Theme Variables

All tools use the same CSS custom properties defined by the main app. Copy these `:root` variables into every tool's `<style>` block:

```css
:root {
    --bg-primary: #1a1a2e;
    --bg-secondary: #16213e;
    --bg-card: #0f3460;
    --accent: #53d8a8;
    --accent-hover: #3fb98b;
    --text-primary: #e8e8e8;
    --text-secondary: #a8a8b8;
    --border: #2a2a4a;
    --danger: #e74c3c;
    --danger-hover: #c0392b;
    --warning: #f39c12;
    --input-bg: #1a1a3e;
    --radius: 8px;
    --shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
```

### Page Structure

Every tool follows this layout (top to bottom):

```
┌─────────────────────────────────┐
│  Header (tool name + selector)  │  ← Sticky top bar
├─────────────────────────────────┤
│                                 │
│     Tool-specific content       │
│                                 │
├─────────────────────────────────┤
│  Footer (buttons)               │  ← Sticky bottom bar
└─────────────────────────────────┘
```

**All tools use the same footer:** Close Tool button only (subtools auto-sync via postMessage).

### Header — Active Lot / Room Selector (or None for Independent Tools)

The header is a sticky top bar that contains:
1. The tool's name as a logo/title on the left.
2. A dropdown selector on the right for choosing the **active Lot**, **active Room**, or no selector at all (depending on the tool's scope).

**For lot-focused tools** (CropLabourWizard):
- The dropdown lists all lots from `DB.data.lots`.
- Label: "Active Lot"
- First option: "— Select a lot —"

**For room-focused tools** (EquipmentWizard):
- The dropdown lists all rooms from `DB.data.rooms`.
- Label: "Active Room"
- First option: "— Select a room —"

**For independent tools** (or any future tool not scoped to lots or rooms):
- No dropdown selector in the header — the header contains only the tool name.
- Calendar events generated by the tool are not tied to any specific lot or room; they are scoped solely to the tool's own dictionary in the DB (e.g., `_AbsenceWizard`).

**Header HTML pattern (lot/room-focused tools):**
```html
<header class="header">
    <div class="header-left">
        <span class="logo">🐛 IPMWizard</span>
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

**Header HTML pattern (independent tools):**
```html
<header class="header">
    <div class="header-left">
        <span class="logo">🏖️ AbsenceManager</span>
    </div>
</header>
```

**Header CSS pattern:**
```css
.header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
}

.header-left { display: flex; align-items: center; gap: 24px; }

.logo {
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.5px;
}

.header-right { display: flex; gap: 8px; align-items: flex-end; }
```

### Footer — All Tools

All tools use the same footer: a sticky bottom bar with only the Close Tool button. Changes auto-sync to SitkaTools via postMessage.

**Footer HTML pattern:**
```html
<footer class="footer">
    <button class="btn btn-secondary" id="closeToolBtn">Close Tool</button>
</footer>
```

**Footer CSS pattern:**
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

**Footer JavaScript pattern:**
```js
// ---- Close Tool ----
$('closeToolBtn').addEventListener('click', () => window.close());
```

### Shared Component Styles

These styles are used by both header selectors and tool content forms. Include them in every tool:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.form-group label {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-weight: 500;
}

.form-group select {
    padding: 10px 12px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.95rem;
    transition: border-color 0.2s;
}

.form-group select:focus {
    outline: none;
    border-color: var(--accent);
}

.form-group select option {
    background: var(--bg-secondary);
    color: var(--text-primary);
}

.btn {
    padding: 10px 24px;
    border-radius: var(--radius);
    border: none;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-secondary {
    background: var(--bg-card);
    color: var(--text-primary);
    border: 1px solid var(--border);
}

.btn-secondary:hover { border-color: var(--text-secondary); }

.db-btn {
    padding: 8px 16px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
}

.db-btn:hover {
    border-color: var(--accent);
    background: rgba(83, 216, 168, 0.15);
}

.db-btn.export { color: var(--warning); }
```

### Popup Window Size

All subtools open as centered popup windows from SitkaTools.html at **half the main app's viewport width** and **83% of the viewport height**. Design the UI to fit comfortably within this window size.

### Shared Database Object Pattern

Every tool should include this JavaScript pattern for database handling:

```js
const DB = {
    data: null,
    fileName: '',

    get lots() { return this.data?.lots || {}; },
    get rooms() { return this.data?.rooms || {}; },

    ensureStructure() {
        if (!this.data) this.data = { lots: {}, rooms: {}, calendarEvents: [] };
        if (!this.data.lots) this.data.lots = {};
        if (!this.data.rooms) this.data.rooms = {};
        if (!this.data.calendarEvents) this.data.calendarEvents = [];
        return this.data;
    },

    // Sync all in-memory changes before export.
    // Call this BEFORE serializing DB.data for save.
    // Subtools override or extend this to flush any pending state (e.g., staged events, buffered edits).
    sync() {
        this.ensureStructure();
        return this.data;
    }
};

const $ = id => document.getElementById(id);
```

const $ = id => document.getElementById(id);
```

### Populating the Lot / Room Selector

After loading a database (or on initial render), populate the selector dropdown:

```js
// For lot-focused tools:
function populateLotSelector() {
    const sel = $('activeLot');
    sel.innerHTML = '<option value="">— Select a lot —</option>';
    for (const [id, lot] of Object.entries(DB.lots)) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${id} — ${lot.name || 'Unnamed'} (${lot.strain || '?'})`;
        sel.appendChild(opt);
    }
}

// For room-focused tools:
function populateRoomSelector() {
    const sel = $('activeRoom');
    sel.innerHTML = '<option value="">— Select a room —</option>';
    for (const [id, room] of Object.entries(DB.rooms)) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${id} — ${room.name || 'Unnamed'}`;
        sel.appendChild(opt);
    }
}
```

## Development Conventions

### HTML Files
- Self-contained: all CSS in `<style>` tags, all JS in `<script>` tags
- Semantic HTML5 elements where appropriate
- Responsive-friendly layout (tools may be used on tablets in grow rooms)

### Cultivation Modules Section (SitkaTools.html)
- The bottom of `SitkaTools.html` contains a "Cultivation Modules" card that links to all sibling tools
- All links use relative paths (`../<ToolName>/<ToolName>.html`) — never absolute or `file://` URLs
- Links have class `module-link` and are handled by JS: they open as centered popup windows via `window.open(url, '_blank', features)`
- Clicking a module link sends the current DB to the subtool via `postMessage` (type `sitkaGit_db`) after opening
- When adding a new module, add a link entry with class `module-link`, an emoji icon, tool name, and one-line description matching the Tool Registry
- Clear file header comment with tool name, purpose, and database keys used

### JavaScript
- `type="module"` scripts are acceptable for modern ES module features
- **postMessage is used for cross-window data sharing**: Main app sends DB payload to subtool via postMessage after opening; subtools send updates back via postMessage after every mutation. No localStorage, sessionStorage, IndexedDB, or cookies are used.
- File I/O via `<input type="file">` for reading and `URL.createObjectURL()` + `<a download>` for exporting
- No `async/await` on network calls — there are none

### CSS
- Modern CSS with custom properties (CSS variables) for theming
- Clean, readable grow-room-friendly contrast ratios
- Prefer CSS Grid/Flexbox for layouts

### JSON Database
- Always use ISO date strings (`YYYY-MM-DD`) for dates in data
- Use 2-digit year (`YY`) in filenames only
- Lot IDs should be stable strings (e.g., `LOT-001`, or a timestamp-based ID)
- When exporting, always include the full database state — tools should not produce partial diffs
