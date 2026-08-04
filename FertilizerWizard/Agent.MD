# FertilizerWizard — Tool Context

## What This Tool Does

FertilizerWizard is a fertilizer cost and usage tracking tool for licensed cannabis cultivation. It helps growers monitor fertilizer consumption, costs, and application rates across their cultivation lots.

## Relationship to SitkaTools

This tool is part of the SitkaGit suite. It operates as a standalone single-file HTML application with no communication to other tools. All shared state flows through the common JSON database file (`DB-YY-MM-DD.json`).

### How Data Fits Into the Database

FertilizerWizard reads and writes its own keys within the shared database, following the suite's decoupled convention:

**Per-lot data** (inside `lots.<LotID>`):
```
_tool_FertilizerWizard: { ... }
```
Each lot can have its own fertilizer-related dictionary. The tool writes only to this key and does not touch other keys in the lot entry or other lots.

**Top-level data** (root of database):
```
_FertilizerWizard: { ... }
```
Tool-wide state that isn't scoped to a specific lot lives under this top-level key.

**Calendar events:**
When FertilizerWizard generates reminders (e.g., "reorder fertilizer", "scheduled feeding"), it appends events to the shared `calendarEvents` array using `"sourceTool": "FertilizerWizard"`. The main SitkaTools calendar view will render these alongside events from all other tools.

### Full Database Context

For reference, the complete database structure is defined in the root `Agent.MD`. Key points:
- Database file naming: `DB-YY-MM-DD.json`
- File I/O is user-managed via import (`<input type="file">`) and export (`URL.createObjectURL` + download)
- Tools never communicate with each other — only through the JSON file on disk
- Dates in data use ISO format (`YYYY-MM-DD`); filenames use 2-digit year (`YY`)

### Database Retrieval on Open — TempDB.json Swap

FertilizerWizard retrieves the active database from the calendar when it opens, using the `TempDB.json` localStorage swap convention defined in the root `Agent.MD`.

**How it works:**
1. When SitkaTools.html launches FertilizerWizard, it writes the current in-memory `DB.data` to `localStorage` under the key `TempDB.json` — BEFORE calling `window.open()`.
2. On page load, FertilizerWizard calls `loadFromSwap()` which reads `localStorage.getItem('TempDB.json')`, parses the JSON, and populates `DB.data`.
3. If the swap is absent or corrupted, the tool falls back to an empty DB structure and shows the manual file import UI as a fallback.
4. After loading, FertilizerWizard calls `populateLotSelector()` to fill the Active Lot dropdown from `DB.lots`, then renders its UI.

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

// Populate the lot selector after DB is loaded.
populateLotSelector();
```

This is the **only** use of `localStorage` permitted in this tool. No other localStorage keys are used.

## UI Convention

This tool follows the shared UI Standards defined in the root `Agent.MD`. Key specifics for this tool:

- **Selector type:** Active Lot (lot-focused tool — fertilizer usage is tracked per lot)
- **Popup size:** Opens from SitkaTools.html at half the main app's viewport width and 66% taller than half the viewport height
- **Header:** Tool name "🧪 FertilizerWizard" on the left, Active Lot dropdown on the right
- **Footer:** Save DB button (with popup link) + Close Tool button
- **Theme:** Uses shared CSS custom properties from root UI Standards

See the root `Agent.MD` → "UI Standards — All Tools" for complete HTML/CSS/JS patterns.

## Constraints

- Single `.html` file, no build step, no external dependencies
- Runs in browser sandbox (`file://` protocol)
- Vanilla HTML/CSS/JavaScript only
- No network calls of any kind
