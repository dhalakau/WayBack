import { BrowserRouter , Routes , Route } from 'react-router-dom'
import MapPage from './pages/MapPage'
import ItemDetailPage from './pages/ItemDetailPage'
import FeedPage from './pages/FeedPage'
import Layout from './components/Layout'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/item/:id" element={<ItemDetailPage />} />
          <Route path="/feed" element={<FeedPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App  