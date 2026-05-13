import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MapPage from './pages/MapPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Single-screen app: the MapPage handles map / saved / add modes internally. */}
        <Route path="*" element={<MapPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
