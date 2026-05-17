# IMPLEMENTATION_PLAN.md: WayBack Frontend & UIUX

## Scope and Ownership

This document covers **frontend and UIUX work only**, owned and executed by Haichen Duan (Joan).

Backend work (Flask, Railway, REST endpoints, AI-generated place descriptions) is out of scope for this plan and is owned by the teammate. Backend timeline, deployment, and infrastructure decisions are documented elsewhere.

**Author:** Haichen Duan (Joan)
**Role:** Sole frontend designer and developer, sole UIUX designer
**Project:** TUM Wirtschaftsinformatik Group W4

**Three TUM deadlines:**

- **Milestone 2 (Implementation):** 2026-06-01
- **Milestone 3 (Evaluation and Tests):** 2026-06-22
- **Final Presentation and Written Report:** 2026-06-30

**Plan written:** 2026-05-17

This plan derives directly from `DESIGN.md` (the source of truth for visual and interaction decisions) and from two `/impeccable audit` passes against the WayBack frontend codebase.

---

## Three-Phase Strategy

The 44-day window from plan start to final presentation breaks cleanly into three sprints, each ending on a TUM milestone:

| Phase | Window | Target Milestone | Frontend / UIUX Focus |
|---|---|---|---|
| **A: Implementation Sprint** | 2026-05-17 to 2026-05-31 (15 days) | M2 on 6/1 | Build the Editorial Paper visual system end-to-end. Desktop layout. Signature motion. Accessibility baseline. |
| **B: Evaluation Sprint** | 2026-06-02 to 2026-06-21 (20 days) | M3 on 6/22 | User testing on real testers. Heuristic evaluation. Automated tests (a11y, visual regression, design CI). Iterate on findings. |
| **C: Synthesis Sprint** | 2026-06-23 to 2026-06-29 (7 days) | Final on 6/30 | Written report. Presentation deck. Rehearsal. Final polish based on evaluation findings. |

**Sequencing principle:** Visual transformation first (you cannot evaluate what is not yet built). Evaluation only on the finished surface. Synthesis last, using the evaluation evidence as the centerpiece of the final report narrative.

---

## Phase A: Implementation Sprint (2026-05-17 to 2026-05-31)

**Target deliverable for M2 on 6/1:** A working WayBack frontend that visually realizes the Editorial Paper aesthetic direction, runs on desktop and mobile, and clears every anti-pattern banned in DESIGN.md.

### Week 1: Cleanup, Polish, Typography, Color

| Date | Task | Domain | Estimated hours |
|---|---|---|---|
| 2026-05-17 | Update DESIGN.md (Attribution + Decision Log) for new components (TripPage, TabBar, TypeBadge, TicketCountdown). Phase 1 cleanup steps 1 to 5: delete dead files (FeedPage, ItemDetailPage, Layout, App.css), uninstall unused dependencies, fix page title and meta, gitignore .DS_Store. | UIUX (governance) + Frontend | 3 |
| 2026-05-18 | Phase 1 step 6: Consolidate four ScopedStyles blocks into one global stylesheet (`src/styles/global.css`). Keep current token names for now; structural refactor only. Verify with `npx vite build`. | Frontend (refactor) | 4 |
| 2026-05-19 | `/impeccable polish` sweep: replace all Sparkles icon uses with Compass, MapPin-filled, or remove. Replace all em dashes in UI string literals with periods, colons, or parentheses. Remove decorative chrome opacity micro-fades. | UIUX (anti-pattern enforcement) | 3 |
| 2026-05-20 | `/impeccable typeset`: load Fraunces (display), Public Sans (body and UI), JetBrains Mono (numerals). Apply 12 / 14 / 16 / 19 / 24 / 32 / 48 type scale. Retire the -apple-system font stack. | UIUX (typography system) | 4 |
| 2026-05-21 to 2026-05-22 | `/impeccable colorize`: introduce Editorial Paper token system (--paper, --paper-soft, --paper-warm, --ink, --ink-soft, --rule, --pin, --pin-soft, --map-bg, --accent-fallback). Rename and remap existing tokens. Implement dark map plus cream chrome inversion. Replace 10 per-category diagonal gradients with single-color category washes. | UIUX (color system) | 8 |

