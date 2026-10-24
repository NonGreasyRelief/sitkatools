# DailyWizard — Tool Context

Per-building **daily chore lists** plus that day's calendar events, as a tablet floor view. CropLabourWizard covers the big crop jobs; DailyWizard covers the small daily ones (watering, mixing fertilizer, scouting rooms, stocking paper towels, uniforms, glove holders…).

- **Planning (floor manager):** pick a building, unlock ✏️ edit mode with their PIN, then add, edit and reorder its daily tasks and write their steps ("🔒 Edit Mode and Floor Manager PINs").
- **Floor (staff, tablet):** open it from SitkaTools (a tab), pick the building or All Buildings, and work down the list.
- For any date (default today) it shows the building's tasks for that day, then that building's calendar events for the day (CropLabourWizard, CropProjection, EquipmentWizard, GeneralEvent).
- Ticks save per day ("Check-offs — Saved Per Day"); four **⏲ timers** on every row time the work ("⏲ Timers"); **⏱ Log** records hours ("⏱ Hours"); past crop and equipment tasks stay under **⏰ Still open** until the floor manager signs them off ("⏰ Still open and ✅ Mark done"); **🌐 Language** switches the screen and the chore text ("🌐 Language").

## What It Reads and Writes

- **`_DailyWizard`:** only DailyWizard writes it (task lists, chore hours, check-offs, timers, adjustments). EmployeeWizard's Reports and Labour Log read the chore hours.
- **Calendar events:** never created, edited, moved or deleted, and nothing is appended. On a crop or equipment event it writes only the floor fields `labour_map` ("⏱ Hours") and `completed` / `completedBy` ("✅ Mark done").
- **Reads:** events' `date`, `endDate`, `title`, `sourceTool`, `lotId`, `roomId`, `roomPhase`, `taskType`, `completed` / `completedBy`, `estStaff` / `estMinutes`; `rooms`, `buildings`, `lots` (attribution); `_EmployeeWizard.employees` (names for hours, `floorManager` for Mark done, `pin` for edit mode and deletions).
- No network calls (🗣️ Talk only opens a link). No browser storage beyond SitkaTools' shared working copy. Emoji data is embedded.

## Task Model

| Field | Type | Rules |
|---|---|---|
| `code` | 4 chars | Random from `abcdefghjkmnpqrstuvwxyz23456789`. **Unique across all buildings** (regenerate on collision), immutable. Shown as a monospace chip; names step pictures ("Step Pictures"). |
| `emoji` | string | One emoji from the picker. Default 📋. |
| `name` | string | Required. The English master. |
| `minutes` | int | Estimated duration. Min 5, step 5. |
| `staff` | int | Staff needed. Min 1. |
| `days` | int[] 0–6 | Weekdays, JS `getDay()` (`0`=Sun). Default all seven. |
| `monthDays` | int[] 1–31 | Extra days of the month (e.g. `[1, 15]`). Default `[]`. |
| `steps` | `{ text, translations? }[]` | Ordered instructions for the detail view. No picture data in the DB. |
| `translations` | object, optional | The name in other languages (`{ es: 'Regar las plantas' }`); see "🌐 Language". |
| `roomId` | string, optional | 🚪 One of this building's rooms: a **room chore** ("🚪 Room Chores"). Absent = a whole-building chore. |

Task order is the **array order** (no sort field); moving a task rewrites its position.

### 🚪 Room Chores

