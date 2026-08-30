# Bugs — SitkaTools

All bugs below are in **`SitkaTools/SitkaTools.html`** (single-file app, vanilla JS, no build step, data in a JSON "DB" object). Line numbers are approximate (Aug 2026) — grep for the quoted code to locate.

**How to test:** No Node.js on this machine. Open the HTML file in the VS Code integrated browser and drive it with `page.evaluate(...)` (Playwright runs in a Node context: use `page.waitForTimeout`, not bare `setTimeout`). After batch edits, re-read the edited region — a previous edit silently corrupted an array literal and only a browser page-error caught it.

---

## 1. ICS import corrupts timed events — HIGH (most critical)

**Location:** `CalendarIO.parseVEVENT` (~line 4870; grep `^DTSTART(?:;[^:]+)?:(\d{8})`). Dedup check in `CalendarIO.importICS` (~line 4810).

**Offending code:**
```js
const dtstartMatch = line.match(/^DTSTART(?:;[^:]+)?:(\d{8})/);
const dtendMatch = line.match(/^DTEND(?:;[^:]+)?:(\d{8})/);
```

**Why it's a bug:** The regexes are not end-anchored, so they also match the date prefix of DATETIME values — `DTSTART:20260115T140000Z` (our own export format) and Google Calendar's `DTSTART;TZID=America/Vancouver:20260115T140000`.

**User-visible symptoms:**
1. Timed events import as all-day — times silently dropped.
2. The all-day "exclusive DTEND − 1 day" rule is then applied to the date part, so a single-day timed event gets `endDate` = the day **before** its start. Such an event is invisible on the calendar grid (span check `dateStr >= start && dateStr <= end` never matches) and immediately shows as PAST DUE in the terminal panel.
3. Export→import round-trip of our own file loses every field except title/date: export writes `lotId`, `notes`, etc. into DESCRIPTION, but import only reads SUMMARY/DTSTART/DTEND.

**Fix direction:**
- Add a helper to parse `(\d{8})T(\d{6})(Z?)`: if `Z`, build a UTC Date and convert to local wall-clock (this makes both our own exports — which encode local wall-clock as Z — and genuine third-party UTC times land on the correct local time); if floating (no Z), take the digits as-is.
- DTSTART DATETIME → set `event.date` + `event.startTime`. DTEND DATETIME → set `event.endTime`, plus `event.endDate` only if the end date part differs from the start date. **No −1-day adjustment for timed events.**
- Keep the existing DATE-only behavior (including exclusive-end −1 day and the `adjustedEnd !== event.date` guard) for all-day events.
- Round-trip restoration: scan DESCRIPTION lines matching `^([A-Za-z ]+): (.*)$` and reverse-map ONLY our own known labels (export produces them via `key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())`): `Lot Id`→lotId, `Notes`→notes, `Status`→status, `Assigned To`→assignedTo, `Estimated Hours`→estimatedHours (parseFloat), `Completed`→completed ('true'/'false'), `Source Tool`→sourceTool. If ≥1 known label matched, use parsed values and do NOT dump the whole description into notes; if none matched (third-party free-form text), keep current behavior (raw description → `event.notes`).
- Include `startTime` in the dedup check so two same-title events on one day at different times both import.

**Related quirk (out of scope):** `exportICS` writes local wall-clock time with a `Z` suffix (`toICSTimestamp(new Date("dateTtime"))` → getUTC*). Round-trips fine with the fixed import, but Google/Apple would display wrong times for third parties. Optional follow-up: emit floating time (no Z).

---

## 2. `escapeHtml` doesn't escape quotes — MEDIUM

**Location:** `escapeHtml()` (~line 3415, "---- Utility ----" section). It uses textContent→innerHTML, which escapes `<`, `>`, `&` but **not `"`**.

