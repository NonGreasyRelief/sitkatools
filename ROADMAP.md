# SitkaTools Roadmap

The plan for letting the whole site use SitkaTools at the same time. It must keep three things:

- **Always local:** pure HTML/JS with no dependencies and no build step, served from GitHub Pages.
- **Data in a controlled place:** the database lives on the company SharePoint, never on a server we run.
- **No new attack surface:** none of the data is reachable from the open internet.

---

## 1. The Problem

Every tool works on **one JSON file holding everything**, and a save writes the whole file. So **the last person to save wins**: if two people load the same file, the second save silently wipes the first person's changes.

An audit of how each tool reads and writes the DB found six data-loss paths. Phase 0 (0.1–0.4) fixed four of them. Still open:

- Deletes are permanent and leave no marker, so a merge can't tell "deleted" from "never existed". Deleting a lot orphans its events and paperwork (0.5).
- EquipmentWizard resets dates moved on the calendar every time it resyncs (0.6).

### Facts That Shape the Options

- **A lot can span buildings.** Its clone, veg and flower rooms can sit in different buildings. An event's building isn't stored; DailyWizard works it out from the lot's rooms.
- **Planning tools write for every building at once.** CropLabourWizard schedules and projects any room, EquipmentWizard rebuilds every room's events, and SitkaTools edits any lot or event.
- **Floor work writes into planning records.** Labour hours and completions land on CropLabourWizard events. PaperWizard writes plant count, stage and current room onto lot records that SitkaTools also edits.
- **Each building has exactly one device** that may access SharePoint.

---

## 2. The Options

| Option | Verdict | Why |
|---|---|---|
| **A. One file per building** | Rejected | Office planning still writes into every building's file while that building writes it too, and a lot spanning buildings has no single home. The collision becomes "office vs. each building" but doesn't go away. |
| **B. One file per writer** | **Chosen** (built as Phase 1, adapted) | Each file has exactly one device allowed to save it, so lost saves are impossible by design. No server, data stays in SharePoint, and it matches PaperWizard grow logs becoming the record of a lot's lifecycle. |
| **C. One file, merge on save** | Rejected | Every save becomes "re-open the latest, then merge". Merging is fragile here: reprojection renames lots inside event titles, and regeneration replaces whole sets of events. It also needs IDs and deletion markers everywhere, and the risk never ends. |
| **D. SharePoint via Microsoft Graph** | Later upgrade (Phase 3) | Real multi-user use with version tags rejecting stale saves, still no server of ours. Needs an IT app registration and network access (no longer "always local"), and sign-in code without a library is a lot of work. B's files carry over unchanged. |
| **E. Our own web server** | Don't build | Regulated data on infrastructure we run, plus login, patching, backups and audit. If ever needed: company network only, never the internet. |

### B as Originally Proposed

- **Files:**
  - `plan.json` — office only.
  - `activity-<BuildingID>.json` — that building's floor work, kept as small dated, append-only records that double as an audit trail.
  - `wages.json` — payroll only.
  - `archive/lot-<id>.json` — closed-out lots.
- **Loading and saving:** a building device loads the plan read-only and saves only its activity file. The office loads everything and saves only the plan. Views combine the files in memory.
- **Known costs:** plan changes reach the floor only when the building reloads (same as before), and several plan editors could still collide on `plan.json`. Folder mode catches that by reading the file on disk before writing.

---

## 3. Phased Plan

### Phase 0: Foundations (mostly done)

- [x] **0.1 Save safety.**
  - Subtool edits mark the DB unsaved, but only when they really change something.
  - The warning clears only when a save happens. Loading over unsaved changes asks first.
  - An amber dot on 💾 Save DB shows unsaved changes.
  - Every save is stamped with `_meta` (root `CLAUDE.md` → "Shared Database").
  - Folder mode refuses to overwrite a newer copy.
  - Save keeps the right-click **Save Link As…** popup on every browser (root `CLAUDE.md` → "JavaScript").
- [x] **0.2 Stable event IDs** — root `CLAUDE.md` → "Event IDs".
- [x] **0.3 Annotations kept when schedules regenerate** — root `CLAUDE.md` → "Event Annotations Survive Regeneration".
- [x] **0.4 Cross-window messages** locked to the app's own origin over https, and accepted only from the expected window (root rule 7).
- [ ] **0.5 Deletion markers and orphan cleanup.**
  - Deleting a lot also removes or archives its events and paperwork.
  - Rooms are referenced by ID instead of by name.
