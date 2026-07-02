import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Compass, Footprints, MapPin,
  Coffee, UtensilsCrossed, Trees, Wine, Landmark, Camera,
  Bed, ShoppingBag, Train, Wrench,
} from 'lucide-react'
import TypeBadge from './TypeBadge'

// Itinerary composition extends the paper's four-criterion framework (Sappelli et al. 2017):
// - §4.3 context relevance: distance from previous stop drives within-slot selection
// - §4.4 document relevance: category × time-of-day fit gates each slot
// - §4.6 diversity: each stop is a distinct category, no repeats
// Single-day tourism itinerary is not addressed directly in the paper, but the same
// criteria the paper uses to evaluate single-item recommendations compose naturally
// into multi-item plans.
//
// This is the itinerary content only, with no layout shell. The standalone trip
// route (TripPage) wraps it in the full-page chrome; the desktop map hosts it
// inside the floating panel where the place list normally sits. When `items` is
// omitted the component fetches the saved pool itself, reproducing the route's
// original load-then-render behavior exactly.

const API = (import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:8000'
const USER_ID = 'user_demo'

// Fixed Munich Hauptbahnhof: matches MapPage's demo location so the first
// stop is selected relative to a known anchor regardless of geolocation.
const DEFAULT_LOC = { lat: 48.1402, lng: 11.5586 }

// 5 km/h average pedestrian pace → m/min for walking-time estimates.
const WALK_M_PER_MIN = (5_000) / 60

// Slot definitions: primary categories per time of day (paper §4.4
// document-relevance proxy via category × hour). `fallback` is used only if
// no saved item matches the primary set for that slot.
const SLOTS = [
  {
    id: 'morning',      time: '9:00',  label: 'Morning',
    categories: ['cafe'],
    fallback:   ['museum'],
    reason: 'Closest café. A soft start to the day.',
  },
  {
    id: 'late_morning', time: '11:30', label: 'Late morning',
    categories: ['museum', 'attraction'],
    reason: 'Indoor or landmark stop while the day warms up',
  },
  {
    id: 'lunch',        time: '13:00', label: 'Lunch',
    categories: ['restaurant'],
    reason: 'Lunch fit. The closest restaurant on the route.',
  },
  {
    id: 'afternoon',    time: '15:30', label: 'Afternoon',
    categories: ['museum', 'attraction', 'park'],
    reason: 'Afternoon culture or park time',
  },
  {
    id: 'dinner',       time: '19:30', label: 'Dinner',
    categories: ['restaurant', 'bar'],
    reason: 'Dinner. Sit down or wind down nearby.',
  },
]

// Category meta: small subset of MapPage's CATEGORIES, kept local so this
// component is self-contained. Used for icons + labels on each stop card.
const CATEGORY_META = {
  attraction:    { label: 'Attraction',  Icon: Camera },
  restaurant:    { label: 'Restaurant',  Icon: UtensilsCrossed },
  cafe:          { label: 'Café',        Icon: Coffee },
  museum:        { label: 'Museum',      Icon: Landmark },
  park:          { label: 'Park',        Icon: Trees },
  bar:           { label: 'Bar',         Icon: Wine },
  accommodation: { label: 'Hotel',       Icon: Bed },
  shopping:      { label: 'Shopping',    Icon: ShoppingBag },
  services:      { label: 'Services',    Icon: Wrench },
  transport:     { label: 'Transport',   Icon: Train },
}

function haversineMeters(a, b) {
  const R = 6_371_000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

function walkMinutes(meters) {
  return Math.max(1, Math.round(meters / WALK_M_PER_MIN))
}

function formatDistance(meters) {
  if (meters == null) return ''
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`
}

// Build the itinerary stop-by-stop. For each slot we:
//   1. Filter saved items that are (a) not already chosen and (b) match the
//      slot's primary categories. If empty, retry against the fallback list.
//   2. Sort by distance to the previous stop (paper §4.3 context relevance):
//      for slot 1 the "previous stop" is the user's location.
//   3. Pick the closest and add to the chosen set to enforce diversity
//      (paper §4.6).
// Slots that find nothing are skipped, so a sparse saved list yields a
// shorter itinerary rather than a broken one.
function buildItinerary(items, userLoc) {
  const chosen = new Set()
  const stops = []
  let prev = userLoc
  for (const slot of SLOTS) {
    let pool = items.filter(it => !chosen.has(it.id) && slot.categories.includes(it.category))
    if (pool.length === 0 && slot.fallback) {
      pool = items.filter(it => !chosen.has(it.id) && slot.fallback.includes(it.category))
    }
    if (pool.length === 0) continue
    pool.sort((a, b) =>
      haversineMeters(prev, { lat: a.lat, lng: a.lng }) -
      haversineMeters(prev, { lat: b.lat, lng: b.lng })
    )
    const pick = pool[0]
    const distM = haversineMeters(prev, { lat: pick.lat, lng: pick.lng })
    chosen.add(pick.id)
    stops.push({ slot, item: pick, distanceM: distM, fromPrevious: stops.length > 0 })
    prev = { lat: pick.lat, lng: pick.lng }
  }
  return stops
}

export default function TripItinerary({ items, userLoc = DEFAULT_LOC }) {
  const selfManaged = items === undefined
  const [fetched, setFetched] = useState(null)  // null = loading
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!selfManaged) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`${API}/saved-items?userId=${USER_ID}`)
        const data = await res.json()
        if (!cancelled) setFetched(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) { setFetched([]); setError(true) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [selfManaged])

  const savedItems = selfManaged ? fetched : items

  if (savedItems === null) return <LoadingState />
  if (savedItems.length < 3) return <EmptyState error={error} count={savedItems.length} />
  return <Itinerary items={savedItems} userLoc={userLoc} />
}

function LoadingState() {
  return (
    <div className="wb-trip-empty">
      <Compass size={28} aria-hidden="true" />
      <p>Planning your day…</p>
    </div>
  )
}

function EmptyState({ error, count }) {
  return (
    <div className="wb-trip-empty">
      <Compass size={28} aria-hidden="true" />
      <p className="wb-trip-empty-title">
        {error
          ? 'Could not reach the backend.'
          : count === 0
            ? 'Save a few more places to build a day plan.'
            : 'Almost there. A few more places will unlock the plan.'}
      </p>
      <p className="wb-trip-empty-sub">
        A good day plan needs at least one café, one restaurant, and one
        attraction to work well.
      </p>
      <Link to="/" className="wb-trip-empty-cta">
        <MapPin size={14} aria-hidden="true" /> Back to map
      </Link>
    </div>
  )
}

function Itinerary({ items, userLoc }) {
  const stops = buildItinerary(items, userLoc)

  if (stops.length === 0) {
    return <EmptyState error={false} count={items.length} />
  }

  // Total walking distance / time: sum of segments BETWEEN consecutive stops
  // (skip the first stop's leg from the user's location, since the user picks
  // the start time: only inter-stop walking is part of the "day plan" budget).
  const interStopMeters = stops.slice(1).reduce((sum, s) => sum + s.distanceM, 0)
  const totalMinutes = walkMinutes(interStopMeters)
  const categories = new Set(stops.map(s => s.item.category)).size

  // Scope the detail panel to this itinerary: tapping a stop opens it with the
  // plan's stops in itinerary order, so the detail's prev/next arrows and the
  // pagination stay within the day plan rather than the full saved pool. The
  // label drives the "From: ..." breadcrumb. Carried on the Link router state
  // and read back in MapPage's deep-link effect; both layouts use this Link.
  const planContext = { ids: stops.map(s => s.item.id), label: 'Your Munich day' }

  return (
    <>
      <ol className="wb-trip-list">
        {stops.map((stop, idx) => (
          <StopCard
            key={stop.item.id}
            stop={stop}
            isFirst={idx === 0}
            isLast={idx === stops.length - 1}
            planContext={planContext}
          />
        ))}
      </ol>

      <footer className="wb-trip-footer">
        <span>
          Day total: <b>{formatDistance(interStopMeters)}</b>
          {' · '}
          <b>{totalMinutes} min</b> walking
          {' · '}
          <b>{categories}</b> {categories === 1 ? 'category' : 'categories'}
        </span>
      </footer>
    </>
  )
}

function StopCard({ stop, isFirst, isLast, planContext }) {
  const { slot, item, distanceM, fromPrevious } = stop
  const meta = CATEGORY_META[item.category] || { label: item.category, Icon: MapPin }
  const CatIcon = meta.Icon
  const minutes = walkMinutes(distanceM)

  // Tapping a card opens the item's detail on the map. The item id rides the
  // URL hash; the itinerary's stops ride the router state (planContext) so the
  // detail panel scopes its arrows and pagination to the plan, not the pool.
  return (
    <li className={`wb-trip-stop${isFirst ? ' is-first' : ''}${isLast ? ' is-last' : ''}`}>
      <div className="wb-trip-rail" aria-hidden="true">
        <span className="wb-trip-dot" />
        {!isLast && <span className="wb-trip-line" />}
      </div>

      <Link to={`/#item-${item.id}`} state={{ planContext }} className="wb-trip-card">
        <div className="wb-trip-card-time">{slot.time}</div>

        <div className="wb-trip-card-head">
          <h2 className="wb-trip-card-name">{item.name}</h2>
          <TypeBadge type={item.itemType || 'bookmark'} />
        </div>

        <div className="wb-trip-card-cat">
          <CatIcon size={13} aria-hidden="true" /> {meta.label}
          <span className="wb-trip-card-sep">·</span>
          <span className="wb-trip-card-slot">{slot.label}</span>
        </div>

        <div className="wb-trip-card-walk">
          <Footprints size={13} aria-hidden="true" />
          {fromPrevious
            ? <>{minutes} min walk · {formatDistance(distanceM)} from previous</>
            : <>{minutes} min walk · {formatDistance(distanceM)} from your start</>
          }
        </div>

        <div className="wb-trip-card-reason">
          <MapPin size={12} aria-hidden="true" /> {slot.reason}
        </div>
      </Link>
    </li>
  )
}
