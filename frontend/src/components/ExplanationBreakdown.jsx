import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Clock, Compass, X, BookOpen } from 'lucide-react'

/**
 * ExplanationBreakdown — surfaces the paper's four evaluation criteria
 * (Sappelli et al., 2017, Section 4) as user-facing UI signals.
 *
 * W4 brief requirement: "generate and display explanations for the
 * recommended items, because it may not be clear to user why an item is
 * shown in certain situation".
 *
 * Two-layer design:
 *   - Default: plain-English signal labels and details (user-facing).
 *   - Modal:   paper-aligned attribution mapping each signal to its paper
 *              section, opened via "How we picked these signals" button.
 *
 * Domain note: paper studies desktop knowledge workers writing reports;
 * we adapt to mobile tourism re-finding. The four-criterion framework is
 * preserved; the specific proxies are tourism-domain-appropriate.
 *
 * @param {object} props
 * @param {object} props.item    - the place being explained
 * @param {object} props.userLoc - { lat, lng }
 */
export default function ExplanationBreakdown({ item, userLoc }) {
  const [showAttribution, setShowAttribution] = useState(false)
  if (!item) return null

  const now = new Date()
  const signals = computeSignals(item, userLoc, now)

  return (
    <>
      <div className="wb-explain">
        <div className="wb-explain-title">Why you might want this now</div>
        <div className="wb-explain-list">
          {signals.map(sig => (
            <SignalRow key={sig.id} signal={sig} />
          ))}
        </div>

        <button
          type="button"
          className="wb-explain-trigger"
          onClick={() => setShowAttribution(true)}
        >
          <BookOpen size={14} aria-hidden="true" />
          <span>How we picked these signals</span>
        </button>
      </div>

      {showAttribution && (
        <AttributionModal onClose={() => setShowAttribution(false)} />
      )}
    </>
  )
}

function SignalRow({ signal }) {
  return (
    <div className="wb-explain-row" data-strength={signal.strength}>
      {signal.icon && <div className="wb-explain-icon">{signal.icon}</div>}
      <div className="wb-explain-body">
        <div className="wb-explain-label">{signal.label}</div>
        <div className="wb-explain-detail">{signal.detail}</div>
      </div>
      <div className="wb-explain-meter" aria-label={`Signal strength: ${signal.strength}`}>
        <span data-on={signal.strength !== 'none'} />
        <span data-on={signal.strength === 'medium' || signal.strength === 'strong'} />
        <span data-on={signal.strength === 'strong'} />
      </div>
    </div>
  )
}

