# PaperWizard — Tool Context

## What This Tool Does

PaperWizard is a **controlled paperwork fill & print tool** for the SitkaGit suite. Licensed cultivation requires paper records — propagation worksheets, weekly grow-logs, room-clean logs, IPM logs, harvest logs — to be filled out and kept on file. PaperWizard replaces the handwriting: it provides quick click-through multi-question wizards that capture daily paperwork answers, then renders the facility's **controlled form page images (WebP)** with the captured text overlaid in pre-configured positions. The user prints the browser view of the filled form; the printed page is a properly completed controlled document.

The tool has two top-level tabs:

1. **Filing Cabinet** (default, first page) — the active lot's filing cabinet as a tree view of every document in its file: the propagation worksheet, pre-move-in room cleans (sourced from the previous occupant's file), one grow-log per week of the crop (typically 10–14), IPM log entries, and the harvest log. Each leaf is an instance with its status; a leaf opens its wizard or, once complete, its print popup.
2. **Configure Sheets** — load a controlled form's page images, place text boxes over them, bind boxes to auto-fill values from the main DB, and build the multi-question wizard for that sheet. The toolbar also lists every saved sheet (pick one to open its configuration for editing; 🗑 deletes it), and for a selected saved sheet a **Document** dropdown assigns it to a filing-cabinet document (Grow-Log / Propagation work sheet / Harvest Log / IPM Log / Cleaning form).

**Everything about every sheet is designed in the Configure Sheets tab at runtime.** The tool ships with zero pre-configured sheets and hard-codes none — sheet layouts, field positions, auto-fill bindings, and wizards are all data stored under `_PaperWizard`. Adding a new controlled form to the facility = export its pages as WebP images, load them once, place boxes, build its wizard. No code changes.

### The Golden Rule — Never Store the Page Images

PaperWizard **never stores controlled page image files** — not in the database, not in browser storage, nowhere. The database stores only:

- the **expected page-image base name**, which doubles as the sheet's unique identifier (e.g. `grow-log-p1.webp`, `grow-log-p2.webp` → sheet id `grow-log`), and
- the **normalized geometry** of every text box / signature box on each page.

The actual page images are loaded **just-in-time** through a **"Load document"** multi-file picker, in exactly two situations:

1. **Configure Sheets tab:** the page images must be loaded before boxes can be placed over them (and before any print action is available).
2. **Print time:** the user uploads the page set just in time to get filled. The tool validates that the uploaded files form a complete, correctly-named page set for the configured sheet id, then opens the print popup.

A naming or completeness mismatch means the wrong form revision is being used — the tool rejects it with a clear error (wrong base name, missing page number, duplicate page, non-image file). Controlled documents are versioned by file name; this check is what keeps a renamed/revised form from silently filling the wrong layout.

**Page naming convention:** each page of a controlled form is exported as a WebP named `<base>-pN.webp` (e.g. `grow-log-p1.webp`, `grow-log-p2.webp`). All pages of one sheet share the same base name and are numbered consecutively from 1 with no gaps. The base name becomes the sheet id.

### Intended Use

- **Daily (floor staff, tablet or desktop):** open PaperWizard — the active lot's filing cabinet is already on screen. Tap the leaf that needs today's entry (e.g. "Grow-Log — Sep 21–27: 4/7 days"), answer a handful of questions (with **"⏪ Same as last time"** pre-filling most of them from yesterday), sign if required, done in under a minute.
- **Weekly / on completion (manager):** the grow-log's **🖨️ Print** button is available at all times — as soon as an entry exists and the matching page set is loaded this session, clicking it opens a popup window showing each page image with all text overlaid in place plus a print button. An incomplete instance prints too (unanswered fields show N/A / empty boxes); the button's tooltip lists what's still missing so the user knows the copy isn't final. The user hits print and files the paper.
- **Setup (manager, once per form):** in Configure Sheets, export the controlled form's pages as WebP (`<base>-pN.webp`), load them, drag boxes over every fill-in spot, bind header boxes to lot keys (strain, lot #, dates…), drop a signature box, then build the wizard's question list. Save — the sheet is live for every lot.

### What This Tool Is NOT

- It does **not** store, cache, or embed any page image content — only the expected base name and normalized box geometry.
- It does **not** create or modify `calendarEvents`. (It may *read* CropLabourWizard events in the future to surface "room clean due" prompts — out of scope for v1.)
- It does **not** auto-print or send anything to a printer directly — printing is always the user pressing print in the popup's browser print dialog.
- It does **not** pre-configure any sheet. The initial sheet set (below) is *what the manager will configure*, not what ships in code.

## Core Concepts

### Sheet (layout)

A **sheet** is one configured controlled form. Its id **is the expected page-image base name** (e.g. pages `grow-log-p1.webp`… → sheet id `grow-log`). A sheet stores:

| Field | Type | Notes |
|---|---|---|
| `name` | string | Human label shown in the Filing Cabinet ("Weekly Grow-Log"). |
| `orientation` | `'portrait' \| 'landscape'` | How the page is displayed in Configure and in the print popup. Auto-derived from the first page image's pixel dimensions (width > height → landscape). |
| `pageWidthIn` / `pageHeightIn` | number | Physical page size in inches, automatically set to North American Letter (8.5 × 11, rotated for landscape). Used for print sizing and point-based font scaling; no manual input. Retained in stored sheet data for compatibility. |
| `pageCount` | number | Number of pages in the form (= number of page images loaded at configure time). |
| `cadence` | `'one-shot' \| 'daily-weekly' \| 'event'` | How sheet *instances* are formed (see "Entry & Instance"). Grow-log = `daily-weekly`; propagation worksheet = `one-shot`; room-clean / IPM / harvest = `event`. |
| `document` | `'grow-log' \| 'propagation' \| 'harvest' \| 'ipm' \| 'drying-log' \| 'trim-log' \| 'room-clean-clone' \| 'room-clean-veg' \| 'room-clean-grow' \| 'room-clean-dry' \| 'room-clean-trim'` \| null | Explicit filing-cabinet assignment, set in the Configure Sheets toolbar's **Document** dropdown (shown when a saved sheet is selected). Values are cabinet section keys — the five per-room cleaning-form values all file under the Room Cleans sections (`sheetSection()` maps them to `room-clean`). Null = unassigned (heuristics apply). Persisted immediately on change — not gated on 💾 Save. Legacy sheets may hold the old single `'room-clean'` value; those still file under Room Cleans and their room role is inferred from name keywords. |
| `fields[]` | array | Text boxes (below). Daily-weekly sheets have **no grid** — their day rows are explicit daily-entry groups of fields (see "Day rows"). |
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
| `source` | string \| null | Auto-fill binding (below). `null` means the field is filled by a wizard question instead. **Group-level:** setting it on one member sets it on every day of that column. |
| `questionId` | string \| null | When `source` is null, the id of the wizard question whose answer fills this field — **the sole binding point** (questions carry no target of their own). Assigned in the Field properties panel's "Filled by question" dropdown. A daily-entry group member receives *that day's* answer to the question. **Group-level:** the binding is anchored on the column's day-1 box and repeats to every day; editing it from *any* member of the column propagates to all days. |
| `day` | number \| 1 | The day row this box belongs to (1 = the manually placed first row; 2..N = the other members of its daily-entry group). Only meaningful when `dayGroup` is set. |
| `dayGroup` | string (4 chars) \| null | Daily-entry group id — boxes sharing an id form one column of the weekly table and **move together as a single block** in the editor. `null` for header/one-shot/event fields. |
| `constant` | boolean, default false | **Constant (header) field** — set once per lot via the cabinet's "Initialize paperwork" quiz instead of by the daily runner. Only offered when the sheet's cadence is `daily-weekly`; mutually exclusive with `source` (picking either clears the other). Must be bound to a question (`questionId`) to do anything. See "Constant / Header Fields". |
| *(initials box)* | derived | A field is an **initials box** when it is bound (via `questionId`) to a wizard question of type `'initials'` — there is no per-field flag. The editor shows a ✍️ badge on such boxes, derived from the binding. See "Initials Question Type". |

