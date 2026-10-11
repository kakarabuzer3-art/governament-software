# Design System — Usage Rules

The product's visual identity lives in four CSS files imported by
`src/app/globals.css`. Components must reference **tokens**, never hard-coded
values, so the whole UI can be rethemed or adjusted from one place.

## 1. Files

| File | Purpose |
|---|---|
| `src/styles/tokens.css` | All design tokens as CSS custom properties (`:root`) |
| `src/styles/background.css` | The **exact supplied geometric pattern** (`.app-background`) |
| `src/styles/glass.css` | Reusable glass components: panels, buttons, badges, tables, forms, modal, chips, empty states |
| `src/styles/shell.css` | Layout: sidebar/topbar/content grid, dashboard blocks, responsive rules |

## 2. The background (mandatory)

`.app-background` is a `position: fixed; inset: 0;` layer rendered once in
`layout.tsx` with `pointer-events: none` (it can never block clicks) and
`aria-hidden="true"`. Its values are literal reproductions of the supplied
source (`--s: 200px`, `#1d1d1d`, `#4e4f51`, `#3c3c3c`, 30° conic repeats,
`calc(0.5 * var(--s)) calc(0.5 * var(--s) * 0.577)` offset,
`background-size: var(--s) calc(var(--s) * 0.577)`).

⚠️ A unit test (`tests/background-pattern.test.ts`) asserts these values.
Do not replace the pattern with gradients, photos or themes.

## 3. Token groups

- **Glass**: `--glass-fill`, `--glass-fill-strong`, `--glass-fill-soft`,
  `--glass-border(-strong)`, `--glass-blur(-strong)`, `--glass-shadow-*`,
  `--glass-fallback-fill` (opaque fallback where `backdrop-filter` is
  unsupported — handled by `@supports` in `glass.css`).
- **Text**: `--text-primary/secondary/muted`.
- **Typography**: `--font-sans/mono`, `--text-2xs … --text-3xl`, weights,
  `--tracking-wide`.
- **Spacing**: `--space-1 … --space-16` (4px base scale).
- **Radii**: `--radius-sm/md/lg/xl/full`.
- **Motion**: `--duration-fast/normal/slow`, `--ease-standard/emphasis`.
- **Focus**: `--focus-ring` (2-layer ring, always visible on dark glass).
- **Status**: `--status-success/warning/danger/info/neutral(+bg)` — used by
  `.badge--*` and buttons; colours are contrast-checked on dark glass.
- **Layout**: `--sidebar-width(-collapsed)`, `--topbar-height`,
  `--content-max-width`.

## 4. Components

**CSS classes** (server/client agnostic): `.glass`, `.glass--strong`,
`.glass--soft`, `.panel(--interactive)`, `.btn` + variants (`--primary`,
`--danger`, `--ghost`, `--icon`, `--sm`), `.badge--*`, `.table-wrap` /
`.data-table`, `.field` / `.input`, `.nav-link(.is-active)`,
`.modal-backdrop` / `.modal`, `.empty-state`, `.chip(--demo)`, `.notice`.

**Typed React components** (`src/components/ui/`):

| Component | Props | Notes |
|---|---|---|
| `Badge` | `tone`, `children` | Meaning carried by text; colour reinforces |
| `StatCard` | `stat: StatCardData` | Dashboard statistic card |
| `DataTable<T>` | `caption, columns, rows, rowKey, emptyMessage` | Generic, typed, horizontally scrollable |
| `Modal` | `open, onClose, title, children, actions` | Escape/backdrop close, focus moves in and returns, `role="dialog"` |
| `EmptyState` | `icon, title, description, children` | Honest placeholders |
| `Icon` | `name, size, className` | Inline SVG registry, `aria-hidden` |

## 5. Interaction rules

1. Every panel/modal/dropdown shows a translucent glass surface with the
   geometric pattern visible through it.
2. Pseudo-elements and background layers must never block pointer events.
3. Blur must never make text unreadable — blur values are capped in tokens.
4. Transitions are short (`120–320ms`) and functional (hover/press/focus/
   enter-exit). `prefers-reduced-motion: reduce` disables movement globally.
5. Keyboard: every interactive element has a visible `:focus-visible` ring;
   the shell provides a "Skip to main content" link; the modal traps focus
   on open and restores it on close.
6. Status is always communicated with **text**, never colour alone.