- **What it means:** the Labour & Cost Wizard's Reports give a room chore's hours to the lots scheduled in that room on the day the hours were logged, split by plants when lots share the room (the way a room's electricity is split). That share is the lot's own labour: its labour cost, cost per gram, crop Gantt and summary carry it. Whole-building chores, and room-chore hours on a day the room held no crop, stay shared over every crop harvested in the period. Root `CLAUDE.md` → "Total Cost per Gram"; `EmployeeWizard/REPORTS.md` §6.
- **DailyWizard writes only `task.roomId`.** It never works out the split or writes to lots; the hours entries are unchanged.
- **Editor:** **Room** — "— Whole building (no room) —", then the building's rooms (`id — name`). Saving with the first option removes `roomId`.
- **Shown as** a `🚪 {room}` chip on the task row, a line in the detail view's summary, and a note in the hours view.
- **Only while a lot is in the room** (user decision 2026-10-23): a room chore is listed only while some open lot's current room (`lots.<id>.currentRoom`) is that room, so "Water Grow 2" isn't asked for an empty Grow 2, and "Check the trim room" only while a lot is in it (`choreForEmptyRoom`, `choresToShow`).
  - A chore already ticked, with hours logged or a timer going that day stays listed. Whole-building chores, and chores whose room is gone, always show.
  - **🚪 Show N chores for empty rooms** under the list reveals them, dimmed (this page session only; "Hide the chores for empty rooms" puts them away). All Buildings has the same button per building.
  - The status bar and the building's ✅ count leave them out. Edit mode lists every chore, so the floor manager can still edit or reorder them.
  - It reads the lots' current room as it is now, for any date shown.
- **A room that's gone** (deleted, or moved to another building): the chip shows `🚪 ⚠️ {room}` and the editor lists it as "no longer in this building" until someone picks another. Reports treat the chore as whole-building.
- **Changing the room** re-attributes the chore's past hours too (Reports read the room from the task). A closed-out lot keeps the share saved in its summary.

### Recurrence Rules

A task appears on a date when its weekday is in `days` **or** its day of month is in `monthDays`, and, for a room chore, a lot is in its room ("🚪 Room Chores"). Saving needs at least one weekday or one month-day.

### Labour Display

- Task rows show `👥 {staff}` and `⏱ {minutes}m`; the detail view adds `≈ N.N h labour` (`staff × minutes / 60`).
- Crop tasks (CropLabourWizard / CropProjection) show the same chips from `estStaff` / `estMinutes` when the event has them — the per-day figure, on each day of a multi-day task. Long times read as hours (`⏱ 8h`, `⏱ 1h 30m`). No estimate, no chips.

## Database Key — `_DailyWizard`

```json
"_DailyWizard": { "buildings": { "<buildingId>": {
  "tasks": [ { "code": "j234", "emoji": "💧", "name": "Water plants", "minutes": 30, "staff": 1,
               "days": [0,1,2,3,4,5,6], "monthDays": [], "translations": { "es": "Regar las plantas" },
               "steps": [ { "text": "Check drip lines…", "translations": { "es": "…" } } ] } ],
  "labour": { "2026-10-12": { "j234": [ { "id": "le_k3m9qa2xtd", "employee": "Kasia", "hours": 1.25,
               "initials": { "name": "Kasia", "strokes": [[0.2, 0.6, 0.3, 0.4]] }, "at": "<ISO>", "by": "B6" } ] } },
  "checks": { "2026-10-12": { "j234": { "at": "<ISO>", "by": "B6" }, "ev:<event id>": { "at": "<ISO>", "by": "B6" } } },
  "timers": { "j234": { "1": { "label": "KN", "ms": 0, "since": "<ISO>" }, "2": { "ms": 310000 } }, "ev:<event id>": { … } },
  "adjustments": [
    { "at": "<ISO>", "by": "B6", "date": "2026-10-12", "code": "j234", "entry": { "…": "the removed entry" }, "approvedBy": "Kasia" },
    { "at": "<ISO>", "by": "B6", "date": "2026-10-11", "eventId": "ev_…", "title": "…", "entry": { "…": "…" }, "approvedBy": "Kasia" },
    { "at": "<ISO>", "by": "B6", "date": "2026-10-12", "code": "k7m2", "deletedTask": { "…": "the deleted task" }, "approvedBy": "Kasia" },
    { "at": "<ISO>", "by": "office", "date": "…", "eventId": "ev_…", "title": "…", "reopened": { "…": "the sign-off" } }
  ]
} },
  "adjustments": [ { "…": "the office's removals of crop and equipment hours (same shape), saved in Main.json" } ] }
```

- **Labour entry** (chores here; crop and equipment tasks use the same shape in the event's `labour_map[<day>]`):
  - `id` — `le_` + 10 characters (`newLabourId()`). Office and building hours on an event merge entry by entry by it (root `CLAUDE.md` → "Split Database"). Entries without one get a content-derived id when SitkaTools opens the file.
  - `employee` (roster name), or `temp` (typed name) with optional `wage`.
  - `hours` (decimal); `initials` (`{ name, strokes }`, PaperWizard's stroke format); `at` (ISO time logged); `by` (device: building id or `office`).
  - EmployeeWizard's own `labour_map` entries have no `initials` / `at` / `by`.
- **`adjustments`** is the record of removals and corrections: removed hours (`entry`, with the floor manager who approved it in `approvedBy`), deleted tasks (`deletedTask`) and office reopens of sign-offs after their day (`reopened`). Records without `entry` are skipped by the hours view and the Labour Log. Nothing reads it for totals.
  - It goes in the file the change is saved in: a building device's own building; for the office, the chore's building, or for a crop or equipment task the top-level `_DailyWizard.adjustments` in Main.json (those hours merge through Main, and a building tablet saving later would overwrite a record kept in its file).
- Buildings are keyed by building id. An absent entry means no daily tasks. A building with no tasks gets a bare `{ tasks: [] }` the first time it needs one (a tick on one of its event rows, an office removal or reopen).
- The whole building entry saves in that building's `Building-<ID>.json` (root `CLAUDE.md` → "Split Database").
- **Orphans:** a `_DailyWizard` building missing from `DB.data.buildings` still appears in the selector with ⚠️ so its list can be reviewed and deleted. It is left out of All Buildings (and of the selector on a building device).

## Step Pictures

Pictures bind to steps by **filename only**; nothing is stored in the DB.

- **Name:** `pics/{code}_{n}.{ext}`, `n` = the step's 1-based position (`j234_1`, `j234_2`); `pics/` sits next to `DailyWizard.html`. Probe `.png` → `.jpg` → `.webp`, first that loads wins.
- **Video:** `pics/{code}_{n}.mp4`, probed with a metadata-only `<video>`; plays with browser controls, `playsinline`, no autoplay. Picture shows first, then video. Neither → `🖼 j234_1.png / .mp4 not found`.
  - Use **H.264**; an undecodable video (e.g. HEVC) probes as missing. Keep files short (GitHub refuses > 100 MB; every tablet streams them).
- **Language versions:** a name prefixed with a language code (`es_j234_1.jpg`, `fr_j234_1.mp4`; codes as in "🌐 Language") is that language's version.
  - Lookup order: the language's version (uploaded, then `pics/`), then English (uploaded, then `pics/`). Picture and video are looked up separately. English never looks at prefixed files.
- **Loading:** plain `<img>` / `<video>` tags, which work on http (commit `pics/`) and on `file://`. Never `fetch()` — detect missing files with `Image()` + `onerror`, and show a muted chip with the expected filename.
- **🔄 Refresh images** re-probes every step (cache-busting query string; browsers cache failed loads), for the language on screen and English.
- **Positional:** reordering or deleting steps shifts which picture shows; rename files to remap.
- **Placement:** the page can't write into `pics/`. The manager copies files in by hand, then hits Refresh. Suggest ~1280 px JPGs to keep the repo lean.
- **Uploading** (for a copy not next to its `pics/`, e.g. the online one), for every building at once from the **main screen** (the status bar's **📁 Picture folder** and **🖼 Picture files**, with a count "🖼 N pictures · M videos (this window)"), or from a task's steps view (**📁 Upload image pack** / **🖼 Upload images / videos**). Both use the same two pickers (`packInput`, `imagesInput`):
  - a folder (`webkitdirectory`; Chrome for Android picks folders from version 143) — keep one folder per building and pick each in turn, since task codes are unique across buildings;
  - or files, several at once (the fallback where a folder can't be picked).
  - Only the file name counts: `{code}_{n}.png|jpg|jpeg|webp` or `.mp4`, optional language prefix. Subfolders and leading zeros (`j234_01.jpg`) are fine. Within one pick png beats jpg beats webp; a later pick replaces an earlier file for the same step.
  - Held as object URLs in `uploadedPics` / `uploadedVids` for this window only (never stored or sent); they win over `pics/` (`stepMediaSrc`). A new window needs the pack picked again.
  - A toast reports how many loaded, names that don't fit, and codes that match no task; a note in the steps view counts those in use.

## Calendar Event Attribution (Building Resolution)

Events show on every day of `[date, endDate]`. `buildingForEvent(ev)` resolves an event's building:

1. `ev.roomId` in `DB.rooms` → that room's `buildingId` (CropProjection and EquipmentWizard events).
2. `ev.lotId` in `DB.lots` → the lot's room for this task, by name, then its `buildingId`:
   - `ev.roomPhase` first: `cloning` → `cloningRoom`, `veg` → `vegRoom`, `flower` → `destRoom`;
   - else `CLW_CLONE_ROOM_TYPES` (`clone_cut_prep`, `clone_room_clean`) → `cloningRoom`; `CLW_VEG_ROOM_TYPES` (`planting`, `ipm_spray_veg_early`, `topping`, `order_ipm`, `veg_room_clean`) → `vegRoom`; everything else (transplant onward, unknown types) → `destRoom`;
   - if that room doesn't resolve but the lot has exactly one distinct room across the three fields, use it.
3. A room-id prefix at the start of the title (`🧼 B66DG2-Strain#123, …`, `💡 B66DG2#123, …`), only if it is a real room in `DB.rooms` — covers events whose lot was deleted.
4. Otherwise `null`.

- An event shows under exactly one building; a lot spanning buildings is split per task.
- Unattributable events (no lot/room, unresolvable, or a room with no building) never show in a single-building view. All Buildings collects them in a muted **📌 Unassigned / General** section at the bottom.

## Check-offs — Saved Per Day

- **Where:** `_DailyWizard.buildings[<id>].checks[<YYYY-MM-DD>][<item>] = { at, by }`. `item` is the task `code` or `ev:<event id>`; `at` is the ISO tick time, `by` the device (building id or `office`).
- One tap by anyone, no signature. Untick deletes the record (empty days and maps are tidied). Both call `notifySitkaTools()`.
- Ticks are per day: each new day starts blank.
- On a crop or equipment row a tick means today's part is done; it never changes `completed` — ✅ Mark done finishes the task.
- An event with no building (📌 Unassigned / General) has no file, so its tick stays in the page only (`sessionChecks`).
- Ticked rows stay in place, with an accent check, muted text and a struck-through name.
- Progress: `✅ done/total` in the status bar; `done/total` per section header in All Buildings.

## ⏲ Timers

Four pausable stopwatches on every row that has **⏱ Log** (chores, and crop and equipment tasks under Scheduled today and Still open), on a second line inside the row.

- **Shown** only while the date on screen is today, and only for buildings the device can change (`canEditBuilding`). Other days, other buildings on a building device, projections, general events and Upcoming rows get none.
- **Each timer:** a number badge and its label above the time (`MM:SS`, `H:MM:SS` past an hour), **▶ / ⏸**, and **✕** once it's in use. Running: accent border and time; paused: white time.
  - ▶ on a cleared timer asks for **initials or a label** (optional, up to 12 characters; Enter starts, Cancel starts nothing). Labels aren't matched to the roster.
  - ▶ on a paused or labelled timer starts it straight away; ⏸ banks the run.
  - Tapping the label changes it, without stopping the timer.
  - ✕ clears the time and label; it asks first when the timer has time on it.
- **Where they're kept:** `_DailyWizard.buildings[<id>].timers[<item>][<1–4>] = { label?, ms, since? }`.
  - `item` is the task `code` or `ev:<event id>`, as for ticks.
  - `ms` is the time banked by earlier runs; `since` is the ISO start of the run in progress (absent while paused).
  - The time shown is `ms + (now − since)`, so nothing is written while a timer runs, and it keeps counting through a closed window, a reload or a sleeping tablet. Start, pause, relabel and clear each call `notifySitkaTools()`; they save in the building's own file.
- **Per row, not per day:** a timer left running shows the next day until someone clears it.
- **Tidy:** every timer change drops empty slots and the timers of chores that were deleted and of events that are gone, or done with their last day past.
- **In ⏱ Log** (today only): **Time from a timer** lists Timer 1–4 with label, time and what it would log (`→ 25m`), plus **None — type the time** (picked by default). Timers with no time are greyed out.
  - Picking one fills Hours and Minutes with its time rounded to the **nearest 5 minutes, at least 5** (`timerLogMinutes`); the boxes stay editable.
  - It doesn't pause or clear the timer, so everyone who worked together logs from the same timer. After **Add hours** the pick goes back to None.
  - The entry is an ordinary hours entry; nothing else reads timers.

## ⏱ Hours

Each entry is the person's name, the hours and minutes they type (or fill from a timer, "⏲ Timers"), and their own drawn initials.

- **The button:** on every daily-task row and every CropLabourWizard / EquipmentWizard row (Scheduled today and Still open) whose building is known. Projections, general events and Upcoming rows get none. It reads `⏱ Log`, or the selected day's total (`⏱ 1h 15m`, accent colour). Disabled for future dates; tapping it never opens the detail view.
- **The hours view** (full-screen overlay):
  - the row's entries for that day: name, hours, initials thumbnail, time logged. Labour & Cost Wizard entries say they were entered there, and by which floor manager, with that floor manager's initials (`enteredBy`). An entry later changed in its Tasks tab keeps `signedHours` / `editedAt` / `editedBy` / `editedSignoff`, and the view shows what it was signed for and who approved the change;
  - the day's total against the estimate (chore: staff × minutes; crop task: `estStaff` × `estMinutes`); a room chore adds "🚪 {room}: hours count toward the lots in this room";
  - the form: **Who** (roster names, plus "Someone else (not on the roster)…" with a name box and optional **hourly wage** for temps), **Time from a timer** (today), **Hours**, **Minutes**, **initials pad**.
- **Add hours** needs a name, more than 0 and at most 16 hours, and at least one stroke.
- **Where they go:** chores → `_DailyWizard.buildings[<id>].labour[<day>][<code>]`. Crop or equipment task → the event's `labour_map[<day>]`, the same field EmployeeWizard's Tasks tab edits (it marks these "✍️ signed"), CropLabourWizard and EquipmentWizard carry over, and the Reports read. A building device saves it in its own file as an overlay.
- **Removing** needs a floor manager's PIN on every device ("🔒 Edit Mode and Floor Manager PINs"): ✕ on any entry in a building the device may change, anyone's and any day's, including Labour & Cost Wizard ones. The entry leaves the hours and goes in `adjustments` with `approvedBy`; the hours view shows it struck through ("removed …, approved by …").
- **Live updates:** an open hours view re-renders its list on `sitkaGit_db` / `sitkaGit_db_update`, leaving the form and the initials being drawn alone.
- **Lost link:** if SitkaTools is reloaded or closed, a cover says so and an entry added anyway is reported as not kept (root `CLAUDE.md` → postMessage rule 10).
- **Elsewhere:** EmployeeWizard's 📜 Labour Log lists every entry (office: all buildings; building device: its own), with a room chore's room and the lots its hours went to that day. Its Reports read chore hours (`rptChoreLabour`) and `labour_map`. A temp's typed wage is used for cost; a temp with no wage counts in hours only, and a crop with such hours is left out of $ figures (the missing-wage rule).

## 🔒 Edit Mode and Floor Manager PINs

Each floor manager has their own PIN, set by the office in the Labour & Cost Wizard's employee editor (`EmployeeWizard/CLAUDE.md`) and kept in Main.json only as a salted SHA-256 hash (`_EmployeeWizard.employees[name].pin = { salt, hash, setAt }`). The `FloorPin` snippet (checking a PIN and the PIN dialog) is the same in DailyWizard and the Labour & Cost Wizard. It uses Web Crypto, or its own small SHA-256 where a page has no Web Crypto.

- **The PIN dialog:** pick a floor manager (only those ticked Floor manager with a PIN; preselected when there's one) and type the PIN. A wrong PIN says so; after 5 wrong in a row, even the right one waits a minute. With no PIN set anywhere it says the office sets them, with only Close.
  - `FloorPin.ask(why, { initials: true })` adds an initials pad ("✍️ Floor manager sign-off") and resolves `{ name, initials: { name, strokes } }`. The Labour & Cost Wizard uses it when hours are added or changed in its Tasks tab; DailyWizard doesn't use it yet.
- **✏️ Edit mode** (`EditMode`, `canEditTasks(bid)` = `canEditBuilding(bid)` and edit mode on): needed to add, edit, reorder and delete tasks, and to write, move or delete steps and translations. Every entry point checks it (`openTaskEditor`, `saveTaskFromEditor`, `moveTask`, step edits, `deleteCurrentTask`), not just the buttons.
  - **✏️ Edit tasks** asks for the PIN. Then the bar shows **+ Add Task**, **✅ Done editing** and "✏️ Editing as {name}", the rows show ▲ ▼, and the detail view shows Edit Task, Delete Task and step editing.
  - It ends with ✅ Done editing, or after 10 minutes without an edit (checked every 15 s; never while the task editor is open or a step is being typed). It lasts for this window only and is never stored.
- **Deletions ask every time:** removing an hours entry, and deleting a whole task even in edit mode. Each goes in `adjustments` with `approvedBy` (see "Database Key"). Deleting a step in edit mode needs no extra PIN.
- **Applies on every device**, the office included. Ticks, ⏱ Log, timers and ✅ Mark done need no PIN.
- **Limits:** a PIN slows people down but can't stop someone with the files or the browser's developer tools; the drawn initials and the records are the real control. A PIN set or changed at the office reaches a tablet when it reopens the files.

## ⏰ Still open and ✅ Mark done

### ⏰ Still open

`appendStillOpenSection`, between the daily tasks and Scheduled today, in a single building's view and in each building's section of All Buildings.

- Lists the building's (`buildingForEvent`) CropLabourWizard and EquipmentWizard events that have an `id`, whose last day (`endDate || date`) is before the selected date, and that aren't `completed`. Never projections or general events.
- Oldest first, each with a `due Mon 12 Oct · 1 day overdue` chip and a warning-coloured left edge. The 10 oldest show (`OPEN_SHOWN`); **+ N more** unfolds the rest for the session.
- No check-off box; has **⏱ Log** and **✍️ Mark done**.
- Hours logged here go on the **selected day** (`labour_map[<selected day>]`), outside the task's dates — EmployeeWizard's "+ Add day" convention, so every total counts them. The estimate shown is still per day.

### ✅ Mark done

- **The button** (`makeDoneButton`): on every crop and equipment row whose building is known (Still open, and Scheduled today in both views). Reads **✍️ Mark done**, or **✅ Done** once completed (tooltip names who signed). Disabled for future dates.
- **The view:** the task, its building and due dates; **Floor manager** — roster employees with `floorManager` ticked in EmployeeWizard, or everyone (with a note) when none is; the floor manager's **initials pad**. Its **✅ Mark done** needs a name and at least one stroke, sets `completed: true` and `completedBy`, then `notifySitkaTools()`.
- **`completedBy`** = `{ name, initials: { name, strokes }, at, by, day }` — the floor manager, their initials (PaperWizard stroke format), ISO time, device, and the day the view was on.
  - A floor field: a building device saves it in its own file (root `CLAUDE.md` → "Split Database"). CropLabourWizard and EquipmentWizard carry it over on regeneration. SitkaTools' event panel shows "Completed — signed off by …".
  - Unticking Completed in SitkaTools or reopening in EmployeeWizard's Tasks tab deletes it. Ticking Completed there asks for no signature; such tasks show as done but not signed.
- **Reopen** (Mark done view of a done task): a building device may reopen its own sign-off, on the day it was made; the office may reopen any. It clears `completed` and `completedBy`. An office reopen after the sign-off's day is kept in `adjustments` as `{ at, by, date, eventId, title, reopened }`.

## 🌐 Language

Translations cover daily chores only, not crop or equipment task names; the screen's own text translates too.

- **The picker** is the first header control: English, Français, Español, Tiếng Việt, 中文（简体）, each in its own language. Opens in English every time; the choice lasts while the window is open and is never stored.
- **English is the master.** `name` and step `text` stay English, and other tools read only those. Translations sit beside them and only change what DailyWizard shows: `task.translations[<lang>]`, `step.translations[<lang>]`, codes `fr`, `es`, `vi`, `zh`. An empty translation is removed, and an empty map with it. They save with the task list in the building's file.
- **Missing translations:**
  - a name shows the English with a small dashed **EN** tag ("Not translated yet — showing English");
  - a step shows **blank**, so the floor only ever reads a real translation. Its number, picture and ▲ ▼ 🗑 stay; the dashed empty line is where you tap to paste one;
  - pictures and videos fall back to the English file ("Step Pictures").
- **Writing them** (pick the language first):
  - Add / Edit Task shows **Name (<language>)** (blank = English); the first field becomes "Name in English", still required.
  - In the detail view, tapping a step edits its translation, with the English shown under the box. Clearing makes it blank again. ▲ ▼ 🗑 act on the step in every language.
  - **+ Add Step** is off outside English: write steps in English first.
  - A step being typed when the language changes is saved in the language it was started in.
- **Screen text** comes from `UI_TEXT` (end of the script), keyed by the English text with `fr` / `es` / `vi` / `zh` beside it; `T(english, vars)` looks it up and fills `{placeholders}`. Missing strings show in English. Dates, weekdays and times follow the language (`toLocaleDateString`; `1 h 30 min`, `1小时30分钟`). English output must stay unchanged.
- **🗣️ Talk:** header button beside the picker, shown only outside English. Opens `https://translate.google.com/?sl=en&tl=<fr|es|vi|zh-CN>&op=translate` in a window of its own over DailyWizard, the same size (a tab on phones and tablets, or the Translate app), with no link back to DailyWizard (`opener` cleared). Closing it, or Back on a tablet, comes back to DailyWizard as it was. Tapping Talk again brings that window forward, switched to the language on screen; a closed one is opened afresh. Blocked pop-ups get a toast. A toast says to tap **Conversation**, which a link can't open by itself. It needs internet, and speech goes to Google; DailyWizard itself sends nothing. An in-page voice translator is deferred (ROADMAP → Phase 2, "Voice translator").
- **Stays English:** crop and equipment titles, building / room / staff names, task codes, emoji search keywords (the placeholder says so), the lost-link cover.
- Translations weren't written by native speakers: have each checked on the floor and fix `UI_TEXT`.
- **Adding a language:** add it to `LANGS` (code, own name, date locale) and a column to every `UI_TEXT` entry.

## SitkaTools Link

Uses the standard subtool pattern (root `CLAUDE.md` → "Cross-Window Database Workflow", "Shared Working Copy"). Popup on laptops; tab fed from the shared working copy on tablets. Opened alone: "Open this tool from SitkaTools"; before the DB arrives: "Waiting for SitkaTools to deliver the database…".

- `notifySitkaTools()` after every task or step change, every hours entry added or removed, every tick or untick, Reset Day, every Mark done or reopen, and every timer start, pause, relabel or clear.
- **Live `sitkaGit_db_update`:** refresh the selector, status bar and list without disturbing ticks or an open editor. An open task detail view refreshes too, except while a step is being typed: it refreshes when the edit ends, and the edit is written into the fresh DB. Step buttons (▲ ▼ 🗑, + Add Step) look their task up again by building + code when tapped; if it is gone they only re-render (the view closes).

## UI

Follows the root `CLAUDE.md` UI Standards. Order: header → status bar → **✏️ Edit tasks**, or in edit mode **+ Add Task** and **✅ Done editing** (single building only) → daily task rows → ⏰ Still open → **Scheduled today** → **Upcoming** → footer.

### Header

- `📋 DailyWizard`, then **🌐 Language**, **Building**, and the date.
- **Building:** `— All Buildings —`, then every `DB.data.buildings` entry (`{id} — {name}`), then orphans with ⚠️. On a building device see "Other Buildings on a Building Device".
- **Date** (`<input type="date">`): defaults to today and follows today while it still shows the date it set itself, so a tablet left overnight moves on (checked on focus, when the tab is shown, and each minute — `rollToToday`). A hand-picked date is left alone.

### Status Bar

`🏢 3 buildings · 📝 12 tasks today · ✅ 4/12 done`; `.loaded` border once a DB is present. In All Buildings the task count is the total across buildings, events excluded. On the right: **📁 Picture folder** and **🖼 Picture files** ("Step Pictures").

### Task Rows

Left to right: **checkbox** (≥ 48×48 px touch target, ~32 px box; toggles the tick only) · emoji (~1.5 rem) · name (tapping the row elsewhere opens the detail view) · code chip · 🚪 room chip (room chores) · labour chips · **⏱ Log** · **▲ ▼** (single building, edit mode only; disabled at the ends of the shown list; swaps with the shown neighbour, so tasks not running that day keep their places).

Event rows: same without code chip and moves; emoji from the title; labour chips only on crop tasks with an estimate ("Labour Display").

Below them, inside the row, the four **⏲ timers** ("⏲ Timers"): four across, two on a portrait tablet, one on a phone (container queries on `.timer-strip`). Tapping them never opens the detail view.

### Upcoming

**Upcoming (N)**: the next **5** events starting after the selected date — that building's in single-building mode, all (including unassigned) in All Buildings. Skips events already in Scheduled today; multi-day events dedupe by `sourceTool + lotId/roomId + title`. Ordered by start date, then title. Read-only rows (no checkbox) with a date chip (`Fri 25 Sep`). Omitted when empty.

### All Buildings View

- One section per building, in `DB.data.buildings` order: header with name and `done/total`, its task rows, its ⏰ Still open, its Scheduled today.
- A building with no tasks that day shows "No daily tasks for this date." (its events still show).
- Then 📌 Unassigned / General, then one Upcoming list for all buildings.
- No Add Task or move controls.

### Other Buildings on a Building Device (view only)

A building device opens on its own building and stays there until someone picks another (`pickedBuilding`), also through live DB updates. It can look at any building and at All Buildings but changes only its own.

- **The rule:** `canEditBuilding(bid)` — true on the office (or a single-file DB) and for the device's own building. The entry points check it too (`setChecked`, `openHours`, `openDone`, `openTaskEditor`, step and task moves and deletes), not just the buttons. Changing tasks also needs edit mode (`canEditTasks`, "🔒 Edit Mode and Floor Manager PINs").
- In the selector, other buildings are marked `· 👀 view only`; orphans are left out.
- **Another building:** a note **👀 Viewing {building} — view only** with **Back to {own building}**; no + Add Task or ▲ ▼. Ticks show but can't change; ⏱ Log shows the total but doesn't open; Mark done / ✅ Done don't open. Still open, Scheduled today and Upcoming all show.
- **Its detail view:** steps, pictures and videos (any language, uploaded too) to read; no Edit Task, Delete Task, ▲ ▼ 🗑, + Add Step or step editing.
- **All Buildings:** a note **👀 All buildings — only {building} can be changed here**; the own building's rows work, the other sections are marked 👀. **Reset Day** clears only the own building's ticks.

### Task Detail View

Full-screen overlay:

- Header: large emoji + name, code chip, ← back.
- Summary: labour (`👥 staff · ⏱ minutes · ≈ N.N h labour`), the room (room chores), and recurrence in plain words ("Every day", "Mon, Wed, Fri", "1st & 15th of each month", combined with "and").
- **Steps:** ordered; tap to edit inline; + Add Step, delete, ▲ ▼. Each shows its picture / video or the not-found chip ("Step Pictures"); **🔄 Refresh images** and the upload buttons sit at the top.
- Footer (edit mode only): **Edit Task** (editor pre-filled), **Delete Task** (floor manager PIN again, then `notifySitkaTools()`). Out of edit mode the summary says "🔒 To change this task, tap ✏️ Edit tasks on the list (floor manager PIN)", and steps can't be tapped, moved, deleted or added.

### Task Editor (Add / Edit)

- Emoji picker; **Name** (required); **Estimated time** (min 5, step 5); **Staff required** (min 1); **Room** (optional, "🚪 Room Chores").
- **Weekdays:** seven pill toggles Mon → Sun (values `1,2,3,4,5,6,0`), all on by default.
- **Also on day(s) of month:** comma list of 1–31, validated and deduplicated on save; preset chips `1st & 15th`, `1st only`, `Clear`.
- **Save** validates: name, at least one weekday or month-day, minutes ≥ 5, staff ≥ 1. New tasks get a fresh unique `code` and are appended.

### Emoji Picker

Full picker, all inline (no library, no network): the current-emoji button opens a panel with a keyword **search** (English), category tabs (Smileys · People & Hands · Animals & Nature · Food & Drink · Objects · Activities · Travel · Symbols) and a scrollable grid of ~300 curated emojis embedded as JS arrays. Picking one fills the field and closes the panel.

### Footer and Empty States

- **Reset Day:** clears the selected date's ticks in the buildings shown (confirm first); other dates untouched; disabled when nothing is ticked. **Close Tool:** `window.close()` (closes the tab on a tablet).
- No tasks in the building: "No daily tasks defined for {building} yet." + a prominent **+ Add Task**.
- Tasks but none that day: "No daily tasks scheduled for this date." (events still show).

### Tablet

Touch only: no hover-dependent UI, every target ≥ 48 px. Usable in portrait at ~768–1024 px; chips wrap on narrow screens.
