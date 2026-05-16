import { Link } from 'react-router-dom'
import { Map as MapIcon, Bookmark, Sparkles, CirclePlus } from 'lucide-react'

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
// Visual styling is identical to the prior inline nav and lives here so the
// TripPage gets the same chrome without having to duplicate CSS.

const TABS = [
  { key: 'map',   label: 'Map',   Icon: MapIcon },
  { key: 'saved', label: 'Saved', Icon: Bookmark },
  { key: 'plan',  label: 'Plan',  Icon: Sparkles },
  { key: 'add',   label: 'Add',   Icon: CirclePlus },
]

function targetForTab(key) {
  if (key === 'plan')  return '/trip'
  if (key === 'map')   return '/'
  return `/?mode=${key}`
}

export default function TabBar({ current, onModeSelect }) {
  return (
    <>
      <TabBarStyles />
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
    </>
  )
}

// Styles scoped to the bottom nav. Selectors are specific enough that they
// don't collide with the Directions panel's `.wb-nav-header / .wb-nav-modes /
// .wb-nav-legs` etc., which use different class names.
function TabBarStyles() {
  return (
    <style>{`
      .wb-nav {
        position: fixed; bottom: 0; left: 50%;
        transform: translateX(-50%);
        width: 100%; max-width: 440px; height: 60px;
        background: var(--surface-3, #14202d);
        display: flex;
        border-top: 0.5px solid var(--border, rgba(255,255,255,0.08));
        z-index: 700;
      }
      .wb-nav-item {
        flex: 1; display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 2px; cursor: pointer;
        color: var(--text-2, #9aa0a6); font-size: 11px;
        background: transparent; border: none;
        text-decoration: none;
        font-family: inherit;
      }
      .wb-nav-item .nav-icon {
        padding: 3px 14px; border-radius: 12px;
        transition: background 0.18s; display: flex;
      }
      .wb-nav-item.active { color: var(--accent, #a0e6d4); }
      .wb-nav-item.active .nav-icon { background: var(--accent-bg, rgba(160,230,212,0.18)); }
    `}</style>
  )
}
