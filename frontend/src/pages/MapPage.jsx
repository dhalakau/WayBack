import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useState , useEffect } from 'react'
import { Link } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function MapPage() {
  const [savedItems, setSavedItems] = useState([])

  useEffect(() => {
  // fetch mock data from backend
  fetch('http://localhost:8000/saved-items?userId=user_demo')
    .then(response => response.json())
    .then(data => setSavedItems(data))
}, [])

  return (
    <div>
      <h1 className="text-3xl font-bold text-blue-600">WayBack</h1>
      
      <MapContainer 
        center={[48.137, 11.575]} 
        zoom={13} 
        style={{ height: '500px', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        {savedItems.map(item => (
          <Marker position={[item.lat, item.lng]}>
            <Popup>
              <Link to ={`/item/${item.id}`}>
              {item.name}
              </Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

export default MapPage
