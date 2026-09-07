# Private commerce manual accessibility review

**Scope:** Private checkout, checkout status states and restricted operations UI  
**Standard:** WCAG 2.2 AA practical pre-launch review  
**Status:** Visual and keyboard review passed; remaining manual checks outstanding

This review complements the structural audit. It does not approve production
commerce and must use synthetic test data only.

## Build the isolated fixture

From the repository root in PowerShell:

```powershell
$env:PUBLIC_COMMERCE_UI_ENABLED = "true"
$env:PUBLIC_COMMERCE_TEST_PRODUCT_SLUG = "integration-test-fixture"
$env:PUBLIC_COMMERCE_TEST_PRODUCT_NAME = "INTEGRATION TEST FIXTURE - NOT FOR SALE"
$env:PUBLIC_COMMERCE_API_URL = "https://private-api.example"
$env:PUBLIC_COMMERCE_TEST_SHIPPING_RATE_ID = "00000000-0000-0000-0000-000000000000"
$env:PUBLIC_COMMERCE_OPERATIONS_UI_ENABLED = "true"
$env:PUBLIC_COMMERCE_OPERATIONS_SLUG = "operations-test"
$env:PUBLIC_COMMERCE_OPERATIONS_API_URL = "https://private-api.example"
npm run build
npm run audit:private-commerce-a11y
npm run preview
```

Keep that terminal open. The preview command prints the local origin, normally
`http://localhost:4321`. Review these routes:

- `/private-commerce/integration-test-fixture/`
- `/private-commerce/status/pending/`
- `/private-commerce/status/success/`
- `/private-commerce/status/cancelled/`
- `/private-commerce/status/error/`
- `/private-operations/operations-test/`

Afterwards, stop the preview with `Ctrl+C` and clear the fixture variables:

```powershell
Remove-Item Env:PUBLIC_COMMERCE_UI_ENABLED
Remove-Item Env:PUBLIC_COMMERCE_TEST_PRODUCT_SLUG
Remove-Item Env:PUBLIC_COMMERCE_TEST_PRODUCT_NAME
Remove-Item Env:PUBLIC_COMMERCE_API_URL
Remove-Item Env:PUBLIC_COMMERCE_TEST_SHIPPING_RATE_ID
Remove-Item Env:PUBLIC_COMMERCE_OPERATIONS_UI_ENABLED
Remove-Item Env:PUBLIC_COMMERCE_OPERATIONS_SLUG
Remove-Item Env:PUBLIC_COMMERCE_OPERATIONS_API_URL
```

## Test matrix

Record each row as pass, fail or not applicable. A failure blocks manual sign-off
until it is corrected and retested.

| Check | Checkout | Four status states | Operations | Pass criteria |
| --- | :---: | :---: | :---: | --- |
| Keyboard only | [x] | [x] | [x] | Every control is reachable and operable in a logical order; focus is clearly visible; there is no keyboard trap. |
| Screen reader | [ ] | [ ] | [ ] | Page title, landmark, headings, labels, warnings, validation and status changes are announced meaningfully and without harmful repetition. |
| 200% zoom | [ ] | [ ] | [ ] | Content and controls remain available without overlap, clipping or two-dimensional page scrolling. |
| 400% zoom | [ ] | [ ] | [ ] | At a 1280 CSS-pixel viewport, content reflows to the equivalent of 320 CSS pixels without loss of information or operation. |
| Mobile reflow | [ ] | [ ] | [ ] | At 320, 375 and 768 CSS pixels, content remains readable and controls do not overflow the viewport. |
| Reduced motion | [ ] | [ ] | [ ] | With the operating-system preference enabled, no non-essential animation or smooth scrolling remains. |
| High contrast | [ ] | [ ] | [ ] | In Windows Contrast Themes, text, inputs, buttons, boundaries and keyboard focus remain distinguishable. |

## Interaction details

### Keyboard-only

1. Reload each route and do not use the pointer.
2. Use `Tab`, `Shift+Tab`, arrow keys, `Enter`, `Space` and `Escape` as
   appropriate.
3. On checkout, edit quantity and every delivery field, trigger native invalid
   input, and activate the checkout button. The failure message should receive
   focus because the fixture API is deliberately unreachable.
4. On operations, operate search, refund fields and reconciliation dates. The
   native date picker must be keyboard operable; the visible calendar icon and
   its hit target must coincide.
5. Confirm disabled or busy controls do not cause focus loss or a trap.

### Screen reader

Use current NVDA with Firefox or Chrome on Windows. A later production review
should also include VoiceOver with Safari on Apple hardware.

1. Navigate by landmarks, headings, form controls and links.
2. Confirm every field's purpose and required state are announced.
3. Submit invalid forms and confirm the validation message identifies the
   affected control.
4. Confirm checkout progress/failure and operations search/refund messages are
   announced once. When order details are revealed in a connected staging test,
   focus should move to **Order timeline**.
5. Confirm decorative brand graphics do not add noise and visible information is
   not missing from the accessible name or description.

### Zoom, reflow and display preferences

1. At 1280 CSS pixels wide, test browser zoom at 200% and 400%.
2. At 400%, scroll vertically through the entire page. There must be no loss of
   content or required horizontal page scrolling. A genuinely two-dimensional
   data region may scroll independently if it is labelled and keyboard usable.
3. Repeat at 320, 375 and 768 CSS pixels using responsive browser tools, then
   smoke-test checkout and operations on a physical touch device.
4. Enable the operating system's reduced-motion preference and Windows Contrast
   Themes, reload each route and repeat keyboard navigation.

## Evidence record

| Field | Record |
| --- | --- |
| Reviewer | |
| Date and time | |
| Commit tested | |
| Browser and version | |
| Screen reader and version | |
| Desktop operating system | |
| Physical mobile device/browser | |
| Automated audit result | |
| Manual result | Pending |
| Defects or notes | |

Manual sign-off is complete only when every applicable matrix entry passes,
defects are linked or resolved, and the evidence fields identify the tested
commit and software versions.

## Review history

| Date | Reviewer | Environment | Result |
| --- | --- | --- | --- |
| 7 September 2026 | Project owner | Local production fixture in Microsoft Edge | Visual and keyboard checks passed across checkout, all four status states and operations. Operations header-divider spacing was aligned with the other private pages. Operations failures were given an explicit `Error:` prefix and the accessible error colour; successful outcomes received the success colour. Structural audit passed after remediation. Screen-reader, 200%/400% zoom, physical-mobile, reduced-motion and high-contrast checks remain open. |
