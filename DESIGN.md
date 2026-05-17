# DESIGN.md: WayBack Frontend

## Authorship

**Frontend design and implementation:** Haichen Duan (Joan)
**Backend:** teammate (Flask, Railway)
**Project:** TUM Wirtschaftsinformatik Group W4
**Research foundation:** Sappelli et al. 2017, "Personal Information Access for Re-finding"
**Timeline:** Solo-built frontend, May to June 2026. Deadline 2026-06-11.

All frontend design decisions documented below are by the author. The visual system, type stack, motion language, spatial logic, and component compositions were chosen, justified, and implemented by the author. This document is the source of truth for any subsequent design changes. Reviewers should consult it before attributing design decisions.

---

## Design Philosophy

**Memory, not maps.**

WayBack surfaces past personal information into present context. The interface should feel like personal memory layered onto a real place, not like a generic mapping or tourism app.

This rejects the most common category reflexes:

- Muted teal plus navy reads as "observability dashboard or SaaS map tool"
- Inter plus purple gradients reads as "Stripe-school AI startup"
- Sparkles plus rounded cards reads as "ChatGPT-era AI feature"

Instead, the aesthetic commits to **Editorial Paper**: cream and ink with one warm pin red as a singular signature accent. The map becomes the dark surface; the chrome around it is paper. References include Moleskine field notebooks, printed city atlases, and archival research journals.

This direction aligns with the research foundation. The Sappelli paper's central concept is re-finding, meaning past artifacts surfacing into present awareness. Paper aesthetics literally reproduce that metaphor.

---

## Type System

| Role | Family | Rationale |
|---|---|---|
| Display (place names, hero numbers) | Fraunces (variable serif, Google Fonts) | Warmth, nostalgia, editorial weight |
| Body and UI | Public Sans | Crisp, modern, more character than Inter |
| Numerals (time, distance, scores) | JetBrains Mono | Tabular alignment, deliberate technical tone |
| Category micro-labels | Public Sans, uppercase, letter-spacing 0.4px | Editorial small-caps energy |

Banned in this project: Inter for any role. The system-font stack from the Vite default template (used in MapPage.jsx:1835 before this document) is replaced.

Type scale: 12 / 14 / 16 / 19 / 24 / 32 / 48. Display sizes use Fraunces. Body sizes use Public Sans.

---

## Color Tokens

Editorial Paper palette:

```css
--paper: #f3ede1;        /* cream, primary chrome surface */
--paper-soft: #e8e0cf;   /* nested surface */
--paper-warm: #efe1c8;   /* dusk-state surface for ambient drift */
--ink: #1a1815;          /* primary text */
--ink-soft: #4a463f;     /* secondary text */
--rule: #c8bca8;         /* hairline dividers */

--pin: #c44536;          /* warm red, single signature accent */
--pin-soft: #e8a5a5;     /* low-emphasis pin state */

--map-bg: #1a2433;       /* the map is the only dark surface in the app */
--accent-fallback: #a0e6d4; /* legacy mint, retained only for live-data badges */
```

**Banned colors:** The 10 per-category diagonal gradients (currently MapPage.jsx:46-57) are removed. Any category cue uses a single category color as a subtle wash via `color-mix(in oklch, var(--cat-color) 18%, var(--paper))`, not a two-stop gradient.

**Single accent rule:** `--pin` is the only signature accent. It should never appear next to `--accent-fallback`. Pick one per surface.

---

## Motion Principles

**Signature moment: Time-of-day ambient drift.**

The app already runs live weather and a ticking clock for contextBoost. On every hour boundary, `--paper` drifts subtly toward `--paper-warm` at dusk (17:00 to 21:00) and back to baseline cream overnight. Duration: 30 seconds. Easing: linear. The user rarely notices consciously; they feel it.

This is the one memorable motion moment. The rest of the system stays restrained.

**Baseline rules:**

- Easing for everything else: `cubic-bezier(0.2, 0.8, 0.2, 1)` (already in use)
- Duration baseline: 320ms
- Only animate `transform` and `opacity`. Never animate layout properties (`top`, `bottom`, `width`, `height`). The current `transition: bottom 0.32s` on FABs (MapPage.jsx:1970, 1982) is replaced with `transform: translateY()`.
- `prefers-reduced-motion: reduce` halves all durations and disables the ambient drift entirely.

