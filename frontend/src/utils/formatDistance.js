// Shared distance formatter so every distance in the app reads the same way:
//   under 1 km     -> whole metres                 ("240 m")
//   1 km to 10 km  -> one decimal km               ("2.4 km")
//   above 10 km    -> whole km, thousands separator ("13,736 km")
// Returns '' for null/undefined/NaN so callers can drop the result inline.
export function formatDistance(meters) {
  if (meters == null || Number.isNaN(meters)) return ''
  if (meters < 1000) return `${Math.round(meters)} m`
  const km = meters / 1000
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km).toLocaleString('en-US')} km`
}
