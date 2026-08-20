# CYPH/1 Brand System

**Status:** Approved system consolidated  
**Date:** 20 August 2026

This directory is the canonical record of the approved CYPH/1 brand system. The consolidated system was applied to the pre-launch website on 20 August 2026.

## Approved foundations

| Foundation | Specification | Implementation source |
| --- | --- | --- |
| Logo | `logo.md` | `public/brand/generated/` and `src/data/brand-assets.ts` |
| Colour | `colour.md` | `src/styles/tokens.css` |
| Typography | `typography.md` | Family and role tokens in `src/styles/tokens.css`; self-hosted files in `public/fonts/` |
| Spacing | `spacing.md` | Fixed and fluid tokens in `src/styles/tokens.css` |
| Graphic language | `graphic-language.md` | Line, radius and motion tokens in `src/styles/tokens.css` |

## Asset structure

```text
public/brand/
├── source/       Approved source geometry; do not edit derived files directly
├── generated/    Production logo variants generated from the source
├── reference/    Visual reference only; not a production logo
└── manifest.json Machine-readable public asset paths

src/
├── data/brand-assets.ts  Typed asset paths for Astro components
└── styles/tokens.css     Approved design-token source
```

## Current gates

- The champagne-metal palette is conditional on confirmation of the final product finish.
- Product imagery, specifications and performance claims remain outside the approved brand asset set.
- Future components must consume the approved semantic tokens rather than redefining brand values locally.
