# PaperWizard — Tool Context

## What This Tool Does

PaperWizard is a **controlled paperwork fill & print tool** for the SitkaGit suite. Licensed cultivation requires paper records — propagation worksheets, weekly grow-logs, room-clean logs, IPM logs, harvest logs — to be filled out and kept on file. PaperWizard replaces the handwriting: it provides quick click-through multi-question wizards that capture daily paperwork answers, then renders the facility's **controlled PDF forms** with the captured text overlaid in pre-configured positions. The user prints the browser view of the filled form; the printed page is a properly completed controlled document.

The tool has two top-level tabs:

1. **Fill Sheets** (default) — pick an active lot, run that lot's sheet wizards (daily grow-log entry, room-clean log, IPM entry, …), and print sheets once they are complete.
2. **Configure Sheets** — load a controlled PDF, place text boxes over it, bind boxes to auto-fill values from the main DB, and build the multi-question wizard for that sheet.

**Everything about every sheet is designed in the Configure Sheets tab at runtime.** The tool ships with zero pre-configured sheets and hard-codes none — sheet layouts, field positions, auto-fill bindings, and wizards are all data stored under `_PaperWizard`. Adding a new controlled form to the facility = load its PDF once, place boxes, build its wizard. No code changes.

### The Golden Rule — Never Store the PDF

PaperWizard **never stores a controlled PDF file** — not in the database, not in browser storage, nowhere. The database stores only:

- the **expected PDF file name**, which doubles as the sheet's unique identifier (e.g. `grow-log.pdf` → sheet id `grow-log.pdf`), and
- the **normalized geometry** of every text box / signature box on that page.

The actual PDF is loaded **just-in-time** through a **"Load document"** file picker, in exactly two situations:

1. **Configure Sheets tab:** the PDF must be loaded before boxes can be placed over it (and before any print action is available).
2. **Print time:** the user uploads the PDF just in time to get filled. The tool validates that the uploaded file's name matches the configured sheet id, then opens the print popup.

A file-name mismatch means the wrong form revision is being used — the tool rejects it with a clear error naming both the expected and the actual file name. Controlled documents are versioned by file name; this check is what keeps a renamed/revised PDF from silently filling the wrong layout.

### Intended Use

