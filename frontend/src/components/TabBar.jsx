import { Link } from 'react-router-dom'
import { Map as MapIcon, Bookmark, Compass, CirclePlus } from 'lucide-react'

// Shared bottom navigation — 4 tabs: Map / Saved / Plan / Add.
//
// Map / Saved / Add are MODES inside MapPage (the single-screen app); Plan is
// its own route (/trip). To keep that asymmetry behind a single API:
//
//   - On MapPage we pass `onModeSelect` so the three in-page tabs fire
//     changeMode() directly (matches the existing pattern).
//   - On TripPage we omit `onModeSelect`; those three tabs become <Link>s
//     back to "/", carrying ?mode=saved or ?mode=add so MapPage can resume
//     in the right view.
//   - The Plan tab is always a <Link to="/trip"> regardless of caller.
//
// Visual styling is shared with the rest of the app and lives in
// src/styles/global.css (selectors .wb-nav and .wb-nav-item).

const TABS = [
  { key: 'map',   label: 'Map',   Icon: MapIcon },
  { key: 'saved', label: 'Saved', Icon: Bookmark },
  { key: 'plan',  label: 'Plan',  Icon: Compass },
  { key: 'add',   label: 'Add',   Icon: CirclePlus },
]

function targetForTab(key) {
  if (key === 'plan')  return '/trip'
  if (key === 'map')   return '/'
  return `/?mode=${key}`
}

export default function TabBar({ current, onModeSelect }) {
  return (
    <nav className="wb-nav" aria-label="Primary">
      {TABS.map(({ key, label, Icon }) => {
        const active = current === key
        const className = `wb-nav-item ${active ? 'active' : ''}`
        const content = (
          <>
            <span className="nav-icon"><Icon size={20} /></span>
            <span>{label}</span>
          </>
        )
        // Plan is always a route — never an in-page mode.
        // Map/Saved/Add use the callback when provided (MapPage), otherwise
        // become Links back into MapPage with the appropriate query.
        if (onModeSelect && key !== 'plan') {
          return (
            <button
              key={key}
              type="button"
              className={className}
              aria-current={active ? 'page' : undefined}
              onClick={() => onModeSelect(key)}
            >
              {content}
            </button>
          )
        }
        return (
          <Link
            key={key}
            to={targetForTab(key)}
            className={className}
            aria-current={active ? 'page' : undefined}
          >
            {content}
          </Link>
        )
      })}
    </nav>
  )
}
