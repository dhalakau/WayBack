# TODO

## Lint cleanup (updated 2026-07-12)

Done (verified gone from frontend/src/pages/MapPage.jsx):

- [x] `formatRouteSummary`: removed
- [x] unused `Search` import: removed
- [x] `routeLoading`: removed
- [x] dead `sendFeedback`: removed (live `submitFeedback` is wired to the detail panel)

Open ESLint findings (7 errors, 2 warnings). CI lint stays `continue-on-error`
until these are cleared:

- [ ] refs accessed during render: MapPage.jsx 802, 963
- [ ] setState called synchronously in an effect: MapPage.jsx 1295, 1399, 1990
- [ ] component created during render (weather icon): MapPage.jsx 2177
- [ ] exhaustive-deps warnings: ExplanationBreakdown.jsx 48, MapPage.jsx 1507
