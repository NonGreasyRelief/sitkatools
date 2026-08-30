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

- **Title:** The emoji followed by the user's text (e.g., `"📋 License renewal due"`)
- **Date:** The date selected by the user
- **SourceTool:** `"GeneralEvent"`

No `lotId` or other lot-related fields are included — GeneralEvent is independent and not tied to any lot.

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
### Holiday-Awareness Behavior for GeneralEvent (implementation pending)

When the user picks a date, check whether it is one of the 11 BC civic holidays for that year (nominal or observed). If so, show a gentle notification (e.g., "📌 Note: Oct 12 is Thanksgiving") while still allowing the event to be created. The SitkaTools calendar will render the holidays themselves as if they were events.

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
- **Popup size:** Opens from SitkaTools.html at half the main app's viewport width and 83% of the viewport height
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
