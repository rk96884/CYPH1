# CYPH/1 Meta AI product films — private integration

**Status:** IMPLEMENTED IN CODE / MEDIA NOT YET COMMITTED / NOT RELEASE APPROVED.

## Source and placement
- Original user-supplied Meta AI clips remain unmodified and are packaged separately in `CYPH1_Meta_Motion_Assets.zip`.
- `public/brand/motion/hm-01-device-reveal.mp4` — home hero, with existing CYPH/1 brand mark and “Target the growth.” heading as native page elements.
- `public/brand/motion/pd-01-treatment-window.mp4` — IPL product page with “Considered comfort.” and integrated cooling copy.
- Matching `*-poster.jpg` poster frames are required for both videos.
- No new physical-device logo is composited onto footage.

## Safety and launch controls
- `PUBLIC_PRODUCT_MOTION_ENABLED=false` is the default. Pages retain current pre-launch presentations while disabled.
- Do not set to true on any live build until media are committed and the product/safety claims and geometry are reviewed.
- Feature does not enable checkout, payments, stock, delivery estimates or shipping.
- Videos are muted, inline and looping. Playback pauses offscreen, for reduced-motion preference or browser data saving.
- Re-review claims and any synthetic visual changes to device details before authorising release.

## Manual media staging
1. Extract the provided archive to the root of the local repository; confirm four files are present under `public/brand/motion/`.
2. On branch `feature/meta-product-motion`, set `PUBLIC_PRODUCT_MOTION_ENABLED=true` in *local* `.env`.
3. Run `npm ci`, `npm run check`, `npm run build`, `npm run dev`.
4. Review the homepage and `/ipl-hair-removal/`, especially mobile crops, legibility, autoplay and reduced motion.
5. If approved, `git add public/brand/motion`, commit and push to this branch. Do not merge the PR before doing so.

## Launch QA
- [ ] Validate correct source video mapped to each location.
- [ ] Confirm all files present on preview and no 404s.
- [ ] Confirm logos are website artwork and are not overlaid onto moving device surfaces.
- [ ] Confirm captions/headlines are legible over motion and on mobile.
- [ ] Confirm poster fallback and prefers-reduced-motion on iOS Safari, Android Chrome and desktop.
- [ ] Validate no unapproved efficacy, cooling temperature, or safety claims.
- [ ] Confirm no regressions to accessibility, performance budget or prelaunch gates.
- [ ] Obtain WEB-01/QA-01 approvals before enabling in production.