function AttributionModal({ onClose }) {
  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const modal = (
    <div
      className="wb-attr-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Methodology"
    >
      <div
        className="wb-attr-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="wb-attr-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="wb-attr-eyebrow">Sappelli et al., 2017 &middot; §4</div>
        <h3 className="wb-attr-h">Methodology</h3>

        <p className="wb-attr-lede">
          The four signals you saw map directly to the four evaluation
          criteria from the source paper. All four are computed client-side
          from item metadata and your current location.
        </p>

        <ul className="wb-attr-list">
          <li>
            <div className="wb-attr-li-head"><b>Right here</b> &middot; §4.3 Context relevance</div>
            <div className="wb-attr-li-body">Haversine distance from your current location.</div>
          </li>
          <li>
            <div className="wb-attr-li-head"><b>Good time of day</b> &middot; §4.4 Document relevance</div>
            <div className="wb-attr-li-body">Category × hour-of-day plausibility — tourism-domain analog of the paper's content-overlap measure.</div>
          </li>
          <li>
            <div className="wb-attr-li-head"><b>Likely your next stop</b> &middot; §4.5 Action prediction</div>
            <div className="wb-attr-li-body">
              Client-side proxy for the paper's CIA spreading activation, combining proximity, recency,
              and view frequency. Live CIA scores from the backend rank the saved-items list itself;
              this proxy keeps the detail view fast and offline-capable.
            </div>
          </li>
          <li>
            <div className="wb-attr-li-head"><b>Worth revisiting</b> &middot; §4.6 Diversity</div>
            <div className="wb-attr-li-body">
              Under-surfaced items (low view count) — the re-finding payoff the paper targets
              (§1, citing Elsweiler et al. 2007).
            </div>
          </li>
        </ul>

        <p className="wb-attr-domain">
          <b>Domain adaptation note.</b> The paper studies desktop knowledge workers writing reports.
          We preserve the four-criterion framework and adapt the proxies to a mobile tourism
          re-finding setting (location, opening hours, view-history).
        </p>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

/**
 * Compute the four signals as paper-aligned client-side approximations.
 */
function computeSignals(item, userLoc, now) {
  // ---- Signal 1: Context relevance (paper §4.3) ----------------------
  const dist = (item.lat && item.lng && userLoc)
    ? haversineMeters(userLoc.lat, userLoc.lng, item.lat, item.lng)
    : null
  const contextStrength =
    dist == null          ? 'none' :
    dist < 300            ? 'strong' :
    dist < 800            ? 'medium' :
    dist < 2000           ? 'weak'   : 'none'
  const contextDetail =
    dist == null ? 'Location unknown'
                 : `${Math.round(dist)} m away`

  // ---- Signal 2: Document relevance (paper §4.4) ---------------------
  const hour = now.getHours()
  const cat = (item.category || '').toLowerCase()
  const timeFitInfo = timeOfDayFit(cat, hour)

  // ---- Signal 3: Action prediction proxy (paper §4.5) ----------------
  const daysSinceSaved = item.savedAt
    ? (now.getTime() - item.savedAt) / 86400000 : 999
  const views = item.viewCount || 0
  const proxScore = dist != null
    ? Math.max(0, 1 - dist / 2000)        // 1.0 at 0m, 0.0 at 2km
    : 0
  const recencyScore = Math.max(0, 1 - daysSinceSaved / 60)
  const freqScore    = Math.min(1, views / 5)
  const ciaProxy = 0.5 * proxScore + 0.25 * recencyScore + 0.25 * freqScore
  const actionStrength =
    ciaProxy >= 0.6  ? 'strong' :
    ciaProxy >= 0.35 ? 'medium' :
    ciaProxy >= 0.15 ? 'weak'   : 'none'

  // ---- Signal 4: Diversity (paper §4.6) ------------------------------
  const diversityStrength =
    views === 0 && daysSinceSaved > 7  ? 'strong' :
    views <= 1                          ? 'medium' :
    views <= 3                          ? 'weak'   : 'none'
  const diversityDetail =
    views === 0 ? "You saved this but haven't visited yet"
    : views === 1 ? 'Visited once — worth a second look'
    : `Viewed ${views} times — re-visit candidate`

  return [
    {
      id: 'context',
      label: 'Right here',
      detail: contextDetail,
      icon: <MapPin size={16} aria-hidden="true" />,
      strength: contextStrength,
    },
    {
      id: 'time',
      label: 'Good time of day',
      detail: timeFitInfo.detail,
      icon: <Clock size={16} aria-hidden="true" />,
      strength: timeFitInfo.strength,
    },
    {
      id: 'action',
      label: 'Likely your next stop',
      detail: 'Based on proximity, recency, and how often you view this',
      icon: null,
      strength: actionStrength,
    },
    {
      id: 'diversity',
      label: 'Worth revisiting',
      detail: diversityDetail,
      icon: <Compass size={16} aria-hidden="true" />,
      strength: diversityStrength,
    },
  ]
}

function timeOfDayFit(category, hour) {
  const patterns = {
    restaurant: { windows: [[12, 14], [18, 22]], label: 'lunch or dinner hours' },
    cafe:       { windows: [[7, 11]],            label: 'morning café hours' },
    bar:        { windows: [[18, 24], [0, 2]],   label: 'evening or late hours' },
    museum:     { windows: [[10, 17]],           label: 'museum opening hours' },
    park:       { windows: [[9, 19]],            label: 'daylight hours' },
    attraction: { windows: [[9, 18]],            label: 'sightseeing hours' },
  }
  const p = patterns[category]
  if (!p) return { strength: 'none', detail: 'No typical hours for this category' }
  const inWindow = p.windows.some(([a, b]) => hour >= a && hour < b)
  if (inWindow) return { strength: 'strong', detail: `Inside ${p.label}` }
  const near = p.windows.some(([a, b]) => Math.abs(hour - a) <= 2 || Math.abs(hour - b) <= 2)
  if (near) return { strength: 'medium', detail: `Close to ${p.label}` }
  return { strength: 'weak', detail: `Outside ${p.label}` }
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat/2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
          * Math.sin(dLng/2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
