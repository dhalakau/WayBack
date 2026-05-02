import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'

function ItemDetailPage() {
    const { id } = useParams()
    const [item , setItem] = useState(null)
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

    useEffect(() => {
        fetch(`http://localhost:8000/saved-items/${id}?userId=user_demo`)
            .then(response => response.json())
            .then(data => {
                setItem(data)
            })
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
    return (
        <div>
        { item ? (
            <div>
                <h1>{item.name}</h1>
                <p>Category: {item.category}</p>
                <p>Notes: {item.notes}</p>
                <div style={{ marginTop: '24px' }}>
                    {feedbackSubmitted ? (
                        <p>Thanks for your feedback! </p>
                    ) : (
                    <>
                        <p>Was this recommendation useful?</p>
                        <button onClick={() => handleFeedback(true)}>Yes</button>
                        <button onClick={() => handleFeedback(false)}>No</button>
                    </>
                )}
            </div>
            </div>
        ) : (
            <p>Loading...</p>
        )}
        </div>
    )
}

export default ItemDetailPage