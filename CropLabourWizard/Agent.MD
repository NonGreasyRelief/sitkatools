# CropLabourWizard — Tool Context

## What This Tool Does

CropLabourWizard is a **crop schedule calculator** for licensed cannabis cultivation. Given a selected lot and an anchor date, it automatically computes and schedules every major cultivation task as calendar events based on editable day offsets from reference points. The user picks a lot, sets the anchor date, adjusts any task's day offset in the preview, and generates the entire grow-out timeline.

### Intended Use

- **Auto-schedule a full crop cycle:** Select a lot, enter the anchor date, and the tool calculates every downstream task — cloning, coco block layout/spiking & hydration, transplanting, topping, undercanopy lights & air socks, flipping to flower, trellis layout, pruning, leaf picks, clone cutting, harvest, grow-room clean, tank & irrigation line clean, tote prep, bucking, trim room prep, trim, machine trim of smalls, room cleans (clone, veg, dry), and final weigh/ship.
- **Preview & edit before committing:** See all computed tasks with their default dates, then adjust any task's day offset (including flip-to-flower, harvest timing, planting offset) and multi-day durations (trim length; optionally multi-day harvest) before generating the final schedule. Each task's computed date shows its weekday next to it (e.g., `2026-09-15 · Tue`), and clicking a task's date opens a clickable date picker — picking a day adjusts that task's offset by the delta, exactly like the +/− spinbox.
- **Visualize labour demand:** All generated events appear on the shared calendar so the grower can see when tasks cluster across multiple lots.
- **Dynamic Day 0 anchor:** When Cutting Clones is enabled, the top date is the cloning date (Day 0) and planting offsets from it. When disabled, the top date becomes the planting date (Day 0). All downstream tasks cascade accordingly.

### Crop Schedule — Task Offsets from Reference Points

All dates cascade from reference points. The **Day 0 anchor** is dynamic:
- **Clones enabled:** Cloning date = Day 0, Planting offsets from cloning (default +14 days, editable)
- **Clones disabled:** Planting date = Day 0, Cutting Clones hidden

All day offsets are user-editable in the preview. Changing a reference point's offset (e.g., Flip to Flower or Harvest) cascades to all downstream tasks by the same delta.

| # | Task | Emoji | Reference Point | Default Offset | Editable? | Toggleable? |
|---|------|-------|-----------------|----------------|-----------|-------------|
| 0 | Cutting Clones | ✂️ | Cloning (Day 0) | Day 0 (locked) | No | **Yes** (enabled by default) |
| 1 | Planting Clones | 🌱 | Cloning (when clones on) / Planting (when clones off) | +14 from cloning / Day 0 (locked when clones off) | Yes (when clones on) | — |
| 2 | Clean Clone Room and used cloning supplies | 🧼 | Planting | +1 day (after planting clones) | Yes | — |
| 3 | Topping | ✂️ | Planting | +3 days | Yes | — |
| 4 | Order Preventative Insects: Swirskii, Hypoaspis, Nematode, Atheta | 🐛 | Planting | +7 days | Yes | — |
| 5 | Lay-out and Spike Coco Blocks for Hydrating | 🥥 | Planting | +12 days (two days before transplant; flower room) | Yes | — |
| 6 | Hydrate Coco Blocks for Transplanting | 💧 | Planting | +13 days (day before transplant; flower room) | Yes | — |
| 7 | Install Undercanopy Lights and Air Socks | 💡 | Planting | +13 days (same day as hydrate blocks; flower room) | Yes | — |
| 8 | Transplanting to Flower Room | 🪴 | Planting | +14 days | Yes | — |
| 9 | Clean Vegetation Room | 🧼 | Planting | +15 days (after transplanting to flower room) | Yes | — |
| 10 | Deploy IPM to Flower Room | 🛡️ | Planting | +15 days | Yes | — |
| 11 | Two-Node / Lollipop Prune | 🔪 | Planting | +20 days | Yes | — |
| 12 | Flip to Flower | 🌸 | Planting | +21 days | **Yes** (cascades to all bloom & harvest tasks) | — |
| 13 | Layout Trellis and Secure | 🕸️ | Flip | +1 day (day after flip) | Yes | — |
| 14 | Early Flower Leaf Pick | 🍃 | Flip | +21 days | Yes | — |
| 15 | Cut Clones to Replace Lot | 🌿 | Harvest (start) | harvest start − 21 days (derived — follows bloom length; displayed offset vs flip = bloomLength − 21) | **No** (locked/derived) | — |
| 16 | Late Flower Leaf Pick | 🍂 | Flip | +42 days | Yes | — |
| 17 | Harvest | 🌾 | Flip | +63 days (9 weeks bloom) | **Yes** (cascades to all post-harvest tasks; optionally **multi-day** — default 2 days when checked, and post-harvest tasks then cascade from the harvest *end* date) | — |
| 18 | Grow-Room Clean | 🧹 | Harvest | +1 day | Yes | — |
| 19 | Tank and Irrigation Line Clean | 🚿 | Harvest | +2 days (day after grow-room clean) | Yes | — |
| 20 | Clean and Prepare Totes for Bucking | 🧺 | Harvest | +9 days (day before bucking) | Yes | — |
| 21 | Dry Room Take-Down / Bucking | 📦 | Harvest | +10 days | Yes | — |
| 22 | Prepare Sample for Lab Testing | 🔬 | Harvest | +10 days | Yes | — |
| 23 | Prepare Trim Room | 🧽 | Harvest | +10 days (day before trim starts) | Yes | — |
| 24 | Trim | ✂️ | Harvest (end, when multi-day) | +11 days; **length is user-selectable** (default 7 days, editable 1–30 in the preview) | Yes | — |
| 25 | Machine Trim Smalls | ⚙️ | Trim Start | +7 days (day after trim ends at default length) | Yes | **Yes** (enabled by default) |
| 26 | Clean Dry Room | 🧼 | Trim Start | +7 days (day after trim ends) | Yes | — |
| 27 | Weigh Final Dry Weight and Send Lot to Processing | ⚖️ | Trim Start | +8 days (after trim ends) | Yes | — |

