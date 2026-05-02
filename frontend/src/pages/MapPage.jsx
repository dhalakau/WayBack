import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function MapPage() {
  const [savedItems, setSavedItems] = useState([])
  const [recommendations, setRecommendations] = useState([])

  useEffect(() => {
    fetch('http://localhost:8000/saved-items?userId=user_demo')
      .then(res => res.json())
      .then(data => setSavedItems(data))

    fetch('http://localhost:8000/recommendations?userId=user_demo&lat=48.137&lng=11.575&method=CIA')
      .then(res => res.json())
      .then(data => setRecommendations(data))
  }, [])

  const recommendedIds = new Set(recommendations.map(r => r.item.id))

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <div className="px-4 py-6 md:px-8 text-center">
        <h1 className="text-2xl font-semibold text-[#1D1C1C]">WayBack</h1>
      </div>
    

      <MapContainer
        center={[48.137, 11.575]}
        zoom={13}
        style={{ height: '60vh', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        {savedItems.map(item => (
          <Marker
            key={item.id}
            position={[item.lat, item.lng]}
          >
            <Popup>
              <Link to={`/item/${item.id}`} className="font-medium text-[#2D6A4F]">
                {item.name}
              </Link>
              {recommendedIds.has(item.id) && (
                <p className="text-xs text-green-600 mt-1">Recommended</p>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

export default MapPage