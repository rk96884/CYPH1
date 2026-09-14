# SF-03 — IPL does not read a hair's phase

Production source for the 23.5-second, 1080 × 1920, 30 fps social master at
`public/brand/social/cyph1-sf-03-ipl-does-not-read-phase.mp4`.

## Rebuild on Windows

Requires Node.js, Playwright (Chromium/Edge), FFmpeg, Python 3 and an installed
UK English Windows speech voice. No new repository dependency is required: set
`PLAYWRIGHT_MODULE` to the installed Playwright `index.js` path if it is not
available from `node_modules`, and set `FFMPEG` to `ffmpeg.exe` if not on PATH.

1. Run `powershell -ExecutionPolicy Bypass -File docs/marketing/video/sf03/make-voice.ps1`.
2. Run `python docs/marketing/video/sf03/make-music.py`.
3. Run `node docs/marketing/video/sf03/render.mjs`.

The voice script speaks the visible brand name `CYPH/1` as the phonetic text
**“Sife One”**. The generated voice clips are source assets in `voice/` so the
master can be rebuilt without generating another voice. The music and effects
are original deterministic synthesis, not third-party recordings. `render.mjs`
renders the deterministic storyboard at 30 fps and mixes the five voice clips
at fixed times below the instrumental bed.

| Time | Image and spoken line |
| --- | --- |
| 0–4 s | Hook: “IPL does not identify an individual hair’s phase.” |
| 4–10 s | Four follicles, asynchronous motion: “Different hairs can be at different points in the cycle.” |
| 10–14 s | Uniform illustrative pulse, no scan/selection: “That is why treatment is repeated over time.” |
| 14–18.5 s | Cycle rule and conclusion: “A considered routine, not a shortcut.” |
| 18.5–23.5 s | Lock-up, descriptor, proposition, website CTA; “Sife One. Know the cycle.” |

Claims: EDU-007, EDU-006 context only. Sources: SRC-003 and SRC-004 in the
approved claims register. General IPL education, never future-device performance.
No product render, treatment interval, outcome promise or scanning/detection cue.

Burned-in on-screen copy carries every essential spoken claim. The pulse is
labelled “ILLUSTRATIVE PULSE · NOT PHASE DETECTION”. Use the caption draft in
the calendar and provide a platform transcript/alt-text equivalent when posting.
The master is production-only; this project does not publish to social channels.
