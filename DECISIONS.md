# Decisions

The dated decisions behind the current design, one line each, newest first. The rules themselves live in the CLAUDE.md files; this file only records when each was decided. It is not loaded into sessions automatically.

Format: `date · decision`. "undated" means the doc recorded no date.

## Suite and SitkaTools

- 2026-10-25 · lot moves between buildings have no Send or Accept: a lot moves when its grow log records a room in another building (the Room question lists every building's rooms; a lot with no grow log moves when its room is set in the Lot Manager); the sending building's file keeps the move and the lot's pages until the receiving building's device picks it up by itself when it opens the files; then the sender drops its copy. Only the receiving building picks up (the office by opening the files as it)
- 2026-10-25 · close-out with split files writes only Main (a close-out notice); each building drops the lot from its own file with its next save after seeing it; 🧹 in the close-out panel lets the office clear the building files itself when the tablets are out of hours; a closed-out lot's id isn't reused. Single-file DBs unchanged
- 2026-10-25 · files pass between devices only by being read; only a building tidies its own file (hand-off leftovers, moved transfer records), and the office writes a building's file only with work it did for that building, never just to tidy it
- 2026-10-25 · facility forms (destruction, inventory logs) are one record in Main.json that every building adds to at once: a building device queues what it adds in its own file, the office merges every building's additions into Main (new entries by id, blanks filled, nothing changed or removed), and the building releases them once Main has them. Buildings only add; what's on file is changed at the office. Building forms are saved in their building's file
- 2026-10-25 · 🖨️ Print year (Annual view only) prints the year's filtered tasks on one landscape page for a black-and-white printer: a letter code per task type with a legend instead of emoji
- 2026-10-22 · new lots may say who the plants came from (Received from, optional) and keep the count they started with; close-out warns when the lot's plant history isn't saved for the CTLS numbers
- 2026-10-22 · SitkaTools and PaperWizard left open overnight roll over to the new day by themselves (each minute, tab shown, focus): what showed today follows it, anything picked by hand stays put; DailyWizard already did
- 2026-10-22 · 🔒 a lot with a grow log is locked to it: plant count, phase and room change only through PaperWizard (Lot Manager read-only, no delete, its room can't be deleted or re-homed; Accept still sets the room); close-out needs 0 plants and finished daily pages with no grow-log gaps (no harvest log required); a split from a locked parent takes only plants its grow log recorded as moved; planned rooms stay editable
- 2026-10-22 · a session closed without saving stays in the browser however old (no 12-hour limit, tools included) and is offered back on every start ("Session closed without saving on MM/DD at HH:MM. Restore session?") until restored or discarded; a save forgets it. Building tablets stay on SitkaTools and reopen the files only when a lot arrives
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

- 2026-10-24 · every task shows its day of the plant's life (the clone-cut day is day 1; the life ends with the harvest's last day, or Retire Mothers) and "day N after harvest" after it, in the recipe editor, the preview and the printed recipe; on screen Day 0 is called day 1. 🖨️ Print on each recipe in Manage Recipes opens a print-ready window like the other prints
- 2026-10-24 · built-in Late Flower Leaf Pick one day later: bloom days 40–41 (flip +40, was +39), Wednesday–Thursday after the Friday flip; Early stays on days 17–18 (Monday–Tuesday); all three built-ins; lots already generated keep their dates
- 2026-10-24 · harvest is one day on day 63 (flip + 63) by default, as it already was for new lots and projections; unticking Multi-day now keeps the harvest on its last day (was its first), so a 2-day Thursday–Friday harvest becomes a one-day Friday harvest with its clean-up, clone cut, trim and next lot unchanged
- 2026-10-24 · ⚠️ when a room's newest real lot cuts clones on a different day from TBA-01, both clone-cut tasks say "Does not match projection schedule. Adjust in real lot to match distance from harvest to projections." with both days, in CropLabourWizard (preview, live as you edit, and saved schedule) and on SitkaTools' calendar bars, tooltip and event panel; notify only, nothing moves
- 2026-10-24 · projections count from the previous lot's last harvest day (harvest end − the next lot's recipe's clone-cut days), not from its own "Cut Clones to Replace Lot" event, so a room reloads the Monday after a Friday harvest end and flips that Friday; lots scheduled with older recipes had kept that clone cut 21 days before harvest (some from the harvest's first day), which moved every projected lot in on a Saturday or Sunday
- 2026-10-24 · built-in leaf picks moved: Early Flower Leaf Pick on bloom days 17–18 (flip +17, was +21), Late on days 39–40 (flip +39, was +42), both 2 days, counting flip day as day 0; all three built-ins
- 2026-10-23 · three built-in recipes replace the one 76-day built-in, so every room harvests on a Friday and the next lot transplants the Monday after and flips on the Friday, a new lot every 70 days: 20-day veg with Saturday cuts (harvest −27, the default, keeps the id `sitka-9week`), 19-day with Sunday cuts (−26), 18-day with Monday cuts (−25). Flower-room prep is the day before transplant; second veg spray, veg room clean and Deploy IPM the day after; prune on flip day
- 2026-10-23 · rooms designated Mother project their next mother lots (5-lot chain from the newest mother lot's 🌿 recipe, each from the previous one's replacement cut), with no room-ready rule; SitkaTools' TBA-01 hook covers Mother rooms; PaperWizard needs no pre-move-in clean for a Mother room; the Lot Manager has a Mother stage
- 2026-10-23 · 🌿 vegetative recipes for mother plants: set up like a bloom recipe but with no flip, harvest or trim; a planned Retire Mothers day; an optional Cut Clones to Replace Mothers task starts the next mother lot; no room-ready rule; the recipe kind is the only mother flag (copied to the lot's config). Any task may repeat every N days until the crop's end, each repeat its own event
- 2026-10-22 · a recipe supply can be charged per plant at a task (clone cubes at Cutting Clones, rockwool at Planting, coco at Transplanting): the lowest plant count the grow log recorded on that task's calendar day; a lot without the task isn't charged (bought clones: Cutting Clones off, and the clone itself is a per-plant supply); no spares percentage
- 2026-10-17 · built-in recipe runs both leaf picks (Early/Late Flower Leaf Pick) for 2 days
- 2026-10-16 · 🧪 Inputs tab added (shared price list + supplies per recipe) for the total cost per gram
- undated · never auto-load sibling recipe JSON files; recipes are imported only through an explicit file picker
- undated · default bloom (flip → harvest) is 63 days / 9 weeks (was 56)
- undated · clone_cut is an ordinary recipe task counted back from harvest end (−21), editable (was derived from harvest start and locked)
- undated · tighter pre-flip defaults: transplant planting +10 (was +14), flip planting +20 (was +21), coco layout +9, hydrate and undercanopy lights +10
- undated · Generate carries annotations (completion, labour, event-panel fields) over to the new events (ROADMAP 0.3)

## DailyWizard

- 2026-10-25 · 🧰 Miscellaneous labour: a built-in row in every building's list (not a stored task; code `misc`) with ⏱ Log and the four timers; its hours need a note saying what was done, and every other row takes an optional note; Reports count it like a whole-building chore. CTLS plant numbers keep coming from the grow logs (destruction goes through them)
- 2026-10-23 · a chore tied to a room shows only while a lot's current room is that room (ticked, hour-logged or timed chores stay); "Show N chores for empty rooms" reveals the rest; edit mode lists every chore
- 2026-10-22 · step picture packs load from the main screen for every building at once (a folder per building, or many files); the steps view keeps its buttons
- 2026-10-22 · 🔒 each floor manager has their own PIN (set by the office, kept as a salted hash in Main.json); DailyWizard asks for it to go into ✏️ edit mode and for every deletion (hours entries, whole tasks), on every device including the office; with it a floor manager may remove any entry in their building, and every removal is recorded with who approved it
- 2026-10-22 · ⏲ four pausable timers always shown on every row with ⏱ Log (today only); a timer is labelled by whoever starts it (no matching to the roster); ⏱ Log fills hours from one, rounded to the nearest 5 min, without stopping it; kept in the DB as start times (`_DailyWizard.buildings[<id>].timers`)
- 2026-10-22 · a daily chore can be tied to one of its building's rooms (optional `roomId`); changing it moves the chore's past hours too (closed-out lots keep their saved share)

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

- 2026-10-23 · shared labour (overhead) is frozen by month automatically, the first time the office opens the Reports after a month ends, kept in Wages.json; the live figure is still compared, a changed month is marked, and re-freezing keeps the earlier copy
- 2026-10-23 · costs follow the grow log: the room and phase it recorded each day place a lot (the schedule only before the log starts, and the dry and trim rooms after the plants reach 0), and each day's count shares rooms, their chores and property (the starting count only for lots with no grow log)
- 2026-10-23 · each bloom lot pays its own cutting (its Cutting Clones hours and supplies stay in its own costs); the cost per clone is growing the mothers only, broken down like the cost per gram (period vs previous by part, mother lot by mother lot); the cutting per clone is shown beside it, at the wages of the people who logged the hours (supersedes moving the cutting into the clone price)
- 2026-10-23 · an empty Mother room counts as dark (it used to be assumed lit and shared by the building's crops); with a mother lot in it, its lights run at its veg hours × the light % from that lot's grow log
- 2026-10-23 · 🌿 cost per clone: a mother lot is costed like a crop in its Mother room (its room's power, chores, property, its water, fertilizer and supplies) plus the cutting of the lots cut from it, ÷ the clones cut from it; a lot cut on site from a mother pays clones × that price automatically and its own cutting comes out (paid once, on the bloom lot's Cutting Clones task); bought clones keep the price-list price; summaries freeze the charge
- 2026-10-22 · hours added or changed in the Tasks tab (rather than on the floor in DailyWizard) need a floor manager's name, PIN and drawn initials; the entry keeps who signed it (enteredBy, editedSignoff) and when
- 2026-10-22 · 📋 CTLS month in Reports: the whole facility's plants (opening, every dated change with reason and who they went to, closing, by lot), wet cannabis hanging until its dry weight, and dry flower sent out on its dry-weight date; additions only from the Lot Manager (new lots received, sub-lots clones cut), removals only from the grow-log reasons, split lots and moves between lots not counted; closed-out lots from the history in their crop summary (version 4); 📌 Mark as filed keeps the closing numbers and the next month's opening is checked against them
- 2026-10-22 · removing hours in the Tasks tab needs a floor manager's PIN and is recorded (`labourRemovals`); office only — building devices remove hours in DailyWizard
- 2026-10-22 · room chores — a DailyWizard chore's hours go to the lots in its room that day, split by plants like electricity; worked out by Reports (nothing written to lots); chores without a room stay shared overhead

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

- 2026-10-25 · paperwork tied to no lot: Configure Sheets → Document marks a sheet 🏭 Facility form or 🏢 Building form; the Active Lot dropdown opens a 🏭 Facility cabinet and a 🏢 cabinet per building; no plant count, phase or room questions on them
- 2026-10-22 · plants sold / transferred need the company they went to (required), samples may name the testing lab (optional); kept as days[day]._removedTo and printed in the comments note
- 2026-10-22 · the wizard closes only by its ✕ (a tap beside the card or Escape no longer closes it and loses the entry); the ✕, and switching days, ask first when something entered would be lost
- 2026-10-22 · fixed: pressing Enter twice on the last answer stacked two plant-count reason dialogs, leaving a dark screen and a dead OK button; only one save runs at a time and the dialog keeps the keyboard
- 2026-10-22 · grow-log changes on edited days fixed: re-opening a page's only day to change its phase / room switches that page in place (it used to strike it and start the new page a day late, with the day put back to the old value); setting a change back rejoins the earlier page; a late re-page never overwrites the later page it stops at
- 2026-10-22 · a changed plant count needs a reason before the day saves: a drop split by reason (destroyed, culled, sampled, harvested, moved, sold / transferred), a rise with a typed reason; kept on the day and added to its comments answer so it prints
- 2026-10-22 · the harvest log records the phase (Harvesting / Drying / Curing) and room after the grow log: the last answered write the lot back, no strike-out; with split files the office's Room question lists only the lot's building
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
