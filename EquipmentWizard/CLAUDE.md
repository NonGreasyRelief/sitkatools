# EquipmentWizard — Tool Context

Schedules recurring maintenance for grow-room equipment, room by room. It writes every occurrence of each maintenance task onto the shared calendar, up to 12 months ahead.

- **Where its code is:** in `SitkaTools/SitkaTools.html`, under the `═══ TOOL EquipmentWizard` markers (root `CLAUDE.md` → "Tool Overlays"). It opens over SitkaTools, one tool at a time, and starts afresh each time. `EquipmentWizard/EquipmentWizard.html` only points there.
- **Room-focused tool:** the header shows "🔧 EquipmentWizard" and an **Active Room** selector. The footer and UI follow the root `CLAUDE.md`, and so does the database ("Tool Overlays").
- **Office only** (`DeviceView.OFFICE_ONLY: true`). On a building device, SitkaTools hides the link. If the tool is opened anyway, it covers the page with "Office only" and stops before loading, because a building device couldn't save the result. It never resyncs there. See root `CLAUDE.md` → "Building Device View".

## Data — `_EquipmentWizard.rooms[roomId].equipment[]`

Equipment belongs to rooms (`DB.rooms`), not lots. The tool may also keep per-lot data under `lots.<id>._tool_EquipmentWizard`, and it writes only its own keys.

| Field | Notes |
|---|---|
| `id`, `type`, `name`, `emoji` | `type` comes from the dropdown (optional). `name` is free text. `emoji` comes from the type (`getEmojiForType`, falling back to 🔧). |
| `installedDate` | Set to the day the item is added. Power use counts from this date. |
| `serialNumber`, `filterSize` | Dehumidifier only. |
| `power` | Optional `{ watts, units, hoursPerDay }`. See "⚡ Power Use (for the electricity cost)". |
| `tasks[]` | Maintenance sub-tasks: `{ id, name, intervalValue, intervalUnit: 'days' \| 'months', startDate, emoji }`. |
| `additionalMaintenance[]` | The **Repair Log**: one-off `{ id, name, date }` entries. They make no calendar events and save with `notifySitkaTools()`. |

### Common equipment types (dropdown)

Equipment names are free text, so any custom item can be added.

| Category | Examples |
|---|---|
| Dehumidifier | Filter Replacement, Drain Cleaning, Annual Performance Measurement, Coil Cleaning |
| Air Conditioner | Filter Replacement, Condenser Cleaning, Drain Line Cleaning, Refrigerant Check |
| Plumbing | Tighten Connections, Leak Inspection, Valve Service |
| Irrigation | Dripper Replacement, Layout Inspection, Line Flush, Timer Calibration |
| Infrastructure | Table — Leak Check, Table — Level Adjustment, HVAC — General Inspection |

### ⚡ Power Use (for the electricity cost)

- `power: { watts, units, hoursPerDay }`:
  - `watts` is the draw per unit.
  - `units` is how many (default 1).
  - `hoursPerDay` is roughly how long it runs each day (default 12).
- Estimated use is `watts × units × hours ÷ 1000` kWh a day, counted from `installedDate` on. ACs and dehumidifiers matter most.
- **Add form:** "⚡ Power draw (watts)", "How many units" and "Runs about (hours a day)". Leaving watts empty means no power entry.
- **Each item's card:** a power line under the name (`⚡ 1,100 W × 2 · 16 h/day ≈ 35.2 kWh/day`, or "Power not set"), plus an editable "⚡ Power use" row at the top of the expanded body.
  - An edit saves straight away with `notifySitkaTools()`.
  - It never resyncs the calendar, because power doesn't change the schedule.
- **Group entries:** an item that stands for a group (e.g. "All ACs / Grow 2") can carry the whole group's power, with `units` set to how many there are. Don't also give power to the group's members, or the room counts them twice.
- The Labour & Cost Wizard reads this (read-only) to estimate electricity for the room's crops. See root `CLAUDE.md` → "Total Cost per Gram".

## Calendar Events

```js
{ id, date, title, sourceTool: 'EquipmentWizard', roomId, equipmentId, taskId, taskType: 'equipment_maintenance' }
```