### Week 2: Desktop Layout, Detail, Motion, A11y, M2 Submission

| Date | Task | Domain | Estimated hours |
|---|---|---|---|
| 2026-05-23 to 2026-05-25 | `/impeccable adapt`: 900px split-layout breakpoint. Map fills viewport on desktop. 360 to 400px sidebar on the right with saved places, search, method tabs. Bottom sheet collapses to inline panel on desktop. Touch targets expanded to 44px minimum on the four offenders identified by audit. | UIUX (responsive composition) | 12 |
| 2026-05-26 | Detail panel hero oversized name (48 to 56px Fraunces, letter-spacing -2px, margin overflow). Replace `.wb-handle` gray pill with thin `--pin` line that pulses on first session load. Replace `.wb-avatar` placeholder "M" with JetBrains Mono "MUC" tag. Replace 3-stat hero metric row with single italic Fraunces sentence ("Five visits over six weeks. The last one was Tuesday."). Saved-list asymmetric two-column rhythm. | UIUX (component detail) | 5 |
| 2026-05-27 | Signature motion: time-of-day ambient drift on `--paper` toward `--paper-warm` at dusk hours. Convert `transition: bottom` to `transform: translateY` on FABs. Implement `prefers-reduced-motion: reduce`. | UIUX (motion system) | 4 |
| 2026-05-28 | Accessibility hardening: global `:focus-visible` ring using `--pin`. aria-labels on search and add-place inputs. `<main>` landmark wrapping app shell. `<h1>` (visually hidden or sheet title promoted). Keyboard activation on proactive banner. | Frontend (a11y) | 3 |
| 2026-05-29 | Full re-run of `/impeccable audit`. Real device test on laptop (1440px viewport) and phone (390px viewport). Capture before/after screenshots for the M3 evaluation report. | UIUX (QA) | 3 |
| 2026-05-30 | Fix bugs surfaced by re-audit and device test. **M2 feature freeze takes effect.** | Frontend | 4 |
| 2026-05-31 | M2 submission prep: tag `v1.0-M2-implementation` in git. Generate a short M2 walkthrough document (one-pager) summarizing what was built and how it maps to DESIGN.md. Verify deployment. | Frontend + UIUX | 3 |
| **2026-06-01** | **Milestone 2: Implementation submission** | n/a | n/a |

### Phase A Estimated Effort

- Total frontend / UIUX hours: approximately 56
- Working days: 15
- Average daily load: 3.7 hours

---

## Phase B: Evaluation Sprint (2026-06-02 to 2026-06-21)

**Target deliverable for M3 on 6/22:** Documented user testing findings, automated test coverage for frontend, a CI design-check script enforcing DESIGN.md anti-pattern bans, and an iteration pass addressing high-severity issues surfaced during evaluation.

### Week 3: User Testing Setup and Recruitment

| Date | Task | Domain | Estimated hours |
|---|---|---|---|
| 2026-06-02 to 2026-06-03 | Define research questions: Does the re-finding metaphor land? Are the three recommendation methods (CBR / JITIR / CIA) understandable? Does the time-of-day ambient drift register consciously or unconsciously? Is the Editorial Paper direction perceived as intentional or accidental? Where does the flow break? | UIUX (research design) | 3 |
| 2026-06-03 | Write test script: 4 to 5 representative tasks covering save flow, re-find flow, plan-my-day flow, method comparison flow. Each task tagged with success criteria and observation points. | UIUX (research design) | 3 |
| 2026-06-04 to 2026-06-05 | Recruit 6 to 8 testers via TUM CIT student channels. Mix backgrounds: 3 Wirtschaftsinformatik, 3 CS, 1 to 2 from other faculties as control. Schedule 30 to 45 minute sessions. Prepare consent form for session recording. | UIUX (research operations) | 4 |

### Week 4 to mid-Week 5: User Testing Execution and Synthesis

