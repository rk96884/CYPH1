# CYPH/1 Design Tokens

**Status:** Approved foundations consolidated  
**Date:** 20 August 2026  
**Source:** `src/styles/tokens.css`

## Architecture

The token file separates approved raw values from semantic roles. Components should consume semantic tokens wherever a role exists, leaving raw palette values for controlled artwork and exceptional compositions.

- Raw colour: `--cyph-color-*`
- Semantic colour: `--cyph-surface-*`, `--cyph-text-*`, `--cyph-accent-*`, `--cyph-border-*`
- Typography: `--cyph-font-*`, `--cyph-leading-*`, `--cyph-tracking-*`
- Fixed spacing: `--cyph-space-*`
- Fluid layout: `--cyph-layout-*`
- Graphic language and motion: `--cyph-line-*`, `--cyph-radius-*`, `--cyph-motion-*`, `--cyph-ease-*`

## Conditional tokens

The four `--cyph-color-champagne-*` and related warm-metal values are available for approved product-led artwork but have no general interface semantic alias. This intentionally prevents them from displacing Signal Lavender as the primary brand accent.

## Accessibility

- Approved colour pairings and their contrast ratios remain documented in `colour.md`.
- Focus uses Signal Lavender and must retain a visible non-colour outline.
- Motion tokens collapse to 1ms under `prefers-reduced-motion: reduce`.
- Touch-target dimensions are component requirements and must remain at least 44px; they are not inferred from spacing tokens.

## Implementation rule

Do not redefine an approved value inside a component. Add a semantic alias only when a repeated role is established. Any new raw token requires a documented brand-system decision.
