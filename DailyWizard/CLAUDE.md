# DailyWizard — Tool Context

## What This Tool Does

DailyWizard is a **daily to-do list builder and floor view** for the SitkaGit suite. CropLabourWizard tracks the big crop jobs (planting, flip, harvest, trim…), but nothing covers the small essential activities that happen every day in each building — watering plants, mixing fertilizer, scouting rooms, stocking paper towels, stocking uniforms, stocking glove holders, and similar. DailyWizard fills that gap:

1. **Build per-building daily task lists.** The manager defines a set of recurring daily tasks for each building (emoji, name, estimated time, required staff). Task lists are saved directly to this tool's own database key (`_DailyWizard`) — they are *definitions*, not one-off events, and they never touch `calendarEvents`.
2. **Show the day.** For any date (default: today), the tool renders that building's tasks for that day, followed by that building's scheduled calendar events from the main database (CropLabourWizard, CropProjection, EquipmentWizard, GeneralEvent) for the same day — giving staff one complete picture of what happens in the building today.
3. **Check things off.** Every row has a large thumb-friendly checkbox. A tick is **saved for that day** in the building's own file (each new day starts blank), so staff and the floor manager can see on any device what's been done today (see "Check-offs — Saved Per Day").
4. **Log hours.** Each daily-task row, and each crop (CropLabourWizard) or equipment (EquipmentWizard) task in "Scheduled today" or "⏰ Still open", has a **⏱ Log** button. Staff pick their name, type hours and minutes, and sign with drawn initials. The hours save in the building's own file and feed EmployeeWizard's Tasks tab and Reports (see "⏱ Hours").
5. **Keep tasks open until they're done.** A building's crop and equipment tasks whose day has passed stay listed under **⏰ Still open** until the floor manager signs them off with **✍️ Mark done**: their name and drawn initials (see "⏰ Still open and ✅ Mark done").
6. **Speak the worker's language.** A **🌐 Language** picker switches the whole screen to French, Spanish, Vietnamese or Simplified Chinese, and shows each chore's name and steps in that language once the manager has written them (see "🌐 Language").

### Intended Use

- **Planning (manager, desktop or tablet):** Pick a building, build/edit/reorder its daily task list, write step-by-step instructions for any task. Changes save to `_DailyWizard` and sync back to SitkaTools via postMessage when launched from the main app.
- **Floor view (staff, tablet in the building):** Open SitkaTools on the tablet, launch DailyWizard from it (it opens as a tab), pick the building (or "All Buildings"), and work down the list with big checkboxes. A "Reset Day" button clears all check-offs for a fresh start.
- **Combined overview:** The "All Buildings" view shows every building's list for the day, grouped by building, so one tablet can coordinate multiple buildings.

### What This Tool Is NOT

- It does **not** create, edit, move or delete `calendarEvents`. It reads them to display a building's crop and equipment tasks. On a crop or equipment event it writes only:
  - labour hours, added to the event's `labour_map` (the same field EmployeeWizard's Tasks tab edits — see "⏱ Hours");
  - the floor manager's sign-off: `completed` and `completedBy` (see "✅ Mark done").
- Chore hours live in its own key (`_DailyWizard.buildings[<id>].labour`).
- Row **check-offs** (the big checkboxes) say what's done *today*; they are saved per day with the building's chore hours. On a crop or equipment row a tick means today's part is done. ✅ Mark done is what finishes the task.

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
| `steps` | array of `{ text, translations? }` | Step-by-step instructions shown in the task's detail view. Ordered; each step is free-form text. Each step can display a picture via the filename convention (see "Step Pictures") — no picture data is stored in the DB. `translations` holds the step in other languages (see "🌐 Language"). |
| `translations` | object, optional | The task's name in other languages: `{ fr: 'Arroser les plantes', es: 'Regar las plantas' }`. Absent until one is written. `name` stays the English master (see "🌐 Language"). |

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
- **Crop tasks** (CropLabourWizard / CropProjection events) whose recipe task has a labour estimate show the same two chips, from the event's `estStaff` / `estMinutes` — the estimate for one day, so a multi-day task like Trim shows its per-day figure on each of its days. Long times read as hours (`⏱ 8h`, `⏱ 1h 30m`). Events without an estimate show no chips.

## Step Pictures

Each step in a task's detail view can display a picture, referenced purely by **filename convention** — no picture data is stored in the database:

- **Naming:** `pics/{code}_{n}.{ext}` where `{code}` is the task's 4-letter code and `{n}` is the step's **1-based position** in the steps array (Step 1 → `j234_1`, Step 2 → `j234_2`). The `pics/` folder lives next to `DailyWizard.html`.
- **Extension fallback:** for each step, probe `.png` → `.jpg` → `.webp` in order and use the first that loads (photos are usually JPG).
- **Videos** (added 2026-10-17): a step can also have `pics/{code}_{n}.mp4`. It is probed with a `<video>` element that loads only the metadata (no `fetch()`), and plays in the step with the browser's controls (`playsinline`, nothing autoplays).
  - When a step has both, the picture shows first, then the video. A step with neither shows `🖼 j234_1.png / .mp4 not found`.
  - Use **H.264** mp4. A video the browser can't decode (e.g. HEVC from some phones) probes as missing.
  - Keep videos short and compressed. GitHub refuses files over 100 MB, and every tablet streams the file.
- **Loading mechanism:** plain `<img src="pics/...">` tags. This works on **both** deployment protocols:
  - **http (GitHub Pages):** normal same-origin loading — `pics/` must be committed to the repo.
  - **file:// (local/offline):** relative image tags load fine from a double-clicked HTML file in Chrome, Firefox, and Safari. The `file://` CORS sandbox blocks *programmatic* access (`fetch()`, XHR) but not tag-based resource loading, so no server is required.
- **Existence probing:** to detect missing files without `fetch()`, create an `Image()` object, set its `src`, and listen for `onerror`. A missing picture renders as a muted placeholder chip showing the expected filename (e.g., `🖼 j234_1.png not found`) so the manager knows exactly what to name/copy.
- **Refresh:** browsers cache failed image loads, so the detail view includes a **🔄 Refresh images** button that re-probes all steps (bumps a cache-busting query string — harmless on `file://`, useful on http).
- **Positional binding:** pictures bind to step *position*, not identity. Reordering or deleting steps shifts which picture appears where; the manager renames files if they want a different mapping. This keeps the schema free of any picture field.
- **Manual placement only:** browsers cannot write into `pics/` from the page (no server; the File System Access API is unavailable in Firefox/Safari/iPadOS). The workflow is: manager saves photos as `pics/{code}_{n}.jpg|png` (phone camera → rename/copy, or desktop), opens the task's detail view, and hits Refresh.
- **Uploading pictures** (built 2026-10-17; user decision: kept only while the window is open). For a copy that isn't run next to its `pics/` folder, such as the online one, the steps view has two buttons:
  - **📁 Upload image pack:** pick a folder, e.g. the pack folder in the SharePoint / OneDrive sync.
  - **🖼 Upload images / videos:** pick the files themselves. Android Chrome may not offer folder picking, so select all the files in the pack folder this way there.
  - **Matching:** only the file name counts: `{code}_{n}.png|jpg|jpeg|webp` for the picture and `{code}_{n}.mp4` for the video. Subfolders and leading zeros (`j234_01.jpg`) are fine. Within one pick, png beats jpg beats webp, as in the `pics/` probe. A later pick replaces an earlier file of the same step.
  - **Where they go:** they're read into the window as object URLs (`uploadedPics`, `uploadedVids`) and win over `pics/`. They're never stored in the browser or sent anywhere, so a new window needs the pack picked again.
  - **Feedback:** a toast reports how many pictures and videos loaded, names that don't fit the pattern, and files whose code matches no task. A note in the steps view shows how many uploaded pictures and videos are in use.
- **Repo hygiene (GitHub Pages):** recommend resized photos (~1280 px max width, JPG) so committing `pics/` to the repo stays lean.

## Calendar Event Attribution (Building Resolution)

After rendering a building's daily tasks for the selected date, DailyWizard appends that building's **scheduled calendar events** for the same day, read from `DB.data.calendarEvents`. Multi-day events appear on every day in their `[date, endDate]` range (inclusive), matching the suite's calendar rendering rule. Events are displayed read-only (emoji + title) with their own large checkbox — ticked and saved per day like daily tasks.

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
- DailyWizard reads `date`, `endDate`, `title`, `sourceTool`, `lotId`, `roomId`, `roomPhase`, `taskType`, `completed` / `completedBy`, and the labour estimate `estStaff` / `estMinutes`. It writes `labour_map` (hours logged on a crop or equipment task) and `completed` / `completedBy` (✅ Mark done).