| Date | Task | Domain | Estimated hours |
|---|---|---|---|
| 2026-06-06 to 2026-06-14 | Conduct user testing sessions using think-aloud protocol. Moderated, remote or in-person depending on tester availability. Record (with consent). Take live notes. Run pilot session first (2026-06-06) and refine script if needed. | UIUX (research execution) | 12 to 15 (spread across multiple sessions) |
| 2026-06-15 to 2026-06-16 | Synthesize findings. Tag issues by severity (P0 blocking, P1 major, P2 minor, P3 polish). Cluster by theme. Produce a UX evaluation document for the M3 submission. | UIUX (research synthesis) | 6 |

### Week 5 second half to Week 6: Automated Tests and Design CI

| Date | Task | Domain | Estimated hours |
|---|---|---|---|
| 2026-06-17 | Accessibility automated test: add `axe-core` or `pa11y-ci` to npm scripts. Run against all routes. Document baseline score and remaining violations. | Frontend (a11y testing) | 3 |
| 2026-06-18 | Unit tests for shared utilities using vitest: haversine distance, category gradient lookup, time formatting helpers, MVV transit area resolver. Goal is not 100% coverage but coverage of the logic that affects user-visible behavior. | Frontend (testing) | 4 |
| 2026-06-19 | Visual regression baseline: capture screenshots of each major route (Map, Saved, Plan, Detail panel, Compare view) at desktop and mobile viewports. Store in `tests/visual-baseline/`. Document in README how to compare against this baseline. | UIUX (testing) | 3 |
| 2026-06-20 | **CI design-check script** (`scripts/check-design.sh`): grep-based enforcement of DESIGN.md anti-pattern bans. Rules: (1) no Sparkles icon imports in any .jsx file, (2) no em dash character in JSX string literals, (3) no hardcoded hex colors outside `src/styles/global.css`, (4) no `transition` involving layout properties (top, bottom, left, right, width, height). Wire into a pre-commit hook and document in README. | UIUX (governance automation) | 4 |
| 2026-06-21 | Iterate on high-severity issues surfaced by user testing. Tag `v1.1-M3-evaluation`. Update DESIGN.md Decision Log with entries summarizing the evaluation findings and which iterations were applied. | UIUX + Frontend (iteration) | 5 |
| **2026-06-22** | **Milestone 3: Evaluation and tests submission** | n/a | n/a |

### Phase B Estimated Effort

