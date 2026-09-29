# PaperWizard — Tool Context

## What This Tool Does

PaperWizard is a **controlled paperwork fill & print tool** for the SitkaGit suite. Licensed cultivation requires paper records — propagation worksheets, weekly grow-logs, room-clean logs, IPM logs, harvest logs — to be filled out and kept on file. PaperWizard replaces the handwriting: it provides quick click-through multi-question wizards that capture daily paperwork answers, then renders the facility's **controlled form page images (PNG/JPG)** with the captured text overlaid in pre-configured positions. The user prints the browser view of the filled form; the printed page is a properly completed controlled document.

The tool has two top-level tabs:

1. **Filing Cabinet** (default, first page) — the active lot's filing cabinet as a tree view of every document in its file: the propagation worksheet, pre-move-in room cleans (sourced from the previous occupant's file), one grow-log per week of the crop (typically 10–14), IPM log entries, and the harvest log. Each leaf is an instance with its status; a leaf opens its wizard or, once complete, its print popup.
2. **Configure Sheets** — load a controlled form's page images, place text boxes over them, bind boxes to auto-fill values from the main DB, and build the multi-question wizard for that sheet.

**Everything about every sheet is designed in the Configure Sheets tab at runtime.** The tool ships with zero pre-configured sheets and hard-codes none — sheet layouts, field positions, auto-fill bindings, and wizards are all data stored under `_PaperWizard`. Adding a new controlled form to the facility = export its pages as PNG/JPG images, load them once, place boxes, build its wizard. No code changes.

### The Golden Rule — Never Store the Page Images

PaperWizard **never stores controlled page image files** — not in the database, not in browser storage, nowhere. The database stores only:

- the **expected page-image base name**, which doubles as the sheet's unique identifier (e.g. `grow-log-p1.png`, `grow-log-p2.png` → sheet id `grow-log`), and
- the **normalized geometry** of every text box / signature box on each page.

The actual page images are loaded **just-in-time** through a **"Load document"** multi-file picker, in exactly two situations:

1. **Configure Sheets tab:** the page images must be loaded before boxes can be placed over them (and before any print action is available).
2. **Print time:** the user uploads the page set just in time to get filled. The tool validates that the uploaded files form a complete, correctly-named page set for the configured sheet id, then opens the print popup.

A naming or completeness mismatch means the wrong form revision is being used — the tool rejects it with a clear error (wrong base name, missing page number, duplicate page, non-image file). Controlled documents are versioned by file name; this check is what keeps a renamed/revised form from silently filling the wrong layout.

**Page naming convention:** each page of a controlled form is exported as a PNG or JPG named `<base>-pN.png` (e.g. `grow-log-p1.png`, `grow-log-p2.png`). All pages of one sheet share the same base name and are numbered consecutively from 1 with no gaps. The base name becomes the sheet id.

### Intended Use

- **Daily (floor staff, tablet or desktop):** open PaperWizard — the active lot's filing cabinet is already on screen. Tap the leaf that needs today's entry (e.g. "Grow-Log — Sep 21–27: 4/7 days"), answer a handful of questions (with **"⏪ Same as last time"** pre-filling most of them from yesterday), sign if required, done in under a minute.
- **Weekly / on completion (manager):** the grow-log's **🖨️ Print** button is available at all times — as soon as an entry exists and the matching page set is loaded this session, clicking it opens a popup window showing each page image with all text overlaid in place plus a print button. An incomplete instance prints too (unanswered fields show N/A / empty boxes); the button's tooltip lists what's still missing so the user knows the copy isn't final. The user hits print and files the paper.
- **Setup (manager, once per form):** in Configure Sheets, export the controlled form's pages as PNG/JPG (`<base>-pN.png`), load them, drag boxes over every fill-in spot, bind header boxes to lot keys (strain, lot #, dates…), drop a signature box, then build the wizard's question list. Save — the sheet is live for every lot.

### What This Tool Is NOT

- It does **not** store, cache, or embed any page image content — only the expected base name and normalized box geometry.
- It does **not** create or modify `calendarEvents`. (It may *read* CropLabourWizard events in the future to surface "room clean due" prompts — out of scope for v1.)
- It does **not** auto-print or send anything to a printer directly — printing is always the user pressing print in the popup's browser print dialog.
- It does **not** pre-configure any sheet. The initial sheet set (below) is *what the manager will configure*, not what ships in code.

