# Design System: "The Editorial Calm"

Source designs: Stitch project `projects/764466106106666706` (11 screens, light + dark).

---

## Typography

| Usage | Font | CSS Class |
|---|---|---|
| Headlines, manuscript display | Noto Serif | `font-serif`, `font-heading` |
| Body text, labels, UI elements | Manrope | `font-sans` |

---

## Colors — "Darkish Glacier"

Muted teal spectrum using OKLch color space.

### Light Theme (default)

| Token | Value | Usage |
|---|---|---|
| Primary | `#14333b` / oklch(0.28 0.04 200) | Main actions, sidebar background |
| Secondary | `#2c4a52` / oklch(0.37 0.04 200) | Hover states, accents |
| Surface | `#f8f9fa` / oklch(0.98 0.002 240) | Page backgrounds |
| Accent | oklch(0.96 0.02 170) | Soft mint highlights |

### Dark Theme (`.dark` class)
CSS vars fully defined in `globals.css`. Inverted while maintaining contrast. No toggle UI yet (planned).

### Status Badges

| Status | Color | CSS Var |
|---|---|---|
| Draft | Lavender/Purple | `--draft` |
| Published/Live | Mint/Green | `--published` |
| Formatting | Amber/Yellow | `--formatting` |
| Review | Blue | `--review` |

---

## Design Rules

### No Border Lines
Use tonal sculpting (background shifts between surface tiers), shadows, and spacing. Never `border-1` or `ring-1` for section boundaries. Ghost borders at 30% opacity are defined in CSS vars but should be subtle.

### Transitions
Applied globally in `globals.css`:
- 300ms ease for backgrounds and shadows
- 200ms for color and opacity
- Calm, not snappy

### Glassmorphism
Floating elements: `bg-white/70 backdrop-blur-[16px]`

### CTA Gradient
`bg-gradient-to-r from-[oklch(0.28_0.04_200)] to-[oklch(0.37_0.04_200)]` (dark teal → medium teal)

### Sidebar
Always dark teal (`bg-sidebar`), white text.

---

## Chart Colors

5-step teal gradient defined as CSS vars `--chart-1` through `--chart-5`. Used by recharts components.

---

## Component Library

shadcn/ui components in `components/ui/`:
avatar, badge, button, card, dialog, dropdown-menu, input, label, progress, scroll-area, select, separator, table, tabs, tooltip

All use `@base-ui/react` internally (NOT `@radix-ui`). Import from `@/components/ui/`. Use `cn()` from `lib/utils.ts` for conditional classNames.
