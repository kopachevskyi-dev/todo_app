# Todo app — design language

Version 1 · derived from the final desktop and mobile mockups in this folder.
Every value below is taken from the mockups. Where the mockups do not show something (hover, pressed, disabled, tablet widths) the value is marked **[decision]**: it is a rule chosen to fill the gap, so you do not have to guess.

Mockup sources (open them in the design canvas: https://claude.ai/artifact/PRonDKd33UUFfaL6dtLHVp):

| Flow step | Desktop (`desktop/`) | Mobile (`mobile/`) |
|---|---|---|
| 1. Capture to backlog (Mon, Nov 2) | `Main.dc.html` | `MobileCapture.dc.html` |
| 2. Add details, plan a day (Tue, Nov 3) | `Plan.dc.html` | `MobilePlan.dc.html` |
| 3. Do it today (Wed, Nov 4) | `Today.dc.html` | `MobileToday.dc.html` |
| 4. Look back (Sun, Nov 8) | `History.dc.html` | `MobileHistory.dc.html` |
| 4b. Open a past task | right panel of `History.dc.html` | `MobileTask.dc.html` |

The `.dc.html` files are canvas sources (they load `support.js` from the design canvas), so view them in the canvas. In the canvas Play mode the links in each set connect the screens in the order above.

---

## 1. Principles

1. **One task, three places.** A task is created in the Backlog, planned into a day (Today), and remembered in History. It is always the same object with the same detail view; only its state changes.
2. **Capture is instant, detail is optional.** A title and Enter/Add is a complete task. Description, list, subtasks and day come later.
3. **Calm and light.** Soft sage ground, off-white surfaces, one warm yellow action, one blue for focus and selection. No gradients, no emoji, no decorative illustration.
4. **Color is never the only signal.** Done = filled dark check. Selected = blue border or tinted row. Missed = dashed box. List color always comes with the list name.
5. **Same components, two layouts.** Desktop shows list and detail side by side. Mobile shows them as pushed screens. Rows, fields, chips, sheets and menus share one visual language.

---

## 2. Product model the screens assume

| Concept | Rule |
|---|---|
| **Backlog** | Open tasks with no day. Count in nav = number of these. |
| **Planned** | A task with a day. It leaves the Backlog the moment a day is set. |
| **Today** | Tasks currently planned for today, grouped into open and done. Nav badge = open tasks left today (not total). Header shows "N of M done", counting only this list. |
| **Done** | Completing a task sets its day to local today in the request's time zone; reopening keeps it on local today. In History, a day's done group contains tasks with a completed event carrying that stored day, minus later reopened events carrying the same day. Moving a task to the Backlog leaves its historical completion in that group. |
| **History** | Review of days, by week. Today and past days use the same event-based done rule. Events belong to their stored day, regardless of the viewing time zone. |
| **Not done** | A task planned for a day that ended unfinished. **[decision]** It rolls over to the next day automatically and the old day shows "Moved to Thu, Nov 5". |
| **Activity log** | Each task keeps timestamped events using the wording below. Shown newest last in the detail view. |

Activity event wording (exact text, lowercase):

| Event | Text |
|---|---|
| Created in Backlog | `added to backlog` |
| Created in Today | `added to today` |
| Planned or rescheduled | `planned for {date}` |
| Completed | `completed` |
| Reopened | `reopened` |
| Moved to Backlog | `moved to backlog` |
| Missed a planned day | `missed {date}, moved to backlog` |
| Description added | `description added` |
| Subtasks added | `subtasks added` |
| List set (only detail in the event, with a stored name) | `list set to {list name}` |
| List detail without a stored name | `list added` |
| Two details merged | `{first} and {second} added` |
| Three details merged | `{first}, {second} and {third} added` |

`{date}` is the event's stored day formatted as abbreviated month and day, without a weekday or year (for example, `Nov 9`). `{list name}` is the name stored with the event, for example `Personal`. Detail names are exactly `description`, `subtasks`, and `list`, in the order first edited. Edits within 15 minutes of the first detail event merge, keeping its timestamp and each detail name once. For example, `description and subtasks added`, `description and list added`, `subtasks and list added`, or `description, subtasks and list added`; other edit orders use the same two- or three-detail template. Merged list additions use `list` rather than its name.

Quick-add rules:
- In Backlog the field creates a task with no day. Placeholder: "Add to backlog".
- In Today the field creates a task planned for today. Placeholder: "Add to today".
- New tasks appear at the top of the list.
- **Add from Backlog** (Today screen) opens the picker of the same name. Its scope is **All lists**, independent of the screen's filter. The commit button reads "Add {count} to Today" and is disabled at zero and while saving.
- Saving from the picker is all-or-nothing. After saving, close it, refresh affected views and show "Added {count} to Today" in the main notification area.
- On a conflict, keep the picker open, refetch the choices, remove ineligible tasks and retain the valid selection. Explain: "1 task was already planned elsewhere. Add the remaining 1?" (pluralize for more tasks). Other failures retain the full selection and show "Couldn't add tasks. Try again."; retry uses the same commit button.

Lists: Personal, Work, Home. Lists are optional per task (a new task has none until set). A task row shows the list dot and name only when a list is set.

---

## 3. Design tokens

### 3.1 Color

| Token | Hex | Use |
|---|---|---|
| `ground` | `#E6EADF` | Desktop page background behind the app card |
| `surface` | `#FCFCFA` | App card, main column, mobile screens, tab bar, sheets |
| `surface-side` | `#F4F5F1` | Desktop sidebar and detail panel; "no plan" week cell |
| `surface-raised` | `#FFFFFF` | Inputs, fields, outline buttons, day picker menu, week cells |
| `row-selected` | `#EEF0EA` | Selected row, selected menu item, header count pill |
| `nav-active` | `#E7EAE1` | Active nav item, active tab indicator, progress track |
| `border` | `#E1E5DC` | Field, input and outline-button borders |
| `divider-row` | `#EEF0EA` | 1px line under each list row |
| `divider-menu` | `#E8EBE3` | Menu divider, tab bar top border, action bar top border |
| `text` | `#1F2421` | Primary text, filled check, progress fill |
| `text-2` | `#3A423D` | Secondary body text, inactive nav labels, done-row titles in History |
| `text-muted` | `#5B635E` | Meta text, labels, section labels, counts (about 6:1 on `surface`) |
| `check-border` | `#AEB5AB` | Empty checkbox border, missed (dashed) box, activity dots, outline-button border (done tasks) |
| `handle` | `#D5DAD0` | Bottom-sheet grab handle |
| `primary` | `#F4C94A` | The one primary action per view (Add, Plan for…, FAB). Text on it is `text` |
| `focus` | `#2F6FDE` | Focus ring, active input border, selected day, "open" Day field, check in menu |
| `scrim` | `rgba(31,36,33,.38)` | Overlay behind mobile sheets |
| `list-personal` | `#E3686A` | Personal list dot |
| `list-work` | `#5FB4C6` | Work list dot |
| `list-home` | `#F0C24B` | Home list dot |

Rules:
- Exactly one yellow `primary` button per view.
- `focus` blue is for borders, rings and icons. Do not use it for small text.
- List dots are decoration plus a text label. Never show a dot without its name.
- New user lists **[decision]** pick from the same three hues plus: `#8E7CC3` (purple), `#6FBF8A` (green). Keep lightness similar to the existing dots.

### 3.2 Typography

Font: **Lexend** (Google Fonts), weights 400, 500, 600. Fallback: `system-ui, sans-serif`. Numerals are Lexend's default (proportional).

| Style | Size / line | Weight | Letter spacing | Use |
|---|---|---|---|---|
| App name | 22 / normal | 600 | 0 | "Tasks" in sidebar |
| H1 desktop | 40 / normal | 600 | -0.02em | Screen title (Backlog, Today, History) |
| H1 mobile | 32 / normal | 600 | -0.02em | Screen title |
| Task title, detail (desktop) | 24 / 1.25 | 600 | 0 | Detail panel title |
| Task title, detail (mobile) | 26 / 1.25 | 600 | -0.01em | Full-screen task title |
| H2 | 24 / normal (desktop), 22 (mobile) | 600 | 0 | Day heading in History |
| H3 | 17 / normal | 600 | 0 | "Subtasks", "Activity", sheet title |
| Quick-add input | 17 / normal | 400 | 0 | Capture field |
| Row title | 16 / normal | 400 (500 when selected in backlog) | 0 | Task title in lists |
| Nav item | 16 / normal | 400, 600 when active | 0 | Backlog, Today, History |
| Body | 15 / 1.55 | 400 | 0 | Description, field values, secondary nav, buttons |
| Button label | 15 / normal | 500 | 0 | Panel buttons. Small "Add" button on desktop: 14 / 500 |
| Meta | 13 / normal | 400 | 0 | Row meta, times, counts, activity lines, key chips |
| Caption/label | 14 / normal | 400–500 | 0 | Field labels ("List", "Day"), subtitle under H1 on mobile |
| Section label | 12 / normal | 500 | 0.08em, UPPERCASE | "LISTS", "DONE · 2", "NOT DONE · 1" |
| Count pill (header) | 18 desktop, 16 mobile / normal | 500 | 0 | Number next to H1 |
| Status pill | 13 / normal | 500 | 0 | "Completed at 2:20 PM" |
| Tab label | 12 / normal | 400, 600 active | 0 | Bottom tab bar |
| Week cell number | 24 desktop (600), 17 mobile (600) | 600 | 0 | Day number |

Text never uses ALL CAPS except the section label style. Truncation: row titles wrap to two lines on mobile and desktop; do not ellipsize titles. Meta lines truncate with ellipsis **[decision]**.

### 3.3 Spacing

Base unit 4px. Values used by the mockups (use exactly):

`2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 36, 44`

Named roles:

| Role | Desktop | Mobile |
|---|---|---|
| App card inset from page | 24 | none (full bleed) |
| Sidebar padding | 28 top/bottom, 16 sides | n/a |
| Main column padding | 36 top/bottom, 44 sides | screen sides 16 |
| Detail panel padding | 28 | screen sides 16 |
| Gap between major blocks in main column | 28 | 12–24 (see screens) |
| Gap between blocks in detail panel | 22 | 20 |
| List row padding | 8 vertical, 16 horizontal | 8 vertical, 16 horizontal |
| Gap inside a row (check, text, chevron) | 14 | 14 |
| Gap between row title and meta | 4 | 4 |
| Gap between dot and meta text | 8 | 8 |
| Field label column | 72 wide | 64 wide |
| Gap label to value | 12 | 12 |
| Gap between buttons in a footer | 12 | 12 |

### 3.4 Radius

| Token | px | Use |
|---|---|---|
| `r-app` | 22 | Desktop app card |
| `r-sheet` | 24 (top corners only) | Mobile bottom sheet |
| `r-popover` | 18 | Desktop day menu |
| `r-card` | 16 | Quick-add field, week cell (desktop), FAB uses 18 |
| `r-cell-m` | 14 | Mobile week cell, selected row (desktop 14), menu item (mobile) |
| `r-control` | 12 | Buttons, inputs, search, nav items, field chips, menu items (desktop), pill (header count) |
| `r-pill-status` | 10 | Status pill |
| `r-check` | 7 | Task checkbox (subtask checkbox 6) |
| `r-dot` | 4 nav dots, 3 row dots, 50% activity dots | List and activity markers |
| `r-bar` | 4 progress (8px high), 3 week bar | Progress bars |
| `r-tab` | 15 | Active tab indicator (56×30) |
| `r-fab` | 18 | Add button |

### 3.5 Borders, shadows, motion

| Name | Value |
|---|---|
| Field border | `1px solid #E1E5DC` |
| Active input / open Day field / selected week cell | `2px solid #2F6FDE` |
| Row divider | `1px solid #EEF0EA` (bottom) |
| Shadow, app card | `0 10px 40px rgba(40,50,40,.12)` |
| Shadow, day popover | `0 14px 40px rgba(31,36,33,.18)` |
| Shadow, active quick-add | `0 6px 20px rgba(47,111,222,.12)` |
| Shadow, selected week cell | `0 6px 20px rgba(47,111,222,.14)` desktop, `0 6px 16px …` mobile |
| Shadow, FAB | `0 8px 24px rgba(31,36,33,.2)` |
| Shadow, sheet | `0 -10px 40px rgba(31,36,33,.18)` |
| Focus ring | `2px solid #2F6FDE`, offset 2px, on keyboard focus only |
| Motion **[decision]** | 150ms ease-out for hover/press color changes. Sheets slide up 220ms ease-out. Check fill 120ms. Honor `prefers-reduced-motion` (no slide, instant). |

### 3.6 Icons

Inline stroke icons, `viewBox 0 0 24 24`, `fill none`, `stroke currentColor`, `stroke-linecap round`, `stroke-linejoin round`, stroke width 1.7 (1.8 for chevrons and close, 2 for plus, 2.2 for the FAB plus, 3–3.4 for checkmarks).

| Icon | Size |
|---|---|
| Nav (desktop) | 20 |
| Tab (mobile) | 22 |
| Search, field icons, calendar in Day field | 18 |
| Plus in quick-add | 20 |
| Chevron in row | 18 |
| Check in checkbox | 14 (12 in subtask box) |
| FAB plus | 24 |

Icons used: backlog (layered stack), today (calendar), history (clock), search, plus, chevron right/left, close, trash, settings (sliders), check.

### 3.7 Touch and hit targets

Minimum interactive size 44×44 everywhere. Mobile rows are 64 high, so a full row is a tap target. The 22px checkbox has a **44×44 hit area [decision]**. Completion is a native button with checkbox semantics, beside the task link; their hit areas do not overlap.

---

## 4. Components

For every component: anatomy, sizes, states. States marked **[decision]** are not drawn.

### 4.1 Task row

Completion and opening use sibling controls: a checkbox button labeled `Complete "{title}"` or `Reopen "{title}"`, followed by the task link. Tab reaches each separately; Space toggles completion and Enter on the link opens the card. Subtask progress reads `done/total`. A missed History row has a non-interactive icon + "Missed" marker outside its link, with no checkbox role.

Anatomy (left to right): checkbox, text block (title, meta line), optional trailing time (done rows) or chevron (open rows).

- Height: min 60 desktop, 64 mobile. Padding 8/16. Gap 14. Bottom divider `divider-row`.
- Title: 16, `text`. Meta: 13, `text-muted`, list dot (10×10, radius 3) + text. Meta text format: `{List} · {extra}`, extras: "1/2" (completed/total subtasks), "from backlog, 2 days", "moved to Thu, Nov 5".

| State | Look |
|---|---|
| Default (open) | Empty checkbox, title `text`, chevron right in `text-muted` |
| Hover (desktop) **[decision]** | Background `row-selected` at 50% |
| Pressed (mobile) **[decision]** | Background `row-selected` |
| Selected | Background `row-selected`, radius 14, desktop backlog title weight 500. Detail panel shows this task |
| Done | Filled checkbox, title `text-muted` (History: `text-2`), time on the right in 13 `text-muted`, no chevron |
| Missed (History) | Dashed checkbox, title `text-2`, meta carries "moved to {day}" |
| Focus (keyboard) | Focus ring on the row |

Row opens the task: desktop = shows it in the right panel, mobile = pushes the task screen.

### 4.2 Checkbox

22×22, radius 7. Subtask version 20×20, radius 6.

| State | Look |
|---|---|
| Empty | `1.5px solid #AEB5AB`, fill `#FFFFFF` |
| Done | Fill `#1F2421`, white check (stroke 3.2) |
| Missed | `1.5px dashed #AEB5AB`, fill `#FFFFFF`, not interactive in History |
| Pressed **[decision]** | Scale 0.92, 80ms |

Checking a task sets its day to local today and moves it to Today's "DONE" group with the time of completion. History also includes it in the done group for the stored completion day.

### 4.3 Quick-add field

Height min 60 (desktop and mobile sheet: 56), radius 16, `surface-raised`, plus icon at left (20), text 17.

| State | Look |
|---|---|
| Idle | `1px solid #E1E5DC`, plus icon `text-muted`, placeholder `text-muted` |
| Active, typed | `2px solid #2F6FDE`, blue shadow, plus icon blue, text `text` |
| Submitted | Field clears, new row appears at top of list. Focus stays in the field for the next task **[decision]** |

Desktop: the Add button (44 high, `primary`, radius 12, padding 0 16, 14/500) sits inside the field on the right with an "Enter" key chip (13, radius 6, background `rgba(31,36,33,.1)`). Enter and the button do the same thing. Under the field, a hint line, 13 `text-muted`: "A title is enough. Add details, a list or a day later."

Mobile: the field lives in the capture bottom sheet (4.11), opened by the FAB.

### 4.4 Buttons

| Variant | Look | Where |
|---|---|---|
| Primary | `primary` fill, no border, radius 12, label 15/500 `text`. Height 48 (panel footer, mobile action bar), 44 (inline Add, desktop), 48 (sheet Add) | Add, Plan for {day} |
| Outline | `surface-raised` fill, `1px solid #E1E5DC`, radius 12, 15/500 `text`, height 44–48, padding 0 20 | Delete (desktop), Add from Backlog |
| Outline strong | Transparent fill, `1px solid #AEB5AB`, radius 12, 15/500 | Reopen, Move to backlog (actions on a done task) |
| Icon button | 44×44 (48×48 in mobile action bar), radius 12, `1px solid #E1E5DC`, `surface-raised` | Previous/Next week, mobile Delete |
| Ghost icon | 44×44, no border, `text-muted` | Close (detail panel) |

States for all **[decision]**: hover = darken fill 4% (primary `#EDBE34`, outline fill `#F4F5F1`); pressed = darken 8% (primary `#E3AE22`); disabled = 40% opacity, no pointer; focus = ring. Delete asks for confirmation (small confirm dialog) before deleting **[decision]**.

Primary label is dynamic on the planning screen: "Plan for {Wed, Nov 4}". When the chosen day is today: "Plan for today". When the day is cleared (Keep in backlog) the primary button reads "Save".

### 4.5 Field row (List, Day)

Label (14, `text-muted`, 72px column desktop / 64 mobile) + value button.

Value button: height 44 desktop / 48 mobile, padding 0 14, radius 12, `surface-raised`, `1px solid #E1E5DC`, 15 `text`, gap 10. List value starts with a 12×12 dot (radius 4). Day value starts with an 18px calendar icon.

| State | Look |
|---|---|
| Default | As above |
| Open (menu or sheet showing) | `2px solid #2F6FDE`, text weight 500, `aria-expanded="true"` |
| Empty **[decision]** | Placeholder "No list" / "No day" in `text-muted` |

### 4.6 Day picker (menu on desktop, bottom sheet on mobile)

Same content, two shells.

Items, each with a name on the left and a load count on the right (13, `text-muted`):
1. "Today, Tue 3" — "5 tasks"
2. "Tomorrow, Wed 4" — "4 tasks" (selected in the mockup)
3. "Weekend, Sat 7" — "Free"
4. "Pick a date…" (opens a calendar **[decision]**, not drawn)
5. divider
6. "Keep in backlog" (`text-muted`)

Load counts: "N task(s)" is how many tasks are already planned that day; "Free" when 0. The counts exist to stop overplanning a day.

Selected item: background `row-selected`, weight 500, blue check (16, stroke 2.6) at the far right after the count.

| Shell | Desktop | Mobile |
|---|---|---|
| Container | Popover under the Day field, offset left 84px from field row, top 52px, width 300, padding 8, radius 18, `surface-raised`, `1px solid #E1E5DC`, popover shadow | Bottom sheet (4.11) titled "Choose a day" |
| Item | Height 44, padding 0 12, radius 12, 15px | Height 52, padding 0 12, radius 14, 16px |

Choosing an item sets the Day field and updates the primary button label. It does not commit: committing is the primary button **[decision]**. Escape or tap on the scrim closes without change.

### 4.7 Detail view (right panel on desktop, full screen on mobile)

Order of blocks, top to bottom: header (label "Task" 14/500 `text-muted`, close button on desktop; back link on mobile), title, status pill (only if done), description, fields (List, Day), Subtasks, Activity, footer actions.

- Title: editable text, in place. A labeled completion checkbox sits next to it (`Complete "{title}"` / `Reopen "{title}"`); completion and reopening keep the card open and refresh the row and day progress. Checking every subtask leaves the parent open. A secondary "⋯" button ("More task actions") opens a Delete menu item with the existing confirmation. Description: editable multi-line, 15/1.55 `text-2`. Placeholder "Add a description" **[decision]**.
- Subtasks: heading H3 17/600; rows min-height 44, 15px, checkbox 20; last row "Add subtask" with plus icon in `text-muted`. Done subtask: filled check, text `text-muted`.
- Activity: an `Activity (N)` button in the H3 heading exposes `aria-expanded`; collapsed by default when opening an open task, expanded when opening a completed task; each line 13 `text-muted` with an 8px dot (`check-border`; the "completed" event uses `text`). Format: `{Mon D}, {h:mm AM/PM} — {event}`.
- Status pill: height 32, padding 0 12, radius 10, fill `text`, white text 13/500, 14px white check. Text: "Completed at 2:20 PM" on Today, "Completed Nov 4, 2:20 PM" in History.
- Footer: desktop = pinned to panel bottom (`margin-top: auto`), one flexible planning action (or the existing completed-task action). Mobile = sticky bar, padding 12/16/20, top border `divider-menu`, flexible action. Delete lives in the title’s secondary More menu on both layouts.

Footer action by context:

| Task state | Context | Action |
|---|---|---|
| Open, no day | Backlog | Primary "Plan for {day}" (needs a day chosen; before that: "Choose a day" opening the picker) |
| Done | Today | Outline strong "Reopen" |
| Done | History | Outline strong "Move to backlog" |

Empty detail panel (desktop, nothing selected): centered 15px `text-muted` text "Select a task to add details", max width 220.

### 4.8 Sidebar (desktop)

Width basis 248. Background `surface-side`. Top to bottom: app name, search field, primary nav, lists, spacer, Settings.

- Search: height 44, radius 12, `surface-raised`, `1px solid #E1E5DC`, 18px icon, 15px input.
- Nav item: height 44, padding 0 12, radius 12, icon 20, gap 12, label 16. Count on the right, 13 `text-muted` (Backlog and Today only).

| State | Look |
|---|---|
| Default | Label `text-2` |
| Active | Background `nav-active`, label weight 600 `text`, `aria-current="page"` |
| Hover **[decision]** | Background `nav-active` at 50% |

- Lists section: label "LISTS" (section label style), items 40 high, 12×12 dot radius 4, 15px. "New list" row with plus, `text-muted`. Clicking a list filters the current screen to that list **[decision]**.
- Settings: 44 high, same as nav item without count.

### 4.9 Bottom tab bar (mobile)

Height 68, top border `divider-menu`, three equal tabs: Backlog, Today, History. Each tab: icon (22) in a 56×30 pill above a 12px label, gap 3.

| State | Look |
|---|---|
| Inactive | No pill background, label `text-2` 400 |
| Active | Pill background `nav-active` radius 15, label 600 `text`, `aria-current="page"` |

The bar is hidden on pushed task screens (they have their own action bar). It stays visible on list screens. No badges on tabs; counts live in the screen header.

### 4.10 Floating add button (mobile)

56×56, radius 18, `primary`, plus icon 24 (stroke 2.2). Position: right 16, bottom 84 (16 above the tab bar). Shows on Backlog and Today. Hidden on History and task screens **[decision]**. On Backlog it opens the capture sheet "Add to backlog"; on Today it opens the same sheet with target "today". `aria-label` changes accordingly.

### 4.11 Bottom sheet (mobile)

Anchored to the bottom edge, full width, `surface`, top radius 24, sheet shadow, padding 10 top / 16 sides / 24–28 bottom. A 40×4 `handle` bar centered at the top. Scrim `rgba(31,36,33,.38)` over everything else.

Two sheets are drawn:
- **Capture** ("New task"): label 14/500 `text-muted`, quick-add field (4.3), hint 13 "A title is enough. Add details later." on the left and `Add` primary button (48 high, padding 0 28) on the right. The keyboard is the real system keyboard (never drawn); the sheet rides above it.
- **Choose a day**: H3 title, list of day items (4.6).

Dismiss: tap scrim, swipe down, or Back **[decision]**.

### 4.12 Section label, count pill, progress

- Today: one date and day-progress summary (`2 of 5 done`), open rows first, then a "Completed" heading only when completed rows exist. Quick-add and task surfaces stay available.
- Section label: 12/500, 0.08em, uppercase, `text-muted`, padding 0 16 8. Format `DONE · 2`.
- Header count pill: next to H1, padding 4/14 desktop (3/12 mobile), radius 12 (11), `row-selected`, number 18/500 (16).
- Progress (Today): text "2 of 5 done" (14 `text-2`) above a bar 8 high, radius 4, track `nav-active`, fill `text`; fill width = completed tasks currently planned for today / all tasks currently planned for today. Min width 180 on desktop. On mobile the bar sits left of the "Add from Backlog" button.

### 4.13 Week strip (History)

**Desktop**: CSS grid, `repeat(auto-fit, minmax(min(84px,100%),1fr))`, gap 10. Each day is a button: min-height 104, padding 12/14, radius 16, `surface-raised`, `1px solid #E1E5DC`. Content, top to bottom, gap 6: weekday (13 `text-muted`, "Sun · today" on the current day), number (24/600), bar (6 high, radius 3, track `nav-active`, fill `text`), ratio text (13 `text-2`: "3 of 3", "4 of 5", "No plan").

**Mobile**: 7 equal columns, gap 4, side padding 12. Each day is a button, min-height 84, padding 10 0, radius 14, centered: weekday letter (12 `text-muted`), a 30×30 circle with the date (17/600), bar (28×5, radius 3). The ratio text is not shown on mobile; it appears in the day summary below ("4 of 5 done · 1 moved to Thursday").

| State | Look |
|---|---|
| Default | Desktop: as above. Mobile: transparent background, `1px solid transparent` |
| Selected | Border `2px solid #2F6FDE`, background `#FFFFFF`, blue shadow |
| Today | Desktop: label "Sun · today". Mobile: date circle filled `text` with white number |
| Empty day (no plan) | Desktop: background `surface-side`, ratio "No plan", empty bar. Mobile: empty bar |

Selecting a day updates the day heading, summary and groups. Week arrows move by 7 days. Header sub line: "Nov 2–8" (mobile) / "Nov 2–8 · what you planned and what you finished" (desktop). Selected day persists when switching weeks if possible, otherwise the first day with tasks **[decision]**.

Day heading (H2): "Wednesday, November 4". Summary (15 desktop / 14 mobile, `text-muted`): "4 of 5 done · 1 moved to Thursday". Groups: "DONE · n" (sorted by completion time), "NOT DONE · n".

### 4.14 Chips and meta

- List dot: 10×10 radius 3 in meta lines; 12×12 radius 4 in fields and nav.
- Key chip (desktop Add button): "Enter", 13, padding 2/8, radius 6.

---

## 5. Layout

### 5.1 Desktop

Three columns inside a rounded app card (radius 22, `surface`, min-height 892) sitting on `ground` with 24px inset.

| Column | Basis | Grow | Background | Padding |
|---|---|---|---|---|
| Sidebar | 248 | 1 | `surface-side` | 28 / 16 |
| Main | 520 | 999 | `surface` | 36 / 44 |
| Detail | 400 (max 440) | 1 | `surface-side` | 28 |

At the 1440 design width the main column is about 744 wide.

Responsive rules **[decision]** (the mockups only draw 1440 and phone):

| Window width | Layout |
|---|---|
| ≥ 1216 | Three columns, as drawn |
| 768 – 1215 | Sidebar + main. Detail opens as a right drawer (width 400) over the main column with a scrim. Closing returns to the list |
| ≤ 767 | Use the mobile layout (section 6) |

The app card keeps its 24px inset until 1216; below it the card goes edge to edge (radius 0).

### 5.2 Screen anatomy, desktop

All three list screens use the same main-column structure: header, quick-add (Backlog, Today only), list. History replaces quick-add with the week strip.

| Screen | Header | Content |
|---|---|---|
| Backlog | H1 "Backlog", count pill, sub line "Everything you need to do someday. No date until you plan it." | Quick-add, task rows |
| Today | H1 "Today", date line "Wednesday, November 4"; progress block on the right | Quick-add + "Add from Backlog" button on one line, open rows, then a "Completed" heading and completed rows |
| History | H1 "History", sub line, prev/next week buttons | Week strip, day heading + summary, "DONE · n", "NOT DONE · n" |

---

## 6. Mobile

Design size 390×844. Works from 360 wide up. No fake status bar and no fake keyboard are drawn; leave the system areas to the OS and respect safe-area insets (`padding-bottom: env(safe-area-inset-bottom)` on the tab bar and on sticky action bars).

### 6.1 Navigation model

- **Three tabs** at the bottom: Backlog, Today, History. They replace the sidebar. Lists (Personal, Work, Home) become a filter on the Backlog and Today headers **[decision]**; Search and Settings live behind a header icon on each tab **[decision]**, not drawn.
- **One + button** (FAB) for capture, reachable by the thumb at bottom right.
- **Task opens as a full screen** pushed on top of the tab screen, with a "‹ {Previous screen}" back link at top left (44 high) and a sticky action bar at the bottom. The tab bar is hidden there.
- **Choosers are bottom sheets**, never popovers: capture, day picker.
- **The scrolling area** is the middle region; header scrolls with content, tab bar and action bar stay fixed.

### 6.2 Layout rules

| Area | Rule |
|---|---|
| Screen side padding | 16 |
| Header | 24 top, 16 sides; H1 32/600; sub line 14 `text-muted` |
| Row | 64 min height, full-width, divider |
| Bottom clearance for FAB | 96px extra bottom padding at the end of the list |
| Week strip | 7 columns, no horizontal scroll |
| Detail screen | Back link row (8 padding), then content padding 12/16/24, gap 20, sticky action bar |

### 6.3 Desktop to mobile mapping

| Desktop | Mobile |
|---|---|
| Sidebar nav | Bottom tab bar |
| Search field in sidebar | Search icon in screen header **[decision]** |
| Lists in sidebar | List filter chips under the header **[decision]** |
| Quick-add field in the list | FAB + capture bottom sheet |
| Detail panel | Full-screen task screen |
| Day popover | "Choose a day" bottom sheet |
| Week strip with ratio text | Compact week strip; ratio in the day summary |
| "⋯" More menu with Delete | Same More menu and confirmation |
| Panel Close button | Back link |
| Hover states | Pressed states |

---

## 7. The core flow (both platforms)

One task, "Renew driver's license", across the four moments. This is also the test script for the finished app.

| # | Moment | User action | Result in the app |
|---|---|---|---|
| 1 | Mon, Nov 2, 9:12 AM | Types the title in the quick-add field and presses Enter (desktop) or taps + then Add (mobile) | Task is created in the Backlog at the top, no list, no day, no description. Backlog count 7 → 8. Activity: "added to backlog" |
| 2 | Tue, Nov 3, 8:03 PM | Opens the task from the Backlog. Writes a description, adds 3 subtasks, sets the list to Personal | Activity: "description, subtasks and list added" |
| 2b | Tue, Nov 3, 8:05 PM | Opens the Day field, sees "Tomorrow, Wed 4 — 4 tasks", picks it, presses "Plan for Wed, Nov 4" | Task leaves the Backlog (count 8 → 7), appears in Today on Wed. Activity: "planned for Nov 4" |
| 3 | Wed, Nov 4, 2:20 PM | Checks the task off in Today | Task moves to "Completed" with time 2:20 PM. Header "2 of 5 done". Status pill "Completed at 2:20 PM". Activity: "completed" |
| 4 | Sun, Nov 8 | Opens History, taps Wed 4 in the week strip, taps the task | Day shows "4 of 5 done · 1 moved to Thursday". Task shows full activity from creation to completion. "Move to backlog" is available |

Navigation links that connect these screens in the mockups:

Desktop: `Main` (Add) → `Plan`; `Plan` (Plan for Wed, Nov 4) → `Today`; sidebar links connect Backlog, Today, History on every screen.

Mobile: `MobileCapture` (Add) → `MobilePlan`; `MobilePlan` (Plan for Wed, Nov 4) → `MobileToday`; `MobileToday` (license row) → `MobileTask`; `MobileHistory` (any done row) → `MobileTask`; `MobileTask` back → `MobileHistory`; tab bar connects the three list screens.

Counts shown across the story (use them as test fixtures):

| Screen | Backlog | Today badge |
|---|---|---|
| Mon, Nov 2 (capture) | 7 | 3 |
| Tue, Nov 3 (plan) | 8 | 1 |
| Wed, Nov 4 (done) | 7 | 3 |
| Sun, Nov 8 (history) | 7 | 2 |

Week strip data for Nov 2–8 (done of planned): Mon 3/3, Tue 4/5, Wed 4/5, Thu 3/4, Fri 2/2, Sat none, Sun 1/3.

---

## 8. Content and copy

- **Language:** simple, natural English. Sentence case everywhere. No exclamation marks.
- **Verbs for actions:** Add, Plan for…, Reopen, Move to backlog, Delete, Choose a day.
- **Dates:** weekday long in headings ("Wednesday, November 4"); short elsewhere ("Wed, Nov 4"); relative words when near ("Today", "Tomorrow", "Weekend").
- **Times:** 12-hour with AM/PM and a space: "2:20 PM". Use the device's locale format when it differs **[decision]**.
- **Counts:** "1 task", "4 tasks", "Free" (zero), "3 subtasks". "2 of 5 done".
- **Section labels:** uppercase via style, written "DONE · 2" with a middle dot.
- **Placeholders:** "Search", "Add to backlog", "Add to today", "Add a description" **[decision]**.
- **Empty states [decision]:** Backlog: "Nothing waiting. Add a task above." Today: "Nothing planned for today. Add a task or pull one from the backlog." History day: "Nothing planned this day."
- **Errors [decision]:** inline under the field, 13px, `text`, with an icon; no red-only signals.

---

## 9. Accessibility

- Contrast: `text-muted` on all surfaces is about 6:1; `text` on `primary` is above 10:1. Do not lighten `text-muted`.
- Real elements: buttons are `<button>`, navigation is `<a>` or router links, inputs have labels (`aria-label` when the label is visual only).
- Keyboard: Tab order follows visual order; focus ring on every interactive element; Enter submits quick-add; Esc closes popover, sheet and detail drawer; arrow keys move between rows and between week days **[decision]**.
- Icon-only buttons need `aria-label` (Close, Previous week, Next week, Delete task, Add task).
- Current nav item has `aria-current="page"`; the Day field uses `aria-expanded`.
- Week cells have a full-sentence label: "Wednesday, November 4: 4 of 5 done, selected".
- Checkbox state is conveyed by role/aria-checked, not color.
- Reduced motion: disable slide and scale animations.

---

## 10. Build checklist

1. Load Lexend 400/500/600. Create tokens from section 3 as CSS variables (or your platform's equivalents).
2. Build the shared components first: Task row, Checkbox, Button set, Field row, Quick-add, Section label, Count pill, Status pill, Progress bar.
3. Build the shells: Desktop three-pane layout with sidebar; Mobile tab bar + FAB + bottom sheet + pushed task screen.
4. Build the day picker once (content), render it as popover (desktop) and sheet (mobile).
5. Build the Detail view once and mount it in the right panel (desktop) and the task screen (mobile).
6. Implement the model rules in section 2 and the counts in section 7.
7. Run the flow in section 7 on both layouts as the acceptance test.

Not designed yet (explicitly out of scope for v1): the date-picker calendar, "Add from Backlog" picker, search results, list management, Settings, onboarding, empty states drawn as screens, dark theme.
