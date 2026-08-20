# CYPH/1 Colour System

**Status:** Approved working palette  
**Source:** Approved CYPH/1 logo direction and `docs/CYPH1-BRAND-PROJECT-BRIEF.md`  
**Date:** 19 August 2026

## Core palette

| Role | Name | Value | Intended use |
| --- | --- | --- | --- |
| Primary background | Obsidian | `#080711` | Hero, immersive brand surfaces |
| Base background | Carbon ink | `#0B0710` | Site background and footer |
| Raised surface | Aubergine | `#21132B` | Alternating sections and panels |
| Elevated surface | Deep plum | `#321B40` | Selected or emphasised dark surfaces |
| Primary accent | Signal lavender | `#A77AF4` | CTA fills, focus, active states, follicle mark |
| Accent highlight | Metallic lavender | `#D9C6F2` | Fine highlights and restrained metallic treatment |
| Primary text | Soft white | `#F7F3F8` | Headings and body copy on dark surfaces |
| Secondary text | Mist | `#B8ADBF` | Supporting copy on dark surfaces |
| Structural line | Alloy | `#776A80` | Essential dividers, form borders and controls |

## Semantic colours

| Role | Value | Use |
| --- | --- | --- |
| Success | `#69D5B0` | Confirmed success states |
| Warning | `#F2C66D` | Warnings requiring attention |
| Error | `#FF8A9A` | Validation and error states |

Semantic colours are functional only. They are not part of decorative brand artwork.

## Conditional champagne-metal extension

This secondary palette is approved for product-led applications if the final selected device uses a champagne or rose-gold metallic finish.

| Role | Name | Value | Intended use |
| --- | --- | --- | --- |
| Metallic highlight | Champagne highlight | `#E7C9A7` | Narrow highlights, foil detail and premium product accents |
| Warm mid-tone | Rose alloy | `#C99378` | Product-adjacent metallic transitions and selected campaign artwork |
| Metallic shadow | Burnished gold | `#9A6748` | Controlled depth within metallic treatments |
| Deep metallic shadow | Deep bronze | `#5C392C` | Fine shadow detail and dark-end gradient stops |

Signal Lavender remains the primary brand accent. The champagne-metal extension must not replace lavender in core navigation, actions, focus states or the follicle mark. Use these warm tones only when they connect the brand to an approved physical product finish; until that product is confirmed, they remain optional presentation colours rather than core interface tokens.

## Approved contrast pairings

- Soft white on Obsidian — `18.24:1`
- Mist on Obsidian — `9.31:1`
- Signal lavender on Obsidian — `6.42:1`
- Alloy on Obsidian — `3.96:1` (non-text UI and large text only)
- Carbon ink on Signal lavender — `6.39:1`
- Carbon ink on Metallic lavender — `12.64:1`
- Soft white on Deep plum — `14.00:1`

Ratios are calculated using WCAG relative luminance. Normal text must meet at least `4.5:1`; large text and essential non-text UI must meet at least `3:1`.

## Usage rules

- Use Obsidian or Carbon ink as the dominant brand canvas.
- Use Signal lavender sparingly for actions, focus and distinctive brand moments.
- Use Carbon ink—not white—for text on lavender-filled buttons.
- Metallic lavender is a highlight, not a body-text colour or large-area background.
- Champagne-metal colours are reserved for product-led artwork and premium detailing; they are not general-purpose UI accents.
- Keep gradients confined to presentation artwork and subtle metallic treatments; functional UI uses flat colours.
- Never use colour as the only indicator of state.
- Do not use low-opacity borders for essential form boundaries; use Alloy where the boundary must be perceived.
- Semantic colours always appear with text, an icon or another non-colour cue.

## Approval

The core palette was approved on 19 August 2026. The conditional champagne-metal extension was approved on 20 August 2026. The values were consolidated in `src/styles/tokens.css` and the core palette was applied to the website on 20 August 2026; the champagne-metal extension remains inactive until the final device finish is confirmed.
