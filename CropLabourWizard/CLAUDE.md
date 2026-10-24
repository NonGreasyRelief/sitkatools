# CropLabourWizard — Tool Context

Crop schedule calculator. Pick a lot, set its anchor date, adjust day offsets and durations in the preview, and **Generate** writes every cultivation task for the lot as calendar events. It schedules bloom crops and, with a 🌿 vegetative recipe, mother plants ("🌿 Vegetative Recipes — Mother Lots"). It also plans **projected lots** (5 placeholder crops per flowering room) so labour can be planned months ahead. Office only.

## Schedule

### Day 0, Offsets and Cascade

- The task list is the active recipe's `tasks[]` (`activeRecipe.tasks`). The preview shows one row per task in array order (top → bottom = chronological). The three built-in recipes (32 tasks each, see "Room Turnaround") live in code and are never written to the DB. The default, `sitka-9week`, is the fallback for any lot whose `recipeId` is missing or no longer resolves.
- **Day 0:** with Cutting Clones (`clone_cut_prep`) on, the top date is the cloning date and Planting is Day 0 + 14 (editable). With it off, Cutting Clones is hidden and the planting date is Day 0.
- A task's date = its `reference` anchor (`cloning` / `planting` / `flip` / `harvest` / `trim`) + its offset. Changing an anchor's offset moves every task that references it by the same delta:
  - **Flip** → flip-relative tasks (trellis, leaf picks, flower IPM sprays, Harvest), and through Harvest everything after it.
  - **Harvest** → post-harvest tasks (Grow-Room Clean, Tank & Irrigation Clean, Tote Prep, Bucking, Lab Sample, Prepare Trim Room, Trim) and Clone Cut.
  - **Trim** → Machine Trim Smalls, Clean Dry Room, Weigh & Ship.
- **Clone Cut** ("Cut Clones to Replace Lot", `clone_cut`) counts back from harvest **end** (default built-in −27), so it follows the bloom and harvest length. See "Room Turnaround".
- **Offset range** (spinbox and date picker alike, `offsetMin`): 0–200; −30–200 for a task with a negative default; −200–200 for the clone cut.
- **IPM sprays:** the four 🧴 preventative sprays are toggleable and off by default (`hasToggle: true`, `defaultEnabled: false`). When on they behave like any task. The two flower sprays are flip-relative, so they move with flip edits and projection bloom changes. When a stored schedule loads, a toggleable task missing from the lot's events shows unchecked.
- **Reloading a lot** reads each task's offset back from its event (`applyStoredScheduleToOffsets`), so generated dates never move on their own.
- **Suggested cloning day:** a real lot with no stored schedule defaults the date to its `createdDate`. A lot with a schedule loads its saved Day 0.

### 🌿 Vegetative Recipes — Mother Lots

User decision 2026-10-23. A recipe with `kind: 'vegetative'` is for mother plants. It's the only mother "flag": a lot scheduled with one is a **mother lot** (its config gets `kind: 'vegetative'`, so other tools needn't look the recipe up, and it stays a mother lot if the recipe is deleted). Nothing is flagged on lots or rooms.

- **Set up like a bloom recipe** (anchors and day offsets), with no flip, harvest or trim. The anchors are `cloning` (Day 0), `planting` and `retire`.
- **Retire Mothers** (`retire`, mandatory) is the planned end of the mothers' life, from planting (default 180 days; up to 1,095). Repeats stop there.
- **Cut Clones to Replace Mothers** (`clone_cut`, optional) counts back from `retire` and is the next mother lot's Day 0. Mothers can also come from another lot's extra clones, created in the Lot Manager as a sub-lot, with no task.
- **Rooms:** as for a bloom crop: before Transplanting in the cloning / veg room, Transplanting and after in the lot's **destination room**, which for a mother lot is its Mother room (`destRoom`). A mother lot with no destination room keeps those tasks in its veg room.
- **No room-ready rule:** new mothers move in without a room clean, so Generate never pushes anything back for a mother lot, and the recipe editor shows a 🌿 Mothers readout instead of the room turnaround.
- **🌿 New Mother Recipe** (recipe manager) starts from a template: Cutting Clones, Planting, Clean Clone Room, Transplanting to Mother Room, Prune Mothers (every 14 days), Top-dress Mothers (every 28), Cut Clones to Replace Mothers (retire −28), Retire Mothers (planting +180). The type is fixed at creation; Duplicate keeps it.
- The recipe dropdown shows them as 🌿; the Projection Recipe dropdown leaves them out (flowering rooms project bloom crops).

### Repeating Tasks — Every N Days

User decision 2026-10-23. Any recipe task may repeat every N days (`every`, 1–365, editor column **Every**, blank = once), from its own date until the crop's end: Retire Mothers in a vegetative recipe, Harvest in a bloom recipe.

- Each repeat is its own event, `repeat: 1, 2, …`, titled "Prune Mothers (3/11)", so hours and sign-off are per repeat. There is always at least one.
- Anchor tasks, the transplant and the clone cuts never repeat (`NO_REPEAT_TASKS`). A task's `days` can't exceed its `every`.
- **Preview:** "↻ every 14 days · 11× to 2027-02-22"; the estimated labour counts every repeat. Reopening a lot reads the task's offset from its first repeat.
- **Regenerating** matches annotations by task type **and** repeat (`annotationKey`), and asks before dropping a repeat that holds work (a shorter life, a longer interval).
- One builder (`scheduleOccurrences`) gives every dated occurrence; Generate, the lost-work check and the preview all use it.

