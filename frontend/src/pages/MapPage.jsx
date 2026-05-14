import { useState, useEffect, useRef, useCallback } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Search, X, Plus, Compass, Bookmark, Sun, Moon, Trash2, MapPin,
  Coffee, UtensilsCrossed, Trees, Wine, Bed, ShoppingBag, Wrench,
  Train, Landmark, Camera, Navigation, Locate, MoreHorizontal,
  Sparkles, Cloud, CloudRain, CloudSnow, CloudFog, CloudLightning,
  Footprints, Bike, Car, ArrowLeft,
  Map as MapIcon, CirclePlus, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { getExplanationText } from '../utils/explanationText'

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const API = 'http://localhost:8000'
const USER_ID = 'user_demo'
const DEFAULT_CENTER = [48.1402, 11.5586]  // Munich Hauptbahnhof — sensible demo location
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

// Per-category gradient backgrounds for the detail panel hero — gives each
// place a distinct visual "page" feel without needing real photos.
const CATEGORY_GRADIENTS = {
  attraction:    'linear-gradient(135deg, #2c7a7b 0%, #4fd1c5 100%)',
  restaurant:    'linear-gradient(135deg, #c53030 0%, #fc8181 100%)',
  cafe:          'linear-gradient(135deg, #7b341e 0%, #d69e2e 100%)',
  museum:        'linear-gradient(135deg, #553c9a 0%, #b794f4 100%)',
  park:          'linear-gradient(135deg, #276749 0%, #68d391 100%)',
  bar:           'linear-gradient(135deg, #97266d 0%, #f687b3 100%)',
  accommodation: 'linear-gradient(135deg, #b83280 0%, #fbb6ce 100%)',
  shopping:      'linear-gradient(135deg, #c05621 0%, #f6ad55 100%)',
  services:      'linear-gradient(135deg, #2d3748 0%, #718096 100%)',
  transport:     'linear-gradient(135deg, #2c5282 0%, #63b3ed 100%)',
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

// Travel-mode definitions: id, lucide icon, accessible label.
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

// Pick a lucide icon component for a (condition, isDay) pair.
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
 * Decide whether the top CIA recommendation deserves a proactive banner.
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
      sub: signalLine || 'Saved a long time ago — time to revisit?',
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
    } else if (!moved) {
      // pure tap (no horizontal lock, no movement) → fire tap
      onTap?.()
    }
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
      onPointerCancel={onPointerUp}
    >
      {children}
    </div>
  )
}

// -----------------------------------------------------------------------------
// DetailPanel — the "flipbook" view. Tapping a place opens this overlay.
// Swipe left/right (or use the chevrons) to flip between saved places.
// -----------------------------------------------------------------------------

