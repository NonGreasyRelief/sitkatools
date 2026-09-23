# DailyWizard — Tool Context

## What This Tool Does

DailyWizard is a **daily to-do list builder and floor view** for the SitkaGit suite. CropLabourWizard tracks the big crop jobs (planting, flip, harvest, trim…), but nothing covers the small essential activities that happen every day in each building — watering plants, mixing fertilizer, scouting rooms, stocking paper towels, stocking uniforms, stocking glove holders, and similar. DailyWizard fills that gap:

1. **Build per-building daily task lists.** The manager defines a set of recurring daily tasks for each building (emoji, name, estimated time, required staff). Task lists are saved directly to this tool's own database key (`_DailyWizard`) — they are *definitions*, not one-off events, and they never touch `calendarEvents`.
2. **Show the day.** For any date (default: today), the tool renders that building's tasks for that day, followed by that building's scheduled calendar events from the main database (CropLabourWizard, CropProjection, EquipmentWizard, GeneralEvent) for the same day — giving staff one complete picture of what happens in the building today.
3. **Check things off.** Every row has a large thumb-friendly checkbox. Checking is **purely informational** — it never writes to the main database and never syncs back to SitkaTools. It exists so floor staff can coordinate on a tablet and the floor manager can direct staff day to day.

### Intended Use

- **Planning (manager, desktop or tablet):** Pick a building, build/edit/reorder its daily task list, write step-by-step instructions for any task. Changes save to `_DailyWizard` and sync back to SitkaTools via postMessage when launched from the main app.
- **Floor view (staff, tablet in the building):** Open the tool standalone on a tablet, load the current database file, pick the building (or "All Buildings"), and work down the list with big checkboxes. A "Reset Day" button clears all check-offs for a fresh start.
- **Combined overview:** The "All Buildings" view shows every building's list for the day, grouped by building, so one tablet can coordinate multiple buildings.

### What This Tool Is NOT

- It does **not** create, edit, or delete `calendarEvents` — it only *reads* them to display a building's scheduled crop/equipment tasks for the selected day.
- It does **not** track labour hours into the calendar or any other tool's data. (Future: labour tracking may be incorporated into the calendar; out of scope now.)
- It does **not** persist completion state anywhere — check-offs live only in the open page's memory.

## Task Model

A daily task is a small record stored per building under `_DailyWizard` (full schema below):

| Field | Type | Rules |
|---|---|---|
| `code` | string (4 chars) | Random lowercase alphanumeric from the alphabet `abcdefghjkmnpqrstuvwxyz23456789` (excludes confusing `0/o/1/l/i`). **Globally unique** across all buildings — regenerate on collision. Immutable after creation. Displayed as a small monospace chip on every row. Used by the step-picture filename convention (`pics/<code>_<n>.png` — see "Step Pictures"). |
| `emoji` | string | One emoji, chosen from the embedded full emoji picker (see UI section). |
| `name` | string | Non-empty task name (e.g., "Water plants", "Stock paper towels"). |
| `minutes` | integer | Estimated duration in minutes. Minimum 5, step 5 (e.g., `30`). |
| `staff` | integer | Number of staff required to do the task. Minimum 1 (e.g., `2`). |
| `days` | array of int (0–6) | Weekdays the task appears on, using JS `getDay()` values (`0`=Sun … `6`=Sat). Default: all seven `[0,1,2,3,4,5,6]`. |
| `monthDays` | array of int (1–31) | Optional day-of-month list the task *also* appears on (e.g., `[1, 15]`). Default: `[]`. |
| `steps` | array of `{ text }` | Step-by-step instructions shown in the task's detail view. Ordered; each step is free-form text. Each step can display a picture via the filename convention (see "Step Pictures") — no picture data is stored in the DB. |

Task order within a building is the **array order** — no separate sort field. Moving a task up/down rewrites its position in the array.

### Recurrence Rules

A task appears on a given date when **either** condition holds (OR semantics):

- the date's weekday is in `days`, **or**
- the date's day-of-month is in `monthDays`.

