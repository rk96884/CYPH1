# CYPH/1 pre-launch release checklist

**Issue:** #8 — Complete the pre-launch legal and release checklist  
**Review date:** 22 August 2026  
**Release type:** Brand and early-access website  
**Current decision:** NO-GO pending the accountable human legal review and final live checks below

This checklist records the evidence required for a public-release decision. It is an operational record, not legal advice.

## Commercial and product status

- [x] No checkout, payment or pre-order capability exists.
- [x] Early-access copy expressly states that registration is not an order or pre-order.
- [x] No price, stock level, delivery estimate or warranty is published.
- [x] No final product specification, certification, review or testimonial is published.
- [x] Concept imagery is labelled as product direction and subject to change.
- [x] Website Terms clarify that concept imagery does not depict a final product.
- [x] Candidate manufacturers are not identified publicly.
- [x] CYPH/1 is not described as a registered trademark and no registered-mark symbol is used.

## Claims and content

- [x] Public hair-cycle and IPL statements are recorded in `docs/content/CLAIMS-SOURCE-REGISTER.md`.
- [x] General IPL evidence is not presented as evidence for a future CYPH/1 product.
- [x] Copy does not claim that a device can identify the growth phase of an individual hair.
- [x] The concept device carries a clear final-design disclaimer.
- [ ] Accountable human reviewer confirms every public product, science and campaign statement.

Human reviewer: ____________________  
Role or qualification: ____________________  
Review date: ____________________  
Decision or notes: ____________________

## Privacy and communications

- [x] The Privacy Notice identifies the controller and contact details.
- [x] The notice describes the data collected, purpose, lawful basis, providers, transfers, retention and individual rights.
- [x] Email marketing consent is an unticked, specific, affirmative choice.
- [x] Double opt-in is enabled.
- [x] Subscriber emails provide an unsubscribe route.
- [x] No analytics or advertising cookies are currently implemented.
- [x] Necessary automated-abuse protection is disclosed.
- [ ] Human legal reviewer approves the Privacy Notice and Website Terms for the intended UK launch.

## Technical and accessibility checks

- [x] `npm ci` completes from a clean dependency state.
- [x] `npm run check` reports no errors, warnings or hints.
- [x] `npm run build` completes successfully.
- [x] `npm run audit:a11y` passes with the Website Terms page included.
- [x] `npm run audit:links` passes.
- [x] `npm run audit:performance` passes.
- [x] Internal navigation and footer links work on the production build.
- [ ] External links and email contact routes work.
- [ ] The complete live signup and confirmation journey works with a new test address.
- [ ] Keyboard-only and mobile smoke tests pass on the live deployment.

## Go/no-go record

Release decision: **NO-GO until all unchecked release gates above are completed.**

Decision owner: ____________________  
Decision date: ____________________  
Notes: ____________________