**Day rows (daily-entry groups):** a weekly sheet's main section has one row per day (7 rows for the grow-log). There is **no grid, no pitch, no auto-positioning** — every day's boxes are real, individually placed fields. The workflow in Configure Sheets:

1. Place the **day-1** boxes manually over the form's first day row (one box per column; several can stack inside one row at different heights — the grow-log's "Daily crop monitoring" cell holds four checkboxes, one per question).
2. **Multi-select** all of them (Shift-click each, or Shift-drag a marquee over the row).
3. Hit **🔗 Group as daily entry** in the Field properties panel — the tool copies the selection into real fields for days 2..N (asked how many days; default 7), offset by the measured pitch between day 1 and day 2 (or the tallest box's height if unmeasurable). Each clone carries a `D2`..`DN` badge.
4. **Slide the group into position** — dragging *any* member moves the whole group as one block; hold **Ctrl/⌘** to move just that day's row (all boxes on the same day in the group), or **Alt/⌥** to move just that one box, for exact per-row placement. ✂️ Ungroup removes the day 2..N boxes and keeps day 1 — it also clears `dayGroup` from the surviving day-1 boxes so they stop moving together.

At render time each group member prints on **its own day at its own placed position** — what you slid is what prints; there is no clone math left to get wrong. Bindings (auto-fill source, wizard question) are **group-level**: they apply to every day of the column. The question binding is assigned from the field side — select any member of the column in the Field properties panel and pick its question in "Filled by question"; the choice propagates to all days (anchored on day 1). The wizard builder shows each question's binding as a read-only indicator only. The header section is made of ungrouped fields. This is what lets one wizard "fill a sheet's main section (not the header) over the course of several days."

*Legacy sheets* configured before this system (fields with `row: true` + a stored `rowGrid`) still print via the old clone-down fallback so existing forms keep working; re-saving them in the editor migrates nothing automatically — group their day-1 boxes to move to the new system.

### Initials Question Type (drawn sign-off)

An **initials** question is a wizard question whose `type` is `'initials'`. Instead of a text/number/select control, the runner shows a **canvas draw pad** (the shared draw-pad machinery) sized to the bound field's aspect ratio, plus a name/initials input. Whoever fills it draws their initials with a stylus; the strokes are stored as normalized `[x, y]` point arrays (same vector format as the signature — no image). This is an accountability record: every person who touches a day leaves a mark that prints in the box on the controlled form.

- **Configure:** place a box over the form's initials spot and bind it to a question of type **✍️ initials** via the Field properties panel ("Filled by question"). The editor shows a ✍️ badge on the bound box, derived from the binding — there is no per-field flag. To make it a **per-day** sign-off on a weekly sheet, place the box as part of the day-1 row, group it (🔗) so it clones to all 7 days, and mark the question **row-scoped**; each day's clone then carries its own pad and prints that day's strokes.
- **Fill:** the initials question is a normal step in the wizard — place it last for an end-of-day sign-off. The person draws their initials; saving stores them on **that specific day** (row-scoped) or the instance (one-shot/event). Re-opening repaints what was drawn, so it can be corrected or re-signed. An empty pad on save clears the answer (`null`).
- **Storage:** the answer lives in the normal answer slot — `days[YYYY-MM-DD][questionId]` for a row-scoped question, `header[questionId]` otherwise — as `{ name, strokes } | null`. There is no separate per-day initials structure.
- **Print:** each box prints its bound question's strokes as an inline SVG polyline at the box's placed position (a group member prints its own day's strokes). A box with no strokes prints empty.
- **Completion:** a row-scoped initials question counts like any other row-scoped question — a day is "answered" only once its strokes are present (`hasAnswer` treats the `{strokes}` object as answered when non-empty). The leaf's progress chip and the runner's day chips reflect this.
- **"⏪ Same as last time"** never copies drawn initials — each person draws their own.
- **Who signs what:** floor staff initial their own day via an initials question; the **master grower's signature** (the sheet's `signature` box) is a separate, whole-log sign-off captured **only** via the filing-cabinet leaf's orange ✍️ Sign button — later, when he reviews the paperwork at the end of a crop. The daily wizard NEVER prompts for it and saving a day's entry never touches it. The two are independent systems.

### Constant / Header Fields (set once per lot)

A **constant field** is a box whose value is fixed for the whole life of a lot's paper chain — e.g. the substrate lot on a daily grow-log: different per crop, tracked as plain text, with no DB source to auto-fill from. Instead of answering it every day (or never), the user sets it **once, before the first day**, and it prints on every page of the chain.

- **Configure:** in the Field properties panel (daily-weekly sheets only) check **📌 Constant field** on a box bound to a question. The editor shows a gold 📌 badge on such boxes; the wizard builder's binding indicator notes "constant — set via Initialize paperwork, skipped by the daily runner". The flag is **mutually exclusive with `source`** in both directions (picking a source clears the flag; checking the flag clears the source). A constant field must be question-bound — an unflagged/unbound box does nothing.
- **Initialize paperwork quiz:** the Filing Cabinet toolbar has a **📋 Initialize paperwork** button (visible when the active lot has at least one daily-weekly sheet with constant fields). It runs a step-through quiz in the same runner card UI as the daily wizard — one step per constant question across all of the lot's daily-weekly sheets, grouped by sheet ("Constant N of M") — but with **no day chips and no instance**. Text/number/select questions render their normal controls; an initials-type constant question renders the draw pad. On save the values are written to `entries[lotId][sheetId].constants` (below) and a toast confirms. The button is **always re-runnable** — re-running pre-fills the current values so they can be edited. If no constant fields exist, clicking it shows a hint to flag a box in Configure Sheets.
- **Storage:** lot+sheet level — `entries[lotId][sheetId].constants` (a map `questionId → value`, sibling to `instances`). This is deliberately **not** per-instance: the values persist across every weekly instance in the chain and survive phase/room rollovers (a fresh instance reads the same constants). Initials-type constants store `{ name, strokes } | null` like any other initials answer; text values are trimmed strings. The path is created lazily on first save — a sheet with no instances yet still gets one.
- **Daily runner exclusion:** constant questions are **filtered out of the daily runner** (and from "⏪ Same as last time", progress, and completion math) — they are never asked day by day. If *every* question on a daily-weekly sheet is constant, opening its leaf shows a toast pointing at the Initialize button instead of an empty wizard.
- **Print:** in `printFieldValue` the constant check is the **first** branch (before source and before the dayGroup/row branch) — so a constant box inside a daily-entry group prints the one lot-level value on **every day**, not that day's answer. Unset constants print `N/A` like any other empty field, and the Print tooltip lists "N constant value(s) unset" as an informational blocker (printing is still allowed).
- **Scope:** daily-weekly sheets only — one-shot and event sheets have no chain to share a value across, so the flag is not offered for them.

### Write-Back Question Types (plant count, phase, room)

Three question types exist specifically to write back to the main DB (see "Write-Back to the Main DB"). The write-back is **implicit by type** — there is no per-question setting (the old `writesTo` field was removed): a plant-count question always writes `lot.plantCount`, a phase question always writes `lot.stage`, and a room question always writes `lot.currentRoom`. Switching a question's type changes (or removes) its write-back automatically, so the special behavior can never be configured on a plain text/number/select.

- **🌱 Plant count (`type: 'plant-count'`):** renders as a number input in the runner. Works at either scope — row-scoped (per-day count, the usual grow-log case) or instance-level. On save, if the recorded value differs from `DB.lots[lotId].plantCount`, PaperWizard updates the lot record and calls `notifySitkaTools()`. Same value = no write; per-day entries keep the full history either way. A count that **drops to 0** (all plants removed) additionally strikes out the open log on that day — same drawn-initials capture, but **no fresh page** is started (there is nothing left to grow). Only a *drop* to zero triggers it; re-saving an already-closed log at 0 does not roll over again.
- **🔄 Phase (`type: 'phase'`):** renders as a drop-down of the **fixed phase vocabulary** — `Cloning / Mother / Vegetation / Bloom / Harvesting` (the form's words for the DB's lowercase stages, via the same bridge as `lot.stage` bindings). No custom options list. The answer is compared against the lot's **live `stage` in the main DB** (`currentLotPhase`) — not a walk-back through saved answers:
  - A pick **different from the lot's current phase** means the lot changed phase: on save, PaperWizard writes the new phase back to `lot.stage` and — *after that day's full entry has been saved* — strikes out this log (`phaseChangeDate` = **the entry's own day**, so a backfilled entry strikes out and starts the new page on that past day) and starts a **fresh 7-day page on the same day** (see "Phase & Room Change").
  - A pick **equal to the current phase** just records it for the day — this is how the fresh log's first day carries the new phase in the double entry without triggering another rollover.
  - Works at either scope; instance-level answers store in the header, row-scoped per day.
- **🏠 Room (`type: 'room'`):** renders as a select over the facility's known room names (every room in the main DB, sorted). Works at either scope with exactly the same comparison and rollover rules as Phase — the answer is compared against the lot's **live `currentRoom`** (`currentLotRoom`); a different pick writes `lot.currentRoom` back and triggers the same save-first strike-out rollover (see "Phase & Room Change").
  - **Same-save double change:** when *both* phase and room change in one save, a single strike-out records both — the fresh log carries the new phase *and* the new room, and both write-backs fire. No second rollover runs (it would create a phantom zero-day log).

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
| `lot.dryRoom` / `lot.trimRoom` | Dry / trim room names stored on the lot (dry rooms double as trim rooms; the two fields may point at the same or different rooms, and each has its own clean form) |
| `lot.currentRoom` | The lot's current room (live) — set at creation from the start-room choice, updated by PaperWizard when a log entry records a room change |
| `instance.phase` | Phase snapshot captured when a daily-weekly instance was created (grow-log header — see "Phase & Room Change") |
| `sheet.periodStart` / `sheet.periodEnd` | The instance's window dates (e.g. grow-log week start/end) |
| `day.date` | The date of the current day-row (`MM/DD`) — daily-entry group members only. Derived per member at print time from the instance key + the member's `day`; **never snapshotted** (it is a function of the row, not of DB state). This is what fills the grow-log's Date column with zero questions. |
| `day.plantsRemoved` | Plants removed on the current day-row: **yesterday's plant count − today's**, clamped at 0 — daily-entry group members only. Derived per member at print time from the saved 🌱 plant-count answers; **never snapshotted** (like `day.date`). "Today" must be an explicit answer *on that day* (no walk-back — falling back to an earlier day's count would understate removals); "yesterday" walks back through this instance's days, then earlier instances at a chain start. Prints `N/A` when today's count is unanswered or no prior count exists (e.g. the window's first day). Requires a row-scoped plant-count question on the sheet's wizard. |
| `signature.date` | The date the instance was signed, formatted **yyyy/mm/dd** — stamped automatically when the master grower saves his signature via the cabinet leaf's ✍️ Sign button (re-signing updates it; clearing the pad removes it). Resolved live from `inst.signature.date` at print time and **never snapshotted**; prints `N/A` until the log is signed. Bind a header box to it to put the sign-off date on the form with zero questions. |

**Source of plant count & parent lot #:** SitkaTools already stores both on the lot record at creation time (`plantCount`, `parentLotId`) — no schema change needed for auto-fill. **Pending SitkaTools change (not PaperWizard):** the parent-lot picker is currently a dropdown of existing lots; it should also accept manual free-text entry so a lot can be created from a parent that isn't in the system.

**Plant count is a live value:** `lot.plantCount` holds the *current* count — SitkaTools sets it to the starting count at lot creation, and PaperWizard updates it whenever a grow-log entry records a different count (see "Write-Back to the Main DB"). The per-day entries keep the full count history; the main DB always shows the latest.

**Bindings resolve at save time, not render time.** When an instance is created — and again on every entry saved to it — the tool resolves every binding used by that sheet against the current DB and stores the results on the instance (`snapshots`, see "Entry & Instance"). The exceptions are `day.date`, `day.plantsRemoved`, and `signature.date`, which are derived at print time and never snapshotted. At render/print time the popup prints the **stored snapshot**; it never re-resolves live values. This is deliberate policy: paperwork is a historical record, and plants keep transitioning phases while their paper trail is still being printed. A completed Veg grow-log must keep printing "Veg" in its header long after the lot has moved to Bloom; a propagation worksheet must keep printing the plant count that was true when it was saved. (An instance saved before this rule existed has no `snapshots` — for those, render time falls back to resolving live.)

### Signature Box & Capture

A sheet may have signature boxes (`signature`: normalized `x/y/w/h` + optional label like "Initials"). Signing flow:

1. The filing-cabinet leaf's orange **✍️ Sign** button opens a signature-only modal: a **canvas pad** sized to the box's aspect ratio, plus a text input for the signer's name/initials. This is the ONLY capture path — the wizard runner has no signature step (the master grower signs at end-of-crop review, not during daily fill-out); saving a day's entry leaves any existing signature untouched.
2. Capture uses pointer events; each stroke is stored as an array of `[x, y]` points **normalized 0–1 within the signature box**. No image is generated or stored — strokes are pure vector data (small: a few dozen points per stroke).
3. At print time the popup renders the strokes as an inline **SVG polyline** positioned over the page image at the box location, scaled to the box's rendered size. The signer's typed name is *not* printed unless a field is bound to it — the stroke is the signature.
4. **Signature date:** saving the signature also stamps `inst.signature.date` with the local date (YYYY-MM-DD) — re-signing updates it, clearing the pad removes it. A field bound to the `signature.date` auto-fill binding prints that date as **yyyy/mm/dd** (resolved live at print time, never snapshotted; N/A until signed), so the form carries the sign-off date with zero questions.

Re-signing replaces the stored strokes. An instance without a signature (when the sheet defines one) can still be printed — the signature box simply prints empty and the Print tooltip notes "signature missing".

**Shared draw-pad machinery:** this canvas pad is the single generic pointer-captured drawing surface used by all three drawn-ink features — the end-of-log **signature**, the **initials question** (see "Initials Question Type"), and the phase/room-change **strike-out initials** (see "Phase & Room Change"). All store the same normalized-stroke vector format and print through the same SVG-polyline overlay path.

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
| `type` | `'text' \| 'number' \| 'select' \| 'initials' \| 'plant-count' \| 'phase' \| 'room'` | Input control — **string input**, **number input**, **simple multiple choice** (fixed options list), **✍️ initials** (a draw pad that stores `{name, strokes}`; see "Initials Question Type"), **🌱 plant count** (number input whose answer writes back to `lot.plantCount` — see "Write-Back to the Main DB"), **🔄 phase** (select over the fixed phase vocabulary, whose answer writes back to `lot.stage` and drives the phase-change rollover), or **🏠 room** (select over the facility's room names, whose answer writes back to `lot.currentRoom` and drives the same rollover). New types can be added to the schema later without a migration. |
| `options[]` | array of strings | For `select`. Ignored for `phase` — its options are the fixed vocabulary (below), not a custom list. |
| *(binding)* | derived | A question fills whichever field(s) carry its id in `questionId` — the binding is assigned from the field side (Field properties → "Filled by question"), never from the question. A question no field references is notes-only (its answer stores but prints nowhere). |
| `rowScoped` | boolean | `true` = the answer is captured **per day row** (daily wizard on a weekly sheet); `false` = one answer for the whole instance (header/one-shot). |
| `sameAsLast` | boolean | Offer the **"⏪ Same as last time"** action for this question. For `rowScoped` questions it copies the *previous day's* answer; for instance-level questions it copies the previous instance's answer. Default on for most daily questions. |
| `mandatory` | boolean, default false | **Mandatory response** — while this question has no answer, the runner hides the Next / Save button (Back stays available) and Enter does not advance; a toast names the missing question. An initials question counts as answered only once strokes are drawn. Applies in both the daily runner and the Initialize paperwork quiz. |
| *(write-back)* | derived | Plant-count / phase / room questions **implicitly** write back to `lot.plantCount` / `lot.stage` / `lot.currentRoom` — a property of the type, with no per-question setting (see "Write-Back to the Main DB"). The old `writesTo` field was removed. |
| `prefillFrom` | binding string \| null | Optional — pre-fills the input with the resolved binding value when the wizard opens (e.g. "Starting plant count" pre-filled from `lot.plantCount`). The user can still edit; the stored answer is what prints. |

**"Same as last time" semantics:** it pre-fills the form — it never auto-saves. The user still reviews and confirms. If there is no previous day/instance, the button is disabled.  The button will pull from last week's 7-day sheet to get "Last time" when a
a new sheet starts in a chain of sheets. **Phase / room change questions are never auto-copied** — they are deliberate change actions, and copying the old log's stamped move-day value onto the fresh log's first day could silently re-trigger a rollover. Everything else (including on the fresh page after a phase/room change) still copies normally.

**Fill flow (the runner):** opening a daily-weekly leaf runs a step-through card, not one big form. For a given day the steps are: **each wizard question in order (an initials question renders its draw pad).** Constant questions (fields flagged 📌) are **excluded** — they are set once per lot via the Initialize paperwork quiz and never asked day by day (see "Constant / Header Fields"). There is **no signature step** — the master grower's signature is captured only via the cabinet leaf's ✍️ Sign button at end-of-crop review, never during daily fill-out. Day chips across the top let the user jump between days; each day's answers — including any drawn initials — are saved per day / per instance on **Save**.

### Entry & Instance (filled data)

Filled answers live per **lot → sheet → instance**:

- **`one-shot` sheets** (propagation worksheet): a single instance per lot, anchored to lot creation.
- **`daily-weekly` sheets** (grow-log): one instance per rolling 7-day window. The window is **not** a fixed calendar week — it starts on the day of the first daily entry saved for that window (`periodStart` = first entry date, `periodEnd` = +6 days). Instances are created on demand: saving a day's entry with no open instance starts one; an entry 7+ days after `periodStart` (or after a phase change) starts the next.
- **`event` sheets** (room clean, IPM, harvest): one instance per triggering event/date; the instance key is the event date.

An instance stores:

| Field | Type | Notes |
|---|---|---|
| `phase` | string \| null | Snapshot of `lot.stage` at instance creation — daily-weekly sheets only. The grow-log header prints this, so a closed (old-phase) log keeps its original phase even after the lot moves on. |
| `room` | string \| null | Snapshot of `lot.currentRoom` at instance creation — daily-weekly sheets only. A room change mid-window rolls the log over exactly like a phase change (see "Phase & Room Change"); a closed log keeps its original room even after the lot moves on. |
| `header` | map `questionId → value` | Instance-level (non-row) answers. |
| `days` | map `YYYY-MM-DD → { questionId → value, confirmed?: string[] }` | Per-day answers for row-scoped questions. A row-scoped **initials** question stores its `{ name, strokes }` object here (see "Initials Question Type"). `confirmed` is the list of non-initials row-scoped question ids the user has saved this day's entry with — blank-but-confirmed fields count as filled for completion (see "Completion Rules"); initials are never in it. |
| `phaseChangeDate` | `YYYY-MM-DD` \| null | Set when the lot moved to a new phase **or room** mid-window — or when all plants were removed (plant count 0) (see "Phase & Room Change"). Rows after this date are struck through at render time and no longer require entries. |
| `strikeInitials` | `{ name, strokes }` \| string \| null | The confirmer's **drawn** strike-out initials — captured on a stylus pad when the early end was confirmed (see "Phase & Room Change"). Printed as an SVG polyline **above** the strike line (the date prints below it). Required for the instance to *complete*; without them a struck-through instance can still be printed, but the strike line simply doesn't render. *Legacy:* instances saved before drawn capture store a plain typed string; print falls back to rendering that string centered in the box. |
| `snapshots` | map `binding → value` | Save-time binding values (see "Auto-Fill Bindings"). Captured at instance creation and refreshed on every entry save; this — not the live DB — is what prints. |
| `signature` | `{ name, strokes: [[x,y,…], …], date?: YYYY-MM-DD } \| null` | Captured signature (normalized points). `date` is stamped automatically when the signature is saved via the ✍️ Sign button (re-signing updates it; clearing removes it) and feeds the `signature.date` binding. Legacy signatures without a `date` print N/A in bound boxes until re-signed. |
| `completedAt` | ISO string \| null | Set when the completion rule is satisfied. |
| `printedAt` | ISO string \| null | Set after a successful print-popup render (informational; re-printing always allowed). |

A daily-weekly sheet's entry object may also carry **`constants`** — a map `questionId → value` sibling to `instances`, holding the lot-level values for that sheet's constant fields (see "Constant / Header Fields"). It is created lazily by the Initialize paperwork quiz and shared by every instance in the chain.

### Filing Cabinet (lot paperwork tree)

The first page of the tool is the **filing cabinet**: a tree view of every document in the active lot's file. The cabinet is a pure *view* — computed from `entries`, the lot record, and configured sheets; it stores nothing of its own. One cabinet per lot; the header's lot selector switches cabinets. A lot that no longer exists in `DB.lots` (closed/orphaned) still gets a cabinet so its paper history stays browsable and printable.

The tree has seven sections in fixed order (plus a catch-all "Other" when unclassified sheets exist):

```
🗄️ LOT-001 Purple Haze — 18 documents · ⚠️ 1 missing
├─▸ 📁 Propagation
├─▾ 📁 Room Cleans (pre-move-in)
│   ├─ 🧼 Clone Room · Sep 12 · from LOT-000 ... ✓ on file
│   ├─ 🧼 Veg Room · Sep 15 · from LOT-000 ..... ✓ on file
│   ├─ 🧼 Grow Room ............................ ⚠️ missing
│   ├─ 🧼 Dry Room ............................. — not assigned
│   └─ 🧼 Trim Room ............................ — not assigned
├─▾ 📁 Room Cleans (post-usage)
│   ├─ 🧼 Clone Room · Sep 12 ................... ✓ complete
│   └─ 📅 New clean · Veg Room .................. ⏳ due
├─▾ 📁 Grow Logs (12)
│   ├─ 📗 Sep 21–27 · Veg ...................... 4/7 days
│   ├─ 📗 Sep 28 – Oct 4 · Veg ................. ✓ complete
│   └─ ⋮ one node per weekly instance, oldest first
├─▸ 📁 IPM Log
├─▸ 📁 Harvest
├─▸ 📁 Drying Logs
└─▸ 📁 Trim Logs
```

- **Propagation** — the lot's one-shot propagation worksheet instance.
- **Room Cleans (pre-move-in)** — proof that each room was cleaned *before this lot moved in*. The tree always lists all five rooms — **Clone · Veg · Grow · Dry · Trim** — mapped to the lot's `cloningRoom` / `vegRoom` / `destRoom` / `dryRoom` / `trimRoom`. For each assigned room, the cabinet shows a read-only reference node to the most recent qualifying clean on file (filled under the **previous occupant's** entries, tagged "from LOT-000"); an unassigned room renders as a neutral "— not assigned" leaf; an assigned room with no qualifying clean renders as a ⚠️ warning leaf — informational, never blocks other sheets.
- **Room Cleans (post-usage)** — this lot's *own* fillable clean forms, one per room role. Each role uses the cleaning sheet configured for it (the Document dropdown's per-room values: `room-clean-clone` … `room-clean-trim`); a role with no configured form shows "⚠️ no form configured". Instances are `event` sheets keyed by clean date, plus a "📅 New clean · {room}" leaf when today has no instance yet. These owned instances are exactly what the *next* occupant's pre-move-in tree references. (Legacy cleaning sheets whose room role can't be inferred from their Document value or name keywords file here as catch-all leaves.)
- **Grow Logs** — one node per `daily-weekly` instance, oldest first, labeled with its window and phase snapshot. A full crop runs 10–14 weeks, so this section typically holds 10–14 nodes.
  - **Coverage from the planting date:** when the lot was configured in CropLabourWizard (`_tool_CropLabourWizard.plantingDate` on file), every day from planting through today must sit inside some instance's active window. Uncovered days are grouped into runs and rendered as dashed **🌱 Backfill** leaves (e.g. "Backfill Jun 05–Jun 11 · ⚠️ 7 days no log") that count as missing in the section header; tapping one starts a fresh 7-day window on the run's first day so the gap can be filled in.
  - **Unconfigured lot:** when the lot has no `plantingDate` on file, the cabinet shows a warning banner — "run it through the CropLabourWizard first" — and coverage checking is skipped (the generic "📅 Start new week" leaf still appears when today is outside every window).
