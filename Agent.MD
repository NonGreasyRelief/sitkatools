# SitkaGit — Cannabis Cultivation Tracking Suite

## Project Overview

A collection of standalone, single-file HTML tools for tracking licensed cannabis cultivation. Each tool lives in its own directory and operates entirely client-side (browser sandbox, no server required). All tools contribute data to a shared JSON database that feeds a unified calendar view.

### Core Principles

- **Single-file tools:** Every tool is a single `.html` file with embedded CSS and JavaScript — no build step, no dependencies, no server.
- **Browser sandbox only:** Tools run by opening the HTML file directly in a browser (`file://` protocol). No `fetch()` to external origins, no WebSocket, no server communication.
- **Modular & decoupled:** Tools do NOT communicate with each other. Shared state is mediated exclusively through the JSON database file on disk.
- **No frameworks:** Vanilla HTML/CSS/JavaScript only. No bundlers, no npm packages, no transpilers.

## Architecture

### Directory Structure

```
SitkaGit/
├── Agent.MD                  # This file — project instructions for LLMs
├── SitkaTools/
│   └── SitkaTools.html       # Main hub: lot management + calendar viewer
├── <ToolName>/
│   └── <ToolName>.html       # Individual tool (pattern for all future tools)
└── ...                       # Additional tool directories
```

Each tool gets its own directory containing exactly one `.html` file named after the directory.

### Shared Database Format

All tools read from and write to a shared JSON database file with the naming convention:

```
DB-YY-MM-DD.json
```

- `YY` = 2-digit year (e.g., `26`)
- `MM` = 2-digit month (e.g., `01`)
- `DD` = 2-digit day (e.g., `15`)
- Example: `DB-26-08-03.json`

The main tool (`SitkaTools.html`) provides a file import UI so the user can load the current database. Individual tools may export/write updates to this same format.

#### Database Schema (Conceptual)

```json
{
  "lots": {
    "<LotID>": {
      "name": "string",
      "strain": "string",
      "stage": "string",
      "createdDate": "YYYY-MM-DD",
      "closedDate": "YYYY-MM-DD | null",
      "destRoom": "string | null",   // flower room name (also tracked in rooms.<roomId>.assignedLots)
      "vegRoom": "string | null",    // vegetating room name (set at lot creation, new lots only)
      "cloningRoom": "string | null",// cloning room name (set at lot creation, new lots only)
      "_tool_<ToolName>": { ... }
    }
  },
  "rooms": {
    "<RoomID>": {
      "name": "string",
      "description": "string | null",
      "createdDate": "YYYY-MM-DD",
      "assignedLots": ["<LotID>"],
      "isFlowering": "boolean",       // Crop Projection eligibility flag
      "buildingId": "string | null"   // building the room is in (also tracked in buildings.<buildingId>.assignedRooms)
    }
  },
  "buildings": {
    "<BuildingID>": {
      "name": "string",
      "description": "string | null",
      "createdDate": "YYYY-MM-DD",
      "assignedRooms": ["<RoomID>"]   // rooms in this building (mirrors room.buildingId)
    }
  },
  "calendarEvents": [
    {
      "lotId": "string",
      "date": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD | null",
      "title": "string",
      "sourceTool": "string"
    }
  ],
  "_<ToolName>": { ... }
}
```

- Each tool writes its own key under `_tool_<ToolName>` within a lot, or at the top level as `_<ToolName>`.
- Tools only read/write their own keys — they do not modify other tools' data.
- Calendar events are append-only; each event records which tool generated it via `sourceTool`.

#### Multi-Day Events

Calendar events support an optional `endDate` field for events that span consecutive days:

- **`date`** (required): The start date of the event (`YYYY-MM-DD`).
- **`endDate`** (optional): The end date of the event (`YYYY-MM-DD`). If omitted or equal to `date`, the event is a single-day event.
- **Calendar rendering:** The calendar grid displays the event on every day within the `[date, endDate]` range (inclusive). Multi-day events receive visual styling: the start day has a left border and bold text, the end day has a right border, and intermediate days have no rounded corners.
- **Drag-and-drop:** When a multi-day event is dragged to a new date, the duration (offset between `date` and `endDate`) is preserved.
- **Event panel:** The event detail panel exposes both `date` and `endDate` as modifiable date inputs.
- **Terminal view:** Multi-day events display as `start → end` in the terminal list.
- **Subtools:** When creating a multi-day event, only set `endDate` if it differs from `date`. Tools like GeneralEvent provide an optional "End Date" input for this purpose.

### Cross-Window Database Workflow — postMessage Convention

**Mechanism:** Subtools open as new browser windows via `window.open()`. The main app sends the current database to the subtool via `postMessage` immediately after opening. The subtool receives the DB, acknowledges with a ready message, and sends updates back via `postMessage` after every mutation. The main app auto-refreshes all views when it receives an update — no manual sync needed.

**Why postMessage instead of localStorage:** On `file://` protocol, browsers (especially Firefox) give each file path a unique origin sandbox, so localStorage at `/SitkaTools/SitkaTools.html` cannot be read from `/GeneralEvent/GeneralEvent.html`. The `storage` event also never fires across different origins. `postMessage` works reliably across `file://` windows.

**Message protocol (all tools use these exact message types):**
```js
// SitkaTools → Subtool: Send database on open
{ type: 'sitkaGit_db', payload: DB.data }

// Subtool → SitkaTools: Acknowledge receipt
{ type: 'sitkaGit_ready' }

// Subtool → SitkaTools: Send database after mutation
{ type: 'sitkaGit_db_update', payload: DB.data }
```

#### Rules

