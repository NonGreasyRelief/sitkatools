# CloningScheduler — Tool Context

## What This Tool Does

CloningScheduler is a clone cutting scheduler for licensed cannabis cultivation. It helps growers know when it's time to cut clones based on how far along a given lot is in its lifecycle.

## Relationship to SitkaTools

This tool is part of the SitkaGit suite. It operates as a standalone single-file HTML application with no communication to other tools. All shared state flows through the common JSON database file (`DB-YY-MM-DD.json`).

### How Data Fits Into the Database

CloningScheduler reads and writes its own keys within the shared database, following the suite's decoupled convention:

**Per-lot data** (inside `lots.<LotID>`):
```
_tool_CloningScheduler: { ... }
```
Each lot can have its own cloning-related dictionary. The tool writes only to this key and does not touch other keys in the lot entry or other lots.

**Top-level data** (root of database):
```
_CloningScheduler: { ... }
```
Tool-wide state that isn't scoped to a specific lot lives under this top-level key.

**Calendar events:**
When CloningScheduler generates reminders (e.g., "time to cut clones", "clone readiness check"), it appends events to the shared `calendarEvents` array using `"sourceTool": "CloningScheduler"`. The main SitkaTools calendar view will render these alongside events from all other tools.

### Full Database Context

For reference, the complete database structure is defined in the root `Agent.MD`. Key points:
- Database file naming: `DB-YY-MM-DD.json`
- File I/O is user-managed via import (`<input type="file">`) and export (`URL.createObjectURL` + download)
- Tools never communicate with each other — only through the JSON file on disk
- Dates in data use ISO format (`YYYY-MM-DD`); filenames use 2-digit year (`YY`)

## Constraints

- Single `.html` file, no build step, no external dependencies
- Runs in browser sandbox (`file://` protocol)
- Vanilla HTML/CSS/JavaScript only
- No network calls of any kind
