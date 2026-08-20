# CYPH/1 Spacing System

**Status:** Approved  
**Date:** 19 August 2026

## Principle

The spacing system uses a 4px base unit with a deliberately limited scale. Small values support controls and text relationships; larger values create the restrained whitespace expected of a premium technology brand.

Spacing should describe relationships, not decorate empty space. Closely related elements sit together; changes in subject or hierarchy receive a deliberate increase in space.

## Core scale

| Token | Value | Typical use |
| --- | ---: | --- |
| `space-1` | 4px | Optical correction and very tight inline relationships |
| `space-2` | 8px | Icon/label gaps and compact metadata |
| `space-3` | 12px | Compact control interiors |
| `space-4` | 16px | Default text and control gap |
| `space-6` | 24px | Related content groups |
| `space-8` | 32px | Component padding and heading groups |
| `space-12` | 48px | Major component separation |
| `space-16` | 64px | Small section transitions |
| `space-24` | 96px | Standard desktop section rhythm |
| `space-32` | 128px | Large editorial or hero transitions |

The names preserve their relationship to the 4px base unit. No additional fixed values should be introduced without a repeated need.

## Fluid layout values

| Role | Proposed value |
| --- | --- |
| Page gutter | `clamp(20px, 4vw, 64px)` |
| Standard section block space | `clamp(72px, 10vw, 144px)` |
| Compact section block space | `clamp(48px, 7vw, 96px)` |
| Component cluster gap | `clamp(24px, 4vw, 48px)` |
| Maximum site container | `1280px` |
| Maximum reading measure | `704px` / approximately 65–72 characters |
| Maximum display-copy measure | `900px` |

## Relationship rules

- Eyebrow to heading: `space-4`.
- Heading to supporting copy: `space-6` on small screens, increasing to `space-8` where space allows.
- Supporting copy to primary action: `space-8`.
- Repeated grid items: `space-6` to `space-8`, depending on density.
- Section heading group to section content: `space-12` to `space-16`.
- Legal and long-form paragraphs: one line-height between paragraphs; `space-12` before a new second-level section.
- Touch controls must remain at least 44px in both dimensions regardless of visible padding.

## Responsive behaviour

- Use fluid gutters and section spacing instead of device-specific values.
- Preserve relationships at narrow widths; reduce large structural gaps before compressing text or controls.
- Stack columns when their content measure becomes uncomfortable rather than shrinking internal spacing indefinitely.
- Wide screens increase surrounding whitespace but do not stretch reading copy beyond its maximum measure.
- Safe-area insets are added to—not substituted for—the minimum page gutter where required.

## Approval

The spacing scale, fluid layout values and relationship rules were approved on 20 August 2026, consolidated in `src/styles/tokens.css` and applied to the website on the same date.
