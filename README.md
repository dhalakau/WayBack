\# WayBack



Context-aware re-finding system for personal tourism information.

TUM Lab Course SS 2026 · Project \[W4]



\## Concept



WayBack surfaces tourism items (saved places, bookmarks, tickets, notes) the user has already seen, at the moment they become relevant again — based on current location and time. Unlike conventional recommenders that suggest new items, this is a personal information re-finding system.



Based on Sappelli, Verberne \& Kraaij (2017): Evaluation of context-aware recommendation systems for information re-finding.



\## Repository structure



\- backend/   Flask + SQLAlchemy + SQLite. Three recommendation methods (CBR, JITIR, CIA).

\- frontend/  React + Vite. Mobile-first web app.

\- docs/      Specs, API contract, paper notes.

\- mocks/     Sample JSON payloads for frontend development.



\## Quick start



Backend:

&#x20;   cd backend

&#x20;   python -m venv .venv

&#x20;   .venv\\Scripts\\activate

&#x20;   pip install -r requirements.txt

&#x20;   python seed.py

&#x20;   python app.py



Frontend:

&#x20;   cd frontend

&#x20;   npm install

&#x20;   npm run dev



\## Recommendation methods



\- CBR    Content-based with TF-IDF + cosine similarity. Strength: context relevance.

\- JITIR  Just-in-time IR — context as search query. Strength: document relevance.

\- CIA    Contextual Interactive Activation (3-layer spreading activation). Strength: action prediction + diversity.



\## Reference



Sappelli, M., Verberne, S., \& Kraaij, W. (2017). Evaluation of context-aware recommendation systems for information re-finding. Journal of the Association for Information Science and Technology, 68(4), 895–910.

