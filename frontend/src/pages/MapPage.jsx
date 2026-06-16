import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Search, X, Plus, Compass, Bookmark, Sun, Moon, Trash2, MapPin,
  Coffee, UtensilsCrossed, Trees, Wine, Bed, ShoppingBag, Wrench,
  Train, Landmark, Camera, Navigation, Locate, MoreHorizontal,
  Cloud, CloudRain, CloudSnow, CloudFog, CloudLightning,
  Footprints, Bike, Car, ArrowLeft,
  Map as MapIcon, ChevronLeft, ChevronRight,
  Ticket, StickyNote, Tags, Pencil,
  ChevronDown, Check, ThumbsUp, ThumbsDown,
} from 'lucide-react'
import { getExplanationText } from '../utils/explanationText'
import { formatDistance } from '../utils/formatDistance'
import ExplanationBreakdown from '../components/ExplanationBreakdown'
import MethodCompare from '../components/MethodCompare'
import TripItinerary from '../components/TripItinerary'
import TypeBadge from '../components/TypeBadge'
import TicketCountdown from '../components/TicketCountdown'
import TabBar from '../components/TabBar'
import ThemeToggle from '../components/ThemeToggle'

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const API = (import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:8000'
const USER_ID = 'user_demo'

// Notes editing via PATCH /saved-items/:id, live since Sway shipped the
// endpoint. The DetailPanel editor reflects the server's returned item on
// success and never writes notes to local state on failure, so nothing fakes
// persistence. Set to false to hide the editor if the route ever regresses.
const NOTES_EDIT_ENABLED = true
const DEFAULT_CENTER = [48.1402, 11.5586]  // Munich Hauptbahnhof — sensible demo location
const DEFAULT_ZOOM = 15

// Category metadata — matches the 10 categories in backend/seed.py
// Marker colors are pre-computed muted variants of the source category hues
// (color-mix(in oklch, <orig> 55%, var(--paper-warm)) with powerless-hue
// handling on the cream side). They preserve per-category recognizability
// while no longer competing with the Editorial Paper cream chrome. Source
// hues kept in the inline comments for traceability.
const CATEGORIES = {
  attraction:    { label: 'Attractions',  Icon: Camera,          color: '#a0e1d0' },  // src #78d9c2
  restaurant:    { label: 'Restaurants',  Icon: UtensilsCrossed, color: '#f8afa8' },  // src #f28b82
  cafe:          { label: 'Cafés',        Icon: Coffee,          color: '#e3bd9c' },  // src #d4a276
  museum:        { label: 'Museums',      Icon: Landmark,        color: '#c1b2fb' },  // src #a78bfa
  park:          { label: 'Parks',        Icon: Trees,           color: '#2f7a4f' },  // src #4a9c6e; hand-picked deeper anchor (4.05:1 on --paper-warm)
  bar:           { label: 'Bars',         Icon: Wine,            color: '#f690ba' },  // src #ec4899
  accommodation: { label: 'Hotels',       Icon: Bed,             color: '#e9a5b5' },  // src #d97a93
  shopping:      { label: 'Shopping',     Icon: ShoppingBag,     color: '#f6ce7c' },  // src #fbbc04
  services:      { label: 'Services',     Icon: Wrench,          color: '#8b9d96' },  // src #5a6166
  transport:     { label: 'Transport',    Icon: Train,           color: '#5e94d6' },  // src #4285f4; hand-picked deeper variant (2.44:1; floor overridden, see commit message)
}

const PRIMARY_PILLS = ['attraction', 'restaurant', 'cafe', 'museum', 'park']
// Overflow categories surfaced behind the "More" chip. Order picked so the
// most-tapped categories from the seed dataset sit on top.
const MORE_PILLS = ['bar', 'accommodation', 'shopping', 'services', 'transport']
const METHOD_LABEL = { cbr: 'Based on history', jitir: 'For this moment', cia: 'Near you' }
const SORT_LABEL = { recent: 'Recent', views: 'Most viewed', abc: 'A–Z', distance: 'Distance' }

// Map an OSM key/value pair (from Photon search results) onto one of our 10
// categories so an imported place is filed the same way a manual pin would be.
// Falls back to 'attraction' for anything we do not explicitly recognize.
function osmToCategory(key, value) {
  if (key === 'shop') {
    if (value === 'bakery' || value === 'pastry' || value === 'confectionery' || value === 'deli' || value === 'chocolate') return 'cafe'
    return 'shopping'
  }
  if (key === 'tourism') {
    if (value === 'museum' || value === 'gallery') return 'museum'
    if (value === 'hotel' || value === 'hostel' || value === 'guest_house' || value === 'motel') return 'accommodation'
    if (value === 'zoo' || value === 'theme_park') return 'park'
    return 'attraction'
  }
  if (key === 'leisure') {
    if (value === 'park' || value === 'garden' || value === 'nature_reserve') return 'park'
    return 'attraction'
  }
  if (key === 'historic') return 'attraction'
  if (key === 'railway' || key === 'public_transport' || key === 'aeroway') return 'transport'
  if (key === 'amenity') {
    if (value === 'cafe' || value === 'ice_cream') return 'cafe'
    if (value === 'restaurant' || value === 'fast_food' || value === 'food_court') return 'restaurant'
    if (value === 'bar' || value === 'pub' || value === 'biergarten' || value === 'nightclub') return 'bar'
    if (value === 'bus_station' || value === 'taxi') return 'transport'
    if (value === 'museum' || value === 'arts_centre') return 'museum'
    if (value === 'cinema' || value === 'theatre') return 'attraction'
    if (value === 'bank' || value === 'pharmacy' || value === 'hospital' || value === 'post_office' || value === 'clinic') return 'services'
    return 'attraction'
  }
  return 'attraction'
}

// Photon (free OSM geocoder) lookup, shared by the Add flow's debounced search
// and the saved-search escape hatch. Returns the GeoJSON feature array (or []).
async function fetchPhoton(query, lat, lng) {
  const url = `https://photon.komoot.io/api?q=${encodeURIComponent(query)}&lat=${lat}&lon=${lng}&limit=5`
  const res = await fetch(url)
  const data = await res.json()
  return Array.isArray(data?.features) ? data.features : []
}

// Editorial Paper: cream chrome AND cream map for light mode (CARTO Positron).
// Dark mode pairs the warm cocoa chrome with CARTO Dark Matter so the map
// itself reads as dark instead of an awkward light tile inside dark chrome.
// FIX 3 (2026-05-26): re-introducing the dark tile set after the 2026-05-17
// single-set pivot, now that the toggle is back.
const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
}
const TILE_ATTRIB = '&copy; OpenStreetMap &copy; CARTO'

// -----------------------------------------------------------------------------
// Leaflet marker helpers
// -----------------------------------------------------------------------------

// Bug 6: WayBack ranking-method icon. Three dots arranged in a triangle
// inside a circle, one dot per method (For this moment / Based on history /
// Near you). Distinct from the previous Google-Maps-style stacked rhombi.
function LayersIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
      <circle cx="12" cy="12" r="9.25" />
      <circle cx="12" cy="7.6" r="1.55" fill="currentColor" stroke="none" />
      <circle cx="7.8" cy="14.6" r="1.55" fill="currentColor" stroke="none" />
      <circle cx="16.2" cy="14.6" r="1.55" fill="currentColor" stroke="none" />
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

// Straight-line distance in metres between two coords (kept as a fallback for
// when the routing API is unreachable).
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Frontend dedupe guard (the backend has no dedupe yet, tracked separately): a
// Photon result counts as already saved when an existing item shares its display
// name (case-insensitive, trimmed) and sits within 50 m. The name is derived the
// same way the save handlers derive it, so the check matches what would be saved.
function featureMatchesSaved(feature, savedItems) {
  const p = feature.properties || {}
  const coords = feature.geometry?.coordinates || []
  const lng = coords[0]
  const lat = coords[1]
  if (lat == null || lng == null) return false
  const streetLine = [p.street, p.housenumber].filter(Boolean).join(' ')
  const name = (p.name || streetLine || 'Unnamed place').trim().toLowerCase()
  return savedItems.some(it =>
    (it.name || '').trim().toLowerCase() === name &&
    haversineMeters(lat, lng, it.lat, it.lng) <= 50
  )
}

// Fetch a real route from the appropriate backend for the requested mode.
// - foot / bike / car → OSRM public demo (free, no API key)
// - transit           → Transitous MOTIS 2 API (free; community-run, see policy)
// Returns a unified { coords, distance, duration, transfers?, transitLines? }
// shape or null if the request fails.
async function fetchRoute(from, to, mode) {
  if (mode === 'transit') return fakeTransitRoute(from, to)
  return fetchOsrmRoute(from, to, mode)
}

async function fetchOsrmRoute(from, to, mode) {
  // The router.project-osrm.org demo only runs the CAR profile — all modes
  // get the same response. The FOSSGIS routing.openstreetmap.de service
  // runs THREE separate OSRM instances, one per profile, addressed by URL
  // prefix. Same v5 API otherwise.
  //
  //   foot → /routed-foot/route/v1/walking/…
  //   bike → /routed-bike/route/v1/cycling/…
  //   car  → /routed-car/route/v1/driving/…
  //
  // Rate limit: ~1 req/sec per client, no commercial use.
  const cfg = {
    foot: { prefix: 'routed-foot', name: 'walking' },
    bike: { prefix: 'routed-bike', name: 'cycling' },
    car:  { prefix: 'routed-car',  name: 'driving' },
  }[mode] || { prefix: 'routed-foot', name: 'walking' }

  const url = `https://routing.openstreetmap.de/${cfg.prefix}/route/v1/${cfg.name}/`
    + `${from.lng},${from.lat};${to.lng},${to.lat}`
    + `?overview=full&geometries=geojson`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const route = data?.routes?.[0]
    if (!route) return null
    const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
    return { coords, distance: route.distance, duration: route.duration }
  } catch {
    return null
  }
}

// Public transport: hand-curated Munich transit data, originating from
// Hauptbahnhof. Each "area" is a destination zone with a realistic MVV
// itinerary attached (lines, transfers, in-vehicle time). Final-mile walk
// is computed from the area's finalStop to the actual destination.
//
// Why not live API? Transitous (the free MOTIS instance) is community-run
// with limited resources and isn't reliable enough for a demo. For real
// production deployment, self-host MOTIS or use a paid provider.

