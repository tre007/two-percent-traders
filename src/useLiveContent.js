import { useEffect, useState } from 'react'

// ============================================================
// useLiveContent — React hook for watchlist + deepDive from Sheets
// ============================================================
// Calls /api/content on mount. Falls back to data.js values if fetch fails
// or if GOOGLE_SHEET_ID isn't configured yet.
//
// Usage:
//   const { watchlist, deepDive, loading, error } = useLiveContent(fallbackWatchlist, fallbackDeepDive)
// ============================================================

export function useLiveContent(fallbackWatchlist, fallbackDeepDive) {
  const [watchlist, setWatchlist] = useState(fallbackWatchlist)
  const [deepDive, setDeepDive] = useState(fallbackDeepDive)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fromSheet, setFromSheet] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchContent() {
      try {
        const res = await fetch('/api/content')
        if (!res.ok) throw new Error(`API returned ${res.status}`)
        const data = await res.json()

        if (cancelled) return

        if (data.error) {
          // API responded but something's misconfigured — keep fallback
          setError(data.error)
          return
        }

        // Watchlist: only replace if Sheet has entries
        if (Array.isArray(data.watchlist) && data.watchlist.length > 0) {
          setWatchlist(data.watchlist)
        }

        // Deep dive: only replace if Sheet has a title filled in
        if (data.deepDive && data.deepDive.title) {
          setDeepDive(data.deepDive)
        }

        setFromSheet(true)
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

  return { watchlist, deepDive, loading, error, fromSheet }
}
