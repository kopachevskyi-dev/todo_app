# Design Language

The visual rules for the Day Planner web client (`apps/web`). Every UI change follows this file. The reference is `docs/design/inspiration.jpg`: when this file is silent, match the reference; when the two disagree, this file wins.

## 1. Principles

1. **Monospace everywhere.** One typeface, Geist Mono, for every piece of text: headings, body, inputs, buttons, numbers.
2. **Black page, soft-grey cards.** Content lives in large rounded cards on a black page. Cards are separated by space, not by borders or shadows.
3. **Big, light type.** Hierarchy comes from size and colour, not weight. Headings are large and regular weight (400); nothing is bold heavier than 500.
4. **One accent, used sparingly.** Lime is for small highlights only: chips, links, focus, the active state, the drop target. Never a large fill.
5. **Pills for actions.** Buttons, chips, tabs and toasts are fully rounded.
6. **Calm motion.** Hover and focus change colour or border in 150 ms. Nothing bounces, slides far or scales more than 2%.
7. **Generous space.** When unsure, add space, not lines.

## 2. Colour tokens

Dark is the reference and the primary theme. The app keeps following the system setting, so light is a derived variant with the same structure. Components use tokens only, never raw hex values.

| Token | Dark (reference) | Light | Use |
| --- | --- | --- | --- |
| `--color-page` | `#000000` | `#ececea` | Page background |
| `--color-surface` | `#262626` | `#ffffff` | Cards, columns, side panel, top bar |
| `--color-surface-raised` | `#323232` | `#f4f4f2` | Items inside a card: task rows, inner panels |
| `--color-surface-hover` | `#2e2e2e` | `#f7f7f5` | Hovered card |
| `--color-raised-hover` | `#3b3b3b` | `#ebebe8` | Hovered item inside a card |
| `--color-field` | `#1a1a1a` | `#f4f4f2` | Input, textarea, select background |
| `--color-line` | `#3d3d3d` | `#d6d6d2` | Hairlines, input borders, outline buttons |
| `--color-line-strong` | `#8a8a8a` | `#8a8a86` | Hovered borders |
| `--color-text` | `#ffffff` | `#0a0a0a` | Primary text |
| `--color-text-muted` | `#a3a3a3` | `#5c5c58` | Secondary text, captions, placeholders |
| `--color-text-faint` | `#6b6b6b` | `#9a9a96` | Disabled text, done tasks |
| `--color-accent` | `#dfff5f` | `#dfff5f` | Chip fill, focus ring, active marker, drop target |
| `--color-accent-text` | `#dfff5f` | `#4b6b00` | Links and accent-coloured text (readable on the page) |
| `--color-on-accent` | `#0a0a0a` | `#0a0a0a` | Text on lime |
| `--color-inverse` | `#ffffff` | `#0a0a0a` | Primary button fill |
| `--color-on-inverse` | `#0a0a0a` | `#ffffff` | Primary button text |
| `--color-danger` | `#ff8a7a` | `#b3261e` | Errors, destructive actions, high priority |
| `--color-warning` | `#f2c46d` | `#8a5a00` | Medium priority |
| `--color-info` | `#8cbae3` | `#2f628f` | Low priority |

Rules:

- Text contrast is at least 4.5:1 against its background in both themes. Muted text is for secondary information only, never for an input's value.
- Lime is never a background larger than a chip or a 2 px marker.
- User-chosen tag colours appear only as an 8 px dot inside a neutral chip, never as a text or fill colour, so any colour stays readable.
- Status is never shown by colour alone: priorities keep their text label, done tasks keep the strike-through.

## 3. Typography

Font: **Geist Mono** (variable, weights 400 and 500), self-hosted from an npm package (`@fontsource-variable/geist-mono` or `geist`), never a CDN, because the app runs locally. Fallback: `ui-monospace, SFMono-Regular, Menlo, monospace`. Turn on `font-variant-numeric: tabular-nums` globally.

| Role | Size / line height | Weight | Tracking | Use |
| --- | --- | --- | --- | --- |
| `display` | 56 px / 1.05 (40 px under 48 rem) | 400 | -0.02em | App name, empty-state hero |
| `stat` | 64 px / 1 (48 px under 48 rem) | 400 | -0.03em | Big numbers: done count, percentages |
| `h1` | 36 px / 1.2 (28 px under 48 rem) | 400 | -0.01em | Screen title |
| `h2` | 24 px / 1.25 | 400 | 0 | Column and card title |
| `body` | 15 px / 1.6 | 400 | 0 | Default text, task titles, inputs |
| `small` | 13 px / 1.6 | 400 | 0 | Meta, help text, notes |
| `label` | 11 px / 1.4, UPPERCASE | 500 | 0.06em | Section captions ("OUR MISSION" in the reference), chips |