## Check-offs — Saved Per Day

Saved since 2026-10-13. User decisions: one tap by anyone, recording the time and device; ticks on crop and equipment rows are saved as "today's part done".

- **Where:** `_DailyWizard.buildings[<id>].checks[<YYYY-MM-DD>][<item>] = { at, by }`.
  - `item` is the daily task's `code`, or `ev:<event id>` for a calendar row.
  - `at` is the ISO time ticked; `by` is the device (a building id or `office`).
  - It lives with the building's chore hours, so it saves in `Building-<ID>.json` (SitkaTools split). A building with no daily tasks gets a bare `{ tasks: [] }` entry the first time one of its event rows is ticked.
- **Each new day starts blank:** ticks are kept by day, so another date shows only its own.
- **Ticking** a row adds the record and **unticking** deletes it (empty days and maps are tidied away); both call `notifySitkaTools()`. No signature is asked for. ✅ Mark done is the signed completion of a crop or equipment task, and a tick doesn't change `completed`.
- **Rows that can't be saved:** an event that belongs to no building (All Buildings → "📌 Unassigned / General") has no file to go in, so its tick stays in the page only (`sessionChecks`), as all ticks used to.
- **Reset Day button** (footer): clears the selected date's ticks in the buildings shown (the selected building, or every building in All Buildings), after a confirm. Other dates are left alone.
- Completed rows stay in place (no auto-move to bottom) and render with an accent check, muted text, and strikethrough on the task name.
- Progress is shown live: overall `✅ done/total` in the status bar, and per-building `done/total` in each section header of the All Buildings view.

## ⏱ Hours

Built 2026-10-12 (ROADMAP Phase 1, "Labour in DailyWizard"), following the roadmap decisions: each entry is the person's name, the hours and minutes they type, and their own drawn initials.

- **Where the button is:**
  - every daily-task row;
  - every CropLabourWizard or EquipmentWizard row in "Scheduled today" whose building is known. Projections, general events and the Upcoming list get none.
- **The row button:** shows `⏱ Log`, or the hours logged for the selected date (`⏱ 1h 15m`, in the accent colour). It is disabled for future dates, and tapping it never opens the task detail.
- **The hours view** (full-screen overlay, like the task editor):
  - the entries for that row and day, each with name, hours, an initials thumbnail and the time it was logged. An entry made in EmployeeWizard's Tasks tab shows "Entered in EmployeeWizard";
  - the day's total against the estimate (chore: staff × minutes; crop task: `estStaff` × `estMinutes`);
  - a form: **Who** (roster names from `_EmployeeWizard.employees`, plus "Someone else (not on the roster)…" with a name box and an optional **hourly wage** box for temps), **Hours**, **Minutes**, and an **initials pad**.
- **Validation:** **Add hours** needs a name, more than 0 and at most 16 hours, and at least one stroke on the pad.
- **Where the hours go:**
  - **Chore:** `_DailyWizard.buildings[<id>].labour[<day>][<code>]`.
  - **Crop or equipment task:** the event's `labour_map[<day>]`. This is the same field EmployeeWizard's Tasks tab edits (it marks these entries "✍️ signed"), that CropLabourWizard and EquipmentWizard carry over on regeneration, and that the Reports read. It's a floor field, so a building device's entries save in its own file as an overlay (SitkaTools DbSplit).
- **Corrections:**
  - A **building device** can remove only an entry it logged itself, on the **day it was logged** (a same-day correction). The entry is deleted.
  - The **office** (or a single-file DB) can remove any entry, including ones entered in EmployeeWizard.
  - An entry the office removes after its day is deleted from the hours and **kept on record** in the building's adjustments log. It stays visible, struck through, in the hours view. So the hours themselves stay clean for every tool that reads them.