**Cascade behavior:** Adjusting the Flip to Flower offset shifts all flip-relative tasks (Trellis Layout, Early Leaf Pick, Late Leaf Pick, Harvest) and all harvest-relative tasks (Room Clean, Tank & Irrigation Clean, Tote Prep, Bucking, Lab Sample, Prepare Trim Room, Trim) by the same delta. **Clone Cut is derived/locked** — it always lands at harvest start − 21 days, so it follows the bloom length automatically rather than being an independently editable flip-relative task. Similarly, adjusting the Harvest offset shifts all post-harvest tasks (and Clone Cut), and adjusting the Trim offset shifts the three trim-anchored tasks (Machine Trim Smalls, Clean Dry Room, Weigh & Ship).

**Multi-day durations:**
- **Trim length** is user-selectable in the preview (1–30 days, default 7). The three trim-anchored tasks (Machine Trim Smalls, Clean Dry Room, Weigh & Ship) are re-based so they always land 1–2 days after trim *ends*, regardless of the chosen length.
- **Harvest** can optionally span multiple days via a "Multi-day" checkbox in the preview (default length 2 when checked). When multi-day is on, all harvest-referenced tasks measure from the harvest *end* date instead of the start date; when off, behavior is identical to single-day harvest.

### Calendar Events Generated

CropLabourWizard appends events to the shared `calendarEvents` array using `"sourceTool": "CropLabourWizard"`. Each event has:

- **Title:** Emoji + `Room code-Strain name#Lot number` + `, task name` (e.g., `"🌸 B66DG1-Purple Haze#LOT-001, Flip to Flower"`). The room code is **per-task**, based on which phase of the crop cycle the task belongs to:
  - **Cutting Clones** (`clone_cut_prep`) and **Clean Clone Room and used cloning supplies** (`clone_room_clean`) → the lot's `cloningRoom` (room name stored on the lot; resolved to a room ID via `rooms.<roomId>.name`).
  - **Tasks before Transplanting to Flower Room** (Planting, Topping, Order IPM) and **Clean Vegetation Room** (`veg_room_clean`, which happens after transplant but in the veg room) → the lot's `vegRoom`.
  - **Lay-out & Spike Coco Blocks for Hydrating** (`layout_coco_blocks`), **Hydrate coco blocks for transplanting** (`hydrate_coco_blocks`), and **Install undercanopy lights and air socks** (`undercanopy_lights`) are explicit exceptions: although they're listed *before* transplant for chronological display (they're prepped the day(s) before plants arrive), they happen in the flower room, so they resolve to the destination (flower) room.
  - **Transplant and everything else after** (incl. post-harvest tasks like Tank & Irrigation line clean, Prepare Trim Room, and post-trim tasks: Machine Trim Smalls, Clean Dry Room, Weigh & Ship) → the lot's destination (flower) room — resolved from `rooms.<roomId>.assignedLots` containing the lot, falling back to matching the lot's `destRoom` name against `rooms.<roomId>.name`.

  Room names are stored on the lot (`cloningRoom`, `vegRoom`, `destRoom`) and resolved to room IDs at title-build time. If no room is found for a task's phase, the prefix degrades gracefully: `Strain#Lot number`, or just `Lot number` when strain is also missing.
