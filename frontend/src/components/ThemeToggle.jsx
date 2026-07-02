import { forwardRef, useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

// Light/dark theme toggle. Theme is persisted in localStorage under
// "wayback-theme" and applied as data-theme on <html>. The initial value
// is bootstrapped in main.jsx before React mounts to avoid a flash of
// the wrong theme.
//
// Visual style matches the existing .wb-layers / .wb-fab buttons on the
// right edge of MapPage so the three controls (layers, theme, locate)
// read as a single stack.

const STORAGE_KEY = 'wayback-theme'

function readStoredTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'dark' || v === 'light') return v
  } catch { /* ignore: localStorage unavailable */ }
  return 'light'
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

const ThemeToggle = forwardRef(function ThemeToggle(_props, ref) {
  const [theme, setTheme] = useState(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* storage disabled */ }
  }, [theme])

  const next = theme === 'dark' ? 'light' : 'dark'
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <button
      ref={ref}
      type="button"
      className="wb-theme-toggle"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
    >
      {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
    </button>
  )
})

export default ThemeToggle
