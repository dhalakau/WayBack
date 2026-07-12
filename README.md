# WayBack

Context-aware re-finding system for personal tourism information.

**Team W4** · TUM School of CIT · Lab Course: Projects in Recommender Systems · SS 2026 · Topic [W4]

Haichen Duan ([@Haichennn](https://github.com/Haichennn)) · Swayamsidh Mohanty ([@dhalakau](https://github.com/dhalakau))

Live frontend: https://wayback-one.vercel.app (backend on Render; see Deployment below)

## Concept

WayBack surfaces tourism items (saved places, bookmarks, tickets, notes) the user has already seen, at the moment they become relevant again — based on current location and time. Unlike conventional recommenders that suggest new items, this is a personal information **re-finding** system: it never recommends anything outside the saved pool.

Based on Sappelli, Verberne & Kraaij (2017), *Evaluation of context-aware recommendation systems for information re-finding*.

## Repository structure

- `backend/` — Flask + SQLAlchemy API. Three recommendation methods, evaluation pipeline, pytest suite. Postgres (Neon) in production, SQLite fallback for local development.
- `frontend/` — React + Vite + Leaflet mobile-first web app (map, method tabs, compare view, day plan, proactive banner).
- `docs/` — API contract, design system (`DESIGN.md`), diary-study log (`DOGFOOD_LOG.md`), and the final report (`docs/report/main.tex`, ACM single-column).
- `mocks/` — sample JSON payloads used during frontend development.
- `render.yaml` — Render deployment blueprint for the backend.

## Recommendation methods

| Method | In-app tab | Approach | Strength |
|--------|------------|----------|----------|
| CBR | Based on history | Category pre-filter + TF-IDF cosine similarity | Context relevance |
| JITIR | For this moment | Context as search query, BM25 over the whole pool | Moment-fit ranking |
| CIA | Near you | Three-layer spreading activation (topic, category, location grid, time-of-day nodes) | Action prediction + diversity |

A seeded random baseline exists in the offline evaluation harness only (not exposed via the API).

## Quick start

Backend (Python 3.12+):

    cd backend
    python -m venv .venv
    .venv\Scripts\activate          # Windows; source .venv/bin/activate on Unix
    pip install -r requirements.txt
    python seed.py                  # seeds 30 Munich places, only if the DB is empty
    python app.py                   # serves on http://localhost:8000

Frontend (Node 20+):

    cd frontend
    npm install
    npm run dev                     # http://localhost:5173

Environment variables (backend): `DATABASE_URL` (Postgres connection string; falls back to local SQLite when unset) and `CORS_ORIGINS` (comma-separated allowed origins).

## Tests

Backend — 55 pytest tests (metrics pinned against hand-computed cases, per-method ranking contracts, endpoint behaviour incl. the view debounce and notes editing, simulator determinism). The suite runs against a seeded database:

    cd backend
    pip install -r requirements-dev.txt
    python seed.py
    pytest

Frontend — unit tests, lint, and the design-system check (these also run in GitHub Actions on every push and pull request; the backend suite runs locally):

    cd frontend
    npm run test
    npm run lint
    npm run design-check

## Reproducing the offline evaluation

The report's offline results (4 methods × 6 metrics, 10 seeds × 20 sessions × 8 events, k=10) regenerate with:

    cd backend
    python seed.py                          # fresh 30-place catalogue
    python run_experiment.py --seeds 10     # writes backend/results/*.csv|json
    python plot_results.py                  # writes the report figures

The exact result files behind the report's tables and figures are checked in under `docs/report/results/`.

## Final report

`docs/report/main.tex` (ACM `acmlarge` single-column template). Compiles on Overleaf, or locally with [Tectonic](https://tectonic-typesetting.github.io/): `tectonic main.tex` from `docs/report/`.

## Deployment

- **Backend**: Render free tier via `render.yaml` (start command seeds the DB idempotently, then runs Gunicorn). Set `DATABASE_URL` to a managed Postgres instance (Neon) in the Render dashboard — without it the disk is ephemeral and saves are lost on deploy.
- **Frontend**: Vercel, pointed at the Render API URL; add the Vercel domain to `CORS_ORIGINS`.

## Reference

Sappelli, M., Verberne, S., & Kraaij, W. (2017). Evaluation of context-aware recommendation systems for information re-finding. *Journal of the Association for Information Science and Technology*, 68(4), 895–910.
