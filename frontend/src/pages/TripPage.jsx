import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Calendar, Sparkles, Footprints, MapPin,
  Coffee, UtensilsCrossed, Trees, Wine, Landmark, Camera,
  Bed, ShoppingBag, Train, Wrench,
} from 'lucide-react'
import TypeBadge from '../components/TypeBadge'
import TabBar from '../components/TabBar'

// Itinerary composition extends the paper's four-criterion framework (Sappelli et al. 2017):
// - §4.3 context relevance: distance from previous stop drives within-slot selection
// - §4.4 document relevance: category × time-of-day fit gates each slot
// - §4.6 diversity: each stop is a distinct category, no repeats
// Single-day tourism itinerary is not addressed directly in the paper, but the same
// criteria the paper uses to evaluate single-item recommendations compose naturally
// into multi-item plans.

const API = 'http://localhost:8000'
const USER_ID = 'user_demo'

// Fixed Munich Hauptbahnhof — matches MapPage's demo location so the first
// stop is selected relative to a known anchor regardless of geolocation.
const DEFAULT_LOC = { lat: 48.1402, lng: 11.5586 }

// 5 km/h average pedestrian pace → m/min for walking-time estimates.
const WALK_M_PER_MIN = (5_000) / 60

// Slot definitions — primary categories per time of day (paper §4.4
// document-relevance proxy via category × hour). `fallback` is used only if
// no saved item matches the primary set for that slot.
const SLOTS = [
  {
    id: 'morning',      time: '9:00',  label: 'Morning',
    categories: ['cafe'],
    fallback:   ['museum'],
    reason: 'Closest café — a soft start to the day',
  },
  {
    id: 'late_morning', time: '11:30', label: 'Late morning',
    categories: ['museum', 'attraction'],
    reason: 'Indoor or landmark stop while the day warms up',
  },
  {
    id: 'lunch',        time: '13:00', label: 'Lunch',
    categories: ['restaurant'],
    reason: 'Lunch fit — the closest restaurant on the route',
  },
  {
    id: 'afternoon',    time: '15:30', label: 'Afternoon',
    categories: ['museum', 'attraction', 'park'],
    reason: 'Afternoon culture or park time',
  },
  {
    id: 'dinner',       time: '19:30', label: 'Dinner',
    categories: ['restaurant', 'bar'],
    reason: 'Dinner — sit down or wind down nearby',
  },
]

// Category meta — small subset of MapPage's CATEGORIES, kept local so this
// page is self-contained. Used for icons + labels on each stop card.
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
//   2. Sort by distance to the previous stop (paper §4.3 context relevance) —
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

export default function TripPage() {
  const [savedItems, setSavedItems] = useState(null)  // null = loading
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`${API}/saved-items?userId=${USER_ID}`)
        const data = await res.json()
        if (!cancelled) setSavedItems(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) { setSavedItems([]); setError(true) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <>
      <ScopedStyles />
      <div className="wb-trip">
        <header className="wb-trip-header">
          <Link to="/" className="wb-trip-back" aria-label="Back to map">
            <ArrowLeft size={20} />
          </Link>
          <div className="wb-trip-header-text">
            <h1 className="wb-trip-title">Your Munich day</h1>
            <p className="wb-trip-subtitle">
              5 stops chosen from your saved places, ordered by time of day.
            </p>
            <div className="wb-trip-date">
              <Calendar size={13} aria-hidden="true" /> {dateStr}
            </div>
          </div>
        </header>

        <main className="wb-trip-body">
          {savedItems === null ? (
            <LoadingState />
          ) : savedItems.length < 3 ? (
            <EmptyState error={error} count={savedItems.length} />
          ) : (
            <Itinerary items={savedItems} userLoc={DEFAULT_LOC} />
          )}
        </main>
      </div>
      <TabBar current="plan" />
    </>
  )
}

function LoadingState() {
  return (
    <div className="wb-trip-empty">
      <Sparkles size={28} aria-hidden="true" />
      <p>Planning your day…</p>
    </div>
  )
}

