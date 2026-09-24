# CropLabourWizard — Tool Context

## What This Tool Does

CropLabourWizard is a **crop schedule calculator** for licensed cannabis cultivation. Given a selected lot and an anchor date, it automatically computes and schedules every major cultivation task as calendar events based on editable day offsets from reference points. The user picks a lot, sets the anchor date, adjusts any task's day offset in the preview, and generates the entire grow-out timeline.

### Intended Use

- **Auto-schedule a full crop cycle:** Select a lot, enter the anchor date, and the tool calculates every downstream task — cloning, coco block layout/spiking & hydration, transplanting, topping, preventative IPM sprays (optional, off by default), undercanopy lights & air socks, flipping to flower, trellis layout, pruning, leaf picks, clone cutting, harvest, grow-room clean, tank & irrigation line clean, tote prep, bucking, trim room prep, trim, machine trim of smalls, room cleans (clone, veg, dry), and final weigh/ship.
- **Preview & edit before committing:** See all computed tasks with their default dates, then adjust any task's day offset (including flip-to-flower, harvest timing, planting offset) and multi-day durations (trim length; optionally multi-day harvest) before generating the final schedule. Each task's computed date shows its weekday next to it (e.g., `2026-09-15 · Tue`), and clicking a task's date opens a clickable date picker — picking a day adjusts that task's offset by the delta, exactly like the +/− spinbox.
- **Visualize labour demand:** All generated events appear on the shared calendar so the grower can see when tasks cluster across multiple lots.
- **Dynamic Day 0 anchor:** When Cutting Clones is enabled, the top date is the cloning date (Day 0) and planting offsets from it. When disabled, the top date becomes the planting date (Day 0). All downstream tasks cascade accordingly.

### Crop Schedule — Recipe-Driven Task Offsets

The set of cultivation tasks is **data-driven**: it comes from the active recipe's `tasks[]` array (`activeRecipe.tasks`), not a hard-coded list in this file. The full recipe schema, validation rules, and compatibility contract live in the root `Agent.MD` → "Task Recipes". This section documents how this tool *consumes* a recipe to compute dates.

**Default recipe:** the built-in **`sitka-9week`** ("Sitka Standard (9-week bloom)") is the default — 32 tasks, chain `cloneCutBeforeHarvest: 21`. It lives in code and is always available as the fallback; it is never written to the DB. Any user-created or imported recipe (stored under `_CropLabourWizard.recipes`) can be selected instead and fully replaces the task list. The values that used to be hard-coded are now the built-in recipe's defaults.

**Day 0 anchor (dynamic):**
- **Clones enabled:** Cloning date = Day 0, Planting offsets from cloning (default +14 days, editable)
- **Clones disabled:** Planting date = Day 0, Cutting Clones hidden

All day offsets are user-editable in the preview. Changing a reference point's offset (e.g., Flip to Flower or Harvest) cascades to all downstream tasks by the same delta. Each task's `reference` field names its anchor (`cloning` / `planting` / `flip` / `harvest` / `trim`) and `defaultOffset` is the days from that anchor; the preview renders one editable row per recipe task in array order (top → bottom = chronological).

**Optional IPM sprays:** the four 🧴 preventative spray tasks are toggleable in the preview and **default to off** (`hasToggle: true`, `defaultEnabled: false`). When enabled, they behave like any other task — editable offset, clickable date badge, holiday checks. The two flower-room sprays (Start of flower, Second week of flower) are bloom-dependent: they shift with Flip-to-Flower edits and with projection re-anchoring/bloom-length changes, exactly like the other flip-relative tasks. When a lot's stored schedule is loaded, a toggleable task absent from its events is inferred to have been disabled at generation time (its preview checkbox renders unchecked).

**Cascade behavior:** Adjusting the Flip to Flower offset shifts all flip-relative tasks (Flower IPM Sprays when enabled, Trellis Layout, Early Leaf Pick, Late Leaf Pick, Harvest) and all harvest-relative tasks (Room Clean, Tank & Irrigation Clean, Tote Prep, Bucking, Lab Sample, Prepare Trim Room, Trim) by the same delta. **Clone Cut is derived/locked** (`isLocked`) — it always lands at harvest start − `chain.cloneCutBeforeHarvest` days (default 21), so it follows the bloom length automatically rather than being an independently editable flip-relative task. Similarly, adjusting the Harvest offset shifts all post-harvest tasks (and Clone Cut), and adjusting the Trim offset shifts the three trim-anchored tasks (Machine Trim Smalls, Clean Dry Room, Weigh & Ship).

**Multi-day durations:**
- **Trim length** is user-selectable in the preview (1–30 days, default 7 — `DEFAULT_TRIM_DAYS`). The three trim-anchored tasks (Machine Trim Smalls, Clean Dry Room, Weigh & Ship) are re-based so they always land 1–2 days after trim *ends*, regardless of the chosen length.
- **Harvest** can optionally span multiple days via a "Multi-day" checkbox in the preview (default length 2 when checked). When multi-day is on, all harvest-referenced tasks measure from the harvest *end* date instead of the start date; when off, behavior is identical to single-day harvest.

**Post-trim offset convention:** trim-anchored tasks store their `defaultOffset` **relative to a 7-day (default) trim**. `resolveTaskAnchor()` re-bases them at compute time: for a `trim` reference it adds `trimDays − DEFAULT_TRIM_DAYS` to the anchor, so a task defined at +7/+8 always lands 1–2 days after trim *ends* even when the user picks a different trim length. This is why the stored offsets look like "day after trim ends" while remaining correct for any chosen length.

### Calendar Events Generated

CropLabourWizard appends events to the shared `calendarEvents` array using `"sourceTool": "CropLabourWizard"`. Each event has:

- **Title:** Emoji + `Room code-Strain name#Lot number` + `, task name` (e.g., `"🌸 B66DG1-Purple Haze#LOT-001, Flip to Flower"`). The room code is **per-task**, based on which phase of the crop cycle the task belongs to:
  - **Cutting Clones** (`clone_cut_prep`) and **Clean Clone Room and used cloning supplies** (`clone_room_clean`) → the lot's `cloningRoom` (room name stored on the lot; resolved to a room ID via `rooms.<roomId>.name`).
  - **Tasks before Transplanting to Flower Room** (Planting, Preventative IPM Spray Early veg, Topping, Order IPM) and **Clean Vegetation Room** (`veg_room_clean`, which happens after transplant but in the veg room) → the lot's `vegRoom`.
  - **Preventative IPM Spray (Second veg IPM)** happens the day *after* transplanting — the plants are already in the flower room, so it resolves to the destination (flower) room like everything post-transplant.
  - **Lay-out & Spike Coco Blocks for Hydrating** (`layout_coco_blocks`), **Hydrate coco blocks for transplanting** (`hydrate_coco_blocks`), and **Install undercanopy lights and air socks** (`undercanopy_lights`) are explicit exceptions: although they're listed *before* transplant for chronological display (they're prepped the day(s) before plants arrive), they happen in the flower room, so they resolve to the destination (flower) room.
  - **Transplant and everything else after** (incl. post-harvest tasks like Tank & Irrigation line clean, Prepare Trim Room, and post-trim tasks: Machine Trim Smalls, Clean Dry Room, Weigh & Ship) → the lot's destination (flower) room — resolved from `rooms.<roomId>.assignedLots` containing the lot, falling back to matching the lot's `destRoom` name against `rooms.<roomId>.name`.

  Room names are stored on the lot (`cloningRoom`, `vegRoom`, `destRoom`) and resolved to room IDs at title-build time. If no room is found for a task's phase, the prefix degrades gracefully: `Strain#Lot number`, or just `Lot number` when strain is also missing.
  - **Projected lots** use a simpler title — Emoji + lot ID + `, task name` (no room-code prefix, since the lot ID already encodes it). See "Calendar Events — `sourceTool: 'CropProjection'`".
