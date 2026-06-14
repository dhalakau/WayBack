# TODO

## Lint cleanup before vitest (6/17)

Dead and unused items found 2026-06-15 (ESLint). Not AI-related; safe to remove in the cleanup pass.

- `formatRouteSummary` (frontend/src/pages/MapPage.jsx:498): dead, ESLint unused
- unused `Search` import (frontend/src/pages/MapPage.jsx:9)
- `routeLoading` (frontend/src/pages/MapPage.jsx:1199): unused
- `sendFeedback` (frontend/src/pages/MapPage.jsx:1791): unused
- pre-existing refs-during-render warnings to resolve (frontend/src/pages/MapPage.jsx, e.g. lines 845 and 960)
