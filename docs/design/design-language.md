# Todo app: design language

Version 3. This version replaces version 2 (sage ground, yellow primary, three-pane layout). The product model, flows and copy rules from version 2 are unchanged. The visual system, the layout and the component shapes are new.

Source of truth for the screens:

| File | What it is |
|---|---|
| `App.dc.html` | The whole app as one interactive component: Today, Backlog, Upcoming, History, task card, all sheets and toasts. It responds to window width. Props set the starting state (see section 9). |
| `Screens.dc.html` | Canvas with every screen and state, mounted from `App.dc.html`: desktop 1440 (D1–D9), tablet 960 (T1), mobile 390 (M1–M8). |
| `design-language.md` | This document. |

Open the `.dc.html` files in the design canvas, since they load `support.js` from this folder. When the doc and the mockup disagree, the mockup wins. Report the difference so the doc can be fixed.

---

## 1. Principles

1. **One light panel on a black ground.** All UI sits inside one warm-grey panel. The black ground frames it and is never used for content.
2. **White cards, grey rows.** Inside the panel, content is grouped in white cards. Inside cards, items are light grey rows. Three steps of lightness (panel, card, row) do the separation, so lines and shadows are rarely needed.
3. **Ink for structure, lime for the next action.** Near-black (`ink`) marks the active tab, done checks and progress. Lime marks the action you are likely to take next (Mark done, Add, the selected task). Use at most two lime elements per view.
4. **List color is a thin bar.** A 3px vertical bar left of the title. Color never fills a row or a card.
5. **Calm motion.** Short ease-out transitions (150–260ms). Nothing loops, nothing bounces except the check tick.
6. **One task, three places.** Same as v2: a task is captured in Backlog, planned into a day, and remembered in History. It is the same object with the same card.

---

## 2. Product model (unchanged from v2)

| Concept | Rule |
|---|---|
| Backlog | Open tasks with no day. Tab count = number of these. |
| Planned | A task with a day. It leaves the Backlog when a day is set. |
| Today | Tasks planned for today. Tab count = open tasks left today. Progress counts the whole day, even when a list filter hides rows. |
| Done | Has a completion time. Stays in its day. Unchecking reopens it in the same day. |
| Unfinished | A planned task whose day ended unfinished returns to the Backlog and keeps "was Nov 12". There is no automatic roll to the next day. |
| History | One week at a time, opening on the week that contains today with today selected. Each day shows Done and Returned to Backlog. |
| Activity | Timestamped events: Added to Backlog, Planned for {day}, Returned to Backlog, Completed. Collapsed by default on open tasks, expanded on done tasks. |

Quick add: in Backlog it creates a task with no day. Everywhere else it creates a task for today. If a list filter selects exactly one list, the new task gets that list.

Choosing Today, Tomorrow or Weekend commits immediately and shows a toast that names the destination ("Moved to Tue, Nov 17."). Delete always asks for confirmation.

---

## 3. Tokens

These are defined as CSS variables on the app root in `App.dc.html`. In code, put them in `:root` in `src/web/style.css`, replacing the v2 tokens.

### 3.1 Color

| Token | Value | Use |
|---|---|---|
| `bg` | `#0b0b0c` | Page ground behind the panel. Never holds content. |
| `panel` | `#f2f2ef` | The app panel. Also progress tracks and secondary pill buttons inside cards. |
| `card` | `#ffffff` | Cards, nav pill, search, sheets, inputs, mobile tab bar. |
| `row` | `#f6f6f4` | Task rows, option rows, week cells, small icon buttons inside cards. |
| `line` | `#ececea` | Hairlines inside cards (field rows, unfinished list), input border. |
| `ink` | `#141416` | Primary text, active tab, done check fill, progress fill, dark primary button. |
| `text-2` | `#55555c` | Secondary text, inactive tabs, notes. |
| `muted` | `#6b6b73` | Subtitles, card meta ("2 of 6 done"). |
| `meta` | `#7a7a82` | Row meta line, field labels, group labels. 4.6:1 on `row`. |
| `done-text` | `#8a8a92` | Title of a done task. |
| `check-border` | `#c4c4ca` | Empty checkbox ring. |
| `missed-border` | `#b5b5bb` dashed | Unfinished/missed checkbox. |
| `lime` | `#d4f25c` | Next-action fill: Mark done, Add (+), FAB, count on the active tab. Text on lime is `ink`. |
| `lime-soft` | `#eef9c4` | Selected task row, selected option, positive badge. |
| `lime-ring` | `#c5e34a` | 1.5px inset ring on the selected row and selected week cell. |
| `sky-soft` | `#dcecff` | Hero and quick-add gradients, neutral info badge. |
| `warm-soft` / `warm-ink` | `#ffe9e2` / `#a33c1d` | "was Nov 12" tags, "2 returned" badge, delete hover. |
| `danger` | `#d8432f` (hover `#c23a27`) | Delete confirm button only. |
| `focus` | `#4a86e8` | Keyboard focus ring (2px, offset 2px) and link hover. |
| `scrim` | `rgba(0,0,0,.45)` | Behind sheets and the tablet drawer. |

