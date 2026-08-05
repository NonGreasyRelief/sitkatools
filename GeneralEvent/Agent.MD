# GeneralEvent — Tool Context

## What This Tool Does

GeneralEvent is a minimal calendar event creator for the SitkaGit suite. It allows users to post an independent, standalone calendar event consisting of only three things:

1. **Event text** — a free-form string describing the event.
2. **Date** — the date the event should appear on the calendar.
3. **Opening emoji** — a selectable emoji that prefixes the event title in the calendar view.

No lots, no rooms, no sub-fields. Just a quick way to drop arbitrary reminders or milestones onto the shared calendar.

### Intended Use

- **Quick reminders:** Add one-off events not tied to any cultivation lot (e.g., "license renewal due", "team meeting", "holiday").
- **Milestones:** Mark important dates that don't fit into a specific tool's domain.
- **Personal notes:** Put anything on the calendar with minimal friction — type text, pick a date, pick an emoji, done.

### Calendar Events Generated

GeneralEvent appends events to the shared `calendarEvents` array using `"sourceTool": "GeneralEvent"`. Each event has:

- **Type:** `"General"`
- **Title:** The emoji followed by the user's text (e.g., `"📋 License renewal due"`)
- **Date:** The date selected by the user
- **LotId:** `null` (independent — not tied to any lot)

## Relationship to SitkaTools

This tool is part of the SitkaGit suite. It operates as a standalone single-file HTML application with no communication to other tools. All shared state flows through the common JSON database file (`DB-YY-MM-DD.json`).

### How Data Fits Into the Database

GeneralEvent reads and writes its own keys within the shared database, following the suite's decoupled convention:

**Per-lot data:** None — this tool is not scoped to any lot.

**Top-level data** (root of database):
```
_GeneralEvent: { ... }
```
Tool-wide state lives under this top-level key. This may include a log of events created by this tool for reference or undo purposes.

**Calendar events:**
When the user creates an event, GeneralEvent appends it to the shared `calendarEvents` array using `"sourceTool": "GeneralEvent"`. The main SitkaTools calendar view will render these alongside events from all other tools.

### Full Database Context

For reference, the complete database structure is defined in the root `Agent.MD`. Key points:
- Database file naming: `DB-YY-MM-DD.json`
- File I/O is user-managed via import (`<input type="file">`) and export (`URL.createObjectURL` + download)
- Tools never communicate with each other — only through the JSON file on disk
- Dates in data use ISO format (`YYYY-MM-DD`); filenames use 2-digit year (`YY`)

### Database Import on Open — postMessage Convention

GeneralEvent receives its database from SitkaTools via `postMessage`, following the convention defined in the root `Agent.MD`.

**How it works:**
1. When SitkaTools.html launches GeneralEvent, it opens the subtool in a new window then sends the current DB via `postMessage` with type `sitkaGit_db`.
2. On page load, GeneralEvent listens for this message — no overlay, no file dialog, no manual import step.
3. After receiving the DB, GeneralEvent acknowledges with `{ type: 'sitkaGit_ready' }` so SitkaTools stops retrying.
4. After every mutation (add/delete/edit), GeneralEvent calls `notifySitkaTools()` which sends the updated DB back via `postMessage` with type `sitkaGit_db_update`.
5. The main app auto-refreshes all views and shows a toast notification that auto-dismisses after 3 seconds.
6. On init, GeneralEvent renders its UI immediately (no selector dropdown needed — this is an independent tool).

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
        reconcileLog();
        renderEventList();
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

- **Selector type:** Independent (no lot or room selector — events are not tied to any specific lot or room; calendar events are scoped solely to the GeneralEvent tool's own `_GeneralEvent` dictionary in the DB)
- **Popup size:** Opens from SitkaTools.html at half the main app's viewport width and 66% taller than half the viewport height
- **Header:** Tool name "📌 GeneralEvent" on the left, no dropdown selector (header contains only the tool name)
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
