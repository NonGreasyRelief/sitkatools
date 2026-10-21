# Decisions

The dated decisions behind the current design, one line each, newest first. The rules themselves live in the CLAUDE.md files; this file only records when each was decided. It is not loaded into sessions automatically.

Format: `date · decision`. "undated" means the doc recorded no date.

## Suite and SitkaTools

- 2026-10-17 · a Wages.json picked by itself in 📂 Load DB is added to the open split files instead of replacing them
- 2026-10-17 · property cost (each building's monthly rent + fees) added as the sixth part of the cost per gram
- 2026-10-16 · total cost per gram — light cycles set per room (18/6 and 12/12 by default); a power bill is split between crops by estimated usage; fertilizer products are linked to their mL questions in PaperWizard's Configure Sheets (paper form unchanged); prices, rates and bills live in Main.json
- 2026-10-13 · labour hours merge entry by entry (a test found that newest-wins on the whole list dropped one side's entries)
- 2026-10-13 · every tool warns when its link to SitkaTools is lost (a test found a tool still saying "Logged 1h" after SitkaTools reloaded)
- 2026-10-13 · the Labour Log may read every hours entry in every tool; it writes nothing
- 2026-10-12 · the Labour & Cost Wizard's Reports may read every tool's data, read-only
- 2026-10-12 · no new browser storage without the user's explicit OK; the device role comes from the page link and is never stored in the browser
- 2026-10-12 · building devices only report work (paperwork, daily lists, completions, labour); the office alone creates lots and rooms and generates schedules
- 2026-10-12 · a building sees a lot when its current room or flower room is in that building; events with no lot or room show everywhere
- 2026-10-12 · lot hand-off — Send freezes the lot's paperwork; Accept moves only its unsigned pages to the receiver
- 2026-10-12 · split the DB by building (Main.json + Wages.json + one file per building), no separate plan file
- undated · Save DB keeps the right-click Save Link As… popup on every browser (Edge users save under custom names that way; it works on PCs that block downloads); a native Save dialog was tried and reverted

## CropLabourWizard

- 2026-10-17 · built-in recipe runs both leaf picks (Early/Late Flower Leaf Pick) for 2 days
- 2026-10-16 · 🧪 Inputs tab added (shared price list + supplies per recipe) for the total cost per gram
- undated · never auto-load sibling recipe JSON files; recipes are imported only through an explicit file picker
- undated · default bloom (flip → harvest) is 63 days / 9 weeks (was 56)
- undated · clone_cut is an ordinary recipe task counted back from harvest end (−21), editable (was derived from harvest start and locked)
- undated · tighter pre-flip defaults: transplant planting +10 (was +14), flip planting +20 (was +21), coco layout +9, hydrate and undercanopy lights +10
- undated · Generate carries annotations (completion, labour, event-panel fields) over to the new events (ROADMAP 0.3)

## DailyWizard

- 2026-10-18 · ⏰ Still open is also shown in All Buildings (every building's open crop/equipment tasks in one view)
- 2026-10-18 · a building device can view other buildings and All Buildings but change only its own; it opens on its own building
- 2026-10-17 · uploaded step pictures/videos are kept only while the window is open (never stored)
- 2026-10-17 · translations cover daily chores only, not crop/equipment task names; the screen's own buttons and labels translate too; languages are French, Spanish, Vietnamese, Simplified Chinese
- 2026-10-17 · an untranslated step shows blank, not English, so the floor only ever reads a real translation
- 2026-10-17 · 🗣️ Talk button opens Google Translate (English ⇄ screen language)
- 2026-10-20 · 🗣️ Talk opens in a window of its own over DailyWizard, so closing it (or Back on a tablet) returns there as it was
- 2026-10-17 · in-page two-microphone voice translator put off (would need a paid cloud service and a server/IT) → ROADMAP Phase 2
- 2026-10-13 · check-offs are one tap by anyone, recording the time and device; ticks on crop/equipment rows are saved as "today's part done"
- 2026-10-13 · ✅ Mark done asks for the floor manager's signature (name + drawn initials)
- 2026-10-12 · an hours entry is the person's name, the hours and minutes they type, and their own drawn initials (ROADMAP Phase 1)

## EquipmentWizard

- 2026-10-16 · ⚡ power use per item (watts × units × hours a day) feeds the cost-per-gram electricity estimate

## Labour & Cost Wizard

- 2026-10-17 · property cost shared by lights in use (default) or plants, so four running rooms carry a quarter each
- 2026-10-16 · shown as "Labour & Cost Wizard"; folder, file, `_EmployeeWizard` key, sourceTool and WorkCopy.TOOL keep "EmployeeWizard"
- 2026-10-16 · electricity cost from power bills or estimated usage, chosen with a radio
- 2026-10-16 · prices, rates and power bills saved in Main.json
- 2026-10-13 · Labour Log is its own tab; office sees every entry, a building device only its own building's
- 2026-10-12 · report metric tags are a drop-down on PaperWizard questions
- 2026-10-12 · closed-lot summaries kept 36 months in Main.json; lots closed without one can be imported from their archive
- 2026-10-12 · flower yield = bigs+mids+smalls+popcorn; total = flower+trim; wet = drying room on harvest day; dry = whole lot after drying
- 2026-10-12 · no $ per person; $ hidden for groups under 3 people
- 2026-10-12 · 8 h shifts by default; existing estimated-vs-actual Labour Report kept
- 2026-10-12 · live lots use today's wages; Save summary with wages open freezes labour cost in `cropCosts` (Wages.json)
- 2026-10-12 · canopy sq ft kept in `_EmployeeWizard.settings` (since replaced by the undated decision below)
- undated · canopy sq ft and light counts set on the room in Room Manager; Reports shows them read-only
- undated · work week starts Monday, current week only, no navigation
- undated · employees keyed by name; duplicate names rejected
- undated · partial time off is hour-based (`hoursOff` ranges per day)
- undated · `labour_map` / `completed` written in place on Labour-wizard events; tasks keyed by event id
- undated · per-plant math uses `lots.<id>.plantCount`
- undated · not BC-holiday-aware (except Reports' capacity and Gantt markers)
- undated · time-off event title is "🏖️ Time Off — <Name>"
- undated · grown tasks keep their date/endDate; extra work days go in `labour_map` via + Add day
- undated · empty Active Lot = global (all lots) report
- undated · deleting an employee also removes their time-off events, in the same confirm step
- undated · wages optional, no default, never invented; editable without confirmation but never shown per person in reports

## PaperWizard

- 2026-10-19 · corrections & change log for the QAP — reason required (tap chips), dates yyyy/mm/dd, signed logs can be corrected and are flagged, change log prints from its own button
- 2026-10-19 · corrections print the new value first at full size, then a small stack as tall as it: the old value struck out over the date, with the initials drawn over the date
- 2026-10-19 · only a box's latest correction prints; every change stays in the change log
- 2026-10-19 · a printed correction's date is mm/dd (the change log keeps yyyy/mm/dd); the stack is 1 pt larger (5.2 pt old value in a 10 pt box)
- 2026-10-19 · a printed correction's initials are dark grey, drawn under the date
- 2026-10-19 · number answers take digits and one decimal point; plant counts digits only
- 2026-10-19 · correction room is the box as configured, not read from the page image
- 2026-10-19 · nothing prints beside a tick box; its correction details are in the change log only
- 2026-10-19 · typed initials required with drawn initials (runner, repeating entries, Initialize quiz, strike pad)
- 2026-10-19 · Start on a chosen day opens on the lot's creation date (else today)
- 2026-10-19 · a box's size follows down its column; Alt/⌥-drag resizes one box only
- 2026-10-16 · boxes stacked at one x in a row are separate columns (`cfgColumnOf`)
- 2026-10-16 · repeating rows for the harvest log — quick-entry card, several tables per sheet, tap buttons for short choice lists
- 2026-10-04 · questions bind to boxes only from the field side (`field.questionId`), per column
- 2026-10 · day rows never saved print blank, not N/A
- 2026-10 · one clean form per room role (Clone/Veg/Grow/Dry/Trim); pre-move-in and post-usage trees
- 2026-10 · instances carry a room snapshot; a room change rolls over like a phase change; move-in dates come from Room answers; Drying and Trim Logs sections added
- 2026-10 · long-term, grow logs become the source of truth for lot lifecycle events (not built yet)
- 2026-10 · constant fields set once per lot via Initialize paperwork, stored per lot+sheet, daily-weekly sheets only
- 2026-10 · ✍️ Sign stamps the signature date; `signature.date` binding prints yyyy/mm/dd
- 2026-09-26 · Filing Cabinet is the first page, a pure view over entries (replaced the Fill Sheets tab)
- 2026-09-26 · pre-move-in room cleans come from the previous occupant's entries, matched at view time by room + date
- 2026-09-26 · bindings snapshot at save time; print never re-resolves live values
- 2026-09-26 · empty boxes print N/A
- 2026-09-26 · strike-out initials above the line, date below; computed, never stored
- 2026-09-26 · fill engine fully data-driven from the wizard config (v1 types were text/number/select)
- 2026-09-24 · page images are a plain `<img>` per WebP page (CSS aspect-ratio); no PDF library or CDN
- 2026-09-24 · plant count and parent lot # come from the SitkaTools lot record; parent-lot picker should also take free text (pending SitkaTools change)
- 2026-09-24 · grow-log window is a rolling 7 days from the first entry, not fixed weeks
- 2026-09-24 · early-ended log gets a diagonal strike-out; the day is saved first; the new page starts the same day (double entry)
- 2026-09-24 · IPM and harvest logs are event-driven and printed on demand
- 2026-09-24 · write-back permission limited to lot plantCount / stage / currentRoom
