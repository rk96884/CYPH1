# Responsive and performance quality assurance

**Review date:** 22 August 2026  
**Scope:** CYPH/1 pre-launch homepage, privacy notice, accessibility statement and early-access confirmation page  
**Status:** Passed for the launch targets and viewport matrix below

## Launch targets

The site uses the standard Core Web Vitals “good” thresholds as its pre-launch lab targets:

- Largest Contentful Paint (LCP): no more than 2.5 seconds;
- Cumulative Layout Shift (CLS): no more than 0.1;
- Total Blocking Time (TBT), used as a lab proxy for responsiveness: no more than 200 milliseconds;
- mobile Lighthouse performance score: at least 90;
- no horizontal overflow from 320 CSS pixels upwards;
- no generated client-side JavaScript bundles;
- compressed first-party initial payload: no more than 200 KiB.

## Responsive review

All four routes were reviewed at 320, 375, 768, 1024 and 1440 CSS pixels.

| Check | Result |
| --- | --- |
| Horizontal overflow | None at any tested route or width |
| Header navigation | Compact logo/CTA treatment at mobile sizes; full navigation from tablet upwards |
| Primary CTA | Remains within the viewport and keyboard/touch operable |
| Small targets | No visible standalone interactive target below 24 × 24 CSS pixels |
| Legal headings | Long headings scale and wrap without clipping |
| Decorative graphics | Constrained so transformed orbits cannot enlarge the page canvas |

## Live Lighthouse results

Lighthouse was run against `https://www.cyph1.co.uk/` after deployment. Mobile figures are the median of three runs.

| Mode | Score | FCP | LCP | TBT | CLS | Transfer |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Mobile, median of 3 | 98 | 1.00 s | 1.66 s | 0 ms | 0 | 145 KiB |
| Desktop | 100 | 0.37 s | 0.45 s | 0 ms | 0 | 145 KiB |

The site is new and does not yet have enough Chrome UX Report field data. These are controlled lab results, not real-user field measurements; real-user Core Web Vitals should be reviewed once sufficient traffic exists.

## Payload and script review

Run:

```sh
npm run audit:performance
```

The production budget audit currently reports:

- five generated HTML documents;
- 12 unique first-party initial resources;
- 286.0 KiB raw / 144.0 KiB gzip first-party payload;
- zero generated JavaScript bundles.

The only behavioural JavaScript is the small inline early-access form handler. Cloudflare Turnstile is the only third-party runtime and is required for signup abuse prevention. It is deferred until the signup form approaches the viewport or receives focus/pointer interaction, so it is not part of the initial page payload.

The complete static deployment is approximately 2.8 MiB because it retains approved brand source/reference assets under `public/brand`. Those files are not requested by any page and do not affect the initial browsing payload. They can be moved to non-public project documentation later if public asset distribution is no longer useful.

## Stability and motion

- All content images define intrinsic dimensions.
- The tested homepage produced zero cumulative layout shift.
- The hero logo is prioritised as the mobile LCP image.
- Reduced-motion CSS disables smooth scrolling and effectively removes transition duration when `prefers-reduced-motion: reduce` is active.
- Turnstile was confirmed to initialise after deferred loading at the signup section.

## Re-test triggers

Repeat this review after adding analytics, new third-party services, video, large imagery, a navigation redesign or substantial new page content.

