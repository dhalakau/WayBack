import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
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

// Fallback descriptions used when the live API call fails (e.g., no API credits).
// Keeps the demo functional and shows a realistic "AI-generated" description.
const FALLBACK_DESCRIPTIONS = {
  attraction: [
    'A well-known landmark worth visiting. Best in the morning to avoid crowds and get good photos.',
    'A popular spot in the area. Allow 1-2 hours and check opening times in advance.',
  ],
  restaurant: [
    'A local favorite known for authentic flavors. Reservations recommended for dinner.',
    'Popular for its food and atmosphere. Try arriving before peak hours to get a table.',
  ],
  museum: [
    'Houses a notable collection. Plan 1-2 hours and look out for student discounts.',
    'Worth a thoughtful visit; check for special exhibitions before you go.',
  ],
  outdoor: [
    'A great spot for a walk and fresh air. Best on clear days with comfortable shoes.',
    'Scenic and relaxing. Bring water and check the weather before heading out.',
  ],
  shopping: [
    'A lively shopping area with a mix of local shops and big brands. Plan at least an hour.',
    'Good range of stores and cafés. Weekends are busiest, mornings are calmer.',
  ],
  bar: [
    'Lively evening atmosphere with a solid drink menu. Best to arrive before peak hours.',
    'Popular nightspot with a good crowd. Check if reservations are needed on weekends.',
  ],
}

function AddMarkerOnClick({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng)
    }
  })
  return null
}

function MapPage() {
  const [savedItems, setSavedItems] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [newPin, setNewPin] = useState(null)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('attraction')
  const [newNotes, setNewNotes] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [usedDemoMode, setUsedDemoMode] = useState(false)

  useEffect(() => {
    fetch('http://localhost:8000/saved-items?userId=user_demo')
      .then(res => res.json())
      .then(data => setSavedItems(data))

    fetch('http://localhost:8000/recommendations?userId=user_demo&lat=48.137&lng=11.575&method=CIA')
      .then(res => res.json())
      .then(data => setRecommendations(data))
  }, [])

  const recommendedIds = new Set(recommendations.map(r => r.item.id))

  const handleMapClick = (latlng) => {
    setNewPin(latlng)
    setNewName('')
    setNewNotes('')
    setUsedDemoMode(false)
  }

  const handleSave = () => {
    if (!newName.trim()) return
    fetch('http://localhost:8000/saved-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
         userId: 'user_demo',
         name: newName,
         category: newCategory,
         lat: newPin.lat,
         lng: newPin.lng,
         notes: newNotes
})
    })
      .then(res => res.json())
      .then(item => {
        setSavedItems(prev => [...prev, item])
        setNewPin(null)
        setNewName('')
        setNewNotes('')
        setUsedDemoMode(false)
      })
  }

  const handleGenerateNotes = async () => {
    if (!newName.trim()) return
    setAiLoading(true)
    setUsedDemoMode(false)
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: `Write a short 1-2 sentence note about this place for a traveler's saved places app. Place: "${newName}",
            Category: ${newCategory}. Be specific and practical. No fluff.`
          }]
        })
      })

      // If the API returns a non-2xx status (e.g., 401 no credits, 400 invalid key),
      // throw so we fall through to the demo-mode fallback below.
      if (!response.ok) throw new Error('API call failed')

      const data = await response.json()

      // Defensive check: response shape may not include text on errors.
      if (!data.content?.[0]?.text) throw new Error('Invalid API response')

      setNewNotes(data.content[0].text)
    } catch {
      // Fallback: pick a category-appropriate sample so the demo still works.
      const options = FALLBACK_DESCRIPTIONS[newCategory] || FALLBACK_DESCRIPTIONS.attraction
      const sample = options[Math.floor(Math.random() * options.length)]
      setNewNotes(sample)
      setUsedDemoMode(true)
    }
    setAiLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <div className="px-4 py-6 md:px-8 text-center">
        <h1 className="text-2xl font-semibold text-[#1D1C1C]">WayBack</h1>
        <p className="text-xs text-gray-400 mt-1">Tap the map to save a new place</p>
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
        <AddMarkerOnClick onMapClick={handleMapClick} />

        {savedItems.map(item => (
          <Marker key={item.id} position={[item.lat, item.lng]}>
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
        {newPin && (
  <Marker position={newPin}>
    <Popup>
      <div style={{ minWidth: '200px' }}>
        <input
          type="text"
          placeholder="Place name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          style={{ width: '100%', marginBottom: '6px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        <select
          value={newCategory}
          onChange={e => setNewCategory(e.target.value)}
          style={{ width: '100%', marginBottom: '6px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          <option value="attraction">Attraction</option>
          <option value="restaurant">Restaurant</option>
          <option value="museum">Museum</option>
          <option value="outdoor">Outdoor</option>
          <option value="shopping">Shopping</option>
          <option value="bar">Bar</option>
        </select>
        <textarea
          placeholder="Add a note..."
          value={newNotes}
          onChange={e => setNewNotes(e.target.value)}
          rows={3}
          style={{ width: '100%', marginBottom: '4px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px', resize: 'none' }}
        />
        {usedDemoMode && (
          <p style={{ fontSize: '10px', color: '#888', marginBottom: '6px', fontStyle: 'italic' }}>
            Demo description — live AI requires API credits
          </p>
        )}
        <button
          onClick={handleGenerateNotes}
          disabled={!newName.trim() || aiLoading}
          style={{ width: '100%', marginBottom: '6px', padding: '5px', background: 'white', color: '#2D6A4F', border: '1px solid #2D6A4F', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
        >
          {aiLoading ? 'Generating...' : 'Describe this place for me'}
        </button>
        <button
          onClick={handleSave}
          style={{ width: '100%', padding: '6px', background: '#2D6A4F', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Save place
        </button>
      </div>
    </Popup>
  </Marker>
)}
      </MapContainer>
    </div>
  )
}

export default MapPage
