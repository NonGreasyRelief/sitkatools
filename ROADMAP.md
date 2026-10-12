# SitkaTools Roadmap

_Last updated: 2026-10-12_

This is the plan for taking SitkaTools from a one-person tool to something the whole site can use at the same time, without giving up what makes it work today:

- **Always local.** Pure HTML/JS, no dependencies, no build step, served from GitHub Pages.
- **Data stays in a controlled place.** The database lives on the company SharePoint, never on a server we run.
- **No new attack surface.** Nothing about the data is reachable from the open internet.

---

## 1. Where we are today

Every tool works on **one JSON file holding everything**: lots, rooms, buildings, every calendar event, and each tool's own data. A user loads the file from SharePoint, works, and saves a full copy back as `DB-YY-MM-DD.json`.

Saving always writes the *whole* database, so **the last person to save wins**. If two people load the same file, the first person's changes vanish when the second person saves. Nothing warns either of them.

### Data-loss problems found in the current code (even with one user)

These came out of an audit of how each tool reads and writes the database:

| # | Problem | Where | Status |
|---|---|---|---|
| 1 | Re-generating a lot's schedule in CropLabourWizard deletes and recreates its events. Any **labour hours** recorded in EmployeeWizard and any **completed** ticks on those events are lost. | `CropLabourWizard.html` `reconcileLotSchedule` | **Fixed in 0.3** |
| 2 | EquipmentWizard deletes and rebuilds **every** maintenance event each time it opens, so **completed** ticks and date moves made on the calendar are lost. | `EquipmentWizard.html` `syncAllRooms` | **Ticks fixed in 0.3.** Date moves still reset on resync |
| 3 | The "unsaved changes" warning is cleared as soon as the save popup opens, even if the file is never saved. Edits made in a subtool never mark the database unsaved at all. Someone can lose work by closing the tab. | `SitkaTools.html` export button, `sitkaGit_db_update` handler | **Fixed in 0.1** |
| 4 | Calendar events have **no ID**. Tools find "their" event by list position or by matching title and date, so moving an event's date breaks the link between it and its labour hours. | All tools | **Fixed in 0.2** |
| 5 | All deletes are permanent with no marker left behind, so no merge tool could tell "deleted" apart from "never existed". Deleting a lot leaves its events and paperwork behind as orphans. | All tools, `Bugs.MD` #4 | Open (0.5) |
| 6 | Cross-window messages are sent to any origin and accepted from any sender. That was required under `file://`, but the app now runs on https. | `SitkaTools.html`, all subtools | **Fixed in 0.4** |

### Facts that shape the options

- **A lot can span buildings.** A lot's clone, veg and flower rooms can sit in different buildings, and nothing in the app prevents it. DailyWizard works out each event's building on the fly from the lot's rooms. The building isn't stored on the event.
- **Planning tools write for every building at once.** CropLabourWizard schedules and projects any room. EquipmentWizard rebuilds every room's events. SitkaTools edits any lot or event.
- **Floor work writes into planning records.** Labour hours and completions land on CropLabourWizard events. PaperWizard writes plant count, stage and current room onto the lot record that SitkaTools also edits.
- **Floor tablets save the whole database too.** DailyWizard and PaperWizard run standalone on building tablets, load the DB file themselves and export a full copy back. A tablet saving grow-log entries while the office saves schedule changes is the most likely source of today's lost saves.
- **Each building has exactly one device** that may access SharePoint.

---

## 2. The options

### A. One database file per building (the original idea)

Each building device loads and saves only its own building's file. The office loads all of them to see the whole site.

- **Good:** no new infrastructure, keeps every current principle, and building devices never collide with each other.
- **Problem:** it doesn't actually give each file a single writer. Office planning (new lots, schedules, projections, equipment plans) writes into **every** building's file, while that building's device is writing to the same file. A lot whose rooms are in two buildings has no single home either. The collision moves from "everyone vs. everyone" to "office vs. each building", but it doesn't go away.

### B. One file per writer (recommended)

Split the data by **who writes it**, not by where it is. Every file has exactly one device that is allowed to save it, so two saves can never overwrite each other.

```
SharePoint/SitkaTools/
  plan.json                     office only: lots, rooms, buildings, recipes, schedules,
                                projections, equipment plans, general events, daily task
                                lists, paperwork templates, employee roster (no wages)
  activity-<BuildingID>.json    that building's device only: what happened on the floor —
                                completions, labour hours, grow-log entries, plant-count /
                                stage / room changes, daily check-offs, repair logs
  wages.json                    restricted folder, payroll only (Brainstorm item)
  archive/lot-<id>.json         closed-out lots (Close Out tool, Brainstorm item)
```

