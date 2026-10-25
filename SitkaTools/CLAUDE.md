# SitkaTools — the Hub

SitkaTools.html is the hub. It holds the Lot, Room and Building Managers and the unified calendar, opens the DB files, saves them, and relays the DB to every open tool. Suite-wide rules and the data contract are in the root `CLAUDE.md`. This file covers how the hub itself works.

## Lot Manager

- The create form sets all five rooms: cloning, veg, flower (`destRoom`), dry and trim (dry and trim may be the same room). It also picks a start room: the clone room by default, or the veg room for purchased clones. `currentRoom` starts from that choice.
- Only `destRoom` syncs to `rooms.<id>.assignedLots`. The other room fields are names stored on the lot.
- **New lots** may say who the plants came from (**Received from**, optional; `receivedFrom`), shown and editable in the lot list (📦). Every new lot keeps the count it started with (`startPlantCount`). Until a grow log records the lot, a count changed in the list changes that too. The Labour & Cost Wizard's 📋 CTLS month counts new lots as plants received and sub-lots as clones cut.
- The parent lot is chosen from existing lots. It should also accept typed free text for a parent that isn't in the system (still to do).
- Creating a lot in, or moving one into, a flowering room or a Mother room runs the projection deletion hook (root `CLAUDE.md` → "Deletion Hook — SitkaTools").
- **🌿 Mother lots:** the stage list has **Mother**, and the destination room ("Destination Room (flower, or Mother room)") of a mother lot is its Mother room. What makes a lot a mother lot is its CropLabourWizard schedule's 🌿 vegetative recipe; nothing else is flagged.
- **🔒 Locked to its grow log** (`lotLocked`: PaperWizard has a daily-weekly page for the lot): the list shows phase, current room and plant count as read-only chips ("🔒 Flower", "🔒 📍 Grow 1", "🔒 🌱 120", tooltip "Set by the grow log in PaperWizard"), and the ✕ is off ("Close it out … once its plant count is 0"). Every handler checks it too. The planned rooms (clone / veg / flower / dry / trim) stay editable: they're the schedule.
- **Close-out warns** ("Its plant history isn't saved yet…") when the lot has no crop summary holding its plant history (`_EmployeeWizard.crops[lot].ctls`): the monthly CTLS numbers count a closed-out lot from it. Save it in the Labour & Cost Wizard (📊 Reports → 📋 CTLS month), or import the archive there later. Close-out still goes ahead if confirmed.
- **Split lots from a locked parent** take at most the plants its grow log recorded as moved to another lot (`days[day]._removed.moved`) that no split lot has yet (`movedOutUnclaimed`: moved − Σ `plantsTransferred` of its split lots). Otherwise the form says to record the move in the parent's grow log first. Sub-lots (clones) take nothing from the parent.

## Room and Building Managers