1. **postMessage is the primary cross-window data channel.** SitkaTools sends the full DB payload when opening a subtool; subtools receive it via a `message` event listener and acknowledge with `sitkaGit_ready`.
2. **Subtools open as new windows.** Use `window.open(url, '_blank')` — keep a reference to the returned window object for sending messages.
3. **Main app auto-refreshes on updates.** When SitkaTools receives a `sitkaGit_db_update` message, it replaces its DB data and re-renders all views automatically. A toast appears confirming the sync (auto-dismisses after 3 seconds).
4. **Subtools notify after every mutation.** After adding/deleting/editing data, call `notifySitkaTools()` which posts the updated DB back to the opener window.
5. **Retry mechanism for initial DB delivery.** SitkaTools retries sending the DB up to 5 times at 200ms intervals until the subtool acknowledges with `sitkaGit_ready`.
6. **No localStorage, sessionStorage, IndexedDB, or cookies in subtools.** All cross-window state flows through postMessage.

#### SitkaTools Module Link Handler Pattern

In SitkaTools.html, when a module link is clicked:

```js
// ---- Module Link Handlers — postMessage Convention ----
let openSubtools = [];

document.querySelectorAll('.module-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        openModuleInTab(link.href);
    });
});

function openModuleInTab(url) {
    const newWindow = window.open(url, '_blank');
    if (!newWindow) return;

    openSubtools.push(newWindow);

    // Track close with interval fallback (close event unreliable on file://)
    const closeCheck = setInterval(() => {
        if (newWindow.closed) {
            openSubtools = openSubtools.filter(w => w !== newWindow);
            clearInterval(closeCheck);
        }
    }, 1000);

    // Send DB via postMessage with retry mechanism
    const dbPayload = DB.data || { lots: {}, rooms: {}, buildings: {}, calendarEvents: [] };
    let attempts = 0, acknowledged = false;

    function trySend() {
        if (acknowledged || newWindow.closed || attempts >= 5) return;
        attempts++;
        newWindow.postMessage({ type: 'sitkaGit_db', payload: dbPayload }, '*');
    }

    // Listen for acknowledgment from subtool
    const ackHandler = (e) => {
        if (e.source === newWindow && e.data?.type === 'sitkaGit_ready') {
            acknowledged = true;
            window.removeEventListener('message', ackHandler);
        }
    };
    window.addEventListener('message', ackHandler);

    // Initial send + retry at 200ms intervals
    trySend();
    const retryTimer = setInterval(() => {
        if (acknowledged || newWindow.closed) clearInterval(retryTimer);
        else trySend();
    }, 200);
}
```

#### SitkaTools Sync Toast Pattern

In SitkaTools.html, listen for subtool updates via postMessage:

```html
<!-- Sync Toast — appears when a subtool updates the database (auto-synced) -->
<div class="sync-toast hidden" id="syncToast">
    <span class="sync-toast-icon">🔄</span>
    <span class="sync-toast-text" id="syncToastText">Subtool has updated data — views refreshed automatically</span>
</div>
```

```js
const syncToast = $('syncToast');
const syncToastText = $('syncToastText');

// Listen for subtool updates via postMessage
window.addEventListener('message', (e) => {
    if (e.data?.type !== 'sitkaGit_db_update' || !e.data.payload) return;

    DB.data = e.data.payload;
    DB.ensureStructure();

    // Re-render all views with fresh data
    updateStatusBar();
    renderLotList();
    updateLotIdSuggestion();
    RoomManager.renderRoomList();
    updateRoomStatusBar();
    RoomManager.updateRoomDatalist();
    Calendar.render();
    updateCalendarStatusBar();

    syncToastText.textContent = 'Subtool has updated data — views refreshed automatically';
    syncToast.classList.remove('hidden');
    // Auto-dismiss after 3 seconds
    setTimeout(() => syncToast.classList.add('hidden'), 3000);
});
```

#### Subtool postMessage Pattern

Every subtool includes this pattern at the top of its script block:

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

        // Reconcile and render with fresh data (tool-specific calls vary by subtool)
        updateStatusBar();
        showToast('Database loaded from SitkaTools');
    }
});
```

**After every mutation (add/delete/edit), call:**
```js
notifySitkaTools();
```

This tool uses **no localStorage, sessionStorage, IndexedDB, cookies, or any browser storage APIs**. All cross-window state flows through postMessage.

#### Sync Toast CSS (Shared Across All Tools)

Include these styles in SitkaTools.html:

```css
.sync-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--bg-secondary);
    border: 2px solid var(--accent);
    border-radius: 10px;
    padding: 16px 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 16px;
    animation: slideInToast 0.3s ease-out;
}

.sync-toast.hidden { display: none; }

