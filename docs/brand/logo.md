# CYPH/1 Logo System

**Status:** Approved source and derived vector family  
**Source:** `docs/CYPH1-BRAND-PROJECT-BRIEF.md`

## Concept

The wordmark is a custom wide geometric construction. Its open forms, light monoline weight and extended proportions are intended to feel engineered, precise and futuristic rather than cosmetic or clinical.

The conventional slash is replaced by an angled hair-and-follicle mark. A tapered hair rises in the direction of a forward slash from a minimal double-line follicle, making the meaning legible without becoming a detailed anatomical illustration.

## Approved reference

`public/brand/reference/cyph1-approved-logo-direction.png`

This presentation artwork was selected on 19 August 2026 as the visual target for the production logo. It defines the intended letterforms, proportions, metallic white treatment, lavender follicle slash, lavender `1` and descriptor lock-up.

The reference is a raster presentation image on a dark background. It is not the final production master and should not be used where a transparent, monochrome or small-format logo is required.

## Vector source

`public/brand/source/cyph1-approved-logo-direction.svg`

The supplied source contains vector paths only: no scripts, embedded images, live text, fonts, external references or foreign objects. It is the geometry source for all derived variants.

## Generated vector family

Files in `public/brand/generated/` are produced by `scripts/build-logo-variants.mjs`:

- `cyph1-lockup-presentation.svg` — approved metallic lock-up on near-black
- `cyph1-lockup-metallic.svg` — metallic lock-up with transparent background
- `cyph1-lockup-flat.svg` — simplified white/lavender lock-up
- `cyph1-wordmark-metallic.svg` — metallic wordmark without descriptor
- `cyph1-wordmark-light.svg` — reversed monochrome wordmark
- `cyph1-wordmark-dark.svg` — dark monochrome wordmark
- `cyph1-mark-metallic.svg` — metallic standalone follicle mark
- `cyph1-mark-light.svg` — reversed monochrome follicle mark
- `cyph1-mark-dark.svg` — dark monochrome follicle mark
- `cyph1-favicon.svg` — metallic mark on near-black

All variants preserve the supplied path geometry. Regenerate them after replacing the approved source by running `node scripts/build-logo-variants.mjs`.

## Usage

- Preserve the wordmark proportions.
- Use the approved Signal Lavender treatment in accent files; do not introduce unapproved recolours.
- Do not typeset, redraw, rotate or rearrange the wordmark.
- Do not separate the follicle mark from the wordmark except when using the approved standalone mark.
- Keep clear space around the wordmark equal to at least the height of the `1` terminal stroke.
- Use the full wordmark wherever space allows; reserve the standalone mark for favicons, avatars and very small applications.

## Accessibility

When used as an image, provide `alt="CYPH/1"` if the logo identifies the brand. Use empty alternative text when the same nearby text already identifies CYPH/1.

## Production gate

The family is approved for website implementation. Validate each chosen variant at its final rendered size and retain the supplied geometry for packaging and device-marking production tests.
