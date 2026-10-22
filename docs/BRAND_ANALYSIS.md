# Brand Analysis — NAV Dental Clinic Logo

**Source of truth:** `brand-assets/logo-original.webp` (1080×1080, supplied by the client).
**Method:** visual inspection plus pixel sampling with Pillow (luminance bands, chroma, corner/background sampling). Hex values below are measured, not invented.

## 1. What the logo contains

1. **Tooth mark** — an open, line-drawn molar outline:
   - the **crown** is a single sweeping stroke with two cusps, with a thinner parallel "swoosh" stroke along the upper left that reads as a highlight / sparkle of a clean tooth;
   - the **root** is a heavy **V / check-mark** stroke whose long right arm runs off horizontally. It does three jobs: tooth root, the "V" of NAV, and a tick (✓ = healthy / approved).
   - The outline is deliberately **open** (the left side of the crown terminates in a short horizontal stroke). The mark is suggestive rather than literal.
2. **Wordmark "NAV"** — uppercase serif, set with generous tracking, centred inside the tooth.
3. **Descriptor "DENTAL CLINIC"** — uppercase geometric sans, two lines, right-aligned to the open side of the check mark.

## 2. Colour (measured)

| Measurement | Result |
|---|---|
| Maximum chroma across all pixels | **5 / 255** (effectively zero) |
| Mean chroma | 0.10 |
| Conclusion | The logo is **completely achromatic**. It has no blue, gold, teal or any hue. |

| Role in the logo | Sampled value | Notes |
|---|---|---|
| Background (corners) | `#0A0A0A` – `#0E0E0E` | Near-black textured slate |
| Background average (dark pixels) | `#131313` | |
| Background vignette highlight | `#666666` | Lighting effect of the render, not a brand colour |
| Metal — shadow band | `#818181` | Steel |
| Metal — mid band | `#AAAAAA` | Silver |
| Metal — light band | `#D0D0D0` | Light silver |
| Metal — specular | `#F1F1F1` | Platinum highlight |
| Metal — overall average | `#B4B4B3` | |

**Primary colour:** charcoal / near-black (`#131313`).
**Secondary colour:** brushed silver (`#AAAAAA` → `#D0D0D0`).
**Accent colour:** none exists in the logo. The "accent" in the logo comes from **light** (specular highlights), not hue.

> Rule followed: we will **not** introduce a generic dental blue or any invented brand hue. If the clinic wants a colour accent, it must be a client decision (see Discovery questions).

## 3. Typography and lettering

| Element | Observed style | Closest open-licence match for the web |
|---|---|---|
| "NAV" | High-contrast **serif**, uppercase, bracketed wedge serifs, classical proportions, wide letter-spacing | **Cinzel** (Google Fonts, OFL), an inscriptional Roman capital face. Used only for display/brand moments. |
| "DENTAL CLINIC" | **Geometric sans**, uppercase, round "C", medium weight, open tracking | **Montserrat** (Google Fonts, OFL), used for UI, body and labels. |

The original typefaces are not identified by the client. If the designer's source file names the actual fonts, we will switch to them (if licensed for web).

## 4. Shape language

- **Single-weight, tapering strokes** with calligraphic swells (thick at the curve, thin at the ends).
- **Open forms**: the outline does not close; there is breathing room.
- **Horizontal terminals**: both the crown's left foot and the check-mark's arm end in long horizontals. This gives a strong horizontal rhythm we can echo with **thin hairline rules** and left-aligned layouts.
- **Check-mark motif**: a usable graphic device for "confirmed", success states, and list bullets, used sparingly.

## 5. Visual personality

Premium · restrained · confident · clinical precision · classical (serif) meets modern (geometric sans). It reads more like a boutique or private practice than a budget chain. The design must still feel **warm and approachable** to local patients in Pahasu, so we balance the dark luxury tone with generous light content sections, plain language, and very visible phone/WhatsApp actions.

## 6. Background suitability and production issues

| Question | Finding |
|---|---|
| Designed for | **Dark backgrounds** (silver on charcoal). |
| On light backgrounds | Will need a **dark (charcoal) version** of the mark. Silver on white fails contrast (`#AAAAAA` on `#FFFFFF` = 2.32:1). |
| Supplied file usable as-is? | **Only as a hero/brand image.** It is a photographic 3D render with wall texture, drop shadows and lighting. It cannot be placed on other backgrounds, has no transparency, and blurs at small sizes (favicon, header at 40px). |
| Needed from client | Original **vector** (SVG / AI / PDF / EPS), ideally with: (a) flat silver-on-dark, (b) flat charcoal-on-light, (c) mark-only (tooth) for favicon/app icon. |
| Fallback if no vector exists | In Phase 2 we will hand-build a **provisional flat SVG** that traces the mark, clearly labelled *provisional, pending client approval*, and never presented as the official master artwork. |

## 7. Contrast (light/dark) — measured WCAG 2.x ratios

| Foreground → Background | Ratio | Use |
|---|---|---|
| `#F1F1F1` on `#131313` | 16.45 | Body/headings on dark ✅ |
| `#AAAAAA` on `#131313` | 8.00 | Secondary text on dark ✅ |
| `#818181` on `#131313` | 4.77 | Small muted text on dark ✅ (AA) |
| `#131313` on `#FAFAFA` | 17.80 | Body on light ✅ |
| `#4A4A4A` on `#FAFAFA` | 8.49 | Secondary text on light ✅ |
| `#5C5C5C` on `#FAFAFA` | 6.41 | Muted text on light ✅ |
| `#818181` on `#FAFAFA` | 3.73 | **Large text / non-text UI only** |
| `#AAAAAA` on `#FAFAFA` | 2.23 | **Decorative only** (rules, borders) |

## 8. Brand implications for the website

1. A **monochrome, metal-and-charcoal** system: dark brand bands (header, hero, footer, CTA blocks) alternate with light, highly readable content sections.
2. "Accent" = **contrast and light**: silver-to-platinum gradients on hairlines and the primary button's hover sheen. No hue.
3. Functional colours (error red, success green, warning amber) exist **only for status and validation**, never as brand decoration. That keeps forms accessible without inventing a brand hue.
4. Serif display (Cinzel) appears in at most one or two places per page (H1, section eyebrow). Everything else uses Montserrat for readability.
