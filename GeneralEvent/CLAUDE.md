# GeneralEvent — Tool Context

Puts quick standalone events on the shared calendar: reminders and milestones that aren't tied to a lot or room (e.g. "license renewal due", "team meeting").

- **Independent tool:** the header shows only "📌 GeneralEvent", with no selector. The footer and UI follow the root `CLAUDE.md`, and so do postMessage, `LinkLost` and `WorkCopy`.
- **Office only** (`DeviceView.OFFICE_ONLY: true`). On a building device, SitkaTools hides the link. If the tool is opened anyway, it covers the page with "Office only" and stops before loading, because calendar events go in Main.json, which a building device can't save. See root `CLAUDE.md` → "Building Device View".

## The Form

- **Fields:** event text, date (today's local date by default) and an opening emoji (📌 by default). End date and start / end time are optional.
- The end date must be on or after the start date. `endDate` is written only when it differs from `date`. Changing the start time clears an end time before it only on a one-day event (review H8).

## Calendar Events

```js
{ id: newEventId(), date, endDate?, startTime?, endTime?, title: '📋 License renewal due', sourceTool: 'GeneralEvent' }
```

- **Title:** the emoji, a space, then the text.
- No `lotId`, `roomId` or other lot fields.

## `_GeneralEvent.events` Log

- **Rows:** one per GeneralEvent calendar event, `{ id, text, date, endDate, startTime, endTime, emoji, createdAt }`. A row's `id` is its calendar event's `id`.
- **Rebuild:** `reconcileLog()` rebuilds the whole log from `calendarEvents` every time a DB arrives, both on open and on live updates. It splits the emoji and text back out of each title.
  - The rebuild replaces the log; it never merges. Old rows keyed `date|text` disappear.
  - A row keeps the `createdAt` it was first logged with; the rebuild doesn't re-stamp it (review H8).
- **✕ Delete** asks first, then removes exactly that one event by id. Another event with the same text on the same day stays.

## Messages from SitkaTools

- **Until a DB arrives** (by postMessage or from the shared working copy), Add Event is refused with "Waiting for SitkaTools…". Sending back the empty DB would replace SitkaTools' whole DB.
- **`sitkaGit_db` (open):** acknowledge, rebuild the log, render the list, show a toast.
- **`sitkaGit_db_update` (live push):** rebuild the log and the list, and leave the form alone. No ack, no toast, and nothing is sent back.

## BC Civic Holidays (implementation pending)

The rules are in root `CLAUDE.md` → "BC Civic Holidays".

- When the user picks a date that is a holiday (nominal or observed), show a gentle note, e.g. "📌 Note: Oct 12 is Thanksgiving".
- The event can still be created.
