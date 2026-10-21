# CYPH/1 motion storyboards — K-803

**Prepared:** 21 October 2026  
**Status:** CREATIVE DEVELOPMENT ONLY — not authorised for publication or validated device depiction  
**Initial scope:** HM-01 homepage reveal, PD-01 cooling feature, ED-01 IPL educational explainer

## Creative guardrails

- Produce original CYPH/1 assets; do not reuse Braun's footage, composition, or claims.
- Follow the repo's brand palette, type and approved metallic CYPH/1 lockup rather than introducing a new brand aesthetic.
- Use **actual approved IONKA K-803 device** reference views for visual accuracy. Existing `src/assets/products/ipl/` imagery is useful as visual direction, **not** production-shape or certification proof.
- Do not show claimed numerical efficacy, clinical outcomes, temperatures, treatment time, unsupported skin safety features, or specific device mechanics absent verified evidence.
- The hair-cycle animation explains generic IPL, not a K-803-specific clinical effect. In particular, **do not depict the device identifying an individual hair's growth phase**.
- Respect `docs/content/CLAIMS-SOURCE-REGISTER.md`, and retain PT-01, CO-01, WEB-01 and GO-01 approval gates in `docs/operations/COMMERCE-LAUNCH-READINESS.md`.
- No flickering light sequences or strobing. Animations must offer a non-animated poster and honour `prefers-reduced-motion`.

## Source assets to review before production

- `src/assets/products/ipl/cyph1-ipl-hero-v1.webp` — existing hero concept
- `src/assets/products/ipl/cyph1-ipl-cooling.webp` — cooling concept
- `src/assets/products/ipl/cyph1-ipl-technology.webp` — educational style reference
- `public/brand/generated/cyph1-lockup-clean-metallic.svg` — logo
- `public/brand/teaser/cyph1-product-direction-v2.webp` — pre-launch direction only

## HM-01 — Device reveal (homepage hero)

**Master:** 12 seconds, 16:9 landscape, silent, loopable. Deliver additional 9:16 social crop, 4:5 social crop, and static WebP poster.

| Time | Shot | Action | On-screen copy |
| --- | --- | --- | --- |
| 0–2s | Near-black/deep-plum studio | Device emerges as a silhouette; minimal edge light | None |
| 2–5s | Slow three-quarter orbit | Rim lighting traces the actual K-803 body and treatment window | None |
| 5–8s | Subtle macro push-in | Camera approaches device details; no simulated operating flash | None |
| 8–10s | Hero device lock-up | Camera settles with clean negative space | Target the growth. |
| 10–12s | Return to neutral silhouette | Soft crossfade to a loop-compatible start | CYPH/1 mark |

**Motion:** slow ease-in-out; only subtle specular movement; no aggressive spins.  
**Production dependency:** actual front, back, side, three-quarter and treatment-window images; dimensions and color/finish confirmation. If only photos exist, use a 2.5D parallax treatment; do not claim full geometry-accurate 3D rotation.  
**Website placement:** homepage hero, with a static fallback and click-free autoplay only if muted/playsinline, performance budget permitting.

## PD-01 — Integrated cooling (product page)

**Master:** 7 seconds, 1:1 or 4:5, silent seamless loop; poster frame.

| Time | Shot | Action | On-screen copy |
| --- | --- | --- | --- |
| 0–2s | Macro product window | Slow push towards verified K-803 treatment surface | None |
| 2–5s | Gentle blue edge accent | Soft, abstract cooling waves outside the device; no fabricated temperature readout or frost | Integrated ice cooling |
| 5–7s | Hold and reset | Return to still product window for a seamless loop | None |

**Motion:** restrained translucent blue light, no claim of specified degrees or pain-free use.  
**Production dependency:** close-up of actual cooling/treatment window, correct material and relative dimensions; confirm operation with supplier evidence.  
**Website placement:** product feature section and product gallery.

## ED-01 — Understanding IPL and the hair cycle (educational)

**Master:** 30 seconds, 16:9 with 9:16 reframe; accessible captions/subtitle track if narration is later added.

| Time | Shot | Action | Educational line |
| --- | --- | --- | --- |
| 0–5s | Clean cross-section of skin and follicle | Hair and follicle appear | Hair grows in cycles. |
| 5–12s | Conceptual light-based treatment | Broad, gentle pulse visualization interacting with pigmented hair; not a real-time physical simulation | IPL uses pulses of light. |
| 12–20s | Cycle transition | Simplified sequence: anagen, catagen, telogen, exogen | Different hairs are at different stages. |
| 20–26s | Multiple follicles at different stages | Subtle repeated visual beats across a timeline, without numerical outcomes | That's why treatment is repeated over time. |
| 26–30s | Branded end-frame | Soft fade to CYPH/1 logo | Consistency matters. |

**Scientific constraints:** use approved generic education EDU-001–EDU-007 only. No implying all hair responds at once, automatic growth-phase detection, guaranteed reduction, or product-specific efficacy. The depicted light path must be labeled as an illustration, not a physical simulation.  
**Website placement:** existing hair-cycle section or product technology section, behind appropriate non-animated explanation.

## Production deliverables and technical acceptance

- Motion masters in editable project format plus export assets; social variants must be composed, not merely stretched.
- Web exports: muted H.264 MP4 and supported WebM; quality-tuned for measured transfer size (no fixed codec/bitrate claims); poster WebP/AVIF.
- Lazy-load non-hero media; `preload="none"` for below-the-fold videos; keep width/height or aspect ratio reserved.
- Provide captions/transcripts for informational speech and meaningful textual alternatives for animations; never convey crucial product instructions through motion alone.
- Mobile: check portrait crops and contrast against text; avoid overlays across buttons and navigation.
- QA: verify reduced-motion behaviour, data-saving fallback, page performance, layout shift, playback in Safari/iOS and Chromium, and colour legibility.
- Content approval: verify imagery against the actual K-803 and obtain documented PT-01/CO-01/WEB-01 approval before any public device-specific claims.

## Reference images requested from product owner

1. Front elevation, device switched off, against plain background.
2. Back elevation showing shell geometry and labels, without exposing serial numbers in public assets.
3. Left and right sides.
4. Two three-quarter views, front and rear.
5. Close-up of treatment/cooling window and controls/buttons.
6. Optional short steady slow walk-around video; do not operate IPL for the shoot.
7. Reference to approved color/finish, dimensions and accessories.

Prefer evenly lit, sharp phone photos from consistent distance with no portrait-mode blur; original files are better than heavily compressed screenshots. Existing photos may be reused if they show the final model accurately.

## Approval status

- [x] Motion concepts and shot-by-shot storyboard documented.
- [ ] Owner supplies verified K-803 photography.
- [ ] Confirm render strategy (2.5D photos vs accurate 3D model).
- [ ] Create and review motion prototypes.
- [ ] Verify claims and mechanical depiction.
- [ ] Implement performance- and accessibility-safe page placement.
- [ ] Obtain pre-launch approvals before publication.
