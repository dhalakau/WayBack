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
