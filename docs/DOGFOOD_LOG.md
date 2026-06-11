# Dogfooding Log (diary study), 2026-06-12 to 2026-06-19

Both team members use the deployed app in real Munich contexts for one week.
Entries are written at the moment of use, not reconstructed later.
This log is the raw material for the diary study layer of the M3 evaluation.

Types: BUG (broken) / UX (works but awkward) / REC (recommendation or explanation quality) / IDEA
Severity: P0 blocks a core flow / P1 wrong but workable / P2 polish / P3 nit
Severity applies to BUG and UX rows; REC and IDEA rows can leave it blank.

| date time | where / context | what I tried | what happened | type | sev | note |
|---|---|---|---|---|---|---|
| 2026-06-11 22:29 | home, desktop, browsing the day plan | opened a stop's detail from Your Munich day, used arrows to flip through the 5 stops | arrows cycled the full 30-item pool (9 / 30), not the itinerary | BUG | P1 | detailContext never set on the Plan path; fixed same night |
| 2026-06-11 22:35 | desktop, compare view | tapped How do these differ | link clipped under the floating panel close button; footer line redundant | UX | P2 | link moved to panel bottom, footer removed; fixed same night |
| 2026-06-11 22:45 | desktop, compare view | read the three columns as a user would | raw scores (0.06 vs 1.79 vs 0.95) read as comparable across columns but aren't; meaningless to users | REC | | replaced with per-column strength bars, raw kept in tooltip; fixed before user study |
| 2026-06-11 23:05 | home, phone, saving real places | searched "supermarkt" near TUM library | suggested the Hauptbahnhof Lidl, not the one 150m away | REC | | verify: was location permission granted? likely Hbf fallback biasing Photon silently; needs a "results near Hauptbahnhof" hint if so |
| 2026-06-11 23:08 | home, phone, saving real places | saved Zeit fuer Brot via Photon | categorized as shopping, should be cafe (OSM shop=bakery presumably) | REC | | collect misclassifications all week, batch-fix osmToCategory on Sunday |
| 2026-06-11 23:12 | home, phone, saving real places | searched and saved the same place twice | duplicate saved, no dedupe anywhere | BUG | P0 | pollutes views/rankings/plan; frontend guard added same night, backend constraint needs Sway |
| 2026-06-11 23:15 | home, phone, general use | normal browsing on the phone | page zooms in (likely on input focus) and stays zoomed, must pinch out to restore | BUG | P1 | viewport meta fixed same night (maximum-scale=1, input font sizes to 16px) |
| 2026-06-11 23:25 | home, phone | swiped left/right between places in the detail panel | gesture lags the finger, not 1:1 tracking; settles only after release | UX | P1 | cause: TBD after fix lands; tracking-only fix applied same night |