const MUNICH_TRANSIT_AREAS = [
  // Walking-distance from Hbf — show transit anyway for completeness
  { id: 'at-hbf',         centerLat: 48.1402, centerLng: 11.5586, radius: 350,
    finalStop: { name: 'Hauptbahnhof', lat: 48.1402, lng: 11.5586 },
    rideMin: 0,  lines: [],            transfers: 0 },

  // City center via S-Bahn Stammstrecke (Hbf → Marienplatz)
  { id: 'center',         centerLat: 48.1374, centerLng: 11.5755, radius: 700,
    finalStop: { name: 'Marienplatz', lat: 48.1374, lng: 11.5755 },
    rideMin: 4,  lines: ['S1','S2','S4','S6','S7','S8'], transfers: 0 },

  // Odeonsplatz / Café Luitpold corridor — U4/U5 from Hbf
  { id: 'odeonsplatz',    centerLat: 48.1422, centerLng: 11.5772, radius: 350,
    finalStop: { name: 'Odeonsplatz', lat: 48.1422, lng: 11.5772 },
    rideMin: 5,  lines: ['U4','U5'],   transfers: 0 },

  // Museum quarter (Alte Pinakothek, Lenbachhaus) — U2 to Königsplatz
  { id: 'museum-quarter', centerLat: 48.1476, centerLng: 11.5680, radius: 500,
    finalStop: { name: 'Königsplatz', lat: 48.1469, lng: 11.5658 },
    rideMin: 4,  lines: ['U2','U8'],   transfers: 0 },

  // Glockenbach (Man vs Machine, Zephyr Bar) — U1/U2 via Sendlinger Tor
  { id: 'glockenbach',    centerLat: 48.1325, centerLng: 11.5720, radius: 500,
    finalStop: { name: 'Fraunhoferstraße', lat: 48.1303, lng: 11.5717 },
    rideMin: 6,  lines: ['U1','U2'],   transfers: 1,
    transferStop: { name: 'Sendlinger Tor', lat: 48.1340, lng: 11.5670 } },

  // Augustiner / Hackerbrücke — 1 S-Bahn stop west
  { id: 'augustiner',     centerLat: 48.1410, centerLng: 11.5500, radius: 500,
    finalStop: { name: 'Hackerbrücke', lat: 48.1410, lng: 11.5485 },
    rideMin: 2,  lines: ['S1','S2','S3','S4','S6','S7','S8'], transfers: 0 },

  // Deutsches Museum — Tram 16 from Hbf
  { id: 'deutsches-museum', centerLat: 48.1299, centerLng: 11.5832, radius: 400,
    finalStop: { name: 'Deutsches Museum', lat: 48.1316, lng: 11.5800 },
    rideMin: 8,  lines: ['Tram 16'],   transfers: 0 },

  // Schwabing south + Eisbach — S-Bahn + U-Bahn via Marienplatz
  { id: 'eisbach',        centerLat: 48.1500, centerLng: 11.5860, radius: 600,
    finalStop: { name: 'Universität', lat: 48.1502, lng: 11.5808 },
    rideMin: 9,  lines: ['U3','U6'],   transfers: 1,
    transferStop: { name: 'Marienplatz', lat: 48.1374, lng: 11.5755 } },

  // English Garden / Chinese Tower — U3/U6 via Marienplatz to Münchner Freiheit
  { id: 'english-garden', centerLat: 48.1620, centerLng: 11.5970, radius: 1500,
    finalStop: { name: 'Münchner Freiheit', lat: 48.1620, lng: 11.5870 },
    rideMin: 12, lines: ['U3','U6'],   transfers: 1,
    transferStop: { name: 'Marienplatz', lat: 48.1374, lng: 11.5755 } },

  // Tantris area — U6 further north
  { id: 'tantris',        centerLat: 48.1683, centerLng: 11.5938, radius: 400,
    finalStop: { name: 'Dietlindenstraße', lat: 48.1715, lng: 11.5949 },
    rideMin: 15, lines: ['U6'],        transfers: 1,
    transferStop: { name: 'Marienplatz', lat: 48.1374, lng: 11.5755 } },

  // Olympia / BMW Welt / BMW Museum — U3 via Sendlinger Tor
  { id: 'olympia-bmw',    centerLat: 48.1762, centerLng: 11.5552, radius: 700,
    finalStop: { name: 'Olympiazentrum', lat: 48.1796, lng: 11.5510 },
    rideMin: 16, lines: ['U3'],        transfers: 1,
    transferStop: { name: 'Sendlinger Tor', lat: 48.1340, lng: 11.5670 } },

  // Nymphenburg — Tram 17 direct from Hbf
  { id: 'nymphenburg',    centerLat: 48.1590, centerLng: 11.5050, radius: 700,
    finalStop: { name: 'Schloss Nymphenburg', lat: 48.1607, lng: 11.5085 },
    rideMin: 17, lines: ['Tram 17'],   transfers: 0 },

  // Au (Wirtshaus in der Au) — S-Bahn + walk
  { id: 'au',             centerLat: 48.1283, centerLng: 11.5876, radius: 400,
    finalStop: { name: 'Rosenheimer Platz', lat: 48.1278, lng: 11.5917 },
    rideMin: 6,  lines: ['S1','S2','S4','S6','S7','S8'], transfers: 0 },
]

// Walking pace (m/min) used to estimate final-mile time.
const WALK_PACE_M_PER_MIN = 80

// Fake but realistic transit route built from MUNICH_TRANSIT_AREAS.
// Always works. Returns the same shape as fetchOsrmRoute.
function fakeTransitRoute(from, to) {
  // Find the area whose center is closest to the destination (and which
  // contains the destination within its radius).
  let best = null
  let bestDist = Infinity
  for (const a of MUNICH_TRANSIT_AREAS) {
    const d = haversineMeters(a.centerLat, a.centerLng, to.lat, to.lng)
    if (d <= a.radius && d < bestDist) { best = a; bestDist = d }
  }

  // Special case: destination is right at Hbf — nothing to ride.
  if (best && best.id === 'at-hbf') {
    return {
      coords: [[from.lat, from.lng], [to.lat, to.lng]],
      distance: null,
      duration: 60,
      transfers: 0,
      transitLines: [],
      legs: [{ mode: 'WALK', minutes: 1, label: 'Walk' }],
    }
  }

  // Generic fallback for destinations outside any defined area
  if (!best) {
    const distM = haversineMeters(from.lat, from.lng, to.lat, to.lng)
    const rideMin = Math.max(5, Math.round(distM / 350))   // ~21 km/h average
    return {
      coords: [
        [from.lat, from.lng],
        [(from.lat + to.lat) / 2, (from.lng + to.lng) / 2],
        [to.lat, to.lng],
      ],
      distance: null,
      duration: (rideMin + 4) * 60,
      transfers: 0,
      transitLines: ['Bus'],
      legs: [
        { mode: 'WALK',   minutes: 2,        label: 'Walk to stop' },
        { mode: 'TRANSIT', minutes: rideMin, label: 'Ride',  line: 'Bus' },
        { mode: 'WALK',   minutes: 2,        label: 'Walk to destination' },
      ],
    }
  }

  // Build the route from the matched area
  const coords = [[from.lat, from.lng]]
  if (best.transfers > 0 && best.transferStop) {
    coords.push([best.transferStop.lat, best.transferStop.lng])
  }
  coords.push([best.finalStop.lat, best.finalStop.lng])
  coords.push([to.lat, to.lng])

  const finalWalkMin = Math.max(1, Math.round(
    haversineMeters(best.finalStop.lat, best.finalStop.lng, to.lat, to.lng) / WALK_PACE_M_PER_MIN
  ))
  const boardingMin = 3                            // walking through Hbf to platform
  const transferMin = best.transfers > 0 ? 3 : 0
  const totalMin = boardingMin + best.rideMin + transferMin + finalWalkMin

  // Build per-leg breakdown for the in-sheet step list
  const legs = []
  legs.push({ mode: 'WALK', minutes: boardingMin, label: `Walk to ${best.finalStop.name === 'Hauptbahnhof' ? 'platform' : 'platform'}` })
  if (best.transfers > 0 && best.transferStop) {
    const firstRide = Math.ceil(best.rideMin / 2)
    legs.push({
      mode: 'TRANSIT', minutes: firstRide,
      label: `Take ${best.lines[0]} to ${best.transferStop.name}`,
      line: best.lines[0],
    })
    legs.push({ mode: 'TRANSFER', minutes: transferMin, label: `Transfer at ${best.transferStop.name}` })
    const secondRide = best.rideMin - firstRide
    legs.push({
      mode: 'TRANSIT', minutes: secondRide,
      label: `Take ${best.lines[best.lines.length - 1] || best.lines[0]} to ${best.finalStop.name}`,
      line: best.lines[best.lines.length - 1] || best.lines[0],
    })
  } else {
    legs.push({
      mode: 'TRANSIT', minutes: best.rideMin,
      label: `Take ${best.lines[0]} to ${best.finalStop.name}`,
      line: best.lines[0],
    })
  }
  legs.push({ mode: 'WALK', minutes: finalWalkMin, label: 'Walk to destination' })

  return {
    coords,
    distance: null,
    duration: totalMin * 60,
    transfers: best.transfers,
    transitLines: best.lines.slice(0, 2),
    legs,
  }
}

// Format the banner text per mode:
//   foot    → "12 min walk · 850 m"
//   bike    → "4 min bike · 850 m"
//   car     → "3 min drive · 1.2 km"
//   transit → "18 min · via U2 · 1 transfer"
function formatRouteSummary(route, mode) {
  if (!route) return ''
  const mins = Math.max(1, Math.round(route.duration / 60))

  if (mode === 'transit') {
    const linesStr = route.transitLines?.length
      ? ` · via ${route.transitLines.join(', ')}` : ''
    const xferStr = route.transfers
      ? ` · ${route.transfers} transfer${route.transfers > 1 ? 's' : ''}` : ''
    return `${mins} min${linesStr}${xferStr}`
  }

  const dist = route.distance == null ? '' : (
    route.distance < 1000
      ? `${Math.round(route.distance)} m`
      : `${(route.distance / 1000).toFixed(1)} km`
  )
  const verb = mode === 'bike' ? 'bike' : (mode === 'car' ? 'drive' : 'walk')
  return `${mins} min ${verb}${dist ? ' · ' + dist : ''}`
}

const TRAVEL_MODES = [
  { id: 'foot',    Icon: Footprints, label: 'Walk' },
  { id: 'bike',    Icon: Bike,       label: 'Bike' },
  { id: 'car',     Icon: Car,        label: 'Drive' },
  { id: 'transit', Icon: Train,      label: 'Transit' },
]

// -----------------------------------------------------------------------------
// Weather + time context (Open-Meteo)
// -----------------------------------------------------------------------------

