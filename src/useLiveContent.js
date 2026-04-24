import { useEffect, useState } from 'react'

// ============================================================
// useLiveContent -- React hook for watchlist + deepDive + archive
// ============================================================
// Calls /api/content on mount. Returns Sheet data when available,
// falls back to values from data.js if the fetch fails.
//
// Usage:
//   const { watchlist, deepDive, archive } = useLiveContent(
//     fallbackWatchlist, fallbackDeepDive
//   )
// ============================================================

export function useLiveContent(fallbackWatchlist, fallbackDeepDive) {
  const [watchlist, setWatchlist] = useState(fallbackWatchlist)
  const [deepDive, setDeepDive] = useState(fallbackDeepDive)
  const [archive, setArchive] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchContent() {
      try {
        const res = await fetch('/api/content')
        if (!res.ok) throw new Error(`API returned ${res.status}`)
        const data = await res.json()

        if (cancelled) return

        if (data.error) {
          setError(data.error)
          return
        }

        if (Array.isArray(data.watchlist) && data.watchlist.length > 0) {
          setWatchlist(data.watchlist)
        }

        if (data.deepDive && data.deepDive.title) {
          setDeepDive(data.deepDive)
        }

        if (Array.isArray(data.archive)) {
          setArchive(data.archive)
        }

        setError(null)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Fetch failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchContent()
    return () => { cancelled = true }
  }, [])

  return { watchlist, deepDive, archive, loading, error }
}