List colors (bar, chip bar, option bar):

| List | Hex | Preset name |
|---|---|---|
| Health | `#3aa77a` | Mint |
| Work | `#4a86e8` | Sky |
| Home | `#e8a33c` | Sun |
| School | `#e05a4f` | Coral |
| Knowledge | `#8b6ad8` | Lavender |
| (new list presets) | `#ee7d3b` Tangerine, `#2a9bb5` Ocean, `#b25a9c` Plum | |
| No list | `#c4c4ca` | |

Rules: the list color appears only as the 3px bar or as a small dot inside a white pill (the hero "Home" pill). The list name is always written next to it, so color is never the only signal.

Gradients appear only in these two places. Do not add more.
- Hero "Up next": `linear-gradient(110deg, #fff 30%, #dcecff 75%, #eef9c4 100%)`
- Quick add card: `linear-gradient(120deg, #fff 40%, #e3efff)`

### 3.2 Typography

Font: Lexend 300, 400, 500, 600 (Google Fonts), fallback `system-ui, sans-serif`. Base size 14px.

| Style | Size / weight | Use |
|---|---|---|
| Page title | 30 / 400, -0.02em (mobile 24) | "Monday, November 16", "Backlog" |
| Hero title | 24 / 500, -0.01em (mobile 20) | Up next task title |
| Big number | 40 / 300, -0.03em | Progress widget |
| Detail title | 20 / 500, line 1.3 | Task card title |
| Card title | 16 / 500 | "Today’s plan", "Progress", "Unfinished" |
| Sheet title | 18 / 500 | "Choose a day" |
| Row title | 14 / 400, line 1.4, max 2 lines | Task title in rows |
| Body | 13 / 400, line 1.6 | Notes, field rows, buttons |
| Meta | 12 / 400 | Row meta, card meta, group labels |
| Tag / count | 11 / 400 | "Up next", "9:40 AM", tab counts |
| Logo | 17 / 600 | "Tasks" |

No uppercase labels. Group labels are sentence case with a hairline after them: "Completed · 2 ———".

Text overflow: row titles clamp to 2 lines (`-webkit-line-clamp: 2`, `overflow-wrap: anywhere`). Meta lines, unfinished items and field values truncate to one line with an ellipsis. Detail titles and notes wrap fully. Every flex text child has `min-width: 0`.

### 3.3 Spacing

Base 4. Values: `4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 32`.

| Role | Value |
|---|---|
| Page padding around panel | 32 (≥1100), 16 (768–1099), 0 (mobile) |
| Panel padding | 20 top, 24 sides/bottom (mobile 20 / 16 / 120 bottom for the tab bar) |
| Gap between panel blocks (top bar, header, grid) | 20 |
| Gap between cards / grid columns | 16 |
| Card padding | 18 (hero 22, detail 20) |
| Row padding | 10 / 12, min-height 56, gap 12 |
| Gap between rows | 8 |

### 3.4 Radius

| Token | px | Use |
|---|---|---|
| `r-panel` | 28 | App panel (0 on mobile) |
| `r-card` | 22 | Cards, hero, detail card |
| `r-sheet` | 24 | Desktop dialog; mobile sheet top corners |
| `r-row` | 14 | Task rows, option rows, week cells, toast |
| `r-logo` | 10 | Logo tile |
| `r-pill` | 999 | Every button, tab, chip, tag, input and the nav container |
| check | 50% | Checkboxes are circles |

### 3.5 Elevation