- **Date:** The computed date for the task (`YYYY-MM-DD`)
- **EndDate:** Set for multi-day events only — always Trim, and Harvest when multi-day is checked. Omitted for single-day events.
- **SourceTool:** `"CropLabourWizard"`
- **LotId:** Always set to the selected lot ID — every event is scoped to a lot
- **TaskType:** A string identifier for the task (e.g., `"harvest"`, `"trim"`, `"flip"`) used during reconciliation to detect and replace stale schedules

### Schedule Reconciliation

When a user generates a schedule for a lot, the tool first **removes all existing CropLabourWizard events** for that lot from `calendarEvents` before inserting the new batch. This prevents duplicate or stale tasks when the planting date changes. The reconciliation logic matches on `sourceTool === 'CropLabourWizard'` AND `lotId === selectedLot`.

## Task Recipes (Recipe Manager)

The cultivation task list is defined by **recipes** — self-contained JSON documents (schema + validation in the root `Agent.MD` → "Task Recipes"). This tool ships one built-in recipe, **`sitka-9week`** (32 tasks, chain 21), which lives in code and is always the fallback. User recipes are created, edited, duplicated, imported, exported, and deleted from this tool and stored under `_CropLabourWizard.recipes`.

### Recipe Selection — Per-Lot `recipeId`

- The header's **Task Recipe** dropdown (`#recipeSelect`) lists the built-in (labelled "(built-in)") plus every user recipe. Selecting a lot syncs the dropdown to that lot's stored `recipeId` (`syncActiveRecipeToLot`); a lot with no stored `recipeId` — or one whose id no longer resolves — falls back to the built-in via `getRecipeById()`.
- On **Generate**, the selected recipe's id is persisted into the lot's stored config (`_tool_CropLabourWizard.recipeId`) alongside the existing fields, so the lot re-renders with the same recipe later.
- The header's separate **Projection Recipe** dropdown (`#projectionRecipeSelect`, `projectionRecipeId`) drives *fresh projection lots and chain cadence only* — it is independent of the per-lot recipe used for real-lot schedules.

### Import / Export (explicit file picker only)

- **⬆️ Import** opens a file picker (`#recipeImportInput`). The file is parsed, validated with the same `validateRecipe()` as in-wizard saves, and rejected with an error list on failure. If the id already exists, a confirm offers to replace it. On success the recipe is stored, the task-type registry is merged, the imported recipe is selected, and the preview rebuilds from its defaults.
- **⬇️ Export** downloads the currently selected recipe as pretty-printed JSON (share-API-first, falling back to `URL.createObjectURL` + `<a download>`).
- **No auto-loading:** this tool never fetches adjacent/sibling `.json` files — under `file://` cross-file fetches are CORS-blocked, and it is a deliberate user requirement. Recipe files follow the naming convention **`recipe-<id>.json`**.

### ✏️ Manage — Recipe Manager Overlay

The **✏️ Manage** button (`#manageRecipesBtn`) opens the recipe manager overlay (`#recipeManagerOverlay`, z-index 250) with two views:

- **List view:** `＋ New Recipe` (clones the built-in, assigns a fresh 6-char id from `CODE_ALPHABET` `abcdefghjkmnpqrstuvwxyz23456789`, collision-checked against the built-in + DB recipes) plus one row per recipe. Built-in rows get **Duplicate / Export** only; user rows get **Edit / Duplicate / Export / Delete**. Clicking a row's main area selects that recipe (updates `activeRecipe` + dropdowns, closes the overlay).
- **Editor view:** name input, read-only id, chain input (`cloneCutBeforeHarvest`, default 21), and a task table (top → bottom = chronological order) with columns for emoji, name, type (`snake_case`), reference anchor, offset, room phase, toggleable, on-by-default, and locked. Rows support move up/down, delete, and `＋ Add Task`. **DOM-sync rule:** before any mutating re-render (add/move/delete row), the table is read back into the working copy via `readTaskTable()` so typed-but-uncommitted values are not wiped.
- **Delete fallback:** deleting a recipe in use shows a confirm warning with the lot count — e.g., `1 lot(s) currently use it — they'll fall back to the built-in recipe.` Lots whose stored `recipeId` dangles resolve safely to the built-in on next selection (no crash). If the deleted recipe was the projection recipe, `projectionRecipeId` resets to the built-in.
- Saving from the editor re-runs full validation, writes to `_CropLabourWizard.recipes`, merges the task-type registry, and notifies SitkaTools.

### Task-Type Registry Maintenance

`_CropLabourWizard.taskTypes` is a `taskType → { name, emoji, roomPhase? }` registry so other tools can label custom task types:
- **Backfill:** `ensureStructure()` seeds it with the 32 built-in types when absent.
- **Merge:** every recipe save/import runs `mergeTaskTypeRegistry()`, upserting each task's `{name, emoji, roomPhase?}` into the registry.

## Crop Projection (Projected Lots)

Flowering rooms can hold **projected lots** — placeholder future crops that let you plan labour months ahead without creating real lots. Projected lots are generated by this tool, stored in a dedicated map inside the shared database, and rendered as calendar events with their own `sourceTool`. They are **not** real lots: they never appear in `DB.lots`, never show up in SitkaTools' lot manager, and can be regenerated at any time.

There are two distinct operations on a room's chain: **projection** (building or refreshing the full 5-lot chain for a room with no pending reprojection) and **reprojection** (shifting the surviving chain down one slot after TBA-1 has been replaced by a real lot — see "Reprojection" below). They are different concepts and must not be conflated.

The full suite-level spec lives in the root `Agent.MD` ("Crop Projection (Projected Lots)"). The sections below document this tool's implementation details.

### Unified Lot Abstraction

All code paths that read `DB.lots[lotId]` go through projection-aware helpers so real and projected lots are handled identically:

