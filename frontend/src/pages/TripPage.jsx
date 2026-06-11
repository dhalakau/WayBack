import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Calendar } from 'lucide-react'
import TabBar from '../components/TabBar'
import TripItinerary from '../components/TripItinerary'

// Standalone single-day plan route (mobile). The itinerary itself lives in
// TripItinerary so the desktop map can host the same content inside its
// floating panel. On a desktop viewport this route redirects to the map with
// the Plan tab active, where the panel renders the plan beside the live map.

export default function TripPage() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const onChange = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Desktop hosts the plan in the map panel; the standalone page is mobile-only.
  if (isDesktop) return <Navigate to="/?mode=plan" replace />

  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <>
      <div className="wb-trip">
        <header className="wb-trip-header">
          <Link to="/" className="wb-trip-back" aria-label="Back to map">
            <ArrowLeft size={20} />
          </Link>
          <div className="wb-trip-header-text">
            <h1 className="wb-trip-title">Your Munich day</h1>
            <p className="wb-trip-subtitle">
              5 stops chosen from your saved places, ordered by time of day.
            </p>
            <div className="wb-trip-date">
              <Calendar size={13} aria-hidden="true" /> {dateStr}
            </div>
          </div>
        </header>

        <main className="wb-trip-body">
          <TripItinerary />
        </main>
      </div>
      <TabBar current="plan" />
    </>
  )
}