### Multi-Day Tasks

- **Trim:** 1–30 days in the preview (default 7, `DEFAULT_TRIM_DAYS`).
- **Harvest:** a "Multi-day" checkbox (default 2 days). When on, harvest-referenced tasks measure from harvest **end**.
- **Any other task:** the recipe task's `days` (1–30, blank = 1; recipe editor **Days** column, `recipeTaskDays`). Set by the recipe, not per lot. The built-in recipes run both leaf picks for 2 days: Early Flower Leaf Pick on bloom days 17–18 (flip +17) and Late on days 39–40 (flip +39), counting flip day as day 0; no task references them. Trim and Harvest ignore `days` (their Days cell is disabled).
- **Post-trim offsets** are stored relative to a 7-day trim. `resolveTaskAnchor()` adds `trimDays − DEFAULT_TRIM_DAYS` to the `trim` anchor, so a task at +7/+8 always lands 1–2 days after trim ends, whatever the trim length.

### Room Turnaround — the Next Lot in the Room

`clone_cut` is the day the next lot's clones are cut, counted back from harvest end. In the recipe it sets when the next lot is planted and moved into the flower room, and how long each cycle is.

- **The task:** an ordinary task, reference fixed to `harvest` in the recipe editor. In the preview it can be moved per lot (spinbox or date picker, down to −200). The move is kept on the lot's event (the floor's task and the readout below follow it), but projections don't: the next projected lot always counts back from this lot's last harvest day ("Projection Chain", user decision 2026-10-24).
- **Readout** (`nextLotTurnaround` → `turnaroundHtml`):
  - In the recipe editor, from the task table as it stands, with a single-day harvest (`recipeTurnaround`). In the preview, a box below the list from the lot's own dates (says "harvest ends" when harvest is multi-day). Both assume the next lot follows the same recipe (its planting and transplant days from `freshLotDay0Offsets`).
  - Shows clones cut / planted / transplanted in days from harvest, and where the transplant lands: ✅ the day after Tank & Irrigation Clean (as tight as the room allows), 🕒 room empty N days, or ⚠️ room not ready, N days short. Plus "A new lot every N days" (Day 0 to clone cut; hidden when clones are off).
  - The room is ready the day after Tank & Irrigation Clean (fallback: harvest end + 2) — the same rule as every push-back.
  - An edit that changes the readout shows a one-line toast (`turnaroundToast`). Opening the editor or switching lot / recipe doesn't.
- **Built-ins** (Sitka Standard, 9-week bloom, user decision 2026-10-23): one recipe per clone-cut day, so every room harvests on a Friday, the next lot transplants the Monday after (✅ the day after Tank & Irrigation Clean) and flips that Friday. A new lot every 70 days (10 weeks), so the weekdays never drift.

  | Recipe (id) | Veg (planting → flip) | Clone cut | Next lot planted | Transplant |
  |---|---|---|---|---|
  | 20-day veg, Saturday cuts (`sitka-9week`, **default**) | 20 | harvest −27 | harvest −13 | planting +16 |
  | 19-day veg, Sunday cuts (`sitka-9week-19veg`) | 19 | −26 | −12 | +15 |
  | 18-day veg, Monday cuts (`sitka-9week-18veg`) | 18 | −25 | −11 | +14 |

  - Only the days set by the veg length differ (`sitkaStandardRecipe(id, name, veg)` builds all three). Flower-room prep (coco layout, hydrate, undercanopy lights) is the day before transplant (the Sunday). The second veg IPM spray, veg room clean and Deploy IPM are the day after (the Tuesday). Prune is on flip day.
  - The default keeps the old built-in's id. Lots generated with the old 76-day built-in keep their dates (Generate rebuilds from their own events), their "Cut Clones to Replace Lot" included: 21 days before harvest end, or before the harvest's **first** day for lots generated before the clone cut counted from harvest end. Their projections take the new cadence when Project Crop runs again (Reproject never pulls a lot earlier); they count from the lot's last harvest day, not from that old clone cut. To bring a lot's own clone cut in line, move it to −27 in the preview and Generate.
- **Saving** a recipe whose next lot would move in before the room is ready is allowed after a confirm, which explains that Project Crop, overwrites and Reproject will push the next lots back.

### Calendar Events Generated

`sourceTool: 'CropLabourWizard'`. The event contract (`roomPhase`, `estStaff`, `estMinutes`) is in root `CLAUDE.md`.

- `date`; `endDate` only on multi-day tasks (Trim, multi-day Harvest, recipe `days` > 1); `lotId` always; `taskType` (reconciliation and carry-over key on it); `id`; `roomPhase` only when the recipe task has one; `estStaff` / `estMinutes` only when the task has an estimate (see "Labour Estimates").
- **Title:** `<emoji> <Room>-<Strain>#<LotId>, <task name>` (e.g. `🌸 B66DG1-Purple Haze#LOT-001, Flip to Flower`); a repeat adds ` (3/11)` and carries `repeat`. A missing room or strain is dropped (`Room#Lot`, `Strain#Lot`, `Lot`). Projected lots use `<emoji> <lotId>, <task name>` (`buildEventTitle`).
- **Room per task** (`getLotRoomCode`; room names on the lot are resolved to IDs by `rooms.<id>.name`). First match wins:
  1. the recipe task's `roomPhase` (cloning → `lot.cloningRoom`, veg → `lot.vegRoom`, flower → flower room);
  2. `clone_cut_prep`, `clone_room_clean` → cloning room;
  3. `veg_room_clean` → veg room (it happens after transplant);
  4. `layout_coco_blocks`, `hydrate_coco_blocks`, `undercanopy_lights` → flower room (listed before transplant for display order only);
  5. any task before `transplant` in the array → veg room. The second veg IPM spray sits after transplant, so it resolves to the flower room;
  6. everything else → flower room: the room whose `assignedLots` holds the lot, else the room named `lot.destRoom` (`resolveFlowerRoom`).

