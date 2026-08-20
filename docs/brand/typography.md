# CYPH/1 Typography System

**Status:** Approved  
**Date:** 19 August 2026

## Recommended pairing

### Display — Michroma

Use Michroma for major brand headlines and short campaign statements. Its extended geometric construction is the closest open-source fit to the approved logo direction without attempting to typeset or imitate the logo itself.

Recommended use:

- Hero and section headlines
- Short campaign statements
- Occasional numerical or technical display text
- Uppercase with restrained tracking

Avoid using Michroma for paragraphs, form labels or dense navigation. It has one regular weight and should remain a distinctive display voice rather than carrying the full interface.

### Body and interface — Manrope

Use Manrope for body copy, navigation, buttons, forms, captions and legal content. Its contemporary geometry complements Michroma while remaining highly legible at small sizes.

Recommended weights:

- 400 — body copy
- 500 — navigation, labels and supporting emphasis
- 600 — buttons and compact headings

Avoid adding weights that are not used by the final interface.

## Alternative display directions

- **Oxanium** — more overtly technical and angular; useful if CYPH/1 should feel more device-led.
- **Space Grotesk** — quieter and more editorial; useful if the display system should defer more strongly to the logo.

Manrope remains the body/interface recommendation for all three comparisons so the display decision can be judged independently.

## Licensing and delivery

Michroma, Oxanium, Space Grotesk and Manrope are distributed through Google Fonts under the SIL Open Font License. Before production release, store the selected font files locally, retain their licence files and subset only to the character sets the website requires.

Do not depend on a third-party font CDN in production. Self-host WOFF2 files, preload only the critical face and use `font-display: swap`.

## Working rules

- The approved CYPH/1 logo remains vector artwork and is never recreated with the display font.
- Use British English punctuation and sentence case for body content.
- Reserve extended uppercase styling for short display copy and labels.
- Keep body text at a comfortable reading width and line height.
- Do not use light font weights for essential text.
- Limit the production payload to the selected display face and required Manrope weights.

## Approval

Michroma with Manrope was approved on 19 August 2026 and represented in `src/styles/tokens.css`. The Latin WOFF2 files are self-hosted in `public/fonts/`, with separate SIL Open Font Licence files retained for each family. The typography system was applied to the website on 20 August 2026.