- **Room form:** name, Building dropdown (registers the room in that building's `assignedRooms` on day 1), **Flowering room** checkbox, light count, watts per light, canopy sq ft, veg / bloom light cycles (selects for 24/0 … 12/12, stored as hours on; 18/6 and 12/12 by default) and designation. Every field is also editable in the room's detail panel.
- Assigning a room to a building first takes it out of any other building. Deleting a room removes it from its building.
- **A room holding a locked lot** (its `currentRoom`) can't be deleted, moved to another building or taken out of its building, and its building can't be deleted (`refuseRoomChange`, with an alert naming the lots): the grow log records where a lot is, and moving a lot between buildings is Send / Accept.
- **Buildings** have their own editor below the rooms, styled the same, with an optional **property cost per month** (rent + property fees) on the form and in the detail panel.

## Calendar

- **Views** (a 3-button group in the nav row; the active one is highlighted):
  - **📆 Monthly** (default).
  - **📅 7-Day:** seven day cards stacked, each with the weekday, date, "Today" badge, holiday name and task count, and full-width event rows (time prefix when `startTime` is set). Prev / Next slide one day; clicking a day's header makes it the first day; Today re-anchors. The first day gets an accent border. Title: "Mon D, YYYY – Mon D, YYYY — 7-Day View".
  - **🗓️ Annual:** 12 months with one emoji dot per task type per day (a fixed `taskType → emoji` map, else the title's first emoji, else 📌), across multi-day ranges. A legend lists up to 8 task types by frequency with counts and "+N more…". Prev / Next step whole years; clicking a day opens the 7-Day view from that day. Title: "YYYY — Annual View".
    - **🖨️ Print year** (shown only in this view, `Calendar.printAnnual`): the year's events as the filters and the building view leave them, on one landscape Letter page for a black-and-white printer. Each task type prints as a letter code (`PRINT_CODES`, fixed for the built-in types; custom types get their name's initials, made unique with a digit; no task type = `OT`), with every type in the legend with its count. Projected = `(HV)`, done = struck through, two or more of a type on a day = `HV×2` with a thick border, at most four codes a day ("+N"), holidays (when shown) underlined and listed. The header names the filters ("All tasks (no filters)" when none).
  - **Clusters:** a day with two or more events of the same task type (visible ones only; multi-day events count on every day) gets a red ring and an "N×" badge (the largest count when several types clash). Tooltips in month and annual views say "⚠️ Clustered: N× <task type> on this day".
  - Every view: multi-day events keep their range styling, completed events are struck through, and projected events are dashed and muted.
- **Tag filters** (top left of the grid, shown once a DB is loaded): "＋ Add filter" opens a menu grouped by **room, building, lot, strain, task type**. It lists only values present in events that still match the active filters.
  - Values under one key OR together (the menu stays open, ✓ marks picks, clicking again removes one); different keys AND together.
  - **✨ Useful Combinations** (`FILTER_PRESETS`) at the top are one-click task-type sets that a second click clears: All phase changes; Clone, Flip, Harvest, Clean; and 🔧 Equipment maintenance (every EquipmentWizard event, i.e. task type `equipment_maintenance`; an EquipmentWizard event with no `taskType` counts as that).
  - An event with no value for a filtered key is hidden (strict). Values are resolved per event: a CropLabourWizard real-lot event gets its room from the task's phase (cloning tasks → cloning room, veg tasks → veg room, everything else → flower room); projected lots and equipment use their stored `roomId`.
  - Filters apply to the grid and the terminal list ("N of M events"), are session-only, and drop values that no longer exist when the DB is replaced (`Calendar.onDbChanged`).
- **Event panel:** edits `date` and `endDate`, plus the annotation fields `startTime`, `endTime`, `notes`, `status`, `assignedTo` and `estimatedHours`. 📋 Duplicate gives the copy a new id. Dragging moves an event and keeps its length.
- **Holidays:** amber, read-only chips with a 🏛️ Holidays toggle (root `CLAUDE.md` → "BC Civic Holidays").
- **The day rolls over** (`DayRollover`, like DailyWizard's `rollToToday`): left open overnight, SitkaTools moves to the new day by itself — checked once a minute, when the tab is shown again and on focus. What was showing today follows it: the current month (or year in the annual view), a 7-day window starting today or on this week's Sunday, and the new-lot form's date. A month, window or date picked by hand stays put. Every view then redraws (`refreshAllViews`), so Today, overdue tasks and the task list are current.
- **Tooltip:** a crop event shows its labour estimate and the hours recorded in `labour_map`.
- **⚠️ Clone cut vs projections** (user request 2026-10-24, `cloneCutMismatches`): when a room's newest real lot (latest `createdDate`, as CropLabourWizard picks it) has its "Cut Clones to Replace Lot" (`clone_cut`) on a different day from `{roomId}-TBA-01`'s "Cutting Clones" (`clone_cut_prep`), both bars get a ⚠️ and an amber left border (month and 7-day views), and their tooltip and event panel say "Does not match projection schedule. Adjust in real lot to match distance from harvest to projections." with both days and their distance from the lot's harvest end. Read from the events only; bloom lots only (the real lot has a harvest). CropLabourWizard shows the same on the tasks (`CropLabourWizard/CLAUDE.md` → "⚠️ Clone Cut vs Projections").

## Loading and Saving

- **📂 Load DB** takes one `DB-YY-MM-DD.json`, or a split set picked together. A `Wages.json` picked by itself is added to the open split files (`isWagesFile` → `DbSplit.addWages`). The "unsaved changes… Load anyway?" question comes after the pick, and only when the pick would replace the open DB.
- **💾 Save DB** always shows the save popup with right-click **Save Link As…** links (one per changed file in split mode). The unsaved flag clears once a link is used.
- **📁 Folder mode** (Chrome / Edge, `showDirectoryPicker`; browsers without it never show the folder UI):
  - Opening a folder loads its newest `DB-YY-MM-DD.json` (or the split files), and warns about same-day copies such as OneDrive's `DB-YY-MM-DD-PCNAME.json` conflict files.
  - Save writes today's `DB-YY-MM-DD.json` into the folder with one click. First it re-scans the folder. If a newer day's file exists, or the file it opened was re-saved elsewhere (content hash differs), it never overwrites: it asks, then writes `DB-YY-MM-DD-conflict-HHMM.json`.
  - Up to 5 recent folders are remembered (IndexedDB `folders`); the most recent is offered first on the start screen, the rest in the 📁 menu.
  - Loading a file with 📂 Load DB switches folder mode off.
- **Save stamp:** `_meta` is committed only when the save link is used. When SitkaTools takes in a tool's DB it keeps its own `_meta` (`keepOwnSaveStamp`), so a tool holding an older stamp never undoes a save.

## Opening Tools and Relaying the DB

- A module link click runs `WorkCopy.flush()` first, then opens the tool: `openModuleInTab` (a centred popup fed by postMessage) or, on phones, `openToolInTab` (a tab fed from the shared copy).
- `openSubtools` holds `{ win, url, sent }` per window; a 1 s interval drops closed windows (the close event is unreliable on `file://`).
- The first `sitkaGit_db` is retried every 200 ms (up to 5 times) until `sitkaGit_ready` arrives, always sending the current DB and view.
- `broadcastToSubtools(except)` posts `sitkaGit_db_update` with the view to each open window. It is debounced from `WorkCopy.flush()` (which `markUnsaved()` and `clearUnsaved()` schedule), and called right after taking a tool's update, skipping the sender. It skips a window whose `sent` key (`subtoolSyncKey`: the DB without `_meta`, plus the view) already matches.
- An update from a window not in `openSubtools`, or a ping from one, gets `sitkaGit_not_linked` back.
- On a real change from a tool: `markUnsaved()`, re-render every view (`Calendar.onDbChanged()` re-finds the selected event by id), and show the sync toast for 3 s. Toasts name tools through `toolDisplayName` (EmployeeWizard → "Labour & Cost Wizard").

## Split Files — How They Work

`DbSplit` keeps the split bookkeeping: `role`, `loaded` (files opened this session), `haveWages`, `baseParts` and `baseline` (what was opened, to diff against), `metas`, `hashes` and `stamps`. `merge` builds the one-DB view, `split` cuts it back into files with no side effects, `plan` lists what needs saving (and what can't be saved), and `commitFile` records a save. It travels in the shared working copy (`exportState`).

- **Overlays:** an overlay keeps its original `at` while its value is unchanged, and is dropped once the office has superseded it or the record is gone. The office stamps its own edits to floor fields in `Main._fieldStamps` (`stampOfficeChanges`, from the diff against the opened files).
- **Labour hours (`mergeLabour`):**
  - A building's overlay for `labour_map` is `{ value, at, entries: { id: time }, removed: { id: time } }`. `value`/`at` is the whole list, which older builds still use newest-wins; `entries` lists what this building added or changed, and `removed` what it removed.
  - The office keeps the same in `Main._fieldStamps.labour` (event id → { entry id: time }) and `.labourRemoved`.
  - Merge result: Main's list, plus each building's added or changed entries, minus every entry anyone removed. The newer change wins when one entry changed in two places. Main's empty days ("+ Add day") are kept.
  - Tidy: a building's update drops an entry once Main holds it unchanged (or the office changed or removed it since), and drops a removal once Main no longer has that entry, so updates shrink away after the office saves.
  - An overlay with no `entries` / `removed` (saved by an older build) counts all its entries, unless the office has edited those hours since; then it's ignored.
  - Entries saved without ids get one from their content (`ensureLabourIds`), the same on every device, in `DB.ensureStructure()` and on merge.
- **Paperwork homes:** `paperHome` (page → building file) and `sheetHome` (lot + sheet → the file holding its lot-level values, such as constants) record where each page came from. `paperTarget` picks the file for a page. All of an entry's non-page keys (`constants`, `constantChanges`, `paperBefore`…) travel together.
- **Lot hand-off internals:** Accept stores the list of what moves on the accepted record (`paperwork: { pages: ['sheet|key'], sheets: [sheetId] }`); from then on those go to the receiver's file (`DbSplit.handoffs`). Once the receiver's file holds the accepted record, copies in other files are leftovers (`isLeftover`): merge ignores them. Until then the old file keeps its copies exactly as on disk (`diskPaper`). `tidyFiles` marks files with leftovers for saving; on the office it also marks the DB unsaved with a "🚚 Lot hand-off done — Save DB to tidy …" toast. Transfers accepted before this list existed leave their pages where they were.
- **Transfers in files a device can't rewrite** stay exactly as on disk, so accepting never warns about the sender's file. The sender's pending copy drops on its next save.
- **Folder saves** re-check each file on disk and write `<name>-conflict-HHMM.json` instead of overwriting one saved elsewhere since opening. Each saved file's `_meta` records `savedBy`.
- **Adding Wages.json later (`addWages`):** for each roster employee, the file's wage goes in wherever the current value still equals what was opened; a wage changed in this session is kept and saves to Wages.json as usual. The same goes for frozen `cropCosts` and `overheadCosts` (the Labour & Cost Wizard's money kept beside the wages, `WAGES_MONEY_KEYS`). Nothing is marked unsaved. Toast: "💰 Wages added: N employees … · M change(s) made here kept".
- **🏢 Building Files card** (Data & Files tab, with calendar import/export, lot move and close-out): Split into building files, the device link (**Set this device…**), Send / Accept for lot moves, and close-out.
  - **Close out** is refused, with the reasons listed (`closeOutBlockers`), while the lot has plants on record, any of its daily pages (grow logs, and drying or trim logs if it has them) isn't complete (`completedAt`), or days have no grow log (from planting, or `paperBefore`, through the last page). The harvest log isn't required: not every lot is harvested.
  - The lot move lists (`LotActions.render`) redraw with the lot, room and building lists (so a new lot shows at once, and on every tool update). Each list is rebuilt only when what it shows changed, so the picked lot and destination and typed Accept initials survive a redraw.

## Shared Working Copy — Details

- **"Save before you continue":** when a tool tab sends `save-request` and something is unsaved, SitkaTools covers the page below its header until the save happens (💾 Save DB stays reachable). "I can't save right now" closes it after a confirmation.
- **Forgetting:** closing SitkaTools with everything saved deletes the copy, and open tool tabs finish the delete on the `sitka-closing` broadcast. Saved copies are removed on the next start. `clearUnsaved()` writes the copy at once (not debounced), so a save is on record even if the tab closes right after.
- **⚠️ Session closed without saving** (`checkWorkCopyOnStart`, `RestoreCard`): on start, a copy holding unsaved work is offered back however old, on a card over the start screen.
  - The card has a yellow triangle with a black "!" (inline SVG, not the emoji, so it looks the same everywhere) and the text "Session closed without saving on MM/DD at HH:MM. Restore session?" (local time, 24-hour).
  - The line under it shows the file name, or for split files the device and files ("Building 1 · Main + 2 building files"). If the page's `?device=` link names another device it adds "This page's link is for …; restoring keeps it as …": a restore keeps the session's own role, whose files it saves.
  - The time is the copy's `at`: the close itself (`pagehide` writes it), or after a flat battery the last change.
  - **Restore session:** the DB, file name and split bookkeeping (`DbSplit.importState`) come back, marked unsaved. A restored session saves with the save links (folder mode isn't reconnected).
  - **Discard** asks first ("Discard the session from … ? Its unsaved changes can't be brought back."), then deletes the copy.
  - Leaving without answering keeps the session for the next start.
- **Nothing overwrites a session before it's answered:** `WorkCopy.flush()` waits until the start check is done (`WorkCopy.ready`), and `pagehide` touches the copy only in a tab that wrote it (`WorkCopy.wrote`).
- **Another SitkaTools tab on the device** (a home-screen shortcut can open a second one): the start check asks `sitka-alive?` on the channel and waits 400 ms. A tab that has written the copy answers `sitka-alive`.
  - With an answer, the new tab offers nothing and deletes nothing. Its card says "SitkaTools is already open in another tab", with only OK.
  - When two tabs ask at once, restoring in one broadcasts `sitka-alive` and turns the other's card into that note.
- **Storage kept:** after its first write, SitkaTools asks the browser to keep the site's storage (`navigator.storage.persist()`) so a full device doesn't clear it.

## On a Building Device

(Rules for what a building sees: root `CLAUDE.md` → "Building Device View".)

- Hidden (`body.building-device` + `.office-only`): the Lot Manager, Room Manager, ICS import, Split, Close out, and the GeneralEvent, CropLabourWizard and EquipmentWizard links.
- The calendar, terminal list, filters, Print Todo and ICS export show only the building's events. Events can't be dragged. The event panel is read-only except **Completed** (saved as an overlay). The terminal's ✕ and ↻ Reschedule are hidden; its completion checks stay.
- The lot move list holds only the building's lots, and the transfer list only moves into or out of the building.