- **IPM Log** — one node per IPM event instance (application date).
- **Harvest** — the lot's harvest log instance(s); empty until harvest.
- **Drying Logs / Trim Logs** — `daily-weekly` sections for the post-harvest paperwork: the daily drying log and the daily trim log, each one node per 7-day window like Grow Logs. They file under their Document assignment (`drying-log` / `trim-log`) and use the same rolling-window + "📅 Start new week" machinery; they have **no** planting-date coverage rule (that applies to grow-logs only).

**Pre-move-in clean sourcing rule:** a room-clean instance is an `event` sheet stored under the lot that performed the clean, with the room name in its header and the clean date as its instance key. To populate a lot's pre-move-in tree, the cabinet scans *all lots'* room-clean instances for a matching room name and picks the most recent one dated **on or before this lot's move-in date** to that room:

- **Log-derived dates win:** when the lot's grow logs record a 🏠 Room question, the move-in date is the first day any daily-weekly log's room answer equals that room (`firstRoomEntryDate`) — the paper trail is the source of truth.
- **Phase fallback:** without log evidence, clone = `lot.createdDate`; veg = `periodStart` of the lot's first grow-log instance with phase Veg; grow = `periodStart` of the first Bloom instance.
- If nothing qualifies yet, "move-in" falls back to today — any earlier clean of that room qualifies.

