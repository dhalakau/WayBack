# Dogfooding Log (diary study), 2026-06-12 to 2026-06-19

Both team members use the deployed app in real Munich contexts for one week.
Entries are written at the moment of use, not reconstructed later.
This log is the raw material for the diary study layer of the M3 evaluation.

Types: BUG (broken) / UX (works but awkward) / REC (recommendation or explanation quality) / IDEA
Severity: P0 blocks a core flow / P1 wrong but workable / P2 polish / P3 nit
Severity applies to BUG and UX rows; REC and IDEA rows can leave it blank.

| date time | where / context | what I tried | what happened | type | sev | note |
|---|---|---|---|---|---|---|
| 2026-06-11 22:29 | Main Library TUM, desktop, day plan | opened a stop's detail from Your Munich day, used arrows through the 5 stops | arrows cycled the full 30-item pool (9 / 30), not the itinerary | BUG | P1 | detailContext never set on the Plan path; fixed same night |
| 2026-06-11 22:35 | desktop, compare view | tapped How do these differ | link clipped under the floating panel close button; footer line redundant | UX | P2 | link moved to panel bottom, footer removed; fixed same night |
| 2026-06-11 22:45 | desktop, compare view | read the three columns as a user would | raw scores (0.06 vs 1.79 vs 0.95) read as comparable across columns but aren't | REC | | replaced with per-column strength bars, raw in tooltip; fixed before user study |
| 2026-06-11 23:05 | Main Library TUM, phone, adding places | searched "supermarkt" near TUM library | suggested the Hauptbahnhof Lidl, not the one 150m away | REC | | Hbf fallback biasing Photon silently; needs a location-source hint |
| 2026-06-11 23:08 | Main Library TUM, phone, adding places | saved Zeit fuer Brot via Photon | categorized as shopping, should be cafe (OSM shop=bakery) | REC | | collect misclassifications all week, batch-fix osmToCategory Sunday |
| 2026-06-11 23:12 | Main Library TUM, phone, adding places | searched and saved the same place twice | duplicate saved, no dedupe | BUG | P0 | frontend guard added same night; backend constraint asked of Sway |
| 2026-06-11 23:15 | Main Library TUM, phone | normal browsing | page zooms on input focus and stays zoomed, must pinch out | BUG | P1 | viewport meta fixed same night (maximum-scale=1, input font 16px) |
| 2026-06-11 23:25 | Main Library TUM, phone | swiped between places in the detail panel | gesture lags the finger, not 1:1; settles only after release | UX | P1 | cause: per-frame setTx re-rendered whole DetailPanel incl. ExplanationBreakdown; fixed with ref + rAF transform writes + dragging class |
| 2026-06-11 23:53 | remote, friend Lena (Munich local, frequent traveler) | form pilot, informal use incl. Photon search | scores 4-5 across features, strength bars 5/5, BUT real-trip intent 2/5; surfaced stale form labels + numbering | REC | | pilot, not study N; follow up on the 2 (likely Munich-only coverage); form fixed before 6/18 |
| 2026-06-12 ~09:00 | home, phone | opened the app, all real places gone, pool reset to 30 seed | render free tier disk is ephemeral, every deploy wipes sqlite (7 pushes overnight) | BUG | P0 | kills diary + user study; postgres migration to be done; mitigation: batch deploys evenings only |
| 2026-06-12 ~10:00 | home, phone, confirmed rainy, app weather matched | checked all three tabs | all three surfaced indoor places (cafes, museums); train to airport sank to bottom of Near you | REC | | first real-weather evidence of contextBoost across rankers; on seed pool post-wipe; matches rainy-day study task |
| 2026-06-12 ~10:00 | home, phone | proactive banner appeared before breakfast, sourced from Near you (CIA) | accurate for the moment, but ordering looks purely distance-based | REC | | watch all week whether CIA is proximity-dominated on a small sparse pool; ties to paper 6.3; flagged to Sway for the offline run |
| 2026-06-12 ~10:05 | home, phone | dismissed the proactive banner | banner showed one at a time, but dismissing kept popping the next CIA candidate; served 5 in a row | UX | P1 | dismiss mutes one item not the channel; cool the whole banner (45 min or 500m shift); violates JITIR restraint; fix tonight |
| 2026-06-12 20:23 | home, phone, adding places | searched "Man vs Machine" in Add flow | multiple same-name results, no distance shown, saved one 13,735 km away instead of the one 3 min from Universitaet | UX | P1 | Photon rows need distance + city label + distance sort; wrong save now pollutes pool and Worth revisiting |
| 2026-06-12 20:25 | home, phone, detail of the wrong save | Right here signal | shows "13735574 m away", unformatted raw meters | BUG | P3 | format distances over 10km as km |
| 2026-06-12 20:30 | home, phone, browsing list | raw scores shown next to each list row | number contradicts the visible order (Tantris 94 ranks above Deutsches 95 in Near you); not the active ranker's score | REC | | remove from list rows (detail has full signals); decided, not bars |
| 2026-06-12 20:30 | home, phone, BMW Museum detail | saw the "Event tomorrow Sat 13 Jun" chip | event chip works as a timing nudge: you saved this, and tomorrow is the reason to go | REC | | strong positive; event as a proactive-banner trigger is better justified than proximity; log as future-work IDEA |
