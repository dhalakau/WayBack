import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getExplanationText, getFullDate } from '../utils/explanationText'

const METHODS = [
  { key: 'CIA', label: 'Near me' },
  { key: 'CBR', label: 'Based on history' },
  { key: 'JITIR', label: 'For this moment' },
]

function FeedPage() {
  const [recommendations, setRecommendations] = useState([])
  const [activeMethod, setActiveMethod] = useState('CIA')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
  setLoading(true)
  setError(null)
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords
      fetch(`http://localhost:8000/recommendations?userId=user_demo&lat=${latitude}&lng=${longitude}&method=${activeMethod}`)
        .then(response => response.json())
        .then(data => {
          setRecommendations(data)
          setLoading(false)
        })
        .catch(() => {
          setError('Could not load recommendations. Please try again.')
          setLoading(false)
        })
    },
    () => {
      // as a fallback, we can use a default location (e.g., city center)
      fetch(`http://localhost:8000/recommendations?userId=user_demo&lat=48.137&lng=11.575&method=${activeMethod}`)
        .then(response => response.json())
        .then(data => {
          setRecommendations(data)
          setLoading(false)
        })
        .catch(() => {
          setError('Could not load recommendations. Please try again.')
          setLoading(false)
        })
    }
  )
}, [activeMethod])

  return (
    <div className="min-h-screen bg-[#F8F7F4] px-4 py-6 md:px-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-[#1D1C1C] mb-4">For you</h1>

      <div className="flex gap-2 mb-6">
        {METHODS.map(method => (
          <button
            key={method.key}
            onClick={() => setActiveMethod(method.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              activeMethod === method.key
                ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
                : 'bg-white text-gray-500 border-gray-200 hover:border-[#2D6A4F] hover:text-[#2D6A4F]'
            }`}
          >
            {method.label}
          </button>
        ))}
      </div>

     {loading && (
        <p className="text-sm text-gray-400 text-center mt-12">Loading...</p>
    )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-500 text-center">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-4">
          {recommendations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-12">No recommendations found.</p>
          ) : (
            recommendations.map((rec) => (
              <div key={rec.item.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-lg font-semibold text-[#1D1C1C]">{rec.item.name}</h2>
                  <span className="text-xs bg-[#F0F7F4] text-[#2D6A4F] px-2 py-1 rounded-full font-medium">
                    {rec.item.category}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-3" title={getFullDate(rec.item.savedAt)}>
                {getExplanationText(rec.item, rec.explanation)}
                </p>
                <p className="text-sm text-gray-700 mb-4">{rec.item.notes}</p>
                <Link
                  to={`/item/${rec.item.id}`}
                  className="text-sm font-medium text-[#2D6A4F] hover:underline"
                >
                  View details →
                </Link>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default FeedPage