# AbsenceManager — Tool Context

## What This Tool Does

AbsenceManager is a staff absence and vacation tracking tool for licensed cannabis cultivation operations. It helps growers and managers record upcoming staff absences, vacations, and time-off periods, then generates calendar events to notify the team of reduced staffing ahead of time.

### Intended Use

- **Vacation scheduling:** Record when staff members will be away on vacation or personal leave.
- **Calendar notifications:** Automatically create calendar events for absence start/end dates so the team can see who is out and plan accordingly.
- **Staffing awareness:** Give managers visibility into upcoming staffing gaps so they can arrange coverage, adjust workloads, or schedule temporary help.
- **Overlap detection:** Surface situations where multiple staff members are absent simultaneously, which could impact critical cultivation tasks.

### Calendar Events Generated

AbsenceManager appends events to the shared `calendarEvents` array using `"sourceTool": "AbsenceManager"`. Typical event types include:
- **"Staff Absence Start"** — Marks the first day a team member is out.
- **"Staff Absence End"** — Marks the day a team member returns.
- **"Staffing Alert"** — Warns when multiple absences overlap during a critical period (e.g., harvest window).

## Relationship to SitkaTools

This tool is part of the SitkaGit suite. It operates as a standalone single-file HTML application with no communication to other tools. All shared state flows through the common JSON database file (`DB-YY-MM-DD.json`).

### How Data Fits Into the Database

AbsenceManager reads and writes its own keys within the shared database, following the suite's decoupled convention:

**Per-lot data** (inside `lots.<LotID>`):
```
_tool_AbsenceManager: { ... }
```
Each lot can have absence-related notes if staffing is tracked per lot. The tool writes only to this key and does not touch other keys in the lot entry or other lots.

**Top-level data** (root of database):
```
_AbsenceManager: { ... }
```
Tool-wide state that isn't scoped to a specific lot lives under this top-level key. This includes the master list of staff members, their absence records, and any configuration for alert thresholds.

**Calendar events:**
When AbsenceManager generates reminders (e.g., "staff vacation starts", "return date", "staffing conflict"), it appends events to the shared `calendarEvents` array using `"sourceTool": "AbsenceManager"`. The main SitkaTools calendar view will render these alongside events from all other tools.

### Full Database Context

For reference, the complete database structure is defined in the root `Agent.MD`. Key points:
- Database file naming: `DB-YY-MM-DD.json`
- File I/O is user-managed via import (`<input type="file">`) and export (`URL.createObjectURL` + download)
- Tools never communicate with each other — only through the JSON file on disk
- Dates in data use ISO format (`YYYY-MM-DD`); filenames use 2-digit year (`YY`)

## UI Convention

This tool follows the shared UI Standards defined in the root `Agent.MD`. Key specifics for this tool:

- **Selector type:** Independent (no lot or room selector — staff absences are not tied to any specific lot or room; calendar events are scoped solely to the AbsenceManager tool's own `_AbsenceManager` dictionary in the DB)
- **Popup size:** Opens from SitkaTools.html at half the main app's viewport width and 66% taller than half the viewport height
- **Header:** Tool name "🏖️ AbsenceManager" on the left, no dropdown selector (header contains only the tool name)
- **Footer:** Save DB button (with popup link) + Close Tool button
- **Theme:** Uses shared CSS custom properties from root UI Standards

See the root `Agent.MD` → "UI Standards — All Tools" for complete HTML/CSS/JS patterns.

## Constraints

- Single `.html` file, no build step, no external dependencies
- Runs in browser sandbox (`file://` protocol)
- Vanilla HTML/CSS/JavaScript only
- No network calls of any kind