- **Building device:** loads `plan.json` (read-only) plus its own activity file, and saves **only** its activity file.
- **Office:** loads `plan.json` plus every activity file (read-only), and saves **only** `plan.json`.
- **Calendar and reports:** combine all loaded files in memory, so every view still shows the whole site.
- **Activity entries:** each one is a small dated record ("event X completed", "4 h by Sam on event X", "lot L moved to room R"). Today's data layout is rebuilt from them on load, so most tool code barely changes.

**Good**
- Lost saves become impossible by design.
- No server, no new exposure, and the data stays in SharePoint.
- It matches the existing direction for PaperWizard grow logs to become the record of a lot's lifecycle events.
- Activity files are append-only, so they double as an **audit trail** of who changed what and when.

**Costs**
- About a phase of work: device identity, a multi-file loader, moving annotations out of events, and a one-time migration.
- Plan changes still reach the floor only when the building reloads, which is the same as today.
- If more than one person edits the plan, `plan.json` can still collide. Phase 1's folder mode catches that case: it reads the file on disk before writing and refuses to overwrite a newer save.

### C. One file, merge on save

Keep the single file. When you save, the app re-reads the current file and merges your changes record by record.

- **Good:** no change to the file layout.
- **Problem:** every save becomes "re-open the latest file, then save". Merging is fragile here because several operations are multi-record (reprojection renames lots inside event titles, and schedule regeneration replaces whole sets of events). It also needs IDs and deletion markers everywhere first. The risk keeps going for as long as the app exists.

### D. Talk to SharePoint directly (Microsoft Graph), no server of ours

The page signs in with the company Microsoft account and reads and writes the SharePoint files over Microsoft's API. Version tags make SharePoint reject a save if someone else saved first.

- **Good:** real multi-user use, no manual load/save, still no server we run, and data stays in SharePoint under the company's existing access rules (including the one-device-per-building policy).
- **Costs:** IT has to register an app in the company's Microsoft tenant. The app needs network access to Microsoft, so it's no longer "always local". The sign-in code is a meaningful chunk of work to write without a library.
- **Best as an upgrade on top of B:** the per-writer files carry over as they are. Only how they're loaded and saved changes.

### E. Our own web server

- **Good:** the most flexible.
- **Costs:** everything you wanted to avoid. Regulated data sits on infrastructure we run, and we take on login, patching, backups and audit. If it's ever needed, it should be **on the company network only**, never open to the internet.

### Side by side

| | A. Per building | **B. Per writer** | C. Merge on save | D. SharePoint API | E. Own server |
|---|---|---|---|---|---|
| Data stays in SharePoint | yes | **yes** | yes | yes | no |
| New infrastructure | none | **none** | none | IT app registration | server, TLS, login, backups |
| Works offline / local-only | yes | **yes** | yes | no | no |
| Stops lost saves | partly | **yes, by design** | mostly | yes | yes |
| Manual load/save | yes | **yes** (one click in Chrome/Edge) | yes, plus a merge step | no | no |
| New security exposure | none | **none** | none | low (company login) | high |
| Effort | medium | **medium** | medium–high, ongoing | high | very high |

## 3. Recommendation

1. **Do B (one file per writer).** It fixes the root cause while keeping every principle the suite was built on.
2. **Keep D as the later upgrade** if the director wants live multi-user editing. B is the right data layout for D anyway.
3. **Don't build E.**

Phase 0 is needed whichever option is chosen, so it can start now.

---

## 4. Phased plan

### Phase 0: Foundations (mostly done)

Needed under every option. It also fixes the data-loss bugs above. Items 0.1–0.4 are on the `roadmap-phase0` branch, tested in headless Firefox against `DailyWizard/testbug.json`.

- [x] **0.1 Save safety.**
  - Subtool edits mark the database unsaved, but only when they actually change something.
  - The warning clears only when a save actually happens, not when the save popup opens.
  - Loading another database over unsaved changes asks first.
  - An amber dot on **💾 Save DB** shows when there are unsaved changes.
  - In Chrome/Edge, **Save** opens a normal Save dialog (no more right-click → Save Link As). Firefox and tablets keep the save link.
  - Every save stamps a `_meta` block (schema version, revision, save time, save lineage), and the status bar shows when the loaded file was last saved.
  - *Moved to Phase 1:* refusing to overwrite a newer copy. Chrome is believed to empty the chosen file as soon as you pick it in the Save dialog (not verified here), so a check after picking could read an empty file and give a false all-clear. A reliable check needs folder access.