- **Title:** task emoji, task name, equipment name, room name: `"🔧 Replace Filter — Dehumidifier #1 — Flower Room A"`.
- **`roomId`** is always set.
- **`id`** stays the same across resyncs (see "Schedule Reconciliation").
- **`taskId`** is missing on events saved before it existed.

## Scheduling Algorithm

For each task, `computeEquipmentEvents` starts at `startDate` and adds the interval repeatedly. Every occurrence in `[startDate, today + 12 months]` becomes an event.

- **Months:** occurrence *k* is always `startDate + k × interval` months, clamped to the last day of the month. It is never chained from the previous occurrence. So Jan 31 monthly gives Jan 31, Feb 28 (or 29), Mar 31, Apr 30…
- **Days:** plain day addition.
- An interval below 1 (only from a hand-edited file) gives one visit, never an endless loop (review G10).
- **Local dates only**, including "today". Never UTC.
- **Retroactive start:** a `startDate` in the past back-fills occurrences up to today, then continues 12 months ahead. This keeps the real maintenance cadence when tracking starts late.

## Schedule Reconciliation

A resync deletes the room's EquipmentWizard events (`sourceTool === 'EquipmentWizard' && roomId === room`) and recomputes them from scratch. Changed intervals, removed equipment and the rolling 12-month window therefore never leave stale or duplicate events.

**When it runs** (there's no need to press anything):

- `syncAllRooms` resyncs every room on each `sitkaGit_db` (open), then calls `notifySitkaTools()`.
- `autoSyncCalendar(roomId)` resyncs one room on a room switch and after every equipment or task add, edit or delete. Adding or deleting a task also purges and regenerates its equipment's events.

**What survives a resync:**

- **Annotations carry over** (`carryOverAnnotations`; the fields are listed in root `CLAUDE.md` → "Event Annotations Survive Regeneration").
  - Events are matched on `equipmentId + taskId + date` (`equipmentEventKey`), so renaming a task or changing its emoji keeps its history.
  - Events without `taskId` fall back to `equipmentId + title + date`. The first resync gives each matched event its `taskId`.
- **Unmatched old events are dropped.** The exception (`retainedHistory`): a completed or labour-tracked event (`hasWorkRecords`) whose equipment and room still exist stays on the calendar as maintenance history, e.g. after an interval change.
  - Such a visit **covers its period** (`dropCoveredOccurrences`, review G9): the occurrence whose period (from it to the task's next one) holds the visit's date isn't generated again, so a start or interval edit doesn't leave a second, overdue visit.
- **Gotcha:** a date moved on the SitkaTools calendar no longer matches, so it is regenerated at its computed date (ROADMAP 0.6).

**Editing:**

- **✎ → Update Task** replaces the task in place and keeps its id. **Cancel** leaves edit mode.
- Adding a task with the same name as an existing one replaces that task instead of duplicating it.
- **Delete equipment** asks first. The confirm names the item and says how many tasks, Repair Log entries and completed or labour-tracked visits go with it. Then all its events are removed, history included.

## Messages from SitkaTools

These follow root `CLAUDE.md` → "Tool Overlays" (`receiveDb`); only this tool's specifics are listed here.

- **`sitkaGit_db` (as it opens):** `DeviceView.take`, fill the room selector, render, then `syncAllRooms()` and `notifySitkaTools()` (SitkaTools counts it only when the resync really changed something).
- **`sitkaGit_db_update` (SitkaTools changed the DB while it's open):**
  - Replace `DB.data` and run `ensureStructure()`.
  - Keep the selected room, and refresh the preview.
  - Rebuild the equipment list only when the selected room's equipment changed, so half-filled task and Repair Log forms survive.
  - Never resync, and never call `notifySitkaTools()` in reply. Only `sitkaGit_db` resyncs.

## BC Civic Holidays (implementation pending)

The rules are in root `CLAUDE.md` → "BC Civic Holidays".

- When a room's schedule is generated or regenerated, check each occurrence against that year's holidays (observed dates).
- List any task that lands on a holiday, e.g. "⚠️ 🔧 Replace Filter — Dehumidifier #1 — Flower Room A falls on Labour Day (Sep 7)".
- Notify only. Never reschedule.
