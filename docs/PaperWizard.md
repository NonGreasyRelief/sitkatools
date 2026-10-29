# PaperWizard — Tool Context

PaperWizard fills the facility's **controlled paper forms** (propagation worksheet, weekly grow-logs, room cleans, IPM, harvest, drying and trim logs). Click-through wizards capture the answers. The print popup overlays them on the form's WebP page images, and the user prints from the browser. Suite rules (one file, opened over SitkaTools, UI standards) are in the root `CLAUDE.md`.

Two tabs:

1. **Filing Cabinet** (default) — the active lot's paperwork tree (see "Filing Cabinet").
2. **Configure Sheets** — load a form's page images, place boxes over them, bind boxes to DB values or questions, and build the sheet's wizard. The toolbar lists saved sheets (pick one to edit, 🗑 deletes, 📤 / 📥 export / import a sheet's configuration). An import is checked first (`cleanSheetImport`, review D13): plain ids, positions and sizes in range, known alignments, cadences and question types; anything else is refused with the reason. For a saved sheet, a **Document** dropdown files it in the cabinet. **💾 Save sheet** and **🗑 Delete sheet** are in the footer (user request 2026-10-28: they were under the sheet editor), either side of Close Tool, shown on Configure Sheets and off until a document is loaded.

- **Nothing is hard-coded.** No sheet ships in code. Layouts, bindings and wizards are all data under `_PaperWizard`. A new form = export its pages as WebP, load them, place boxes, build the wizard.
- **Not in scope:** creating or changing `calendarEvents`; printing directly (always the user in the popup's print dialog).
- **Use:** floor staff fill today's entry from the cabinet (⏪ Same as last time pre-fills most answers); a manager prints at any time; a manager configures each form once.

### The Golden Rule — Never Store the Page Images

- Page images are **never stored** — not in the DB, not in browser storage. The DB holds only the page-image base name (= the sheet id) and the normalized box geometry.
- Images load just in time through **Load document** (a multi-file `<input type="file" accept=".webp,image/webp" multiple>`, in both tabs): in Configure Sheets before any box can be placed, and at print time.
- **Naming:** `<base>-pN.webp`, numbered from 1 with no gaps; the base name is the sheet id. `parsePageFiles` rejects, with an error naming the file: non-WebP files, mixed base names, missing or duplicate page numbers. A mismatch means the wrong form revision.
- In Configure, loading a new base name starts a new sheet; one matching a saved sheet opens it (confirm if it already has fields).
- Files are held in memory only, as blob URLs. They are revoked when the tool closes, a new document loads, or the popup closes.
- A sheet with no page set loaded this session shows "⚠️ needs document" in the cabinet, and its Print is disabled.

## Core Concepts

### Sheet (layout)

| Field | Notes |
|---|---|
| `name` | Label in the cabinet. |
| `orientation` | `'portrait' \| 'landscape'`, from the first page image (width > height → landscape). |
| `pageWidthIn` / `pageHeightIn` | Always US Letter (8.5 × 11, rotated for landscape), set automatically. Used for print size and pt font scaling. |
| `pageCount` | Pages loaded at configure time. |
| `cadence` | `'one-shot' \| 'daily-weekly' \| 'event'` (see "Entry & Instance"). |
| `document` | Cabinet assignment from the **Document** dropdown: `grow-log`, `propagation`, `harvest`, `ipm`, `drying-log`, `trim-log`, `room-clean-clone` / `-veg` / `-grow` / `-dry` / `-trim`, or null; or, under "Not tied to a lot", `facility` / `building` (see "Facility & Building Paperwork"). The five clean values file under Room Cleans (`sheetSection()` maps them to `room-clean`). Saved on change, not on 💾 Save. Null = filed by the heuristics in `sheetSection()` (cadence, then name keywords). A legacy `'room-clean'` value still files under Room Cleans, with its room role inferred from name keywords. |
| `fields[]` | Boxes (below). |
| `signature` | Signature box or null (see "Signature Box & Capture"). |

### Field (text box)

| Field | Notes |
|---|---|
| `id` | 4 chars from the suite `CODE_ALPHABET`; unique in the sheet, immutable. |
| `label` | Editor label and tooltip; never printed. |
| `x`, `y`, `w`, `h` | Top-left and size as 0–1 fractions of page width / height. |
| `fontSize` | pt at 100 % print scale. |
| `align` | `'left' \| 'center' \| 'right'`. |
| `source` | Auto-fill binding (see "Auto-Fill Bindings"), or null when a question fills it. |
| `questionId` | When `source` is null, the question that fills the box — **the only binding point** (questions carry no target). Set in Field properties → "Filled by question". A group member gets that day's / that entry's answer. |
| `dayGroup` / `day` | Group id (4 chars) and row number (1 = the placed first row). Null for header / one-shot / event fields. |
| `repeat` | Repeating-row member (event / one-shot sheets): `dayGroup` is the row group, `day` the row. See "Repeating Rows". |
| `constant` | Constant field (daily-weekly only). See "Constant / Header Fields". |

- A box is an **initials box** when its question has type `initials` (✍️ badge, derived — there is no flag).
- Bindings, checkbox settings and size are **per column** in day rows and repeating rows (`cfgColumnOf`, see "Repeating Rows" → Column edits). A binding is anchored on row 1 and can be edited from any member.
- Deleting a question clears its id from every field bound to it. Deleting or ungrouping boxes takes their bindings with them; surviving day-1 boxes keep theirs.

**Day rows (daily-entry groups):** a weekly sheet has one row per day, with no grid or pitch math — every day's boxes are real, placed fields.

1. Place the **day-1** boxes over the first day row. Several can stack in one cell (the grow-log's "Daily crop monitoring" holds four checkboxes).
2. Multi-select them (Shift-click, or Shift-drag a marquee).
3. **🔗 Group as daily entry** (Field properties) asks how many days (default 7) and copies the selection to days 2..N, offset by the pitch measured between day 1 and day 2 (or the tallest box's height). Badges `D2`…`DN`.
4. Dragging any member moves the whole group; **Ctrl/⌘** moves that day's row; **Alt/⌥** moves one box. **✂️ Ungroup** removes days 2..N and clears `dayGroup` on day 1.

Each member prints on its own day at its own placed position. Header boxes are ungrouped. *Legacy:* fields with `row: true` + `rowGrid` still print by the old clone-down; nothing migrates automatically — group their day-1 boxes to switch.

### Initials Question Type (drawn sign-off)

- A question of `type: 'initials'` shows a draw pad (the shared draw pad, sized to the bound box's aspect ratio) and a typed-initials input. Strokes are normalized `[x, y]` point arrays — no image.
- **Configure:** bind a box to an initials question. For a per-day sign-off, put the box in the day-1 row, group it, and make the question row-scoped.
- **Typed initials are required:** drawn initials without typed initials hold Next / Save, mandatory or not ("✍️ Type your initials to continue"). Same on a repeating entry, in the Initialize quiz and on the strike-out pad. Initials left as they were saved need nothing new (older entries may have no name).
- **Storage:** the normal answer slot — `days[YYYY-MM-DD][questionId]` (row-scoped) or `header[questionId]` — as `{ name, strokes } | null`. An empty pad on save stores `null`.
- Re-opening a day that isn't complete repaints its strokes so they can be redrawn. Once the day is on file the initials are locked; a correction is initialled on the correction pad (see "Corrections & Change Log").
- **Print:** an SVG polyline in the box (a group member prints its own day's strokes); empty without strokes.
- **Completion:** answered only once strokes exist (`hasAnswer`) — never waived (see "Completion Rules").
- ⏪ Same as last time never copies drawn initials.
- **Who signs what:** floor staff initial their own day with initials questions. The master grower's **signature** is a separate whole-log sign-off (see "Signature Box & Capture").

### Constant / Header Fields (set once per lot)

A box whose value is fixed for a lot's whole paper chain and has no DB source (e.g. the substrate lot on a grow-log).

- **Configure:** **📌 Constant field** in Field properties, daily-weekly sheets only (one-shot / event sheets have no chain). Gold 📌 badge; the wizard builder notes "constant — set via Initialize paperwork". Exclusive with `source` both ways (setting one clears the other). Must be question-bound to do anything.
- **📋 Initialize paperwork** (cabinet toolbar, between Load document and the print chip; shown when the lot has a daily-weekly sheet with constant fields) runs a quiz in the runner card: one step per constant question across all the lot's daily-weekly sheets, grouped by sheet ("Constant N of M"), with no day chips and no instance. Initials constants use the pad. Always re-runnable; it pre-fills the current values. An initials constant on file is shown locked, not redrawn (review D12); one save at a time (review D8). While any value is unset the button shows ⚠️ and its tooltip counts them; once all are set it reads "re-run to change them". With no constant fields it hints to flag a box in Configure Sheets.
- **Storage:** `entries[lotId][sheetId].constants` (`questionId → value`, sibling of `instances`), shared by every instance in the chain and kept through rollovers. Text is trimmed; initials are `{ name, strokes } | null`. Created on first save, even before any instance exists.
- **Not in the daily runner:** constants are left out of the runner, ⏪ Same as last time, progress and completion. If every question on a sheet is constant, opening its leaf toasts to use Initialize.
- **Print:** the constant check is the **first** branch in `printFieldValue` (before source and day group), so a constant box inside a day group prints the lot value on every day. Unset prints `N/A`; the Print tooltip lists "N constant value(s) unset" (printing still allowed).

### Write-Back Question Types (plant count, phase, room)

The write-back is a property of the **type** — no per-question setting (saving a wizard drops any stale `writesTo` from old data). Changing the type changes or removes it. All three work row-scoped or instance-level, and none can be repeating.

- **🌱 Plant count (`plant-count`):** number input; on a daily log it writes `lot.plantCount` (see "Write-Back to the Main DB"). On any other sheet (propagation, harvest) the count is only recorded: a lot's count changes only through its daily logs, with reasons (review D3). A count that **drops to 0** also strikes out the open log on that day (drawn initials, no fresh page). Only a drop triggers it; re-saving a closed log at 0 does not.
- **🔄 Phase (`phase`):** a select over a fixed vocabulary (the form's words for the DB stages, `STAGE_TO_FORM`); no custom options. Grow logs offer `Cloning / Mother / Vegetation / Bloom / Harvesting`; the harvest log and drying / trim logs offer `Harvesting / Drying / Curing` (`phaseOptionsFor`). Compared with the lot's **live** stage (`currentLotPhase`), never with saved answers.
  - Different → writes `lot.stage` and, after the day's whole entry is saved, strikes out the log and starts a fresh page on the entry's own day (see "Phase & Room Change").
  - Equal → just records the day. This is how the fresh log's first day carries the new phase without another rollover.
- **🏠 Room (`room`):** a select over every room name in the DB, sorted. With split files (a building device, or the office) it lists the lot's building's rooms, then, on a daily log or the harvest log, every other building's rooms under "🚚 Move to <building>" (`roomChoiceGroups`): picking one moves the lot to that building (see "Relationship to SitkaTools"). Same rules against the live `currentRoom` (`currentLotRoom`); writes `lot.currentRoom`.
- **On the harvest log** (the sheet filed as Harvest): its pages are filled at harvest, after trimming and at close-out, so it records the phase and room once the grow log has ended. The **last** phase and room questions answered (in wizard order) are where the lot is now; an answer this save changed (from what the page had saved) and different from the live value writes `lot.stage` / `lot.currentRoom`, with no strike-out (it has no day rows). Re-saving the page (to add dry weights) leaves the lot where it is now (review D2). Other event and one-shot sheets never write the phase or room back (a room-clean's room question doesn't move the lot).

### 🌱 Why the Plant Count Changed

The grow log is the record of every plant (user decision 2026-10-22). Before a daily-weekly day is saved (`askCountReasons`), its row-scoped plant count is compared with the last recorded count (`lastRecordedPlantCount`; on the first day of the lot's first log, the lot's count):

- **Lower:** a dialog asks how many left for each reason — Destroyed, Culled, Sampled, Harvested, Moved to another lot, Sold / transferred to another company (`REMOVAL_REASONS`). The counts must add up to the drop; tapping a reason gives it the rest.
  - **Who they went to** (`REMOVAL_TO`, user decision 2026-10-22): once plants are sold, "Sold / transferred to — which company?" is required. Once plants are sampled, "Samples sent to (testing lab, optional)" appears. Names used before are offered as taps (newest first). For the Labour & Cost Wizard's monthly CTLS numbers.
- **Higher:** a dialog asks why (chips: "recounted — the last count was wrong", "moved in from another lot", or typed).
- **Cancel** saves nothing ("Nothing was saved — the change in plant count needs a reason"). A day that already holds a matching reason isn't asked again, unless a sale on it names no company yet. A count back where it was drops the old reason.
- **The dialog keeps the keyboard:** it opens over the runner with a light dim (`.wiz-overlay.nested`), takes the focus, and Enter = save the reasons, Escape = Cancel, without reaching the runner behind it. Only one save runs at a time (`saveRunnerEntry` ignores a second call while one waits on a dialog): Enter pressed again on the last answer used to start a second save and stack a second dialog with dead buttons over a dark screen.
- **Kept** on the day as `days[day]._removed = { reason: n }`, `._removedTo = { sold: 'Company', sampled: 'Lab' }` / `._added = { n, reason }` (not questions: completion, corrections and print ignore them). SitkaTools counts `moved` for split lots (`SitkaTools/CLAUDE.md` → "Lot Manager").
- **Printed** through the day's comments answer: "[Removed 3: 2 culled, 1 sold / transferred to another company (Acme Inc.)]" / "[Added 2: …]" is added to it (replacing an earlier note of ours), so on an on-file day it is a correction like any other. The comments question is the one picked on the plant-count question in Configure Sheets (**Reasons for a changed count go in**, `q.reasonsTo`: Automatic, a row-scoped text question, or Nowhere); Automatic is a row-scoped text question named like comments / rationale / remarks / notes.

### Auto-Fill Bindings

| Binding | Resolves to |
|---|---|
| `lot.name` | Lot # |
| `lot.strain` | Strain |
| `lot.stage` | Phase, in the form's words |
| `lot.plantCount` | The lot's live plant count |
| `lot.parentLotId` | Parent lot # for sub-lots (null for new lots) |
| `lot.createdDate` | Creation date |
| `lot.destRoom` / `lot.vegRoom` / `lot.cloningRoom` / `lot.dryRoom` / `lot.trimRoom` | Room names on the lot (dry and trim may be the same room; each has its own clean form) |
| `lot.currentRoom` | The room this log was kept in: the instance's own `room`, else the live lot (print time, never snapshotted) |
| `lot.roomDesignation` / `lot.roomBuilding` | The designation / building id of that same room (print time, never snapshotted) |
| `lot.lotNumber` | The lot number only (strain prefix stripped) |
| `year.current` | Last digit of the year, at save time |
| `instance.phase` | The instance's phase snapshot |
| `sheet.periodStart` / `sheet.periodEnd` | The instance's window dates |
| `day.date` | The day row's date, `MM/DD` (group members only) |
| `day.plantsRemoved` | Yesterday's count − today's, at least 0 (group members only; needs a row-scoped plant-count question). Today must be an explicit answer on that day (a walk-back would understate removals); yesterday walks back through this instance, then earlier instances at a chain start. `N/A` when either is missing. |
| `entry.number` | Entry number on a repeating row, counting on across copies (21, 22 … on a 20-row page's second copy) |
| `page.number` / `page.count` | This page's number and the printout's page total, extra copies included ("Page _ of _") |
| `signature.date` | Date signed, `yyyy/mm/dd`; `N/A` until signed |

- **Snapshot once:** each binding the sheet uses goes into `inst.snapshots` the first time it's known (creating the instance, or its first save); later saves fill only what's still missing, never re-reading today's lot into an older page (review D1). `lot.stage` and `instance.phase` follow the page's own phase. Print uses the snapshot, never live values — paperwork is a historical record (a Veg log keeps printing "Veg" after the lot moves to Bloom).
- **Never snapshotted (print time):** `day.date`, `day.plantsRemoved`, `signature.date`, `entry.number`, `page.number`, `page.count`, and the room bindings (`lot.currentRoom`, `lot.roomDesignation`, `lot.roomBuilding`), which print the log's own `inst.room` so a struck-out page keeps its old room.
- An instance without `snapshots` falls back to live resolution.
- So a one-shot sheet can bind a live value and keep printing it as captured (the propagation worksheet's starting count via `lot.plantCount`). Use `prefillFrom` for values that need a person to confirm them.
- **Pending SitkaTools change (not PaperWizard):** the parent-lot picker should also accept free text, for a parent that isn't in the system.

### Signature Box & Capture

- `signature` = normalized `x / y / w / h` + optional label.
- Captured **only** by the cabinet leaf's orange **✍️ Sign** button: a modal with a pad sized to the box and a name input. The master grower signs at end-of-crop review. The runner has no signature step, and saving a day never touches the signature.
- Strokes are normalized 0–1 within the box and print as an SVG polyline scaled to it. The typed name prints only if a box is bound to it.
- Saving stamps `inst.signature.date` (local `YYYY-MM-DD`, feeds `signature.date`) and `at` (ISO, for "changed after signing"). Re-signing updates them; clearing the pad removes them. Saving without redrawing or renaming changes nothing.
- Re-signing replaces the strokes and adds a `kind: 'signature'` change (old signer and date → new, or "cleared").
- An unsigned instance still prints (empty box; tooltip "signature missing"). A legacy signature without `date` prints `N/A` in `signature.date` boxes until re-signed.
- **Shared draw pad:** the signature, initials questions and strike-out initials use one pointer-captured pad, one stroke format and one SVG-polyline print path. When the pen lifts, the stroke's points are rounded to 3 decimals and the ones that don't change its shape are dropped (`slimStroke`, review H2), so drawn initials take a fraction of the space and print the same.

### Wizard

The ordered questions that fill a sheet's non-auto-filled boxes: `{ id (4 chars), sheetId, name, questions[] }`. Normally one per sheet (the schema allows several). The fill engine is data-driven — no per-sheet code.

| Question field | Notes |
|---|---|
| `id` | 4 chars, unique in the wizard. |
| `label` | The question shown. |
| `type` | `'text' \| 'number' \| 'select' \| 'initials' \| 'plant-count' \| 'phase' \| 'room'`. New types need no migration. A `number` answer takes digits and one decimal point only, and a `plant-count` digits only (`wireNumberCtl`: letters, spaces and a second point are dropped as typed or pasted; a trailing point goes and ".5" reads "0.5" on leaving the box or pressing Enter). |
| `options[]` | For `select`; ignored for `phase`. |
| `rowScoped` | `true` = one answer per day row; `false` = one per instance. |
| `repeating` | Event / one-shot sheets; text / number / select / initials only. One answer per repeating entry, stored in `inst.rows`. Ignored on daily-weekly sheets. See "Repeating Rows". |
| `sameAsLast` | Offer ⏪ Same as last time. |
| `mandatory` | While unanswered: Next / Save hidden (Back stays), Enter doesn't advance, a toast names it. Runner and Initialize quiz. |
| `prefillFrom` | Binding that pre-fills the input on open; the user can edit, and the stored answer is what prints. |
| `metric` | Report tag (text / number / select) for the Labour & Cost Wizard's Reports, e.g. `harvest.wetWeight`, `env.temp`, `ipm.pests`. Set from **Report metric**; cleared on a type change. PaperWizard never reads it. `REPORT_METRIC_GROUPS` must match EmployeeWizard's `REPORT_METRICS` (`docs/REPORTS.md`). Plant-count questions feed reports untagged. |
| `metricUnit` | `'g' \| 'kg' \| 'lb' \| 'F' \| 'C'` for weight / temperature metrics (**Answered in**); reports convert to g / °F. |
| `metricProduct` | `feed.nutrient` only: `{ name }` (always this product) or `{ from: questionId }` (that day's answer to another question; a "No" answer leaves it unlinked). The **Product** row shows only for `feed.nutrient`; changing metric or type clears it. The name must match CropLabourWizard's price list. |

A question's box binding is derived from the fields; one no field references is notes-only (stored, printed nowhere). Its write-back is derived from its type.

**⏪ Same as last time** pre-fills and never saves. Row-scoped: the previous day; instance-level: the previous instance; at the start of a new page it reaches back into the previous page. Disabled when there's nothing to copy. It never copies phase / room questions (copying the old log's move-day value could re-trigger a rollover) or drawn initials.

**Runner:** a card stepping through the questions (Next / Back), day chips to jump between days, ⏪ in the card header when a visible question has `sameAsLast`. Enter advances (saves on the last), subject to `mandatory`; on an initials step, Enter in the name field does the same once strokes are drawn. Constant questions are left out, and there is no signature step. **Save** stores per day / per instance.

**Only the ✕ closes the runner** (`requestCloseRunner`, user decision 2026-10-22). A click beside the card just says "Use the ✕ to close the wizard", and Escape doesn't close it. The ✕ asks first ("Close this wizard without saving? Everything you entered in it will be lost.") when anything would be lost (`runnerDirty`): answers changed since it opened (prefills, and prefills that follow a live update, don't count), or repeating entries added, changed, deleted or still in a form. Switching day chips with unsaved answers asks the same way ("Switch to … without saving?").

### Entry & Instance (filled data)

Path: `entries[lotId][sheetId].instances[key]`.

- **`one-shot`:** one instance per lot, anchored to lot creation.
- **`daily-weekly`:** one per rolling 7-day window — not calendar weeks. `periodStart` = the first entry saved for it (the key), `periodEnd` = +6 days. Saving with no open instance starts one; an entry 7+ days after `periodStart`, or after a phase / room change, starts the next.
- **`event`:** one per event; key = the event date.

| Instance field | Notes |
|---|---|
| `phase` / `room` | Daily-weekly: snapshots of `lot.stage` / `lot.currentRoom` at creation. A closed log keeps them. |
| `header` | Instance-level answers (`questionId → value`). |
| `days` | `YYYY-MM-DD → { questionId → value }`. Saving a day stores every row-scoped question, blank ones as `''`; a key being present is what counts as confirmed for completion (see "Completion Rules"). A day whose count changed also holds `_removed` / `_added` (see "🌱 Why the Plant Count Changed"). |
| `rows` | Repeating entries `[{ id, <questionId>: value, …, void? }]` — see "Repeating Rows". |
| `phaseChangeDate` | Day the log ended early (phase or room change, or plants to 0). Later rows strike through and need no entries. |
| `strikeInitials` | `{ name, strokes } \| null`. Needed for completion; without it the strike line doesn't print. *Legacy:* a plain string prints as centred text in the initials box. |
| `snapshots` | `binding → value` (see "Auto-Fill Bindings"). |
| `signature` | `{ name, strokes, date?, at? } \| null`. |
| `changes` | The page's change log (see "Corrections & Change Log"). |
| `completedAt` | Set when the completion rule is met. |
| `printedAt` | Set after a print render; informational. |

Next to `instances`, a daily-weekly entry may hold `constants` (see "Constant / Header Fields"), `constantChanges` (see "Corrections & Change Log") and `paperBefore` (see "Starting a Log Mid-Crop").

### Filing Cabinet (lot paperwork tree)

A pure view over `entries`, the lot record and the sheets — it stores nothing. One per lot, switched by the header's lot selector. A lot that is no longer in `DB.lots` keeps its entries and still gets a cabinet, so its paper history stays printable. Only Grow Logs is open by default.

Sections, in this order (`CAB_SECTIONS`), plus **Other** when unclassified sheets exist:

- **Grow Logs** — one node per daily-weekly instance, oldest first, labelled with its window and phase.
  - **Coverage:** when `_tool_CropLabourWizard.plantingDate` is on file, every day from planting (or `paperBefore`, if later) through today must be inside some window. Uncovered runs show as dashed **🌱 Backfill** leaves ("⚠️ 7 days no log", counted as missing); tapping one starts a 7-day window on the run's first day.
  - Without `plantingDate`: a banner ("run it through the CropLabourWizard first") and no coverage check. "📅 Start new week" still appears when today is outside every window.
- **Propagation** — the lot's one-shot worksheet.
- **Room Cleans (pre-move-in)** — always lists Clone · Veg · Grow · Dry · Trim, mapped to `cloningRoom` / `vegRoom` / `destRoom` / `dryRoom` / `trimRoom`. An assigned room shows a read-only reference to the newest qualifying clean (from the previous occupant's entries, tagged "from LOT-000"); an unassigned room shows "— not assigned"; a room with no qualifying clean shows ⚠️ (informational, blocks nothing). A room designated **Mother** shows "— not needed (Mother room)": new mothers move in without a room clean (user decision 2026-10-23).
- **Room Cleans (post-usage)** — this lot's own clean forms, one per room role, using the sheet assigned to that role (`room-clean-clone` … `room-clean-trim`); "⚠️ no form configured" otherwise. Event instances keyed by clean date, plus "📅 New clean · {room}" when today has none. These are what the next occupant references. Legacy clean sheets whose role can't be inferred file here as catch-all leaves.
- **IPM Log** — one node per IPM event.
- **Harvest** — the harvest log instance(s).
- **Drying Logs / Trim Logs** — daily-weekly sections (`drying-log` / `trim-log`) with the same rolling windows and "📅 Start new week" as Grow Logs, but no planting-date coverage.
- Every event sheet outside the room cleans (IPM / Harvest / Other) gets a "📅 New entry · {sheet}" leaf when today has no instance; its Fill starts today's. Not shown on a lot that is read-only on this device.

**Pre-move-in clean sourcing:** a clean is an `event` instance under the lot that did it, with the room name in its header and the clean date as key. The cabinet scans every lot's clean instances for the room name and takes the newest one on or before this lot's move-in to that room. Move-in date:

1. from the logs: the first day any daily-weekly log's 🏠 Room answer equals that room (`firstRoomEntryDate`);
2. else by phase: clone = `lot.createdDate`, veg = `periodStart` of the first Veg instance, grow = of the first Bloom instance;
3. else today.

It is matched at view time — no link is stored on either side. Reference nodes print but can't be filled.

Tapping a leaf opens its wizard, or its print popup once complete. **Leaf status:** `✓ complete`, progress (`4/7 days`, `3/5 · phase change Sep 24`), `⏳ due`, `⚠️ missing`, or `— not started`; section headers total them. **🖨️ Print** works once an entry exists and the page set is loaded, complete or not; its tooltip lists what's missing (days, signature, strike initials, unset constants, entries).

### Facility & Building Paperwork

Paperwork that belongs to no lot (user decision 2026-10-25): **facility forms** for the whole company (destruction logs, inventory logs) and **building forms** for one building (its sanitation form).

- **Configure Sheets → Document**, under "Not tied to a lot": **🏭 Facility form (whole company)** (`document: 'facility'`) or **🏢 Building form (one building)** (`'building'`). Such a sheet is never in a lot's cabinet. It can't ask plant count, phase or room (`LOT_ONLY_TYPES`): the wizard builder doesn't offer them, and the Document change is refused while the wizard has one.
- **Active Lot dropdown:** "↓ Facility & buildings" first, with **🏭 Facility paperwork** (`@facility`) and **🏢 <Building> paperwork** (`@building:<BID>`) for each building (a building device: only its own), then the lots as before.
- **Cabinet ids:** inside PaperWizard a cabinet is a lot id, `@building:<BID>` or `@facility`. `pageStore(id, create)` returns its `{ sheetId: entry }` store (`entries[lot]`, `buildingEntries[BID]`, or `facilityEntries` itself), and every read and write goes through it. The new keys are made only on the first save into them; a cancelled save leaves no empty store (`pruneStore`).
- **One record for the whole company:** a facility page (keyed by date, or `single`) is shared: every building and the office add to the same page. A page records where it was started (`inst.by`: `office` or the building id), and each new entry in a facility table when and where it was added (`row.at`, `row.by`), so entries from several buildings merge in order.
- **The cabinet** (`renderScopedCabinet`): one section per form, open by default. Event forms list their pages plus **📅 New entry** when there's no page for today yet; one-shot forms their one page; daily-weekly forms rolling 7-day pages plus **📅 Start new week** (no planting-date coverage, rollover or "Start on a chosen day"). Toolbar: Load document, 📝 Change log, the print-document chip; no 📋 Initialize (constant fields aren't used on these forms yet).
- **Who fills:** a building device fills its own building's forms, and **adds** to the facility forms (`appendOnlyHere`, `ctx.appendOnly`): it can start a page, add entries, fill answers and days still blank and add a first signature, but what's on file is locked (the answer's box is disabled, "🔒 On file — buildings add to facility forms; the office changes what's on file"; entries on file show "🔒 on file" with no ✎ or 🗑; re-signing is refused). A save that would still change something on file saves nothing. Another building's forms are view and print only (`lotElsewhere`). The office fills and corrects anything.
- **Bindings:** `lot.*`, `instance.phase` and `day.plantsRemoved` print N/A on these forms. `building.name` prints the cabinet's building on a building form, where the page was started (`inst.by`, or "Office") on a facility form, and the lot's current building on a lot form.
- **Saving with split files:** building forms go in their building's file; facility forms live in Main.json, and what a building device adds waits in its file's queue until the office merges it in (root `CLAUDE.md` → "Facility queue").

### One Daily Log at a Time (the lot's current log)

A lot keeps one daily log at a time (user decision 2026-10-26): its grow log, then its drying log, then its trim log. The **current log** (`isCurrentLog`, review D9 / F4) is the daily sheet whose newest page started last; a page that would start after every other log's newest page (starting the drying log) is current too. The others are the lot's past record:

- only the current log's answers write the lot's phase, room and plant count, move it to another building, or roll its pages over;
- only the current log asks "Lot is now in … — close this log?";
- an older log's answers (a day corrected later) are just recorded, with corrections as usual, so a stray room or count on it can't move the lot or strike the log in use. Backfilled days on an older log don't change the lot either.

### Phase & Room Change (grow-log rollover)

A phase change (Clone → Veg → Bloom) or a room move (e.g. into the dry room) rolls the open daily-weekly log over. Both use one core, `dailyRollover`.

1. **Detection:**
   - **Changed in SitkaTools:** the lot's live `stage` / `currentRoom` no longer matches the newest instance's `phase` / `room` → prompt "Lot is now in Bloom — close this grow-log?". Confirming rolls over without writing anything back. Declining (or Cancel at the strike initials) opens the runner with the Phase question prefilled from the **live** phase, so a plain save is not a change. Older pages never prompt.
   - **Recorded in the wizard:** a Phase or Room answer that differs from the live value (see "Write-Back Question Types").
2. **Save first, then strike:** the day's whole entry (change question included) is saved; then the strike-initials pad opens. Confirming sets `phaseChangeDate` = **the entry's own day** (a backfilled entry strikes out and starts the new page on that past day), stores `strikeInitials` on the old instance, and creates the fresh instance. Cancel at the pad rolls the whole save back: nothing saved, no write-backs, the runner stays open with its draft.
   - The pad ("Strike-out initials — {newValue}") needs drawn **and** typed initials ("Draw your initials first", "Type your initials as well as drawing them").
3. **Double entry on the move day:** the fresh instance's `periodStart` is the move day and its header carries the new value. The old log's move-day row keeps the previous value (it was filled before the strike); the fresh page's move-day row is filled again under the new value — the save flow offers to run it. ⏪ copies the unchanged questions.
   - **Cross-snapshot:** the fresh instance also carries the value that didn't change (from the old instance, or `lot.stage` / `lot.currentRoom` when absent).
   - **Same-save double change:** one strike-out records both; the fresh log carries the new phase and the new room, both write-backs fire, and no second rollover runs (it would make a phantom zero-day log). The old move-day row keeps both previous values.
4. **Strike-out policy:** a diagonal across the remaining day rows, the confirmer's initials above the line and the change date below. Those rows need no entries.
5. **A page's only day, re-opened and changed** (its first day, nothing else on it yet): the page switches to the new value in place, with no strike-out. Only other days count as earlier content (`preExisting`); before 2026-10-22 such a change struck the page on its first day, put the day back to the old value and started the new page the next day.
6. **Taking a change back** (`undoTarget`): setting a page's first day back to the phase and room of the page before it — which was struck on that very day for the change — rejoins that page: its strike-out goes, the day (and any later days, re-paged) go back onto it, then onto fresh pages past its 7 days. The lot's phase / room follow. Signed pages are never rejoined.

**Strike-out computation** (derived, never stored): a pure function of `phaseChangeDate`, `strikeInitials` and the placed day-row boxes returns, **per page**:

- struck rows — every day row dated (key + `day` − 1) after `phaseChangeDate`;
- the diagonal — from the top-right of the first struck row to the bottom-left of the last, in normalized page coordinates;
- `initialsRect` (wide, short, centred just above the line's midpoint) for the initials, and the date position just below.

Every page with struck rows gets its own strike-out. Print and preview use the same computation.

### Starting a Log Mid-Crop (earlier paperwork on paper)

For a lot with **no daily log yet on any daily-weekly sheet** (a lot with one is locked to its logs; review D5), the section shows **📅 Start on a chosen day…**, with that sheet's phase list. The dialog asks for the first day (on or before today; it opens on the lot's creation date, or today when that is missing or still ahead), the starting **phase**, **plant count** and **room**:

- The lot's live `stage` / `currentRoom` / `plantCount` are set to those values, so the new page and the mismatch checks agree. The phase list also offers the lot's current stage, preselected, when it is outside the form's vocabulary (drying / curing); `stage` is written only when a different phase is picked.
- `entries[lotId][sheetId].paperBefore = <date>` marks earlier days as on paper: coverage starts at the later of the planting date and `paperBefore`.
- The first page starts on that date with the chosen phase / room; a row-scoped plant-count question gets the starting count on day 1, and the wizard opens on that day.

### Backfilled Changes (propagation)

Saving a day that is **followed by later entries or pages** (`isBackfillDay`) takes the backfill path (`applyBackfill`) instead of the normal write-backs. Changes are compared with what **that day** said before (or the page's phase / room), not with the lot's live values. Every confirmation — and the strike initials — is collected **before** anything beyond the day itself changes; Cancel restores the day exactly.

- **Plant count (row-scoped):** the difference (new − old) is applied to every later recorded count in **unsigned** logs, so later culls stay right (540→538 becomes 500→498). With "Cancel — save this day only", the next recorded day now counts from the new number, so its reasons are asked again (review D6). Later pages count from the edited date itself: after a phase / room change the move day is on both pages, so editing the old page's move-day row also corrects the new page's row for that date. "Cancel" saves the day only. Every unsigned later page's `lot.plantCount` snapshot moves by the same amount, even before it has rows.
- **Phase / room:** the log is struck out on that day (drawn initials, `phaseChangeDate` = the day, its row stamped with the old value) and the unsigned pages after it are **re-paged**: their days move onto fresh 7-day pages starting that day under the new value, and later answers still carrying the old value are updated. A later page that already holds the new value (a change recorded late) merges in. On a log's first day there's nothing to strike — the page switches to the new value in place.
- **Stops:** propagation never changes a log the master grower has **signed**, and re-paging stops at a page recording a different change. If the last rebuilt page would run into the page it stopped at, it is struck where it ends (on the linked change day, or the day before a signed log). A rebuilt page never starts on or after the page it stopped at: when the later change falls on a page boundary, the rebuilt page just ends the day before (it used to overwrite that page). The stopped page keeps what it recorded, the other tracked value included.
- **Live lot values:** a backfilled day never drags the lot backwards. `lot.plantCount` follows the newest recorded day in the chain; `lot.stage` / `lot.currentRoom` take the new value only when re-paging reached the end of the chain and the lot is still where that day said (a lot the harvest log moved on stays put; review D4).
- **Reprint:** the toast names pages that were already printed.
- Opening an older page (one with a later page after it) never shows the "Lot is now in … — close this log?" prompt; only the newest page is checked.
- **Prefill on a backfilled day:** a question blank on that day is prefilled from the page, not the live lot — plant count from the last count recorded before that day, phase / room from the page's `phase` / `room` — so just saving it is never read as a change. The newest day keeps the live prefill.

### Write-Back to the Main DB (PaperWizard's Special Permission)

PaperWizard is the only tool allowed to write another tool's data, and only three lot fields: `plantCount`, `stage`, `currentRoom` (root `CLAUDE.md` → "Shared Database", Ownership), and only from the lot's current log (see "One Daily Log at a Time") or the harvest log. Every write calls `notifySitkaTools()` and travels in the normal full-DB `sitkaGit_db_update`. Once a lot has a daily-weekly page, SitkaTools locks those three fields (root `CLAUDE.md` → "🔒 A lot with a grow log is locked to it"), so PaperWizard is where they change.

- **Plant count:** a saved value on the newest day of the chain that differs from `lot.plantCount` updates it (same value = no write). A backfilled day re-derives it from the newest recorded day (see "Backfilled Changes"). SitkaTools sets the starting count at lot creation; the per-day entries are the history.
- **Phase / room:** an answer different from the live `stage` / `currentRoom` triggers the rollover and writes the new value. When a phase rollover already ran in the same save, the room only writes back (no second strike-out).
- Starting a log mid-crop writes all three (see "Starting a Log Mid-Crop").
- A change made in SitkaTools is caught by the mismatch prompt and rolls over without writing back (see "Phase & Room Change").

### Repeating Rows (tables that run over several pages)

For forms like the harvest log: a wet weight per tote on harvest day (often more entries than the page has rows) and dry weights per bin on a later page.

- **Configure (event / one-shot sheets):** set up the table's **first row** — every column, checkboxes too (bindings, "checked when value equals") — select those boxes and hit **🔁 Group as repeating rows** (Field properties). It asks how many rows the page holds (2–100) and creates rows 2..N as real boxes (`repeat: true`, `dayGroup` = group id, `day` = row; badges `R2`…`RN`). Moving works like day rows (plain drag = the group, **Ctrl/⌘** = one row, **Alt/⌥** = one box); ✂️ Ungroup keeps row 1. Weekly sheets use 🔗 Group as daily entry instead.
  - **Column edits:** a box's question, source, ☑ checkbox flag, "checked when value equals" and **size** follow down its column (`cfgColumnOf`), for day rows too — fixing row 1 after grouping fixes every row. Resizing (corner / edge handles, or W / H) gives every box in the column the same width and height, each staying in its own row; dragging the top or left edge moves them all by the same amount. **Alt/⌥**-drag a handle to resize one box. A column is the same x in every row; boxes stacked at one x in a row (the grow-log's Core / Grow, Hand / Wand / Emitter) are separate columns, matched by their place in the stack. Re-spacing a group (🔗 on boxes already grouped) and the pitch it measures use the same columns, so stacked boxes keep their own heights.
- **Questions:** tick **🔁 Repeating (one answer per entry)** on the questions that fill the rows, and bind each row-1 box as usual. On event / one-shot sheets the "Row-scoped (per day)" box is hidden unless a question already has it. The builder warns when a repeating question is bound outside the rows, or a plain question to them.
  - **Tick-a-box columns** (e.g. Flower / Trim / Other): one select question bound to three checkbox boxes in the row, each "checked when value equals" its word; the matching box prints ✕.
- **Tables (`repeatTables`)** come from the bindings — nothing to name:
  - a table = a set of repeating rows plus the repeating questions bound to them. Row groups that share a question are one table; a table in **side-by-side halves** fills the left group, then the right;
  - a repeating question bound to no rows (notes only) joins the table of the nearest bound repeating question before it in the wizard (else after it);
  - row groups with no repeating question aren't a table and print nothing;
  - a sheet may have **several tables**, on one page or different pages, but each table's boxes must be on **one page** — Save refuses otherwise ("has rows on pages 2 and 3").
- **Filling — the Entries step:** each table gets **one** runner step, where its first question sits (`runnerSteps`), headed "🔁 Entries · page 3" (plus "· table 2" when a page has several):
  - a form with the table's questions and **＋ Add entry**. Enter moves to the next typing box; Enter on the last adds the entry. Mandatory answers are checked per entry;
  - a choice question with up to 5 options (`ENTRY_TAP_MAX`) shows as **tap buttons**; tapping the picked one again clears it. Longer lists stay a drop-down;
  - the entries so far, newest first, each with **✎** (load into the form → 💾 Update entry) and **🗑** (asks; later entries move up). An entry saved with the log is **on file**: changing it is a correction, and 🗑 marks it "deleted on Save" (**↩** undoes) — it stays in its row, struck out, and later entries don't move up (see "Corrections & Change Log");
  - "N entries · page 3 prints 2× (20 rows per page)", or a warning when the table's questions aren't bound to repeating rows;
  - a new entry starts from the previous one for ⏪ same-as-last questions (initials: the name only — strokes are drawn fresh) and from `prefillFrom` otherwise;
  - **💾 Save log** writes every table's entries to `inst.rows`. An entry still typed in a form is added first; if it can't be (a mandatory answer missing), the runner shows that form and nothing is saved.
- **Storage:** `inst.rows = [{ id, <questionId>: value, …, void? }]` — every table's entries in one list, table by table, each in entry order. Each entry has an 8-char `id` and a key for **every** question of its table (blank = `''`, initials `{ name, strokes } | null`); that is how a row finds its table (`splitRows`: the first table whose questions it answers). Rows matching no table (their questions were deleted) are kept on save and never printed. Saving replaces the list with the runner's copy. `void` (ISO time) = deleted after it was on file: keeps its slot, prints struck out, counts nowhere.
- **Print:** a table's entry n goes in row slot n. The table's page prints again for every further *rows-per-page* entries (45 entries on a 20-row page → 3 copies), and a page with several tables prints as often as its fullest table needs. Copies follow each other before any later page (pages 2, 2, 3, 3 …). Header boxes repeat on every copy; unused rows on the last copy print blank; a saved entry's empty answer prints `N/A`.
- **Completion:** every table needs at least one entry (see "Completion Rules").
- **Reports:** the Labour & Cost Wizard reads `inst.rows` like other answers (dated by the instance), so a summed metric (`harvest.wetWeight`, `harvest.dryWeight`) adds every entry; a Net column tagged dry weight sums every bin, flower, trim and other alike (`docs/REPORTS.md`).
- SitkaTools' split files treat a page as a whole, so `rows` needs nothing there.

### Corrections & Change Log (QAP traceability)

A value on file that is changed keeps its old value on the printed page, struck out with drawn initials and the date, and every change goes in a printable change log. A reason is required, and a signed log can still be corrected (it is flagged).

- **On file:** a value is on file once it was saved as part of a complete entry. From then on a change is a correction:
  - a daily log's **day**, once saved with every answer and the day's drawn initials (`dayAnswered`, or the day already has a correction — `dayOnFile`);
  - a page's **header** answers, once every one of them is answered (`headerOnFile`);
  - a **repeating entry**, once the log was saved with it;
  - a 📌 **constant**, once saved (not blank).

  Days and pages still being filled in change freely.
- **The runner:**
  - an on-file step says so ("✏️ This day is on file…", "✏️ This page is on file…", "✏️ Saved entries are on file…");
  - a changed answer shows "✏️ On file as 24.5 — saving strikes it out…", with its earlier corrections listed under it;
  - the day's drawn initials are shown locked (🔒), never redrawn;
  - prefills don't fill a saved blank on an on-file day (it would read as a change).
- **Saving (`saveRunnerEntry`):** the sheet's pages are copied before the save (`sdBefore`). After everything else (backfill prompts, strike initials), `findCorrections` compares before and after; days a re-page moved are followed by date. When anything on file changed, the **correction pad** (`captureCorrection`) opens:
  - it lists each change (`Oct 14 · Temp: ~~24.5~~ → 25`; knock-ons say "carried forward");
  - it requires a reason (tap-to-fill chips: Typing error, Wrong reading, Entered on the wrong day, Wrong box), a name and drawn initials;
  - **Cancel** puts the sheet's pages and the lot back exactly as before Save. Nothing is saved; the runner stays open with its draft. A live DB update while the pad is open cancels the same way;
  - the Initialize quiz (`saveInitConstants`) does the same for constants, into `constantChanges`.
- **Knock-ons:** a backfilled plant count that shifts later counts records each shifted on-file day as `carried` (`via` = the edited day). A re-page (`applyRepage`) moves each day's change history to the page the day lands on; a rebuilt page gets the page-level history of the page its header came from. On-file days whose phase / room the re-page changes are recorded as carried.
- **Record** (`inst.changes[]`, `constantChanges[]`): `{ id: 'ch…', at: ISO, date: YYYY-MM-DD, kind, day, row, entry?, where?, q, label, from, to, by: { name, strokes }, reason, via?, constant? }`.
  - `kind`: `edit` (the user changed it), `carried` (a save changed it on another day), `void` (an entry deleted), `removed` (a filed day or entry no longer on any page; a day re-paged or taken back onto another page is followed there, review D7), `added` (a day or entry added to a page the master grower had already signed, so it shows "changed after signing"; review D12), `signature`.
  - Strokes are rounded to 3 decimals; each record keeps its own copy.
- **Print:** a corrected box prints the **current value first, at the box's own size**, so the real data reads clearly. Beside it, the **latest** `edit` / `carried` record (`boxCorrections`) only, as a small two-line stack about as tall as the current value: the old value struck out (0.52 × the box's size, 5.2 pt in a 10 pt box) over the date as `mm/dd` (0.885 × that; the change log keeps the year), with the drawn initials behind the date. Earlier changes of the box don't print; every change is in the 📝 Change log. The stack goes beside the current value when it fits, else wraps onto the next line, which is only as tall as the stack.
  - The initials sit behind the date, drawn in dark grey (`#666`) so the date reads on top, 1.3 × the date's height (pad shape `CORR_INITIALS_ASPECT`, 2.5 : 1). A blank that was filled in prints a struck `N/A`.
  - **Room = the box as configured** (`x`, `y`, `w`, `h`) — never read from the page image, so shading or lines on a form don't change it. Give a box that may be corrected a little width beside its value, or a second small line, in Configure Sheets (resizing a day-1 box resizes its column). An uncorrected value prints at the box's top, so a taller box doesn't move it. For pH over EC in one cell, each box can take half the cell.
  - Only the old value shrinks when it doesn't fit (a popup script, 5 % steps, not below 5 pt), never the current value. The initials are left out of the measuring (they may spill past the box). What still doesn't fit shows past the edge, never cut off.
  - A **tick box** that lost its ✕ prints the ✕ struck through, inside the box. Nothing prints beside a tick box (it would cover the form's label), so its initials, date and reason are in the change log only; the runner's "On file as …" note and the correction pad say so (`printsAsCheckbox`).
  - A **deleted entry** prints every value struck through at full size, with the date and initials once, after the row's right-most text box (the deletion is its latest change, so earlier corrections don't print).
  - The popup toolbar (not printed) says "✏️ N changes on file for this page".
- **Filing Cabinet:**
  - a page with changes shows **✏️ N**, which opens its change log. It turns amber with "· changed after signing" when a change is newer than the master grower's signature (signing again clears it);
  - the toolbar's **📝 Change log (N)** lists every change on the lot, newest first: when, document and page, where, the change, who (drawn initials + name) and why;
  - **🖨️ Print change log** opens a light, print-ready table (Letter landscape). The change log prints from this button only, never with the form.
- **Reports:** the Labour & Cost Wizard skips `void` entries; corrected values count as they are now.
- **Not tracked:** auto-filled boxes (dates, lot #, strain, plants removed) aren't typed by anyone, so they print what they are. On-file initials can't change. Edits to the JSON file by hand aren't caught (SharePoint's version history covers that).

### Completion Rules

Completion is re-evaluated after every save and kept only as `completedAt`. It drives the leaf's status chip and the Print / Sign tooltips — never whether Print works.

- **`daily-weekly`:** every day in the active window has an answer for every row-scoped question (initials only once drawn), plus the signature if the sheet has one. The window is `periodStart` … `periodEnd`, or ends at `phaseChangeDate` when set (struck rows don't count) — and then `strikeInitials` must be captured.
  - **Blank-but-confirmed counts:** saving a day stores every row-scoped question, blank ones as `''`, and a key being present counts as filled, so a box left blank on purpose (an empty comments field) still completes the day (`dayAnswered`). Initials never count that way: they need drawn strokes. A confirmed blank still prints `N/A`.
- **`one-shot` / `event`:** all instance-level questions answered, plus the signature if defined.
- **Repeating tables** (one-shot / event): each also needs at least one entry (a deleted, struck-out entry doesn't count); each entry's mandatory answers are checked when it is added. The leaf shows `1/1 fields · 12 entries`; the tooltips list "no entries yet (page 2)".

## Print Popup

Print works once an entry exists and the matching page set is loaded — the instance needn't be complete.

1. The tool builds a self-contained HTML document: one section per page at its physical size (inches), each field's text absolutely positioned (normalized coords → % of the page container), signatures and initials as inline SVG polylines, and a slim toolbar with **🖨️ Print**. Pages break with `page-break-after: always`.
2. The popup opens with `window.open()` and gets its own blob URLs, made in its own window from the page `File`s (`win.URL.createObjectURL`; review D11), so loading another document or closing PaperWizard doesn't break it.
3. Light theme (white page, black text) whatever the suite's theme; `@media print` hides the toolbar.
4. Print calls `window.print()`; the browser dialog does the rest (including Save as PDF).

**Page rendering** (configure and print): each page is a plain `<img>` (`pointer-events: none`, so click-drag creates boxes over it) in a `.form-page` container whose `aspect-ratio` is the image's pixel ratio. Box coordinates become percentages, so boxes track the image at any size with pure CSS. Configure has a zoom (buttons + Ctrl/⌘+scroll, a CSS variable). No PDF library, no CDN.

**Overlay rules:**

- **Empty prints `N/A`:** an unanswered question or a null binding prints `N/A`, never a blank — a controlled document is complete on its face.
- **Except unsaved day rows:** a day-group member (or legacy row field) on a day that was **never saved** prints blank, so a struck-out log's remaining days stay clean under the line. A saved day prints `N/A` in its empty boxes (confirmed blanks included). Header / one-shot / event fields keep the `N/A` default.
- **Repeating pages** print once per *rows-per-page* entries (see "Repeating Rows").
- **Strike-out:** an instance with `phaseChangeDate` prints the computed strike-out (see "Phase & Room Change").

## Database Key — `_PaperWizard`

```
_PaperWizard: {
  sheets:  { <sheetId = page base name>: { name, orientation, pageWidthIn, pageHeightIn, pageCount,
                                           cadence, document, fields: [Field], signature } },
  wizards: { <wizardId>: { sheetId, name, questions: [Question] } },
  entries: { <lotId>: { <sheetId>: { instances: { <YYYY-MM-DD>: Instance },
                                     constants?, constantChanges?, paperBefore? } } },
  buildingEntries?: { <BuildingID>: { <sheetId>: entry } },     // building forms (same entry shape)
  facilityEntries?: { <sheetId>: entry }                        // facility forms: one record every building adds to
}
```

- **Ownership:** only PaperWizard reads or writes `_PaperWizard`. It reads `lots`, `rooms` and `buildings`, and writes only the three lot fields in "Write-Back to the Main DB".
- **Sheet ids are page-image base names** — no separate id. Renaming a form's page set means re-configuring (or an explicit rename that moves the key).
- **Orphans:** entries of a lot no longer in `DB.lots` are kept. Entries for a sheet id with no configured sheet are ignored in the cabinet.
- **Cross-lot references are derived**, never stored (see "Filing Cabinet" → pre-move-in sourcing).
- Writes nothing to `calendarEvents`.

## Initial Sheet Set (to be configured, not shipped)

| Sheet (base name) | Cadence | Notes |
|---|---|---|
| `propagation-worksheet` | one-shot | Filled once at lot creation; header from lot keys (strain, lot #, parent lot #, dates). Starting plant count pre-filled from `lot.plantCount`. |
| `grow-log` | daily-weekly | 7 day rows + phase header (`instance.phase`). Each row ends in an initials box (row-scoped ✍️ question). Rolls over on phase / room change. |
| `room-clean-clone` / `-veg` / `-grow` / `-dry` / `-trim` | event | One form per room role. The room is a box bound to the lot's room for that role. Filed under the lot that cleaned; referenced by the next occupant. A legacy single `room-clean` page set still works (role from name keywords). |
| `ipm-log` | event | IPM applications; printed on demand. |
| `harvest-log` | event | Harvest-day entries (repeating tables for weights); printed on demand. |
| `drying-log` / `trim-log` | daily-weekly | Post-harvest daily logs, grow-log machinery (incl. room rollover), no coverage rule. Separate documents even when dry and trim are one room. |

## Relationship to SitkaTools

- **Where its code is:** in `SitkaTools/SitkaTools.html`, under the `═══ TOOL PaperWizard` markers (root `CLAUDE.md` → "Tool Overlays"). It opens over SitkaTools, one tool at a time, and starts afresh each time.

It has no DB import / export of its own — only sheet-configuration import / export and Load document. It calls `notifySitkaTools()` after every `_PaperWizard` change (sheets, wizards, entries, signatures) and after every lot write-back.

**Split files:** paperwork filled on a building device is saved in that building's `Building-<ID>.json`; other buildings' paperwork is shown but stays in their files.

**🚚 Moving a lot to another building** (user decision 2026-10-25; root `CLAUDE.md` → "Lot move"): the Room answer on a daily log (or the harvest log) names a room in another building (`buildingMoveOf`).
- **Only on the newest day of the log:** on an earlier day with later entries the save is refused ("A move to <building> goes on the newest day of the log — … Nothing was saved").
- The save is a room change like any other ("Phase & Room Change"): the page is struck that day with drawn initials and the next page starts blank on the move day in the new room, but it isn't offered for filling here. The toast says "🚚 moved to <room> (<building>) — save in SitkaTools; <building> picks it up when it next opens the files".
- Nothing else records the move: the lot is now in another building's room while its pages are in this building's file, so it's read-only here and its pages stay put until the receiving building's device picks it up (when it next opens the files); the pickup takes the unsigned pages (the blank one included) and lot-level values into its file, and its device fills the new page from the move day.
- **A move is a change from what the record said before** (that day's saved Room answer, or the page's), else from the lot's live room (`buildingMoveOf`), so correcting a day from before an earlier move is not a move.
- Moves recorded before 2026-10-25 by Send / Accept left the grow log on its old page; the first open in the new room still asks "Lot is now in <room> — close this log?" (`checkRoomMismatch`).

**On a building device** (root `CLAUDE.md` → "Building Device View"):

- The lot selector lists only the building's lots (current room or flower room in it), plus 🏭 Facility and its own 🏢 building. On facility forms it adds, and can't change what's on file ("Facility & Building Paperwork" → Who fills).
- **Configure Sheets** is hidden — sheets and wizards live in Main.json.
- **Start on a chosen day** offers only the building's rooms (`pickableRoomNames`), plus any value already in use. The 🏠 Room question offers those first, then every other building's (a move, see above). With split files open (`DeviceView.split`) the office gets the same, from the lot's current building. A single-file DB lists every room, ungrouped: it has one file, so nothing is handed over.
- **Read-only lots:** `lotElsewhere` returns `{ banner, toast }` for a lot this device may only view and print: a lot **in another building now**, even if its flower room is here — "🔒 … is in <room> (<building>), so its paperwork is filled and saved there", plus, until that building has picked it up, "This building's file keeps its pages until <building>'s device picks it up".
- **On the office with split files** (user decision 2026-10-25: only a building's own device writes its file) every lot's paperwork and every building form is read-only — "🔒 Read only on the office — … filled, signed and corrected on <building>'s device … Open SitkaTools as <building> to change it" — and the facility forms, kept in Main, fill as before.

  The cabinet shows the banner and drops Fill, Start, Sign and Initialize paperwork. `openRunner`, `openStartLogModal`, `openSignatureModal` and `openInitQuiz` refuse with a toast (`readOnlyHere`). Printing doesn't stamp `printedAt`, for these lots and any lot this device doesn't list.

### The Database from SitkaTools

The root pattern applies ("Tool Overlays"). A `sitkaGit_db_update` (SitkaTools changed the DB while it's open) replaces `DB.data`, applies the view and re-renders the lot selector, status bar and cabinet — no toast, never `notifySitkaTools()` back.

- **Open dialogs survive:** the runner and dialogs are overlays outside the cabinet. The runner keeps its draft and isn't re-rendered; its page is looked up again in the new DB. The signature, Start on a chosen day and Initialize dialogs look their record up again on save, and every save re-checks that the lot isn't read-only here.
- **The cabinet keeps its open sections** when the same lot redraws (push or save). Switching lots resets to the default.
- **Prefills follow the push:** an answer still holding its prefill is recomputed by the open-time rules (live lot for plant count / phase / room; the page on a backfill day), and the input is updated if it still shows the old prefill. Typed or picked answers are never touched. If the push changed the lot's stage, the runner acts as if the "Lot is now in …" prompt was declined; the next open asks again.
- **Push during the strike-initials pad:** the waiting save still holds the old DB, so OK cancels it like Cancel ("nothing was recorded — try again"); the runner stays open with its draft.
- **Push during the correction pad** (or Cancel there after one): the save's changes went into the old DB, so nothing is put back into the new one (what was just merged in stays; review H7, D10). A new page cancelled leaves no empty record of its sheet behind.

## UI Convention

Root UI Standards apply. Specifics:

- **Header:** tool name + the two tabs (segmented buttons) on the left; Active Lot selector on the right, disabled / hidden in Configure Sheets (configuration is lot-independent).
- **Status bar:** sheets configured · active lot · entries due today.
- **The day rolls over** (like SitkaTools and DailyWizard): left open overnight, the cabinet and status bar redraw for the new day by themselves — once a minute, when the tab is shown again and on focus — so what's due, missing days and the "📅 Start new week" / "New entry" leaves are today's. An open runner or dialog is left alone.
- **Filing Cabinet:** collapsible tree, one leaf per instance with status and inline actions; toolbar with Load document, 📋 Initialize paperwork, 📝 Change log.
- **Configure Sheets:** the page preview on top — click-drag creates a box; drag moves it (modifiers as in "Day rows"); ↕ / ↔ handles slide along one axis (same modifiers); corner and edge handles resize (a column at a time, Alt/⌥ one box); Shift-click / Shift-drag multi-selects; the signature box has its own style. Below: **Sheet** and **Field properties** cards side by side, the **Wizard builder** full width under them (it shows each question's binding read-only). 💾 Save writes `_PaperWizard.sheets[baseName]` and the wizard, then `notifySitkaTools()`.

## Tests

`tests/repeating-rows.test.mjs` and `tests/paper-corrections.test.mjs` cover repeating rows and corrections; `tests/runner-close.test.mjs` covers closing the runner only by its ✕; `tests/grow-log-changes.test.mjs` covers phase / room changes recorded on edited days (newest day, earlier days, a page's only day, moved earlier, taken back, re-paged up to a later change, Cancel at the correction pad); `tests/lot-handoff.test.mjs` covers moving a lot to another building from the grow log (the grouped room list, the newest-day rule, the strike-out and blank page, read-only until picked up, the receiving building filling the new page); `tests/scoped-paperwork.test.mjs` covers facility and building paperwork (dropdowns, filling, printing, two buildings adding to one facility page at once, the office merging them into Main, what's on file locked on a building device, the queues released); `tools-smoke`, `cost-inputs` and `cost-per-gram` also open PaperWizard. Run with `node tests/run.mjs` (root `CLAUDE.md` → "Tests").
