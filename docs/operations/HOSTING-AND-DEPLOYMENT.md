# Hosting and deployment

## Architecture

The pre-launch site is a static Astro build with no dependency on a commerce platform.

- **Production:** GitHub Pages, deployed from `main` by `.github/workflows/deploy.yml`.
- **Pull-request previews:** Cloudflare Pages, connected to the same GitHub repository without a custom production domain.
- **Canonical domain:** `https://www.cyph1.co.uk/`, configured in `astro.config.mjs` and served over enforced HTTPS.
- **DNS:** Cloudflare DNS points `www` to the GitHub Pages host. The apex domain should redirect to the canonical `www` URL.
- **Early-access API:** a separate Cloudflare Worker. Hosting the static site does not contain or expose the Brevo API key or Turnstile secret.
- **Private operations staging:** a separate Render Node service behind a Cloudflare Access-protected custom hostname. It is not part of the public Pages deployment and exposes no checkout route.

This split keeps the known-good production host stable while providing isolated previews for proposed changes. The generated `dist/` directory can be moved to any static host later without changing the site architecture.

## Production deployment

A push to `main`, or a manual workflow dispatch, runs the following sequence:

1. Check out the exact commit.
2. Install the committed dependency lock with `npm ci` on Node.js 24.
3. Validate required public deployment variables.
4. Run Astro and TypeScript checks.
5. Build `dist/`.
6. Run structural accessibility and performance-budget audits.
7. Upload the immutable Pages artifact.
8. Deploy it to the `github-pages` environment.

The deployment stops before publication if any step fails.

## Pull-request previews

Create a Cloudflare Pages project with these settings:

| Setting | Value |
| --- | --- |
| Project name | `cyph1-preview` |
| Git repository | `rk96884/CYPH1` |
| Production branch | `main` |
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |

Use the committed lockfile for installs. If Cloudflare exposes a dependency-install command, set it to `npm ci`. Enable preview deployments for all non-production branches and leave the project on its `pages.dev` domain; do not attach `cyph1.co.uk` to it.

Cloudflare creates a unique URL for each pull request. Preview responses are no-indexed by default, but they must still be treated as public and must never receive private credentials.

## Environment variables and secrets

| Name | Visibility | Location | Purpose |
| --- | --- | --- | --- |
| `PUBLIC_SIGNUP_API_URL` | Public | GitHub repository variable and Cloudflare Pages environment variable | Browser endpoint for early-access submissions |
| `PUBLIC_TURNSTILE_SITE_KEY` | Public | GitHub repository variable and Cloudflare Pages environment variable | Browser-side Turnstile widget key |
| `BREVO_API_KEY` | Secret | Cloudflare Worker encrypted secret only | Brevo API authentication |
| `TURNSTILE_SECRET_KEY` | Secret | Cloudflare Worker encrypted secret only | Server-side Turnstile verification |
| `CLOUDFLARE_ACCESS_TEAM_DOMAIN` | Private configuration | Render operations staging environment | Exact Access issuer and JWKS origin |
| `CLOUDFLARE_ACCESS_AUDIENCE` | Private configuration | Render operations staging environment | Exact protected application audience |
| `OPERATIONS_ACCESS_GRANTS` | Private configuration | Render operations staging environment | Verified operator email to least-privilege permission mapping |

The private staging build/start settings and verification procedure are in
`docs/operations/PROTECTED-COMMERCE-STAGING.md`. Do not attach its hostname to
the public GitHub Pages site or treat Cloudflare Access as a substitute for the
application's JWT validation.

Use `.env.example` as the local public-variable template. `.env`, `.env.*`, `.dev.vars`, generated output and provider state are excluded by `.gitignore`. Never add private values to repository variables prefixed with `PUBLIC_`, source files, workflow YAML, screenshots, issues or logs.

## Domain and HTTPS checks

After a production deployment:

1. Confirm the GitHub Pages custom domain is `www.cyph1.co.uk`.
2. Confirm **Enforce HTTPS** remains enabled.
3. Visit `https://www.cyph1.co.uk/` in a private window and confirm the certificate is valid.
4. Confirm the apex `https://cyph1.co.uk/` redirects once to the canonical `www` URL.
5. Confirm page canonical metadata and the sitemap use `https://www.cyph1.co.uk/`.

## Production database backups — pre-launch policy (November 2026)

The production commerce database currently has no recorded customers, orders or
payments. Its configuration and schema still require protection. The encrypted
backup and freshness-check workflows are retained, but their daily schedules
are **paused during pre-launch**:

| Workflow | Manual execution | Schedule during pre-launch | Schedule to restore before live checkout |
| --- | --- | --- | --- |
| `.github/workflows/production-encrypted-r2-backup.yml` | Actions → Production encrypted R2 backup → Run workflow | None | `17 2 * * *` (02:17 UTC daily) |
| `.github/workflows/production-backup-freshness-monitor.yml` | Actions → Production backup freshness monitor → Run workflow | None | `47 3 * * *` (03:47 UTC daily) |

Both workflows use the protected GitHub Actions credentials and the private
Cloudflare R2 bucket. Do not remove the encryption key/identity, R2 credentials,
stored encrypted backups, or the manual triggers. The freshness monitor checks
whether the latest encrypted object is non-empty and no older than **36 hours**;
it is meant to accompany daily backups, so it is expected to fail after a long
manual-only interval. Run it after a successful manual backup, not as a routine
pre-launch check.

**Before live checkout or any real customer/order/payment data is recorded:**

1. Run an encrypted production backup manually and confirm upload to R2.
2. Perform a documented restore test into an isolated non-production database,
   checking schema and representative data without replacing the live database.
3. Restore the two daily `schedule` triggers shown above, in a reviewed PR.
4. Verify that the daily backup job and subsequent freshness monitor both pass,
   and confirm that GitHub failure notifications reach an accountable operator.
5. Record the backup/restore evidence and obtain launch approval. Do not
   enable checkout until this recovery gate is closed.

While the schedules are paused, make an on-demand backup before significant
production schema or configuration changes, and after any changes that would
otherwise be difficult to reconstruct. If real data enters the production
database unexpectedly, re-enable automated protection immediately rather than
waiting for the planned shopping-cart launch.

## Rollback

Use a source-controlled rollback so the repository and live site remain consistent:

1. In GitHub, identify the last known-good commit and the faulty commit on `main`.
2. Revert the faulty commit with a new commit; do not force-push or reset `main`.
3. Push the revert to `main` and monitor the **Deploy to GitHub Pages** workflow.
4. Verify the live site and early-access form after deployment.

If the workflow itself failed without a source change, open **Actions → Deploy to GitHub Pages**, select the failed run and choose **Re-run all jobs**. A manual **Run workflow** deployment is also available from that workflow's page.

Commerce incidents require additional controls because stopping new checkout
must not discard in-flight payment or order state. Use
`COMMERCE-DISABLE-AND-ROLLBACK.md` for the server-side disable sequence,
webhook/reconciliation safeguards and database rollback rule.

## Ownership

- **Source, workflows and GitHub Pages:** repository owner `rk96884`.
- **DNS, Pages previews, Turnstile and early-access Worker:** the CYPH/1 Cloudflare account owner.
- **Subscriber delivery and authenticated sending domain:** the CYPH/1 Brevo account owner.

Access should remain limited to the project owner until additional maintainers are formally assigned. Any ownership change must include GitHub, Cloudflare and Brevo recovery details rather than sharing personal passwords.