### Schedule Reconciliation

- **Generate** removes all of the lot's own events (`reconcileLotSchedule`: `sourceTool` + `lotId`; `CropProjection` for projected lots), inserts the new batch, saves the config (`setScheduleConfig`) and, for real lots only, appends to `_CropLabourWizard.generations[]`.
- **Annotations carry over** by `taskType` (`carryOverAnnotations`; fields listed in root `CLAUDE.md` → "Event Annotations Survive Regeneration").
- A task with work records (`completed` or labour hours) that the new schedule no longer has (disabled, or not in a different recipe) triggers a blocking confirm listing them. Cancel = no changes.
- **Clear Schedule** asks first when any of the lot's events hold work records; **✕ Delete Schedule**'s confirm says how many do. Both drop the lot's `generations[]` entries. Clearing a projected lot deletes only its `.config` (`clearScheduleConfig`), so it stays in the map as stale.

### Labour Estimates

Recipe tasks may carry `minutes` (per day) and `staff`, like DailyWizard tasks. The built-in recipes have none; duplicate one to add them.

- **Recipe editor:** **Min** (minutes per day, step 5; blank = no estimate) and **Staff** (blank = 1) columns.
- **Preview:** `👥 2 · ⏱ 1h 30m` after the offset line (`/day` on multi-day tasks). Below the list, `⏱ Estimated labour: ≈ N h` totals the enabled tasks (multi-day tasks over all their days) and says how many have no estimate.
- **Saved schedule:** the same chip next to the type badge; the summary row adds `⏱ Est. labour: ≈ N h`. The recipe list shows `⏱ N with labour estimates`.
- **Events** get `estStaff` / `estMinutes` from the recipe (`applyEstimate`). They are **not** carried over by `carryOverAnnotations`: Generate always writes the current recipe's values, and `reAnchorProjectedLot`'s shift path refreshes them, so Project Crop updates projections.
- DailyWizard, the SitkaTools calendar tooltip and EmployeeWizard read the estimate from the events.

## Task Recipes (Recipe Manager)

The task list comes from **recipes**. The three built-ins stay in code. User recipes are created, edited, duplicated, imported, exported and deleted here and stored in `_CropLabourWizard.recipes`. Other tools' rules for task types (stable ids, order vs `transplant`, unknown-type fallback) are in root `CLAUDE.md`.

### Recipe Format

`{ id, name, version, kind?, chain: { cloneCutBeforeHarvest }, tasks: [...], inputs?: [...] }`

- **`kind`:** `'vegetative'` for a mother recipe (see "🌿 Vegetative Recipes"); absent for a bloom recipe.

- **`id`:** the built-ins are `sitka-9week` (default), `sitka-9week-19veg` and `sitka-9week-18veg`. New recipes get 6 chars from `CODE_ALPHABET` (`abcdefghjkmnpqrstuvwxyz23456789`), collision-checked against the built-ins and DB recipes. An imported file carrying a built-in's id (an exported built-in) is saved under a new id, so the built-in doesn't hide it.
- **`version`:** integer, for forward compatibility.
- **`chain.cloneCutBeforeHarvest`:** kept only for older copies of the tool. The `clone_cut` task is the source of truth; `syncChainFromCloneCut` writes this number from it on every save. A recipe with no `clone_cut` task uses this number (default 21, `cloneCutDays`).
- **`tasks[]`** — array order is load-bearing (display order and the pre/post-transplant room split). Each task:

| Field | Meaning |
|---|---|
| `taskType` | unique `snake_case` id; other tools key on it |
| `name`, `emoji` | label and icon |
| `reference` | bloom: `cloning` / `planting` / `flip` / `harvest` / `trim`; vegetative: `cloning` / `planting` / `retire`. The anchor task must exist (`cloning` is always Day 0) |
| `defaultOffset` | integer days from the reference; import and save clamp it to −30…+365 (the clone cut −200…+365) and say so in the toast (`clampRecipeOffsets`) |
| `hasToggle`, `defaultEnabled` | optional: can be switched off in the preview; initial state |
| `isLocked` | optional: not user-editable (Cutting Clones at Day 0) |
| `days` | optional length, 1–30 (see "Multi-Day Tasks") |
| `every` | optional: repeat every N days, 1–365 (see "Repeating Tasks") |
| `roomPhase` | optional `cloning` / `veg` / `flower`; written onto events, overrides the order-based room split |
| `minutes`, `staff` | optional labour estimate per day (see "Labour Estimates") |

- **`inputs`** (recipe level, optional): supplies a crop uses — `[{ inputId, name, unit, qty, per: 'crop' | 'plant', at? }]`; `at` (per plant only) is one of the recipe's task types (see "🧪 Inputs").
- **Old recipes:** `normalizeCloneCut` converts a `clone_cut` that doesn't reference `harvest` to `reference: 'harvest'`, offset −`chain.cloneCutBeforeHarvest` (default 21), unlocked, so every date stays put. It runs on load (`ensureStructure`), on import and in the editor.

