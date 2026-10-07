# Product Page v1 gallery assets

## Manufacturer guidance evidence — 7 October 2026

### Launch-kit contents from the supplied manual photograph

The owner supplied `1791384991921.jpg`, a photograph of the manual's Product Structure / Product form page. Its labelled contents are Main Machine, Adaptor, Goggles, User Manual and Razor. The launch-kit section uses those five items, with customer-facing names CYPH/1 IPL Hair Removal Device, Power adaptor, Protective goggles, User manual and Razor. The photograph is evidence, not a new gallery asset. No accessory quantity, adaptor rating/plug type, eyewear certification or additional device capability is inferred. Verify final production pack contents before GO-01.

### Skin-chart correction from the supplied card photograph

The owner subsequently supplied `1791383882817.jpg`, showing the usage-card chart directly. It marks White, Beige, Light brown and Mid brown with green ticks; Dark brown and Brownish black have red crosses. The Product Page v1 skin guide now follows these exact card labels, as requested by the owner. Hair categories remain unchanged. No Roman numeral/Fitzpatrick mapping is published.

This differs from the earlier owner-supplied manual summary below, which excluded Brown and included Cream Brown. Do not equate the sources' colour names or silently treat them as identical. Reconcile the manual/card discrepancy with the manufacturer and confirm the final production compatibility guide before GO-01. The change applies to the development/pre-launch page; it does not approve broader brown-tone suitability or replace complete device instructions.

The project owner supplied source-confirmed K-803 manual and usage-card information in the task. This records that supplied evidence; the underlying documents were not independently inspected in this implementation.

- Manual areas: women — upper lip, chin, underarms, legs, arms, bikini area; men — chest, back, arms, abdomen, legs. Facial use is limited to the specified women's upper lip/chin areas.
- Manual skin chart: suitable White, Beige, Cream Brown, Light Brown; not suitable Brown, Dark Brown, Black.
- Manual natural hair chart: suitable Black, Dark Brown, Brown, Light Brown; not suitable Light Blonde, Red, White. The separate usage card similarly supports lighter-to-mid-brown skin and dark-to-light-brown hair. Public names retain these categories without Fitzpatrick conversion; swatch colours are illustrative.
- Usage-card precautions: no use over tattoos, sunburn, dark spots or moles, or during pregnancy. Shave first; skin must be clean and dry; do not wax/pluck; wear supplied protective eyewear; read complete instructions.
- Confirmed controls: manual/automatic flash modes, selectable energy level, Turbo mode, automatic shutdown after five minutes without operation. No number of energy levels is inferred.
- Manufacturer-stated indicative treatment times, **internal only, pending final claims review**: face 1 minute; underarm 2 minutes; arm 4 minutes; bikini line 2 minutes; legs 8 minutes. Do not publish in this iteration.
- Subsequent owner-supplied manual evidence confirms that, in Turbo Mode, pressing the flash button triggers two flashes in succession. Approved public copy: “Delivers two flashes in quick succession for an enhanced treatment mode.” The manufacturer describes approximately 2× treatment efficiency through those successive flashes; this is a manufacturer-attributed statement, not independent evidence of doubled hair-removal efficacy, results, speed, hair quantity removed or power. The optional attributed efficiency line is not displayed on this iteration of the page. No such doubled-outcome claims are approved.

The Treatment Areas gallery artwork (Legs, Arms, Underarms, Bikini Line) is consistent with the supplied manual evidence and remains approved for Product Page v1 visual development. Embedded copy/depictions and final production imagery still require final product/compliance review before GO-01.

## Gallery provenance

The project owner approved the supplied `CYPH_1 IPL Hair Removal Collection.png` (1536 × 1024) for Product Page v1 visual development. Six PNGs remain lossless pixel crops only: no regeneration, retouching, colour/text/logo changes or upscaling. The collage hero replaces the earlier standalone interim hero. Treatment areas was subsequently replaced with the project-owner-supplied `CYPH1 IPL Treatment Areas.png` (1137 × 1383), copied unchanged as `cyph1-ipl-treatment-areas.png`. It has the same development/pre-launch approval limits below.

Coordinates are zero-based (left, top, width, height). White panel gutters and numbered/caption strips are excluded.

| File | Crop rectangle | Output dimensions |
| --- | --- | --- |
| cyph1-ipl-hero-v1.png | 0, 0, 379, 453 | 379 × 453 |
| cyph1-ipl-whats-included.png | 389, 0, 378, 454 | 378 × 454 |
| cyph1-ipl-cooling.png | 775, 0, 377, 455 | 377 × 455 |
| cyph1-ipl-treatment-areas.png | Separate supplied image; no crop | 1137 × 1383 |
| cyph1-ipl-technology.png | 0, 512, 528, 445 | 528 × 445 |
| cyph1-ipl-at-home.png | 539, 513, 497, 445 | 497 × 445 |
| cyph1-ipl-design.png | 1046, 514, 490, 445 | 490 × 445 |

Reproduce with `node scripts/crop-product-gallery.mjs "PATH_TO_SUPPLIED_MASTER.png"` from the repository root. The script checks master dimensions and verifies decoded output pixels against the source rectangles. The script preserves the separately supplied treatment-areas replacement. The master remains outside the repository.

## Approval limits

These are current approved development/pre-launch visuals. Embedded marketing copy and depictions must still undergo final product/compliance review before GO-01. Do not infer additional product specifications, efficacy, suitability, box contents or supported treatment areas from artwork, captions or alt text. The artwork's educational illustration does not replace the site's four-stage hair-cycle content.

These generated visuals are not verified physical representations of the production K-803. Replace or re-approve them before GO-01 if final production appearance differs. Final imagery must accurately represent the production device: treatment window at the TOP; power connection/cable at the BOTTOM. Do not infer incorrect hardware geometry from these interim depictions.

## Rendering and crop review

ProductGallery uses Astro Image for local responsive WebP outputs. Candidate widths are capped at each source width; no output is upscaled. Intrinsic width/height are retained; the primary image loads eagerly and the remaining six lazily. The hero retains its natural proportions. The six smaller thumbnails use equal square frames with cover cropping. Hover or keyboard focus shows uncropped artwork to their right on desktop; each thumbnail links to the full optimized image on all screen sizes. The desktop preview fills any empty bands with a decorative blurred copy of the same cached image, behind the sharp uncropped foreground. Escape dismisses the desktop preview. Original extracted assets remain unchanged.

Each crop was visually inspected for adjacent content, clipped text/products/accessories and caption-strip remnants. No neighbouring panels or numbered/caption strips are included. Existing close-up edge framing within the supplied artwork is retained without alteration.

The owner additionally confirmed inclusion of the supplied guidance card. The kit entry is now “User manual and guidance card”, supported by the manual photograph and the previously supplied usage-card photograph.
