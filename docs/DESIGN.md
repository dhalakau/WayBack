# DESIGN.md: WayBack Frontend

## Authorship

**Frontend design and implementation:** Haichen Duan (Joan)
**Backend:** Swayamsidh (Flask)
**Project:** TUM School of CIT, Informatik · Projects in Recommender Systems · Group W4
**Research foundation:** Sappelli et al. 2017, "Personal Information Access for Re-finding"
**Timeline:** Solo-built frontend, May to June 2026. M2 implementation 2026-06-01, M3 evaluation 2026-06-22, final presentation 2026-07-06.

All frontend design decisions documented below are by the author. The visual system, type stack, motion language, spatial logic, and component compositions were chosen, justified, and implemented by the author. This document is the source of truth for any subsequent design changes. Reviewers should consult it before attributing design decisions.

---

## Design Philosophy

**Memory, not maps.**

WayBack surfaces past personal information into present context. The interface should feel like personal memory layered onto a real place, not like a generic mapping or tourism app.

This rejects the most common category reflexes:

- Muted teal plus navy reads as "observability dashboard or SaaS map tool"
- Inter plus purple gradients reads as "Stripe-school AI startup"
- Sparkles plus rounded cards reads as "ChatGPT-era AI feature"

Instead, the aesthetic commits to **Editorial Paper**: cream paper everywhere, pin red as the single signature accent, ink for text and structure. The map joins the paper (CartoDB Positron tiles in light mode). Editorial Paper is light-first; a warm cocoa dark counterpart (re-introduced 2026-05-26, see Decision Log) swaps to CARTO Dark Matter tiles. References include Moleskine field notebooks, printed city atlases, and archival research journals.

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