### Validation Rules

`validateRecipe()` runs on both import and in-editor save; a failing recipe is rejected with a list of errors.

- `id` (letters, digits, `-`, `_`) and `name` are required; each task needs a `name` and `emoji`.
- Bloom: `planting`, `flip` and `harvest` tasks must exist; `trim` is optional, but required if any task references it; no `retire` task. Vegetative: `planting` and `retire` must exist; no `flip`, `harvest` or `trim`. `kind`, when present, is `vegetative`.
- Every `reference` is a known anchor whose task exists (`cloning` always exists).
- `taskType` non-empty, `snake_case`, unique.
- `defaultOffset` an integer (clamped first, see the table above).
- `clone_cut` must reference `harvest` (bloom) or `retire` (vegetative).
- `every`, when present, an integer 1–365, not on an anchor task, the transplant or a clone cut, and not less than the task's `days`.
- `roomPhase`, when present, is `cloning` / `veg` / `flower`.
- `minutes` an integer ≥ 5, `staff` an integer ≥ 1, `days` an integer 1–30 (all optional).
- `chain.cloneCutBeforeHarvest`, when present, a positive integer.
- `inputs`, when present, an array; each entry has a name, a qty ≥ 0, and `per` of `crop` or `plant`; an `at` must be a task type of this recipe, on a per-plant entry.

### Recipe Selection — Per-Lot `recipeId`

- The **Task Recipe** dropdown (`#recipeSelect`, form row) lists the three built-ins ("(built-in)", the default first) plus every user recipe. Selecting a lot syncs it to the lot's stored `recipeId` (`syncActiveRecipeToLot`); an unknown id falls back to the default built-in (`getRecipeById`).
- **Generate** stores the selected recipe's id as `recipeId` in the lot's config.
- The header's **Projection Recipe** dropdown (`#projectionRecipeSelect`) is separate — see "Projection Chain".

### Import / Export

Both buttons are in the recipe manager's list view, next to `＋ New Recipe`.

- **⬆️ Import** (`#recipeImportInput` file picker): parse, `validateRecipe`, reject with the error list. An existing id asks before replacing. On success: store, merge the task-type registry, select the recipe, rebuild the preview from its defaults, refresh the manager list.
- **⬇️ Export:** the selected recipe as pretty-printed JSON (share API first, else `URL.createObjectURL` + `<a download>`).
- File name: **`recipe-<id>.json`**.
- **Never auto-load** sibling `.json` files (no `fetch()`; blocked under `file://` anyway). Import only through the explicit file picker.

### ✏️ Manage — Recipe Manager Overlay

**✏️ Manage** (`#manageRecipesBtn`) opens `#recipeManagerOverlay`:

- **List view:** `＋ New Recipe` (a copy of the default built-in with a fresh id), ⬆️ Import, ⬇️ Export, then one row per recipe. Built-in rows: **Duplicate / Export**. User rows: **Edit / Duplicate / Export / Delete**. Clicking a row selects that recipe and closes the overlay.
- **Editor view:** name, read-only id, two tabs:
  - **🗓️ Tasks:** the Room turnaround readout and the task table (emoji, name, type, reference, offset, days, room phase, minutes, staff, toggleable, on by default, locked; move up/down, delete, `＋ Add Task`).
  - **🧪 Inputs:** see below.
  - **DOM-sync rule:** before any re-render that changes rows, the tables are read back into the working copy (`readTaskTable()` for tasks) so typed values aren't lost. A change updates the hints in place, so tabbing through a row keeps focus.
- **Save Recipe** re-runs validation, writes the recipe (and the price list) to the DB, merges the task-type registry and notifies SitkaTools. **Cancel** drops both.
- **Delete:** a recipe in use warns with the lot count (`1 lot(s) currently use it — they'll fall back to the built-in recipe.`). Lots with a dangling `recipeId` resolve to the default built-in. If it was the projection recipe, `projectionRecipeId` resets to the default built-in.

### 🧪 Inputs — Price List and Recipe Supplies

- **Price list, shared by every recipe:** `_CropLabourWizard.inputs[id] = { name, kind: 'fertilizer' | 'supply', unit, price }`.
  - A fertilizer is priced per litre (unit fixed to `L`). Its mL come from the grow logs, where PaperWizard links each mL question to a product **by the same name**.
  - A supply is priced per unit and used up per crop (coco block, peat puck, trellis ft…).
  - ＋ Add Input; ✕ deletes. Deleting an input other recipes use asks first, listing them, and removes it from those recipes on save. Names must be filled in and unique (checked on save).
- **Supplies this recipe uses:** `recipe.inputs` — a supply, quantity, **Per** and the cost it comes to. Name and unit travel with `recipe-<id>.json`.
  - **Per:** per crop; per plant at the start (the plants started); or **per plant at <task>**, one option per task of the recipe (value `plant@<taskType>`, stored as `per: 'plant', at: <taskType>`; user decision 2026-10-22). The Reports count the plants the grow log recorded on that task's calendar day (the lowest of the day), so plants culled before it aren't charged: clone cubes at ✂️ Cutting Clones, 4″ rockwool at 🌱 Planting Clones (the up-pot), coco blocks at 🪴 Transplanting. A lot whose schedule doesn't have the task (Cutting Clones off for bought clones) isn't charged for it; a bought clone is a per-plant supply in that lot's recipe.
  - The cost column reads e.g. "≈ $2.00 per plant at 🪴 Transplanting to Flower Room". An entry whose task is no longer in the recipe shows "(not in this recipe)" and fails validation on save.