Rules:

- Weight 500 is the maximum. Emphasis comes from size, colour (`text` vs `text-muted`) or case.
- Body text lines stay under 64 characters (`max-width: 64ch`).
- Each card starts with an optional `label` caption, then its `h2`, then content.

## 4. Spacing, radius, layout

Spacing scale (px): `4, 8, 12, 16, 20, 24, 32, 40, 56, 80`. Use Tailwind's matching steps (`1, 2, 3, 4, 5, 6, 8, 10, 14, 20`). No other values.

| Token | Value | Use |
| --- | --- | --- |
| `--radius-card` | 28 px | Cards, columns, side panel (left corners only) |
| `--radius-item` | 16 px | Task rows, inner panels, calendar cells |
| `--radius-field` | 12 px | Inputs, textareas, selects |
| `--radius-pill` | 9999 px | Buttons, chips, tabs, toasts, top bar |

Layout:

- Page: max width 1152 px (`max-w-6xl`), centred, side padding 24 px (16 px under 48 rem), top padding 32 px.
- Gap between cards: 24 px (16 px under 48 rem). Card padding: 28 px (20 px under 48 rem).
- Inside a card: 12 px between task rows, 24 px between groups.
- Top of every screen, as in the reference: the `display` app name, then a pill **top bar** (`surface`, full width, 12 px × 20 px padding) holding the screen tabs on the left. Muted context (such as today's date) on the right is optional; the current app leaves it empty.
- Below 48 rem, the Backlog/Today/Tomorrow column tabs occupy a second pill bar directly below the top bar, before the screen title. Use the same `surface`, pill radius and tab states, with 12 px padding and equal-width tabs.
- Breakpoint: one, at 48 rem, matching the existing mobile layout.

Depth: no borders on cards and no shadows on in-flow content. Only floating layers (side panel, toast, dropdowns) get a shadow: `0 24px 48px -12px rgb(0 0 0 / 0.5)` in dark, `0 24px 48px -12px rgb(0 0 0 / 0.15)` in light.

## 5. Motion and interaction states

Default transition: `transition: background-color, border-color, color, opacity, transform; duration 150ms; ease-out` (`--ease-out: cubic-bezier(0.2, 0, 0, 1)`). Floating layers enter in 200 ms with opacity 0→1 and an 8 px translate. Under `prefers-reduced-motion: reduce`, drop the translate and scale and keep only colour and opacity.

Every interactive element has all of these states:

| State | Treatment |
| --- | --- |
| Hover | One step lighter surface or stronger border, as listed per component. Only on devices with hover (`@media (hover: hover)`). |
| Focus-visible | 2 px `accent` outline, 2 px offset, same radius as the element. Never removed without a replacement. |
| Active (pressed) | `transform: scale(0.98)` on buttons and chips only. |
| Disabled | Opacity 0.4, `cursor: not-allowed`, no hover change. |
| Selected / current | Lime marker or chip, as listed per component. |

Cursor: `pointer` on everything clickable, `grab` / `grabbing` on drag handles.

## 6. Components

The current UI maps to these patterns. Keep existing roles, labels and visible text, because the E2E tests find elements by them; change only the look.

**Card** (Plan columns, History panels, reflection, settings blocks): `surface`, `radius-card`, card padding, no border. Hover on a clickable card: `surface-hover`. Header: optional `label` caption in `text-muted`, then `h2`; counts sit right-aligned in `text-muted`.

**Plan column as a drop target**: while a task is dragged over it, a 2 px inset `accent` ring (`box-shadow: inset 0 0 0 2px var(--color-accent)`), no other change.

**Task row**: `surface-raised`, `radius-item`, 12 px × 16 px padding, `body` text. Hover: `raised-hover` and the drag handle fades from `text-faint` to `text-muted`. Dragging: the lifted row gets the floating shadow and `scale(1.02)`; the gap it left is a dashed `line` outline. Done: title in `text-faint` with strike-through. Not done: `text-muted` with a small `danger` label chip.

**Checkbox**: 18 px, `radius 6px`, 1.5 px `line-strong` border, transparent. Checked: `accent` fill with a `on-accent` tick. Hover: border becomes `text`.

**Primary button** ("Sign up now" in the reference): pill, `inverse` fill, `on-inverse` text, `body` size, 10 px × 20 px padding. Hover: opacity 0.88. One per view at most.

**Secondary button** ("Learn more"): pill, transparent, 1 px `line-strong` border, `text`. Hover: border `text`, background `text` at 6%.

**Ghost button** (icon buttons, "close", "more"): no border, `text-muted`. Hover: `text` and a `raised-hover` circle or pill behind it.

**Destructive button**: secondary button with `danger` text and border. Hover: `danger` at 12% background.

**Chip** (tags, priority, "HIGH X-HEIGHT" in the reference): pill, `label` style, 4 px × 10 px padding.
- Accent chip: `accent` fill, `on-accent` text. Use for one highlighted status, such as "Today".
- Neutral chip: `surface-raised` fill, `text-muted` text. Tags use this with the user's colour as a leading 8 px dot.
- Priority chip: neutral chip whose text and a leading dot use `danger` (high), `warning` (medium) or `info` (low).

**Tabs** (Plan / History, mobile column tabs): pills inside the top bar. Inactive: `text-muted`, transparent. Hover: `text`. Active: `surface-raised` pill with `text`. No underlines.

**Input, textarea, select**: `field` background, 1 px `line` border, `radius-field`, 10 px × 14 px padding, `body` text, `text-muted` placeholder. Hover: border `line-strong`. Focus: border `accent`, no extra outline. Error: border `danger`, message below in `small` `danger` text. Labels above the field in `label` style, 8 px gap.

**Side panel** (task details): fixed to the right, `surface`, left corners `radius-card`, floating shadow, 32 px padding, enters from the right (8 px translate). Backdrop: `page` at 60% opacity. Sections divided by 24 px of space, not lines. Below 48 rem, the panel fills the screen, has square corners and uses 20 px padding.

**Toast**: pill, `surface-raised`, floating shadow, `small` text, centred at the bottom. Its action is an `accent-text` text button with underline on hover.

**Link**: `accent-text`, no underline; underline on hover (offset 4 px).

**Stat block** (done counts, history totals, "97.4%" in the reference): `stat` number in `text`, then a `body` caption in `text` (as in the reference) or `text-muted`.

**Calendar cell** (History): square, `radius-item`, `surface-raised`. Hover: `raised-hover`. Today: 2 px `accent` inset ring. Selected: `inverse` fill with `on-inverse` text. Outside the range: `text-faint`, no hover.

**History heatmap**: a neutral `color-mix(in srgb, var(--color-surface-raised), var(--color-text) N%)` scale. Empty days use `surface-raised`; days with activity mix towards `text` in proportion to tasks done (12–70%, using `12 + 58 × done / total`). Today and selected states keep the calendar-cell treatments above.

**Empty state**: inside the card, `text-muted` `body` text, centred vertically, optionally one secondary button.

**Error banner**: card-sized block, `danger` at 12% background, `danger` text, `radius-item`.

## 7. Tailwind v4 implementation

Tokens live once, in `apps/web/src/style.css`, as CSS variables mapped through `@theme`, so utilities like `bg-surface`, `text-muted`, `rounded-card` and `font-mono` exist. Light values are the defaults; dark values apply under `@media (prefers-color-scheme: dark)`. Sketch:

```css
@import "tailwindcss";
@import "@fontsource-variable/geist-mono";

@theme {
  --font-mono: "Geist Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace;
  --font-sans: var(--font-mono);
  --color-page: var(--page);
  --color-surface: var(--surface);
  /* … one line per token in section 2 … */
  --radius-card: 28px;
  --radius-item: 16px;
  --radius-field: 12px;
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
}
```

Rules for code:

- Components use token utilities (`bg-surface`, `text-text-muted`, `rounded-card`). No raw hex, no Tailwind palette colours (`red-700`), no `border-current/20`-style alpha tricks.
- Shared patterns (button variants, chip, field, card) are small components or `@utility` classes, written once and reused, not copied class strings.
- Keep the existing `.plan-board` / mobile column CSS working; restyle it with tokens.
- Do not add a UI or icon library for this. Icons, if any, are inline SVG at 16 or 20 px with `stroke="currentColor"` and 1.5 px stroke.

## 8. Checklist for every UI change

- [ ] Only Geist Mono, only weights 400/500, only sizes from section 3.
- [ ] Only colour tokens from section 2; works in dark and light.
- [ ] Only spacing values and radii from section 4.
- [ ] Every interactive element has hover, focus-visible, active and disabled states from section 5.
- [ ] Reduced motion respected.
- [ ] Layout holds at 375 px wide with no horizontal scroll.
- [ ] Existing roles, labels and visible text unchanged; E2E tests pass.
