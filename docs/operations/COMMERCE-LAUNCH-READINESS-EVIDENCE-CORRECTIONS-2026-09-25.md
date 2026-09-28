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

## Mollie production payment evidence — 28 September 2026

The generic Mollie outstanding wording in the older readiness register is now partly stale. The following production-payment evidence has been reviewed or operator-confirmed on 28 September 2026 while customer checkout remains disabled.

### Account access and settlement

- The CYPH/1 Mollie organisation currently has one authorised user.
- Multi-factor authentication is active using an authenticator application.
- The production Mollie account is linked to the intended CYPH/1 Tide business current account for settlement.
- Production uses the explicit `mollie-live` provider path; staging has used `mollie-test` and is currently disabled. A retained staging API-key prefix should still be checked separately if the credential remains configured.

These points close the current Mollie user-access/MFA and settlement-destination evidence items. Periodic access review, account-recovery arrangements and future role changes remain operational controls.

### Webhook authenticity and payment-state authority

The production adapter and webhook path have been inspected. CYPH/1 does not accept an inbound webhook assertion that a payment is paid. The webhook accepts the expected Mollie payment identifier, validates the request shape and then retrieves the authoritative payment and refund state directly from Mollie's API before applying CYPH/1 payment/order transitions. Amount and currency are checked against the stored CYPH/1 payment, and provider event identifiers are used for idempotent processing.

Accordingly, the Mollie webhook authenticity/state-authority engineering review is PASSED. This does not replace the first controlled live-transaction/webhook/reconciliation exercise once an approved product, price and shipping configuration exists.

### Privacy role / DPA assessment

Mollie's current UK User Agreement states that, for processing connected with its Payment Services, Mollie and the merchant are controllers to the extent each independently determines the purposes and means of processing. Mollie's current support guidance likewise states that the ordinary merchant payment relationship is not treated as a controller-processor relationship and therefore does not require a processor DPA for that standard payment relationship.

For the CYPH/1 Mollie Payments integration, the readiness register must therefore not treat an Article 28 processor DPA with Mollie as an outstanding requirement by default. Record the relationship as:

- **Mollie Payments privacy role:** independent-controller relationship assessed;
- **Article 28 processor DPA for ordinary Mollie Payments:** not applicable on Mollie's stated relationship model;
- **CYPH/1 obligation:** customer-facing terms/privacy information must disclose that Mollie is used to process transactions and that relevant customer personal data is shared with Mollie and its affiliates for that purpose; and
- **remaining privacy work:** ensure the final CYPH/1 privacy notice/consumer terms, data-flow record, retention/rights handling and accountable privacy approval reflect the independent-controller relationship.

This correction applies to the ordinary Mollie Payments service currently integrated. It must be reassessed if CYPH/1 later enables a Mollie product or feature under different data-processing terms.

### PCI scope and hosted checkout

The CYPH/1 integration creates a Mollie payment and redirects the customer to Mollie's HTTPS hosted checkout. The application validates the returned checkout URL as a Mollie domain. CYPH/1 does not intentionally collect or store card PAN, card expiry or CVV in its application payment flow, and the webhook contains a payment identifier rather than card credentials.

The PCI architecture review is therefore recorded as PASSED for the implemented hosted-checkout design, with the following qualification: Mollie's UK User Agreement places responsibility on the merchant to comply with the applicable parts of PCI DSS and to provide evidence if Mollie requires it. CYPH/1 must therefore not describe itself as categorically 'PCI exempt'.

Record the current position as:

- **Hosted-payment/card-data architecture:** PASSED;
- **CYPH/1 application collection/storage of PAN/CVV:** not part of the intended payment design;
- **Applicable merchant PCI-DSS obligations:** remain CYPH/1's responsibility; and
- **formal validation/documentation requested by Mollie/acquirer, if any:** remains an operational/compliance follow-up rather than an unresolved architecture defect.

### Effect on the older processor and PCI checklist wording

Where `COMMERCE-LAUNCH-READINESS.md` generically lists an actual Mollie Article 28/DPA assessment as outstanding, interpret that wording as superseded by the independent-controller assessment above. Other providers that act as processors remain subject to the processor due-diligence/DPA checklist as applicable.

Where the older register says `PCI scope and responsibilities confirmed for hosted checkout` is wholly outstanding, the technical scope and responsibility model is now assessed as above. Final accountable compliance approval and any merchant validation requested by Mollie remain open.

## Register interpretation

Until the main readiness register is next safely consolidated, use this correction record together with the underlying evidence documents. Where the older register conflicts with this record on the subjects above, this dated correction is the current evidence position.