- **Import** matches each supply to the price list by name (case-insensitive) and adds unknown ones without a price.
- The Labour & Cost Wizard's Reports price each crop's supplies from its lot's recipe (`_tool_CropLabourWizard.recipeId`).

### Task-Type Registry

`_CropLabourWizard.taskTypes` = `taskType → { name, emoji, roomPhase? }`, so other tools can label custom task types. `ensureStructure()` seeds it with the 32 built-in types; every recipe save or import upserts its tasks (`mergeTaskTypeRegistry()`).

## Crop Projection (Projected Lots)

Projected lots are placeholder future crops in flowering rooms (`rooms.<id>.isFlowering === true`, set in SitkaTools' Room Manager; only this tool reads the flag), and the next mother lots in rooms designated **Mother** ("🌿 Mother Rooms" below). They are never in `DB.lots` and never shown in SitkaTools' lot manager. Two separate operations act on a room's chain — don't conflate them:

- **Projection** (Project Crop) builds or refreshes the full 5-lot chain of a room that isn't pending reprojection.
- **Reprojection** (Reproject) shifts the surviving chain down one slot after a real lot took TBA-1, and tops it back up to 5.

Neither ever runs automatically (not on load, not when a room flag changes).

### Unified Lot Abstraction

Every code path that would read `DB.lots[lotId]` goes through these helpers. Used by the lot selector, form load/save, preview, generate, clear, schedule list and reconciliation.

| Helper | Real lot | Projected lot |
|---|---|---|
| `isProjectedLot(lotId)` | `false` | `true` (id in `projectedLots`) |
| `getLotRecord(lotId)` | `DB.lots[lotId]` | `{ name, strain: 'TBA', destRoom: roomName }` |
| `getScheduleConfig` / `setScheduleConfig` | `DB.lots[lotId]._tool_CropLabourWizard` | `projectedLots[lotId].config` |
| `clearScheduleConfig(lotId)` | deletes `_tool_CropLabourWizard` | deletes only `.config`; the entry stays (→ stale) |
| `eventsForLot(lotId)` | `sourceTool === 'CropLabourWizard'` + `lotId` | `sourceTool === 'CropProjection'` + `lotId` |
| `lotSourceTool(lotId)` | `'CropLabourWizard'` | `'CropProjection'` |

### Projected Lot Map — `_CropLabourWizard.projectedLots`

```js
"G1B6-TBA-01": { name: "G1B6-TBA-01", roomId: "G1B6", roomName: "Grow Room 1", strain: "TBA", index: 1,
                 config: { plantingDate, recipeId, trimDays, harvestMultiDay, harvestDays, taskCount, generatedAt } }
```

- **IDs:** `{roomId}-TBA-{index}`, index zero-padded (`projectedLotId`). The room code keeps chains of different rooms from colliding; `TBA` marks the id as projected. Strain is always `"TBA"`. `roomId` / `roomName` on the entry are the source of truth for display and event tagging.
- **Config lives in the entry**, not on a lot. `config.plantingDate` is the lot's Day 0.
- **Owned by this tool.** SitkaTools never reads or changes it, except deleting `{roomId}-TBA-01` in its deletion hook (see "Deletion Hook — SitkaTools (for reference)").
- `generations[]` is written for real lots only.

### Projection Chain — 5 Lots, 70-Day Cadence

- Each flowering room gets exactly **5** projected lots (`PROJECTION_LOT_COUNT`). A lot's **Day 0** is its clone-cut date (the form's anchor date when cloning is on).
- **Default cadence** (default built-in, 63-day bloom; 63 is also the default and fallback bloom everywhere): planting Day 0 + 14 → transplant +30 (planting +16) → flip +34 (planting +20) → harvest +97 (flip +63) → trim +108 (harvest +11, 7 days, ends +114) → weigh/ship +116. Flower-room prep (coco layout, hydrate, undercanopy lights): planting +15, the day before transplant.
- **Chain rule** (user decision 2026-10-24): Lot(k+1) Day 0 = Lot(k)'s **last harvest day** (`endDate || date`) − the clone-cut days of the recipe Lot(k+1) follows (`nextLotDay0(lotId, nextRecipe)`; `projectedSlotRecipe`: the lot's own recipe, else the chain's). So the next lot moves in when its recipe plans after that harvest ends: with the built-ins, harvest ends Friday → transplant the Monday after → flip that Friday, whether the harvest is one day or several. Lot(k)'s own `clone_cut` event isn't read (a lot scheduled with an older recipe keeps that day where the older recipe put it). Fallbacks: a lot with no harvest event, its `clone_cut` date. With the built-ins (63-day bloom) consecutive Day 0s are **70 days** apart (~13 months for 5 lots); a 56-day bloom with the same clone cut, 63 days. A multi-day harvest adds its extra days.
- **Lot 1 anchor and the Project Crop gate** (`resolveProjectionAnchor`): the room's **newest real lot** by `createdDate` (`newestRealLotId`). Lot 1's Day 0 = the chain rule from that lot (its last harvest day − TBA-01's recipe's clone-cut days), else its `clone_cut` date, else its own Day 0 (`config.plantingDate`). A Mother room uses its replacement clone cut ("🌿 Mother Rooms"). That specific lot must have a generated schedule; an older scheduled lot doesn't count, and there is no "today" fallback.
- **Projection recipe** (`projectionRecipeId`, header dropdown, the default built-in to start with; kept in memory only, not in the DB): used for fresh projected lots and chain cadence; the bloom comes from its harvest offset (`recipeBloomDays`). It doesn't affect real-lot schedules or preview editing.
- **Room-ready rule** (shared by Project Crop, Reprojection and Overwrite push-backs):
  - A room is ready the day after the previous lot's Tank & Irrigation Clean (`effectiveIrrigationClean`; fallback harvest end + 2). Each lot's transplant must land on or after that day.
  - A lot that is too early moves later by exactly the shortfall; its whole schedule shifts, per-task offsets kept (pushed `day0` = its own Day 0 + delta, so hand-edited spacing and clones-off lots move by exactly that).
  - A lot already late enough stays put (its planned delay absorbs the push) and stops the cascade.
  - Stale or position-less lots, and lots due a push with no stored Day 0, are regenerated at the required position.
  - Push-backs never pull a lot earlier or re-place it from a harvest; only Project Crop re-places the chain (Chain rule).
  - The plan is computed before anything changes. If any push is needed, a blocking `confirm()` lists every lot (`TBA-01: +5d (Mar 14 → Mar 19)`, `TBA-03: unchanged (planned delay absorbs it)`, `TBA-05: new — transplants Jul 31`) under a headline naming the push to the next lot. **Cancel = no changes.**
