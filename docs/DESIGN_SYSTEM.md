# Design System — NAV Dental Clinic

Derived from `BRAND_ANALYSIS.md`. **Every UI value comes from these tokens.** In code they live in one file (`src/styles/tokens.css`) as CSS custom properties exposed to Tailwind v4 through `@theme`. Components never use raw hex values.

## 1. Principles

1. **Charcoal and silver, lit by contrast.** No brand hue. Highlights come from light (silver/platinum), not colour.
2. **Dark for brand, light for reading.** Header, hero, CTA bands and footer are dark (`ink`). Long-form content sits on light `paper` surfaces.
3. **Booking is always one tap away.** Phone, WhatsApp and Book buttons have the highest visual weight on every page; on mobile, a sticky bottom action bar.
4. **Hairlines, not boxes.** Echo the logo's horizontal terminals with thin silver rules and generous whitespace instead of heavy cards and shadows.
5. **Calm motion.** 150–250 ms opacity/translate transitions only. All motion is disabled under `prefers-reduced-motion: reduce`.

## 2. Colour tokens

### Brand neutrals (measured from the logo)

| Token | Hex | Source |
|---|---|---|
| `--ink-950` | `#0A0A0A` | Logo background (corners) |
| `--ink-900` | `#131313` | Logo background average, **primary brand colour** |
| `--ink-800` | `#1E1E1E` | Raised dark surface (derived step) |
| `--ink-700` | `#2E2E2E` | Dark borders/dividers (derived step) |
| `--graphite-600` | `#4A4A4A` | Secondary text on light (derived step) |
| `--graphite-500` | `#5C5C5C` | Muted text on light (derived step) |
| `--steel-400` | `#818181` | Logo metal shadow band |
| `--silver-300` | `#AAAAAA` | Logo metal mid band, **secondary brand colour** |
| `--silver-200` | `#D0D0D0` | Logo metal light band |
| `--platinum-100` | `#F1F1F1` | Logo specular highlight |
| `--paper-50` | `#FAFAFA` | Light page surface (derived) |
| `--white` | `#FFFFFF` | Form field fill, cards on paper |

Derived steps are interpolations between measured values, added only to reach accessible contrast.

### Semantic tokens

| Semantic token | Light context | Dark context |
|---|---|---|
| `--surface` | `paper-50` | `ink-900` |
| `--surface-raised` | `white` | `ink-800` |
| `--text` | `ink-900` (17.8:1) | `platinum-100` (16.5:1) |
| `--text-secondary` | `graphite-600` (8.5:1) | `silver-300` (8.0:1) |
| `--text-muted` | `graphite-500` (6.4:1) | `steel-400` (4.8:1) |
| `--border` | `silver-200` | `ink-700` |
| `--rule-accent` | silver gradient `silver-200 → steel-400 → silver-200` (decorative) | same |
| `--focus-ring` | `ink-900` 2px + 2px offset | `platinum-100` 2px + 2px offset |
| `--cta-bg` / `--cta-text` | `ink-900` / `platinum-100` | `platinum-100` / `ink-900` |

### Functional status colours (not brand colours)

Used **only** for validation, alerts and admin status badges, each paired with an icon and text (never colour alone).

| Token | Hex | Contrast on `paper-50` |
|---|---|---|
| `--danger` | `#B42318` | 6.30 |
| `--success` | `#1E6B3A` | 6.25 |
| `--warning` | `#A15C00` | 4.97 |
| `--info` | uses `ink-900` with an info icon | 17.8 |

On dark surfaces, status messages render inside a `white`/`paper` inset so these colours keep their contrast.

## 3. Typography

| Role | Family | Weight | Size (mobile → desktop) | Case / tracking |
|---|---|---|---|---|
| Display (H1 hero) | Cinzel | 600 | 36 → 60 px, `clamp()` | Title case, +0.02em |
| H2 | Cinzel | 500 | 28 → 40 px | +0.01em |
| H3 | Montserrat | 600 | 20 → 24 px | Normal |
| Eyebrow / label | Montserrat | 600 | 12 → 13 px | UPPERCASE, +0.18em (echoes "DENTAL CLINIC") |
| Body | Montserrat | 400 | **17 px** / 1.65 | Normal |
| Small | Montserrat | 500 | 14 px / 1.5 | Normal |
| Button | Montserrat | 600 | 16 px | Normal case (readability), +0.02em |

