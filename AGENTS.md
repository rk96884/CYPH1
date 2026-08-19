# CYPH/1 Repository Instructions

## Project

This repository contains the CYPH/1 website.

CYPH/1 is a UK-first premium consumer beauty-technology brand currently in
pre-launch and product validation.

Before making brand, content, product or UX decisions, read:

`docs/CYPH1-BRAND-PROJECT-BRIEF.md`

Treat that document as the project's current source of truth.

---

## Brand

Brand name:

**CYPH/1**

Meaning:

**CY**cle. **PH**ase. **1**.

Supporting descriptor:

**CYCLE. PHASE. ONE.**

Brand proposition:

**TARGET THE GROWTH.**

Do not rename, reinterpret or restyle these without an explicit request.

Do not write "CyPhone".

---

## Current Project Stage

The final IPL product and manufacturer have NOT been selected.

The current site is a brand/pre-launch experience, not a finished e-commerce
store.

Do not:

- enable checkout
- accept payments
- create fake stock
- invent pricing
- invent specifications
- invent reviews
- invent testimonials
- invent certifications
- invent clinical claims
- invent delivery estimates
- identify a manufacturer publicly

Product-specific values should remain configurable/TBC until approved.

---

## Product Claims

Never infer a product claim from generic IPL knowledge.

Do not publish exact values for:

- fluence / J/cm²
- joules
- cooling temperature
- flash count
- treatment time
- treatment window
- energy levels
- warranty
- FDA status
- UKCA status

unless they have been explicitly approved for the selected CYPH/1 product.

Supplier marketing language must not automatically become website copy.

---

## Design Direction

The site should feel:

- premium
- technological
- minimal
- precise
- contemporary
- gender-neutral

Preferred visual territory:

- near-black
- deep purple / aubergine
- metallic lavender
- white
- restrained metallic details

Avoid generic beauty-site aesthetics.

Avoid excessive:

- gradients
- glow
- glassmorphism
- animation
- rounded cards
- decorative icons
- visual clutter

Use whitespace deliberately.

The current logo uses a contemporary angled hair-follicle device in place of
the slash.

Do not redraw or replace the approved logo without being asked.

---

## Development Principles

Prefer:

1. semantic HTML
2. accessible interfaces
3. mobile-first CSS
4. progressive enhancement
5. minimal dependencies
6. minimal client-side JavaScript
7. reusable components where repetition genuinely exists
8. clear naming
9. maintainable code
10. performance

Do not introduce a framework/library simply because it is popular.

Before adding a dependency, explain why the project needs it.

---

## Accessibility

Target WCAG 2.2 AA.

Ensure:

- semantic landmarks
- logical headings
- keyboard accessibility
- visible focus states
- adequate contrast
- accessible forms
- useful alt text
- reduced-motion support
- touch-friendly controls

Accessibility fixes take priority over decorative fidelity.

---

## Responsive Behaviour

Design mobile-first.

Test at minimum:

- small mobile
- large mobile
- tablet
- laptop
- wide desktop

Do not solve responsiveness with arbitrary device-specific hacks.

Prefer fluid layouts using modern CSS.

---

## CSS

Use project design tokens for:

- colours
- typography
- spacing
- radii
- shadows
- container widths
- transitions

Do not scatter unexplained literal values throughout stylesheets.

Keep selectors understandable and specificity low.

---

## JavaScript / TypeScript

Use JavaScript only where behaviour requires it.

If TypeScript is part of the selected stack, maintain strict typing and avoid
`any` unless there is a documented reason.

Avoid large client-side libraries for behaviour achievable with HTML/CSS.

---

## Animation

Motion should reinforce premium product presentation, not distract from it.

Prefer:

- subtle reveals
- restrained transitions
- purposeful product motion

Respect `prefers-reduced-motion`.

Avoid scroll-jacking and gratuitous animation.

---

## Performance

Prioritise Core Web Vitals.

Optimise:

- images
- fonts
- JavaScript
- CSS
- third-party scripts

Do not introduce autoplay video, large animation libraries or tracking scripts
without considering their performance cost.

---

## SEO

Maintain:

- semantic HTML
- unique metadata
- canonical URLs
- Open Graph metadata
- sitemap
- robots.txt
- structured data where appropriate

Never create keyword-stuffed copy.

---

## Content

Use British English.

Tone:

- intelligent
- concise
- confident
- clear
- evidence-led

Avoid:

- hype
- pseudo-science
- exaggerated beauty claims
- excessive exclamation marks
- generic AI marketing language

Prefer short, strong headlines and useful explanatory copy.

---

## Hair-Growth Science

The four stages used in CYPH/1 educational content are:

1. Anagen — active growth
2. Catagen — transition
3. Telogen — rest
4. Exogen — shedding

Do not imply the CYPH/1 device can identify which growth phase an individual
hair is currently in unless a future verified product capability supports that
claim.

---

## Forms / Early Access

The initial primary conversion is expected to be early-access/waitlist signup.

Forms must:

- be accessible
- validate clearly
- protect user privacy
- provide meaningful success/error states
- avoid unnecessary data collection

Do not silently connect user data to third-party services.

---

## Git

Keep commits focused and descriptive.

Before committing:

- run available tests
- run linting
- check formatting
- verify responsive behaviour
- check obvious accessibility regressions

Do not modify unrelated files.

Do not delete existing functionality to simplify a task without approval.

---

## Working Method

Before implementing a substantial feature:

1. inspect the existing repository
2. understand the current architecture
3. read the relevant project documentation
4. identify reusable patterns
5. propose significant architectural changes before implementing them

For small, clearly scoped changes, implement directly.

When requirements are uncertain, preserve flexibility rather than hard-coding
an assumption.

---

## Source of Truth

Business/product decisions:

`docs/CYPH1-BRAND-PROJECT-BRIEF.md`

Repository implementation:

existing code and project documentation

If the two conflict, flag the conflict rather than silently choosing one.

---

## Core Rule

CYPH/1 is the brand.

The eventual IPL device is a product within that brand.

Do not allow the current OEM/manufacturer candidate to define the architecture,
identity or long-term direction of the website.