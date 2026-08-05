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
      "_tool_<ToolName>": { ... }
    }
  },
  "calendarEvents": [
    {
      "lotId": "string",
      "date": "YYYY-MM-DD",
      "type": "string",
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

        // Reconcile and render with fresh data
        reconcileLog();
        renderEventList();
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

.sync-toast-btn {
    background: var(--accent);
    color: var(--bg-primary);
    border: none;
    padding: 8px 20px;
    border-radius: var(--radius);
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
}

.sync-toast-btn:hover { background: var(--accent-hover); }
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

All subtools (IPMWizard, FertilizerWizard, CloningWizard, LabourWizard, EquipmentWizard, AbsenceWizard) open as centered popup windows from SitkaTools.html. They launch at **half the main app's viewport width** and **66% taller than the viewport height**. Each subtool's UI should be designed to fit comfortably within this window size.

## Tool Registry

| Tool | Directory | Status | Description |
|------|-----------|--------|-------------|
| SitkaTools | `SitkaTools/` | Core | Lot management + unified calendar viewer |
| IPMWizard | `IPMWizard/` | Starting | Quickly populate your calendar with IPM order and application dates |
| FertilizerWizard | `FertilizerWizard/` | Starting | Fertilizer cost and usage tracking per lot |
| CloningWizard | `CloningWizard/` | Starting | Clone cutting schedule based on lot progression |
| LabourWizard | `LabourWizard/` | Starting | Labour hour and task tracking |
| EquipmentWizard | `EquipmentWizard/` | Starting | Equipment maintenance scheduling and tracking |
| AbsenceWizard | `AbsenceWizard/` | Starting | Staff absence and vacation calendar notifications |

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
│  Footer (Close Tool)            │  ← Sticky bottom bar
└─────────────────────────────────┘
```

### Header — Active Lot / Room Selector (or None for Independent Tools)

The header is a sticky top bar that contains:
1. The tool's name as a logo/title on the left.
2. A dropdown selector on the right for choosing the **active Lot**, **active Room**, or no selector at all (depending on the tool's scope).

**For lot-focused tools** (IPMWizard, FertilizerWizard, CloningWizard):
- The dropdown lists all lots from `DB.data.lots`.
- Label: "Active Lot"
- First option: "— Select a lot —"

**For room-focused tools** (LabourWizard, EquipmentWizard):
- The dropdown lists all rooms from `DB.data.rooms`.
- Label: "Active Room"
- First option: "— Select a room —"

**For independent tools** (AbsenceWizard, or any future tool not scoped to lots or rooms):
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

### Footer — Save DB + Close Tool Buttons

The footer is a sticky bottom bar with two buttons:

1. **Save DB** — Opens a small popup containing a generated download link (same behavior as the main app). The user right-clicks the link to "Save Link As…".
2. **Close Tool** — Closes the popup window (`window.close()`).

**Footer HTML pattern:**
```html
<footer class="footer">
    <div class="export-wrapper">
        <button class="db-btn export" id="exportBtn" title="Generate save link">
            💾 Save DB
        </button>
        <div class="save-popup hidden" id="savePopup">
            <div class="save-popup-inner">
                <a class="save-link" id="saveLink" href="#" download>📄 Click to generate DB</a>
            </div>
            <button class="save-close" id="saveCloseBtn" title="Close">✕</button>
        </div>
    </div>
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

.export-wrapper { position: relative; }

.save-popup {
    position: absolute;
    bottom: calc(100% + 8px);
    left: calc(100% + 8px);
    background: var(--bg-secondary);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    padding: 12px 16px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    z-index: 200;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 300px;
}

.save-popup.hidden { display: none; }

.save-popup-inner {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
}

.save-link {
    color: var(--accent);
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
    word-break: break-all;
    line-height: 1.4;
}

.save-link:hover { text-decoration: underline; color: var(--accent-hover); }

.save-close {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 0.9rem;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.15s;
}

.save-close:hover { color: var(--danger); background: rgba(231, 76, 60, 0.15); }
```

**Footer JavaScript pattern:**
```js
// ---- Save DB Popup ----
const savePopup = $('savePopup');
const saveLink = $('saveLink');
const saveCloseBtn = $('saveCloseBtn');
let currentBlobUrl = null;

$('exportBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    // Sync all in-memory changes BEFORE serializing
    DB.sync();
    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    const json = JSON.stringify(DB.data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    currentBlobUrl = URL.createObjectURL(blob);
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    saveLink.href = currentBlobUrl;
    saveLink.download = `DB-${yy}-${mm}-${dd}.json`;
    saveLink.textContent = `📄 DB-${yy}-${mm}-${dd}.json — Right-click → Save Link As…`;
    savePopup.classList.remove('hidden');
});

saveCloseBtn.addEventListener('click', () => savePopup.classList.add('hidden'));
document.addEventListener('click', () => savePopup.classList.add('hidden'));

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

All subtools open as centered popup windows from SitkaTools.html at **half the main app's viewport width** and **66% taller than the viewport height**. Design the UI to fit comfortably within this window size.

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
- **Manual Save DB still exists as backup persistence:** Both main app and subtools have a footer "💾 Save DB" button for explicit file downloads (localStorage is volatile across browser restarts).
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

## Tasks & Progress Tracking

### Completed
- [x] Define project structure and conventions in Agent.MD
- [x] SitkaTools.html — Lot creation form (new-lot, sub-lot, split-lot types with parent lot selection)
- [x] SitkaTools.html — Import/export DB buttons (top right, user-managed file I/O)
- [x] SitkaTools.html — Calendar view (default view, full implementation)
  - [x] Terminal-style upcoming events panel (today/tomorrow/upcoming grouping)
  - [x] Full month calendar grid with multi-event day cells
  - [x] Drag-and-drop event rescheduling (updates DB directly)
  - [x] Event details/operations panel (view, edit modifiable fields, duplicate, delete)
  - [x] Sample events loader for testing

### Backlog
- [ ] SitkaTools.html — Lot close-out functionality
- [ ] IPMWizard — Initial setup and Agent.MD documentation
- [ ] IPMWizard — Full tool implementation
- [ ] FertilizerHelper — Initial setup and Agent.MD documentation
- [ ] FertilizerHelper — Full tool implementation
- [ ] EquipmentMaintenance — Initial setup and Agent.MD documentation
- [ ] EquipmentMaintenance — Full tool implementation
- [ ] AbsenceManager — Initial setup and Agent.MD documentation
- [ ] AbsenceManager — Full tool implementation
- [ ] Design and implement individual tools as requested
