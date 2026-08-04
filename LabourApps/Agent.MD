# LabourApps — Tool Context

## What This Tool Does

LabourApps is a labour hour and task tracking tool for licensed cannabis cultivation. It helps growers monitor time spent on various tasks across their cultivation lots, enabling better labour planning and cost analysis.

## Relationship to SitkaTools

This tool is part of the SitkaGit suite. It operates as a standalone single-file HTML application with no communication to other tools. All shared state flows through the common JSON database file (`DB-YY-MM-DD.json`).

### How Data Fits Into the Database

LabourApps reads and writes its own keys within the shared database, following the suite's decoupled convention:

**Per-lot data** (inside `lots.<LotID>`):
```
_tool_LabourApps: { ... }
```
Each lot can have its own labour-related dictionary. The tool writes only to this key and does not touch other keys in the lot entry or other lots.

**Top-level data** (root of database):
```
_LabourApps: { ... }
```
Tool-wide state that isn't scoped to a specific lot lives under this top-level key.

**Calendar events:**
When LabourApps generates reminders (e.g., "scheduled maintenance", "task deadline"), it appends events to the shared `calendarEvents` array using `"sourceTool": "LabourApps"`. The main SitkaTools calendar view will render these alongside events from all other tools.

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
