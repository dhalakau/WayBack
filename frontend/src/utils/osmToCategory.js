// Map an OSM key/value pair (from Photon search results) onto one of our 10
// categories so an imported place is filed the same way a manual pin would be.
// Falls back to 'attraction' for anything we do not explicitly recognize.
export function osmToCategory(key, value) {
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