- [x] **0.2 Stable event IDs.**
  - Every calendar event carries an `id`.
  - Old files get IDs on load, worked out from the event's content, so every device assigns the same ID to the same event.
  - Duplicated and ICS-imported events get new IDs.
- [x] **0.3 Keep annotations when schedules regenerate.**
  - CropLabourWizard and EquipmentWizard carry each event's ID, `completed` tick, labour hours and SitkaTools notes over to its regenerated replacement.
  - CropLabourWizard asks before a Generate, Clear or Delete would destroy recorded work. Cancel changes nothing.
  - EquipmentWizard keeps completed visits as history after an interval change.
  - EmployeeWizard finds its events by ID.
- [x] **0.4 Lock down cross-window messages** to the app's own origin when served over https. Each window also accepts messages only from the window it expects.
- [ ] **0.5 Deletion markers and orphan cleanup** (`Bugs.MD` #4, #5).
  - Deleting a lot also removes or archives its events and paperwork.
  - Rooms are referenced by ID instead of name.
- [ ] **0.6 Smaller gaps found along the way**
  - EquipmentWizard resets dates moved on the calendar every time it resyncs.
  - SitkaTools' **📋 Duplicate** copies the original's labour hours and completed tick, which double-counts labour.
  - GeneralEvent re-stamps its own log's `createdAt` every time it opens.
  - Standalone exports from DailyWizard and PaperWizard don't stamp `_meta` yet. That arrives with device identity in Phase 1.

### Phase 1: One file per writer

- **Device identity:** a one-time "This device is: Office / Building X" setting, stamped into everything it saves, including standalone tablet exports.
- **File layout and loader:** load `plan.json` plus any number of `activity-*.json` files at once and combine them in memory.
- **Folder mode (Chrome/Edge):** pick the synced SharePoint folder once, then get one-click load and save. Before writing, the app reads the file on disk and refuses to overwrite a save it didn't load. This is the overwrite check deferred from 0.1.
- **Move floor data out of planning records:** completions, labour hours, and plant count / stage / room changes become activity entries keyed by event and lot ID.
- **Migration:** a one-time "split my current DB" button that writes `plan.json` and one activity file per building from today's single file.
- **Read-only guardrails:** a building device can view the plan but can't save it, and the office can't save a building's activity.

### Phase 2: Features (from Brainstorm)

- **Estimated hours in CropLabourWizard recipes** (Hours × Employees, as in DailyWizard), with room for an actual captured number when one is available. This feeds labour forecasting.
- **Labour report sheet:** estimated vs. actual hours by building, room, lot and task.
- **Close Out tool:** archive a finished lot's events, paperwork and records to `archive/lot-<id>.json` (or a combined `finished_lots_db.json`), then remove it from the active files. This keeps the daily files small.
- **Wages in a separate, restricted file**, so the roster can be shared without pay data.
- **Crop line-up tool:** start crops on a fixed cadence (the 1st, 5th, 9th, 13th, 17th, 21st, 25th).
- **PaperWizard filing cabinet:**
  - A per-lot tree of propagation sheet, IPM log, weekly grow logs, room-cleaning sheets inherited from the previous lot in each room, and the harvest log.
  - N/A fill for unanswered questions.
  - The strike-out rule for grow logs that end early.
- **Cost graphs.**

### Phase 3: Live sync (optional, only if wanted)

- Load and save the Phase 1 files directly through Microsoft Graph, with version-tag conflict checks.
- Needs IT to register the app. No server of ours.

---

## 5. Open questions

1. **How do building devices reach SharePoint?** Through the OneDrive sync client (a SharePoint folder that appears on disk) or by downloading and uploading in the browser? With a synced folder, Phase 1 can be one-click.
2. **Which devices edit the plan?** Lot creation, schedules, recipes, roster. Is that one office PC, or several people?
3. **Which browser runs on the building devices?** The one-click Save dialog needs Chrome or Edge. Firefox and iPad Safari keep the current save link.
4. **Who records labour hours,** the office or each building device? That decides which file labour data lives in.
5. **Would IT consider an app registration** in the company's Microsoft tenant? This only matters for Phase 3.
