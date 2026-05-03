import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'

function ItemDetailPage() {
  const { id } = useParams()
  const [item, setItem] = useState(null)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    fetch(`http://localhost:8000/saved-items/${id}?userId=user_demo`)
      .then(response => response.json())
      .then(data => setItem(data))
  }, [id])

  const handleFeedback = (useful) => {
    fetch('http://localhost:8000/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user_demo',
        itemId: item.id,
        useful: useful,
        method: 'CIA',
        contextSnapshot: { lat: 48.137, lng: 11.575, time: Date.now() }
      })
    })
    setFeedbackSubmitted(true)
  }

  const handleDelete = () => {
    fetch(`http://localhost:8000/saved-items/${item.id}?userId=user_demo`, {
      method: 'DELETE'
    }).then(() => window.history.back())
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] px-4 py-6 md:px-8 max-w-2xl mx-auto">
      {item ? (
        <div>
          <Link to="/" className="text-sm text-[#2D6A4F] hover:underline mb-6 block">← Back</Link>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-2xl font-semibold text-[#1D1C1C]">{item.name}</h1>
              <span className="text-xs bg-[#F0F7F4] text-[#2D6A4F] px-2 py-1 rounded-full font-medium">
                {item.category}
              </span>
            </div>

            <p className="text-gray-600 mb-6">{item.notes}</p>

            <div className="border-t border-gray-100 pt-5">
              {feedbackSubmitted ? (
                <p className="text-sm text-[#2D6A4F] font-medium">Thanks for your feedback!</p>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 mb-3">Was this recommendation useful?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleFeedback(true)}
                      className="px-5 py-2 rounded-full border border-[#2D6A4F] text-[#2D6A4F] text-sm font-medium hover:bg-[#F0F7F4]"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => handleFeedback(false)}
                      className="px-5 py-2 rounded-full border border-gray-300 text-gray-500 text-sm font-medium hover:bg-gray-50"
                    >
                      No
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              {confirmDelete ? (
                <div>
                  <p className="text-sm text-gray-500 mb-3">Are you sure you want to remove this place?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDelete}
                      className="px-5 py-2 rounded-full border border-red-400 text-red-400 text-sm font-medium hover:bg-red-50"
                    >
                      Yes, remove
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-5 py-2 rounded-full border border-gray-300 text-gray-500 text-sm font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-sm text-red-400 hover:text-red-600"
                >
                  Remove this place
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-gray-400 text-sm">Loading...</p>
      )}
    </div>
  )
}

export default ItemDetailPage