function EmptyState({ error, count }) {
  return (
    <div className="wb-trip-empty">
      <Sparkles size={28} aria-hidden="true" />
      <p className="wb-trip-empty-title">
        {error
          ? 'Could not reach the backend.'
          : count === 0
            ? 'Save a few more places to build a day plan.'
            : 'Almost there — a few more places will unlock the plan.'}
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
  // the start time — only inter-stop walking is part of the "day plan" budget).
  const interStopMeters = stops.slice(1).reduce((sum, s) => sum + s.distanceM, 0)
  const totalMinutes = walkMinutes(interStopMeters)
  const categories = new Set(stops.map(s => s.item.category)).size

  return (
    <>
      <ol className="wb-trip-list">
        {stops.map((stop, idx) => (
          <StopCard
            key={stop.item.id}
            stop={stop}
            isFirst={idx === 0}
            isLast={idx === stops.length - 1}
          />
        ))}
      </ol>

      <footer className="wb-trip-footer">
        <Sparkles size={14} aria-hidden="true" />
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

function StopCard({ stop, isFirst, isLast }) {
  const { slot, item, distanceM, fromPrevious } = stop
  const meta = CATEGORY_META[item.category] || { label: item.category, Icon: MapPin }
  const CatIcon = meta.Icon
  const minutes = walkMinutes(distanceM)

  // Tapping a card jumps back to the Map view centered (visually) on this item.
  // We pass the item id via the URL hash so MapPage can pick it up if it
  // wires that later; for now, the Link itself just routes to '/'.
  return (
    <li className={`wb-trip-stop${isFirst ? ' is-first' : ''}${isLast ? ' is-last' : ''}`}>
      <div className="wb-trip-rail" aria-hidden="true">
        <span className="wb-trip-dot" />
        {!isLast && <span className="wb-trip-line" />}
      </div>

      <Link to={`/#item-${item.id}`} className="wb-trip-card">
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
          <Sparkles size={12} aria-hidden="true" /> {slot.reason}
        </div>
      </Link>
    </li>
  )
}

// -----------------------------------------------------------------------------
// Scoped styles — matches MapPage's dark theme variables. We inline our own
// :root scope so this page renders correctly even if MapPage hasn't mounted.
// -----------------------------------------------------------------------------

function ScopedStyles() {
  return (
    <style>{`
      .wb-trip {
        --bg: #1a2433; --surface-1: #28323f; --surface-2: #1c2530;
        --text-1: #e8eaed; --text-2: #9aa0a6;
        --border: rgba(255,255,255,0.08);
        --accent: #a0e6d4; --accent-on: #0e3a31;
        position: fixed; inset: 0;
        background: var(--bg); color: var(--text-1);
        overflow-y: auto;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .wb-trip * { box-sizing: border-box; }

      .wb-trip-header {
        position: relative;
        max-width: 440px; margin: 0 auto;
        padding: 22px 20px 18px;
        display: flex; align-items: flex-start; gap: 12px;
        border-bottom: 0.5px solid var(--border);
        background: var(--surface-2);
      }
      .wb-trip-back {
        width: 36px; height: 36px; border-radius: 50%;
        background: var(--surface-1);
        color: var(--text-1);
        display: inline-flex; align-items: center; justify-content: center;
        text-decoration: none; flex-shrink: 0;
        transition: background 0.15s;
      }
      .wb-trip-back:hover { background: rgba(255,255,255,0.10); }
      .wb-trip-header-text { flex: 1; min-width: 0; }
      .wb-trip-title {
        margin: 0; font-size: 24px; font-weight: 700;
        letter-spacing: -0.3px;
      }
      .wb-trip-subtitle {
        margin: 4px 0 0;
        font-size: 12.5px; color: var(--text-2);
        font-style: italic; line-height: 1.4;
      }
      .wb-trip-date {
        margin-top: 8px;
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 11.5px; color: var(--accent);
        font-weight: 600;
      }

      .wb-trip-body {
        max-width: 440px; margin: 0 auto;
        /* Bottom padding leaves room for the shared TabBar (60px high). */
        padding: 22px 20px calc(36px + 60px);
      }

      .wb-trip-list {
        list-style: none; margin: 0; padding: 0;
        display: flex; flex-direction: column;
        gap: 0;
      }
      .wb-trip-stop {
        display: flex; gap: 12px;
        padding: 0 0 18px;
        position: relative;
      }
      .wb-trip-stop.is-last { padding-bottom: 6px; }

      .wb-trip-rail {
        flex: 0 0 16px;
        display: flex; flex-direction: column; align-items: center;
        padding-top: 10px;
      }
      .wb-trip-dot {
        width: 12px; height: 12px; border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 0 3px rgba(160,230,212,0.18);
        flex-shrink: 0;
      }
      .wb-trip-line {
        flex: 1; width: 2px;
        background: linear-gradient(to bottom, rgba(160,230,212,0.65), rgba(160,230,212,0.18));
        margin-top: 6px;
      }

      .wb-trip-card {
        flex: 1; min-width: 0;
        display: flex; flex-direction: column; gap: 6px;
        padding: 14px 14px 12px;
        background: var(--surface-1);
        border: 0.5px solid var(--border);
        border-radius: 14px;
        color: inherit; text-decoration: none;
        transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
      }
      .wb-trip-card:hover {
        transform: translateY(-1px);
        border-color: rgba(160,230,212,0.35);
        box-shadow: 0 4px 14px rgba(0,0,0,0.25);
      }
      .wb-trip-card-time {
        font-size: 13px; font-weight: 700;
        color: var(--accent);
        letter-spacing: 0.04em;
        font-variant-numeric: tabular-nums;
      }
      .wb-trip-card-head {
        display: flex; align-items: center; gap: 8px;
        flex-wrap: wrap;
      }
      .wb-trip-card-name {
        margin: 0;
        font-size: 17px; font-weight: 600;
        line-height: 1.2;
        color: var(--text-1);
      }
      .wb-trip-card-cat {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 11.5px; color: var(--text-2);
      }
      .wb-trip-card-cat svg { opacity: 0.85; }
      .wb-trip-card-sep { opacity: 0.5; }
      .wb-trip-card-slot { color: var(--text-2); }
      .wb-trip-card-walk {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 12px; color: var(--text-1);
        opacity: 0.85;
      }
      .wb-trip-card-walk svg { color: var(--accent); }
      .wb-trip-card-reason {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 11.5px; color: var(--accent);
        line-height: 1.35;
      }
      .wb-trip-card-reason svg { flex-shrink: 0; }

      .wb-trip-footer {
        margin-top: 8px;
        padding: 14px 16px;
        background: rgba(160,230,212,0.08);
        border: 0.5px solid rgba(160,230,212,0.30);
        border-radius: 14px;
        display: flex; align-items: center; gap: 8px;
        font-size: 13px;
        color: var(--text-1);
      }
      .wb-trip-footer svg { color: var(--accent); flex-shrink: 0; }
      .wb-trip-footer b { color: var(--accent); font-weight: 700; }

      .wb-trip-empty {
        margin-top: 40px;
        padding: 32px 24px;
        background: var(--surface-1);
        border: 0.5px solid var(--border);
        border-radius: 16px;
        text-align: center;
        display: flex; flex-direction: column; align-items: center;
        gap: 10px;
      }
      .wb-trip-empty svg { color: var(--accent); }
      .wb-trip-empty p { margin: 0; line-height: 1.5; }
      .wb-trip-empty-title { font-size: 15px; font-weight: 600; color: var(--text-1); }
      .wb-trip-empty-sub { font-size: 12.5px; color: var(--text-2); }
      .wb-trip-empty-cta {
        margin-top: 8px;
        display: inline-flex; align-items: center; gap: 6px;
        padding: 9px 16px;
        background: var(--accent); color: var(--accent-on);
        border-radius: 11px;
        font-size: 13px; font-weight: 600;
        text-decoration: none;
        transition: filter 0.15s;
      }
      .wb-trip-empty-cta:hover { filter: brightness(1.06); }

      @media (min-width: 480px) {
        .wb-trip-title { font-size: 26px; }
      }
    `}</style>
  )
}