- **Live updates:** an open hours view re-renders its list on `sitkaGit_db` / `sitkaGit_db_update`. The form fields and the initials being drawn are left alone.
- **Check-offs** are separate from hours (see "Check-offs — Saved Per Day").
- **Where to see them all:** EmployeeWizard's **📜 Labour Log** tab lists every entry, chores and tasks, with who, what, when it was logged, on which device, the drawn initials and the office's removals. The office sees every building; a building device sees its own.
- **A signed entry changed in EmployeeWizard's Tasks tab** keeps `signedHours` / `editedAt` / `editedBy`. The hours view shows "signed for 1h 15m, changed in EmployeeWizard …" under it.
- **A window that lost its link:** if SitkaTools is reloaded or closed while this popup stays open, a cover says so, and an entry added anyway is reported as not kept (root `CLAUDE.md` → postMessage rule 10).
- **Reports:** EmployeeWizard's Reports read chore hours (`rptChoreLabour`) and event hours (`labour_map`): labour mix, labour hours, logged vs scheduled, estimate vs actual, and $ per gram.
  - A temp's typed wage is used for cost.
  - A temp with no wage counts in hours. A crop with such hours is left out of $ figures, the same rule as any missing wage.

## ⏰ Still open and ✅ Mark done

Built 2026-10-13 (user decisions: Still open only in a single building's view, not All Buildings; Mark done prompts for the floor manager's signature).

- **⏰ Still open** (`appendStillOpenSection`), between the daily tasks and "Scheduled today" in a single building's view:
  - **What it lists:** the building's CropLabourWizard and EquipmentWizard events (with an `id`) whose last day (`endDate || date`) is before the selected date and that aren't `completed`. The building comes from `buildingForEvent`, as for "Scheduled today".
  - Projections, general events and the All Buildings view never show it.
  - Oldest first, each with a `due Mon 12 Oct · 1 day overdue` chip and a warning-coloured left edge. The 10 oldest show; **+ N more** unfolds the rest for the session.
  - Rows have no check-off box, but do have **⏱ Log** and **✍️ Mark done**.
  - Hours logged there go on the **selected day** (`labour_map[<selected day>]`), even though it's outside the task's dates. That is EmployeeWizard's "+ Add day" convention, so its totals, the Labour Report, the Reports and the Labour Log all count them. The estimate shown is still the task's per-day estimate.
- **✍️ Mark done** (`makeDoneButton` → the Mark done view), on every crop and equipment row whose building is known: Still open, and Scheduled today in both views.
  - It shows **✅ Done** once the task is completed (the tooltip names who signed it off).
  - It is disabled for future dates.
- **The Mark done view:**
  - the task, its building and due dates;
  - **Floor manager:** the roster employees ticked "Floor manager" in EmployeeWizard (`employees[name].floorManager`). When none is ticked, everyone on the roster is listed, with a note saying so;
  - the floor manager's **initials pad**.
  - **✅ Mark done** needs a name and at least one stroke. It sets `completed: true` and `completedBy`, then calls `notifySitkaTools()`.
