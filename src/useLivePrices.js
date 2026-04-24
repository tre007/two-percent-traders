import { useEffect, useState, useRef } from 'react'

// ============================================================
// useLivePrices — React hook
// ============================================================
// Calls /api/prices on mount and every REFRESH_INTERVAL ms after.
// Returns { prices, loading, error, lastUpdated, isStale }.
//
// Usage:
//   const { prices, loading, error, lastUpdated } = useLivePrices()
//   const btcPrice = prices['BTC']?.price  // => 105234.12
//
// In dev (no serverless function running), the fetch will fail and
// we fall back to nothing. The UI handles that gracefully.
// ============================================================

const REFRESH_INTERVAL = 30_000 // 30 seconds
const STALE_AFTER = 5 * 60_000  // Mark data stale if we couldn't refresh for 5min

export function useLivePrices() {
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function fetchPrices() {
      try {
        // Cancel any in-flight request
        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()

        const res = await fetch('/api/prices', { signal: abortRef.current.signal })

        if (!res.ok) {
          throw new Error(`API returned ${res.status}`)
        }

        const data = await res.json()

        if (cancelled) return

        if (data.error) {
          setError(data.error)
        } else {
          setPrices(data.prices || {})
          setLastUpdated(new Date(data.fetchedAt))
          setError(null)
        }
      } catch (err) {
        if (err.name === 'AbortError') return
        if (cancelled) return
        setError(err.message || 'Failed to fetch prices')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // Initial fetch
    fetchPrices()

    // Auto-refresh
    const interval = setInterval(fetchPrices, REFRESH_INTERVAL)

    return () => {
      cancelled = true
      clearInterval(interval)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  const isStale = lastUpdated
    ? Date.now() - lastUpdated.getTime() > STALE_AFTER
    : false

  return { prices, loading, error, lastUpdated, isStale }
}
