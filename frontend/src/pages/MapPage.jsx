import { useState, useEffect, useRef, useCallback } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Search, X, Plus, Compass, Bookmark, Sun, Moon, Trash2, MapPin,
  Coffee, UtensilsCrossed, Trees, Wine, Bed, ShoppingBag, Wrench,
  Train, Landmark, Camera, Navigation, Locate, MoreHorizontal,
  Sparkles, Cloud, Map as MapIcon, CirclePlus,
} from 'lucide-react'
import { getExplanationText } from '../utils/explanationText'

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const API = 'http://localhost:8000'
const USER_ID = 'user_demo'
const DEFAULT_CENTER = [48.137, 11.575]   // central Munich
const DEFAULT_ZOOM = 15

// Category metadata — matches the 10 categories in backend/seed.py
const CATEGORIES = {
  attraction:    { label: 'Attractions',  Icon: Camera,          color: '#78d9c2' },
  restaurant:    { label: 'Restaurants',  Icon: UtensilsCrossed, color: '#f28b82' },
  cafe:          { label: 'Cafés',        Icon: Coffee,          color: '#d4a276' },
  museum:        { label: 'Museums',      Icon: Landmark,        color: '#a78bfa' },
  park:          { label: 'Parks',        Icon: Trees,           color: '#81c995' },
  bar:           { label: 'Bars',         Icon: Wine,            color: '#ec4899' },
  accommodation: { label: 'Hotels',       Icon: Bed,             color: '#f4c0d1' },
  shopping:      { label: 'Shopping',     Icon: ShoppingBag,     color: '#fbbc04' },
  services:      { label: 'Services',     Icon: Wrench,          color: '#9aa0a6' },
  transport:     { label: 'Transport',    Icon: Train,           color: '#4285f4' },
}
const PRIMARY_PILLS = ['attraction', 'restaurant', 'cafe', 'museum', 'park']
const METHOD_LABEL = { cbr: 'Near me', jitir: 'From history', cia: 'For this moment' }
const SORT_LABEL = { recent: 'Recent', views: 'Most viewed', abc: 'A–Z' }

const TILES = {
  dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
}
const TILE_ATTRIB = '&copy; OpenStreetMap &copy; CARTO'

// -----------------------------------------------------------------------------
// Leaflet marker helpers
// -----------------------------------------------------------------------------

// Google-Maps-style "map type" icon: two stacked rhombi.
function LayersIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      <path d="M12 3 L21.5 9 L12 15 L2.5 9 Z" />
      <path d="M2.5 14 L12 20 L21.5 14" />
    </svg>
  )
}

