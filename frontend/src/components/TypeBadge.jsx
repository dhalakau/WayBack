// Paper §3: surfaces saved-item taxonomy as UI signal.
// The four item types (bookmark, ticket, map_pin, note) are exposed by the
// backend on /saved-items; rendering them as a small inline badge gives users
// a glanceable cue about *what kind* of save each row is — important for
// re-finding because the action they'll want to take depends on the type
// (open a ticket → see its event; open a pin → navigate; open a note → read).
import { Bookmark, Ticket, MapPin, StickyNote } from 'lucide-react'

const TYPE_META = {
  bookmark: { Icon: Bookmark,    label: 'Saved'  },
  ticket:   { Icon: Ticket,      label: 'Ticket' },
  map_pin:  { Icon: MapPin,      label: 'Pinned' },
  note:     { Icon: StickyNote,  label: 'Note'   },
}

export default function TypeBadge({ type }) {
  const meta = TYPE_META[type] || TYPE_META.bookmark
  const Icon = meta.Icon
  const isTicket = type === 'ticket'
  return (
    <span
      className={`wb-type-badge${isTicket ? ' wb-type-badge--ticket' : ''}`}
      aria-label={`Type: ${meta.label}`}
    >
      <Icon size={11} strokeWidth={2.2} />
      <span className="wb-type-badge-label">{meta.label}</span>
    </span>
  )
}
