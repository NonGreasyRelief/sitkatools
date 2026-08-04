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

### Database Retrieval on Open — TempDB.json Swap

TemplateTool retrieves the active database from the calendar when it opens, using the `TempDB.json` localStorage swap convention defined in the root `Agent.MD`.

**How it works:**
1. When SitkaTools.html launches TemplateTool, it writes the current in-memory `DB.data` to `localStorage` under the key `TempDB.json` — BEFORE calling `window.open()`.
2. On page load, TemplateTool calls `loadFromSwap()` which reads `localStorage.getItem('TempDB.json')`, parses the JSON, and populates `DB.data`.
3. If the swap is absent or corrupted, the tool falls back to an empty DB structure and shows the manual file import UI as a fallback.
4. After loading, TemplateTool calls `populateLotSelector()` (or `populateRoomSelector()`, or nothing for independent tools) to fill dropdowns, then renders its UI.

**Implementation:**
```js
// ---- TempDB.json swap retrieval ----
function loadFromSwap() {
    try {
        const raw = localStorage.getItem('TempDB.json');
        if (raw) {
            DB.data = JSON.parse(raw);
            DB.ensureStructure();
            return true;
        }
    } catch (err) {
        console.warn('Could not read TempDB.json from localStorage:', err);
    }
    return false;
}

// Load from swap on startup; fall back to empty structure.
if (!loadFromSwap()) {
    DB.ensureStructure();
}

// Populate the selector after DB is loaded (choose ONE based on tool type):
// populateLotSelector();   // For lot-focused tools
// populateRoomSelector();  // For room-focused tools
// (nothing needed)         // For independent tools
```

This is the **only** use of `localStorage` permitted in this tool. No other localStorage keys are used.

---

## UI Convention

This tool follows the shared UI Standards defined in the root `Agent.MD`. Key specifics for this tool:

- **Selector type:** Choose ONE below (see detailed standards section)
  - ~~Active Lot~~ — lot-focused tool (e.g., IPMWizard, FertilizerWizard, CloningWizard)
  - ~~Active Room~~ — room-focused tool (e.g., LabourWizard, EquipmentWizard)
  - ~~Independent~~ — no selector (e.g., AbsenceWizard)
- **Popup size:** Opens from SitkaTools.html at half the main app's viewport width and 66% taller than half the viewport height
- **Header:** Tool name with emoji on the left, dropdown selector on the right (or no selector for independent tools)
- **Footer:** Save DB button (with popup link) + Close Tool button
- **Theme:** Uses shared CSS custom properties from root UI Standards

See the "Standards Reference" section below for complete HTML/CSS/JS patterns.

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
│  Footer (Save DB + Close Tool)  │  ← Sticky bottom bar
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

### Footer Standards (Save DB → Right Click + Close Tool)

The footer is a sticky bottom bar with two buttons:

1. **Save DB** — Opens a small popup containing a generated download link. The user right-clicks the link to "Save Link As…".
2. **Close Tool** — Closes the popup window (`window.close()`).

#### Footer HTML

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

.export-wrapper { position: relative; }

.save-popup {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
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

#### Footer JavaScript

```js
// ---- Save DB Popup ----
const savePopup = $('savePopup');
const saveLink = $('saveLink');
const saveCloseBtn = $('saveCloseBtn');
let currentBlobUrl = null;

$('exportBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    DB.ensureStructure();
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

### TempDB.json Swap Rules (Complete Reference)

These are the governing rules for reading from the temporary database swap:

1. **localStorage is ONLY for `TempDB.json`** — no other keys, no session persistence, no preferences. This is strictly a swap file mechanism.
2. **The main app (SitkaTools.html) WRITES** to localStorage before opening any subtool. It serializes the current in-memory `DB.data` as a JSON string under the key `TempDB.json`.
3. **Subtools READ from localStorage on startup.** On page load, each subtool checks `localStorage.getItem('TempDB.json')`. If present, it parses the JSON and populates `DB.data`. If absent, the tool falls back to the manual file import UI.
4. **The swap is write-once, read-once per session.** The main app writes when launching; the subtool reads when opening. After reading, the subtool works entirely in memory. When the user saves (via the footer Save DB button), the subtool exports its modified `DB.data` as a download — it does NOT write back to localStorage.
5. **Stale data awareness:** If the swap exists but is older than the current session, the subtool should still use it as the best available state. The Save DB flow is how the user commits changes back to disk.

---

### Popup Window Size Convention

All subtools open as popup windows from SitkaTools.html, centered on screen at **half the main app's viewport width** and **66% taller than half the viewport height**. Design the UI to fit comfortably within this window size.

The launch pattern in SitkaTools.html:
```js
const w = Math.floor(window.innerWidth / 2);
const h = Math.floor(window.innerHeight * 0.66);
const left = Math.floor((window.screen.width - w) / 2);
const top = Math.floor((window.screen.height - h) / 2);
window.open(url, '_blank', `width=${w},height=${h},left=${left},top=${top}`);
```

---

### Development Conventions Checklist

- [ ] Self-contained single `.html` file (all CSS in `<style>`, all JS in `<script>`)
- [ ] File named after the directory (`TemplateTool/TemplateTool.html`)
- [ ] Theme variables match `:root` values exactly
- [ ] Header is sticky top bar with tool name + appropriate selector (or none)
- [ ] Footer is sticky bottom bar with Save DB popup + Close Tool button
- [ ] Save DB generates a download link via `URL.createObjectURL` — user right-clicks to save
- [ ] TempDB.json swap loaded on startup before any UI rendering
- [ ] Manual file import UI available as fallback if swap is missing
- [ ] `DB.ensureStructure()` called after loading data
- [ ] Tool only reads/writes its own `_tool_TemplateTool` and `_TemplateTool` keys
- [ ] Calendar events use `"sourceTool": "TemplateTool"`
- [ ] No localStorage except for the `TempDB.json` swap key
- [ ] No network calls, no external dependencies, no frameworks
- [ ] Dates in data use ISO format (`YYYY-MM-DD`)