- **`completedBy`** = `{ name, initials: { name, strokes }, at, by, day }`: the floor manager, their drawn initials (PaperWizard's stroke format), the ISO time, the device (a building id or `office`) and the day the view was on.
  - It's a floor field like `completed`, so a building device saves it in its own file (root `CLAUDE.md` → "Split Database").
  - CropLabourWizard and EquipmentWizard carry it over when they regenerate an event.
  - SitkaTools' event panel shows "Completed — signed off by …".
  - Un-ticking Completed in SitkaTools (event panel or terminal) or reopening in EmployeeWizard's Tasks tab deletes it. Ticking Completed there doesn't ask for a signature, so such tasks show as "Marked done in SitkaTools or EmployeeWizard (not signed)".
- **Reopen** (in the Mark done view of a done task) follows the hours rules:
  - a building device may reopen a sign-off it made itself, today;
  - the office may reopen any.
  - Reopening clears `completed` and `completedBy`.
  - A sign-off the office reopens after its day is kept on record in the building's adjustments log, as `{ at, by, date, eventId, title, reopened: <the sign-off> }`. It has no `entry`, so the hours view and the Labour Log skip it.

## 🌐 Language

Built 2026-10-17 (user decisions: daily chores only, not crop or equipment task names; the screen's own buttons and labels translate too; French, Spanish, Vietnamese and Simplified Chinese).

- **The picker:** **🌐 Language** is the first control in the header. It lists English, Français, Español, Tiếng Việt and 中文（简体）, each in its own language. English is the default every time the tool opens. The choice lasts while the window is open; nothing is stored in the browser.
- **English is the master.** Every task `name` and step `text` stays in English in the DB, and every other tool reads only that. Translations sit next to it and only change what DailyWizard shows:
  - a task's name: `task.translations[<lang>]`;
  - a step: `step.translations[<lang>]`.
  - Language codes are `fr`, `es`, `vi`, `zh`. An empty translation is removed, and an empty `translations` map with it.
  - They live in the task list, so they save in the building's own file like the rest of it.
- **What's missing:**
  - A task **name** with no translation in the chosen language shows the English, with a small dashed **EN** tag (tooltip "Not translated yet — showing English").
  - A **step** with none shows **blank** (user decision 2026-10-17), so the floor only ever reads a real translation. Its number, picture and ▲ ▼ 🗑 stay. The empty, dashed line is where you tap to paste the translation. Switching language shows each language's own steps.
- **Writing translations** (pick the language first):
  - **Name:** Add / Edit Task shows a second field, **Name (<language>)**. Blank shows the English name. The first field is then labelled "Name in English" and is still required.
  - **Steps:** in the task detail view, tapping a step (or an untranslated step's blank line) edits its translation, with the English shown under the box while you type. Clearing it makes the step blank again in that language. ▲ ▼ 🗑 move or delete the step in every language.
  - **+ Add Step** is off in another language: new steps are written in English first, then translated.
  - A step being typed when the language changes is saved in the language it was started in.
- **The screen's own text** (buttons, labels, section headers, toasts, confirms, the hours and Mark done views, the task editor, emoji categories, the tablet's "Go back to SitkaTools to save" banner) comes from `UI_TEXT` at the end of the script. It is keyed by the English text, with `fr` / `es` / `vi` / `zh` side by side, and `T(english, vars)` looks it up, filling `{placeholders}`. A string missing from `UI_TEXT` shows in English. Dates, weekdays and times follow the language (`toLocaleDateString`; `1 h 30 min`, `1小时30分钟`). English output is exactly as before.
- **Stays in English:** crop and equipment task titles (they come from other tools), building, room and staff names, task codes, the emoji search keywords (the placeholder says to search in English), and the lost-link cover (a shared snippet, rarely seen).
- **Translations were written for the tool, not by native speakers.** Have each language checked on the floor and correct `UI_TEXT` where needed.
- **Adding a language:** add it to `LANGS` (code, its own name, a locale for dates) and a column to every `UI_TEXT` entry.

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
            "translations": { "es": "Regar las plantas" },
            "steps": [
              { "text": "Check each room's drip lines for pressure before starting.",
                "translations": { "es": "Revise la presión de las líneas de goteo de cada sala antes de empezar." } },
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

**Chore hours and the adjustments log** sit next to a building's task list:

```json
"labour": {
  "2026-10-12": {
    "j234": [
      { "id": "le_k3m9qa2xtd", "employee": "Kasia", "hours": 1.25, "initials": { "name": "Kasia", "strokes": [[0.2, 0.6, 0.3, 0.4]] },
        "at": "2026-10-12T20:49:00.000Z", "by": "B6" }
    ]
  }
},
"checks": {
  "2026-10-12": {
    "j234": { "at": "2026-10-12T15:02:00.000Z", "by": "B6" },
    "ev:ev_2e5zv837bsc": { "at": "2026-10-12T19:40:00.000Z", "by": "B6" }
  }
},
"adjustments": [
  { "at": "2026-10-14T16:00:00.000Z", "by": "office", "date": "2026-10-12", "code": "j234",
    "entry": { "temp": "Sam", "wage": 24.5, "hours": 0.5, "initials": { "…": "…" }, "at": "…", "by": "B6" } },
  { "at": "…", "by": "office", "date": "2026-10-11", "eventId": "ev_…", "title": "🍃 …, Late Flower Leaf Pick",
    "entry": { "employee": "Matt", "hours": 2 } }
]
```

- `labour` is keyed by day, then task `code`. Each entry has:
  - `id` (`le_` + 10 characters, `newLabourId()`): the office's and a building's hours on an event merge entry by entry by it (root `CLAUDE.md` → "Split Database"). Older entries get one derived from their content when SitkaTools opens the file;
  - `employee` (a roster name), or `temp` (a typed name) with an optional `wage`;
  - `hours` (decimal);
  - `initials` (`{ name, strokes }`, PaperWizard's normalized stroke format);
  - `at` (ISO time logged) and `by` (the device: a building id or `office`).
- Hours on crop and equipment tasks use the same entry shape, inside the event's `labour_map[<day>]`. EmployeeWizard's own entries there have no `initials` / `at` / `by`.
- `adjustments` keeps entries the office removed after their day: who removed it and when, the day, the chore `code` or the event's `eventId` and `title`, and a copy of the entry. Nothing reads it for totals; it's the record.
- The whole building entry (task list, chore hours, adjustments) is saved in that building's `Building-<ID>.json` (SitkaTools split). A building that has no daily tasks gets a bare `{ tasks: [] }` entry the first time the office removes one of its event hours.

Rules:

- **Ownership:** DailyWizard is the only tool that **writes** `_DailyWizard`. EmployeeWizard's Reports read the chore hours (read-only).
- **Buildings are keyed by building ID** (matching `DB.data.buildings`). A building entry with no tasks yet is simply absent — absence means "no daily tasks defined".
- **Orphaned entries:** if a building exists in `_DailyWizard.buildings` but no longer exists in `DB.data.buildings` (deleted in SitkaTools), it still appears in the building selector with a ⚠️ suffix so the manager can review and delete its task list. Orphaned buildings are excluded from the All Buildings view.
- **No calendar events:** this tool appends nothing to `calendarEvents`.

## Shared Suite Standard — Tool-Owned Keys & JSON Import/Export

DailyWizard's pattern is now the **shared suite standard** for per-tool data: each tool owns exactly one top-level DB key (DailyWizard → `_DailyWizard`, CropLabourWizard → `_CropLabourWizard`, etc.), reads/writes only its own key, and supports standalone file import/export of that data. CropLabourWizard's **Task Recipes** feature follows this same pattern — recipes live under `_CropLabourWizard.recipes` and are imported/exported as self-contained `recipe-<id>.json` files via an explicit file picker (no auto-loading of adjacent JSONs). See the root `CLAUDE.md` → "Task Recipes" for the full contract.

### CLW Event Attribution — `roomPhase`

When attributing CropLabourWizard events to a building (`buildingForEvent`), DailyWizard checks an **explicit `ev.roomPhase` first** (written by CropLabourWizard when the recipe task specifies one): `'cloning'` → the lot's cloning room, `'veg'` → veg room, `'flower'` → destination room. Only when `roomPhase` is absent does it fall back to the known-type lists (`CLW_CLONE_ROOM_TYPES`, `CLW_VEG_ROOM_TYPES`) and then default to the destination room. This lets custom recipe tasks carry their own room attribution without DailyWizard needing to know about each new task type.

## Relationship to SitkaTools

DailyWizard is part of the SitkaGit suite: a standalone single-file HTML application, vanilla HTML/CSS/JS, no build step, no network calls, running in the browser sandbox (`file://`).

### Launched from SitkaTools only

DailyWizard always runs through SitkaTools — there is no standalone mode or DB import/export of its own.

1. **Laptops:** opens as a popup; receives the DB via `postMessage` (`sitkaGit_db`), acknowledges with `sitkaGit_ready`, and calls `notifySitkaTools()` after every **task definition** mutation (add/edit/delete/move task, edit steps), every hours entry added or removed, every tick or untick, Reset Day, and every Mark done or reopen.
2. **Tablets:** opens as a tab and loads SitkaTools' open DB from the shared working copy (root `CLAUDE.md` → "Shared Working Copy"). A banner offers **Go back to SitkaTools to save**; task-list edits flow back to SitkaTools, which saves them to this building's `Building-<ID>.json`.

Opened by itself (no SitkaTools on the device), it shows "Open this tool from SitkaTools". Until the DB arrives, the empty state reads "Waiting for SitkaTools to deliver the database…".

### Standard postMessage Pattern

DailyWizard includes the standard subtool pattern from the root `CLAUDE.md` (`notifySitkaTools()` + `sitkaGit_db` listener with `sitkaGit_ready` ack), with one addition: it also handles **live** `sitkaGit_db_update` pushes from SitkaTools non-disruptively — refresh the building selector, status bar, and current list without disturbing check-off state or an open editor. An open task detail view refreshes too, except while a step's text is being typed: it refreshes when that edit ends, and the edit is written into the fresh DB. The step buttons (▲ ▼ 🗑, + Add Step) likewise look their task up again by building + code when tapped, so they change the fresh DB too; if the task is gone they only re-render (the view closes).

## UI Convention

Follows the shared UI Standards in the root `CLAUDE.md` (theme variables, sticky header/footer, card styles, `DB` object pattern). DailyWizard-specific layout:

```
┌──────────────────────────────────────────────┐
│ 📋 DailyWizard [🌐 ▾] [Building ▾] [📅 date] │  ← sticky header
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
- **Language selector** (label "🌐 Language"): English, Français, Español, Tiếng Việt, 中文（简体）. See "🌐 Language".
- **Building selector** (label "Building"): first option `— All Buildings —`, then every building from `DB.data.buildings` (`{id} — {name}`), plus any orphaned `_DailyWizard` buildings with a ⚠️ suffix. Selecting a building shows its list; "All Buildings" shows the combined view. On a building device (root `CLAUDE.md` → "Building Device View") the selector holds only that building and is locked.
- **Date input** (`<input type="date">`): defaults to today, and follows today while it still shows the date it set itself — a tablet left open overnight moves to the new day (checked when the window gets focus, when the tab is shown again, and once a minute). A hand-picked date is left alone. Changing it re-renders the list for that date (recurrence filtering + event range matching). Lets the manager preview tomorrow or review yesterday.

### Status Bar

Standard status-bar card: e.g. `🏢 3 buildings · 📝 12 tasks today · ✅ 4/12 done`. Gains the `.loaded` accent border once a DB is present. In All Buildings mode the task count is the combined total across buildings (calendar events excluded from the count).

### Task Rows (the core tablet UI)

Each row, left to right:

1. **Large checkbox** — a custom-styled checkbox with a minimum **48×48 px touch target** (visually ~32 px box inside generous padding). Tapping it toggles completion only; this is the primary thumb interaction on tablets.
2. **Emoji** at ~1.5 rem.
3. **Task name** — tapping anywhere else on the row opens the task's **detail view**.
4. **Code chip** — small monospace muted chip (e.g., `j234`).
5. **Labour chips** — `👥 {staff}` and `⏱ {minutes}m`.
6. **Move buttons** `▲ ▼` — single-building mode only; disabled at the ends of the list shown. A move swaps the task with the row shown above/below it, so tasks that don't run on the selected date keep their places. Hidden in All Buildings mode (ordering is per-building).

Completed rows: accent-filled checkbox, muted row background, strikethrough name. Rows are never reordered by completion.

Calendar event rows use the same anatomy minus the code chip and move buttons; their emoji comes from the event title, and the labour chips appear only on crop tasks with an estimate (see "Labour Display").

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

- **Reset Day** — clears the selected date's saved check-offs in the buildings shown (confirm first). Disabled when nothing is checked.
- **Close Tool** — `window.close()`; on a tablet this closes the tool's tab.

### Empty States

- No DB yet: "Waiting for SitkaTools to deliver the database…" (opened without SitkaTools: "Open this tool from SitkaTools").
- Building with no tasks: "No daily tasks defined for {building} yet." + prominent **+ Add Task** button.
- Tasks defined but none recur on the selected date: "No daily tasks scheduled for this date." (events section still renders if non-empty).

## Tablet Considerations

- Designed for tablets in the buildings (launched from SitkaTools as a tab): everything must work with **touch only** — no hover-dependent UI, all interactive targets ≥ 48 px, large checkboxes as the primary control.
- Works fully offline over `file://` — no network calls, no external fonts/CDNs; emoji picker data is embedded.
- The layout should remain usable in portrait orientation at typical tablet widths (~768–1024 px); rows stack chips gracefully on narrow screens.
- Check-offs are saved per day in the building's file (see "Check-offs — Saved Per Day"); saving them happens in SitkaTools, like everything else.

## Constraints

- Single `.html` file, no build step, no external dependencies
- Runs in browser sandbox (`file://` protocol)
- Vanilla HTML/CSS/JavaScript only
- No network calls of any kind
- No localStorage, sessionStorage, IndexedDB, or cookies — cross-window state flows through postMessage or SitkaTools' shared working copy; saving happens in SitkaTools
- Reads `calendarEvents`, `rooms`, `buildings`, `lots` (for attribution) and the roster in `_EmployeeWizard.employees` (names for the hours log, `floorManager` for Mark done). Writes `_DailyWizard` (task lists, chore hours, check-offs, adjustments), plus labour entries in the `labour_map` and the floor manager's sign-off (`completed` / `completedBy`) on crop and equipment events (floor fields)

## Deferred Features

- Nothing from ROADMAP Phase 1 is deferred here any more. Saved check-offs, ⏰ Still open and ✅ Mark done were built on 2026-10-13.