// Pre-compute one Leaflet DivIcon per category so each saved place shows its
// actual lucide glyph (fork-and-knife for restaurants, coffee cup, etc.) on the map.
const MARKER_ICONS = Object.fromEntries(
  Object.entries(CATEGORIES).map(([key, cat]) => {
    const Icon = cat.Icon
    const iconSvg = renderToStaticMarkup(
      <Icon size={14} color="#1a2433" strokeWidth={2.4} />
    )
    return [key, L.divIcon({
      className: 'wb-marker-icon',
      html: `<div class="wb-pin" style="background:${cat.color}">${iconSvg}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    })]
  })
)
const DEFAULT_MARKER_ICON = L.divIcon({
  className: 'wb-marker-icon',
  html: '<div class="wb-pin" style="background:#a0e6d4"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

function savedMarkerIcon(category) {
  return MARKER_ICONS[category] || DEFAULT_MARKER_ICON
}

const youAreHereIcon = L.divIcon({
  className: 'wb-marker-icon',
  html: '<div class="wb-you-dot"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const dropPinIcon = L.divIcon({
  className: 'wb-marker-icon',
  html: `
    <svg width="36" height="48" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0 C5 0 0 5 0 12 C0 22 12 36 12 36 C12 36 24 22 24 12 C24 5 19 0 12 0 Z" fill="#ea4335"/>
      <circle cx="12" cy="12" r="5" fill="#ffffff"/>
    </svg>`,
  iconSize: [36, 48],
  iconAnchor: [18, 46],
})

// -----------------------------------------------------------------------------
// Tiny helpers reused inside the component
// -----------------------------------------------------------------------------

function ClickToMovePin({ active, onPick }) {
  useMapEvents({
    click(e) { if (active) onPick(e.latlng) }
  })
  return null
}

function CenterOnUser({ trigger, center }) {
  const map = useMap()
  useEffect(() => {
    if (trigger > 0 && center) map.flyTo([center.lat, center.lng], 16, { duration: 0.6 })
  }, [trigger]) // eslint-disable-line
  return null
}

// Pans / zooms the map to whatever matches the search query.
// One match → flyTo that pin. Many matches → fit bounds. None / empty → no-op.
function SearchFocus({ query, items }) {
  const map = useMap()
  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (!q) return
    const matches = items.filter(it =>
      it.name.toLowerCase().includes(q) ||
      (it.notes || '').toLowerCase().includes(q)
    )
    if (matches.length === 0) return
    const timer = setTimeout(() => {
      if (matches.length === 1) {
        map.flyTo([matches[0].lat, matches[0].lng], 17, { duration: 0.6 })
      } else {
        const bounds = L.latLngBounds(matches.map(m => [m.lat, m.lng]))
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true, duration: 0.6 })
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query]) // eslint-disable-line
  return null
}

function timeAgo(ms) {
  if (!ms) return 'recently'
  const days = Math.floor((Date.now() - ms) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7)   return `${days} days ago`
  const weeks = Math.floor(days / 7);  if (weeks < 5)  return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  const months = Math.floor(days / 30); return `${months} month${months > 1 ? 's' : ''} ago`
}

// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------

export default function MapPage() {
  // ---- state -----------------------------------------------------------------
  const [mode, setMode] = useState('map')              // map | saved | add
  const [theme, setTheme] = useState('dark')
  const [method, setMethod] = useState('cia')
  const [sort, setSort] = useState('recent')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const [savedItems, setSavedItems] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [userLoc, setUserLoc] = useState({ lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] })
  const [newPin, setNewPin] = useState(null)           // { lat, lng } while in add mode
  const [newPlace, setNewPlace] = useState({ name: '', category: '', notes: '' })

  const [toast, setToast] = useState(null)
  const [centerTrigger, setCenterTrigger] = useState(0)

  // ---- sheet drag ------------------------------------------------------------
  const sheetRef = useRef(null)
  const fabsRef = useRef(null)
  const themeBtnRef = useRef(null)
  const dragRef = useRef({ startY: 0, startOffset: 200, dragging: false, snap: 200 })

  // ---- initial data + geolocation -------------------------------------------
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, // silent failure → keep default Munich center
        { timeout: 4000 }
      )
    }
    fetchSaved()
  }, []) // eslint-disable-line

  // refetch recommendations whenever method or location changes
  useEffect(() => { fetchRecs() }, [method, userLoc.lat, userLoc.lng]) // eslint-disable-line

  async function fetchSaved() {
    try {
      const res = await fetch(`${API}/saved-items?userId=${USER_ID}`)
      const data = await res.json()
      setSavedItems(data)
    } catch { showToast('Backend not reachable on :8000') }
  }
  async function fetchRecs() {
    try {
      const params = new URLSearchParams({
        userId: USER_ID, lat: userLoc.lat, lng: userLoc.lng, method,
      })
      const res = await fetch(`${API}/recommendations?${params}`)
      const data = await res.json()
      if (Array.isArray(data)) setRecommendations(data)
    } catch {/* ignore — leave previous recs visible */}
  }

  // ---- toast ----------------------------------------------------------------
  const toastTimerRef = useRef(null)
  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 1600)
  }, [])

  // ---- mode transitions -----------------------------------------------------
  function changeMode(next) {
    if (next === mode) return
    if (next === 'add') {
      setNewPin({ lat: userLoc.lat, lng: userLoc.lng })
      setNewPlace({ name: '', category: '', notes: '' })
    } else {
      setNewPin(null)
    }
    setMode(next)
    if (next === 'map')   applyOffset(SNAP_PEEK)
    if (next === 'saved') applyOffset(getSnapFull())
  }

  // ---- pill click ------------------------------------------------------------
  function pickPill(key) {
    if (key === 'more') { showToast('All categories below — drag the sheet up'); return }
    setFilter(key)
  }

  // ---- save / delete --------------------------------------------------------
  async function saveNewPlace() {
    if (!newPlace.name.trim()) { showToast('Add a name first'); return }
    try {
      const res = await fetch(`${API}/saved-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID,
          name: newPlace.name.trim(),
          category: newPlace.category || 'attraction',
          notes: newPlace.notes,
          lat: newPin.lat,
          lng: newPin.lng,
          address: '',
        }),
      })
      if (!res.ok) throw new Error()
      await fetchSaved(); fetchRecs()
      showToast(`Saved · ${newPlace.name.trim()}`)
      changeMode('map')
    } catch { showToast('Save failed — is the backend running?') }
  }

  async function deleteItem(id) {
    setSavedItems(prev => prev.filter(i => i.id !== id))   // optimistic
    try {
      await fetch(`${API}/saved-items/${id}`, { method: 'DELETE' })
      showToast('Removed')
      fetchRecs()
    } catch {
      showToast('Delete failed — restoring')
      fetchSaved()
    }
  }

  // ---- feedback (for the eval, called when user taps an item) ---------------
  async function sendFeedback(itemId, useful) {
    try {
      await fetch(`${API}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID, itemId, useful, method: method.toUpperCase(),
          contextSnapshot: { lat: userLoc.lat, lng: userLoc.lng, time: Date.now() },
        }),
      })
    } catch {/* eval data is non-critical for UX */}
  }

  // ---- derived: what the sheet's list shows ---------------------------------
  function listToShow() {
    const q = search.trim().toLowerCase()
    const filterFn = item => {
      if (q && !item.name.toLowerCase().includes(q) && !(item.notes || '').toLowerCase().includes(q)) return false
      if (mode === 'map' && filter !== 'all' && item.category !== filter) return false
      return true
    }

    if (mode === 'map') {
      // Use server-ranked recommendations; fall back to all saved if recs not yet loaded
      const recs = recommendations.length ? recommendations : savedItems.map(it => ({ item: it, score: 0, explanation: {} }))
      return recs.filter(r => filterFn(r.item))
    } else {
      // Saved mode: locally sorted full list
      const items = [...savedItems].filter(filterFn)
      if (sort === 'recent') items.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
      if (sort === 'views')  items.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
      if (sort === 'abc')    items.sort((a, b) => a.name.localeCompare(b.name))
      return items.map(it => ({ item: it, score: null, explanation: {} }))
    }
  }

  // ---- sheet drag logic -----------------------------------------------------
  // Drag bounds: bottom floor leaves the title row + 3 segmented buttons
  // visible; top ceiling is full-screen. Within that range the sheet stays
  // wherever the user releases — no snap points.
  const SNAP_PEEK = 200          // default peek when entering Map mode
  const SNAP_FLOOR = 130         // minimum visible (handle + header + segmented)
  function getSnapFull() {
    return window.innerHeight - 56 - 28
  }

  function applyOffset(offsetFromBottom) {
    const sheet = sheetRef.current
    if (!sheet) return
    // The sheet's height is bound to viewport (height: calc(100% - 60px - 28px)),
    // so we can compute the transform from window.innerHeight directly.
    // Reading clientHeight can return 0 before first layout.
    const sheetHeight = window.innerHeight - 88
    const ty = Math.max(0, sheetHeight - offsetFromBottom)
    sheet.style.transform = `translateY(${ty}px)`
    const fabBottom = `${Math.max(76, offsetFromBottom + 76)}px`
    if (fabsRef.current)     fabsRef.current.style.bottom = fabBottom
    if (themeBtnRef.current) themeBtnRef.current.style.bottom = fabBottom
    dragRef.current.snap = offsetFromBottom
  }

  // Initial position is handled entirely by CSS — the sheet's
  // `transform: translateY(calc(100% - 200px))` and the FAB/theme
  // `bottom: 276px` give a 200px peek state on first paint. JS only
  // takes over once the user drags or switches modes.

  function onHandlePointerDown(e) {
    if (mode !== 'map' && mode !== 'saved') return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    sheetRef.current?.classList.add('dragging')
    dragRef.current.dragging = true
    dragRef.current.startY = e.clientY
    dragRef.current.startOffset = dragRef.current.snap
  }
  function onHandlePointerMove(e) {
    if (!dragRef.current.dragging) return
    const SNAP_FULL = getSnapFull()
    const dy = dragRef.current.startY - e.clientY
    const next = Math.max(SNAP_FLOOR, Math.min(SNAP_FULL, dragRef.current.startOffset + dy))
    applyOffset(next)
  }
  function onHandlePointerUp() {
    if (!dragRef.current.dragging) return
    dragRef.current.dragging = false
    sheetRef.current?.classList.remove('dragging')
    // Free drag — stay wherever the user released, just enforce bounds.
    const SNAP_FULL = getSnapFull()
    const clamped = Math.max(SNAP_FLOOR, Math.min(SNAP_FULL, dragRef.current.snap))
    applyOffset(clamped)
  }

  // ---- render ----------------------------------------------------------------
  const list = listToShow()
  const sheetTitle = mode === 'saved' ? `Saved (${savedItems.length})` : 'Your places'
  const tileUrl = TILES[theme]

  return (
    <>
      <ScopedStyles />
      <div className="wb-app" data-theme={theme} data-mode={mode}>

        {/* ---- map -------------------------------------------------------- */}
        <div className="wb-map-wrap">
          <MapContainer
            center={[userLoc.lat, userLoc.lng]}
            zoom={DEFAULT_ZOOM}
            zoomControl={false}
            attributionControl={false}
            style={{ height: '100%', width: '100%', background: 'var(--bg)' }}
          >
            <TileLayer key={theme} url={tileUrl} attribution={TILE_ATTRIB} />
            <ClickToMovePin active={mode === 'add'} onPick={ll => setNewPin(ll)} />
            <CenterOnUser trigger={centerTrigger} center={userLoc} />
            <SearchFocus query={search} items={savedItems} />
            <Marker position={[userLoc.lat, userLoc.lng]} icon={youAreHereIcon} />
            {savedItems.map(it => (
              <Marker
                key={it.id}
                position={[it.lat, it.lng]}
                icon={savedMarkerIcon(it.category)}
                eventHandlers={{ click: () => showToast(it.name) }}
              />
            ))}
            {mode === 'add' && newPin && <Marker position={[newPin.lat, newPin.lng]} icon={dropPinIcon} />}
          </MapContainer>
        </div>

        {/* ---- search + pills (hidden in saved/add modes) ------------------ */}
        <div className="wb-search-area">
          <div className="wb-search">
            <div className="wb-logo"><MapIcon size={14} /></div>
            <input
              type="text"
              className="wb-search-input"
              placeholder="Search saved places"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="wb-clear" onClick={() => setSearch('')} aria-label="Clear"><X size={14} /></button>}
            <div className="wb-avatar">M</div>
          </div>
          <div className="wb-pills">
            <button className={`wb-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => pickPill('all')}>
              <Bookmark size={14} /> All
            </button>
            {PRIMARY_PILLS.map(key => {
              const c = CATEGORIES[key]; const Icon = c.Icon
              return (
                <button key={key} className={`wb-pill ${filter === key ? 'active' : ''}`} onClick={() => pickPill(key)}>
                  <Icon size={14} /> {c.label}
                </button>
              )
            })}
            <button className="wb-pill" onClick={() => pickPill('more')}>
              <MoreHorizontal size={14} /> More
            </button>
          </div>
        </div>

        {/* ---- layers shortcut + method tag (map mode only) ---------------- */}
        <div className="wb-method-tag">{METHOD_LABEL[method]}</div>
        <button
          className="wb-layers"
          onClick={() => {
            const order = ['cbr', 'jitir', 'cia']
            const next = order[(order.indexOf(method) + 1) % 3]
            setMethod(next); showToast(`Method: ${METHOD_LABEL[next]}`)
          }}
          aria-label="Switch ranking method"
        >
          <LayersIcon size={22} />
        </button>

        {/* ---- theme toggle (left edge) ------------------------------------ */}
        <button
          ref={themeBtnRef}
          className="wb-theme"
          onClick={() => {
            const next = theme === 'dark' ? 'light' : 'dark'
            setTheme(next); showToast(next === 'dark' ? 'Dark mode' : 'Light mode')
          }}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
        </button>

        {/* ---- FABs (right edge) ------------------------------------------- */}
        <div ref={fabsRef} className="wb-fabs">
          <button className="wb-fab" onClick={() => setCenterTrigger(t => t + 1)} aria-label="My location">
            <Locate size={22} />
          </button>
          <button className="wb-fab" onClick={() => showToast('Pick a place to navigate to')} aria-label="Directions">
            <Navigation size={22} />
          </button>
        </div>

        {/* ---- bottom sheet ------------------------------------------------- */}
        <div ref={sheetRef} className="wb-sheet">
          <div
            className="wb-handle-area"
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
          >
            <div className="wb-handle" />
          </div>
          <div className="wb-sheet-header">
            <div className="wb-sheet-title">{sheetTitle}</div>
            <div className="wb-weather"><Cloud size={14} /><span>14°</span></div>
          </div>

          {/* segmented control swaps content by mode */}
          <div className="wb-segmented">
            {mode === 'map' ? (
              ['cbr', 'jitir', 'cia'].map(m => (
                <button key={m} className={`wb-seg ${method === m ? 'active' : ''}`}
                  onClick={() => { setMethod(m); showToast(`Ranked: ${METHOD_LABEL[m]}`) }}>
                  {METHOD_LABEL[m]}
                </button>
              ))
            ) : (
              ['recent', 'views', 'abc'].map(s => (
                <button key={s} className={`wb-seg ${sort === s ? 'active' : ''}`}
                  onClick={() => { setSort(s); showToast(`Sorted: ${SORT_LABEL[s]}`) }}>
                  {SORT_LABEL[s]}
                </button>
              ))
            )}
          </div>

          <div className="wb-list">
            {list.length === 0 ? (
              <div className="wb-empty">
                Nothing here yet. Tap <strong style={{ color: 'var(--accent)' }}>Add</strong> to save your first place.
              </div>
            ) : list.map(({ item, score, explanation }) => {
              const cat = CATEGORIES[item.category] || { label: item.category, Icon: MapPin, color: '#a0e6d4' }
              const ItemIcon = cat.Icon
              const reasonText = explanation?.reason
                ? getExplanationText(item, explanation)
                : null
              return (
                <div key={item.id} className="wb-item"
                  onClick={() => showToast(item.name)}>
                  <div className="wb-item-icon" style={{ background: cat.color + '26' }}>
                    <ItemIcon size={20} color={cat.color} />
                  </div>
                  <div className="wb-item-main">
                    <div className="wb-item-name">{item.name}</div>
                    <div className="wb-item-meta">
                      {timeAgo(item.savedAt)} · {cat.label.toLowerCase()}
                      {mode === 'saved' && ` · ${item.viewCount} ${item.viewCount === 1 ? 'view' : 'views'}`}
                    </div>
                    {mode === 'map' && reasonText && (
                      <div className="wb-item-reason"><Sparkles size={13} /> {reasonText}</div>
                    )}
                  </div>
                  {mode === 'map' ? (
                    <div className="wb-item-score">{score != null ? Math.round(score * 100) : ''}</div>
                  ) : (
                    <button className="wb-item-delete" aria-label={`Delete ${item.name}`}
                      onClick={(e) => { e.stopPropagation(); deleteItem(item.id) }}>
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ---- add card ----------------------------------------------------- */}
        <div className="wb-add-card">
          <div className="wb-add-head">
            <div className="wb-add-title">Save this spot</div>
            <button className="wb-add-x" aria-label="Cancel" onClick={() => changeMode('map')}><X size={16} /></button>
          </div>
          <div className="wb-add-loc">
            <MapPin size={18} color="#ea4335" />
            <div className="wb-add-loc-text">
              <div>{newPin ? `${newPin.lat.toFixed(4)}, ${newPin.lng.toFixed(4)}` : '—'}</div>
              <div className="sub">München · tap the map to move the pin</div>
            </div>
          </div>
          <input
            className="wb-input"
            type="text"
            placeholder="What do you want to remember this place as?"
            value={newPlace.name}
            onChange={e => setNewPlace({ ...newPlace, name: e.target.value })}
          />
          <div className="wb-cat-label">CATEGORY</div>
          <div className="wb-cat-row">
            {Object.entries(CATEGORIES).map(([key, c]) => {
              const Icon = c.Icon
              return (
                <button key={key}
                  className={`wb-cat-chip ${newPlace.category === key ? 'active' : ''}`}
                  onClick={() => setNewPlace({ ...newPlace, category: key })}>
                  <Icon size={14} /> {c.label}
                </button>
              )
            })}
          </div>
          <button className="wb-save-btn" onClick={saveNewPlace}>Save</button>
        </div>

        {/* ---- bottom nav --------------------------------------------------- */}
        <nav className="wb-nav">
          <button className={`wb-nav-item ${mode === 'map' ? 'active' : ''}`} onClick={() => changeMode('map')}>
            <span className="nav-icon"><MapIcon size={20} /></span>
            <span>Map</span>
          </button>
          <button className={`wb-nav-item ${mode === 'saved' ? 'active' : ''}`} onClick={() => changeMode('saved')}>
            <span className="nav-icon"><Bookmark size={20} /></span>
            <span>Saved</span>
          </button>
          <button className={`wb-nav-item ${mode === 'add' ? 'active' : ''}`} onClick={() => changeMode('add')}>
            <span className="nav-icon"><CirclePlus size={20} /></span>
            <span>Add</span>
          </button>
        </nav>

        {/* ---- toast -------------------------------------------------------- */}
        {toast && <div className="wb-toast show">{toast}</div>}
      </div>
    </>
  )
}

// -----------------------------------------------------------------------------
// Scoped styles — injected once, switch via [data-theme] on .wb-app
// -----------------------------------------------------------------------------

function ScopedStyles() {
  return (
    <style>{`
      :root { color-scheme: dark; }
      html, body, #root { height: 100%; margin: 0; padding: 0; overflow: hidden; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
      .leaflet-container { font-family: inherit; }

      .wb-app {
        --bg: #1a2433; --surface-1: #28323f; --surface-2: #1c2530; --surface-3: #14202d;
        --text-1: #e8eaed; --text-2: #9aa0a6; --border: rgba(255,255,255,0.08); --handle: #5f6368;
        --accent: #a0e6d4; --accent-on: #0e3a31; --accent-bg: rgba(160,230,212,0.18); --status: #e8eaed;
        position: fixed; inset: 0; background: var(--bg); color: var(--text-1); user-select: none;
        transition: background 0.25s, color 0.25s;
      }
      .wb-app[data-theme="light"] {
        --bg: #eef1f5; --surface-1: #ffffff; --surface-2: #ffffff; --surface-3: #ffffff;
        --text-1: #202124; --text-2: #5f6368; --border: rgba(0,0,0,0.08); --handle: #c4c7c5;
        --accent: #137c6e; --accent-on: #ffffff; --accent-bg: rgba(19,124,110,0.10); --status: #202124;
      }

      .wb-map-wrap { position: absolute; inset: 0; }
      .leaflet-control-attribution { display: none; }

      .wb-pin {
        width: 30px; height: 30px; border-radius: 50%;
        border: 2px solid rgba(0,0,0,0.4);
        box-shadow: 0 1px 4px rgba(0,0,0,0.35);
        display: flex; align-items: center; justify-content: center;
      }
      .wb-pin svg { display: block; }
      .wb-you-dot {
        width: 14px; height: 14px; border-radius: 50%;
        background: #4285f4; border: 3px solid #fff;
        outline: 4px solid rgba(66,133,244,0.28);
      }

      .wb-search-area {
        position: absolute; top: 0; left: 0; right: 0;
        padding: 12px 12px 0; z-index: 500;
        transition: opacity 0.22s, transform 0.22s;
      }
      .wb-search {
        height: 48px; background: var(--surface-1); border-radius: 24px;
        display: flex; align-items: center; padding: 0 14px; gap: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      }
      .wb-logo {
        width: 24px; height: 24px; border-radius: 50%; background: var(--bg);
        display: flex; align-items: center; justify-content: center; color: var(--accent);
      }
      .wb-search-input {
        flex: 1; border: none; background: transparent; outline: none;
        color: var(--text-1); font-size: 14px; padding: 0; min-width: 0;
      }
      .wb-search-input::placeholder { color: var(--text-2); }
      .wb-clear { background: transparent; border: none; color: var(--text-2); cursor: pointer; padding: 4px; display: flex; }
      .wb-avatar {
        width: 30px; height: 30px; border-radius: 50%; background: #d4a276;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 500; color: #1a2433;
      }

      .wb-pills {
        margin-top: 10px; display: flex; gap: 8px; overflow-x: auto;
        scrollbar-width: none; padding-bottom: 2px;
      }
      .wb-pills::-webkit-scrollbar { display: none; }
      .wb-pill {
        flex-shrink: 0; height: 36px; padding: 0 14px;
        background: var(--surface-1); border: 0.5px solid var(--border);
        border-radius: 18px; display: flex; align-items: center; gap: 6px;
        font-size: 13px; color: var(--text-1); cursor: pointer; white-space: nowrap;
        box-shadow: 0 1px 3px rgba(0,0,0,0.12);
      }
      .wb-pill.active { background: #c8e6d8; color: #0e3a31; border-color: transparent; }

      .wb-layers, .wb-theme, .wb-fab {
        background: var(--surface-1); border: none; cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.22);
      }
      .wb-layers {
        position: absolute; top: 140px; right: 12px;
        width: 44px; height: 44px; border-radius: 22px; z-index: 500;
        display: flex; align-items: center; justify-content: center;
        color: var(--accent); transition: opacity 0.2s;
      }
      .wb-method-tag {
        position: absolute; top: 148px; right: 64px;
        background: var(--surface-1); border-radius: 14px; padding: 4px 10px;
        font-size: 11px; color: var(--accent); z-index: 500; font-weight: 500;
        transition: opacity 0.2s;
      }
      .wb-fabs {
        position: absolute; right: 12px; bottom: 276px;
        display: flex; flex-direction: column; gap: 10px; z-index: 500;
        transition: bottom 0.32s cubic-bezier(0.2,0.8,0.2,1), opacity 0.2s;
      }
      .wb-fab {
        width: 50px; height: 50px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        color: var(--text-1);
      }
      .wb-theme {
        position: absolute; left: 12px; bottom: 276px;
        width: 50px; height: 50px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        color: var(--accent); z-index: 500;
        transition: bottom 0.32s cubic-bezier(0.2,0.8,0.2,1);
      }

      .wb-sheet {
        position: absolute; left: 0; right: 0; bottom: 60px;
        background: var(--surface-2);
        border-top-left-radius: 18px; border-top-right-radius: 18px;
        z-index: 600;
        transform: translateY(calc(100% - 200px));
        transition: transform 0.32s cubic-bezier(0.2,0.8,0.2,1);
        height: calc(100% - 60px - 28px);
        display: flex; flex-direction: column;
        box-shadow: 0 -4px 18px rgba(0,0,0,0.22);
      }
      .wb-sheet.dragging { transition: none; }
      .wb-handle-area {
        padding: 12px 0 6px; display: flex; justify-content: center;
        cursor: grab; touch-action: none;
      }
      .wb-handle-area:active { cursor: grabbing; }
      .wb-handle { width: 36px; height: 4px; background: var(--handle); border-radius: 2px; }
      .wb-sheet-header {
        padding: 4px 16px 12px; display: flex; align-items: center; justify-content: space-between;
      }
      .wb-sheet-title { font-size: 18px; font-weight: 500; }
      .wb-weather {
        background: var(--surface-1); padding: 5px 10px; border-radius: 14px;
        font-size: 12px; display: flex; align-items: center; gap: 5px; color: var(--text-1);
      }
      .wb-weather svg { color: #fbbc04; }
      .wb-segmented {
        margin: 0 12px 12px; background: var(--surface-1); border-radius: 12px;
        padding: 3px; display: flex;
      }
      .wb-seg {
        flex: 1; text-align: center; padding: 9px 4px;
        font-size: 12px; font-weight: 500; border-radius: 9px;
        cursor: pointer; color: var(--text-2);
        background: transparent; border: none;
      }
      .wb-seg.active { background: var(--surface-2); color: var(--text-1); }
      .wb-app[data-theme="light"] .wb-seg.active { background: #eef1f5; }
      .wb-list { flex: 1; overflow-y: auto; padding: 0 12px 16px; scrollbar-width: thin; }
      .wb-empty { padding: 40px 16px; text-align: center; color: var(--text-2); font-size: 13px; }
      .wb-item {
        display: flex; align-items: flex-start; gap: 12px;
        padding: 12px 4px; border-bottom: 0.5px solid var(--border);
        cursor: pointer; transition: opacity 0.25s, transform 0.25s;
      }
      .wb-item:last-child { border-bottom: none; }
      .wb-item-icon {
        width: 42px; height: 42px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .wb-item-main { flex: 1; min-width: 0; }
      .wb-item-name { font-size: 14px; font-weight: 500; }
      .wb-item-meta { font-size: 12px; color: var(--text-2); margin-top: 2px; }
      .wb-item-reason {
        font-size: 11px; color: var(--accent); margin-top: 4px;
        display: flex; align-items: center; gap: 4px;
      }
      .wb-item-score { font-size: 12px; color: var(--text-2); align-self: center; font-weight: 500; }
      .wb-item-delete {
        background: transparent; border: none; cursor: pointer;
        padding: 8px; align-self: center; display: flex; border-radius: 50%;
        color: #e0413f;
      }
      .wb-item-delete:hover { background: rgba(224,65,63,0.12); }

      .wb-nav {
        position: absolute; bottom: 0; left: 0; right: 0; height: 60px;
        background: var(--surface-3); display: flex;
        border-top: 0.5px solid var(--border); z-index: 700;
      }
      .wb-nav-item {
        flex: 1; display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 2px; cursor: pointer;
        color: var(--text-2); font-size: 11px;
        background: transparent; border: none;
      }
      .wb-nav-item .nav-icon { padding: 3px 14px; border-radius: 12px; transition: background 0.18s; display: flex; }
      .wb-nav-item.active { color: var(--accent); }
      .wb-nav-item.active .nav-icon { background: var(--accent-bg); }

      .wb-toast {
        position: absolute; bottom: 76px; left: 50%; transform: translateX(-50%);
        background: var(--text-1); color: var(--bg);
        padding: 10px 18px; border-radius: 20px; font-size: 13px; font-weight: 500;
        z-index: 800; white-space: nowrap;
        box-shadow: 0 2px 10px rgba(0,0,0,0.22);
        animation: wbToast 0.2s ease-out;
      }
      @keyframes wbToast { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

      /* mode-driven hiding -------------------------------------------------- */
      .wb-app[data-mode="saved"] .wb-search-area,
      .wb-app[data-mode="saved"] .wb-layers,
      .wb-app[data-mode="saved"] .wb-method-tag,
      .wb-app[data-mode="add"]   .wb-search-area,
      .wb-app[data-mode="add"]   .wb-layers,
      .wb-app[data-mode="add"]   .wb-method-tag {
        opacity: 0; pointer-events: none;
      }

      /* add-card slides up; sheet tucks away ------------------------------- */
      .wb-add-card {
        position: absolute; left: 0; right: 0; bottom: 60px;
        background: var(--surface-2);
        border-top-left-radius: 18px; border-top-right-radius: 18px;
        z-index: 600; padding: 16px 16px 18px;
        display: flex; flex-direction: column; gap: 12px;
        transform: translateY(100%); transition: transform 0.32s cubic-bezier(0.2,0.8,0.2,1);
        box-shadow: 0 -4px 18px rgba(0,0,0,0.22);
        max-height: calc(100% - 60px - 28px); overflow-y: auto;
      }
      .wb-app[data-mode="add"] .wb-add-card { transform: translateY(0); }
      .wb-app[data-mode="add"] .wb-sheet { transform: translateY(120%); }
      .wb-add-head { display: flex; align-items: center; justify-content: space-between; }
      .wb-add-title { font-size: 18px; font-weight: 500; }
      .wb-add-x {
        width: 30px; height: 30px; border-radius: 50%; background: var(--surface-1);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; color: var(--text-1); border: none;
      }
      .wb-add-loc {
        background: var(--surface-1); border-radius: 12px;
        padding: 10px 12px; display: flex; align-items: center; gap: 10px;
      }
      .wb-add-loc-text { flex: 1; font-size: 13px; }
      .wb-add-loc-text .sub { font-size: 11px; color: var(--text-2); margin-top: 2px; }
      .wb-input {
        background: var(--surface-1); border: 0.5px solid var(--border);
        border-radius: 12px; padding: 12px; font-size: 14px;
        color: var(--text-1); outline: none;
      }
      .wb-input::placeholder { color: var(--text-2); }
      .wb-cat-label {
        font-size: 11px; color: var(--text-2);
        letter-spacing: 0.4px; text-transform: uppercase;
      }
      .wb-cat-row { display: flex; gap: 6px; flex-wrap: wrap; }
      .wb-cat-chip {
        padding: 7px 12px; background: var(--surface-1);
        border: 0.5px solid var(--border); border-radius: 14px;
        font-size: 12px; color: var(--text-1); cursor: pointer;
        display: flex; align-items: center; gap: 4px;
      }
      .wb-cat-chip.active { background: #c8e6d8; color: #0e3a31; border-color: transparent; }
      .wb-save-btn {
        height: 48px; background: var(--accent); color: var(--accent-on);
        border: none; border-radius: 24px; font-size: 15px; font-weight: 500;
        cursor: pointer; margin-top: 4px;
      }
    `}</style>
  )
}