## Core Concepts

### Sheet (layout)

A **sheet** is one configured controlled form. Its id **is the expected page-image base name** (e.g. pages `grow-log-p1.png`… → sheet id `grow-log`). A sheet stores:

| Field | Type | Notes |
|---|---|---|
| `name` | string | Human label shown in the Filing Cabinet ("Weekly Grow-Log"). |
| `orientation` | `'portrait' \| 'landscape'` | How the page is displayed in Configure and in the print popup. Auto-derived from the first page image's aspect ratio (width > height → landscape) when the sheet is first configured. |
| `pageWidthIn` / `pageHeightIn` | number | Page size in inches (default Letter 8.5 × 11). Needed to convert point-based font sizes to overlay pixels for print. Entered manually at configure time (the images supply the aspect ratio, not the physical size). |
| `pageCount` | number | Number of pages in the form (= number of page images loaded at configure time). |
| `cadence` | `'one-shot' \| 'daily-weekly' \| 'event'` | How sheet *instances* are formed (see "Entry & Instance"). Grow-log = `daily-weekly`; propagation worksheet = `one-shot`; room-clean / IPM / harvest = `event`. |
| `fields[]` | array | Text boxes (below). |
| `signature` | object \| null | Signature box geometry + config (below). |

### Field (text box)