The match is derived at view time from (room name, date) — no link field is stored on either side. Reference nodes open the same print popup as owned instances but offer no fill action; the data lives in the other lot's file.

**Leaf status:** every leaf shows one of — `✓ complete` (completion rule met), progress (`4/7 days`), `⏳ due`, `⚠️ missing` (expected document absent), or `— not started`. Section headers aggregate counts ("14 documents · 1 missing").

**📋 Initialize paperwork button:** the cabinet toolbar (between Load document and the print chip) shows this button when the active lot has at least one daily-weekly sheet with constant fields (see "Constant / Header Fields"). It opens the initialize quiz for that lot. While any constant value is unset the button carries a ⚠️ marker and its tooltip says how many are missing; once all are set it reads "re-run to change them".

### Phase & Room Change (grow-log rollover)

When a lot moves Clone → Veg → Bloom — or when it **moves rooms** (e.g. into the dry room after harvest) — its open daily-weekly log rolls over. Both changes use the exact same machinery: one shared rollover core (`dailyRollover`) parameterized by which tracked value changed.

1. **Detection / recording:** each change can originate in either direction. If the lot's live `stage` (changed in SitkaTools) no longer matches the open instance's stored `phase`, PaperWizard prompts to confirm the move ("Lot is now in Bloom — close this grow-log?"); likewise, if the lot's live `currentRoom` no longer matches the open instance's stored `room`, it prompts ("Lot is now in Dry Room 1 — close this log?"). Alternatively the change is recorded directly in the daily wizard via a Phase question (`type: 'phase'`, `writesTo: 'lot.stage'`) or a Room question (`type: 'room'`, `writesTo: 'lot.currentRoom'`): the answer is compared against the lot's **live value in the main DB** (not a walk-back through saved answers), and a different pick writes the new value back to the main DB (see "Write-Back to the Main DB").
   - **Save-first strike-out:** the user fills out that day's *entire* row before the sheet is struck through. On save, the day's full entry is persisted first (including the change question), then — if a change was recorded — the drawn-initials capture opens and confirmation records `phaseChangeDate` = **the entry's own day** (a backfilled entry strikes out on that past day; the strike-out and the fresh page both land there) **and captures the confirmer's drawn strike-out initials** on the old instance, then creates a fresh instance carrying the new value. Cancelling at the initials prompt rolls the whole save back — nothing is saved, no write-backs fire, and the runner stays open with its draft intact.
   - **Drawn capture (not a typed prompt):** confirming opens a modal with a stylus pad (the shared draw-pad machinery) + a name input — "Strike-out initials — {newValue}". The confirmer *draws* their initials; an empty pad is rejected ("Draw your initials first") and Cancel aborts the whole change with no changes. The result is stored as `strikeInitials = { name, strokes }` on the old instance (legacy instances may hold a plain string — print falls back to centered text).