- **Date:** The computed date for the task (`YYYY-MM-DD`)
- **EndDate:** Set for multi-day events only — always Trim, and Harvest when multi-day is checked. Omitted for single-day events.
- **SourceTool:** `"CropLabourWizard"`
- **LotId:** Always set to the selected lot ID — every event is scoped to a lot
- **TaskType:** A string identifier for the task (e.g., `"harvest"`, `"trim"`, `"flip"`) used during reconciliation to detect and replace stale schedules

### Schedule Reconciliation

When a user generates a schedule for a lot, the tool first **removes all existing CropLabourWizard events** for that lot from `calendarEvents` before inserting the new batch. This prevents duplicate or stale tasks when the planting date changes. The reconciliation logic matches on `sourceTool === 'CropLabourWizard'` AND `lotId === selectedLot`.

## Crop Projection (Projected Lots)

Flowering rooms can hold **projected lots** — placeholder future crops that let you plan labour months ahead without creating real lots. Projected lots are generated by this tool, stored in a dedicated map inside the shared database, and rendered as calendar events with their own `sourceTool`. They are **not** real lots: they never appear in `DB.lots`, never show up in SitkaTools' lot manager, and can be regenerated at any time.

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
- **Legacy ID migration:** databases created before this scheme used either `PROJ-{roomId}-{index}` IDs or the intermediate non-room-scoped `01`–`05` IDs (which collided across rooms). On load / DB import, `migrateProjectedLotIds()` renames any remaining legacy map keys to `{roomId}-TBA-{index}` (using each entry's `roomId` + `index`; for `PROJ-*` the room falls back to the ID itself), rewrites `lotId` on the matching `CropProjection` events and generation-log entries, and pushes the migrated DB back to SitkaTools. It is a no-op once every ID has been migrated.
- **Config lives in the map entry** (`projectedLots[lotId].config`), not in `DB.lots[lotId]._tool_CropLabourWizard`, because projected lots are not DB lots.
- **The map is owned by this tool.** SitkaTools must never read, modify, or delete entries from it — even when deleting projection calendar events.
- **`generations[]` log entries are only written for real lots.** Projected lot config lives solely in the map entry.

### Projection Chain — 5 Lots, 77-Day Cadence

Each flowering room gets exactly **5** projected lots forming a chain:

- **Lot Day 0** = the lot's clone-cut date (the form's anchor date when cloning is enabled) — the day its parent clones were cut.
- Within a lot (default settings): planting = Day 0 + 14 → flip = Day 0 + 35 → harvest start = flip + bloomLength (default **63**) = Day 0 + 98 → trim start = harvest + 11 (7 days) → weigh/ship = trim + 8.
- **Chain rule:** Lot(k+1) Day 0 = Lot(k) harvest **start** − 21 days. With the default 63-day bloom, consecutive Day 0s are exactly **77 days apart**; the 5 lots span ~425 days (~14 months). With an 8-week (56-day) bloom they are **70 days apart** (~350 days / ~11.5 months for 5 lots).
- **Bloom length toggle:** the header's 8/9-week buttons set `projectionBloomDays` (56 or 63, default 63). It only affects projection chain generation — not manual preview editing. Because `clone_cut` stays at harvest start − 21, the chain cadence remains correct for either bloom length.
- **Anchor for Lot 1:** if the room has an active real lot with a CropLabourWizard schedule, Lot 1's Day 0 = that lot's `clone_cut` event date (the replacement cut lands exactly when the current lot's harvest window opens). Otherwise Day 0 = today.
- **Forward re-projection:** regenerating any projected lot re-projects all *later* lots in the chain forward — only their anchor dates shift; each later lot's user-tweaked task offsets are preserved.

### Projection Engine Functions

| Function | Purpose |
|---|---|
| `PROJECTION_LOT_COUNT` | Constant = 5 |
| `projectedLotId(roomId, index)` | Returns `{roomId}-TBA-{index}` (zero-padded index, e.g. `G1B6-TBA-01`) — room-scoped so chains from different rooms never collide |
| `migrateProjectedLotIds()` | One-time migration of legacy `PROJ-{roomId}-{index}` and intermediate `01`–`05` IDs → `{roomId}-TBA-{index}` (map keys + event/log references); returns `true` if anything changed |
| `defaultOffsetsSnapshot(bloomDays = 63)` | Snapshot of all `TASK_DEFS` with their default offsets (used to regenerate stale lots); the harvest offset is set to `bloomDays` so a fresh lot uses the selected bloom length. |
| `generateLotSchedule(lotId, day0, offsets, durations)` | Shared by the Generate button and chain generation. Computes anchors, builds events (with correct `sourceTool` per lot type), writes config via `setScheduleConfig`, returns `{ events, config }`. For projected lots, events carry `roomId`. |
| `reAnchorProjectedLot(roomId, index, day0, bloomDays?)` | If the lot is stale (no events) → regenerate fresh from `defaultOffsetsSnapshot(bloomDays)` + default durations at the new Day 0. Otherwise → shift all existing events by the delta between old and new Day 0 (preserves custom offsets); when `bloomDays` is provided, bloom-dependent tasks additionally shift by `bloomDays − currentBloom` so the new bloom length takes effect. Updates `entry.config.plantingDate` and `generatedAt`. |
| `cascadeProjections(roomId, fromIndex, bloomDays?)` | For each lot from `fromIndex` to 5: reads the previous lot's harvest event date, calls `reAnchorProjectedLot` with `harvest − 21`, passing `bloomDays` through. |
| `generateProjectionsForRoom(roomId)` | Validates room exists + `isFlowering`. Ensures 5 map entries (keeps existing — never prunes; refreshes `roomName` if renamed). Resolves Lot 1 anchor (active real lot's `clone_cut` event date, else today). Calls `reAnchorProjectedLot(roomId, 1, day0, projectionBloomDays)` then `cascadeProjections(roomId, 2, projectionBloomDays)`. Refreshes UI + notifies SitkaTools. |

### Stale Detection

On load and after every DB update, this tool compares `projectedLots` against calendar events: a projected lot with **no** `CropProjection` events is *stale* (its events were deleted by SitkaTools or cleared). The tool:

- Flags stale lots in the lot selector with a ⚠️ suffix.
- Never auto-prunes the map — stale entries persist until the user regenerates them via "Project Crop".

### Calendar Events — `sourceTool: 'CropProjection'`

Projected lots emit calendar events identical in shape to CropLabourWizard events, but with a distinct source tool so both tools can separate them without ever reading each other's data:

```js
{ date, endDate?, title, sourceTool: 'CropProjection', lotId: 'G1B6-TBA-01', roomId: 'G1B6', taskType }
```

- `roomId` is always present on projection events (real CLW events don't carry it) — this is what SitkaTools uses to delete a room's projections.
- Titles use the same format as real lots, with graceful degradation for TBA strain.
- **ICS export:** projection event summaries get a ` (projected)` suffix; on-screen titles stay clean.

### UI — CropLabourWizard

- **Lot selector:** projected lots appear under their room's divider (after the room's real lots) as `🔮 {roomId}-TBA-0n`; stale ones get a ⚠️ suffix.
- **Bloom length toggle** in the header, to the left of Project Crop: two small stacked buttons, **8 weeks** (top) and **9 weeks** (bottom). Selecting one sets `projectionBloomDays` (56 / 63 days); **9 weeks is the default** (active state highlighted with the accent color). It only affects projection chain generation — manual preview editing is untouched. Because clone cut stays at harvest − 21, the chain cadence remains correct for either bloom length.
- **Project Crop button** in the header, to the left of the Active Lot selector (sized to match the dropdown's height): generates/refreshes the 5-lot chain for the selected room using the currently selected bloom length. Resolves the room from the currently selected lot (projected → its `roomId`; real → `resolveFlowerRoom`). Requires `isFlowering === true`. Never auto-runs on load or when a room flag changes. It is **greyed out (disabled)** whenever the selected lot can't be projected — no lot selected, no resolvable flower room, or the room isn't flagged as flowering — and its tooltip explains why; it re-enables automatically when a projectable lot is selected or the DB updates.
- Selecting a projected lot loads its stored config into the same form; Generate/Clear operate on `CropProjection` events and the map entry's config.
- **Status bar** shows: flowering rooms, projected lots (with stale count) — e.g., `🌸 2 flowering rooms · 🔮 10 projected (3 stale)`.

### Deletion Hook — SitkaTools (for reference)

When a **real lot is created or moved/assigned into a flowering room**, that room's projected lots are "taken" — the projections no longer represent reality. SitkaTools then:

1. Deletes **only** calendar events where `sourceTool === 'CropProjection' && roomId === <that room>`.
2. **Never touches `_CropLabourWizard.projectedLots`** — the map survives byte-for-byte.
3. Notes in the confirmation alert that the room's projections were cleared.

Regeneration is manual: the user opens this tool and clicks "Project Crop" (header, next to the lot selector) for the room. No tool auto-regenerates.

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
Stores the lot's schedule configuration: anchor date, task count, trim length (user-selectable, default 7), and harvest multi-day settings (`harvestMultiDay`, `harvestDays` — default 2 when checked). This lets the tool re-render its UI from stored state and detect stale schedules during reconciliation.

**Top-level data** (root of database):
```
_CropLabourWizard: {
    generations: [ /* generation log — real lots only */ ],
    projectedLots: { /* source of truth for projected lots — see "Crop Projection" section */ }
}
```
Tool-wide metadata. `generations[]` is a log of schedule generations for audit purposes (real lots only). `projectedLots` is the **source of truth** for projected lots (owned by this tool; SitkaTools never reads, modifies, or deletes it — see "Crop Projection" section below).

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
