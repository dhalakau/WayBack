import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useState , useEffect } from 'react'
import { Link } from 'react-router-dom'

function MapPage() {
  const [savedItems, setSavedItems] = useState([])

  useEffect(() => {
  // fetch mock data from backend
  fetch('/saved-items.json')
    .then(response => response.json())
    .then(data => setSavedItems(data))
}, [])

  return (
    <div>
      <h1>WayBack</h1>
      
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
