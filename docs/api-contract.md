# WayBack API Contract

**Version**: 0.1 (draft)
**Last updated**: 2026-05-01
**Status**: Agreed defaults below; open items at the bottom.

This document is the source of truth for HTTP contracts between the WayBack backend (Flask) and frontend (React + Vite). Changes here should be agreed by both sides before being implemented.

It directly answers the open questions in `docs/frontend-spec.pdf` Section 5.

---

## 1. Conventions

| Topic | Decision | Rationale |
|---|---|---|
| JSON keys | `camelCase` | Matches frontend / JS conventions; no adapter layer needed |
| Time format | Unix milliseconds (`number`) | Trivially `new Date(ms)` in JS; identical on wire and in code |
| Distances | Meters (`number`) | Frontend formats for display (`m` / `km`) |
| Coordinates | WGS84 decimal degrees | Separate `lat` and `lng` fields, both `number` |
| User identification | `userId` query param | Lab project, no real auth — see "Open items" |
| CORS | Enabled for `http://localhost:5173` | Vite dev server origin |
| Error shape | HTTP status + `{ "error": "message" }` JSON body | |

---

## 2. Data models

### `SavedItem`

```json
{
  "id": "itm_001",
  "name": "Marienplatz",
  "category": "culture",
  "lat": 48.1374,
  "lng": 11.5755,
  "savedAt": 1729382400000,
  "lastViewedAt": 1730851200000,
  "viewCount": 3,
  "notes": "Glockenspiel plays at 11am and noon.",
  "attachments": [
    { "type": "photo", "url": "https://example.com/photos/marienplatz.jpg" }
  ]
}
```

**Field notes:**
- `category`: one of `outdoor` | `indoor` | `food` | `culture` | `shopping` | `transit`
- `savedAt`, `lastViewedAt`: unix milliseconds
- `viewCount`: integer, increments on every `GET /saved-items/:id`
- `attachments[].type`: `photo` | `ticket` | `document`

### `Explanation`

```json
{
  "method": "CIA",
  "reason": "nearby_and_recently_saved",
  "distanceMeters": 220,
  "monthsSinceSaved": 6,
  "details": {}
}
```

**Field notes:**
- `method`: which recommender produced this — `CBR` | `JITIR` | `CIA`
- `reason`: a short, machine-readable code. Frontend maps it to a human-readable string. **Freeform string** so each method can produce its own reason codes (see Open items).
- `distanceMeters`, `monthsSinceSaved`: optional metadata the frontend can use in its rendered explanation
- `details`: optional method-specific extra info (e.g. CBR may include similarity score)

---

## 3. Endpoints

### `GET /saved-items`

All saved items for a user. Used by the Map screen and the list view.

**Query params:**
| Param | Type | Required | Description |
|---|---|---|---|
| `userId` | string | yes | |

**Response 200:** `SavedItem[]`

See: `mocks/saved-items.json`

---

### `GET /saved-items/:id`

A single saved item with full details. **Side effect:** sets `lastViewedAt` to server time and increments `viewCount`. This interaction signal feeds the CIA model's access-pattern features.

**Query params:**
| Param | Type | Required | Description |
|---|---|---|---|
| `userId` | string | yes | |

**Response 200:** `SavedItem`
**Response 404:** `{ "error": "Item not found" }`

See: `mocks/saved-item-detail.json`

---

### `GET /recommendations`

Context-ranked list of saved items. Core endpoint for the Re-finding feed.

**Query params:**
| Param | Type | Required | Description |
|---|---|---|---|
| `userId` | string | yes | |
| `lat` | number | yes | Current latitude |
| `lng` | number | yes | Current longitude |
| `time` | number | no | Unix ms; defaults to server now |
| `weather` | string | no | `rain` \| `sun` \| `snow` \| `cloud` |
| `method` | string | no | `CBR` \| `JITIR` \| `CIA`. Default: `CIA` |

**Response 200:** Array of:
```json
{
  "item": { /* SavedItem */ },
  "score": 0.847,
  "explanation": { /* Explanation */ }
}
```

Sorted by `score` descending. Limit: top 20.

See: `mocks/recommendations.json`

---

### `POST /feedback`

Records user feedback on a recommendation. Used for evaluation (paper Section 7).

**Request body:**
```json
{
  "userId": "user_demo",
  "itemId": "itm_001",
  "useful": true,
  "method": "CIA",
  "contextSnapshot": {
    "lat": 48.1372,
    "lng": 11.5756,
    "time": 1735689600000
  }
}
```

**Response 204:** No content.
**Response 400:** `{ "error": "..." }` for malformed body.

---

## 4. Open items (need a decision)

- [ ] **Auth.** Currently `userId` query param. Fine for the lab demo, but if we want it to look more production-grade, swap to JWT in `Authorization: Bearer ...` header. Costs ~1 hour of work.
- [ ] **Explanation `reason` codes.** Freeform per method right now. If the frontend wants a fixed enum so it can localise strings, we agree on a closed list per method (e.g. CIA: `nearby`, `recent_save`, `frequent_view`, `matches_weather`).
- [ ] **Pagination on `/saved-items`.** Not needed for demo (<50 items per user). Add if user libraries grow.
- [ ] **Attachment uploads.** Currently URL-only — upload pipeline out of scope for v1.

---

## 5. Versioning

Bump version at the top of this file when a breaking change is merged. Frontend should pin against a contract version in its README.
