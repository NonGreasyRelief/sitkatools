# TemplateTool — Tool Context

> **TEMPLATE:** Copy this folder when creating a new tool. Replace all instances of `TemplateTool` with your new tool name. Update the sections below to match your tool's specific purpose and behavior.

## What This Tool Does

TemplateTool is a placeholder description for a new SitkaGit suite tool.

### Intended Use

- **Feature 1:** Describe what users can do.
- **Feature 2:** Another capability or workflow.
- **Feature 3:** Additional functionality.

### Calendar Events Generated

TemplateTool appends events to the shared `calendarEvents` array using `"sourceTool": "TemplateTool"`. Typical event types include:
- **"Event Type 1"** — Description of when/why this event is generated.
- **"Event Type 2"** — Another event type.

---

## Relationship to SitkaTools

This tool is part of the SitkaGit suite. It operates as a standalone single-file HTML application with no communication to other tools. All shared state flows through the common JSON database file (`DB-YY-MM-DD.json`).

### How Data Fits Into the Database

TemplateTool reads and writes its own keys within the shared database, following the suite's decoupled convention:

**Per-lot data** (inside `lots.<LotID>`):
```
_tool_TemplateTool: { ... }
```
Each lot can have its own tool-related dictionary. The tool writes only to this key and does not touch other keys in the lot entry or other lots.

**Top-level data** (root of database):
```
_TemplateTool: { ... }
```
Tool-wide state that isn't scoped to a specific lot lives under this top-level key.

**Calendar events:**
When TemplateTool generates reminders, it appends events to the shared `calendarEvents` array using `"sourceTool": "TemplateTool"`. The main SitkaTools calendar view will render these alongside events from all other tools.

### Full Database Context

For reference, the complete database structure is defined in the root `Agent.MD`. Key points:
- Database file naming: `DB-YY-MM-DD.json`
- File I/O is user-managed via import (`<input type="file">`) and export (`URL.createObjectURL` + download)
- Tools never communicate with each other — only through the JSON file on disk
- Dates in data use ISO format (`YYYY-MM-DD`); filenames use 2-digit year (`YY`)

---

### Database Import on Open — postMessage Convention

TemplateTool receives its database from SitkaTools via `postMessage`, following the convention defined in the root `Agent.MD`.

**How it works:**
1. When SitkaTools.html launches TemplateTool, it opens the subtool in a new window then sends the current DB via `postMessage` with type `sitkaGit_db`.
2. On page load, TemplateTool listens for this message — no overlay, no file dialog, no manual import step.
3. After receiving the DB, TemplateTool acknowledges with `{ type: 'sitkaGit_ready' }` so SitkaTools stops retrying.
4. After every mutation (add/delete/edit), TemplateTool calls `notifySitkaTools()` which sends the updated DB back via `postMessage` with type `sitkaGit_db_update`.
5. The main app auto-refreshes all views and shows a toast notification that auto-dismisses after 3 seconds.
6. On init, TemplateTool calls `populateLotSelector()` (or `populateRoomSelector()`, or nothing for independent tools) to fill dropdowns, then renders its UI.

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
        // populateLotSelector() or populateRoomSelector() as needed
        showToast('Database loaded from SitkaTools');
    }
});

// After every mutation:
notifySitkaTools();
```

This tool uses **no localStorage, sessionStorage, IndexedDB, cookies, or any browser storage APIs**. All cross-window state flows through postMessage.

---

## UI Convention

This tool follows the shared UI Standards defined in the root `Agent.MD`. Key specifics for this tool:

- **Selector type:** Choose ONE below (see detailed standards section)
  - ~~Active Lot~~ — lot-focused tool (e.g., IPMWizard, FertilizerWizard, CloningWizard)
  - ~~Active Room~~ — room-focused tool (e.g., LabourWizard, EquipmentWizard)
  - ~~Independent~~ — no selector (e.g., AbsenceWizard)
- **Popup size:** Opens from SitkaTools.html at half the main app's viewport width and 66% taller than half the viewport height
- **Header:** Tool name with emoji on the left, dropdown selector on the right (or no selector for independent tools)
- **Footer:** Close Tool button only (no Save DB — changes auto-sync to SitkaTools via postMessage)
- **Theme:** Uses shared CSS custom properties from root UI Standards

See the root `Agent.MD` → "UI Standards — All Tools" for complete HTML/CSS/JS patterns.

---

## Constraints

- Single `.html` file, no build step, no external dependencies
- Runs in browser sandbox (`file://` protocol)
- Vanilla HTML/CSS/JavaScript only
- No network calls of any kind

---

## Standards Reference

> This section contains all shared standards extracted from the root `Agent.MD`. Every tool in the suite must follow these conventions.

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

### Theme Variables

All tools use the same CSS custom properties:

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

### Shared Component Styles

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

---

### Header Standards

The header is a sticky top bar with the tool name on the left and an optional dropdown selector on the right.

#### Option A: Lot-Focused Tools (Dropdown: Active Lot)

Tools that track data per lot (e.g., IPMWizard, FertilizerWizard, CloningWizard):

