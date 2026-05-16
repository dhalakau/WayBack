# Frontend Week 5 Contribution Log

This document clarifies the contents of commits aa82584, 4dc1c6e, 072c129
which together ship the complete re-finding tourism UX aligned with paper §3.

## Commits

### aa82584 — "fix: handle tags as array or string..."
Despite the commit message describing only the tags-shape fix, this commit
actually contains the implementation of:
- Feature 3: Category pill filter for saved list + map markers (paper §3)
- Feature 4: Text search over saved items (name, notes, tags) (paper §3)
- Feature 5: Type filter chips in saved view (paper §3)
- Feature 6: Tags display in detail panel (paper §3)
- Bug fix: defensive tags handling (array | string | null)

This happened because all five changes lived in the same uncommitted working
tree at commit time, and `git add MapPage.jsx` staged them together.
Total: 218 insertions, 18 deletions.

### 4dc1c6e — "feat: ticket event countdown in detail panel (paper §3)"
- Feature 2: TicketCountdown component
- midnight-normalized day delta
- "Event in N days / tomorrow / today / N days ago / Past event"
- Paper §3 time-sensitivity surface for ticket-type saved items

### 072c129 — "feat: type badges in saved list (paper §3)"
- Feature 1: TypeBadge component
- bookmark / ticket / map_pin / note → icon + label pill
- Ticket variant uses mint accent for time-sensitivity
- Paper §3 saved-item taxonomy as UI signal

## Paper alignment

All four commits implement aspects of paper §3 (saved-item structure,
taxonomy, re-finding affordances). The composite Feature 3+4+5 forms
the re-finding filter system; Features 1+2+6 surface item metadata.