- **Daily (floor staff, tablet or desktop):** open PaperWizard, pick the lot, tap the sheet that needs today's entry (e.g. "Grow-Log — Sep 21–27: 4/7 days"), answer a handful of questions (with **"⏪ Same as last time"** pre-filling most of them from yesterday), sign if required, done in under a minute.
- **Weekly / on completion (manager):** when a sheet's instance is complete (e.g. all 7 grow-log days filled), its **🖨️ Print** button enables. Clicking it opens the "Load document" picker; after the matching controlled PDF is loaded, a popup window shows the PDF with all text overlaid in place plus a print button. The user hits print and files the paper.
- **Setup (manager, once per form):** in Configure Sheets, load the controlled PDF, choose portrait/landscape display, drag boxes over every fill-in spot, bind header boxes to lot keys (strain, lot #, dates…), drop a signature box, then build the wizard's question list. Save — the sheet is live for every lot.

### What This Tool Is NOT

- It does **not** store, cache, or embed any PDF file content — only file names and normalized box geometry.
- It does **not** create or modify `calendarEvents`. (It may *read* CropLabourWizard events in the future to surface "room clean due" prompts — out of scope for v1.)
- It does **not** auto-print or send anything to a printer directly — printing is always the user pressing print in the popup's browser print dialog.
- It does **not** pre-configure any sheet. The initial sheet set (below) is *what the manager will configure*, not what ships in code.

## Core Concepts

### Sheet (layout)

A **sheet** is one configured controlled form. Its id **is the expected PDF file name** (e.g. `grow-log.pdf`). A sheet stores:

| Field | Type | Notes |
|---|---|---|
| `name` | string | Human label shown in Fill Sheets ("Weekly Grow-Log"). |
| `orientation` | `'portrait' \| 'landscape'` | How the page is displayed in Configure and in the print popup. Must match the actual PDF's page orientation; set when the sheet is first configured. |
| `pageWidthIn` / `pageHeightIn` | number | Page size in inches (default Letter 8.5 × 11). Needed to convert point-based font sizes to overlay pixels without parsing the PDF. Set at configure time. |
| `cadence` | `'one-shot' \| 'daily-weekly' \| 'event'` | How sheet *instances* are formed (see "Entry & Instance"). Grow-log = `daily-weekly`; propagation worksheet = `one-shot`; room-clean / IPM / harvest = `event`. |
| `fields[]` | array | Text boxes (below). |
| `signature` | object \| null | Signature box geometry + config (below). |

### Field (text box)

Each field is a rectangle placed over the PDF in the Configure tab:

| Field | Type | Notes |
|---|---|---|
| `id` | string (4 chars) | Unique within the sheet, from the suite `CODE_ALPHABET` (`abcdefghjkmnpqrstuvwxyz23456789`). Immutable after creation. |
| `label` | string | Editor label ("Strain Name") — shown in Configure and as a tooltip; never printed. |
| `x`, `y` | number 0–1 | Normalized position of the box's top-left corner, as a fraction of page width / height. Scale-independent — the same layout renders correctly at any display size. |
| `w`, `h` | number 0–1 | Normalized box width / height. |
| `fontSize` | number (pt) | Font size in points at 100% print scale; converted to px via `pageWidthIn`/`pageHeightIn`. |
| `align` | `'left' \| 'center' \| 'right'` | Horizontal text alignment inside the box. |
| `source` | string \| null | Auto-fill binding (below). `null` means the field is filled by a wizard question instead. |
| `questionId` | string \| null | When `source` is null, the id of the wizard question whose answer fills this field. A day-row field on a weekly sheet receives *that day's* answer to the question. |

**Day rows:** a weekly sheet's main section has one row per day (7 rows for the grow-log). The Configure tab marks which fields are **row fields** (`row: true` + `rowIndexOffset`) — at render time the tool clones the row field geometry 7×, stepping `y` by the row pitch, and fills each clone with the corresponding day's answer. The header section is made of non-row fields. This is what lets one wizard "fill a sheet's main section (not the header) over the course of several days."

### Auto-Fill Bindings

A field's `source` can bind it to a value derived from the main DB, so headers fill themselves with zero questions. v1 binding set:

| Binding | Resolves to |
|---|---|
| `lot.name` | Lot id / lot # (e.g. `LOT-001`) |
| `lot.strain` | Strain name |
| `lot.stage` | Current phase (Clone / Veg / Bloom) — live value at print time; PaperWizard writes it back when a grow-log entry records a phase change |
| `lot.plantCount` | Current plant count (live) — set to the starting count at lot creation, updated by PaperWizard whenever a grow-log entry records a different count |
| `lot.parentLotId` | Parent lot # for sub-lots/split lots (null for new lots) |
| `lot.createdDate` | Lot creation date (`YYYY-MM-DD`) |
| `lot.destRoom` / `lot.vegRoom` / `lot.cloningRoom` | Room names stored on the lot |
| `instance.phase` | Phase snapshot captured when a daily-weekly instance was created (grow-log header — see "Phase Change") |
| `sheet.periodStart` / `sheet.periodEnd` | The instance's window dates (e.g. grow-log week start/end) |

**Source of plant count & parent lot #:** SitkaTools already stores both on the lot record at creation time (`plantCount`, `parentLotId`) — no schema change needed for auto-fill. **Pending SitkaTools change (not PaperWizard):** the parent-lot picker is currently a dropdown of existing lots; it should also accept manual free-text entry so a lot can be created from a parent that isn't in the system.

**Plant count is a live value:** `lot.plantCount` holds the *current* count — SitkaTools sets it to the starting count at lot creation, and PaperWizard updates it whenever a grow-log entry records a different count (see "Write-Back to the Main DB"). The per-day entries keep the full count history; the main DB always shows the latest.

Bindings resolve at **render time** (print popup), never at save time — so a field bound to `lot.stage` always prints the phase the lot is actually in when the sheet is printed.

### Signature Box & Capture

A sheet may have one signature box (`signature`: normalized `x/y/w/h` + optional label like "Initials"). Signing flow:

1. The wizard's final step (or a dedicated "Sign" action on a completed instance) shows a **canvas pad** sized to the box's aspect ratio, plus a text input for the signer's name/initials.
2. Capture uses pointer events; each stroke is stored as an array of `[x, y]` points **normalized 0–1 within the signature box**. No image is generated or stored — strokes are pure vector data (small: a few dozen points per stroke).
3. At print time the popup renders the strokes as an inline **SVG polyline** positioned over the PDF at the box location, scaled to the box's rendered size. The signer's typed name is *not* printed unless a field is bound to it — the stroke is the signature.

Re-signing replaces the stored strokes. A completed instance without a signature (when the sheet defines one) cannot be printed.

### Wizard

A **wizard** is the ordered question list that fills a sheet's non-auto-filled fields. One wizard per sheet is the norm (the schema allows several, each referencing a `sheetId`).

| Field | Type | Notes |
|---|---|---|
| `id` | string (4 chars) | Unique wizard id. |
| `sheetId` | string | The sheet (PDF file name) this wizard fills. |
| `name` | string | Display label ("Grow-Log Daily Entry"). |
| `questions[]` | array | Ordered steps (below). |

Each question:

| Field | Type | Notes |
|---|---|---|
| `id` | string (4 chars) | Unique within the wizard. |
| `label` | string | The question shown to the user ("Temp high (°C)?"). |
| `type` | `'text' \| 'number' \| 'select' \| 'checkbox' \| 'date'` | Input control. |
| `options[]` | array of strings | For `select`. |
| `targetFieldId` | string | The field this answer fills (null for questions that only store data, e.g. notes). |
| `rowScoped` | boolean | `true` = the answer is captured **per day row** (daily wizard on a weekly sheet); `false` = one answer for the whole instance (header/one-shot). |
| `sameAsLast` | boolean | Offer the **"⏪ Same as last time"** action for this question. For `rowScoped` questions it copies the *previous day's* answer; for instance-level questions it copies the previous instance's answer. Default on for most daily questions. |
| `writesTo` | `'lot.plantCount' \| 'lot.stage' \| null` | Optional **write-back** binding — PaperWizard's special permission (see "Write-Back to the Main DB"). When the saved answer differs from the lot's current value, PaperWizard updates the main DB and notifies SitkaTools. Restricted to these two targets; anything else is rejected at configure time. |
| `prefillFrom` | binding string \| null | Optional — pre-fills the input with the resolved binding value when the wizard opens (e.g. "Starting plant count" pre-filled from `lot.plantCount`). The user can still edit; the stored answer is what prints. |

**"Same as last time" semantics:** it pre-fills the form — it never auto-saves. The user still reviews and confirms. If there is no previous day/instance, the button is disabled.

### Entry & Instance (filled data)

Filled answers live per **lot → sheet → instance**:

- **`one-shot` sheets** (propagation worksheet): a single instance per lot, anchored to lot creation.
- **`daily-weekly` sheets** (grow-log): one instance per rolling 7-day window. The window is **not** a fixed calendar week — it starts on the day of the first daily entry saved for that window (`periodStart` = first entry date, `periodEnd` = +6 days). Instances are created on demand: saving a day's entry with no open instance starts one; an entry 7+ days after `periodStart` (or after a phase change) starts the next.
- **`event` sheets** (room clean, IPM, harvest): one instance per triggering event/date; the instance key is the event date.

An instance stores:

| Field | Type | Notes |
|---|---|---|
| `phase` | string \| null | Snapshot of `lot.stage` at instance creation — daily-weekly sheets only. The grow-log header prints this, so a closed (old-phase) log keeps its original phase even after the lot moves on. |
| `header` | map `questionId → value` | Instance-level (non-row) answers. |
| `days` | map `YYYY-MM-DD → { questionId → value }` | Per-day answers for row-scoped questions. |
| `phaseChangeDate` | `YYYY-MM-DD` \| null | Set when the lot moved to a new phase mid-window (see "Phase Change"). Rows after this date are struck through at render time and no longer require entries. |
| `signature` | `{ name, strokes: [[x,y,…], …] } \| null` | Captured signature (normalized points). |
| `completedAt` | ISO string \| null | Set when the completion rule is satisfied. |
| `printedAt` | ISO string \| null | Set after a successful print-popup render (informational; re-printing always allowed). |

### Phase Change (grow-log rollover)

When a lot moves Clone → Veg → Bloom, its open grow-log instance rolls over:

1. **Detection / recording:** a phase change can originate in either direction. If the lot's live `stage` (changed in SitkaTools) no longer matches the open instance's stored `phase`, PaperWizard prompts the user to confirm the move ("Lot is now in Bloom — close this grow-log?"). Alternatively the change is recorded directly in the daily grow-log wizard via the Phase question (`writesTo: 'lot.stage'`), which also writes the new phase back to the main DB (see "Write-Back to the Main DB"). Either way, confirmation records `phaseChangeDate` = today on the old instance and creates a fresh instance for the new phase.
2. **Double entry on the move day:** both instances carry an entry for the move date — one row filled under the old phase (old sheet), one under the new phase (new sheet, whose first entry is that day). The new instance's `periodStart` is the move date and its header carries the new phase.
3. **Strike-through on the old sheet:** at render time, every day row *after* `phaseChangeDate` in the old instance gets a **diagonal strike line with the change date written on it** (an SVG overlay drawn across the remaining rows). Those rows no longer require entries — the old instance completes when all days from `periodStart` through `phaseChangeDate` are filled (+ signature if defined).

### Write-Back to the Main DB (PaperWizard's Special Permission)

PaperWizard is the **only tool in the suite allowed to modify another tool's data**. The permission is narrow and fixed: it may write exactly two fields on a lot record — `plantCount` and `stage`. No other field, no other tool. Everything else remains read-only.

Write-backs are driven by wizard questions carrying a `writesTo` binding (see the question table above):

- **Plant count (`lot.plantCount`):** the grow-log wizard includes a row-scoped "Current plant count" question (`writesTo: 'lot.plantCount'`, `sameAsLast` on). When a day's entry is saved and the recorded value differs from `DB.lots[lotId].plantCount`, PaperWizard updates the lot record and calls `notifySitkaTools()`. Same value = no write. The lot's count follows the most recently saved entry; the per-day entries remain the full paper trail.
- **Phase (`lot.stage`):** the grow-log wizard includes an instance-level "Phase" select (Clone / Veg / Bloom, pre-filled from `lot.stage`, `writesTo: 'lot.stage'`). When the user records a new phase, PaperWizard performs the standard phase-change rollover (strike-through + new instance, see above) **and** writes the new phase to `DB.lots[lotId].stage` + `notifySitkaTools()`. The save flow then offers to run today's entry for the new instance — producing the double entry on the move day.

Both write-backs travel over the standard postMessage channel (the full-DB `sitkaGit_db_update` payload) — no protocol change; SitkaTools auto-refreshes as it does for any subtool update. The reverse direction still works: if the stage was changed *in* SitkaTools, PaperWizard's mismatch detection prompts and rolls over without writing anything back (the main DB is already correct).

Because `lot.plantCount` and `lot.stage` are live values, a field on a one-shot sheet that must print the value *as captured* (e.g. starting plant count on the propagation worksheet) should be a wizard question with `prefillFrom` rather than a direct binding — the stored answer is what prints on re-print.

### Completion Rules

- **`daily-weekly`:** complete when **every day slot in the active window** has answers for every row-scoped question, and (if the sheet has one) a signature is captured. The active window is normally all 7 days (`periodStart` … `periodEnd`) — the "7 days before being completed for printing" rule — but if `phaseChangeDate` is set, the window ends there instead (struck-through rows don't count). The 🖨️ Print button stays disabled until then, showing progress (`4/7 days`, or `3/5 · phase change Sep 24`).
- **`one-shot`:** complete when all instance-level questions are answered (+ signature if defined).
- **`event`:** complete when its questions are answered (+ signature if defined) — each event is a self-contained sheet.

Completion is re-evaluated after every save; it is never stored as a flag, only `completedAt`.

## PDF Handling — Just-In-Time Load

- **"Load document" button** (hidden `<input type="file" accept="application/pdf">`) appears in both tabs:
  - **Configure Sheets:** required before the preview renders and before any box can be placed. Loading a *new* file name starts a new sheet configuration; loading a file matching an existing sheet id opens that sheet for editing (with a confirm if it already has fields).
  - **Fill Sheets → Print:** required at print time for the selected instance. The loaded `File` is validated against the sheet id (exact file-name match), then handed to the print popup.
- The loaded `File` is held in memory only (a JS variable) for the duration of the configure session / print action. Nothing is written to disk or browser storage.
- **Blob lifecycle:** the preview/print popup gets a `URL.createObjectURL(file)`; it is revoked when the popup closes or a new document is loaded.
- Because the PDF is never persisted, **a configured sheet with no PDF loaded shows as "⚠️ needs document"** in Fill Sheets — its print button is disabled until the matching file is loaded in that session.

## Print Popup

When Print is activated (instance complete + matching PDF loaded):

1. The tool builds a **self-contained HTML document** for the popup: the PDF rendered full-page, every field's resolved text absolutely positioned over it (normalized coords → % of the page container), the signature as an inline SVG polyline, and a single **🖨️ Print** button in a slim toolbar.
2. The popup opens via `window.open()`; the PDF `File` is transferred to it (structured-clone via `postMessage`, or a shared blob URL where same-origin allows) so the popup owns its own rendering — the opener can be closed without breaking the print view.
3. The popup uses a **light theme** (white page, black overlay text) regardless of the suite's dark theme — it is a paper preview. `@media print` CSS hides the toolbar so only the filled form prints.
4. The Print button calls `window.print()` in the popup; the browser print dialog does the rest (including "Save as PDF" if the user wants an archive copy).

## PDF Rendering — Native Browser Embed (decided)

The overlay math is identical either way: normalized 0–1 coordinates → percentages of a page container whose aspect ratio matches the sheet's `pageWidthIn × pageHeightIn`. The PDF itself is drawn underneath with a **native browser embed** (`<embed>`/`<iframe>` pointing at a blob URL, viewer chrome suppressed via fragment params):

- Zero dependencies; works fully offline on `file://` — consistent with the suite's no-network rule.
- JS cannot read page metrics from a native embed, so all geometry comes from the stored `pageWidthIn`/`pageHeightIn` set at configure time (the Configure tab shows the expected size next to the preview so the manager can verify it against the document).
- Alignment depends on the browser's built-in viewer (fit-to-width behavior); the print popup pins the page container to the exact aspect ratio and centers the embed within it, so overlay positions stay correct across browsers.

## Database Key — `_PaperWizard`

All of this tool's data lives under one top-level key, owned exclusively by PaperWizard:

```json
{
  "_PaperWizard": {
    "sheets": {
      "grow-log.pdf": {
        "name": "Weekly Grow-Log",
        "orientation": "portrait",
        "pageWidthIn": 8.5,
        "pageHeightIn": 11,
        "cadence": "daily-weekly",
        "fields": [
          { "id": "a3k9", "label": "Strain Name", "x": 0.12, "y": 0.07, "w": 0.4, "h": 0.035,
            "fontSize": 12, "align": "left", "source": "lot.strain", "questionId": null, "row": false },
          { "id": "b7m2", "label": "Lot #", "x": 0.62, "y": 0.07, "w": 0.3, "h": 0.035,
            "fontSize": 12, "align": "left", "source": "lot.name", "questionId": null, "row": false },
          { "id": "c4p8", "label": "Phase", "x": 0.12, "y": 0.11, "w": 0.3, "h": 0.035,
            "fontSize": 12, "align": "left", "source": "instance.phase", "questionId": null, "row": false },
          { "id": "d9q1", "label": "Temp high (°C)", "x": 0.45, "y": 0.30, "w": 0.12, "h": 0.03,
            "fontSize": 10, "align": "center", "source": null, "questionId": "t1hi", "row": true }
        ],
        "signature": { "x": 0.6, "y": 0.92, "w": 0.32, "h": 0.05, "label": "Initials" }
      },
      "propagation-worksheet.pdf": { "name": "Propagation Worksheet", "orientation": "portrait",
        "pageWidthIn": 8.5, "pageHeightIn": 11, "cadence": "one-shot", "fields": [ "…" ], "signature": null }
    },
    "wizards": {
      "g1wz": {
        "sheetId": "grow-log.pdf",
        "name": "Grow-Log Daily Entry",
        "questions": [
          { "id": "t1hi", "label": "Temp high (°C)", "type": "number", "options": [],
            "targetFieldId": "d9q1", "rowScoped": true, "sameAsLast": true, "writesTo": null },
          { "id": "cnt1", "label": "Current plant count", "type": "number", "options": [],
            "targetFieldId": "e5r3", "rowScoped": true, "sameAsLast": true, "writesTo": "lot.plantCount" },
          { "id": "obs1", "label": "Observations / notes", "type": "text", "options": [],
            "targetFieldId": null, "rowScoped": true, "sameAsLast": false, "writesTo": null }
        ]
      }
    },
    "entries": {
      "LOT-001": {
        "grow-log.pdf": {
          "instances": {
            "2026-09-21": {
              "phase": "Veg",
              "header": {},
              "days": {
                "2026-09-21": { "t1hi": "27.5", "obs1": "Looking strong." },
                "2026-09-22": { "t1hi": "28.0", "obs1": "" }
              },
              "signature": null,
              "completedAt": null,
              "printedAt": null
            }
          }
        }
      }
    }
  }
}
```

Rules:

- **Ownership:** PaperWizard is the only tool that reads or writes `_PaperWizard`. It *reads* `lots`, `rooms`, and `buildings` from the main DB for auto-fill bindings and the lot selector. **Exception (unique to PaperWizard):** it may also write exactly two fields on lot records — `plantCount` and `stage` — when a grow-log entry records a change (see "Write-Back to the Main DB"). No other tool has this permission.
- **Sheet ids are file names** — no separate id field, no random codes. Renaming a controlled PDF means re-configuring (or an explicit rename action that updates the key).
- **Orphaned entries:** if a lot in `entries` no longer exists in `DB.lots`, its entries remain (paper history) but the lot never appears in selectors. If a sheet id has no matching configured sheet, it is ignored in Fill Sheets.
- **No calendar events:** this tool appends nothing to `calendarEvents`.

## Initial Sheet Set (to be configured, not shipped)

These are the controlled forms the facility will configure in the Configure Sheets tab. None of them exist in code:

| Sheet (expected file name) | Cadence | Notes |
|---|---|---|
| Propagation worksheet (`propagation-worksheet.pdf`) | one-shot | Filled once at lot creation; header auto-filled from lot keys (strain, lot #, parent lot #, dates). Starting plant count is a wizard question pre-filled from `lot.plantCount` so re-prints show the value at creation. |
| Weekly Grow-Log (`grow-log.pdf`) | daily-weekly | 7 day rows + phase header (Clone / Veg / Bloom via `instance.phase`). Rolling 7-day window from first entry; rolls over on phase change with strike-through. Completes when the window fills → print. |
| Room-clean sheet (`room-clean.pdf` — one generic file) | event | A single controlled form for all room cleans (clone room, veg room, grow room); the room name is an overlaid field bound to the lot's room for that phase. One instance per clean event. |
| IPM log (`ipm-log.pdf`) | event | Pesticide/IPM application entries; print on demand (e.g. end of week or at close-out). |
| Harvest log (`harvest-log.pdf`) | event | Harvest-day entries; print on demand. |

## Relationship to SitkaTools

PaperWizard is part of the SitkaGit suite: a standalone single-file HTML application, vanilla HTML/CSS/JS, no build step, no network calls, running in the browser sandbox (`file://`).

### Two Launch Modes

1. **From SitkaTools (normal subtool mode):** opens as a popup per the suite convention; receives the DB via `postMessage` (`sitkaGit_db`), acknowledges with `sitkaGit_ready`, and calls `notifySitkaTools()` after every mutation to `_PaperWizard` (sheet/wizard saves, entry saves, signatures) **and after every lot write-back** (`plantCount` / `stage`).
2. **Standalone (tablet/floor mode):** opened directly with no opener. The header shows 📂 Load / 💾 Export buttons (hidden when an opener exists) using the standard suite file-import/export pattern — so a floor tablet can load the current `DB-YY-MM-DD.json`, fill entries, and export the updated DB back to disk.

### Standard postMessage Pattern

The standard subtool pattern from the root `Agent.MD` applies verbatim (`notifySitkaTools()` + `sitkaGit_db` listener with `sitkaGit_ready` ack), plus non-disruptive handling of live `sitkaGit_db_update` pushes (refresh lot selector and sheet statuses without disturbing an open wizard).

## UI Convention

Follows the shared UI Standards in the root `Agent.MD` (theme variables, sticky header/footer, card styles, `DB` object pattern). PaperWizard-specific layout:

```
┌──────────────────────────────────────────────────────────┐
│ 📄 Paper Wizard   [Fill Sheets | Configure Sheets]  [Lot ▾] │ ← sticky header (tabs + active lot)
│                        (📂 Load 💾 Export — standalone only)
├──────────────────────────────────────────────────────────┤
│ Status bar: 📋 5 sheets configured · 🌱 LOT-001 Purple Haze · ⏳ 2 entries due today
├──────────────────────────────────────────────────────────┤
│ FILL SHEETS tab:                                          │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 📗 Weekly Grow-Log — Sep 21–27             4/7 days │   │
│ │ [✍️ Fill today]            [🖨️ Print (locked)]     │   │
│ ├────────────────────────────────────────────────────┤   │
│ │ 🧼 Grow Room Clean — Sep 24 (due)                  │   │
│ │ [✍️ Log clean]             [🖨️ Print (locked)]     │   │
│ └────────────────────────────────────────────────────┘   │
│                                                           │
│ CONFIGURE SHEETS tab:                                     │
│ [⬆️ Load document]  [Portrait|Landscape]  page size in    │
│ ┌───────────────────┬──────────────────────────────┐     │
│ │                   │ Field properties:             │     │
│ │   PDF preview     │  label / x y w h / font /     │     │
│ │   with draggable  │  align / source binding /     │     │
│ │   boxes + sig box │  question link / row toggle   │     │
│ │                   ├──────────────────────────────┤     │
│ │                   │ Wizard builder:               │     │
│ │                   │  questions list, add/move/    │     │
│ │                   │  delete, same-as-last toggles │     │
│ └───────────────────┴──────────────────────────────┘     │
│ [💾 Save sheet]  [🗑 Delete sheet]                        │
├──────────────────────────────────────────────────────────┤
│ [Close Tool]                                              │ ← sticky footer
└──────────────────────────────────────────────────────────┘
```

- **Header:** tool name + the two tabs (segmented buttons) on the left; Active Lot selector on the right (lot-focused tool). The lot selector is disabled/hidden in Configure Sheets (configuration is lot-independent).
- **Fill Sheets tab:** one card per configured sheet relevant to the selected lot, showing instance status (progress for weekly sheets, due/completed for event sheets) and the two actions. Print is locked (with a tooltip explaining what's missing: days remaining / signature / document not loaded) until the completion rule is met.
- **Configure Sheets tab:** left = PDF preview canvas (boxes are click-drag to create, drag to move, corner handles to resize; the signature box is a distinct style); right = properties panel for the selected box + the wizard builder below it. Save writes `_PaperWizard.sheets[fileName]` and the wizard, then `notifySitkaTools()`.
- **Wizard runner (Fill Sheets):** a centered card stepping through questions one at a time (Next/Back), with the "⏪ Same as last time" button in the card header when any visible question has `sameAsLast`, and the signature pad as the final step when the sheet defines one.

## Resolved Design Decisions

Decisions made during design (2026-09-24) — already folded into the sections above; kept here as a record:

1. **PDF rendering:** native browser embed (offline-first). No pdf.js, no CDN — the suite's offline `file://` constraint wins over pixel-perfect metrics.
2. **Plant count & parent lot #:** both already exist on the SitkaTools lot record (`plantCount`, `parentLotId`) and are auto-fill bindings. The grow-log captures every subsequent plant-count change day by day, so only the *starting* count lives in the main DB. **Pending SitkaTools change (not PaperWizard):** make the parent-lot field accept manual free-text entry (in addition to picking an existing lot) so a lot can be created from a parent that isn't in the system.
3. **Grow-log window:** rolling 7 days from the first daily entry — not fixed Mon–Sun weeks.
4. **Phase change:** old grow-log gets a diagonal strike-through (with the change date on the line) across its remaining rows; a new instance starts with the move day as a double entry (one row in each phase's sheet); headers carry their own phase snapshot. See "Phase Change".
5. **Room cleans:** one generic clean-sheet PDF for all room types; the room name is an overlaid field.
6. **IPM & harvest logs:** event-driven, printed on demand — no fixed weekly completion rule.
7. **Write-back permission (unique to PaperWizard):** the daily grow-log can update the main DB — `lot.plantCount` when a day's entry records a different count, and `lot.stage` when the Phase question records a new phase (which also triggers the rollover). `lot.plantCount` is a live current count: starting value at lot creation, then maintained by PaperWizard; per-day entries keep the full history. No other tool may write another tool's data.
