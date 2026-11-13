# Exclude internal test browsers from GA4

The two websites support the same private, browser-local control. It does not rely on public IP addresses and does not change visitor consent choices.

## Enable exclusion (on each device and browser)

Open the site's homepage with `?internal_analytics=off` (for example `https://mytravelplanit.co.uk/?internal_analytics=off` or `https://www.cyph1.co.uk/?internal_analytics=off`). The command is stored in localStorage and removed from the address bar. New page loads in that browser will not initialise GA4.

## Resume analytics for testing

Open the homepage with `?internal_analytics=on`. If the browser already accepted analytics cookies, normal GA4 collection resumes. Otherwise accept analytics normally.

## Verify

In a fresh navigation after opting out, open DevTools Network and filter by `gtag/js` and `collect`; neither should be requested by the site. For Travel Plan It, `trip_cta_click` and `generate_lead` must also be suppressed. Once re-enabled (and with consent), events should resume.

This flag applies to one browser profile on one origin. It does **not** span laptop/mobile devices, browser profiles, private windows, cleared site data, or different hostnames. The first page load before the opt-out command may already have been measured; use a new navigation for verification. This setting is not a security feature and cannot exclude previous recorded analytics or Search Console search activity. Do not create a GA4 IP-based data exclusion filter for this feature.