- **Project Crop** (`generateProjectionsForRoom`): checks the room is flowering and the gate passes (else a toast naming the newest lot). Ensures 5 map entries (never prunes; refreshes `roomName`). Snapshots events and map, places Lot 1 (`reAnchorProjectedLot(roomId, 1, day0, recipeBloomDays(projRecipe))`), then `pushIfRoomNotReady` and `cascadeProjections(roomId, 2, …)` for the rest. If anything was pushed, a confirm lists it; cancel restores the snapshot.

### 🌿 Mother Rooms

User decision 2026-10-23 ("these still have the ability to do repeating crops"). A room designated **Mother** projects its next mother lots the same way, with these differences (`isMotherRoom`, `projectableRoom`, `chainRecipeFor`):

- **The chain follows the room's mothers:** its recipe is the newest real lot's 🌿 vegetative recipe (the Projection Recipe dropdown holds bloom recipes only). Each next mother lot starts on the previous one's **Cut Clones to Replace Mothers** day (`nextLotDay0`, fallback Retire Mothers − its clone-cut days).
- **No replacement cut, no chain:** Project Crop is disabled ("… has no "Cut Clones to Replace Mothers" task") when the recipe has none, or when the room's newest lot has no vegetative schedule. Mothers can still come from another lot's extra clones, created by hand.
- **No room-ready rule:** no push-back on Project Crop, Generate or Reproject (Reproject does a plain shift-down and tops up TBA-05 with the mothers' recipe).
- A projected mother lot has every task in the Mother room (projected lots have no cloning or veg room), repeats included. SitkaTools' deletion hook frees TBA-01 when a real lot moves into the Mother room, as for flowering rooms.

### Reprojection

- **Pending state (inferred, never stored):** `{roomId}-TBA-01` is absent and at least one of TBA-2…5 is present (`isPendingReprojection`). It comes from SitkaTools' deletion hook. While pending, TBA-2…5 show ⚠️ and count as stale (display only; their events still exist). A room with all 5 entries is never pending, even if some have no events (that's ordinary staleness, healed by Project Crop).
- **Gate:** manual only. The room's **active real lot** (`activeRealLotId`: the *last* non-projected lot in `room.assignedLots` — SitkaTools appends new lots, so it's the crop that took TBA-1's slot) must have `CropLabourWizard` events. An older scheduled lot doesn't unblock it (the chain would shift onto an unscheduled crop). Until then the button is disabled with a tooltip naming the lot.
- **Algorithm** (`reprojectRoom`):
  1. **Plan first** (`computeReprojectionPushes`, see "Late-Arrival Push-Back"); confirm if any push; cancel = no changes.
  2. **Rename low → high** (i = 2…5): `{roomId}-TBA-{i}` → `TBA-{i−1}` on the map key, `entry.name`, every matching event's `lotId` **and the lot-ID token in its stored `title`**. Low-to-high is safe because each target slot is already free; high-to-low would clobber entries still to move.
  3. **Apply** each planned shift with `reAnchorProjectedLot(roomId, index, day0)` (no bloom change). Pushed lots keep their per-task offsets.
  4. **Top up:** generate a fresh `TBA-05` with `generateLotSchedule(…, defaultOffsetsSnapshot(recipeBloomDays(projRecipe), projRecipe), default durations)` at the plan's slot-5 Day 0 (fallback: the last surviving lot's `nextLotDay0`). Only this lot uses the current projection recipe.
- Toast reports how many lots were pushed and by how much. The room then has 5 lots and is no longer pending.

### Late-Arrival Push-Back (implemented)

A new real crop may run later than the chain planned. Reprojection applies the room-ready rule (see "Projection Chain") with the real lot's `tank_irrigation_clean` as the starting point.