Each field is a rectangle placed over a page image in the Configure tab:

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
| `rowYOffset` | number (default 0) | Extra vertical offset **within** a day-row, normalized to page height. Lets several fields stack inside one row (e.g. the grow-log's four monitoring checkboxes in a single cell). Added to the cloned row's `y` at render time; ignored for non-row fields. |

**Day rows:** a weekly sheet's main section has one row per day (7 rows for the grow-log). The Configure tab marks which fields are **row fields** (`row: true` + `rowIndexOffset`) — at render time the tool clones the row field geometry 7×, stepping `y` by the row pitch, and fills each clone with the corresponding day's answer. A row field may also carry a `rowYOffset` so multiple fields stack vertically inside the same row (the grow-log's "Daily crop monitoring" cell holds four checkboxes, one per question). The header section is made of non-row fields. This is what lets one wizard "fill a sheet's main section (not the header) over the course of several days."

### Auto-Fill Bindings

A field's `source` can bind it to a value derived from the main DB, so headers fill themselves with zero questions. v1 binding set:

| Binding | Resolves to |
|---|---|
| `lot.name` | Lot id / lot # (e.g. `LOT-001`) |
| `lot.strain` | Strain name |
| `lot.stage` | Phase (Clone / Veg / Bloom) — snapshotted at save time; PaperWizard writes it back when a grow-log entry records a phase change |
| `lot.plantCount` | Plant count — snapshotted at save time; set to the starting count at lot creation, updated by PaperWizard whenever a grow-log entry records a different count |
| `lot.parentLotId` | Parent lot # for sub-lots/split lots (null for new lots) |
| `lot.createdDate` | Lot creation date (`YYYY-MM-DD`) |
| `lot.destRoom` / `lot.vegRoom` / `lot.cloningRoom` | Room names stored on the lot |
| `instance.phase` | Phase snapshot captured when a daily-weekly instance was created (grow-log header — see "Phase Change") |
| `sheet.periodStart` / `sheet.periodEnd` | The instance's window dates (e.g. grow-log week start/end) |
| `day.date` | The date of the current day-row (`MM/DD`) — row fields only. Derived per row at print time from the instance key + row index; **never snapshotted** (it is a function of the row, not of DB state). This is what fills the grow-log's Date column with zero questions. |

**Source of plant count & parent lot #:** SitkaTools already stores both on the lot record at creation time (`plantCount`, `parentLotId`) — no schema change needed for auto-fill. **Pending SitkaTools change (not PaperWizard):** the parent-lot picker is currently a dropdown of existing lots; it should also accept manual free-text entry so a lot can be created from a parent that isn't in the system.

**Plant count is a live value:** `lot.plantCount` holds the *current* count — SitkaTools sets it to the starting count at lot creation, and PaperWizard updates it whenever a grow-log entry records a different count (see "Write-Back to the Main DB"). The per-day entries keep the full count history; the main DB always shows the latest.

**Bindings resolve at save time, not render time.** When an instance is created — and again on every entry saved to it — the tool resolves every binding used by that sheet against the current DB and stores the results on the instance (`snapshots`, see "Entry & Instance"). The one exception is `day.date`, which is derived per row at print time and never snapshotted. At render/print time the popup prints the **stored snapshot**; it never re-resolves live values. This is deliberate policy: paperwork is a historical record, and plants keep transitioning phases while their paper trail is still being printed. A completed Veg grow-log must keep printing "Veg" in its header long after the lot has moved to Bloom; a propagation worksheet must keep printing the plant count that was true when it was saved. (An instance saved before this rule existed has no `snapshots` — for those, render time falls back to resolving live.)

### Signature Box & Capture

A sheet may have signature boxes (`signature`: normalized `x/y/w/h` + optional label like "Initials"). Signing flow:

1. The wizard's final step (or a dedicated "Sign" action on a completed instance) shows a **canvas pad** sized to the box's aspect ratio, plus a text input for the signer's name/initials.
2. Capture uses pointer events; each stroke is stored as an array of `[x, y]` points **normalized 0–1 within the signature box**. No image is generated or stored — strokes are pure vector data (small: a few dozen points per stroke).
3. At print time the popup renders the strokes as an inline **SVG polyline** positioned over the page image at the box location, scaled to the box's rendered size. The signer's typed name is *not* printed unless a field is bound to it — the stroke is the signature.

Re-signing replaces the stored strokes. An instance without a signature (when the sheet defines one) can still be printed — the signature box simply prints empty and the Print tooltip notes "signature missing".

### Wizard

A **wizard** is the ordered question list that fills a sheet's non-auto-filled fields. One wizard per sheet is the norm (the schema allows several, each referencing a `sheetId`). The fill engine in the main app is fully data-driven: it renders whatever questions the configured wizard declares — string input, number input, or simple multiple choice — and needs no per-sheet code. Every document in the filing cabinet is answerable purely from its saved sheet + wizard configuration.

| Field | Type | Notes |
|---|---|---|
| `id` | string (4 chars) | Unique wizard id. |
| `sheetId` | string | The sheet (page-image base name) this wizard fills. |
| `name` | string | Display label ("Grow-Log Daily Entry"). |
| `questions[]` | array | Ordered steps (below). |

Each question:

| Field | Type | Notes |
|---|---|---|
| `id` | string (4 chars) | Unique within the wizard. |
| `label` | string | The question shown to the user ("Temp high (°C)?"). |
| `type` | `'text' \| 'number' \| 'select'` | Input control — the three v1 controls: **string input**, **number input**, and **simple multiple choice** (fixed options list). These cover every question on the initial sheet set; new types can be added to the schema later without a migration. |
| `options[]` | array of strings | For `select`. |
| `targetFieldId` | string | The field this answer fills (null for questions that only store data, e.g. notes). |
| `rowScoped` | boolean | `true` = the answer is captured **per day row** (daily wizard on a weekly sheet); `false` = one answer for the whole instance (header/one-shot). |
| `sameAsLast` | boolean | Offer the **"⏪ Same as last time"** action for this question. For `rowScoped` questions it copies the *previous day's* answer; for instance-level questions it copies the previous instance's answer. Default on for most daily questions. |
| `writesTo` | `'lot.plantCount' \| 'lot.stage' \| null` | Optional **write-back** binding — PaperWizard's special permission (see "Write-Back to the Main DB"). When the saved answer differs from the lot's current value, PaperWizard updates the main DB and notifies SitkaTools. Restricted to these two targets; anything else is rejected at configure time. |
| `prefillFrom` | binding string \| null | Optional — pre-fills the input with the resolved binding value when the wizard opens (e.g. "Starting plant count" pre-filled from `lot.plantCount`). The user can still edit; the stored answer is what prints. |

**"Same as last time" semantics:** it pre-fills the form — it never auto-saves. The user still reviews and confirms. If there is no previous day/instance, the button is disabled.  The button will pull from last week's 7-day sheet to get "Last time" when a
a new sheet starts in a chain of sheets.

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
| `strikeInitials` | string \| null | Initials captured when the early end was confirmed — printed **above** the strike line (the date prints below it). Required for the instance to *complete*; without them a struck-through instance can still be printed, but the strike line simply doesn't render. |
| `snapshots` | map `binding → value` | Save-time binding values (see "Auto-Fill Bindings"). Captured at instance creation and refreshed on every entry save; this — not the live DB — is what prints. |
| `signature` | `{ name, strokes: [[x,y,…], …] } \| null` | Captured signature (normalized points). |
| `completedAt` | ISO string \| null | Set when the completion rule is satisfied. |
| `printedAt` | ISO string \| null | Set after a successful print-popup render (informational; re-printing always allowed). |

### Filing Cabinet (lot paperwork tree)

The first page of the tool is the **filing cabinet**: a tree view of every document in the active lot's file. The cabinet is a pure *view* — computed from `entries`, the lot record, and configured sheets; it stores nothing of its own. One cabinet per lot; the header's lot selector switches cabinets. A lot that no longer exists in `DB.lots` (closed/orphaned) still gets a cabinet so its paper history stays browsable and printable.

The tree has five sections in fixed order:

```
🗄️ LOT-001 Purple Haze — 14 documents · ⚠️ 1 missing
├─▸ 📁 Propagation
├─▾ 📁 Room Cleans (pre-move-in)
│   ├─ 🧼 Clone Room · Sep 12 · from LOT-000 ... ✓ on file
│   ├─ 🧼 Veg Room · Sep 15 · from LOT-000 ..... ✓ on file
│   └─ 🧼 Grow Room ............................ ⚠️ missing
├─▾ 📁 Grow Logs (12)
│   ├─ 📗 Sep 21–27 · Veg ...................... 4/7 days
│   ├─ 📗 Sep 28 – Oct 4 · Veg ................. ✓ complete
│   └─ ⋮ one node per weekly instance, oldest first
├─▸ 📁 IPM Log
└─▸ 📁 Harvest
```

- **Propagation** — the lot's one-shot propagation worksheet instance.
- **Room Cleans (pre-move-in)** — proof that each room was cleaned *before this lot moved in*. These documents are not owned by this lot: they were filled out and filed under the **previous occupant's** entries, and the cabinet shows them as read-only reference nodes tagged with their source lot ("from LOT-000"). Any room cleans this lot itself logged (e.g. when it later vacates a room) appear here too, as owned instances with normal fill/print actions. A room with no qualifying clean on file renders as a ⚠️ warning leaf — informational, never blocks other sheets.
- **Grow Logs** — one node per `daily-weekly` instance, oldest first, labeled with its window and phase snapshot. A full crop runs 10–14 weeks, so this section typically holds 10–14 nodes.
- **IPM Log** — one node per IPM event instance (application date).
- **Harvest** — the lot's harvest log instance(s); empty until harvest.

**Pre-move-in clean sourcing rule:** a room-clean instance is an `event` sheet stored under the lot that performed the clean, with the room name in its header and the clean date as its instance key. To populate a lot's Room Cleans section, the cabinet scans *all lots'* room-clean instances for a matching room name and picks the most recent one dated **on or before this lot's move-in date** to that room:

- Clone room move-in = `lot.createdDate`.
- Veg room move-in = `periodStart` of the lot's first grow-log instance with phase Veg.
- Grow room move-in = `periodStart` of the lot's first grow-log instance with phase Bloom.
- If the lot has no grow-log instance yet for that phase, "move-in" falls back to today — any earlier clean of that room qualifies.

The match is derived at view time from (room name, date) — no link field is stored on either side. Reference nodes open the same print popup as owned instances but offer no fill action; the data lives in the other lot's file.

**Leaf status:** every leaf shows one of — `✓ complete` (completion rule met), progress (`4/7 days`), `⏳ due`, `⚠️ missing` (expected document absent), or `— not started`. Section headers aggregate counts ("14 documents · 1 missing").

### Phase Change (grow-log rollover)

When a lot moves Clone → Veg → Bloom, its open grow-log instance rolls over:

1. **Detection / recording:** a phase change can originate in either direction. If the lot's live `stage` (changed in SitkaTools) no longer matches the open instance's stored `phase`, PaperWizard prompts the user to confirm the move ("Lot is now in Bloom — close this grow-log?"). Alternatively the change is recorded directly in the daily grow-log wizard via the Phase question (`writesTo: 'lot.stage'`), which also writes the new phase back to the main DB (see "Write-Back to the Main DB"). Either way, confirmation records `phaseChangeDate` = today **and captures the confirmer's initials** (`strikeInitials`) on the old instance, then creates a fresh instance for the new phase.
2. **Double entry on the move day:** both instances carry an entry for the move date — one row filled under the old phase (old sheet), one under the new phase (new sheet, whose first entry is that day). The new instance's `periodStart` is the move date and its header carries the new phase.
3. **Strike-through on the old sheet:** when a 7-day grow-log ends early, policy is a **diagonal strike-out across the remaining day rows, with the confirmer's initials above the line and the change date below it**. Those rows no longer require entries — the old instance completes when all days from `periodStart` through `phaseChangeDate` are filled (+ signature if defined).

   **Strike-out computation:** the overlay is derived, never stored. A pure function takes the instance (`phaseChangeDate`, `strikeInitials`) plus the sheet's row geometry (first row field position, row pitch, day-column extent) and returns:
   - **struck rows** — every day row whose date is after `phaseChangeDate` (through `periodEnd`);
   - **the diagonal** — one line from the top-right corner of the first struck row to the bottom-left corner of the last struck row, in normalized page coordinates;
   - **label positions** — initials centered just above the line's midpoint, date centered just below it.

   The same computation feeds the print popup (SVG overlay) and any on-screen preview, so what prints is exactly what was computed from the saved data.

### Write-Back to the Main DB (PaperWizard's Special Permission)

PaperWizard is the **only tool in the suite allowed to modify another tool's data**. The permission is narrow and fixed: it may write exactly two fields on a lot record — `plantCount` and `stage`. No other field, no other tool. Everything else remains read-only.

Write-backs are driven by wizard questions carrying a `writesTo` binding (see the question table above):

- **Plant count (`lot.plantCount`):** the grow-log wizard includes a row-scoped "Current plant count" question (`writesTo: 'lot.plantCount'`, `sameAsLast` on). When a day's entry is saved and the recorded value differs from `DB.lots[lotId].plantCount`, PaperWizard updates the lot record and calls `notifySitkaTools()`. Same value = no write. The lot's count follows the most recently saved entry; the per-day entries remain the full paper trail.
- **Phase (`lot.stage`):** the grow-log wizard includes an instance-level "Phase" select (Clone / Veg / Bloom, pre-filled from `lot.stage`, `writesTo: 'lot.stage'`). When the user records a new phase, PaperWizard performs the standard phase-change rollover (strike-through + new instance, see above) **and** writes the new phase to `DB.lots[lotId].stage` + `notifySitkaTools()`. The save flow then offers to run today's entry for the new instance — producing the double entry on the move day.

Both write-backs travel over the standard postMessage channel (the full-DB `sitkaGit_db_update` payload) — no protocol change; SitkaTools auto-refreshes as it does for any subtool update. The reverse direction still works: if the stage was changed *in* SitkaTools, PaperWizard's mismatch detection prompts and rolls over without writing anything back (the main DB is already correct).

Because bindings snapshot at save time (see "Auto-Fill Bindings"), a one-shot sheet may bind directly to a live value and still print it *as captured* — e.g. starting plant count on the propagation worksheet binds to `lot.plantCount` and keeps printing the creation-time count on every re-print, because the snapshot was taken when the worksheet was saved. `prefillFrom` questions remain the tool for values that need human confirmation before they go on file.

### Completion Rules

- **`daily-weekly`:** complete when **every day slot in the active window** has answers for every row-scoped question, and (if the sheet has one) a signature is captured. The active window is normally all 7 days (`periodStart` … `periodEnd`) — but if `phaseChangeDate` is set, the window ends there instead (struck-through rows don't count) and `strikeInitials` must be captured so the strike-out can print. Completion drives the leaf's status chip (`✓ complete`, `4/7 days`, `3/5 · phase change Sep 24`) and the Print tooltip — **not** the button: 🖨️ Print is clickable whenever an entry exists and the page set is loaded, so a partial week can be printed on demand (missing fields print N/A).
- **`one-shot`:** complete when all instance-level questions are answered (+ signature if defined).
- **`event`:** complete when its questions are answered (+ signature if defined) — each event is a self-contained sheet.

Completion is re-evaluated after every save; it is never stored as a flag, only `completedAt`.

## Page Image Handling — Just-In-Time Load

- **"Load document" button** (hidden `<input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" multiple>`) appears in both tabs:
  - **Configure Sheets:** required before the preview renders and before any box can be placed. The picker accepts a whole page set at once (`<base>-p1.png`, `-p2.png`, …). Loading a *new* base name starts a new sheet configuration; loading a set matching an existing sheet id opens that sheet for editing (with a confirm if it already has fields).
  - **Filing Cabinet → Print:** required at print time for the selected instance. The loaded page set is validated against the sheet id (base-name match + consecutive numbering from p1), then handed to the print popup.
- **Validation** (`parsePageFiles`): PNG/JPG only; all files share one base name; page numbers are consecutive 1..N with no gaps or duplicates. Any violation is rejected with a clear error naming the offending file.
- The loaded `File`s are held in memory only (blob URLs on a JS variable) for the duration of the configure session / print action. Nothing is written to disk or browser storage.
- **Blob lifecycle:** each page image gets a `URL.createObjectURL(file)`; all are revoked when the tool closes, a new document is loaded, or the popup closes.
- Because the page images are never persisted, **a configured sheet with no page set loaded shows as "⚠️ needs document"** in the Filing Cabinet — its print button is disabled until the matching page set is loaded in that session.

## Print Popup

When Print is clicked (entry exists + matching page set loaded — the instance does **not** need to be complete):

1. The tool builds a **self-contained HTML document** for the popup: one section per page, each page image rendered at its physical size (inches), every field's resolved text absolutely positioned over it (normalized coords → % of the page container), the signature as an inline SVG polyline, and a single **🖨️ Print** button in a slim toolbar. Pages are separated by `page-break-after: always`.
2. The popup opens via `window.open()`; the page images' blob URLs are transferred to it (or re-created from the `File`s) so the popup owns its own rendering — the opener can be closed without breaking the print view.
3. The popup uses a **light theme** (white page, black overlay text) regardless of the suite's dark theme — it is a paper preview. `@media print` CSS hides the toolbar so only the filled form prints.
4. The Print button calls `window.print()` in the popup; the browser print dialog does the rest (including "Save as PDF" if the user wants an archive copy).

**Overlay content rules:**

- **N/A default:** any field whose value is empty or missing — an unanswered question, or a binding that resolved to null (e.g. `lot.parentLotId` on a new lot) — prints **`N/A`**, never a blank box. A controlled document is complete on its face; "not applicable" is itself a filled-in answer.
- **Strike-out:** an instance with a `phaseChangeDate` renders the computed strike-out (diagonal across the remaining day rows, initials above the line, date below — see "Phase Change") as part of the overlay.

## Page Image Rendering (decided)

Each page is a plain `<img>` inside a `.form-page` container whose inline `aspect-ratio` comes from the image's actual pixel dimensions (`wPx / hPx`). Normalized 0–1 box coordinates → percentages of that container, so boxes track the image at any display size with pure CSS — no JS sizing, and window resizes need no handler. A zoom control (buttons + Ctrl/⌘+scroll) scales the pages via a CSS variable for precise box placement.

- Zero dependencies; works fully offline on `file://` — consistent with the suite's no-network rule.
- The images supply the aspect ratio automatically; physical size (`pageWidthIn`/`pageHeightIn`) is entered manually at configure time and used only for print scaling (pt → inches).
- The `<img>` has `pointer-events: none`, so click-drag box creation works over empty page space.
- The print popup pins each page section to the exact physical size (inches) with the same %-positioned overlays, so what you placed is what prints.

## Database Key — `_PaperWizard`

All of this tool's data lives under one top-level key, owned exclusively by PaperWizard:

```json
{
  "_PaperWizard": {
    "sheets": {
      "grow-log": {
        "name": "Weekly Grow-Log",
        "orientation": "portrait",
        "pageWidthIn": 8.5,
        "pageHeightIn": 11,
        "pageCount": 2,
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
      "propagation-worksheet": { "name": "Propagation Worksheet", "orientation": "portrait",
        "pageWidthIn": 8.5, "pageHeightIn": 11, "pageCount": 1, "cadence": "one-shot", "fields": [ "…" ], "signature": null }
    },
    "wizards": {
      "g1wz": {
        "sheetId": "grow-log",
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
        "grow-log": {
          "instances": {
            "2026-09-21": {
              "phase": "Veg",
              "header": {},
              "days": {
                "2026-09-21": { "t1hi": "27.5", "obs1": "Looking strong." },
                "2026-09-22": { "t1hi": "28.0", "obs1": "" }
              },
              "phaseChangeDate": null,
              "strikeInitials": null,
              "snapshots": { "lot.name": "LOT-001", "lot.strain": "Purple Haze",
                              "lot.stage": "Veg", "lot.plantCount": "48",
                              "lot.vegRoom": "Veg Room 2" },
              "signature": null,
              "completedAt": null,
              "printedAt": null
            }
          }
        }
      },
      "LOT-000": {
        "room-clean": {
          "instances": {
            "2026-09-15": {
              "phase": null,
              "header": { "rm1x": "Veg Room 2" },
              "days": {},
              "phaseChangeDate": null,
              "strikeInitials": null,
              "snapshots": { "lot.name": "LOT-000", "lot.vegRoom": "Veg Room 2" },
              "signature": { "name": "J.D.", "strokes": [[0.1, 0.5, 0.9, 0.4]] },
              "completedAt": "2026-09-15T14:02:00Z",
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
- **Sheet ids are page-image base names** — no separate id field, no random codes. Renaming a controlled form's page set means re-configuring (or an explicit rename action that updates the key).
- **Orphaned entries:** if a lot in `entries` no longer exists in `DB.lots`, its entries remain (paper history) but the lot never appears in selectors. If a sheet id has no matching configured sheet, it is ignored in the Filing Cabinet.
- **Cross-lot references are derived, not stored:** `LOT-000`'s room-clean instance above is exactly what `LOT-001`'s filing cabinet lists under Room Cleans (pre-move-in) — matched at view time by room name + date-on-or-before-move-in. No link field exists on either side.
- **No calendar events:** this tool appends nothing to `calendarEvents`.

## Initial Sheet Set (to be configured, not shipped)

These are the controlled forms the facility will configure in the Configure Sheets tab. None of them exist in code:

| Sheet (page-image base name) | Cadence | Notes |
|---|---|---|
| Propagation worksheet (`propagation-worksheet`, pages `propagation-worksheet-p1.png`…) | one-shot | Filled once at lot creation; header auto-filled from lot keys (strain, lot #, parent lot #, dates). Starting plant count is a wizard question pre-filled from `lot.plantCount` so re-prints show the value at creation. |
| Weekly Grow-Log (`grow-log`, pages `grow-log-p1.png`…) | daily-weekly | 7 day rows + phase header (Clone / Veg / Bloom via `instance.phase`). Rolling 7-day window from first entry; rolls over on phase change with strike-through. Completes when the window fills → print. |
| Room-clean sheet (`room-clean`, pages `room-clean-p1.png`… — one generic page set) | event | A single controlled form for all room cleans (clone room, veg room, grow room); the room name is an overlaid field bound to the lot's room for that phase. One instance per clean event, filed under the lot that performed the clean. The *next* lot to occupy that room references it read-only in its filing cabinet as proof of pre-move-in cleaning (see "Filing Cabinet"). |
| IPM log (`ipm-log`, pages `ipm-log-p1.png`…) | event | Pesticide/IPM application entries; print on demand (e.g. end of week or at close-out). |
| Harvest log (`harvest-log`, pages `harvest-log-p1.png`…) | event | Harvest-day entries; print on demand. |

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
│ 📄 Paper Wizard [Filing Cabinet | Configure Sheets] [Lot ▾] │ ← sticky header (tabs + active lot)
│                        (📂 Load 💾 Export — standalone only)
├──────────────────────────────────────────────────────────┤
│ Status bar: 📋 5 sheets configured · 🌱 LOT-001 Purple Haze · ⏳ 2 entries due today
├──────────────────────────────────────────────────────────┤
│ FILING CABINET tab (first page):                          │
│ 🗄️ LOT-001 Purple Haze — 14 docs · ⚠️ 1 missing          │
│ ├─▸ 📁 Propagation                                        │
│ ├─▾ 📁 Room Cleans (pre-move-in)                          │
│ │    🧼 Clone Room · Sep 12 · from LOT-000   ✓ on file    │
│ │    🧼 Veg Room · Sep 15 · from LOT-000     ✓ on file    │
│ │    🧼 Grow Room                        ⚠️ missing       │
│ ├─▾ 📁 Grow Logs (12)                                     │
│ │    📗 Sep 21–27 · Veg        4/7 days   [✍️][🖨️ locked] │
│ │    📗 Sep 28 – Oct 4 · Veg   complete   [🖨️]           │
│ ├─▸ 📁 IPM Log                                            │
│ └─▸ 📁 Harvest                                            │
│                                                           │
│ CONFIGURE SHEETS tab:                                     │
│ [⬆️ Load document]  [Portrait|Landscape]  page size in    │
│ ┌───────────────────┬──────────────────────────────┐     │
│ │                   │ Field properties:             │     │
│ │   Page image      │  label / x y w h / font /     │     │
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
- **Filing Cabinet tab:** the lot's paperwork as a collapsible tree — five sections (Propagation, Room Cleans, Grow Logs, IPM Log, Harvest), one leaf per instance with its status and the two actions inline. Pre-move-in room cleans are read-only reference nodes tagged with their source lot; an expected document that is absent shows as a ⚠️ leaf. Print is available at all times once an entry exists and the page set is loaded (tooltip explains what's still missing: days remaining / signature / strike initials); it is disabled only when there is no entry yet or the matching document isn't loaded this session.
- **Configure Sheets tab:** left = page image preview canvas (boxes are click-drag to create, drag to move, corner handles to resize; the signature box is a distinct style); right = properties panel for the selected box + the wizard builder below it. Save writes `_PaperWizard.sheets[baseName]` and the wizard, then `notifySitkaTools()`.
- **Wizard runner (Filing Cabinet):** a centered card stepping through questions one at a time (Next/Back), with the "⏪ Same as last time" button in the card header when any visible question has `sameAsLast`, and the signature pad as the final step when the sheet defines one.

## Resolved Design Decisions

Decisions made during design (2026-09-24, updated 2026-09-26) — already folded into the sections above; kept here as a record:

1. **Page image rendering:** plain `<img>` per page, CSS aspect-ratio from each image's pixel dimensions (offline-first). No PDF library, no CDN — the suite's offline `file://` constraint and single-file simplicity win; the one-time cost is exporting each form's pages to PNG/JPG locally.
2. **Plant count & parent lot #:** both already exist on the SitkaTools lot record (`plantCount`, `parentLotId`) and are auto-fill bindings. The grow-log captures every subsequent plant-count change day by day, so only the *starting* count lives in the main DB. **Pending SitkaTools change (not PaperWizard):** make the parent-lot field accept manual free-text entry (in addition to picking an existing lot) so a lot can be created from a parent that isn't in the system.
3. **Grow-log window:** rolling 7 days from the first daily entry — not fixed Mon–Sun weeks.
4. **Phase change:** old grow-log gets a diagonal strike-out across its remaining rows — initials above the line, change date below (see "Strike-out policy", decision 12); a new instance starts with the move day as a double entry (one row in each phase's sheet); headers carry their own phase snapshot. See "Phase Change".
5. **Room cleans:** one generic clean-sheet page set for all room types; the room name is an overlaid field.
6. **IPM & harvest logs:** event-driven, printed on demand — no fixed weekly completion rule.
7. **Write-back permission (unique to PaperWizard):** the daily grow-log can update the main DB — `lot.plantCount` when a day's entry records a different count, and `lot.stage` when the Phase question records a new phase (which also triggers the rollover). `lot.plantCount` is a live current count: starting value at lot creation, then maintained by PaperWizard; per-day entries keep the full history. No other tool may write another tool's data.
8. **Filing cabinet is the first page (2026-09-26):** the former Fill Sheets tab becomes the Filing Cabinet — a per-lot tree view of all paperwork (propagation, pre-move-in room cleans, 10–14 weekly grow-logs, IPM entries, harvest). It is a pure view over `entries` + the lot record; nothing extra is stored.
9. **Room cleans sourced from the previous occupant (2026-09-26):** a pre-move-in clean lives in the *previous* lot's entries and appears in the incoming lot's cabinet as a read-only reference, matched at view time by room name + date-on-or-before-move-in. No link fields stored on either side.
10. **Bindings snapshot at save time (2026-09-26):** render-time binding resolution is retired — paperwork is saved as the plant transitions phases, so a sheet must keep printing what was true when it was saved. Instances store `snapshots` of every binding they use, captured at creation and refreshed on each entry save; print always shows stored values (live resolution only as a fallback for legacy instances).
11. **Empty prints as N/A (2026-09-26):** any unanswered field or null binding prints `N/A` — controlled documents are never blank.
12. **Strike-out policy (2026-09-26):** an early-ended grow-log gets a diagonal across the remaining day rows with initials *above* the line and the date *below*; the overlay is computed from `phaseChangeDate` + `strikeInitials` + row geometry, never stored.
13. **Question controls (2026-09-26):** v1 question types are exactly string input, number input, and simple multiple choice — enough for every sheet in the initial set; the fill engine is fully data-driven from wizard configuration.
