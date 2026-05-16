// Paper §3: tickets are time-sensitive saved items; surfacing event date
// makes re-finding actionable. A bookmark to a museum is open-ended ("go
// some time"), but a ticket is anchored to a specific moment — the most
// useful single piece of information when you reopen it is "how soon?".
import { Calendar } from 'lucide-react'

function formatCountdown(target, now) {
  const msPerDay = 86_400_000
  // Normalize both dates to midnight so partial-day differences don't flip
  // "today" into "tomorrow" depending on the hour you open the panel.
  const t0 = new Date(now.getFullYear(),    now.getMonth(),    now.getDate())
  const t1 = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const days = Math.round((t1 - t0) / msPerDay)

  if (days > 1)             return { text: `Event in ${days} days`,        tone: 'future' }
  if (days === 1)           return { text: 'Event tomorrow',               tone: 'future-bold' }
  if (days === 0)           return { text: 'Event today',                  tone: 'future-bold' }
  if (days >= -7)           return { text: `Event was ${-days} day${days === -1 ? '' : 's'} ago`, tone: 'past' }
  return                          { text: 'Past event',                    tone: 'past' }
}

export default function TicketCountdown({ eventDatetime }) {
  if (!eventDatetime) return null
  const target = new Date(eventDatetime)
  if (isNaN(target.getTime())) return null

  const { text, tone } = formatCountdown(target, new Date())
  const dateStr = target.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  return (
    <div className={`wb-ticket-countdown wb-ticket-countdown--${tone}`}>
      <Calendar size={15} strokeWidth={2.2} />
      <div className="wb-ticket-countdown-text">
        <div className="wb-ticket-countdown-main">{text}</div>
        <div className="wb-ticket-countdown-sub">{dateStr}</div>
      </div>
    </div>
  )
}