function DetailPanel({ itemId, items, onClose, onNavigate, onDelete, onSwitch }) {
  const idx = items.findIndex(i => i.id === itemId)
  const item = items[idx]
  const [tx, setTx] = useState(0)
  const startRef = useRef({ x: 0, y: 0, locked: null })
  if (!item) return null

  const cat = CATEGORIES[item.category] || { label: item.category, Icon: MapPin, color: '#a0e6d4' }
  const gradient = CATEGORY_GRADIENTS[item.category] || 'linear-gradient(135deg, #1c2530, #28323f)'
  const CatIcon = cat.Icon

  function go(delta) {
    const next = idx + delta
    if (next >= 0 && next < items.length) onSwitch?.(items[next].id)
  }

  function onPointerDown(e) {
    startRef.current = { x: e.clientX, y: e.clientY, locked: null }
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
    if (startRef.current.locked === 'h') setTx(dx)
  }
  function onPointerUp() {
    if (startRef.current.locked === 'h' && Math.abs(tx) > 80) {
      // swipe to next/prev
      const delta = tx < 0 ? 1 : -1
      setTx(tx < 0 ? -400 : 400)
      setTimeout(() => { go(delta); setTx(0) }, 180)
    } else {
      setTx(0)
    }
    startRef.current = { x: 0, y: 0, locked: null }
  }

  const isFirst = idx <= 0
  const isLast = idx >= items.length - 1
  const distance = Math.round(haversineMeters(
    DEFAULT_CENTER[0], DEFAULT_CENTER[1], item.lat, item.lng
  ))

  return (
    <div className="wb-detail" role="dialog" aria-modal="true" aria-label={item.name}>
      <button className="wb-detail-close" onClick={onClose} aria-label="Close">
        <X size={20} />
      </button>

      <div
        className="wb-detail-page"
        style={{ transform: `translateX(${tx}px)`, transition: startRef.current.locked === 'h' && tx !== 0 && Math.abs(tx) < 400 ? 'none' : 'transform 0.22s' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="wb-detail-hero" style={{ background: gradient }}>
          <div className="wb-detail-cat">
            <CatIcon size={14} /> {cat.label}
          </div>
          <h2 className="wb-detail-name">{item.name}</h2>
          <div className="wb-detail-address">{item.address || ''}</div>
        </div>

        <div className="wb-detail-body">
          <p className="wb-detail-desc">{item.notes || 'No description yet — be the first to add one.'}</p>

          <div className="wb-detail-stats">
            <div className="wb-stat">
              <div className="wb-stat-label">Distance</div>
              <div className="wb-stat-val">{distance < 1000 ? `${distance} m` : `${(distance/1000).toFixed(1)} km`}</div>
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

  // NEW: phase-3 state
  const [detailItemId, setDetailItemId] = useState(null)   // open detail panel for this item
  const [dismissed, setDismissed] = useState(new Set())    // hide from Map view (not Saved)
  const [navTarget, setNavTarget] = useState(null)         // active route destination
  const [routesByMode, setRoutesByMode] = useState({})     // { foot, bike, car, transit } each → route|null
  const [routeLoading, setRouteLoading] = useState(false)  // true while ANY mode is still pending
  const [travelMode, setTravelMode] = useState('foot')     // 'foot' | 'bike' | 'car' | 'transit'

  // Live context: real Munich weather (Open-Meteo) + ticking clock.
  // Both feed into the contextBoost() multiplier that re-ranks recs.
  const [weather, setWeather] = useState(null)             // { tempC, code, isDay, condition, label } | null
  const [currentTime, setCurrentTime] = useState(new Date())

  // Proactive notification (W4 project brief: "proactively recommend ... based on current situation").
  // Surfaces the top CIA recommendation when contextual signals reinforce it.
  // See paper Section 6.3 (Action Prediction) for why CIA is the chosen method here.
  const [proactiveAlert, setProactiveAlert] = useState(null)  // { item, reason, score, signals } or null
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('wb_dismissed_alerts') || '[]')) }
    catch { return new Set() }
  })

  const [toast, setToast] = useState(null)
  const [centerTrigger, setCenterTrigger] = useState(0)

  // ---- sheet drag ------------------------------------------------------------
  const sheetRef = useRef(null)
  const fabsRef = useRef(null)
  const themeBtnRef = useRef(null)
  const dragRef = useRef({ startY: 0, startOffset: 200, dragging: false, snap: 200 })

  // ---- initial data + geolocation -------------------------------------------
  useEffect(() => {
    // Geolocation intentionally disabled for the demo — fixed Hauptbahnhof
    // start point gives a stable frame of reference for the navigation feature.
    // To re-enable, uncomment the navigator.geolocation block below.
    //
    // if (navigator.geolocation) {
    //   navigator.geolocation.getCurrentPosition(
    //     pos => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    //     () => {}, { timeout: 4000 }
    //   )
    // }
    fetchSaved()
  }, []) // eslint-disable-line

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

  // Proactive notification polling (W4 project brief requirement).
  // Calls the existing /recommendations endpoint with method=cia every 30s and
  // evaluates whether the top-ranked item satisfies the composite signal gate
  // defined by evaluateProactiveSignal() above. CIA is selected per paper §6.3
  // (best at action prediction).
  useEffect(() => {
    let cancelled = false

    async function evaluate() {
      try {
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

        const now = new Date()
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
    } catch { showToast('Backend not reachable on :8000') }
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

  // ---- detail panel (the "flipbook" view) ------------------------------------
  // Tapping a place opens this; it also fires GET /saved-items/:id which the
  // backend uses to increment viewCount + lastViewedAt (feeds the CIA model).
  async function openDetail(itemId) {
    setDetailItemId(itemId)
    try { await fetch(`${API}/saved-items/${itemId}`) } catch {}
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

  function dismissProactiveAlert() {
    if (!proactiveAlert) return
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

  // ---- derived: what the sheet's list shows ---------------------------------
  function listToShow() {
    const q = search.trim().toLowerCase()
    const filterFn = item => {
      if (q && !item.name.toLowerCase().includes(q) && !(item.notes || '').toLowerCase().includes(q)) return false
      if (mode === 'map' && filter !== 'all' && item.category !== filter) return false
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
      // Saved mode: locally sorted full list (ignores dismissed — it's a different view)
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
                eventHandlers={{ click: () => openDetail(it.id) }}
              />
            ))}
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

        {/* ---- proactive notification (W4 brief; paper §6.3 method choice) - */}
        {proactiveAlert && mode === 'map' && (() => {
          const t = proactiveBannerText(
            proactiveAlert.item,
            proactiveAlert.reason,
            proactiveAlert.signals,
          )
          return (
            <div
              className="wb-proactive"
              onClick={() => openDetail(proactiveAlert.item.id)}
              role="button"
              tabIndex={0}
            >
              <Sparkles size={18} aria-hidden="true" />
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
          <button
            className={`wb-fab ${navTarget ? 'is-active' : ''}`}
            onClick={toggleDirections}
            aria-label="Directions"
          >
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
                        {mins != null ? `${mins} min` : '—'}
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
                            : 'Walk only — destination is close')
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
              const reasonText = explanation?.reason ? getExplanationText(item, explanation) : null
              const content = (
                <>
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
                </>
              )
              if (mode === 'map') {
                return (
                  <SwipeableRow
                    key={item.id}
                    onTap={() => openDetail(item.id)}
                    onDismiss={() => dismissRec(item.id)}
                  >
                    {content}
                  </SwipeableRow>
                )
              }
              return (
                <div key={item.id} className="wb-item" onClick={() => openDetail(item.id)}>
                  {content}
                </div>
              )
            })}
          </div>
            </>
          )}
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

        {/* ---- detail panel ('flipbook') ----------------------------------- */}
        {detailItemId != null && (
          <DetailPanel
            itemId={detailItemId}
            items={savedItems}
            onClose={() => setDetailItemId(null)}
            onNavigate={(item) => { setNavTarget(item); setDetailItemId(null); showToast(`Directions to ${item.name}`) }}
            onDelete={(id) => { deleteItem(id); setDetailItemId(null) }}
            onSwitch={(id) => openDetail(id)}
          />
        )}

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

      .wb-app {
        max-width: 440px;
        margin: 0 auto;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.04);
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
        position: absolute; top: 116px; right: 12px;
        width: 44px; height: 44px; border-radius: 22px; z-index: 500;
        display: flex; align-items: center; justify-content: center;
        color: var(--accent); transition: opacity 0.2s;
      }
      .wb-method-tag {
        position: absolute; top: 124px; right: 64px;
        background: var(--surface-1); border-radius: 14px; padding: 4px 10px;
        font-size: 11px; color: var(--accent); z-index: 500; font-weight: 500;
        transition: opacity 0.2s;
      }
      .wb-weather {
        position: absolute; top: 120px; left: 12px;
        background: var(--surface-1); border-radius: 16px; padding: 6px 12px;
        display: flex; align-items: center; gap: 6px;
        font-size: 12px; color: var(--text-1); font-weight: 500;
        z-index: 500;
        box-shadow: 0 2px 6px rgba(0,0,0,0.18);
        transition: opacity 0.2s;
      }
      .wb-weather svg { color: var(--accent); }
      .wb-weather-temp { color: var(--text-1); }
      .wb-weather-sep  { opacity: 0.4; }
      .wb-weather-time { color: var(--text-1); font-variant-numeric: tabular-nums; }
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
      .wb-app[data-mode="saved"] .wb-weather,
      .wb-app[data-mode="add"]   .wb-search-area,
      .wb-app[data-mode="add"]   .wb-layers,
      .wb-app[data-mode="add"]   .wb-method-tag,
      .wb-app[data-mode="add"]   .wb-weather {
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

      /* ===== phase 3 ============================================== */

      /* Swipeable rows — make sure they cooperate with vertical scrolling */
      .wb-swipeable { touch-action: pan-y; will-change: transform; }

      .wb-fab.is-active {
        background: var(--accent); color: var(--accent-on);
      }
      .wb-fab.is-active svg { color: var(--accent-on); }

      /* ============== NAV PANEL (replaces sheet content while routing) ============== */
      .wb-nav-header {
        padding: 4px 12px 12px; display: flex; align-items: center; gap: 12px;
      }
      .wb-nav-back {
        width: 36px; height: 36px; border-radius: 50%;
        background: transparent; border: none; cursor: pointer;
        color: var(--text-1); display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .wb-nav-back:hover { background: var(--surface-1); }
      .wb-nav-header-text { flex: 1; min-width: 0; }
      .wb-nav-header-title {
        font-size: 17px; font-weight: 600; color: var(--text-1);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .wb-nav-header-sub { font-size: 12px; color: var(--text-2); margin-top: 2px; }

      .wb-nav-modes {
        margin: 0 12px 16px; display: flex; gap: 4px;
        background: var(--surface-1); padding: 4px; border-radius: 14px;
      }
      .wb-nav-mode {
        flex: 1; height: 56px; border-radius: 11px;
        background: transparent; border: none; cursor: pointer;
        color: var(--text-2);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 2px;
        transition: background 0.15s, color 0.15s;
      }
      .wb-nav-mode:hover { color: var(--text-1); }
      .wb-nav-mode.active {
        background: var(--accent); color: var(--accent-on);
      }
      .wb-nav-mode-time {
        font-size: 11px; font-weight: 500; font-variant-numeric: tabular-nums;
      }

      .wb-nav-summary {
        margin: 0 12px 14px; padding: 16px;
        background: var(--surface-1); border-radius: 14px;
      }
      .wb-nav-summary-time {
        font-size: 28px; font-weight: 600; color: var(--text-1);
        line-height: 1.1;
      }
      .wb-nav-summary-loading { font-size: 18px; color: var(--text-2); font-weight: 500; }
      .wb-nav-summary-sub {
        font-size: 13px; color: var(--text-2); margin-top: 6px;
      }

      .wb-nav-legs {
        margin: 0 12px 14px; padding: 6px 4px;
        background: var(--surface-1); border-radius: 14px;
        max-height: 240px; overflow-y: auto;
      }
      .wb-nav-leg {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 12px;
      }
      .wb-nav-leg + .wb-nav-leg {
        border-top: 0.5px solid var(--border);
      }
      .wb-nav-leg-icon {
        width: 32px; height: 32px; border-radius: 50%;
        background: var(--bg);
        display: flex; align-items: center; justify-content: center;
        color: var(--text-1); flex-shrink: 0;
      }
      .wb-nav-leg-transit .wb-nav-leg-icon { background: var(--accent); color: var(--accent-on); }
      .wb-nav-leg-main { flex: 1; min-width: 0; }
      .wb-nav-leg-label { font-size: 13px; color: var(--text-1); font-weight: 500; }
      .wb-nav-leg-meta  { font-size: 11px; color: var(--text-2); margin-top: 2px; }

      .wb-nav-actions {
        margin: auto 12px 14px; display: flex; gap: 8px;
      }
      .wb-nav-cta-primary {
        flex: 2; height: 44px; border-radius: 22px;
        background: var(--accent); color: var(--accent-on);
        border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        font-size: 14px; font-weight: 600;
      }
      .wb-nav-cta-secondary {
        flex: 1; height: 44px; border-radius: 22px;
        background: var(--surface-1); color: var(--text-1);
        border: none; cursor: pointer;
        font-size: 14px; font-weight: 500;
      }

      /* Detail panel — the "flipbook" overlay */
      .wb-detail {
        position: absolute; inset: 0;
        background: var(--bg);
        z-index: 900;
        display: flex; flex-direction: column;
        animation: wbDetailIn 0.28s cubic-bezier(0.2,0.8,0.2,1);
      }
      @keyframes wbDetailIn {
        from { opacity: 0; transform: translateY(20px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .wb-detail-close {
        position: absolute; top: 14px; right: 14px;
        width: 36px; height: 36px; border-radius: 50%;
        background: rgba(0,0,0,0.4); color: #ffffff;
        border: none; cursor: pointer; z-index: 10;
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(6px);
      }
      .wb-detail-page {
        flex: 1; display: flex; flex-direction: column;
        overflow-y: auto;
        touch-action: pan-y;
      }
      @media (hover: hover) and (pointer: fine) {
        .wb-detail-page { touch-action: auto !important; }
      }
      .wb-detail-hero {
        min-height: 240px; padding: 36px 22px 22px;
        display: flex; flex-direction: column; justify-content: flex-end;
        color: #ffffff;
        position: relative;
      }
      .wb-detail-cat {
        display: inline-flex; align-items: center; gap: 6px;
        background: rgba(0,0,0,0.25); backdrop-filter: blur(6px);
        padding: 5px 11px; border-radius: 12px;
        font-size: 11px; font-weight: 500;
        align-self: flex-start;
        text-transform: uppercase; letter-spacing: 0.6px;
      }
      .wb-detail-name {
        margin: 12px 0 4px;
        font-size: 28px; font-weight: 600;
        line-height: 1.15;
        letter-spacing: -0.4px;
      }
      .wb-detail-address {
        font-size: 13px; opacity: 0.85;
      }
      .wb-detail-body {
        padding: 24px 22px 36px;
        display: flex; flex-direction: column; gap: 22px;
      }
      .wb-detail-desc {
        font-size: 15px; line-height: 1.55;
        color: var(--text-1);
        margin: 0;
      }
      .wb-detail-stats {
        display: grid; grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        padding: 14px 4px;
        border-top: 0.5px solid var(--border);
        border-bottom: 0.5px solid var(--border);
      }
      .wb-stat { text-align: center; }
      .wb-stat-label {
        font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
        color: var(--text-2); margin-bottom: 4px;
      }
      .wb-stat-val {
        font-size: 15px; font-weight: 600; color: var(--text-1);
      }
      .wb-detail-actions { display: flex; gap: 10px; }
      .wb-detail-primary {
        flex: 1; height: 48px;
        background: var(--accent); color: var(--accent-on);
        border: none; border-radius: 24px;
        font-size: 15px; font-weight: 500;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 8px;
      }
      .wb-detail-secondary {
        width: 48px; height: 48px;
        background: var(--surface-1); color: #e0413f;
        border: 0.5px solid var(--border); border-radius: 50%;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
      }
      .wb-detail-arrow {
        position: absolute; top: 50%; transform: translateY(-50%);
        width: 42px; height: 42px; border-radius: 50%;
        background: rgba(0,0,0,0.4); color: #ffffff;
        border: none; cursor: pointer; z-index: 5;
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(6px);
        transition: opacity 0.18s;
      }
      .wb-detail-arrow.left  { left: 12px; }
      .wb-detail-arrow.right { right: 12px; }
      .wb-detail-arrow:disabled { opacity: 0.25; cursor: not-allowed; }
      .wb-detail-dots {
        position: absolute; bottom: 16px; left: 50%;
        transform: translateX(-50%);
        font-size: 12px; font-weight: 500;
        background: rgba(0,0,0,0.45); color: #ffffff;
        padding: 4px 10px; border-radius: 10px;
        backdrop-filter: blur(6px);
        z-index: 5;
      }

      /* Proactive notification banner (W4 brief; paper §6.3) ------------- */
      .wb-proactive {
        position: absolute; top: 12px; left: 12px; right: 12px;
        background: var(--accent); color: var(--accent-on);
        border-radius: 16px; padding: 12px 14px;
        display: flex; align-items: center; gap: 12px;
        z-index: 760;
        box-shadow: 0 2px 12px rgba(0,0,0,0.25);
        cursor: pointer;
        animation: wbProactiveIn 0.32s cubic-bezier(0.2,0.8,0.2,1);
      }
      .wb-proactive svg { flex-shrink: 0; }
      .wb-proactive-text { flex: 1; min-width: 0; }
      .wb-proactive-title { font-size: 14px; font-weight: 600; line-height: 1.25; }
      .wb-proactive-sub { font-size: 12px; opacity: 0.78; margin-top: 2px; line-height: 1.3; }
      .wb-proactive-x {
        width: 28px; height: 28px; border-radius: 50%;
        background: rgba(0,0,0,0.12); border: none; cursor: pointer;
        color: var(--accent-on);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .wb-proactive-x:hover { background: rgba(0,0,0,0.2); }
      @keyframes wbProactiveIn {
        from { opacity: 0; transform: translateY(-12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .wb-app:has(.wb-proactive) .wb-search-area { top: 76px; }
    `}</style>
  )
}
