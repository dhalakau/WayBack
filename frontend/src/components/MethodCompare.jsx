import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Sun, Sunset, Moon, X, BookOpen, Loader2 } from 'lucide-react'

const API = (import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:8000'
const USER_ID = 'user_demo'  // matches the seed user used elsewhere in this app

/**
 * MethodCompare — side-by-side view of the paper's three recommendation
 * methods (CBR / JITIR / CIA) under three different context presets.
 *
 * Implements the paper's central comparison (Sappelli et al., 2017, §5–§6):
 * the same user, same saved items, but three different methods producing
 * three different rankings — and a context selector that makes the
 * "context-aware" nature of the methods visible by varying location + hour.
 *
 * Top-3 items per method are shown so the user can compare ranking head-to-head.
 * A "How do these methods differ?" modal explains each method's algorithm
 * with explicit paper section references.
 */
export default function MethodCompare() {
  const [contextId, setContextId] = useState('morning')
  const [showMethodInfo, setShowMethodInfo] = useState(false)
  const [results, setResults] = useState({ cbr: null, jitir: null, cia: null })
  const [loading, setLoading] = useState(false)

  const context = CONTEXT_PRESETS.find(c => c.id === contextId)

  useEffect(() => {
    let cancelled = false
    async function fetchAll() {
      setLoading(true)
      try {
        const [cbr, jitir, cia] = await Promise.all([
          fetchMethod('cbr',   context.lat, context.lng),
          fetchMethod('jitir', context.lat, context.lng),
          fetchMethod('cia',   context.lat, context.lng),
        ])
        if (!cancelled) setResults({ cbr, jitir, cia })
      } catch {
        if (!cancelled) setResults({ cbr: [], jitir: [], cia: [] })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [contextId])

  return (
    <div className="wb-compare">
      <div className="wb-compare-header">
        <div className="wb-compare-title">Compare methods</div>
        <button
          type="button"
          className="wb-compare-info"
          onClick={() => setShowMethodInfo(true)}
        >
          <BookOpen size={13} aria-hidden="true" />
          <span>How do these differ?</span>
        </button>
      </div>

      <div className="wb-compare-context-strip">
        {CONTEXT_PRESETS.map(c => (
          <button
            key={c.id}
            type="button"
            className="wb-compare-context-btn"
            data-active={c.id === contextId}
            onClick={() => setContextId(c.id)}
          >
            <span className="wb-compare-context-icon">{iconFor(c.icon)}</span>
            <span className="wb-compare-context-label">{c.label}</span>
            <span className="wb-compare-context-sub">{c.sublabel}</span>
          </button>
        ))}
      </div>

      <div className="wb-compare-grid">
        {/* Primary label is human-friendly so non-academic users can tell the
            columns apart; the technical acronym + paper §-ref stays as a
            secondary subtitle, and the full algorithmic detail lives in the
            "How do these differ?" modal. */}
        <MethodColumn label="Category match" subtitle="CBR · §5.1"   items={results.cbr}   loading={loading} />
        <MethodColumn label="Text relevance" subtitle="JITIR · §5.2" items={results.jitir} loading={loading} />
        <MethodColumn label="Smart context"  subtitle="CIA · §5.3"   items={results.cia}   loading={loading} />
      </div>

      <div className="wb-compare-note">
        Same saved items, same context — three different rankings. This is
        the comparison at the heart of Sappelli et&nbsp;al. (2017).
      </div>

      {showMethodInfo && <MethodInfoModal onClose={() => setShowMethodInfo(false)} />}
    </div>
  )
}

function MethodColumn({ label, subtitle, items, loading }) {
  return (
    <div className="wb-compare-col">
      <div className="wb-compare-col-head">
        <div className="wb-compare-col-name">{label}</div>
        <div className="wb-compare-col-section">{subtitle}</div>
      </div>
      <div className="wb-compare-col-body">
        {loading && (
          <div className="wb-compare-loading">
            <Loader2 size={16} className="wb-compare-spin" aria-hidden="true" />
          </div>
        )}
        {!loading && items && items.length === 0 && (
          <div className="wb-compare-empty">No results</div>
        )}
        {!loading && items && items.slice(0, 5).map((rec, idx) => (
          <div className="wb-compare-item" key={`${rec.item.id}-${idx}`}>
            <div className="wb-compare-item-rank">{idx + 1}</div>
            <div className="wb-compare-item-body">
              <div className="wb-compare-item-name">{rec.item.name}</div>
              <div className="wb-compare-item-score">score {rec.score.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MethodInfoModal({ onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
      aria-label="Method comparison"
    >
      <div className="wb-attr-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="wb-attr-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="wb-attr-eyebrow">Sappelli et al., 2017 &middot; §5</div>
        <h3 className="wb-attr-h">Three methods, three rankings</h3>

        <p className="wb-attr-lede">
          The paper proposes and compares three context-aware recommendation
          methods. They share the same input — your saved items and current
          context — but rank items by very different algorithms.
        </p>

        <ul className="wb-attr-list">
          <li>
            <div className="wb-attr-li-head"><b>CBR</b> &middot; Content-Based Recommender (§5.1)</div>
            <div className="wb-attr-li-body">
              Builds a text representation of every saved item and ranks by
              similarity to a context vector. Tends to favor items whose name,
              category, and description overlap with the active context.
            </div>
          </li>
          <li>
            <div className="wb-attr-li-head"><b>JITIR</b> &middot; Just-In-Time Information Retrieval (§5.2)</div>
            <div className="wb-attr-li-body">
              Treats the current context as a search query and runs information
              retrieval over the saved items. Favors strong textual matches and
              behaves like a contextual search engine.
            </div>
          </li>
          <li>
            <div className="wb-attr-li-head"><b>CIA</b> &middot; Contextual Item Activation (§5.3)</div>
            <div className="wb-attr-li-body">
              Builds a network of items and context nodes, then spreads
              activation across the network using Grossberg&apos;s equation
              (10 iterations, as in the paper). The paper finds this method
              strongest at action prediction (§6.3).
            </div>
          </li>
        </ul>

        <p className="wb-attr-domain">
          <b>Why this view exists.</b> Switching the context selector above
          changes location and time-of-day, which propagates into each
          method&apos;s ranking. The fact that the three columns rearrange
          differently is exactly what the paper&apos;s evaluation framework
          (§4) is designed to measure.
        </p>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

async function fetchMethod(method, lat, lng) {
  const params = new URLSearchParams({ userId: USER_ID, lat, lng, method })
  const res = await fetch(`${API}/recommendations?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

function iconFor(name) {
  if (name === 'sun')    return <Sun size={18} aria-hidden="true" />
  if (name === 'sunset') return <Sunset size={18} aria-hidden="true" />
  if (name === 'moon')   return <Moon size={18} aria-hidden="true" />
  return null
}

const CONTEXT_PRESETS = [
  {
    id: 'morning',
    label: 'Morning',
    sublabel: '9:00 at Marienplatz',
    icon: 'sun',
    lat: 48.1374,
    lng: 11.5754,
    hour: 9,
  },
  {
    id: 'afternoon',
    label: 'Afternoon',
    sublabel: '14:00 at Englischer Garten',
    icon: 'sunset',
    lat: 48.1642,
    lng: 11.6056,
    hour: 14,
  },
  {
    id: 'evening',
    label: 'Evening',
    sublabel: '20:00 at Hauptbahnhof',
    icon: 'moon',
    lat: 48.1402,
    lng: 11.5586,
    hour: 20,
  },
]