2. **Double entry on the move day:** both instances carry an entry for the move date — one *full* entry under the old value (old sheet), one to be filled in under the new value (new sheet, whose first entry is that day). The new instance's `periodStart` is the move date and its header carries the new value. With a **row-scoped** question this is automatic: the old log's move-day row is stamped with the *previous* value (the user filled that day out fully under the old phase/room before the strike-out), and the fresh 7-day page starts on the **same day** — its move-day row is left for the user to walk the wizard through a second time, answering every question uniquely under the new value. "⏪ Same as last time" stays available on that fresh entry for the unchanged questions (phase/room change questions are never auto-copied — they are deliberate actions).
   - **Cross-snapshot stamping:** a phase change doesn't move the lot, and a room change doesn't change its phase — so every fresh instance carries *both* snapshots: the rollover stamps the other value onto the new instance (from the old instance's snapshot, or from `lot.currentRoom` / `lot.stage` when absent).
   - **Same-save double change:** if both questions change in one save, a single strike-out records both — the fresh log carries the new phase *and* the new room, and both write-backs fire. No second rollover runs (it would create a phantom zero-day log).
3. **Strike-through on the old sheet:** when a 7-day grow-log ends early, policy is a **diagonal strike-out across the remaining day rows, with the confirmer's initials above the line and the change date below it**. Those rows no longer require entries — the old instance completes when all days from `periodStart` through `phaseChangeDate` are filled (+ signature if defined).

   **Strike-out computation:** the overlay is derived, never stored. A pure function takes the instance (`phaseChangeDate`, `strikeInitials`) plus the sheet's explicit day-row geometry (the daily-entry groups' placed boxes — no pitch math) and returns, **per page**:
   - **struck rows** — every day row whose date (instance key + member's `day` − 1) is after `phaseChangeDate`;
   - **the diagonal** — one line from the top-right corner of the first struck row to the bottom-left corner of the last struck row, in normalized page coordinates;
   - **label positions** — an `initialsRect` (a wide/short box centered just above the line's midpoint) for the drawn strike initials, and a date position centered just below it.

   A multi-page daily form (e.g. a two-page grow-log whose second page is also daily repeating) gets the **same strike-out on every page that has struck rows** — each page's remaining day rows are crossed by their own diagonal with the initials above and the change date below, computed in that page's coordinates. The same computation feeds the print popup (SVG overlay) and any on-screen preview, so what prints is exactly what was computed from the saved data. The drawn `strikeInitials` render as an SVG polyline inside `initialsRect`; a legacy string renders as centered text in the same rect.

### Write-Back to the Main DB (PaperWizard's Special Permission)

PaperWizard is the **only tool in the suite allowed to modify another tool's data**. The permission is narrow and fixed: it may write exactly three fields on a lot record — `plantCount`, `stage`, and `currentRoom`. No other field, no other tool. Everything else remains read-only.

Write-backs are driven by wizard questions carrying a `writesTo` binding (see the question table above). The three dedicated question types — **🌱 plant count**, **🔄 phase**, and **🏠 room** (see "Write-Back Question Types") — lock their `writesTo` to the matching target, so the write-back is a property of the type:

- **Plant count (`lot.plantCount`):** any plant-count question (row-scoped or instance-level) whose saved value differs from `DB.lots[lotId].plantCount` updates the lot record and calls `notifySitkaTools()`. Same value = no write. The lot's count follows the most recently saved entry; per-day entries remain the full paper trail. A count that **drops to 0** (all plants removed) additionally strikes out the open log on that day — drawn initials, no fresh page.
- **Phase (`lot.stage`):** any phase question (instance-level or row-scoped) whose answer differs from the lot's **live `stage`** triggers the standard rollover (strike-through + new instance, see above) **and** writes the new phase to `DB.lots[lotId].stage` + `notifySitkaTools()`. The write-back fires in the save-first flow (entry saved, then strike-out confirmed), and the save flow offers to run the move-day entry for the new instance — producing the double entry on the move day.
- **Room (`lot.currentRoom`):** any room question whose answer differs from the lot's **live `currentRoom`** triggers the same rollover **and** writes the new room to `DB.lots[lotId].currentRoom` + `notifySitkaTools()`. When a phase rollover already ran in the same save, the fresh log carries the new room (absorbed by the rollover core) and only the write-back fires — no second strike-out.

All three write-backs travel over the standard postMessage channel (the full-DB `sitkaGit_db_update` payload) — no protocol change; SitkaTools auto-refreshes as it does for any subtool update. The reverse direction still works: if the stage or currentRoom was changed *in* SitkaTools, PaperWizard's mismatch detection prompts and rolls over without writing anything back (the main DB is already correct).

Because bindings snapshot at save time (see "Auto-Fill Bindings"), a one-shot sheet may bind directly to a live value and still print it *as captured* — e.g. starting plant count on the propagation worksheet binds to `lot.plantCount` and keeps printing the creation-time count on every re-print, because the snapshot was taken when the worksheet was saved. `prefillFrom` questions remain the tool for values that need human confirmation before they go on file.

### Completion Rules

- **`daily-weekly`:** complete when **every day slot in the active window** has answers for every row-scoped question — including any row-scoped **initials** question, which counts only once its strokes are drawn (see "Initials Question Type") — and (if the sheet has one) a signature is captured. The active window is normally all 7 days (`periodStart` … `periodEnd`) — but if `phaseChangeDate` is set, the window ends there instead (struck-through rows don't count) and `strikeInitials` must be captured so the strike-out can print. Completion drives the leaf's status chip (`✓ complete`, `4/7 days`, `3/5 · phase change Sep 24`) and the Print tooltip — **not** the button: 🖨️ Print is clickable whenever an entry exists and the page set is loaded, so a partial week can be printed on demand (missing fields print N/A).
  - **Blank-but-confirmed counts:** when the user saves a day's entry, every non-initials row-scoped question is recorded in that day's `confirmed` list — so an intentionally left-blank box (e.g. an empty comments field) still counts as filled out for that day, and the progress chip advances (`3/7` → `4/7`). **Initials are never waived** — a row-scoped initials question always requires drawn strokes regardless of confirm; it is excluded from `confirmed`. The list is merged across saves (once confirmed, stays counted even if a later re-save leaves the box blank). Printing is unaffected: a blank-but-confirmed field still prints `N/A`.
- **`one-shot`:** complete when all instance-level questions are answered (+ signature if defined).
- **`event`:** complete when its questions are answered (+ signature if defined) — each event is a self-contained sheet.

Completion is re-evaluated after every save; it is never stored as a flag, only `completedAt`.

## Page Image Handling — Just-In-Time Load

- **"Load document" button** (hidden `<input type="file" accept=".webp,image/webp" multiple>`) appears in both tabs:
  - **Configure Sheets:** required before the preview renders and before any box can be placed. The picker accepts a whole page set at once (`<base>-p1.webp`, `-p2.webp`, …). Loading a *new* base name starts a new sheet configuration; loading a set matching an existing sheet id opens that sheet for editing (with a confirm if it already has fields).
  - **Filing Cabinet → Print:** required at print time for the selected instance. The loaded page set is validated against the sheet id (base-name match + consecutive numbering from p1), then handed to the print popup.
- **Validation** (`parsePageFiles`): WebP only; all files share one base name; page numbers are consecutive 1..N with no gaps or duplicates. Any violation is rejected with a clear error naming the offending file.
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

- **N/A default:** any field whose value is empty or missing — an unanswered question, or a binding that resolved to null (e.g. `lot.parentLotId` on a new lot) — prints **`N/A`**, never a blank box. A controlled document is complete on its face; "not applicable" is itself a filled-in answer.  - **Unfilled day rows print blank:** the one exception is a daily-entry group member (or legacy row field) on a day that was **never saved** — those boxes print empty, not `N/A`. A struck-out log's remaining days stay clean under the strike line instead of filling the page with N/A. A day that *was* saved still prints `N/A` for its empty boxes (including intentionally blank-but-confirmed fields), and header / one-shot / event fields keep the N/A default.- **Strike-out:** an instance with a `phaseChangeDate` renders the computed strike-out (diagonal across the remaining day rows, initials above the line, date below — see "Phase & Room Change") as part of the overlay.

## Page Image Rendering (decided)

Each page is a plain `<img>` inside a `.form-page` container whose inline `aspect-ratio` comes from the image's actual pixel dimensions (`wPx / hPx`). Normalized 0–1 box coordinates → percentages of that container, so boxes track the image at any display size with pure CSS — no JS sizing, and window resizes need no handler. A zoom control (buttons + Ctrl/⌘+scroll) scales the pages via a CSS variable for precise box placement.

- Zero dependencies; works fully offline on `file://` — consistent with the suite's no-network rule.
- Image pixel dimensions determine portrait or landscape; the print size is automatically North American Letter (8.5 × 11 in, rotated for landscape). The stored `pageWidthIn`/`pageHeightIn` values are generated from that orientation and used for print scaling (pt → inches).
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
            "fontSize": 12, "align": "left", "source": "lot.strain", "questionId": null, "day": 1, "dayGroup": null },
          { "id": "b7m2", "label": "Lot #", "x": 0.62, "y": 0.07, "w": 0.3, "h": 0.035,
            "fontSize": 12, "align": "left", "source": "lot.name", "questionId": null, "day": 1, "dayGroup": null },
          { "id": "c4p8", "label": "Phase", "x": 0.12, "y": 0.11, "w": 0.3, "h": 0.035,
            "fontSize": 12, "align": "left", "source": "instance.phase", "questionId": null, "day": 1, "dayGroup": null },
          { "id": "s7u3", "label": "Substrate lot", "x": 0.62, "y": 0.11, "w": 0.3, "h": 0.035,
            "fontSize": 12, "align": "left", "source": null, "questionId": "subl", "day": 1, "dayGroup": null, "constant": true },
          { "id": "d9q1", "label": "Temp high (°C)", "x": 0.45, "y": 0.30, "w": 0.12, "h": 0.03,
            "fontSize": 10, "align": "center", "source": null, "questionId": "t1hi", "day": 1, "dayGroup": "g7xk" },
          { "id": "e2m4", "label": "Temp high (°C)", "x": 0.45, "y": 0.395, "w": 0.12, "h": 0.03,
            "fontSize": 10, "align": "center", "source": null, "questionId": "t1hi", "day": 2, "dayGroup": "g7xk" },
          { "id": "f8n5", "label": "Temp high (°C)", "x": 0.45, "y": 0.49, "w": 0.12, "h": 0.03,
            "fontSize": 10, "align": "center", "source": null, "questionId": "t1hi", "day": 3, "dayGroup": "g7xk" },
          { "id": "…", "label": "Temp high (°C)", "x": 0.45, "y": "…", "w": 0.12, "h": 0.03,
            "fontSize": 10, "align": "center", "source": null, "questionId": "t1hi", "day": "4..7", "dayGroup": "g7xk" },
          { "id": "i9z2", "label": "Initials", "x": 0.68, "y": 0.30, "w": 0.16, "h": 0.03,
            "fontSize": 10, "align": "center", "source": null, "questionId": "init1", "day": 1, "dayGroup": "gInit" },
          { "id": "…", "label": "Initials", "x": 0.68, "y": "…", "w": 0.16, "h": 0.03,
            "fontSize": 10, "align": "center", "source": null, "questionId": "init1", "day": "2..7", "dayGroup": "gInit" }
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
          { "id": "subl", "label": "Substrate lot", "type": "text", "options": [],
            "rowScoped": false, "sameAsLast": false, "mandatory": false },
          { "id": "t1hi", "label": "Temp high (°C)", "type": "number", "options": [],
            "rowScoped": true, "sameAsLast": true, "mandatory": true },
          { "id": "cnt1", "label": "Current plant count", "type": "number", "options": [],
            "rowScoped": true, "sameAsLast": true, "mandatory": false },
          { "id": "rm1x", "label": "Room", "type": "room", "options": [],
            "rowScoped": false, "sameAsLast": true, "mandatory": false },
          { "id": "obs1", "label": "Observations / notes", "type": "text", "options": [],
            "rowScoped": true, "sameAsLast": false, "mandatory": false },
          { "id": "init1", "label": "Initials", "type": "initials", "options": [],
            "rowScoped": true, "sameAsLast": false, "mandatory": true }
        ]
      }
    },
    "entries": {
      "LOT-001": {
        "grow-log": {
          "instances": {
            "2026-09-14": {
              "phase": "Clone",
              "room": "Clone Room 1",
              "header": {},
              "days": {
                "2026-09-14": { "t1hi": "24.0", "init1": { "name": "J.D.", "strokes": [[0.2, 0.5, 0.8, 0.4]] } },
                "2026-09-15": { "t1hi": "24.5", "init1": { "name": "M.K.", "strokes": [[0.3, 0.6, 0.7, 0.3]] } }
              },
              "phaseChangeDate": "2026-09-15",
              "strikeInitials": { "name": "R.V.", "strokes": [[0.15, 0.55, 0.85, 0.4]] },
              "snapshots": { "lot.name": "LOT-001", "lot.strain": "Purple Haze",
                              "lot.stage": "Clone", "lot.plantCount": "48" },
              "signature": null,
              "completedAt": "2026-09-15T16:20:00Z",
              "printedAt": null
            },
            "2026-09-21": {
              "phase": "Veg",
              "room": "Veg Room 2",
              "header": {},
              "days": {
                "2026-09-21": { "t1hi": "27.5", "obs1": "Looking strong.", "init1": { "name": "J.D.", "strokes": [[0.2, 0.5, 0.8, 0.4]] } },
                "2026-09-22": { "t1hi": "28.0", "obs1": "", "init1": null }
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
          },
          "constants": { "subl": "SL-2026-042" }
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

- **Ownership:** PaperWizard is the only tool that reads or writes `_PaperWizard`. It *reads* `lots`, `rooms`, and `buildings` from the main DB for auto-fill bindings and the lot selector. **Exception (unique to PaperWizard):** it may also write exactly three fields on lot records — `plantCount`, `stage`, and `currentRoom` — when a log entry records a change (see "Write-Back to the Main DB"). No other tool has this permission.
- **Sheet ids are page-image base names** — no separate id field, no random codes. Renaming a controlled form's page set means re-configuring (or an explicit rename action that updates the key).
- **Orphaned entries:** if a lot in `entries` no longer exists in `DB.lots`, its entries remain (paper history) but the lot never appears in selectors. If a sheet id has no matching configured sheet, it is ignored in the Filing Cabinet.
- **Cross-lot references are derived, not stored:** `LOT-000`'s room-clean instance above is exactly what `LOT-001`'s filing cabinet lists under Room Cleans (pre-move-in) — matched at view time by room name + date-on-or-before-move-in. No link field exists on either side.
- **No calendar events:** this tool appends nothing to `calendarEvents`.

## Initial Sheet Set (to be configured, not shipped)

These are the controlled forms the facility will configure in the Configure Sheets tab. None of them exist in code:

| Sheet (page-image base name) | Cadence | Notes |
|---|---|---|
| Propagation worksheet (`propagation-worksheet`, pages `propagation-worksheet-p1.webp`…) | one-shot | Filled once at lot creation; header auto-filled from lot keys (strain, lot #, parent lot #, dates). Starting plant count is a wizard question pre-filled from `lot.plantCount` so re-prints show the value at creation. |
| Weekly Grow-Log (`grow-log`, pages `grow-log-p1.webp`…) | daily-weekly | 7 day rows + phase header (Clone / Veg / Bloom via `instance.phase`). Rolling 7-day window from first entry; rolls over on phase change with strike-through. Each day row ends in an **initials box** bound to a row-scoped ✍️ initials question, so whoever fills the day draws their initials for accountability. Completes when the window fills (answers + per-day initials) → print. |
| Room-clean sheets — one per room role (`room-clean-clone`, `room-clean-veg`, `room-clean-grow`, `room-clean-dry`, `room-clean-trim`; pages `<base>-p1.webp`…) | event | One controlled form **per room** (the facility's five: Clone · Veg · Grow · Dry · Trim), each assigned via the Document dropdown. The room name is an overlaid field bound to the lot's room for that role. One instance per clean event, filed under the lot that performed the clean — it appears in this lot's **Room Cleans (post-usage)** tree and is referenced read-only by the *next* occupant's pre-move-in tree (see "Filing Cabinet"). A legacy single generic `room-clean` page set still works: its room role is inferred from name keywords. |
| IPM log (`ipm-log`, pages `ipm-log-p1.webp`…) | event | Pesticide/IPM application entries; print on demand (e.g. end of week or at close-out). |
| Harvest log (`harvest-log`, pages `harvest-log-p1.webp`…) | event | Harvest-day entries; print on demand. |
| Drying log (`drying-log`, pages `drying-log-p1.webp`…) | daily-weekly | Post-harvest daily drying-room log — one rolling 7-day window per period, same machinery as the grow-log (including room-change rollover when the lot moves rooms). No planting-date coverage rule. |
| Trim log (`trim-log`, pages `trim-log-p1.webp`…) | daily-weekly | Daily trim-room log — same machinery as the drying log. Dry rooms double as trim rooms, but the two logs (and their clean forms) are separate documents. |

## Relationship to SitkaTools

PaperWizard is part of the SitkaGit suite: a standalone single-file HTML application, vanilla HTML/CSS/JS, no build step, no network calls, running in the browser sandbox (`file://`).

### Two Launch Modes

1. **From SitkaTools (normal subtool mode):** opens as a popup per the suite convention; receives the DB via `postMessage` (`sitkaGit_db`), acknowledges with `sitkaGit_ready`, and calls `notifySitkaTools()` after every mutation to `_PaperWizard` (sheet/wizard saves, entry saves, signatures) **and after every lot write-back** (`plantCount` / `stage` / `currentRoom`).
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
│ [⬆️ Load document]  page size in                          │
│ ┌───────────────────┬──────────────────────────────┐     │
│ │                   │ Field properties:             │     │
│ │   Page image      │  label / x y w h / font /     │     │
│ │   with draggable  │  align / source binding /     │     │
│ │   boxes + sig box │  question link / group info   │     │
│ │   (D2..DN badges) ├──────────────────────────────┤     │
│ │                   │ Multi-select: N boxes         │     │
│ │                   │  [🔗 Group as daily entry]    │     │
│ │                   │  [✂️ Ungroup]                 │     │
│ │                   ├──────────────────────────────┤     │
│ │                   │ Wizard builder:               │     │
│ │                   │  questions list, add/move/    │     │
│ │                   │  delete, same-as-last + mand. │     │
│ └───────────────────┴──────────────────────────────┘     │
│ [💾 Save sheet]  [🗑 Delete sheet]                        │
├──────────────────────────────────────────────────────────┤
│ [Close Tool]                                              │ ← sticky footer
└──────────────────────────────────────────────────────────┘
```

- **Header:** tool name + the two tabs (segmented buttons) on the left; Active Lot selector on the right (lot-focused tool). The lot selector is disabled/hidden in Configure Sheets (configuration is lot-independent).
- **Filing Cabinet tab:** the lot's paperwork as a collapsible tree — seven sections (Propagation, Room Cleans pre-move-in, Room Cleans post-usage, Grow Logs, IPM Log, Harvest, Drying Logs, Trim Logs), one leaf per instance with its status and the two actions inline. The toolbar above the tree holds **📋 Initialize paperwork** (shown when the lot has constant fields; ⚠️ while any value is unset — see "Constant / Header Fields"). Pre-move-in room cleans are read-only reference nodes tagged with their source lot; an expected document that is absent shows as a ⚠️ leaf. Print is available at all times once an entry exists and the page set is loaded (tooltip explains what's still missing: days remaining / signature / strike initials / unset constants); it is disabled only when there is no entry yet or the matching document isn't loaded this session.
- **Configure Sheets tab:** top = page image preview canvas (boxes are click-drag to create; drag a box body to move — plain drag moves a grouped box's whole day-column as one block, **Ctrl/⌘**-drag moves just that day's row, **Alt/⌥**-drag moves just that one box; the ↕ / ↔ arrow handles slide along one axis only (same modifiers apply); corner & edge handles resize; Shift-click or Shift-drag marquee for multi-select; the signature box is a distinct style). Below the canvas: the **Sheet** and **Field properties** cards sit side by side, with the **Wizard builder** spanning the full width beneath them. Save writes `_PaperWizard.sheets[baseName]` and the wizard, then `notifySitkaTools()`.
- **Wizard runner (Filing Cabinet):** a centered card stepping through questions one at a time (Next/Back), with the "⏪ Same as last time" button in the card header when any visible question has `sameAsLast`. A **mandatory** question hides Next/Save (and blocks Enter) until it is answered — Back stays available. Pressing **Enter** in a text/number/select answer advances to the next question (or saves on the last one), subject to the same mandatory gate; on an initials step, Enter on the name field does the same once strokes are drawn. There is no signature step — the master grower's signature is captured only via the cabinet leaf's ✍️ Sign button.

## Resolved Design Decisions

Decisions made during design (2026-09-24, updated 2026-09-26) — already folded into the sections above; kept here as a record:

1. **Page image rendering:** plain `<img>` per page, CSS aspect-ratio from each image's pixel dimensions (offline-first). No PDF library, no CDN — the suite's offline `file://` constraint and single-file simplicity win; the one-time cost is exporting each form's pages to WebP locally (best compression for black-and-white text documents).
2. **Plant count & parent lot #:** both already exist on the SitkaTools lot record (`plantCount`, `parentLotId`) and are auto-fill bindings. The grow-log captures every subsequent plant-count change day by day, so only the *starting* count lives in the main DB. **Pending SitkaTools change (not PaperWizard):** make the parent-lot field accept manual free-text entry (in addition to picking an existing lot) so a lot can be created from a parent that isn't in the system.
3. **Grow-log window:** rolling 7 days from the first daily entry — not fixed Mon–Sun weeks.
4. **Phase & room change:** an old log that ends early (phase *or* room change, or all plants removed) gets a diagonal strike-out across its remaining rows — initials above the line, change date below (see "Strike-out policy", decision 12). The day's full entry is saved *before* the strike-out; a new instance starts on the **same day** as the move for the double entry (old log stamped with the previous value, fresh page filled in under the new value); headers carry their own phase + room snapshots. See "Phase & Room Change".
5. **Room cleans (updated 2026-10):** one controlled form **per room role** — Clone · Veg · Grow · Dry · Trim — each assigned via the Document dropdown (`room-clean-clone` … `room-clean-trim`). The cabinet shows two parallel trees over the same five rooms: pre-move-in (read-only references to the previous occupant's clean) and post-usage (this lot's own fillable forms). A legacy single generic `room-clean` page set still works via name-keyword inference.
6. **IPM & harvest logs:** event-driven, printed on demand — no fixed weekly completion rule.
7. **Write-back permission (unique to PaperWizard):** the daily logs can update the main DB — `lot.plantCount` when a day's entry records a different count, `lot.stage` when the Phase question records a new phase, and `lot.currentRoom` when the Room question records a new room (both of which also trigger the rollover). `lot.plantCount` is a live current count: starting value at lot creation, then maintained by PaperWizard; per-day entries keep the full history. No other tool may write another tool's data.
15. **Room tracking (2026-10):** daily-weekly instances carry a `room` snapshot alongside `phase`; a room change rolls the log over with the same strike-out machinery as a phase change, and move-in dates for the pre-move-in clean tree are derived from the logs' 🏠 Room answers when available (phase fallback otherwise). Drying Logs and Trim Logs are first-class daily-weekly sections after Harvest.
16. **Authority roadmap (long-term, not yet implemented):** PaperWizard's grow logs are becoming the authoritative source of truth for lot lifecycle events — sub-lot creation, plant destruction, and room/phase changes will all be recorded in the logs and written back; the SitkaTools lot manager will eventually handle only external lots. The `currentRoom` write-back is the first step of this roadmap.
8. **Filing cabinet is the first page (2026-09-26):** the former Fill Sheets tab becomes the Filing Cabinet — a per-lot tree view of all paperwork (propagation, pre-move-in room cleans, 10–14 weekly grow-logs, IPM entries, harvest). It is a pure view over `entries` + the lot record; nothing extra is stored.
9. **Room cleans sourced from the previous occupant (2026-09-26):** a pre-move-in clean lives in the *previous* lot's entries and appears in the incoming lot's cabinet as a read-only reference, matched at view time by room name + date-on-or-before-move-in. No link fields stored on either side.
10. **Bindings snapshot at save time (2026-09-26):** render-time binding resolution is retired — paperwork is saved as the plant transitions phases, so a sheet must keep printing what was true when it was saved. Instances store `snapshots` of every binding they use, captured at creation and refreshed on each entry save; print always shows stored values (live resolution only as a fallback for legacy instances).
11. **Empty prints as N/A (2026-09-26; refined 2026-10):** any unanswered field or null binding prints `N/A` — controlled documents are never blank. Exception: day-row fields on a day that was never saved print **blank** (not `N/A`), so a struck-out log's remaining days stay clean under the strike line; saved days (even with intentionally blank fields) still print `N/A` for empty boxes.
12. **Strike-out policy (2026-09-26):** an early-ended grow-log gets a diagonal across the remaining day rows with initials *above* the line and the date *below*; the overlay is computed from `phaseChangeDate` + `strikeInitials` + row geometry, never stored.
13. **Question controls (2026-09-26):** v1 question types are exactly string input, number input, and simple multiple choice — enough for every sheet in the initial set; the fill engine is fully data-driven from wizard configuration.
14. **Field-side-only question binding (2026-10-04):** a wizard question is bound to a field solely via `field.questionId`, assigned in the Field properties panel ("Filled by question"). The former question-side `targetFieldId` and the wizard builder's "Fills field" dropdown are retired — the builder shows each question's binding as a read-only indicator derived from the fields. For daily-entry columns the binding is **per-column**: anchored on day 1, repeated to every day of that column, editable from any member with whole-column propagation (same group + same x — sibling columns in the same group keep their own bindings). Deleting a question clears its id from *every* bound field; deleting/ungrouping boxes takes their bindings with them (day-1 survivors keep theirs).
17. **Constant / header fields (2026-10):** values that are fixed for a whole lot's paper chain (e.g. substrate lot on the grow-log) are set once via the cabinet's 📋 Initialize paperwork quiz and stored at **lot+sheet level** (`entries[lotId][sheetId].constants`), not per instance — so they persist across every weekly page and survive phase/room rollovers. Constant questions are excluded from the daily runner; print reads the lot-level value (constant is the first branch in `printFieldValue`, so a constant box inside a day group prints the same value on every day). **Daily-weekly sheets only** — one-shot/event sheets have no chain to share across, so the flag is not offered for them.
18. **Signature date (2026-10):** saving the master grower's signature via the cabinet leaf's ✍️ Sign button stamps `inst.signature.date` (local YYYY-MM-DD); re-signing updates it, clearing removes it. The new `signature.date` auto-fill binding prints it as **yyyy/mm/dd**, resolved live from `inst.signature` at print time and never snapshotted (like `day.date`) — a bound box prints N/A until the log is signed.