- `computeReprojectionPushes(roomId, newRealLotId)` is pure. It walks slots 1..4 in post-rename order (slot i holds current TBA-(i+1)); the real lot is "previous" for slot 1. Slot 5 is `fresh`, with Day 0 = slot 4's required transplant − the projection recipe's transplant span (30 days with the default built-in).
- Returns `[{ index, action: 'push' | 'keep' | 'regen' | 'fresh', delta, day0, … }]`, or `null` when the real lot has no usable irrigation-clean (reprojection then does a plain shift-down).
- Only TBA lots move; the real lot's schedule is untouched.

### Overwrite Push-Back (implemented)

Generate on an existing schedule may push its Tank & Irrigation Clean past the next lot's transplant. It applies the room-ready rule (see "Projection Chain") in two cases:

- overwriting a **projected** lot → walks slots `index+1..5`;
- overwriting the room's **active real lot** → walks from the first surviving TBA slot (TBA-2 in a pending room, same as overwriting TBA-01 would have). Overwriting an older real lot in the room doesn't push the chain.

Details:

- Before any change, `simulatedIrrigationClean(day0, offsets, durations)` computes the lot's new irrigation clean from the form state (same math as `generateLotSchedule`: harvest **end** + offset; fallback harvest end + 2).
- `computeForwardPushPlan(roomId, fromIndex, prevIrr)` is pure and returns `[{ index, action: 'push' | 'keep' | 'regen', delta, day0, … }]`, or `[]` when nothing moves.
- If the overwrite leaves extra slack, later lots keep their dates — no dialog, no toast suffix. The chain may drift from its cadence; Project Crop re-tightens it.
- Generate never cascades (`cascadeProjections` is Project Crop only).

### Projection Engine Functions

| Function | Purpose |
|---|---|
| `defaultOffsetsSnapshot(bloomDays = 63, recipe = BUILTIN_RECIPE)` | the recipe's tasks at their default offsets, harvest set to `bloomDays` |
| `generateLotSchedule(lotId, day0, offsets, durations, recipe)` | shared by Generate and projections: builds events (right `sourceTool`; `roomId` on projected ones), saves the config, returns `{ events, config }` |
| `reAnchorProjectedLot(roomId, index, day0, bloomDays?)` | no events or no stored Day 0 → regenerate fresh from `defaultOffsetsSnapshot` (bloom: `bloomDays`, else the lot recipe's) + default durations, annotations carried by `taskType`; otherwise shift every event by the Day 0 delta, plus `bloomDays − currentBloom` on bloom-dependent tasks when `bloomDays` is given. Refreshes estimates; updates `config.plantingDate` / `generatedAt` |
| `cascadeProjections(roomId, fromIndex, bloomDays?, recipe?)` | Project Crop only: each lot at the previous lot's `nextLotDay0` (with that lot's `projectedSlotRecipe`), then `pushIfRoomNotReady`; returns the pushes |
| `pushIfRoomNotReady(roomId, index, prevLotId)` | one lot's room-ready check; returns `{ index, delta, transplantBefore, transplantAfter }` or null |
| `nextLotDay0(lotId, nextRecipe?)`, `effectiveIrrigationClean(lotId)` | pure reads (null without a schedule / anchor); both count from the harvest's last day |
| `projectedSlotRecipe(roomId, index, chainRecipe?)` | the recipe a projected lot follows: its own config's, else the chain's, else the projection recipe |
| `newestRealLotId(roomId)` | latest `createdDate` (ties → `assignedLots` order); Project Crop anchor |
| `activeRealLotId(roomId)` | last non-projected lot in `assignedLots`; Reproject gate and real-lot overwrite |
| `clearAllProjectionsForRoom(roomId)` | deletes every `CropProjection` event with that `roomId` and every `{roomId}-TBA-*` entry (the confirm is in the button handler) |

### Stale Detection

On load and after every DB update, a projected lot with **no** `CropProjection` events is *stale*. It gets ⚠️ in the lot selector and counts in the status bar's stale total. The map is never auto-pruned; Project Crop regenerates stale lots. Pending-reprojection lots count as stale too (they await renumbering, not regeneration). Nothing is written to the DB.

### Calendar Events — `sourceTool: 'CropProjection'`

`{ date, endDate?, title, sourceTool: 'CropProjection', lotId: 'G1B6-TBA-01', roomId: 'G1B6', taskType }` plus `estStaff` / `estMinutes` when the recipe has them.