```html
<header class="header">
    <div class="header-left">
        <span class="logo">🐛 ToolName</span>
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

#### Option B: Room-Focused Tools (Dropdown: Active Room)

Tools that track data per room (e.g., LabourWizard, EquipmentWizard):

```html
<header class="header">
    <div class="header-left">
        <span class="logo">🔧 ToolName</span>
    </div>
    <div class="header-right">
        <div class="form-group">
            <label for="activeRoom">Active Room</label>
            <select id="activeRoom">
                <option value="">— Select a room —</option>
            </select>
        </div>
    </div>
</header>
```

#### Option C: Independent Tools (No Dropdown)

Tools not scoped to lots or rooms (e.g., AbsenceWizard):

```html
<header class="header">
    <div class="header-left">
        <span class="logo">🏖️ ToolName</span>
    </div>
</header>
```

#### Header CSS (shared across all types)

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

---

### Footer Standards

All tools use the same footer: a sticky bottom bar with only the Close Tool button. Changes auto-sync to SitkaTools via postMessage.

#### Footer HTML

```html
<footer class="footer">
    <button class="btn btn-secondary" id="closeToolBtn">Close Tool</button>
</footer>
```

#### Footer CSS

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

#### Footer JavaScript

```js
// ---- Close Tool ----
$('closeToolBtn').addEventListener('click', () => window.close());
```

---

### Shared Database Object Pattern

Every tool includes this JavaScript pattern:

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

---

### Populating Selectors

**For lot-focused tools:**
```js
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
```

**For room-focused tools:**
```js
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

---

### postMessage Convention Rules (Complete Reference)

These are the governing rules for transferring the database between windows:

1. **postMessage is the primary cross-window data channel.** SitkaTools sends the full DB payload to the subtool via postMessage after opening; subtools receive it and acknowledge with `sitkaGit_ready`.
2. **Subtools open as centered popup windows, not new tabs.** Use `window.open(url, '_blank', features)` with width/height/left/top to create a centered popup at half viewport width and 66% taller than viewport height.
3. **Main app auto-refreshes on updates.** When SitkaTools receives a `sitkaGit_db_update` message, it replaces its DB data and re-renders all views automatically. A toast appears confirming the sync (auto-dismisses after 3 seconds).
4. **Subtools notify after every mutation.** After adding/deleting/editing data, call `notifySitkaTools()` which posts the updated DB back to the opener window.
5. **Retry mechanism for initial DB delivery.** SitkaTools retries sending the DB up to 5 times at 200ms intervals until the subtool acknowledges with `sitkaGit_ready`.
6. **No import overlay needed.** Subtools receive DB via postMessage on load automatically — no blocking overlay, no file dialog, no manual step.

---

### Popup Window Convention

All subtools open as centered popup windows from SitkaTools.html (not new tabs). The main app sends the current DB to the subtool via postMessage after opening.

The launch pattern in SitkaTools.html:
```js
// Open as centered popup window
const width = Math.round(window.innerWidth / 2);
const height = Math.round(window.innerHeight * 1.66);
const left = Math.round((window.innerWidth - width) / 2);
const top = Math.round((window.innerHeight - height) / 2);

const newWindow = window.open(
    url,
    '_blank',
    `width=${width},height=${height},left=${left},top=${top}`
);

// Send DB via postMessage with retry mechanism
const dbPayload = DB.data || { lots: {}, rooms: {}, calendarEvents: [] };
let attempts = 0, acknowledged = false;

function trySend() {
    if (acknowledged || newWindow.closed || attempts >= 5) return;
    attempts++;
    newWindow.postMessage({ type: 'sitkaGit_db', payload: dbPayload }, '*');
}

const ackHandler = (e) => {
    if (e.source === newWindow && e.data?.type === 'sitkaGit_ready') {
        acknowledged = true;
        window.removeEventListener('message', ackHandler);
    }
};
window.addEventListener('message', ackHandler);

trySend();
const retryTimer = setInterval(() => {
    if (acknowledged || newWindow.closed) clearInterval(retryTimer);
    else trySend();
}, 200);
```

---

### Development Conventions Checklist

- [ ] Self-contained single `.html` file (all CSS in `<style>`, all JS in `<script>`)
- [ ] File named after the directory (`TemplateTool/TemplateTool.html`)
- [ ] Theme variables match `:root` values exactly
- [ ] Header is sticky top bar with tool name + appropriate selector (or none)
- [ ] Footer is sticky bottom bar with Close Tool button only (no Save DB — changes auto-sync via postMessage)
- [ ] Receives DB from SitkaTools via postMessage on load
- [ ] Sends updates back to SitkaTools via `notifySitkaTools()` after every mutation
- [ ] No import overlay — database loads automatically via postMessage
- [ ] `DB.ensureStructure()` called after loading data
- [ ] `DB.sync()` called before saving/exporting — flushes all in-memory changes to `DB.data`
- [ ] Tool only reads/writes its own `_tool_TemplateTool` and `_TemplateTool` keys
- [ ] Calendar events use `"sourceTool": "TemplateTool"`
- [ ] No localStorage, sessionStorage, IndexedDB, cookies, or URL parameters for data transfer (postMessage is used for cross-window sharing)
- [ ] No network calls, no external dependencies, no frameworks
- [ ] Dates in data use ISO format (`YYYY-MM-DD`)
