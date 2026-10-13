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
| 5 | All deletes are permanent with no marker left behind, so no merge tool could tell "deleted" apart from "never existed". Deleting a lot leaves its events and paperwork behind as orphans. | All tools | Open (0.5) |
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
  - Save keeps the right-click **Save Link As…** popup on every browser. (A Chrome/Edge Save dialog briefly replaced it and was reverted: Edge users need the right-click flow for custom names, and some PCs block downloads.)
  - Every save stamps a `_meta` block (schema version, revision, save time, save lineage), and the status bar shows when the loaded file was last saved.
  - *Done in Phase 1 folder mode:* refusing to overwrite a newer copy. That needs folder access, so the app can read the file on disk before writing.
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
- [ ] **0.5 Deletion markers and orphan cleanup.**
  - Deleting a lot also removes or archives its events and paperwork.
  - Rooms are referenced by ID instead of name.
- [ ] **0.6 Smaller gaps found along the way**
  - EquipmentWizard resets dates moved on the calendar every time it resyncs.
  - SitkaTools' **📋 Duplicate** copies the original's labour hours and completed tick, which double-counts labour.
  - GeneralEvent re-stamps its own log's `createdAt` every time it opens.
  - Standalone exports from DailyWizard and PaperWizard don't stamp `_meta` yet. That arrives with device identity in Phase 1.

### Phase 1: Split by building (built on branch `building-split`, not merged yet)

Agreed with the user on 2026-10-12. It differs from option B above in one way: there's no separate plan file. A **Main** database holds what the office edits, and floor work lives in **one file per building**. Every device opens all the files but saves only its own. Details are in `CLAUDE.md` → "Split Database".

- [x] **Files:** `Main.json` (office), `Wages.json` (office only), `Building-<ID>.json` (that building), `Archive/Lot-<id>-<date>.json`. Names are fixed; SharePoint's version history replaces dated copies.
- [x] **Device identity:** set by each device's own link (`SitkaTools.html?device=B6`, `?device=office`). Nothing is stored in the browser; without the link it's asked each session. Every saved file is stamped with who saved it.
- [x] **Loader and saver:** SitkaTools combines the files into the usual one-DB shape, so tools are unchanged, and splits them back on save. Each device writes only the files it owns, and lists any change it can't save.
- [x] **Floor updates to office records:** plant count, phase and room on lots, and completion and labour hours on events, are saved as timestamped updates in the building's file. The newest wins against the office's own edits.
- [x] **Folder mode (Chrome/Edge laptops):** pick the synced folder once (recent folders are remembered); all files open together.
  - Save to folder writes only this device's files.
  - It never overwrites a file someone saved since you opened it; it writes a conflict copy instead.
  - The right-click link per file is always there too.
- [x] **Android tablets:** pick all the files together; Save gives a link per file to save or share.
- [x] **Tools as tablet tabs:** tools load SitkaTools' open database from a shared browser copy, with no popups or postMessage. Changes flow both ways. The copy is forgotten after save and close, kept at most 12 hours, and unsaved work is offered back once.
- [x] **Migration:** a one-time "Split into building files" on the office device. Every room must belong to a building first.
- [x] **Lot move:** the sending building Sends; the receiving building Accepts, picks the room and initials. Paperwork never moves.
- [x] **Lot close-out (from Brainstorm):** one archive file per lot, then the lot is removed from every file.
- [ ] **Labour in DailyWizard:** staff log their own hours and minutes and initial each entry, on all task types (DailyWizard chores, equipment, crop tasks). Only the floor manager marks tasks done. Check-offs are saved but start blank each day.
  - [x] **Chore hours** (2026-10-12): ⏱ Log on each daily task, with name, hours and minutes, and drawn initials. Saved in the building's file and read by EmployeeWizard's Reports. Same-day corrections on the building; later office corrections are kept on record.
  - [ ] Hours on crop and equipment rows (would write `labour_map`), saved check-offs, and floor-manager-only completion.
- [ ] **Drawn initials** for lot Accept (typed for now) and labour entries, reusing PaperWizard's draw pad.

### Phase 2: Features (from Brainstorm)

- [x] **Estimated hours in CropLabourWizard recipes:** done on 2026-10-12.
  - Recipe tasks hold minutes per day × staff, as in DailyWizard. Generated events carry them as `estStaff` / `estMinutes`.
  - The estimate shows in CropLabourWizard, DailyWizard's floor view, the SitkaTools calendar tooltip and EmployeeWizard's task editor.
  - The actual number is the hours recorded in `labour_map`.
- [x] **Labour report sheet:** done on 2026-10-12, as EmployeeWizard's Labour Report.
  - Estimated vs. actual hours by task, lot, room or building, for one lot or all lots.
  - Hours only; cost reports and graphs are still to come.
- [x] **Close Out tool:** done in Phase 1, one archive file per lot.
- [x] **Wages in a separate, restricted file:** done in Phase 1 (`Wages.json`, office only).
- **Crop line-up tool:** start crops on a fixed cadence (the 1st, 5th, 9th, 13th, 17th, 21st, 25th).
- **PaperWizard filing cabinet:**
  - A per-lot tree of propagation sheet, IPM log, weekly grow logs, room-cleaning sheets inherited from the previous lot in each room, and the harvest log.
  - N/A fill for unanswered questions.
  - The strike-out rule for grow logs that end early.
- [x] **Cost graphs and reports:** built on 2026-10-12 as EmployeeWizard's 📊 Reports tab (branch `reports`, not merged). See `EmployeeWizard/REPORTS.md`.
  - Labour Gantt per crop, room schedule Gantt, hours by task, over/under estimate with suggested recipe estimates, labour mix, $/g by phase, staffing forecast against roster capacity.
  - Yield, potency and terpene charts by strain and room, weight cascade, harvest forecast. These fill in once the harvest log's questions are tagged with report metrics (PaperWizard → Configure Sheets → Report metric).
  - Crop summaries keep closed-out lots in the trends for 36 months; archived lots can be re-imported.

### Phase 3: Live sync (optional, only if wanted)

- Load and save the Phase 1 files directly through Microsoft Graph, with version-tag conflict checks.
- Needs IT to register the app. No server of ours.

---

## 5. Open questions

1. **How do building devices reach SharePoint?** Through the OneDrive sync client (a SharePoint folder that appears on disk) or by downloading and uploading in the browser? With a synced folder, Phase 1 can be one-click.
2. **Which devices edit the plan?** Lot creation, schedules, recipes, roster. Is that one office PC, or several people?
3. **Which browser runs on the building devices?** Answered: Chrome or Edge.
4. **Who records labour hours,** the office or each building device? That decides which file labour data lives in.
5. **Would IT consider an app registration** in the company's Microsoft tenant? This only matters for Phase 3.