- Same shape as CropLabourWizard events, but `roomId` is always present (real CLW events don't carry it); SitkaTools uses it to delete a room's projections.
- **Title:** `🌸 G1B6-TBA-01, Flip to Flower` — no room prefix (the id already contains it).
- SitkaTools draws them dashed/muted (`.day-event.projection`); ICS export adds ` (projected)` to the summary.

### UI — CropLabourWizard

- **Lot selector:** projected lots under their room's divider, after its real lots, as `🔮 {roomId}-TBA-0n` (⚠️ when stale). Selecting one loads its config into the same form; Generate / Clear act on `CropProjection` events and the entry's config.
- **Header, left to right:** Projection Recipe dropdown, 🔮 Project Crop, 🧹 Clear Projections, Active Lot.
- **Project Crop** resolves the room from the selected lot (projected → its `roomId`; real → `resolveFlowerRoom`). Disabled, with a tooltip, when there is no lot, no flower room, the room isn't flowering, or the room's newest real lot has no schedule (tooltip names it). Re-enables when that changes.
- **Reproject:** in a pending room the same button reads "🔁 Reproject" and runs `reprojectRoom` instead. Disabled (tooltip) until the active real lot has a schedule.
- **Clear Projections:** after a confirm, deletes all of the room's projection events and TBA-1…5 entries, so the next Project Crop starts fresh. Enabled only when the room has a projected entry or event.
- **Status bar:** e.g. `🌸 2 flowering rooms · 🔮 10 projected (3 stale)`.

### Deletion Hook — SitkaTools (for reference)

When a real lot is created in, or moved/assigned into, a flowering room, SitkaTools deletes that room's `{roomId}-TBA-01` map entry and its `CropProjection` events, leaves TBA-2…5 untouched (the room is now pending reprojection), and its alert says to run **Reproject** here after scheduling the new lot. Idempotent: no TBA-1, no-op.

## Dates in the UI

- **Weekdays:** every computed date shows its weekday, from local `Date.getDay()` (never UTC): `2026-09-15 · Tue`, or `2026-12-17 (Thu) → 2026-12-23 (Wed)` for a range. Used in the preview, saved schedule list and the config summary's anchor date.
- **Date picker:** each editable task's date badge in the preview opens one shared popup (`#datePickerPopup`), anchored to the badge (flips above near the bottom edge). Month grid with ‹/› and Today; marks the task's date, today, and BC holidays (amber dot + tooltip). Picking a day changes the task's **offset by the delta**, with the same cascade and range as the spinbox. For Trim, the picked day is the new trim start. Closes on outside click or Escape.
- Locked tasks (Cutting Clones; Planting when clones are off) and disabled tasks get a plain, non-clickable badge.

## BC Civic Holidays

Rules, helpers and the verification table: root `CLAUDE.md` → "BC Civic Holidays" (implemented here as `Holidays`; `holidayInRange`). Computed live, never stored. Always the observed date, in the task date's year; multi-day tasks are checked over their whole range.

- **Preview and saved schedule:** an amber "🏛️ Holiday" chip next to the date; its tooltip names the holiday (and the nominal date when it shifted).
- **Conflict banner** below the preview lists each affected task (e.g. "🌾 Harvest — 2026-12-25 falls on Christmas Day").
- **Generate toast** appends "· ⚠️ N on a BC civic holiday".
- Notify only: never reschedules or skips a task.

## Relationship to SitkaTools

- **Office only** (`DeviceView` with `OFFICE_ONLY: true`): on a building device SitkaTools hides the link, and if opened anyway the page is covered with "Office only" before anything loads.
- Gets the DB and sends changes through the postMessage convention, with the shared `WorkCopy` and `LinkLost` snippets (root `CLAUDE.md` → "Cross-Window Database Workflow" and "Shared Working Copy"). No other browser storage.
  - `sitkaGit_db`: ack, then full rebuild (`buildDefaultOffsets`, `populateLotSelector`, recipe and projection-recipe selectors, `renderScheduleList`, `updateStatusBar`, `refreshPreview`, `updateGenerateBtnLabel`, `updateProjectBtnState`) and a toast.
  - `sitkaGit_db_update` (e.g. SitkaTools' deletion hook): refreshes selectors, schedule list, status bar and buttons only — no offset rebuild, no toast, no reply — so editing isn't interrupted.
  - `notifySitkaTools()` after every change (generate, clear, delete, recipe save, projections).

### DB Keys

- `lots.<id>._tool_CropLabourWizard`: the lot's schedule config `{ plantingDate (Day 0), recipeId, kind? ('vegetative': a mother lot), trimDays, harvestMultiDay, harvestDays, taskCount, generatedAt }`.
- `_CropLabourWizard`:
  - `generations[]`: generation log, real lots only; Clear / Delete Schedule drop the lot's entries; SitkaTools' close-out copies the rest into the lot's archive.
  - `projectedLots`: see "Projected Lot Map".
  - `recipes`: user recipes only (never the built-ins).
  - `inputs`: the price list (see "🧪 Inputs").
  - `taskTypes`: the registry (see "Task-Type Registry").
- `calendarEvents`: `CropLabourWizard` and `CropProjection` events.

## UI Notes

Follows root `CLAUDE.md` → "UI Standards". Lot-focused: header logo "👷 Crop Labour Wizard" with the Active Lot selector; footer is Close Tool only (centred). Toast: bottom-centre, 2.5 s. Status bar starts as "No database loaded. Open from SitkaTools."

## Tests

`node tests/run.mjs` (root `CLAUDE.md` → "Tests"). Covering this tool: `builtin-recipes` (the three built-ins: dropdowns and manager, each one's turnaround, generating on real weekdays, Project Crop's 70-day chain, re-importing an exported built-in), `mothers` (vegetative recipes, repeats, generating a mother lot, regenerating per repeat), `tools-smoke` (opens without errors), `cost-inputs` (price list and recipe supplies, import, save), `task-inputs` (supplies per plant at a task, in the editor and the Reports), `mark-done` (regenerating keeps sign-offs), `projection-harvest-end` (lots with a two-day harvest ending Friday and an old clone cut: Project Crop moves the next lots in on the Monday after and flips them on the Friday, also over projections made the old way; Reproject after a lot that harvests a week late pushes the chain back a week and keeps the rhythm). Overwrite push-backs have no automated test.