- Loaded with `next/font/google` (self-hosted at build, `display: swap`, subsets `latin`, size-adjusted fallbacks to avoid layout shift).
- **Hindi readiness:** neither Cinzel nor Montserrat covers Devanagari. The font stack appends **Noto Sans Devanagari** (loaded only on `hi` routes), so Hindi text never falls back to a system font mismatch.
- Minimum body size 16 px; line length 60–75 characters (`max-width: 68ch`).

## 4. Spacing, radius, elevation

- **Spacing scale (4 px base):** 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Section padding: 64 px mobile, 96–128 px desktop.
- **Radius:** `--radius-sm 4px` (inputs, badges), `--radius-md 8px` (cards, buttons), `--radius-full` (icon buttons, pills). Restrained, to match the logo's crisp strokes.
- **Elevation:** one soft shadow for overlays only (`0 10px 30px rgb(10 10 10 / 0.18)`). Cards use a 1 px `--border`, not shadows.

## 5. Breakpoints and layout

| Name | Min width | Layout |
|---|---|---|
| base | 0 | Single column, 16 px gutters, sticky bottom action bar (Call · WhatsApp · Book) |
| `sm` | 640 | 2-column service grid |
| `md` | 768 | 24 px gutters |
| `lg` | 1024 | Desktop nav, 3-column grids, booking form beside the info panel |
| `xl` | 1280 | Container max 1200 px |

Test widths: 360, 390, 414, 768, 1024, 1280, 1440.

## 6. Components and conventions

| Component | Notes |
|---|---|
| `Logo` | Renders the SVG mark + wordmark; `variant="on-dark" | "on-light"`; `next/image` fallback to the supplied render only in hero |
| `Button` | Variants `primary` (CTA tokens), `secondary` (1 px border), `ghost`, `link`; sizes `md` (44 px min height) and `lg` (52 px). `asChild` pattern for links. Loading state with spinner + `aria-busy`. |
| `PhoneLink`, `WhatsAppLink` | Single source for `tel:` and `wa.me` URLs from settings; WhatsApp hidden when not enabled |
| `Field` (Input, Select, Textarea, Checkbox, DatePicker, SlotPicker) | Visible label, hint, error with `aria-describedby`, `aria-invalid`; error summary at form top on submit |
| `Header` / `MobileNav` | `<header>`, skip link, accessible disclosure menu (focus trap, Esc to close, `aria-expanded`) |
| `Footer` | NAP block (name/address/phone) from settings, legal links |
| `ServiceCard`, `TrustItem`, `ContactCard` | Hairline-bordered, no imagery dependency |
| `Breadcrumbs` | `<nav aria-label="Breadcrumb">` + matching BreadcrumbList JSON-LD |
| `Alert`, `Toast` | Live regions (`role="status"` / `role="alert"`) |
| `EmptyState`, `ErrorState`, `Skeleton` | Shared across public and admin |
| `ConfirmDialog` | Native `<dialog>` with focus management |
| `CheckMark` | Brand device from the logo's root stroke, for success screens and list bullets |

Conventions: Server Components by default; a component becomes `"use client"` only for interaction. Props are typed and variants are expressed through a small `cva`-style map (no runtime CSS-in-JS). Focus is always visible (`:focus-visible` ring, 2 px plus 2 px offset). Minimum touch target is 44×44 px.

## 7. Imagery

- No stock photos presented as the clinic, doctor or patients. No before/after images.
- Until real photography arrives, layouts are typographic, with the tooth mark used as a large, low-opacity graphic.
- When photos arrive: `next/image`, AVIF/WebP, explicit `sizes`, descriptive alt text, a hero image under 200 KB.

## 8. Admin UI

The admin uses the same tokens in a light, dense variant: `paper` background, `ink` sidebar, status badges using the functional colours plus an icon and a label.
