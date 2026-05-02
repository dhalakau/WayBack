import { useState , useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getExplanationText } from '../utils/explanationText'

function FeedPage() {

    const [recommendations, setRecommendations] = useState([])

    useEffect(() => {
        fetch('/recommendations.json')
            .then(response => response.json())
            .then(data => {
                setRecommendations(data)
            })
    }, [])

   return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
        <h1>Feed Page</h1>

        {recommendations.map((rec) => (
            <div key={rec.item.id} style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '12px'
        }}>
            <h2>{rec.item.name}</h2>
            <p>{getExplanationText(rec.item, rec.explanation)}</p>
            <p>{rec.item.category}</p>
            <p>{rec.item.notes}</p>
            <Link to={`/item/${rec.item.id}`}>view details</Link>
        </div>
    ))}
  </div>
)
}           
export default FeedPage