- Total frontend / UIUX hours: approximately 50
- Working days: 20
- Average daily load: 2.5 hours
- Lighter than Phase A because user testing is intermittent (sessions scheduled around testers' availability)

---

## Phase C: Synthesis Sprint (2026-06-23 to 2026-06-29)

**Target deliverable for 6/30:** A written report integrating research foundation, design rationale, implementation walkthrough, evaluation findings, and a polished live presentation.

| Date | Task | Domain | Estimated hours |
|---|---|---|---|
| 2026-06-23 to 2026-06-24 | Written report sections one and two: Research motivation (Sappelli et al. 2017 framing) and Design philosophy (DESIGN.md content adapted into prose). Reference the Editorial Paper rationale in academic register. | Writing | 6 |
| 2026-06-24 to 2026-06-25 | Written report sections three and four: Implementation walkthrough (component map, key interactions, signature motion) and Design system as artifact (DESIGN.md, IMPLEMENTATION_PLAN.md, CI design-check script as governance contribution). | Writing | 6 |
| 2026-06-26 | Written report section five: Evaluation methodology and findings. Quantitative breakdown of testing sessions, qualitative theme summary, severity-tagged issues, iterations applied. This is the longest section and the strongest one. | Writing | 5 |
| 2026-06-26 | Written report section six: Limitations and future work. Acknowledge the solo testing sample size, the lack of A/B comparison across aesthetic directions, the deferred Percy or Chromatic integration, and any backend constraints affecting frontend capability. | Writing | 2 |
| 2026-06-27 | Presentation deck: 10 to 12 slides. Core narrative: solo frontend and UIUX, design system governance, evaluation-driven iteration, six-week arc. Use before/after screenshots from M2 and visual regression baseline as supporting evidence. | UIUX (presentation design) | 4 |
| 2026-06-28 | Rehearse presentation three times. Time it. Prepare answers for likely Q&A: Why Editorial Paper over the mint baseline? How did you handle the 440px to desktop transition? What would you change with another two weeks? How does the CI script prevent regression? | Presentation prep | 3 |
| 2026-06-29 | Final polish on any visual or copy issue surfaced during rehearsal. Final commit. Tag `v1.0-final`. | Frontend + UIUX | 2 |
| **2026-06-30** | **Final Presentation and Written Report submission** | n/a | n/a |

### Phase C Estimated Effort

- Total hours: approximately 28
- Working days: 7
- Average daily load: 4 hours (writing-heavy)

---

## Total Effort Across All Phases

| Phase | Hours | Days | Daily Average |
|---|---|---|---|
| A (Implementation) | 56 | 15 | 3.7 |
| B (Evaluation) | 50 | 20 | 2.5 |
| C (Synthesis) | 28 | 7 | 4.0 |
| **Total** | **134** | **42** | **3.2** |

This load is compatible with full-time student status and potential 20-hour Werkstudent work in parallel.

---

## Risk Register (Frontend / UIUX Only)

| Risk | Severity | Phase | Mitigation |
|---|---|---|---|
| Color system swap breaks visual cohesion mid-week | High | A | Token rename happens in one commit. Old tokens deleted only after new tokens verified in dev. Visual regression checked on each route. |
| Desktop layout takes longer than 12 hours | High | A | Reserved across three days including weekend. If still incomplete by Monday 5/25 night, sidebar collapses to drawer (acceptable fallback, less work). |
| New features requested by self, teammate, or course | High | All | Strict deferral to BACKLOG.md. Communicated to teammate at start of plan. |
| User testing recruitment fails to fill 6 to 8 slots | Medium | B | Backup plan: 4 testers minimum with deeper sessions (60 min each instead of 30 to 45). Sample size limitation documented in report as a known constraint, not a hidden flaw. |
| Time-of-day ambient drift visually unreadable in practice | Medium | A | If drift is imperceptible to users in testing, fall back to manual dusk-mode toggle. Decision made by 2026-05-27 evening at latest. |
| Evaluation surfaces high-severity issues requiring more than allocated iteration time | Medium | B | Phase B has 5 hours of iteration time on 6/21. If insufficient, defer P2 and P3 issues to BACKLOG.md and document the deferral in the M3 report. |
| `/impeccable colorize` introduces WCAG contrast regressions | Medium | A | Each token pair checked against WCAG AA contrast ratio in CSS comment. Manual check on 2026-05-22. |
| Backend deployment delays affect demo data | Out of scope | All | Owned by teammate. Frontend works against mock data if backend is unavailable. Tested with mock data once per phase. |

---

## Documents Produced by the End of the Project

By 2026-06-30, the project root contains the following frontend / UIUX deliverables, all authored by Haichen Duan:

1. `DESIGN.md`: source of truth for visual and interaction decisions, with Decision Log entries from 5/17 through final evaluation findings
2. `IMPLEMENTATION_PLAN.md`: this document, ending with a retrospective annotation of completed phases
3. `tests/user-research/`: test scripts, consent forms, session notes, synthesis document
4. `scripts/check-design.sh`: CI design-check enforcement script
5. `tests/visual-baseline/`: screenshot baselines per route per viewport
6. `tests/a11y-report.md`: automated accessibility audit output
7. Written report (PDF): six sections integrating research, design, implementation, evaluation, governance, and limitations
8. Presentation deck: 10 to 12 slides

All of these are produced by the author. The teammate's backend deliverables are documented separately.

---

## Attribution Note

Every task in this plan is to be implemented by Haichen Duan as sole frontend designer and sole UIUX designer for the WayBack project. Backend work is out of scope and owned by the teammate.

Git commit attribution for all frontend and UIUX work must consistently use the author's identity. Commit messages should reference the relevant phase or task in this plan when applicable, to maintain a traceable record from plan to implementation.

The Decision Log in DESIGN.md and this implementation plan together form the design authorship record for the WayBack project. Both documents are committed to the repository under the author's identity and are the canonical evidence for design ownership disputes.

---

Last updated: 2026-05-17 (revised to reflect actual TUM milestones: M2 on 6/1, M3 on 6/22, Final on 6/30)
Author: Haichen Duan (Joan)