| Helper | Real lot | Projected lot |
|---|---|---|
| `isProjectedLot(lotId)` | `false` | `true` (id in `projectedLots`) |
| `getLotRecord(lotId)` | `DB.lots[lotId]` | `{ name, strain: 'TBA', destRoom: roomName }` |
| `getScheduleConfig(lotId)` / `setScheduleConfig(lotId, cfg)` | `DB.lots[lotId]._tool_CropLabourWizard` | `projectedLots[lotId].config` |
| `clearScheduleConfig(lotId)` | deletes `_tool_CropLabourWizard` key | deletes only `.config`, keeps map entry (→ stale) |
| `eventsForLot(lotId)` | events with `sourceTool === 'CropLabourWizard' && lotId` | events with `sourceTool === 'CropProjection' && lotId` |
| `lotSourceTool(lotId)` | `'CropLabourWizard'` | `'CropProjection'` |

Threaded through: lot selector, form load/save, preview, generate, clear, schedule list, and reconciliation.

### Projected Lot Map — `_CropLabourWizard.projectedLots`

The **source of truth** for projected lots lives in the top-level `_CropLabourWizard` key (the same key that holds `generations[]`):

```js
_CropLabourWizard: {
    generations: [ /* generation log — real lots only */ ],
    projectedLots: {
        "G1B6-TBA-01": {
            name: "G1B6-TBA-01",
            roomId: "G1B6",
            roomName: "Grow Room 1",
            strain: "TBA",
            index: 1,
            config: { plantingDate, trimDays, harvestMultiDay, harvestDays, taskCount, generatedAt }
        }
        // … "G1B6-TBA-02" … "G1B6-TBA-05", plus one chain per other flowering room
    }
}
```

Rules:

- **Synthetic lot IDs**: `{roomId}-TBA-{index}` (e.g. `G1B6-TBA-01`) — the room code is part of the ID, so each room's 5-lot chain is unique and generating projections for a new room can never collide with another room's lots. The `TBA` marker distinguishes projected IDs from real lot IDs; they are never written to `DB.lots`. The map entry still carries `roomId`/`roomName` as the source of truth for display and event tagging.
- **Naming**: `{roomId}-TBA-{index}` (zero-padded, e.g. `G1B6-TBA-01`) — strain is always `"TBA"` until a real lot takes the slot.
- **Config lives in the map entry** (`projectedLots[lotId].config`), not in `DB.lots[lotId]._tool_CropLabourWizard`, because projected lots are not DB lots.
- **The map is owned by this tool.** SitkaTools must never read or modify entries from it. The **sole exception** is the deletion hook, which deletes exactly one entry — `{roomId}-TBA-01` — when a real lot takes that room's slot (see "Deletion Hook — SitkaTools (for reference)" below).
- **`generations[]` log entries are only written for real lots.** Projected lot config lives solely in the map entry.

### Projection Chain — 5 Lots, 77-Day Cadence

Each flowering room gets exactly **5** projected lots forming a chain:

- **Lot Day 0** = the lot's clone-cut date (the form's anchor date when cloning is enabled) — the day its parent clones were cut.
- Within a lot (default settings): planting = Day 0 + 14 → transplant = Day 0 + 24 (planting +10) → flip = Day 0 + 34 (planting +20) → harvest start = flip + bloomLength (default **63**) = Day 0 + 97 → trim start = harvest + 11 (7 days) → weigh/ship = trim + 8.
- **Chain rule:** Lot(k+1) Day 0 = Lot(k) harvest **start** − `chain.cloneCutBeforeHarvest` days (default 21). With the default 63-day bloom, consecutive Day 0s are exactly **76 days apart**; the 5 lots span ~420 days (~14 months). With an 8-week (56-day) recipe they are **69 days apart** (~345 days / ~11.5 months for 5 lots).
- **Projection Recipe dropdown:** the header's recipe selector sets `projectionRecipeId` (built-in `sitka-9week` by default). It only affects projection chain generation — not manual preview editing or per-lot real schedules. The bloom length comes from the selected recipe's harvest offset, and because `clone_cut` stays at harvest start − `chain.cloneCutBeforeHarvest`, the chain cadence remains correct for any recipe.
- **Anchor for Lot 1:** Lot 1's Day 0 = the "Cut Clones to Replace Lot" (`clone_cut`) day of the room's **newest real lot** — the one with the latest `createdDate` (the crop that most recently came into the room) — or that lot's start day (Day 0 / `plantingDate`) if it has no `clone_cut` event. The gate is specific to that newest lot: Project Crop is available only once **that** lot has a generated schedule (an older scheduled lot does not count); there is no "today" fallback.
- **Overwrite push-back (room-readiness gate):** overwriting a projected lot's schedule — or the room's active real lot's schedule (the newest crop that took TBA-1's slot) — pushes *later* TBA lots forward **only** when their transplant would land before the overwritten lot's new irrigation-clean + 1 day — never pulled backward. A blocking warning lists every affected lot and its delta; cancelling leaves the chain untouched. Lots already late enough stay put (their planned delay absorbs the push) and stop the cascade through them. If the overwrite leaves extra slack, later lots keep their dates (the chain may drift from its nominal cadence — Project Crop re-tightens it).

### Reprojection

**Reprojection** is what happens to a room's chain after TBA-1 has been replaced by a real lot. It is a distinct concept from projection: projection builds/refreshes the chain for a room with no pending reprojection; reprojection shifts an existing, partially-consumed chain down one slot and tops it back up to 5 lots.

**Pending-reprojection state (inferred, never stored).** A room is *pending reprojection* when its `{roomId}-TBA-01` map entry is **absent** AND at least one of TBA-2…TBA-5 is present. This arises naturally from SitkaTools' deletion hook (which removes only TBA-1) and requires no stored flag — this tool infers it on load and after every DB update. While pending, TBA-2…TBA-5 are displayed with the ⚠️ stale indicator and count toward the status-bar stale total (display-only; their events still exist). A room whose full 5-entry chain is intact is never pending, even if some entries have no events (that is ordinary staleness, healed by a normal projection).

**Trigger & gate.** Reprojection is **manual** — it runs only when the user clicks the header button (whose label swaps from "Project Crop" to "Reproject" while the room is pending; see UI below). It is available only once the room's **active real lot** has a generated CropLabourWizard schedule — i.e., it has `CropLabourWizard` calendar events. The active real lot is the *last* non-projected lot in `room.assignedLots`: SitkaTools appends new lots to the end of that array, so this is the newest crop that took TBA-1's slot. An older scheduled lot still in the room does **not** unblock reprojection (gating on it would let the chain shift down on top of an unscheduled crop). Until the active lot has a schedule the button stays disabled with a tooltip naming it. The real lot's schedule gates availability, and its `tank_irrigation_clean` date drives the late-arrival push-back (below) — but reprojection never re-anchors the surviving lots to the real lot's harvest.