| Name | Value | Use |
|---|---|---|
| Panel | `0 30px 80px rgba(0,0,0,.5)` | App panel on black |
| Dialog | `0 30px 80px rgba(0,0,0,.35)` | Desktop dialog |
| Drawer | `0 20px 60px rgba(0,0,0,.35)` | Tablet task drawer |
| Floating | `0 10px 30px rgba(0,0,0,.18)` | Mobile tab bar, FAB, toast |

Cards and rows have no shadow. Separation comes from the three lightness steps.

### 3.6 Motion

| Interaction | Spec |
|---|---|
| Hover on rows, buttons, chips | Inset overlay `box-shadow: inset 0 0 0 100px rgba(0,0,0,.025–.05)`, 150ms ease-out. Primary buttons also get a soft drop shadow. |
| Press | `transform: scale(.96–.98)` on buttons and `.86` on checkboxes, 150ms |
| Check | Fill 150ms, tick `scale(.4 → 1)` with `cubic-bezier(.3,1.6,.5,1)` over 200ms |
| New row | `translateY(-8px) → 0` and fade, 250ms |
| Cards on screen change | `translateY(6px) → 0` and fade, 300ms |
| Sheet (mobile) | Slide up 28px and fade, 260ms `cubic-bezier(.2,.8,.2,1)` |
| Dialog (desktop) | Scale .97 → 1 and fade, 200ms |
| Drawer / mobile task | Slide in 28px from the right, 240ms |
| Toast | Rise 10px and fade, 240ms. Auto-dismiss after 4s |
| Progress bars | Width transition 400ms ease-out |
| Reduced motion | `prefers-reduced-motion: reduce` turns off all animations and transitions |

---

## 4. Layout

| Width | Layout |
|---|---|
| ≥ 1100 | Panel max 1240 wide, centered, 32px from the edges. Two-column grid `1.7fr / 1fr`. The left column holds the main content. The right column holds widgets, or the task card when a task is open (sticky, top 20). |
| 768 – 1099 | Same panel, 16px from the edges, one column. Widgets stack under the list. The task card opens as a right drawer (380 wide, 12 from the edges) over a scrim. |
| < 768 | Panel goes edge to edge with radius 0. There is no top bar. A floating tab bar sits at the bottom with a lime FAB above it on Today and Backlog. The task card is full-screen with a Back button. Chooser dialogs become bottom sheets. The hero is hidden; the first open row shows the "Up next" tag. |

Top bar (≥768) has three areas with `flex: 1` on each side, so the nav stays centered: logo on the left, the nav pill in the center, search (240 / 180 wide) on the right.

Header row: page title and subtitle on the left, actions on the right (secondary white pill, primary ink pill). It wraps on narrow widths.

---

## 5. Components

### 5.1 Nav pill
White container, padding 4, gap 2, radius pill. Tabs are 36 high with padding 0 16, 13px. The active tab is `ink` with white text, and its count is a lime capsule (11px, height 18). Inactive tabs are `text-2` with a `panel` count capsule. Zero counts are hidden. History has no count. On mobile the same tabs fill a floating white bar (left/right/bottom 12, height 44 each, equal width) with `aria-current="page"` on the active one.

### 5.2 Buttons
All buttons are pills.
- **Primary (ink):** `ink` fill, white 13/500, height 40, padding 0 18. Examples: New task, Add, Add N to Today.
- **Next action (lime):** `lime` fill, ink 13/500. Examples: Mark done, the round + in quick add, the FAB.
- **Secondary:** white fill on panel, or `row`/`panel` fill inside a card. Examples: Add from Backlog, Open, Cancel, "Add both to today".
- **Icon:** 36 round, `row` fill. Examples: week arrows, Close, Delete (Delete hovers to `warm-soft` with `warm-ink`).
- **Danger:** `danger` fill, white text. Used only in the delete confirm.

Hit area is at least 40×40 on desktop and 44×44 on touch. Checkboxes keep a 20px visual inside a 40px button.

### 5.3 Task row
Left to right: checkbox (20 circle), list bar (3 × full height, radius 2), text block (title, then meta "Home · 1/3 subtasks"), and an optional tag on the right.

