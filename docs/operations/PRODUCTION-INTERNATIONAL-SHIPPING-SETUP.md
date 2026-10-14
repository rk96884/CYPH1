# Disabled-only international production shipping preparation

**Preparation only. Not launch approval and not a request to run against production.**

This separate setup tool extends the verified disabled UK configuration without altering any UK records. The six commercial groups are UK, Europe (including Turkey), APAC, Middle East, LATAM and Rest of World. Database pricing continues to use the existing `europe` / `rest-of-world` tariff zones, with **£14.99** in Europe and **£25.99** in the other international groups. USA is excluded.

The script has an explicit **candidate list**, not an approval to serve every country within a region:

| Group | Disabled-only candidate ISO codes |
| --- | --- |
| Europe | DE FR IE ES TR |
| APAC | SG MY TH JP IN HK AU NZ PK KZ UZ KG TJ |
| Middle East | AE SA QA KW BH OM |
| LATAM | BR MX CL CO AR |
| Rest of World | CA ZA |

Pakistan, Kazakhstan, Uzbekistan, Kyrgyzstan and Tajikistan are preparation candidates only; their carrier acceptance, customs classification and local product requirements have not been signed off. All candidate countries, country-specific tracked-postage rate revisions, and newly required pricing zones are created with status **disabled**. InPost remains UK only. There is **no international activation**, no payments, no database migration and no price or revision change to the existing UK entries.

## Review first

- The existing UK baseline must be **exactly** the owner-confirmed disabled UK configuration: GB destination, UK zone, two disabled methods, four GBP rate revisions (399/799 home and 259/399 InPost), and no packaging profiles. Other records are rejected unless they precisely match previously prepared disabled international candidates.
- Country rows are **disabled even for candidates**. Each requires specific carrier, mains-powered K-803 eligibility, packed-unit dimensions/weights, import/customs and consumer-law review, and explicit owner approval before activation.
- Use `node apps/commerce-api/scripts/prepare-production-international-shipping.mjs` to print the plan. **This connects to no database.**
- A separate future approval, verified fresh backup/restore arrangements, and read-only inspection are required before the operator may use `--apply`. Guarded apply requires the exact named `cyph1_commerce_production` database, `NODE_ENV=production`, `SHIPPING_PRODUCTION_CONFIRM=create-disabled-international-only` and explicit false/disabled commerce, checkout, webhook, payment and fulfilment gates. Never put a database password into chat, repository or command arguments.
- After an explicitly approved operation, run `inspect-production-shipping.mjs` read-only, and verify that existing UK rates are unchanged and every newly created record is disabled. Repeat `--apply` is designed to avoid duplicates, but abnormal/shadow records fail closed.

The script deliberately **does not** reuse the staging `configure-international-shipping.mjs`, which refuses production databases, and it never automatically runs at deploy time.

## Remaining work

Production checkout still has separate launch gates for UK multi-unit and InPost. Non-UK multi-unit shipping still requires an eligible approved packaging/carrier configuration, and final checkout activation requires a separate review. Production setup alone does not make the storefront offer destinations. Do not enable commerce, live payment providers or manual dispatch from this preparation.