Validation: a task must have at least one weekday **or** at least one month-day — an empty combination is rejected on save.

| Example | `days` | `monthDays` | Appears on |
|---|---|---|---|
| Water plants (every day) | all 7 | `[]` | Every day |
| Stock uniforms (Mondays) | `[1]` | `[]` | Mondays only |
| Scouting rooms (weekdays) | `[1,2,3,4,5]` | `[]` | Mon–Fri |
| Deep clean / delivery (1st & 15th) | `[]` | `[1, 15]` | 1st and 15th of each month |
| Fertilizer mix (Tue/Thu + 1st) | `[2,4]` | `[1]` | Tuesdays, Thursdays, and the 1st |

### Labour Display

- Task rows show two small chips: `👥 {staff}` and `⏱ {minutes}m`.
- The task detail view shows the derived total labour: `staff × minutes / 60` person-hours (e.g., 2 staff × 30 min → "≈ 1.0 h labour").

## Step Pictures

Each step in a task's detail view can display a picture, referenced purely by **filename convention** — no picture data is stored in the database:

- **Naming:** `pics/{code}_{n}.{ext}` where `{code}` is the task's 4-letter code and `{n}` is the step's **1-based position** in the steps array (Step 1 → `j234_1`, Step 2 → `j234_2`). The `pics/` folder lives next to `DailyWizard.html`.
- **Extension fallback:** for each step, probe `.png` → `.jpg` → `.webp` in order and use the first that loads (photos are usually JPG).
- **Loading mechanism:** plain `<img src="pics/...">` tags. This works on **both** deployment protocols:
  - **http (GitHub Pages):** normal same-origin loading — `pics/` must be committed to the repo.
  - **file:// (local/offline):** relative image tags load fine from a double-clicked HTML file in Chrome, Firefox, and Safari. The `file://` CORS sandbox blocks *programmatic* access (`fetch()`, XHR) but not tag-based resource loading, so no server is required.
- **Existence probing:** to detect missing files without `fetch()`, create an `Image()` object, set its `src`, and listen for `onerror`. A missing picture renders as a muted placeholder chip showing the expected filename (e.g., `🖼 j234_1.png not found`) so the manager knows exactly what to name/copy.
- **Refresh:** browsers cache failed image loads, so the detail view includes a **🔄 Refresh images** button that re-probes all steps (bumps a cache-busting query string — harmless on `file://`, useful on http).
- **Positional binding:** pictures bind to step *position*, not identity. Reordering or deleting steps shifts which picture appears where; the manager renames files if they want a different mapping. This keeps the schema free of any picture field.
- **Manual placement only:** browsers cannot write into `pics/` from the page (no server; the File System Access API is unavailable in Firefox/Safari/iPadOS). The workflow is: manager saves photos as `pics/{code}_{n}.jpg|png` (phone camera → rename/copy, or desktop), opens the task's detail view, and hits Refresh.
- **Repo hygiene (GitHub Pages):** recommend resized photos (~1280 px max width, JPG) so committing `pics/` to the repo stays lean.

## Calendar Event Attribution (Building Resolution)

After rendering a building's daily tasks for the selected date, DailyWizard appends that building's **scheduled calendar events** for the same day, read from `DB.data.calendarEvents`. Multi-day events appear on every day in their `[date, endDate]` range (inclusive), matching the suite's calendar rendering rule. Events are displayed read-only (emoji + title) with their own large checkbox — checking them off is session-only like daily tasks.

Each event is attributed to a building by resolving its physical room:

```
buildingForEvent(event):
    1. If event.roomId exists and DB.rooms[event.roomId] exists
         → return DB.rooms[event.roomId].buildingId
       (CropProjection events always carry roomId; EquipmentWizard events use their roomId.)
    2. Else if event.lotId exists and DB.lots[event.lotId] exists
         → resolve the lot's physical room for this task using CropLabourWizard's phase rules:
             taskType in { clone_cut_prep, clone_room_clean }            → lot.cloningRoom
             taskType in { planting, ipm_spray_veg_early, topping,
                           order_ipm, veg_room_clean }                   → lot.vegRoom
             everything else (incl. transplant and all post-transplant)  → lot.destRoom
           resolve the room name to a room ID via rooms.<roomId>.name,
           then return DB.rooms[roomId].buildingId
    3. Else if the title starts with a room-ID prefix → return DB.rooms[prefix].buildingId.
       CropLabourWizard embeds the room ID in event titles when the lot's room was known
       at generation time ("🧼 B66DG2-Strain#123, Task", "💡 B66DG2#123, ...").
       The prefix is validated against DB.rooms, so only real room IDs match.
       This covers events whose lot record was deleted but whose events remain.
    4. Otherwise → null (unattributable)
```

- **Single-room fallback:** if the phase rule's room field is empty but the lot has exactly one resolvable room across all three fields (`cloningRoom`, `vegRoom`, `destRoom`), the event is attributed to that room's building. This covers lots created with only a destination room.
- **Title-prefix fallback (last resort):** when neither `roomId` nor a live lot record resolves, the leading room-ID prefix in CLW titles is used — but only if it names an existing room in `DB.rooms`. Strain names or free-form text that merely resemble a room ID never match.
- **Unattributable events** (GeneralEvent entries with no lot/room, or events whose room/lot can't be resolved, or rooms with no `buildingId`) never appear in a single-building view. In the **All Buildings** view they are collected into a muted "📌 Unassigned / General" section at the bottom so nothing silently disappears.
- A lot whose rooms span multiple buildings is attributed per-task via the phase rules above — an event shows under exactly one building (the room where that task physically happens).
- DailyWizard never modifies events; it only reads `date`, `endDate`, `title`, `sourceTool`, `lotId`, `roomId`, and `taskType`.

## Completion State — Session-Only

- Check-off state lives in a plain in-memory JS map keyed by `{ selectedDate }:{ itemKey }`, where `itemKey` is the task `code` for daily tasks and a composite of `sourceTool + lotId/roomId + date + title` for calendar events.
- Checking/unchecking a row **never** calls `notifySitkaTools()`, never mutates `DB.data`, and is lost when the page closes or reloads. This is deliberate: on tablets the tool is purely informational for staff coordination.
- **Reset Day button** (footer): clears all check-offs for the currently selected date after a confirm prompt. Check-offs for other dates remain in memory while the page stays open.
- Completed rows stay in place (no auto-move to bottom) and render with an accent check, muted text, and strikethrough on the task name.
- Progress is shown live: overall `✅ done/total` in the status bar, and per-building `done/total` in each section header of the All Buildings view.

## Database Key — `_DailyWizard`

All of this tool's data lives under one top-level key, owned exclusively by DailyWizard:

```json
{
  "_DailyWizard": {
    "buildings": {
      "B66D": {
        "tasks": [
          {
            "code": "j234",
            "emoji": "💧",
            "name": "Water plants",
            "minutes": 30,
            "staff": 1,
            "days": [0, 1, 2, 3, 4, 5, 6],
            "monthDays": [],
            "steps": [
              { "text": "Check each room's drip lines for pressure before starting." },
              { "text": "Water in order: G1 → G2 → G3. Log any dry spots on the whiteboard." }
            ]
          },
          {
            "code": "k9m2",
            "emoji": "🧤",
            "name": "Stock glove holders",
            "minutes": 10,
            "staff": 1,
            "days": [1],
            "monthDays": [],
            "steps": []
          }
        ]
      }
    }
  }
}
```

Rules:

- **Ownership:** DailyWizard is the only tool that reads or writes `_DailyWizard`. No other tool may touch it.
- **Buildings are keyed by building ID** (matching `DB.data.buildings`). A building entry with no tasks yet is simply absent — absence means "no daily tasks defined".
- **Orphaned entries:** if a building exists in `_DailyWizard.buildings` but no longer exists in `DB.data.buildings` (deleted in SitkaTools), it still appears in the building selector with a ⚠️ suffix so the manager can review and delete its task list. Orphaned buildings are excluded from the All Buildings view.
- **No calendar events:** this tool appends nothing to `calendarEvents`.

## Shared Suite Standard — Tool-Owned Keys & JSON Import/Export

DailyWizard's pattern is now the **shared suite standard** for per-tool data: each tool owns exactly one top-level DB key (DailyWizard → `_DailyWizard`, CropLabourWizard → `_CropLabourWizard`, etc.), reads/writes only its own key, and supports standalone file import/export of that data. CropLabourWizard's **Task Recipes** feature follows this same pattern — recipes live under `_CropLabourWizard.recipes` and are imported/exported as self-contained `recipe-<id>.json` files via an explicit file picker (no auto-loading of adjacent JSONs). See the root `Agent.MD` → "Task Recipes" for the full contract.

### CLW Event Attribution — `roomPhase`

When attributing CropLabourWizard events to a building (`buildingForEvent`), DailyWizard checks an **explicit `ev.roomPhase` first** (written by CropLabourWizard when the recipe task specifies one): `'cloning'` → the lot's cloning room, `'veg'` → veg room, `'flower'` → destination room. Only when `roomPhase` is absent does it fall back to the known-type lists (`CLW_CLONE_ROOM_TYPES`, `CLW_VEG_ROOM_TYPES`) and then default to the destination room. This lets custom recipe tasks carry their own room attribution without DailyWizard needing to know about each new task type.

## Relationship to SitkaTools

DailyWizard is part of the SitkaGit suite: a standalone single-file HTML application, vanilla HTML/CSS/JS, no build step, no network calls, running in the browser sandbox (`file://`).

### Two Launch Modes

1. **From SitkaTools (normal subtool mode):** Opens as a popup window per the suite convention; receives the DB via `postMessage` (`sitkaGit_db`), acknowledges with `sitkaGit_ready`, and calls `notifySitkaTools()` after every **task definition** mutation (add/edit/delete/move task, edit steps). Check-offs never trigger a sync.
2. **Standalone (tablet mode):** Opened directly on a tablet with no opener window. The header shows two extra buttons (hidden when an opener exists):
   - **📂 Load** — file input to load the current `DB-YY-MM-DD.json` database file (standard suite import pattern).
   - **💾 Export** — downloads the full database (`URL.createObjectURL` + `<a download>`) with any task definition edits included, so the tablet can save its work back to the shared file. Check-off state is never exported.

   Without a loaded DB the tool shows an empty-state prompting to load one (or, in subtool mode, waiting for the postMessage delivery).

### Standard postMessage Pattern

DailyWizard includes the standard subtool pattern from the root `Agent.MD` (`notifySitkaTools()` + `sitkaGit_db` listener with `sitkaGit_ready` ack), with one addition: it also handles **live** `sitkaGit_db_update` pushes from SitkaTools non-disruptively — refresh the building selector, status bar, and current list without disturbing check-off state or an open editor.

## UI Convention

Follows the shared UI Standards in the root `Agent.MD` (theme variables, sticky header/footer, card styles, `DB` object pattern). DailyWizard-specific layout:

```
┌──────────────────────────────────────────────┐
│ 📋 DailyWizard   [Building ▾] [📅 date]      │  ← sticky header
│                    (📂 Load 💾 Export — standalone only)
├──────────────────────────────────────────────┤
│ Status bar: 🏢 3 buildings · 📝 12 today · ✅ 4/12 done
├──────────────────────────────────────────────┤
│ [ + Add Task ]            (single-building mode only)
│                                              │
│ ☐ 💧 Water plants   j234  👥1 ⏱30m   ▲ ▼    │  ← daily task row
│ ☐ 🧤 Stock gloves   k9m2  👥1 ⏱10m   ▲ ▼    │
│ ── Scheduled today (calendar events) ─────── │
│ ☐ 🌸 B66DG1-Purple Haze#LOT-001, Flip …     │  ← event row (no move buttons)
│ ── Upcoming (next calendar events) ───────── │
│   🌾 LOT-001, Harvest            [Fri 25 Sep]│  ← read-only, date chip, no checkbox
├──────────────────────────────────────────────┤
│ [ Reset Day ]                 [ Close Tool ] │  ← sticky footer
└──────────────────────────────────────────────┘
```

### Header

- **Logo:** `📋 DailyWizard` on the left.
- **Building selector** (label "Building"): first option `— All Buildings —`, then every building from `DB.data.buildings` (`{id} — {name}`), plus any orphaned `_DailyWizard` buildings with a ⚠️ suffix. Selecting a building shows its list; "All Buildings" shows the combined view.
- **Date input** (`<input type="date">`): defaults to today. Changing it re-renders the list for that date (recurrence filtering + event range matching). Lets the manager preview tomorrow or review yesterday.
- **Load / Export buttons** (`db-btn` style): visible only in standalone mode (no `window.opener`).

### Status Bar

Standard status-bar card: e.g. `🏢 3 buildings · 📝 12 tasks today · ✅ 4/12 done`. Gains the `.loaded` accent border once a DB is present. In All Buildings mode the task count is the combined total across buildings (calendar events excluded from the count).

### Task Rows (the core tablet UI)

Each row, left to right:

1. **Large checkbox** — a custom-styled checkbox with a minimum **48×48 px touch target** (visually ~32 px box inside generous padding). Tapping it toggles completion only; this is the primary thumb interaction on tablets.
2. **Emoji** at ~1.5 rem.
3. **Task name** — tapping anywhere else on the row opens the task's **detail view**.
4. **Code chip** — small monospace muted chip (e.g., `j234`).
5. **Labour chips** — `👥 {staff}` and `⏱ {minutes}m`.
6. **Move buttons** `▲ ▼` — single-building mode only; disabled at the list ends. Hidden in All Buildings mode (ordering is per-building).

Completed rows: accent-filled checkbox, muted row background, strikethrough name. Rows are never reordered by completion.

Calendar event rows use the same anatomy minus the code chip and move buttons; their emoji comes from the event title.

### Upcoming Section

After the "Scheduled today" events, a second divider — **Upcoming (N)** — lists the next **5** calendar events starting *after* the selected date:

- **Scope:** single-building mode shows only events attributed to that building; All Buildings mode shows all upcoming events (including unassigned ones).
- **Dedup:** an event already shown in "Scheduled today" (its `[date, endDate]` range covers the selected date) is not repeated. Multi-day events are deduped by `sourceTool + lotId/roomId + title`, so a 3-day trim shows once.
- **Ordering:** by start date, then title.
- **Rows:** read-only — no checkbox (completion only makes sense on the day itself), same emoji + title anatomy, plus a monospace date chip (`Fri 25 Sep`).
- Omitted entirely when there are no upcoming events in scope.

### All Buildings (Combined) View

- One **section per building** (in `DB.data.buildings` order), each with a section header: building name + `done/total` progress chip, then that building's daily task rows, then its scheduled events under the same "Scheduled today" divider.
- Buildings with no tasks defined for the selected day show a muted "No daily tasks for this date." line (their events still render if any).
- A muted **📌 Unassigned / General** section at the bottom collects unattributable events (see attribution rules).
- After all building sections, a single **Upcoming (N)** section lists the next 5 calendar events across all buildings (see Upcoming Section).
- No Add Task or move controls in this view.

### Task Detail View

Tapping a task row body opens a full-screen overlay (same theme):

- Header: large emoji + name, code chip, back button (←).
- Summary block: labour (`👥 staff · ⏱ minutes · ≈ N.N h labour`), recurrence in plain language ("Every day" / "Mon, Wed, Fri" / "1st & 15th of each month" / combinations joined with "and").
- **Steps list:** ordered steps, each editable inline (tap to edit text), with add-step, delete-step, and move up/down per step. Steps are stored on the task in `_DailyWizard`. Each step renders its picture (`pics/{code}_{n}.png` — see "Step Pictures") when present, otherwise a muted "not found" chip; a **🔄 Refresh images** button at the top of the list re-probes all steps.
- Footer actions: **Edit Task** (opens the task editor pre-filled), **Delete Task** (confirm dialog; removes from `_DailyWizard` and notifies SitkaTools).

### Task Editor (Add / Edit)

A card form (overlay or inline panel) with:

- **Emoji picker** — see below.
- **Name** — text input, required.
- **Estimated time** — number input, minutes, min 5, step 5.
- **Staff required** — number input, min 1.
- **Weekdays** — seven pill toggle buttons in display order Mon → Sun (values `1,2,3,4,5,6,0`), all on by default; tap to toggle.
- **Also on day(s) of month** — text input accepting a comma-separated list of 1–31 (e.g., `1, 15`), validated and deduplicated on save, plus quick preset chips: `1st & 15th`, `1st only`, `Clear`.
- **Save / Cancel.** Validation: name non-empty; at least one weekday or one month-day; minutes ≥ 5; staff ≥ 1. New tasks get a freshly generated unique `code` and are appended to the building's task array.

### Emoji Picker — Full Embedded Picker

GeneralEvent uses a fixed row of ~15 preset emojis; DailyWizard needs a **full picker**, implemented entirely inline (no external library or network):

- A button showing the current emoji opens an expanding panel above/below it containing:
  - A **search input** (filters by keyword, e.g., "water", "clean", "scissors").
  - **Category tabs:** Smileys · People & Hands · Animals & Nature · Food & Drink · Objects · Activities · Travel · Symbols.
  - A scrollable grid of emoji buttons (~300 curated emojis total across categories — a practical "full" set for operational tasks: watering, cleaning, gloves, paper towels, uniforms, scouting, spraying, lights, tools, delivery, etc.). All emoji data is embedded in the HTML file as JS arrays.
- Selecting an emoji fills the field and closes the panel. Default when creating a task: 📋.

### Footer

Sticky footer per suite convention with one addition for this tool:

```html
<footer class="footer">
    <button class="btn btn-secondary" id="resetDayBtn">Reset Day</button>
    <button class="btn btn-secondary" id="closeToolBtn">Close Tool</button>
</footer>
```

- **Reset Day** — clears check-offs for the selected date (confirm first). Disabled when nothing is checked.
- **Close Tool** — `window.close()`; in standalone mode this simply closes the tab.

### Empty States

- No DB loaded (standalone): centered prompt with the 📂 Load button.
- Building with no tasks: "No daily tasks defined for {building} yet." + prominent **+ Add Task** button.
- Tasks defined but none recur on the selected date: "No daily tasks scheduled for this date." (events section still renders if non-empty).

## Tablet / Standalone Considerations

- Designed to be launched standalone on tablets in the buildings: everything must work with **touch only** — no hover-dependent UI, all interactive targets ≥ 48 px, large checkboxes as the primary control.
- Works fully offline over `file://` — no network calls, no external fonts/CDNs; emoji picker data is embedded.
- The layout should remain usable in portrait orientation at typical tablet widths (~768–1024 px); rows stack chips gracefully on narrow screens.
- Check-off state is intentionally ephemeral (see Completion State) — the tool must never prompt to save check-offs or attempt to sync them.

## Constraints

- Single `.html` file, no build step, no external dependencies
- Runs in browser sandbox (`file://` protocol)
- Vanilla HTML/CSS/JavaScript only
- No network calls of any kind
- No localStorage, sessionStorage, IndexedDB, or cookies — cross-window state flows through postMessage; standalone persistence is via DB file import/export only
- Reads `calendarEvents`, `rooms`, `buildings`, and `lots` (for attribution) but writes **only** to `_DailyWizard`

## Deferred Features

- **Labour tracking:** future incorporation of actual labour hours into the calendar is explicitly out of scope for now — check-offs remain informational only.