--map-bg: #ece4d2;       /* literal Positron tile background match; sits just below --paper in the cream family */
--accent-fallback: #a0e6d4; /* legacy mint, retained only for live-data badges */
```

**Category colors are reference-only.** The 10 saturated category hues persist exclusively as map-marker fills, in desaturated form (color-mix(in oklch, <orig> 55%, var(--paper-warm)) by default; transport and park are hand-anchored deeper variants for Positron-tile contrast). They must not appear elsewhere in the chrome: no category-tinted hero washes, no category-tinted badges, no category-tinted backgrounds. Category distinction in chrome comes from icon + label + typography, not color blocks.

**Single accent rule:** `--pin` is the only signature accent. It should never appear next to `--accent-fallback`. Pick one per surface.

**Dark counterpart tokens.** Re-introduced 2026-05-26 (see Decision Log). Toggled via `<html data-theme="dark">`; light mode is the default and uses the `:root` tokens above. Current overrides as they exist in `src/styles/global.css`:

```css
html[data-theme="dark"] {
  color-scheme: dark;
  --paper:      #1a1714;
  --paper-soft: #2a2520;
  --paper-warm: #221d18;
  --ink:        #f0ebe2;
  --ink-soft:   #b9b0a3;
  --rule:       #3a342d;
  --pin:        #e07a6e;
  --pin-soft:   #7a3c34;
  --map-bg:     #1a1714;
}
html[data-theme="dark"] .wb-app {
  --handle: #6a635a;
  --accent-on: #1a1714;
}
```

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

A frontend never tested on desktop is a deal-breaker for a course demo opened on a laptop. This is non-negotiable.

**List rhythm:** Saved-places list uses asymmetric two-column rhythm (large card and small card alternation) instead of uniform 56px rows. Visual variety carries meaning. Most-revisited places get the larger card.

**Hero overflow:** Place names in the detail hero may break the safe area inset. Editorial confidence over orthodox containment. Apply: `font-size: 48-56px; letter-spacing: -2px; margin-inline-start: -8px` on `.wb-detail-name`.

---

## Anti-Patterns Banned in This Project

These are project-specific bans on top of the Impeccable defaults.

1. **Sparkles icon (lucide-react):** banned in all UI. Currently used in three places. Replaced with Compass (proactive banner), MapPin filled (item reason line), and removed entirely from ExplanationBreakdown action prediction.
2. **Per-category diagonal gradients:** replaced with single-color category washes or typographic heroes (see Color Tokens).
3. ~~3-stat hero metric row~~ Ban withdrawn 2026-06-11, see Decision Log. The Distance / Saved / Views stat row in the detail panel is a sanctioned component.
4. **Em dashes in UI copy:** replaced with periods, colons, or parentheses. Hyphens in compound words are fine.
5. **Default iOS drag handle** (`.wb-handle`, 36 by 4px gray pill): replaced with a thin `--pin` line that subtly pulses on first session load.
6. **Generic "M" avatar** (`.wb-avatar`, MapPage.jsx:1893): either a real user photo or a small "MUC" city tag in JetBrains Mono, never a placeholder letter.

---

## Method Mapping (canonical)

| Method | Paper section | Compare column | Map tab label | Default |
|---|---|---|---|---|
| JITIR | 5.1 | Relevant | For this moment | yes |
| CBR | 5.2 | Similar | Based on history | |
| CIA | 5.3 | Contextual | Near you | |

The offline evaluation additionally includes the paper's random baseline as a fourth method, matching the experimental design of Sappelli et al. (2017) Section 6. This table is the single source of truth for method naming. The M3 deck, the user study form, the in-app methodology modal, and the final report must reference it.

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-06-20 | Transit routing limitation stated explicitly: routes always start from Munich Hauptbahnhof, because the curated transit dataset is built around a single origin. When the user is elsewhere, the app shows a brief message and a hint instead of a silent wrong route. | The curated dataset has a fixed origin, and arbitrary-origin routing would require restructuring it, which is out of scope for the prototype. An explicit fallback is more honest than rendering an incorrect route. Arbitrary-origin routing is future work. |
| 2026-06-20 | Time-of-day handling is demote, not hide. Out-of-hours places stay in the ranking, demoted through contextBoost, and are marked in the detail panel by the timeOfDayFit signal (for example "Outside museum opening hours" at weak strength). The proactive banner can still surface them through signals other than current opening hours. Opening windows are defined per category, not per venue. | Re-finding serves an intent the user already holds, so a place saved for the next day should not disappear because it is closed now; a pure "open now" recommender would hide it. The system keeps it visible and states the timing honestly. Per-category windows are an approximation; per-venue hours are future work. |
| 2026-06-20 | Frontend CI workflow added on GitHub Actions, running lint, tests, and a design-check step that enforces the anti-pattern bans in this document. | DESIGN.md is the source of truth for frontend design, but a document alone does not prevent regressions. A CI design-check turns the bans into an automated gate, so violations are caught on push rather than in review. |
| 2026-06-14 to 2026-06-17 | Personal-note reachability reworked across the save flow. Saving from a search result now routes through the review form instead of an instant save, the note can be edited after saving (PATCH endpoint), and the add form separates the place name from the personal note as two fields with distinct placeholders. The save-time note field was dropped in favour of a single name input with the note added afterwards. | Sappelli et al. treat a personal note as a contextual cue for re-finding, but in real use the note was effectively unreachable: an instant save skipped the form and the note could not be edited later. Since the note is the cue the methods rely on, the flow was reworked so the cue is always reachable and refinable, not only available at the moment of saving. |
| 2026-06-14 | osmToCategory mapping corrected so bakeries, cinemas, and similar venues land in their intended categories. | OpenStreetMap tags miscategorised several venues (a bakery as shopping, a museum as transport), which both mislabels the place and can exclude it from the day plan, whose slots draw on specific categories. A miscategorised museum never reaches the museum slot. |
| 2026-06-13 | Place search (Photon over OpenStreetMap) results now show distance and locality, sort nearest-first, and filter out results beyond 200 km of Munich. A fallback notice appears when ranking falls back to the Hauptbahnhof origin. | Dogfooding produced saves thousands of kilometres away from same-named results, and undifferentiated result lists made the right venue hard to pick. Distance and locality with a nearest-first sort make the local match obvious, the 200 km filter removes far false matches, and the notice keeps the Hauptbahnhof-origin assumption visible rather than silent. |
| 2026-06-13 | Proactive banner dismissal now silences the whole banner channel on a cooldown (45 minutes, or until the user moves more than 500 metres) instead of hiding only the dismissed item. The dismissed item is also added to a persisted dismissed-set so it stays suppressed after the cooldown lifts. | Dogfooding showed the banner reappearing with the next ranked item immediately after a dismissal, serving several in a row, which breaks the JITIR proactive restraint (paper 3.3: proactive, not intrusive). A dismissal concerns the moment, not the single item, so it should quiet the channel briefly rather than advance to the next candidate. The cooldown is session-scoped; a fresh load reopens the channel. |
| 2026-06-11 | Detail panel scoping extended to the Plan path: opening a stop from the day itinerary now sets detailContext to the itinerary's stops in order, so the arrows and pagination cycle within the 5 stops (breadcrumb "From: Your Munich day") instead of the full saved pool. Marker taps and deep links keep falling back to the full list. | The scoping rule already governed method tabs and search results: the detail panel is an extension of the list the user came from. The Plan path simply never set the context, surfacing as 9 / 30 pagination from a 5-stop itinerary. Found during dogfooding day zero, fixed the same night. |
| 2026-06-11 | Compare view header cleanup: the "How do these differ?" link moved from the panel header to the bottom of the panel, centered below the three columns, resolving the overlap with the floating panel's close button. The italic footer line restating the Sappelli comparison was removed; the point now lives in the presentation script rather than the UI. | The header link was clipped under the desktop close button, and the footer line explained to users what the three diverging columns already show. The interface should demonstrate the disagreement, not caption it. Found during dogfooding day zero. |
| 2026-06-11 | Compare view raw scores replaced by per-column strength bars, the same 1 to 3 segment visual as the detail panel signals, normalized within each column to its top score (ratio of 0.85 and above maps to 3 bars, 0.5 and above to 2, else 1). Raw values demoted to a hover tooltip ("raw score: 0.0617"). Each column gained a one-line ranking-basis caption under its subtitle. | The three methods score on incomparable scales (TF-IDF cosine, BM25, CIA activation), so visible raw numbers invited cross-column magnitude comparison that is mathematically meaningless, and leaked implementation detail the UI otherwise keeps behind the methodology modal. Bars answer the question users actually have, how confident is this method about this rank, and reuse the strength language the detail panel already taught, one vocabulary for strength across the app. The differing bar-gradient shapes per column are themselves a visualization of methods disagreeing by design. Found during dogfooding day zero, fixed before the user study so participants evaluate the corrected design. |
| 2026-06-11 | Canonical method mapping committed and enforced. JITIR (paper 5.1) = "For this moment" (Compare column: Relevant), default tab. CBR (5.2) = "Based on history" (Compare column: Similar). CIA (5.3) = "Near you" (Compare column: Contextual). | A paper-grounding audit against the Sappelli et al. (2017) source text found the frontend contradicting itself: MethodCompare had 5.1 and 5.2 swapped on column props and modal copy, METHOD_LABEL assigned every tab label to the wrong method (the default tab claimed JITIR's label while serving CIA), and the CIA expansion misread Interactive as Item. Fixed in two commits before any evaluation data was collected, so all dogfooding and user study sessions run against the correct mapping. |
| 2026-06-11 | Proactive banner canonical framing: the banner follows the JITIR proactive paradigm (paper 3.3, background query, proactive surfacing) and uses the CIA activation score as its strength signal (6.3, CIA strongest at action prediction). It polls /recommendations with method=cia every 30 seconds independent of the active tab, walks the ranked list, and surfaces the first non-dismissed item passing the composite four-criterion gate. Rendered as a map overlay anchored below the weather and method row, independent of the bottom sheet. | Earlier documentation described the banner inconsistently (JITIR paradigm in the slides, top CIA recommendation in code comments). Both were half right; this entry fixes the canonical one-sentence framing. Tab independence matters: switching the default tab to JITIR did not change banner semantics because the banner never reads the active method's scores. |
| 2026-06-11 | Anti-pattern ban 3 (3-stat hero metric row) withdrawn. The Distance / Saved / Views row in the detail panel stays; the italic Fraunces sentence replacement is retired unbuilt. Ban 6 (placeholder M avatar) is enforced instead: replaced with a JetBrains Mono MUC city tag. | M2 practice overruled the original aesthetic call on ban 3. The stat row was presented as a feature in the M2 walkthrough and earned its place: the three numbers are the raw inputs to the four paper-criteria signals shown directly below it, so displaying them explicitly supports explanation transparency rather than undermining the editorial register. A ban contradicted by shipped, presented reality is worse for governance than a withdrawn one. Ban 6 had no such justification and was simply unexecuted; fixed in code. |
| 2026-06-11 | Desktop layout implemented as a floating panel over a full-screen map (the inverse of the mobile bottom sheet), following the pattern of a desktop maps application, at the 900px split breakpoint. Same component code serves both mobile and desktop. | The 900px split-layout breakpoint was decided 2026-05-17 but not yet built. Demo-day reviewers open on a laptop, so the desktop form needs to be a first-class layout rather than a stretched mobile column. A floating panel keeps the map as the primary surface on desktop, consistent with the mobile design where the map is home. |
| 2026-06-08 | Place search via Photon (free OSM geocoder, no API key) added to the Add flow, debounced 300 ms, biased to userLoc. OSM key/value pairs map onto the 10 WayBack categories via osmToCategory(), falling back to 'attraction' for unrecognized tags. | The save flow previously only supported manual pin drops, which limited dogfooding and user study sessions to seed data. Real-place search makes the saved pool authentic. The category fallback is deliberate: a wrong-but-plausible category beats blocking the save, and miscategorizations surface naturally during dogfooding as evaluation findings. |
| 2026-06-08 | Opt-in live geolocation via watchPosition, triggered by the locate button. Hauptbahnhof remains the default frame of reference until the user opts in, and the permanent fallback on denial. Requires the HTTPS deployment. | Context relevance signals (Right here, proximity gating on the proactive banner, distance sorting) are only honest with a real position. Opt-in keeps the demo deterministic by default while letting real-use sessions run on true context. |
| 2026-05-26 | Dark mode re-introduced after Swayamsidh review, superseding the 2026-05-21 removal. Warm cocoa palette (deep cocoa paper, off-white ink, softened coral pin) with CARTO Dark Matter tiles. Toggle persists via localStorage as data-theme on html. | The light-only stance assumed Editorial Paper could not survive inversion. The cocoa variant keeps the editorial warmth (no neutral gray dark mode) and extends usability to evening contexts, which matter for a time-of-day-aware tourism app. Design Philosophy is amended: Editorial Paper is light-first with a warm dark counterpart, not light-only. |
| 2026-05-17 | Aesthetic direction committed: Editorial Paper | Aligns with Sappelli re-finding concept. Rejects category reflex. Preserves engineering work while replacing visual default. |
| 2026-05-17 | Type system committed: Fraunces, Public Sans, JetBrains Mono | Replaces system-font default from Vite template. Establishes display, body, and numeral hierarchy. |
| 2026-05-17 | Single signature motion moment: time-of-day ambient drift | Leverages existing weather and clock infrastructure. Rare in this product category to have UI that responds to time. |
| 2026-05-17 | Desktop layout breakpoint: 900px split layout | Demo-day reviewers open on laptop. Current 440px column is unusable on desktop. |
| 2026-05-17 | New components added under author's ownership: TripPage (one-day itinerary), TabBar (4-tab production nav: Map/Saved/Plan/Add), TypeBadge, TicketCountdown. MapPage upgrades: sort dropdown, type filter chips, working category filter, text search, ?mode= URL routing. | Solo implementation, continued under Editorial Paper direction. TabBar repurposed from prior stub into production. All new components are governed by the anti-pattern bans above; violations introduced during build will be cleared in Phase 1. |
| 2026-05-21 | Removed dark mode toggle. Editorial Paper is light-only by design; dark variant would invert the core concept (cream chrome plus dark map). Deferred indefinitely. | The dark-mode toggle (.wb-theme button, `theme` state, `[data-theme]` attribute, and the two CartoDB tile URL variants) all assumed dark/light were equal citizens. Under Editorial Paper, the map is the only dark surface and everything else is paper. A dark-chrome variant of the same product is a different product. Removed cleanly rather than maintaining a dead code path. |
| 2026-05-17 | Pivoted to full cream Editorial Paper; dark map deprecated | Original split read as visual collage in practice (three dark blocks crashing into one cream block). The 'reverse Apple Maps' move was conceptually clever but not executable without a custom-styled dark tile (not in scope). Switched to CartoDB Positron tiles for genuine paper-on-paper continuity. Pin red remains single accent. |
| 2026-05-17 | Killed cat-color washes in detail hero and desaturated map markers. Cat colors persist on markers only and in desaturated form. | Editorial Paper minimalism means category distinction comes from icon + label + typography, not color blocks. Color is reserved for pin red (single accent) and live-data mint (two sites: weather pill icon, live ticket-countdown text). The earlier 18% cat-color washes on the detail hero read as a separate visual language from the cream chrome; eliminating them and replacing the hero with a paper-warm cream surface restores chrome continuity. Markers were the only surface where per-category color cues remained, but pre-pivot saturation competed with the cream system; OKLCH-mixed muted variants (55% by default, transport/park anchored deeper) preserve recognizability without competing. This completes the cream pivot started earlier today. |
| 2026-06-08 | Re-enabled geolocation as opt-in via the Locate FAB (live tracking with watchPosition, 50 m update threshold), with Hauptbahnhof retained as the load-time default and fallback. Supersedes the earlier decision to disable geolocation for the demo. | The evaluation phase needs real proximity for dogfooding, so a fixed start point no longer suffices. Making it opt-in (first FAB tap requests permission and recenters on the first fix; later taps just recenter) keeps the stable Hauptbahnhof frame of reference for cold loads and on permission denial or error, while the 50 m threshold prevents GPS jitter from spamming the recommendation backend. |

---

## How to Use This Document

1. Any subsequent frontend change must be checked against this document before implementation.
2. When invoking design-related skills (`/impeccable polish`, `/impeccable critique`, `/impeccable typeset`, or Anthropic's frontend-design skill), the skill will automatically read this file as project context.
3. If a decision in this document needs to change, append a new dated row to the Decision Log. Do not silently overwrite prior decisions.

---

## Attribution Note

This document and all frontend design decisions for WayBack are by Haichen Duan. The author retains design authorship for portfolio, CV, and academic credit purposes. The frontend implementation in `src/pages/MapPage.jsx`, `src/pages/TripPage.jsx`, `src/components/MethodCompare.jsx`, `src/components/ExplanationBreakdown.jsx`, `src/components/DetailPanel.jsx`, `src/components/TabBar.jsx`, `src/components/TypeBadge.jsx`, `src/components/TicketCountdown.jsx`, and all related styling is by the author. Backend infrastructure (Flask, REST endpoints) is by Swayamsidh.

---

Last updated: 2026-05-17
Author: Haichen Duan (Joan)
