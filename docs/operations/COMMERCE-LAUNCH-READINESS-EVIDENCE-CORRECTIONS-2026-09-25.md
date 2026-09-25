# Commerce launch-readiness evidence corrections — 25 September 2026

**Status:** Authoritative evidence correction to `COMMERCE-LAUNCH-READINESS.md`

This record corrects stale outstanding-item wording in the restored commerce launch-readiness register. It does not approve production commerce and does not close the remaining accountable business, legal, privacy, security or operational launch gates.

## Accessibility evidence

The private-commerce manual review already records successful local testing on 7 September 2026 for:

- keyboard-only operation across checkout, all four status states and operations;
- NVDA screen-reader operation across those private routes;
- 200% and 400% browser zoom;
- responsive reflow at 320, 375 and 768 CSS pixels;
- `prefers-reduced-motion: reduce` emulation; and
- `forced-colors: active` / high-contrast emulation.

Accordingly, the generic outstanding instruction in `COMMERCE-LAUNCH-READINESS.md` to complete all of those checks is stale and must not be interpreted as meaning they have not been tested.

Accessibility follow-ups that remain open are narrower:

1. repeat reduced-motion with the native operating-system preference;
2. repeat high-contrast testing with native Windows Contrast Themes;
3. complete the physical touch/mobile-device smoke test;
4. complete production assistive-technology checks when an appropriate production-like environment is available; and
5. complete the evidence metadata, including the browser and NVDA version numbers used for the recorded local review.

This correction does not convert the accessibility gate into production approval.

## Production PostgreSQL PITR

The statement that paid Render PITR recovery rehearsal remains outstanding is stale.

On 24 September 2026 the production PostgreSQL PITR rehearsal passed. Render point-in-time recovery created an independent PostgreSQL 17 recovery database without overwriting or repointing the source production database. Direct read-only verification over TLS confirmed:

- 10 applied schema migrations;
- 23 / 23 expected CYPH/1 commerce tables;
- 0 customers;
- 0 orders;
- 0 payments; and
- 0 refunds.

This closes the infrastructure recovery-rehearsal portion of the production PITR gate. Separate controls remain open where applicable, including retention approval, recovery-key custody/rotation, operational ownership and future recovery testing once production contains real commerce data.

Evidence: `docs/operations/PRODUCTION-PITR-RECOVERY-EVIDENCE-2026-09-24.md`.

## Production off-platform encrypted backup

The production off-platform backup/restore evidence completed after the older register wording must also be treated as superseding that wording. The production backup recovery evidence records the completed production backup/restore/freshness/alerting work. Therefore the older statement that production-specific backup configuration/recovery remains wholly outstanding is stale.

This correction closes only the engineering evidence already demonstrated. Any remaining governance items — including accountable production ownership, approved retention, key custody/rotation and notification expectations where not separately evidenced — remain launch gates.

## Register interpretation

Until the main readiness register is next safely consolidated, use this correction record together with the underlying evidence documents. Where the older register conflicts with this record on the three subjects above, this dated correction is the current evidence position.
