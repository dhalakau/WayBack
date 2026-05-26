import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'

// Apply persisted theme before React mounts so the first paint is correct.
try {
  const stored = localStorage.getItem('wayback-theme')
  document.documentElement.setAttribute('data-theme', stored === 'dark' ? 'dark' : 'light')
} catch {
  document.documentElement.setAttribute('data-theme', 'light')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