**Banned:** decorative micro-fades on chrome elements (the 200ms opacity transitions on `.wb-method-tag` and similar). Motion is reserved for moments, not chrome.

---

## Spatial Principles

**Two layouts, one decision boundary at 900px.**

- **Mobile (under 900px):** single column, current 440px max-width, bottom sheet pattern retained
- **Desktop (900px and above):** split layout. Map fills the viewport. A 360 to 400px sidebar on the right contains saved places, search, and method tabs. Bottom sheet collapses. FABs become inline sidebar buttons.

A frontend never tested on desktop is a deal-breaker for a TUM lab demo opened on a laptop. This is non-negotiable.

**List rhythm:** Saved-places list uses asymmetric two-column rhythm (large card and small card alternation) instead of uniform 56px rows. Visual variety carries meaning. Most-revisited places get the larger card.

**Hero overflow:** Place names in the detail hero may break the safe area inset. Editorial confidence over orthodox containment. Apply: `font-size: 48-56px; letter-spacing: -2px; margin-inline-start: -8px` on `.wb-detail-name`.

---

## Anti-Patterns Banned in This Project

These are project-specific bans on top of the Impeccable defaults.

1. **Sparkles icon (lucide-react):** banned in all UI. Currently used in three places. Replaced with Compass (proactive banner), MapPin filled (item reason line), and removed entirely from ExplanationBreakdown action prediction.
2. **Per-category diagonal gradients:** replaced with single-color category washes or typographic heroes (see Color Tokens).
3. **3-stat hero metric row** (Distance / Saved / Views, MapPage.jsx:877-890): replaced with a single italic sentence in 17 to 19px Fraunces. Example: "Five visits over six weeks. The last one was Tuesday." Distance folds into the address line.
4. **Em dashes in UI copy:** replaced with periods, colons, or parentheses. Hyphens in compound words are fine.
5. **Default iOS drag handle** (`.wb-handle`, 36 by 4px gray pill): replaced with a thin `--pin` line that subtly pulses on first session load.
6. **Generic "M" avatar** (`.wb-avatar`, MapPage.jsx:1893): either a real user photo or a small "MUC" city tag in JetBrains Mono, never a placeholder letter.

---

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-17 | Aesthetic direction committed: Editorial Paper | Aligns with Sappelli re-finding concept. Rejects category reflex. Preserves engineering work while replacing visual default. |
| 2026-05-17 | Type system committed: Fraunces, Public Sans, JetBrains Mono | Replaces system-font default from Vite template. Establishes display, body, and numeral hierarchy. |
| 2026-05-17 | Single signature motion moment: time-of-day ambient drift | Leverages existing weather and clock infrastructure. Rare in this product category to have UI that responds to time. |
| 2026-05-17 | Desktop layout breakpoint: 900px split layout | Demo-day reviewers open on laptop. Current 440px column is unusable on desktop. |
| 2026-05-17 | New components added under author's ownership: TripPage (one-day itinerary), TabBar (4-tab production nav: Map/Saved/Plan/Add), TypeBadge, TicketCountdown. MapPage upgrades: sort dropdown, type filter chips, working category filter, text search, ?mode= URL routing. | Solo implementation, continued under Editorial Paper direction. TabBar repurposed from prior stub into production. All new components are governed by the anti-pattern bans above; violations introduced during build will be cleared in Phase 1. |

---

## How to Use This Document

1. Any subsequent frontend change must be checked against this document before implementation.
2. When invoking design-related skills (`/impeccable polish`, `/impeccable critique`, `/impeccable typeset`, or Anthropic's frontend-design skill), the skill will automatically read this file as project context.
3. If a decision in this document needs to change, append a new dated row to the Decision Log. Do not silently overwrite prior decisions.

---

## Attribution Note

This document and all frontend design decisions for WayBack are by Haichen Duan. The author retains design authorship for portfolio, CV, and academic credit purposes. The frontend implementation in `src/pages/MapPage.jsx`, `src/pages/TripPage.jsx`, `src/components/MethodCompare.jsx`, `src/components/ExplanationBreakdown.jsx`, `src/components/DetailPanel.jsx`, `src/components/TabBar.jsx`, `src/components/TypeBadge.jsx`, `src/components/TicketCountdown.jsx`, and all related styling is by the author. Backend infrastructure (Flask, Railway deployment, REST endpoints, AI-generated place descriptions) is by the teammate.

---

Last updated: 2026-05-17
Author: Haichen Duan (Joan)