- [ ] **0.6 Smaller gaps.**
  - EquipmentWizard resets dates moved on the calendar every time it resyncs.
  - SitkaTools' 📋 Duplicate copies the original's labour hours and completed tick, which double-counts labour.
  - GeneralEvent re-stamps its own log's `createdAt` every time it opens.
  - Standalone exports from DailyWizard and PaperWizard don't stamp `_meta` yet.

### Phase 1: Split by Building

This is option B with one difference: **there's no separate plan file.** `Main.json` holds what the office edits, and floor work lives in one file per building. Every device opens all the files but saves only its own.

Built and documented in root `CLAUDE.md` → "Split Database", "Working Copy (crash recovery)", "Tool Overlays" and "Building Device View":

- [x] Files, device identity, the loader and saver, and floor overlays. Each saved split file's `_meta` also records `savedBy` (the device's role).
- [x] Folder mode and Android tablets (tools opened as tablet tabs at first; since 2026-10-27 every tool opens over SitkaTools in its one file).
- [x] The one-time split, lot move and hand-off, and lot close-out.

Still to do:

- [ ] **Labour in DailyWizard.**
  - The goal: staff log their own hours on every task type, only the floor manager marks tasks done, and check-offs are saved but each day starts blank.
  - Built: chore hours, hours on crop and equipment rows, the Labour Log, entry-by-entry labour merge, the lost-link warning, floor-manager ✅ Mark done and saved check-offs.
  - [x] Every removal of hours is recorded with the floor manager who approved it (PIN), in DailyWizard and in EmployeeWizard's Tasks tab.
- [x] ~~**Drawn initials for lot Accept**~~ — no longer needed: since 2026-10-25 a lot moves through its grow log (the strike-out and the receiving building's first day carry drawn initials), and the receiving building picks it up by itself.

### Phase 2: Features

Built:

- [x] Estimated hours in recipes — root `CLAUDE.md` → "Task Recipes".
- [x] Labour Report (estimated vs. actual).
- [x] Close Out tool and the restricted wages file (Phase 1).
- [x] Total cost per gram — root `CLAUDE.md` → "Total Cost per Gram".
- [x] 📊 Reports tab — `EmployeeWizard/REPORTS.md`.

To do:

- **Crop line-up tool:** start crops on a fixed cadence (the 1st, 5th, 9th, 13th, 17th, 21st and 25th).
- **PaperWizard filing cabinet:**
  - A per-lot tree of the propagation sheet, IPM log, weekly grow logs, room-cleaning sheets (inherited from the previous lot in each room) and the harvest log.
  - N/A fill for unanswered questions.
  - The strike-out rule for grow logs that end early.
- **Voice translator in DailyWizard** (put off). Two microphone buttons, one for the English speaker and one for the worker in the tablet's language, each translated and read aloud.
  - **For now:** the 🗣️ Talk button links to Google Translate set to the language pair; its Conversation mode does the job (`DailyWizard/CLAUDE.md` → "🌐 Language").
  - **Speech:** Chrome's Web Speech API does speech to text on Android (through Google's servers). `speechSynthesis` reads aloud, but voices differ by tablet.
  - **Blocker — translation:** Chrome's built-in Translator API is desktop-only. On Android it needs a cloud service (Google Cloud Translation or Microsoft Translator) with billing and a key. A key in the page can be copied, so that needs a server or IT.
  - **Revisit** if the Translator API reaches Android, or once IT sets up Microsoft's translation and speech services in the tenant (Phase 3).

### Phase 3: Live Sync (optional)

- Load and save the Phase 1 files directly through Microsoft Graph, with version-tag conflict checks.
- Needs IT to register the app. Still no server of ours.

---

## 4. Open Questions

**Answered:**

- Devices reach SharePoint through a OneDrive-synced folder.
- One office PC edits the plan.
- Building devices run Chrome or Edge.
- Staff log their own hours on the building tablet (DailyWizard).

**Still open:** would IT consider an app registration in the company's Microsoft tenant? It matters only for Phase 3.