**Algorithm.**
1. **Rename pass, low → high (i = 2 up to 5):** for each index `i` where `{roomId}-TBA-{i}` exists, rename it to index `i−1`:
   - map key: `{roomId}-TBA-{i}` → `{roomId}-TBA-{i−1}`;
   - the entry's `name` field (same new ID);
   - every matching calendar event's `lotId`, **and** the lot-ID token inside each stored event `title` (titles embed the lot ID, e.g. `"🌸 G1B6-TBA-02, Flip to Flower"` → `"🌸 G1B6-TBA-01, Flip to Flower"`).
   Renaming low-to-high is safe because every target slot is already free: TBA-1 is absent by the pending precondition, and each later slot was just vacated by the previous rename. (Renaming high-to-low would clobber an entry that still needs to move.)
2. **Late-arrival push-back:** compute a per-slot plan (`computeReprojectionPushes`) *before* mutating anything. For each slot 1..4, ensure its transplant lands at least 1 day after the previous lot's `tank_irrigation_clean` (the real lot is "previous" for slot 1). A lot earlier than that is pushed back by the minimum delta; a lot already late enough stays put (its planned delay absorbs the push) and stops the cascade through it. Stale / position-less lots are regenerated at the required position. If any push is needed, a blocking `confirm()` shows the per-lot breakdown — **cancel leaves the chain untouched**.
3. **Apply + top up:** apply each planned shift via `reAnchorProjectedLot` (no bloom change), then generate one fresh `{roomId}-TBA-05` exactly the way a new projection is made — `defaultOffsetsSnapshot(bloomDays, recipe)` from the projection recipe + default durations — with Day 0 = slot 4's irrigation-clean + 1 day − its required transplant span.

Pushed lots keep their per-task offsets verbatim (the whole schedule shifts by the same delta); only the new TBA-5 is generated fresh, and it is the only lot affected by the current projection recipe. After reprojection the room has a full 5-lot chain again and is no longer pending.

### Late-Arrival Push-Back (implemented)

When a new real crop comes into a room, its actual schedule may land **later** than the day the chain planned. If the new lot's room cleaning (`tank_irrigation_clean`, the last room-prep task) lands too close to the next TBA lot's transplant, reprojection pushes the affected TBA lots back by the **minimum** needed so each transplant lands at least **1 day** after the previous lot's irrigation-clean.

- **Detection:** for each slot 1..4 (after the rename pass), compare the lot's current transplant date against `previous lot's irrigation-clean + 1 day` (the real lot is "previous" for slot 1). If it is earlier, a push is required.
- **Minimum push:** the lot shifts by exactly the shortfall (`requiredTransplant − currentTransplant`); its whole schedule moves by that delta (per-task offsets preserved). A lot already late enough — whose planned delay absorbs the push — stays put and stops the cascade through it.
- **Cascade:** each pushed lot's irrigation-clean moves forward by the same delta, so the requirement propagates down the chain to a fresh TBA-5. Stale / position-less lots are regenerated at the required position.
- **User consent:** never automatic. When any push is needed, a blocking `confirm()` shows a per-lot breakdown (e.g. `TBA-01: +5d (Mar 14 → Mar 19)`, `TBA-03: unchanged (planned delay absorbs it)`, `TBA-05: new — transplants Jul 31`) with a headline naming the push to the next lot. **Cancel = no changes at all** (the plan is computed before any mutation).
- **Scope:** only TBA lots after the late-arriving lot are affected; the real lot's own schedule is untouched. The gate is purely room-readiness (irrigation-clean vs. next transplant) — it does not re-anchor to the real lot's harvest date.

### Overwrite Push-Back (implemented)

Overwriting a lot's schedule via the Generate button may push its irrigation-clean past the next lot's planned transplant. Two cases trigger the push-back: overwriting a **projected** lot (e.g. delaying TBA-2's planting date), and overwriting the room's **active real lot** — the newest crop that took TBA-1's slot, whose cleaning gates the surviving TBA chain exactly as it would have while it was still TBA-1. Overwriting an *older* real lot in the same room does not push the chain (its cleaning doesn't gate the TBA lots). The same room-readiness gate as reprojection applies: each later lot's transplant must land at least **1 day** after the previous lot's irrigation-clean, and lots are pushed forward by the **minimum** needed — never pulled backward.

- **Detection:** before any mutation, `simulatedIrrigationClean` computes the overwritten lot's NEW irrigation-clean date from the form state (day0 + current offsets + durations) without writing events. For a projected-lot overwrite, `computeForwardPushPlan(roomId, index+1, newIrr)` walks slots `index+1..5`; for a real-lot overwrite it walks from the **first surviving TBA slot** (`computeForwardPushPlan(roomId, firstExistingTBAIndex, newIrr)`) — in a pending room that is TBA-2, exactly matching what overwriting TBA-01 would have done. Each step compares the lot's transplant against `previous lot's irrigation-clean + 1 day`.
- **Minimum push:** a lot earlier than the requirement shifts by exactly the shortfall (whole schedule moves by that delta, per-task offsets preserved). A lot already late enough stays put — its planned delay absorbs the push — and stops the cascade through it. Stale / position-less lots are regenerated at the required position.
- **No backward pull:** if the overwrite leaves extra slack (e.g. TBA-2 moved *earlier*), later lots keep their dates untouched; no dialog, no toast suffix. The chain may then drift from its nominal cadence — Project Crop re-tightens it.
- **User consent:** when any push is needed, a blocking `confirm()` shows the same per-lot breakdown as reprojection (`TBA-03: +5d (Mar 14 → Mar 19)`, `TBA-04: unchanged (planned delay absorbs it)`) with a headline naming the push to the next lot. **Cancel = no changes at all** (the plan is computed before any mutation).
- **Scope:** only TBA lots from the push start slot onward are affected (projected-lot overwrite: slots `index+1..5`; real-lot overwrite: first surviving TBA slot through 5); the overwritten lot's own schedule is generated normally. The gate is purely room-readiness — it does not re-anchor later lots to this lot's harvest date.

### Projection Engine Functions

