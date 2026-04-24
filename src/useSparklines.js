import { useEffect, useState } from 'react'

// Fetches 7-day price history once on mount.
// Returns { sparklines: { SPY: [...], QQQ: [...], ... }, loading, error }
// Unlike prices, this doesn't auto-refresh -- daily bars don't change intraday.
export function useSparklines() {
  const [sparklines, setSparklines] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchSparklines() {
      try {
        const res = await fetch('/api/sparklines')
        if (!res.ok) throw new Error(`API returned ${res.status}`)
        const data = await res.json()

        if (cancelled) return

        if (data.error) {
          setError(data.error)
        } else {
          setSparklines(data.sparklines || {})
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Fetch failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchSparklines()
    return () => { cancelled = true }
  }, [])

  return { sparklines, loading, error }
}
