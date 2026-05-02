import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'

function ItemDetailPage() {
    const { id } = useParams()
    const [item , setItem] = useState(null)
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

    useEffect(() => {
        fetch('/saved-items.json')
            .then(response => response.json())
            .then(data => {
                const foundItem = data.find(item => item.id === id)
                setItem(foundItem)
            })
    }, [id])
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
                        <button onClick={() => setFeedbackSubmitted(true)}>Yes</button>
                        <button onClick={() => setFeedbackSubmitted(true)}>No</button>
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