// Fetch current weather from Open-Meteo (free, no API key). Pinned to Munich
// so the demo is reproducible regardless of where the user actually is.
// Returns { tempC, code, isDay, condition, label } or null on failure.
async function fetchWeather(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast`
    + `?latitude=${lat}&longitude=${lng}`
    + `&current=temperature_2m,weather_code,is_day`
    + `&timezone=Europe%2FBerlin`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const c = data?.current
    if (!c) return null
    const code = c.weather_code
    return {
      tempC: Math.round(c.temperature_2m),
      code,
      isDay: c.is_day === 1,
      condition: wmoToCondition(code),
      label: wmoToLabel(code),
    }
  } catch {
    return null
  }
}

// WMO weather codes → simple bucket the rest of the app reasons about.
function wmoToCondition(code) {
  if (code == null) return 'clear'
  if (code >= 95)                              return 'storm'
  if (code === 71 || code === 73 || code === 75 || code === 77
      || code === 85 || code === 86)           return 'snow'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if (code === 45 || code === 48)              return 'fog'
  if (code === 1 || code === 2 || code === 3)  return 'clouds'
  return 'clear'
}

// Human-readable label for the weather pill tooltip.
function wmoToLabel(code) {
  const map = {
    0:'Clear', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
    45:'Fog', 48:'Freezing fog',
    51:'Light drizzle', 53:'Drizzle', 55:'Heavy drizzle',
    61:'Light rain', 63:'Rain', 65:'Heavy rain',
    71:'Light snow', 73:'Snow', 75:'Heavy snow', 77:'Snow grains',
    80:'Light showers', 81:'Showers', 82:'Heavy showers',
    85:'Snow showers', 86:'Heavy snow showers',
    95:'Thunderstorm', 96:'Thunderstorm w/ hail', 99:'Thunderstorm w/ hail',
  }
  return map[code] || 'Clear'
}

function weatherIconFor(condition, isDay) {
  if (condition === 'rain')   return CloudRain
  if (condition === 'snow')   return CloudSnow
  if (condition === 'storm')  return CloudLightning
  if (condition === 'fog')    return CloudFog
  if (condition === 'clouds') return Cloud
  return isDay ? Sun : Moon
}

// Context-aware score multiplier: nudges saved-item ranking based on weather
// + time-of-day so the Map view "feels alive" — cafés in the morning, bars at
// night, museums when it rains, parks on sunny afternoons. Multipliers are
// gentle (typically 0.5–1.6) so the backend's CIA/CBR/JITIR ranking still
// drives the broad order — context only reorders within the top results.
function contextBoost(category, weather, hour) {
  let b = 1.0
  const indoor   = ['museum','cafe','restaurant','bar','shopping','accommodation','services'].includes(category)
  const isRain   = weather?.condition === 'rain' || weather?.condition === 'storm'
  const isSnow   = weather?.condition === 'snow'
  const isClear  = weather?.condition === 'clear' && weather?.isDay
  const isDark   = weather && !weather.isDay

  // Weather effects
  if (isRain || isSnow) {
    if (indoor)                  b *= 1.4
    if (category === 'park')     b *= 0.4
    if (category === 'attraction') b *= 0.7
  } else if (isClear) {
    if (category === 'park')       b *= 1.4
    if (category === 'attraction') b *= 1.2
  }
  if (isDark && category === 'park') b *= 0.5

  // Time-of-day effects
  if (hour >= 6 && hour < 11) {                    // morning
    if (category === 'cafe')       b *= 1.5
    if (category === 'bar')        b *= 0.3
    if (category === 'attraction') b *= 1.1
  } else if (hour >= 11 && hour < 14) {            // lunch
    if (category === 'restaurant') b *= 1.4
    if (category === 'bar')        b *= 0.5
  } else if (hour >= 14 && hour < 17) {            // afternoon
    if (category === 'museum')     b *= 1.3
    if (category === 'attraction') b *= 1.2
    if (category === 'shopping')   b *= 1.2
    if (category === 'bar')        b *= 0.6
  } else if (hour >= 17 && hour < 21) {            // evening
    if (category === 'restaurant') b *= 1.4
    if (category === 'bar')        b *= 1.2
    if (category === 'cafe')       b *= 0.7
  } else if (hour >= 21 || hour < 2) {             // night
    if (category === 'bar')        b *= 1.6
    if (category === 'restaurant') b *= 0.8
    if (category === 'museum')     b *= 0.3
    if (category === 'cafe')       b *= 0.5
    if (category === 'shopping')   b *= 0.4
  } else {                                         // late night 2–6
    if (category === 'bar')        b *= 1.1
    if (category === 'transport')  b *= 1.2
  }
  return b
}

// -----------------------------------------------------------------------------
// Proactive notification — composite-signal evaluator (W4 brief)
// -----------------------------------------------------------------------------

/**
 * Decide whether the top recommendation deserves a proactive banner.
 *
 * The banner follows the JITIR proactive paradigm (Section 3.3: background
 * query, proactive surfacing). The item's CIA activation score serves as the
 * strength signal (Section 6.3: CIA is strongest at action prediction).
 *
 * Approximates Sappelli et al.'s four evaluation criteria (Section 4) as
 * client-side signals:
 *   - context relevance  -> spatial proximity (Section 4.3)
 *   - document relevance -> category × time-of-day fit (Section 4.4)
 *   - action prediction  -> CIA score from backend (Section 4.5, 6.3)
 *   - diversity          -> low viewCount = under-surfaced item (Section 4.6)
 *
 * Domain note: paper studies desktop knowledge workers, we adapt to mobile
 * tourism re-finding. Spatial proximity replaces the paper's "document I am
 * currently writing" as the dominant context cue.
 *
 * Returns { reason, signals } or null. Reason codes are SHARED with the
 * backend explanation vocabulary (see explainer logic) so UI text stays
 * consistent across the banner, list explanations, and detail panel.
 *
 * @param {object} rec - { item, score, explanation } from /recommendations
 * @param {object} userLoc - { lat, lng }
 * @param {Date} now
 * @returns {{ reason: string, signals: string[] }|null}
 */
function evaluateProactiveSignal(rec, userLoc, now) {
  if (!rec || !rec.item) return null
  const item = rec.item
  const ciaScore = rec.score || 0

  // Signal 1: action prediction (paper §4.5). CIA must produce a non-trivial
  // activation. Threshold is the median of CIA scores observed empirically
  // on the seed dataset; tune if dataset characteristics change.
  const actionPredictionStrong = ciaScore >= 0.35
  if (!actionPredictionStrong) return null

  // Signal 2: context relevance via spatial proximity (paper §4.3).
  // 500m ≈ 6-7 min walking, the practical "I could go now" radius.
  const dist = item.lat && item.lng
    ? haversineMeters(userLoc.lat, userLoc.lng, item.lat, item.lng)
    : Infinity
  const contextRelevant = dist < 500
  const contextDistant  = dist > 800

  // Signal 3: document relevance proxied by category × time-of-day match (§4.4).
  // Maps tourism categories to opening-pattern hours.
  const hour = now.getHours()
  const cat = item.category
  const timeFit =
    (cat === 'restaurant' && ((hour >= 12 && hour < 14) || (hour >= 18 && hour < 22))) ||
    (cat === 'cafe'       && hour >= 7  && hour < 11) ||
    (cat === 'bar'        && hour >= 18) ||
    (cat === 'museum'     && hour >= 10 && hour < 17) ||
    (cat === 'park'       && hour >= 9  && hour < 19)

  // Signal 4: diversity / re-finding value (§4.6 + paper §1 Elsweiler et al.).
  // Items the user saved but rarely visited are exactly what re-finding
  // systems exist to surface.
  const views = item.viewCount || 0
  const daysSinceSaved = item.savedAt ? (now.getTime() - item.savedAt) / 86400000 : 0
  const daysSinceView  = item.lastViewedAt ? (now.getTime() - item.lastViewedAt) / 86400000 : 999
  const underSurfaced  = views <= 1
  const forgotten      = daysSinceView > 14
  const oldSave        = daysSinceSaved > 60

  // Compose firing patterns. Order matters — more specific patterns first.
  // Each pattern requires action_prediction (already gated above) PLUS at least
  // one other criterion firing, giving us a composite signal as the paper's
  // four-criterion framework recommends (Section 7).
  const signals = []
  if (contextRelevant) signals.push('proximity')
  if (timeFit)         signals.push('time_fit')
  if (underSurfaced)   signals.push('under_surfaced')
  if (forgotten)       signals.push('forgotten')

  // Fire only if action_prediction is joined by at least one more signal.
  // This is our composite-criterion gate.
  if (signals.length === 0) return null

  // Map composite signals to backend-vocabulary reason codes.
  let reason
  if (contextRelevant && views >= 2)              reason = 'nearby_frequent_view'
  else if (contextRelevant && underSurfaced)      reason = 'nearby_unvisited'
  else if (contextRelevant && timeFit)            reason = 'nearby_and_recent_save'
  else if (contextRelevant)                       reason = 'nearby_and_recent_save'
  else if (contextDistant && oldSave)             reason = 'saved_long_ago'
  else if (timeFit)                               reason = 'matches_weather_indoor'  // closest existing code
  else                                            reason = 'nearby_and_recent_save'

  return { reason, signals }
}

/**
 * Render text for a proactive banner. Reuses backend reason vocabulary so
 * the banner stays consistent with in-list explanations and detail panel.
 */
function proactiveBannerText(item, reason, signals) {
  const signalLine = signals && signals.length > 1
    ? `Matches ${signals.length} of your current context signals`
    : null

  if (reason === 'nearby_frequent_view') {
    return {
      title: `${item.name} is right here`,
      sub: signalLine || 'One of your most-viewed places',
    }
  }
  if (reason === 'nearby_unvisited') {
    return {
      title: `${item.name} is nearby`,
      sub: signalLine || "You saved this but haven't visited yet",
    }
  }
  if (reason === 'nearby_and_recent_save') {
    return {
      title: `${item.name} is nearby`,
      sub: signalLine || 'Worth a stop while you are here',
    }
  }
  if (reason === 'saved_long_ago') {
    return {
      title: `Still want to visit ${item.name}?`,
      sub: signalLine || 'Saved a long time ago. Time to revisit?',
    }
  }
  if (reason === 'matches_weather_indoor') {
    return {
      title: `${item.name} fits this time of day`,
      sub: signalLine || 'Typically open right now',
    }
  }
  return { title: item.name, sub: 'Recommended for this moment' }
}

// -----------------------------------------------------------------------------
// SwipeableRow — horizontal-swipe-to-dismiss, vertical scrolls naturally,
// pure tap (no movement past ~10px) fires onTap. Drag past ~100px dismisses.
// -----------------------------------------------------------------------------

function SwipeableRow({ onTap, onDismiss, children }) {
  const [tx, setTx] = useState(0)
  const [dismissing, setDismissing] = useState(false)
  const startRef = useRef({ x: 0, y: 0, locked: null, moved: false })

  function onPointerDown(e) {
    startRef.current = { x: e.clientX, y: e.clientY, locked: null, moved: false }
  }
  function onPointerMove(e) {
    // Desktop mouse should not trigger swipe — gesture is touch/pen only.
    if (e.pointerType === 'mouse') return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (startRef.current.locked === null) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        startRef.current.locked = 'h'
        e.currentTarget.setPointerCapture?.(e.pointerId)
      } else if (Math.abs(dy) > 10) {
        startRef.current.locked = 'v'   // let the list scroll naturally
      }
    }
    if (startRef.current.locked === 'h') {
      startRef.current.moved = true
      setTx(dx)
    }
  }
  function onPointerUp() {
    const lock = startRef.current.locked
    const moved = startRef.current.moved
    if (lock === 'h' && Math.abs(tx) > 100) {
      // swipe-dismiss: fling off the side, then notify parent
      setDismissing(true)
      setTx(tx > 0 ? 500 : -500)
      setTimeout(() => onDismiss?.(), 220)
    } else if (lock === 'h') {
      // snap back — drag wasn't far enough
      setTx(0)
    } else if (lock === null && !moved) {
      // pure tap (no horizontal lock, no movement) → fire tap
      onTap?.()
    }
    startRef.current = { x: 0, y: 0, locked: null, moved: false }
  }
  function onPointerCancel() {
    setTx(0)
    startRef.current = { x: 0, y: 0, locked: null, moved: false }
  }

  const opacity = dismissing ? 0 : Math.max(0.3, 1 - Math.abs(tx) / 280)
  return (
    <div
      className="wb-item wb-swipeable"
      style={{ transform: `translateX(${tx}px)`, opacity, transition: startRef.current.locked === 'h' && !dismissing ? 'none' : 'transform 0.22s, opacity 0.22s' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {children}
    </div>
  )
}

// -----------------------------------------------------------------------------
// NotesEditor — post-save description editing inside the detail panel.
// Kept as its own component so a key={item.id} at the call site remounts it on
// navigation, resetting the draft without an effect. Editing is gated by
// `enabled` (NOTES_EDIT_ENABLED): while off, the control is visibly disabled
// and nothing is written locally, so we never fake persistence ahead of the
// backend PATCH /saved-items/:id route.
// -----------------------------------------------------------------------------

function NotesEditor({ item, enabled, onUpdateNotes }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.notes || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const ok = await onUpdateNotes?.(item.id, draft)
    setSaving(false)
    if (ok) setEditing(false)
  }

  if (editing) {
    return (
      <div className="wb-notes-edit">
        <textarea
          className="wb-textarea"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="What do you want to remember this place as?"
          rows={3}
          autoFocus
        />
        <div className="wb-notes-edit-actions">
          <button className="wb-save-btn wb-notes-save" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save note'}
          </button>
          <button className="wb-notes-cancel" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="wb-notes-view">
      <p className="wb-detail-desc">{item.notes || 'No description yet.'}</p>
      <button
        className="wb-notes-edit-btn"
        onClick={() => { setDraft(item.notes || ''); setEditing(true) }}
        disabled={!enabled}
      >
        <Pencil size={14} /> {item.notes ? 'Edit note' : 'Add a note'}
      </button>
      {!enabled && (
        <span className="wb-notes-pending">Editing notes will be available once the sync ships.</span>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// DetailPanel — the "flipbook" view. Tapping a place opens this overlay.
// Swipe left/right (or use the chevrons) to flip between saved places.
// -----------------------------------------------------------------------------

function DetailPanel({ itemId, items, contextLabel, onClose, onNavigate, onDelete, onSwitch, userLoc, feedbackDone, onFeedback, beside, onUpdateNotes }) {
  const idx = items.findIndex(i => i.id === itemId)
  const item = items[idx]
  const [tx, setTx] = useState(0)
  const startRef = useRef({ x: 0, y: 0, locked: null })
  // During a horizontal drag the transform is written straight to the DOM via
  // pageRef inside one requestAnimationFrame per frame (dxRef holds the latest
  // delta), so the heavy panel subtree (ExplanationBreakdown) is not re-rendered
  // every frame. React state (tx) drives only the eased settle on release.
  const pageRef = useRef(null)
  const dxRef = useRef(0)
  const draggingRef = useRef(false)
  const rafRef = useRef(0)
  if (!item) return null

  const cat = CATEGORIES[item.category] || { label: item.category, Icon: MapPin, color: '#a0e6d4' }
  const CatIcon = cat.Icon

  function go(delta) {
    const next = idx + delta
    if (next >= 0 && next < items.length) onSwitch?.(items[next].id)
  }

  function onPointerDown(e) {
    startRef.current = { x: e.clientX, y: e.clientY, locked: null }
    dxRef.current = 0
  }
  function onPointerMove(e) {
    if (e.pointerType === 'mouse') return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (startRef.current.locked === null) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
        startRef.current.locked = 'h'
        e.currentTarget.setPointerCapture?.(e.pointerId)
      } else if (Math.abs(dy) > 12) {
        startRef.current.locked = 'v'
      }
    }
    if (startRef.current.locked === 'h') {
      dxRef.current = dx
      if (!draggingRef.current) {
        draggingRef.current = true
        pageRef.current?.classList.add('wb-dragging')   // transition: none while tracking
      }
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0
          if (pageRef.current) pageRef.current.style.transform = `translateX(${dxRef.current}px)`
        })
      }
    }
  }
  function onPointerUp() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    draggingRef.current = false
    pageRef.current?.classList.remove('wb-dragging')    // restore transition for the settle
    const dx = dxRef.current
    if (startRef.current.locked === 'h' && Math.abs(dx) > 80) {
      const delta = dx < 0 ? 1 : -1
      setTx(dx < 0 ? -400 : 400)
      setTimeout(() => { go(delta); setTx(0) }, 180)
    } else {
      setTx(0)
    }
    dxRef.current = 0
    startRef.current = { x: 0, y: 0, locked: null }
  }

  const isFirst = idx <= 0
  const isLast = idx >= items.length - 1
  const distance = Math.round(haversineMeters(
    userLoc.lat, userLoc.lng, item.lat, item.lng
  ))

  return (
    <div className={`wb-detail${beside ? ' wb-detail--beside' : ''}`} role="dialog" aria-modal="true" aria-label={item.name}>
      <button className="wb-detail-close" onClick={onClose} aria-label="Close">
        <X size={20} />
      </button>

      <div
        ref={pageRef}
        className="wb-detail-page"
        style={{ transform: `translateX(${draggingRef.current ? dxRef.current : tx}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="wb-detail-hero">
          {/* Bug 8: small breadcrumb showing which slice the arrows walk
              through, so the user can tell "I came from For this moment". */}
          {contextLabel && (
            <div className="wb-detail-crumb" aria-label="Navigation context">
              From: {contextLabel}
            </div>
          )}
          <div className="wb-detail-cat">
            <CatIcon size={14} /> {cat.label}
          </div>
          <h2 className="wb-detail-name">{item.name}</h2>
          <div className="wb-detail-address">{item.address || ''}</div>
        </div>

        <div className="wb-detail-body">
          {/* Paper §3: ticket-type items show an event countdown above the description */}
          {item.itemType === 'ticket' && (
            <TicketCountdown eventDatetime={item.eventDatetime} />
          )}
          {/* Notes / personal cue. Editable after saving via PATCH /saved-items/:id
              (parent onUpdateNotes). key={item.id} remounts the editor on
              navigation so a half-typed draft never leaks across places. */}
          <NotesEditor key={item.id} item={item} enabled={NOTES_EDIT_ENABLED} onUpdateNotes={onUpdateNotes} />

          {/* Paper §3: tags surface user-chosen labels (e.g. "rooftop", "rainy day")
              in the detail panel. Backend may return tags as a comma-separated
              string OR as an array — handle both shapes. The saved-list search
              bar already matches tags as one of its fields. */}
          {(() => {
            const raw = item.tags
            let tags = []
            if (Array.isArray(raw)) {
              tags = raw.map(t => String(t).trim()).filter(Boolean)
            } else if (typeof raw === 'string') {
              tags = raw.split(',').map(t => t.trim()).filter(Boolean)
            }
            if (tags.length === 0) return null
            return (
              <div className="wb-detail-tags" aria-label="Tags">
                {tags.map((tag, i) => (
                  <span key={i} className="wb-detail-tag">#{tag}</span>
                ))}
              </div>
            )
          })()}

          <div className="wb-detail-stats">
            <div className="wb-stat">
              <div className="wb-stat-label">Distance</div>
              <div className="wb-stat-val">{formatDistance(distance)}</div>
            </div>
            <div className="wb-stat">
              <div className="wb-stat-label">Saved</div>
              <div className="wb-stat-val">{timeAgo(item.savedAt)}</div>
            </div>
            <div className="wb-stat">
              <div className="wb-stat-label">Views</div>
              <div className="wb-stat-val">{item.viewCount}</div>
            </div>
          </div>

          <ExplanationBreakdown item={item} userLoc={userLoc} />

          {/* Feedback on this recommendation (POST /feedback). The score row
              and explanation above are the raw inputs; this captures whether
              the suggestion landed, feeding the offline evaluation. One
              surface only: the detail panel, never list rows or the banner. */}
          <div className="wb-feedback">
            {feedbackDone ? (
              <div className="wb-feedback-done">Noted. This feeds our evaluation.</div>
            ) : (
              <>
                <span className="wb-feedback-q">Was this useful right now?</span>
                <div className="wb-feedback-btns">
                  <button
                    type="button"
                    className="wb-feedback-btn"
                    aria-label="Useful"
                    onClick={() => onFeedback(item.id, true)}
                  >
                    <ThumbsUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="wb-feedback-btn"
                    aria-label="Not useful"
                    onClick={() => onFeedback(item.id, false)}
                  >
                    <ThumbsDown size={16} />
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="wb-detail-actions">
            <button className="wb-detail-primary" onClick={() => onNavigate(item)}>
              <Navigation size={18} /> Directions
            </button>
            <button className="wb-detail-secondary" onClick={() => onDelete(item.id)} aria-label="Delete">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      <button className="wb-detail-arrow left" onClick={() => go(-1)} disabled={isFirst} aria-label="Previous">
        <ChevronLeft size={22} />
      </button>
      <button className="wb-detail-arrow right" onClick={() => go(1)} disabled={isLast} aria-label="Next">
        <ChevronRight size={22} />
      </button>

      <div className="wb-detail-dots">
        {idx + 1} / {items.length}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------

export default function MapPage() {
  // ---- state -----------------------------------------------------------------
  const [mode, setMode] = useState('map')              // map | saved | add
  const [method, setMethod] = useState('jitir')
  // Item ids the user has rated via the detail-panel feedback control this
  // session. Reopening a rated item shows the confirmation, not the buttons.
  // Session-only by design: no localStorage, so a fresh load lets re-rating.
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(() => new Set())
  // Paper §3 — saved-item ordering: recency, frequency, alpha, proximity.
  // Sort is applied AFTER category/search/type filters in listToShow().
  const [activeSort, setActiveSort] = useState('recent')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const sortDropdownRef = useRef(null)
  // Open/close state for the "More" category overflow dropdown next to the
  // pill row (Bug 2 — Bars, Hotels, Shopping, Services, Transport).
  // FIX 4: the menu is rendered through a portal so it isn't clipped by
  // the .wb-pills horizontal-scroll container's overflow. moreTriggerRect
  // captures the trigger's bounding rect at open time for anchoring.
  const [moreOpen, setMoreOpen] = useState(false)
  const moreDropdownRef = useRef(null)
  const moreTriggerRef = useRef(null)
  const moreMenuRef = useRef(null)
  const [moreTriggerRect, setMoreTriggerRect] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  // Paper §3 — second-tier filter by saved-item type (bookmark/ticket/map_pin/note).
  // null = "All Types"; only surfaced in Saved view to keep Map view uncluttered.
  const [activeType, setActiveType] = useState(null)

  const [savedItems, setSavedItems] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [userLoc, setUserLoc] = useState({ lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] })
  const [newPin, setNewPin] = useState(null)           // { lat, lng } while in add mode
  const [newPlace, setNewPlace] = useState({ name: '', category: '', notes: '', address: '', itemType: '' })
  const [placeQuery, setPlaceQuery] = useState('')     // Photon search box text
  const [placeResults, setPlaceResults] = useState([]) // Photon GeoJSON features
  const [placeSearching, setPlaceSearching] = useState(false)
  const placeReqRef = useRef(0)                         // guards against stale responses

  // Saved-search escape hatch. The search box always searches the saved pool
  // first (placeholder unchanged). When that returns nothing, an explicit
  // "Search the map" action runs Photon once for the current query (never on
  // keystroke). mapSearchQuery holds the query those results belong to.
  const [mapSearchQuery, setMapSearchQuery] = useState(null)
  const [mapSearchResults, setMapSearchResults] = useState([])
  const [mapSearchLoading, setMapSearchLoading] = useState(false)

  // In-flight guard shared by every save path (pin-drop + both Photon paths).
  // A save POST takes a moment; without this the Save control stays live and
  // rapid taps fire duplicate POSTs (observed: 6x CinemaxX, 9x Pinakotheken).
  // It disables the control and drives the pending label until the POST settles.
  const [saving, setSaving] = useState(false)

  const [detailItemId, setDetailItemId] = useState(null)   // open detail panel for this item
  // Bug 8: which slice of items the detail panel's left/right arrows walk
  // through. Set at openDetail call time from whichever list the user tapped
  // in (e.g. "For this moment", "Saved"). null falls back to all saved items
  // (deep-link / marker tap behavior).
  const [detailContext, setDetailContext] = useState(null) // { ids: string[], label: string } | null
  const [dismissed, setDismissed] = useState(new Set())    // hide from Map view (not Saved)
  const [navTarget, setNavTarget] = useState(null)         // active route destination
  const [routesByMode, setRoutesByMode] = useState({})     // { foot, bike, car, transit } each → route|null
  const [routeLoading, setRouteLoading] = useState(false)  // true while ANY mode is still pending
  const [travelMode, setTravelMode] = useState('foot')     // 'foot' | 'bike' | 'car' | 'transit'

  // Live context: real Munich weather (Open-Meteo) + ticking clock.
  // Both feed into the contextBoost() multiplier that re-ranks recs.
  const [weather, setWeather] = useState(null)             // { tempC, code, isDay, condition, label } | null
  const [currentTime, setCurrentTime] = useState(new Date())

  // FIX 3: track the current theme so we can swap the Leaflet TileLayer
  // between Positron (light) and Dark Matter (dark). The attribute is set
  // by ThemeToggle / main.jsx; we observe data-theme on <html> so the map
  // re-renders without prop drilling.
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light'
  )
  useEffect(() => {
    const html = document.documentElement
    const observer = new MutationObserver(() => {
      setTheme(html.getAttribute('data-theme') || 'light')
    })
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  // Compare-methods view in the Saved tab (W4 demo feature; paper §5)
  const [compareMode, setCompareMode] = useState(false)

  // Proactive notification (W4 project brief: "proactively recommend ... based on current situation").
  // Follows the JITIR proactive paradigm (paper Section 3.3: background query,
  // proactive surfacing). The top item's CIA activation score is the strength
  // signal (paper Section 6.3: CIA is strongest at action prediction).
  const [proactiveAlert, setProactiveAlert] = useState(null)  // { item, reason, score, signals } or null
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('wb_dismissed_alerts') || '[]')) }
    catch { return new Set() }
  })
  // Banner cooldown. A dismissal is about the moment, not the item: it silences
  // the whole banner channel until the moment passes. We stash { at, loc } here
  // and the polling effect skips evaluation until 45 min elapse OR the user
  // moves more than 500 m from where they dismissed. Session-scoped on purpose:
  // a ref, never persisted, so a fresh load starts the channel open again.
  const bannerCooldownRef = useRef(null)  // { at: Date, loc: { lat, lng } } | null

  const [toast, setToast] = useState(null)
  const [centerTrigger, setCenterTrigger] = useState(0)
  const [geoActive, setGeoActive] = useState(false)
  const watchIdRef = useRef(null)
  const recenterOnNextFixRef = useRef(false)
  const handledHashRef = useRef(null)

  // ---- sheet drag ------------------------------------------------------------
  const sheetRef = useRef(null)
  const fabsRef = useRef(null)
  // FIX 2: theme toggle lives at bottom-left now and needs to track the sheet
  // the same way the right-side FAB cluster does.
  const themeRef = useRef(null)
  const dragRef = useRef({ startY: 0, startOffset: 200, dragging: false, snap: 200 })
  // Mirror of dragRef.snap into React state — needed because the bottom-sheet
  // body has to disappear at the floor (Bug 3), and dragRef alone cannot
  // trigger re-renders. Updated in applyOffset() below.
  const [snapPx, setSnapPx] = useState(200)

  // ---- responsive layout -----------------------------------------------------
  // Desktop split layout kicks in at 900px (DESIGN.md Spatial Principles).
  // Everything below 900px stays byte-identical to the mobile-first build; the
  // desktop layer is this single flag plus @media (min-width: 900px) CSS. The
  // sheet drag machinery (applyOffset, pointer handlers) is bypassed on desktop
  // so its inline transforms can never leak into the sidebar layout.
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const onChange = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // When arriving from another route (e.g. TripPage tapping the Saved or Add
  // tab), honor `?mode=` so the tab the user pressed actually opens.
  const location = useLocation()
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const next = params.get('mode')
    if (next === 'saved' || next === 'add') changeMode(next)
    // Plan is a desktop-only in-panel mode (mobile keeps the /trip route, which
    // is why TripPage redirects here as ?mode=plan on desktop). Ignored on
    // mobile so a stray ?mode=plan there just lands on the map.
    if (next === 'plan' && isDesktop) changeMode('plan')
    // Intentionally only on first mount — subsequent changes use changeMode().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When arriving from the day plan via /#item-<id>, open that place's detail
  // once saved items have loaded. Guard with handledHashRef so this runs once
  // per hash: openDetail bumps savedItems (a dependency here) and the
  // replaceState below does not update react-router's location, so without
  // the guard the effect would re-fire and loop until React throws.
  useEffect(() => {
    if (!savedItems || savedItems.length === 0) return
    const hash = location.hash
    if (handledHashRef.current === hash) return
    const m = hash.match(/^#item-(.+)$/)
    if (!m) return
    const found = savedItems.find(it => String(it.id) === m[1])
    if (found) {
      handledHashRef.current = hash
      // From the day plan (TripItinerary), the tapped Link carries the
      // itinerary's stops as router state, so the detail's arrows + pagination
      // scope to the plan. Other deep links carry no state and fall back to the
      // full saved pool (ctx undefined leaves detailContext untouched).
      openDetail(found.id, location.state?.planContext)
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedItems, location.hash])

  // ---- initial data + geolocation -------------------------------------------
  useEffect(() => {
    // Geolocation is opt-in via the Locate FAB (see handleLocate), not
    // requested on load. Hauptbahnhof stays the default frame of reference
    // until the user turns location on.
    fetchSaved()
  }, []) // eslint-disable-line

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

  // Photon place search for the Add flow. Debounced 300 ms, min 3 chars, biased
  // to userLoc. A request counter discards any response that arrives after a
  // newer query has already been issued.
  useEffect(() => {
    const q = placeQuery.trim()
    if (q.length < 3) { setPlaceResults([]); setPlaceSearching(false); return }
    setPlaceSearching(true)
    const reqId = ++placeReqRef.current
    const t = setTimeout(async () => {
      try {
        const features = await fetchPhoton(q, userLoc.lat, userLoc.lng)
        if (placeReqRef.current !== reqId) return
        setPlaceResults(features)
      } catch {
        if (placeReqRef.current === reqId) setPlaceResults([])
      } finally {
        if (placeReqRef.current === reqId) setPlaceSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [placeQuery, userLoc.lat, userLoc.lng])

  // When directions panel opens/closes, resize the bottom sheet:
  // expand to show the full nav panel, restore to peek state when closed.
  useEffect(() => {
    if (navTarget) {
      applyOffset(Math.min(520, window.innerHeight - 100))
    } else if (mode === 'map') {
      applyOffset(SNAP_PEEK)
    }
    // eslint-disable-next-line
  }, [navTarget])

  // refetch recommendations whenever method, location, or weather changes
  useEffect(() => { fetchRecs() }, [method, userLoc.lat, userLoc.lng, weather?.condition]) // eslint-disable-line

  // Live Munich weather from Open-Meteo, refreshed every 15 min.
  useEffect(() => {
    let cancelled = false
    const load = () => fetchWeather(DEFAULT_CENTER[0], DEFAULT_CENTER[1])
      .then(w => { if (!cancelled) setWeather(w) })
    load()
    const id = setInterval(load, 15 * 60 * 1000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Ticking clock — updates every 60 s so the time pill stays accurate
  // and the contextBoost() recomputes when crossing an hour boundary.
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Sort dropdown — close on outside click / Escape.
  useEffect(() => {
    if (!sortMenuOpen) return
    function onDocClick(e) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) {
        setSortMenuOpen(false)
      }
    }
    function onKey(e) { if (e.key === 'Escape') setSortMenuOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [sortMenuOpen])

  // "More" category dropdown — close on outside click / Escape.
  // FIX 4: the menu is portaled to <body>, so we have to whitelist BOTH the
  // wrap (which holds the trigger) AND the portaled menu node when deciding
  // whether a click counts as "outside".
  useEffect(() => {
    if (!moreOpen) return
    function onDocClick(e) {
      const inWrap = moreDropdownRef.current?.contains(e.target)
      const inMenu = moreMenuRef.current?.contains(e.target)
      if (!inWrap && !inMenu) setMoreOpen(false)
    }
    function onKey(e) { if (e.key === 'Escape') setMoreOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  // FIX 4: capture the trigger's bounding rect when the menu opens so the
  // portaled menu can anchor itself. Reposition on resize so the menu stays
  // glued to the trigger if the viewport shifts.
  useEffect(() => {
    if (!moreOpen) return
    const measure = () => {
      const el = moreTriggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setMoreTriggerRect({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [moreOpen])

  // When a destination is selected, fetch routes for ALL four modes in
  // parallel so the mode-selector tabs can show comparative times upfront.
  useEffect(() => {
    if (!navTarget) { setRoutesByMode({}); setRouteLoading(false); return }
    let cancelled = false
    setRoutesByMode({})
    setRouteLoading(true)
    const modes = ['foot', 'bike', 'car', 'transit']
    let remaining = modes.length
    for (const mode of modes) {
      fetchRoute(
        { lat: userLoc.lat, lng: userLoc.lng },
        { lat: navTarget.lat, lng: navTarget.lng },
        mode,
      ).then(route => {
        if (cancelled) return
        setRoutesByMode(prev => ({ ...prev, [mode]: route }))
        if (--remaining === 0) setRouteLoading(false)
      })
    }
    return () => { cancelled = true }
  }, [navTarget, userLoc.lat, userLoc.lng])

  // Derived: the route data for the currently-selected travel mode.
  const routeData = routesByMode[travelMode] ?? null

  // Derived: are we ranking around the Hauptbahnhof fallback rather than a real
  // fix? True when live geolocation is off AND userLoc still sits at the demo
  // default. Drives the quiet location-source notice atop the list.
  const usingFallbackLoc =
    !geoActive &&
    userLoc.lat === DEFAULT_CENTER[0] &&
    userLoc.lng === DEFAULT_CENTER[1]

  // Annotate Photon features with their distance from userLoc and sort
  // nearest-first, so both the Add flow and the search escape hatch render the
  // same shape. Photon geometry is [lng, lat] (see pickPlaceResult). Features
  // missing coordinates get a null distance and sort to the end.
  function photonRowsByDistance(features) {
    return (features || [])
      .map(feature => {
        const c = feature.geometry?.coordinates || []
        const distM = (c[0] != null && c[1] != null)
          ? haversineMeters(userLoc.lat, userLoc.lng, c[1], c[0])
          : null
        return { feature, distM }
      })
      .sort((a, b) => (a.distM ?? Infinity) - (b.distM ?? Infinity))
  }

  // Proactive notification polling (W4 project brief requirement).
  // Calls the existing /recommendations endpoint with method=cia every 30s and
  // evaluates whether the top-ranked item satisfies the composite signal gate
  // defined by evaluateProactiveSignal() above. This follows the JITIR proactive
  // paradigm (paper §3.3: background query, proactive surfacing); the CIA
  // activation score is the strength signal (paper §6.3: CIA is strongest at
  // action prediction).
  useEffect(() => {
    let cancelled = false

    async function evaluate() {
      try {
        const now = new Date()
        // Banner cooldown gate. A dismissal silences the channel as a whole, so
        // skip evaluation entirely until 45 min pass OR the user moves more than
        // 500 m from where they dismissed. Either condition lifts the cooldown.
        const cd = bannerCooldownRef.current
        if (cd) {
          const elapsedMs = now - cd.at
          const movedM = haversineMeters(userLoc.lat, userLoc.lng, cd.loc.lat, cd.loc.lng)
          if (elapsedMs < 45 * 60_000 && movedM <= 500) return
          bannerCooldownRef.current = null
        }

        const params = new URLSearchParams({
          userId: USER_ID,
          lat: userLoc.lat,
          lng: userLoc.lng,
          method: 'cia',
        })
        const res = await fetch(`${API}/recommendations?${params}`)
        const data = await res.json()
        if (cancelled || !Array.isArray(data) || data.length === 0) {
          setProactiveAlert(null)
          return
        }

        // Walk the ranked list — first item that satisfies the composite gate
        // AND is not in the user's dismissed set wins the banner slot.
        for (const rec of data) {
          if (dismissedAlerts.has(rec.item.id)) continue
          const result = evaluateProactiveSignal(rec, userLoc, now)
          if (result) {
            setProactiveAlert({
              item: rec.item,
              reason: result.reason,
              score: rec.score,
              signals: result.signals,
            })
            return
          }
        }
        setProactiveAlert(null)
      } catch {
        setProactiveAlert(null)  // network failure — clear stale alert
      }
    }

    evaluate()
    const id = setInterval(evaluate, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [savedItems, userLoc.lat, userLoc.lng, dismissedAlerts])

  async function fetchSaved() {
    try {
      const res = await fetch(`${API}/saved-items?userId=${USER_ID}`)
      const data = await res.json()
      setSavedItems(data)
    } catch { showToast('Backend not reachable') }
  }
  async function fetchRecs() {
    try {
      const params = new URLSearchParams({
        userId: USER_ID, lat: userLoc.lat, lng: userLoc.lng, method,
      })
      // Pass real weather to backend — pick_reason() already uses 'rain';
      // the recommender methods receive it in context too.
      if (weather?.condition && weather.condition !== 'clear' && weather.condition !== 'clouds') {
        params.set('weather', weather.condition)
      }
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

  // POST /feedback for the open item. Body matches the backend handler:
  // itemId as integer, method uppercased (the handler stores it raw and the
  // stats endpoint groups on its uppercase form), context snapshot inline.
  // On success the id joins feedbackSubmitted so the panel swaps to its
  // confirmation; on failure the buttons stay usable and a toast explains.
  async function submitFeedback(itemId, useful) {
    try {
      const res = await fetch(`${API}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID,
          itemId: Number(itemId),
          useful,
          method: method.toUpperCase(),
          contextSnapshot: { lat: userLoc.lat, lng: userLoc.lng, time: Date.now() },
        }),
      })
      if (!res.ok) throw new Error('feedback rejected')
      setFeedbackSubmitted(prev => new Set(prev).add(itemId))
    } catch {
      showToast('Could not send feedback')
    }
  }

  // ---- mode transitions -----------------------------------------------------
  function changeMode(next) {
    if (next === mode) return
    if (next === 'add') {
      setNewPin({ lat: userLoc.lat, lng: userLoc.lng })
      setNewPlace({ name: '', category: '', notes: '', address: '', itemType: '' })
      setPlaceQuery('')
      setPlaceResults([])
    } else {
      setNewPin(null)
    }
    setMode(next)
    if (next === 'map')   applyOffset(SNAP_PEEK)
    // Saved view: leave ~190px at the top so the search bar + category pills
    // (+ type chips for Feature 5) stay visible above the sheet. User can
    // still drag the sheet up to full-screen if they want.
    if (next === 'saved') applyOffset(Math.max(SNAP_PEEK, window.innerHeight - 240))
  }

  // ---- pill click ------------------------------------------------------------
  // Paper §3 — category is the dominant re-finding cue for tourism items;
  // making the pill row a real filter (not just a visual) so it cuts both
  // the bottom-sheet list AND the map markers down to the picked category.
  function pickPill(key) {
    if (key === 'more') { setMoreOpen(o => !o); return }
    // Tapping the same active pill toggles back to "all".
    setFilter(prev => (prev === key && key !== 'all') ? 'all' : key)
    setMoreOpen(false)
  }

  // ---- save / delete --------------------------------------------------------
  async function saveNewPlace() {
    if (!newPlace.name.trim()) { showToast('Add a name first'); return }
    if (saving) return
    setSaving(true)
    try {
      const body = {
        userId: USER_ID,
        name: newPlace.name.trim(),
        category: newPlace.category || 'attraction',
        notes: newPlace.notes,
        lat: newPin.lat,
        lng: newPin.lng,
        address: newPlace.address || '',
      }
      // Photon-sourced picks carry an itemType; pin-drop saves omit it so the
      // backend default applies, matching the previous behavior.
      if (newPlace.itemType) body.itemType = newPlace.itemType
      const res = await fetch(`${API}/saved-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      await fetchSaved(); fetchRecs()
      showToast(`Saved · ${newPlace.name.trim()}`)
      changeMode('map')
    } catch { showToast('Save failed. Is the backend running?') }
    finally { setSaving(false) }
  }

  // Photon result tap: prefill the shared Add form (name, category, coords,
  // address, itemType) so the user can review and edit before saving, instead
  // of saving immediately. The existing Save button (saveNewPlace) does the one
  // POST. Coordinate order matters: Photon geometry is [lng, lat], so lat is
  // coordinates[1] and lng is coordinates[0].
  function pickPlaceResult(feature) {
    const p = feature.properties || {}
    const coords = feature.geometry?.coordinates || []
    const lng = coords[0]
    const lat = coords[1]
    if (lat == null || lng == null) { showToast('Could not read that place'); return }
    // Flag a duplicate now, at form-fill time, rather than only at Save. Covers
    // the race where the pool changed after the results rendered.
    if (featureMatchesSaved(feature, savedItems)) { showToast('Already in your places'); return }
    const streetLine = [p.street, p.housenumber].filter(Boolean).join(' ')
    const name = p.name || streetLine || 'Unnamed place'
    const address = [streetLine, [p.postcode, p.city].filter(Boolean).join(' '), p.country].filter(Boolean).join(', ')
    const category = osmToCategory(p.osm_key, p.osm_value)
    // Prefill the shared form and drop the pin at the result; the user reviews,
    // can tweak any field, then taps Save.
    setNewPin({ lat, lng })
    setNewPlace({ name, category, notes: '', address, itemType: 'map_pin' })
    // Clear the search so the prefilled form is what's visible.
    setPlaceQuery('')
    setPlaceResults([])
  }

  // Escape hatch: the saved-pool search found nothing, so run Photon once for
  // the current query. Fires only on the explicit tap, never on keystroke.
  async function runMapSearch() {
    const q = search.trim()
    if (!q) return
    setMapSearchQuery(q)
    setMapSearchLoading(true)
    try {
      setMapSearchResults(await fetchPhoton(q, userLoc.lat, userLoc.lng))
    } catch {
      setMapSearchResults([])
    } finally {
      setMapSearchLoading(false)
    }
  }

  // Save a Photon result from the escape hatch. Same POST shape as the Add
  // flow's pickPlaceResult, but instead of switching to Add mode it returns the
  // search to normal saved-pool mode, with the saved pool now holding the item.
  async function saveMapResult(feature) {
    const p = feature.properties || {}
    const coords = feature.geometry?.coordinates || []
    const lng = coords[0]
    const lat = coords[1]
    if (lat == null || lng == null) { showToast('Could not read that place'); return }
    // Second layer over the disabled row state, covering the race where the
    // pool changed after the results rendered.
    if (featureMatchesSaved(feature, savedItems)) { showToast('Already in your places'); return }
    if (saving) return
    setSaving(true)
    const streetLine = [p.street, p.housenumber].filter(Boolean).join(' ')
    const name = p.name || streetLine || 'Unnamed place'
    const address = [streetLine, [p.postcode, p.city].filter(Boolean).join(' '), p.country].filter(Boolean).join(', ')
    const category = osmToCategory(p.osm_key, p.osm_value)
    try {
      const res = await fetch(`${API}/saved-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID, name, category, notes: '', lat, lng, address, itemType: 'map_pin',
        }),
      })
      if (!res.ok) throw new Error()
      await fetchSaved(); fetchRecs()
      showToast(`Saved · ${name}`)
      // Back to normal saved-pool mode. Clearing the query shows the full pool,
      // which now includes the place just saved.
      setMapSearchQuery(null)
      setMapSearchResults([])
      setSearch('')
    } catch { showToast('Save failed. Is the backend running?') }
    finally { setSaving(false) }
  }

  async function deleteItem(id) {
    setSavedItems(prev => prev.filter(i => i.id !== id))   // optimistic
    try {
      await fetch(`${API}/saved-items/${id}`, { method: 'DELETE' })
      showToast('Removed')
      fetchRecs()
    } catch {
      showToast('Delete failed. Restoring.')
      fetchSaved()
    }
  }

  // Persist an edited note. PATCH /saved-items/:id is not live yet (contract
  // sent to Sway); NOTES_EDIT_ENABLED gates the UI so this stays dormant until
  // it ships. On success we replace the local item with the server's returned
  // copy, never a local guess, so persistence is real and not faked. Returns
  // true only when the write actually landed so the editor closes only then.
  async function updateNotes(id, notes) {
    try {
      const res = await fetch(`${API}/saved-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const updated = await res.json()
      setSavedItems(prev => prev.map(it => (it.id === id ? { ...it, ...updated } : it)))
      showToast('Note saved')
      return true
    } catch {
      showToast('Could not save note')
      return false
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

  // ---- detail panel (the "flipbook" view) ------------------------------------
  // Tapping a place opens this; it also fires GET /saved-items/:id which the
  // backend uses to increment viewCount + lastViewedAt (feeds the CIA model).
  //
  // Bug 7: the GET was returning a stale value on quick re-opens because the
  // saved-items list in state wasn't being refreshed. We now optimistically
  // bump the local viewCount AND fire a dedicated POST /items/:id/view in
  // parallel so the next backend GET reflects the new count immediately.
  //
  // Bug 8: openDetail accepts an optional context describing which slice of
  // items the arrow navigation should walk through (e.g. "For this moment").
  // Calls from onSwitch (already inside the panel) omit ctx to preserve the
  // existing context.
  async function openDetail(itemId, ctx) {
    setDetailItemId(itemId)
    if (ctx !== undefined) setDetailContext(ctx)

    // Optimistic local bump so the detail panel reflects the new view count
    // on first paint, regardless of whether the backend write lands.
    setSavedItems(prev => prev.map(it => (
      it.id === itemId
        ? { ...it, viewCount: (it.viewCount || 0) + 1, lastViewedAt: Date.now() }
        : it
    )))

    // TODO: backend needs POST /items/:id/view endpoint — coordinate with Sway.
    // Fire-and-forget; we don't await it so render isn't blocked.
    try { fetch(`${API}/items/${itemId}/view`, { method: 'POST' }) } catch { /* fire-and-forget */ }

    // The existing GET is what the current backend uses to increment the
    // counter. Cache-bust query + no-store so the next read of this item
    // reflects the increment instead of a cached value.
    try {
      await fetch(`${API}/saved-items/${itemId}?_=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
    } catch { /* network failure is non-fatal; optimistic bump already shown */ }
  }

  // ---- swipe-to-dismiss on recommendations -----------------------------------
  // Removes the rec from the current Map view only. The place stays in Saved.
  function dismissRec(itemId) {
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(itemId)
      return next
    })
  }

  // Dismissal is about the moment, not the item. Opening the cooldown silences
  // the whole banner channel (see the polling effect's 45 min / 500 m gate); the
  // dismissed item still goes into dismissedAlerts as a second layer so it stays
  // skipped even after the cooldown lifts.
  function dismissProactiveAlert() {
    if (!proactiveAlert) return
    bannerCooldownRef.current = { at: new Date(), loc: userLoc }
    const id = proactiveAlert.item.id
    setDismissedAlerts(prev => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem('wb_dismissed_alerts', JSON.stringify([...next])) } catch {}
      return next
    })
    setProactiveAlert(null)
  }

  // ---- directions FAB --------------------------------------------------------
  // Toggles a polyline from userLoc to the top recommendation (or clears it).
  function toggleDirections() {
    if (navTarget) { setNavTarget(null); return }
    const list = listToShow()
    if (list.length === 0) { showToast('Nothing nearby to navigate to'); return }
    setNavTarget(list[0].item)
  }

  // Locate FAB: opt-in live geolocation. First tap starts watchPosition and
  // recenters on the first fix; later taps just recenter on the current
  // position. Permission denial or any error falls back to Hauptbahnhof.
  // userLoc drives both the "you are here" marker and proximity ranking, so
  // updates flow into fetchRecs automatically. A 50 m threshold keeps GPS
  // jitter from spamming the backend while the user stands still.
  function handleLocate() {
    if (!('geolocation' in navigator)) {
      showToast('Geolocation is not available')
      return
    }
    if (watchIdRef.current != null) {
      setCenterTrigger(t => t + 1)
      return
    }
    recenterOnNextFixRef.current = true
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        if (recenterOnNextFixRef.current) {
          recenterOnNextFixRef.current = false
          setUserLoc(next)
          setGeoActive(true)
          setCenterTrigger(t => t + 1)
        } else {
          setUserLoc(prev =>
            haversineMeters(prev.lat, prev.lng, next.lat, next.lng) > 50 ? next : prev
          )
        }
      },
      () => {
        showToast('Location unavailable, using Hauptbahnhof')
        if (watchIdRef.current != null) {
          navigator.geolocation.clearWatch(watchIdRef.current)
          watchIdRef.current = null
        }
        recenterOnNextFixRef.current = false
        setGeoActive(false)
        setUserLoc({ lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] })
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    )
  }

  // ---- derived: what the sheet's list shows ---------------------------------
  function listToShow() {
    const q = search.trim().toLowerCase()
    const filterFn = item => {
      // Paper §3 — re-finding search: match across name, notes, and tags.
      // Tags may be a string or an array depending on backend shape.
      if (q) {
        const tagText = Array.isArray(item.tags) ? item.tags.join(' ') : (item.tags || '')
        const hay = `${item.name} ${item.notes || ''} ${tagText}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      // Paper §3 — category filter applies in both Map and Saved views so
      // the pill choice carries through when switching between them.
      if (filter !== 'all' && item.category !== filter) return false
      // Paper §3 — saved-item-type filter (second-tier; only set in Saved view).
      if (activeType && item.itemType !== activeType) return false
      return true
    }

    if (mode === 'map') {
      // Use server-ranked recommendations; fall back to all saved if recs not yet loaded.
      // Filter out items the user has swiped away from the Map view (still in Saved).
      const baseRecs = recommendations.length
        ? recommendations
        : savedItems.map(it => ({ item: it, score: 0.5, explanation: {} }))
      const hour = currentTime.getHours()
      return baseRecs
        .filter(r => !dismissed.has(r.item.id) && filterFn(r.item))
        .map(r => ({
          ...r,
          contextScore: (r.score ?? 0.5) * contextBoost(r.item.category, weather, hour),
        }))
        .sort((a, b) => b.contextScore - a.contextScore)
    } else {
      // Saved mode: locally sorted full list (ignores dismissed — it's a different view).
      // Paper §3: saved-item ordering — recency, frequency, alpha, proximity.
      // Sort applied after category/search/type filters.
      const items = [...savedItems].filter(filterFn)
      // 'distance' requires a known user location; otherwise fall back to recency.
      const effectiveSort = (activeSort === 'distance' && !userLoc) ? 'recent' : activeSort
      if (effectiveSort === 'recent') items.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
      if (effectiveSort === 'views')  items.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
      if (effectiveSort === 'abc')    items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      if (effectiveSort === 'distance') {
        items.sort((a, b) =>
          haversineMeters(userLoc.lat, userLoc.lng, a.lat, a.lng) -
          haversineMeters(userLoc.lat, userLoc.lng, b.lat, b.lng)
        )
      }
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
    // Desktop drives the sheet through the sidebar flex column, not inline
    // transforms. No-op here so nothing writes onto the desktop nodes.
    if (isDesktop) return
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
    // FIX 2: keep the bottom-left theme toggle aligned with the bottom FAB.
    if (themeRef.current)    themeRef.current.style.bottom = fabBottom
    dragRef.current.snap = offsetFromBottom
    setSnapPx(offsetFromBottom)
  }

  // Initial position is handled entirely by CSS — the sheet's
  // `transform: translateY(calc(100% - 200px))` and the FAB
  // `bottom: 276px` give a 200px peek state on first paint. JS only
  // takes over once the user drags or switches modes.

  function onHandlePointerDown(e) {
    // The handle is hidden on desktop; ignore any stray pointer events too.
    if (isDesktop) return
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

  // Crossing the 900px boundary in either direction. Going to desktop, strip
  // the inline transform/bottom the mobile sheet drag left on the sheet + FAB
  // cluster + theme toggle so the sidebar CSS owns them cleanly. Going back to
  // mobile, re-apply the mode's peek offset so the sheet is not stuck flush.
  useEffect(() => {
    if (isDesktop) {
      if (sheetRef.current) sheetRef.current.style.transform = ''
      if (fabsRef.current)  fabsRef.current.style.bottom = ''
      if (themeRef.current) themeRef.current.style.bottom = ''
    } else {
      // Plan is a desktop-only mode; on mobile there is no panel to host it, so
      // fall back to the map (mobile reaches the plan via the /trip route).
      const m = mode === 'plan' ? 'map' : mode
      if (mode === 'plan') setMode('map')
      applyOffset(m === 'saved' ? Math.max(SNAP_PEEK, window.innerHeight - 240) : SNAP_PEEK)
    }
    // Runs only when the layout flips; uses mode/applyOffset as of that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop])

  // ---- render ----------------------------------------------------------------
  const list = listToShow()
  const sheetTitle = mode === 'saved' ? `Saved (${savedItems.length})`
    : mode === 'plan' ? 'Your Munich day'
    : 'Your places'
  // FIX 3: tile set follows the theme. Positron for light, Dark Matter for
  // dark; the TileLayer is keyed on `theme` below so Leaflet remounts and
  // fetches the new set when the toggle flips.
  const tileUrl = TILES[theme] || TILES.light

  return (
    <>
      <div className="wb-app" data-mode={mode}>

        {/* ---- map -------------------------------------------------------- */}
        <div className="wb-map-wrap">
          <MapContainer
            center={[userLoc.lat, userLoc.lng]}
            zoom={DEFAULT_ZOOM}
            zoomControl={false}
            attributionControl={false}
            style={{ height: '100%', width: '100%', background: 'var(--map-bg)' }}
          >
            <TileLayer key={theme} url={tileUrl} attribution={TILE_ATTRIB} />
            <ClickToMovePin active={mode === 'add'} onPick={ll => setNewPin(ll)} />
            <CenterOnUser trigger={centerTrigger} center={userLoc} />
            <SearchFocus query={search} items={savedItems} />
            <Marker position={[userLoc.lat, userLoc.lng]} icon={youAreHereIcon} />
            {savedItems.map(it => {
              // Paper §3 — when a category filter is active, dim non-matching
              // markers (keep them on the map for spatial context, don't hide).
              const dim = filter !== 'all' && it.category !== filter
              return (
                <Marker
                  key={it.id}
                  position={[it.lat, it.lng]}
                  icon={savedMarkerIcon(it.category)}
                  opacity={dim ? 0.25 : 1}
                  eventHandlers={{ click: () => openDetail(it.id) }}
                />
              )
            })}
            {mode === 'add' && newPin && <Marker position={[newPin.lat, newPin.lng]} icon={dropPinIcon} />}
            {navTarget && (
              <Polyline
                positions={
                  routeData?.coords
                    ?? [[userLoc.lat, userLoc.lng], [navTarget.lat, navTarget.lng]]
                }
                pathOptions={{
                  color: '#a0e6d4',
                  weight: 5,
                  opacity: 0.95,
                  // Dashed only while we're still waiting for OSRM (or it failed
                  // and we're showing the straight-line fallback).
                  dashArray: routeData ? null : '8 6',
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            )}
          </MapContainer>
        </div>

        {/* FIX 5: the proactive banner used to live floating above the map.
            It now renders INSIDE the bottom sheet directly below the method
            picker (see below) so it reads as an extension of the picker
            block, not a floating overlay. */}

        {/* ---- sidebar wrapper -------------------------------------------------
            On mobile this is `display: contents` (no box, no effect): the search
            stack, the map chrome, the sheet, the add card, and the tab bar all
            behave exactly as direct children of .wb-app. At >=900px it becomes a
            fixed 380px right column (flex), the chrome flips to position:fixed so
            it escapes the column and stays over the map, and the search/sheet/tab
            bar stack vertically. One wrapper, two layouts. */}
        <div className="wb-sidebar">

        {/* ---- top overlay stack: search + pills only. */}
        <div className="wb-top-overlay-stack">

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
            <div className="wb-avatar">MUC</div>
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
            <div className="wb-more-wrap" ref={moreDropdownRef}>
              {(() => {
                const activeOverflow = MORE_PILLS.includes(filter) ? filter : null
                const ActiveIcon = activeOverflow ? CATEGORIES[activeOverflow].Icon : MoreHorizontal
                return (
                  <button
                    type="button"
                    ref={moreTriggerRef}
                    className={`wb-pill ${activeOverflow ? 'active' : ''}`}
                    aria-haspopup="listbox"
                    aria-expanded={moreOpen}
                    onClick={() => pickPill('more')}
                  >
                    <ActiveIcon size={14} />
                    {activeOverflow ? CATEGORIES[activeOverflow].label : 'More'}
                  </button>
                )
              })()}
            </div>
          </div>
          {/* Paper §3: filtering by saved-item type complements the category
              filter for richer re-finding. Only surfaced in Saved view to keep
              the Map default uncluttered. */}
          {mode === 'saved' && (
            <div className="wb-type-chips" role="tablist" aria-label="Filter by saved-item type">
              {[
                { key: null,        label: 'All',       Icon: Tags },
                { key: 'ticket',    label: 'Tickets',   Icon: Ticket },
                { key: 'bookmark',  label: 'Bookmarks', Icon: Bookmark },
                { key: 'map_pin',   label: 'Pins',      Icon: MapPin },
                { key: 'note',      label: 'Notes',     Icon: StickyNote },
              ].map(({ key, label, Icon }) => (
                <button
                  key={key ?? 'all'}
                  role="tab"
                  aria-selected={activeType === key}
                  className={`wb-type-chip ${activeType === key ? 'active' : ''}`}
                  onClick={() => setActiveType(key)}
                >
                  <Icon size={12} strokeWidth={2.2} /> {label}
                </button>
              ))}
            </div>
          )}

          {/* Sort moved to a dropdown in the Saved sheet header — see
              .wb-sort-dropdown below. The state (activeSort) and sort logic
              in listToShow() are unchanged. */}
        </div>
        </div>

        {/* ---- layers shortcut + method tag (map mode only) ---------------- */}
        <div className="wb-method-tag">{METHOD_LABEL[method]}</div>
        <button
          className="wb-layers"
          onClick={() => {
            const order = ['jitir', 'cbr', 'cia']
            const next = order[(order.indexOf(method) + 1) % 3]
            setMethod(next); showToast(`Method: ${METHOD_LABEL[next]}`)
          }}
          aria-label="Switch ranking method"
        >
          <LayersIcon size={22} />
        </button>

        {/* ---- live weather + time pill (top-left of map, map mode only) --- */}
        {(() => {
          const WIcon = weather ? weatherIconFor(weather.condition, weather.isDay) : Sun
          const timeStr = currentTime.toLocaleTimeString('de-DE', {
            hour: '2-digit', minute: '2-digit', hour12: false,
          })
          return (
            <div className="wb-weather" title={weather ? `${weather.label} · Munich` : 'Loading weather…'}>
              <WIcon size={14} />
              {weather && <span className="wb-weather-temp">{weather.tempC}°</span>}
              <span className="wb-weather-sep">·</span>
              <span className="wb-weather-time">{timeStr}</span>
            </div>
          )
        })()}

        {/* ---- proactive notification (full-width map overlay, below the
                weather + method tag + layers row). Anchored to the map, not
                the sheet, so dragging the sheet doesn't move or hide it.
                Slide-in animation kicks in on each new fired/forced banner.
                The X dismisses the moment, not the item: it opens a cooldown
                that silences the whole channel (see dismissProactiveAlert). */}
        {mode === 'map' && proactiveAlert && (() => {
          const t = proactiveBannerText(
            proactiveAlert.item,
            proactiveAlert.reason,
            proactiveAlert.signals,
          )
          return (
            <div
              className="wb-proactive wb-proactive--map"
              onClick={() => openDetail(proactiveAlert.item.id)}
              role="button"
              tabIndex={0}
            >
              <Compass size={18} aria-hidden="true" />
              <div className="wb-proactive-text">
                <div className="wb-proactive-title">{t.title}</div>
                <div className="wb-proactive-sub">{t.sub}</div>
              </div>
              <button
                className="wb-proactive-x"
                onClick={(e) => { e.stopPropagation(); dismissProactiveAlert() }}
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          )
        })()}

        {/* ---- FABs (right edge) ------------------------------------------- */}
        <div ref={fabsRef} className="wb-fabs">
          <button
            className={`wb-fab ${geoActive ? 'is-active' : ''}`}
            onClick={handleLocate}
            aria-label={geoActive ? 'Recenter on my location' : 'Use my location'}
          >
            <Locate size={22} />
          </button>
          <button
            className={`wb-fab ${navTarget ? 'is-active' : ''}`}
            onClick={toggleDirections}
            aria-label="Directions"
          >
            <Navigation size={22} />
          </button>
        </div>

        {/* ---- theme toggle (bottom LEFT, mirrors the navigate FAB's y) ---- */}
        <ThemeToggle ref={themeRef} />

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

          {navTarget ? (
            /* =================== NAV PANEL =================== */
            <>
              <div className="wb-nav-header">
                <button className="wb-nav-back" onClick={() => setNavTarget(null)} aria-label="Close directions">
                  <ArrowLeft size={20} />
                </button>
                <div className="wb-nav-header-text">
                  <div className="wb-nav-header-title">{navTarget.name}</div>
                  <div className="wb-nav-header-sub">From Hauptbahnhof</div>
                </div>
              </div>

              {/* mode tabs with per-mode times */}
              <div className="wb-nav-modes" role="tablist" aria-label="Travel mode">
                {TRAVEL_MODES.map(m => {
                  const r = routesByMode[m.id]
                  const mins = r ? Math.max(1, Math.round(r.duration / 60)) : null
                  return (
                    <button
                      key={m.id}
                      role="tab"
                      aria-selected={travelMode === m.id}
                      className={`wb-nav-mode ${travelMode === m.id ? 'active' : ''}`}
                      onClick={() => setTravelMode(m.id)}
                    >
                      <m.Icon size={20} />
                      <span className="wb-nav-mode-time">
                        {mins != null ? `${mins} min` : '-'}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* primary route summary */}
              <div className="wb-nav-summary">
                {routeData ? (
                  <>
                    <div className="wb-nav-summary-time">
                      {Math.max(1, Math.round(routeData.duration / 60))} min
                    </div>
                    <div className="wb-nav-summary-sub">
                      {travelMode === 'transit'
                        ? (routeData.transitLines?.length
                            ? `via ${routeData.transitLines.join(', ')}${routeData.transfers ? ` · ${routeData.transfers} transfer${routeData.transfers > 1 ? 's' : ''}` : ''}`
                            : 'Walk only (destination is close).')
                        : (routeData.distance != null
                            ? (routeData.distance < 1000
                                ? `${Math.round(routeData.distance)} m`
                                : `${(routeData.distance / 1000).toFixed(1)} km`)
                            : '')}
                    </div>
                  </>
                ) : (
                  <div className="wb-nav-summary-time wb-nav-summary-loading">Routing…</div>
                )}
              </div>

              {/* transit step-by-step */}
              {travelMode === 'transit' && routeData?.legs?.length > 0 && (
                <div className="wb-nav-legs">
                  {routeData.legs.map((leg, i) => (
                    <div key={i} className={`wb-nav-leg wb-nav-leg-${leg.mode.toLowerCase()}`}>
                      <div className="wb-nav-leg-icon">
                        {leg.mode === 'WALK'     && <Footprints size={16} />}
                        {leg.mode === 'TRANSIT'  && <Train size={16} />}
                        {leg.mode === 'TRANSFER' && <Compass size={16} />}
                      </div>
                      <div className="wb-nav-leg-main">
                        <div className="wb-nav-leg-label">{leg.label}</div>
                        <div className="wb-nav-leg-meta">{leg.minutes} min{leg.line ? ` · ${leg.line}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA row */}
              <div className="wb-nav-actions">
                <button className="wb-nav-cta-primary" onClick={() => showToast('Live nav not implemented in this demo')}>
                  <Navigation size={16} /> Start
                </button>
                <button className="wb-nav-cta-secondary" onClick={() => setNavTarget(null)}>
                  Close
                </button>
              </div>
            </>
          ) : (
            /* =================== NORMAL SHEET =================== */
            <>
          <div className="wb-sheet-header">
            <div className="wb-sheet-title">{sheetTitle}</div>
            {mode === 'saved' && (
              <div className="wb-sheet-actions">
                {/* Paper §3 — sort dropdown (recency / frequency / alpha /
                    proximity). Hidden while the Compare-methods view is
                    showing because that view ignores the saved-list sort. */}
                {!compareMode && (() => {
                  const hasLoc = !!userLoc
                  const sortOptions = [
                    { key: 'recent',   label: 'Recent',      disabled: false },
                    { key: 'views',    label: 'Most viewed', disabled: false },
                    { key: 'abc',      label: 'A–Z',         disabled: false },
                    { key: 'distance', label: 'Distance',    disabled: !hasLoc },
                  ]
                  return (
                    <div className="wb-sort-dropdown" ref={sortDropdownRef}>
                      <button
                        type="button"
                        className="wb-sort-trigger"
                        aria-haspopup="listbox"
                        aria-expanded={sortMenuOpen}
                        onClick={() => setSortMenuOpen(o => !o)}
                      >
                        <span className="wb-sort-trigger-label">Sort:</span>
                        <span className="wb-sort-trigger-value">{SORT_LABEL[activeSort]}</span>
                        <ChevronDown size={13} aria-hidden="true" />
                      </button>
                      {sortMenuOpen && (
                        <div className="wb-sort-menu" role="listbox" aria-label="Sort saved items">
                          {sortOptions.map(({ key, label, disabled }) => {
                            const selected = activeSort === key
                            return (
                              <button
                                key={key}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                disabled={disabled}
                                className={`wb-sort-menu-item${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
                                onClick={() => {
                                  if (disabled) return
                                  setActiveSort(key)
                                  setSortMenuOpen(false)
                                  showToast(`Sorted: ${SORT_LABEL[key]}`)
                                }}
                              >
                                <span className="wb-sort-menu-check" aria-hidden="true">
                                  {selected && <Check size={13} />}
                                </span>
                                <span className="wb-sort-menu-label">{label}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })()}
                {/* "Plan my day" moved to the bottom navigation as the Plan
                    tab — see TabBar.jsx — to declutter this header. */}
                <button
                  type="button"
                  className="wb-compare-toggle"
                  onClick={() => setCompareMode(m => !m)}
                  aria-pressed={compareMode}
                >
                  {compareMode ? 'List view' : 'Compare methods'}
                </button>
              </div>
            )}
          </div>

          {mode === 'saved' && compareMode && !isDesktop ? (
            <div className="wb-list">
              <MethodCompare />
            </div>
          ) : isDesktop && mode === 'plan' ? (
            /* Plan tab on desktop: the day itinerary fills the panel body where
               the place list normally sits, map stays live behind the panel. */
            <div className="wb-list wb-list--plan">
              <TripItinerary items={savedItems} userLoc={userLoc} />
            </div>
          ) : (
            <>
          {/* Segmented control: ranking method in Map view only.
              Tab order: For this moment (JITIR) is leftmost since it is the
              default active method (Bug 3 reorder).
              Saved view's sort lives in the chip row above the sheet
              (Paper §3 — recency / frequency / alpha / proximity). */}
          {mode === 'map' && (
            <div className="wb-segmented">
              {['jitir', 'cbr', 'cia'].map(m => (
                <button key={m} className={`wb-seg ${method === m ? 'active' : ''}`}
                  onClick={() => { setMethod(m); showToast(`Ranked: ${METHOD_LABEL[m]}`) }}>
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          )}

          {/* Bug 3: at the lowest snap (sheet collapsed) the place list peeks
              out under the tabs. Only render the list once the sheet has
              been dragged up beyond the floor. Threshold sits slightly
              above SNAP_FLOOR so the list also stays hidden right at the
              boundary (avoids a flicker as the user dragged across). */}
          {(isDesktop || snapPx > SNAP_FLOOR + 40) && (
          <div className="wb-list">
            {/* Location-source notice. In fallback mode the recommendations
                rank around the station, which is easy to miss. Surface it
                quietly and let a tap hand off to the same locate flow as the
                FAB; it disappears the moment a real fix is active. */}
            {mode === 'map' && usingFallbackLoc && (
              <button
                type="button"
                className="wb-loc-fallback"
                onClick={handleLocate}
              >
                Showing results near Hauptbahnhof. Tap to use your location
              </button>
            )}
            {list.length === 0 ? (
              (search.trim() || filter !== 'all' || activeType) ? (
                <div className="wb-empty">
                  No matches{search.trim() && <> for <em>“{search.trim()}”</em></>}.
                  <div className="wb-empty-hint">Try a different search or clear the filters.</div>
                  {/* Escape hatch: the saved pool had nothing for this query.
                      Offer a one-tap map search (Photon), never automatic. */}
                  {search.trim() && (
                    mapSearchQuery === search.trim() ? (
                      <div className="wb-map-search">
                        {mapSearchLoading && mapSearchResults.length === 0 && (
                          <div className="wb-item-meta">Searching the map…</div>
                        )}
                        {!mapSearchLoading && mapSearchResults.length === 0 && (
                          <div className="wb-item-meta">No places found for “{search.trim()}”.</div>
                        )}
                        {photonRowsByDistance(mapSearchResults).map(({ feature, distM }, i) => {
                          const p = feature.properties || {}
                          const streetLine = [p.street, p.housenumber].filter(Boolean).join(' ')
                          const title = p.name || streetLine || 'Unnamed place'
                          // Locality (city, falling back to state) + distance, so two
                          // same-named places far apart are easy to tell apart.
                          const place = [streetLine, p.city || p.state].filter(Boolean).join(', ')
                          const secondary = [place, formatDistance(distM)].filter(Boolean).join(' · ')
                          const catLabel = CATEGORIES[osmToCategory(p.osm_key, p.osm_value)]?.label
                          const saved = featureMatchesSaved(feature, savedItems)
                          return (
                            <div key={i} className="wb-item wb-map-search-row">
                              <div className="wb-item-main">
                                <div className="wb-item-name-row">
                                  <span className="wb-item-name">{title}</span>
                                  {catLabel && (
                                    <span className="wb-type-badge">
                                      <span className="wb-type-badge-label">{catLabel}</span>
                                    </span>
                                  )}
                                </div>
                                {secondary && <div className="wb-item-meta">{secondary}</div>}
                              </div>
                              {saved ? (
                                <span className="wb-result-saved" aria-label={`${title} already saved`}>
                                  <Check size={14} aria-hidden="true" /> Saved
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="wb-map-search-save"
                                  onClick={() => saveMapResult(feature)}
                                  disabled={saving}
                                  aria-label={`Save ${title}`}
                                >
                                  <Plus size={16} /> Save
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="wb-empty-escape">
                        <div className="wb-empty-escape-line">Not in your places</div>
                        <button
                          type="button"
                          className="wb-empty-escape-btn"
                          onClick={runMapSearch}
                        >
                          Search the map for “{search.trim()}”
                        </button>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="wb-empty">
                  Nothing here yet. Tap <strong style={{ color: 'var(--accent)' }}>Add</strong> to save your first place.
                </div>
              )
            ) : list.map(({ item, explanation }) => {
              const cat = CATEGORIES[item.category] || { label: item.category, Icon: MapPin, color: '#a0e6d4' }
              const ItemIcon = cat.Icon
              const reasonText = explanation?.reason ? getExplanationText(item, explanation) : null
              const content = (
                <>
                  <div className="wb-item-icon" style={{ background: cat.color + '26' }}>
                    <ItemIcon size={20} color={cat.color} />
                  </div>
                  <div className="wb-item-main">
                    <div className="wb-item-name-row">
                      <span className="wb-item-name">{item.name}</span>
                      {/* Paper §3: saved-item type badge */}
                      <TypeBadge type={item.itemType || 'bookmark'} />
                    </div>
                    <div className="wb-item-meta">
                      {timeAgo(item.savedAt)} · {cat.label.toLowerCase()}
                      {mode === 'saved' && ` · ${item.viewCount} ${item.viewCount === 1 ? 'view' : 'views'}`}
                    </div>
                    {mode === 'map' && reasonText && (
                      <div className="wb-item-reason"><MapPin size={13} /> {reasonText}</div>
                    )}
                  </div>
                  {/* No raw score on Map rows: it was not the active ranker's
                      number and contradicted the sort order. Rank position,
                      distance, and saved-time carry the row; the full
                      explanation lives in the detail panel. */}
                  {mode !== 'map' && (
                    <button className="wb-item-delete" aria-label={`Delete ${item.name}`}
                      onClick={(e) => { e.stopPropagation(); deleteItem(item.id) }}>
                      <Trash2 size={18} />
                    </button>
                  )}
                </>
              )
              // Bug 8: capture the currently-visible slice so the detail
              // panel's arrows cycle within this filter context.
              const ctxIds = list.map(l => l.item.id)
              const ctxLabel = mode === 'map' ? METHOD_LABEL[method] : 'Saved'
              if (mode === 'map') {
                return (
                  <SwipeableRow
                    key={item.id}
                    onTap={() => openDetail(item.id, { ids: ctxIds, label: ctxLabel })}
                    onDismiss={() => dismissRec(item.id)}
                  >
                    {content}
                  </SwipeableRow>
                )
              }
              return (
                <div key={item.id} className="wb-item" onClick={() => openDetail(item.id, { ids: ctxIds, label: ctxLabel })}>
                  {content}
                </div>
              )
            })}
          </div>
          )}
          </>
          )}
            </>
          )}
        </div>

        {/* ---- add card ----------------------------------------------------- */}
        <div className="wb-add-card">
          <div className="wb-add-head">
            <div className="wb-add-title">Save this spot</div>
            <button className="wb-add-x" aria-label="Cancel" onClick={() => changeMode('map')}><X size={16} /></button>
          </div>

          {/* Search a real place (Photon). Tapping a result prefills the form
              below so the user can review and edit before saving. */}
          <input
            className="wb-input"
            type="text"
            placeholder="Search for a real place"
            value={placeQuery}
            onChange={e => setPlaceQuery(e.target.value)}
          />
          {placeQuery.trim().length >= 3 && (
            <div className="wb-place-results">
              {placeSearching && placeResults.length === 0 && (
                <div className="wb-item-meta">Searching…</div>
              )}
              {!placeSearching && placeResults.length === 0 && (
                <div className="wb-item-meta">No matches</div>
              )}
              {photonRowsByDistance(placeResults).map(({ feature, distM }, i) => {
                const p = feature.properties || {}
                const streetLine = [p.street, p.housenumber].filter(Boolean).join(' ')
                const title = p.name || streetLine || 'Unnamed place'
                // Locality (city, falling back to state) + distance, so two
                // same-named places far apart are easy to tell apart.
                const place = [streetLine, p.city || p.state].filter(Boolean).join(', ')
                const secondary = [place, formatDistance(distM)].filter(Boolean).join(' · ')
                const catLabel = CATEGORIES[osmToCategory(p.osm_key, p.osm_value)]?.label
                const saved = featureMatchesSaved(feature, savedItems)
                return (
                  <div
                    key={i}
                    className="wb-item"
                    data-saved={saved ? 'true' : undefined}
                    onClick={saved || saving ? undefined : () => pickPlaceResult(feature)}
                  >
                    <div className="wb-item-main">
                      <div className="wb-item-name-row">
                        <span className="wb-item-name">{title}</span>
                        {catLabel && (
                          <span className="wb-type-badge">
                            <span className="wb-type-badge-label">{catLabel}</span>
                          </span>
                        )}
                      </div>
                      {secondary && <div className="wb-item-meta">{secondary}</div>}
                    </div>
                    {saved && (
                      <span className="wb-result-saved" aria-label={`${title} already saved`}>
                        <Check size={14} aria-hidden="true" /> Saved
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="wb-cat-label">Or drop a pin on the map</div>
          <div className="wb-add-loc">
            <MapPin size={18} color="#ea4335" />
            <div className="wb-add-loc-text">
              <div>{newPin ? `${newPin.lat.toFixed(4)}, ${newPin.lng.toFixed(4)}` : '-'}</div>
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
          {/* Notes are not collected at save time. New saves go out with notes
              empty; the user adds a personal cue afterward via the NOTE editor
              in the detail panel (NOTES_EDIT_ENABLED). */}
          <button className="wb-save-btn" onClick={saveNewPlace} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* ---- bottom nav (shared with TripPage) --------------------------- */}
        <TabBar current={mode} onModeSelect={changeMode} />

        </div>{/* ---- /sidebar wrapper ---------------------------------------- */}

        {/* ---- detail panel ('flipbook') -----------------------------------
              Bug 8: when a context was captured at openDetail time, walk
              the arrow nav through that slice only; otherwise fall back to
              the full saved list (marker tap / deep link). */}
        {detailItemId != null && (() => {
          const detailItems = detailContext
            ? detailContext.ids
                .map(id => savedItems.find(i => i.id === id))
                .filter(Boolean)
            : savedItems
          return (
            <DetailPanel
              itemId={detailItemId}
              items={detailItems}
              contextLabel={detailContext?.label}
              userLoc={userLoc}
              feedbackDone={feedbackSubmitted.has(detailItemId)}
              onFeedback={submitFeedback}
              beside={isDesktop}
              onClose={() => { setDetailItemId(null); setDetailContext(null) }}
              onNavigate={(item) => { setNavTarget(item); setDetailItemId(null); setDetailContext(null); showToast(`Directions to ${item.name}`) }}
              onDelete={(id) => { deleteItem(id); setDetailItemId(null); setDetailContext(null) }}
              onSwitch={(id) => openDetail(id)}
              onUpdateNotes={updateNotes}
            />
          )
        })()}

        {/* ---- desktop compare overlay -------------------------------------
            The 380px sidebar is too narrow for MethodCompare's three columns,
            so on desktop the Compare view floats over the map instead of taking
            over the sidebar list. Closing it returns to the list (which stays
            mounted in the sidebar behind it). Mobile keeps the inline version
            inside the sheet. */}
        {isDesktop && mode === 'saved' && compareMode && (
          <div className="wb-compare-floating" role="dialog" aria-label="Compare methods">
            <button
              type="button"
              className="wb-compare-floating-x"
              onClick={() => setCompareMode(false)}
              aria-label="Close comparison"
            >
              <X size={18} />
            </button>
            <MethodCompare />
          </div>
        )}

        {/* ---- toast -------------------------------------------------------- */}
        {toast && <div className="wb-toast show">{toast}</div>}
      </div>

      {/* FIX 4: More dropdown — portaled to <body> so the .wb-pills
          horizontal-scroll container's overflow can't clip it. Anchored
          via fixed positioning to the trigger's bounding rect (captured
          in the moreOpen effect above). Opens downward over the map. */}
      {moreOpen && moreTriggerRect && createPortal(
        <div
          ref={moreMenuRef}
          className="wb-more-menu"
          role="listbox"
          aria-label="More categories"
          style={{
            position: 'fixed',
            top: moreTriggerRect.bottom + 6,
            left: moreTriggerRect.left,
          }}
        >
          {MORE_PILLS.map(key => {
            const c = CATEGORIES[key]; const Icon = c.Icon
            const selected = filter === key
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={selected}
                className={`wb-more-menu-item${selected ? ' is-selected' : ''}`}
                onClick={() => { pickPill(key); setMoreOpen(false) }}
              >
                <Icon size={14} aria-hidden="true" />
                <span>{c.label}</span>
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </>
  )
}
