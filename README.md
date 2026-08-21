# CYPH/1 pre-launch website

Static Astro website for the CYPH/1 pre-launch brand and early-access programme.

## Local development

```sh
npm ci
npm run dev
```

Copy `.env.example` to `.env` when testing the early-access integration locally. Values prefixed with `PUBLIC_` are delivered to the browser and must never contain secrets.

## Quality checks

```sh
npm run check
npm run build
node scripts/audit-accessibility.mjs
node scripts/audit-performance.mjs
```

Pull requests run the same build and audit checks automatically. Production deploys from `main` to GitHub Pages after all checks pass.

Hosting configuration, preview setup, environment ownership and rollback procedures are documented in [Hosting and deployment](docs/operations/HOSTING-AND-DEPLOYMENT.md).

