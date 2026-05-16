import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MapPage from './pages/MapPage'
import TripPage from './pages/TripPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* One-day itinerary view (paper §4.3 / §4.4 / §4.6 composed). */}
        <Route path="/trip" element={<TripPage />} />
        {/* Single-screen app: the MapPage handles map / saved / add modes internally. */}
        <Route path="*" element={<MapPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