| Function | Purpose |
|---|---|
| `PROJECTION_LOT_COUNT` | Constant = 5 |
| `projectedLotId(roomId, index)` | Returns `{roomId}-TBA-{index}` (zero-padded index, e.g. `G1B6-TBA-01`) — room-scoped so chains from different rooms never collide |
| `defaultOffsetsSnapshot(bloomDays = 63, recipe = BUILTIN_RECIPE)` | Snapshot of the given recipe's tasks with their default offsets (used to regenerate stale lots); the harvest offset is set to `bloomDays` so a fresh lot uses the selected bloom length. Defaults to the built-in recipe. |
| `generateLotSchedule(lotId, day0, offsets, durations)` | Shared by the Generate button and chain generation. Computes anchors, builds events (with correct `sourceTool` per lot type), writes config via `setScheduleConfig`, returns `{ events, config }`. For projected lots, events carry `roomId`. |
| `reAnchorProjectedLot(roomId, index, day0, bloomDays?)` | If the lot is stale (no events) → regenerate fresh from `defaultOffsetsSnapshot(bloomDays)` + default durations at the new Day 0. Otherwise → shift all existing events by the delta between old and new Day 0 (preserves custom offsets); when `bloomDays` is provided, bloom-dependent tasks additionally shift by `bloomDays − currentBloom` so the new bloom length takes effect. Updates `entry.config.plantingDate` and `generatedAt`. |
| `cascadeProjections(roomId, fromIndex, bloomDays?)` | For each lot from `fromIndex` to 5: reads the previous lot's harvest event date, calls `reAnchorProjectedLot` with `harvest − cloneCutDays(recipe)`, where the recipe is the previous lot's own `config.recipeId` (falling back to `projectionRecipeId`) — so each hop uses that lot's chain cadence. Passes `bloomDays` through. **Project Crop only** — the Generate button no longer cascades; it uses the room-readiness-gated forward push plan instead (see "Overwrite Push-Back"). |
| `simulatedIrrigationClean(day0, offsets, durations)` | The irrigation-clean date a lot's schedule *would* have, computed from explicit form state without writing events. Mirrors `generateLotSchedule`'s anchor math for `tank_irrigation_clean` (harvest END + offset), with the same harvest-end + 2 fallback when the task is disabled/absent. Pure read. |
| `computeForwardPushPlan(roomId, fromIndex, prevIrr)` | Overwrite push-back plan (see "Overwrite Push-Back"). Pure — reads only, writes nothing. Walks slots `fromIndex..5`: each lot's transplant must land ≥ 1 day after the previous lot's irrigation-clean; earlier lots are pushed by the minimum delta, late-enough lots stay put (absorbing the push), stale/position-less lots are regenerated at the required position. Never pulls a lot backward. Returns a per-slot plan array (`{ index, action: 'push'\|'keep'\|'regen', delta, day0, … }`), or `[]` when no push is needed. Used for both overwrite cases: projected-lot overwrites pass `index+1`; real-lot overwrites pass the first surviving TBA slot index. |
| `newestRealLotId(roomId)` | Returns the lotId of the room's **newest real lot** — the non-projected assigned lot with the latest `createdDate` (ties / missing dates fall back to `assignedLots` order). Returns `null` if the room has no real lots. Pure read — writes nothing. |
| `activeRealLotId(roomId)` | Returns the lotId of the room's **active real lot** — the *last* non-projected lot in `room.assignedLots` (SitkaTools appends new lots to the end, so this is the newest crop that took TBA-1's slot). Distinct from `newestRealLotId`: it is position-based, not date-based, and an older scheduled lot does not count. Gates Reprojection availability and the real-lot overwrite push-back. Returns `null` if the room has no real lots. Pure read — writes nothing. |
| `resolveProjectionAnchor(roomId)` | Resolves the Lot-1 anchor **and** the Project Crop gate from the room's newest real lot (`newestRealLotId`). That specific lot must have a generated schedule (≥1 CLW event) or the result is `null` (gate fails — an older scheduled lot does not count). When it passes, returns `{ lotId, anchorDate }` where `anchorDate` = that lot's `clone_cut` event date, or its start day (`config.plantingDate`) if it has no `clone_cut` event. Pure read — writes nothing. |
| `generateProjectionsForRoom(roomId)` | Validates room exists + `isFlowering`. **Gated:** requires `resolveProjectionAnchor(roomId)` to be non-null (the room's newest real lot has a generated schedule), else explanatory toast naming that lot + no-op. Ensures 5 map entries (keeps existing — never prunes; refreshes `roomName` if renamed). Anchors Lot 1 at the resolved anchor date, then calls `reAnchorProjectedLot(roomId, 1, day0, recipeBloomDays(projRecipe))` and `cascadeProjections(roomId, 2, recipeBloomDays(projRecipe))`, where `projRecipe = getRecipeById(projectionRecipeId)`. Refreshes UI + notifies SitkaTools. |
| `isPendingReprojection(roomId)` | Returns `true` when the room's `{roomId}-TBA-01` map entry is absent AND at least one of TBA-2…TBA-5 is present (see "Reprojection"). Pure inference — reads the map only, writes nothing. |
| `effectiveIrrigationClean(lotId)` | A lot's effective `tank_irrigation_clean` date (the last room-prep task) — read from its events, falling back to harvest end + 2 if the task is missing/disabled; `null` if the lot has no usable anchor. Pure read. |
| `computeReprojectionPushes(roomId, newRealLotId)` | Late-arrival push-back plan (see "Late-Arrival Push-Back"). Pure — reads only, writes nothing. Walks slots 1..4 using the post-rename mapping (slot i holds current TBA-(i+1)): each lot's transplant must land ≥ 1 day after the previous lot's irrigation-clean; earlier lots are pushed by the minimum delta, late-enough lots stay put (absorbing the push), stale/position-less lots are regenerated at the required position. Slot 5 is fresh at slot 4's required transplant − 24. Returns a per-slot plan array (`{ index, action: 'push'\|'keep'\|'regen'\|'fresh', delta, day0, … }`), or `null` if the real lot has no usable irrigation-clean anchor (reprojection then falls back to the plain shift-down). |
| `reprojectRoom(roomId)` | Runs the reprojection algorithm for a pending room. Gate: the room's active real lot (`activeRealLotId` — last non-projected in `room.assignedLots`, i.e. the newest crop that took TBA-1's slot) must have `CropLabourWizard` events — otherwise no-op with an explanatory toast naming that lot. Computes the push-back plan first (`computeReprojectionPushes`); if any push is needed, shows a blocking per-lot `confirm()` — **cancel returns with zero changes**. Then: rename pass low→high (i = 2…5) on map key, `entry.name`, and every matching event's `lotId` **plus the lot-ID token in its stored `title`**; apply each planned shift via `reAnchorProjectedLot(roomId, index, day0)` (no bloom change — uniform delta); ensure a TBA-5 map entry exists and generate it fresh via `generateLotSchedule(projectedLotId(roomId, 5), day0, defaultOffsetsSnapshot(recipeBloomDays(projRecipe), projRecipe), {defaults})` where `day0` = the plan's slot-5 Day 0 (fallback: highest-indexed surviving lot's harvest start − `cloneCutDays(projRecipe)`). Pushed lots keep their per-task offsets verbatim. Refreshes UI + notifies SitkaTools; toast reports how many lots were pushed and by how much. |
| `clearAllProjectionsForRoom(roomId)` | True reset for one room: deletes **all** calendar events where `sourceTool === 'CropProjection' && roomId` **and** removes every `{roomId}-TBA-*` entry from `projectedLots`. The confirmation dialog lives in the UI layer (button handler), not here. Refreshes UI + notifies SitkaTools. |

### Stale Detection

On load and after every DB update, this tool compares `projectedLots` against calendar events: a projected lot with **no** `CropProjection` events is *stale* (its events were deleted or cleared). The tool:

- Flags stale lots in the lot selector with a ⚠️ suffix.
- Never auto-prunes the map — stale entries persist until the user regenerates them via "Project Crop".
- **Pending-reprojection inference:** a room whose TBA-1 entry is absent while at least one of TBA-2…TBA-5 is present is *pending reprojection*. Its surviving lots (which still have events) are displayed with the ⚠️ indicator and included in the stale count — they are "stale" in the sense that they await renumbering, not regeneration. This is display-only inference; no flag is written to the DB.

### Calendar Events — `sourceTool: 'CropProjection'`

Projected lots emit calendar events identical in shape to CropLabourWizard events, but with a distinct source tool so both tools can separate them without ever reading each other's data:

```js
{ date, endDate?, title, sourceTool: 'CropProjection', lotId: 'G1B6-TBA-01', roomId: 'G1B6', taskType }
```

- `roomId` is always present on projection events (real CLW events don't carry it) — this is what SitkaTools uses to delete a room's projections.
- **Title:** Emoji + lot ID + `, task name` (e.g., `"🌸 G1B6-TBA-01, Flip to Flower"`). Unlike real lots, the room code is **not** prepended — the projected lot ID already encodes room + `TBA` + index, so prepending it would repeat the room code twice in the title.
- **ICS export:** projection event summaries get a ` (projected)` suffix; on-screen titles stay clean.

### UI — CropLabourWizard

- **Lot selector:** projected lots appear under their room's divider (after the room's real lots) as `🔮 {roomId}-TBA-0n`; stale ones get a ⚠️ suffix.
- **Projection Recipe dropdown** in the header, to the left of Project Crop (`#projectionRecipeSelect`): lists the built-in recipe (labelled "(built-in)") plus every user recipe; **the built-in is the default**. Selecting one sets `projectionRecipeId`, which drives fresh projection-lot generation and chain cadence only — manual preview editing and per-lot real schedules are untouched. The bloom length now comes from the selected recipe's harvest offset (e.g., 9-week vs 8-week recipes), and because clone cut stays at harvest − `chain.cloneCutBeforeHarvest`, the chain cadence remains correct for either recipe.
- **Task Recipe dropdown** in the form row (`#recipeSelect`) plus **⬆️ Import / ⬇️ Export / ✏️ Manage** buttons: selects the recipe used for the currently selected lot's schedule (persisted as `recipeId` on Generate), imports/exports recipe JSON files, and opens the recipe manager overlay. See "Task Recipes (Recipe Manager)".
- **Project Crop button** in the header, to the left of the Active Lot selector (sized to match the dropdown's height): generates/refreshes the 5-lot chain for the selected room using the currently selected bloom length. Resolves the room from the currently selected lot (projected → its `roomId`; real → `resolveFlowerRoom`). Requires `isFlowering === true`. Never auto-runs on load or when a room flag changes. It is **greyed out (disabled)** whenever the selected lot can't be projected — no lot selected, no resolvable flower room, the room isn't flagged as flowering, **or the room's newest real lot (latest `createdDate`) has no generated schedule** (projections anchor off that specific lot's clone-cut day, so it must be scheduled first; an older scheduled lot does not count) — and its tooltip names the newest lot; it re-enables automatically once that lot is scheduled or the DB updates.
- **Reproject label swap:** when the resolved room is *pending reprojection* (`isPendingReprojection(roomId)`), this same button's label swaps from "🔮 Project Crop" to "🔁 Reproject". It stays disabled — with a tooltip explaining that the room's new lot needs a generated schedule first — until the room's active real lot has `CropLabourWizard` events; it then runs `reprojectRoom(roomId)` instead of `generateProjectionsForRoom(roomId)`.
- **Clear Projections button** in the header, next to Project Crop (sized to match the other header buttons): deletes **all** of the resolved room's projections — every `CropProjection` event for the room **and** all of its map entries (TBA-1…TBA-5) — so the next "Project Crop" starts from a completely fresh chain. A confirmation dialog warns before wiping. Enabled only when the resolved flowering room has at least one projected entry or projection event; disabled otherwise with an explanatory tooltip.
- Selecting a projected lot loads its stored config into the same form; Generate/Clear operate on `CropProjection` events and the map entry's config.
- **Suggested cloning day default:** when a real lot with **no stored schedule** is selected, the suggested cloning day (planting date input) defaults to that lot's `createdDate` instead of today. Lots with a stored schedule still load their saved planting date; projected lots and the no-lot-selected state are unaffected (the date stays as-is).
- **Status bar** shows: flowering rooms, projected lots (with stale count — pending-reprojection lots are included in the stale count) — e.g., `🌸 2 flowering rooms · 🔮 10 projected (3 stale)`.

### Deletion Hook — SitkaTools (for reference)

When a **real lot is created or moved/assigned into a flowering room**, that room's TBA-1 slot is "taken" — the first projected lot no longer represents reality, but the rest of the chain still does. SitkaTools then:

1. Deletes the map entry `{roomId}-TBA-01` from `_CropLabourWizard.projectedLots` (the one permitted exception to this tool's ownership of the map).
2. Deletes calendar events where `sourceTool === 'CropProjection' && lotId === "{roomId}-TBA-01"`.
3. **Leaves TBA-2…TBA-5 untouched** — both their map entries and their calendar events survive. The room is now *pending reprojection* (see "Reprojection").
4. Notes in the confirmation alert that the room's TBA-01 projection was removed and the room is flagged for reprojection — run **Reproject** in this tool after generating a schedule for the new lot.

The hook is **idempotent**: if the room has no TBA-1 entry (or no projections at all), it is a no-op. No tool auto-regenerates or auto-reprojects — both are manual actions in this tool.

## BC Civic Holidays

This tool must be aware of British Columbia's **11 civic (statutory) holidays**. The canonical spec lives in the root `Agent.MD` ("BC Civic Holidays"); the full rules are reproduced below so this tool can be implemented from its own directory alone. Every holiday date is a pure function of its year — no external data, no network calls.

### Calculation Helpers

All date math must use **local-time** `Date` constructors (`new Date(y, m, d)`) — never UTC variants — to avoid off-by-one-day errors from time zones. Month indices are 0-based (`0`=Jan … `11`=Dec); weekday numbers follow `Date.getDay()` (`0`=Sun … `6`=Sat).

```js
// Add/subtract days (returns a new Date)
function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Nth occurrence of a weekday in a month (n is 1-based)
function nthWeekday(y, m, weekday, n) {
    const first = new Date(y, m, 1).getDay();
    return new Date(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
}

// Victoria Day — the last Monday strictly before May 25 (per BC ESA).
// Start from May 24 and walk back to the previous Monday.
function victoriaDay(y) {
    const d = new Date(y, 4, 24);
    while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
    return d;
}

// Observed-date shift — applies ONLY to fixed-date holidays:
// if the nominal date falls on Saturday or Sunday, the holiday is observed on the following Monday.
function observed(d) {
    const dow = d.getDay();
    if (dow === 6) return addDays(d, 2); // Sat → Mon
    if (dow === 0) return addDays(d, 1); // Sun → Mon
    return d;
}

// Easter Sunday — Gregorian computus (Anonymous / Meeus–Jones–Butcher algorithm)
function easterSunday(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
    return new Date(y, month - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
```

### The 11 Holidays and Their Rules

| # | Holiday | Rule | Calculation (JS) |
|---|---------|------|------------------|
| 1 | New Year's Day | Jan 1; observed on the following Monday if it falls on a weekend | `observed(new Date(y, 0, 1))` |
| 2 | Family Day | Third Monday in February | `nthWeekday(y, 1, 1, 3)` |
| 3 | Good Friday | Two days before Easter Sunday | `addDays(easterSunday(y), -2)` |
| 4 | Victoria Day | Last Monday strictly before May 25 | `victoriaDay(y)` |
| 5 | Canada Day | Jul 1; observed on the following Monday if it falls on a weekend | `observed(new Date(y, 6, 1))` |
| 6 | BC Day (Civic Holiday) | First Monday in August | `nthWeekday(y, 7, 1, 1)` |
| 7 | Labour Day | First Monday in September | `nthWeekday(y, 8, 1, 1)` |
| 8 | National Day for Truth and Reconciliation | Sep 30; observed on the following Monday if it falls on a weekend | `observed(new Date(y, 8, 30))` |
| 9 | Thanksgiving | Second Monday in October | `nthWeekday(y, 9, 1, 2)` |
| 10 | Remembrance Day | Nov 11; observed on the following Monday if it falls on a weekend | `observed(new Date(y, 10, 11))` |
| 11 | Christmas Day | Dec 25; observed on the following Monday if it falls on a weekend | `observed(new Date(y, 11, 25))` |

**Rules & edge cases:**
- BC does **not** observe Easter Sunday, Easter Monday, or Boxing Day (Dec 26) — per the BC government, these are not statutory holidays.
- Weekday-anchored holidays never need an observed-date shift: Family Day, Victoria Day, BC Day, Labour Day, and Thanksgiving are always Mondays; Good Friday is always a Friday. Only the five fixed-date holidays (New Year's Day, Canada Day, Truth & Reconciliation, Remembrance Day, Christmas Day) can shift to the following Monday.
- When a holiday shifts to its observed date, use the **observed** date for calendar display and for holiday checks — that is the day off.
- Holiday checks are always performed against the year of the event date being checked.

### Verification Table — Known Dates

Any implementation must reproduce this table exactly:

| Holiday | 2026 | 2027 |
|---------|------|------|
| New Year's Day | Jan 1 (Thu) | Jan 1 (Fri) |
| Family Day | Feb 16 (Mon) | Feb 15 (Mon) |
| Good Friday | Apr 3 (Fri) | Mar 26 (Fri) |
| Victoria Day | May 18 (Mon) | May 24 (Mon) |
| Canada Day | Jul 1 (Wed) | Jul 1 (Thu) |
| BC Day | Aug 3 (Mon) | Aug 2 (Mon) |
| Labour Day | Sep 7 (Mon) | Sep 6 (Mon) |
| Truth & Reconciliation | Sep 30 (Wed) | Sep 30 (Thu) |
| Thanksgiving | Oct 12 (Mon) | Oct 11 (Mon) |
| Christmas Day | Dec 25 (Fri) | **Dec 27 (Mon)** — observed; Dec 25 falls on a Saturday |
Remembrance Day | Nov 11 (Wed) | Nov 11 (Thu) |
| 
### Holiday-Awareness Behavior for CropLabourWizard

CropLabourWizard is holiday-aware in three places, all computed live from the year (no stored data):

1. **Task preview:** Each task row shows a small amber "🏛️ Holiday" chip next to its computed date when any day of the task falls on an observed BC civic holiday (multi-day tasks like Trim are checked across their full `[date, endDate]` range). The chip's tooltip names the holiday and, for shifted fixed-date holidays, notes the nominal date. Each row also shows the weekday next to its computed date — single-day tasks as `YYYY-MM-DD · Ddd` (e.g., `2026-09-15 · Tue`), multi-day tasks as `start (Ddd) → end (Ddd)` (e.g., `2026-12-17 (Thu) → 2026-12-23 (Wed)`). The saved schedule list and the config summary's anchor date use the same format.
2. **Conflict banner:** When one or more tasks land on a holiday, a warning banner below the preview list enumerates each affected task with its date and holiday (e.g., "🌾 Harvest — 2026-12-25 falls on Christmas Day").
3. **Generate toast:** After generating a schedule, the confirmation toast appends "· ⚠️ N on a BC civic holiday" when any generated event conflicts.

The saved schedule list also shows the flag chip next to each task's date. The tool does **not** auto-reschedule or skip tasks — it only notifies. Holiday checks always use the observed date and the year of the task date being checked. The SitkaTools calendar renders the holidays themselves as if they were events.

## Relationship to SitkaTools

This tool is part of the SitkaGit suite. It operates as a standalone single-file HTML application with no communication to other tools. All shared state flows through the common JSON database file (`DB-YY-MM-DD.json`).

### How Data Fits Into the Database

CropLabourWizard reads and writes its own keys within the shared database, following the suite's decoupled convention:

**Per-lot data** (inside `lots.<LotID>`):
```
_tool_CropLabourWizard: { ... }
```
Stores the lot's schedule configuration: anchor date, task count, trim length (user-selectable, default 7), harvest multi-day settings (`harvestMultiDay`, `harvestDays` — default 2 when checked), and **`recipeId`** — the id of the recipe used at generation time. Lots without a `recipeId` (or with one that no longer resolves) fall back to the built-in `sitka-9week`. This lets the tool re-render its UI from stored state and detect stale schedules during reconciliation.

**Top-level data** (root of database):
```
_CropLabourWizard: {
    generations: [ /* generation log — real lots only */ ],
    projectedLots: { /* source of truth for projected lots — see "Crop Projection" section */ },
    recipes: { /* id → recipe object — user-created/imported recipes ONLY; built-in stays in code */ },
    taskTypes: { /* taskType → { name, emoji, roomPhase? } registry — backfilled + merged on save/import */ }
}
```
Tool-wide metadata. `generations[]` is a log of schedule generations for audit purposes (real lots only). `projectedLots` is the **source of truth** for projected lots (owned by this tool; SitkaTools never reads or modifies it, with the sole exception of deleting the `{roomId}-TBA-01` entry in its deletion hook — see "Crop Projection" section below). `recipes` and `taskTypes` are documented in "Task Recipes (Recipe Manager)" above.

**Calendar events:**
When the user generates a schedule, CropLabourWizard first purges all existing `CropLabourWizard` events for that lot from `calendarEvents`, then appends the new batch. Each event records `sourceTool: "CropLabourWizard"` and `lotId`. The main SitkaTools calendar view will render these alongside events from all other tools.

### Full Database Context

For reference, the complete database structure is defined in the root `Agent.MD`. Key points:
- Database file naming: `DB-YY-MM-DD.json`
- File I/O is user-managed via import (`<input type="file">`) and export (`URL.createObjectURL` + download)
- Tools never communicate with each other — only through the JSON file on disk
- Dates in data use ISO format (`YYYY-MM-DD`); filenames use 2-digit year (`YY`)

### Database Import on Open — postMessage Convention

CropLabourWizard receives its database from SitkaTools via `postMessage`, following the convention defined in the root `Agent.MD`.

**How it works:**
1. When SitkaTools.html launches CropLabourWizard, it opens the subtool in a new window then sends the current DB via `postMessage` with type `sitkaGit_db`.
2. On page load, CropLabourWizard listens for this message — no overlay, no file dialog, no manual import step.
3. After receiving the DB, CropLabourWizard acknowledges with `{ type: 'sitkaGit_ready' }` so SitkaTools stops retrying.
4. After every mutation (generate schedule / delete schedule), CropLabourWizard calls `notifySitkaTools()` which sends the updated DB back via `postMessage` with type `sitkaGit_db_update`.
5. The main app auto-refreshes all views and shows a toast notification that auto-dismisses after 3 seconds.
6. On init, CropLabourWizard calls `populateLotSelector()` to fill the Active Lot dropdown from `DB.lots` and projected lots, then renders any existing schedules from `_tool_CropLabourWizard` and `projectedLots`.
7. CropLabourWizard also receives **live** `sitkaGit_db_update` pushes from SitkaTools (e.g., when SitkaTools deletes a room's projection events after a real lot is created or moved in). This handler is **non-disruptive**: it refreshes the lot selector, schedule list, status bar, and generate button label without rebuilding offsets or showing a toast — so active form/preview editing is not interrupted.

**Implementation:**
```js
// ---- postMessage Convention — receive DB from SitkaTools, send updates back ----
DB.ensureStructure();

// Notify SitkaTools of changes via postMessage
function notifySitkaTools() {
    if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
            type: 'sitkaGit_db_update',
            payload: DB.data
        }, '*');
    }
}

// Listen for DB from SitkaTools via postMessage
window.addEventListener('message', (e) => {
    if (e.data?.type === 'sitkaGit_db' && e.data.payload) {
        DB.data = e.data.payload;
        DB.ensureStructure();

        // Acknowledge receipt so SitkaTools stops retrying
        if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'sitkaGit_ready' }, '*');
        }

        // Reconcile and render with fresh data
        buildDefaultOffsets();
        populateLotSelector();
        renderScheduleList();
        updateStatusBar();
        refreshPreview();
        updateGenerateBtnLabel();
        showToast('Database loaded from SitkaTools');
    }

    // Live DB updates (e.g., projection events deleted in SitkaTools) —
    // non-disruptive: refreshes selector/list/status without rebuilding offsets.
    if (e.data?.type === 'sitkaGit_db_update' && e.data.payload) {
        DB.data = e.data.payload;
        DB.ensureStructure();
        populateLotSelector();
        renderScheduleList();
        updateStatusBar();
        updateGenerateBtnLabel();
    }
});

// After every mutation:
notifySitkaTools();
```

This tool uses **no localStorage, sessionStorage, IndexedDB, cookies, or any browser storage APIs**. All cross-window state flows through postMessage.

## UI Convention

This tool follows the shared UI Standards defined in the root `Agent.MD`. Key specifics for this tool:

- **Selector type:** Active Lot (lot-focused tool — labour hours are tracked per lot)
- **Popup size:** Opens from SitkaTools.html at half the main app's viewport width and 83% of the viewport height
- **Header:** Tool name "👷 Crop Labour Wizard" on the left, Active Lot dropdown on the right
- **Footer:** Close Tool button only (no Save DB — changes auto-sync to SitkaTools via postMessage)
- **Theme:** Uses shared CSS custom properties from root UI Standards

### Weekday Display & Clickable Date Picker

**Weekday display:** Every computed date in the tool shows its weekday, derived locally via `Date.getDay()` (never UTC). Single-day dates render as `YYYY-MM-DD · Ddd` (e.g., `2026-09-15 · Tue`); multi-day ranges render as `start (Ddd) → end (Ddd)` (e.g., `2026-12-17 (Thu) → 2026-12-23 (Wed)`). This appears in the task preview, the saved schedule list, and the config summary's anchor date.

**Clickable date picker:** In the task preview, each editable task's computed-date badge is a button. Clicking it opens a custom popup calendar anchored to the badge (flips above the badge near the bottom edge of the viewport). The picker:
- Shows a month grid (Su–Sa columns) with ‹/› month navigation and a "Today" shortcut.
- Highlights the task's current date (accent fill), today (inset accent ring), and observed BC civic holidays (amber dot under the day, with a tooltip naming the holiday).
- On day selection, closes and adjusts that task's **day offset by the delta** between the old and new dates — identical cascade semantics to the +/− spinbox (same min/max clamping: 0–200, or −30–200 for tasks with negative defaults). For multi-day tasks (Trim), the picked day becomes the new trim **start**; the 7-day span and all downstream trim-anchored tasks shift by the same delta.
- Closes on outside click or Escape. A single shared popup element (`#datePickerPopup`) is reused for every row — no per-row popups.

Locked tasks (Cutting Clones, Cut Clones to Replace Lot — derived/locked at harvest start − 21 days, and Planting Clones when clones are disabled) and disabled tasks render a non-clickable date badge instead.

### Header Pattern

```html
<header class="header">
    <div class="header-left">
        <span class="logo">👷 Crop Labour Wizard</span>
    </div>
    <div class="header-right">
        <div class="form-group">
            <label for="activeLot">Active Lot</label>
            <select id="activeLot">
                <option value="">— Select a lot —</option>
            </select>
        </div>
    </div>
</header>
```

### Footer Pattern

Identical to all other subtools:

```html
<footer class="footer">
    <button class="btn btn-secondary" id="closeToolBtn">Close Tool</button>
</footer>
```

```css
.footer {
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: sticky;
    bottom: 0;
    z-index: 100;
}
```

### Toast Pattern

Identical to GeneralEvent — centered bottom toast with accent border, auto-dismisses after 2.5 seconds:

```html
<div class="toast" id="toast"></div>
```

```css
.toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: var(--bg-card);
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 10px 24px;
    border-radius: var(--radius);
    font-size: 0.9rem;
    font-weight: 600;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s ease;
    z-index: 300;
}

.toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}
```

### Status Bar Pattern

Identical to GeneralEvent — top card showing database load status and event counts:

```html
<div class="status-bar" id="statusBar">
    <span id="statusText">No database loaded. Import a DB file or open from SitkaTools.</span>
</div>
```

```css
.status-bar {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 10px 16px;
    margin-bottom: 20px;
    font-size: 0.85rem;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.status-bar.loaded { border-color: var(--accent); }
```

## Constraints

- Single `.html` file, no build step, no external dependencies
- Runs in browser sandbox (`file://` protocol)
- Vanilla HTML/CSS/JavaScript only
- No network calls of any kind
- No localStorage, sessionStorage, IndexedDB, or cookies — all cross-window state via postMessage