| State | Look |
|---|---|
| Open | `row` fill, empty `check-border` ring |
| Hover | Darker overlay (`rgba(0,0,0,.025)`) |
| Up next (first open row, Today, no filter) | `#f3f9dc` fill and an "Up next" tag in a white capsule |
| Selected (card open) | `lime-soft` fill with a 1.5px `lime-ring` inset |
| Done | Ink-filled check with a white tick, title in `done-text`, completion time tag ("9:40 AM") |
| Unfinished (Backlog) | Warm tag "was Nov 12" |
| Missed (History) | Dashed check, warm tag "was Nov 10". Not interactive. |

Clicking the checkbox completes the task in one tap. Clicking anywhere else opens the task card.

### 5.4 Group label
12px `meta`, followed by a 1px `line` hairline that fills the row. Formats: "Completed · 2", "Unfinished from earlier · 2", "Waiting · 4", "Tue, Nov 17 · 2", "Done · 3", "Returned to Backlog · 1".

### 5.5 List filter chips
These sit inside the list card under its title. Chips are 32 high, `row` fill, 12px, and each list chip starts with a 12px list bar and ends with a count at 70% opacity. The active chip is `ink` with white text. "All" is active when nothing is selected. Selecting lists is multi-select. The row scrolls horizontally and never wraps.

### 5.6 Hero: Up next (Today, ≥768)
Gradient card with an "Up next" capsule on the left and a list pill on the right (white, with a dot and the list name). It shows the title, a meta line (subtask progress or the first line of the note), and Open (white) plus Mark done (lime) at the bottom right. It is hidden when nothing is open.

### 5.7 Widgets (right column)
- **Progress / Waiting / This week / Week:** card title with a badge, a big number with a unit, and an 8px progress bar (`panel` track, `ink` fill).
- **Unfinished (Today):** a badge "2 returned", rows with a dashed check, the title (ellipsis) and the date, then a secondary button "Add both to today".
- **By list (Backlog, Upcoming):** list bar, name and count. Clicking a row sets the filter to that list.
- **Quick add:** gradient card with a white pill input (focus border 1.5px `ink`) and a lime round + button. Enter submits.

### 5.8 Task card
On desktop it replaces the right column. On tablet it is a drawer, on mobile a full screen.
Order:
1. Close/Back pill and Delete icon.
2. Title row with a 24 circle checkbox.
3. Note.
4. Field rows List and Day: 44 high, label column 52, value, chevron. Hairline between them, hover turns the value `focus` blue.
5. Subtasks (title + "1/3", rows 40 high with 18 checks).
6. Activity disclosure ("Activity · 3" with a chevron and `aria-expanded`). Events show a dot, the event name and the time on a second line in `meta`. The Completed event's dot is ink.

### 5.9 Sheets and dialogs
Desktop: a centered dialog (460 wide, padding 22, radius 24). Mobile: a bottom sheet (radius 24 at the top, handle 36×4, padding 10/16/24 plus the safe area). Both are white with an 18/500 title.
- **Choose a day:** option rows (48 high, `row` fill, radius 14). Each has a name, the load ("2 tasks", "Free"), and a check when it is the current day. The current day uses `lime-soft`. Items: Today, Tomorrow, Weekend, Move to Backlog.
- **Choose a list:** option rows with a 16px list bar.
- **Add from Backlog:** the "Unfinished from earlier · N" group first, then "Backlog · N". Rows have a check, list bar, title and meta. Selected rows use `lime-soft` with an ink check. The footer button reads "Add N to Today" (ink) or "Select tasks to add" (disabled, `panel` fill).
- **New task (mobile):** a 52 high input on `row`, the hint "A title is enough. Add details later." and an ink Add button.
- **Delete:** "“Title” will be deleted. This can't be undone." with Cancel and Delete (danger).

Escape or a click on the scrim closes the top layer: sheet first, then the task card.

### 5.10 Toast
Ink fill, white 13px, radius 14, padding 12/16, max 380. Position: bottom-left on desktop, above the tab bar on mobile. It always names the destination: "Added to Today.", "Moved to Tue, Nov 17.", "Added 2 tasks to Today.", "Task deleted." Use `role="status"`.

### 5.11 Week strip (History)
White card titled with the date range ("Nov 16 – Nov 22") and round prev/next buttons. Seven equal cells (gap 6): weekday (11, "Today" for today), date number (18/500), and a 4px bar. Bar fill = done/total for past days and empty for future days. Days with nothing planned use grey text. The selected day uses `lime-soft` with the `lime-ring` inset. The list card below is titled with that day ("Mon, Nov 16") and its ratio.

