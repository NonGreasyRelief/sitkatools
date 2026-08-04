# EquipmentMaintenance — Tool Context

## What This Tool Does

EquipmentMaintenance is an equipment maintenance tracking tool for licensed cannabis cultivation. It helps growers schedule, log, and track maintenance tasks for grow room equipment across their cultivation lots.

## Relationship to SitkaTools

This tool is part of the SitkaGit suite. It operates as a standalone single-file HTML application with no communication to other tools. All shared state flows through the common JSON database file (`DB-YY-MM-DD.json`).

### How Data Fits Into the Database

EquipmentMaintenance reads and writes its own keys within the shared database, following the suite's decoupled convention:

**Per-lot data** (inside `lots.<LotID>`):
```
_tool_EquipmentMaintenance: { ... }
```
Each lot can have its own equipment-related dictionary. The tool writes only to this key and does not touch other keys in the lot entry or other lots.

**Top-level data** (root of database):
```
_EquipmentMaintenance: { ... }
```
Tool-wide state that isn't scoped to a specific lot lives under this top-level key.

**Calendar events:**
When EquipmentMaintenance generates reminders (e.g., "scheduled maintenance", "equipment inspection due"), it appends events to the shared `calendarEvents` array using `"sourceTool": "EquipmentMaintenance"`. The main SitkaTools calendar view will render these alongside events from all other tools.

### Full Database Context

For reference, the complete database structure is defined in the root `Agent.MD`. Key points:
- Database file naming: `DB-YY-MM-DD.json`
- File I/O is user-managed via import (`<input type="file">`) and export (`URL.createObjectURL` + download)
- Tools never communicate with each other — only through the JSON file on disk
- Dates in data use ISO format (`YYYY-MM-DD`); filenames use 2-digit year (`YY`)

## UI Convention

This tool follows the shared UI Standards defined in the root `Agent.MD`. Key specifics for this tool:

- **Selector type:** Active Room (room-focused tool — equipment maintenance is tracked per room)
- **Popup size:** Opens from SitkaTools.html at half the main app's viewport width and 66% taller than half the viewport height
- **Header:** Tool name "🔧 EquipmentMaintenance" on the left, Active Room dropdown on the right
- **Footer:** Save DB button (with popup link) + Close Tool button
- **Theme:** Uses shared CSS custom properties from root UI Standards

See the root `Agent.MD` → "UI Standards — All Tools" for complete HTML/CSS/JS patterns.

## Constraints

- Single `.html` file, no build step, no external dependencies
- Runs in browser sandbox (`file://` protocol)
- Vanilla HTML/CSS/JavaScript only
- No network calls of any kind
