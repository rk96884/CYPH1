# WCAG 2.2 AA accessibility audit

**Audit date:** 22 August 2026  
**Scope:** CYPH/1 pre-launch homepage, privacy notice, accessibility statement and early-access confirmation page  
**Status:** No known critical or serious failures within the checks described below

This is a practical pre-launch audit, not a certification of complete WCAG conformance. It combines repeatable structural checks with manual review of the rendered site.

## Automated structural checks

Run:

```sh
npm run audit:a11y
```

The script builds the production site and checks each generated page for:

- an `en-GB` document language;
- one main landmark and one level-one heading;
- a viewport declaration;
- logical heading progression;
- image alternative-text attributes;
- unique element IDs;
- valid same-page fragment links;
- absence of positive `tabindex` values;
- the homepage skip link, labelled email and consent controls, accessible button text and live form status;
- global focus-visible and reduced-motion styles.

## Manual findings

### Structure and keyboard use

- Landmarks and headings follow a logical reading order.
- The skip link is the first interactive element and targets the main content.
- Native links, inputs, checkboxes and buttons are used for interactions.
- A consistent high-visibility focus outline is defined for keyboard focus.
- Standalone navigation links, buttons, the consent checkbox and inline calls to action provide at least a 44 CSS-pixel target in one dimension, exceeding the WCAG 2.2 minimum target-size requirement.

### Reflow and zoom

- Representative layouts were reviewed at 320, 375, 768 and 1440 CSS pixels.
- Oversized display headings and decorative graphics were constrained at the narrowest viewport to remove horizontal page scrolling.
- The layout stacks into a single column on narrow screens without obscuring content or controls.
- The result supports the equivalent of 200% desktop zoom for the scoped content.

### Colour contrast

Representative foreground/background pairs were calculated using WCAG relative luminance:

| Use | Foreground | Background | Ratio |
| --- | --- | --- | ---: |
| Purple accent on obsidian | `#a77af4` | `#080711` | 6.42:1 |
| Secondary text on raised purple | `#b8adbf` | `#21132b` | 8.19:1 |
| Primary text on raised purple | `#f7f3f8` | `#21132b` | 16.04:1 |
| Dark accent on editorial white | `#6e4c82` | `#f7f3f8` | 6.34:1 |
| Dark accent on pale alloy | `#6e4c82` | `#e4dce6` | 5.19:1 |
| Body text on editorial white | `#554c59` | `#f7f3f8` | 7.46:1 |
| Body text on pale alloy | `#554c59` | `#e4dce6` | 6.11:1 |
| Error text on emphasis purple | `#ffb6c1` | `#321b40` | 9.30:1 |
| Success text on emphasis purple | `#e7c9a7` | `#321b40` | 9.74:1 |

### Forms, status and motion

- Form validation uses native browser validation where appropriate.
- Submission status uses `role="status"` and `aria-live="polite"`; busy state is exposed with `aria-busy`.
- Error and success messages are not communicated by colour alone.
- Reduced-motion preferences disable smooth scrolling and effectively remove transition duration.

## Remediations completed

- Increased small standalone interactive targets.
- Increased the consent checkbox target.
- Darkened purple labels on light panels to meet AA contrast.
- Constrained headings and decorative graphics at 320 CSS pixels to prevent horizontal overflow.
- Restored the compact mobile header after a later touch-target rule overrode its navigation breakpoint.
- Added a narrow-screen scale cap for long legal-page headings such as “Accessibility”.
- Corrected accessibility feedback contact details.

## Known limitations and follow-up

- Cloudflare Turnstile is a third-party embedded challenge. Its accessibility and availability are partly controlled by Cloudflare; the site provides a clear load-failure message but cannot alter the contents of its iframe.
- Browser/assistive-technology combinations have not been exhaustively tested. Before a wider public launch, test the complete signup journey with current NVDA/Firefox, NVDA/Chrome, VoiceOver/Safari and keyboard-only use on physical devices.
- Re-run this audit whenever navigation, signup behaviour, content structure, colours or major layouts change.