### 5.12 Empty states
Centered inside the list card: 15/500 title, 13 `muted` body.

| State | Title | Body |
|---|---|---|
| Today, nothing planned | Nothing planned for today | Your Backlog has N tasks. Pick a few for today. |
| Today, filter hides all | No matching tasks today | Other lists are hidden by the filter. |
| Backlog empty | Nothing waiting | Add a task to get started. |
| Backlog, filter hides all | No matching tasks | No Backlog tasks in the selected lists. |
| Upcoming empty | Nothing planned ahead | Tasks you plan for a future day will appear here. |
| History day empty | Nothing planned this day | |

---

## 6. Screens

| Screen | Left column | Right column (≥1100) |
|---|---|---|
| Today (D1, M1) | Hero Up next, card "Today’s plan" (chips, open rows, Completed group) | Progress, Unfinished (if any), Quick add |
| Today, task open (D2, M2, T1) | Same | Task card |
| Backlog (D5, M6) | Card "All tasks" (chips, Unfinished from earlier group, Waiting group) | Waiting, By list, Quick add |
| Upcoming (D6, M7) | Card "Next days" grouped by date | This week, By list |
| History (D7, M8) | Week strip card, card for the selected day (Done, Returned to Backlog, planned) | Week % done |
| Dialogs (D3, D4, D9, M3, M4, M5) | See 5.9 | |

Header per screen: Today = "Monday, November 16" + "4 tasks left today · 2 unfinished from last week" + Add from Backlog / New task. Backlog = "Backlog" + "Everything you need to do someday. No date until you plan it." + New task. Upcoming = "Upcoming" + "Tasks planned for the days ahead." History = "History" + "What you planned and what you finished."

---

## 7. Copy

Simple English, sentence case, no exclamation marks. Name the destination in every message. Dates: long in page titles ("Monday, November 16"), short elsewhere ("Tue, Nov 17"). Times: "9:40 AM". Counts: "1 task", "4 tasks", "Free", "2 of 6 done".

---

## 8. Accessibility

- Text contrast ≥ 4.5:1 on its surface. Do not lighten `meta` or `muted`.
- Checkboxes are `<button role="checkbox" aria-checked>` with labels such as `Complete "Renew driver’s license"`. Tabs use `aria-current="page"`, chips `aria-pressed`, Activity `aria-expanded`, and sheets `role="dialog"` with a label.
- The focus ring (2px `focus`, offset 2) appears on keyboard focus only.
- Touch targets are at least 44×44. Primary actions on mobile sit in the bottom third (tab bar, FAB, sheets).

---

## 9. Using the mockup

`App.dc.html` props (all optional):

| Prop | Values | Effect |
|---|---|---|
| `initialScreen` | `today`, `backlog`, `upcoming`, `history` | Starting screen |
| `initialSel` | task id (`t1`–`t6`, `b1`–`b6`, `u1`–`u5`) | Opens that task's card |
| `initialSheet` | `day`, `list`, `picker`, `capture`, `del` | Opens a sheet or dialog |
| `initialPick` | comma-separated ids | Preselects rows in Add from Backlog |
| `initialFilter` | list name | Starts with that list filter |
| `initialActivity` | boolean | Activity expanded |
| `initialWeek` | integer | History week offset from the current week |
| `forceWidth` | px | Renders the layout for that width (used by `Screens.dc.html`) |

Fixture data: today is Mon, Nov 16, 2026. Today has 6 tasks (2 done). The Backlog has 6 tasks, 2 of them unfinished (from Nov 12 and Nov 13). Upcoming has 5 tasks on Nov 17, 18 and 20. History also covers the previous week, Nov 9–15.

---

## 10. Moving from v2 to v3 in code

1. Replace the `:root` tokens in `src/web/style.css` with section 3, and load Lexend 300.
2. Body: `background: var(--bg)`. Replace `.app-shell` with the panel (section 4). Remove the sidebar and add the top bar with the nav pill. Lists move into the list card as chips.
3. Change `.task-row` to the grey row of 5.3 and add the list bar. The checkbox becomes a circle.
4. Today: add the hero (5.6) and the right-column widgets (5.7). The task panel becomes the right column, the drawer or the full screen (5.8).
5. Mobile: use the floating tab bar, the round lime FAB and bottom sheets.
6. Keep all data, hooks and API calls as they are. The changes are visual and structural only.