It is used to build HTML *attributes* from user input:
- `data-lot-name="${escapeHtml(lot.name)}"` in `renderLotList`
- `data-room-name="${escapeHtml(room.name)}"` in `RoomManager.renderRoomList`
- `value="${escapeHtml(String(event[key] || ''))}"` on every event-panel input in `Calendar.renderEventPanel`

**Symptom:** a lot/room name or event title containing `"` breaks the attribute (attribute injection / broken markup).

**Fix:** add `.replace(/"/g, '&quot;')` to `escapeHtml` (it is only ever used for HTML generation, so this is safe), or introduce a dedicated attribute escaper.

---

## 3. Reschedule date picker mispositioned when scrolled — MEDIUM

**Location:** `Calendar.showReschedulePicker` (~line 4605); CSS `.terminal-reschedule-picker { position: absolute; ... }` (~line 714).

**Why it's a bug:** the picker is positioned with viewport-relative `getBoundingClientRect()` coords (`rect.bottom + 4`, `rect.left - 160`) but appended to `<body>` with `position: absolute` (document-relative). The terminal panel sits below the calendar grid, so the page is always scrolled when the picker opens — it appears offset upward by the scroll amount.

**Fix:** change the CSS to `position: fixed` (coords are already viewport-relative), or add `window.scrollX`/`window.scrollY` to the computed top/left.

---

## 4. Lot deletion leaves stale room assignments — LOW-MED

**Location:** lot delete handler in `renderLotList` (~line 3358):
```js
delete DB.lots[lotId];
markUnsaved();
updateStatusBar();
renderLotList();
```

**Why it's a bug:** the lot is not removed from any room's `assignedLots` array, and the Room tab isn't refreshed. Stale entries accumulate — `renderRoomBody` renders them as "(deleted) / Lot no longer exists in database" — until the user happens to switch tabs.

**Fix:** on delete, loop `Object.values(DB.data.rooms)` and filter the lotId out of each `assignedLots`; then call `RoomManager.renderRoomList()` + `updateRoomStatusBar()`.

---

## 5. Room names not validated unique — LOW-MED

**Location:** `RoomManager.createRoom` (~line 3470) rejects duplicate room **IDs** (`this.rooms[roomId]`) but not duplicate **names**.

**Why it matters:** lots reference rooms *by name* (`destRoom`/`vegRoom`/`cloningRoom` store the name — workspace-wide convention, see root `Agent.MD`). Duplicate names make assignment ambiguous: `deleteRoom` clears lot fields for every room sharing that name, and `updateRoomDatalist` restores selection by first name match.

**Fix:** reject duplicate names in `createRoom` (case-insensitive compare). Migrating lots to store room IDs instead of names is a much bigger change — prefer the validation.

---

## 6. Lot ID placeholder digit count — LOW

**Location:** `updateLotIdSuggestion` (~line 2421):
```js
lotIdInput.placeholder = `e.g., 0${String(nextNum).padStart(3, '0')}`;
```

**Why it's a bug:** produces "0001" (4 digits) for the first lot and "0010" for the 10th — inconsistent with the 3-digit scheme.

**Fix:** drop the extra `0` → `` `e.g., ${String(nextNum).padStart(3, '0')}` ``.

---

## 7. `Holidays.forDate` misses year-crossing Christmas — VERY LOW

**Location:** `Holidays.forDate` (~line 3960):
```js
forDate(dateStr) {
    const y = parseInt(dateStr.slice(0, 4), 10);
    return this.getForYear(y).find(h => h.date === dateStr) || null;
}
```

**Why it's a bug:** when Dec 25 falls on a weekend, the observed date shifts to Jan 1–3 of the *next* year. First occurrence: **Dec 25, 2027 (Saturday) → observed Monday Jan 3, 2028**. `forDate("2028-01-03")` only checks `getForYear(2028)`, which computes Christmas for 2028 (Dec 25, 2028) — so the shifted holiday never renders on the calendar.

**Fix:** also check `getForYear(y + 1)` and return any holiday whose observed date exactly matches `dateStr` (exact-match filter already prevents false positives).
