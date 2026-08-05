# AbsenceWizard — Tool Context

## What This Tool Does

AbsenceWizard is a staff absence and vacation tracking tool for licensed cannabis cultivation operations. It helps growers and managers record upcoming staff absences, vacations, and time-off periods, then generates calendar events to notify the team of reduced staffing ahead of time.

### Intended Use

- **Vacation scheduling:** Record when staff members will be away on vacation or personal leave.
- **Calendar notifications:** Automatically create calendar events for absence start/end dates so the team can see who is out and plan accordingly.
- **Staffing awareness:** Give managers visibility into upcoming staffing gaps so they can arrange coverage, adjust workloads, or schedule temporary help.
- **Overlap detection:** Surface situations where multiple staff members are absent simultaneously, which could impact critical cultivation tasks.

### Calendar Events Generated

AbsenceWizard appends events to the shared `calendarEvents` array using `"sourceTool": "AbsenceWizard"`. Typical event types include:
- **"Staff Absence Start"** — Marks the first day a team member is out.
- **"Staff Absence End"** — Marks the day a team member returns.
- **"Staffing Alert"** — Warns when multiple absences overlap during a critical period (e.g., harvest window).

## Relationship to SitkaTools

This tool is part of the SitkaGit suite. It operates as a standalone single-file HTML application with no communication to other tools. All shared state flows through the common JSON database file (`DB-YY-MM-DD.json`).

### How Data Fits Into the Database

AbsenceWizard reads and writes its own keys within the shared database, following the suite's decoupled convention:

**Per-lot data** (inside `lots.<LotID>`):
```
_tool_AbsenceWizard: { ... }
```
Each lot can have absence-related notes if staffing is tracked per lot. The tool writes only to this key and does not touch other keys in the lot entry or other lots.

**Top-level data** (root of database):
```
_AbsenceWizard: { ... }
```
Tool-wide state that isn't scoped to a specific lot lives under this top-level key. This includes the master list of staff members, their absence records, and any configuration for alert thresholds.

**Calendar events:**
When AbsenceWizard generates reminders (e.g., "staff vacation starts", "return date", "staffing conflict"), it appends events to the shared `calendarEvents` array using `"sourceTool": "AbsenceWizard"`. The main SitkaTools calendar view will render these alongside events from all other tools.

### Full Database Context

For reference, the complete database structure is defined in the root `Agent.MD`. Key points:
- Database file naming: `DB-YY-MM-DD.json`
- File I/O is user-managed via import (`<input type="file">`) and export (`URL.createObjectURL` + download)
- Tools never communicate with each other — only through the JSON file on disk
- Dates in data use ISO format (`YYYY-MM-DD`); filenames use 2-digit year (`YY`)

### Database Import on Open — postMessage Convention

AbsenceWizard receives its database from SitkaTools via `postMessage`, following the convention defined in the root `Agent.MD`.

**How it works:**
1. When SitkaTools.html launches AbsenceWizard, it opens the subtool in a new window then sends the current DB via `postMessage` with type `sitkaGit_db`.
2. On page load, AbsenceWizard listens for this message — no overlay, no file dialog, no manual import step.
3. After receiving the DB, AbsenceWizard acknowledges with `{ type: 'sitkaGit_ready' }` so SitkaTools stops retrying.
4. After every mutation (add/delete/edit), AbsenceWizard calls `notifySitkaTools()` which sends the updated DB back via `postMessage` with type `sitkaGit_db_update`.
5. The main app auto-refreshes all views and shows a toast notification that auto-dismisses after 3 seconds.
6. On init, AbsenceWizard renders its UI normally (no selector dropdown needed — this is an independent tool).

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
        // Reconcile and render with fresh data
        showToast('Database loaded from SitkaTools');
    }
});

// After every mutation:
notifySitkaTools();
```

This tool uses **no localStorage, sessionStorage, IndexedDB, cookies, or any browser storage APIs**. All cross-window state flows through postMessage.

## UI Convention

This tool follows the shared UI Standards defined in the root `Agent.MD`. Key specifics for this tool:

- **Selector type:** Independent (no lot or room selector — staff absences are not tied to any specific lot or room; calendar events are scoped solely to the AbsenceWizard tool's own `_AbsenceWizard` dictionary in the DB)
- **Popup size:** Opens from SitkaTools.html at half the main app's viewport width and 66% taller than half the viewport height
- **Header:** Tool name "🏖️ AbsenceManager" on the left, no dropdown selector (header contains only the tool name)
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