@keyframes slideInToast {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

.sync-toast-icon { font-size: 1.5rem; }

.sync-toast-text { color: var(--text-primary); font-size: 0.9rem; }
```

#### Why This Workflow Is Preferred

- **Zero manual steps** — no overlays, no file dialogs, no "Save Link As" popups for data transfer
- **Real-time awareness** — main app auto-refreshes all views when subtool sends postMessage update
- **Auto-dismiss toast** — confirmation toast appears and disappears after 3 seconds
- **postMessage works on `file://` protocol** — reliable cross-window communication even in browser sandbox
- **Retry mechanism** ensures DB delivery to subtool even if it loads slowly

### Main Tool — SitkaTools.html

The central hub with two modes:

1. **Lot Management:** Create new cultivation lots and close out completed lots. Each lot gets a unique ID tracked in the database.
2. **Room Manager:** Create rooms (with an optional flowering flag) and buildings, then assign rooms to buildings. A room's building is stored on the room itself (`room.buildingId`); each building mirrors its rooms in `building.assignedRooms[]`. The room form includes a "Building" dropdown so a room can be assigned to an existing building at creation time (day 1). Buildings are managed in their own editor below the room editor, styled identically.
3. **Calendar View:** Import the `DB-YY-MM-DD.json` file and render all calendar events from all tools in a unified calendar interface.

   The calendar has a **tag filter bar** at the top-left of the grid (visible only when a DB is loaded). A "＋ Add filter" button opens a dropdown grouped by tag key — **room**, **building**, **lot**, **strain**, and **task type** — listing every value present in events that already match the currently active filters, so each successive dropdown only offers values that can still produce results. Selecting a value adds it as a removable pill (with an ✕) above the calendar. Multiple values under the same key OR together (e.g. several task types at once — the menu stays open and shows a ✓ on selected options, and clicking one again deselects it), while different keys AND together. Events without a resolvable value for a filtered key are hidden (strict matching). Room/building/strain/task-type values are resolved per event: CropLabourWizard real-lot events get their physical room from the task's phase rules (cloning tasks → cloning room, veg-phase tasks → veg room, everything else → flower room), projected lots use their stored `roomId`, and equipment maintenance uses its `roomId`. Filters apply to both the calendar grid and the terminal list (which shows "N of M events" while filtering); they are session-only and never persisted to the DB. When the DB is replaced (import or subtool update), filters whose values no longer exist are dropped automatically.

   The calendar has three views selected by a group of three buttons in the nav row: **📆 Monthly** (default), **📅 7-Day**, and **🗓️ Annual**. The active view's button gains an accent highlight; clicking another button switches views immediately.

   - **7-Day view** — a vertically stacked list of seven day cards (one per day, first day on top), each with a header row (day-of-week name, full date, "Today" badge, holiday name if any, task count) and the day's events rendered as full-width rows with complete task text (time prefix when `startTime` is set). Multi-day events keep their range styling (`range-start` / `range-end` borders), completed events are struck through, and projection events are muted/dashed — same conventions as the month grid. The window slides **one day at a time** with Prev/Next; clicking any day's header re-anchors the window so that day becomes the first; "Today" re-anchors to today. The first day of the window gets an accent border highlight. The title reads "Mon D, YYYY – Mon D, YYYY — 7-Day View".
   - **Annual view** — a 12-month overview. It exists because task text is unreadable at annual scale, so each day shows only small **emoji dots** instead of event labels: one dot per distinct task type on that day (multi-day events span their full `[date, endDate]` range), using a fixed `taskType → emoji` map with a fallback to the first emoji in the event title (or 📌). A **legend** above the grid lists up to 8 task types (most frequent first) with their event counts and a "+N more…" overflow note. The view is designed to be used together with the tag filters — e.g. filtering by harvest/clone/plant dates so only a few dot colours are on screen. **Cluster detection** warns when the same task type is scheduled too close together: consecutive events of one task type whose gap (previous event's `endDate` → next event's start) is ≤ 7 days form a cluster, and every clustered day after the first gets a red inset ring plus an "N×" badge (N = cluster size). Prev/Next step **whole years** in annual mode; clicking any day cell jumps into the **7-day view with that day as the first day of the window**. The title reads "YYYY — Annual View".

### Subtools — Popup Window Convention

All subtools (GeneralEvent, CropLabourWizard, EquipmentWizard) open as centered popup windows from SitkaTools.html. They launch at **half the main app's viewport width** and **83% of the viewport height**. Each subtool's UI should be designed to fit comfortably within this window size.

## Crop Projection (Projected Lots)

Flowering rooms can hold **projected lots** — placeholder future crops that let you plan labour months ahead without creating real lots. Projected lots are generated by CropLabourWizard, stored in a dedicated map inside the shared database, and rendered as calendar events with their own `sourceTool`. They are **not** real lots: they never appear in `DB.lots`, never show up in SitkaTools' lot manager, and can be regenerated at any time.

There are two distinct operations on a room's chain: **projection** (building or refreshing the full 5-lot chain for a room with no pending reprojection) and **reprojection** (shifting the surviving chain down one slot after TBA-1 has been replaced by a real lot — see "Reprojection" below). They are different concepts and must not be conflated.

### Room Flag — `isFlowering`

Each room in `DB.data.rooms[roomId]` may carry a boolean flag:

```js
{ name, description, createdDate, assignedLots, isFlowering: true }
```

- Set via the "Flowering room" checkbox in SitkaTools' Room Manager (room form + per-room toggle row in the room detail panel).
- Only rooms with `isFlowering === true` are eligible for projection.
- The flag is informational — only CropLabourWizard reads it to decide which rooms get projection entries in its lot selector.

### Buildings — `buildings` key, `room.buildingId`

Buildings group rooms. They live in the top-level `buildings` key and are managed in SitkaTools' Room Manager (a building editor below the room editor, styled identically):

```js
DB.data.buildings = {
    "B66D": { name: "Building 66D", description: null, createdDate: "2026-09-21", assignedRooms: ["B66DG1", "B66DG2"] }
}
```

- **Source of truth for a room's building is the room itself:** `rooms.<roomId>.buildingId` (the building ID, or `null`). Each building mirrors its rooms in `buildings.<buildingId>.assignedRooms[]` for display.
- A room belongs to at most one building. Assigning a room to a building unassigns it from any other building first; removing it clears `room.buildingId`.
- The room form has a "Building" dropdown (populated from `DB.data.buildings`) so a room can be assigned to an existing building on day 1. Creating a room with a selected building registers it in that building's `assignedRooms`.
- Deleting a room removes it from its building's `assignedRooms`; deleting a building nulls out `buildingId` on all of its rooms.
- Buildings are informational — no other tool currently reads them.

### Projected Lot Map — `_CropLabourWizard.projectedLots`

The **source of truth** for projected lots lives in the top-level `_CropLabourWizard` key (the same key that holds `generations[]`):

```js
_CropLabourWizard: {
    generations: [ /* existing generation log */ ],
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
- **Config lives in the map entry** (`projectedLots[lotId].config`), not in `DB.lots[lotId]._tool_CropLabourWizard`, because projected lots are not DB lots. CropLabourWizard exposes both shapes through one unified abstraction (below).
- **The map is owned by CropLabourWizard.** SitkaTools must never read or modify entries from it. The **sole exception** is the deletion hook, which deletes exactly one entry — `{roomId}-TBA-01` — when a real lot takes that room's slot (see "Deletion Hook — SitkaTools" below).

### Projection Chain — 5 Lots, 76-Day Cadence

Each flowering room gets exactly **5** projected lots forming a chain:

- **Lot Day 0** = the lot's clone-cut date (the form's anchor date when cloning is enabled) — the day its parent clones were cut.
- Within a lot (default settings): planting = Day 0 + 14 → transplant = Day 0 + 24 (planting +10) → flip = Day 0 + 34 (planting +20) → harvest start = flip + bloomLength (default **63**) = Day 0 + 97 → trim start = harvest + 11 (7 days) → weigh/ship = trim + 8.
- **Chain rule:** Lot(k+1) Day 0 = Lot(k) harvest **start** − `chain.cloneCutBeforeHarvest` days (default 21). With the default 63-day bloom, consecutive Day 0s are exactly **76 days apart**; the 5 lots span ~420 days (~14 months). With an 8-week (56-day) recipe they are **69 days apart** (~345 days / ~11.5 months for 5 lots).
- **Projection Recipe dropdown:** the header's recipe selector sets `projectionRecipeId` (built-in `sitka-9week` by default). It only affects projection chain generation — not manual preview editing or per-lot real schedules. The bloom length comes from the selected recipe's harvest offset, and because `clone_cut` stays at harvest start − `chain.cloneCutBeforeHarvest`, the chain cadence remains correct for any recipe.
- **Anchor for Lot 1:** Lot 1's Day 0 = the "Cut Clones to Replace Lot" (`clone_cut`) day of the room's **newest real lot** — the one with the latest `createdDate` (the crop that most recently came into the room) — or that lot's start day (Day 0 / `plantingDate`) if it has no `clone_cut` event. The gate is specific to that newest lot: Project Crop is available only once **that** lot has a generated schedule (an older scheduled lot does not count); there is no "today" fallback.
- **Overwrite push-back (room-readiness gate):** overwriting a projected lot's schedule — or the room's active real lot's schedule (the newest crop that took TBA-1's slot) — pushes *later* TBA lots forward **only** when their transplant would land before the overwritten lot's new irrigation-clean + 1 day — never pulled backward. A blocking warning lists every affected lot and its delta; cancelling leaves the chain untouched. Lots already late enough stay put (their planned delay absorbs the push) and stop the cascade through them. If the overwrite leaves extra slack, later lots keep their dates (the chain may drift from its nominal cadence — Project Crop re-tightens it).

### Reprojection

**Reprojection** is what happens to a room's chain after TBA-1 has been replaced by a real lot. It is a distinct concept from projection: projection builds/refreshes the chain for a room with no pending reprojection; reprojection shifts an existing, partially-consumed chain down one slot and tops it back up to 5 lots.

**Pending-reprojection state (inferred, never stored).** A room is *pending reprojection* when its `{roomId}-TBA-01` map entry is **absent** AND at least one of TBA-2…TBA-5 is present. This state arises naturally from the deletion hook (which removes only TBA-1) and requires no stored flag — CropLabourWizard infers it on load and after every DB update. While pending, TBA-2…TBA-5 are displayed with the ⚠️ stale indicator and count toward the status-bar stale total (display-only; their events still exist). A room whose full 5-entry chain is intact is never pending, even if some entries have no events (that is ordinary staleness, healed by a normal projection).

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

Overwriting a lot's schedule via CropLabourWizard's Generate button may push its irrigation-clean past the next lot's planned transplant. Two cases trigger the push-back: overwriting a **projected** lot (e.g. delaying TBA-2's planting date), and overwriting the room's **active real lot** — the newest crop that took TBA-1's slot, whose cleaning gates the surviving TBA chain exactly as it would have while it was still TBA-1. Overwriting an *older* real lot in the same room does not push the chain (its cleaning doesn't gate the TBA lots). The same room-readiness gate as reprojection applies: each later lot's transplant must land at least **1 day** after the previous lot's irrigation-clean, and lots are pushed forward by the **minimum** needed — never pulled backward.

- **Detection:** before any mutation, `simulatedIrrigationClean` computes the overwritten lot's NEW irrigation-clean date from the form state (day0 + current offsets + durations) without writing events. For a projected-lot overwrite, `computeForwardPushPlan(roomId, index+1, newIrr)` walks slots `index+1..5`; for a real-lot overwrite it walks from the **first surviving TBA slot** (`computeForwardPushPlan(roomId, firstExistingTBAIndex, newIrr)`) — in a pending room that is TBA-2, exactly matching what overwriting TBA-01 would have done. Each step compares the lot's transplant against `previous lot's irrigation-clean + 1 day`.
- **Minimum push:** a lot earlier than the requirement shifts by exactly the shortfall (whole schedule moves by that delta, per-task offsets preserved). A lot already late enough stays put — its planned delay absorbs the push — and stops the cascade through it. Stale / position-less lots are regenerated at the required position.
- **No backward pull:** if the overwrite leaves extra slack (e.g. TBA-2 moved *earlier*), later lots keep their dates untouched; no dialog, no toast suffix. The chain may then drift from its nominal cadence — Project Crop re-tightens it.
- **User consent:** when any push is needed, a blocking `confirm()` shows the same per-lot breakdown as reprojection (`TBA-03: +5d (Mar 14 → Mar 19)`, `TBA-04: unchanged (planned delay absorbs it)`) with a headline naming the push to the next lot. **Cancel = no changes at all** (the plan is computed before any mutation).
- **Scope:** only TBA lots from the push start slot onward are affected (projected-lot overwrite: slots `index+1..5`; real-lot overwrite: first surviving TBA slot through 5); the overwritten lot's own schedule is generated normally. The gate is purely room-readiness — it does not re-anchor later lots to this lot's harvest date.

### Calendar Events — `sourceTool: 'CropProjection'`

Projected lots emit calendar events identical in shape to CropLabourWizard events, but with a distinct source tool so both tools can separate them without ever reading each other's data:

```js
{ date, endDate?, title, sourceTool: 'CropProjection', lotId: 'G1B6-TBA-01', roomId: 'G1B6', taskType }
```

- `roomId` is always present on projection events (real CLW events don't carry it) — this is what SitkaTools uses to delete a room's projections.
- **Title:** Emoji + lot ID + `, task name` (e.g., `"🌸 G1B6-TBA-01, Flip to Flower"`). Unlike real lots, the room code is **not** prepended — the projected lot ID already encodes room + `TBA` + index, so prepending it would repeat the room code twice in the title.
- **ICS export:** projection event summaries get a ` (projected)` suffix; on-screen titles stay clean.

### Deletion Hook — SitkaTools

When a **real lot is created or moved/assigned into a flowering room**, that room's TBA-1 slot is "taken" — the first projected lot no longer represents reality, but the rest of the chain still does. SitkaTools then:

1. Deletes the map entry `{roomId}-TBA-01` from `_CropLabourWizard.projectedLots` (the one permitted exception to CropLabourWizard's ownership of the map).
2. Deletes calendar events where `sourceTool === 'CropProjection' && lotId === "{roomId}-TBA-01"`.
3. **Leaves TBA-2…TBA-5 untouched** — both their map entries and their calendar events survive. The room is now *pending reprojection* (see "Reprojection").
4. Notes in the confirmation alert that the room's TBA-01 projection was removed and the room is flagged for reprojection — run **Reproject** in CropLabourWizard after generating a schedule for the new lot.

The hook is **idempotent**: if the room has no TBA-1 entry (or no projections at all), it is a no-op. No tool auto-regenerates or auto-reprojects — both are manual actions in CropLabourWizard.

### Stale Detection — CropLabourWizard

On load and after every DB update, CLW compares `projectedLots` against calendar events: a projected lot with **no** `CropProjection` events is *stale* (its events were deleted or cleared). CLW:

- Flags stale lots in the lot selector (⚠️ "needs regeneration").
- Never auto-prunes the map — stale entries persist until the user regenerates.
- **Pending-reprojection inference:** a room whose TBA-1 entry is absent while at least one of TBA-2…TBA-5 is present is *pending reprojection*. Its surviving lots (which still have events) are displayed with the ⚠️ indicator and included in the stale count — they are "stale" in the sense that they await renumbering, not regeneration. This is display-only inference; no flag is written to the DB.

### CropLabourWizard Unified Lot Abstraction

CLW code paths that read `DB.lots[lotId]` must go through projection-aware helpers:

| Helper | Real lot | Projected lot |
|---|---|---|
| `isProjectedLot(lotId)` | `false` | `true` (id in `projectedLots`) |
| `getLotRecord(lotId)` | `DB.lots[lotId]` | `{ name, strain: 'TBA', destRoom: roomName }` |
| `getScheduleConfig(lotId)` / `setScheduleConfig(lotId, cfg)` | `DB.lots[lotId]._tool_CropLabourWizard` | `projectedLots[lotId].config` |
| `eventsForLot(lotId)` | events with `sourceTool === 'CropLabourWizard' && lotId` | events with `sourceTool === 'CropProjection' && lotId` |

Threaded through: lot selector, form load/save, preview, generate, clear, schedule list, and reconciliation.

### Rule Changes — 63-Day Bloom + Dynamic Clone Cut

- **Default bloom offset** (flip → harvest): **56 → 63 days** (9 weeks). All CLW defaults, fallbacks, and anchor reconstruction use 63.
- **"Cut Clones to Replace Lot" (`clone_cut`)** is now a **derived/locked task**: always **harvest start − 21 days**, regardless of bloom length (previously flip + 42, which only equals harvest − 21 for a 63-day bloom). Its displayed offset relative to flip = bloomLength − 21.
- Cadence math at the 63-day default: clone cut Day 0 → planting +14 → transplant +24 (planting+10) → flip +34 (planting+20) → harvest +97 (flip+63) → trim start +108 (harvest+11, 7 days, ends +114) → weigh/ship +116.
- **Tightened pre-flip defaults:** transplant = planting +10 (was +14), flip = planting +20 (was +21); flower-room prep moved earlier too — coco layout +9 (day before transplant), hydrate +10 and undercanopy lights +10 (transplant day). Net effect: the next lot's transplant lands ~2 days after the previous lot's grow-room clean (tight but valid).

### UI — CropLabourWizard

- **Lot selector:** projected lots appear under their room's divider (after the room's real lots) as `🔮 G1B6-TBA-0n`; stale ones get a ⚠️ suffix.
- **Projection Recipe dropdown** in the header, to the left of Project Crop: lists the built-in recipe (labelled "(built-in)") plus every user recipe; **the built-in is the default**. Selecting one sets `projectionRecipeId`, which drives fresh projection-lot generation and chain cadence only — manual preview editing and per-lot real schedules are untouched. The bloom length comes from the selected recipe's harvest offset, and because clone cut stays at harvest − `chain.cloneCutBeforeHarvest`, the chain cadence remains correct for any recipe.
- **Task Recipe dropdown** in the form row plus a **✏️ Manage** button: selects the recipe used for the currently selected lot's schedule (persisted as `recipeId` on Generate) and opens the recipe manager overlay, whose list view also holds the ⬆️ Import / ⬇️ Export buttons. See "Task Recipes".
- **Project Crop button** in the header, to the left of the Active Lot selector (sized to match the dropdown's height): generates/refreshes the 5-lot chain for the selected room using the currently selected bloom length. Greyed out (disabled) when the selected lot can't be projected (no lot, no flower room, or room not flagged flowering) **or** when the room's **newest real lot** (latest `createdDate`) has no generated schedule — projections anchor off that specific lot's clone-cut day, so it must be scheduled first (the tooltip names the newest lot). Never auto-runs on load or when a room flag changes.
- **Reproject label swap:** when the resolved room is *pending reprojection*, this same button's label swaps from "🔮 Project Crop" to "🔁 Reproject". It stays disabled — with a tooltip explaining that the room's new lot needs a generated schedule first — until the room's active real lot has a CropLabourWizard schedule; it then runs the reprojection algorithm (see "Reprojection") instead of a fresh projection.
- **Clear Projections button** in the header, next to Project Crop: deletes **all** of the resolved room's projections — every `CropProjection` event for the room **and** all of its map entries (TBA-1…TBA-5) — so the next "Project Crop" starts from a completely fresh chain. A confirmation dialog warns before wiping. Enabled only when the resolved flowering room has at least one projected entry or projection event; disabled otherwise with an explanatory tooltip.
- Selecting a projected lot loads its stored config into the same form; Generate/Clear operate on `CropProjection` events and the map entry's config.
- **Status bar** shows: flowering rooms, projected lots (with stale count — pending-reprojection lots are included in the stale count).

### UI — SitkaTools

- Room form gains a "Flowering room" checkbox; each room's detail panel has an isFlowering toggle row.
- Calendar renders projection events with a dashed/muted chip style (`.day-event.projection`).

## Task Recipes

CropLabourWizard's cultivation tasks are **data-driven** via self-contained recipe files rather than a hard-coded task array. A recipe is a JSON document that fully describes the ordered list of tasks, their reference anchors, default offsets, and optional per-task room phase. The built-in default recipe (`sitka-9week`) lives in code; user-created and imported recipes live in the shared DB.

### Recipe JSON Schema

```json
{
  "id": "sitka-9week",
  "name": "Sitka Standard (9-week bloom)",
  "version": 1,
  "chain": { "cloneCutBeforeHarvest": 21 },
  "tasks": [
    {
      "taskType": "planting",
      "name": "Planting Clones",
      "emoji": "🌱",
      "reference": "cloning",
      "defaultOffset": 14,
      "hasToggle": false,
      "defaultEnabled": true,
      "isLocked": false,
      "roomPhase": "veg"
    }
  ]
}
```

- **`id`** — unique identifier. Built-in is `sitka-9week`. User recipes get a fresh 6-char id from the suite's `CODE_ALPHABET` (`abcdefghjkmnpqrstuvwxyz23456789`), collision-checked against the built-in and existing DB recipes.
- **`name`** — human-readable label shown in selectors.
- **`version`** — integer, for forward compatibility.
- **`chain.cloneCutBeforeHarvest`** — positive integer (default `21` when absent). The clone-cut task is *derived*, not independently offset: it always lands at harvest start − this many days, so it follows bloom length automatically.
- **`tasks[]`** — the ordered task list. **Array order is load-bearing**: it is the chronological display order and drives the pre/post-transplant room split (see Compatibility below). Each task:
  - `taskType` — unique, non-empty `snake_case` id (e.g., `flip`, `harvest`). Stable across recipes; this is what other tools key on.
  - `name` / `emoji` — display label + icon.
  - `reference` — the anchor the offset is measured from: one of `cloning`, `planting`, `flip`, `harvest`, `trim`. The referenced anchor must exist in the recipe (except `cloning`, which is always available as Day 0).
  - `defaultOffset` — integer days from the reference (clamped −30…+365 on import/save).
  - `hasToggle` / `defaultEnabled` — optional. When `hasToggle` is true the task can be switched off in the preview; `defaultEnabled` sets its initial state (IPM sprays default to `false`).
  - `isLocked` — optional. Locked tasks (e.g., the derived clone cut) are not user-editable.
  - `roomPhase` — optional. One of `cloning`, `veg`, `flower`. When present, it is written onto generated events and overrides the order-based room split for that task.

### Validation Rules

Enforced on **import** and on **in-wizard save** (the same `validateRecipe()` runs both paths). A recipe is rejected with a list of errors if any rule fails:
- **Mandatory tasks:** `planting`, `flip`, and `harvest` must each be present. `trim` is optional, but if *any* task references `trim`, then a `trim` task must exist.
- **Reference integrity:** every `reference` ∈ {`cloning`,`planting`,`flip`,`harvest`,`trim`} and the referenced anchor task must exist (`cloning` is always available as Day 0).
- **taskType uniqueness:** non-empty, `snake_case`, unique within the recipe.
- **defaultOffset:** integer (clamped −30…+365).
- **chain.cloneCutBeforeHarvest:** positive integer (defaults to 21 when absent).

### Database Keys — `_CropLabourWizard` additions

Two new keys under the tool-owned `_CropLabourWizard` key:
- **`recipes`** — a map of `id → recipe object`. Holds **only** user-created/imported recipes. The built-in `sitka-9week` is never written here; it stays in code and is always available as the fallback.
- **`taskTypes`** — a registry map of `taskType → { name, emoji, roomPhase? }`. Backfilled by `ensureStructure()` with the 32 built-in types, and **merged on every recipe save/import** (`mergeTaskTypeRegistry`) so custom task types defined in a recipe are discoverable by other tools.

### Event Contract — optional `roomPhase`

Generated CropLabourWizard events keep their existing shape and gain one **additive, optional** field:

```js
{ date, endDate?, title, sourceTool: 'CropLabourWizard', lotId, taskType, roomId?, roomPhase? }
```

- `roomPhase` (`'cloning' | 'veg' | 'flower'`) is present **only** when the recipe task specifies it. It lets consumers attribute the event to a physical room without re-deriving phase from task order. Consumers that don't know about it simply ignore it — existing behaviour is unchanged.

### Compatibility Rules (do not break)

- **taskType stability:** the 32 known `taskType` ids are stable identifiers. Other tools (SitkaTools, DailyWizard) key labels/emojis off them via hard-coded maps first, then fall back to `_CropLabourWizard.taskTypes`, then to the raw id.
- **Order vs `transplant`:** the relative position of each task against `transplant` in the array is load-bearing — it drives the pre/post-transplant room split in both CropLabourWizard and SitkaTools (`_CLW_TASK_ORDER`). Reordering tasks across the transplant boundary changes which room a task resolves to.
- **Unknown-type fallback:** a task type not in the hard-coded maps falls back to the flower (destination) room, with its label/emoji taken from `_CropLabourWizard.taskTypes` and finally the raw id. Calendar filtering works on any `taskType` string, so custom types filter correctly even before a registry entry exists.

### Recipe File Naming & No-Auto-Load

- Exported/imported recipe files follow the naming convention **`recipe-<id>.json`** (e.g., `recipe-sitka-9week.json`).
- **No auto-loading:** the tool never `fetch()`s adjacent/sibling JSON files. Under `file://`, cross-file fetches are blocked by CORS, and this is also a deliberate user requirement. Recipe import is always via an **explicit file picker** (`⬆️ Import` button → hidden `<input type="file">`).

## BC Civic Holidays

The calendar must be aware of British Columbia's **11 civic (statutory) holidays**, per the BC Employment Standards Act. Every holiday date is a pure function of its year — no external data, no network calls, consistent with the suite's browser-sandbox constraints. The final implementation will render holidays on the calendar as if they were calendar events, and tools that generate dated events will notify the user when an event falls on a holiday (see "Planned Holiday-Awareness Behavior" below).

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
### Holiday-Awareness Behavior

- **Calendar (SitkaTools) — implemented:** Each of the 11 holidays is rendered on the calendar grid by default, visually distinct from tool-generated events (amber holiday chips). Holidays are computed per year and are read-only — they are not stored in the database. Clicking a holiday chip opens a read-only detail panel; when a fixed-date holiday shifts to its observed date, the panel notes the nominal date. A "🏛️ Holidays" toggle in the calendar nav (on by default) hides/shows all holiday chips.
- **CropLabourWizard — implemented:** Each task's computed date is checked against the 11 holidays for that year (observed dates; multi-day tasks are checked across their full range). Conflicting tasks get a small amber "🏛️ Holiday" chip next to their date in both the preview and saved schedule lists, plus a conflict banner listing all affected tasks. The generate toast notes how many tasks fall on holidays. Notify only — no auto-rescheduling.
- **Tools that generate dated events — planned (GeneralEvent, EquipmentWizard):** When an event's date matches a holiday (nominal or observed), notify the user that the event falls on a BC civic holiday. Tools do not auto-reschedule — they only notify.

## Tool Registry

| Tool | Directory | Status | Description |
|------|-----------|--------|-------------|
| SitkaTools | `SitkaTools/` | Core | Lot management + unified calendar viewer |
| GeneralEvent | `GeneralEvent/` | Active | Create standalone calendar events with text, date, and emoji |
| CropLabourWizard | `CropLabourWizard/` | Active | Crop labour hour and task tracking |
| EquipmentWizard | `EquipmentWizard/` | Starting | Equipment maintenance scheduling and tracking |
| EmployeeWizard | `EmployeeWizard/` | Starting | Employee roster, work schedules, time-off booking & per-task labour hour tracking |
| DailyWizard | `DailyWizard/` | Active | Per-building daily to-do lists + that day's calendar events, with tablet-friendly check-offs |

> **Note:** Planned tools have no implementation or design yet. Do not add speculative details, APIs, or schemas for planned tools until explicitly requested.

## UI Standards — All Tools

Every tool in the suite shares a common visual theme and structural conventions. These standards ensure consistency across all tool UIs and must be followed when creating or updating any tool.

### Theme Variables

All tools use the same CSS custom properties defined by the main app. Copy these `:root` variables into every tool's `<style>` block:

```css
:root {
    --bg-primary: #1a1a2e;
    --bg-secondary: #16213e;
    --bg-card: #0f3460;
    --accent: #53d8a8;
    --accent-hover: #3fb98b;
    --text-primary: #e8e8e8;
    --text-secondary: #a8a8b8;
    --border: #2a2a4a;
    --danger: #e74c3c;
    --danger-hover: #c0392b;
    --warning: #f39c12;
    --input-bg: #1a1a3e;
    --radius: 8px;
    --shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
```

### Page Structure

Every tool follows this layout (top to bottom):

```
┌─────────────────────────────────┐
│  Header (tool name + selector)  │  ← Sticky top bar
├─────────────────────────────────┤
│                                 │
│     Tool-specific content       │
│                                 │
├─────────────────────────────────┤
│  Footer (buttons)               │  ← Sticky bottom bar
└─────────────────────────────────┘
```

**All tools use the same footer:** Close Tool button only (subtools auto-sync via postMessage).

### Header — Active Lot / Room Selector (or None for Independent Tools)

The header is a sticky top bar that contains:
1. The tool's name as a logo/title on the left.
2. A dropdown selector on the right for choosing the **active Lot**, **active Room**, or no selector at all (depending on the tool's scope).

**For lot-focused tools** (CropLabourWizard):
- The dropdown lists all lots from `DB.data.lots`.
- Label: "Active Lot"
- First option: "— Select a lot —"

**For room-focused tools** (EquipmentWizard):
- The dropdown lists all rooms from `DB.data.rooms`.
- Label: "Active Room"
- First option: "— Select a room —"

**For independent tools** (or any future tool not scoped to lots or rooms):
- No dropdown selector in the header — the header contains only the tool name.
- Calendar events generated by the tool are not tied to any specific lot or room; they are scoped solely to the tool's own dictionary in the DB (e.g., `_AbsenceWizard`).

**Header HTML pattern (lot/room-focused tools):**
```html
<header class="header">
    <div class="header-left">
        <span class="logo">🐛 IPMWizard</span>
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

**Header HTML pattern (independent tools):**
```html
<header class="header">
    <div class="header-left">
        <span class="logo">🏖️ AbsenceManager</span>
    </div>
</header>
```

**Header CSS pattern:**
```css
.header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
}

.header-left { display: flex; align-items: center; gap: 24px; }

.logo {
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.5px;
}

.header-right { display: flex; gap: 8px; align-items: flex-end; }
```

### Footer — All Tools

All tools use the same footer: a sticky bottom bar with only the Close Tool button. Changes auto-sync to SitkaTools via postMessage.

**Footer HTML pattern:**
```html
<footer class="footer">
    <button class="btn btn-secondary" id="closeToolBtn">Close Tool</button>
</footer>
```

**Footer CSS pattern:**
```css
.footer {
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    bottom: 0;
    z-index: 100;
}
```

**Footer JavaScript pattern:**
```js
// ---- Close Tool ----
$('closeToolBtn').addEventListener('click', () => window.close());
```

### Shared Component Styles

These styles are used by both header selectors and tool content forms. Include them in every tool:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.form-group label {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-weight: 500;
}

.form-group select {
    padding: 10px 12px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.95rem;
    transition: border-color 0.2s;
}

.form-group select:focus {
    outline: none;
    border-color: var(--accent);
}

.form-group select option {
    background: var(--bg-secondary);
    color: var(--text-primary);
}

.btn {
    padding: 10px 24px;
    border-radius: var(--radius);
    border: none;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-secondary {
    background: var(--bg-card);
    color: var(--text-primary);
    border: 1px solid var(--border);
}

.btn-secondary:hover { border-color: var(--text-secondary); }

.db-btn {
    padding: 8px 16px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
}

.db-btn:hover {
    border-color: var(--accent);
    background: rgba(83, 216, 168, 0.15);
}

.db-btn.export { color: var(--warning); }
```

### Popup Window Size

All subtools open as centered popup windows from SitkaTools.html at **half the main app's viewport width** and **83% of the viewport height**. Design the UI to fit comfortably within this window size.

### Shared Database Object Pattern

Every tool should include this JavaScript pattern for database handling:

```js
const DB = {
    data: null,
    fileName: '',

    get lots() { return this.data?.lots || {}; },
    get rooms() { return this.data?.rooms || {}; },
    get buildings() { return this.data?.buildings || {}; },

    ensureStructure() {
        if (!this.data) this.data = { lots: {}, rooms: {}, buildings: {}, calendarEvents: [] };
        if (!this.data.lots) this.data.lots = {};
        if (!this.data.rooms) this.data.rooms = {};
        if (!this.data.buildings) this.data.buildings = {};
        if (!this.data.calendarEvents) this.data.calendarEvents = [];
        return this.data;
    },

    // Sync all in-memory changes before export.
    // Call this BEFORE serializing DB.data for save.
    // Subtools override or extend this to flush any pending state (e.g., staged events, buffered edits).
    sync() {
        this.ensureStructure();
        return this.data;
    }
};

const $ = id => document.getElementById(id);
```

const $ = id => document.getElementById(id);
```

### Populating the Lot / Room Selector

After loading a database (or on initial render), populate the selector dropdown:

```js
// For lot-focused tools:
function populateLotSelector() {
    const sel = $('activeLot');
    sel.innerHTML = '<option value="">— Select a lot —</option>';
    for (const [id, lot] of Object.entries(DB.lots)) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${id} — ${lot.name || 'Unnamed'} (${lot.strain || '?'})`;
        sel.appendChild(opt);
    }
}

// For room-focused tools:
function populateRoomSelector() {
    const sel = $('activeRoom');
    sel.innerHTML = '<option value="">— Select a room —</option>';
    for (const [id, room] of Object.entries(DB.rooms)) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${id} — ${room.name || 'Unnamed'}`;
        sel.appendChild(opt);
    }
}
```

## Development Conventions

### HTML Files
- Self-contained: all CSS in `<style>` tags, all JS in `<script>` tags
- Semantic HTML5 elements where appropriate
- Responsive-friendly layout (tools may be used on tablets in grow rooms)

### Cultivation Modules Section (SitkaTools.html)
- The bottom of `SitkaTools.html` contains a "Cultivation Modules" card that links to all sibling tools
- All links use relative paths (`../<ToolName>/<ToolName>.html`) — never absolute or `file://` URLs
- Links have class `module-link` and are handled by JS: they open as centered popup windows via `window.open(url, '_blank', features)`
- Clicking a module link sends the current DB to the subtool via `postMessage` (type `sitkaGit_db`) after opening
- When adding a new module, add a link entry with class `module-link`, an emoji icon, tool name, and one-line description matching the Tool Registry
- Clear file header comment with tool name, purpose, and database keys used

### JavaScript
- `type="module"` scripts are acceptable for modern ES module features
- **postMessage is used for cross-window data sharing**: Main app sends DB payload to subtool via postMessage after opening; subtools send updates back via postMessage after every mutation. No localStorage, sessionStorage, IndexedDB, or cookies are used.
- File I/O via `<input type="file">` for reading and `URL.createObjectURL()` + `<a download>` for exporting
- No `async/await` on network calls — there are none

### CSS
- Modern CSS with custom properties (CSS variables) for theming
- Clean, readable grow-room-friendly contrast ratios
- Prefer CSS Grid/Flexbox for layouts

### JSON Database
- Always use ISO date strings (`YYYY-MM-DD`) for dates in data
- Use 2-digit year (`YY`) in filenames only
- Lot IDs should be stable strings (e.g., `LOT-001`, or a timestamp-based ID)
- When exporting, always include the full database state — tools should not produce partial diffs
